import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { Director } from '../src/director.js';
import { Signals } from '../src/signals.js';
import { LightChoreography } from '../src/light-choreography.js';
import { normalizeControls, normalizePresets } from '../src/show-controls.js';

function rig(mode, controls = {}) {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1,1,1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(L.things), director = new Director(groups, 'techno', { venue: 'hangar' });
  return { groups, director, look: { light: 1, haze: 1, off: {}, controls: normalizeControls({ lightChoreography: mode, ...controls }) } };
}
function signals(phase) {
  const s = new Signals();
  Object.assign(s.m, { phase: 'groove', section: 'peak', bpm: 120, activity: 1 });
  Object.assign(s, { phase, beats: Math.floor(phase), energy: 0.7, bass: 0.4, mid: 0.3, kick: 0.1, drop: 0, accent: 0 });
  s.ev = {}; return s;
}

test('choreography settings survive presets; old and invalid presets keep the original show', () => {
  for (const value of [undefined, '__proto__', 'unknown', null, 2]) assert.equal(normalizeControls({ lightChoreography: value }).lightChoreography, 'original');
  for (const mode of ['original','composed','stage','wave','hold']) {
    const p = normalizePresets([{ id: mode, name: mode, venue: 'hangar', mood: 'techno', controls: { lightChoreography: mode } }]);
    assert.equal(p[0].controls.lightChoreography, mode);
  }
});

test('automatic composition choice changes only on scene cues and avoids repeated choices', () => {
  const c = new LightChoreography(rig().groups), choices = [];
  for (let scene = 0; scene < 30; scene++) {
    c.update('composed', scene, scene * 16, 'peak'); choices.push(c.key);
    for (let beat = 0; beat < 16; beat++) { c.update('composed', scene, scene * 16 + beat, 'peak'); assert.equal(c.key, choices.at(-1)); }
  }
  assert.ok(choices.every((key, i) => !i || key !== choices[i - 1]));
  assert.equal(new Set(choices).size, 3);
  const counts = Object.values(c.counts); assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('the hall wave moves from front to rear and arches follow the same music clock', () => {
  const r = rig('wave'), c = r.director.choreography;
  c.update('wave', 0, 0, 'peak');
  const heads = r.groups.overhead, front = heads.reduce((a,b) => a.pos[2] < b.pos[2] ? a : b), rear = heads.reduce((a,b) => a.pos[2] > b.pos[2] ? a : b);
  for (let i = 0; i < 180; i++) { c.gain(front,'overhead',1/60); c.gain(rear,'overhead',1/60); }
  assert.ok(c.gain(front,'overhead',0) > c.gain(rear,'overhead',0) * 2);
  c.update('wave', 0, 28, 'peak');
  for (let i = 0; i < 180; i++) { c.gain(front,'overhead',1/60); c.gain(rear,'overhead',1/60); }
  assert.ok(c.gain(rear,'overhead',0) > c.gain(front,'overhead',0) * 2);
  const arch = { phase: 28, flash: 1 }; c.arch(arch);
  assert.equal(arch.archCentre, 28/32); assert.equal(arch.pattern, 3);
});

test('held picture fixes requested head directions for four beats and clears on reset or seek', () => {
  const r = rig('hold'), update = phase => r.director.update(signals(phase),phase/2,1/60,r.look);
  update(12); const heads = [...r.groups.overhead, ...r.groups.stage], poses = heads.map(f => [f.ch.pan,f.ch.tilt]);
  for (const phase of [12.5,13,14,15.999]) { update(phase); assert.deepEqual(heads.map(f => [f.ch.pan,f.ch.tilt]),poses); }
  update(16.01); assert.ok(heads.some((f,i) => f.ch.pan !== poses[i][0] || f.ch.tilt !== poses[i][1]));
  r.director.reset(9); assert.equal(r.director.choreography.poses.has(heads[0]),false);
  update(30); update(2); assert.equal(r.director.choreography.age,0);
  r.look.controls.lightChoreography = 'original'; update(3); assert.equal(r.director.choreography.active,false);
  assert.equal(r.groups.arch[0].ch.archCentre,undefined);
});

test('composition changes preserve scene clocks, truss targets, theme colours and manual darkness', () => {
  for (const mode of ['stage','wave','hold','composed']) {
    const baseline = rig('original', { showTheme:'melodic' }), r = rig(mode, { showTheme:'melodic', levels:{ stage:0 } });
    r.look.off.arch = true;
    for (let frame = 0; frame < 600; frame++) {
      const s = signals(frame/30);
      for (const item of [baseline,r]) item.director.update(s,frame/60,1/60,item.look);
      assert.equal(r.director.scene,baseline.director.scene); assert.equal(r.director.program,baseline.director.program);
      assert.deepEqual(r.groups.truss.map(f=>[f.ch.drop,f.ch.roll]),baseline.groups.truss.map(f=>[f.ch.drop,f.ch.roll]));
      assert.deepEqual(r.director.col,baseline.director.col);
      assert.ok(r.groups.stage.every(f=>f.ch.dim===0)); assert.ok(r.groups.arch.every(f=>f.ch.dim===0 && f.ch.flash===0));
      assert.ok(r.groups.overhead.every(f=>[f.ch.dim,f.ch.pan,f.ch.tilt].every(Number.isFinite)));
    }
    r.director.manual.blackout=true; r.director.update(signals(21),10.5,1/60,r.look);
    assert.ok([...r.groups.overhead,...r.groups.stage].every(f=>f.ch.dim===0));
  }
});
