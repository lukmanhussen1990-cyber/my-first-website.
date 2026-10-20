// Procedural textures generated in code (no image files). Each generator fills
// typed arrays, so maps are crisp, tileable and mip-mapped.
import * as THREE from 'three';
import { makeNoise2, rng, smoothstep, clamp, lerp } from './util.js';

let ANISO = 8;
export function setAniso(a) { ANISO = a; }

function finishTex(tex, { srgb = false, repeat = true } = {}) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = ANISO;
  tex.needsUpdate = true;
  return tex;
}
function data(w, h, arr, o) { return finishTex(new THREE.DataTexture(arr, w, h, THREE.RGBAFormat, THREE.UnsignedByteType), o); }

// height field -> tangent-space normal map (tileable)
function normalFromHeight(hf, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w, yu = (y - 1 + h) % h, yd = (y + 1) % h;
      const dx = (hf[y * w + xr] - hf[y * w + xl]) * strength;
      const dy = (hf[yd * w + x] - hf[yu * w + x]) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
    }
  }
  return out;
}
const b = (v) => clamp(Math.round(v * 255), 0, 255);

// ---------------- asphalt: 1 tile = 8 m ----------------
export function asphaltMaps(size = 1024) {
  const N = makeNoise2(7);
  const col = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4), hf = new Float32Array(size * size);
  const R = rng(99);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const big = N.fbm(u * 3, v * 3, 3, 3, 3);
      const agg = N.noise(u * 160, v * 160, 160, 160);
      const agg2 = N.noise(u * 380 + 5.3, v * 380 + 1.7, 380, 380);
      const chips = smoothstep(0.30, 0.62, agg2) * 0.9 + smoothstep(0.45, 0.8, agg) * 0.5;
      const pits = smoothstep(0.35, 0.7, -agg2);
      const crackN = Math.abs(N.fbm(u * 5 + 3, v * 5 + 9, 3, 5, 5));
      const crackMask = smoothstep(0.25, 0.45, N.noise(u * 2 + 11, v * 2 + 4, 2, 2));
      const crack = (1 - smoothstep(0.0, 0.012, crackN)) * crackMask;
      let g = 0.165 + 0.045 * big + 0.075 * chips - 0.05 * pits;
      g = g * (1 - 0.75 * crack);
      const i = (y * size + x) * 4;
      col[i] = b(g * 1.02); col[i + 1] = b(g * 1.0); col[i + 2] = b(g * 1.0 + 0.008); col[i + 3] = 255;
      const rough = clamp(0.88 - 0.12 * chips + 0.06 * crack, 0, 1);
      orm[i] = 255; orm[i + 1] = b(rough); orm[i + 2] = 0; orm[i + 3] = 255;
      hf[y * size + x] = 0.6 * chips - 0.4 * pits - 1.2 * crack + 0.2 * agg;
    }
  }
  void R;
  return { map: data(size, size, col, { srgb: true }), orm: data(size, size, orm), normal: data(size, size, normalFromHeight(hf, size, size, 2.2)) };
}

// ---------------- concrete pavers: 1 tile = 4.8 m, 8x8 pavers of 0.6 m ----------------
export function paverMaps(size = 1024, tint = [0.62, 0.60, 0.56]) {
  const N = makeNoise2(3);
  const col = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4), hf = new Float32Array(size * size);
  const n = 8, cell = size / n;
  const R = rng(5);
  const tones = Array.from({ length: n * n }, () => 0.9 + R() * 0.2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const fx = (x % cell) / cell, fy = (y % cell) / cell;
      const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
      const grout = 1 - smoothstep(0.008, 0.022, edge);
      const bevel = smoothstep(0.0, 0.05, edge);
      const u = x / size, v = y / size;
      const nn = N.fbm(u * 24, v * 24, 4, 24, 24);
      const fine = N.noise(u * 300, v * 300, 300, 300);
      const tone = tones[cy * n + cx] * (0.94 + 0.08 * nn + 0.03 * fine);
      const i = (y * size + x) * 4;
      const gm = lerp(1, 0.45, grout);
      col[i] = b(tint[0] * tone * gm); col[i + 1] = b(tint[1] * tone * gm); col[i + 2] = b(tint[2] * tone * gm); col[i + 3] = 255;
      orm[i] = b(1 - 0.35 * grout); orm[i + 1] = b(0.78 + 0.1 * fine); orm[i + 2] = 0; orm[i + 3] = 255;
      hf[y * size + x] = bevel * 0.8 - grout * 0.6 + fine * 0.05;
    }
  }
  return { map: data(size, size, col, { srgb: true }), orm: data(size, size, orm), normal: data(size, size, normalFromHeight(hf, size, size, 3)) };
}

