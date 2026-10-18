// Humanoid rig shared by the knight and Jesus.
//
// Conventions (1 unit = 1 metre, Y up):
//  * A character in its rest pose faces +Z. Its LEFT side is +X, its RIGHT side is -X.
//  * Every limb bone extends along its local -Y axis from the bone origin (the joint).
//    A bone's local +Z is the "front" of that limb (knee cap / inside of elbow side faces +Z
//    in the rest pose), local +X is the hinge axis of the next joint.
//  * Meshes are parented to bones and modelled in bone-local space hanging down -Y.
//  * Poses are plain objects { boneName: [xDeg, yDeg, zDeg], hipsPos: [x, y, z] }.
//    Arm forward-raise = negative X, left-arm outward = +Z, right-arm outward = -Z.
//    Thigh forward-raise = negative X, knee bend = positive X on the shin.
import * as THREE from 'three';
import { DEG, clamp } from './util.js';

export const BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'upperArmL', 'foreArmL', 'handL',
  'shoulderR', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
];

const V = () => new THREE.Vector3();
const _m = new THREE.Matrix4();
export function quatFromBasis(x, y, z, out = new THREE.Quaternion()) {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

export const DEFAULT_DIMS = {
  spine: 0.14,     // hips pivot -> chest pivot
  chest: 0.26,     // chest pivot -> neck pivot
  neck: 0.10,      // neck pivot -> head pivot
  shoulderW: 0.40, // distance between the two shoulder joints
  shoulderY: 0.21, // shoulder joints above the chest pivot
  upperArm: 0.30,
  foreArm: 0.27,
  hipW: 0.20,      // distance between the two hip joints
  thigh: 0.46,
  shin: 0.44,
  ankle: 0.08,     // ankle joint height above the sole
};

export class Humanoid {
  constructor(dims = {}) {
    const d = (this.d = { ...DEFAULT_DIMS, ...dims });
    this.root = new THREE.Group();
    this.root.name = 'characterRoot';
    this.b = {};
    const mk = (name, parent, pos) => {
      const o = new THREE.Bone();
      o.name = name;
      o.position.set(pos[0], pos[1], pos[2]);
      parent.add(o);
      this.b[name] = o;
      return o;
    };
    this.standHipY = d.thigh + d.shin + d.ankle;
    const hips = mk('hips', this.root, [0, this.standHipY, 0]);
    const spine = mk('spine', hips, [0, 0.02, 0]);
    const chest = mk('chest', spine, [0, d.spine, 0]);
    const neck = mk('neck', chest, [0, d.chest, 0]);
    mk('head', neck, [0, d.neck, 0]);
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      const sh = mk('shoulder' + s, chest, [sx * d.shoulderW / 2, d.shoulderY, 0]);
      const ua = mk('upperArm' + s, sh, [0, 0, 0]);
      const fa = mk('foreArm' + s, ua, [0, -d.upperArm, 0]);
      mk('hand' + s, fa, [0, -d.foreArm, 0]);
      const th = mk('thigh' + s, hips, [sx * d.hipW / 2, -0.04, 0]);
      const sn = mk('shin' + s, th, [0, -d.thigh, 0]);
      mk('foot' + s, sn, [0, -d.shin, 0]);
    }
    // Skeleton (bone order = BONE_NAMES) so cloth/skin can be a THREE.SkinnedMesh bound in the rest pose:
    //   mesh.bind(rig.skeleton, mesh.matrixWorld) after adding the mesh to rig.root; skinIndex = BONE_NAMES.indexOf(name).
    this.skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => this.b[n]));
    // Rest pose copy so poses can be expressed relative to it.
    this.rest = {};
    for (const n of BONE_NAMES) this.rest[n] = { q: this.b[n].quaternion.clone(), p: this.b[n].position.clone() };
  }

  // Bind a SkinnedMesh (already added somewhere under this.root) to the skeleton in the REST pose.
  // Geometry must carry skinIndex/skinWeight attributes with indices into BONE_NAMES and be modelled
  // in root-local space with the character standing in the rest pose.
  bindSkin(mesh) {
    const saved = BONE_NAMES.map((n) => [this.b[n].quaternion.clone(), this.b[n].position.clone()]);
    BONE_NAMES.forEach((n) => { this.b[n].quaternion.copy(this.rest[n].q); this.b[n].position.copy(this.rest[n].p); });
    const savedRoot = [this.root.position.clone(), this.root.quaternion.clone(), this.root.scale.clone()];
    this.root.position.set(0, 0, 0); this.root.quaternion.identity(); this.root.scale.set(1, 1, 1);
    this.root.updateMatrixWorld(true);
    this.skeleton.calculateInverses();
    mesh.bind(this.skeleton, mesh.matrixWorld);
    this.root.position.copy(savedRoot[0]); this.root.quaternion.copy(savedRoot[1]); this.root.scale.copy(savedRoot[2]);
    BONE_NAMES.forEach((n, i) => { this.b[n].quaternion.copy(saved[i][0]); this.b[n].position.copy(saved[i][1]); });
    this.root.updateMatrixWorld(true);
  }

  // ---------- FK ----------
  // Convert a degree pose into a quaternion pose (cached per pose object).
  static compile(pose) {
    if (pose.__q) return pose.__q;
    const out = {};
    for (const n of BONE_NAMES) {
      const r = pose[n];
      out[n] = r ? new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'XYZ')) : new THREE.Quaternion();
    }
    out.hipsPos = pose.hipsPos ? new THREE.Vector3(...pose.hipsPos) : null;
    Object.defineProperty(pose, '__q', { value: out, enumerable: false });
    return out;
  }

  // Blend several compiled poses: list of [compiledPose, weight]. Weights should sum to 1.
  static blend(list) {
    const out = {};
    for (const n of BONE_NAMES) {
      let q = null, acc = 0;
      for (const [p, w] of list) {
        if (w <= 0) continue;
        if (!q) { q = p[n].clone(); acc = w; continue; }
        acc += w;
        q.slerp(p[n], w / acc);
      }
      out[n] = q || new THREE.Quaternion();
    }
    let hp = null, acc = 0;
    for (const [p, w] of list) {
      if (w <= 0 || !p.hipsPos) continue;
      if (!hp) { hp = p.hipsPos.clone(); acc = w; continue; }
      acc += w;
      hp.lerp(p.hipsPos, w / acc);
    }
    out.hipsPos = hp;
    return out;
  }

  applyPose(compiled) {
    for (const n of BONE_NAMES) this.b[n].quaternion.copy(compiled[n]);
    if (compiled.hipsPos) this.b.hips.position.copy(compiled.hipsPos);
    else this.b.hips.position.set(0, this.standHipY, 0);
  }

  // Post-multiply an extra local rotation (degrees) on a bone — for additive idle/gesture layers.
  addRot(name, xDeg, yDeg = 0, zDeg = 0) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(xDeg * DEG, yDeg * DEG, zDeg * DEG, 'XYZ'));
    this.b[name].quaternion.multiply(q);
  }

  // ---------- World-space helpers ----------
  update() { this.root.updateMatrixWorld(true); }
  worldPos(name, out = V()) { return this.b[name].getWorldPosition(out); }
  setWorldQuat(bone, qWorld) {
    const pq = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(qWorld));
    bone.updateMatrixWorld(true);
  }
  // Character-space (root-local) direction -> world direction.
  dirToWorld(v) { const q = new THREE.Quaternion(); this.root.getWorldQuaternion(q); return v.clone().applyQuaternion(q); }
  pointToWorld(v) { this.root.updateMatrixWorld(true); return v.clone().applyMatrix4(this.root.matrixWorld); }

  // ---------- IK ----------
  // Analytic two-bone IK. pole: world direction the middle joint should bend toward.
  // frontSign: -1 for arms (elbow points back, limb front faces away from it), +1 for legs.
  solveTwoBone(upperName, lowerName, endName, targetWorld, poleWorld, frontSign) {
    const upper = this.b[upperName], lower = this.b[lowerName], end = this.b[endName];
    this.root.updateMatrixWorld(true);
    const l1 = lower.position.length(), l2 = end.position.length();
    const A = upper.getWorldPosition(V());
    const toT = targetWorld.clone().sub(A);
    let d = toT.length();
    const dir = d > 1e-6 ? toT.clone().divideScalar(d) : new THREE.Vector3(0, -1, 0);
    d = clamp(d, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const n = poleWorld.clone().sub(dir.clone().multiplyScalar(poleWorld.dot(dir)));
    if (n.lengthSq() < 1e-8) n.set(dir.y, -dir.x, 0.3).sub(dir.clone().multiplyScalar(dir.y * 0)); // degenerate fallback
    n.normalize();
    const E = A.clone().addScaledVector(dir, l1 * cosA).addScaledVector(n, l1 * sinA);
    const P = A.clone().addScaledVector(dir, d);
    const yU = A.clone().sub(E).normalize();
    const zU = n.clone().multiplyScalar(frontSign);
    zU.addScaledVector(yU, -zU.dot(yU)).normalize();
    const xU = V().crossVectors(yU, zU).normalize();
    this.setWorldQuat(upper, quatFromBasis(xU, yU, zU));
    const yL = E.clone().sub(P).normalize();
    const zL = V().crossVectors(xU, yL).normalize();
    const xL = V().crossVectors(yL, zL).normalize();
    this.setWorldQuat(lower, quatFromBasis(xL, yL, zL));
    return { elbow: E, end: P };
  }

  // side: 'L' | 'R'. pole in character space if poleLocal given.
  armIK(side, targetWorld, poleLocal = null) {
    const sx = side === 'L' ? 1 : -1;
    const pole = this.dirToWorld(poleLocal ? new THREE.Vector3(...poleLocal) : new THREE.Vector3(0.35 * sx, -0.25, -1).normalize());
    return this.solveTwoBone('upperArm' + side, 'foreArm' + side, 'hand' + side, targetWorld, pole, -1);
  }
  legIK(side, targetWorld, poleLocal = null) {
    const sx = side === 'L' ? 1 : -1;
    const pole = this.dirToWorld(poleLocal ? new THREE.Vector3(...poleLocal) : new THREE.Vector3(0.12 * sx, 0.1, 1).normalize());
    return this.solveTwoBone('thigh' + side, 'shin' + side, 'foot' + side, targetWorld, pole, 1);
  }

  // Orient a bone in world space so its local -Y points along `down` and local +Z along `front`.
  orientBone(name, downWorld, frontWorld) {
    const y = downWorld.clone().normalize().negate();
    const z = frontWorld.clone().addScaledVector(y, -frontWorld.dot(y)).normalize();
    const x = V().crossVectors(y, z).normalize();
    this.setWorldQuat(this.b[name], quatFromBasis(x, y, z));
  }

  // Turn neck + head so the head's +Z faces `targetWorld`. weight 0..1 blends from the FK pose.
  lookAt(targetWorld, weight = 1, neckShare = 0.4) {
    if (weight <= 0) return;
    this.root.updateMatrixWorld(true);
    const head = this.b.head, neck = this.b.neck;
    const hp = head.getWorldPosition(V());
    const z = targetWorld.clone().sub(hp).normalize();
    const x = V().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
    const y = V().crossVectors(z, x).normalize();
    const qDes = quatFromBasis(x, y, z);
    const qCur = head.getWorldQuaternion(new THREE.Quaternion());
    const qFinal = qCur.clone().slerp(qDes, weight);
    const delta = qFinal.clone().multiply(qCur.clone().invert());
    const nq = neck.getWorldQuaternion(new THREE.Quaternion());
    const partial = new THREE.Quaternion().slerp(delta, neckShare);
    this.setWorldQuat(neck, partial.multiply(nq));
    this.setWorldQuat(head, qFinal);
  }
}
