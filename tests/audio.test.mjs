import test from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../src/audio.js';

// The tap on the sound, without a browser: a context's sample rate and an ear that counts what it is given.
const tapped = () => {
  const audio = new Audio(() => {}), heard = [];
  Object.assign(audio, { ctx: { sampleRate: 48000 }, source: {}, tap: {}, blocks: [], dropped: 0, ear: { push: (b, from, to) => heard.push(to - from) } });
  return { audio, heard };
};

test('sound that no frame takes is kept for two seconds, not for as long as the show waits', () => {
  const { audio, heard } = tapped();
  for (let i = 0; i < 48000 * 60 / 128; i++) audio.take(new Float32Array(128));   // a minute in a hidden tab
  const kept = Math.ceil(48000 * 2 / 128);
  assert.equal(audio.blocks.length, kept);
  const missed = audio.pump(() => {});
  assert.ok(Math.abs(missed - 58) < 0.01, `missed ${missed} s`);
  assert.equal(heard.reduce((a, b) => a + b, 0), kept * 128, 'the last two seconds are listened to');
  assert.equal(audio.pump(() => {}), 0, 'what was missed is said once');
});

test('a frame that keeps up misses nothing', () => {
  const { audio } = tapped();
  for (let frame = 0; frame < 600; frame++) { for (let i = 0; i < 6; i++) audio.take(new Float32Array(128)); assert.equal(audio.pump(() => {}), 0); }
});
