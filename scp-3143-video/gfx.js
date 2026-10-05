'use strict';
// Drawing helpers shared by every scene: palette, easing, text, rain, grain,
// paper, stamps, glitch, and the noir silhouettes. Everything is a pure
// function of time so frames can be rendered in any order, in parallel.

const path = require('path');
const { createCanvas, GlobalFonts, Image } = require('@napi-rs/canvas');

const W = 1920, H = 1080;

const C = {
  ink: '#0a0b0e', night: '#0e1117', wall: '#15171d', desk: '#1b1d22',
  paper: '#ebe3cf', paperDark: '#cdbf9f', inkText: '#1d1b18',
  grey: '#8d9199', dim: '#4b5059', white: '#f5f1e8',
  amber: '#f0a840', amberDim: '#a8732a', red: '#d33a2c', redDark: '#8e2119',
  blue: '#6f8fb5', green: '#9bd17c',
};

function registerFonts() {
  const dir = path.join(__dirname, 'assets', 'fonts');
  const reg = (f, alias) => GlobalFonts.registerFromPath(path.join(dir, f), alias);
  reg('BebasNeue-Regular.ttf', 'Bebas');
  reg('AbrilFatface-Regular.ttf', 'Abril');
  reg('CourierPrime-Regular.ttf', 'CourierP');
  reg('CourierPrime-Bold.ttf', 'CourierP');
  reg('CourierPrime-Italic.ttf', 'CourierP');
  reg('SpecialElite-Regular.ttf', 'Elite');
  reg('PlayfairDisplay-VF.ttf', 'Playfair');
  reg('PlayfairDisplay-Italic-VF.ttf', 'PlayfairI');
  reg('Oswald-VF.ttf', 'Oswald');
}

// ---------------------------------------------------------------- math ----
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, start, dur) => clamp((t - start) / dur);
const E = {
  linear: x => x,
  outQuad: x => 1 - (1 - x) * (1 - x),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
};
// in-then-out envelope: fades in over `fi` from a, holds, fades out over `fo` ending at b
function env(t, a, b, fi = 0.4, fo = 0.4) {
  if (t < a || t > b) return 0;
  return Math.min(E.outCubic(prog(t, a, fi)), 1 - E.inCubic(prog(t, b - fo, fo)));
}
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// smooth 1-D value noise in [-1, 1]
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}

// ---------------------------------------------------------------- text ----
function txt(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.font = o.font || '40px CourierP';
  ctx.fillStyle = o.color || C.paper;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 24; }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW || 2; ctx.strokeText(s, x, y); }
  if (!o.strokeOnly) ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(ctx, s, font, spacing) {
  ctx.save(); ctx.font = font; if (spacing) ctx.letterSpacing = spacing + 'px';
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}
function wrap(ctx, s, maxW, font) {
  ctx.save(); ctx.font = font;
  const out = [];
  for (const para of s.split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) {
      const tryS = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS;
    }
    out.push(cur);
  }
  ctx.restore();
  return out;
}
// Typewriter: how many characters are visible at time t.
const typed = (t, start, cps, n) => clamp(Math.floor((t - start) * cps), 0, n);
// Draw several lines typed one after another. Returns the time typing ends.
function typeLines(ctx, lines, x, y, lh, t, start, cps, o = {}) {
  let used = 0;
  const total = lines.reduce((a, l) => a + l.length, 0);
  const n = typed(t, start, cps, total);
  let lastX = x, lastY = y;
  lines.forEach((ln, i) => {
    const k = clamp(n - used, 0, ln.length);
    used += ln.length;
    if (k <= 0) return;
    const s = ln.slice(0, k);
    txt(ctx, s, x, y + i * lh, o);
    lastX = x + measure(ctx, s, o.font || '40px CourierP', o.spacing); lastY = y + i * lh;
  });
  if (o.cursor !== false && t >= start && (n < total || Math.floor(t * 2.2) % 2 === 0) && (o.cursorUntil === undefined || t < o.cursorUntil)) {
    ctx.save(); ctx.globalAlpha *= o.alpha === undefined ? 1 : clamp(o.alpha);
    ctx.fillStyle = o.cursorColor || o.color || C.paper;
    const size = parseInt((o.font || '40px').match(/(\d+)px/)[1], 10);
    ctx.fillRect(lastX + 4, lastY - size * 0.75, size * 0.5, size * 0.9);
    ctx.restore();
  }
  return start + total / cps;
}

