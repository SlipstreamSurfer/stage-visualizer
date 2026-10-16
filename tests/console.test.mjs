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

test('a click with the mouse leaves the keys with the show; a text field keeps them', { timeout: 120000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar did not start');
    // real input, as the browser gets it: where a click lands decides where the focus goes
    const click = async selector => {
      const [x, y] = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    };
    const code = { ' ': 'Space', Escape: 'Escape' }, vk = { ' ': 32, Escape: 27 };
    const down = key => send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: code[key] || (/[0-9]/.test(key) ? 'Digit' + key : 'Key' + key.toUpperCase()), text: key.length === 1 ? key : undefined, windowsVirtualKeyCode: vk[key] || key.toUpperCase().charCodeAt(0) });
    const up = key => send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: code[key] || (/[0-9]/.test(key) ? 'Digit' + key : 'Key' + key.toUpperCase()), windowsVirtualKeyCode: vk[key] || key.toUpperCase().charCodeAt(0) });
    const press = async key => { await down(key); await up(key); };
    await click('#showTheme + .seg button:nth-child(2)');
    await press('3');
    assert.equal(await evaluate(`document.getElementById('cam').value`), '2', 'a camera key after a click on the console');
    await down(' ');
    assert.equal(await evaluate('window.__show.director.manual.strobe'), true, 'Space is the strobe, not the button clicked before');
    await up(' ');
    await click('#fixture-laser');
    await down(' ');
    assert.equal(await evaluate('window.__show.director.manual.strobe && window.__show.look.off.laser === false'), true, 'also after a switch');
    await up(' ');
    await click('#openSettings'); await click('#closeSettings');
    await press('s'); await press('Escape');
    await press('4');
    assert.equal(await evaluate(`document.getElementById('cam').value + ' ' + document.activeElement.tagName`), '3 BODY', 'the settings give the keys back');
    await press('s'); await evaluate(`document.getElementById('tabPresets').click(); document.getElementById('presetName').focus()`);
    for (const key of 'hm2') await press(key);
    assert.equal(await evaluate(`[document.getElementById('presetName').value, document.getElementById('cam').value, document.getElementById('console').classList.contains('hidden')].join()`), 'hm2,3,false', 'a name is typed, not played');
    assert.deepEqual(errors, []);
  });
});

test('walking round with W, the work lights with L, and the people in the hall switched off and on', { timeout: 120000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar did not start');
    const key = async (k, code) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 27 }); };
    await key('w', 'KeyW');
    assert.equal(await evaluate(`document.getElementById('cam').value + ' ' + !document.getElementById('walkHud').hidden`), 'walk true');
    const before = await evaluate('window.__show.camera.position.z');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 });
    await evaluate('new Promise(r => setTimeout(r, 800))');
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 });
    assert.notEqual(await evaluate('window.__show.camera.position.z'), before, 'S walks back');
    assert.equal(await evaluate(`document.getElementById('panel').classList.contains('hidden')`), true, 'and does not open the settings while walking');
    await key('l', 'KeyL');
    assert.equal(await evaluate('window.__show.look.work'), true);
    await key('Escape', 'Escape');
    assert.equal(await evaluate(`document.getElementById('cam').value + ' ' + document.getElementById('walkHud').hidden`), 'auto true');
    const people = () => evaluate(`(() => { let shown = 0; window.__show.world.env.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.aKit) shown += o.visible ? 1 : 0; }); return shown; })()`);
    assert.ok(await people() > 0);
    await evaluate(`(() => { const c = document.getElementById('crowd'); c.value = '0'; c.dispatchEvent(new Event('change')); const k = document.getElementById('layer-crew'); k.checked = false; k.dispatchEvent(new Event('change')); })()`);
    await until(`(() => { let shown = 0; window.__show.world.env.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.aKit) shown += o.visible ? 1 : 0; }); return shown === 0; })()`, 'the people did not go');
    assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('sv.controls')`)).crowd, 0, 'remembered');
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


test('a sunset with the hangar door open: the light changes over seconds, the door slides open and the outside shows', { timeout: 150000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    // every shader program the card links, so the test can say none is made while the show plays (each is a stall)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__linked = 0; if (window.WebGL2RenderingContext) { const link = WebGL2RenderingContext.prototype.linkProgram; WebGL2RenderingContext.prototype.linkProgram = function (p) { window.__linked++; return link.call(this, p); }; }` });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar did not start');
    const linked = await evaluate('window.__linked');
    assert.equal(await evaluate('window.__show.world.env.day + window.__show.world.env.sunset + window.__show.world.env.door'), 0, 'night with the door shut unless asked');
    await evaluate(`(() => { document.getElementById('openSettings').click(); document.getElementById('tabShow').click();
      [...document.querySelectorAll('#timeOfDay + .seg button')].find(b => b.dataset.value === 'sunset').click();
      const door = document.getElementById('hangarDoor'); door.checked = true; door.dispatchEvent(new Event('change')); })()`);
    assert.equal(await evaluate('window.__show.look.controls.timeOfDay + "/" + window.__show.look.controls.door'), 'sunset/true');
    await until('window.__show.world.env.sunset > 0.9', 'the sunset did not come');
    const halfway = await evaluate('window.__show.world.env.door');
    assert.ok(halfway > 0 && halfway < 1, `the door opens slowly (${halfway})`);
    await until('window.__show.world.env.door > 0.99', 'the door did not open', 40000);
    assert.equal(await evaluate(`(() => { let outside = false; window.__show.world.env.scene.traverse(o => { if (o.isMesh && o.geometry?.parameters?.radius === 700) outside = o.parent.visible; }); return outside; })()`), true, 'the sky outside shows through the door');
    assert.equal(await evaluate('window.__linked') - linked, 0, 'the sun, the door and the outside were compiled before the show began');
    assert.deepEqual(errors, []);
  });
});
