// The Ice: a frozen lake far north, snow on it, mountains round it and the northern lights over the far shore. A low
// stage under an arch of cold light, beams into the sky, lamps that turn the snow a colour. A piano when the music
// flows. An invented venue.
import { heads, bars, uprights, floorHeads, glow, goalpost, one } from './kit.js';

const W = 60, D = 70, STAGE = { width: 10, depth: 5, height: 0.6, pa: 'stacks', performer: { beat: 'dj', flow: 'piano' } };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [
  ...goalpost(front - 0.4, 6.5, 5.6, [heads(8), bars(8, 1.2)]),
  uprights(-D / 2 + 0.5, deck + 2, 4.4, 11, 3.6), floorHeads(front - 3.6, deck, 4.2, 8, 'stage', { reach: 130 }),
  ...[[-20, front + 10], [20, front + 10], [-20, front + 40], [20, front + 40]].map(([x, z]) => one('movingHead', 'stage', [x, 0.3, z], { stand: true, reach: 130 })),
  ...[[-9, front + 3], [9, front + 3], [-14, front + 24], [14, front + 24]].map(([x, z]) => glow(x, 1.2, z, { power: 60, reach: 26, bare: true })),
  { line: [[-4, 6.1, front - 0.4], [4, 6.1, front - 0.4]], hang: [{ type: 'laser', count: 3, role: 'laser' }] },
];

export default {
  name: 'Ice', kind: 'Open air', genres: ['ambient', 'trancedeep', 'neoclassical', 'electronica', 'melodic', 'progressive', 'downtempo', 'soundtrack'], capacity: 800,
  plan: { width: W, depth: D, height: 9 },
  shell: { open: true, floor: 'snow', sky: 'aurora', wind: [0.4, 0.1], around: [{ type: 'mountains', h: 120, rings: 3, snow: true }] },
  stage: STAGE, rig,
  crowd: { count: 500 },
};
