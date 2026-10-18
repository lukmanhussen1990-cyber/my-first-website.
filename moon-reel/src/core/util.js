// Small math / animation helpers. Every animation in the reel is a pure function of time.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (x, a, b) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => {
  const t = remap(x, a, b);
  return t * t * (3 - 2 * t);
};
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inQuart: (t) => t * t * t * t,
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

// Keyframe track: keys = [[time, value, easeName?], ...]; value may be a number or an array.
// The easing named on a key shapes the segment that ends at that key.
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last[1];
    let i = 1;
    while (keys[i][0] < t) i++;
    const [t0, v0] = keys[i - 1];
    const [t1, v1, e] = keys[i];
    const f = (ease[e || 'inOutCubic'] || ease.inOutCubic)((t - t0) / (t1 - t0));
    if (Array.isArray(v0)) return v0.map((a, k) => lerp(a, v1[k], f));
    return lerp(v0, v1, f);
  };
}

// Deterministic PRNG.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth pseudo-random wobble in [-1, 1] (sum of incommensurate sines), used for camera shake/drift.
export function wobble(t, seed = 0) {
  return (
    Math.sin(t * 13.1 + seed * 1.7) * 0.5 +
    Math.sin(t * 23.7 + seed * 4.1) * 0.3 +
    Math.sin(t * 41.3 + seed * 2.3) * 0.2
  );
}

// Impact shake envelope: sharp attack, exponential decay.
export function shakeEnv(t, at, dur = 0.5) {
  if (t < at) return 0;
  const x = (t - at) / dur;
  return x > 1 ? 0 : Math.exp(-4.5 * x) * (1 - x);
}

// Shared GLSL snippets.
export const GLSL_NOISE = /* glsl */ `
vec3 hash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// gradient noise, roughly in [-1, 1]
float gnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0));
  float b = dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0));
  float c = dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0));
  float d = dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0));
  float e = dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1));
  float f1 = dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1));
  float g = dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1));
  float h = dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z) * 1.6;
}
float fbm(vec3 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * gnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;