// ---------------- glass curtain wall: tile = 8 panes x 8 floors ----------------
// returns maps + world size of one tile (meters)
export function curtainWallMaps(seed, opts = {}) {
  const size = 1024, panes = 8, floors = 8;
  const PW = size / panes, FH = size / floors;
  const R = rng(seed);
  const N = makeNoise2(seed + 1);
  const col = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4), emi = new Uint8Array(size * size * 4);
  const hf = new Float32Array(size * size);
  const glass = opts.glass || [0.42, 0.44, 0.46];
  const frame = opts.frame || [0.55, 0.57, 0.6];
  const spandrel = opts.spandrel || [0.08, 0.1, 0.12];
  const litProb = opts.lit ?? 0.16;
  const paneInfo = [];
  for (let f = 0; f < floors; f++) for (let p = 0; p < panes; p++) {
    const lit = R() < litProb;
    paneInfo.push({
      tilt: [(R() - 0.5) * 0.9, (R() - 0.5) * 0.9], tone: 0.85 + R() * 0.3, rough: 0.04 + R() * 0.07,
      lit, litI: lit ? 0.45 + R() * 0.55 : 0, litWarm: R(), blind: R() < 0.35 ? R() * 0.6 : 0,
    });
  }
  const mullW = opts.mullion ?? 3, spH = opts.spandrelH ?? 0.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = Math.floor(x / PW), f = Math.floor(y / FH);
      const fx = (x % PW), fy = (y % FH) / FH;
      const info = paneInfo[f * panes + p];
      const i = (y * size + x) * 4;
      const isMull = fx < mullW || fx >= PW - mullW;
      const isSp = fy < spH;
      const isTransom = Math.abs(fy - spH) * FH < 2 || fy * FH < 2;
      const u = x / size, v = y / size;
      const nn = N.noise(u * 40, v * 40, 40, 40);
      let r, g, bb, rough, metal, e = 0, er = 0, eg = 0, eb = 0, h = 0;
      if (isMull || isTransom) {
        r = frame[0]; g = frame[1]; bb = frame[2]; rough = 0.38; metal = 1.0; h = 1;
      } else if (isSp) {
        r = spandrel[0]; g = spandrel[1]; bb = spandrel[2]; rough = 0.3; metal = 0.6; h = 0.3;
      } else {
        const t = info.tone * (0.97 + 0.03 * nn);
        r = glass[0] * t; g = glass[1] * t; bb = glass[2] * t; rough = info.rough; metal = 0.85;
        const fyy = (fy - spH) / (1 - spH); // 0 bottom .. 1 top of glass area
        if (info.blind > 0 && fyy > 1 - info.blind) { r += 0.12; g += 0.11; bb += 0.1; metal = 0.6; rough += 0.05; }
        if (info.lit) {
          const w = info.litWarm;
          const vign = Math.sin(Math.PI * Math.min(1, (fx / PW))) * 0.4 + 0.6;
          e = info.litI * vign * (fyy < 1 - info.blind ? 1 : 0.4);
          er = 1.0; eg = 0.72 + 0.12 * w; eb = 0.42 + 0.2 * w;
        }
        h = 0;
      }
      col[i] = b(r); col[i + 1] = b(g); col[i + 2] = b(bb); col[i + 3] = 255;
      orm[i] = 255; orm[i + 1] = b(rough); orm[i + 2] = b(metal); orm[i + 3] = 255;
      emi[i] = b(e * er); emi[i + 1] = b(e * eg); emi[i + 2] = b(e * eb); emi[i + 3] = 255;
      // per-pane tilt gives the mosaic reflection look
      hf[y * size + x] = h * 0.6 + (isMull || isSp ? 0 : (info.tilt[0] * (fx / PW) + info.tilt[1] * fy));
    }
  }
  const tw = opts.paneW ?? 1.6, th = opts.floorH ?? 3.6;
  return {
    map: data(size, size, col, { srgb: true }), orm: data(size, size, orm), emissive: data(size, size, emi, { srgb: true }),
    normal: data(size, size, normalFromHeight(hf, size, size, 1.1)), tileW: tw * panes, tileH: th * floors,
  };
}

