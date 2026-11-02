// Pixel canvases for the rainy blue-hour street (small, deterministic, NearestFilter via lib.tex). NO TEXT anywhere:
// shop boards carry little pixel pictograms only.
import * as THREE from 'three';
import { paint, canvas, rng, noise2, hexToRgb, clamp, tex } from './lib.js';
import { brickCanvas } from './set_tex2.js';

const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// paint two canvases at once: fn(x,y) -> [rgbA, rgbB]
export function paint2(w, h, fn) {
  const a = canvas(w, h), b = canvas(w, h), ia = a.getContext('2d').createImageData(w, h), ib = b.getContext('2d').createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [ca, cb] = fn(x, y), i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) { ia.data[i + k] = clamp(ca[k], 0, 255); ib.data[i + k] = clamp(cb[k], 0, 255); }
    ia.data[i + 3] = ca[3] ?? 255; ib.data[i + 3] = cb[3] ?? 255;
  }
  a.getContext('2d').putImageData(ia, 0, 0); b.getContext('2d').putImageData(ib, 0, 0);
  return [a, b];
}
// data texture (roughness etc.): no sRGB decode
export function dataTex(c, repeat = [1, 1]) { const t = tex(c, { repeat }); t.colorSpace = THREE.NoColorSpace; return t; }

// ---------------------------------------------------------------- ground
export function wetSlabCanvas(base = '#706c66', seed = 9) {
  const N = noise2(32, 32, 6, seed), R = rng(seed + 3), b = hexToRgb(base);
  return paint(32, 32, (x, y) => {
    if (x === 0 || y === 0) return add(b, -34);
    if (x === 1 || y === 1) return add(b, 6);
    let c = add(b, (N[y * 32 + x] - 0.5) * 16 + (R() - 0.5) * 8);
    if ((x * 7 + y * 13) % 97 === 0) c = add(c, -26);
    return c;
  });
}
// roughness map (G channel): wet = low. `wet` = share of very wet patches
export function wetRoughCanvas(seed = 3, { size = 64, cell = 9, wet = 0.42, lo = 0.07, hi = 0.5 } = {}) {
  const N = noise2(size, size, cell, seed), N2 = noise2(size, size, 3, seed + 7), R = rng(seed + 1);
  return paint(size, size, (x, y) => {
    const n = N[y * size + x] * 0.78 + N2[y * size + x] * 0.22;
    const k = sst(1 - wet - 0.08, 1 - wet + 0.08, 1 - n);       // 1 = wet
    const v = (lo + (hi - lo) * (1 - k) + (R() - 0.5) * 0.04) * 255;
    return [v, v, v];
  });
}
export function wetAsphaltCanvas(seed = 11) {
  const N = noise2(64, 64, 5, seed), N2 = noise2(64, 64, 16, seed + 5), R = rng(seed + 3);
  return paint(64, 64, (x, y) => {
    let v = 46 + (N[y * 64 + x] - 0.5) * 14 + (N2[y * 64 + x] - 0.5) * 12 + (R() - 0.5) * 10;
    if (R() < 0.025) v += 22;                                   // aggregate specks
    if (N2[y * 64 + x] > 0.72 && N[y * 64 + x] > 0.55) v -= 10; // patched spots
    return [v, v + 1, v + 5];
  });
}
export function curbCanvas(seed = 21) {
  const N = noise2(32, 16, 4, seed), R = rng(seed + 1);
  return paint(32, 16, (x, y) => { let c = [118, 116, 112]; c = add(c, (N[y * 32 + x] - 0.5) * 26 + (R() - 0.5) * 10); if (x === 0) c = add(c, -40); return c; });
}
export function dirtCanvas(seed = 31) {
  const N = noise2(32, 32, 4, seed), R = rng(seed + 2);
  return paint(32, 32, (x, y) => {
    let c = [52, 36, 26]; c = add(c, (N[y * 32 + x] - 0.5) * 22 + (R() - 0.5) * 10);
    const r = R();
    if (r < 0.05) c = [92, 88, 80];                             // pebbles
    else if (r < 0.075) c = [140, 98, 40];                      // dead leaf bits
    else if (r < 0.09) c = [58, 88, 40];                        // weeds
    return c;
  });
}
export function roofCanvas(seed = 41, base = '#4a4a50') {
  const N = noise2(32, 32, 6, seed), R = rng(seed + 1), b = hexToRgb(base);
  return paint(32, 32, (x, y) => { let c = add(b, (N[y * 32 + x] - 0.5) * 20 + (R() - 0.5) * 16); if (y % 16 === 0) c = add(c, -18); return c; });
}
// manhole cover (round grid pattern, no text)
export function manholeCanvas() {
  return paint(32, 32, (x, y) => {
    const d = Math.hypot(x - 15.5, y - 15.5);
    if (d > 15.5) return [40, 40, 44];
    let v = 64;
    if (d > 14) v = 50; else if ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0) v = 84;
    if (Math.abs(d - 7) < 1) v = 46;
    return [v, v, v + 4];
  });
}

