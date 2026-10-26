// 'enoch' set (STUB — the world track replaces this). Local coords; the group sits at SETS.enoch.
import * as THREE from 'three';
import { matte } from '../materials.js';

export function build(ctx) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), matte('#8a7350')); ground.receiveShadow = true; g.add(ground);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), matte('#c99a3a')); marker.position.y = 1; marker.castShadow = true; g.add(marker);
  return {
    group: g, persons: [],
    update(t, cam, shot, c, M) {},
    mood(t, shot, c) { return { post: { exposure: 1.0 } }; },
  };
}
