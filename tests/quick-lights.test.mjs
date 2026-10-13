import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './browser.mjs';

test('quick lights stay reachable beside the Hangar menu on desktop and mobile', { timeout: 120000 }, async () => {
  await withPage([], async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=low` });
    await until('!!window.__show?.ready', 'The Hangar controls did not start');

    assert.deepEqual(await evaluate(`(() => {
      const button = document.getElementById('quickLightsToggle'), tray = document.getElementById('quickLightPanel');
      const switchesMoved = tray.contains(document.getElementById('switches')) && document.querySelector('#pageLights #switches') === null;
      button.click(); const opens = !tray.hidden && button.getAttribute('aria-expanded') === 'true';
      button.click(); const closes = tray.hidden && button.getAttribute('aria-expanded') === 'false';
      const input = document.querySelector('#switches input[type="checkbox"]');
      return { switchesMoved, opens, closes, hasFixtureControl: !!input };
    })()`), { switchesMoved: true, opens: true, closes: true, hasFixtureControl: true });

    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
      const fits = await evaluate(`(() => {
        const panel = document.getElementById('panel').getBoundingClientRect();
        const button = document.getElementById('quickLightsToggle').getBoundingClientRect();
        return panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight &&
          button.left >= 0 && button.right <= innerWidth && button.bottom <= innerHeight &&
          (innerWidth > 600 || button.top >= panel.bottom);
      })()`);
      assert.equal(fits, true, `${width}px layout keeps the menu and quick-light button visible`);
    }
    assert.deepEqual(errors, []);
  });
});
