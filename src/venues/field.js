// The Field: an open-air main stage at night. A fenced field of 70 by 110 metres for 12,000 people, a covered stage
// 34 metres wide, towers of sound and light halfway down the field, bars and food along the sides, and the sky over
// all of it. No walls and no roof: the same blueprint as the indoor venues with `open` set. An invented venue.
const W = 70, D = 110, ROOF = 17, STAGE = { width: 34, depth: 13, height: 2.4 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;
const across = (z, y, half) => [[-half, y, z], [half, y, z]];

const rig = [];
// the stage roof: a tower at each corner and trusses between them
for (const s of [-1, 1]) for (const z of [front - 0.8, -D / 2 + 0.9]) rig.push({ line: [[s * 16.5, deck, z], [s * 16.5, ROOF, z]], truss: true, hang: [] });
// the back of the stage is a wall of light: three rows of heads, with LED bars standing between them
for (const [y, n] of [[6.5, 12], [10.5, 12], [14.5, 12]]) rig.push({ line: across(-D / 2 + 1.4, y, 15), truss: true, hang: [
  { type: 'movingHead', count: n, role: 'stage', dy: -0.35 },
  { type: 'strobe', count: 4, role: 'strobe', dy: 0.3, inset: 0.2 },
] });
rig.push({ line: across(-D / 2 + 1.1, deck + 5.5, 14), hang: [{ type: 'ledBar', count: 15, role: 'bars', props: { length: 7, upright: true } }] });
rig.push({ at: [0, deck + 1 + 5.5, -D / 2 + 0.6], type: 'ledWall', role: 'wall', props: { width: 26, height: 11 } });
// over the front of the stage: blinders and washes for the crowd, strobes, confetti
rig.push({ line: across(front - 1, ROOF - 0.6, 16), truss: true, hang: [
  { type: 'blinder', count: 10, role: 'blinder', dy: -0.4 },
  { type: 'wash', count: 6, role: 'wash', dy: -0.35, inset: 0.15 },
  { type: 'strobe', count: 6, role: 'strobe', dy: -0.3, inset: 0.22 },
  { type: 'ledBar', count: 10, role: 'bars', dy: -0.3, inset: 0.08, props: { length: 2.4 } },
  { type: 'confetti', count: 4, role: 'confetti', dy: -0.5, inset: 0.2 },
] });
rig.push({ line: across(front - 6, ROOF - 0.6, 16), truss: true, hang: [{ type: 'movingHead', count: 12, role: 'stage', dy: -0.35 }, { type: 'laser', count: 6, role: 'laser', dy: -0.4, inset: 0.15 }] });
// on the stage floor and its front edge
rig.push({ line: across(front - 9, deck, 14), hang: [{ type: 'movingHead', count: 10, role: 'stage', props: { stand: true } }] });
rig.push({ line: across(front - 0.6, deck, 15), hang: [{ type: 'co2', count: 8, role: 'co2' }, { type: 'spark', count: 7, role: 'spark', inset: 0.1 }, { type: 'flame', count: 6, role: 'flame', inset: 0.16 }] });
// on top of the roof: beams into the sky, and behind the stage the fireworks
rig.push({ line: across(front - 2, ROOF + 0.9, 15), hang: [{ type: 'movingHead', count: 8, role: 'stage', props: { stand: true, reach: 120 } }] });
rig.push({ line: across(-D / 2 - 6, 1, 26), hang: [{ type: 'firework', count: 9, role: 'firework', props: { rise: 46, reach: 20 } }] });
rig.push({ line: across(-D / 2 - 9, 1, 18), hang: [{ type: 'firework', count: 5, role: 'firework', props: { rise: 62, reach: 26 } }] });
// beside the stage, over the PA: heads that reach out over the crowd; and two towers halfway down the field
for (const s of [-1, 1]) {
  rig.push({ line: [[s * 19, ROOF - 2, front + 0.5], [s * 25, ROOF - 2, front + 0.5]], truss: true, hang: [{ type: 'movingHead', count: 5, role: 'overhead', dy: -0.35 }] });
  rig.push({ line: [[s * 17 - 1.6, 13.6, front + 46], [s * 17 + 1.6, 13.6, front + 46]], truss: true, hang: [{ type: 'movingHead', count: 4, role: 'overhead', dy: -0.35 }, { type: 'strobe', count: 2, role: 'strobe', dy: 0.25, inset: 0.3 }] });
  rig.push({ at: [s * 30, 0.3, front - 2], type: 'hazer', role: 'hazer' });
}

export default {
  name: 'Field · Main stage', kind: 'Open air', genres: ['mainstage', 'trance', 'dancepop', 'harddance', 'techno'], capacity: 12000,
  // six gates of 10 m and an entrance of 40 m: 100 m to leave by, where 12,000 people need 89 m
  facilities: [
    { type: 'stageRoof', height: ROOF },
    { type: 'barrier', pit: 3.4, subs: 20 },
    { type: 'foh', z: front + 40 },
    { type: 'platform', x: 10, z: front + 41 },
    { type: 'tower', x: -17, z: front + 46, height: 13 }, { type: 'tower', x: 17, z: front + 46, height: 13 },
    ...[-30, 22, 46].flatMap(z => [{ type: 'exit', wall: 'left', at: z, width: 10 }, { type: 'exit', wall: 'right', at: z, width: 10 }]),
    { type: 'entrance', wall: 'back', at: 0, width: 40 },
    { type: 'bar', wall: 'left', from: -4, to: 14 }, { type: 'bar', wall: 'right', from: -4, to: 14 },
    { type: 'stalls', wall: 'left', from: -22, to: -8 }, { type: 'stalls', wall: 'right', from: -22, to: -8 },
    { type: 'toiletRow', wall: 'back', from: -33, to: -22.5 },
    { type: 'firstAid', wall: 'back', at: 27.5 },
    { type: 'water', wall: 'left', at: 34.5 }, { type: 'water', wall: 'right', at: 34.5 },
    { type: 'social', region: { x0: -24, x1: 24, z0: front + 62, z1: front + 82 }, tables: 12, groups: 18 },
  ],
  plan: { width: W, depth: D, height: ROOF + 1 },
  shell: { open: true, floor: 'grass', wind: [0.9, 0.5], sky: 'night', around: ['trees', 'wheel'] },
  stage: STAGE,
  rig,
  walkers: 110,
  crowd: { count: 3600 },
};
