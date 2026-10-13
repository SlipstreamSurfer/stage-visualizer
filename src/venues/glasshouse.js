// The Glasshouse: a palm house of iron and glass, 20 by 46 metres, the night sky through the roof and palms down both
// sides with lamps at their feet. A low wooden stage at one end, strings of lamps along the eaves and the ridge. An
// invented venue.
import { along, heads, washes, uprights, glow, festoon, goalpost, one } from './kit.js';

const W = 20, D = 46, H = 6, RISE = 5, STAGE = { width: 8, depth: 4, height: 0.6, floor: 'wood', pa: 'stacks', performer: { beat: 'dj', flow: 'piano' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, palms = [];
for (const s of [-1, 1]) for (let z = front + 3; z < D / 2 - 2; z += 6) palms.push([s * 8.3, z, 5 + (z * 7 % 3)]);

const rig = [
  ...goalpost(front - 0.4, 5.2, 4.6, [heads(6, 'overhead'), washes(2, 0.3)]),
  { line: along(0, H + RISE - 1.4, front + 4, D / 2 - 6), truss: true, hang: [heads(8)] },
  uprights(-D / 2 + 0.4, deck + 1.3, 3, 7, 2.2),
  one('mirrorBall', 'ball', [0, 8.2, front + 14]),
  festoon([0, H + RISE - 0.5, -D / 2 + 1], [0, H + RISE - 0.5, D / 2 - 1], { sag: 0.5 }),
  ...[-1, 1].map(s => festoon([s * 9.6, H - 0.2, front], [s * 9.6, H - 0.2, D / 2 - 1], { sag: 0.35 })),
  ...palms.filter((_, i) => i % 2 === 0).map(([x, z]) => glow(x * 0.9, 0.5, z, { power: 18, reach: 10 })),
];

export default {
  name: 'Glasshouse', kind: 'Halls', genres: ['organic', 'downtempo', 'electronica', 'deephouse', 'afro', 'melodic', 'ambient', 'neoclassical'], capacity: 500,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'glass', floor: 'paving', roof: { type: 'glass', rise: RISE, every: 3.83 }, sky: 'night', around: ['trees'], parts: [{ type: 'palms', at: palms }] },
  stage: STAGE, rig,
  crowd: { count: 420 },
};
