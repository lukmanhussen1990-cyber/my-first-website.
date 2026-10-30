'use strict';
/*
 * "Waiting for October" - 12 s vertical reel.
 * Everything except the painted background is drawn here in code.
 *
 * World units are pixels of the original background (941 x 1672); the
 * camera maps them onto the 1080 x 1920 frame. Leaves, text and grading
 * live in screen space.
 */

const W = 1080, H = 1920, FPS = 30, DUR = 12;
const IW = 941, IH = 1672;
const BONE = '#F5F0E1', INK = '#2a1b14', HOLE = '#160d0a';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOutC = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
const easeIO = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeSine = t => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
const rotv = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const dirv = a => ({ x: Math.cos(a), y: Math.sin(a) });
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function noise1(x, seed) {
  const h = n => { const v = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
function rrPath(g, x, y, w, h, r) {
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function glow(c, x, y, r, rgb, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function softEllipse(c, x, y, rx, ry, a) {
  if (a <= 0.001) return;
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(28,10,3,${a})`); g.addColorStop(0.55, `rgba(28,10,3,${a * 0.6})`); g.addColorStop(1, 'rgba(28,10,3,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
}

// ---------------------------------------------------------------- camera
function camera(t) {
  const e = easeOutC(t / 2.4);
  const z = 1.02 + 0.06 * e + 0.0035 * t;
  let cx = 471 + 9 * e + 4 * Math.sin(t * 0.41 + 0.3) + 1.5 * Math.sin(t * 1.03);
  let cy = 840 + 36 * e + 5 * Math.sin(t * 0.33 + 1.1) + 1.5 * Math.sin(t * 0.87 + 2);
  const S = H / IH * z, hw = W / 2 / S, hh = H / 2 / S;
  cx = clamp(cx, hw + 1, IW - hw - 1); cy = clamp(cy, hh + 1, IH - hh - 1);
  return { S, cx, cy, e: W / 2 - cx * S, f: H / 2 - cy * S };
}
const applyCam = (c, cam) => c.setTransform(cam.S, 0, 0, cam.S, cam.e, cam.f);
const toScreen = (cam, p) => ({ x: p.x * cam.S + cam.e, y: p.y * cam.S + cam.f });

// ---------------------------------------------------------------- scene lights
function drawGlows(c, t) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const dip = Math.max(0, noise1(t * 2.7, 7) - 0.7) * 2.2;
  const fl = clamp(0.84 + 0.07 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 23.7 + 1.3) + 0.12 * (noise1(t * 7, 3) - 0.5) - dip, 0.35, 1.05);
  glow(c, 221, 548, 78, '255,170,80', 0.26 * fl);   // hanging lamp on the shelter
  glow(c, 221, 548, 24, '255,215,140', 0.50 * fl);
  const w2 = 0.9 + 0.07 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 5.3 + 0.7);
  glow(c, 913, 783, 80, '255,160,70', 0.20 * w2);   // station window
  glow(c, 913, 783, 34, '255,200,120', 0.18 * w2);
  glow(c, 851, 786, 22, '255,200,120', 0.30 * w2 * (0.92 + 0.08 * Math.sin(t * 17)));
  glow(c, 597, 748, 16, '255,200,120', 0.22);       // far lamp post
  c.restore();
}

// ---------------------------------------------------------------- leaves
const LEAF_COLORS = [
  ['#ee7b22', '#b6460f'], ['#d23c1c', '#8c1f0e'], ['#f4b73a', '#c47c17'],
  ['#a9271a', '#6b130b'], ['#ec942e', '#b1561a'], ['#de5f20', '#9a3410'],
];
const LEAF_PTS = (() => {
  const R = [[0, -0.5], [0.055, -0.37], [0.12, -0.40], [0.10, -0.24], [0.075, -0.12], [0.20, -0.21],
    [0.25, -0.31], [0.29, -0.21], [0.43, -0.25], [0.37, -0.11], [0.42, -0.03], [0.28, 0.01],
    [0.14, 0.06], [0.23, 0.13], [0.31, 0.23], [0.18, 0.20], [0.08, 0.19], [0.025, 0.22]];
  return R.concat(R.slice(1).reverse().map(([x, y]) => [-x, y]));
})();
function makeLeaf(col, dark, blur) {
  const S = 128, c0 = mk(S, S), g = c0.getContext('2d');
  g.translate(S / 2, S / 2 + 2); g.scale(112, 112);
  g.beginPath(); LEAF_PTS.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  const gr = g.createRadialGradient(0, -0.05, 0.02, 0, 0, 0.5);
  gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
  g.fillStyle = gr; g.fill();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(60,18,4,0.35)'; g.stroke();
  g.strokeStyle = 'rgba(95,30,8,0.45)'; g.lineWidth = 0.014; g.lineCap = 'round';
  for (const [x, y] of [[0, -0.47], [0.40, -0.23], [-0.40, -0.23], [0.29, 0.21], [-0.29, 0.21]]) {
    g.beginPath(); g.moveTo(0, 0.2); g.quadraticCurveTo(x * 0.35, (y + 0.2) * 0.5, x * 0.88, y * 0.9); g.stroke();
  }
  g.strokeStyle = col[1]; g.lineWidth = 0.028;
  g.beginPath(); g.moveTo(0, 0.2); g.quadraticCurveTo(0.03, 0.35, -0.02, 0.48); g.stroke();
  if (dark) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(45,12,0,0.3)'; g.fillRect(-1, -1, 2, 2); }
  if (!blur) return c0;
  const c1 = mk(S, S), g1 = c1.getContext('2d'); g1.filter = `blur(${blur}px)`; g1.drawImage(c0, 0, 0);
  return c1;
}
const LEAF_SPR = LEAF_COLORS.map(col => ({
  f: makeLeaf(col, false, 0), b: makeLeaf(col, true, 0),
  fb: makeLeaf(col, false, 3.5), bb: makeLeaf(col, true, 3.5),
}));
function drawLeaf(c, L, x, y, rot, flip, sizeMul) {
  const fl = Math.cos(flip), set = LEAF_SPR[L.col];
  const spr = L.blur ? (fl >= 0 ? set.fb : set.bb) : (fl >= 0 ? set.f : set.b);
  const s = L.size * (sizeMul || 1);
  c.setTransform(1, 0, 0, 1, x, y); c.rotate(rot);
  c.scale(Math.max(0.1, Math.abs(fl)), 0.82 + 0.18 * Math.abs(Math.sin(flip * 0.7 + 1)));
  c.globalAlpha = L.alpha === undefined ? 1 : L.alpha;
  c.drawImage(spr, -s / 2, -s / 2, s, s);
  c.globalAlpha = 1;
}

// wind gust from the passing train
const gust = t => smooth((t - 6.3) / 0.5) * (1 - smooth((t - 8.2) / 0.8));
const windX = t => -18 - 720 * gust(t);

function newLeaf(r, depth, anywhere) {
  return {
    x: r() * W, y: anywhere ? r() * H : -60 - r() * 160, depth,
    size: 58 * depth * (0.8 + 0.45 * r()), col: Math.floor(r() * LEAF_COLORS.length),
    rot: r() * 6.28, vr: (r() - 0.5) * 2.6, flip: r() * 6.28, vf: 1.4 + r() * 2.6,
    swA: 30 + r() * 45, swF: 0.8 + r() * 1.1, swP: r() * 6.28, fall: 70 + r() * 45,
    blur: depth > 1.4, seed: r() * 100,
  };
}
const LEAVES = [], STEAM = [];
let simT = 0, simR = rng(1234);
function resetSim() {
  LEAVES.length = 0; STEAM.length = 0; simT = 0; simR = rng(1234);
  const r = rng(7);
  for (let i = 0; i < 34; i++) LEAVES.push(newLeaf(r, i < 22 ? 0.5 + r() * 0.42 : 1.0 + r() * 0.7, true));
}
function stepSim(t, dt) {
  const g = gust(t), wx = windX(t), r = simR;
  for (const L of LEAVES) {
    let vx = L.swA * Math.cos(L.swF * t + L.swP) + wx * (0.55 + 0.55 * L.depth);
    if (L.depth >= 0.95 && t > 4.4 && t < 6.1) {      // keep the skull-leaf moment clear
      const dx = L.x - 470, dy = L.y - 1040, d = Math.hypot(dx, dy);
      if (d < 260) vx += Math.sign(dx || 1) * 900 * (1 - d / 260);
    }
    const vy = L.fall * (0.55 + 0.45 * L.depth) * (1 - 0.35 * g) + g * 230 * Math.sin(t * 2.6 + L.seed);
    L.x += vx * dt; L.y += vy * dt;
    L.rot += (L.vr * (1 + 3 * g) + 0.4 * Math.cos(L.swF * t + L.swP)) * dt;
    L.flip += L.vf * (1 + 2 * g) * dt;
    if (L.y > H + 70) { L.y = -60 - r() * 80; L.x = r() * W; }
    if (L.x < -90) {
      if (g > 0.05) { L.x = W + 60 + r() * 120; L.y = r() * H * 0.85; } else { L.x = W + 50; }
    }
    if (L.x > W + 140 && g < 0.05) L.x = -50;
  }
  // steam from the locomotive chimney
  if (t > TRAIN_T0 && t < 9.0) {
    const sh = trainHead(t), s = sh - 84, x = trainX(s);
    if (x > -40 && x < IW + 60) {
      const k = trainK(s);
      for (let i = 0; i < 2; i++) {
        STEAM.push({
          x: x + (r() - 0.5) * 8 * k, y: railY(x) - (TR.RAIL - 10) * k, r0: (9 + r() * 6) * k + 3,
          grow: 2.4 + r() * 1.6, vx: -25 + (r() - 0.5) * 30, vy: -(38 + r() * 30) * (0.5 + 0.5 * k),
          age: 0, life: 0.9 + r() * 0.6, a: 0.2 + r() * 0.12,
        });
      }
    }
  }
  for (const p of STEAM) {
    p.age += dt; p.x += (p.vx - 220 * g) * dt; p.y += p.vy * dt; p.vy *= 0.995;
  }
  for (let i = STEAM.length - 1; i >= 0; i--) if (STEAM[i].age > STEAM[i].life) STEAM.splice(i, 1);
}
function simulate(t) {
  if (t < simT - 1e-6 || !LEAVES.length) resetSim();
  const dt = 1 / 120;
  while (simT + dt <= t + 1e-9) { stepSim(simT, dt); simT += dt; }
}

// leaves blown across the screen by the train's gust (analytic paths)
const GUST = (() => {
  const r = rng(99), out = [];
  for (let i = 0; i < 72; i++) {
    const depth = 0.6 + r() * 1.15;
    out.push({
      t0: 6.3 + r() * 1.8, v: 640 + r() * 520, yc: 520 + r() * 950, R: 60 + r() * 190,
      w: (4 + r() * 4) * (r() < 0.5 ? -1 : 1), ph: r() * 6.28, depth,
      size: 56 * depth * (0.8 + 0.4 * r()), col: Math.floor(r() * LEAF_COLORS.length),
      rot: r() * 6.28, vr: (r() - 0.5) * 12, vf: 5 + r() * 6, flip: r() * 6.28,
      blur: depth > 1.4, drift: (r() - 0.6) * 260,
    });
  }
  return out;
})();
function gustLeafPos(L, t) {
  const dt = t - L.t0;
  if (dt < 0) return null;
  const cx = W + 140 - L.v * dt;
  if (cx < -300) return null;
  const cy = L.yc + L.drift * dt - 70 * dt * dt + 90 * Math.sin(dt * 2.2 + L.ph);
  return { x: cx + L.R * Math.cos(L.w * dt + L.ph), y: cy + 0.7 * L.R * Math.sin(L.w * dt + L.ph), rot: L.rot + L.vr * dt, flip: L.flip + L.vf * dt };
}
function drawLeafLayer(c, front, t) {
  for (const L of LEAVES) if ((L.depth >= 0.95) === front) drawLeaf(c, L, L.x, L.y, L.rot, L.flip);
  for (const L of GUST) {
    if ((L.depth >= 0.95) !== front) continue;
    const p = gustLeafPos(L, t);
    if (p) drawLeaf(c, L, p.x, p.y, p.rot, p.flip);
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------- train
const TR = { TS: 1.5, LT: 1828, HT: 262, RAIL: 258 };
const TRAIN_T0 = 5.95, TRAIN_T1 = 9.1;
const trainX = s => -180 + 1120 * Math.exp(-s / 1120);   // distance along track -> screen x
const trainK = s => Math.exp(-s / 1120);                 // local scale
const railY = x => 865 + 0.196 * (x + 180);              // near rail line (vanishing point at -180, 865)
const trainHead = t => 25 + 990.8 * (t - 6.05);

function makeTrain() {
  const TS = TR.TS, w = Math.ceil(TR.LT * TS) + 2, h = Math.ceil(TR.HT * TS);
  const cv = mk(w, h), g = cv.getContext('2d');
  const gl0 = mk(w, h), gg = gl0.getContext('2d');
  g.scale(TS, TS); gg.scale(TS, TS);
  const circ = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const rr = (x, y, ww, hh, r, col) => { g.fillStyle = col; g.beginPath(); rrPath(g, x, y, ww, hh, r); g.fill(); };
  const vgrad = (y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const rim = (x0, y0, x1, y1) => { g.strokeStyle = 'rgba(255,178,100,0.6)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const wheel = (cx, cy, r) => {
    circ(cx, cy, r, '#15100e'); circ(cx, cy, r * 0.82, '#6c2217');
    g.strokeStyle = '#43140d'; g.lineWidth = r * 0.09;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke(); }
    circ(cx, cy, r * 0.2, '#2b1d17');
    g.strokeStyle = 'rgba(255,165,95,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r - 1.5, -2.6, -0.5); g.stroke();
  };
  const windowGlow = (x, y, ww, hh, dim) => {
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, dim ? '#f7cf86' : '#ffe9ad'); gr.addColorStop(1, dim ? '#e9883a' : '#ffa245');
    g.fillStyle = gr; g.beginPath(); rrPath(g, x, y, ww, hh, 5); g.fill();
    g.strokeStyle = '#2e1c14'; g.lineWidth = 3; g.stroke();
    gg.fillStyle = '#ff9a3c'; gg.beginPath(); rrPath(gg, x - 2, y - 2, ww + 4, hh + 4, 6); gg.fill();
  };
  const silhouette = (x, y, ww, hh) => {
    g.fillStyle = 'rgba(70,32,16,0.55)';
    g.beginPath(); g.arc(x + ww * 0.5, y + hh * 0.52, ww * 0.18, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + ww * 0.5, y + hh, ww * 0.34, hh * 0.3, 0, Math.PI, 0); g.fill();
  };

  // ---- locomotive (front at u = 0, travelling left)
  wheel(84, 232, 26); wheel(184, 210, 46); wheel(292, 210, 46); wheel(400, 210, 46); wheel(500, 228, 30);
  g.fillStyle = '#141110'; g.fillRect(40, 178, 516, 22);
  rr(48, 176, 100, 40, 9, '#26211e'); g.fillStyle = '#9c7a3b'; g.fillRect(60, 176, 4, 40); g.fillRect(132, 176, 4, 40);
  g.fillStyle = '#1b1513'; g.beginPath(); g.moveTo(2, 254); g.lineTo(42, 254); g.lineTo(50, 206); g.lineTo(14, 206); g.closePath(); g.fill();
  g.strokeStyle = '#3c2b22'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(8 + i * 8, 252); g.lineTo(18 + i * 7, 208); g.stroke(); }
  g.fillStyle = '#8a2a1c'; g.fillRect(12, 190, 38, 22);
  circ(8, 201, 6.5, '#1a1513');
  rr(38, 78, 84, 106, 6, '#1c1b19');
  g.fillStyle = vgrad(86, 180, [[0, '#46523f'], [0.35, '#25332b'], [1, '#121915']]); g.fillRect(118, 86, 256, 94);
  g.fillStyle = '#a7843f'; for (const x of [166, 246, 326]) g.fillRect(x, 86, 4, 94);
  g.fillStyle = '#161514'; g.beginPath(); g.moveTo(70, 84); g.lineTo(64, 28); g.lineTo(104, 28); g.lineTo(98, 84); g.closePath(); g.fill();
  rr(58, 14, 52, 15, 4, '#1f1d1b');
  g.fillStyle = vgrad(60, 88, [[0, '#e0b25e'], [1, '#8d6a2c']]);
  g.beginPath(); g.ellipse(214, 88, 26, 27, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#26332c'; g.beginPath(); g.ellipse(300, 88, 18, 16, 0, Math.PI, 0); g.fill();
  g.fillStyle = vgrad(42, 200, [[0, '#6e2a20'], [1, '#43160f']]); g.fillRect(372, 42, 172, 158);
  rr(360, 26, 196, 18, 7, '#2a2220');
  windowGlow(392, 60, 58, 60, false); windowGlow(470, 60, 50, 60, true);
  g.strokeStyle = '#c9a560'; g.lineWidth = 1.6; g.strokeRect(382, 132, 152, 60);
  g.fillStyle = '#121010'; g.fillRect(34, 176, 524, 10);
  g.fillStyle = '#7a2418'; g.fillRect(34, 186, 524, 8);
  rr(178, 206, 228, 8, 3, '#8f8a82');
  rr(34, 54, 24, 26, 5, '#2a2421');
  circ(41, 67, 8, '#fff0b8'); gg.fillStyle = '#ffe0a0'; gg.beginPath(); gg.arc(40, 67, 22, 0, Math.PI * 2); gg.fill();
  rim(118, 87, 372, 87); rim(362, 27, 554, 27); rim(60, 15, 108, 15);
  g.strokeStyle = 'rgba(255,190,110,0.55)'; g.lineWidth = 2.4;
  g.beginPath(); g.ellipse(214, 88, 26, 27, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();

  // ---- tender
  wheel(610, 232, 24); wheel(686, 232, 24); wheel(762, 232, 24);
  g.fillStyle = '#141110'; g.fillRect(566, 198, 238, 12); g.fillRect(550, 188, 24, 8);
  g.fillStyle = vgrad(68, 200, [[0, '#3c4838'], [0.3, '#22302a'], [1, '#111814']]);
  g.beginPath(); rrPath(g, 572, 68, 226, 132, 6); g.fill();
  g.fillStyle = '#0f0d0c'; g.beginPath(); g.moveTo(578, 70);
  for (let x = 578; x <= 792; x += 14) g.lineTo(x + 7, 56 + 8 * Math.sin(x * 0.37) - 4 * Math.cos(x * 0.13));
  g.lineTo(792, 70); g.closePath(); g.fill();
  g.strokeStyle = '#c9a560'; g.lineWidth = 1.6; g.strokeRect(586, 92, 198, 92);
  rim(574, 69, 796, 69);

  // ---- two coaches
  const coach = (u0, last) => {
    const u1 = u0 + 500;
    for (const x of [u0 + 72, u0 + 128, u1 - 128, u1 - 72]) wheel(x, 236, 22);
    rr(u0 + 50, 222, 100, 12, 4, '#171312'); rr(u1 - 150, 222, 100, 12, 4, '#171312');
    g.fillStyle = '#141110'; g.fillRect(u0 + 10, 198, 480, 14);
    g.fillStyle = vgrad(112, 202, [[0, '#6c271e'], [1, '#3b130e']]);
    g.beginPath(); rrPath(g, u0, 112, 500, 90, 4); g.fill();
    g.fillStyle = vgrad(40, 114, [[0, '#7a3226'], [1, '#5a1f18']]); g.fillRect(u0, 40, 500, 74);
    g.fillStyle = '#b8914c'; g.fillRect(u0, 44, 500, 2);
    rr(u0 - 6, 22, 512, 22, 10, '#3b302b');
    for (let i = 0; i < 8; i++) {
      const wx = u0 + 28 + i * 58.5;
      windowGlow(wx, 56, 40, 46, i % 3 === 1);
      if ((i * 7 + u0) % 5 === 1) silhouette(wx, 54, 42, 50);
    }
    g.fillStyle = '#b8914c'; g.fillRect(u0, 117, 500, 2.5);
    g.strokeStyle = '#47170f'; g.lineWidth = 2;
    for (let x = u0 + 62; x < u1; x += 62) { g.beginPath(); g.moveTo(x, 124); g.lineTo(x, 198); g.stroke(); }
    rim(u0 - 4, 23, u1 + 4, 23); rim(u0, 41, u1, 41);
    if (!last) { g.fillStyle = '#1b1716'; g.fillRect(u1, 52, 14, 140); }
  };
  g.fillStyle = '#1b1716'; g.fillRect(800, 60, 14, 132);
  coach(814, false); coach(1328, true);

  // ---- overall shading: warm top, darker underneath
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, 'rgba(255,165,90,0.16)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,4,2,0.42)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';

  const gl = mk(w, h), g2 = gl.getContext('2d');
  g2.filter = 'blur(12px)'; g2.drawImage(gl0, 0, 0); g2.filter = 'blur(4px)'; g2.globalAlpha = 0.6; g2.drawImage(gl0, 0, 0);
  return { cv, gl };
}
let TRAIN = null;

function drawTrainStrips(c, img, sh, cam, step, comp) {
  const TS = TR.TS;
  c.globalCompositeOperation = comp || 'source-over';
  for (let u = 0; u < TR.LT; u += step) {
    const u1 = Math.min(TR.LT, u + step);
    const s0 = sh - u, s1 = sh - u1;
    const x0 = trainX(s0), x1 = trainX(s1);
    if (x1 < -30 || x0 > IW + 30) continue;
    const k = trainK((s0 + s1) / 2), sw = (u1 - u) * TS, ax = (x1 - x0) / sw;
    const swr = Math.min(sw + 1, img.width - u * TS);
    c.setTransform(cam.S, 0, 0, cam.S, cam.e, cam.f);
    c.transform(ax, 0.196 * ax, 0, k / TS, x0, railY(x0) - TR.RAIL * k);
    c.drawImage(img, u * TS, 0, swr, img.height, 0, 0, swr, img.height);
  }
  c.globalCompositeOperation = 'source-over';
}
const trCv = mk(W, H), trCtx = trCv.getContext('2d');
const tmpCv = mk(W, H), tmpCtx = tmpCv.getContext('2d');
function renderTrainLayer(t, cam) {
  trCtx.setTransform(1, 0, 0, 1, 0, 0); trCtx.clearRect(0, 0, W, H);
  const N = 5, shutter = 0.55 / FPS;
  for (let i = 0; i < N; i++) {
    const ts = t + (i / (N - 1) - 0.5) * shutter;
    tmpCtx.setTransform(1, 0, 0, 1, 0, 0); tmpCtx.clearRect(0, 0, W, H);
    const sh = trainHead(ts);
    drawTrainStrips(tmpCtx, TRAIN.cv, sh, cam, 4);
    tmpCtx.globalAlpha = 0.55; drawTrainStrips(tmpCtx, TRAIN.gl, sh, cam, 10, 'lighter'); tmpCtx.globalAlpha = 1;
    trCtx.globalCompositeOperation = 'lighter'; trCtx.globalAlpha = 1 / N;
    trCtx.setTransform(1, 0, 0, 1, 0, 0); trCtx.drawImage(tmpCv, 0, 0);
  }
  trCtx.globalAlpha = 1; trCtx.globalCompositeOperation = 'source-over';
}
function drawSteam(c) {
  for (const p of STEAM) {
    const u = p.age / p.life, r = p.r0 * (1 + p.grow * u);
    const a = p.a * Math.pow(1 - u, 1.4) * smooth(p.age / 0.12);
    const g = c.createRadialGradient(p.x, p.y - r * 0.2, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(255,236,214,${a})`); g.addColorStop(0.6, `rgba(240,210,185,${a * 0.5})`); g.addColorStop(1, 'rgba(230,200,180,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
  }
}

// ---------------------------------------------------------------- skeleton rig
const RIG = { thigh: 62, shin: 64, upper: 42, fore: 38, ankle: 5, hipX: 9.5, hipY: 3, shX: 20.5, shY: -72, neck: -88, w: 5.2, o: 1.5 };

function ik2(a, t, L1, L2, pref) {
  const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
  const dc = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const base = Math.atan2(dy, dx);
  const al = Math.acos(clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1));
  const m1 = { x: a.x + L1 * Math.cos(base + al), y: a.y + L1 * Math.sin(base + al) };
  const m2 = { x: a.x + L1 * Math.cos(base - al), y: a.y + L1 * Math.sin(base - al) };
  const s1 = (m1.x - a.x) * pref[0] + (m1.y - a.y) * pref[1], s2 = (m2.x - a.x) * pref[0] + (m2.y - a.y) * pref[1];
  return { mid: s1 >= s2 ? m1 : m2, end: { x: a.x + Math.cos(base) * dc, y: a.y + Math.sin(base) * dc } };
}

// ---- walk (0 - 2.25 s): procedural gait with planted feet
const WALK = { x0: -58, x1: 516, tStop: 2.25, tau: 0.45, steps: 6, lift: 15 };
WALK.v = (WALK.x1 - WALK.x0) / (WALK.tStop - WALK.tau / 2);
WALK.S = 2 * (WALK.x1 - WALK.x0) / WALK.steps;
function walkX(t) {
  const ta = WALK.tStop - WALK.tau;
  if (t <= ta) return WALK.x0 + WALK.v * t;
  const u = clamp((t - ta) / WALK.tau, 0, 1);
  return WALK.x0 + WALK.v * ta + WALK.v * WALK.tau * (u - u * u / 2);
}
const groundY = x => 1300 - (x + 58) * 0.163;
const walkScale = x => 1.12 * (1 + (groundY(x) - 1206) * 0.0011);

const BASE = { lean: 0, recline: 0, shrug: 0, headTurn: 0, headTilt: 0, nod: 0, headLift: 0, jaw: 0, sad: 0, bodyTurn: 0, swing: 0, footL: 0.15, footR: 0.15 };
const SCALARS = ['x', 'y', 'sc', ...Object.keys(BASE)];

function walkPose(t) {
  const x = walkX(t), q = (x - WALK.x0) / WALK.S, sc = walkScale(x);
  const legLen = (RIG.thigh + RIG.shin) * sc, ph = 2 * Math.PI * q;
  const bounce = Math.pow(Math.sin(ph), 2);
  const y = groundY(x) - RIG.ankle * sc - legLen * 0.925 - 6 * sc * bounce;
  const foot = off => {
    const qq = q + off, k = Math.floor(qq), f = qq - k;
    const plant = kk => WALK.x0 + (kk - off + 0.25) * WALK.S;
    if (f < 0.5) return { fx: plant(k), lift: 0, ang: 0 };
    const u = (f - 0.5) / 0.5;
    return { fx: lerp(plant(k), plant(k + 1), easeSine(u)), lift: Math.sin(Math.PI * u) * WALK.lift * sc, ang: -0.35 * Math.sin(Math.PI * u) };
  };
  const fR = foot(0), fL = foot(0.5), ho = RIG.hipX * sc;
  return {
    ...BASE, t, x, y, sc,
    lean: 0.05, headTurn: 0.5, bodyTurn: 0.3, nod: -0.05, jaw: 0.1,
    headTilt: 0.06 * Math.sin(2 * ph), headLift: 1.6 * Math.sin(2 * ph + 0.9),
    legR: { ik: [fR.fx + ho, groundY(fR.fx + ho) - RIG.ankle * sc - fR.lift], pref: [1, 0] },
    legL: { ik: [fL.fx - ho, groundY(fL.fx - ho) - RIG.ankle * sc - fL.lift], pref: [1, 0] },
    footR: fR.ang, footL: fL.ang,
    armL: { ref: 'hip', p: [-23 + 15 * Math.sin(ph), 3 - 5 * Math.abs(Math.sin(ph))], pref: [-1, 0.3], hand: 0.15, curl: 0.55, z: 1, tka: 0.15 * Math.sin(ph) },
    armR: { ref: 'hip', p: [28 - 3 * Math.sin(ph), 3], pref: [1, 0.2], hand: 0, curl: 1, z: 0 },
    caseSwing: 0.07 * Math.sin(2 * ph + 0.6),
  };
}

// ---- keyed acting (2.25 s - 12 s)
const SEAT = { x: 425, y: 1047, sc: 1.10 };
const legSeatL = { fk: [0.30, 1.52], fs: 0.9 }, legSeatR = { fk: [0.24, 1.47], fs: 0.9 };
const lapL = { ref: 'hip', p: [13.6, -6.4], pref: [-1, 0.2], hand: 0.15, curl: 0.55, z: 1, tka: 0.35 };
const lapR = { ref: 'hip', p: [41, -1], pref: [1, 0.4], hand: 0.25, curl: 0.4, z: 1 };
const readL = { ref: 'hip', p: [8, -52], pref: [-1, 0.6], hand: 0.1, curl: 0.55, z: 1, tka: -0.22 };
const skullL = { ref: 'head', p: [-29, 2], pref: [-1, 0.5], handAbs: -Math.PI / 2 + 0.3, curl: 0.15, z: 2, tka: -1.2 };
const skullR = { ref: 'head', p: [29, 2], pref: [1, 0.5], handAbs: -Math.PI / 2 - 0.3, curl: 0.15, z: 2 };
const standY = 1063.3, standSc = 1.1157;
const standLegs = { legL: { ik: [528, 1198.5], pref: [1, 0] }, legR: { ik: [553, 1194.8], pref: [1, 0] } };

const KEYS = [
  { t: 2.45, x: 540, y: standY, sc: standSc, headTurn: 0.15, bodyTurn: 0.1, lean: 0.02, nod: 0, jaw: 0.05,
    legL: { ...standLegs.legL, lift: 14 }, legR: { ...standLegs.legR, lift: 4 }, footL: 0.05, footR: 0.1,
    armL: { ref: 'hip', p: [-24, 4], pref: [-1, 0.3], hand: 0.15, curl: 0.55, z: 1, tka: 0 },
    armR: { ref: 'hip', p: [29, 4], pref: [1, 0.2], curl: 1, z: 0 } },
  { t: 2.62, headTurn: 0.45, nod: 0.35 },
  { t: 2.95, x: 548, y: 1083, lean: 0.38, headTurn: 0.5, nod: 0.6, headTilt: 0.15,
    armL: { ref: 'hip', p: [-42, -26], pref: [-1, 0.6], hand: 0.2, curl: 0.55, z: 1, tka: -0.3 },
    armR: { ref: 'hip', p: [45.7, 11.7], pref: [1, 0.3], curl: 1, z: 0 } },
  { t: 3.08 },
  { t: 3.30, x: 540, y: standY, lean: 0, headTurn: -0.5, nod: 0, headTilt: 0, bodyTurn: -0.2,
    armL: { ref: 'hip', p: [-24, 4], pref: [-1, 0.3], hand: 0.15, curl: 0.55, z: 1, tka: 0 },
    armR: { ref: 'hip', p: [26, 6], pref: [1, 0.2], hand: 0.1, curl: 0.3, z: 1 } },
  { t: 3.48, x: 536, y: 1080, lean: 0.06, nod: 0.15,
    armL: { ref: 'hip', p: [-34, -2], pref: [-1, 0.3], hand: 0.15, curl: 0.55, z: 1, tka: 0 },
    armR: { ref: 'hip', p: [34, -2], pref: [1, 0.3], hand: 0.1, curl: 0.3, z: 1 } },
  { t: 3.68, x: 478, y: 1012, sc: 1.105, lean: -0.04, headTurn: -0.1, nod: -0.2, jaw: 0.35, bodyTurn: 0,
    legL: { fk: [0.75, 2.2], fs: 0.9 }, legR: { fk: [0.65, 2.1], fs: 0.9 }, footL: 0.3, footR: 0.3,
    armL: { ref: 'hip', p: [-40, -46], pref: [-1, 0.3], hand: 0.1, curl: 0.55, z: 1, tka: 0.2 },
    armR: { ref: 'hip', p: [40, -46], pref: [1, 0.3], hand: 0.1, curl: 0.3, z: 1 } },
  { t: 3.86, x: SEAT.x, y: SEAT.y + 3.5, sc: SEAT.sc, lean: 0, headTurn: 0, nod: 0.1, jaw: 0.1,
    legL: legSeatL, legR: legSeatR, footL: 0.15, footR: 0.15, armL: lapL, armR: lapR },
  { t: 4.02, y: SEAT.y, swing: 1, nod: 0 },
  // 4-6 s: ticket, look left down the tracks, leaf lands, shake it off
  { t: 4.15 },
  { t: 4.5, armL: readL, headTurn: -0.3, nod: 0.8, headTilt: -0.12 },
  { t: 4.85, headTilt: -0.05, nod: 0.75 },
  { t: 5.12, armL: lapL, headTurn: -0.95, nod: -0.1, headTilt: 0.14 },
  { t: 5.32 },
  { t: 5.48, headTurn: -0.3, nod: -0.6, jaw: 0.4, headTilt: 0.0 },
  { t: 5.95, headTurn: -0.2, nod: -0.1, jaw: 0.15 },
  { t: 6.12, headTurn: -0.6, nod: 0, headTilt: 0.08 },
  // 6-9 s: train, gust, holds on to its skull
  { t: 6.32, headTurn: 0.85, nod: -0.1, headTilt: -0.06, jaw: 0.35 },
  { t: 6.48 },
  { t: 6.72, armL: skullL, armR: skullR, lean: -0.06, headTurn: 0.25, nod: 0.25, jaw: 0.2, swing: 0.25, sad: 0.25 },
  { t: 8.55 },
  { t: 8.95, armL: lapL, armR: lapR, lean: 0, headTurn: -0.85, nod: 0, headTilt: 0.05, jaw: 0.1, swing: 0.8, sad: 0 },
  // 9-12 s: ticket again, sad shrug, lean back with hands behind the head
  { t: 9.15 },
  { t: 9.45, armL: readL, headTurn: -0.3, nod: 0.8, headTilt: -0.1 },
  { t: 9.72 },
  { t: 9.98, shrug: 1, sad: 1, headTilt: 0.22, nod: 0.3, headTurn: 0,
    armL: { ref: 'hip', p: [-47, -40], pref: [-0.2, 1], handAbs: Math.PI + 0.45, curl: 0.25, z: 1, tka: Math.PI - 0.3 },
    armR: { ref: 'hip', p: [47, -40], pref: [0.2, 1], handAbs: -0.45, curl: 0.0, z: 1 } },
  { t: 10.12 },
  { t: 10.42, shrug: 0, sad: 0.85, nod: 0.4, headTilt: 0.12, armL: lapL, armR: lapR },
  { t: 10.6 },
  { t: 11.25, recline: 1, x: 428, y: 1050, sad: 0.35, nod: -0.3, headTurn: -0.35, headTilt: 0.1, swing: 0.65,
    armL: { ref: 'head', p: [-11, 4], pref: [-1, -1], handAbs: 0.2, curl: 0.5, z: 1, tka: -0.5 },
    armR: { ref: 'head', p: [11, 4], pref: [1, -1], handAbs: Math.PI - 0.2, curl: 0.5, z: 1 } },
  { t: 12.5 },
];
// fill keys forward so every key is complete
(() => {
  let prev = walkPose(WALK.tStop);
  KEYS.unshift(prev);
  for (let i = 1; i < KEYS.length; i++) {
    const k = KEYS[i], out = { ...prev };
    for (const n of ['legL', 'legR']) out[n] = { ...prev[n], lift: 0 };
    Object.assign(out, k);
    out.caseSwing = 0;
    KEYS[i] = out; prev = out;
  }
})();

function poseAt(t) {
  let P;
  if (t <= WALK.tStop) {
    const w = walkPose(t);
    P = { ...w, armL: { a: w.armL, b: w.armL, u: 0 }, armR: { a: w.armR, b: w.armR, u: 0 }, legL: { a: w.legL, b: w.legL, u: 0 }, legR: { a: w.legR, b: w.legR, u: 0 } };
  } else {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const u = easeSine((t - A.t) / (B.t - A.t));
    P = { t };
    for (const n of SCALARS) P[n] = lerp(A[n], B[n], u);
    for (const n of ['armL', 'armR', 'legL', 'legR']) P[n] = { a: A[n], b: B[n], u };
    P.caseSwing = 0;
  }
  // ---- procedural layers on top of the keys
  const br = Math.sin(t * 2 * Math.PI / 3.4);
  P.headTilt += 0.012 * br;
  if (t > 5.5 && t < 5.98) {                         // shake the leaf off
    const e = Math.sin(Math.PI * (t - 5.5) / 0.48);
    P.headTilt += 0.3 * Math.sin(2 * Math.PI * 5.2 * (t - 5.5)) * e;
    P.headTurn += 0.3 * Math.sin(2 * Math.PI * 5.2 * (t - 5.5) + 1.2) * e;
    P.jaw += 0.2 * e;
  }
  const g = gust(t);
  if (g > 0) {                                        // wind from the train
    P.headLift += 2.6 * g + 1.3 * Math.sin(t * 31) * g;
    P.headTilt += 0.05 * Math.sin(t * 23) * g;
    P.jaw += 0.3 * (0.5 + 0.5 * Math.sin(t * 42)) * g;
    P.lean += 0.015 * Math.sin(t * 17) * g;
  }
  if (t > 11.2) P.headTilt += 0.04 * Math.sin((t - 11.2) * 1.6);
  return P;
}

function legAngles(k, hp, s) {
  if (k.fk) return [k.fk[0], k.fk[1], k.fs || 1];
  const r = ik2(hp, { x: k.ik[0], y: k.ik[1] }, RIG.thigh * s, RIG.shin * s, k.pref || [1, 0]);
  return [Math.atan2(r.mid.y - hp.y, r.mid.x - hp.x), Math.atan2(r.end.y - r.mid.y, r.end.x - r.mid.x), 1];
}
function solveLeg(L, hp, s, swingAdd) {
  const { a, b, u } = L;
  if (a.ik && b.ik) {
    const pa = a.pref || [1, 0], pb = b.pref || [1, 0];
    const tgt = { x: lerp(a.ik[0], b.ik[0], u), y: lerp(a.ik[1], b.ik[1], u) - (b.lift || 0) * Math.sin(Math.PI * u) };
    const r = ik2(hp, tgt, RIG.thigh * s, RIG.shin * s, [lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u)]);
    return { hip: hp, knee: r.mid, ankle: r.end };
  }
  const A = legAngles(a, hp, s), B = legAngles(b, hp, s);
  const a1 = lerpAng(A[0], B[0], u) + swingAdd * 0.12, a2 = lerpAng(A[1], B[1], u) + swingAdd, fs = lerp(A[2], B[2], u);
  const knee = { x: hp.x + Math.cos(a1) * RIG.thigh * s * fs, y: hp.y + Math.sin(a1) * RIG.thigh * s * fs };
  return { hip: hp, knee, ankle: { x: knee.x + Math.cos(a2) * RIG.shin * s, y: knee.y + Math.sin(a2) * RIG.shin * s } };
}
function armTarget(k, rig, P) {
  if (k.ref === 'head') { const r = rotv({ x: k.p[0] * rig.s, y: k.p[1] * rig.s }, rig.headRot); return { x: rig.cran.x + r.x, y: rig.cran.y + r.y }; }
  return { x: P.x + k.p[0] * rig.s, y: P.y + k.p[1] * rig.s };
}
function solveArm(A, sh, rig, P) {
  const { a, b, u } = A;
  const ta = armTarget(a, rig, P), tb = armTarget(b, rig, P);
  const pa = a.pref, pb = b.pref;
  const r = ik2(sh, { x: lerp(ta.x, tb.x, u), y: lerp(ta.y, tb.y, u) }, RIG.upper * rig.s, RIG.fore * rig.s, [lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u)]);
  const fa = Math.atan2(r.end.y - r.mid.y, r.end.x - r.mid.x);
  const ha = a.handAbs !== undefined ? a.handAbs : fa + (a.hand || 0);
  const hb = b.handAbs !== undefined ? b.handAbs : fa + (b.hand || 0);
  const handAng = lerpAng(ha, hb, u);
  return {
    sh, elbow: r.mid, wrist: r.end, handAng,
    curl: lerp(a.curl || 0, b.curl || 0, u),
    z: u < 0.5 ? (a.z ?? 1) : (b.z ?? 1),
    tka: lerpAng(a.tka || 0, b.tka || 0, u),
  };
}
function buildRig(P, t) {
  const s = P.sc, hip = { x: P.x, y: P.y }, lean = P.lean, prot = lean * 0.3;
  const at = (base, v, a) => { const r = rotv({ x: v[0] * s, y: v[1] * s }, a); return { x: base.x + r.x, y: base.y + r.y }; };
  const br = Math.sin(t * 2 * Math.PI / 3.4);
  const shY = RIG.shY - P.shrug * 7 + P.recline * 3 + br * 0.5;
  const rig = { s, hip, lean, prot, br, shY, at };
  rig.hipL = at(hip, [-RIG.hipX, RIG.hipY], prot); rig.hipR = at(hip, [RIG.hipX, RIG.hipY], prot);
  rig.shL = at(hip, [-RIG.shX, shY], lean); rig.shR = at(hip, [RIG.shX, shY], lean);
  rig.ribTop = at(hip, [0, -77 + P.recline * 3 - P.shrug * 3 + br * 0.4], lean);
  rig.neck = at(hip, [0, RIG.neck + P.shrug * 3 + P.recline * 5 + br * 0.4 - P.headLift], lean);
  rig.headRot = lean * 0.7 + P.headTilt;
  rig.cran = at(rig.neck, [0, -34], rig.headRot);
  const sw = P.swing, ph = 2 * Math.PI * t / 1.25;
  rig.legL = solveLeg(P.legL, rig.hipL, s, 0.22 * sw * Math.sin(ph));
  rig.legR = solveLeg(P.legR, rig.hipR, s, 0.22 * sw * Math.sin(ph + 2.3));
  rig.armL = solveArm(P.armL, rig.shL, rig, P);
  rig.armR = solveArm(P.armR, rig.shR, rig, P);
  return rig;
}

