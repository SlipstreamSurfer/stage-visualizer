// People who walk: to the bar, the toilets, the water, the cloakroom and back, along the aisles the crowd leaves
// free. Each has somewhere to go, walks there with legs and arms swinging, waits a while and goes somewhere else.
import * as THREE from 'three/webgpu';
import { people, peopleMaterial, shadowMaterial, SHIRTS, KIT } from './people.js';

// path: the aisle as a line of points [[x, z], ...]; pois: places to go, [{ x, z, ry }] with ry the way to face
// while waiting; light: the light of the beams; U: what all people share
// special: besides guests, now and then one of security or crew walking the round, and very seldom a medic with
// someone they help, side by side (the last two walkers; out of sight the rest of the time)
export function buildWalkers({ add, light, U, path, pois, count, special = false }) {
  const segs = []; let total = 0;
  for (let i = 0; i + 1 < path.length; i++) { const [ax, az] = path[i], [bx, bz] = path[i + 1], len = Math.hypot(bx - ax, bz - az); segs.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, from: total }); total += len; }
  const at = (s, lat, out) => { const g = segs.find(q => s <= q.from + q.len) || segs[segs.length - 1], k = Math.max(0, Math.min(g.len, s - g.from)); out.x = g.ax + g.dx * k - g.dz * lat; out.z = g.az + g.dz * k + g.dx * lat; };
  const nearest = (x, z) => { let best = 0, d = Infinity; for (const g of segs) { const k = Math.max(0, Math.min(g.len, (x - g.ax) * g.dx + (z - g.az) * g.dz)), e = Math.hypot(g.ax + g.dx * k - x, g.az + g.dz * k - z); if (e < d) { d = e; best = g.from + k; } } return best; };
  const stops = pois.map(p => ({ ...p, s: nearest(p.x, p.z) }));

  const crowd = people(peopleMaterial({ light, U, walking: true }), count, true); add(crowd.mesh);
  const blobs = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2), shadowMaterial(), count)); blobs.renderOrder = -1; blobs.frustumCulled = false;
  const c = new THREE.Color(), o = new THREE.Object3D(), p = { x: 0, z: 0 };
  const who = Array.from({ length: count }, (_, i) => {
    const role = !special || i < count - 4 ? 'guest' : ['security', 'crew', 'medic', 'helped'][i - (count - 4)];
    crowd.shirt(i, c.setHex(role === 'guest' || role === 'helped' ? SHIRTS[Math.random() * SHIRTS.length | 0] : role === 'medic' ? 0xb8c0b8 : 0x0c0c0e)); crowd.seed(i, Math.random(), Math.random(), Math.random(), Math.random());
    if (role in KIT) crowd.kit(i, KIT[role]);
    const w = { role, s: Math.random() * total, lat: (Math.random() - 0.5) * 1.5, speed: 1.0 + Math.random() * 0.5, phase: Math.random() * 6, amount: 1, state: 'lane', timer: 0, stop: null, goal: 0, x: 0, z: 0, heading: 0, size: 0.93 + Math.random() * 0.14 };
    at(w.s, w.lat, w); choose(w);
    return w;
  });
  // somewhere to go: most of the time one of the places, sometimes just a walk round
  function choose(w) { w.stop = stops.length && Math.random() < 0.8 ? stops[Math.random() * stops.length | 0] : null; w.goal = w.stop ? w.stop.s : Math.random() * total; w.state = 'lane'; }

  // when the staff walk: security and crew for a minute now and then, the medic and whoever they help very seldom
  let clock = 0;
  const out = w => w.role === 'guest' || (w.role === 'security' ? clock % 420 < 60 : w.role === 'crew' ? (clock + 200) % 540 < 60 : clock % 1500 > 1380);
  const medic = who.find(w => w.role === 'medic');
  return function update(dt) {
    clock += dt;
    for (let i = 0; i < count; i++) {
      const w = who[i]; let moving = 1, tx = w.x, tz = w.z;
      if (w.role === 'helped' && medic) { w.s = medic.s; w.lat = medic.lat + 0.55; w.goal = medic.goal; w.state = medic.state; w.stop = medic.stop && { x: medic.stop.x + 0.55, z: medic.stop.z, ry: medic.stop.ry }; }   // beside the medic, on the way and where they stop
      if (w.state === 'lane') {
        const d = w.goal - w.s, step = Math.min(Math.abs(d), w.speed * dt);
        w.s += Math.sign(d) * step; at(w.s, w.lat * Math.sign(d || 1), p); tx = p.x; tz = p.z;
        if (Math.abs(d) < 0.15) { if (w.stop) w.state = 'out'; else choose(w); }
      } else if (w.state === 'out' || w.state === 'back') {
        if (w.state === 'out') { tx = w.stop.x; tz = w.stop.z; } else { at(w.s, w.lat, p); tx = p.x; tz = p.z; }
        const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz), step = Math.min(d, w.speed * dt);
        if (d > 0.05) { tx = w.x + dx / d * step; tz = w.z + dz / d * step; }
        else if (w.state === 'out') { w.state = 'wait'; w.timer = 5 + Math.random() * 14; } else choose(w);
      } else {   // waiting: at the bar, in the queue
        moving = 0; w.timer -= dt; w.heading += (((w.stop.ry - w.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4);
        if (w.timer <= 0) w.state = 'back';
      }
      const dx = tx - w.x, dz = tz - w.z;
      if (moving && Math.hypot(dx, dz) > 1e-4) { const want = Math.atan2(dx, dz); w.heading += (((want - w.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8); }
      w.x = tx; w.z = tz;
      w.amount += (moving - w.amount) * Math.min(1, dt * 6); w.phase += dt * w.speed * 4.4 * w.amount;
      const size = out(w) ? w.size : 0;   // out of sight: folded away
      crowd.walk(i, w.phase, w.amount); crowd.put(i, w.x, w.z, w.heading + Math.PI, size);   // the figure faces -z as built
      o.position.set(w.x, 0.015, w.z); o.scale.setScalar(size); o.updateMatrix(); blobs.setMatrixAt(i, o.matrix);
    }
    crowd.moved(); blobs.instanceMatrix.needsUpdate = true;
  };
}
