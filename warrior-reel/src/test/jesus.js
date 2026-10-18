// Jesus test scene. params:
//   pose = stand | walk | sit | gesture | face | film
//     face = standing close-up preset (ty 1.635, dist 0.7, fov 30)
//     film = replays film.js's Jesus blocking (walk-in, stop, sit, gestures, ending) at film time t, with a
//            stand-in knight (grey capsule) so transitions can be checked without the other modules.
//   g = openPalm | handOnHeart | welcome            (gesture pose; seated unless base=stand)
//   mouth (0..1, or "talk" = animated), blink (0..1), smile, brow, eyeYaw, eyePitch, look (x,y,z world look target)
//   move=1 (walk: translate the root forward at 1.24 m per cycle)
// walk: walkPhase = t (one stride cycle per second of t).
import * as THREE from 'three';
import { Humanoid, quatFromBasis } from '../core/rig.js';
import { noise1, clamp, lerp, smoothstep, easeInOut, DEG } from '../core/util.js';
import { makeStudio } from './studio_lib.js';
import * as J from '../characters/jesus.js';

const ARM_R = ['shoulderR', 'upperArmR', 'foreArmR', 'handR'];
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const win = (t, a, b, ra = 0.4, rb = 0.4) => Math.min(smoothstep(a, a + ra, t), 1 - smoothstep(b - rb, b, t));
function quatDirFace(dir, face) {
  const y = dir.clone().normalize();
  const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return quatFromBasis(x, y, z);
}

