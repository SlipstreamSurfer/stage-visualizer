import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoQuality } from '../src/quality.js';

function draw(control, fps, seconds, options = {}) {
  const settings = { visible: true, ready: true, automatic: true, quality: 'normal', ...options };
  for (let i = 0; i < fps * seconds; i++) { const change = control.sample(1 / fps, settings); if (change) return change; }
  return null;
}
test('automatic quality ignores startup and short dips, then lowers sustained slow drawing', () => {
  const control = new AutoQuality();
  assert.equal(draw(control, 20, 7), null);
  assert.equal(draw(control, 60, 10), null);
  assert.equal(draw(control, 20, 17), 'low');
});
test('hidden tabs, loading and explicit quality do not lower the viewer’s choice', () => {
  for (const options of [{ visible: false }, { ready: false }, { automatic: false }, { quality: 'low' }]) {
    const control = new AutoQuality();
    assert.equal(draw(control, 10, 30, options), null);
    assert.equal(draw(control, 20, 6), null, 'visible drawing gets a fresh warmup');
  }
});

test('a single long browser pause does not lower quality, while genuinely slow drawing does', () => {
  const control = new AutoQuality();
  const settings = { visible: true, ready: true, automatic: true, quality: 'normal' };
  assert.equal(draw(control, 60, 15), null);
  assert.equal(control.sample(30, settings), null, 'one stalled frame is not thirty seconds of slow drawing');
  assert.equal(draw(control, 60, 10), null, 'normal drawing after a pause keeps Normal quality');
  assert.equal(draw(new AutoQuality(), 1, 20), 'low', 'very slow continuous drawing still lowers quality');
});
