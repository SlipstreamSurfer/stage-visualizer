// The page: puts the layers together. Sound goes into Signals, the Director turns signals into channels, the World
// (a venue built from its description, with fixtures from the library) carries them out, and a camera looks at it.
// Drawn with WebGPU; where a browser does not have it, the same scene is drawn with WebGL.
import * as THREE from 'three/webgpu';
import { pass, uniform, uv, vec3, dot, fract, sin, max, convertToTexture } from 'three/tsl';
import { bloom as bloomOf } from 'three/addons/tsl/display/BloomNode.js';
import { VENUES, KINDS } from './venues/index.js';
import { Signals, demo } from './signals.js';
import { Director, MOODS, FAMILIES } from './director.js';
import { SHOW_THEMES } from './show-themes.js';
import { CHOREOGRAPHIES } from './light-choreography.js';
import { buildWorld } from './world.js';
import { buildParticles } from './particles.js';
import { shots, CameraDirector } from './cameras.js';
import { HEAD_LOOKS, TRUSS_LOOKS } from './hangar-looks.js';
import { Audio } from './audio.js';
import { mountPlayback } from './playback.js';
import { QUALITY, AutoQuality } from './quality.js';
import { SteadyResolution } from './steady.js';
import { djEye } from './dj-eye.js';
import { disposeScene, warmScene } from './resources.js';
import { DEFAULT_OFF, LIGHT_ROLES, PALETTES, RING_NAMES, COIL_MODES, parseStored, normalizeControls, normalizeLook, normalizePresets } from './show-controls.js';
import { $, keep, kept, started, fill, groups, sliderValue, segmented, syncSegments, mountControls, mountStart } from './ui.js';
import { mountSound } from './sound-ui.js';
import { mountEffects } from './effects-ui.js';
import { mountPresets } from './presets-ui.js';

// ----- the picture -----
const params = new URLSearchParams(location.search);
let WEBGL = params.has('webgl') || !navigator.gpu;   // ?webgl asks for the WebGL way of drawing
const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance', forceWebGL: WEBGL });
// quality: how much the computer is asked to draw
let qualityChoice = params.get('quality') || kept('quality', 'auto');
if (qualityChoice !== 'auto' && !(qualityChoice in QUALITY)) qualityChoice = 'auto';
let qualityKey = qualityChoice === 'auto' ? 'normal' : qualityChoice;
let quality = { ...QUALITY[qualityKey], details: params.has('details') };
const autoQuality = new AutoQuality(), steady = new SteadyResolution();   // steady: fewer pixels when frames take too long (steady.js)
let steadyOn = kept('steady', 'true') !== 'false';
const pixelRatio = () => Math.min(window.devicePixelRatio, quality.ratio) * (steadyOn ? steady.scale : 1);
renderer.setPixelRatio(pixelRatio());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);
await renderer.init();
WEBGL = !!renderer.backend.isWebGLBackend;
let scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);   // far enough to see the sky
// the scene, a glow round what is bright, and the finish of a camera: colour that splits slightly towards the edge
// of the lens, darker corners and a little grain
const post = new THREE.RenderPipeline(renderer), scenePass = pass(scene, camera), image = scenePass.getTextureNode(), grainAt = uniform(0);
let glow, combined, configuredBloom;
function configurePost() {
  if (configuredBloom === quality.bloom) return;
  combined?.renderTarget?.dispose(); combined?.dispose(); glow?.dispose();
  glow = quality.bloom ? bloomOf(image, 0.8, 0.7, 0.6) : null;
  combined = glow ? convertToTexture(image.add(glow)) : null;
  const lit = combined || image, off = uv().sub(0.5), r2 = dot(off, off);
  const split = vec3(lit.sample(uv().sub(off.mul(r2).mul(0.004))).r, lit.sample(uv()).g, lit.sample(uv().add(off.mul(r2).mul(0.004))).b);
  const shaded = max(split, vec3(0)).mul(r2.mul(-0.9).add(1));
  post.outputNode = shaded.add(fract(sin(dot(uv().mul(grainAt.add(1)), vec3(12.9898, 78.233, 0).xy)).mul(43758.5453)).sub(0.5).mul(0.03).mul(shaded.add(0.4)));
  post.needsUpdate = true;
  configuredBloom = quality.bloom;
}
configurePost();
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

