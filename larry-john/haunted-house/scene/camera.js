// Camera helpers: static framing, eased moves, push-ins, arcs, handheld shake, depth of field.
import * as THREE from 'three';
import { lerp, smooth, fbm1 } from '../../engine/toon/anim.js';

const V = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a));

export class CamRig {
  constructor(stage) {
    this.stage = stage;
    this.camera = stage.camera;
    this.pos = new THREE.Vector3(); this.target = new THREE.Vector3(); this.fov = 60; this.roll = 0;
  }
  // set the framing; pos/target are arrays or Vector3
  set(pos, target, fov = 60, roll = 0) {
    this.pos.copy(V(pos)); this.target.copy(V(target)); this.fov = fov; this.roll = roll;
    return this;
  }
  // interpolate between two framings a, b = {pos, target, fov, roll}
  between(a, b, u, ease = smooth) {
    const k = ease(u);
    this.pos.lerpVectors(V(a.pos), V(b.pos), k);
    this.target.lerpVectors(V(a.target), V(b.target), k);
    this.fov = lerp(a.fov ?? 60, b.fov ?? a.fov ?? 60, k);
    this.roll = lerp(a.roll ?? 0, b.roll ?? 0, k);
    return this;
  }
  // move the camera toward (amount>0) or away from its target
  push(amount) {
    const d = this.target.clone().sub(this.pos);
    this.pos.addScaledVector(d.normalize(), amount);
    return this;
  }
  // orbit around the target by an angle (radians) about the vertical axis
  orbit(angle) {
    const d = this.pos.clone().sub(this.target);
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.pos.copy(this.target).add(d);
    return this;
  }
  // handheld shake: small, smooth, never jittery
  shake(t, amp = 1, seed = 1) {
    this._shake = { t, amp, seed };
    return this;
  }
  // depth of field focused on a world point (close-ups)
  dof(focusPoint, aperture = 0.0035, maxblur = 0.008) {
    this._dof = { focusPoint: V(focusPoint), aperture, maxblur };
    return this;
  }
  apply() {
    const c = this.camera;
    c.position.copy(this.pos);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    if (this.roll) c.rotateZ(this.roll);
    if (this._shake && this._shake.amp > 0) {
      const { t, amp, seed } = this._shake;
      c.rotateX(fbm1(t * 0.9, seed) * 0.0055 * amp);
      c.rotateY(fbm1(t * 0.8, seed + 5) * 0.0065 * amp);
      c.rotateZ(fbm1(t * 0.7, seed + 9) * 0.004 * amp);
    }
    c.fov = this.fov;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    if (this._dof) {
      const dist = this._dof.focusPoint.distanceTo(c.position);
      this.stage.setDOF(true, dist, this._dof.aperture, this._dof.maxblur);
    } else this.stage.setDOF(false);
  }
  reset() { this._shake = null; this._dof = null; this.roll = 0; }
}
