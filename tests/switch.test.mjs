import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage, waitFor } from './browser.mjs';

// Both rendering paths must keep the same audio objects and advancing playback on a venue or quality change.
for (const backend of ['webgl', 'webgpu']) test(`${backend}: venue and quality changes preserve a playing file and an input stream`, { timeout: 300000 }, async context => {
  await withPage(backend === 'webgl' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [], async ({ send, evaluate, until, errors, port }) => {
    if (backend === 'webgpu') {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=studio&quality=low` });
      await until('!!window.__show?.ready', 'The WebGPU capability probe did not start');
      const supported = await evaluate('(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()))()');
      if (!supported) { context.skip('No hardware WebGPU adapter available; WebGL is covered separately.'); return; }
    }
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=club&quality=${backend === 'webgl' ? 'low' : 'normal'}&${backend === 'webgl' ? 'webgl' : ''}` });
    await until('!!window.__show?.ready', 'The initial venue did not start');
    assert.equal(await evaluate('window.__show.webgl'), backend === 'webgl', 'exercise the requested renderer, without a silent fallback');
    await evaluate(`(async () => {
      const rate = 22050, seconds = 90, buffer = new ArrayBuffer(44 + rate * seconds * 2), view = new DataView(buffer);
      const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
      for (let i = 0; i < rate * seconds; i++) view.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 2 * 80) * 1000, true);
      await window.__show.audio.file(new File([buffer], 'continuity.wav', { type: 'audio/wav' }));
      window.__show.audio.player.loop = true; // slow software rendering must not outlast the test file
      window.__probe = { show: window.__show, audio: window.__show.audio, player: window.__show.audio.player, ctx: window.__show.audio.ctx, source: window.__show.audio.source, signals: window.__show.signals, time: window.__show.audio.player.currentTime, origin: performance.timeOrigin };
    })()`);
    const switchTo = async key => {
      await evaluate(`document.getElementById('venue').value = '${key}'; document.getElementById('venue').dispatchEvent(new Event('change'))`);
      await until(`!window.__show.changing && window.__show.world.layout.name === document.getElementById('venue').selectedOptions[0].textContent`, `The venue ${key} did not finish switching`);
    };
    for (const key of ['dome', 'studio', 'club']) {
      await switchTo(key);
      assert.equal(await evaluate(`window.__probe.show === window.__show && window.__probe.audio === window.__show.audio && window.__probe.player === window.__show.audio.player && window.__probe.source === window.__show.audio.source && window.__probe.ctx === window.__show.audio.ctx && window.__probe.signals === window.__show.signals && window.__probe.origin === performance.timeOrigin && !window.__show.audio.player.paused`), true, `same running file in ${key}`);
    }
    for (const quality of ['high', 'low']) {
      await evaluate(`document.getElementById('quality').value = '${quality}'; document.getElementById('quality').dispatchEvent(new Event('change'))`);
      await until(`!window.__show.changing && window.__show.quality === '${quality}'`, `Quality ${quality} did not apply`);
      assert.equal(await evaluate('window.__probe.player === window.__show.audio.player && !window.__show.audio.player.paused'), true);
    }
    await waitFor(300);
    assert.equal(await evaluate('window.__show.audio.player.currentTime > window.__probe.time + 0.2'), true, 'playback advances');
    await evaluate(`for (const key of ['dome', 'studio', 'club']) { document.getElementById('venue').value = key; document.getElementById('venue').dispatchEvent(new Event('change')); }`);
    await until(`!window.__show.changing && window.__show.world.layout.name === 'Club'`, 'The last rapid venue choice should win');
    assert.equal(await evaluate('window.__probe.player === window.__show.audio.player && !window.__show.audio.player.paused'), true);
    // Generated input, no microphone permissions or external device needed.
    await evaluate(`(async () => {
      const audio = window.__show.audio, ctx = audio.ctx, oscillator = ctx.createOscillator(), input = ctx.createMediaStreamDestination();
      oscillator.connect(input); oscillator.start();
      await audio.useStream(input.stream, ++audio.request, 'Generated input');
      window.__inputProbe = { stream: audio.stream, track: audio.stream.getAudioTracks()[0], source: audio.source, ear: audio.ear };
    })()`);
    await switchTo('hangar');
    assert.equal(await evaluate(`window.__show.audio.stream === window.__inputProbe.stream && window.__show.audio.source === window.__inputProbe.source && window.__show.audio.ear === window.__inputProbe.ear && window.__inputProbe.track.readyState === 'live'`), true, 'the input stream and its listening history survive');
    assert.deepEqual(errors, []);
    if (backend === 'webgpu') {
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=club&quality=auto` });
      await until('!!window.__show?.ready', 'The automatic-quality preview did not start');
      assert.equal(await evaluate('window.__show.quality'), 'normal', 'automatic quality starts at Normal');
      await waitFor(500);
      fs.mkdirSync('rec/look', { recursive: true });
      const screenshot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync('rec/look/updated-panel.jpg', Buffer.from(screenshot.data, 'base64'));
      assert.deepEqual(errors, []);
    }
  });
});
