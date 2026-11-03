// Pixel textures + material palette for set.js only. Every texture is a small canvas (NearestFilter) => PS1 look.
import * as THREE from 'three';
import { rng, noise2, paint, tex, mat, hexToRgb, canvas, clamp } from './lib.js';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = hexToRgb;

// ---------------------------------------------------------------- canvases
export function planksCanvas() {
  const W = 128, H = 128, rows = 8, ph = H / rows, R = rng(41), n = noise2(W, H, 6, 5), g = noise2(W, H, 2, 9);
  const tones = ['#9a6a41', '#a8774a', '#8d5f3a', '#b07f50', '#94653d', '#a06e44'].map(rgb);
  const plank = []; // per row: list of [startU, tone]
  for (let r = 0; r < rows; r++) {
    const off = Math.floor(R() * W); const segs = [];
    let u = 0; while (u < W) { const len = 40 + Math.floor(R() * 60); segs.push([u, tones[Math.floor(R() * tones.length)], R()]); u += len; }
    plank.push({ off, segs });
  }
  return paint(W, H, (x, y) => {
    const r = Math.floor(y / ph), yy = y % ph, P = plank[r];
    const ux = (x + P.off) % W;
    let s = P.segs[0]; for (const q of P.segs) if (ux >= q[0]) s = q;
    let c = s[1].slice();
    const grain = (n[y * W + ((x * 3 + r * 17) % W)] - 0.5) * 26 + (g[(y * W + x)] - 0.5) * 10 + Math.sin((x + s[2] * 40) * 0.21 + yy * 1.3) * 4;
    c = c.map((v) => v + grain);
    if (yy === 0) c = c.map((v) => v * 0.55);                 // seam between rows
    if (yy === ph - 1) c = c.map((v) => v * 0.85);
    if (P.segs.some((q) => q[0] === ux) && ux !== 0) c = c.map((v) => v * 0.6); // plank end joint
    return c;
  });
}

export function woodCanvas(hex, { seed = 3, streak = 22, size = 32 } = {}) {
  const base = rgb(hex), n = noise2(size, size, 4, seed), m = noise2(size, size, 1, seed + 1);
  return paint(size, size, (x, y) => {
    const v = n[y * size + ((x * 2) % size)] - 0.5, f = m[y * size + x] - 0.5;
    const k = Math.sin(y * 0.9 + v * 6) * 0.5 + 0.5;
    return base.map((c) => c + v * streak + f * 8 - k * 8);
  });
}

export function wallpaperCanvas() {
  const W = 32, H = 32, base = rgb('#ead9b8'), stripe = rgb('#dfcba5'), dot = rgb('#b7b48c'), R = rng(77), n = noise2(W, H, 3, 12);
  return paint(W, H, (x, y) => {
    let c = (x % 16 < 7) ? base.slice() : stripe.slice();
    if (x % 16 === 7 || x % 16 === 15) c = mix(c, rgb('#c9b48c'), 0.5);
    // small sprig motif in the light stripe
    const cx = 3, cy = (Math.floor(y / 16) % 2) * 0 + 8;
    const dx = x % 16 - cx, dy = (y % 16) - cy;
    if ((Math.abs(dx) + Math.abs(dy) === 2 && dx !== 0) || (dx === 0 && Math.abs(dy) <= 2)) c = mix(c, dot, 0.75);
    if (dx === 0 && dy === -3) c = mix(c, rgb('#c97a4a'), 0.7);
    const d = (n[y * W + x] - 0.5) * 10 + (R() - 0.5) * 5;
    return c.map((v) => v + d);
  });
}

export function noisy(hex, { size = 32, amount = 12, cell = 3, seed = 1 } = {}) {
  const base = rgb(hex), n = noise2(size, size, cell, seed), R = rng(seed + 99);
  return paint(size, size, (x, y) => { const d = (n[y * size + x] - 0.5) * amount * 1.4 + (R() - 0.5) * amount * 0.6; return base.map((v) => v + d); });
}

