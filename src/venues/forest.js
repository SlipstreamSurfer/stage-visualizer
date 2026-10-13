// The Forest: a clearing in the woods at night. Lamps in the trees all round, so the trunks and the leaves take the
// colours of the show; bright sails stretched overhead; a wooden stage and two gates of truss across the clearing. An
// invented venue.
import { across, heads, washes, strobes, uprights, floorHeads, glow, festoon, goalpost, one } from './kit.js';

const W = 40, D = 58, STAGE = { width: 10, depth: 5, height: 0.8, floor: 'wood', pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [
  ...goalpost(front + 8, 8, 17, [heads(8), strobes(2, 0.4)]), ...goalpost(front + 27, 8, 17, [heads(8)]),
  ...goalpost(front - 0.5, 6, 5.6, [heads(6), washes(2, 0.3)]),
  uprights(-D / 2 + 0.5, deck + 1.4, 4, 7, 2.4), floorHeads(front - 3.6, deck, 4, 6),
  { line: across(front - 0.4, 5.6, 4.6), hang: [{ type: 'laser', count: 4, role: 'laser' }] },
  ...[-1, 1].flatMap(s => [festoon([s * 17, 8, front + 8], [s * 17, 8, front + 27], { sag: 1.2 }), festoon([s * 5.6, 6, front - 0.5], [s * 17, 8, front + 8], { sag: 0.9 })]),
  ...[-1, 1].flatMap(s => [4, 20, 36].map(z => glow(s * (W / 2 + 2.5), 1.2, front + z, { power: 55, reach: 22, bare: true }))),
  glow(-7, 1.2, -D / 2 - 3, { power: 55, reach: 22, bare: true }), glow(7, 1.2, -D / 2 - 3, { power: 55, reach: 22, bare: true }),
  one('hazer', 'hazer', [-7, 0.3, front]), one('hazer', 'hazer', [7, 0.3, front]),
];

export default {
  name: 'Forest', kind: 'Open air', genres: ['psytrance', 'organic', 'dnb', 'ambient', 'downtempo', 'trancedeep', 'deep', 'hypnotic'], capacity: 1500,
  plan: { width: W, depth: D, height: 9 },
  shell: { open: true, floor: 'dirt', sky: 'night', wind: [0.3, 0.2], around: ['forest'], parts: [{ type: 'sails', count: 26, y: 6.5 }] },
  stage: STAGE, rig,
  crowd: { count: 900 },
};
