// The Pool: a white terrace on a cliff, the sun going down over the sea all round. A pool lit from below in the
// middle of it, palms along the edges with lamps at their feet, strings of lamps across, and a white booth at one
// end. 38 by 54 metres. An invented venue.
import { heads, washes, strobes, uprights, floorHeads, glow, festoon, goalpost, one } from './kit.js';

const W = 38, D = 54, STAGE = { width: 10, depth: 4, height: 0.9, floor: 'plaster', pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, POOL = { x: 0, z: front + 27, width: 12, depth: 22 }, STRINGS = [front + 6, front + 18, front + 30, front + 42];
const palms = [];
for (const s of [-1, 1]) for (let z = front + 2; z < D / 2 - 2; z += 8) palms.push([s * (W / 2 - 1.8), z, 6 + (z * 3 % 3)]);

const rig = [
  one('pool', 'pool', [POOL.x, 0.05, POOL.z], { width: POOL.width, depth: POOL.depth }),
  ...goalpost(front - 0.4, 5.4, 5.6, [heads(8), washes(4, 0.15), strobes(2, 0.4)]),
  floorHeads(-D / 2 + 0.9, deck, 4.2, 8, 'stage', { reach: 110 }), uprights(-D / 2 + 0.5, deck + 1.3, 4.2, 9, 2.4),
  ...STRINGS.map(z => festoon([-W / 2 + 0.5, 4.6, z], [W / 2 - 0.5, 4.6, z], { sag: 1.5 })),
  ...palms.filter((_, i) => i % 2 === 0).map(([x, z]) => glow(x * 0.9, 0.5, z, { power: 26, reach: 11, bare: true })),
  { line: [[-4.4, deck, front - 0.4], [4.4, deck, front - 0.4]], hang: [{ type: 'co2', count: 4, role: 'co2' }, { type: 'spark', count: 3, role: 'spark', inset: 0.16 }] },
  { line: [[-5, 5.2, front + 1], [5, 5.2, front + 1]], hang: [{ type: 'confetti', count: 3, role: 'confetti' }] },
];

export default {
  name: 'Pool', kind: 'Open air', genres: ['techhouse', 'house', 'funky', 'jackin', 'dancepop', 'latin', 'nudisco', 'afro', 'pop'], capacity: 1200,
  plan: { width: W, depth: D, height: 6 },
  shell: { open: true, ground: false, floor: 'paving', walls: 'plaster', wallSet: ['left', 'right', 'back', 'front'], wallHeight: 1, sky: 'dusk', wind: [0.6, 0.2], around: [{ type: 'sea', all: true, y: -16 }], parts: [
    { type: 'keep', rect: [POOL.x - POOL.width / 2 - 0.9, POOL.x + POOL.width / 2 + 0.9, POOL.z - POOL.depth / 2 - 0.9, POOL.z + POOL.depth / 2 + 0.9] },
    { type: 'columns', xs: [-W / 2 + 0.5, W / 2 - 0.5], zs: STRINGS, r: 0.05, h: 4.65, kind: 'iron', colour: 0xd8d8d2 },
    { type: 'palms', at: palms },
  ] },
  stage: STAGE, rig,
  crowd: { count: 900 },
};
