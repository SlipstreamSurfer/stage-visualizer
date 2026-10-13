import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from '../tools/serve.mjs';
import { findBrowser } from '../tools/browser.mjs';

export const waitFor = ms => new Promise(resolve => setTimeout(resolve, ms));

// An isolated profile, command deadlines and guaranteed cleanup. A missing browser fails visibly.
export async function withPage(flags, run) {
  const browser = findBrowser(), server = await serve(0), port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-visualizer-test-'));
  const chrome = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    ...flags, '--autoplay-policy=no-user-gesture-required', '--window-size=640,360', 'about:blank']);
  const exited = new Promise(resolve => { chrome.once('exit', resolve); chrome.once('error', resolve); });
  let ws;
  const waiting = new Map();
  try {
    const debugUrl = await new Promise((resolve, reject) => {
      let log = '';
      const timer = setTimeout(() => reject(new Error('Browser startup timed out:\n' + log)), 20000);
      const finish = (error, url) => { clearTimeout(timer); error ? reject(error) : resolve(url); };
      chrome.stderr.on('data', chunk => { log = (log + chunk).slice(-10000); const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) finish(null, m[1]); });
      chrome.once('error', error => finish(error));
      chrome.once('exit', () => finish(new Error('Browser did not start:\n' + log)));
    });
    const pages = await (await fetch(`http://${new URL(debugUrl).host}/json`, { signal: AbortSignal.timeout(10000) })).json();
    ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser connection timed out')), 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = e => { clearTimeout(timer); reject(e); };
    });
    const errors = [];
    let id = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const command = ++id, timer = setTimeout(() => { waiting.delete(command); reject(new Error(`Browser command timed out: ${method}`)); }, 60000);
      waiting.set(command, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: command, method, params }));
    });
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data), pending = waiting.get(msg.id);
      if (pending) { clearTimeout(pending.timer); waiting.delete(msg.id); msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result); }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 600));
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    };
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (expression, message, timeout = 45000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if (errors.length) throw new Error(errors.join('\n')); if (await evaluate(expression)) return; await waitFor(100); }
      throw new Error(message);
    };
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
    await run({ send, evaluate, until, errors, port });
  } finally {
    for (const pending of waiting.values()) { clearTimeout(pending.timer); pending.reject(new Error('Browser closed')); }
    ws?.close(); chrome.kill(); server.close();
    await exited;
    // macOS Chrome helpers can finish profile writes just after the parent exits.
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
