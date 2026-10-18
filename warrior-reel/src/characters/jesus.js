// JESUS — procedural character (Three.js r169).
//
//   import { buildJesus, POSES, walkPose, legTargetsSeated, JESUS_DIMS, ANKLE_H, WALK } from './characters/jesus.js';
//   const jesus = buildJesus();          // { rig, root, update, setMouth, setBlink, setEyes, setExpression, setFingers, ... }
//   scene.add(jesus.root);
//
// Rig: Humanoid(JESUS_DIMS) — 1.80 m tall, ankle joint 0.075 m above the sole when standing (ANKLE_H).
// Head pivot ~1.59 m standing, eyes ~1.66 m; seated (POSES.sit) eyes ~1.14 m above the ground.
//
// POSES (degree format, see core/rig.js):
//   stand        relaxed upright, arms hanging beside the robe (hipsPos included)
//   sit          seated on a seat whose top is y = 0.44 (hips at 0.555, 0.065 behind the root); hands on the thighs.
//                After applyPose, plant the feet with legTargetsSeated(jesus) + rig.legIK (as film.js does).
//   openPalm     right arm only: hand raised in front at chest height, palm up (gentle explaining). Blend onto sit/stand.
//   handOnHeart  right arm only: right hand flat on the chest. Blend onto sit/stand.
//   welcome      right arm only, standing: palm open forward-down toward someone (optional extra).
// walkPose(phase)   full degree pose for a calm walk, phase 0..1 per stride CYCLE (2 steps = 2 x 0.62 m).
//                   phase 0 = left heel strike, 0.5 = right heel strike. Assumes the root moves forward at
//                   1.24 m per cycle and that the root bobs y = 0.012*|sin(2*pi*phase)| (as film.js does);
//                   the remaining pelvis bob is inside hipsPos so the stance foot stays planted.
// legTargetsSeated(jesus) -> { L, R } world ankle targets for rig.legIK when seated (feet flat in front of the seat).
//
// Face / secondary motion:
//   setMouth(0..1)   jaw opens under the moustache; dark mouth; upper teeth show above ~0.6.
//   setBlink(0..1)   eyelids close.
//   setEyes(yawDeg, pitchDeg)   eyeball rotation (+yaw = toward his left / screen right in a frontal shot, +pitch = up).
//   setExpression({ smile 0..1, brow -1..1 })   kind squint / raised inner brows (compassion) or lowered.
//   setFingers(side 'L'|'R', curl 0..1 | null)  override finger curl (null = automatic from the hand orientation).
//   update(t, { seated, walkPhase, walking })   hem sway, hair sway, automatic finger curl, flat feet when seated.
import * as THREE from 'three';
import { Humanoid } from '../core/rig.js';
import { DEG, clamp, lerp, smoothstep, fbm1, noise1 } from '../core/util.js';
import { jesusTextures } from './jesus_tex.js';
import { buildHead } from './jesus_head.js';
import { JESUS_DIMS, ANKLE_H, buildRobe, handGeometry, footGeometries, shinGeometry, neckGeometry } from './jesus_body.js';

export { JESUS_DIMS, ANKLE_H };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const STAND_HIPS_Y = JESUS_DIMS.thigh + JESUS_DIMS.shin + JESUS_DIMS.ankle; // 1.015

export const WALK = { stride: 0.62, cycle: 1.24, filmBob: 0.012, pelvisBob: 0.045, lowHipJoint: 0.917 };
export const SEAT_TOP = 0.44;
const SIT_HIPS = [0, 0.555, -0.065];
const SEAT_FEET = { x: 0.118, z: 0.43 };
const HEAD_SCALE = 1.07;

// ---------------------------------------------------------------------------------------------
// Pose solving helpers (run once at module load on a scratch rig)
// ---------------------------------------------------------------------------------------------
const toDeg = (q) => { const e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x / DEG, e.y / DEG, e.z / DEG].map((v) => Math.round(v * 100) / 100); };
const scratch = new Humanoid(JESUS_DIMS);

function readBones(names) {
  const out = {};
  for (const n of names) out[n] = toDeg(scratch.b[n].quaternion);
  return out;
}

// Solve an arm with IK on the scratch rig posed with `base`. Targets are in root-local space unless
// `chestLocal` is set (then target/dirs are in chest-bone space).
function solveArm(base, side, { target, pole = null, palm, fingers, chestLocal = false }) {
  scratch.applyPose(Humanoid.compile({ ...base }));
  scratch.root.updateMatrixWorld(true);
  const toW = (v) => (chestLocal ? scratch.b.chest.localToWorld(V(...v)) : V(...v));
  const dirW = (v) => {
    const d = V(...v).normalize();
    if (!chestLocal) return d;
    const q = scratch.b.chest.getWorldQuaternion(new THREE.Quaternion());
    return d.applyQuaternion(q);
  };
  scratch.armIK(side, toW(target), pole);
  scratch.orientBone('hand' + side, dirW(fingers), dirW(palm));
  return readBones(['shoulder' + side, 'upperArm' + side, 'foreArm' + side, 'hand' + side]);
}