// ---------------------------------------------------------------- skeleton drawing
function line(c, a, b, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
function disc(c, p, r, col) { c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); }
function bone(c, a, b, w, o, knob = 0.78) {
  c.lineCap = 'round';
  line(c, a, b, w + 2 * o, INK); if (knob) { disc(c, a, w * knob + o, INK); disc(c, b, w * knob + o, INK); }
  line(c, a, b, w, BONE); if (knob) { disc(c, a, w * knob, BONE); disc(c, b, w * knob, BONE); }
}
function drawHand(c, wrist, ang, s, curl, o) {
  const palm = { x: wrist.x + Math.cos(ang) * 4 * s, y: wrist.y + Math.sin(ang) * 4 * s };
  const fl = (7.5 - 3.8 * curl) * s;
  const fingers = [-0.55, -0.15, 0.18, 0.5].map((da, i) => {
    const a = ang + da * (1 - 0.35 * curl), l = fl * (i === 0 ? 0.8 : 1);
    return [{ x: palm.x + Math.cos(a) * 2.6 * s, y: palm.y + Math.sin(a) * 2.6 * s }, { x: palm.x + Math.cos(a) * (2.6 * s + l), y: palm.y + Math.sin(a) * (2.6 * s + l) }];
  });
  c.lineCap = 'round';
  for (const f of fingers) line(c, f[0], f[1], 2.5 * s + 2 * o, INK);
  disc(c, palm, 4.7 * s + o, INK);
  for (const f of fingers) line(c, f[0], f[1], 2.5 * s, BONE);
  disc(c, palm, 4.7 * s, BONE);
}
function drawFoot(c, ankle, ang, s, o) {
  const d = dirv(ang);
  const heel = { x: ankle.x - d.x * 3 * s, y: ankle.y - d.y * 3 * s + 2.5 * s };
  const toe = { x: ankle.x + d.x * 13 * s, y: ankle.y + d.y * 13 * s + 2.5 * s };
  bone(c, heel, toe, 6.8 * s, o, 0.6);
}
function drawLeg(c, L, foot, s, o, w) {
  bone(c, L.hip, L.knee, w * 1.12, o);
  bone(c, L.knee, L.ankle, w, o);
  drawFoot(c, L.ankle, foot, s, o);
}
function drawPelvis(c, rig) {
  c.save(); c.translate(rig.hip.x, rig.hip.y); c.rotate(rig.prot); c.scale(rig.s, rig.s);
  c.beginPath();
  c.moveTo(-21, -6);
  c.bezierCurveTo(-23, -15, -12, -17, -6, -12);
  c.bezierCurveTo(-3, -10, 3, -10, 6, -12);
  c.bezierCurveTo(12, -17, 23, -15, 21, -6);
  c.bezierCurveTo(20, 2, 13, 8, 6, 9.5);
  c.bezierCurveTo(3, 10.5, -3, 10.5, -6, 9.5);
  c.bezierCurveTo(-13, 8, -20, 2, -21, -6);
  c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 2 * RIG.o; c.strokeStyle = INK; c.stroke(); c.fillStyle = BONE; c.fill();
  c.fillStyle = HOLE;
  c.beginPath(); c.ellipse(-8, 2.5, 3.4, 2.8, -0.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8, 2.5, 3.4, 2.8, 0.3, 0, Math.PI * 2); c.fill();
  c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -9); c.lineTo(0, -1); c.stroke();
  c.restore();
}
function vertebra(c, x, y, w, h) {
  c.beginPath(); rrPath(c, x - w / 2, y - h / 2, w, h, h / 2);
  c.lineWidth = 2 * RIG.o; c.strokeStyle = INK; c.stroke(); c.fillStyle = BONE; c.fill();
}
function drawTorso(c, rig, P) {
  c.save(); c.translate(rig.hip.x, rig.hip.y); c.rotate(rig.lean); c.scale(rig.s, rig.s);
  vertebra(c, 0, -18, 9, 5.5); vertebra(c, 0, -24.5, 9.5, 5.5);
  const dy = P.recline * 3 - P.shrug * 3, bs = 1 + 0.014 * rig.br, bt = P.bodyTurn;
  c.translate(0, dy - 52); c.scale(bs, bs); c.translate(0, 52);
  c.lineCap = 'round';
  // spine visible between the ribs
  line(c, { x: 0, y: -30 }, { x: 0, y: -76 }, 4.4 + 2 * RIG.o, INK); line(c, { x: 0, y: -30 }, { x: 0, y: -76 }, 4.4, BONE);
  const cx = bt * 4, shy = rig.shY - dy;
  const paths = [];
  paths.push([5.2, g => { g.moveTo(-RIG.shX, shy); g.quadraticCurveTo(cx, shy - 5, RIG.shX, shy); }]);
  [[-65, 20.5], [-55, 21.5], [-45, 20], [-35.5, 16.5]].forEach(([y, hw]) => {
    const wl = hw * (1 - 0.18 * Math.max(-bt, 0)), wr = hw * (1 - 0.18 * Math.max(bt, 0));
    paths.push([5.0, g => { g.moveTo(cx - wl, y + 6); g.quadraticCurveTo(cx + (wr - wl) * 0.5, y - 6, cx + wr, y + 6); }]);
  });
  paths.push([6.2, g => { g.moveTo(cx, -74); g.lineTo(cx, -49); }]);
  for (const [w, f] of paths) { c.strokeStyle = INK; c.lineWidth = w + 2 * RIG.o; c.beginPath(); f(c); c.stroke(); }
  for (const [w, f] of paths) { c.strokeStyle = BONE; c.lineWidth = w; c.beginPath(); f(c); c.stroke(); }
  c.restore();
}
function drawHead(c, rig, P) {
  const s = rig.s;
  // neck vertebrae
  for (const f of [0.3, 0.75]) {
    const p = { x: lerp(rig.ribTop.x, rig.neck.x, f), y: lerp(rig.ribTop.y, rig.neck.y, f) };
    c.save(); c.translate(p.x, p.y); c.rotate(rig.headRot * 0.5); c.scale(s, s); vertebra(c, 0, 0, 7.5, 4.6); c.restore();
  }
  c.save(); c.translate(rig.neck.x, rig.neck.y); c.rotate(rig.headRot); c.scale(s, s);
  const tr = clamp(P.headTurn, -1.2, 1.2), fx = tr * 8, ny = P.nod * 4;
  // jaw (separate piece, behind the skull)
  c.save(); c.translate(fx * 0.55, -6.5 + P.jaw * 3); c.rotate(P.jaw * 0.08 * Math.sign(tr || 1));
  c.beginPath(); rrPath(c, -13, -5, 26, 11, 5);
  c.lineWidth = 2 * RIG.o; c.strokeStyle = INK; c.stroke(); c.fillStyle = BONE; c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.95; c.lineCap = 'round';
  for (const x of [-7.5, -3.75, 0, 3.75, 7.5]) { c.beginPath(); c.moveTo(x, -5); c.lineTo(x, -1.3); c.stroke(); }
  c.restore();
  // cranium + upper jaw as one outlined piece
  const mx = fx * 0.6;
  c.beginPath(); c.ellipse(0, -34, 27, 25.5, 0, 0, Math.PI * 2); rrPath(c, mx - 15, -20.5, 30, 13, 5);
  c.lineWidth = 2 * RIG.o; c.strokeStyle = INK; c.stroke(); c.fillStyle = BONE; c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.95;
  for (const x of [-9, -4.5, 0, 4.5, 9]) { c.beginPath(); c.moveTo(mx + x, -11.5); c.lineTo(mx + x, -7.6); c.stroke(); }
  // big eye holes
  const exR = fx + 10.5 * (1 - 0.25 * Math.max(tr, 0)), exL = fx - 10.5 * (1 - 0.25 * Math.max(-tr, 0));
  const rxR = 8.6 * (1 - 0.35 * Math.max(tr, 0)), rxL = 8.6 * (1 - 0.35 * Math.max(-tr, 0)), ry = 10, ey = -35 + ny;
  c.fillStyle = HOLE;
  c.beginPath(); c.ellipse(exL, ey, rxL, ry, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(exR, ey, rxR, ry, 0, 0, Math.PI * 2); c.fill();
  if (P.sad > 0.01) {                                  // droopy brows: cover the outer top of each eye
    const sd = P.sad;
    c.fillStyle = BONE;
    c.beginPath(); c.moveTo(exL - rxL - 2, ey - ry - 2); c.lineTo(exL + rxL + 2, ey - ry - 2); c.lineTo(exL + rxL + 2, ey - ry + 0.5); c.lineTo(exL - rxL - 2, ey - ry + 8 * sd); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(exR + rxR + 2, ey - ry - 2); c.lineTo(exR - rxR - 2, ey - ry - 2); c.lineTo(exR - rxR - 2, ey - ry + 0.5); c.lineTo(exR + rxR + 2, ey - ry + 8 * sd); c.closePath(); c.fill();
  }
  // nose
  const nx = fx * 1.1, nyy = -21 + ny * 0.8;
  c.fillStyle = HOLE; c.beginPath();
  c.moveTo(nx, nyy - 5.5); c.quadraticCurveTo(nx - 4.6, nyy + 1, nx - 1.4, nyy + 2.2);
  c.quadraticCurveTo(nx, nyy + 1.2, nx + 1.4, nyy + 2.2); c.quadraticCurveTo(nx + 4.6, nyy + 1, nx, nyy - 5.5); c.fill();
  c.restore();
}

// ---- props
const CASE_K = 1.3, CASE_H = 62 * CASE_K;
function drawSuitcase(c, x, y, ang, s) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s * CASE_K, s * CASE_K);
  const o = RIG.o;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // handle
  c.strokeStyle = INK; c.lineWidth = 4.2 + 2 * o; c.beginPath(); c.moveTo(-9, 11); c.bezierCurveTo(-9, -1, 9, -1, 9, 11); c.stroke();
  c.strokeStyle = '#4a2a16'; c.lineWidth = 4.2; c.stroke();
  for (const sx of [-12, 7]) { c.beginPath(); rrPath(c, sx, 7, 5, 6, 1.5); c.fillStyle = '#c9a24a'; c.fill(); c.lineWidth = 1; c.strokeStyle = INK; c.stroke(); }
  // body
  c.beginPath(); rrPath(c, -37, 11, 74, 51, 6);
  const gr = c.createLinearGradient(0, 11, 0, 62); gr.addColorStop(0, '#946038'); gr.addColorStop(1, '#663b20');
  c.lineWidth = 2 * o; c.strokeStyle = INK; c.stroke(); c.fillStyle = gr; c.fill();
  c.save(); c.clip();
  c.fillStyle = '#3f2412';
  for (const [cx, cy] of [[-37, 11], [37, 11], [-37, 62], [37, 62]]) { c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#56301a'; c.fillRect(-21, 11, 6.5, 51); c.fillRect(14.5, 11, 6.5, 51);
  c.restore();
  c.strokeStyle = '#3b210f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-37, 23); c.lineTo(37, 23); c.stroke();
  c.setLineDash([2, 2]); c.strokeStyle = 'rgba(232,196,140,0.75)'; c.lineWidth = 0.8;
  c.beginPath(); rrPath(c, -33.5, 14.5, 67, 44, 4); c.stroke(); c.setLineDash([]);
  for (const bx of [-17.75, 17.75]) {
    c.beginPath(); rrPath(c, bx - 4.5, 25, 9, 7, 1.5); c.fillStyle = '#c9a24a'; c.fill(); c.lineWidth = 0.9; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#2c1a0e'; c.fillRect(bx - 1, 26.5, 2, 4);
  }
  c.beginPath(); rrPath(c, -4, 20, 8, 5.5, 1.2); c.fillStyle = '#d6b05a'; c.fill(); c.lineWidth = 0.9; c.strokeStyle = INK; c.stroke();
  // travel stickers
  c.save(); c.translate(24, 46); c.rotate(-0.12);
  c.beginPath(); rrPath(c, -9, -6, 18, 12, 2); c.fillStyle = '#efe0bf'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(60,30,15,0.6)'; c.stroke();
  c.strokeStyle = '#b4472b'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-6, -2); c.lineTo(5, -2); c.moveTo(-6, 1.5); c.lineTo(2, 1.5); c.stroke();
  c.restore();
  c.beginPath(); c.arc(-28, 33, 5.2, 0, Math.PI * 2); c.fillStyle = '#e8892f'; c.fill(); c.strokeStyle = '#f6e3b8'; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = '#f6e3b8'; c.beginPath(); c.arc(-28, 33, 1.6, 0, Math.PI * 2); c.fill();
  c.restore();
}
function drawTicket(c, arm, s) {
  const d = dirv(arm.handAng), p = { x: arm.wrist.x + d.x * 7 * s, y: arm.wrist.y + d.y * 7 * s };
  c.save(); c.translate(p.x, p.y); c.rotate(arm.tka); c.scale(s, s);
  c.beginPath(); rrPath(c, -4, -8.5, 31, 17, 1.6);
  c.lineWidth = 2 * 1.1; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#f5e6c2'; c.fill();
  c.fillStyle = '#c8492b'; c.fillRect(6, -8.5, 21, 4.2);
  c.setLineDash([1.6, 1.6]); c.strokeStyle = 'rgba(70,40,25,0.8)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(5, -8.5); c.lineTo(5, 8.5); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#6b4a36'; c.lineWidth = 1.1; c.lineCap = 'round';
  c.beginPath(); c.moveTo(9, 0); c.lineTo(23, 0); c.moveTo(9, 4); c.lineTo(18, 4); c.stroke();
  c.fillStyle = '#6b4a36'; c.beginPath(); c.arc(0.6, 0, 1.6, 0, Math.PI * 2); c.fill();
  c.restore();
}
function drawArm(c, arm, side, s, o, w, extras) {
  if (side > 0 && extras.case) drawSuitcase(c, extras.case.x, extras.case.y, extras.case.ang, s);
  bone(c, arm.sh, arm.elbow, w, o);
  bone(c, arm.elbow, arm.wrist, w * 0.92, o);
  if (side < 0) drawTicket(c, arm, s);
  drawHand(c, arm.wrist, arm.handAng, s, arm.curl, o);
}
function drawSkeleton(c, rig, P, extras) {
  const s = rig.s, o = RIG.o * s, w = RIG.w * s;
  const arms = [[rig.armR, 1], [rig.armL, -1]];
  for (const [a, side] of arms) if (a.z === 0) drawArm(c, a, side, s, o, w, extras);
  drawLeg(c, rig.legR, P.footR, s, o, w);
  drawLeg(c, rig.legL, P.footL, s, o, w);
  drawPelvis(c, rig);
  drawTorso(c, rig, P);
  for (const [a, side] of arms) if (a.z === 1) drawArm(c, a, side, s, o, w, extras);
  drawHead(c, rig, P);
  for (const [a, side] of arms) if (a.z === 2) drawArm(c, a, side, s, o, w, extras);
}