// ----- the venue, and the show in it -----
let venueKey = params.get('venue') || kept('venue', 'hangar');
if (!(venueKey in VENUES)) venueKey = 'hangar';
let world = buildWorld(VENUES[venueKey], scene, quality);
// A locked mood survives venue changes and reloads; otherwise a venue brings a mood it suits.
let moodLocked = kept('moodLock', 'false') === 'true';
const wanted = params.get('mood') || kept('mood', ''), moodKey = wanted in MOODS && (moodLocked || params.has('mood') || world.layout.genres.includes(wanted)) ? wanted : world.layout.mood in MOODS ? world.layout.mood : 'techno';
const signals = new Signals(event => show.heard.push(event));
let director = new Director(world.groups, moodKey, { venue: venueKey });
// Smoke as particles that the card moves and lights: only with WebGPU, and off unless asked for, because it is heavy.
let particleCount = WEBGL ? 0 : +(params.get('n') || kept('particles', 0));
const makeParticles = (world, scene) => particleCount ? buildParticles({ renderer, add: o => (scene.add(o), o), count: particleCount, room: world.layout.plan, stage: world.layout.stage, lights: world.lights, solids: [[world.layout.focus[0], world.layout.stage.height + 1.3, world.layout.focus[2] - 0.5, 0.9], ...(world.layout.shell.pillars || []).flatMap(([x, z]) => [[x, 2.6, z, 0.55], [x, 1.2, z, 0.55]])] }) : null;
let particles = makeParticles(world, scene);
await particles?.ready;
await warmScene(renderer, scene, camera);   // behind the start screen, before the first frame: nothing stalls later
let cams = new CameraDirector(shots(world.layout, world.shots));
// what is off unless the viewer switches it on: with everything at once the show is too much
let controls = normalizeControls(parseStored(kept('controls', '{}')));
const look = { ...normalizeLook({ light: +kept('light', 1), bloom: +kept('bloom', 1), haze: +kept('haze', 1), hall: +kept('hall', 1), off: params.has('all') ? Object.fromEntries(Object.keys(DEFAULT_OFF).map(role => [role, false])) : parseStored(kept('off', JSON.stringify(DEFAULT_OFF))) }), controls };
let cameraFrozen = false, cameraTime = 0, cameraAge = 0, cameraIndex = -1;
const audio = new Audio(() => { signals.reset(); director.reset(clock.elapsedTime); });
const clock = new THREE.Clock();
let readDemo = demo(signals, director.mood.demoBpm, director.mood.flow), statusAt = 0, exposure = 1, frames = 0;
const SKIP = +(params.get('skip') || 0);   // ?skip=24: the demo track starts that many seconds in, for a picture of its peak
// for looking in from the console; view = [x, y, z, lookAtX, lookAtY, lookAtZ] puts the camera anywhere
let changing = false, changeMessage = '';
const show = window.__show = { signals, director, world, cams, look, audio, renderer, camera, post, quality: qualityKey, changing: false, view: null, heard: [], webgl: WEBGL, fps: 0 };   // heard: what the listener found in live sound, [{ t, what }] with t on the sound's clock
const effects = mountEffects({ show: () => ({ director, world, look }), now: () => clock.elapsedTime });
const sound = mountSound(audio);
const ui = mountControls({ release: () => effects.release() });
const start = mountStart({ wake: sound.wake, connect: () => $('playFile').click() });
const playback = mountPlayback({ audio, root: $('filePlayback'), notes: $('trackNotes'), snapshot: () => ({ venue: venueKey, mood: $('mood').value, sensitivity: +$('sens').value, section: signals.m.section, phase: signals.m.phase, bpm: signals.m.bpm, build: signals.m.build, show_status: director.status, segment_start_seconds: audio.segmentStart, listener_seconds: signals.now, sample_rate: audio.ctx?.sampleRate, audio_worklet: audio.tapped }) });

// One show at a time. A second tab or window with the show draws on the same card and halves the pace of both, so the
// newest one plays and the others wait, like a hidden tab, until they are clicked.
let elsewhere = false;
const others = 'BroadcastChannel' in window ? new BroadcastChannel('stage-visualizer') : null;
const playHere = () => { elsewhere = false; $('elsewhere').hidden = true; others?.postMessage('playing'); };
if (others) others.onmessage = e => { if (e.data === 'playing') { elsewhere = true; $('elsewhere').hidden = false; effects.release(); } };
$('elsewhere').onclick = playHere;

