// FROZEN STUB SNAPSHOT (used by `node build.mjs --stubs`). Do not edit.
import * as THREE from 'three';

const COLORS = { xiahouen: 0x3a1010, yanming: 0x5a4020, zhanghe: 0x402050 };

export function createOfficerRig(ctx, id) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: COLORS[id] || 0x333333, emissive: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.05, 0.5), mat);
  body.position.y = 1.02; body.castShadow = true;
  const wpn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), new THREE.MeshLambertMaterial({ color: 0x999999 }));
  wpn.position.set(0.5, 1.1, 0.7);
  group.add(body, wpn);
  const tip = new THREE.Vector3(0, 0, 0.8);
  return {
    group, height: 2.1,
    pose(name, u, time, p = {}) {
      const lying = name === 'down' || name === 'dead';
      body.rotation.x = lying ? -Math.PI / 2 : name === 'air' ? (p.pitch || 0) : 0;
      body.position.y = lying ? 0.3 : 1.02;
      wpn.rotation.y = name.startsWith('atk') || name === 'special' ? Math.sin(u * Math.PI) * 1.5 : 0;
    },
    setFlash(k) { mat.emissive.setScalar(k * 0.8); },
    getWeaponTip(v) { return v.copy(tip).applyMatrix4(wpn.matrixWorld); },
  };
}
