/*
 * Portrait painter for the Border Trials character avatars.
 *
 * A stylised, painterly head-and-shoulders built from a pseudo-3D head:
 * the silhouette comes from rotated elliptical cross-sections, facial
 * features are projected 3D points, so a `turn` gives a believable 3/4 view.
 * Lighting: crimson rim from one side, cool dim fill from the other, soft
 * front ambient. Everything is drawn in a 512×512 design space.
 */
import { rng, layer, noiseField } from './paint.js';

const D = 512;

/* ─────────────────────────── small helpers ─────────────────────────── */

const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerp = (a, b, t) => a + (b - a) * t;

/** Catmull-Rom spline through points (adds to current path). */
export function spline(ctx, pts, closed = true, move = true) {
  const n = pts.length;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  if (closed) ctx.closePath();
}

/** Tapered, curved hair lock from a root (width w) to a pointed tip. */
function lockPath(ctx, x0, y0, x1, y1, w, bend = 0) {
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
  ctx.moveTo(x0 + (nx * w) / 2, y0 + (ny * w) / 2);
  ctx.quadraticCurveTo(mx + nx * w * 0.32, my + ny * w * 0.32, x1, y1);
  ctx.quadraticCurveTo(mx - nx * w * 0.32, my - ny * w * 0.32, x0 - (nx * w) / 2, y0 - (ny * w) / 2);
  ctx.closePath();
}

function newLayer() {
  const l = layer(D, D);
  return l;
}

/* ─────────────────────────── head geometry ─────────────────────────── */

/**
 * Head model. Cross-section table: y → half-width a, half-depth c, centre z0.
 */
function headModel(spec) {
  const female = spec.sex === 'f';
  const jaw = spec.jaw ?? (female ? 52 : 60);
  const chinW = spec.chinW ?? (female ? 8 : 14);
  const chinY = spec.chinY ?? (female ? 120 : 126);
  const cheek = spec.cheek ?? (female ? 77 : 80);
  const hx = 256 + (spec.dx ?? 0);
  const ey = 238 + (spec.dy ?? 0);
  const phi = spec.turn ?? 0;
  const cs = Math.cos(phi), sn = Math.sin(phi);
  const table = [
    [-146, 4, 8, -10],
    [-132, 56, 66, -12],
    [-104, 80, 90, -10],
    [-60, 87, 98, -8],
    [-20, 86, 98, -5],
    [20, cheek, 94, 0],
    [62, jaw + 9, 82, 10],
    [86, jaw, 70, 18],
    [108, chinW + 18, 44, 46],
    [chinY - 4, chinW + 4, 22, 62],
    [chinY, 2, 8, 70],
  ];
  // smooth (Hermite / Catmull-Rom) interpolation of the cross-section table
  const N = table.length;
  const tang = table.map((row, i) => {
    const p = table[Math.max(0, i - 1)], q = table[Math.min(N - 1, i + 1)];
    const dy = q[0] - p[0] || 1;
    return [1, 2, 3].map((k) => (q[k] - p[k]) / dy);
  });
  const at = (y) => {
    if (y <= table[0][0]) return table[0].slice(1);
    if (y >= table[N - 1][0]) return table[N - 1].slice(1);
    let i = 1;
    while (y > table[i][0]) i++;
    const y0 = table[i - 1][0], y1 = table[i][0];
    const hgt = y1 - y0;
    const t = (y - y0) / hgt;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return [1, 2, 3].map(
      (k) => h00 * table[i - 1][k] + h10 * hgt * tang[i - 1][k - 1] + h01 * table[i][k] + h11 * hgt * tang[i][k - 1],
    );
  };
  /** front surface depth at (x, y) */
  const zs = (x, y) => {
    const [a, c, z0] = at(y);
    const t = Math.min(1, Math.abs(x) / Math.max(1, a));
    return z0 + c * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 1 / 2.4);
  };
  /** view-space normal of the face surface under screen pixel (X, Y), or null */
  const normalAt = (X, Y) => {
    const y = Y - ey;
    const [a] = at(y);
    if (a < 2) return null;
    const target = X - hx;
    let lo = -a, hi = a;
    const f = (x) => x * cs + zs(x, y) * sn;
    if (target <= f(lo)) hi = lo;
    else if (target >= f(hi)) lo = hi;
    else {
      for (let i = 0; i < 16; i++) {
        const m = (lo + hi) / 2;
        if (f(m) < target) lo = m;
        else hi = m;
      }
    }
    const x = (lo + hi) / 2;
    let dzdx = (zs(Math.min(a, x + 1), y) - zs(Math.max(-a, x - 1), y)) / 2;
    let dzdy = (zs(x, y + 1) - zs(x, y - 1)) / 2;
    dzdx = Math.max(-6, Math.min(6, dzdx));
    dzdy = Math.max(-6, Math.min(6, dzdy));
    let nx = -dzdx, ny = -dzdy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l;
    ny /= l;
    nz /= l;
    return [nx * cs + nz * sn, ny, -nx * sn + nz * cs];
  };
  /** project a face-space point (x right, y down, z toward viewer). */
  const P = (x, y, z) => {
    if (z === undefined) z = zs(x, y);
    return [hx + x * cs + z * sn, ey + y];
  };
  /** silhouette extremes at height y */
  const sil = (y) => {
    const [a, c, z0] = at(y);
    const r = Math.sqrt(a * a * cs * cs + c * c * sn * sn);
    return [hx + z0 * sn - r, hx + z0 * sn + r];
  };
  const outline = () => {
    const right = [], left = [];
    for (const [y] of table) {
      const [l, r] = sil(y);
      right.push([r, ey + y]);
      left.push([l, ey + y]);
    }
    // top & bottom merge into single points
    const pts = [[(right[0][0] + left[0][0]) / 2, ey - 148], ...right.slice(1, -1), [(right.at(-1)[0] + left.at(-1)[0]) / 2, ey + chinY + 1], ...left.slice(1, -1).reverse()];
    return pts;
  };
  return { hx, ey, phi, cs, sn, P, zs, sil, outline, female, jaw, chinY, at, normalAt };
}

function headPath(ctx, g) {
  ctx.beginPath();
  spline(ctx, g.outline(), true);
}

/* ─────────────────────────── lighting helpers ─────────────────────────── */

/**
 * Crescent rim light from an alpha layer: (shape − shape shifted away from the
 * light), blurred, composited with 'lighter' onto `target` clipped to the shape.
 */
function rimLight(target, shapeCanvas, side, color, width, alpha, blur = 2, clip = true) {
  const { c, ctx } = newLayer();
  ctx.drawImage(shapeCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, D, D);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(shapeCanvas, -side * width, width * 0.25);
  const { c: c2, ctx: ctx2 } = newLayer();
  ctx2.filter = `blur(${blur}px)`;
  ctx2.drawImage(c, 0, 0);
  ctx2.filter = 'none';
  if (clip) {
    ctx2.globalCompositeOperation = 'destination-in';
    ctx2.drawImage(shapeCanvas, 0, 0);
  }
  target.save();
  target.globalAlpha = alpha;
  target.globalCompositeOperation = 'lighter';
  target.drawImage(c2, 0, 0);
  target.restore();
}

/** Fill a canvas's opaque area with a flat colour → silhouette mask. */
function silhouette(src, color = '#000') {
  const { c, ctx } = newLayer();
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, D, D);
  return c;
}

