import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoQuality, Calibration, OPTIONS, PRESETS, ORDER, choiceOf, settingsOf, needsBuild, presetOf, cardLabel } from '../src/quality.js';

function draw(control, fps, seconds, options = {}) {
  const settings = { visible: true, ready: true, automatic: true, atMin: true, target: 1 / 60, ...options };
  for (let i = 0; i < fps * seconds; i++) { const change = control.sample(1 / fps, settings); if (change) return change; }
  return null;
}
test('automatic quality ignores startup and short dips, then lowers sustained slow drawing', () => {
  const control = new AutoQuality();
  assert.equal(draw(control, 20, 7), null);
  assert.equal(draw(control, 60, 10), null);
  assert.equal(draw(control, 20, 17), 'down');
});
test('hidden tabs, loading, an explicit choice, the lightest preset and a resolution that can still go down do not lower it', () => {
  for (const options of [{ visible: false }, { ready: false }, { automatic: false }, { lightest: true }, { atMin: false }]) {
    const control = new AutoQuality();
    assert.equal(draw(control, 10, 30, options), null);
    assert.equal(draw(control, 20, 6), null, 'visible drawing gets a fresh warmup');
  }
});
test('a frame-rate limit is the pace to keep: thirty frames a second under a limit of thirty is not slow', () => {
  assert.equal(draw(new AutoQuality(), 30, 30, { target: 1 / 30 }), null);
  assert.equal(draw(new AutoQuality(), 20, 30, { target: 1 / 30 }), 'down');
});

test('a single long browser pause does not lower quality, while genuinely slow drawing does', () => {
  const control = new AutoQuality();
  const settings = { visible: true, ready: true, automatic: true, atMin: true, target: 1 / 60 };
  assert.equal(draw(control, 60, 15), null);
  assert.equal(control.sample(30, settings), null, 'one stalled frame is not thirty seconds of slow drawing');
  assert.equal(draw(control, 60, 10), null, 'normal drawing after a pause keeps the preset');
  assert.equal(draw(new AutoQuality(), 1, 20), 'down', 'very slow continuous drawing still lowers quality');
});

test('every preset sets every option to one of its choices, and the presets go up from Light to Ultra', () => {
  for (const key of ORDER) for (const [name, option] of Object.entries(OPTIONS)) assert.ok(option.choices.some(([v]) => v === PRESETS[key][name]), `${key}.${name}`);
  for (const name of ['scale', 'crowd', 'beams', 'shine', 'smoke']) for (let i = 1; i < ORDER.length; i++) assert.ok(PRESETS[ORDER[i]][name] >= PRESETS[ORDER[i - 1]][name], name);
  assert.deepEqual(ORDER.map(k => presetOf(PRESETS[k])), ORDER, 'a preset is recognised as itself');
});

test('choices kept by older versions and links still work, and custom values are checked', () => {
  assert.deepEqual(['low', 'normal', 'high', 'auto', 'ultra', 'custom', 'nonsense', null].map(v => choiceOf(v)), ['light', 'normal', 'high', 'auto', 'ultra', 'custom', 'auto', 'auto'], 'in a link: the names of now');
  assert.deepEqual(['low', 'normal', 'high', 'auto'].map(v => choiceOf(v, true)), ['light', 'high', 'ultra', 'auto'], 'kept by 0.36: its Normal is now High');
  const own = settingsOf('normal', { beams: 28, scale: 0.33, nonsense: 1, bloom: false });
  assert.equal(own.beams, 28); assert.equal(own.scale, PRESETS.normal.scale, 'a value that is not a choice is ignored'); assert.equal(own.bloom, false); assert.ok(!('nonsense' in own));
  assert.equal(presetOf(own), 'custom');
});

test('no graphics setting builds the venue again: from Ultra to Light and back, everything changes at once', () => {
  for (const a of ORDER) for (const b of ORDER) assert.equal(needsBuild(PRESETS[a], PRESETS[b]), false, `${a} to ${b}`);
});

// frames of a computer that keeps the screen's pace up to and including the given preset, and is slow above it
function measure(fastUpTo, target = 1 / 60) {
  const calibration = new Calibration(), tried = [calibration.preset];
  for (let i = 0; i < 4000; i++) {
    const slow = ORDER.indexOf(calibration.preset) > ORDER.indexOf(fastUpTo), found = calibration.sample(slow ? target * 1.6 : target, target);
    if (found?.next) tried.push(found.next);
    if (found?.done) return { done: found.done, tried };
  }
  return null;
}
test('automatic measures this computer: from Light up while it keeps the pace, back one at the first that does not', () => {
  assert.deepEqual(measure('normal'), { done: 'normal', tried: ['light', 'normal', 'high'] });
  assert.deepEqual(measure('ultra'), { done: 'ultra', tried: ORDER });
  assert.deepEqual(measure('none'), { done: 'light', tried: ['light'] }, 'a computer that keeps up with nothing gets Light');
  const calibration = new Calibration();
  for (let i = 0; i < 100; i++) calibration.sample(1 / 60);
  calibration.pause();
  assert.equal(calibration.sample(1 / 60), null, 'after a pause the preset is measured afresh');
});

test('the card is named as people know it', () => {
  assert.equal(cardLabel('NVIDIA Corporation, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL ES 3.2'), 'NVIDIA GeForce GTX 1660 SUPER');
  assert.equal(cardLabel('AMD, AMD Radeon Vega 11 Graphics (radeonsi, raven, LLVM 19.1.7, DRM 3.61, 6.17.1-arch1-1), OpenGL 4.6'), 'AMD Radeon Vega 11 Graphics');
  assert.equal(cardLabel('ANGLE Metal Renderer: Apple M1'), 'Apple M1');
  assert.equal(cardLabel('Apple M1'), 'Apple M1');
  assert.equal(cardLabel('NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11'), 'NVIDIA GeForce RTX 3060', 'Windows, after the ANGLE wrapper');
});
