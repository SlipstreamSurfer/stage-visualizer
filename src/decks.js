// The decks: four players round a mixer on the table of whoever plays, as on a festival rider, drawn from a Mix
// (mix.js). They are not props. The player that plays shows the track running past its playhead as the show hears
// it, with its tempo, the time and the beat, and its jog wheel turns; the next track waits on the other player at
// its cue point; and the mixer's meters follow the music, channel by channel. When the music player says how long
// the track is, the player counts down what is left, and in its last thirty seconds the time, the bar of the whole
// track and the ring round the jog wheel flash red, as a CDJ warns that its track is ending.
//
// Everything that lights up is kept low: in a dark booth a controller glows, it does not shine.
//
// Seen from the DJ, who faces the hall (+z, so the DJ's left is +x): on a player the jog wheel is close by, play and
// cue to its left, the tempo fader to its right, a row of hot cue pads above it and the screen at the far end,
// tilted towards the DJ. On the mixer every channel has its knobs at the far end, a level meter beside them, a cue
// button and its fader close by; the master meters and the effects are on the right.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box } from './shapes.js';
import { Mix, COLS } from './mix.js';

const PLAYERS = [0.78, 0.42, -0.42, -0.78], CHANNELS = [0.105, 0.035, -0.035, -0.105];   // from the DJ's left to right
const JOG_Z = -0.085, SEGMENTS = 12;
const PADS = [[0.1, 0.9, 0.3], [0.1, 0.8, 0.9], [0.2, 0.4, 1], [0.6, 0.3, 1], [1, 0.3, 0.7], [1, 0.2, 0.15], [1, 0.55, 0.1], [1, 0.9, 0.2]];   // the colours of the hot cues
const GREEN = [0.1, 0.9, 0.2], ORANGE = [1, 0.5, 0.05], RED = [1, 0.1, 0.05], BLUE = [0.15, 0.4, 1], WHITE = [0.9, 0.92, 1];
const GLOW = 0.4, SCREEN = 0.42, WARN = 30;   // how bright the lamps and the screens are; the seconds before a track's end when its player warns
const ending = (mix, i, t) => { const s = mix.state(i), left = s === 'play' ? mix.remaining(t) : null; return left !== null && left < WARN; };
const flash = t => t * 2 % 1 < 0.5;
const two = n => String(Math.floor(n)).padStart(2, '0');
// a number that is the same every time for the same track and place: tracks that are not playing need a waveform too
const noise = (track, i) => { const v = Math.sin(track * 91.7 + i * 12.9898) * 43758.5453; return v - Math.floor(v); };

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { g: c.getContext('2d'), tex, w, h };
}

