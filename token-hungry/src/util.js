// Small deterministic math toolkit. Every frame is a pure function of time,
// so nothing here keeps state between calls.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);

export const E = {
  lin: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t) => {
    const s = 1.70158;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  outBackSoft: (t) => {
    const s = 0.9;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const s = 1.70158;
    return (s + 1) * t * t * t - s * t * t;
  },
  inOutBack: (t) => {
    const s = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2
      : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2;
  },
};

// Tween between two values over [t0, t1].
export function tw(t, t0, t1, a, b, e = E.inOutCubic) {
  if (t <= t0) return a;
  if (t >= t1) return b;
  return lerp(a, b, e((t - t0) / (t1 - t0)));
}

// Keyframe track: [[time, value, easeIntoThisKey?], ...]
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const p = keys[i - 1];
      const e = k[2] || E.inOutCubic;
      return lerp(p[1], k[1], e((t - p[0]) / (k[0] - p[0])));
    }
  }
  return keys[keys.length - 1][1];
}

// Decaying sine "wobble" triggered at t0 (0 before t0).
export function wob(t, t0, amp, freq = 3, decay = 5) {
  const d = t - t0;
  if (d < 0) return 0;
  return amp * Math.exp(-decay * d) * Math.sin(TAU * freq * d);
}

// Underdamped spring step from a to b, triggered at t0.
export function spr(t, t0, a, b, freq = 2.2, zeta = 0.35) {
  const d = t - t0;
  if (d <= 0) return a;
  const w = TAU * freq;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const env = Math.exp(-zeta * w * d);
  const x = 1 - env * (Math.cos(wd * d) + ((zeta * w) / wd) * Math.sin(wd * d));
  return a + (b - a) * x;
}

// Smooth bump: rises over [t0, t0+a], holds, falls over [t1-b, t1].
export function bump(t, t0, t1, a = 0.1, b = 0.1, e = E.inOutSine) {
  if (t <= t0 || t >= t1) return 0;
  if (t < t0 + a) return e((t - t0) / a);
  if (t > t1 - b) return e((t1 - t) / b);
  return 1;
}

export function hash(i, seed = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1].
export function vnoise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}

export const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export const gauss = (x, w) => Math.exp(-(x * x) / (w * w));

// Ballistic hop helper: parabola height for progress u in [0,1].
export const hopArc = (u) => 4 * u * (1 - u);
