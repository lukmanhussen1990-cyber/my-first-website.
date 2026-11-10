// Pose system for T-posed humanoid rigs. Pose rotations are written in model-space axes at rest:
// X = character's left, Y = up, Z = forward.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const D = Math.PI / 180;
const qx = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a * D);
const qy = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a * D);
const qz = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a * D);
const qe = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * D, (e[1] || 0) * D, (e[2] || 0) * D, 'XYZ'));
export const Q = { qx, qy, qz, qe };

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// ---- pose compilation -------------------------------------------------------------------------
// A pose definition is a plain object:
//   Hips/Spine/Spine1/Spine2/Neck/Head/…: [x,y,z] euler degrees (XYZ)
//   LArm/RArm: [flex, down, twist]   flex: swing forward/up about the lateral axis, down: 0 = T-pose, 90 = at the side
//   LElbow/RElbow: bend degrees  (optional second value = forearm twist)
//   LHand/RHand: [x,y,z]         LFist/RFist: finger curl 0..1
//   LLeg/RLeg: [flex, out, twist] (hip)   LKnee/RKnee: bend   LFoot/RFoot: point (toes down +)
//   hip: [dx,dy,dz] metres offset of the pelvis in character space
// A compiled pose is { q: {bone: Quaternion}, hip: Vector3 }.
export function P(def) {
  const q = {}; const d = { LArm: [0, 78, 0], RArm: [0, 78, 0], LElbow: 8, RElbow: 8, LFist: 0.25, RFist: 0.25, ...def };
  for (const k in d) {
    const v = d[k];
    switch (k) {
      case 'hip': break;
      case 'LArm': q.LeftArm = qx(-v[0]).multiply(qz(-v[1])).multiply(qx(v[2] || 0)); break;
      case 'RArm': q.RightArm = qx(-v[0]).multiply(qz(v[1])).multiply(qx(v[2] || 0)); break;
      case 'LElbow': { const a = Array.isArray(v) ? v : [v, 0]; q.LeftForeArm = qy(-a[0]).multiply(qx(a[1])); break; }
      case 'RElbow': { const a = Array.isArray(v) ? v : [v, 0]; q.RightForeArm = qy(a[0]).multiply(qx(a[1])); break; }
      case 'LHand': q.LeftHand = qe(v); break;
      case 'RHand': q.RightHand = qe(v); break;
      case 'LFist': case 'RFist': {
        const side = k[0] === 'L' ? 'Left' : 'Right', s = k[0] === 'L' ? -1 : 1;
        for (const f of FINGERS) for (let i = 1; i <= 3; i++) {
          q[`${side}Hand${f}${i}`] = f === 'Thumb' ? qy(s * -25 * v).multiply(qz(s * 20 * v)) : qz(s * (i === 1 ? 70 : 85) * v);
        }
        break;
      }
      case 'LLeg': q.LeftUpLeg = qe([-v[0], v[2] || 0, v[1] || 0]); break;
      case 'RLeg': q.RightUpLeg = qe([-v[0], -(v[2] || 0), -(v[1] || 0)]); break;
      case 'LKnee': q.LeftLeg = qx(v); break;
      case 'RKnee': q.RightLeg = qx(v); break;
      case 'LFoot': q.LeftFoot = Array.isArray(v) ? qe(v) : qx(v); break;
      case 'RFoot': q.RightFoot = Array.isArray(v) ? qe(v) : qx(v); break;
      case 'LShoulder': q.LeftShoulder = qe(v); break;
      case 'RShoulder': q.RightShoulder = qe(v); break;
      default: q[k] = qe(v);
    }
  }
  return { q, hip: new THREE.Vector3(...(d.hip || [0, 0, 0])) };
}

const _id = new THREE.Quaternion();
export function mixPose(a, b, k) {
  if (k <= 0) return a; if (k >= 1) return b;
  const q = {};
  for (const n of new Set([...Object.keys(a.q), ...Object.keys(b.q)])) q[n] = (a.q[n] || _id).clone().slerp(b.q[n] || _id, k);
  return { q, hip: a.hip.clone().lerp(b.hip, k) };
}
// Post-multiply extra local rotations (euler degrees) onto a pose: tweak(pose, {Head:[5,0,0]})
export function tweak(p, add) {
  const q = { ...p.q };
  for (const n in add) q[n] = (q[n] || _id).clone().multiply(qe(add[n]));
  return { q, hip: p.hip };
}

export const ease = {
  io: (x) => x * x * (3 - 2 * x),
  out: (x) => 1 - (1 - x) * (1 - x),
  in: (x) => x * x,
  back: (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  lin: (x) => x,
  elastic: (x) => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ramp = (t, a, b, e = 'io') => ease[e](clamp01((t - a) / (b - a)));

// keyed pose sequence: seqPose(t, [[t0, poseA], [t1, poseB, 'back'], …])
export function seqPose(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) return mixPose(keys[i - 1][1], keys[i][1], ramp(t, keys[i - 1][0], keys[i][0], keys[i][2] || 'io'));
  }
  return keys[keys.length - 1][1];
}
export function seqNum(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) { const k = ramp(t, keys[i - 1][0], keys[i][0], keys[i][2] || 'io'); const a = keys[i - 1][1], b = keys[i][1];
      return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * k) : a + (b - a) * k; }
  }
  return keys[keys.length - 1][1];
}
// world orientation from a list of successive world-frame rotations: [['x',-90],['z',90]]
export function rotQ(steps) {
  const q = new THREE.Quaternion();
  for (const [ax, deg] of steps || []) q.premultiply(ax === 'x' ? qx(deg) : ax === 'y' ? qy(deg) : qz(deg));
  return q;
}
// smooth pseudo-noise in [-1,1]
export function noise(t, seed = 0) {
  return (Math.sin(t * 1.0 + seed * 12.9) + Math.sin(t * 2.3 + seed * 7.1 + 1.3) * 0.6 + Math.sin(t * 4.1 + seed * 3.7 + 2.1) * 0.3) / 1.9;
}

