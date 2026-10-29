import {Easing, interpolate, random} from 'remotion';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const ease = Easing.bezier(0.33, 0, 0.2, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

/** 0 → 1 over [start, start + dur], eased. */
export const prog = (frame: number, start: number, dur: number, e = ease) =>
  dur <= 0 ? (frame >= start ? 1 : 0) : e(clamp((frame - start) / dur));

export const progInOut = (frame: number, start: number, dur: number) =>
  prog(frame, start, dur, easeInOut);

/** Fade in at `start`, optionally fade out at `end`. */
export const fade = (frame: number, start: number, dur = 10, end?: number, outDur = 10) => {
  const a = prog(frame, start, dur);
  if (end === undefined) return a;
  return a * (1 - prog(frame, end, outDur));
};

/**
 * Pop-in: scale 0 → 1.08 → 1.0 over ~10 frames. Monotone overshoot, no
 * wobble, so text never jiggles.
 */
export const pop = (frame: number, start: number, dur = 10) => {
  const t = (frame - start) / dur;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.65) return interpolate(t, [0, 0.65], [0, 1.08], {easing: Easing.out(Easing.cubic)});
  return interpolate(t, [0.65, 1], [1.08, 1], {easing: easeInOut});
};

/** Slow camera push-in for a scene (1.00 → 1.06 by default). */
export const pushIn = (frame: number, start: number, dur: number, to = 1.06) =>
  lerp(1, to, progInOut(frame, start, dur));

/** Seeded, frame-pure jitter in [-1, 1]. */
export const jitter = (seed: string | number, frame: number, hold = 2) =>
  random(`${seed}-${Math.floor(frame / hold)}`) * 2 - 1;

/** Smooth seeded wobble (sum of sines with seeded phases). */
export const wobble = (seed: string | number, frame: number, speed = 1) => {
  const p1 = random(`${seed}-a`) * Math.PI * 2;
  const p2 = random(`${seed}-b`) * Math.PI * 2;
  const t = (frame / 30) * speed;
  return 0.6 * Math.sin(t * 2.1 + p1) + 0.4 * Math.sin(t * 3.7 + p2);
};

/** Gentle idle bob in px. */
export const bob = (frame: number, seed = 0, amp = 3, period = 70) =>
  Math.sin(((frame + seed * 17) / period) * Math.PI * 2) * amp;

export const sid = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');
