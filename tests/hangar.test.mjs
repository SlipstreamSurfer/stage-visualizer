import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { shots, CameraDirector } from '../src/cameras.js';
import { Signals, demo } from '../src/signals.js';
import { Director } from '../src/director.js';

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
