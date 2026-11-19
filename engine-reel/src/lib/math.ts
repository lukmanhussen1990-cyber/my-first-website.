export type V3 = [number, number, number];

export const DEG = Math.PI / 180;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) =>
  a === b ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
};
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const v3lerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const EASE = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t: number) => t * t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
export type EaseName = keyof typeof EASE;

/** Deterministic pseudo-random in [0,1) — same input, same output, every render. */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
export const rand = (i: number, salt: number) => hash(i * 17.171 + salt * 101.37);
export const randRange = (i: number, salt: number, a: number, b: number) => lerp(a, b, rand(i, salt));

/** 0 before a → ramps to 1 at b → back to 0 at c. */
export const bump = (a: number, b: number, c: number, x: number) => {
  if (x <= a || x >= c) return 0;
  return x < b ? smoothstep(a, b, x) : 1 - smoothstep(b, c, x);
};

/** Smooth-ish 1D noise built from incommensurate sines (deterministic, cheap). */
export const wobble = (t: number, seed: number) =>
  (Math.sin(t * 1.7 + seed * 3.1) * 0.5 + Math.sin(t * 2.9 + seed * 7.3) * 0.3 + Math.sin(t * 5.3 + seed * 1.9) * 0.2);

/** Interpolate a list of scalar keyframes ({t, v, ease}) — ease shapes the move INTO a key. */
export function interpKeys(keys: { t: number; v: number; ease?: EaseName }[], t: number) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t < b.t) {
      const a = keys[i - 1];
      const p = (t - a.t) / (b.t - a.t);
      return lerp(a.v, b.v, EASE[b.ease ?? 'linear'](p));
    }
  }
  return keys[keys.length - 1].v;
}
