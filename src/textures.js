// Procedural canvas textures (all seeded, so every render is identical).
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { color = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// Soft mottling (blurred blobs, wrapped at the edges so it tiles), used for grime.
function noiseLayer(ctx, w, h, rnd, { cells = 32, alpha = 0.2, dark = true } = {}) {
  const n = cells * 3;
  ctx.save();
  ctx.filter = `blur(${Math.round(w / cells / 1.5)}px)`;
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = (w / cells) * (0.6 + rnd() * 1.4);
    ctx.fillStyle = dark ? `rgba(0,0,0,${rnd() * alpha})` : `rgba(255,255,255,${rnd() * alpha})`;
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function speckle(ctx, w, h, rnd, n, size, rgba) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgba(rnd());
    const s = size * (0.5 + rnd());
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

function blurred(ctx, w, h, px, draw) {
  ctx.save();
  ctx.filter = `blur(${px}px)`;
  draw();
  ctx.restore();
}

// Blue rexine: pebbled leatherette grain + quilting seams.
export function rexine() {
  const W = 1024;
  const rnd = mulberry32(11);
  const [c, g] = canvas(W);
  const [b, gb] = canvas(W);
  g.fillStyle = '#2a5294';
  g.fillRect(0, 0, W, W);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, W, W);
  // soft mottling
  blurred(g, W, W, 18, () => {
    for (let i = 0; i < 220; i++) {
      const v = rnd();
      g.fillStyle = v > 0.5 ? `rgba(70,120,190,${0.10 + 0.1 * rnd()})` : `rgba(12,30,70,${0.12 + 0.1 * rnd()})`;
      g.beginPath();
      g.arc(rnd() * W, rnd() * W, 20 + rnd() * 80, 0, Math.PI * 2);
      g.fill();
    }
  });
  // pebble grain
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * W;
    const y = rnd() * W;
    const r = 1.2 + rnd() * 2.6;
    const l = rnd();
    g.fillStyle = `rgba(${l > 0.5 ? '120,165,225' : '10,25,60'},${0.12 + rnd() * 0.12})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.7 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
    g.fill();
    gb.fillStyle = `rgba(${l > 0.5 ? '255,255,255' : '0,0,0'},${0.25 + rnd() * 0.2})`;
    gb.beginPath();
    gb.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    gb.fill();
  }
  // quilting seams (vertical in texture space = across the berth)
  for (let k = 1; k < 4; k++) {
    const x = (k / 4) * W;
    g.fillStyle = 'rgba(8,20,48,0.55)';
    g.fillRect(x - 3, 0, 6, W);
    gb.fillStyle = 'rgba(0,0,0,0.9)';
    gb.fillRect(x - 4, 0, 8, W);
    for (let y = 0; y < W; y += 18) {
      g.fillStyle = 'rgba(150,180,220,0.35)';
      g.fillRect(x - 9, y, 2, 9);
      g.fillRect(x + 7, y + 9, 2, 9);
    }
  }
  // grime
  noiseLayer(g, W, W, rnd, { cells: 24, alpha: 0.12 });
  return { map: tex(c), bump: tex(b, { color: false }) };
}

// Painted steel with rust blooms (window bars, berth frames, chain bracket).
export function rustySteel() {
  const W = 512;
  const rnd = mulberry32(23);
  const [c, g] = canvas(W);
  const [r, gr] = canvas(W);
  g.fillStyle = '#7d858a';
  g.fillRect(0, 0, W, W);
  gr.fillStyle = '#707070';
  gr.fillRect(0, 0, W, W);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * W;
    g.fillStyle = `rgba(${rnd() > 0.5 ? '200,205,210' : '40,44,48'},${0.05 + rnd() * 0.08})`;
    g.fillRect(0, y, W, 1 + rnd() * 2);
  }
  blurred(g, W, W, 4, () => {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      const y = rnd() * W;
      const s = 6 + rnd() * 34;
      g.fillStyle = `rgba(${110 + rnd() * 40},${48 + rnd() * 20},${20 + rnd() * 10},${0.5 + rnd() * 0.4})`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.4 + rnd()), rnd() * 3, 0, Math.PI * 2);
      g.fill();
      gr.fillStyle = 'rgba(255,255,255,0.8)';
      gr.beginPath();
      gr.ellipse(x, y, s, s * 0.8, 0, 0, Math.PI * 2);
      gr.fill();
    }
  });
  speckle(g, W, W, rnd, 3000, 1.5, (v) => `rgba(${v > 0.5 ? '90,40,18' : '30,30,30'},0.5)`);
  return { map: tex(c), rough: tex(r, { color: false }) };
}

// Pale saree cotton: fine weave, faint printed motifs.
export function sareeFabric() {
  const W = 512;
  const rnd = mulberry32(37);
  const [c, g] = canvas(W);
  const [b, gb] = canvas(W);
  g.fillStyle = '#d6d5c8';
  g.fillRect(0, 0, W, W);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, W, W);
  for (let y = 0; y < W; y += 2) {
    g.fillStyle = `rgba(120,125,110,${0.025 + rnd() * 0.03})`;
    g.fillRect(0, y, W, 1);
    gb.fillStyle = 'rgba(0,0,0,0.18)';
    gb.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 2) {
    gb.fillStyle = 'rgba(255,255,255,0.12)';
    gb.fillRect(x, 0, 1, W);
  }
  // soft printed buttas in muted sage / maroon
  g.save();
  g.filter = 'blur(1.5px)';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = rnd() * W;
    g.fillStyle = rnd() > 0.5 ? 'rgba(98,52,58,0.22)' : 'rgba(80,110,98,0.22)';
    g.beginPath();
    g.ellipse(x, y, 6, 10, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  noiseLayer(g, W, W, rnd, { cells: 8, alpha: 0.06 });
  return { map: tex(c, { repeat: [2, 2] }), bump: tex(b, { color: false, repeat: [2, 2] }) };
}

// Saree border strip (for the pallu edge).
export function sareeBorder() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#d8d6c9';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#8a7a4c';
  g.fillRect(0, 34, 256, 18);
  g.fillStyle = '#3f6a66';
  g.fillRect(0, 40, 256, 5);
  g.fillStyle = '#5d2b33';
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 54, 8, 6);
  return tex(c, { repeat: [6, 1] });
}

const BLANKETS = [
  ['#5a2a2c', '#7a4436', '#2e1c1c'],
  ['#3b4a4f', '#5e6b63', '#1f2a2d'],
  ['#4a3a2e', '#6e5a44', '#2a221b'],
  ['#2b3e52', '#3f5f74', '#18222e'],
];

// Railway-style blanket: wool fuzz, stripes, checks.
export function blanket(variant = 0) {
  const W = 512;
  const rnd = mulberry32(51 + variant);
  const [base, mid, dark] = BLANKETS[variant % BLANKETS.length];
  const [c, g] = canvas(W);
  g.fillStyle = base;
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 6; i++) {
    const y = (i / 6) * W;
    g.fillStyle = i % 2 ? mid : dark;
    g.globalAlpha = 0.7;
    g.fillRect(0, y, W, 14 + (i % 3) * 6);
    g.fillRect(y, 0, 10, W);
  }
  g.globalAlpha = 1;
  speckle(g, W, W, rnd, 20000, 1.2, (v) => `rgba(${v > 0.5 ? '255,240,220' : '0,0,0'},${0.05 + v * 0.06})`);
  noiseLayer(g, W, W, rnd, { cells: 20, alpha: 0.18 });
  return tex(c, { repeat: [2, 2] });
}

export function pillow() {
  const W = 256;
  const rnd = mulberry32(61);
  const [c, g] = canvas(W);
  g.fillStyle = '#c9d2dc';
  g.fillRect(0, 0, W, W);
  for (let y = 0; y < W; y += 12) {
    g.fillStyle = 'rgba(120,140,170,0.25)';
    g.fillRect(0, y, W, 2);
  }
  noiseLayer(g, W, W, rnd, { cells: 12, alpha: 0.15 });
  return tex(c);
}

// Grey-blue speckled vinyl floor with panel seams.
export function floor() {
  const W = 1024;
  const rnd = mulberry32(71);
  const [c, g] = canvas(W);
  g.fillStyle = '#4a5058';
  g.fillRect(0, 0, W, W);
  speckle(g, W, W, rnd, 40000, 2, (v) => `rgba(${v > 0.6 ? '200,205,210' : v > 0.3 ? '20,22,26' : '120,90,70'},${0.15 + v * 0.2})`);
  noiseLayer(g, W, W, rnd, { cells: 10, alpha: 0.2 });
  g.fillStyle = 'rgba(10,12,14,0.8)';
  g.fillRect(0, 0, W, 4);
  g.fillRect(0, 0, 4, W);
  return tex(c, { repeat: [6, 2] });
}

// Pale laminate wall panels with rivets and grime toward the bottom.
export function wallPanel() {
  const W = 512;
  const rnd = mulberry32(81);
  const [c, g] = canvas(W);
  g.fillStyle = '#aab6ab';
  g.fillRect(0, 0, W, W);
  noiseLayer(g, W, W, rnd, { cells: 18, alpha: 0.1 });

  g.fillStyle = 'rgba(40,46,44,0.28)';
  g.fillRect(0, 0, 2, W);
  for (let i = 12; i < W; i += 64) {
    g.fillStyle = 'rgba(70,74,70,0.7)';
    g.beginPath();
    g.arc(12, i, 3, 0, Math.PI * 2);
    g.arc(W - 12, i, 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

export function ceilingPanel() {
  const W = 512;
  const rnd = mulberry32(91);
  const [c, g] = canvas(W);
  g.fillStyle = '#c8ccc6';
  g.fillRect(0, 0, W, W);
  noiseLayer(g, W, W, rnd, { cells: 14, alpha: 0.08 });
  for (let i = 0; i < W; i += 128) {
    g.fillStyle = 'rgba(60,64,60,0.45)';
    g.fillRect(i, 0, 3, W);
  }
  for (let y = 20; y < W; y += 40) {
    for (let x = 20; x < W; x += 40) {
      g.fillStyle = 'rgba(80,84,80,0.25)';
      g.fillRect(x, y, 4, 4);
    }
  }
  return tex(c);
}

// Hair strands: dark with fine highlights along the strand (u across, v along).
export function hairStrands() {
  const [c, g] = canvas(128, 512);
  const rnd = mulberry32(101);
  g.fillStyle = '#0c0c10';
  g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 128;
    g.fillStyle = `rgba(${rnd() > 0.7 ? '90,95,110' : '30,30,38'},${0.25 + rnd() * 0.35})`;
    g.fillRect(x, 0, 1 + rnd(), 512);
  }
  return tex(c);
}

// Number plates for the berths (white on dark blue).
export function numberPlate(text) {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#1d2b44';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#c8ced8';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 120, 56);
  g.fillStyle = '#e8ecf2';
  g.font = '700 38px Inter';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 34);
  return tex(c);
}

// --- phone screens -------------------------------------------------------

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function warningIcon(g, cx, cy, s, color = '#ffb020') {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx, cy - s * 0.52);
  g.lineTo(cx + s * 0.58, cy + s * 0.46);
  g.lineTo(cx - s * 0.58, cy + s * 0.46);
  g.closePath();
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.lineWidth = s * 0.12;
  g.stroke();
  g.fill();
  g.fillStyle = '#1a1206';
  g.fillRect(cx - s * 0.055, cy - s * 0.2, s * 0.11, s * 0.36);
  g.beginPath();
  g.arc(cx, cy + s * 0.3, s * 0.07, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Lock screen drawn at phone-screen resolution. kind: 'lock' | 'alert'
export function phoneScreen(kind) {
  const W = 600;
  const H = 1300;
  const [c, g] = canvas(W, H);
  const rnd = mulberry32(131);
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#16324a');
  grad.addColorStop(0.55, '#0d1b2e');
  grad.addColorStop(1, '#2a1a2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  blurred(g, W, H, 30, () => {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? '60,140,150' : '150,80,90'},0.35)`;
      g.beginPath();
      g.arc(rnd() * W, H * (0.4 + rnd() * 0.6), 60 + rnd() * 120, 0, Math.PI * 2);
      g.fill();
    }
  });
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.textAlign = 'center';
  g.font = '600 34px Inter';
  g.fillText('Friday, 13 October', W / 2, 190);
  g.font = '700 190px Inter';
  g.fillText('2:47', W / 2 - 30, 380);
  g.font = '700 54px Inter';
  g.fillText('AM', W / 2 + 205, 376);
  // lock glyph
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(W / 2, 92, 14, Math.PI, 0);
  g.stroke();
  roundRect(g, W / 2 - 22, 92, 44, 34, 6);
  g.fill();
  if (kind === 'alert') {
    roundRect(g, 28, 470, W - 56, 210, 34);
    g.fillStyle = 'rgba(235,240,245,0.22)';
    g.fill();
    warningIcon(g, 86, 530, 54);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = '700 30px Inter';
    g.fillText('RAILWAY ALERT', 130, 542);
    g.font = '800 36px Inter';
    g.fillText('DO NOT LET IT SEE', 62, 610);
    g.fillText('YOUR PHONE.', 62, 652);
  }
  // bottom quick buttons
  for (const x of [90, W - 90]) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.arc(x, H - 120, 46, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  roundRect(g, W / 2 - 90, H - 26, 180, 8, 4);
  g.fill();
  const t = tex(c, { aniso: 16 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
