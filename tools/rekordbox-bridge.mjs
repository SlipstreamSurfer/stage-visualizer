// Receive rkbx_link's documented OSC output. This reads data only; it never
// controls Rekordbox or changes the show. https://github.com/grufkork/rkbx_link
import dgram from 'node:dgram';
import os from 'node:os';

export function decodeOSC(packet) {
  const messages = [];
  function parse(buf, depth = 0) {
    if (depth > 8 || !buf.length || buf.length % 4) throw new Error('Invalid OSC packet');
    if (buf.subarray(0, 8).equals(Buffer.from('#bundle\0'))) {
      if (buf.length < 16) throw new Error('Truncated OSC bundle');
      let offset = 16;
      while (offset < buf.length) {
        if (offset + 4 > buf.length) throw new Error('Truncated OSC bundle size');
        const size = buf.readUInt32BE(offset); offset += 4;
        if (!size || offset + size > buf.length) throw new Error('Truncated OSC bundle element');
        parse(buf.subarray(offset, offset + size), depth + 1); offset += size;
      }
      return;
    }
    let offset = 0;
    const string = () => {
      const end = buf.indexOf(0, offset);
      if (end < offset || end - offset > 2048) throw new Error('Invalid OSC string');
      const value = buf.toString('utf8', offset, end), next = (end + 4) & ~3;
      if (next > buf.length || buf.subarray(end, next).some(n => n !== 0)) throw new Error('Invalid OSC padding');
      offset = next; return value;
    };
    const address = string(), types = string();
    if (!address.startsWith('/') || !types.startsWith(',')) throw new Error('Invalid OSC message');
    const args = [];
    for (const type of types.slice(1)) {
      if (type === 's') { args.push(string()); continue; }
      if (type === 'T' || type === 'F') { args.push(type === 'T'); continue; }
      const size = type === 'd' ? 8 : (type === 'i' || type === 'f') ? 4 : 0;
      if (!size || offset + size > buf.length) throw new Error('Unsupported or truncated OSC argument');
      args.push(type === 'i' ? buf.readInt32BE(offset) : type === 'f' ? buf.readFloatBE(offset) : buf.readDoubleBE(offset));
      offset += size;
    }
    if (offset !== buf.length || messages.length >= 256) throw new Error('Invalid OSC message length');
    messages.push({ address, args });
  }
  parse(packet);
  return messages;
}

export function encodeOSC(address, value) {
  const string = value => {
    const bytes = Buffer.from(value, 'utf8'), padded = Buffer.alloc((bytes.length + 4) & ~3);
    bytes.copy(padded); return padded;
  };
  let tag, body;
  if (typeof value === 'string') { tag = ',s'; body = string(value); }
  else { tag = ',f'; body = Buffer.alloc(4); body.writeFloatBE(value); }
  return Buffer.concat([string(address), string(tag), body]);
}

export function makeRekordboxState({ now = Date.now } = {}) {
  let lastReceived = null, sender = null, accepted = 0, rejected = 0;
  const decks = {};
  function receive(packet, address) {
    let messages;
    try { messages = decodeOSC(packet); } catch { rejected++; return; }
    for (const { address: path, args } of messages) {
      const match = path.match(/^\/(master|[1-4])\/(bpm\/(?:current|original)|time|track\/(?:id|title|artist|album)|transport\/playing|phrase\/(?:current|next|countin|available|index|start|end)|beat\/(?:subdiv\/1|position))$/);
      if (!match || args.length !== 1) continue;
      const [, id, field] = match, value = args[0];
      const text = field.startsWith('track/'), phrase = field === 'phrase/current' || field === 'phrase/next';
      if (text ? typeof value !== 'string' : phrase ? !((typeof value === 'string') || (typeof value === 'number' && Number.isFinite(value))) : !(typeof value === 'number' && Number.isFinite(value))) { rejected++; continue; }
      if (!text && !phrase && (value < 0 || (field.startsWith('bpm/') && value > 1000) || (field === 'beat/subdiv/1' && value > 1))) { rejected++; continue; }
      if ((field === 'phrase/available' || field === 'transport/playing') && value !== 0 && value !== 1) { rejected++; continue; }
      if (['phrase/index', 'phrase/start', 'phrase/end'].includes(field) && !Number.isInteger(value)) { rejected++; continue; }
      const t = now();
      const deck = decks[id] ||= { fields: {}, updated: {}, receivedAt: null };
      // Do not display the preceding track's phrases as the new track's analysis.
      if ((field === 'track/id' && deck.fields[field] !== undefined && deck.fields[field] !== value) ||
          (field === 'track/title' && deck.fields[field] && deck.fields[field] !== value)) {
        deck.fields = {}; deck.updated = {};
      }
      if (field === 'phrase/available' && value === 0) {
        for (const key of ['phrase/current', 'phrase/next', 'phrase/countin', 'phrase/index', 'phrase/start', 'phrase/end', 'beat/subdiv/1', 'beat/position']) {
          delete deck.fields[key]; delete deck.updated[key];
        }
      }
      deck.fields[field] = value; deck.updated[field] = t; deck.receivedAt = t;
      lastReceived = t; sender = address; accepted++;
    }
  }
  function snapshot() {
    const t = now();
    return { enabled: true, connected: lastReceived !== null && t - lastReceived < 3000,
      lastReceived, sender, accepted, rejected,
      decks: Object.fromEntries(Object.entries(decks).map(([id, deck]) => [id, { ...deck, connected: t - deck.receivedAt < 3000 }])) };
  }
  return { receive, snapshot };
}

export async function startRekordboxReceiver({ port = 4460, host = '127.0.0.1' } = {}) {
  const socket = dgram.createSocket('udp4'), state = makeRekordboxState();
  let error = null;
  socket.on('message', (packet, remote) => state.receive(packet, remote.address));
  await new Promise((resolve, reject) => {
    const failed = e => { socket.close(); reject(e); };
    socket.once('error', failed);
    socket.bind(port, host, () => { socket.removeListener('error', failed); resolve(); });
  });
  socket.on('error', e => { error = e.message; });
  const addresses = Object.values(os.networkInterfaces()).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  return { socket, snapshot: () => ({ ...state.snapshot(), port: socket.address().port, host, addresses, error }),
    close: () => new Promise(resolve => socket.close(resolve)) };
}
