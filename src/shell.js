// The shell: the place itself. Ground, walls, a roof, what holds it up, and the parts that make it one kind of
// building and not another (columns, windows, balconies, tiers of seats, an organ). All of it follows from a venue's
// `plan` and `shell`; nothing here knows which venue it is building. What is outside, under the sky, is outdoors.js.
//
//   shell.floor, shell.walls   a surface (surfaces.js). walls may be { left, right, front, back, all }; 'front' is
//                              the wall behind the stage. false: no walls. 'glass': panes between posts.
//   shell.wallSet, wallHeight  which walls there are, and how high (a parapet round a roof terrace)
//   shell.roof                 'flat', or { type: 'vault' | 'gable' | 'glass' | 'sawtooth' | 'dome' | 'tent' | 'none',
//                              rise, kind, span, pointed }
//   shell.open                 the open air: no walls and no roof unless asked for. ground: false for a place that
//                              ends at its own edge (a roof, a summit); shore: where the land ends and the sea begins
//   shell.sky, shell.around    see outdoors.js
//   shell.frames, services, pillars, plinth, rough   steel portal frames every so many metres; ducts and pipes;
//                              posts at [x, z]; a concrete base to the walls; walls and ceiling of rock
//   shell.parts                [{ type, ... }]: see PARTS below. To add a kind of part, add an entry.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, post, strut, patch, sweep, inMetres } from './shapes.js';
import { buildOutdoors, palm } from './outdoors.js';

const TAU = Math.PI * 2;
const range = (from, to, step) => { const list = []; for (let v = from; v < to - 1e-6; v += step) list.push(v); return list; };
const near = (cx, cz, r) => (x, z) => Math.abs(x - cx) < r && Math.abs(z - cz) < r;
const rect = (x0, x1, z0, z1) => (x, z) => x > x0 && x < x1 && z > z0 && z < z1;
const placeOf = ({ W, D }) => ({ left: [D, -W / 2, 0, Math.PI / 2], right: [D, W / 2, 0, -Math.PI / 2], front: [W, 0, -D / 2, 0], back: [W, 0, D / 2, Math.PI] });   // length, x, z, turn: a plane turned so faces into the room
const wallKind = (sh, side) => typeof sh.walls === 'object' && sh.walls ? sh.walls[side] ?? sh.walls.all ?? 'concrete' : sh.walls || 'concrete';

// a wall of rock: a plane pushed in and out
function rough(w, h, amp, seed) {
  const g = new THREE.PlaneGeometry(w, h, Math.ceil(w / 1.1), Math.ceil(h / 1.1)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, amp * (0.5 + 0.5 * Math.sin(x * 0.31 + seed * 1.7) * Math.cos(y * 0.43 + seed) + 0.35 * Math.sin(x * 0.9 + y * 0.7 + seed * 3) + 0.2 * Math.sin(x * 2.3 - y * 1.9 + seed))); }
  g.computeVertexNormals();
  return g;
}

// Glass as it looks from inside at night: what is behind it, painted on a pane. Each kind is one small picture.
const panes = {};
const PANES = {
  night: [64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a1226'); gr.addColorStop(1, '#161c2c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#060607'; for (let x = 0; x <= w; x += w / 2) g.fillRect(x - 2, 0, 4, h); for (let y = 0; y <= h; y += h / 4) g.fillRect(0, y - 2, w, 4); }],
  factory: [128, 128, (g, w, h) => { g.fillStyle = '#050506'; g.fillRect(0, 0, w, h); for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { const v = Math.random(); g.fillStyle = v < 0.12 ? '#020203' : v < 0.2 ? '#2a3550' : `rgb(${10 + v * 14 | 0},${16 + v * 18 | 0},${30 + v * 26 | 0})`; g.fillRect(x * 16 + 1.5, y * 21.3 + 1.5, 13, 18.3); } }],
  // a pointed window of coloured glass, lit from outside
  stained: [96, 224, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.save(); g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.3); g.quadraticCurveTo(0, h * 0.06, w / 2, 0); g.quadraticCurveTo(w, h * 0.06, w, h * 0.3); g.lineTo(w, h); g.closePath(); g.clip();
    const cols = ['#b01a22', '#1a3a9a', '#c8961a', '#1a7a4a', '#6a1a8a', '#c8c0a0', '#1a6a9a'];
    for (let y = 0; y < h; y += 14) for (let x = 0; x < w; x += 12) { g.fillStyle = cols[Math.random() * cols.length | 0]; g.globalAlpha = 0.6 + Math.random() * 0.4; g.fillRect(x, y, 12, 14); }
    g.globalAlpha = 1; g.strokeStyle = '#0a0806'; g.lineWidth = 1.5; for (let y = 0; y < h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 0; x <= w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.beginPath(); g.arc(w / 2, h * 0.2, w * 0.2, 0, TAU); g.fillStyle = '#d8b040'; g.fill(); g.stroke(); g.restore();
  }, true],
  // a tall arched window with the city behind it
  city: [128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.save(); g.beginPath(); g.moveTo(0, h); g.lineTo(0, w / 2); g.arc(w / 2, w / 2, w / 2, Math.PI, 0); g.lineTo(w, h); g.closePath(); g.clip();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0e22'); gr.addColorStop(0.7, '#2a2030'); gr.addColorStop(1, '#4a3028'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w;) { const bw = 10 + Math.random() * 18, bh = h * (0.2 + Math.random() * 0.45); g.fillStyle = '#07080c'; g.fillRect(x, h - bh, bw, bh); for (let k = 0; k < bh * bw / 70; k++) { g.fillStyle = Math.random() < 0.7 ? '#e8b060' : '#a8c8ff'; g.fillRect(x + 2 + Math.random() * (bw - 4), h - bh + 3 + Math.random() * (bh - 6), 1.6, 2.2); } x += bw + 1; }
    g.strokeStyle = '#08080a'; g.lineWidth = 4; for (const x of [w / 3, w * 2 / 3]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = w / 2; y < h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.lineWidth = 7; g.strokeRect(0, 0, w, h); g.restore();
  }, true],
};
export function pane(kind, glow = 1) {
  const [w, h, draw, cut] = PANES[kind] || PANES.night, key = kind + glow;
  return panes[key] ||= (() => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(glow, glow, glow), fog: false, ...(cut ? { transparent: true, alphaTest: 0.5 } : {}) });
    mat.userData.shared = true; return mat;
  })();
}

