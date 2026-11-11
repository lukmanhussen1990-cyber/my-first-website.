// Core math, easing, timing and colour helpers shared by every scene.
export const W = 1080, H = 1920, FPS = 60;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ilerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d, ease = E.linear) => lerp(c, d, ease(ilerp(a, b, x)));
export const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- easing
export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inQuart: (t) => t * t * t * t,
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  outBackBig: (t) => { const s = 2.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  inBack: (t) => { const s = 1.70158; return (s + 1) * t * t * t - s * t * t; },
  inOutBack: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/** eased 0..1 progress of t through [t0, t1] */
export const tw = (t, t0, t1, ease = E.inOutCubic) => ease(ilerp(t0, t1, t));

export function mix(a, b, p) {
  if (Array.isArray(a)) return a.map((x, i) => x + (b[i] - x) * p);
  return a + (b - a) * p;
}

/** keyframes: [[time, value, easeIntoThisKey?], ...] */
export function kf(t, keys, defEase = E.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const p = keys[i - 1];
      const e = k[2] || defEase;
      return mix(p[1], k[1], e((t - p[0]) / (k[0] - p[0])));
    }
  }
  return keys[keys.length - 1][1];
}

/** damped-spring step response 0 -> 1 (overshoots, settles) */
export function springStep(t, freq = 2.2, damp = 0.32) {
  if (t <= 0) return 0;
  const w = TAU * freq, z = damp, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** decaying oscillation kicked at t0 (for jiggles/follow-through) */
export function wobble(t, t0, freq = 6, decay = 6) {
  if (t < t0) return 0;
  const d = t - t0;
  return Math.sin(TAU * freq * d) * Math.exp(-decay * d);
}

/** UI pop scale 0 -> 1.1 -> 1.0 */
export function pop(t, t0, dur = 0.32, from = 0) {
  if (t < t0) return from;
  const u = (t - t0) / dur;
  if (u >= 1) return 1;
  if (u < 0.45) return lerp(from, 1.12, E.outQuad(u / 0.45));
  return lerp(1.12, 1, E.inOutSine((u - 0.45) / 0.55));
}

// ---------------------------------------------------------------- random / noise
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i * 7919 + seed * 104729), b = hash((i + 1) * 7919 + seed * 104729);
  return lerp(a, b, smooth(f)) * 2 - 1;
}
export const fbm1 = (x, seed = 0) => noise1(x, seed) * 0.62 + noise1(x * 2.13, seed + 7) * 0.28 + noise1(x * 4.37, seed + 13) * 0.1;

/** Integrate a damped spring chasing targetFn from t0 to t (deterministic, stateless per frame). */
export function follow(targetFn, t0, t, k = 140, c = 11, dt = 1 / 240) {
  let x = targetFn(t0), v = 0;
  for (let s = t0; s < t; s += dt) {
    const a = k * (targetFn(s) - x) - c * v;
    v += a * dt; x += v * dt;
  }
  return x;
}

/** camera shake offset: decaying noise kicked at t0 */
export function shake(t, t0, amp = 20, decay = 7, freq = 22, seed = 1) {
  if (t < t0) return [0, 0, 0];
  const d = t - t0, k = amp * Math.exp(-decay * d);
  return [noise1(d * freq, seed) * k, noise1(d * freq, seed + 31) * k, noise1(d * freq * 0.7, seed + 77) * k * 0.0015];
}

// ---------------------------------------------------------------- colour
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgb = (c, a = 1) =>
  a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulc = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
export const C = (h) => hex(h);
