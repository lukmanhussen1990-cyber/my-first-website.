/*
 * Suit objects for the card art: the four suit silhouettes (identical to
 * src/components/ui/SuitIcon.tsx) turned into 3D-looking objects with a
 * distance-field height map and per-pixel materials:
 *   chrome — polished / brushed dark silver with studio + red-glint reflections
 *   ruby   — glossy crimson glass with inner glow, fresnel and hard speculars
 *   gem    — faceted ruby (used for the diamond suit)
 * Everything is procedural Canvas2D; no images, no font glyphs.
 */
import { rng, noiseField } from './paint.js';

const HEART =
  'M50 90 C 22 68 5 52 5 32 C 5 17 16 7 30 7 C 39 7 46 12 50 20 C 54 12 61 7 70 7 C 84 7 95 17 95 32 C 95 52 78 68 50 90 Z';
const DIAMOND = 'M50 3 Q 67 29 88 50 Q 67 71 50 97 Q 33 71 12 50 Q 33 29 50 3 Z';
const SPADE =
  'M50 4 C 44 14 8 38 8 60 C 8 74 19 82 31 82 C 39 82 45 78 48 73 C 47 83 42 90 34 95 L 66 95 C 58 90 53 83 52 73 C 55 78 61 82 69 82 C 81 82 92 74 92 60 C 92 38 56 14 50 4 Z';
const CLUB_STEM = 'M46.5 58 C 46.5 76 42 87 33 95 L 67 95 C 58 87 53.5 76 53.5 58 Z';

/** Bounding boxes in the 100-unit icon space: [x0, y0, x1, y1]. */
export const SUIT_BOX = {
  heart: [5, 7, 95, 90],
  diamond: [12, 3, 88, 97],
  spade: [8, 4, 92, 95],
  club: [8, 9, 92, 95],
};

/** Suit silhouette as a list of Path2D (fill each — club parts have mixed winding). */
export function suitPaths(suit) {
  switch (suit) {
    case 'heart':
      return [new Path2D(HEART)];
    case 'diamond':
      return [new Path2D(DIAMOND)];
    case 'spade':
      return [new Path2D(SPADE)];
    default: {
      const out = [];
      for (const [x, y, r] of [
        [50, 28, 19],
        [27, 58, 19],
        [73, 58, 19],
        [50, 52, 12],
      ]) {
        const p = new Path2D();
        p.arc(x, y, r, 0, Math.PI * 2);
        out.push(p);
      }
      out.push(new Path2D(CLUB_STEM));
      return out;
    }
  }
}

/** Fill a suit with the 100-unit origin at (x, y), u px per unit. */
export function fillSuit(ctx, suit, x, y, u) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  for (const p of suitPaths(suit)) ctx.fill(p);
  ctx.restore();
}

/** Stroke a suit outline (lineWidth in px). */
export function strokeSuit(ctx, suit, x, y, u) {
  const lw = ctx.lineWidth;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  ctx.lineWidth = lw / u;
  if (suit === 'club') {
    // outline of the union: draw on a temp canvas would be exact; an approximation
    // that strokes the outer arcs only reads correctly at card scale.
    const parts = suitPaths(suit);
    for (const p of parts) ctx.stroke(p);
  } else {
    for (const p of suitPaths(suit)) ctx.stroke(p);
  }
  ctx.restore();
}

/* ───────────────────────────── fields ───────────────────────────── */

