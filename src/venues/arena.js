// The Arena: an indoor arena for fourteen thousand, 64 by 96 metres under a roof 26 up. Stands on three sides, the
// floor in the middle, and a stage across the far end with everything on it: a wall of heads, the screens, pyro. An
// invented venue.
import { across, along, heads, washes, strobes, bars, blinders, floorHeads, one } from './kit.js';

const W = 64, D = 96, H = 26, STAGE = { width: 32, depth: 13, height: 2.2 }, ROWS = 16, RUN = 0.9, DEEP = ROWS * RUN;
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (let i = 0; i < 5; i++) rig.push({ line: across(front + 6 + i * 11, 19, 15), truss: true, moves: i % 2 === 1, hang: [heads(10), washes(4), bars(8), strobes(4)] });
for (const s of [-1, 1]) rig.push({ line: along(s * 16.6, 18, front + 2, front + 50), truss: true, hang: [heads(10)] });
for (const y of [7, 11, 15]) rig.push({ line: across(-D / 2 + 1.4, y, 14), truss: true, hang: [heads(12, 'stage'), strobes(4, 0.2)] });   // the back of the stage: a wall of heads
rig.push(one('ledWall', 'wall', [0, deck + 1 + 5.5, -D / 2 + 0.6], { width: 26, height: 11 }));
for (const s of [-1, 1]) rig.push(one('ledWall', 'wall', [s * 23, 12.5, -D / 2 + 3.5], { width: 9, height: 6, rotY: -s * 0.35 }));   // a screen either side, for the back rows
rig.push({ line: across(front - 1, 18, 15), truss: true, hang: [blinders(10), strobes(6, 0.22), washes(6, 0.15), { type: 'confetti', count: 6, role: 'confetti', dy: -0.5, inset: 0.15 }] });
rig.push(floorHeads(front - 9, deck, 13, 10), floorHeads(front - 1.2, deck, 14, 12));
rig.push({ line: across(front - 6, 17, 14), hang: [{ type: 'laser', count: 8, role: 'laser' }] });
rig.push({ line: across(front - 0.6, deck, 14.5), hang: [{ type: 'co2', count: 8, role: 'co2' }, { type: 'spark', count: 7, role: 'spark', inset: 0.1 }, { type: 'flame', count: 6, role: 'flame', inset: 0.16 }] });
rig.push({ line: across(front + 12, 3, 14), hang: [{ type: 'firework', count: 5, role: 'firework' }] });
for (const s of [-1, 1]) for (const z of [front - 0.8, -D / 2 + 0.9]) rig.push({ line: [[s * 15.6, deck, z], [s * 15.6, 20, z]], truss: true, hang: [] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * 14, deck + 0.2, front - 3]));

export default {
  name: 'Arena', kind: 'Halls', genres: ['mainstage', 'trance', 'dancepop', 'harddance', 'pop', 'techno', 'dnb', 'hard'], capacity: 14000,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'dark', floor: 'dark', frames: 12, parts: [{ type: 'tiers', sides: ['left', 'right', 'back'], rows: ROWS, rise: 0.5, run: RUN, base: 3, z0: front + 2, kind: 'concrete', standing: true }] },
  stage: STAGE, rig,
  crowd: { count: 2800, seats: 2400, floor: { x0: -W / 2 + DEEP + 1, x1: W / 2 - DEEP - 1, z1: D / 2 - DEEP - 1 } },
};
