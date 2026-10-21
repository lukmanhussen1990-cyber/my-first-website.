// Procedural textures made with code: color, normal (from height) and roughness maps.
import * as THREE from 'three';
import { fbm, vnoise, rng, clamp, lerp, smooth } from './util.js';

const cache = {};
let ANISO = 8;
export function setAniso(a) { ANISO = a; }

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function toTexture(c, { srgb = true, repeat = [1, 1], wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = ANISO;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// Field: color (rgb float 0..1), height and roughness buffers -> textures.
class Field {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.col = new Float32Array(w * h * 3);
    this.hgt = new Float32Array(w * h);
    this.rough = new Float32Array(w * h).fill(0.8);
  }
  colorTex(opts) {
    const { w, h, col } = this; const c = canvas(w, h); const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h); const d = img.data;
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      d[i * 4] = clamp(col[j]) * 255; d[i * 4 + 1] = clamp(col[j + 1]) * 255; d[i * 4 + 2] = clamp(col[j + 2]) * 255; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return toTexture(c, opts);
  }
  normalTex(strength = 2, opts = {}) {
    const { w, h, hgt } = this; const c = canvas(w, h); const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h); const d = img.data; const wrap = opts.wrap !== false;
    const at = (x, y) => {
      if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); }
      return hgt[y * w + x];
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * strength;
      let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return toTexture(c, { ...opts, srgb: false });
  }
  roughTex(opts = {}) {
    const { w, h, rough } = this; const c = canvas(w, h); const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h); const d = img.data;
    for (let i = 0; i < w * h; i++) { const v = clamp(rough[i]) * 255; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0); return toTexture(c, { ...opts, srgb: false });
  }
  set(i, r, g, b) { this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; }
}

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2)); }; // srgb-ish 0..1
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Draw round pebbles into a field (adds height dome and color).
function pebbles(F, n, rmin, rmax, colors, r, opts = {}) {
  const { w, h } = F;
  for (let k = 0; k < n; k++) {
    const cx = r() * w, cy = opts.yRange ? lerp(opts.yRange[0], opts.yRange[1], r()) * h : r() * h;
    const rad = lerp(rmin, rmax, Math.pow(r(), 1.8)); const ar = lerp(0.6, 1.0, r()); const rot = r() * Math.PI;
    const base = colors[Math.floor(r() * colors.length)]; const shade = lerp(0.8, 1.15, r());
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (let y = Math.floor(cy - rad - 2); y <= cy + rad + 2; y++) for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
      const xx = ((x % w) + w) % w; if (y < 0 || y >= h) continue;
      const dx = x - cx, dy = y - cy; const u = (dx * cs + dy * sn) / rad, v = (-dx * sn + dy * cs) / (rad * ar);
      const q = u * u + v * v; if (q > 1.15) continue;
      const i = y * w + xx;
      if (q > 1) { F.hgt[i] -= 0.15 * rad * 0.1; const s = 0.75; F.col[i * 3] *= s; F.col[i * 3 + 1] *= s; F.col[i * 3 + 2] *= s; continue; }
      const dome = Math.sqrt(1 - q);
      const nz = fbm(x * 0.15, y * 0.15, 2, k);
      const lit = 0.75 + 0.35 * dome - 0.15 * v;
      F.set(i, base[0] * shade * lit * (0.9 + 0.2 * nz), base[1] * shade * lit * (0.9 + 0.2 * nz), base[2] * shade * lit * (0.9 + 0.2 * nz));
      F.hgt[i] = Math.max(F.hgt[i], F.hgt[i] * 0.3 + dome * rad * 0.12);
      F.rough[i] = 0.55 + 0.2 * nz;
    }
  }
}