function softEllipse(ctx, x, y, rx, ry, color, alpha, op = 'source-atop', rot = 0) {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * Per-pixel lighting of a layer from a normal provider: cool key/fill from the
 * fill side, crimson back-rim from the rim side, a little specular.
 */
function lightLayer(ctx, side, normalAt, o = {}) {
  const img = ctx.getImageData(0, 0, D, D);
  const d = img.data;
  const nrm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const L1 = nrm([-side * 0.62, -0.45, 0.68]);
  const L2 = nrm([side * 0.95, -0.2, -0.3]);
  const Hh = nrm([L1[0], L1[1], L1[2] + 1]);
  const amb = o.amb ?? 0.16;
  const key = o.key ?? 1.0;
  const wrapK = o.wrap ?? 0.35;
  const tint = o.tint ?? [0.93, 0.97, 1.06];
  const rimK = o.rim ?? 0.9;
  const rimC = [255, 34, 44];
  const shine = o.shine ?? 30;
  const specK = o.spec ?? 0.12;
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      const i = (y * D + x) * 4;
      if (d[i + 3] < 2) continue;
      const n = normalAt(x, y);
      if (!n) continue;
      const nl = n[0] * L1[0] + n[1] * L1[1] + n[2] * L1[2];
      const wrap = Math.max(0, (nl + wrapK) / (1 + wrapK));
      const k = amb + key * Math.pow(wrap, 1.5);
      const rl = Math.max(0, n[0] * L2[0] + n[1] * L2[1] + n[2] * L2[2]);
      const rim = Math.pow(rl, o.rimPow ?? 2.2) * rimK;
      const sp = Math.pow(Math.max(0, n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]), shine) * specK;
      // terminator warmth (subsurface)
      const sss = Math.exp(-(((nl - 0.02) / 0.18) ** 2)) * (o.sss ?? 0.1);
      d[i] = Math.min(255, d[i] * k * tint[0] + rimC[0] * rim + 255 * sp + d[i] * sss * 1.4);
      d[i + 1] = Math.min(255, d[i + 1] * k * tint[1] + rimC[1] * rim + 250 * sp + d[i + 1] * sss * 0.2);
      d[i + 2] = Math.min(255, d[i + 2] * k * tint[2] + rimC[2] * rim + 255 * sp + d[i + 2] * sss * 0.3);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Ellipsoid normal provider (for hair masses, hoods, torsos). */
function ellipsoidNormal(cx, cy, a, b, clampY = 1) {
  return (X, Y) => {
    let nx = (X - cx) / a;
    let ny = Math.max(-1, Math.min(clampY, (Y - cy) / b));
    const q = nx * nx + ny * ny;
    if (q > 0.97) {
      const k = Math.sqrt(0.97 / q);
      nx *= k;
      ny *= k;
    }
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return [nx, ny, nz];
  };
}

/* ─────────────────────────── background ─────────────────────────── */

function background(ctx, spec, r) {
  const side = spec.light;
  const g = ctx.createRadialGradient(256 + side * 60, 190, 20, 256, 256, 380);
  g.addColorStop(0, '#2a1216');
  g.addColorStop(0.45, '#120a0d');
  g.addColorStop(1, '#050507');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, D, D);
  // faint skyline
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  let x = -10;
  while (x < D) {
    const w = 26 + r() * 50;
    const h = 120 + r() * 200;
    ctx.fillRect(x, 330 - h, w - 4, h + 200);
    x += w;
  }
  ctx.restore();
  // bokeh: red city lights + a few cool ones on the fill side
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const onRim = r() < 0.72;
    const bx = onRim ? 256 + side * (90 + r() * 200) : 256 - side * (90 + r() * 200);
    const by = 40 + r() * 330;
    const br = 6 + Math.pow(r(), 2) * 26;
    const col = onRim ? (r() < 0.8 ? [255, 30 + r() * 40, 40] : [255, 140, 60]) : [90, 130, 200];
    const a = (onRim ? 0.16 : 0.08) + r() * 0.16;
    ctx.filter = `blur(${2 + r() * 5}px)`;
    const gg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    gg.addColorStop(0, rgba(col, a * 0.9));
    gg.addColorStop(0.8, rgba(col, a));
    gg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  ctx.restore();
  // rim-side red haze, fill-side cool haze
  softEllipse(ctx, 256 + side * 240, 180, 260, 300, [200, 10, 24], 0.32, 'lighter');
  softEllipse(ctx, 256 - side * 260, 220, 220, 300, [40, 70, 120], 0.16, 'lighter');
}

/* ─────────────────────────── body + clothing ─────────────────────────── */

function bodyCenter(g) {
  return g.hx - g.sn * 26;
}

function torsoPath(ctx, g, o = {}) {
  const cx = bodyCenter(g);
  const nb = g.ey + 168;
  const sh = o.shoulder ?? 0; // + broader
  const nw = o.neckW ?? 46;
  ctx.beginPath();
  ctx.moveTo(cx - 340, 600);
  ctx.lineTo(cx - 300 - sh, nb + 140);
  ctx.bezierCurveTo(cx - 236 - sh, nb + 46, cx - 140, nb + 22, cx - nw, nb - 12);
  ctx.quadraticCurveTo(cx, nb + 4, cx + nw, nb - 12);
  ctx.bezierCurveTo(cx + 140, nb + 22, cx + 236 + sh, nb + 46, cx + 300 + sh, nb + 140);
  ctx.lineTo(cx + 340, 600);
  ctx.closePath();
}

function fabricShade(ctx, g, spec, base) {
  const side = spec.light;
  const cx = bodyCenter(g);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const lg = ctx.createLinearGradient(cx - side * 260, 0, cx + side * 260, 0);
  lg.addColorStop(0, rgba(mixc(base, [120, 150, 200], 0.25), 0.1));
  lg.addColorStop(0.5, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, D, D);
  const vg = ctx.createLinearGradient(0, g.ey + 150, 0, D);
  vg.addColorStop(0, 'rgba(255,255,255,0.05)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, D, D);
  ctx.restore();
}

function folds(ctx, g, spec, r, n = 6, alpha = 0.35) {
  const cx = bodyCenter(g);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = cx + (r() - 0.5) * 380;
    const sy = g.ey + 200 + r() * 60;
    ctx.strokeStyle = `rgba(0,0,0,${alpha * (0.5 + r() * 0.5)})`;
    ctx.lineWidth = 6 + r() * 10;
    ctx.filter = 'blur(4px)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + (r() - 0.5) * 60, sy + 60, sx + (r() - 0.5) * 80, sy + 140);
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.restore();
}

/* neck */
function drawNeck(ctx, g, spec) {
  const cx = lerp(g.hx, bodyCenter(g), 0.5) + g.sn * 6;
  const w = g.female ? 33 : 40;
  const top = g.ey + 60, bot = g.ey + 200;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w, top);
  ctx.bezierCurveTo(cx - w + 2, top + 60, cx - w - 4, bot - 50, cx - w - 22, bot);
  ctx.lineTo(cx + w + 22, bot);
  ctx.bezierCurveTo(cx + w + 4, bot - 50, cx + w - 2, top + 60, cx + w, top);
  ctx.closePath();
  ctx.fillStyle = rgba(mul(spec.skin, 0.72));
  ctx.fill();
  ctx.clip();
  // jaw shadow + side shading
  const vg = ctx.createLinearGradient(0, top, 0, bot);
  vg.addColorStop(0, rgba(mul(spec.skin, 0.12), 0.95));
  vg.addColorStop(0.45, rgba(mul(spec.skin, 0.3), 0.6));
  vg.addColorStop(1, rgba(mul(spec.skin, 0.4), 0.2));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, D, D);
  const lg = ctx.createLinearGradient(cx - spec.light * w, 0, cx + spec.light * w, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, D, D);
  // sterno-mastoid hint
  ctx.strokeStyle = rgba(mul(spec.skin, 0.35), 0.35);
  ctx.lineWidth = 5;
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  ctx.moveTo(cx - spec.light * 24, top + 70);
  ctx.quadraticCurveTo(cx - spec.light * 12, bot - 40, cx, bot - 8);
  ctx.stroke();
  ctx.restore();
}

