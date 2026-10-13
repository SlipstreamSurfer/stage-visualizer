// Surfaces: what walls, floors and roofs are made of. Each kind is a small painted tile and a few numbers; a venue
// names them (walls: 'brick'). To add a kind, add an entry to SURFACES.
//
//   surfaces(lit) returns surface(kind, opts) and plain(colour, opts): materials that the beams light.
//     opts.tint    a colour to multiply the tile with (a red container, a blue one)
//     opts.uv      true: the tile follows the shape's own coordinates, which the shape gives in metres (floors,
//                  vaults, domes). Otherwise the tile is laid on from outside, a metre is a metre on any box or wall.
//     opts.side, opts.gain (how strongly the beams show on it)
import * as THREE from 'three/webgpu';

const S = 256;
const speckle = (g, n, lo, hi, alpha, max = 40) => { for (let i = 0; i < n; i++) { const v = lo + Math.random() * (hi - lo) | 0; g.fillStyle = `rgba(${v},${v},${v},${alpha})`; const s = 2 + Math.random() * max; g.fillRect(Math.random() * S, Math.random() * S, s, s * (0.3 + Math.random())); } };
const blots = (g, n, rgb, r0, r1, a0, a1) => { for (let i = 0; i < n; i++) { const x = Math.random() * S, y = Math.random() * S, r = r0 + Math.random() * (r1 - r0), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a0 + Math.random() * (a1 - a0)})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
const fill = (g, colour) => { g.fillStyle = colour; g.fillRect(0, 0, S, S); };
const bricks = (g, mortar, colour) => { fill(g, mortar); for (let y = 0, r = 0; y < S; y += 16, r++) for (let x = r % 2 ? -16 : 0; x < S; x += 32) { g.fillStyle = colour(); g.fillRect(x + 1, y + 1, 30, 14); } };

