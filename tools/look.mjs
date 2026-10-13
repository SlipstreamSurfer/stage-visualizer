// Opens a page of the show in a real browser window, on the real graphics card, waits, and reports what it sees:
// frames a second, errors, and a picture in rec/look/. Needs the local server (npm start) and Chromium.
//   node tools/look.mjs "?venue=hangar&cam=1" hangar        the show in Hangar, picture rec/look/hangar.jpg
//   node tools/look.mjs --all "cam=0&hide" tour 7 [keys]   every venue (or those named, comma-separated) in one go:
//                                                          rec/look/tour-<venue>.jpg and a line for each
// A fourth argument (not with --all) is JavaScript to run in the page two seconds before the picture.
import { spawn } from 'node:child_process';
import { findBrowser } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), all = args[0] === '--all';
if (all) args.shift();
const [page = '', name = 'look', seconds = '10', script = ''] = args;
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'rec', 'look');
fs.mkdirSync(dir, { recursive: true });
const chrome = spawn(findBrowser(), ['--remote-debugging-port=0', `--user-data-dir=${path.join(dir, '.profile')}`, '--no-first-run', '--window-size=1280,760', '--new-window', 'about:blank']);
const debugUrl = await new Promise(resolve => { let log = ''; chrome.stderr.on('data', c => { log += c; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); }); });
const pages = await (await fetch(`http://${new URL(debugUrl).host}/json`)).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
const waiting = new Map(), errors = new Set();
let id = 0;
const send = (method, params = {}) => new Promise(resolve => { waiting.set(++id, resolve); ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id) waiting.get(msg.id)?.(msg.result);
  if (msg.method === 'Runtime.exceptionThrown') errors.add(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.add(msg.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400));
};
await send('Runtime.enable'); await send('Page.enable');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({ status: document.getElementById('status')?.textContent, fps: Math.round(window.__show?.fps || 0), ready: window.__show?.ready, webgl: window.__show?.webgl, beats: window.__show?.signals?.beats })` })).result.value;
const snap = async file => fs.writeFileSync(path.join(dir, file + '.jpg'), Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 })).data, 'base64'));
if (all) {
  const { VENUES } = await import('../src/venues/index.js');
  for (const key of script ? script.split(',') : Object.keys(VENUES)) {
    errors.clear();
    await send('Page.navigate', { url: `http://127.0.0.1:8765/?venue=${key}&${page}` });
    await wait(seconds * 1000);
    console.log(key.padEnd(14), await report(), errors.size ? '\n  errors: ' + JSON.stringify([...errors].slice(0, 3)).slice(0, 700) : '');
    await snap(`${name}-${key}`);
  }
} else {
  await send('Page.navigate', { url: `http://127.0.0.1:8765/${page}` });
  await wait(seconds * 1000 - (script ? 2000 : 0));
  if (script) { await send('Runtime.evaluate', { expression: script }); await wait(2000); }
  console.log(await report(), '\nerrors:', JSON.stringify([...errors].slice(0, 6), null, 1), '\npicture:', path.join('rec', 'look', name + '.jpg'));
  await snap(name);
}
ws.close(); chrome.kill();
