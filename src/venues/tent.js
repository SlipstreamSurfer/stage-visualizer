// The Big Top: a striped tent on four king poles, an oval 46 by 66 metres with the canvas rising 14 metres over the
// middle. A square of truss between the poles, the stage at one end against a black drape. An invented venue.
import { across, along, heads, washes, strobes, blinders, uprights, floorHeads, glow, one } from './kit.js';

const W = 46, D = 66, H = 5, RISE = 14, STAGE = { width: 18, depth: 8, height: 1.5, z: -24 };
const front = STAGE.z + STAGE.depth / 2, back = STAGE.z - STAGE.depth / 2, deck = STAGE.height, PX = W * 0.19, PZ = D * 0.19;

const rig = [];
rig.push({ line: across(-PZ, 10, PX), truss: true, hang: [heads(6), strobes(2, 0.3)] }, { line: across(PZ, 10, PX), truss: true, hang: [heads(6), strobes(2, 0.3)] });
for (const s of [-1, 1]) rig.push({ line: along(s * PX, 10, -PZ, PZ), truss: true, hang: [heads(8), washes(3), { type: 'confetti', count: 2, role: 'confetti', dy: -0.5, inset: 0.3 }] });
rig.push({ line: across(front - 0.5, 7.6, 8.4), truss: true, hang: [blinders(6), strobes(4, 0.3), heads(8, 'stage')] });
for (const s of [-1, 1]) rig.push({ line: [[s * 8.4, deck, front - 0.5], [s * 8.4, 7.6, front - 0.5]], truss: true, hang: [] });
rig.push(uprights(back + 0.5, deck + 2, 8, 12, 3.5), one('ledWall', 'wall', [0, deck + 0.5 + 2.5, back + 0.25], { width: 12, height: 5 }));
rig.push(floorHeads(back + 1.5, deck, 8, 8));
rig.push({ line: across(front - 1, 7.3, 6), hang: [{ type: 'laser', count: 4, role: 'laser' }] });
rig.push({ line: across(front - 0.4, deck, 8), hang: [{ type: 'co2', count: 4, role: 'co2' }, { type: 'spark', count: 4, role: 'spark', inset: 0.12 }] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * 10, 0.3, front - 1]));
// lamps at the foot of the canvas all round, so the tent itself takes the colours of the show
for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; rig.push(glow(Math.sin(a) * W / 2 * 0.88, 1, Math.cos(a) * D / 2 * 0.88, { power: 46, reach: 22, bare: true })); }

export default {
  name: 'Big Top', kind: 'Halls', genres: ['trance', 'harddance', 'dnb', 'psytrance', 'techhouse', 'hard', 'mainstage'], capacity: 3000,
  plan: { width: W, depth: D, height: H, shape: 'round' },
  shell: { walls: 'canvas', floor: 'grass', roof: { type: 'tent', rise: RISE }, stripes: 32, parts: [{ type: 'blocks', kind: 'dark', walk: true, list: [[26, 9.5, 0.3, 0, back - 0.3]] }] },   // a black drape closes off backstage
  stage: STAGE, rig,
  crowd: { count: 2200 },
};