// ---- suitcase state
const CASE_RELEASE = 3.05;
let CASE_GROUND = null;
function heldCase(rig, P) {
  const a = rig.armR, d = dirv(a.handAng);
  return { x: a.wrist.x + d.x * 3.5 * rig.s, y: a.wrist.y + d.y * 3.5 * rig.s - 3 * rig.s, ang: P.caseSwing || 0, s: rig.s };
}
function caseState(t, rig, P) {
  if (t < CASE_RELEASE) return { held: true, ...heldCase(rig, P) };
  if (!CASE_GROUND) {
    const P0 = poseAt(CASE_RELEASE), r0 = buildRig(P0, CASE_RELEASE), h = heldCase(r0, P0);
    CASE_GROUND = { x: h.x, y0: h.y, y1: groundY(h.x) - CASE_H * h.s + 1, s: h.s };
  }
  const G = CASE_GROUND, u = clamp((t - CASE_RELEASE) / 0.11, 0, 1);
  let y = lerp(G.y0, G.y1, u * u), ang = 0;
  if (t > CASE_RELEASE + 0.11) { const v = t - CASE_RELEASE - 0.11; y -= 2.2 * Math.abs(Math.sin(v * 22)) * Math.exp(-v * 14); ang = 0.03 * Math.sin(v * 25) * Math.exp(-v * 9); }
  return { held: false, x: G.x, y, ang, s: G.s };
}

