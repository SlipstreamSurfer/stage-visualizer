// The world: builds a venue from its description. The place itself (shell.js), the stage and who plays on it
// (stage.js), the trusses, the crowd and the fixtures from the library (fixtures.js), hung where the layout says.
// Nothing here knows which venue it is building. Materials are node materials (TSL), so the same world is drawn by
// WebGPU and WebGL.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Fn, Loop, uniform, uniformArray, materialColor, positionWorld, normalWorld, texture, vec2, vec3, abs, mix, smoothstep, dot, length, normalize, select } from 'three/tsl';
import { layout, byRole } from './layout.js';
import { moveRig } from './rig-motion.js';
import { FIXTURES, buildPools } from './fixtures.js';
import { buildShell } from './shell.js';
import { buildStage } from './stage.js';
import { buildFacilities } from './facilities.js';
import { buildWalkers } from './walkers.js';
import { buildSmoke } from './smoke.js';
import { surfaces } from './surfaces.js';
import { box, strut, truss, batcher } from './shapes.js';
import { people, peopleMaterial, peopleU, shadowMaterial, SHIRTS } from './people.js';

const WHITE = new THREE.Color(1, 1, 1), tone = new THREE.Color();
// What is part of a stage or a rig, and so is built even while bars, exits and the rest are parked.
const STRUCTURE = new Set(['stageRoof', 'tower', 'wings']);

// Light from the beams on what they hit. Every beam is a cone (where it starts, which way it points, how wide, what
// colour); a material that is lit this way tests each point of its surface against the brightest cones. n: how many.
function lighting(n) {
  const pos = uniformArray(Array.from({ length: n }, () => new THREE.Vector3(0, 1e4, 0))), dir = uniformArray(Array.from({ length: n }, () => new THREE.Vector4(0, -1, 0, 0.9))), col = uniformArray(Array.from({ length: n }, () => new THREE.Vector3()));
  const flashPos = uniform(new THREE.Vector3(0, -1e4, 0)), flashCol = uniform(new THREE.Vector3());
  const light = Fn(([p, nrm]) => {
    const sum = vec3(0).toVar();
    Loop(n, ({ i }) => {
      const d = p.sub(pos.element(i)), dist = length(d), way = d.div(dist), edge = dir.element(i).w;
      sum.addAssign(col.element(i).mul(smoothstep(edge, mix(edge, 1, 0.4), dot(way, dir.element(i).xyz))).mul(abs(dot(nrm, way)).mul(0.7).add(0.3)).div(dist.mul(dist).mul(0.006).add(1)));
    });
    const fd = p.sub(flashPos);   // fire and fireworks light everything around them
    return sum.add(flashCol.mul(abs(dot(nrm, normalize(fd))).mul(0.6).add(0.4)).div(dot(fd, fd).mul(0.02).add(1)));
  });
  // a material as three knows it, lit by the beams as well
  const lit = (mat, gain = 1) => {
    const m = new THREE.MeshStandardNodeMaterial();
    for (const key of ['roughness', 'metalness', 'map', 'bumpMap', 'bumpScale', 'side', 'flatShading', 'transparent', 'opacity', 'depthWrite']) if (mat[key] != null) m[key] = mat[key];
    m.color.copy(mat.color);
    m.userData.textures = [mat.map, mat.bumpMap].filter(Boolean);
    let albedo = materialColor;
    if (mat.userData.metres) {   // a tile laid on from outside, a metre a metre: across the two directions the surface faces least
      const n3 = abs(normalWorld), p = positionWorld;
      m.map = null;
      albedo = texture(mat.map, select(n3.y.greaterThan(n3.x).and(n3.y.greaterThan(n3.z)), p.xz, select(n3.x.greaterThan(n3.z), vec2(p.z, p.y), p.xy)).div(mat.userData.metres)).rgb.mul(materialColor);
      m.colorNode = albedo;
    }
    m.emissiveNode = light(positionWorld, normalWorld).mul(albedo.add(0.03)).mul(gain);
    return m;
  };
  return { n, pos, dir, col, flashPos, flashCol, light, lit };
}

