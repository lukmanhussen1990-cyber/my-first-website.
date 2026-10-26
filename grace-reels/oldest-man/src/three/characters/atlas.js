// Character atlas pipeline (runtime, synchronous, deterministic):
//   SVG part specs -> shelf-packed regions -> canvas 2D (Path2D draws the SVG paths) = COLOUR atlas
//   silhouettes -> signed Euclidean distance field (half res) -> SHAPE atlas:
//       R,G = outward edge direction (part space, y up), B = in-plane "pillow" normal magnitude, A = distance to edge
//   both uploaded as mipmapped, anisotropic textures. Geometry for each part is built from the SAME path
//   (flattened polygon), with uv into its region, a miter attribute (outline), a layer and a tint.
import * as THREE from 'three';
import { flatten, bboxOf, signedArea } from './svg.js';
import { hash01 } from '../../lib/util.js';

export const SPREAD = 32;          // shape-atlas texels encoded in the A channel (edge distance)
const ATLAS_CACHE = new Map();
export const STATS = { atlases: 0, ms: 0, texels: 0 };

// ---------------------------------------------------------------- deterministic paper grain (tileable)
let _grain = null;
function grainCanvas() {
  if (_grain) return _grain;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); const img = g.createImageData(S, S);
  const lat = (i, j, o, P) => hash01(((i % P) + P) % P * 7919 + (((j % P) + P) % P) * 104729, o);
  const vn = (x, y, P, o) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = lat(xi, yi, o, P), b = lat(xi + 1, yi, o, P), c2 = lat(xi, yi + 1, o, P), d = lat(xi + 1, yi + 1, o, P);
    return (a + (b - a) * u) * (1 - v) + (c2 + (d - c2) * u) * v;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const low = vn(x / 32, y / 32, 8, 3) * 0.55 + vn(x / 16, y / 16, 16, 5) * 0.3 + vn(x / 8, y / 8, 32, 7) * 0.15;
    const fib = hash01(x * 131 + y * 7, 11) > 0.985 ? -0.25 : 0;
    const fine = hash01(x * 92821 + y, 13) - 0.5;
    const v = Math.max(0, Math.min(1, 0.5 + (low - 0.5) * 0.9 + fine * 0.22 + fib));
    const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); _grain = c; return c;
}

// ---------------------------------------------------------------- exact EDT (Felzenszwalb & Huttenlocher)
const INF = 1e12;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
function edt2d(grid, w, h) { // grid: 0 = feature, INF = other; in place -> squared distance
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = d[x]; }
}

// ---------------------------------------------------------------- packing
function shelfPack(items, W) {
  const order = items.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, rowH = 0;
  for (const it of order) {
    if (x + it.w > W) { x = 0; y += rowH; rowH = 0; }
    it.ox = x; it.oy = y; x += it.w; rowH = Math.max(rowH, it.h);
  }
  return y + rowH;
}

function regionKeyOf(p) {
  return p.regionKey || JSON.stringify([p.shape, p.holes || null, p.draw, p.density, p.bulge ?? 1, p.prof ?? 1, p.rim ?? true, p.shapeFrom || null, p.solid || null, p.grain ?? 1]);
}

