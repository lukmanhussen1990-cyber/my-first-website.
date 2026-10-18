// Knight + sword test scene.
// params: pose = sit_grip | sit_rest | stand_down | lower (u = 0..1 sitGrip -> sitRest with re-grip)
//         grip = 0..1 (fist tension), cape = 0 to hide, rock = 0 to hide, plus studio camera params.
import * as THREE from 'three';
import { Humanoid } from '../core/rig.js';
import { makeStudio } from './studio_lib.js';
import { rng, clamp, smoothstep } from '../core/util.js';
import { buildKnight, POSES, swordPose, solveSwordHands, plantFeet, swordLowerPose } from '../characters/knight.js';

function placeholderRock() {
  // faceted purple-grey boulder, ~0.75 m wide, flat-ish seat top at y = 0.48
  // stays inside the knight's default cape collider (rTop 0.36, rBottom 0.48, depth 0.95)
  const g = new THREE.CylinderGeometry(0.35, 0.47, 0.48, 9, 3);
  const p = g.attributes.position, r = rng(31);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.24, x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 0.93 + 0.04 * Math.sin(a * 3 + 1) + 0.03 * Math.sin(a * 5) - (y > 0.47 ? 0.07 : 0);
    p.setXYZ(i, x * k, y > 0.47 ? 0.48 : y, z * k * 0.93);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g.toNonIndexed(), new THREE.MeshStandardMaterial({ color: 0x8a7f96, roughness: 0.95, flatShading: true }));
  m.geometry.computeVertexNormals();
  m.castShadow = m.receiveShadow = true;
  m.position.set(0, 0, 0);
  return m;
}

export async function build(stage, params) {
  const studio = makeStudio(stage, params);
  stage.renderer.shadowMap.enabled = true;
  studio.sun.shadow.mapSize.set(2048, 2048);
  Object.assign(studio.sun.shadow.camera, { left: -1.6, right: 1.6, top: 2.2, bottom: -1.0 });
  studio.sun.shadow.camera.updateProjectionMatrix();
  const knight = buildKnight();
  stage.scene.add(knight.root);
  stage.scene.add(knight.sword);
  const rock = placeholderRock();
  stage.scene.add(rock);
  // rim light from behind for armour silhouettes
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.2); rim.position.set(2, 3, -4); stage.scene.add(rim);
  const st = knight.stats();
  console.log(`knight stats: ${st.triangles} tris, ${st.meshes} meshes (+sword)`);
  let logged = false;
  return {
    duration: 4, knight,
    update(t) {
      const pose = params.pose || 'sit_grip';
      const grip = +(params.grip ?? 0.4);
      const seated = pose !== 'stand_down';
      rock.visible = seated && params.rock !== '0';
      knight.cape.mesh.visible = params.cape !== '0';
      knight.sword.visible = params.sword !== '0';
      // breathing / idle so the time axis does something
      const br = Math.sin(t * 1.6) * 0.6;
      if (pose === 'sit_grip') {
        knight.rig.applyPose(Humanoid.compile(POSES.seated));
        knight.rig.addRot('chest', br * 0.5);
        plantFeet(knight);
        const sp = swordPose(knight, 'sitGrip');
        solveSwordHands(knight, sp.position, sp.quaternion, { left: 'knee', grip: 'forward' });
        knight.rig.lookAt(knight.rig.pointToWorld(new THREE.Vector3(-0.2, 1.3, 3)), 0.5);
      } else if (pose === 'sit_rest') {
        knight.rig.applyPose(Humanoid.compile(POSES.seatedRelaxed));
        knight.rig.addRot('chest', br * 0.4);
        plantFeet(knight);
        const sp = swordPose(knight, 'sitRest');
        solveSwordHands(knight, sp.position, sp.quaternion, { left: 'pommel', grip: 'reverse' });
      } else if (pose === 'lower') {
        const u = clamp(+(params.u ?? 0.5), 0, 1);
        knight.rig.applyPose(Humanoid.compile(POSES.seated));
        const sp0 = swordLowerPose(knight, u);
        knight.rig.applyPose(Humanoid.blend([[Humanoid.compile(POSES.seated), 1 - sp0.relax], [Humanoid.compile(POSES.seatedRelaxed), sp0.relax]]));
        plantFeet(knight);
        const sp = swordLowerPose(knight, u);
        solveSwordHands(knight, sp.position, sp.quaternion, { left: sp.left, grip: sp.grip });
      } else { // stand_down
        knight.rig.applyPose(Humanoid.compile(POSES.stand));
        knight.rig.addRot('chest', br * 0.3);
        const sp = swordPose(knight, 'standDown');
        solveSwordHands(knight, sp.position, sp.quaternion, { left: 'free', grip: 'reverse' });
      }
      knight.update(t, { grip, seated });
      studio.updateCamera();
      if (!logged) { logged = true; }
    },
  };
}