export function linenCanvas() {
  const S = 32, base = rgb('#f1e8d6'), R = rng(5), n = noise2(S, S, 4, 33);
  return paint(S, S, (x, y) => {
    let d = (n[y * S + x] - 0.5) * 8 + (R() - 0.5) * 6;
    if (x % 4 === 0) d -= 5; if (y % 4 === 0) d -= 5;
    return base.map((v) => v + d);
  });
}

export function plaidCanvas(a, b, c, d, { size = 32, seed = 8 } = {}) {
  const A = rgb(a), B = rgb(b), C = rgb(c), D = rgb(d), R = rng(seed);
  return paint(size, size, (x, y) => {
    const bx = (x % 16), by = (y % 16);
    let col = A.slice();
    const vx = bx >= 5 && bx <= 8, vy = by >= 5 && by <= 8;
    if (vx && vy) col = B; else if (vx || vy) col = mix(A, B, 0.55);
    if (bx === 12 || by === 12) col = mix(col, C, 0.7);
    if ((bx === 2 || by === 2)) col = mix(col, D, 0.5);
    return col.map((v) => v + (R() - 0.5) * 10);
  });
}

// table runner: burgundy body, gold + orange stripes along its length, leaf motif
export function runnerCanvas() {
  const W = 32, H = 32, R = rng(91);
  const burg = rgb('#7c2232'), orange = rgb('#c8642a'), gold = rgb('#d9a441'), cream = rgb('#efdcb8');
  return paint(W, H, (x, y) => {
    // v (y) is across the runner width, u (x) along the length
    let c = burg.slice();
    if (y <= 2 || y >= 29) c = gold; else if (y === 3 || y === 28) c = cream;
    else if (y >= 6 && y <= 8 || y >= 23 && y <= 25) c = orange;
    else {
      const cx = (x % 16) - 8, cy = y - 16;
      if (Math.abs(cx) + Math.abs(cy) <= 4 && (Math.abs(cx) + Math.abs(cy)) % 2 === 0) c = gold;
      if (Math.abs(cx) + Math.abs(cy) === 0) c = orange;
    }
    return c.map((v) => v + (R() - 0.5) * 12);
  });
}

// area rug: red field, navy border, gold accents, medallion
export function rugCanvas() {
  const W = 128, H = 96, R = rng(17);
  const red = rgb('#8e2f2a'), navy = rgb('#2c3a5c'), gold = rgb('#d0a14e'), cream = rgb('#e6d3ae'), rust = rgb('#b3542e');
  return paint(W, H, (x, y) => {
    const bx = Math.min(x, W - 1 - x), by = Math.min(y, H - 1 - y), b = Math.min(bx, by);
    let c;
    if (b < 2) c = cream; else if (b < 10) {
      c = navy.slice();
      const k = (bx < 10 ? y : x) % 8;
      if (b >= 4 && b <= 7 && (k === 2 || k === 3 || k === 6)) c = (k === 6) ? rust : gold;
    } else if (b < 12) c = gold; else {
      c = red.slice();
      const cx = (x - W / 2) / (W * 0.3), cy = (y - H / 2) / (H * 0.3), r = Math.abs(cx) + Math.abs(cy);
      if (r < 1.0 && r > 0.82) c = navy; else if (r <= 0.82 && r > 0.7) c = gold; else if (r < 0.25) c = navy; else if (r < 0.35) c = cream;
      if ((x + y) % 12 === 0 && r > 1.1) c = mix(c, rust, 0.6);
      if (((x * 3 + y * 5) % 23 === 0) && r > 1.1) c = mix(c, gold, 0.5);
    }
    return c.map((v) => v + (R() - 0.5) * 18);
  });
}

