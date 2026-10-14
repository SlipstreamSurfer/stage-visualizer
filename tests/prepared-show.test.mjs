import test from 'node:test';
import assert from 'node:assert/strict';
import hangar from '../src/venues/hangar.js';
import { layout, byRole } from '../src/layout.js';
import { Director } from '../src/director.js';
import { Signals } from '../src/signals.js';
import { normalizeControls } from '../src/show-controls.js';
import { normalizeShow, PreparedShow, preparedSignals, preparedControls } from '../src/prepared-show.js';

// A made-up track at 120 BPM (a bar is two seconds): an intro, a groove, a break with a build and a drop.
const SHOW = {
  name: 'Test track', bpm: 120, offset: 0.5,
  parts: [{ bar: 1, section: 'intro' }, { bar: 5, section: 'groove' }, { bar: 9, section: 'break', build: [0, 1] }, { bar: 13, section: 'peak', drop: true }, { bar: 21, end: true }],
  cues: [{ bar: 1, heads: 'pillars', trusses: 'Canopy', colors: ['#ffffff', '#3a6bff'] }, { bar: 9, heads: 'curtains', choreography: 'pulse' },
    { bar: 13, heads: 'converge', trusses: 'High', fire: ['co2', 'spark'], camera: 0, cut: 'hard', colors: ['#ff2010'] }, { bar: 12, beat: 4, strobe: 4 }],
};

test('a show file is checked and explains what is wrong', () => {
  assert.equal(normalizeShow(SHOW).parts.length, 5);
  for (const [bad, reason] of [[{ ...SHOW, bpm: 0 }, /bpm/], [{ ...SHOW, parts: [{ bar: 1, section: 'chorus' }] }, /section/],
    [{ ...SHOW, cues: [{ bar: 2, heads: 'nonsense' }] }, /heads/], [{ ...SHOW, cues: [{ bar: 2, colors: ['red'] }] }, /colors/], [{ ...SHOW, cues: [{ bar: 2, fire: ['bomb'] }] }, /fire/]])
    assert.throws(() => normalizeShow(bad), reason);
});

test('the show follows the file clock: parts, the build, a drop on its beat, one-off cues once', () => {
  const show = new PreparedShow(normalizeShow(SHOW)), seen = [];
  assert.equal(show.time(13), 0.5 + 24);
  let drops = 0, fired = 0, strobes = 0;
  for (let t = 0; t <= 42; t += 1 / 60) {
    const s = show.step(t);
    if (s.drop) { drops++; assert.ok(Math.abs(t - show.time(13)) < 1 / 60 + 1e-9, 'the drop lands on bar 13'); }
    for (const e of s.events) { if (e.fire) fired++; if (e.strobe) strobes++; }
    seen.push(s);
  }
  assert.equal(drops, 1); assert.equal(fired, 1); assert.equal(strobes, 1);
  const at = time => seen.reduce((a, b) => Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a);
  assert.equal(at(3).section, 'intro'); assert.equal(at(10).section, 'groove'); assert.equal(at(20).section, 'break');
  assert.ok(at(17).build < 0.1 && at(24).build > 0.85, 'the build rises through the break');
  assert.equal(at(20).looks.heads, 'curtains'); assert.equal(at(30).looks.heads, 'converge'); assert.equal(at(30).looks.trusses, 'High');
  assert.equal(at(41).playing, false, 'after the end the listener takes over');
  // a jump through the file fires nothing on the way
  const again = new PreparedShow(normalizeShow(SHOW)); again.step(1); const jump = again.step(30);
  assert.equal(jump.drop, false); assert.equal(jump.events.length, 0); assert.equal(jump.looks.heads, 'converge');
});

test('the director follows a prepared show: the drop, the looks and the colours on time', () => {
  const L = layout(hangar);
  for (const f of L.things) f.ch = { dim: 0, color: [1, 1, 1], pan: 0, tilt: 0, zoom: 1 };
  const groups = byRole(L.things), d = new Director(groups, 'techno', { venue: 'hangar' }), show = new PreparedShow(normalizeShow(SHOW)), live = new Signals();
  Object.assign(live.m, { section: 'groove', phase: 'groove', activity: 1 }); Object.assign(live, { energy: 0.6, bass: 0.5, mid: 0.3, treble: 0.2 }); live.ev = {};
  let dropFrame = null;
  for (let i = 0; i <= 40 * 30; i++) {
    const t = i / 30, s = show.step(t);
    if (!s.playing) { if (t > 30) break; continue; }   // before the first beat and after the end the listener leads
    const before = d.drops;
    d.update(preparedSignals(live, s, show), t, 1 / 30, { light: 1, haze: 1, off: {}, controls: preparedControls(normalizeControls({}), s.looks) });
    if (d.drops > before) dropFrame = t;
    if (t > 5 && t < 16) assert.equal(d.headLook, 'pillars');
    if (t > 30) { assert.equal(d.headLook, 'converge'); assert.equal(d.trussName, 'High'); }
  }
  assert.ok(dropFrame !== null && Math.abs(dropFrame - show.time(13)) < 0.05, `the director drops at ${dropFrame}, bar 13 is ${show.time(13)}`);
  assert.ok(d.col[0] > 0.9 && d.col[2] < 0.2, 'the colours of the cue reach the light');
});

test('the local server answers null for a file without a prepared show, and stays inside shows/', async () => {
  const { serve } = await import('../tools/serve.mjs'), server = await serve(0), base = `http://127.0.0.1:${server.address().port}/__shows/`;
  try {
    for (const name of ['no such track.mp3', '../package', '..%2F..%2Fpackage']) {
      const response = await fetch(base + encodeURIComponent(name));
      assert.equal(response.status, 200); assert.equal(await response.json(), null);
    }
  } finally { server.close(); }
});