// ------------------------------------------------------------------ soil
// Cut face of the garden: 6 m wide x 4.6 m deep, tiles horizontally.
export function soilFace() {
  if (cache.soil) return cache.soil;
  const w = 1536, h = 1178; const F = new Field(w, h); const r = rng(11);
  const depthM = 4.6, widthM = 6; const pxPerM = w / widthM;
  const L = { turf: hex('#2b2216'), top: hex('#45301f'), top2: hex('#382618'), sub: hex('#6c4b33'), sub2: hex('#5b3f2a'), clay: hex('#8a6243'), clay2: hex('#765238'), rock: hex('#6c635a'), rock2: hex('#575049') };
  const P = (x) => x * pxPerM; const per = w / pxPerM; // period in meters
  const B1 = new Float32Array(w), B2 = new Float32Array(w), B3 = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const xm = x / pxPerM; const wob = (s, a) => (fbm(xm * 0.9, s, 3, 5, per * 0.9, 0) - 0.5) * a;
    B1[x] = 0.38 + wob(1, 0.18); B2[x] = 1.45 + wob(2, 0.35); B3[x] = 2.45 + wob(3, 0.45);
  }
  for (let y = 0; y < h; y++) {
    const d = (y / h) * depthM;
    for (let x = 0; x < w; x++) {
      const xm = x / pxPerM;
      const b1 = B1[x], b2 = B2[x], b3 = B3[x];
      const n = fbm(xm * 9, d * 9, 5, 2, per * 9, 0);
      const n2 = fbm(xm * 40, d * 40, 3, 7, per * 40, 0);
      let c, hh = n * 0.5 + n2 * 0.35, ro = 0.92;
      if (d < b1) {
        c = mix3(L.top, L.top2, smooth(n * 1.4 - 0.2));
        if (d < 0.07) c = mix3(L.turf, c, d / 0.07);
      } else if (d < b2) {
        c = mix3(L.sub, L.sub2, smooth(n * 1.6 - 0.3));
        const tr = smooth((d - b1) / 0.12); c = mix3(mix3(L.top, L.sub, 0.5), c, tr);
      } else if (d < b3) {
        const streak = 0.5 + 0.5 * Math.sin(d * 38 + fbm(xm * 2, d * 2, 3, 9, per * 2, 0) * 9);
        c = mix3(L.clay, L.clay2, smooth(n * 1.2 - 0.1) * 0.7 + streak * 0.3);
        const tr = smooth((d - b2) / 0.1); c = mix3(mix3(L.sub, L.clay, 0.5), c, tr);
        hh += streak * 0.15; ro = 0.85;
      } else {
        c = mix3(L.rock, L.rock2, smooth(n * 1.5 - 0.25));
        const tr = smooth((d - b3) / 0.1); c = mix3(mix3(L.clay, L.rock, 0.5), c, tr);
      }
      // crumbs and sand specks
      const sp = vnoise(x * 0.9, y * 0.9, 3, w * 0.9, 0);
      const k = 0.82 + 0.3 * n2 + (sp > 0.93 ? 0.25 : 0) - (sp < 0.06 ? 0.22 : 0);
      const i = y * w + x;
      F.set(i, c[0] * k, c[1] * k, c[2] * k); F.hgt[i] = hh * 3; F.rough[i] = ro;
      // layer boundary ledges catch light
      const edge = Math.min(Math.abs(d - b1), Math.abs(d - b2), Math.abs(d - b3));
      if (edge < 0.012) F.hgt[i] += (0.012 - edge) * 60;
    }
  }
  const stoneCols = [hex('#857a6d'), hex('#74695d'), hex('#94867a'), hex('#5f574f'), hex('#9a8a74')];
  pebbles(F, 110, 3, 10, stoneCols, r, { yRange: [0.09, 0.32] });
  pebbles(F, 90, 6, 16, stoneCols, r, { yRange: [0.33, 0.55] });
  pebbles(F, 150, 8, 30, stoneCols, r, { yRange: [0.53, 1.0] });
  cache.soil = {
    map: F.colorTex({ repeat: [1, 1] }), normalMap: F.normalTex(1.6), roughnessMap: F.roughTex(),
    widthM, depthM,
  };
  return cache.soil;
}

// Loose dug soil (backfill, dirt pile, clods): tileable 512.
export function looseSoil() {
  if (cache.loose) return cache.loose;
  const s = 512; const F = new Field(s, s);
  const a = hex('#3e2717'), b = hex('#5a3a22'), c2 = hex('#2c1a0f');
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = fbm(x / 64, y / 64, 5, 21, 8, 8);
    const cl = vnoise(x / 9, y / 9, 22, s / 9, s / 9); // clods
    const cl2 = vnoise(x / 4, y / 4, 23, s / 4, s / 4);
    let c = mix3(a, b, smooth(n * 1.5 - 0.2));
    c = mix3(c, c2, smooth((0.35 - cl) * 4) * 0.7);
    const k = 0.85 + cl2 * 0.3; const i = y * s + x;
    F.set(i, c[0] * k, c[1] * k, c[2] * k); F.hgt[i] = cl * 2.2 + cl2 * 0.8 + n; F.rough[i] = 0.95;
  }
  cache.loose = { map: F.colorTex(), normalMap: F.normalTex(3), roughnessMap: F.roughTex() };
  return cache.loose;
}

