// FROZEN STUB SNAPSHOT (used by `node build.mjs --stubs`). Do not edit.
import * as THREE from 'three';

export function createHeroRig(ctx) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xeef0ea, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.4), mat);
  body.position.y = 0.95; body.castShadow = true;
  const spearMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const spear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.8), spearMat);
  const pivot = new THREE.Group(); pivot.position.set(0.4, 1.1, 0); pivot.add(spear); spear.position.z = 0.8;
  group.add(body, pivot);
  const tip = new THREE.Vector3(0, 0, 2.2), base = new THREE.Vector3(0, 0, -0.6);
  return {
    group, height: 1.9,
    pose(name, u) {
      pivot.rotation.set(0, 0, 0);
      if (name[0] === 'N' || name[0] === 'C' || name.startsWith('MUSOU')) pivot.rotation.y = Math.sin(u * Math.PI) * 1.2;
      body.position.y = 0.95;
      if (name === 'knockdown' || name === 'defeat') { body.rotation.x = -Math.PI / 2; body.position.y = 0.3; } else body.rotation.x = 0;
    },
    getWeaponTip(v) { return v.copy(tip).applyMatrix4(spear.matrixWorld); },
    getWeaponBase(v) { return v.copy(base).applyMatrix4(spear.matrixWorld); },
    setFlash(k) { mat.emissive.setScalar(k * 0.8); },
    setMusouGlow(k) { mat.emissive.setRGB(k * 0.2, k * 0.6, k * 0.7); },
  };
}
