import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { shots, CameraDirector } from '../src/cameras.js';
import { Signals, demo } from '../src/signals.js';
import { Director, MOODS } from '../src/director.js';
import { HEAD_LOOKS, TRUSS_LOOKS, DEEPEST, GATES, GATE_GAIN } from '../src/hangar-looks.js';
import { normalizeControls, normalizePresets } from '../src/show-controls.js';

test('Hangar has a complete rig inside its hall, a stage and crowd space', () => {
  const L = layout(hangar), groups = byRole(L.things);
  assert.equal(L.name, 'Hangar');
  assert.ok(L.floor.z1 - L.floor.z0 > 5);
  for (const role of ['overhead', 'stage', 'wash', 'strobe', 'blinder', 'co2']) assert.ok(groups[role]?.length, role);
  for (const f of L.things) {
    const [x,y,z] = f.pos;
    assert.ok(f.pos.every(Number.isFinite) && L.inside(x,z,-0.01) && y >= 0 && y <= L.ceil(x,z) + 0.3, `${f.type}: within the hall`);
  }
});

test('Hangar camera positions and targets remain inside the hall and above the stage', () => {
  const L = layout(hangar), list = shots(L);
  assert.equal(list.length, 9);
  const check = p => {
    assert.ok(p.every(Number.isFinite) && L.inside(p[0],p[2],0.1));
    assert.ok(p[1] >= (L.onStage(p[0],p[2]) ? L.stage.height : 0) + 0.4);
    assert.ok(p[1] < L.ceil(p[0],p[2]));
  };
  for (const shot of list) {
    check(shot.look);
    for (let t=0;t<=3600;t+=79) for (const age of [0,12,40]) check(shot.pos(t,age));
  }
  const camera = new CameraDirector(list,1200), signals = {m:{section:'groove',phase:'groove'},ev:{},beats:1};
  camera.update(signals,1229); assert.equal(camera.pending,null);
  signals.ev.kick=true; signals.beats=16; camera.update(signals,1231); assert.notEqual(camera.pending,null);
});

