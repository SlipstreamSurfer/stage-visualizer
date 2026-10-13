import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage } from './browser.mjs';

for (const backend of ['webgl', 'webgpu']) test(`${backend}: looks, remembered sliders, mood lock and manual effect release`, { timeout: 300000 }, async context => {
  await withPage(backend === 'webgl' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [], async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 480, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&mood=house&quality=low&${backend === 'webgl' ? 'webgl' : ''}` });
    await until('!!window.__show?.ready', 'The controls page did not start');
    if (backend === 'webgpu' && !await evaluate('(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()))()')) {
      context.skip('No hardware WebGPU adapter available; WebGL is covered separately.'); return;
    }
    assert.equal(await evaluate('window.__show.webgl'), backend === 'webgl');
    // Headless pages otherwise change activeElement without dispatching native focus/blur events.
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const change = async (id, value, event = 'change') => evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)})); })()`);
    const switchTo = async venue => {
      await change('venue', venue);
      await until(`!window.__show.changing && document.getElementById('venue').value === '${venue}' && window.__show.world.layout.name === document.getElementById('venue').selectedOptions[0].textContent`, `Venue ${venue} did not finish switching`);
    };
    const key = async (type, value, code) => evaluate(`dispatchEvent(new KeyboardEvent('${type}', { key: '${value}', code: '${code || value}' }))`);
    const pointer = async (id, type) => evaluate(`document.getElementById('${id}').dispatchEvent(new PointerEvent('${type}', { button: 0, bubbles: true }))`);
    const states = () => evaluate(`Object.fromEntries(['btnStrobe', 'btnBlinder', 'btnPyro', 'btnBlackout'].map(id => [id, document.getElementById(id).dataset.state]))`);
    const fixture = async (name, checked) => evaluate(`(() => { const input = [...document.querySelectorAll('#switches label')].find(el => el.textContent === '${name}').querySelector('input'); input.checked = ${checked}; input.dispatchEvent(new Event('change')); })()`);

    const initialMood = await evaluate(`document.getElementById('mood').value`);
    await evaluate(`localStorage.setItem('sv.mood', 'ambient'); document.getElementById('moodLock').click()`);
    assert.equal(await evaluate(`localStorage.getItem('sv.mood')`), initialMood, 'locking remembers the visible mood rather than an older stored selection');
    await evaluate(`document.getElementById('moodLock').click()`);
    await change('lookPreset', 'calm');
    assert.deepEqual(await evaluate(`['light','bloom','haze','hall'].map(key => window.__show.look[key])`), [0.8, 0.6, 0.65, 1.15]);
    assert.equal(await evaluate(`document.getElementById('lookBloomValue').value`), '0.60×');
    await change('lookPreset', 'cinematic');
    assert.equal(await evaluate('window.__show.look.haze'), 1.3);
    await change('lookPreset', 'energetic');
    assert.equal(await evaluate('window.__show.look.light'), 1.2);
    await change('lookLight', '0.75', 'input');
    await change('sens', '1.65', 'input');
    assert.equal(await evaluate(`document.getElementById('lookPreset').value`), 'custom');
    assert.equal(await evaluate(`document.getElementById('lookLightValue').value`), '0.75×');
    await change('mood', 'ambient');
    assert.equal(await evaluate(`new URL(location.href).searchParams.get('mood')`), 'ambient', 'a mood supplied by a link cannot override a later selection on reload');
    await evaluate(`document.getElementById('moodLock').click()`);
    await switchTo('hangar');
    assert.equal(await evaluate(`document.getElementById('mood').value`), 'ambient', 'a locked mood survives an incompatible venue');
    assert.equal((await states()).btnPyro, 'off', 'present flames are visibly off by default');
    await fixture('Flames', true);
    assert.equal((await states()).btnPyro, 'ready');
    await key('keydown', 'v');
    assert.equal(await evaluate(`window.__show.world.groups.flame.some(f => Number.isFinite(f.ch.fire))`), true, 'enabled pyro can fire');
    await fixture('Flames', false);
    await evaluate(`window.__show.world.groups.flame.forEach(f => f.ch.fire = -123)`);
    await key('keydown', 'v');
    assert.equal(await evaluate(`window.__show.world.groups.flame.every(f => f.ch.fire === -123)`), true, 'disabled pyro ignores its shortcut');

    const beforeReload = await evaluate('performance.timeOrigin');
    await send('Page.reload');
    await until(`performance.timeOrigin !== ${beforeReload} && !!window.__show?.ready && window.__show.world.layout.name === 'Hangar'`, 'Remembered controls did not reload');
    assert.deepEqual(await evaluate(`({ mood: document.getElementById('mood').value, lock: document.getElementById('moodLock').checked, look: document.getElementById('lookPreset').value, light: document.getElementById('lookLightValue').value, sens: document.getElementById('sensValue').value })`), { mood: 'ambient', lock: true, look: 'custom', light: '0.75×', sens: '1.65×' });
    await evaluate(`document.getElementById('resetSliders').click()`);
    assert.deepEqual(await evaluate(`['sens','lookLight','lookBloom','lookHaze','lookHall'].map(id => document.getElementById(id + 'Value').value)`), Array(5).fill('1.00×'));
    assert.equal(await evaluate(`document.getElementById('lookPreset').value`), 'standard');
    assert.equal(await evaluate(`window.__show.quality === 'low' && window.__show.look.off.flame && document.getElementById('mood').value === 'ambient' && document.getElementById('moodLock').checked`), true, 'reset only resets sliders');

    await evaluate(`(async () => {
      const audio = window.__show.audio; await audio.context();
      const oscillator = audio.ctx.createOscillator(), input = audio.ctx.createMediaStreamDestination();
      oscillator.connect(input); oscillator.start();
      await audio.useStream(input.stream, ++audio.request, 'Generated input');
      window.__controlsProbe = { stream: audio.stream, source: audio.source, ear: audio.ear, signals: window.__show.signals };
    })()`);
    await change('lookPreset', 'cinematic');
    await switchTo('hangar');
    assert.equal(await evaluate(`document.getElementById('mood').value`), 'ambient');
    await evaluate(`document.getElementById('moodLock').click()`);
    await change('quality', 'normal');
    await until(`!window.__show.changing && window.__show.quality === 'normal'`, 'Quality change did not finish');
    assert.equal(await evaluate(`document.getElementById('mood').value`), 'ambient', 'quality changes preserve the chosen mood even when unlocked');
    await switchTo('hangar');
    assert.equal(await evaluate(`document.getElementById('mood').value`), 'ambient', 'reselecting Hangar preserves the visible mood');
    assert.equal(await evaluate(`window.__controlsProbe.stream === window.__show.audio.stream && window.__controlsProbe.source === window.__show.audio.source && window.__controlsProbe.ear === window.__show.audio.ear && window.__controlsProbe.signals === window.__show.signals && window.__show.audio.stream.getAudioTracks()[0].readyState === 'live'`), true, 'controls keep the live input and listener');
    await pointer('btnStrobe', 'pointerdown');
    assert.equal((await states()).btnStrobe, 'held');
    await key('keydown', ' ', 'Space');
    await pointer('btnStrobe', 'pointerup');
    assert.equal(await evaluate('window.__show.director.manual.strobe'), true, 'releasing the pointer keeps a held keyboard shortcut');
    await key('keyup', ' ', 'Space');
    assert.equal((await states()).btnStrobe, 'ready');
    await pointer('btnStrobe', 'pointerdown');
    await evaluate(`dispatchEvent(new Event('blur'))`);
    assert.equal(await evaluate('window.__show.director.manual.strobe'), false, 'window blur releases the hold');
    await pointer('btnStrobe', 'pointerdown');
    await pointer('btnStrobe', 'pointercancel');
    assert.equal(await evaluate('window.__show.director.manual.strobe'), false);
    await pointer('btnStrobe', 'pointerdown');
    await fixture('Strobes', false);
    assert.equal((await states()).btnStrobe, 'off', 'disabling a held fixture releases it');
    assert.equal(await evaluate('window.__show.director.manual.strobe'), false);
    await fixture('Strobes', true);
    await switchTo('hangar');
    await key('keydown', 'b');
    assert.equal((await states()).btnBlinder, 'held');
    await evaluate(`Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;`);
    assert.equal(await evaluate('window.__show.director.manual.blinder'), false, 'a hidden tab releases its hold');
    // Effects moved from a details block to their own tab. Open that tab before
    // checking native focus and the keyboard hold/release behavior.
    await evaluate(`document.getElementById('tabEffects').click(); const btn = document.getElementById('btnBlinder'); btn.focus(); btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    assert.equal(await evaluate(`document.activeElement === document.getElementById('btnBlinder')`), true);
    assert.equal(await evaluate(`document.getElementById('btnBlinder').getAttribute('aria-pressed')`), 'true');
    await evaluate(`document.getElementById('btnBlinder').blur()`);
    assert.equal(await evaluate('window.__show.director.manual.blinder'), false, 'keyboard hold releases when the button loses focus');
    await evaluate(`document.getElementById('btnBlackout').click()`);
    assert.equal((await states()).btnBlackout, 'on');
    assert.equal(await evaluate(`document.getElementById('btnBlackout').getAttribute('aria-pressed')`), 'true');
    await evaluate(`document.getElementById('btnBlackout').click(); document.querySelectorAll('#panel details').forEach(el => el.open = true);`);

    fs.mkdirSync('rec/look/controls', { recursive: true });
    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
      await evaluate(`document.getElementById('tabEffects').click(); document.getElementById('panel').scrollTop = 0`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`rec/look/controls/${backend}-${width}.png`, Buffer.from(shot.data, 'base64'));
      assert.equal(await evaluate(`(() => {
        const panel = document.getElementById('panel'), box = panel.getBoundingClientRect();
        return box.right <= innerWidth && box.bottom <= innerHeight && panel.scrollWidth <= panel.clientWidth;
      })()`), true, 'controls fit the viewport without horizontal scrolling');
      await evaluate(`document.getElementById('tabLights').click(); document.getElementById('resetSliders').scrollIntoView({ block: 'center' })`);
      const settings = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`rec/look/controls/${backend}-${width}-settings.png`, Buffer.from(settings.data, 'base64'));
    }
    assert.deepEqual(errors, []);
  });
});
