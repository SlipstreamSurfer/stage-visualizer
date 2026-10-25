// Graphics settings, as in a game: four presets from Light to Ultra, and every setting on its own for whoever wants
// to tune them to their computer. Automatic picks a preset from the graphics card the browser reports, and steps
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
};

// High is what the show drew as Normal up to 0.36; Ultra what it drew as High, with more of it.
export const PRESETS = {
  light: { name: 'Light', scale: 0.75, sharp: 1, fps: 30, crowd: 0.4, detail: 0.6, beams: 6, shine: 0, metal: false, bloom: false, smoke: 50 },
  normal: { name: 'Normal', scale: 0.9, sharp: 1, fps: 60, crowd: 0.6, detail: 1, beams: 12, shine: 3, metal: true, bloom: true, smoke: 100 },
  high: { name: 'High', scale: 1, sharp: 1, fps: 0, crowd: 0.8, detail: 1, beams: 18, shine: 6, metal: true, bloom: true, smoke: 150 },
  ultra: { name: 'Ultra', scale: 1, sharp: 1.5, fps: 0, crowd: 1, detail: 1.5, beams: 28, shine: 6, metal: true, bloom: true, smoke: 250 },
};
export const ORDER = ['light', 'normal', 'high', 'ultra'];
export const AUTO_TOP = 'high';   // automatic never picks Ultra: that is for whoever chooses it
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

// A first guess from the name of the graphics card. Built into the processor (Intel, AMD's Radeon Graphics or Vega,
// a phone's): Light. An Apple M chip: Normal, a Pro or Max: High. A card of its own: High. Drawn by the processor
// itself (no graphics card at all): Light. Unknown: Normal.
export function guessPreset(gpu = '') {
  const s = String(gpu).toLowerCase();
  if (!s) return 'normal';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(s)) return 'light';
  if (/apple/.test(s)) return /\b(pro|max|ultra)\b/.test(s) ? 'high' : 'normal';
  if (/geforce|nvidia|quadro|\brtx\b|\bgtx\b|radeon rx|\brx ?\d{3,4}|radeon pro|arc ?a\d/.test(s)) return 'high';
  if (/intel|vega|radeon\(tm\) graphics|radeon graphics|\buhd\b|iris|mali|adreno|powervr/.test(s)) return 'light';
  return 'normal';
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