// ---------------- punched-window stone / concrete facade ----------------
export function punchedFacadeMaps(seed, opts = {}) {
  const size = 1024, cols = 6, floors = 6;
  const CW = size / cols, FH = size / floors;
  const R = rng(seed);
  const N = makeNoise2(seed + 9);
  const wall = opts.wall || [0.74, 0.62, 0.50];
  const col = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4), emi = new Uint8Array(size * size * 4);
  const hf = new Float32Array(size * size);
  const lit = Array.from({ length: cols * floors }, () => (R() < (opts.lit ?? 0.22) ? 0.5 + R() * 0.5 : 0));
  const tone = Array.from({ length: cols * floors }, () => 0.85 + R() * 0.3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = Math.floor(x / CW), f = Math.floor(y / FH);
      const fx = (x % CW) / CW, fy = (y % FH) / FH;
      const u = x / size, v = y / size;
      const nn = N.fbm(u * 16, v * 16, 4, 16, 16);
      const inWin = fx > 0.2 && fx < 0.8 && fy > 0.3 && fy < 0.86;
      const sill = fx > 0.17 && fx < 0.83 && fy > 0.26 && fy < 0.3;
      const reveal = fx > 0.18 && fx < 0.82 && fy > 0.28 && fy < 0.88 && !inWin;
      const i = (y * size + x) * 4;
      let r, g, bb, rough, metal, h, e = 0;
      if (inWin) {
        const t = tone[f * cols + c];
        const mull = Math.abs(fx - 0.5) < 0.012 || Math.abs(fy - 0.62) < 0.01;
        if (mull) { r = 0.82; g = 0.8; bb = 0.76; rough = 0.5; metal = 0.0; h = 0.2; }
        else { r = 0.07 * t; g = 0.09 * t; bb = 0.11 * t; rough = 0.06; metal = 0.75; h = -0.6; e = lit[f * cols + c]; }
      } else if (sill) { r = wall[0] * 1.15; g = wall[1] * 1.15; bb = wall[2] * 1.15; rough = 0.7; metal = 0; h = 0.6; }
      else if (reveal) { r = wall[0] * 0.55; g = wall[1] * 0.55; bb = wall[2] * 0.55; rough = 0.85; metal = 0; h = -0.4; }
      else {
        const band = fy < 0.06 ? 0.9 : 1.0;
        const k = band * (0.92 + 0.12 * nn);
        r = wall[0] * k; g = wall[1] * k; bb = wall[2] * k; rough = 0.85; metal = 0; h = 0.05 * nn;
      }
      col[i] = b(r); col[i + 1] = b(g); col[i + 2] = b(bb); col[i + 3] = 255;
      orm[i] = b(inWin || reveal ? 0.8 : 1); orm[i + 1] = b(rough); orm[i + 2] = b(metal); orm[i + 3] = 255;
      emi[i] = b(e); emi[i + 1] = b(e * 0.74); emi[i + 2] = b(e * 0.45); emi[i + 3] = 255;
      hf[y * size + x] = h;
    }
  }
  return {
    map: data(size, size, col, { srgb: true }), orm: data(size, size, orm), emissive: data(size, size, emi, { srgb: true }),
    normal: data(size, size, normalFromHeight(hf, size, size, 2.0)), tileW: (opts.colW ?? 2.6) * cols, tileH: (opts.floorH ?? 3.4) * floors,
  };
}

