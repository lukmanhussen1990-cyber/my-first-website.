// Neutral "photo studio" used by test scenes: sky-ish background, grass floor, sun + sky light,
// environment map for metal, and an orbit camera driven by URL/runtime params:
//   tx,ty,tz = look-at target, az (deg, 0 = camera on +Z looking at the subject's front), el (deg), dist, fov
import * as THREE from 'three';
import { makeEnvMap } from '../core/stage.js';
import { DEG } from '../core/util.js';

export function makeStudio(stage, params, { ground = true } = {}) {
  const { scene, renderer } = stage;
  scene.background = new THREE.Color(0xbfd9f2);
  scene.environment = makeEnvMap(renderer, {});
  scene.environmentIntensity = 0.9;
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x6f8f3a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(-4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 25 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  if (ground) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x9ccc3c, roughness: 1 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  }
  const cam = stage.camera;
  function updateCamera() {
    const p = params;
    const target = new THREE.Vector3(+(p.tx ?? 0), +(p.ty ?? 1), +(p.tz ?? 0));
    const az = +(p.az ?? 0) * DEG, el = +(p.el ?? 8) * DEG, dist = +(p.dist ?? 3.2);
    cam.fov = +(p.fov ?? 35);
    cam.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }
  return { hemi, sun, updateCamera };
}