export function turkeyCanvas() {
  const S = 32, R = rng(51), n = noise2(S, S, 4, 52), m = noise2(S, S, 2, 53);
  const a = rgb('#b9661f'), b = rgb('#7d3a10'), c = rgb('#e3a352');
  return paint(S, S, (x, y) => {
    const v = n[y * S + x], w = m[y * S + x];
    let col = v > 0.62 ? mix(a, b, (v - 0.62) * 2.2) : v < 0.35 ? mix(a, c, (0.35 - v) * 2.2) : a;
    return col.map((q) => q + (w - 0.5) * 22 + (R() - 0.5) * 8);
  });
}

export function cornCanvas() {
  const W = 16, H = 32, R = rng(61);
  return paint(W, H, (x, y) => {
    const kx = x % 4, ky = (y + (Math.floor(x / 4) % 2) * 2) % 4;
    let c = rgb('#f2c53d');
    if (kx === 3 || ky === 3) c = rgb('#c99a24'); else if (kx === 0 && ky === 0) c = rgb('#fbe27a');
    return c.map((v) => v + (R() - 0.5) * 14);
  });
}

export function wickerCanvas() {
  const S = 16, R = rng(71);
  return paint(S, S, (x, y) => {
    const band = Math.floor(y / 4) % 2, k = (x + band * 4) % 8;
    let c = rgb(k < 4 ? '#b88a4e' : '#9c7040');
    if (y % 4 === 0) c = c.map((v) => v * 0.7);
    return c.map((v) => v + (R() - 0.5) * 16);
  });
}

export function ginghamCanvas(col = '#b8312f') {
  const S = 16, A = rgb(col), W = rgb('#f3ece0');
  return paint(S, S, (x, y) => { const a = (x % 8) < 4, b = (y % 8) < 4; return a && b ? A : (a || b) ? mix(A, W, 0.5) : W; });
}

export function strawCanvas() {
  const S = 32, R = rng(81), n = noise2(S, S, 2, 82);
  return paint(S, S, (x, y) => {
    const v = n[y * S + ((x * 5) % S)];
    let c = mix(rgb('#d8b45a'), rgb('#a8823a'), v);
    if (R() < 0.08) c = rgb('#f0d27a');
    return c;
  });
}

export function grassCanvas() {
  const S = 64, R = rng(91), n = noise2(S, S, 8, 92), m = noise2(S, S, 2, 93);
  const leafCols = ['#d2642a', '#e09a2c', '#b8402a', '#c8b040'].map(rgb);
  return paint(S, S, (x, y) => {
    let c = mix(rgb('#6f8f3a'), rgb('#9aa548'), n[y * S + x]);
    c = c.map((v) => v + (m[y * S + x] - 0.5) * 30);
    if (R() < 0.05) c = leafCols[Math.floor(R() * leafCols.length)];
    return c;
  });
}

export function fabricCanvas(hex, accent, { seed = 21 } = {}) {
  const S = 32, base = rgb(hex), acc = rgb(accent), R = rng(seed), n = noise2(S, S, 3, seed);
  return paint(S, S, (x, y) => {
    let c = base.slice();
    const dx = (x % 8) - 4, dy = (y % 8) - 4;
    if (Math.abs(dx) + Math.abs(dy) === 3) c = mix(c, acc, 0.35);
    return c.map((v) => v + (n[y * S + x] - 0.5) * 16 + (R() - 0.5) * 6);
  });
}

