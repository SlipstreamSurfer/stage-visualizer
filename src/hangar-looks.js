// Hangar's hall heads are programmed the way a lighting desk does it. A look combines five things:
//   position  where the beams point: (f, p, k, s) => [x, y, z], a point in the hall
//   move      an effect on top of it: (target, f, p, k, s) => the target, moved
//   gate      which heads are lit: (f, beats) => true or false; the lit ones get brighter by GATE_GAIN
//   colour    how the two show colours are spread: (f, beats) => [share of the second colour, share of white]
//   beam      narrow, wide or broken up by a gobo
// f is the head (u: its place along the truss 0..1, row: which truss, xn: -1 at the left wall to 1 at the right,
// rp and rt: random numbers that change every eight kicks), p where it hangs now (its truss can be lower than
// planned), k the director's clocks (m runs with the music, phase counts beats) and s the part of the track, the
// build, the energy, the drop and where the stage is. Every look works in every mood: the clocks carry the tempo.
const TAU = Math.PI * 2, clamp = x => Math.max(0, Math.min(1, x));
const HALL = { x: 21.5, z0: -30, z1: 36, roof: 14.6 };   // inside the walls, from the stage front to the back
const sideOf = p => Math.sign(p[0]) || 1, onSide = p => Math.abs(p[0]) > 18;   // a head on a truss down the side
const depth = p => clamp((p[2] - HALL.z0) / (HALL.z1 - HALL.z0)), across = p => clamp((p[0] + HALL.x) / (HALL.x * 2));
const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// The existing floor scan: beams in depth zones across the hall; builds and peaks lift a share to the roof.
export function floorTarget(f, k, beat, section, build, energy, drop) {
  const pos = f.livePos || f.pos, bar = Math.floor(beat / 16) % 4;
  const zone = ((Math.floor((pos[2] + 30) / 10) + bar) % 5 + 5) % 5;
  // pan on a slow show clock, not the kick phase: a 125 BPM beat made beams snap side to side
  const sway = Math.sin(k.m * 0.55 + Math.abs(f.pos[0]) * 0.07 + f.pos[2] * 0.03);
  const roof = section === 'break' ? clamp(build * 0.5) : section === 'peak' ? clamp(0.28 + energy * 0.42 + drop * 0.45) : 0;
  const side = Math.sign(f.xn || 1), x = side * (Math.abs(f.xn) * 5 + sway * 7) * (k.hangarLook === 1 ? -1 : 1);
  return [x * (1 - roof) + side * (19 + sway * 2) * roof, 0.35 + roof * 13.8, -16 + zone * 11.5 + sway * 2];
}

export const POSITIONS = {
  floor: (f, p, k, s) => floorTarget(f, k, s.beat, s.section, s.build, s.energy, s.drop),
  down: (f, p) => [p[0], 0, p[2]],   // straight down
  // each hall truss spreads a fan of beams across its own width, up to 80 degrees out; the side trusses look down
  curtain: (f, p, k) => {
    if (onSide(p)) return [p[0] - sideOf(p) * 3, 0, p[2]];
    const a = (f.u * 2 - 1) * 1.4 + 0.25 * Math.sin(k.m * 0.3 + f.row * 0.8);
    return [p[0] + Math.sin(a) * 30, p[1] - Math.cos(a) * 30, p[2]];
  },
  fan: (f, p) => onSide(p) ? [-sideOf(p) * 8, 0.5, p[2] + (f.u - 0.5) * 18] : [f.xn * 24, 2, p[2] + 5],   // out towards the walls
  cross: (f, p) => onSide(p) ? [-sideOf(p) * 14, 1, p[2]] : [-f.xn * 15, 0.8, p[2]],   // left to the right, right to the left
  converge: (f, p, k, s) => [Math.sin(k.m * 0.25) * 5, 3 + 2 * Math.sin(k.m * 0.4), s.stage + 2 * Math.sin(k.m * 0.3)],   // over the booth
  // up and out under the roof: long beams through the top of the hall, the trusses taking turns forwards and back
  sky: (f, p) => onSide(p) ? [-sideOf(p) * 12, p[1] + 3.5, p[2]] : [p[0] * 1.8, p[1] + 3.2, p[2] + (f.row % 2 ? 18 : -18)],
  rakeStage: (f, p) => [p[0] * 0.8, 0.5, p[2] - 14],   // leaning towards the stage
  rakeBack: (f, p) => [p[0] * 0.8, 0.5, p[2] + 14],   // leaning towards the back of the hall
  walls: (f, p) => onSide(p) ? [-sideOf(p) * HALL.x, 6, p[2]] : [sideOf(p) * HALL.x, 5 + f.u * 2, p[2] + (f.u - 0.5) * 6],   // onto the walls
  // a tunnel to the stage: every head aims at a ring around the middle of the hall, closer to the stage
  tunnel: (f, p, k, s) => { const a = (f.u + (onSide(p) ? 0.5 : 0)) * TAU + f.row * 0.7; return [Math.cos(a) * 9, 6.5 + Math.sin(a) * 5, Math.max(s.stage + 4, p[2] - 16)]; },
  scatter: (f, p) => [p[0] + f.rp * 9, 0, p[2] + (f.rt - 0.5) * 14],   // spread over the crowd, new places every eight kicks
};

