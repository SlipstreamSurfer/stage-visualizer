// Outdoors: the sky, and what stands round a place or on its horizon. A venue names a sky (shell.sky) and a list of
// surroundings (shell.around: ['sea', 'palms'], or [{ type: 'skyline', drop: 60 }]). To add a kind, add an entry to
// AROUND.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { positionLocal, positionWorld, cameraPosition, vec3, floor, fract, sin, abs, max, pow, mix, step, smoothstep, dot, normalize, atan, exp, reflect, mx_noise_float } from 'three/tsl';
import { box, post, strut, patch } from './shapes.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), va = new THREE.Vector3(), vb = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
const dim = (colour, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(k), fog: false });
// a round limb from one point to another
const limb = (p, r, thick, thin = thick) => { va.set(...p); vb.set(...r); const g = new THREE.CylinderGeometry(thin, thick, va.distanceTo(vb), 7); q.setFromUnitVectors(UP, vb.clone().sub(va).normalize()); return g.applyMatrix4(m4.compose(va.add(vb).multiplyScalar(0.5), q, one)); };

// zenith, horizon: the colour overhead and low down. town: the glow of a town over the horizon. sun and sunAt: a low
// sun and where it is. light: the sky as a lamp (its colour, the ground's, how strong). fog: what distance fades to.
export const SKIES = {
  night:  { zenith: [0.002, 0.003, 0.008], horizon: [0.012, 0.016, 0.03], town: [0.07, 0.045, 0.02], stars: 1, moon: true, light: [0x39404f, 0x14100c, 0.14], fog: [0, 0, 0] },
  city:   { zenith: [0.006, 0.006, 0.013], horizon: [0.05, 0.036, 0.034], town: [0.2, 0.11, 0.05], stars: 0.2, moon: true, light: [0x4a4654, 0x1a1410, 0.24], fog: [0.004, 0.003, 0.003] },
  dusk:   { zenith: [0.01, 0.014, 0.05], horizon: [0.2, 0.08, 0.1], sun: [1.0, 0.4, 0.12], sunAt: [0, 0.035, -1], stars: 0.3, light: [0x7a6688, 0x2a1c14, 0.5], fog: [0.02, 0.008, 0.012] },
  dawn:   { zenith: [0.07, 0.12, 0.26], horizon: [0.5, 0.34, 0.3], sun: [1.0, 0.72, 0.42], sunAt: [0.35, 0.06, -1], stars: 0, light: [0xa8b4cc, 0x4a4038, 1.0], fog: [0.1, 0.085, 0.09] },
  aurora: { zenith: [0.002, 0.004, 0.012], horizon: [0.008, 0.02, 0.03], stars: 1.3, aurora: true, light: [0x2a4a4a, 0x10141a, 0.22], fog: [0, 0.002, 0.002] },
};
const MOON = [-260, 330, 520];

export function buildOutdoors(c) {
  const S = SKIES[c.sh.sky] || SKIES.night;
  c.S = S;
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const d = normalize(positionLocal), high = max(d.y, 0), cell = floor(d.mul(260)), sq = v => v.mul(v);
  const rnd = v => { const p = fract(v.mul(0.3183099).add(0.1)).mul(17); return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z))); };
  let col = mix(vec3(...S.horizon), vec3(...S.zenith), pow(high, 0.5));
  if (S.town) col = col.add(vec3(...S.town).mul(pow(high.oneMinus(), 9)).mul(sin(atan(d.z, d.x).mul(2).add(1)).mul(0.4).add(0.6)));
  if (S.sun) {   // a low sun: a glow over that side of the sky, a brighter heart, and the disc
    const s = max(dot(d, normalize(vec3(...S.sunAt))), 0), sun = vec3(...S.sun);
    col = col.add(sun.mul(pow(s, 8).mul(0.35).add(pow(s, 90).mul(1.2)).add(pow(s, 1500).mul(30)))).add(sun.mul(pow(high.oneMinus(), 6)).mul(s.mul(0.5).add(0.25)).mul(0.5));
  }
  if (S.stars) col = col.add(vec3(0.75, 0.8, 1.0).mul(step(0.9965, rnd(cell))).mul(smoothstep(0.03, 0.25, high)).mul(rnd(cell.add(7)).mul(0.75).add(0.25)).mul(S.stars));
  if (S.aurora) {   // curtains of light over the far side of the sky, slowly folding
    const t = c.env.uTime, a = atan(d.x, d.z.negate()), wave = sin(a.mul(3).add(t.mul(0.05)).add(sin(a.mul(7).sub(t.mul(0.11))).mul(0.6)));
    const band = exp(sq(high.sub(wave.mul(0.07).add(0.3)).mul(5.5)).negate()), rays = sin(a.mul(70).add(sin(a.mul(9).add(t.mul(0.3))).mul(2.5))).mul(0.35).add(0.65), north = smoothstep(-0.3, 0.5, d.z.negate());
    col = col.add(mix(vec3(0.05, 0.9, 0.35), vec3(0.45, 0.15, 0.8), smoothstep(0.28, 0.6, high)).mul(band).mul(rays).mul(north).mul(0.55)).add(vec3(0.02, 0.2, 0.1).mul(exp(sq(high.sub(0.2).mul(3)).negate())).mul(north).mul(0.3));
  }
  mat.colorNode = col;
  c.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat)).renderOrder = -10;
  if (S.moon) { const moon = c.add(new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.35), fog: false }))); moon.position.set(...MOON); moon.lookAt(0, 0, 0); }
  for (const item of c.sh.around || []) {
    const o = typeof item === 'string' ? { type: item } : item;
    if (!AROUND[o.type]) throw new Error(`the venue ${c.L.name} asks for surroundings "${o.type}" that do not exist`);
    AROUND[o.type](c, o);
  }
  return S;
}

