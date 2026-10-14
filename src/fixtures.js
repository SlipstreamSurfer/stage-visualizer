// The fixture library. Every kind of fixture is described once here: what it looks like, and how it carries out its
// channels. A venue hangs them by name (type: 'movingHead'), the director sets their channels, and neither knows
// how they are drawn. To add a kind of fixture, add an entry to FIXTURES.
//
//   FIXTURES[type](env, thing) returns { object, update(dt, t) }
//     env     shared things: the room's size, the haze, and the pools below (see world.js)
//     thing   from the layout: pos, props, and ch, the channels the director writes
//
// A rig is hundreds of fixtures made of the same few parts, so the parts are not drawn one by one. Every kind of part
// (a yoke, a lens, a beam, a flare) is drawn once for the whole rig, and a fixture only says where its own are.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { strut, pieces } from './shapes.js';
import { reflectionHit } from './reflections.js';
import { blendTheme } from './show-themes.js';
import { attribute, uniform, uv, positionGeometry, positionWorld, positionViewDirection, normalView, cameraPosition, instanceIndex, instancedBufferAttribute, varying, texture, Fn, If, float, vec2, vec3, vec4, floor, fract, sin, cos, abs, pow, mix, step, smoothstep, dot, length, max, min, select, atan, exp, sqrt, hash, normalize, mx_noise_float } from 'three/tsl';

const DOWN = new THREE.Vector3(0, -1, 0), v = new THREE.Vector3(), q4 = new THREE.Quaternion(), m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), NONE = new THREE.Matrix4().makeScale(0, 0, 0);
const dark = () => new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.7, metalness: 0.3 });
const lamp = () => new THREE.MeshBasicMaterial({ fog: false });   // something that gives light: its colour is set per fixture
const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false };
const WHITE = new THREE.Color(1, 1, 1), TAU = Math.PI * 2;
// one LED batten of a row: instance i of a mesh of boxes a metre long, laid from a to b and filling that much of the way
const ALONG = new THREE.Vector3(1, 0, 0), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const batten = (mesh, i, a, b, fill) => { a3.set(...a); b3.set(...b); s3.set(a3.distanceTo(b3) * fill, 1, 1); mesh.setMatrixAt(i, m4.compose(v.copy(a3).add(b3).multiplyScalar(0.5), q4.setFromUnitVectors(ALONG, b3.sub(a3).normalize()), s3)); };
const fall =(from, to, x) => smoothstep(to, from, x).oneMinus();   // 1 below `to`, 0 above `from`

// a soft round spot of light, for lens flares and pools of light on the floor
let glowTex;
const glow = () => glowTex ||= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.userData.shared = true; tex.colorSpace = THREE.SRGBColorSpace; return tex;
})();

// Mirror facets make compact spots with a defined centre, rather than the broad halo of a lamp.
let mirrorSpotTex;
const mirrorSpot = () => mirrorSpotTex ||= (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.72, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.userData.shared = true; tex.colorSpace = THREE.SRGBColorSpace; return tex;
})();

// The pools: env.pool(key, geometry, material, coloured, room) is one kind of part, drawn for every fixture that
// takes one (room: how many at most); env.beams and env.flares are the beams and the glare round a lamp. flush() sends what changed to the card.
export function buildPools(env, add, most) {
  const pools = {}, dyn = (n, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); return a; };
  env.pool = (key, geo, mat, coloured, room = most) => pools[key] ||= (() => {
    const mesh = add(new THREE.InstancedMesh(geo(), mat(), room)); mesh.count = 0; mesh.frustumCulled = false;
    if (coloured) mesh.instanceColor = dyn(room, 3);
    return { mesh, take: () => mesh.count++, put: (i, m) => mesh.setMatrixAt(i, m), color: (i, r, g, b) => mesh.instanceColor.setXYZ(i, r, g, b) };
  })();

  // A beam in haze. A cone that is brightest where you look along its surface, with a hot core and a soft halo,
  // thinning out along its length. The haze it shines through is not even: it drifts, so the beam shows slow streaks
  // of thicker and thinner air. A gobo breaks the beam into separate shafts that turn.
  const geo = new THREE.CylinderGeometry(0.03, 1, 1, 28, 1, true).translate(0, -0.5, 0), bCol = dyn(most, 3), bGobo = dyn(most, 4);   // from the lens along -y
  geo.setAttribute('aCol', bCol); geo.setAttribute('aGobo', bGobo);
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, ...additive });
  const facing = abs(dot(normalize(normalView), normalize(positionViewDirection))), body = pow(facing, 2.5).mul(0.9).add(pow(facing, 14).mul(0.8));
  const along = positionGeometry.y.negate(), reach = float(1).div(along.mul(3).add(1)).mul(fall(1.0, 0.8, along)).mul(smoothstep(0.0, 0.03, along));
  const drift = vec3(env.uTime.mul(0.09), env.uTime.mul(-0.035), env.uTime.mul(0.17));
  const air = mx_noise_float(positionWorld.mul(0.33).add(drift)).mul(0.45).add(sin(dot(positionWorld, vec3(1.1, 0.7, 1.3)).sub(env.uTime.mul(0.3))).mul(0.12)).add(1.05);
  const gobo = attribute('aGobo', 'vec4'), divisions = select(gobo.z.lessThan(0.5), 7, select(gobo.z.lessThan(1.5), 6, 10));
  const shafts = mix(1, smoothstep(0.25, 0.5, abs(fract(uv().x.mul(divisions).add(gobo.y)).sub(0.5)).mul(2)).mul(env.hangarRig ? 1.4 : 1.7), gobo.x);
  const extinction = exp(along.mul(gobo.w).mul(-0.025));
  mat.colorNode = attribute('aCol', 'vec3').mul(body).mul(reach).mul(air).mul(shafts).mul(extinction);
  const beams = add(new THREE.InstancedMesh(geo, mat, most)); beams.count = 0; beams.frustumCulled = false; beams.renderOrder = 1;
  env.beams = { take: () => beams.count++,
    set(i, at, way, wide, length, c, I, gobo, spin, mode = 0) {
      beams.setMatrixAt(i, m4.compose(at, q4.setFromUnitVectors(DOWN, way), v.set(wide, length, wide)));
      const scatter = env.hangarRig ? I / (1 + I * 0.65) : I;
      bCol.setXYZ(i, c.r * scatter, c.g * scatter, c.b * scatter); bGobo.setXYZW(i, gobo || 0, spin || 0, mode, env.hangarRig ? length : 0);
    },
    hide(i) { beams.setMatrixAt(i, NONE); bCol.setXYZ(i, 0, 0, 0); } };

  // the glare round a lamp: a soft spot that always faces the camera
  const fPos = dyn(most * 2, 3), fSize = dyn(most * 2, 2), fCol = dyn(most * 2, 3);
  const fm = new THREE.SpriteNodeMaterial(additive), r = length(uv().sub(0.5)).mul(2);
  fm.positionNode = instancedBufferAttribute(fPos); fm.scaleNode = instancedBufferAttribute(fSize);
  fm.colorNode = instancedBufferAttribute(fCol).mul(select(r.lessThan(0.25), mix(1, 0.45, r.div(0.25)), max(0, r.oneMinus().div(0.75).mul(0.45))));
  const flares = add(new THREE.Sprite(fm)); flares.count = most * 2; flares.frustumCulled = false; flares.renderOrder = 2;
  let nFlare = 0;
  env.flares = { take: () => nFlare++, set(i, at, sx, sy, r, g, b) { fPos.setXYZ(i, at.x, at.y, at.z); fSize.setXY(i, sx, sy); fCol.setXYZ(i, r, g, b); }, hide(i) { fSize.setXY(i, 0, 0); } };

  return function flush() {
    for (const p of Object.values(pools)) { p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true; }
    beams.instanceMatrix.needsUpdate = bCol.needsUpdate = bGobo.needsUpdate = fPos.needsUpdate = fSize.needsUpdate = fCol.needsUpdate = true;
  };
}

const clampGeo = () => { const a = new THREE.BoxGeometry(0.05, 0.3, 0.07).translate(-0.1, 0.15, 0); return mergeGeometries([a, a.clone().translate(0.2, 0, 0)]); };

