// The Concert Hall: a shoebox of wood and plaster, 26 by 48 metres and 17 high, with a gallery round three sides, an
// organ behind the orchestra and chandeliers over the stalls. The audience sits; the stage is always lit. An invented
// venue.
import { across, along, heads, washes, glow, one } from './kit.js';

const W = 26, D = 48, H = 17, STAGE = { width: 20, depth: 11, height: 1.1, floor: 'wood', pa: 'none', performer: 'orchestra' };
const front = -D / 2 + STAGE.depth;

const rig = [];
for (const z of [front - 2.2, front - 7]) rig.push({ line: across(z, 14.6, 8.4), hang: [washes(8, 0.03)] });   // over the orchestra
rig.push({ line: across(front + 5, 15.6, 9), truss: true, hang: [heads(8)] });   // the lighting bridge, for a gala or a film score
for (const z of [front + 9, front + 20, front + 31]) rig.push(one('chandelier', 'house', [0, 12.6, z], { size: 2, rings: 3, power: 70 }));
for (const s of [-1, 1]) {
  rig.push({ line: along(s * (W / 2 - 3.3), 6.02, front + 2.5, D / 2 - 4.5), hang: [{ type: 'ledBar', count: 8, role: 'bars', props: { length: 3.4, rotY: Math.PI / 2 } }] });   // a line of light under the gallery's edge
  rig.push(glow(s * (W / 2 - 0.9), 9, front + 8, { power: 30, reach: 16, bare: true }), glow(s * (W / 2 - 0.9), 9, front + 24, { power: 30, reach: 16, bare: true }), glow(s * 8.4, 2.2, -D / 2 + 1.2, { power: 26, reach: 12, bare: true }));
}

export default {
  name: 'Concert Hall', kind: 'Concert', genres: ['classical', 'orchestra', 'soundtrack', 'neoclassical'], capacity: 1500,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'panel', floor: 'wood', ceiling: 'plaster', parts: [
    { type: 'balcony', sides: ['left', 'right', 'back'], y: 6.2, depth: 3.4, rows: 2, front: 0xc8b890, kind: 'panel' },
    { type: 'columns', xs: [-W / 2 + 3.4, W / 2 - 3.4], every: 6, z0: front + 4.5, z1: D / 2 - 3.5, r: 0.2, h: 6.05, kind: 'plaster', cap: true },
    { type: 'organ', wall: 'front', width: 10, height: 8.5, y: 3.6 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 900, seated: true, rake: 1.3, seats: 420, chair: 0x5a1218, floor: { x0: -9.3, x1: 9.3, z1: D / 2 - 4.6 } },
};
