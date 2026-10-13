// Resolve a Chromium browser on Linux, macOS or Windows. BROWSER_PATH can select one explicitly.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function findBrowser() {
  const explicit = process.env.BROWSER_PATH;
  const candidates = explicit ? [explicit] : [
    'chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome', 'brave', 'microsoft-edge-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ...['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'].flatMap(key => process.env[key] ? [
      path.join(process.env[key], 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env[key], 'Microsoft/Edge/Application/msedge.exe'),
    ] : []),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf8' });
    if (found.status === 0) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error(explicit ? `BROWSER_PATH does not point to a browser: ${explicit}` : 'Install Chrome, Edge or Chromium to run the browser tests, or set BROWSER_PATH to its executable.');
}
