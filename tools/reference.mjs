// A second opinion on a recording, made with hindsight. The show's Listener hears a track as it plays and has to
// decide at once; this reads the whole recording first. It finds the tempo over the full length, lays a beat grid
// on it, and looks at every beat: is the kick there or not, measured against how hard this track's kick hits
// overall. From that it says where the breaks are and where the kick comes back.
//
// It is an estimate, not the truth: it assumes a kick on every beat (techno, house) and takes a hard hit in the
// bass on the beat for the kick. But it cannot be late, cannot be fooled by one soft hit, and knows the track's
// loudest and quietest parts before it judges any of them, which is what the Listener lacks.
import { RATE } from './hear.mjs';

const HOP = 480, FPS = RATE / HOP;   // 100 measurements a second

// how hard the bass hits, 100 times a second: the rise of the energy below about 150 Hz
function bassOnsets(pcm) {
  const n = Math.floor(pcm.length / HOP), level = new Float32Array(n), onset = new Float32Array(n);
  let a = 0, b = 0;
  const k = 1 - Math.exp(-2 * Math.PI * 150 / RATE);   // two one-pole low-pass filters in a row
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = i * HOP, end = j + HOP; j < end; j++) { a += (pcm[j] - a) * k; b += (a - b) * k; e += b * b; }
    level[i] = Math.sqrt(e / HOP);
  }
  for (let i = 2; i < n; i++) onset[i] = Math.max(0, level[i] - Math.max(level[i - 1], level[i - 2]) * 0.9);
  return { level, onset };
}

// the tempo that fits the whole recording best, in beats a minute
function tempo(onset) {
  const n = onset.length, maxLag = Math.ceil(FPS * 60 / 100 * 4) + 2, ac = new Float64Array(maxLag + 1);
  let mean = 0; for (let i = 0; i < n; i++) mean += onset[i]; mean /= n;
  for (let lag = 1; lag <= maxLag; lag++) { let s = 0; for (let i = lag; i < n; i += 2) s += (onset[i] - mean) * (onset[i - lag] - mean); ac[lag] = s; }
  const at = lag => { const i = Math.floor(lag), f = lag - i; return i + 1 <= maxLag ? ac[i] * (1 - f) + ac[i + 1] * f : 0; };
  let best = 0, score = -Infinity;
  for (let bpm = 100; bpm <= 180; bpm += 0.05) { const beat = FPS * 60 / bpm, s = at(beat) + at(beat * 2) + at(beat * 3) + at(beat * 4); if (s > score) { score = s; best = bpm; } }
  return best;
}

// Returns { bpm, kicks: [t], gaps: [{ from, to, beats }], kicking }
//   kicks     every kick, in seconds
//   gaps      every stretch of four beats or more without one: from the last kick before it to the first after
//   kicking   the share of the recording in which the kick runs
export function reference(pcm) {
  const { onset } = bassOnsets(pcm), n = onset.length, bpm = tempo(onset), beat = 60 / bpm;
  // every clear hit in the bass: a peak that nothing within a third of a beat tops
  const reach = Math.round(beat * FPS / 3), hits = [];
  for (let i = 1; i < n - 1; i++) {
    if (onset[i] <= 0 || onset[i] < onset[i - 1] || onset[i] < onset[i + 1]) continue;
    let top = true;
    for (let j = Math.max(0, i - reach); j <= Math.min(n - 1, i + reach) && top; j++) if (onset[j] > onset[i]) top = false;
    if (top) hits.push({ t: i / FPS, strength: onset[i] });
  }
  // how hard this track's kick hits: the strength a quarter of the way down the list of hits
  const typical = hits.map(h => h.strength).sort((a, b) => b - a)[Math.floor(hits.length / 4)] || 0;
  const strong = hits.filter(h => h.strength > typical * 0.35);
  // a kick is a strong hit that is not alone: there is another one a beat before or after it. A bass note or a tom
  // by itself is not a kick, however hard it hits, and neither is a pulse on every other beat.
  const on = (a, b) => Math.abs(Math.abs(a - b) / beat - 1) < 0.09;
  const kicks = strong.filter((h, i) => { for (let j = i - 1; j >= 0 && h.t - strong[j].t < beat * 2.3; j--) if (on(h.t, strong[j].t)) return true; for (let j = i + 1; j < strong.length && strong[j].t - h.t < beat * 2.3; j++) if (on(h.t, strong[j].t)) return true; return false; }).map(h => h.t);
  const gaps = [];
  let running = 0;
  for (let i = 1; i < kicks.length; i++) { const d = kicks[i] - kicks[i - 1]; if (d >= beat * 3.6) gaps.push({ from: kicks[i - 1], to: kicks[i], beats: Math.round(d / beat) }); else running += d; }
  return { bpm, kicks, gaps, kicking: running / Math.max(1, n / FPS) };
}
