// Claude – motion promo. Every frame is a pure function of time: window.renderFrame(t).
import * as THREE from './vendor/three.module.js';

const W = 1920, H = 1080;
const DURATION = 33.0;
const $ = (id) => document.getElementById(id);

/* =========================================================================
   Helpers
   ========================================================================= */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const E = {
  lin: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outBackSoft: (x) => { const c1 = 0.8, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};
// Keyframes: [[time, value(s), easeIntoThisKey?], ...]
function kf(t, keys, defEase = E.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1, e] = keys[i];
      const k = (e || defEase)((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function ramp(stops, k) { // stops: [[pos, rgb], ...]
  k = clamp(k);
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) return mixc(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(...args) {
  let h = 2166136261 >>> 0;
  for (const a of args) { h ^= Math.floor(a * 7919) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
const px = (v) => `${v.toFixed(2)}px`;
function measure(text, font) {
  const c = measure.ctx || (measure.ctx = document.createElement('canvas').getContext('2d'));
  c.font = font;
  return c.measureText(text).width;
}

const IVORY = '#F0EEE6';
const CLAUDE = '#D97757';
const INK = '#141413';

/* =========================================================================
   Audio cue list (consumed by render/audio.py)
   ========================================================================= */
const CUES = [];
const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(4), type, ...extra });

/* =========================================================================
   S1 — dreamy silhouette + "Imagine..." line
   ========================================================================= */
const S1_TEXT = 'Imagine a mind that thinks with you';
const S1_PINK = hex('#F2508C'), S1_CORAL = hex('#F47C6C'), S1_ORANGE = hex('#FFA24E'), S1_YELLOW = hex('#FFE29A'), WHITE = [255, 255, 255];
const SIL_PATH = 'M60 1200C90 1090 200 1010 330 960C380 940 395 880 385 800C375 720 330 690 300 620C250 520 250 380 330 280C410 180 560 140 660 170C760 200 810 290 812 380C814 420 806 445 812 470C818 500 830 540 858 590C872 612 866 628 840 632C828 634 826 650 834 664C842 676 836 690 826 696C836 708 834 724 818 734C812 750 822 780 806 808C790 838 750 850 712 852C690 860 676 880 680 920C684 990 700 1050 760 1100C810 1140 880 1170 940 1200Z';
const s1 = { letters: [], lines: [] };
function initS1() {
  const svg = (gid) => `<svg viewBox="0 0 1000 1200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gid}" x1="0.1" y1="0" x2="0.45" y2="1">
      <stop class="sg0" offset="0"/><stop class="sg1" offset="0.48"/><stop class="sg2" offset="1"/></linearGradient></defs>
    <ellipse cx="430" cy="420" rx="250" ry="290" fill="url(#${gid})"/>
    <path d="${SIL_PATH}" fill="url(#${gid})"/></svg>`;
  $('sil1').innerHTML = svg('silgA');
  $('sil2').innerHTML = svg('silgB');
  s1.stops = [...document.querySelectorAll('#s1 .sg0, #s1 .sg1, #s1 .sg2')];
  const LINES = [
    { y: 52, v: 10, x0: 0, op: 0.6, on: 0 }, { y: 1030, v: -8, x0: 0, op: 0.5, on: 0 },
    { y: 880, v: -38, x0: 0, op: 0.45, on: 1.45 }, { y: 940, v: -55, x0: 0, op: 0.35, on: 1.6 },
    { y: 640, v: 70, x0: 720, op: 0.55, on: 2.05 }, { y: 780, v: 45, x0: 560, op: 0.5, on: 2.15 },
    { y: 300, v: -30, x0: 0, op: 0.3, on: 1.0 },
  ];
  const holder = $('s1lines');
  LINES.forEach((L) => { const d = document.createElement('div'); d.className = 'scan'; holder.appendChild(d); s1.lines.push({ el: d, ...L }); });
  const tx = $('s1text');
  [...S1_TEXT].forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.textContent = ch;
    tx.appendChild(sp);
    s1.letters.push({ el: sp, a: 0.3 + i * 0.024, w: 0.95 + i * 0.03 });
  });
}
const SIL_PAL = [
  [['#E25BB8', '#F7C35E', '#C46AE8', '#E2569A', '#E25BB8']],
];
function cyc(list, k) { // cyclic color ramp
  const n = list.length; const f = ((k % 1) + 1) % 1 * n; const i = Math.floor(f);
  return mixc(hex(list[i % n]), hex(list[(i + 1) % n]), E.inOutSine(f - i));
}
function updateS1(t) {
  // background gradient (colors drift and flip from peach-top to lavender-top)
  const top = kf(t, [[0, hex('#F5C9A2')], [1.3, hex('#B49BE8')], [2.6, hex('#A68CE6')]], E.inOutSine);
  const mid = kf(t, [[0, hex('#E6B3C6')], [1.3, hex('#D9A9CC')], [2.6, hex('#CD9FD0')]], E.inOutSine);
  const bot = kf(t, [[0, hex('#A897E6')], [1.3, hex('#F1BC9F')], [2.6, hex('#F1A78A')]], E.inOutSine);
  $('s1bg').style.background = `linear-gradient(180deg, ${rgba(top)} 0%, ${rgba(mid)} 55%, ${rgba(bot)} 100%)`;

  // silhouette colours cycle
  const c0 = cyc(['#E25BB8', '#F7C35E', '#C46AE8', '#EF5E9A'], t * 0.42);
  const c1 = cyc(['#F0868A', '#EE6FA6', '#F59C78', '#E77FC4'], t * 0.36 + 0.3);
  const c2 = cyc(['#F7B26A', '#F493B4', '#F9C27B', '#EFA0D0'], t * 0.3 + 0.6);
  s1.stops.forEach((s) => {
    const c = s.classList.contains('sg0') ? c0 : s.classList.contains('sg1') ? c1 : c2;
    s.setAttribute('stop-color', rgba(c));
  });
  // silhouette drifts up, a ghost copy rises from below (double exposure)
  const rise = kf(t, [[0, 30], [1.25, -40, E.inOutSine], [2.9, -560, E.inCubic]]);
  const sx = 352 + 22 * Math.sin(t * 1.3);
  const s1el = $('sil1'), s2el = $('sil2');
  s1el.style.transform = `translate(${px(sx)}, ${px(-46 + rise)}) scale(${(1.0 + 0.03 * t).toFixed(4)})`;
  s1el.style.opacity = 0.95;
  const g = seg(t, 1.35, 1.8);
  s2el.style.transform = `translate(${px(sx - 40)}, ${px(-46 + rise + 1240)}) scale(1.02)`;
  s2el.style.opacity = (0.85 * g).toFixed(3);

  // scan lines
  for (const L of s1.lines) {
    const on = seg(t, L.on, L.on + 0.2);
    L.el.style.top = px(L.y + L.v * (t - L.on));
    L.el.style.left = px(L.x0);
    L.el.style.opacity = (L.op * on).toFixed(3);
  }

  // typed line with colour sweep: appears pink, then a glowing orange→yellow front turns it white
  for (const L of s1.letters) {
    const el = L.el;
    if (t < L.a) { el.style.opacity = 0; continue; }
    const ap = seg(t, L.a, L.a + 0.14);
    const wp = seg(t, L.w - 0.16, L.w + 0.24);
    let col, alpha;
    if (wp <= 0) { col = mixc(S1_PINK, S1_CORAL, seg(t, L.a, L.a + 0.7)); alpha = ap * lerp(0.55, 0.85, seg(t, L.a, L.w)); }
    else { col = ramp([[0, S1_CORAL], [0.3, S1_ORANGE], [0.62, S1_YELLOW], [1, WHITE]], wp); alpha = 1; }
    const glow = Math.sin(Math.PI * clamp(wp)) * 0.95;
    el.style.opacity = alpha.toFixed(3);
    el.style.color = rgba(col);
    el.style.textShadow = glow > 0.02 ? `0 0 14px rgba(255,170,80,${(glow * 0.9).toFixed(3)}), 0 0 32px rgba(255,140,90,${(glow * 0.5).toFixed(3)})` : '0 1px 14px rgba(120,60,140,0.10)';
    el.style.transform = `translateY(${px((1 - E.outCubic(ap)) * 10)})`;
  }
}

/* =========================================================================
   Pixel wipe (S1 -> S2)
   ========================================================================= */
const WIPE_A = 2.4, WIPE_B = 3.3;
const WIPE_COLORS = ['#FFF59A', '#F7B6E6', '#D96CF0', '#F8D6C0', '#F5B26A', '#FFFFFF', '#EC9AA2', '#D97757', '#FBE3A0'];
let wipeCtx;
function drawWipe(t) {
  const ctx = wipeCtx;
  ctx.clearRect(0, 0, W, H);
  const p = E.inOutQuad(seg(t, WIPE_A, WIPE_B));
  const CELL = 40, cols = 48, rows = 27;
  const fr = Math.floor(t * 18);
  for (let c = 0; c < cols; c++) {
    const xc = (c + 0.5) / cols;
    const by = H * (lerp(-0.7, 1.85, p) + 0.62 * (0.5 - xc)) + 95 * noise1(c * 0.33, 7) + 42 * noise1(c * 1.27, 3);
    const edge = Math.floor(by / CELL);
    if (edge > 0) { ctx.fillStyle = IVORY; ctx.fillRect(c * CELL, 0, CELL, Math.min(edge, rows) * CELL); }
    for (let k = 0; k < 2; k++) {
      const r = edge + k;
      if (r < 0 || r >= rows) continue;
      const hh = hash(c, r, fr);
      if (k === 0 ? hh < 0.9 : hh < 0.22) {
        ctx.fillStyle = WIPE_COLORS[Math.floor(hash(c, r, fr, 9) * WIPE_COLORS.length)];
        ctx.globalAlpha = k === 0 ? 1 : 0.75;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }
    // a few stray pixels above the edge
    const sr = edge - 1 - Math.floor(hash(c, fr, 5) * 3);
    if (sr >= 0 && sr < rows && hash(c, fr, 11) < 0.12) {
      ctx.fillStyle = WIPE_COLORS[Math.floor(hash(c, fr, 13) * WIPE_COLORS.length)];
      ctx.fillRect(c * CELL, sr * CELL, CELL, CELL);
    }
  }
}

/* =========================================================================
   S2 — "{ at every step }" then "{ intro▢▢▢ducing }"
   ========================================================================= */
const S2_FONT = '400 64px Inter';
const s2 = {};
const THUMBS = ['landing', 'chat', 'dashboard', 'code', 'poster', 'app', 'brand', 'terminal', 'doc', 'data'];
const S2_WORDS = [
  { id: 'brL', txt: '{' }, { id: 'brR', txt: '}' },
  { id: 'at', txt: 'at', a: 2.86 }, { id: 'every', txt: 'every', a: 3.27 }, { id: 'step', txt: 'step', a: 3.66 },
  { id: 'intro', txt: 'intro' }, { id: 'ducing', txt: 'ducing' },
];
// selection handles: snapshots of [x, y] offsets from centre (null = hidden)
const HANDLES = [
  [2.84, [null, [150, -175], [-95, 112], null]],
  [3.06, [null, [20, -205], [-150, 95], null]],
  [3.28, [[-250, -178], [250, -186], [-128, 96], [128, 96]]],
  [3.62, [[-640, -178], null, [-300, 205], null]],
  [3.9, [[-720, -180], [720, -180], [-720, 180], [720, 180]]],
  [4.16, [null, null, null, [540, 182]]],
  [4.32, [[-360, -180], [360, -180], [-360, 180], [360, 180]]],
  [4.54, [[-250, -180], [250, -180], null, [480, 180]]],
  [4.82, [[-175, -180], [175, -180], null, [175, 182]]],
  [5.06, [[-240, -180], [240, -180], [-240, 180], [240, 180]]],
  [5.85, [[-60, -60], [60, -60], [-60, 60], [60, 60]]],
  [5.95, [null, null, null, null]],
];
function initS2() {
  const holder = $('s2words');
  for (const w of S2_WORDS) {
    const el = document.createElement('div');
    el.className = 's2t';
    el.innerHTML = `<span>${w.txt}</span>`;
    holder.appendChild(el);
    w.el = el;
    w.w = measure(w.txt, S2_FONT);
    s2[w.id] = w;
  }
  s2.space = measure(' ', S2_FONT);
  // thumbnails
  const clip = $('thumbclip');
  s2.thumbs = [];
  for (let k = 0; k < 16; k++) {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = `../assets/${THUMBS[k % THUMBS.length]}.png`;
    clip.appendChild(img);
    s2.thumbs.push(img);
  }
  // cues
  cue(2.86, 'tick', { v: 0.7 }); cue(3.27, 'tick', { v: 0.8 }); cue(3.66, 'tick', { v: 0.9 });
  HANDLES.forEach(([ht]) => cue(ht, 'blip', { v: 0.35 }));
  cue(4.52, 'whoosh', { v: 1, dur: 0.5 }); cue(4.54, 'boom', { v: 1 });
  for (let k = 0; k < 16; k++) { const tt = 4.56 + k * (84 / 560); if (tt < 5.85) cue(tt, 'flick', { v: 0.55 }); }
  cue(5.9, 'snap', { v: 0.8 });
}
function handleState(t) {
  // returns positions/scales for each of the 4 handles
  const out = [];
  for (let h = 0; h < 4; h++) {
    let prevPos = null, curPos = null, tCur = HANDLES[0][0];
    let idx = -1;
    for (let i = 0; i < HANDLES.length; i++) if (t >= HANDLES[i][0]) idx = i;
    if (idx < 0) { out.push(null); continue; }
    curPos = HANDLES[idx][1][h];
    tCur = HANDLES[idx][0];
    for (let i = idx - 1; i >= 0; i--) { if (HANDLES[i][1][h]) { prevPos = HANDLES[i][1][h]; break; } }
    if (!curPos) {
      // fading out from previous
      const k = seg(t, tCur, tCur + 0.06);
      out.push(prevPos && k < 1 ? { x: prevPos[0], y: prevPos[1], s: 1 - k } : null);
      continue;
    }
    const k = E.outExpo(seg(t, tCur, tCur + 0.2));
    const wasVisible = idx > 0 && HANDLES[idx - 1][1][h];
    if (prevPos && wasVisible) out.push({ x: lerp(prevPos[0], curPos[0], k), y: lerp(prevPos[1], curPos[1], k), s: 1 });
    else out.push({ x: curPos[0], y: curPos[1], s: E.outBack(seg(t, tCur, tCur + 0.14)) });
  }
  return out;
}
function placeWord(w, x, reveal = 1, color = INK, opacity = 1, scale = 1) {
  const el = w.el;
  el.style.left = px(x);
  el.style.opacity = opacity.toFixed(3);
  el.style.color = color;
  el.style.clipPath = reveal < 1 ? `inset(-20% ${((1 - reveal) * 100).toFixed(2)}% -20% 0)` : 'none';
  el.style.transform = scale !== 1 ? `scale(${scale.toFixed(4)})` : 'none';
}
function updateS2(t) {
  $('s2').classList.toggle('over', t < WIPE_B);
  const cx = 960;
  const intro = t >= 4.52;
  for (const k of ['at', 'every', 'step', 'intro', 'ducing']) s2[k].el.style.display = 'none';
  let leftEdge, rightEdge;
  const padK = kf(t, [[2.8, 10], [3.0, 22, E.outBack], [4.18, 22], [4.32, 48, E.outCubic], [4.48, 26, E.outBack], [4.6, 22], [5.5, 22], [5.62, 34, E.outCubic], [5.78, 22]]);
  if (!intro) {
    // typed words with springy spacing
    const words = ['at', 'every', 'step'].map((id) => s2[id]);
    let content = 0;
    const parts = [];
    words.forEach((w, i) => {
      const r = E.outCubic(seg(t, w.a, w.a + 0.1 + w.txt.length * 0.018));
      if (r <= 0) return;
      const gap = i === 0 ? 0 : s2.space * E.outBack(seg(t, w.a + 0.06, w.a + 0.34));
      parts.push({ w, r, gap });
      content += gap + w.w * r;
    });
    const total = s2.brL.w + padK * 2 + content + s2.brR.w;
    let x = cx - total / 2;
    leftEdge = x;
    const braceIn = E.outBack(seg(t, 2.8, 2.98));
    const braceCol = rgba(mixc(hex(CLAUDE), hex(INK), seg(t, 3.0, 3.3)));
    placeWord(s2.brL, x, 1, braceCol, braceIn);
    x += s2.brL.w + padK;
    for (const p of parts) {
      x += p.gap;
      p.w.el.style.display = 'flex';
      placeWord(p.w, x, p.r, INK, 1);
      x += p.w.w * p.r;
    }
    x += padK;
    placeWord(s2.brR, x, 1, INK, braceIn);
    rightEdge = x + s2.brR.w;
  } else {
    const gapW = kf(t, [[4.52, 0], [4.72, 214, E.outCubic], [5.7, 214], [5.88, 0, E.inOutCubic]]);
    const pop = 1 + 0.04 * Math.sin(Math.PI * seg(t, 5.86, 5.98));
    const total = s2.brL.w + padK * 2 + s2.intro.w + gapW + s2.ducing.w + s2.brR.w;
    let x = cx - total / 2;
    const col = rgba(mixc(hex('#C4552F'), hex(INK), seg(t, 5.12, 5.3)));
    placeWord(s2.brL, x, 1, INK, 1, pop); x += s2.brL.w + padK;
    s2.intro.el.style.display = 'flex'; placeWord(s2.intro, x, 1, col, 1, pop); x += s2.intro.w;
    const gapX = x; x += gapW;
    s2.ducing.el.style.display = 'flex'; placeWord(s2.ducing, x, 1, col, 1, pop); x += s2.ducing.w + padK;
    placeWord(s2.brR, x, 1, INK, 1, pop);
    // thumbnail carousel inside the gap
    const clip = $('thumbclip');
    clip.style.display = gapW > 2 ? 'block' : 'none';
    clip.style.left = px(gapX + 4);
    clip.style.width = px(Math.max(0, gapW - 8));
    const centre = (gapW - 8) / 2;
    const scroll = 560 * (t - 4.52);
    s2.thumbs.forEach((img, k) => {
      const xx = centre + 140 + k * 84 - scroll;
      const d = Math.abs(xx - centre);
      const sc = 1.62 - Math.min(1, d / 120) * 0.88;
      img.style.transform = `translate(${px(xx - 30)}, -50%) scale(${sc.toFixed(3)})`;
      img.style.zIndex = String(100 - Math.round(d));
      img.style.opacity = d > 260 ? 0 : 1;
    });
  }
  if (!intro) $('thumbclip').style.display = 'none';
  // arrows sliding in from the edges
  const ap = E.outCubic(seg(t, 4.52, 5.15));
  const ao = kf(t, [[4.52, 0], [4.62, 0.9], [5.0, 0.55], [5.22, 0]]);
  $('arrL').style.left = px(cx - 760 + 90 * ap - 65);
  $('arrR').style.left = px(cx + 760 - 90 * ap - 65);
  $('arrL').style.opacity = ao.toFixed(3);
  $('arrR').style.opacity = ao.toFixed(3);
  // handles
  const hs = handleState(t);
  hs.forEach((h, i) => {
    const el = $(`hd${i}`);
    if (!h || h.s <= 0.01) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.transform = `translate(${px(cx + h.x)}, ${px(540 + h.y)}) scale(${h.s.toFixed(3)})`;
  });
}

/* =========================================================================
   S3 — 3D studio with monitor (Three.js), colour-graded, push-in
   ========================================================================= */
const s3 = {};
function stoneTexture(seed, base, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const r = mulberry32(seed);
  for (let i = 0; i < 2600; i++) {
    const x = r() * size, y = r() * size, rad = 1 + r() * 7;
    const l = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${l},${l},${l},${0.02 + r() * 0.05})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
async function initS3() {
  const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();

  // sky gradient background + haze
  const sc = document.createElement('canvas'); sc.width = 4; sc.height = 512;
  const sg = sc.getContext('2d'); const gr = sg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#7FAEDF'); gr.addColorStop(0.5, '#B9D3EC'); gr.addColorStop(0.8, '#E3ECF2'); gr.addColorStop(1, '#F1F1EE');
  sg.fillStyle = gr; sg.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(sc); skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog('#DDE7EF', 22, 150);

  const M = (color, rough = 0.9, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const add = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
    if (opts.rot) m.rotation.set(...opts.rot);
    if (opts.scale) m.scale.set(...opts.scale);
    scene.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // architecture
  add(box(13, 0.1, 10), M('#CFCBC4', 0.55, 0, { map: stoneTexture(3, '#CFCBC4') }), 0, -0.05, 1.3);          // polished concrete floor
  add(new THREE.PlaneGeometry(400, 400), M('#D9CFB7', 1), 0, -0.03, -150, { rot: [-Math.PI / 2, 0, 0], cast: false }); // outside ground
  add(box(13, 0.32, 10), M('#E8E5DF', 0.95), 0, 3.56, 1.3);                     // ceiling slab
  add(box(0.32, 3.7, 10), M('#D5D1CA', 0.95, 0, { map: stoneTexture(5, '#D5D1CA') }), 4.45, 1.85, 1.3);  // right wall
  add(box(0.32, 3.7, 10), M('#CFCAC2', 0.95), -6.5, 1.85, 1.3);                 // left wall
  const frameMat = M('#202020', 0.55, 0.3);
  [-6.3, -3.75, -1.25, 1.25, 3.75].forEach((x) => add(box(0.08, 3.42, 0.12), frameMat, x, 1.71, -3.5));
  add(box(10.9, 0.14, 0.14), frameMat, -1.2, 3.36, -3.5);
  add(box(10.9, 0.07, 0.16), frameMat, -1.2, 0.035, -3.5);
  add(box(0.5, 3.7, 0.5), M('#BDB8B0', 0.95), 4.1, 1.85, -3.3);                  // concrete pier
  // outside: white walls, hills, bare white trees
  const white = M('#EFEEEA', 0.9);
  add(box(0.5, 5.5, 9), white, 7.5, 2.75, -9);
  add(box(9, 1.3, 0.4), white, 3.2, 0.65, -12.5);
  const hillMat = M('#B9AF8E', 1), hillMat2 = M('#A7A07F', 1), farMat = M('#AFBFCB', 1);
  add(new THREE.SphereGeometry(1, 48, 24), hillMat, -14, -3.2, -42, { scale: [26, 7.4, 13], cast: false });
  add(new THREE.SphereGeometry(1, 48, 24), hillMat2, 12, -4.5, -50, { scale: [30, 8.2, 14], cast: false });
  add(new THREE.SphereGeometry(1, 48, 24), hillMat, 34, -3.5, -64, { scale: [30, 8.8, 15], cast: false });
  add(new THREE.SphereGeometry(1, 48, 24), farMat, -30, -6, -110, { scale: [60, 16, 20], cast: false });
  add(new THREE.SphereGeometry(1, 48, 24), farMat, 40, -8, -120, { scale: [70, 20, 20], cast: false });
  const treeMat = M('#F1EFEA', 0.85);
  const tr = mulberry32(7);
  function branch(start, dir, len, rad, depth) {
    const end = start.clone().addScaledVector(dir, len);
    const geo = new THREE.CylinderGeometry(rad * 0.68, rad, len, 6);
    const m = new THREE.Mesh(geo, treeMat);
    m.position.copy(start).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.castShadow = true;
    scene.add(m);
    if (depth <= 0) return;
    const n = depth > 3 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const nd = dir.clone().add(new THREE.Vector3((tr() - 0.5) * 1.3, tr() * 0.5, (tr() - 0.5) * 1.3)).normalize();
      branch(end, nd, len * (0.66 + tr() * 0.12), rad * 0.62, depth - 1);
    }
  }
  branch(new THREE.Vector3(-3.4, 0, -8.5), new THREE.Vector3(0.05, 1, 0).normalize(), 1.7, 0.09, 5);
  branch(new THREE.Vector3(2.4, 0, -15), new THREE.Vector3(-0.08, 1, 0).normalize(), 1.9, 0.1, 5);
  branch(new THREE.Vector3(-8.5, 0, -18), new THREE.Vector3(0.1, 1, 0).normalize(), 1.6, 0.08, 4);

  // stone desk (displaced cylinder)
  const dg = new THREE.CylinderGeometry(1, 1, 0.74, 160, 12, false);
  const pos = dg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.98) continue;
    const ang = Math.atan2(z, x);
    const yy = clamp((y + 0.37) / 0.74); // 0 bottom .. 1 top
    const rough = 0.5 + 0.5 * yy;
    let d = 1 + 0.045 * noise1(ang * 4 + 10, 1) + 0.03 * noise1(ang * 9 + yy * 2.5, 2) * rough + 0.014 * noise1(ang * 23 + yy * 6, 3);
    d *= 1 - 0.16 * Math.pow(1 - yy, 1.8);
    if (yy < 0.99) d += 0.022 * noise1(yy * 5 + ang * 2.2, 4);
    pos.setX(i, x * d); pos.setZ(i, z * d);
    if (yy > 0.02 && yy < 0.98) pos.setY(i, y + 0.012 * noise1(ang * 9, 5));
  }
  dg.computeVertexNormals();
  const rockSide = M('#C9C4BB', 0.93, 0, { flatShading: true, map: stoneTexture(11, '#C9C4BB') });
  const rockTop = M('#DAD6CF', 0.55, 0, { map: stoneTexture(13, '#DAD6CF') });
  const desk = new THREE.Mesh(dg, [rockSide, rockTop, rockSide]);
  desk.position.set(0, 0.37, -0.25); desk.scale.set(1.45, 1, 0.82);
  desk.castShadow = desk.receiveShadow = true;
  scene.add(desk);

  // monitor
  const tex = await new THREE.TextureLoader().loadAsync('../assets/screen.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const SCX = 0, SCY = 1.3, SCZ = -0.42;
  const silver = M('#D9D9DB', 0.35, 0.65);
  add(box(1.06, 0.68, 0.028), M('#161616', 0.4, 0.2), SCX, SCY, SCZ);                 // bezel
  add(box(1.06, 0.68, 0.01), silver, SCX, SCY, SCZ - 0.019);                          // back shell
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.625), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(SCX, SCY, SCZ + 0.0145);
  scene.add(screen);
  add(box(0.075, 0.42, 0.03), silver, SCX, 0.95, SCZ - 0.06);                        // neck
  add(box(0.3, 0.014, 0.22), silver, SCX, 0.747, SCZ - 0.02);                         // foot
  add(box(0.44, 0.014, 0.14), M('#F1F1EF', 0.5), 0.0, 0.747, 0.06);                   // keyboard
  add(new THREE.SphereGeometry(1, 24, 16), M('#F1F1EF', 0.45), 0.38, 0.752, 0.08, { scale: [0.034, 0.014, 0.055] }); // mouse
  // terracotta mug
  const mugMat = M(CLAUDE, 0.55);
  add(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 32), mugMat, -0.48, 0.787, 0.02);
  add(new THREE.TorusGeometry(0.025, 0.007, 10, 24), mugMat, -0.432, 0.79, 0.02, { rot: [0, 0, Math.PI / 2] });
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 32), M('#5A3622', 0.3), -0.48, 0.828, 0.02, { cast: false });
  // plant
  add(new THREE.CylinderGeometry(0.11, 0.095, 0.2, 32), M('#2F3337', 0.7), -0.72, 0.84, -0.42);
  const leafMat = M('#4A8A3C', 0.6, 0, { side: THREE.DoubleSide });
  const lr = mulberry32(21);
  for (let k = 0; k < 14; k++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), leafMat);
    const a = (k / 14) * Math.PI * 2 + lr() * 0.4;
    const tilt = 0.35 + lr() * 0.6;
    const len = 0.14 + lr() * 0.12;
    leaf.scale.set(0.022, len, 0.006);
    leaf.position.set(-0.72 + Math.cos(a) * Math.sin(tilt) * len * 0.9, 0.94 + Math.cos(tilt) * len * 0.9, -0.42 + Math.sin(a) * Math.sin(tilt) * len * 0.9);
    leaf.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    leaf.castShadow = true;
    scene.add(leaf);
  }
  // brass lamp
  const brass = M('#C9A564', 0.3, 0.85);
  add(box(0.12, 0.16, 0.12), M('#9D9890', 0.9), -1.05, 0.82, -0.55);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.82, 12), brass, -1.05, 1.31, -0.55);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), brass, -0.9, 1.72, -0.55, { rot: [0, 0, Math.PI / 2] });
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.13, 24), brass, -0.75, 1.66, -0.55);
  // notebook stack
  add(box(0.24, 0.025, 0.17), M('#E9E2D4', 0.8), 0.78, 0.755, -0.25, { rot: [0, 0.25, 0] });
  add(box(0.22, 0.022, 0.16), M('#2B1D16', 0.7), 0.79, 0.778, -0.25, { rot: [0, 0.4, 0] });

  // lights
  const sun = new THREE.DirectionalLight('#FFF1DE', 3.1);
  sun.position.set(-6.5, 6.2, -10);
  sun.target.position.set(0.4, 0, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#DCE8F5', '#D2C6B4', 1.7));
  const fill = new THREE.PointLight('#FFF4E8', 22, 14, 2); fill.position.set(0.6, 2.2, 3.4); scene.add(fill);

  const cam = new THREE.PerspectiveCamera(38, W / H, 0.03, 400);
  Object.assign(s3, { renderer, scene, cam, SCY, SCZ });

  cue(6.25, 'reveal', { v: 1 });
  cue(8.35, 'swell', { v: 0.9, dur: 1.6 });
  cue(9.98, 'pop', { v: 0.8 });
}
function updateS3(t) {
  const { renderer, scene, cam, SCY, SCZ } = s3;
  const p1 = E.inOutSine(seg(t, 6.25, 8.6));
  const p2 = E.inOutQuart(seg(t, 8.35, 10.0));
  const A = [0.55, 1.62, 4.9], B = [0.15, 1.5, 3.8], C = [0, SCY, SCZ + 0.62];
  const pos = A.map((v, i) => lerp(lerp(v, B[i], p1), C[i], p2));
  const lookA = [0.05, 1.12, -0.35], lookC = [0, SCY, SCZ];
  const look = lookA.map((v, i) => lerp(v, lookC[i], E.inOutCubic(seg(t, 8.2, 9.6))));
  cam.position.set(pos[0] + 0.04 * Math.sin(t * 0.9) * (1 - p2), pos[1], pos[2]);
  cam.lookAt(look[0], look[1], look[2]);
  cam.fov = lerp(38, 34, p2);
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);

  // colour grades: pink wash -> orange gradient-map -> natural
  $('g3').style.opacity = kf(t, [[6.25, 0.6], [6.6, 0.38], [7.0, 0.18], [7.6, 0]]).toFixed(3);
  $('g1').style.opacity = kf(t, [[6.25, 1], [6.72, 0.92], [6.98, 0]]).toFixed(3);
  $('g2').style.opacity = kf(t, [[6.86, 0], [7.0, 0.96, E.outCubic], [7.42, 0.9], [7.85, 0]]).toFixed(3);
  const m = lerp(-30, 120, seg(t, 7.3, 7.9));
  $('g2').style.maskImage = `linear-gradient(0deg, transparent ${m.toFixed(1)}%, #000 ${(m + 30).toFixed(1)}%)`;
  $('g2').style.webkitMaskImage = $('g2').style.maskImage;
}

