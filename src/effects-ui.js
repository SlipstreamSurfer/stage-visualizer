// The live effects on the console: strobe and blinder while held (button or key), CO2, pyro and confetti once, and
// blackout until it is switched off. An effect whose fixtures are off or missing cannot fire.
import { $ } from './ui.js';

const EFFECTS = { btnStrobe: { name: 'Strobe', roles: ['strobe'], hold: 'strobe' }, btnBlinder: { name: 'Blinders', roles: ['blinder'], hold: 'blinder' }, btnCo2: { name: 'CO2', roles: ['co2'] }, btnPyro: { name: 'Pyro', roles: ['flame', 'spark', 'firework'] }, btnConfetti: { name: 'Confetti', roles: ['confetti'] } };

// show(): { director, world, look } as they are now, since a venue change replaces them; now(): the show's clock
export function mountEffects({ show, now }) {
  const held = { strobe: { pointer: false, key: false }, blinder: { pointer: false, key: false } };
  function refresh() {
    const { director, world, look } = show();
    for (const [id, effect] of Object.entries(EFFECTS)) {
      const present = effect.roles.filter(role => world.groups[role]?.length), enabled = present.some(role => !look.off[role]);
      const btn = $(id);
      if (effect.hold && !enabled) { held[effect.hold].pointer = held[effect.hold].key = false; director.manual[effect.hold] = false; }
      btn.disabled = !enabled;
      btn.dataset.state = !present.length ? 'missing' : !enabled ? 'off' : effect.hold && director.manual[effect.hold] ? 'held' : 'ready';
      btn.title = !present.length ? `This venue has no ${effect.name.toLowerCase()}` : !enabled ? 'Switch it on under Fixtures' : effect.hold ? 'Hold to activate; release to stop' : 'Fire once';
      if (effect.hold) btn.setAttribute('aria-pressed', String(director.manual[effect.hold]));
    }
    $('btnBlackout').dataset.state = director.manual.blackout ? 'on' : 'off';
    $('btnBlackout').setAttribute('aria-pressed', String(director.manual.blackout));
  }
  // source: 'pointer' or 'key'; a hold lasts while either still holds it
  function setHeld(key, source, on) {
    const btn = $(key === 'strobe' ? 'btnStrobe' : 'btnBlinder');
    held[key][source] = on && !btn.disabled;
    show().director.manual[key] = held[key].pointer || held[key].key;
    refresh();
  }
  function release(source) {
    const { director } = show();
    for (const key of Object.keys(held)) {
      if (source) held[key][source] = false;
      else held[key].pointer = held[key].key = false;
      director.manual[key] = held[key].pointer || held[key].key;
    }
    refresh();
  }
  for (const [id, effect] of Object.entries(EFFECTS)) if (effect.hold) {
    const btn = $(id);
    btn.onpointerdown = e => { if (e.button === 0) setHeld(effect.hold, 'pointer', true); };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = () => setHeld(effect.hold, 'pointer', false);
    btn.onkeydown = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); setHeld(effect.hold, 'key', true); } };
    btn.onkeyup = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); setHeld(effect.hold, 'key', false); } };
    btn.onblur = () => setHeld(effect.hold, 'key', false);
  }
  addEventListener('pointerup', () => release('pointer'));
  addEventListener('pointercancel', () => release('pointer'));
  addEventListener('blur', () => release());
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  const fire = (id, kinds) => { if (!$(id).disabled) for (const kind of kinds) show().director.fire(kind, now()); };
  const pyro = () => fire('btnPyro', ['flame', 'spark', 'firework']);
  $('btnCo2').onclick = () => fire('btnCo2', ['co2']);
  $('btnPyro').onclick = pyro;
  $('btnConfetti').onclick = () => fire('btnConfetti', ['confetti']);
  $('btnBlackout').onclick = () => { const { director } = show(); director.manual.blackout = !director.manual.blackout; refresh(); };
  return { refresh, setHeld, release, pyro };
}
