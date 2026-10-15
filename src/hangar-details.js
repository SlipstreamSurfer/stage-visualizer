// Production equipment and building services for Hangar. Static pieces are batched by material;
// no extra lights, frame callbacks or audio connections are needed, including at Light quality.
import * as THREE from 'three/webgpu';
import { box, post, strut, patch, batcher } from './shapes.js';

// Small, deterministic surface tiles: each rebuilt world owns its maps and releases them with its materials.
function detailMap(draw, size = 128) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function buildHangarDetails(L, { add, lit, plain, black, steel }) {
  const { W, D } = L.plan, st = L.stage;
  const group = add(new THREE.Group()); group.name = 'Hangar production details';
  const put = batcher(mesh => (group.add(mesh), mesh)), items = [], keepOut = [];
  const aluminium = plain(0x858b91, { roughness: 0.48, metalness: 0.75, gain: 1.1 });
  const wornPaint = detailMap((g, size) => {
    g.fillStyle = '#252c32'; g.fillRect(0, 0, size, size);
    let seed = 41;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 65; i++) {
      const x = random() * size, y = random() * size;
      g.strokeStyle = i % 4 ? 'rgba(91,103,112,0.22)' : 'rgba(8,12,15,0.32)';
      g.lineWidth = 0.5 + random(); g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + 2 + random() * 15, y + (random() - 0.5) * 4); g.stroke();
    }
  });
  const shell = lit(new THREE.MeshStandardMaterial({ map: wornPaint, roughness: 0.88 }), 1.3);
  const rubber = plain(0x111316, { roughness: 0.95, gain: 1.1 });
  const paint = plain(0x465460, { roughness: 0.7, metalness: 0.3, gain: 1.1 });
  const yellow = plain(0x9a852d, { roughness: 0.8, gain: 0.85 });
  const indicator = new THREE.MeshBasicMaterial({ color: 0x275c4c });
  const scuff = plain(0x101214, { roughness: 1, opacity: 0.2, gain: 0.6 });
  const perforations = detailMap((g, size) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 8; y < size; y += 16) for (let x = 8; x < size; x += 16) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  }, 64);
  const perforated = lit(new THREE.MeshStandardMaterial({ map: perforations, color: 0x9a9da3, roughness: 0.65, metalness: 0.65, side: THREE.DoubleSide }), 1.1);
  perforated.alphaTest = 0.5;
  // Each assembly is described in local metres, facing +z. Only its final geometry goes into a batch.
  function assembly(kind, at, turn, build) {
    items.push({ kind, at: [...at] });
    build((mat, ...geos) => put(mat, geos.flat().map(g => g.rotateY(turn).translate(...at))));
  }
  const cable = points => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, 0.022, 5, false);

  // Standard two-metre deck bays, with feet and bracing. The outer bays remain open for service access;
  // pleated black skirting dresses the audience-facing centre without making the stage a solid block.
  assembly('modular stage frame', [0, 0, st.z], 0, p => {
    const top = st.height - 0.16;
    for (let x = -st.width / 2 + 1; x < st.width / 2; x += 2) for (let z = -st.depth / 2 + 1; z < st.depth / 2; z += 2) {
      p(steel, box(0.065, top - 0.07, 0.065, x, (top + 0.07) / 2, z));
      p(rubber, box(0.18, 0.045, 0.18, x, 0.0225, z));
      p(aluminium, box(0.16, 0.04, 0.16, x, 0.065, z));
      p(paint, box(1.96, 0.1, 0.05, x, top - 0.05, z), box(0.05, 0.1, 1.96, x, top - 0.05, z));
    }
    for (const z of [-st.depth / 2 + 0.12, st.depth / 2 - 0.12]) {
      p(aluminium, box(st.width - 0.1, 0.1, 0.045, 0, top - 0.05, z));
      for (let x = -st.width / 2 + 1; x + 2 < st.width / 2; x += 4) {
        const braces = [];
        const anchor = Math.sign(z) * (st.depth / 2 - 1);
        strut([x, 0.12, anchor], [x + 2, top - 0.1, anchor], 0.025, braces);
        strut([x + 2, 0.12, anchor], [x, top - 0.1, anchor], 0.025, braces);
        p(steel, braces);
      }
    }
    for (const x of [-st.width / 2 + 0.12, st.width / 2 - 0.12]) {
      p(aluminium, box(0.045, 0.1, st.depth - 0.1, x, top - 0.05, 0));
      for (let z = -st.depth / 2 + 1; z + 2 < st.depth / 2; z += 2) {
        const braces = [];
        const anchor = Math.sign(x) * (st.width / 2 - 1);
        strut([anchor, 0.12, z], [anchor, top - 0.1, z + 2], 0.025, braces); p(steel, braces);
      }
    }
    const edge = st.width / 2 - 3;
    for (let x = -edge; x < edge - 0.01; x += 0.25) {
      const a = st.depth / 2 + 0.027, b = a + (Math.round((x + edge) * 4) % 2 ? 0.045 : -0.045);
      p(black, patch([[x, 0.18, a], [x + 0.25, 0.18, b], [x + 0.25, top - 0.02, b], [x, top - 0.02, a]]));
    }
  });

  const barrier = L.facilities.find(f => f.type === 'barrier');
  if (barrier) {
    const n = Math.floor((W - 1) / 2.4), z = st.front + (barrier.pit || 2.6);
    for (let i = 0; i < n; i++) assembly('crowd barrier panel', [(i - (n - 1) / 2) * 2.4, 0, z], 0, p => {
      const panel = new THREE.PlaneGeometry(2.18, 0.91).translate(0, 0.61, 0.006);
      const uv = panel.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * 2.18 / 0.24, uv.getY(j) * 0.91 / 0.24);
      p(perforated, panel);
      p(aluminium, new THREE.CylinderGeometry(0.037, 0.037, 2.32, 8).rotateZ(Math.PI / 2).translate(0, 1.12, 0));
      p(aluminium, box(2.32, 0.045, 0.04, 0, 0.14, 0));
      p(paint, box(2.3, 0.04, 1.05, 0, 0.03, -0.5), box(2.3, 0.055, 0.24, 0, 0.35, -0.16));
      for (const x of [-1.15, 1.15]) {
        p(aluminium, post(0.028, 1.06, x, 0, 0.06, 8));
        const brace = []; strut([x, 0.98, -0.035], [x, 0.07, -0.98], 0.035, brace); p(steel, brace);
        for (const y of [0.32, 0.89]) p(aluminium, post(0.045, 0.09, x, 0, y, 8));
      }
      // Grip strips on the crew footplate, and a coupling pin at the panel joint.
      for (let x = -1; x <= 1; x += 0.25) p(rubber, box(0.018, 0.008, 0.88, x, 0.054, -0.5));
      p(steel, post(0.018, 0.1, 1.17, 0, 1.09, 6));
    });
  }

  function flightcase(at, turn = 0, stacked = false) {
    assembly('flightcase', at, turn, p => {
      const w = 1.32, d = 0.76, y = stacked ? 0 : 0.18, h = 0.64;
      p(shell, box(w, h, d, 0, y + h / 2, 0));
      // Aluminium lid rails, vertical corner extrusions and corner caps.
      for (const height of [y + 0.035, y + 0.49, y + h - 0.025]) {
        for (const z of [-d / 2, d / 2]) p(aluminium, box(w + 0.035, 0.035, 0.028, 0, height, z));
        for (const x of [-w / 2, w / 2]) p(aluminium, box(0.028, 0.035, d, x, height, 0));
      }
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
        p(aluminium, box(0.03, h, 0.03, x, y + h / 2, z));
        for (const height of [y + 0.06, y + h - 0.06]) p(aluminium, box(0.1, 0.1, 0.05, x, height, z));
        if (!stacked) {
          p(steel, box(0.045, 0.08, 0.06, x * 0.82, 0.14, z * 0.75));
          p(rubber, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 10).rotateZ(Math.PI / 2).translate(x * 0.82, 0.075, z * 0.75));
        }
      }
      // Recessed handle and butterfly catches on the audience side.
      p(black, box(0.27, 0.13, 0.012, 0, y + 0.28, d / 2 + 0.016));
      p(aluminium, box(0.19, 0.025, 0.03, 0, y + 0.28, d / 2 + 0.031));
      for (const x of [-0.43, 0.43]) {
        p(aluminium, box(0.065, 0.11, 0.025, x, y + 0.49, d / 2 + 0.02));
        p(steel, box(0.028, 0.05, 0.013, x, y + 0.49, d / 2 + 0.038));
      }
      p(yellow, box(0.22, 0.07, 0.009, 0.38, y + 0.24, d / 2 + 0.014));
      // Small worn corners catch the light; the panel texture supplies the finer scratches.
      for (const x of [-0.57, 0.53]) p(paint, box(0.08, 0.009, 0.006, x, y + 0.11, d / 2 + 0.008));
    });
  }
  function rack(at, turn) {
    assembly('equipment rack', at, turn, p => {
      p(shell, box(0.74, 1.48, 0.8, 0, 0.86, 0));
      for (const x of [-0.34, 0.34]) {
        p(aluminium, box(0.035, 1.48, 0.035, x, 0.86, 0.41));
        for (const z of [-0.3, 0.3]) p(rubber, new THREE.CylinderGeometry(0.085, 0.085, 0.06, 10).rotateZ(Math.PI / 2).translate(x, 0.085, z));
      }
      for (let row = 0; row < 6; row++) {
        const y = 0.3 + row * 0.2;
        p(black, box(0.61, 0.17, 0.025, 0, y, 0.414));
        for (let j = 0; j < 5; j++) p(steel, box(0.06, 0.055, 0.012, -0.21 + j * 0.075, y, 0.433));
        p(indicator, box(0.025, 0.018, 0.012, 0.24, y, 0.435));
      }
      p(aluminium, box(0.72, 0.035, 0.83, 0, 1.61, 0));
    });
  }
  function reel(at, turn) {
    assembly('cable reel', at, turn, p => {
      for (const x of [-0.23, 0.23]) {
        p(paint, new THREE.CylinderGeometry(0.3, 0.3, 0.028, 16).rotateZ(Math.PI / 2).translate(x, 0.4, 0));
        const legs = [];
        for (const z of [-0.27, 0.27]) strut([x, 0.4, 0], [x, 0.045, z], 0.035, legs);
        p(steel, legs);
      }
      p(rubber, new THREE.CylinderGeometry(0.235, 0.235, 0.43, 16).rotateZ(Math.PI / 2).translate(0, 0.4, 0));
      // Parallel rings read as wound cable rather than a smooth drum.
      for (let x = -0.18; x <= 0.18; x += 0.045) p(black, new THREE.TorusGeometry(0.235, 0.012, 4, 16).rotateY(Math.PI / 2).translate(x, 0.4, 0));
      p(aluminium, box(0.07, 0.035, 0.19, 0.27, 0.4, 0.065));
      p(rubber, cable([[0, 0.17, 0.12], [0.3, 0.045, 0.4], [0.7, 0.045, 0.5], [0.95, 0.045, 0.3]]));
    });
  }

  // The equipment stands in the unused sides of the stage, away from heads, jets and the DJ riser.
  for (const side of [-1, 1]) {
    flightcase([side * 8.8, st.height, st.front - 3.1], side * -0.12);
    flightcase([side * 8.8, st.height + 0.82, st.front - 3.1], side * -0.12, true);
    rack([side * 11.0, st.height, st.front - 3.3], side * -0.15);
    reel([side * 6.4, st.height, st.front - 3.2], side * 0.3);
    put(rubber, cable([[side * 3.4, st.height + 0.035, st.front - 4.6], [side * 5.5, st.height + 0.035, st.front - 4.9], [side * 9.3, st.height + 0.035, st.front - 4.5], [side * 11, st.height + 0.035, st.front - 3.8]]));
    // Two handrails follow the existing wing steps, with posts on the treads and a return at the landing.
    assembly('stage stair handrails', [side * (st.width / 2), 0, st.front - 2.2], 0, p => {
      for (const z of [-0.74, 0.74]) {
        const rail = [];
        strut([side * 0.05, st.height + 1, z], [side * 1.85, 1.05, z], 0.04, rail);
        for (const x of [0.2, 0.9, 1.6]) {
          const top = st.height + 1 - (st.height - 0.05) * (x - 0.05) / 1.8;
          strut([side * x, Math.max(0, top - 1), z], [side * x, top, z], 0.035, rail);
        }
        p(aluminium, rail);
      }
      for (let k = 0; k < 6; k++) {
        const height = st.height * (6 - k) / 6.5, x = side * (0.16 + k * 0.3);
        p(rubber, box(0.23, 0.006, 1.34, x, height + 0.004, 0));
      }
    });
  }
  // Thin joints divide the stage into reusable deck panels; a restrained edge strip catches the light.
  assembly('stage deck joints', [0, st.height + 0.008, st.z], 0, p => {
    for (let x = -st.width / 2 + 2; x < st.width / 2; x += 2) p(rubber, box(0.012, 0.006, st.depth - 0.04, x, 0, 0));
    for (let z = -st.depth / 2 + 1; z < st.depth / 2; z++) p(rubber, box(st.width - 0.04, 0.006, 0.012, 0, 0, z));
    for (let x = -st.width / 2 + 0.4; x < st.width / 2; x += 2) p(yellow, box(0.45, 0.025, 0.018, x, -0.055, st.depth / 2 + 0.012));
    // Gaffer-tape crosses locate the equipment; short scuffs break up the otherwise uniform deck.
    for (const x of [-8.8, 8.8]) {
      p(rubber, box(0.42, 0.003, 0.035, x, 0.008, 0.9), box(0.035, 0.003, 0.32, x, 0.008, 0.9));
      for (let i = 0; i < 3; i++) p(scuff, new THREE.PlaneGeometry(0.6 + i * 0.12, 0.015).rotateX(-Math.PI / 2).rotateY(0.24).translate(x - 0.35, 0.006, -0.15 + i * 0.09));
    }
  });

  // FOH has two equipment bays alongside its fenced riser. Reserve their footprint before placing the crowd.
  const foh = L.facilities.find(f => f.type === 'foh');
  if (foh) for (const side of [-1, 1]) {
    const x = side * 5.1, z = foh.z;
    flightcase([x, 0, z], side * 0.1);
    reel([x, 0, z + 1.35], side * Math.PI / 2);
    keepOut.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 0.85, z1: z + 2.4 });
    // Segmented cable protector joins the bay to FOH without a loose lead across the dance floor.
    assembly('FOH cable protector', [side * 4.1, 0, z], 0, p => {
      p(rubber, box(1.4, 0.045, 0.4, 0, 0.0225, 0));
      for (const offset of [-0.45, 0, 0.45]) p(yellow, box(0.12, 0.008, 0.36, offset, 0.049, 0));
    });
    assembly('transport wheel marks', [x, 0.011, z], side * 0.1, p => {
      for (const radius of [0.8, 1.25]) p(scuff, new THREE.RingGeometry(radius, radius + 0.035, 24, 1, 0.3, 1.35).rotateX(-Math.PI / 2));
    });
  }

  // Ladder cable trays sit below the existing ducts, outside the moving trusses' travel.
  for (const side of [-1, 1]) {
    assembly('wall cable tray', [side * (W / 2 - 0.55), 6.1, 0], 0, p => {
      for (const x of [-0.18, 0.18]) p(paint, box(0.035, 0.16, D - 5, x, 0, 0));
      for (let z = -D / 2 + 2.5; z < D / 2 - 2.4; z += 1.5) p(aluminium, box(0.38, 0.025, 0.04, 0, -0.055, z));
      for (const x of [-0.08, 0.03, 0.11]) p(rubber, box(0.035, 0.04, D - 5, x, -0.01, 0));
    });
    assembly('electrical cabinet', [side * (W / 2 - 0.23), 0, -4], -side * Math.PI / 2, p => {
      p(paint, box(1.1, 1.5, 0.3, 0, 1.65, 0));
      p(steel, box(0.018, 1.3, 0.012, 0, 1.65, 0.157));
      for (const x of [-0.1, 0.1]) p(aluminium, box(0.025, 0.16, 0.035, x, 1.65, 0.18));
      p(yellow, new THREE.CircleGeometry(0.095, 3).translate(0.28, 1.95, 0.16));
      for (const x of [-0.3, 0.3]) p(steel, box(0.035, 3.6, 0.035, x, 4.2, 0));
    });
    for (const z of [-16, 14]) assembly('wall ventilator', [side * (W / 2 - 0.32), 8.1, z], -side * Math.PI / 2, p => {
      p(paint, box(2.55, 2.55, 0.16, 0, 0, 0));
      p(black, new THREE.CylinderGeometry(1.18, 1.18, 0.16, 24).rotateX(Math.PI / 2).translate(0, 0, 0.16));
      p(aluminium, new THREE.TorusGeometry(1.2, 0.055, 6, 32).translate(0, 0, 0.32));
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        p(paint, box(0.38, 0.95, 0.035, 0.12, 0.63, 0).rotateY(0.25).rotateZ(angle).translate(0, 0, 0.27));
      }
      for (const radius of [0.38, 0.72, 1.06]) p(steel, new THREE.TorusGeometry(radius, 0.012, 4, 32).translate(0, 0, 0.39));
      for (let i = 0; i < 12; i++) p(steel, box(0.015, 2.32, 0.015).rotateZ(i * Math.PI / 12).translate(0, 0, 0.4));
      p(aluminium, new THREE.CylinderGeometry(0.19, 0.19, 0.15, 16).rotateX(Math.PI / 2).translate(0, 0, 0.4));
      for (const x of [-1.15, 1.15]) for (const y of [-1.15, 1.15]) p(aluminium, new THREE.CylinderGeometry(0.035, 0.035, 0.025, 6).rotateX(Math.PI / 2).translate(x, y, 0.1));
    });
  }
  const meshes = put.done();
  group.userData.items = items;
  group.userData.batches = meshes.length;
  group.userData.keepOut = keepOut;
  return { group, keepOut };
}
