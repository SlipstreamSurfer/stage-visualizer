// The director: turns what the music does (Signals) into what every fixture should do. It never draws anything and
// never names a single lamp. It sets channels on roles (the heads over the crowd, the heads on the stage, the
// strobes...), and each fixture carries those out in its own way. So the same show plays in a club with eight heads
// and in a hall with seventy, and it can be tested without a picture.
//
// A fixture's channels: dim (0 and up), color [r, g, b], pan and tilt (radians; see aim below), zoom, and for some
// types fire (CO2), mode and color2 (LED wall), or what a fixture that is a whole roof or ring of LED needs (see fixtures.js).
//   aim: pan turns round the vertical, 0 is towards the back of the hall (+z). tilt 0 is straight down, 1.57 is
//   level, more than that is up into the roof.

import { PALETTES, RING_NAMES } from './show-controls.js';
import { SHOW_THEMES } from './show-themes.js';
import { HEAD_LOOKS, HEAD_TIERS, TRUSS_LOOKS, DEEPEST, PACE, POSITIONS, MOVES, GATES, GATE_GAIN, COLOURS, BEAMS, floorTarget, styleOf } from './hangar-looks.js';
import { LightChoreography, CHOREOGRAPHIES } from './light-choreography.js';

const TAU = Math.PI * 2;
const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = v => Math.max(0, Math.min(1, v));
const vivid = c => { const k = 1 / Math.max(c[0], c[1], c[2], 0.05); return [c[0] * k, c[1] * k, c[2] * k]; };   // a colour's hue at full strength
const WHITE = [1, 1, 1], WARM = [1, 0.78, 0.56];