// What a player's screen shows. Playing: the music of the last two seconds to the left of the playhead, and to its
// right what is coming, which nobody knows of live sound: there the screen shows what was played two bars ago, as
// most of it will come again. Waiting: the next track at its cue point.
function drawScreen({ g, w, h }, mix, i, t) {
  const state = mix.state(i), live = state === 'play' || state === 'out', bpm = mix.bpm || 0, mid = h * 0.47, tall = h * 0.3, cx = w / 2;
  g.fillStyle = '#04060b'; g.fillRect(0, 0, w, h);
  if (state === 'idle') {   // the list of tracks on the stick, one of them picked
    for (let r = 0; r < 7; r++) { g.fillStyle = r === 2 ? '#1d4fb0' : '#10151f'; g.fillRect(6, 10 + r * 18, w - 12, 15); g.fillStyle = r === 2 ? '#e8eeff' : '#5a6578'; g.fillRect(12, 15 + r * 18, 60 + noise(i, r) * 110, 5); g.fillRect(w - 46, 15 + r * 18, 30, 5); }
    return;
  }
  const period = Math.round(8 * 60 / (bpm || 124) * COLS), track = mix.tracks + (live ? 0 : 1);
  const column = k => {   // k columns from the playhead: behind it (k < 0) what was heard, ahead of it what is expected
    if (!live) { if (k < 0) return [0, 0, 0]; const loud = 0.35 + 0.6 * noise(track, Math.floor(k / 60)); return [loud * Math.exp(-(k % 15) / 3), loud * (0.3 + 0.4 * noise(track, k)), loud * 0.5 * noise(track + 7, k)]; }   // nothing before the first beat
    return k < 0 ? mix.wave(-k - 1) : mix.wave(period - k - 1);
  };
  for (let x = 0; x < w; x += 2) {
    const [lo, md, hi] = column((x - cx) / 2);
    g.fillStyle = '#1f5cff'; g.fillRect(x, mid - lo * tall, 2, lo * tall * 2 + 1);
    g.fillStyle = '#ff9a1f'; g.fillRect(x, mid - md * tall * 0.62, 2, md * tall * 1.24);
    g.fillStyle = '#f2f4ff'; g.fillRect(x, mid - hi * tall * 0.36, 2, hi * tall * 0.72);
  }
  if (bpm) {   // the beats, as ticks under the waveform; the first of every bar longer and red
    const perBeat = 60 / bpm * COLS * 2, phase = live ? mix.phase : 0;
    for (let n = -6; n <= 6; n++) { const beat = Math.ceil(phase) + n, x = cx + (beat - phase) * perBeat, bar = ((beat % 4) + 4) % 4 === 0; g.fillStyle = bar ? '#ff3b30' : '#c8ccd8'; g.fillRect(Math.round(x), mid + tall + 4, 2, bar ? 9 : 5); }
  }
  g.fillStyle = live ? '#ffffff' : '#ff9a1f'; g.fillRect(cx - 1, mid - tall - 6, 2, tall * 2 + 20);   // the playhead
  // the player's number and the track, the time, the tempo, and the four beats of the bar
  g.fillStyle = '#1d4fb0'; g.fillRect(6, 5, 20, 18); g.fillStyle = '#ffffff'; g.font = 'bold 15px monospace'; g.textBaseline = 'top'; g.fillText(String(i + 1), 11, 6);
  const name = state === 'play' ? mix.title : state === 'out' ? mix.before : '';   // the track's own name, when the music player has told it
  g.fillStyle = name ? '#d8deea' : '#8a94a8'; g.font = '11px monospace'; g.fillText((name || `TRACK ${two(track)}`).slice(0, live ? 33 : 26), 32, 9);
  if (!live) { g.fillStyle = '#ff9a1f'; g.font = 'bold 12px monospace'; g.fillText('CUE', w - 34, 8); }
  // the time: what is left when the length is known, else what has played; and the whole track as a bar, played and to come
  const played = live ? mix.elapsed(t) : 0, left = state === 'play' ? mix.remaining(t) : null, warn = ending(mix, i, t);
  if (left !== null) {
    const done = Math.min(1, played / mix.length);
    g.fillStyle = '#1a2130'; g.fillRect(6, 0, w - 12, 3);
    g.fillStyle = warn ? (flash(t) ? '#ff3b30' : '#5a1410') : '#8a94a8'; g.fillRect(6, 0, (w - 12) * done, 3);
  }
  g.fillStyle = warn ? (flash(t) ? '#ff3b30' : '#6a1a14') : '#e8eeff'; g.font = 'bold 17px monospace';
  g.fillText(left !== null ? `-${two(left / 60)}:${two(left % 60)}` : `${two(played / 60)}:${two(played % 60)}`, 8, h - 23);
  g.textAlign = 'right'; g.fillText(bpm ? bpm.toFixed(1) : '---.-', w - 8, h - 23); g.textAlign = 'left';
  for (let b = 0; b < 4; b++) { g.fillStyle = live && bpm && ((Math.floor(mix.phase) % 4) + 4) % 4 === b ? '#3f8cff' : '#18202e'; g.fillRect(cx - 38 + b * 20, h - 19, 16, 9); }
}