// ctx: { add, put, surface, plain, steel, env } from the world. Returns what the rest needs to know about the place:
// keepOut (where nobody stands), seats ([{ x, y, z, yaw }]), ceil(x, z) (how high the roof is there), rise, profile
// (the line of the room across, for what follows it) and update(dt, t).
export function buildShell(L, ctx) {
  const { W, D, H, shape } = L.plan, sh = L.shell;
  const out = { keepOut: [], seats: [], updates: [], rise: L.plan.rise, ceil: L.ceil, profile: [[-W / 2 + 0.5, 0], [-W / 2 + 0.5, H - 0.75], [W / 2 - 0.5, H - 0.75], [W / 2 - 0.5, 0]], sky: null };
  const c = { ...ctx, L, W, D, H, sh, round: shape === 'round', open: !!sh.open, out };
  ground(c); walls(c);
  if (!c.open || sh.roof) roof(c);
  structure(c);
  for (const part of sh.parts || []) {
    if (!PARTS[part.type]) throw new Error(`the venue ${L.name} asks for a part "${part.type}" that does not exist`);
    PARTS[part.type](c, part);
  }
  if (c.open || sh.sky) out.sky = buildOutdoors(c);
  out.update = (dt, t) => { for (const f of out.updates) f(dt, t); };
  return out;
}

function ground(c) {
  const { W, D, sh, open, put, surface, L } = c, far = sh.ground === false ? 0 : open ? 260 : 0, kind = sh.floor || 'concrete';
  // the ground: the room's own floor, or in the open air the land far beyond it, up to the shore if there is one
  const z0 = sh.shore ?? -(D + far) / 2, z1 = (D + far) / 2;
  put(surface(kind, { uv: true }), inMetres(new THREE.PlaneGeometry(W + far, z1 - z0).rotateX(-Math.PI / 2), W + far, z1 - z0, surface.size(kind)).translate(0, 0, (z0 + z1) / 2));
  const rake = L.crowd.rake, F = L.floor;
  if (rake) {   // the floor under rows of seats rises to the back
    const x0 = F.x0 - 0.9, x1 = F.x1 + 0.9, z0 = F.z0 - 0.5, z1 = F.z1 + 0.8, mat = surface(L.crowd.carpet || 'carpet', { side: THREE.DoubleSide });
    put(mat, patch([[x0, 0.02, z0], [x1, 0.02, z0], [x1, rake, z1], [x0, rake, z1]]), patch([[x0, 0, z1], [x1, 0, z1], [x1, rake, z1], [x0, rake, z1]]));
    for (const x of [x0, x1]) put(mat, patch([[x, 0, z0], [x, 0, z1], [x, rake, z1]]));
  }
}