// ---------------------------------------------------------------- ground top
// Big planar map over x in [-10,10], z in [-16,4] (20 m x 20 m).
export const GROUND = { x0: -10, x1: 10, z0: -16, z1: 4 };
export function groundTop(beds) {
  if (cache.ground) return cache.ground;
  const s = 2048; const F = new Field(s, s);
  const grassA = hex('#4a7f27'), grassB = hex('#62952f'), grassC = hex('#3d6a20'), dry = hex('#8d9a3c');
  const soilA = hex('#4b2f1c'), soilB = hex('#3a2314'), mulch = hex('#6b4a2e');
  const { x0, x1, z0, z1 } = GROUND;
  for (let py = 0; py < s; py++) {
    const z = z0 + (py / s) * (z1 - z0); // canvas top = z0 (far) ... uv mapped accordingly
    for (let px = 0; px < s; px++) {
      const x = x0 + (px / s) * (x1 - x0);
      const n = fbm(x * 0.6, z * 0.6, 4, 31), n2 = fbm(x * 5, z * 5, 3, 32), n3 = vnoise(x * 60, z * 60, 33);
      let c = mix3(grassA, grassB, smooth(n * 1.6 - 0.3));
      c = mix3(c, grassC, smooth(n2 * 1.8 - 0.7) * 0.6);
      c = mix3(c, dry, smooth((n - 0.62) * 6) * 0.35);
      let hh = n2 * 0.6 + n3 * 0.4, ro = 0.85;
      let bedW = 0;
      for (const b of beds) {
        if (x < b.x0 - 0.1 || x > b.x1 + 0.1 || z < b.z0 - 0.1 || z > b.z1 + 0.1) continue;
        const ex = Math.min(x - b.x0, b.x1 - x), ez = Math.min(z - b.z0, b.z1 - z);
        const e = Math.min(ex, ez) + (n2 - 0.5) * 0.06;
        bedW = Math.max(bedW, smooth(e / 0.05 + 0.5));
      }
      if (bedW > 0) {
        const furrow = 0.5 + 0.5 * Math.sin(z * 2 * Math.PI / 0.16 + n * 3);
        let sc = mix3(soilA, soilB, furrow * 0.6 + n2 * 0.4);
        const clod = vnoise(x * 28, z * 28, 34);
        sc = mix3(sc, mulch, smooth((clod - 0.7) * 5) * 0.4);
        const k = 0.85 + n3 * 0.3;
        c = mix3(c, [sc[0] * k, sc[1] * k, sc[2] * k], bedW);
        hh = lerp(hh, furrow * 0.8 + clod * 0.9, bedW); ro = lerp(ro, 0.97, bedW);
      }
      const i = py * s + px; F.set(i, c[0], c[1], c[2]); F.hgt[i] = hh; F.rough[i] = ro;
    }
  }
  // stepping stone path to the house door
  const r = rng(77);
  for (let k = 0; k < 9; k++) {
    const sx = -2.4 + Math.sin(k * 0.7) * 0.25, sz = -3.1 - k * 0.62;
    const cx = (sx - x0) / (x1 - x0) * s, cy = (sz - z0) / (z1 - z0) * s, rad = 22 + r() * 6;
    for (let y = cy - rad; y < cy + rad; y++) for (let x = cx - rad; x < cx + rad; x++) {
      const q = ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2) / (rad * rad); if (q > 1) continue;
      const i = Math.floor(y) * s + Math.floor(x); const v = 0.62 + 0.12 * vnoise(x * 0.3, y * 0.3, k);
      F.set(i, v * 1.02, v * 0.97, v * 0.9); F.hgt[i] = 1.5 * Math.sqrt(1 - q); F.rough[i] = 0.7;
    }
  }
  cache.ground = { map: F.colorTex({ wrap: false }), roughnessMap: F.roughTex({ wrap: false }) };
  return cache.ground;
}

