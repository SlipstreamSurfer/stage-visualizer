import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { Director } from '../src/director.js';
import { Signals, demo } from '../src/signals.js';
import { parkRig } from '../src/venue-mode.js';

test('maintenance parks an active Hangar rig and returning to a gig restores its output', () => {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const signals = new Signals(), director = new Director(byRole(L.things), 'techno', { venue: 'hangar' }), read = demo(signals);
  const look = { light: 1, haze: 1, hall: 1, off: { laser: true } };
  const before = structuredClone(look);
  for (let t = 1 / 30; t < 40; t += 1 / 30) { signals.update(read(t), t, 1 / 30, { live: false }); director.update(signals, t, 1 / 30, look); }
  assert.ok(L.things.some(f => f.ch.dim > 0.1));
  for (const f of L.things.filter(f => ['co2', 'flame', 'spark'].includes(f.role))) f.ch.fire = 39.9;
  const clock = signals.now, scene = director.scene;
  parkRig(L.things);
  for (const f of L.things) {
    assert.equal(f.ch.dim, 0); assert.equal(f.ch.flash, 0); assert.equal(f.ch.fire, -100);
    assert.equal(f.ch.pan, 0); assert.equal(f.ch.tilt, 0);
    if (f.role === 'truss') { assert.equal(f.ch.drop, 0); assert.equal(f.ch.roll, 0); }
  }
  assert.equal(signals.now, clock); assert.equal(director.scene, scene); assert.deepEqual(look, before);
  director.update(signals, 40, 1 / 30, look);
  assert.ok(L.things.some(f => f.ch.dim > 0.1), 'Gig channels resume from the existing director');
  assert.deepEqual(look, before);
});
