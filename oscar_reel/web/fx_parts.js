// Geometry + canvas builders for fx.js (owner: fx agent). Built once at startup, never per frame.
import * as THREE from 'three';
import { rng } from './lib.js';

// Cartoon drop (sweat / tear): bulb radius 0.3 (width 0.6, bottom y = -0.5), tip at y = +0.52 -> height 1.02.
export function dropGeometry() {
  const prof = [];
  const R = 0.3, cy = -0.2;
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2 + 0.75); prof.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * R), cy + Math.sin(a) * R)); }
  prof.push(new THREE.Vector2(0.09, 0.3)); prof.push(new THREE.Vector2(0.0001, 0.52));
  const g = new THREE.LatheGeometry(prof, 9);
  g.computeVertexNormals();
  return g;
}

// Leaf: two quads folded along the midrib (local +Y = tip, length 1, width 0.56), uv covers the leaf texture.
export function leafGeometry() {
  const w = 0.28, f = 0.07;
  const pos = [-w, -0.5, f, 0, -0.5, 0, w, -0.5, f, -w, 0.5, f, 0, 0.5, 0, w, 0.5, f];
  const uv = [0, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 1, 1, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]);
  g.computeVertexNormals();
  return g;
}

// 12x20 pixel leaf (pointed oval, darker rim, light midrib). Nearest-filtered by the caller.
export function leafCanvas(base, dark, light, seed = 1) {
  const w = 12, h = 20, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), R = rng(seed);
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const B = hex(base), D = hex(dark), L = hex(light);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 1 - (y + 0.5) / h;                       // 0 bottom (stem) .. 1 tip
    const half = 5.6 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.8);
    const dx = Math.abs(x + 0.5 - w / 2);
    const i = (y * w + x) * 4;
    let col = null;
    if (dx < 0.9 && v < 0.98) col = L;                 // midrib (+ stem)
    else if (dx < half - 1.1) col = B;
    else if (dx < half) col = D;
    if (!col) { img.data[i + 3] = 0; continue; }
    const n = (R() - 0.5) * 18;
    img.data[i] = col[0] + n; img.data[i + 1] = col[1] + n; img.data[i + 2] = col[2] + n * 0.5; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// "x7" badge: chunky Pixelify Sans text (yellow, thick dark outline, hard drop shadow) on a red-orange starburst.
// Drawn big (size px square) so it stays sharp at 1080x1920 even when it fills a third of the frame.
export function badgeCanvas(text, size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2, ink = '#26120a';
  // starburst
  const N = 13, R1 = size * 0.475, R0 = size * 0.355;
  const burst = (r1, r0, rot) => {
    g.beginPath();
    for (let i = 0; i < N * 2; i++) {
      const a = -Math.PI / 2 + rot + (i * Math.PI) / N, r = i % 2 === 0 ? r1 : r0;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  g.lineJoin = 'miter'; g.miterLimit = 10;
  burst(R1 * 0.97, R0 * 0.97, 0.12); g.fillStyle = ink; g.save(); g.translate(size * 0.018, size * 0.026); g.fill(); g.restore();  // hard shadow
  burst(R1 * 0.95, R0 * 0.95, 0.12); g.fillStyle = '#ff4f1c'; g.fill();
  g.lineWidth = size * 0.034; g.strokeStyle = ink; g.stroke();
  burst(R1 * 0.74, R0 * 0.8, 0.12 + Math.PI / N); g.fillStyle = '#ff8a24'; g.fill();
  // text: a small "x" + a big number when the text looks like "x7", otherwise one line fitted to the burst
  const m = /^([x×])(\S+)$/i.exec(text);
  const parts = m ? [[m[1], 0.3], [m[2], 0.5]] : [[text, 0.5]];
  const font = (k) => `700 ${Math.round(size * k)}px "Pixelify Sans", monospace`;
  let total = 0;
  for (const [s, k] of parts) { g.font = font(k); total += g.measureText(s).width; }
  const gapX = parts.length > 1 ? size * 0.015 : 0;
  total += gapX;
  const fit = Math.min(1, (size * 0.62) / total);
  let x = cx - (total * fit) / 2;
  const base = cy + size * 0.16 * fit;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.lineJoin = 'miter';
  for (const pass of ['shadow', 'stroke', 'fill']) {
    let xx = x;
    for (const [s, k] of parts) {
      g.font = font(k * fit);
      const wS = g.measureText(s).width;
      if (pass === 'shadow') { g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = size * 0.07 * fit; g.strokeText(s, xx + size * 0.02, base + size * 0.028); g.fillText(s, xx + size * 0.02, base + size * 0.028); }
      else if (pass === 'stroke') { g.strokeStyle = ink; g.lineWidth = size * 0.075 * fit; g.strokeText(s, xx, base); }
      else {
        g.fillStyle = '#ffe82e'; g.fillText(s, xx, base);
        // pixel highlight band on the upper part of the glyphs
        g.save(); g.beginPath(); g.rect(xx - 4, base - size * k * fit * 0.78, wS + 8, size * k * fit * 0.16); g.clip();
        g.fillStyle = '#fffbe0'; g.fillText(s, xx, base); g.restore();
      }
      xx += wS + gapX;
    }
  }
  return c;
}