function solveSeatedLegs(base) {
  scratch.applyPose(Humanoid.compile({ ...base }));
  scratch.root.updateMatrixWorld(true);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    scratch.legIK(s, V(sx * SEAT_FEET.x, ANKLE_H, SEAT_FEET.z));
    scratch.root.updateMatrixWorld(true);
    // flat foot, toes slightly out
    const yaw = sx * 6 * DEG;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    scratch.orientBone('foot' + s, V(0, -1, 0), fwd);
  }
  return readBones(['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']);
}

// ---------------------------------------------------------------------------------------------
// POSES
// ---------------------------------------------------------------------------------------------
const standBase = {
  hipsPos: [0, STAND_HIPS_Y, 0],
  hips: [0, 0, 0], spine: [-1, 0, 0], chest: [1.5, 0, 0], neck: [3, 0, 0], head: [-3, 0, 0],
  shoulderL: [0, 0, -2], shoulderR: [0, 0, 2],
  thighL: [-1, 0, 1.6], shinL: [2, 0, 0], footL: [-1, 4, -1.6],
  thighR: [-1, 0, -1.6], shinR: [2, 0, 0], footR: [-1, -4, 1.6],
};
const stand = {
  ...standBase,
  ...solveArm(standBase, 'L', { target: [0.236, 0.905, 0.045], palm: [-1, 0.05, -0.35], fingers: [0.05, -1, 0.12] }),
  ...solveArm(standBase, 'R', { target: [-0.236, 0.905, 0.045], palm: [1, 0.05, -0.35], fingers: [-0.05, -1, 0.12] }),
};

const sitBase = {
  hipsPos: SIT_HIPS,
  hips: [0, 0, 0], spine: [5, 0, 0], chest: [1, 0, 0], neck: [4, 0, 0], head: [-4, 0, 0],
  shoulderL: [0, 0, -1], shoulderR: [0, 0, 1],
  thighL: [-88, 0, 3], shinL: [86, 0, 0], footL: [2, 0, -3],
  thighR: [-88, 0, -3], shinR: [86, 0, 0], footR: [2, 0, 3],
};
Object.assign(sitBase, solveSeatedLegs(sitBase));
const sit = {
  ...sitBase,
  ...solveArm(sitBase, 'L', { target: [0.132, 0.692, 0.150], palm: [-0.12, -1, 0.1], fingers: [-0.10, -0.16, 1] }),
  ...solveArm(sitBase, 'R', { target: [-0.132, 0.692, 0.150], palm: [0.12, -1, 0.1], fingers: [0.10, -0.16, 1] }),
};

const openPalm = solveArm(sitBase, 'R', { target: [-0.195, 0.86, 0.35], palm: [-0.28, 1, 0.05], fingers: [-0.28, 0.12, 1] });
const handOnHeart = solveArm(sitBase, 'R', {
  chestLocal: true,
  target: [-0.008, 0.088, 0.150], pole: [-0.55, -1, -0.1],
  palm: [0.05, 0.05, -1], fingers: [0.88, 0.45, -0.06],
});
const welcome = solveArm(standBase, 'R', { target: [-0.27, 1.02, 0.30], palm: [-0.35, 0.75, 0.55], fingers: [-0.35, -0.2, 1] });

export const POSES = { stand, sit, openPalm, handOnHeart, welcome };

// ---------------------------------------------------------------------------------------------
// Walk cycle
// ---------------------------------------------------------------------------------------------
const HEEL = V(0, -ANKLE_H, -0.060), BALL = V(0, -ANKLE_H, 0.120);
const rotX = (v, deg) => { const a = deg * DEG, c = Math.cos(a), s = Math.sin(a); return V(v.x, v.y * c - v.z * s, v.y * s + v.z * c); };
const ST = 0.62, A_END = 0.10, B_END = 0.45;
const ZHS = -0.06 + WALK.cycle * 0.275; // heel z at heel strike (ankle passes under the hip at q = 0.275)

