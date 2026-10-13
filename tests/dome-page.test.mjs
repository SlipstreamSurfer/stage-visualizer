import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage, waitFor } from './browser.mjs';

// Measure the rendered roof, excluding the panel. A uniform colour or a black roof is not a working visual.
async function picture(send, evaluate, name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync('rec/look/dome', { recursive: true });
  fs.writeFileSync(`rec/look/dome/${name}.png`, Buffer.from(shot.data, 'base64'));
  return evaluate(`(async () => {
    const image = new Image(); image.src = 'data:image/png;base64,${shot.data}'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(320, 20, image.width - 340, image.height - 40).data;
    let sum = 0, squares = 0, n = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      sum += value; squares += value * value; n++;
    }
    const mean = sum / n; return { mean, deviation: Math.sqrt(Math.max(0, squares / n - mean * mean)) };
  })()`);
}

for (const backend of ['webgl', 'webgpu']) test(`${backend}: the Dome projects varied visuals in silence and honours blackout`, { timeout: 180000 }, async context => {
  await withPage(backend === 'webgl' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [], async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 640, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=dome&mood=ambient&quality=low&cam=3&${backend === 'webgl' ? 'webgl' : ''}` });
    await until('!!window.__show?.ready', 'Dome did not start');
    if (backend === 'webgpu' && !await evaluate('(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()))()')) {
      context.skip('No hardware WebGPU adapter available; WebGL is covered separately.'); return;
    }
    assert.equal(await evaluate('window.__show.webgl'), backend === 'webgl');
    // A silent file exercises the real audio and director path, without depending on the demo's changing energy.
    await evaluate(`(async () => {
      const rate = 22050, buffer = new ArrayBuffer(44 + rate * 10 * 2), view = new DataView(buffer);
      const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
      await window.__show.audio.file(new File([buffer], 'silence.wav', { type: 'audio/wav' }));
      window.__show.audio.player.loop = true;
    })()`);
    await waitFor(3000);
    assert.ok(await evaluate('window.__show.signals.m.activity < 0.05'), 'the input is silent');
    for (const visual of [0, 1, 2, 7]) {
      await evaluate(`window.__show.director.visual = ${visual}`);
      await waitFor(250);
      const stats = await picture(send, evaluate, `${backend}-${visual}`);
      assert.ok(stats.mean > 10, `visual ${visual} must be visible: ${JSON.stringify(stats)}`);
      assert.ok(stats.deviation > 5, `visual ${visual} must contain a pattern: ${JSON.stringify(stats)}`);
    }
    await evaluate(`document.getElementById('btnBlackout').click()`);
    await waitFor(250);
    const dark = await picture(send, evaluate, `${backend}-blackout`);
    assert.ok(dark.mean < 5, `blackout must darken the projection: ${JSON.stringify(dark)}`);
    assert.deepEqual(errors, []);
  });
});