// Tiled small detail normal for ground (grass/soil grain).
export function groundDetail() {
  if (cache.gdet) return cache.gdet;
  const s = 512; const F = new Field(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const i = y * s + x;
    F.hgt[i] = fbm(x / 32, y / 32, 4, 41, 16, 16) * 1.2 + vnoise(x / 3, y / 3, 42, s / 3, s / 3) * 0.6;
  }
  cache.gdet = { normalMap: F.normalTex(2.2) };
  return cache.gdet;
}

// ---------------------------------------------------------------- fabrics
export function burlap() {
  if (cache.burlap) return cache.burlap;
  const s = 512; const F = new Field(s, s); const base = hex('#b8975f'), dark = hex('#8a6a3e'), light = hex('#d1b47c');
  const N = 40; // threads per tile
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = (x / s) * N, v = (y / s) * N;
    const fu = u - Math.floor(u), fv = v - Math.floor(v);
    const over = (Math.floor(u) + Math.floor(v)) % 2 === 0;
    const tu = Math.sin(fu * Math.PI), tv = Math.sin(fv * Math.PI);
    const jitter = fbm(x / 20, y / 20, 3, 51, s / 20, s / 20);
    const hh = over ? tv * 0.8 + tu * 0.3 : tu * 0.8 + tv * 0.3;
    const gap = (1 - tu) * (1 - tv);
    let c = mix3(base, light, hh * 0.5 + jitter * 0.3);
    c = mix3(c, dark, smooth(gap * 2.2) * 0.8 + (1 - jitter) * 0.15);
    const fuzz = vnoise(x * 0.7, y * 0.7, 52, s * 0.7, s * 0.7);
    const k = 0.9 + fuzz * 0.2; const i = y * s + x;
    F.set(i, c[0] * k, c[1] * k, c[2] * k); F.hgt[i] = hh * 2 + fuzz * 0.3; F.rough[i] = 0.95;
  }
  cache.burlap = { map: F.colorTex(), normalMap: F.normalTex(2.5), roughnessMap: F.roughTex() };
  return cache.burlap;
}

export function plaid() {
  if (cache.plaid) return cache.plaid;
  const s = 512; const F = new Field(s, s);
  const red = hex('#c2352b'), dred = hex('#7d1d1b'), blk = hex('#2a1716'), cream = hex('#efd9a8');
  const band = (p) => { // pattern over 0..1
    const q = p % 1;
    if (q < 0.42) return 0; if (q < 0.5) return 1; if (q < 0.54) return 2; if (q < 0.62) return 1; if (q < 0.66) return 3; if (q < 0.92) return 0; return 1;
  };
  const cols = [red, dred, blk, cream];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s * 2, v = y / s * 2;
    const a = cols[band(u)], b = cols[band(v)];
    const tw = ((x + y) >> 1) % 4 < 2; // twill
    let c = mix3(a, b, tw ? 0.35 : 0.65);
    const sameDark = band(u) >= 1 && band(v) >= 1; if (sameDark) c = mix3(c, blk, 0.35);
    const fz = vnoise(x * 0.8, y * 0.8, 61, s * 0.8, s * 0.8), lo = fbm(x / 40, y / 40, 3, 62, s / 40, s / 40);
    const k = 0.88 + fz * 0.12 + (lo - 0.5) * 0.12; const i = y * s + x;
    F.set(i, c[0] * k, c[1] * k, c[2] * k);
    F.hgt[i] = (tw ? 0.6 : 0.3) + fz * 0.4 + Math.sin((x + y) * 0.8) * 0.2; F.rough[i] = 0.9;
  }
  cache.plaid = { map: F.colorTex(), normalMap: F.normalTex(1.5), roughnessMap: F.roughTex() };
  return cache.plaid;
}

export function stripes(c1 = '#25a18e', c2 = '#f4ead2', n = 7) {
  const key = 'stripes' + c1 + c2 + n; if (cache[key]) return cache[key];
  const s = 256; const F = new Field(s, s); const a = hex(c1), b = hex(c2);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = (y / s) * n; const f = v - Math.floor(v);
    const t = smooth((Math.abs(f - 0.5) - 0.22) * 40);
    const fz = vnoise(x * 0.9, y * 0.9, 71, s * 0.9, s * 0.9);
    const c = mix3(a, b, t); const k = 0.93 + fz * 0.1; const i = y * s + x;
    F.set(i, c[0] * k, c[1] * k, c[2] * k); F.hgt[i] = fz * 0.5 + Math.sin(x * 1.4) * 0.15; F.rough[i] = 0.88;
  }
  cache[key] = { map: F.colorTex(), normalMap: F.normalTex(1.2) };
  return cache[key];
}