// ---- the leaf that lands on the skull
const SKULL_LEAF = { col: 2, size: 52, blur: false, t0: 1.6, tLand: 5.2, tOff: 5.64 };
let SL_LAND = null, SL_OFF = null;
function skullLeafAnchor(rig) { const r = rotv({ x: 5 * rig.s, y: -27.5 * rig.s }, rig.headRot); return { x: rig.cran.x + r.x, y: rig.cran.y + r.y, rot: rig.headRot + 0.35 }; }
function skullLeafWorld(t) {
  const L = SKULL_LEAF;
  if (t < L.t0) return null;
  if (!SL_LAND) { const P = poseAt(L.tLand); SL_LAND = skullLeafAnchor(buildRig(P, L.tLand)); }
  if (t < L.tLand) {
    const T = L.tLand - L.t0, tau = (t - L.t0) / T, x0 = 545, y0 = 405;
    const x = lerp(x0, SL_LAND.x, tau) + 46 * Math.sin(2.4 * (t - L.tLand)) * (1 - tau * 0.3);
    const y = lerp(y0, SL_LAND.y, 0.6 * tau + 0.4 * easeSine(tau));
    const rot = SL_LAND.rot + 1.6 * Math.sin(1.7 * (t - L.tLand)) * (1 - tau);
    const flip = 2.2 * (L.tLand - t) * (1 - tau) + 0;
    return { x, y, rot, flip };
  }
  if (t < L.tOff) { const P = poseAt(t), a = skullLeafAnchor(buildRig(P, t)); return { x: a.x, y: a.y, rot: a.rot, flip: 0 }; }
  if (!SL_OFF) { const P = poseAt(L.tOff); SL_OFF = skullLeafAnchor(buildRig(P, L.tOff)); }
  const v = t - L.tOff;
  let gx = 0; for (let tt = L.tOff; tt < t; tt += 1 / 120) gx += windX(tt) * 0.9 / 120;
  const vy = v < 0.68 ? -60 * v + 110 * v * v : -60 * 0.68 + 110 * 0.4624 + 90 * (v - 0.68);
  return { x: SL_OFF.x + 150 * Math.min(v, 0.5) + 30 * Math.max(0, v - 0.5) + 22 * Math.sin(3 * v) + gx, y: SL_OFF.y + vy, rot: SL_OFF.rot + 4 * v, flip: 5 * v };
}

