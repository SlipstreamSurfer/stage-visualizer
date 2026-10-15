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
// flames that fire at the drop, a laser that switches on, a camera's view behind the one now). The card compiles a
// material the first time it draws it, and the picture stops until it is done: measured, a fifth of a second, on
// the drop. Only for a scene that is not on screen yet: for the moment of compiling everything is visible.
export async function warmScene(renderer, scene, camera) {
  const changed = [];
  scene.traverse(object => {
    changed.push([object, object.visible, object.frustumCulled, object.count]);
    object.visible = true; object.frustumCulled = false;
    if (object.isInstancedMesh && object.count === 0) object.count = 1;
  });
  try { await renderer.compileAsync(scene, camera); }
  finally { for (const [object, visible, culled, count] of changed) { object.visible = visible; object.frustumCulled = culled; if (count !== undefined) object.count = count; } }
}
