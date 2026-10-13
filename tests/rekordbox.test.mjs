import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { decodeOSC, encodeOSC, makeRekordboxState, startRekordboxReceiver } from '../tools/rekordbox-bridge.mjs';
import { serve } from '../tools/serve.mjs';
import { withPage } from './browser.mjs';

test('OSC accepts standard wire messages and bundles, rejecting truncation and corrupt padding', () => {
  // Hand-written OSC wire bytes, independent of our encoder.
  const bytes = Buffer.from('2f312f74696d65002c66000042290000', 'hex');
  assert.deepEqual(decodeOSC(bytes), [{ address: '/1/time', args: [42.25] }]);
  const header = Buffer.from('2362756e646c65000000000000000001', 'hex');
  const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
  assert.deepEqual(decodeOSC(Buffer.concat([header, size, bytes])), decodeOSC(bytes));
  assert.throws(() => decodeOSC(bytes.subarray(0, bytes.length - 4)));
  const corrupt = Buffer.from(bytes); corrupt[11] = 1;
  assert.throws(() => decodeOSC(corrupt));
  assert.throws(() => decodeOSC(Buffer.concat([header, size])));
});

test('deck state validates input, times out, isolates decks and clears phrases when the track changes', () => {
  let t = 0;
  const state = makeRekordboxState({ now: () => t });
  const receive = (deck, field, value) => state.receive(encodeOSC(`/${deck}/${field}`, value), '192.168.1.2');
  assert.equal(state.snapshot().connected, false);
  receive(1, 'track/title', 'First track'); receive(1, 'phrase/current', 'Up 1');
  receive(1, 'time', 42.25); receive(2, 'time', 7);
  assert.equal(state.snapshot().connected, true, 'timestamp zero is still a valid reception');
  assert.equal(state.snapshot().decks[1].fields.time, 42.25);
  assert.equal(state.snapshot().decks[2].fields.time, 7);
  receive(1, 'time', -1); receive(1, 'bpm/current', NaN); receive(1, 'time', '42');
  state.receive(Buffer.from('broken'), '192.168.1.2');
  assert.equal(state.snapshot().decks[1].fields.time, 42.25);
  assert.equal(state.snapshot().rejected, 4);
  t = 3001;
  assert.equal(state.snapshot().connected, false);
  receive(1, 'track/title', 'Second track');
  assert.equal(state.snapshot().decks[1].fields['phrase/current'], undefined);
  assert.equal(state.snapshot().decks[2].connected, false);
  assert.equal(state.snapshot().decks[1].connected, true);
});

test('a real UDP packet reaches the local HTTP endpoint without executing track content', async () => {
  const receiver = await startRekordboxReceiver({ port: 0, host: '127.0.0.1' });
  const server = await serve(0, { rekordbox: receiver }), sender = dgram.createSocket('udp4');
  try {
    const destination = receiver.socket.address().port;
    await new Promise((resolve, reject) => sender.send(encodeOSC('/master/track/title', '<script>untrusted</script>'), destination, '127.0.0.1', error => error ? reject(error) : resolve()));
    const end = Date.now() + 2000;
    while (!receiver.snapshot().connected && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 10));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/__rekordbox`);
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.connected, true);
    assert.equal(state.sender, '127.0.0.1');
    assert.equal(state.decks.master.fields['track/title'], '<script>untrusted</script>');
    assert.equal(state.port, destination);
  } finally {
    sender.close(); await receiver.close(); await new Promise(resolve => server.close(resolve));
  }
});

test('missing analysis clears stale phrases and beats even when the title stays the same', () => {
  const state = makeRekordboxState();
  const receive = (field, value) => state.receive(encodeOSC(`/1/${field}`, value), '127.0.0.1');
  receive('track/title', 'Test track'); receive('time', 121.7);
  receive('phrase/available', 1); receive('phrase/current', 'UP 1');
  receive('phrase/next', 'UP 3'); receive('phrase/countin', 69); receive('beat/subdiv/1', 0.5);
  receive('phrase/available', 2);
  assert.equal(state.snapshot().rejected, 1);
  assert.equal(state.snapshot().decks[1].fields['phrase/current'], 'UP 1');
  receive('phrase/available', 0);
  const deck = state.snapshot().decks[1];
  assert.equal(deck.fields.time, Math.fround(121.7));
  assert.equal(deck.fields['track/title'], 'Test track');
  for (const field of ['phrase/current', 'phrase/next', 'phrase/countin', 'phrase/index', 'phrase/start', 'phrase/end', 'beat/subdiv/1', 'beat/position']) {
    assert.equal(deck.fields[field], undefined); assert.equal(deck.updated[field], undefined);
  }
});

test('same-titled tracks with different identities clear old timing and validate transport and boundaries', () => {
  const state = makeRekordboxState();
  const receive = (field, value) => state.receive(encodeOSC(`/1/${field}`, value), '127.0.0.1');
  receive('track/id', 'session:one'); receive('track/title', 'Same title');
  receive('phrase/index', 3); receive('phrase/start', 64); receive('phrase/end', 96);
  receive('beat/position', 72); receive('transport/playing', 0);
  receive('transport/playing', 2); receive('phrase/index', 3.5);
  assert.equal(state.snapshot().rejected, 2);
  assert.equal(state.snapshot().decks[1].fields['transport/playing'], 0);
  receive('track/id', 'session:two'); receive('track/title', 'Same title');
  assert.equal(state.snapshot().decks[1].fields['phrase/index'], undefined);
  assert.equal(state.snapshot().decks[1].fields['beat/position'], undefined);
  assert.equal(state.snapshot().decks[1].fields['transport/playing'], undefined);
});

test('connection page displays incoming phrases safely and distinguishes a disabled or lost receiver', async () => {
  await withPage([], async ({ send, evaluate, until, port }) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/rekordbox.html` });
    await until("document.getElementById('status')?.textContent.includes('Receiver is off')", 'Disabled receiver status missing');
    const state = { enabled: true, connected: true, sender: '127.0.0.1', host: '127.0.0.1', port: 4460, addresses: ['192.168.1.3'], lastReceived: 10,
      decks: { 1: { connected: true, fields: { 'track/title': '<img src=x onerror=alert(1)>', 'bpm/current': 124, time: 42.25, 'phrase/current': 'Up 1', 'phrase/next': 'Chorus 1', 'phrase/countin': 8 } } } };
    const result = await evaluate(`(async () => {
      const { renderConnection } = await import('/src/rekordbox-connection.js');
      renderConnection(${JSON.stringify(state)});
      const cells = [...document.querySelectorAll('#decks td')].map(cell => cell.textContent);
      const unsafe = !!document.querySelector('#decks img');
      const destination = document.getElementById('destination').textContent;
      renderConnection({ ...${JSON.stringify(state)}, connected: false, decks: { 1: { ...${JSON.stringify(state.decks[1])}, connected: false } } });
      return { cells, unsafe, destination, status: document.getElementById('status').textContent, connected: document.querySelector('#decks tr').dataset.connected };
    })()`);
    assert.deepEqual(result.cells, ['Deck 1', '<img src=x onerror=alert(1)>', '124.0', '0:42.3', 'Up 1', 'Chorus 1', '8.0']);
    assert.equal(result.unsafe, false);
    assert.match(result.destination, /127\.0\.0\.1:4460 on this computer/);
    assert.match(result.status, /Connection lost/);
    assert.equal(result.connected, 'false');
  });
});