// ---- actor ------------------------------------------------------------------------------------
// Works with any T-posed humanoid rig: pose rotations are expressed in model-space axes ("world aligned at rest")
// and converted to each bone's own local frame, which also lets us retarget the Xbot (Mixamo) clips onto other rigs.
export const CLIPS = {};          // built-in animation clips sampled from the three.js Xbot sample model
export function registerClips(gltf) {
  let hipY = 104;
  gltf.scene.traverse((o) => { if (o.isBone && o.name === 'mixamorigHips') hipY = o.position.y; });
  for (const c of gltf.animations) {
    const tr = [];
    for (const t of c.tracks) { const [node, prop] = t.name.split('.'); tr.push({ bone: node.replace('mixamorig', ''), prop, interp: t.createInterpolant() }); }
    CLIPS[c.name] = { duration: c.duration, tracks: tr, hipY };
  }
}
const ALIAS = { Chest: 'Spine1', UpperChest: 'Spine2', LeftToes: 'LeftToeBase', RightToes: 'RightToeBase' };

export class Actor {
  constructor(gltf, height) {
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    this.meshes = [];
    this.model.traverse((o) => { if (o.isSkinnedMesh) { this.meshes.push(o); o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
    this.model.updateMatrixWorld(true);
    const bb = new THREE.Box3(); for (const m of this.meshes) bb.union(new THREE.Box3().setFromObject(m));
    this.scale = height / (bb.max.y - bb.min.y); this.model.scale.setScalar(this.scale);
    this.model.position.y = -bb.min.y * this.scale;
    this.model.updateMatrixWorld(true);
    this.bones = {}; this.rest = {};
    const skinBones = new Set(); for (const m of this.meshes) for (const b of m.skeleton.bones) skinBones.add(b);
    this.model.traverse((o) => {
      if (!o.isBone || !skinBones.has(o)) return;
      let n = o.name.replace('mixamorig', ''); n = ALIAS[n] || n;
      this.bones[n] = o;
      const Wb = o.getWorldQuaternion(new THREE.Quaternion()), Wp = o.parent.getWorldQuaternion(new THREE.Quaternion());
      this.rest[n] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), Wb, Wp, WpInv: Wp.clone().invert(),
        wp: o.getWorldPosition(new THREE.Vector3()), ws: o.getWorldScale(new THREE.Vector3()).x };
    });
    this.hipRest = this.rest.Hips.wp.clone();     // pelvis position in model space (metres)
    this.boneScale = {};                          // persistent per-bone scale overrides (chubby ghost)
  }
  // Sample a built-in Xbot clip (idle / walk / run …) into a pose.
  clip(name, time) {
    const c = CLIPS[name]; const t = ((time % c.duration) + c.duration) % c.duration;
    const q = {}; let hip = new THREE.Vector3();
    for (const tr of c.tracks) {
      const v = tr.interp.evaluate(t);
      if (tr.prop === 'quaternion') q[tr.bone] = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
      else if (tr.prop === 'position' && tr.bone === 'Hips') hip = new THREE.Vector3(0, (v[1] - c.hipY) / c.hipY * this.hipRest.y, 0);
    }
    return { q, hip };
  }
  // Apply pose + place the pelvis at world position `at` with world orientation `rq`.
  apply(pose, at, rq) {
    for (const n in this.bones) {
      const b = this.bones[n], r = this.rest[n], d = pose.q[n];
      if (d) b.quaternion.copy(r.WpInv).multiply(d).multiply(r.Wp).multiply(r.q); else b.quaternion.copy(r.q);
      const s = this.boneScale[n]; if (s) b.scale.copy(s); else b.scale.copy(r.s);
    }
    this.root.quaternion.copy(rq);
    const off = this.hipRest.clone().applyQuaternion(rq);
    const hp = pose.hip.clone().applyQuaternion(rq);
    this.root.position.set(at[0], at[1], at[2]).sub(off).add(hp);
    this.root.updateMatrixWorld(true);
  }
  // Attach an object to a bone. Inside the holder: metres, axes aligned with the model at rest, origin at the bone.
  attach(boneName, obj, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
    const r = this.rest[boneName]; const h = new THREE.Group();
    h.quaternion.copy(r.Wb).invert(); h.scale.setScalar(1 / r.ws);
    this.bones[boneName].add(h); h.add(obj);
    obj.position.set(...pos); obj.rotation.set(rot[0] * D, rot[1] * D, rot[2] * D);
    if (Array.isArray(scale)) obj.scale.set(...scale); else obj.scale.setScalar(scale);
    return h;
  }
  worldPos(boneName, out = new THREE.Vector3()) { return this.bones[boneName].getWorldPosition(out); }
}
