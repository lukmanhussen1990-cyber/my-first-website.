import { Easing } from 'remotion';

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const easeInOut = Easing.bezier(0.45, 0, 0.25, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.5, 0, 0.9, 0.4);

// 0 before a, 1 after b, eased in between
export function ramp(x: number, a: number, b: number, ease: (t: number) => number = easeInOut) {
  if (b <= a) return x >= a ? 1 : 0;
  return ease(clamp01((x - a) / (b - a)));
}

// rises over [a, a+inLen], holds, falls over [b-outLen, b]
export function window01(x: number, a: number, b: number, inLen: number, outLen = inLen) {
  return Math.min(ramp(x, a, a + inLen), 1 - ramp(x, b - outLen, b));
}

export const mix = (from: Record<string, number>, to: Record<string, number>, t: number) => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(from)) out[k] = lerp(from[k], to[k] ?? from[k], t);
  return out;
};
