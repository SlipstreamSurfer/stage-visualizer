// The DJ: a figure in a T-shirt and jeans. Body, head and arms are separate, so the DJ can work. The hands go to the mixer's knobs and faders, the
// jog wheels and the headphones, and the arms follow them (shoulder, elbow, hand). Built facing +z, the crowd.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UPPER = 0.3, FORE = 0.33, TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const target = new THREE.Vector3(), pole = new THREE.Vector3(), dir = new THREE.Vector3(), elbow = new THREE.Vector3(), tmp = new THREE.Vector3();
const fingers = new THREE.Vector3(), knuckles = new THREE.Vector3(), thumbs = new THREE.Vector3(), basis = new THREE.Matrix4();   // a hand's own directions

// What the DJ is doing: where the two hands go ([left of the picture, right]) and how they move there, a step to
// the side, and how far the DJ looks down at the gear.
const ACTS = {
  mix:    () => ({ hands: [['knobs', 'twist'], ['knobs', 'twist']], step: 0, down: 0.42 }),
  ride:   s => ({ hands: s > 0 ? [['jog', 'nudge'], ['fader', 'slide']] : [['fader', 'slide'], ['jog', 'nudge']], step: s * 0.08, down: 0.45 }),
  cue:    s => ({ hands: s > 0 ? [['ear', 'hold'], ['farJog', 'nudge']] : [['farJog', 'nudge'], ['ear', 'hold']], step: s * 0.34, down: 0.36, tilt: s * 0.22 }),
  load:   s => ({ hands: s > 0 ? [['knobs', 'rest'], ['farKnob', 'twist']] : [['farKnob', 'twist'], ['knobs', 'rest']], step: s * 0.36, down: 0.5, turn: s * 0.35 }),
  filter: s => ({ hands: s > 0 ? [['fader', 'rest'], ['filter', 'sweep']] : [['filter', 'sweep'], ['fader', 'rest']], step: 0, down: 0.3 }),
  watch:  () => ({ hands: [['edge', 'rest'], ['edge', 'rest']], step: 0, down: 0.02 }),
  cheer:  s => ({ hands: s > 0 ? [['edge', 'rest'], ['air', 'pump']] : [['air', 'pump'], ['edge', 'rest']], step: 0, down: -0.05 }),
};

