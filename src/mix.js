// The mix: what is on the DJ's players and what the mixer reads, kept from what the show hears. There is no picture
// in this file, so the tests run it too; decks.js draws the gear from it.
//
// Four players stand round a mixer, 0 to 3 from the DJ's left to right, each on the mixer's channel of that number;
// 1 and 2 are the ones next to the mixer. One of those plays: what the show hears is what is on it, and its
// waveform is the music as it comes in. When another track begins, it begins on the other one. For a while both
// play, the new one's channel coming up as the old one's goes down, the way a DJ brings one track in under another.
//
//   playing, leaving, next   the player that plays, the one whose track is going out (or -1), and the one with
//                            the next track ready at its cue point
//   mixing                   1 down to 0 while two tracks are in the mix
//   levels, peaks, master    what the mixer's meters read, 0 to 1, per channel; peaks stay up for a moment
//   wave(i)                  the music i columns back from now (COLS columns a second): [bass, mid, high]
//   elapsed(t), bpm, turn    the time the track has played, its tempo, and how far the jog wheels have turned
//   told(now, t)             what the computer's own music player says it is playing, when there is one to ask:
//                            then title names the track, and another track begins when it really does
export const COLS = 32;
const KEEP = 1024, MIX_SECONDS = 14, LONG = 330;   // columns kept; how long two tracks are mixed; a track that runs longer than this is mixed out at its next drop

export class Mix {
  constructor() {
    this.band = new Float32Array(KEEP * 3); this.head = 0; this.clock = 0; this.top = [0, 0, 0];
    Object.assign(this, { playing: 1, leaving: -1, next: 2, mixing: 0, started: 0, tracks: 1, bpm: 0, master: 0, turn: [0, 0, 0, 0],
      heard: false, quiet: true, other: 0, otherFor: 0, phase: 0, known: false, id: null, title: '', before: '' });
    this.levels = [0, 0, 0, 0]; this.peaks = [0, 0, 0, 0]; this.held = [0, 0, 0, 0];
  }
  wave(i) { const k = ((this.head - 1 - i) % KEEP + KEEP) % KEEP * 3; return [this.band[k], this.band[k + 1], this.band[k + 2]]; }
  elapsed(t) { return Math.max(0, t - this.started); }
  // another track: on the other player, mixed in under this one or (after a silence) simply started
  change(t, mixed) {
    this.leaving = mixed ? this.playing : -1; this.mixing = mixed ? 1 : 0;
    [this.playing, this.next] = [this.next, this.playing];
    this.started = t; this.tracks++; this.otherFor = 0;
  }
  // now: { id, playing, artist, title, position } from the music player, or nothing when there is none or it is not playing
  told(now, t) {
    if (!now?.id || !now.playing) { this.known = false; return; }
    const name = [now.artist, now.title].filter(Boolean).join(' - ');
    if (this.known && now.id !== this.id) { this.before = this.title; this.change(t, !this.quiet); }   // under the last track when the music has not stopped
    if (!this.known || now.id !== this.id) this.started = t - (this.known ? Math.min(now.position || 0, 5) : now.position || 0);
    Object.assign(this, { known: true, id: now.id, title: name });
  }
  // sig: Signals; t, dt: the show's clock
  update(sig, t, dt) {
    const m = sig.m, sounding = m.activity > 0.05;
    // the waveform: the loudest each band has been in every column's time
    this.top[0] = Math.max(this.top[0], sig.bass); this.top[1] = Math.max(this.top[1], sig.mid); this.top[2] = Math.max(this.top[2], sig.treble);
    for (this.clock += dt; this.clock >= 1 / COLS; this.clock -= 1 / COLS) { this.band.set(sounding ? this.top : [0, 0, 0], this.head * 3); this.head = (this.head + 1) % KEEP; this.top = [0, 0, 0]; }
    // Another track. When the music player tells which track plays (told), that decides. Otherwise it is guessed:
    // the first music after a silence starts on the other player; without a silence between them (tracks that run
    // into each other), a tempo that has moved and stayed is the next track being mixed in; and a track that has
    // run for a long time is mixed out at its next drop, as a set does not stay on one record.
    const guess = !this.known;
    if (sig.ev.silent) this.quiet = true;
    if (sounding && sig.ev.kick && this.quiet) { this.quiet = false; if (guess) { if (this.heard) this.change(t, false); else this.started = t; this.bpm = 0; } this.heard = true; }
    if (m.bpm && !this.bpm) this.bpm = m.bpm;
    if (m.bpm && this.bpm && Math.abs(m.bpm - this.bpm) > 1.5 && m.phase === 'groove') {
      this.otherFor = Math.abs(m.bpm - this.other) <= 1.5 ? this.otherFor + dt : 0; this.other = m.bpm;
      if (this.otherFor > 6) { this.bpm = m.bpm; if (guess && this.mixing < 0.05 && t - this.started > 30) this.change(t, true); }
    } else this.otherFor = 0;
    if (guess && sig.ev.drop && this.mixing < 0.05 && t - this.started > LONG) this.change(t, true);
    if (this.mixing > 0) { this.mixing = Math.max(0, this.mixing - dt / MIX_SECONDS); if (!this.mixing) this.leaving = -1; }
    // the mixer: every channel reads the music as far as its fader is up, and the master reads what goes out
    const level = sounding ? Math.min(1, 0.52 + sig.kick * 0.3 + sig.bass * 0.14 + sig.energy * 0.1) : 0, up = this.mixing * this.mixing;
    for (let i = 0; i < 4; i++) {
      const want = level * (i === this.playing ? 1 - up * 0.75 : i === this.leaving ? Math.sqrt(this.mixing) : 0);
      this.levels[i] += (want - this.levels[i]) * (1 - Math.exp(-dt / (want > this.levels[i] ? 0.015 : 0.22)));
      if (this.levels[i] >= this.peaks[i]) { this.peaks[i] = this.levels[i]; this.held[i] = t; } else if (t - this.held[i] > 0.9) this.peaks[i] = Math.max(this.levels[i], this.peaks[i] - dt * 1.2);
      if (sounding && (i === this.playing || i === this.leaving)) this.turn[i] += dt * Math.PI * 2 * 100 / 3 / 60;   // a jog wheel turns as a record does: 33 1/3 times a minute
    }
    this.master = Math.max(...this.levels) * 0.96;
    this.phase = sig.phase;
    return this;
  }
  // what a player is doing: 'play', 'out' (its track is going out of the mix), 'cue' (the next track, ready) or 'idle'
  state(i) { return i === this.playing ? 'play' : i === this.leaving ? 'out' : i === this.next ? 'cue' : 'idle'; }
}
