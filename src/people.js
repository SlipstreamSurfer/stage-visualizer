// People: the figure everyone in a venue is made of, and what it does. One figure, built from a few shaped parts,
// facing -z (the stage). Every vertex says what it is part of (shirt, skin, trousers, hair, shoes, sleeve), so each
// person gets their own clothes, skin and hair from a few random numbers; and whether it belongs to an arm, which
// bends at the elbow. Everyone dances in their own way. The moves are a node material (TSL).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, varying, positionGeometry, positionWorld, normalWorld, cameraPosition, uniform, float, vec2, vec3, vec4, sin, cos, fract, step, mix, smoothstep, select, max, dot, normalize, sign, abs, pow, clamp, length } from 'three/tsl';

const SHIRT = 0, SKIN = 1, TROUSERS = 2, HAIR = 3, SHOES = 4, SLEEVE = 5, CUP = 6;   // SLEEVE: the forearm, bare or covered; CUP: a drink in the hand
const SHOULDER_X = 0.245, SHOULDER_Y = 1.38, UPPER_ARM = 0.3;
// mostly black, as at any techno night, with the odd white or coloured shirt
export const SHIRTS = [0x101013, 0x101013, 0x101013, 0x121216, 0x16161a, 0x1c1c22, 0x1c1c22, 0x221f1e, 0x2a2a30, 0x33302d, 0x45454a, 0x606060, 0x8a8a8a, 0xc8c8c8, 0x4a1414, 0x14203c, 0x1c3024,
  0x0e0e10, 0x3a2a1c, 0x2c3a2a, 0x5a4a3a, 0xe0ddd5, 0x7a1e1e, 0x1e3a5a, 0x4a3a5a, 0x2a4a4a, 0x8a6a2a, 0xb0b8c0];

const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const at = (g, x, y, z) => (g.translate(x, y, z), g);
const between = (ax, ay, az, bx, by, bz, r1, r2, seg) => {
  va.set(ax, ay, az); vb.set(bx, by, bz);
  const g = new THREE.CylinderGeometry(r2, r1, va.distanceTo(vb), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, vc.subVectors(vb, va).normalize()));
  return at(g, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
};
const tag = (g, arm, part) => {
  const n = g.attributes.position.count;
  g.setAttribute('aArm', new THREE.Float32BufferAttribute(new Float32Array(n).fill(arm), 1));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  return g;
};

// The figure at three levels of detail (DETAIL): the same parts in the same places, with fewer sides the further
// away it is drawn. Far off a head is a few pixels, and its twelve sides are work nobody sees.
export const DETAIL = [
  { head: [12, 8], body: 12, limb: 8, joint: [8, 6], hand: [8, 5], cup: 8 },   // near
  { head: [8, 6], body: 8, limb: 6, joint: [6, 4], hand: [6, 4], cup: 6 },     // a little way off
  { head: [6, 5], body: 6, limb: 4, joint: [4, 3], hand: [4, 3], cup: 4 },     // far
];
export function personGeo(level = 0) {
  const d = DETAIL[level];
  const head = tag(at(new THREE.SphereGeometry(0.092, ...d.head).scale(0.9, 1.2, 1), 0, 1.625, 0), 0, SKIN);
  for (let i = 0, pos = head.attributes.position; i < pos.count; i++) if (pos.getZ(i) > -0.03 || pos.getY(i) > 1.678) head.attributes.aPart.setX(i, HAIR);   // the back and top of the head
  const torso = new THREE.LatheGeometry([[0.001, 0.84], [0.14, 0.86], [0.172, 0.97], [0.15, 1.12], [0.168, 1.27], [0.2, 1.37], [0.17, 1.435], [0.07, 1.47], [0.058, 1.54], [0.001, 1.54]].map(p => new THREE.Vector2(p[0], p[1])), d.body).scale(1, 1, 0.62);
  const parts = [tag(torso, 0, SHIRT), head];
  for (const side of [-1, 1]) {
    const sx = side * SHOULDER_X;
    parts.push(
      tag(between(side * 0.085, 0.92, 0, side * 0.095, 0.5, -0.01, 0.088, 0.062, d.limb), 0, TROUSERS), tag(between(side * 0.095, 0.5, -0.01, side * 0.095, 0.07, 0.015, 0.06, 0.04, d.limb), 0, TROUSERS),
      tag(at(new THREE.BoxGeometry(0.09, 0.07, 0.25), side * 0.095, 0.035, -0.045), 0, SHOES), tag(at(new THREE.SphereGeometry(0.058, ...d.joint), side * 0.235, 1.375, 0), 0, SHIRT),
      tag(between(sx, SHOULDER_Y, 0, sx, SHOULDER_Y - UPPER_ARM, 0, 0.052, 0.043, d.limb), side, SHIRT),
      tag(between(sx, SHOULDER_Y - UPPER_ARM, 0, sx, SHOULDER_Y - UPPER_ARM * 2, 0, 0.042, 0.033, d.limb), side, SLEEVE),
      tag(at(new THREE.SphereGeometry(0.048, ...d.hand).scale(0.8, 1.25, 1), sx, SHOULDER_Y - UPPER_ARM * 2 - 0.045, 0), side, SKIN));
  }
  parts.push(tag(at(new THREE.CylinderGeometry(0.036, 0.028, 0.115, d.cup), SHOULDER_X, SHOULDER_Y - UPPER_ARM * 2 - 0.06, -0.04), 1, CUP));   // a cup in the right hand (folded away for whoever has none)
  const geo = mergeGeometries(parts); geo.deleteAttribute('uv');
  return geo;
}