// a palm: a leaning trunk and a crown of fronds that hang
export function palm(c, x, z, h = 7) {
  const { put, plain, surface } = c, lean = (Math.random() - 0.5) * 0.25 * h, turn = Math.random() * TAU, tx = x + Math.cos(turn) * lean, tz = z + Math.sin(turn) * lean, bark = surface('dirt', { tint: 0xb8a48a, gain: 2.2 }), leaf = plain(0x1c4a22, { roughness: 0.9, side: THREE.DoubleSide, gain: 3 });
  for (let k = 0; k < 4; k++) { const u0 = k / 4, u1 = (k + 1) / 4, at = u => [x + (tx - x) * u * u, h * u, z + (tz - z) * u * u]; put(bark, limb(at(u0), at(u1), 0.2 - k * 0.025, 0.17 - k * 0.025)); }
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU + Math.random() * 0.4, len = 2.6 + Math.random() * 1.2, dx = Math.cos(a), dz = Math.sin(a), sx = -dz * 0.42, sz = dx * 0.42, lift = 0.5 + Math.random() * 0.5;
    put(leaf, patch([[tx, h, tz], [tx + dx * len * 0.5 + sx, h + lift, tz + dz * len * 0.5 + sz], [tx + dx * len, h - 0.9, tz + dz * len], [tx + dx * len * 0.5 - sx, h + lift, tz + dz * len * 0.5 - sz]]));
  }
}

// windows in a dark front, some of them lit: for a skyline
const fronts = [];
function front(k) {
  return fronts[k] ||= (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#090a0f'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = Math.random(), lit = v < [0.14, 0.28, 0.45][k]; g.fillStyle = lit ? (Math.random() < 0.7 ? `rgb(${200 + Math.random() * 55 | 0},${150 + Math.random() * 50 | 0},${70 + Math.random() * 40 | 0})` : '#a8c4f0') : '#04050a'; g.fillRect(x * 32 + 7, y * 32 + 6, 18, 20); }
    const tex = new THREE.CanvasTexture(cv); tex.userData.shared = true; tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  })();
}
// a house front seen from the street: windows on three floors and a door, the wall left clear
const faces = [];
function face(k) {
  return faces[k] ||= (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      if (y === 2 && x === 1) { g.fillStyle = '#2a1c12'; g.fillRect(52, 92, 24, 36); continue; }
      const lit = Math.random() < 0.3 + k * 0.15; g.fillStyle = '#d8d0c0'; g.fillRect(x * 42 + 9, y * 40 + 9, 26, 28);
      g.fillStyle = lit ? (Math.random() < 0.6 ? '#f0c070' : '#e89a60') : '#0a0c12'; g.fillRect(x * 42 + 12, y * 40 + 12, 20, 22); g.fillStyle = '#d8d0c0'; g.fillRect(x * 42 + 21, y * 40 + 12, 2, 22);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, fog: false, color: new THREE.Color(0.9, 0.9, 0.9) });
    mat.userData.shared = true; return mat;
  })();
}
// a ring of ridges on the horizon: { r, h, colour, drop (how far below the ground it starts), rough, n }
function ridge(c, { r, h, colour, drop = 6, rough = 1, n = 120, seed = 1 }) {
  const pos = [], height = a => h * (0.38 + 0.36 * Math.sin(a * 3 + seed) * Math.sin(a * 5 + seed * 2.3) + rough * (0.16 * Math.sin(a * 17 + seed * 4) + 0.1 * Math.sin(a * 41 + seed * 7)) + 0.26);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, b = (i + 1) / n * TAU, at = (ang, y) => [Math.cos(ang) * r, y, Math.sin(ang) * r];
    pos.push(...at(a, -drop), ...at(b, -drop), ...at(b, Math.max(0, height(b))), ...at(a, -drop), ...at(b, Math.max(0, height(b))), ...at(a, Math.max(0, height(a))));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  c.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colour, fog: false, side: THREE.DoubleSide })));
}

