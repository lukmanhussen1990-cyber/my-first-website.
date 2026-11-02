// Pixel textures for the outdoor places (Paris park + Eiffel Tower, wedding garden, porch house at sunset).
// Small canvases, deterministic (seeded), used through lib.tex() => NearestFilter magnification (PS1 look).
import { paint, rng, noise2, hexToRgb, clamp } from './lib.js';
import { vnoise, hash2 } from './set_util.js';

const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const rgb = hexToRgb;

// ---------------------------------------------------------------- EIFFEL TOWER
// riveted iron lattice panel: frame + big X (+ a thin mid strut); alpha 0 in the holes (alphaTest)
export function latticeCanvas(o = {}) {
  const S = 32, R = rng(o.seed || 401), base = rgb(o.base || '#8a6a4c');
  const hi = mix(base, [236, 196, 150], 0.28), lo = mul(base, 0.62);
  return paint(S, S, (x, y) => {
    const e = Math.min(x, y, S - 1 - x, S - 1 - y);
    const d1 = Math.abs(x - y), d2 = Math.abs(x + y - (S - 1));
    let c = null;
    if (e < 2) c = e < 1 ? lo : base;                                   // frame (4 px when tiled)
    else if (d1 < 1.7 || d2 < 1.7) c = (d1 < 0.8 || d2 < 0.8) ? hi : base;   // the big X
    else if (o.strut && Math.abs(y - 15.5) < 1) c = base;               // horizontal strut
    else if (o.fine && ((x + y) % 8 === 0 || (x - y + 64) % 8 === 0) && e > 3) c = lo;   // fine web
    if (!c) return [0, 0, 0, 0];
    return [...add(c, (R() - 0.5) * 16), 255];
  });
}
// solid iron (girders, platform undersides): bronze with rivet rows + pixel noise
export function ironCanvas(o = {}) {
  const S = 32, R = rng(o.seed || 403), N = noise2(S, S, 6, (o.seed || 403) + 1), base = rgb(o.base || '#6e5038');
  return paint(S, S, (x, y) => {
    let c = add(base, (N[y * S + x] - 0.5) * 22 + (R() - 0.5) * 12);
    if (y % 8 === 3 && x % 4 === 1) c = add(c, 34);                     // rivets
    if (y % 8 === 0) c = mul(c, 0.8);
    return c;
  });
}
// platform frieze: the band of little arches under the first / second floor
export function friezeCanvas(o = {}) {
  const W = 64, H = 16, R = rng(o.seed || 405), base = rgb(o.base || '#86664a'), dark = rgb('#2c2018'), light = rgb('#b89270');
  return paint(W, H, (x, y) => {
    if (y < 2) return add(light, (R() - 0.5) * 12);
    if (y > 13) return add(mul(base, 0.8), (R() - 0.5) * 10);
    const cx = (x % 8) - 3.5;
    const inArch = Math.abs(cx) < 2.6 && y > 4 && y < 13 && (y > 6.5 || cx * cx + (y - 6.5) ** 2 * 1.4 < 7);
    if (inArch) return add(dark, (R() - 0.5) * 8);
    if (y === 3 || y === 13) return add(light, -18 + (R() - 0.5) * 10);
    return add(base, (R() - 0.5) * 16);
  });
}

