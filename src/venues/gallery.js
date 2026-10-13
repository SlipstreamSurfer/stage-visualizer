// The Gallery: a white room, 18 by 36 metres and 7 high, with nothing in it but light. Lamps along the foot of both
// walls turn the whole room one colour and then another; over the floor hangs a field of LED tubes that rise and
// fall. An invented venue.
import { across, heads, strobes, glow, one } from './kit.js';

const W = 18, D = 36, H = 7, STAGE = { width: 7, depth: 3, height: 0.4, pa: 'stacks', performer: { beat: 'dj', flow: 'piano' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [one('kinetic', 'kinetic', [0, H - 0.5, front + 15], { cols: 9, rows: 14, width: 14, depth: 26, travel: 3.2, length: 1.1 })];
for (const s of [-1, 1]) for (let i = 0; i < 4; i++) rig.push(glow(s * (W / 2 - 0.6), 0.3, front + 3 + i * 8.5, { power: 26, reach: 14 }));
for (let i = 0; i < 3; i++) rig.push({ line: across(front + 4 + i * 9.5, H - 0.3, 6.5), hang: [heads(5), ...(i === 0 ? [strobes(2, 0.3)] : [])] });
rig.push(one('ledWall', 'wall', [0, deck + 0.3 + 1.6, -D / 2 + 0.3], { width: 6, height: 3.2 }));
rig.push({ line: across(front - 0.2, H - 0.4, 3), hang: [{ type: 'blinder', count: 2, role: 'blinder', dy: -0.35 }] });

export default {
  name: 'Gallery', kind: 'Halls', genres: ['electronica', 'minimal', 'ambient', 'indiedance', 'breaks', 'neoclassical', 'deep', 'techno'], capacity: 450,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'plaster', floor: 'concrete', ceiling: 'plaster' },
  stage: STAGE, rig,
  crowd: { count: 380 },
};
