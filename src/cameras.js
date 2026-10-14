// Cameras: the shots a venue has, worked out from its size and where its stage is, and a director that chooses
// between them with the music. Each shot is a slow move: pos(t, k) gives the position, with k the seconds since the
// cut. Every venue has the same nine, in the same order, so the camera director can ask for them by number.
export function shots({ plan: { W, D, H, rise = 0, shape }, stage, floor, focus, ground, onStage, ceil, trusses = [], movers = [], facilities = [], shell = {} }, extra = []) {
  const pit = facilities.find(f => f.type === 'barrier')?.pit ?? 1.6;   // how far the barrier is from the stage
  const len = floor.z1 - floor.z0, front = stage.front, far = stage.back, eye = stage.height + 1.75, top = H + rise * 0.6;   // top: how high a camera may think the room is
  const boothZ = focus[2], riser = H > 8 && stage.height > 1 ? 0.4 : 0;   // where the stage puts the booth
  const pitSweep = (k, width) => -width + Math.min(Math.max(0, k) * 0.3, width * 2);
  // behind whoever plays: over one shoulder for a while, slowly across to the other, so that the head is seldom in front of the mixer
  const shoulder = t => Math.sin(Math.PI / 2 * Math.sin(t * 0.045));
  // In round halls the lighting rings run across the high views. Stay below their hanging fixtures,
  // so the slow move keeps a clear view of the stage instead of looking through the near side of a ring.
  const ringClearance = shape === 'round' ? Math.min(Infinity, ...trusses
    .filter(([a, b]) => Math.abs(a[1] - b[1]) < 0.01 && a[1] > stage.height + 3 && Math.max(a[2], b[2]) > stage.front)
    .map(([a]) => a[1] - 1.8), ...movers.filter(m => m.props?.kind === 'ring').map(m => m.pos[1] - m.props.maxDrop - 1.8)) : Infinity;
  let list;
  if (stage.kind === 'centre') {   // the crowd is all round the stage, and so are the cameras
    const R = Math.min(W, D) / 2, cz = stage.z, r0 = stage.width / 2, round = (a, r, y) => [Math.sin(a) * r, y, cz + Math.cos(a) * r];
    list = [
      { name: 'Front of house', fov: 60, pos: t => round(t * 0.02, R * 0.62, 2.2 + top * 0.2), look: [0, top * 0.32, cz] },
      { name: 'Dance floor', fov: 72, pos: t => round(2 + t * 0.03, Math.min(R * 0.72, Math.max(r0 + Math.min(4, R * 0.25), R * 0.36)), 2.5 + Math.abs(Math.sin(t * 1.7)) * 0.04), look: [0, top * 0.38, cz] },
      { name: 'High at the back', fov: 58, pos: (t, k) => [R * 0.5 - k * 0.05, top * 0.82, cz + R * 0.72], look: [0, 1.5, cz] },
      { name: 'Roof', fov: 78, pos: t => round(4 + t * 0.05, R * 0.3, 2.6), look: [0, top, cz] },
      { name: 'DJ booth', fov: 72, pos: t => [shoulder(t), Math.min(top - 0.5, eye + 1.1), cz - 2.6], look: [0, eye - 1.35, cz + 11] },   // over the DJ's shoulder, down on the gear and out over the crowd
      { name: 'Crane', fov: 62, pos: (t, k) => [-R * 0.45 + k * 0.1, Math.min(top * 0.62, 2.8 + k * 0.3), cz + R * 0.4], look: [0, top * 0.3, cz] },
      { name: 'Truss', fov: 64, pos: (t, k) => round(0.9 + k * 0.011, R * 0.42, top * 0.86), look: [0, 2, cz] },
      { name: 'Side', fov: 66, pos: (t, k) => [R - 1.6, Math.max(2.2, top * 0.35), cz + k * 0.1], look: [0, 2, cz] },
      { name: 'Pit', fov: 70, pos: (t, k) => [pitSweep(k, Math.min(2, W * 0.15)), 1.55, stage.front + Math.min(1.1, Math.max(0.2, stage.height))], look: [0, 1.9, cz + r0 + 10] },   // at the stage's edge, looking out into the front rows
    ];
  } else list = [
    { name: 'Front of house', fov: 60, pos: (t, k) => [Math.sin(t * 0.07) * W * 0.07, 2.2 + top * 0.2 + Math.sin(t * 0.11) * 0.4, floor.z0 + len * 0.72 - k * 0.15], look: [0, top * 0.4, far] },
    { name: 'Dance floor', fov: 72, pos: (t, k) => [Math.sin(t * 0.09) * W * 0.09, 2.5 + Math.abs(Math.sin(t * 1.7)) * 0.04, floor.z0 + len * 0.3 - k * 0.1], look: [0, top * 0.42, far] },
    { name: 'High at the back', fov: 58, pos: (t, k) => [W * 0.4 - k * 0.05, top * 0.82, D / 2 - 1.5], look: [0, 1.5, front] },
    { name: 'Roof', fov: 78, pos: t => [Math.sin(t * 0.05) * W * 0.22, 2.6, floor.z0 + len * 0.4 + Math.cos(t * 0.05) * len * 0.15], look: [0, top, floor.z0 + len * 0.35] },
    { name: 'DJ booth', fov: 72, pos: t => [shoulder(t), Math.min(top - 0.5, eye + riser + 1.1), Math.max(far + 0.9, boothZ - 2.6)], look: [0, eye + riser - 1.35, boothZ + 11] },   // over the shoulder of whoever plays, down on the gear and out over the crowd
    { name: 'Crane', fov: 62, pos: (t, k) => [-W * 0.16 + k * 0.1, Math.min(top * 0.62, 2.8 + k * 0.3), floor.z0 + len * 0.45], look: [0, top * 0.35, far] },
    { name: 'Truss', fov: 64, pos: (t, k) => [Math.sin(0.9 + k * 0.011) * W * (top < 6 ? 0.2 : 0.3), top * 0.86, floor.z0 + len * 0.35 + Math.cos(0.9 + k * 0.011) * len * 0.2], look: [0, 2, front - 1] },
    { name: 'Side', fov: 66, pos: (t, k) => [floor.x1 + 0.3, Math.max(2.2, top * 0.35), front + 2 + k * 0.1], look: [-W * 0.1, 2, floor.z0 + len * 0.3] },
    { name: 'Pit', fov: 70, pos: (t, k) => [pitSweep(k, Math.min(6, W * 0.25)), 1.55, front + pit - 0.5], look: [0, 1.9, front + pit + Math.min(10, len * 0.4)] },   // in front of the stage, looking up into the front rows
  ];
  if (shell.open) list.push({ name: 'Drone', fov: 55, pos: t => [Math.sin(t * 0.03 + 0.6) * W * 0.9, 34 + Math.sin(t * 0.05) * 6, floor.z0 + len * 0.55 + Math.cos(t * 0.03 + 0.6) * len * 0.55], look: [0, 6, front] });   // in the open air a camera can fly
  // Fit every view, including facility cameras, to the real room. Ground cameras on an open terrace stay above
  // its floor; the outdoor drone is free to fly beyond it. High cameras keep their absolute height above a rake.
  const low = new Set(['Front of house', 'Dance floor', 'Roof', 'Crane', 'Side', 'Pit', 'Bar', 'Front of house desk']);
  const rock = shell.rough || 0;   // rock walls come further into the room than its plan says
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fit = (point, name, target = false) => {
    const p = [...point], drone = name === 'Drone';
    if (!target && (name === 'High at the back' || name === 'Truss')) p[1] = Math.min(p[1], ringClearance);
    if (!shell.open || (shell.ground === false && !drone)) {
      const margin = Math.min((target ? 0.2 : 0.7) + rock * 1.7, Math.min(W, D) * 0.2);
      const rx = W / 2 - margin, rz = D / 2 - margin;
      p[0] = clamp(p[0], -rx, rx); p[2] = clamp(p[2], -rz, rz);
      if (shape === 'round') {
        const r = Math.hypot(p[0] / rx, p[2] / rz);
        if (r >= 1) { p[0] *= 0.999 / r; p[2] *= 0.999 / r; }
      }
    }
    const floorY = ground(p[0], p[2]);
    if (!target && low.has(name)) p[1] += floorY;
    const surface = Math.max(floorY, onStage(p[0], p[2]) ? stage.height : 0);
    p[1] = Math.max(p[1], surface + (target ? 0.5 : 0.7));
    if (!shell.open) p[1] = Math.min(p[1], ceil(p[0], p[2]) - rock * 2.4 - (target ? 0.15 : 0.7));
    return p;
  };
  return [...list, ...extra].map(s => ({ ...s, look: fit(s.look, s.name, true), pos: (t, k = 0) => fit(s.pos(t, k), s.name) }));
}

