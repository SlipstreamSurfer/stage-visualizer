// Listening: everything the show knows about the music. Nothing in this file touches the page or the picture, so the
// same code runs in the browser, in tools/replay.mjs and in the tests.
//
//   MusicResponse   band levels, kicks and high accents from one frame of sound
//   TempoTracker    the tempo, from the rhythm as a whole
//   SectionTracker  where in the track we are (intro, groove, peak, low, break)
//   Listener        ties them together: break and drop, silence, build-up, a new layer coming in

// ---------- Levels, kicks and accents ----------
// Linear spectral energy preserves transients that averaged byte/dB values flatten.
// All envelopes use seconds, so detection behaves the same at different frame rates.
export class MusicResponse {
  constructor() {
    this.refs = [0.018, 0.006, 0.002];
    this.floors = [...this.refs];
    this.fast = [0, 0, 0];
    this.slow = [0, 0, 0];
    this.levels = [0, 0, 0];
    this.armed = true;
    this.highArmed = true;
    this.lastKick = -10;
    this.lastAccent = -10;
    this.level = 0;
    this.bed = [0, 0, 0];
    this.near = [0, 0, 0];
    this.far = [0, 0, 0];
  }

  update(raw, rms, t, dt, sens) {
    dt = Math.max(0.001, Math.min(dt, 0.1));
    const follow = (v, target, seconds) => v + (target - v) * (1 - Math.exp(-dt / seconds));
    const clamp = v => Math.max(0, Math.min(1, v));
    // A fixed noise gate keeps quiet input from being amplified into a light show.
    const gate = clamp((rms - 0.0025) / 0.0075);
    const transients = [];
    for (let i = 0; i < 3; i++) {
      const x = raw[i];
      this.refs[i] = Math.max(this.floors[i], follow(this.refs[i], x, x > this.refs[i] ? 0.025 : 8));
      this.fast[i] = follow(this.fast[i], x, 0.012);
      this.slow[i] = follow(this.slow[i], x, 0.22);
      this.bed[i] = follow(this.bed[i], x, 1.5);
      transients[i] = Math.max(0, (this.fast[i] - this.slow[i]) / this.refs[i]) * gate;
      const target = clamp(Math.pow(x / this.refs[i], 0.75) * 0.85 * sens) * gate;
      this.levels[i] = follow(this.levels[i], target, target > this.levels[i] ? 0.018 : 0.12);
    }
    // A band that settles clearly above its own recent level means a new layer came in.
    let step = 0, steady = true;
    for (const [i, floor, rise] of [[0, 0.05, 0.12], [2, 0.03, 0.035]]) {
      this.near[i] = follow(this.near[i], this.levels[i], 1);
      this.far[i] = follow(this.far[i], this.levels[i], 8);
      const ratio = this.near[i] / Math.max(this.far[i], floor);
      if (ratio > 1.2) steady = false;
      if (this.near[i] - this.far[i] > rise) step = Math.max(step, ratio);
    }
    const threshold = 0.105 / Math.sqrt(sens);
    if (transients[0] < threshold * 0.4 || gate === 0) this.armed = true;
    const kick = this.armed && gate > 0.2 && transients[0] > threshold &&
      raw[0] > this.refs[0] * 0.2 && t - this.lastKick > 0.22;
    if (kick) { this.armed = false; this.lastKick = t; }
    const highThreshold = 0.12 / Math.sqrt(sens);
    if (transients[2] < highThreshold * 0.4 || gate === 0) this.highArmed = true;
    const accent = this.highArmed && transients[2] > highThreshold && t - this.lastAccent > 0.09;
    if (accent) { this.highArmed = false; this.lastAccent = t; }
    this.level = follow(this.level, gate, gate > this.level ? 0.025 : 0.18);
    return {
      bass: this.levels[0], mid: this.levels[1], high: this.levels[2],
      inputRms: rms, rawBass: raw[0], rawMid: raw[1], rawHigh: raw[2],
      bassOnset: transients[0], highOnset: transients[2], kickThreshold: threshold,
      bassRise: Math.max(0, this.fast[0] - this.slow[0]) * gate,   // the same hit in the bass, in plain amplitude
      kick, kickStrength: clamp(0.45 + transients[0] * 1.5),
      accent: accent ? clamp(transients[2] * 1.6) : 0, level: this.level,
      // slow band levels for judging a swell during a break, floored so near-silence cannot fake one
      bedMid: Math.max(this.bed[1], this.floors[1] * 0.01), bedHigh: Math.max(this.bed[2], this.floors[2] * 0.01),
      step, steady,
    };
  }
}

