// The stage: the deck, whoever plays on it, and what they play on. A venue says where the stage is and who plays:
//
//   stage.kind        'end' (against the far wall) or 'centre' (in the middle of the room, the crowd all round)
//   stage.round       a round deck (width is its diameter)
//   stage.floor       a surface for the deck (surfaces.js); a dark stage floor when left out
//   stage.performer   'dj', 'piano', 'orchestra' or 'none'; or { beat, flow }: who plays when the music has a beat and
//                     who when it flows (a mood of the director says which it is), so a church can have a DJ one
//                     night and a pianist the next
//   stage.pa          'arrays' (hung beside the stage), 'stacks' (on the floor) or 'none'
//   stage.riser       false: the DJ stands on the deck itself
// To add a kind of performer, add an entry to PERFORMERS.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, post } from './shapes.js';
import { buildDJ } from './dj.js';
import { buildDecks } from './decks.js';
import { people, peopleMaterial } from './people.js';

const TAU = Math.PI * 2;

// ctx: { add, put, lit, surface, plain, black, light, U } from the world
export function buildStage(L, ctx) {
  const { add, put, surface, plain, black } = ctx, st = L.stage, { W, H } = L.plan, open = !!L.shell.open;
  const deck = st.floor ? surface(st.floor, { gain: 2 }) : plain(0x1d1d20, { roughness: 0.55, metalness: 0.1, gain: 2.2 });   // a stage floor is dark, not a hole
  // Hangar's modular deck rests on legs and braces built in hangar-details.js; leave its underside open.
  const deckDepth = L.name === 'Hangar' ? Math.min(0.16, st.height) : st.height;
  if (st.height > 0.02) put(deck, st.round ? post(st.width / 2, st.height, 0, st.z, 0, 48) : box(Math.min(W - 0.2, st.width), deckDepth, st.depth, 0, st.height - deckDepth / 2, st.z));
  const pa = st.pa ?? (st.kind === 'centre' ? 'none' : H > 8 || open ? 'arrays' : 'stacks');
  for (const s of [-1, 1]) {   // the PA: flown line arrays in large rooms, compact stacks in small ones
    const x = s * Math.min(W / 2 - 1.2, st.width / 2 + 1.6);
    if (pa === 'arrays') {
      const face = plain(0x292c31, { roughness: 0.82, metalness: 0.22, gain: 0.85 });
      const cone = plain(0x111317, { roughness: 0.72, metalness: 0.18, gain: 0.7 });
      const rings = [], cones = [];
      for (let j = 0; j < 8; j++) {
        const tilt = j * 0.055, y = H * 0.72 - j * 0.5, z = st.front - 0.4 - j * j * 0.012;
        put(black, box(1.4, 0.48, 0.9, 0, 0, 0).rotateX(tilt).translate(x, y, z));
        // Two recessed-looking drivers on every cabinet face; the discs follow each cabinet's downward splay.
        for (const offset of [-0.105, 0.105]) {
          const cy = y + Math.cos(tilt) * offset - Math.sin(tilt) * 0.452;
          const cz = z + Math.sin(tilt) * offset + Math.cos(tilt) * 0.452;
          rings.push(post(0.126, 0.018, 0, 0, 0, 16).rotateX(Math.PI / 2).rotateX(tilt).translate(x, cy, cz));
          cones.push(post(0.094, 0.02, 0, 0, 0, 16).rotateX(Math.PI / 2).rotateX(tilt).translate(x, cy, cz + 0.012));
        }
      }
      put(face, rings); put(cone, cones);
      // A flybar and two slim hang points make the array read as flown equipment, not floating boxes.
      const topY = H * 0.72 + 0.25, topZ = st.front - 0.34;
      put(face, box(1.58, 0.09, 0.16, x, topY, topZ));
      for (const dx of [-0.52, 0.52]) put(face, post(0.025, H - 0.55 - topY, x + dx, topZ, topY, 6));
    }
    if (pa === 'stacks') for (let j = 0; j < 3; j++) put(black, box(0.75, 0.6, 0.7, x, 0.3 + j * 0.62, st.front + 0.5));
  }
  const who = typeof st.performer === 'object' ? st.performer : { beat: st.performer || 'dj', flow: st.performer || 'dj' }, acts = {};
  for (const kind of new Set([who.beat, who.flow])) {
    if (!PERFORMERS[kind]) throw new Error(`the venue ${L.name} asks for a performer "${kind}" that does not exist`);
    const group = add(new THREE.Group());
    acts[kind] = { group, ...PERFORMERS[kind]({ ...ctx, L, st, deck, group, own: o => (group.add(o), o) }) };
  }
  return {
    // flow: the music has no beat to it (see the director's moods)
    update(t, dt, signals, director, look, flow) {
      const on = flow ? who.flow : who.beat;
      for (const kind in acts) { acts[kind].group.visible = kind === on; if (kind === on) acts[kind].update?.(t, dt, signals, director, look); }
    },
  };
}

