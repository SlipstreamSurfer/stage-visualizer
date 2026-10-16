// Connecting the sound. One choice says how you play (System audio, Rekordbox, an audio file or another input); this
// connects it with the device that carries it on this computer, shows the setup steps for macOS, Windows or Linux
// with what SV can see of them, follows the rekordbox data receiver, and reconnects the source of last time.
import { $, keep, kept, fill, segmented } from './ui.js';
import { platformOf, guideOf, pickDevice } from './setup.js';

const SOURCES = ['system', 'rekordbox', 'file', 'input'];
const NAME = { system: 'System audio', rekordbox: 'Rekordbox', file: 'Audio file', input: 'Other input' };
const LABEL = { file: 'Choose an audio file', system: 'Connect system audio', rekordbox: 'Connect rekordbox', input: 'Connect audio input' };
const CONNECTED = { file: 'Choose another audio file', system: 'System audio connected · reconnect', rekordbox: 'Rekordbox connected · reconnect', input: 'Audio input connected · reconnect' };
const INPUT_ERRORS = { NotAllowedError: 'Audio permission denied · allow microphone access in the browser and try again', NotFoundError: 'The selected audio input is unavailable · refresh devices and choose another', OverconstrainedError: 'The selected audio input is unavailable · refresh devices and choose another', NotReadableError: 'The audio input could not start · check the device and other apps' };
const usesDevice = source => source === 'input' || source === 'rekordbox';
const deviceKey = source => source === 'rekordbox' ? 'rekordboxInput' : 'input';   // each remembers its own device