// ---------------------------------------------------------------- facades (night): returns [map, emissive]
// windows: dark (sky reflection), lit warm (curtains, lamp, plant), TV blue
export function facadeNight(o) {
  const W = 64, HH = Math.max(32, Math.min(256, Math.round(64 * o.h / o.w)));
  const R = rng(o.seed), N = noise2(64, 64, 8, o.seed + 1);
  const brick = o.brick ? brickCanvas(o.base, '#a8957e', o.seed).getContext('2d').getImageData(0, 0, 64, 64).data : null;
  const b = hexToRgb(o.base), frame = hexToRgb(o.frame || '#d8d0c0');
  const cols = o.cols, rows = o.rows, litP = o.lit ?? 0.42;
  const kinds = Array.from({ length: 64 }, () => { const r = R(); return r < litP * 0.55 ? 1 : r < litP * 0.85 ? 2 : r < litP ? 3 : r < litP + 0.07 ? 4 : 0; });
  const warm = Array.from({ length: 64 }, () => [[255, 196, 112], [255, 176, 96], [255, 214, 150], [250, 160, 110]][Math.floor(R() * 4)]);
  const curt = Array.from({ length: 64 }, () => [[160, 40, 40], [60, 110, 70], [200, 150, 70], [90, 60, 130]][Math.floor(R() * 4)]);
  const black = [0, 0, 0];
  return paint2(W, HH, (x, y) => {
    let c;
    if (brick) { const i = ((y % 64) * 64 + (x % 64)) * 4; c = [brick[i], brick[i + 1], brick[i + 2]]; }
    else c = add(b, (N[(y % 64) * 64 + x] - 0.5) * 16 + (R() - 0.5) * 6);
    if (y < 4) return [add(frame, -26 + (R() - 0.5) * 8), black];
    if (y < 7) return [add(frame, 4), black];
    const cw = W / cols, rh = (HH - 10) / rows;
    const cx = x % cw, ry = (y - 9) % rh, ci = Math.floor(x / cw), ri = Math.floor((y - 9) / rh);
    if (y >= 9 && ri < rows) {
      const wx0 = cw * 0.24, wx1 = cw * 0.76, wy0 = rh * 0.16, wy1 = rh * 0.8;
      if (cx > wx0 - 1 && cx < wx1 + 1 && ry > wy0 - 1 && ry < wy1 + 2) {
        if (ry > wy1 && ry < wy1 + 2) return [add(frame, -10), black];                      // sill
        if (cx < wx0 || cx > wx1 || ry < wy0) return [frame, black];                         // frame
        const k = kinds[(ci * 7 + ri * 3 + (o.seed % 5)) % 64], col = warm[(ci * 5 + ri) % 64];
        const u = (cx - wx0) / (wx1 - wx0), v = (ry - wy0) / (wy1 - wy0);
        if (Math.abs(cx - (wx0 + wx1) / 2) < 0.6) return [add(frame, -20), black];           // mullion
        if (k === 0) {                                                                      // dark: sky reflection
          let g = mix([18, 26, 46], [58, 78, 120], clamp(1 - v));
          if (((cx + ry) % 9) < 1.5) g = add(g, 26);
          return [add(g, (R() - 0.5) * 6), black];
        }
        if (k === 4) { const g = add([70, 110, 190], (R() - 0.5) * 20); return [g, mul(g, 0.8)]; } // TV glow
        let g = mix(col, mul(col, 0.62), v * 0.6);
        if (k === 2 && (u < 0.24 || u > 0.76)) g = mix(curt[(ci + ri * 3) % 64], g, 0.25);  // curtains
        if (k === 3 && v > 0.6 && Math.abs(u - 0.5) < 0.18 + (v - 0.6)) g = [40, 60, 30];  // potted plant silhouette
        if (v < 0.14) g = mul(g, 0.7);                                                      // top shade
        g = add(g, (R() - 0.5) * 8);
        return [g, g];
      }
    }
    return [c, black];
  });
}

