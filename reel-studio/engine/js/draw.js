// Low-level drawing: backgrounds, textured text, cards, torn strips, stamps,
// hand-drawn strokes with draw-on progress.
import { W, H, makeCanvas, rng, strSeed, clamp, lerp, COLORS, rgba } from './util.js';
import { FONTS } from './assets.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// ---------- noise helpers ----------
function addPixelNoise(ctx, w, h, amount, seed, tint = [1, 1, 1]) {
  const d = ctx.getImageData(0, 0, w, h), p = d.data, r = rng(seed);
  for (let i = 0; i < p.length; i += 4) {
    const n = (r() - 0.5) * 2 * amount;
    p[i] = clamp(p[i] + n * tint[0], 0, 255);
    p[i + 1] = clamp(p[i + 1] + n * tint[1], 0, 255);
    p[i + 2] = clamp(p[i + 2] + n * tint[2], 0, 255);
  }
  ctx.putImageData(d, 0, 0);
}

function mottle(ctx, w, h, count, seed, light, dark, maxR) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, rad = maxR * (0.3 + r() * 0.7);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? light : dark;
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function fibers(ctx, w, h, count, seed, alpha = 0.06) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, len = 6 + r() * 26, ang = r() * Math.PI * 2;
    const light = r() < 0.55;
    ctx.strokeStyle = light ? `rgba(255,248,230,${alpha * (0.6 + r())})` : `rgba(80,55,25,${alpha * (0.4 + r() * 0.8)})`;
    ctx.lineWidth = 0.5 + r() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang + 0.6) * len * 0.5, y + Math.sin(ang + 0.6) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
}

