// Shapes: the few ways of making geometry that the world, the shell and the stage share. Everything is in metres.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { heightAt } from './layout.js';

const UP = new THREE.Vector3(0, 1, 0), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);

export const box = (w, h, d, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); return g.translate(x, y, z); };
// a round post standing on the ground
export const post = (r, h, x, z, y = 0, sides = 12, top = r) => new THREE.CylinderGeometry(top, r, h, sides).translate(x, y + h / 2, z);
// a box from one point to another
export function strut(p, r, thick, out) {
  a3.set(...p); b3.set(...r);
  const len = a3.distanceTo(b3), g = new THREE.BoxGeometry(thick, len, thick);
  q.setFromUnitVectors(UP, b3.clone().sub(a3).normalize());
  g.applyMatrix4(m4.compose(a3.add(b3).multiplyScalar(0.5), q, one));
  out?.push(g);
  return g;
}
// a box truss from a to b: four chords, a square frame every bay and a diagonal on two faces
export function truss([a, b], out, size = 0.42) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), along = B.clone().sub(A), len = along.length(), dir = along.clone().normalize();
  const upright = Math.abs(dir.y) > 0.9;   // a tower
  const side = new THREE.Vector3().crossVectors(dir, upright ? new THREE.Vector3(0, 0, 1) : UP).normalize().multiplyScalar(size / 2), up = new THREE.Vector3().crossVectors(side, dir).normalize().multiplyScalar(size / 2);
  const corner = (k, sx, sy) => A.clone().addScaledVector(dir, k).addScaledVector(side, sx).addScaledVector(up, sy).toArray();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) strut(corner(0, sx, sy), corner(len, sx, sy), 0.05, out);
  const bays = Math.max(1, Math.round(len / 0.9));
  for (let i = 0; i <= bays; i++) {
    const k = len * i / bays, k2 = len * (i + 1) / bays, f = i % 2 ? 1 : -1;
    strut(corner(k, -1, -1), corner(k, 1, -1), 0.03, out); strut(corner(k, -1, 1), corner(k, 1, 1), 0.03, out);
    strut(corner(k, -1, -1), corner(k, -1, 1), 0.03, out); strut(corner(k, 1, -1), corner(k, 1, 1), 0.03, out);
    if (i < bays) { strut(corner(k, -1, f), corner(k2, -1, -f), 0.025, out); strut(corner(k, 1, f), corner(k2, 1, -f), 0.025, out); strut(corner(k, f, 1), corner(k2, -f, 1), 0.025, out); }
  }
}

// A line array, flown the way a PA company hangs one: a frame on two chain hoists, and under it the cabinets, each
// tilted a little more than the one above, so the hang curves like a J and reaches from the front rows to the back.
// Geometry in metres by what it is made of: { body, grille, rig }.
//   top: [x, y, z] of the frame; n cabinets of w × h × d facing +z; splay(i): degrees between cabinet i and the one
//   above it; turn: the hang turned about the vertical, towards +x for a positive angle; roof: where the chains go up to
export function lineArray({ top: [x, y, z], n, w, h, d, splay = () => 0, turn = 0, roof = null }) {
  const body = [], grille = [], rig = [], pivot = new THREE.Vector3(0, -0.14, -d / 2), drop = new THREE.Vector3();
  const set = g => g.rotateY(turn).translate(x, y, z);
  let angle = 0;
  for (let i = 0; i < n; i++) {
    angle += splay(i) * Math.PI / 180;
    // the cabinet hangs from its top back edge, which is where the one above it ends
    const hang = g => set(g.translate(0, -h / 2, d / 2).rotateX(angle).translate(pivot.x, pivot.y, pivot.z));
    body.push(hang(new THREE.BoxGeometry(w, h - 0.008, d)));
    grille.push(hang(new THREE.PlaneGeometry(w - 0.05, h - 0.05).translate(0, 0, d / 2 + 0.003)));
    pivot.add(drop.set(0, -h, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), angle));
  }
  rig.push(set(new THREE.BoxGeometry(w + 0.18, 0.1, d + 0.12).translate(0, -0.05, 0)));   // the frame
  for (const k of [-0.32, 0.32]) {
    rig.push(set(new THREE.BoxGeometry(0.02, 0.7, 0.02).translate(k * w, 0.35, 0)), set(new THREE.BoxGeometry(0.26, 0.36, 0.26).translate(k * w, 0.88, 0)));   // chain to the hoist
    if (roof) rig.push(set(new THREE.BoxGeometry(0.02, roof - y - 1.06, 0.02).translate(k * w, 1.06 + (roof - y - 1.06) / 2, 0)));   // and the hoist's chain to the roof
  }
  return { body, grille, rig };
}