const SX = SHOULDER_X, SY = SHOULDER_Y, UPPER = UPPER_ARM;
const rnd = n => fract(sin(n.mul(91.7)).mul(4375.85));
// a turn in a plane: the two coordinates of that plane, turned by an angle
const turn = (a, b, angle) => { const c = cos(angle), s = sin(angle); return [c.mul(a).sub(s.mul(b)), s.mul(a).add(c.mul(b))]; };
const fall = (from, to, x) => smoothstep(to, from, x).oneMinus();   // 1 below `to`, 0 above `from`

// What all people share: the time, the beat as a clock, how many hands are up, how wild it is, how much everyone
// moves, how many are filming, the light that catches heads and shoulders from the stage (rim), and the light the
// stage throws on everyone who faces it (front): the LED wall is the biggest lamp in the room.
export const peopleU = () => ({ time: uniform(0), dance: uniform(0), hands: uniform(0), hype: uniform(0), groove: uniform(0.3), film: uniform(0), rim: uniform(new THREE.Color(0)), front: uniform(new THREE.Color(0)), stage: uniform(new THREE.Vector3(0, 7, -20)),
  bounce: uniform(1), rock: uniform(1), half: uniform(0.3), jump: uniform(1), chest: uniform(0.1), oneArm: uniform(0.3) });   // the way of dancing: see dance.js

