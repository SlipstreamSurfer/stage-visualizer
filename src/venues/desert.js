// The Desert: a dry lake bed under more stars than you have seen, mountains low on the horizon, and out on it a
// pyramid of truss edged with light, the decks under its point. Beams from its four corners go up into the night. An
// invented venue.
import { heads, floorHeads, glow, one } from './kit.js';

const W = 80, D = 90, STAGE = { width: 12, depth: 8, height: 1.4, pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, MID = -D / 2 + STAGE.depth / 2, TOP = [0, 15, MID];

const rig = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  rig.push({ line: [[sx * 9, 0, MID + sz * 7], TOP], truss: true, hang: [{ type: 'ledBar', count: 6, role: 'bars', inset: 0.1, props: { length: 2.2 } }, { type: 'movingHead', count: 3, role: 'overhead', dy: -0.35, inset: 0.3 }] });
  rig.push(one('movingHead', 'stage', [sx * 9.8, 0.3, MID + sz * 7.8], { stand: true, reach: 130 }));
}
rig.push(floorHeads(front - 6.4, deck, 5, 8, 'stage', { reach: 130 }));
rig.push(one('laser', 'laser', [0, 13.4, MID + 0.5]), one('strobe', 'strobe', [-3, 9.5, MID + 3]), one('strobe', 'strobe', [3, 9.5, MID + 3]));
rig.push({ line: [[-10, 0.2, front + 2], [10, 0.2, front + 2]], hang: [{ type: 'flame', count: 4, role: 'flame' }, { type: 'spark', count: 3, role: 'spark', inset: 0.2 }] });
for (const s of [-1, 1]) rig.push(glow(s * 5, deck + 2.5, front + 1, { power: 60, reach: 26, bare: true }));

export default {
  name: 'Desert', kind: 'Open air', genres: ['organic', 'downtempo', 'melodic', 'psytrance', 'progressive', 'afro', 'ambient', 'trancedeep', 'electronica'], capacity: 2500,
  plan: { width: W, depth: D, height: 14 },
  shell: { open: true, floor: 'playa', sky: 'night', wind: [1.2, 0.2], around: [{ type: 'mountains', h: 55, rings: 2 }] },
  stage: STAGE, rig,
  crowd: { count: 1100 },
};
