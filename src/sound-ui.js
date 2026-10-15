// Connecting the sound: an audio file (chosen or dropped on the page), system audio or an input device, and
// reconnecting the source of last time. The show reads the sound through audio; this only connects it.
import { $, keep, kept, fill } from './ui.js';

const LABEL = { file: 'Choose an audio file', system: 'Connect system audio', input: 'Connect audio input' };
const CONNECTED = { file: 'Choose another audio file', system: 'System audio connected · reconnect', input: 'Audio input connected · reconnect' };
const INPUT_ERRORS = { NotAllowedError: 'Audio permission denied · allow microphone access in the browser and try again', NotFoundError: 'The selected audio input is unavailable · refresh devices and choose another', OverconstrainedError: 'The selected audio input is unavailable · refresh devices and choose another', NotReadableError: 'The audio input could not start · check the device and other apps' };

export function mountSound(audio) {
  const failed = e => { audio.message = 'No audio: ' + e.message; $('status').textContent = audio.message; };
  // a browser starts sound only after a click or a key
  const wake = () => {
    if (audio.ctx?.state === 'suspended') audio.ctx.resume().then(() => { if (audio.message === 'Click or press a key to start the audio') audio.message = ''; }).catch(failed);
  };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);

  let preferredInput = kept('input', ''), inputListRequest = 0;
  async function refreshInputs() {
    const request = ++inputListRequest;
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error('Audio inputs are unavailable in this browser');
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId);
      if (request !== inputListRequest) return;
      const entries = [['', 'System default'], ...devices.map((d, i) => [d.deviceId, d.label || `Audio input ${i + 1}`])];
      const missing = preferredInput && !devices.some(d => d.deviceId === preferredInput);
      if (missing) entries.push([preferredInput, 'Previously selected input (unavailable)']);
      fill($('audioInput'), entries, preferredInput);
      if (missing) $('inputHint').textContent = 'The selected input is unavailable. Choose another device and connect.';
      else if (!devices.some(d => d.label)) $('inputHint').textContent = 'Connect once to reveal device names. For rekordbox, choose BlackHole 2ch.';
      else $('inputHint').textContent = 'For rekordbox, choose BlackHole 2ch and route rekordbox to your Multi-Output Device.';
    } catch (e) { if (request === inputListRequest) $('inputHint').textContent = e.message; }
  }
  $('refreshInputs').onclick = refreshInputs;
  $('audioInput').onchange = () => { preferredInput = $('audioInput').value; keep('input', preferredInput); };
  navigator.mediaDevices?.addEventListener('devicechange', refreshInputs);
  $('audioSource').onchange = () => {
    $('playFile').textContent = LABEL[$('audioSource').value];
    $('inputControls').hidden = $('audioSource').value !== 'input';
    if (!$('inputControls').hidden) refreshInputs();
  };
  const chooseSource = source => { $('audioSource').value = source; $('audioSource').onchange(); keep('source', source); };
  $('audioSource').value = ['file', 'system', 'input'].includes(kept('source', 'file')) ? kept('source', 'file') : 'file';
  $('audioSource').onchange();
  $('playFile').onclick = () => {
    const source = $('audioSource').value;
    if (source === 'file') { $('audioFile').click(); return; }
    $('playFile').disabled = true;
    audio.message = 'Connecting audio…'; $('status').textContent = audio.message;
    (source === 'system' ? audio.system() : audio.input(preferredInput)).then(connected => {
      if (connected !== false) chooseSource(source);
      return refreshInputs();
    }).catch(e => failed(new Error(source === 'input' ? INPUT_ERRORS[e.name] || e.message : e.message)))
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

  // Restore the sound source of last time. A browser lets the page listen again without a click while it still has
  // permission for the input; if it does not, the status line asks for a click.
  (async () => {
    const source = kept('source', '');
    if (!source || source === 'file' || !navigator.permissions) return;
    try { if ((await navigator.permissions.query({ name: 'microphone' })).state !== 'granted') return; } catch { return; }
    (source === 'system' ? audio.system() : audio.input(preferredInput)).then(connected => {
      if (connected === false) return;
      if (audio.ctx.state !== 'running') audio.message = 'Click or press a key to start the audio';
      refreshInputs();
    }).catch(failed);
  })();

  return {
    failed, wake,
    // the connect button says what it will do, and whether the sound is in
    update(signal) {
      const source = $('audioSource').value, on = audio.live && signal.state !== 'lost' && signal.state !== 'suspended';
      $('playFile').dataset.connected = String(on);
      $('playFile').textContent = (on ? CONNECTED : LABEL)[source];
    },
  };
}
