import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeControls, normalizePresets, parseStored, LIGHT_ROLES } from '../src/show-controls.js';
import { VENUES } from '../src/venues/index.js';
import { TEST_VENUE } from './rig.mjs';
import { layout, byRole } from '../src/layout.js';
import { Director, MOODS } from '../src/director.js';
import { Signals, demo } from '../src/signals.js';

function rig(controls) {
  const world = layout(TEST_VENUE);
  for (const f of world.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(world.things), director = new Director(groups, 'techno'), signals = new Signals(), read = demo(signals, MOODS.techno.demoBpm);
  const look = { light: 1, haze: 1, off: {}, controls };
  const tick = t => { signals.update(read(t), t, 1 / 60, { live: false }); director.update(signals, t, 1 / 60, look); };
  return { director, groups, look, tick };
}

test('stored controls recover from damaged data and limit values before reaching the rig', () => {
  assert.deepEqual(normalizeControls(parseStored('{broken')), normalizeControls({}));
  const c = normalizeControls({ levels: { overhead: -2, roof: 10, coil: null }, beamWidth: Infinity, cameraSpeed: -1, palette: 'bad', coils: { inner: { mode: 'bogus', speed: 9, direction: 'reverse' }, outer: null } });
  assert.equal(c.levels.overhead, 0); assert.equal(c.levels.roof, 1.5); assert.equal(c.levels.coil, 1);
  assert.equal(c.beamWidth, 1); assert.equal(c.cameraSpeed, 0.15); assert.equal(c.palette, 'auto');
  assert.deepEqual(c.coils.inner, { mode: 'auto', speed: 3, direction: 'reverse' });
  assert.equal(c.coils.outer.speed, 1);
});

test('manual ring arrangements hold their targets through breaks and drops', () => {
  for (const [name, targets] of [['Crown', [0.25, 1.3]], ['Tunnel', [2.8, 0.3]], ['Arena', [0.4, 2.3]], ['Layers', [1.8, 1.1]]]) {
    const r = rig(normalizeControls({ ringLook: name }));
    for (let t = 1 / 60; t < 65; t += 1 / 60) {
      r.tick(t); assert.deepEqual(r.director.ringTargets, targets);
      for (const f of r.groups.truss) assert.equal(f.ch.drop, targets[f.props.bank === 'inner' ? 0 : 1]);
    }
    r.look.controls.ringLook = 'auto';
    let changed = false;
    for (let t = 65; t < 180; t += 1 / 60) { r.tick(t); changed ||= JSON.stringify(r.director.ringTargets) !== JSON.stringify(targets); }
    assert.ok(changed, 'automatic ring cues resume');
  }
});

test('balanced reset restores Crown without immediately advancing to the next variant', () => {
  const r = rig(normalizeControls({ ringLook: 'Layers' }));
  for (let t = 1 / 60; t < 15; t += 1 / 60) r.tick(t);
  r.look.controls = normalizeControls({}); r.director.resetRingLook(15); r.tick(15);
  assert.equal(r.director.ringLook, 'Crown'); assert.deepEqual(r.director.ringTargets, [0.25, 1.3]);
});

test('a zero light-group fader suppresses its main and secondary light channels', () => {
  const controls = normalizeControls({ levels: Object.fromEntries(LIGHT_ROLES.map(role => [role, 0])) });
  const r = rig(controls);
  for (let t = 1 / 60; t < 55; t += 1 / 60) {
    r.tick(t);
    for (const role of LIGHT_ROLES) for (const f of r.groups[role] || []) {
      assert.equal(f.ch.dim, 0, role);
      if (f.ch.flash !== undefined) assert.equal(f.ch.flash, 0, role + ' flash');
      if (role === 'roof') for (const channel of ['glitter', 'white', 'hub', 'house']) assert.equal(f.ch[channel], 0, channel);
    }
    assert.equal(r.director.beamPeak, 0); assert.equal(r.director.room.level, 0);
  }
});

test('ring pattern, speed and direction remain independent and phase stays continuous', () => {
  const r = rig(normalizeControls({ coils: { inner: { mode: '4', speed: 0 }, outer: { mode: '2', speed: 3, direction: 'reverse' } } }));
  const [inner, outer] = ['inner', 'outer'].map(bank => r.groups.coil.find(f => f.props.bank === bank));
  for (let t = 1 / 60; t < 10; t += 1 / 60) r.tick(t);
  assert.equal(inner.ch.run, 0); assert.equal(inner.ch.mode, 4); assert.equal(outer.ch.mode, 2); assert.ok(outer.ch.run < 0.5);
  const at = outer.ch.run;
  r.look.controls.coils.outer.direction = 'forward'; r.tick(10);
  assert.ok(outer.ch.run > at && outer.ch.run - at < 0.01);
  assert.equal(outer.ch.dropStrength, 0); assert.equal(outer.ch.build, 0);
});

test('white palette overrides genre tints and beam width reaches both head groups', () => {
  const r = rig(normalizeControls({ palette: 'white', beamWidth: 0.5 }));
  r.director.setMood('classical');
  for (let t = 1 / 60; t < 10; t += 1 / 60) r.tick(t);
  for (const role of ['overhead', 'stage']) for (const f of r.groups[role] || []) assert.ok(f.ch.zoom <= 0.5 && f.ch.zoom >= 0.3);
  for (const role of ['overhead', 'stage', 'wash', 'glow']) for (const f of r.groups[role] || []) assert.deepEqual(f.ch.color, [1, 1, 1]);
});

test('presets round-trip independently, reject invalid records and sanitize frozen views', () => {
  const input = { id: 'one', name: '  Favourite  ', venue: 'round', mood: 'techno', controls: normalizeControls({ ringLook: 'Arena' }), look: { light: 0.8, off: { coil: true } }, pose: { position: [1, 2, 3], quaternion: [0, 0, 0, 1], fov: 62 } };
  const p = normalizePresets(JSON.parse(JSON.stringify([null, input, input])));
  assert.equal(p.length, 1); assert.equal(p[0].name, 'Favourite'); assert.deepEqual(p[0].pose, input.pose);
  input.controls.levels.coil = 0;
  assert.equal(p[0].controls.levels.coil, 1); assert.equal(p[0].look.off.coil, true);
  assert.equal(normalizePresets([{ ...input, pose: { ...input.pose, quaternion: [0, 0, 0, 0] } }])[0].pose, null);
});
