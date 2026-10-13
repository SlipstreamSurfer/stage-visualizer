// Intersect a mirror-ball ray with the hall. H is the highest point of the roof, not its eaves.
// Return the surface normal as well: spots should lie on sloping roofs and curved walls.
export function reflectionHit({ W, D, H, round, ceil }, [bx, by, bz], [dx, dy, dz]) {
  let tx = dx > 0 ? (W / 2 - bx) / dx : dx < 0 ? (-W / 2 - bx) / dx : Infinity;
  let tz = dz > 0 ? (D / 2 - bz) / dz : dz < 0 ? (-D / 2 - bz) / dz : Infinity;
  if (round) {
    const ax = dx / (W / 2), az = dz / (D / 2), qx = bx / (W / 2), qz = bz / (D / 2);
    const a = ax * ax + az * az, b = ax * qx + az * qz;
    tx = tz = a > 1e-12 ? (-b + Math.sqrt(Math.max(0, b * b - a * (qx * qx + qz * qz - 1)))) / a : Infinity;
  }
  const floorDistance = dy < 0 ? -by / dy : Infinity;
  let roofDistance = Infinity;
  {
    // Even a horizontal or slightly downward ray can meet a roof that slopes down faster.
    const far = Math.min(tx, tz, floorDistance, dy > 0 ? (H - by) / dy : Infinity);
    const above = q => by + dy * q - ceil(bx + dx * q, bz + dz * q);
    let lo = 0, hi = far;
    // Find the first crossing, including roofs with several peaks.
    for (let j = 1; j <= 16; j++) {
      hi = far * j / 16;
      if (above(hi) >= 0) break;
      lo = hi;
    }
    if (above(hi) >= 0) {
      for (let j = 0; j < 16; j++) {
        const mid = (lo + hi) / 2;
        if (above(mid) >= 0) hi = mid; else lo = mid;
      }
      roofDistance = (lo + hi) / 2;
    }
  }
  const ty = Math.min(floorDistance, roofDistance);
  const distance = Math.min(tx, ty, tz), position = [bx + dx * distance, by + dy * distance, bz + dz * distance];
  const [x, , z] = position;
  let normal, surface;
  if (distance === ty) {
    surface = distance === roofDistance ? 'roof' : 'floor';
    const e = 0.01;
    normal = surface === 'roof' ? [(ceil(x + e, z) - ceil(x - e, z)) / (2 * e), -1, (ceil(x, z + e) - ceil(x, z - e)) / (2 * e)] : [0, 1, 0];
  } else {
    surface = 'wall';
    normal = round ? [-x / (W * W), 0, -z / (D * D)] : distance === tx ? [-Math.sign(dx), 0, 0] : [0, 0, -Math.sign(dz)];
  }
  const length = Math.hypot(...normal);
  return { position, normal: normal.map(n => n / length), distance, surface };
}
