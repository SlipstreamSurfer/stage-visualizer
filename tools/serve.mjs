// Usage: node tools/serve.mjs [port]      (or: npm start)
// Serves this folder to this computer only. Nothing is cached, so a reload always shows the files as they are now,
// and an open page reloads by itself when the code changes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { startRekordboxReceiver } from './rekordbox-bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

// when the page or its code last changed, so an open page can reload itself after an edit
function changed() {
  let last = fs.statSync(path.join(root, 'index.html')).mtimeMs;
  for (const dir of ['src', 'src/venues']) for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js')) last = Math.max(last, fs.statSync(path.join(root, dir, f)).mtimeMs);
  return last;
}

// What a music player on this computer says it is playing, for the screens of the DJ's players: Spotify if it
// plays, or else whatever does. Linux only (MPRIS, asked with busctl); anywhere else the answer is nothing.
const bus = args => new Promise(resolve => execFile('busctl', ['--user', '--json=short', ...args], { timeout: 1500 }, (err, out) => { try { resolve(err ? null : JSON.parse(out)); } catch { resolve(null); } }));
const ask = (player, property) => bus(['get-property', player, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', property]).then(r => r?.data ?? null);
let track = {}, asked = 0;
async function nowPlaying() {
  if (Date.now() - asked < 1500) return track;
  asked = Date.now();
  const names = ((await bus(['list'])) || []).map(n => n.name).filter(n => n?.startsWith('org.mpris.MediaPlayer2.')).sort((a, b) => b.endsWith('.spotify') - a.endsWith('.spotify'));
  for (const player of names) {
    if (await ask(player, 'PlaybackStatus') !== 'Playing') continue;
    const [meta, position] = await Promise.all([ask(player, 'Metadata'), ask(player, 'Position')]), title = meta?.['xesam:title']?.data;
    if (!title) continue;
    return track = { id: meta['mpris:trackid']?.data || title, playing: true, artist: (meta['xesam:artist']?.data || []).join(', '), title, position: (position || 0) / 1e6, length: (meta['mpris:length']?.data || 0) / 1e6 };
  }
  return track = {};
}

export function serve(port = 8765, { rekordbox = null } = {}) {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (name === '/__rekordbox') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(rekordbox?.snapshot() || { enabled: false, connected: false, decks: {} }));
      return;
    }
    if (name === '/__feedback' && req.method === 'POST') {
      // Listening feedback goes directly into the local project, including notes
      // restored from the browser. The filename is derived, never supplied.
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
      req.setEncoding('utf8');
      let body = '', oversized = false;
      req.on('data', data => {
        if (oversized) return;
        body += data;
        if (Buffer.byteLength(body) > 2 * 1024 * 1024) { oversized = true; body = ''; }
      });
      req.on('end', () => {
        if (oversized) { res.writeHead(413).end(); return; }
        let data;
        try {
          data = JSON.parse(body);
          if (!data.file || typeof data.file.name !== 'string' || data.file.name.length > 500 || !Number.isFinite(data.file.size) || !Number.isFinite(data.file.lastModified) || !Array.isArray(data.marks) || data.marks.length > 5000) throw new Error();
          for (const mark of data.marks) {
            if (!mark || !Number.isFinite(mark.seconds) || mark.seconds < 0 || mark.seconds > 86400 || typeof mark.notes !== 'string' || mark.notes.length > 1000 || typeof mark.event !== 'string') throw new Error();
          }
        } catch { res.writeHead(400).end(); return; }
        try {
          const id = createHash('sha256').update(JSON.stringify([data.file.name, data.file.size, data.file.lastModified])).digest('hex').slice(0, 20);
          const dir = path.join(root, 'rec', 'feedback'), file = path.join(dir, id + '.json');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(file + '.tmp', JSON.stringify({ schema_version: 1, saved_at: new Date().toISOString(), file: data.file, marks: data.marks }, null, 2) + '\n');
          fs.renameSync(file + '.tmp', file);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ saved: true }));
        } catch { res.writeHead(500).end(); }
      });
      return;
    }
    if (name === '/__log' && req.method === 'POST') {   // the page's own account of what the show did, kept next to the recordings
      let body = ''; req.on('data', d => { body += d; }); req.on('end', () => { fs.mkdirSync(path.join(root, 'rec'), { recursive: true }); fs.appendFile(path.join(root, 'rec', 'show.log'), body, () => {}); res.writeHead(204).end(); });
      return;
    }
    if (name.startsWith('/__shows/')) {   // a prepared show for a local audio file (shows/<file name>.json), or null: no 404 for a file without one
      const file = path.join(root, 'shows', path.basename(name.slice('/__shows/'.length)) + '.json');
      fs.readFile(file, 'utf8', (err, data) => res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(err ? 'null' : data));
      return;
    }
    if (name === '/__track') { nowPlaying().then(now => res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(now)), () => res.writeHead(200).end('{}')); return; }
    if (name === '/__changed') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(String(changed())); return; }
    const file = path.join(root, name.endsWith('/') ? name + 'index.html' : name);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), port = +(args.find(arg => /^\d+$/.test(arg)) || 8765);
  let rekordbox;
  try {
    if (args.includes('--rekordbox')) rekordbox = await startRekordboxReceiver({ host: args.includes('--rekordbox-lan') ? '0.0.0.0' : '127.0.0.1' });
    const server = await serve(port, { rekordbox });
    console.log(`Stage Visualizer: http://127.0.0.1:${port}/`);
    if (rekordbox) console.log(`Rekordbox receiver: UDP 4460 · http://127.0.0.1:${port}/rekordbox.html`);
    if (args.includes('--open') && process.platform === 'darwin') execFile('open', [`http://127.0.0.1:${port}/${args.includes('--rekordbox') ? 'rekordbox.html' : ''}`], error => { if (error) console.error('Open the connection page using the URL above.'); });
    const stop = () => { server.close(); rekordbox?.socket.close(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch (e) {
    if (rekordbox) await rekordbox.close();
    console.error(e.code === 'EADDRINUSE' ? 'A requested port is in use; is the server already running?' : e.message);
    process.exit(1);
  }
}