/* =========================================================================
   S4 — halftone sky, wordmark, prompt typing
   ========================================================================= */
const PROMPT = 'Build a landing page for my coffee brand.';
const BIG_FONT = '400 240px Inter';
const s4 = {};
const GW = 480, GH = 270, FW = 680, FH = 340;
const BAYER = (() => {
  const b = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
  return b.flat().map((v) => (v + 0.5) / 64);
})();
function buildCloudField(seed, clusters) {
  const f = new Float32Array(FW * FH);
  const r = mulberry32(seed);
  for (const cl of clusters) {
    const n = cl.n;
    for (let k = 0; k < n; k++) {
      const u = (r() - 0.5) * 2;
      const pxx = cl.x + u * cl.w / 2;
      const dome = 1 - Math.abs(u);
      const pyy = cl.y - dome * cl.h * (0.35 + r() * 0.65) + (r() - 0.5) * cl.h * 0.25;
      const rad = cl.rMin + r() * (cl.rMax - cl.rMin) * (0.55 + dome * 0.45);
      const x0 = Math.max(0, Math.floor(pxx - rad)), x1 = Math.min(FW - 1, Math.ceil(pxx + rad));
      const y0 = Math.max(0, Math.floor(pyy - rad)), y1 = Math.min(FH - 1, Math.ceil(pyy + rad));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - pxx, dy = y - pyy;
          const d = Math.sqrt(dx * dx + dy * dy) / rad;
          if (d >= 1) continue;
          let v = d < 0.62 ? 1 : 1 - (d - 0.62) / 0.38;
          v = v * v * (3 - 2 * v);
          const shade = 1 - 0.42 * clamp(dy / rad + 0.15) - 0.08 * clamp(-dx / rad);
          v *= shade;
          const idx = y * FW + x;
          if (v > f[idx]) f[idx] = v;
        }
      }
    }
  }
  return f;
}
function initS4() {
  const rr = mulberry32(99);
  const back = [];
  for (let i = 0; i < 7; i++) back.push({ x: 30 + i * 104 + rr() * 30, y: 312 + rr() * 22, w: 120 + rr() * 40, h: 92 + rr() * 30, n: 34, rMin: 12, rMax: 27 });
  for (let i = 0; i < 6; i++) back.push({ x: 60 + i * 118 + rr() * 40, y: 196 + rr() * 34, w: 84 + rr() * 34, h: 62 + rr() * 26, n: 20, rMin: 9, rMax: 20 });
  for (let i = 0; i < 7; i++) back.push({ x: 20 + i * 100 + rr() * 50, y: 92 + rr() * 34, w: 50 + rr() * 34, h: 30 + rr() * 16, n: 10, rMin: 6, rMax: 14 });
  const front = [];
  for (let i = 0; i < 5; i++) front.push({ x: 60 + i * 150 + rr() * 40, y: 338 + rr() * 10, w: 130 + rr() * 40, h: 70 + rr() * 20, n: 26, rMin: 11, rMax: 24 });
  front.push({ x: 120, y: 236, w: 90, h: 44, n: 12, rMin: 8, rMax: 17 });
  front.push({ x: 600, y: 244, w: 100, h: 50, n: 13, rMin: 8, rMax: 18 });
  s4.back = buildCloudField(5, back);
  s4.front = buildCloudField(6, front);
  // wordmark mask in grid space
  const wc = document.createElement('canvas'); wc.width = GW; wc.height = GH;
  const wg = wc.getContext('2d');
  wg.fillStyle = '#fff'; wg.textAlign = 'center'; wg.textBaseline = 'alphabetic';
  wg.font = '400 132px Newsreader';
  wg.fillText('Claude', GW / 2, GH / 2 + 34);
  const wd = wg.getImageData(0, 0, GW, GH).data;
  s4.word = new Float32Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) s4.word[i] = wd[i * 4 + 3] / 255;
  s4.sky = $('sky').getContext('2d');
  s4.img = s4.sky.createImageData(GW, GH);
  s4.closeCtx = $('closebg').getContext('2d');
  s4.closeImg = s4.closeCtx.createImageData(GW, GH);
  // typing schedule
  const segs = [[10.12, 10.64, 0, 7], [10.76, 11.9, 7, 25], [11.98, 12.56, 25, 37], [12.62, 12.86, 37, 41]];
  s4.keys = [];
  const kr = mulberry32(17);
  for (const [a, b, i0, i1] of segs) {
    const n = i1 - i0, step = (b - a) / n;
    for (let k = 0; k < n; k++) s4.keys.push(a + k * step + (kr() - 0.5) * step * 0.5);
  }
  s4.keys.sort((x, y) => x - y);
  s4.keys.forEach((kt, i) => cue(kt, 'key', { v: kt > 10.7 && kt < 12.6 ? 1 : 0.7, ch: PROMPT[i] }));
  s4.prefixW = [0];
  for (let i = 1; i <= PROMPT.length; i++) s4.prefixW.push(measure(PROMPT.slice(0, i), BIG_FONT));
  s4.smallPrefixW = [0];
  for (let i = 1; i <= PROMPT.length; i++) s4.smallPrefixW.push(measure(PROMPT.slice(0, i), '400 29px Inter'));
  cue(10.0, 'air', { v: 0.6 });
  cue(10.7, 'cut', { v: 0.5 }); cue(11.95, 'cut', { v: 0.5 }); cue(12.6, 'cut', { v: 0.5 });
  cue(13.33, 'click', { v: 1 }); cue(13.4, 'send', { v: 0.9 });
  cue(13.78, 'whoosh', { v: 0.8, dur: 0.45 });
}
const SKY = hex('#58C4F2'), WORDC = hex('#B4E5FA'), CLOUD = [255, 255, 255];
function ditherSky(ctx, img, t, zoom, cxF, cyF, pixel) {
  // pixel: size of each dither cell on screen (4 = normal, larger = zoomed look)
  const data = img.data;
  const cols = Math.ceil(W / pixel), rows = Math.ceil(H / pixel);
  const dt = t - 10;
  const oxB = 100 + dt * 5.5, oyB = 40 - dt * 0.6;
  const oxF = 90 + dt * 9, oyF = 46;
  const sc = pixel / 4 / zoom; // field cells per screen cell
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const gx = cxF + (i - cols / 2) * sc, gy = cyF + (j - rows / 2) * sc;
      const th = BAYER[(j & 7) * 8 + (i & 7)];
      let c = SKY;
      const bx = Math.floor(gx + oxB), byy = Math.floor(gy + oyB);
      if (bx >= 0 && bx < FW && byy >= 0 && byy < FH && s4.back[byy * FW + bx] > th) c = CLOUD;
      const wx = Math.floor(gx), wy = Math.floor(gy);
      if (wx >= 0 && wx < GW && wy >= 0 && wy < GH) {
        const w = s4.word[wy * GW + wx] * 0.86;
        if (w > BAYER[((j + 3) & 7) * 8 + ((i + 5) & 7)]) c = c === CLOUD ? [214, 240, 252] : WORDC;
      }
      const fx = Math.floor(gx + oxF), fy = Math.floor(gy + oyF);
      if (fx >= 0 && fx < FW && fy >= 0 && fy < FH && s4.front[fy * FW + fx] > th) c = CLOUD;
      const o = (j * GW + i) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { cols, rows };
}
function sendIcon(state) {
  // state: 'off' | 'on' | 'stop'
  if (state === 'stop') return '<svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="3" fill="#fff"/></svg>';
  const col = state === 'on' ? '#fff' : '#8C7A66';
  return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
}
function updateS4(t) {
  const count = s4.keys.filter((k) => k <= t).length;
  const text = PROMPT.slice(0, count);
  const close = t >= 10.7 && t < 12.6;
  // sky (subtle slow zoom)
  const z = 1 + 0.03 * seg(t, 10, 14.2);
  const skyCanvas = $('sky');
  if (!close) {
    const { cols, rows } = ditherSky(s4.sky, s4.img, t, z, GW / 2, GH / 2, 4);
    skyCanvas.style.width = px(GW * 4); skyCanvas.style.height = px(GH * 4);
  }
  $('close').style.display = close ? 'block' : 'none';
  $('inputWrap').style.display = close ? 'none' : 'block';
  if (close) {
    // zoomed halftone background with chunky dots
    ditherSky(s4.closeCtx, s4.closeImg, t, 2.6, GW / 2 + 40, GH / 2 + 2, 12);
    const cb = $('closebg');
    cb.style.width = px(GW * 12); cb.style.height = px(GH * 12);
    const second = t >= 11.95;
    const caretTarget = second ? lerp(780, 1200, seg(t, 11.95, 12.6)) : lerp(1020, 1520, seg(t, 10.7, 11.95));
    const tw = s4.prefixW[count];
    const left = caretTarget - tw;
    const shotScale = second ? lerp(1.0, 1.035, seg(t, 11.95, 12.6)) : lerp(1.0, 1.04, seg(t, 10.7, 11.95));
    const yOff = second ? -18 : 0;
    $('bigText').textContent = text;
    $('bigText').style.left = px(left);
    $('bigText').style.transform = `translateY(${yOff}px) scale(${shotScale.toFixed(4)})`;
    $('bigText').style.transformOrigin = `${(caretTarget - left).toFixed(1)}px 540px`;
    $('bigCaret').style.left = px(caretTarget + 10);
    $('bigCaret').style.transform = `translateY(${yOff}px) scale(${shotScale.toFixed(4)})`;
    $('band').style.transform = `translateY(${yOff}px)`;
    return;
  }
  // wide shot: input bar
  const inputEl = $('input');
  $('inputText').textContent = text;
  $('inputPh').style.opacity = count === 0 ? 1 : 0;
  const caretBlink = count >= PROMPT.length && t > 12.9 ? (Math.floor((t - 12.9) * 2.2) % 2 === 0 ? 1 : 0) : 1;
  $('caret').style.left = px(36 + s4.smallPrefixW[count] + 2);
  $('caret').style.opacity = t < 13.42 ? caretBlink : 0;
  // send button state
  const btn = $('sendBtn');
  const state = t >= 13.42 ? 'stop' : count > 0 ? 'on' : 'off';
  if (btn.dataset.state !== state) { btn.innerHTML = sendIcon(state); btn.dataset.state = state; }
  const press = Math.sin(Math.PI * seg(t, 13.32, 13.44));
  btn.style.background = state === 'off' ? '#E5D5C1' : rgba(mixc(hex(CLAUDE), hex('#B9562F'), press));
  btn.style.transform = `scale(${(1 - 0.12 * press).toFixed(3)})`;
  // sent text slides up and fades
  const sent = E.inOutCubic(seg(t, 13.45, 13.72));
  $('inputText').style.transform = `translateY(${px(-36 * sent)})`;
  $('inputText').style.opacity = (1 - sent).toFixed(3);
  // pointer
  const ptr = $('pointer');
  if (t >= 12.88 && t < 13.95) {
    const mv = E.outCubic(seg(t, 12.9, 13.28));
    const x = lerp(250, 404, mv), y = lerp(160, -2, mv);
    const away = E.inOutCubic(seg(t, 13.55, 13.9));
    const clickS = 1 - 0.14 * Math.sin(Math.PI * seg(t, 13.3, 13.42));
    ptr.style.display = 'block';
    ptr.style.transform = `translate(${px(x + 60 * away)}, ${px(y + 70 * away)}) scale(${clickS.toFixed(3)})`;
    ptr.style.opacity = (1 - away).toFixed(3);
  } else ptr.style.display = 'none';
  // bar intro + collapse
  const intro = E.outCubic(seg(t, 10.0, 10.22));
  const col = E.inOutCubic(seg(t, 13.78, 14.12));
  const wBar = lerp(900, 84, col);
  inputEl.style.width = px(wBar);
  inputEl.style.left = px(-wBar / 2);
  inputEl.style.transform = `scale(${lerp(0.94, 1, intro).toFixed(4)})`;
  inputEl.style.opacity = (intro * (1 - seg(t, 14.05, 14.2))).toFixed(3);
  inputEl.style.filter = col > 0.4 ? `blur(${((col - 0.4) * 14).toFixed(2)}px)` : 'none';
}

