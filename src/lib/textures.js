// Procedural canvas textures (all seeded, so every render is identical).
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function tex(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// 2D value noise, tileable over `period` cells.
function makeNoise2(seed, period) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(period * period).map(() => rnd());
  const at = (x, y) => g[((y % period) + period) % period * period + (((x % period) + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function pixels(w, h, fn) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * w + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------- wood ----------
export function woodPlanks({ seed = 1, size = 1024, planks = 6, base = 0x8a5a33 } = {}) {
  const n = makeNoise2(seed, 64), n2 = makeNoise2(seed + 9, 16);
  const rnd = mulberry32(seed + 3);
  const tone = Array.from({ length: planks * 4 }, () => 0.82 + rnd() * 0.3);
  const offs = Array.from({ length: planks * 4 }, () => rnd());
  const B = hex(base), dark = mix(B, [40, 22, 12], 0.55);
  const ph = size / planks;
  const colorFn = (x, y, asBump) => {
    const row = Math.floor(y / ph);
    const len = size / 2;
    const seg = Math.floor((x / len + offs[row]) % 2);
    const id = row * 2 + seg;
    const local = (y % ph) / ph;
    const grain = Math.sin((local * 18 + n(x / 90 + id * 13, y / 22) * 5.5) * Math.PI) * 0.5 + 0.5;
    const fine = n(x / 6 + id * 5, y / 1.5) * 0.5 + n2(x / 40, y / 5) * 0.5;
    const edgeY = Math.min(local, 1 - local) * ph;
    const xe = ((x / len + offs[row]) % 1) * len;
    const edgeX = Math.min(xe, len - xe);
    const gap = edgeY < 1.5 || edgeX < 1.5 ? 1 : 0;
    if (asBump) { const v = gap ? 40 : 150 + grain * 50 + fine * 40; return [v, v, v]; }
    let c = mix(B, dark, grain * 0.45 + fine * 0.25);
    c = c.map((v) => v * tone[id % tone.length]);
    if (gap) c = c.map((v) => v * 0.35);
    return c;
  };
  return {
    map: tex(pixels(size, size, (x, y) => colorFn(x, y, false))),
    bump: tex(pixels(size / 2, size / 2, (x, y) => colorFn(x * 2, y * 2, true)), { srgb: false }),
  };
}

export function woodGrain({ seed = 2, size = 512, base = 0x9c6b3e, rings = 9 } = {}) {
  const n = makeNoise2(seed, 32);
  const B = hex(base), dark = mix(B, [45, 25, 12], 0.5);
  const c = pixels(size, size, (x, y) => {
    const g = Math.sin((y / size * rings + n(x / 70, y / 30) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
    const f = n(x / 3, y / 1.2) * 0.25;
    return mix(B, dark, g * 0.4 + f);
  });
  return tex(c);
}

// ---------- fabrics ----------
export function weave({ seed = 4, size = 512, base = 0x8e9196, contrast = 0.12, scale = 3 } = {}) {
  const n = makeNoise2(seed, 128);
  const B = hex(base);
  const f = (x, y) => {
    const wx = Math.sin((x / scale) * Math.PI) * Math.sin((y / scale) * Math.PI * 0.5);
    const wy = Math.sin((y / scale) * Math.PI) * Math.sin((x / scale) * Math.PI * 0.5);
    return (wx * wx - wy * wy) * 0.5 + n(x / 18, y / 18) * 0.6 - 0.3;
  };
  return {
    map: tex(pixels(size, size, (x, y) => B.map((v) => v * (1 + f(x, y) * contrast))), { repeat: [4, 4] }),
    bump: tex(pixels(size, size, (x, y) => { const v = 128 + f(x, y) * 100; return [v, v, v]; }), { srgb: false, repeat: [4, 4] }),
  };
}

export function knit({ seed = 5, size = 256, base = 0xe9dfcb, rib = 8 } = {}) {
  const n = makeNoise2(seed, 32);
  const B = hex(base);
  const f = (x, y) => {
    const col = (x % rib) / rib;
    const v = Math.abs(((y / (rib * 0.7) + Math.abs(col - 0.5) * 1.4) % 1) - 0.5) * 2;
    return v * 0.8 + n(x / 9, y / 9) * 0.3;
  };
  return {
    map: tex(pixels(size, size, (x, y) => B.map((v) => v * (0.86 + f(x, y) * 0.2))), { repeat: [6, 6] }),
    bump: tex(pixels(size, size, (x, y) => { const v = 60 + f(x, y) * 170; return [v, v, v]; }), { srgb: false, repeat: [6, 6] }),
  };
}

export function denim({ seed = 6, size = 256, base = 0x3e5c86 } = {}) {
  const n = makeNoise2(seed, 64);
  const B = hex(base), L = mix(B, [200, 210, 225], 0.35);
  return tex(pixels(size, size, (x, y) => {
    const tw = (Math.sin(((x + y) / 2.2) * Math.PI) * 0.5 + 0.5) * 0.35;
    return mix(B, L, tw * 0.5 + n(x / 7, y / 40) * 0.35);
  }), { repeat: [3, 3] });
}

export function fleece({ seed = 7, size = 256, base = 0xd99a2b } = {}) {
  const n = makeNoise2(seed, 64);
  const B = hex(base);
  return tex(pixels(size, size, (x, y) => B.map((v) => v * (0.9 + n(x / 3, y / 3) * 0.12 + n(x / 20, y / 20) * 0.08))), { repeat: [3, 3] });
}

export function plaster({ seed = 8, size = 256, base = 0x8a9a9b, amt = 0.06 } = {}) {
  const n = makeNoise2(seed, 64);
  const B = hex(base);
  return tex(pixels(size, size, (x, y) => B.map((v) => v * (1 - amt + (n(x / 12, y / 12) * 0.6 + n(x / 3, y / 3) * 0.4) * amt * 2))), { repeat: [3, 2] });
}

// ---------- rug ----------
export function rug({ seed = 9, w = 1024, h = 728 } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#e6d9bf'; g.fillRect(0, 0, w, h);
  const teal = '#5e8c8a', amber = '#c98f3a', cream = '#efe4cc', dark = '#3f5f5d';
  const b = 54;
  g.strokeStyle = teal; g.lineWidth = 26; g.strokeRect(b, b, w - 2 * b, h - 2 * b);
  g.strokeStyle = amber; g.lineWidth = 8; g.strokeRect(b + 30, b + 30, w - 2 * b - 60, h - 2 * b - 60);
  // diamond field
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 4; i++) {
    const s = 230 - i * 52;
    g.beginPath(); g.moveTo(cx, cy - s * 0.75); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s * 0.75); g.lineTo(cx - s, cy); g.closePath();
    g.fillStyle = [teal, cream, amber, dark][i]; g.fill();
  }
  // small motifs along the inner border
  g.fillStyle = dark;
  for (let x = b + 70; x < w - b - 60; x += 46) { g.fillRect(x, b + 52, 14, 14); g.fillRect(x, h - b - 66, 14, 14); }
  // fibre noise
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const n = makeNoise2(seed, 128), rnd = mulberry32(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const k = 0.9 + n(x / 2.5, y / 2.5) * 0.14 + (rnd() - 0.5) * 0.06;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: [1, 1] });
}

// ---------- tiles ----------
export function subwayTiles({ seed = 10, w = 1024, h = 512, rows = 8, cols = 6 } = {}) {
  const n = makeNoise2(seed, 64);
  const rnd = mulberry32(seed);
  const tint = Array.from({ length: rows * (cols + 1) }, () => 0.94 + rnd() * 0.08);
  const th = h / rows, tw = w / cols, grout = 3.5;
  const f = (x, y, bump) => {
    const r = Math.floor(y / th);
    const xo = x + (r % 2) * tw / 2;
    const cIdx = Math.floor(xo / tw);
    const lx = xo % tw, ly = y % th;
    const e = Math.min(lx, tw - lx, ly, th - ly);
    if (e < grout) return bump ? [30, 30, 30] : [196, 186, 168];
    const bev = Math.min(1, (e - grout) / 7);
    if (bump) { const v = 120 + bev * 120; return [v, v, v]; }
    const k = tint[(r * (cols + 1) + cIdx) % tint.length] * (0.97 + n(x / 25, y / 25) * 0.05);
    return [238 * k, 230 * k, 214 * k].map((v) => v * (0.9 + bev * 0.1));
  };
  return { map: tex(pixels(w, h, (x, y) => f(x, y, false))), bump: tex(pixels(w / 2, h / 2, (x, y) => f(x * 2, y * 2, true)), { srgb: false }) };
}

export function floorTiles({ seed = 11, size = 512, n: count = 4 } = {}) {
  const nz = makeNoise2(seed, 64);
  const ts = size / count;
  return tex(pixels(size, size, (x, y) => {
    const lx = x % ts, ly = y % ts;
    const e = Math.min(lx, ts - lx, ly, ts - ly);
    if (e < 2) return [120, 112, 102];
    const chk = (Math.floor(x / ts) + Math.floor(y / ts)) % 2 ? 1 : 0.93;
    const k = chk * (0.95 + nz(x / 30, y / 30) * 0.08);
    return [196 * k, 186 * k, 172 * k];
  }), { repeat: [3, 3] });
}

// ---------- metal ----------
export function brushed({ seed = 12, size = 256, base = 0xc8ccd0 } = {}) {
  const rnd = mulberry32(seed);
  const rowv = Array.from({ length: size }, () => rnd());
  const n = makeNoise2(seed, 32);
  const B = hex(base);
  const f = (x, y) => rowv[y] * 0.35 + n(x / 60, y / 2) * 0.65;
  return {
    map: tex(pixels(size, size, (x, y) => B.map((v) => v * (0.93 + f(x, y) * 0.08)))),
    rough: tex(pixels(size, size, (x, y) => { const v = 85 + f(x, y) * 45; return [v, v, v]; }), { srgb: false }),
  };
}

// ---------- windows / pictures ----------
export function nightYard({ w = 512, h = 512, seed = 13, fence = true } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0b1426'); sky.addColorStop(0.6, '#13233c'); sky.addColorStop(1, '#0a0f18');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const moon = g.createRadialGradient(w * 0.72, h * 0.22, 2, w * 0.72, h * 0.22, w * 0.3);
  moon.addColorStop(0, 'rgba(200,215,255,0.55)'); moon.addColorStop(0.08, 'rgba(170,190,240,0.25)'); moon.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = moon; g.fillRect(0, 0, w, h);
  g.fillStyle = '#dfe8ff'; g.beginPath(); g.arc(w * 0.72, h * 0.22, w * 0.035, 0, Math.PI * 2); g.fill();
  const rnd = mulberry32(seed);
  g.fillStyle = '#05080e';
  for (let i = 0; i < 7; i++) { // tree blobs
    const x = rnd() * w, r = 40 + rnd() * 70, y = h * 0.55 - rnd() * 60;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 5, y, 10, h);
  }
  g.fillRect(0, h * 0.62, w, h);
  if (fence) {
    g.fillStyle = '#0d1420';
    for (let x = 0; x < w; x += 26) g.fillRect(x, h * 0.6, 18, h * 0.4);
    g.fillRect(0, h * 0.66, w, 8);
  }
  return tex(c);
}

export function familyPhoto({ w = 384, h = 480 } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f0d9a8'); bg.addColorStop(1, '#c98f5a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const person = (x, y, s, hair, shirt, pony) => {
    g.fillStyle = shirt; g.beginPath(); g.ellipse(x, y + 150 * s, 95 * s, 120 * s, 0, Math.PI, 0); g.fill();
    g.fillRect(x - 95 * s, y + 150 * s, 190 * s, 200 * s);
    g.fillStyle = '#f1c6a0'; g.beginPath(); g.arc(x, y, 62 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(x, y - 12 * s, 66 * s, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    if (pony) { g.beginPath(); g.ellipse(x + 62 * s, y + 10 * s, 18 * s, 45 * s, -0.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2b1d16';
    g.beginPath(); g.arc(x - 22 * s, y + 2 * s, 8 * s, 0, Math.PI * 2); g.arc(x + 22 * s, y + 2 * s, 8 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a3b2e'; g.lineWidth = 5 * s; g.beginPath(); g.arc(x, y + 22 * s, 20 * s, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  };
  person(w * 0.36, h * 0.38, 1.0, '#6b3f26', '#e9dfcb', true);
  person(w * 0.68, h * 0.52, 0.8, '#3b2618', '#d99a2b', false);
  return tex(c);
}

export function clockFace({ size = 512 } = {}) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  g.fillStyle = '#f3ecdc'; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2a2a';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    g.lineWidth = big ? 9 : 3;
    g.beginPath();
    g.moveTo(r + Math.sin(a) * r * (big ? 0.78 : 0.86), r - Math.cos(a) * r * (big ? 0.78 : 0.86));
    g.lineTo(r + Math.sin(a) * r * 0.92, r - Math.cos(a) * r * 0.92);
    g.stroke();
  }
  g.fillStyle = '#2a2a2a';
  g.font = `${Math.round(size * 0.1)}px Anton`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillText(String(i), r + Math.sin(a) * r * 0.64, r - Math.cos(a) * r * 0.64);
  }
  return tex(c);
}

export function radialSprite({ size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', soft = 0.0 } = {}) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * soft * 0.5, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = tex(c, { srgb: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export { canvas, makeNoise2 };
