// The Turbine Hall: what is left of a power station. 22 metres wide, 84 long and 27 high, bare concrete, windows as
// tall as a house, a gantry crane still on its rails under the roof. Towers of light stand along both walls and the
// frames of the building are outlined in LED. An invented venue.
import { across, heads, washes, floorHeads, one } from './kit.js';

const W = 22, D = 84, H = 27, STAGE = { width: 16, depth: 7, height: 1.4 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [one('ledArches', 'arch', [0, 0, 0], { every: 10.5 })];
for (const s of [-1, 1]) for (let i = 0; i < 4; i++) rig.push({ line: [[s * 8.8, 0, front + 7 + i * 16], [s * 8.8, 16, front + 7 + i * 16]], truss: true, hang: [{ type: 'ledBar', count: 5, role: 'bars', inset: 0.12, props: { length: 2.6, upright: true } }, { type: 'strobe', count: 2, role: 'strobe', inset: 0.32 }] });
for (let i = 0; i < 4; i++) rig.push({ line: across(front + 8 + i * 14, 17, 8.6), truss: true, hang: [heads(8), washes(2, 0.3)] });
rig.push({ line: across(-D / 2 + 0.5, deck + 11, 6), hang: [{ type: 'strobe', count: 8, role: 'strobe' }] }, { line: across(front - 0.5, 14, 7), truss: true, hang: [{ type: 'blinder', count: 6, role: 'blinder', dy: -0.35 }, heads(8, 'stage')] });
rig.push(one('ledWall', 'wall', [0, deck + 0.5 + 4.6, -D / 2 + 0.45], { width: 11, height: 9.2 }));
rig.push(floorHeads(front - 5, deck, 7, 8), floorHeads(front - 0.9, deck, 7.2, 8));
rig.push({ line: across(front - 3, 13.6, 6), hang: [{ type: 'laser', count: 5, role: 'laser' }] });
rig.push({ line: across(front - 0.4, deck, 7), hang: [{ type: 'co2', count: 4, role: 'co2' }, { type: 'flame', count: 4, role: 'flame', inset: 0.14 }] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * (W / 2 - 1.5), 0.3, front - 2]));

export default {
  name: 'Turbine Hall', kind: 'Halls', genres: ['hard', 'raw', 'techno', 'harddance', 'electro', 'dnb', 'hypnotic', 'dubstep'], capacity: 2400,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'concrete', floor: 'concrete', frames: 10.5, parts: [
    { type: 'windows', walls: ['left', 'right'], every: 10.5, width: 3, height: 15, sill: 7, kind: 'night', glow: 1.4 },
    { type: 'blocks', kind: 'steel', walk: true, list: [[W - 0.6, 1.6, 1.2, 0, 6, 0, 21.4], [W - 0.6, 1.6, 1.2, 0, 13, 0, 21.4], [3, 2.2, 8.2, 2.5, 9.5, 0, 19.3], [0.5, 0.8, D - 2, -W / 2 + 0.6, 0, 0, 20.6], [0.5, 0.8, D - 2, W / 2 - 0.6, 0, 0, 20.6]] },   // the crane: two beams across on their rails, and the trolley between them
  ] },
  stage: STAGE, rig,
  crowd: { count: 1900 },
};
