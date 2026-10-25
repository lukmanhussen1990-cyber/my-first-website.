// Small deterministic helpers: RNG, noise, easing, keyframes, splines.
// Everything in the film is a pure function of time, so any frame can be
// rendered on its own (and frames can be rendered in parallel).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outBackSoft: (t) => ease.outBack(t, 1.2),
  // damped spring: overshoots once or twice and settles (the "snap into place" bounce)
  spring: (t, k = 6.5, damp = 5.2) => (t >= 1 ? 1 : 1 - Math.exp(-damp * t) * Math.cos(k * t)),
  outBounceSmall: (t) => 1 - Math.exp(-6 * t) * Math.cos(10 * t) * (1 - t),
};

// popScale: 0 before t0, springs to 1 with a small overshoot and settles exactly at 1
export function popScale(t, t0, dur = 0.45) {
  if (t <= t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 2.0) return 1;
  const v = 1 - Math.exp(-4.6 * u) * Math.cos(7.0 * u);
  const w = smoothstep(1.4, 2.0, u);
  return v * (1 - w) + w;
}
// a one-off "boing" pulse 0 -> 1 -> 0
export const pulse = (t, t0, dur) => { const u = (t - t0) / dur; return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); };

// Keyframes: [[time, value, easeName?], ...]; value is number or array.
// The ease on a key applies to the segment arriving at that key.
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const fn = typeof e === 'function' ? e : ease[e || 'inOutCubic'];
      const u = fn((t - t0) / (t1 - t0 || 1));
      if (Array.isArray(v0)) return v0.map((a, j) => a + (v1[j] - a) * u);
      return v0 + (v1 - v0) * u;
    }
  }
  return keys[keys.length - 1][1];
}

// Monotone cubic (Fritsch–Carlson) interpolation per component: smooth, no overshoot,
// velocity continuous through the keys. keys: [[t, [x,y,z]], ...]
export function makeSpline(keys) {
  const n = keys.length;
  const ts = keys.map((k) => k[0]);
  const dim = Array.isArray(keys[0][1]) ? keys[0][1].length : 1;
  const vals = keys.map((k) => (Array.isArray(k[1]) ? k[1] : [k[1]]));
  const tangents = [];
  for (let d = 0; d < dim; d++) {
    const y = vals.map((v) => v[d]);
    const delta = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) delta.push((y[i + 1] - y[i]) / (ts[i + 1] - ts[i]));
    m[0] = 0; m[n - 1] = 0; // start and end at rest
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * (ts[i + 1] - ts[i]) + (ts[i] - ts[i - 1]);
        const w2 = (ts[i + 1] - ts[i]) + 2 * (ts[i] - ts[i - 1]);
        m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
      }
    }
    tangents.push(m);
  }
  return function (t) {
    if (t <= ts[0]) return vals[0].slice();
    if (t >= ts[n - 1]) return vals[n - 1].slice();
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i];
    const s = (t - ts[i]) / h;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s;
    const h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    const out = [];
    for (let d = 0; d < dim; d++) {
      out.push(h00 * vals[i][d] + h10 * h * tangents[d][i] + h01 * vals[i + 1][d] + h11 * h * tangents[d][i + 1]);
    }
    return out;
  };
}

// --- noise ---------------------------------------------------------------
const PERM = new Uint8Array(512);
(function () {
  const r = mulberry32(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1), G2c = (3 - Math.sqrt(3)) / 6;
export function simplex2(xin, yin) {
  let n0 = 0, n1 = 0, n2 = 0;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2c;
  const x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2c, y1 = y0 - j1 + G2c;
  const x2 = x0 - 1 + 2 * G2c, y2 = y0 - 1 + 2 * G2c;
  const ii = i & 255, jj = j & 255;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = G2[PERM[ii + PERM[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = G2[PERM[ii + i1 + PERM[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = G2[PERM[ii + 1 + PERM[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * (n0 + n1 + n2);
}
export function fbm2(x, y, oct = 5, lac = 2.0, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { s += a * simplex2(x * f + o * 17.3, y * f - o * 9.1); n += a; a *= gain; f *= lac; }
  return s / n;
}
// tileable-ish hash for scatter
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