// ---------------- storefront band (ground floor): tile = 16 m x 5 m ----------------
export function storefrontMaps(seed) {
  const w = 1024, h = 320;
  const R = rng(seed);
  const col = new Uint8Array(w * h * 4), orm = new Uint8Array(w * h * 4), emi = new Uint8Array(w * h * 4), hf = new Float32Array(w * h);
  const shops = 4, SW = w / shops;
  const palette = [[0.85, 0.28, 0.22], [0.15, 0.45, 0.62], [0.95, 0.70, 0.18], [0.22, 0.55, 0.35], [0.55, 0.30, 0.6], [0.9, 0.45, 0.2]];
  const info = Array.from({ length: shops }, () => ({ c: palette[Math.floor(R() * palette.length)], warm: R(), door: 0.15 + R() * 0.6 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = Math.floor(x / SW), fx = (x % SW) / SW, fy = y / h; // fy 0 = bottom (DataTexture row 0 is v=0)
      const I = info[s];
      const i = (y * w + x) * 4;
      let r, g, bb, rough = 0.6, metal = 0, e = 0, er = 1, eg = 0.75, eb = 0.5, hh = 0;
      const pier = fx < 0.04 || fx > 0.96;
      if (pier) { r = 0.32; g = 0.30; bb = 0.29; rough = 0.8; hh = 0.5; }
      else if (fy > 0.78) { // sign band
        const inner = fy > 0.82 && fy < 0.95 && fx > 0.12 && fx < 0.88;
        r = I.c[0] * (inner ? 1.0 : 0.55); g = I.c[1] * (inner ? 1.0 : 0.55); bb = I.c[2] * (inner ? 1.0 : 0.55); rough = 0.5;
        if (inner) { e = 0.25; er = I.c[0]; eg = I.c[1]; eb = I.c[2]; }
        hh = 0.3;
      } else if (fy < 0.05) { r = 0.25; g = 0.24; bb = 0.23; rough = 0.8; hh = 0.4; }
      else {
        const isDoor = Math.abs(fx - I.door) < 0.07 && fy < 0.7;
        const frameLine = Math.abs(fx - I.door) < 0.075 && Math.abs(fx - I.door) > 0.065 && fy < 0.7 || Math.abs(fy - 0.7) < 0.008 || fy < 0.065;
        if (frameLine) { r = 0.12; g = 0.12; bb = 0.13; rough = 0.4; metal = 1; hh = 0.4; }
        else {
          r = 0.1; g = 0.1; bb = 0.11; rough = 0.05; metal = 0.6;
          const gl = 0.55 + 0.45 * Math.sin(fx * 9.0 + s) * Math.sin(fy * 5.0);
          e = (isDoor ? 0.7 : 0.9) * (0.6 + 0.4 * gl);
          er = 1.0; eg = 0.72 + 0.15 * I.warm; eb = 0.45 + 0.2 * I.warm;
          // shelves / silhouettes
          if (!isDoor && (Math.abs(fy - 0.3) < 0.01 || Math.abs(fy - 0.5) < 0.01)) e *= 0.4;
          hh = -0.5;
        }
      }
      col[i] = b(r); col[i + 1] = b(g); col[i + 2] = b(bb); col[i + 3] = 255;
      orm[i] = 255; orm[i + 1] = b(rough); orm[i + 2] = b(metal); orm[i + 3] = 255;
      emi[i] = b(e * er); emi[i + 1] = b(e * eg); emi[i + 2] = b(e * eb); emi[i + 3] = 255;
      hf[y * w + x] = hh;
    }
  }
  return { map: data(w, h, col, { srgb: true }), orm: data(w, h, orm), emissive: data(w, h, emi, { srgb: true }), normal: data(w, h, normalFromHeight(hf, w, h, 2)), tileW: 16, tileH: 5 };
}

// ---------------- roof (gravel / membrane) : tile = 6 m ----------------
export function roofMaps(size = 512) {
  const N = makeNoise2(31);
  const col = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = N.fbm(u * 8, v * 8, 4, 8, 8), f = N.noise(u * 200, v * 200, 200, 200);
    const g = 0.42 + 0.06 * n + 0.05 * f;
    const i = (y * size + x) * 4;
    col[i] = b(g * 1.02); col[i + 1] = b(g); col[i + 2] = b(g * 0.96); col[i + 3] = 255;
    orm[i] = 255; orm[i + 1] = b(0.9); orm[i + 2] = 0; orm[i + 3] = 255;
  }
  return { map: data(size, size, col, { srgb: true }), orm: data(size, size, orm) };
}