// A head that pans and tilts, hanging under a truss or standing on the floor. props: stand (on the floor),
// spread (half the beam's angle), fixed (a wash: does not move), reach.
function movingHead(env, thing, base = {}) {
  const p = { spread: 0.035, reach: 60, ...base, ...thing.props }, ch = thing.ch;
  const object = new THREE.Group(), yoke = new THREE.Group(), head = new THREE.Group();
  const up = p.stand ? 1 : -1, way_ = p.stand ? 'S' : 'H';
  yoke.position.y = up * 0.36 + (p.stand ? 0.06 : 0);
  yoke.add(head); object.add(yoke);
  const bases = env.pool('headBase' + way_, () => new THREE.BoxGeometry(0.34, 0.12, 0.34).translate(0, -up * 0.06 + (p.stand ? 0.12 : 0), 0), dark), iBase = bases.take();
  const clamps = p.stand ? null : env.pool('clamp', clampGeo, dark), iClamp = clamps?.take();   // two clamps up to the truss
  const yokes = env.pool('yoke' + way_, () => mergeGeometries([-1, 1].map(side => new THREE.BoxGeometry(0.05, 0.42, 0.14).translate(side * 0.2, -up * 0.1, 0))), dark), iYoke = yokes.take();
  const bodies = env.pool('headBody', () => new THREE.CylinderGeometry(0.13, 0.16, 0.36, 12), dark), iBody = bodies.take();
  const lenses = env.pool('lens', () => new THREE.CircleGeometry(0.12, 16).rotateX(Math.PI / 2).translate(0, -0.185, 0), lamp, true), iLens = lenses.take();
  const iBeam = env.beams.take(), iFlare = env.flares.take();
  let pan = ch.pan = 0, tilt = ch.tilt = p.stand ? 1.9 : 0, panV = 0, tiltV = 0, gobo = 0, spin = 0, zoom = 1;
  // Small, fixed calibration differences between lamps, without random frame-to-frame jitter.
  const calibration = p.hangar ? 1 + Math.sin(thing.pos[0] * 1.71 + thing.pos[1] * 0.13 + thing.pos[2] * 0.37) * 0.035 : 1;
  const at = new THREE.Vector3(), way = new THREE.Vector3(), color = new THREE.Color();
  return { object, update(dt) {
    if (!p.fixed) {   // a real head takes time to get there
      // the motors speed up, run at their top speed and brake: the head eases into a move and settles at the end
      const top = ch.slow ? 1.2 : 3.4, w = ch.slow ? 3.5 : 7, d = Math.min(dt, 0.05);
      const panDistance = Math.atan2(Math.sin(ch.pan - pan), Math.cos(ch.pan - pan));
      panV = Math.max(-top, Math.min(top, panV + (panDistance * w * w - 2 * w * panV) * d)); pan += panV * d;
      tiltV = Math.max(-top, Math.min(top, tiltV + ((ch.tilt - tilt) * w * w - 2 * w * tiltV) * d)); tilt += tiltV * d;
    }
    yoke.rotation.y = pan; head.rotation.x = -tilt;
    head.updateWorldMatrix(true, false);   // wherever the truss it hangs on has moved to
    bases.put(iBase, object.matrixWorld); clamps?.put(iClamp, object.matrixWorld); yokes.put(iYoke, yoke.matrixWorld); bodies.put(iBody, head.matrixWorld); lenses.put(iLens, head.matrixWorld);
    zoom += ((ch.zoom ?? 1) - zoom) * (1 - Math.exp(-dt / 0.8));
    const I = ch.dim * calibration, on = I > 0.004, glowing = Math.min(1, I * 3) * 2.5;
    color.setRGB(ch.color[0], ch.color[1], ch.color[2]);
    lenses.color(iLens, color.r * glowing, color.g * glowing, color.b * glowing);
    if (!on) { env.beams.hide(iBeam); env.flares.hide(iFlare); return; }
    // where the lens is and which way it points, and how far the beam goes: to the floor, or to the roof when it points up
    at.set(0, -0.18, 0).applyMatrix4(head.matrixWorld); way.set(0, -1, 0).transformDirection(head.matrixWorld);
    let length = Math.min(p.reach, way.y < -0.03 ? at.y / -way.y : way.y > 0.03 ? (env.H - at.y) / way.y : p.reach);
    if (p.hangar) {
      // End the beam at the first wall hit, even when it points nearly horizontally.
      for (const [origin, direction, extent] of [[at.x, way.x, env.W / 2], [at.z, way.z, env.D / 2]]) {
        if (Math.abs(direction) > 0.0001) length = Math.min(length, Math.max(0.1, (Math.sign(direction) * extent - origin) / direction));
      }
    }
    const half = p.spread * (p.hangar ? zoom : ch.zoom ?? 1);
    gobo += ((ch.gobo || 0) - gobo) * Math.min(1, dt * 3); spin += dt * 0.25 * gobo;
    env.beams.set(iBeam, at, way, length * Math.tan(half) + 0.1, length, color, I * 0.38 * (0.25 + 0.75 * Math.min(1.6, env.haze)) * (p.fixed ? 0.3 : 1), gobo, spin, ch.goboMode || 0);
    // a lamp that points at you is blinding, one that points away is a dim glow: the flare follows how squarely the
    // lens faces the camera, and stretches sideways like in a lens
    const glare = Math.pow(Math.max(0, way.dot(v.subVectors(env.cam, at).normalize())), 12);
    const near = Math.min(1, Math.max(0, (env.cam.distanceTo(at) - 2.5) / 7)), k = I * (0.5 + glare * 5) * near;   // a lamp right beside the lens must not fill the picture
    env.flares.set(iFlare, at, (0.6 + I * 0.8) * (1 + glare * 2.4), (0.6 + I * 0.8) * (1 + glare * 0.8), color.r * k, color.g * k, color.b * k);
    env.cast(at, way.x, way.y, way.z, color, I * (p.fixed ? 0.5 : 1), half, p.hangar ? gobo : 0, spin, ch.goboMode || 0);   // and it lights what it lands on
  } };
}

