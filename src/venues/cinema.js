// The Film Hall: a film played to a live orchestra. Seats rising steeply to the back, walls of wooden slats, the
// orchestra on a wide stage and over it a screen 22 metres across. 30 by 46 metres. An invented venue.
import { across, along, heads, washes, glow, one } from './kit.js';

const W = 30, D = 46, H = 14, STAGE = { width: 24, depth: 10, height: 1, floor: 'wood', pa: 'none', performer: 'orchestra' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [one('ledWall', 'screen', [0, deck + 3.6 + 4.2, -D / 2 + 0.3], { width: 22, height: 8.4 })];
rig.push({ line: across(front - 2.6, 4.3, 10), hang: [washes(8, 0.03)] }, { line: across(front - 6.6, 4.3, 10), hang: [washes(6, 0.05)] });   // low over the players, under the picture
for (const s of [-1, 1]) {
  rig.push({ line: along(s * (W / 2 - 0.6), 10, front + 2, front + 20), hang: [heads(5)] });
  for (let i = 0; i < 3; i++) rig.push(glow(s * (W / 2 - 0.8), 2.5 + i * 2.2, front + 5 + i * 10, { power: 22, reach: 14, bare: true }));
}

export default {
  name: 'Film Hall', kind: 'Concert', genres: ['soundtrack', 'orchestra', 'electronica', 'ambient', 'neoclassical', 'classical'], capacity: 1400,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'slats', floor: 'dark', ceiling: 'dark' },
  stage: STAGE, rig,
  crowd: { count: 1100, seated: true, pitch: 1, rake: 6.5, chair: 0x1c1c26, carpet: 'dark', floor: { x0: -12.6, x1: 12.6, z1: D / 2 - 2.6 } },
};
