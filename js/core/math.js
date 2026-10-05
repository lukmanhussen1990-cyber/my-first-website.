// Small scalar helpers shared across the game.

export const TAU = Math.PI * 2;

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const saturate = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (x - a) / (b - a);
export const remap = (a, b, c, d, x) => lerp(c, d, saturate(invLerp(a, b, x)));

export function smoothstep(a, b, x) {
  const t = saturate((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach of `current` toward `target`. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(current, target, lambda, dt) {
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/**
 * Critically-damped / under-damped spring integrated with semi-implicit Euler
 * in fixed sub-steps so it stays stable when the frame rate dips.
 */
export class Spring {
  constructor(stiffness = 60, damping = 12, value = 0) {
    this.k = stiffness;
    this.c = damping;
    this.x = value;
    this.v = 0;
  }

  update(target, dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = this.k * (target - this.x) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  impulse(v) {
    this.v += v;
  }
}

/** Piecewise-linear keyframe track: keys = [[t, value], ...] sorted by t. */
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
}

export function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
