// Facilities: everything a venue needs besides a stage and lights, the way a real event is laid out. Emergency
// exits and the entrance, bars, a cloakroom, first aid, water, toilets, the front-of-house desk, a platform for
// wheelchair users, the barrier in front of the stage with security and the subwoofers behind it, the wings, and
// speakers that hang further down the hall. A venue lists them in `facilities` (see venues/hangar.js); each one is
// built here and says which part of the floor it keeps free of crowd.
//
//   wall: 'left' (x = -W/2), 'right' or 'back' (the wall opposite the stage); at / from / to: metres along that wall
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lineArray } from './shapes.js';
import { LIGHT_TOWERS } from './daylight.js';

const EXIT_WIDTH = 2.4;   // a double emergency door

// how many metres of door a venue has to leave by, for the capacity test (see tests/show.test.mjs)
export function exitWidth(venue) {
  return (venue.facilities || []).reduce((w, f) => w + (f.type === 'exit' ? f.width || EXIT_WIDTH : f.type === 'entrance' ? f.width : 0), 0);
}

function sign(text, bg, fg, wide = 4) {
  const c = document.createElement('canvas'); c.width = 64 * wide; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, 64);
  g.fillStyle = fg; g.font = '900 40px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, 34);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, fog: false });
}

// L: the layout (fence: true for a fence round an open field); ctx: { add, lit, black, steel, env } from the world
export function buildFacilities(L, ctx) {
  const { W, D, H } = L.plan, st = L.stage, { add, lit, black, steel, env } = ctx, open = !!L.shell.open;
  const keepOut = [], people = [], shots = [], lamps = [], pois = [], updates = [], solids = [], layers = { terrace: new THREE.Group(), towers: new THREE.Group() };   // solids: [x0, z0, x1, z1], lines nobody walks through
  // the lane along the side walls, when the venue has one: the barrier in front of the stage stops where it begins
  const lane = L.facilities.find(f => f.type === 'corridor'), laneWidth = lane ? lane.width : 0, pitZ = st.front + (L.facilities.find(f => f.type === 'barrier')?.pit ?? 1.6);
  const red = lit(new THREE.MeshStandardMaterial({ color: 0x8a0c0c, roughness: 0.5 }), 1.4);
  const grey = lit(new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.5 }), 1.5, 0.2);
  const alu = lit(new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.4, metalness: 0.7 }), 1.3, 0.6);
  // crowd barriers: dark matt paint, so they do not catch the eye; the top rail a shade lighter to read the line
  const barrierPaint = lit(new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.75, metalness: 0.2 }), 1.3, 0.15), barrierRail = lit(new THREE.MeshStandardMaterial({ color: 0x4a4d53, roughness: 0.55, metalness: 0.4 }), 1.3, 0.3);
  const white = lit(new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 }), 1.2);
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
  const SIGN = { exit: sign('EXIT', '#0a7a36', '#ffffff', 3), bar: sign('BAR', '#1a0f04', '#ffb45a', 3), cloak: sign('CLOAKROOM', '#06101c', '#9fc4ff', 6), aid: sign('FIRST AID  +', '#0a7a36', '#ffffff', 6),
    water: sign('WATER', '#0a3a7a', '#ffffff', 4), toilets: sign('TOILETS', '#111111', '#ffffff', 5), crew: sign('CREW ONLY', '#111111', '#ffd020', 6), access: sign('ACCESS', '#0a3a7a', '#ffffff', 4) };

  // a place on a wall: a group whose x runs along the wall and whose z points into the room
  function place(wall, at) {
    const f = wall === 'left' ? { x: -W / 2, z: at, ry: Math.PI / 2 } : wall === 'right' ? { x: W / 2, z: at, ry: -Math.PI / 2 } : wall === 'back' ? { x: at, z: D / 2, ry: Math.PI } : { x: wall[0], z: wall[1], ry: wall[2] || 0 };
    const g = add(new THREE.Group()); g.position.set(f.x, 0, f.z); g.rotation.y = f.ry;
    const cos = Math.cos(f.ry), sin = Math.sin(f.ry), toWorld = (x, z) => [f.x + x * cos + z * sin, f.z - x * sin + z * cos];
    return {
      box(w, h, d, x, y, z, mat = black) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; },
      plate(w, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); g.add(m); return m; },
      disc(r, x, y, z, mat) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat); m.position.set(x, y, z); g.add(m); return m; },
      // someone standing here; facing 0 looks into the room, Math.PI at the wall
      person(x, z, facing, kind) { const [wx, wz] = toWorld(x, z); people.push({ x: wx, y: 0, z: wz, ry: f.ry + facing, kind }); },
      light(x, y, z, colour, power, reach) { const p = new THREE.PointLight(colour, power, reach, 2); p.position.set(x, y, z); g.add(p); lamps.push(p); },
      free(x0, x1, z0, z1) { const c = [toWorld(x0, z0), toWorld(x1, z0), toWorld(x0, z1), toWorld(x1, z1)]; keepOut.push({ x0: Math.min(...c.map(p => p[0])), x1: Math.max(...c.map(p => p[0])), z0: Math.min(...c.map(p => p[1])), z1: Math.max(...c.map(p => p[1])) }); },
      // somewhere people walk to, and stand facing the wall
      poi(x, z) { const [wx, wz] = toWorld(x, z); pois.push({ x: wx, z: wz, ry: f.ry + Math.PI }); },
      // a line nobody walks through (a barrier, a fence), from one point to another
      solid(x0, z0, x1, z1) { solids.push([...toWorld(x0, z0), ...toWorld(x1, z1)]); },
      group: g,
      // many small parts of one material as one mesh: a desk full of faders is one draw, not hundreds
      parts(mat) { const list = []; return { box: (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => list.push(new THREE.BoxGeometry(w, h, d).rotateZ(rz).rotateX(rx).rotateY(ry).translate(x, y, z)), cyl: (r, h, x, y, z, rx = 0) => list.push(new THREE.CylinderGeometry(r, r, h, 8).rotateX(rx).translate(x, y, z)), done() { if (list.length) g.add(new THREE.Mesh(mergeGeometries(list.map(q => q.toNonIndexed())), mat)); } }; },
      toWorld,
    };
  }

  // Outside the open hangar door (f.yard): a terrace fenced off on the apron, with beer benches, standing tables and
  // strings of bulbs, people out for air; beyond it the production's yard as at any show in a hangar: the trucks
  // that brought it, the band's nightliner, a generator, cases waiting, and mobile light towers that light the apron
  // (their pools of light are drawn on it, daylight.js). Drawn only while the door is open.
  function yard(f) {
    const y = place([f.at, D / 2, 0]), g = y.group, tw = place([f.at, D / 2, 0]), towerGroup = tw.group, mast = tw.parts(alu), base = tw.parts(grey), heads = tw.parts(black), lamp = tw.parts(glow(3.2, 3.0, 2.6)), wire = y.parts(fence), tube = y.parts(alu), blocks = y.parts(grey), wood = y.parts(timber), dark = y.parts(black), bulbs = y.parts(glow(2.2, 1.4, 0.6)), floods = y.parts(glow(3.2, 3.0, 2.6)), glass = y.parts(windows), cabs = y.parts(cab);
    if (env) updates.push(() => { g.visible = towerGroup.visible = env.door > 0.005; });
    layers.terrace = g; layers.towers = towerGroup;
    // the terrace: building fence (a mesh panel in a tube frame on concrete feet) round three sides, a gate at the back
    const panel = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3.5)), ry = Math.atan2(x1 - x0, z1 - z0);
      const across = Math.abs(x1 - x0) > Math.abs(z1 - z0), dims = (a, h, b) => across ? [a, h, b] : [b, h, a];   // a fence line runs along x or along z
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, l = len / n - 0.08;
        wire.box(...dims(l, 1.9, 0.01), x, 1.05, z); tube.box(...dims(l, 0.04, 0.04), x, 2.0, z); tube.box(...dims(l, 0.04, 0.04), x, 0.1, z);
        for (const k of [-l / 2, l / 2]) { tube.box(0.04, 2, 0.04, x + Math.sin(ry) * k, 1.0, z + Math.cos(ry) * k); blocks.box(...dims(0.62, 0.14, 0.22), x + Math.sin(ry) * k, 0.07, z + Math.cos(ry) * k); }
      }
      y.solid(x0, z0, x1, z1);
    };
    const T = 14;   // how deep the terrace is
    for (const s of [-1, 1]) panel(s * 15, 0.4, s * 15, T);
    panel(-15, T, 7, T); panel(10.5, T, 15, T);   // the gate between 7 and 10.5 stands open for the crew
    for (const [x, z, ry] of [[-9, 5, 0.1], [-4, 9.5, -0.05], [3, 5.5, 0.08], [9.5, 9, 0], [-11, 11, 0.2]]) {   // beer benches: a table and two benches
      const c = Math.cos(ry), sn = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
      for (const [dz, top, wdt] of [[0, 0.76, 0.5], [-0.62, 0.46, 0.25], [0.62, 0.46, 0.25]]) { const [px, pz] = at(0, dz); wood.box(2.2, 0.035, wdt, px, top, pz); for (const e of [-0.9, 0.9]) { const [lx, lz] = at(e, dz); dark.box(0.04, top, wdt * 0.8, lx, top / 2, lz); } }
      const n = 3 + (Math.random() * 3 | 0);
      for (let k = 0; k < n; k++) { const side = k % 2 ? 1 : -1, [px, pz] = at(-0.8 + k * 0.45, side * 0.95); y.person(px, pz, side > 0 ? Math.PI : 0, 'guest'); }
    }
    for (const [x, z] of [[-1, 2.5], [7, 2.2], [12.5, 4.5]]) {   // standing tables, with people round them
      tube.box(0.06, 1.1, 0.06, x, 0.55, z); wood.box(0.7, 0.03, 0.7, x, 1.1, z); blocks.box(0.5, 0.03, 0.5, x, 0.015, z);
      for (let k = 0, n = 3 + (Math.random() * 2 | 0); k < n; k++) { const a = k / n * 6.28 + Math.random() * 0.3; y.person(x + Math.sin(a) * 0.7, z + Math.cos(a) * 0.7, a + Math.PI, 'guest'); }
    }
    for (let k = 0; k < 9; k++) { const a = Math.random() * 6.28, x = -13 + Math.random() * 26, z = 1.5 + Math.random() * 11; y.person(x, z, a, 'guest'); }   // and some just standing, talking, with a drink
    // strings of bulbs from the hall to masts at the back of the terrace
    for (const x of [-12, -4, 4, 12]) {
      tube.box(0.08, 4.2, 0.08, x, 2.1, T - 0.4);
      for (let t = 0.03; t < 1; t += 0.055) bulbs.box(0.09, 0.09, 0.09, x, 4.4 - t * 0.5 - Math.sin(t * Math.PI) * 0.7, 0.4 + t * (T - 0.8));
    }
    // the production yard
    const truck = (x, z, ry, colour) => {
      const c = Math.cos(ry), sn = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c], body = y.parts(lit(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0.3 }), 1.3));
      const piece = (parts, w, h, l, dx, py, dz) => { const [px, pz] = at(dx, dz); parts.box(w, h, l, px, py, pz, 0, ry); };
      piece(body, 2.5, 2.9, 13.6, 0, 2.55, 0); piece(dark, 2.3, 0.4, 13.2, 0, 0.95, 0);   // the trailer and its frame
      for (const dz of [-4.3, -5.6, -6.9]) for (const s of [-1, 1]) piece(dark, 0.3, 0.95, 0.95, s * 1.05, 0.48, dz);   // wheels
      piece(cabs, 2.5, 2.7, 2.3, 0, 2.05, 8.3); piece(dark, 2.3, 0.7, 3.4, 0, 0.75, 7.9); piece(glass, 2.3, 0.9, 0.04, 0, 2.6, 9.47);   // the tractor
      for (const dz of [7.6, 8.9]) for (const s of [-1, 1]) piece(dark, 0.3, 1.0, 1.0, s * 1.05, 0.5, dz);
      body.done();
    };
    truck(-27, 28, 0.35, 0xd5d8dc); truck(-37, 22, 0.3, 0xc9ccd0); truck(31, 40, -0.45, 0xd0d2d6);
    { const ry = -0.2, c = Math.cos(ry), sn = Math.sin(ry), at = (dx, dz) => [44 + dx * c + dz * sn, 20 - dx * sn + dz * c];   // the nightliner
      const [bx, bz] = at(0, 0);
      const bus = y.parts(lit(new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.4, metalness: 0.5 }), 1.3));
      bus.box(2.55, 3.4, 13.7, bx, 2.0, bz, 0, ry); bus.done();
      for (const s of [-1, 1]) { const [wx, wz] = at(s * 1.285, 0); glass.box(0.02, 0.9, 12.5, wx, 2.6, wz, 0, ry); } }
    blocks.box(6.06, 2.6, 2.44, -18, 1.3, 30); dark.box(0.2, 1.2, 0.2, -16, 3.2, 30); bulbs.box(0.25, 0.12, 0.12, -18, 2.45, 28.7);   // the generator, a lamp over its door
    for (let k = 0; k < 7; k++) dark.box(1.2, 0.62 * (1 + k % 2), 0.62, 17 + (k % 4) * 1.25, 0.31 * (1 + k % 2), 2 + (k > 3 ? 0.8 : 0));   // cases waiting by the wall
    // light towers: a trailer, a mast and four floods turned down at the apron
    for (const [x, z] of LIGHT_TOWERS) {
      base.box(1.4, 1.1, 3.4, x, 0.75, z); mast.box(0.16, 9, 0.16, x, 5.5, z); mast.box(1.6, 0.1, 0.12, x, 9.9, z);
      for (const k of [-0.6, -0.2, 0.2, 0.6]) { heads.box(0.4, 0.32, 0.18, x + k, 10.1, z, -0.6); lamp.box(0.34, 0.26, 0.04, x + k, 10.03, z - 0.1, -0.6); }   // turned towards the hall and down
    }
    for (const part of [mast, base, heads, lamp]) part.done();
    for (const part of [wire, tube, blocks, wood, dark, bulbs, floods, glass, cabs]) part.done();
  }

  const BUILD = {
    // a double emergency door with a lit sign over it, and the floor in front of it kept free
    exit(f) {
      const p = place(f.wall, f.at), w = f.width || EXIT_WIDTH;
      if (open) {   // in a fence: a gate standing open, wide enough for a crowd, with a lit sign on a mast either side
        for (const side of [-1, 1]) { p.box(0.18, 5.2, 0.18, side * (w / 2 + 0.1), 2.6, 0, steel); p.plate(1.6, 0.53, side * (w / 2 + 0.1), 4.6, 0.12, SIGN.exit); p.box(0.3, 0.12, 0.3, side * (w / 2 + 0.1), 5.3, 0, glow(0.5, 1.3, 0.6)); }
        p.free(-w / 2 - 0.8, w / 2 + 0.8, 0, 5);
        return;
      }
      for (const s of [-1, 1]) { p.box(w / 2 - 0.04, 2.3, 0.07, s * w / 4, 1.15, 0.06, grey); p.box(0.9, 0.05, 0.05, s * w / 4, 1.05, 0.12, alu); }   // the leaves and their panic bars
      p.box(w + 0.3, 0.14, 0.12, 0, 2.38, 0.06, steel);
      p.plate(1.0, 0.33, 0, 2.72, 0.09, SIGN.exit);
      p.box(0.3, 0.1, 0.12, 0, 3.05, 0.1, glow(0.8, 0.9, 0.8));   // emergency lighting
      p.box(0.14, 0.5, 0.14, w / 2 + 0.55, 1.0, 0.12, red); p.box(0.2, 0.2, 0.02, w / 2 + 0.55, 1.6, 0.03, red);   // a fire extinguisher beside every exit
      p.free(-w / 2 - 0.6, w / 2 + 0.6, 0, 3.2);
    },
    // the way in: a wide opening with its doors open, and security checking
    entrance(f) {
      const p = place(f.wall, f.at), w = f.width;
      if (open) {   // a gate of truss with the festival's lights on it, and the lanes where bags are checked
        for (const side of [-1, 1]) p.box(0.9, 8, 0.9, side * (w / 2 + 0.45), 4, 0, steel);
        p.box(w + 1.8, 1.4, 0.9, 0, 8.2, 0, steel); p.box(w, 0.25, 0.1, 0, 7.3, 0.5, glow(1.4, 0.7, 0.25)); p.plate(5, 1.65, 0, 8.25, 0.47, SIGN.exit);
        for (let i = 0, n = Math.round(w / 4); i <= n; i++) { const x = -w / 2 + w * i / n; p.box(0.08, 1.1, 5, x, 0.55, 3.2, fence); if (i < n) p.person(x + w / n / 2, 1.6, 0, 'security'); }
        p.light(0, 6, 2, 0xffc890, 30, 40); p.poi(-w / 4, 9); p.poi(w / 4, 9);
        p.free(-w / 2 - 1.5, w / 2 + 1.5, 0, 7.5);
        return;
      }
      // through a wall: the night outside it, and a frame; through a hangar door, only the lanes, in front of its middle
      const inDoor = L.facilities.some(q => q.type === 'hangarDoor' && q.wall === f.wall && Math.abs(q.at - f.at) < q.width / 2);
      if (!inDoor) { p.box(w, 3.2, 0.1, 0, 1.6, 0.05, glow(0.012, 0.014, 0.02)); p.box(w + 0.6, 0.3, 0.25, 0, 3.35, 0.12, steel); }
      for (let i = 0, n = Math.round(w / 2); i <= n; i++) { const x = -w / 2 + w * i / n; p.box(0.12, 3.2, 0.25, x, 1.6, 0.12, steel); if (i < n) p.box(0.06, 2.6, 0.9, x + 0.08, 1.3, 0.55, grey); }
      p.plate(1.4, 0.46, 0, 3.75, 0.14, SIGN.exit);
      for (let i = 0; i < 3; i++) p.person(-w / 3 + i * w / 3, 1.9, 0, 'security');
      p.light(0, 2.8, 1.2, 0x8fa8ff, 10, 14);
      p.poi(-w / 4, 3.2); p.poi(w / 4, 3.2);
      p.free(-w / 2 - 1, w / 2 + 1, 0, 5.5);
    },
    // the great sliding doors a hangar has: ribbed steel leaves on a rail, with the hall's number painted on them
    hangarDoor(f) {
      // Six leaves on three tracks, from the floor up. Open, each half slides to its end of the opening, the three
      // leaves stacked one behind the other, and the middle of the opening is free (env.door, 0 shut to 1 open; it
      // takes its time). The rails are in the floor, the guides along the top.
      const p = place(f.wall, f.at), h = f.top - f.bottom, leaves = 6, w = f.width / leaves, track = i => i < 3 ? 2 - i : i - 3, leafOf = [];
      const paint = lit(new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.5, metalness: 0.6 }), 1.4, 0.3);
      for (let i = 0; i < leaves; i++) {
        const x = (i - (leaves - 1) / 2) * w, z = 0.06 + track(i) * 0.09, leaf = [p.box(w - 0.12, h, 0.06, x, f.bottom + h / 2, z, paint)];
        for (let y = f.bottom + 0.6; y < f.top; y += 1.15) leaf.push(p.box(w - 0.2, 0.09, 0.05, x, y, z + 0.05, steel));
        leaf.push(p.box(0.08, h, 0.04, x - w / 2 + 0.1, f.bottom + h / 2, z + 0.05, steel), p.box(0.08, h, 0.04, x + w / 2 - 0.1, f.bottom + h / 2, z + 0.05, steel));   // the stiles
        leafOf.push({ leaf, shut: x, open: (i < 3 ? -1 : 1) * (f.width - w) / 2 });
      }
      if (env) updates.push(() => { for (const { leaf, shut, open } of leafOf) for (const m of leaf) m.position.x = shut + (open - shut) * env.door; });
      p.box(f.width + 1, 0.3, 0.3, 0, f.top + 0.15, 0.15, steel);   // the guide along the top
      for (const s of [-1, 1]) p.box(0.45, f.top + 0.3, 0.7, s * (f.width / 2 + 0.22), (f.top + 0.3) / 2, 0, steel);   // the columns either side, as deep as the wall is thick
      for (const k of [0.06, 0.15, 0.24]) p.box(f.width + 1, 0.012, 0.05, 0, 0.006, k, steel);   // and the rails in the floor
      if (f.number) p.plate(h * 0.4, h * 0.4, f.width / 2 - w, f.bottom + h * 0.6, 0.2, new THREE.MeshBasicMaterial({ map: sign(f.number, 'rgba(0,0,0,0)', '#ffffff', 1).map, transparent: true, color: new THREE.Color(0.05, 0.05, 0.05), fog: false }));
      if (f.yard && env) yard(f);
    },
    // a bar along a wall: the counter, fridges behind it, staff, people ordering, and warm light over it
    // depth: how far the counter stands from the wall (2.6 m in a hall, less in a small room)
    bar(f) {
      const len = f.to - f.from, p = place(f.wall, (f.from + f.to) / 2), d = f.depth ?? 2.6, top = Math.min(3.75, H - 0.9);
      p.box(len, 1.08, 0.7, 0, 0.54, d, grey); p.box(len + 0.1, 0.06, 0.82, 0, 1.11, d, alu);
      p.box(len, 0.04, 0.04, 0, 0.98, d + 0.37, glow(0.7, 0.35, 0.1));   // a strip of light under the edge of the counter
      for (let x = -len / 2 + 0.8; x < len / 2 - 0.6; x += 1.45) { p.box(1.25, 2.0, 0.5, x, 1.0, 0.3, black); p.plate(1.05, 1.5, x, 1.1, 0.56, glow(0.035, 0.05, 0.07)); }   // fridges
      for (let x = -len / 2 + 0.5; x < len / 2 - 0.3; x += 0.16) if (Math.random() < 0.8) p.box(0.07, 0.24 + Math.random() * 0.08, 0.07, x, 2.14, 0.3, glow(0.05 + Math.random() * 0.09, 0.035 + Math.random() * 0.04, 0.01 + Math.random() * 0.02));   // bottles on top, lit from behind
      p.box(len, 0.3, 0.2, 0, top - 0.55, 0.3, steel); p.plate(Math.min(3.2, len * 0.4), Math.min(0.95, len * 0.12), 0, top, 0.2, SIGN.bar);
      for (let x = -len / 2 + 1.2; x < len / 2 - 1; x += 2.3) { p.box(0.02, 0.5, 0.02, x, top - 0.7, d - 0.3, steel); p.box(0.22, 0.16, 0.22, x, top - 1.0, d - 0.3, glow(2.2, 1.3, 0.5)); }
      p.light(0, 2.5, d - 0.4, 0xffa850, 16 * Math.min(1, len / 12), 15);
      for (let x = -len / 2 + 1.5; x < len / 2 - 1; x += 3.2) p.person(x + (Math.random() - 0.5), (0.6 + d - 0.35) / 2 + 0.2, 0, 'staff');
      for (let x = -len / 2 + 0.6; x < len / 2 - 0.4; x += 0.75) { if (Math.random() < 0.72) p.person(x, d + 0.75 + Math.random() * 0.15, Math.PI, 'guest'); if (Math.random() < 0.3) p.person(x + 0.3, d + 1.6 + Math.random() * 0.4, Math.PI + (Math.random() - 0.5), 'guest'); }
      for (let x = -len / 2 + 1; x < len / 2 - 0.5; x += 2.1) p.poi(x, d + 2.15);
      for (const s of [-1, 1]) p.box(0.5, 0.9, 0.5, s * (len / 2 + 0.6), 0.45, 0.5, grey);   // bins at either end
      if (open) {   // under a tent, with a string of bulbs along the front
        p.box(len + 1.2, 0.12, d + 2.2, 0, 3.6, d / 2 + 0.3, tent); p.box(len + 1.2, 3.6, 0.08, 0, 1.8, -0.05, tent);
        for (const x of [-len / 2 - 0.5, 0, len / 2 + 0.5]) p.box(0.1, 3.6, 0.1, x, 1.8, d + 1.3, steel);
        for (let x = -len / 2 - 0.4; x <= len / 2 + 0.4; x += 0.7) p.box(0.1, 0.1, 0.1, x, 3.4 - 0.18 * Math.abs(Math.sin(x * 1.1)), d + 1.38, glow(1.9, 1.2, 0.5));
      }
      p.free(-len / 2 - 1, len / 2 + 1, 0, d + 2.6);
      const [cx, cz] = p.toWorld(len / 2 + 1.5, d + 2), [lx, lz] = p.toWorld(-len / 2, d - 0.4);
      shots.push({ name: 'Bar', fov: 62, pos: (t, k) => [cx + Math.sin(t * 0.06) * 0.5, Math.min(2.3, H - 1.2), cz], look: [lx, 1.6, lz] });
    },
    // a row of portable toilets, with a queue
    toiletRow(f) {
      const len = f.to - f.from, p = place(f.wall, (f.from + f.to) / 2);
      for (let x = -len / 2 + 0.6; x < len / 2; x += 1.25) { p.box(1.15, 2.3, 1.15, x, 1.15, 0.9, cabin); p.box(0.8, 1.9, 0.04, x, 1.0, 1.5, grey); p.box(1.25, 0.12, 1.25, x, 2.36, 0.9, grey); }
      p.plate(3, 0.6, 0, 3.4, 1.5, SIGN.toilets); p.box(0.1, 3.8, 0.1, 0, 1.9, 1.45, steel); p.light(0, 3.2, 2.2, 0xdfe8ff, 10, 14);
      for (let i = 0; i < 6; i++) p.person(-len / 4 + i * 0.25 * (i % 2 ? 1 : -1), 2.4 + i * 0.7, Math.PI, 'guest');
      p.poi(len / 4, 3); p.poi(-len / 3, 6.8);
      p.free(-len / 2 - 0.5, len / 2 + 0.5, 0, 7);
    },
    // food: a row of trucks and stalls with their hatches lit, bulbs strung along them, and people eating at tables
    stalls(f) {
      const len = f.to - f.from, p = place(f.wall, (f.from + f.to) / 2), COLOURS = [[1.6, 0.5, 0.2], [0.4, 1.2, 0.6], [1.4, 1.1, 0.3], [0.5, 0.7, 1.5]];
      for (let x = -len / 2 + 2.2, i = 0; x < len / 2 - 1.5; x += 4.6, i++) {
        p.box(4, 2.6, 2.2, x, 1.6, 1.3, i % 2 ? white : grey); p.box(4, 0.5, 2.2, x, 0.25, 1.3, black);
        p.plate(2.8, 1.0, x, 1.9, 2.42, glow(0.35, 0.25, 0.14)); p.box(3, 0.06, 0.6, x, 1.35, 2.7, alu);
        p.box(3.6, 0.5, 0.08, x, 3.15, 2.4, glow(...COLOURS[i % 4].map(v => v * 0.5)));
        p.person(x - 0.5, 1.6, 0, 'staff');
        for (let k = 0; k < 3; k++) if (Math.random() < 0.7) p.person(x - 1 + k, 3.4 + Math.random() * 0.3, Math.PI, 'guest');
        p.poi(x, 4.6);
      }
      for (let x = -len / 2; x <= len / 2; x += 0.8) p.box(0.1, 0.1, 0.1, x, 3.9 - 0.25 * Math.abs(Math.sin(x * 0.7)), 3.4, glow(1.9, 1.2, 0.5));   // a string of bulbs
      for (const x of [-len / 2, 0, len / 2]) p.box(0.1, 4, 0.1, x, 2, 3.4, steel);
      p.light(0, 3, 3, 0xffb060, 18, 18);
      p.free(-len / 2 - 0.5, len / 2 + 0.5, 0, 5.4);
    },
    // The roof of an open-air stage: a black skin over the trusses, closed at the back and the sides, so the stage
    // is a dark box the light comes out of. height: where the roof is
    stageRoof(f) {
      const p = place([0, st.back + st.depth / 2, 0]), w = st.width + 1.5, h = f.height;
      p.box(w, 0.25, st.depth + 1, 0, h + 0.5, 0, tent); p.box(w, h - st.height, 0.15, 0, st.height + (h - st.height) / 2, -st.depth / 2 - 0.3, tent);
      for (const side of [-1, 1]) { p.box(0.15, h - st.height, st.depth * 0.7, side * w / 2, st.height + (h - st.height) / 2, -st.depth * 0.15, tent); p.box(5, h * 0.75, 0.2, side * (w / 2 + 3), h * 0.375 + 1, st.depth / 2 - 0.5, tent); }   // sides, and the wings the PA hangs in front of
      p.box(w + 12, st.height, 2.5, 0, st.height / 2, st.depth / 2 + 1.2, black);   // the apron in front, where the cameras and the pyro are
    },
    // a tower in the field: speakers for the back of the crowd, and a platform of lights
    tower(f) {
      const p = place([f.x, f.z, 0]);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.box(0.14, f.height, 0.14, x, f.height / 2, z, steel);
      for (let y = 2; y < f.height; y += 2.5) { p.box(2.1, 0.08, 0.08, 0, y, -1, steel); p.box(2.1, 0.08, 0.08, 0, y, 1, steel); p.box(0.08, 0.08, 2.1, -1, y, 0, steel); p.box(0.08, 0.08, 2.1, 1, y, 0, steel); }
      p.box(2.6, 0.15, 2.6, 0, f.height, 0, black); p.box(2.4, 2.2, 0.1, 0, 1.3, 1.25, tent);
      for (let j = 0; j < 5; j++) p.box(1.1, 0.4, 0.7, 0, f.height - 1.2 - j * 0.42, -1.5, speaker).rotation.x = -0.05 - j * 0.07;
      p.free(-2.2, 2.2, -2.4, 2.2);
    },
    // a ledge along the wall to put a drink on, with people standing at it who would rather watch than dance
    ledge(f) {
      const len = f.to - f.from, p = place(f.wall, (f.from + f.to) / 2);
      p.box(len, 0.05, 0.32, 0, 1.12, 0.18, grey); for (let x = -len / 2 + 0.3; x < len / 2; x += 1.6) p.box(0.04, 0.3, 0.3, x, 0.97, 0.17, steel);
      p.box(len, 0.03, 0.03, 0, 1.08, 0.33, glow(0.25, 0.1, 0.4));
      for (let x = -len / 2 + 0.5; x < len / 2 - 0.3; x += 0.85) if (Math.random() < 0.6) p.person(x, 0.72 + Math.random() * 0.15, (Math.random() - 0.5) * 1.2, 'guest');
      p.free(-len / 2 - 0.3, len / 2 + 0.3, 0, 1.3);
    },
    // speakers stacked on the floor, as in a club: at: [[x, z], ...]; each stack is turned to the middle of the floor
    stacks(f) {
      for (const [x, z] of f.at) { const p = place([x, z, Math.atan2(-x, (L.floor.z0 + L.floor.z1) / 2 - z)]); p.box(0.75, 0.7, 0.8, 0, 0.35, 0, speaker); p.box(0.75, 0.7, 0.8, 0, 1.06, 0, speaker); p.box(0.6, 0.55, 0.55, 0, 1.7, 0, speaker); p.free(-0.6, 0.6, -0.6, 0.6); }
    },
    cloakroom(f) {
      const len = f.to - f.from, p = place(f.wall, (f.from + f.to) / 2);
      p.box(len, 1.08, 0.6, 0, 0.54, 2.3, grey); p.box(len + 0.1, 0.05, 0.7, 0, 1.1, 2.3, alu);
      const coats = [];
      for (let row = 0; row < 2; row++) { p.box(len - 0.6, 0.04, 0.04, 0, 1.85, 0.5 + row * 0.8, alu); for (let x = -len / 2 + 0.5; x < len / 2 - 0.5; x += 0.13) coats.push(new THREE.BoxGeometry(0.09, 0.85 + Math.random() * 0.25, 0.46).translate(x, 1.35, 0.5 + row * 0.8)); }
      p.box(1, 1, 1, 0, 0, 0, grey).geometry = mergeGeometries(coats);   // the coats, as one mesh
      p.plate(4.4, 0.72, 0, 3.0, 0.15, SIGN.cloak);
      p.light(0, 2.6, 1.8, 0xbfd4ff, 9, 12);
      for (const x of [-len / 4, len / 4]) p.person(x, 1.6, 0, 'staff');
      for (let i = 0; i < 4; i++) p.person(-len / 4 + (Math.random() - 0.5) * 0.3, 3.1 + i * 0.65, Math.PI, 'guest');   // the queue
      p.poi(-len / 4, 5.7); p.poi(len / 4, 3.2);
      p.free(-len / 2 - 0.8, len / 2 + 0.8, 0, 5.9);
    },
    // a first aid post: a white cabin with a green cross, a stretcher and two medics
    firstAid(f) {
      const p = place(f.wall, f.at);
      for (const s of [-1, 1]) p.box(0.08, 2.5, 3, s * 1.7, 1.25, 1.6, white);
      p.box(3.5, 0.08, 3.1, 0, 2.54, 1.6, white); p.box(1.9, 0.5, 0.7, -0.5, 0.45, 1.2, white);
      p.plate(2.6, 0.43, 0, 2.95, 3.15, SIGN.aid); p.box(0.5, 0.5, 0.06, 1.3, 1.9, 3.14, glow(0.2, 1.4, 0.5));
      p.light(0, 2.2, 1.6, 0xe8f4ff, 9, 9);
      p.person(0.7, 1.4, 0, 'medic'); p.person(-1.1, 2.4, 0.5, 'medic');
      p.free(-2.6, 2.6, 0, 4.6);
    },
    // free drinking water, as a Dutch event has to offer
    water(f) {
      const p = place(f.wall, f.at);
      p.box(2.2, 1.0, 0.5, 0, 0.5, 0.3, alu);
      for (let i = 0; i < 4; i++) p.box(0.04, 0.3, 0.04, -0.75 + i * 0.5, 1.15, 0.35, steel);
      p.plate(1.7, 0.43, 0, 2.3, 0.08, SIGN.water); p.light(0, 2, 0.8, 0x7ab0ff, 5, 7);
      for (let i = 0; i < 3; i++) if (Math.random() < 0.7) p.person(-0.7 + i * 0.7, 1.15, Math.PI, 'guest');
      p.poi(1.3, 1.6);
      p.free(-1.8, 1.8, 0, 2.6);
    },
    toilets(f) {
      const p = place(f.wall, f.at);
      p.box(2.2, 2.5, 0.08, 0, 1.25, 0.05, glow(0.03, 0.03, 0.035)); p.box(2.5, 0.14, 0.14, 0, 2.56, 0.07, steel);
      p.plate(2.0, 0.4, 0, 2.95, 0.1, SIGN.toilets); p.light(0, 2.2, 0.8, 0xffffff, 4, 7);
      p.poi(0, 0.9); p.poi(0.6, 1.4);
      p.free(-1.8, 1.8, 0, 3);
    },
    // front of house: where sound, light and video are run from. A riser in the crowd on the centre line, desks and
    // screens, operators looking at the stage, a barrier round it, and the cable run to the stage along the floor.
    foh(f) {
      const p = place([0, f.z, 0]), w = 7, d = 4.6, top = 0.45, desk = top + 0.9;   // the riser; desks at a standing height
      p.box(w, top, d, 0, top / 2, 0);
      const metal = p.parts(grey), dark = p.parts(black), caps = p.parts(glow(0.16, 0.16, 0.18)), leds = p.parts(glow(0.06, 0.45, 0.15)), amber = p.parts(glow(0.5, 0.27, 0.06)), blue = p.parts(glow(0.08, 0.2, 0.5));
      const screen = (w2, h2, x, y, z, tilt, r = 0.012, g2 = 0.026, b = 0.05) => { p.plate(w2, h2, x, y, z, glow(r, g2, b)).rotation.x = -tilt; dark.box(w2 + 0.04, h2 + 0.04, 0.03, x, y, z - 0.02, -tilt); };
      // the long table the desks stand on, from one end of the riser to the other, on black legs
      dark.box(6.6, 0.05, 1.05, 0, desk - 0.025, -1.3);
      for (const x of [-3.2, -1.1, 1.1, 3.2]) for (const z of [-1.75, -0.85]) metal.box(0.05, desk - top, 0.05, x, (desk + top) / 2, z);
      // sound: a wide digital desk, sloping towards the engineer, with two rows of faders, rows of knobs and three screens
      const sx = -1.95, sw = 2.3;
      dark.box(sw, 0.16, 0.85, sx, desk + 0.08, -1.3, 0.12);
      for (let i = 0; i < 24; i++) for (const [z, y] of [[-0.98, desk + 0.17], [-1.2, desk + 0.19]]) { const x = sx - sw / 2 + 0.1 + i * (sw - 0.2) / 23; caps.box(0.022, 0.02, 0.035, x, y, z); dark.box(0.008, 0.002, 0.12, x, y - 0.012, z); }
      for (let i = 0; i < 24; i++) for (let k = 0; k < 3; k++) caps.cyl(0.011, 0.025, sx - sw / 2 + 0.1 + i * (sw - 0.2) / 23, desk + 0.22 + k * 0.025, -1.38 - k * 0.07);
      for (const k of [-1, 0, 1]) screen(0.56, 0.34, sx + k * 0.66, desk + 0.48, -1.68, 0.35, 0.015, 0.03, 0.06);
      for (let i = 0; i < 24; i++) (i % 5 === 3 ? amber : leds).box(0.012, 0.03, 0.006, sx - sw / 2 + 0.1 + i * (sw - 0.2) / 23, desk + 0.26, -1.6);   // meters above every channel
      // light: a lighting desk with two built-in screens, two more on a bar above it, and a wing beside it
      const lx = 0.55;
      dark.box(1.55, 0.13, 0.75, lx, desk + 0.065, -1.3, 0.1);
      for (const k of [-1, 1]) screen(0.5, 0.3, lx + k * 0.38, desk + 0.36, -1.6, 0.55, 0.02, 0.02, 0.035);
      metal.box(0.04, 0.42, 0.04, lx, desk + 0.21, -1.86); metal.box(1.3, 0.04, 0.04, lx, desk + 0.42, -1.86);
      for (const k of [-1, 1]) screen(0.6, 0.36, lx + k * 0.33, desk + 0.62, -1.86, 0.12, 0.022, 0.016, 0.04);
      for (let i = 0; i < 10; i++) caps.box(0.03, 0.02, 0.04, lx - 0.6 + i * 0.075, desk + 0.15, -1.0);   // the executor faders
      for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) (k === 0 && i % 2 ? blue : caps).box(0.04, 0.012, 0.04, lx + 0.15 + i * 0.07, desk + 0.16, -1.08 - k * 0.07);   // the keypad
      dark.box(0.5, 0.1, 0.55, lx + 1.05, desk + 0.05, -1.25, 0.1); screen(0.42, 0.26, lx + 1.05, desk + 0.28, -1.48, 0.55, 0.02, 0.02, 0.035);
      // video: a laptop, a monitor and a small controller
      const vx = 2.75;
      dark.box(0.36, 0.015, 0.25, vx - 0.25, desk + 0.008, -1.15); screen(0.34, 0.22, vx - 0.25, desk + 0.12, -1.28, 0.25, 0.04, 0.03, 0.06);
      metal.box(0.03, 0.3, 0.03, vx + 0.25, desk + 0.15, -1.6); screen(0.56, 0.33, vx + 0.25, desk + 0.46, -1.6, 0.05, 0.035, 0.02, 0.045);
      dark.box(0.32, 0.04, 0.2, vx + 0.25, desk + 0.02, -1.05); for (let i = 0; i < 8; i++) (i % 3 ? caps : amber).box(0.025, 0.015, 0.025, vx + 0.13 + (i % 4) * 0.08, desk + 0.05, -1.1 + Math.floor(i / 4) * 0.08);
      // small lamps on goosenecks, warm, low over each desk: all the light FOH allows itself
      for (const x of [sx - 0.9, sx + 0.9, lx - 0.4, vx]) { metal.cyl(0.006, 0.32, x, desk + 0.26, -1.72, -0.5); amber.box(0.05, 0.015, 0.03, x, desk + 0.4, -1.6); }
      // behind the operators: two racks in flight cases, their front panels full of status lights, and a case to sit on
      for (const x of [-2.6, -1.9]) {
        dark.box(0.6, 1.25, 0.62, x, top + 0.625, 1.75); metal.box(0.62, 0.04, 0.64, x, top + 1.27, 1.75);
        for (let k = 0; k < 8; k++) for (let i = 0; i < 5; i++) ((i + k + Math.round(x)) % 4 ? leds : (k % 3 ? amber : blue)).box(0.012, 0.012, 0.004, x - 0.2 + i * 0.03, top + 0.2 + k * 0.13, 1.437);
      }
      dark.box(1.2, 0.55, 0.6, 2.2, top + 0.275, 1.75); metal.box(1.22, 0.03, 0.62, 2.2, top + 0.56, 1.75);
      // the measurement microphone on a tall stand at the front edge, pointing at the stage
      metal.cyl(0.012, 1.65, 0, top + 0.83, -d / 2 + 0.25); for (const a of [0, 2.1, 4.2]) metal.box(0.02, 0.02, 0.4, Math.sin(a) * 0.15, top + 0.02, -d / 2 + 0.25 + Math.cos(a) * 0.15);
      dark.cyl(0.011, 0.22, 0, top + 1.66, -d / 2 + 0.15, Math.PI / 2);
      for (const part of [metal, dark, caps, leds, amber, blue]) part.done();
      for (const x of [sx - 0.3, lx, vx]) p.person(x, -0.4, Math.PI, 'crew');
      p.person(1.8, 1.0, Math.PI * 0.75, 'crew');   // someone standing back, watching the stage over their shoulders
      for (const [bw, bd, x, z] of [[w + 0.8, 0.06, 0, d / 2 + 0.4], [w + 0.8, 0.06, 0, -d / 2 - 0.4], [0.06, d + 0.8, -w / 2 - 0.4, 0], [0.06, d + 0.8, w / 2 + 0.4, 0]]) { p.box(bw, 0.06, bd, x, 1.12, z, alu); p.box(bw, 0.9, bd, x, 0.5, z, alu).material = fence; p.solid(x - bw / 2, z - bd / 2, x + bw / 2, z + bd / 2); }
      // the cables to the stage under a black rubber cable bridge, module after module, to the barrier and on
      // through the pit; people stand on it as on the floor
      const run = (from, to) => { const n = Math.max(1, Math.round((from - to) / 0.9)), len = (from - to) / n; for (let i = 0; i < n; i++) { const c = from - (i + 0.5) * len; bridges.push(cableBridge(len - 0.02).translate(0, 0, c)); for (const x of [-0.065, 0.065]) seams.push(new THREE.BoxGeometry(0.008, 0.003, len - 0.06).translate(x, 0.072, c)); } };
      const bridges = [], seams = [];
      run(-d / 2 - 0.5, pitZ + 0.45 - f.z); run(pitZ - 0.6 - f.z, st.front + 0.05 - f.z);
      p.group.add(new THREE.Mesh(mergeGeometries(bridges), rubber), new THREE.Mesh(mergeGeometries(seams), rubberSeam));
      if (open) { for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.box(0.12, 4.4, 0.12, x * (w / 2 + 0.2), 2.2, z * (d / 2 + 0.2), steel); p.box(w + 1, 0.12, d + 1, 0, 4.45, 0, tent); }   // out of the rain
      p.free(-w / 2 - 0.9, w / 2 + 0.9, -d / 2 - 0.9, d / 2 + 0.9);
      shots.push({ name: 'Front of house desk', fov: 58, pos: t => [Math.sin(t * 0.05) * 1.2, 2.75, f.z + 1.6], look: [0, H * 0.4, -D / 2] });
    },
    // a raised platform with a ramp, so wheelchair users see over the crowd
    platform(f) {
      const p = place([f.x, f.z, 0]);
      p.box(4.4, 0.7, 3, 0, 0.35, 0); p.box(1.4, 0.06, 5, 2.9, 0.33, 1.2).rotation.x = -0.13;   // the ramp
      for (const [bw, bd, x, z] of [[4.4, 0.05, 0, -1.5], [0.05, 3, -2.2, 0], [4.4, 0.05, 0, 1.5]]) { p.box(bw, 0.05, bd, x, 1.75, z, alu); p.box(bw, 1.0, bd, x, 1.2, z, alu).material = fence; }
      p.plate(1.5, 0.38, 0, 1.3, 1.53, SIGN.access);
      for (const x of [-1.4, -0.2, 1.1]) p.person(x, -0.4, Math.PI, 'guest');
      p.free(-2.8, 3.9, -2.1, 4.2);
    },
    // the barrier in front of the stage, with the pit behind it: security facing the crowd, the subwoofers in a row
    // on the floor (one line across the front is how the low end is spread evenly), and small speakers on the edge
    // of the stage for the front rows, who stand under the main arrays
    barrier(f) {
      const z = st.front + (f.pit || 2.6), p = place([0, z, 0]), across = laneWidth ? W - 2 * laneWidth : W - 1, n = Math.floor(across / 2.4);
      const panel = p.parts(barrierPaint), rail = p.parts(barrierRail);
      for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 2.4; panel.box(2.34, 1.15, 0.06, x, 0.6, 0); rail.box(2.34, 0.05, 0.12, x, 1.18, 0); panel.box(2.34, 0.05, 1.1, x, 0.03, -0.5); panel.box(2.34, 0.05, 0.3, x, 0.35, 0.2); }
      panel.done(); rail.done();
      p.solid(-n * 1.2, 0, n * 1.2, 0);
      for (const k of [-0.4, 0.4]) p.person(k * n * 1.2, -0.9, 0, 'security');   // two in the pit; with the two at the lanes' gates, four in all
      const subs = f.subs || 0, span = Math.min(st.width, W - 4);
      for (let i = 0; i < subs; i++) {
        const x = (i - (subs - 1) / 2) * span / subs, front = st.front + 0.6 - z + 0.48;
        p.box(1.28, 0.64, 0.95, x, 0.32, st.front + 0.6 - z, speaker);
        p.plate(1.12, 0.5, x, 0.32, front, speakerGrille);
      }
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * st.width / 5, front = st.front - 0.25 - z + 0.176;
        p.box(0.5, 0.3, 0.35, x, st.height + 0.15, st.front - 0.25 - z, speaker);
        p.plate(0.42, 0.22, x, st.height + 0.15, front, speakerGrille);
      }
      p.free(-W / 2, W / 2, st.front - z - 1, 0.45);
    },
    // beside the stage: drapes that close off the wings, with flight cases, dimmer racks and crew behind them
    wings() {
      const wide = (W - st.width) / 2;
      if (wide < 2) return;
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const h = st.height * (6 - k) / 6.5; place([s * (st.width / 2 + 0.16 + k * 0.3), st.front - 2.2, 0]).box(0.3, h, 1.5, 0, h / 2, 0, grey); }   // steps up to the stage from the wings
      for (const s of [-1, 1]) {
        const p = place([s * (st.width / 2 + wide / 2), st.front, 0]), cloth = wide - laneWidth;   // the lane by the wall stays open: the way backstage
        // pipe and drape: black molton hanging in folds from a crossbar on uprights, as stages are masked
        const folds = new THREE.PlaneGeometry(cloth, 4.55, Math.round(cloth / 0.06), 1), at = folds.attributes.position;
        for (let i = 0; i < at.count; i++) at.setZ(i, Math.sin(at.getX(i) / 0.34 * Math.PI) * 0.07 + Math.sin(at.getX(i) * 1.7) * 0.025);
        folds.computeVertexNormals();
        const curtain = new THREE.Mesh(folds, drape); curtain.position.set(-s * laneWidth / 2, 2.32, 0); p.group.add(curtain);
        p.box(cloth + 0.2, 0.05, 0.05, -s * laneWidth / 2, 4.62, 0, steel);
        for (let k = 0, n = Math.ceil(cloth / 3); k <= n; k++) { const x = -s * laneWidth / 2 - cloth / 2 + cloth * k / n; p.box(0.05, 4.62, 0.05, x, 2.31, -0.1, steel); p.box(0.6, 0.02, 0.6, x, 0.01, -0.1, steel); }
        p.plate(1.6, 0.27, -s * (wide / 2 - 1.3), 2.3, 0.12, SIGN.crew);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 1 + (i % 3); j++) p.box(1.2, 0.62, 0.62, -wide / 2 + 0.9 + i * 1.35, 0.31 + j * 0.64, -1.4 - (i % 2) * 0.9, grey);   // flight cases
        for (let i = 0; i < 3; i++) { p.box(0.6, 1.9, 0.8, wide / 2 - 0.6 - i * 0.7, 0.95, -4.2, black); p.box(0.4, 0.02, 0.02, wide / 2 - 0.6 - i * 0.7, 1.5, -3.79, glow(0.2, 1.2, 0.3)); }   // dimmer racks
        p.person(0.5, -2.6, 0.6, 'crew'); p.person(-1.2, -3.4, Math.PI, 'crew');
      }
    },
    // the back of the room, where people stand talking instead of dancing: standing tables and groups in a circle.
    // region: { x0, x1, z0, z1 }
    social(f) {
      const r = f.region;
      for (let i = 0, tries = 0; i < (f.tables || 0) + (f.groups || 0) && tries < 400; tries++) {
        const x = r.x0 + Math.random() * (r.x1 - r.x0), z = r.z0 + Math.random() * (r.z1 - r.z0);
        if (keepOut.some(k => x > k.x0 - 1.3 && x < k.x1 + 1.3 && z > k.z0 - 1.3 && z < k.z1 + 1.3)) continue;
        const p = place([x, z, Math.random() * 6.28]), table = i < (f.tables || 0), n = 3 + (Math.random() * 3 | 0);
        if (table) { p.box(0.08, 1.08, 0.08, 0, 0.54, 0, steel); p.box(0.75, 0.04, 0.75, 0, 1.1, 0, grey); p.box(0.5, 0.03, 0.5, 0, 0.02, 0, steel); }
        for (let k = 0; k < n; k++) { const a = k / n * 6.28 + Math.random() * 0.4, d = table ? 0.85 : 0.62; p.person(Math.sin(a) * d, Math.cos(a) * d, a + Math.PI, 'guest'); }
        p.free(-1.15, 1.15, -1.15, 1.15); i++;
      }
    },
    // speakers hung further down the hall, so the back hears the top end as clearly as the front: a line array on
    // either side, on chain hoists like the main hangs
    delays(f) {
      const parts = { body: [], grille: [], rig: [] };
      for (const z of f.z) for (const s of [-1, 1]) { const g = lineArray({ top: [s * f.x, H * 0.7, z], n: 8, w: 0.74, h: 0.25, d: 0.48, roof: open ? null : H, splay: i => [0, 1, 1, 2, 2, 3, 4, 5][i] }); for (const k in parts) parts[k].push(...g[k]); }
      for (const [k, mat] of [['body', speaker], ['grille', speakerGrille], ['rig', steel]]) add(new THREE.Mesh(mergeGeometries(parts[k]), mat));
    },
    // A lane along each side wall, from the pit in front of the stage to a door in the side wall, behind a barrier like
    // the one in front of the stage: for security, first aid and crew, and the way out for whoever is lifted over the
    // front barrier. The crowd stands up against it. Where an emergency exit is, a gate stands open, with security.
    //   width: from the wall; to: where along the wall it ends (just past its door); gates: [z, ...] of the exits in it
    corridor(f) {
      const z0 = pitZ, z1 = f.to, w = f.width, gates = f.gates || [], m = place([0, 0, 0]), metal = m.parts(barrierPaint), rail = m.parts(barrierRail);
      for (const s of [-1, 1]) {
        const x = s * (W / 2 - w);
        // panels of 2.4 m, leaving a gate of 3 m open at every exit
        for (let a = z0 + 1.2; a < z1 - 0.6; a += 2.4) {
          if (gates.some(g => Math.abs(g - a) < 2.7)) continue;
          metal.box(0.06, 1.15, 2.34, x, 0.6, a); rail.box(0.12, 0.05, 2.34, x, 1.18, a);
          metal.box(0.9, 0.05, 2.34, x + s * 0.48, 0.03, a); metal.box(0.6, 0.05, 0.05, x + s * 0.24, 0.55, a - 0.9, 0, 0, -s * 0.9);   // its foot on the lane side, and a brace
          m.solid(x, a - 1.2, x, a + 1.2);
        }
        for (const g of gates) { metal.box(0.08, 1.2, 0.08, x, 0.6, g - 1.5); metal.box(0.08, 1.2, 0.08, x, 0.6, g + 1.5); }
        // the end: a gate across the lane, shut, with someone minding it
        metal.box(w, 1.15, 0.06, s * (W / 2 - w / 2), 0.6, z1); m.solid(x, z1, s * W / 2, z1);
        m.person(s * (W / 2 - w / 2), z1 - 0.8, 0, 'security');
        m.person(s * (W / 2 - w * 0.6), z0 + 3, Math.PI, 'medic');   // first aid near the front, where it is needed
        m.free(Math.min(x - s * 0.45, s * W / 2), Math.max(x - s * 0.45, s * W / 2), z0 - 0.5, z1 + 0.6);
      }
      metal.done(); rail.done();
    },
  };
  const fence = lit(new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.5, metalness: 0.7, transparent: true, opacity: 0.35 }), 1.3);
  const tent = lit(new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95, side: THREE.DoubleSide }), 1.2);
  const timber = lit(new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 }), 1.3), cab = lit(new THREE.MeshStandardMaterial({ color: 0x1d2a42, roughness: 0.4, metalness: 0.5 }), 1.4);
  const windows = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.03, 0.045), fog: false });
  const cabin = lit(new THREE.MeshStandardMaterial({ color: 0x1c3a5c, roughness: 0.7 }), 1.4);
  const drape = lit(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.82, side: THREE.DoubleSide }), 1.2);
  const rubber = lit(new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.92 }), 1.3), rubberSeam = lit(new THREE.MeshStandardMaterial({ color: 0x26272b, roughness: 0.8 }), 1.3);
  // a module of cable bridge: a flat top over the cable channels and a ramp either side, len metres long
  const cableBridge = len => new THREE.ExtrudeGeometry(new THREE.Shape([[-0.27, 0], [-0.16, 0.07], [0.16, 0.07], [0.27, 0]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
  const speaker = lit(new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.6, metalness: 0.2 }), 2);
  const speakerGrille = new THREE.MeshBasicMaterial({ color: 0x17191e, fog: false });
  const speakerCone = new THREE.MeshBasicMaterial({ color: 0x0b0c0f, fog: false });

  if (open && L.fence) {   // a fence round the field, open where the gates are
    const gates = L.facilities.filter(f => f.type === 'exit' || f.type === 'entrance');
    for (const [wall, len] of [['left', D], ['right', D], ['back', W]]) for (let a = -len / 2 + 1.75; a < len / 2; a += 3.5) {
      if (gates.some(g => g.wall === wall && Math.abs(g.at - a) < (g.width || EXIT_WIDTH) / 2 + 1.9)) continue;
      const p = place(wall, a); p.box(3.4, 2, 0.04, 0, 1.05, 0, fence); p.box(0.06, 2.1, 0.06, -1.7, 1.05, 0, alu); p.box(0.5, 0.12, 0.25, -1.7, 0.06, 0, grey);
    }
  }
  for (const f of L.facilities) {
    if (!BUILD[f.type]) throw new Error(`the venue ${L.name} asks for a facility "${f.type}" that does not exist`);
    BUILD[f.type](f);
  }
  return { keepOut, people, shots, lamps, pois, solids, layers, update: dt => { for (const f of updates) f(dt); } };
}