// ---------------------------------------------------------------- pixel-art photos for the frames
function px(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function person(ctx, x, y, o) {
  // x,y = top-left of head (head 6x7 px); shoulders below
  const { skin = '#e0ac84', hair = '#5a3a22', shirt = '#3a5a8a', style = 'short', glasses = false, smile = true, beard = false, bow = false } = o;
  const sh = o.shoulderW ?? 12;
  px(ctx, x + 3 - sh / 2, y + 8, sh, 8, shirt);                  // shoulders
  px(ctx, x + 2, y + 7, 2, 2, skin);                            // neck
  px(ctx, x, y, 6, 7, skin);                                    // face
  if (style === 'short') { px(ctx, x - 1, y - 1, 8, 2, hair); px(ctx, x - 1, y, 1, 3, hair); px(ctx, x + 6, y, 1, 3, hair); }
  if (style === 'long') { px(ctx, x - 1, y - 1, 8, 2, hair); px(ctx, x - 2, y, 2, 9, hair); px(ctx, x + 6, y, 2, 9, hair); }
  if (style === 'bun') { px(ctx, x - 1, y - 1, 8, 2, hair); px(ctx, x + 1, y - 3, 4, 2, hair); px(ctx, x - 1, y, 1, 2, hair); px(ctx, x + 6, y, 1, 2, hair); }
  if (style === 'bald') { px(ctx, x - 1, y + 1, 1, 3, hair); px(ctx, x + 6, y + 1, 1, 3, hair); }
  if (style === 'curly') { px(ctx, x - 2, y - 2, 10, 3, hair); px(ctx, x - 2, y, 2, 4, hair); px(ctx, x + 6, y, 2, 4, hair); }
  px(ctx, x + 1, y + 3, 1, 1, '#1a1410'); px(ctx, x + 4, y + 3, 1, 1, '#1a1410'); // eyes
  if (glasses) { ctx.strokeStyle = '#3a3030'; ctx.lineWidth = 1; px(ctx, x, y + 2, 6, 1, 'rgba(60,50,50,0.8)'); }
  if (beard) px(ctx, x, y + 5, 6, 3, hair);
  if (smile) { px(ctx, x + 1, y + 5, 4, 1, '#8a3a2a'); px(ctx, x + 2, y + 6, 2, 1, '#8a3a2a'); } else px(ctx, x + 2, y + 5, 2, 1, '#8a3a2a');
  if (bow) px(ctx, x + 5, y - 2, 3, 2, '#d84a6a');
}
function photo(w, h, bgTop, bgBot, draw, { mat = '#efe6d2', border = 2, sepia = false } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  px(x, 0, 0, w, h, mat);
  const iw = w - border * 2, ih = h - border * 2;
  for (let yy = 0; yy < ih; yy++) { const t = yy / ih; const a = rgb(bgTop), b = rgb(bgBot); x.fillStyle = `rgb(${mix(a, b, t).map(Math.round).join(',')})`; x.fillRect(border, border + yy, iw, 1); }
  x.save(); x.beginPath(); x.rect(border, border, iw, ih); x.clip(); x.translate(border, border); draw(x, iw, ih); x.restore();
  if (sepia) {
    const d = x.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
      d.data[i] = clamp(l * 1.07 + 20, 0, 255); d.data[i + 1] = clamp(l * 0.9 + 12, 0, 255); d.data[i + 2] = clamp(l * 0.68, 0, 255);
    }
    x.putImageData(d, 0, 0);
  }
  // pixel noise (film grain)
  const d = x.getImageData(0, 0, w, h), R = rng(w * 31 + h);
  for (let i = 0; i < d.data.length; i += 4) { const k = (R() - 0.5) * 14; d.data[i] += k; d.data[i + 1] += k; d.data[i + 2] += k; }
  x.putImageData(d, 0, 0);
  return c;
}
export function photoCanvases() {
  const fam = photo(56, 40, '#8aa0b8', '#4f6178', (x, w, h) => {
    px(x, 0, h - 6, w, 6, '#6b5a48');
    person(x, 6, 12, { hair: '#d8d4cc', style: 'bun', shirt: '#7a4a7a', glasses: true, skin: '#e8b892' });       // grandma
    person(x, 16, 9, { hair: '#4a2e1a', style: 'short', shirt: '#7a2a2a', beard: true, shoulderW: 14 });          // uncle
    person(x, 26, 11, { hair: '#8a5a2a', style: 'long', shirt: '#3a6a5a' });                                       // mom
    person(x, 35, 10, { hair: '#3a2a1a', style: 'short', shirt: '#2a4a7a' });                                     // dad
    person(x, 44, 15, { hair: '#2a1a10', style: 'short', shirt: '#d8a030', skin: '#d8a07a' });                     // you (kid)
    person(x, 21, 21, { hair: '#6a3a1a', style: 'long', shirt: '#c84a5a', bow: true, shoulderW: 9 });            // cousin
  }, { mat: '#efe6d2', border: 3 });
  const wedding = photo(28, 36, '#d8d0c0', '#a89888', (x, w, h) => {
    person(x, 6, 9, { hair: '#2a2018', style: 'short', shirt: '#202020', shoulderW: 12 });
    person(x, 15, 11, { hair: '#5a3a20', style: 'bun', shirt: '#f4f0e8', shoulderW: 11 });
    px(x, 13, 22, 10, 14, '#f4f0e8');
  }, { sepia: true, mat: '#e8dcc4', border: 3 });
  const school = photo(24, 30, '#5a7ab0', '#36507a', (x, w, h) => {
    for (let i = 0; i < 18; i++) px(x, (i * 7) % w, (i * 11) % h, 2, 1, '#7a9ad0');
    person(x, 7, 9, { hair: '#2a1a10', style: 'short', shirt: '#2f7a3a', skin: '#d8a07a', shoulderW: 14 });
    px(x, 10, 15, 1, 1, '#ffffff');
  }, { border: 2, mat: '#f0ece0' });
  const fish = photo(32, 26, '#9cc4e4', '#3a7aa0', (x, w, h) => {
    px(x, 0, 14, w, 12, '#2f6f8f'); px(x, 0, 12, w, 2, '#4a7a3a');
    person(x, 12, 5, { hair: '#4a2e1a', style: 'short', shirt: '#7a3a2a', beard: true, shoulderW: 16 });
    px(x, 4, 16, 22, 5, '#8a9a7a'); px(x, 2, 15, 3, 7, '#6a7a5a'); px(x, 24, 17, 2, 2, '#1a1a1a');   // huge fish
  }, { border: 2 });
  const dog = photo(26, 26, '#a8c878', '#6a9a48', (x, w, h) => {
    px(x, 6, 10, 14, 10, '#d8a050'); px(x, 8, 6, 10, 8, '#e0b060'); px(x, 6, 7, 3, 7, '#b8803a'); px(x, 17, 7, 3, 7, '#b8803a');
    px(x, 10, 9, 1, 1, '#1a1410'); px(x, 15, 9, 1, 1, '#1a1410'); px(x, 12, 11, 2, 1, '#2a1a10'); px(x, 12, 13, 2, 2, '#d85a6a');
  }, { border: 2, mat: '#ffffff' });
  const baby = photo(22, 28, '#f0d8e0', '#d8b0c0', (x, w, h) => {
    person(x, 8, 9, { hair: '#c8a070', style: 'bald', shirt: '#f0f0f8', skin: '#f0c0a0', shoulderW: 12 });
  }, { border: 2, mat: '#f6f0e4' });
  const landscape = photo(48, 32, '#f0b878', '#e88a50', (x, w, h) => {
    px(x, 0, 18, w, 14, '#7a6a3a');
    for (let i = 0; i < 6; i++) { const cx = 4 + i * 8, s = 5 + (i % 3) * 2; px(x, cx, 18 - s * 2, 3, s * 2, '#5a3a20'); px(x, cx - s / 2, 18 - s * 2 - s, s + 3, s + 2, ['#c84a2a', '#e0902a', '#d8b03a'][i % 3]); }
    px(x, 0, 26, w, 6, '#9a8040'); px(x, 30, 4, 4, 4, '#fff0c0');
  }, { border: 0 });
  return { fam, wedding, school, fish, dog, baby, landscape };
}

