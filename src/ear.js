// The ear: turns sound into what the Listener is fed, on the sound's own clock. Sixty times in every second of
// sound, whatever the picture does: a screen that draws 50, 75 or 144 frames a second, or stutters, hears exactly the
// same as any other, and a recording replayed is heard exactly as it was live. (It used to be once per picture
// frame, and what the show heard then depended on when the frames fell.)
//
// A step is a spectrum of the last 2048 samples, as a browser's AnalyserNode makes it (Blackman window, magnitude
// over N, smoothed a little over time), reduced to three bands and the loudness of the waveform.
export const STEPS = 60;   // steps in a second of sound
const N = 2048;
const win = Float64Array.from({ length: N }, (_, n) => 0.42 - 0.5 * Math.cos(2 * Math.PI * n / N) + 0.08 * Math.cos(4 * Math.PI * n / N));
const bits = Math.log2(N), rev = new Uint32Array(N), cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }

export class Ear {
  // rate: samples a second
  constructor(rate) {
    this.rate = rate; this.every = rate / STEPS; this.next = this.every; this.count = 0;
    this.last = new Float32Array(N);   // the last N samples, as a ring
    this.re = new Float64Array(N); this.im = new Float64Array(N); this.smooth = new Float64Array(N / 2);
  }
  // seconds of sound heard so far
  get t() { return this.count / this.rate; }
  band(lo, hi) {
    const hz = this.rate / N, a = Math.max(1, Math.floor(lo / hz)), b = Math.min(N / 2 - 1, Math.ceil(hi / hz)), s = this.smooth;
    let p = 0;
    for (let i = a; i <= b; i++) p += s[i] * s[i];
    return Math.sqrt(p / (b - a + 1));
  }
  spectrum() {
    const { last, re, im, smooth, count } = this;
    let power = 0;
    for (let i = 0; i < N; i++) { const x = last[(count + i) % N]; power += x * x; re[rev[i]] = x * win[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= N; size <<= 1) for (let i = 0, half = size >> 1, step = N / size; i < N; i += size) for (let j = 0; j < half; j++) {
      const c = cosT[j * step], s = sinT[j * step], a = i + j, b = a + half;
      const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
    for (let k = 0; k < N / 2; k++) smooth[k] = 0.05 * smooth[k] + 0.95 * Math.hypot(re[k], im[k]) / N;
    return Math.sqrt(power / N);
  }
  // samples[from..to): new sound, in order. step(bands, rms) is called for every step that completes:
  // bands is [bass 35-170 Hz, mid 250-3000 Hz, high 4000-14000 Hz], rms the loudness of the waveform.
  push(samples, from, to, step) {
    for (let i = from; i < to; i++) {
      this.last[this.count % N] = samples[i]; this.count++;
      if (this.count >= this.next) { this.next += this.every; const rms = this.spectrum(); step([this.band(35, 170), this.band(250, 3000), this.band(4000, 14000)], rms); }
    }
  }
}
