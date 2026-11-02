// Pixel textures for set.js (small canvases, NearestFilter => PS1 look). Deterministic.
import * as THREE from 'three';
import { rng, paint, tex, hexToRgb, canvas, clamp } from './lib.js';
import { vnoise, hash2 } from './set_util.js';

const rgb = hexToRgb;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (c, d) => c.map((v) => v + d);

// ---------------------------------------------------------------- trees: one atlas, needles on top (v 0.5..1), bark below
// canvas 32 x 128: rows 0..63 needles, rows 64..127 bark
export const ATLAS = { needle: [0.515, 0.985], bark: [0.015, 0.485] };
export function treeAtlasCanvas() {
  const W = 32, H = 128, R = rng(301);
  const nDark = rgb('#22432a'), nBase = rgb('#3c6a36'), nLight = rgb('#79a04a'), nBlue = rgb('#2f5a4a');
  const bDark = rgb('#2b1c14'), bBase = rgb('#5e3f2b'), bLight = rgb('#8a6244'), lichen = rgb('#8c9a78');
  return paint(W, H, (x, y) => {
    if (y < 64) {
      // needle chevrons pointing down the slope + clumps
      const cx = x % 8, ch = (y + Math.abs(cx - 3.5) * 1.2) % 6;
      const n = vnoise(x / 3, y / 5, 7), m = vnoise(x / 1.5, y / 1.5, 9);
      let c = mix(nBase, nBlue, vnoise(x / 9, y / 9, 3) * 0.6);
      if (ch < 1.6) c = mix(c, nDark, 0.75);
      else if (ch > 4.6) c = mix(c, nLight, 0.45 + m * 0.3);
      c = add(c, (n - 0.5) * 34 + (R() - 0.5) * 16);
      if (R() < 0.04) c = mix(c, nLight, 0.8);
      return c;
    }
    const yy = y - 64;
    // vertical fissures with plates
    const col = Math.floor(x / 5 + vnoise(0, yy / 9, 4) * 1.6), fx = (x / 5 + vnoise(0, yy / 9, 4) * 1.6) % 1;
    const plate = hash2(col, Math.floor((yy + col * 7) / 11), 5);
    let c = mix(bBase, bLight, plate * 0.55);
    if (fx < 0.24) c = mix(c, bDark, 0.85);
    if ((yy + col * 7) % 11 === 0) c = mix(c, bDark, 0.6);
    c = add(c, (vnoise(x / 2, yy / 2, 8) - 0.5) * 26 + (R() - 0.5) * 10);
    if (R() < 0.025) c = mix(c, lichen, 0.7);
    return c;
  });
}

// chunky orange "puzzle plate" bark of the big pine (64x64, tiles)
export function hideBarkCanvas() {
  const S = 64, R = rng(311);
  const pts = []; // jittered grid of plate centres (tileable)
  const gx = 5, gy = 4;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) pts.push([(i + 0.15 + hash2(i, j, 1) * 0.7) / gx * S, (j + 0.15 + hash2(i, j, 2) * 0.7) / gy * S, hash2(i, j, 3)]);
  const plates = ['#9a5532', '#a8653a', '#8c4c2e', '#b2703f', '#94593a'].map(rgb), dark = rgb('#2a1712'), mid = rgb('#5a3424');
  return paint(S, S, (x, y) => {
    let d1 = 1e9, d2 = 1e9, best = null;
    for (const p of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const dx = (x - p[0] - ox * S) * 1.0, dy = (y - p[1] - oy * S) * 0.62; // plates taller than wide
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1;
    let c = plates[Math.floor(best[2] * plates.length) % plates.length].slice();
    c = add(c, (vnoise(x / 2.5, y / 2.5, 21) - 0.5) * 30 + (R() - 0.5) * 12);
    if ((x + y * 3) % 7 === 0 && edge > 3) c = mix(c, rgb('#c88a5a'), 0.25);   // flaky light scales
    if (edge < 1.6) c = mix(c, dark, 0.9); else if (edge < 3.0) c = mix(c, mid, 0.55);
    return c;
  });
}

