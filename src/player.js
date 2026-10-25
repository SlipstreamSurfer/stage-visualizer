// What the music player on this computer says it plays, from the local server (tools/serve.mjs): the track, where it
// is in it and how long it is. The server sends it the moment it changes; where there is no such server (a page
// opened from a file or from another host) there is nothing, and the show guesses the tracks from the sound alone.
// No picture and no page in here beyond the connection.
//
//   now   { id, playing, artist, title, position, length } as last told, or null; a new object each time it is told
export function followPlayer() {
  const player = { now: null };
  const ask = () => fetch('/__track').then(r => r.ok ? r.json() : Promise.reject()).then(now => { player.now = now; setTimeout(ask, 3000); }, () => {});
  if (typeof EventSource === 'undefined') { ask(); return player; }
  let heard = false;
  const live = new EventSource('/__track?live');
  live.onmessage = e => { heard = true; try { player.now = JSON.parse(e.data); } catch {} };
  live.onerror = () => { if (!heard) { live.close(); ask(); } };   // no live feed (an older server): ask now and then
  return player;
}
