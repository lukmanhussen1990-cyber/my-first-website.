/*
 * world-3d — a tiny per-pixel "renderer" used by the trial scenes: pinhole
 * camera, analytic volumetric scattering for point lights in fog, and a few
 * vector helpers. Scenes ray-cast their own simple geometry (planes / boxes)
 * and composite hand-painted 2D detail on top.
 */
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

/**
 * Pinhole camera. World: x right, y up, z forward. pitch > 0 looks up, yaw > 0 turns right.
 */
export function makeCamera({ F, cx, cy, pos = [0, 1.6, 0], pitch = 0, yaw = 0 }) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const fwd = [syw * cp, sp, cyw * cp];
  const right = [cyw, 0, -syw];
  const up = [-syw * sp, cp, -cyw * sp];
  const cam = {
    F, cx, cy, pos, fwd, right, up,
    /** world → [sx, sy, depth] */
    project(p) {
      const d = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
      const zc = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
      const xc = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
      const yc = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
      const z = Math.max(1e-4, zc);
      return [cx + (F * xc) / z, cy - (F * yc) / z, zc];
    },
    /** unit ray direction through screen pixel */
    ray(sx, sy) {
      const a = (sx - cx) / F, b = -(sy - cy) / F;
      const d = [right[0] * a + up[0] * b + fwd[0], right[1] * a + up[1] * b + fwd[1], right[2] * a + up[2] * b + fwd[2]];
      const l = Math.hypot(d[0], d[1], d[2]);
      return [d[0] / l, d[1] / l, d[2] / l];
    },
    /** screen scale (px per metre) at a world point */
    scaleAt(p) {
      const d = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
      const zc = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
      return F / Math.max(1e-4, zc);
    },
  };
  return cam;
}

/**
 * In-scattered light from a point light at Lp along a ray o + s·d, s ∈ [0, t]
 * with 1/r² falloff: ∫ ds / |o + s d − Lp|² (closed form). Multiply by intensity·density.
 */
export function scatter(o, d, t, Lp) {
  const ox = Lp[0] - o[0], oy = Lp[1] - o[1], oz = Lp[2] - o[2];
  const tc = ox * d[0] + oy * d[1] + oz * d[2];
  const h2 = Math.max(1e-6, ox * ox + oy * oy + oz * oz - tc * tc);
  const h = Math.sqrt(h2);
  return (Math.atan((t - tc) / h) - Math.atan(-tc / h)) / h;
}

/** Directional "spot" variant: scatter weighted toward a cone axis (cheap approximation). */
export function scatterCone(o, d, t, Lp, axis, cosOuter, cosInner) {
  // sample a few points along the ray inside the analytic envelope
  const base = scatter(o, d, t, Lp);
  if (base <= 0) return 0;
  const ox = Lp[0] - o[0], oy = Lp[1] - o[1], oz = Lp[2] - o[2];
  const tc = Math.max(0, Math.min(t, ox * d[0] + oy * d[1] + oz * d[2]));
  // point of closest approach → direction from light
  const px = o[0] + d[0] * tc - Lp[0], py = o[1] + d[1] * tc - Lp[1], pz = o[2] + d[2] * tc - Lp[2];
  const pl = Math.hypot(px, py, pz) || 1;
  const c = (px * axis[0] + py * axis[1] + pz * axis[2]) / pl;
  const k = Math.max(0, Math.min(1, (c - cosOuter) / (cosInner - cosOuter)));
  return base * k * k * (3 - 2 * k);
}

/** Run fn(x, y, out) for every pixel and write into ImageData (rgb 0..1+, alpha 1). */
export function renderPixels(ctx, W, H, fn, { y0 = 0, y1 = H } = {}) {
  const img = ctx.createImageData(W, y1 - y0);
  const d = img.data;
  const out = [0, 0, 0, 1];
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      out[3] = 1;
      fn(x + 0.5, y + 0.5, out);
      const i = ((y - y0) * W + x) * 4;
      d[i] = out[0] * 255;
      d[i + 1] = out[1] * 255;
      d[i + 2] = out[2] * 255;
      d[i + 3] = out[3] * 255;
    }
  }
  ctx.putImageData(img, 0, y0);
}

/** Filmic tone curve (ACES-ish approximation), input linear-ish 0..∞ → 0..1. */
export function tone(v) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return Math.max(0, Math.min(1, (v * (a * v + b)) / (v * (c * v + d) + e)));
}

/** 2D value noise sampler with smooth interpolation, tileable on 256 grid. */
export function valueNoise(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const G = 256;
  const g = new Float32Array(G * G);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const X0 = xi & 255, X1 = (xi + 1) & 255, Y0 = (yi & 255) * G, Y1 = ((yi + 1) & 255) * G;
    const a0 = g[Y0 + X0], a1 = g[Y0 + X1], b0 = g[Y1 + X0], b1 = g[Y1 + X1];
    return (a0 + (a1 - a0) * xf) * (1 - yf) + (b0 + (b1 - b0) * xf) * yf;
  };
  n.fbm = (x, y, oct = 4, gain = 0.5) => {
    let s = 0, amp = 1, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      s += n(x * f, y * f) * amp;
      norm += amp;
      amp *= gain;
      f *= 2.03;
    }
    return s / norm;
  };
  return n;
}
