// Hangar's visual identity is independent of its musical mood and timing source.
export const SHOW_THEMES = {
  industrial: { name: 'Industrial', visual: 1, colors: [0xe8efff, 0xff9a38, 0xb82d20],
    description: 'Geometric lines, white and amber, alternating arch groups.',
    arch: 2, laser: 0, laserLevel: 0.85 },
  hypnotic: { name: 'Hypnotic', visual: 2, colors: [0x3258ff, 0x22c8d0, 0x8050e8],
    description: 'Slow concentric motion, blue and violet, a wave through the arches.',
    arch: 3, laser: 2, laserLevel: 0.65 },
  melodic: { name: 'Melodic', visual: 3, colors: [0x4b78e8, 0xffa965, 0xd76aa8],
    description: 'Flowing light ribbons, warm accents, arches answering the stage.',
    arch: 1, laser: 1, laserLevel: 0.75 },
};
export const normalizeTheme = key => Object.hasOwn(SHOW_THEMES, key) ? key : 'auto';

// Smooth weights keep every switch, including a reversal halfway through, continuous.
export function blendTheme(weights, visual, dt) {
  const ease = 1 - Math.exp(-Math.max(0, Math.min(0.25, dt)) / 1.8);
  for (let i = 0; i < 3; i++) weights[i] += ((visual === i + 1 ? 1 : 0) - weights[i]) * ease;
  return weights;
}