// ---------------------------------------------------------------- PARIS ground + city
// gravel alley (light beige, pebbles)
export function gravelCanvas(base = '#d6c6a2', seed = 411) {
  const S = 64, R = rng(seed), N = noise2(S, S, 8, seed + 1), b = rgb(base);
  return paint(S, S, (x, y) => {
    let c = add(b, (N[y * S + x] - 0.5) * 20 + (R() - 0.5) * 22);
    const p = hash2(x >> 1, y >> 1, seed);
    if (p > 0.93) c = add(c, 26); else if (p < 0.06) c = add(c, -34);
    return c;
  });
}
// lawn: soft mottled grass (+ optional mow stripes along v), blades as 1-px light/dark strokes
export function grassCanvas(o = {}) {
  const S = 64, seed = o.seed || 413, R = rng(seed), N = noise2(S, S, 10, seed + 1), N2 = noise2(S, S, 4, seed + 2);
  const b = rgb(o.base || '#5f9a3c'), lite = rgb(o.light || '#8cc051'), dark = rgb(o.dark || '#3d7228');
  const buf = new Float32Array(S * S);
  for (let k = 0; k < 520; k++) {                                       // short vertical blades
    const x0 = Math.floor(R() * S), y0 = Math.floor(R() * S), len = 2 + Math.floor(R() * 3), v = R() < 0.55 ? 1 : -1;
    for (let s = 0; s < len; s++) buf[((y0 - s + S) % S) * S + x0] = v;
  }
  return paint(S, S, (x, y) => {
    let c = mix(b, N[y * S + x] > 0.5 ? lite : dark, Math.abs(N[y * S + x] - 0.5) * 0.9);
    c = add(c, (N2[y * S + x] - 0.5) * 14 + (R() - 0.5) * 8);
    if (o.stripes) c = mul(c, Math.floor(x / 32) % 2 ? 1.07 : 0.94);
    const bl = buf[y * S + x];
    if (bl > 0) c = mix(c, lite, 0.45); else if (bl < 0) c = mix(c, dark, 0.45);
    return c;
  });
}
// Haussmann facade: cream limestone, window grid, iron balcony lines (2nd + top floor), shop arches at the bottom
export function hausFacadeCanvas(seed = 421, base = '#e2d4b8') {
  const W = 32, H = 64, R = rng(seed), N = noise2(W, H, 8, seed + 1), b = rgb(base);
  const glass = rgb('#4a5868'), frame = add(b, 18), iron = rgb('#2a2a2e'), shop = rgb('#5a4a3e');
  const shut = rgb(['#6a7a6a', '#7a8a9a', '#8a7a6a'][seed % 3]);
  return paint(W, H, (x, y) => {
    let c = add(b, (N[y * W + x] - 0.5) * 16 + (R() - 0.5) * 8);
    if (y % 9 === 0) c = add(c, -14);                                   // floor courses
    if (y >= 54) {                                                       // ground floor (shops)
      const cx = x % 8;
      if (cx > 1 && cx < 7 && y > 56) return add(shop, (R() - 0.5) * 10 + (y < 59 ? 20 : 0));
      return add(c, -10);
    }
    const fx = x % 8, fy = y % 9;
    if (fx >= 2 && fx <= 5 && fy >= 2 && fy <= 7) {                     // window
      if (fx === 2 || fx === 5) return hash2(x >> 3, Math.floor(y / 9), seed) > 0.6 ? add(shut, (R() - 0.5) * 8) : frame;
      return add(glass, (R() - 0.5) * 14 + (fy < 4 ? 18 : 0));
    }
    if ((y === 17 || y === 44) && fx !== 0) return add(iron, (R() - 0.5) * 10);   // balcony rails
    return c;
  });
}
// mansard roof (steep part): blue-grey zinc with standing seams and dormer windows
export function mansardCanvas(seed = 431) {
  const W = 32, H = 32, R = rng(seed), N = noise2(W, H, 6, seed + 1), z = rgb('#76879a');
  return paint(W, H, (x, y) => {
    let c = add(z, (N[y * W + x] - 0.5) * 18 + (R() - 0.5) * 8);
    if (x % 4 === 0) c = add(c, 16);
    const dx = x % 16;
    if (dx >= 5 && dx <= 10 && y >= 9 && y <= 26) {                     // dormer: white frame, dark glass
      if (dx === 5 || dx === 10 || y === 9 || y === 26) return add(rgb('#e8e2d4'), (R() - 0.5) * 8);
      return add(rgb('#3c4656'), (R() - 0.5) * 10 + (y < 14 ? 16 : 0));
    }
    if (dx >= 4 && dx <= 11 && y >= 6 && y < 9) return add(rgb('#5e6e80'), (R() - 0.5) * 6);   // dormer cap
    return c;
  });
}
export function zincCanvas(seed = 433) {
  const S = 16, R = rng(seed), z = rgb('#7d8ea0');
  return paint(S, S, (x) => add(z, (x % 4 === 0 ? 14 : 0) + (R() - 0.5) * 10));
}