// With the camera on automatic the shots follow the track: each part has shots that suit it and a time to stay on
// one, a break goes in close, and the drop cuts on the kick to a shot of the whole room. Other changes dip through
// black (fade is 0 when the picture should be black).
const PLAN = {
  intro: { shots: [0, 2, 7], hold: 45 }, groove: { shots: [1, 5, 0, 6, 2, 8], hold: 30 }, peak: { shots: [0, 5, 6, 1, 3, 4], hold: 16 },
  low: { shots: [2, 7, 3], hold: 40 }, break: { shots: [4, 8, 2], hold: 60 },
};
// With a light composition playing (Hangar's light choreography) the camera shows it: a cut to a shot that suits it
// when it starts, no other cuts while it develops (develop, in beats; a drop still cuts), and for a stage opening a
// wide shot once the light reaches the hall. A break keeps its own close shots.
export const LIGHT_SHOTS = {
  stage: { shots: [0, 8, 1], reveal: [2, 5], revealAt: 10, develop: 20 },
  wave: { shots: [7, 2, 6], develop: 32 },
  hold: { shots: [0, 5, 2], develop: 6 },
  sweep: { shots: [7, 2, 6], develop: 8 },
  pingpong: { shots: [0, 2, 5], develop: 8 },
  solo: { shots: [7, 6, 2], develop: 40 },
  centre: { shots: [0, 5, 2], develop: 16 },
  pulse: { shots: [0, 5, 2], develop: 8 },
  answer: { shots: [0, 1, 8], develop: 8 },
};
export class CameraDirector {
  // list: the venue's shots; the ones after the first nine come from its facilities (the bar, front of house) and are
  // used when the track is calm
  constructor(list, startedAt = 0) { this.extra = list.map((_, i) => i).filter(i => i >= 9); Object.assign(this, { list, index: 0, auto: true, lastCut: startedAt, pending: null, fadeFrom: 0, fadeIn: -10, turn: 0, fade: 1 }); }
  cut(i, t) { this.index = i; this.lastCut = t; this.pending = null; }
  direct(t, shots, hard = false) {
    const choice = shots.filter(s => s !== this.index && s < this.list.length), next = choice[this.turn++ % choice.length];
    if (next === undefined) return;
    if (hard) { this.cut(next, t); this.fadeIn = -10; } else { this.pending = next; this.fadeFrom = t; }
  }
  // returns the shot to draw
  // light: the light composition that is playing, { key, started, age } (see LIGHT_SHOTS), or null
  update(signals, t, hold = 1, light = null) {
    const m = signals.m, ev = signals.ev, base = PLAN[m.section], plan = base.shots.length && (m.section === 'intro' || m.section === 'low') ? { hold: base.hold, shots: [...base.shots, ...this.extra] } : base;
    if (this.auto) {
      const over = factor => this.pending === null && t - this.lastCut > plan.hold * hold * factor;
      const cue = m.phase !== 'break' && light ? LIGHT_SHOTS[light.key] : null, fresh = cue && light.started !== this.lightStarted;
      if (fresh) { this.lightStarted = light.started; this.revealed = false; }
      const shots = cue ? [...cue.shots, ...cue.reveal || []] : plan.shots;
      if (ev.drop) this.direct(t, [0, 5], true);
      else if (fresh && this.pending === null && t - this.lastCut > 4) this.direct(t, cue.shots);
      else if (cue?.reveal && !this.revealed && light.age >= cue.revealAt && this.pending === null) { this.revealed = true; if (!cue.reveal.includes(this.index)) this.direct(t, cue.reveal); }
      else if (cue && light.age < cue.develop) { /* let the light develop on screen */ }
      else if (ev.from && ev.from !== 'break' && m.section !== 'break' && this.pending === null && t - this.lastCut > 8) this.direct(t, shots);
      else if (ev.kick && signals.beats % 16 === 0 && over(1)) this.direct(t, shots);
      else if (over(1.5)) this.direct(t, shots);
      else if (this.pending === null && m.phase === 'break' && m.hasGrooved && signals.sinceBreak > 3 && t - this.lastCut > signals.sinceBreak) this.direct(t, PLAN.break.shots);
    }
    if (this.pending !== null && t - this.fadeFrom > 0.28) { this.cut(this.pending, t); this.fadeIn = t; }
    this.fade = this.pending !== null ? 1 - (t - this.fadeFrom) / 0.28 : Math.min(1, (t - this.fadeIn) / 0.4);
    return this.list[this.index];
  }
}
