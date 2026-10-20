// Small math / animation helpers. Everything is deterministic (seeded) so any
// frame can be rendered in any order and always looks identical.
import * as THREE from 'three';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sat = (x) => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (x - a) / (b - a);
export const remap = (x, a, b, c, d) => lerp(c, d, sat(invLerp(a, b, x)));
export const smoothstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t) => t * t;
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = (t) => {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
// window that rises over [a,a+ri] and falls over [b-fo,b]
export const pulse = (t, a, b, ri = 0.1, fo = 0.1) => smoothstep(a, a + ri, t) * (1 - smoothstep(b - fo, b, t));
export const deg = (d) => (d * Math.PI) / 180;

// Damped oscillation that starts at t=0 (0 before), amplitude amp.
export const wobble = (t, amp, freq, damp) => (t < 0 ? 0 : amp * Math.exp(-damp * t) * Math.sin(2 * Math.PI * freq * t));

// Seeded PRNG
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n) {
  // integer-ish hash -> [0,1)
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function hash2(a, b) { return hash(a * 57.31 + b * 113.17); }

// 1D smooth value noise, deterministic
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
export function fbm1(x, oct = 3) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise1(x); n += a; x *= 2.03; a *= 0.5; }
  return s / n;
}

// Cubic Hermite between p0 and p1 with start/end velocities (units per second) over duration d.
export function hermite(p0, v0, p1, v1, u, d) {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return h00 * p0 + h10 * d * v0 + h01 * p1 + h11 * d * v1;
}
export function hermiteV3(out, p0, v0, p1, v1, u, d) {
  out.set(
    hermite(p0.x, v0.x, p1.x, v1.x, u, d),
    hermite(p0.y, v0.y, p1.y, v1.y, u, d),
    hermite(p0.z, v0.z, p1.z, v1.z, u, d));
  return out;
}

// Piecewise keyframe track of numbers or vectors with per-key easing.
// keys: [[t, value, ease?], ...]  ease applies to the segment ending at that key.
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1, ease] = keys[i];
        let u = (t - t0) / (t1 - t0);
        u = (ease || easeInOutCubic)(u);
        return lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Catmull-Rom (centripetal-ish uniform) through keyed Vector3 points with time keys.
// Produces C1-smooth motion; velocity at keys is estimated from neighbours.
export function splineTrack(keys) {
  // keys: [[t, Vector3], ...]
  const n = keys.length;
  const vel = keys.map((k, i) => {
    if (k[2]) return k[2]; // explicit velocity
    if (i === 0 || i === n - 1) return new THREE.Vector3();
    const a = keys[i - 1], b = keys[i + 1];
    return b[1].clone().sub(a[1]).divideScalar(b[0] - a[0]);
  });
  const out = new THREE.Vector3();
  return (t, target = out) => {
    if (t <= keys[0][0]) return target.copy(keys[0][1]);
    if (t >= keys[n - 1][0]) return target.copy(keys[n - 1][1]);
    let i = 1; while (keys[i][0] < t) i++;
    const d = keys[i][0] - keys[i - 1][0];
    const u = (t - keys[i - 1][0]) / d;
    return hermiteV3(target, keys[i - 1][1], vel[i - 1], keys[i][1], vel[i], u, d);
  };
}

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Halton sequence for sub-pixel jitter
export function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

// ---------- tileable 2D noise for texture generation ----------
export function makeNoise2(seed = 1) {
  const R = rng(seed);
  const P = 256;
  const perm = new Uint16Array(P * 2);
  const p = Array.from({ length: P }, (_, i) => i);
  for (let i = P - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < P * 2; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(P), gy = new Float32Array(P);
  for (let i = 0; i < P; i++) { const a = R() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  // periodic gradient noise with period (px, py) in lattice units
  function noise(x, y, px = 256, py = 256) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const g = (ix, iy, dx, dy) => { const h = perm[perm[ix & 255] + (iy & 255)]; return gx[h] * dx + gy[h] * dy; };
    const n00 = g(x0, y0, xf, yf), n10 = g(x1, y0, xf - 1, yf);
    const n01 = g(x0, y1, xf, yf - 1), n11 = g(x1, y1, xf - 1, yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.41;
  }
  function fbm(x, y, oct = 4, px = 256, py = 256, lac = 2, gain = 0.5) {
    let s = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x, y, px, py); n += a; x *= lac; y *= lac; px *= lac; py *= lac; a *= gain; }
    return s / n;
  }
  return { noise, fbm };
}