// a few seated or standing people who belong to the stage: [{ x, y, z, yaw, seated, shirt }]
function players(c, list) {
  const crowd = people(peopleMaterial({ light: c.light, U: c.U }), list.length), colour = new THREE.Color();
  list.forEach((p, i) => {
    crowd.put(i, p.x, p.z, p.yaw, 0.94 + Math.random() * 0.12, 0.9 + Math.random() * 0.2); crowd.sit(i, p.y, p.seated); crowd.dense(i, 0);
    crowd.shirt(i, colour.setHex(p.shirt ?? 0x0c0c0e)); crowd.seed(i, Math.random(), 0.99, 0.12 + Math.random() * 0.1, 1);   // they have work to do: no hands in the air
  });
  c.own(crowd.mesh);
}
const chair = (x, y, z, yaw) => [box(0.46, 0.06, 0.44, 0, 0.44, 0), box(0.46, 0.45, 0.05, 0, 0.7, 0.21), box(0.04, 0.44, 0.04, -0.2, 0.22, 0.18), box(0.04, 0.44, 0.04, 0.2, 0.22, 0.18), box(0.04, 0.44, 0.04, -0.2, 0.22, -0.18), box(0.04, 0.44, 0.04, 0.2, 0.22, -0.18)].map(g => g.rotateY(yaw).translate(x, y, z));

