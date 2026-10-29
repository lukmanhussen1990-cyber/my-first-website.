// Pure easing helpers; everything is a function of time in seconds.
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const mix = (a: number, b: number, t: number, t0: number, t1: number, ease = inOut) => lerp(a, b, ease(prog(t, t0, t1)));

export const inOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const out = (k: number) => 1 - Math.pow(1 - k, 3);
export const outQuint = (k: number) => 1 - Math.pow(1 - k, 5);
export const inCubic = (k: number) => k * k * k;
export const outBack = (k: number, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
export const sine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);

// Damped spring step response from 0 to 1, t in seconds since trigger.
export const spring = (t: number, freq = 3.2, damping = 0.45) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = damping;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
};
// Decaying wobble that starts at 0, peaks, and settles at 0 (for squash, shake, follow-through).
export const wobble = (t: number, freq = 4, decay = 5) => (t <= 0 ? 0 : Math.sin(2 * Math.PI * freq * t) * Math.exp(-decay * t));
// 0 -> 1 -> 0 envelope over [a, b] with soft edges
export const window = (t: number, a: number, b: number, fadeIn = 0.25, fadeOut = 0.25) =>
  Math.min(prog(t, a, a + fadeIn), 1 - prog(t, b - fadeOut, b));
