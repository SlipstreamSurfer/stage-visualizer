import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORMS, platformOf, guideOf, pickDevice } from '../src/setup.js';

test('every way of playing has setup steps on macOS, Windows and Linux, in the names those systems use', () => {
  for (const source of ['system', 'rekordbox', 'file', 'input']) for (const platform of Object.keys(PLATFORMS)) assert.ok(guideOf(source, platform).length >= 1, `${source} on ${platform}`);
  const text = (source, platform) => guideOf(source, platform).map(s => s.text).join(' ');
  assert.match(text('system', 'macos'), /BlackHole 2ch.*Multi-Output Device/s);
  assert.match(text('system', 'linux'), /stage-visualizer\.conf/);
  assert.match(text('system', 'windows'), /share system audio/);
  assert.match(text('rekordbox', 'macos'), /rekordbox → Preferences → Audio/);
  assert.match(text('rekordbox', 'windows'), /CABLE Input/);
  assert.match(text('rekordbox', 'linux'), /not on Linux.*--rekordbox-lan/s, 'rekordbox on Linux: sound and data come from the laptop');
  for (const platform of Object.keys(PLATFORMS)) assert.ok(guideOf('rekordbox', platform).some(s => s.check === 'decks'), `rekordbox on ${platform} shows whether deck data arrives`);
});

test('the device for a way of playing is found by its name on each system', () => {
  const devices = [{ kind: 'audioinput', deviceId: 'mic', label: 'MacBook Pro Microphone' }, { kind: 'audioinput', deviceId: 'bh', label: 'BlackHole 2ch (Virtual)' },
    { kind: 'audioinput', deviceId: 'cable', label: 'CABLE Output (VB-Audio Virtual Cable)' }, { kind: 'audioinput', deviceId: 'pw', label: 'System audio (Stage Visualizer)' }];
  assert.equal(pickDevice('rekordbox', 'macos', devices)?.deviceId, 'bh');
  assert.equal(pickDevice('system', 'macos', devices)?.deviceId, 'bh');
  assert.equal(pickDevice('rekordbox', 'windows', devices)?.deviceId, 'cable');
  assert.equal(pickDevice('system', 'linux', devices)?.deviceId, 'pw');
  assert.equal(pickDevice('rekordbox', 'linux', devices), null, 'on Linux the interface is chosen by hand');
  assert.equal(pickDevice('rekordbox', 'macos', devices.map(d => ({ ...d, label: '' }))), null, 'no names before the browser may use inputs');
});

test('the computer is recognised from what the browser says', () => {
  assert.equal(platformOf({ userAgentData: { platform: 'macOS' } }), 'macos');
  assert.equal(platformOf({ platform: 'Win32' }), 'windows');
  assert.equal(platformOf({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), 'linux');
  assert.equal(platformOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), 'macos');
});
