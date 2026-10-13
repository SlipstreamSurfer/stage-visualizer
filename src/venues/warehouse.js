// The Warehouse: a brick factory floor under a saw-tooth roof, 30 by 54 metres, with two rows of cast-iron columns and
// steel windows down both sides. Bare trusses, a wall of strobes behind the DJ, no screen to speak of. An invented
// venue.
import { across, heads, washes, strobes, floorHeads, one } from './kit.js';

const W = 30, D = 54, H = 8.5, STAGE = { width: 14, depth: 5, height: 1.1 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (let i = 0; i < 3; i++) rig.push({ line: across(front + 5 + i * 10.5, 7, 11), truss: true, hang: [heads(8), strobes(6, 0.08), washes(2, 0.3)] });
rig.push({ line: across(-D / 2 + 0.4, deck + 4.3, 5.5), hang: [{ type: 'strobe', count: 8, role: 'strobe' }] }, { line: across(-D / 2 + 0.4, deck + 3.3, 5.5), hang: [{ type: 'blinder', count: 6, role: 'blinder' }] });
rig.push(one('ledWall', 'wall', [0, deck + 0.4 + 1.3, -D / 2 + 0.45], { width: 8, height: 2.6 }));
rig.push(floorHeads(front - 3.6, deck, 5.5, 6));
rig.push({ line: across(front - 1, 6.6, 5), hang: [{ type: 'laser', count: 3, role: 'laser' }] });
rig.push({ line: across(front - 0.4, deck, 5.5), hang: [{ type: 'co2', count: 3, role: 'co2' }, { type: 'flame', count: 4, role: 'flame', inset: 0.15 }] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * (W / 2 - 2), 0.3, front - 2]));

export default {
  name: 'Warehouse', kind: 'Halls', genres: ['raw', 'hard', 'techno', 'harddance', 'electro', 'hypnotic', 'dnb'], capacity: 1600,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'brick', floor: 'concrete', roof: { type: 'sawtooth', every: 6.75, rise: 2.6, glow: 0.7 }, parts: [
    { type: 'columns', xs: [-7.5, 7.5], every: 6.75, z0: front + 5.6, r: 0.14, kind: 'iron', cap: true },
    { type: 'windows', walls: ['left', 'right'], every: 6.75, width: 3.6, height: 3.4, sill: 3.2, kind: 'factory', glow: 1.3 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 1300 },
};
