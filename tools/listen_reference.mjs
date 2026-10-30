// Machine-readable companion to SV's unmodified tools/replay.mjs.
// node tools/listen_reference.mjs ../stage-visualizer input.flac
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [sv, file] = process.argv.slice(2);
const { decode, listen, tempoOf } = await import(pathToFileURL(path.resolve(sv, 'tools/hear.mjs')));
const result = listen(decode(file));
console.log(JSON.stringify({ ...result, bpm: tempoOf(result.rows) }));
