// Reflections in the floor. A sealed concrete floor, as in a hall that is used for events, shows what gives light (the
// lenses, the beams in the haze, the LED along the frames and the trusses, the screen, the signs) as soft streaks that
// stretch towards whoever looks at them, stronger the flatter the floor is seen. The hall is drawn once more, mirrored
// in the floor, at a fraction of the picture's resolution and with only what gives light (GLOW_LAYER: people, steel
// and walls would only cost and show nothing), and that is added to the floor where nothing stands in front of it.
import * as THREE from 'three/webgpu';
import { reflector, screenUV, vec2, uniform, positionWorld, cameraPosition, normalize, abs, pow, mix } from 'three/tsl';

// the layer of everything that gives light, which is all the mirror draws
export const GLOW_LAYER = 1;

// rect: [x0, x1, z0, z1], the floor; y: its height
export function floorReflection({ add, rect: [x0, x1, z0, z1], y = 0 }) {
  const mirror = reflector({ resolutionScale: 0.25, generateMipmaps: true, bounces: false });
  mirror.target.rotateX(-Math.PI / 2); mirror.target.position.set(0, y, 0); add(mirror.target);
  const strength = uniform(3.5);
  // a streak: the reflection taken at a few points up and down the picture, as a rough floor smears a light towards
  // the eye, and blurred
  const at = screenUV.flipX(), taps = [-2, -1, 0, 1, 2].map(k => mirror.sample(at.add(vec2(0, k * 0.003))).blur(0.5));
  const streak = taps.reduce((sum, tap) => sum.add(tap)).div(taps.length);
  // how much the floor reflects: little seen from above, much more seen along it (Fresnel, for concrete under a sealer)
  const facing = abs(normalize(cameraPosition.sub(positionWorld)).y), reflects = mix(0.06, 0.65, pow(facing.oneMinus(), 4));
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  material.colorNode = streak.rgb.mul(reflects).mul(strength);
  const plane = add(new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y + 0.012, (z0 + z1) / 2), material));
  plane.renderOrder = 0.5;   // over the floor, under the beams and the haze
  let watched = null;
  return {
    // camera: the camera the picture is drawn with; its mirror image sees only what gives light
    watch(camera) { if (camera !== watched) { watched = camera; mirror.reflector.getVirtualCamera(camera).layers.set(GLOW_LAYER); } },
    // scale: the share of the picture's resolution the mirror is drawn at, 0 for no reflections at all
    set(scale) { plane.visible = scale > 0; if (scale > 0) mirror.reflector.resolutionScale = scale; },
  };
}

// Puts everything in the scene that gives light on GLOW_LAYER as well: whatever is drawn without being lit (a lens,
// a beam, an LED, a sign, a flare) gives light. (The reflection is hidden while the mirror draws.)
export function markGlowing(scene) {
  scene.traverse(o => {
    const m = o.material;
    if (m && !Array.isArray(m) && (m.isMeshBasicMaterial || m.isMeshBasicNodeMaterial || m.isSpriteNodeMaterial || m.isSpriteMaterial)) o.layers.enable(GLOW_LAYER);
  });
}
