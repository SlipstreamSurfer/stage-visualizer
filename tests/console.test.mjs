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
    assert.equal(await evaluate(`document.querySelectorAll('#startSource button').length === 4 && document.querySelectorAll('#startQuality button').length === 4`), true);
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

test('a newer tab with the show pauses this one until it is clicked, and then that one waits', { timeout: 120000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar did not start');
    await evaluate(`window.__other = new BroadcastChannel('stage-visualizer'); window.__heard = []; window.__other.onmessage = e => window.__heard.push(e.data); window.__other.postMessage('playing')`);
    await until(`!document.getElementById('elsewhere').hidden`, 'this tab did not pause for the other one');
    const clock = await evaluate('window.__show.signals.phase');
    await evaluate(`new Promise(r => setTimeout(r, 1200))`);
    assert.equal(await evaluate('window.__show.signals.phase'), clock, 'a paused tab does not run the show');
    await evaluate(`document.getElementById('elsewhere').click()`);
    await until(`document.getElementById('elsewhere').hidden && window.__heard.includes('playing')`, 'clicking did not take the show back');
    assert.deepEqual(errors, []);
  });
});

test('one choice says how you play, and the settings show its setup for this computer with what SV can see', { timeout: 120000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar did not start');
    assert.deepEqual(await evaluate(`[...document.getElementById('audioSource').options].map(o => o.textContent)`), ['System audio', 'Rekordbox', 'Audio file', 'Other input']);
    await evaluate(`(() => { const s = document.getElementById('audioSource'); s.value = 'rekordbox'; s.dispatchEvent(new Event('change')); document.getElementById('openSettings').click(); document.getElementById('tabSound').click(); })()`);
    assert.equal(await evaluate(`document.getElementById('playFile').textContent`), 'Connect rekordbox');
    assert.equal(await evaluate(`document.getElementById('setupSource').textContent`), 'Rekordbox');
    assert.equal(await evaluate(`document.getElementById('inputControls').hidden`), false, 'rekordbox comes in through an input device');
    for (const platform of ['macos', 'windows', 'linux']) {
      await evaluate(`[...document.querySelectorAll('#platform + .seg button')].find(b => b.dataset.value === '${platform}').click()`);
      assert.ok(await evaluate(`document.querySelectorAll('#setupSteps li').length`) >= 3, `rekordbox steps on ${platform}`);
    }
    // this test server runs without the rekordbox receiver: the step says so
    await until(`[...document.querySelectorAll('#setupSteps .state')].some(s => s.textContent.includes('receiver off'))`, 'the receiver state was not shown');
    await evaluate(`(() => { const s = document.getElementById('audioSource'); s.value = 'system'; s.dispatchEvent(new Event('change')); })()`);
    await until(`document.getElementById('setupSource').textContent === 'System audio' && document.getElementById('inputControls').hidden`, 'system audio needs no device choice');
    assert.deepEqual(errors, []);
  });
});

