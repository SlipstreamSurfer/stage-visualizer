// The Loft: a floor of an old warehouse in town. Boards underfoot, white-painted brick, a row of cast-iron columns,
// and tall arched windows down one side with the city behind them. Strings of lamps and a mirror ball. 13 by 26
// metres. An invented venue.
import { across, heads, washes, uprights, glow, festoon, one } from './kit.js';

const W = 13, D = 26, H = 4.4, STAGE = { width: 5.5, depth: 2.4, height: 0.35, pa: 'stacks', floor: 'wood' };
const front = -D / 2 + STAGE.depth;

const rig = [one('mirrorBall', 'ball', [0, H - 0.9, front + 10])];
for (let i = 0; i < 3; i++) rig.push({ line: across(front + 3 + i * 6.5, H - 0.42, 4.4), hang: [heads(4), washes(2, 0.3)] });
rig.push(uprights(-D / 2 + 0.25, STAGE.height + 1.3, 2.2, 5, 2));
for (let i = 0; i < 4; i++) rig.push(festoon([-W / 2 + 0.2, H - 0.5, front + 2 + i * 5.6], [W / 2 - 0.2, H - 0.5, front + 4.8 + i * 5.6], { sag: 0.45 }));
for (const z of [front + 3, front + 11, front + 19]) rig.push(glow(-W / 2 + 0.6, 0.4, z, { power: 18, reach: 10 }));   // up the brick, opposite the windows

export default {
  name: 'Loft', kind: 'Clubs', genres: ['deephouse', 'house', 'downtempo', 'rnb', 'nudisco', 'afro', 'amapiano', 'electronica'], capacity: 220,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'whitebrick', floor: 'wood', ceiling: 'plaster', parts: [
    { type: 'columns', xs: [-3.2, 3.2], every: 5.2, z0: front + 5.2, r: 0.11, kind: 'iron', cap: true },
    { type: 'beams', every: 5.2, depth: 0.32, width: 0.3, kind: 'wood' },
    { type: 'windows', walls: ['right'], every: 3.2, width: 2, height: 3.3, sill: 0.6, kind: 'city', glow: 1.5 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 200 },
};
