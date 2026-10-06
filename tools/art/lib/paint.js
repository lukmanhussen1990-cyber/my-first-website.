/*
 * Shared painting helpers for art pieces. Deterministic (seeded) so renders
 * are reproducible. Import from a piece with:
 *   import { rng, setup, done, ... } from '../lib/paint.js';
 */

/** Mulberry32 seeded PRNG → () => [0,1) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Read the active <meta name="art"> (by ?v=) and size the canvas. */
export function setup() {
  const v = Number(new URLSearchParams(location.search).get('v') || 0);
  const metas = [...document.querySelectorAll('meta[name="art"]')];
  const m = metas[v] ?? metas[0];
  const scale = Number(m.dataset.scale || 1);
  const W = Math.round(Number(m.dataset.w) * scale);
  const H = Math.round(Number(m.dataset.h) * scale);
  const canvas = document.getElementById('c');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  window.__variant = v;
  return { canvas, ctx, W, H, scale, variant: v, out: m.dataset.out };
}

export function done() {
  window.__done = true;
}

/** Offscreen canvas helper. */
export function layer(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return { c, ctx: c.getContext('2d') };
}

/** Value-noise based fBm, sampled into a grayscale layer (0..255 in alpha or rgb). */
export function noiseField(W, H, { seed = 1, scale = 0.004, octaves = 5, gain = 0.5 } = {}) {
  const r = rng(seed);
  const G = 256;
  const grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const smooth = (t) => t * t * (3 - 2 * t);
  const sample = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const i00 = grid[((yi & 255) * G + (xi & 255))];
    const i10 = grid[((yi & 255) * G + ((xi + 1) & 255))];
    const i01 = grid[(((yi + 1) & 255) * G + (xi & 255))];
    const i11 = grid[(((yi + 1) & 255) * G + ((xi + 1) & 255))];
    return (i00 * (1 - xf) + i10 * xf) * (1 - yf) + (i01 * (1 - xf) + i11 * xf) * yf;
  };
  return (x, y) => {
    let amp = 1, freq = scale, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= 2;
    }
    return sum / norm;
  };
}

/** Paint fog/smoke into ctx using an fBm field with the given rgb colour. */
export function paintFog(ctx, W, H, { seed = 3, color = [255, 40, 50], alpha = 0.35, scale = 0.003, octaves = 5, mask = null, step = 2 } = {}) {
  const f = noiseField(W, H, { seed, scale: scale, octaves });
  const lw = Math.ceil(W / step), lh = Math.ceil(H / step);
  const { c, ctx: l } = layer(lw, lh);
  const img = l.createImageData(lw, lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const n = f(x * step, y * step);
      let a = Math.max(0, n - 0.35) / 0.65;
      a = a * a;
      if (mask) a *= mask(x * step / W, y * step / H);
      const i = (y * lw + x) * 4;
      img.data[i] = color[0];
      img.data[i + 1] = color[1];
      img.data[i + 2] = color[2];
      img.data[i + 3] = Math.min(255, a * 255 * alpha * 2.2);
    }
  }
  l.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, W, H);
  ctx.restore();
}

/** Monochrome film grain over the whole canvas. */
export function grain(ctx, W, H, { amount = 14, seed = 9 } = {}) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Radial glow (additive). */
export function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', String(alpha)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Rain streaks. */
export function rain(ctx, W, H, { count = 900, seed = 21, color = 'rgba(220,220,235,A)', alpha = 0.18, angle = 0.12, len = [12, 34], width = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * W * 1.1 - W * 0.05;
    const y = r() * H;
    const l = len[0] + r() * (len[1] - len[0]);
    ctx.strokeStyle = color.replace('A', String(alpha * (0.4 + r() * 0.6)));
    ctx.lineWidth = width * (0.6 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * angle, y + l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Vignette darkening toward the edges. */
export function vignette(ctx, W, H, strength = 0.65) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