// ---------------------------------------------------------------- the atlas
// parts: [{ id, shape, holes?, draw:[elems], density, bulge?, prof?, rim?, shapeFrom?:{id,dx,dy}, solid?, grain? }]
export function buildAtlas(cacheKey, parts, { W = 2048, H = 2048, grain = 0.16, fill = 0.9, maxScale = 2.2 } = {}) {
  if (cacheKey && ATLAS_CACHE.has(cacheKey)) return ATLAS_CACHE.get(cacheKey);
  const t0 = performance.now();
  const regs = new Map();
  for (const p of parts) {
    const k = regionKeyOf(p);
    let r = regs.get(k);
    if (!r) {
      const polys = flatten(p.shape, 0.00025);
      const bb = bboxOf(polys);
      r = { key: k, spec: p, polys, bb, ids: [] }; regs.set(k, r);
    }
    r.ids.push(p.id); p._region = r;
  }
  const R = [...regs.values()];
  const PAD = 6; // texels each side (dilation + mip safety)
  const sizeAll = (s) => { for (const r of R) { const rho = r.spec.density * s; r.rho = rho; r.w = 2 * Math.ceil(((r.bb[2] - r.bb[0]) * rho + 2 * PAD) / 2); r.h = 2 * Math.ceil(((r.bb[3] - r.bb[1]) * rho + 2 * PAD) / 2); } };
  // find the largest global density scale that fits (binary search), so every atlas is used well
  let lo = 0.05, hi = maxScale;
  sizeAll(hi); if (shelfPack(R, W) <= H * fill && R.every((r) => r.w <= W)) lo = hi;
  else for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; sizeAll(m); if (R.every((r) => r.w <= W) && shelfPack(R, W) <= H * fill) lo = m; else hi = m; }
  sizeAll(lo); shelfPack(R, W);
  // ---- colour atlas
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const grainPat = g.createPattern(grainCanvas(), 'repeat');
  const pathCache = new Map();
  const P2 = (d) => { let p = pathCache.get(d); if (!p) { p = new Path2D(d); pathCache.set(d, p); } return p; };
  const toRegion = (ctx, r, k = 1) => ctx.setTransform(r.rho * k, 0, 0, -r.rho * k, (r.ox + PAD - r.bb[0] * r.rho) * k, (r.oy + PAD + r.bb[3] * r.rho) * k);
  for (const r of R) {
    const s = r.spec, base = s.solid || (s.draw && s.draw[0] && s.draw[0].fill) || '#888';
    g.save(); toRegion(g, r);
    const shape = P2(s.shape);
    g.fillStyle = base; g.fill(shape);
    g.lineJoin = 'round'; g.lineWidth = 6 / r.rho; g.strokeStyle = base; g.stroke(shape); // dilation for filtering
    g.save(); g.clip(shape);
    const elems = s.draw || [];
    for (let i = 0; i < elems.length; i++) {
      const e = elems[i];
      if (i === 0 && e.fill && !e.stroke && e.d === s.shape) continue; // base already drawn
      drawElem(g, e, P2, r.rho);
    }
    if ((s.grain ?? 1) > 0 && !s.solid) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      const sc = Math.max(0.6, r.rho * 0.0016);
      grainPat.setTransform(new DOMMatrix([sc, 0, 0, sc, r.ox, r.oy]));
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = grain * (s.grain ?? 1); g.fillStyle = grainPat;
      g.fillRect(r.ox, r.oy, r.w, r.h); g.restore();
    }
    g.restore(); g.restore();
  }
  // ---- shape atlas (half resolution)
  const SW = W / 2, SH = H / 2;
  const mc = document.createElement('canvas'); mc.width = SW; mc.height = SH;
  const mg = mc.getContext('2d', { willReadFrequently: true });
  mg.fillStyle = '#000'; mg.fillRect(0, 0, SW, SH);
  for (const r of R) { mg.save(); toRegion(mg, r, 0.5); mg.fillStyle = '#fff'; mg.fill(P2(r.spec.shape), 'nonzero'); mg.restore(); }
  const mask = mg.getImageData(0, 0, SW, SH).data;
  const shape = new Uint8Array(SW * SH * 4);
  for (let i = 0; i < SW * SH; i++) { shape[i * 4] = 128; shape[i * 4 + 1] = 128; shape[i * 4 + 2] = 0; shape[i * 4 + 3] = 0; }
  const later = [];
  for (const r of R) { if (r.spec.shapeFrom) later.push(r); else shapeField(r, mask, shape, SW); }
  for (const r of later) copyField(r, regs, parts, shape, SW);
  const colorTex = new THREE.CanvasTexture(cv);
  colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.flipY = false; colorTex.anisotropy = 16;
  colorTex.generateMipmaps = true; colorTex.minFilter = THREE.LinearMipmapLinearFilter; colorTex.magFilter = THREE.LinearFilter;
  const shapeTex = new THREE.DataTexture(shape, SW, SH, THREE.RGBAFormat, THREE.UnsignedByteType);
  shapeTex.flipY = false; shapeTex.anisotropy = 8; shapeTex.generateMipmaps = true;
  shapeTex.minFilter = THREE.LinearMipmapLinearFilter; shapeTex.magFilter = THREE.LinearFilter; shapeTex.needsUpdate = true;
  const atlas = { key: cacheKey, W, H, SW, SH, PAD, regions: regs, colorTex, shapeTex, canvas: cv, scale: lo, ms: performance.now() - t0 };
  STATS.atlases++; STATS.ms += atlas.ms; STATS.texels += W * H;
  if (cacheKey) ATLAS_CACHE.set(cacheKey, atlas);
  return atlas;
}

