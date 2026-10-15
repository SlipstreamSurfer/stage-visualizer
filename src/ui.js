// The page around the show: helpers for the controls, the menu pages, the console and the settings beside it, the
// keyboard help and the start screen. Nothing here knows about the show; main.js passes in what it needs.
export const $ = id => document.getElementById(id);
export const keep = (key, value) => { try { localStorage.setItem('sv.' + key, value); } catch {} };
export const kept = (key, fallback) => { try { return localStorage.getItem('sv.' + key) ?? fallback; } catch { return fallback; } };
export const started = () => document.documentElement.classList.contains('started');   // past the start screen (index.html)
export const fill = (select, entries, value) => { select.replaceChildren(); for (const [v, name] of entries) select.add(new Option(name, v)); select.value = value; };
// a list in groups: [[group, [[value, name], ...]], ...]
export const groups = (select, lists, value) => { select.replaceChildren(); for (const [label, entries] of lists) if (entries.length) { const g = document.createElement('optgroup'); g.label = label; for (const [v, name] of entries) g.append(new Option(name, v)); select.append(g); } select.value = value; };
export const sliderValue = id => { $(id + 'Value').value = (+$(id).value).toFixed(2) + '×'; };

// buttons for the options of a select, all in view: the select keeps the value, so everything that reads or sets it still works
const segments = [];
export function segmented(select, box) {
  if (!box) { box = document.createElement('div'); select.after(box); }
  box.classList.add('seg'); box.setAttribute('role', 'group');
  if (!box.hasAttribute('aria-labelledby')) box.setAttribute('aria-label', select.labels?.[0]?.textContent || select.getAttribute('aria-label') || '');
  const sync = () => { for (const b of box.children) { b.setAttribute('aria-pressed', String(b.dataset.value === select.value)); b.disabled = select.disabled; } };
  const draw = () => {
    box.replaceChildren(...[...select.options].filter(o => !o.disabled).map(o => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.text; b.dataset.value = o.value;
      b.onclick = () => { select.value = o.value; select.dispatchEvent(new Event('change')); sync(); };
      return b;
    }));
    sync();
  };
  select.addEventListener('change', sync); draw(); segments.push({ draw, sync });
}
export const syncSegments = () => { for (const s of segments) s.sync(); };

// The console with what the show needs, always in the same place, and the settings for the rest.
// release: lets go of held effects whenever a control takes the focus or the console goes away.
const MENU_PAGES = ['Show', 'Lights', 'Picture', 'Presets', 'Sound', 'Keys'];
export function mountControls({ release }) {
  function selectMenuPage(page, focus = false) {
    if (!MENU_PAGES.includes(page)) page = 'Show';
    release();
    for (const name of MENU_PAGES) {
      const active = name === page, tab = $('tab' + name);
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      $('page' + name).hidden = !active;
    }
    $('page' + page).parentElement.scrollTop = 0;
    keep('menuTab', page);
    if (focus) $('tab' + page).focus();
  }
  for (const [i, page] of MENU_PAGES.entries()) {
    $('tab' + page).onclick = () => selectMenuPage(page);
    $('tab' + page).onkeydown = e => {
      const next = e.key === 'ArrowRight' ? (i + 1) % MENU_PAGES.length : e.key === 'ArrowLeft' ? (i + MENU_PAGES.length - 1) % MENU_PAGES.length : e.key === 'Home' ? 0 : e.key === 'End' ? MENU_PAGES.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault(); selectMenuPage(MENU_PAGES[next], true);
    };
  }
  const settingsOpen = () => !$('panel').classList.contains('hidden');
  function setSettingsOpen(open) {
    $('panel').classList.toggle('hidden', !open);
    $('openSettings').setAttribute('aria-expanded', String(open));
    if (open) document.querySelector('.menu-tabs [aria-selected="true"]').focus();
  }
  function setConsoleVisible(visible) {
    if (!visible) { release(); setSettingsOpen(false); }
    $('console').classList.toggle('hidden', !visible); $('openPanel').hidden = visible;
    $('openPanel').setAttribute('aria-expanded', String(visible));
  }
  // settings stay above the console, however high it is
  new ResizeObserver(() => document.documentElement.style.setProperty('--console-h', ($('console').offsetHeight && $('console').offsetHeight + 12) + 'px')).observe($('console'));
  $('hidePanel').onclick = () => { setConsoleVisible(false); $('openPanel').focus(); };
  $('openPanel').onclick = () => { setConsoleVisible(true); $('hidePanel').focus(); };
  $('openSettings').onclick = () => setSettingsOpen(!settingsOpen());
  $('closeSettings').onclick = () => { setSettingsOpen(false); $('openSettings').focus(); };
  selectMenuPage(kept('menuTab', 'Show'));

  const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  $('fullscreenPanel').onclick = fullscreen;
  function showShortcutHelp() {
    release(); const hint = $('hint').cloneNode(true); hint.removeAttribute('id');
    $('shortcutHelpContent').replaceChildren(hint); if (!$('shortcutHelp').open) $('shortcutHelp').showModal();
  }
  $('helpButton').onclick = showShortcutHelp;
  // a double click puts a fader back where it started
  document.addEventListener('dblclick', e => {
    if (!e.target.matches('input[type="range"]')) return;
    const input = e.target, defaults = { sens: 1, lookLight: 1, lookBloom: 1, lookHaze: 1, lookHall: 1, beamWidth: 1, cameraSpeed: 1 };
    const value = defaults[input.id] ?? (input.id.startsWith('level-') ? 1 : input.id.startsWith('coilSpeed-') ? 1 : null);
    if (value === null) return; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let idle = 0;   // the cursor hides when the mouse rests
  addEventListener('pointermove', () => { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('idle'), 3000); });
  return { selectMenuPage, setSettingsOpen, settingsOpen, setConsoleVisible, consoleVisible: () => !$('console').classList.contains('hidden'), fullscreen, showShortcutHelp };
}

// The start screen covers the venue while it builds. The click that leaves it may connect the sound, which a browser
// only allows after a click; a reload in the same tab goes straight back to the show.
export function mountStart({ wake, connect }) {
  function start(withSound) {
    if ($('startShow').disabled) return;
    document.documentElement.classList.add('started');
    try { sessionStorage.setItem('sv.started', '1'); } catch {}
    wake();
    if (withSound) connect();
  }
  $('startShow').onclick = () => start(true);
  $('startDemo').onclick = () => start(false);
  // busy: the venue is (re)building, so there is nothing to start yet
  return {
    update(busy) {
      if (started() || $('startShow').disabled === busy) return;
      $('startShow').disabled = $('startDemo').disabled = busy; $('startShow').textContent = busy ? 'Building the venue…' : 'Start the show';
      if (!busy) $('startShow').focus();
    },
  };
}
