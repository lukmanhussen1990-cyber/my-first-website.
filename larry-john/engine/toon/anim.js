// Animation helpers: easing, springs, squash & stretch, noise, keyframes.
// Everything is a pure function of time so any frame can be rendered on its own.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeIn = (t) => clamp(t) ** 2;
export const easeOut = (t) => 1 - (1 - clamp(t)) ** 2;
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3;
export const easeInCubic = (t) => clamp(t) ** 3;
export const easeInOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const easeInBack = (t, s = 1.70158) => { t = clamp(t); return t * t * ((s + 1) * t - s); };
export const easeOutElastic = (t) => {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};
export const easeOutBounce = (t) => {
  t = clamp(t); const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

// Damped spring response to a step at t=0 (0 → 1 with overshoot and settle).
export function spring(t, freq = 3, damp = 0.35) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  return 1 - Math.exp(-damp * w * t) * Math.cos(w * Math.sqrt(1 - damp * damp) * t);
}
// Decaying wobble (for settle after an impact): starts at 0, wobbles, ends at 0.
export function wobble(t, freq = 4, decay = 5) {
  if (t <= 0) return 0;
  return Math.sin(2 * Math.PI * freq * t) * Math.exp(-decay * t);
}

// "Pop in": 0 → overshoot → 1 (scale), good for things appearing with a bounce.
export function popIn(t, dur = 0.35) {
  if (t <= 0) return 0;
  return spring(t / dur * 0.6, 1.6, 0.32);
}

// Squash & stretch scale that keeps volume: s>1 stretches up, s<1 squashes.
export function squashScale(s) { const k = 1 / Math.sqrt(Math.max(0.05, s)); return [k, s, k]; }

// Deterministic random numbers.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// Smooth 1D value noise in [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.3) * 2 - 1, b = hash1(i + 1 + seed * 57.3) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
// Fractal noise for handheld camera shake.
export function fbm1(x, seed = 0) {
  return noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.28 + noise1(x * 4.37, seed + 13) * 0.12;
}

// Keyframe track: keys = [[t, value, ease?], ...]; value may be number or array.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, ease] = keys[i + 1];
    if (t <= t1) {
      const u = (ease || smooth)((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((x, k) => lerp(x, v1[k], u));
      return lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

// Blink: returns lid closure 0..1 for deterministic blinks every few seconds.
export function blink(t, seed = 1, every = 3.2) {
  const r = mulberry32(seed * 7919);
  let s = r() * every, last = -10;
  for (let k = 0; k < 5000 && s <= t; k++) { last = s; s += every * (0.55 + r() * 0.9); }
  const d = t - last;
  if (d < 0 || d > 0.16) return 0;
  return d < 0.06 ? d / 0.06 : 1 - (d - 0.06) / 0.1;
}

export const deg = (d) => d * Math.PI / 180;
