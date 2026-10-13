import test from 'node:test';
import assert from 'node:assert/strict';
import { shots, CameraDirector } from '../src/cameras.js';
import { layout } from '../src/layout.js';
import { VENUES } from '../src/venues/index.js';
import { TEST_VENUE } from './rig.mjs';

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('synthetic hall high views keep the stage sightline below the lighting rings throughout their moves', () => {
  const L = layout(TEST_VENUE);
  const clearance = Math.min(...L.movers.filter(m => m.props.kind === 'ring').map(m => m.pos[1] - m.props.maxDrop - 1.8));
  for (const shot of shots(L).filter(s => ['High at the back', 'Truss'].includes(s.name))) {
    let previous;
    for (let k = 0; k <= 40; k += 0.25) {
      const p = shot.pos(150 + k, k);
      assert.ok(p[1] >= L.stage.height + 3, `${shot.name} remains an elevated view`);
      for (let f = 0; f <= 1; f += 0.05) {
        const y = p[1] + (shot.look[1] - p[1]) * f;
        assert.ok(y <= clearance + 1e-9, `${shot.name}: the stage sightline clears the lower ring and its lamps`);
      }
      if (previous) assert.ok(distance(p, previous) < 0.2, `${shot.name}: no jumps during the move`);
      previous = p;
    }
  }
});

test('a venue opened later in the show gets a full first camera hold', () => {
  const list = shots(layout(VENUES.hangar)), camera = new CameraDirector(list, 1200);
  const signals = { m: { section: 'groove', phase: 'groove' }, ev: {}, beats: 1 };
  assert.equal(camera.update(signals, 1200), list[0]);
  assert.equal(camera.pending, null, 'no immediate fade after the new venue appears');
  camera.update(signals, 1229);
  assert.equal(camera.pending, null, 'keep the first view for its intended hold');
  signals.ev.kick = true; signals.beats = 16;
  camera.update(signals, 1231);
  assert.notEqual(camera.pending, null, 'the following beat can trigger the next view');
  signals.ev = {};
  camera.update(signals, 1231.3);
  assert.notEqual(camera.index, 0);
  assert.ok(camera.fade >= 0 && camera.fade <= 1);
});
function checkPoint(L, p, label, target = false) {
  const [x, y, z] = p;
  assert.ok(p.every(Number.isFinite), `${label}: finite coordinates`);
  if (!L.shell.open) {
    assert.ok(L.inside(x, z, target ? 0.1 : 0.5), `${label}: inside the walls at ${p}`);
    assert.ok(y <= L.ceil(x, z) - (target ? 0.1 : 0.5), `${label}: below the roof at ${p}`);
  }
  const floor = Math.max(L.ground(x, z), L.onStage(x, z) ? L.stage.height : 0);
  assert.ok(y >= floor + (target ? 0.4 : 0.6), `${label}: above the floor/stage at ${p}`);
}

test('every venue keeps all camera moves and their targets within its walls, floor and roof', () => {
  for (const [key, venue] of Object.entries(VENUES)) {
    const L = layout(venue), list = shots(L);
    assert.equal(list.length, L.shell.open ? 10 : 9);
    for (const shot of list) {
      checkPoint(L, shot.look, `${key}/${shot.name} target`, true);
      for (let t = 0; t <= 3600; t += 37) for (const k of [0, 4, 12, 28, 40]) {
        const p = shot.pos(t, k);
        checkPoint(L, p, `${key}/${shot.name} at ${t}, ${k}`);
        assert.ok(distance(p, shot.look) > 0.5, `${key}/${shot.name}: a useful viewing direction`);
      }
    }
  }
});

test('Hangar dance floor and pit cameras move smoothly across the entire shot', () => {
  for (const key of ['hangar']) {
    const L = layout(VENUES[key]);
    for (const name of ['Dance floor', 'Pit']) {
      const shot = shots(L).find(s => s.name === name), dt = 1 / 60;
      let previous = shot.pos(150, 0);
      for (let k = dt; k <= 40; k += dt) {
        const p = shot.pos(150 + k, k);
        checkPoint(L, p, `${key}/${name} during its move`);
        assert.ok(distance(p, previous) < 0.05, `${key}/${name}: no jump at a wall`);
        previous = p;
      }
      assert.ok(distance(shot.pos(150, 0), shot.pos(190, 40)) > 0.5, `${key}/${name}: still moves`);
    }
  }
});

test('extra facility views receive the same bounds without changing their source data', () => {
  const L = layout(VENUES.hangar);
  const extra = { name: 'Bar', fov: 62, pos: () => [50, 10, -50], look: [40, -5, 40] };
  const list = shots(L, [extra]), shot = list.at(-1);
  assert.equal(list.length, 10);
  assert.equal(shot.name, 'Bar');
  checkPoint(L, shot.pos(10, 20), 'extra bar');
  checkPoint(L, shot.look, 'extra bar target', true);
  assert.deepEqual(extra.look, [40, -5, 40]);
  assert.deepEqual(extra.pos(), [50, 10, -50]);
});