const FIXTURES = {
  movingHead,
  // a wide, soft light that stays where it is aimed: straight down unless told otherwise
  wash: (env, thing) => movingHead(env, thing, { fixed: true, spread: 0.3, reach: 40 }),

  strobe(env, thing) {
    const object = new THREE.Group(), lamps = env.pool('strobe', () => new THREE.BoxGeometry(0.6, 0.14, 0.2), lamp, true), i = lamps.take(), halo = env.flares.take();
    return { object, update() {
      const I = thing.ch.dim; object.updateWorldMatrix(true, false); lamps.put(i, object.matrixWorld); lamps.color(i, I * 4, I * 4, I * 4);
      if (I > 0.01) env.flares.set(halo, v.setFromMatrixPosition(object.matrixWorld), 5 + I * 9, 2 + I * 3, I * 1.5, I * 1.5, I * 1.5); else env.flares.hide(halo);
    } };
  },

  blinder(env, thing) {
    const object = new THREE.Group(), cases = env.pool('blinderCase', () => new THREE.BoxGeometry(0.62, 0.34, 0.14), dark), iCase = cases.take();
    const faces = env.pool('blinderFace', () => mergeGeometries([-0.15, 0.15].map(x => new THREE.CircleGeometry(0.12, 14).translate(x, 0, 0.075))), lamp, true), iFace = faces.take(), halo = env.flares.take();
    object.rotation.x = 0.35;
    return { object, update() {
      const I = thing.ch.dim, [r, g, b] = thing.ch.color; object.updateWorldMatrix(true, false);
      cases.put(iCase, object.matrixWorld); faces.put(iFace, object.matrixWorld); faces.color(iFace, r * I * 4, g * I * 4, b * I * 4);
      if (I > 0.01) env.flares.set(halo, v.setFromMatrixPosition(object.matrixWorld), 6 + I * 10, 3 + I * 4, r * I * 1.5, g * I * 1.5, b * I * 1.5); else env.flares.hide(halo);
    } };
  },

  // a bar of LEDs along the truss. props: length, yaw (along a curved rig), upright (standing on end)
  ledBar(env, thing) {
    const object = new THREE.Group(), bars = env.pool('ledBar', () => new THREE.BoxGeometry(1, 0.07, 0.07), lamp, true), i = bars.take();
    object.scale.x = thing.props.length || 1;
    object.rotation.y = thing.props.yaw || 0;
    if (thing.props.upright) object.rotation.z = Math.PI / 2;
    return { object, update() { const k = thing.ch.dim * 2.5, [r, g, b] = thing.ch.color; object.updateWorldMatrix(true, false); bars.put(i, object.matrixWorld); bars.color(i, r * k, g * k, b * k); } };
  },

  // One closed LED ring on the outside of a suspended truss. Every batten meets the next, including the seam;
  // colour and motion travel around this ring alone. Channels: run, build,
  // energy, kick, dropAt and dropStrength, as well as dim, color and color2.
  ledCoil(env, thing) {
    const p = { radius: 8, segments: 144, ...thing.props }, n = p.segments;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.11, 0.11), lamp(), n), c = new THREE.Color(), c2 = new THREE.Color();
    const point = u => { const a = u * TAU; return [Math.sin(a) * p.radius, 0, Math.cos(a) * p.radius]; };
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) { batten(mesh, i, point(i / n), point((i + 1) / n), 1.02); mesh.setColorAt(i, c.setScalar(0)); }
    return { object: mesh, update(dt, t) {
      const ch = thing.ch, run = ch.run || 0, build = ch.build || 0, front = (t - (ch.dropAt ?? -100)) / 2.4;
      c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, behind = ((run - u) % 1 + 1) % 1;
        const mode = ch.mode || 0;
        const pattern = mode === 4 ? 1 : mode === 2 ? Math.pow(Math.max(0, Math.cos(u * TAU * 4 - run * TAU)), 8)
          : mode === 1 || mode === 3 ? Math.max(Math.exp(-behind * 18), Math.exp(-((behind + 0.5) % 1) * 18)) : Math.exp(-behind * 18);
        const stream = pattern * (0.6 + (ch.energy || 0) * 0.35 + (ch.kick || 0) * 0.2);
        const charge = build > 0 ? Math.max(0, Math.min(1, (build - u) * 18)) * build : 0;
        const distance = Math.abs(u - 0.5) * 2, d = distance - front;
        const burst = front >= 0 && front < 2 ? (ch.dropStrength || 0) * Math.exp(-Math.max(0, front - 0.8) * 4) * (d > 0 ? Math.exp(-d * d * 180) : Math.exp(d * 8)) : 0;
        const level = ch.dim * (0.08 + stream + charge * 0.65 + burst + (ch.pulse || 0));
        const blend = 0.5 + 0.5 * Math.sin(u * TAU - run * TAU);
        mesh.instanceColor.setXYZ(i, (c.r + (c2.r - c.r) * blend) * level * 2.5, (c.g + (c2.g - c.g) * blend) * level * 2.5, (c.b + (c2.b - c.b) * blend) * level * 2.5);
      }
      mesh.instanceColor.needsUpdate = true;
    } };
  },

  // A laser. mode 0: a fan of thin lines; 1: a sheet of light, flat over the crowd and slowly tipping; 2: a tunnel,
  // lines on a cone that turns
  laser(env, thing) {
    const object = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0, ...additive }), lines = [], N = 16;
    const geo = new THREE.CylinderGeometry(0.014, 0.014, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);   // along +z
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(geo, mat); m.scale.z = 80; m.frustumCulled = false; m.rotation.order = 'YXZ'; lines.push(m); object.add(m); }
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -1, 0, 1, 1, 0, 1]), 3));
    tri.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0.5, 0, 0, 1, 1, 1]), 2));
    // the sheet is drawn by one fast dot, so it shimmers in thin streaks through the haze
    const uColor = uniform(new THREE.Color(0)), uT = uniform(0), sheetMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, ...additive });
    const a = uv().x.sub(0.5).div(max(uv().y, 0.001)), streak = sin(a.mul(180).add(uT.mul(3))).mul(sin(a.mul(47).sub(uT))).mul(0.45).add(0.55);
    sheetMat.colorNode = uColor.mul(streak).mul(uv().y.oneMinus().mul(0.75).add(0.25));
    const sheet = new THREE.Mesh(tri, sheetMat);
    sheet.scale.set(34, 1, 80); sheet.frustumCulled = false; object.add(sheet);
    object.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), dark()));
    const c = new THREE.Color(), seed = thing.pos[0];
    return { object, update(dt, t) {
      const I = thing.ch.dim, mode = thing.ch.mode || 0; object.visible = I > 0.01;
      if (!object.visible) return;
      mat.color.copy(c.setRGB(...thing.ch.color)).multiplyScalar(I * 1.6);
      sheet.visible = mode === 1; uColor.value.copy(c).multiplyScalar(I * 0.16); uT.value = t + seed;
      object.rotation.set(mode === 1 ? 0.1 + Math.sin(t * 0.23 + seed) * 0.14 : 0.18 + Math.sin(t * 0.11 + seed) * 0.12, mode === 2 ? 0 : Math.sin(t * 0.07 + seed * 1.7) * 0.3, mode === 1 ? Math.sin(t * 0.17 + seed) * 0.25 : 0);
      for (let i = 0; i < N; i++) {
        const m = lines[i]; m.visible = mode === 2 || (mode === 0 && i < 9) || (mode === 1 && i < 2);
        if (mode === 2) { const a = i / N * Math.PI * 2 + t * 0.25, wide = 0.2 + 0.06 * Math.sin(t * 0.2 + seed); m.rotation.set(-Math.sin(a) * wide, Math.cos(a) * wide, 0); }
        else if (mode === 1) m.rotation.set(0, (i ? 1 : -1) * Math.atan(34 / 80), 0);   // the two edges of the sheet
        else m.rotation.set(0, (i - 4) * (0.09 + 0.05 * Math.sin(t * 0.13 + seed)), 0);
      }
    } };
  },

  // a jet of CO2 straight up, set off by ch.fire (a time)
  co2(env, thing) {
    const object = new THREE.Group(), mat = new THREE.SpriteMaterial({ map: glow(), color: 0, ...additive }), puffs = [];
    for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(mat); puffs.push(s); object.add(s); }
    object.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), dark()));
    return { object, update(dt, t) {
      const age = t - (thing.ch.fire ?? -100), on = age >= 0 && age < 2.6;
      for (const s of puffs) s.visible = on;
      if (!on) return;
      const grow = 1 - Math.exp(-age * 7), linger = Math.max(0, age - 1);
      mat.color.setRGB(...env.roomColor).lerp(WHITE, 0.7).multiplyScalar(Math.exp(-linger * 3) * 0.5);
      puffs.forEach((s, i) => { const size = (1.1 + i * 0.25) * (0.5 + 0.5 * grow) + linger * 2; s.position.set(Math.sin(i * 2 + age * 3) * 0.12 * i, 0.3 + (i + 0.5) / 7 * 8 * grow + linger, 0); s.scale.set(size, size * 1.5, 1); });
    } };
  },

  // A ceiling of LED bars, each on its own winch: the bars rise and fall into shapes over the crowd, and light runs
  // through them. One fixture for the whole grid. props: cols, rows, width, depth, length, travel (how far a bar drops)
  kinetic(env, thing) {
    const p = { cols: 12, rows: 10, width: 30, depth: 45, travel: 6, ...thing.props }, n = p.cols * p.rows;
    p.length ??= p.width / (p.cols - 1) * 0.97;   // bar to bar, so a row reads as one line of light
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(p.length, 0.07, 0.07), new THREE.MeshBasicMaterial({ fog: false }), n);
    const wires = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 1, 0.012).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x0a0a0c }), n);
    bars.frustumCulled = wires.frustumCulled = false;
    const object = new THREE.Group(); object.add(bars, wires);
    const drop = new Float32Array(n), o = new THREE.Object3D(), c = new THREE.Color(), c2 = new THREE.Color(), shape = new Float32Array(n);
    for (let i = 0; i < n; i++) bars.setColorAt(i, c.setScalar(0));
    return { object, update(dt, t) {
      const ch = thing.ch, mode = ch.mode || 0, phase = ch.phase || 0;
      c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let r = 0, i = 0; r < p.rows; r++) for (let k = 0; k < p.cols; k++, i++) {
        const u = k / (p.cols - 1) - 0.5, w = r / (p.rows - 1) - 0.5;   // -0.5 to 0.5 across and along
        // where the winch wants this bar, 0 (up at the roof) to 1 (all the way down)
        const want = mode === 0 ? 0.1
          : mode === 1 ? 0.5 + 0.4 * Math.sin(w * 7 + t * 0.35)                      // a wave rolling down the hall
          : mode === 2 ? 0.15 + Math.abs(u) * 1.5                                    // a V open to the stage
          : mode === 3 ? 0.5 + 0.4 * Math.sin(Math.hypot(u, w) * 12 - t * 0.5)       // rings from the middle
          : mode === 4 ? 0.9 - Math.abs(u) * 1.5                                     // a roof ridge, low in the middle
          : (shape[i] ||= Math.random());                                            // scattered
        if (mode !== 5) shape[i] = 0;
        const target = Math.max(0, Math.min(1, want)) * (1 - (ch.lift || 0)) + (ch.low || 0) * 0.5;
        drop[i] += Math.max(-dt * 0.22, Math.min(dt * 0.22, target - drop[i]));     // winches are slow
        const y = -drop[i] * p.travel;
        o.position.set(u * p.width, y, w * p.depth); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); bars.setMatrixAt(i, o.matrix);
        o.scale.set(1, -y + 0.1, 1); o.updateMatrix(); wires.setMatrixAt(i, o.matrix);
        // light running through the grid on the beat, row after row from the stage
        const run = Math.pow(Math.max(0, Math.cos((r * 0.55 - phase) * Math.PI)), 6), sweep = Math.pow(Math.max(0, Math.cos((u * 3 + phase * 0.5) * Math.PI)), 4);
        const level = ch.dim * (0.2 + (ch.pattern ? sweep : run) * 0.9 + (ch.kick || 0) * 0.35) + (ch.flash || 0);
        const col = (r + k) % 2 ? c2 : c; bars.instanceColor.setXYZ(i, col.r * level * 2.2, col.g * level * 2.2, col.b * level * 2.2);
      }
      bars.instanceMatrix.needsUpdate = wires.instanceMatrix.needsUpdate = bars.instanceColor.needsUpdate = true;
    } };
  },

  // A raster of triangles edged with LED over a stage, each on its own winch, so that the raster can break up into
  // other shapes: a wave, a V hanging over whoever plays, an arch, scattered. It leans towards the hall, so that the
  // crowd sees triangles and not their edges. It takes the channels of the kinetic ceiling. props: cols, rows, side
  // (of a triangle), travel (how far one drops), tilt (how far the raster leans)
  ledTriangles(env, thing) {
    const p = { cols: 11, rows: 3, side: 2.4, travel: 2.4, tilt: 0.44, ...thing.props }, n = p.cols * p.rows, h = p.side * 0.866, corners = [[0, 0, h * 2 / 3], [p.side / 2, 0, -h / 3], [-p.side / 2, 0, -h / 3]];
    const shapes = new THREE.InstancedMesh(mergeGeometries([[0, 1], [1, 2], [2, 0]].map(([a, b]) => strut(corners[a], corners[b], 0.045))), new THREE.MeshBasicMaterial({ fog: false }), n);
    const wires = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 1, 0.012).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x0a0a0c }), n);
    shapes.frustumCulled = wires.frustumCulled = false;
    const object = new THREE.Group(); object.add(shapes, wires);
    const drop = new Float32Array(n), shape = new Float32Array(n), o = new THREE.Object3D(), c = new THREE.Color(), c2 = new THREE.Color(), [px, py, pz] = thing.pos;
    for (let i = 0; i < n; i++) shapes.setColorAt(i, c.setScalar(0));
    return { object, update(dt, t) {
      const ch = thing.ch, mode = ch.mode || 0, phase = ch.phase || 0;
      c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let r = 0, i = 0; r < p.rows; r++) for (let k = 0; k < p.cols; k++, i++) {
        const flip = (k + r) % 2, u = p.cols > 1 ? k / (p.cols - 1) - 0.5 : 0, along = (r - (p.rows - 1) / 2) * h + (flip ? h / 3 : 0);   // across the raster, -0.5 to 0.5, and up its slope
        // where the winch wants this one, 0 (up in the raster) to 1 (all the way down)
        const want = mode === 0 ? 0.04
          : mode === 1 ? 0.5 + 0.4 * Math.sin(u * 7 + r * 1.3 + t * 0.3)             // a slow wave across
          : mode === 2 ? 0.85 - Math.abs(u) * 1.7                                    // a V hanging over whoever plays
          : mode === 3 ? 0.1 + (1 - r / Math.max(1, p.rows - 1)) * 0.75              // steps: the front row high, the back row low
          : mode === 4 ? 0.05 + Math.abs(u) * 1.7                                    // an arch, low at both sides
          : (shape[i] ||= Math.random());                                            // scattered
        if (mode !== 5) shape[i] = 0;
        const target = Math.max(0, Math.min(1, want)) * (1 - (ch.lift || 0)) + (ch.low || 0) * 0.3;
        drop[i] += Math.max(-dt * 0.22, Math.min(dt * 0.22, Math.min(1, target) - drop[i]));     // winches are slow
        const x = u * (p.cols - 1) * p.side / 2, y = along * Math.sin(p.tilt) - drop[i] * p.travel, z = along * Math.cos(p.tilt);
        o.position.set(x, y, z); o.rotation.set(-p.tilt + (drop[i] - 0.4) * 0.3, flip ? Math.PI : 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); shapes.setMatrixAt(i, o.matrix);
        o.rotation.set(0, 0, 0); o.scale.set(1, Math.max(0.1, env.ceil(px + x, pz + z) - py - y), 1); o.updateMatrix(); wires.setMatrixAt(i, o.matrix);
        // a patch of light runs through the raster on the beat
        const run = Math.pow(Math.max(0, Math.cos(k * 0.7 + r * 1.6 - phase * Math.PI / 2)), 2);
        const level = ch.dim * (0.25 + run * 0.9 + (ch.kick || 0) * 0.35) + (ch.flash || 0), col = flip ? c2 : c;
        shapes.instanceColor.setXYZ(i, col.r * level * 2.2, col.g * level * 2.2, col.b * level * 2.2);
      }
      shapes.instanceMatrix.needsUpdate = wires.instanceMatrix.needsUpdate = shapes.instanceColor.needsUpdate = true;
    } };
  },

  // LED strips along the building's own line: up one wall, over the roof and down the other, every so many metres.
  // A pulse runs from one to the next down the hall, so the building itself joins in. props: every (metres between)
  ledArches(env, thing) {
    const { D } = env, n = Math.round(D / thing.props.every), SEG = 44, segs = pieces(env.profile, SEG), count = (n + 1) * SEG;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.09, 0.09), new THREE.MeshBasicMaterial({ fog: false }), count), o = new THREE.Object3D(), c = new THREE.Color(), c2 = new THREE.Color();
    mesh.frustumCulled = false;
    for (let f = 0, i = 0; f <= n; f++) for (let k = 0; k < SEG; k++, i++) {
      o.position.set(segs[k].x, segs[k].y, -D / 2 + 0.2 + (D - 0.4) * f / n + 0.3); o.rotation.set(0, 0, segs[k].angle); o.scale.set(segs[k].length * 0.9, 1, 1);
      o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); mesh.setColorAt(i, c.setScalar(0));
    }
    return { object: mesh, update(dt, t) {
      const ch = thing.ch; c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let f = 0, i = 0; f <= n; f++) {
        // Scene-stable gestures: a pulse down the hall, its return, paired groups,
        // or a slow wave that moves at phrase pace.
        const envelope = ch.archCentre === undefined ? 1 : ch.archBase + ch.archStrength * Math.exp(-Math.pow((f / n - ch.archCentre) / ch.archWidth, 2));
        const pattern = ch.pattern || 0, travel = pattern === 1 ? n - (ch.travel ?? 99) : (ch.travel ?? 99);
        let pulse = pattern === 1 ? Math.exp(-Math.pow((f - travel) * 0.9, 2)) : (pattern === 3 ? 0 : (ch.kickPulse || 0));
        if (pattern === 2 && f % 2 !== Math.floor((ch.beat || 0) / 4) % 2) pulse = 0;
        for (let k = 0; k < SEG; k++, i++) {
          const u = k / SEG, phase = ch.phase || 0;
          const along = pattern === 3
            ? 0.5 + 0.5 * Math.cos(phase * Math.PI / 16 - f * 0.72 + u * Math.PI * 2)
            : Math.pow(Math.max(0, Math.cos((u * 2 - phase / 8 + f * 0.13) * Math.PI)), 8);
          const level = pattern === 3
            ? ch.dim * (0.1 + along * 0.46 + (ch.chase || 0) * 0.2) + (ch.flash || 0)
            : ch.dim * (0.05 + pulse * 0.9 + along * (ch.chase || 0)) + (ch.flash || 0);
          const col = f % 2 ? c2 : c; mesh.instanceColor.setXYZ(i, col.r * level * envelope * 2, col.g * level * envelope * 2, col.b * level * envelope * 2);
        }
      }
      mesh.instanceColor.needsUpdate = true;
    } };
  },

  // LED battens under the spokes of a round roof: on every spoke a line of them from the lantern in the middle out
  // to the wall, and a ring of light at the lantern's foot where they meet. Light runs along them, so the roof
  // itself joins in. One fixture for the whole roof. Its channels:
  //   kickAt   when the last kick was: it sends a band of light along the spokes, with a sharp front and a tail
  //            behind it. pick: along every spoke (0), every other one (1) or every fourth (2), stepping round with
  //            beat; inward: from the wall to the lantern; span: seconds to cross; punch: how hard the kick was
  //   swell    slow waves breathing through the roof; chase: light racing in to the lantern (run is its clock)
  //   blades   blades of light that turn round the hall (turn: their angle)
  //   glitter  battens flashing white at random; white: all of them, for a strobe; flash: all of them, in colour
  //   hub      the ring at the lantern's foot; house: the lantern's own warm light, for when nothing plays
  // props: spokes, segs (battens on a spoke), from and to (how far from the middle a line starts and ends), drop (how
  // far under the roof it hangs), hub ([radius, height] of the ring at the lantern's foot), power and reach (of the
  // lamp in the lantern)
  ledSpokes(env, thing) {
    const p = { spokes: 40, segs: 16, from: 3.5, to: env.W / 2 - 0.8, drop: 0.4, power: 110, reach: 38, ...thing.props }, N = p.spokes, S = p.segs, HUB = p.hub ? 24 : 0, oval = env.D / env.W;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.1), new THREE.MeshBasicMaterial({ fog: false }), N * S + HUB), object = new THREE.Group(), c = new THREE.Color(), c2 = new THREE.Color();
    mesh.frustumCulled = false; object.add(mesh);
    const at = (a, r) => { const x = Math.sin(a) * r, z = Math.cos(a) * r * oval; return [x, env.ceil(x, z) - p.drop, z]; };
    for (let s = 0, i = 0; s < N; s++) for (let k = 0; k < S; k++, i++) batten(mesh, i, at(s / N * TAU, p.from + (p.to - p.from) * k / S), at(s / N * TAU, p.from + (p.to - p.from) * (k + 1) / S), 0.8);
    for (let k = 0; k < HUB; k++) batten(mesh, N * S + k, ...[k, k + 1].map(j => [Math.sin(j / HUB * TAU) * p.hub[0], p.hub[1], Math.cos(j / HUB * TAU) * p.hub[0] * oval]), 0.9);
    for (let i = 0; i < N * S + HUB; i++) mesh.setColorAt(i, c.setScalar(0));
    const lantern = p.hub ? new THREE.PointLight(0xffffff, 0, p.reach, 2) : null;
    if (lantern) { lantern.position.set(0, p.hub[1] + 1, 0); object.add(lantern); }
    // every spoke remembers the band it last carried: when it left, how hard it was and which way it went
    const left = new Float32Array(N).fill(-99), hard = new Float32Array(N), back = new Uint8Array(N);
    let heard = null;
    return { object, update(dt, t) {
      const ch = thing.ch, beat = ch.beat || 0, span = ch.span || 0.38, tick = Math.floor(t * 14), white = ch.white || 0, hue = mesh.instanceColor;
      if (ch.kickAt !== heard) {
        if (heard !== null) for (let s = 0; s < N; s++) if (ch.pick === 1 ? s % 2 === beat % 2 : ch.pick === 2 ? s % 4 === beat % 4 : true) { left[s] = ch.kickAt; hard[s] = ch.punch ?? 1; back[s] = ch.inward ? 1 : 0; }
        heard = ch.kickAt;
      }
      c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let s = 0, i = 0; s < N; s++) {
        const a = s / N * TAU, col = s % 2 ? c2 : c, front = (t - left[s]) / span, pulse = left[s] === heard ? hard[s] * (ch.kick || 0) * 0.25 : 0;   // the spokes that carry this kick's band also pulse with it
        const blade = (ch.blades || 0) * Math.pow(Math.max(0, Math.cos(a * 3 - (ch.turn || 0))), 8), sway = (ch.swell || 0) * (0.5 + 0.5 * Math.sin(a * 3 + t * 0.8));
        for (let k = 0; k < S; k++, i++) {
          const u = (k + 0.5) / S, d = (back[s] ? 1 - u : u) - front;
          const band = hard[s] * (d > 0 ? Math.exp(-d * d * 150) : Math.exp(d * 4.5)) + pulse;
          const chase = (ch.chase || 0) * Math.pow(0.5 + 0.5 * Math.sin(u * 5 + (ch.run || 0)), 4);
          const spark = Math.sin((i + 1) * 12.9898 + tick * 78.233) * 43758.5453, w = Math.max(spark - Math.floor(spark) > 0.9 ? ch.glitter || 0 : 0, white);
          const level = Math.max(ch.dim * Math.max(band, sway * (0.6 + 0.4 * Math.sin(u * 3 - t)), chase, blade), ch.flash || 0);
          hue.setXYZ(i, (col.r * level + w) * 2.2, (col.g * level + w) * 2.2, (col.b * level + w) * 2.2);
        }
      }
      if (lantern) {
        const hub = ch.hub || 0, house = ch.house || 0;
        c.multiplyScalar(hub).add(c2.setRGB(1, 0.72, 0.42).multiplyScalar(house));
        for (let k = 0; k < HUB; k++) hue.setXYZ(N * S + k, c.r * 2.5 + white, c.g * 2.5 + white, c.b * 2.5 + white);
        lantern.color.copy(c); lantern.intensity = p.power;
      }
      hue.needsUpdate = true;
    } };
  },

  // LED round a ring truss, under its inner chord: patches of light that turn round it, and all of it together on a
  // kick. One fixture for the whole ring, hung at its middle. Channels: turn (how far the patches have turned),
  // patch (how bright they are), pulse (all of it together), flash. props: radius, sides (the straight trusses
  // the ring is made of), per (battens to a side)
  ledRing(env, thing) {
    const p = { radius: 8, sides: 16, per: 2, ...thing.props }, n = p.sides * p.per, r = p.radius - 0.24, c = new THREE.Color();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.08), new THREE.MeshBasicMaterial({ fog: false }), n);
    mesh.frustumCulled = false;
    const corner = j => [Math.sin(j / p.sides * TAU) * r, 0, Math.cos(j / p.sides * TAU) * r], part = (a, b, k) => a.map((q, j) => q + (b[j] - q) * k / p.per);
    for (let s = 0, i = 0; s < p.sides; s++) for (let k = 0; k < p.per; k++, i++) { batten(mesh, i, part(corner(s), corner(s + 1), k), part(corner(s), corner(s + 1), k + 1), 0.88); mesh.setColorAt(i, c.setScalar(0)); }
    return { object: mesh, update() {
      const ch = thing.ch; c.setRGB(...ch.color);
      for (let i = 0; i < n; i++) {
        const level = Math.max(ch.dim * (Math.pow(Math.max(0, Math.cos((i + 0.5) / n * TAU * 3 + (ch.turn || 0))), 6) * (ch.patch ?? 1) + (ch.pulse || 0)), ch.flash || 0) * 2;
        mesh.instanceColor.setXYZ(i, c.r * level, c.g * level, c.b * level);
      }
      mesh.instanceColor.needsUpdate = true;
    } };
  },

  // Light on the building itself: a lamp that washes a wall, a column or a vault. props: power, reach, bare (no
  // fitting to be seen)
  glow(env, thing) {
    const object = new THREE.Group(), light = new THREE.PointLight(0xffffff, 0, thing.props.reach || 16, 2);
    object.add(light); if (!thing.props.bare) object.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.2), dark()));
    return { object, update() { light.color.setRGB(...thing.ch.color); light.intensity = thing.ch.dim * (thing.props.power || 25); } };
  },

  // a chandelier: rings of small lamps on brass, and the light it gives. props: size, rings, power, reach
  chandelier(env, thing) {
    const s = thing.props.size || 1.6, object = new THREE.Group(), bulbs = env.pool('bulb', () => new THREE.SphereGeometry(0.05, 6, 4), lamp, true, 4000), list = [], brass = [];
    for (let r = 0; r < (thing.props.rings || 2); r++) {
      const rad = s * (1 - r * 0.38), n = Math.round(rad * 14), y = r * s * 0.35;
      brass.push(new THREE.TorusGeometry(rad, 0.025, 5, 28).rotateX(Math.PI / 2).translate(0, y, 0));
      for (let i = 0; i < n; i++) list.push([Math.cos(i / n * 6.283) * rad, y + 0.08, Math.sin(i / n * 6.283) * rad, bulbs.take()]);
    }
    brass.push(new THREE.CylinderGeometry(0.02, 0.02, 3, 5).translate(0, 1.5 + s * 0.3, 0));
    object.add(new THREE.Mesh(mergeGeometries(brass), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.35, metalness: 0.9 })));
    const light = new THREE.PointLight(0xffd9a0, 0, thing.props.reach || 28, 2); object.add(light);
    let placed = false;
    return { object, update() {
      if (!placed) { placed = true; object.updateWorldMatrix(true, false); for (const [x, y, z, i] of list) bulbs.put(i, m4.copy(object.matrixWorld).multiply(m5.makeTranslation(x, y, z)).scale(v.setScalar(1.3))); }
      const k = thing.ch.dim; for (const [, , , i] of list) bulbs.color(i, 3 * k, 2.2 * k, 1.2 * k);
      light.intensity = k * (thing.props.power || 60);
    } };
  },

  // a string of lamps from here to props.to, sagging between. props: to [x, y, z], bulbs, sag, party (in colours)
  festoon(env, thing) {
    const bulbs = env.pool('bulb', () => new THREE.SphereGeometry(0.05, 6, 4), lamp, true, 4000), [ax, ay, az] = thing.pos, [bx, by, bz] = thing.props.to, sag = thing.props.sag ?? 0.7;
    const n = thing.props.bulbs || Math.max(6, Math.round(Math.hypot(bx - ax, by - ay, bz - az) / 0.75)), list = [], wire = [], PARTY = [[1, 0.25, 0.2], [1, 0.75, 0.2], [0.25, 0.9, 0.4], [0.3, 0.5, 1], [1, 0.3, 0.8]];
    for (let i = 0, last = null; i <= n; i++) {
      const u = i / n, p = [ax + (bx - ax) * u, ay + (by - ay) * u - sag * 4 * u * (1 - u), az + (bz - az) * u];
      if (last) strut(last, p, 0.02, wire);
      last = p; const k = bulbs.take(); bulbs.put(k, m4.makeTranslation(p[0], p[1] - 0.08, p[2]).scale(v.setScalar(1.5))); list.push(k);
    }
    env.put(env.black, wire);
    return { object: new THREE.Group(), update(dt, t) {
      const k = thing.ch.dim * 2.6;
      list.forEach((i, j) => { const c = thing.props.party ? PARTY[j % 5] : [1, 0.72, 0.4], tw = k * (0.85 + 0.15 * Math.sin(t * 2.3 + j * 1.7)); bulbs.color(i, c[0] * tw, c[1] * tw, c[2] * tw); });
    } };
  },

  // a dance floor of lit tiles. props: cols, rows, size (of a tile)
  ledFloor(env, thing) {
    const p = { cols: 12, rows: 12, size: 1, ...thing.props }, n = p.cols * p.rows, o = new THREE.Object3D(), c = new THREE.Color(), c2 = new THREE.Color(), own = new Float32Array(n).map(() => Math.random());
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(p.size * 0.94, p.size * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ fog: false }), n);
    mesh.frustumCulled = false;
    for (let r = 0, i = 0; r < p.rows; r++) for (let k = 0; k < p.cols; k++, i++) { o.position.set((k - (p.cols - 1) / 2) * p.size, 0, (r - (p.rows - 1) / 2) * p.size); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); mesh.setColorAt(i, c.setScalar(0)); }
    return { object: mesh, update() {
      const ch = thing.ch, mode = (ch.mode || 0) % 4, beat = Math.floor(ch.phase || 0), fall = 1 - ((ch.phase || 0) % 1) * 0.5;
      c.setRGB(...ch.color); c2.setRGB(...(ch.color2 || ch.color));
      for (let r = 0, i = 0; r < p.rows; r++) for (let k = 0; k < p.cols; k++, i++) {
        // a checkerboard that swaps on the beat, rows that step, squares that grow from the middle, or tiles at random
        const on = mode === 0 ? (r + k + beat) % 2 : mode === 1 ? ((r + beat) % 4 === 0 ? 1 : 0.1) : mode === 2 ? (Math.floor(Math.max(Math.abs(k - (p.cols - 1) / 2), Math.abs(r - (p.rows - 1) / 2))) % 3 === beat % 3 ? 1 : 0.1) : ((own[i] + beat * 0.618) % 1 < 0.35 ? 1 : 0.1);
        const level = ch.dim * (0.1 + on * fall) * 1.5, col = (r + k) % 2 ? c2 : c;
        mesh.instanceColor.setXYZ(i, col.r * level, col.g * level, col.b * level);
      }
      mesh.instanceColor.needsUpdate = true;
    } };
  },

  // a swimming pool lit from below, in the show's colour. props: width, depth
  pool(env, thing) {
    const { width: w, depth: d } = thing.props, uCol = uniform(new THREE.Color(0)), mat = new THREE.MeshBasicNodeMaterial({ fog: false }), p = positionWorld, t = env.uTime;
    const wave = sin(p.x.mul(2.1).add(t.mul(1.3)).add(sin(p.z.mul(1.7).sub(t)).mul(1.2))).mul(sin(p.z.mul(2.6).sub(t.mul(0.9)).add(sin(p.x.mul(1.3).add(t.mul(0.7))).mul(1.4))));
    mat.colorNode = uCol.mul(wave.mul(0.3).add(0.75)).add(uCol.mul(pow(max(wave, 0), 6)).mul(0.9));
    const object = new THREE.Group(), light = new THREE.PointLight(0xffffff, 0, Math.max(w, d) * 1.3, 2); light.position.y = 1.4;
    object.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat), light);
    const [x, , z] = thing.pos; env.put(env.plain(0xd8d8d2, { roughness: 0.5, gain: 2 }), [[w + 0.8, 0.4, x, z - d / 2 - 0.2], [w + 0.8, 0.4, x, z + d / 2 + 0.2], [0.4, d, x - w / 2 - 0.2, z], [0.4, d, x + w / 2 + 0.2, z]].map(([bw, bd, bx, bz]) => new THREE.BoxGeometry(bw, 0.12, bd).translate(bx, 0.06, bz)));
    return { object, update() { const k = thing.ch.dim, [r, g, b] = thing.ch.color; uCol.value.setRGB(r * 0.45 + 0.08, g * 0.5 + 0.38, b * 0.5 + 0.45).multiplyScalar(k * 1.3); light.color.copy(uCol.value); light.intensity = k * 16; } };
  },

  // A column of fire, set off by ch.fire
  flame(env, thing) {
    const object = new THREE.Group(), mat = new THREE.SpriteMaterial({ map: glow(), color: 0, ...additive }), puffs = [];
    for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(mat); puffs.push(sp); object.add(sp); }
    object.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 8), dark()));
    return { object, update(dt, t) {
      const age = t - (thing.ch.fire ?? -100), on = age >= 0 && age < 0.9;
      for (const sp of puffs) sp.visible = on;
      if (!on) return;
      const k = age / 0.9, power = Math.sin(Math.min(1, k * 1.6) * Math.PI) ;
      mat.color.setRGB(1, 0.42 - k * 0.2, 0.06).multiplyScalar(2.2 * power);
      puffs.forEach((sp, i) => { const h = (i + 0.5) / 6; sp.position.set(Math.sin(i * 3 + t * 20) * 0.15, 0.3 + h * 6.5 * Math.min(1, k * 4), 0); const w = 1.5 - h * 0.7; sp.scale.set(w, w * 2.2, 1); });
      env.flash(thing.pos, 1, 0.45, 0.1, power * 30);
    } };
  },

  // Particles thrown out and pulled down again. The same machine makes a fountain of sparks, a firework bursting
  // under the roof, and a confetti cannon; `kind` says which.
  spark: (env, thing) => burst(env, thing, { count: 500, life: 1.1, emit: 2.6, speed: [1.2, 9, 1.2], gravity: 9.8, drag: 0.6, size: 0.3, a: [1, 0.85, 0.5], b: [1, 0.55, 0.15], light: 6 }),
  // props for the open air, where it can go as high as it likes: rise (how high it bursts), reach (how wide)
  firework: (env, thing) => { const reach = thing.props.reach || 11; return burst(env, thing, { count: thing.props.reach ? 1500 : 900, life: thing.props.reach ? 2.8 : 1.8, emit: 0, speed: [reach, reach, reach], gravity: 4, drag: thing.props.reach ? 1.5 : 2.2, size: thing.props.reach ? 1.3 : 0.42, sphere: true, rise: thing.props.rise ?? 9, a: [1, 0.9, 0.7], b: null, light: thing.props.reach ? 120 : 40 }); },
  confetti: (env, thing) => burst(env, thing, { count: 2600, life: 13, emit: 1.2, speed: [7, 13, 9], gravity: 2.2, drag: 1.3, size: 0.11, flutter: true, a: [1, 1, 1], b: null, blend: THREE.NormalBlending, light: 0 }),

  // A mirror ball: a turning ball of little mirrors with a lamp on it. Every mirror throws a spot of light that
  // travels over the walls, the floor and the roof as the ball turns, in the room as it is: round or square, under
  // a flat roof or one that rises. props: size (the ball's radius), rays (how many spots)
  mirrorBall(env, thing) {
    const s = thing.props.size || 0.3, N = thing.props.rays || 150, object = new THREE.Group(), [bx, by, bz] = thing.pos;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(s, s > 0.6 ? 3 : 2), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.25, metalness: 0.9, flatShading: true }));
    object.add(ball, new THREE.Mesh(new THREE.CylinderGeometry(0.015 + s * 0.02, 0.015 + s * 0.02, s + 0.1, 5).translate(0, s * 1.5 + 0.05, 0), dark()));
    const dots = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: mirrorSpot(), color: 0, ...additive }), N);
    dots.frustumCulled = false; env.scene.add(dots);
    const rays = Array.from({ length: N }, (_, i) => ({ a: i * 2.399963, y: 0.92 - 1.84 * (i + 0.5) / N })), o = new THREE.Object3D(), c = new THREE.Color();   // spread evenly over the ball
    const face = new THREE.Vector3(0, 0, 1), normal = new THREE.Vector3();
    let turn = 0;
    return { object, update(dt, t) {
      const I = thing.ch.dim; dots.visible = I > 0.01;
      turn += dt * 0.22; ball.rotation.y = turn;
      ball.material.emissive.setRGB(...thing.ch.color).multiplyScalar(I * 0.25);
      if (!dots.visible) return;
      dots.material.color.copy(c.setRGB(...thing.ch.color)).multiplyScalar(I * 1.4);
      for (let i = 0; i < N; i++) {
        const r = rays[i], flat = Math.sqrt(1 - r.y * r.y), dx = Math.cos(r.a + turn) * flat, dy = r.y, dz = Math.sin(r.a + turn) * flat;
        const hit = reflectionHit(env, [bx, by, bz], [dx, dy, dz]);
        normal.set(...hit.normal);
        o.position.set(...hit.position).addScaledVector(normal, 0.025);
        o.quaternion.setFromUnitVectors(face, normal);
        o.scale.setScalar(0.7 + Math.min(hit.distance, 35) * 0.025);
        o.updateMatrix(); dots.setMatrixAt(i, o.matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
    } };
  },

  // makes haze; what it puts out is read by the world
  hazer(env, thing) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.7), dark());
    return { object, update() { env.hazeOut = thing.ch.dim; } };
  },

  // The LED wall: a screen of dots showing one of eight visuals in the show's colours, or a picture or video the
  // viewer has given it. props: width, height; see (a see-through screen: you look past the dots); rotY; or
  // dome: { rx, rz, rise }, the inside of a dome as one screen
  ledWall(env, thing) {
    const dome = thing.props.dome, { width, height } = dome ? { width: 30, height: 30 } : thing.props, see = !!thing.props.see, dense = see ? 3.5 : dome ? 16 : 6;   // a dome is projected on: no dots to be seen
    // places: many small screens instead of one, [[where, what it faces, how far round the room (0 to 1)], ...]. Each
    // shows the picture in small, and a swell of brightness runs round them with the beat: one band of light.
    const many = thing.props.places, swell = many ? instancedBufferAttribute(new THREE.InstancedBufferAttribute(Float32Array.from(many, (q, i) => q[2] ?? i / many.length), 1)) : null;
    const U = { time: uniform(0), phase: uniform(0), kick: uniform(0), build: uniform(0), gain: uniform(0), mode: uniform(0), col: uniform(new THREE.Color(0)), col2: uniform(new THREE.Color(0)), mediaOn: uniform(0), media: texture(blank()), themes: uniform(new THREE.Vector3()), vj: uniform(new THREE.Vector3(1, 0, 0)), vjBuild: uniform(0) };
    const themeWeights = [0, 0, 0];
    const grid = vec2(Math.round(width * dense), Math.round(height * dense)), aspect = width / height;
    const hash2 = q => fract(sin(dot(q, vec2(127.1, 311.7))).mul(43758.5453));
    const mat = new THREE.MeshBasicNodeMaterial({ fog: false, ...(see ? { ...additive, side: THREE.DoubleSide } : dome ? { side: THREE.BackSide } : {}) });
    // on a dome the picture is laid out round the top: its middle is straight overhead
    const at = dome ? vec2(cos(uv().x.mul(6.2832)), sin(uv().x.mul(6.2832))).mul(uv().y.oneMinus().mul(0.5)).add(0.5) : uv();
    mat.colorNode = Fn(() => {
      // Initialise shared coordinates before the visual branches; otherwise the shader can first assign them
      // inside a branch that is skipped, leaving later visuals (and the dot mask) with zero coordinates.
      const projected = at.toVar(), cell = (dome ? projected : floor(projected.mul(grid)).add(0.5).div(grid)).toVar(), p = cell.sub(0.5).mul(vec2(aspect, 1)).toVar();
      const r = length(p).toVar(), a = atan(p.y, p.x).toVar(), t = U.time, ph = U.phase, lit = float(0).toVar(), k = float(0).toVar();
      If(U.mode.lessThan(0.5), () => { lit.assign(smoothstep(0.35, 0.65, fract(r.mul(3).sub(ph.mul(0.5))))); k.assign(step(0.5, fract(r.mul(1.5).sub(ph.mul(0.25))))); })   // rings moving outwards
        .ElseIf(U.mode.lessThan(1.5), () => { lit.assign(smoothstep(0.4, 0.6, fract(cell.x.mul(8).add(sin(cell.y.mul(6).add(t.mul(0.7))).mul(0.15))))); k.assign(step(0.5, fract(cell.x.mul(4)))); })   // bars
        .ElseIf(U.mode.lessThan(2.5), () => { lit.assign(smoothstep(0.3, 0.7, fract(float(0.25).div(r.add(0.05)).add(ph.mul(0.5)))).mul(smoothstep(0.0, 0.25, r))); k.assign(step(0, sin(a.mul(4).add(t)))); })   // a tunnel
        .ElseIf(U.mode.lessThan(4.5), () => { const w = sin(cell.x.mul(9).add(t.mul(1.3))).mul(sin(cell.x.mul(3.3).sub(t.mul(0.7)))).mul(0.28).mul(U.kick.add(0.4)); lit.assign(fall(0.035, 0, abs(p.y.sub(w))).add(fall(0.02, 0, abs(p.y.add(w.mul(0.6)))).mul(0.6))); k.assign(step(0, p.y.sub(w))); })   // a waveform
        .ElseIf(U.mode.lessThan(5.5), () => { const g = vec2(a.mul(3), float(0.3).div(r.add(0.03)).add(t.mul(0.6)).add(ph.mul(0.25))); lit.assign(step(0.86, hash2(floor(g.mul(vec2(6, 4))))).mul(smoothstep(0.02, 0.3, r))); k.assign(step(0.5, hash2(floor(vec2(g.x, g.x).mul(6))))); })   // flying through stars
        .ElseIf(U.mode.lessThan(6.5), () => { const s = sin(p.x.mul(5).add(t.mul(0.6))).add(sin(p.y.mul(6).sub(t.mul(0.45)))).add(sin(p.x.add(p.y).mul(4).add(t.mul(0.3)))); lit.assign(smoothstep(0.2, 0.9, sin(s.mul(2.2).add(ph.mul(1.5708))).mul(0.5).add(0.5))); k.assign(step(0, s)); })   // liquid
        .ElseIf(U.mode.lessThan(7.5), () => { const d = fract(cell.x.mul(aspect).add(cell.y).mul(1.6).sub(ph.mul(0.25))); lit.assign(smoothstep(0, 0.08, d).mul(fall(0.5, 0.42, d))); k.assign(step(0.5, fract(cell.x.mul(aspect).sub(cell.y).mul(0.8)))); })   // a sweep on the diagonal
        .Else(() => { const q = abs(fract(p.mul(2.2).add(vec2(0, t.mul(0.12)))).sub(0.5)); lit.assign(fall(0.03, 0, abs(max(q.x, q.y).sub(0.3).sub(sin(ph.mul(3.1416)).mul(0.1))))); k.assign(step(0.5, fract(cell.y.mul(3).add(t.mul(0.1))))); });   // squares
      const bar = step(cell.y, U.build).mul(step(0.02, U.build));   // in a break a bar rises with the tension
      const own = mix(U.col, U.col2, k).mul(max(lit.mul(U.build.oneMinus()), bar).mul(0.85).add(0.06).add(U.kick.mul(0.3)));
      // Three composed image families on slow beat clocks. Each develops within its family with the music: quiet
      // (vj.x), building (vj.y, how far in vjBuild) and peak (vj.z). The weights ease, and so does a change of theme,
      // so nothing cuts.
      const vq = U.vj.x, vb = U.vj.y, vp = U.vj.z, rise = U.vjBuild;
      const seed = hash2(floor(cell.mul(vec2(10, 6)))), gridCell = abs(fract(cell.mul(vec2(10, 6))).sub(0.5));
      const frame = fall(0.065, 0.025, abs(max(gridCell.x, gridCell.y).sub(0.35)));
      const scan = fall(0.16, 0.04, abs(fract(cell.x.add(ph.div(64))).sub(0.5)));
      // Industrial. Quiet: a few frames breathing in the dark. Build: a scan opens from the middle and leaves lit
      // frames behind it. Peak: three groups of frames take turns every four beats, with a small kick accent.
      const sparse = frame.mul(step(seed, 0.26)).mul(sin(ph.mul(TAU / 32).add(seed.mul(40))).mul(0.4).add(0.6));
      const side = abs(cell.x.sub(0.5)), reach = rise.mul(0.54);
      const edge = fall(0.035, 0.008, abs(side.sub(reach))).mul(step(0.01, rise));
      const opened = frame.mul(step(side, reach)).mul(0.55).add(edge);
      const turn = float(1).sub(min(abs(floor(seed.mul(3)).sub(floor(fract(ph.div(12)).mul(3)))), 1));
      const groups = frame.mul(turn.mul(float(1).sub(fract(ph.div(4)).mul(0.5))).mul(0.95).add(0.07).add(turn.mul(U.kick).mul(0.12))).add(scan.mul(0.18));
      const industrial = mix(U.col, U.col2, scan).mul(sparse.mul(vq).mul(0.55))
        .add(mix(U.col, U.col2, edge).mul(opened.mul(vb)))
        .add(mix(U.col, U.col2, turn.mul(0.6)).mul(groups.mul(vp)))
        .add(U.col.mul(0.03));
      // Hypnotic. Quiet: broad, slow rings. Build: the rings narrow and gather towards the middle. Peak: three
      // layers of rings spread across the wall, still slow.
      const veil = sin(a.mul(3).add(ph.mul(TAU / 64))).mul(0.5).add(0.5);
      const broad = fall(0.4, 0.1, abs(sin(r.mul(7).sub(ph.mul(TAU / 64)))));
      const inner = float(0.95).sub(rise.mul(0.7));
      const gather = fall(0.22, 0.05, abs(sin(r.mul(rise.mul(26).add(10)).add(ph.mul(TAU / 16))))).mul(fall(inner, inner.mul(0.7), r));
      const layer = (x, shift) => fall(0.25, 0.05, abs(sin(length(p.sub(vec2(x, 0))).mul(14).sub(ph.mul(TAU / 32)).add(shift))));
      const layered = min(layer(-aspect * 0.3, 0).mul(0.45).add(layer(0, 2.1).mul(0.55)).add(layer(aspect * 0.3, 4.2).mul(0.45)), 1);
      const hypnotic = mix(U.col, U.col2, veil).mul(broad.mul(vq).mul(0.45).add(gather.mul(vb).mul(rise.mul(0.35).add(0.45)))
        .add(layered.mul(vp).mul(0.6)).add(veil.mul(0.06)).add(U.kick.mul(0.03)).add(0.025));
      // Melodic. Quiet: one soft ribbon. Build: the ribbons open and warm accents come in. Peak: a fuller set of
      // ribbons, without fast flashes.
      const wave = (amp, freq, beats, shift) => sin(p.x.mul(freq).add(ph.mul(TAU / beats)).add(shift)).mul(amp);
      const soft = fall(0.2, 0.05, abs(p.y.sub(wave(0.16, 2.2, 64, 0))));
      const swing = wave(rise.mul(0.18).add(0.16), 2.8, 64, 0).add(wave(0.08, 7, -32, 0));
      const opening = fall(0.13, 0.03, abs(p.y.sub(swing))).add(fall(0.1, 0.025, abs(p.y.add(swing.mul(0.6)))).mul(rise));
      const full = fall(0.1, 0.025, abs(p.y.sub(wave(0.2, 2.8, 64, 0).add(0.2))))
        .add(fall(0.1, 0.025, abs(p.y.sub(wave(0.22, 3.4, -48, 1.7)))).mul(0.85))
        .add(fall(0.1, 0.025, abs(p.y.sub(wave(0.2, 2.2, 32, 3.4).sub(0.2)))).mul(0.75))
        .add(fall(0.06, 0.015, abs(p.y.sub(wave(0.34, 1.6, 96, 5)))).mul(0.45));
      const warm = smoothstep(0.15, 0.85, cell.x);
      const melodic = mix(U.col, U.col2, warm.mul(0.35)).mul(soft.mul(vq).mul(0.5))
        .add(mix(U.col, U.col2, warm.mul(rise.mul(0.65).add(0.25))).mul(opening.mul(vb).mul(0.7)))
        .add(mix(U.col, U.col2, warm).mul(min(full, 1.4).mul(vp).mul(0.6)))
        .add(U.col.mul(U.kick.mul(0.04).add(0.025)));
      const themed = own.mul(float(1).sub(U.themes.x.add(U.themes.y).add(U.themes.z)))
        .add(industrial.mul(U.themes.x)).add(hypnotic.mul(U.themes.y)).add(melodic.mul(U.themes.z));
      const shown = U.media.sample(cell).rgb.mul(U.kick.mul(0.5).add(0.75)).mul(U.build.mul(0.6).oneMinus()).add(U.col.mul(bar).mul(0.6));
      // A dome is a continuous projection, while a physical LED wall keeps its dots.
      const dots = dome ? float(1) : fall(0.5, 0.25, length(fract(projected.mul(grid)).sub(0.5)));
      const band = swell ? pow(sin(swell.mul(4).sub(U.phase.mul(0.25)).mul(6.2832)).mul(0.5).add(0.5), 2).mul(0.65).add(0.35) : 1;
      return mix(themed, shown, U.mediaOn).mul(dots).mul(U.gain).mul(band).mul(1.6);
    })();
    const wall = many ? new THREE.InstancedMesh(new THREE.PlaneGeometry(width, height), mat, many.length) : new THREE.Mesh(dome ? new THREE.SphereGeometry(1, 72, 24, 0, 6.2832, 0, Math.PI / 2).scale(dome.rx, dome.rise, dome.rz) : new THREE.PlaneGeometry(width, height), mat);
    if (many) { const o = new THREE.Object3D(); many.forEach(([at, towards], i) => { o.position.set(...at); o.lookAt(...towards); o.updateMatrix(); wall.setMatrixAt(i, o.matrix); }); wall.frustumCulled = false; }
    return { object: wall, update(dt, t) {
      const ch = thing.ch;
      U.themes.value.set(...blendTheme(themeWeights, ch.theme || 0, dt));
      U.vj.value.set(...(ch.vj || [1, 0, 0])); U.vjBuild.value = ch.vjBuild || 0;
      wall.visible = !(many && ch.off);   // small screens that are switched off are not there, so that they do not hang in front of what is
      U.time.value = t; U.phase.value = ch.phase || 0; U.kick.value = ch.kick || 0; U.build.value = ch.build || 0;
      // a dome shows only the visuals that fill it: rings, liquid, the tunnel, a sweep (a thin line or a few stars leave it dark)
      U.gain.value = dome ? Math.pow(ch.dim, 0.6) : ch.dim * (see ? 0.7 : 1); U.mode.value = dome ? [0, 6, 2, 6, 0, 2, 6, 7][(ch.mode || 0) & 7] : (ch.mode || 0) + (see ? 3 : 0) & 7;
      U.media.value = env.media || blank(); U.mediaOn.value = env.media && !see ? 1 : 0;
      U.col.value.setRGB(...ch.color); U.col2.value.setRGB(...(ch.color2 || ch.color));
      if (!see && !many) env.wallColor.copy(U.col.value).lerp(U.col2.value, 0.4).multiplyScalar(ch.dim);   // what the wall throws on the stage
    } };
  },
};
let blankTex;
const blank = () => blankTex ||= (() => { const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); tex.userData.shared = true; return tex; })();

