// Small math helpers shared by all modules.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
// Frame-rate independent exponential smoothing: move `a` toward `b` with rate `k` (1/s).
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
// Wrap angle to (-PI, PI].
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const angleDiff = (from, to) => wrapAngle(to - from);
export const dampAngle = (a, b, k, dt) => a + angleDiff(a, b) * (1 - Math.exp(-k * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Deterministic PRNG (mulberry32) — use for procedural content so layouts are stable.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalised progress helper for poses: map u in [a,b] → 0..1 (clamped).
export const seg = (u, a, b) => clamp((u - a) / Math.max(1e-6, b - a), 0, 1);
