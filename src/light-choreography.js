// A composition is chosen at an existing scene cue. Its movement uses the music clock.
export const CHOREOGRAPHIES = {
  original: { name: 'Original show', description: 'Use the original Hangar light patterns.' },
  composed: { name: 'Composed show', description: 'Alternate stage openings, hall waves and held light pictures.' },
  stage: { name: 'Stage opening', description: 'The stage leads; hall heads and arches answer gradually.' },
  wave: { name: 'Hall wave', description: 'A slow wave travels through the heads and LED arches.' },
  hold: { name: 'Held picture', description: 'Hold the head directions for four beats, then resume gently.' },
  sweep: { name: 'Towards the stage', description: 'A band of light runs from the back of the hall to the stage every two bars.' },
  pingpong: { name: 'Left and right', description: 'The left and right of the hall answer each other every bar.' },
  solo: { name: 'Truss by truss', description: 'One hall truss at a time takes the lead, from the front to the back.' },
  centre: { name: 'From the middle', description: 'Light opens from the middle of the hall towards the walls.' },
  pulse: { name: 'Breathing room', description: 'The whole rig swells and settles over two bars.' },
  answer: { name: 'Call and response', description: 'The stage plays a bar, the hall answers with the next.' },
};
const COMPOSED = ['stage', 'wave', 'hold', 'sweep', 'pingpong', 'solo', 'centre', 'pulse', 'answer'];
export const normalizeChoreography = key => Object.hasOwn(CHOREOGRAPHIES, key) ? key : 'original';
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const u = clamp(x); return u * u * (3 - 2 * u); };

export class LightChoreography {
  constructor(groups) {
    const z = (groups.overhead || []).map(f => f.pos[2]);
    this.front = Math.min(...z); this.depth = Math.max(1, Math.max(...z) - this.front);
    this.reset();
  }
  reset() {
    this.mode = 'original'; this.key = null; this.scene = null; this.phase = 0; this.age = 0;
    this.previous = null; this.counts = Object.fromEntries(COMPOSED.map(key => [key, 0]));
    this.poses = new WeakMap(); this.gains = new WeakMap();
  }
  update(mode, scene, phase, section) {
    mode = normalizeChoreography(mode);
    if (phase < this.phase - 0.25) this.reset();
    if (mode !== this.mode || scene !== this.scene) {
      if (mode === 'composed') {
        const candidates = COMPOSED.filter(key => key !== this.previous);
        const least = Math.min(...candidates.map(key => this.counts[key]));
        const pool = candidates.filter(key => this.counts[key] === least);
        const seed = Math.abs(Math.floor(scene * 17 + phase * 7 + section.length * 11));
        this.key = pool[seed % pool.length];
        this.counts[this.key]++; this.previous = this.key;
      } else this.key = mode === 'original' ? null : mode;
      this.mode = mode; this.scene = scene; this.started = phase; this.poses = new WeakMap();
    }
    this.phase = phase; this.age = Math.max(0, phase - this.started);
    return this;
  }
  get active() { return this.key !== null; }
  get centre() { return this.key === 'stage' ? clamp((this.age - 4) / 16) : (this.age % 32) / 32; }
  // the newer compositions: how far through their cycle (sweep 8 beats, from the middle 16), which truss leads
  // (8 beats each) and how far the rig has swelled (8 beats)
  get cycle() { return this.key === 'centre' ? (this.age % 16) / 16 : (this.age % 8) / 8; }
  get soloRow() { return Math.floor(this.age / 8) % 5; }
  get swell() { return 0.5 - 0.5 * Math.cos(this.age * Math.PI * 2 / 8); }
  gain(f, role, dt) {
    const z = clamp((f.pos[2] - this.front) / this.depth);
    let target;
    if (this.key === 'stage') target = role === 'stage' ? 1.1 : 0.18 + 0.82 * smooth((this.age - 2 - z * 10) / 4);
    else if (this.key === 'wave') target = role === 'stage' ? 0.4 + 0.65 * (1 - smooth(this.centre * 2)) : 0.2 + Math.exp(-Math.pow((z - this.centre) * 4, 2));
    else if (this.key === 'hold') target = role === 'stage' ? 0.85 : f.row % 2 ? 0.32 : 0.95;
    else {
      const hall = role !== 'stage', side = Math.abs(f.pos[0]) > 18, bar = Math.floor(this.age / 4) % 2, c = this.cycle;
      if (this.key === 'sweep') target = hall ? 0.12 + Math.exp(-Math.pow((z - (1 - c)) * 6, 2)) : 0.3 + 0.8 * smooth((c - 0.8) * 5);
      else if (this.key === 'pingpong') target = hall ? ((f.pos[0] < 0 ? 0 : 1) === bar ? 1.05 : 0.2) : 0.7;
      else if (this.key === 'solo') target = !hall ? 0.6 : side ? 0.35 : f.row === this.soloRow ? 1.15 : 0.18;
      else if (this.key === 'centre') target = hall ? 0.15 + 0.95 * Math.exp(-Math.pow((Math.abs(f.xn || 0) - c) * 4, 2)) : 0.4 + 0.6 * (c < 0.2 ? 1 : 0);
      else if (this.key === 'pulse') target = 0.2 + 0.85 * this.swell;
      else target = hall === (bar === 1) ? 1.05 : 0.22;   // call and response: the stage on the first bar, the hall on the second
    }
    const gain = (this.gains.get(f) ?? 1) + (target - (this.gains.get(f) ?? 1)) * (1 - Math.exp(-Math.max(0, dt) / 0.8));
    this.gains.set(f, gain); return gain;
  }
  aim(f, pan, tilt) {
    if (this.key !== 'hold' || this.age >= 4) return [pan, tilt];
    if (!this.poses.has(f)) this.poses.set(f, [...(f.hangarAim || [f.ch.pan, f.ch.tilt])]);
    return this.poses.get(f);
  }
  arch(ch) {
    ch.pattern = 3; ch.travel = 99; ch.kickPulse = 0;
    ch.archCentre = this.key === 'hold' ? 0.5 : this.centre;
    ch.archWidth = this.key === 'hold' ? 0.55 : 0.22;
    ch.archBase = this.key === 'hold' ? 0.65 : 0.15;
    ch.archStrength = this.key === 'hold' ? 0.25 : 0.85;
    const bar = Math.floor(this.age / 4) % 2, c = this.cycle;   // the newer compositions: [centre, width, base, strength]
    const shape = { sweep: [1 - c, 0.18, 0.12, 0.9], pingpong: [0.5, 0.8, bar ? 0.75 : 0.2, 0.2], solo: [this.soloRow / 4, 0.12, 0.1, 0.9],
      centre: [0.5, 0.12 + c * 0.6, 0.15, 0.85], pulse: [0.5, 0.8, 0.15 + 0.7 * this.swell, 0.2], answer: bar ? [0.5, 0.8, 0.6, 0.3] : [0.1, 0.2, 0.1, 0.8] }[this.key];
    if (shape) [ch.archCentre, ch.archWidth, ch.archBase, ch.archStrength] = shape;
    if (this.key === 'hold' && this.age < 4) ch.phase = this.started;
    ch.flash *= this.key === 'hold' ? 0.15 : 0.4;
  }
}
