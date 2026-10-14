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
  assert.equal(new Set(choices).size, Object.keys(c.counts).length, 'every composition takes its turn');
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
  for (const mode of ['stage','wave','hold','sweep','pingpong','solo','centre','pulse','answer','composed']) {
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

test('the automatic camera shows each light composition and lets it develop', async () => {
  const { CameraDirector, LIGHT_SHOTS } = await import('../src/cameras.js');
  const list = Array.from({ length: 9 }, (_, i) => ({ name: String(i) }));
  const run = (key, { from = 0, frames = 60 * 40, drop = -1, section = 'peak', phase = 'groove' } = {}) => {
    const cam = new CameraDirector(list), path = [];
    for (let f = 0; f < frames; f++) {
      const t = f / 60, beats = Math.floor(t * 2);   // 120 BPM
      const s = { m: { section, phase }, ev: { kick: f % 30 === 0, drop: f === drop }, beats, sinceBreak: 0 };
      const light = t >= from ? { key, started: from * 2, age: t * 2 - from * 2 } : null;
      cam.update(s, t, 1, light); path.push({ t, age: light?.age ?? -1, index: cam.index });
    }
    return path;
  };
  for (const key of Object.keys(LIGHT_SHOTS)) {
    const cue = LIGHT_SHOTS[key], path = run(key, { from: 10 });
    const start = path.find(p => p.age >= 0.8);
    assert.ok(cue.shots.includes(start.index), `${key}: the cut at the start shows the composition`);
    const developing = path.filter(p => p.age >= 0.8 && p.age < cue.develop);
    const indices = new Set(developing.map(p => p.index));
    assert.ok(indices.size <= (cue.reveal ? 2 : 1), `${key}: no extra cuts while the light develops`);
    if (cue.reveal) assert.ok(cue.reveal.includes(path.find(p => p.age >= cue.revealAt + 0.8).index), 'a stage opening reveals the hall in a wide shot');
    const later = path.filter(p => p.age >= cue.develop);
    assert.ok(later.every(p => [...cue.shots, ...cue.reveal || []].includes(p.index)), `${key}: later cuts stay on shots that show the composition`);
  }
  const dropped = run('wave', { from: 10, drop: 60 * 14 });
  assert.ok([0, 5].includes(dropped.find(p => p.t > 14.05).index), 'a drop still cuts to the whole room');
  const withLight = run('wave', { section: 'break', phase: 'break' }), without = run('wave', { from: Infinity, section: 'break', phase: 'break' });
  assert.deepEqual(withLight.map(p => p.index), without.map(p => p.index), 'a break keeps its own camera');
});

test('the camera setting is saved, defaults on and reaches the director only as a cue', () => {
  assert.equal(normalizeControls({}).cameraFollowsLight, true);
  assert.equal(normalizeControls({ cameraFollowsLight: false }).cameraFollowsLight, false);
  assert.equal(normalizePresets([{ id: 'a', name: 'a', venue: 'hangar', mood: 'techno', controls: { cameraFollowsLight: false } }])[0].controls.cameraFollowsLight, false);
  const r = rig('wave');
  r.director.update(signals(0), 0, 1 / 60, r.look); r.director.update(signals(3), 0.1, 1 / 60, r.look);
  assert.equal(r.director.lightCue.key, 'wave'); assert.ok(r.director.lightCue.age >= 0);
  const o = rig('original'); o.director.update(signals(0), 0, 1 / 60, o.look);
  assert.equal(o.director.lightCue, null, 'the original show gives the camera nothing to follow');
});

test('the newer compositions shape the rig in their own way and stay within range', () => {
  const r = rig('original'), c = r.director.choreography, heads = [...r.groups.overhead, ...r.groups.stage], pictures = new Set();
  for (const key of ['sweep', 'pingpong', 'solo', 'centre', 'pulse', 'answer']) {
    c.update(key, 1, 0, 'peak');
    for (const phase of [1, 3, 5, 9, 13, 21]) {
      c.update(key, 1, phase, 'peak');
      let gains; for (let i = 0; i < 120; i++) gains = heads.map(f => c.gain(f, f.role || (r.groups.stage.includes(f) ? 'stage' : 'overhead'), 1 / 60));
      assert.ok(gains.every(g => Number.isFinite(g) && g >= 0 && g <= 1.2), `${key}: gains stay between dark and a little over full`);
      pictures.add(gains.map(g => g.toFixed(1)).join());
      const arch = { phase, flash: 1 }; c.arch(arch);
      assert.ok([arch.archCentre, arch.archWidth, arch.archBase, arch.archStrength].every(Number.isFinite), `${key}: the arches get a shape`);
    }
  }
  assert.ok(pictures.size >= 20, 'the compositions make different pictures as they run');
});
