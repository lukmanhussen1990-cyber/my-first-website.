// Procedural canvas textures. Everything is drawn in code with a seeded RNG so
// every render is identical.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, mulberry32, roundRect } from './util.js';

export const PAL = {
  navy: '#0b1524',
  navyDeep: '#060b14',
  teal: '#0f4c52',
  tealLight: '#5fb3ad',
  aqua: '#a6d3cc',
  cream: '#f1e8d6',
  amber: '#f5a23b',
  amberDeep: '#d9771f',
  sodium: '#ff9a3d',
  steel: '#b9c2c9',
  red: '#D7263D',
};

function noiseFill(ctx, w, h, rng, alpha, size = 1, color = '0,0,0') {
  for (let i = 0; i < (w * h) / (size * size * 6); i++) {
    ctx.fillStyle = `rgba(${color},${alpha * rng()})`;
    ctx.fillRect(rng() * w, rng() * h, size, size);
  }
}

function blot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- floor: checker tiles (cold white / deep teal) + roughness ----------
export function floorTextures() {
  const N = 8;
  const S = 1024;
  const T = S / N;
  const rng = mulberry32(11);
  const [c, ctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  ctx.fillStyle = '#3a3f40';
  ctx.fillRect(0, 0, S, S);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, S, S);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const dark = (i + j) % 2 === 1;
      const v = (rng() - 0.5) * 10;
      ctx.fillStyle = dark ? `rgb(${14 + v},${66 + v},${72 + v})` : `rgb(${214 + v},${219 + v},${210 + v})`;
      ctx.fillRect(i * T + 2, j * T + 2, T - 4, T - 4);
      const rough = 34 + rng() * 30;
      rctx.fillStyle = `rgb(${rough},${rough},${rough})`;
      rctx.fillRect(i * T + 2, j * T + 2, T - 4, T - 4);
    }
  }
  // grime, scuffs, mop streaks
  for (let k = 0; k < 90; k++) {
    blot(ctx, rng() * S, rng() * S, 20 + rng() * 90, `rgba(40,45,40,${0.05 + rng() * 0.08})`);
  }
  ctx.lineCap = 'round';
  for (let k = 0; k < 60; k++) {
    ctx.strokeStyle = `rgba(20,25,25,${0.05 + rng() * 0.12})`;
    ctx.lineWidth = 1 + rng() * 3;
    const x = rng() * S;
    const y = rng() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 40, x + (rng() - 0.5) * 200, y + (rng() - 0.5) * 60);
    ctx.stroke();
  }
  noiseFill(ctx, S, S, rng, 0.25, 2);
  // wet patches: lower roughness
  for (let k = 0; k < 26; k++) blot(rctx, rng() * S, rng() * S, 60 + rng() * 160, `rgba(10,10,10,${0.25 + rng() * 0.35})`);
  return { map: canvasTexture(c, { repeat: [1, 1] }), roughness: canvasTexture(rc, { srgb: false, repeat: [1, 1] }) };
}

// ---------- wall tiles (small, pale aqua) ----------
export function wallTileTextures() {
  const S = 512;
  const N = 8;
  const T = S / N;
  const rng = mulberry32(21);
  const [c, ctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  ctx.fillStyle = '#7f9c98';
  ctx.fillRect(0, 0, S, S);
  rctx.fillStyle = '#b0b0b0';
  rctx.fillRect(0, 0, S, S);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = (rng() - 0.5) * 14;
      ctx.fillStyle = `rgb(${120 + v},${178 + v},${170 + v})`;
      ctx.fillRect(i * T + 2, j * T + 2, T - 4, T - 4);
      const g = ctx.createLinearGradient(i * T, j * T, i * T + T, j * T + T);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = g;
      ctx.fillRect(i * T + 2, j * T + 2, T - 4, T - 4);
      rctx.fillStyle = `rgb(${40 + rng() * 25},${40 + rng() * 25},${40 + rng() * 25})`;
      rctx.fillRect(i * T + 2, j * T + 2, T - 4, T - 4);
    }
  }
  for (let k = 0; k < 20; k++) blot(ctx, rng() * S, S * (0.6 + rng() * 0.4), 30 + rng() * 60, `rgba(60,50,30,${0.05 + rng() * 0.06})`);
  noiseFill(ctx, S, S, rng, 0.15, 1);
  return { map: canvasTexture(c), roughness: canvasTexture(rc, { srgb: false }) };
}

