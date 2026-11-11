// Low-poly mesh generation + faceted shading for 2D vector art.
// Every shape is triangulated into facets; each facet gets a pseudo-3D normal and is
// lit with a key light, ambient, rim light, specular and optional point lights.
import { rng, clamp, rgb, TAU } from './core.mjs';

// ------------------------------------------------------------------ lighting state
export const LIGHT = {
  dir: [-0.45, -0.62, 0.64], // direction *towards* the key light, screen space (y down)
  key: [1, 1, 1],            // key light colour multiplier
  amb: [0.45, 0.47, 0.55],   // ambient multiplier
  rimDir: [0.8, -0.3],       // rim light screen direction
  rim: [0, 0, 0],            // rim colour (0..255 additive)
  points: [],                // {x, y, r, col:[mult], k} screen-space point lights
  spec: [255, 255, 255],
};
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const norm2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
export function setLight(o) {
  Object.assign(LIGHT, { points: [] }, o);
  LIGHT.dir = norm3(LIGHT.dir);
  LIGHT.rimDir = norm2(LIGHT.rimDir);
}

// ------------------------------------------------------------------ mesh builders
function tri(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const l = Math.hypot(nx, ny, nz) || 1;
  return { p: [a[0], a[1], b[0], b[1], c[0], c[1]], n: [nx / l, ny / l, nz / l], cx: (a[0] + b[0] + c[0]) / 3, cy: (a[1] + b[1] + c[1]) / 3 };
}
function finish(tris, outline, seed) {
  const R = rng(seed * 31 + 7);
  for (const t of tris) t.j = R() * 2 - 1;
  return { tris, outline };
}

export function ellipsePts(rx, ry, n = 12, rot = 0, cx = 0, cy = 0, jit = 0, seed = 1) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const k = 1 + (R() - 0.5) * jit;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Domed low-poly blob from a (star-shaped) outline polygon. */
export function blob(outline, o = {}) {
  const { rings = [0.66, 0.3], bulge = 0.6, seed = 1, jitter = 0.07, twist = 0.5, apex = [-0.12, -0.15] } = o;
  const R = rng(seed);
  const n = outline.length;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, cx = 0, cy = 0;
  for (const [x, y] of outline) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); cx += x; cy += y; }
  cx /= n; cy /= n;
  if (o.center) [cx, cy] = o.center;
  const rx = (maxx - minx) / 2, ry = (maxy - miny) / 2, Rm = Math.max(rx, ry);
  const ringPts = [outline.map(([x, y]) => [x, y, 0])];
  rings.forEach((s, ri) => {
    const pts = [];
    const tt = ri % 2 === 0 ? twist : 0;
    for (let i = 0; i < n; i++) {
      const a = outline[i], b = outline[(i + 1) % n];
      let x = a[0] + (b[0] - a[0]) * tt, y = a[1] + (b[1] - a[1]) * tt;
      const ax = cx + apex[0] * rx * (1 - s), ay = cy + apex[1] * ry * (1 - s);
      x = ax + (x - cx) * s + (R() - 0.5) * jitter * rx;
      y = ay + (y - cy) * s + (R() - 0.5) * jitter * ry;
      pts.push([x, y, bulge * Rm * Math.sqrt(Math.max(0, 1 - s * s))]);
    }
    ringPts.push(pts);
  });
  const top = [cx + apex[0] * rx, cy + apex[1] * ry, bulge * Rm];
  const tris = [];
  for (let r = 0; r < ringPts.length - 1; r++) {
    const A = ringPts[r], B = ringPts[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if ((i + r) % 2 === 0) { tris.push(tri(A[i], A[j], B[j]), tri(A[i], B[j], B[i])); }
      else { tris.push(tri(A[i], A[j], B[i]), tri(A[j], B[j], B[i])); }
    }
  }
  const last = ringPts[ringPts.length - 1];
  for (let i = 0; i < n; i++) tris.push(tri(last[i], last[(i + 1) % n], top));
  return finish(tris, outline, seed);
}

export const ellipseBlob = (rx, ry, o = {}) => blob(ellipsePts(rx, ry, o.n || 12, o.rot || 0, o.cx || 0, o.cy || 0, o.ojit || 0, (o.seed || 1) + 99), o);

