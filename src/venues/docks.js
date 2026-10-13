// The Docks: a container yard at night. Stacks of containers down both sides and behind the stage, harbour cranes
// beyond them, masts of sodium light. The stage is as high as a container, between four towers of truss; two more
// gates of truss stand across the yard. An invented venue.
import { across, heads, washes, strobes, blinders, floorHeads, glow, goalpost, one } from './kit.js';

const W = 48, D = 74, STAGE = { width: 18, depth: 7, height: 2.6 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (const s of [-1, 1]) for (const z of [front - 0.6, -D / 2 + 1]) rig.push({ line: [[s * 10, deck, z], [s * 10, 13, z]], truss: true, hang: [] });
rig.push({ line: across(front - 0.6, 13, 10), truss: true, hang: [blinders(8), strobes(6, 0.1), washes(4)] });
rig.push({ line: across(-D / 2 + 1, 13, 10), truss: true, hang: [heads(10)] }, { line: across(-D / 2 + 1, 8.6, 10), truss: true, hang: [heads(10), strobes(6, 0.1)] });
rig.push(one('ledWall', 'wall', [0, deck + 0.6 + 3, -D / 2 + 0.5], { width: 16, height: 6 }));
rig.push(floorHeads(front - 5, deck, 8, 8), floorHeads(front - 0.9, deck, 8.5, 10));
rig.push(...goalpost(front + 14, 11, W / 2 - 1, [heads(10), strobes(6, 0.1)]), ...goalpost(front + 34, 11, W / 2 - 1, [heads(10)]));
rig.push({ line: across(front - 3, 12.6, 8), hang: [{ type: 'laser', count: 6, role: 'laser' }] });
rig.push({ line: across(front - 0.4, deck, 8.5), hang: [{ type: 'co2', count: 6, role: 'co2' }, { type: 'flame', count: 6, role: 'flame', inset: 0.12 }, { type: 'spark', count: 5, role: 'spark', inset: 0.18 }] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * 12, 0.3, front + 1]));
// lamps along the stacks, so the containers take the colours of the show
for (const s of [-1, 1]) for (const z of [front + 4, front + 22, front + 40]) rig.push(glow(s * (W / 2 - 1.5), 2.5, z, { power: 70, reach: 24, bare: true }));
rig.push(glow(-12, deck + 1, -D / 2 + 1.5, { power: 50, reach: 18, bare: true }), glow(12, deck + 1, -D / 2 + 1.5, { power: 50, reach: 18, bare: true }));

export default {
  name: 'Docks', kind: 'Open air', genres: ['basshouse', 'dnb', 'dubstep', 'hard', 'breaks', 'trap', 'harddance', 'techno', 'raw', 'bassclub'], capacity: 5000,
  plan: { width: W, depth: D, height: 14 },
  shell: { open: true, floor: 'asphalt', sky: 'city', wind: [1, 0.6], around: ['containers', 'cranes'] },
  stage: STAGE, rig,
  crowd: { count: 2200 },
};
