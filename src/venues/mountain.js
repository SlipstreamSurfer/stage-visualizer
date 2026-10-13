// The Summit: a flat top of rock, 30 by 40 metres, at first light. Ridges all round, the valleys full of cloud, the
// sun coming up behind the decks. A few lamps and nothing else: the place does the rest. An invented venue.
import { heads, washes, uprights, floorHeads, glow, goalpost, one } from './kit.js';

const W = 30, D = 40, STAGE = { width: 6, depth: 3.5, height: 0.4, floor: 'wood', pa: 'stacks', performer: { beat: 'dj', flow: 'piano' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [
  ...goalpost(front - 0.3, 4.6, 3.6, [heads(6), washes(2, 0.3)]),
  floorHeads(-D / 2 + 0.8, deck, 2.6, 6, 'stage', { reach: 130 }), uprights(-D / 2 + 0.4, deck + 1.2, 2.4, 5, 2),
  ...[[-12, front + 6], [12, front + 6], [-12, front + 26], [12, front + 26]].map(([x, z]) => one('movingHead', 'stage', [x, 0.3, z], { stand: true, reach: 130 })),
  glow(-5, 1, front + 2, { power: 40, reach: 18, bare: true }), glow(5, 1, front + 2, { power: 40, reach: 18, bare: true }),
];

export default {
  name: 'Summit', kind: 'Open air', genres: ['melodic', 'progressive', 'organic', 'ambient', 'downtempo', 'trancedeep', 'neoclassical', 'electronica'], capacity: 300,
  plan: { width: W, depth: D, height: 6 },
  shell: { open: true, ground: false, floor: 'rock', sky: 'dawn', wind: [1.6, 0.4], around: [{ type: 'mountains', h: 190, rings: 4, drop: 260 }, { type: 'clouds', drop: 60 }, { type: 'boulders', count: 90 }] },
  stage: STAGE, rig,
  crowd: { count: 260, even: true },
};