/** Bevelled low-poly slab (box seen from the front). */
export function slab(x, y, w, h, o = {}) {
  const { bevel = Math.min(w, h) * 0.12, seed = 1, cols = 2, rows = 2, jitter = 0.18, depthN = 0.72, chamfer = 0 } = o;
  const R = rng(seed);
  const x0 = x, y0 = y, x1 = x + w, y1 = y + h;
  const ix0 = x0 + bevel, iy0 = y0 + bevel, ix1 = x1 - bevel, iy1 = y1 - bevel;
  const tris = [];
  const z = bevel;
  // face grid
  const g = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      let px = ix0 + ((ix1 - ix0) * c) / cols, py = iy0 + ((iy1 - iy0) * r) / rows;
      const pz = z + (c > 0 && c < cols && r > 0 && r < rows ? (R() - 0.5) * bevel * 0.9 : (R() - 0.5) * bevel * 0.25);
      if (c > 0 && c < cols) px += (R() - 0.5) * jitter * ((ix1 - ix0) / cols);
      if (r > 0 && r < rows) py += (R() - 0.5) * jitter * ((iy1 - iy0) / rows);
      row.push([px, py, pz]);
    }
    g.push(row);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = g[r][c], b = g[r][c + 1], cc = g[r + 1][c + 1], d = g[r + 1][c];
    if ((r + c) % 2) { tris.push(tri(a, b, cc), tri(a, cc, d)); } else { tris.push(tri(a, b, d), tri(b, cc, d)); }
  }
  // bevels: explicit normals
  const ch = chamfer;
  const O = [[x0 + ch, y0], [x1 - ch, y0], [x1, y0 + ch], [x1, y1 - ch], [x1 - ch, y1], [x0 + ch, y1], [x0, y1 - ch], [x0, y0 + ch]];
  const I = [[ix0, iy0], [ix1, iy0], [ix1, iy0], [ix1, iy1], [ix1, iy1], [ix0, iy1], [ix0, iy1], [ix0, iy0]];
  const dn = depthN, dz = Math.sqrt(1 - dn * dn);
  const N = [[0, -dn], [0.6 * dn, -0.6 * dn], [dn, 0], [0.6 * dn, 0.6 * dn], [0, dn], [-0.6 * dn, 0.6 * dn], [-dn, 0], [-0.6 * dn, -0.6 * dn]];
  const quads = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]];
  const Nq = [N[0], N[1], N[2], N[3], N[4], N[5], N[6], N[7]];
  quads.forEach(([i, j], k) => {
    const n = Nq[k];
    const mk = (pp) => ({ p: pp.flat(), n: [n[0], n[1], dz], cx: (pp[0][0] + pp[1][0] + pp[2][0]) / 3, cy: (pp[0][1] + pp[1][1] + pp[2][1]) / 3 });
    tris.push(mk([O[i], O[j], I[j]]));
    tris.push(mk([O[i], I[j], I[i]]));
  });
  return finish(tris, O, seed);
}

/** Flat panel of jittered triangles (walls/floors) with subtle normal variation. */
export function panel(x, y, w, h, o = {}) {
  const { cols = 6, rows = 10, jitter = 0.35, wob = 0.18, seed = 1 } = o;
  const R = rng(seed);
  const g = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      let px = x + (w * c) / cols, py = y + (h * r) / rows;
      if (c > 0 && c < cols) px += (R() - 0.5) * jitter * (w / cols);
      if (r > 0 && r < rows) py += (R() - 0.5) * jitter * (h / rows);
      row.push([px, py, (R() - 0.5) * wob * Math.min(w / cols, h / rows)]);
    }
    g.push(row);
  }
  const tris = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = g[r][c], b = g[r][c + 1], cc = g[r + 1][c + 1], d = g[r + 1][c];
    if (R() > 0.5) tris.push(tri(a, b, cc), tri(a, cc, d)); else tris.push(tri(a, b, d), tri(b, cc, d));
  }
  return finish(tris, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], seed);
}

/** Arbitrary polygon: fan from a jittered interior apex with an extra ring (good for odd shapes). */
export function poly(outline, o = {}) { return blob(outline, { rings: o.rings || [0.55], bulge: o.bulge ?? 0.3, ...o }); }

// ------------------------------------------------------------------ mesh drawing
const _cache = new Map();
export function cached(key, fn) { let m = _cache.get(key); if (!m) { m = fn(); _cache.set(key, m); } return m; }

/**
 * Shade + draw a mesh.
 * mat: {c:[r,g,b], kd, amb, spec, shin, jit, rim, alpha, emit}
 */
