// Brushstroke Disc — silent generative motion piece.
// Every frame is a pure function of time t (seconds): renderFrame(t) can be
// called in any order, which lets the offline renderer split work across pages.
'use strict';

const W = 1920, H = 1080, DUR = 30.0;
const INK = 'rgb(236,232,223)';
const BG = '#0f0f0e';
const CX = 1330, CY = 540, R0 = 372;

/* ------------------------------------------------------------------ math */

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const eInExpo = t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const eInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eInOutQuart = t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
const eOutQuart = t => 1 - Math.pow(1 - t, 4);
const eOutCubic = t => 1 - Math.pow(1 - t, 3);
const eInCubic = t => t * t * t;
const TAU = Math.PI * 2;

function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x165667b1) ^ Math.imul((c | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function rng(seed) { let i = 0; return () => hash3(seed, i++, 1013); }

function noise1(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash3(i, seed, 11), hash3(i + 1, seed, 11), u);
}
function noise2(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash3(ix, iy * 7919 + seed, 5), b = hash3(ix + 1, iy * 7919 + seed, 5);
  const c = hash3(ix, (iy + 1) * 7919 + seed, 5), d = hash3(ix + 1, (iy + 1) * 7919 + seed, 5);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/* -------------------------------------------------------------- timeline */

// Section text is exactly the on-screen text of the reference, in order.
// word: [text, time-in, reveal type, flags]
const SECTIONS = [
  { x: 176, yc: 520, size: 100, lineH: 112, blockW: 0, lines: [
      { just: false, words: [['So', 1.0, 'scan'], ['take', 1.5, 'rise'], ['aim', 2.3, 'track']] },
      { just: false, words: [['and', 3.0, 'slide'], ['fire', 3.5, 'ink'], ['away', 4.0, 'stretch', 'serif']] },
    ], out: { type: 'particles', t: 4.62, dur: 0.8 } },
  { x: 176, yc: 530, size: 100, lineH: 112, blockW: 560, lines: [
      { just: true, words: [["I've", 5.1, 'bars'], ['never', 5.32, 'track']] },
      { just: true, words: [['been', 6.0, 'rise'], ['so', 6.5, 'slide']] },
      { just: true, words: [['wide', 7.0, 'ink'], ['awake', 7.42, 'stretch', 'serif']] },
    ], marks: [{ type: 'underline', line: 2, t: 7.78, dur: 0.42 }],
    out: { type: 'ring', t: 8.2, dur: 0.9 } },
  { x: 176, yc: 530, size: 96, lineH: 106, blockW: 560, lines: [
      { just: true, words: [['No,', 8.55, 'scan'], ['nobody', 9.4, 'track']] },
      { just: false, words: [['but', 10.0, 'rise'], ['me', 10.4, 'rise'], ['can', 10.8, 'slide']] },
      { just: true, words: [['keep', 11.1, 'ink'], ['me', 11.5, 'bars']] },
      { just: false, words: [['safe', 12.0, 'stretch', 'serif']] },
    ], marks: [{ type: 'loop', line: 3, word: 0, t: 12.3, dur: 0.55 }],
    out: { type: 'sweep', t: 13.05, dur: 0.75 } },
  { x: 176, yc: 850, size: 124, lineH: 0, blockW: 0, behind: true, breathe: 0.05, lines: [
      { just: false, words: [['And', 13.45, 'slide'], ["I'm", 13.75, 'rise'], ['on', 14.05, 'scan'], ['my', 14.3, 'track'], ['away', 14.52, 'ink', 'serif']] },
    ], out: { type: 'slice', t: 14.9, dur: 0.42 } },
  { x: 176, yc: 530, size: 96, lineH: 106, blockW: 540, lines: [
      { just: true, words: [['The', 15.05, 'ink'], ['blood', 15.5, 'track']] },
      { just: true, words: [['moon', 16.0, 'rise'], ['is', 16.9, 'scan']] },
      { just: true, words: [['on', 17.3, 'slide'], ['the', 17.55, 'slide']] },
      { just: false, words: [['rise', 18.0, 'stretch', 'serif']] },
    ], out: { type: 'particles', t: 18.35, dur: 0.95 } },
  { x: 176, yc: 530, size: 100, lineH: 112, blockW: 560, lines: [
      { just: true, words: [['The', 18.6, 'bars'], ['fire', 19.0, 'ink']] },
      { just: true, words: [['burning', 19.5, 'track'], ['in', 20.4, 'rise']] },
      { just: true, words: [['my', 20.8, 'slide'], ['eyes', 21.1, 'stretch', 'serif']] },
    ], marks: [{ type: 'underline', line: 2, word: 1, t: 21.5, dur: 0.4 }],
    out: { type: 'ring', t: 22.1, dur: 0.9 } },
  { x: 176, yc: 530, size: 96, lineH: 106, blockW: 560, lines: [
      { just: true, words: [['No,', 22.5, 'bars'], ['nobody', 23.0, 'slide']] },
      { just: false, words: [['but', 23.5, 'scan'], ['me', 23.9, 'rise'], ['can', 24.4, 'track']] },
      { just: true, words: [['keep', 24.9, 'rise'], ['me', 25.4, 'slide']] },
      { just: false, words: [['safe', 25.9, 'ink', 'serif']] },
    ], marks: [{ type: 'loop', line: 3, word: 0, t: 26.2, dur: 0.5 }],
    out: { type: 'sweep', t: 26.7, dur: 0.75 } },
  { x: 176, yc: 578, size: 124, lineH: 0, blockW: 0, behind: true, breathe: 0.06, lines: [
      { just: false, words: [['And', 27.0, 'rise'], ["I'm", 27.35, 'slide'], ['on', 27.65, 'bars'], ['my', 28.0, 'scan'], ['away', 28.35, 'stretch', 'serif']] },
    ], out: { type: 'particles', t: 29.05, dur: 0.9, sink: true } },
];

// Energy bursts: [time, amplitude, time constant]. Fast attack, long calm decay.
const BURSTS = [
  [0.95, 0.8, 0.10], [4.62, 1.0, 0.08], [8.2, 1.45, 0.08], [13.05, 0.9, 0.08],
  [14.9, 1.0, 0.07], [18.35, 1.1, 0.08], [22.1, 1.5, 0.08], [26.7, 1.0, 0.08], [28.95, 1.9, 0.1],
];
for (const s of SECTIONS) for (const l of s.lines) for (const w of l.words) BURSTS.push([w[1], 0.16, 0.05]);

const RINGS = [
  { t: 0.9, n: 2, soft: true },
  { t: 8.2, n: 4 },
  { t: 22.1, n: 5 },
  { t: 28.95, n: 6 },
];

const OUTRO = 28.95;

function pulse(u) { return u <= 0 ? 0 : (u * u * Math.exp(-u)) / 2 / 0.2707; }
function cum(u) { return u <= 0 ? 0 : 1 - (1 + u + u * u / 2) * Math.exp(-u); }
function energy(t) { let e = 0; for (const b of BURSTS) e += b[1] * pulse((t - b[0]) / b[2]); return e; }
function spin(t) { let s = 0; for (const b of BURSTS) s += b[1] * cum((t - b[0]) / b[2]); return s; }

/* --------------------------------------------------------------- canvases */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const discCv = mkCanvas(W, H), discCx = discCv.getContext('2d');
const secCv = mkCanvas(W, H), secCx = secCv.getContext('2d');
const wordCv = mkCanvas(W, 420), wordCx = wordCv.getContext('2d');
const fxCv = mkCanvas(W, H), fxCx = fxCv.getContext('2d');

let GRAIN = [], PAPER, HOLES, HOLES_DISC, holesPat, holesDiscPat;

function buildTextures() {
  // Film grain: signed luminance noise, rendered at half-res and upscaled.
  for (let g = 0; g < 8; g++) {
    const c = mkCanvas(W / 3, H / 3), x = c.getContext('2d');
    const id = x.createImageData(c.width, c.height), d = id.data, r = rng(9000 + g);
    for (let i = 0; i < d.length; i += 4) {
      const v = (r() + r() + r() - 1.5);
      if (v > 0) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, v * 22); }
      else { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.min(255, -v * 60); }
    }
    x.putImageData(id, 0, 0);
    GRAIN.push(c);
  }
  // Paper mottling: low-frequency unevenness + faint photocopy streaks.
  PAPER = mkCanvas(W, H);
  {
    const sm = mkCanvas(240, 135), sx = sm.getContext('2d');
    const id = sx.createImageData(240, 135), d = id.data;
    for (let y = 0; y < 135; y++) for (let x = 0; x < 240; x++) {
      const n = noise2(x / 14, y / 14, 31) * 0.6 + noise2(x / 5, y / 5, 32) * 0.4;
      const i = (y * 240 + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.max(0, (n - 0.35)) * 30;
    }
    sx.putImageData(id, 0, 0);
    const p = PAPER.getContext('2d');
    p.imageSmoothingQuality = 'high';
    p.drawImage(sm, 0, 0, W, H);
    const r = rng(77);
    for (let k = 0; k < 7; k++) {
      const y = r() * H, h = 1 + r() * 5;
      p.fillStyle = `rgba(255,255,255,${0.008 + r() * 0.014})`;
      p.fillRect(0, y, W, h);
    }
    const vg = p.createRadialGradient(W * 0.55, H * 0.5, H * 0.35, W * 0.55, H * 0.5, H * 1.15);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    p.fillStyle = vg; p.fillRect(0, 0, W, H);
  }
  // Dry-ink holes: specks and toner drop-outs punched out of text and paint.
  const mkHoles = (seed, count, maxR, streaks) => {
    const c = mkCanvas(1024, 1024), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = '#000';
    for (let k = 0; k < count; k++) {
      const px = r() * 1024, py = r() * 1024, rad = 0.4 + Math.pow(r(), 3) * maxR;
      x.globalAlpha = 0.35 + r() * 0.65;
      x.beginPath();
      const n = 5 + (r() * 3 | 0);
      for (let v = 0; v < n; v++) {
        const a = (v / n) * TAU, rr = rad * (0.55 + r() * 0.7);
        v ? x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : x.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
      x.fill();
    }
    x.globalAlpha = 0.5;
    for (let k = 0; k < streaks; k++) {
      const py = r() * 1024; x.fillRect(0, py, 1024, 0.6 + r() * 1.4);
    }
    return c;
  };
  HOLES = mkHoles(4242, 9000, 2.4, 10);
  HOLES_DISC = mkHoles(4343, 5000, 1.8, 0);
  holesPat = ctx.createPattern(HOLES, 'repeat');
  holesDiscPat = ctx.createPattern(HOLES_DISC, 'repeat');
}

/* ---------------------------------------------------------- brush engine */

// Paints one arc stroke from s0..s1 (0..1 along the stroke) as a painted ribbon
// plus independent dry bristles. Texture is keyed to stroke coordinate s so it
// never crawls while the stroke draws or erases itself.
function arcStroke(c, S, s0, s1, time) {
  if (s1 - s0 < 0.002 || S.alpha <= 0.003) return;
  const r = S.r, len = S.len;
  const arcPx = Math.max(1, Math.abs(len) * r);
  const step = S.step || (r > 900 ? 9 : 5);
  const ds = step / arcPx;
  const j0 = Math.ceil(s0 / ds), j1 = Math.floor(s1 / ds);
  const ss = [s0];
  for (let j = j0; j <= j1; j++) ss.push(j * ds);
  ss.push(s1);
  const n = ss.length;
  const cs = new Float32Array(n), sn = new Float32Array(n), rr = new Float32Array(n);
  const wobF = S.wobF || 1.6, seed = S.seed;
  for (let i = 0; i < n; i++) {
    const s = ss[i];
    const th = S.rot + S.a0 + S.dir * s * len;
    cs[i] = Math.cos(th); sn[i] = Math.sin(th);
    rr[i] = r + S.rOff + (S.drift || 0) * (s - 0.5) + S.wob * (noise2(s * Math.abs(len) * wobF + (seed % 97), time * 0.35, seed) - 0.5) * 2;
  }
  const w = S.w;
  // painted core ribbon with a torn, uneven edge
  if (S.core > 0 && w > 2.2) {
    c.globalAlpha = S.alpha * S.core;
    c.beginPath();
    const edge = (i, side) => {
      const s = ss[i];
      const tp = smooth(0, 0.07, s) * Math.pow(smooth(1, 0.8, s), 0.6);
      const hw = w * 0.5 * tp * (0.65 + 0.6 * noise1(s * arcPx / 55, seed + side)) * 0.8
        * (0.85 + 0.3 * noise1(s * arcPx / 7, seed + side * 5));
      return rr[i] + (side === 3 ? hw : -hw);
    };
    for (let i = 0; i < n; i++) { const rad = edge(i, 3); i ? c.lineTo(S.cx + cs[i] * rad, S.cy + sn[i] * rad) : c.moveTo(S.cx + cs[i] * rad, S.cy + sn[i] * rad); }
    for (let i = n - 1; i >= 0; i--) { const rad = edge(i, 9); c.lineTo(S.cx + cs[i] * rad, S.cy + sn[i] * rad); }
    c.closePath();
    c.fill();
  }
  // dry bristles
  const nb = S.nb, spread = S.spread || 1, dry = S.dry;
  for (let b = 0; b < nb; b++) {
    const hb = seed * 31 + b * 7;
    if (S.dropout && hash3(hb, 3, 3) < S.dropout) continue;
    const u1 = hash3(hb, 1, 1), u2 = hash3(hb, 2, 1), u3 = hash3(hb, 3, 1), u4 = hash3(hb, 4, 1);
    const across = nb === 1 ? 0 : (b + 0.5) / nb - 0.5;
    const ob = across * w * spread + (u1 - 0.5) * (w / nb);
    const lw = Math.max(0.55, (w / nb) * (0.45 + u2 * 0.95) * (S.bw || 1));
    const eb = 1 - dry * u3 * 0.55 * (0.35 + Math.abs(across) * 1.6);
    const sb = dry * u4 * 0.12 * (0.3 + Math.abs(across) * 1.4);
    const thr = dry * (0.18 + 0.45 * hash3(hb, 5, 1));
    const fq = 1 / (18 + 46 * hash3(hb, 6, 1));
    const baseA = S.alpha * (0.35 + 0.65 * hash3(hb, 7, 1));
    // bristle is stroked in short chunks so pressure (width) and paint load
    // (opacity) vary along its length
    let pen = false, cnt = 0, lx = 0, ly = 0, ls = 0;
    const flush = () => {
      if (cnt > 0) {
        const pr = noise1(ls * arcPx / 38, hb + 1);
        c.lineWidth = lw * (0.45 + 1.1 * pr);
        c.globalAlpha = baseA * (0.55 + 0.45 * noise1(ls * arcPx / 60, hb + 2));
        c.stroke();
      }
      cnt = 0;
    };
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const s = ss[i];
      const vis = s >= sb && s <= eb && (thr <= 0 || noise1(s * arcPx * fq, hb) > thr);
      if (vis) {
        const rad = rr[i] + ob;
        const x = S.cx + cs[i] * rad, y = S.cy + sn[i] * rad;
        if (pen) { c.lineTo(x, y); cnt++; } else { c.moveTo(x, y); pen = true; }
        lx = x; ly = y; ls = s;
        if (cnt >= 6) { flush(); c.beginPath(); c.moveTo(lx, ly); }
      } else if (pen) { pen = false; flush(); c.beginPath(); }
    }
    flush();
  }
}

/* ------------------------------------------------------------- the disc */

// Layer specs. Each layer owns N slots; every slot endlessly regenerates new
// strokes (draw in → live → erase / break / smear / retract) on its own clock.
const MODES = ['chase', 'reverse', 'break', 'smear', 'dropout'];

function makeLayers() {
  const L = [];
  const R = R0;
  // outer rim: rough, heavy, irregular edge
  L.push({ id: 1, n: 60, pMin: 3.2, pMax: 7.5, omega: [0.16, 0.26], boost: [0.6, 1.1], sign: 1,
    radius: k => R * (0.935 + 0.11 * Math.pow(hash3(k, 1, 2), 1.3)),
    style: (k, c, r) => ({ len: 0.3 + 1.5 * r(), w: 4 + 30 * Math.pow(r(), 1.6), nb: 7 + (r() * 11 | 0), alpha: 0.55 + 0.45 * r(), dry: 0.45 + 0.55 * r(), core: 0.1 + 0.45 * r(), wob: 2 + 6 * r(), drift: (r() - 0.5) * 50 }),
    birth: k => 0.55 + 0.75 * hash3(k, 9, 1), disp: 0.07 });
  // data area: hundreds of thin concentric dry arcs on grooved tracks
  L.push({ id: 2, n: 250, pMin: 2.6, pMax: 8.0, omega: [0.08, 0.62], boost: [0.3, 2.6], sign: 0,
    radius: k => {
      const u = hash3(k, 1, 2);
      const raw = 0.37 + 0.56 * Math.pow(u, 0.85);
      if (hash3(k, 2, 2) < 0.55) { const tr = Math.round(raw * 14) / 14; return R * clamp(tr + (hash3(k, 3, 2) - 0.5) * 0.012, 0.37, 0.93); }
      return R * raw;
    },
    style: (k, c, r) => { const w = 1.1 + 7 * Math.pow(r(), 2.2); return { len: 0.25 + 2.3 * Math.pow(r(), 1.3), w, nb: 1 + (r() * 3 | 0) + (w > 4 ? 3 : 0), alpha: 0.3 + 0.6 * r(), dry: 0.25 + 0.7 * r(), core: 0.35 * r(), wob: 0.8 + 2.6 * r(), drift: (r() - 0.5) * 14 }; },
    birth: k => 0.2 + 0.6 * ((hash3(k, 1, 2))) + 0.5 * hash3(k, 9, 1), disp: 0.05, shine: 1 });
  // reflection wedges: dense dry-brush arcs clustered around two rotating angles
  L.push({ id: 3, n: 150, pMin: 1.8, pMax: 4.5, omega: [0, 0], boost: [0, 0], sign: 1, wedge: true,
    radius: k => R * (0.38 + 0.56 * hash3(k, 1, 2)),
    style: (k, c, r) => ({ len: 0.1 + 0.55 * r(), w: 4 + 22 * Math.pow(r(), 1.4), nb: 5 + (r() * 9 | 0), alpha: 0.6 + 0.4 * r(), dry: 0.6 + 0.4 * r(), core: 0.2 * r(), wob: 1 + 3 * r(), drift: (r() - 0.5) * 20 }),
    birth: k => 0.8 + 0.7 * hash3(k, 9, 1), disp: 0.06 });
  // hub: stacking ring
  L.push({ id: 4, n: 16, pMin: 3.5, pMax: 6.5, omega: [0.2, 0.34], boost: [0.8, 1.3], sign: 1,
    radius: k => R * (0.335 + 0.02 * hash3(k, 1, 2)),
    style: (k, c, r) => ({ len: 0.7 + 1.9 * r(), w: 4 + 12 * r(), nb: 5 + (r() * 6 | 0), alpha: 0.7 + 0.3 * r(), dry: 0.35 + 0.55 * r(), core: 0.35, wob: 1.5 + 2.5 * r(), drift: (r() - 0.5) * 12 }),
    birth: k => 0.2 + 0.35 * hash3(k, 9, 1), disp: 0.03 });
  // hub: clamp area, faint
  L.push({ id: 5, n: 22, pMin: 2.5, pMax: 5.5, omega: [-0.5, -0.2], boost: [-1.2, -0.4], sign: 1,
    radius: k => R * (0.17 + 0.13 * hash3(k, 1, 2)),
    style: (k, c, r) => ({ len: 0.5 + 2.2 * r(), w: 1 + 3.5 * r(), nb: 1 + (r() * 3 | 0), alpha: 0.2 + 0.4 * r(), dry: 0.5 + 0.5 * r(), core: 0.3, wob: 0.8 + 1.5 * r() }),
    birth: k => 0.15 + 0.4 * hash3(k, 9, 1), disp: 0.02 });
  // hub: centre hole edge — thick painted ring that keeps the hole open
  L.push({ id: 6, n: 14, pMin: 3.0, pMax: 6.0, omega: [0.3, 0.5], boost: [1.0, 1.6], sign: 1,
    radius: k => R * (0.118 + 0.012 * hash3(k, 1, 2)),
    style: (k, c, r) => ({ len: 1.2 + 2.2 * r(), w: 7 + 11 * r(), nb: 6 + (r() * 5 | 0), alpha: 0.8 + 0.2 * r(), dry: 0.3 + 0.5 * r(), core: 0.45, wob: 1 + 2 * r(), step: 3, drift: (r() - 0.5) * 8 }),
    birth: k => 0.1 + 0.3 * hash3(k, 9, 1), disp: 0.02 });
  // smears: long hairline multi-bristle arcs that mostly live inside bursts
  L.push({ id: 7, n: 18, pMin: 1.6, pMax: 3.2, omega: [0.5, 1.1], boost: [2.0, 3.5], sign: 0, smear: true,
    radius: k => R * (0.45 + 0.6 * hash3(k, 1, 2)),
    style: (k, c, r) => ({ len: 1.8 + 3.2 * r(), w: 14 + 34 * r(), nb: 10 + (r() * 12 | 0), alpha: 0.18 + 0.2 * r(), dry: 0.7 + 0.3 * r(), core: 0, wob: 2 + 4 * r(), bw: 0.35 }),
    birth: k => 1.0 + 0.5 * hash3(k, 9, 1), disp: 0.1 });
  return L;
}
const LAYERS = makeLayers();

function discRadius(t) {
  return R0 * (1 + 0.012 * Math.sin(t * 0.41 + 0.6)) * (1 + 0.018 * energy(t));
}
function wedgeAngle(t) { return -0.75 + 0.1 * t + 0.35 * spin(t); }

function drawDiscLayer(c, Lr, t, E, SP, R) {
  const baseR = R / R0;
  for (let k = 0; k < Lr.n; k++) {
    const birth = Lr.birth(k);
    if (t < birth) continue;
    const P = lerp(Lr.pMin, Lr.pMax, hash3(Lr.id, k, 1));
    const off = hash3(Lr.id, k, 2) * P * 0.5;
    const tEnd = OUTRO + 0.05 + 0.34 * hash3(Lr.id, k, 4) * (0.4 + 0.6 * (Lr.radius(k) / R0));
    const tl = Math.min(t, tEnd);
    let tt = tl - birth;
    // first cycle begins at birth; later cycles are offset per slot
    let cyc, lt;
    if (tt < P) { cyc = 0; lt = tt; }
    else { const t2 = tt - P + off; cyc = 1 + Math.floor(t2 / P); lt = t2 - (cyc - 1) * P; }
    const r = rng(Lr.id * 100003 + k * 131 + cyc * 7);
    const st = Lr.style(k, cyc, r);
    const d0 = cyc === 0 ? 0 : P * 0.06 * r();
    const drawIn = P * lerp(0.12, 0.3, r()) * (cyc === 0 ? 0.7 : 1);
    const eraseDur = P * lerp(0.12, 0.22, r());
    const eraseAt = P * 0.97 - eraseDur - P * 0.2 * r();
    const mode = Lr.smear ? 'smear' : MODES[(r() * MODES.length) | 0];
    const a0base = r() * TAU;
    const dirSign = Lr.sign === 0 ? (hash3(Lr.id, k, 5) < 0.5 ? -1 : 1) : Lr.sign;
    if (lt < d0) continue;
    let s0 = 0, s1 = eInOutCubic(clamp((lt - d0) / drawIn));
    let brk = 0, sm = 0, drop = 0;
    if (lt > eraseAt) {
      const ue = clamp((lt - eraseAt) / eraseDur);
      if (ue >= 1) continue;
      if (mode === 'chase') s0 = eInOutCubic(ue);
      else if (mode === 'reverse') s1 = Math.min(s1, 1 - eInOutCubic(ue));
      else if (mode === 'break') brk = ue;
      else if (mode === 'smear') sm = ue;
      else drop = ue;
    }
    // outro: everything breaks apart and is thrown outward
    let fe = 0;
    if (t > tEnd) { fe = clamp((t - tEnd) / 0.5); if (fe >= 1) continue; brk = Math.max(brk, fe); drop = Math.max(drop, fe * 0.85); }
    // smear layer lives mostly inside bursts
    let alpha = st.alpha;
    if (Lr.smear) alpha *= clamp(0.18 + E * 0.9);

    const om = lerp(Lr.omega[0], Lr.omega[1], hash3(Lr.id, k, 6)) * dirSign;
    const bo = lerp(Lr.boost[0], Lr.boost[1], hash3(Lr.id, k, 7)) * dirSign;
    let rot, a0 = a0base;
    let rad = Lr.radius(k) * baseR * (1 + (r() - 0.5) * 0.01);
    let len = st.len * (0.8 + 0.45 * noise1(t * 0.45, k * 13 + Lr.id));
    if (Lr.wedge) {
      const side = k % 2 ? Math.PI : 0;
      const g = (hash3(Lr.id, k, 8) + hash3(Lr.id, k, 9) + hash3(Lr.id, k, 10) - 1.5) * 0.55;
      rot = wedgeAngle(t) + side + g;
      a0 = -len / 2 + (noise1(t * 0.6, k) - 0.5) * 0.15;
      alpha *= 0.55 + 0.45 * noise1(t * 1.3, k * 3 + 1);
    } else {
      rot = om * t + bo * SP;
      if (Lr.shine) {
        const mid = rot + a0 + dirSign * len * 0.5 - wedgeAngle(t);
        const pr = Math.pow(Math.abs(Math.cos(mid)), 6);
        alpha *= 0.5 + 0.75 * pr;
      }
    }
    const w = st.w * (0.65 + 0.7 * noise1(t * 0.7, k * 17 + Lr.id * 5)) * (1 + 0.5 * E * Lr.disp * 8);
    // radial displacement under energy, and a slow outward throw on break
    const rDisp = E * Lr.disp * R * (hash3(Lr.id, k, 11) - 0.35) * 1.3
      + (E > 0.25 ? (noise1(Math.floor(t * 18) * 0.7, k) - 0.5) * E * 5 : 0);
    const S = {
      cx: CX, cy: CY, r: rad, a0, len: len * (1 + sm * 1.6), dir: dirSign, rot, w: w * (1 + sm * 1.2),
      nb: st.nb, alpha: alpha * (1 - sm * 0.85), dry: Math.min(1, st.dry + sm * 0.4), core: st.core * (1 - sm),
      wob: st.wob * (1 + E * 1.5), seed: Lr.id * 7777 + k * 101 + cyc, rOff: rDisp, dropout: drop, spread: 1 + sm * 1.4 + fe * 1.5,
      bw: st.bw, step: st.step, drift: st.drift || 0,
    };
    if (sm > 0) s0 = Math.max(s0, sm * 0.55);
    if (brk > 0) {
      const parts = 3 + (hash3(S.seed, 1, 9) * 4 | 0);
      const outward = fe > 0 ? eInCubic(fe) * (60 + 220 * hash3(S.seed, 2, 9)) : 0;
      for (let p = 0; p < parts; p++) {
        const pa = p / parts, pb = (p + 1) / parts;
        const q0 = lerp(s0, s1, pa), q1 = lerp(s0, s1, pb);
        const shrink = (q1 - q0) * 0.5 * brk * (0.4 + 0.6 * hash3(S.seed, p, 3));
        const Sp = Object.assign({}, S);
        Sp.rOff = S.rOff + (hash3(S.seed, p, 4) - 0.4) * 2 * eOutCubic(brk) * 34 + outward * (0.6 + 0.8 * hash3(S.seed, p, 6));
        Sp.a0 = S.a0 + S.dir * (hash3(S.seed, p, 5) - 0.5) * brk * 0.25;
        Sp.alpha = S.alpha * (1 - Math.pow(brk, 1.6));
        Sp.dry = Math.min(1, S.dry + brk * 0.5);
        Sp.w = S.w * (1 - 0.5 * brk);
        arcStroke(c, Sp, q0 + shrink, q1 - shrink, t);
      }
      // paint fragments shed by the break
      c.globalAlpha = S.alpha * (1 - brk) * 0.9;
      c.beginPath();
      const nf = 3 + (hash3(S.seed, 7, 9) * 5 | 0);
      for (let f = 0; f < nf; f++) {
        const sf = lerp(s0, s1, hash3(S.seed, f, 12));
        const th = S.rot + S.a0 + S.dir * sf * S.len + S.dir * brk * 0.2 * hash3(S.seed, f, 13);
        const rr = S.r + S.rOff + (hash3(S.seed, f, 14) - 0.3) * 60 * eOutCubic(brk) + outward * 1.4;
        const px = CX + Math.cos(th) * rr, py = CY + Math.sin(th) * rr, sz = (1 + 3.5 * hash3(S.seed, f, 15)) * (1 - 0.5 * brk);
        c.moveTo(px + sz, py); c.arc(px, py, sz, 0, TAU);
      }
      c.fill();
    } else {
      arcStroke(c, S, s0, s1, t);
    }
  }
}

function drawScratches(c, t, E, SP, R) {
  // radial scratches and chord scratches across the face
  c.lineCap = 'round';
  for (let k = 0; k < 80; k++) {
    const P = 0.6 + 1.6 * hash3(8, k, 1);
    const birth = 1.1 + 0.8 * hash3(8, k, 2);
    if (t < birth || t > OUTRO + 0.4) continue;
    const tt = t - birth + hash3(8, k, 3) * P;
    const cyc = Math.floor(tt / P), u = (tt - cyc * P) / P;
    const r = rng(8000 + k * 57 + cyc);
    if (r() < 0.35) continue;
    const radial = r() < 0.6;
    const drawIn = eOutCubic(clamp(u / 0.3)), ers = eInOutCubic(clamp((u - 0.6) / 0.35));
    if (ers >= 1) continue;
    let x1, y1, x2, y2;
    const rot = 0.25 * t + 1.2 * SP;
    if (radial) {
      const th = r() * TAU + rot, ra = R * (0.38 + 0.55 * r()), rb = ra + (18 + 110 * r()) * (r() < 0.5 ? 1 : -1);
      x1 = CX + Math.cos(th) * ra; y1 = CY + Math.sin(th) * ra;
      x2 = CX + Math.cos(th + 0.02) * rb; y2 = CY + Math.sin(th + 0.02) * rb;
    } else {
      const th = r() * TAU + rot * 0.5, ra = R * (0.4 + 0.5 * r());
      const px = CX + Math.cos(th) * ra, py = CY + Math.sin(th) * ra, ang = r() * TAU, L = 30 + 170 * r();
      x1 = px; y1 = py; x2 = px + Math.cos(ang) * L; y2 = py + Math.sin(ang) * L;
    }
    const ax = lerp(x1, x2, ers), ay = lerp(y1, y2, ers), bx = lerp(x1, x2, drawIn), by = lerp(y1, y2, drawIn);
    c.globalAlpha = (0.22 + 0.5 * r()) * (1 + E * 0.5);
    c.lineWidth = 0.6 + 1.4 * r();
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  }
}

function drawFragments(c, t, E, SP, R) {
  // orbiting paint particles & tangential flecks
  c.lineCap = 'round';
  for (let k = 0; k < 190; k++) {
    const P = 2 + 4.5 * hash3(9, k, 1);
    const birth = 0.9 + 1.1 * hash3(9, k, 2);
    if (t < birth) continue;
    const tt = t - birth + hash3(9, k, 3) * P;
    const cyc = Math.floor(tt / P), u = (tt - cyc * P) / P;
    const r = rng(9100 + k * 71 + cyc);
    const outer = r() < 0.25;
    const r0 = R * (outer ? 1.0 + 0.32 * Math.pow(r(), 1.5) : 0.34 + 0.6 * r());
    const th0 = r() * TAU;
    const om = (0.25 + 0.7 * r()) * (outer ? 0.7 : 1);
    const th = th0 + om * u * P + 0.9 * SP;
    let rr = r0 + E * 30 * r() + (outer ? u * P * (6 + 20 * r()) : 0);
    let env = Math.pow(Math.sin(Math.PI * clamp(u)), 0.6);
    if (t > OUTRO) { const fe = clamp((t - OUTRO - 0.1 * r()) / 0.7); rr += eInCubic(fe) * 500; env *= 1 - fe; }
    if (env <= 0.01) continue;
    const sz = (0.8 + 3.2 * Math.pow(r(), 2)) * env;
    const x = CX + Math.cos(th) * rr, y = CY + Math.sin(th) * rr;
    const streak = (om + 0.9 * E * 3) * rr * 0.035;
    c.globalAlpha = (0.35 + 0.6 * r()) * env;
    if (streak > 4) {
      c.lineWidth = sz * 1.2;
      const tx = -Math.sin(th), ty = Math.cos(th);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - tx * streak, y - ty * streak); c.stroke();
    } else {
      c.beginPath();
      const nv = 6;
      for (let v = 0; v < nv; v++) {
        const a = (v / nv) * TAU + k, q = sz * (0.6 + 0.8 * hash3(k, v, cyc));
        v ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      }
      c.fill();
    }
  }
  // burst spray thrown off the rim
  for (let bi = 0; bi < BURSTS.length; bi++) {
    const [bt, amp] = BURSTS[bi];
    if (amp < 0.5) continue;
    const dt = t - bt;
    if (dt < 0 || dt > 1.6) continue;
    const n = Math.round(60 * amp);
    for (let j = 0; j < n; j++) {
      const h1 = hash3(bi, j, 21), h2 = hash3(bi, j, 22), h3 = hash3(bi, j, 23);
      const th = h1 * TAU + 0.6 * SP;
      const v = 150 + 900 * h2 * h2;
      const rr = R * (0.96 + 0.08 * h3) + v * (1 - Math.exp(-dt * 3)) / 3;
      const tang = (h3 - 0.3) * 0.5 * (1 - Math.exp(-dt * 2));
      const x = CX + Math.cos(th + tang) * rr, y = CY + Math.sin(th + tang) * rr;
      const life = Math.exp(-dt * (1.6 + h2 * 2));
      if (life < 0.03) continue;
      const L = v * 0.02 * life + 1;
      c.globalAlpha = 0.8 * life;
      c.lineWidth = 0.8 + 2.5 * h3 * life;
      const dx = Math.cos(th + tang), dy = Math.sin(th + tang);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx * L, y - dy * L); c.stroke();
    }
  }
}

