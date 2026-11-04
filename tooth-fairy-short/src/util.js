// Small deterministic math helpers. Every frame is computed from time alone,
// so nothing here keeps state between frames.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const eOut = (t) => 1 - Math.pow(1 - t, 3);
export const eIn = (t) => t * t * t;
export const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const deg = (d) => (d * Math.PI) / 180;

// Seeded PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth pseudo-noise in [-1, 1] built from incommensurate sines.
export function wob(t, seed = 0) {
  return (
    Math.sin(t * 1.13 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.37 + seed * 78.233) * 0.3 +
    Math.sin(t * 4.71 + seed * 37.719) * 0.2
  );
}

// Keyframes: keys = [[t, value], ...]; value may be a number or an array.
export function kf(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const u = ease((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

// Fall-then-bounce used for label cards and drops: 0 at t<=0, reaches 1 at
// t=fall (accelerating), then a small damped overshoot that settles at 1.
export function dropBounce(t, fall = 0.16, amp = 0.07, freq = 3.0, damp = 7) {
  if (t <= 0) return 0;
  if (t < fall) return Math.pow(t / fall, 2);
  const u = t - fall;
  return 1 + amp * Math.exp(-damp * u) * Math.sin(2 * Math.PI * freq * u);
}

// Quick punch-in amount (0..1) starting at t0.
export const punch = (t, t0, dur = 0.14) => eOut(inv(t0, t0 + dur, t));
