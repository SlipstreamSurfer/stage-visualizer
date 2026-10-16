import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout } from '../src/layout.js';
import { Walk } from '../src/walk.js';

// a camera as walk.js uses one: a position, a quaternion to start from, and a rotation it sets
const camera = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, rotation: { set() {} }, fov: 70, updateProjectionMatrix() {} });
const L = layout(hangar), pit = L.stage.front + 2.6, D = L.plan.D;
const world = (door = 0) => ({ layout: L, env: { door }, solids: [[-19, pit, 19, pit]] });   // the barrier in front of the stage
// hold some keys for a while, sixty steps a second
const hold = (walk, keys, seconds, w = world(), cam = camera()) => { for (const k of keys) walk.key(k, true); for (let t = 0; t < seconds; t += 1 / 60) walk.update(1 / 60, w, cam); for (const k of keys) walk.key(k, false); return cam; };

test('walking: at eye height on the floor, at a walking pace, and not through the barrier', () => {
  const walk = new Walk(); walk.enter(camera(), world(), [0, 1.68, -10, 0, 0]);
  hold(walk, ['KeyW'], 2);
  assert.ok(walk.pos.z < -12.3 && walk.pos.z > -13.4, `about three metres in two seconds (${walk.pos.z})`);
  assert.equal(walk.pos.y, 1.68);
  hold(walk, ['KeyW', 'ShiftLeft'], 10);
  assert.ok(walk.pos.z > pit, `stopped by the barrier (${walk.pos.z})`);
  hold(walk, ['KeyA', 'KeyW'], 2);   // along it, not stuck on it
  assert.ok(walk.pos.x < -1 && walk.pos.z > pit);
});

test('flying: up with E, over the barrier and down onto the stage with Q, never through the roof', () => {
  const walk = new Walk(); walk.enter(camera(), world(), [0, 1.68, -20, 0, 0]);
  hold(walk, ['KeyE'], 1);
  assert.ok(walk.flying && walk.pos.y > 4);
  hold(walk, ['KeyE'], 20);
  assert.ok(walk.pos.y <= L.ceil(0, walk.pos.z) - 0.5 + 1e-6, 'under the roof');
  hold(walk, ['KeyW'], 4);
  assert.ok(walk.pos.z < L.stage.front - 1, 'over the stage');
  hold(walk, ['KeyQ'], 20);
  assert.equal(walk.flying, false);
  assert.ok(Math.abs(walk.pos.y - (L.stage.height + 1.68)) < 0.01, `on the stage, at eye height (${walk.pos.y})`);
});

test('the hall keeps you in, unless the hangar door is open: then out through its middle onto the terrace', () => {
  const walk = new Walk(); walk.enter(camera(), world(), [0, 1.68, D / 2 - 3, Math.PI, 0]);   // facing the door
  hold(walk, ['KeyW'], 6, world(0));
  assert.ok(walk.pos.z < D / 2, 'a shut door is a wall');
  hold(walk, ['KeyW'], 6, world(1));
  assert.ok(walk.pos.z > D / 2 + 3, `out on the terrace (${walk.pos.z})`);
  hold(walk, ['KeyW'], 20, world(1));
  assert.ok(walk.pos.z < D / 2 + 13.6, 'not beyond its fence');
  walk.enter(camera(), world(), [12, 1.68, D / 2 - 2, Math.PI, 0]);   // in front of the stacked leaves
  hold(walk, ['KeyW'], 6, world(1));
  assert.ok(walk.pos.z < D / 2, 'the leaves stacked at the side of the opening are in the way');
});

test('a spot is a link: where you are and the way you look, and from it you start there', () => {
  const walk = new Walk(); walk.enter(camera(), world(), [3.25, 1.68, -4.5, 0.6, -0.1]);
  assert.deepEqual(walk.at, [3.25, 1.68, -4.5, 0.6, -0.1]);
  // from a camera high up, looking along -z: flying, facing the same way
  const cam = camera(); cam.position.set(0, 9, 10);
  walk.enter(cam, world()); assert.equal(walk.flying, true); assert.ok(Math.abs(walk.yaw) < 1e-9);
});
