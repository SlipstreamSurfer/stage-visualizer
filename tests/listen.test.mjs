// What the show hears, checked on music whose arrangement is known exactly (tests/synth.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { track } from './synth.mjs';
import { listen } from '../tools/hear.mjs';
import { TempoTracker, Listener, PAUSE_BEATS } from '../src/listen.js';

const of = (result, type) => result.events.filter(e => e.type === type);
const near = (actual, expected, margin, what) => assert.ok(Math.abs(actual - expected) <= margin, `${what}: ${actual.toFixed(2)}, expected ${expected} ± ${margin}`);

test('the tempo is right within half a beat per minute', () => {
  for (const bpm of [120, 124, 128, 133, 140, 150]) {
    const { rows } = listen(track(bpm, [{ beats: 64, kick: true, hats: 0.6, pad: 0.5 }]).pcm);
    for (const row of rows.slice(1)) near(row.bpm, bpm, 0.5, `${bpm} BPM at ${row.t.toFixed(0)} s`);
  }
});

// intro, groove, full, a break with a riser, the drop, a silence and the start of another track
const song = track(128, [
  { beats: 32, kick: true, hats: 0.1 },
  { beats: 64, kick: true, hats: 0.5, pad: 0.4 },
  { beats: 64, kick: true, hats: 1, pad: 1 },
  { beats: 16, pad: 0.5 }, { beats: 16, pad: 0.5, riser: 1 },
  { beats: 64, kick: true, hats: 1, pad: 1 },
  { beats: 12 },
  { beats: 32, kick: true, hats: 0.3 },
]);
const [, groove, , breakStart, , drop, silence, next] = song.starts;
const heard = listen(song.pcm, { every: 2 });

test('the kick coming in starts the show', () => {
  near(of(heard, 'start')[0].t, 0, 0.2, 'first kick');
});

test('the track opening up is heard as intro → groove', () => {
  const change = of(heard, 'section').find(e => e.from === 'intro' && e.to === 'groove');
  assert.ok(change, 'no change from intro to groove');
  assert.ok(change.t > groove && change.t < groove + 10, `heard at ${change.t.toFixed(1)} s, the groove starts at ${groove} s`);
});

test('the kick dropping out is a break once it has been gone for longer than a pause of two bars', () => {
  const breaks = of(heard, 'break'), lastKick = breakStart - song.beat;
  assert.equal(breaks.length, 2, 'the break, and the silence after the track');
  near(breaks[0].t, lastKick + PAUSE_BEATS * song.beat, 0.3, `the break (the last kick is at ${lastKick.toFixed(2)} s)`);
});

test('a riser builds tension during the break', () => {
  const at = t => heard.rows.find(r => r.t >= t).build;
  assert.ok(at(breakStart + 6) < 0.4, 'tension before the riser');
  assert.ok(at(drop) > 0.7, `tension at the end of the riser is ${at(drop).toFixed(2)}`);
});

test('the kick coming back after the break is one drop, on the kick', () => {
  const drops = of(heard, 'drop');
  assert.equal(drops.length, 1);
  near(drops[0].t, drop, 0.1, 'the drop');
  near(drops[0].breakLength, drop - breakStart, 2, 'length of the break');
  assert.equal(heard.rows.find(r => r.t >= drop + 4).section, 'peak', 'a drop lands in the peak');
});

test('a silence ends the track, and the next track starts without a drop', () => {
  const quiet = of(heard, 'silence');
  assert.equal(quiet.length, 1);
  assert.ok(quiet[0].trackEnded);
  assert.ok(quiet[0].t > silence && quiet[0].t < next, `silence heard at ${quiet[0].t.toFixed(1)} s`);
  near(of(heard, 'start').at(-1).t, next, 0.2, 'the next track');
});

test('the kick held back for one bar or two is a pause: no break and no drop, and the track is where it was', () => {
  for (const bars of [1, 2]) {
    const { pcm, starts } = track(128, [{ beats: 96, kick: true, hats: 1, pad: 1 }, { beats: bars * 4, hats: 1, pad: 1 }, { beats: 32, kick: true, hats: 1, pad: 1 }]);
    const result = listen(pcm, { every: 1 });
    assert.equal(of(result, 'break').length, 0, `${bars} bars: no break`);
    assert.equal(of(result, 'drop').length, 0, `${bars} bars: no drop`);
    assert.equal(of(result, 'start').length, 1, `${bars} bars: the kick comes in once, at the start`);
    const back = of(result, 'back');
    assert.equal(back.length, 1, `${bars} bars: the kick is back once`);
    near(back[0].t, starts[2], 0.1, `${bars} bars: back on the kick`);
    const before = result.rows.find(r => r.t >= starts[1] - 1).section;
    for (const row of result.rows) if (row.t > starts[1] && row.t < starts[2] + 6) assert.equal(row.section, before, `${bars} bars: at ${row.t} s the track is still in its ${before}`);
    assert.equal(of(result, 'section').filter(e => e.t > starts[1] - 1).length, 0, `${bars} bars: no other part of the track`);
  }
});