// Particles thrown out and pulled down again, each a small spot that faces the camera. Where each one is follows
// from its own four random numbers and how long ago the shot was, so nothing has to be kept for them.
function burst(env, thing, k) {
  const uT = uniform(-1), uA = uniform(new THREE.Color(...k.a)), uB = uniform(new THREE.Color(...(k.b || k.a))), uAt = uniform(new THREE.Vector3(...thing.pos));
  const i = float(instanceIndex), s = vec4(hash(i.add(0.5)), hash(i.mul(1.31).add(7)), hash(i.mul(2.17).add(13)), hash(i.mul(3.7).add(29)));
  const age = uT.sub(s.w.mul(k.emit)), th = s.x.mul(6.2832), up = k.sphere ? s.y.mul(2).sub(1) : s.y.mul(0.45).add(0.55), wide = k.sphere ? sqrt(max(0, up.mul(up).oneMinus())) : s.z;
  const v0 = vec3(cos(th).mul(wide).mul(k.speed[0]), up.mul(k.speed[1]), sin(th).mul(wide).mul(k.speed[2])).mul(s.z.mul(0.45).add(0.55));
  const reach = exp(age.mul(-k.drag)).oneMinus().div(k.drag);
  let p = v0.mul(reach).add(vec3(0, float(k.rise || 0).sub(age.sub(reach).mul(k.gravity / k.drag)), 0));
  if (k.flutter) p = p.add(vec3(sin(age.mul(1.7).add(s.y.mul(40))).mul(0.6), 0, cos(age.mul(1.3).add(s.z.mul(40))).mul(0.6)));
  const alive = step(0, age).mul(step(age, k.life)).mul(step(0.05, p.y.add(thing.pos[1])));
  // never the power of a negative number: on a real graphics card that is not a number, and one such pixel blacks out the whole picture through the glow
  const show = varying(alive.mul(k.flutter ? pow(abs(sin(age.mul(s.z.mul(6).add(5)).add(s.y.mul(30)))), 4).mul(0.75).add(0.25) : pow(max(0, age.div(k.life).oneMinus()), 1.5))), pick = varying(s.y);
  const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: k.blend ?? THREE.AdditiveBlending });
  const far = length(cameraPosition.sub(p.add(uAt)));
  mat.positionNode = p;
  mat.scaleNode = min(max(float(k.size), far.mul(1.5).div(env.uPointScale)), far.mul(0.035)).mul(step(0.01, alive));   // a spark close to the lens stays a spark, not a ball of light
  const round = fall(0.5, 0.1, length(uv().sub(0.5)));
  if (k.flutter) { mat.colorNode = cos(vec3(0, 0.33, 0.67).add(pick).mul(6.2832)).mul(0.5).add(0.5).mul(0.9).mul(show); mat.opacityNode = show; }
  else mat.colorNode = mix(uA, uB, pick).mul(2.5).mul(round).mul(show);
  const object = new THREE.Sprite(mat); object.count = k.count; object.frustumCulled = false;
  return { object, update(dt, t) {
    const age = t - (thing.ch.fire ?? -100);
    object.visible = age >= 0 && age < k.life + k.emit;
    uT.value = age;
    if (k.b === null && !k.flutter) { uA.value.setRGB(...thing.ch.color); uB.value.set(1, 1, 1); }
    if (object.visible && k.light) env.flash([thing.pos[0], thing.pos[1] + (k.rise || 2), thing.pos[2]], 1, 0.8, 0.55, k.light * Math.max(0, 1 - age / (k.life * 0.6 + k.emit)));
  } };
}

export { FIXTURES };