// ---------- painted upper wall ----------
export function paintTexture() {
  const S = 512;
  const rng = mulberry32(31);
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#d8d6c8';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 40; k++) blot(ctx, rng() * S, rng() * S, 40 + rng() * 120, `rgba(${110 + rng() * 40},${110 + rng() * 30},90,${0.03 + rng() * 0.05})`);
  noiseFill(ctx, S, S, rng, 0.08, 2);
  return canvasTexture(c);
}

// ---------- drop ceiling ----------
export function ceilingTexture() {
  const S = 512;
  const rng = mulberry32(41);
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#9da19c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = `rgb(${196 + rng() * 10},${200 + rng() * 8},${193 + rng() * 8})`;
      ctx.fillRect(i * 256 + 6, j * 256 + 6, 244, 244);
    }
  }
  noiseFill(ctx, S, S, rng, 0.35, 2, '70,70,70');
  for (let k = 0; k < 5; k++) blot(ctx, rng() * S, rng() * S, 30 + rng() * 50, 'rgba(140,110,60,0.18)');
  return canvasTexture(c);
}

// ---------- owl logo ----------
export function drawOwl(ctx, cx, cy, r, { body = PAL.cream, eye = PAL.amber, pupil = PAL.navy, ring = PAL.amber, bg = PAL.navy } = {}) {
  ctx.save();
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2);
    ctx.stroke();
  }
  // head + ear tufts
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 0.15);
  ctx.lineTo(cx - r * 0.62, cy - r * 0.62);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.42);
  ctx.quadraticCurveTo(cx, cy - r * 0.5, cx + r * 0.25, cy - r * 0.42);
  ctx.lineTo(cx + r * 0.62, cy - r * 0.62);
  ctx.lineTo(cx + r * 0.55, cy - r * 0.15);
  ctx.quadraticCurveTo(cx + r * 0.62, cy + r * 0.55, cx, cy + r * 0.66);
  ctx.quadraticCurveTo(cx - r * 0.62, cy + r * 0.55, cx - r * 0.55, cy - r * 0.15);
  ctx.fill();
  // eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(cx + s * r * 0.24, cy - r * 0.06, r * 0.21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.arc(cx + s * r * 0.24, cy - r * 0.04, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // beak
  ctx.fillStyle = PAL.amberDeep;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.08, cy + r * 0.13);
  ctx.lineTo(cx + r * 0.08, cy + r * 0.13);
  ctx.lineTo(cx, cy + r * 0.3);
  ctx.fill();
  ctx.restore();
}

export function logoTexture({ mirrored = false, glow = false } = {}) {
  const [c, ctx] = makeCanvas(1024, 512);
  if (mirrored) {
    ctx.translate(1024, 0);
    ctx.scale(-1, 1);
  }
  if (glow) {
    ctx.shadowColor = PAL.amber;
    ctx.shadowBlur = 24;
  }
  drawOwl(ctx, 200, 256, 170, { bg: glow ? PAL.navy : 'rgba(0,0,0,0)', ring: PAL.amber });
  ctx.fillStyle = PAL.cream;
  ctx.font = '150px Anton';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('NIGHT OWL', 400, 270);
  ctx.fillStyle = PAL.amber;
  ctx.font = '96px Anton';
  ctx.fillText('BURGERS', 404, 390);
  ctx.font = '40px Oswald';
  ctx.fillStyle = PAL.tealLight;
  ctx.fillText('OPEN 24 HOURS', 690, 380);
  return canvasTexture(c);
}

// ---------- menu boards ----------
function burgerIcon(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#e9a94e';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.18, s * 0.5, s * 0.3, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#5fb3ad';
  ctx.fillRect(-s * 0.52, -s * 0.2, s * 1.04, s * 0.1);
  ctx.fillStyle = '#6b3a22';
  roundRect(ctx, -s * 0.5, -s * 0.11, s, s * 0.18, s * 0.08);
  ctx.fill();
  ctx.fillStyle = '#f5c542';
  ctx.fillRect(-s * 0.48, -s * 0.13, s * 0.96, s * 0.05);
  ctx.fillStyle = '#e9a94e';
  roundRect(ctx, -s * 0.48, s * 0.09, s * 0.96, s * 0.16, s * 0.08);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-s * 0.3 + i * s * 0.12, -s * 0.36 + (i % 2) * s * 0.06, s * 0.03, s * 0.015);
  ctx.restore();
}

