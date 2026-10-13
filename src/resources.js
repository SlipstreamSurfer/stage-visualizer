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
