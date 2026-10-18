// Pixel-art canvas textures for the Jesus character (NearestFilter, dithered colour).
import * as THREE from 'three';
import { pixelTexture, clamp } from '../core/util.js';

const hsl = (h, s, l) => '#' + new THREE.Color().setHSL(((h % 1) + 1) % 1, clamp(s, 0, 1), clamp(l, 0, 1)).getHexString();
const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };

let cache = null;
export function jesusTextures() {
  if (cache) return cache;
  // Cream wool robe: soft dither, faint weave lines.
  const robe = pixelTexture(32, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let l = 0.75 + (r() - 0.5) * 0.075;
      if (x % 8 === 3) l -= 0.014;
      if ((x + y * 3) % 11 === 0) l -= 0.018;
      px(ctx, x, y, hsl(0.105 + (r() - 0.5) * 0.012, 0.40, l));
    }
  }, { seed: 11 });
  // Red sash: dither + darker border stripes along u (width direction is u).
  const sash = pixelTexture(32, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let l = 0.30 + (r() - 0.5) * 0.045;
      if (x < 2 || x > s - 3) l -= 0.06;
      if (x === 3 || x === s - 4) l += 0.03;
      px(ctx, x, y, hsl(0.995 + (r() - 0.5) * 0.012, 0.82, l));
    }
  }, { seed: 21 });
  // Hair: vertical strands (v runs along the strands).
  const hair = pixelTexture(32, (ctx, s, r) => {
    const col = Array.from({ length: s }, () => (r() - 0.5) * 0.07);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const streak = col[x] + Math.sin(y * 0.4 + x * 1.7) * 0.012;
      const l = 0.105 + streak * 0.9 + (r() - 0.5) * 0.022;
      px(ctx, x, y, hsl(0.052 + (r() - 0.5) * 0.01, 0.62, l));
    }
  }, { seed: 31 });
  const beard = pixelTexture(32, (ctx, s, r) => {
    const col = Array.from({ length: s }, () => (r() - 0.5) * 0.06);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const l = 0.088 + col[x] * 0.6 + (r() - 0.5) * 0.035;
      px(ctx, x, y, hsl(0.055 + (r() - 0.5) * 0.012, 0.55, l));
    }
  }, { seed: 41 });
  // Skin: very gentle dither (white-ish; real colour comes from vertex colours / material colour).
  const skin = pixelTexture(32, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) px(ctx, x, y, hsl(0.06, 0.12, 0.93 + (r() - 0.5) * 0.03));
  }, { seed: 51 });
  // Leather for sandals.
  const leather = pixelTexture(16, (ctx, s, r) => {
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) px(ctx, x, y, hsl(0.075, 0.45, 0.27 + (r() - 0.5) * 0.06));
  }, { seed: 61 });
  // Eye: sphere UV with the pole looking forward. Rows = polar angle (row 0 = pupil centre).
  const eyeCanvas = (emissive) => {
    const W = 32, H = 64;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ang = (y + 0.5) / H * 180; // degrees from the front pole
      let col;
      if (emissive) col = '#000000';
      else if (ang < 11) col = '#0d0806';
      else if (ang < 24) col = hsl(0.065, 0.58, 0.085 + (ang - 11) / 13 * 0.075 + ((x * 7 + y * 3) % 5 === 0 ? 0.025 : 0));
      else if (ang < 28) col = hsl(0.06, 0.45, 0.06);
      else col = hsl(0.075, 0.2, ang < 60 ? 0.80 : 0.72);
      px(ctx, x, y, col);
    }
    // catch-light: small bright patch upper-left of the pupil (as seen by the viewer)
    const cl = emissive ? '#ffffff' : '#fffaf0';
    for (const [x, y] of [[27, 7], [28, 7], [27, 8], [28, 8], [28, 6], [29, 7]]) px(ctx, x, y, cl);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  cache = { robe, sash, hair, beard, skin, leather, eye: eyeCanvas(false), eyeEmissive: eyeCanvas(true) };
  return cache;
}
