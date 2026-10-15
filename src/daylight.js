// The time of day: the sky over the venue at night, by day and at sunset, seen through the skylights and the open
// hangar door; the sunlight that falls in through them as shafts in the haze; and what lies outside the door. Driven
// by three numbers the world eases towards the chosen time (env.uDay, env.uSunset, env.uDoor, 0 to 1), so a change
// of time or the door opening goes over gradually and nothing is built again.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { attribute, positionWorld, positionLocal, cameraPosition, frontFacing, vec2, vec3, float, normalize, floor, fract, length, smoothstep, mix, max, min, pow, dot, abs, step, select, mx_noise_float } from 'three/tsl';

// where the sunlight goes (not where the sun is): by day steeply down, towards the stage and a little across; at
// sunset low, from behind the hall through the door and the skylights towards the stage
export const SUN = { day: new THREE.Vector3(0.35, -1, -0.5).normalize(), sunset: new THREE.Vector3(0.12, -0.36, -1).normalize() };
// the time of day as the numbers the world eases to: how much daylight, how much of a sunset
export const TIMES = { night: { day: 0, sunset: 0 }, day: { day: 1, sunset: 0 }, sunset: { day: 0.35, sunset: 1 } };

// The sky in a direction d (a normalised vec3 node), for the time of day in env's uniforms. At night small stars and a
// thin veil of cloud lit faintly by the town; by day blue with white cloud and the glare round the sun; at sunset an
// orange horizon under a violet sky, the cloud lit from below and the sun low in it.
export function skyIn(d, env) {
  const up = max(d.y, 0.02);
  const rnd = v => { const q = fract(v.mul(0.3183099).add(0.1)).mul(17); return fract(q.x.mul(q.y).mul(q.z).mul(q.x.add(q.y).add(q.z))); };
  const star = scale => { const c = d.mul(scale), cell = floor(c), r = rnd(cell); return smoothstep(0.32, 0.02, length(fract(c).sub(0.5))).mul(smoothstep(0.985, 0.998, r)).mul(rnd(cell.add(5)).mul(0.8).add(0.2)); };
  const stars = star(420).mul(0.9).add(star(170).mul(1.6)).mul(smoothstep(0.0, 0.05, d.y));
  const sheet = vec2(d.x, d.z).div(up).mul(0.6);   // the cloud as a layer high above, seen at a slant
  const veil = smoothstep(0.05, 0.75, mx_noise_float(vec3(sheet.x, sheet.y, 1.7)).mul(0.65).add(mx_noise_float(vec3(sheet.x.mul(3.1), sheet.y.mul(3.1), 4.2)).mul(0.35)).add(0.2));
  const town = vec3(0.07, 0.04, 0.018).mul(pow(float(1).sub(up), 14));   // the glow of the town low over the horizon
  const night = mix(mix(vec3(0.012, 0.014, 0.03), vec3(0.004, 0.007, 0.018), pow(up, 0.5)).add(vec3(0.75, 0.8, 1.0).mul(stars)), vec3(0.016, 0.014, 0.018), veil.mul(0.85)).add(town);
  const toSun = s => vec3(-s.x, -s.y, -s.z);
  const dayGlare = pow(max(dot(d, toSun(SUN.day)), 0), 60), setSun = max(dot(d, toSun(SUN.sunset)), 0);
  const day = mix(mix(vec3(0.62, 0.72, 0.84), vec3(0.2, 0.38, 0.75), pow(up, 0.6)), vec3(0.95, 0.95, 0.97), veil.mul(0.85)).add(vec3(1, 0.95, 0.85).mul(dayGlare));
  const glow = pow(setSun, 8).mul(0.3).add(pow(setSun, 900).mul(4));
  const sunset = mix(mix(vec3(1.0, 0.45, 0.18), vec3(0.16, 0.1, 0.26), pow(up, 0.45)), mix(vec3(0.95, 0.42, 0.3), vec3(0.32, 0.18, 0.3), pow(up, 0.5)), veil.mul(0.75)).add(vec3(1, 0.55, 0.22).mul(glow));
  return mix(mix(night, day, env.uDay), sunset, env.uSunset);
}

