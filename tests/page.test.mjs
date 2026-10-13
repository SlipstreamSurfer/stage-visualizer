// Opens the real page in a headless Chromium and checks that a venue builds and the show runs in it: no errors, the
// demo track plays and the pyro fires; then an audio file is dropped on the page. The show is checked in the
// Hangar by default; PAGE_VENUES selects other public venues.
// Chrome, Edge or Chromium is required; BROWSER_PATH can select its executable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage, waitFor } from './browser.mjs';
import { RATE, listen } from '../tools/hear.mjs';
import { track } from './synth.mjs';
import { VENUES } from '../src/venues/index.js';

// A software browser needs ten to twenty seconds a venue, so the page is checked in one: the Hangar. That every
// venue lays out and plays is checked without a browser in show.test.mjs. PAGE_VENUES names other venues to tour
// (PAGE_VENUES=hangar,arena), or "all" for every venue of the show.
const ASKED = process.env.PAGE_VENUES || 'hangar', EVERY = ASKED === 'all';
const TOUR = EVERY ? VENUES : Object.fromEntries(ASKED.split(',').map(key => { if (!VENUES[key]) throw new Error(`PAGE_VENUES asks for "${key}", which is not a venue`); return [key, VENUES[key]]; }));

// samples as a 16-bit mono WAV file
function wav(pcm) {
  const out = Buffer.alloc(44 + pcm.length * 2);
  out.write('RIFF'); out.writeUInt32LE(36 + pcm.length * 2, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(RATE, 24);
  out.writeUInt32LE(RATE * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  return out;
}

// The current show is checked. Headless Chromium loses a software WebGPU device within seconds, so the show is asked
// for its WebGL way of drawing here: the same page, the same scene and the same materials, with every fixture on, at
// the lightest quality so that a software browser gets through all the venues. What only WebGPU has (the smoke as
// particles) is not covered.
for (const [title, page, store, venues] of [[`the show: ${EVERY ? 'every venue' : Object.values(TOUR).map(v => v.name).join(', ')} builds`, 'index.html?webgl&all&quality=low&', 'sv.', TOUR]])
test(`${title}, the demo show runs, the pyro fires and a dropped audio file is heard`, { timeout: 900000 }, () => withPage(['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], async ({ send, errors, port }) => {
    const look = async () => JSON.parse((await send('Runtime.evaluate', { returnByValue: true, expression:
      `JSON.stringify({ loading: !!document.getElementById('loading'), status: document.getElementById('status')?.textContent, flow: !!window.__show?.director.mood.flow, beat: window.__show?.signals.beats ?? -1, phase: window.__show?.signals.m.phase, venue: window.__show?.world.layout.name, fixtures: window.__show?.world.layout.things.length })` })).result.value);
    let seen;
    const took = Date.now();
    for (const [key, venue] of Object.entries(venues).reverse()) {   // the first venue last, for the file below
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/${page}venue=${key}` });
      for (let i = 0; i < 80; i++) {   // software rendering is slow; give the demo time to play a few kicks
        await new Promise(resolve => setTimeout(resolve, 500));
        seen = await look();
        if (errors.length || (!seen.loading && (seen.beat >= 2 || seen.flow))) break;   // music that flows has no kicks to count
      }
      await send('Runtime.evaluate', { expression: `for (const key of ['v', 'k', 'c']) window.dispatchEvent(new KeyboardEvent('keydown', { key }))` });   // pyro, confetti and CO2
      await waitFor(700);
      assert.deepEqual(errors, [], `errors on the page in ${venue.name}`);
      assert.equal(seen.venue, venue.name);
      assert.equal(seen.loading, false, 'the loading message is still up');
      assert.ok(seen.beat >= 2 || seen.flow, `${venue.name}: the demo should be playing; kicks counted: ${seen.beat}`);
      assert.match(seen.status, /^Demo mode/);
      assert.ok(seen.fixtures > 5, `${venue.name}: fixtures hung: ${seen.fixtures}`);
    }
    if (process.env.PAGE_TIMES) console.log(`${title}: ${Object.keys(venues).length} venues in ${((Date.now() - took) / 1000).toFixed(0)} s`);
    if (store === 'sv.') {   // what is parked still builds: the first venue with its bars, exits and people who walk
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/${page}details&venue=${Object.keys(venues)[0]}` });
      for (let i = 0; i < 80; i++) { await waitFor(500); seen = await look(); if (errors.length || (!seen.loading && seen.beat >= 2)) break; }
      assert.deepEqual(errors, [], 'errors on the page with the parked details built');
      assert.equal(seen.loading, false, 'the loading message is still up');
    }

    // An audio file dropped on the page: the browser plays it, and the show has to hear in it exactly what a replay
    // of the same samples hears (the kick coming in, the break, the drop), however slowly this browser draws.
    const { pcm } = track(128, [{ beats: 40, kick: true, hats: 0.6, pad: 0.5 }, { beats: 16, pad: 0.5 }, { beats: 24, kick: true, hats: 0.6, pad: 0.5 }]);   // four bars without the kick: a break, and a drop
    // Venue rendering is checked above. Exercise real file detection in a small
    // public venue to reduce software-renderer contention for the audio clock.
    // Cross-venue file/input continuity is covered separately in switch.test.mjs.
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?webgl&quality=low&venue=studio` });
    await new Promise(resolve => setTimeout(resolve, 6000));
    const expected = listen(pcm).events.filter(e => ['start', 'break', 'drop'].includes(e.type)).map(e => ({ t: e.t, what: e.type === 'start' ? 'kick comes in' : e.type }));
    await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => {
      const file = new File([Uint8Array.from(atob('${wav(pcm).toString('base64')}'), c => c.charCodeAt(0))], 'test-track.wav', { type: 'audio/wav' });
      const data = new DataTransfer(); data.items.add(file);
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: data }));
    })()` });
    let heard = [];
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      heard = JSON.parse((await send('Runtime.evaluate', { returnByValue: true, expression: 'JSON.stringify(window.__show.heard.filter(h => h.what !== "lift"))' })).result.value);
      if (errors.length || heard.some(h => h.what === 'drop')) break;
    }
    seen = await look();
    assert.deepEqual(errors, [], 'errors on the page');
    assert.match(seen.status, /^Live: test-track\.wav/);
    assert.deepEqual(heard.map(h => h.what), expected.map(e => e.what), `the page heard ${JSON.stringify(heard)}, a replay hears ${JSON.stringify(expected)}`);
    // The page starts listening a moment before the file starts playing, so its times run a fixed bit behind. Beyond
    // that, this software-rendered browser is so busy drawing that its sound stutters and it hears a few per cent
    // less than was played, so the times are held loosely here. That the Ear itself hears the same however the sound
    // is cut up is tested exactly in listen.test.mjs.
    const lag = heard[0].t - expected[0].t;
    for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(heard[i].t - lag - expected[i].t) < 0.9, `${expected[i].what}: the page at ${(heard[i].t - lag).toFixed(2)} s, a replay at ${expected[i].t.toFixed(2)} s`);
}));
