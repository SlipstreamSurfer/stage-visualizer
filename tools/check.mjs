// Usage: node tools/check.mjs <recordings...> [--steady] [--write]      (or: npm run check -- rec/*/*.flac)
//
// Holds what the show's Listener hears in a recording against the second opinion made with hindsight
// (reference.mjs), and says where the two differ: a drop it missed or made up, a break it did not see, a break
// that was not there, how late it was, and where it read another tempo. The kick held back for a bar or two is
// a pause, not a break (see PAUSE_BEATS in listen.js): there the show is right to carry on. With --steady it also plays every recording at six frame rates and says
// where the show hears something else depending on the screen. With --write the result also goes to rec/report.md.
import fs from 'node:fs';
import path from 'node:path';
import { decode, hearing, listen, clock, RATE } from './hear.mjs';
import { reference } from './reference.mjs';
import { PAUSE_BEATS, DROP_BEATS } from '../src/listen.js';

const SLACK = 2;             // a difference shorter than this is the Listener needing a moment, not a mistake
const mmss = t => clock(t).trim();

// pcm: a recording. Returns what was right and wrong, in the recording's own time.
export function check(pcm) {
  const ref = reference(pcm), ear = hearing(), phase = [], events = [];
  const read = [];
  let nextSample = 0;
  ear.onFrame = t => { if (t >= nextSample) { phase.push(ear.state.phase === 'groove'); read.push(ear.state.bpm); nextSample += 0.1; } };   // what the show thinks, ten times a second
  events.push(...ear.push(pcm));
  const drops = events.filter(e => e.type === 'drop'), beat = 60 / ref.bpm;
  const out = { bpm: ref.bpm, heardBpm: ear.state.bpm, kicking: ref.kicking, issues: [], drops: { right: 0, late: [] }, agree: 0, seconds: pcm.length / RATE, ref };
  // the kick, as the second opinion has it, ten times a second. Before the first kick and after the last there is none.
  const kicking = new Array(phase.length).fill(false);
  if (ref.kicks.length) for (let i = Math.round(ref.kicks[0] * 10); i <= Math.min(phase.length - 1, Math.round(ref.kicks.at(-1) * 10)); i++) kicking[i] = true;
  for (const g of ref.gaps) for (let i = Math.round((g.from + beat * PAUSE_BEATS) * 10); i < Math.round(g.to * 10); i++) if (i < kicking.length) kicking[i] = false;   // a break only once the kick has been gone for longer than a pause
  // where the two disagree for longer than the slack
  let same = 0;
  for (let i = 0, from = -1; i <= phase.length; i++) {
    const differ = i < phase.length && phase[i] !== kicking[i];
    if (i < phase.length && !differ) same++;
    if (differ && from < 0) from = i;
    if (!differ && from >= 0) {
      const len = (i - from) / 10;
      if (len > SLACK) out.issues.push(phase[from] ? { t: from / 10, what: 'no break', detail: `the kick is gone, the show carries on as if it runs, for ${len.toFixed(0)} s` } : { t: from / 10, what: 'false break', detail: `the kick runs, the show is in a break, for ${len.toFixed(0)} s` });
      from = -1;
    }
  }
  out.agree = same / Math.max(1, phase.length);
  // drops: the kick back after a real gap
  const used = new Set();
  for (const g of ref.gaps) {
    if (g.to - g.from <= beat * DROP_BEATS + 0.4 || g.from < ref.kicks[3]) continue;   // too short to be one, or before the track has got going
    const hit = drops.find(d => !used.has(d) && Math.abs(d.t - g.to) < 0.35);
    if (hit) { used.add(hit); out.drops.right++; out.drops.late.push(hit.t - g.to); }
    else { const near = drops.find(d => !used.has(d) && d.t > g.from && d.t < g.to + 2); if (near) used.add(near);
      out.issues.push({ t: g.to, what: near ? 'drop at the wrong moment' : 'missed drop', detail: near ? `the kick comes back at ${mmss(g.to)}, the show called the drop at ${mmss(near.t)} (${near.t < g.to ? 'early' : 'late'} by ${Math.abs(near.t - g.to).toFixed(1)} s)` : `the kick comes back after ${(g.to - g.from).toFixed(0)} s without it; the show did not call a drop` }); }
  }
  for (const d of drops) if (!used.has(d)) {
    const gap = ref.gaps.find(g => Math.abs(g.to - d.t) < 0.6);
    out.issues.push({ t: d.t, what: 'false drop', detail: gap ? `the kick was gone for only ${(gap.to - gap.from).toFixed(1)} s` : 'the kick had not been away' });
  }
  // the tempo, while the kick runs and once the track has got going: every stretch of four seconds or more in which the show reads another one
  let off = 0, counted = 0;
  for (let i = 150, from = -1; i <= read.length; i++) {
    const on = i < read.length && kicking[i], wrong = on && Math.abs(read[i] - ref.bpm) / ref.bpm > 0.03;
    if (on) { counted++; if (wrong) off++; }
    if (wrong && from < 0) from = i;
    if (!wrong && from >= 0) { if (i - from >= 40) out.issues.push({ t: from / 10, what: 'tempo', detail: `the show reads ${read[from]} BPM for ${((i - from) / 10).toFixed(0)} s; the whole recording says ${ref.bpm.toFixed(1)}` }); from = -1; }
  }
  out.tempoRight = counted ? 1 - off / counted : 1;
  out.issues.sort((a, b) => a.t - b.t);
  return out;
}

