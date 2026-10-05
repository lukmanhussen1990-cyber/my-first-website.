// Procedural road centreline. Heading and elevation are smooth noise functions of
// arc length, integrated into world positions on demand. Also owns the ground
// profile (crown, banking, gravel shoulder, ditch, hillside) shared by the road
// ribbon and the terrain strips so their edges always meet exactly.

import { Noise } from '../core/noise.js';
import { ROAD } from '../config.js';
import { clamp, smoothstep } from '../core/math.js';

const CELL = 32;
const key = (cx, cz) => (cx + 50000) * 100000 + (cz + 50000);

export class Road {
  constructor(seed = 1) {
    this.seed = seed;
    this.noise = new Noise(seed * 7 + 3);
    this.terrainNoise = new Noise(seed * 13 + 5);
    this.ds = ROAD.ds;
    this.n = 0;
    this.cap = 0;
    this._grow(8192);
    this.grid = new Map();

    this.x[0] = 0;
    this.z[0] = 0;
    this._fill(0);
    this.n = 1;
    this._insert(0);
  }

  _grow(cap) {
    const fields = ['x', 'y', 'z', 'theta', 'kappa', 'bank', 'grade'];
    for (const f of fields) {
      const arr = new Float64Array(cap);
      if (this[f]) arr.set(this[f]);
      this[f] = arr;
    }
    this.cap = cap;
  }

  /** Heading (radians, 0 = -Z, positive turns left) as a function of arc length. */
  heading(s) {
    const n = this.noise;
    const calmStart = 0.35 + 0.65 * smoothstep(80, 600, s);
    const winding = 0.78 + 0.22 * n.n1(s / 2600 + 40.2);
    return calmStart * winding * (
      0.5 * n.n1(s / 340 + 11.3) +
      0.22 * n.n1(s / 118 + 3.1) +
      0.05 * n.n1(s / 41 + 7.7)
    );
  }

  elevation(s) {
    const n = this.noise;
    return 9 * n.n1(s / 640 + 5.3) + 3.2 * n.n1(s / 210 + 1.7) + 0.5 * n.n1(s / 63 + 9.1);
  }

  /** Side slope of the land: >0 means the ground rises on the right of the road. */
  hillside(s) {
    return 0.24 * this.noise.n1(s / 520 + 77.7);
  }

  _fill(i) {
    const s = i * this.ds;
    this.y[i] = this.elevation(s);
    this.theta[i] = this.heading(s);
    this.kappa[i] = this.heading(s + 0.5) - this.heading(s - 0.5);
    this.grade[i] = this.elevation(s + 0.5) - this.elevation(s - 0.5);
    this.bank[i] = clamp(this.kappa[i] * 6.5, -0.045, 0.045);
  }

  _insert(i) {
    const k = key(Math.floor(this.x[i] / CELL), Math.floor(this.z[i] / CELL));
    let list = this.grid.get(k);
    if (!list) this.grid.set(k, (list = []));
    list.push(i);
  }

  /** Make sure samples exist up to arc length s. */
  ensure(s) {
    const need = Math.ceil(s / this.ds) + 2;
    if (need >= this.cap) this._grow(Math.max(need + 1, this.cap * 2));
    while (this.n <= need) {
      const i = this.n;
      const sm = (i - 0.5) * this.ds;
      const th = this.heading(sm);
      this.x[i] = this.x[i - 1] - Math.sin(th) * this.ds;
      this.z[i] = this.z[i - 1] - Math.cos(th) * this.ds;
      this._fill(i);
      this._insert(i);
      this.n++;
    }
  }

  get length() {
    return (this.n - 1) * this.ds;
  }

  /** Interpolated centreline frame at arc length s. */
  sample(s, out = {}) {
    this.ensure(s + 4);
    const f = Math.max(0, s / this.ds);
    let i = Math.floor(f);
    if (i > this.n - 2) i = this.n - 2;
    const t = f - i;
    const L = (a) => a[i] + (a[i + 1] - a[i]) * t;
    out.s = s;
    out.x = L(this.x);
    out.y = L(this.y);
    out.z = L(this.z);
    out.theta = L(this.theta);
    out.kappa = L(this.kappa);
    out.bank = L(this.bank);
    out.grade = L(this.grade);
    const st = Math.sin(out.theta);
    const ct = Math.cos(out.theta);
    out.fx = -st;
    out.fz = -ct;
    out.rx = ct;
    out.rz = -st;
    return out;
  }

