// The Rooftop: the roof of a block in the middle of town, 26 by 42 metres inside its parapet, the city lit up all
// round and a good way down. Strings of lamps across, palms in tubs, a small stage under a gate of truss. An invented
// venue.
import { heads, washes, strobes, uprights, floorHeads, glow, festoon, goalpost, one } from './kit.js';

const W = 26, D = 42, STAGE = { width: 8, depth: 3.6, height: 0.5, floor: 'wood', pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, STRINGS = [front + 4, front + 11, front + 18, front + 25, front + 32];
const palms = [[-W / 2 + 1.7, front + 2.5, 4.6], [W / 2 - 1.7, front + 2.5, 4.4], [-W / 2 + 1.7, front + 15, 5], [W / 2 - 1.7, front + 21, 4.8], [-W / 2 + 1.7, front + 28, 4.4]];

const rig = [
  ...goalpost(front - 0.3, 5, 4.6, [heads(6), washes(2, 0.3), strobes(2, 0.4)]),
  floorHeads(-D / 2 + 0.9, deck, 3.4, 6, 'stage', { reach: 110 }), uprights(-D / 2 + 0.5, deck + 1.3, 3.2, 7, 2.2),
  ...STRINGS.map((z, i) => festoon([-W / 2 + 0.4, 4.2, z], [W / 2 - 0.4, 4.2, z + (i % 2 ? 3 : -3)], { sag: 0.9 })),
  ...palms.slice(0, 4).map(([x, z]) => glow(x * 0.86, 0.5, z, { power: 22, reach: 10, bare: true })),
  one('laser', 'laser', [-2, 4.6, front - 0.3]), one('laser', 'laser', [2, 4.6, front - 0.3]),
  { line: [[-3.4, deck, front - 0.4], [3.4, deck, front - 0.4]], hang: [{ type: 'co2', count: 2, role: 'co2' }] },
];

export default {
  name: 'Rooftop', kind: 'Open air', genres: ['deephouse', 'afro', 'amapiano', 'nudisco', 'house', 'rnb', 'hiphop', 'funky', 'indiedance'], capacity: 500,
  plan: { width: W, depth: D, height: 6 },
  shell: { open: true, ground: false, floor: 'paving', walls: 'concrete', wallSet: ['left', 'right', 'back', 'front'], wallHeight: 1.15, sky: 'city', wind: [0.8, 0.4], around: [{ type: 'skyline', drop: 70, tall: 170 }], parts: [
    { type: 'blocks', list: [[5, 3.2, 4, W / 2 - 3.2, D / 2 - 2.8], [2.4, 2.7, 2.4, -W / 2 + 1.9, D / 2 - 1.9], [1.7, 1.1, 1.2, 5, D / 2 - 1.4], [1.7, 1.1, 1.2, 1.5, D / 2 - 1.4]] },   // the stair head, the lift's motor room, air conditioning
    { type: 'columns', xs: [-W / 2 + 0.4, W / 2 - 0.4], zs: [...STRINGS.map((z, i) => z), ...STRINGS.map((z, i) => z + (i % 2 ? 3 : -3))], r: 0.05, h: 4.25, kind: 'iron' },
    { type: 'palms', at: palms },
  ] },
  stage: STAGE, rig,
  crowd: { count: 420 },
};
