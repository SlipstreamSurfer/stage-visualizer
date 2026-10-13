// The show without a picture: every venue lays out, the director answers the music in every one of them, and
// there is a mood for every genre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES } from '../src/venues/index.js';
import { layout, byRole } from '../src/layout.js';
import { Signals, demo } from '../src/signals.js';
import { Director, MOODS, FAMILIES } from '../src/director.js';

const EXIT_WIDTH = 2.4, PEOPLE_PER_METRE = 135;   // a double emergency door; a rule of thumb for how many can leave by a metre of door

// plays the demo track for a while and reports what the rig did at every frame
function play(venueKey, moodKey, seconds, each) {
  const world = layout(VENUES[venueKey]);
  for (const th of world.things) th.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(world.things), signals = new Signals(), director = new Director(groups, moodKey), read = demo(signals, MOODS[moodKey].demoBpm, MOODS[moodKey].flow);
  signals.decay = MOODS[moodKey].decay;
  const dt = 1 / 60;
  for (let t = dt; t < seconds; t += dt) {
    signals.update(read(t), t, dt, { live: false });
    director.update(signals, t, dt);
    each?.({ t, signals, director, groups, world });
  }
  return { world, groups, director };
}

const ownMood = key => layout(VENUES[key]).mood;

for (const key of Object.keys(VENUES)) {
  test(`${key}: everything hangs inside the place, there is light to play with and room for a crowd`, () => {
    const world = layout(VENUES[key]), { W, D, H, rise } = world.plan, groups = byRole(world.things);
    for (const th of world.things) {
      const [x, y, z] = th.pos;
      const room = world.shell.open ? y >= 0 : world.inside(x, z, -0.01) && y >= 0 && y <= H + rise;   // in the open air there is no room to be outside of
      assert.ok(room, `${th.type} at ${th.pos} is outside the room`);
      if (!world.shell.open && rise) assert.ok(y <= world.ceil(x, z) + 0.3, `${th.type} at ${th.pos} is above the roof, which is ${world.ceil(x, z).toFixed(1)} m up there`);
    }
    assert.ok((groups.overhead?.length || 0) + (groups.stage?.length || 0) + (groups.wash?.length || 0) >= 4, 'at least four lamps that light the place');
    assert.ok(world.floor.z1 - world.floor.z0 > 5, 'room for a crowd');
    assert.ok(world.genres.length && world.genres.every(g => g in MOODS), `its genres are moods the director has: ${world.genres}`);
    assert.ok(['Clubs', 'Halls', 'Open air', 'Concert'].includes(world.kind), `it is listed under a kind there is: ${world.kind}`);
  });

  if (VENUES[key].facilities?.some(f => f.type === 'exit')) test(`${key}: there are enough exits for the people it holds, and none of them is blocked`, () => {
    const venue = VENUES[key], doors = venue.facilities.filter(f => f.type === 'exit' || f.type === 'entrance');
    const width = doors.reduce((w, f) => w + (f.width || EXIT_WIDTH), 0);
    assert.ok(venue.capacity > 0, 'the venue says how many people it is for');
    assert.ok(width >= venue.capacity / PEOPLE_PER_METRE, `${width.toFixed(1)} m of door for ${venue.capacity} people; ${(venue.capacity / PEOPLE_PER_METRE).toFixed(1)} m is needed`);
    assert.ok(new Set(doors.map(f => f.wall)).size >= 2, 'exits on at least two walls');
    // nothing else may stand in front of a door
    const span = f => f.type === 'exit' || f.type === 'entrance' ? [f.at - (f.width || EXIT_WIDTH) / 2 - 0.5, f.at + (f.width || EXIT_WIDTH) / 2 + 0.5] : f.from !== undefined ? [f.from, f.to] : f.at !== undefined && f.wall ? [f.at - 1.8, f.at + 1.8] : null;
    const onWall = venue.facilities.filter(f => typeof f.wall === 'string' && span(f) && !(f.bottom >= 3));   // what hangs above head height is not in the way
    for (const a of doors) for (const b of onWall) if (a !== b && a.wall === b.wall) {
      const [a0, a1] = span(a), [b0, b1] = span(b);
      assert.ok(a1 <= b0 || b1 <= a0, `the ${b.type} on the ${b.wall} wall stands in front of a door at ${a.at}`);
    }
  });

  test(`${key}: the show runs through the demo track in the venue's own mood without a wrong number`, () => {
    const mood = ownMood(key);
    let lit = 0;
    play(key, mood, 70, ({ t, groups }) => {
      for (const list of Object.values(groups)) for (const f of list) {
        const numbers = [f.ch.dim, f.ch.pan, f.ch.tilt, f.ch.zoom, ...f.ch.color];
        assert.ok(numbers.every(Number.isFinite) && f.ch.dim >= 0, `${mood} at ${t.toFixed(2)} s: ${f.type} has ${JSON.stringify(f.ch)}`);
        lit = Math.max(lit, f.ch.dim);
      }
    });
    assert.ok(lit > 0.2, `something lights up: the brightest fixture reached ${lit.toFixed(2)}`);
  });
}