const PERFORMERS = {
  none: () => ({}),

  // the booth: a table with decks and a mixer, monitors either side, a work light, and the DJ
  dj(c) {
    const { L, st, own, lit, plain, black, deck } = c, { H } = L.plan, boothZ = L.focus[2], riser = st.riser ?? (H > 8 && st.height > 1) ? 0.4 : 0, base = st.height + riser, table = base + 1.05;
    const mesh = (g, mat) => own(new THREE.Mesh(g, mat));
    if (riser) mesh(box(6.4, riser, 3.4, 0, st.height + riser / 2, boothZ - 0.5), deck);   // the DJ on a riser, in a big room
    // The work light: a spot straight down on the decks and whoever plays, from as high as an arm's length above a raised
    // hand (or as high as the room allows). A lamp right over the head lit a raised hand twelve times as brightly as
    // the hands on the decks; this one falls off slowly and leaves the rest of the stage dark.
    const lampY = Math.min(base + 2.9, H - 0.2), lampPower = 7;
    const boothLight = own(new THREE.SpotLight(0xffe2c0, lampPower, 7, Math.atan(1.5 / (lampY - table)), 0.5, 1)); boothLight.position.set(0, lampY, boothZ - 0.5);
    boothLight.target.position.set(0, table, boothZ - 0.5); own(boothLight.target);
    // And a spot from the front, from over the first rows, on the face and chest of whoever plays, so that from the
    // hall the DJ is someone and not a shape against the light. It is narrow, to pass over the gear, and it ends
    // just behind the DJ: nothing here throws a shadow, and the floor behind would be lit where the shadow should be.
    const frontAt = new THREE.Vector3(0, Math.min(base + 3.4, H - 0.3), boothZ + 2.6), chest = new THREE.Vector3(0, base + 1.42, boothZ - 0.72), far = frontAt.distanceTo(chest) * 1.25;
    const frontLight = own(new THREE.SpotLight(0xfff0dc, 0, far, 0.13, 0.7, 1)), frontPower = 3.2 * far / 1.25 / 0.359;   // 0.359: what is left of a spot's light at four fifths of its reach
    frontLight.position.copy(frontAt); frontLight.target.position.copy(chest); own(frontLight.target);
    const width = Math.min(4.2, Math.max(2.4, st.width * 0.6));
    mesh(box(width, 1.05, 1.2, 0, base + 0.525, boothZ), black);
    const decks = buildDecks({ own, lit, at: [0, table, boothZ - 0.2] });   // four players round a mixer: see decks.js
    // a strip of light under the table's edge on the hall's side, and a small lamp on a stalk either side of the mixer
    const strip = mesh(box(width - 0.1, 0.03, 0.03, 0, table - 0.07, boothZ + 0.615), new THREE.MeshBasicMaterial({ color: 0, fog: false }));
    mesh(mergeGeometries([-1, 1].flatMap(s => [box(0.012, 0.3, 0.012, s * 0.235, table + 0.15, boothZ + 0.02), box(0.012, 0.012, 0.16, s * 0.235, table + 0.3, boothZ - 0.055)])), black);
    mesh(mergeGeometries([-1, 1].map(s => box(0.05, 0.012, 0.022, s * 0.235, table + 0.292, boothZ - 0.125))), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.42, 0.33), fog: false }));
    const artist = own(new THREE.Group()); artist.name = 'Stage performer';
    const updateDJ = buildDJ({ add: o => (artist.add(o), o), lit, black, at: [0, base, boothZ - 0.72], top: table + 0.1, gearZ: boothZ - 0.2 });
    const monitorFaces = [], monitorDrivers = [], monitorRings = [];
    const monitorFace = plain(0x292c31, { roughness: 0.82, metalness: 0.15, gain: 0.85 });
    const monitorCone = plain(0x101216, { roughness: 0.75, metalness: 0.12, gain: 0.75 });
    for (const s of [-1, 1]) {   // the DJ's own monitors: a bass cabinet with a mid/high cabinet on top at ear height, turned to the DJ
      const mx = s * 1.9, mz = boothZ - 1.0, turn = Math.atan2(-mx, 0.3), sn = Math.sin(turn), cs = Math.cos(turn);
      const panel = (w, h, d, y) => new THREE.PlaneGeometry(w, h).rotateY(turn).translate(mx + sn * (d / 2 + 0.006), y, mz + cs * (d / 2 + 0.006));
      const driver = (r, d, y) => new THREE.CircleGeometry(r, 16).rotateY(turn).translate(mx + sn * (d / 2 + 0.012), y, mz + cs * (d / 2 + 0.012));
      mesh(box(0.62, 0.74, 0.7, 0, 0, 0, turn).translate(mx, base + 0.37, mz), black);
      mesh(box(0.5, 0.8, 0.5, 0, 0, 0, turn).translate(mx, base + 1.16, mz), black);
      monitorFaces.push(panel(0.5, 0.62, 0.7, base + 0.37), panel(0.4, 0.66, 0.5, base + 1.16));
      monitorRings.push(driver(0.19, 0.7, base + 0.37), driver(0.14, 0.5, base + 1.16));
      monitorDrivers.push(driver(0.145, 0.7, base + 0.37), driver(0.1, 0.5, base + 1.16));
    }
    mesh(mergeGeometries(monitorFaces), monitorFace); mesh(mergeGeometries(monitorRings), monitorFace); mesh(mergeGeometries(monitorDrivers), monitorCone);
    return { update(t, dt, signals, director, look) {
      artist.visible = !look.maintenance;
      boothLight.intensity = look.maintenance ? lampPower * 0.5 : director.manual.blackout ? 0 : lampPower * look.light; frontLight.intensity = look.maintenance || director.manual.blackout ? 0 : frontPower * look.light;
      decks.update(t, dt, signals);
      strip.material.color.setRGB(...director.col2).multiplyScalar(look.maintenance ? 0 : (0.08 + signals.mid * 0.3 + signals.kick * 0.9) * (director.manual.blackout ? 0 : look.light));
      if (!look.maintenance) updateDJ(t, dt, signals);
    } };
  },

  // a grand piano, its lid up towards the hall, and whoever plays it
  piano(c) {
    const { L, st, own, plain } = c, lacquer = plain(0x050506, { roughness: 0.16, metalness: 0.35, gain: 3 }), ivory = plain(0xd8d4c8, { roughness: 0.4, gain: 2 }), y = st.height, x0 = -1.0, z0 = L.focus[2] - 0.75;
    const wing = new THREE.Shape(); wing.moveTo(0, 0); wing.lineTo(1.5, 0); wing.lineTo(1.5, 0.95); wing.bezierCurveTo(1.5, 1.9, 0.95, 1.7, 0.78, 2.65); wing.lineTo(0.12, 2.65); wing.lineTo(0, 2.45); wing.closePath();
    const slab = depth => new THREE.ExtrudeGeometry(wing, { depth, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2);   // lying flat: x along the keys, the tail towards -z
    const parts = [slab(0.3).translate(0, 0.72, 0), slab(0.03).rotateZ(0.62).translate(0, 1.03, 0)].map(g => g.toNonIndexed());
    for (const [lx, lz] of [[0.12, -0.2], [1.38, -0.2], [0.6, -2.35]]) parts.push(post(0.045, 0.72, lx, lz, 0, 8).toNonIndexed());
    parts.push(box(1.5, 0.05, 0.3, 0.75, 0.69, 0.15).toNonIndexed());
    // turned so that the keys run along the hall and the tail points across the stage
    own(new THREE.Mesh(mergeGeometries(parts.map(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; })).rotateY(-Math.PI / 2).translate(x0, y, z0), lacquer));
    own(new THREE.Mesh(box(0.14, 0.02, 1.3, x0 - 0.22, y + 0.74, z0 + 0.75), ivory));
    own(new THREE.Mesh(box(0.4, 0.48, 0.8, x0 - 0.75, y + 0.24, z0 + 0.75), lacquer));
    const lamp = own(new THREE.PointLight(0xffe2c0, 3, 7, 2)); lamp.position.set(x0 + 0.4, y + 2.6, z0 + 0.9);
    players(c, [{ x: x0 - 0.75, y: y + 0.05, z: z0 + 0.75, yaw: -Math.PI / 2, seated: true }]);
    return { update(t, dt, signals, director, look) { lamp.intensity = director.manual.blackout ? 0 : 3 * look.light; } };
  },

  // An orchestra: chairs and music stands in arcs round the conductor, the back rows on risers, and the players.
  orchestra(c) {
    const { L, st, own, plain, deck } = c, y = st.height, cz = st.front - 1.5, list = [], seats = [], stands = [], steps = [], reach = Math.min(st.depth - 2.2, 11);
    const rows = Math.max(2, Math.floor((reach - 2.2) / 1.25) + 1);
    for (let k = 0; k < rows; k++) {
      const r = 2.5 + k * 1.25, lift = Math.max(0, k - (rows - 3)) * 0.28, half = Math.min(1.4, Math.asin(Math.min(1, (st.width / 2 - 1) / r))), n = Math.max(2, Math.round(2 * half * r / 1.05));
      if (lift) steps.push(new THREE.RingGeometry(r - 0.62, r + 0.7, 40, 1, Math.PI / 2 - half - 0.05, 2 * half + 0.1).rotateX(-Math.PI / 2).translate(0, y + lift, cz), new THREE.CylinderGeometry(r - 0.62, r - 0.62, 0.28, 40, 1, true, Math.PI - half - 0.05, 2 * half + 0.1).translate(0, y + lift - 0.14, cz));
      for (let i = 0; i < n; i++) {
        const a = -half + 2 * half * (i + 0.5) / n, x = r * Math.sin(a), z = cz - r * Math.cos(a), yaw = Math.atan2(x, z - cz);
        list.push({ x, y: y + lift, z, yaw, seated: true, shirt: Math.random() < 0.15 ? 0xc8c8c8 : 0x0c0c0e });
        seats.push(...chair(x, y + lift, z, yaw));
        const sx = x - Math.sin(a) * 0.75, sz = z + Math.cos(a) * 0.75;   // a music stand between the player and the conductor
        stands.push(post(0.012, 1.05, sx, sz, y + lift, 5), box(0.42, 0.3, 0.02, 0, 0, 0).rotateX(-0.35).rotateY(yaw).translate(sx, y + lift + 1.15, sz));
      }
    }
    list.push({ x: 0, y: y + 0.22, z: cz + 0.35, yaw: 0, seated: false });   // the conductor, back to the hall
    const dark = plain(0x0a0a0c, { roughness: 0.6, gain: 2 });
    own(new THREE.Mesh(mergeGeometries(seats.map(g => g.toNonIndexed())), dark)); own(new THREE.Mesh(mergeGeometries(stands.map(g => g.toNonIndexed())), dark));
    own(new THREE.Mesh(box(1.1, 0.22, 1.1, 0, y + 0.11, cz + 0.35), deck));
    if (steps.length) own(new THREE.Mesh(mergeGeometries(steps.map(g => g.toNonIndexed())), deck)).material.side = THREE.DoubleSide;
    players(c, list);
    return {};
  },
};