function drawDisc(c, t) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round';
  const E = energy(t), SP = spin(t), R = discRadius(t);
  for (const Lr of LAYERS) drawDiscLayer(c, Lr, t, E, SP, R);
  drawScratches(c, t, E, SP, R);
  drawFragments(c, t, E, SP, R);
  // keep the centre hole open: punch it with a rough painted edge
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  const hr = R * 0.085;
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const q = hr * (0.92 + 0.16 * noise2(i * 0.45, t * 0.8, 55));
    i ? c.lineTo(CX + Math.cos(a) * q, CY + Math.sin(a) * q) : c.moveTo(CX + Math.cos(a) * q, CY + Math.sin(a) * q);
  }
  c.fill();
  // dry-ink drop-outs
  c.globalAlpha = 0.55;
  const st = Math.floor(t * 10);
  holesDiscPat.setTransform(new DOMMatrix().translate(hash3(st, 1, 0) * 1024, hash3(st, 2, 0) * 1024));
  c.fillStyle = holesDiscPat;
  c.fillRect(CX - R * 1.8, CY - R * 1.8, R * 3.6, R * 3.6);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

/* --------------------------------------------------------- transitions */

function ringRadius(ring, i, t) {
  const dt = t - ring.t - i * 0.055;
  const u = clamp(dt / (1.15 + 0.12 * i));
  return { u, r: R0 * (0.98 + 0.03 * i) + eOutExpo(u) * ((ring.soft ? 260 : 1750) + i * 140) };
}