function frame() {
  requestAnimationFrame(frame);
  if (elsewhere) return;
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime;
  signals.decay = director.mood.decay;
  if (audio.live) {   // every step of sound that has come in since the last frame, then let the pulses fall away
    const sens = +$('sens').value;
    signals.begin();
    const missed = audio.pump((bands, rms) => signals.hear(bands, rms, sens));
    if (missed) signals.skip(missed);
    signals.flow(dt);
  } else signals.update(readDemo(t + SKIP), t, dt, { live: false });
  director.update(signals, t, dt, look);
  logShow.dt = raw; logShow(t);
  world.env.uPointScale.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360); world.env.cam.copy(camera.position);
  world.update(dt, t, director, signals, look);
  particles?.update(t, director.room.color, director.manual.blackout ? 0 : director.room.level * look.light, world.env.haze * look.haze);

  if (!cameraFrozen) {
    cameraTime += dt * controls.cameraSpeed;
    const shot = cams.update(signals, t, director.mood.camHold, controls.cameraFollowsLight ? director.lightCue : null);
    if (cameraIndex !== cams.index) { cameraAge = 0; cameraIndex = cams.index; }
    else cameraAge += dt * controls.cameraSpeed;
    const k = Math.min(40, cameraAge / director.mood.camHold), p = shot.pos(cameraTime, k);
    camera.position.set(...p); camera.lookAt(...shot.look);
    if (show.view) { camera.position.set(...show.view.slice(0, 3)); camera.lookAt(...show.view.slice(3, 6)); }
    camera.rotateX(Math.sin(cameraTime * 1.7) * 0.002); camera.rotateZ(Math.sin(cameraTime * 0.5) * 0.004);
    camera.fov = shot.fov - signals.drop * 3 - signals.m.build * 4; camera.updateProjectionMatrix();
  }
  djEye.inside = cams.list[cams.index]?.name === 'DJ view';
  $('fade').style.opacity = cameraFrozen ? 0 : 1 - Math.max(0, Math.min(1, cams.fade));
  if (glow) glow.strength.value = (0.7 + signals.kick * 0.35 + signals.accent * 0.08) * look.bloom;
  // the camera's exposure follows the light as an eye or a camera does: it closes fast when a strobe hits and opens
  // slowly in the dark, so a blackout is never just a black screen and a flash still hurts
  const bright = director.manual.blackout ? 0 : director.room.level, wanted = Math.max(0.5, Math.min(director.mood.flow ? 1.1 : 1.8, 2.3 / (1 + bright * 0.11)));   // a concert is lit evenly: there the camera does not open up   // a dim mood is not a dim picture: in a dark room the camera opens up
  exposure += (wanted - exposure) * (1 - Math.exp(-dt / (wanted < exposure ? 0.12 : 1.8)));
  renderer.toneMappingExposure = exposure;
  grainAt.value = t % 1;
  post.render();
  frames++;

  $('mBass').style.width = signals.bass * 100 + '%'; $('mMid').style.width = signals.mid * 100 + '%'; $('mHigh').style.width = signals.treble * 100 + '%';
  if (t - statusAt > 0.5) {
    playback.update();
    show.fps = frames / (t - statusAt); frames = 0; statusAt = t;
    $('fps').textContent = `${Math.round(show.fps)} frames a second${WEBGL ? ' · WebGL' : ''}`;
    $('qualityNote').textContent = (qualityChoice === 'auto' ? `Automatic · ${QUALITY[qualityKey].name}` : QUALITY[qualityKey].name) + (steadyOn && steady.scale < 1 ? ` · ${Math.round(steady.scale * 100)}% resolution to keep the pace` : '');
    const m = signals.m;
    const signal = audio.signal();
    $('inputLevel').hidden = !audio.live;
    $('inputLevel').value = signal.level;
    const state = $('status');
    state.dataset.audioState = signal.state;
    const audioNote = audio.source === audio.playerNode && audio.player?.paused && !audio.player.ended
      ? 'Paused' : { receiving: 'Audio detected', silent: 'No audio detected', lost: 'Input disconnected', suspended: 'Click to resume audio' }[signal.state];
    const bpm = Math.round(signals.stableBpm || m.bpm) || '--';
    state.textContent = audio.message || changeMessage || `${audio.live ? 'Live: ' + audio.label + (audioNote ? ' · ' + audioNote : '') : 'Demo mode'} · ${audio.live && m.activity < 0.05 ? 'waiting for music' : director.status}`;
    state.title = state.textContent; $('bpm').value = bpm;
    $('miniStatus').textContent = state.textContent + ` · ${bpm} BPM` + (director.manual.blackout ? ' · BLACKOUT' : '') + (cameraFrozen ? ' · Camera paused' : '');
    sound.update(signal);
    if (!changing) $('loading')?.remove(); show.ready ||= Math.round(performance.now());   // how long the venue took to build, in milliseconds
    start.update(changing);
    syncSegments();
  }
  // first fewer pixels, a step at a time; a lighter quality (a rebuild) only when even the fewest are too many
  if (steady.sample(raw, { visible: !document.hidden, ready: !changing && !!show.ready, enabled: steadyOn }) !== null) { renderer.setPixelRatio(pixelRatio()); resize(); }
  show.resolution = steadyOn ? steady.scale : 1;
  const lower = autoQuality.sample(raw, { visible: !document.hidden, ready: !changing && !!show.ready, automatic: qualityChoice === 'auto' && (!steadyOn || steady.atMin), quality: qualityKey });
  if (lower) changeQuality(lower).catch(changeFailed);
}