const glassOf = c => c.plain(0x9fb6c4, { opacity: 0.09, roughness: 0.08, side: THREE.DoubleSide, gain: 0.6 });
function walls(c) {
  const { W, D, H, sh, open, round, put, surface, plain } = c, set = sh.wallSet || (open ? [] : ['left', 'right', 'back', 'front']), h = sh.wallHeight || H;
  if (sh.walls === false || !set.length) return;
  if (round) {
    const kind = wallKind(sh, 'all'), g = new THREE.CylinderGeometry(1, 1, h, 72, 1, true).scale(W / 2, 1, D / 2).translate(0, h / 2, 0);
    put(surface(kind, { uv: true, side: THREE.BackSide, tint: sh.tint }), kind === 'canvas' ? inMetres(g, sh.stripes || 28, 1, 1) : inMetres(g, Math.PI * (W + D) / 2, h, surface.size(kind)));
    if (sh.plinth) put(surface(sh.plinthKind || 'concrete', { side: THREE.BackSide }), new THREE.CylinderGeometry(1, 1, sh.plinth, 72, 1, true).scale(W / 2 - 0.04, 1, D / 2 - 0.04).translate(0, sh.plinth / 2, 0));
    return;
  }
  for (const side of set) {
    const [w, x, z, ry] = placeOf(c)[side], kind = wallKind(sh, side);
    if (kind === false) continue;
    if (kind === 'glass') {   // panes between slender posts, on a low base of brick
      const iron = plain(sh.iron ?? 0xd6d6cc, { roughness: 0.5, metalness: 0.3 }), posts = [];
      for (let a = -w / 2; a <= w / 2 + 0.01; a += 2) posts.push(box(0.09, h, 0.09, a, h / 2, 0));
      for (const y of [0.9, h * 0.5, h - 0.05]) posts.push(box(w, 0.07, 0.07, 0, y, 0));
      put(iron, posts.map(g => g.rotateY(ry).translate(x, 0, z)));
      put(glassOf(c), new THREE.PlaneGeometry(w, h).rotateY(ry).translate(x, h / 2, z));
      put(surface('brick'), new THREE.PlaneGeometry(w, 0.9).translate(0, 0, 0.04).rotateY(ry).translate(x, 0.45, z));
      continue;
    }
    put(surface(kind, { tint: sh.tint }), (sh.rough ? rough(w + 6, h + 4, sh.rough, side.length) : new THREE.PlaneGeometry(w, h)).rotateY(ry).translate(x, h / 2, z));
    if (sh.plinth) put(surface('concrete'), new THREE.PlaneGeometry(w, sh.plinth).translate(0, 0, 0.03).rotateY(ry).translate(x, sh.plinth / 2, z));   // a concrete base under the steel
  }
}

function roof(c) {
  const { W, D, H, sh, round, put, add, surface, plain, steel, out } = c, r = typeof sh.roof === 'string' ? { type: sh.roof } : sh.roof || { type: 'flat' }, kind = r.kind || sh.ceiling || 'dark';
  const size = surface.size(kind), lay = g => inMetres(g, 1, 1, size);   // a swept shape gives its coordinates in metres
  if (r.type === 'none') return;
  if (r.type === 'flat') {
    put(surface(kind), round ? new THREE.CircleGeometry(1, 64).rotateX(Math.PI / 2).scale(W / 2, 1, D / 2).translate(0, H, 0)
      : (sh.rough ? rough(W + 6, D + 6, sh.rough * 1.4, 9) : new THREE.PlaneGeometry(W, D)).rotateX(Math.PI / 2).translate(0, H, 0));
    return;
  }
  if (r.type === 'vault' || r.type === 'gable' || r.type === 'glass') {
    const span = r.span || W, rise = c.L.plan.rise, glass = r.type === 'glass';
    const profile = c.L.roof;
    out.profile = [[-span / 2 + 0.3, 0], ...profile.map(([x, y]) => [x * (1 - 0.6 / span), y - 0.3]), [span / 2 - 0.3, 0]];
    put(glass ? glassOf(c) : surface(kind, { uv: true, side: THREE.DoubleSide }), lay(sweep(profile, -D / 2, D / 2)));
    for (const [z, side] of [[-D / 2, 'front'], [D / 2, 'back']]) {   // the ends, between the eaves and the roof
      if (sh.wallSet && !sh.wallSet.includes(side)) continue;
      const k = wallKind(sh, side);
      put(k === 'glass' ? glassOf(c) : surface(k, { side: THREE.DoubleSide, tint: sh.tint }), patch(profile.map(([x, y]) => [x, y, z])));
    }
    if (glass || r.ribs) {   // the iron that carries it: a rib every few metres, and rails along
      const iron = glass ? plain(sh.iron ?? 0xd6d6cc, { roughness: 0.5, metalness: 0.3 }) : surface(r.ribs === true ? 'stone' : r.ribs), ribs = [], every = r.every || 4, thick = r.thick || 0.12;
      for (let n = Math.round(D / every), i = 0; i <= n; i++) { const z = -D / 2 + D * i / n; for (let k = 0; k + 1 < profile.length; k++) strut([profile[k][0], profile[k][1], z], [profile[k + 1][0], profile[k + 1][1], z], thick, ribs); }
      for (let k = 0; k < profile.length; k += Math.max(1, (profile.length - 1) >> (glass ? 1 : 3))) strut([profile[k][0], profile[k][1], -D / 2], [profile[k][0], profile[k][1], D / 2], thick * 0.8, ribs);
      put(iron, ribs);
    }
    return;
  }
  if (r.type === 'sawtooth') {   // a factory's roof: slopes with a strip of glass at the top of each, facing the stage end
    const n = Math.round(D / (r.every || 6.5)), t = D / n, rise = c.L.plan.rise, glazing = [], side = surface(wallKind(sh, 'left'), { side: THREE.DoubleSide });
    for (let i = 0; i < n; i++) {
      const z0 = -D / 2 + i * t, z1 = z0 + t;
      put(surface(kind, { side: THREE.DoubleSide }), patch([[-W / 2, H + rise, z0], [W / 2, H + rise, z0], [W / 2, H, z1], [-W / 2, H, z1]]));
      glazing.push(inMetres(new THREE.PlaneGeometry(W, rise), W / 2.6, 1, 1).translate(0, H + rise / 2, z0 + 0.03));
      for (const x of [-W / 2, W / 2]) put(side, patch([[x, H, z0], [x, H, z1], [x, H + rise, z0]]));
      put(steel, box(W, 0.3, 0.25, 0, H - 0.15, z0));
    }
    const mat = pane('factory', r.glow ?? 1.6); mat.map.wrapS = THREE.RepeatWrapping;
    add(new THREE.Mesh(mergeGeometries(glazing), mat));
    return;
  }
  if (r.type === 'dome') {
    const rise = c.L.plan.rise;
    if (!r.screen) put(surface(kind, { uv: true, side: THREE.BackSide }), inMetres(new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), Math.PI * W, rise * 1.57, size).scale(W / 2, rise, D / 2).translate(0, H, 0));
    return;
  }
  if (r.type === 'cone') {
    const rise = c.L.plan.rise, top = r.top ?? 0, rx = W / 2, rz = D / 2, ribs = [];
    put(surface(kind, { uv: true, side: THREE.BackSide }), inMetres(new THREE.CylinderGeometry(top, 1, rise, 80, 1, true).scale(rx, 1, rz).translate(0, H + rise / 2, 0), Math.PI * (W + D) / 2, rise, size));
    if (top) put(surface(kind, { side: THREE.DoubleSide }), new THREE.CircleGeometry(1, 40).rotateX(Math.PI / 2).scale(rx * top, 1, rz * top).translate(0, H + rise, 0));
    for (let i = 0; i < (r.ribs || 0); i++) {
      const a = i / r.ribs * TAU, point = (radius, y) => [Math.sin(a) * rx * radius, y, Math.cos(a) * rz * radius];
      strut(point(0.997, H - 0.16), point(top, H + rise - 0.16), 0.14, ribs);
    }
    if (top && r.lantern) {
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU, b = (i + 1) / 24 * TAU, point = (angle, y) => [Math.sin(angle) * rx * top, y, Math.cos(angle) * rz * top];
        strut(point(a, H + rise - r.lantern), point(a, H + rise - 0.16), 0.065, ribs);
        for (const y of [H + rise - r.lantern, H + rise - 0.2]) strut(point(a, y), point(b, y), 0.09, ribs);
      }
    }
    put(steel, ribs);
    return;
  }
  if (r.type === 'tent') {   // a big top: canvas rising to a point, on four king poles
    const rise = c.L.plan.rise, pts = [[1, 0], [0.62, 0.42], [0.3, 0.78], [0.1, 0.95], [0.012, 1]];
    put(surface('canvas', { uv: true, side: THREE.DoubleSide, tint: sh.tint }), inMetres(new THREE.LatheGeometry(pts.map(([rr, y]) => new THREE.Vector2(rr, y * rise)), 72).scale(W / 2, 1, D / 2).translate(0, H, 0), sh.stripes || 28, 1, 1));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = sx * W * 0.19, z = sz * D * 0.19; put(steel, post(0.17, out.ceil(x, z), x, z)); out.keepOut.push(near(x, z, 0.7)); }
  }
}

