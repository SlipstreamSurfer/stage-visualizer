// Kit: the handful of shapes a rig is drawn from, so that a venue's file reads as a list of what hangs where.
const TAU = Math.PI * 2;
export const across = (z, y, half) => [[-half, y, z], [half, y, z]];
export const along = (x, y, z0, z1) => [[x, y, z0], [x, y, z1]];
// what hangs on a truss: so many of a kind, spread along it
export const heads = (count, role = 'overhead', props) => ({ type: 'movingHead', count, role, dy: -0.35, ...(props ? { props } : {}) });
export const washes = (count, inset = 0.18) => ({ type: 'wash', count, role: 'wash', dy: -0.3, inset });
export const strobes = (count, inset = 0.25) => ({ type: 'strobe', count, role: 'strobe', dy: -0.3, inset });
export const bars = (count, length = 1.6, inset = 0.11) => ({ type: 'ledBar', count, role: 'bars', dy: -0.28, inset, props: { length } });
export const blinders = count => ({ type: 'blinder', count, role: 'blinder', dy: -0.35 });
// heads standing in a row on the floor of a stage, at height y
export const floorHeads = (z, y, half, count, role = 'stage', props = {}) => ({ line: across(z, y, half), hang: [{ type: 'movingHead', count, role, props: { stand: true, ...props } }] });
// LED bars standing on end in a row
export const uprights = (z, y, half, count, length) => ({ line: across(z, y, half), hang: [{ type: 'ledBar', count, role: 'bars', props: { length, upright: true } }] });
// a ring of n straight trusses of radius r at height y round (0, z); load(i): what hangs on the i-th
export const ring = (r, y, n, load, z = 0, truss = true) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, b = (i + 1) / n * TAU; return { line: [[Math.sin(a) * r, y, z + Math.cos(a) * r], [Math.sin(b) * r, y, z + Math.cos(b) * r]], truss, hang: load(i) }; });
// A whole ring moves as one assembly; its truss sections and lamps share the same mount.
export const movingRing = (r, y, n, load, props) => [
  { at: [0, y, 0], type: 'truss', role: 'truss', moves: true, id: props.bank, props: { kind: 'ring', radius: r, sides: n, ...props } },
  ...ring(r, y, n, load).map(item => ({ ...item, mount: props.bank })),
];
// LED round such a ring, under its inner chord
export const ledRing = (r, y, n, z = 0) => ({ at: [0, y - 0.25, z], type: 'ledRing', role: 'rings', props: { radius: r, sides: n, per: 3 } });
// a lamp that washes the building; a string of lamps from a to b; one thing in one place
export const glow = (x, y, z, props = {}) => ({ at: [x, y, z], type: 'glow', role: 'glow', props });
export const festoon = (a, b, props = {}) => ({ at: a, type: 'festoon', role: 'festoon', props: { to: b, ...props } });
export const one = (type, role, at, props = {}) => ({ at, type, role, props });
// a goalpost: two towers and a truss between them, with what hangs on it
export const goalpost = (z, y, half, load, floor = 0) => [{ line: [[-half, floor, z], [-half, y, z]], truss: true, hang: [] }, { line: [[half, floor, z], [half, y, z]], truss: true, hang: [] }, { line: across(z, y, half), truss: true, hang: load }];