function drawRings(c, t) {
  c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = 'round';
  for (let ri = 0; ri < RINGS.length; ri++) {
    const ring = RINGS[ri];
    if (t < ring.t || t > ring.t + 2) continue;
    for (let i = 0; i < ring.n; i++) {
      const { u, r } = ringRadius(ring, i, t);
      if (u <= 0 || u >= 1) continue;
      const e = eOutExpo(u);
      const w = (ring.soft ? 14 : 16) + (ring.soft ? 40 : 150) * e * (0.5 + 0.5 * hash3(ri, i, 1));
      const alpha = (ring.soft ? 0.42 : 0.95) * (1 - smooth(0.35, 1, u)) * (i ? 0.75 : 1);
      arcStroke(c, {
        cx: CX, cy: CY, r, a0: hash3(ri, i, 2) * TAU, len: TAU * (0.85 + 0.2 * hash3(ri, i, 3)), dir: 1,
        rot: 0.4 * e, w, nb: 10 + (e * 18 | 0), alpha, dry: ring.soft ? 0.95 : 0.55 + 0.45 * e, core: ring.soft ? 0 : 0.35 * (1 - e),
        wob: 4 + 30 * e, wobF: 0.9, seed: 5000 + ri * 31 + i, rOff: 0, spread: 1, step: r > 900 ? 10 : 6,
      }, 0, 1, t);
    }
  }
}