// what a working building has: steel frames, ducts and sprinkler pipes, posts
function structure(c) {
  const { W, D, H, sh, open, put, add, steel, plain, out } = c;
  if (sh.services) {   // ventilation ducts with their outlets, sprinkler pipes with a head every few metres, skylights with the night behind them
    const ducts = [], pipes = [], r = Math.min(0.45, H * 0.05);
    for (const s of [-1, 1]) {
      ducts.push(new THREE.CylinderGeometry(r, r, D - 3, 14).rotateX(Math.PI / 2).translate(s * (W / 2 - 2.6), H - r - 0.9, 0));
      for (let z = -D / 2 + 5; z < D / 2 - 3; z += 8) ducts.push(box(r * 1.6, r * 0.5, r * 2.2, s * (W / 2 - 2.6), H - r * 2.1 - 0.9, z));
    }
    for (const k of [-0.36, -0.12, 0.12, 0.36]) {
      strut([W * k, H - 0.28, -D / 2 + 0.5], [W * k, H - 0.28, D / 2 - 0.5], 0.06, pipes);
      for (let z = -D / 2 + 3; z < D / 2 - 2; z += 4) pipes.push(new THREE.CylinderGeometry(0.035, 0.02, 0.14, 6).translate(W * k, H - 0.38, z));
    }
    put(plain(0x6a6d72, { roughness: 0.45, metalness: 0.8, gain: 1.4 }), ducts); put(plain(0x6a1010, { roughness: 0.6, metalness: 0.3, gain: 1.4 }), pipes);
    const lights = [];
    if (sh.frames) for (let n = Math.round(D / sh.frames), i = 0; i < n; i++) for (const k of [-0.25, 0.25]) lights.push(new THREE.PlaneGeometry(W * 0.12, sh.frames - 2.2).rotateX(Math.PI / 2).translate(W * k, H - 0.02, -D / 2 + (i + 0.5) * D / n));
    if (lights.length) add(new THREE.Mesh(mergeGeometries(lights), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.009, 0.02), fog: false })));
  }
  if (sh.frames) {
    const frame = [], n = Math.round(D / sh.frames);
    for (let i = 0; i <= n; i++) {
      const z = -D / 2 + 0.2 + (D - 0.4) * i / n;
      for (const s of [-1, 1]) strut([s * (W / 2 - 0.22), 0, z], [s * (W / 2 - 0.22), H, z], 0.4, frame);
      strut([-W / 2, H - 0.35, z], [W / 2, H - 0.35, z], 0.5, frame);
    }
    if (!open) for (let i = 1; i < 6; i++) strut([-W / 2 + W * i / 6, H - 0.12, -D / 2], [-W / 2 + W * i / 6, H - 0.12, D / 2], 0.18, frame);
    if (sh.services) for (let i = 0; i < n; i += Math.max(1, n - 1)) for (let k = 0; k < 4; k++) {   // bracing in the end bays
      const z0 = -D / 2 + 0.2 + (D - 0.4) * i / n, z1 = -D / 2 + 0.2 + (D - 0.4) * (i + 1) / n, x0 = -W / 2 + W * k / 4, x1 = x0 + W / 4;
      strut([x0, H - 0.2, z0], [x1, H - 0.2, z1], 0.07, frame); strut([x1, H - 0.2, z0], [x0, H - 0.2, z1], 0.07, frame);
    }
    put(steel, frame);
  }
  for (const [x, z] of sh.pillars || []) { put(steel, box(0.5, H, 0.5, x, H / 2, z)); out.keepOut.push(near(x, z, 0.55)); }
}

