import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { withPage, waitFor } from './browser.mjs';
import { playbackTime } from '../src/playback.js';

test('file time formatting handles unknown duration and minute boundaries', () => {
  assert.equal(playbackTime(NaN), '--:--');
  assert.equal(playbackTime(Infinity), '--:--');
  assert.equal(playbackTime(-1), '--:--');
  assert.equal(playbackTime(0), '0:00.0');
  assert.equal(playbackTime(59.99), '0:59.9');
  assert.equal(playbackTime(60), '1:00.0');
  assert.equal(playbackTime(495.744), '8:15.7');
});

test('file controls show track time, preserve annotated marks and export CSV', { timeout: 180000 }, async () => {
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-marks-'));
  try {
    await withPage(['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], async ({ send, evaluate, until, errors, port }) => {
      const url = `http://127.0.0.1:${port}/?venue=studio&quality=low&webgl`;
      const loadFile = name => evaluate(`(async () => {
        const rate = 22050, seconds = 90, buffer = new ArrayBuffer(44 + rate * seconds * 2), view = new DataView(buffer);
        const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
        text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        text(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
        for (let i = 0; i < rate * seconds; i++) view.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 160) * 1000, true);
        await window.__show.audio.file(new File([buffer], ${JSON.stringify(name)}, { type: 'audio/wav', lastModified: 42 }));
      })()`);
      await send('Page.navigate', { url });
      await until('!!window.__show?.ready', 'The show did not start');
      assert.equal(await evaluate(`document.getElementById('filePlayback').hidden`), true, 'no fabricated track clock in demo mode');
      await loadFile('timing.wav');
      await until(`!document.getElementById('filePlayback').hidden && document.getElementById('playbackTime').textContent.endsWith('/ 1:30.0')`, 'File time and duration were not shown');
      assert.equal(await evaluate(`document.querySelector('#fileTransport audio') === window.__show.audio.player && window.__show.audio.player.controls`), true, 'controls operate the actual file player');
      assert.equal(await evaluate(`(() => {
        const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
        window.__show.audio.player.dispatchEvent(event);
        return !event.defaultPrevented && !window.__show.director.manual.strobe;
      })()`), true, 'the player keeps its Space shortcut without firing the strobe');
      await evaluate('window.__show.audio.player.pause()');
      await waitFor(200);
      const pausedAt = await evaluate('window.__show.signals.now');
      await waitFor(1100);
      assert.equal(await evaluate('window.__show.signals.now'), pausedAt, 'a paused file does not feed silence into musical detection');
      await evaluate('window.__show.signals.drop = 1; window.__show.audio.player.currentTime = 40.25');
      await until(`!window.__show.audio.player.seeking && document.getElementById('playbackTime').textContent.startsWith('0:40.2')`, 'Seeking did not update the file clock');
      assert.equal(await evaluate('window.__show.signals.now === 0 && window.__show.signals.drop === 0'), true, 'seeking resets the previous listening segment');
      await evaluate(`document.getElementById('markMoment').click()`);
      assert.equal(await evaluate(`document.querySelector('#markList strong').textContent`), '0:40.2', 'marks use file position, including after seeking');
      await evaluate(`(() => {
        const note = document.querySelector('#markList input'), kind = document.querySelector('#markList select');
        note.value = 'Build-up, "too bright"'; note.dispatchEvent(new Event('input'));
        kind.value = 'build_after_drop'; kind.dispatchEvent(new Event('change'));
      })()`);
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
      await evaluate(`document.getElementById('exportMarks').click()`);
      const exported = path.join(downloads, 'timing.annotations.csv');
      for (let i = 0; i < 50 && !fs.existsSync(exported); i++) await waitFor(100);
      assert.equal(fs.existsSync(exported), true, 'CSV downloaded');
      const csv = fs.readFileSync(exported, 'utf8');
      assert.match(csv, /^start_seconds,end_seconds,event,notes,/);
      assert.ok(csv.includes('"40.25","40.25","observation","Build-up, ""too bright""","build_after_drop"'), 'CSV quotes notes and keeps precise track time and feedback');
      assert.ok(csv.includes('"studio"'), 'CSV includes the show context');
      await until(`document.getElementById('feedbackSave').textContent.includes('Saved to this project')`, 'Feedback was not saved directly to the project');
      const file = await evaluate('window.__show.audio.fileInfo');
      const id = createHash('sha256').update(JSON.stringify([file.name, file.size, file.lastModified])).digest('hex').slice(0, 20);
      const saved = JSON.parse(fs.readFileSync(`rec/feedback/${id}.json`, 'utf8'));
      assert.equal(saved.marks[0].feedback, 'build_after_drop');
      assert.equal(saved.marks[0].context.segment_start_seconds, 40.25);
      await send('Page.reload');
      await until('!!window.__show?.ready', 'Reload did not complete');
      await loadFile('timing.wav');
      await until(`document.getElementById('markCount').textContent === '1 marked moment'`, 'Marks were not restored for the same file');
      assert.equal(await evaluate(`document.querySelector('#markList input').value`), 'Build-up, "too bright"');
      assert.equal(await evaluate(`document.querySelector('#markList select').value`), 'build_after_drop');
      await evaluate(`window.__show.audio.player.currentTime = 89.99`);
      await until('window.__show.audio.player.ended', 'The test file did not end');
      await evaluate(`document.getElementById('restartFile').click()`);
      await until(`!window.__show.audio.player.paused && window.__show.audio.player.currentTime < 3 && window.__show.audio.message === ''`, 'An ended track did not restart');
      await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))`);
      assert.equal(await evaluate(`document.getElementById('markCount').textContent`), '2 marked moments', 'T marks the playing file');
      await evaluate(`document.querySelector('#markList button').click()`);
      assert.equal(await evaluate(`document.getElementById('markCount').textContent`), '1 marked moment');
      await loadFile('other.wav');
      await until(`document.getElementById('markCount').textContent === '0 marked moments'`, 'Marks leaked to another file');
      await evaluate(`document.getElementById('markGood').click()`);
      assert.equal(await evaluate(`document.querySelector('#markList select').value`), 'good', 'a good moment needs only one click');
      await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }))`);
      assert.equal(await evaluate(`document.querySelector('#markList select').value`), 'wrong', 'X records a wrong moment without a written explanation');
      await evaluate(`(async () => {
        const audio = window.__show.audio, stream = audio.ctx.createMediaStreamDestination().stream;
        await audio.useStream(stream, ++audio.request, 'Test input');
      })()`);
      await until(`document.getElementById('filePlayback').hidden && document.getElementById('trackNotes').hidden`, 'A live input showed stale file time');
      assert.deepEqual(errors, []);
    });
  } finally { fs.rmSync(downloads, { recursive: true, force: true }); }
});