// A mood is how a kind of music is lit: its colours, how fast things move, whether there are strobes and lasers, how
// much haze, what goes off on a drop. There is one for every genre in Beatport's list, and for music that is not
// built on a kick at all (flow: true): classical, an orchestra, a film score, a piano, ambient. Every mood starts
// from BASE and overrides what makes it different.
//   family    which group it is listed under
//   flow      the music has no beat to count: the show follows how loud and full it is (see flow() below)
//   warm      0 to 1: how much warm white is mixed into the washes and the light on the building
//   wash      the least the stage washes give while there is music, so whoever plays is always seen
//   house     how far the house lights stay up during the music (they come up fully when it stops)
const BASE = {
  family: 'House',
  decay: 8, speed: 0.9, strobes: true, strobeAt: 0.6, strobeRate: 1, lasers: 'peak',   // lasers: false, 'peak' (once a peak scene has settled) or 'both' (also in the quiet of a break)
  level: 1, haze: 1, breathe: 0, warm: 0, wash: 0, house: 0.12,
  sceneKicks: 64, sceneMin: 24,          // a scene lasts this many kicks, and at least this many seconds
  colorEvery: 1, paletteHold: 240, paletteBreak: 24,
  drop: 1, blinder: 1, camHold: 1, demoBpm: 132,
  // what goes off on a drop: CO2, flames and sparks every time or never; fireworks and confetti every so many drops (0: never)
  fx: { co2: true, flame: false, spark: true, firework: 2, confetti: 0 },
};
const CALM = { strobes: false, lasers: false, blinder: 0.3, fx: {} }, NONE = { co2: false, flame: false, spark: false, firework: 0, confetti: 0 };
export const MOODS = {
  // ----- house -----
  house: { name: 'House', palettes: [[0xff7a1a, 0xff2a6a, 0x2a8aff, 0xffd02a], [0xff3a8a, 0x8a3aff, 0x2ad0ff, 0xff8a2a]], decay: 6, speed: 0.6, strobeAt: 0.75, lasers: false, demoBpm: 124, fx: { co2: true, spark: false, confetti: 2 } },
  deephouse: { name: 'Deep House', palettes: [[0x2a40d0, 0x8a30c0], [0xff9a40, 0xc03a50], [0x1890a0, 0x3a40c0]], ...CALM, decay: 3.5, speed: 0.3, breathe: 0.45, level: 0.8, haze: 1.1, camHold: 1.6, demoBpm: 122 },
  techhouse: { name: 'Tech House', palettes: [[0xffffff, 0xff3a1a, 0xffb020, 0x2a6aff], [0x20e0a0, 0xffffff, 0xff2a8a, 0xffffff]], decay: 9, speed: 0.8, demoBpm: 126, fx: { co2: true, spark: true, confetti: 3 } },
  funky: { name: 'Funky House', palettes: [[0xff2a8a, 0xffd02a, 0x2ad0ff, 0x8aff2a], [0xff7a1a, 0xff2a6a, 0xffe02a, 0x2a8aff]], ...CALM, decay: 6, speed: 0.7, breathe: 0.3, blinder: 0.7, demoBpm: 125, fx: { spark: true, confetti: 1 } },
  jackin: { name: 'Jackin House', palettes: [[0xffb020, 0xff2a3a, 0x2a6aff, 0xffffff], [0xff3a8a, 0xffd02a, 0x2ad0ff, 0xffffff]], decay: 8, speed: 0.75, strobeAt: 0.7, lasers: false, demoBpm: 126, fx: { co2: true, spark: true, confetti: 2 } },
  afro: { name: 'Afro House', palettes: [[0xff8a20, 0xc8401a, 0x20a060, 0xd03a8a], [0xffb040, 0x8a3a1a, 0x1a8a8a, 0xff5a30]], ...CALM, decay: 4, speed: 0.45, breathe: 0.5, blinder: 0.5, demoBpm: 122, fx: { spark: true } },
  amapiano: { name: 'Amapiano', palettes: [[0xffb030, 0x8a30c0, 0xff5a8a, 0x30a0c0], [0xff8a20, 0xc02a70, 0xffd060, 0x5a30c0]], ...CALM, decay: 3.2, speed: 0.35, breathe: 0.5, demoBpm: 113 },
  organic: { name: 'Organic House', palettes: [[0xffa040, 0xff5a3c, 0x2fd0b0, 0xd070ff]], decay: 2.6, speed: 0.3, strobes: false, lasers: false, breathe: 0.6, haze: 0.8, blinder: 0.6, demoBpm: 120, fx: { spark: true, confetti: 1 } },
  melodic: { name: 'Melodic House & Techno', palettes: [[0x2a5aff, 0x20c0d0], [0xff9a30, 0xff3a6a], [0x8a40ff, 0x2a8aff], [0xffffff, 0x40a0ff]], decay: 5, speed: 0.45, strobeAt: 0.8, lasers: 'both', breathe: 0.3, haze: 1.2, sceneKicks: 128, sceneMin: 40, camHold: 1.4, demoBpm: 123, fx: { co2: true, spark: true, firework: 2 } },
  progressive: { name: 'Progressive House', palettes: [[0x3a50ff, 0xc040ff], [0x20b0e0, 0xffc040], [0xff4a8a, 0x5a40ff], [0xffffff, 0x30c0c0]], decay: 5.5, speed: 0.5, strobeAt: 0.75, lasers: 'both', breathe: 0.2, haze: 1.15, sceneKicks: 128, sceneMin: 36, camHold: 1.3, demoBpm: 124, fx: { co2: true, spark: true, firework: 2 } },
  minimal: { name: 'Minimal / Deep Tech', palettes: [[0xffffff, 0x2a6aff], [0xffffff, 0xff3a1a], [0x20e0c0, 0xffffff]], decay: 9, speed: 0.35, level: 0.75, strobeAt: 0.8, colorEvery: 2, sceneKicks: 128, demoBpm: 127, fx: {} },
  nudisco: { name: 'Nu Disco / Disco', palettes: [[0xff3aa0, 0xffc030, 0x30d0ff, 0xa040ff], [0xff5a30, 0xff30a0, 0xffe040, 0x40a0ff]], ...CALM, decay: 5, speed: 0.6, breathe: 0.4, blinder: 0.6, demoBpm: 118, fx: { spark: true, confetti: 1 } },
  indiedance: { name: 'Indie Dance', palettes: [[0xe02030, 0x7030d0], [0x20c0d0, 0xe02070], [0xffffff, 0xe02030]], decay: 6, speed: 0.5, strobeAt: 0.8, level: 0.9, haze: 1.2, demoBpm: 120, fx: { co2: true } },
  dancepop: { name: 'Dance / Pop', palettes: [[0xff3aa0, 0x30a0ff, 0xffe040, 0xffffff], [0xa040ff, 0xff5a30, 0x30e0d0, 0xffffff]], decay: 7, speed: 0.8, demoBpm: 124, fx: { co2: true, flame: true, spark: true, firework: 2, confetti: 1 } },
  mainstage: { name: 'Mainstage', palettes: [[0xffffff, 0xff2a1a, 0x2a6aff, 0xffd020], [0xffffff, 0xff2a8a, 0x20d0ff, 0xff2a8a], [0xffa030, 0xffffff, 0x2a6aff, 0xffffff]], decay: 9, speed: 1.1, level: 1.1, strobeRate: 1.2, strobeAt: 0.5, camHold: 0.8, demoBpm: 128, fx: { co2: true, flame: true, spark: true, firework: 1, confetti: 2 } },
  electronica: { name: 'Electronica', palettes: [[0x20c0d0, 0xff5a3a], [0x8a40ff, 0xffe0a0], [0xffffff, 0x2a5aff]], ...CALM, decay: 4, speed: 0.35, breathe: 0.5, lasers: 'both', haze: 1.2, sceneMin: 40, camHold: 1.6, demoBpm: 110 },
  downtempo: { name: 'Downtempo', palettes: [[0xff9a40, 0x30a0a0], [0xa050d0, 0xff7a50], [0x3060c0, 0xffc070]], ...CALM, decay: 2.4, speed: 0.2, breathe: 0.7, level: 0.75, blinder: 0.2, sceneMin: 60, camHold: 2, demoBpm: 95 },
  djtools: { name: 'DJ Tools', palettes: [[0xffffff, 0x3a6bff], [0xffffff, 0xffa030]], decay: 8, speed: 0.6, strobes: false, lasers: false, demoBpm: 126, fx: {} },
  // ----- techno -----
  techno: { name: 'Techno (Peak Time / Driving)', family: 'Techno', palettes: [[0xffffff, 0xff2a1a, 0x3a6bff, 0xff2a1a], [0xffffff, 0x3a6bff, 0x20d0ff, 0x3a6bff], [0xffa030, 0xffffff, 0xff2a1a, 0xffffff]] },
  raw: { name: 'Techno (Raw)', family: 'Techno', palettes: [[0xffffff, 0x8fb4ff, 0xffffff, 0xb01810], [0xffffff, 0xb01810], [0xffffff, 0xffb060]], decay: 10, speed: 0.5, haze: 1.1, lasers: 'peak', colorEvery: 2, paletteHold: 360, demoBpm: 140, fx: { co2: true, flame: true, spark: false, firework: 0, confetti: 0 } },
  deep: { name: 'Techno (Deep)', family: 'Techno', palettes: [[0x1840ff, 0x10b0a0], [0xff9a30, 0xc03a18], [0x7a40ff, 0x2040c0], [0x10b070, 0x0a5a80]], decay: 3.5, speed: 0.25, strobes: false, breathe: 0.3, level: 0.7, haze: 1.4, lasers: 'both', sceneKicks: 128, sceneMin: 50, colorEvery: 2, drop: 0.5, blinder: 0.25, camHold: 2, demoBpm: 128, fx: {} },
  hypnotic: { name: 'Techno (Hypnotic)', family: 'Techno', palettes: [[0x4060ff, 0x1a2a90], [0x8040ff, 0x3a1a90], [0x18c0b0, 0x0a5a60], [0xd01828, 0x600a14], [0xff8a20, 0x7a3a08]], decay: 6, speed: 0.35, strobes: false, breathe: 0.15, level: 0.75, haze: 1.25, lasers: 'both', sceneKicks: 256, sceneMin: 90, colorEvery: 4, paletteHold: 330, drop: 0.45, blinder: 0.3, camHold: 2.5, demoBpm: 134, fx: {} },
  electro: { name: 'Electro (Classic / Detroit / Modern)', family: 'Techno', palettes: [[0x20e0ff, 0xff2030, 0xffffff, 0x20e0ff], [0xffffff, 0x3050ff, 0xff2030, 0xffffff]], decay: 10, speed: 0.9, lasers: 'both', demoBpm: 130, fx: { co2: true } },
  // ----- hard -----
  hard: { name: 'Hard Techno', family: 'Hard', palettes: [[0xff1a10, 0xffffff], [0xffffff, 0x3a6bff], [0xff1a10, 0xff7a10], [0xc020ff, 0xffffff]], decay: 11, speed: 1.4, level: 1.1, sceneMin: 20, strobeRate: 1.4, strobeAt: 0.4, paletteBreak: 12, paletteHold: 180, camHold: 0.7, demoBpm: 155, fx: { co2: true, flame: true, spark: true, firework: 1, confetti: 0 } },
  harddance: { name: 'Hard Dance / Hardcore / Neo Rave', family: 'Hard', palettes: [[0xff1a10, 0xffffff, 0x60ff20, 0xffffff], [0xffffff, 0xff20a0, 0x2060ff, 0xff20a0], [0xffe020, 0xff1a10]], decay: 14, speed: 1.6, level: 1.15, sceneMin: 18, strobeRate: 1.6, strobeAt: 0.35, paletteBreak: 10, paletteHold: 150, camHold: 0.6, demoBpm: 160, fx: { co2: true, flame: true, spark: true, firework: 1, confetti: 0 } },
  // ----- trance -----
  trance: { name: 'Trance (Main Floor)', family: 'Trance', palettes: [[0x2a6aff, 0xffffff, 0x20d0ff, 0xff2ad0], [0xffd020, 0xffffff, 0xff2a8a, 0x8a3aff]], decay: 7, speed: 1.0, lasers: 'both', strobeAt: 0.5, haze: 1.2, demoBpm: 138, fx: { co2: true, flame: true, spark: true, firework: 1, confetti: 2 } },
  trancedeep: { name: 'Trance (Raw / Deep / Hypnotic)', family: 'Trance', palettes: [[0x2040e0, 0x7030d0], [0x10a0b0, 0x2040c0], [0xc02a80, 0x4030c0]], decay: 6, speed: 0.55, strobes: false, lasers: 'both', breathe: 0.2, level: 0.8, haze: 1.3, sceneKicks: 128, blinder: 0.4, camHold: 1.5, demoBpm: 136, fx: {} },
  psytrance: { name: 'Psy-Trance', family: 'Trance', palettes: [[0x30ff60, 0xa020ff, 0xff2ad0, 0xff8a10], [0x20ffd0, 0xff20a0, 0xe0ff20, 0x7020ff]], decay: 12, speed: 1.3, lasers: 'both', strobeRate: 1.3, sceneMin: 20, haze: 1.2, demoBpm: 145, fx: { co2: true, spark: true } },
  // ----- bass -----
  dnb: { name: 'Drum & Bass', family: 'Bass', palettes: [[0xffffff, 0x2aff6a, 0x2a6aff, 0xff2a1a], [0xff8a10, 0xffffff, 0x20d0ff, 0xffffff]], decay: 13, speed: 1.4, strobeRate: 1.5, strobeAt: 0.45, camHold: 0.7, demoBpm: 174, fx: { co2: true, flame: true, spark: true, firework: 2 } },
  dubstep: { name: 'Dubstep', family: 'Bass', palettes: [[0x40ff30, 0x8020e0, 0xffffff, 0xe02020], [0x20c0ff, 0xff2080, 0xffffff, 0x8020e0]], decay: 6, speed: 0.9, strobeRate: 0.8, lasers: 'both', level: 1.05, demoBpm: 140, fx: { co2: true, flame: true, spark: true, firework: 2 } },
  deepdubstep: { name: '140 / Deep Dubstep / Grime', family: 'Bass', palettes: [[0xc01818, 0x1830c0], [0x1830c0, 0x6a20b0], [0xffffff, 0xc01818]], decay: 4.5, speed: 0.35, strobeAt: 0.85, lasers: false, level: 0.65, haze: 1.3, colorEvery: 2, blinder: 0.4, camHold: 1.5, demoBpm: 140, fx: {} },
  basshouse: { name: 'Bass House', family: 'Bass', palettes: [[0xff2a8a, 0x20e0ff, 0xffffff, 0xe0ff20], [0xffffff, 0xff3a1a, 0x8a3aff, 0xffffff]], decay: 10, speed: 1.0, demoBpm: 128, fx: { co2: true, flame: true, spark: true } },
  bassclub: { name: 'Bass / Club', family: 'Bass', palettes: [[0xff3a1a, 0x20e0ff, 0xe0ff20, 0xa030ff], [0xffffff, 0xff2a8a, 0x20e0a0, 0xffffff]], decay: 10, speed: 1.0, strobeAt: 0.55, demoBpm: 135, fx: { co2: true } },
  breaks: { name: 'Breaks / Breakbeat / UK Bass', family: 'Bass', palettes: [[0x20d0e0, 0xff7a1a, 0xffffff, 0x20d0e0], [0xffffff, 0x8a3aff, 0x30ff80, 0xffffff]], decay: 9, speed: 0.9, demoBpm: 132, fx: { co2: true, spark: true } },
  ukg: { name: 'UK Garage / Bassline', family: 'Bass', palettes: [[0x9030e0, 0xff3aa0, 0x3060ff, 0xffffff], [0x30d0c0, 0x9030e0, 0xffc040, 0xff3aa0]], decay: 8, speed: 0.8, lasers: false, strobeAt: 0.7, demoBpm: 133, fx: { co2: true } },
  trap: { name: 'Trap / Future Bass', family: 'Bass', palettes: [[0xff3aa0, 0x30e0ff, 0xa040ff, 0xffffff], [0xffe040, 0xff3a3a, 0x30a0ff, 0xffffff]], decay: 5.5, speed: 0.8, demoBpm: 150, fx: { co2: true, flame: true, spark: true, firework: 2, confetti: 2 } },
  // ----- open format -----
  african: { name: 'African', family: 'Open format', palettes: [[0xffc030, 0x20a050, 0xe03020, 0xff8a20], [0xff8a20, 0x8a30a0, 0xffd040, 0x20a080]], ...CALM, decay: 4, speed: 0.5, breathe: 0.5, blinder: 0.5, demoBpm: 108, fx: { spark: true, confetti: 2 } },
  caribbean: { name: 'Caribbean', family: 'Open format', palettes: [[0xffe030, 0x20b050, 0xe03020, 0x20c0d0], [0xff8a20, 0x20c0d0, 0xffe030, 0xe0308a]], ...CALM, decay: 5, speed: 0.6, breathe: 0.4, blinder: 0.5, demoBpm: 100, fx: { confetti: 1 } },
  latin: { name: 'Latin', family: 'Open format', palettes: [[0xe02020, 0xff8a20, 0xe0208a, 0xffc030], [0xff5a20, 0xa020c0, 0xffd040, 0xe02050]], decay: 5.5, speed: 0.65, strobes: false, lasers: false, breathe: 0.4, demoBpm: 96, fx: { co2: true, spark: true, confetti: 1 } },
  brazilianfunk: { name: 'Brazilian Funk', family: 'Open format', palettes: [[0x20c050, 0xffe030, 0x2060ff, 0xff3aa0], [0xffffff, 0x20c050, 0xffe030, 0xffffff]], decay: 9, speed: 0.9, lasers: false, demoBpm: 130, fx: { co2: true, confetti: 1 } },
  hiphop: { name: 'Hip-Hop', family: 'Open format', palettes: [[0xffc030, 0xc01818], [0xffffff, 0x7030c0], [0xc01818, 0xffffff]], decay: 5, speed: 0.5, strobeAt: 0.8, lasers: false, level: 0.9, demoBpm: 92, fx: { co2: true, flame: true } },
  rnb: { name: 'R&B', family: 'Open format', palettes: [[0x8030c0, 0xff5a8a], [0xff9a40, 0x3050c0], [0xc03080, 0x30a0c0]], ...CALM, decay: 3, speed: 0.25, breathe: 0.6, level: 0.75, blinder: 0.2, camHold: 1.8, demoBpm: 80 },
  pop: { name: 'Pop', family: 'Open format', palettes: [[0xff3aa0, 0x30a0ff, 0xffe040, 0xffffff], [0xff5a30, 0xa040ff, 0x30e0d0, 0xffffff]], decay: 6.5, speed: 0.7, strobeAt: 0.7, demoBpm: 118, fx: { co2: true, spark: true, firework: 2, confetti: 1 } },
  // ----- music that flows -----
  ambient: { name: 'Ambient / Experimental', family: 'Concert & ambient', flow: true, palettes: [[0x1840c0, 0x10a0a0], [0x6a30c0, 0x2050c0], [0x10a070, 0x1a4a90], [0xc06a30, 0x7a2a50]], ...CALM, lasers: 'both', speed: 0.12, breathe: 0.8, level: 0.7, haze: 1.4, wash: 0.3, sceneMin: 70, paletteHold: 200, camHold: 1.2, demoBpm: 70, fx: NONE },
  neoclassical: { name: 'Neo-classical', family: 'Concert & ambient', flow: true, palettes: [[0xa8c0ff, 0xffd9a8], [0x8a70e0, 0xffc8a0], [0x70c0d0, 0xffe0c0]], ...CALM, speed: 0.1, breathe: 0.7, level: 0.8, haze: 1.1, warm: 0.35, wash: 0.6, blinder: 0, sceneMin: 80, paletteHold: 200, camHold: 1, demoBpm: 66, fx: NONE },
  classical: { name: 'Classical', family: 'Concert & ambient', flow: true, palettes: [[0xffd9a8, 0xffc890], [0xffe6c8, 0xe0b890]], ...CALM, speed: 0.07, breathe: 0.5, level: 0.9, haze: 0.45, warm: 0.85, wash: 0.85, house: 0.22, blinder: 0, sceneMin: 90, camHold: 0.8, demoBpm: 72, fx: NONE },
  orchestra: { name: 'Orchestra', family: 'Concert & ambient', flow: true, palettes: [[0xffd9a8, 0x2a50c0], [0xffc890, 0xb02a30], [0xffe0b0, 0xc89a30]], ...CALM, speed: 0.12, breathe: 0.5, level: 1, haze: 0.7, warm: 0.55, wash: 0.85, house: 0.16, blinder: 0, sceneMin: 60, camHold: 0.7, demoBpm: 84, fx: NONE },
  soundtrack: { name: 'Soundtrack', family: 'Concert & ambient', flow: true, palettes: [[0x20a0b0, 0xff8a30], [0x2a40c0, 0xffc850], [0xc02a30, 0xffe0c8], [0x6a30c0, 0x30c0a0]], ...CALM, speed: 0.18, breathe: 0.4, level: 1, haze: 1.1, warm: 0.15, wash: 0.7, blinder: 0.3, sceneMin: 45, camHold: 0.6, demoBpm: 90, fx: NONE },
};
MOODS.deep.accent = hex(0xffa860);   // amber in the washes, so a blue room is not blue alone
for (const k in MOODS) MOODS[k] = { ...BASE, ...MOODS[k], palettes: MOODS[k].palettes.map(p => p.map(hex)) };
export const FAMILIES = ['House', 'Techno', 'Hard', 'Trance', 'Bass', 'Open format', 'Concert & ambient'];