// ---------------------------------------------------------------- vegetation
export function barkCanvas(base = '#6a4e38', seed = 441) {
  const W = 16, H = 32, R = rng(seed), b = rgb(base), dark = mul(b, 0.55), light = add(b, 26);
  return paint(W, H, (x, y) => {
    const col = Math.floor(x / 4 + vnoise(0, y / 7, seed) * 1.4), fx = (x / 4 + vnoise(0, y / 7, seed) * 1.4) % 1;
    let c = mix(b, light, hash2(col, Math.floor(y / 6), seed) * 0.5);
    if (fx < 0.25) c = mix(c, dark, 0.8);
    return add(c, (R() - 0.5) * 12);
  });
}
// dense small leaves (trimmed bushes / hedges): dark base + lit leaf ovals
export function leafCanvas(base = '#3f7a2e', seed = 451, o = {}) {
  const S = 32, R = rng(seed), b = rgb(base), dark = mix(b, [12, 34, 14], 0.5), light = mix(b, o.lightTo || [200, 236, 130], o.lightK ?? 0.4);
  const img = new Array(S * S).fill(null).map(() => add(dark, (R() - 0.5) * 12));
  const set = (px, py, c) => { px = ((px % S) + S) % S; py = ((py % S) + S) % S; img[py * S + px] = c; };
  for (let k = 0; k < (o.n || 60); k++) {
    const cx = Math.floor(R() * S), cy = Math.floor(R() * S), sh = 0.72 + R() * 0.45;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && dy !== 0) continue;
      set(cx + dx, cy + dy, mul(dy === -1 ? light : b, sh).map((v) => clamp(v + (R() - 0.5) * 10, 0, 255)));
    }
    if (o.flowers && R() < o.flowers) set(cx, cy, o.flowerCol ? rgb(o.flowerCol) : [255, 255, 255]);
  }
  return paint(S, S, (x, y) => img[y * S + x]);
}

// ---------------------------------------------------------------- WEDDING
// white fabric runner: soft weave + a lace border along both long edges (u across, v along)
export function runnerCanvas(seed = 461) {
  const W = 32, H = 32, R = rng(seed), b = [246, 244, 240];
  return paint(W, H, (x, y) => {
    let c = add(b, ((x + y) % 2 ? -4 : 3) + (R() - 0.5) * 6);
    const e = Math.min(x, W - 1 - x);
    if (e < 4) { c = add(b, -10); if ((e === 1 || e === 2) && (y % 4 === 1 || (y + e) % 4 === 3)) c = add(b, -38); }
    if (e === 4) c = add(b, -22);
    return c;
  });
}
// white canvas (tent, tablecloth): faint weave + optional vertical stripes
export function canvasClothCanvas(o = {}) {
  const S = 32, R = rng(o.seed || 463), b = rgb(o.base || '#f4f1ea');
  return paint(S, S, (x, y) => {
    let c = add(b, (R() - 0.5) * 7 + ((x * 3 + y) % 5 === 0 ? -5 : 0));
    if (o.stripes && Math.floor(x / 8) % 2) c = mix(c, rgb(o.stripes), 0.7);
    return c;
  });
}
// white painted wood (chairs, arch, fence, trim)
export function whiteWoodCanvas(seed = 465, base = '#f3f1ea') {
  const W = 16, H = 32, R = rng(seed), b = rgb(base);
  return paint(W, H, (x, y) => add(b, (vnoise(x / 1.5, y / 6, seed) - 0.5) * 10 + (R() - 0.5) * 6 + (x % 8 === 0 ? -8 : 0)));
}

