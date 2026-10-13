// The Cave: a chamber in the rock, about 30 by 48 metres, the roof somewhere between five and nine metres up with
// stone hanging from it. No trusses to speak of: lamps stand on the floor and in the crevices, and the rock takes
// their colour. An invented venue.
import { across, heads, strobes, floorHeads, glow, one } from './kit.js';

const W = 30, D = 48, H = 9, STAGE = { width: 9, depth: 4, height: 0.7, floor: 'rock', pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (const z of [front + 8, front + 22]) rig.push({ line: across(z, 5, 8), truss: true, hang: [heads(6), strobes(2, 0.35)] });   // two short trusses on chains let into the roof
rig.push(floorHeads(front - 2.6, deck, 3.6, 6));
for (const s of [-1, 1]) for (const z of [front + 4, front + 20]) rig.push(one('movingHead', 'stage', [s * 10.2, 0.3, z], { stand: true }));
for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rig.push(glow(s * 10.4, 0.8, front + 2 + i * 13, { power: 60, reach: 20, bare: true }));
rig.push(glow(-3.5, deck + 0.4, -D / 2 + 3.6, { power: 50, reach: 16, bare: true }), glow(3.5, deck + 0.4, -D / 2 + 3.6, { power: 50, reach: 16, bare: true }));
rig.push({ line: across(front - 0.5, 4.6, 3), hang: [{ type: 'laser', count: 3, role: 'laser' }] }, one('hazer', 'hazer', [-5, 0.3, front - 1]));

export default {
  name: 'Cave', kind: 'Halls', genres: ['psytrance', 'ambient', 'downtempo', 'deepdubstep', 'trancedeep', 'organic', 'dubstep', 'hypnotic'], capacity: 800,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'rock', floor: 'rock', ceiling: 'rock', rough: 1.6, parts: [{ type: 'stalactites', count: 110 }] },
  stage: STAGE, rig,
  crowd: { count: 700, floor: { x0: -11.5, x1: 11.5, z1: D / 2 - 4.5 } },
};
