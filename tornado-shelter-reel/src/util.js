// Small math / easing / randomness helpers. Everything in the animation is a
// pure function of time, so any frame can be rendered independently.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInQuad = (t) => t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const linear = (t) => t;
export const easeOutBack = (t, s = 1.70158) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
export const easeInBack = (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t;
export const easeOutElastic = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
export const easeOutBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

// normalized progress of t inside [t0, t0+dur]
export const prog = (t, t0, dur) => clamp((t - t0) / dur);

// "pop in": 0 before t0, springs past 1 and settles at 1 (the snap-into-place bounce)
export const popIn = (t, t0, dur = 0.42, s = 2.4) => {
  const p = prog(t, t0, dur);
  return p <= 0 ? 0 : p >= 1 ? 1 : easeOutBack(p, s);
};
// "pop out": 1 before t0, swells a little then shrinks to 0
export const popOut = (t, t0, dur = 0.32) => {
  const p = prog(t, t0, dur);
  return p <= 0 ? 1 : p >= 1 ? 0 : 1 - easeInBack(p, 2.2);
};
// damped oscillation that starts at t0 (for wobbles after an impact)
export const wobble = (t, t0, freq = 3, damp = 5) => {
  const x = t - t0;
  return x <= 0 ? 0 : Math.exp(-damp * x) * Math.sin(2 * Math.PI * freq * x);
};
// 0 -> 1 -> 0 bump shaped window
export const bump = (t, t0, t1, fade = 0.2) => {
  if (t <= t0 || t >= t1) return 0;
  return Math.min(smooth(clamp((t - t0) / fade)), smooth(clamp((t1 - t) / fade)));
};

// Keyframe track: [[time, value, ease?], ...]; ease belongs to the segment
// that ends at that key.
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) {
        const p = keys[i - 1];
        const u = (t - p[0]) / Math.max(1e-6, k[0] - p[0]);
        return p[1] + (k[1] - p[1]) * (k[2] || smooth)(u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash1 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.0), b = hash1(i + 1 + seed * 57.0);
  return (a + (b - a) * smooth(f)) * 2 - 1;
}

// Halton low-discrepancy sequence (sub-pixel jitter, light jitter)
export function halton(i, base) {
  let f = 1, r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

// Cubic bezier in 2D for car paths
export function bezier2(p0, p1, p2, p3, u) {
  const v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

// Polyline path helper: points [[x,y,z],...]; returns {at(u)->[x,y,z], length}
export function polyPath(points) {
  const seg = [];
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push([L, l]);
    L += l;
  }
  return {
    length: L,
    at(u) {
      const d = clamp(u) * L;
      for (let i = 0; i < seg.length; i++) {
        const [s, l] = seg[i];
        if (d <= s + l || i === seg.length - 1) {
          const k = l > 0 ? clamp((d - s) / l) : 0;
          const a = points[i], b = points[i + 1];
          return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
        }
      }
      return points[points.length - 1].slice();
    },
  };
}

// Monotone cubic interpolation (Fritsch-Carlson) through keys [[t, v], ...]:
// C1-smooth, never overshoots, and flat wherever two neighbouring keys are equal,
// so camera holds stay still and moves ease in and out without jerks.
export function monotone(keys) {
  const n = keys.length;
  const t = keys.map((k) => k[0]), v = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / Math.max(1e-9, t[i + 1] - t[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= t[0]) return v[0];
    if (x >= t[n - 1]) return v[n - 1];
    let i = 0;
    while (x > t[i + 1]) i++;
    const h = t[i + 1] - t[i], u = (x - t[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