// ---------------------------------------------------------------- PORCH HOUSE
// clapboard siding: horizontal boards 8 px tall, lit top edge, dark drip shadow at the bottom (u along, v up)
export function sidingCanvas(base = '#9fc0d4', seed = 471) {
  const S = 64, R = rng(seed), b = rgb(base), N = noise2(S, S, 6, seed + 1);
  return paint(S, S, (x, y) => {
    const by = y % 8;
    let c = add(b, (N[y * S + x] - 0.5) * 10 + (R() - 0.5) * 6 + (vnoise(x / 9, Math.floor(y / 8) * 3.1, seed) - 0.5) * 10);
    if (by === 7) c = mul(c, 0.66); else if (by === 6) c = mul(c, 0.86); else if (by === 0) c = add(c, 14);
    return c;
  });
}
// roof shingles: staggered tabs in rows, colour per tab, shadow line under each row
export function shingleCanvas(base = '#6a5552', seed = 473) {
  const S = 64, R = rng(seed), b = rgb(base);
  return paint(S, S, (x, y) => {
    const row = Math.floor(y / 8), off = (row % 2) * 5, tab = Math.floor((x + off) / 10);
    const k = 0.84 + hash2(tab, row, seed) * 0.32;
    let c = add(mul(b, k), (R() - 0.5) * 12);
    const ry = y % 8, gx = (x + off) % 10;
    if (ry === 7 || ry === 6) c = mul(c, ry === 7 ? 0.55 : 0.78);
    if (gx === 0 && ry < 6) c = mul(c, 0.62);
    if (ry === 0) c = add(c, 10);
    return c;
  });
}
// deck boards (u across the boards, v along): honey wood, dark gaps, grain
export function deckCanvas(base = '#b07a48', seed = 475) {
  const S = 64, R = rng(seed), b = rgb(base);
  return paint(S, S, (x, y) => {
    const board = Math.floor(x / 8), bx = x % 8;
    const k = 0.86 + hash2(board, Math.floor((y + board * 23) / 64), seed) * 0.26;
    let c = add(mul(b, k), (vnoise(x / 1.2, y / 9, seed + board) - 0.5) * 20 + (R() - 0.5) * 8);
    if (bx === 7) c = mul(c, 0.42);
    if ((y + board * 19) % 64 === 0) c = mul(c, 0.5);                    // board ends
    return c;
  });
}
// beadboard porch ceiling ("haint blue")
export function beadboardCanvas(base = '#bfe2e0', seed = 477) {
  const S = 32, R = rng(seed), b = rgb(base);
  return paint(S, S, (x) => { let c = add(b, (R() - 0.5) * 6); if (x % 4 === 0) c = mul(c, 0.8); if (x % 4 === 1) c = add(c, 8); return c; });
}
// glowing window seen from outside: warm room, curtains, mullions (cross), bright lamp spot
export function warmWindowCanvas(o = {}) {
  const W = 32, H = 48, R = rng(o.seed || 481), N = noise2(W, H, 6, (o.seed || 481) + 1);
  const room = rgb(o.room || '#e89a48'), deep = rgb('#a85a2a'), lamp = rgb('#fff0b8'), cur = rgb(o.curtain || '#f2e2c8'), frame = rgb('#f6f4ee');
  return paint(W, H, (x, y) => {
    if (x < 2 || x > W - 3 || y < 2 || y > H - 3) return add(frame, (R() - 0.5) * 6);
    if (Math.abs(x - 15.5) < 1.2 || Math.abs(y - (o.cross ?? 23.5)) < 1.2) return add(frame, -10 + (R() - 0.5) * 6);
    const cx = x - 2, side = Math.min(cx, W - 5 - cx);
    let c = mix(deep, room, clamp(0.35 + N[y * W + x] * 0.5 + (y / H) * 0.25));
    const ld = Math.hypot(x - (o.lampX ?? 22), y - (o.lampY ?? 30));
    c = mix(c, lamp, clamp(1 - ld / 9) * 0.85);
    if (side < 6 - Math.abs(y - 8) * 0.12) c = add(mix(cur, room, 0.18), (x % 3 === 0 ? -16 : 0) + (R() - 0.5) * 6);   // curtains
    return add(c, (R() - 0.5) * 6);
  });
}
// front door: painted panels + a small glowing window at the top
export function porchDoorCanvas(base = '#a8473a', seed = 483) {
  const W = 32, H = 64, R = rng(seed), b = rgb(base), lite = rgb('#ffd890');
  return paint(W, H, (x, y) => {
    let c = add(b, (vnoise(x / 2, y / 8, seed) - 0.5) * 10 + (R() - 0.5) * 6);
    if (x < 2 || x > 29 || y < 2 || y > 61) return mul(c, 0.7);
    if (x > 5 && x < 26 && y > 5 && y < 22) {                           // window (4 panes)
      if (x === 6 || x === 25 || y === 6 || y === 21 || x === 15 || x === 16 || y === 13) return add(rgb('#f2efe6'), (R() - 0.5) * 6);
      return add(mix(lite, rgb('#e89a48'), (y - 6) / 18), (R() - 0.5) * 10);
    }
    const pan = (x0, x1, y0, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    for (const [x0, x1, y0, y1] of [[5, 14, 26, 42], [17, 26, 26, 42], [5, 14, 46, 58], [17, 26, 46, 58]]) {
      if (pan(x0, x1, y0, y1)) { if (x === x0 || y === y0) return add(c, 26); if (x === x1 || y === y1) return mul(c, 0.66); return add(c, 6); }
    }
    return c;
  });
}
// irregular flagstones with grass in the joints (path)
export function flagstoneCanvas(seed = 485) {
  const S = 64, R = rng(seed), pts = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) pts.push([(i + 0.2 + hash2(i, j, seed) * 0.6) * 16, (j + 0.2 + hash2(i, j, seed + 1) * 0.6) * 16, hash2(i, j, seed + 2)]);
  const stones = ['#b8ab98', '#a89e90', '#c4b8a2', '#9c948a', '#b4a48c'].map(rgb), grass = rgb('#5a8a3a');
  return paint(S, S, (x, y) => {
    let d1 = 1e9, d2 = 1e9, best = null;
    for (const p of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const d = Math.hypot(x - p[0] - ox * S, y - p[1] - oy * S);
      if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 2.2) return add(grass, (R() - 0.5) * 24);
    let c = add(stones[Math.floor(best[2] * 5) % 5], (vnoise(x / 3, y / 3, seed) - 0.5) * 20 + (R() - 0.5) * 10);
    if (d2 - d1 < 3.4) c = mul(c, 0.8);
    return c;
  });
}
// white diagonal lattice skirting under the porch (opaque: dark gaps)
export function lattSkirtCanvas(seed = 487) {
  const S = 16, R = rng(seed), w = rgb('#eeebe2'), d = rgb('#2a2622');
  return paint(S, S, (x, y) => { const a = (x + y) % 8, b = (x - y + 16) % 8; return (a < 2 || b < 2) ? add(w, (R() - 0.5) * 8) : add(d, (R() - 0.5) * 6); });
}
// red bricks (chimney)
export function chimneyBrickCanvas(seed = 489) {
  const R = rng(seed), N = noise2(32, 32, 6, seed + 1), b = rgb('#9a4a36'), m = rgb('#c8b8a0');
  return paint(32, 32, (x, y) => {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) return add(m, (R() - 0.5) * 10);
    return add(b, (hash2(Math.floor((x + off) / 8), row, seed) - 0.5) * 40 + (N[y * 32 + x] - 0.5) * 14);
  });
}
// stone foundation
export function fieldstoneCanvas(seed = 491) {
  const S = 32, R = rng(seed), b = rgb('#9a9286');
  return paint(S, S, (x, y) => {
    const row = Math.floor(y / 6), off = (row * 5) % 11, st = Math.floor((x + off) / 11);
    let c = add(mul(b, 0.85 + hash2(st, row, seed) * 0.3), (R() - 0.5) * 14);
    if (y % 6 === 5 || (x + off) % 11 === 10) c = mul(c, 0.55);
    return c;
  });
}