/* ---------------------------------------------------------------- type */

const FONT_SANS = (s) => `500 ${s}px "Archivo"`;
const FONT_SERIF = (s) => `italic 400 ${Math.round(s * 1.16)}px "Instrument Serif"`;

function setFont(c, wd) {
  c.font = wd.font;
  c.fontStretch = wd.serif ? 'normal' : 'semi-condensed';
}

function layoutSections() {
  const c = ctx;
  for (let si = 0; si < SECTIONS.length; si++) {
    const sec = SECTIONS[si];
    sec.id = si;
    sec.words = [];
    const S = sec.size;
    const nL = sec.lines.length;
    const y0 = sec.yc - ((nL - 1) * sec.lineH) / 2 + S * 0.36;
    let minX = 1e9, maxX = -1e9;
    sec.lines.forEach((ln, li) => {
      const ws = ln.words.map((w, wi) => {
        const wd = { text: w[0], tin: w[1], type: w[2], serif: w[3] === 'serif', size: S, li, wi, sec: si };
        wd.font = wd.serif ? FONT_SERIF(S) : FONT_SANS(S);
        setFont(c, wd);
        c.letterSpacing = wd.serif ? '0px' : `${-S * 0.012}px`;
        wd.w = c.measureText(wd.text).width;
        wd.letters = [...wd.text].map((ch, i) => ({ ch, x: c.measureText(wd.text.slice(0, i)).width }));
        c.letterSpacing = '0px';
        return wd;
      });
      const sumW = ws.reduce((a, b) => a + b.w, 0);
      const gap = ln.just && ws.length > 1 ? (sec.blockW - sumW) / (ws.length - 1) : S * 0.26;
      let x = sec.x;
      const y = y0 + li * sec.lineH;
      ws.forEach((wd, i) => {
        wd.x = x; wd.y = y + (wd.serif ? S * 0.02 : 0);
        wd.seed = si * 1000 + li * 50 + i;
        x += wd.w + gap;
        minX = Math.min(minX, wd.x); maxX = Math.max(maxX, wd.x + wd.w);
        sec.words.push(wd);
      });
    });
    sec.box = { x: minX - 70, y: y0 - S * 1.1, w: maxX - minX + 180, h: (nL - 1) * sec.lineH + S * 1.6 };
    sec.tFirst = Math.min(...sec.words.map(w => w.tin));
    sec.tLast = Math.max(...sec.words.map(w => w.tin));
    sec.tEnd = sec.out.t + sec.out.dur;
  }
}