// Ankle position (root-local z relative to the hip, y above ground) and foot pitch (deg, + = toes down) at foot phase q.
function footAt(q) {
  q = ((q % 1) + 1) % 1;
  const C = WALK.cycle;
  if (q < A_END) {
    const pitch = lerp(-16, 0, 1 - Math.pow(1 - q / A_END, 2));
    const heel = V(0, 0, ZHS - C * q);
    const a = heel.clone().sub(rotX(HEEL, pitch));
    return { z: a.z, y: a.y, pitch };
  }
  if (q < B_END) return { z: ZHS - C * q + 0.06, y: ANKLE_H, pitch: 0 };
  if (q < ST) {
    const u = (q - B_END) / (ST - B_END);
    const pitch = 38 * u * u * (1.6 - 0.6 * u);
    const ball = V(0, 0, ZHS - C * B_END + 0.18 - C * (q - B_END));
    const a = ball.clone().sub(rotX(BALL, pitch));
    return { z: a.z, y: a.y, pitch };
  }
  const s = (q - ST) / (1 - ST);
  const a0 = footAt(ST - 1e-6), a1 = footAt(0);
  const e = s * s * (3 - 2 * s);
  const z = lerp(a0.z, a1.z, lerp(s, e, 0.7));
  const lift = 0.055 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), 1.3);
  const y = lerp(a0.y, a1.y, s) + lift;
  const pitch = s < 0.55 ? lerp(38, 2, smoothstep(0, 0.55, s)) : lerp(2, -16, smoothstep(0.55, 1, s));
  return { z, y, pitch };
}

