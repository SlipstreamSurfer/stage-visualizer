// The Church: a nave of stone, 24 metres wide and 58 long, columns and pointed arches down both sides, coloured glass
// in every bay and behind the altar, a ribbed vault 22 metres up and an organ over the door. Lamps at the foot of the
// columns, a few heads high on the walls that put shafts of light down the nave. A piano when the music flows, decks
// when it has a beat. An invented venue.
import { across, along, heads, washes, floorHeads, glow, one } from './kit.js';

const W = 24, D = 58, H = 17, AISLE = 6.4, BAY = D / 10, STAGE = { width: 10, depth: 9, height: 0.9, floor: 'paving', pa: 'none', riser: false, performer: { beat: 'dj', flow: 'piano' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
for (const s of [-1, 1]) for (const z of [front + 3, front + 15, front + 27]) rig.push(glow(s * (AISLE - 1), 0.4, z, { power: 34, reach: 16 }));
for (const s of [-1, 1]) rig.push({ line: along(s * (AISLE - 0.55), 12.5, front + 4, D / 2 - 10), hang: [heads(6)] });
rig.push({ line: across(front - 3, 10, 4), hang: [washes(4, 0.05)] }, floorHeads(-D / 2 + 1.2, deck, 4, 6));
for (const z of [front + 9, front + 24]) rig.push(one('chandelier', 'house', [0, 11, z], { size: 1.5, rings: 2, power: 50 }));
rig.push({ line: across(-D / 2 + 0.8, 8, 2), hang: [{ type: 'laser', count: 2, role: 'laser' }] }, one('hazer', 'hazer', [-4, deck + 0.1, -D / 2 + 2]));

export default {
  name: 'Church', kind: 'Concert', genres: ['neoclassical', 'ambient', 'melodic', 'classical', 'organic', 'downtempo', 'electronica', 'soundtrack'], capacity: 600,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'stone', floor: 'tiles', roof: { type: 'vault', span: AISLE * 2, rise: 5.2, pointed: true, kind: 'stone', ribs: 'stone', every: BAY, thick: 0.26 }, parts: [
    { type: 'nave', aisle: AISLE, every: BAY, arch: 9.5 },
    { type: 'windows', walls: ['left', 'right'], every: BAY, width: 1.9, height: 5.2, sill: 2.6, kind: 'stained', glow: 1.2, margin: 0 },
    { type: 'windows', walls: ['front'], count: 3, every: 2.9, width: 2.2, height: 9.5, sill: 5, kind: 'stained', glow: 1.7 },   // behind the altar
    { type: 'blocks', kind: 'stone', walk: true, list: [[AISLE * 2 - 0.9, 0.4, 4.4, 0, D / 2 - 2.2, 0, 4.8]] },   // the organ loft, over the door
    { type: 'organ', wall: 'back', width: 8, height: 7.5, y: 5.2 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 520, floor: { x0: -AISLE + 1.1, x1: AISLE - 1.1 } },
};
