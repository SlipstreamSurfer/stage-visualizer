// Usage: node tools/replay.mjs <audio file> [more files...] [--quiet]      (or: npm run listen -- <audio file>)
//
// Plays an audio file (anything ffmpeg reads: mp3, flac, wav, webm...) through the visualizer's own Listener and
// prints what the show would have heard: where the kick comes in, breaks, drops, the parts of the track, layers
// coming in, the tempo. The same code as the page, without the picture, in a few seconds.
// With several files it prints one line for each, to compare a set of recordings before and after a change.
import path from 'node:path';
import { decode, listen, describe, clock, tempoOf } from './hear.mjs';

const files = process.argv.slice(2).filter(a => !a.startsWith('--')), quiet = process.argv.includes('--quiet');
if (!files.length) { console.error('Usage: node tools/replay.mjs <audio file> [more files...] [--quiet]'); process.exit(1); }
const count = (result, type) => result.events.filter(e => e.type === type).length;

if (files.length > 1) {
  console.log('   bpm  drops  breaks  lifts  parts  length  file');
  for (const file of files) {
    try {
      const r = listen(decode(file)), bpm = tempoOf(r.rows);
      console.log(`${bpm ? bpm.toFixed(1).padStart(6) : '    --'}  ${String(count(r, 'drop')).padStart(5)}  ${String(count(r, 'break')).padStart(6)}  ${String(count(r, 'lift')).padStart(5)}  ${String(count(r, 'section')).padStart(5)}  ${clock(r.seconds).padStart(6)}  ${path.basename(file)}`);
    } catch (e) { console.log(`cannot read ${file}`); }
  }
  process.exit(0);
}

let result;
try { result = listen(decode(files[0])); } catch (e) { console.error(e.message); process.exit(1); }
console.log(`${files[0]}: ${clock(result.seconds).trim()}, ${tempoOf(result.rows).toFixed(1)} BPM`);
if (!quiet) {
  console.log('\nEvery 10 seconds:\n   time    bpm  sure  kicks  density  build  section');
  for (const r of result.rows) {
    console.log(`${clock(r.t)}  ${r.bpm ? r.bpm.toFixed(1).padStart(5) : '   --'}  ${r.confidence.toFixed(2)}  ${String(r.kicks).padStart(5)}  ${r.density.toFixed(2).padStart(7)}  ${r.build.toFixed(2).padStart(5)}  ${r.section}`);
  }
}
console.log('\nWhat the show heard:');
for (const e of result.events) console.log(`${clock(e.t)}  ${describe(e)}`);
console.log(`\n${count(result, 'drop')} drops, ${count(result, 'break')} breaks, ${count(result, 'lift')} lifts, ${count(result, 'section')} section changes`);
