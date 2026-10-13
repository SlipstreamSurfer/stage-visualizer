// The Street: a street closed for the night. House fronts either side with lamps on them, strings of coloured lamps
// overhead from end to end, and at the far end a sound system: two towers of speakers with the decks between them.
// 13 metres wide, 66 long. An invented venue.
import { across, heads, washes, strobes, bars, uprights, floorHeads, glow, festoon, goalpost } from './kit.js';

const W = 13, D = 66, STAGE = { width: 8, depth: 3.4, height: 1, pa: 'none' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [
  ...Array.from({ length: 9 }, (_, i) => festoon([-W / 2, 6.4, front + 3 + i * 6.6], [W / 2, 6.4, front + 5 + i * 6.6], { sag: 1, party: true })),
  ...[-1, 1].flatMap(s => [5, 22, 39].map(z => glow(s * (W / 2 - 0.6), 4.5, front + z + s * 4, { power: 45, reach: 17 }))),
  ...goalpost(front - 0.3, 5.6, 4.2, [heads(6), strobes(2, 0.35), washes(2, 0.25)]),
  floorHeads(-D / 2 + 0.8, deck, 3.2, 6), uprights(-D / 2 + 0.4, deck + 1.3, 3.4, 7, 2.2),
  ...goalpost(front + 15, 7, W / 2 - 0.5, [heads(4), bars(4, 1.2)]), ...goalpost(front + 32, 7, W / 2 - 0.5, [heads(4), bars(4, 1.2)]),
  { line: across(front + 1, 5.4, 3.6), hang: [{ type: 'confetti', count: 3, role: 'confetti' }] },
  { line: across(front - 0.4, deck, 3.4), hang: [{ type: 'co2', count: 2, role: 'co2' }] },
];

export default {
  name: 'Street', kind: 'Open air', genres: ['brazilianfunk', 'caribbean', 'latin', 'african', 'amapiano', 'afro', 'ukg', 'hiphop', 'bassclub', 'pop'], capacity: 1200,
  plan: { width: W, depth: D, height: 8 },
  shell: { open: true, floor: 'asphalt', sky: 'city', wind: [0.3, 0.6], around: [{ type: 'houses', h: [9, 14] }, { type: 'skyline', count: 50 }], parts: [
    { type: 'speakers', x: -5.3, z: front + 0.9, width: 2.3, height: 4.5 }, { type: 'speakers', x: 5.3, z: front + 0.9, width: 2.3, height: 4.5 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 700 },
};
