// The Bunker: a shelter of raw concrete, 12 by 26 metres under a slab 3.4 metres up, with beams across it and blast
// walls you walk round. Few lamps, all of them hard: strobes on the bare ceiling, red tubes down the walls. An
// invented venue.
import { across, along, heads, strobes, floorHeads, glow, one } from './kit.js';

const W = 12, D = 26, H = 3.4, STAGE = { width: 6, depth: 2.6, height: 0.3, pa: 'stacks' };
const front = -D / 2 + STAGE.depth;

const rig = [];
for (let i = 0; i < 4; i++) rig.push({ line: across(front + 2.6 + i * 5.2, H - 0.2, 4.4), hang: [heads(4), strobes(2, 0.3)] });   // between the beams
for (const s of [-1, 1]) rig.push({ line: along(s * (W / 2 - 0.12), 2.3, front + 1.5, D / 2 - 2.5), hang: [{ type: 'ledBar', count: 7, role: 'bars', props: { length: 1.8, rotY: Math.PI / 2 } }] });
rig.push({ line: across(-D / 2 + 0.3, 2.3, 2.6), hang: [{ type: 'blinder', count: 4, role: 'blinder' }, { type: 'strobe', count: 3, role: 'strobe', inset: 0.2 }] });   // behind the DJ
rig.push(floorHeads(-D / 2 + 0.7, 0.3, 2.4, 4));
rig.push(glow(0, 2.9, front + 8, { power: 12, reach: 11, bare: true }), glow(0, 2.9, front + 17, { power: 12, reach: 11, bare: true }));
rig.push(one('hazer', 'hazer', [-W / 2 + 1, 0.2, front - 1]));

export default {
  name: 'Bunker', kind: 'Clubs', genres: ['raw', 'hard', 'deep', 'hypnotic', 'electro', 'minimal', 'techno'], capacity: 280,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'concrete', floor: 'concrete', ceiling: 'concrete', parts: [
    { type: 'beams', every: 4.33, depth: 0.5, width: 0.5 },
    { type: 'columns', xs: [-3.1, 3.1], zs: [front + 6.5, front + 15.2], r: 0.28, square: true },
    { type: 'blocks', list: [[0.45, H, 3.2, -W / 2 + 2.3, D / 2 - 4.2], [0.45, H, 3.2, W / 2 - 2.3, D / 2 - 7.5]] },   // blast walls by the way in
  ] },
  stage: STAGE, rig,
  crowd: { count: 240 },
};
