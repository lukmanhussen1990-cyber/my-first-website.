// Pixel-art canvas textures for the world (NearestFilter, dithered, deterministic).
import * as THREE from 'three';
import { pixelTexture, rng, clamp } from '../core/util.js';

const hex = (c) => '#' + c.getHexString();
const C = (h) => new THREE.Color(h);

// HSL-jittered pixel of `base` (sRGB hex number).
function jit(base, r, dl, dh = 0, ds = 0) {
  const hsl = {}; C(base).getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + (r() - 0.5) * dh, clamp(hsl.s + (r() - 0.5) * ds, 0, 1), clamp(hsl.l + (r() - 0.5) * 2 * dl, 0, 1));
}
function px(ctx, x, y, col, s) { ctx.fillStyle = typeof col === 'string' ? col : hex(col); ctx.fillRect(((x % s) + s) % s, ((y % s) + s) % s, 1, 1); }

// Grass: near-white warm dither (multiplied by terrain vertex colour) with blade marks.
export function grassTexture() {
  return pixelTexture(64, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 0.86 + r() * 0.12;
      const c = new THREE.Color().setRGB(v * (0.98 + r() * 0.04), v, v * (0.9 + r() * 0.08), THREE.SRGBColorSpace);
      px(ctx, x, y, c, s);
    }
    // light and dark blade marks (2-3 px vertical strokes)
    for (let i = 0; i < 150; i++) {
      const x = Math.floor(r() * s), y = Math.floor(r() * s), len = 2 + Math.floor(r() * 2);
      const light = r() < 0.55;
      const c = light ? new THREE.Color().setRGB(1.0, 1.0, 0.82, THREE.SRGBColorSpace) : new THREE.Color().setRGB(0.70, 0.76, 0.6, THREE.SRGBColorSpace);
      for (let k = 0; k < len; k++) px(ctx, x, y - k, c, s);
    }
    // a few tiny yellow / white specks (flower pixels)
    for (let i = 0; i < 10; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), r() < 0.5 ? '#fff6a8' : '#ffffff', s);
  }, { seed: 11 });
}

// Mossy rock: purple-grey dither with darker cracks and green moss pixels.
export function rockTexture(seed = 21, moss = 0.12) {
  return pixelTexture(48, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 0.82 + r() * 0.18;
      const c = new THREE.Color().setRGB(v, v * (0.97 + r() * 0.03), v * (1.0 + r() * 0.04), THREE.SRGBColorSpace);
      px(ctx, x, y, c, s);
    }
    for (let i = 0; i < 26; i++) { // cracks
      let x = Math.floor(r() * s), y = Math.floor(r() * s);
      const n = 2 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) { px(ctx, x, y, '#8c8696', s); x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : 0; }
    }
    for (let i = 0; i < 40; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#ffffff', s);
    const greens = ['#5f9a2c', '#77b236', '#8cc43c', '#4c8228', '#a3cf48'];
    const nm = Math.floor(s * s * moss / 3);
    for (let i = 0; i < nm; i++) { // moss clusters
      const x = Math.floor(r() * s), y = Math.floor(r() * s);
      const g = greens[Math.floor(r() * greens.length)];
      px(ctx, x, y, g, s);
      if (r() < 0.6) px(ctx, x + 1, y, g, s);
      if (r() < 0.4) px(ctx, x, y + 1, greens[Math.floor(r() * greens.length)], s);
    }
  }, { seed });
}

// Dark river / shore stones: near-black with grey and blue-grey speckles.
export function stoneTexture() {
  return pixelTexture(32, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 0.55 + r() * 0.25;
      px(ctx, x, y, new THREE.Color().setRGB(v, v, v * 1.06, THREE.SRGBColorSpace), s);
    }
    for (let i = 0; i < 60; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), r() < 0.5 ? '#ffffff' : '#c9d2de', s);
    for (let i = 0; i < 30; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#404040', s);
  }, { seed: 33 });
}

// Leaf voxel: grey-white dither (multiplied by per-instance colour) with darker leaf spots + highlights.
export function leafTexture() {
  return pixelTexture(16, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 0.8 + r() * 0.17;
      px(ctx, x, y, new THREE.Color().setRGB(v, v, v * 0.97, THREE.SRGBColorSpace), s);
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * s), y = Math.floor(r() * s);
      px(ctx, x, y, '#9a9488', s); if (r() < 0.5) px(ctx, x + 1, y, '#a8a296', s);
    }
    for (let i = 0; i < 14; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#ffffff', s);
    // border darkening = reads as separate leaf blocks
    for (let k = 0; k < s; k++) { if (r() < 0.7) px(ctx, k, 0, '#b0aba0', s); if (r() < 0.7) px(ctx, 0, k, '#b8b3a8', s); }
  }, { seed: 44 });
}