// ---------------------------------------------------------------- frame
let BG = null, FG = null;
const skCv = mk(W, H), skCtx = skCv.getContext('2d');
const litCv = mk(W, H), litCtx = litCv.getContext('2d');
const GRAIN = (() => {
  const r = rng(42), out = [];
  for (let n = 0; n < 4; n++) {
    const c = mk(600, 1010), g = c.getContext('2d'), id = g.createImageData(600, 1010);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (r() + r() + r() - 1.5) * 70;
      id.data[i] = v + 6; id.data[i + 1] = v; id.data[i + 2] = v - 8; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0); out.push(c);
  }
  return out;
})();

function drawShadows(c, rig, P, t, cs) {
  const s = rig.s, al = rig.legL.ankle, ar = rig.legR.ankle;
  const ax = (al.x + ar.x) / 2;
  const sit = smooth((t - 3.55) / 0.3);
  const gy = lerp(groundY(ax), 1180, sit);
  const hgt = gy - Math.max(al.y, ar.y) - RIG.ankle * s;
  const a = lerp(0.42, 0.26, sit) * clamp(1 - hgt / 140, 0.35, 1);
  softEllipse(c, ax - 12, gy + 2, 40 * s, 8 * s, a);
  if (sit > 0) softEllipse(c, rig.hip.x + 8, 1062, 34 * s, 5 * s, 0.22 * sit);   // on the seat under the pelvis
  const cy = groundY(cs.x);
  const ch = cy - (cs.y + CASE_H * cs.s);
  softEllipse(c, cs.x - 10, cy + 1, 58 * cs.s, 8 * cs.s, 0.42 * clamp(1 - ch / 90, 0.25, 1));
}