// ---------- Tempo ----------
// Counting the time between kicks goes wrong as soon as a kick is missed or a tom is taken for one. This listens to
// the rhythm as a whole instead: it keeps the last twelve seconds of bass hits on a fixed grid and looks for the beat
// length at which that pattern lines up with itself over several beats in a row.
export class TempoTracker {
  constructor() {
    this.rate = 100;                       // grid points per second
    this.env = new Float32Array(1200);     // twelve seconds
    this.at = 0; this.filled = 0; this.clock = 0; this.peak = 0; this.sinceEstimate = 0;
    this.bpm = 0; this.confidence = 0;
    this.heldFor = 0; this.rival = 0; this.rivalFor = 0;   // how long the tempo has been this, and what it might be instead
    this.home = 0; this.homeFor = 0;                       // the tempo this track has had longest
  }
  // onset: how hard the bass just hit (0 when it did not); kicks: the tempo the kicks themselves keep, when they run
  // steadily (0 when they do not); hold: the kick is out, so what is heard now is not the beat
  update(dt, onset, kicks = 0, hold = false) {
    this.kicks = kicks; this.hold = hold;
    this.peak = Math.max(this.peak, onset);
    this.clock += dt;
    // A frame is longer than a grid point. Every point it covers gets the frame's value: filling one and leaving the
    // rest empty puts a pattern of the frame rate into the grid, and the tempo then sticks to that instead.
    let wrote = false;
    while (this.clock >= 1 / this.rate) {
      this.clock -= 1 / this.rate;
      this.env[this.at] = this.peak; wrote = true;
      this.at = (this.at + 1) % this.env.length;
      this.filled = Math.min(this.filled + 1, this.env.length);
    }
    if (wrote) this.peak = 0;
    this.sinceEstimate += dt;
    if (this.sinceEstimate >= 1 && this.filled >= 600) { this.sinceEstimate = 0; this.estimate(); }
    return this;
  }
  estimate() {
    const n = this.filled, len = this.env.length, x = new Float32Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) { x[i] = Math.min(this.env[(this.at - n + i + len) % len], 2); mean += x[i]; }
    mean /= n;
    let energy = 0;
    for (let i = 0; i < n; i++) { x[i] -= mean; energy += x[i] * x[i]; }
    if (energy < 1e-4) { this.confidence = 0; return; }
    // how well the pattern matches itself shifted by every lag up to four slow beats
    const maxLag = Math.min(n - 100, Math.ceil(4 * 60 / 100 * this.rate) + 2), ac = new Float32Array(maxLag + 1);
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < n; i++) sum += x[i] * x[i - lag];
      ac[lag] = sum / energy * n / (n - lag);
    }
    const at = lag => { const i = Math.floor(lag), f = lag - i; return i + 1 <= maxLag ? ac[i] * (1 - f) + ac[i + 1] * f : 0; };
    let best = 0, bestScore = -1, total = 0, count = 0;
    for (let bpm = 100; bpm <= 180; bpm += 0.25) {
      const beat = 60 / bpm * this.rate;
      const score = (at(beat) + at(beat * 2) + at(beat * 3) + at(beat * 4)) / 4;
      total += Math.max(0, score); count++;
      if (score > bestScore) { bestScore = score; best = bpm; }
    }
    this.confidence = Math.max(0, Math.min(1, bestScore * 1.6)) * Math.max(0, Math.min(1, (bestScore - total / count) * 6));
    if (!this.bpm) { if (this.confidence > 0.4) { this.bpm = best; this.heldFor = 0; } return; }
    // the same tempo, a little up or down: follow it. (An estimate comes once a second, so these count seconds.)
    const keep = () => { this.heldFor++; this.rivalFor = 0; if (Math.abs(this.bpm - this.home) <= 2) this.homeFor++; else if (this.heldFor > this.homeFor) { this.home = this.bpm; this.homeFor = this.heldFor; } };
    if (Math.abs(best - this.bpm) <= 1.5) { if (this.confidence > 0.25) this.bpm += (best - this.bpm) * 0.3; keep(); return; }
    // Another tempo. A track does not change its tempo halfway: what changes is the pattern. A kick roll, a bass
    // line of three notes to four beats or the rhythm of a break all line up with themselves at another tempo than
    // the track has. So the tempo we have stays while the kick is out, while it still fits, and while the kicks
    // themselves keep its time; and what is left has to last before it is believed: longest when it stands to
    // ours as three to four or the like, shortest when we had only just settled, or when it is the tempo this
    // track has had most of the time.
    if (this.hold) return;
    const beat = 60 / this.bpm * this.rate, current = (at(beat) + at(beat * 2) + at(beat * 3) + at(beat * 4)) / 4;
    if (current > bestScore * 0.85) { keep(); return; }   // ours still fits: a new one has to be clearly better or it is only a wobble
    if (this.confidence <= 0.25) return;
    const near = (p, q) => Math.abs(p - q) / q < 0.04, ratio = best / this.bpm;
    if (this.kicks && near(this.kicks, this.bpm) && !near(this.kicks, best)) { this.rivalFor = 0; return; }
    this.rivalFor = Math.abs(best - this.rival) <= 1.5 ? this.rivalFor + 1 : 1; this.rival = best;
    const simple = [1 / 2, 2 / 3, 3 / 4, 4 / 5, 5 / 4, 4 / 3, 3 / 2, 2].some(q => Math.abs(ratio / q - 1) < 0.03);
    const patience = this.heldFor < 15 || Math.abs(best - this.home) <= 2 ? 2 : simple ? 24 : this.kicks && near(this.kicks, best) ? 5 : 12;
    if (this.rivalFor >= patience) { this.bpm = best; this.heldFor = 0; this.rivalFor = 0; }
  }
}