// ---------------------------------------------------------------- material palette (created once per build)
export function makeMaterials() {
  const T = (c, o) => tex(c, o);
  const M = {};
  M.floor = mat(T(planksCanvas()), { rough: 0.62 });
  M.wall = mat(T(wallpaperCanvas()), { rough: 0.95 });
  M.wainscot = mat(T(noisy('#6f7f5e', { size: 16, amount: 8, seed: 3 })), { rough: 0.8 });
  M.trim = mat(T(noisy('#efe6d3', { size: 16, amount: 6, seed: 4 })), { rough: 0.6 });
  M.ceiling = mat(T(noisy('#f2eadb', { size: 32, amount: 6, seed: 5 })), { rough: 1 });
  M.walnut = mat(T(woodCanvas('#6b4128', { seed: 6 })), { rough: 0.55 });
  M.walnutDark = mat(T(woodCanvas('#4e2e1c', { seed: 7 })), { rough: 0.55 });
  M.oak = mat(T(woodCanvas('#a8774a', { seed: 8 })), { rough: 0.6 });
  M.cherry = mat(T(woodCanvas('#7a3e26', { seed: 9 })), { rough: 0.5 });
  M.paintedHutch = mat(T(noisy('#e8dfcc', { size: 16, amount: 7, seed: 10 })), { rough: 0.6 });
  M.hutchBack = mat(T(noisy('#58708a', { size: 16, amount: 8, seed: 11 })), { rough: 0.8 });
  M.cloth = mat(T(linenCanvas()), { rough: 0.95 });
  M.runner = mat(T(runnerCanvas()), { rough: 0.95, polygonOffset: 2 });
  M.rug = mat(T(rugCanvas(), { mip: true }), { rough: 1 });
  M.cushion = mat(T(plaidCanvas('#b4652e', '#7c2a24', '#e0b050', '#3a2a20', { size: 32 })), { rough: 0.95 });
  M.curtain = mat(T(fabricCanvas('#a9502a', '#e0a050', { seed: 23 })), { rough: 0.95, side: THREE.DoubleSide });
  M.brass = mat('#c9a050', { rough: 0.35, metal: 0.75 });
  M.iron = mat('#2e2a26', { rough: 0.5, metal: 0.5 });
  M.steel = mat('#d8dadc', { rough: 0.25, metal: 0.85 });
  M.porcelain = mat('#f6f2e8', { rough: 0.25 });
  M.cream = mat('#efe2c4', { rough: 0.4 });
  M.glass = mat('#dff0ff', { rough: 0.05, transparent: true, opacity: 0.22 });
  M.glassRim = mat('#f4fbff', { rough: 0.1, transparent: true, opacity: 0.55 });
  M.water = mat('#9cc8e8', { rough: 0.05, transparent: true, opacity: 0.32 });
  M.waterTop = mat('#bfe0f4', { rough: 0.02, transparent: true, opacity: 0.45, flat: true });
  M.turkey = mat(T(turkeyCanvas()), { rough: 0.42 });
  M.turkeyDark = mat('#8a4416', { rough: 0.45 });
  M.meat = mat(T(noisy('#efdcc0', { size: 16, amount: 12, seed: 31 })), { rough: 0.7 });
  M.meatEdge = mat('#c07a3a', { rough: 0.5 });
  M.bone = mat('#f2ead8', { rough: 0.6 });
  M.frill = mat('#ffffff', { rough: 0.9 });
  M.potato = mat(T(noisy('#f3ead0', { size: 16, amount: 14, seed: 32 })), { rough: 0.85 });
  M.butter = mat('#f7d75a', { rough: 0.3 });
  M.gravy = mat('#6e3b17', { rough: 0.18 });
  M.gravyLight = mat('#7f4720', { rough: 0.2 });
  M.bean = mat(T(noisy('#4f8a2e', { size: 8, amount: 18, seed: 33 })), { rough: 0.6 });
  M.almond = mat('#e8d4a8', { rough: 0.6 });
  M.corn = mat(T(cornCanvas()), { rough: 0.5 });
  M.cranberry = mat('#9e1027', { rough: 0.22, emissive: '#3a0008', emissiveIntensity: 0.6 });
  M.roll = mat(T(noisy('#c98a3f', { size: 16, amount: 16, seed: 34 })), { rough: 0.6 });
  M.rollLight = mat('#e8c890', { rough: 0.7 });
  M.wicker = mat(T(wickerCanvas()), { rough: 0.9 });
  M.gingham = mat(T(ginghamCanvas()), { rough: 0.95, side: THREE.DoubleSide });
  M.pieFill = mat(T(noisy('#c8692a', { size: 16, amount: 10, seed: 35 })), { rough: 0.55 });
  M.crust = mat(T(noisy('#d9a560', { size: 16, amount: 16, seed: 36 })), { rough: 0.7 });
  M.cream2 = mat('#fffaf0', { rough: 0.7 });
  M.pieDish = mat('#9a4a2a', { rough: 0.3 });
  M.candle = mat('#f3e7cf', { rough: 0.6 });
  M.candleRed = mat('#8a2a2a', { rough: 0.5 });
  M.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.2) });
  M.flameCore = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d0').multiplyScalar(2.5) });
  M.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').multiplyScalar(2.0) });
  M.shade = mat('#f4dcae', { rough: 0.9, emissive: '#ffb860', emissiveIntensity: 0.9, side: THREE.DoubleSide });
  M.pumpkin = mat(T(noisy('#d9711f', { size: 16, amount: 14, seed: 37 })), { rough: 0.55 });
  M.pumpkinWhite = mat(T(noisy('#efe6d0', { size: 16, amount: 10, seed: 38 })), { rough: 0.6 });
  M.pumpkinGreen = mat('#5e6e38', { rough: 0.6 });
  M.stem = mat('#5a4a2a', { rough: 0.8 });
  M.leafRed = mat('#b8352a', { rough: 0.8, side: THREE.DoubleSide, polygonOffset: 2 });
  M.leafOrange = mat('#d9752a', { rough: 0.8, side: THREE.DoubleSide, polygonOffset: 2 });
  M.leafYellow = mat('#e0b23a', { rough: 0.8, side: THREE.DoubleSide, polygonOffset: 2 });
  M.leafBrown = mat('#8a4a22', { rough: 0.8, side: THREE.DoubleSide, polygonOffset: 2 });
  M.plantLeaf = mat('#4a7a3a', { rough: 0.7, side: THREE.DoubleSide });
  M.pot = mat('#b8673f', { rough: 0.8 });
  M.straw = mat(T(strawCanvas()), { rough: 1 });
  M.stalk = mat(T(noisy('#c8aa6a', { size: 16, amount: 16, seed: 39 })), { rough: 1, side: THREE.DoubleSide });
  M.napkin = mat(T(noisy('#a8462e', { size: 16, amount: 8, seed: 40 })), { rough: 0.95 });
  M.napkinGold = mat(T(noisy('#d4a245', { size: 16, amount: 8, seed: 41 })), { rough: 0.95 });
  M.frameGold = mat('#b8913e', { rough: 0.35, metal: 0.6 });
  M.frameBlack = mat('#24201c', { rough: 0.5 });
  M.frameWhite = mat('#efe8da', { rough: 0.5 });
  M.backing = mat('#3a3028', { rough: 1 });
  M.ceramicSage = mat('#8ea48a', { rough: 0.3 });
  M.ceramicBlue = mat('#4f6f9a', { rough: 0.3 });
  M.apple = mat('#b8282a', { rough: 0.35 });
  M.grape = mat('#5a2a5a', { rough: 0.3 });
  M.knob = mat('#c9a050', { rough: 0.3, metal: 0.8 });
  M.bow = mat('#7c2232', { rough: 0.7, side: THREE.DoubleSide });
  M.berry = mat('#c0202a', { rough: 0.3 });
  M.pine = mat('#6a4a2a', { rough: 0.9 });
  M.parsley = mat('#3f7a2a', { rough: 0.7 });
  M.orangeSlice = mat('#f0a030', { rough: 0.5 });
  M.twine = mat('#b89a6a', { rough: 1 });
  return M;
}