// ----- the show's own controls -----
for (const id of ['showTheme', 'lookPace', 'lookPreset']) segmented($(id));
segmented($('audioSource'), $('startSource'));
groups($('venue'), KINDS.map(kind => [kind, Object.entries(VENUES).filter(([, v]) => (v.kind || 'Halls') === kind).map(([k, v]) => [k, v.name])]), venueKey in VENUES ? venueKey : 'hangar');
function fillVenuePanel(moodKey, cameraValue = 'auto') {
  const suits = world.layout.genres.filter(k => k in MOODS);
  groups($('mood'), [['Made for this venue', suits.map(k => [k, MOODS[k].name])], ...FAMILIES.map(f => [f, Object.entries(MOODS).filter(([k, v]) => v.family === f && !suits.includes(k)).map(([k, v]) => [k, v.name])])], moodKey);
  fill($('cam'), [['auto', 'Switch automatically'], ...cams.list.map((s, i) => [i, `${i + 1} · ${s.name}`])], cameraValue);
  setCam($('cam').value || 'auto');
  fillSwitches(); refreshControlPanel();
}
const setCam = value => {
  if (value !== 'auto' && (!Number.isInteger(+value) || +value < 0 || +value >= cams.list.length)) value = 'auto';
  setCameraFrozen(false); cameraAge = 0; cameraIndex = -1;
  $('cam').value = value; keep('cam', value); cams.auto = value === 'auto';
  if (!cams.auto) cams.cut(+value, clock.elapsedTime);
};
$('venue').onchange = e => replaceVenue(e.target.value).catch(changeFailed);
$('mood').onchange = e => {
  keep('mood', e.target.value); director.setMood(e.target.value); readDemo = demo(signals, director.mood.demoBpm, director.mood.flow);
  const url = new URL(location.href);
  if (url.searchParams.has('mood')) { url.searchParams.set('mood', e.target.value); history.replaceState(null, '', url); }
};
$('moodLock').checked = moodLocked;
$('moodLock').onchange = e => { moodLocked = e.target.checked; keep('moodLock', String(moodLocked)); if (moodLocked) keep('mood', $('mood').value); };
$('cam').onchange = e => setCam(e.target.value);
for (const [key, look] of Object.entries(HEAD_LOOKS)) $('headLook').add(new Option(look.name, key));
for (const formation of TRUSS_LOOKS) $('trussLook').add(new Option(formation.name, formation.name));
for (const id of ['headLook', 'trussLook', 'lookPace']) $(id).onchange = () => { controls[id] = $(id).value; persistControls(); };
function refreshTheme() {
  for (const id of ['headLook', 'trussLook', 'lookPace']) { $(id).value = controls[id]; $(id).disabled = venueKey !== 'hangar'; }
  $('showTheme').value = controls.showTheme;
  $('lightChoreography').value = controls.lightChoreography;
  $('cameraFollowsLight').checked = controls.cameraFollowsLight;
  $('choreographyHint').textContent = CHOREOGRAPHIES[controls.lightChoreography].description;
  $('showTheme').disabled = venueKey !== 'hangar';
  $('themeHint').textContent = venueKey !== 'hangar' ? 'Show themes are available in Hangar.'
    : SHOW_THEMES[controls.showTheme]?.description || 'The current mood shapes the show.';
  syncSegments();
}
$('showTheme').onchange = () => {
  controls.showTheme = $('showTheme').value;
  if (controls.showTheme !== 'auto') { look.off.wall = false; keep('off', JSON.stringify(look.off)); fillSwitches(); effects.refresh(); }
  persistControls(); refreshTheme();
};
$('lightChoreography').onchange = () => { controls.lightChoreography = $('lightChoreography').value; persistControls(); refreshTheme(); };
$('cameraFollowsLight').onchange = () => { controls.cameraFollowsLight = $('cameraFollowsLight').checked; persistControls(); };
const LOOK_SLIDERS = [['lookLight', 'light'], ['lookBloom', 'bloom'], ['lookHaze', 'haze'], ['lookHall', 'hall']];
const LOOK_PRESETS = { standard: { light: 1, bloom: 1, haze: 1, hall: 1 }, calm: { light: 0.8, bloom: 0.6, haze: 0.65, hall: 1.15 }, cinematic: { light: 0.9, bloom: 1.15, haze: 1.3, hall: 0.65 }, energetic: { light: 1.2, bloom: 1.3, haze: 1.15, hall: 0.85 } };
function refreshLookPreset() {
  $('lookPreset').value = Object.keys(LOOK_PRESETS).find(k => LOOK_SLIDERS.every(([, key]) => Math.abs(LOOK_PRESETS[k][key] - look[key]) < 0.001)) || 'custom';
  syncSegments();
}
function applyLook(values) {
  for (const [id, key] of LOOK_SLIDERS) { look[key] = values[key]; $(id).value = values[key]; keep(key, values[key]); sliderValue(id); }
  refreshLookPreset();
}
for (const [id, key] of LOOK_SLIDERS) {
  $(id).value = look[key];
  sliderValue(id);
  $(id).oninput = e => { look[key] = +e.target.value; keep(key, e.target.value); sliderValue(id); refreshLookPreset(); };
}
refreshLookPreset();
$('lookPreset').onchange = e => { if (LOOK_PRESETS[e.target.value]) applyLook(LOOK_PRESETS[e.target.value]); };
$('sens').value = kept('sens', 1); sliderValue('sens');
$('sens').oninput = () => { keep('sens', $('sens').value); sliderValue('sens'); };
$('resetSliders').onclick = () => { applyLook(LOOK_PRESETS.standard); $('sens').value = 1; keep('sens', 1); sliderValue('sens'); };
fill($('quality'), [['auto', 'Automatic'], ...Object.entries(QUALITY).map(([k, v]) => [k, v.name])], qualityChoice);
segmented($('quality'), $('startQuality'));
$('quality').onchange = e => {
  qualityChoice = e.target.value; keep('quality', qualityChoice); autoQuality.reset();
  changeQuality(qualityChoice === 'auto' ? 'normal' : qualityChoice).catch(changeFailed);
};
$('steadyPicture').checked = steadyOn;
$('steadyPicture').onchange = e => { steadyOn = e.target.checked; keep('steady', String(steadyOn)); steady.reset(); renderer.setPixelRatio(pixelRatio()); resize(); };
$('particles').value = String(particleCount); $('particles').disabled = WEBGL;
$('particles').onchange = e => {
  particleCount = +e.target.value; keep('particles', particleCount);
  replaceVenue($('venue').value, { force: true }).catch(changeFailed);
};
// a switch for every role this venue has
const ROLE_NAME = { overhead: 'Hall heads', stage: 'Stage heads', wash: 'Washes', bars: 'LED bars', coil: 'LED coils', strobe: 'Strobes', blinder: 'Blinders', laser: 'Lasers', wall: 'LED walls', screen: 'Screen', dome: 'Dome', kinetic: 'Kinetic', triangles: 'Triangles', ball: 'Mirror ball', arch: 'LED arches', roof: 'LED roof', rings: 'LED rings', truss: 'Trusses', glow: 'Building', floor: 'Lit floor', festoon: 'Festoons', house: 'House lights', pool: 'Pool', co2: 'CO2', flame: 'Flames', spark: 'Sparks', firework: 'Fireworks', confetti: 'Confetti' };
// lights first, then the effects on a row of their own
const FIXTURE_ROLES = [['overhead', 'stage', 'wash', 'bars', 'arch', 'wall', 'truss', 'coil', 'rings', 'roof', 'triangles', 'kinetic', 'screen', 'dome', 'floor', 'glow', 'house', 'festoon', 'pool', 'ball'], ['strobe', 'blinder', 'laser', 'co2', 'flame', 'spark', 'firework', 'confetti']];
function fillSwitches() {
  $('switches').replaceChildren(); $('fixtureLevels').replaceChildren();
  for (const roles of FIXTURE_ROLES) for (const [i, role] of roles.filter(role => world.groups[role]?.length).entries()) {
    const label = document.createElement('label'), input = document.createElement('input');
    Object.assign(input, { id: 'fixture-' + role, type: 'checkbox', checked: !look.off[role] });
    input.onchange = () => { look.off[role] = !input.checked; keep('off', JSON.stringify(look.off)); effects.refresh(); };
    label.className = 'chip'; label.style.gridColumnStart = i === 0 ? 1 : ''; label.append(input, ROLE_NAME[role]);
    $('switches').append(label);
    if (!LIGHT_ROLES.includes(role)) continue;
    const row = document.createElement('div'), caption = document.createElement('label'), output = document.createElement('output'), fader = document.createElement('input');
    row.className = 'level'; caption.htmlFor = 'level-' + role; caption.textContent = ROLE_NAME[role];
    Object.assign(fader, { id: 'level-' + role, type: 'range', min: '0', max: '1.5', step: '0.05', value: controls.levels[role] });
    output.id = fader.id + 'Value'; output.setAttribute('for', fader.id); output.value = (+fader.value).toFixed(2) + '×';
    fader.oninput = () => { controls.levels[role] = +fader.value; output.value = (+fader.value).toFixed(2) + '×'; persistControls(); };
    row.append(caption, fader, output); $('fixtureLevels').append(row);
  }
  $('switches').closest('.deck').hidden = !$('switches').childElementCount;
  effects.refresh();
}
function persistControls() { keep('controls', JSON.stringify(controls)); }
const ICON = { pause: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor" stroke="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>', play: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor" stroke="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5v14l12-7z"/></svg>' };
function setCameraFrozen(frozen) {
  cameraFrozen = frozen;
  if (!frozen) { cams.pending = null; cams.lastCut = clock.elapsedTime; cams.fadeIn = -10; cams.fade = 1; }
  $('freezeCamera').setAttribute('aria-pressed', String(frozen));
  $('freezeCamera').innerHTML = frozen ? ICON.play : ICON.pause; $('freezeCamera').title = frozen ? 'Resume camera (P)' : 'Freeze this view (P)'; $('freezeCamera').setAttribute('aria-label', frozen ? 'Resume camera' : 'Freeze this view');
}
$('freezeCamera').onclick = () => setCameraFrozen(!cameraFrozen);
fill($('palette'), [['auto', 'Follow the show'], ...Object.entries(PALETTES).map(([key, p]) => [key, p.name])], controls.palette);
fill($('ringLook'), [['auto', 'Automatic'], ...RING_NAMES.map(name => [name, name])], controls.ringLook);
for (const id of ['palette', 'ringLook']) $(id).onchange = () => { controls[id] = $(id).value; persistControls(); };
for (const id of ['beamWidth', 'cameraSpeed']) {
  $(id).oninput = () => { controls[id] = +$(id).value; sliderValue(id); persistControls(); };
}
function refreshControlPanel() {
  refreshTheme();
  for (const id of ['palette', 'ringLook', 'beamWidth', 'cameraSpeed']) $(id).value = controls[id];
  sliderValue('beamWidth'); sliderValue('cameraSpeed');
  const coils = world.groups.coil || [], hasRings = (world.groups.truss || []).some(f => f.props.kind === 'ring');
  $('ringControls').hidden = !hasRings && !coils.length;
  $('ringLook').disabled = !hasRings;
  $('coilControls').replaceChildren();
  for (const bank of ['inner', 'outer']) {
    if (!coils.some(f => f.props.bank === bank)) continue;
    const card = document.createElement('div'); card.className = 'coil-card';
    const heading = document.createElement('h2'); heading.textContent = bank === 'inner' ? 'Inner LED ring' : 'Outer LED ring'; card.append(heading);
    for (const [key, title, entries] of [
      ['mode', 'Pattern', [['auto', 'Automatic'], ...COIL_MODES.map((name, i) => [String(i), name])]],
      ['direction', 'Direction', [['auto', 'Original direction'], ['forward', 'Forward'], ['reverse', 'Reverse']]],
    ]) {
      const label = document.createElement('label'), select = document.createElement('select'); select.id = `coil-${bank}-${key}`; label.htmlFor = select.id; label.textContent = title;
      fill(select, entries, controls.coils[bank][key]);
      select.onchange = () => { controls.coils[bank][key] = select.value; persistControls(); }; card.append(label, select);
    }
    const label = document.createElement('label'), speed = document.createElement('input'), output = document.createElement('output');
    Object.assign(speed, { id: `coil-${bank}-speed`, type: 'range', min: '0', max: '3', step: '0.05', value: controls.coils[bank].speed });
    output.id = speed.id + 'Value'; output.setAttribute('for', speed.id); label.htmlFor = speed.id; label.append('Speed ', output);
    output.value = (+speed.value).toFixed(2) + '×'; speed.oninput = () => { controls.coils[bank].speed = +speed.value; sliderValue(speed.id); persistControls(); };
    card.append(label, speed); $('coilControls').append(card);
  }
}
fillVenuePanel(moodKey, params.get('cam') || kept('cam', 'auto'));