export function denim() {
  if (cache.denim) return cache.denim;
  const s = 256; const F = new Field(s, s); const a = hex('#3e5f8f'), b = hex('#6f8fb8');
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const tw = ((x + y) % 4) < 2; const fz = vnoise(x * 0.5, y * 0.5, 81, s * 0.5, s * 0.5);
    const c = mix3(a, b, (tw ? 0.25 : 0.05) + fz * 0.3); const i = y * s + x;
    F.set(i, c[0], c[1], c[2]); F.hgt[i] = (tw ? 0.5 : 0) + fz * 0.4; F.rough[i] = 0.9;
  }
  cache.denim = { map: F.colorTex(), normalMap: F.normalTex(1.2) };
  return cache.denim;
}

// ---------------------------------------------------------------- straw
export function straw(weave = false) {
  const key = weave ? 'strawW' : 'straw'; if (cache[key]) return cache[key];
  const s = 512; const F = new Field(s, s); const r = rng(weave ? 92 : 91);
  const gold = hex('#e2b85a'), pale = hex('#f1d993'), dark = hex('#a77a2e');
  for (let i = 0; i < s * s; i++) { F.set(i, dark[0], dark[1], dark[2]); F.hgt[i] = 0; F.rough[i] = 0.85; }
  if (weave) {
    const N = 16;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const u = x / s * N, v = y / s * N; const fu = u % 1, fv = v % 1;
      const over = (Math.floor(u) + Math.floor(v)) % 2 === 0;
      const prof = over ? Math.sin(fv * Math.PI) : Math.sin(fu * Math.PI);
      const along = over ? fu : fv;
      const fib = vnoise(over ? x * 0.1 : x * 1.5, over ? y * 1.5 : y * 0.1, 93, 0, 0);
      let c = mix3(gold, pale, prof * 0.6 + fib * 0.4);
      c = mix3(c, dark, smooth((0.25 - prof) * 4) + Math.abs(along - 0.5) * 0.2);
      const i = y * s + x; F.set(i, c[0], c[1], c[2]); F.hgt[i] = prof * 2 + fib * 0.3; F.rough[i] = 0.75;
    }
  } else {
    // many strands mostly along v
    for (let k = 0; k < 900; k++) {
      const x0 = r() * s, ang = (r() - 0.5) * 0.25, len = 60 + r() * 200, wdt = 1.5 + r() * 2.5, y0 = r() * s;
      const col = mix3(mix3(gold, pale, r()), dark, r() * 0.35);
      for (let t = 0; t < len; t += 0.7) {
        const cx = x0 + Math.sin(ang) * t, cy = y0 + Math.cos(ang) * t;
        for (let dx = -wdt; dx <= wdt; dx++) {
          const xx = ((Math.round(cx + dx) % s) + s) % s, yy = ((Math.round(cy) % s) + s) % s;
          const prof = 1 - Math.abs(dx) / (wdt + 0.5); const i = yy * s + xx;
          const hh = 1 + prof + k * 0.0006;
          if (hh > F.hgt[i]) { F.hgt[i] = hh; F.set(i, col[0] * (0.75 + 0.35 * prof), col[1] * (0.75 + 0.35 * prof), col[2] * (0.75 + 0.35 * prof)); F.rough[i] = 0.6 + (1 - prof) * 0.3; }
        }
      }
    }
  }
  cache[key] = { map: F.colorTex(), normalMap: F.normalTex(weave ? 2 : 1.4), roughnessMap: F.roughTex() };
  return cache[key];
}

// ---------------------------------------------------------------- wood
export function wood(tone = 'warm') {
  const key = 'wood' + tone; if (cache[key]) return cache[key];
  const s = 512; const F = new Field(s, s);
  const pal = tone === 'warm' ? [hex('#8a5a32'), hex('#b07b47'), hex('#5e3a1e')] : [hex('#9a8670'), hex('#b8a68c'), hex('#6e5e4c')];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const warp = fbm(x / 60, y / 260, 3, 101, s / 60, s / 260) * 6;
    const g = Math.sin((x / s) * Math.PI * 2 * 9 + warp * 2.5);
    const fine = vnoise(x * 1.2, y * 0.05, 102, s * 1.2, s * 0.05);
    const ring = smooth(g * 0.5 + 0.5);
    let c = mix3(pal[0], pal[1], ring * 0.6 + fine * 0.3);
    c = mix3(c, pal[2], smooth((0.15 - fine) * 5) * 0.5);
    const i = y * s + x; F.set(i, c[0], c[1], c[2]); F.hgt[i] = ring * 0.6 + fine * 0.8; F.rough[i] = 0.72 + fine * 0.15;
  }
  cache[key] = { map: F.colorTex(), normalMap: F.normalTex(1.5), roughnessMap: F.roughTex() };
  return cache[key];
}