// ---------------- cake-slice soil cut face ----------------
// u: 0..1 = 32 m along the street (tileable), v: 0..1 = depth 0..40 m (v=1 at top / ground)
export const SOIL = { tileW: 32, depth: 40 };
export function soilMaps() {
  const w = 2048, h = 2048;
  const N = makeNoise2(77);
  const R = rng(1234);
  const col = new Uint8Array(w * h * 4), orm = new Uint8Array(w * h * 4), hf = new Float32Array(w * h);
  // layer boundaries in meters below ground, with colours (sRGB-ish linearised later by texture colorSpace)
  const layers = [
    { d: 0.0, c: [0.33, 0.32, 0.31], rough: 0.9 },   // concrete / asphalt base
    { d: 0.32, c: [0.62, 0.60, 0.56], rough: 0.95 }, // compacted gravel
    { d: 0.95, c: [0.86, 0.73, 0.52], rough: 0.95 }, // sand
    { d: 2.1, c: [0.55, 0.36, 0.22], rough: 0.95 },  // topsoil
    { d: 5.6, c: [0.66, 0.40, 0.25], rough: 0.95 },  // clay (terracotta)
    { d: 10.5, c: [0.47, 0.30, 0.22], rough: 0.95 }, // dark loam
    { d: 16.5, c: [0.56, 0.50, 0.44], rough: 0.9 },  // weathered rock
    { d: 24.0, c: [0.42, 0.41, 0.44], rough: 0.85 }, // bedrock
  ];
  const mPerPxX = SOIL.tileW / w, mPerPxY = SOIL.depth / h;
  // pebbles: scatter discs per layer
  const pebbleMap = new Float32Array(w * h); // height of pebbles
  const pebbleCol = new Float32Array(w * h);
  const nPeb = 9000;
  for (let k = 0; k < nPeb; k++) {
    const depth = Math.pow(R(), 0.8) * SOIL.depth;
    let li = 0; for (let j = 0; j < layers.length; j++) if (depth >= layers[j].d) li = j;
    if (li === 0 || li === 2) { if (R() < 0.7) continue; }
    const sizeM = li === 1 ? 0.03 + R() * 0.06 : li >= 6 ? 0.08 + R() * 0.45 : 0.04 + R() * 0.16;
    const cx = R() * w, cy = h - depth / mPerPxY;
    const rx = sizeM / mPerPxX, ry = (sizeM * (0.6 + R() * 0.4)) / mPerPxY;
    const tone = 0.55 + R() * 0.6;
    for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
      if (yy < 0 || yy >= h) continue;
      for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const X = ((xx % w) + w) % w;
        const hh = Math.sqrt(1 - d2);
        const idx = yy * w + X;
        if (hh > pebbleMap[idx]) { pebbleMap[idx] = hh; pebbleCol[idx] = tone * (0.85 + 0.25 * (-dx - dy) * 0.5); }
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const dep = (h - 1 - y) * mPerPxY;   // row 0 = v 0 = bottom (deepest); top row = ground
      const wob = N.fbm(u * 6, dep * 0.08, 3, 6, 64) * 0.55 + N.noise(u * 40, dep * 0.3, 40, 256) * 0.08;
      const dd = dep + wob * (dep < 1 ? 0.08 : 1.0);
      let li = 0; for (let j = 0; j < layers.length; j++) if (dd >= layers[j].d) li = j;
      const L = layers[li];
      const nxt = layers[Math.min(li + 1, layers.length - 1)];
      const edge = li + 1 < layers.length ? smoothstep(nxt.d - 0.12, nxt.d, dd) : 0;
      const grain = N.noise(u * 900, dep * 22, 900, 1024) * 0.5 + N.noise(u * 300, dep * 8, 300, 512) * 0.5;
      const streak = N.noise(u * 3, dep * 3.0, 3, 128);
      let k = 0.9 + 0.12 * grain + 0.07 * streak - 0.12 * edge;
      let c = L.c.map((cc) => cc * k);
      // wet darker band near layer boundaries
      const i = (y * w + x) * 4;
      const p = pebbleMap[y * w + x];
      let hh = grain * 0.12 + streak * 0.05;
      if (p > 0) {
        const pt = pebbleCol[y * w + x];
        const base = li >= 6 ? [0.55, 0.54, 0.56] : li === 1 ? [0.7, 0.69, 0.66] : [0.62, 0.57, 0.5];
        c = base.map((cc) => cc * pt);
        hh = 0.4 + p * 1.2;
      }
      // fine cracks in bedrock
      if (li >= 6) { const cr = 1 - smoothstep(0.0, 0.015, Math.abs(N.fbm(u * 10 + 4, dep * 0.4, 3, 10, 64))); c = c.map((cc) => cc * (1 - 0.5 * cr)); hh -= cr * 0.5; }
      col[i] = b(c[0]); col[i + 1] = b(c[1]); col[i + 2] = b(c[2]); col[i + 3] = 255;
      orm[i] = b(p > 0 ? 1 : 0.92); orm[i + 1] = b(L.rough - (p > 0 ? 0.25 : 0)); orm[i + 2] = 0; orm[i + 3] = 255;
      hf[y * w + x] = hh;
    }
  }
  return { map: data(w, h, col, { srgb: true }), orm: data(w, h, orm), normal: data(w, h, normalFromHeight(hf, w, h, 3.0)) };
}

