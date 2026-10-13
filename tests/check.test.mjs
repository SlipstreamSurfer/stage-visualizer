// The second opinion (tools/reference.mjs) and the check built on it, on music whose arrangement is known exactly.
// If the yardstick is wrong, everything measured with it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { track } from './synth.mjs';
import { reference } from '../tools/reference.mjs';
import { check, steadiness } from '../tools/check.mjs';

const song = track(126, [
  { beats: 64, kick: true, hats: 0.5, pad: 0.4 },
  { beats: 32, pad: 0.5, riser: 1 },                       // a break of 32 beats
  { beats: 64, kick: true, hats: 1, pad: 1 },
  { beats: 8, hats: 0.5 },                                 // the kick held back for two bars: a pause, not a break
  { beats: 48, kick: true, bass: 0.6, hats: 1, pad: 1 },   // with a bass note between the kicks
]);
const [, breakAt, dropAt, gapAt, backAt] = song.starts;

test('the second opinion finds the tempo, the kicks and the gaps of a known track', () => {
  const ref = reference(song.pcm);
  assert.ok(Math.abs(ref.bpm - 126) < 0.2, `tempo ${ref.bpm}`);
  assert.equal(ref.gaps.length, 2, JSON.stringify(ref.gaps));
  assert.ok(Math.abs(ref.gaps[0].from - (breakAt - song.beat)) < 0.05 && Math.abs(ref.gaps[0].to - dropAt) < 0.05, `the break: ${JSON.stringify(ref.gaps[0])}, expected ${breakAt - song.beat} to ${dropAt}`);
  assert.ok(Math.abs(ref.gaps[1].to - backAt) < 0.05, `the kick back at ${ref.gaps[1].to}, expected ${backAt}`);
  assert.ok(Math.abs(ref.kicks.length - 176) <= 5, `${ref.kicks.length} kicks, expected 176: of the 48 bass notes between the kicks, hardly any may count as one`);
});

test('on that track the show and the second opinion agree: the drop is on the kick, and the pause is no break', () => {
  const r = check(song.pcm);
  assert.deepEqual(r.issues, []);
  assert.equal(r.drops.right, 1);
  assert.equal(r.tempoRight, 1, 'the tempo is the track\'s own all the way');
  assert.ok(r.agree > 0.97, `agreement ${r.agree}`);
  for (const late of r.drops.late) assert.ok(Math.abs(late) < 0.06, `a drop ${late} s from the kick`);
});

test('on that track the show hears the same drops at every frame rate', () => {
  const st = steadiness(song.pcm);
  assert.equal(st.drops, 1, JSON.stringify(st.runs));
  assert.equal(st.share, 1, JSON.stringify(st.runs));
});