// How far an effect moves the target scales with how far the beam travels, so an effect on the roof is as big as one on the floor.
const reach = (target, p) => Math.max(0.5, Math.hypot(target[0] - p[0], target[1] - p[1], target[2] - p[2]) / 11);
export const MOVES = {
  still: t => t,
  sway: (t, f, p, k) => { const r = reach(t, p), a = k.m * 0.45 + f.row * 0.9; return [t[0] + Math.sin(a) * 3 * r, t[1], t[2] + Math.cos(a * 0.8) * 5 * r]; },
  circle: (t, f, p, k) => { const r = reach(t, p) * 8, a = k.phase * TAU / 16 + f.u * Math.PI + f.row * 0.9; return [t[0] + Math.cos(a) * r, t[1], t[2] + Math.sin(a) * r]; },
  eight: (t, f, p, k) => { const r = reach(t, p), a = k.phase * TAU / 32 + f.u * Math.PI; return [t[0] + Math.sin(a) * 9 * r, t[1], t[2] + Math.sin(2 * a) * 5 * r]; },   // a figure of eight
  tiltWave: (t, f, p, k) => [t[0], t[1], t[2] + Math.sin(k.phase * TAU / 8 - f.u * TAU) * 8 * reach(t, p)],   // a ripple along each truss
  panWave: (t, f, p, k) => [t[0] + Math.sin(k.phase * TAU / 8 - f.u * TAU + f.row) * 7 * reach(t, p), t[1], t[2]],
  // the fan opens and closes around the point straight below the head
  breathe: (t, f, p, k) => { const o = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(k.m * 0.35 + f.row * 0.6)); return [p[0] + (t[0] - p[0]) * o, t[1], p[2] + (t[2] - p[2]) * o]; },
  snake: (t, f, p, k) => [t[0] + Math.sin(k.m * 0.5 - t[2] * 0.15) * 9, t[1], t[2]],   // a wave that travels down the hall
  // the whole picture turns slowly round the point straight below each head
  spin: (t, f, p, k) => { const a = k.m * 0.3, dx = t[0] - p[0], dz = t[2] - p[2]; return [p[0] + dx * Math.cos(a) - dz * Math.sin(a), t[1], p[2] + dx * Math.sin(a) + dz * Math.cos(a)]; },
};