// at: where the DJ stands [x, y, z]; top: the height of the gear's surface; gearZ: where the gear's middle is
export function buildDJ({ add, lit, black, at, top, gearZ }) {
  // skin, a T-shirt, jeans, shoes and hair: each a material the beams light
  const cloth = color => lit(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), 2.5);
  const skin = lit(new THREE.MeshStandardMaterial({ color: 0x8f6a52, roughness: 0.8 }), 2.5), shirt = cloth(0x26262c), jeans = cloth(0x1a2438), hair = cloth(0x15100c);
  const dj = add(new THREE.Group()); dj.position.set(...at);
  const piece = (geo, mat, to = dj) => { const m = new THREE.Mesh(geo, mat); to.add(m); return m; };
  const turned = points => new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), 14).scale(1, 1, 0.62);
  // the T-shirt, from its hem over the chest and the slope of the shoulders to the collar; the hips in jeans; the neck
  piece(turned([[0.001, 0.9], [0.152, 0.9], [0.158, 0.99], [0.148, 1.11], [0.166, 1.26], [0.198, 1.36], [0.186, 1.415], [0.11, 1.452], [0.064, 1.462], [0.001, 1.462]]), shirt);
  piece(turned([[0.001, 0.8], [0.142, 0.8], [0.15, 0.9], [0.148, 0.93], [0.001, 0.93]]), jeans);
  piece(new THREE.CylinderGeometry(0.047, 0.055, 0.1, 10).translate(0, 1.5, 0), skin);
  for (const s of [-1, 1]) {
    piece(new THREE.CylinderGeometry(0.088, 0.058, 0.76, 9).translate(s * 0.09, 0.46, 0), jeans);    // a leg
    piece(new THREE.BoxGeometry(0.1, 0.085, 0.27).translate(s * 0.095, 0.045, 0.045), black);       // a shoe
    piece(new THREE.SphereGeometry(0.058, 10, 7).translate(s * 0.232, 1.378, 0), shirt);            // the shoulder, under the sleeve
  }
  const head = new THREE.Group(); head.position.set(0, 1.5, 0);   // turns at the neck
  piece(new THREE.SphereGeometry(0.092, 14, 10).scale(0.88, 1.18, 1).translate(0, 0.125, 0), skin, head);
  piece(new THREE.BoxGeometry(0.022, 0.04, 0.03).translate(0, 0.105, 0.09), skin, head);                                                                  // the nose
  piece(new THREE.SphereGeometry(0.1, 24, 10, 0, TAU, 0, 1.25).scale(0.93, 1.2, 1.05).rotateX(-0.6).translate(0, 0.13, -0.008), hair, head);                  // hair: a little proud of the head, so that its edge is a clean line
  for (const s of [-1, 1]) piece(new THREE.SphereGeometry(0.009, 8, 6).translate(s * 0.03, 0.14, 0.081), black, head);                                     // eyes
  piece(new THREE.BoxGeometry(0.032, 0.005, 0.01).translate(0, 0.068, 0.078), black, head);                                                                 // the mouth
  for (const s of [-1, 1]) piece(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12).rotateZ(Math.PI / 2).translate(s * 0.1, 0.12, 0), black, head);      // headphones
  piece(new THREE.TorusGeometry(0.098, 0.015, 6, 12, Math.PI).scale(1, 1.35, 1).translate(0, 0.12, 0), black, head);
  dj.add(head);
  // A hand: the palm, four fingers a little curled, and the thumb on the inside. +y runs from the wrist to the
  // fingertips and +z is the back of the hand.
  const hand = side => mergeGeometries([new THREE.SphereGeometry(0.5, 10, 8).scale(0.08, 0.1, 0.034).translate(0, 0.032, 0),
    ...[-1.5, -0.5, 0.5, 1.5].map(k => new THREE.CapsuleGeometry(0.0095, 0.052, 3, 6).rotateX(-0.45).translate(k * 0.0185, 0.104 - Math.abs(k) * 0.004, -0.016)),
    new THREE.CapsuleGeometry(0.0115, 0.04, 3, 6).rotateZ(-side * 0.75).translate(side * 0.05, 0.035, -0.006)]);
  // an arm: bare from under the sleeve of the T-shirt, which covers the upper half of the upper arm
  const arms = [-1, 1].map(side => ({ side, shoulder: new THREE.Vector3(side * 0.245, 1.38, 0),
    upper: piece(new THREE.CylinderGeometry(0.04, 0.047, 1, 9), skin), sleeve: piece(new THREE.CylinderGeometry(0.05, 0.057, 0.55, 10).translate(0, -0.225, 0), shirt),
    fore: piece(new THREE.CylinderGeometry(0.031, 0.04, 1, 9), skin), elbow: piece(new THREE.SphereGeometry(0.042, 8, 6), skin), hand: piece(hand(side), skin),
    at: new THREE.Vector3(side * 0.3, 1.3, 0.42), to: new THREE.Vector3() }));
  // where a hand can be, in the hall's coordinates; side is -1 or 1 along x
  const y = top + 0.04, spot = {
    knobs: s => [s * 0.1, y, gearZ + 0.1], filter: s => [s * 0.07, y, gearZ - 0.02], fader: s => [s * 0.1, y - 0.01, gearZ - 0.12],
    jog: s => [s * 0.42, y, gearZ - 0.085], farJog: s => [s * 0.78, y, gearZ - 0.085], farKnob: s => [s * 0.9, y + 0.02, gearZ + 0.06],
    edge: s => [s * 0.3, y - 0.1, gearZ - 0.28],
  };
  const now = { act: 'mix', side: 1, until: 0, plan: ACTS.mix(), step: 0, down: 0.4, tilt: 0, turn: 0 };
  const LASTS = { mix: 7, ride: 6, cue: 10, load: 5, filter: 1e9, watch: 5, cheer: 3 };

  return function update(t, dt, signals) {
    const m = signals.m, brk = m.phase === 'break';
    // in a break a hand is on the filter; on the drop an arm goes up, then the DJ looks out over the hall; otherwise
    // it is the work of mixing, a few seconds at a time
    const want = brk && m.hasGrooved && m.activity > 0.3 ? 'filter' : signals.drop > 0.6 ? 'cheer' : signals.drop > 0.2 ? 'watch' : null;
    if (want ? now.act !== want : t > now.until || now.act === 'filter' || now.act === 'watch' || now.act === 'cheer') {
      const r = Math.random();
      now.act = want || (m.activity < 0.15 ? 'watch' : r < 0.4 ? 'mix' : r < 0.65 ? 'ride' : r < 0.85 ? 'cue' : 'load');
      now.side = Math.random() < 0.5 ? -1 : 1;
      now.plan = ACTS[now.act](now.side);
      now.until = t + LASTS[now.act] * (0.7 + Math.random() * 0.6);
    }
    const plan = now.plan, ease = rate => 1 - Math.exp(-dt * rate);
    now.step += (plan.step - now.step) * ease(2.2);
    now.down += ((plan.down - (now.act === 'filter' ? m.build * 0.25 : 0)) - now.down) * ease(3);
    now.tilt += ((plan.tilt || 0) - now.tilt) * ease(3);
    now.turn += ((plan.turn || 0) - now.turn) * ease(2.5);
    dj.position.set(at[0] + now.step, at[1], at[2]);
    dj.rotation.set(0.07 + now.down * 0.1, now.turn * 0.4, 0);   // leaning over the table, more so when looking down
    head.rotation.set(now.down + Math.sin(signals.phase * TAU) * 0.035, now.turn * 0.6, now.tilt);   // the small nod of someone counting along
    dj.updateMatrixWorld();
    for (let i = 0; i < 2; i++) {
      const arm = arms[i], [where, move] = plan.hands[arm.side > 0 ? 1 : 0];
      if (where === 'ear') arm.to.set(arm.side * 0.13, 1.63 - now.down * 0.03, 0.03 + now.down * 0.08);   // holding one cup of the headphones
      else if (where === 'air') arm.to.set(arm.side * 0.3, 1.95 + Math.abs(Math.sin(signals.phase * Math.PI)) * 0.12, 0.2);
      else { arm.to.set(...spot[where](arm.side)); dj.worldToLocal(arm.to); }
      const k = t + i * 2.1;
      if (move === 'twist') { arm.to.x += Math.sin(k * 2.3) * 0.035; arm.to.z += Math.sin(k * 0.9) * 0.05; }   // from knob to knob
      else if (move === 'nudge') { const a = Math.sin(k * 1.7) * 0.9; arm.to.x += Math.sin(a) * 0.075 * arm.side; arm.to.z += (1 - Math.cos(a)) * -0.06 + 0.02; }   // along the rim of the jog wheel
      else if (move === 'slide') arm.to.z += Math.sin(k * 0.7) * 0.035;
      else if (move === 'sweep') arm.to.x += (m.build - 0.5) * 0.03;
      arm.at.lerp(arm.to, ease(where.startsWith('far') || move === 'hold' ? 5 : 7));
      // shoulder, elbow, hand: two bones, the elbow out to the side and down
      dir.subVectors(arm.at, arm.shoulder);
      const reach = Math.min(dir.length(), UPPER + FORE - 0.005);
      dir.normalize();
      target.copy(arm.shoulder).addScaledVector(dir, reach);
      const along = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach), out = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
      pole.set(arm.side * 0.75, -0.6, -0.3); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      elbow.copy(arm.shoulder).addScaledVector(dir, along).addScaledVector(pole, out);
      const bone = (mesh, a, b) => { mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.scale.y = a.distanceTo(b); mesh.quaternion.setFromUnitVectors(UP, tmp.subVectors(b, a).normalize()); };
      bone(arm.upper, arm.shoulder, elbow); bone(arm.sleeve, arm.shoulder, elbow); bone(arm.fore, elbow, target);
      arm.elbow.position.copy(elbow); arm.hand.position.copy(target);
      // the hand goes on along the forearm with its back turned up (or to the stage behind, when the arm is in the air)
      fingers.subVectors(target, elbow).normalize(); knuckles.copy(UP).addScaledVector(fingers, -UP.dot(fingers));
      if (knuckles.lengthSq() < 0.02) knuckles.set(0, 0, -1).addScaledVector(fingers, fingers.z);
      thumbs.crossVectors(fingers, knuckles.normalize()); arm.hand.quaternion.setFromRotationMatrix(basis.makeBasis(thumbs, fingers, knuckles));
    }
  };
}
