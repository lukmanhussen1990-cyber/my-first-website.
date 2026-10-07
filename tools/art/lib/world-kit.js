/*
 * world-kit — shared painting helpers for the city map and the trial scenes
 * (art-world pieces). Everything is deterministic and procedural.
 *
 *   import { ... } from '../lib/world-kit.js';
 */
import { rng, layer, noiseField } from './paint.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

export { rng, layer, noiseField };

/** Random helpers bound to one PRNG. */
export function rand(seed) {
  const r = rng(seed);
  const f = () => r();
  f.range = (a, b) => a + (b - a) * r();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  f.pick = (arr) => arr[Math.floor(r() * arr.length)];
  f.chance = (p) => r() < p;
  f.gauss = () => (r() + r() + r() + r() - 2) / 2;
  return f;
}

/** Return a blurred copy of a canvas. `down` < 1 renders at reduced size (fast big blurs). */
export function blurred(src, px, down = 1) {
  const w = Math.max(1, Math.round(src.width * down));
  const h = Math.max(1, Math.round(src.height * down));
  const { c, ctx } = layer(w, h);
  ctx.filter = `blur(${Math.max(0.1, px * down)}px)`;
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = 'none';
  return c;
}

/**
 * Additive bloom of `src` onto ctx. passes: [{ r: blurPx, a: alpha }].
 * Large radii are computed on a downscaled copy.
 */
export function bloom(ctx, src, W, H, passes = [{ r: 4, a: 0.9 }, { r: 18, a: 0.6 }, { r: 60, a: 0.45 }]) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of passes) {
    const down = p.r > 30 ? 0.25 : p.r > 10 ? 0.5 : 1;
    const b = blurred(src, p.r, down);
    ctx.globalAlpha = p.a;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, W, H);
  }
  ctx.restore();
}

