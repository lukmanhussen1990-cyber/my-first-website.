// Palette, paper texture, film grain and hand-inked line helpers.
import { TAU, clamp, lerp, rng, vnoise, hash } from './util.js';

export const C = {
  paper: '#F3ECDE',
  paperDeep: '#E9E0CE',
  ink: '#2A2521',
  inkSoft: 'rgba(42,37,33,0.55)',
  gold: '#F5B731',
  goldLight: '#FFD86B',
  goldShade: '#E2921E',
  goldHi: '#FFF2C9',
  terra: '#D8744E',
  terraDeep: '#B9583A',
  terraLight: '#E89A78',
  cream: '#FBF5E8',
  creamEdge: '#E4D6BD',
  mouth: '#3A1F18',
  tongue: '#D9674A',
  shadow: 'rgba(92,62,32,0.20)',
};

// ---------------------------------------------------------------------------
// Paper: a seamless tile (periodic value noise + fibres) drawn world-locked.
function periodicNoise(w, h, cell, seed) {
  const gx = Math.round(w / cell);
  const gy = Math.round(h / cell);
  const r = rng(seed);
  const grid = new Float32Array(gx * gy);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  return (x, y) => {
    const fx = (x / w) * gx;
    const fy = (y / h) * gy;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const x0 = ((ix % gx) + gx) % gx;
    const y0 = ((iy % gy) + gy) % gy;
    const x1 = (x0 + 1) % gx;
    const y1 = (y0 + 1) % gy;
    const a = grid[y0 * gx + x0];
    const b = grid[y0 * gx + x1];
    const c = grid[y1 * gx + x0];
    const d = grid[y1 * gx + x1];
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy) * 2 - 1;
  };
}