function wordDrift(wd, i, t) {
  return [(noise1(t * 0.55 + i * 3.1, wd.seed) - 0.5) * 1.1, (noise1(t * 0.5 + i * 2.3, wd.seed + 9) - 0.5) * 0.9];
}

function breatheOffset(sec, t) {
  if (!sec.breathe) return 0;
  return sec.breathe * sec.size * eInOutCubic(smooth(sec.tLast + 0.25, sec.out.t + 0.2, t));
}

function drawLetter(c, wd, i, x, y, t, sx = 1, sy = 1, skew = 0) {
  const L = wd.letters[i];
  const [dx, dy] = wordDrift(wd, i, t);
  c.setTransform(sx, 0, skew, sy, x + dx, y + dy);
  c.fillText(L.ch, 0, 0);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

function drawWord(c, wd, t, sec) {
  const p = t - wd.tin;
  if (p < 0) return;
  const S = wd.size, n = wd.letters.length;
  setFont(c, wd);
  c.fillStyle = INK;
  const bo = breatheOffset(sec, t);
  const lx = i => wd.x + wd.letters[i].x + (sec.breathe ? (wd.wi * 3 + i) * bo * 0.18 : 0);
  const x = wd.x, y = wd.y;
  const top = y - S * 0.95, bot = y + S * 0.3;
  switch (wd.type) {
    case 'rise': { // letters rise through a baseline mask, stretched while moving
      c.save(); c.beginPath(); c.rect(x - S * 0.3, top - S * 0.2, wd.w + S * 0.6 + bo * 3, bot - top + S * 0.2); c.clip();
      for (let i = 0; i < n; i++) {
        const q = eOutExpo(clamp((p - i * 0.045) / 0.8));
        if (q <= 0) continue;
        drawLetter(c, wd, i, lx(i), y + (1 - q) * S * 1.2, t, 1, 1 + (1 - q) * 0.55);
      }
      c.restore(); break;
    }
    case 'track': { // wide tracking collapses; each glyph is wiped in
      const q = eOutQuart(clamp(p / 0.85));
      const mid = (n - 1) / 2;
      for (let i = 0; i < n; i++) {
        const rv = eOutCubic(clamp((p - i * 0.035) / 0.22));
        if (rv <= 0) continue;
        const gx = lx(i) + (i - mid) * S * 0.62 * Math.pow(1 - q, 1.4);
        c.save(); c.beginPath(); c.rect(gx - 4, top - 10, (S * 0.8) * rv + 4, bot - top + 20); c.clip();
        drawLetter(c, wd, i, gx, y, t, 1 + 0.45 * (1 - q), 1);
        c.restore();
      }
      break;
    }
    case 'slide': { // characters slide through a window, sheared in motion
      c.save(); c.beginPath(); c.rect(x - 3, top - 20, wd.w + S * 0.25 + bo * 4, bot - top + 40); c.clip();
      for (let i = 0; i < n; i++) {
        const q = eOutExpo(clamp((p - i * 0.05) / 0.75));
        if (q <= 0) continue;
        drawLetter(c, wd, i, lx(i) + (1 - q) * (S * 1.3 + i * S * 0.12), y, t, 1, 1, -0.38 * (1 - q));
      }
      c.restore(); break;
    }
    case 'stretch': { // word arrives compressed from a long horizontal stretch
      const q = eOutExpo(clamp(p / 0.8));
      const sx = 1 + 2.4 * Math.pow(1 - q, 1.2);
      const jit = p < 0.25 ? (hash3(Math.floor(t * 24), wd.seed, 3) - 0.5) * 8 * (1 - q) : 0;
      c.save(); c.beginPath(); c.rect(x - 4, top - 20, wd.w + 12 + bo * 5, bot - top + 40); c.clip();
      for (let i = 0; i < n; i++) {
        const [dx, dy] = wordDrift(wd, i, t);
        c.setTransform(sx, 0, 0, 1, x + jit + dx, y + dy);
        c.fillText(wd.letters[i].ch, (lx(i) - x) / 1, 0);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.restore(); break;
    }
    case 'scan': { // horizontal slices shear in from alternating sides and lock
      const sl = 8;
      for (let j = 0; j < sl; j++) {
        const q = eOutExpo(clamp((p - j * 0.028) / 0.65));
        if (q <= 0) continue;
        const b0 = top + (bot - top) * (j / sl), b1 = top + (bot - top) * ((j + 1) / sl);
        c.save(); c.beginPath(); c.rect(x - S, b0, wd.w + S * 3, b1 - b0 + 0.6); c.clip();
        const dx = (j % 2 ? 1 : -1) * (1 - q) * S * 1.5;
        for (let i = 0; i < n; i++) drawLetter(c, wd, i, lx(i) + dx, y, t);
        c.restore();
      }
      break;
    }
    case 'bars': { // printed through a comb of vertical bars that widen
      const bars = Math.max(6, Math.round(wd.w / 14));
      const bw = (wd.w + 20) / bars;
      c.save(); c.beginPath();
      let any = false;
      for (let j = 0; j < bars; j++) {
        const q = eOutCubic(clamp((p - (j / bars) * 0.25 - hash3(j, wd.seed, 4) * 0.12) / 0.4));
        if (q <= 0) continue;
        any = true;
        const cxb = x - 10 + (j + 0.5) * bw;
        c.rect(cxb - bw * 0.5 * q - 0.5, top - 10 + (1 - q) * 30 * (j % 2 ? 1 : -1), bw * q + 1, bot - top + 20);
      }
      if (any) {
        c.clip();
        for (let i = 0; i < n; i++) drawLetter(c, wd, i, lx(i), y, t, 1 + 0.08 * (1 - clamp(p / 0.6)), 1);
      }
      c.restore(); break;
    }
    case 'ink': { // a dry brush drags across and leaves the word behind it
      const D = 0.6;
      const hp = eInOutCubic(clamp(p / D));
      const x0 = x - 30, x1 = x + wd.w + 50;
      const hx = lerp(x0, x1, hp);
      const rows = Math.ceil((bot - top + 30) / 5);
      if (hp < 1) {
        // word into scratch, masked by bristle rows up to the brush head
        const oy = wd.y - 300;
        wordCx.clearRect(0, 0, W, 420);
        wordCx.fillStyle = INK; setFont(wordCx, wd);
        for (let i = 0; i < n; i++) {
          const [dx, dy] = wordDrift(wd, i, t);
          wordCx.fillText(wd.letters[i].ch, lx(i) + dx, 300 + dy);
        }
        wordCx.globalCompositeOperation = 'destination-in';
        wordCx.beginPath();
        for (let j = 0; j < rows; j++) {
          const yy = top - 15 + j * 5 - oy;
          const hj = hx + (noise1(j * 0.35, wd.seed) - 0.5) * S * 0.7;
          wordCx.rect(x0 - 20, yy - 3, Math.max(0, hj - x0 + 20), 6.2);
        }
        wordCx.fill();
        wordCx.globalCompositeOperation = 'source-over';
        c.drawImage(wordCv, 0, 0, W, 420, 0, oy, W, 420);
      } else {
        for (let i = 0; i < n; i++) drawLetter(c, wd, i, lx(i), y, t);
      }
      // the brush residue itself: paints on, then erases itself
      const tail = eInOutCubic(clamp((p - 0.12) / (D + 0.25)));
      if (tail < 1) {
        c.save();
        c.strokeStyle = INK; c.lineCap = 'round';
        for (let j = 0; j < rows; j += 2) {
          const yy = top - 15 + j * 5;
          const jag = (noise1(j * 0.35, wd.seed) - 0.5) * S * 0.7;
          const hj = hx + jag;
          const tj = lerp(x0, x1 + S * 0.4, tail) + jag * 0.6;
          if (hj - tj < 2) continue;
          const g = hash3(j, wd.seed, 8);
          if (g < 0.2) continue;
          c.globalAlpha = 0.25 + 0.6 * g;
          c.lineWidth = 1.2 + 3.2 * hash3(j, wd.seed, 9);
          c.beginPath();
          let pen = false;
          for (let xx = tj; xx <= hj; xx += 6) {
            const vis = noise1(xx / (16 + 30 * g), wd.seed + j) > 0.32;
            const yw = yy + (noise1(xx / 120, j + wd.seed) - 0.5) * 3;
            if (vis) { pen ? c.lineTo(xx, yw) : c.moveTo(xx, yw); pen = true; } else pen = false;
          }
          c.stroke();
        }
        c.restore();
      }
      break;
    }
  }
}

// Hand-drawn pen marks: underline with a return hook, or a loose loop.
function drawMark(c, sec, mk, t) {
  const p = clamp((t - mk.t) / mk.dur);
  if (p <= 0) return;
  const ws = sec.words.filter(w => w.li === mk.line);
  let targets = mk.word !== undefined ? [ws[mk.word]] : ws;
  const bo = breatheOffset(sec, t);
  const x0 = targets[0].x, x1 = targets[targets.length - 1].x + targets[targets.length - 1].w + bo;
  const yb = targets[0].y, S = sec.size;
  const pts = [];
  const seed = sec.id * 17 + mk.line;
  if (mk.type === 'underline') {
    const N = 70;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = lerp(x0 - 14, x1 + 26, u);
      const y = yb + S * 0.2 + Math.sin(u * Math.PI) * -4 + (noise1(u * 6, seed) - 0.5) * 5 + u * -6;
      pts.push([x, y]);
    }
    for (let i = 1; i <= 16; i++) { // hook back
      const u = i / 16;
      pts.push([x1 + 26 - u * 70, yb + S * 0.2 - 6 - Math.sin(u * 1.4) * 14 + u * 12]);
    }
  } else {
    const cx = (x0 + x1) / 2, cy = yb - S * 0.3;
    const rx = (x1 - x0) / 2 + 34, ry = S * 0.62;
    const N = 110, a0 = -2.5;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = a0 + u * TAU * 1.13;
      const g = 1 + u * 0.07 + (noise1(u * 7, seed) - 0.5) * 0.06;
      const x = cx + Math.cos(a) * rx * g, y = cy + Math.sin(a) * ry * g;
      const tilt = -0.07;
      pts.push([cx + (x - cx) * Math.cos(tilt) - (y - cy) * Math.sin(tilt), cy + (x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt)]);
    }
  }
  const upto = eInOutCubic(p) * (pts.length - 1);
  c.save();
  c.strokeStyle = INK; c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    const off = pass ? 1.6 : 0;
    for (let i = 1; i <= upto; i++) {
      const u = i / (pts.length - 1);
      const pr = Math.sin(Math.PI * clamp(u * 1.05)) * 0.8 + 0.3;
      c.globalAlpha = pass ? 0.35 : 0.9;
      c.lineWidth = (pass ? 1.1 : 3.4) * pr;
      c.beginPath();
      c.moveTo(pts[i - 1][0] + off, pts[i - 1][1] + off * 0.5);
      c.lineTo(pts[i][0] + off, pts[i][1] + off * 0.5);
      c.stroke();
    }
  }
  c.restore();
}

