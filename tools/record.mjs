// Usage: node tools/record.mjs [--source stage-visualizer] [--player spotify] [--out rec] [--limit-gb 5]
// (or: npm run record)
//
// Listens along while you play music (Linux, PipeWire). It hears what the computer plays through the same Listener
// as the page, prints what the show would make of it as it happens, and keeps every track for later:
//   rec/<date>/<artist> - <title>.flac   the recording
//   rec/<date>/<artist> - <title>.txt    what the show heard in it, in the track's own time
//   rec/<date>/session.txt               everything in one list, with the moments the player changed track
// The player's track changes are the truth to hold the show against: after each one it says whether the show
// noticed that a new track began. Stop with Ctrl+C. Recordings stay out of git.
// Every track is kept once: playing it again only replaces the recording when more of the track was heard. When the
// recordings together pass the limit, the oldest go. That makes it safe to leave running in the background.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { hearing, describe, clock, RATE } from './hear.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const source = arg('source', 'stage-visualizer'), player = arg('player', 'spotify');
const root = arg('out', 'rec'), limit = +arg('limit-gb', 5) * 1e9;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const folder = () => { const dir = path.join(root, today()); fs.mkdirSync(dir, { recursive: true }); return dir; };
const MIN_TAKE = 30;   // seconds; anything shorter was skipped through and is thrown away

const stamp = () => new Date().toTimeString().slice(0, 8);
const say = line => { console.log(line); fs.appendFileSync(path.join(folder(), 'session.txt'), line + '\n'); };

// which tracks are already kept: player's track id -> { file (relative to root, without extension), seconds, at }
const indexFile = path.join(root, 'index.json');
let index = {};
try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch {}
const saveIndex = () => fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
const drop = id => { for (const ext of ['.flac', '.txt']) fs.rmSync(path.join(root, index[id].file + ext), { force: true }); delete index[id]; };
function keepUnderLimit() {
  const size = id => { try { return fs.statSync(path.join(root, index[id].file + '.flac')).size; } catch { return 0; } };
  let total = Object.keys(index).reduce((n, id) => n + size(id), 0);
  for (const id of Object.keys(index).sort((a, b) => index[a].at - index[b].at)) {
    if (total <= limit) break;
    total -= size(id); say(`          (over the limit: removed ${index[id].file})`); drop(id);
  }
}

