// Serializable show settings. Validate stored data before it reaches the live rig.
export const DEFAULT_OFF = { laser: true, flame: true, firework: true, wall: true };
export const LIGHT_ROLES = ['overhead', 'stage', 'wash', 'coil', 'rings', 'roof', 'triangles', 'kinetic', 'bars', 'arch', 'wall', 'screen', 'dome', 'floor', 'strobe', 'blinder', 'laser', 'ball', 'glow', 'house', 'festoon', 'pool'];
export const PALETTES = {
  warm: { name: 'Warm', colors: [0xffa030, 0xff5030, 0xffd9a8] },
  cool: { name: 'Cool', colors: [0x3060ff, 0x20d0e0, 0x9070ff] },
  white: { name: 'White', colors: [0xffffff] },
  vivid: { name: 'Colourful', colors: [0xff2080, 0x20d0ff, 0xa030ff, 0xffb020] },
};
export const RING_NAMES = ['Crown', 'Tunnel', 'Arena', 'Layers'];
export const COIL_MODES = ['Stream', 'Two packets', 'Quadrants', 'Pulse', 'Solid'];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const numberIn = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
export function parseStored(value, fallback = {}) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
export function normalizeControls(value) {
  const input = object(value), levels = {}, coils = {};
  for (const role of LIGHT_ROLES) levels[role] = numberIn(object(input.levels)[role], 1, 0, 1.5);
  for (const bank of ['inner', 'outer']) {
    const ring = object(object(input.coils)[bank]);
    coils[bank] = { mode: choice(ring.mode, ['auto', '0', '1', '2', '3', '4'], 'auto'), speed: numberIn(ring.speed, 1, 0, 3), direction: choice(ring.direction, ['auto', 'forward', 'reverse'], 'auto') };
  }
  return { levels, coils, ringLook: choice(input.ringLook, ['auto', ...RING_NAMES], 'auto'), palette: choice(input.palette, ['auto', ...Object.keys(PALETTES)], 'auto'), beamWidth: numberIn(input.beamWidth, 1, 0.35, 2), cameraSpeed: numberIn(input.cameraSpeed, 1, 0.15, 1) };
}
export function normalizeLook(value) {
  const input = object(value), off = { ...DEFAULT_OFF };
  for (const role of [...LIGHT_ROLES, 'truss', 'co2', 'flame', 'spark', 'firework', 'confetti']) if (typeof object(input.off)[role] === 'boolean') off[role] = input.off[role];
  return { light: numberIn(input.light, 1, 0.1, 1.3), bloom: numberIn(input.bloom, 1, 0, 1.5), haze: numberIn(input.haze, 1, 0, 2), hall: numberIn(input.hall, 1, 0, 4), off };
}
export function normalizePresets(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, 30).flatMap(raw => {
    const p = object(raw);
    if (typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || typeof p.venue !== 'string' || typeof p.mood !== 'string') return [];
    ids.add(p.id);
    const pose = object(p.pose), validPose = ['position', 'quaternion'].every(k => Array.isArray(pose[k]) && pose[k].length === (k === 'position' ? 3 : 4) && pose[k].every(v => typeof v === 'number' && Number.isFinite(v))) && numberIn(pose.fov, 0, 20, 100) === pose.fov && Math.hypot(...pose.quaternion) > 0.001;
    return [{ id: p.id, name: p.name.trim().slice(0, 60), venue: p.venue, mood: p.mood, moodLocked: p.moodLocked === true, cam: p.cam === 'auto' || /^\d+$/.test(String(p.cam)) ? String(p.cam) : 'auto', sens: numberIn(p.sens, 1, 0.5, 2.5), look: normalizeLook(p.look), controls: normalizeControls(p.controls), pose: validPose ? { position: [...pose.position], quaternion: [...pose.quaternion], fov: pose.fov } : null }];
  });
}
