// The Club: a low, dark room for 450 people, 18 by 28 metres under a 4.8 metre ceiling. The booth stands on a low
// stage at one end, close to the floor. The same blueprint as the Hangar with other numbers and other things in it:
// a ceiling of LED tubes instead of trusses on winches, a mirror ball, speakers stacked on the floor, pillars, a bar
// down one side and a ledge for drinks down the other. An invented venue.
const W = 18, D = 28, H = 4.8, STAGE = { width: 7.5, depth: 3.4, height: 0.5 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;
const across = (z, y, half) => [[-half, y, z], [half, y, z]];

const rig = [];
// three bars of lights across the room, close under the ceiling
for (let i = 0; i < 3; i++) rig.push({ line: across(front + 2.5 + i * 6.5, 4.35, 6.2), truss: true, hang: [
  { type: 'movingHead', count: 5, role: 'overhead', dy: -0.3 },
  { type: 'wash', count: 2, role: 'wash', dy: -0.25, inset: 0.3 },
  { type: 'ledBar', count: 4, role: 'bars', dy: -0.25, inset: 0.12, props: { length: 1.3 } },
  ...(i < 2 ? [{ type: 'strobe', count: 2, role: 'strobe', dy: -0.25, inset: 0.32 }] : []),
] });
// behind the DJ: a row of LED bars standing on end, so the back wall is light without a screen; a small screen for
// who wants it; heads on the stage floor
rig.push({ line: across(-D / 2 + 0.35, deck + 1.7, 3.3), hang: [{ type: 'ledBar', count: 9, role: 'bars', props: { length: 2.4, upright: true } }] });
rig.push({ at: [0, deck + 0.5 + 1.25, -D / 2 + 0.2], type: 'ledWall', role: 'wall', props: { width: 6, height: 2.5 } });
for (const s of [-1, 1]) rig.push({ line: [[s * 2.3, deck, front - 2.9], [s * 3.5, deck, front - 2.9]], hang: [{ type: 'movingHead', count: 2, role: 'stage', props: { stand: true } }] });   // either side of the DJ, not behind
rig.push({ line: across(front - 0.3, 4.3, 3), hang: [{ type: 'blinder', count: 2, role: 'blinder' }, { type: 'strobe', count: 2, role: 'strobe', inset: 0.35 }] });
rig.push({ line: across(front - 0.25, deck, 3), hang: [{ type: 'co2', count: 2, role: 'co2' }] });
rig.push({ at: [0, 4.2, front - 3], type: 'laser', role: 'laser' });
// over the floor: a ceiling of LED tubes that barely move, and a mirror ball
rig.push({ at: [0, H - 0.3, front + 10], type: 'kinetic', role: 'kinetic', props: { cols: 6, rows: 10, width: 10.5, depth: 17, travel: 0.45 } });
rig.push({ at: [0, 4.2, front + 6], type: 'mirrorBall', role: 'ball' });
rig.push({ at: [0, 0, 0], type: 'ledArches', role: 'arch', props: { every: 7 } });
rig.push({ at: [-3.4, deck + 0.2, -D / 2 + 0.8], type: 'hazer', role: 'hazer' });

export default {
  name: 'Club', kind: 'Clubs', genres: ['house', 'techhouse', 'deephouse', 'jackin', 'minimal', 'techno'], capacity: 450,
  // two emergency doors and the entrance give 7.2 m of door; 450 people need 3.4 m
  facilities: [
    { type: 'exit', wall: 'left', at: 10.5 }, { type: 'exit', wall: 'right', at: -6.4 },
    { type: 'entrance', wall: 'back', at: -5, width: 2.4 },
    { type: 'cloakroom', wall: 'back', from: 0.4, to: 5.2 },
    { type: 'bar', wall: 'right', from: -2.6, to: 8, depth: 1.5 },
    { type: 'toilets', wall: 'right', at: 11.4 },
    { type: 'ledge', wall: 'left', from: -6, to: 7 },
    { type: 'water', wall: 'left', at: -8.6 },
    { type: 'stacks', at: [[-8.2, 12.9], [8.2, 13.3]] },   // the rear half of a four-point system; the front half stands beside the stage
    { type: 'social', region: { x0: -6.5, x1: 2.5, z0: 8.8, z1: 10.2 }, tables: 2, groups: 2 },
  ],
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'brick', floor: 'concrete', frames: 7, services: true, pillars: [[-3.2, -1.5], [3.2, -1.5], [-3.2, 6.5]] },
  stage: STAGE,
  rig,
  walkers: 16, walkPath: [[4.3, front + 2.6], [4.3, 12], [-6.9, 12]],   // past the bar and along the back, to the cloakroom and the way out
  crowd: { count: 420 },
};