// ---------- the player ----------
const ask = property => new Promise(resolve => {
  execFile('busctl', ['--user', '--json=short', 'get-property', `org.mpris.MediaPlayer2.${player}`, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', property],
    (err, out) => { try { resolve(err ? null : JSON.parse(out).data); } catch { resolve(null); } });
});
async function nowPlaying() {
  const [meta, status, position] = await Promise.all([ask('Metadata'), ask('PlaybackStatus'), ask('Position')]);
  if (!meta || !meta['mpris:trackid']) return null;
  return {
    id: meta['mpris:trackid'].data, playing: status === 'Playing', position: (position || 0) / 1e6,
    artist: (meta['xesam:artist']?.data || []).join(', ') || 'Unknown artist', title: meta['xesam:title']?.data || 'Unknown title',
    length: (meta['mpris:length']?.data || 0) / 1e6,
  };
}

// ---------- one take per track ----------
const ear = hearing();
let take = null, playing = false, pendingChange = null, ending = false;
const taken = [];

function startTake(track) {
  const dir = folder();
  let name = `${track.artist} - ${track.title}`.replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').slice(0, 150), n = 1;
  while (fs.existsSync(path.join(dir, name + (n > 1 ? ` (${n})` : '') + '.flac'))) n++;
  if (n > 1) name += ` (${n})`;
  const file = path.join(dir, name + '.flac');
  const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', '-', file], { stdio: ['pipe', 'ignore', 'inherit'] });
  encoder.stdin.on('error', () => {});
  take = { track, name, dir, file, encoder, from: track.position, seconds: 0, startedAt: ear.t, events: [], bpm: [] };
  say(`\n${stamp()}  ▶ ${track.artist} – ${track.title} (${clock(track.length).trim()})${track.position > 5 ? `, from ${clock(track.position).trim()}` : ''}`);
}

function endTake() {
  if (!take) return Promise.resolve();
  const t = take; take = null;
  return new Promise(resolve => {
    t.encoder.on('close', () => {
      if (t.seconds < MIN_TAKE) { fs.rmSync(t.file, { force: true }); say(`          (${t.seconds.toFixed(0)} s, too short to keep)`); return resolve(); }
      const sure = t.bpm.sort((a, b) => a - b), bpm = sure.length ? sure[sure.length >> 1] : 0;
      const count = type => t.events.filter(e => e.type === type).length;
      const summary = `${bpm ? bpm.toFixed(1) + ' BPM' : 'no tempo'}, ${count('drop')} drops, ${count('break')} breaks, ${count('lift')} lifts, ${count('section')} section changes`;
      say(`          ${summary}`);
      const had = index[t.track.id];
      if (had && had.seconds >= t.seconds && fs.existsSync(path.join(root, had.file + '.flac'))) {
        fs.rmSync(t.file, { force: true }); say(`          (already kept: ${had.file})`); return resolve();
      }
      if (had) drop(t.track.id);
      fs.writeFileSync(path.join(t.dir, t.name + '.txt'), [
        `${t.track.artist} – ${t.track.title}`,
        `Length ${clock(t.track.length).trim()}; recorded ${clock(t.from).trim()} to ${clock(t.from + t.seconds).trim()} on ${today()}`,
        summary, '', 'What the show heard (time in the track):',
        ...t.events.map(e => `${clock(e.at)}  ${describe(e)}`), '',
      ].join('\n'));
      index[t.track.id] = { file: path.relative(root, path.join(t.dir, t.name)), seconds: Math.round(t.seconds), at: Date.now() };
      keepUnderLimit(); saveIndex();
      taken.push({ name: t.name, summary });
      resolve();
    });
    t.encoder.stdin.end();
  });
}

// ---------- the sound ----------
const rec = spawn('parec', ['-d', source, '--format=s16le', `--rate=${RATE}`, '--channels=1', '--latency-msec=50'], { stdio: ['ignore', 'pipe', 'pipe'] });
let recError = '';
rec.stderr.on('data', d => { recError += d; });
rec.on('error', () => { console.error('parec is needed to record (it comes with PipeWire\'s PulseAudio tools)'); process.exit(1); });
rec.on('exit', code => {
  if (ending) return;
  console.error(`Recording stopped: ${recError.trim() || 'parec exited with code ' + code}\nIs the input "${source}" set up? See "System audio on Linux" in MANUAL.md.`);
  process.exit(1);
});
let odd = null;
rec.stdout.on('data', chunk => {
  if (odd) { chunk = Buffer.concat([odd, chunk]); odd = null; }
  if (chunk.length % 2) { odd = chunk.subarray(chunk.length - 1); chunk = chunk.subarray(0, chunk.length - 1); }
  const samples = new Float32Array(chunk.length >> 1);
  for (let i = 0; i < samples.length; i++) samples[i] = chunk.readInt16LE(i * 2) / 32768;
  const events = ear.push(samples);
  if (take && playing) {
    take.encoder.stdin.write(chunk);
    take.seconds += samples.length / RATE;
    const tempo = ear.listener.tempo;
    if (tempo.bpm && tempo.confidence > 0.4 && Math.floor(take.seconds) !== Math.floor(take.seconds - samples.length / RATE)) take.bpm.push(tempo.bpm);
  }
  for (const e of events) {
    const at = take ? take.from + take.seconds : 0;
    if (take && playing) take.events.push({ ...e, at });
    say(`${stamp()}  ${take ? clock(at) : '   --  '}  ${describe(e)}`);
    // did the show notice the player's change of track? it does when it hears the silence between two tracks
    if (pendingChange && e.type === 'silence') pendingChange.noticed = true;
  }
});

// ---------- following the player ----------
async function follow() {
  const track = await nowPlaying();
  if (ending) return;
  if (pendingChange && ear.t - pendingChange.at > 8) {
    say(`          ${pendingChange.noticed ? 'the show noticed the new track (silence between the two)' : 'the show did NOT notice the new track: no silence, it carried on as if it were the same one'}`);
    pendingChange = null;
  }
  if (!track) { if (playing) say(`${stamp()}  (the player "${player}" is not answering)`); playing = false; return; }
  if (!take || take.track.id !== track.id) {
    const first = !take;
    await endTake();
    if (ending) return;
    startTake(track);
    // a change within the last seconds of silence counts as noticed too
    if (!first) pendingChange = { at: ear.t, noticed: ear.state.silentFor > 0.5 || !ear.state.hasGrooved };
  }
  if (track.playing !== playing) {
    playing = track.playing;
    if (!playing) say(`${stamp()}  (paused)`);
  }
}
const timer = setInterval(() => follow().catch(() => {}), 1000);

console.log(`Listening to "${source}" and following ${player}. Recordings go to ${root}/. Stop with Ctrl+C.`);
follow();

const stop = async () => {
  if (ending) return;
  ending = true;
  clearInterval(timer);
  rec.kill();
  await endTake();
  console.log(`\n${taken.length} track${taken.length === 1 ? '' : 's'} kept in ${root}/`);
  for (const t of taken) console.log(`  ${t.name}: ${t.summary}`);
  if (taken.length) console.log(`\nListen to them all again after a change:  npm run listen -- ${root}/*/*.flac`);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
