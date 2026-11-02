// Small hand props for the bus reel: a PHONE (glowing screen) and a takeaway COFFEE cup.
//   prop.p = { visible, pos:[x,y,z], rot:[x,y,z] (Euler YXZ), scale }   (reset every frame)
import * as THREE from 'three';

export function buildHandheld(world) {
  const group = new THREE.Group(); group.name = 'handheld'; world.scene.add(group);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const phone = new THREE.Group(); phone.name = 'phone';
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.01), std({ color: '#1a1c22', roughness: 0.3 })); phone.add(b);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.135), std({ color: '#9fd0ff', emissive: '#6ab0ff', emissiveIntensity: 0.9 })); sc.position.z = 0.0055; phone.add(sc);
    phone.userData.grip = { pos: [0, -0.04, -0.01], axis: [1, 0, 0], up: [0, 0, 1] }; }
  const cup = new THREE.Group(); cup.name = 'cup';
  { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.13, 12), std({ color: '#f4efe6' })); cup.add(c);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.05, 12), std({ color: '#8a5a34' })); sl.position.y = -0.005; cup.add(sl);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12), std({ color: '#ffffff' })); lid.position.y = 0.072; cup.add(lid);
    cup.userData.grip = { pos: [0, -0.01, -0.04], axis: [0, 1, 0], up: [0, 0, 1] }; }
  group.add(phone, cup);
  const items = { phone, cup };
  const def = () => ({ visible: false, pos: [0, 0, 0], rot: [0, 0, 0], quat: null, scale: 1 });
  for (const it of Object.values(items)) it.p = def();
  const api = {
    group, ...items, items,
    reset() { for (const it of Object.values(items)) { it.p = def(); it.visible = false; } },
    place() {
      for (const it of Object.values(items)) {
        const p = it.p; it.visible = p.visible;
        if (!p.visible) continue;
        it.position.set(...p.pos);
        if (p.quat) it.quaternion.copy(p.quat); else it.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
        it.scale.setScalar(p.scale);
        it.updateMatrixWorld(true);
      }
    },
    commit() { api.place(); },
  };
  return api;
}
