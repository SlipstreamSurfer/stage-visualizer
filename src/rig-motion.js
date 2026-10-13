// Motion for large suspended assemblies in the visualizer. Metres, seconds; these are animation limits.
// Integrate in small steps so braking and reversals remain smooth when a rendered frame takes longer.
export function moveRig(state, target, dt, { speed, acceleration, maxDrop }) {
  target = Math.max(0, Math.min(maxDrop, target));
  let remaining = Math.max(0, Math.min(dt, 0.25));
  while (remaining > 1e-8) {
    const step = Math.min(remaining, 1 / 120), distance = target - state.drop;
    const desired = Math.abs(distance) < 0.0001 ? 0 : Math.sign(distance) * Math.min(speed, Math.sqrt(2 * acceleration * Math.abs(distance)) * 0.8);
    const before = state.velocity;
    state.velocity += Math.max(-acceleration * step, Math.min(acceleration * step, desired - before));
    state.drop += (before + state.velocity) * 0.5 * step;
    // Travel limits are separate from the requested stopping position.
    if (state.drop < 0 || state.drop > maxDrop) { state.drop = Math.max(0, Math.min(maxDrop, state.drop)); state.velocity = 0; }
    if (Math.abs(target - state.drop) < 0.0001 && state.velocity === 0) state.drop = target;
    remaining -= step;
  }
  return state;
}