/* =========================================================================
   S5 — "Building artifact" steps
   ========================================================================= */
const s5 = {};
const STEP_ICONS = {
  think: () => sparkSVG(CLAUDE),
  research: () => '<svg viewBox="0 0 24 24" fill="none" stroke="#4A8FE0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><path d="m20.5 20.5-4.9-4.9"/><path d="M3.5 10.5h14M10.5 3.5c2.2 2 2.2 12 0 14M10.5 3.5c-2.2 2-2.2 12 0 14" opacity=".55"/></svg>',
  write: () => '<svg viewBox="0 0 24 24" fill="none" stroke="#9A6BE0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="19" height="17" rx="3.5"/><path d="m9 9.5-3 2.5 3 2.5M15 9.5l3 2.5-3 2.5M13 8.5l-2 7"/></svg>',
  assemble: () => '<svg viewBox="0 0 24 24" fill="none" stroke="#D9A33A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="16" height="15.5" rx="3.5"/><path d="M2.5 10h16M8 10v10.5"/><path d="M20.5 1.5v4.5M18.25 3.75h4.5"/></svg>',
};
const STEPS = [
  { ic: 'think', lab: 'Thinking', sub: ' – about your brand', col: '#D97757' },
  { ic: 'research', lab: 'Researching', sub: ' – specialty coffee trends', col: '#4A8FE0' },
  { ic: 'write', lab: 'Writing', sub: ' – HTML, CSS & copy', col: '#9A6BE0' },
  { ic: 'assemble', lab: 'Assembling', sub: ' – your landing page', col: '#C8932C' },
];
const S5_TITLE = 'Building artifact';
function initS5() {
  const tt = $('s5title');
  s5.tl = [...S5_TITLE].map((ch) => { const s = document.createElement('span'); s.textContent = ch; tt.appendChild(s); return s; });
  s5.titleW = measure(S5_TITLE, '400 70px Inter');
  const holder = $('s5steps');
  s5.steps = STEPS.map((st, k) => {
    const d = document.createElement('div');
    d.className = 'step';
    d.style.top = px(140 + k * 122);
    d.innerHTML = `<div class="ic">${STEP_ICONS[st.ic]()}</div><span class="lab">${st.lab}</span><span class="sub">${st.sub}</span>`;
    holder.appendChild(d);
    return { el: d, a: 14.98 + k * 0.34, lab: d.querySelector('.lab'), sub: d.querySelector('.sub'), ic: d.querySelector('.ic'), col: hex(st.col) };
  });
  $('s5work').style.top = px(140 + 4 * 122 + 18);
  s5.steps.forEach((s) => cue(s.a, 'beep', { v: 0.8, n: s5.steps.indexOf(s) }));
  cue(14.2, 'boom', { v: 0.9 }); cue(14.74, 'cut', { v: 0.5 });
  [15.26, 15.72, 16.18].forEach((x) => cue(x, 'cut', { v: 0.45 }));
  cue(14.95, 'data', { v: 0.6, dur: 1.7 });
}
function updateS5(t) {
  // title types in (orange), then turns ink
  const n = s5.tl.length;
  s5.tl.forEach((sp, i) => {
    const a = 14.22 + i * 0.014;
    const k = seg(t, a, a + 0.08);
    sp.style.opacity = k.toFixed(3);
    sp.style.color = rgba(mixc(hex('#9A6BE0'), hex(INK), seg(t, 14.45, 14.7)));
  });
  // camera framing (jump-cut style reframes)
  const centred = [960 - s5.titleW / 2, 540 - 44, 1];
  const frames = [[14.2, centred], [14.74, centred], [14.75, [170, 150, 0.84], E.outExpo], [15.25, [170, 150, 0.84]], [15.6, [250, 96, 0.98], E.outExpo],
    [15.7, [250, 96, 0.98]], [16.0, [190, 30, 1.1], E.outExpo], [16.18, [190, 30, 1.1]], [16.5, [300, 120, 0.93], E.outExpo]];
  const [tx, ty, sc] = kf(t, frames, E.outExpo);
  $('s5g').style.transform = `translate(${px(tx)}, ${px(ty)}) scale(${sc.toFixed(4)})`;
  // rule + steps
  const listOn = t >= 14.75;
  $('s5rule').style.display = listOn ? 'block' : 'none';
  $('s5rule').style.height = px(lerp(0, 512, E.outCubic(seg(t, 14.75, 16.2))));
  s5.steps.forEach((s) => {
    const k = seg(t, s.a, s.a + 0.22);
    s.el.style.display = k > 0 ? 'flex' : 'none';
    s.el.style.opacity = E.outCubic(k).toFixed(3);
    s.el.style.transform = `translateX(${px((1 - E.outCubic(k)) * 26)})`;
    s.ic.style.transform = `scale(${E.outBack(seg(t, s.a, s.a + 0.2)).toFixed(3)})`;
    s.lab.style.color = rgba(mixc(s.col, hex(INK), seg(t, s.a + 0.25, s.a + 0.45)));
    s.sub.style.opacity = seg(t, s.a + 0.08, s.a + 0.3).toFixed(3);
  });
  const w = $('s5work');
  w.style.display = listOn ? 'flex' : 'none';
  w.style.opacity = seg(t, 14.75, 14.9).toFixed(3);
  w.querySelector('.txt').style.backgroundPosition = `${(100 - ((t * 0.9) % 1) * 200).toFixed(1)}% 0`;
  $('s5spin').innerHTML = sparkSVG(CLAUDE, { rot: t * 180, grow: 0.8 + 0.2 * Math.sin(t * 9) });
  $('s5').style.opacity = seg(t, 14.2, 14.28).toFixed(3);
}