function renderSection(c, sec, t) {
  for (const wd of sec.words) drawWord(c, wd, t, sec);
  if (sec.marks) for (const mk of sec.marks) drawMark(c, sec, mk, t);
}

// Cached state at the start of each section's exit, sliced into ink tiles for
// the particle break-up.
const TILE = 4;
function prepareSectionCaches() {
  for (const sec of SECTIONS) {
    if (sec.out.type !== 'particles') continue;
    secCx.clearRect(0, 0, W, H);
    renderSection(secCx, sec, sec.out.t);
    const b = sec.box;
    const bx = Math.max(0, Math.floor(b.x)), by = Math.max(0, Math.floor(b.y));
    const bw = Math.min(W - bx, Math.ceil(b.w)), bh = Math.min(H - by, Math.ceil(b.h));
    const cache = mkCanvas(bw, bh);
    cache.getContext('2d').drawImage(secCv, bx, by, bw, bh, 0, 0, bw, bh);
    const d = cache.getContext('2d').getImageData(0, 0, bw, bh).data;
    const tiles = [];
    for (let ty = 0; ty < bh; ty += TILE) for (let tx = 0; tx < bw; tx += TILE) {
      let a = 0;
      for (let yy = ty; yy < Math.min(bh, ty + TILE); yy++) for (let xx = tx; xx < Math.min(bw, tx + TILE); xx++) a += d[(yy * bw + xx) * 4 + 3];
      a /= TILE * TILE * 255;
      if (a > 0.06) tiles.push({ x: tx, y: ty, gx: bx + tx, gy: by + ty, a, h: hash3(tx, ty, sec.id) });
    }
    let minX = 1e9, maxX = -1e9;
    for (const tl of tiles) { minX = Math.min(minX, tl.gx); maxX = Math.max(maxX, tl.gx); }
    for (const tl of tiles) tl.order = 1 - (tl.gx - minX) / Math.max(1, maxX - minX);
    sec.cache = cache; sec.cacheX = bx; sec.cacheY = by; sec.tiles = tiles;
  }
}