// ---------- backgrounds ----------
export function paperBackground() {
  return cached('paperBG', () => {
    const c = makeCanvas(W, H), x = c.getContext('2d');
    // lit centre -> darker edges (elliptical)
    x.save(); x.translate(W / 2, H * 0.47); x.scale(1, 1.55);
    const g = x.createRadialGradient(0, 0, 40, 0, 0, 760);
    g.addColorStop(0, '#dccaa7'); g.addColorStop(0.42, '#d0b98f');
    g.addColorStop(0.74, '#bba27a'); g.addColorStop(1, '#9d8762');
    x.fillStyle = g; x.fillRect(-W, -H, W * 2, H * 2); x.restore();
    mottle(x, W, H, 70, 11, 'rgba(255,245,220,0.05)', 'rgba(90,60,30,0.045)', 260);
    mottle(x, W, H, 260, 12, 'rgba(255,245,220,0.04)', 'rgba(90,60,30,0.035)', 60);
    fibers(x, W, H, 900, 13, 0.05);
    // specks
    const r = rng(14);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(70,45,20,${0.08 + r() * 0.16})`;
      x.beginPath(); x.arc(r() * W, r() * H, 0.6 + r() * 1.3, 0, Math.PI * 2); x.fill();
    }
    // vertical crease / column lines
    for (const [cx, k] of [[36, 0.8], [666, 1]]) {
      const cg = x.createLinearGradient(cx - 9, 0, cx + 9, 0);
      cg.addColorStop(0, 'rgba(70,45,20,0)'); cg.addColorStop(0.5, `rgba(70,45,20,${0.10 * k})`); cg.addColorStop(1, 'rgba(70,45,20,0)');
      x.fillStyle = cg; x.fillRect(cx - 9, 0, 18, H);
      x.fillStyle = `rgba(255,248,232,${0.07 * k})`; x.fillRect(cx + 5, 0, 2, H);
    }
    addPixelNoise(x, W, H, 7, 15, [1, 0.95, 0.85]);
    return c;
  });
}

export function xrayBackground() {
  return cached('xrayBG', () => {
    const c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = COLORS.xrayBg; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H * 0.5); x.scale(1, 1.5);
    const g = x.createRadialGradient(0, 0, 30, 0, 0, 780);
    g.addColorStop(0, 'rgba(48,48,40,0.55)'); g.addColorStop(0.6, 'rgba(30,30,25,0.2)'); g.addColorStop(1, 'rgba(6,6,4,0.55)');
    x.fillStyle = g; x.fillRect(-W, -H, W * 2, H * 2); x.restore();
    // grid
    x.lineWidth = 1;
    for (const [vx, a] of [[90, 0.05], [675, 0.11], [990, 0.05]]) { x.strokeStyle = `rgba(230,230,215,${a})`; x.beginPath(); x.moveTo(vx + 0.5, 0); x.lineTo(vx + 0.5, H); x.stroke(); }
    for (let y = 580; y < H; y += 320) { x.strokeStyle = 'rgba(230,230,215,0.045)'; x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(W, y + 0.5); x.stroke(); }
    // small crosses on the grid
    x.strokeStyle = 'rgba(230,230,215,0.12)';
    for (const vx of [90, 675, 990]) for (let y = 580; y < H; y += 320) { x.beginPath(); x.moveTo(vx - 7, y + 0.5); x.lineTo(vx + 8, y + 0.5); x.moveTo(vx + 0.5, y - 7); x.lineTo(vx + 0.5, y + 8); x.stroke(); }
    // right ruler squares
    x.fillStyle = 'rgba(205,205,192,0.16)';
    for (let y = 280; y <= 1510; y += 62) x.fillRect(1012, y, 22, 15);
    // tiny vertical text
    x.save(); x.translate(972, 690); x.rotate(Math.PI / 2);
    x.font = `15px "${FONTS.type}"`; x.fillStyle = 'rgba(215,215,200,0.24)';
    x.letterSpacing = '2px';
    x.fillText('RADIOGRAPH  ·  PLATE 3  ·  SCALE 1:8  ·  NOT TO SCALE', 0, 0);
    x.restore();
    // left ticks
    x.fillStyle = 'rgba(215,215,200,0.2)';
    for (let y = 300; y < H - 100; y += 215) x.fillRect(30, y, 16, 2);
    fibers(x, W, H, 300, 21, 0.025);
    addPixelNoise(x, W, H, 5, 22);
    return c;
  });
}

// Shared overlay that ties images to the paper (static grain, multiplied in).
export function grainOverlay() {
  return cached('grain', () => {
    const c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    addPixelNoise(x, W, H, 26, 31);
    fibers(x, W, H, 500, 32, 0.08);
    return c;
  });
}

// Top rule + labels and the left tick column; drawn per frame (label changes).
export function drawPaperFurniture(ctx, fig, opts = {}) {
  const dark = opts.dark;
  const col = dark ? 'rgba(220,215,200,0.28)' : 'rgba(58,38,18,0.55)';
  ctx.fillStyle = col;
  ctx.fillRect(90, 259, 900, 2);
  ctx.font = `20px "${FONTS.type}"`;
  ctx.letterSpacing = '1px';
  ctx.fillStyle = dark ? 'rgba(220,215,200,0.4)' : 'rgba(58,38,18,0.62)';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillText(opts.fileLabel || 'FILE No. 01', 92, 249);
  ctx.textAlign = 'right'; ctx.fillText(`FIG. ${fig}`, 988, 249);
  ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
  if (!dark) {
    for (let i = 0, y = 320; y < H - 120; y += 107, i++) {
      const s = i % 2 ? 5 : 8;
      ctx.fillStyle = 'rgba(70,48,22,0.33)';
      ctx.fillRect(36 - s / 2, y, s, s);
    }
  }
}

// ---------- text ----------
export function setFont(ctx, family, size, weight = '') {
  ctx.font = `${weight} ${size}px "${family}"`.trim();
}

export function measure(ctx, text, family, size, spacing = 0) {
  setFont(ctx, family, size);
  ctx.letterSpacing = `${spacing}px`;
  const m = ctx.measureText(text).width;
  ctx.letterSpacing = '0px';
  return m;
}

// Title text rendered once with an ink texture (slight speckle, soft edge).
export function inkText(text, family, size, color, opts = {}) {
  const key = `ink:${text}:${family}:${size}:${color}:${opts.spacing || 0}:${opts.texture ?? 1}`;
  return cached(key, () => {
    const probe = makeCanvas(10, 10).getContext('2d');
    const spacing = opts.spacing || 0;
    const tw = measure(probe, text, family, size, spacing);
    const pad = Math.ceil(size * 0.2);
    const c = makeCanvas(tw + pad * 2, size * 1.25 + pad * 2), x = c.getContext('2d');
    setFont(x, family, size);
    x.letterSpacing = `${spacing}px`;
    x.textBaseline = 'alphabetic';
    x.fillStyle = color;
    const base = pad + size * 0.98;
    x.fillText(text, pad, base);
    if ((opts.texture ?? 1) > 0) {
      // knock out a fine speckle so it reads as printed ink
      const r = rng(strSeed(text) + size);
      x.globalCompositeOperation = 'destination-out';
      const n = Math.floor(c.width * c.height / 420 * (opts.texture ?? 1));
      for (let i = 0; i < n; i++) {
        x.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
        const s = 0.6 + r() * 1.6;
        x.fillRect(r() * c.width, r() * c.height, s, s);
      }
      x.globalCompositeOperation = 'source-over';
    }
    return { canvas: c, pad, base, width: tw, size };
  });
}

// ---------- paper props ----------
export function paperTexture(w, h, base = COLORS.card, seed = 1, edge = true) {
  return cached(`ptex:${w}:${h}:${base}:${seed}:${edge}`, () => {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(80,50,20,0.10)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    mottle(x, w, h, Math.max(6, (w * h) / 40000), seed, 'rgba(255,250,235,0.08)', 'rgba(110,80,40,0.06)', Math.max(w, h) * 0.3);
    fibers(x, w, h, (w * h) / 900, seed + 1, 0.05);
    if (edge) {
      x.strokeStyle = 'rgba(120,90,50,0.35)'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2);
    }
    addPixelNoise(x, w, h, 6, seed + 2);
    return c;
  });
}

// Card with a soft drop shadow; returns a padded canvas (pad on all sides).
export function card(w, h, opts = {}) {
  const key = `card:${w}:${h}:${opts.color || ''}:${opts.seed || 0}:${opts.shadow ?? 1}`;
  return cached(key, () => {
    const pad = 46;
    const c = makeCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
    if ((opts.shadow ?? 1) > 0) {
      x.save(); x.filter = 'blur(16px)'; x.fillStyle = `rgba(40,25,10,${0.42 * (opts.shadow ?? 1)})`;
      x.fillRect(pad + 6, pad + 14, w, h); x.restore();
    }
    x.drawImage(paperTexture(w, h, opts.color || COLORS.card, opts.seed || 3), pad, pad);
    return { canvas: c, pad };
  });
}

// Torn paper strip polygon (ragged left/right, slightly uneven top/bottom).
export function tornStrip(w, h, seed = 7, color = '#e7dabd') {
  return cached(`torn:${w}:${h}:${seed}:${color}`, () => {
    const pad = 40, r = rng(seed);
    const c = makeCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
    const pts = [];
    const step = 7;
    for (let px = 0; px <= w; px += step * 3) pts.push([px, (r() - 0.5) * 3]);
    for (let py = 0; py <= h; py += step) pts.push([w + (r() - 0.3) * 9, py]);
    for (let px = w; px >= 0; px -= step * 3) pts.push([px, h + (r() - 0.5) * 3]);
    for (let py = h; py >= 0; py -= step) pts.push([(r() - 0.7) * 9, py]);
    const path = new Path2D();
    pts.forEach(([px, py], i) => (i ? path.lineTo(pad + px, pad + py) : path.moveTo(pad + px, pad + py)));
    path.closePath();
    x.save(); x.filter = 'blur(10px)'; x.translate(4, 9); x.fillStyle = 'rgba(30,18,6,0.45)'; x.fill(path); x.restore();
    x.save(); x.clip(path);
    x.drawImage(paperTexture(w + 20, h + 20, color, seed, false), pad - 10, pad - 10);
    x.restore();
    // fibrous torn edge highlight
    x.strokeStyle = 'rgba(255,250,235,0.55)'; x.lineWidth = 1.5; x.stroke(path);
    return { canvas: c, pad };
  });
}

// Red rubber stamp: double border + letter-spaced text + worn ink.
// Multi-line with "\n"; opts.scales sets a size factor per line.
export function stamp(text, opts = {}) {
  const size = opts.size || 110;
  const color = opts.color || '#b8322a';
  const scales = opts.scales || null;
  return cached(`stamp:${text}:${size}:${color}:${scales}`, () => {
    const probe = makeCanvas(10, 10).getContext('2d');
    const lines = String(text).split('\n');
    const sc = lines.map((_, i) => (scales ? scales[i] ?? 1 : 1));
    const sp = size * 0.06;
    const widths = lines.map((l, i) => measure(probe, l, FONTS.title, size * sc[i], sp * sc[i]));
    const tw = Math.max(...widths);
    const gap = size * 0.1;
    const textH = sc.reduce((a, k) => a + size * k, 0) + gap * (lines.length - 1);
    const bw = tw + size * 0.75, bh = textH + size * 0.42;
    const pad = 20;
    const c = makeCanvas(bw + pad * 2, bh + pad * 2), x = c.getContext('2d');
    x.strokeStyle = color; x.fillStyle = color;
    x.lineWidth = size * 0.07; x.strokeRect(pad + size * 0.06, pad + size * 0.06, bw - size * 0.12, bh - size * 0.12);
    x.lineWidth = size * 0.025; x.strokeRect(pad + size * 0.17, pad + size * 0.17, bw - size * 0.34, bh - size * 0.34);
    x.textBaseline = 'middle'; x.textAlign = 'center';
    let y = pad + (bh - textH) / 2;
    lines.forEach((l, i) => {
      const fs = size * sc[i];
      setFont(x, FONTS.title, fs); x.letterSpacing = `${sp * sc[i]}px`;
      x.fillText(l, pad + bw / 2 + (sp * sc[i]) / 2, y + fs / 2 + fs * 0.04);
      y += fs + gap;
    });
    // worn ink: knock-outs + streaks
    const r = rng(strSeed(text));
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < (bw * bh) / 70; i++) {
      x.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.75})`;
      const s = 0.8 + r() * 3.2; x.fillRect(pad + r() * bw, pad + r() * bh, s, s * (0.5 + r()));
    }
    for (let i = 0; i < 9; i++) {
      x.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.25})`; x.lineWidth = 2 + r() * 6;
      const yy = pad + r() * bh;
      x.beginPath(); x.moveTo(pad, yy); x.lineTo(pad + bw, yy + (r() - 0.5) * 30); x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    return { canvas: c, w: bw + pad * 2, h: bh + pad * 2 };
  });
}

// ---------- hand-drawn strokes ----------
// Build a jittered polyline from control points.
export function wobblyPath(points, seed = 1, amp = 2.2, step = 10) {
  const r = rng(seed), out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([lerp(ax, bx, t) + (r() - 0.5) * amp, lerp(ay, by, t) + (r() - 0.5) * amp]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Stroke a polyline up to progress p (0..1).
export function strokePartial(ctx, pts, p, width, color, opts = {}) {
  if (p <= 0 || pts.length < 2) return;
  let total = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let remain = total * clamp(p);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (opts.dash) ctx.setLineDash(opts.dash);
  if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 10; }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && remain > 0; i++) {
    const l = seg[i - 1];
    if (remain >= l) ctx.lineTo(pts[i][0], pts[i][1]);
    else { const t = remain / l; ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)); }
    remain -= l;
  }
  ctx.stroke(); ctx.restore();
  return total;
}

// Hand-drawn ellipse (marker circle) with overshoot; progress p.
export function markerEllipse(ctx, cx, cy, rx, ry, p, opts = {}) {
  const seed = opts.seed || 5, r = rng(seed);
  const a0 = opts.start ?? -2.4, turns = opts.turns ?? 1.12;
  const pts = [];
  const ph = [r() * 6, r() * 6], amp = [0.035 + r() * 0.02, 0.02];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * Math.PI * 2 * turns;
    const k = 1 + amp[0] * Math.sin(a * 2 + ph[0]) + amp[1] * Math.sin(a * 3 + ph[1]) + t * 0.05;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  strokePartial(ctx, pts, p, opts.width || 6, opts.color || COLORS.red, opts);
}

export function checkMark(ctx, x, y, s, p, color = COLORS.ink, width = 7) {
  const pts = wobblyPath([[x - s * 0.42, y + s * 0.02], [x - s * 0.1, y + s * 0.34], [x + s * 0.55, y - s * 0.48]], 3, 1.5, 6);
  strokePartial(ctx, pts, p, width, color);
}

export function xMark(ctx, x, y, s, p, color = COLORS.redInk, width = 6) {
  const a = wobblyPath([[x - s * 0.4, y - s * 0.4], [x + s * 0.42, y + s * 0.42]], 8, 1.5, 6);
  const b = wobblyPath([[x + s * 0.4, y - s * 0.42], [x - s * 0.42, y + s * 0.4]], 9, 1.5, 6);
  strokePartial(ctx, a, clamp(p * 2), width, color);
  strokePartial(ctx, b, clamp(p * 2 - 1), width, color);
}

export function arrowHead(ctx, x, y, ang, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(size * 0.6, 0); ctx.lineTo(-size * 0.5, -size * 0.5); ctx.lineTo(-size * 0.25, 0); ctx.lineTo(-size * 0.5, size * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Draw an image box with optional soft shadow under it.
export function drawImageBox(ctx, img, x, y, w, h, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(img, x, y, w, h); ctx.restore();
}

export { cached };