  /** World position of strip coordinates (sample index i, lateral offset d). */
  stripPoint(i, d, out) {
    const th = this.theta[i];
    const wx = this.x[i] + Math.cos(th) * d;
    const wz = this.z[i] - Math.sin(th) * d;
    out.x = wx;
    out.z = wz;
    out.y = this.surfaceY(i, d, wx, wz);
    return out;
  }

  /** Ground height for sample i at lateral offset d (world coords wx, wz). */
  surfaceY(i, d, wx, wz) {
    const yr = this.y[i];
    const bank = this.bank[i];
    const A = ROAD.asphaltHalf;
    const ad = Math.abs(d);
    if (ad <= A) {
      return yr + 0.05 * (1 - (d / A) ** 2) + bank * d;
    }
    const e = ad - A;
    let g;
    if (e < 1.4) g = -0.03 - 0.12 * (e / 1.4);
    else if (e < 4.0) g = -0.15 - 0.42 * Math.sin(Math.PI * (e - 1.4) / 2.6);
    else g = -0.15;
    const w = smoothstep(3.6, 32, e);
    let nat = 0;
    if (w > 0) {
      const tn = this.terrainNoise;
      const s = i * this.ds;
      nat = this.hillside(s) * e * Math.sign(d) +
        6.5 * tn.fbm2(wx / 85, wz / 85, 3) +
        1.4 * tn.fbm2(wx / 19, wz / 19, 2) +
        0.35 * tn.n2(wx / 4.3, wz / 4.3);
    }
    return yr + bank * A * Math.sign(d) + g + w * nat;
  }

  /**
   * Closest point on the centreline to (px, pz) among samples within ~2 cells.
   * Returns null when the road is not nearby.
   */
  nearest(px, pz, out = {}) {
    const cx = Math.floor(px / CELL);
    const cz = Math.floor(pz / CELL);
    let best = Infinity;
    let bi = -1;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const list = this.grid.get(key(cx + dx, cz + dz));
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const i = list[k];
          const ex = this.x[i] - px;
          const ez = this.z[i] - pz;
          const d2 = ex * ex + ez * ez;
          if (d2 < best) {
            best = d2;
            bi = i;
          }
        }
      }
    }
    if (bi < 0) return null;
    // Refine on the neighbouring segments.
    let bestS = bi * this.ds;
    let bestD2 = best;
    for (const j of [bi - 1, bi]) {
      if (j < 0 || j + 1 >= this.n) continue;
      const ax = this.x[j];
      const az = this.z[j];
      const sx = this.x[j + 1] - ax;
      const sz = this.z[j + 1] - az;
      const len2 = sx * sx + sz * sz;
      const t = clamp(((px - ax) * sx + (pz - az) * sz) / len2, 0, 1);
      const qx = ax + sx * t - px;
      const qz = az + sz * t - pz;
      const d2 = qx * qx + qz * qz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestS = (j + t) * this.ds;
      }
    }
    const fr = this.sample(bestS, out);
    out.d = (px - fr.x) * fr.rx + (pz - fr.z) * fr.rz;
    out.dist = Math.sqrt(bestD2);
    return out;
  }

  /** Minimum distance from (px, pz) to any part of the road, Infinity if far. */
  distanceTo(px, pz) {
    const r = this.nearest(px, pz, this._tmp || (this._tmp = {}));
    return r ? r.dist : Infinity;
  }

  /** Ground height anywhere near the road (uses the nearest strip coordinate). */
  groundAt(px, pz) {
    const r = this.nearest(px, pz, this._tmp2 || (this._tmp2 = {}));
    if (!r) return this.y[this.n - 1];
    const i = clamp(Math.round(r.s / this.ds), 0, this.n - 1);
    return this.surfaceY(i, r.d, px, pz);
  }
}