export async function build(stage, params) {
  if (params.pose === 'face') {
    params.ty ??= '1.635'; params.dist ??= '0.7'; params.fov ??= '30'; params.el ??= '2';
  }
  const studio = makeStudio(stage, params);
  const jesus = J.buildJesus();
  stage.scene.add(jesus.root);
  // placeholder seat, top at y = 0.44 (centre slightly behind the root like film.js: root is 0.07 in front of the rock)
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x7c7690, roughness: 0.95, flatShading: true });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.44, 9), seatMat);
  seat.position.set(0, 0.22, -0.07);
  seat.castShadow = seat.receiveShadow = true;
  stage.scene.add(seat);
  const P = Object.fromEntries(Object.entries(J.POSES).map(([k, v]) => [k, Humanoid.compile(v)]));

  // film replay data
  let tl = null, knightStub = null;
  if (params.pose === 'film') {
    tl = await (await fetch('/timeline/timeline.json', { cache: 'no-store' })).json();
    knightStub = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), new THREE.MeshStandardMaterial({ color: 0x8a8c94, metalness: 0.6, roughness: 0.4 }));
    body.position.y = 0.8; body.castShadow = true;
    knightStub.add(body);
    stage.scene.add(knightStub);
    seat.position.set(0.80, 0.22, 0.05);
  }

  function blendArm(base, over, w) {
    const out = { ...base };
    for (const n of ARM_R) out[n] = base[n].clone().slerp(over[n], clamp(w, 0, 1));
    return out;
  }

  function filmJesus(t) {
    const rig = jesus.rig;
    const B = tl.beats, cue = Object.fromEntries(tl.cues.map((c) => [c.id, c]));
    const goldenMid = (B.goldenStart + B.goldenEnd) / 2;
    const STAND_SPOT = V3(1.05, 0, 0.62), SEAT_ROOT = V3(0.80, 0, 0.12), END_ROOT = V3(0.36, 0, 0.66);
    const walkStartT = 2.4, walkStartX = 4.6, arriveT = B.jesusArrive;
    const walkSpeed = (walkStartX - STAND_SPOT.x) / (arriveT - walkStartT);
    const kSeated = t < goldenMid;
    knightStub.position.set(kSeated ? -0.55 : -0.42, kSeated ? -0.25 : 0, kSeated ? 0.06 : 0.62);
    const kHead = V3(knightStub.position.x, kSeated ? 1.25 : 1.55, knightStub.position.z + 0.05);
    let seated = false, walkPhase = 0;
    const speaking = tl.cues.find((c) => c.speaker === 'JESUS' && t >= c.speechStart && t <= c.speechEnd);
    if (t < goldenMid) {
      if (t < arriveT + 0.5) {
        const tt = Math.min(t, arriveT);
        const x = Math.max(STAND_SPOT.x, walkStartX - walkSpeed * Math.max(0, tt - walkStartT));
        walkPhase = ((walkStartX - x) / (2 * 0.62)) % 1;
        const z = lerp(0.75, STAND_SPOT.z, smoothstep(walkStartX, STAND_SPOT.x, x));
        rig.root.position.set(x, 0, z);
        const stopW = smoothstep(arriveT - 0.35, arriveT + 0.5, t);
        rig.root.rotation.set(0, lerp(-90, -55, stopW) * DEG, 0);
        const walk = Humanoid.compile(J.walkPose(walkPhase));
        rig.applyPose(Humanoid.blend([[walk, 1 - stopW], [P.stand, stopW]]));
        rig.root.position.y = 0.012 * Math.abs(Math.sin(walkPhase * Math.PI * 2)) * (1 - stopW);
      } else if (t < B.jesusSitStart) {
        rig.root.position.copy(STAND_SPOT);
        rig.root.rotation.set(0, lerp(-55, -40, smoothstep(arriveT + 0.5, B.jesusSitStart, t)) * DEG, 0);
        rig.applyPose(P.stand);
      } else {
        const u = easeInOut(clamp((t - B.jesusSitStart) / (B.jesusSitEnd - B.jesusSitStart), 0, 1));
        seated = u > 0.5;
        rig.root.position.copy(STAND_SPOT).lerp(SEAT_ROOT, u);
        rig.root.rotation.set(0, lerp(-40, -38, u) * DEG, 0);
        let pose = Humanoid.blend([[P.stand, 1 - u], [P.sit, u]]);
        if (u >= 1) {
          const g1 = win(t, cue.L03.speechStart - 0.1, cue.L03.speechEnd + 0.3, 0.6, 0.7) * 0.55;
          const g2 = win(t, cue.L07.speechStart + 0.2, cue.L07.speechEnd + 0.4, 0.7, 0.9);
          const g3 = win(t, cue.L10.speechStart, cue.L10.speechEnd + 0.4, 0.6, 0.8) * 0.8;
          const g4 = win(t, cue.L09.speechStart + 1.0, cue.L09.speechEnd + 0.2, 0.6, 0.6) * 0.6;
          pose = blendArm(pose, P.openPalm, Math.max(g1, g2, g3));
          pose = blendArm(pose, P.handOnHeart, g4);
        }
        rig.applyPose(pose);
        if (u < 1) rig.addRot('spine', 10 * Math.sin(Math.PI * u), 0, 0);
      }
    } else {
      rig.root.position.copy(END_ROOT);
      rig.root.rotation.set(0, -14 * DEG, 0);
      rig.applyPose(P.stand);
    }
    rig.update();
    if (t >= B.jesusSitStart && t < goldenMid) {
      const u = easeInOut(clamp((t - B.jesusSitStart) / (B.jesusSitEnd - B.jesusSitStart), 0, 1));
      if (u >= 1) { const f = J.legTargetsSeated(jesus); rig.legIK('L', f.L); rig.legIK('R', f.R); }
    }
    if (t >= goldenMid) {
      const reach = smoothstep(B.shoulderTouch, B.shoulderTouch + 1.1, t);
      if (reach > 0) {
        const pauldron = V3(-0.42 + 0.21, 1.46, 0.64);
        const rest = rig.worldPos('handR');
        rig.armIK('R', rest.clone().lerp(pauldron, easeInOut(reach)), [-0.6, -0.4, -0.6]);
        const palmDown = quatDirFace(V3(0, -1, 0), V3(-1, 0, 0));
        const cur = rig.b.handR.getWorldQuaternion(new THREE.Quaternion());
        rig.setWorldQuat(rig.b.handR, cur.slerp(palmDown, reach * 0.6));
      }
    }
    if (t > 5.8) rig.lookAt(kHead, 0.8);
    jesus.setMouth(speaking ? clamp(0.45 + 0.4 * Math.abs(noise1(t * 11)), 0, 1) : 0);
    jesus.update(t, { seated: t >= B.jesusSitStart + 0.5 && t < goldenMid, walkPhase, walking: t < arriveT });
  }

  return {
    duration: 4,
    update(t) {
      const pose = params.pose || 'stand';
      studio.updateCamera();
      const rig = jesus.rig;
      if (pose === 'film') { seat.visible = true; filmJesus(t); return; }
      let seated = false, walkPhase = 0, walking = false;
      rig.root.position.set(0, 0, 0);
      rig.root.rotation.set(0, +(params.yaw || 0) * DEG, 0);
      if (pose === 'walk') {
        walking = true;
        walkPhase = ((t % 1) + 1) % 1;
        rig.applyPose(Humanoid.compile(J.walkPose(walkPhase)));
        rig.root.position.y = 0.012 * Math.abs(Math.sin(walkPhase * Math.PI * 2));
        if (params.move === '1') rig.root.position.z = t * J.WALK.cycle;
      } else if (pose === 'sit' || (pose === 'gesture' && params.base !== 'stand')) {
        seated = true;
        let p = P.sit;
        if (pose === 'gesture') p = blendArm(p, P[params.g || 'openPalm'], +(params.gw ?? 1));
        rig.applyPose(p);
      } else {
        let p = P.stand;
        if (pose === 'gesture') p = blendArm(p, P[params.g || 'welcome'], +(params.gw ?? 1));
        rig.applyPose(p);
      }
      rig.update();
      if (seated) {
        const f = J.legTargetsSeated(jesus);
        rig.legIK('L', f.L); rig.legIK('R', f.R);
      }
      seat.visible = seated;
      if (params.look) {
        const [x, y, z] = params.look.split(',').map(Number);
        rig.lookAt(new THREE.Vector3(x, y, z), 1);
      }
      const m = params.mouth === 'talk' ? clamp(0.5 + 0.6 * noise1(t * 9), 0, 1) : +(params.mouth || 0);
      jesus.setMouth(m);
      jesus.setBlink(+(params.blink || 0));
      jesus.setEyes(+(params.eyeYaw || 0), +(params.eyePitch || 0));
      jesus.setExpression({ smile: +(params.smile ?? 0.25), brow: +(params.brow ?? 0.25) });
      jesus.update(t, { seated, walkPhase, walking });
    },
  };
}
