// The Disco: velvet walls, a dance floor of lit tiles, a big mirror ball with four small ones round it, and rails of
// light across the ceiling. 20 by 28 metres, 6 high. An invented venue.
import { across, heads, washes, bars, strobes, blinders, uprights, glow, one } from './kit.js';

const W = 20, D = 28, H = 6, STAGE = { width: 8, depth: 3, height: 0.7, pa: 'stacks', floor: 'wood' };
const front = -D / 2 + STAGE.depth;

const rig = [one('ledFloor', 'floor', [0, 0.03, front + 11.5], { cols: 14, rows: 14, size: 1 })];
rig.push(one('mirrorBall', 'ball', [0, H - 1.1, front + 11.5]));
for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) rig.push(one('mirrorBall', 'ball', [x, H - 0.8, front + 11.5 + z]));
for (let i = 0; i < 3; i++) rig.push({ line: across(front + 4.5 + i * 7, H - 0.45, 8), truss: true, hang: [heads(6), bars(6, 1.2), washes(2, 0.3), ...(i === 1 ? [strobes(2, 0.4)] : [])] });
rig.push(uprights(-D / 2 + 0.3, STAGE.height + 1.6, 3.6, 9, 2.6));
rig.push({ line: across(front - 0.2, H - 0.55, 3.5), hang: [blinders(4)] });
rig.push({ line: across(front + 1, H - 0.6, 6), hang: [{ type: 'confetti', count: 3, role: 'confetti' }] });
for (const s of [-1, 1]) for (const z of [front + 4, front + 14]) rig.push(glow(s * (W / 2 - 0.7), 1, z, { power: 22, reach: 11 }));

export default {
  name: 'Disco', kind: 'Clubs', genres: ['nudisco', 'funky', 'house', 'dancepop', 'indiedance', 'jackin', 'pop'], capacity: 480,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'velvet', floor: 'wood', ceiling: 'dark' },
  stage: STAGE, rig,
  crowd: { count: 420 },
};
