// What is on the DJ's players and what the mixer reads (src/mix.js), without a picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Mix, COLS } from '../src/mix.js';
import { Signals, demo } from '../src/signals.js';

// music as the show would hear it: a kick on every beat, and whatever else is asked for
const music = (t, { bpm = 128, silent = false, drop = false } = {}) => {
  const beat = t * bpm / 60, phase = beat % 1, kick = !silent && phase < 1 / 60 * bpm / 60;
  return { m: { activity: silent ? 0 : 1, bpm: silent ? 0 : bpm, phase: 'groove' }, ev: { kick: kick ? 1 : 0, silent, drop: drop && kick },
    kick: silent ? 0 : Math.exp(-phase * 4), bass: silent ? 0 : Math.exp(-phase * 6), mid: silent ? 0 : 0.4, treble: silent ? 0 : 0.2, energy: silent ? 0 : 0.5, phase: beat };
};
const play = (mix, from, to, opts, each) => { for (let t = from; t < to; t += 1 / 60) { mix.update(music(t, typeof opts === 'function' ? opts(t) : opts), t, 1 / 60); each?.(t); } };

test('the first track is on the player left of the mixer, and its waveform is the music as it came in', () => {
  const mix = new Mix();
  play(mix, 0, 10);
  assert.deepEqual([0, 1, 2, 3].map(i => mix.state(i)), ['idle', 'play', 'cue', 'idle']);
  assert.ok(Math.abs(mix.elapsed(10) - 10) < 0.1, `it has played for ${mix.elapsed(10)} s`);
  // a kick every beat: the bass stands up once every fifteen columns at 128, and falls away between
  const bass = Array.from({ length: 150 }, (_, k) => mix.wave(k)[0]), tops = bass.flatMap((v, k) => k > 0 && k < 149 && v > 0.6 && v >= bass[k - 1] && v > bass[k + 1] ? [k] : []);
  assert.ok(tops.length >= 9 && tops.slice(1).every((k, n) => Math.abs(k - tops[n] - 60 / 128 * COLS) <= 1), `the kicks in the waveform are at columns ${tops}`);
  assert.ok(Math.max(...bass) > 0.9 && Math.min(...bass) < 0.15, `the bass goes from ${Math.min(...bass).toFixed(2)} to ${Math.max(...bass).toFixed(2)}`);
  assert.ok(Math.abs(mix.turn[1] - 10 * 100 / 3 / 60 * Math.PI * 2) < 0.05 && mix.turn[2] === 0, 'the jog wheel of the player that plays turns at 33 1/3');
});

test('the meters follow the music: up on the kick, the master with them, and nothing on a channel that is not in the mix', () => {
  const mix = new Mix();
  let top = 0, low = 1;
  play(mix, 0, 8, {}, t => { if (t > 2) { top = Math.max(top, mix.levels[1]); low = Math.min(low, mix.levels[1]); assert.equal(mix.levels[2], 0); assert.ok(Math.abs(mix.master - mix.levels[1] * 0.96) < 1e-9); } });
  assert.ok(top > 0.85 && low > 0.4 && low < top - 0.15, `the level moves between ${low.toFixed(2)} and ${top.toFixed(2)}`);
  assert.ok(mix.peaks[1] >= mix.levels[1], 'the peak stays up for a moment');
  play(mix, 8, 11, { silent: true });
  assert.ok(mix.levels[1] < 0.01 && mix.master < 0.01, 'silence reads nothing');
});

test('after a silence the next track simply starts on the other player', () => {
  const mix = new Mix();
  play(mix, 0, 20); play(mix, 20, 24, { silent: true }); play(mix, 24, 30);
  assert.deepEqual([mix.playing, mix.next, mix.leaving, mix.tracks], [2, 1, -1, 2]);
  assert.ok(Math.abs(mix.elapsed(30) - 6) < 0.6 && mix.mixing === 0, 'it starts again from nothing, with no other track under it');
  assert.ok(mix.levels[2] > 0.4 && mix.levels[1] < 0.01);
});

test('a tempo that moves and stays is the next track being mixed in: both channels are up for a while, then the old one is gone', () => {
  const mix = new Mix();
  play(mix, 0, 60);
  let both = 0;
  play(mix, 60, 90, { bpm: 133 }, () => { if (mix.leaving >= 0 && mix.levels[1] > 0.1 && mix.levels[2] > 0.1) both += 1 / 60; });
  assert.deepEqual([mix.playing, mix.next, mix.leaving, mix.tracks, mix.bpm], [2, 1, -1, 2, 133]);
  assert.ok(both > 5 && both < 14, `two tracks in the mix for ${both.toFixed(1)} s`);
  assert.ok(mix.levels[1] < 0.01, 'the old track is out');
  // a tempo that only wobbles for a moment is the same track
  const steady = new Mix();
  play(steady, 0, 60); play(steady, 60, 63, { bpm: 133 }); play(steady, 63, 80);
  assert.equal(steady.tracks, 1);
});

test('a track that has run for five and a half minutes is mixed out at its next drop, and the demo show keeps the booth busy', () => {
  const mix = new Mix();
  play(mix, 0, 340, t => ({ drop: t > 100 && t < 101 }));   // a drop early on changes nothing
  assert.equal(mix.tracks, 1);
  play(mix, 340, 342, { drop: true });
  assert.deepEqual([mix.tracks, mix.playing, mix.leaving], [2, 2, 1]);
  const signals = new Signals(), read = demo(signals, 132), booth = new Mix();
  for (let t = 1 / 60; t < 60; t += 1 / 60) {
    signals.update(read(t), t, 1 / 60, { live: false }); booth.update(signals, t, 1 / 60);
    for (const v of [...booth.levels, ...booth.peaks, booth.master, ...booth.turn, ...booth.wave(3)]) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1e4);
  }
  assert.ok(booth.bpm > 125 && booth.bpm < 140 && booth.levels[1] > 0.3, `the demo plays on player two at ${booth.bpm} BPM`);
});

test('told which track plays, the player names it, counts its time, and changes players when the track does, not on a guess', () => {
  const mix = new Mix();
  mix.told({ id: 'a', playing: true, artist: 'Someone', title: 'First', position: 100 }, 0);
  play(mix, 0, 40, {}, t => { if (Math.abs(t % 3) < 1 / 120) mix.told({ id: 'a', playing: true, artist: 'Someone', title: 'First', position: 100 + t }, t); });
  assert.deepEqual([mix.title, mix.playing, mix.tracks], ['Someone - First', 1, 1]);
  assert.ok(Math.abs(mix.elapsed(40) - 140) < 0.1, `the time is the track's own: ${mix.elapsed(40)} s`);
  play(mix, 40, 70, { bpm: 133 });                 // the tempo moves and stays: a guess would call this another track
  assert.equal(mix.tracks, 1);
  mix.told({ id: 'b', playing: true, artist: 'Other', title: 'Second', position: 0.4 }, 70);
  assert.deepEqual([mix.title, mix.before, mix.playing, mix.leaving, mix.tracks], ['Other - Second', 'Someone - First', 2, 1, 2]);
  assert.ok(mix.mixing === 1 && Math.abs(mix.elapsed(70) - 0.4) < 1e-9, 'it comes in under the last one, from its beginning');
  play(mix, 70, 400, t => ({ drop: t > 399 }));    // a long track and a drop: no guess either
  assert.equal(mix.tracks, 2);
  mix.told({}, 400);                               // the player has stopped telling: back to guessing
  play(mix, 400, 402, { drop: true });
  assert.equal(mix.tracks, 3);
});