// Bark: vertical streaks, grey-brown with a lavender cast (like the reference tree).
export function barkTexture() {
  return pixelTexture(16, (ctx, s, r) => {
    for (let x = 0; x < s; x++) {
      const colV = 0.82 + r() * 0.16;
      for (let y = 0; y < s; y++) {
        const v = colV * (0.94 + r() * 0.08);
        px(ctx, x, y, new THREE.Color().setRGB(v, v * 0.97, v * 0.98, THREE.SRGBColorSpace), s);
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * s), y = Math.floor(r() * s), n = 2 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) px(ctx, x, y + k, '#6e6660', s);
    }
    for (let i = 0; i < 8; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#f2ece6', s);
  }, { seed: 55 });
}

// Castle stone bricks: grey blocks, offset rows, dark mortar, a little moss.
export function brickTexture() {
  return pixelTexture(32, (ctx, s, r) => {
    ctx.fillStyle = '#5d5a62'; ctx.fillRect(0, 0, s, s);
    const bh = 4, bw = 8;
    for (let row = 0; row < s / bh; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < s / bw + 1; col++) {
        const base = 0.62 + r() * 0.22;
        for (let y = 1; y < bh; y++) for (let x = 1; x < bw; x++) {
          const v = base * (0.93 + r() * 0.1);
          px(ctx, col * bw + off + x, row * bh + y, new THREE.Color().setRGB(v, v * 0.99, v * 1.03, THREE.SRGBColorSpace), s);
        }
      }
    }
    for (let i = 0; i < 14; i++) px(ctx, Math.floor(r() * s), Math.floor(r() * s), '#6f8f4a', s);
  }, { seed: 66 });
}

// Roof shingles: plum/slate rows.
export function roofTexture() {
  return pixelTexture(16, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const row = Math.floor(y / 2);
      const edge = y % 2 === 0;
      const v = (edge ? 0.62 : 0.86) + r() * 0.12 + ((x + row * 2) % 4 === 0 ? -0.1 : 0);
      px(ctx, x, y, new THREE.Color().setRGB(v, v * 0.95, v * 1.02, THREE.SRGBColorSpace), s);
    }
  }, { seed: 77 });
}

// Water: bright cyan with lighter flow streaks and a few white glints (scrolled in the shader).
export function waterTexture() {
  return pixelTexture(32, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const c = jit(0x37d3ee, r, 0.025, 0.01);
      px(ctx, x, y, c, s);
    }
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(r() * s), y = Math.floor(r() * s), n = 3 + Math.floor(r() * 7);
      const c = r() < 0.25 ? '#c8f7ff' : r() < 0.6 ? '#7fe9fb' : '#5fdff6';
      for (let k = 0; k < n; k++) px(ctx, x + k, y, c, s);
    }
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * s), y = Math.floor(r() * s), n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) px(ctx, x + k, y, '#22b9dc', s);
    }
  }, { seed: 88 });
}

// Pixel cloud: soft elongated puff with quantised alpha (stair-stepped edges like the reference).
export function cloudTexture(seed = 5) {
  const W = 64, H = 24;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const img = ctx.createImageData(W, H);
  const blobs = [];
  const nb = 5 + Math.floor(r() * 4);
  for (let i = 0; i < nb; i++) blobs.push({ x: 0.15 + 0.7 * r(), y: 0.45 + (r() - 0.5) * 0.25, rx: 0.12 + 0.14 * r(), ry: 0.25 + 0.2 * r() });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (const b of blobs) {
      const dx = (x / W - b.x) / b.rx, dy = (y / H - b.y) / b.ry;
      a += Math.max(0, 1 - (dx * dx + dy * dy));
    }
    a = clamp(a, 0, 1);
    a = Math.round(a * 5) / 5; // quantise
    const shade = 0.86 + 0.14 * (1 - y / H); // lighter on top
    const i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * shade);
    img.data[i + 3] = Math.round(255 * a * 0.85);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Butterfly wing (right wing; mirrored by UV for the left): 16x16 with alpha.
export function butterflyTexture(kind = 0) {
  const pal = [
    { a: '#ff9a2e', b: '#ffcf5a', e: '#2a1a12', d: '#ffffff' },   // monarch-ish orange
    { a: '#fff07a', b: '#fffbd0', e: '#8a7a2a', d: '#ffb347' },   // brimstone yellow
    { a: '#8fc8ff', b: '#e2f2ff', e: '#2a3a6a', d: '#ffffff' },   // blue
  ][kind % 3];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const r = rng(90 + kind);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    // wing silhouette: upper (fore) wing big, hind wing smaller; x = 0 at the body
    const u = x / 15, v = y / 15;
    const fore = ((u - 0.05) / 0.95) ** 2 + ((v - 0.32) / 0.34) ** 2 < 1 && v < 0.62;
    const hind = ((u - 0.0) / 0.68) ** 2 + ((v - 0.7) / 0.3) ** 2 < 1;
    if (!fore && !hind) continue;
    const edgeD = fore ? 1 - (((u - 0.05) / 0.95) ** 2 + ((v - 0.32) / 0.34) ** 2) : 1 - ((u / 0.68) ** 2 + ((v - 0.7) / 0.3) ** 2);
    let col = edgeD < 0.22 ? pal.e : (u < 0.3 ? pal.a : (r() < 0.5 ? pal.a : pal.b));
    if (edgeD < 0.22 && r() < 0.25) col = pal.d;
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