// Build and compile the next venue alongside the current one. Sound, its listener, the
// clock and viewer media survive; a failed build leaves the current show running.
let venueRequest = 0, compileQueue = Promise.resolve();
const changeFailed = e => { changeMessage = 'Could not change the show: ' + e.message; $('status').textContent = changeMessage; $('venue').value = venueKey; };
async function replaceVenue(key, { force = false, nextQuality = qualityKey } = {}) {
  if (!(key in VENUES)) return;
  if (key === venueKey && !force) { ++venueRequest; changing = show.changing = false; $('loading')?.remove(); return; }
  const request = ++venueRequest, nextScene = new THREE.Scene();
  changeMessage = '';
  changing = show.changing = true;
  let loading = $('loading');
  if (!loading) { loading = document.createElement('div'); loading.id = 'loading'; document.body.append(loading); }
  loading.textContent = 'Changing venue…';
  let nextWorld, nextParticles;
  try {
    const nextSettings = { ...QUALITY[nextQuality], details: quality.details };
    nextWorld = buildWorld(VENUES[key], nextScene, nextSettings);
    const currentMood = $('mood').value;
    const chooseMood = selected => moodLocked || key === venueKey || nextWorld.layout.genres.includes(selected) ? selected : nextWorld.layout.mood || 'techno';
    let nextMood = chooseMood(currentMood);
    const nextDirector = new Director(nextWorld.groups, nextMood, { venue: key });
    nextDirector.manual = { ...director.manual }; nextDirector.reset(clock.elapsedTime);
    nextDirector.update(signals, clock.elapsedTime, 0, look);
    nextWorld.env.media = world.env.media;
    nextWorld.update(0, clock.elapsedTime, nextDirector, signals, look);
    nextParticles = makeParticles(nextWorld, nextScene);
    await nextParticles?.ready;
    compileQueue = compileQueue.catch(() => {}).then(() => request === venueRequest ? warmScene(renderer, nextScene, camera) : undefined);
    await compileQueue;
    if (request !== venueRequest) { nextParticles?.dispose(); disposeScene(nextScene, [world.env.media]); return; }
    // A mood or manual effect may have changed while shaders compiled.
    const latestMood = $('mood').value;
    nextMood = chooseMood(latestMood);
    nextDirector.setMood(nextMood); nextDirector.manual = { ...director.manual };
    const oldScene = scene, oldParticles = particles, cameraValue = $('cam').value;
    nextWorld.env.media = world.env.media;
    scene = nextScene; world = nextWorld; director = nextDirector; particles = nextParticles;
    cams = new CameraDirector(shots(world.layout, world.shots), clock.elapsedTime);
    scenePass.scene = scene;
    if (nextQuality !== qualityKey) { steady.scale = 1; steady.reset(); }   // another quality: find the resolution again
    venueKey = key; qualityKey = nextQuality; quality = nextSettings;
    renderer.setPixelRatio(pixelRatio()); resize(); configurePost();
    readDemo = demo(signals, director.mood.demoBpm, director.mood.flow);
    Object.assign(show, { world, director, cams, view: null, quality: qualityKey });
    $('venue').value = key; keep('venue', key); keep('mood', nextMood);
    fillVenuePanel(nextMood, cameraValue);
    const url = new URL(location.href); url.searchParams.set('venue', key);
    url.searchParams.delete('mood'); url.searchParams.delete('cam');
    if (url.searchParams.has('quality')) url.searchParams.set('quality', qualityChoice);
    if (url.searchParams.has('n')) url.searchParams.set('n', particleCount);
    history.replaceState(null, '', url);
    oldParticles?.dispose(); disposeScene(oldScene, [world.env.media]);
  } catch (e) {
    nextParticles?.dispose(); disposeScene(nextScene, [world.env.media]); throw e;
  } finally {
    if (request === venueRequest) { changing = show.changing = false; $('loading')?.remove(); autoQuality.reset(); }
  }
}
async function changeQuality(key) { await replaceVenue($('venue').value, { force: true, nextQuality: key }); }