export function bark() {
  if (cache.bark) return cache.bark;
  const s = 512; const F = new Field(s, s); const a = hex('#5a4030'), b = hex('#7d5e46'), d = hex('#2e2118');
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = fbm(x / 18, y / 90, 4, 111, s / 18, s / 90);
    const crack = smooth((0.42 - n) * 8);
    const c = mix3(mix3(a, b, n), d, crack); const i = y * s + x;
    F.set(i, c[0], c[1], c[2]); F.hgt[i] = n * 2 - crack; F.rough[i] = 0.95;
  }
  cache.bark = { map: F.colorTex(), normalMap: F.normalTex(3) };
  return cache.bark;
}

// ---------------------------------------------------------------- house
export function siding() {
  if (cache.siding) return cache.siding;
  const s = 512; const F = new Field(s, s); const a = hex('#e9d9b8'), b = hex('#d8c39c');
  const boards = 8;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = (y / s) * boards; const f = v % 1;
    const lip = f < 0.08 ? f / 0.08 : 1; const slope = 1 - f * 0.35;
    const g = fbm(x / 120, y / 6, 3, 121, s / 120, s / 6);
    let c = mix3(a, b, g * 0.6); c = mix3(c, mix3(b, hex('#9c8a6c'), 0.5), (1 - lip) * 0.8);
    const i = y * s + x; F.set(i, c[0], c[1], c[2]); F.hgt[i] = slope * lip * 2 + g * 0.1; F.rough[i] = 0.8;
  }
  cache.siding = { map: F.colorTex(), normalMap: F.normalTex(3) };
  return cache.siding;
}

export function shingles() {
  if (cache.shingles) return cache.shingles;
  const s = 512; const F = new Field(s, s); const r = rng(131);
  const pal = [hex('#5b4a44'), hex('#6e5850'), hex('#4c3d39'), hex('#7a6359')];
  const rows = 10, cols = 8; const tint = [];
  for (let k = 0; k < rows * cols * 2; k++) tint.push(pal[Math.floor(r() * pal.length)]);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = (y / s) * rows; const row = Math.floor(v); const f = v % 1;
    const u = (x / s) * cols + (row % 2) * 0.5; const col = Math.floor(u); const fu = u % 1;
    const t = tint[(row * cols + ((col % cols) + cols) % cols) % tint.length];
    const n = fbm(x / 10, y / 10, 3, 132, s / 10, s / 10);
    let c = mix3(t, hex('#2e2421'), smooth((fu < 0.04 || fu > 0.96) ? 1 : 0) * 0.7 + (1 - f) * 0.25);
    c = mix3(c, hex('#8d7a6c'), n * 0.25);
    const i = y * s + x; F.set(i, c[0], c[1], c[2]); F.hgt[i] = (f) * 2 - ((fu < 0.04 || fu > 0.96) ? 0.6 : 0) + n * 0.3; F.rough[i] = 0.85;
  }
  cache.shingles = { map: F.colorTex(), normalMap: F.normalTex(2.5) };
  return cache.shingles;
}