// Not everything at once: a program is a look that uses part of the rig, with its own way of aiming the heads.
//   tier      which part of a track it suits: calm (intro, stripped back), mid (the track runs), big (everything in)
//   w         how much each role takes part
//   overhead, stage   where a head points: (f, k) => [pan, tilt]. f is the fixture (u: place along its truss 0..1,
//             row and rows: which truss, xn: -1 at the left wall to 1 at the right, rp and rt: random numbers that
//             change every eight kicks). k has m (a clock that runs with the music), spin and phase (the beat).
//   gate      optional: how much of its light a head gets, for patterns that run through the rig
//   gobo      optional: the heads put a gobo in, which breaks each beam into turning shafts
const out = f => (f.xn < 0 ? -1 : 1) * Math.PI / 2;
const RING_LOOKS = [
  { name: 'Crown', drops: [0.25, 1.3] },
  { name: 'Tunnel', drops: [2.8, 0.3] },
  { name: 'Arena', drops: [0.4, 2.3] },
  { name: 'Layers', drops: [1.8, 1.1] },
];
// The Hangar's hall heads aim at points in the hall (see hangar-looks.js); a break keeps the floor scan, whose
// builds lift a share of the beams to the roof.
const toward = (pos, [x, y, z]) => { const dx = x - pos[0], dy = y - pos[1], dz = z - pos[2]; return [Math.atan2(dx, dz), Math.atan2(Math.hypot(dx, dz), -dy)]; };
const aimHangar = (f, k, beat, section, build, energy, drop) => toward(f.livePos || f.pos, floorTarget(f, k, beat, section, build, energy, drop));
const aimLook = (look, f, k, s) => { const p = f.livePos || f.pos; return toward(p, MOVES[look.move](POSITIONS[look.position](f, p, k, s), f, p, k, s)); };
export const PROGRAMS = [
  { name: 'Pillars', tier: 'calm', w: { overhead: 1, stage: 0.1, wash: 0.5, bars: 0.5, wall: 0.8, roof: 0.3, rings: 0.45 },
    overhead: (f, k) => [0, 0.05 + 0.04 * Math.sin(k.m + f.u * 4)],
    stage: f => [(f.u - 0.5) * 0.8, 1.9] },
  { name: 'Sway', tier: 'calm', w: { overhead: 1, stage: 0.15, wash: 0.6, bars: 0.35, wall: 0.8, roof: 0.3, rings: 0.55 },
    overhead: (f, k) => [0, 0.4 * Math.sin(k.m * 0.8 + f.row * 0.7)],
    stage: (f, k) => [(f.u - 0.5) * 1.1, 1.85 + 0.2 * Math.sin(k.m + f.u * 4)] },
  { name: 'Fan', tier: 'mid', w: { overhead: 1, stage: 0.25, wash: 0.3, bars: 0.4, wall: 0.8, roof: 0.55, rings: 0.3 }, twoTone: true,
    overhead: (f, k) => [out(f), Math.abs(f.xn) * 0.75 + 0.12 * Math.sin(k.m + f.row)],
    stage: (f, k) => [(f.u - 0.5) * 1.6, 1.75 + 0.15 * Math.sin(k.m * 0.7)] },
  { name: 'Cross', tier: 'mid', w: { overhead: 1, stage: 0.2, wash: 0.25, bars: 0.5, wall: 0.8, roof: 0.3, rings: 0.5 },
    overhead: (f, k) => [-out(f), 0.25 + Math.abs(f.xn) * 0.55 + 0.12 * Math.sin(k.m + f.row * 1.3)],
    stage: (f, k) => [-(f.u - 0.5) * 1.4, 1.95] },
  { name: 'Carousel', tier: 'mid', w: { overhead: 1, stage: 0.25, wash: 0.2, bars: 0.2, wall: 0.8, roof: 0.5, rings: 0.25 }, twoTone: true, spin: true, gobo: true,
    overhead: (f, k) => [k.spin + f.u * TAU + f.row * 0.8, 0.55],
    stage: (f, k) => [Math.sin(k.m + f.u * 5) * 0.9, 1.8] },
  { name: 'Scatter', tier: 'mid', w: { overhead: 0.5, stage: 1, wash: 0.3, bars: 0.25, wall: 0.8, roof: 0.3, rings: 0.4 }, twoTone: true, slow: true,
    overhead: f => [f.rp * Math.PI, 0.15 + f.rt * 0.7],
    stage: f => [f.rp * 0.9, 1.5 + f.rt * 0.7] },
  { name: 'Wave', tier: 'big', w: { overhead: 1, stage: 0.6, wash: 0.3, bars: 0.5, wall: 0.9, roof: 0.6, rings: 0.4 },
    overhead: (f, k) => [0, 0.7 * Math.sin(k.m * 1.3 + f.row * 0.9 + f.u * 2.5)],
    stage: (f, k) => [(f.u - 0.5) * 0.5, 1.75 + 0.3 * Math.sin(k.m * 1.3 + f.u * 5)] },
  { name: 'Chase', tier: 'big', w: { overhead: 1, stage: 0.5, wash: 0.2, bars: 0.6, wall: 0.8, roof: 0.4, rings: 0.6 },
    overhead: () => [0, 0.2],
    stage: (f, k) => [Math.sin(k.m * 0.5) * 0.4, 1.9],
    gate: (f, k) => f.role === 'overhead' ? 0.1 + 0.9 * Math.pow(Math.max(0, Math.cos(f.u * TAU * 1.5 - k.phase * TAU / 4 + f.row * 1.1)), 3) : 1 },
  { name: 'Dome', tier: 'big', w: { overhead: 1, stage: 0.8, wash: 0.4, bars: 0.3, wall: 0.7, roof: 0.7, rings: 0.25 }, twoTone: true, spin: true, gobo: true,
    overhead: (f, k) => [k.spin * 0.5 + f.u * TAU, 2.2 + 0.15 * Math.sin(k.m + f.row)],
    stage: (f, k) => [(f.u - 0.5) * 1.8, 2.3 + 0.2 * Math.sin(k.m * 0.6 + f.u * 3)] },
  { name: 'Wall', tier: 'big', w: { overhead: 0.25, stage: 1, wash: 0.5, bars: 0.6, wall: 0.9, roof: 0.35, rings: 0.3 },
    overhead: () => [0, 0.3],
    stage: (f, k) => [(f.u - 0.5) * 0.35, 1.72 + 0.2 * Math.sin(k.m * 0.7)] },
];
const TIER = { intro: 'calm', low: 'calm', groove: 'mid', peak: 'big', break: 'mid' };
const SECTION_LEVEL = { intro: 0.55, low: 0.65, groove: 1, peak: 1, break: 1 };
export const SECTION_NAME = { intro: 'intro', low: 'quiet part', groove: 'groove', peak: 'peak', break: 'break' };
const ROLES = ['overhead', 'stage', 'wash', 'bars', 'wall', 'roof', 'rings'];
const FLOW_NAME = { low: 'quiet', groove: 'full', peak: 'loud' };
const BREAK_LOOK = { overhead: 1, stage: 0.4, wash: 1, bars: 1, wall: 1, roof: 1, rings: 0.35 }, DROP_LOOK = { overhead: 1, stage: 0.8, wash: 0.7, bars: 0.65, wall: 1, roof: 0.75, rings: 0.5 };
// in a break: a slow sway that leans further out as the build-up grows
const BREAK_AIM = {
  overhead: (f, k) => [out(f), 0.25 + 0.2 * Math.sin(k.m * 0.6 + f.row) + k.build * 0.9],
  stage: (f, k) => [(f.u - 0.5) * 1.2, 1.8 + k.build * 0.5],
};

