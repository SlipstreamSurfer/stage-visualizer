// When the music player names the tracks (Spotify on Linux, through the local server): the show starts each track
// afresh on its first kick, starts nothing big in a track's last half minute, and the DJ's players count down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES } from '../src/venues/index.js';
import { layout, byRole } from '../src/layout.js';
import { Signals, demo } from '../src/signals.js';
import { Director, MOODS } from '../src/director.js';
import { Mix } from '../src/mix.js';
import { serve } from '../tools/serve.mjs';

// the demo track in the Hangar, with what the player says at given moments: tell(t) returns a new `now` or nothing
function play(seconds, tell, each, moodKey = 'techno') {
  const world = layout(VENUES.hangar);
  for (const th of world.things) th.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const signals = new Signals(), director = new Director(byRole(world.things), moodKey, { venue: 'hangar' }), read = demo(signals, MOODS[moodKey].demoBpm);
  signals.decay = MOODS[moodKey].decay;
  const dt = 1 / 60;
  let now = null;
  for (let t = dt; t < seconds; t += dt) {
    signals.update(read(t), t, dt, { live: false });
    now = tell?.(t) ?? now; signals.told(now);
    director.update(signals, t, dt);
    each?.({ t, signals, director });
  }
  return { signals, director };
}
const track = (id, position = 0, length = 360) => ({ id, playing: true, artist: 'Someone', title: id, position, length });

test('the player says another track began: the listening starts afresh, and the new palette and looks land on its first kick after the crossfade', () => {
  let toldAt = null, palette = null, newTrack = 0, changedAt = null, kickAt = null;
  const { signals } = play(80, t => t < 1 / 60 * 1.5 ? track('a', 10) : Math.abs(t - 50) < 1 / 120 ? (toldAt = t, track('b')) : null, ({ t, signals, director }) => {
    if (signals.ev.newTrack) { newTrack++; palette = director.palette; assert.equal(signals.listener.tempo.bpm, 0, 'the tempo is learnt again'); }
    if (palette !== null && changedAt === null && director.palette !== palette) { changedAt = t; kickAt = signals.ev.kick ? t : null; }
  });
  assert.equal(newTrack, 1, 'one new track, told once');
  assert.ok(changedAt - toldAt >= 3 && changedAt - toldAt < 4.5, `the palette changed ${(changedAt - toldAt).toFixed(2)} s after the player moved on`);
  assert.equal(kickAt, changedAt, 'on a kick');
  assert.ok(signals.track.known && signals.track.id === 'b' && Math.abs(signals.remaining - (360 - 30)) < 0.1, `the track has ${signals.remaining} s left`);
});

test('while the player names the tracks a palette lasts the whole track; without it, it changes with time', () => {
  const palettes = told => { const seen = new Set(); play(MOODS.hard.paletteHold + 50, told ? t => t < 0.02 ? track('long', 0, 900) : null : null, ({ director }) => seen.add(director.palette), 'hard'); return seen.size; };
  assert.equal(palettes(true), 1);
  assert.ok(palettes(false) > 1);
});

test('in the last half minute of a track nothing big starts: the scene, and with it the look, holds', () => {
  const scenes = told => { let changes = 0, scene = null;
    play(110, told ? t => t < 0.02 ? track('ending', 0, 5) : null : null, ({ t, director }) => { if (t > 5 && scene !== null && director.scene !== scene) changes++; scene = director.scene; });
    return changes; };
  const free = scenes(false);
  assert.ok(free >= 2, `without a player the demo changes scene ${free} times`);
  assert.equal(scenes(true), 0, 'the scene holds');
});

test('the players in the booth count down what is left, and follow a jump in the track', () => {
  const mix = new Mix(), sig = t => ({ m: { activity: 1, bpm: 128, phase: 'groove' }, ev: { kick: 0 }, kick: 0, bass: 0.5, mid: 0.4, treble: 0.2, energy: 0.5, phase: t * 2 });
  assert.equal(mix.remaining(0), null, 'nothing to count down from without a player');
  mix.told(track('a', 100, 300), 0);
  for (let t = 0; t < 20; t += 1 / 60) mix.update(sig(t), t, 1 / 60);
  assert.ok(Math.abs(mix.remaining(20) - 180) < 0.1, `${mix.remaining(20)} s left`);
  mix.told(track('a', 250, 300), 20);   // the listener skipped ahead
  assert.ok(Math.abs(mix.remaining(20) - 50) < 1e-9 && mix.tracks === 1, 'the same track, further on');
  mix.told({ id: 'a', playing: false }, 21);
  assert.equal(mix.remaining(21), null, 'paused: not known');
});

test('the local server tells an open page about the track as it changes (server-sent events), and closing it ends the feed', async () => {
  const server = await serve(0), base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(base + '/__track?live');
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body.getReader(), { value } = await reader.read(), first = new TextDecoder().decode(value);
    assert.match(first, /^data: \{.*\}\n\n/, 'at once, what plays now (nothing, when nothing plays)');
    server.close();
    while (!(await reader.read()).done);   // the feed ends with the server
  } finally { server.close(); }
});