/* =========================================================================
   S6 — dots assemble into the landing page
   ========================================================================= */
const s6 = {};
const DOT_PAL = ['#E4688E', '#E58A7A', '#F2B48A', '#F5CF80', '#B98AE0', '#C85CA2', '#D97757', '#EE8F6E', '#A877E6'].map(hex);
function initS6() {
  const img = $('s6img');
  const cols = 18, rows = 24;
  const sc = document.createElement('canvas'); sc.width = cols * 10; sc.height = rows * 10;
  const g = sc.getContext('2d');
  g.drawImage(img, 0, 0, sc.width, sc.height);
  const d = g.getImageData(0, 0, sc.width, sc.height).data;
  const r = mulberry32(4);
  s6.dots = [];
  const order = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) order.push([i, j, r()]);
  order.sort((a, b) => a[2] - b[2]);
  order.forEach(([i, j], rank) => {
    let R = 0, G = 0, B = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const o = ((j * 10 + y) * sc.width + (i * 10 + x)) * 4; R += d[o]; G += d[o + 1]; B += d[o + 2]; }
    const frac = rank / (cols * rows);
    s6.dots.push({
      i, j, target: [R / 100, G / 100, B / 100], pal: DOT_PAL[Math.floor(r() * DOT_PAL.length)],
      a: 16.74 + 0.58 * Math.pow(frac, 0.75), m: 17.26 + 0.2 * r(), jx: (r() - 0.5) * 26, jy: (r() - 0.5) * 26,
    });
  });
  s6.cols = cols; s6.rows = rows;
  s6.ctx = $('dots').getContext('2d');
  for (let k = 0; k < 14; k++) cue(16.74 + 0.58 * Math.pow(k / 14, 0.75), 'plink', { v: 0.5, n: k });
  cue(16.7, 'riser', { v: 0.9, dur: 0.86 });
  cue(17.56, 'impact', { v: 1 });
}
function updateS6(t) {
  const ctx = s6.ctx;
  ctx.clearRect(0, 0, W, H);
  // grid rect shrinks from 600x800 to 540x720 as the real image takes over
  const shrink = E.inOutCubic(seg(t, 17.5, 17.92));
  const gw = lerp(600, 540, shrink), gh = lerp(800, 720, shrink);
  const x0 = 960 - gw / 2, y0 = 540 - gh / 2;
  const cw = gw / s6.cols, ch = gh / s6.rows;
  const fade = seg(t, 17.52, 17.78);
  for (const dot of s6.dots) {
    if (t < dot.a) continue;
    const p = seg(t, dot.a, dot.a + 0.14);
    const settle = E.outCubic(seg(t, dot.a, dot.a + 0.32));
    const col = mixc(dot.pal, dot.target, E.inOutCubic(seg(t, dot.m, dot.m + 0.16)));
    const rad = (cw * 0.41) * E.outBack(p) * lerp(1, 0.25, E.inCubic(fade));
    const x = x0 + (dot.i + 0.5) * cw + dot.jx * (1 - settle);
    const y = y0 + (dot.j + 0.5) * ch + dot.jy * (1 - settle);
    ctx.globalAlpha = 1 - fade * 0.95;
    ctx.fillStyle = rgba(col);
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, rad), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const img = $('s6img');
  const io = E.inOutCubic(seg(t, 17.46, 17.72));
  img.style.opacity = io.toFixed(3);
  img.style.width = px(gw); img.style.height = px(gh);
  img.style.transform = `translate(${px(x0)}, ${px(y0)})`;
  img.style.borderRadius = '6px';
}

