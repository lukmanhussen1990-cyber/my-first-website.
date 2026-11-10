// Math / easing / deterministic noise helpers. Everything in the film is a pure function of time.
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sat = (x) => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => sat((t - a) / (b - a));
export const smooth = (t) => { t = sat(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const ease = {
  in: (t) => { t = sat(t); return t * t * t; },
  out: (t) => { t = sat(t); return 1 - Math.pow(1 - t, 3); },
  inOut: (t) => { t = sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  outQuint: (t) => { t = sat(t); return 1 - Math.pow(1 - t, 5); },
  outExpo: (t) => { t = sat(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  inOutQuint: (t) => { t = sat(t); return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; },
  outBack: (t, s = 1.70158) => { t = sat(t); const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; },
  inBack: (t, s = 1.70158) => { t = sat(t); return (s + 1) * t * t * t - s * t * t; },
  outElastic: (t) => { t = sat(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; },
};
// damped spring step response: 0 -> 1 with overshoot. x = seconds since trigger.
export function spring(x, freq = 5, damp = 7) {
  if (x <= 0) return 0;
  return 1 - Math.exp(-damp * x) * Math.cos(TAU * freq * x);
}
// pop scale: 0 -> ~1.15 -> 1
export function pop(t, t0, dur = 0.32) {
  const x = (t - t0) / dur; if (x <= 0) return 0; if (x >= 1) return 1;
  return ease.outBack(x, 2.6);
}
// impulse: quick rise then exponential decay; peak 1 at t0+attack
export function impulse(t, t0, attack = 0.03, decay = 0.25) {
  const x = t - t0; if (x <= 0) return 0;
  if (x < attack) return x / attack;
  return Math.exp(-(x - attack) / decay);
}
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f);
  return lerp(hash1(i + seed * 57.3), hash1(i + 1 + seed * 57.3), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) { let a = 0, amp = 1, fr = 1, n = 0; for (let i = 0; i < oct; i++) { a += noise1(x * fr, seed + i * 11.1) * amp; n += amp; amp *= 0.5; fr *= 2.03; } return a / n; }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function noise2(x, y, seed = 0) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), ux), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy) * 2 - 1;
}