/** Copy of the canvas keeping only pixels brighter than `threshold` (0..1 luminance, soft knee). */
export function brightPass(srcCanvas, threshold = 0.6, knee = 0.2, maxWeight = 0.85) {
  const W = srcCanvas.width, H = srcCanvas.height;
  const { c, ctx } = layer(W, H);
  ctx.drawImage(srcCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
    const m = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
    const v = Math.max(l, m * maxWeight);
    const k = clamp((v - threshold + knee) / (2 * knee));
    const f = k * k;
    d[i] *= f;
    d[i + 1] *= f;
    d[i + 2] *= f;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Smooth fade of the bottom into a solid colour (UI text sits there). */
export function fadeBottom(ctx, W, H, y0, y1, color = [9, 9, 11]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = t * t * (3 - 2 * t);
    g.addColorStop(t, rgba(color, e));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
  ctx.fillStyle = rgba(color, 1);
  ctx.fillRect(0, y1 - 1, W, H - y1 + 1);
}

/** Simple film/colour grade applied per pixel. fn(r,g,b) with 0..1 values returns [r,g,b]. */
export function gradePixels(ctx, W, H, fn) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const out = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    const res = fn(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, out, i >> 2);
    d[i] = res[0] * 255;
    d[i + 1] = res[1] * 255;
    d[i + 2] = res[2] * 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** A reusable cinematic grade: contrast S-curve, saturation, split toning. */
export function cinematicGrade(ctx, W, H, {
  contrast = 1.12, sat = 0.85, lift = [0.012, 0.012, 0.016], shadowTint = [0.0, 0.004, 0.01],
  highTint = [0.02, -0.004, -0.01], gamma = 1.0, keepRed = 0.6,
} = {}) {
  gradePixels(ctx, W, H, (r, g, b, o) => {
    // saturation with red protection (crimson accents stay vivid)
    const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const redness = clamp((r - Math.max(g, b)) * 2.5);
    const s = lerp(sat, 1.08, redness * keepRed);
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;
    // contrast around mid grey, gentle toe
    r = 0.5 + (r - 0.5) * contrast;
    g = 0.5 + (g - 0.5) * contrast;
    b = 0.5 + (b - 0.5) * contrast;
    const sh = 1 - clamp(l * 2.2);
    const hi = clamp((l - 0.45) * 2);
    r += lift[0] + shadowTint[0] * sh + highTint[0] * hi;
    g += lift[1] + shadowTint[1] * sh + highTint[1] * hi;
    b += lift[2] + shadowTint[2] * sh + highTint[2] * hi;
    if (gamma !== 1) {
      r = Math.pow(clamp(r), gamma);
      g = Math.pow(clamp(g), gamma);
      b = Math.pow(clamp(b), gamma);
    }
    o[0] = clamp(r);
    o[1] = clamp(g);
    o[2] = clamp(b);
    return o;
  });
}

/** Add a tapered capsule (two circles + tangents) to the current path. */
export function capsule(ctx, x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  if (d < Math.abs(r1 - r2) + 0.01) {
    const big = r1 > r2 ? [x1, y1, r1] : [x2, y2, r2];
    ctx.moveTo(big[0] + big[2], big[1]);
    ctx.arc(big[0], big[1], big[2], 0, TAU);
    return;
  }
  const a = Math.atan2(dy, dx);
  const t = Math.acos(clamp((r1 - r2) / d, -1, 1));
  ctx.moveTo(x1 + r1 * Math.cos(a + t), y1 + r1 * Math.sin(a + t));
  ctx.arc(x1, y1, r1, a + t, a + TAU - t);
  ctx.lineTo(x2 + r2 * Math.cos(a - t), y2 + r2 * Math.sin(a - t));
  ctx.arc(x2, y2, r2, a - t, a + t);
  ctx.closePath();
}

/** Smooth closed/open curve through points (Catmull-Rom → Bézier). */
export function spline(ctx, pts, closed = false, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}

/** Sample a Catmull-Rom spline into a dense polyline. */
export function sampleSpline(pts, steps = 16) {
  const out = [];
  const n = pts.length;
  const P = (i) => pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/** Distance from point to a polyline (dense). Returns { d, i, t, x, y }. */
export function distToPolyline(px, py, line) {
  let best = { d: Infinity, i: 0, x: 0, y: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / L);
    const x = ax + dx * t, y = ay + dy * t;
    const d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { d, i, t, x, y };
  }
  return best;
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / L);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Point in polygon (even-odd). */
export function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Radial light (additive) with an optional elliptical squash. */
export function light(ctx, x, y, r, color, alpha = 1, squash = 1, op = 'lighter') {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.25, rgba(color, alpha * 0.45));
  g.addColorStop(0.6, rgba(color, alpha * 0.12));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

/** A soft volumetric cone of light from (x,y) toward angle `ang` with half-angle `spread`. */
export function beam(ctx, x, y, ang, spread, len, color, alpha = 0.25, op = 'lighter') {
  ctx.save();
  ctx.globalCompositeOperation = op;
  const g = ctx.createRadialGradient(x, y, 0, x, y, len);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.5));
  g.addColorStop(1, rgba(color, 0));
  // build the cone in several slices for a soft edge
  const slices = 7;
  for (let i = 0; i < slices; i++) {
    const s = spread * (1 - i / slices);
    ctx.globalAlpha = 1 / slices + 0.04;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang - s) * len, y + Math.sin(ang - s) * len);
    ctx.lineTo(x + Math.cos(ang + s) * len, y + Math.sin(ang + s) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** fBm texture rendered into its own layer as grayscale alpha (white) — used as grime / fog / masks. */
export function noiseLayer(W, H, { seed = 1, scale = 0.01, octaves = 4, step = 2, lo = 0.3, hi = 0.8, color = [255, 255, 255], alpha = 1, mask = null, warp = 0 } = {}) {
  const f = noiseField(W, H, { seed, scale, octaves });
  const g = warp ? noiseField(W, H, { seed: seed + 7, scale: scale * 0.6, octaves: 3 }) : null;
  const lw = Math.ceil(W / step), lh = Math.ceil(H / step);
  const { c, ctx } = layer(lw, lh);
  const img = ctx.createImageData(lw, lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      let X = x * step, Y = y * step;
      if (g) {
        const w = (g(X, Y) - 0.5) * warp;
        X += w;
        Y -= w * 0.7;
      }
      let a = smooth(lo, hi, f(X, Y));
      if (mask) a *= mask(x * step, y * step);
      const i = (y * lw + x) * 4;
      img.data[i] = color[0];
      img.data[i + 1] = color[1];
      img.data[i + 2] = color[2];
      img.data[i + 3] = a * 255 * alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (step === 1) return c;
  const out = layer(W, H);
  out.ctx.imageSmoothingQuality = 'high';
  out.ctx.drawImage(c, 0, 0, W, H);
  return out.c;
}

/** Rain streaks with per-streak brightness modulated by a light function lum(x,y) → 0..1. */
export function rainLit(ctx, W, H, { count = 2000, seed = 5, angle = 0.1, len = [14, 40], width = 1, color = [220, 225, 235], alpha = 0.3, lum = null, minLum = 0.05, region = null } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    let x, y;
    if (region) {
      x = region.x + r() * region.w;
      y = region.y + r() * region.h;
    } else {
      x = r() * W * 1.1 - W * 0.05;
      y = r() * H;
    }
    const L = len[0] + r() * (len[1] - len[0]);
    const k = lum ? Math.max(minLum, lum(x, y)) : 1;
    const a = alpha * k * (0.35 + r() * 0.65);
    if (a < 0.004) continue;
    const col = typeof color === 'function' ? color(x, y) : color;
    const g = ctx.createLinearGradient(x, y, x - L * angle, y + L);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(0.5, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = width * (0.6 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - L * angle, y + L);
    ctx.stroke();
  }
  ctx.restore();
}

/** Floating dust / ember particles. */
export function particles(ctx, W, H, { count = 400, seed = 3, size = [0.5, 2], color = [255, 255, 255], alpha = 0.4, lum = null, region = null, blurKeep = false } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const x = region ? region.x + r() * region.w : r() * W;
    const y = region ? region.y + r() * region.h : r() * H;
    const k = lum ? lum(x, y) : 1;
    const s = size[0] + Math.pow(r(), 3) * (size[1] - size[0]);
    const a = alpha * k * (0.3 + r() * 0.7);
    if (a < 0.01) continue;
    const col = typeof color === 'function' ? color(x, y) : color;
    if (s > 1.6 || blurKeep) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - s * 2, y - s * 2, s * 4, s * 4);
    } else {
      ctx.fillStyle = rgba(col, a);
      ctx.fillRect(x, y, s, s);
    }
  }
  ctx.restore();
}

