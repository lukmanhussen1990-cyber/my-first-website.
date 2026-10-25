// Small deterministic helpers shared by every module. No Math.random anywhere in the reel.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// stable hash -> [0,1) for per-index randomness that does not depend on call order
export function hash01(i, salt = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// 0 -> 1 -> 0 window with soft edges
export const pulse = (t, a, b, fade = 0.25) => smooth(invLerp(a, a + fade, t)) * (1 - smooth(invLerp(b - fade, b, t)));

// keyframes: [[t, value], ...]; value may be number, array or THREE.Vector3/Color
export function kf(t, keys, ease = easeInOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const u = ease((t - t0) / (t1 - t0));
      return mix(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

export function mix(a, b, u) {
  if (typeof a === 'number') return a + (b - a) * u;
  if (Array.isArray(a)) return a.map((x, i) => x + (b[i] - x) * u);
  if (a.isVector3) return a.clone().lerp(b, u);
  if (a.isColor) return a.clone().lerp(b, u);
  return u < 0.5 ? a : b;
}

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const col = (hex) => new THREE.Color(hex);

// value noise (deterministic, smooth) for terrain and wobble
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const r = (i, j) => hash01(i * 73856093 ^ j * 19349663, seed);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(r(xi, yi), r(xi + 1, yi), u), lerp(r(xi, yi + 1), r(xi + 1, yi + 1), u), v) * 2 - 1;
}
export function fbm(x, y, oct = 3, seed = 0) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, seed + i * 17); a *= 0.5; f *= 2.03; }
  return s;
}
export const wobble = (t, f = 1, seed = 0) => noise2(t * f, seed * 3.1, seed);
