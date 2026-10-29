// Seeded, frame-pure randomness (never Math.random).
export const hash = (n: number) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const rand = (seed: number, i = 0) => hash(seed * 7919 + i * 104729 + 17);
export const randRange = (seed: number, i: number, a: number, b: number) => a + (b - a) * rand(seed, i);

export const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// smooth 1D value noise in [-1, 1]
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = rand(seed, i) * 2 - 1;
  const b = rand(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
};
export const fbm1 = (x: number, seed = 0) => noise1(x, seed) * 0.6 + noise1(x * 2.1, seed + 9) * 0.3 + noise1(x * 4.3, seed + 23) * 0.1;

// 2D value noise in [-1, 1]
export const noise2 = (x: number, y: number, seed = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const r = (a: number, b: number) => rand(seed, a * 374761 + b * 668265) * 2 - 1;
  const top = r(xi, yi) + (r(xi + 1, yi) - r(xi, yi)) * u;
  const bot = r(xi, yi + 1) + (r(xi + 1, yi + 1) - r(xi, yi + 1)) * u;
  return top + (bot - top) * v;
};
