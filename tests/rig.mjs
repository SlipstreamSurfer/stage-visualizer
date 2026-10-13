// A small synthetic rig for shared lighting, ring and camera checks.
import { movingRing, heads, washes, strobes, one } from '../src/venues/kit.js';
export const TEST_VENUE = {
  name: 'Synthetic hall', kind: 'Halls', genres: ['techno'],
  plan: { width: 24, depth: 24, height: 12, shape: 'round' },
  shell: { walls: 'concrete', floor: 'concrete', roof: { type: 'cone', rise: 2 } },
  stage: { width: 6, depth: 3, height: 1 }, crowd: { count: 0 },
  rig: [
    ...movingRing(3, 9, 6, () => [heads(1), washes(1)], { bank: 'inner', maxDrop: 1, speed: 0.2, acceleration: 0.05 }),
    ...movingRing(6, 9.5, 8, () => [heads(1), strobes(1)], { bank: 'outer', maxDrop: 1, speed: 0.2, acceleration: 0.05 }),
    one('ledCoil', 'coil', [0, 9, 0], { radius: 3, segments: 24, direction: 1, bank: 'inner' }),
    one('ledCoil', 'coil', [0, 9.5, 0], { radius: 6, segments: 32, direction: -1, bank: 'outer' }),
    one('movingHead', 'stage', [0, 2, -8]),
    one('roofLED', 'roof', [0, 10, 0]),
    one('co2', 'co2', [1, 1, -8]),
    one('glow', 'glow', [0, 4, 10]),
  ],
};
