import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { Director } from '../src/director.js';
import { Signals } from '../src/signals.js';
import { normalizeControls, normalizePresets } from '../src/show-controls.js';
import { SHOW_THEMES, blendTheme } from '../src/show-themes.js';

function rig(theme = 'auto', venue = 'hangar', overrides = {}) {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  return { groups: byRole(L.things), director: new Director(byRole(L.things), 'techno', { venue }),
    look: { light: 1, haze: 1, off: {}, controls: normalizeControls({ showTheme: theme, ...overrides }) } };
}
function advance(r, sig, frame) {
  // Identical random input isolates visual theme changes from fixture noise.
  const random = Math.random; Math.random = () => 0.5;
  try { r.director.update(sig, frame / 60, 1 / 60, r.look); } finally { Math.random = random; }
}
function signal(frame) {
  const sig = new Signals(), build = frame < 120;
  Object.assign(sig.m, { section: build ? 'break' : 'peak', phase: build ? 'break' : 'groove',
    activity: 1, hasGrooved: true, build: build ? frame / 120 : 0, bpm: 120 });
  Object.assign(sig, { phase: frame / 30, beats: Math.floor(frame / 30), energy: 0.5,
    bass: 0.4, mid: 0.3, treble: 0.2, kick: 0.6 });
  sig.ev = { kick: frame % 30 === 0 ? 1 : 0, drop: frame === 120, from: frame === 120 ? 'break' : null };
  sig.drop = frame === 120 ? 1 : 0;
  return sig;
}

test('show themes survive presets, while old or invalid settings retain the existing show', () => {
  assert.equal(normalizeControls({}).showTheme, 'auto');
  for (const bad of ['unknown', '__proto__', null, 3]) assert.equal(normalizeControls({ showTheme: bad }).showTheme, 'auto');
  for (const key of Object.keys(SHOW_THEMES)) {
    const saved = normalizePresets(JSON.parse(JSON.stringify([{ id: key, name: key, venue: 'hangar', mood: 'techno', controls: { showTheme: key } }])));
    assert.equal(saved[0].controls.showTheme, key);
  }
});

test('Hangar themes compose different wall, arch and laser treatments without changing cues or truss targets', () => {
  const identities = [];
  for (const [key, theme] of Object.entries(SHOW_THEMES)) {
    const original = rig(), themed = rig(key);
    for (let frame = 0; frame < 420; frame++) {
      const sig = signal(frame), phase = sig.phase;
      for (const r of [original, themed]) advance(r, sig, frame);
      assert.equal(sig.phase, phase, 'the visual theme never rewrites the music clock');
      assert.equal(themed.director.scene, original.director.scene);
      assert.equal(themed.director.drops, original.director.drops);
      assert.equal(themed.director.program, original.director.program, 'accepted head choreography stays in place');
      assert.deepEqual(themed.groups.truss.map(f => [f.ch.drop, f.ch.roll, f.ch.hold]), original.groups.truss.map(f => [f.ch.drop, f.ch.roll, f.ch.hold]));
      assert.deepEqual(themed.groups.overhead.map(f => [f.ch.pan, f.ch.tilt]), original.groups.overhead.map(f => [f.ch.pan, f.ch.tilt]));
    }
    assert.equal(themed.groups.wall[0].ch.theme, theme.visual);
    assert.ok(themed.groups.arch.every(f => f.ch.pattern === theme.arch));
    assert.ok(themed.groups.laser.every(f => f.ch.mode === theme.laser));
    identities.push(themed.groups.overhead[0].ch.color.map(n => n.toFixed(3)).join(','));
  }
  assert.equal(new Set(identities).size, 3, 'the themes have distinct light colour identities');
});

test('theme colours yield to manual palettes, switches and group faders', () => {
  for (const key of Object.keys(SHOW_THEMES)) {
    const r = rig(key, 'hangar', { palette: 'white', levels: { arch: 0 } });
    r.look.off.wall = r.look.off.laser = true;
    for (let frame = 0; frame < 300; frame++) advance(r, signal(frame), frame);
    for (const role of ['overhead', 'stage', 'wash']) for (const f of r.groups[role]) {
      assert.ok(f.ch.color.every(c => c > 0.9));
      assert.ok(Math.max(...f.ch.color) - Math.min(...f.ch.color) < 1e-9, 'manual white stays neutral');
    }
    for (const role of ['wall', 'laser', 'arch']) for (const f of r.groups[role]) { assert.equal(f.ch.dim, 0); assert.equal(f.ch.flash || 0, 0); }
  }
});

test('theme selection has no effect outside Hangar', () => {
  const original = rig('auto', ''), themed = rig('hypnotic', '');
  for (let frame = 0; frame < 180; frame++) for (const r of [original, themed]) advance(r, signal(frame), frame);
  assert.deepEqual(themed.groups.wall.map(f => f.ch), original.groups.wall.map(f => f.ch));
  assert.equal(themed.groups.wall[0].ch.theme, 0);
});

test('wall-theme transitions remain bounded and continuous through rapid switches and clearing', () => {
  const weights = [0, 0, 0];
  for (const visual of [1, 2, 3, 1, 0]) {
    for (let frame = 0; frame < 180; frame++) {
      const before = [...weights]; blendTheme(weights, visual, 1 / 60);
      assert.ok(weights.every((w, i) => w >= 0 && w <= 1 && Math.abs(w - before[i]) < 0.01));
      assert.ok(weights.reduce((sum, w) => sum + w, 0) <= 1 + 1e-12);
    }
  }
  for (let frame = 0; frame < 900; frame++) blendTheme(weights, 0, 1 / 60);
  assert.ok(weights.every(w => w < 0.0001), 'clearing the theme restores the original visuals');
});

test('the themed wall develops from quiet through the build to the peak without cutting', () => {
  for (const key of Object.keys(SHOW_THEMES)) {
    const r = rig(key), seen = [];
    for (let frame = 0; frame < 420; frame++) { advance(r, signal(frame), frame); seen.push({ vj: [...r.groups.wall[0].ch.vj], build: r.groups.wall[0].ch.vjBuild }); }
    for (const [i, s] of seen.entries()) {
      assert.ok(Math.abs(s.vj.reduce((a, b) => a + b) - 1) < 1e-9, 'quiet, build and peak share the wall');
      if (i) assert.ok(s.vj.every((w, j) => Math.abs(w - seen[i - 1].vj[j]) < 0.05), `${key}: frame ${i} changes treatment gradually`);
    }
    assert.ok(seen[20].vj[0] > 0.8, `${key}: the start of a break is quiet`);
    assert.ok(seen[119].vj[1] > 0.5 && seen[119].build > 0.95, `${key}: the end of the build shows the build treatment`);
    assert.ok(seen[122].build > 0.95, `${key}: the build shape is held while it fades after the drop`);
    assert.ok(seen[120 + 90].vj[2] > 0.9, `${key}: within one and a half seconds of the drop the wall is at its peak`);
  }
  const calm = rig('melodic');
  for (let frame = 0; frame < 600; frame++) { const sig = signal(300); sig.m.section = 'intro'; sig.ev = {}; sig.drop = 0; advance(calm, sig, frame); }
  assert.ok(calm.groups.wall[0].ch.vj[0] > 0.99, 'a calm intro settles on the quiet treatment');
});
