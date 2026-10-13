// Automatic quality starts at Normal and steps down only after sustained slow drawing.
// Explicit quality choices are never overridden; hidden tabs and loading are not measurements.
export const QUALITY = {
  low: { name: 'Light', ratio: 0.75, crowd: 0.45, beams: 8, bloom: false },
  normal: { name: 'Normal', ratio: 1, crowd: 0.8, beams: 18, bloom: true },
  high: { name: 'High', ratio: 1.5, crowd: 1, beams: 28, bloom: true },
};

export class AutoQuality {
  constructor() { this.reset(); }
  reset() { this.warmup = 6; this.elapsed = 0; this.frames = 0; }
  sample(dt, { visible, ready, automatic, quality }) {
    if (!visible || !ready || !automatic || quality === 'low') { this.reset(); return null; }
    if (!Number.isFinite(dt) || dt <= 0) return null;
    // A suspended browser can return one frame with minutes on its clock. Limit that single sample's weight;
    // continuous drawing at one frame a second (or slower) still lowers quality after enough slow frames.
    dt = Math.min(dt, 1);
    if (this.warmup > 0) { this.warmup -= dt; return null; }
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 8) return null;
    const slow = this.frames / this.elapsed < 28;
    this.elapsed = this.frames = 0;
    return slow ? 'low' : null;
  }
}