// rows of seats on a slope of steps: fills `seats` and returns the steps. at(k, r): the point k metres along row r.
function rows(c, p, length, at, yawOf) {
  const { out } = c, pitch = p.seat || 0.58;
  for (let r = 0; r < p.rows; r++) for (let k = pitch / 2 + 0.3; k < length - 0.3; k += pitch) { const [x, y, z] = at(k, r); out.seats.push({ x, y, z, yaw: yawOf(x, z), stand: !!p.standing }); }
}

const PARTS = {
  // A circular hall's wall posts and diagonal ties: { count, base, thick }.
  radialFrame(c, p) {
    const { W, D, H, put, steel } = c, parts = [], base = p.base || 0, count = p.count || 40;
    const point = (i, y) => [Math.sin(i / count * TAU) * (W / 2 - 0.14), y, Math.cos(i / count * TAU) * (D / 2 - 0.14)];
    for (let i = 0; i < count; i++) {
      strut(point(i, 0.1), point(i, H - 0.2), p.thick || 0.13, parts);
      strut(point(i, base + 0.2), point(i + 1, H - 0.4), 0.04, parts);
      strut(point(i + 1, base + 0.2), point(i, H - 0.4), 0.04, parts);
    }
    put(steel, parts);
  },
  // posts in rows: { xs, zs or every (+ z0, z1), r, h, kind ('iron' for cast iron, or a surface), square, cap }
  columns(c, p) {
    const { H, D, put, surface, plain, out } = c, h = p.h || H, r = p.r || 0.3, zs = p.zs || range(p.z0 ?? -D / 2 + (p.every || 6) / 2, p.z1 ?? D / 2, p.every || 6);
    const mat = p.kind === 'iron' ? plain(p.colour ?? 0x1c2a22, { roughness: 0.5, metalness: 0.6 }) : surface(p.kind || 'concrete', { tint: p.tint });
    for (const x of p.xs) for (const z of zs) {
      put(mat, p.square ? box(r * 2, h, r * 2, x, h / 2, z) : post(r, h, x, z, 0, 14));
      if (p.cap) put(mat, box(r * 3, r * 0.9, r * 3, x, h - r * 0.45, z), box(r * 2.8, r * 0.6, r * 2.8, x, r * 0.3, z));
      out.keepOut.push(near(x, z, r + 0.45));
    }
  },
  // beams across under the ceiling: { every, depth, width, kind }
  beams(c, p) {
    const { W, D, H, put, surface } = c, n = Math.round(D / p.every), depth = p.depth || 0.6;
    for (let i = 0; i <= n; i++) put(surface(p.kind || 'concrete'), box(W, depth, p.width || 0.4, 0, H - depth / 2, -D / 2 + D * i / n));
  },
  // plain boxes standing about: { kind, tint, list: [[w, h, d, x, z, turn, y], ...] }
  blocks(c, p) {
    const { put, surface, out } = c;
    for (const [w, h, d, x, z, ry = 0, y = 0] of p.list) { put(surface(p.kind || 'concrete', { tint: p.tint }), box(w, h, d, x, y + h / 2, z, ry)); if (!y && !p.walk) out.keepOut.push(near(x, z, Math.max(w, d) / 2 + 0.4)); }
  },
  // windows along walls: { walls, every or count, width, height, sill, kind (a pane), glow }
  windows(c, p) {
    const { add } = c, list = [];
    for (const side of p.walls || ['left', 'right']) {
      const [len, x, z, ry] = placeOf(c)[side], n = p.count || Math.max(1, Math.floor((len - (p.margin ?? 4)) / p.every));
      for (let i = 0; i < n; i++) list.push(new THREE.PlaneGeometry(p.width, p.height).translate((i - (n - 1) / 2) * (p.every || 0) + (p.shift || 0), 0, 0.07).rotateY(ry).translate(x, p.sill + p.height / 2, z));
    }
    if (list.length) add(new THREE.Mesh(mergeGeometries(list), pane(p.kind || 'night', p.glow ?? 1)));
  },
  // A church's nave: a row of columns either side carrying pointed arches, a wall with coloured windows above them,
  // and a lower aisle behind. { aisle (how far the columns are from the middle), every, arch (height of the arches) }
  nave(c, p) {
    const { W, D, H, put, add, surface, out } = c, a = p.aisle, every = p.every || 6, n = Math.round(D / every), bay = D / n, spring = p.arch * 0.58, top = p.arch, stone = surface(p.kind || 'stone'), two = surface(p.kind || 'stone', { side: THREE.DoubleSide }), glass = [];
    const r = 0.42, half = bay / 2 - r, cx = (Math.pow(top - spring, 2) - half * half) / (2 * half), rad = cx + half, apex = Math.atan2(top - spring, -cx);   // each half of an arch is part of a circle
    for (const s of [-1, 1]) {
      const x = s * a;
      for (let i = 0; i <= n; i++) { const z = -D / 2 + i * bay; if (i > 0 && i < n) { put(stone, post(r, spring, x, z, 0, 12), box(r * 2.6, 0.3, r * 2.6, x, spring - 0.15, z), box(r * 2.6, 0.4, r * 2.6, x, 0.2, z)); out.keepOut.push(near(x, z, r + 0.45)); } }
      for (let i = 0; i < n; i++) {
        const z0 = -D / 2 + i * bay, mid = z0 + bay / 2;
        for (const dir of [-1, 1]) {   // the stone between the arch and the wall above, and the arch's own moulding
          const pts = [[x, top, mid + dir * (bay / 2)], [x, spring, mid + dir * (bay / 2)]];
          for (let k = 0; k <= 8; k++) { const ang = Math.PI - (Math.PI - apex) * k / 8, dz = cx + rad * Math.cos(ang), y = spring + rad * Math.sin(ang); pts.push([x, y, mid + dir * -dz]); }
          put(two, patch(pts));
          for (let k = 2; k + 1 < pts.length; k++) put(stone, strut(pts[k], pts[k + 1], 0.32));
        }
        glass.push(new THREE.PlaneGeometry(bay * 0.34, (H - top) * 0.72).rotateY(-s * Math.PI / 2).translate(x - s * 0.3, top + (H - top) * 0.5, mid));
      }
      put(stone, box(0.5, H - top, D, x, top + (H - top) / 2, 0));   // the wall above the arches
      put(surface(p.ceiling || 'plaster', { tint: 0x9a9080 }), new THREE.PlaneGeometry(W / 2 - a, D).rotateX(Math.PI / 2).translate(s * (a + (W / 2 - a) / 2), top + 0.8, 0));   // the aisle's own ceiling
    }
    add(new THREE.Mesh(mergeGeometries(glass), pane('stained', p.glow ?? 1.3)));
  },
  // a gallery along the walls with seats on it: { sides, y, depth, rows, front (a colour), kind, z0 }
  balcony(c, p) {
    const { W, D, put, surface, plain, L } = c, depth = p.depth || 3, n = p.rows || 2, front = plain(p.front ?? 0xb8a888, { roughness: 0.6, gain: 1.8 }), slab = surface(p.kind || 'dark'), sides = p.sides || ['left', 'right', 'back'];
    const z1 = D / 2, z0 = p.z0 ?? L.stage.front + 1.5, sideLen = z1 - (sides.includes('back') ? depth : 0) - z0, mid = z0 + sideLen / 2, facing = (x, z) => Math.atan2(x, Math.max(1, z - L.stage.front)) * 0.9;
    for (const side of sides) {
      if (side === 'back') {
        put(slab, box(W, 0.3, depth, 0, p.y - 0.15, z1 - depth / 2)); put(front, box(W - (sides.length > 1 ? depth * 2 : 0), 0.9, 0.14, 0, p.y + 0.45, z1 - depth));
        for (let r = 1; r < n; r++) put(slab, box(W, r * 0.32, 0.95, 0, p.y + r * 0.16, z1 - depth + 0.75 + r * 0.95));
        rows(c, { rows: n, seat: p.seat }, W - 1.2, (k, r) => [-W / 2 + 0.6 + k, p.y + r * 0.32, z1 - depth + 0.75 + r * 0.95], () => 0);
      } else {
        const s = side === 'left' ? -1 : 1;
        put(slab, box(depth, 0.3, sideLen, s * (W / 2 - depth / 2), p.y - 0.15, mid)); put(front, box(0.14, 0.9, sideLen, s * (W / 2 - depth), p.y + 0.45, mid));
        for (let r = 1; r < n; r++) put(slab, box(0.95, r * 0.32, sideLen, s * (W / 2 - depth + 0.75 + r * 0.95), p.y + r * 0.16, mid));
        rows(c, { rows: n, seat: p.seat }, sideLen, (k, r) => [s * (W / 2 - depth + 0.75 + r * 0.95), p.y + r * 0.32, z0 + k], facing);
      }
    }
  },
  // Steps of seats, as in an arena, a stadium or a theatre cut into a hill.
  //   along walls:  { sides: ['left', 'right', 'back'], rows, rise, run, base, z0, z1, kind, standing, roof, outside }
  //                 outside: the stand begins at the edge of the plan and rises away from it, as round a pitch
  //   in an arc:    { arc: { x, z, r, from, to }, rows, rise, run, base, kind }   angles from the +z direction
  tiers(c, p) {
    const { put, surface, steel, out, L } = c, rise = p.rise || 0.45, run = p.run || 0.85, base = p.base ?? 0.4, n = p.rows, mat = surface(p.kind || 'concrete', { side: THREE.DoubleSide }), deep = n * run, W = c.W + (p.outside ? 2 * deep : 0), D = c.D + (p.outside ? 2 * deep : 0), facing = (x, z) => Math.atan2(x, Math.max(1, z - L.stage.front)) * 0.9;
    const steps = [[0, 0], [0, base]]; for (let r = 0; r < n; r++) steps.push([(r + 1) * run, base + r * rise], [(r + 1) * run, base + (r + 1) * rise]);   // [how far back, how high]
    if (p.arc) {
      const { x: cx = 0, z: cz = 0, r: r0, from, to } = p.arc, span = to - from;
      for (let r = 0; r < n; r++) {
        const inner = r0 + r * run, y = base + r * rise;
        put(mat, new THREE.RingGeometry(inner, inner + run, Math.ceil(span * 12), 1, from - Math.PI / 2, span).rotateX(-Math.PI / 2).translate(cx, y, cz),
          new THREE.CylinderGeometry(inner, inner, r ? rise : base, Math.ceil(span * 12), 1, true, from, span).translate(cx, r ? y - rise / 2 : base / 2, cz));
        rows(c, { rows: 1, seat: p.seat, standing: p.standing }, (inner + run * 0.5) * span, k => { const ang = from + k / (inner + run * 0.5); return [cx + (inner + run * 0.5) * Math.sin(ang), y, cz + (inner + run * 0.5) * Math.cos(ang)]; }, (x, z) => Math.atan2(x - cx, z - cz));
      }
      out.keepOut.push((x, z) => { const d = Math.hypot(x - cx, z - cz), ang = Math.atan2(x - cx, z - cz); return d > r0 - 0.6 && d < r0 + deep + 1 && ang > from - 0.05 && ang < to + 0.05; });
      return;
    }
    for (const side of p.sides || ['left', 'right', 'back']) {
      if (side === 'back') {
        const x0 = p.x0 ?? -W / 2, x1 = p.x1 ?? W / 2, zf = D / 2 - deep;   // the front of the stand
        put(mat, sweep(steps.map(([d, y]) => [zf + d, y]), x0, x1, 'x'));
        rows(c, { rows: n, seat: p.seat, standing: p.standing }, x1 - x0, (k, r) => [x0 + k, base + r * rise, zf + (r + 0.5) * run], () => 0);
        out.keepOut.push(rect(x0 - 0.3, x1 + 0.3, zf - 0.6, D / 2 + 1));
        if (p.roof) put(steel, box(x1 - x0, 0.4, deep * 0.8, (x0 + x1) / 2, base + n * rise + 5.5, D / 2 - deep * 0.4));
      } else {
        const s = side === 'left' ? -1 : 1, z0 = p.z0 ?? -c.D / 2, z1 = p.z1 ?? D / 2 - (p.sides && !p.sides.includes('back') ? 0 : deep), xf = s * (W / 2 - deep);
        put(mat, sweep(steps.map(([d, y]) => [xf + s * d, y]), z0, z1));
        rows(c, { rows: n, seat: p.seat, standing: p.standing }, z1 - z0, (k, r) => [xf + s * (r + 0.5) * run, base + r * rise, z0 + k], facing);
        out.keepOut.push(s < 0 ? rect(-W / 2 - 1, xf + 0.6, z0 - 0.3, z1 + 0.3) : rect(xf - 0.6, W / 2 + 1, z0 - 0.3, z1 + 0.3));
        if (p.roof) put(steel, box(deep * 0.8, 0.4, z1 - z0, s * (W / 2 - deep * 0.4), base + n * rise + 5.5, (z0 + z1) / 2));
      }
    }
  },
  // a pipe organ against a wall: { wall: 'front' | 'back', width, height, y }
  organ(c, p) {
    const { D, put, surface, plain } = c, back = p.wall === 'back', z = back ? D / 2 - 0.7 : -D / 2 + 0.7, dir = back ? -1 : 1, w = p.width || 9, h = p.height || 8, y = p.y || 2;
    const wood = surface('panel'), metal = plain(0xb9b2a0, { roughness: 0.28, metalness: 0.9, gain: 2.2 }), n = Math.round(w / 0.24);
    put(wood, box(w + 0.6, 1.2, 1.2, 0, y + 0.6, z), box(w + 0.6, 0.35, 1.3, 0, y + h * 0.6, z), box(0.5, h, 1.2, -w / 2 - 0.3, y + h / 2, z), box(0.5, h, 1.2, w / 2 + 0.3, y + h / 2, z), box(w + 1.1, 0.4, 1.3, 0, y + h, z));
    for (let i = 0; i < n; i++) {   // towers of tall pipes at the sides and in the middle, shorter ones between
      const u = i / (n - 1) * 2 - 1, tower = Math.max(Math.exp(-Math.pow(Math.abs(u) - 0.86, 2) * 60), Math.exp(-u * u * 40));
      put(metal, post(0.05 + 0.06 * tower, (h - 1.4) * (0.4 + 0.52 * tower + 0.08 * Math.cos(u * 14)), u * (w / 2 - 0.2), z + dir * (0.3 + tower * 0.25), y + 1.2, 8));
    }
  },
  // the frame of a theatre's stage, with its curtains drawn back: { width, height, colour, curtain }
  proscenium(c, p) {
    const { W, H, put, plain, surface, L } = c, z = L.stage.front - 0.3, w = p.width || L.stage.width - 2, h = p.height || H * 0.62, side = (W - w) / 2, floor = L.stage.height;
    const frame = plain(p.colour ?? 0xa8946a, { roughness: 0.55, metalness: 0.2 }), gold = plain(0xc9a24a, { roughness: 0.35, metalness: 0.8, gain: 2 }), cloth = surface('velvet', { tint: p.curtain });
    for (const s of [-1, 1]) put(frame, box(side, H, 0.7, s * (w / 2 + side / 2), H / 2, z)), put(gold, box(0.4, h, 0.8, s * (w / 2 + 0.2), floor + h / 2, z)), put(cloth, box(w * 0.15, h, 0.4, s * (w / 2 - w * 0.075), floor + h / 2, z - 0.6));
    put(frame, box(w, H - h - floor, 0.7, 0, floor + h + (H - h - floor) / 2, z)); put(gold, box(w + 0.8, 0.4, 0.8, 0, floor + h + 0.2, z)); put(cloth, box(w, h * 0.13, 0.35, 0, floor + h * 0.935, z - 0.55));
  },
  // stone hanging from the roof of a cave, and standing on its floor along the walls
  stalactites(c, p) {
    const { W, D, H, put, surface, sh } = c, rock = surface(sh.walls || 'rock'), drop = (sh.rough || 0) * 0.9;
    for (let i = 0; i < (p.count || 90); i++) { const x = (Math.random() - 0.5) * (W - 2), z = (Math.random() - 0.5) * (D - 2), len = 0.5 + Math.random() * Math.random() * 3.6; put(rock, new THREE.ConeGeometry(0.1 + len * 0.09, len, 7).rotateX(Math.PI).translate(x, H - drop - len / 2 + 0.3, z)); }
    for (let i = 0; i < (p.count || 90) / 3; i++) { const side = Math.random() < 0.5 ? -1 : 1, z = (Math.random() - 0.5) * (D - 3), len = 0.4 + Math.random() * 1.8; put(rock, new THREE.ConeGeometry(0.16 + len * 0.12, len, 7).translate(side * (W / 2 - 0.6 - Math.random() * 1.6 - (sh.rough || 0)), len / 2, z)); }
  },
  // shade sails over a clearing: bright triangles stretched between poles: { count, colours, z0, z1, y }
  sails(c, p) {
    const { W, D, put, plain, L } = c, cols = p.colours || [0xff2a8a, 0x2affd0, 0xffe02a, 0x8a3aff, 0xff6a1a], z0 = p.z0 ?? L.stage.front - 2, z1 = p.z1 ?? D / 2 - 6;
    for (let i = 0; i < (p.count || 22); i++) {
      const x = (Math.random() - 0.5) * (W - 6), z = z0 + Math.random() * (z1 - z0), y = (p.y || 7) + Math.random() * 3, s = 3 + Math.random() * 5, a = Math.random() * TAU;
      put(plain(cols[i % cols.length], { roughness: 1, side: THREE.DoubleSide, gain: 3.2 }), patch([0, 1, 2].map(k => [x + Math.cos(a + k * 2.1) * s, y + (k - 1) * (0.5 + Math.random()), z + Math.sin(a + k * 2.1) * s])));
    }
  },
  // a wall of loudspeakers, as a sound system stacks them in the street: { x, z, width, height, turn }
  speakers(c, p) {
    const { put, plain, out } = c, w = p.width || 6, h = p.height || 3.6, cab = plain(0x0c0c0e, { roughness: 0.7, gain: 2.2 }), cone = plain(0x24242a, { roughness: 0.4, metalness: 0.5, gain: 2.4 }), ry = p.turn || 0, nx = Math.round(w / 1.2), ny = Math.round(h / 0.9), list = [], cones = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = (i - (nx - 1) / 2) * 1.2, y = j * 0.9 + 0.45, top = j === ny - 1;
      list.push(box(1.16, 0.86, 0.8, x, y, 0));
      if (top) cones.push(box(0.9, 0.3, 0.05, x, y + 0.1, 0.41)); else for (const dx of j % 2 ? [-0.27, 0.27] : [0]) cones.push(new THREE.CircleGeometry(j % 2 ? 0.22 : 0.36, 18).translate(x + dx, y, 0.405));
    }
    put(cab, list.map(g => g.rotateY(ry).translate(p.x, 0, p.z))); put(cone, cones.map(g => g.rotateY(ry).translate(p.x, 0, p.z)));
    out.keepOut.push(near(p.x, p.z, w / 2 + 0.6));
  },
  // a piece of floor that nobody stands on: { rect: [x0, x1, z0, z1] }
  keep(c, p) { c.out.keepOut.push(rect(...p.rect)); },
  // palms in the room or on the terrace: { at: [[x, z, height], ...] }
  palms(c, p) { for (const [x, z, h] of p.at) { palm(c, x, z, h || 6); c.out.keepOut.push(near(x, z, 0.6)); } },
};