function friesIcon(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f5c542';
  for (let i = 0; i < 7; i++) {
    ctx.save();
    ctx.rotate((i - 3) * 0.08);
    ctx.fillRect(-s * 0.04 + (i - 3) * s * 0.07, -s * 0.55, s * 0.07, s * 0.5);
    ctx.restore();
  }
  ctx.fillStyle = PAL.teal;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.15);
  ctx.lineTo(s * 0.32, -s * 0.15);
  ctx.lineTo(s * 0.24, s * 0.35);
  ctx.lineTo(-s * 0.24, s * 0.35);
  ctx.fill();
  drawOwl(ctx, 0, s * 0.1, s * 0.14, { bg: null, ring: null });
  ctx.restore();
}

function shakeIcon(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f3ead8';
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.26, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = PAL.tealLight;
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, -s * 0.28);
  ctx.lineTo(s * 0.28, -s * 0.28);
  ctx.lineTo(s * 0.2, s * 0.4);
  ctx.lineTo(-s * 0.2, s * 0.4);
  ctx.fill();
  ctx.strokeStyle = PAL.amber;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.05, -s * 0.5);
  ctx.lineTo(s * 0.18, -s * 0.85);
  ctx.stroke();
  ctx.restore();
}

const MENUS = [
  { title: 'BURGERS', icon: burgerIcon, items: [['HOOT BURGER', '5.99'], ['DOUBLE HOOT', '7.49'], ['MIDNIGHT MELT', '6.29'], ['NIGHT CRAWLER', '6.99']] },
  { title: 'COMBOS', icon: friesIcon, items: [['OWL FRIES', '2.49'], ['NIGHT NUGGETS', '4.29'], ['ONION RINGS', '2.99'], ['COMBO MEAL +', '3.50']] },
  { title: 'SHAKES', icon: shakeIcon, items: [['VANILLA MOON', '3.49'], ['MINT FOG', '3.49'], ['CARAMEL DUSK', '3.79'], ['COFFEE  (24/7)', '1.29']] },
];

