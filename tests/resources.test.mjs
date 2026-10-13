import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.webgpu.js';
import { disposeScene } from '../src/resources.js';

const disposals = resource => {
  const counter = { count: 0 }; resource.addEventListener('dispose', () => counter.count++); return counter;
};
test('replacing a venue releases its geometry, instancing, materials and node textures once', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const material = new THREE.MeshBasicNodeMaterial(); material.colorNode = THREE.TSL.texture(map);
  const instance = new THREE.InstancedMesh(geometry, material, 2);
  const counts = [geometry, material, map, instance].map(disposals);
  scene.add(instance, new THREE.Mesh(geometry, material));
  disposeScene(scene);
  assert.deepEqual(counts.map(c => c.count), [1, 1, 1, 1]);
  assert.equal(scene.children.length, 0);
});
test('shared library materials and textures, and the viewer’s screen media, survive a venue change', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry();
  const tile = new THREE.DataTexture(), media = new THREE.DataTexture(), sharedMaterial = new THREE.MeshBasicMaterial();
  tile.userData.shared = true; sharedMaterial.userData.shared = true;
  const tiled = new THREE.MeshBasicMaterial({ map: tile }), screen = new THREE.MeshBasicMaterial({ map: media });
  const kept = [tile, media, sharedMaterial].map(disposals), released = [tiled, screen].map(disposals);
  scene.add(new THREE.Mesh(geometry, tiled), new THREE.Mesh(geometry, screen), new THREE.Mesh(geometry, sharedMaterial));
  disposeScene(scene, [media]);
  assert.deepEqual(kept.map(c => c.count), [0, 0, 0]);
  assert.deepEqual(released.map(c => c.count), [1, 1]);
});
