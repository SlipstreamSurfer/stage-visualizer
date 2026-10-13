// File playback and listening notes use the player's clock, never the show's uptime.
const STORAGE = 'sv.trackMarks';
export const playbackTime = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const tenths = Math.floor(seconds * 10);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
};
const TYPES = [['observation', 'Review this moment'], ['build_up', 'Build-up'], ['break', 'Break'], ['drop', 'Drop'], ['groove', 'Groove'], ['false_impact', 'Wrong show impact']];
const FEEDBACK = [['unrated', 'Not rated yet'], ['good', 'Good'], ['wrong', 'Something is wrong'], ['late_drop', 'Drop too late'], ['early_drop', 'Drop too early'], ['false_drop', 'False drop'], ['missed_drop', 'Missed drop'], ['build_after_drop', 'Still building during the drop'], ['lighting', 'Lights do not fit']];
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function mountPlayback({ audio, root, notes, snapshot }) {
  const $ = id => document.getElementById(id);
  let store;
  try { store = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch {}
  if (!store || typeof store !== 'object' || Array.isArray(store)) store = {};
  let key = '', marks = [];
  let syncing = Promise.resolve();
  const localServer = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const sync = trackKey => {
    if (!localServer) return;
    let file;
    try { file = JSON.parse(trackKey); } catch { return; }
    if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || !Number.isFinite(file.lastModified)) return;
    const body = JSON.stringify({ file, marks: Array.isArray(store[trackKey]) ? store[trackKey] : [] });
    syncing = syncing.catch(() => {}).then(async () => {
      try {
        const response = await fetch('/__feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!response.ok) throw new Error();
        if (key === trackKey) $('feedbackSave').textContent = 'Saved to this project automatically';
      } catch {
        if (key === trackKey) $('feedbackSave').textContent = 'Project save unavailable · notes remain in this browser';
      }
    });
  };
  // Recover previous listening sessions even before the user selects a file.
  for (const trackKey of Object.keys(store)) if (Array.isArray(store[trackKey])) sync(trackKey);
  const active = () => audio.live && !!audio.playerNode && audio.source === audio.playerNode;
  const save = () => {
    store[key] = marks;
    sync(key);
    try { localStorage.setItem(STORAGE, JSON.stringify(store)); return true; } catch { return false; }
  };
  const renderNotes = () => {
    $('markList').replaceChildren();
    $('markCount').textContent = `${marks.length} marked moment${marks.length === 1 ? '' : 's'}`;
    $('exportMarks').disabled = !marks.length;
    for (const mark of [...marks].reverse()) {
      const row = document.createElement('li'), heading = document.createElement('div');
      heading.className = 'mark-heading';
      const time = document.createElement('strong'); time.textContent = playbackTime(mark.seconds);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove mark at ${playbackTime(mark.seconds)}`);
      remove.onclick = () => { marks.splice(marks.indexOf(mark), 1); save(); renderNotes(); };
      heading.append(time, remove);
      const kind = document.createElement('select'); kind.setAttribute('aria-label', `Feedback at ${playbackTime(mark.seconds)}`);
      for (const [value, label] of FEEDBACK) kind.add(new Option(label, value));
      kind.value = mark.feedback || 'unrated';
      kind.onchange = () => { mark.feedback = kind.value; save(); };
      const note = document.createElement('input'); note.type = 'text'; note.value = mark.notes;
      note.placeholder = 'What did you hear or see?'; note.maxLength = 1000;
      note.setAttribute('aria-label', `Note at ${playbackTime(mark.seconds)}`);
      note.oninput = () => { mark.notes = note.value; save(); };
      row.append(heading, kind, note); $('markList').append(row);
    }
  };
  const update = () => {
    root.hidden = notes.hidden = !active();
    if (!active()) return;
    const player = audio.player;
    if (player.parentElement !== $('fileTransport')) {
      player.controls = true; player.setAttribute('aria-label', 'Audio file playback');
      $('fileTransport').replaceChildren(player);
    }
    const nextKey = JSON.stringify(audio.fileInfo);
    if (nextKey !== key) {
      key = nextKey;
      marks = Array.isArray(store[key]) ? store[key].filter(m => m && Number.isFinite(m.seconds) && m.seconds >= 0 && typeof m.notes === 'string' && TYPES.some(([value]) => value === m.event)) : [];
      $('markStatus').textContent = ''; renderNotes();
      $('feedbackSave').textContent = localServer ? 'Saving notes to this project…' : 'Notes saved in this browser';
      sync(key);
    }
    $('playbackTime').textContent = `${playbackTime(player.currentTime)} / ${playbackTime(player.duration)}`;
    $('restartFile').disabled = !Number.isFinite(player.duration);
    $('markMoment').disabled = !Number.isFinite(player.duration) || player.seeking;
    $('markGood').disabled = $('markMoment').disabled;
  };
  const markMoment = (feedback = 'unrated') => {
    if (!active() || !Number.isFinite(audio.player.duration) || audio.player.seeking) return;
    update();
    const seconds = Math.round(audio.player.currentTime * 1000) / 1000;
    marks.push({ seconds, event: 'observation', feedback, notes: '', marked_at: new Date().toISOString(), context: snapshot() });
    const saved = save(); renderNotes();
    $('markStatus').textContent = `${feedback === 'good' ? 'Good' : feedback === 'wrong' ? 'Wrong' : 'Marked'} at ${playbackTime(seconds)} · ${saved ? 'saved' : 'download your marks to keep them'}`;
  };
  $('markMoment').onclick = () => markMoment('wrong');
  $('markGood').onclick = () => markMoment('good');
  $('restartFile').onclick = async () => {
    if (!active()) return;
    audio.player.currentTime = 0;
    try { await audio.player.play(); } catch { $('markStatus').textContent = 'Press Play to restart the file'; }
  };
  $('exportMarks').onclick = () => {
    if (!active() || !marks.length) return;
    const columns = ['start_seconds', 'end_seconds', 'event', 'notes', 'feedback', 'venue', 'mood', 'detected_section', 'detected_phase', 'bpm', 'sensitivity', 'show_status', 'segment_start_seconds', 'marked_at'];
    const rows = [...marks].sort((a, b) => a.seconds - b.seconds).map(m => {
      const c = m.context || {};
      return [m.seconds, m.seconds, m.event, m.notes, m.feedback || 'unrated', c.venue, c.mood, c.section, c.phase, c.bpm, c.sensitivity, c.show_status, c.segment_start_seconds, m.marked_at].map(csv).join(',');
    });
    const url = URL.createObjectURL(new Blob([columns.join(',') + '\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = audio.label.replace(/\.[^.]+$/, '').replace(/[\\/]/g, '_') + '.annotations.csv';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  update();
  return { update, markMoment };
}