/* =========================================================================
   S7 — 3D card cascade + words
   ========================================================================= */
const CARD_SEQ = [
  ['landing', 18.0], ['app', 18.24], ['dashboard', 18.48], ['code', 18.72], ['poster', 19.02], ['chat', 19.36],
  ['terminal', 19.7], ['doc', 20.06], ['brand', 20.42], ['data', 20.72], ['menu', 20.98], ['email', 21.24],
  ['research', 21.5], ['slides', 21.76], ['landing', 22.64],
];
const s7 = { cards: [] };
function initS7() {
  const deck = $('deck');
  CARD_SEQ.forEach(([name, e], i) => {
    const d = document.createElement('div');
    d.className = 'c3';
    d.innerHTML = `<img src="../assets/${name}.png">`;
    deck.appendChild(d);
    s7.cards.push({ el: d, e, i });
    if (i > 0) cue(e, 'card', { v: i >= 10 && i < 14 ? 1 : 0.75, n: i });
  });
  s7.bg = document.createElement('div');
  s7.bg.style.cssText = `position:absolute;inset:0;background:${IVORY}`;
  $('s7').insertBefore(s7.bg, $('s7inner'));
  for (const id of ['wThink', 'wDeeper', 'wBuild', 'wFaster']) s7[id] = measure($(id).textContent, '500 78px Inter');
  cue(21.92, 'word', { v: 0.8 }); cue(23.42, 'word', { v: 1 });
  cue(22.58, 'whoosh', { v: 0.6, dur: 0.4 });
  cue(24.2, 'bigwhoosh', { v: 1, dur: 0.9 });
}
function cardAge(t, i) {
  let a = 0;
  for (let j = i + 1; j < s7.cards.length; j++) a += E.inOutCubic(seg(t, s7.cards[j].e, s7.cards[j].e + 0.3));
  return a;
}
function updateS7(t) {
  const mFan = E.inOutCubic(seg(t, 20.25, 20.85)) * (1 - E.inOutCubic(seg(t, 22.5, 22.95)));
  const mGather = E.inOutCubic(seg(t, 22.5, 22.95));
  const mStack = 1 - mFan - mGather;
  const stackSpread = kf(t, [[18.0, 0.18], [19.0, 0.28], [19.35, 1]]);
  const front = [
    960 * mStack + 1215 * mFan + 960 * mGather,
    540 * mStack + 560 * mFan + 540 * mGather,
  ];
  for (const c of s7.cards) {
    const q = c.i === 0 ? 1 : E.outCubic(seg(t, c.e - 0.02, c.e + 0.26));
    if (q <= 0) { c.el.style.display = 'none'; continue; }
    const a = cardAge(t, c.i);
    if (a > 9.5) { c.el.style.display = 'none'; continue; }
    c.el.style.display = 'block';
    const a1 = Math.min(a, 1);
    // stack
    const S = { x: -a * 36 * stackSpread, y: 0, z: -a * 70 * stackSpread, ry: 16 * a1 * stackSpread, s: 1 };
    // fan
    const F = { x: -a * 255 - (a1 * 30), y: Math.sin(c.i * 1.9) * 80 * a1, z: -a * 95 + (c.i % 2) * 50 * a1, ry: 14 * a1, s: 1 - Math.min(a, 5) * 0.035 };
    // gather
    const G = { x: -(255 + Math.min(a, 6) * 34) * a1, y: 92 * a1, z: -120 * a1, ry: 26 * a1, s: lerp(1, 0.36, a1) };
    let x = S.x * mStack + F.x * mFan + G.x * mGather;
    let y = S.y * mStack + F.y * mFan + G.y * mGather;
    let z = S.z * mStack + F.z * mFan + G.z * mGather;
    let ry = S.ry * mStack + F.ry * mFan + G.ry * mGather;
    let s = S.s * mStack + F.s * mFan + G.s * mGather;
    // entering from the right
    if (q < 1) {
      x = lerp(620, x, q); z = lerp(-260, z, q); ry = lerp(-38, ry, q); y = lerp(-30, y, q);
    }
    const cx = front[0] + x, cy = front[1] + y;
    const shadowK = c.i === s7.cards.length - 1 ? seg(t, 23.9, 24.3) : 0;
    c.el.style.transform = `translate3d(${px(cx - 270)}, ${px(cy - 360)}, ${px(z)}) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;
    c.el.style.zIndex = String(1000 - Math.round(a * 10));
    const lim = lerp(8.5, 5.5, mGather);
    c.el.style.opacity = (q < 1 ? clamp(q * 2.2) : 1) * (1 - seg(a, lim, lim + 1));
    if (shadowK > 0) c.el.querySelector('img').style.boxShadow = `0 ${px(30 + 20 * shadowK)} ${px(60 + 50 * shadowK)} rgba(40,30,20,${(0.13 + 0.25 * shadowK).toFixed(3)})`;
  }
  // words
  const wordStyle = (id, x, y, inA, outA, dir = 1) => {
    const el = $(id);
    const i = E.outCubic(seg(t, inA, inA + 0.2));
    const o = E.inCubic(seg(t, outA, outA + 0.16));
    const vis = i * (1 - o);
    el.style.display = vis > 0.001 ? 'block' : 'none';
    el.style.opacity = vis.toFixed(3);
    el.style.left = px(x - s7[id] / 2);
    el.style.top = px(y - 48 + (1 - i) * 28 * dir - o * 22 * dir);
  };
  wordStyle('wThink', front[0], 540 - 360 - 68, 21.92, 22.52, 1);
  wordStyle('wDeeper', front[0], 540 + 360 + 66, 21.97, 22.55, -1);
  wordStyle('wBuild', 960 - 650, 540, 23.42, 24.45, 1);
  wordStyle('wFaster', 960 + 560, 540, 23.47, 24.45, 1);
  // exit: ivory bg fades to reveal the gradient behind, deck blurs out
  const ex = seg(t, 24.25, 24.85);
  s7.bg.style.opacity = (1 - E.inOutCubic(seg(t, 24.15, 24.6))).toFixed(3);
  $('s7inner').style.filter = ex > 0 ? `blur(${(ex * 46).toFixed(2)}px)` : 'none';
  $('s7inner').style.opacity = (1 - E.inQuad(ex)).toFixed(3);
  $('s7inner').style.transform = `scale(${(1 + 0.06 * E.inCubic(ex)).toFixed(4)})`;
}

/* =========================================================================
   S8 — gradient + tagline with selection handles; S9 — prompt card
   ========================================================================= */
const TAGLINE = 'The AI collaborator for your best work';
const s8 = {};
const BLOBS = [
  { c: '#C9B9F2', x: 380, y: 300, r: 620, dx: 60, dy: -20, ph: 4.2 },
  { c: '#F4BCD8', x: 1520, y: 280, r: 520, dx: -40, dy: 20, ph: 5.1 },
  { c: '#E06BD8', x: 1060, y: 560, r: 820, dx: 90, dy: 30, ph: 2.1 },
  { c: '#F5A23A', x: 330, y: 1040, r: 860, dx: 70, dy: -30, ph: 0 },
  { c: '#E9474F', x: 1600, y: 1000, r: 880, dx: -80, dy: 25, ph: 1.3 },
  { c: '#EE6F67', x: 760, y: 820, r: 560, dx: -50, dy: 30, ph: 3.0 },
  { c: '#D865C9', x: 760, y: 560, r: 420, dx: 50, dy: -30, ph: 0.7 },
];
const PROMPT_LINES = [
  ['Build a landing page for my coffee brand, Ember & Oat. Warm,', 0],
  ['minimal and modern — a hero with our tagline, this week’s', 0],
  ['pours, and a clear order-online button. Make it responsive', 0],
  ['and accessible, and use our palette: espresso, oat and ember', 1],
  ['orange. Keep the copy short, friendly and inviting.', 2],
];
function initS8() {
  s8.ctx = $('grad').getContext('2d');
  const tag = $('tag');
  s8.letters = [...TAGLINE].map((ch, i) => {
    const sp = document.createElement('span');
    sp.textContent = ch === ' ' ? ' ' : ch;
    tag.appendChild(sp);
    return { el: sp, a: 24.95 + i * 0.024, w: measure(ch, '300 58px Inter') };
  });
  s8.prefix = [0];
  for (let i = 1; i <= TAGLINE.length; i++) s8.prefix.push(measure(TAGLINE.slice(0, i), '300 58px Inter'));
  const pt = $('ptext');
  s8.lines = PROMPT_LINES.map(([txt, tone]) => {
    const d = document.createElement('span');
    d.className = 'ln';
    d.textContent = txt;
    d.style.color = tone === 0 ? '#1E1D1B' : tone === 1 ? '#8E8A82' : '#BAB6AE';
    pt.appendChild(d);
    return d;
  });
  for (let i = 0; i < TAGLINE.length; i += 3) cue(24.95 + i * 0.024, 'type', { v: 0.35 });
  cue(24.55, 'pad', { v: 0.9, dur: 3.4 });
  cue(27.96, 'whoosh', { v: 0.7, dur: 0.35 });
  cue(28.22, 'flip', { v: 1 });
  cue(28.5, 'land', { v: 0.8 });
  cue(30.25, 'whoosh', { v: 0.7, dur: 0.5 });
}
function drawGradient(t, rise) {
  const ctx = s8.ctx, sx = 480 / W;
  ctx.fillStyle = '#ECE8E2';
  ctx.fillRect(0, 0, 480, 270);
  for (const b of BLOBS) {
    const x = (b.x + b.dx * Math.sin(t * 0.55 + b.ph)) * sx;
    const y = (b.y + b.dy * Math.cos(t * 0.45 + b.ph) + rise) * sx;
    const r = b.r * sx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = hex(b.c);
    g.addColorStop(0, rgba(c, 0.95)); g.addColorStop(0.45, rgba(c, 0.62)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 270);
  }
}
function updateS8(t) {
  const rise = lerp(620, 0, E.outCubic(seg(t, 24.15, 25.0)));
  drawGradient(t, rise);
  $('grad').style.width = px(W); $('grad').style.height = px(H);
  // tagline letters (centred, grows as it types)
  let visN = 0;
  const gone = seg(t, 27.88, 27.98);
  s8.letters.forEach((L) => {
    if (t < L.a) { L.el.style.display = 'none'; return; }
    visN++;
    L.el.style.display = 'inline-block';
    const k = seg(t, L.a, L.a + 0.3);
    L.el.style.color = rgba(mixc(hex('#FFC4DE'), WHITE, k));
    L.el.style.opacity = (seg(t, L.a, L.a + 0.1) * (1 - gone)).toFixed(3);
  });
  // handles: hug the visible text (each lags a little), then become the corners of the card strip
  const wAt = (tt) => s8.prefix[s8.letters.filter((L) => tt >= L.a).length];
  const cardP = seg(t, 27.95, 28.5);
  const strip = { x0: 960 - 410, x1: 960 + 410, y0: 540 - 42, y1: 540 + 42 };
  const handleOn = t >= 24.95 && t < 28.48;
  [0, 1, 2, 3].forEach((k) => {
    const el = $(`h8${k}`);
    if (!handleOn) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const w = Math.max(40, wAt(t - 0.035 * k));
    const left = k % 2 === 0, top = k < 2;
    let x = 960 + (left ? -w / 2 - 22 : w / 2 + 22);
    let y = 540 + (top ? -36 : 36);
    const m = E.inOutCubic(seg(t, 27.92, 28.12));
    const sx = left ? strip.x0 : strip.x1, sy = top ? strip.y0 : strip.y1;
    x = lerp(x, sx, m); y = lerp(y, sy, m);
    const pop = E.outBack(seg(t, 24.95 + k * 0.03, 25.1 + k * 0.03));
    el.style.transform = `translate(${px(x)}, ${px(y)}) scale(${(pop * (1 - seg(t, 28.36, 28.48))).toFixed(3)})`;
  });
  // prompt card: thin strip -> perspective tilt -> flat card
  const card = $('pcard');
  const on = t >= 27.98;
  $('pcardWrap').style.display = on ? 'block' : 'none';
  if (on) {
    const k1 = E.outCubic(seg(t, 27.98, 28.14));
    const k2 = E.inOutCubic(seg(t, 28.14, 28.52));
    const sy = lerp(0.0, 0.16, k1) + (1 - 0.16) * k2;
    const ry = Math.sin(Math.PI * k2) * -16;
    const rx = Math.sin(Math.PI * k2) * 14;
    const rz = Math.sin(Math.PI * k2) * -5;
    const sxx = lerp(1.08, 1, k2);
    card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sxx.toFixed(4)}, ${Math.max(0.001, sy).toFixed(4)})`;
    // during the strip phase only the image shows
    $('ptext').style.opacity = seg(t, 28.42, 28.56).toFixed(3);
    s8.lines.forEach((ln, i) => {
      const a = 28.5 + i * 0.05;
      ln.style.opacity = seg(t, a, a + 0.14).toFixed(3);
      ln.style.transform = `translateY(${px((1 - E.outCubic(seg(t, a, a + 0.2))) * 10)})`;
    });
    const bar = $('pbar');
    const bk = E.outCubic(seg(t, 28.56, 28.78));
    bar.style.top = px(-250 + 300 + 210 + 22 + (1 - bk) * 20);
    bar.style.opacity = bk.toFixed(3);
    // floating dots
    const fd = E.outBack(seg(t, 28.62, 28.8));
    $('fdot1').style.transform = `translate(${px(960 - 470 + 8 * Math.sin(t * 2.1))}, ${px(540 + 70 + 10 * Math.cos(t * 1.7))}) scale(${fd.toFixed(3)})`;
    $('fdot2').style.transform = `translate(${px(960 + 440 + 9 * Math.cos(t * 1.9))}, ${px(540 - 210 + 8 * Math.sin(t * 2.3))}) scale(${fd.toFixed(3)})`;
  }
  $('fdot1').style.display = on && t >= 28.6 ? 'block' : 'none';
  $('fdot2').style.display = on && t >= 28.6 ? 'block' : 'none';
  // exit to end card
  const ex = seg(t, 30.2, 30.6);
  $('s8').style.filter = ex > 0 ? `blur(${(ex * 30).toFixed(2)}px)` : 'none';
  const pw = $('pcardWrap');
  pw.style.transform = `scale(${(1 - 0.08 * E.inCubic(ex)).toFixed(4)})`;
}

