// A small techno track made from scratch, so the tests have music whose arrangement is known exactly.
import { RATE } from '../tools/hear.mjs';

// parts: [{ beats, kick, every, bass, roll, hats, pad, riser }]: kick on or off, or how hard it hits (1 is full); every: a
// kick only on every so many beats; bass: a bass note between the kicks, 0 to 1; roll: a bass note every three
// quarters of a beat (a line that runs at four notes to three beats), 0 to 1; hats and pad from 0 to 1; riser: a
// noise swell that grows over the part; pickup: hits as hard as the kick at these places in the part, counted in beats
// (14.3 is a third of the way into the fifteenth beat). Returns mono samples and the time each part starts.
export function track(bpm, parts) {
  const beat = 60 / bpm, total = parts.reduce((n, p) => n + p.beats, 0);
  const pcm = new Float32Array(Math.ceil(total * beat * RATE)), starts = [];
  let seed = 1;
  const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 31 - 1; };
  let at = 0, hp = 0, lastNoise = 0;
  for (const p of parts) {
    starts.push(at * beat);
    for (let b = 0; b < p.beats; b++, at++) {
      const from = Math.round(at * beat * RATE), len = Math.round(beat * RATE);
      for (let i = 0; i < len && from + i < pcm.length; i++) {
        const s = i / RATE, x = i / len;
        let v = 0;
        const hit = p.kick && (!p.every || b % p.every === 0) ? (p.kick === true ? 1 : p.kick) : 0;
        if (hit) v += Math.sin(2 * Math.PI * (55 * s + 20 * (1 - Math.exp(-s * 30)) / 30)) * Math.exp(-s * 9) * 0.8 * hit;
        for (const at of p.pickup || []) if (Math.floor(at) === b && x >= at % 1) { const u = s - (at % 1) * beat; v += Math.sin(2 * Math.PI * (55 * u + 20 * (1 - Math.exp(-u * 30)) / 30)) * Math.exp(-u * 9) * 0.8; }   // a hit between the beats
        if (p.bass && x >= 0.5) { const u = s - beat / 2; v += Math.sin(2 * Math.PI * 82 * u) * Math.exp(-u * 12) * 0.8 * p.bass; }
        if (p.roll) { const u = ((b + x) % 0.75) * beat; v += Math.sin(2 * Math.PI * (55 * u + 20 * (1 - Math.exp(-u * 30)) / 30)) * Math.exp(-u * 9) * 0.8 * p.roll; }
        const n = noise();
        hp = 0.85 * (hp + n - lastNoise); lastNoise = n;   // high-passed noise
        if (p.hats) v += hp * Math.exp(-((x + 0.5) % 1) * beat * 40) * 0.25 * p.hats;   // on the off-beat
        if (p.pad) v += (Math.sin(2 * Math.PI * 440 * (from + i) / RATE) + Math.sin(2 * Math.PI * 660 * (from + i) / RATE)) * 0.06 * p.pad;
        if (p.riser) v += hp * 0.3 * Math.pow((b + x) / p.beats, 2);
        pcm[from + i] = v;
      }
    }
  }
  return { pcm, starts, beat };
}
