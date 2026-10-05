// Seeded gradient (Perlin) noise in 1D/2D/3D with optional tiling,
// used for road shape, terrain and procedural textures.

import { RNG } from './rng.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export class Noise {
  constructor(seed = 1) {
    const rng = new RNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    // 1D gradients in [-1, 1]
    this.g1 = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.g1[i] = rng.next() * 2 - 1;
  }

  /** Smooth 1D gradient noise, roughly in [-1, 1], C2 continuous. */
  n1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const P = this.perm;
    const g0 = this.g1[P[i & 255]];
    const g1 = this.g1[P[(i + 1) & 255]];
    const u = fade(f);
    return 2 * (g0 * f * (1 - u) + g1 * (f - 1) * u);
  }

  _grad2(h, x, y) {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  /** 2D Perlin noise in about [-1, 1]. `period` (integer) makes it tile. */
  n2(x, y, period = 0) {
    const P = this.perm;
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    let xi1 = xi + 1;
    let yi1 = yi + 1;
    if (period > 0) {
      xi = ((xi % period) + period) % period;
      yi = ((yi % period) + period) % period;
      xi1 = (xi + 1) % period;
      yi1 = (yi + 1) % period;
    }
    xi &= 255; yi &= 255; xi1 &= 255; yi1 &= 255;
    const u = fade(xf);
    const v = fade(yf);
    const aa = P[P[xi] + yi];
    const ab = P[P[xi] + yi1];
    const ba = P[P[xi1] + yi];
    const bb = P[P[xi1] + yi1];
    const x1 = this._grad2(aa, xf, yf) + u * (this._grad2(ba, xf - 1, yf) - this._grad2(aa, xf, yf));
    const x2 = this._grad2(ab, xf, yf - 1) + u * (this._grad2(bb, xf - 1, yf - 1) - this._grad2(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 0.95;
  }

  _grad3(h, x, y, z) {
    const hh = h & 15;
    const u = hh < 8 ? x : y;
    const v = hh < 4 ? y : hh === 12 || hh === 14 ? x : z;
    return ((hh & 1) === 0 ? u : -u) + ((hh & 2) === 0 ? v : -v);
  }

  /** 3D Perlin noise in about [-1, 1]. `period` (integer) makes it tile. */
  n3(x, y, z, period = 0) {
    const P = this.perm;
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    let xi1 = xi + 1;
    let yi1 = yi + 1;
    let zi1 = zi + 1;
    if (period > 0) {
      xi = ((xi % period) + period) % period;
      yi = ((yi % period) + period) % period;
      zi = ((zi % period) + period) % period;
      xi1 = (xi + 1) % period;
      yi1 = (yi + 1) % period;
      zi1 = (zi + 1) % period;
    }
    xi &= 255; yi &= 255; zi &= 255; xi1 &= 255; yi1 &= 255; zi1 &= 255;
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const g = this._grad3;
    const aaa = P[P[P[xi] + yi] + zi];
    const aba = P[P[P[xi] + yi1] + zi];
    const aab = P[P[P[xi] + yi] + zi1];
    const abb = P[P[P[xi] + yi1] + zi1];
    const baa = P[P[P[xi1] + yi] + zi];
    const bba = P[P[P[xi1] + yi1] + zi];
    const bab = P[P[P[xi1] + yi] + zi1];
    const bbb = P[P[P[xi1] + yi1] + zi1];
    const l = (a, b, t) => a + t * (b - a);
    const x1 = l(g(aaa, xf, yf, zf), g(baa, xf - 1, yf, zf), u);
    const x2 = l(g(aba, xf, yf - 1, zf), g(bba, xf - 1, yf - 1, zf), u);
    const y1 = l(x1, x2, v);
    const x3 = l(g(aab, xf, yf, zf - 1), g(bab, xf - 1, yf, zf - 1), u);
    const x4 = l(g(abb, xf, yf - 1, zf - 1), g(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = l(x3, x4, v);
    return l(y1, y2, w) * 0.95;
  }

  fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5, period = 0) {
    let a = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += a * this.n2(x * f, y * f, period ? period * f : 0);
      norm += a;
      a *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }

  fbm3(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5, period = 0) {
    let a = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += a * this.n3(x * f, y * f, z * f, period ? period * f : 0);
      norm += a;
      a *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }
}