export class Director {
  // groups: { role: [fixture] }, each fixture with pos, u, row, rows, xn and a channel object ch
  constructor(groups, moodKey = 'techno', { venue = '' } = {}) {
    this.groups = groups;
    this.venue = venue;
    this.choreography = new LightChoreography(groups);
    this.hangarRig = (groups.overhead || []).some(f => f.props?.hangar);
    this.hangarStage = Math.min(...(groups.overhead || []).filter(f => f.props?.hangar).map(f => f.pos[2])) - 8;   // over the booth
    this.manual = { strobe: false, blinder: false, blackout: false };
    this.w = { ...BREAK_LOOK };   // start in the calm break look instead of with everything on
    Object.assign(this, {
      program: 0, scene: 0, sceneAt: 0, beat: 0, palette: 0, paletteAt: 0, colorIdx: 0, twoTone: 0,
      motion: 0, spin: 0, spinVel: 0, chase: 0, strobeClock: 0, level: 1, laser: 0, smokeAt: -100, haze: 1, visual: 0, house: 0.9, present: 1,
      col: [1, 1, 1], col2: [1, 1, 1], barLevel: [], drops: 0, kickAt: -10, punch: 0,
      coilRun: 0, coilDropAt: -100, coilDropStrength: 0, archPattern: 0, vj: [1, 0, 0], vjBuild: 0, vjDropAt: -100,
      headLook: 'floor', headSet: {}, headTurn: { calm: 0, mid: 3, big: 5 }, headPalette: -1, headAt: -100, headScene: 0, trussLook: 0, trussAt: 0, trussScene: 0, trussPalette: 0, trussTrack: false,
      ringVariant: 0, ringAt: 0, ringScene: -1, ringBreak: false, ringTargets: [...RING_LOOKS[0].drops],
    });
    for (const list of Object.values(groups)) for (const [slot, f] of list.entries()) { f.rp = Math.random() * 2 - 1; f.rt = Math.random(); f.hangarSlot = slot; }
    this.setMood(moodKey);
  }
  setMood(key) { this.mood = MOODS[key]; this.moodKey = key; this.choreography.reset(); this.palette = 0; this.f = null; this.pick('intro'); }
  resetRingLook(t) { this.ringVariant = 0; this.ringTargets = [...RING_LOOKS[0].drops]; this.ringAt = t; this.ringScene = this.scene; this.ringBreak = false; }
  reset(t) { this.choreography.reset(); this.beat = 0; this.colorIdx = 0; this.archPattern = 0; this.sceneAt = t; this.pick('intro'); }
  // the next program for this part of the track, never the one that is already up if there is a choice
  pick(section) {
    const list = PROGRAMS.map((p, i) => [p, i]).filter(([p]) => p.tier === TIER[section]).map(([, i]) => i);
    const at = list.indexOf(this.program);
    this.program = list[at < 0 ? this.scene % list.length : (at + 1) % list.length];
    this.visual = (this.visual + 1) % 8;
  }
  next(t, section) {
    if (t - this.paletteAt >= this.mood.paletteHold) { this.palette++; this.paletteAt = t; }
    this.scene++;
    this.archPattern = (this.archPattern + 1) % 4;
    this.pick(section);
    if (this.scene % this.mood.colorEvery === 0) this.colorIdx++;
    this.sceneAt = t;
  }
  // Hangar: the heads' look and the trusses' formation (see hangar-looks.js). tier: the part of the track. A new
  // palette is the show hearing a new track: it gets two looks of its own for each part of a track, others than
  // the last one had, and the show moves between them at scene cues. The viewer can pin a look or a formation and
  // set the pace.
  hangarLooks(t, tier, brk, controls) {
    const style = styleOf(this.moodKey, this.mood.family), chosen = PACE[controls?.lookPace] || PACE.normal;
    const pace = { head: chosen.head * style.pace, truss: chosen.truss * style.pace, track: chosen.track * style.pace }, track = this.palette !== this.headPalette, cue = this.scene !== this.headScene;
    if (this.styleKey !== this.moodKey) { this.styleKey = this.moodKey; this.headPalette = -1; }   // another kind of music: its own looks straight away
    if (track || this.headPalette === -1) {
      this.headPalette = this.palette; this.headFresh = true;
      for (const part of ['calm', 'mid', 'big']) {
        const own = style.looks.filter(key => HEAD_LOOKS[key]?.tiers.includes(part)), list = own.length >= 2 ? own : HEAD_TIERS[part];   // the genre's looks for this part of a track
        this.headSet[part] = [0, 1].map(i => list[(this.headTurn[part] + i) % list.length]); this.headTurn[part] += 2;
      }
    }
    this.headScene = this.scene;
    if (HEAD_LOOKS[controls?.headLook]) this.headLook = controls.headLook;
    else if (!brk && (this.headFresh || (cue && t - this.headAt >= pace.head) || !HEAD_LOOKS[this.headLook].tiers.includes(tier))) {   // a break keeps its own aim
      const choices = this.headSet[tier], next = choices[(choices.indexOf(this.headLook) + 1) % choices.length];
      if (next !== this.headLook) { this.headLook = next; this.headAt = t; }
      this.headFresh = false;
    }
    // the trusses: at a scene cue once a formation has held its time, sooner for a new track; not during a break
    if (this.palette !== this.trussPalette) { this.trussPalette = this.palette; this.trussTrack = true; }
    const trussCue = this.scene !== this.trussScene, pinned = TRUSS_LOOKS.findIndex(x => x.name === controls?.trussLook);
    this.trussScene = this.scene;
    if (pinned >= 0) this.trussLook = pinned;
    else if (!brk && trussCue && t - this.trussAt >= (this.trussTrack ? pace.track : pace.truss)) {
      let next = (this.trussLook + (this.trussTrack ? 3 : 1)) % TRUSS_LOOKS.length;   // a new track skips ahead for a bigger change
      const fits = i => TRUSS_LOOKS[i].tiers.includes(tier), mine = i => style.trusses.includes(TRUSS_LOOKS[i].name);
      const any = TRUSS_LOOKS.some((x, i) => fits(i) && mine(i));
      while (!fits(next) || (any && !mine(next))) next = (next + 1) % TRUSS_LOOKS.length;   // the genre's formations, where it has one for this part
      this.trussLook = next; this.trussAt = t; this.trussTrack = false;
    }
    this.headName = HEAD_LOOKS[this.headLook].name; this.trussName = TRUSS_LOOKS[this.trussLook].name;
  }
  // sets off everything of one kind: co2, flame, spark, firework, confetti
  fire(what, t) { if (this.off?.[what]) return; for (const f of this.groups[what] || []) f.ch.fire = t + (what === 'firework' ? f.u * 0.5 : 0); if (what === 'co2') this.smokeAt = t; }

