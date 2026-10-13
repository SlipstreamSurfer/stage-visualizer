// The Car Park: the fourth level of a multi-storey, cleared for the night. A low slab on rows of columns, bays painted
// on the asphalt, tubes on the ceiling, and two sides open to the city. Stacks of speakers and a DJ on a low riser.
// 34 by 52 metres, 3.1 high. An invented venue.
import { across, bars, strobes, blinders, floorHeads, glow, one } from './kit.js';

const W = 34, D = 52, H = 3.1, STAGE = { width: 9, depth: 3.2, height: 0.5, pa: 'stacks' };
const front = -D / 2 + STAGE.depth;

const rig = [];
for (let i = 0; i < 6; i++) rig.push({ line: across(front + 3 + i * 7.6, H - 0.05, 14), hang: [bars(8, 1.5), ...(i < 3 ? [strobes(4, 0.1)] : [])] });   // strip lights, and strobes among them
rig.push(floorHeads(-D / 2 + 0.6, STAGE.height, 4, 6));
for (const [x, z] of [[-9, front + 2], [9, front + 2], [-12, front + 16], [12, front + 16]]) rig.push(one('movingHead', 'stage', [x, 1.1, z], { stand: true }));   // on flight cases round the floor
rig.push({ line: across(front - 0.4, 2.75, 4), hang: [blinders(4)] });
for (const s of [-1, 1]) rig.push(one('laser', 'laser', [s * 3, 2.5, front - 0.5]), glow(s * 10, 2.6, front + 9, { power: 16, reach: 13, bare: true }));
rig.push(one('hazer', 'hazer', [-6, 0.2, front - 1]));

const bays = [];
for (const s of [-1, 1]) for (let z = front + 5; z < D / 2 - 2; z += 2.5) bays.push([4.8, 0.012, 0.12, s * (W / 2 - 2.9), z]);   // parking bays down both sides

export default {
  name: 'Car Park', kind: 'Clubs', genres: ['deepdubstep', 'ukg', 'hiphop', 'trap', 'bassclub', 'breaks', 'dubstep', 'dnb'], capacity: 900,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'concrete', wallSet: ['front', 'left'], floor: 'asphalt', ceiling: 'concrete', sky: 'city', around: [{ type: 'skyline', drop: 14 }], parts: [
    { type: 'beams', every: 5.2, depth: 0.55, width: 0.45 },
    { type: 'columns', xs: [-12, -4.2, 4.2, 12], every: 7.8, z0: front + 5, r: 0.3, square: true },
    { type: 'blocks', list: [[0.25, 1.1, D, W / 2 - 0.12, 0], [W, 1.1, 0.25, 0, D / 2 - 0.12]], walk: true },   // parapets on the open sides
    { type: 'blocks', kind: 'plaster', walk: true, list: bays },
    { type: 'speakers', x: -5.6, z: front + 0.7, width: 2.4, height: 2.7 }, { type: 'speakers', x: 5.6, z: front + 0.7, width: 2.4, height: 2.7 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 700 },
};