function drawElem(g, e, P2, rho) {
  g.save();
  if (e.a != null) g.globalAlpha = e.a;
  if (e.blend) g.globalCompositeOperation = e.blend;
  if (e.blur) g.filter = `blur(${(e.blur * rho).toFixed(2)}px)`;
  const p = P2(e.d);
  if (e.fill) { g.fillStyle = e.fill; g.fill(p, e.rule || 'nonzero'); }
  if (e.stroke) {
    g.strokeStyle = e.stroke; g.lineWidth = e.w; g.lineCap = e.cap || 'round'; g.lineJoin = e.join || 'round';
    if (e.dash) g.setLineDash(e.dash);
    g.stroke(p);
  }
  g.restore();
}

// signed distance -> direction / pillow / edge distance for one region
function shapeField(r, mask, out, SW) {
  const x0 = r.ox / 2, y0 = r.oy / 2, w = r.w / 2, h = r.h / 2, n = w * h;
  const din = new Float64Array(n), dout = new Float64Array(n), inside = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = mask[((y0 + y) * SW + x0 + x) * 4] > 127; const i = y * w + x;
    inside[i] = m ? 1 : 0; din[i] = m ? INF : 0; dout[i] = m ? 0 : INF;
  }
  edt2d(din, w, h); edt2d(dout, w, h);
  const sd = new Float32Array(n); let maxSd = 0.5;
  for (let i = 0; i < n; i++) { sd[i] = inside[i] ? Math.sqrt(din[i]) - 0.5 : 0.5 - Math.sqrt(dout[i]); if (sd[i] > maxSd) maxSd = sd[i]; }
  const s = r.spec, bulge = s.bulge ?? 1, prof = s.prof ?? 1, rim = s.rim ?? true;
  r.maxSd = maxSd; r.sd = sd; r.sw = w; r.sh = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const xl = sd[y * w + Math.max(0, x - 1)], xr = sd[y * w + Math.min(w - 1, x + 1)];
    const yu = sd[Math.max(0, y - 1) * w + x], yd = sd[Math.min(h - 1, y + 1) * w + x];
    let gx = -(xr - xl), gy = (yd - yu); // outward, part space (canvas y is down -> flip)
    const l = Math.hypot(gx, gy); if (l > 1e-6) { gx /= l; gy /= l; } else { gx = 0; gy = 0; }
    const u = Math.max(0, Math.min(1, sd[i] / maxSd));
    const xm = bulge * Math.pow(1 - u, prof);
    const o = ((y0 + y) * SW + x0 + x) * 4;
    out[o] = Math.round(128 + 127 * gx); out[o + 1] = Math.round(128 + 127 * gy);
    out[o + 2] = Math.round(255 * Math.max(0, Math.min(1, xm)));
    out[o + 3] = rim ? Math.round(255 * Math.max(0, Math.min(1, sd[i] / SPREAD))) : 255;
  }
}
// a part that should shade exactly like another (e.g. eyelids = the head's skin around the eye)
function copyField(r, regs, parts, out, SW) {
  const src = parts.find((p) => p.id === r.spec.shapeFrom.id);
  const sr = src && src._region;
  if (!sr || !sr.sd) { shapeField(r, null, out, SW); return; }
  const x0 = r.ox / 2, y0 = r.oy / 2, w = r.w / 2, h = r.h / 2;
  const { dx = 0, dy = 0 } = r.spec.shapeFrom;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // texel -> part metres -> source metres -> source texel
    const mx = r.bb[0] + ((x + 0.5) * 2 - 6) / r.rho + dx, my = r.bb[3] - ((y + 0.5) * 2 - 6) / r.rho + dy;
    const sx = Math.round(((mx - sr.bb[0]) * sr.rho + 6) / 2 - 0.5), sy = Math.round(((sr.bb[3] - my) * sr.rho + 6) / 2 - 0.5);
    const o = ((y0 + y) * SW + x0 + x) * 4;
    if (sx >= 0 && sy >= 0 && sx < sr.w / 2 && sy < sr.h / 2) {
      const so = ((sr.oy / 2 + sy) * SW + sr.ox / 2 + sx) * 4;
      out[o] = out[so]; out[o + 1] = out[so + 1]; out[o + 2] = out[so + 2]; out[o + 3] = 255;
    } else { out[o] = 128; out[o + 1] = 128; out[o + 2] = 0; out[o + 3] = 255; }
  }
}

