// Release a replaced venue, keeping the small shared tile library and the viewer's media.
export function disposeScene(scene, retainedTextures = []) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), nodes = new Set();
  const retain = new Set(retainedTextures);
  const collect = node => {
    if (!node?.isNode || nodes.has(node)) return;
    nodes.add(node);
    if (node.value?.isTexture) textures.add(node.value);
    for (const child of node.getChildren()) collect(child);
  };
  scene.traverse(object => {
    if (object.geometry && !object.isSprite) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material || material.userData.shared) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
        else collect(value);
      }
      for (const texture of material.userData.textures || []) textures.add(texture);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) if (!texture.userData.shared && !retain.has(texture)) texture.dispose();
  scene.clear();
}

// Compile everything a venue can show before it is shown, also what is hidden until it is used (CO2, sparks and
// flames that fire at the drop, a laser that switches on, a camera's view behind the one now, the phones in the
// crowd, the sun through the roof). The card compiles a material the first time it draws it, and the picture stops
// until it is done: measured, a fifth of a second on the drop, and eight frames of a tenth when the sun came out.
// Only for a scene that is not on screen yet: for the moment of compiling everything is visible, except the lights,
// which stay as they are (a light switched on only for this would compile every lit material for a light the show
// never has).
//   draw(scene): draws it once into the scene pass, the way a frame does. three r186 keeps its programs per level of
//                drawing, and a frame draws the scene a level down, inside the glow and finish: what is compiled at
//                the top level (compileAsync) is made again there. So the draw is what makes the programs the
//                frames use (measured: without it every one of them was made again in the first frame, and what was
//                hidden then, the sun through the roof or the phones, when it first showed).
//   target:      what the scene pass draws into
//   background:  a show is on screen meanwhile (a venue change): the shader code is compiled first without stopping
//                its picture, so the draw has little left to do. Without a show it only costs time.
export async function warmScene(renderer, scene, camera, { draw = null, target = null, background = false } = {}) {
  const changed = [], lit = new Set();
  scene.traverseVisible(object => { if (object.isLight) lit.add(object); });
  scene.traverse(object => {
    changed.push([object, object.visible, object.frustumCulled, object.count]);
    object.visible = object.isLight ? lit.has(object) : true; object.frustumCulled = false;
    if (object.isInstancedMesh && object.count === 0) object.count = 1;
  });
  try {
    if (background || !draw) {   // the target is read when the compile starts, before its first pause
      const before = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const compiled = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(before);
      await compiled;
    }
    draw?.(scene);
  } finally { for (const [object, visible, culled, count] of changed) { object.visible = visible; object.frustumCulled = culled; if (count !== undefined) object.count = count; } }
}
