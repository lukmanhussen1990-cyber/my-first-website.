// Shared helpers: deterministic randomness, noise, easing and keyframes.
// Everything in the film is a pure function of time, so any frame can be
// rendered on its own (and in parallel) and always looks the same.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;
export const deg = Math.PI / 180;

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  smooth: (t) => t * t * (3 - 2 * t),
  hold: () => 0,
};

// keys: [[t, value, easeName?], ...] sorted by t. The ease of a key shapes the
// segment that *ends* at that key. Values may be numbers or arrays.
export function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  const n = list.length;
  if (t >= list[n - 1][0]) return list[n - 1][1];
  let i = 1;
  while (list[i][0] < t) i++;
  const [t0, v0] = list[i - 1], [t1, v1, e = 'inOut'] = list[i];
  const u = ease[e]((t - t0) / (t1 - t0));
  if (Array.isArray(v0)) return v0.map((a, k) => a + (v1[k] - a) * u);
  return v0 + (v1 - v0) * u;
}

// Smooth (C1) interpolation through keys using Catmull-Rom style tangents.
export function spline(list, t) {
  const n = list.length;
  if (t <= list[0][0]) return list[0][1];
  if (t >= list[n - 1][0]) return list[n - 1][1];
  let i = 1;
  while (list[i][0] < t) i++;
  const p0 = list[Math.max(0, i - 2)], p1 = list[i - 1], p2 = list[i], p3 = list[Math.min(n - 1, i + 1)];
  const h = p2[0] - p1[0], u = (t - p1[0]) / h;
  const tan = (a, b) => (b[0] - a[0] > 1e-9 ? (b[1] - a[1]) / (b[0] - a[0]) : 0);
  const m1 = (i - 1 === 0 ? tan(p1, p2) : tan(p0, p2)) * h;
  const m2 = (i === n - 1 ? tan(p1, p2) : tan(p1, p3)) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
}

// Integrates a speed profile once so position(t) is a smooth, exact lookup.
export class Integrated {
  constructor(speedFn, t0, t1, dt = 1 / 600, x0 = 0) {
    this.t0 = t0; this.dt = dt;
    const n = Math.ceil((t1 - t0) / dt) + 2;
    this.x = new Float64Array(n);
    let x = x0, prev = speedFn(t0);
    this.x[0] = x;
    for (let k = 1; k < n; k++) {
      const v = speedFn(t0 + k * dt);
      x += 0.5 * (prev + v) * dt; prev = v;
      this.x[k] = x;
    }
  }
  at(t) {
    const f = (t - this.t0) / this.dt;
    const k = clamp(Math.floor(f), 0, this.x.length - 2), u = clamp(f - k, 0, 1);
    return this.x[k] + (this.x[k + 1] - this.x[k]) * u;
  }
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

export function hash1(n) { // deterministic [0,1) from a number
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// 2D value noise + fbm (CPU side, for terrain heights and placement)
function vhash(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = vhash(ix, iy), b = vhash(ix + 1, iy), c = vhash(ix, iy + 1), d = vhash(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

// Halton low-discrepancy sequence for sub-frame jitter.
export function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

// GLSL snippets shared by the procedural materials.
export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy + p3.yxx)*p3.zyx); }
float vnoise2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.-2.*f);
  float a = hash13(i), b = hash13(i+vec3(1,0,0)), c = hash13(i+vec3(0,1,0)), d = hash13(i+vec3(1,1,0));
  float e = hash13(i+vec3(0,0,1)), g = hash13(i+vec3(1,0,1)), h = hash13(i+vec3(0,1,1)), k = hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z); }
float fbm2(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise2(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vnoise3(p); p = p * 2.03 + 11.3; a *= .5; } return s; }
float cell3(vec3 x){ vec3 n = floor(x), f = fract(x); float d1 = 8.;
  for (int k=-1;k<=1;k++) for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec3 g = vec3(i,j,k); vec3 r = g + hash33(n+g) - f; d1 = min(d1, dot(r,r)); }
  return sqrt(d1); }
// Voronoi: returns (distance to nearest feature, distance to 2nd nearest, cell id)
vec3 voronoi2(vec2 x){ vec2 n = floor(x), f = fract(x); float d1 = 8., d2 = 8.; float id = 0.;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){ vec2 g = vec2(i,j); vec2 o = hash22(n+g); vec2 r = g + o - f; float d = dot(r,r);
    if (d < d1){ d2 = d1; d1 = d; id = hash12(n+g+7.7); } else if (d < d2) d2 = d; }
  return vec3(sqrt(d1), sqrt(d2), id); }
`;
