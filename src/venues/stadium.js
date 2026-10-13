// The Stadium: a pitch 76 by 116 metres with stands rising on three sides under their roofs, floodlight masts at the
// corners, and a stage 44 metres wide across one end. Everything a show of that size has, and fireworks from the
// roof of the stands as well. An invented venue.
import { across, along, heads, washes, strobes, bars, blinders, floorHeads, one } from './kit.js';

const W = 76, D = 116, ROOF = 20, STAGE = { width: 44, depth: 15, height: 3 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (const s of [-1, 1]) for (const z of [front - 0.8, -D / 2 + 0.9]) rig.push({ line: [[s * 21.5, deck, z], [s * 21.5, ROOF, z]], truss: true, hang: [] });
for (const y of [7.5, 11.5, 15.5]) rig.push({ line: across(-D / 2 + 1.4, y, 20), truss: true, hang: [heads(14, 'stage'), strobes(6, 0.15)] });
rig.push({ line: across(-D / 2 + 1.1, deck + 6.5, 19), hang: [{ type: 'ledBar', count: 19, role: 'bars', props: { length: 8, upright: true } }] });
rig.push(one('ledWall', 'wall', [0, deck + 1 + 6.5, -D / 2 + 0.6], { width: 34, height: 13 }));
for (const s of [-1, 1]) rig.push(one('ledWall', 'wall', [s * 31, 11, front - 1], { width: 12, height: 8, rotY: -s * 0.25 }));
rig.push({ line: across(front - 1, ROOF - 0.6, 21), truss: true, hang: [blinders(12), washes(8, 0.12), strobes(8, 0.2), bars(12, 2.4, 0.06), { type: 'confetti', count: 6, role: 'confetti', dy: -0.5, inset: 0.16 }] });
rig.push({ line: across(front - 7, ROOF - 0.6, 21), truss: true, hang: [heads(14, 'stage'), { type: 'laser', count: 8, role: 'laser', dy: -0.4, inset: 0.12 }] });
rig.push(floorHeads(front - 10, deck, 19, 12), floorHeads(front - 2, ROOF + 0.9, 20, 10, 'stage', { reach: 130 }));
rig.push({ line: across(front - 0.6, deck, 20), hang: [{ type: 'co2', count: 10, role: 'co2' }, { type: 'spark', count: 9, role: 'spark', inset: 0.1 }, { type: 'flame', count: 8, role: 'flame', inset: 0.14 }] });
rig.push({ line: across(-D / 2 - 8, 1, 30), hang: [{ type: 'firework', count: 9, role: 'firework', props: { rise: 52, reach: 22 } }] });
for (const s of [-1, 1]) {
  rig.push({ line: along(s * (W / 2 + 24), 24, front + 20, D / 2 - 6), hang: [{ type: 'firework', count: 4, role: 'firework', props: { rise: 26, reach: 15 } }] });   // off the roofs of the stands
  rig.push({ line: [[s * 26, ROOF - 2, front + 0.5], [s * 33, ROOF - 2, front + 0.5]], truss: true, hang: [heads(6)] });
  rig.push({ line: [[s * 20 - 1.6, 14.6, front + 52], [s * 20 + 1.6, 14.6, front + 52]], truss: true, hang: [heads(4), { type: 'strobe', count: 2, role: 'strobe', dy: 0.25, inset: 0.3 }] });
  rig.push(one('hazer', 'hazer', [s * 34, 0.3, front - 2]));
}

export default {
  name: 'Stadium', kind: 'Open air', genres: ['dancepop', 'mainstage', 'pop', 'trance', 'latin', 'harddance', 'hiphop'], capacity: 55000,
  facilities: [{ type: 'stageRoof', height: ROOF }, { type: 'tower', x: -20, z: front + 52, height: 14 }, { type: 'tower', x: 20, z: front + 52, height: 14 }],
  plan: { width: W, depth: D, height: ROOF + 1 },
  shell: { open: true, floor: 'dark', sky: 'night', wind: [0.6, 0.3], around: [{ type: 'masts', out: 34 }], parts: [
    { type: 'tiers', sides: ['left', 'right', 'back'], rows: 30, rise: 0.52, run: 0.85, base: 2.5, z0: front + 8, z1: D / 2, kind: 'stands', roof: true, outside: true, standing: true, seat: 0.66 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 3200, seats: 2600 },
};
