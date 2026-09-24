// STUB — World agent replaces the internals (keep the API from ARCHITECTURE.md).
import * as THREE from 'three';
import { ARENA, GATE } from '../config.js';

export function createWorld(ctx) {
  const { scene, quality } = ctx;
  scene.background = new THREE.Color(0xd8b596);
  scene.fog = new THREE.Fog(0xd0ab8c, 30, quality.drawDistance);
  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x6a5040, 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc58a, 2.2);
  sun.position.set(-30, 40, -20);
  sun.castShadow = !!quality.shadows;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const sc = sun.shadow.camera; sc.left = -35; sc.right = 35; sc.top = 35; sc.bottom = -35; sc.near = 1; sc.far = 150;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0xb8977a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(200, 12, 6), new THREE.MeshLambertMaterial({ color: 0x5b5048 }));
  wall.position.set(0, 6, ARENA.minZ - 3); scene.add(wall);
  const colliders = [{ minX: -100, maxX: 100, minZ: ARENA.minZ - 6, maxZ: ARENA.minZ }];
  const tmp = new THREE.Vector3();
  return {
    sun, colliders,
    bounds: { ...ARENA },
    spawnPoints: {
      north: [{ x: 0, z: -110 }, { x: -30, z: -105 }, { x: 30, z: -105 }],
      west: [{ x: -75, z: -40 }, { x: -75, z: 10 }],
      east: [{ x: 75, z: -40 }, { x: 75, z: 10 }],
      south: [{ x: -20, z: 65 }, { x: 20, z: 65 }],
    },
    gate: { x: GATE.x, z: GATE.z, open() {} },
    minimapFeatures: [{ type: 'wall', x: 0, z: ARENA.minZ - 3, w: 200, h: 6, rot: 0 }, { type: 'gate', x: 0, z: ARENA.minZ, w: 10, h: 4, rot: 0 }],
    update(dt, time, focus) {
      if (!focus) return;
      tmp.set(-30, 40, -20).add(focus);
      sun.position.copy(tmp); sun.target.position.copy(focus);
    },
    setMusouTint() {},
  };
}