// ---------- Where in the track are we ----------
// Reads the arrangement of a track from how full it sounds. In techno the kick and bass barely change from the first
// bar to the last; what comes and goes are the layers on top (hats, percussion, synths). The tracker follows the slow
// level of the mid and high bands against the fullest this track has been, and sorts the playing parts into:
//   intro  - kick with little on top, before the track has opened up
//   groove - the track is running, but not everything is in
//   peak   - everything is in
//   low    - stripped back after the track has been full: a quiet middle part or the outro
//   break  - no kick
// It also reports a lift: a layer coming in while the kick keeps going.
export class SectionTracker {
  constructor() { this.reset(); }
  reset() {   // a new track
    this.bed = [0, 0, 0];           // slow levels of bass, mid and high
    this.ref = [0, 0];              // the fullest mid and high so far, the yardstick for this track
    this.density = 0; this.near = 0; this.far = 0;
    this.section = 'intro'; this.wasFull = false; this.fullFor = 0;
    this.pending = null; this.pendingFor = 0; this.hold = 0; this.kickFor = 0; this.lifted = 100;
  }
  // raw: band amplitudes [bass, mid, high]; kicking: a kick is running; dropped: the kick just came back after a real
  // break; given: a density to use as is (demo mode)
  update(dt, raw, kicking, dropped, given) {
    const follow = (v, target, seconds) => v + (target - v) * (1 - Math.exp(-dt / seconds));
    const clamp = v => Math.max(0, Math.min(1, v));
    for (let i = 0; i < 3; i++) this.bed[i] = follow(this.bed[i], raw[i], this.kickFor < 3 && kicking ? 1 : 3);
    this.kickFor = kicking ? this.kickFor + dt : 0;
    this.lifted += dt;
    // The yardstick only learns while the kick runs (a riser in a break is louder than any groove), never drops
    // below what a full track usually has relative to its bass, and forgets slowly.
    const floors = [this.bed[0] * 0.04, this.bed[0] * 0.012];
    for (let i = 0; i < 2; i++) {
      const held = this.ref[i] * Math.exp(-dt / 400);
      this.ref[i] = Math.max(1e-9, kicking && this.kickFor > 3 ? Math.max(floors[i], this.bed[i + 1], held) : Math.max(held, kicking ? floors[i] : 0));
    }
    const fullness = (i, octaves) => clamp(1 + Math.log2(Math.max(this.bed[i + 1], 1e-9) / this.ref[i]) / octaves);
    const density = given ?? 0.4 * fullness(0, 2.5) + 0.6 * fullness(1, 5);
    this.density = kicking ? density : follow(this.density, 0, 4);

    let lift = false;
    if (!kicking) {
      this.section = 'break'; this.pending = null; this.near = this.far = 0;
      return { section: this.section, density: this.density, lift };
    }
    if (this.section === 'break') {
      // back from a break: a drop lands in the peak, anything else picks up where the track is
      this.section = dropped ? 'peak' : this.wasFull ? 'groove' : 'intro';
      this.hold = dropped ? 7 : 3;
      this.near = this.far = density;
    }
    this.near = follow(this.near, density, 2);
    this.far = follow(this.far, density, 10);
    if (this.near - this.far > 0.1 && this.kickFor > 12 && this.lifted > 12) { lift = true; this.lifted = 0; }

    this.fullFor = density >= 0.7 ? this.fullFor + dt : 0;
    if (this.fullFor > 8) this.wasFull = true;
    this.hold -= dt;
    // sticky borders: a part has to be clearly over a border, and stay there, before the section changes
    const sticky = (border, above) => density >= border + (above ? -0.04 : 0.04);
    const isPeak = sticky(0.85, this.section === 'peak'), isOpen = sticky(0.55, this.section === 'peak' || this.section === 'groove');
    const want = isPeak ? 'peak' : isOpen ? 'groove' : this.wasFull ? 'low' : 'intro';
    if (want === this.section || this.hold > 0) { this.pending = null; }
    else {
      if (this.pending !== want) { this.pending = want; this.pendingFor = 0; }
      this.pendingFor += dt;
      const rank = { intro: 0, low: 0, groove: 1, peak: 2 };
      if (this.pendingFor > (rank[want] > rank[this.section] ? 2 : 5)) { this.section = want; this.pending = null; this.hold = 6; }
    }
    return { section: this.section, density: this.density, lift };
  }
}