// What belongs to one person travels in one buffer (WebGPU allows eight vertex buffers a mesh): four random numbers
// (phase, eagerness, bounce, freedom of the arms), where they stand (x, z, the way they face, their size), their
// shirt, how broad they are, how packed it is around them, two numbers more: for someone who walks their stride
// and how much they are moving, for anyone else how high they are off the ground and whether they sit; and what they
// wear over the shirt (KIT).
const EACH = 16, FIELDS = [['aSeed', 4, 0], ['aPlace', 4, 4], ['aShirt', 3, 8], ['aBuild', 1, 11], ['aDense', 1, 12], ['aWalk', 2, 13], ['aKit', 1, 15]];
// over the shirt: nothing, or the high-visibility vest of security (yellow) or first aid (green), with two bands that
// reflect and the word on the back. Part of the figure, so it moves with it.
export const KIT = { none: 0, security: 1, medic: 2 };
// A crowd of n figures drawn in one go. put(i, ...) places one; moving: they are placed again every frame.
// lod: drawn at the three levels of detail, each person at the one the camera asks for (view below); otherwise
// everyone at the first.
//
// What the setters write is kept here, whole; what the card draws is a copy per level of detail, of the people at
// that level only. view(camera, height) sorts the crowd again when the camera has moved or turned, or when
// someone or the distances in detail were changed: by how big a person shows (their distance, the camera's angle of view and the height of
// the picture in pixels), and leaving out whoever is out of the picture or folded away (size 0).
const NEAR = 13, MID = 27, ROOM = 1.6;   // metres from the camera at which a person is drawn with less detail, at 1080 pixels and 50 degrees; how far round a person counts as in the picture
export function people(material, n, moving = false, lod = false) {
  const N = Math.max(1, n), data = new Float32Array(N * EACH), matrices = new Float32Array(N * 16), o = new THREE.Object3D();
  const levels = (lod ? DETAIL : DETAIL.slice(0, 1)).map((_, level) => {
    const geo = personGeo(level), own = lod ? new Float32Array(N * EACH) : data, buffer = new THREE.InstancedInterleavedBuffer(own, EACH);
    if (moving) buffer.setUsage(THREE.DynamicDrawUsage);
    for (const [name, size, at] of FIELDS) geo.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, size, at));
    const mesh = new THREE.InstancedMesh(geo, material, N);
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(lod ? new Float32Array(N * 16) : matrices, 16);   // three turns the normals with this
    if (lod) { buffer.setUsage(THREE.DynamicDrawUsage); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    mesh.count = lod ? 1 : n; mesh.frustumCulled = false;   // sorted: one folded-away figure until the first view, so the warm-up still builds what it draws with
    return { mesh, own, buffer };
  });
  const group = new THREE.Group(); for (const l of levels) group.add(l.mesh);
  let dirty = true;
  const was = new THREE.Vector3(1e9, 0, 0), looked = new THREE.Vector3(), dir = new THREE.Vector3(), frustum = new THREE.Frustum(), sphere = new THREE.Sphere(), seen = new THREE.Matrix4();
  let wasFov = 0, wasHeight = 0, wasDetail = '';
  const detail = { near: NEAR, mid: MID };   // the distances, for comparing: Infinity for both draws everyone at full detail
  return { mesh: group, data, levels: levels.map(l => l.mesh), detail,
    seed(i, a, b, c, d) { data.set([a, b, c, d], i * EACH); },
    shirt(i, colour) { data.set([colour.r, colour.g, colour.b], i * EACH + 8); },
    kit(i, kind) { data[i * EACH + 15] = kind; },
    dense(i, v) { data[i * EACH + 12] = v; },
    walk(i, stride, amount) { data[i * EACH + 13] = stride; data[i * EACH + 14] = amount; },
    sit(i, y, seated) { data[i * EACH + 13] = y; data[i * EACH + 14] = seated ? 1 : 0; },
    put(i, x, z, yaw, size, build = 1) {
      data.set([x, z, yaw, size], i * EACH + 4); data[i * EACH + 11] = build;
      o.position.set(x, 0, z); o.rotation.set(0, yaw, 0); o.scale.set(size * build, size, size * build); o.updateMatrix(); o.matrix.toArray(matrices, i * 16);
    },
    moved() { dirty = true; if (!lod) { levels[0].buffer.needsUpdate = true; levels[0].mesh.instanceMatrix.needsUpdate = true; } },
    view(camera, height) {
      if (!lod) return;
      camera.getWorldDirection(dir);
      const key = detail.near + ' ' + detail.mid;
      if (!dirty && camera.position.distanceToSquared(was) < 0.04 && dir.dot(looked) > 0.9995 && camera.fov === wasFov && height === wasHeight && key === wasDetail) return;
      dirty = false; wasDetail = key; was.copy(camera.position); looked.copy(dir); wasFov = camera.fov; wasHeight = height;
      camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(seen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const scale = Math.tan(camera.fov * Math.PI / 360) / Math.tan(25 * Math.PI / 180) * 1080 / Math.max(1, height), cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      const count = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const k = i * EACH, x = data[k + 4], z = data[k + 5], size = data[k + 7], y = data[k + 13] + 1;   // their middle: on a tier or a balcony, that far up
        if (!size) continue;
        sphere.center.set(x, y, z); sphere.radius = ROOM;
        if (!frustum.intersectsSphere(sphere)) continue;
        const far = Math.hypot(x - cx, y - cy, z - cz) * scale, level = far < detail.near ? 0 : far < detail.mid ? 1 : 2, l = levels[level], at = count[level]++;
        l.own.set(data.subarray(k, k + EACH), at * EACH); l.mesh.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), at * 16);
      }
      levels.forEach((l, level) => { l.mesh.count = count[level]; l.buffer.needsUpdate = true; l.mesh.instanceMatrix.needsUpdate = true; });
    } };
}

