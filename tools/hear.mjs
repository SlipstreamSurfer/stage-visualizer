// Runs sound through the visualizer's own Listener (src/listen.js) without a browser, the way the page does it:
// 60 frames a second, each frame a spectrum of the last 2048 samples.
import { spawnSync } from 'node:child_process';
import { Listener } from '../src/listen.js';
import { Ear, STEPS } from '../src/ear.js';

export const RATE = 48000;
const FPS = 60;

// Any audio file ffmpeg can read, as mono samples between -1 and 1.
export function decode(file) {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 2 ** 31 - 1 });
  if (out.error?.code === 'ENOENT') throw new Error('ffmpeg is needed to read audio files; install it and try again');
  if (out.status !== 0) throw new Error(`cannot read ${file}: ${String(out.stderr).trim() || out.error?.message}`);
  return new Float32Array(out.stdout.buffer, out.stdout.byteOffset, out.stdout.length >> 2);
}

// Sound comes in as it is played, in chunks of any size. It goes through the same Ear as in the page, so what is
// heard here is what the page hears.
//   push(samples) returns what happened in those samples: [{ t, type, ... }] with type start (the kick comes in),
//                 break, drop, back (the kick returns after a pause that was no break), section, lift, silence
//   t             seconds of sound heard so far
//   state         what the listener knows now (phase, section, bpm, build...)
export function hearing({ sens = 1 } = {}) {
  const state = {}, listener = new Listener(state), ear = new Ear(RATE), dt = 1 / STEPS;
  let events = [];
  const step = (bands, rms) => {
    const t = ear.t, wasSilent = state.silentFor > 2.5, phase = state.phase;
    const ev = listener.update(listener.hear(bands, rms, t, dt, sens), t, dt);
    if (ev.kick) out.kicks++;
    if (ev.drop) events.push({ t, type: 'drop', breakLength: ev.breakLength, gap: ev.kickGap });
    else if (ev.kick && phase === 'break') events.push({ t, type: 'start' });
    if (ev.broke) events.push({ t, type: 'break' });
    if (ev.back) events.push({ t, type: 'back', gap: ev.back });
    if (ev.silent && !wasSilent) events.push({ t, type: 'silence', trackEnded: ev.trackEnded });
    if (ev.from && state.section !== 'break' && ev.from !== 'break') events.push({ t, type: 'section', from: ev.from, to: state.section });
    if (ev.lift) events.push({ t, type: 'lift' });
    out.onFrame?.(t);
  };
  const out = {
    state, listener, kicks: 0, onFrame: null,
    get t() { return ear.t; },
    push(samples) { events = []; ear.push(samples, 0, samples.length, step); return events; },
  };
  return out;
}

// Plays a whole recording to a Listener and returns what it made of it:
//   events   as from hearing().push
//   rows     one summary per `every` seconds: bpm, section, density, build, kicks
//   state    the listener's state at the end
// fps, jitter: hand the sound over in pieces the size of a picture frame at that rate, as evenly or unevenly as a
// browser would (0.2: a fifth shorter or longer), instead of all at once
export function listen(pcm, { sens = 1, every = 10, fps, jitter = 0 } = {}) {
  const ear = hearing({ sens }), rows = [];
  let density = 0, build = 0, n = 0, next = every;
  const row = t => { rows.push({ t, bpm: ear.listener.tempo.bpm, confidence: ear.listener.tempo.confidence, section: ear.state.section, density: density / n, build, kicks: ear.kicks }); ear.kicks = density = build = n = 0; };
  ear.onFrame = t => {
    density += ear.state.density; build = Math.max(build, ear.state.build); n++;
    if (t >= next - 1e-9) { row(t); next += every; }
  };
  let events;
  if (!fps) events = ear.push(pcm);
  else {
    events = []; let seed = 7;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let i = 0; i < pcm.length;) { const size = Math.max(1, Math.round(RATE / fps * (1 + (random() - 0.5) * 2 * jitter))); events.push(...ear.push(pcm.subarray(i, i + size))); i += size; }
  }
  if (n) row(ear.t);
  return { events, rows, state: ear.state, seconds: pcm.length / RATE };
}

// one line for an event, as the tools print it
export const describe = e =>
  e.type === 'start' ? 'kick comes in' :
  e.type === 'break' ? 'break' :
  e.type === 'back' ? `the kick is back after a pause of ${e.gap.toFixed(1)} s` :
  e.type === 'drop' ? `DROP (the kick was gone for ${e.gap.toFixed(0)} s)` :
  e.type === 'section' ? `${e.from} → ${e.to}` :
  e.type === 'lift' ? 'lift (a layer comes in)' :
  e.trackEnded ? 'silence: the track is over' : 'silence';
export const clock = t => `${String(Math.floor(t / 60)).padStart(2)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
// the tempo a recording was at for most of its length
export function tempoOf(rows) {
  const sure = rows.filter(r => r.bpm && r.confidence > 0.4).map(r => r.bpm).sort((a, b) => a - b);
  return sure.length ? sure[sure.length >> 1] : 0;
}