// ---------------------------------------------------------------- shop windows (night interiors, pixel art). Also used as emissive map.
export function shopWindowCanvas(kind, seed = 1) {
  const W = 64, H = 48, R = rng(seed), N = noise2(64, 48, 6, seed + 3);
  const frame = [26, 22, 20];
  return paint(W, H, (x, y) => {
    if (x < 2 || x > W - 3 || y < 2 || y > H - 3) return add(frame, (R() - 0.5) * 6);
    const u = x / W, v = y / H, n = N[y * 64 + x];
    let c;
    if (kind === 'cafe') {
      c = mix([150, 92, 48], [92, 52, 28], v);                                // warm wood wall
      if (y > 30) c = mix([110, 64, 34], [70, 40, 22], (y - 30) / 18);        // counter
      if (y === 30 || y === 31) c = [200, 160, 100];
      if (y > 14 && y < 18 && x % 6 < 4) c = [236, 232, 220];                // cups on the shelf
      if (y === 18) c = [70, 44, 26];
      for (const lx of [12, 30, 48]) { if (Math.abs(x - lx) < 1 && y < 9) c = [30, 24, 20]; if (Math.hypot(x - lx, y - 10) < 2.6) c = [255, 226, 150]; }
      if (x > 50 && x < 60 && y > 20 && y < 30) c = mix([40, 90, 50], [70, 130, 70], n);  // plant
    } else if (kind === 'pizza') {
      c = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) ? [236, 226, 210] : [196, 56, 46];  // tiles
      const d = Math.hypot((x - 34) / 1.3, y - 26);
      if (d < 13 && y < 34) c = mix([220, 90, 40], [120, 70, 60], clamp(d / 13));         // oven dome
      if (d < 6 && y > 22 && y < 34) c = mix([255, 210, 90], [255, 130, 40], (y - 22) / 12); // fire
      if (y > 34) c = mix([120, 80, 60], [80, 50, 40], (y - 34) / 12);
      if (y === 34) c = [210, 200, 180];
    } else if (kind === 'store') {
      c = [214, 222, 226];
      const sh = y % 12;
      if (sh < 2) c = [120, 126, 130];
      else if (sh < 9 && (x * 3 + Math.floor(y / 12) * 7) % 11 < 7) c = [[214, 70, 42], [232, 192, 64], [58, 138, 208], [90, 176, 64], [236, 120, 170]][(Math.floor(x / 3) + Math.floor(y / 12)) % 5];
      if (y < 4) c = [250, 250, 240];
    } else if (kind === 'boutique') {
      c = mix([96, 18, 34], [44, 8, 16], v);                                  // velvet backdrop
      for (const bx of [14, 32, 50]) {
        const dx = x - bx;
        if (Math.abs(dx) < 4 && y > 14 && y < 20) c = [220, 206, 196];       // bust neck
        if (Math.abs(dx) < 7 - (y - 20) * 0.1 && y >= 20 && y < 34) c = [228, 216, 206]; // bust
        if (y >= 21 && y < 27 && Math.abs(Math.abs(dx) - (y - 20) * 0.8) < 1 && Math.abs(dx) < 6) c = [255, 210, 80]; // necklace
        if (Math.hypot(dx, y - 27) < 1.3) c = [200, 240, 255];               // pendant gem
        if (y >= 34 && y < 37 && Math.abs(dx) < 9) c = [30, 24, 22];          // plinth
        if (Math.abs(dx) < 5 - y * 0.25 && y < 14) c = add(c, 40);           // spotlight cone
      }
      if (y > 40) c = [36, 30, 28];
    } else {                                                                   // dim apartment / closed
      c = mix([60, 46, 40], [30, 24, 22], v);
      if (Math.hypot(x - 40, y - 18) < 4) c = [240, 190, 110];
    }
    c = add(c, (n - 0.5) * 10 + (R() - 0.5) * 6);
    const refl = (x + y * 0.7) % 50;                                           // cool glass reflection streak
    if (refl > 6 && refl < 11) c = mix(c, [170, 190, 230], 0.22);
    return c;
  });
}

