// Small deterministic helpers shared by every module. Nothing here depends on wall-clock time,
// so any frame can be rendered on its own (which is what makes parallel rendering possible).
import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * t * (t * (t * 6 - 15) + 10); };
export const deg = (d) => d * Math.PI / 180;

export const ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  out: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t,
  inCubic: (t) => t * t * t,
  // overshoot then settle: the "snap into place with a small bounce"
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  // damped spring settle, used for pops and landings
  spring: (t, freq = 3.2, damp = 5.5) => (t >= 1 ? 1 : 1 - Math.exp(-damp * t) * Math.cos(freq * Math.PI * t)),
};

// pop-in scale: 0 -> overshoot -> 1 with a little wobble
export function pop(t, t0, dur = 0.45) {
  if (t <= t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 1.6) return 1;
  return ease.spring(Math.min(u, 1.6) / 1.0, 2.6, 6.0);
}

// a bounce landing: returns vertical offset (>=0) for an object dropped from height h at t0
export function dropBounce(t, t0, h, dur = 0.5) {
  if (t <= t0) return h;
  const u = (t - t0) / dur;
  if (u < 1) return h * (1 - u * u);
  const v = u - 1;
  // two small decaying bounces
  const b1 = 0.6, b2 = 0.35;
  if (v < b1) return h * 0.12 * 4 * (v / b1) * (1 - v / b1);
  if (v < b1 + b2) { const w = (v - b1) / b2; return h * 0.035 * 4 * w * (1 - w); }
  return 0;
}

// mulberry32 seeded RNG
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// --- 2D value noise / fbm (deterministic, smooth) used for geometry displacement
function hash2(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
export function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// Monotone-ish smooth curve through (x, y) control points (Catmull-Rom, clamped ends).
export function makeCurve(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const n = xs.length;
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const x0 = xs[i], x1 = xs[i + 1];
    const t = (x - x0) / (x1 - x0);
    const y0 = ys[i], y1 = ys[i + 1];
    const m0 = i > 0 ? ((ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1])) * (x1 - x0) : (y1 - y0);
    const m1 = i < n - 2 ? ((ys[i + 2] - ys[i]) / (xs[i + 2] - xs[i])) * (x1 - x0) : (y1 - y0);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
  };
}

// Keyframe track: keys = [[time, value, easeName?], ...]; value may be number or array.
// Easing on a key applies to the segment that ENDS at that key.
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const u = (ease[e || 'inOut'])((t - t0) / (t1 - t0));
        if (Array.isArray(v0)) return v0.map((a, j) => lerp(a, v1[j], u));
        return lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Smooth camera path: Catmull-Rom through keyframe positions, with time re-mapped so that
// motion eases in and out of "hold" keys. keys: [{t, pos:[x,y,z], look:[x,y,z], fov}]
export function cameraPath(keys) {
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal', 0.5);
  const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal', 0.5);
  const n = keys.length;
  return (t) => {
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    let u = clamp((t - k0.t) / (k1.t - k0.t));
    u = (ease[k1.ease || 'inOutSine'])(u);
    const s = (i + u) / (n - 1);
    const pos = posCurve.getPoint(s), look = lookCurve.getPoint(s);
    const fov = lerp(k0.fov ?? 40, k1.fov ?? 40, u);
    const roll = lerp(k0.roll ?? 0, k1.roll ?? 0, u);
    return { pos, look, fov, roll };
  };
}

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