const AROUND = {
  // a line of dark trees round the field, with the lights of the campsite beyond them
  trees(c) {
    const { W, D, add } = c, trees = [], lights = [], R = Math.max(W, D) * 0.5 + 55;
    for (let i = 0; i < 150; i++) {
      const a = i / 150 * TAU + Math.random() * 0.03, r = R + Math.random() * 45, h = 9 + Math.random() * 12, x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r;
      if (z < -D / 2 - 6 && Math.abs(x) < W * 0.5) continue;   // behind the stage is backstage, not woods
      trees.push(new THREE.ConeGeometry(3 + Math.random() * 3.5, h, 6).translate(x, h / 2 + 1.5, z), new THREE.CylinderGeometry(0.35, 0.45, 3, 5).translate(x, 1.5, z));
      if (i % 4 === 0) lights.push(new THREE.SphereGeometry(0.35, 5, 4).translate(x * 1.12 + Math.random() * 20, 2.5 + Math.random() * 3, z * 1.12 + Math.random() * 20));
    }
    add(new THREE.Mesh(mergeGeometries(trees), dim(0x030604))); add(new THREE.Mesh(mergeGeometries(lights), dim(new THREE.Color(1.6, 1.0, 0.45))));
  },
  // a big wheel a good way off, turning once in a few minutes
  wheel(c) {
    const { W, D, add, out } = c, wheel = add(new THREE.Group()), rim = [], bulbs = [];
    wheel.position.set(W * 0.5 + 95, 30, D * 0.25); wheel.rotation.y = -1.1;
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; rim.push(new THREE.BoxGeometry(0.2, 24, 0.2).rotateZ(a).translate(Math.sin(-a) * 12, Math.cos(a) * 12, 0)); bulbs.push(new THREE.SphereGeometry(0.4, 6, 4).translate(Math.sin(a) * 24, Math.cos(a) * 24, 0), new THREE.SphereGeometry(0.28, 6, 4).translate(Math.sin(a) * 12, Math.cos(a) * 12, 0)); }
    const turning = new THREE.Group(); turning.add(new THREE.Mesh(mergeGeometries(rim), dim(0x06080c)), new THREE.Mesh(mergeGeometries(bulbs), dim(new THREE.Color(1.3, 0.5, 0.9))));
    wheel.add(turning, new THREE.Mesh(new THREE.BoxGeometry(1, 31, 1).translate(0, -15.5, 0), dim(0x06080c)));
    out.updates.push(dt => { turning.rotation.z += dt * 0.035; });
  },
  // woods right up to the clearing: the nearest trees catch the light, the rest are the dark behind them
  forest(c, o) {
    const { W, D, put, add, surface, plain } = c, bark = surface('dirt', { tint: 0xa8947c, gain: 2.4 }), leaf = plain(0x0e2412, { roughness: 1, gain: 2.6 }), dark = [];
    for (let i = 0; i < (o.count || 330); i++) {
      const x = (Math.random() - 0.5) * (W + 150), z = (Math.random() - 0.5) * (D + 150), out = Math.max(Math.abs(x) - W / 2, Math.abs(z) - D / 2);
      if (out < 1.2 || (z < -D / 2 && Math.abs(x) < W * 0.3 && out < 8) || Math.random() < out / 110) continue;
      const h = 13 + Math.random() * 12, r = 0.25 + Math.random() * 0.3, conifer = Math.random() < 0.6;
      const crown = conifer ? [new THREE.ConeGeometry(2.6 + Math.random() * 1.6, h * 0.62, 7).translate(x, h * 0.7, z)] : [new THREE.SphereGeometry(1, 7, 5).scale(3.2 + Math.random() * 2, 2.4 + Math.random() * 1.5, 3.2 + Math.random() * 2).translate(x, h * 0.82, z)];
      if (out < 13) { put(bark, post(r, h * (conifer ? 0.5 : 0.8), x, z, 0, 7, r * 0.6)); put(leaf, crown); } else dark.push(post(r, h * 0.6, x, z, 0, 5), ...crown);
    }
    if (dark.length) add(new THREE.Mesh(mergeGeometries(dark.map(g => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; })), dim(0x020503)));
  },
  // a city all round: towers and blocks with lit windows. drop: how far their feet are below this place (a roof)
  skyline(c, o) {
    const { W, D, add } = c, drop = o.drop || 0, lots = [[], [], []], caps = [], beacons = [], R = Math.max(W, D) / 2;
    for (let i = 0; i < (o.count || 110); i++) {
      const a = Math.random() * TAU, near = i < (o.count || 110) * 0.3, r = R + (near ? 18 + Math.random() * 50 : 90 + Math.random() * 330), w = 14 + Math.random() * 26, d = 14 + Math.random() * 22;
      const h = drop + (near ? -drop * 0.5 + Math.random() * (drop * 0.4 + 26) : 10 + Math.pow(Math.random(), 2.2) * (o.tall || 150)), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (o.clear && z < -D / 2 && Math.abs(x) < W) continue;
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.max(w, d) / 25.6, uv.getY(k) * h / 27.2);
      lots[i % 3].push(g.rotateY(Math.random() * 0.5).translate(x, h / 2 - drop, z)); caps.push(box(w + 0.3, 0.5, d + 0.3, x, h - drop + 0.2, z));
      if (h - drop > 70) beacons.push(new THREE.SphereGeometry(0.9, 6, 4).translate(x, h - drop + 2, z));
    }
    lots.forEach((lot, k) => { if (lot.length) add(new THREE.Mesh(mergeGeometries(lot), new THREE.MeshBasicMaterial({ map: front(k), fog: false, color: new THREE.Color(0.85, 0.85, 0.85) }))); });
    add(new THREE.Mesh(mergeGeometries(caps), dim(0x050608)));
    if (beacons.length) add(new THREE.Mesh(mergeGeometries(beacons), dim(new THREE.Color(2.2, 0.15, 0.1))));
  },
  // The sea beyond the place, with the low sun or the moon on it. z: where the shore is (the water lies beyond it,
  // away from the crowd); all: water on every side
  sea(c, o) {
    const { D, add, env, S } = c, shore = (o.z ?? c.sh.shore ?? -D / 2 - 9) + 2, mat = new THREE.MeshBasicNodeMaterial({ fog: false });
    const p = positionWorld, t = env.uTime, V = normalize(cameraPosition.sub(p));
    const n = normalize(vec3(sin(p.x.mul(0.35).add(t.mul(0.8))).mul(0.05).add(sin(p.z.mul(0.9).sub(t.mul(1.1))).mul(0.04)), 1, sin(p.z.mul(0.5).add(t.mul(0.6))).mul(0.06).add(sin(p.x.mul(1.3).add(p.z).add(t)).mul(0.03))));
    const r = reflect(V.negate(), n), lamp = normalize(vec3(...(S.sunAt || MOON))), shine = vec3(...(S.sun || [0.5, 0.5, 0.42])), hit = max(dot(r, lamp), 0);
    const sky = mix(vec3(...S.horizon), vec3(...S.zenith), pow(max(r.y, 0), 0.5)), fres = pow(max(dot(V, n), 0).oneMinus(), 4);
    mat.colorNode = vec3(0.003, 0.008, 0.014).mul(fres.oneMinus()).add(sky.mul(fres).mul(0.9)).add(shine.mul(pow(hit, 70).mul(S.sun ? 5 : 1.2).add(pow(hit, 8).mul(S.sun ? 0.3 : 0.05))));
    const sea = add(new THREE.Mesh(new THREE.PlaneGeometry(o.all ? 2400 : 2000, o.all ? 2400 : 1000).rotateX(-Math.PI / 2), mat));
    sea.position.set(0, o.y ?? -0.3, o.all ? 0 : shore - 500);
  },
  // ridges on the horizon, the further the paler. h: how high; drop: for a place that looks down on them
  mountains(c, o) {
    const S = c.S, tone = new THREE.Color(...S.horizon), dark = new THREE.Color(...S.zenith).multiplyScalar(0.5), h = o.h || 110, n = o.rings || 3;
    for (let i = 0; i < n; i++) ridge(c, { r: 760 - i * 150, h: h * (1 - i * 0.22), colour: (o.snow ? new THREE.Color(0.05, 0.07, 0.09) : dark).clone().lerp(tone, o.snow ? 0.5 - i * 0.14 : 0.55 - i * 0.2), drop: o.drop ?? 6, rough: o.smooth ? 0.15 : 1, seed: 1 + i * 2.7 });
  },
  // for a place on a summit: a sea of cloud below
  clouds(c, o) {
    const { add, env, S } = c, mat = new THREE.MeshBasicNodeMaterial({ fog: false }), p = positionWorld.xz.mul(0.0035), t = env.uTime.mul(0.004);
    const puff = mx_noise_float(vec3(p.x.add(t), p.y, t)).mul(0.5).add(mx_noise_float(vec3(p.x.mul(3.1), p.y.mul(3.1).sub(t), 1)).mul(0.25)).add(0.5);
    mat.colorNode = mix(vec3(...S.zenith).mul(0.7), vec3(...S.horizon).mul(1.15).add(vec3(...(S.sun || [0, 0, 0])).mul(0.12)), smoothstep(0.25, 0.85, puff));
    add(new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), mat)).position.y = -(o.drop || 45);
  },
  // boulders along the edge of a plateau, so it does not end in a ruled line
  boulders(c, o) {
    const { W, D, put, surface } = c, rock = surface(c.sh.floor || 'rock', { gain: 2 });
    for (let i = 0; i < (o.count || 70); i++) {
      const k = Math.random() * 2 * (W + D), s = 0.8 + Math.random() * 2.4, [x, z] = k < W ? [k - W / 2, -D / 2] : k < W + D ? [W / 2, k - W - D / 2] : k < 2 * W + D ? [k - W - D - W / 2, D / 2] : [-W / 2, k - 2 * W - D - D / 2];
      put(rock, new THREE.IcosahedronGeometry(1, 1).scale(s * (0.8 + Math.random() * 0.7), s * (0.5 + Math.random() * 0.5), s * (0.8 + Math.random() * 0.7)).rotateY(Math.random() * 3).translate(x + (Math.random() - 0.5) * 1.6, s * 0.1 - 0.2, z + (Math.random() - 0.5) * 1.6));
    }
  },
  // shipping containers stacked along both sides and behind the stage
  containers(c, o) {
    const { W, D, put, surface, L } = c, cols = [0x8a2a1c, 0x1c4a7a, 0x2a6a3a, 0xb8601a, 0x7a7a78, 0xb8b0a0, 0x1a5a6a], mat = () => surface('corrugated', { tint: cols[Math.random() * cols.length | 0], gain: 1.9 });
    for (const s of [-1, 1]) for (let row = 0; row < 2; row++) for (let z = -D / 2 - 14; z < D / 2 + 6; z += 12.5) {
      const high = row ? 2 + (Math.random() * 3 | 0) : 1 + (Math.random() * 3 | 0);
      for (let k = 0; k < high; k++) put(mat(), box(2.44, 2.59, 12.2, s * (W / 2 + 1.5 + row * 2.7 + (Math.random() - 0.5) * 0.12), 1.3 + k * 2.6, z + (Math.random() - 0.5) * 0.5));
    }
    for (let x = -W / 2 - 4; x < W / 2 + 4; x += 12.5) { const high = 3 + (Math.random() * 3 | 0); for (let k = 0; k < high; k++) put(mat(), box(12.2, 2.59, 2.44, x + 6.1, 1.3 + k * 2.6, L.stage.back - 1.6 - (k % 2) * 0.1)); }
  },
  // harbour cranes behind it all, and masts of sodium light
  cranes(c) {
    const { W, D, add } = c, steel = [], red = [], lamps = [];
    for (const x of [-W * 0.75, W * 0.55]) {
      const z = -D / 2 - 60 - Math.random() * 30, h = 46;
      for (const [dx, dz] of [[-9, -6], [9, -6], [9, 6], [-9, 6]]) strut([x + dx, 0, z + dz], [x + dx * 0.6, h, z + dz * 0.6], 1.3, steel);
      strut([x - 8, h, z], [x + 8, h, z], 2.4, steel); strut([x, h + 2, z - 22], [x, h + 2, z + 58], 2.2, steel); strut([x, h + 2, z], [x, h + 20, z], 1.4, steel); strut([x, h + 20, z], [x, h + 3, z + 56], 0.5, steel); strut([x, h + 20, z], [x, h + 3, z - 20], 0.5, steel);
      red.push(new THREE.SphereGeometry(0.8, 6, 4).translate(x, h + 21, z), new THREE.SphereGeometry(0.6, 6, 4).translate(x, h + 3, z + 58));
    }
    for (const [x, z] of [[-W / 2 - 14, -D / 4], [W / 2 + 14, -D / 4], [-W / 2 - 14, D / 3], [W / 2 + 14, D / 3]]) { strut([x, 0, z], [x, 26, z], 0.5, steel); lamps.push(box(4, 0.8, 0.8, x, 26, z)); }
    add(new THREE.Mesh(mergeGeometries(steel), dim(0x07090d))); add(new THREE.Mesh(mergeGeometries(red), dim(new THREE.Color(2.2, 0.15, 0.1)))); add(new THREE.Mesh(mergeGeometries(lamps), dim(new THREE.Color(2.6, 1.5, 0.5))));
  },
  // house fronts down both sides of a street and across its end: h: how high (two numbers: from, to)
  houses(c, o) {
    const { W, D, put, add, surface, L } = c, cols = [0xc8a888, 0xb86a50, 0x7a9aa8, 0xd8d0c0, 0xa85a6a, 0x8a9a6a, 0xc8b060], [h0, h1] = o.h || [9, 14], lit = [[], [], []];
    const house = (x, z, w, turn) => {   // a house whose front is w wide, facing along its own +z after the turn
      const h = h0 + Math.random() * (h1 - h0), k = Math.random() * 3 | 0;
      put(Math.random() < 0.25 ? surface('brick', { gain: 1.8 }) : surface('plaster', { tint: cols[Math.random() * cols.length | 0], gain: 1.8 }), box(w - 0.1, h, 8, 0, h / 2, -4).rotateY(turn).translate(x, 0, z));
      lit[k].push(new THREE.PlaneGeometry(w - 0.9, h - 0.6).translate(0, h / 2, 0.06).rotateY(turn).translate(x, 0, z));
    };
    for (const s of [-1, 1]) for (let z = -D / 2 - 8; z < D / 2 + 20;) { const w = 5.5 + Math.random() * 3.5; house(s * W / 2, z + w / 2, w, -s * Math.PI / 2); z += w; }
    for (let x = -W / 2 - 8; x < W / 2 + 8;) { const w = 5.5 + Math.random() * 3.5; house(x + w / 2, L.stage.back - 0.4, w, 0); x += w; }
    lit.forEach((list, k) => { if (list.length) add(new THREE.Mesh(mergeGeometries(list), face(k))); });
  },
  // palms along both sides, and one either side of the stage
  palms(c, o) {
    const { W, D, L } = c, x = W / 2 + (o.out ?? 1.5);
    for (const s of [-1, 1]) { for (let z = L.stage.front + 3; z < D / 2 + 4; z += (o.every || 9) * (0.8 + Math.random() * 0.4)) palm(c, s * (x + Math.random() * 3), z, 6 + Math.random() * 4); palm(c, s * (L.stage.width / 2 + 3.5), L.stage.back + 1, 8 + Math.random() * 2); }
  },
  // floodlight masts at the corners, as a stadium has
  masts(c, o) {
    const { W, D, add } = c, steel = [], lamps = [], h = o.h || 42;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (W / 2 + (o.out || 30)), z = sz * (D / 2 + (o.out || 30) * 0.6); strut([x, 0, z], [x, h, z], 1.2, steel); lamps.push(box(9, 5, 0.6, x, h + 1, z, Math.atan2(-x, -z))); }
    add(new THREE.Mesh(mergeGeometries(steel), dim(0x0a0c10))); add(new THREE.Mesh(mergeGeometries(lamps), dim(new THREE.Color(1.5, 1.6, 1.8))));
  },
};