// a flat piece between points given in order round its edge, [[x, y, z], ...]; coordinates for a surface are the
// distance along the first edge and across it, in metres
export function patch(points, flip = false, v0 = 0) {
  const g = new THREE.BufferGeometry(), pos = [], uv = [], o = new THREE.Vector3(...points[0]), u = new THREE.Vector3(...points[1]).sub(o).normalize();
  const n = new THREE.Vector3().crossVectors(u, new THREE.Vector3(...points[points.length - 1]).sub(o)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
  const tri = (i, j, k) => { for (const p of flip ? [i, k, j] : [i, j, k]) { pos.push(...points[p]); a3.set(...points[p]).sub(o); uv.push(a3.dot(u), a3.dot(w) + v0); } };
  for (let i = 1; i + 1 < points.length; i++) tri(0, i, i + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.computeVertexNormals();
  return g;
}
// A line across (profile: [[x, y], ...]) carried from z0 to z1: a vault, a pitched roof, a row of steps. along: 'z',
// or 'x' to carry a [z, y] line from x0 to x1. Its coordinates for a surface run on from strip to strip, in metres.
export function sweep(profile, from, to, along = 'z') {
  const parts = [];
  for (let i = 0, run = 0; i + 1 < profile.length; i++) {
    const [a, ay] = profile[i], [b, by] = profile[i + 1];
    parts.push(patch(along === 'z' ? [[a, ay, from], [a, ay, to], [b, by, to], [b, by, from]] : [[from, ay, a], [to, ay, a], [to, by, b], [from, by, b]], false, run));
    run += Math.hypot(b - a, by - ay);
  }
  return mergeGeometries(parts);
}
// a line resampled into n pieces of equal length: [{ x, y, angle, length }, ...]
export function pieces(profile, n) {
  const lens = profile.slice(1).map((p, i) => Math.hypot(p[0] - profile[i][0], p[1] - profile[i][1])), total = lens.reduce((a, b) => a + b, 0), at = d => { let i = 0; while (i < lens.length - 1 && d > lens[i]) d -= lens[i++]; const k = lens[i] ? Math.min(1, d / lens[i]) : 0; return [profile[i][0] + (profile[i + 1][0] - profile[i][0]) * k, profile[i][1] + (profile[i + 1][1] - profile[i][1]) * k]; };
  return Array.from({ length: n }, (_, i) => { const [ax, ay] = at(total * i / n), [bx, by] = at(total * (i + 1) / n); return { x: (ax + bx) / 2, y: (ay + by) / 2, angle: Math.atan2(by - ay, bx - ax), length: Math.hypot(bx - ax, by - ay) }; });
}
// multiplies a shape's own coordinates so that a surface's tile comes out at its real size
export function inMetres(g, u, v, size) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u / size, a.getY(i) * v / size); return g; }

// Collects geometry by material and makes one mesh of each lot, so that a building of a thousand parts is drawn in a
// handful of calls. put(material, geometry, ...); put.done() adds the meshes.
export function batcher(add) {
  const lots = new Map();
  const clean = g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  };
  const put = (mat, ...geos) => { let lot = lots.get(mat); if (!lot) lots.set(mat, lot = []); for (const g of geos.flat()) if (g) lot.push(clean(g)); };
  put.done = () => { const made = []; for (const [mat, lot] of lots) if (lot.length) made.push(add(new THREE.Mesh(mergeGeometries(lot), mat))); lots.clear(); return made; };
  return put;
}
