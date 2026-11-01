// STUB (replaced by the set agent). See CONTRACTS.md for the real API.
import * as THREE from 'three';
import { boxOnFloor, matNoisy, box } from './lib.js';
import { TABLE, ROOM } from './layout.js';
export function buildSet(world) {
  const g = new THREE.Group(); world.scene.add(g);
  const floor = box(6, 0.02, 5, matNoisy('#8a5a3a')); floor.position.y = -0.01; g.add(floor);
  const t = boxOnFloor(2.6, 0.76, 1.1, matNoisy('#e8dcc8')); g.add(t);
  for (let i = 0; i < 300; i++) { const b = boxOnFloor(0.1, 0.1, 0.1, matNoisy('#c08040')); b.position.set((i % 20) * 0.12 - 1.2, 0.76, Math.floor(i / 20) * 0.07 - 0.5); g.add(b); }
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(-1, 4, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 10 }); g.add(sun);
  g.add(new THREE.HemisphereLight(0xfff4e6, 0x6b4a30, 0.8));
  return { group: g, props: {}, colliders: [{ name: 'table', box: new THREE.Box3(new THREE.Vector3(TABLE.minX, 0.72, TABLE.minZ), new THREE.Vector3(TABLE.maxX, 0.76, TABLE.maxZ)) }],
    state: {}, reset() {}, commit() {} };
}
