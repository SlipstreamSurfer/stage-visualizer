// Layout: turns a venue description into the list of things that stand and hang in it. Pure arithmetic, so it runs
// in the tests as well as in the page.
//
// A venue description (see venues/) has:
//   plan    { width, depth, height, shape }: the room. x runs across, z along, y is up. shape: 'box', or 'round' for
//           a circle or an oval. height is to the eaves; a roof may rise above it (shell.roof).
//   stage   { width, depth, height, kind, round, performer, ... }: see stage.js. kind 'end' (the default) stands
//           against the far (-z) wall, 'centre' in the middle of the room with the crowd all round it.
//   shell   what the place is made of and what is around it: see shell.js
//   rig     a list of
//             { line: [[x, y, z], [x, y, z]], truss: true | false, moves: true | false, hang: [{ type, count, role, inset, props }] }
//               fixtures spread evenly along a line, with or without a truss drawn along it. A truss that moves
//               hangs on winches: it and everything on it can be lowered and tilted (role truss).
//             { at: [x, y, z], type, role, props }      one thing on its own
//               A moving ring truss has moves, id and ring props. Later items with mount: id move with it.
//   crowd   { count, seated, pitch, rake, chair }: how many people; standing, or seated in rows (pitch: metres from
//           row to row, rake: how far the floor rises to the back)
//   kind, genres, mood   which list it goes in, the genres it suits (keys of the director's MOODS), and the one it
//           starts in
//   facilities, walkers, capacity   bars, exits and so on; parked for now: see facilities.js
// role says what a fixture is for (overhead, stage, wash, strobe, blinder, bars, laser, wall, co2, hazer, glow ...).
// The director addresses roles, never single fixtures, which is why one show plays in any venue.

// the line of a vault across its span: part of a circle, or two arcs meeting in a point
export function vaultProfile(span, H, rise, pointed, n = 28) {
  const pts = [];
  if (!pointed) {
    const R = (span * span / 4 + rise * rise) / (2 * rise), cy = H + rise - R, a0 = Math.asin(Math.min(1, span / 2 / R)) + (rise > span / 2 ? Math.PI - 2 * Math.asin(Math.min(1, span / 2 / R)) : 0);
    for (let i = 0; i <= n; i++) { const a = -a0 + 2 * a0 * i / n; pts.push([R * Math.sin(a), cy + R * Math.cos(a)]); }
  } else {
    const cx = (rise * rise - span * span / 4) / span, r = cx + span / 2, top = Math.atan2(rise, -cx), m = n >> 1;
    for (let i = 0; i <= m; i++) { const a = Math.PI - (Math.PI - top) * i / m; pts.push([cx + r * Math.cos(a), H + r * Math.sin(a)]); }
    for (let i = m - 1; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]);
  }
  return pts;
}

// how high a line across is at x
export function heightAt(profile, x) {
  for (let i = 0; i + 1 < profile.length; i++) { const [a, ay] = profile[i], [b, by] = profile[i + 1]; if (x >= Math.min(a, b) && x <= Math.max(a, b) && a !== b) return ay + (by - ay) * (x - a) / (b - a); }
  return profile[x < profile[0][0] ? 0 : profile.length - 1][1];
}
// a big top's canvas from its edge (0) to its point (1): [how far in, how high]
const TENT = [[0, 0], [0.38, 0.42], [0.7, 0.78], [0.9, 0.95], [0.988, 1]];