// Presets (presets-ui.js) keep show controls, never live audio connections or graphics quality.
const presets = mountPresets({
  busy: () => changing,
  usable: p => Object.hasOwn(VENUES, p.venue) && Object.hasOwn(MOODS, p.mood),
  capture: (id, name) => normalizePresets([{ id, name, venue: venueKey, mood: $('mood').value, moodLocked, cam: $('cam').value, sens: +$('sens').value, look, controls,
    pose: cameraFrozen ? { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov } : null }])[0],
  apply: async preset => {
    await replaceVenue(preset.venue);
    if (venueKey !== preset.venue || changing) throw new Error('Venue changed while loading. Try again.');
    effects.release(); director.manual.blackout = false;
    controls = normalizeControls(preset.controls); look.controls = controls; persistControls();
    look.off = { ...preset.look.off }; keep('off', JSON.stringify(look.off)); applyLook(preset.look);
    moodLocked = preset.moodLocked; $('moodLock').checked = moodLocked; keep('moodLock', String(moodLocked));
    $('mood').value = preset.mood; $('mood').onchange({ target: $('mood') });
    $('sens').value = preset.sens; $('sens').oninput();
    setCam(preset.cam); fillSwitches(); refreshControlPanel();
    if (preset.pose) { camera.position.fromArray(preset.pose.position); camera.quaternion.fromArray(preset.pose.quaternion).normalize(); camera.fov = preset.pose.fov; camera.updateProjectionMatrix(); setCameraFrozen(true); }
  },
});
$('resetShow').onclick = () => {
  effects.release(); director.manual.blackout = false;
  controls = normalizeControls({}); look.controls = controls; persistControls();
  look.off = { ...DEFAULT_OFF }; keep('off', JSON.stringify(look.off)); applyLook(LOOK_PRESETS.standard);
  $('sens').value = 1; $('sens').oninput(); setCam('auto'); show.view = null;
  moodLocked = false; $('moodLock').checked = false; keep('moodLock', 'false');
  $('mood').value = world.layout.mood in MOODS ? world.layout.mood : 'techno'; $('mood').onchange({ target: $('mood') });
  director.resetRingLook(clock.elapsedTime);
  fillSwitches(); refreshControlPanel(); effects.refresh();
  presets.clear('Balanced starting point restored. Saved presets kept.');
};