const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Euclidean distance (px) from every inside pixel (alpha > .5) to the outside. */
export function distanceInside(alpha, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = alpha[i] > 0.5 ? INF : 0;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

/** Separable box blur (passes ≈ gaussian) of a float field. */
export function blurField(src, w, h, r, passes = 2) {
  r = Math.max(1, Math.round(r));
  let a = Float32Array.from(src);
  let b = new Float32Array(w * h);
  const k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = 0;
      for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[o + x] = s * k;
        s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s * k;
        s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

/** Render a suit mask; returns alpha (0..1) and the pixel offset of the unit origin. */
export function suitMask(suit, u, pad = 24) {
  const [x0, y0, x1, y1] = SUIT_BOX[suit];
  const w = Math.ceil((x1 - x0) * u + pad * 2);
  const h = Math.ceil((y1 - y0) * u + pad * 2);
  const ox = pad - x0 * u;
  const oy = pad - y0 * u;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  fillSuit(ctx, suit, ox, oy, u);
  const data = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] / 255;
  return { alpha, w, h, ox, oy };
}

/* ─────────────────────────── shading utils ─────────────────────────── */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const tone = (c, exp = 1) => 1 - Math.exp(-c * exp);

/**
 * Studio environment for reflections. r = reflected direction (screen space,
 * y down, z toward viewer). Returns linear-ish rgb (can exceed 1).
 */
function envStudio(rx, ry, rz, o) {
  const c = Math.cos(o.tilt), s = Math.sin(o.tilt);
  const x = rx * c - ry * s;
  const y = rx * s + ry * c;
  const e = -y + o.horizon; // elevation, up positive
  let L;
  if (e >= 0) {
    // dark sky, a bright but narrow horizon band and a crisp overhead soft-box
    L = o.sky + o.horizonGlow * Math.exp(-e * o.horizonSharp);
    const panel = smooth(0.46, 0.49, e) * (1 - smooth(0.74, 0.77, e)) * (1 - smooth(0.3, 0.36, Math.abs(x + 0.12)));
    L += o.box * panel * (0.55 + 0.45 * smooth(0.46, 0.77, e));
    // second, thin bar light
    L += o.box * 0.8 * smooth(0.012, 0.004, Math.abs(e - 0.3)) * (1 - smooth(0.5, 0.55, Math.abs(x)));
    L += o.box * 0.35 * smooth(0.9, 1.0, e);
  } else {
    L = o.ground + o.groundGlow * Math.exp(e * 18);
    // faint reflected floor light
    L += 0.05 * Math.exp(-(((e + 0.45) / 0.12) ** 2));
  }
  // vertical strip lights (crisp)
  const strip = smooth(0.06, 0.03, Math.abs(x + o.stripX)) * smooth(-0.5, -0.1, e) * o.strip;
  const strip2 = smooth(0.022, 0.01, Math.abs(x - 0.22)) * smooth(-0.05, 0.25, e) * (1 - smooth(0.6, 0.7, e)) * o.strip * 0.7;
  const red = Math.exp(-(((x - o.redX) / 0.2) ** 2 + ((e - o.redE) / 0.24) ** 2)) * o.red;
  const back = rz < 0 ? 0.4 + 0.6 * (1 + rz) : 1;
  const w = (L + strip + strip2) * back;
  return [w * o.tint[0] + red * 1.0, w * o.tint[1] + red * 0.06, w * o.tint[2] + red * 0.08];
}

/** Normals from a height field (scaled by `k`). */
function normalsOf(hgt, w, h, k = 1) {
  const nx = new Float32Array(w * h), ny = new Float32Array(w * h), nz = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const dx = (hgt[i + 1] - hgt[i - 1]) * 0.5 * k;
      const dy = (hgt[i + w] - hgt[i - w]) * 0.5 * k;
      const l = Math.hypot(dx, dy, 1);
      nx[i] = -dx / l;
      ny[i] = -dy / l;
      nz[i] = 1 / l;
    }
  }
  return { nx, ny, nz };
}

/* ─────────────────────────── gem facets ─────────────────────────── */

function diamondFacets() {
  const O = [
    [50, 3],
    [88, 50],
    [50, 97],
    [12, 50],
  ];
  const M = [
    [68, 27.75],
    [68, 72.25],
    [32, 72.25],
    [32, 27.75],
  ];
  const k = 0.34;
  const T = O.map(([x, y]) => [50 + (x - 50) * k, 50 + (y - 50) * k]);
  const facets = [{ poly: T, kind: 'table' }];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // extend outer points outward so the clip by the mask does the curved edge
    const ext = (p, f = 1.25) => [50 + (p[0] - 50) * f, 50 + (p[1] - 50) * f];
    facets.push({ poly: [ext(O[i]), ext(M[i], 1.18), T[i]], kind: 'a' });
    facets.push({ poly: [ext(M[i], 1.18), T[j], T[i]], kind: 'b' });
    facets.push({ poly: [ext(M[i], 1.18), ext(O[j]), T[j]], kind: 'c' });
  }
  for (const f of facets) {
    const cx = f.poly.reduce((s, p) => s + p[0], 0) / f.poly.length;
    const cy = f.poly.reduce((s, p) => s + p[1], 0) / f.poly.length;
    f.c = [cx, cy];
  }
  return { facets, O, M, T };
}

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ─────────────────────────── main renderer ─────────────────────────── */