// ---------------------------------------------------------------- ground
// detail multiplier: R = forest-floor needles, G = grass/moss (both centred on ~0.5)
export function groundDetailCanvas() {
  const S = 64, R = rng(321);
  const buf = new Float32Array(S * S * 2);
  for (let i = 0; i < S * S; i++) { const x = i % S, y = Math.floor(i / S); buf[i * 2] = 0.5 + (vnoise(x / 3, y / 3, 1) - 0.5) * 0.16 + (R() - 0.5) * 0.08; buf[i * 2 + 1] = 0.5 + (vnoise(x / 2, y / 2, 2) - 0.5) * 0.18 + (R() - 0.5) * 0.1; }
  const put = (x, y, ch, v) => { const i = (((y % S) + S) % S) * S + (((x % S) + S) % S); buf[i * 2 + ch] = v; };
  // needles: short 1px strokes in all directions, some light, some dark
  for (let k = 0; k < 230; k++) {
    const x0 = Math.floor(R() * S), y0 = Math.floor(R() * S), a = R() * Math.PI, len = 3 + Math.floor(R() * 4), v = R() < 0.55 ? 0.68 + R() * 0.12 : 0.3 + R() * 0.08;
    for (let s = 0; s < len; s++) put(Math.round(x0 + Math.cos(a) * s), Math.round(y0 + Math.sin(a) * s), 0, v);
  }
  // grass: short vertical-ish blades + moss specks
  for (let k = 0; k < 260; k++) {
    const x0 = Math.floor(R() * S), y0 = Math.floor(R() * S), len = 2 + Math.floor(R() * 3), v = R() < 0.6 ? 0.66 + R() * 0.12 : 0.33;
    const lean = R() < 0.5 ? 0 : (R() < 0.5 ? -1 : 1);
    for (let s = 0; s < len; s++) put(x0 + (s > 1 ? lean : 0), y0 - s, 1, v);
  }
  return paint(S, S, (x, y) => { const i = y * S + x; return [buf[i * 2] * 255, buf[i * 2 + 1] * 255, 128]; });
}

