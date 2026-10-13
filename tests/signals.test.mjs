import test from 'node:test';
import assert from 'node:assert/strict';
import { Signals } from '../src/signals.js';
import { Ear } from '../src/ear.js';
import { RATE, listen } from '../tools/hear.mjs';
import { track } from './synth.mjs';

test('live event history uses the audio step time even when a frame consumes a long batch', () => {
  const { pcm } = track(128, [{ beats: 40, kick: true, hats: 0.6, pad: 0.5 }, { beats: 16, pad: 0.5 }, { beats: 24, kick: true, hats: 0.6, pad: 0.5 }, { beats: 4, hats: 0.6, pad: 0.5 }, { beats: 16, kick: true, hats: 0.6, pad: 0.5 }, { beats: 16 }]);
  const names = { start: 'kick comes in', break: 'break', drop: 'drop', back: 'kick back', lift: 'lift', silence: 'silence' };
  const expected = listen(pcm).events.filter(e => names[e.type]).map(e => ({ t: e.t, what: names[e.type] }));
  for (const seconds of [1 / 60, 0.4, 1.8]) {
    const events = [], signals = new Signals(e => events.push(e)), ear = new Ear(RATE), size = Math.round(RATE * seconds);
    for (let i = 0; i < pcm.length; i += size) {
      signals.begin();
      ear.push(pcm, i, Math.min(pcm.length, i + size), (bands, rms) => signals.hear(bands, rms));
      signals.flow(seconds);
    }
    assert.deepEqual(events.map(e => e.what), expected.map(e => e.what), `${seconds}s batches retain each event once`);
    // The accumulated Signals clock and Ear's sample counter can cross a threshold one listening step apart.
    for (let i = 0; i < events.length; i++) assert.ok(Math.abs(events[i].t - expected[i].t) <= 1 / 60 + 1e-8, `${events[i].what} stays within one audio step in ${seconds}s batches`);
  }
});

test('the kick back after a pause is half a lift and nothing more: no break, no drop, no new part of the track', () => {
  const { pcm, starts } = track(128, [{ beats: 64, kick: true, hats: 1, pad: 1 }, { beats: 8, hats: 1, pad: 1 }, { beats: 16, kick: true, hats: 1, pad: 1 }]);
  const signals = new Signals(), ear = new Ear(RATE), size = Math.round(RATE / 60);
  let back = 0, lift = 0, liftBefore = 1, phases = new Set();
  for (let i = 0; i < pcm.length; i += size) {
    const t = i / RATE;
    signals.begin();
    ear.push(pcm, i, Math.min(pcm.length, i + size), (bands, rms) => signals.hear(bands, rms));
    if (signals.ev.back) { back++; lift = signals.lift; assert.ok(Math.abs(t - starts[2]) < 0.1, `back at ${t.toFixed(2)} s`); }
    if (t > starts[1] && t < starts[2] - 0.1) liftBefore = Math.min(liftBefore, signals.lift);
    // (the track's own start is a lift, at twelve seconds)
    if (t > 20) { phases.add(signals.m.phase); assert.equal(signals.ev.drop, false); assert.equal(signals.ev.broke, false); assert.equal(signals.ev.lift, false); assert.equal(signals.ev.from, null); }
    signals.flow(1 / 60);
  }
  assert.equal(back, 1);
  assert.ok(liftBefore < 0.05 && Math.abs(lift - 0.5) < 1e-9, `the accent: ${liftBefore.toFixed(2)} before, ${lift} on the kick`);
  assert.deepEqual([...phases], ['groove']);
});
