/** Small vector / scalar helpers shared across the simulation. */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate `from` towards `to` by at most `maxStep` radians. */
export function turnTowards(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

/** Move `v` towards `target` by at most `step`. */
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}

/** Length of the vector, or 0. */
export const len = (x, y) => Math.hypot(x, y);

/** Returns [x, y] scaled to unit length (or [0, 0]). */
export function normalise(x, y) {
  const l = Math.hypot(x, y);
  if (l < 1e-6) return [0, 0];
  return [x / l, y / l];
}

/**
 * Shortest distance from point p to the segment ab, plus the closest point.
 * Used for pass-lane and shot-lane interception checks.
 */
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / l2;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { distance: Math.hypot(px - cx, py - cy), t, x: cx, y: cy };
}

/** Gaussian-ish noise in [-1, 1], biased towards zero. */
export function noise() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

/** Deterministic-ish pseudo random from a seed, for crowd/atmosphere detail. */
export function hashRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