/* =========================================================================
   S10 — end card
   ========================================================================= */
const s10 = {};
function initS10() {
  const w = $('endWord');
  s10.letters = [...'Claude'].map((ch) => { const s = document.createElement('span'); s.textContent = ch; w.appendChild(s); return s; });
  s10.wordW = measure('Claude', '400 180px Newsreader');
  cue(30.45, 'bloom', { v: 1 });
  cue(30.82, 'shimmer', { v: 0.7 });
  cue(31.4, 'tick', { v: 0.4 });
}
function updateS10(t) {
  $('s10').style.opacity = E.inOutCubic(seg(t, 30.2, 30.55)).toFixed(3);
  const g = E.outBack(seg(t, 30.45, 31.0));
  const rot = lerp(-75, 0, E.outCubic(seg(t, 30.45, 31.2))) + (t - 31.2) * 3;
  $('endSpark').innerHTML = sparkSVG(CLAUDE, { grow: Math.max(0.02, g), rot });
  $('endSpark').style.transform = `scale(${(0.4 + 0.6 * E.outCubic(seg(t, 30.45, 30.9))).toFixed(4)})`;
  // spark starts centred, then slides left as the word reveals
  const slide = E.inOutCubic(seg(t, 30.78, 31.25));
  const offset = (1 - slide) * (s10.wordW + 34) / 2;
  $('endSpark').style.translate = `${px(offset)} 0`;
  $('endWord').style.translate = `${px(offset)} 0`;
  s10.letters.forEach((sp, i) => {
    const a = 30.86 + i * 0.055;
    const k = E.outCubic(seg(t, a, a + 0.32));
    sp.style.opacity = k.toFixed(3);
    sp.style.transform = `translateY(${px((1 - k) * 26)})`;
    sp.style.filter = k < 1 ? `blur(${((1 - k) * 8).toFixed(2)}px)` : 'none';
  });
  const sk = E.outCubic(seg(t, 31.4, 31.8));
  $('endSub').style.opacity = sk.toFixed(3);
  $('endSub').style.transform = `translateY(${px((1 - sk) * 14)})`;
  const hold = 1 + 0.025 * E.inOutSine(seg(t, 31.0, 33.0));
  $('endLogo').style.transform = `scale(${hold.toFixed(4)})`;
}

