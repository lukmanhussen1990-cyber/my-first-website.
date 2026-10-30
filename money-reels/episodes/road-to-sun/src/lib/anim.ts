import {staticFile, useCurrentFrame} from 'remotion';
import timeline from '../data/timeline.json';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const T = timeline.t;
export const SC = timeline.scenes as unknown as Record<string, [number, number]>;
export const DURATION = timeline.duration;
export const GREEN = '#3DFF3A';
export const INK = '#1E1E24';

/** Global time in seconds. Every scene works in global seconds so it lines up with timeline.json. */
export const useT = () => useCurrentFrame() / FPS;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number) => x * x * x;
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5);
export const backOut = (x: number, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);

/** Scale for a bouncy pop-in that starts at t0. */
export const pop = (t: number, t0: number, dur = 0.35, s = 2.4) => {
  const x = prog(t, t0, t0 + dur);
  return x <= 0 ? 0 : backOut(x, s);
};

/** Squash-and-stretch impulse at t0, returns [scaleX, scaleY]. */
export const squash = (t: number, t0: number, amt = 0.16, dur = 0.5): [number, number] => {
  const x = (t - t0) / dur;
  if (x < 0 || x > 1) return [1, 1];
  const s = amt * Math.exp(-5 * x) * Math.cos(x * Math.PI * 3);
  return [1 + s, 1 - s];
};

export const breathe = (t: number, seed = 0) => 1 + 0.014 * Math.sin(t * 2 * Math.PI * 0.42 + seed);
export const sway = (t: number, seed = 0, amp = 1.2) => amp * Math.sin(t * 2 * Math.PI * 0.27 + seed);

export const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(lerp(ch(pa, s), ch(pb, s), clamp(t)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** Deterministic pseudo-random numbers. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const img = (name: string) => staticFile(`img/${name}.png`);

/** Is t inside [a, b) with optional padding? */
export const within = (t: number, a: number, b: number, pad = 0) => t >= a - pad && t < b + pad;

/** Road length in km for a dollar amount ($1 bill = 15.6 cm). */
export const roadKm = (dollars: number) => dollars * 0.000156;

export const formatKm = (km: number) =>
  km < 10 ? km.toFixed(2) : Math.round(km).toLocaleString('en-US');