/**
 * Rim light from a silhouette mask: keeps the band of the mask that faces
 * direction (lx,ly) (unit vector pointing TOWARD the light) and paints it in colour.
 * Computed per pixel (inside − inside-shifted-toward-light, thresholded) so
 * anti-aliased edges that run parallel to the light leave no residue.
 * Returns a canvas (same size as mask) to be composited by the caller.
 */
export function rimFromMask(mask, lx, ly, { width = 3, color = [255, 40, 50], soften = 1, layers = 3, falloff = 0.6 } = {}) {
  const W = mask.width, H = mask.height;
  const md = mask.getContext('2d').getImageData(0, 0, W, H).data;
  const A = new Float32Array(W * H);
  for (let i = 0; i < A.length; i++) A[i] = md[i * 4 + 3] / 255;
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return 0;
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * W + xi;
    return (A[i] * (1 - fx) + A[i + 1] * fx) * (1 - fy) + (A[i + W] * (1 - fx) + A[i + W + 1] * fx) * fy;
  };
  const R = new Float32Array(W * H);
  for (let li = 0; li < layers; li++) {
    const w = width * (1 + li * 1.6), k = Math.pow(falloff, li);
    const sx = lx * w, sy = ly * w;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const a = A[i];
        if (a < 0.02) continue;
        const v = clamp((a - sample(x + sx, y + sy) - 0.2) / 0.6) * a * k;
        if (v > R[i]) R[i] = Math.min(1, R[i] + v);
      }
    }
  }
  const out = layer(W, H);
  const img = out.ctx.createImageData(W, H);
  for (let i = 0; i < R.length; i++) {
    img.data[i * 4] = color[0];
    img.data[i * 4 + 1] = color[1];
    img.data[i * 4 + 2] = color[2];
    img.data[i * 4 + 3] = R[i] * 255;
  }
  out.ctx.putImageData(img, 0, 0);
  if (!soften) return out.c;
  const fin = layer(W, H);
  fin.ctx.filter = `blur(${soften}px)`;
  fin.ctx.drawImage(out.c, 0, 0);
  fin.ctx.filter = 'none';
  fin.ctx.drawImage(out.c, 0, 0);
  fin.ctx.globalCompositeOperation = 'destination-in';
  fin.ctx.drawImage(mask, 0, 0);
  return fin.c;
}