/* =========================================================================
   Orchestration
   ========================================================================= */
const SCENES = [
  { id: 's1', a: 0, b: WIPE_B, z: 1, update: updateS1 },
  { id: 's2', a: 2.8, b: 6.0, z: 6, update: updateS2 },
  { id: 's3', a: 6.25, b: 10.0, z: 7, update: updateS3 },
  { id: 's4', a: 10.0, b: 14.28, z: 8, update: updateS4 },
  { id: 's5', a: 14.2, b: 16.72, z: 9, update: updateS5 },
  { id: 's6', a: 16.72, b: 18.0, z: 10, update: updateS6 },
  { id: 's8', a: 24.15, b: 30.6, z: 11, update: updateS8 },
  { id: 's7', a: 18.0, b: 24.9, z: 12, update: updateS7 },
  { id: 's10', a: 30.2, b: DURATION + 1, z: 13, update: updateS10 },
];
function renderFrame(t) {
  for (const s of SCENES) {
    const on = t >= s.a && t < s.b;
    if (on !== s.on) { s.el.style.display = on ? 'block' : 'none'; s.on = on; }
    if (on) s.update(t);
  }
  const wipeOn = t >= WIPE_A && t < WIPE_B;
  $('wipe').style.display = wipeOn ? 'block' : 'none';
  if (wipeOn) drawWipe(t);
}

async function init() {
  await document.fonts.load('400 64px Inter');
  await document.fonts.load('300 64px Inter');
  await document.fonts.load('500 64px Inter');
  await document.fonts.load('400 64px Newsreader');
  await document.fonts.ready;
  SCENES.forEach((s) => { s.el = $(s.id); s.el.style.zIndex = s.z; s.on = false; });
  wipeCtx = $('wipe').getContext('2d');
  initS1(); initS2(); initS4(); initS5(); initS7(); initS8(); initS10();
  await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
  initS6();
  await initS3();
  // global cues
  cue(0.0, 'intro', { v: 1, dur: 2.5 });
  cue(2.42, 'pixel', { v: 1, dur: 0.85 });
  cue(2.66, 'boom', { v: 0.85 });
  cue(6.0, 'breath', { v: 0.5 });
  cue(31.0, 'end', { v: 1, dur: 2.0 });
  CUES.sort((a, b) => a.t - b.t);
  renderFrame(0);
}

window.DURATION = DURATION;
window.renderFrame = renderFrame;
window.getCues = () => CUES;
window.ready = init().then(() => true);