export function drawMesh(ctx, mesh, mat) {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  const sc = Math.sqrt(Math.abs(det)) || 1;
  const L = LIGHT.dir, K = LIGHT.key, A = LIGHT.amb, P = LIGHT.points, RD = LIGHT.rimDir, RC = LIGHT.rim;
  const c = mat.c, kd = mat.kd ?? 0.75, amb = mat.amb ?? 1, spec = mat.spec ?? 0.08, shin = mat.shin ?? 18, jit = mat.jit ?? 0.05;
  const rimK = mat.rim ?? 1, emit = mat.emit || 0, alpha = mat.alpha ?? 1;
  // half vector for spec (viewer at +z)
  let hx = L[0], hy = L[1], hz = L[2] + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
  const prevA = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = prevA * alpha;
  // underlay hides AA seams between facets
  const ol = mesh.outline;
  const shadeOne = (nx0, ny0, nz, cxl, cyl, j) => {
    const nx = (m.a * nx0 + m.c * ny0) / sc, ny = (m.b * nx0 + m.d * ny0) / sc;
    const d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    let r = A[0] * amb + d * K[0] * kd, g = A[1] * amb + d * K[1] * kd, b = A[2] * amb + d * K[2] * kd;
    let ar = 0, ag = 0, ab = 0;
    if (P.length) {
      const sx = m.a * cxl + m.c * cyl + m.e, sy = m.b * cxl + m.d * cyl + m.f;
      for (const p of P) {
        const dx = p.x - sx, dy = p.y - sy, dist = Math.hypot(dx, dy);
        if (dist >= p.r) continue;
        const f = (1 - dist / p.r); const ff = f * f * (p.k ?? 1);
        const lz = p.z ?? 0.6;
        const ll = Math.hypot(dx / p.r, dy / p.r, lz) || 1;
        const facing = 0.35 + 0.65 * Math.max(0, (nx * dx / p.r + ny * dy / p.r + nz * lz) / ll);
        r += p.col[0] * ff * facing; g += p.col[1] * ff * facing; b += p.col[2] * ff * facing;
        ar += p.col[0] * ff * 18; ag += p.col[1] * ff * 18; ab += p.col[2] * ff * 18;
      }
    }
    const rimv = rimK * Math.pow(1 - nz, 1.5) * Math.max(0, nx * RD[0] + ny * RD[1]);
    const s = spec > 0 ? spec * Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), shin) : 0;
    const jj = 1 + j * jit;
    return [
      clamp((c[0] * r + ar + RC[0] * rimv + LIGHT.spec[0] * s + emit * c[0]) * jj, 0, 255),
      clamp((c[1] * g + ag + RC[1] * rimv + LIGHT.spec[1] * s + emit * c[1]) * jj, 0, 255),
      clamp((c[2] * b + ab + RC[2] * rimv + LIGHT.spec[2] * s + emit * c[2]) * jj, 0, 255),
    ];
  };
  if (ol && mat.underlay !== false) {
    ctx.beginPath();
    ctx.moveTo(ol[0][0], ol[0][1]);
    for (let i = 1; i < ol.length; i++) ctx.lineTo(ol[i][0], ol[i][1]);
    ctx.closePath();
    const cc = shadeOne(0, 0, 1, ol[0][0], ol[0][1], 0);
    ctx.fillStyle = rgb([cc[0] * 0.9, cc[1] * 0.9, cc[2] * 0.9]);
    ctx.fill();
  }
  const seam = mat.seam ?? 0.6 / sc;
  ctx.lineJoin = 'round';
  ctx.lineWidth = seam * 2;
  for (const t of mesh.tris) {
    const col = shadeOne(t.n[0], t.n[1], t.n[2], t.cx, t.cy, t.j);
    const p = t.p;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.closePath();
    const s = rgb(col);
    ctx.fillStyle = s; ctx.fill();
    if (seam > 0) { ctx.strokeStyle = s; ctx.stroke(); }
  }
  if (alpha < 1) ctx.globalAlpha = prevA;
}

/** Faceted limb: polyline with widths, split lengthwise into a lit and a shaded strip. */
export function limb(ctx, pts, widths, light, dark, o = {}) {
  const n = pts.length;
  const L = [], Rr = [], Cc = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (Array.isArray(widths) ? widths[i] : widths) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    Rr.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    Cc.push([pts[i][0] + (o.ridge || 0) * dy * w, pts[i][1] - (o.ridge || 0) * dx * w]);
  }
  const strip = (A, B, col) => {
    ctx.beginPath();
    ctx.moveTo(A[0][0], A[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(A[i][0], A[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke();
  };
  strip(L, Cc, light);
  strip(Cc, Rr, dark);
  if (o.cap) {
    const e = pts[n - 1], w = (Array.isArray(widths) ? widths[n - 1] : widths) / 2;
    ctx.beginPath(); ctx.arc(e[0], e[1], w, 0, TAU); ctx.fillStyle = dark; ctx.fill();
  }
}

/** Smooth tapered stroke along points (antennae, hair strands). */
export function taper(ctx, pts, w0, w1, color) {
  const n = pts.length;
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    Rr.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

export function bezierPts(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

// ------------------------------------------------------------------ fx primitives
export function glow(ctx, x, y, r, col, a = 1, mode = 'lighter') {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(col, a));
  g.addColorStop(0.25, rgb(col, a * 0.45));
  g.addColorStop(0.6, rgb(col, a * 0.12));
  g.addColorStop(1, rgb(col, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prev;
}

export function softShadow(ctx, x, y, rx, ry, a = 0.45) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}

export function path(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export function fillPoly(ctx, pts, col) { path(ctx, pts); ctx.fillStyle = col; ctx.fill(); }
