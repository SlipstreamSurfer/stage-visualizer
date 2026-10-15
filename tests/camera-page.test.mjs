import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage, waitFor, renderFlags } from './browser.mjs';

test('Hangar camera controls render the hall views', { timeout: 240000 }, async () => {
  await withPage(renderFlags(), async ({ send, evaluate, until, errors, port }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/?venue=hangar&quality=normal&skip=24&details` });
    await until('!!window.__show?.ready', 'The camera preview did not start');
    fs.mkdirSync('rec/look/cameras', { recursive: true });
    for (const key of ['hangar']) {
      const previousCamera = await evaluate(`document.getElementById('cam').value`);
      await evaluate(`document.getElementById('venue').value = '${key}'; document.getElementById('venue').dispatchEvent(new Event('change'));`);
      await until(`!window.__show.changing && window.__show.world.layout.name === document.getElementById('venue').selectedOptions[0].textContent`, `The venue ${key} did not load`);
      assert.equal(await evaluate(`document.getElementById('cam').value`), previousCamera, 'the selected standard camera survives a venue change');
      const count = await evaluate('window.__show.cams.list.length');
      const indices = Array.from({ length: count }, (_, i) => i);
      for (const i of indices) {
        await evaluate(`document.getElementById('cam').value = '${i}'; document.getElementById('cam').dispatchEvent(new Event('change')); window.__show.cams.lastCut = -40;`);
        await waitFor(150);
        assert.equal(await evaluate('window.__show.cams.index'), i);
        assert.equal(await evaluate('window.__show.cams.auto'), false);
        const screenshot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
        fs.writeFileSync(`rec/look/cameras/${key}-${i + 1}.jpg`, Buffer.from(screenshot.data, 'base64'));
        assert.deepEqual(errors, [], `${key}: camera ${i + 1} renders without errors`);
      }
      // Return to a standard view before leaving a venue with extra facility/drone views.
      await evaluate(`document.getElementById('cam').value = '0'; document.getElementById('cam').dispatchEvent(new Event('change'));`);
    }
    await evaluate(`document.getElementById('cam').value = 'auto'; document.getElementById('cam').dispatchEvent(new Event('change'));`);
    assert.equal(await evaluate('window.__show.cams.auto'), true);
    assert.deepEqual(errors, []);
  });
});
