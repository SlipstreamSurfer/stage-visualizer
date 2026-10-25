// The Hangar's light as a lighting designer runs it (0.38): the stage's heads in one long row along the front of the
// deck, played as one instrument; washes as a steady colour under the beams, not flashing with the kick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES } from '../src/venues/index.js';
import { layout, byRole } from '../src/layout.js';
import { Signals, demo } from '../src/signals.js';
import { Director, MOODS } from '../src/director.js';
import { ROW_LOOKS } from '../src/hangar-looks.js';

function play(seconds, each, options = {}, moodKey = 'techno') {
  const world = layout(VENUES.hangar, options);
  for (const th of world.things) th.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(world.things), signals = new Signals(), director = new Director(groups, moodKey, { venue: 'hangar' }), read = demo(signals, MOODS[moodKey].demoBpm);
  signals.decay = MOODS[moodKey].decay;
  for (let t = 1 / 60; t < seconds; t += 1 / 60) { signals.update(read(t), t, 1 / 60, { live: false }); director.update(signals, t, 1 / 60); each?.({ t, signals, director, groups }); }
  return { world, groups };
}

test('the stage heads stand in one row along the front of the deck, in front of the DJ; the old three rows are still a choice', () => {
  const stage = options => byRole(layout(VENUES.hangar, options).things).stage;
  const row = stage({}), booth = layout(VENUES.hangar).stage.front - 3;
  assert.equal(row.length, 24);
  assert.ok(row.every(f => f.pos[2] === row[0].pos[2] && f.pos[2] > booth && f.props.row), 'one straight row, in front of the booth');
  assert.ok(Math.max(...row.map(f => f.pos[0])) - Math.min(...row.map(f => f.pos[0])) > 20, 'across the stage');
  assert.equal(stage({ stageHeads: 'row36' }).length, 36);
  assert.equal(stage({ stageHeads: 'classic' }).length, 28);
  assert.equal(stage({ stageHeads: 'nonsense' }).length, 24, 'an unknown choice is the first');
});

test('the row plays its looks over a show, and never aims into the crowd\'s eyes', () => {
  const seen = new Set();
  let lowest = Infinity;
  play(120, ({ t, director, groups }) => {
    seen.add(director.rowLook);
    if (t > 5) for (const f of groups.stage) {   // from where they start (straight down) they swing up into their first look
      // where the beam is 20 m out from the stage, how high it is (tilt 0 is straight down, π straight up)
      const up = -Math.cos(f.ch.tilt), out = Math.sin(f.ch.tilt) * Math.cos(f.ch.pan);
      if (out > 0.05) lowest = Math.min(lowest, f.pos[1] + up / out * 20);
    }
  });
  assert.ok(seen.size >= 4, `the row took ${[...seen].join(', ')}`);
  assert.ok([...seen].every(k => k in ROW_LOOKS));
  assert.ok(lowest > 2.4, `20 m out a beam of the row is at least ${lowest.toFixed(1)} m up`);
});

test('washes are a steady colour under the beams: they rise and fall with the track, not with every kick', () => {
  let kicks = 0, jump = 0, last = null;
  play(60, ({ signals, groups }) => {
    const w = groups.wash[0].ch.dim;
    if (last !== null && signals.ev.kick && !signals.ev.drop) { kicks++; jump = Math.max(jump, Math.abs(w - last)); }   // a drop is the one kick they swell on
    last = w;
  });
  assert.ok(kicks > 50, `${kicks} kicks`);
  assert.ok(jump < 0.05, `on a kick a wash moves by at most ${jump.toFixed(3)}`);
});

test('every kind of music plays the row and the washes its own way', async () => {
  const { STYLES, ROW_LOOKS } = await import('../src/hangar-looks.js');
  for (const [key, style] of Object.entries(STYLES)) assert.ok(style.row?.length >= 2 && style.row.every(k => k in ROW_LOOKS), key);
  const looks = moodKey => { const seen = new Set(); play(150, ({ director }) => seen.add(director.rowLook), {}, moodKey); return seen; };
  const hypnotic = looks('hypnotic'), hard = looks('hard');
  assert.ok(!hypnotic.has('chase') && !hypnotic.has('crowd'), `hypnotic stays slow: ${[...hypnotic]}`);
  assert.ok(hard.has('crowd') || hard.has('sweep'), `hard techno sweeps the room: ${[...hard]}`);
  const wash = moodKey => { let sum = 0, n = 0; play(90, ({ t, groups }) => { if (t > 30) { sum += groups.wash[0].ch.dim; n++; } }, {}, moodKey); return sum / n; };
  assert.ok(wash('melodic') > wash('raw') * 1.8, 'melodic fills the room with colour, raw techno keeps it dark');
});