// quality: { crowd (share of the crowd, 0 to 1), beams (how many beams light the room), details (bars, exits,
// people who walk: everything a venue lists besides its stage and lights) }
export function buildWorld(venue, scene, quality = { crowd: 1, beams: 28 }) {
  const L = layout(venue), { W, D, H } = L.plan, st = L.stage, sh = L.shell, open = !!sh.open, F = L.floor;
  const add = o => (scene.add(o), o), put = batcher(add);
  const lights = lighting(quality.beams), { lit } = lights, { surface, plain } = surfaces(lit);
  const black = plain(0x0d0d0f, { roughness: 0.8, gain: 2.5 }), steel = plain(0x2c2c30, { roughness: 0.6, metalness: 0.4 });
  const casts = Array.from({ length: 200 }, () => ({ I: 0, pos: new THREE.Vector3(), dir: new THREE.Vector4(), col: new THREE.Vector3() }));
  let nCast = 0, flashI = 0;
  const env = { scene, W, D, H, haze: 1, hazeOut: 1, roomColor: [1, 1, 1], wallColor: new THREE.Color(), uPointScale: uniform(500), uTime: uniform(0), cam: new THREE.Vector3(), put, plain, surface, black, steel,
    media: null,   // a picture or video for the LED walls, or null
    // a beam reports where it shines, so the room can be lit by it
    cast(at, dx, dy, dz, color, I, half) { if (nCast >= casts.length || I < 0.02) return; const k = casts[nCast++]; k.I = I; k.pos.copy(at); k.dir.set(dx, dy, dz, Math.cos(Math.min(1.2, half * 1.5 + 0.03))); k.col.set(color.r * I, color.g * I, color.b * I); },
    // fire reports a flash of light; the strongest one in a frame counts
    flash(pos, r, g, b, I) { if (I <= flashI) return; flashI = I; lights.flashPos.value.set(...pos); lights.flashCol.value.set(r * I, g * I, b * I); },
  };
  const U = peopleU(), ctx = { add, put, lit, surface, plain, black, steel, env, light: lights.light, U, quality };

  // ----- the place, and the stage in it -----
  const shell = buildShell(L, ctx), stage = buildStage(L, ctx);
  env.H = open && !sh.roof ? 95 : H + shell.rise; env.profile = shell.profile; env.ceil = shell.ceil; env.round = L.plan.shape === 'round';
  const keepOut = [...shell.keepOut];

  // ----- trusses, with a chain up to the roof every few metres -----
  // What holds a truss up and feeds it: a steel beam under the roof to hang from, a chain hoist at every pick-up
  // point, and the cable loom, which runs along the truss, up to the roof, across to the wall and down to the dimmers.
  const rigging = [], hoists = [], looms = [], members = [];
  const flatRoof = !open && L.plan.shape === 'box' && !shell.rise && !sh.rough;   // only a flat roof has beams to hang from and walls to run a loom down
  const run = (points, r = 0.05) => looms.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(q => new THREE.Vector3(...q))), points.length * 6, r, 5));
  function rigOf(a, b, moves) {
    if (!flatRoof) return;
    const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]), far = a[0] + b[0] >= 0 ? (a[0] > b[0] ? a : b) : (a[0] < b[0] ? a : b), side = Math.sign(far[0] || 1), wallX = side * (W / 2 - 0.55);
    strut([a[0], H - 0.62, a[2]], [b[0], H - 0.62, b[2]], 0.22, rigging);
    if (!moves) { strut([a[0], a[1] + 0.27, a[2]], [b[0], b[1] + 0.27, b[2]], 0.09, looms); if (alongX) run([[far[0], far[1] + 0.3, far[2]], [far[0] + side * 1.2, far[1] - 0.5, far[2]], [(far[0] + wallX) / 2, far[1] - 0.2, far[2]], [wallX, far[1] + 1.2, far[2]]]); }
    else run([[far[0], H - 0.75, far[2]], [(far[0] + wallX) / 2, H - 0.95, far[2]], [wallX, H - 0.75, far[2]]]);
    if (alongX || moves) strut([wallX, 0, far[2]], [wallX, moves ? H - 0.75 : far[1] + 1.2, far[2]], 0.09, looms);   // down the wall to the dimmers
  }
  const hangs = !open || !!sh.roof;   // in the open air there is no roof to hang from: a stage carries its own trusses
  for (const line of L.fixedTrusses) {
    truss(line, members);
    const [a, b] = line;
    if (Math.abs(b[1] - a[1]) > 1) { rigging.push(box(1.1, 0.06, 1.1, a[0], a[1] + 0.03, a[2])); continue; }   // a tower stands by itself, on a base plate
    rigOf(a, b, false);
    if (!hangs) continue;
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 8));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n, z = a[2] + (b[2] - a[2]) * i / n, top = shell.ceil(x, z);
      if (top - y < 0.5) continue;
      hoists.push(box(0.2, 0.36, 0.2, x, y + 0.42, z)); strut([x, y + 0.2, z], [x, top - 0.05, z], 0.025, members);
    }
  }
  const trussMat = plain(0x8a8d94, { roughness: 0.4, metalness: 0.8, gain: 1.2 }), hoistMat = plain(0xb89a10, { roughness: 0.6, metalness: 0.3, gain: 1.4 });
  put(trussMat, members);

  // ----- what a venue lists besides its stage and lights: parked unless asked for, but for what is structure -----
  const details = !!quality.details;
  const fac = buildFacilities({ ...L, fence: details, facilities: L.facilities.filter(f => details || STRUCTURE.has(f.type)) }, { add, lit, black, steel });
  // aisles: a venue with people walking keeps a lane free down both sides and across the back
  const lane = details && L.walkers && !L.walkPath ? { x: W / 2 - 6.6, z0: st.front + 5, z1: D / 2 - 7.2 } : null;
  // where people walk: the venue's own route, or the aisles; the crowd keeps a strip free along every stretch of it
  const route = details && L.walkers ? L.walkPath || (lane && [[-lane.x, lane.z0], [-lane.x, lane.z1], [lane.x, lane.z1], [lane.x, lane.z0]]) : null;
  const rect = (x0, x1, z0, z1) => (x, z) => x > x0 && x < x1 && z > z0 && z < z1;
  for (const r of fac.keepOut) keepOut.push(rect(r.x0, r.x1, r.z0, r.z1));
  if (route && L.walkPath) for (let i = 0; i + 1 < route.length; i++) { const [ax, az] = route[i], [bx, bz] = route[i + 1]; keepOut.push(rect(Math.min(ax, bx) - 1.1, Math.max(ax, bx) + 1.1, Math.min(az, bz) - 1.1, Math.max(az, bz) + 1.1)); }
  if (lane) {
    keepOut.push(rect(-lane.x - 1.2, -lane.x + 1.2, lane.z0 - 1, lane.z1 + 1.2), rect(lane.x - 1.2, lane.x + 1.2, lane.z0 - 1, lane.z1 + 1.2), rect(-lane.x - 1.2, lane.x + 1.2, lane.z1 - 1.2, lane.z1 + 1.2));
    // the aisles are marked on the floor, as walkways in a working hall are
    const lines = [], line = (x0, z0, x1, z1) => lines.push(new THREE.PlaneGeometry(Math.abs(x1 - x0) + 0.1, Math.abs(z1 - z0) + 0.1).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2));
    for (const sx of [-1, 1]) for (const e of [-1.15, 1.15]) line(sx * lane.x + e, lane.z0, sx * lane.x + e, lane.z1 + (e * sx > 0 ? 1.15 : -1.15));
    line(-lane.x + 1.15, lane.z1 - 1.15, lane.x - 1.15, lane.z1 - 1.15); line(-lane.x - 1.15, lane.z1 + 1.15, lane.x + 1.15, lane.z1 + 1.15);
    put(plain(0x6f6210, { roughness: 0.7, gain: 1.4 }), lines);
  }
  const taken = (x, z) => keepOut.some(f => f(x, z));

  // ----- the crowd -----
  // Standing: shoulder to shoulder near the stage, thinning out away from it, turned towards whoever plays. Seated: in
  // rows across the floor. And on whatever seats the place has: tiers, balconies. A spot is
  // [x, z, facing, still, kind, height, seated].
  let spots = [];
  const centre = st.kind === 'centre', count = Math.round(L.crowd.count * quality.crowd), seats = [];
  const reach = centre ? Math.max(W, D) / 2 - st.width / 2 : F.z1 - F.z0, away = (x, z) => centre ? (Math.hypot(x, z - st.z) - st.width / 2) / reach : (z - F.z0) / reach;   // 0 at the stage, 1 as far from it as the floor goes
  const facing = (x, z) => centre ? Math.atan2(x, z - st.z) : Math.atan2(x, z - st.back - 2) * 0.7;
  if (L.crowd.seated) {
    const pitch = L.crowd.pitch || 0.95, aisle = L.crowd.aisle ?? 1.5;
    for (let z = F.z0; z <= F.z1; z += pitch) for (let x = F.x0 + 0.3; x <= F.x1 - 0.3; x += 0.58) if (Math.abs(x) > aisle / 2 && L.inside(x, z, 1) && !taken(x, z)) seats.push({ x, y: L.ground(x, z), z, yaw: facing(x, z) * 0.5 });
    const sat = seats.slice();
    for (let i = sat.length - 1; i > 0; i--) { const k = Math.random() * (i + 1) | 0; [sat[i], sat[k]] = [sat[k], sat[i]]; }
    for (const q of sat.slice(0, count)) spots.push([q.x, q.z, q.yaw + (Math.random() - 0.5) * 0.2, true, null, q.y, true]);
  } else {
    const STEP = 0.62;
    for (let gx = F.x0; gx <= F.x1; gx += STEP) for (let gz = F.z0; gz <= F.z1; gz += STEP) {
      const x = gx + (Math.random() - 0.5) * STEP * 0.7, z = gz + (Math.random() - 0.5) * STEP * 0.7;
      if (!L.inside(x, z, 1.2) || (centre && L.onStage(x, z, st.height > 0.3 ? 1.8 : 0.45)) || taken(x, z)) continue;   // a booth on the floor has people right up to it
      if (Math.random() < (L.crowd.even ? 0.6 : Math.max(0.1, Math.pow(1 - Math.min(1, away(x, z)), 1.7)) * 0.9)) spots.push([x, z]);
    }
    for (let i = spots.length - 1; i > 0; i--) { const k = Math.random() * (i + 1) | 0; [spots[i], spots[k]] = [spots[k], spots[i]]; }
    spots.length = Math.min(spots.length, count);
  }
  const dancers = L.crowd.seated ? 0 : spots.length;
  // the seats the place itself has: as many filled as the venue asks for
  const more = shell.seats.slice();
  for (let i = more.length - 1; i > 0; i--) { const k = Math.random() * (i + 1) | 0; [more[i], more[k]] = [more[k], more[i]]; }
  for (const q of more.slice(0, Math.round((L.crowd.seats ?? 1400) * quality.crowd))) spots.push([q.x, q.z, q.yaw + (Math.random() - 0.5) * 0.3, !q.stand, null, q.y, !q.stand]);
  for (const q of shell.seats) if (!q.stand) seats.push(q);
  for (const q of fac.people) spots.push([q.x, q.z, q.ry + Math.PI, true, q.kind]);   // the figure faces -z as built
  if (seats.length && L.crowd.chairs !== false) {   // a chair for every seat, taken or not
    const o = new THREE.Object3D(), g = mergeBoxes([box(0.5, 0.08, 0.46, 0, 0.42, 0.02), box(0.5, 0.5, 0.07, 0, 0.72, 0.25), box(0.5, 0.36, 0.05, 0, 0.2, 0.25)]);
    const chairs = add(new THREE.InstancedMesh(g, plain(L.crowd.chair ?? 0x4a0d14, { roughness: 0.9, gain: 1.8 }), seats.length)); chairs.frustumCulled = false;
    seats.forEach((q, i) => { o.position.set(q.x, q.y, q.z); o.rotation.set(0, q.yaw, 0); o.updateMatrix(); chairs.setMatrixAt(i, o.matrix); });
  }
  const n = spots.length, PHONES = Math.round(dancers / 30);
  U.stage.value.set(0, st.height + 5, centre ? st.z : st.back + 1);
  const o = new THREE.Object3D(), c = new THREE.Color();
  const crowd = people(peopleMaterial({ light: lights.light, U }), n); add(crowd.mesh);
  const phones = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.15), new THREE.MeshBasicMaterial({ color: 0, fog: false, side: THREE.DoubleSide }), Math.max(1, PHONES))); phones.frustumCulled = false; phones.count = PHONES;
  const blobs = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2), shadowMaterial(), Math.max(1, n))); blobs.renderOrder = -1; blobs.frustumCulled = false; blobs.count = n;
  const guards = spots.filter(q => q[4] === 'security');
  const vests = add(new THREE.InstancedMesh(new THREE.LatheGeometry([[0.165, 1.02], [0.182, 1.27], [0.214, 1.37], [0.184, 1.44], [0.085, 1.475]].map(q => new THREE.Vector2(q[0], q[1])), 10).scale(1, 1, 0.66), plain(0xc8b400, { roughness: 0.8, gain: 1.6 }), Math.max(1, guards.length)));
  vests.count = guards.length;
  const KIND = { staff: 0x0c0c0e, crew: 0x0c0c0e, security: 0x0c0c0e, medic: 0xb8c0b8 };
  let g = 0;
  for (let i = 0; i < n; i++) {
    const [x, z, turned, still, kind, y = 0, seated = false] = spots[i];
    const s = 0.9 + Math.random() * 0.25, build = 0.88 + Math.random() * 0.26;
    const yaw = turned ?? facing(x, z) + (Math.random() - 0.5) * 0.7;   // turned towards whoever plays, more or less
    crowd.put(i, x, z, yaw, s, build); crowd.sit(i, y, seated); crowd.shirt(i, c.setHex(KIND[kind] ?? SHIRTS[Math.random() * SHIRTS.length | 0]));
    o.rotation.set(0, yaw, 0);
    if (kind === 'security') { o.position.set(x, 0, z); o.scale.set(1.04 * s * build, s, 1.04 * s * build); o.updateMatrix(); vests.setMatrixAt(g++, o.matrix); }
    if (i < PHONES) {   // in the raised right hand, screen towards the back of the hall
      o.position.set(0.47 * s * build, 1.99 * s, -0.15 * s * build).applyAxisAngle(o.up, yaw); o.position.x += x; o.position.z += z;
      o.scale.set(1, 1, 1); o.updateMatrix(); phones.setMatrixAt(i, o.matrix);
    }
    o.position.set(x, y + 0.015, z); o.rotation.set(0, 0, 0); o.scale.set(s, 1, s); o.updateMatrix(); blobs.setMatrixAt(i, o.matrix);
    crowd.seed(i, Math.random(), still ? 0.99 : Math.random(), i < PHONES ? 0.15 : still ? 0.3 : 0.4 + Math.random() * 0.6, i < PHONES ? 0 : 1);   // filming, talking or sitting keeps you still
  }
  // how packed it is around each person: neighbours within arm's reach, 0 (alone) to 1 (shoulder to shoulder),
  // counted with a grid so a big crowd does not take long
  const cells = new Map(), cell = (x, z) => (Math.floor(x / 1.3) + 500) * 2000 + Math.floor(z / 1.3) + 500;
  spots.forEach((q, i) => { const k = cell(q[0], q[1]); (cells.get(k) || cells.set(k, []).get(k)).push(i); });
  for (let i = 0; i < n; i++) {
    let near = 0; const [x, z] = spots[i];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const k of cells.get(cell(x + dx * 1.3, z + dz * 1.3)) || []) { const ex = x - spots[k][0], ez = z - spots[k][1]; if (ex * ex + ez * ez < 1.69) near++; }
    crowd.dense(i, spots[i][6] ? 0.3 : Math.min(1, (near - 1) / 8));
  }

  const updateWalkers = route && buildWalkers({ add, light: lights.light, U, path: route, pois: fac.pois, count: Math.round(L.walkers * quality.crowd) });
  let hands = 0, filming = 0, cheer = 0;

  // ----- light that is not a fixture: what the place has of its own, and what the show throws on it -----
  const sky = shell.sky, daylight = sky ? sky.light[2] : 0.14;
  const house = add(new THREE.HemisphereLight(sky ? sky.light[0] : 0x39404f, sky ? sky.light[1] : 0x14100c, daylight));
  const hall = add(new THREE.PointLight(0xffffff, 0, 0, 1)); hall.position.set(0, H * 0.75, centre ? st.z : (F.z0 + F.z1) / 2 - (F.z1 - F.z0) * 0.15);
  const stageLight = add(new THREE.PointLight(0xffffff, 0, 0, 1)); stageLight.position.set(0, st.height + 4.5, centre ? st.z : st.back + 2.5);   // the LED wall, as the lamp it is for the stage and the front rows
  scene.fog = new THREE.FogExp2(0x000000, 0.015);

  // haze and smoke that move through the room (smoke.js), from the hazers; without a hazer, from the back of the stage
  const hazers = L.things.filter(th => th.role === 'hazer').map(th => th.pos);
  const smoke = buildSmoke({ add, room: { W, D, H: H + shell.rise * 0.5 }, wind: sh.wind, sources: hazers.length ? hazers : [[0, st.height, st.back + 1]], count: Math.round(150 * quality.crowd) });
  let smokeAt = -100;

  // ----- the fixtures -----
  const live = [], flush = buildPools(env, add, L.things.length + 1);
  // trusses on winches: each is a group that can be lowered and tilted, with its fixtures hanging on it
  const movers = L.movers.map(def => {
    if (!Array.isArray(def)) {
      const { pos: mid, props: p } = def, parts = [], motors = [], supports = [], group = add(new THREE.Group());
      const point = (angle, radius = p.radius) => [Math.sin(angle) * radius, 0, Math.cos(angle) * radius];
      for (let i = 0; i < p.sides; i++) {
        const a = i / p.sides * Math.PI * 2, b = (i + 1) / p.sides * Math.PI * 2;
        truss([point(a), point(b)], parts);
        if (i % 2 === 0) strut(point(a, p.radius + 0.22), point(a, p.radius + 0.5), 0.025, parts);
      }
      // A few shared pick-ups for the whole ring, plus a single bundled power feed.
      for (let i = 0; i < p.hoists; i++) {
        const [x, , z] = point(i / p.hoists * Math.PI * 2), top = shell.ceil(mid[0] + x, mid[2] + z) - 0.5;
        supports.push({ x, z, top, feed: false });
        motors.push(box(0.2, 0.3, 0.2, mid[0] + x, top + 0.15, mid[2] + z));
        if (i === 0) supports.push({ x: x + 0.12, z, top, feed: true });
      }
      const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5).translate(0, 0.5, 0), black, supports.length), o = new THREE.Object3D();
      chains.frustumCulled = false; group.position.set(...mid); group.add(new THREE.Mesh(mergeGeometries(parts), trussMat), chains);
      put(hoistMat, motors);
      const updateSupports = () => {
        supports.forEach(({ x, z, top, feed }, i) => {
          o.position.set(x, 0.23, z); o.scale.set(feed ? 1.6 : 1, Math.max(0.1, top - group.position.y - 0.23), feed ? 1.6 : 1); o.updateMatrix(); chains.setMatrixAt(i, o.matrix);
        });
        chains.instanceMatrix.needsUpdate = true;
      };
      updateSupports();
      return { group, mid, drop: 0, velocity: 0, updateSupports, holdTarget: null };
    }
    const [a, b] = def;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], parts = [], rel = p => [p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]];
    truss([rel(a), rel(b)], parts);
    const motors = [], cables = [];
    for (const k of [0.08, 0.36, 0.64, 0.92]) { const p = rel([a[0] + (b[0] - a[0]) * k, a[1], a[2] + (b[2] - a[2]) * k]); strut([p[0], 0.2, p[2]], [p[0], H, p[2]], 0.025, parts); motors.push(new THREE.BoxGeometry(0.2, 0.36, 0.2).translate(p[0], 0.42, p[2])); }   // chains, long enough for the lowest position, each with its hoist
    const ra = rel(a), rb = rel(b), end = Math.abs(a[0]) > Math.abs(b[0]) ? ra : rb;
    strut([ra[0], 0.27, ra[2]], [rb[0], 0.27, rb[2]], 0.09, cables); strut([end[0], 0.3, end[2]], [end[0], H, end[2]], 0.08, cables);   // the loom along the truss and up to the roof
    rigOf(a, b, true);
    const group = add(new THREE.Group()); group.position.set(...mid); group.add(new THREE.Mesh(mergeGeometries(parts), trussMat), new THREE.Mesh(mergeGeometries(motors), hoistMat), new THREE.Mesh(mergeGeometries(cables), black));
    return { group, mid, drop: 0, roll: 0, vel: 0, swing: 0, swingV: 0 };
  });
  put(steel, rigging); put(hoistMat, hoists); put(black, looms);
  for (const thing of L.things) {
    thing.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
    if (thing.type === 'truss') { const mv = movers[thing.mover]; live.push({ update(dt) {
      if (thing.props.kind === 'ring') {
        const p = thing.props;
        if (thing.ch.hold) mv.holdTarget ??= Math.max(0, Math.min(p.maxDrop, mv.drop + mv.velocity * Math.abs(mv.velocity) / (2 * p.acceleration)));
        else mv.holdTarget = null;
        moveRig(mv, mv.holdTarget ?? (thing.ch.drop || 0), dt, p);
        mv.group.position.y = mv.mid[1] - mv.drop; mv.updateSupports();
        thing.ch.actualDrop = mv.drop; thing.ch.velocity = mv.velocity;
        return;
      }
      // winches are slow, and quicker up than down
      const want = Math.max(0, Math.min(mv.mid[1] - 5.5, thing.ch.drop || 0)), step = dt * (want < mv.drop ? 1.6 : 0.5);
      const before = mv.drop;
      mv.drop += Math.max(-step, Math.min(step, want - mv.drop)); mv.roll += Math.max(-dt * 0.12, Math.min(dt * 0.12, (thing.ch.roll || 0) - mv.roll));
      // a few tonnes on chains: when the winches start or stop, the truss swings a little and takes a while to hang still
      const vel = dt > 0 ? (mv.drop - before) / dt : 0, d = Math.min(dt, 0.05);
      mv.swingV += ((mv.vel - vel) * 0.05 - mv.swing * 2.6 - mv.swingV * 0.5) * d * 4; mv.swing += mv.swingV * d; mv.vel = vel;
      mv.group.position.y = mv.mid[1] - mv.drop; mv.group.rotation.z = mv.roll; mv.group.rotation.x = mv.swing;
    } }); continue; }
    const make = FIXTURES[thing.type];
    if (!make) throw new Error(`the venue ${L.name} asks for a fixture "${thing.type}" that is not in the library`);
    const fx = make(env, thing);
    if (thing.mount !== undefined) { const mv = movers[thing.mount]; fx.object.position.set(thing.pos[0] - mv.mid[0], thing.pos[1] - mv.mid[1], thing.pos[2] - mv.mid[2]); mv.group.add(fx.object); }
    else { fx.object.position.set(...thing.pos); add(fx.object); }
    if (thing.props.rotY) fx.object.rotation.y = thing.props.rotY;
    if (thing.mount !== undefined) {
      const at = new THREE.Vector3(); thing.livePos = [...thing.pos];
      live.push({ update(dt, t) {
        fx.object.updateWorldMatrix(true, false); at.setFromMatrixPosition(fx.object.matrixWorld);
        thing.livePos[0] = at.x; thing.livePos[1] = at.y; thing.livePos[2] = at.z;
        fx.update(dt, t);
      } });
    } else live.push(fx);
  }
  put.done();
  const size = Math.max(W, D) / 55, fogOf = sky ? sky.fog : [0, 0, 0];   // light and haze are tuned on a hall of about this size

  return {
    layout: L, groups: byRole(L.things), env, shots: fac.shots, lights,
    // director: the Director after its update; signals: Signals; look: the viewer's sliders
    update(dt, t, director, signals, look) {
      updateWalkers?.(dt); shell.update(dt, t);
      env.haze = env.hazeOut; env.roomColor = director.room.color;
      nCast = 0; flashI = 0; lights.flashCol.value.set(0, 0, 0); env.uTime.value = t;
      for (const fx of live) fx.update(dt, t);
      flush();
      // the brightest beams light the room
      const top = casts.slice(0, nCast).sort((p, r) => r.I - p.I).slice(0, lights.n);
      for (let i = 0; i < lights.n; i++) { if (i < top.length) { lights.pos.array[i].copy(top[i].pos); lights.dir.array[i].copy(top[i].dir); lights.col.array[i].copy(top[i].col).multiplyScalar(2.2); } else lights.col.array[i].set(0, 0, 0); }
      if (director.smokeAt !== smokeAt) { smokeAt = director.smokeAt; smoke.burst([0, st.height + 0.5, st.front - 1]); }   // CO2 or a drop: a bank of smoke off the stage
      smoke.update(dt, t, director.room.color, (0.0004 + signals.energy * 0.0011 + signals.kick * 0.0008 + director.flash * 0.012) * look.light * (director.manual.blackout ? 0 : 1), env.haze);
      // the crowd: hands rise with the energy and the build-up, a cheer when the kick drops out, jumping and filming
      // when the room goes off
      const m = signals.m, brk = m.phase === 'break', calm = !brk && (m.section === 'intro' || m.section === 'low');
      if (signals.ev.broke && m.hasGrooved) cheer = 1;
      cheer *= Math.exp(-dt / 2.5);
      const want = brk ? Math.max(cheer * 0.6, 0.04 + m.build * 0.6) : 0.06 + signals.energy * 0.3 + signals.hype * 0.75;
      hands += (want * (calm ? 0.5 : 1) - hands) * Math.min(1, dt * 2.5);
      filming += ((brk && m.hasGrooved ? 0.9 : signals.hype * 0.8) - filming) * Math.min(1, dt * 1.5);
      U.time.value = t; U.dance.value = signals.phase; U.hands.value = hands; U.film.value = filming; U.hype.value = signals.hype * (brk ? 0 : 1);
      U.front.value.copy(env.wallColor).multiplyScalar(2.2).add(tone.setRGB(...director.room.color).multiplyScalar(director.room.level * 0.012)).multiplyScalar(look.light * (director.manual.blackout ? 0 : 1));
      U.rim.value.copy(stageLight.color).lerp(WHITE, 0.5).multiplyScalar((0.1 + signals.kick * 0.35 + signals.drop + director.blind) * look.light * (director.manual.blackout ? 0 : 1));
      phones.visible = filming > 0.05; phones.material.color.setRGB(0.6, 0.75, 1).multiplyScalar(filming * 1.5);
      const room = director.room, spill = look.hall < 1 ? look.hall : 1 + (look.hall - 1) * 1.5;
      hall.color.setRGB(...room.color); hall.intensity = (spill * room.level * 0.42 + 0.4 * Math.pow(look.hall, 3)) * size;
      stageLight.color.copy(env.wallColor).lerp(hall.color, 0.3); stageLight.intensity = (1.5 + env.wallColor.r + env.wallColor.g + env.wallColor.b) * 4 * spill * size * (director.manual.blackout ? 0 : 1);
      house.intensity = daylight * Math.pow(look.hall, 4);
      scene.fog.density = 0.015 * env.haze / size * (open ? 0.45 : 1);
      scene.fog.color.setRGB(...room.color).multiplyScalar((0.006 + signals.kick * 0.02 + director.flash * 0.08) * (1 + Math.max(0, look.haze - 1) * 5) * (director.manual.blackout ? 0 : 1));
      scene.fog.color.r += fogOf[0]; scene.fog.color.g += fogOf[1]; scene.fog.color.b += fogOf[2];   // and what distance fades to under this sky
      const amp = signals.m.activity < 0.15 ? 0.1 : signals.m.phase === 'break' ? 0.4 + signals.m.build * 0.4 : Math.min(1, 0.7 + signals.energy * 0.3 + signals.hype * 0.3);
      U.groove.value += (amp - U.groove.value) * (1 - Math.exp(-dt / 1.5));
      stage.update(t, dt, signals, director, look, !!director.mood.flow);
    },
  };
}

function mergeBoxes(list) {
  const g = new THREE.BufferGeometry(), pos = [], nrm = [];
  for (const b of list) { const n = b.toNonIndexed(); pos.push(...n.attributes.position.array); nrm.push(...n.attributes.normal.array); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  return g;
}