// one tile is `size` metres
export const SURFACES = {
  concrete: { size: 6, roughness: 0.5, metalness: 0.05, bump: 0.5, draw: g => {   // a poured floor: slabs with joints, stains, and the marks of years of use
    fill(g, '#2f2f31'); speckle(g, 500, 20, 80, 0.08); blots(g, 14, '8,8,9', 8, 48, 0.1, 0.35);
    g.strokeStyle = 'rgba(70,70,72,0.25)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(Math.random() * S, 0); g.bezierCurveTo(Math.random() * S, S * 0.3, Math.random() * S, S * 0.7, Math.random() * S, S); g.stroke(); }
    g.strokeStyle = 'rgba(10,10,10,0.7)'; g.lineWidth = 3; g.strokeRect(1, 1, S - 2, S - 2); } },
  steel: { size: 4, roughness: 0.6, metalness: 0.5, draw: g => { fill(g, '#25272b'); for (let x = 0; x < S; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(x, 0, 16, S); } speckle(g, 120, 20, 70, 0.07); } },
  corrugated: { size: 2.4, roughness: 0.55, metalness: 0.4, draw: g => { fill(g, '#9a9a9a'); for (let x = 0; x < S; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = gr; g.fillRect(x, 0, 16, S); } blots(g, 10, '60,30,10', 10, 50, 0.1, 0.3); } },   // a container's side, to be tinted
  grass: { size: 8, roughness: 1, metalness: 0, bump: 0.6, draw: g => {   // a festival field at night: trodden grass, with bare and muddy patches
    fill(g, '#0d150b');
    for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = `rgba(${20 + v * 25 | 0},${34 + v * 40 | 0},${14 + v * 16 | 0},0.5)`; g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 2 + Math.random() * 4); }
    blots(g, 9, '26,20,13', 14, 48, 0.4, 0.7); } },
  dirt: { size: 6, roughness: 1, metalness: 0, bump: 0.5, draw: g => { fill(g, '#17110b'); speckle(g, 900, 20, 60, 0.12, 6); blots(g, 12, '8,6,4', 10, 40, 0.2, 0.5); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${50 + Math.random() * 40 | 0},${34 + Math.random() * 24 | 0},12,0.5)`; g.fillRect(Math.random() * S, Math.random() * S, 3, 2); } } },   // a forest floor
  sand: { size: 6, roughness: 1, metalness: 0, bump: 0.4, draw: g => { fill(g, '#8a7658'); speckle(g, 1400, 120, 190, 0.08, 4); blots(g, 26, '60,48,34', 10, 44, 0.08, 0.22); } },
  playa: { size: 5, roughness: 1, metalness: 0, draw: g => {   // a dry lake bed: pale, cracked into plates
    fill(g, '#8d8474'); speckle(g, 600, 110, 170, 0.07, 5);
    g.strokeStyle = 'rgba(40,34,28,0.55)'; g.lineWidth = 1.2; for (let i = 0; i < 46; i++) { let x = Math.random() * S, y = Math.random() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } } },
  snow: { size: 8, roughness: 0.75, metalness: 0, draw: g => { fill(g, '#aeb9c8'); blots(g, 30, '220,232,245', 12, 60, 0.1, 0.3); blots(g, 14, '90,110,140', 10, 50, 0.08, 0.2); } },
  asphalt: { size: 6, roughness: 0.85, metalness: 0, bump: 0.3, draw: g => { fill(g, '#161617'); speckle(g, 1800, 40, 110, 0.1, 3); blots(g, 10, '4,4,5', 12, 50, 0.2, 0.5); } },
  rock: { size: 7, roughness: 0.95, metalness: 0, draw: g => { fill(g, '#6a6056'); blots(g, 60, '30,26,22', 8, 46, 0.15, 0.5); blots(g, 40, '150,138,120', 6, 30, 0.08, 0.25); speckle(g, 300, 20, 90, 0.08, 10); } },
  brick: { size: 2.4, roughness: 0.95, metalness: 0, draw: g => bricks(g, '#2a2523', () => { const v = 70 + Math.random() * 40 | 0; return `rgb(${v + 30},${v * 0.55 | 0},${v * 0.42 | 0})`; }) },
  whitebrick: { size: 2.4, roughness: 0.9, metalness: 0, draw: g => bricks(g, '#77736c', () => { const v = 168 + Math.random() * 34 | 0; return `rgb(${v},${v - 3},${v - 10})`; }) },   // brick under coats of white paint
  stone: { size: 3.2, roughness: 0.9, metalness: 0, draw: g => {   // dressed blocks in courses
    fill(g, '#3d3a35'); for (let y = 0, r = 0; y < S; y += 32, r++) for (let x = r % 2 ? -32 : 0; x < S; x += 64) { const v = 104 + Math.random() * 34 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(x + 1, y + 1, 62, 30); }
    blots(g, 22, '40,36,30', 8, 36, 0.08, 0.25); speckle(g, 200, 60, 150, 0.06, 6); } },
  tiles: { size: 2, roughness: 0.35, metalness: 0.05, draw: g => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#191817' : '#a59a86'; g.fillRect(x * 128, y * 128, 128, 128); } blots(g, 16, '255,255,255', 8, 40, 0.03, 0.08); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128); } },   // black and cream, on the square
  paving: { size: 2.4, roughness: 0.7, metalness: 0, draw: g => { fill(g, '#2c2b29'); for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { const v = 92 + Math.random() * 26 | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x + 1, y + 1, 62, 62); } speckle(g, 200, 40, 120, 0.06, 8); } },   // flags of pale stone
  wood: { size: 2.4, roughness: 0.55, metalness: 0, draw: g => {   // floorboards
    for (let x = 0; x < S; x += 32) { const v = Math.random(); g.fillStyle = `rgb(${96 + v * 40 | 0},${62 + v * 26 | 0},${34 + v * 14 | 0})`; g.fillRect(x, 0, 32, S); g.fillStyle = 'rgba(20,10,4,0.7)'; g.fillRect(x, 0, 1.5, S); g.fillRect(x, Math.random() * S, 32, 1.5);
      g.strokeStyle = 'rgba(40,22,10,0.25)'; for (let k = 0; k < 5; k++) { const gx = x + 3 + Math.random() * 26; g.beginPath(); g.moveTo(gx, 0); g.bezierCurveTo(gx + 3, S * 0.3, gx - 3, S * 0.7, gx, S); g.stroke(); } } } },
  panel: { size: 2.4, roughness: 0.6, metalness: 0, draw: g => {   // wall panelling: upright boards in frames
    fill(g, '#5a3a20'); for (let x = 0; x < S; x += 64) { const gr = g.createLinearGradient(x, 0, x + 64, 0); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.08, 'rgba(255,220,170,0.12)'); gr.addColorStop(0.92, 'rgba(255,220,170,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(x, 0, 64, S); }
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, S, 4); g.fillRect(0, 124, S, 5); g.strokeStyle = 'rgba(30,16,6,0.2)'; for (let k = 0; k < 50; k++) { const gx = Math.random() * S; g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx + 2, S); g.stroke(); } } },
  slats: { size: 1.6, roughness: 0.7, metalness: 0, draw: g => { fill(g, '#0a0908'); for (let x = 0; x < S; x += 16) { g.fillStyle = `rgb(${70 + Math.random() * 16 | 0},${48 + Math.random() * 10 | 0},30)`; g.fillRect(x, 0, 10, S); } } },   // wooden slats over black cloth, as in a room built for sound
  plaster: { size: 4, roughness: 0.9, metalness: 0, draw: g => { fill(g, '#b9b5ac'); speckle(g, 240, 150, 215, 0.05, 20); blots(g, 10, '120,114,104', 14, 60, 0.04, 0.12); } },
  velvet: { size: 2, roughness: 1, metalness: 0, draw: g => { fill(g, '#5c0d14'); for (let x = 0; x < S; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.45, 'rgba(255,90,90,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = gr; g.fillRect(x, 0, 32, S); } } },   // a curtain in folds, to be tinted
  carpet: { size: 4, roughness: 1, metalness: 0, draw: g => { fill(g, '#41101a'); speckle(g, 1500, 60, 120, 0.06, 3); } },
  canvas: { size: 3, roughness: 0.9, metalness: 0, draw: g => { fill(g, '#9c9484'); g.fillStyle = '#5a1216'; g.fillRect(0, 0, S / 2, S); const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); } },   // a striped big top
  stands: { size: 3, roughness: 1, metalness: 0, draw: g => { fill(g, '#0b0b0d'); for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < 0.3 ? '#3a2a22' : v < 0.5 ? '#77706a' : v < 0.6 ? '#3a1414' : '#15151a'; g.fillRect(Math.random() * S, Math.random() * S, 3, 4); } } },   // a full stand, from far away
  dark: { size: 4, roughness: 0.9, metalness: 0.1, draw: g => { fill(g, '#17181a'); speckle(g, 80, 10, 40, 0.1); } },
};

const tiles = {};
export function tile(kind) {
  return tiles[kind] ||= (() => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    (SURFACES[kind] || SURFACES.concrete).draw(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c); tex.userData.shared = true;
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    return tex;
  })();
}

export function surfaces(lit) {
  const made = new Map(), once = (key, make) => { let m = made.get(key); if (!m) made.set(key, m = make()); return m; };
  const surface = (kind, { tint = 0xffffff, uv = false, side = THREE.FrontSide, gain = 1.6 } = {}) => once([kind, tint, uv, side, gain].join(), () => {
    const k = SURFACES[kind] || SURFACES.concrete, map = tile(kind);
    const mat = new THREE.MeshStandardMaterial({ map, color: tint, roughness: k.roughness, metalness: k.metalness, side, ...(uv && k.bump ? { bumpMap: map, bumpScale: k.bump } : {}) });
    if (!uv) mat.userData.metres = k.size;
    return lit(mat, gain);
  });
  // how many of a kind's tiles fit in so many metres, for shapes that bring their own coordinates
  surface.size = kind => (SURFACES[kind] || SURFACES.concrete).size;
  const plain = (colour, { roughness = 0.8, metalness = 0, gain = 1.5, side = THREE.FrontSide, opacity = 1 } = {}) => once(['plain', colour, roughness, metalness, gain, side, opacity].join(), () =>
    lit(new THREE.MeshStandardMaterial({ color: colour, roughness, metalness, side, ...(opacity < 1 ? { transparent: true, opacity, depthWrite: false } : {}) }), gain));
  return { surface, plain };
}
