// Overlay layer: word-by-word captions, comic callouts, watermark, vignette, grain, flashes, camera helpers.
import { createCanvas } from '@napi-rs/canvas';
import { W, H, TAU, clamp, lerp, E, pop, rng, rgb, hex, noise1 } from './core.mjs';
import { CAPTIONS } from './timeline.mjs';

const CAP_COL = { white: '#ffffff', yellow: '#ffe14d', pink: '#ff3d9a' };
const CAP_Y = 1320, CAP_SIZE = 104, CAP_MAXW = 940;

export function drawCaptions(ctx, t) {
  const chunk = CAPTIONS.find((c) => t >= c.start - 0.02 && t < c.hold);
  if (!chunk) return;
  // layout all words of the chunk at a fixed size so nothing re-centres while words appear
  let size = CAP_SIZE;
  const gap = 0.26;
  let widths, total;
  for (;;) {
    ctx.font = `${size}px "Luckiest Guy"`;
    widths = chunk.words.map((w) => ctx.measureText(w.text).width);
    total = widths.reduce((a, b) => a + b, 0) + chunk.words.reduce((a, w, i) => a + (i < chunk.words.length - 1 && !w.text.endsWith('-') ? size * gap : 0), 0);
    if (total <= CAP_MAXW || size < 60) break;
    size -= 4;
  }
  // fade out at end of hold
  const out = clamp((chunk.hold - t) / 0.08);
  let x = W / 2 - total / 2;
  chunk.words.forEach((w, i) => {
    const wx = x + widths[i] / 2;
    x += widths[i] + (i < chunk.words.length - 1 && !w.text.endsWith('-') ? size * gap : 0);
    if (t < w.start - 0.03) return;
    const lt = t - (w.start - 0.03);
    // pop: 0.8 -> 1.1 -> 1.0
    let s;
    if (lt < 0.08) s = lerp(0.8, 1.1, E.outQuad(lt / 0.08));
    else if (lt < 0.2) s = lerp(1.1, 1.0, E.inOutSine((lt - 0.08) / 0.12));
    else s = 1;
    const a = clamp(lt / 0.05) * out;
    const emph = w.color !== 'white';
    ctx.save();
    ctx.translate(wx, CAP_Y + (emph ? -2 : 0));
    ctx.scale(s, s);
    if (emph) ctx.rotate(Math.sin(i * 2.1 + chunk.start) * 0.025);
    ctx.globalAlpha = a;
    ctx.font = `${size}px "Luckiest Guy"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    // drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = size * 0.2;
    ctx.strokeText(w.text, 4, size * 0.11);
    ctx.fillText(w.text, 4, size * 0.11);
    // outline + fill
    ctx.strokeStyle = '#000'; ctx.lineWidth = size * 0.19;
    ctx.strokeText(w.text, 0, 0);
    ctx.fillStyle = CAP_COL[w.color];
    ctx.fillText(w.text, 0, 0);
    // subtle top sheen
    ctx.save();
    ctx.beginPath(); ctx.rect(-widths[i], -size * 0.6, widths[i] * 2, size * 0.42); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText(w.text, 0, 0);
    ctx.restore();
    ctx.restore();
  });
}

export function drawWatermark(ctx) {
  ctx.save();
  ctx.font = '600 34px "Fredoka"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillText('@garden_reels', W / 2 + 2, 1478 + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('@garden_reels', W / 2, 1478);
  ctx.restore();
}

/** comic onomatopoeia: text, at (x,y), start time, colors */
export function callout(ctx, t, t0, text, x, y, o = {}) {
  const dur = o.dur ?? 0.9;
  if (t < t0 || t > t0 + dur) return;
  const lt = t - t0;
  const s = pop(t, t0, 0.28) * (o.size || 1);
  const a = clamp((t0 + dur - t) / 0.18);
  const size = 120 * (o.scale || 1);
  ctx.save();
  ctx.translate(x + Math.sin(lt * 50) * 6 * Math.exp(-lt * 8), y - lt * (o.rise ?? 40));
  ctx.rotate(o.rot ?? -0.12);
  ctx.scale(s, s);
  ctx.globalAlpha = a;
  ctx.font = `${size}px "Luckiest Guy"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  // burst behind
  if (o.burst !== false) {
    const R = rng(text.length * 13 + 7);
    ctx.fillStyle = o.burstCol || 'rgba(255,255,255,0.0)';
    const w = ctx.measureText(text).width;
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU, rr = (i % 2 ? 0.62 : 1) * (1 + R() * 0.15);
      const px = Math.cos(ang) * (w * 0.62 + 30) * rr, py = Math.sin(ang) * (size * 0.95) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    if (o.burstCol) { ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(text, 6, 10);
  ctx.strokeStyle = '#000'; ctx.lineWidth = size * 0.28; ctx.strokeText(text, 0, 0);
  ctx.strokeStyle = o.edge || '#ff3d9a'; ctx.lineWidth = size * 0.13; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = o.fill || '#ffffff'; ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- post layers
let VIG = null, GRAIN = [];
export function initPost() {
  VIG = createCanvas(W, H);
  const g = VIG.getContext('2d');
  const grd = g.createRadialGradient(W / 2, H * 0.46, H * 0.22, W / 2, H * 0.5, H * 0.72);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // paper grain textures (half-res, scaled up softly)
  for (let k = 0; k < 4; k++) {
    const gw = 540, gh = 960;
    const c = createCanvas(gw, gh);
    const cg = c.getContext('2d');
    const img = cg.createImageData(gw, gh);
    const R = rng(1000 + k);
    for (let i = 0; i < gw * gh; i++) {
      const v = 128 + (R() - 0.5) * 120 + (R() - 0.5) * 40;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    GRAIN.push(c);
  }
}

export function post(ctx, t, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.vig ?? 1;
  ctx.drawImage(VIG, 0, 0);
  ctx.globalAlpha = 0.055;
  ctx.globalCompositeOperation = 'overlay';
  const f = Math.floor(t * 30) % GRAIN.length;
  ctx.drawImage(GRAIN[f], 0, 0, W, H);
  ctx.restore();
}

export function flash(ctx, col, a) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function letterbox(ctx, k, h = 210) {
  if (k <= 0) return;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, h * k);
  ctx.fillRect(0, H - h * k, W, h * k);
}

/** Apply a camera: scene point (x,y) to screen centre, with zoom/rot/shake. depth<1 = parallax background. */
export function camera(ctx, c, depth = 1) {
  const x0 = c.x0 ?? W / 2, y0 = c.y0 ?? H / 2;
  const x = x0 + (c.x - x0) * depth, y = y0 + (c.y - y0) * depth;
  const z = 1 + (c.zoom - 1) * depth;
  ctx.translate(W / 2 + (c.sx || 0) * depth, H / 2 + (c.sy || 0) * depth);
  ctx.rotate((c.rot || 0) + (c.sr || 0));
  ctx.scale(z, z);
  ctx.translate(-x, -y);
}

/** transform a scene point by the camera (for screen-space lights) */
export function camPoint(c, px, py, depth = 1) {
  const x0 = c.x0 ?? W / 2, y0 = c.y0 ?? H / 2;
  const x = x0 + (c.x - x0) * depth, y = y0 + (c.y - y0) * depth;
  const z = 1 + (c.zoom - 1) * depth;
  const r = (c.rot || 0) + (c.sr || 0);
  let dx = (px - x) * z, dy = (py - y) * z;
  const cs = Math.cos(r), sn = Math.sin(r);
  return [W / 2 + (c.sx || 0) * depth + dx * cs - dy * sn, H / 2 + (c.sy || 0) * depth + dx * sn + dy * cs, z];
}

/** speed lines radiating from a point */
export function speedLines(ctx, cx, cy, a, t, n = 40, col = '255,255,255') {
  if (a <= 0) return;
  const R = rng(Math.floor(t * 20) + 3);
  ctx.save();
  ctx.fillStyle = `rgba(${col},${0.5 * a})`;
  for (let i = 0; i < n; i++) {
    const ang = R() * TAU, r0 = 420 + R() * 300, r1 = r0 + 400 + R() * 600, w = 3 + R() * 9;
    const c = Math.cos(ang), s = Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(cx + c * r0, cy + s * r0);
    ctx.lineTo(cx + c * r1 - s * w, cy + s * r1 + c * w);
    ctx.lineTo(cx + c * r1 + s * w, cy + s * r1 - c * w);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** UI sticker/badge: rounded panel with text, drop shadow */
export function badge(ctx, x, y, text, o = {}) {
  const size = o.size || 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot || 0);
  ctx.scale(o.s ?? 1, o.s ?? 1);
  ctx.globalAlpha *= o.a ?? 1;
  ctx.font = `${size}px "Luckiest Guy"`;
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.35;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -w / 2 + 8, -h / 2 + 12, w, h, h * 0.3); ctx.fill();
  ctx.fillStyle = o.bg || '#ffe14d';
  rr(ctx, -w / 2, -h / 2, w, h, h * 0.3); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.stroke();
  ctx.fillStyle = o.fg || '#111';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ---------------------------------------------------------------- temporal motion blur
let ACC = null, ACC2 = null;
/** Average n sub-frame renders (drawAt(g, dt)) spread over `span` seconds, onto ctx. */
export function motionBlur(ctx, n, span, drawAt) {
  if (!ACC) { ACC = createCanvas(W, H); ACC2 = createCanvas(W, H); }
  const g = ACC.getContext('2d'), g2 = ACC2.getContext('2d');
  for (let i = 0; i < n; i++) {
    const dt = (i / (n - 1) - 0.5) * span;
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalAlpha = 1; g2.fillStyle = '#000'; g2.fillRect(0, 0, W, H);
    g2.save(); drawAt(g2, dt); g2.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1 / (i + 1);
    g.drawImage(ACC2, 0, 0);
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(ACC, 0, 0); ctx.restore();
}