// A skylight's glass: frosted, as in a working hall, so the sky comes through as a soft, paler light rather than a
// view; seen from below, from wherever the camera is.
export function skylightGlass(env) {
  const mat = new THREE.MeshBasicNodeMaterial({ fog: false });
  const sky = skyIn(normalize(positionWorld.sub(cameraPosition)), env), grey = dot(sky, vec3(0.3, 0.5, 0.2));
  mat.colorNode = mix(sky, vec3(grey), env.uDay.mul(0.45).add(env.uSunset.mul(0.2))).mul(float(1).sub(env.uDay.mul(0.42)).sub(env.uSunset.mul(0.15)));
  return mat;
}

// Shafts of light: from each opening (a rectangle with the half edges u and v round a centre) along the light's
// direction s, as far as each one's length. Each pixel works out how far the line of sight runs through the shaft and
// how dense the light is there, thinning to nothing at the shaft's sides, so it reads as light in haze and not as a
// box: the side towards the camera does it for a camera outside, the far side for a camera inside.
//   openings: [[x, y, z, length]]; weight: a node (0 to 1); colour: [r, g, b]; strength: how bright
export function shafts({ add, env }, openings, u, v, s, weight, colour, strength) {
  if (!openings.length) return;
  const M = new THREE.Matrix3().set(u.x, v.x, s.x, u.y, v.y, s.y, u.z, v.z, s.z), rows = M.clone().invert().transpose().elements;   // rows of the inverse, read as columns
  const row = i => vec3(rows[i * 3], rows[i * 3 + 1], rows[i * 3 + 2]);
  const local = p => vec3(dot(row(0), p), dot(row(1), p), dot(row(2), p));
  const pieces = openings.map(([x, y, z, len]) => {
    const c = new THREE.Vector3(x, y, z), corner = (a, b, t) => c.clone().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(s, t);
    const p = [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0), corner(-1, -1, len), corner(1, -1, len), corner(1, 1, len), corner(-1, 1, len)];
    const faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], pos = [], shaft = [];
    for (const [a, b, cc, dd] of faces) for (const k of [a, b, cc, a, cc, dd]) { pos.push(p[k].x, p[k].y, p[k].z); shaft.push(x, y, z, len); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aShaft', new THREE.Float32BufferAttribute(shaft, 4));
    return g;
  });
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const S = attribute('aShaft', 'vec4'), L = S.w, look = normalize(positionWorld.sub(cameraPosition));
  const O = local(cameraPosition.sub(S.xyz)), R = local(look), inv = vec3(1).div(R.add(step(abs(R), vec3(1e-6)).mul(1e-6)));
  const t1 = vec3(-1, -1, 0).sub(O).mul(inv), t2 = vec3(1, 1, L).sub(O).mul(inv), lo = min(t1, t2), hi = max(t1, t2);
  const near = max(max(lo.x, lo.y), max(lo.z, 0)), far = min(min(hi.x, hi.y), hi.z), through = max(far.sub(near), 0);
  const inside = step(abs(O.x), 1).mul(step(abs(O.y), 1)).mul(step(0, O.z)).mul(step(O.z, L));
  const counts = select(frontFacing, float(1), inside);   // each line of sight once
  const mid = O.add(R.mul(near.add(far).mul(0.5))), edge = vec2(mid.x, mid.y).mul(vec2(mid.x, mid.y));
  const profile = max(float(1).sub(edge.x), 0).mul(max(float(1).sub(edge.y), 0)).pow(2);   // dense in the middle, nothing at the sides
  const along = float(1).sub(mid.z.div(L).clamp(0, 1)).mul(0.65).add(0.35);
  const dust = mx_noise_float(cameraPosition.add(look.mul(near.add(far).mul(0.5))).mul(0.22).add(vec3(env.uTime.mul(0.04), 0, env.uTime.mul(0.025)))).mul(0.45).add(0.8);
  mat.colorNode = vec3(...colour).mul(weight).mul(env.uSunHaze).mul(through).mul(profile).mul(along).mul(dust).mul(counts).mul(strength);
  const mesh = add(new THREE.Mesh(mergeGeometries(pieces), mat)); mesh.renderOrder = 1; mesh.frustumCulled = false;
  return mesh;
}

