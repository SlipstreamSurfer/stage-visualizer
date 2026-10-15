// Usage: node tools/tempo.mjs <recordings...> [--jobs 6] [--json]
// How well the show holds the tempo of each recording, checked against the tempo of the whole recording (gridTempo
// below; the kick share comes from the second opinion in reference.mjs): the share of the time the tempo it shows is right (within 1.5 BPM), how long it takes to find
// it, how often the tempo it shows jumps, and how often it is a related wrong tempo (half, double, three to four)
// or none at all. Only recordings in which the kick runs most of the time and the hits line up clearly count in the
// total. The recordings stay where they are; nothing is written.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decode, hearing, RATE } from './hear.mjs';
import { reference } from './reference.mjs';

// The tempo of a whole recording, precisely. The second opinion (reference.mjs) finds it to about a BPM; this takes
// every clear hit in the bass (to the millisecond) and, close to that tempo, finds the beat length on which those hits
// line up best over the full recording: a tenth of a BPM off already drifts the grid by beats over a few minutes.
// (Searched over the whole range, lining up also finds tempos that only a rolling bass line fits, such as five to
// four of the real one; so the second opinion chooses and this only refines.) Returns { bpm, lock }, lock: how
// well the hits line up (0 to 1).
export function gridTempo(pcm, around) {
  const lo = around - 2, hi = around + 2;
  const HOP = RATE / 1000, n = Math.floor(pcm.length / HOP), level = new Float32Array(n), k = 1 - Math.exp(-2 * Math.PI * 150 / RATE);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) { let e = 0; for (let j = i * HOP, end = j + HOP; j < end; j++) { a += (pcm[j] - a) * k; b += (a - b) * k; e += b * b; } level[i] = Math.sqrt(e / HOP); }
  const smooth = new Float32Array(n), rise = new Float32Array(n);
  for (let i = 0, c = 0; i < n; i++) { c += (level[i] - c) * 0.3; smooth[i] = c; }
  for (let i = 10; i < n; i++) rise[i] = Math.max(0, smooth[i] - smooth[i - 10]);
  const hits = [];
  for (let i = 1; i < n - 1; i++) {
    if (rise[i] <= 0 || rise[i] < rise[i - 1] || rise[i] < rise[i + 1]) continue;
    let top = true;
    for (let j = Math.max(0, i - 120); j < Math.min(n, i + 120) && top; j++) if (rise[j] > rise[i]) top = false;
    if (top) hits.push([i / 1000, rise[i]]);
  }
  const typical = hits.map(h => h[1]).sort((p, q) => q - p)[Math.floor(hits.length / 4)] || 0, strong = hits.filter(h => h[1] > typical * 0.3);
  let best = 0, lock = 0;
  for (let bpm = lo; bpm <= hi; bpm += 0.01) {
    const period = 60 / bpm;
    let x = 0, y = 0, w = 0;
    for (const [t, s] of strong) { const p = 2 * Math.PI * t / period; x += s * Math.cos(p); y += s * Math.sin(p); w += s; }
    if (w && Math.hypot(x, y) / w > lock) { lock = Math.hypot(x, y) / w; best = bpm; }
  }
  return { bpm: best, lock };
}

const SETTLE = 15;   // seconds a listener may take to find the tempo before a wrong one counts against it

// one recording: what the show showed, second by second, against the reference
export function tempoCheck(pcm) {
  const coarse = reference(pcm), ref = { ...coarse, ...gridTempo(pcm, coarse.bpm) }, ear = hearing(), shown = [];
  let next = 1;
  ear.onFrame = t => { if (t >= next) { shown.push(ear.state.bpm || 0); next += 1; } };
  ear.push(pcm);
  const near = (bpm, target) => Math.abs(bpm - target) <= 1.5;
  const related = [2, 0.5, 4 / 3, 3 / 4, 3 / 2, 2 / 3].map(k => ref.bpm * k);
  const after = shown.slice(SETTLE), share = test => after.length ? after.filter(test).length / after.length : 0;
  let jumps = 0;
  for (let i = 1; i < shown.length; i++) if (shown[i] && shown[i - 1] && Math.abs(shown[i] - shown[i - 1]) >= 2) jumps++;
  const found = shown.findIndex(bpm => near(bpm, ref.bpm));
  return {
    bpm: +ref.bpm.toFixed(1), lock: +ref.lock.toFixed(2), kicking: +ref.kicking.toFixed(2), seconds: shown.length,
    right: share(bpm => near(bpm, ref.bpm)), related: share(bpm => !near(bpm, ref.bpm) && related.some(r => near(bpm, r))),
    none: share(bpm => !bpm), wrong: share(bpm => bpm && !near(bpm, ref.bpm) && !related.some(r => near(bpm, r))),
    found: found < 0 ? null : found, jumps, perMinute: +(jumps / (shown.length / 60)).toFixed(1),
  };
}

const pct = x => `${Math.round(x * 100)}%`.padStart(4);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--one') { process.stdout.write(JSON.stringify(tempoCheck(decode(args[1])))); process.exit(0); }
  const jobs = +(args[args.indexOf('--jobs') + 1] || 0) || 6, json = args.includes('--json');
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jobs');
  if (!files.length) { console.error('Usage: node tools/tempo.mjs <recordings...> [--jobs 6] [--json]'); process.exit(1); }
  const results = new Array(files.length);
  let index = 0;
  const run = () => new Promise(resolve => {
    const i = index++;
    if (i >= files.length) return resolve();
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--one', files[i]]);
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
    child.on('close', code => { results[i] = code === 0 ? { file: files[i], ...JSON.parse(out) } : { file: files[i], error: err.trim() }; run().then(resolve); });
  });
  await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, run));
  if (json) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }
  const name = file => file.split('/').pop().replace(/\.[^.]+$/, '').slice(0, 44).padEnd(44);
  console.log(`${'recording'.padEnd(44)}   ref lock  kick right  rel none wrong  found jumps/min`);
  for (const r of results) {
    if (r.error) { console.log(`${name(r.file)}  could not be read: ${r.error.split('\n')[0]}`); continue; }
    console.log(`${name(r.file)} ${String(r.bpm).padStart(5)} ${pct(r.lock)} ${pct(r.kicking)} ${pct(r.right)} ${pct(r.related)} ${pct(r.none)}  ${pct(r.wrong)}  ${r.found === null ? '  never' : String(r.found).padStart(5) + ' s'} ${String(r.perMinute).padStart(6)}`);
  }
  const counted = results.filter(r => !r.error && r.kicking >= 0.5 && r.lock >= 0.2), mean = key => counted.reduce((s, r) => s + r[key], 0) / (counted.length || 1);
  console.log(`\n${counted.length} recordings with a running kick: right ${pct(mean('right'))}, related ${pct(mean('related'))}, none ${pct(mean('none'))}, wrong ${pct(mean('wrong'))}, ${mean('perMinute').toFixed(1)} jumps a minute; found after ${Math.round(counted.filter(r => r.found !== null).reduce((s, r) => s + r.found, 0) / (counted.filter(r => r.found !== null).length || 1))} s on average`);
}
