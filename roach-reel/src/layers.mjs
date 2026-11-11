// Cached offscreen layers (for blurred depth-of-field backgrounds) + ambient particles.
import { createCanvas } from '@napi-rs/canvas';
import { TAU, rng, rgb } from './core.mjs';

const LAYERS = new Map();
/** Render drawFn once into an offscreen canvas (optionally blurred) and cache it. */
export function layer(key, w, h, drawFn, blur = 0, pad = 0) {
  let c = LAYERS.get(key);
  if (c) return c;
  const src = createCanvas(w, h);
  const g = src.getContext('2d');
  drawFn(g);
  if (blur > 0) {
    c = createCanvas(w, h);
    const g2 = c.getContext('2d');
    g2.drawImage(src, 0, 0);
    g2.filter = `blur(${blur}px)`;
    g2.drawImage(src, 0, 0);
    g2.filter = 'none';
  } else c = src;
  LAYERS.set(key, c);
  return c;
}

/** floating dust motes catching moonlight */
export function dust(ctx, t, x, y, w, h, n = 40, seed = 1, col = [210, 225, 255], a = 0.5) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = R() * w, by = R() * h, sp = 8 + R() * 18, ph = R() * TAU, r = 1.2 + R() * 3.2;
    const px = x + ((bx + Math.sin(t * 0.4 + ph) * 30 + t * sp * 0.6) % w + w) % w;
    const py = y + ((by - t * sp + Math.cos(t * 0.3 + ph) * 20) % h + h) % h;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + ph * 3);
    ctx.fillStyle = rgb(col, a * tw);
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
}