/* outfits — each draws the torso and its own collar details */
const OUTFITS = {
  hoodie(ctx, g, spec, r) {
    const base = spec.cloth ?? [30, 30, 36];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { shoulder: 6, neckW: 70 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 7);
    // drawstrings
    const cx = bodyCenter(g);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(190,190,200,0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 30, g.ey + 175);
      ctx.quadraticCurveTo(cx + m * 36, g.ey + 220, cx + m * 30 + 6, g.ey + 262);
      ctx.stroke();
    }
    ctx.restore();
  },
  scrubs(ctx, g, spec, r) {
    const base = spec.cloth ?? [26, 52, 58];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 50 });
    ctx.fill();
    // V-neck opening (skin)
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba(mul(spec.skin, 0.5));
    ctx.beginPath();
    ctx.moveTo(cx - 44, nb - 4);
    ctx.lineTo(cx, nb + 92);
    ctx.lineTo(cx + 44, nb - 4);
    ctx.closePath();
    ctx.fill();
    // V trim
    ctx.strokeStyle = rgba(mul(base, 1.5));
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 48, nb - 6);
    ctx.lineTo(cx, nb + 96);
    ctx.lineTo(cx + 48, nb - 6);
    ctx.stroke();
    ctx.restore();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 5, 0.3);
  },
  track(ctx, g, spec, r) {
    const base = spec.cloth ?? [24, 24, 30];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 52, shoulder: -6 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 4, 0.25);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // shoulder stripes
    ctx.strokeStyle = 'rgba(227,18,31,0.85)';
    ctx.lineWidth = 7;
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 80, nb + 18);
      ctx.bezierCurveTo(cx + m * 150, nb + 30, cx + m * 210, nb + 60, cx + m * 250, nb + 120);
      ctx.stroke();
    }
    ctx.restore();
    // high collar
    ctx.fillStyle = rgba(mul(base, 1.25));
    ctx.beginPath();
    ctx.moveTo(cx - 58, nb - 40);
    ctx.quadraticCurveTo(cx - 64, nb + 10, cx - 50, nb + 30);
    ctx.quadraticCurveTo(cx, nb + 44, cx + 50, nb + 30);
    ctx.quadraticCurveTo(cx + 64, nb + 10, cx + 58, nb - 40);
    ctx.quadraticCurveTo(cx, nb - 22, cx - 58, nb - 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(227,18,31,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 57, nb - 38);
    ctx.quadraticCurveTo(cx, nb - 20, cx + 57, nb - 38);
    ctx.stroke();
    // zipper
    ctx.strokeStyle = 'rgba(200,200,210,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + 2, nb - 22);
    ctx.lineTo(cx + 4, D);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,220,230,0.8)';
    ctx.fillRect(cx - 1, nb - 4, 8, 14);
  },
  techjacket(ctx, g, spec, r) {
    const base = spec.cloth ?? [22, 22, 28];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 56 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 5);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    // collar
    ctx.fillStyle = rgba(mul(base, 1.35));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 52, nb - 26);
      ctx.quadraticCurveTo(cx + m * 66, nb + 20, cx + m * 96, nb + 44);
      ctx.lineTo(cx + m * 30, nb + 52);
      ctx.quadraticCurveTo(cx + m * 40, nb + 10, cx + m * 40, nb - 18);
      ctx.closePath();
      ctx.fill();
    }
  },
  tactical(ctx, g, spec, r) {
    const base = spec.cloth ?? [36, 38, 32];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 54, shoulder: 14 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // vest plate + straps
    ctx.fillStyle = rgba(mul(base, 0.7));
    ctx.beginPath();
    ctx.moveTo(cx - 120, nb + 40);
    ctx.quadraticCurveTo(cx, nb + 70, cx + 120, nb + 40);
    ctx.lineTo(cx + 130, D);
    ctx.lineTo(cx - 130, D);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(mul(base, 1.4), 0.6);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = nb + 82 + i * 22;
      ctx.beginPath();
      ctx.moveTo(cx - 110, y);
      ctx.lineTo(cx + 110, y);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(mul(base, 0.55));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 70, nb + 6);
      ctx.lineTo(cx + m * 112, nb + 2);
      ctx.lineTo(cx + m * 140, nb + 80);
      ctx.lineTo(cx + m * 100, nb + 84);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // padded high collar
    ctx.fillStyle = rgba(mul(base, 1.2));
    ctx.beginPath();
    ctx.moveTo(cx - 66, nb - 34);
    ctx.quadraticCurveTo(cx - 78, nb + 14, cx - 58, nb + 34);
    ctx.quadraticCurveTo(cx, nb + 52, cx + 58, nb + 34);
    ctx.quadraticCurveTo(cx + 78, nb + 14, cx + 66, nb - 34);
    ctx.quadraticCurveTo(cx, nb - 8, cx - 66, nb - 34);
    ctx.fill();
    ctx.strokeStyle = rgba(mul(base, 0.6));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 62, nb - 6);
    ctx.quadraticCurveTo(cx, nb + 22, cx + 62, nb - 6);
    ctx.stroke();
  },
  uniform(ctx, g, spec, r) {
    const base = spec.cloth ?? [20, 22, 32];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 44, shoulder: -16 });
    ctx.fill();
    const cx = bodyCenter(g);
    const nb = g.ey + 158;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // shirt V
    ctx.fillStyle = 'rgb(176,178,186)';
    ctx.beginPath();
    ctx.moveTo(cx - 70, nb - 4);
    ctx.lineTo(cx, nb + 120);
    ctx.lineTo(cx + 70, nb - 4);
    ctx.closePath();
    ctx.fill();
    // lapels
    ctx.fillStyle = rgba(mul(base, 1.35));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 70, nb - 6);
      ctx.lineTo(cx + m * 8, nb + 124);
      ctx.lineTo(cx + m * 44, nb + 130);
      ctx.lineTo(cx + m * 96, nb + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    fabricShade(ctx, g, spec, base);
    // shirt collar points
    ctx.fillStyle = 'rgb(198,200,208)';
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 44, nb - 26);
      ctx.lineTo(cx + m * 50, nb + 12);
      ctx.lineTo(cx + m * 6, nb + 36);
      ctx.lineTo(cx + m * 30, nb - 6);
      ctx.closePath();
      ctx.fill();
    }
    // ribbon
    ctx.fillStyle = 'rgb(196,18,30)';
    ctx.beginPath();
    ctx.moveTo(cx, nb + 30);
    ctx.lineTo(cx - 26, nb + 18);
    ctx.lineTo(cx - 24, nb + 46);
    ctx.closePath();
    ctx.moveTo(cx, nb + 30);
    ctx.lineTo(cx + 26, nb + 18);
    ctx.lineTo(cx + 24, nb + 46);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 4, nb + 34);
    ctx.lineTo(cx - 16, nb + 80);
    ctx.lineTo(cx - 4, nb + 74);
    ctx.lineTo(cx + 4, nb + 34);
    ctx.moveTo(cx + 4, nb + 34);
    ctx.lineTo(cx + 18, nb + 78);
    ctx.lineTo(cx + 6, nb + 72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgb(150,10,20)';
    ctx.beginPath();
    ctx.arc(cx, nb + 31, 7, 0, Math.PI * 2);
    ctx.fill();
  },
  opencollar(ctx, g, spec, r) {
    const base = spec.cloth ?? [18, 16, 20];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 46, shoulder: 4 });
    ctx.fill();
    const cx = bodyCenter(g);
    const nb = g.ey + 158;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // skin V (open collar)
    ctx.fillStyle = rgba(mul(spec.skin, 0.55));
    ctx.beginPath();
    ctx.moveTo(cx - 46, nb - 8);
    ctx.lineTo(cx + 2, nb + 108);
    ctx.lineTo(cx + 46, nb - 8);
    ctx.closePath();
    ctx.fill();
    const sg = ctx.createLinearGradient(0, nb, 0, nb + 110);
    sg.addColorStop(0, 'rgba(0,0,0,0.5)');
    sg.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = sg;
    ctx.fill();
    // dark shirt
    ctx.fillStyle = 'rgb(58,14,20)';
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 46, nb - 8);
      ctx.lineTo(cx + m * 2, nb + 110);
      ctx.lineTo(cx + m * 40, nb + 160);
      ctx.lineTo(cx + m * 100, nb + 30);
      ctx.closePath();
      ctx.fill();
    }
    // jacket lapels
    ctx.fillStyle = rgba(mul(base, 1.6));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 96, nb + 10);
      ctx.lineTo(cx + m * 30, nb + 170);
      ctx.lineTo(cx + m * 70, nb + 180);
      ctx.lineTo(cx + m * 128, nb + 46);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    fabricShade(ctx, g, spec, base);
    // shirt collar points (open)
    ctx.fillStyle = 'rgb(74,18,26)';
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 40, nb - 30);
      ctx.lineTo(cx + m * 62, nb + 30);
      ctx.lineTo(cx + m * 26, nb + 24);
      ctx.closePath();
      ctx.fill();
    }
  },
  puffer(ctx, g, spec, r) {
    const base = spec.cloth ?? [26, 28, 34];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 64, shoulder: 18 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 300, nb + 60 + i * 40);
      ctx.quadraticCurveTo(cx, nb + 40 + i * 40, cx + 300, nb + 60 + i * 40);
      ctx.stroke();
    }
    ctx.restore();
    // puffy collar
    const cg = ctx.createLinearGradient(0, nb - 40, 0, nb + 40);
    cg.addColorStop(0, rgba(mul(base, 1.7)));
    cg.addColorStop(1, rgba(mul(base, 0.9)));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx - 74, nb - 30);
    ctx.bezierCurveTo(cx - 92, nb + 20, cx - 60, nb + 48, cx, nb + 46);
    ctx.bezierCurveTo(cx + 60, nb + 48, cx + 92, nb + 20, cx + 74, nb - 30);
    ctx.quadraticCurveTo(cx, nb - 2, cx - 74, nb - 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,20,30,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 2, nb + 2);
    ctx.lineTo(cx + 4, D);
    ctx.stroke();
  },
  jumpsuit(ctx, g, spec, r) {
    const base = spec.cloth ?? [54, 44, 34];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 50, shoulder: 10 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 6);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    // folded collar
    ctx.fillStyle = rgba(mul(base, 1.3));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 46, nb - 22);
      ctx.lineTo(cx + m * 104, nb + 26);
      ctx.lineTo(cx + m * 18, nb + 62);
      ctx.quadraticCurveTo(cx + m * 36, nb + 10, cx + m * 36, nb - 14);
      ctx.closePath();
      ctx.fill();
    }
    // chest patch (red)
    ctx.fillStyle = 'rgba(190,20,30,0.85)';
    const px = cx - spec.light * 120;
    ctx.fillRect(px - 20, nb + 92, 40, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px - 14, nb + 98, 28, 3);
  },
  idol(ctx, g, spec, r) {
    // bare shoulders + dark top with straps
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    ctx.fillStyle = rgba(mul(spec.skin, 0.62));
    torsoPath(ctx, g, { neckW: 40, shoulder: -24 });
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // collarbone hints
    ctx.strokeStyle = rgba(mul(spec.skin, 0.32), 0.6);
    ctx.lineWidth = 4;
    ctx.filter = 'blur(2px)';
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 16, nb + 36);
      ctx.quadraticCurveTo(cx + m * 70, nb + 22, cx + m * 130, nb + 34);
      ctx.stroke();
    }
    ctx.filter = 'none';
    // top
    ctx.fillStyle = 'rgb(16,14,18)';
    ctx.beginPath();
    ctx.moveTo(cx - 300, nb + 120);
    ctx.quadraticCurveTo(cx - 120, nb + 90, cx - 60, nb + 110);
    ctx.quadraticCurveTo(cx, nb + 140, cx + 60, nb + 110);
    ctx.quadraticCurveTo(cx + 120, nb + 90, cx + 300, nb + 120);
    ctx.lineTo(cx + 300, D);
    ctx.lineTo(cx - 300, D);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgb(20,18,22)';
    ctx.lineWidth = 7;
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 96, nb + 100);
      ctx.lineTo(cx + m * 112, nb + 12);
      ctx.stroke();
    }
    ctx.restore();
    fabricShade(ctx, g, spec, spec.skin);
  },
  trench(ctx, g, spec, r) {
    const base = spec.cloth ?? [62, 52, 40];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 50, shoulder: 16 });
    ctx.fill();
    const cx = bodyCenter(g);
    const nb = g.ey + 158;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    // shirt + tie
    ctx.fillStyle = 'rgb(120,122,130)';
    ctx.beginPath();
    ctx.moveTo(cx - 52, nb - 6);
    ctx.lineTo(cx, nb + 120);
    ctx.lineTo(cx + 52, nb - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgb(28,22,26)';
    ctx.beginPath();
    ctx.moveTo(cx - 9, nb + 12);
    ctx.lineTo(cx + 9, nb + 12);
    ctx.lineTo(cx + 13, nb + 120);
    ctx.lineTo(cx - 13, nb + 120);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 5);
    // turned-up collar (big lapels flanking the neck)
    for (const m of [-1, 1]) {
      const cg = ctx.createLinearGradient(cx + m * 40, 0, cx + m * 120, 0);
      cg.addColorStop(0, rgba(mul(base, 0.75)));
      cg.addColorStop(1, rgba(mul(base, 1.25)));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(cx + m * 50, nb - 62);
      ctx.quadraticCurveTo(cx + m * 96, nb - 50, cx + m * 112, nb - 30);
      ctx.lineTo(cx + m * 132, nb + 40);
      ctx.lineTo(cx + m * 60, nb + 150);
      ctx.lineTo(cx + m * 22, nb + 110);
      ctx.quadraticCurveTo(cx + m * 50, nb + 40, cx + m * 52, nb - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(mul(base, 0.5));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
  leather(ctx, g, spec, r) {
    const base = spec.cloth ?? [24, 20, 22];
    ctx.fillStyle = rgba(base);
    torsoPath(ctx, g, { neckW: 50, shoulder: 0 });
    ctx.fill();
    fabricShade(ctx, g, spec, base);
    folds(ctx, g, spec, r, 6, 0.45);
    const cx = bodyCenter(g);
    const nb = g.ey + 160;
    // scarf wrap
    ctx.fillStyle = 'rgb(70,16,22)';
    ctx.beginPath();
    ctx.moveTo(cx - 62, nb - 34);
    ctx.bezierCurveTo(cx - 84, nb + 6, cx - 50, nb + 40, cx, nb + 36);
    ctx.bezierCurveTo(cx + 50, nb + 40, cx + 84, nb + 6, cx + 62, nb - 34);
    ctx.quadraticCurveTo(cx, nb - 10, cx - 62, nb - 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 60, nb - 20 + i * 14);
      ctx.quadraticCurveTo(cx, nb + 4 + i * 14, cx + 60, nb - 20 + i * 14);
      ctx.stroke();
    }
    // jacket collar flaps
    ctx.fillStyle = rgba(mul(base, 1.5));
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + m * 66, nb - 8);
      ctx.lineTo(cx + m * 120, nb + 36);
      ctx.lineTo(cx + m * 60, nb + 96);
      ctx.lineTo(cx + m * 50, nb + 34);
      ctx.closePath();
      ctx.fill();
    }
  },
};

