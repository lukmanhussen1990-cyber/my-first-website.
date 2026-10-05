// Windshield wipers. Tracks the blade angles over time and records, per angle
// bin, when each blade last swept past — the glass shader reads that texture so
// raindrops vanish exactly under the blades and slowly come back.

import * as THREE from 'three';
import { CAR } from '../config.js';

const BINS = 64;

export class Wipers {
  constructor() {
    this.data = new Float32Array(BINS * 2).fill(-1000);
    this.texture = new THREE.DataTexture(this.data, BINS, 2, THREE.RedFormat, THREE.FloatType);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
    this.angles = [0, 0];
    this.mode = 0; // 0 off, 1 intermittent, 2 low, 3 high
    this.stroke = null; // { t, dur }
    this.wait = 0;
    this.onStroke = null;
  }

  setModeForRain(rain) {
    this.mode = rain < 0.08 ? 0 : rain < 0.35 ? 1 : rain < 0.7 ? 2 : 3;
  }

  update(dt, time) {
    const prev = this.angles.slice();
    if (!this.stroke) {
      this.wait -= dt;
      if (this.mode > 0 && this.wait <= 0) {
        const dur = this.mode === 3 ? 0.95 : 1.25;
        this.stroke = { t: 0, dur };
        if (this.onStroke) this.onStroke(dur);
      }
    }
    if (this.stroke) {
      const s = this.stroke;
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      // Up and back in one cycle, easing at the turn-around points.
      const k = u < 0.5 ? u * 2 : (1 - u) * 2;
      const e = k * k * (3 - 2 * k);
      CAR.wipers.forEach((w, i) => {
        this.angles[i] = e * w.max;
      });
      if (u >= 1) {
        this.stroke = null;
        this.angles = [0, 0];
        this.wait = this.mode === 1 ? 4.5 : this.mode === 2 ? 0.35 : 0.05;
      }
    }
    // Mark every angle bin the blades crossed this frame.
    let dirty = false;
    CAR.wipers.forEach((w, i) => {
      const a0 = Math.min(prev[i], this.angles[i]);
      const a1 = Math.max(prev[i], this.angles[i]);
      if (a1 - a0 < 1e-5 && !(this.stroke && a1 > 0)) return;
      const b0 = Math.max(0, Math.floor((a0 / w.max) * (BINS - 1)));
      const b1 = Math.min(BINS - 1, Math.ceil((a1 / w.max) * (BINS - 1)));
      for (let b = b0; b <= b1; b++) this.data[i * BINS + b] = time;
      dirty = true;
    });
    if (dirty) this.texture.needsUpdate = true;
  }
}
