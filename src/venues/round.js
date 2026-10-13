// In the Round: a round hall 46 metres across with the stage in the middle and the crowd on every side. Two rings of
// truss overhead, a chandelier of LED bars on winches over the decks, a ring of light round the wall. An invented
// venue.
import { ring, heads, washes, strobes, one } from './kit.js';

const W = 46, H = 13, STAGE = { kind: 'centre', round: true, width: 9, depth: 9, height: 1.3 };
const bar = (length, extra = {}) => ({ type: 'ledBar', count: 1, role: 'bars', props: { length, ...extra } });

const rig = [
  ...ring(7, 9.5, 8, () => [heads(3), { type: 'ledBar', count: 2, role: 'bars', dy: -0.28, props: { length: 1.6 } }, { type: 'blinder', count: 1, role: 'blinder', dy: -0.35 }]),
  ...ring(15, 10.5, 12, i => [heads(3), i % 2 ? strobes(2, 0.3) : washes(2, 0.3)]),
  one('kinetic', 'kinetic', [0, H - 1, 0], { cols: 8, rows: 8, width: 12, depth: 12, travel: 4.5 }),
  ...ring(4.3, STAGE.height, 8, () => [{ type: 'movingHead', count: 1, role: 'stage', props: { stand: true } }], 0, false),
  ...ring(22.4, 3, 24, () => [bar(5, { upright: true })], 0, false),
  ...ring(4.5, STAGE.height, 4, () => [{ type: 'co2', count: 1, role: 'co2' }], 0, false),
  one('laser', 'laser', [0, 9.2, -6]), one('laser', 'laser', [0, 9.2, 6]),
  one('hazer', 'hazer', [3, STAGE.height + 0.1, 3]),
];

export default {
  name: 'In the Round', kind: 'Halls', genres: ['techhouse', 'melodic', 'progressive', 'techno', 'house', 'minimal', 'hypnotic'], capacity: 2200,
  plan: { width: W, depth: W, height: H, shape: 'round' },
  shell: { walls: 'concrete', floor: 'concrete' },
  stage: STAGE, rig,
  crowd: { count: 1500 },
};
