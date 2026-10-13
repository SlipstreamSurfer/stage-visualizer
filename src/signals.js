// Signals: what the music is doing right now, for anything that wants to follow it (lights, cameras, effects, the
// crowd). The Listener (listen.js) decides what happened; this adds the quantities a show plays with: pulses that
// decay, a beat clock that keeps running through a break, energy. Nothing here touches the page or the picture.
//
//   m          the listener's state: phase ('break' | 'groove'), section, build, riser, bpm, activity, density
//   ev         what happened in this frame: kick, drop, lift, broke, back (the kick returned after a pause of a bar
//              or two: no break, only an accent), silent, from (the section before a change)
//   kick       1 on a kick, falling away      accent  the same for a high hit
//   drop lift  1 on the moment, falling away  hype    stays up for a while after a drop
//   energy     how loud and full, smoothed    bass mid treble   the three bands, 0 to 1
//   beats      kicks counted                  phase   beats as a clock, whole numbers fall on the kick
import { Listener } from './listen.js';
import { STEPS } from './ear.js';

export class Signals {
  constructor(onEvent = null) {
    this.onEvent = onEvent;   // live listening events, stamped on the sound clock before a frame consumes more audio
    this.m = {};
    this.listener = new Listener(this.m);
    this.ev = {};
    this.decay = 8;   // how fast the kick pulse falls; a mood sets it
    this.reset();
  }
  reset() {   // another sound source
    this.listener.reset();
    this.now = 0; this.begin();
    Object.assign(this, { kick: 0, accent: 0, drop: 0, lift: 0, hype: 0, energy: 0, bass: 0, mid: 0, treble: 0, beats: 0, phase: 0, rate: 2.1, stableBpm: 0, tempoCandidate: 0, tempoCandidateFor: 0 });
  }
  // Live sound goes in step by step, on the sound's own clock (see ear.js), and the picture reads the result once
  // per frame: begin() at the start of a frame, hear() for every step of sound that has come in since the last one
  // (none, one or several), flow() once to let the pulses fall away.
  begin() { this.ev = { kick: 0, kickGap: 0, drop: false, breakLength: 0, broke: false, back: 0, silent: false, trackEnded: false, from: null, lift: false }; }
  hear(bands, rms, sens = 1) {
    const dt = 1 / STEPS; this.now += dt;
    const phase = this.m.phase, wasSilent = this.m.silentFor > 2.5;
    const a = this.listener.hear(bands, rms, this.now, dt, sens);
    const ev = this.listener.update(a, this.now, dt);
    this.take(ev, a);
    if (this.onEvent) {
      const note = what => this.onEvent({ t: this.now, what });
      if (ev.drop) note('drop');
      else if (ev.kick && phase === 'break') note('kick comes in');
      if (ev.broke) note('break');
      if (ev.back) note('kick back');
      if (ev.lift) note('lift');
      if (ev.silent && !wasSilent) note('silence');
    }
  }
  // sound was missed (the page was hidden): the clock moves on, and the gap is not taken for a break
  skip(seconds) { this.now += seconds; this.m.lastKick += seconds; this.m.breakAt += seconds; }
  // what one step of listening found, added to what this frame has so far
  take(ev, a) {
    const e = this.ev;
    if (ev.kick) {
      e.kick = Math.max(e.kick, ev.kick); e.kickGap = ev.kickGap;
      this.kick = ev.kick; this.beats++;
      // a kick where one is expected pulls the clock onto it; any other is left alone
      if (Math.abs(ev.kickGap * this.rate - 1) < 0.25) { const f = this.phase % 1; this.phase += (f < 0.5 ? -f : 1 - f) * 0.5; }
    }
    if (ev.drop) { e.drop = true; e.breakLength = ev.breakLength; this.drop = 1; this.hype = 1; }
    if (ev.lift) { e.lift = true; this.lift = 1; this.hype = Math.max(this.hype, 0.4); }
    if (ev.back) { e.back = ev.back; this.lift = Math.max(this.lift, 0.5); }   // the kick is back after a pause: half a lift, and the show carries on
    if (ev.silent) { e.silent = true; this.beats = 0; }
    e.broke ||= ev.broke; e.trackEnded ||= ev.trackEnded; e.from ??= ev.from;
    this.accent = Math.max(this.accent, a.accent || 0);
    this.bass = a.bass; this.mid = Math.min(1, a.mid); this.treble = a.high;
  }
  // dt: the time since the last picture frame
  flow(dt) {
    const m = this.m;
    this.kick *= Math.exp(-dt * this.decay);
    this.accent *= Math.exp(-dt * 18);
    this.drop *= Math.exp(-dt * 1.6);
    this.lift *= Math.exp(-dt * 1.2);
    this.hype *= Math.exp(-dt * 0.22);
    const energy = this.bass * 0.5 + this.mid * 0.3 + this.treble * 0.2;
    this.energy += (energy - this.energy) * (1 - Math.exp(-dt / (energy > this.energy ? 0.07 : 0.35)));
    // the beat clock follows the tempo smoothly, so nothing that dances to it jumps when the estimate does
    if (this.ev.trackEnded) this.stableBpm = 0;
    if (m.bpm) {
      if (!this.stableBpm) this.stableBpm = m.bpm;
      const difference = Math.abs(m.bpm - this.stableBpm);
      if (difference <= 1.5) {
        this.stableBpm += (m.bpm - this.stableBpm) * (1 - Math.exp(-dt / 4));
        this.tempoCandidateFor = 0;
      } else {
        if (Math.abs(m.bpm - this.tempoCandidate) > 1.5) { this.tempoCandidate = m.bpm; this.tempoCandidateFor = 0; }
        const confidence = this.listener.tempo.confidence;
        this.tempoCandidateFor += confidence >= 0.45 && m.phase !== 'break' ? dt : 0;
        if (this.tempoCandidateFor >= 3) { this.stableBpm = m.bpm; this.tempoCandidateFor = 0; }
      }
      this.rate += (this.stableBpm / 60 - this.rate) * (1 - Math.exp(-dt / 2));
    }
    this.phase += dt * this.rate * (m.activity > 0.15 ? 1 : 0.3);
  }
  // how long the break has lasted, in seconds (the listener's times are on the sound's clock, not the picture's)
  get sinceBreak() { return this.now - this.m.breakAt; }
  // Everything at once, for sound that comes one frame at a time: the demo track and the tests.
  // a: one frame of sound as Listener.hear returns it, or the demo's stand-in
  update(a, t, dt, opts = {}) {
    this.begin(); this.now = t;
    this.take(this.listener.update(a, t, dt, opts), a);
    this.flow(dt);
    return this.ev;
  }
}