/* ─────────────────────────── face features ─────────────────────────── */

function drawFace(ctx, g, spec, r) {
  const side = spec.light; // rim side
  const skin = spec.skin;
  const shadow = mixc(mul(skin, 0.26), [60, 8, 26], 0.25);
  const light = mixc(mul(skin, 1.18), [200, 215, 240], 0.12);
  // base + per-pixel 3D lighting
  headPath(ctx, g);
  ctx.fillStyle = rgba(skin);
  ctx.fill();
  lightLayer(ctx, side, g.normalAt, { amb: 0.16, key: 1.02, wrap: 0.32, rim: 0.8, spec: 0.07, shine: 22, sss: 0.22, tint: [1.05, 0.97, 0.95] });
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  // jaw underside dark, forehead slightly lit
  const vg = ctx.createLinearGradient(0, g.ey - 150, 0, g.ey + g.chinY + 4);
  vg.addColorStop(0, rgba(light, 0.08));
  vg.addColorStop(0.6, 'rgba(0,0,0,0)');
  vg.addColorStop(0.88, rgba(shadow, 0.2));
  vg.addColorStop(1, rgba(shadow, 0.5));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, D, D);
  // red bounce in the shadow side
  const [bx, by] = g.P(side * 60, 20);
  ctx.restore();
  softEllipse(ctx, bx, by, 60, 90, [170, 20, 34], 0.16, 'source-atop');

  const P = g.P;
  // warmth: cheeks, nose, ears of the face
  for (const m of [-1, 1]) {
    const [x, y] = P(m * 46, 36);
    softEllipse(ctx, x, y, 30, 20, [210, 70, 60], 0.12);
  }
  {
    const [x, y] = P(0, 40, g.zs(0, 40) + 20);
    softEllipse(ctx, x, y, 14, 18, [210, 70, 60], 0.12);
  }
  // cheekbone light on the fill side, hollow under cheekbones
  {
    const [x, y] = P(-side * 52, 22);
    softEllipse(ctx, x, y, 40, 26, light, 0.14, 'source-atop', -side * 0.4);
    for (const m of [-1, 1]) {
      const [hx2, hy2] = P(m * 58, 62);
      softEllipse(ctx, hx2, hy2, 28, 14, shadow, m === side ? 0.4 : 0.22, 'source-atop', m * 0.8);
    }
    // temple shadow
    const [tx, ty] = P(side * 70, -40);
    softEllipse(ctx, tx, ty, 34, 50, shadow, 0.35, 'source-atop');
  }
  // eye sockets
  for (const m of [-1, 1]) {
    const [x, y] = P(m * 33, -6, g.zs(m * 33, -6) - 6);
    softEllipse(ctx, x, y, 34, 20, shadow, m === side ? 0.6 : 0.42);
  }
  // brow ridge light
  {
    const [x, y] = P(-side * 30, -34);
    softEllipse(ctx, x, y, 30, 10, light, 0.18);
  }

  // ── nose
  {
    const bridge = P(0, -10, g.zs(0, -10) + 6);
    const tip = P(0, 50, g.zs(0, 50) + 26);
    const wingN = P(-side * 15, 54, g.zs(0, 54) + 6);
    const wingF = P(side * 15, 54, g.zs(0, 54) + 6);
    // shadow side of the nose (toward rim)
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = rgba(shadow, 0.55);
    ctx.beginPath();
    ctx.moveTo(bridge[0] + side * 4, bridge[1]);
    ctx.quadraticCurveTo(tip[0] + side * 10, tip[1] - 22, wingF[0] + side * 2, wingF[1]);
    ctx.lineTo(wingF[0] + side * 10, wingF[1] - 30);
    ctx.quadraticCurveTo(bridge[0] + side * 12, bridge[1] + 10, bridge[0] + side * 8, bridge[1] - 4);
    ctx.closePath();
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
    // bridge highlight
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.filter = 'blur(2.5px)';
    ctx.strokeStyle = rgba(light, 0.45);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bridge[0] - side * 3, bridge[1] + 8);
    ctx.lineTo(tip[0] - side * 3, tip[1] - 8);
    ctx.stroke();
    ctx.filter = 'none';
    ctx.restore();
    softEllipse(ctx, tip[0] - side * 2, tip[1] - 4, 9, 6, light, 0.5);
    // under-nose shadow + nostrils
    softEllipse(ctx, tip[0] + side * 3, tip[1] + 10, 22, 7, shadow, 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = rgba(mul(shadow, 0.7), 0.45);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const w of [wingN, wingF]) {
      ctx.beginPath();
      ctx.moveTo(w[0], w[1] - 10);
      ctx.quadraticCurveTo(w[0] + (w === wingN ? -side : side) * 5, w[1] - 2, (w[0] + tip[0]) / 2, w[1] + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── mouth
  {
    const my = g.female ? 80 : 84;
    const cl = P(-22, my), cr = P(22, my);
    const c = P(0, my + 1, g.zs(0, my) + 4);
    const up = P(0, my - 7, g.zs(0, my) + 5);
    const lo = P(0, my + 11, g.zs(0, my) + 3);
    // lips tint
    const lip = mixc(mul(skin, 0.78), [150, 40, 50], g.female ? 0.4 : 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba(lip, 0.75);
    ctx.beginPath();
    ctx.moveTo(cl[0], cl[1]);
    ctx.quadraticCurveTo(up[0] - 8, up[1] - (g.female ? 2 : 0), up[0], up[1] + 2);
    ctx.quadraticCurveTo(up[0] + 8, up[1] - (g.female ? 2 : 0), cr[0], cr[1]);
    ctx.quadraticCurveTo(lo[0] + 4, lo[1] + (g.female ? 3 : 0), cl[0], cl[1]);
    ctx.fill();
    // mouth line
    ctx.strokeStyle = rgba(mul(shadow, 0.5), 0.9);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cl[0] - 1, cl[1] + 1);
    ctx.quadraticCurveTo(c[0], c[1] + (spec.smirk ?? 0), cr[0] + 1, cr[1] + 1 - (spec.smirk ?? 0));
    ctx.stroke();
    ctx.restore();
    // lower-lip highlight & shadow
    softEllipse(ctx, lo[0] - side * 3, lo[1] - 3, 11, 4, light, g.female ? 0.45 : 0.3);
    softEllipse(ctx, lo[0], lo[1] + 9, 16, 6, shadow, 0.45);
    // chin highlight
    const ch = P(-side * 4, g.chinY - 18);
    softEllipse(ctx, ch[0], ch[1], 16, 10, light, 0.18);
  }

  // stubble: soft shadow tint + fine stipple
  if (spec.stubble) {
    const { c: st, ctx: sc } = newLayer();
    sc.fillStyle = 'rgb(18,12,14)';
    sc.beginPath();
    const jawPts = [];
    for (let y = 46; y <= g.chinY + 2; y += 8) {
      const [a] = g.at(y);
      jawPts.push(g.P(-a * 0.98, y));
    }
    for (let y = g.chinY + 2; y >= 46; y -= 8) {
      const [a] = g.at(y);
      jawPts.push(g.P(a * 0.98, y));
    }
    spline(sc, jawPts, true);
    sc.fill();
    // keep the upper-lip moustache shadow, clear the cheeks above it
    sc.globalCompositeOperation = 'destination-out';
    const [mx, my] = g.P(0, 58);
    sc.beginPath();
    sc.ellipse(mx, my - 8, 50, 22, 0, 0, Math.PI * 2);
    sc.fill();
    sc.globalCompositeOperation = 'source-over';
    sc.fillStyle = 'rgb(18,12,14)';
    const [ux, uy] = g.P(0, 66);
    sc.beginPath();
    sc.ellipse(ux, uy, 26, 7, 0, 0, Math.PI * 2);
    sc.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.filter = 'blur(6px)';
    ctx.globalAlpha = spec.stubble * 1.5;
    ctx.drawImage(st, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    const rr = rng(spec.seed + 99);
    for (let i = 0; i < 1400; i++) {
      const x = (rr() - 0.5) * 2 * 80;
      const y = 50 + rr() * 76;
      const [a] = g.at(y);
      if (Math.abs(x) > a * 0.95) continue;
      if (y < 74 && Math.abs(x) > 30 && y < 60 + Math.abs(x) * 0.2) continue;
      const [px, py] = g.P(x, y);
      ctx.fillStyle = `rgba(14,10,12,${0.08 + rr() * spec.stubble * 0.8})`;
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();
  }

  // ── eyes
  const eyeW = spec.eyeW ?? (g.female ? 35 : 33);
  const eyeH = spec.eyeH ?? (g.female ? 14 : 12);
  for (const m of [-1, 1]) {
    const inner = P(m * 16, 0, g.zs(m * 16, 0) - 4);
    const outer = P(m * (16 + eyeW), -2 - (spec.eyeTilt ?? 0), g.zs(m * (16 + eyeW), 0) - 4);
    const topP = P(m * (16 + eyeW * 0.45), -eyeH * 0.62, g.zs(m * (16 + eyeW * 0.45), 0) - 2);
    const botP = P(m * (16 + eyeW * 0.5), eyeH * 0.42, g.zs(m * (16 + eyeW * 0.5), 0) - 3);
    const cx = (inner[0] + outer[0]) / 2;
    const cy = (inner[1] + outer[1]) / 2 + 1;
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(topP[0] - (outer[0] - inner[0]) * 0.05, topP[1] - eyeH * 0.32, outer[0], outer[1]);
      ctx.quadraticCurveTo(botP[0], botP[1] + eyeH * 0.32, inner[0], inner[1]);
      ctx.closePath();
    };
    if (spec.hideEye === m) continue;
    ctx.save();
    almond();
    ctx.fillStyle = m === side ? 'rgb(52,46,52)' : 'rgb(96,92,100)';
    ctx.fill();
    ctx.clip();
    // iris
    const ir = eyeH * 0.68;
    const ix = cx + (spec.gaze ?? 0) * 3, iy = cy - 1;
    const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, ir);
    ig.addColorStop(0, 'rgb(8,6,8)');
    ig.addColorStop(0.42, 'rgb(12,9,10)');
    ig.addColorStop(0.7, rgba(spec.iris ?? [70, 42, 30]));
    ig.addColorStop(1, 'rgb(14,10,12)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, Math.PI * 2);
    ctx.fill();
    // lid shadow inside the eye
    const sg = ctx.createLinearGradient(0, cy - eyeH, 0, cy + 2);
    sg.addColorStop(0, 'rgba(0,0,0,0.75)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - 40, cy - 30, 80, 32);
    ctx.restore();
    // catchlights
    ctx.fillStyle = 'rgba(235,240,255,0.85)';
    ctx.beginPath();
    ctx.arc(ix - side * ir * 0.38, iy - ir * 0.35, Math.max(1.4, ir * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,60,70,0.7)';
    ctx.beginPath();
    ctx.arc(ix + side * ir * 0.45, iy + ir * 0.2, Math.max(1, ir * 0.13), 0, Math.PI * 2);
    ctx.fill();
    // upper lash line
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10,6,8,0.95)';
    ctx.lineWidth = g.female ? 4.4 : 3.8;
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1]);
    ctx.quadraticCurveTo(topP[0] - (outer[0] - inner[0]) * 0.05, topP[1] - eyeH * 0.32, outer[0], outer[1]);
    if (g.female) ctx.lineTo(outer[0] + m * 5, outer[1] - 3);
    ctx.stroke();
    // lid crease
    ctx.strokeStyle = rgba(mul(shadow, 0.6), 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(inner[0] + m * 4, inner[1] - 5);
    ctx.quadraticCurveTo(topP[0], topP[1] - eyeH * 0.7, outer[0] - m * 2, outer[1] - 6);
    ctx.stroke();
    // lower lid
    ctx.strokeStyle = rgba(mul(shadow, 0.7), 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(inner[0] + m * 3, inner[1] + 1);
    ctx.quadraticCurveTo(botP[0], botP[1] + eyeH * 0.32, outer[0], outer[1] + 1);
    ctx.stroke();
    ctx.restore();
  }

  // ── brows
  const browC = spec.browColor ?? mul(spec.hair, 0.8);
  for (const m of [-1, 1]) {
    const bt = spec.browT ?? (g.female ? 5 : 7.5);
    const lift = spec.browLift ?? 0;
    const a = P(m * 12, -20 - lift, g.zs(m * 12, -20) + 2);
    const b = P(m * 38, -30 - lift * 0.6 - (spec.browArch ?? 0), g.zs(m * 38, -28) + 2);
    const c = P(m * 58, -24 + (spec.browAngle ?? 0), g.zs(m * 58, -24) + 1);
    ctx.save();
    ctx.fillStyle = rgba(browC, 0.92);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - bt * 0.5);
    ctx.quadraticCurveTo(b[0], b[1] - bt * 0.7, c[0], c[1]);
    ctx.quadraticCurveTo(b[0], b[1] + bt * 0.6, a[0], a[1] + bt * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* ears */
function drawEars(ctx, g, spec) {
  for (const m of [-1, 1]) {
    const [x, y] = g.P(m * 86, 14, -8);
    const vis = m * -Math.sign(g.sn || 1);
    const w = 16 + (vis > 0 ? 6 : -2) * Math.abs(g.sn) * 3;
    ctx.save();
    ctx.fillStyle = rgba(mul(spec.skin, 0.68));
    ctx.beginPath();
    ctx.moveTo(x - m * 4, y - 26);
    ctx.bezierCurveTo(x + m * w, y - 36, x + m * (w + 6), y + 10, x + m * 6, y + 30);
    ctx.quadraticCurveTo(x, y + 36, x - m * 8, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(mul(spec.skin, 0.3), 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + m * 2, y - 20);
    ctx.bezierCurveTo(x + m * (w - 4), y - 24, x + m * (w - 2), y + 6, x + m * 4, y + 18);
    ctx.stroke();
    ctx.restore();
  }
}

/* ─────────────────────────── hair ─────────────────────────── */

/**
 * Paint a hair mass from a list of locks + an optional cap outline into a
 * layer, then add strand texture, sheen and shading.
 */
function paintHair(ctx, g, spec, shapes, r, opts = {}) {
  const { c: hl, ctx: h } = newLayer();
  const base = spec.hair;
  h.fillStyle = rgba(base);
  for (const sh of shapes) {
    h.beginPath();
    if (sh.cap) spline(h, sh.cap, true);
    else lockPath(h, ...sh.lock);
    h.fill();
  }
  h.save();
  h.globalCompositeOperation = 'source-atop';
  const hi = mixc(base, [235, 240, 255], 0.3);
  const lo = mul(base, 0.35);
  // lock separation: dark seam along one edge, lighter body, per lock
  for (const sh of shapes) {
    if (!sh.lock) continue;
    const [x0, y0, x1, y1, w, bend] = sh.lock;
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const body = h.createLinearGradient(x0, y0, x1, y1);
    const bc = mixc(base, hi, 0.25);
    body.addColorStop(0, rgba(bc, 0));
    body.addColorStop(0.35, rgba(bc, 0.38));
    body.addColorStop(1, rgba(bc, 0.18));
    h.fillStyle = body;
    h.beginPath();
    lockPath(h, x0 + nx * w * 0.12, y0 + ny * w * 0.12, x1, y1, w * 0.55, bend);
    h.fill();
    const seam = h.createLinearGradient(x0, y0, x1, y1);
    seam.addColorStop(0, rgba(lo, 0));
    seam.addColorStop(0.3, rgba(lo, 0.55));
    seam.addColorStop(1, rgba(lo, 0.4));
    h.strokeStyle = seam;
    h.lineWidth = 1.6;
    h.beginPath();
    h.moveTo(x0 - (nx * w) / 2, y0 - (ny * w) / 2);
    h.quadraticCurveTo((x0 + x1) / 2 + nx * bend - nx * w * 0.32, (y0 + y1) / 2 + ny * bend - ny * w * 0.32, x1, y1);
    h.stroke();
  }
  // fine strands
  for (const sh of shapes) {
    if (!sh.lock) continue;
    const [x0, y0, x1, y1, w, bend] = sh.lock;
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    for (let k = 0; k < 9; k++) {
      const t = (r() - 0.5) * w * 0.8;
      h.strokeStyle = rgba(r() < 0.45 ? hi : lo, 0.1 + r() * 0.22);
      h.lineWidth = 0.7 + r() * 1.1;
      h.beginPath();
      h.moveTo(x0 + nx * t, y0 + ny * t);
      h.quadraticCurveTo((x0 + x1) / 2 + nx * (bend + t * 0.6), (y0 + y1) / 2 + ny * (bend + t * 0.6), x1 + nx * t * 0.15 + dx * -0.05 * r(), y1 + ny * t * 0.15 + dy * -0.05 * r());
      h.stroke();
    }
  }
  // comb strokes (for caps): list of [x0,y0,cx,cy,x1,y1]
  if (opts.comb) {
    for (const [x0, y0, cx, cy, x1, y1] of opts.comb) {
      h.strokeStyle = rgba(r() < 0.5 ? hi : lo, 0.12 + r() * 0.2);
      h.lineWidth = 0.8 + r() * 1.4;
      h.beginPath();
      h.moveTo(x0, y0);
      h.quadraticCurveTo(cx, cy, x1, y1);
      h.stroke();
    }
  }
  // sheen arc following the skull (anisotropic highlight band)
  {
    const cx = g.hx + g.sn * 10, cy = g.ey - 40 + (opts.sheenY ?? 0);
    h.filter = 'blur(5px)';
    h.strokeStyle = rgba(mixc(base, [200, 215, 245], 0.55), 0.38 * (opts.sheen ?? 1));
    h.lineWidth = 16;
    h.beginPath();
    h.ellipse(cx, cy, 92, 104, 0, side0(spec) - 0.55, side0(spec) + 0.55);
    h.stroke();
    h.filter = 'none';
  }
  h.restore();
  ctx.drawImage(hl, 0, 0);
  return hl;
}

/** Angle on the skull ellipse where the fill-side sheen sits. */
function side0(spec) {
  return spec.light > 0 ? -Math.PI * 0.68 : -Math.PI * 0.32;
}

/** Fringe locks hanging from the hairline across the forehead. */
function fringe(g, r, o) {
  const out = [];
  const n = o.n ?? 9;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = lerp(-o.span, o.span, t) + (r() - 0.5) * 6;
    const rootY = o.rootY ?? -96;
    const len = o.len * (0.75 + r() * 0.45) * (1 - Math.abs(t - 0.5) * (o.taper ?? 0.5));
    const sweep = (o.sweep ?? 0) + (r() - 0.5) * (o.mess ?? 14);
    const root = g.P(x, rootY, g.zs(x, rootY) + 18);
    const tip = g.P(x + sweep, rootY + len, g.zs(x + sweep, rootY + len) + 10);
    out.push({ lock: [root[0], root[1], tip[0], tip[1], (o.w ?? 34) * (0.8 + r() * 0.4), (o.bend ?? 6) * (r() < 0.5 ? -1 : 1)] });
  }
  return out;
}

/** Spiky silhouette locks around the cranium, from crown outward. */
function crownSpikes(g, r, o) {
  const out = [];
  const n = o.n ?? 12;
  for (let i = 0; i < n; i++) {
    const a = lerp(o.a0, o.a1, i / (n - 1)) + (r() - 0.5) * 0.12;
    const rx = 96, ry = 116;
    const cx = g.hx + g.sn * 8, cy = g.ey - 46;
    const root = [cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55];
    const len = o.len * (0.8 + r() * 0.4);
    const tip = [cx + Math.cos(a + (o.swirl ?? 0)) * (rx + len), cy + Math.sin(a + (o.swirl ?? 0)) * (ry + len)];
    out.push({ lock: [root[0], root[1], tip[0], tip[1], o.w * (0.85 + r() * 0.4), (r() - 0.5) * 26 + (o.curl ?? 10)] });
  }
  return out;
}

/** Cranium cap outline (projected). top = extra volume, hairline = y at centre. */
function cap(g, o = {}) {
  const vol = o.vol ?? 12;
  const pts = [];
  const N = 22;
  const bottom = o.bottom ?? 20; // how low the sides go (y)
  // around the back/top from left side to right side
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = Math.PI * (1 + t); // π..2π (left → top → right)
    const x = Math.cos(ang) * (92 + vol);
    const y = -40 + Math.sin(ang) * (108 + vol);
    const yy = t < 0.15 || t > 0.85 ? lerp(y, bottom, (Math.abs(t - 0.5) - 0.35) / 0.15) : y;
    const [px, py] = g.P(x, yy, -10 + (o.front ?? 0) * Math.sin(Math.PI * t));
    pts.push([px, py]);
  }
  // hairline back across the forehead (right → left)
  const hl = o.hairline ?? -92;
  const hw = o.hairW ?? 80;
  for (const [x, y] of [
    [hw, (o.temple ?? -40)],
    [hw * 0.6, hl + 10],
    [hw * 0.2, hl],
    [-hw * 0.2, hl],
    [-hw * 0.6, hl + 10],
    [-hw, (o.temple ?? -40)],
  ]) {
    pts.push(g.P(x, y, g.zs(x, y) + 4));
  }
  return pts;
}

/* ─────────────────────────── main ─────────────────────────── */

export function paintAvatar(ctx, W, spec) {
  const k = W / D;
  const r = rng(spec.seed);
  const g = headModel(spec);
  const side = spec.light;
  const helpers = { paintHair, fringe, crownSpikes, cap, lockPath, spline };
  const hairN = ellipsoidNormal(g.hx + g.sn * 14, g.ey - 46, 124, 150, 0.55);
  const lit = (draw, normal, o) => {
    const { c, ctx: l } = newLayer();
    draw(l);
    lightLayer(l, side, normal, o);
    return c;
  };

  // background
  const { c: bg, ctx: b } = newLayer();
  background(b, spec, r);

  // figure layer
  const { c: fig, ctx: f } = newLayer();
  // 1. back hair / hood back
  if (spec.back) f.drawImage(lit((l) => spec.back(l, g, spec, r, helpers), hairN, { amb: 0.35, key: 0.9, rim: 0.9, spec: 0.06 }), 0, 0);
  // 2. neck
  {
    const ncx = lerp(g.hx, bodyCenter(g), 0.5) + g.sn * 6;
    const neckN = (X, Y) => {
      const nx = Math.max(-0.95, Math.min(0.95, (X - ncx) / 46));
      return [nx, 0.15, Math.sqrt(1 - nx * nx)];
    };
    f.drawImage(lit((l) => drawNeck(l, g, spec), neckN, { amb: 0.3, key: 0.9, rim: 0.7, sss: 0.12 }), 0, 0);
  }
  // 3. torso / outfit
  {
    const bc = bodyCenter(g);
    const torsoN = ellipsoidNormal(bc, g.ey + 420, 300, 230, 0.4);
    f.drawImage(
      lit(
        (l) => {
          OUTFITS[spec.outfit](l, g, spec, r);
          if (spec.afterTorso) spec.afterTorso(l, g, spec, r);
        },
        torsoN,
        { amb: 0.35, key: 0.95, rim: 0.85, spec: 0.04, wrap: 0.3 },
      ),
      0,
      0,
    );
  }
  // 4. ears
  if (!spec.noEars) {
    const earN = (X) => {
      const m = X < g.hx ? -1 : 1;
      return [m * 0.75, 0, 0.66];
    };
    f.drawImage(lit((l) => drawEars(l, g, spec), earN, { amb: 0.3, key: 0.8, rim: 0.9, sss: 0.3 }), 0, 0);
  }
  // 5. face
  const { c: fc, ctx: fx } = newLayer();
  drawFace(fx, g, spec, r);
  // 6. hair (front)
  let hc = null;
  if (spec.front) hc = lit((l) => spec.front(l, g, spec, r, helpers), hairN, { amb: 0.38, key: 0.95, rim: 1.0, spec: 0.1, shine: 18 });
  // hair shadow on face
  if (hc) {
    const sil = silhouette(hc, 'rgba(0,0,0,1)');
    fx.save();
    fx.globalCompositeOperation = 'source-atop';
    fx.filter = 'blur(6px)';
    fx.globalAlpha = 0.7;
    fx.drawImage(sil, side * 3, 10);
    fx.restore();
  }
  // face rim (crimson) + cool fill edge
  {
    const sil = silhouette(fc, '#fff');
    rimLight(fx, sil, side, 'rgb(255,46,54)', 7, 0.9, 1.8);
    rimLight(fx, sil, -side, 'rgb(110,150,210)', 4, 0.22, 2);
  }
  f.drawImage(fc, 0, 0);
  if (hc) f.drawImage(hc, 0, 0);
  if (spec.acc) spec.acc(f, g, spec, r);

  // global silhouette rim (crisp crimson edge on the rim side only)
  {
    const sil = silhouette(fig, '#fff');
    rimLight(f, sil, side, 'rgb(255,40,50)', 5, 0.85, 1.4);
    rimLight(f, sil, side, 'rgb(255,30,40)', 12, 0.14, 4);
  }
  // painterly texture: low-frequency value variation
  {
    const n = noiseTex(spec.seed);
    f.save();
    f.globalCompositeOperation = 'source-atop';
    f.globalAlpha = 0.22;
    f.drawImage(n, 0, 0);
    f.restore();
  }

  // composite
  const zoom = spec.zoom ?? 1.26;
  const zy = spec.zoomY ?? 0;
  ctx.save();
  ctx.scale(k, k);
  ctx.drawImage(bg, 0, 0);
  ctx.save();
  ctx.translate(256, 236 + zy);
  ctx.scale(zoom, zoom);
  ctx.translate(-256, -236);
  // one-sided crimson glow behind the figure
  {
    const { c: gl, ctx: gx } = newLayer();
    gx.filter = 'blur(16px)';
    gx.drawImage(silhouette(fig, 'rgb(255,24,36)'), side * 10, 0);
    gx.filter = 'none';
    gx.globalCompositeOperation = 'destination-in';
    const mg = gx.createLinearGradient(g.hx - side * 40, 0, g.hx + side * 160, 0);
    mg.addColorStop(0, 'rgba(0,0,0,0)');
    mg.addColorStop(1, 'rgba(0,0,0,1)');
    gx.fillStyle = mg;
    gx.fillRect(0, 0, D, D);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.38;
    ctx.drawImage(gl, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(fig, 0, 0);
  ctx.restore();
  // atmosphere: vignette + low fade
  {
    const vg = ctx.createRadialGradient(256, 230, 170, 256, 256, 400);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, D, D);
    const bg2 = ctx.createLinearGradient(0, 400, 0, D);
    bg2.addColorStop(0, 'rgba(0,0,0,0)');
    bg2.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = bg2;
    ctx.fillRect(0, 0, D, D);
  }
  ctx.restore();
  return g;
}

/** Soft mottled overlay (dark/light blotches) for a painterly finish. */
function noiseTex(seed) {
  const { c, ctx } = newLayer();
  const f = noiseField(D, D, { seed: seed + 7, scale: 0.02, octaves: 4 });
  const img = ctx.createImageData(D / 2, D / 2);
  for (let y = 0; y < D / 2; y++) {
    for (let x = 0; x < D / 2; x++) {
      const v = f(x * 2, y * 2) - 0.5;
      const i = (y * (D / 2) + x) * 4;
      const lightish = v > 0;
      img.data[i] = lightish ? 255 : 0;
      img.data[i + 1] = lightish ? 240 : 0;
      img.data[i + 2] = lightish ? 240 : 0;
      img.data[i + 3] = Math.min(255, Math.abs(v) * 2 * 255 * 0.22);
    }
  }
  const { c: small, ctx: sc } = layer(D / 2, D / 2);
  sc.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, D, D);
  return c;
}

export { OUTFITS, rgba, mul, mixc, softEllipse, lockPath };