test('the kick gone for three bars is a short break that ends without a drop; gone for four bars or more it ends in one', () => {
  for (const [bars, drops] of [[3, 0], [4, 1], [8, 1]]) {
    const { pcm, starts, beat } = track(128, [{ beats: 64, kick: true, hats: 0.6, pad: 0.5 }, { beats: bars * 4, pad: 0.5 }, { beats: 32, kick: true, hats: 0.6, pad: 0.5 }]);
    const result = listen(pcm);
    assert.equal(of(result, 'break').length, 1, `${bars} bars: one break`);
    near(of(result, 'break')[0].t, starts[1] - beat + PAUSE_BEATS * beat, 0.3, `${bars} bars: the break`);
    assert.equal(of(result, 'back').length, 0, `${bars} bars: not a pause`);
    assert.equal(of(result, 'drop').length, drops, `${bars} bars: drops`);
    if (drops) near(of(result, 'drop')[0].t, starts[2], 0.1, `${bars} bars: the drop`);
    else near(of(result, 'start').at(-1).t, starts[2], 0.1, `${bars} bars: the kick comes back in`);
  }
});

test('the tempo stays the track\'s own while a bass line with a rhythm of its own takes over for twelve bars, and when the kick is back', () => {
  // no kick, and a bass line at four notes to three beats: by itself that lines up at 170.7 BPM, which the show used to read
  const { pcm, starts } = track(128, [{ beats: 64, kick: true, hats: 0.6, pad: 0.5 }, { beats: 48, roll: 0.4, pad: 0.5 }, { beats: 48, kick: true, hats: 0.6, pad: 0.5 }]);
  const { rows } = listen(pcm, { every: 1 });
  for (const row of rows) if (row.t > 14) near(row.bpm, 128, 1, `at ${row.t} s (the break is from ${starts[1].toFixed(0)} to ${starts[2].toFixed(0)} s)`);
});

test('a bass line at four notes to three beats under the kick, or kicks at that pace for four bars, are not another tempo', () => {
  const rolling = track(128, [{ beats: 48, kick: true, hats: 0.6 }, { beats: 64, kick: true, roll: 0.9, hats: 0.6 }, { beats: 32, kick: true, hats: 0.6 }]);
  for (const row of listen(rolling.pcm, { every: 1 }).rows) if (row.t > 14) near(row.bpm, 128, 1, `a rolling bass line, at ${row.t} s`);
  const fill = track(128, [{ beats: 64, kick: true, hats: 0.6 }, { beats: 16, roll: 1, hats: 0.6 }, { beats: 48, kick: true, hats: 0.6 }]);
  for (const row of listen(fill.pcm, { every: 1 }).rows) if (row.t > 14) near(row.bpm, 128, 1, `kicks at another pace for four bars, at ${row.t} s`);
});

test('until the tempo is known, the rough one from the kicks does not jump about with every kick', () => {
  const state = {}, listener = new Listener(state), seen = new Set();
  let t = 0, next = 0, n = 0;
  for (; t < 6; t += 1 / 60) {
    const kick = t >= next;
    if (kick) next += [0.46, 0.48, 0.47, 0.45, 0.49][n++ % 5];   // a kick at 128, heard a hundredth of a second early or late
    listener.update({ kick, bassRise: undefined, kickStrength: 1, level: 1, density: 0.5 }, t, 1 / 60, { live: false });
    if (t > 3) seen.add(state.kickBpm); else if (n <= 3) assert.equal(state.kickBpm, 0, 'two kicks are not a tempo yet');
  }
  assert.ok([...seen].every(b => Math.abs(b - 128) <= 2), `the rough tempo read ${[...seen]}`);   // (the middle one of the last kicks alone gave 124 to 133)
});

test('very quiet sound does not start the show', () => {
  const { pcm } = track(128, [{ beats: 48, kick: true, hats: 0.5 }]);
  const result = listen(pcm.map(v => v * 0.002));
  assert.equal(of(result, 'start').length, 0);
  assert.equal(result.rows.reduce((n, r) => n + r.kicks, 0), 0, 'kicks heard');
});

test('a pause in the picture (a hidden tab) is not a break followed by a drop', () => {
  const listener = new Listener(), dt = 1 / 60;
  let t = 0, beat = -1, drops = 0;
  const run = seconds => {
    for (const end = t + seconds; t < end; t += dt) {
      const now = Math.floor(t / 0.5), ev = listener.update({ kick: now !== beat, bass: 1, mid: 0.5, high: 0.5, density: 0.7 }, t, dt, { live: false });
      beat = now; if (ev.drop) drops++;
    }
  };
  run(10);
  t += 20; beat = Math.floor(t / 0.5) - 1;
  listener.update({ kick: true, bass: 1, mid: 0.5, high: 0.5, density: 0.7 }, t, 0.05, { live: false, gap: 20 });
  run(5);
  assert.equal(drops, 0);
});