// ---------------- canvas helpers ----------------
export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  return finishTex(t, { srgb, repeat });
}

// Roadster aero wheel face (matches reference: silver disc, six black blades, dark hub)
export function wheelFaceTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, R0 = w / 2;
    ctx.fillStyle = '#16171a'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, R0 * 0.95);
    g.addColorStop(0, '#f2f3f4'); g.addColorStop(0.7, '#d9dbdd'); g.addColorStop(1, '#b9bcc0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.93, 0, Math.PI * 2); ctx.fill();
    // six slightly swept black blades
    ctx.fillStyle = '#121316';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-9, 40); ctx.quadraticCurveTo(-6, 140, 10, R0 * 0.9); ctx.lineTo(26, R0 * 0.9); ctx.quadraticCurveTo(16, 140, 11, 40); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // inner ring + hub
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1b1c20'; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3d44'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
  });
}

// generic soft round sprite (glow / smoke base)
export function softDotTex(size = 128, hardness = 0.0) {
  return canvasTex(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(Math.max(0.01, hardness), 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  }, { srgb: false });
}

export function smokeTex(seed = 5, size = 256) {
  const N = makeNoise2(seed);
  const arr = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size - 0.5, v = y / size - 0.5;
    const r = Math.sqrt(u * u + v * v) * 2;
    const n = N.fbm(x / size * 5, y / size * 5, 4, 5, 5);
    const a = clamp((1 - smoothstep(0.35, 1.0, r + n * 0.35)) * (0.75 + 0.4 * n), 0, 1);
    const sh = clamp(0.75 + 0.35 * (-u - v) + 0.2 * n, 0, 1); // baked light from top-left
    const i = (y * size + x) * 4;
    arr[i] = b(sh); arr[i + 1] = b(sh); arr[i + 2] = b(sh); arr[i + 3] = b(a);
  }
  return finishTex(new THREE.DataTexture(arr, size, size, THREE.RGBAFormat, THREE.UnsignedByteType), { srgb: false, repeat: false });
}

export function textTex(text, { w = 1024, h = 256, font = 'bold 150px sans-serif', fill = '#fff', stroke = null, strokeW = 0, bg = null, glow = 0 } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = fill; ctx.shadowBlur = glow; }
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.strokeText(text, w / 2, h / 2 + 6); }
    ctx.fillStyle = fill; ctx.fillText(text, w / 2, h / 2 + 6);
  });
}

// soft rounded-rectangle contact shadow
export function contactShadowTex() {
  return canvasTex(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(14px)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    const r = 30, x0 = 30, y0 = 26, x1 = w - 30, y1 = h - 26;
    ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r); ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
    ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r); ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0); ctx.fill();
  }, { srgb: false });
}