function drawSkeletonLayer(t, cam, P, rig, cs) {
  const c = skCtx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
  applyCam(c, cam);
  if (!cs.held) drawSuitcase(c, cs.x, cs.y, cs.ang, cs.s);
  drawSkeleton(c, rig, P, { case: cs.held ? cs : null });
  // warm sunset light from the upper right, cooler shade on the left
  // (multiply keeps the black eye holes black; then clip back to the skeleton)
  const hs = toScreen(cam, rig.hip), l = litCtx;
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, W, H);
  l.drawImage(skCv, 0, 0);
  l.globalCompositeOperation = 'multiply';
  const g = l.createLinearGradient(hs.x - 150, hs.y + 90, hs.x + 120, hs.y - 210);
  g.addColorStop(0, 'rgb(212,176,156)'); g.addColorStop(0.5, 'rgb(252,240,226)'); g.addColorStop(1, 'rgb(255,200,140)');
  l.fillStyle = g; l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'destination-in'; l.drawImage(skCv, 0, 0);
  l.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(255,145,55,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = -3;
  ctx.drawImage(litCv, 0, 0);
  ctx.restore();
}

function drawText(t, fade) {
  const a = smooth((t - 1.0) / 0.9);
  if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a * (1 - 0.1 * fade); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '72px Gloria';
  const dy = (1 - a) * 14;
  const lines = [['Waiting for October', 505 + dy], ['to come back', 597 + dy]];
  ctx.fillStyle = '#fffaf0';
  ctx.shadowColor = 'rgba(40,14,2,0.7)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 5;
  for (const [s, y] of lines) ctx.fillText(s, W / 2, y);
  ctx.shadowColor = 'rgba(30,10,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  for (const [s, y] of lines) ctx.fillText(s, W / 2, y);
  ctx.restore();
}
function drawWatermark() {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '36px Patrick'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('@Grace In Motion', W - 38, H - 46);
  ctx.restore();
}
function post(t, frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.52, 380, W / 2, H * 0.52, 1250);
  v.addColorStop(0, 'rgba(25,9,3,0)'); v.addColorStop(1, 'rgba(25,9,3,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // warm film grain
  const r = rng(frame * 7 + 3);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.11;
  ctx.drawImage(GRAIN[frame % 4], -r() * 100, -r() * 90, 1200, 2020);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

function render(t) {
  const frame = Math.round(t * FPS);
  simulate(t);
  const cam = camera(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  applyCam(ctx, cam);
  ctx.drawImage(BG, 0, 0, IW, IH);
  drawGlows(ctx, t);
  const trainOn = t > TRAIN_T0 && t < TRAIN_T1;
  if (trainOn) {
    renderTrainLayer(t, cam);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'blur(1.3px)'; ctx.drawImage(trCv, 0, 0); ctx.filter = 'none';
  }
  if (STEAM.length) { applyCam(ctx, cam); drawSteam(ctx); }
  if (trainOn || STEAM.length) { applyCam(ctx, cam); ctx.drawImage(FG, 0, 0, IW, IH); }

  const P = poseAt(t), rig = buildRig(P, t), cs = caseState(t, rig, P);
  applyCam(ctx, cam); drawShadows(ctx, rig, P, t, cs);
  drawLeafLayer(ctx, false, t);
  drawSkeletonLayer(t, cam, P, rig, cs);
  const sl = skullLeafWorld(t);
  if (sl) { const p = toScreen(cam, sl); drawLeaf(ctx, SKULL_LEAF, p.x, p.y, sl.rot, sl.flip, cam.S / 1.15); }
  drawLeafLayer(ctx, true, t);
  post(t, frame);
  const fade = smooth((t - 10.4) / 1.6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(12,4,1,${0.36 * fade})`; ctx.fillRect(0, 0, W, H);
  drawText(t, fade);
  drawWatermark();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------- boot
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
window.ready = (async () => {
  [BG, FG] = await Promise.all([loadImg('build/bg_2x.png'), loadImg('build/fg_2x.png')]);
  await Promise.all([document.fonts.load('72px Gloria'), document.fonts.load('36px Patrick')]);
  TRAIN = makeTrain();
  resetSim();
  return true;
})();
window.renderAt = t => { render(t); };
window.frameData = (type, q) => canvas.toDataURL(type || 'image/png', q);
window.META = { W, H, FPS, DUR };
