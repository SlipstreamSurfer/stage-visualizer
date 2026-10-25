// Graphics settings, as in a game: four presets from Light to Ultra, and every setting on its own for whoever wants
// to tune them to their computer. Automatic measures what this computer keeps up with (Calibration), and steps
// down after sustained slow drawing (when even the lowest resolution does not keep the pace). An explicit choice is
// never overridden; hidden tabs and loading are not measurements. No picture in this file, so the tests run it.
//
// Every option changes the picture at once: the venue is built with room for the most of everything (all of its
// people, every beam, every puff of haze) and the settings say how much of it is drawn. An option marked build would
// build the venue again (there is none now).
//   scale    the share of the screen's pixels drawn, before the steady picture takes its own share off (steady.js)
//   sharp    how far a high-resolution screen (a Retina display) is used: 1 draws one pixel per CSS pixel
//   fps      frames a second at most: 30, 60, or 0 for as many as the screen shows
//   crowd    the share of the venue's crowd that is drawn (the Crowd switch then shows all, half or a quarter of that)
//   detail   how far away people keep their detail (people.js): 1 as tuned, less is coarser sooner
//   beams    how many of the brightest beams light every surface they fall on: the heaviest work on every pixel
//            (the shaders have room for the most, see world.js)
//   shine    of those, how many glint on metal, the stage deck and the floor
//   metal    metal mirrors the hall
//   bloom    the glow round what is bright
//   smoke    how many puffs of haze drift through the hall
//   reflect  the lights mirrored in a sealed floor: the share of the resolution the mirror is drawn at, 0 for none
export const OPTIONS = {
  scale: { name: 'Resolution', live: true, choices: [[0.5, '50%'], [0.6, '60%'], [0.75, '75%'], [0.9, '90%'], [1, '100%']] },
  sharp: { name: 'Sharp screens', live: true, choices: [[1, 'Standard'], [1.5, 'Sharper'], [2, 'Full']] },
  fps: { name: 'Frame rate', live: true, choices: [[30, '30'], [60, '60'], [0, 'Screen']] },
  crowd: { name: 'People drawn', live: true, choices: [[0.25, 'Few'], [0.4, 'Some'], [0.6, 'Many'], [0.8, 'Busy'], [1, 'Packed']] },
  detail: { name: 'People detail', live: true, choices: [[0.6, 'Low'], [1, 'Normal'], [1.5, 'High']] },
  beams: { name: 'Light on surfaces', live: true, choices: [[6, 'Low'], [12, 'Normal'], [18, 'High'], [28, 'Ultra']] },
  shine: { name: 'Glints', live: true, choices: [[0, 'Off'], [3, 'Some'], [6, 'All']] },
  metal: { name: 'Reflections', live: true, choices: [[false, 'Off'], [true, 'On']] },
  bloom: { name: 'Glow', live: true, choices: [[false, 'Off'], [true, 'On']] },
  smoke: { name: 'Haze clouds', live: true, choices: [[50, 'Thin'], [100, 'Normal'], [150, 'Thick'], [250, 'Dense']] },
  reflect: { name: 'Floor reflections', live: true, choices: [[0, 'Off'], [0.2, 'Soft'], [0.35, 'Sharp']] },
};

// High is what the show drew as Normal up to 0.36; Ultra what it drew as High, with more of it.
export const PRESETS = {
  light: { name: 'Light', scale: 0.75, sharp: 1, fps: 30, crowd: 0.4, detail: 0.6, beams: 6, shine: 0, metal: false, bloom: false, smoke: 50, reflect: 0 },
  normal: { name: 'Normal', scale: 0.9, sharp: 1, fps: 60, crowd: 0.6, detail: 1, beams: 12, shine: 3, metal: true, bloom: true, smoke: 100, reflect: 0 },
  high: { name: 'High', scale: 1, sharp: 1, fps: 0, crowd: 0.8, detail: 1, beams: 18, shine: 6, metal: true, bloom: true, smoke: 150, reflect: 0.2 },
  ultra: { name: 'Ultra', scale: 1, sharp: 1.5, fps: 0, crowd: 1, detail: 1.5, beams: 28, shine: 6, metal: true, bloom: true, smoke: 250, reflect: 0.35 },
};
export const ORDER = ['light', 'normal', 'high', 'ultra'];
const OLD = { low: 'light', normal: 'high', high: 'ultra' };   // the names up to 0.36

