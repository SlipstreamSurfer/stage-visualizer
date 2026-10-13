// The Beach: sand, a low sun going down into the sea behind the stage, palms along both sides with lamps in them and
// strings of lamps from the stage out over the crowd. A wooden stage under a roof of boards. An invented venue.
import { heads, washes, strobes, uprights, floorHeads, glow, festoon, goalpost } from './kit.js';

const W = 46, D = 72, STAGE = { width: 14, depth: 6, height: 1, floor: 'wood', pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, SHORE = -D / 2 - 7;

const rig = [
  ...goalpost(front - 0.6, 6.4, 7.6, [heads(8), washes(4, 0.15), strobes(2, 0.4)]),
  ...goalpost(-D / 2 + 0.8, 6.4, 7.6, [heads(8)], deck),
  uprights(-D / 2 + 0.5, deck + 1.5, 5.5, 9, 2.6),
  floorHeads(front - 4.4, deck, 6, 8, 'stage', { reach: 100 }),
  ...[-1, 1].flatMap(s => [festoon([s * 7.6, 6.4, front - 0.6], [s * 21, 5, front + 26], { sag: 1.6 }), festoon([s * 7.6, 6.4, front - 0.6], [s * 9, 5, front + 48], { sag: 2.2 }), festoon([s * 21, 5, front + 26], [s * 9, 5, front + 48], { sag: 1.4 })]),
  ...[-1, 1].flatMap(s => [8, 26, 44].map(z => glow(s * (W / 2 + 2), 1, front + z, { power: 40, reach: 17, bare: true }))),
  { line: [[-7, deck, front - 0.4], [7, deck, front - 0.4]], hang: [{ type: 'flame', count: 4, role: 'flame' }, { type: 'spark', count: 3, role: 'spark', inset: 0.15 }, { type: 'co2', count: 2, role: 'co2', inset: 0.3 }] },
  { line: [[-30, 0.5, SHORE - 30], [30, 0.5, SHORE - 30]], hang: [{ type: 'firework', count: 5, role: 'firework', props: { rise: 40, reach: 18 } }] },   // from a raft out at sea
];

export default {
  name: 'Beach', kind: 'Open air', genres: ['organic', 'afro', 'melodic', 'latin', 'caribbean', 'downtempo', 'deephouse', 'house', 'progressive'], capacity: 3000,
  plan: { width: W, depth: D, height: 8 },
  shell: { open: true, floor: 'sand', sky: 'dusk', shore: SHORE, wind: [0.5, 0.3], around: ['sea', 'palms'], parts: [
    { type: 'blocks', kind: 'wood', walk: true, list: [[16, 0.25, 6.6, 0, -D / 2 + 3, 0, 6.7]] },   // the roof over the stage
  ] },
  stage: STAGE, rig,
  crowd: { count: 1400 },
};