test('every mood runs through its demo track without a wrong number, in a hall and in a concert hall', () => {
  for (const key of ['hangar', 'concerthall']) for (const mood of Object.keys(MOODS)) {
    play(key, mood, 45, ({ t, groups }) => {
      for (const list of Object.values(groups)) for (const f of list) {
        const numbers = [f.ch.dim, f.ch.pan, f.ch.tilt, f.ch.zoom, ...f.ch.color];
        assert.ok(numbers.every(Number.isFinite) && f.ch.dim >= 0, `${mood} in ${key} at ${t.toFixed(2)} s: ${f.type} has ${JSON.stringify(f.ch)}`);
      }
    });
  }
});

test('every genre has a venue made for it, and every family of genres is listed', () => {
  const made = new Set(Object.keys(VENUES).flatMap(key => layout(VENUES[key]).genres));
  for (const mood of Object.keys(MOODS)) assert.ok(made.has(mood), `no venue lists ${MOODS[mood].name} among its genres`);
  for (const mood of Object.values(MOODS)) assert.ok(FAMILIES.includes(mood.family), `${mood.name} is in a family that is not listed: ${mood.family}`);
});

test('a drop is answered with strobes, blinders and CO2, and a break is darker than the peak', () => {
  for (const key of ['hangar', 'club', 'field', 'arena']) {
    let strobe = 0, blinder = 0, dropAt = 0, breakLight = [], peakLight = [];
    const { groups } = play(key, 'techno', 60, ({ t, signals, groups }) => {
      if (signals.ev.drop) dropAt = t;
      if (dropAt && t - dropAt < 1) { strobe = Math.max(strobe, ...groups.strobe.map(f => f.ch.dim)); blinder = Math.max(blinder, ...(groups.blinder || []).map(f => f.ch.dim)); }
      const light = groups.overhead.reduce((n, f) => n + f.ch.dim, 0) / groups.overhead.length;
      if (signals.m.phase === 'break' && signals.m.build < 0.2 && t > 10) breakLight.push(light);
      if (dropAt && t - dropAt > 2 && t - dropAt < 10) peakLight.push(light);
    });
    assert.ok(dropAt > 0, 'the demo has a drop');
    assert.ok(strobe > 0.5, `${key}: strobes at the drop: ${strobe}`);
    if (groups.blinder) assert.ok(blinder > 0.3, `${key}: blinders at the drop: ${blinder}`);
    if (groups.co2) assert.ok(groups.co2.every(f => Math.abs(f.ch.fire - dropAt) < 0.1), `${key}: CO2 fires on the drop`);
    const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
    assert.ok(mean(breakLight) < mean(peakLight), `${key}: overhead light in the break ${mean(breakLight).toFixed(2)}, at the peak ${mean(peakLight).toFixed(2)}`);
  }
});

test('music with no beat is followed by how loud it is: no strobes, the stage always lit, more light when it swells', () => {
  let strobe = 0, quiet = [], loud = [], washMin = Infinity;
  play('concerthall', 'classical', 90, ({ t, signals, groups, director }) => {
    strobe = Math.max(strobe, ...(groups.strobe || []).map(f => f.ch.dim), 0);
    if (t < 6) return;
    washMin = Math.min(washMin, ...groups.wash.map(f => f.ch.dim));
    const light = ['overhead', 'stage', 'wash', 'bars', 'glow'].reduce((n, role) => n + (groups[role] || []).reduce((k, f) => k + f.ch.dim, 0), 0);   // all the light there is
    (director.f.tier === 'low' ? quiet : director.f.tier === 'peak' ? loud : []).push(light);
  });
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  assert.equal(strobe, 0, 'no strobes in a concert');
  assert.ok(washMin > 0.3, `the stage stays lit: its washes never went below ${washMin.toFixed(2)}`);
  assert.ok(quiet.length && loud.length, 'the demo has quiet and loud passages');
  assert.ok(mean(loud) > mean(quiet), `more light when the music is loud (${mean(loud).toFixed(2)}) than when it is quiet (${mean(quiet).toFixed(2)})`);
});

test('one show, any rig: the director never asks for a role a venue must have', () => {
  const bare = { name: 'Bare', plan: { width: 10, depth: 12, height: 4 }, stage: { width: 4, depth: 2, height: 0.4 }, crowd: { count: 10 },
    rig: [{ at: [0, 3.5, 0], type: 'movingHead', role: 'overhead' }] };
  const world = layout(bare);
  for (const th of world.things) th.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const signals = new Signals(), director = new Director(byRole(world.things)), read = demo(signals);
  for (let t = 1 / 60; t < 40; t += 1 / 60) { signals.update(read(t), t, 1 / 60, { live: false }); director.update(signals, t, 1 / 60); }
  assert.ok(Number.isFinite(world.things[0].ch.dim));
});