// Outside the open hangar door: the sky all round, the apron, and across the airfield hangars, a tower and trees. Only
// drawn while the door is open, and seen only through it. door: [x, z] of its middle, the hall's floor at 0.
export function outside({ add, env }, door) {
  const group = add(new THREE.Group());
  const sky = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  sky.colorNode = skyIn(normalize(positionLocal), env);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), sky); dome.renderOrder = -10; group.add(dome);
  // the apron: concrete, as light as the sky makes it
  const apron = new THREE.MeshBasicNodeMaterial({ fog: false }), dark = mx_noise_float(positionWorld.mul(0.08)).mul(0.15).add(0.85);
  apron.colorNode = mix(mix(vec3(0.006, 0.007, 0.01), vec3(0.32, 0.32, 0.31), env.uDay), vec3(0.3, 0.17, 0.1), env.uSunset).mul(dark);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(1200, 600).rotateX(-Math.PI / 2).translate(door[0], -0.02, door[1] + 300), apron));
  // Across the airfield: other hangars, a tower and trees, far enough to be grey in the haze, the colour of the sky
  // low down behind them; at night dark, with red lights on their roofs and the airfield's lights along the ground.
  const far = [], lights = [], rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const at = (a, r) => [door[0] + Math.sin(a) * r, door[1] + Math.cos(a) * r];
  for (let i = 0; i < 70; i++) {   // trees: a ragged band
    const a = (i / 70 - 0.5) * 2.4, r = 420 + rnd(i, 1) * 80, [x, z] = at(a, r), h = 14 + rnd(i, 2) * 12;
    far.push(new THREE.SphereGeometry(1, 7, 5).scale(14 + rnd(i, 3) * 10, h, 12).translate(x, h * 0.4, z));
  }
  for (let i = 0; i < 9; i++) {   // hangars and a few buildings, with a light on each roof
    const a = (i / 8 - 0.5) * 1.6 + (rnd(i, 4) - 0.5) * 0.15, r = 260 + rnd(i, 5) * 90, [x, z] = at(a, r), w = 40 + rnd(i, 6) * 50, h = 12 + rnd(i, 7) * 12;
    far.push(new THREE.BoxGeometry(w, h, 30).rotateY(a).translate(x, h / 2, z));
    lights.push(new THREE.SphereGeometry(1.6, 6, 4).translate(x, h + 1, z));
  }
  const [tx, tz] = at(0.35, 330);   // the control tower, its cab lit
  far.push(new THREE.CylinderGeometry(3, 4, 32, 10).translate(tx, 16, tz), new THREE.CylinderGeometry(7, 5, 5, 10).translate(tx, 34.5, tz));
  lights.push(new THREE.SphereGeometry(1.2, 6, 4).translate(tx, 38, tz));
  const look = normalize(positionWorld.sub(cameraPosition)), haze = new THREE.MeshBasicNodeMaterial({ fog: false });
  haze.colorNode = skyIn(normalize(vec3(look.x, 0.03, look.z)), env).mul(mix(mix(float(0.2), float(0.5), env.uDay), float(0.22), env.uSunset));   // grey in the haze by day, dark against a sunset
  group.add(new THREE.Mesh(mergeGeometries(far.map(g => g.toNonIndexed())), haze));
  const lamps = new THREE.MeshBasicNodeMaterial({ fog: false });
  lamps.colorNode = vec3(3, 0.25, 0.15).mul(float(1).sub(env.uDay.mul(0.8)));
  group.add(new THREE.Mesh(mergeGeometries(lights), lamps));
  return group;
}
