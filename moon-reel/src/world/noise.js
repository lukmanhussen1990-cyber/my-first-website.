// Seeded 2D gradient noise for CPU-side terrain generation.
import { rng } from '../core/util.js';

export function makeNoise2D(seed = 1) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    const a = (h & 7) * (Math.PI / 4);
    return Math.cos(a) * x + Math.sin(a) * y;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.42;
  };
  const fbm = (x, y, oct = 5) => {
    let s = 0;
    let a = 0.5;
    for (let i = 0; i < oct; i++) {
      s += a * noise(x, y);
      x = x * 2.02 + 17.1;
      y = y * 2.02 + 3.7;
      a *= 0.5;
    }
    return s;
  };
  const ridged = (x, y, oct = 5) => {
    let s = 0;
    let a = 0.5;
    let w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(noise(x, y));
      n *= n * w;
      w = Math.min(1, Math.max(0, n * 2));
      s += a * n;
      x = x * 2.03 + 11.3;
      y = y * 2.03 + 7.9;
      a *= 0.5;
    }
    return s;
  };
  return { noise, fbm, ridged };
}