// ---------------------------------------------------------------- foliage
export function leafy(c1 = '#4f8a2c', c2 = '#86b84a', seed = 141) {
  const key = 'leafy' + c1 + c2; if (cache[key]) return cache[key];
  const s = 512; const F = new Field(s, s); const r = rng(seed);
  const a = hex(c1), b = hex(c2), d = hex('#23401a');
  for (let i = 0; i < s * s; i++) { F.set(i, d[0], d[1], d[2]); F.hgt[i] = 0; F.rough[i] = 0.7; }
  for (let k = 0; k < 1400; k++) { // overlapping leaf ellipses
    const cx = r() * s, cy = r() * s, L = 10 + r() * 14, Wd = L * (0.45 + r() * 0.2), ang = r() * Math.PI * 2;
    const col = mix3(a, b, r()); const cs = Math.cos(ang), sn = Math.sin(ang); const zz = k / 1400;
    for (let y = -L; y <= L; y++) for (let x = -L; x <= L; x++) {
      const u = (x * cs + y * sn) / L, v = (-x * sn + y * cs) / Wd; const q = u * u + v * v; if (q > 1) continue;
      const xx = ((Math.round(cx + x) % s) + s) % s, yy = ((Math.round(cy + y) % s) + s) % s; const i = yy * s + xx;
      const hh = 1 + zz + Math.sqrt(1 - q) * 0.6; if (hh < F.hgt[i]) continue;
      const vein = Math.abs(v) < 0.08 ? 0.12 : 0; const lit = 0.75 + 0.3 * (1 - q) - 0.15 * u;
      F.set(i, (col[0] + vein) * lit, (col[1] + vein) * lit, (col[2] + vein * 0.5) * lit); F.hgt[i] = hh; F.rough[i] = 0.55 + q * 0.2;
    }
  }
  cache[key] = { map: F.colorTex(), normalMap: F.normalTex(2), roughnessMap: F.roughTex() };
  return cache[key];
}

export function leafVein(c1 = '#3f7f2a', c2 = '#7cb247') {
  const key = 'vein' + c1 + c2; if (cache[key]) return cache[key];
  const s = 256; const F = new Field(s, s); const a = hex(c1), b = hex(c2);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s - 0.5, v = y / s;
    const mid = Math.exp(-Math.pow(u / 0.012, 2));
    const side = Math.exp(-Math.pow(((Math.abs(u) * 1.6 + (1 - v)) * 9) % 1 - 0.5, 2) / 0.004) * smooth(Math.abs(u) * 6) * 0.6;
    const n = fbm(x / 20, y / 20, 3, 151, s / 20, s / 20);
    const c = mix3(a, b, 0.4 + n * 0.4 + mid * 0.4 + side * 0.25); const i = y * s + x;
    F.set(i, c[0], c[1], c[2]); F.hgt[i] = -mid * 1.5 - side * 0.8 + n * 0.3; F.rough[i] = 0.5;
  }
  cache[key] = { map: F.colorTex({ wrap: false }), normalMap: F.normalTex(2, { wrap: false }) };
  return cache[key];
}

// ---------------------------------------------------------------- feathers
export function feathers() {
  if (cache.feathers) return cache.feathers;
  const s = 512; const F = new Field(s, s); const a = hex('#1d1e26'), b = hex('#2b2d3a');
  const rows = 14, cols = 10;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = (y / s) * rows; const row = Math.floor(v); const fv = v % 1;
    const u = (x / s) * cols + (row % 2) * 0.5; const fu = u % 1;
    const dx = (fu - 0.5) * 2, dy = fv; // scallop: round bottom edge
    const edge = Math.sqrt(dx * dx * 0.8 + dy * dy);
    const sc = clamp(1 - edge);
    const barb = 0.5 + 0.5 * Math.sin((dx * 18) + dy * 6);
    const c = mix3(a, b, sc * 0.6 + barb * 0.15); const i = y * s + x;
    F.set(i, c[0], c[1], c[2]); F.hgt[i] = sc * 1.6 + barb * 0.12; F.rough[i] = 0.35 + (1 - sc) * 0.25;
  }
  cache.feathers = { map: F.colorTex(), normalMap: F.normalTex(1.6), roughnessMap: F.roughTex() };
  return cache.feathers;
}

export function brushedMetal() {
  if (cache.metal) return cache.metal;
  const s = 256; const F = new Field(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = vnoise(x * 0.04, y * 3, 161, s * 0.04, s * 3); const i = y * s + x;
    F.set(i, 0.8, 0.8, 0.82); F.hgt[i] = n * 0.4; F.rough[i] = 0.28 + n * 0.18;
  }
  cache.metal = { normalMap: F.normalTex(1), roughnessMap: F.roughTex() };
  return cache.metal;
}

// ---------------------------------------------------------------- text
export function textCanvas(w, h, draw) { const c = canvas(w, h); draw(c.getContext('2d'), w, h); return c; }
export function canvasTexture(c, srgb = true) { return toTexture(c, { srgb, wrap: false }); }
