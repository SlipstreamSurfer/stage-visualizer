// The Opera House: red velvet and gold. Three galleries round the stalls, a great chandelier, and a stage behind a
// gilded frame with its curtains drawn back, an orchestra on it and a painted scene behind. 26 by 44 metres, 19 high.
// An invented venue.
import { across, along, heads, washes, glow, one } from './kit.js';

const W = 26, D = 44, H = 19, STAGE = { width: 18, depth: 12, height: 1.3, floor: 'wood', pa: 'none', performer: 'orchestra' }, LEVELS = [4.6, 8.6, 12.6];
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [one('chandelier', 'house', [0, 14.2, front + 14], { size: 3.2, rings: 3, power: 120, reach: 40 })];
rig.push({ line: across(front - 2.6, 12.4, 7), hang: [washes(8, 0.03)] }, { line: across(front - 8, 12.4, 7), hang: [washes(6, 0.05)] });
rig.push({ line: across(front - 1.3, 12.7, 7.4), truss: true, hang: [heads(8)] });
rig.push(one('ledWall', 'wall', [0, deck + 4.8, -D / 2 + 0.4], { width: 15, height: 9 }));   // the scene at the back of the stage
for (const y of LEVELS) {
  for (const s of [-1, 1]) rig.push({ line: along(s * (W / 2 - 2.92), y - 0.2, front + 2.5, D / 2 - 3.5), hang: [{ type: 'ledBar', count: 7, role: 'bars', props: { length: 3.2, rotY: Math.PI / 2 } }] });
  rig.push({ line: across(D / 2 - 2.92, y - 0.2, 9), hang: [{ type: 'ledBar', count: 5, role: 'bars', props: { length: 3.2 } }] });
}
for (const s of [-1, 1]) rig.push(glow(s * 6, deck + 0.3, front - 1, { power: 30, reach: 14, bare: true }), glow(s * 7, 16.5, front + 16, { power: 40, reach: 22, bare: true }));

export default {
  name: 'Opera House', kind: 'Concert', genres: ['orchestra', 'soundtrack', 'classical', 'neoclassical', 'pop'], capacity: 1800,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'velvet', floor: 'wood', ceiling: 'plaster', parts: [
    { type: 'proscenium', width: 16, height: 11 },
    ...LEVELS.map(y => ({ type: 'balcony', y, depth: 3, rows: 2, front: 0xd8c8a0, kind: 'velvet' })),
  ] },
  stage: STAGE, rig,
  crowd: { count: 620, seated: true, rake: 1.6, seats: 640, chair: 0x6a0f16, floor: { x0: -9.4, x1: 9.4, z1: D / 2 - 4.2 } },
};