// counted: beats, counted at half speed in calm parts; pattern (0..5) a figure that holds for 32 beats
export const GATES = {
  all: () => true,
  patterns: (f, counted, pattern) => {   // halves, diagonals, from the middle out, alternate heads (real positions)
    const x = clamp((f.pos[0] + 20) / 40), z = clamp((f.pos[2] + 36) / 54), step = Math.floor(counted / 2);
    if (pattern === 0) return (x < 0.5 ? 0 : 1) === step % 2;
    if (pattern === 3) return (z < 0.5 ? 0 : 1) === step % 2;
    if (pattern === 4) return Math.min(3, Math.floor(Math.abs(x * 2 - 1) * 4)) === 3 - step % 4;
    if (pattern === 5) return f.hangarSlot % 2 === step % 2;
    const diagonal = pattern === 1 ? (x + z) / 2 : (1 - x + z) / 2;
    return Math.min(3, Math.floor(diagonal * 4)) === step % 4;
  },
  chase: (f, counted) => (((f.u * 2 - counted / 8 + f.row * 0.25) % 1) + 1) % 1 < 0.5,   // a band along the trusses
  across: (f, counted) => (((across(f.pos) - counted / 8) % 1) + 1) % 1 < 0.35,   // a band across the hall
  frontBack: (f, counted) => (((depth(f.pos) - counted / 16) % 1) + 1) % 1 < 0.4,   // from the stage to the back
  centre: (f, counted) => (((Math.abs(across(f.pos) * 2 - 1) - counted / 8) % 1) + 1) % 1 < 0.5,   // out from the middle
  alternate: (f, counted) => f.hangarSlot % 2 === Math.floor(counted / 2) % 2,
  sparkle: (f, counted) => hash(f.hangarSlot + f.row * 31, Math.floor(counted)) < 0.45,   // a different handful every beat
  trusses: (f, counted) => f.row % 7 === Math.floor(counted / 4) % 7,   // one truss at a time
};
export const GATE_GAIN = { all: 1, patterns: null, chase: 1.5, across: 1.7, frontBack: 2.1, centre: 1.5, alternate: 1.5, sparkle: 1.5, trusses: 2.2 };

export const COLOURS = {
  sides: (f, beats) => [(f.pos[0] < 0 ? 0 : 1) === Math.floor(beats / 32) % 2 ? 0 : 1, 0],   // the sides swap every 32 beats
  mono: () => [0, 0],
  alternate: f => [f.hangarSlot % 2, 0],
  trusses: f => [f.row % 2, 0],
  depth: f => [depth(f.pos), 0],   // from the first colour at the stage to the second at the back
  centreWhite: f => [0, 0.65 * (1 - Math.abs(f.xn))],   // white in the middle of the hall, colour at the sides
};
// zoom: how wide the beam opens (multiplies the show's own), gobo: how strongly a gobo breaks it up
export const BEAMS = { normal: { zoom: 1, gobo: null }, narrow: { zoom: 0.7, gobo: 0 }, wide: { zoom: 1.5, gobo: 0 }, gobo: { zoom: 1.1, gobo: 0.85 } };

// The looks, in the order in which tracks get them. tiers: the parts of a track a look suits.
const look = (name, tiers, position, move, gate, colour = 'sides', beam = 'normal') => ({ name, tiers, position, move, gate, colour, beam });
export const HEAD_LOOKS = {
  floor: look('Floor scan', ['calm', 'mid', 'big'], 'floor', 'still', 'patterns'),
  curtains: look('Curtains', ['calm', 'mid', 'big'], 'curtain', 'still', 'all'),
  circles: look('Circles', ['mid', 'big'], 'down', 'circle', 'patterns'),
  fan: look('Fans', ['mid', 'big'], 'fan', 'breathe', 'all'),
  pillars: look('Pillars', ['calm', 'mid'], 'down', 'still', 'chase'),
  cross: look('Crossfire', ['mid', 'big'], 'cross', 'sway', 'chase'),
  converge: look('Converge', ['big'], 'converge', 'still', 'all'),
  sky: look('Sky', ['big'], 'sky', 'sway', 'all', 'sides', 'narrow'),
  softCurtains: look('Breathing curtains', ['calm', 'mid'], 'curtain', 'breathe', 'all', 'depth', 'wide'),
  rakeStage: look('Towards the stage', ['calm', 'mid'], 'rakeStage', 'sway', 'all', 'mono', 'wide'),
  eights: look('Figures of eight', ['mid', 'big'], 'down', 'eight', 'alternate', 'alternate'),
  tunnel: look('Tunnel', ['big'], 'tunnel', 'still', 'all', 'depth', 'narrow'),
  snake: look('Snake', ['calm', 'mid'], 'down', 'snake', 'chase', 'depth'),
  ripple: look('Ripple', ['mid', 'big'], 'down', 'tiltWave', 'chase', 'trusses'),
  walls: look('On the walls', ['mid'], 'walls', 'tiltWave', 'trusses', 'mono', 'gobo'),
  skyCircles: look('Circles in the roof', ['big'], 'sky', 'circle', 'alternate', 'sides', 'narrow'),
  rakeBack: look('Towards the back', ['mid', 'big'], 'rakeBack', 'sway', 'frontBack', 'trusses'),
  softFans: look('Soft fans', ['calm', 'mid'], 'fan', 'sway', 'alternate', 'trusses', 'wide'),
  scatter: look('Scatter', ['mid', 'big'], 'scatter', 'still', 'sparkle', 'alternate', 'narrow'),
  panWave: look('Pan wave', ['mid'], 'fan', 'panWave', 'across', 'depth'),
  spiral: look('Spiral tunnel', ['big'], 'tunnel', 'spin', 'chase', 'alternate', 'narrow'),
  turningFans: look('Turning fans', ['mid', 'big'], 'fan', 'spin', 'centre', 'depth', 'gobo'),
  crossTrusses: look('Crossfire, truss by truss', ['big'], 'cross', 'panWave', 'trusses', 'centreWhite'),
  convergePulse: look('Converge, truss by truss', ['big'], 'converge', 'tiltWave', 'trusses', 'centreWhite', 'narrow'),
  ballyhoo: look('Ballyhoo', ['big'], 'fan', 'eight', 'sparkle', 'sides', 'narrow'),
};
export const HEAD_TIERS = Object.fromEntries(['calm', 'mid', 'big'].map(tier => [tier, Object.keys(HEAD_LOOKS).filter(key => HEAD_LOOKS[key].tiers.includes(tier))]));