  // Music with no beat to count (an orchestra, a piano, ambient): the show follows how loud and how full it is.
  // Returns what the rest of the director reads in place of the listener's signals: the music's own loud and soft
  // as its parts (quiet, full, loud), a swell or an attack as a soft pulse where a kick would be, a slow clock.
  flow(sig, t, dt) {
    const F = this.f ||= { fast: 0, lo: 1, hi: 0, tier: 'low', pulse: 0, lift: 0, clock: 0, prev: 0, since: 0 };
    const e = sig.m.activity < 0.05 ? 0 : sig.energy;
    F.fast += (e - F.fast) * Math.min(1, dt * 5);
    // the piece's own range, forgotten slowly, so that quiet music still has its loud and its soft
    F.hi = Math.max(F.hi - dt * 0.004, F.fast, 0.08); F.lo = Math.min(F.lo + dt * 0.004, F.fast);
    const rel = Math.max(0, Math.min(1, (F.fast - F.lo) / Math.max(0.05, F.hi - F.lo)));
    const tier = rel > (F.tier === 'peak' ? 0.6 : 0.75) ? 'peak' : rel > (F.tier === 'low' ? 0.35 : 0.22) ? 'groove' : 'low';
    const ev = { kick: 0, from: null, lift: false, drop: false, silent: sig.ev.silent, trackEnded: sig.ev.trackEnded };
    F.since += dt;
    if (tier !== F.tier && F.since > 6) { ev.from = F.tier; ev.lift = tier === 'peak'; F.tier = tier; F.since = 0; }
    const rising = Math.max(0, (F.fast - F.prev) / Math.max(dt, 1e-3)); F.prev = F.fast;
    F.pulse = Math.max(F.pulse * Math.exp(-dt * 2.5), Math.min(1, rising * 1.2), (sig.accent || 0) * 0.6);
    if (ev.lift) F.lift = 1;
    F.lift *= Math.exp(-dt * 0.8); F.clock += dt * (0.5 + rel * 0.5);
    return { m: { phase: 'groove', section: F.tier, build: 0, riser: 0, activity: sig.m.activity, hasGrooved: true, bpm: sig.m.bpm }, ev, kick: F.pulse * 0.5, accent: sig.accent || 0, drop: 0, lift: F.lift, hype: F.tier === 'peak' ? 0.35 : 0,
      energy: 0.25 + rel * 0.6, bass: sig.bass, mid: sig.mid, treble: sig.treble, phase: F.clock, sinceBreak: 0 };
  }

