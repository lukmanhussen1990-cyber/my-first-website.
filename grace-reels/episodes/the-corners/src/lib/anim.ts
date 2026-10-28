// Pure, frame-deterministic animation helpers (no timers, no Math.random).

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => (b === a ? 0 : clamp((x - a) / (b - a)));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeIn = (t: number) => t * t * t;
export const easeOutBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/** Map time `t` from [a,b] onto [c,d] with an easing, clamped. */
export const remap = (t: number, a: number, b: number, c: number, d: number, ease: (x: number) => number = smooth) =>
  lerp(c, d, ease(invLerp(a, b, t)));

/** 0→1→0 visibility window with fades (seconds). */
export const win = (t: number, tin: number, tout: number, fin = 0.25, fout = 0.25) =>
  Math.min(smooth(invLerp(tin, tin + fin, t)), 1 - smooth(invLerp(tout - fout, tout, t)));

// ---- seeded randomness ----
export const hash = (n: number) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const rand = (seed: number, i: number) => hash(seed * 7919 + i * 104729 + 17);
export const randRange = (seed: number, i: number, a: number, b: number) => lerp(a, b, rand(seed, i));

/** Smooth 1D value noise in [-1, 1]. */
export const noise1 = (seed: number, x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = rand(seed, i) * 2 - 1;
  const b = rand(seed, i + 1) * 2 - 1;
  return lerp(a, b, smooth(f));
};
/** Gentle seeded "handheld" drift (pixels). */
export const handheld = (seed: number, t: number, amp = 6) => ({
  x: (noise1(seed, t * 0.55) * 0.7 + noise1(seed + 9, t * 1.3) * 0.3) * amp,
  y: (noise1(seed + 3, t * 0.5) * 0.7 + noise1(seed + 11, t * 1.1) * 0.3) * amp,
  r: noise1(seed + 5, t * 0.4) * amp * 0.03,
});

/**
 * Deterministic damped spring that follows `target(t)` from time t0 to t.
 * Re-integrated from t0 every frame, so it is a pure function of the frame number.
 */
export const springFollow = (target: (t: number) => number, t0: number, t: number, stiffness = 60, damping = 9) => {
  const dt = 1 / 120;
  let x = target(t0);
  let v = 0;
  for (let s = t0; s < t; s += dt) {
    const a = stiffness * (target(s) - x) - damping * v;
    v += a * dt;
    x += v * dt;
  }
  return x;
};

/** Pop scale: 0 → overshoot → 1 starting at t0 (overshoot ~ amount). */
export const pop = (t: number, t0: number, dur = 0.35, amount = 0.15) =>
  t < t0 ? 0 : easeOutBack(clamp((t - t0) / dur), amount * 11);

/** Squash pulse around 1 after an impact at t0 (subtle squash & stretch). */
export const squash = (t: number, t0: number, amount = 0.12, dur = 0.3) => {
  if (t < t0 || t > t0 + dur) return 1;
  const k = (t - t0) / dur;
  return 1 - amount * Math.sin(k * Math.PI * 2) * (1 - k);
};

/** Seeded blink: returns eye openness 0..1. */
export const blink = (seed: number, t: number) => {
  let tt = 0.6 + rand(seed, 0) * 1.5;
  let i = 1;
  while (tt < t - 0.2) {
    tt += 2.3 + rand(seed, i++) * 2.4;
  }
  const d = Math.abs(t - tt);
  return d < 0.06 ? 0.05 : d < 0.11 ? 0.5 : 1;
};
