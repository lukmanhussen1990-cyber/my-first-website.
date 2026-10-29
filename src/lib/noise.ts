/** Small, fast, deterministic noise helpers for procedural texture generation. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash → [0, 1). */
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (i: number, p: number) => ((i % p) + p) % p;

/** Tileable 2D value noise with integer period `p` (in lattice cells). */
export function valueNoise2(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const x0 = wrap(xi, p);
  const y0 = wrap(yi, p);
  const x1 = wrap(xi + 1, p);
  const y1 = wrap(yi + 1, p);
  const a = hash3(x0, y0, 0, seed);
  const b = hash3(x1, y0, 0, seed);
  const c = hash3(x0, y1, 0, seed);
  const d = hash3(x1, y1, 0, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

/** Tileable 2D fBm in [0, 1]. Coordinates are in [0, 1) texture space. */
export function fbm2(u: number, v: number, basePeriod: number, octaves: number, seed: number, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(u * period, v * period, period, seed + o * 131);
    norm += amp;
    amp *= gain;
    period *= 2;
  }
  return sum / norm;
}

/** Tileable 3D value noise with integer period `p`. */
export function valueNoise3(x: number, y: number, z: number, p: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);
  const x0 = wrap(xi, p), x1 = wrap(xi + 1, p);
  const y0 = wrap(yi, p), y1 = wrap(yi + 1, p);
  const z0 = wrap(zi, p), z1 = wrap(zi + 1, p);
  const c000 = hash3(x0, y0, z0, seed);
  const c100 = hash3(x1, y0, z0, seed);
  const c010 = hash3(x0, y1, z0, seed);
  const c110 = hash3(x1, y1, z0, seed);
  const c001 = hash3(x0, y0, z1, seed);
  const c101 = hash3(x1, y0, z1, seed);
  const c011 = hash3(x0, y1, z1, seed);
  const c111 = hash3(x1, y1, z1, seed);
  return lerp(
    lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf),
    lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf),
    zf,
  );
}