export function mountSound(audio) {
  const failed = e => { audio.message = 'No audio: ' + e.message; $('status').textContent = audio.message; };
  // a browser starts sound only after a click or a key
  const wake = () => {
    if (audio.ctx?.state === 'suspended') audio.ctx.resume().then(() => { if (audio.message === 'Click or press a key to start the audio') audio.message = ''; }).catch(failed);
  };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
  const source = () => $('audioSource').value;
  let rekordbox = null, polling = false, signal = { state: 'demo' };   // what the rekordbox receiver last said; the sound as last measured
  let shown = '';   // what the setup steps say now: they are built again only when that changes, not twice a second

  // this computer, as the browser says, unless chosen otherwise
  $('platform').value = ['macos', 'windows', 'linux'].includes(kept('platform', '')) ? kept('platform', '') : platformOf();
  $('platform').onchange = () => { keep('platform', $('platform').value); refreshInputs(); render(); };
  segmented($('platform'));

  // the inputs the browser lists; names only once it may use them
  let devices = [], inputListRequest = 0;
  const named = () => devices.some(d => d.label);
  async function refreshInputs() {
    const request = ++inputListRequest;
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error('Audio inputs are unavailable in this browser');
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId);
      if (request !== inputListRequest) return;
      devices = list;
      const key = deviceKey(source()), wanted = kept(key, '') || pickDevice(source(), $('platform').value, devices)?.deviceId || '';
      const entries = [['', 'System default'], ...devices.map((d, i) => [d.deviceId, d.label || `Audio input ${i + 1}`])];
      const missing = wanted && !devices.some(d => d.deviceId === wanted);
      if (missing) entries.push([wanted, 'Previously selected input (unavailable)']);
      fill($('audioInput'), entries, wanted);
      $('inputHint').textContent = missing ? 'The selected input is unavailable. Choose another device and connect.' : !named() ? 'Connect once to reveal device names.' : 'The input SV listens to for this way of playing.';
    } catch (e) { if (request === inputListRequest) $('inputHint').textContent = e.message; }
    render();
  }
  // device names, which a browser only gives once it may use an input
  async function allowInputs() {
    if (named()) return;
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); } catch {}
    await refreshInputs();
  }
  $('refreshInputs').onclick = refreshInputs;
  $('audioInput').onchange = () => { keep(deviceKey(source()), $('audioInput').value); render(); };
  navigator.mediaDevices?.addEventListener('devicechange', refreshInputs);
  $('audioSource').onchange = () => {
    $('playFile').textContent = LABEL[source()];
    $('inputControls').hidden = !usesDevice(source());
    render(); refreshInputs();
  };
  const chooseSource = s => { $('audioSource').value = s; $('audioSource').onchange(); keep('source', s); };
  $('audioSource').value = SOURCES.includes(kept('source', 'system')) ? kept('source', 'system') : 'system';
  $('audioSource').onchange();

  // Connect a way of playing. Rekordbox and, on a Mac, system audio come in through the virtual cable the setup
  // installs (BlackHole); on Linux system audio through the PipeWire input; elsewhere the browser shares it.
  async function connect(s) {
    const platform = $('platform').value;
    if (s === 'system' && platform !== 'macos') return audio.system();
    const chosen = kept(deviceKey(s), '');
    if (!chosen && s !== 'input') await allowInputs();   // to find the cable by its name, the browser has to give names
    const id = chosen || (s === 'input' ? '' : pickDevice(s, platform, devices)?.deviceId || ''), device = devices.find(d => d.deviceId === id);
    if (s === 'system' && !device) return audio.system();
    return audio.input(id, s === 'input' ? undefined : `${NAME[s]}${device?.label ? ' · ' + device.label : ''}`);
  }
  $('playFile').onclick = () => {
    const s = source();
    if (s === 'file') { $('audioFile').click(); return; }
    $('playFile').disabled = true;
    audio.message = 'Connecting audio…'; $('status').textContent = audio.message;
    connect(s).then(connected => {
      if (connected !== false) chooseSource(s);
      return refreshInputs();
    }).catch(e => failed(new Error(usesDevice(s) ? INPUT_ERRORS[e.name] || e.message : e.message)))
      .finally(() => { $('playFile').disabled = false; });
  };
  const play = file => audio.file(file).then(() => chooseSource('file')).catch(failed);
  $('audioFile').onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) play(file); };
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {   // an audio file dropped anywhere on the page plays too
    e.preventDefault();
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('audio/') || f.type.startsWith('video/'));
    if (file) play(file);
  });

  // The rekordbox data receiver (started with the server): is it there, and which deck plays.
  async function poll() {
    try { const r = await fetch('/__rekordbox', { cache: 'no-store', signal: AbortSignal.timeout(1500) }); rekordbox = r.ok ? await r.json() : null; } catch { rekordbox = null; }
  }
  const playing = () => {
    if (!rekordbox?.connected) return '';
    const decks = Object.entries(rekordbox.decks || {}), [id, deck] = decks.find(([k]) => k === 'master') || decks.find(([, d]) => d.connected) || [];
    if (!deck) return '';
    const f = deck.fields || {}, title = [f['track/artist'], f['track/title']].filter(Boolean).join(' – ');
    return `${id === 'master' ? 'Master' : 'Deck ' + id}${title ? ': ' + title : ''}${Number.isFinite(f['bpm/current']) ? ' · ' + f['bpm/current'].toFixed(1) + ' BPM' : ''}`;
  };

  // The steps for this way of playing on this computer, each with what SV can see of it.
  function state(check) {
    if (check === 'device') {
      const device = pickDevice(source(), $('platform').value, devices);
      return device ? [true, `found: ${device.label}`] : named() ? [false, 'not found'] : [false, 'connect once to look'];
    }
    if (check === 'sound') return audio.live && signal.state === 'receiving' ? [true, 'sound coming in'] : audio.live ? [false, 'connected, no sound yet'] : [false, 'not connected'];
    if (check === 'decks') return !rekordbox?.enabled ? ['warn', 'receiver off: restart SV'] : rekordbox.connected ? [true, playing() || 'deck data coming in'] : [false, 'waiting for rkbx_link'];
    return null;
  }
  function render() {
    $('setupSource').textContent = NAME[source()];
    const steps = guideOf(source(), $('platform').value).map(step => [step.text, step.check && state(step.check)]), now = JSON.stringify(steps);
    if (now === shown) return;
    shown = now;
    $('setupSteps').replaceChildren(...steps.map(([text, seen]) => {
      const li = document.createElement('li'); li.textContent = text;
      if (seen) { const chip = document.createElement('span'); chip.className = 'state'; chip.dataset.ok = String(seen[0]); chip.textContent = seen[1]; li.append(chip); }
      return li;
    }));
  }

  // Restore the sound source of last time. A browser lets the page listen again without a click while it still has
  // permission for the input; if it does not, the status line asks for a click.
  (async () => {
    const s = kept('source', '');
    if (!s || s === 'file' || !navigator.permissions) return;
    try { if ((await navigator.permissions.query({ name: 'microphone' })).state !== 'granted') return; } catch { return; }
    connect(s).then(connected => {
      if (connected === false) return;
      if (audio.ctx.state !== 'running') audio.message = 'Click or press a key to start the audio';
      refreshInputs();
    }).catch(failed);
  })();

  return {
    failed, wake,
    // what is playing on the decks, for the status line, when rekordbox is the way of playing
    get note() { return source() === 'rekordbox' ? playing() : ''; },
    // twice a second: the connect button says what it will do and whether the sound is in; the steps show what is seen
    update(now) {
      signal = now;
      const s = source(), on = audio.live && now.state !== 'lost' && now.state !== 'suspended';
      $('playFile').dataset.connected = String(on);
      $('playFile').textContent = (on ? CONNECTED : LABEL)[s];
      if (!polling && (s === 'rekordbox' || !$('pageSound').hidden)) { polling = true; poll().finally(() => { polling = false; }); }
      render();
    },
  };
}