function drawParticlesOut(c, sec, t) {
  const u = (t - sec.out.t) / sec.out.dur;
  const SP = spin(t), R = discRadius(t);
  const levels = [[], [], [], []];
  c.save();
  for (const tl of sec.tiles) {
    const ts = tl.order * 0.3 + tl.h * 0.12;
    const v = clamp((u - ts) / 0.5);
    if (v <= 0) { c.drawImage(sec.cache, tl.x, tl.y, TILE, TILE, tl.gx, tl.gy, TILE, TILE); continue; }
    if (v >= 1) continue;
    const e = eInOutCubic(v);
    const px0 = tl.gx + TILE / 2 - CX, py0 = tl.gy + TILE / 2 - CY;
    const r0 = Math.hypot(px0, py0), th0 = Math.atan2(py0, px0);
    const rT = sec.out.sink ? R * (0.05 + 0.1 * tl.h) : R * (1.03 + 0.34 * tl.h);
    const swirl = (sec.out.sink ? 2.6 : 1.1) + 1.4 * tl.h;
    const lift = smooth(0, 0.3, v) * (1 - e) * 46;
    const rr = lerp(r0, rT, e) , th = th0 + e * swirl + 0.1 * (SP - spin(sec.out.t));
    const x = CX + Math.cos(th) * rr + (hash3(tl.x, tl.y, 5) - 0.5) * lift;
    const y = CY + Math.sin(th) * rr + (hash3(tl.x, tl.y, 6) - 0.5) * lift;
    const sz = TILE * 0.62 * (1 - 0.55 * e) * (0.7 + 0.7 * tl.h) * Math.sqrt(tl.a);
    const al = tl.a * (1 - smooth(0.55, 1, v));
    levels[Math.min(3, (al * 4) | 0)].push(x, y, sz);
  }
  c.fillStyle = INK;
  for (let l = 0; l < 4; l++) {
    const arr = levels[l];
    if (!arr.length) continue;
    c.globalAlpha = (l + 0.6) / 4;
    c.beginPath();
    for (let i = 0; i < arr.length; i += 3) { c.moveTo(arr[i] + arr[i + 2], arr[i + 1]); c.arc(arr[i], arr[i + 1], arr[i + 2], 0, TAU); }
    c.fill();
  }
  c.restore();
}

// Brush sweep that wipes a section away and then erases itself.
function sweepBristles(sec, u) {
  const b = sec.box;
  const x0 = b.x - 80, x1 = b.x + b.w + 160;
  const hp = eInOutQuart(clamp(u / 0.62));
  const tp = eInOutCubic(clamp((u - 0.22) / 0.78));
  const sp = 5;
  const rows = [];
  const yA = b.y - 20, yB = b.y + b.h + 20;
  for (let y = yA; y < yB; y += sp) {
    const j = Math.round((y - b.y) / sp);
    const a = Math.abs((y - yA) / (yB - yA) - 0.5) * 2;
    const jag = (noise1(j * 0.09, sec.id * 3 + 1) - 0.5) * 150 + (noise1(j * 0.5, sec.id + 7) - 0.5) * 40 - Math.pow(a, 3) * 90;
    rows.push({ y, a, jag, head: lerp(x0, x1, hp) + jag, tail: lerp(x0, x1 + 260, tp) + jag * 0.7 - a * 60, g: hash3(j, sec.id, 3) });
  }
  return { rows, sp, x0, x1 };
}

function applySweepErase(c, sec, u) {
  const { rows, sp, x0 } = sweepBristles(sec, u);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  for (const r of rows) c.rect(x0 - 200, r.y - sp * 0.6, Math.max(0, r.head - x0 + 200), sp * 1.2);
  c.fill();
  c.restore();
}

function drawSweepBrush(c, sec, u) {
  const { rows, sp, x0, x1 } = sweepBristles(sec, u);
  c.save();
  c.strokeStyle = INK; c.lineCap = 'round';
  const dryEnd = smooth(0.45, 1, u);
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    if (r.head - r.tail < 3) continue;
    const thr = 0.08 + 0.55 * Math.pow(r.a, 1.6) + 0.4 * dryEnd;
    c.globalAlpha = (0.55 + 0.45 * r.g) * (1 - 0.3 * r.a);
    c.lineWidth = sp * (0.8 + 0.9 * hash3(k, sec.id, 7));
    c.beginPath();
    let pen = false;
    for (let x = r.tail; x <= r.head; x += 6) {
      const vis = noise1(x / (30 + 60 * r.g), k * 0.15 + sec.id * 100) * 0.7 + noise1(x / 9, k + sec.id) * 0.3 > thr;
      const y = r.y - Math.sin(clamp((x - x0) / (x1 - x0)) * Math.PI) * 10 + (noise1(x / 160, k) - 0.5) * 3;
      if (vis) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false;
    }
    c.stroke();
  }
  c.restore();
}

function roughCirclePath(c, r, t, seed) {
  c.beginPath();
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const q = r + (noise2(i * 0.3, t * 2, seed) - 0.5) * 60;
    i ? c.lineTo(CX + Math.cos(a) * q, CY + Math.sin(a) * q) : c.moveTo(CX + Math.cos(a) * q, CY + Math.sin(a) * q);
  }
  c.closePath();
}

