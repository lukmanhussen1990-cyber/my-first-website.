// Small math / animation helpers. Everything in the film is a pure function of time.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const sstep = (a, b, x) => smooth((x - a) / (b - a));
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
// overshoot ease: 0 -> 1 with a small bounce past 1
export const easeOutBack = (t, s = 1.9) => { t = clamp(t); const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
// damped spring settle used for "pop in and snap into place"
export const springPop = (t, freq = 3.2, damp = 5.5) => {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(freq * Math.PI * 2 * t);
};
// 0 -> 1 -> 0 window with soft edges
export const win = (x, a, b, fa = 0.25, fb = fa) => sstep(a, a + fa, x) * (1 - sstep(b - fb, b, x));
export const pulse = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
export const fract = (x) => x - Math.floor(x);

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
export const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
export function vnoise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
export function vnoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
export function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
// smooth 1D noise sum for camera shake etc.
export const shake1 = (t, seed = 0) => vnoise1(t * 9.0 + seed * 17.3) * 0.6 + vnoise1(t * 23.0 + seed * 7.1) * 0.4;

// Piecewise keyframes: [[t, value], ...] with smooth (cubic Hermite, zero-slope) blending.
export function keys(t, kf, ease = smooth) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i], [t1, v1] = kf[i + 1];
    if (t <= t1) {
      const e = kf[i + 1][2] || ease;
      return lerp(v0, v1, e((t - t0) / (t1 - t0)));
    }
  }
  return kf[kf.length - 1][1];
}
export function keysV(t, kf, ease = smooth) { // vector keys
  if (t <= kf[0][0]) return kf[0][1].slice();
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i], [t1, v1] = kf[i + 1];
    if (t <= t1) {
      const e = kf[i + 1][2] || ease; const u = e((t - t0) / (t1 - t0));
      return v0.map((a, k) => lerp(a, v1[k], u));
    }
  }
  return kf[kf.length - 1][1].slice();
}

// Monotone-friendly cubic Hermite through (t, s, v) samples: position s with velocity v at each key.
export function hermiteTrack(samples) {
  return (t) => {
    if (t <= samples[0][0]) return samples[0][1] + samples[0][2] * (t - samples[0][0]);
    const n = samples.length;
    if (t >= samples[n - 1][0]) return samples[n - 1][1] + samples[n - 1][2] * (t - samples[n - 1][0]);
    for (let i = 0; i < n - 1; i++) {
      const [t0, p0, v0] = samples[i], [t1, p1, v1] = samples[i + 1];
      if (t <= t1) {
        const h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * v0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * v1;
      }
    }
    return samples[n - 1][1];
  };
}

// 2D path made of straight lines and circular arcs, parametrised by arc length.
// Heading theta: direction (cos th, sin th) in the XZ plane. Positive arc angle = turn left
// (for a cart heading +X, left is -Z).
export class Path2 {
  constructor(x, z, theta) { this.segs = []; this.x = x; this.z = z; this.th = theta; this.len = 0; }
  straight(L) {
    const s = { type: 'L', x: this.x, z: this.z, th: this.th, s0: this.len, L };
    this.segs.push(s);
    this.x += Math.cos(this.th) * L; this.z += Math.sin(this.th) * L; this.len += L; return this;
  }
  arc(R, deg) { // deg > 0 left turn, < 0 right turn
    const a = (deg * Math.PI) / 180, L = Math.abs(a) * R, dir = Math.sign(a);
    // left normal of heading th is (sin th, -cos th)
    const cx = this.x + Math.sin(this.th) * R * dir, cz = this.z - Math.cos(this.th) * R * dir;
    const s = { type: 'A', cx, cz, R, th: this.th, dir, s0: this.len, L, x: this.x, z: this.z };
    this.segs.push(s);
    this.th -= a; // left turn reduces theta
    this.x = cx - Math.sin(this.th) * R * dir; this.z = cz + Math.cos(this.th) * R * dir;
    this.len += L; return this;
  }
  at(s) {
    s = clamp(s, -50, this.len + 50);
    let seg = this.segs[0];
    for (const g of this.segs) { if (s >= g.s0) seg = g; }
    const d = s - seg.s0;
    if (seg.type === 'L' || d < 0 || d > seg.L) {
      if (seg.type === 'L') return { x: seg.x + Math.cos(seg.th) * d, z: seg.z + Math.sin(seg.th) * d, th: seg.th, k: 0 };
      // extrapolate past an arc end along its exit tangent
      const e = this.endOf(seg), dd = d > seg.L ? d - seg.L : d;
      const base = d > seg.L ? e : { x: seg.x, z: seg.z, th: seg.th };
      return { x: base.x + Math.cos(base.th) * dd, z: base.z + Math.sin(base.th) * dd, th: base.th, k: 0 };
    }
    const th = seg.th - seg.dir * (d / seg.R);
    return { x: seg.cx - Math.sin(th) * seg.R * seg.dir, z: seg.cz + Math.cos(th) * seg.R * seg.dir, th, k: seg.dir / seg.R };
  }
  endOf(seg) {
    const th = seg.th - seg.dir * (seg.L / seg.R);
    return { x: seg.cx - Math.sin(th) * seg.R * seg.dir, z: seg.cz + Math.cos(th) * seg.R * seg.dir, th };
  }
}