// icon board (lightbox, no letters): cafe cup, pizza slice, store basket, boutique diamond
export function iconBoardCanvas(kind, bg = '#2f5e3e') {
  const W = 64, H = 16, b = hexToRgb(bg), R = rng(kind.length * 7);
  const cx = 32;
  return paint(W, H, (x, y) => {
    let c = add(b, (R() - 0.5) * 6);
    if (y === 0 || y === H - 1 || x === 0 || x === W - 1) return [212, 176, 96];
    const dx = x - cx, dy = y - 8;
    if (kind === 'cafe') {
      if (dx >= -4 && dx <= 3 && dy >= -2 && dy <= 4) c = [244, 238, 226];   // cup
      if (dx >= -3 && dx <= 2 && dy === -2) c = [120, 70, 36];               // coffee
      if ((dx === 4 || dx === 5) && dy >= -1 && dy <= 2 && !(dx === 4 && (dy === 0 || dy === 1))) c = [244, 238, 226]; // handle
      if (dy === 5 && dx >= -6 && dx <= 5) c = [244, 238, 226];              // saucer
      if ((dx === -2 || dx === 1) && dy >= -6 && dy <= -4 && (dy + dx) % 2 === 0) c = [230, 230, 230]; // steam
      for (const ox of [-22, 22]) if (Math.hypot(x - cx - ox, y - 8) < 2.2) c = [212, 176, 96];       // dots
    } else if (kind === 'pizza') {
      const t = (dy + 5) / 11;
      if (t >= 0 && t <= 1 && Math.abs(dx) <= 6 * (1 - t) + 0.5) c = dy < -3 ? [196, 124, 54] : [252, 206, 80];
      if ((Math.hypot(dx + 1, dy + 1) < 1.3 || Math.hypot(dx - 2, dy - 2) < 1.2 || Math.hypot(dx + 1, dy - 3) < 1.0) && t > 0.15) c = [200, 40, 34];
      for (const ox of [-22, 22]) if (Math.hypot(x - cx - ox, y - 8) < 2.2) c = [252, 206, 80];
    } else if (kind === 'store') {
      if (dy >= -1 && dy <= 4 && Math.abs(dx) <= 6 - (dy > 2 ? dy - 2 : 0)) c = (dx + dy) % 3 === 0 ? [250, 220, 90] : [232, 192, 64]; // basket
      if (dy === -2 && Math.abs(dx) <= 7) c = [232, 192, 64];
      if (dy >= -6 && dy <= -2 && (Math.abs(dx + 4) === 2 - Math.floor((dy + 6) / 3) || false)) c = [232, 192, 64];
      if (Math.hypot(dx - 2, dy + 4) < 2.2) c = [220, 50, 40];                                         // apple
      if (dx === 2 && dy === -7) c = [70, 150, 60];
      for (const ox of [-22, 22]) if (Math.hypot(x - cx - ox, y - 8) < 2.2) c = [232, 192, 64];
    } else if (kind === 'boutique') {
      const ax = Math.abs(dx);
      if (dy >= -5 && dy <= -2 && ax <= 7 - (dy + 5)) c = dy === -5 ? [255, 255, 255] : [190, 230, 255];  // diamond top
      if (dy > -2 && dy <= 6 && ax <= (6 - dy) * 0.9) c = (dx + dy) % 2 ? [150, 210, 255] : [220, 244, 255]; // diamond bottom
      for (const ox of [-20, -14, 14, 20]) if (Math.hypot(x - cx - ox, y - 8) < 1.6) c = [255, 214, 110];
    }
    return c;
  });
}