// ---------------------------------------------------------------- shapes ----
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ------------------------------------------------------- shared textures ----
let GRAIN = null, VIGNETTE = null, PAPER = null;
// Static textures are baked into Images: repeatedly drawing a Canvas onto
// another canvas leaks native memory in @napi-rs/canvas.
function bake(c) { const img = new Image(); img.src = c.toBuffer('image/png'); return img; }
function textures() {
  if (GRAIN) return;
  const r = rng(99);
  GRAIN = [];
  for (let k = 0; k < 6; k++) {
    const c = createCanvas(W / 2, H / 2), g = c.getContext('2d');
    const img = g.createImageData(W / 2, H / 2);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    GRAIN.push(bake(c));
  }
  VIGNETTE = createCanvas(W, H);
  const v = VIGNETTE.getContext('2d');
  const gr = v.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)');
  v.fillStyle = gr; v.fillRect(0, 0, W, H);
  VIGNETTE = bake(VIGNETTE);
  PAPER = createCanvas(512, 512);
  const p = PAPER.getContext('2d');
  const pi = p.createImageData(512, 512);
  for (let i = 0; i < pi.data.length; i += 4) {
    const n = r();
    const v2 = n > 0.985 ? 120 : 200 + Math.floor(r() * 55);
    pi.data[i] = v2; pi.data[i + 1] = v2 - 6; pi.data[i + 2] = v2 - 16; pi.data[i + 3] = 255;
  }
  p.putImageData(pi, 0, 0);
  p.globalAlpha = 0.07; p.strokeStyle = '#6b5a3a';
  for (let i = 0; i < 90; i++) { // paper fibres
    p.beginPath(); const x = r() * 512, y = r() * 512; p.moveTo(x, y);
    p.quadraticCurveTo(x + r() * 40 - 20, y + r() * 40 - 20, x + r() * 60 - 30, y + r() * 60 - 30); p.stroke();
  }
  PAPER = bake(PAPER);
}
function grain(ctx, frame, amount = 0.06) {
  textures();
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = false;
  const g = GRAIN[frame % GRAIN.length];
  const ox = Math.floor(hash(frame) * 6), oy = Math.floor(hash(frame + 7) * 6);
  ctx.drawImage(g, -ox, -oy, W + 12, H + 12);
  ctx.restore();
}
function vignette(ctx, amount = 1) {
  textures();
  ctx.save(); ctx.globalAlpha = amount; ctx.drawImage(VIGNETTE, 0, 0); ctx.restore();
}
function flicker(ctx, frame, amount = 0.035) {
  const f = (hash(frame * 3.1) - 0.5) * amount + (noise1(frame * 0.07) * amount * 0.5);
  if (f > 0) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ------------------------------------------------------------------ rain ----
const RAIN = new Map();
function rainDrops(seed) {
  if (RAIN.has(seed)) return RAIN.get(seed);
  const r = rng(seed);
  const layers = [
    { n: 260, len: [14, 26], v: 1100, w: 1, a: 0.16 },
    { n: 140, len: [26, 46], v: 1600, w: 1.4, a: 0.24 },
    { n: 46, len: [55, 95], v: 2300, w: 2.1, a: 0.32 },
  ].map(L => ({ ...L, drops: Array.from({ length: L.n }, () => ({ x: r() * (W + 400) - 200, y: r() * (H + 200), l: lerp(L.len[0], L.len[1], r()), sp: 0.8 + r() * 0.4 })) }));
  RAIN.set(seed, layers);
  return layers;
}
function rain(ctx, t, intensity = 1, o = {}) {
  if (intensity <= 0.001) return;
  const slope = o.slope === undefined ? 0.16 : o.slope;
  const col = o.color || '200,214,232';
  ctx.save();
  ctx.lineCap = 'round';
  for (const L of rainDrops(o.seed || 7)) {
    ctx.strokeStyle = `rgba(${col},${L.a * intensity})`;
    ctx.lineWidth = L.w;
    ctx.beginPath();
    for (const d of L.drops) {
      const span = H + 200;
      const y = ((d.y + t * L.v * d.sp) % span) - 100;
      const x = ((d.x + y * slope) % (W + 400) + (W + 400)) % (W + 400) - 200;
      ctx.moveTo(x, y); ctx.lineTo(x + d.l * slope, y + d.l);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------- venetian-blind light ----
// Slanted bars of window light thrown across a wall, with rain shadows.
function blinds(ctx, t, o = {}) {
  const alpha = o.alpha === undefined ? 0.16 : o.alpha;
  const color = o.color || '240,190,120';
  const n = o.slats || 9, gap = o.gap || 74, thick = o.thick || 40;
  ctx.save();
  ctx.translate(o.x || W * 0.55, o.y || -120);
  ctx.transform(1, 0, o.skew === undefined ? -0.55 : o.skew, 1, 0, 0);
  ctx.rotate(o.rot || 0.08);
  const len = o.len || 1500;
  for (let i = 0; i < n; i++) {
    const y = i * gap;
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(0.25, `rgba(${color},${alpha})`);
    g.addColorStop(0.75, `rgba(${color},${alpha})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, y, len, thick);
  }
  // rain trickling across the light
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = `rgba(0,0,0,${o.rainShadow === undefined ? 0.35 : o.rainShadow})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k < 40; k++) {
    const x = (hash(k) - 0.5) * len * 0.8;
    const y = ((hash(k + 50) * n * gap + t * (80 + hash(k + 9) * 90)) % (n * gap));
    ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 18 + hash(k + 3) * 20);
  }
  ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------- paper ----
function paper(ctx, x, y, w, h, o = {}) {
  textures();
  ctx.save();
  if (o.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(o.rot); ctx.translate(-x - w / 2, -y - h / 2); }
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.fillStyle = o.color || C.paper;
  ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= 0.55;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let ty = y; ty < y + h; ty += 512) for (let tx = x; tx < x + w; tx += 512) ctx.drawImage(PAPER, tx, ty);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = (o.alpha === undefined ? 1 : clamp(o.alpha)) * 0.5;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,240,210,0.0)'); g.addColorStop(1, 'rgba(60,40,10,0.35)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// --------------------------------------------------------------- stamp ----
// A rubber stamp that slams down at `start`.
function stamp(ctx, text, x, y, t, start, o = {}) {
  if (t < start) return;
  const k = prog(t, start, 0.16);
  const s = lerp(o.from || 2.4, 1, E.inCubic(k));
  const fade = o.until ? 1 - prog(t, o.until, 0.4) : 1;
  if (fade <= 0) return;
  const shake = t - start < 0.35 && k >= 1 ? (hash(Math.floor(t * 60)) - 0.5) * 8 * (1 - prog(t, start + 0.16, 0.2)) : 0;
  ctx.save();
  ctx.translate(x + shake, y + shake * 0.6);
  ctx.rotate(o.rot === undefined ? -0.12 : o.rot);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 1.6) * (o.alpha || 0.92) * fade;
  const size = o.size || 96;
  ctx.font = `${size}px ${o.font || 'Bebas'}`;
  if (o.spacing !== 0) ctx.letterSpacing = (o.spacing || size * 0.06) + 'px';
  const w = ctx.measureText(text).width + size * 0.7, h = size * 1.15;
  const col = o.color || C.red;
  ctx.strokeStyle = col; ctx.lineWidth = size * 0.07;
  rrect(ctx, -w / 2, -h / 2, w, h, size * 0.12); ctx.stroke();
  ctx.lineWidth = size * 0.025;
  rrect(ctx, -w / 2 + size * 0.12, -h / 2 + size * 0.12, w - size * 0.24, h - size * 0.24, size * 0.06); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, size * 0.03, size * 0.06);
  // ink wear: knock tiny holes out of the stamp
  ctx.globalCompositeOperation = 'destination-out';
  const r = rng(text.length * 31 + Math.floor(x));
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`;
    ctx.beginPath(); ctx.arc((r() - 0.5) * w, (r() - 0.5) * h, 1 + r() * size * 0.035, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// -------------------------------------------------------------- glitch ----
let SNAP = null;
// Slice-and-shift the current frame with an RGB split. amount in [0, 1].
function glitch(ctx, amount, seed) {
  if (amount <= 0.001) return;
  if (!SNAP) SNAP = createCanvas(W, H);
  const s = SNAP.getContext('2d');
  s.clearRect(0, 0, W, H); s.drawImage(ctx.canvas, 0, 0);
  const r = rng(Math.floor(seed * 1000));
  ctx.save();
  const bands = Math.floor(6 + amount * 18);
  for (let i = 0; i < bands; i++) {
    const y = r() * H, h = 4 + r() * 70 * amount;
    const dx = (r() - 0.5) * 160 * amount;
    ctx.drawImage(SNAP, 0, y, W, h, dx, y, W, h);
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.45 * amount;
  ctx.drawImage(SNAP, 14 * amount, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,${Math.floor(120 + r() * 60)},${Math.floor(110 + r() * 50)},1)`;
  ctx.globalAlpha = 0.25 * amount;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // scanline flashes
  ctx.save();
  ctx.fillStyle = `rgba(240,230,210,${0.18 * amount})`;
  for (let i = 0; i < 4; i++) ctx.fillRect(0, r() * H, W, 1 + r() * 3);
  ctx.restore();
}

// ------------------------------------------------------------ smoke ----
function smoke(ctx, x, y, t, o = {}) {
  const n = o.n || 26, rise = o.rise || 260;
  ctx.save();
  for (let k = 0; k < n; k++) {
    const age = ((t * (o.speed || 0.35)) + k / n) % 1;
    const yy = y - age * rise;
    const xx = x + Math.sin(age * 5 + k * 1.7 + t * 0.8) * 22 * age + age * (o.drift || 40);
    const rad = 5 + age * (o.size || 34);
    const a = (1 - age) * age * 4 * (o.alpha || 0.07);
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad);
    g.addColorStop(0, `rgba(200,200,205,${a})`); g.addColorStop(1, 'rgba(200,200,205,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, rad, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// --------------------------------------------------------- silhouettes ----
function hatPath(ctx) {
  ctx.beginPath();
  ctx.ellipse(0, -150, 124, 21, -0.05, 0, Math.PI * 2);
  ctx.moveTo(-64, -150);
  ctx.bezierCurveTo(-70, -196, -58, -232, -30, -238);
  ctx.quadraticCurveTo(0, -222, 30, -238);
  ctx.bezierCurveTo(58, -232, 70, -196, 64, -150);
  ctx.closePath();
}
// Bust: trilby, popped collar, trench-coat shoulders. Origin = base of neck.
function detective(ctx, x, y, s, o = {}) {
  const fill = o.fill || '#050506';
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -12);
    ctx.quadraticCurveTo(-120, 8, -188, 60);
    ctx.quadraticCurveTo(-222, 82, -232, 150);
    ctx.lineTo(-250, 700); ctx.lineTo(250, 700); ctx.lineTo(232, 150);
    ctx.quadraticCurveTo(222, 82, 188, 60);
    ctx.quadraticCurveTo(120, 8, 40, -12);
    ctx.closePath();
    ctx.rect(-28, -76, 56, 80);
    ctx.moveTo(-44, -58); ctx.lineTo(-82, 34); ctx.lineTo(-10, 16); ctx.closePath();
    ctx.moveTo(44, -58); ctx.lineTo(82, 34); ctx.lineTo(10, 16); ctx.closePath();
    ctx.ellipse(0, -112, 47, 58, 0, 0, Math.PI * 2);
  };
  if (o.rim) {
    ctx.save();
    ctx.shadowColor = o.rim; ctx.shadowBlur = 26 / s;
    ctx.fillStyle = fill; body(); ctx.fill(); hatPath(ctx); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = fill; body(); ctx.fill(); hatPath(ctx); ctx.fill();
  // hat band + lapels, barely lit
  ctx.strokeStyle = o.detail || 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-63, -168); ctx.quadraticCurveTo(0, -160, 63, -168); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, 18); ctx.lineTo(-70, 230); ctx.moveTo(18, 18); ctx.lineTo(70, 230); ctx.stroke();
  if (o.cig !== false) {
    const tipX = 74, tipY = -76;
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(22, -84); ctx.lineTo(tipX - 4, tipY); ctx.stroke();
    const glow = 0.65 + 0.35 * Math.sin((o.t || 0) * 2.3) * Math.sin((o.t || 0) * 0.7);
    const g = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 22);
    g.addColorStop(0, `rgba(255,170,70,${glow})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tipX, tipY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (o.smoke !== false) smoke(ctx, x + tipX * s, y + tipY * s, o.t || 0, { rise: 300 * s, size: 40 * s, alpha: o.smokeAlpha || 0.08 });
    return;
  }
  ctx.restore();
}
// Full-length figure in trench coat. Origin = between the feet.
function detectiveFull(ctx, x, y, s, o = {}) {
  const fill = o.fill || '#050506';
  const ph = o.walk || 0, sw = Math.sin(ph) * 0.22 * (o.walkAmt === undefined ? 1 : o.walkAmt);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  ctx.fillStyle = fill;
  const leg = (dx, ang) => {
    ctx.save(); ctx.translate(dx, -210); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(17, 0); ctx.lineTo(13, 200); ctx.lineTo(30, 210); ctx.lineTo(-15, 212); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  leg(-24, sw); leg(24, -sw);
  ctx.beginPath(); // coat
  ctx.moveTo(-26, -486);
  ctx.quadraticCurveTo(-80, -478, -100, -446);
  ctx.lineTo(-92, -330); ctx.lineTo(-118, -170); ctx.lineTo(118, -170); ctx.lineTo(92, -330);
  ctx.lineTo(100, -446); ctx.quadraticCurveTo(80, -478, 26, -486); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-30, -500); ctx.lineTo(-52, -458); ctx.lineTo(0, -470); ctx.lineTo(52, -458); ctx.lineTo(30, -500); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -526, 27, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(0, -432); ctx.scale(0.56, 0.56); hatPath(ctx); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-90, -330); ctx.lineTo(90, -330); ctx.stroke(); // belt
  ctx.restore();
}

// Night skyline with lit windows. Buildings cached per seed.
const CITY = new Map();
function cityData(seed, width) {
  const key = seed + ':' + width;
  if (CITY.has(key)) return CITY.get(key);
  const r = rng(seed), b = [];
  let x = 0;
  while (x < width) {
    const w = 70 + r() * 140, h = 160 + r() * 420;
    const win = [];
    for (let wy = 30; wy < h - 20; wy += 34) for (let wx = 14; wx < w - 18; wx += 26) if (r() < 0.24) win.push([wx, wy, r()]);
    b.push({ x, w, h, win, antenna: r() < 0.3, step: r() < 0.4 ? 20 + r() * 30 : 0 });
    x += w + 4 + r() * 10;
  }
  CITY.set(key, b);
  return b;
}
function city(ctx, x0, baseY, width, t, o = {}) {
  const b = cityData(o.seed || 3, width);
  ctx.save();
  ctx.translate(x0, baseY);
  if (o.scaleY !== undefined) ctx.scale(1, o.scaleY);
  for (const bd of b) {
    ctx.fillStyle = o.fill || '#07080b';
    ctx.fillRect(bd.x, -bd.h, bd.w, bd.h);
    if (bd.step) ctx.fillRect(bd.x + bd.w * 0.25, -bd.h - bd.step, bd.w * 0.5, bd.step);
    if (bd.antenna) ctx.fillRect(bd.x + bd.w / 2 - 2, -bd.h - bd.step - 60, 4, 60);
    for (const [wx, wy, k] of bd.win) {
      const fl = k > 0.93 ? (noise1(t * 3 + k * 100) > 0 ? 1 : 0.25) : 1;
      ctx.fillStyle = `rgba(${k > 0.5 ? '240,180,90' : '220,200,150'},${(0.35 + k * 0.5) * fl * (o.lights === undefined ? 1 : o.lights)})`;
      ctx.fillRect(bd.x + wx, -bd.h + wy, 12, 18);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- icons ----
function iconBook(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -40); ctx.quadraticCurveTo(-50, -60, -100, -45); ctx.lineTo(-100, 55); ctx.quadraticCurveTo(-50, 40, 0, 60);
  ctx.quadraticCurveTo(50, 40, 100, 55); ctx.lineTo(100, -45); ctx.quadraticCurveTo(50, -60, 0, -40); ctx.lineTo(0, 60);
  ctx.stroke();
  ctx.lineWidth = 3; ctx.globalAlpha *= 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(-82, -22 + i * 18); ctx.lineTo(-20, -18 + i * 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -18 + i * 18); ctx.lineTo(82, -22 + i * 18); ctx.stroke();
  }
  ctx.restore();
}
function iconEye(ctx, x, y, s, t, col = C.amber) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const blink = Math.abs(Math.sin(t * 0.9)) > 0.985 ? 0.15 : 1;
  ctx.strokeStyle = col; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(0, -70 * blink, 90, 0); ctx.quadraticCurveTo(0, 70 * blink, -90, 0); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(Math.sin(t * 0.7) * 12, 0, 24 * blink, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function iconWarp(ctx, x, y, s, t, col = C.blue) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 4;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    for (let k = -90; k <= 90; k += 6) {
      const d = Math.exp(-(k * k + i * i * 900) / 5000);
      const yy = i * 26 + Math.sin(k * 0.06 + t * 3) * 18 * d;
      if (k === -90) ctx.moveTo(k, yy); else ctx.lineTo(k, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function iconPerson(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, -70, 26, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-46, 40); ctx.quadraticCurveTo(-46, -36, 0, -36); ctx.quadraticCurveTo(46, -36, 46, 40); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function iconCat(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 10, 34, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -40, 24, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-22, -52); ctx.lineTo(-18, -78); ctx.lineTo(-4, -60); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(22, -52); ctx.lineTo(18, -78); ctx.lineTo(4, -60); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(28, 40); ctx.quadraticCurveTo(70, 40, 60, -10); ctx.stroke();
  ctx.restore();
}
function iconShoe(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-70, -40); ctx.lineTo(-30, -40); ctx.quadraticCurveTo(-20, -10, 20, -6);
  ctx.quadraticCurveTo(76, 0, 76, 26); ctx.lineTo(-70, 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.ink; ctx.fillRect(-70, 18, 146, 8);
  ctx.restore();
}
function iconBadge(ctx, x, y, s, col = C.amber) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(80, -65); ctx.quadraticCurveTo(82, 40, 0, 100); ctx.quadraticCurveTo(-82, 40, -80, -65); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '40px Bebas'; ctx.fillText('IOTA', 0, -26);
  ctx.font = '64px Bebas'; ctx.fillText('10', 0, 30);
  ctx.restore();
}
function iconHat(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.translate(0, 190); hatPath(ctx); ctx.fill(); ctx.restore();
}
function iconGlass(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-40, -50); ctx.lineTo(-34, 50); ctx.lineTo(34, 50); ctx.lineTo(40, -50); ctx.stroke();
  ctx.fillStyle = C.amber; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.moveTo(-37, 0); ctx.lineTo(-34, 47); ctx.lineTo(34, 47); ctx.lineTo(37, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function iconSuit(ctx, x, y, s, col = C.paper) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-30, -60); ctx.lineTo(-70, -40); ctx.lineTo(-70, 60); ctx.lineTo(70, 60); ctx.lineTo(70, -40); ctx.lineTo(30, -60);
  ctx.lineTo(0, 10); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 60); ctx.stroke();
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(8, -40); ctx.lineTo(4, 0); ctx.lineTo(0, 8); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

module.exports = {
  W, H, C, registerFonts, clamp, lerp, prog, E, env, rng, hash, noise1,
  txt, measure, wrap, typed, typeLines, rrect,
  grain, vignette, flicker, rain, blinds, paper, stamp, glitch, smoke,
  detective, detectiveFull, city, hatPath,
  iconBook, iconEye, iconWarp, iconPerson, iconCat, iconShoe, iconBadge, iconHat, iconGlass, iconSuit,
};
