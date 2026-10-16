// Walking round the venue: a camera on your own two feet, steered with the keys and the mouse, to look at the show
// from wherever you like and at everything in it up close. You walk at eye height over the floor and up onto the
// stage, not through barriers, fences or walls, and out through the hangar door onto the terrace while it is open.
// E takes you up into the air (flying, through anything but the hall itself) and Q back down to the floor.
//
//   keys       the physical keys (W A S D or the arrows, E, Q, Shift to go faster), so they sit under the same fingers
//              whatever the keyboard's layout
//   look(dx, dy)   the mouse moved that many pixels
//   update(dt, world, camera)   moves and places the camera; world: { layout, solids, env }
//   at         where you are, [x, y, z, yaw, pitch], for a link that brings someone else to the same spot
import * as THREE from 'three/webgpu';

const EYE = 1.68, WALK = 1.5, FLY = 6, RUN = 2.6, BODY = 0.28;   // metres, and metres a second
const MOVES = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const KEYS = new Set([...Object.keys(MOVES), 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight']);

// how far a point is from a line between two points, all on the floor
function away(px, pz, [x0, z0, x1, z1]) {
  const dx = x1 - x0, dz = z1 - z0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - x0 - dx * t, pz - z0 - dz * t);
}

export class Walk {
  constructor() { this.on = false; this.flying = false; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.held = new Set(); }
  // start from where the camera is: on the floor if it is low, in the air if it is high
  enter(camera, world, at = null) {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.on = true; this.vel.set(0, 0, 0); this.held.clear();
    if (at) { this.pos.set(at[0], at[1], at[2]); this.yaw = at[3]; this.pitch = at[4]; }
    else { this.pos.copy(camera.position); this.yaw = e.y; this.pitch = Math.max(-0.6, Math.min(0.4, e.x)); }
    if (!this.free(this.pos.x, this.pos.z, world) && !at) {   // a camera on a truss or behind a wall: down to a free spot near it
      const L = world.layout;
      this.pos.x = Math.max(-L.plan.W / 2 + 1, Math.min(L.plan.W / 2 - 1, this.pos.x)); this.pos.z = Math.max(-L.plan.D / 2 + 1, Math.min(L.plan.D / 2 - 1, this.pos.z));
    }
    this.flying = this.pos.y > this.floor(this.pos.x, this.pos.z, world) + EYE + 0.8;
  }
  leave() { this.on = false; this.held.clear(); }
  // a key went down or up; true when it is one of the walking keys
  key(code, down) {
    if (!KEYS.has(code)) return false;
    if (down) this.held.add(code); else this.held.delete(code);
    return true;
  }
  look(dx, dy) { this.yaw -= dx * 0.0022; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0022)); }
  get at() { return [this.pos.x, this.pos.y, this.pos.z, this.yaw, this.pitch].map(v => +v.toFixed(2)); }

  // how high the floor is under (x, z): the hall's floor, or the stage's deck
  floor(x, z, { layout: L }) { return L.ground(x, z) + (L.onStage(x, z) ? L.stage.height : 0); }
  // the terrace outside the hangar door, and the part of the door the leaves leave open, while it is open
  outside(world) {
    const L = world.layout, door = (L.facilities || []).find(f => f.type === 'hangarDoor' && f.yard && f.wall === 'back'), o = L.shell?.opening;
    if (!door || !o || (world.env?.door ?? 0) < 0.9) return null;
    return { x0: door.at - 14.7, x1: door.at + 14.7, z0: L.plan.D / 2 - 0.5, z1: L.plan.D / 2 + 13.6, gap: [o.x0 + (o.stack || 0) + BODY, o.x1 - (o.stack || 0) - BODY] };
  }
  // may you stand at (x, z)?
  free(x, z, world) {
    const L = world.layout, out = this.outside(world);
    if (L.inside(x, z, BODY)) return true;
    return !!out && x > out.x0 && x < out.x1 && z > out.z0 && z < out.z1 && (z > L.plan.D / 2 + BODY || (x > out.gap[0] && x < out.gap[1]));
  }
  blocked(x, z, world) { return !this.free(x, z, world) || (world.solids || []).some(s => away(x, z, s) < BODY); }

  update(dt, world, camera) {
    const L = world.layout, fast = this.held.has('ShiftLeft') || this.held.has('ShiftRight');
    let ax = 0, az = 0;
    for (const code of this.held) if (MOVES[code]) { ax += MOVES[code][0]; az += MOVES[code][1]; }
    const len = Math.hypot(ax, az) || 1, speed = (this.flying ? FLY : WALK) * (fast ? RUN : 1);
    // what the keys ask for, turned the way you face, and eased so you start and stop like a person
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), wantX = (ax * c + az * s) / len * speed, wantZ = (-ax * s + az * c) / len * speed;
    const climb = (this.held.has('KeyE') ? 1 : 0) - (this.held.has('KeyQ') ? 1 : 0);
    if (climb > 0) this.flying = true;
    const k = 1 - Math.exp(-dt / 0.12);
    this.vel.x += (wantX - this.vel.x) * k; this.vel.z += (wantZ - this.vel.z) * k; this.vel.y += (climb * speed * 0.7 - this.vel.y) * k;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (this.flying) {   // anywhere in the hall, and over the terrace while the door is open; not through its walls or roof
      const out = this.outside(world), within = (x, z) => L.inside(x, z, BODY) || (out && x > out.x0 && x < out.x1 && z > out.z0 && z < out.z1);
      if (within(nx, this.pos.z)) this.pos.x = nx;
      if (within(this.pos.x, nz)) this.pos.z = nz;
      const ground = this.floor(this.pos.x, this.pos.z, world) + EYE, roof = L.inside(this.pos.x, this.pos.z) ? L.ceil(this.pos.x, this.pos.z) - 0.5 : 30;
      this.pos.y = Math.min(roof, this.pos.y + this.vel.y * dt);
      if (this.pos.y <= ground && climb <= 0) { this.pos.y = ground; this.flying = false; }   // back on your feet
    } else {   // on foot: along whatever blocks the way rather than stopping dead
      if (!this.blocked(nx, nz, world)) { this.pos.x = nx; this.pos.z = nz; }
      else if (!this.blocked(nx, this.pos.z, world)) this.pos.x = nx;
      else if (!this.blocked(this.pos.x, nz, world)) this.pos.z = nz;
      const ground = this.floor(this.pos.x, this.pos.z, world) + EYE;
      this.pos.y += (ground - this.pos.y) * (1 - Math.exp(-dt / 0.18));   // a step up onto the stage is a short climb
      if (Math.abs(ground - this.pos.y) < 0.002) this.pos.y = ground;
    }
    camera.position.copy(this.pos);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
  }
}
