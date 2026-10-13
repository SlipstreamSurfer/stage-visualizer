const $ = id => document.getElementById(id);
const position = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}` : '—';
const phrase = value => typeof value === 'number' ? `Category ${value}` : value || '—';
// Numeric categories deliberately retain their meaning: 2 can be Verse or Up,
// so it cannot safely be relabelled as a build-up without the original mood.
export function renderConnection(state) {
  $('status').textContent = !state.enabled ? 'Receiver is off · start the server with npm run rekordbox'
    : state.error ? 'Receiver error' : state.connected ? `Receiving deck data from ${state.sender}`
      : state.lastReceived !== null ? 'Connection lost · the values below are from the last received messages'
        : 'Receiver ready · waiting for Rekordbox';
  $('destination').textContent = state.enabled ? state.host === '127.0.0.1'
    ? `Send OSC to 127.0.0.1:${state.port} on this computer.`
    : `Send OSC to this PC on UDP port ${state.port}. PC addresses: ${state.addresses?.join(', ') || 'not available'}` : '';
  $('error').hidden = !state.error; $('error').textContent = state.error || '';
  const rows = [];
  for (const [id, deck] of Object.entries(state.decks || {})) {
    const f = deck.fields, row = document.createElement('tr'); row.dataset.connected = String(deck.connected);
    const values = [id === 'master' ? 'Master' : `Deck ${id}`, [f['track/artist'], f['track/title']].filter(Boolean).join(' · ') || '—',
      Number.isFinite(f['bpm/current']) ? f['bpm/current'].toFixed(1) : '—', position(f.time), phrase(f['phrase/current']), phrase(f['phrase/next']),
      Number.isFinite(f['phrase/countin']) ? f['phrase/countin'].toFixed(1) : '—'];
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    rows.push(row);
  }
  $('decks').replaceChildren(...rows); $('empty').hidden = rows.length > 0;
}
async function poll() {
  try {
    const response = await fetch('/__rekordbox', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Receiver unavailable');
    renderConnection(await response.json());
  } catch {
    $('status').textContent = 'Cannot reach the Stage Visualizer server';
    for (const row of $('decks').children) row.dataset.connected = 'false';
  }
  setTimeout(poll, document.hidden ? 1500 : 250);
}
poll();