/**
 * Render a lit suit object.
 * @returns {{ canvas: HTMLCanvasElement, ox: number, oy: number, w: number, h: number, alpha: Float32Array }}
 *   ox/oy = pixel position of the 100-unit origin inside the returned canvas.
 */
export function renderSuitObject(suit, u, material, opts = {}) {
  const seed = opts.seed ?? 7;
  const { alpha, w, h, ox, oy } = suitMask(suit, u, opts.pad ?? Math.round(u * 6));
  const dRaw = distanceInside(alpha, w, h);
  const d = blurField(dRaw, w, h, Math.max(1, u * 0.18), 1);
  let maxD = 0;
  for (let i = 0; i < d.length; i++) if (d[i] > maxD) maxD = d[i];

  // ── height field
  const bevel = (opts.bevel ?? (material === 'chrome' ? 0.065 : 0.1)) * 100 * u;
  const domeR = Math.max(2, u * (opts.domeBlur ?? 9));
  const dome = blurField(dRaw, w, h, domeR, 3);
  const domeK = opts.dome ?? (material === 'chrome' ? 0.45 : 0.85);
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < hgt.length; i++) {
    const t = Math.min(1, d[i] / bevel);
    const round = Math.sqrt(1 - (1 - t) * (1 - t));
    hgt[i] = bevel * (0.55 * round + 0.45 * t) + domeK * dome[i];
  }
  const thick = blurField(dRaw, w, h, Math.max(2, u * 5), 2);
  let maxT = 0;
  for (let i = 0; i < thick.length; i++) if (thick[i] > maxT) maxT = thick[i];

  const N = normalsOf(hgt, w, h, opts.normalK ?? 1);

  // facet normals for the gem
  let facetId = null;
  let gem = null;
  if (material === 'gem') {
    gem = diamondFacets();
    facetId = new Int8Array(w * h).fill(-1);
    const r = rng(seed + 3);
    gem.facets.forEach((f) => {
      const dx = f.c[0] - 50, dy = f.c[1] - 50;
      const l = Math.hypot(dx, dy) || 1;
      const tilt = f.kind === 'table' ? 0 : f.kind === 'b' ? 0.58 : 0.78;
      const tx = (dx / l) * Math.tan(tilt) + (r() - 0.5) * 0.12;
      const ty = (dy / l) * Math.tan(tilt) + (r() - 0.5) * 0.12;
      const nl = Math.hypot(tx, ty, 1);
      f.n = [tx / nl, ty / nl, 1 / nl];
      f.fire = r();
    });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (alpha[i] <= 0) continue;
        const ux = (x - ox) / u, uy = (y - oy) / u;
        let id = -1;
        for (let k = 0; k < gem.facets.length; k++) {
          if (inPoly(ux, uy, gem.facets[k].poly)) {
            id = k;
            break;
          }
        }
        if (id < 0) {
          let best = 1e9;
          gem.facets.forEach((f, k) => {
            const dd = (f.c[0] - ux) ** 2 + (f.c[1] - uy) ** 2;
            if (dd < best) {
              best = dd;
              id = k;
            }
          });
        }
        facetId[i] = id;
      }
    }
  }

  // ── textures
  const brushed = noiseField(w, h, { seed: seed + 11, scale: 0.9, octaves: 3 });
  const cloud = noiseField(w, h, { seed: seed + 5, scale: 2.2 / (u * 10), octaves: 5 });
  const veins = noiseField(w, h, { seed: seed + 17, scale: 1.4 / (u * 10), octaves: 4 });
  const pits = rng(seed + 23);

  const env = {
    tilt: opts.envTilt ?? -0.32,
    horizon: opts.horizon ?? 0.08,
    sky: 0.05,
    horizonGlow: 1.35,
    horizonSharp: 11,
    box: 1.6,
    ground: 0.012,
    groundGlow: 0.3,
    strip: 1.5,
    stripX: 0.5,
    red: material === 'chrome' ? 1.4 : 0.5,
    redX: 0.62,
    redE: -0.18,
    tint: material === 'chrome' ? [0.9, 0.93, 1.0] : [1, 0.86, 0.88],
    ...(opts.env || {}),
  };

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const px = img.data;
  const cxp = ox + 50 * u, cyp = oy + 50 * u;
  const F = 100 * u * 2.4; // focal length for per-pixel view vector
  const keyL = [-0.45, -0.75, 0.48];
  {
    const l = Math.hypot(...keyL);
    keyL[0] /= l;
    keyL[1] /= l;
    keyL[2] /= l;
  }
  const tintCore = opts.core ?? [1.0, 0.16, 0.12];
  let hotV = -1, hotX = 0, hotY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a <= 0) continue;
      let nx = N.nx[i], ny = N.ny[i], nz = N.nz[i];
      if (nz === 0) {
        nx = 0;
        ny = 0;
        nz = 1;
      }
      const t = thick[i] / maxT; // 0 edge … 1 core
      if (material === 'gem') {
        const f = gem.facets[facetId[i]];
        // blend facet normal with the rounded rim near the silhouette
        const rim = smooth(0, bevel * 0.55, d[i]);
        nx = f.n[0] * rim + nx * (1 - rim);
        ny = f.n[1] * rim + ny * (1 - rim);
        nz = f.n[2] * rim + nz * (1 - rim);
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
      }
      // view vector toward the eye (perspective)
      let vx = -(x - cxp) / F, vy = -(y - cyp) / F, vz = 1;
      {
        const l = Math.hypot(vx, vy, vz);
        vx /= l;
        vy /= l;
        vz /= l;
      }
      const ndv = nx * vx + ny * vy + nz * vz;
      const rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
      const E = envStudio(rx, ry, rz, env);
      const fres = Math.pow(1 - Math.max(0, ndv), 4);
      const spec = Math.pow(Math.max(0, rx * keyL[0] + ry * keyL[1] + rz * keyL[2]), 90);
      const lam = Math.max(0, nx * keyL[0] + ny * keyL[1] + nz * keyL[2]);

      let r, g, b;
      if (material === 'chrome') {
        // brushed anisotropy + fine grime
        const br = brushed((x + y * 0.35) * 0.02, (y - x * 0.35) * 0.7);
        const grime = smooth(0.35, 0.8, cloud(x * 2.4, y * 2.4));
        const k = 0.8 + 0.3 * br;
        const dark = 1 - 0.3 * grime * (1 - fres);
        const base = opts.chromeBase ?? 0.025;
        r = (E[0] * k * 0.92 + base) * dark;
        g = (E[1] * k * 0.94 + base) * dark;
        b = (E[2] * k * 1.0 + base * 1.15) * dark;
        // occlusion where the bevel meets the face
        const occ = 1 - 0.25 * Math.exp(-(((d[i] - bevel * 1.05) / (bevel * 0.35)) ** 2));
        r *= occ;
        g *= occ;
        b *= occ;
        r += spec * 3.2;
        g += spec * 3.2;
        b += spec * 3.3;
        if (pits() < 0.004) {
          r *= 1.6;
          g *= 1.6;
          b *= 1.6;
        }
        const o = tone(1, 1);
        r = tone(r, 1.25) / o;
        g = tone(g, 1.25) / o;
        b = tone(b, 1.25) / o;
      } else {
        // ruby glass / gem: absorbing body, refracted back-light, fresnel rim, speculars
        const core = smooth(0, 1, t);
        const qx = -nx * 0.9 + vx * 0.2, qy = -ny * 0.9 + vy * 0.2;
        // back-light from lower right refracted through the body (caustic)
        const caust = Math.pow(Math.max(0, qx * 0.6 + qy * 0.68 + 0.08), 2.4);
        const thru = envStudio(-qx * 1.3, -qy * 1.3, 0.9, env);
        const thruL = (thru[0] + thru[1] + thru[2]) / 3;
        const cl = cloud(x * 1.2, y * 1.2);
        let body;
        if (material === 'gem') {
          const f = gem.facets[facetId[i]];
          const dirLight = Math.max(0, f.n[0] * 0.55 + f.n[1] * 0.75 + f.n[2] * 0.1);
          const gx = (x - (ox + f.c[0] * u)) / (u * 26), gy = (y - (oy + f.c[1] * u)) / (u * 26);
          const grad = 0.5 + 0.5 * Math.max(-1, Math.min(1, gx * 0.7 + gy * 0.9));
          body = 0.04 + 0.95 * f.fire * f.fire * grad + 0.9 * dirLight * dirLight + 0.35 * caust;
          if (f.kind === 'table') body = 0.06 + 0.5 * caust + 0.35 * thruL;
          body *= 0.8 + 0.4 * cl;
        } else {
          body = 0.06 + 0.8 * Math.pow(core, 1.4) + 1.0 * caust * (0.35 + 0.65 * core) + 0.45 * thruL * core;
          body *= 0.72 + 0.5 * cl;
          const vn = veins(x + 40 * nx, y + 40 * ny);
          body += Math.exp(-(((vn - 0.5) / 0.012) ** 2)) * 0.22 * core;
        }
        // darker toward the silhouette (longer path through the glass)
        const em = opts.edgeMin ?? 0.28;
        body *= em + (1 - em) * smooth(0, bevel * 1.3, d[i]);
        r = body * 1.35 * tintCore[0] + 0.01;
        g = body * 0.02 + body * body * 0.075 * tintCore[1] * 6;
        b = body * 0.035 + body * body * 0.05;
        // fresnel reflections of the studio + hard speculars
        const refl = (material === 'gem' ? 0.12 : 0.05) + fres * 0.95;
        r += E[0] * refl;
        g += E[1] * refl * 0.92;
        b += E[2] * refl * 0.95;
        r += spec * 4;
        g += spec * 3.6;
        b += spec * 3.6;
        const o = tone(1, 1.1);
        r = tone(r, 1.2) / o;
        g = tone(g, 1.2) / o;
        b = tone(b, 1.2) / o;
      }
      if (a > 0.95 && r + g + b > hotV && d[i] > bevel * 0.3) {
        hotV = r + g + b;
        hotX = x;
        hotY = y;
      }
      px[i * 4] = Math.min(255, r * 255);
      px[i * 4 + 1] = Math.min(255, g * 255);
      px[i * 4 + 2] = Math.min(255, b * 255);
      px[i * 4 + 3] = a * 255;
    }
  }
  octx.putImageData(img, 0, 0);

  // gem facet edges: thin bright ridges with a soft glow, clipped to the silhouette
  if (material === 'gem') {
    octx.save();
    octx.globalCompositeOperation = 'source-atop';
    octx.translate(ox, oy);
    octx.scale(u, u);
    const { O, M, T } = gem;
    const line = (a, b, w, col) => {
      octx.strokeStyle = col;
      octx.lineWidth = (w * Math.min(1, Math.max(0.35, u / 6))) / u;
      octx.beginPath();
      octx.moveTo(a[0], a[1]);
      octx.lineTo(b[0], b[1]);
      octx.stroke();
    };
    octx.lineCap = 'round';
    for (const pass of [
      [3.2, 'rgba(255,120,120,0.10)'],
      [1.2, 'rgba(255,215,215,0.55)'],
    ]) {
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        line(O[i], T[i], pass[0], pass[1]);
        line(M[i], T[i], pass[0] * 0.8, pass[1]);
        line(M[i], T[j], pass[0] * 0.8, pass[1]);
        line(T[i], T[j], pass[0], pass[1]);
      }
    }
    octx.restore();
  }

  return { canvas: out, ox, oy, w, h, alpha, hot: [hotX, hotY] };
}
