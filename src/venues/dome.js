// The Dome: a round room 38 metres across under a dome that is one screen, the picture laid out round the top as in a
// planetarium. A low round platform in the middle, lamps on the floor that reach up the dome. A place to lie back in.
// An invented venue.
import { ring, glow, one } from './kit.js';

const W = 38, H = 3, RISE = 15, STAGE = { kind: 'centre', round: true, width: 7, depth: 7, height: 0.5, performer: { beat: 'dj', flow: 'piano' } };
const TAU = Math.PI * 2;

const rig = [
  one('ledWall', 'dome', [0, H, 0], { dome: { rx: W / 2 - 0.15, rz: W / 2 - 0.15, rise: RISE - 0.15 } }),
  ...ring(16.8, 0.3, 12, () => [{ type: 'movingHead', count: 1, role: 'stage', props: { stand: true, reach: 30 } }], 0, false),
  ...ring(3.1, STAGE.height, 6, () => [{ type: 'movingHead', count: 1, role: 'stage', props: { stand: true, reach: 30 } }], 0, false),
  ...Array.from({ length: 6 }, (_, i) => glow(Math.sin(i / 6 * TAU) * 17.6, 0.5, Math.cos(i / 6 * TAU) * 17.6, { power: 12, reach: 12 })),
  one('laser', 'laser', [0, 2.2, -2.4]), one('hazer', 'hazer', [2, STAGE.height + 0.1, -2]),
];

export default {
  name: 'Dome', kind: 'Halls', genres: ['ambient', 'electronica', 'trancedeep', 'downtempo', 'psytrance', 'soundtrack', 'neoclassical', 'melodic'], capacity: 700,
  plan: { width: W, depth: W, height: H, shape: 'round' },
  shell: { walls: 'dark', floor: 'dark', roof: { type: 'dome', rise: RISE, screen: true } },
  stage: STAGE, rig,
  crowd: { count: 600, even: true },
};
