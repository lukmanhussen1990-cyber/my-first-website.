// Rig sanity scene: draws the bare Humanoid skeleton in a standing or sitting pose with IK.
// params: pose=stand|sit
import * as THREE from 'three';
import { Humanoid } from '../core/rig.js';
import { makeStudio } from './studio_lib.js';

export async function build(stage, params) {
  const studio = makeStudio(stage, params);
  const rig = new Humanoid();
  stage.scene.add(rig.root);
  const m = new THREE.MeshStandardMaterial({ color: 0xcc8844 });
  for (const [name, bone] of Object.entries(rig.b)) {
    const child = bone.children.find((c) => rig.b[c.name]);
    const len = child ? child.position.length() : 0.1;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), m);
    box.position.y = -len / 2;
    if (['hips', 'spine', 'chest', 'neck', 'head'].includes(name)) box.position.y = len / 2;
    box.castShadow = true;
    bone.add(box);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0x777788 }));
  seat.position.set(0, 0.225, -0.05); seat.visible = false; stage.scene.add(seat);
  return {
    duration: 2,
    update(t) {
      studio.updateCamera();
      const sit = params.pose === 'sit';
      seat.visible = sit;
      rig.applyPose(Humanoid.compile(sit ? { hipsPos: [0, 0.55, 0], spine: [-6, 0, 0] } : {}));
      if (sit) {
        rig.legIK('L', rig.pointToWorld(new THREE.Vector3(0.14, 0.08, 0.42)));
        rig.legIK('R', rig.pointToWorld(new THREE.Vector3(-0.14, 0.08, 0.42)));
        rig.armIK('R', rig.pointToWorld(new THREE.Vector3(-0.22, 0.75, 0.38)));
        rig.armIK('L', rig.pointToWorld(new THREE.Vector3(0.2, 0.62, 0.3)));
      }
      rig.lookAt(new THREE.Vector3(1, 1.4, 1), 0.7);
    },
  };
}