export function layout(venue) {
  const { width: W, depth: D, height: H, shape = 'box' } = venue.plan, sv = venue.stage, kind = sv.kind || 'end', crowd = venue.crowd || { count: 0 };
  // how far the roof rises above the eaves
  const roof = typeof venue.shell?.roof === 'object' ? venue.shell.roof : { type: venue.shell?.roof || 'flat' };
  const rise = roof.type === 'vault' || roof.type === 'dome' ? roof.rise ?? (roof.span || W) / 2 : roof.type === 'cone' ? roof.rise ?? W / 10 : roof.type === 'tent' ? roof.rise ?? 10 : roof.type === 'gable' || roof.type === 'glass' ? roof.rise ?? W / 4 : roof.type === 'sawtooth' ? roof.rise ?? 2.4 : 0;
  // how high the roof is over (x, z)
  const span = roof.span || W, line = roof.type === 'vault' ? vaultProfile(span, H, rise, roof.pointed) : roof.type === 'gable' || roof.type === 'glass' ? [[-span / 2, H], [0, H + rise], [span / 2, H]] : null;
  const ceil = line ? x => Math.abs(x) <= span / 2 ? heightAt(line, x) : H
    : roof.type === 'dome' ? (x, zz) => H + rise * Math.sqrt(Math.max(0, 1 - (x / (W / 2)) ** 2 - (zz / (D / 2)) ** 2))
    : roof.type === 'cone' ? (x, zz) => H + rise * Math.max(0, Math.min(1, (1 - Math.hypot(x / (W / 2), zz / (D / 2))) / (1 - (roof.top ?? 0))))
    : roof.type === 'tent' ? (x, zz) => H + rise * heightAt(TENT, 1 - Math.min(1, Math.hypot(x / (W / 2), zz / (D / 2)))) : () => H;
  const z = sv.z ?? (kind === 'end' ? -D / 2 + sv.depth / 2 : 0);   // the middle of the stage
  const stage = { ...sv, kind, z, back: z - sv.depth / 2, front: z + sv.depth / 2 };
  const things = [], trusses = [], fixedTrusses = [], movers = [], rows = {}, mounts = new Map();
  const mountOf = item => {
    if (item.mount === undefined) return undefined;
    if (!mounts.has(item.mount)) throw new Error(`Unknown rig mount: ${item.mount}`);
    return mounts.get(item.mount);
  };
  for (const item of venue.rig) {
    if (item.at) {
      let mover;
      if (item.type === 'truss' && item.moves) {
        mover = movers.length; movers.push({ pos: item.at, props: item.props }); mounts.set(item.id, mover);
      }
      things.push({ type: item.type, role: item.role, pos: item.at, props: item.props || {}, mount: mountOf(item), mover, u: 0.5, row: (rows[item.role] = (rows[item.role] ?? -1) + 1) }); continue;
    }
    const [a, b] = item.line;
    let mount = mountOf(item);
    if (item.truss && item.moves) {
      mount = movers.length; movers.push([a, b]);
      things.push({ type: 'truss', role: 'truss', mover: mount, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], props: item.props || {}, u: 0.5, row: (rows.truss = (rows.truss ?? -1) + 1) });
    } else if (item.truss) { trusses.push([a, b]); if (mount === undefined) fixedTrusses.push([a, b]); }
    for (const h of item.hang) {
      const row = rows[h.role] = (rows[h.role] ?? -1) + 1, inset = h.inset ?? 0.06;
      for (let i = 0; i < h.count; i++) {
        const u = h.count === 1 ? 0.5 : i / (h.count - 1), k = inset + u * (1 - 2 * inset);
        things.push({
          type: h.type, role: h.role, props: h.props || {}, u, row, mount,
          pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + (h.dy || 0), a[2] + (b[2] - a[2]) * k],
        });
      }
    }
  }
  for (const [role, n] of Object.entries(rows)) for (const th of things) if (th.role === role) th.rows = n + 1;
  for (const th of things) th.xn = th.pos[0] / (W / 2);   // -1 at the left wall, 1 at the right
  // the room as a shape: is (x, z) inside it, m metres from the wall?
  const inside = shape === 'round' ? (x, zz, m = 0) => (x / (W / 2 - m)) ** 2 + (zz / (D / 2 - m)) ** 2 < 1 : (x, zz, m = 0) => Math.abs(x) < W / 2 - m && Math.abs(zz) < D / 2 - m;
  const onStage = (x, zz, m = 0) => sv.round ? Math.hypot(x, zz - z) < sv.width / 2 + m : Math.abs(x) < sv.width / 2 + m && zz > stage.back - m && zz < stage.front + m;
  // where the crowd is: from the pit in front of an end stage to the back wall, or the whole room round a centre stage
  const floor = { x0: -W / 2 + 1.5, x1: W / 2 - 1.5, z0: kind === 'end' ? stage.front + (crowd.seated ? 3.2 : 2.5) : -D / 2 + 1.5, z1: D / 2 - 2, ...crowd.floor };
  // how far the floor has risen at (x, z): seats in rows may be raked
  const rake = crowd.rake || 0, ground = (x, zz) => rake * Math.max(0, Math.min(1, (zz - floor.z0) / (floor.z1 - floor.z0)));
  // where whoever plays stands: what the cameras look at
  const focus = [0, stage.height + 1.5, kind === 'end' ? stage.front - Math.min(2.4, stage.depth * 0.42) : z];
  return { name: venue.name, kind: venue.kind || 'Halls', genres: venue.genres || [], mood: venue.mood || venue.genres?.[0], plan: { W, D, H, shape, rise }, roof: line, ceil, stage, floor, focus, inside, onStage, ground, things, trusses, fixedTrusses, movers,
    facilities: venue.facilities || [], capacity: venue.capacity, walkers: venue.walkers || 0, walkPath: venue.walkPath, crowd, shell: venue.shell || {} };
}

// everything of one role, in order
export const byRole = things => things.reduce((groups, th) => ((groups[th.role] ||= []).push(th), groups), {});