// ---------------------------------------------------------------- geometry
function miters(p, ccw) {
  const n = p.length, en = [], out = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % n];
    let nx = y2 - y1, ny = -(x2 - x1); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (!ccw) { nx = -nx; ny = -ny; }
    en.push([nx, ny]);
  }
  for (let i = 0; i < n; i++) {
    const a = en[(i - 1 + n) % n], b = en[i];
    let mx = a[0] + b[0], my = a[1] + b[1]; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    const d = Math.max(0.5, mx * b[0] + my * b[1]);
    out.push([mx / d, my / d]);
  }
  return out;
}

function uvMapper(atlas, r) {
  return (x, y) => [(r.ox + atlas.PAD + (x - r.bb[0]) * r.rho) / atlas.W, (r.oy + atlas.PAD + (r.bb[3] - y) * r.rho) / atlas.H];
}

// polygon part (earcut, optional holes without outline)
export function polyGeometry(atlas, part, { layer = 0, olayer = layer - 0.5, tint = 1 } = {}) {
  const r = part._region;
  let outer = r.polys[0];
  if (r.polys.length > 1) outer = r.polys.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
  const holes = part.holes ? part.holes.map((d) => flatten(d, 0.00025)[0]) : [];
  const ccw = signedArea(outer) > 0;
  const mo = miters(outer, ccw);
  const all = outer.concat(...holes);
  const mit = mo.concat(...holes.map((h) => h.map(() => [0, 0])));
  const tris = THREE.ShapeUtils.triangulateShape(outer.map(([x, y]) => new THREE.Vector2(x, y)), holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))));
  const uv = uvMapper(atlas, r);
  return assemble(all, mit, tris.flat(), uv, layer, olayer, tint);
}