// a picture or a video for the LED walls
$('wallPick').onclick = () => $('wallFile').click();
$('wallFile').onchange = e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) { const video = Object.assign(document.createElement('video'), { src: url, loop: true, muted: true, playsInline: true }); video.play(); world.env.media = new THREE.VideoTexture(video); }
  else world.env.media = new THREE.TextureLoader().load(url);
  world.env.media.colorSpace = THREE.SRGBColorSpace;
};
$('wallClear').onclick = () => { world.env.media = null; };
renderer.domElement.addEventListener('dblclick', ui.fullscreen);
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || $('shortcutHelp').open || !started()) return;
  const key = e.key.toLowerCase();
  if (key === 'escape' && ui.settingsOpen()) { ui.setSettingsOpen(false); $('openSettings').focus(); return; }
  if (key === 'h' && !e.repeat && !['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) { ui.setConsoleVisible(!ui.consoleVisible()); return; }
  if (!e.repeat && !['SELECT', 'INPUT', 'TEXTAREA', 'AUDIO', 'VIDEO'].includes(e.target.tagName) && !e.target.isContentEditable) {
    if (key === '?') { ui.showShortcutHelp(); return; }
    if (key === 's') { ui.setSettingsOpen(!ui.settingsOpen()); return; }
    if (key === 'p') { setCameraFrozen(!cameraFrozen); return; }
    if (key === 'n' && !changing) { director.next(clock.elapsedTime, signals.m.section); return; }
  }
  if (['SELECT', 'INPUT', 'BUTTON', 'SUMMARY', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
  if (['t', 'g', 'x'].includes(e.key.toLowerCase()) && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { playback.markMoment({ t: 'unrated', g: 'good', x: 'wrong' }[e.key.toLowerCase()]); return; }
  if (['AUDIO', 'VIDEO'].includes(e.target.tagName)) return;   // keep the player's native keyboard controls
  if (e.code === 'Space') { effects.setHeld('strobe', 'key', true); e.preventDefault(); }
  if (key === 'b') effects.setHeld('blinder', 'key', true);
  if (e.repeat) return;
  if (key === 'c') $('btnCo2').click();
  if (key === 'v') effects.pyro();
  if (key === 'k') $('btnConfetti').click();
  if (key === 'f') ui.fullscreen();
  if (key === 'm') { const m = $('mood'); m.selectedIndex = (m.selectedIndex + 1) % m.options.length; m.dispatchEvent(new Event('change')); }
  if (e.key >= '0' && e.key <= '9') { $('cam').value = e.key === '0' ? 'auto' : String(e.key - 1); $('cam').dispatchEvent(new Event('change')); }
});
addEventListener('keyup', e => { if (e.code === 'Space') effects.setHeld('strobe', 'key', false); if (e.key.toLowerCase() === 'b') effects.setHeld('blinder', 'key', false); });
// While working on the show: the page keeps a log of what the show decides with live sound (a line a second, and one
// for every break, drop, lift and change of part or program), so it can be held against the recording afterwards.
const logLines = [JSON.stringify({ w: Date.now(), what: 'page loaded' })];
let logAt = 0, lastStatus = '';
function logShow(t) {
  if (!audio.live) return;
  const m = signals.m, ev = signals.ev, w = Date.now(), note = what => { logLines.push(JSON.stringify({ w, what, bpm: m.bpm, section: m.section })); };
  if (ev.drop) note('drop'); if (ev.broke) note('break'); if (ev.lift) note('lift'); if (ev.silent && !logShow.silent) note('silence'); logShow.silent = ev.silent;
  if (ev.kick && signals.m.phase === 'groove' && logShow.phase === 'break' && !ev.drop) note('kick comes in'); logShow.phase = m.phase;
  if (director.status !== lastStatus) { lastStatus = director.status; note('show: ' + director.status); }
  if (t - logAt >= 1) {
    logAt = t;
    logLines.push(JSON.stringify({ w, bpm: m.bpm, phase: m.phase, section: m.section, build: +m.build.toFixed(2), energy: +signals.energy.toFixed(2), fps: Math.round(1 / Math.max(0.001, logShow.dt)), cam: cams.list[cams.index].name }));
    const lines = logLines.splice(0).join('\n') + '\n';
    if (location.hostname === '127.0.0.1' && !navigator.webdriver && !/Headless/.test(navigator.userAgent)) fetch('/__log', { method: 'POST', body: lines, keepalive: true }).catch(() => {});   // not from a test browser
  }
}
if (params.has('hide')) { $('console').classList.add('hidden'); $('miniStatus').hidden = true; }   // ?hide: no controls, for a picture
$('venueSetting').hidden = Object.keys(VENUES).length < 2;   // one venue: nothing to choose
// While working on the show: when a file changes, the page reloads itself (the local server says when).
if (!navigator.webdriver && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
  let seen = null;
  setInterval(async () => { try { const now = await (await fetch('/__changed')).text(); if (seen !== null && now !== seen) location.reload(); seen = now; } catch {} }, 1500);
}
playHere();
frame();
