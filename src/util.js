// Deterministic helpers: seeded PRNG, value noise, easing, keyframes.
// Nothing in the renderer may read wall-clock time or Math.random().

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

// 1D value noise in [0,1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 57.31), b = hash(i + 1 + seed * 57.31);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
// signed fractal noise in [-1,1]
export function fbm(x, seed = 0) {
  return (noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.3 + noise1(x * 4.7, seed + 13) * 0.1) * 2 - 1;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ramp = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// 0 -> 1 -> 0 bump over [a,b]
export const bump = (t, a, b) => { const u = ramp(t, a, b); return Math.sin(u * Math.PI); };
// fade in over [a,a+fi], hold, fade out over [b-fo,b]
export const window01 = (t, a, b, fi = 0.25, fo = 0.25) => Math.min(smooth(ramp(t, a, a + fi)), 1 - smooth(ramp(t, b - fo, b)));

const lerpAny = (a, b, u) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], u)) : lerp(a, b, u);
// keyframes [[t, value], ...] with eased segments (value: number or array)
export function keys(t, k, ease = easeInOut) {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, v0] = k[i], [t1, v1] = k[i + 1];
    if (t <= t1) return lerpAny(v0, v1, ease((t - t0) / (t1 - t0)));
  }
  return k[k.length - 1][1];
}

export function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function mixHex(a, b, u) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], u) * 255));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function shade(hex, f) { // f<1 darker, >1 lighter (towards white)
  const c = hexToRgb(hex).map((v) => (f < 1 ? v * f : v + (1 - v) * (f - 1)));
  return '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
}
