// A steady picture: when frames take longer than the screen allows, the show draws fewer pixels, and more again when
// there is room. Most of a frame is pixels (beams in haze, glow, the crowd), so a slightly softer picture keeps the
// pace where a full one would stutter. Changing the resolution needs no rebuild, unlike a change of quality.
//   scale  the share of the quality's resolution drawn now, from MIN to 1
// sample() is called every frame with its raw length and returns a new scale when it should change, or null.
export const MIN = 0.7, STEP = 0.05;

export class SteadyResolution {
  constructor() { this.scale = 1; this.fastest = 1 / 60; this.ceiling = 1; this.ceilingFor = 0; this.sinceUp = 99; this.reset(); }
  reset() { this.warmup = 3; this.frames = []; this.room = 0; this.since = 0; }
  // the frame time to keep: the screen's own pace once it has shown it (a 75 Hz screen: 13.3 ms), else 60 a second
  get target() { return Math.min(1 / 60, this.fastest); }
  get atMin() { return this.scale <= MIN + 1e-9; }
  sample(dt, { visible = true, ready = true, enabled = true } = {}) {
    if (!visible || !ready || !enabled || !Number.isFinite(dt) || dt <= 0) { this.reset(); return null; }
    if (this.warmup > 0) { this.warmup -= Math.min(dt, 0.5); return null; }
    this.frames.push(Math.min(dt, 0.25));   // one long stall (a hidden tab, a file dialog) is not the pace
    this.since += dt;
    if (this.frames.length < 30 || this.since < 1) return null;
    const sorted = [...this.frames].sort((a, b) => a - b), typical = sorted[sorted.length >> 1], quick = sorted[Math.floor(sorted.length * 0.1)];
    this.frames = []; this.since = 0;
    // the quickest frames show how fast the screen refreshes, when the card keeps up with it
    if (quick > 1 / 165 && quick < this.fastest * 0.97) this.fastest = Math.max(1 / 165, quick);
    const target = this.target;
    this.sinceUp++; if (this.ceilingFor > 0 && --this.ceilingFor === 0) this.ceiling = 1;
    if (typical > target * 1.2 && !this.atMin) {
      // a step up that did not hold: that resolution is not tried again for a minute, so the picture does not keep switching
      if (this.sinceUp <= 2) { this.ceiling = this.scale; this.ceilingFor = 60; }
      this.room = 0; return this.scale = Math.max(MIN, +(this.scale - STEP).toFixed(2));
    }
    // room to spare for three seconds in a row: a step back up, so the picture is as sharp as the card allows
    const up = Math.min(1, +(this.scale + STEP).toFixed(2));
    if (typical < target * 1.08 && up > this.scale && (this.ceilingFor === 0 || up < this.ceiling - 1e-9)) {
      if (++this.room >= 3) { this.room = 0; this.sinceUp = 0; return this.scale = up; }
    } else this.room = 0;
    return null;
  }
}