export function walkPose(phase) {
  const p = ((phase % 1) + 1) % 1;
  const TAU = Math.PI * 2;
  const bobAll = Math.abs(Math.sin(TAU * p));
  const hipJointY = WALK.lowHipJoint + WALK.pelvisBob * bobAll;          // world height of the hip joints
  const hipsY = hipJointY + 0.04 - WALK.filmBob * bobAll;                // film.js adds the rest of the bob to the root
  const yaw = -3.5 * Math.cos(TAU * p);                                   // pelvis turns toward the forward leg
  const roll = 1.6 * Math.sin(TAU * p);
  const pose = {
    hipsPos: [0.012 * Math.sin(TAU * p), hipsY, 0],
    hips: [0, yaw, roll],
    spine: [3, -yaw * 0.7, -roll * 0.8],
    chest: [0.5 + 0.6 * Math.cos(2 * TAU * p), -yaw * 0.9, -roll * 0.4],
    neck: [3, yaw * 0.4, 0],
    head: [-3, yaw * 0.25, roll * 0.3],
    shoulderL: [0, 0, -2], shoulderR: [0, 0, 2],
  };
  const l1 = JESUS_DIMS.thigh, l2 = JESUS_DIMS.shin;
  for (const [s, sx, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
    const f = footAt(p + off);
    const hz = sx * (JESUS_DIMS.hipW / 2) * Math.sin(-yaw * DEG);
    const hy = hipJointY + sx * (JESUS_DIMS.hipW / 2) * Math.sin(roll * DEG);
    const dz = f.z - hz, dy = hy - f.y;
    let d = Math.hypot(dz, dy);
    d = clamp(d, 0.3, l1 + l2 - 0.0015);
    const a0 = Math.atan2(dz, dy);
    const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const K = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const thighX = -(a0 + A) / DEG;
    const shinX = (Math.PI - K) / DEG;
    const footX = f.pitch - thighX - shinX;
    pose['thigh' + s] = [thighX, -yaw * 0.6, sx * 1.2 - roll];
    pose['shin' + s] = [shinX, 0, 0];
    pose['foot' + s] = [footX, sx * 4, 0];
  }
  // arms: gentle counter-swing (left arm forward when the right leg is forward)
  const sw = Math.cos(TAU * p);
  for (const [s, sx, k] of [['L', 1, 1], ['R', -1, -1]]) {
    const fwd = -k * sw; // +1 = arm forward
    pose['upperArm' + s] = [-3 - 8 * fwd, 0, sx * 7];
    pose['foreArm' + s] = [-16 - 9 * Math.max(0, fwd), -sx * 60, 0];
    pose['hand' + s] = [-6, 0, sx * 3];
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------
export function legTargetsSeated(jesus) {
  const rig = jesus.rig || jesus;
  rig.root.updateMatrixWorld(true);
  return {
    L: rig.pointToWorld(V(SEAT_FEET.x, ANKLE_H, SEAT_FEET.z)),
    R: rig.pointToWorld(V(-SEAT_FEET.x, ANKLE_H, SEAT_FEET.z)),
  };
}

// ---------------------------------------------------------------------------------------------
export function buildJesus() {
  const T = jesusTextures();
  const rig = new Humanoid(JESUS_DIMS);
  rig.root.name = 'jesus';
  const b = rig.b;

  // --- skinned cloth ---
  const cloth = buildRobe(T);
  for (const m of [cloth.robe, cloth.sash]) {
    rig.root.add(m);
    rig.root.updateMatrixWorld(true);
    rig.bindSkin(m);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
  }

  // --- skin parts ---
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: T.skin, roughness: 0.6 });
  skinMat.emissive = new THREE.Color('#3a1206'); skinMat.emissiveIntensity = 0.16;
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: T.leather, roughness: 0.78 });

  const neck = new THREE.Mesh(neckGeometry(), skinMat);
  b.neck.add(neck);

  const head = buildHead(T);
  head.group.scale.setScalar(HEAD_SCALE);
  b.head.add(head.group);

  const hands = {};
  const handCurl = { L: 0.5, R: 0.5 }, handOverride = { L: null, R: null };
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const h = new THREE.Mesh(handGeometry(handCurl[s], sx), skinMat);
    h.name = 'hand' + s;
    b['hand' + s].add(h);
    hands[s] = h;
    const shin = new THREE.Mesh(shinGeometry(), skinMat);
    b['shin' + s].add(shin);
    const fg = footGeometries(sx);
    const foot = new THREE.Mesh(fg.skinG, skinMat);
    const sandal = new THREE.Mesh(fg.leatherG, leatherMat);
    b['foot' + s].add(foot, sandal);
  }
  rig.root.traverse((o) => { if (o.isMesh && o.castShadow === false && !o.isSkinnedMesh && o.parent && o.parent.isBone) { o.castShadow = true; o.receiveShadow = true; } });
  for (const m of [neck, hands.L, hands.R]) { m.castShadow = true; m.receiveShadow = true; }
  b.footL.children.concat(b.footR.children, b.shinL.children, b.shinR.children).forEach((m) => { m.castShadow = m.receiveShadow = true; });

  rig.applyPose(Humanoid.compile(POSES.stand));
  rig.update();

  function setFingers(side, curl) { handOverride[side] = curl == null ? null : clamp(curl, 0, 1); }
  function applyCurl(side, c) {
    if (Math.abs(c - handCurl[side]) < 0.025) return;
    handCurl[side] = c;
    hands[side].geometry = handGeometry(c, side === 'L' ? 1 : -1);
  }

  const qTmp = new THREE.Quaternion(), vTmp = new THREE.Vector3(), up = V(0, 1, 0);
  function update(t, state = {}) {
    const seated = !!state.seated;
    const ph = state.walkPhase || 0;
    const walking = state.walking != null ? !!state.walking : ph > 0;
    // --- robe hem sway (bind-space displacement weighted by hem factor) ---
    let sx = 0.0045 * fbm1(t * 0.55, 3), sz = 0.0035 * fbm1(t * 0.47, 7);
    let rip = 0.0018 + 0.0012 * (fbm1(t * 0.3, 5) * 0.5 + 0.5);
    if (walking) {
      const TAU = Math.PI * 2;
      sx += 0.009 * Math.sin(TAU * ph + 0.6);
      sz += -0.014 + 0.005 * Math.cos(2 * TAU * ph);
      rip += 0.003;
    }
    if (seated) { sx *= 0.5; sz *= 0.5; rip *= 0.6; }
    cloth.sway.value.set(sx, 0, sz);
    cloth.ripple.value.set(t * 1.9, rip);
    // --- hair sway ---
    const hb = walking ? Math.sin(Math.PI * 4 * ph) : 0;
    head.hairPivot.rotation.set((0.6 * fbm1(t * 0.45, 11) + 0.8 * hb) * DEG, 0, 0.7 * fbm1(t * 0.38, 13) * DEG);
    // --- flat feet when seated (after the integrator's leg IK) ---
    if (seated) {
      rig.root.getWorldQuaternion(qTmp);
      for (const [s, sxx] of [['L', 1], ['R', -1]]) {
        const yaw = sxx * 6 * DEG;
        const q = qTmp.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, yaw));
        rig.setWorldQuat(b['foot' + s], q);
      }
    }
    // --- finger curl: open when the palm faces up or rests on the chest, relaxed otherwise ---
    rig.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      let c;
      if (handOverride[s] != null) c = handOverride[s];
      else {
        b['hand' + s].getWorldQuaternion(qTmp);
        const palm = vTmp.set(0, 0, 1).applyQuaternion(qTmp);
        const rootUp = up.clone();
        const palmUp = palm.dot(rootUp);
        const handPos = b['hand' + s].getWorldPosition(new THREE.Vector3());
        const chestPos = b.chest.getWorldPosition(new THREE.Vector3());
        const nearChest = smoothstep(0.30, 0.18, handPos.distanceTo(chestPos.add(V(0, 0.1, 0))));
        c = lerp(0.5, 0.16, smoothstep(0.25, 0.75, palmUp));
        c = lerp(c, 0.06, nearChest);
      }
      applyCurl(s, c);
    }
  }

  return {
    rig, root: rig.root, update,
    setMouth: head.setMouth, setBlink: head.setBlink, setEyes: head.setEyes, setExpression: head.setExpression,
    setFingers,
    head, cloth, hands,
  };
}
