// The Hangar: a long industrial hall, 44 by 76 metres and 15 high, with the stage across one short end: steel frames,
// a concrete base, ducts under the roof. An invented venue; any likeness to a real one is not intended.
import { across, along, heads, washes, strobes, bars, blinders, floorHeads, one } from './kit.js';

const W = 44, D = 76, H = 15, STAGE = { width: 26, depth: 8, height: 1.6 };
const front = -D / 2 + STAGE.depth, deck = STAGE.height;

const rig = [];
// five trusses across the hall on winches, each with moving heads, a few wide washes and a row of LED bars
for (let i = 0; i < 5; i++) rig.push({ line: across(front + 6 + i * 10, 11.5, 17), truss: true, moves: true, props: { hangar: true }, hang: [heads(10, 'overhead', { hangar: true }), washes(4), bars(8), ...(i < 3 ? [strobes(4)] : [])] });
// a truss down either side of the hall
for (const s of [-1, 1]) rig.push({ line: along(s * 19.5, 10.5, front + 4, front + 48), truss: true, hang: [heads(9, 'overhead', { hangar: true })] });
// over the front of the stage: blinders at the crowd; over the back: more heads
rig.push({ line: across(front - 0.5, 9.6, 12), truss: true, hang: [blinders(6), strobes(4, 0.3)] });
rig.push({ line: across(front - 6.5, 10.4, 12), truss: true, hang: [heads(10, 'stage', { hangar: true })] });
// on the stage floor, behind the booth and along the front edge
rig.push(floorHeads(front - 5.5, deck, 11, 8, 'stage', { hangar: true }), floorHeads(front - 1, deck, 12, 10, 'stage', { hangar: true }));
rig.push({ line: across(front - 0.4, deck, 11), hang: [{ type: 'co2', count: 4, role: 'co2' }] });
rig.push({ line: across(front - 0.25, deck, 12), hang: [{ type: 'flame', count: 6, role: 'flame' }, { type: 'spark', count: 5, role: 'spark', inset: 0.1 }] });
rig.push({ line: across(front - 6.8, 9.2, 11), hang: [{ type: 'laser', count: 6, role: 'laser' }] });
// the building itself: LED along the frames
rig.push(one('ledArches', 'arch', [0, 0, 0], { every: 9.5, hangar: true }));
// the stage build: a truss tower at each corner, the screen and the strobes over it
for (const s of [-1, 1]) for (const z of [front - 0.6, -D / 2 + 1.2]) rig.push({ line: [[s * 12.6, deck, z], [s * 12.6, H - 0.6, z]], truss: true, hang: [] });
rig.push(one('ledWall', 'wall', [0, deck + 0.6 + 4.2, -D / 2 + 0.5], { width: 22, height: 8.4 }));
rig.push({ line: across(-D / 2 + 0.8, deck + 9.9, 11), hang: [{ type: 'strobe', count: 8, role: 'strobe' }] });
for (const s of [-1, 1]) rig.push(one('hazer', 'hazer', [s * (W / 2 - 2), 0.3, front - 3]));

// What an event in a hall like this is laid out with (parked for now, but for the barrier, the lanes along the walls,
// front of house, the delays and the door; see facilities.js). The entrance is the hangar door's middle. Exits: a double door is
// 2.4 m; as a rule of thumb a hall needs a metre of door for every 135 people, so 4,200 people need 31 m. Ten doors
// and the 8 m entrance give 32 m.
const facilities = [
  { type: 'barrier', pit: 2.6, subs: 14 }, { type: 'corridor', width: 2.2, to: 6, gates: [-24, -10] }, { type: 'wings' }, { type: 'foh', z: front + 28 }, { type: 'platform', x: 8.6, z: front + 28.5 }, { type: 'delays', x: 15.5, z: [front + 32] },
  ...[-24, -10, 4, 30].flatMap(z => [{ type: 'exit', wall: 'left', at: z }, { type: 'exit', wall: 'right', at: z }]),
  { type: 'exit', wall: 'back', at: -15.5 }, { type: 'exit', wall: 'back', at: 15.5 }, { type: 'entrance', wall: 'back', at: 0, width: 8 },
  { type: 'hangarDoor', wall: 'back', at: 0, width: 27, bottom: 0, top: 12.6, number: '4', yard: true },
  { type: 'bar', wall: 'right', from: 8.5, to: 25 }, { type: 'bar', wall: 'left', from: 8.5, to: 25 },
  { type: 'cloakroom', wall: 'back', from: -21.6, to: -17.2 }, { type: 'firstAid', wall: 'back', at: 19.4 }, { type: 'water', wall: 'left', at: 34.6 }, { type: 'toilets', wall: 'right', at: 34.6 },
  { type: 'social', region: { x0: -13, x1: 13, z0: front + 44, z1: front + 58 }, tables: 7, groups: 10 },
];

export default {
  name: 'Hangar', kind: 'Halls', genres: ['techno', 'mainstage', 'hard', 'trance', 'melodic'], capacity: 4200,
  plan: { width: W, depth: D, height: H },
  shell: { walls: 'steel', floor: 'concrete', frames: 9.5, plinth: 2.9, services: true, opening: { wall: 'back', x0: -13.5, x1: 13.5, y0: 0, y1: 12.6, stack: 4.5 } },   // the hangar door's opening, from the floor; its leaves stack 4.5 m deep at either end   // a steel portal frame every 9.5 metres, a concrete base, ducts and sprinklers under the roof
  stage: STAGE, rig, facilities, walkers: 80,
  crowd: { count: 2600 },
};