// ---------- The listener ----------
// One per sound source. Feed it every frame; it keeps what it knows in `state` (the page hands in its show state, so
// the lights read the same object) and returns what happened in this frame.
//   phase      'groove' while the kick runs, and while it is held back for a bar or two (a pause: the show holds its
//              look); 'break' once it has been gone longer than that; a kick after a long break is a drop
//   out        the kick is not there right now, whether that is a pause or a break
//   build      tension during a break, 0 to 1; riser is the swell alone
//   activity   whether there is music at all, 0 to 1
// How long the kick may be gone, in beats, counted from the last kick. Tracks hold the kick back for a bar or two
// all the time (the next kick is then five or nine beats after the last): that is a fill, not a break, and the show
// holds its look through it. Longer than that is a break. And a kick that returns is only a drop when it was out
// for about four bars or more: fifteen to seventeen beats after the last one, as a break often starts with one
// more kick on its first beat or ends a beat early. Before that it simply comes back in. (In the recordings the
// show was tuned on, the time without a kick is twelve or thirteen beats or fifteen and up, seldom fourteen.)
export const PAUSE_BEATS = 10.5, DROP_BEATS = 14.5;

export class Listener {
  constructor(state = {}) {
    this.s = Object.assign(state, { density: 0, breakAt: 0, riser: 0, minMid: Infinity, minHigh: Infinity, activity: 1 });
    this.reset();
  }
  reset() {   // another sound source
    this.music = new MusicResponse(); this.sections = new SectionTracker(); this.tempo = new TempoTracker();
    this.kicks = 0; this.dropped = false; this.part = { section: 'intro', density: 0, lift: false };
    this.kickRef = 0;      // how hard this track's kick hits; see heardKick
    this.weakRun = 0; this.lastWeak = -10; this.lastPeak = 0; this.measuring = false; this.hit = null;
    this.recent = []; this.grid = null;   // the last kicks, and the beat grid they lay down; see onGrid
    Object.assign(this.s, {
      phase: 'break', out: false, outAt: 0, lastKick: -10, bpm: 0, kickBpm: 0, gaps: [], hasGrooved: false, silentFor: 0,
      section: 'intro', build: 0, grooveAt: 1e9, liftAt: -100, liftArmed: true,
    });
  }
  // bands: amplitudes of bass (35-170 Hz), mid (250-3000 Hz) and high (4000-14000 Hz); rms: of the waveform
  hear(bands, rms, t, dt, sens = 1) { return this.music.update(bands, rms, t, dt, sens); }
  // Is this bass hit the kick? MusicResponse reports every clear hit in the bass. In real tracks that is not enough:
  //  - A breakdown has bass notes, toms and soft kick rolls that are clear hits too, several times weaker than the
  //    track's kick. Taken for kicks they end the break again and again and set off drops that are not there. So a
  //    break only ends on a hit that is at least half as hard as this track's kick. Weaker hits are passed over,
  //    unless they keep coming on the beat for sixteen in a row: then the track really has a softer kick now.
  //  - A bass note between two kicks (house) would count as a kick. Once the tempo is known, a hit that comes well
  //    before the next beat is passed over, unless it is clearly harder than the last kick (then that one was the
  //    note in between, and this is the kick).
  // How hard a hit is only shows over its first few frames, so a hit that looks too soft gets that long to prove
  // itself; a kick that is accepted that way is two frames late, which nobody sees.
  //  - Through a break the beat goes on, even with no kick to mark it. A hit that falls clearly between two beats of
  //    the old grid is a fill or a pick-up note, not the kick coming back, however hard it is. (Only in the first half
  //    minute of a break; after that the grid has drifted too far to say.)
  // Called every frame. Returns 'kick', 'soft' (the softer kick that has proven itself) or null.
  // The beat grid of the last kicks: a line through their times, so it can be carried on through a break. Made when a
  // break begins. Twenty-odd kicks pin the beat down to a fraction of a millisecond, which is what it takes to still
  // be right a minute later.
  layGrid() {
    const T = this.recent, n = T.length;
    this.grid = null;
    if (n < 12) return;
    const gaps = []; for (let i = 1; i < n; i++) gaps.push(T[i] - T[i - 1]);
    const b0 = gaps.sort((p, q) => p - q)[gaps.length >> 1];
    let sk = 0, st = 0, skk = 0, skt = 0;
    for (let i = 0; i < n; i++) { const k = Math.round((T[i] - T[0]) / b0); sk += k; st += T[i]; skk += k * k; skt += k * T[i]; }
    const b = (n * skt - sk * st) / (n * skk - sk * sk), a = (st - b * sk) / n;
    if (Math.abs(b / b0 - 1) < 0.03) this.grid = { a, b };
  }
  // how far a moment is from the nearest beat of that grid, in beats (0 on the beat, 0.5 right between two)
  offGrid(t) { if (!this.grid) return 0.5; const k = (t - this.grid.a) / this.grid.b; return Math.abs(k - Math.round(k)); }