test('Hangar answers a build, drop and break with finite light channels and a stronger peak', () => {
  const L = layout(hangar);
  for (const f of L.things) f.ch={dim:0,color:[1,1,1],pan:0,tilt:0,zoom:1};
  const groups=byRole(L.things), signals=new Signals(), director=new Director(groups,'techno'), read=demo(signals);
  let dropAt=0, strobe=0; const low=[], peak=[];
  for (let t=1/60;t<65;t+=1/60) {
    signals.update(read(t),t,1/60,{live:false});director.update(signals,t,1/60);
    if(signals.ev.drop) dropAt=t;
    for(const f of L.things) assert.ok([f.ch.dim,f.ch.pan,f.ch.tilt,f.ch.zoom,...f.ch.color].every(Number.isFinite));
    const brightness=groups.overhead.reduce((n,f)=>n+f.ch.dim,0)/groups.overhead.length;
    if(signals.m.phase==='break' && signals.m.build<0.2 && t>10) low.push(brightness);
    if(dropAt && t-dropAt<1) strobe=Math.max(strobe,...groups.strobe.map(f=>f.ch.dim));
    if(dropAt && t-dropAt>2 && t-dropAt<10) peak.push(brightness);
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  assert.ok(dropAt>0 && strobe>0.5 && low.length && peak.length);
  assert.ok(mean(peak)>mean(low));
});

// A short set: tracks of five minutes with an intro, a groove, a break with its build, a peak and an outro, and a
// moment of silence between them, as the listener reports it.
const played = new Map();   // the same set, played once for the tests that read it
function playSet(...args) { const key = JSON.stringify(args); if (!played.has(key)) played.set(key, playSetOnce(...args)); return played.get(key); }
function playSetOnce(moodKey, tracks, dt = 0.1, controls = {}) {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(L.things), d = new Director(groups, moodKey, { venue: 'hangar' }), look = { light: 1, haze: 1, off: {}, controls: normalizeControls(controls) };
  const frames = [], length = 300, flow = d.mood.flow;
  let beats = 0, phase = 0, t = 0;
  for (let track = 0; track < tracks; track++) {
    for (let at = 0; at < length; at += dt, t += dt) {
      const section = at < 30 ? 'intro' : at < 120 ? 'groove' : at < 150 ? 'break' : at < 270 ? 'peak' : 'low', brk = section === 'break';
      const s = new Signals(), before = Math.floor(phase);
      phase += dt * 128 / 60; const kick = !flow && !brk && Math.floor(phase) > before;
      if (kick) beats++;
      Object.assign(s.m, { section, phase: brk ? 'break' : 'groove', activity: 1, hasGrooved: true, build: brk ? (at - 120) / 30 : 0, riser: 0, bpm: 128 });
      const energy = flow ? 0.3 + 0.25 * Math.sin(at / 40) + (section === 'peak' ? 0.3 : 0) : section === 'peak' ? 0.8 : brk ? 0.3 : 0.55;
      Object.assign(s, { phase, beats, energy, bass: energy * 0.7, mid: 0.3, treble: 0.2, kick: kick ? 0.8 : 0, accent: 0, drop: 0, lift: 0, hype: section === 'peak' ? 0.5 : 0 });
      const drop = !flow && Math.abs(at - 150) < dt / 2;
      s.ev = { kick: kick || drop ? 1 : 0, drop, breakLength: drop ? 64 : 0, from: null, silent: at + dt >= length, trackEnded: at + dt >= length };
      if (drop) s.drop = 1;
      d.update(s, t, dt, look);
      const truss = groups.truss.filter(f => f.props?.hangar);
      frames.push({ track, t, brk, head: d.headLook, truss: d.trussName, drops: truss.map(f => f.ch.drop), rolls: truss.map(f => f.ch.roll),
        aim: groups.overhead.filter(f => f.props?.hangar).map(f => [f.ch.pan, f.ch.tilt]) });
    }
  }
  return frames;
}

test('Hangar heads change their look within a track and take other looks for a new track', () => {
  const frames = playSet('techno', 3), perTrack = [0, 1, 2].map(i => frames.filter(f => f.track === i && !f.brk));
  const looks = perTrack.map(list => [...new Set(list.map(f => f.head))]);
  for (const [i, list] of looks.entries()) assert.ok(list.length >= 2, `track ${i + 1} shows more than one look: ${list}`);
  for (let i = 1; i < 3; i++) assert.notDeepEqual(looks[i], looks[i - 1], 'a new track brings other looks');
  assert.ok(new Set(looks.flat()).size >= 5, `three tracks together use most looks: ${looks.flat()}`);
  // the looks point the beams differently, not just in other colours
  const signature = head => { const aims = frames.filter(f => f.head === head && !f.brk).at(-1).aim; return [aims.reduce((a, [, tilt]) => a + tilt, 0) / aims.length, aims.reduce((a, [pan]) => a + Math.abs(pan), 0) / aims.length].map(n => n.toFixed(1)).join(); };
  const shapes = new Set(looks.flat().map(signature));
  assert.ok(shapes.size >= 4, `the looks aim the heads differently: ${[...shapes]}`);
  for (const f of frames) assert.ok(f.aim.flat().every(Number.isFinite));
});

test('Hangar trusses hold a formation for minutes and reach a new one for a new track', () => {
  const frames = playSet('techno', 3), changes = [];
  for (const [i, f] of frames.entries()) if (!i || f.truss !== frames[i - 1].truss) changes.push(f);
  assert.ok(new Set(changes.map(f => f.truss)).size >= 3, `several formations over three tracks: ${changes.map(f => f.truss)}`);
  for (let i = 1; i < changes.length; i++) assert.ok(changes[i].t - changes[i - 1].t >= 30 - 1e-9, `a formation holds at least half a minute (${changes[i - 1].truss})`);
  for (const f of frames) assert.ok(f.drops.every(d => d >= 0 && d <= DEEPEST) && f.rolls.every(r => Math.abs(r) <= 0.07));
  // outside a break the formation stands still: the same heights from one moment to the next
  const steady = frames.filter((f, i) => i && !f.brk && !frames[i - 1].brk && f.truss === frames[i - 1].truss);
  assert.ok(steady.every((f, i) => f.drops.join() === frames[frames.indexOf(f) - 1].drops.join()), 'a held formation does not drift');
  assert.ok(new Set(frames.filter(f => !f.brk).map(f => f.drops.map(d => d.toFixed(1)).join())).size >= 3, 'formations differ in height, not only in name');
});

test('every music family gets varied heads and truss formations', () => {
  const families = new Map();
  for (const [key, mood] of Object.entries(MOODS)) if (!families.has(mood.family)) families.set(mood.family, key);
  for (const key of families.values()) {
    const frames = playSet(key, 2, 0.3).filter(f => !f.brk);
    assert.ok(new Set(frames.map(f => f.head)).size >= 3, `${key}: the heads change look`);
    assert.ok(new Set(frames.map(f => f.truss)).size >= 2, `${key}: the trusses change formation`);
  }
});

test('every head look points the beams its own way, inside the hall and lit by a sensible share of heads', () => {
  const L = layout(hangar), heads = byRole(L.things).overhead.filter(f => f.props?.hangar), pictures = new Set();
  heads.forEach((f, i) => { f.hangarSlot = i; f.rp = Math.sin(i * 7.3); f.rt = 0.5 + 0.5 * Math.sin(i * 3.1); });
  for (const [key, look] of Object.entries(HEAD_LOOKS)) {
    const L2 = layout(hangar), groups = byRole(L2.things);
    for (const f of L2.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
    const d = new Director(groups, 'techno', { venue: 'hangar' }), controls = normalizeControls({ headLook: key }), s = new Signals();
    Object.assign(s.m, { section: 'peak', phase: 'groove', activity: 1, hasGrooved: true, build: 0, bpm: 128 });
    for (let i = 0; i < 200; i++) { Object.assign(s, { phase: i / 15, beats: Math.floor(i / 15), energy: 0.8, kick: 0.5 }); s.ev = { kick: i % 15 === 0 ? 1 : 0 }; d.update(s, i / 30, 1 / 30, { light: 1, haze: 1, off: {}, controls }); }
    assert.equal(d.headLook, key, 'a pinned look stays');
    const aims = groups.overhead.filter(f => f.props?.hangar).map(f => [f.ch.pan, f.ch.tilt]);
    assert.ok(aims.flat().every(Number.isFinite), `${key}: finite aims`);
    pictures.add(aims.map(([p, t]) => `${Math.round(p * 2)}:${Math.round(t * 2)}`).join());
    let lit = 0, total = 0;
    for (let beat = 0; beat < 64; beat++) for (const f of heads) { total++; if (GATES[look.gate](f, beat, Math.floor(beat / 32) % 6)) lit++; }
    assert.ok(lit / total > 0.1 && lit / total <= 1, `${key}: ${Math.round(lit / total * 100)}% of the heads lit`);
    assert.ok(look.gate === 'patterns' || GATE_GAIN[look.gate] >= 1);
  }
  assert.ok(pictures.size >= Object.keys(HEAD_LOOKS).length - 2, `the looks make different pictures (${pictures.size} of ${Object.keys(HEAD_LOOKS).length})`);
});

test('the viewer can pin a look or a formation and set the pace, and presets keep it', () => {
  assert.deepEqual([normalizeControls({}).headLook, normalizeControls({}).trussLook, normalizeControls({}).lookPace], ['auto', 'auto', 'normal']);
  assert.equal(normalizeControls({ headLook: 'nonsense', trussLook: 3, lookPace: 'fast' }).headLook, 'auto');
  const saved = normalizePresets([{ id: 'a', name: 'a', venue: 'hangar', mood: 'techno', controls: { headLook: 'tunnel', trussLook: 'Canopy', lookPace: 'lively' } }])[0].controls;
  assert.deepEqual([saved.headLook, saved.trussLook, saved.lookPace], ['tunnel', 'Canopy', 'lively']);
  const pinned = playSet('techno', 1, 0.3, { headLook: 'sky', trussLook: 'Valley' }).filter(f => !f.brk);
  assert.ok(pinned.every(f => f.head === 'sky' && f.truss === 'Valley'));
  const changes = pace => { const frames = playSet('techno', 2, 0.3, { lookPace: pace }).filter(f => !f.brk); return frames.filter((f, i) => i && f.head !== frames[i - 1].head).length; };
  assert.ok(changes('lively') > changes('normal') && changes('normal') > changes('calm'), 'the pace sets how often the looks change');
});

test('truss formations suit the part of the track and stay within the hoists', () => {
  for (const formation of TRUSS_LOOKS) for (let row = 0; row < 5; row++) {
    assert.ok(formation.drop(row / 4, row) >= 0 && formation.drop(row / 4, row) <= DEEPEST, `${formation.name}: a reachable height`);
    assert.ok(Math.abs(formation.roll?.(row) ?? 0) <= 0.07, `${formation.name}: a tilt two hoists can make`);
  }
  assert.ok(TRUSS_LOOKS.length >= 15 && new Set(TRUSS_LOOKS.map(f => f.name)).size === TRUSS_LOOKS.length);
  // the hall trusses hang at 11.5 m and their hoists stop 5.5 m above the floor (world.js): the deepest drop fits, and
  // brings them a little more than half way down
  assert.ok(DEEPEST <= 11.5 - 5.5 && DEEPEST > 11.5 / 2, `deepest drop ${DEEPEST}`);
});

test('a scene changes on the first beat of a phrase, counted from the drop, also when a kick is missed or a layer comes in', () => {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const d = new Director(byRole(L.things), 'techno', { venue: 'hangar' }), look = { light: 1, haze: 1, off: {}, controls: normalizeControls({}) };
  const changes = [], next = d.next.bind(d);
  d.next = (t, section) => { changes.push(d.beat); return next(t, section); };
  const beat = 60 / 128, dt = 1 / 60;
  let t = 0, last = 0, n = 0;
  for (; t < 150; t += dt) {
    const now = Math.floor(t / beat), kick = now > n - 1 && now !== n - 1 && t >= n * beat;
    const missed = n === 100 || n === 101 || n === 170;   // a kick or two not heard
    const s = new Signals(), fire = kick && !missed, drop = kick && n === 0;
    Object.assign(s.m, { section: 'peak', phase: 'groove', activity: 1, hasGrooved: true, build: 0, riser: 0, bpm: 128 });
    Object.assign(s, { stableBpm: 128, energy: 0.8, kick: fire ? 0.8 : 0, drop: drop ? 1 : 0 });
    s.ev = { kick: fire ? 1 : 0, kickGap: fire ? t - last : 0, drop, breakLength: drop ? 64 : 0, from: null, lift: Math.abs(t - 92.3) < dt / 2 };
    if (kick) n++;
    if (fire) last = t;
    d.update(s, t, dt, look);
  }
  const after = changes.slice(1);   // the drop itself changes the scene before the count starts
  assert.ok(after.length >= 3, `scene changes: ${changes}`);
  for (const at of after) assert.equal((at - 1) % 8, 0, `a scene changed on beat ${at}, not on the first beat of a pair of bars (${changes})`);
  assert.ok(after.some(at => (at - 1) % 64 === 0 && at > 64), `no change on the first beat of a phrase: ${changes}`);
});