// Composites a section layer onto the frame: ink bleed, misregistered ghost,
// dry-ink drop-outs and burst-driven slice jitter.
function compositeSection(dst, sec, t, sliceU = -1) {
  const b = sec.box;
  const bx = Math.max(0, Math.floor(b.x - 40)), by = Math.max(0, Math.floor(b.y - 40));
  const bw = Math.min(W - bx, Math.ceil(b.w + 80)), bh = Math.min(H - by, Math.ceil(b.h + 80));
  // dry-ink drop-outs on the source layer
  secCx.save();
  secCx.globalCompositeOperation = 'destination-out';
  secCx.globalAlpha = 0.9;
  const st = Math.floor(t * 12);
  holesPat.setTransform(new DOMMatrix().translate(hash3(st, 3, 1) * 1024, hash3(st, 4, 1) * 1024));
  secCx.fillStyle = holesPat;
  secCx.fillRect(bx, by, bw, bh);
  secCx.restore();

  const E = energy(t);
  dst.save();
  if (sliceU >= 0) {
    const n = 12;
    for (let j = 0; j < n; j++) {
      const q = eInExpo(clamp((sliceU - j * 0.035 - hash3(j, sec.id, 1) * 0.1) / 0.62));
      const hh = bh / n;
      const keep = 1 - eInCubic(clamp((sliceU - 0.15 - j * 0.02) / 0.7));
      if (keep <= 0) continue;
      const dx = (j % 2 ? 1 : -1) * q * 1500 * (0.6 + 0.8 * hash3(j, sec.id, 2));
      const y0 = by + j * hh + hh * (1 - keep) / 2;
      dst.drawImage(secCv, bx, y0, bw, hh * keep, bx + dx, y0, bw * (1 + q * 0.6), hh * keep);
    }
  } else if (E > 0.22) {
    const n = 7, stp = Math.floor(t * 15);
    for (let j = 0; j < n; j++) {
      const hh = bh / n;
      const dx = (hash3(stp, j, sec.id) - 0.5) * 2 * Math.min(1.5, E) * 9;
      const stretch = E > 0.7 && hash3(stp, j, 77) < 0.18 ? 1 + 0.06 * E : 1;
      dst.drawImage(secCv, bx, by + j * hh, bw, hh, bx + dx, by + j * hh, bw * stretch, hh);
    }
  } else {
    // soft bleed + slight misregistered ghost, then the print itself
    dst.globalAlpha = 0.08;
    dst.drawImage(secCv, bx, by, bw, bh, bx - 2.2, by + 1.4, bw, bh);
    dst.globalAlpha = 1;
    dst.drawImage(secCv, bx, by, bw, bh, bx, by, bw, bh);
  }
  dst.restore();
}

function drawSections(dst, t, behind) {
  for (const sec of SECTIONS) {
    if (!!sec.behind !== behind) continue;
    if (t < sec.tFirst - 0.02 || t > sec.tEnd) continue;
    const o = sec.out, u = (t - o.t) / o.dur;
    if (o.type === 'particles' && u > 0) { drawParticlesOut(dst, sec, t); continue; }
    secCx.clearRect(0, 0, W, H);
    renderSection(secCx, sec, t);
    if (u > 0) {
      if (o.type === 'ring') {
        const ring = RINGS.find(r => Math.abs(r.t - o.t) < 0.01);
        const { r } = ringRadius(ring, 0, t);
        secCx.save(); secCx.globalCompositeOperation = 'destination-out';
        roughCirclePath(secCx, r - 10, t, sec.id); secCx.fill(); secCx.restore();
      } else if (o.type === 'sweep') {
        applySweepErase(secCx, sec, u);
      }
    }
    compositeSection(dst, sec, t, o.type === 'slice' && u > 0 ? u : -1);
    if (o.type === 'sweep' && u > 0 && u < 1) drawSweepBrush(dst, sec, u);
  }
}

/* ------------------------------------------------------- print furniture */

function drawFurniture(c, t) {
  // registration + crop marks, drawn on by hand at the start, lifted at the end
  const pin = eInOutCubic(clamp((t - 0.25) / 0.9));
  const pout = 1 - eInOutCubic(clamp((t - 29.1) / 0.5));
  const a = pin * pout;
  if (a <= 0) return;
  const bx = Math.floor(t * 8);
  const j = (k) => (hash3(bx, k, 99) - 0.5) * 0.6;
  c.save();
  c.strokeStyle = INK; c.globalAlpha = 0.32 * pout; c.lineWidth = 1.1; c.lineCap = 'butt';
  const m = 54, L = 30 * pin;
  const corners = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
  corners.forEach(([x, y, sx, sy], k) => {
    c.beginPath();
    c.moveTo(x - sx * 14 + j(k), y + j(k + 1)); c.lineTo(x - sx * 14 + sx * L + j(k), y + j(k + 1));
    c.moveTo(x + j(k + 2), y - sy * 14); c.lineTo(x + j(k + 2), y - sy * 14 + sy * L);
    c.stroke();
  });
  // registration target, lower right of the disc
  const rx = CX + R0 + 118, ry = H - 118;
  c.beginPath(); c.arc(rx + j(7), ry + j(8), 11, -Math.PI / 2, -Math.PI / 2 + TAU * pin); c.stroke();
  c.beginPath(); c.moveTo(rx - 20 * pin, ry); c.lineTo(rx + 20 * pin, ry); c.moveTo(rx, ry - 20 * pin); c.lineTo(rx, ry + 20 * pin); c.stroke();
  // a single hairline rule that frames the text column
  c.globalAlpha = 0.16 * pout;
  c.beginPath(); c.moveTo(120 + j(9), H * 0.5 - 330 * pin); c.lineTo(120 + j(9), H * 0.5 + 330 * pin); c.stroke();
  c.restore();
}

function drawDust(c, t) {
  const f = Math.floor(t * 30);
  c.save();
  c.fillStyle = INK;
  const n = (hash3(f, 1, 7) * 4) | 0;
  for (let k = 0; k < n; k++) {
    const x = hash3(f, k, 8) * W, y = hash3(f, k, 9) * H, s = 0.6 + 2.2 * Math.pow(hash3(f, k, 10), 3);
    c.globalAlpha = 0.25 + 0.4 * hash3(f, k, 11);
    c.beginPath();
    for (let v = 0; v < 5; v++) {
      const a = v / 5 * TAU, q = s * (0.5 + hash3(f, k * 5 + v, 12));
      v ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    c.fill();
  }
  // occasional hair-thin vertical scratch that lingers for a moment
  const sid = Math.floor(t / 0.9);
  if (hash3(sid, 3, 3) < 0.3) {
    const x = hash3(sid, 4, 4) * W + (t - sid * 0.9) * 14;
    c.globalAlpha = 0.06 + 0.05 * hash3(f, 5, 5);
    c.fillRect(x, 0, 0.8, H);
  }
  c.restore();
}

/* ------------------------------------------------------------- frame */

let ready = false;
function renderFrame(t) {
  if (!ready) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(PAPER, 0, 0);

  drawFurniture(ctx, t);
  drawSections(ctx, t, true);

  drawDisc(discCx, t);
  ctx.globalAlpha = 0.1; ctx.drawImage(discCv, 1.6, -1.2); // misregistered second pass
  ctx.globalAlpha = 1; ctx.drawImage(discCv, 0, 0);

  drawSections(ctx, t, false);

  fxCx.clearRect(0, 0, W, H);
  fxCx.globalAlpha = 1;
  drawRings(fxCx, t);
  ctx.drawImage(fxCv, 0, 0);

  drawDust(ctx, t);
  // film grain at 30 steps/s regardless of output frame rate
  const gf = Math.floor(t * 30);
  const g = GRAIN[gf % GRAIN.length];
  const ox = (hash3(gf, 1, 2) * 96) | 0, oy = (hash3(gf, 2, 2) * 96) | 0;
  ctx.globalAlpha = 1 - 0.4 * smooth(29.5, 30, t);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g, 0, 0, W / 3, H / 3, -ox, -oy, W + 96, H + 96);
  ctx.globalAlpha = 1;
}

async function init() {
  await Promise.all([
    document.fonts.load('500 100px "Archivo"'),
    document.fonts.load('italic 400 100px "Instrument Serif"'),
  ]);
  await document.fonts.ready;
  buildTextures();
  layoutSections();
  prepareSectionCaches();
  ready = true;
}

window.DURATION = DUR;
window.renderFrame = renderFrame;
window.motionReady = init();

// Live preview when opened directly (silent; visuals only).
if (!/render/.test(location.search)) {
  window.motionReady.then(() => {
    const t0 = performance.now();
    const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
} else {
  document.body.classList.add('render');
}