  heardKick(a, t) {
    const s = this.s, rise = a.bassRise;
    if (rise === undefined) return a.kick ? 'kick' : null;   // the demo brings its own kicks
    if (this.measuring) {   // the last kick is still showing how hard it hits
      this.lastPeak = Math.max(this.lastPeak, rise);
      if (t - this.kickAt > 0.05) {
        this.measuring = false;
        // learns quickly that the kick is harder, slowly that it is softer
        this.kickRef = this.kickRef ? this.kickRef + (this.lastPeak - this.kickRef) * (this.lastPeak > this.kickRef ? 0.25 : 0.03) : this.lastPeak;
      }
    }
    if (a.kick) this.hit = { at: t, peak: 0, since: t - s.lastKick, before: this.lastPeak };
    const hit = this.hit;
    if (!hit) return null;
    hit.peak = Math.max(hit.peak, rise);
    const beat = this.tempo.bpm && this.tempo.confidence > 0.4 ? 60 / this.tempo.bpm : 0;
    // while the kick is out: too soft to be this track's kick, or (while the old grid can still be trusted) clearly between two beats
    const away = s.out || s.phase === 'break';
    const weak = away && this.kickRef > 0 && (hit.peak < this.kickRef * 0.5 || (this.grid && hit.at - s.outAt < 30 && this.offGrid(hit.at) > 0.2));
    const between = !away && beat > 0 && hit.since < beat * 0.7 && hit.peak < hit.before * 1.5;
    if ((weak || between) && t - hit.at < 0.04) return null;   // not judged yet
    this.hit = null;
    if (between) return null;
    if (weak) {
      const gap = hit.at - this.lastWeak, onBeat = beat ? Math.abs(gap / beat - 1) < 0.2 : gap > 0.26 && gap < 1.1;
      this.weakRun = onBeat ? this.weakRun + 1 : 1;
      this.lastWeak = hit.at;
      if (this.weakRun < 16) return null;
      this.kickRef = hit.peak;
    }
    this.weakRun = 0;
    this.measuring = true; this.kickAt = hit.at; this.lastPeak = hit.peak;
    return weak ? 'soft' : 'kick';
  }
  // a: what hear() returned (or the demo's stand-in); dt: the frame time, capped; gap: the real time since the last
  // frame; live: false for the demo, which brings its own kick and density
  update(a, t, dt, { live = true, gap = dt } = {}) {
    const s = this.s;
    const ev = { kick: 0, kickGap: 0, drop: false, breakLength: 0, broke: false, back: 0, silent: false, trackEnded: false, from: null, lift: false };
    // After a pause in rendering (a hidden tab), do not mistake the gap for a break followed by a drop.
    if (gap > 0.5) { s.lastKick += gap; s.breakAt += gap; s.outAt += gap; }
    // The demo's track is a short one made to show every part: there the kick gone is a break at once, as it was.
    const beatNow = s.bpm ? 60 / s.bpm : 0.5, breakAfter = live ? beatNow * PAUSE_BEATS : Math.max(1.3, beatNow * 2.6), dropAfter = live ? beatNow * DROP_BEATS : 3;
    const since = t - s.lastKick, heard = this.heardKick(a, t);
    if (heard) {
      if (since > 0.26 && since < 1.1) {
        s.gaps.push(since);
        if (s.gaps.length > 8) s.gaps.shift();
        // a rough tempo until the tracker has one: the time between the last kicks, leaving out the longest and the
        // shortest, once there are three and only while they agree (kicks at uneven distances say nothing about the tempo)
        const mid = [...s.gaps].sort((x, y) => x - y).slice(s.gaps.length >> 2, s.gaps.length - (s.gaps.length >> 2));
        if (s.gaps.length >= 3 && mid.at(-1) < mid[0] * 1.08) s.kickBpm = Math.round(60 * mid.length / mid.reduce((p, q) => p + q, 0));
      }
      if (s.phase === 'break') {
        s.phase = 'groove';
        s.grooveAt = t;
        if (since > dropAfter && s.hasGrooved && heard === 'kick') {
          // a drop lands in the fullest part; the tracker is told the same
          ev.drop = true; ev.breakLength = t - s.breakAt; this.dropped = true; s.section = 'peak'; s.build = 0;
        }
      } else if (s.out) { ev.back = since; s.liftArmed = false; }   // back after a pause: it was no break, the show carries on where it was (and the bass stepping back up is not a new layer)
      s.out = false;
      ev.kick = a.kickStrength ?? 1; ev.kickGap = since;
      if (++this.kicks >= 4) s.hasGrooved = true;
      s.lastKick = t;
      this.recent.push(t); if (this.recent.length > 24) this.recent.shift();
      if (since > 1.1) this.recent = [t];   // after a gap the count starts again
    }
    // the tempo the kicks themselves keep: the usual time between the last eight, when most of them agree on it
    const usual = s.gaps.length >= 6 ? [...s.gaps].sort((x, y) => x - y)[s.gaps.length >> 1] : 0;
    const steady = usual && s.gaps.filter(g => Math.abs(g / usual - 1) < 0.06).length >= s.gaps.length - 2 ? 60 / usual : 0;
    this.tempo.update(dt, live ? a.bassOnset : a.kick ? 1 : 0, live ? steady : 0, live && (s.out || s.phase === 'break'));
    s.bpm = Math.round(this.tempo.bpm) || s.kickBpm;
    const beatLength = s.bpm ? 60 / s.bpm : 0.5;
    // the kick is gone: from here its hits are weighed as in a break, whatever this turns out to be
    if (s.phase === 'groove' && !s.out && t - s.lastKick > Math.max(1.3, beatLength * 2.6)) {
      s.out = true; s.outAt = t; s.minMid = s.minHigh = Infinity;
      this.layGrid();
    }
    // and it stays gone: a break, counted from when the kick went
    if (s.phase === 'groove' && s.out && t - s.lastKick > breakAfter) { s.phase = 'break'; s.breakAt = s.outAt; ev.broke = true; }
    s.silentFor = live && a.level < 0.03 ? s.silentFor + dt : 0;
    if (s.silentFor > 2.5) {   // the next kick belongs to another track
      ev.silent = true; ev.trackEnded = s.hasGrooved;
      s.hasGrooved = false; s.out = false; s.build = 0; this.kicks = 0; this.kickRef = 0; this.weakRun = 0; this.hit = null; this.recent = []; this.grid = null; s.bpm = s.kickBpm = 0; s.gaps.length = 0;
      if (this.tempo.bpm) this.tempo = new TempoTracker();
      this.sections.reset();
    }
    const brk = s.phase === 'break', paused = s.out && !brk;
    // where in the track we are; see SectionTracker. Through a pause the track is where it was: the tracker waits.
    const part = paused ? this.part : this.part = this.sections.update(dt, live ? [a.rawBass, a.rawMid, a.rawHigh] : [1, 1, 1], !brk, this.dropped, live ? undefined : a.density);
    if (paused) part.lift = false;
    this.dropped = false;
    s.density = part.density;
    if (part.section !== s.section) { ev.from = s.section; s.section = part.section; }
    // a new layer came in while the kick kept going: the tracker heard the track fill up, or a band stepped up
    const lifted = () => { ev.lift = true; s.liftAt = t; s.liftArmed = false; };
    if (part.lift && t - s.liftAt > 12) lifted();
    if (a.steady) s.liftArmed = true;
    if (live && !brk && !s.out && s.liftArmed && a.step > 1.4 && t - s.grooveAt > 14 && t - s.liftAt > 12) lifted();

    s.activity += ((a.level ?? 1) - s.activity) * Math.min(1, dt * 8);
    // the quietest it has been since the kick went, which a swell is measured against (from two seconds in: by then
    // the last kick has left the slow levels)
    if (live && s.out && t - s.outAt > 2) { s.minMid = Math.min(s.minMid, a.bedMid); s.minHigh = Math.min(s.minHigh, a.bedHigh); }
    // build-up: tension grows with the length of a break and with mids or highs swelling back in; the drop releases it.
    // riser is the swell alone, so only a clear riser (not a long quiet break) can start the build-up strobe.
    if (!brk) { s.build *= Math.exp(-dt * 6); s.riser *= Math.exp(-dt * 6); }
    else if (!live) {
      s.build = Math.max(0, Math.min(1, s.build + (a.high > 0.3 ? dt / 2.8 : -dt * 0.35)));
      s.riser = s.build;
    } else if (s.hasGrooved && s.activity > 0.3) {
      const T = t - s.breakAt, settled = T > 2;   // by then the last kick has left the slow levels
      const follow = (v, target, up, down) => v + (target - v) * (1 - Math.exp(-dt / (target > v ? up : down)));
      const swell = settled ? Math.max(Math.log2(a.bedHigh / s.minHigh), Math.log2(a.bedMid / s.minMid)) : 0;
      const riser = Math.max(0, Math.min(1, swell / 3));   // an eightfold swell counts as a full riser
      s.build = follow(s.build, Math.min(1, 0.35 * (1 - Math.exp(-T / 18)) + riser), 1, 8);
      s.riser = follow(s.riser, riser, 0.5, 2);
    } else { s.build *= Math.exp(-dt * 2); s.riser *= Math.exp(-dt * 2); }
    return ev;
  }
}
