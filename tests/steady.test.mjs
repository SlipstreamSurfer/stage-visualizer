import test from 'node:test';
import assert from 'node:assert/strict';
import { SteadyResolution, MIN } from '../src/steady.js';

// frames of a given length for a number of seconds; frame: (scale) => seconds, the card's time at that resolution
const run = (steady, seconds, frame, options) => { const changes = []; for (let t = 0; t < seconds;) { const dt = frame(steady.scale); t += dt; const next = steady.sample(dt, options); if (next !== null) changes.push(next); } return changes; };

test('slow frames lower the resolution a step a second, down to the minimum', () => {
  const steady = new SteadyResolution(), changes = run(steady, 20, () => 0.04);
  assert.deepEqual(changes.slice(0, 3), [0.95, 0.9, 0.85]);
  assert.equal(steady.scale, MIN); assert.ok(steady.atMin);
});

test('frames that keep the pace keep the resolution, and room to spare brings it back up', () => {
  const steady = new SteadyResolution();
  assert.deepEqual(run(steady, 10, () => 1 / 60), []);
  steady.scale = 0.8;
  run(steady, 30, () => 1 / 60);
  assert.equal(steady.scale, 1);
});

test('a 75 Hz screen is kept at its own pace, not at 60 frames a second', () => {
  const steady = new SteadyResolution();
  run(steady, 5, () => 1 / 75);
  assert.ok(Math.abs(steady.target - 1 / 75) < 0.0005, `target ${steady.target}`);
  run(steady, 4, () => 1 / 60);
  assert.ok(steady.scale < 1, 'sixty a second on a 75 Hz screen judders: the resolution goes down');
});

test('a card that just keeps up at one resolution settles there instead of switching back and forth', () => {
  const steady = new SteadyResolution(), frame = scale => scale <= 0.8 + 1e-9 ? 1 / 60 : 1 / 30;
  const changes = run(steady, 120, frame);
  assert.equal(steady.scale, 0.8);
  assert.ok(changes.length <= 12, `the resolution changed ${changes.length} times: ${changes}`);
});

test('a hidden tab, a venue change or the switch turned off are not measured', () => {
  const steady = new SteadyResolution();
  for (const options of [{ visible: false }, { ready: false }, { enabled: false }]) assert.deepEqual(run(steady, 10, () => 0.05, options), []);
  assert.equal(steady.scale, 1);
});
