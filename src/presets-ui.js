// Named show presets in this browser: save, update, delete (with undo), load, and a backup file to export and import.
// A preset keeps show controls, never live audio connections or graphics quality. main.js captures and applies them.
import { $, kept, fill } from './ui.js';
import { normalizePresets, parseStored } from './show-controls.js';

const MAX = 30;
// capture(id, name): the show as a preset; apply(preset): load it (async); busy(): the venue is still changing;
// usable(preset): its venue and mood exist here
export function mountPresets({ capture, apply, busy, usable }) {
  let saved = normalizePresets(parseStored(kept('presets', '[]'), [])), deleted = null;
  const say = text => { $('presetStatus').textContent = text; };
  function refresh(selected = '') {
    fill($('savedPreset'), [['', 'Choose a preset'], ...saved.map(p => [p.id, p.name])], selected);
    const found = saved.find(p => p.id === $('savedPreset').value);
    for (const id of ['loadPreset', 'updatePreset', 'deletePreset']) $(id).disabled = !found;
  }
  function store(next) {
    try { localStorage.setItem('sv.presets', JSON.stringify(next)); saved = next; return true; }
    catch { say('Could not save in this browser. Free some browser storage and try again.'); return false; }
  }
  $('savedPreset').onchange = () => {
    const selected = $('savedPreset').value; refresh(selected);
    $('presetName').value = saved.find(p => p.id === selected)?.name || ''; say('');
  };
  $('savePreset').onclick = () => {
    if (busy()) { say('Wait for the venue to finish loading.'); return; }
    const name = $('presetName').value.trim();
    if (!name) { say('Enter a name first.'); $('presetName').focus(); return; }
    if (saved.length >= MAX) { say(`${MAX} presets saved. Update or delete one to make room.`); return; }
    const preset = capture(crypto.randomUUID(), name);
    if (store([...saved, preset])) { refresh(preset.id); say(`Saved “${preset.name}”.`); }
  };
  $('updatePreset').onclick = () => {
    if (busy()) { say('Wait for the venue to finish loading.'); return; }
    const id = $('savedPreset').value, old = saved.find(p => p.id === id), name = $('presetName').value.trim();
    if (!old || !name) { say('Select a preset and enter its name first.'); return; }
    const preset = capture(id, name);
    if (store(saved.map(p => p.id === id ? preset : p))) { refresh(id); say(`Updated “${preset.name}”.`); }
  };
  $('deletePreset').onclick = () => {
    const id = $('savedPreset').value, old = saved.find(p => p.id === id), index = saved.findIndex(p => p.id === id);
    if (!old) return;
    if (store(saved.filter(p => p.id !== id))) { deleted = { preset: old, index }; $('undoDeletePreset').hidden = false; refresh(); $('presetName').value = ''; say(`Deleted “${old.name}”. You can undo this.`); }
  };
  $('undoDeletePreset').onclick = () => {
    if (!deleted || saved.length >= MAX) { say('Make room for a preset first.'); return; }
    const { preset, index } = deleted, next = saved.filter(p => p.id !== preset.id);
    next.splice(index, 0, preset);
    if (store(next)) { refresh(preset.id); $('presetName').value = preset.name; say(`Restored “${preset.name}”.`); deleted = null; $('undoDeletePreset').hidden = true; }
  };
  $('exportPresets').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, presets: saved }, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'stage-visualizer-presets.json' }); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); say(`Exported ${saved.length} presets.`);
  };
  $('importPresets').onclick = () => $('presetBackupFile').click();
  $('presetBackupFile').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Backup is too large (maximum 1 MB).');
      const raw = JSON.parse(await file.text()), items = Array.isArray(raw) ? raw : raw.presets;
      const incoming = normalizePresets(items).filter(usable).map(p => ({ ...p, cam: p.cam === 'auto' || /^[0-8]$/.test(p.cam) ? p.cam : 'auto' }));
      if (!incoming.length) throw new Error('No compatible presets found.');
      const fresh = incoming.filter(p => !saved.some(old => old.id === p.id));
      if (saved.length + fresh.length > MAX) throw new Error(`Not enough room: maximum ${MAX} presets. Your existing presets were kept.`);
      if (store([...saved, ...fresh])) { refresh(fresh[0]?.id || $('savedPreset').value); say(`Imported ${fresh.length} presets. Existing presets kept.`); }
    } catch (error) { say('Could not import: ' + error.message); }
  };
  $('loadPreset').onclick = async () => {
    const preset = saved.find(p => p.id === $('savedPreset').value);
    if (!preset || !usable(preset)) { say('This preset’s venue or mood is unavailable.'); return; }
    for (const id of ['loadPreset', 'updatePreset', 'deletePreset', 'savePreset', 'savedPreset', 'resetShow']) $(id).disabled = true;
    try { await apply(preset); say(`Loaded “${preset.name}”.`); }
    catch (e) { say('Could not load: ' + e.message); }
    finally { for (const id of ['savePreset', 'savedPreset', 'resetShow']) $(id).disabled = false; refresh($('savedPreset').value); }
  };
  refresh();
  // after the show was reset: nothing selected, presets kept
  return { clear(message) { $('savedPreset').value = ''; refresh(); $('presetName').value = ''; say(message); } };
}
