// The Studio: a small room with a camera in it. The decks stand on the floor in the middle and the crowd is all
// round, most of them behind the DJ, as in a broadcast from somebody's studio. 11 by 15 metres. An invented venue.
import { across, bars, one } from './kit.js';

const W = 11, D = 15, H = 3.8, STAGE = { kind: 'centre', width: 4.4, depth: 1.6, height: 0, z: -1.2 };

const rig = [];
for (const z of [-5, -1, 3]) rig.push({ line: across(z, H - 0.02, 4), hang: [bars(4, 1.5)] });   // tubes on the ceiling
for (const [x, z] of [[-4.2, -5.6], [4.2, -5.6], [-4.2, 5.2], [4.2, 5.2]]) rig.push(one('movingHead', 'overhead', [x, H - 0.55, z]));
for (const s of [-1, 1]) rig.push(one('wash', 'wash', [s * 1.8, H - 0.5, STAGE.z + 1.6]), one('strobe', 'strobe', [s * 3, H - 0.25, STAGE.z - 3]));
rig.push(one('mirrorBall', 'ball', [0, H - 0.6, 2.8]));

export default {
  name: 'Studio', kind: 'Clubs', genres: ['ukg', 'breaks', 'djtools', 'house', 'bassclub', 'techhouse', 'deepdubstep', 'jackin'], capacity: 120,
  plan: { width: W, depth: D, height: H },
  shell: { walls: { all: 'dark', front: 'whitebrick' }, floor: 'wood', ceiling: 'dark', parts: [
    { type: 'speakers', x: -4.2, z: -D / 2 + 0.6, width: 1.2, height: 1.8 }, { type: 'speakers', x: 4.2, z: -D / 2 + 0.6, width: 1.2, height: 1.8 },
  ] },
  stage: STAGE, rig,
  crowd: { count: 110, even: true },
};