// A short track on a loop, so every part of the show can be seen without sound. In beats: 16 intro, 32 groove,
// 8 quiet and 8 build-up, then the drop into 32 at the peak and 16 stripped back. flow: music without a kick instead:
// phrases that swell and fall away over half a minute, with the attacks of single notes on top.
export function demo(signals, bpm = 130, flow = false) {
  if (flow) return t => {
    const swell = Math.pow(0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 28), 1.5) * (0.65 + 0.35 * Math.sin(t * 0.045)), note = Math.exp(-((t * bpm / 60) % 1) * 5);
    return { bass: 0.12 + 0.4 * swell, mid: (0.18 + 0.55 * swell) * (0.8 + 0.2 * Math.sin(t * 0.9)), high: 0.08 + 0.3 * swell * (0.6 + 0.4 * note), accent: note * 0.5 * swell, kick: false, density: 0.3 };
  };
  let last = -1;
  return t => {
    const pos = t * bpm / 60, beat = Math.floor(pos), phase = pos - beat, bar = beat % 112;
    const breakdown = bar >= 48 && bar < 64, build = bar >= 56 && bar < 64;
    const density = bar < 16 ? 0.25 : bar < 48 ? 0.7 : bar < 96 ? 1 : 0.4;
    const kick = beat !== last && !breakdown;
    if (beat !== last && bar === 0) signals.listener.sections.reset();   // the loop starts over as a new track
    last = beat;
    return {
      bass: breakdown ? 0.1 : Math.exp(-phase * 6),
      mid: (0.35 + 0.25 * Math.sin(t * 0.5)) * (0.4 + 0.6 * density) + (breakdown ? 0.2 : 0),
      high: build ? 0.6 + 0.4 * (bar - 56 + phase) / 8 : Math.exp(-((phase + 0.5) % 1) * 10) * 0.5 * density,
      kick, density,
    };
  };
}
