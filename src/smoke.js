// Smoke and haze as something that moves: puffs that leave the hazers and the stage, are carried down the hall by
// the air, rise a little because they are warm, spread out and thin away. Drawn as one batch of soft sprites that
// always face the camera. It replaces haze that merely hung in place.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, uniform, uv, varying, cameraPosition, vec2, length, smoothstep } from 'three/tsl';

// room: { W, D, H }; sources: where haze comes from, [[x, y, z], ...]; count: how many puffs there is room for, of
// which shown(n) lets n drift (the graphics setting; the rest are not drawn)
// wind: [x, z] metres a second, for the open air, where smoke does not stay
export function buildSmoke({ add, room: { W, D, H }, sources, count, wind: blow }) {
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3), info = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);   // info: size, how thick, a number of its own
  pos.setUsage(THREE.DynamicDrawUsage); info.setUsage(THREE.DynamicDrawUsage);
  const at = instancedBufferAttribute(pos), about = instancedBufferAttribute(info), uColor = uniform(new THREE.Color(0));
  const mat = new THREE.SpriteNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  mat.positionNode = at; mat.scaleNode = vec2(2.6, 2).mul(about.x); mat.rotationNode = about.z.mul(6.28);
  const soft = smoothstep(0, 1, length(uv().sub(0.5)).mul(2)).oneMinus();
  mat.colorNode = uColor.mul(soft).mul(soft).mul(varying(about.y.mul(smoothstep(1, 12, length(cameraPosition.sub(at))))));   // a puff right in front of the lens does not blot out the picture
  const mesh = add(new THREE.Sprite(mat)); mesh.count = count; mesh.frustumCulled = false; mesh.renderOrder = 2;
  let active = count;

  // the air in the room: a slow drift from the stage to the back (the fans behind the hazers), lazy swirls, and warm
  // haze rising until it spreads under the roof
  const wind = (p, t, out) => {
    out.x = Math.sin(p.z * 0.11 + t * 0.07) * 0.35 + Math.sin(p.y * 0.3 + t * 0.05) * 0.2;
    out.y = 0.16 * Math.max(0, 1 - p.y / (H * 0.8)) + Math.sin(p.x * 0.17 + t * 0.06) * 0.08;
    out.z = 0.45 + Math.sin(p.x * 0.13 + t * 0.05) * 0.3;
    if (blow) { const gust = 0.7 + 0.5 * Math.sin(t * 0.21 + p.z * 0.05); out.x += blow[0] * gust; out.z += blow[1] * gust; }
  };
  const puffs = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, age: 0, life: 1, size: 1, grow: 1, thick: 1, id: Math.random() }));
  const v = { x: 0, y: 0, z: 0 }, size = Math.max(W, D) / 55;
  // a new puff: out of a hazer, or (heavy: true) off the stage as on a drop
  function spawn(p, heavy, from) {
    const s = from || sources[Math.random() * sources.length | 0];
    p.x = s[0] + (Math.random() - 0.5) * (heavy ? 14 : 2); p.y = s[1] + Math.random() * (heavy ? 2.5 : 1); p.z = s[2] + Math.random() * 2;
    p.age = 0; p.life = (heavy ? 26 : 60) * (0.7 + Math.random() * 0.6); p.size = (heavy ? 2.5 : 1.5) * size; p.grow = (heavy ? 0.5 : 0.22) * size; p.thick = heavy ? 2.4 : 1;
  }
  for (const p of puffs) { spawn(p, false); p.age = Math.random() * p.life; p.x = (Math.random() - 0.5) * W * 0.9; p.y = 1 + Math.random() * (H - 2.5); p.z = (Math.random() - 0.5) * D * 0.9; p.size += p.age * p.grow; }   // the hall is already hazy when the night starts
  let next = 0;

  return {
    // a bank of smoke rolling off the stage, as with CO2 or on a drop
    burst(from, n = 14) { for (let i = 0; i < n; i++) { spawn(puffs[next], true, from); next = (next + 1) % active; } },
    shown(n) { active = mesh.count = Math.max(1, Math.min(count, n)); next %= active; },
    // colour: what the room is lit in, [r, g, b]; level: how bright; haze: how much the hazers put out (1 is normal)
    update(dt, t, colour, level, haze) {
      for (let i = 0; i < active; i++) {
        const p = puffs[i];
        p.age += dt * (haze < 1 ? 1 + (1 - haze) * 3 : 1);   // with the hazers turned down, the air clears sooner
        if (p.age > p.life || Math.abs(p.x) > W / 2 + (blow ? 30 : 0) || p.z > D / 2 + (blow ? 30 : 0)) spawn(p, false);
        wind(p, t, v);
        p.x += v.x * dt; p.y = Math.min(H - 1.2, p.y + v.y * dt); p.z += v.z * dt;
        const k = p.age / p.life, fade = Math.min(1, p.age / 4) * Math.min(1, (1 - k) * 3);
        pos.setXYZ(i, p.x, p.y, p.z); info.setXYZ(i, p.size + p.age * p.grow, fade * p.thick * Math.min(1.5, 0.4 + 0.6 * haze), p.id);
      }
      pos.needsUpdate = info.needsUpdate = true;
      uColor.value.setRGB(colour[0], colour[1], colour[2]).multiplyScalar(level);
    },
  };
}
