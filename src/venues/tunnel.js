// The Tunnel: a railway arch, 11 metres wide and 72 long, a brick vault all the way. Rings of light every few metres,
// heads and strobes along the crown, lasers looking down its length. An invented venue.
import { across, along, heads, strobes, uprights, floorHeads, one } from './kit.js';

const W = 11, D = 72, H = 2.2, RISE = 5.5, STAGE = { width: 8, depth: 4, height: 0.9, pa: 'stacks' };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [one('ledArches', 'arch', [0, 0, 0], { every: 3.6 })];
for (const s of [-1, 1]) rig.push({ line: along(s * 1.7, 6.5, front + 3, D / 2 - 6), truss: true, hang: [heads(9), strobes(5, 0.05)] });
rig.push({ line: across(-D / 2 + 0.6, 5, 3), hang: [{ type: 'laser', count: 4, role: 'laser' }] });
rig.push({ line: across(-D / 2 + 0.4, deck + 2.7, 3.2), hang: [{ type: 'blinder', count: 4, role: 'blinder' }, { type: 'strobe', count: 3, role: 'strobe', inset: 0.2 }] });
rig.push(uprights(-D / 2 + 0.3, deck + 1.4, 3.4, 8, 2.4), floorHeads(front - 2.8, deck, 3.4, 6));
rig.push({ line: across(front - 0.4, deck, 3), hang: [{ type: 'co2', count: 2, role: 'co2' }] });
rig.push(one('hazer', 'hazer', [-4.6, 0.3, front + 4]), one('hazer', 'hazer', [4.6, 0.3, front + 30]));

export default {
  name: 'Tunnel', kind: 'Halls', genres: ['hypnotic', 'deep', 'dnb', 'trancedeep', 'techno', 'psytrance', 'deepdubstep'], capacity: 900,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'brick', floor: 'concrete', roof: { type: 'vault', rise: RISE, kind: 'brick' } },
  stage: STAGE, rig,
  crowd: { count: 800 },
};