export function menuBoardCanvas(i) {
  const W = 1024;
  const H = 592;
  const m = MENUS[i % MENUS.length];
  const [c, ctx] = makeCanvas(W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#13233a');
  bg.addColorStop(1, '#08111f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.amber;
  ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = PAL.navy;
  ctx.font = '88px Anton';
  ctx.fillText(m.title, 40, 92);
  drawOwl(ctx, W - 70, 55, 44, { bg: PAL.navy, ring: PAL.cream });
  m.items.forEach(([name, price], k) => {
    const y = 200 + k * 96;
    ctx.fillStyle = PAL.cream;
    ctx.font = '58px Anton';
    ctx.fillText(name, 40, y);
    ctx.fillStyle = PAL.amber;
    ctx.textAlign = 'right';
    ctx.fillText(price, 640, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(241,232,214,0.25)';
    ctx.fillRect(40, y + 16, 600, 3);
  });
  m.icon(ctx, 840, 360, 260);
  ctx.fillStyle = 'rgba(95,179,173,0.9)';
  ctx.font = '34px Oswald';
  ctx.fillText('ALWAYS OPEN. ALWAYS HERE.', 40, H - 30);
  return c;
}

// Her face, as the menu screens show it for 3 frames at the very end.
export function faceScreenCanvas() {
  const W = 1024;
  const H = 592;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2 + 30);
  // hair
  ctx.fillStyle = '#07080b';
  ctx.beginPath();
  ctx.ellipse(0, -10, 230, 330, 0, 0, Math.PI * 2);
  ctx.fill();
  // face
  const skin = ctx.createRadialGradient(0, -40, 20, 0, 0, 230);
  skin.addColorStop(0, '#f1eee8');
  skin.addColorStop(1, '#b9b7b6');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 165, 225, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  for (const s of [-1, 1]) {
    blot(ctx, s * 62, -50, 70, 'rgba(70,45,60,0.55)');
    ctx.fillStyle = '#fbfbf6';
    ctx.beginPath();
    ctx.arc(s * 62, -50, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(s * 62, -48, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // smile
  drawSmile(ctx, 0, 70, 260, 1);
  ctx.restore();
  // scanlines + glitch
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(0,200,220,0.08)';
  ctx.fillRect(0, 0, W, H);
  return c;
}

// Huge frozen grin: dark crescent, rows of teeth, pale lips. (x, y) = mouth centre, w = width.
export function drawSmile(ctx, x, y, w, sharp = 1) {
  const h = w * 0.36;
  ctx.save();
  ctx.translate(x, y);
  const mouth = new Path2D();
  mouth.moveTo(-w / 2, -h * 0.35);
  mouth.bezierCurveTo(-w * 0.2, h * 0.05, w * 0.2, h * 0.05, w / 2, -h * 0.35);
  mouth.bezierCurveTo(w * 0.3, h * 0.95, -w * 0.3, h * 0.95, -w / 2, -h * 0.35);
  mouth.closePath();
  ctx.fillStyle = '#1a0a0e';
  ctx.fill(mouth);
  ctx.save();
  ctx.clip(mouth);
  // gums
  ctx.strokeStyle = '#4d2530';
  ctx.lineWidth = h * 0.16;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.35);
  ctx.bezierCurveTo(-w * 0.2, h * 0.05, w * 0.2, h * 0.05, w / 2, -h * 0.35);
  ctx.stroke();
  // upper teeth
  ctx.fillStyle = '#f2efe6';
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.3);
  ctx.bezierCurveTo(-w * 0.2, h * 0.12, w * 0.2, h * 0.12, w / 2, -h * 0.3);
  ctx.bezierCurveTo(w * 0.2, h * 0.42, -w * 0.2, h * 0.42, -w / 2, -h * 0.3);
  ctx.fill();
  // lower teeth
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, h * 0.2);
  ctx.bezierCurveTo(-w * 0.15, h * 0.62, w * 0.15, h * 0.62, w * 0.38, h * 0.2);
  ctx.bezierCurveTo(w * 0.2, h * 0.82, -w * 0.2, h * 0.82, -w * 0.38, h * 0.2);
  ctx.fill();
  // tooth gaps
  ctx.strokeStyle = 'rgba(60,40,40,0.55)';
  ctx.lineWidth = Math.max(1.5, w * 0.008 * sharp);
  for (let i = -9; i <= 9; i++) {
    const tx = i * w * 0.05;
    const top = -h * 0.3 + (Math.abs(tx) / (w / 2)) ** 2 * -h * 0.05 + h * 0.32 * (1 - (tx / (w / 2)) ** 2);
    ctx.beginPath();
    ctx.moveTo(tx, top - h * 0.12);
    ctx.lineTo(tx * 1.02, top + h * 0.38);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(150,120,125,0.9)';
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.stroke(mouth);
  // cheek creases
  ctx.strokeStyle = 'rgba(120,90,100,0.35)';
  ctx.lineWidth = Math.max(2, w * 0.01);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * w * 0.56, -h * 0.4, w * 0.08, s > 0 ? Math.PI * 0.6 : Math.PI * 0.1, s > 0 ? Math.PI * 1.1 : Math.PI * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- face decals (projected onto the heads) ----------
// Her face: decal covering x,y in [-0.12, 0.12] m of head space (512 px).
export function herFaceTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const px = (x) => ((x + 0.12) / 0.24) * S;
  const py = (y) => ((0.12 - y) / 0.24) * S;
  // sunken eye sockets
  for (const s of [-1, 1]) {
    blot(ctx, px(s * 0.042), py(0.02), 62, 'rgba(70,40,62,0.62)');
    blot(ctx, px(s * 0.042), py(-0.006), 46, 'rgba(90,60,80,0.35)');
  }
  // thin high brows
  ctx.strokeStyle = 'rgba(30,22,28,0.85)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(px(s * 0.018), py(0.066));
    ctx.quadraticCurveTo(px(s * 0.045), py(0.09), px(s * 0.075), py(0.07));
    ctx.stroke();
  }
  // nose
  ctx.fillStyle = 'rgba(120,95,100,0.5)';
  ctx.beginPath();
  ctx.arc(px(-0.007), py(-0.02), 3, 0, Math.PI * 2);
  ctx.arc(px(0.007), py(-0.02), 3, 0, Math.PI * 2);
  ctx.fill();
  drawSmile(ctx, px(0), py(-0.052), (0.158 / 0.24) * S, 1.2);
  return canvasTexture(c, { mipmaps: true });
}

// Boy face decal: x,y in [-0.14, 0.14] m (512 px). Mouth expressions swap per shot.
export function boyFaceTextures() {
  const S = 512;
  const px = (x) => ((x + 0.14) / 0.28) * S;
  const py = (y) => ((0.14 - y) / 0.28) * S;
  const base = (ctx) => {
    for (const s of [-1, 1]) blot(ctx, px(s * 0.083), py(-0.035), 46, 'rgba(235,120,95,0.28)');
    ctx.fillStyle = 'rgba(150,85,55,0.45)';
    const rng = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const s = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.arc(px(s * (0.035 + rng() * 0.06)), py(-0.01 - rng() * 0.04), 2 + rng() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const draw = (fn) => {
    const [c, ctx] = makeCanvas(S, S);
    base(ctx);
    ctx.lineCap = 'round';
    fn(ctx);
    return canvasTexture(c);
  };
  const mx = px(0);
  const my = py(-0.068);
  return {
    neutral: draw((ctx) => {
      ctx.strokeStyle = '#5a2c22';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(mx - 34, my - 4);
      ctx.quadraticCurveTo(mx, my + 14, mx + 34, my - 4);
      ctx.stroke();
    }),
    tense: draw((ctx) => {
      ctx.strokeStyle = '#5a2c22';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(mx - 30, my + 6);
      ctx.quadraticCurveTo(mx, my - 6, mx + 30, my + 6);
      ctx.stroke();
    }),
    scared: draw((ctx) => {
      ctx.fillStyle = '#3a1512';
      ctx.beginPath();
      ctx.ellipse(mx, my + 6, 24, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f3efe6';
      ctx.fillRect(mx - 16, my - 22, 32, 9);
      ctx.strokeStyle = '#7a3a30';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(mx, my + 6, 24, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
    }),
    gasp: draw((ctx) => {
      ctx.fillStyle = '#3a1512';
      ctx.beginPath();
      ctx.ellipse(mx, my + 4, 18, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
  };
}

// ---------- street ----------
export function asphaltTextures() {
  const S = 1024;
  const rng = mulberry32(51);
  const [c, ctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  ctx.fillStyle = '#1d2129';
  ctx.fillRect(0, 0, S, S);
  noiseFill(ctx, S, S, rng, 0.5, 2, '120,125,135');
  noiseFill(ctx, S, S, rng, 0.6, 2, '0,0,0');
  for (let k = 0; k < 30; k++) blot(ctx, rng() * S, rng() * S, 40 + rng() * 140, `rgba(0,0,0,${0.1 + rng() * 0.15})`);
  ctx.strokeStyle = 'rgba(5,6,8,0.7)';
  for (let k = 0; k < 14; k++) {
    ctx.lineWidth = 1 + rng() * 2;
    let x = rng() * S;
    let y = rng() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (rng() - 0.5) * 70;
      y += (rng() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  rctx.fillStyle = '#a0a0a0';
  rctx.fillRect(0, 0, S, S);
  noiseFill(rctx, S, S, rng, 0.4, 3, '255,255,255');
  for (let k = 0; k < 22; k++) blot(rctx, rng() * S, rng() * S, 60 + rng() * 200, `rgba(0,0,0,${0.5 + rng() * 0.4})`);
  return { map: canvasTexture(c), roughness: canvasTexture(rc, { srgb: false }) };
}

export function concreteTexture() {
  const S = 512;
  const rng = mulberry32(61);
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#5b6068';
  ctx.fillRect(0, 0, S, S);
  noiseFill(ctx, S, S, rng, 0.35, 2, '200,200,210');
  noiseFill(ctx, S, S, rng, 0.35, 2, '0,0,0');
  for (let k = 0; k < 12; k++) blot(ctx, rng() * S, rng() * S, 30 + rng() * 90, `rgba(10,10,15,${0.1 + rng() * 0.15})`);
  ctx.strokeStyle = 'rgba(15,15,20,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, S - 4, S - 4);
  return canvasTexture(c);
}

export function facadeTexture(seed, { shop = 'LAUNDROMAT', lit = 0.2 } = {}) {
  const W = 1024;
  const H = 1024;
  const rng = mulberry32(seed);
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = seed % 2 ? '#1c2232' : '#241e26';
  ctx.fillRect(0, 0, W, H);
  // bricks
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < H * 0.62; y += 18) {
    for (let x = (y / 18) % 2 ? 0 : 20; x < W; x += 40) ctx.fillRect(x, y, 38, 2);
    ctx.fillRect(0, y, W, 2);
  }
  // upper windows
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 70 + col * 240;
      const y = 60 + row * 200;
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(x - 8, y - 8, 136, 156);
      const on = rng() < lit;
      ctx.fillStyle = on ? (rng() < 0.5 ? '#e7b36a' : '#7fb8c9') : '#10161f';
      ctx.fillRect(x, y, 120, 140);
      if (on) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 10 + rng() * 60, y, 40, 140);
      }
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(x + 57, y, 6, 140);
    }
  }
  // closed shop shutter
  const sy = H * 0.66;
  ctx.fillStyle = '#3a404a';
  ctx.fillRect(40, sy, W - 80, H - sy - 20);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = sy; y < H - 20; y += 12) ctx.fillRect(40, y, W - 80, 3);
  ctx.fillStyle = '#12161e';
  ctx.fillRect(40, sy - 70, W - 80, 64);
  ctx.fillStyle = 'rgba(120,140,150,0.55)';
  ctx.font = '52px Anton';
  ctx.fillText(shop, 70, sy - 20);
  // graffiti tag
  ctx.strokeStyle = 'rgba(95,179,173,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(300, H - 120);
  ctx.bezierCurveTo(360, H - 220, 420, H - 40, 480, H - 160);
  ctx.bezierCurveTo(520, H - 230, 560, H - 70, 610, H - 140);
  ctx.stroke();
  return canvasTexture(c);
}

export function skyTexture() {
  const [c, ctx] = makeCanvas(64, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#02040a');
  g.addColorStop(0.55, '#0a1424');
  g.addColorStop(0.85, '#1d2433');
  g.addColorStop(1, '#3a2c2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);
  return canvasTexture(c, { mipmaps: false });
}

// ---------- misc ----------
export function brushedTexture() {
  const S = 512;
  const rng = mulberry32(71);
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(90 + rng() * 90);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.fillRect(rng() * S, rng() * S, 40 + rng() * 260, 1);
  }
  for (let k = 0; k < 8; k++) blot(ctx, rng() * S, rng() * S, 40 + rng() * 80, 'rgba(160,160,160,0.15)');
  return canvasTexture(c, { srgb: false });
}

export function glassSmudgeTexture() {
  const S = 512;
  const rng = mulberry32(81);
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 40; k++) blot(ctx, rng() * S, rng() * S, 20 + rng() * 70, `rgba(255,255,255,${0.04 + rng() * 0.1})`);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let k = 0; k < 30; k++) {
    ctx.lineWidth = 6 + rng() * 14;
    const x = rng() * S;
    const y = rng() * S;
    ctx.beginPath();
    ctx.arc(x, y, 20 + rng() * 40, rng() * 6, rng() * 6 + 2);
    ctx.stroke();
  }
  return canvasTexture(c, { srgb: false });
}

export function breathTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const rng = mulberry32(91);
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 60; k++) blot(ctx, rng() * S, rng() * S, 8 + rng() * 20, 'rgba(0,0,0,0.25)');
  return canvasTexture(c);
}

export function clockTexture(hours = 2, minutes = 58) {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#f3efe4';
  ctx.beginPath();
  ctx.arc(256, 256, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.teal;
  ctx.lineWidth = 22;
  ctx.stroke();
  ctx.fillStyle = PAL.navy;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(256 + Math.sin(a) * 200, 256 - Math.cos(a) * 200);
    ctx.rotate(a);
    ctx.fillRect(-5, -18, 10, 36);
    ctx.restore();
  }
  drawOwl(ctx, 256, 360, 46, { bg: null, ring: null, body: PAL.teal });
  const hand = (a, len, w) => {
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(a);
    ctx.fillStyle = PAL.navy;
    roundRect(ctx, -w / 2, -len, w, len + 20, w / 2);
    ctx.fill();
    ctx.restore();
  };
  hand(((hours % 12) + minutes / 60) / 12 * Math.PI * 2, 120, 16);
  hand((minutes / 60) * Math.PI * 2, 190, 10);
  ctx.fillStyle = PAL.amberDeep;
  ctx.beginPath();
  ctx.arc(256, 256, 14, 0, Math.PI * 2);
  ctx.fill();
  return canvasTexture(c);
}

export function posterTexture(kind) {
  const [c, ctx] = makeCanvas(512, 720);
  if (kind === 0) {
    ctx.fillStyle = PAL.teal;
    ctx.fillRect(0, 0, 512, 720);
    burgerIcon(ctx, 256, 330, 360);
    ctx.fillStyle = PAL.cream;
    ctx.font = '86px Anton';
    ctx.textAlign = 'center';
    ctx.fillText('TRY THE', 256, 110);
    ctx.fillStyle = PAL.amber;
    ctx.fillText('HOOT BURGER', 256, 600);
  } else {
    ctx.fillStyle = PAL.navy;
    ctx.fillRect(0, 0, 512, 720);
    drawOwl(ctx, 256, 300, 170, { bg: PAL.teal, ring: PAL.amber });
    ctx.fillStyle = PAL.cream;
    ctx.font = '74px Anton';
    ctx.textAlign = 'center';
    ctx.fillText('WE NEVER', 256, 560);
    ctx.fillStyle = PAL.amber;
    ctx.fillText('CLOSE', 256, 645);
  }
  return canvasTexture(c);
}

export function wetFloorSignTexture() {
  const [c, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#f2b51e';
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '58px Anton';
  ctx.textAlign = 'center';
  ctx.fillText('CAUTION', 128, 90);
  ctx.font = '40px Anton';
  ctx.fillText('WET FLOOR', 128, 450);
  // slipping figure
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(150, 170, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(140, 200);
  ctx.lineTo(110, 290);
  ctx.lineTo(160, 340);
  ctx.moveTo(110, 290);
  ctx.lineTo(70, 330);
  ctx.moveTo(130, 230);
  ctx.lineTo(190, 250);
  ctx.moveTo(130, 230);
  ctx.lineTo(80, 210);
  ctx.stroke();
  ctx.fillRect(40, 370, 180, 10);
  return canvasTexture(c);
}

export function openSignTexture() {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.translate(512, 0);
  ctx.scale(-1, 1); // seen from inside: reversed
  ctx.strokeStyle = PAL.tealLight;
  ctx.lineWidth = 10;
  roundRect(ctx, 14, 14, 484, 228, 40);
  ctx.stroke();
  ctx.fillStyle = '#fff4dc';
  ctx.shadowColor = PAL.amber;
  ctx.shadowBlur = 20;
  ctx.font = '120px Anton';
  ctx.textAlign = 'center';
  ctx.fillText('OPEN', 256, 150);
  ctx.font = '48px Anton';
  ctx.fillStyle = PAL.amber;
  ctx.fillText('24 HOURS', 256, 214);
  return canvasTexture(c);
}

// Phone camera app UI drawn over the live viewfinder.
export function phoneUICanvas() {
  return makeCanvas(360, 760);
}

export function drawPhoneUI(ctx, t) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, 70);
  ctx.fillRect(0, H - 150, W, 150);
  // REC
  const blink = Math.floor(t * 2) % 2 === 0;
  ctx.fillStyle = blink ? '#ff3b30' : 'rgba(255,59,48,0.35)';
  ctx.beginPath();
  ctx.arc(30, 36, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '26px Oswald';
  const secs = Math.max(0, Math.floor(t));
  ctx.fillText(`REC  00:0${secs}`, 48, 46);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  for (const f of [1 / 3, 2 / 3]) {
    ctx.beginPath();
    ctx.moveTo(W * f, 70);
    ctx.lineTo(W * f, H - 150);
    ctx.moveTo(0, 70 + (H - 220) * f);
    ctx.lineTo(W, 70 + (H - 220) * f);
    ctx.stroke();
  }
  // focus box
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 3;
  const fx = W * 0.38;
  const fy = H * 0.36;
  const fs = 70;
  ctx.strokeRect(fx, fy, fs, fs);
  // shutter
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(W / 2, H - 75, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  roundRect(ctx, W / 2 - 16, H - 91, 32, 32, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '20px Oswald';
  ctx.textAlign = 'center';
  ctx.fillText('VIDEO', W / 2, H - 14);
  ctx.textAlign = 'left';
}

export function uniformPatchTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  drawOwl(ctx, 128, 128, 120, { bg: PAL.navy, ring: PAL.amber });
  return canvasTexture(c);
}

export function nameTagTexture() {
  const [c, ctx] = makeCanvas(256, 96);
  ctx.fillStyle = '#f3efe4';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = PAL.teal;
  ctx.fillRect(0, 0, 256, 26);
  ctx.fillStyle = PAL.navy;
  ctx.font = '52px Anton';
  ctx.textAlign = 'center';
  ctx.fillText('SAM', 128, 84);
  return canvasTexture(c);
}

export { blot };
export const NEAREST = THREE.NearestFilter;