// ---------------------------------------------------------------- limo + cart + props
export function velvetCanvas(base = '#8a1424', seed = 61) {
  const b = hexToRgb(base), N = noise2(32, 32, 4, seed), R = rng(seed + 1);
  return paint(32, 32, (x, y) => {
    let c = add(b, (N[y * 32 + x] - 0.5) * 22 + (R() - 0.5) * 8);
    const a = (x + y) % 16, d = (x - y + 64) % 16;                            // diamond tufting
    if (a === 0 || d === 0) c = mul(c, 0.62);
    if (a === 0 && d === 0) c = [240, 196, 90];                               // gold buttons
    else if ((a === 1 || d === 1)) c = mul(c, 1.15);
    return c;
  });
}
export function leatherCanvas(base = '#1c1a1a', seed = 63) {
  const b = hexToRgb(base), N = noise2(32, 32, 3, seed), R = rng(seed + 1);
  return paint(32, 32, (x, y) => { let c = add(b, (N[y * 32 + x] - 0.5) * 14 + (R() - 0.5) * 6); if (x % 8 === 0) c = add(c, -10); return c; });
}
// starlight headliner: navy with tiny bright stars ([map, emissive])
export function headlinerCanvas(seed = 65) {
  const R = rng(seed);
  return paint2(32, 32, () => {
    const r = R();
    if (r < 0.05) { const s = 180 + R() * 75; return [[s, s, s * 0.95], [s, s * 0.95, s * 0.8]]; }
    const c = add([22, 24, 44], (R() - 0.5) * 6); return [c, [0, 0, 0]];
  });
}
export function carpetDarkCanvas(seed = 67) {
  const N = noise2(32, 32, 3, seed), R = rng(seed + 1);
  return paint(32, 32, (x, y) => add([86, 14, 26], (N[y * 32 + x] - 0.5) * 18 + (R() - 0.5) * 10));
}
export function tireCanvas() {
  const R = rng(71);
  return paint(32, 8, (x, y) => { let v = 34 + (R() - 0.5) * 8; if (x % 4 === 0 || (y === 3 || y === 4) && x % 8 < 4) v -= 14; return [v, v, v + 2]; });
}
export function rustCanvas(seed = 73) {
  const N = noise2(32, 32, 5, seed), N2 = noise2(32, 32, 2, seed + 4), R = rng(seed + 1);
  return paint(32, 32, (x, y) => {
    const n = N[y * 32 + x], m = N2[y * 32 + x];
    let c = add([150, 152, 154], (m - 0.5) * 30 + (R() - 0.5) * 12);
    if (n > 0.56) c = mix(c, [142, 74, 34], clamp((n - 0.56) * 4));
    if (n > 0.7) c = mix(c, [96, 46, 22], 0.6);
    return c;
  });
}
export function sleepingBagCanvas(seed = 75) {
  const R = rng(seed);
  return paint(32, 16, (x, y) => {
    let c = [86, 104, 54];
    if (y % 4 === 0) c = [62, 76, 38];
    if (x < 3) c = [214, 112, 40];                                            // orange lining edge
    return add(c, (R() - 0.5) * 12);
  });
}
// umbrella canopy: u around (8 panels), v = rim (0) -> tip (1). Holes are transparent (alphaTest)
export function umbrellaCanvas(seed = 77) {
  const W = 64, H = 32, R = rng(seed);
  const cols = [[196, 64, 58], [234, 196, 70], [70, 120, 196], [86, 160, 90]];
  const holes = [[9, 10, 3.2], [27, 20, 2.4], [44, 8, 3.6], [55, 22, 2.0], [19, 25, 1.6], [37, 14, 2.2], [60, 6, 2.6]];
  const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, p = Math.floor(x / 8), col = cols[p % 4];
    let rgb = add(mul(col, 0.82), (R() - 0.5) * 14);
    if (x % 8 === 0) rgb = mul(rgb, 0.7);                                       // seams
    let a = 255;
    for (const [hx, hy, hr] of holes) if (Math.hypot(x - hx, (y - hy) * 1.2) < hr) a = 0;
    if (y >= H - 2 && (x * 5) % 13 < 4) a = 0;                                   // ragged rim
    if (y < 1) rgb = [40, 40, 40];
    img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function cardboardBlankCanvas(seed = 79) {
  const N = noise2(32, 32, 6, seed), R = rng(seed + 1);
  return paint(32, 32, (x, y) => {
    let c = [170 + (N[y * 32 + x] - 0.5) * 26 + (R() - 0.5) * 10, 128 + (N[y * 32 + x] - 0.5) * 20, 80];
    if (Math.abs(x - 15) < 1) c = add(c, -26);                                  // fold
    if ((x - 24) ** 2 / 16 + (y - 22) ** 2 / 10 < 1) c = add(c, -24);           // wet stain
    if (y > 26 && N[y * 32 + x] > 0.6) c = add(c, -30);
    return c;
  });
}
export function terracottaCanvas(seed = 81) {
  const R = rng(seed);
  return paint(16, 16, (x, y) => add(y < 3 ? [196, 104, 64] : [170, 86, 52], (R() - 0.5) * 16));
}

// ---------------------------------------------------------------- light / fx sprites
export function starSparkCanvas(S = 64) {
  const c = canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5) / S * 2 - 1, dy = (y + 0.5) / S * 2 - 1, r = Math.hypot(dx, dy);
    const ray = Math.max(Math.exp(-Math.abs(dx) * 22) * (1 - Math.abs(dy)), Math.exp(-Math.abs(dy) * 22) * (1 - Math.abs(dx)));
    const diag = Math.max(Math.exp(-Math.abs(dx - dy) * 16), Math.exp(-Math.abs(dx + dy) * 16)) * Math.max(0, 1 - r * 1.6) * 0.5;
    const core = Math.exp(-r * r * 40);
    const v = clamp(ray * 0.9 + diag + core) * 255, i = (y * S + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// soft puff (mist / cloud), white with alpha
export function puffCanvas(S = 64, seed = 85) {
  const c = canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), N = noise2(S, S, 8, seed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot((x + 0.5) / S * 2 - 1, (y + 0.5) / S * 2 - 1);
    const a = clamp((1 - r) * 1.4) ** 1.6 * (0.6 + 0.6 * N[y * S + x]);
    const i = (y * S + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = clamp(a) * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// vertical light shaft (additive): bright at the top (v=1), fades to the bottom and the sides
export function shaftCanvas(S = 32) {
  return paint(S, S * 2, (x, y) => {
    const u = (x + 0.5) / S, v = 1 - (y + 0.5) / (S * 2);
    const a = Math.pow(v, 1.6) * (0.55 + 0.45 * Math.sin(u * Math.PI * 6) ** 2);
    const k = clamp(a) * 255; return [k, k, k];
  });
}
// soft blob for fake contact shadows / light pools (white, alpha falloff)
export function blobCanvas(S = 64, power = 1.5) {
  const c = canvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot((x + 0.5) / S * 2 - 1, (y + 0.5) / S * 2 - 1), a = Math.pow(clamp(1 - r), power), i = (y * S + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
