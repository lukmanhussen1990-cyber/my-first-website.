// Small pure helpers. Everything in this project is a function of time t (seconds) = frame / fps.

export type Vec3 = [number, number, number];

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const invLerp = (a: number, b: number, x: number) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x: number, a: number, b: number, c: number, d: number) => lerp(c, d, clamp(invLerp(a, b, x)));
export const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp(invLerp(a, b, x));
  return k * k * (3 - 2 * k);
};
export const smootherstep = (a: number, b: number, x: number) => {
  const k = clamp(invLerp(a, b, x));
  return k * k * k * (k * (k * 6 - 15) + 10);
};

export const ease = {
  linear: (k: number) => k,
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  inOutQuint: (k: number) => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2),
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  outQuint: (k: number) => 1 - Math.pow(1 - k, 5),
  inCubic: (k: number) => k * k * k,
  outBack: (k: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
};
export type EaseName = keyof typeof ease;

/** 0..1 progress of t through [a, b] with easing. */
export const prog = (t: number, a: number, b: number, e: EaseName = "inOutCubic") => ease[e](clamp(invLerp(a, b, t)));

export const v3lerp = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const v3add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const v3sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const v3len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Keyframed number/vector tracks: piecewise eased segments. */
export type Key<T> = { t: number; v: T; e?: EaseName };
export function keyNum(keys: Key<number>[], t: number): number {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) return lerp(a.v, b.v, ease[b.e ?? "inOutCubic"](invLerp(a.t, b.t, t)));
  }
  return keys[keys.length - 1].v;
}
export function keyVec(keys: Key<Vec3>[], t: number): Vec3 {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) return v3lerp(a.v, b.v, ease[b.e ?? "inOutCubic"](invLerp(a.t, b.t, t)));
  }
  return keys[keys.length - 1].v;
}

/** Hex colour helpers (for CSS overlays and mood blending). */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]: [number, number, number]) {
  const c = (x: number) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mixHex(a: string, b: string, k: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)]);
}