// Does the show hear the same thing whatever the screen? The same recording is played at several frame rates, even
// and uneven, and the drops are compared. Returns the share of drops that every run agrees on (within 0.3 s), and
// the drops of each run. A show that is sure of what it hears gives 1.
const SCREENS = [[60, 0], [60, 0.25], [66, 0.1], [75, 0.2], [50, 0], [144, 0]];
export function steadiness(pcm) {
  const runs = SCREENS.map(([fps, jitter]) => listen(pcm, { fps, jitter }).events.filter(e => e.type === 'drop').map(e => e.t));
  const all = [];
  for (const run of runs) for (const t of run) if (!all.some(u => Math.abs(u - t) < 0.3)) all.push(t);
  const shared = all.filter(t => runs.every(run => run.some(u => Math.abs(u - t) < 0.3)));
  return { share: all.length ? shared.length / all.length : 1, drops: all.length, shared: shared.length, runs };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--')), lines = [];
  if (!files.length) { console.error('Usage: node tools/check.mjs <recordings...> [--write]'); process.exit(1); }
  const say = s => { console.log(s); lines.push(s); };
  const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
  let wrong = 0, agree = 0, count = 0, unsteady = 0;
  const steady = process.argv.includes('--steady');
  for (const file of files) {
    let r;
    let pcm;
    try { pcm = decode(file); r = check(pcm); } catch (e) { say(`\n${path.basename(file)}: cannot read (${e.message.split('\n')[0]})`); continue; }
    wrong += r.issues.length; agree += r.agree; count++;
    say(`\n${path.basename(file).replace(/\.\w+$/, '')}  (${mmss(r.seconds)}, ${r.bpm.toFixed(1)} BPM, the kick runs ${(r.kicking * 100).toFixed(0)}% of the time)`);
    say(`  the show and the second opinion agree ${(r.agree * 100).toFixed(1)}% of the time on whether the kick runs; ${r.drops.right} drops right${r.drops.late.length ? `, ${(mean(r.drops.late) * 1000).toFixed(0)} ms after the kick on average` : ''}`);
    if (steady) { const st = steadiness(pcm); if (st.share < 1) { unsteady++; say(`  UNSTEADY: of ${st.drops} drops heard at one frame rate or another, only ${st.shared} are heard at all six; the show is guessing here`); } }
    for (const i of r.issues) say(`  ${mmss(i.t).padStart(5)}  ${i.what.toUpperCase()}: ${i.detail}`);
    if (!r.issues.length) say('  nothing wrong');
  }
  say(`\n${count} recordings: agreement ${(agree / Math.max(1, count) * 100).toFixed(1)}%, ${wrong} things wrong${steady ? `, ${unsteady} unsteady` : ''}`);
  if (process.argv.includes('--write')) { fs.mkdirSync('rec', { recursive: true }); fs.writeFileSync('rec/report.md', '# What the show heard, checked\n\n```\n' + lines.join('\n') + '\n```\n'); }
}
