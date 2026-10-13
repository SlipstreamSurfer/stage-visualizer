// A composition is chosen at an existing scene cue. Its movement uses the music clock.
export const CHOREOGRAPHIES = {
  original: { name: 'Original show', description: 'Use the original Hangar light patterns.' },
  composed: { name: 'Composed show', description: 'Alternate stage openings, hall waves and held light pictures.' },
  stage: { name: 'Stage opening', description: 'The stage leads; hall heads and arches answer gradually.' },
  wave: { name: 'Hall wave', description: 'A slow wave travels through the heads and LED arches.' },
  hold: { name: 'Held picture', description: 'Hold the head directions for four beats, then resume gently.' },
};
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
    this.previous = null; this.counts = { stage: 0, wave: 0, hold: 0 };
    this.poses = new WeakMap(); this.gains = new WeakMap();
  }
  update(mode, scene, phase, section) {
    mode = normalizeChoreography(mode);
    if (phase < this.phase - 0.25) this.reset();
    if (mode !== this.mode || scene !== this.scene) {
      if (mode === 'composed') {
        const candidates = ['stage', 'wave', 'hold'].filter(key => key !== this.previous);
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
  gain(f, role, dt) {
    const z = clamp((f.pos[2] - this.front) / this.depth);
    let target;
    if (this.key === 'stage') target = role === 'stage' ? 1.1 : 0.18 + 0.82 * smooth((this.age - 2 - z * 10) / 4);
    else if (this.key === 'wave') target = role === 'stage' ? 0.4 + 0.65 * (1 - smooth(this.centre * 2)) : 0.2 + Math.exp(-Math.pow((z - this.centre) * 4, 2));
    else target = role === 'stage' ? 0.85 : f.row % 2 ? 0.32 : 0.95;
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
    if (this.key === 'hold' && this.age < 4) ch.phase = this.started;
    ch.flash *= this.key === 'hold' ? 0.15 : 0.4;
  }
}
