import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage, renderFlags } from './browser.mjs';

test('the console keeps the show controls in one place, settings open apart and the start screen waits for the venue', { timeout: 180000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar controls did not start');
    const key = value => evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: '${value}', code: '${value}' }))`);
    assert.equal(await evaluate(`getComputedStyle(document.getElementById('start')).display`), 'none', 'a test browser goes straight to the show');

    // On a full HD screen the console is one row that never scrolls, with every show control on it.
    const layout = await evaluate(`(() => {
      const c = document.getElementById('console'), box = c.getBoundingClientRect();
      const rows = new Set([...c.querySelectorAll('.deck:not([hidden])')].map(d => Math.round(d.getBoundingClientRect().top)));
      return { fits: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, rows: rows.size, low: box.height < 200, scrolls: c.scrollHeight > c.clientHeight + 1,
        inside: ['playFile', 'mood', 'showTheme', 'lookPace', 'cam', 'lookLight', 'lookHaze', 'sens', 'switches', 'btnStrobe', 'btnPyro', 'btnBlackout'].every(id => c.contains(document.getElementById(id))) };
    })()`);
    assert.deepEqual(layout, { fits: true, rows: 1, low: true, scrolls: false, inside: true });

    // The buttons of a choice set the select behind them, and follow it when it changes elsewhere.
    await evaluate(`[...document.querySelectorAll('#showTheme + .seg button')].find(b => b.textContent === 'Hypnotic').click()`);
    assert.equal(await evaluate('window.__show.look.controls.showTheme'), 'hypnotic');
    assert.equal(await evaluate(`document.querySelector('#showTheme + .seg [aria-pressed="true"]').textContent`), 'Hypnotic');
    await evaluate(`document.getElementById('lookPace').value = 'lively'; document.getElementById('lookPace').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`document.querySelector('#lookPace + .seg [aria-pressed="true"]').textContent`), 'Lively');

    // A fixture is a switch on the console; its level is a fader in the settings.
    assert.equal(await evaluate('window.__show.look.off.laser'), true, 'lasers are off by default');
    await evaluate(`document.getElementById('fixture-laser').click()`);
    assert.equal(await evaluate('window.__show.look.off.laser'), false);
    assert.equal(await evaluate(`document.getElementById('fixtureLevels').contains(document.getElementById('level-laser'))`), true);

    // S opens the settings beside the console and Escape closes them; H hides the console.
    await key('s');
    assert.equal(await evaluate(`!document.getElementById('panel').classList.contains('hidden') && document.getElementById('openSettings').getAttribute('aria-expanded') === 'true'`), true);
    await evaluate(`document.getElementById('tabPicture').click()`);
    assert.equal(await evaluate(`!document.getElementById('pagePicture').hidden && document.getElementById('pageShow').hidden`), true);
    assert.equal(await evaluate(`document.getElementById('panel').getBoundingClientRect().bottom <= document.getElementById('console').getBoundingClientRect().top`), true, 'settings stay above the console');
    await key('Escape');
    assert.equal(await evaluate(`document.getElementById('panel').classList.contains('hidden')`), true);
    await key('h');
    assert.equal(await evaluate(`document.getElementById('console').classList.contains('hidden') && !document.getElementById('openPanel').hidden`), true);
    await key('h');
    assert.equal(await evaluate(`document.getElementById('console').classList.contains('hidden')`), false);

    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate(`(() => {
        const c = document.getElementById('console'), box = c.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && c.scrollWidth <= c.clientWidth;
      })()`), true, `${width}px keeps the console on screen`);
    }

    // A first visit sees the start screen: it waits for the venue, ignores show shortcuts and leaves on a click.
    await evaluate(`document.documentElement.classList.remove('started')`);
    await until(`!document.getElementById('startShow').disabled && document.getElementById('startShow').textContent === 'Start the show'`, 'The start screen did not offer the show');
    assert.equal(await evaluate(`document.querySelectorAll('#startSource button').length === 3 && document.querySelectorAll('#startQuality button').length === 4`), true);
    await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))`);
    assert.equal(await evaluate('window.__show.director.manual.blinder'), false, 'show shortcuts wait for the start');
    await evaluate(`document.getElementById('startDemo').click()`);
    assert.equal(await evaluate(`document.documentElement.classList.contains('started') && sessionStorage.getItem('sv.started') === '1'`), true);
    assert.deepEqual(errors, []);
  });
});

test('?hide shows the venue alone and keeps drawing', { timeout: 120000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low&hide` });
    await until('!!window.__show?.ready', 'The Hangar picture did not start');
    const frames = await evaluate('window.__show.signals.beats');
    await until(`window.__show.signals.beats > ${frames}`, 'The show stopped drawing');
    assert.equal(await evaluate(`['start', 'console', 'miniStatus', 'openPanel', 'panel'].every(id => { const el = document.getElementById(id); return !el.offsetParent && getComputedStyle(el).display === 'none' || el.classList.contains('hidden') || el.hidden; })`), true);
    assert.deepEqual(errors, []);
  });
});
