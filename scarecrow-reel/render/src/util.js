// Shared helpers: seeded random, noise, easing and small animation tools.
// Everything here is deterministic so any frame can be rendered on its own.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const easeInBack = (t, s = 1.70158) => { t = clamp(t); return (s + 1) * t * t * t - s * t * t; };

// 0 -> 1 with a small damped overshoot: "snap into place with a bounce".
export function snap(t, t0, dur = 0.45, bounce = 0.18) {
  if (t <= t0) return 0;
  const x = (t - t0) / dur;
  if (x >= 2.2) return 1;
  return 1 - Math.exp(-4.2 * x) * Math.cos(x * Math.PI * 2.1) * (1 - bounce) - bounce * Math.exp(-6 * x) * Math.cos(x * 9);
}

// Pop-in scale: 0 -> overshoot -> 1.
export function pop(t, t0, dur = 0.4) {
  if (t <= t0) return 0;
  const x = (t - t0) / dur;
  if (x >= 2.5) return 1;
  return Math.max(0, 1 - Math.exp(-5 * x) * Math.cos(x * 7.5));
}

// Pulse that rises fast and decays: for flashes and impacts.
export const pulse = (t, t0, attack = 0.04, decay = 0.3) =>
  t < t0 ? 0 : t < t0 + attack ? (t - t0) / attack : Math.exp(-(t - t0 - attack) / decay);

// Smooth bump between a and b with soft edges.
export const window01 = (t, a, b, fade = 0.2) => smooth(seg(t, a - fade, a)) * (1 - smooth(seg(t, b, b + fade)));

// Piecewise keyframe track. keys: [[time, value, easeFn?], ...]; value may be number or array.
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i];
      const [t1, v1, e] = keys[i + 1];
      if (t <= t1) {
        const u = (e || easeInOut)((t - t0) / (t1 - t0));
        return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// --- seeded random ---
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rng(seed) {
  const r = mulberry32(seed);
  const f = () => r();
  f.range = (a, b) => a + (b - a) * r();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  f.pick = (arr) => arr[Math.floor(r() * arr.length)];
  f.sign = () => (r() < 0.5 ? -1 : 1);
  return f;
}

// --- noise ---
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const mod = (a, n) => ((a % n) + n) % n;

// Value noise, optionally periodic (px, py > 0) so textures tile.
export function vnoise(x, y, seed = 0, px = 0, py = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  let x0 = ix, x1 = ix + 1, y0 = iy, y1 = iy + 1;
  if (px) { x0 = mod(x0, px); x1 = mod(x1, px); }
  if (py) { y0 = mod(y0, py); y1 = mod(y1, py); }
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, oct = 5, seed = 0, px = 0, py = 0) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, seed + i * 17, px * f, py * f);
    n += a; a *= 0.5; f *= 2;
  }
  return s / n;
}
// 1D smooth noise for animation wobble.
export function noise1(t, seed = 0) { return vnoise(t, 0.5, seed) * 2 - 1; }
