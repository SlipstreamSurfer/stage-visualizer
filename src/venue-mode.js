// A venue can be inspected between gigs while the audio analysis keeps running.
// Override only the rig's output channels; the viewer's saved look and live source remain intact.
export function parkRig(things) {
  for (const { ch } of things) {
    for (const key of ['dim', 'flash', 'kick', 'pulse', 'dropStrength', 'energy', 'chase', 'lift']) ch[key] = 0;
    ch.fire = -100; ch.off = true;
    ch.pan = ch.tilt = ch.drop = ch.roll = 0;
    ch.hold = false;
  }
}
