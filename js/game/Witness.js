// Notices when the passenger actually looks at something uncanny. A target is
// "witnessed" after being held in view for a moment (directly, or via the
// rear-view mirror for targets behind the car).

import * as THREE from 'three';

export class Witness {
  constructor(camera, mirrorPosition) {
    this.camera = camera;
    this.mirrorPosition = mirrorPosition;
    this.targets = new Map();
    this.seen = new Set();
    this.onSeen = null;
    this.current = null;
    this._p = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._m = new THREE.Vector3();
  }

  add(target) {
    if (this.seen.has(target.id)) return;
    this.targets.set(target.id, { gaze: 0, hold: 0.5, minAngle: 0.07, ...target });
  }

  remove(id) {
    this.targets.delete(id);
  }

  reset() {
    this.targets.clear();
    this.seen.clear();
    this.current = null;
  }

  update(dt) {
    const cam = this.camera;
    const pos = cam.getWorldPosition(this._p);
    const fwd = cam.getWorldDirection(this._f);
    this.current = null;
    for (const t of this.targets.values()) {
      if (t.active && !t.active()) {
        t.gaze = Math.max(0, t.gaze - dt);
        continue;
      }
      const target = t.position();
      const to = this._d.copy(target).sub(pos);
      const dist = to.length();
      if (dist > t.maxDist) continue;
      const ang = fwd.angleTo(to);
      const allowed = Math.max(t.minAngle, Math.atan(t.radius / dist) + 0.035);
      let looking = ang < allowed;
      let focusDist = dist;
      if (!looking && t.mirror && this.mirrorPosition) {
        const m = this.mirrorPosition(this._m).sub(pos);
        if (fwd.angleTo(m) < 0.085) {
          looking = true;
          focusDist = m.length() + dist;
        }
      }
      if (looking) {
        t.gaze += dt;
        if (!this.current || focusDist < this.current.dist) this.current = { id: t.id, dist: focusDist };
      } else {
        t.gaze = Math.max(0, t.gaze - dt * 0.6);
      }
      if (t.gaze >= t.hold) {
        this.seen.add(t.id);
        this.targets.delete(t.id);
        if (t.onSeen) t.onSeen();
        if (this.onSeen) this.onSeen(t.id);
      }
    }
  }
}
