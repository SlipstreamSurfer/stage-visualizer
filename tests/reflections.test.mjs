import test from 'node:test';
import assert from 'node:assert/strict';
import { reflectionHit } from '../src/reflections.js';
import { layout } from '../src/layout.js';
import { TEST_VENUE } from './rig.mjs';

const unit = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} should be near ${b}`);
const L = layout(TEST_VENUE), hall = { ...L.plan, H: L.plan.H + L.plan.rise, round: true, ceil: L.ceil };

test('mirror reflections land on the sloping circular hall roof, not a horizontal plane through it', () => {
  const origin = [0, 13.2, 0], hit = reflectionHit(hall, origin, unit([1, 0.5, 0]));
  assert.equal(hit.surface, 'roof');
  close(hit.position[1], L.ceil(hit.position[0], hit.position[2]));
  assert.ok(hit.position[1] < hall.H - 0.1);
  close(hit.normal[0] / hit.normal[1], 2 / 12);
  assert.ok(hit.normal[1] < 0, 'roof spots face into the hall');
  for (const dy of [0, -0.02]) {
    const grazing = reflectionHit(hall, origin, unit([1, dy, 0]));
    assert.equal(grazing.surface, 'roof', 'a shallow ray meets the descending roof before the wall');
    close(grazing.position[1], L.ceil(grazing.position[0], grazing.position[2]));
  }
});

test('a complete turn keeps every circular hall reflection on the nearest room surface', () => {
  for (let turn = 0; turn < Math.PI * 2; turn += 0.4) for (let i = 0; i < 240; i++) {
    const y = 0.92 - 1.84 * (i + 0.5) / 240, r = Math.sqrt(1 - y * y), a = i * 2.399963 + turn;
    const direction = [Math.cos(a) * r, y, Math.sin(a) * r];
    const hit = reflectionHit(hall, [0, 13.2, 0], direction), [x, h, z] = hit.position;
    assert.ok(hit.position.every(Number.isFinite) && hit.distance > 0);
    close(Math.hypot(...hit.normal), 1);
    assert.ok(hit.normal.reduce((s, n, j) => s + n * direction[j], 0) < 0);
    assert.ok(h >= -0.001 && h <= L.ceil(x, z) + 0.001);
    if (hit.surface === 'roof') close(h, L.ceil(x, z));
    else if (hit.surface === 'floor') close(h, 0);
    else close(Math.hypot(x, z), 12);
  }
});

test('flat roofs, vertical rays and oval walls retain correct intersections and normals', () => {
  const room = { W: 40, D: 20, H: 12, ceil: () => 12 };
  const up = reflectionHit(room, [0, 5, 0], [0, 1, 0]);
  assert.equal(up.surface, 'roof'); close(up.position[1], 12);
  assert.deepEqual(up.normal, [0, -1, 0]);
  const down = reflectionHit(room, [0, 5, 0], [0, -1, 0]);
  assert.deepEqual(down.position, [0, 0, 0]);
  const wall = reflectionHit(room, [0, 5, 0], [1, 0, 0]);
  assert.deepEqual(wall.position, [20, 5, 0]);
  const oval = reflectionHit({ ...room, round: true }, [2, 5, 1], unit([1, 0, 1]));
  const [x, , z] = oval.position;
  close((x / 20) ** 2 + (z / 10) ** 2, 1);
  close(oval.normal[0] / oval.normal[2], x / (4 * z));
});
