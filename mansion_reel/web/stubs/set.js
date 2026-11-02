// STUB set: flat floor + sun + hemi, same API as set.js (used when ?use= excludes 'set').
import * as THREE from 'three';
import { matNoisy, mesh } from '../lib.js';
import { SUN, SKY } from '../layout.js';
export function buildSet(world) {
  const g = new THREE.Group(); world.scene.add(g);
  world.scene.background = new THREE.Color(SKY.mid);
  const floor = mesh(new THREE.PlaneGeometry(400, 400), matNoisy('#7a7570')); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 80 }); g.add(sun); g.add(sun.target);
  g.add(new THREE.HemisphereLight('#ffe2c8', '#3a3530', 1.4));
  const state = { center: [0, 1, 0] };
  return { group: g, colliders: [], props: {}, anchors: {}, state,
    reset(t) { state.center = [0, 1, 0]; },
    commit(ctx) { const c = new THREE.Vector3(...state.center); const d = new THREE.Vector3(...SUN.dir).normalize();
      sun.position.copy(c).addScaledVector(d, 30); sun.target.position.copy(c); sun.target.updateMatrixWorld(); floor.position.y = state.floorY ?? 0; } };
}
