// Seeded randomness and noise. Never Math.random(): every render must be identical.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof rngFrom>;
export function rngFrom(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a: number, b: number) => a + (b - a) * r(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * r()),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length],
    sign: () => (r() < 0.5 ? -1 : 1),
  };
}

/** Integer hash -> [0,1). */
export function hash1(n: number) {
  let x = Math.imul((n | 0) ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca77);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}
export function hash2(x: number, y: number, seed = 0) {
  return hash1(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(seed | 0, 83492791));
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smooth 2D value noise in [-1, 1]. */
export function noise2(x: number, y: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm2(x: number, y: number, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Smooth 1D noise in [-1,1] for drifts and sways. */
export function noise1(x: number, seed = 0) {
  return noise2(x, 0.5, seed);
}
