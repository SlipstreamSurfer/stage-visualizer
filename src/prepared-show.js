// A prepared show: a cue list for one local audio file, written in bars of the track's own tempo. While that file
// plays, the show follows it instead of guessing what the music does: the parts of the track (intro, groove, peak,
// a quiet part, a break with its build), the drops on their exact beat, and the looks, colours, effects and camera
// cuts. The levels (energy, bass, the highs) still come from listening, so the light keeps breathing with the sound.
// A prepared show is a local file, shows/<audio file name>.json, kept out of the repository. See
// docs/prepared-shows.md for the format.
import { HEAD_LOOKS, TRUSS_LOOKS } from './hangar-looks.js';
import { CHOREOGRAPHIES } from './light-choreography.js';
import { SHOW_THEMES } from './show-themes.js';

const SECTIONS = ['intro', 'groove', 'peak', 'low', 'break'];
const FIRE = ['co2', 'spark', 'flame', 'firework', 'confetti'];
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const colour = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : null;

// Checks a show file and returns a clean copy; throws an Error that says what is wrong.
export function normalizeShow(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('not an object');
  if (!num(raw.bpm, 40, 240)) throw new Error('bpm must be a number between 40 and 240');
  const show = { name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'Prepared show', bpm: raw.bpm, offset: num(raw.offset, 0, 60) ? raw.offset : 0, beatsPerBar: num(raw.beatsPerBar, 2, 8) ? raw.beatsPerBar : 4 };
  const at = (item, what) => {
    const bar = item.bar + (num(item.beat, 1, 16) ? (item.beat - 1) / show.beatsPerBar : 0);
    if (!num(item.bar, 1, 10000)) throw new Error(`${what}: bar must be 1 or more`);
    return bar;
  };
  if (!Array.isArray(raw.parts) || !raw.parts.length) throw new Error('parts must list the parts of the track');
  show.parts = raw.parts.map((p, i) => {
    if (p.end) return { bar: at(p, `part ${i + 1}`), end: true };
    if (!SECTIONS.includes(p.section)) throw new Error(`part ${i + 1}: section must be one of ${SECTIONS.join(', ')}`);
    const build = Array.isArray(p.build) && p.build.length === 2 && p.build.every(v => num(v, 0, 1)) ? p.build : [0, 0];
    return { bar: at(p, `part ${i + 1}`), section: p.section, kick: typeof p.kick === 'boolean' ? p.kick : p.section !== 'break', build, drop: p.drop === true, name: typeof p.name === 'string' ? p.name.slice(0, 80) : '' };
  }).sort((a, b) => a.bar - b.bar);
  show.cues = (Array.isArray(raw.cues) ? raw.cues : []).map((c, i) => {
    const what = `cue ${i + 1}`, cue = { bar: at(c, what) };
    if (c.heads !== undefined) { if (c.heads !== 'auto' && !HEAD_LOOKS[c.heads]) throw new Error(`${what}: unknown heads look ${c.heads}`); cue.heads = c.heads; }
    if (c.trusses !== undefined) { if (c.trusses !== 'auto' && !TRUSS_LOOKS.some(f => f.name === c.trusses)) throw new Error(`${what}: unknown truss formation ${c.trusses}`); cue.trusses = c.trusses; }
    if (c.choreography !== undefined) { if (!CHOREOGRAPHIES[c.choreography]) throw new Error(`${what}: unknown choreography ${c.choreography}`); cue.choreography = c.choreography; }
    if (c.theme !== undefined) { if (c.theme !== 'auto' && !SHOW_THEMES[c.theme]) throw new Error(`${what}: unknown theme ${c.theme}`); cue.theme = c.theme; }
    if (c.colors !== undefined) { const list = Array.isArray(c.colors) ? c.colors.map(colour) : []; if (!list.length || list.length > 4 || list.includes(null)) throw new Error(`${what}: colors must list one to four #rrggbb colours`); cue.colors = list; }
    if (c.fire !== undefined) { if (!Array.isArray(c.fire) || !c.fire.every(k => FIRE.includes(k))) throw new Error(`${what}: fire can list ${FIRE.join(', ')}`); cue.fire = c.fire; }
    for (const key of ['strobe', 'blinder']) if (c[key] !== undefined) { if (!num(c[key], 0, 64)) throw new Error(`${what}: ${key} is a number of beats`); cue[key] = c[key]; }
    if (c.camera !== undefined) { if (c.camera !== 'auto' && !(Number.isInteger(c.camera) && c.camera >= 0 && c.camera < 16)) throw new Error(`${what}: camera is a shot number or auto`); cue.camera = c.camera; cue.cut = c.cut === 'hard' ? 'hard' : 'fade'; }
    return cue;
  }).sort((a, b) => a.bar - b.bar);
  return show;
}