// at: [x, y, z] of the middle of the gear, on the table's top; lit: the world's way of making a material the beams
// light. Returns the Mix it draws, and what to call every frame.
export function buildDecks({ own, lit, at }) {
  const mix = new Mix(), group = own(new THREE.Group()); group.position.set(...at);
  const dark = [], trim = [], metal = [], leds = [], spin = [], screens = [];
  const led = (x, y, z, w, d, colour) => { leds.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, 0.006, d)), colour }); };
  const knob = (x, z, r = 0.011) => trim.push(new THREE.CylinderGeometry(r, r * 1.12, 0.024, 8).translate(x, 0.112, z));
  const facing = (w, h, x, y, z) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2).rotateY(Math.PI).rotateX(-0.42).translate(x, y, z);   // a screen: up, readable from the DJ's side, tilted towards the DJ

  PLAYERS.forEach((x, i) => {
    const on = () => mix.state(i), playing = () => on() === 'play' || on() === 'out';
    dark.push(box(0.33, 0.09, 0.45, x, 0.045, 0), new THREE.BoxGeometry(0.31, 0.036, 0.17).rotateX(-0.42).translate(x, 0.106, 0.137),
      new THREE.CylinderGeometry(0.104, 0.108, 0.022, 28).translate(x, 0.1, JOG_Z), box(0.014, 0.004, 0.14, x - 0.138, 0.092, JOG_Z));
    metal.push(new THREE.CylinderGeometry(0.088, 0.088, 0.006, 28).translate(x, 0.114, JOG_Z));
    trim.push(box(0.03, 0.012, 0.016, x - 0.138, 0.098, JOG_Z + 0.02 - i * 0.012));   // the tempo fader, somewhere along its slot
    knob(x - 0.14, 0.14, 0.014);                                                      // the knob that browses
    led(x - 0.138, 0.094, JOG_Z, 0.006, 0.006, () => GREEN.map(v => v * 0.5));        // tempo at zero
    led(x + 0.125, 0.094, -0.195, 0.03, 0.03, t => GREEN.map(v => v * (playing() ? 1 : on() === 'cue' ? (t * 2 % 1 < 0.5 ? 0.9 : 0.1) : 0.12)));   // play: steady while it plays, blinking when it waits
    led(x + 0.125, 0.094, -0.15, 0.03, 0.03, () => ORANGE.map(v => v * (on() === 'cue' ? 1 : on() === 'idle' ? 0.1 : 0.3)));                        // cue
    for (let k = 0; k < 8; k++) led(x + 0.119 - k * 0.034, 0.093, 0.04, 0.027, 0.02, () => PADS[k].map(v => v * (playing() ? 0.8 : on() === 'cue' ? 0.45 : 0.08)));
    led(x + 0.14, 0.094, 0.2, 0.008, 0.008, t => RED.map(v => v * (playing() ? (t % 1 < 0.5 ? 0.9 : 0.25) : 0.25)));                               // the stick the track is on
    const display = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20).rotateX(-Math.PI / 2), null); display.position.set(x, 0.119, JOG_Z); spin.push(display);
    screens.push({ i, geo: facing(0.25, 0.14, x, 0.1245, 0.1295) });
  });

  // the mixer
  dark.push(box(0.4, 0.1, 0.45, 0, 0.05, 0));
  CHANNELS.forEach((x, i) => {
    for (const z of [0.19, 0.15, 0.11, 0.07]) knob(x - 0.008, z);   // trim, high, mid, low
    knob(x - 0.008, 0.02, 0.014);                                    // the filter
    dark.push(box(0.006, 0.003, 0.12, x - 0.008, 0.1015, -0.115));
    led(x - 0.008, 0.103, -0.03, 0.02, 0.014, () => ORANGE.map(v => v * (i === mix.next || i === mix.leaving ? 1 : 0.12)));   // cue: what is in the headphones
    for (let s = 0; s < SEGMENTS; s++) led(x + 0.02, 0.103, 0.065 + s * 0.011, 0.008, 0.008, () => meter(mix.levels[i], mix.peaks[i], s));
  });
  for (const [k, x] of [[0, -0.158], [1, -0.172]]) for (let s = 0; s < SEGMENTS; s++) led(x, 0.103, 0.065 + s * 0.011, 0.008, 0.008, () => meter(mix.master * (k ? 0.97 : 1), 0, s));   // the master, left and right
  for (const z of [0.0, -0.05]) knob(-0.165, z); for (const z of [0.17, 0.12, 0.02, -0.04]) knob(0.165, z, 0.009);   // effects on the right; microphone and headphones on the left
  led(-0.165, 0.103, -0.12, 0.026, 0.026, t => BLUE.map(v => v * (mix.mixing > 0.02 ? (Math.floor(mix.phase * 2) % 2 ? 0.2 : 1) : 0.15)));   // the effect: on while two tracks are in the mix
  dark.push(box(0.1, 0.003, 0.008, 0, 0.1015, -0.205));
  const meter = (level, peak, s) => { const lit = level * SEGMENTS > s + 0.5 || Math.abs(peak * SEGMENTS - s - 0.5) < 0.5, c = s >= SEGMENTS - 1 ? RED : s >= SEGMENTS - 4 ? ORANGE : GREEN; return c.map(v => v * (lit ? (c === GREEN ? 0.35 : 0.8) : 0.03)); };   // the green of a meter is its most lit part: kept lowest

  group.add(new THREE.Mesh(mergeGeometries(dark), lit(new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.5, metalness: 0.3 }), 1.4)));
  group.add(new THREE.Mesh(mergeGeometries(trim), lit(new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.45, metalness: 0.5 }), 1.4)));
  group.add(new THREE.Mesh(mergeGeometries(metal), lit(new THREE.MeshStandardMaterial({ color: 0x222429, roughness: 0.3, metalness: 0.7 }), 1.4)));   // the top of a jog wheel: dark and smooth
  // the faders move: four channels and the crossfader
  const cap = new THREE.BoxGeometry(0.022, 0.014, 0.012), capMat = lit(new THREE.MeshStandardMaterial({ color: 0x6e7178, roughness: 0.4, metalness: 0.4 }), 1.4);
  const faders = CHANNELS.map(x => { const f = new THREE.Mesh(cap, capMat); f.position.set(x - 0.008, 0.108, -0.165); group.add(f); return f; });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.024), capMat); cross.position.set(0, 0.108, -0.205); group.add(cross);

  // everything that lights up by itself: one small block each, coloured every frame
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: false }), leds.length), black = new THREE.Color(0);
  leds.forEach((l, k) => { lamps.setMatrixAt(k, l.m); lamps.setColorAt(k, black); });
  lamps.frustumCulled = false; group.add(lamps);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.106, 0.006, 5, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ fog: false }), 4);
  PLAYERS.forEach((x, i) => { rings.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.112, JOG_Z)); rings.setColorAt(i, black); });
  rings.frustumCulled = false; group.add(rings);

  // the display in the middle of a jog wheel: a mark that goes round as the record would
  const jog = canvas(64, 64);
  jog.g.fillStyle = '#05080e'; jog.g.fillRect(0, 0, 64, 64); jog.g.strokeStyle = '#2a5fd0'; jog.g.lineWidth = 5; jog.g.beginPath(); jog.g.arc(32, 32, 26, 0, 6.2832); jog.g.stroke();
  jog.g.fillStyle = '#f2f4ff'; jog.g.fillRect(29, 4, 6, 24); jog.tex.needsUpdate = true;
  const jogMat = new THREE.MeshBasicMaterial({ map: jog.tex, color: new THREE.Color(SCREEN, SCREEN, SCREEN), fog: false });
  for (const d of spin) { d.material = jogMat; group.add(d); }
  // the screens: a canvas each, redrawn a few times a second while there is something to see moving on it
  const shown = screens.map(({ i, geo }) => { const c = canvas(256, 144), mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: c.tex, color: new THREE.Color(SCREEN, SCREEN, SCREEN), fog: false })); group.add(mesh); return { i, c, was: '', at: -1 }; });
  // and the small one on the mixer, with the tempo
  const fx = canvas(96, 48), fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(-0.165, 0.1015, 0.105), new THREE.MeshBasicMaterial({ map: fx.tex, color: new THREE.Color(SCREEN, SCREEN, SCREEN), fog: false }));
  group.add(fxMesh);
  let fxWas = -1;

  // What the music player on this computer says it plays comes with the signals (player.js, Signals.told).
  let told = null;
  return { mix, update(t, dt, signals) {
    if (signals.player !== told) { told = signals.player; mix.told(told, t); }
    mix.update(signals, t, dt);
    leds.forEach((l, k) => { const [r, g, b] = l.colour(t); lamps.instanceColor.setXYZ(k, r * GLOW, g * GLOW, b * GLOW); });
    lamps.instanceColor.needsUpdate = true;
    PLAYERS.forEach((x, i) => {
      const s = mix.state(i), k = (s === 'play' || s === 'out' ? 0.85 : s === 'cue' ? 0.4 : 0.1) * GLOW, c = ending(mix, i, t) ? RED.map(v => v * (flash(t) ? 0.7 : 0.08)) : WHITE.map(v => v * k);
      rings.instanceColor.setXYZ(i, ...c); spin[i].rotation.y = -mix.turn[i];
    });
    rings.instanceColor.needsUpdate = true;
    // faders: up for what is in the mix, down for the rest; the crossfader goes over as one track takes the other's place
    faders.forEach((f, i) => { const up = i === mix.playing ? 1 - mix.mixing * mix.mixing * 0.75 : i === mix.leaving ? Math.sqrt(mix.mixing) : 0; f.position.z += (-0.165 + up * 0.095 - f.position.z) * Math.min(1, dt * 6); });
    cross.position.x += ((mix.mixing > 0.02 ? (mix.playing === 1 ? 1 : -1) * (mix.mixing - 0.5) * 0.07 : 0) - cross.position.x) * Math.min(1, dt * 4);
    for (const s of shown) {
      const state = mix.state(s.i), live = state === 'play' || state === 'out', key = state + mix.tracks + mix.title;   // a screen that plays is redrawn all the time anyway
      if (live ? t - s.at < 0.06 : key === s.was && (state !== 'cue' || t - s.at < 1)) continue;   // sixteen times a second while it plays; the others when what they show changes
      drawScreen(s.c, mix, s.i, t); s.c.tex.needsUpdate = true; s.was = key; s.at = t;
    }
    if (Math.round(mix.bpm) !== fxWas) {
      fxWas = Math.round(mix.bpm);
      fx.g.fillStyle = '#04060b'; fx.g.fillRect(0, 0, 96, 48); fx.g.fillStyle = '#ffb020'; fx.g.font = 'bold 26px monospace'; fx.g.textBaseline = 'top'; fx.g.fillText(fxWas ? String(fxWas) : '---', 6, 4); fx.g.font = '11px monospace'; fx.g.fillText('BPM  ECHO 1/2', 6, 33);
      fx.tex.needsUpdate = true;
    }
  } };
}