// ---------------------------------------------------------------- foliage, rocks, wood
export function bushLeafCanvas(base = '#3f7a2e', seed = 331) {
  const S = 32, R = rng(seed), b = rgb(base), dark = mix(b, [10, 30, 10], 0.55), light = mix(b, [190, 230, 120], 0.35);
  const c = paint(S, S, () => dark.map((v) => v + (R() - 0.5) * 10));
  const x = c.getContext('2d'), img = x.getImageData(0, 0, S, S);
  const set = (px, py, col) => { px = ((px % S) + S) % S; py = ((py % S) + S) % S; const i = (py * S + px) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; };
  for (let k = 0; k < 46; k++) { // small leaves: 4x3 ovals with a lit edge
    const cx = Math.floor(R() * S), cy = Math.floor(R() * S), shade = 0.75 + R() * 0.4;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && dy !== 0) continue;
      const col = (dy === -1 ? light : b).map((v) => clamp(v * shade + (R() - 0.5) * 12, 0, 255));
      set(cx + dx, cy + dy, col);
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
export function rockCanvas() {
  const S = 32, R = rng(341), base = rgb('#8c877d'), dark = rgb('#55524c'), lichen = rgb('#a8b07a');
  return paint(S, S, (x, y) => {
    const n = vnoise(x / 4, y / 4, 31), m = vnoise(x / 1.5, y / 1.5, 32);
    let c = mix(base, dark, n * 0.6);
    c = add(c, (m - 0.5) * 30 + (R() - 0.5) * 14);
    if (vnoise(x / 3, y / 3, 33) > 0.72 && R() < 0.5) c = mix(c, lichen, 0.5);
    return c;
  });
}
export function logEndCanvas() {
  const S = 32, R = rng(351);
  return paint(S, S, (x, y) => {
    const d = Math.hypot(x - 15.5, y - 15.5) + vnoise(x / 4, y / 4, 3) * 2;
    if (d > 14.5) return add(rgb('#4a3020'), (R() - 0.5) * 10);
    const ring = Math.sin(d * 1.35) * 0.5 + 0.5;
    let c = mix(rgb('#c99a62'), rgb('#9c7044'), ring * 0.7);
    if (d < 1.5) c = rgb('#7a5030');
    if (R() < 0.04) c = mix(c, rgb('#5a3a22'), 0.6);
    return add(c, (R() - 0.5) * 10);
  });
}
export function dryWoodCanvas() {
  const W = 16, H = 32, R = rng(361), base = rgb('#8a7a66'), dark = rgb('#4a3c30'), light = rgb('#b4a690');
  return paint(W, H, (x, y) => {
    let c = mix(base, light, vnoise(x / 2, y / 6, 4) * 0.6);
    if ((x + Math.floor(vnoise(0, y / 4, 5) * 3)) % 5 === 0) c = mix(c, dark, 0.6);
    if (vnoise(x / 3, y / 3, 9) > 0.7) c = mix(c, rgb('#6a4a32'), 0.55);  // leftover bark patches
    return add(c, (R() - 0.5) * 14);
  });
}

// ---------------------------------------------------------------- camp
export function tentCanvas() {
  const S = 32, R = rng(371), base = rgb('#ef7a26');
  return paint(S, S, (x, y) => {
    let c = base.slice();
    if (x % 8 === 0 || y % 8 === 0) c = c.map((v) => v * 0.9);     // ripstop grid
    c = add(c, (vnoise(x / 3, y / 3, 6) - 0.5) * 16 + (R() - 0.5) * 8);
    return c;
  });
}
export function cardboardCanvas(inside = false) {
  const S = 32, R = rng(inside ? 382 : 381), base = rgb(inside ? '#8a6238' : '#b5854f');
  return paint(S, S, (x, y) => {
    let c = add(base, (vnoise(x / 2, y / 5, 7) - 0.5) * 18 + (R() - 0.5) * 12);
    const seam = (x + y * 1.0) % 16;                                // spiral seam
    if (seam < 1) c = c.map((v) => v * 0.72); else if (seam < 2) c = c.map((v) => v * 1.08);
    return c;
  });
}

// ---------------------------------------------------------------- the GIANT fuzzy leaf (u across, v along stem->tip)
export function giantLeafCanvases() {
  const W = 48, H = 80, R = rng(391);
  const base = rgb('#86a35c'), dark = rgb('#5d7a3e'), vein = rgb('#c6d898'), fuzz = rgb('#dfe8c4');
  const glowBase = rgb('#b9d64e'), glowVein = rgb('#efe98a');
  const veinAt = (x, y) => {
    const u = (x + 0.5) / W - 0.5, v = (y + 0.5) / H;               // y=0 is the tip (canvas top) -> v = 1 - y/H
    const vv = 1 - v;
    if (Math.abs(u) < 0.035) return 1;                               // midrib
    // side veins: lines leaving the midrib upward toward the edge
    const k = (vv - Math.abs(u) * 0.9) * 9;
    const f = k - Math.floor(k);
    if (f < 0.11 && Math.abs(u) < 0.43 && vv > 0.06) return 0.6;
    return 0;
  };
  const leaf = paint(W, H, (x, y) => {
    const ve = veinAt(x, y);
    let c = mix(base, dark, vnoise(x / 5, y / 5, 3) * 0.45);
    c = mix(c, vein, ve * 0.7);
    c = add(c, (R() - 0.5) * 14);
    if (R() < 0.09) c = mix(c, fuzz, 0.6);                           // fuzz speckles
    return c;
  });
  const glow = paint(W, H, (x, y) => {
    const ve = veinAt(x, y);
    let c = mix(glowBase, glowVein, ve);
    return add(c, (vnoise(x / 4, y / 4, 5) - 0.5) * 30 + (R() - 0.5) * 10);
  });
  return { leaf, glow };
}

// ---------------------------------------------------------------- water, rays, glow
export function waterCanvas() {
  const S = 32, R = rng(401), base = rgb('#5c6f9a'), light = rgb('#c8a8c0'), dark = rgb('#3a4570');
  return paint(S, S, (x, y) => {
    let c = mix(base, dark, vnoise(x / 6, y / 3, 8) * 0.5);
    const w = Math.sin(x * 0.8 + vnoise(x / 5, y / 2, 9) * 5 + y * 0.3);
    if (w > 0.93 && (y % 4 === 0)) c = mix(c, light, 0.7);
    return add(c, (R() - 0.5) * 8);
  });
}
export function rayCanvas() {
  const W = 32, H = 128;
  return paint(W, H, (x, y) => {
    const u = (x + 0.5) / W - 0.5, v = (y + 0.5) / H;
    const across = Math.exp(-u * u * 18) * (0.85 + 0.15 * Math.sin(x * 1.7));
    const along = Math.pow(Math.sin(Math.PI * v), 1.4) * (0.75 + 0.25 * v);
    const a = clamp(across * along);
    return [255 * a, 255 * a, 255 * a];
  });
}
export function glowCanvas(S = 64) {
  const c = canvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

export { tex, THREE };