// Formations of the five hall trusses: drop in metres below their top (v: 0 the front truss, 1 the back one) and
// roll for a truss whose two hoists stop at different heights. A formation holds for minutes; the low ones suit
// calm parts of a track, the high ones peaks.
const byRow = list => (v, row) => list[row] ?? list.at(-1);
export const TRUSS_LOOKS = [
  { name: 'High', drop: () => 0 },
  { name: 'Rising to the back', drop: v => (1 - v) * 3 },
  { name: 'Valley', drop: v => 3 * (1 - Math.abs(v * 2 - 1)) },
  { name: 'Low', drop: () => 2.4 },
  { name: 'Tilted', drop: () => 1.4, roll: row => (row % 2 ? 1 : -1) * 0.07 },
  { name: 'Arch', drop: v => 0.4 + 2.6 * Math.abs(v * 2 - 1) },
  { name: 'Zigzag', drop: (v, row) => row % 2 ? 2.4 : 0.6 },
  { name: 'Falling to the back', drop: v => v * 3 },
  { name: 'Front low', drop: byRow([3, 0.6, 0.3, 0.3, 0.3]) },
  { name: 'Twin valleys', drop: byRow([0.2, 2.6, 0.6, 2.6, 0.2]) },
  { name: 'Ramp, tilted', drop: v => (1 - v) * 2.4, roll: () => 0.06 },
  { name: 'Canopy', drop: () => 3.4 },
  { name: 'Middle low', drop: byRow([0.6, 0.6, 3, 0.6, 0.6]) },
  { name: 'Twisted', drop: () => 1, roll: row => (row / 2 - 1) * 0.07 },
  { name: 'Back low', drop: byRow([0.3, 0.3, 0.3, 0.6, 3]) },
];
// which parts of a track a formation suits, from how low it hangs on average
for (const formation of TRUSS_LOOKS) {
  const mean = [0, 1, 2, 3, 4].reduce((a, row) => a + formation.drop(row / 4, row), 0) / 5;
  formation.tiers = mean >= 1.8 ? ['calm', 'mid'] : mean <= 0.9 ? ['mid', 'big'] : ['calm', 'mid', 'big'];
}
// How often the show changes look and formation (seconds): looks at a scene cue once held, formations likewise,
// or sooner for a new track.
export const PACE = {
  calm: { head: 80, truss: 240, track: 60 },
  normal: { head: 40, truss: 120, track: 30 },
  lively: { head: 20, truss: 60, track: 15 },
};