  // sig: Signals; look: { light, haze } from the viewer, both 1 when untouched, and off: the roles switched off
  update(sig, t, dt, look = { light: 1, haze: 1 }) {
    this.off = look.off || {};
    const mood = this.mood, G = this.groups, controls = look.controls;
    const theme = this.venue === 'hangar' ? SHOW_THEMES[controls?.showTheme] : null;
    if (mood.flow) sig = this.flow(sig, t, dt);
    const m = sig.m, ev = sig.ev;
    const section = m.section, calm = m.phase !== 'break' && TIER[section] === 'calm';

    if (ev.drop) { this.coilDropAt = t; this.coilDropStrength = clamp(ev.kick || sig.drop || 1); }

    // ----- what just happened in the music -----
    if (ev.kick) {
      if (ev.drop) {
        if (ev.breakLength >= mood.paletteBreak) { this.palette++; this.paletteAt = t; }   // a long break earns a new palette
        this.beat = 0; this.next(t, section); this.pendingChange = null;
        const fx = mood.fx; this.drops++;
        for (const kind of ['co2', 'flame', 'spark']) if (fx[kind]) this.fire(kind, t);
        for (const kind of ['firework', 'confetti']) if (fx[kind] && this.drops % fx[kind] === 0) this.fire(kind, t);
        this.smokeAt = t;
      }
      // Beats, not kicks, counted from the drop or from where the track came in: a kick that was missed or held back for
      // a bar or two moves the count on by the beats it was gone, so that the 1 of a phrase stays the 1.
      const before = this.beat, gone = Math.round((ev.kickGap || 0) * (sig.stableBpm || m.bpm || 128) / 60);
      this.beat += before > 0 && gone > 1 && gone <= 16 ? gone : 1;
      this.kickAt = t; this.punch = ev.kick;
      // the first beat of a group of n (beats 1, n + 1, 2n + 1...): where a phrase or a pair of bars starts
      const first = n => this.beat > 1 && Math.floor((before - 1) / n) !== Math.floor((this.beat - 1) / n);
      this.barStart = this.beat === 1 || first(8);
      // hold a scene for a musical phrase, changing on its first beat; a calm part holds its look twice as long
      const hold = calm ? 2 : 1;
      if (first(mood.sceneKicks * hold) && t - this.sceneAt >= mood.sceneMin * hold) this.next(t, section);
      const bars = G.bars || [], pattern = Math.floor((this.beat - 1) / 32) % 4, mid = (bars.length - 1) / 2;
      for (let i = 0; i < bars.length; i++) {
        const on = pattern === 0 ? true : pattern === 1 ? i % 2 === this.beat % 2 : pattern === 2 ? Math.abs(i - mid) < (this.beat % 4 + 1) * bars.length / 8 : i % 4 === this.beat % 4;
        if (on) this.barLevel[i] = ev.kick;
      }
      if (this.barStart) for (const role of ['overhead', 'stage']) for (const f of G[role] || []) { f.rp = Math.random() * 2 - 1; f.rt = Math.random(); }
    } else this.barStart = false;
    if (ev.silent) { if (ev.trackEnded && t - this.paletteAt > 60) { this.palette++; this.paletteAt = t; } this.beat = 0; }
    if (ev.from) {
      // the track moved to another part while the kick kept going: a new look that fits it
      if (ev.from !== 'break' && section !== 'break' && !ev.drop) this.pendingChange = { section, at: t };
      else if (ev.from === 'break' && PROGRAMS[this.program].tier !== TIER[section]) { this.pick(section); this.sceneAt = t; }
    }
    if (ev.lift && t - this.sceneAt >= mood.sceneMin - 4) this.pendingChange = { section, at: t - 3, lift: true };
    if (mood.flow && t - this.sceneAt >= mood.sceneMin) this.next(t, section);   // with no kicks to count, a scene lasts its time
    // A new part of the track, or a layer coming in, changes the look on the first beat of the next pair of bars (a
    // new part once it has lasted three seconds); the count of the phrase goes on.
    if (this.pendingChange) {
      const pending = this.pendingChange;
      if (ev.drop || (!pending.lift && pending.section !== section) || section === 'break') this.pendingChange = null;
      else if (this.barStart && t - pending.at >= 3 && t - this.sceneAt >= 12) { this.next(t, section); this.pendingChange = null; }
    }

    const composition = this.choreography.update(this.venue === 'hangar' ? controls?.lightChoreography : 'original', this.scene, sig.phase, section);
    // for the camera: which composition is playing, when it started and how many beats it has had
    this.lightCue = composition.active ? { key: composition.key, started: composition.started, age: composition.age } : null;

    // ----- the look, eased -----
    const brk = m.phase === 'break', P = PROGRAMS[this.program], ease = seconds => 1 - Math.exp(-dt / seconds);
    const accent = brk ? 0 : Math.min(0.55, Math.max(sig.hype * 0.55, section === 'peak' ? 0.25 : 0));
    for (const role of ROLES) {
      const base = brk ? BREAK_LOOK[role] : P.w[role] ?? 0;
      this.w[role] += (base + (DROP_LOOK[role] - base) * accent - this.w[role]) * ease(brk ? 0.65 : 1.4);
    }
    this.twoTone += ((P.twoTone || sig.hype > 0.4 ? 1 : 0) - this.twoTone) * ease(1.1);
    this.level += (SECTION_LEVEL[section] - this.level) * ease(1.5);
    // The themed wall develops within its image family: quiet, building or at a peak. The weights ease, so a drop
    // opens the wall within about a second and nothing cuts; the build's shape is held while it fades out.
    const rising = brk ? Math.min(1, Math.max(0, m.build)) : 0, swell = rising * rising * (3 - 2 * rising);
    const vjTarget = brk ? [1 - swell, swell, 0] : section === 'peak' ? [0, 0, 1] : calm ? [1, 0, 0] : [0.45, 0, 0.55];
    if (ev.drop) this.vjDropAt = t;
    const vjEase = ease(t - this.vjDropAt < 1.5 ? 0.45 : brk ? 1.2 : 2.4);
    this.vj = this.vj.map((w, i) => w + (vjTarget[i] - w) * vjEase);
    if (brk) this.vjBuild = rising;
    const manualPalette = PALETTES[controls?.palette] || theme;
    const pal = manualPalette ? manualPalette.colors.map(hex) : mood.palettes[this.palette % mood.palettes.length];
    this.col = mix(this.col, pal[this.colorIdx % pal.length], ease(1.1));
    this.col2 = mix(this.col2, pal[(this.colorIdx + 1) % pal.length], ease(1.1));
    const col = this.col, col2 = this.col2, man = this.manual;
    // how much music there is: a quiet passage of an orchestra is still a concert, and silence between two pieces is not a blackout
    this.present += ((mood.flow ? (m.activity > 0.03 ? 0.6 + 0.4 * m.activity : 0.3) : m.activity) - this.present) * (mood.flow ? ease(1.5) : 1);
    const master = man.blackout ? 0 : Math.max(this.present * this.level, man.strobe || man.blinder ? 1 : 0) * mood.level * look.light;
    const tint = c => !manualPalette && mood.warm ? mix(c, WARM, mood.warm) : c;
    const speed = mood.speed * (0.35 + sig.energy * 1.2 + sig.mid * 0.65 + sig.kick * 0.35) * (calm ? 0.6 : 1);
    this.motion += dt * speed * m.activity;
    this.spinVel += ((!brk && P.spin ? speed * 1.4 : 0) - this.spinVel) * Math.min(1, dt * 2);
    this.spin += this.spinVel * dt;
    // advance clocks by rate times time step: multiplying a clock by a changing rate makes a pattern jump
    this.chase += dt * (4 + m.build * 14);
    this.strobeClock += dt * (brk && !man.strobe ? 6 + m.build * 12 : 14) * mood.strobeRate;
    const smokeAge = t - this.smokeAt, smoke = (1 - Math.exp(-smokeAge * 1.5)) * Math.exp(-smokeAge / 22);
    this.smoke = Math.max(smoke, look.haze - 1);
    this.haze = mood.haze * (1 + this.smoke * 0.35) * (look.haze < 1 ? 0.15 + 0.85 * look.haze : 1 + (look.haze - 1) * 2);

    // ----- strobes and blinders -----
    const strobing = man.strobe || (mood.strobes && ((brk && m.riser > mood.strobeAt) || sig.drop > 0.55));
    const flash = this.flash = strobing && Math.floor(this.strobeClock) % 2 === 0 ? 1 : 0;
    const blind = this.blind = Math.max(man.blinder ? 1 : 0, Math.pow(sig.drop, 1.5) * mood.blinder);
    for (const f of G.strobe || []) { f.ch.dim = flash * master; f.ch.color = WHITE; }
    for (const f of G.blinder || []) { f.ch.dim = blind * master; f.ch.color = WARM; }

    // ----- the moving heads -----
    // Structural positions hold for long phrases. Breaks lower the rings, drops request a rise; the actual
    // winches keep their speed and acceleration limits through every cue, including a direction change.
    const manualRing = RING_NAMES.indexOf(controls?.ringLook);
    if (manualRing >= 0) { this.ringVariant = manualRing; this.ringTargets = [...RING_LOOKS[manualRing].drops]; this.ringAt = t; this.ringScene = this.scene; }
    else if (ev.drop) { this.ringTargets = [0.2, 0.5]; this.ringAt = t; this.ringScene = this.scene; }
    else if (brk && !this.ringBreak && m.hasGrooved) { this.ringTargets = [2.8, 2.1]; this.ringAt = t; }
    else if (!brk && m.activity > 0.15 && this.scene !== this.ringScene && t - this.ringAt >= 40) {
      this.ringVariant = (this.ringVariant + 1) % RING_LOOKS.length;
      this.ringTargets = [...RING_LOOKS[this.ringVariant].drops]; this.ringAt = t; this.ringScene = this.scene;
    }
    this.ringBreak = brk;
    this.ringLook = RING_LOOKS[this.ringVariant].name;
    const k = { m: this.motion, spin: this.spin, phase: sig.phase, build: m.build, t, hangarLook: this.scene % 3, ringVariant: brk && manualRing < 0 ? 1 : this.ringVariant };
    const aims = brk ? BREAK_AIM : P;
    if (this.hangarRig) this.hangarLooks(t, TIER[section], brk, controls);
    const headLook = HEAD_LOOKS[this.headLook], s = { beat: this.beat, section, build: m.build, energy: sig.energy, drop: sig.drop, stage: this.hangarStage };
    this.beamPeak = 0;
    for (const role of ['overhead', 'stage']) for (const f of G[role] || []) {
      let [pan, tilt] = role === 'overhead'
        ? ((f.props?.hangar ? (brk ? aimHangar(f, k, this.beat, section, m.build, sig.energy, sig.drop) : aimLook(headLook, f, k, s)) : null) || aims[role](f, k))
        : aims[role](f, k);
      if (composition.active) [pan, tilt] = composition.aim(f, pan, tilt);
      if (f.props?.hangar) {
        // Crossfade the requested aim as well as limiting the physical motors.
        const aim = f.hangarAim ||= [f.ch.pan, f.ch.tilt];
        const panGap = Math.atan2(Math.sin(pan - aim[0]), Math.cos(pan - aim[0]));
        const gap = Math.hypot(panGap, tilt - aim[1]);
        const cue = `${this.scene}:${Math.floor((this.beat - 1) / 16)}`;
        if (f.hangarCue !== cue) {
          if (f.hangarCue !== undefined && gap > 0.55) f.hangarMoveAt = t;
          f.hangarCue = cue;
        }
        const moving = t - (f.hangarMoveAt ?? -100) < 5 && gap > 0.2;
        f.hangarMoveLevel = (f.hangarMoveLevel ?? 1) + ((moving ? 0.2 : 1) - (f.hangarMoveLevel ?? 1)) * ease(moving ? 0.1 : 0.7);
        if (t - (f.hangarMoveAt ?? -100) > 0.18) {
          aim[0] += panGap * ease(2.5);
          aim[1] += (tilt - aim[1]) * ease(2.5);
        }
        f.ch.pan = aim[0]; f.ch.tilt = aim[1];
      } else { f.ch.pan = pan; f.ch.tilt = tilt; }
      f.ch.slow = f.props?.hangar || (!brk && P.slow);
      let I = brk ? 0.1 + sig.mid * 0.15 + m.build * 0.3 : 0.045 + sig.energy * 0.23 + sig.bass * 0.12 + sig.kick * 0.55 + sig.accent * 0.1;
      I = (I * this.w[role] * (!brk && P.gate ? P.gate(f, k) : 1) + sig.drop * 0.5) * master * (1 + this.smoke * 0.3);
      if (composition.active) {
        I *= composition.gain(f, role, dt);
      } else if (f.props?.hangar) {
        // Give the centre, sides and stage turns in the foreground; a drop opens the full rig.
        const bank = role === 'stage' ? 2 : Math.abs(f.pos[0]) > 18 ? 1 : 0;
        if (!brk && Math.floor((sig.beats || 0) / 2) % 3 === bank) I += sig.accent * 0.18 * master;
        // the genre's share of lit heads: the rest stay dark outside a drop (hypnotic: a few beams in the haze)
        const lit = styleOf(this.moodKey, this.mood.family).lit;
        if (!brk && lit < 1 && ((f.row * 7.31 + f.u * 13.7) % 1) > lit) I *= clamp(sig.drop) * 0.9;
        const foreground = brk ? bank === 2 : bank === this.scene % 3;
        const level = foreground ? 1 : calm || brk ? 0.28 : 0.45;
        f.hangarLevel = (f.hangarLevel ?? 1) + (level - (f.hangarLevel ?? 1)) * ease(1.8);
        I *= f.hangarLevel + (1 - f.hangarLevel) * clamp(sig.drop);
        // Hold each figure for 32 kicks. Builds progressively leave a small group near the stage.
        const beats = sig.beats || 0, pattern = Math.floor(beats / 32) % 6;
        const build = clamp(m.build);
        const buildOn = Math.abs(f.xn) <= 1 - build * 0.85 && (build < 0.65 || bank === 2 || f.row % 3 === 0);
        const gate = role === 'overhead' ? headLook.gate : 'patterns', counted = calm ? beats / 2 : beats;
        const on = brk ? buildOn : GATES[gate](f, counted, pattern);
        f.hangarGate = (f.hangarGate ?? 1) + ((on ? 1 : 0) - (f.hangarGate ?? 1)) * ease(0.08);
        const gain = calm || brk ? 1 : GATE_GAIN[gate] ?? ([1, 2, 4].includes(pattern) ? 2.5 : 1.5);
        I *= (f.hangarGate + (1 - f.hangarGate) * clamp(sig.drop)) * (gain + (1 - gain) * clamp(sig.drop));
        I *= f.hangarMoveLevel + (1 - f.hangarMoveLevel) * clamp(sig.drop);
      }
      f.ch.dim = I; this.beamPeak = Math.max(this.beamPeak, I);
      f.ch.color = brk ? mix(col, WHITE, m.build) : tint((f.row + Math.round(f.u * 9)) % 2 ? mix(col, col2, this.twoTone) : col);
      if (f.props?.hangar) {
        // The look spreads the two colours (by default the sides swap every 32 beats), through a slow colour fade.
        const [second, white] = COLOURS[role === 'overhead' ? headLook.colour : 'sides'](f, sig.beats || 0);
        const target = tint(vivid(mix(mix(col, col2, second), WHITE, white)));
        f.hangarColor = mix(f.hangarColor || f.ch.color, brk ? mix(target, WHITE, clamp(m.build) * 0.35) : target, ease(1.4));
        f.ch.color = f.hangarColor;
      }
      f.ch.zoom = (brk ? 1 - m.build * 0.4 : 1) * (controls?.beamWidth ?? 1);
      if (f.props?.hangar) f.ch.zoom *= calm || brk ? 1.35 : section === 'peak' ? 0.75 : 0.9;
      f.ch.gobo = !brk && P.gobo ? 1 : 0;
      if (f.props?.hangar) { f.ch.gobo = !brk && !calm ? 0.7 : 0; f.ch.goboMode = role === 'stage' ? 2 : Math.abs(f.pos[0]) > 18 ? 0 : 1; }
      if (f.props?.hangar && role === 'overhead' && !brk) {   // the look's beam: narrow, wide or with a gobo
        const beam = BEAMS[headLook.beam];
        f.ch.zoom *= beam.zoom; if (beam.gobo !== null) f.ch.gobo = beam.gobo;
      }
    }

    // ----- washes, bars, lasers, the LED wall -----
    for (const f of G.wash || []) {
      f.ch.dim = Math.max((brk ? 0.25 + m.build * 0.3 : 0.12 + sig.energy * 0.3 + sig.kick * 0.25 + mood.breathe * sig.mid) * this.w.wash, mood.wash) * master + sig.lift * 0.3 * master;
      f.ch.color = tint(f.row % 2 ? col2 : !manualPalette && mood.accent ? mix(col, mood.accent, 0.6) : col);   // a mood can warm its washes against its own colour
    }
    const bars = G.bars || [];
    for (let i = 0; i < bars.length; i++) {
      this.barLevel[i] = (this.barLevel[i] || 0) * Math.exp(-dt * mood.decay);
      const breathe = mood.breathe > 0 || brk ? (0.25 + mood.breathe) * sig.mid * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.6)) : 0;
      const run = brk ? m.build * Math.pow(0.5 + 0.5 * Math.sin(bars[i].u * 5 + bars[i].row + this.chase), 4) : 0;   // a chase racing along as the build-up grows
      bars[i].ch.dim = Math.max(Math.max(this.barLevel[i], breathe, run, sig.accent * (i % 2 === this.beat % 2 ? 0.5 : 0.1)) * this.w.bars, sig.drop, sig.lift * 0.45) * master;
      bars[i].ch.color = i % 2 ? col2 : col;
    }
    // Each coil is a separate ring: light travels around it, fills it in a build and spreads on a drop.
    // Their streams run in opposite directions, with their own phases, outside the ordinary bar chases.
    const coilRate = (0.035 + sig.energy * 0.055 + (brk ? m.build * 0.12 : 0)) * m.activity;
    this.coilRun += dt * coilRate;
    for (const f of G.coil || []) {
      const settings = controls?.coils?.[f.props.bank], automatic = !settings || settings.mode === 'auto';
      const direction = settings?.direction === 'forward' ? 1 : settings?.direction === 'reverse' ? -1 : f.props.direction ?? 1;
      // Integrate each ring's phase so changing speed or direction never jumps to a different position.
      f.coilPhase = (f.coilPhase ?? f.props.offset ?? 0) + dt * coilRate * (settings?.speed ?? 1) * direction;
      const mode = automatic ? calm ? 0 : brk ? 1 : this.ringVariant : +settings.mode;
      Object.assign(f.ch, { color: vivid(col2), color2: vivid(col), run: f.coilPhase, build: automatic && brk ? m.build : 0,
        mode, pulse: mode === 3 ? sig.kick * 0.2 : 0,
        energy: sig.energy, kick: brk ? 0 : sig.kick, dropAt: automatic ? this.coilDropAt : -100, dropStrength: automatic ? this.coilDropStrength : 0 });
      f.ch.dim = (calm ? 0.6 : 0.85) * master;
    }
    const laserOn = mood.lasers && m.activity > 0.3 && ((!brk && section === 'peak' && t - this.sceneAt > 6) || (mood.lasers === 'both' && brk && m.build < 0.6 && sig.sinceBreak > 4));
    this.laser += ((laserOn ? 1 : 0) - this.laser) * ease(2);
    // lasers: every scene another figure (a fan of lines, sheets over the crowd, a tunnel), in the show's two colours
    for (const f of G.laser || []) { f.ch.dim = this.laser * (0.55 + sig.kick * 0.25) * master * (theme?.laserLevel ?? 1); f.ch.color = Math.round(f.u * 9) % 2 ? col2 : col; f.ch.mode = theme?.laser ?? this.scene % 3; }
    // the trusses on their winches: a new arrangement with every scene (level, a staircase rising to the back, a slow
    // wave, tilted against each other); in a break they sink low over the crowd, and on the drop they fly back up
    const shape = this.scene % 4;
    for (const f of G.truss || []) {
      if (f.props.kind === 'ring') {
        f.ch.drop = this.ringTargets[f.props.bank === 'inner' ? 0 : 1];
        f.ch.hold = m.activity < 0.05 || !!this.off.truss;
        f.ch.roll = 0;
        continue;
      }
      const v = f.rows > 1 ? f.row / (f.rows - 1) : 0;
      if (f.props?.hangar) {
        // Heavy Hangar trusses hold a formation for minutes. In a break they sink further as the build grows, in a
        // measured wave, and level out; the drop takes them back up to the formation.
        const formation = TRUSS_LOOKS[this.trussLook], base = formation.drop(v, f.row);
        f.ch.drop = brk && m.hasGrooved ? Math.min(DEEPEST, base + m.build * 2 + Math.max(0, Math.sin(v * TAU - m.build * Math.PI)) * m.build * 1) : base;   // never lower than 5.5 m
        f.ch.roll = formation.roll && !brk ? formation.roll(f.row) : 0;
        continue;
      }
      f.ch.drop = brk && m.hasGrooved ? 2.2 + m.build * 1.6 : sig.drop > 0.3 ? 0 : shape === 1 ? (1 - v) * 3.2 : shape === 2 ? 1.6 + 1.6 * Math.sin(v * 4 + t * 0.12) : shape === 3 ? 1 : 0;
      f.ch.roll = !brk && shape === 3 ? (f.row % 2 ? 0.16 : -0.16) : 0;
    }
    for (const role of ['wall', 'dome', 'screen']) for (const f of G[role] || []) {   // 'dome' and 'screen' are screens that are part of the place: they stay on when LED walls are switched off
      f.ch.dim = ((brk ? 0.6 : 0.9 + sig.kick * 0.4) * this.w.wall + sig.drop + sig.lift * 0.35) * master * (role === 'screen' ? 0.75 : role === 'dome' ? 1.5 : 1);
      f.ch.color = col; f.ch.color2 = col2; f.ch.mode = this.visual; f.ch.build = m.build; f.ch.kick = sig.kick; f.ch.phase = sig.phase; f.ch.off = !!this.off[role];
      f.ch.theme = role === 'wall' ? theme?.visual ?? 0 : 0; f.ch.vj = this.vj; f.ch.vjBuild = this.vjBuild;
    }
    // light on the building itself: steady, in the show's colours, fuller when the music is
    for (const f of G.glow || []) { f.ch.dim = (brk ? 0.45 + m.build * 0.3 : 0.4 + sig.energy * 0.45 + sig.kick * 0.2 + sig.lift * 0.3) * master; f.ch.color = tint((f.row + Math.round(f.u * 9)) % 2 ? col2 : col); }
    // a floor of lit tiles: another pattern with every scene, stepping on the beat
    for (const f of G.floor || []) { Object.assign(f.ch, { color: col, color2: col2, phase: sig.phase, mode: this.scene }); f.ch.dim = ((brk ? 0.35 + m.build * 0.5 : 0.6 + sig.kick * 0.4) + sig.drop) * master; }
    for (const f of G.pool || []) { f.ch.dim = (0.6 + sig.kick * 0.3 + sig.lift * 0.3) * (man.blackout ? 0 : look.light); f.ch.color = col; }
    // strings of lamps are part of the place, not of the show; the house lights come up when the music stops
    const lamps = man.blackout ? 0 : look.light, idle = m.activity < 0.05;
    this.house += ((idle ? 0.9 : mood.house) - this.house) * ease(idle ? 2.5 : 4);
    for (const f of G.festoon || []) f.ch.dim = (0.55 + sig.kick * 0.25 + sig.lift * 0.2) * lamps;
    for (const f of G.house || []) f.ch.dim = this.house * lamps;
    // the kinetic ceiling: a new shape with every scene; in a break it sinks low over the crowd and glows, on the drop
    // it flashes and flies up
    for (const role of ['kinetic', 'triangles']) for (const f of G[role] || []) {   // 'triangles': a raster of them on winches over a stage, which moves as the ceiling does
      Object.assign(f.ch, { color: col, color2: col2, mode: this.scene % 6, phase: sig.phase, kick: sig.kick, pattern: P.spin ? 1 : 0, low: brk ? 1 : 0, lift: sig.drop });
      f.ch.dim = (brk ? 0.3 + m.build * 0.6 : 0.45 + sig.energy * 0.45) * master;
      f.ch.flash = (sig.drop * 0.7 + flash * 0.4 + sig.lift * 0.3) * master;
    }
    for (const kind of ['firework', 'spark']) for (const f of G[kind] || []) f.ch.color = col;
    // The arches keep one architectural gesture for the scene, then change direction,
    // grouping or pace at the next cue instead of repeating the same kick chase.
    for (const f of G.arch || []) {
      Object.assign(f.ch, { color: col, color2: col2, phase: sig.phase, beat: this.beat, pattern: this.archPattern,
        kickPulse: Math.exp(-Math.max(0, t - this.kickAt) * 5),
        travel: brk || this.archPattern === 3 ? 99 : (t - this.kickAt) * 18 - 0.5,
        chase: brk ? m.build : section === 'peak' ? 0.5 : 0.12 });
      f.ch.dim = (brk ? 0.25 + m.build * 0.7 : calm ? 0.5 : this.archPattern === 3 ? 0.68 : 0.9) * master;
      f.ch.flash = (sig.drop * 0.8 + flash * 0.35) * master;
      if (f.props?.hangar) {
        const partner = Math.floor((sig.beats || 0) / 32) % 6;
        f.ch.pattern = theme ? brk || calm ? 3 : theme.arch : partner === 0 || partner === 5 ? 2 : partner === 3 ? 1 : partner === 4 ? 0 : 3;
        f.ch.color = col2; f.ch.color2 = col; f.ch.beat = (sig.beats || 0) + 4;
        f.ch.travel = brk || f.ch.pattern === 3 ? 99 : (t - this.kickAt) * 18 - 0.5;
        f.ch.dim = (brk ? 0.25 + m.build * 0.7 : calm ? 0.5 : f.ch.pattern === 3 ? 0.68 : 0.9) * master;
      }
    }
    for (const f of G.arch || []) {
      delete f.ch.archCentre;
      if (composition.active) composition.arch(f.ch);
    }
    // LED under the spokes of a round roof. A kick sends a band of light along them, and every 32 kicks it goes
    // another way: out from the lantern along all of them, along every other one, along every fourth (stepping
    // round with the beat), or in from the wall. Calm music breathes through the roof, a build-up races in to the
    // lantern, a program that spins turns blades of light round the hall, and the highs glitter at the peak.
    const way = Math.floor((this.beat - 1) / 32) % 4;
    for (const f of G.roof || []) {
      Object.assign(f.ch, { color: col, color2: mix(col, col2, this.twoTone), kickAt: this.kickAt, punch: this.punch, beat: this.beat, pick: way === 1 ? 1 : way === 2 ? 2 : 0, inward: way === 3,
        span: Math.min(0.38, 51 / (m.bpm || 128)), kick: brk ? 0 : sig.kick, swell: brk ? 0.3 * (1 - m.build) : (calm ? 0.2 : 0) + mood.breathe * (0.3 + sig.mid),
        chase: brk ? m.build : 0, run: this.chase, blades: !brk && P.spin ? 0.8 : 0, turn: this.spin });
      f.ch.dim = this.w.roof * master; f.ch.flash = Math.max(sig.drop, sig.lift * 0.45) * master;
      f.ch.glitter = brk ? 0 : sig.accent * (section === 'peak' ? 0.6 : 0.2) * this.w.roof * master; f.ch.white = flash * 0.5 * master;
      // the ring at the lantern's foot: in the show's colour while there is music, the hall's own warm lamp when there is none
      f.ch.hub = (0.22 + (brk ? m.build * 0.6 : sig.kick + sig.drop)) * master; f.ch.house = clamp((this.house - mood.house) / (0.9 - mood.house)) * 0.9 * lamps;
    }
    // LED round the ring trusses: patches of light that turn, every other ring the other way, and all of it together
    // on a kick. In a program that runs through the rig on the beat, the patches go round in four beats. A mood's
    // second colour may be a dark one, which LED shows as hardly any light: the rings take its hue at full strength.
    for (const f of G.rings || []) {
      const quiet = brk ? 0.35 : 1;
      Object.assign(f.ch, { color: vivid(col2), turn: (f.row % 2 ? 1 : -1) * (!brk && P.gate ? sig.phase * TAU / 4 : this.motion * 3), patch: (0.15 + sig.mid * 0.75) * quiet, pulse: (sig.kick * 0.65 + sig.accent * 0.3) * quiet });
      f.ch.dim = this.w.rings * master; f.ch.flash = sig.drop * master;
    }
    // the mirror ball: for the quiet of a break and the calm parts, and a glimmer the rest of the time
    for (const f of G.ball || []) { f.ch.dim = (brk ? 0.5 + m.build * 0.5 : calm ? 0.75 : 0.2 + sig.lift * 0.5) * master; f.ch.color = mix(col, WHITE, 0.55); }
    for (const f of G.hazer || []) f.ch.dim = this.haze;

    // the room itself: how much of all this lands on walls, floor and crowd, and in what colour
    this.room = {
      color: mix(col, WHITE, Math.max(flash, blind * 0.7)),
      level: (1.5 + sig.energy * 7 + sig.kick * 26 + m.build * 6 + sig.lift * 14 + flash * 100 + blind * 50) * master,
    };
    // Apply group faders to every light channel, including roof flashes and decorative lamps.
    let before = 0, after = 0;
    for (const [role, list] of Object.entries(G)) {
      if (role === 'truss' || role === 'hazer') continue;
      const gain = this.off[role] ? 0 : controls?.levels?.[role] ?? 1;
      for (const f of list) {
        before += f.ch.dim || 0;
        for (const key of ['dim', 'flash', ...(role === 'roof' ? ['glitter', 'white', 'hub', 'house'] : [])]) if (typeof f.ch[key] === 'number') f.ch[key] *= gain;
        after += f.ch.dim || 0;
      }
    }
    this.beamPeak = Math.max(0, ...[...(G.overhead || []), ...(G.stage || [])].map(f => f.ch.dim));
    this.room.level *= before > 0 ? after / before : 1;
    // what the viewer has switched off stays dark
    for (const role in this.off) if (this.off[role]) for (const f of G[role] || []) { f.ch.dim = 0; f.ch.flash = 0; if (role === 'truss' && f.props.kind !== 'ring') f.ch.drop = f.ch.roll = 0; if (role === 'roof') f.ch.glitter = f.ch.white = f.ch.hub = 0; }
    this.status = brk ? (m.build > 0.45 ? 'build-up' : 'break') : (mood.flow ? FLOW_NAME[section] : SECTION_NAME[section]) + ' · ' + (this.hangarRig ? this.headName : P.name);
    if (composition.active) this.status += ' · ' + CHOREOGRAPHIES[composition.key].name;
    return this;
  }
}

// which way a head with these channels points, as [x, y, z]
export const aim = (pan, tilt) => [Math.sin(tilt) * Math.sin(pan), -Math.cos(tilt), Math.sin(tilt) * Math.cos(pan)];
export { clamp };