export function makePaperTile(w = 2048, h = 1152, seed = 7) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const n1 = periodicNoise(w, h, 256, seed);
  const n2 = periodicNoise(w, h, 64, seed + 1);
  const n3 = periodicNoise(w, h, 16, seed + 2);
  const r = rng(seed + 3);
  const base = [243, 236, 222];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = n1(x, y) * 0.018 + n2(x, y) * 0.009 + n3(x, y) * 0.006 + (r() - 0.5) * 0.016;
      const i = (y * w + x) * 4;
      d[i] = clamp(base[0] * (1 + v), 0, 255);
      d[i + 1] = clamp(base[1] * (1 + v * 1.02), 0, 255);
      d[i + 2] = clamp(base[2] * (1 + v * 1.08), 0, 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Fibres: short, faint, curved strokes. Drawn with wrap-around copies.
  const fr = rng(seed + 9);
  for (let k = 0; k < 520; k++) {
    const x = fr() * w;
    const y = fr() * h;
    const len = 6 + fr() * 26;
    const a = fr() * TAU;
    const bend = (fr() - 0.5) * 0.9;
    const dark = fr() < 0.62;
    ctx.strokeStyle = dark ? `rgba(120,95,60,${0.05 + fr() * 0.07})` : `rgba(255,252,244,${0.18 + fr() * 0.2})`;
    ctx.lineWidth = 0.6 + fr() * 0.8;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(
          x + ox + Math.cos(a + bend) * len * 0.5,
          y + oy + Math.sin(a + bend) * len * 0.5,
          x + ox + Math.cos(a) * len,
          y + oy + Math.sin(a) * len,
        );
        ctx.stroke();
      }
    }
  }
  // A few tiny inclusions.
  for (let k = 0; k < 70; k++) {
    const x = fr() * w;
    const y = fr() * h;
    ctx.fillStyle = `rgba(110,85,55,${0.08 + fr() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + fr() * 1.1, 0, TAU);
    ctx.fill();
  }
  return cv;
}

// Soft, screen-locked film grain frames (cycled at 12 fps).
export function makeGrainFrames(count = 4, w = 960, h = 540, seed = 21) {
  const frames = [];
  for (let f = 0; f < count; f++) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const r = rng(seed + f * 101);
    for (let i = 0; i < w * h; i++) {
      const g = (r() + r() + r() - 1.5) * 0.66; // approx gaussian, sd ~0.33
      const v = clamp(128 + g * 70, 0, 255);
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    frames.push(cv);
  }
  return frames;
}

export function makeVignette(w = 1920, h = 1080) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.35, w / 2, h / 2, h * 1.15);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(226,214,192,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return cv;
}

// ---------------------------------------------------------------------------
// Ink helpers

// Displace a polyline perpendicular to itself with smooth noise (hand wobble).
export function wobble(pts, amp, seed, freq = 0.02) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const o = pts[Math.max(i - 1, 0)];
    if (i > 0) acc += Math.hypot(p[0] - o[0], p[1] - o[1]);
    let nx = -(q[1] - o[1]);
    let ny = q[0] - o[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const n = vnoise(acc * freq, seed) * amp;
    out.push([p[0] + nx * n, p[1] + ny * n]);
  }
  return out;
}

// Variable-width brush stroke along a polyline (tapered ends, round caps).
export function brush(ctx, pts, w, color, opts = {}) {
  const taper = opts.taper ?? 0.18;
  const minW = opts.minW ?? 0.45;
  const seed = opts.seed ?? 1;
  const jit = opts.widthJitter ?? 0.12;
  const n = pts.length;
  if (n < 2) return;
  const lens = [0];
  for (let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = lens[n - 1] || 1;
  const left = [];
  const right = [];
  const widths = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, n - 1)];
    const o = pts[Math.max(i - 1, 0)];
    let tx = q[0] - o[0];
    let ty = q[1] - o[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const u = lens[i] / L;
    const tp = Math.min(1, u / taper, (1 - u) / taper);
    const prof = minW + (1 - minW) * Math.sin((Math.min(1, tp) * Math.PI) / 2);
    const ww = (w * prof * (1 + vnoise(lens[i] * 0.03, seed) * jit)) / 2;
    widths.push(ww);
    left.push([p[0] - ty * ww, p[1] + tx * ww]);
    right.push([p[0] + ty * ww, p[1] - tx * ww]);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pts[0][0], pts[0][1], widths[0], 0, TAU);
  ctx.arc(pts[n - 1][0], pts[n - 1][1], widths[n - 1], 0, TAU);
  ctx.fill();
}

// Sample a quadratic / cubic bezier into points.
export function bez(p0, p1, p2, p3, steps = 24) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    if (p3) {
      out.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
      ]);
    } else {
      out.push([m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0], m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1]]);
    }
  }
  return out;
}

// Closed wobbly rounded rectangle as points (for hand-drawn boxes).
export function roundRectPts(x, y, w, h, r, stepsPerCorner = 6) {
  const pts = [];
  const corners = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= stepsPerCorner; i++) {
      const a = a0 + (i / stepsPerCorner) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

export function pathFrom(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

// Soft blurred ellipse (contact shadow) using the offset-shadow trick.
// Assumes the current transform has no rotation (true for world space).
export function softEllipse(ctx, x, y, rx, ry, color, blur) {
  if (rx <= 0.5 || ry <= 0.2) return;
  const m = ctx.getTransform();
  const sc = Math.hypot(m.a, m.b) || 1;
  const off = 10000 / sc;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * sc;
  ctx.shadowOffsetX = 10000;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x - off, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Current uniform scale of the canvas transform (camera zoom).
export function curScale(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

// Apply a device-space drop shadow scaled with the camera zoom.
export function setShadow(ctx, dx, dy, blur, color) {
  const sc = curScale(ctx);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * sc;
  ctx.shadowOffsetX = dx * sc;
  ctx.shadowOffsetY = dy * sc;
}

// Rough inked circle-ish polygon (for dots, suns, etc.) with boil seed.
export function blobPts(cx, cy, r, seed, amp = 0.04, n = 48) {
  const pts = [];
  const ph = [hash(1, seed) * TAU, hash(2, seed) * TAU, hash(3, seed) * TAU];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + amp * (Math.sin(2 * a + ph[0]) * 0.5 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.15));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