// Follows a normalized show along the file's own clock. step(time) returns what the show does at that moment:
// the music as the show file describes it, the looks in force, and the one-off events since the previous step.
export class PreparedShow {
  constructor(show) {
    Object.assign(this, show);
    this.beat = 60 / show.bpm; this.barSeconds = this.beat * show.beatsPerBar;
    this.endBar = show.parts.find(p => p.end)?.bar ?? Infinity;
    this.last = null;
  }
  time(bar) { return this.offset + (bar - 1) * this.barSeconds; }
  get end() { return this.time(this.endBar); }
  bar(time) { return 1 + (time - this.offset) / this.barSeconds; }
  partAt(bar) { let part = null; for (const p of this.parts) if (p.bar <= bar && !p.end) part = p; return part; }
  step(time) {
    const bar = this.bar(time), part = this.partAt(bar), playing = part && bar < this.endBar;
    const beats = (time - this.offset) / this.beat, previous = this.last;
    // a jump (a seek, or a pause and play) starts afresh: nothing fires for the passage skipped
    const fresh = !previous || time < previous.time - 0.01 || time - previous.time > 0.5;
    const out = { time, bar, playing, part, beats, phase: Math.max(0, beats), section: part?.section ?? 'intro', kick: !!part?.kick,
      build: 0, beatNow: false, drop: false, from: null, events: [], looks: {} };
    if (part) {
      const next = this.parts.find(p => p.bar > part.bar), span = Math.max(1e-6, (next?.bar ?? part.bar + 8) - part.bar);
      out.build = part.build[0] + (part.build[1] - part.build[0]) * Math.min(1, Math.max(0, (bar - part.bar) / span));
    }
    for (const cue of this.cues) {   // the looks in force: every cue up to now, later ones winning
      if (cue.bar > bar + 1e-9) break;
      for (const key of ['heads', 'trusses', 'choreography', 'theme', 'colors']) if (cue[key] !== undefined) out.looks[key] = cue[key];
    }
    if (!fresh && playing) {
      const from = previous.bar;
      out.beatNow = Math.floor(previous.beats) < Math.floor(beats);
      for (const p of this.parts) if (p.bar > from && p.bar <= bar) {
        const before = this.partAt(p.bar - 1e-6);
        if (before && before.section !== p.section) out.from = before.section;
        if (p.drop) { out.drop = true; out.breakBeats = before?.section === 'break' ? Math.round((p.bar - this.breakStart(p.bar)) * this.beatsPerBar) : 0; }
      }
      for (const cue of this.cues) if (cue.bar > from && cue.bar <= bar) out.events.push(cue);
    }
    if (out.drop) this.dropAt = time;
    out.dropPulse = this.dropAt !== undefined && time >= this.dropAt ? Math.exp(-(time - this.dropAt) / 1.2) : 0;
    out.sinceBeat = (beats - Math.floor(beats)) * this.beat;
    this.last = out;
    return out;
  }
  // where the break before a bar began
  breakStart(bar) { let start = bar; for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; if (p.bar >= bar) continue; if (p.section === 'break' && !p.end) start = p.bar; else break; } return start; }
}

// What the director reads while a prepared show runs: the parts, beat and drops from the show, the levels from the
// music. sig is the live Signals; s the result of PreparedShow.step.
export function preparedSignals(sig, s, show) {
  const brk = s.section === 'break', pulse = s.kick ? Math.exp(-s.sinceBeat * 9) : 0;
  return {
    m: { ...sig.m, section: s.section, phase: brk ? 'break' : 'groove', build: brk ? s.build : 0, riser: 0, hasGrooved: true, bpm: show.bpm },
    ev: { ...sig.ev, kick: (s.beatNow && s.kick) || s.drop ? 1 : 0, drop: s.drop, from: s.from, breakLength: s.breakBeats || 0, lift: false, broke: !!s.from && brk },
    phase: s.phase, beats: Math.max(0, Math.floor(s.beats)), kick: Math.max(pulse * 0.9, s.dropPulse), drop: s.dropPulse,
    energy: sig.energy, bass: sig.bass, mid: sig.mid, treble: sig.treble, accent: sig.accent, hype: s.section === 'peak' ? Math.max(sig.hype, 0.4) : sig.hype, lift: sig.lift,
    sinceBreak: brk ? Math.max(0, s.bar - show.breakStart(s.bar + 1e-6)) * show.barSeconds : 0,
    stableBpm: show.bpm,
  };
}
// The controls the director sees: the viewer's own, with the looks the show has in force.
export function preparedControls(controls, looks) {
  const c = { ...controls };
  if (looks.heads !== undefined) c.headLook = looks.heads;
  if (looks.trusses !== undefined) c.trussLook = looks.trusses;
  if (looks.choreography !== undefined) c.lightChoreography = looks.choreography;
  if (looks.theme !== undefined) c.showTheme = looks.theme;
  if (looks.colors !== undefined) { c.colors = looks.colors; c.palette = 'auto'; }
  return c;
}