// A choice as given in a link or kept by the browser: 'auto', a preset, 'custom', or 'low' (Light up to 0.36).
// Anything else is 'auto'. old: kept by a version up to 0.36, whose Normal and High are now High and Ultra.
export function choiceOf(value, old = false) {
  if (old && value in OLD) return OLD[value];
  if (value === 'auto' || value === 'custom' || value in PRESETS) return value;
  return value === 'low' ? 'light' : 'auto';
}
// The settings for a preset, or for custom: a preset with the viewer's own values over it (only known options,
// only values that are among the choices).
export function settingsOf(preset, own = {}) {
  const out = { ...PRESETS[preset in PRESETS ? preset : 'high'] };
  for (const [key, value] of Object.entries(own || {})) if (OPTIONS[key]?.choices.some(([v]) => v === value)) out[key] = value;
  return out;
}
// whether going from one set of settings to another needs the venue built again
export const needsBuild = (a, b) => Object.keys(OPTIONS).some(key => OPTIONS[key].build && a[key] !== b[key]);
// the preset a set of settings is, or 'custom'
export const presetOf = settings => ORDER.find(key => Object.keys(OPTIONS).every(k => PRESETS[key][k] === settings[k])) || 'custom';

// Automatic measures, on whatever computer it is: from Light up, a preset at a time, as long as the picture keeps the
// screen's pace at full resolution (the steady picture is off meanwhile, so it cannot hide a slow card). The first
// preset that does not keep up sends it back to the one before, and that is the one. No card is looked up by its
// name: every computer is different, and only drawing on it tells what it can do.
//   sample(dt, target) is called every frame while it measures: dt the frame's raw length, target the screen's
//   frame time. Returns null while it measures, { next } to try the next preset, or { done } with the one to keep.
const SETTLE = 0.8, MEASURE = 2.5;   // seconds after a change before measuring (the change itself costs a frame or two); how long a preset is measured
export class Calibration {
  constructor(order = ORDER) { this.order = order; this.at = 0; this.frames = []; this.clock = 0; }
  get preset() { return this.order[this.at]; }
  sample(dt, target = 1 / 60) {
    if (!Number.isFinite(dt) || dt <= 0) return null;
    this.clock += Math.min(dt, 0.25);
    if (this.clock < SETTLE) return null;
    this.frames.push(Math.min(dt, 0.25));
    if (this.clock < SETTLE + MEASURE) return null;
    const sorted = this.frames.sort((a, b) => a - b), typical = sorted[sorted.length >> 1];
    const missed = sorted.filter(f => f > target * 1.5).length / sorted.length, keeps = typical <= target * 1.08 && missed < 1 / 12;
    this.frames = []; this.clock = 0;
    if (!keeps) return { done: this.order[Math.max(0, this.at - 1)] };
    if (this.at === this.order.length - 1) return { done: this.preset };
    this.at++;
    return { next: this.preset };
  }
  // a hidden tab or a venue being built is no measurement: that preset is measured again from the start
  pause() { this.frames = []; this.clock = 0; }
}

// The card's name as people know it: "NVIDIA Corporation, NVIDIA GeForce GTX 1660 SUPER/PCIe/SSE2, OpenGL ES 3.2" is
// "NVIDIA GeForce GTX 1660 SUPER"; the driver's details, the bus and the graphics library are left out.
export function cardLabel(name = '') {
  const parts = String(name).replace(/^ANGLE [^:]*:\s*/, '').replace(/\s*\([^)]*\)/g, '').replace(/\/PCIe\/SSE2|\/PCI\/SSE2/g, '').split(/,\s*/);
  for (let i = 0; i < parts.length; i++) parts[i] = parts[i].replace(/\s+(Direct3D|D3D|OpenGL|Vulkan|Metal).*$/i, '');
  const kept = parts.filter(p => p && !/^(OpenGL|Direct3D|Vulkan|Metal|D3D)/i.test(p) && (/\d/.test(p) || parts.length === 1 || /apple m|graphics/i.test(p)));
  return (kept.length ? kept : parts).join(', ').trim();
}

// Automatic: one preset lighter after eight seconds of slow drawing at the lowest resolution. sample() is called
// every frame with its raw length; target: the frame time to keep (seconds). Returns 'down' or null.
export class AutoQuality {
  constructor() { this.reset(); }
  reset() { this.warmup = 6; this.elapsed = 0; this.frames = 0; }
  sample(dt, { visible, ready, automatic, atMin = true, target = 1 / 60, lightest = false }) {
    if (!visible || !ready || !automatic || lightest || !atMin) { this.reset(); return null; }
    if (!Number.isFinite(dt) || dt <= 0) return null;
    // A suspended browser can return one frame with minutes on its clock. Limit that single sample's weight;
    // continuous drawing at one frame a second (or slower) still lowers quality after enough slow frames.
    dt = Math.min(dt, 1);
    if (this.warmup > 0) { this.warmup -= dt; return null; }
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 8) return null;
    const slow = this.frames / this.elapsed < 0.85 / Math.max(target, 1 / 240);
    this.elapsed = this.frames = 0;
    return slow ? 'down' : null;
  }
}