function assemble(pts, mit, idx, uv, layer, olayer, tint) {
  const n = pts.length;
  const pos = new Float32Array(n * 3), uvs = new Float32Array(n * 2), mi = new Float32Array(n * 2), ly = new Float32Array(n), oly = new Float32Array(n), tn = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = pts[i][0]; pos[i * 3 + 1] = pts[i][1];
    const [u, v] = uv(pts[i][0], pts[i][1]); uvs[i * 2] = u; uvs[i * 2 + 1] = v;
    mi[i * 2] = mit[i][0]; mi[i * 2 + 1] = mit[i][1]; ly[i] = layer; oly[i] = olayer; tn[i] = tint;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('miter', new THREE.BufferAttribute(mi, 2));
  g.setAttribute('layer', new THREE.BufferAttribute(ly, 1));
  g.setAttribute('olayer', new THREE.BufferAttribute(oly, 1));
  g.setAttribute('tint', new THREE.BufferAttribute(tn, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.6; // bending / outline growth
  return g;
}

// deformable strip for y-monotone parts (beards, long hair, robes, tails): rows at every polygon vertex
// height of both side chains, `cols` columns. userData.base keeps the rest pose; bend() deforms it.
export function stripGeometry(atlas, part, { layer = 0, olayer = layer - 0.5, tint = 1, cols = 5, minRow = 0.012 } = {}) {
  const r = part._region;
  const poly = r.polys.reduce((a, b) => (b.length > a.length ? b : a));
  const n = poly.length;
  let it = 0, ib = 0;
  for (let i = 0; i < n; i++) { if (poly[i][1] > poly[it][1]) it = i; if (poly[i][1] < poly[ib][1]) ib = i; }
  const chainA = [], chainB = [];
  for (let i = it; ; i = (i + 1) % n) { chainA.push(poly[i]); if (i === ib) break; }
  for (let i = it; ; i = (i - 1 + n) % n) { chainB.push(poly[i]); if (i === ib) break; }
  const meanX = (c) => c.reduce((s, p) => s + p[0], 0) / c.length;
  const [left, right] = meanX(chainA) < meanX(chainB) ? [chainA, chainB] : [chainB, chainA];
  const yTop = poly[it][1], yBot = poly[ib][1];
  const ys = new Set();
  for (const p of left) ys.add(p[1]); for (const p of right) ys.add(p[1]);
  for (let y = yTop; y > yBot; y -= minRow) ys.add(y);
  const Y = [...ys].filter((y) => y <= yTop + 1e-9 && y >= yBot - 1e-9).sort((a, b) => b - a);
  const dedup = []; for (const y of Y) if (!dedup.length || dedup[dedup.length - 1] - y > 1e-5) dedup.push(y);
  const xAt = (chain, y) => {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i], b = chain[i + 1];
      if ((y <= a[1] && y >= b[1]) || (y >= a[1] && y <= b[1])) { const t = Math.abs(b[1] - a[1]) < 1e-12 ? 0 : (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * t; }
    }
    return chain[chain.length - 1][0];
  };
  const rows = dedup.length, C = cols;
  const pts = [], wgt = [];
  for (let j = 0; j < rows; j++) {
    const y = dedup[j]; const xl = xAt(left, y), xr = xAt(right, y);
    for (let i = 0; i < C; i++) { pts.push([xl + (xr - xl) * (i / (C - 1)), y]); wgt.push((yTop - y) / Math.max(1e-6, yTop - yBot)); }
  }
  // boundary loop for miters: top row L->R, right side down, bottom row R->L, left side up
  const loop = [];
  for (let i = 0; i < C; i++) loop.push(i);
  for (let j = 1; j < rows; j++) loop.push(j * C + C - 1);
  for (let i = C - 2; i >= 0; i--) loop.push((rows - 1) * C + i);
  for (let j = rows - 2; j >= 1; j--) loop.push(j * C);
  const lp = loop.map((k) => pts[k]);
  const clean = []; const cleanIdx = [];
  for (let k = 0; k < lp.length; k++) { const prev = clean[clean.length - 1]; if (!prev || Math.hypot(lp[k][0] - prev[0], lp[k][1] - prev[1]) > 1e-7) { clean.push(lp[k]); cleanIdx.push(loop[k]); } else cleanIdx[cleanIdx.length - 1] = cleanIdx[cleanIdx.length - 1]; }
  const ccw = signedArea(clean) > 0;
  const mlp = miters(clean, ccw);
  const mit = pts.map(() => [0, 0]);
  cleanIdx.forEach((k, i) => { mit[k] = mlp[i]; });
  // degenerate (zero-width) rows: give both coincident vertices the same miter
  for (let j = 0; j < rows; j++) { const a = j * C, b = j * C + C - 1; if (Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) < 1e-7) for (let i = 0; i < C; i++) mit[a + i] = mit[a][0] || mit[a][1] ? mit[a] : mit[b]; }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < C - 1; i++) { const a = j * C + i, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = assemble(pts, mit, idx, uvMapper(atlas, r), layer, olayer, tint);
  g.userData.base = Float32Array.from(g.attributes.position.array);
  g.userData.baseMit = Float32Array.from(g.attributes.miter.array);
  g.userData.w = Float32Array.from(wgt);
  g.userData.state = '';
  return g;
}

// deform a strip: rotate each vertex about the part origin by a(w) = a1 w + a2 w^2 + wave sin(k w - ph) w,
// and flare x by (1 + flare w^2) + shift w^2. Cheap; only re-uploads when the parameters change.
export function bend(g, a1 = 0, a2 = 0, wave = 0, ph = 0, flare = 0, shiftX = 0, k = 5) {
  const key = `${a1.toFixed(4)}|${a2.toFixed(4)}|${wave.toFixed(4)}|${ph.toFixed(3)}|${flare.toFixed(4)}|${shiftX.toFixed(4)}`;
  if (g.userData.state === key) return;
  g.userData.state = key;
  const B = g.userData.base, M = g.userData.baseMit, W = g.userData.w;
  const pos = g.attributes.position.array, mi = g.attributes.miter.array;
  for (let i = 0; i < W.length; i++) {
    const w = W[i];
    const a = a1 * w + a2 * w * w + wave * w * Math.sin(k * w - ph);
    const cs = Math.cos(a), sn = Math.sin(a);
    const x = B[i * 3] * (1 + flare * w * w) + shiftX * w * w, y = B[i * 3 + 1];
    pos[i * 3] = x * cs - y * sn; pos[i * 3 + 1] = x * sn + y * cs;
    const mx = M[i * 2], my = M[i * 2 + 1];
    mi[i * 2] = mx * cs - my * sn; mi[i * 2 + 1] = mx * sn + my * cs;
  }
  g.attributes.position.needsUpdate = true; g.attributes.miter.needsUpdate = true;
}

export function clearAtlasCache() { for (const a of ATLAS_CACHE.values()) { a.colorTex.dispose(); a.shapeTex.dispose(); } ATLAS_CACHE.clear(); }