/** Fill the silhouette of a person into ctx (current fillStyle) from a joint map. */
export function figurePath(ctx, J, R = {}) {
  const s = R.scale ?? 1;
  const r = (v) => v * s;
  ctx.beginPath();
  // head + hair
  const [hx, hy] = J.head;
  ctx.ellipse(hx, hy, r(R.headW ?? 11), r(R.headH ?? 14), R.headTilt ?? 0, 0, TAU);
  if (J.hair) {
    for (const h of J.hair) {
      ctx.moveTo(h[0][0], h[0][1]);
      for (let i = 1; i < h.length; i++) ctx.lineTo(h[i][0], h[i][1]);
      ctx.closePath();
    }
  }
  // neck
  capsule(ctx, J.neck[0], J.neck[1], r(5.5), hx + (J.neck[0] - hx) * 0.3, hy + (J.neck[1] - hy) * 0.3, r(5.5));
  // torso (shoulders → hips) with slight belly/back curvature
  const [slx, sly] = J.shL, [srx, sry] = J.shR, [hlx, hly] = J.hipL, [hrx, hry] = J.hipR;
  const bulge = r(R.torsoBulge ?? 4);
  ctx.moveTo(slx, sly);
  ctx.quadraticCurveTo((slx + srx) / 2, (sly + sry) / 2 - r(3), srx, sry);
  ctx.quadraticCurveTo((srx + hrx) / 2 + bulge, (sry + hry) / 2, hrx, hry);
  ctx.lineTo(hlx, hly);
  ctx.quadraticCurveTo((slx + hlx) / 2 - bulge, (sly + hly) / 2, slx, sly);
  ctx.closePath();
  // shoulders
  capsule(ctx, slx, sly, r(R.shoulder ?? 7), srx, sry, r(R.shoulder ?? 7));
  // pelvis
  capsule(ctx, hlx, hly, r(R.hip ?? 9), hrx, hry, r(R.hip ?? 9));
  // arms
  for (const side of ['L', 'R']) {
    const sh = J['sh' + side], el = J['el' + side], ha = J['ha' + side];
    if (!el) continue;
    capsule(ctx, sh[0], sh[1], r(R.upperArm ?? 6.5), el[0], el[1], r(R.elbow ?? 5));
    capsule(ctx, el[0], el[1], r(R.elbow ?? 5), ha[0], ha[1], r(R.wrist ?? 3.6));
    ctx.moveTo(ha[0] + r(4.2), ha[1]);
    ctx.ellipse(ha[0], ha[1], r(4.2), r(5), 0, 0, TAU);
  }
  // legs
  for (const side of ['L', 'R']) {
    const hp = J['hip' + side], kn = J['kn' + side], an = J['an' + side], to = J['toe' + side];
    if (!kn) continue;
    capsule(ctx, hp[0], hp[1], r(R.thigh ?? 9), kn[0], kn[1], r(R.knee ?? 6.2));
    capsule(ctx, kn[0], kn[1], r(R.knee ?? 6.2), an[0], an[1], r(R.ankle ?? 4.2));
    if (to) capsule(ctx, an[0], an[1], r(R.ankle ?? 4.2), to[0], to[1], r(R.toe ?? 3.4));
  }
  if (J.extra) for (const e of J.extra) e(ctx);
}

/** Mirror a horizontal band of `src` below `y` with ripples, for wet-ground reflections. */
export function wetReflection(ctx, src, W, H, y, { depth = 300, alpha = 0.5, ripple = 3, seed = 11, mask = null, blur = 1.5, stretch = 1.0 } = {}) {
  const r = rng(seed);
  const ref = layer(W, depth);
  // flipped copy of the band above y
  ref.ctx.save();
  ref.ctx.translate(0, 0);
  ref.ctx.scale(1, -stretch);
  ref.ctx.drawImage(src, 0, -y, W, H);
  ref.ctx.restore();
  // ripple: slice into rows with small horizontal offsets
  const rip = layer(W, depth);
  for (let yy = 0; yy < depth; yy += 2) {
    const off = (r() - 0.5) * ripple * (1 + yy / depth * 2);
    rip.ctx.drawImage(ref.c, 0, yy, W, 2, off, yy, W, 2);
  }
  let out = rip.c;
  if (blur) out = blurred(out, blur);
  const fin = layer(W, depth);
  fin.ctx.drawImage(out, 0, 0);
  // fade with distance from the horizon line
  fin.ctx.globalCompositeOperation = 'destination-in';
  const g = fin.ctx.createLinearGradient(0, 0, 0, depth);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  fin.ctx.fillStyle = g;
  fin.ctx.fillRect(0, 0, W, depth);
  if (mask) {
    fin.ctx.globalCompositeOperation = 'destination-in';
    fin.ctx.drawImage(mask, 0, -y, W, H);
  }
  ctx.drawImage(fin.c, 0, y);
}

/** Chromatic fringe toward the edges (subtle lens character / glitch accent). */
export function chroma(ctx, W, H, px = 1.5) {
  const src = layer(W, H);
  src.ctx.drawImage(ctx.canvas, 0, 0);
  const r = layer(W, H);
  r.ctx.drawImage(src.c, 0, 0);
  r.ctx.globalCompositeOperation = 'multiply';
  r.ctx.fillStyle = '#ff0000';
  r.ctx.fillRect(0, 0, W, H);
  // mask to edges
  const m = layer(W, H);
  const g = m.ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  m.ctx.fillStyle = g;
  m.ctx.fillRect(0, 0, W, H);
  r.ctx.globalCompositeOperation = 'destination-in';
  r.ctx.drawImage(m.c, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(r.c, -px, 0);
  ctx.restore();
}

/** Luma-weighted grain (less in pure black so the fade stays clean). */
export function grainLuma(ctx, W, H, { amount = 10, seed = 9, blackKeep = 0.06 } = {}) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 765;
    const k = smooth(0, blackKeep + 0.08, l) * (1 - l * 0.5);
    const n = (r() - 0.5) * amount * k;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
