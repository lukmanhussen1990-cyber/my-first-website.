// Small deterministic math helpers. Everything in the reel is a pure function of time,
// so any frame can be rendered in any order (parallel workers, frame checks).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeOutQuint = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 5); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export const easeInQuad = (t) => { t = clamp(t); return t * t; };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t); return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
// damped spring response to a step at time 0 (0 -> 1 with overshoot)
export const spring = (t, freq = 3, damp = 5) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t));
// impulse "wobble" after an event: 0 at t=0, oscillates and decays
export const wobble = (t, freq = 4, damp = 6) => (t <= 0 ? 0 : Math.exp(-damp * t) * Math.sin(2 * Math.PI * freq * t));
export const pulse = (t, a, b) => (t >= a && t < b ? 1 : 0);
export const DEG = Math.PI / 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 101.3), b = hash(i + 1 + seed * 101.3);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}
export function fbm1(x, seed = 0) {
  return noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.3 + noise1(x * 4.37, seed + 13) * 0.1;
}
