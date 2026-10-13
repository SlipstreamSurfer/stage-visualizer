// Smoke as particles, for WebGPU only: hundreds of thousands of soft puffs that a program on the graphics card moves
// with the air and lights from the brightest beams, with the shadows of what stands in them. It is heavy (300,000
// take most of a mid-range card), so the show has it off unless asked; without it a beam is a cone of light.
import * as THREE from 'three/webgpu';
import { cameraPosition, Fn, instancedArray, instanceIndex, uniform, uniformArray, float, vec3, hash, deltaTime, Loop, If, mx_noise_vec3, dot, length, smoothstep, uv, select, pow } from 'three/tsl';

const NS = 6;   // how many things can throw a shadow
// lights: the world's beams (pos, dir, col, n); solids: [[x, y, z, radius], ...], what stands in the light
export function buildParticles({ renderer, add, count, room: { W, D, H }, stage, lights, solids }) {
  const vol = new THREE.Vector3(Math.min(W, 60), Math.min(H, 16), Math.min(D, 66)), centre = new THREE.Vector3(0, 0, Math.max(-D / 2, stage.back) + vol.z / 2);
  const positions = instancedArray(count, 'vec3'), light = instancedArray(count, 'vec3');
  const blockers = uniformArray(Array.from({ length: NS }, () => new THREE.Vector4(0, -1e4, 0, 1)));   // spheres in the light: centre and radius
  const uTime = uniform(0), ambient = uniform(new THREE.Vector3()), wind = uniform(new THREE.Vector3(0.2, 0.04, 0.45)), thick = uniform(1);
  const scatter = Fn(() => { const i = float(instanceIndex); positions.element(instanceIndex).assign(vec3(hash(i.mul(1.7)), hash(i.mul(3.1).add(5)), hash(i.mul(7.3).add(11))).sub(vec3(0.5, 0, 0.5)).mul(vec3(vol.x, vol.y, vol.z)).add(vec3(centre.x, 0, centre.z))); })().compute(count);
  const step = Fn(() => {
    const p = positions.element(instanceIndex);
    // the air: the curl of a noise field, so it turns but is never squeezed and the smoke does not clump
    const field = q => mx_noise_vec3(q.mul(0.11).add(vec3(0, 0, uTime.mul(0.04)))).add(mx_noise_vec3(q.mul(0.37).add(vec3(uTime.mul(0.09), 0, 0))).mul(0.35));
    const e = float(0.35);
    const dx = field(p.add(vec3(e, 0, 0))).sub(field(p.sub(vec3(e, 0, 0)))), dy = field(p.add(vec3(0, e, 0))).sub(field(p.sub(vec3(0, e, 0)))), dz = field(p.add(vec3(0, 0, e))).sub(field(p.sub(vec3(0, 0, e))));
    p.addAssign(vec3(dy.z.sub(dz.y), dz.x.sub(dx.z), dx.y.sub(dy.x)).div(e.mul(2)).mul(7).add(wind).mul(deltaTime));
    const hx = float(vol.x / 2), z0 = float(centre.z - vol.z / 2), z1 = float(centre.z + vol.z / 2);
    // A particle that leaves the air it lives in comes back somewhere else in it, at a place of its own. (Putting them
    // all back on the same wall or the same height makes a sheet of smoke, which then shows as bright strands.)
    If(p.x.greaterThan(hx).or(p.x.lessThan(hx.negate())).or(p.z.greaterThan(z1)).or(p.z.lessThan(z0)).or(p.y.greaterThan(vol.y)).or(p.y.lessThan(0)), () => {
      const r = float(instanceIndex).add(uTime.mul(60).floor());
      p.assign(vec3(hash(r.mul(1.3)).sub(0.5).mul(vol.x), hash(r.mul(2.9).add(3)).mul(vol.y), hash(r.mul(5.1).add(7)).mul(vol.z).add(z0)));
    });
    // the light a particle catches: inside which cones, how far from the lamp, and is something in the way
    const sum = vec3(ambient).toVar();
    Loop(lights.n, ({ i }) => {
      const toP = p.sub(lights.pos.element(i)), dist = length(toP), dir = toP.div(dist), edge = lights.dir.element(i).w;
      const inCone = smoothstep(edge, edge.add(float(1).sub(edge).mul(0.35)), dot(dir, lights.dir.element(i).xyz));
      If(inCone.greaterThan(0.001), () => {
        const clear = float(1).toVar();
        Loop(NS, ({ i: j }) => { const b = blockers.element(j), toB = b.xyz.sub(lights.pos.element(i)), along = dot(toB, dir); clear.mulAssign(select(along.greaterThan(0).and(along.lessThan(dist)), smoothstep(b.w.mul(0.85), b.w.mul(1.1), length(toB.sub(dir.mul(along)))), 1)); });
        sum.addAssign(lights.col.element(i).mul(inCone).mul(clear).div(dist.mul(0.09).add(1)));
      });
    });
    light.element(instanceIndex).assign(sum.mul(thick));
  })().compute(count);
  const smokeMat = new THREE.SpriteNodeMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  smokeMat.positionNode = positions.toAttribute();
  // Each particle is a soft puff rather than a grain, so a few hundred thousand of them fill a hall as haze does and a
  // beam through them is a shaft, not a string of dots. One right in front of the lens fades away.
  const puff = Math.max(0.3, Math.min(0.75, Math.cbrt(vol.x * vol.y * vol.z / count) * 1.55));
  smokeMat.scaleNode = float(puff).mul(float(1).add(hash(float(instanceIndex)).mul(0.9)));
  const nearFade = smoothstep(2.5, 14, length(cameraPosition.sub(positions.toAttribute())));
  // how bright one puff is: so that the same beam through the same air looks the same whatever the room and the number of particles
  smokeMat.colorNode = light.toAttribute().mul(pow(smoothstep(0.5, 0.0, length(uv().sub(0.5))), 2)).mul(nearFade).mul(0.5 * vol.x * vol.y * vol.z / (count * puff * puff));
const smoke = add(new THREE.Sprite(smokeMat)); smoke.count = count; smoke.frustumCulled = false;
  solids.slice(0, NS).forEach((b, i) => blockers.array[i].set(...b));
  const ready = renderer.computeAsync(scatter);
  // colour: what the room is lit in; level: how bright the room is; haze: how much the hazers put out
  return { ready, dispose() { scatter.dispose(); step.dispose(); }, update(t, colour, level, haze) { uTime.value = t; ambient.value.set(...colour).multiplyScalar(0.0012 + Math.min(1, level / 40) * 0.006); thick.value = Math.min(2, haze); renderer.compute(step); } };
}
