// The Amphitheatre: an ancient theatre on a hill over the sea. Fifteen rows of stone seats in a half circle, a flat
// round of paving below them, and across it a stage with what is left of its columns. Under the stars. An orchestra
// when the music flows, decks when it has a beat. An invented venue.
import { heads, washes, floorHeads, glow, goalpost } from './kit.js';

const W = 60, D = 64, STAGE = { width: 24, depth: 9, height: 1.2, floor: 'paving', pa: 'none', riser: false, performer: { beat: 'dj', flow: 'orchestra' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height, MID = front + 3, COLS = [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5];

const rig = [
  ...goalpost(front - 4, 8.4, 12.6, [washes(8, 0.04), heads(8)], 0),
  floorHeads(-D / 2 + 2.8, deck, 10, 8, 'stage', { reach: 110 }),
  ...[-9, -3, 3, 9].map(x => glow(x, deck + 0.4, -D / 2 + 2.6, { power: 40, reach: 14, bare: true })),   // up the columns
  ...[-1, 1].map(s => glow(s * 15, 0.6, MID + 2, { power: 30, reach: 20, bare: true })),
];

export default {
  name: 'Amphitheatre', kind: 'Concert', genres: ['orchestra', 'classical', 'neoclassical', 'soundtrack', 'melodic', 'organic', 'downtempo', 'ambient'], capacity: 2600,
  plan: { width: W, depth: D, height: 9.5 },
  shell: { open: true, floor: 'paving', sky: 'night', wind: [0.5, 0.2], around: [{ type: 'sea', z: -D / 2 - 44, y: -14 }, { type: 'mountains', h: 60, rings: 2 }], parts: [
    { type: 'tiers', arc: { x: 0, z: MID, r: 13, from: -1.75, to: 1.75 }, rows: 15, rise: 0.42, run: 0.85, base: 0.4, kind: 'stone' },
    { type: 'columns', xs: COLS, zs: [-D / 2 + 1.2], r: 0.45, h: 8.5, kind: 'stone', cap: true },
    { type: 'blocks', kind: 'stone', walk: true, list: [[8, 1.1, 1.3, -7.5, -D / 2 + 1.2, 0, 8.5], [8, 1.1, 1.3, 7.5, -D / 2 + 1.2, 0, 8.5]] },   // what the columns still carry
  ] },
  stage: STAGE, rig,
  crowd: { count: 240, seats: 1500, chairs: false, floor: { x0: -11.5, x1: 11.5, z1: MID + 11.5 } },
};