// light: the world's function for the light of the beams on a point; U: from peopleU; walking: true for walkers
export function peopleMaterial({ light, U, walking = false }) {
  const aArm = attribute('aArm', 'float'), aPart = attribute('aPart', 'float'), aSeed = attribute('aSeed', 'vec4'), aDense = attribute('aDense', 'float'), aPlace = attribute('aPlace', 'vec4'), aBuild = attribute('aBuild', 'float'), aShirt = attribute('aShirt', 'vec3'), aWalk = attribute('aWalk', 'vec2'), aKit = attribute('aKit', 'float');
  // who holds a drink: about one in three; for the rest the cup is folded into the hand
  const drink = step(rnd(aSeed.y.add(21)), 0.32), cupPart = step(5.5, aPart);
  const pos = mix(positionGeometry, vec3(SX, SY - UPPER * 2 - 0.05, 0), cupPart.mul(drink.oneMinus())), h = pos.y;
  const isArm = aArm.notEqual(0), side = sign(aArm), shoulder = vec3(side.mul(SX), SY, 0), p0 = pos.sub(shoulder), q0 = p0.add(vec3(0, UPPER, 0)), forearm = p0.y.lessThan(-(UPPER + 0.01));
  let moved, open;
  if (walking) {
    // aWalk is this person's stride (x) and how much they are moving (y, 0 when standing still)
    const stride = aWalk.x, sw = sin(stride).mul(aWalk.y);
    const [qy, qz] = turn(q0.y, q0.z, max(0, side.mul(sw)).mul(0.3).add(0.3));
    const p1 = select(forearm, vec3(q0.x, qy.sub(UPPER), qz), p0);
    const [ay, az] = turn(p1.y, p1.z, side.negate().mul(sw).mul(0.4));   // arms swing against the legs
    const [ax, ay2] = turn(p1.x, ay, side.mul(0.07));
    const [ly, lz] = turn(h.sub(0.92), pos.z, sign(pos.x).mul(sw).mul(0.42));   // each leg swings from the hip
    const body = select(isArm, vec3(ax, ay2, az).add(shoulder), select(h.lessThan(0.93), vec3(pos.x, ly.add(0.92), lz), pos));
    moved = body.add(vec3(0, abs(cos(stride)).mul(0.025).mul(aWalk.y), 0));
    open = float(1);
  } else {
    // Everyone dances to the same music but in their own way: on the beat or in half time, a little ahead or behind
    // and drifting, with their own mix of moves, and joining in or easing off at their own moment.
    const halfTime = step(rnd(aSeed.y.add(6)), U.half);
    const drift = sin(U.time.mul(rnd(aSeed.x.add(7)).mul(0.1).add(0.05)).add(aSeed.y.mul(40))).mul(0.12);
    const ph = U.dance.mul(halfTime.mul(-0.5).add(1)).add(aSeed.x.sub(0.5).mul(0.45)).add(drift).add(halfTime.mul(0.5).mul(step(0.5, rnd(aSeed.x.add(8)))));
    const cBeat = fract(ph), pump = cos(cBeat.mul(6.2832)).mul(-0.5).add(0.5);                       // down and up once a beat
    const rock = sin(ph.mul(3.14159).add(step(0.5, rnd(aSeed.y.add(9))).mul(3.14159)));              // from one foot to the other
    const mine = rnd(aSeed.x.add(10)).mul(0.8), lively = mix(0.25, 1, smoothstep(mine.sub(0.25), mine.add(0.25), U.groove));   // nobody ever stands dead still
    // the arms: hanging and swinging with the beat, or raised and pumping; the forearm bends at the elbow
    const free = aSeed.w, v1 = fract(aSeed.x.mul(7.3)), v2 = fract(aSeed.y.mul(5.1).add(0.3));
    const thr = select(aArm.lessThan(0), aSeed.y, fract(aSeed.y.mul(1.7).add(0.13)));
    const oneArm = step(rnd(aSeed.w.add(aSeed.x).add(3)), U.oneArm).mul(step(aArm, 0));   // the left arm stays down for whoever raises one
    const raised = smoothstep(thr.sub(0.08), thr.add(0.08), U.hands).mul(oneArm.oneMinus());
    const sit = aWalk.y, up = select(free.equal(0).and(aArm.greaterThan(0)), max(raised, U.film), raised).mul(sit.oneMinus());   // someone filming holds a phone up; whoever sits keeps their hands down
    // hands at the chest: the elbow bent up and the arm a little forward, the hands going with the beat
    const chest = up.oneMinus().mul(step(rnd(aSeed.x.add(aSeed.y).add(15)), U.chest)).mul(sit.oneMinus());
    const [qy, qz] = turn(q0.y, q0.z, mix(up.oneMinus().mul(v1.mul(0.6).add(0.35).add(pump.mul(0.3).mul(lively).mul(free))), pump.mul(0.3).mul(lively).add(2.05), chest));
    const [qx, qy2] = turn(q0.x, qy, side.mul(up).mul(v1.sub(0.5).mul(0.6).add(cos(cBeat.mul(6.2832)).mul(0.3)).mul(free).add(0.58)));
    const [cx, cz] = turn(qx, qz, side.negate().mul(chest).mul(0.65));   // and turned in, so the hands meet in front of the chest
    const p1 = select(forearm, vec3(cx, qy2.sub(UPPER), cz), p0);
    const [ax, ay] = turn(p1.x, p1.y, side.mul(up.mul(v2.sub(0.5).mul(0.7).mul(free).add(2.42)).add(0.07)));
    const [ay2, az] = turn(ay, p1.z, up.negate().mul(v1.mul(0.35).mul(free).add(0.25)).add(up.oneMinus().mul(0.12).mul(rock).mul(side).mul(lively).mul(free)).sub(chest.mul(0.3)));
    // sitting: the thighs forward, the shins down, and everything else as much lower as a shin is long
    const seatedLeg = select(h.lessThan(0.5), vec3(pos.x, h.add(0.42), pos.z.sub(0.42)), vec3(pos.x, float(0.92).sub(pos.z), h.sub(0.92)));
    const body = select(isArm, vec3(ax, ay2, az).add(shoulder), select(h.lessThan(0.93), mix(pos, seatedLeg, sit), pos));
    // dancing: the feet stay put while the knees give on the beat, the weight shifts and the head nods
    const above = smoothstep(0.05, 1.0, h), move = aSeed.z.mul(lively).mul(sit.mul(-0.7).add(1)), knees = move.mul(U.bounce), sway = move.mul(U.rock);
    const [tx, tz] = turn(body.x, body.z, rock.mul(0.22).mul(rnd(aSeed.y.add(11))).mul(sway).mul(smoothstep(0.8, 1.4, h)));
    moved = vec3(
      tx.add(rock.mul(rnd(aSeed.x.add(12)).mul(0.05).add(0.025)).mul(sway).mul(above)).add(sin(U.time.mul(1.1).add(aSeed.x.mul(50))).mul(0.012).mul(h)),
      body.y.sub(pump.mul(rnd(aSeed.y.add(13)).mul(0.045).add(0.025)).mul(knees).mul(above)).add(U.hype.mul(U.jump).mul(1.6).mul(cBeat).mul(cBeat.oneMinus()).mul(step(aSeed.y, 0.8)).mul(sit.oneMinus())).sub(sit.mul(0.45)),   // and jumping, when the room goes off
      tz.sub(pump.mul(rnd(aSeed.x.add(14)).mul(0.045).add(0.015)).mul(knees).mul(smoothstep(1.2, 1.75, h))));
    // deep in a packed crowd little light gets past the heads and shoulders; a raised arm is out in the light
    open = mix(mix(1, mix(0.22, 1, smoothstep(0.5, 1.5, h)), aDense), 1, select(isArm, up, 0));
  }

  // what each part of the figure is made of: shirt from the person's own colour, the rest from a few random numbers
  const skin = mix(vec3(0.62, 0.44, 0.35), vec3(0.2, 0.13, 0.1), rnd(aSeed.x.add(1))), hairPick = rnd(aSeed.y.add(2));
  const hair = select(hairPick.lessThan(0.38), vec3(0.015, 0.012, 0.01), select(hairPick.lessThan(0.62), vec3(0.07, 0.04, 0.025), select(hairPick.lessThan(0.74), vec3(0.3, 0.22, 0.11), select(hairPick.lessThan(0.78), vec3(0.2, 0.05, 0.03), select(hairPick.lessThan(0.83), vec3(0.35, 0.34, 0.33), select(hairPick.lessThan(0.9), vec3(0.02, 0.02, 0.025), skin))))));   // black, brown, blond, red, grey, a black cap, shaven
  const tPick = rnd(aSeed.x.add(3)), trousers = select(tPick.lessThan(0.5), vec3(0.012, 0.012, 0.015), select(tPick.lessThan(0.75), vec3(0.035, 0.05, 0.09), select(tPick.lessThan(0.85), vec3(0.09, 0.08, 0.06), vec3(0.06, 0.06, 0.065))));   // black, jeans, khaki, grey
  const cPick = rnd(aSeed.x.add(22)), cup = select(cPick.lessThan(0.6), vec3(0.75, 0.5, 0.12), select(cPick.lessThan(0.8), vec3(0.08, 0.04, 0.03), vec3(0.6, 0.65, 0.7)));   // beer, cola, water
  const shoes = select(rnd(aSeed.y.add(4)).lessThan(0.75), vec3(0.02), vec3(0.55)), bare = step(0.35, rnd(aSeed.x.add(5)));
  const part = varying(select(aPart.lessThan(0.5), vec4(0), select(aPart.lessThan(1.5), vec4(skin, 1), select(aPart.lessThan(2.5), vec4(trousers, 1), select(aPart.lessThan(3.5), vec4(hair, 1), select(aPart.lessThan(4.5), vec4(shoes, 1), select(aPart.lessThan(5.5), vec4(skin, bare), vec4(cup, 1))))))));
  const openTo = varying(open), shirt = varying(aShirt);
  // a face: eyes, brows and a mouth, enough to read as one from the pit
  const f = varying(positionGeometry);
  const eyes = fall(0.016, 0.008, length(vec2(abs(f.x).sub(0.031), f.y.sub(1.642).mul(1.3))));
  const brows = fall(0.006, 0.002, abs(f.y.sub(1.664))).mul(fall(0.052, 0.036, abs(f.x))).mul(step(0.012, abs(f.x)));
  const mouth = fall(0.007, 0.002, abs(f.y.sub(1.577))).mul(fall(0.03, 0.02, abs(f.x)));
  const face = step(f.z, -0.035).mul(step(1.5, f.y)).mul(part.a).mul(eyes.mul(0.8).add(brows.mul(0.5)).add(mouth.mul(0.55))).oneMinus();
  // a vest: over the body from the hips to the shoulders, not over the sleeves; reflecting bands round the middle,
  // and on the back, between the shoulder blades, the word in black
  const kit = varying(aKit), armOf = varying(aArm), body = step(abs(armOf), 0.5).mul(step(0.95, f.y)).mul(step(f.y, 1.46)).mul(step(abs(f.x), 0.19));
  const bands = step(0.5, fall(0.022, 0.016, abs(f.y.sub(1.06))).add(fall(0.022, 0.016, abs(f.y.sub(1.17))))), word = step(0, f.z).mul(step(1.27, f.y)).mul(step(f.y, 1.34)).mul(step(abs(f.x), 0.12));
  const vestColour = mix(mix(vec3(0.8, 0.68, 0.03), vec3(0.08, 0.42, 0.14), step(1.5, kit)), vec3(0.62, 0.64, 0.66), bands).mul(word.mul(-0.94).add(1));
  const clothes = mix(shirt, vestColour, body.mul(step(0.5, kit)));
  const albedo = mix(clothes, part.rgb, part.a).mul(face);

  // A position node replaces what three worked out for the instance, so each person is put in their own place here.
  const wide = aPlace.w.mul(aBuild), [wx, wz] = turn(moved.x.mul(wide), moved.z.mul(wide), aPlace.z.negate());
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
  material.positionNode = vec3(wx.add(aPlace.x), moved.y.mul(aPlace.w).add(walking ? 0 : aWalk.x), wz.add(aPlace.y));
  material.colorNode = albedo.mul(openTo.mul(0.8).add(0.2));
  // the beams; the light the stage throws on everyone who faces it; and backlit silhouettes: a bright edge on heads
  // and shoulders where a figure stands between the camera and the stage
  const toStage = U.stage.sub(positionWorld), toCam = normalize(cameraPosition.sub(positionWorld)), n = normalWorld;
  const front = U.front.mul(max(dot(n, normalize(toStage)), 0)).mul(mix(0.45, 1, openTo)).div(dot(toStage, toStage).mul(0.0009).add(1));
  const rim = U.rim.mul(pow(clamp(abs(dot(n, toCam)).oneMinus(), 0, 1), 3.5)).mul(max(dot(toCam.negate(), normalize(toStage)), 0)).mul(smoothstep(0.7, 1.6, positionWorld.y));
  material.emissiveNode = light(positionWorld, n).mul(1.9).mul(albedo.add(0.03)).mul(openTo).add(front.mul(albedo.add(0.02))).add(rim);
  return material;
}

// a soft shadow on the floor under a figure
export function shadowMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false });
}