test('sound arriving in pieces is heard the same as a whole recording', async () => {
  const { hearing } = await import('../tools/hear.mjs');
  const ear = hearing(), events = [];
  for (let i = 0, size = 37; i < song.pcm.length; i += size, size = 37 + (i % 4001)) events.push(...ear.push(song.pcm.subarray(i, i + size)));
  assert.deepEqual(events, listen(song.pcm).events);
});

// The next three come from recordings of real tracks (progressive and organic house, 9 October 2026), where soft
// hits in a breakdown ended the break over and over, and a bass note between the kicks was counted as a kick.
test('soft bass hits in a breakdown do not end the break; the real kick does, as one drop', () => {
  const { pcm, starts } = track(124, [
    { beats: 64, kick: true, hats: 0.6, pad: 0.5 },
    { beats: 48, kick: 0.25, every: 3, pad: 0.5 },
    { beats: 32, kick: true, hats: 0.6, pad: 0.5 },
  ]);
  const result = listen(pcm);
  assert.equal(of(result, 'break').length, 1, 'breaks');
  assert.equal(of(result, 'start').length, 1, 'the kick coming in, apart from the drop');
  assert.equal(of(result, 'drop').length, 1, 'drops');
  near(of(result, 'drop')[0].t, starts[2], 0.1, 'the drop');
});

test('a softer kick that keeps coming on the beat is taken as the kick again, without a drop', () => {
  const { pcm, starts } = track(124, [
    { beats: 64, kick: true, hats: 0.6, pad: 0.5 },
    { beats: 16, pad: 0.5 },
    { beats: 48, kick: 0.3, hats: 0.3, pad: 0.5 },
  ]);
  const result = listen(pcm);
  assert.equal(of(result, 'drop').length, 0, 'drops');
  const back = of(result, 'start').at(-1).t;
  assert.ok(back > starts[2] && back < starts[2] + 9.5, `the kick is back at ${starts[2].toFixed(1)} s, heard at ${back.toFixed(1)} s`);
  assert.equal(of(result, 'break').length, 1, 'breaks');
});

test('a bass note between the kicks is not counted as a kick', () => {
  const { pcm } = track(124, [{ beats: 96, kick: true, bass: 0.7, hats: 0.6, pad: 0.5 }]);
  // from 10 seconds in: the note can only be told from the kick once the tempo is known
  const rows = listen(pcm).rows.slice(1), kicks = rows.reduce((n, r) => n + r.kicks, 0), beats = (rows.at(-1).t - 10) * 124 / 60;
  assert.ok(kicks > beats * 0.95 && kicks < beats * 1.05, `${kicks} kicks heard in ${beats.toFixed(0)} beats`);
});

// From the check against a second opinion made with hindsight (tools/check.mjs, 9 October 2026): in a progressive
// house track the show called the drop on a pick-up note 0.6 s before the kick came back.
test('a hard hit between the beats just before the kick returns is not the drop; the kick is', () => {
  const { pcm, starts } = track(124, [
    { beats: 64, kick: true, hats: 0.6, pad: 0.5 },
    { beats: 16, pad: 0.5, pickup: [13.3, 14.45] },
    { beats: 32, kick: true, hats: 0.6, pad: 0.5 },
  ]);
  const drops = of(listen(pcm), 'drop');
  assert.equal(drops.length, 1, 'drops');
  near(drops[0].t, starts[2], 0.1, 'the drop');
});

test('a tempo the track has kept stays through half a minute of bass hits a few percent off, even with the kick along; a tempo that stays is taken', () => {
  const tempo = new TempoTracker(), dt = 1 / 60;
  let t = 0, next = 0;
  const run = (bpm, seconds) => {
    for (const end = t + seconds; t < end; t += dt) {
      const hit = t >= next;
      if (hit) next += 60 / bpm;
      tempo.update(dt, hit ? 1 : 0, t > 8 ? bpm : 0);
    }
  };
  run(128, 40);
  assert.ok(Math.abs(tempo.bpm - 128) < 1, `settled on ${tempo.bpm}`);
  run(134, 25);   // a stretch of a rolling bass line (in the recordings 128 against 131 or 134)
  assert.ok(Math.abs(tempo.bpm - 128) < 1, `the stretch moved the tempo to ${tempo.bpm}`);
  run(128, 20);
  run(134, 50);   // the next track, mixed in at its own tempo
  assert.ok(Math.abs(tempo.bpm - 134) < 1, `the new tempo was not taken: ${tempo.bpm}`);
});
