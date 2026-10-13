'use strict';
/* =============================================================================
   ONE TOKEN AT A TIME
   A 64-second motion graphics film about how a language model writes.

   Every frame is a pure function of time — renderFrame(t) — so the film can be
   rendered out of order, in parallel, and always identically. The sound cues
   come from the same timeline (getCues), so the synthesized score and sound
   design land exactly on the picture.
   ========================================================================== */

const W = 1920, H = 1080, FPS = 60, DURATION = 65;

const COL = {
  ink: '#0c0c0d',
  paper: '#eeebe5',
  mute: '#8b8b91',
  dim: '#55555b',
  faint: '#2a2a2e',
  accent: '#ff5a2c',
};
const DISPLAY = '"Inter Display"';
const MONO = '"JetBrains Mono"';

// Story beats (seconds). 120 BPM: one beat = 0.5 s, one bar = 2 s.
const M = {
  ch1: 6, ch2: 14, ch3: 26, ch4: 38, pick: 42, land: 43.0, gen: 44.5,
  corpus: 50, words: 54, words2: 55.5, end: 57, fade: 62.6, duration: DURATION,
};

/* ----------------------------------------------------------------------------
   Math, easing, randomness
---------------------------------------------------------------------------- */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
const smooth = (x) => x * x * (3 - 2 * x);
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);

function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 28; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

const ease = {
  linear: (x) => x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4,
  outQuint: (x) => 1 - (1 - x) ** 5,
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x) => { const s = 1.6, c = s + 1; return 1 + c * (x - 1) ** 3 + s * (x - 1) ** 2; },
  emph: cubicBezier(0.2, 0, 0, 1),        // fast out, long settle
  swift: cubicBezier(0.7, 0, 0.2, 1),     // decisive move
  anticip: cubicBezier(0.45, -0.3, 0.25, 1), // small pull-back first
};

// Damped spring step response (0 -> 1 with overshoot). dt = seconds since trigger.
function spring(dt, freq = 2.4, damp = 0.45) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * dt) * (Math.cos(wd * dt) + (damp * w / wd) * Math.sin(wd * dt));
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------------------------------------------------------
   Canvas helpers
---------------------------------------------------------------------------- */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const _rgb = {};
function rgba(hex, a = 1) {
  let c = _rgb[hex];
  if (!c) { const n = parseInt(hex.slice(1), 16); c = _rgb[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
}
function mixHex(h1, h2, t, a = 1) {
  const n1 = parseInt(h1.slice(1), 16), n2 = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((n1 >> 16) & 255, (n2 >> 16) & 255, t));
  const g = Math.round(lerp((n1 >> 8) & 255, (n2 >> 8) & 255, t));
  const b = Math.round(lerp(n1 & 255, n2 & 255, t));
  return `rgba(${r},${g},${b},${clamp(a)})`;
}
function setFont(weight, size, fam = DISPLAY, ls = 0) {
  ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = `${ls}px`;
}
const tw = (s) => ctx.measureText(s).width;

function fillText(str, x, y, color, align = 'left') {
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Rounded-rect outline that "draws on" (p: 0..1)
function strokeRoundRect(x, y, w, h, r, p, color, lw) {
  if (p <= 0 || w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  const per = 2 * (w + h) - (8 - 2 * Math.PI) * r;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  if (p < 1) ctx.setLineDash([per * p, per * 2]);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}
function fillRoundRect(x, y, w, h, r, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
function dot(x, y, r, color) {
  if (r <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function line(x1, y1, x2, y2, color, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
// The visible-space marker: tokens carry their leading space, so we show it.
function spaceMark(x, base, w, size, color) {
  const h = size * 0.13, lw = Math.max(1.5, size * 0.03);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, base - h);
  ctx.lineTo(x + w * 0.2, base);
  ctx.lineTo(x + w * 0.8, base);
  ctx.lineTo(x + w * 0.8, base - h);
  ctx.stroke();
  ctx.lineCap = 'butt';
}
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%+=/<>';
// Typewriter reveal with a short scrambled leading edge.
function scramble(str, p, t, seed = 1) {
  const n = str.length;
  const k = Math.floor(clamp(p) * n);
  if (k >= n) return str;
  let out = str.slice(0, k);
  for (let i = 0; i < Math.min(3, n - k); i++) {
    const ch = str[k + i];
    out += ch === ' ' ? ' ' : GLYPHS[Math.floor(hash(seed * 131 + (k + i) * 17 + Math.floor(t * 30) * 7) * GLYPHS.length)];
  }
  return out;
}
// Cursor blink: on for half a second, off for half, with soft edges.
function blink(t, t0) {
  const ph = fract((t - t0) / 1.0);
  return ph < 0.5 ? smooth(clamp(ph / 0.04)) * smooth(clamp((0.5 - ph) / 0.06)) : 0;
}

/* ----------------------------------------------------------------------------
   Content
---------------------------------------------------------------------------- */
const TOKENS = [
  { word: 'The', lead: false, id: '791' },
  { word: 'sky', lead: true, id: '13180' },
  { word: 'is', lead: true, id: '374' },
];
const PROMPT = 'The sky is';
// Human typing is uneven; the model's output later is metronomic.
const TYPE_GAPS = [0, 0.10, 0.17, 0.24, 0.12, 0.14, 0.11, 0.22, 0.13, 0.10];
const TYPE_T = [];
{ let t = 2.0; for (const g of TYPE_GAPS) { t += g; TYPE_T.push(+t.toFixed(3)); } }

const CAPTIONS = [
  { t0: 7.0, t1: 9.55, text: 'First, the text is cut into *tokens.*' },
  { t0: 10.0, t1: 13.5, text: 'To the model, every token is just a *number.*' },
  { t0: 15.75, t1: 19.45, text: 'Each number becomes a vector —|a point in a *space of meaning.*' },
  { t0: 20.0, t1: 23.7, text: 'Words with similar meanings land *close together.*' },
  { t0: 27.0, t1: 30.9, text: 'Each token looks back at the ones before it,|and weighs *what matters.*' },
  { t0: 31.4, t1: 35.6, text: 'Layer after layer, the meaning gets *sharper.*' },
  { t0: 38.75, t1: 41.75, text: 'Then it scores *every token* it knows…' },
  { t0: 42.0, t1: 43.75, text: '…and *picks one.*' },
  { t0: 44.0, t1: 49.5, text: 'Then it does it all again — and *again.*' },
  { t0: 50.75, t1: 53.4, text: 'It learned all this by reading *trillions of words*|— written by people.' },
];

const CHAPTERS = [
  { n: '01', name: 'Tokens', fig: 'FIG. 1 — TOKENIZATION', t0: M.ch1, t1: M.ch2 },
  { n: '02', name: 'Embeddings', fig: 'FIG. 2 — EMBEDDING SPACE, 2D PROJECTION', t0: M.ch2, t1: M.ch3 },
  { n: '03', name: 'Attention', fig: 'FIG. 3 — CAUSAL SELF-ATTENTION', t0: M.ch3, t1: M.ch4 },
  { n: '04', name: 'Prediction', fig: 'FIG. 4 — NEXT-TOKEN DISTRIBUTION', t0: M.ch4, t1: M.corpus },
];

// Next-token distribution for "The sky is"
const DIST = [
  { w: 'blue', p: 0.62 }, { w: 'clear', p: 0.11 }, { w: 'grey', p: 0.07 }, { w: 'falling', p: 0.04 },
  { w: 'so', p: 0.03 }, { w: 'the', p: 0.02 }, { w: 'a', p: 0.02 },
];
// What the model writes after "The sky is"
const GEN = [' blue', ' because', ' air', ' scatters', ' blue', ' light', ' more', ' than', ' red', '.'];
const GEN_GAPS = [0.5, 0.5, 0.375, 0.375, 0.25, 0.25, 0.25, 0.25, 0.25]; // on the 16th-note grid
const GEN_T = [M.land];
{ let t = M.gen; for (let i = 0; i < GEN_GAPS.length; i++) { GEN_T.push(+t.toFixed(3)); t += GEN_GAPS[i]; } }

const CORPUS = [
  'Add the flour slowly and stir until smooth.', 'The meeting has moved to Thursday at 3 pm.',
  'In 1969, two people walked on the Moon.', 'def mean(xs): return sum(xs) / len(xs)',
  'She opened the letter and read it twice.', 'Water boils at 100 °C at sea level.',
  'Turn left at the bakery, then walk two blocks.', 'Je pense, donc je suis.',
  'The court ruled in favour of the defendant.', 'Photosynthesis turns light into chemical energy.',
  'Happy birthday! Hope this year is your best yet.', 'for (let i = 0; i < n; i++) total += a[i];',
  'The river froze early that winter.', 'Shares closed 2.4% higher on Friday.',
  'To be, or not to be, that is the question.', 'Mix two parts sand with one part cement.',
  'Our train is delayed by about twenty minutes.', 'Light travels about 300,000 km every second.',
  'He scored in the final minute of the match.', 'Please restart the router and try again.',
  'El cielo está despejado esta mañana.', 'Dear team, thank you for all your hard work.',
  'It was the best of times, it was the worst of times.', 'SELECT name FROM users WHERE active = 1;',
  'A minor chord sounds sadder than a major one.', 'Store in a cool, dry place away from sunlight.',
  'Rain is expected across the north by evening.', 'Clouds form when warm, moist air rises and cools.',
  'The museum is closed on Mondays.', 'Plant the bulbs in autumn, about 10 cm deep.',
  'We hold these truths to be self-evident.', 'The patient responded well to treatment.',
  'Der Himmel ist heute grau.', 'Wash your hands before you eat.', 'Once upon a time, in a quiet village,',
  'The derivative of x² is 2x.', 'Thanks — I’ll call you back in five.', 'Breaking: storm warning for the coast.',
];

/* ----------------------------------------------------------------------------
   Layout (computed once fonts are loaded)
---------------------------------------------------------------------------- */
const LAY = {};

// Text width at a reference size; scale linearly for any size.
function wordWidth(word, weight = 600, fam = DISPLAY) {
  setFont(weight, 100, fam);
  return tw(word) / 100;
}

function chipRow(size, gap, base, centerX = W / 2) {
  setFont(600, 100);
  const space = tw(' ') / 100;
  const padX = 0.3 * size;
  const cells = TOKENS.map((tok) => {
    const wordW = wordWidth(tok.word) * size;
    const markW = tok.lead ? 0.42 * size : 0;
    return { wordW, markW, w: 2 * padX + markW + wordW };
  });
  const total = cells.reduce((s, c) => s + c.w, 0) + gap * (cells.length - 1);
  let x = centerX - total / 2;
  return cells.map((c) => {
    const r = {
      left: x, w: c.w, cx: x + c.w / 2, size, base,
      top: base - 0.98 * size, h: 1.32 * size, cy: base - 0.98 * size + 0.66 * size,
      markX: x + padX, markW: c.markW, wordX: x + padX + c.markW, wordW: c.wordW, space: space * size,
    };
    x += c.w + gap;
    return r;
  });
}

function initLayout() {
  // Cold-open sentence, centred including the cursor.
  const S0 = 132;
  setFont(600, 100);
  const space0 = (tw(' ') / 100) * S0;
  const widths = TOKENS.map((t) => wordWidth(t.word) * S0);
  let total = 0;
  TOKENS.forEach((t, i) => { total += (t.lead ? space0 : 0) + widths[i]; });
  const x0 = W / 2 - (total + 14 + 10) / 2;
  let x = x0;
  LAY.sent = TOKENS.map((t, i) => {
    const s = { start: x, markW: t.lead ? space0 : 0, size: S0, base: 572 };
    s.wordX = x + s.markW;
    s.wordW = widths[i];
    x += s.markW + widths[i];
    return s;
  });
  LAY.sentEnd = x;
  // char index -> token mapping for typing
  LAY.charTok = [];
  let ci = 0;
  TOKENS.forEach((t, i) => {
    const txt = (t.lead ? ' ' : '') + t.word;
    for (let k = 0; k < txt.length; k++) LAY.charTok[ci++] = { tok: i, k: t.lead ? k - 1 : k };
  });

  // Chapter 1 chip row and its ID numbers.
  LAY.row1 = chipRow(112, 84, 572);
  setFont(500, 100, MONO);
  LAY.numW = TOKENS.map((t) => (tw(t.id) / 100));

  // Chapter 3 chip row.
  LAY.row3 = chipRow(96, 96, 0, 0); // local coords: centred on (0,0) baseline 0
  for (const c of LAY.row3) { c.base = 0.34 * 96; c.top = c.base - 0.98 * 96; c.cy = c.top + 0.66 * 96; }
  LAY.row3Center = { x: W / 2, y: 668 };

  // Embedding map.
  initMap();
  // Prediction chart + generated paragraph.
  initParagraph();
  initCorpus();
}

/* ----------------------------------------------------------------------------
   Embedding map data
---------------------------------------------------------------------------- */
const CLUSTERS = [
  { label: 'ARTICLES', x: 420, y: 395, r: 118, words: ['a', 'an', 'this', 'that', 'my', 'every'], token: 0 },
  { label: 'NUMBERS', x: 800, y: 330, r: 96, words: ['one', 'two', 'seven', 'ten', 'three'] },
  { label: 'SKY & WEATHER', x: 1170, y: 385, r: 132, words: ['cloud', 'sun', 'moon', 'rain', 'storm', 'star', 'wind'], token: 1 },
  { label: 'COLOURS', x: 1530, y: 520, r: 120, words: ['blue', 'grey', 'red', 'green', 'gold', 'white'] },
  { label: 'VERBS', x: 560, y: 715, r: 122, words: ['was', 'are', 'be', 'seems', 'became', 'looks'], token: 2 },
  { label: 'ANIMALS', x: 1010, y: 720, r: 108, words: ['cat', 'dog', 'bird', 'horse', 'owl'] },
  { label: 'FOOD', x: 1420, y: 790, r: 92, words: ['bread', 'apple', 'rice', 'soup'] },
];
const STRAYS = ['idea', 'river', 'paper', 'music', 'city', 'run', 'quiet', 'glass', 'law', 'code', 'winter',
  'happy', 'stone', 'over', 'why', 'king', 'data', 'ocean', 'slow', 'garden', 'iron', 'story', 'north',
  'sing', 'map', 'salt', 'echo', 'door', 'chair', 'ship'];

function initMap() {
  const R = rng(7);
  const pts = [];
  const tokenPos = [null, null, null];
  const far = (x, y, d) => pts.every((p) => (p.x - x) ** 2 + ((p.y - y) * 1.6) ** 2 > d * d);
  for (const c of CLUSTERS) {
    if (c.token !== undefined) {
      const p = { x: c.x + 6, y: c.y + 4, word: TOKENS[c.token].word, token: c.token, cl: c };
      tokenPos[c.token] = p;
      pts.push(p);
    }
    for (const w of c.words) {
      let x, y, tries = 0;
      if (w === 'blue') { x = c.x - 92; y = c.y - 58; }
      else {
        do {
          const a = R() * Math.PI * 2, r = Math.sqrt(R()) * c.r * 0.82;
          x = c.x + Math.cos(a) * r * 1.15; y = c.y + Math.sin(a) * r * 0.75;
          tries++;
        } while (!far(x, y, 64) && tries < 200);
      }
      pts.push({ x, y, word: w, cl: c });
    }
  }
  for (const w of STRAYS) {
    let x, y, tries = 0;
    do {
      x = 160 + R() * 1600; y = 250 + R() * 620; tries++;
    } while ((!far(x, y, 110) || CLUSTERS.some((c) => Math.hypot(x - c.x, (y - c.y) * 1.3) < c.r + 40)) && tries < 400);
    pts.push({ x, y, word: w, stray: true });
  }
  const centroid = tokenPos.reduce((a, p) => ({ x: a.x + p.x / 3, y: a.y + p.y / 3 }), { x: 0, y: 0 });
  // Reveal order: a wave spreading out from where the three tokens land.
  pts.forEach((p) => { p.d = Math.hypot(p.x - centroid.x, p.y - centroid.y) + R() * 90; });
  const others = pts.filter((p) => p.token === undefined).sort((a, b) => a.d - b.d);
  others.forEach((p, i) => { p.appear = 18.05 + (i / others.length) * 1.75; });
  LAY.map = { pts, others, tokenPos, centroid, blue: pts.find((p) => p.word === 'blue') };
}

function mapCam(t) {
  const c = LAY.map.centroid, b = LAY.map.blue, s = LAY.map.tokenPos[1];
  const focus = { x: (b.x + s.x) / 2 + 40, y: (b.y + s.y) / 2 + 40 };
  const a = ease.inOutCubic(prog(t, 17.55, 19.7));
  let x = lerp(c.x, W / 2, a), y = lerp(c.y, H / 2, a), z = lerp(1.6, 1.0, a);
  const b2 = ease.inOutCubic(prog(t, 20.3, 23.9));
  x = lerp(x, focus.x, b2 * 0.85); y = lerp(y, focus.y, b2 * 0.85); z = lerp(z, 1.26, b2);
  const b3 = ease.inCubic(prog(t, 23.9, 25.0));
  z *= 1 + 0.12 * b3;
  return { x, y, z };
}
const camApply = (cam, p) => ({ x: (p.x - cam.x) * cam.z + W / 2, y: (p.y - cam.y) * cam.z + H / 2 });

/* ----------------------------------------------------------------------------
   Paragraph (generation) + chart layout
---------------------------------------------------------------------------- */
function initParagraph() {
  const S = 84;
  setFont(600, S);
  const pieces = [];
  // Prompt tokens (human) followed by generated tokens (model).
  const prompt = ['The', ' sky', ' is'];
  prompt.forEach((p) => pieces.push({ text: p, gen: false }));
  GEN.forEach((g, i) => pieces.push({ text: g, gen: true, t: GEN_T[i] }));
  const maxW = 1460, lh = 106;
  let x = 0, ln = 0;
  for (const p of pieces) {
    const w = tw(p.text);
    const lead = p.text.startsWith(' ');
    if (x + w > maxW && x > 0) { ln++; x = 0; }
    const drawText = x === 0 && lead ? p.text.slice(1) : p.text;
    p.x = x; p.ln = ln; p.w = tw(drawText); p.draw = drawText;
    x += tw(drawText);
  }
  const lines = ln + 1;
  LAY.para = { pieces, S, lh, lines, left: (W - maxW) / 2 + 10, maxW };
}

function initCorpus() {
  const R = rng(42);
  const S = 84;
  setFont(500, S);
  const blocks = [];
  const colW = 1840, rowH = 520;
  for (let gy = -22; gy <= 22; gy++) {
    for (let gx = -13; gx <= 13; gx++) {
      if (gx === 0 && gy === 0) continue;
      const n = 2 + Math.floor(R() * 3);
      const lines = [];
      for (let i = 0; i < n; i++) {
        const s = CORPUS[Math.floor(R() * CORPUS.length)];
        lines.push({ s, w: tw(s), hi: R() < 0.04 });
      }
      blocks.push({ gx, gy, x: gx * colW + (R() - 0.5) * 120, y: gy * rowH + (R() - 0.5) * 60, lines });
    }
  }
  LAY.corpus = { blocks, S, colW, rowH };
}

/* ----------------------------------------------------------------------------
   Background, chrome, captions
---------------------------------------------------------------------------- */
function drawBackground(t, grid = null) {
  ctx.fillStyle = COL.ink;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, W * 0.7);
  g.addColorStop(0, 'rgba(255,250,240,0.035)');
  g.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (grid && grid.a > 0.002) {
    const step = 48 * grid.z;
    if (step > 6) {
      const ox = ((grid.ox % step) + step) % step, oy = ((grid.oy % step) + step) % step;
      ctx.fillStyle = rgba(COL.paper, 0.075 * grid.a);
      const r = Math.max(0.8, Math.min(1.6, grid.z * 1.3));
      for (let y = oy; y < H; y += step) for (let x = ox; x < W; x += step) ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
}

function gridState(t) {
  const on = smooth(prog(t, 6.0, 7.0)) * (1 - smooth(prog(t, 50.0, 51.2)));
  let ox = 0, oy = 0, z = 1;
  if (t >= 17.0 && t < 26.0) {
    const cam = mapCam(t);
    z = cam.z; ox = -cam.x * cam.z + W / 2; oy = -cam.y * cam.z + H / 2;
  }
  return { a: on, ox, oy, z };
}

function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Scrims keep captions and chrome legible over busy scenes.
function drawScrims(a) {
  if (a <= 0) return;
  let g = ctx.createLinearGradient(0, 820, 0, H);
  g.addColorStop(0, 'rgba(12,12,13,0)');
  g.addColorStop(0.55, rgba(COL.ink, 0.82 * a));
  g.addColorStop(1, rgba(COL.ink, 0.92 * a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 820, W, H - 820);
  g = ctx.createLinearGradient(0, 0, 0, 250);
  g.addColorStop(0, rgba(COL.ink, 0.9 * a));
  g.addColorStop(0.7, rgba(COL.ink, 0.6 * a));
  g.addColorStop(1, 'rgba(12,12,13,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 250);
}

function contextCount(t) {
  let n = 3;
  for (let i = 0; i < GEN_T.length; i++) if (t >= GEN_T[i]) n = 4 + i;
  return n;
}

function drawChrome(t) {
  const on = prog(t, 6.0, 6.9);
  const off = 1 - ease.inCubic(prog(t, 53.2, 53.9));
  if (on <= 0 || off <= 0) return;
  const a = smooth(on) * off;
  ctx.save();
  // Crop marks
  const m = 40, L = 24 * ease.emph(on);
  ctx.strokeStyle = rgba(COL.paper, 0.32 * off);
  ctx.lineWidth = 1.5;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  }
  // Top-left: film title
  setFont(500, 15, MONO, 3);
  fillText(scramble('HOW A LANGUAGE MODEL WRITES', prog(t, 6.05, 6.75), t, 3), 96, 76, rgba(COL.mute, a));
  // Top-right: chapter progress
  const chIdx = CHAPTERS.findIndex((c) => t >= c.t0 && t < c.t1);
  const segW = 34, segG = 8, right = W - 96;
  const x0 = right - (segW * 4 + segG * 3);
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * (segW + segG);
    ctx.fillStyle = rgba(COL.paper, 0.18 * a);
    ctx.fillRect(x, 66, segW, 3);
    const c = CHAPTERS[i];
    const fill = t >= c.t1 ? 1 : ease.emph(prog(t, c.t0, c.t0 + 0.7));
    if (fill > 0) {
      ctx.fillStyle = rgba(i === chIdx ? COL.accent : COL.paper, (i === chIdx ? 1 : 0.55) * a);
      ctx.fillRect(x, 66, segW * fill, 3);
    }
  }
  setFont(500, 15, MONO, 3);
  const chTxt = chIdx >= 0 ? `${CHAPTERS[chIdx].n} / 04` : '04 / 04';
  fillText(chTxt, x0 - 22, 76, rgba(COL.mute, a), 'right');
  // Bottom-left: context window counter
  setFont(500, 15, MONO, 3);
  fillText('CONTEXT', 96, 1030, rgba(COL.mute, a));
  const n = contextCount(t);
  const flash = GEN_T.reduce((f, gt) => Math.max(f, 1 - prog(t, gt, gt + 0.5)) * (t >= gt ? 1 : 0) || f, 0);
  setFont(500, 15, MONO, 3);
  const cw = tw('CONTEXT  ');
  fillText(`${String(n).padStart(3, '0')} TOKENS`, 96 + cw, 1030, mixHex(COL.paper, COL.accent, flash, a));
  // Bottom-right: figure label
  let fig = '';
  if (chIdx >= 0) fig = CHAPTERS[chIdx].fig;
  else if (t >= M.corpus) fig = 'FIG. 5 — TRAINING TEXT';
  const figStart = chIdx >= 0 ? CHAPTERS[chIdx].t0 : M.corpus;
  fillText(scramble(fig, prog(t, figStart + 0.05, figStart + 0.75), t, 9), W - 96, 1030, rgba(COL.mute, a), 'right');
  ctx.restore();
}

// Chapter title, top-left: number in accent, name in display type, masked slide.
function drawChapterTitle(t) {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const c = CHAPTERS[i];
    const tin = c.t0 + 0.1, tout = c.t1 - 0.32;
    if (t < tin || t > tout + 0.4) continue;
    const pin = ease.emph(prog(t, tin, tin + 0.8));
    const pout = ease.inCubic(prog(t, tout, tout + 0.3));
    const x = 96;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, 116, 900, 110);
    ctx.clip();
    const dy = (1 - pin) * 70 - pout * 70;
    setFont(500, 17, MONO, 3);
    fillText(c.n, x, 146 + dy * 0.6, rgba(COL.accent, pin * (1 - pout)));
    const nw = tw(c.n + '  ');
    ctx.fillStyle = rgba(COL.accent, pin * (1 - pout));
    ctx.fillRect(x + nw, 140 + dy * 0.6, 26 * pin, 2);
    setFont(600, 48, DISPLAY, -0.5);
    fillText(c.name, x, 206 + dy, rgba(COL.paper, 1 - pout));
    ctx.restore();
  }
}

const _capCache = new Map();
function layoutCaption(c) {
  if (_capCache.has(c)) return _capCache.get(c);
  setFont(500, 46, DISPLAY, -0.3);
  const words = c.text.replace(/\|/g, ' | ').split(/ +/).map((raw) => ({ raw, text: raw.replace(/\*/g, '') }));
  let acc = false;
  for (const w of words) {
    const starts = w.raw.startsWith('*'), ends = w.raw.endsWith('*');
    if (starts) acc = true;
    w.accent = acc;
    if (ends) acc = false;
  }
  const maxW = 1240, spaceW = tw(' ');
  const lines = [[]];
  let x = 0;
  for (const w of words) {
    if (w.raw === '|') { lines.push([]); x = 0; continue; }
    w.w = tw(w.text);
    if (x + w.w > maxW && x > 0) { lines.push([]); x = 0; }
    w.x = x; w.line = lines.length - 1;
    lines[lines.length - 1].push(w);
    x += w.w + spaceW;
  }
  const out = { words: words.filter((w) => w.raw !== '|'), nLines: lines.length };
  _capCache.set(c, out);
  return out;
}

function drawCaptions(t) {
  for (const c of CAPTIONS) {
    if (t < c.t0 || t > c.t1 + 0.7) continue;
    const L = layoutCaption(c);
    const lh = 60, baseLast = 968, x0 = 96;
    setFont(500, 46, DISPLAY, -0.3);
    ctx.textAlign = 'left';
    for (let i = 0; i < L.words.length; i++) {
      const w = L.words[i];
      const y = baseLast - (L.nLines - 1 - w.line) * lh;
      const pin = ease.emph(prog(t, c.t0 + i * 0.035, c.t0 + i * 0.035 + 0.75));
      const pout = ease.inCubic(prog(t, c.t1 + i * 0.015, c.t1 + i * 0.015 + 0.38));
      if (pin <= 0 || pout >= 1) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - 10, y - lh * 0.86, 1400, lh * 1.12);
      ctx.clip();
      const dy = (1 - pin) * lh * 0.95 - pout * lh * 0.95;
      ctx.fillStyle = rgba(w.accent ? COL.accent : COL.paper, Math.min(1, pin * 1.4));
      ctx.fillText(w.text, x0 + w.x, y + dy);
      ctx.restore();
    }
  }
}

/* ----------------------------------------------------------------------------
   Scene: cold open + chapter 1 (tokens) + start of chapter 2 (vectors)
---------------------------------------------------------------------------- */
const VEC_ROWS = 14;
function vecValue(tok, j) { return Math.sin(tok * 7.13 + j * 2.71) * 0.6 + (hash(tok * 97 + j * 13) - 0.5) * 0.8; }

function drawTokens(t) {
  if (t >= 18.9) return;
  const sent = LAY.sent, row = LAY.row1;

  // typed characters
  let typed = 0;
  for (let i = 0; i < TYPE_T.length; i++) if (t >= TYPE_T[i]) typed = i + 1;

  const split = ease.emph(prog(t, 6.15, 7.05));
  const morph = ease.inOutCubic(prog(t, 10.35, 11.35));
  const up = ease.emph(prog(t, 14.0, 14.75));          // chips rise for the vector columns
  const collapse = ease.inOutCubic(prog(t, 17.0, 17.6));
  const gone = t >= 17.6;

  for (let i = 0; i < TOKENS.length; i++) {
    const tok = TOKENS[i], s = sent[i], r = row[i];
    const st = Math.max(0, i * 0.05);
    const sp = ease.emph(prog(t, 6.15 + st, 7.05 + st));
    const size = lerp(s.size, r.size, sp);
    const wordX = lerp(s.wordX, r.wordX, sp);
    const base = lerp(s.base, r.base, sp);
    const markW = lerp(s.markW, r.markW, sp);
    const chipLeft = wordX - markW - 0.3 * size;
    const chipW = r.wordW / r.size * size + markW + 0.6 * size;
    const chipTop = base - 0.98 * size, chipH = 1.32 * size;
    const chipCx = chipLeft + chipW / 2, chipCy = chipTop + chipH / 2;

    // ---- word text (fades/moves into a small label during the morph)
    let chars = tok.word.length;
    if (t < 6) {
      chars = 0;
      for (let c = 0; c < typed; c++) if (LAY.charTok[c].tok === i && LAY.charTok[c].k >= 0) chars = LAY.charTok[c].k + 1;
    }
    if (chars > 0 && morph < 1) {
      const wa = 1 - smooth(clamp(morph * 1.6));
      setFont(600, size, DISPLAY);
      ctx.save();
      const lift = morph * 70;
      ctx.globalAlpha = wa;
      fillText(tok.word.slice(0, chars), wordX, base - lift, COL.paper);
      ctx.restore();
    }
    // ---- space marker
    if (tok.lead) {
      const ma = smooth(prog(t, 6.6 + i * 0.1, 7.1 + i * 0.1)) * (1 - smooth(clamp(morph * 1.6)));
      if (ma > 0) spaceMark(wordX - markW + 0.08 * size, base, markW * 0.84, size, rgba(COL.mute, ma));
    }

    // ---- chip outline: word chip -> number chip -> rises -> collapses into a dot
    const pOutline = ease.outCubic(prog(t, 6.55 + i * 0.12, 7.05 + i * 0.12));
    const numSize = 64;
    const nW = LAY.numW[i] * numSize + 64, nH = numSize * 1.5;
    const cyMorph = lerp(chipCy, r.cy, 1);
    let cx = chipCx, cy = chipCy, w = chipW, h = chipH;
    if (morph > 0) { w = lerp(chipW, nW, morph); h = lerp(chipH, nH, morph); cy = lerp(chipCy, cyMorph, morph); }
    const upY = lerp(r.cy, 318, up);
    if (up > 0) cy = upY;
    // collapse: chip shrinks into the vector's centre point
    const colY = 560;
    if (collapse > 0) {
      w = lerp(w, 18, collapse); h = lerp(h, 18, collapse); cy = lerp(cy, colY, collapse);
    }
    if (!gone) {
      const rad = lerp(lerp(14, 12, morph), 9, collapse);
      if (collapse > 0) fillRoundRect(cx - w / 2, cy - h / 2, w, h, rad, rgba(COL.accent, collapse));
      strokeRoundRect(cx - w / 2, cy - h / 2, w, h, rad, pOutline, mixHex(COL.paper, COL.accent, collapse, lerp(0.85, 0.7, morph)), 2);
      // pop flash when the outline closes
      const fl = 1 - prog(t, 7.05 + i * 0.12, 7.6 + i * 0.12);
      if (fl < 1 && fl > 0 && morph === 0) fillRoundRect(cx - w / 2, cy - h / 2, w, h, rad, rgba(COL.paper, 0.08 * fl));
    }

    // ---- ID number: rolls in under the chip, then moves inside it
    const idIn = prog(t, 8.0 + i * 0.18, 8.35 + i * 0.18);
    if (idIn > 0 && !gone) {
      const below = r.top + r.h + 86;
      let idSize = lerp(44, numSize, morph);
      const idY0 = below, idY1 = cyMorph + 0.36 * numSize;
      let idY = lerp(idY0, idY1, morph) + (1 - ease.emph(idIn)) * 24;
      if (up > 0) idY = upY + 0.36 * numSize;
      if (collapse > 0) { idSize *= lerp(1, 0.25, collapse); idY = cy + 0.36 * idSize; }
      let str = '';
      for (let d = 0; d < tok.id.length; d++) {
        const lock = 8.35 + i * 0.18 + d * 0.07 + 0.32;
        str += t >= lock ? tok.id[d] : String(Math.floor(hash(i * 31 + d * 7 + Math.floor(t * 28)) * 10));
      }
      setFont(500, idSize, MONO);
      const ida = smooth(idIn) * (1 - smooth(clamp(collapse * 1.6)));
      fillText(str, cx, idY, rgba(COL.accent, ida), 'center');
      // connector
      if (morph < 1) {
        const ca = smooth(idIn) * (1 - morph);
        const yTop = r.top + r.h + 10;
        line(cx, yTop, cx, yTop + 24 * ease.emph(idIn), rgba(COL.paper, 0.35 * ca), 1.5);
      }
    }

    // ---- small word label above the number chip
    const la = smooth(prog(t, 10.75, 11.35)) * (1 - smooth(clamp(collapse * 2)));
    if (la > 0) {
      setFont(400, 22, MONO, 1);
      const ly = (up > 0 ? cy : cyMorph) - h / 2 - 20;
      fillText((tok.lead ? '␣' : '') + tok.word, cx, ly + (1 - la) * 12, rgba(COL.mute, la), 'center');
    }

    // ---- vector column (chapter 2)
    if (t >= 14.2 && !gone) drawVector(t, i, cx, upY, collapse);
  }

  // Vocabulary annotation during the hold
  const va = smooth(prog(t, 11.7, 12.3)) * (1 - smooth(prog(t, 13.8, 14.2)));
  if (va > 0) {
    setFont(500, 16, MONO, 2.5);
    const y = LAY.row1[0].cy + 112;
    fillText('EACH ID INDEXES A VOCABULARY OF ~100,000 TOKENS', W / 2, y + (1 - va) * 10, rgba(COL.mute, va), 'center');
  }

  // Cursor
  let ca = 0;
  if (t >= 0.6 && t < 2.0) ca = blink(t, 0.6);
  else if (t >= 2.0 && t < 4.0) ca = 1;
  else if (t >= 4.0 && t < 6.0) ca = blink(t, 4.5);
  ca *= 1 - smooth(prog(t, 5.9, 6.2));
  if (ca > 0) {
    let cxp = sent[0].start;
    if (typed > 0) {
      const ct = LAY.charTok[typed - 1];
      const s = sent[ct.tok];
      setFont(600, s.size);
      cxp = ct.k < 0 ? s.start + s.markW : s.wordX + tw(TOKENS[ct.tok].word.slice(0, ct.k + 1));
    }
    fillRoundRect(cxp + 12, sent[0].base - 104, 10, 132, 1.5, rgba(COL.accent, ca));
  }

  // "PROMPT" label & the hook question
  const pa = smooth(prog(t, 0.9, 1.4)) * (1 - smooth(prog(t, 5.9, 6.3)));
  if (pa > 0) {
    setFont(500, 15, MONO, 3);
    const x = sent[0].start, y = sent[0].base - 178;
    ctx.fillStyle = rgba(COL.accent, pa);
    ctx.fillRect(x, y - 11, 8, 8);
    fillText(scramble('PROMPT', prog(t, 0.9, 1.5), t, 5), x + 20, y - 1, rgba(COL.mute, pa));
  }
  if (t >= 4.0 && t < 6.4) {
    const q = 'What comes next?'.split(' ');
    setFont(500, 46, DISPLAY, -0.3);
    const full = tw('What comes next?');
    let x = W / 2 - full / 2;
    for (let k = 0; k < q.length; k++) {
      const pin = ease.emph(prog(t, 4.0 + k * 0.12, 4.75 + k * 0.12));
      const pout = ease.inCubic(prog(t, 5.65 + k * 0.04, 6.0 + k * 0.04));
      const y = 742;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 6, y - 52, tw(q[k]) + 12, 70);
      ctx.clip();
      fillText(q[k], x, y + (1 - pin) * 58 - pout * 58, rgba(k === 2 ? COL.accent : COL.mute, pin));
      ctx.restore();
      x += tw(q[k] + ' ');
    }
  }
}

function drawVector(t, i, cx, chipY, collapse) {
  const top = chipY + 86;
  const pitch = 26;
  for (let j = 0; j < VEC_ROWS; j++) {
    const t0 = 14.45 + j * 0.045 + i * 0.07;
    const p = ease.emph(prog(t, t0, t0 + 0.5));
    if (p <= 0) continue;
    const v = vecValue(i, j);
    let y = top + j * pitch;
    const yc = lerp(y, 560, collapse);
    const a = p * (1 - collapse);
    // value text
    setFont(400, 15, MONO);
    const s = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
    fillText(s, cx - 34, yc + 5 + (1 - p) * 8, rgba(COL.mute, a), 'right');
    // bar from the zero line
    const bx = cx + 26, bw = v * 78 * p * (1 - collapse);
    ctx.fillStyle = rgba(Math.abs(v) > 0.62 ? COL.accent : COL.paper, (Math.abs(v) > 0.62 ? 0.95 : 0.7) * Math.max(a, collapse > 0 ? 0.6 * (1 - collapse) : 0));
    ctx.fillRect(Math.min(bx, bx + bw), yc - 5, Math.abs(bw), 10);
  }
  // zero line + ellipsis + dims label
  const la = ease.emph(prog(t, 14.5 + i * 0.07, 15.1 + i * 0.07)) * (1 - collapse);
  if (la > 0) {
    line(cx + 26, top - 14, cx + 26, top - 14 + (VEC_ROWS * pitch + 4) * la, rgba(COL.paper, 0.25 * la), 1);
    const ea = smooth(prog(t, 15.2 + i * 0.07, 15.6 + i * 0.07)) * (1 - collapse);
    setFont(500, 22, MONO);
    fillText('⋮', cx + 26, top + VEC_ROWS * pitch + 14, rgba(COL.mute, ea), 'center');
    setFont(500, 14, MONO, 2);
    fillText('4,096 VALUES', cx, top + VEC_ROWS * pitch + 52, rgba(COL.mute, ea), 'center');
  }
}

/* ----------------------------------------------------------------------------
   Scene: chapter 2 — the embedding map
---------------------------------------------------------------------------- */
function drawMap(t) {
  if (t < 17.0 || t >= 25.2) return;
  const cam = mapCam(t);
  const P = (p) => camApply(cam, p);
  const fadeAll = 1 - smooth(prog(t, 24.0, 24.6));
  const map = LAY.map;

  // reference crosses
  if (fadeAll > 0) {
    const ga = smooth(prog(t, 17.9, 18.8)) * fadeAll;
    ctx.strokeStyle = rgba(COL.paper, 0.12 * ga);
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 240) for (let gy = 60; gy <= H; gy += 240) {
      const s = P({ x: gx, y: gy });
      ctx.beginPath();
      ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y);
      ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6);
      ctx.stroke();
    }
    // cluster rings + labels
    const focusDim = 1 - 0.6 * smooth(prog(t, 20.6, 21.6));
    const dimFor = (c) => (c && (c.label === 'SKY & WEATHER' || c.label === 'COLOURS') ? 1 : focusDim);
    CLUSTERS.forEach((c, k) => {
      const ca = smooth(prog(t, 18.4 + k * 0.1, 19.2 + k * 0.1)) * fadeAll * dimFor(c);
      if (ca <= 0) return;
      const s = P(c);
      const rr = c.r * cam.z * lerp(0.85, 1, ease.emph(ca));
      ctx.save();
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = rgba(COL.paper, 0.22 * ca);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rr * 1.18, rr * 0.82, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease.emph(ca));
      ctx.stroke();
      ctx.restore();
      setFont(500, 13, MONO, 2.5);
      fillText(c.label, s.x - rr * 0.95, s.y - rr * 0.82 - 10, rgba(COL.mute, ca), 'left');
    });
    // other words
    for (const p of map.others) {
      const a = prog(t, p.appear, p.appear + 0.35);
      if (a <= 0) continue;
      const s = P(p);
      const sc = ease.outBack(a);
      const alpha = (p.stray ? 0.45 : 0.85) * fadeAll * dimFor(p.cl);
      dot(s.x, s.y, 3.6 * sc * Math.sqrt(cam.z), rgba(COL.paper, alpha * Math.min(1, a * 2)));
      setFont(500, 19 * Math.sqrt(cam.z), DISPLAY);
      const ta = smooth(prog(t, p.appear + 0.08, p.appear + 0.4)) * alpha;
      const isBlue = p === map.blue;
      fillText(p.word, s.x + 10, s.y + 6, rgba(isBlue ? COL.paper : COL.mute, ta), 'left');
    }
    // measurement: "sky" to "blue"
    const ma = ease.inOutCubic(prog(t, 21.6, 22.35)) * fadeAll;
    if (ma > 0) {
      const a = P(map.tokenPos[1]), b = P(map.blue);
      ctx.save();
      ctx.setLineDash([6, 6]);
      line(a.x, a.y, lerp(a.x, b.x, ma), lerp(a.y, b.y, ma), rgba(COL.accent, 0.85 * fadeAll), 1.6);
      ctx.restore();
      const ra = ease.outBack(prog(t, 22.3, 22.75));
      if (ra > 0) {
        ctx.strokeStyle = rgba(COL.accent, fadeAll);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 16 * ra, 0, Math.PI * 2);
        ctx.stroke();
      }
      const la = smooth(prog(t, 22.4, 22.9)) * fadeAll;
      setFont(500, 15, MONO, 1.5);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      fillText('DISTANCE 0.21', mx - 30, my + 34, rgba(COL.accent, la), 'left');
    }
  }

  // the three prompt tokens: fly in from the vector columns, later gather into a row
  for (let i = 0; i < 3; i++) {
    const fromX = LAY.row1[i].cx, fromY = 560;
    const tp = map.tokenPos[i];
    const fl = ease.inOutCubic(prog(t, 17.55 + i * 0.06, 18.75 + i * 0.06));
    const target = P(tp);
    let x = lerp(fromX, target.x, fl), y = lerp(fromY, target.y, fl) - Math.sin(Math.PI * fl) * 90;
    // gather back into a row for chapter 3
    const g = ease.inOutCubic(prog(t, 24.05 + i * 0.05, 25.1));
    const rowC = LAY.row3Center, rc = LAY.row3[i];
    if (g > 0) {
      x = lerp(target.x, rowC.x + rc.cx, g);
      y = lerp(target.y, rowC.y + rc.cy, g) - Math.sin(Math.PI * g) * 60;
    }
    // motion trail
    if ((fl > 0 && fl < 1) || (g > 0 && g < 1)) {
      const k = g > 0 ? g : fl;
      const k2 = Math.max(0, k - 0.08);
      const px = g > 0 ? lerp(target.x, rowC.x + rc.cx, k2) : lerp(fromX, target.x, k2);
      const py = g > 0 ? lerp(target.y, rowC.y + rc.cy, k2) - Math.sin(Math.PI * k2) * 60 : lerp(fromY, target.y, k2) - Math.sin(Math.PI * k2) * 90;
      const grad = ctx.createLinearGradient(px, py, x, y);
      grad.addColorStop(0, rgba(COL.accent, 0));
      grad.addColorStop(1, rgba(COL.accent, 0.6));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    const land = t - (18.75 + i * 0.06);
    const pulse = land > 0 && land < 0.9 ? land / 0.9 : -1;
    if (pulse >= 0 && g === 0) {
      ctx.strokeStyle = rgba(COL.accent, 0.7 * (1 - pulse));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10 + 42 * ease.outCubic(pulse), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = rgba(COL.accent, 0.6);
    ctx.shadowBlur = 18;
    dot(x, y, 9, COL.accent);
    ctx.restore();
    const la = smooth(prog(t, 18.75 + i * 0.06, 19.2 + i * 0.06)) * (1 - smooth(prog(t, 24.0, 24.3))) * (i === 1 ? 1 : lerp(1, 0.75, 1 - (1 - 0.6 * smooth(prog(t, 20.6, 21.6)))));
    if (la > 0) {
      setFont(600, 27 * Math.sqrt(cam.z), DISPLAY);
      fillText(TOKENS[i].word, x + 18, y + 9, rgba(COL.paper, la), 'left');
    }
  }
}

/* ----------------------------------------------------------------------------
   Scene: chapter 3 — attention, then the stack of layers
---------------------------------------------------------------------------- */
// Orthographic projection of a plane: local (u, w) -> screen, as a canvas affine transform.
// alpha: plane tilt (0 = facing camera, PI/2 = lying flat), theta: camera pitch, psi: camera yaw.
function planeTransform(cx, cy, s, alpha, theta, psi, h) {
  const ca = Math.cos(alpha), sa = Math.sin(alpha), ct = Math.cos(theta), st = Math.sin(theta);
  const cp = Math.cos(psi), sp = Math.sin(psi);
  return [cp * s, sp * st * s, -sa * sp * s, (ca * ct + sa * cp * st) * s, cx, cy - h * ct * s];
}
const applyXf = (m, u, w) => ({ x: m[0] * u + m[2] * w + m[4], y: m[1] * u + m[3] * w + m[5] });

// attention weights (query " is" looks back)
const ATT = [{ q: 2, k: 1, w: 0.71 }, { q: 2, k: 0, w: 0.18 }, { q: 2, k: 2, w: 0.11 }];

function arcPts(row, q, k, lift = 1) {
  const a = row[q], b = row[k];
  const y0 = a.top - 14;
  if (q === k) {
    return { p0: { x: a.cx + 14, y: y0 }, c1: { x: a.cx + 6, y: y0 - 118 * lift }, c2: { x: a.cx + 104, y: y0 - 118 * lift }, p1: { x: a.cx + 58, y: y0 } };
  }
  const off = (q - k - 1) * 26;
  const x0 = a.cx - 8 - off, x1 = b.cx + 8 + off;
  const d = Math.abs(x0 - x1);
  const hgt = (d * 0.42 + 70) * lift;
  return { p0: { x: x0, y: y0 }, c1: { x: x0, y: y0 - hgt * 1.3 }, c2: { x: x1, y: y0 - hgt * 1.3 }, p1: { x: x1, y: y0 } };
}
function bez(P, u) {
  const v = 1 - u;
  return {
    x: v * v * v * P.p0.x + 3 * v * v * u * P.c1.x + 3 * v * u * u * P.c2.x + u * u * u * P.p1.x,
    y: v * v * v * P.p0.y + 3 * v * v * u * P.c1.y + 3 * v * u * u * P.c2.y + u * u * u * P.p1.y,
  };
}
function strokeBezPartial(P, p0, p1, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const N = 40;
  for (let n = 0; n <= N; n++) {
    const u = lerp(p0, p1, n / N);
    const q = bez(P, u);
    if (n === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// Layer timings (accelerating)
const LAYER_T = [];
{ let t = 32.1, d = 0.44; for (let k = 1; k <= 8; k++) { LAYER_T.push(+t.toFixed(3)); t += d; d *= 0.88; } }

function cardBounds() {
  const row = LAY.row3;
  return { u0: row[0].left - 90, u1: row[2].left + row[2].w + 90, w0: row[0].top - 250, w1: row[0].top + row[0].h + 60 };
}
// Scale + centre that fit the whole stack (base card to top card) inside the safe area.
function stackFit(theta, psi, hTop) {
  const B = cardBounds();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const h of [0, hTop]) {
    const m = planeTransform(0, 0, 1, Math.PI / 2, theta, psi, h);
    for (const [u, w] of [[B.u0, B.w0], [B.u1, B.w0], [B.u0, B.w1], [B.u1, B.w1]]) {
      const p = applyXf(m, u, w);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  const box = { x0: 330, x1: 1590, y0: 250, y1: 850 };
  const s = Math.min(1, (box.x1 - box.x0) / (x1 - x0), (box.y1 - box.y0) / (y1 - y0));
  return { s, cx: (box.x0 + box.x1) / 2 - ((x0 + x1) / 2) * s, cy: (box.y0 + box.y1) / 2 - ((y0 + y1) / 2) * s };
}
function stackState(t) {
  const tilt = ease.inOutCubic(prog(t, 31.0, 32.3));
  const alpha = tilt * Math.PI / 2;
  const theta = tilt * 0.98;
  const psi = -tilt * 0.40;
  // stack height grows as layers arrive
  let grown = 0;
  for (let k = 0; k < LAYER_T.length; k++) grown += ease.emph(prog(t, LAYER_T[k], LAYER_T[k] + 0.35));
  const gap = 88;
  const hTop = grown * gap;
  const fit = stackFit(0.98, -0.40, hTop);
  let s = lerp(1, fit.s, tilt);
  let cx = lerp(LAY.row3Center.x, fit.cx, tilt), cy = lerp(LAY.row3Center.y, fit.cy, tilt);
  // focus: push in on the top layer's last token
  const focus = ease.inOutCubic(prog(t, 35.1, 36.7));
  if (focus > 0) {
    const sF = fit.s * 1.3;
    const m = planeTransform(0, 0, sF, Math.PI / 2, theta, psi, hTop);
    const p = applyXf(m, LAY.row3[2].cx, LAY.row3[2].cy);
    s = lerp(s, sF, focus);
    cx = lerp(cx, W / 2 - 60 - p.x, focus);
    cy = lerp(cy, H / 2 + 10 - p.y, focus);
  }
  return { tilt, alpha, theta, psi, s, gap, grown, hTop, cx, cy, focus };
}

function drawRow3Content(t, row, opts) {
  // opts: {chipA, textA, arcsA, fill, base}
  for (let i = 0; i < 3; i++) {
    const c = row[i];
    const grow = opts.grow[i];
    if (grow <= 0) continue;
    const w = lerp(18, c.w, grow), h = lerp(18, c.h, grow);
    const rad = lerp(9, 14, grow);
    const isQ = i === 2;
    const fillA = isQ ? opts.fill : 0;
    if (grow < 1) fillRoundRect(c.cx - w / 2, c.cy - h / 2, w, h, rad, rgba(COL.accent, 1 - grow));
    if (fillA > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(c.cx - w / 2, c.cy - h / 2, w, h, rad);
      ctx.clip();
      const fx = c.cx - w / 2 + w * ease.inOutCubic(fillA);
      ctx.fillStyle = rgba(COL.accent, 0.92);
      ctx.fillRect(c.cx - w / 2, c.cy - h / 2, fx - (c.cx - w / 2), h);
      ctx.restore();
    }
    strokeRoundRect(c.cx - w / 2, c.cy - h / 2, w, h, rad, 1, rgba(isQ && opts.qHi > 0 ? COL.accent : COL.paper, lerp(0.75, 1, isQ ? opts.qHi : 0) * opts.chipA), 2);
    const ta = smooth(clamp((grow - 0.4) / 0.6)) * opts.textA;
    if (ta > 0) {
      setFont(600, c.size, DISPLAY);
      const col = fillA > 0.5 ? mixHex(COL.paper, COL.ink, smooth((fillA - 0.5) * 2), ta) : rgba(COL.paper, ta);
      fillText(TOKENS[i].word, c.wordX, c.base, col);
      if (TOKENS[i].lead) spaceMark(c.markX + 0.08 * c.size, c.base, c.markW * 0.84, c.size, rgba(fillA > 0.5 ? COL.ink : COL.mute, ta * 0.9));
    }
  }
}

function drawAttention(t) {
  if (t < 25.05 || t >= 38.7) return;
  const row = LAY.row3;
  const st = stackState(t);
  const grow = [0, 1, 2].map((i) => ease.outBack(prog(t, 25.05 + i * 0.08, 25.55 + i * 0.08)));
  const qHi = smooth(prog(t, 26.3, 26.7));
  const fill = prog(t, 29.95, 30.5);

  // ---- upper layers (drawn after the base so they sit on top)
  const baseXf = planeTransform(st.cx, st.cy, st.s, st.alpha, st.theta, st.psi, 0);

  // base layer card (appears as the row lies down)
  const CB = cardBounds();
  const cardU0 = CB.u0, cardU1 = CB.u1, cardW0 = CB.w0, cardW1 = CB.w1;
  const cardA = smooth(prog(t, 31.5, 32.2));
  const dimOthers = 1 - 0.72 * st.focus;

  const drawCard = (xf, a, k) => {
    ctx.save();
    ctx.setTransform(...xf);
    ctx.fillStyle = rgba(COL.ink, 0.95 * a);
    ctx.beginPath();
    ctx.roundRect(cardU0, cardW0, cardU1 - cardU0, cardW1 - cardW0, 18);
    ctx.fill();
    ctx.strokeStyle = rgba(COL.paper, 0.3 * a);
    ctx.lineWidth = 1.5 / st.s;
    ctx.stroke();
    setFont(500, 26, MONO, 2);
    fillText(`L${String(k).padStart(2, '0')}`, cardU1 - 28, cardW1 - 26, rgba(COL.mute, a), 'right');
    ctx.restore();
  };

  // base layer
  if (cardA > 0) drawCard(baseXf, cardA * (st.focus > 0 ? dimOthers : 1), 1);
  ctx.save();
  ctx.setTransform(...baseXf);
  const baseA = st.focus > 0 ? dimOthers : 1;
  // arcs on the base row
  ATT.forEach((at, n) => {
    const P = arcPts(row, at.q, at.k);
    const t0 = 26.6 + n * 0.42;
    const p = ease.inOutCubic(prog(t, t0, t0 + 0.65));
    if (p <= 0) return;
    const strong = at.k === 1;
    strokeBezPartial(P, 0, p, rgba(strong ? COL.accent : COL.paper, (strong ? 1 : 0.55) * baseA), 2 + 16 * at.w);
    const la = smooth(prog(t, t0 + 0.4, t0 + 0.8)) * baseA;
    if (la > 0) {
      const apex = bez(P, 0.5);
      setFont(500, 22, MONO, 1);
      fillText(at.w.toFixed(2), apex.x + (at.q === at.k ? 34 : 0), apex.y - (at.q === at.k ? 2 : 20), rgba(strong ? COL.accent : COL.mute, la), at.q === at.k ? 'left' : 'center');
    }
  });
  // information pulse: from " sky" into " is"
  const pp = prog(t, 29.35, 29.95);
  if (pp > 0 && pp < 1) {
    const P = arcPts(row, 2, 1);
    const u = 1 - ease.inOutCubic(pp);
    const q = bez(P, u);
    ctx.save();
    ctx.shadowColor = COL.accent;
    ctx.shadowBlur = 30;
    dot(q.x, q.y, 11, COL.paper);
    ctx.restore();
    strokeBezPartial(P, Math.max(0, u), Math.min(1, u + 0.18), rgba(COL.paper, 0.9), 6);
  }
  drawRow3Content(t, row, { grow, chipA: baseA, textA: baseA, fill, qHi });
  // annotation under the row
  const na = smooth(prog(t, 30.3, 30.7)) * (1 - smooth(prog(t, 30.9, 31.2)));
  if (na > 0) {
    setFont(500, 16, MONO, 2.5);
    fillText('‘IS’ NOW CARRIES CONTEXT FROM ‘SKY’', 0, row[0].top + row[0].h + 62, rgba(COL.mute, na), 'center');
  }
  ctx.restore();

  // upper layers
  if (st.tilt > 0.99) {
    let topK = -1;
    for (let k = 0; k < LAYER_T.length; k++) if (t >= LAYER_T[k]) topK = k;
    for (let k = 0; k < LAYER_T.length; k++) {
      const lp = ease.emph(prog(t, LAYER_T[k], LAYER_T[k] + 0.35));
      if (lp <= 0) continue;
      const h = lerp(k, k + 1, lp) * st.gap;
      const xf = planeTransform(st.cx, st.cy, st.s, Math.PI / 2, st.theta, st.psi, h);
      const isTop = k === LAYER_T.length - 1;
      const la = lp * (isTop ? 1 : dimOthers);
      // vertical connectors from the layer below
      const below = planeTransform(st.cx, st.cy, st.s, Math.PI / 2, st.theta, st.psi, k * st.gap);
      for (let i = 0; i < 3; i++) {
        const a = applyXf(below, row[i].cx, row[i].cy), b = applyXf(xf, row[i].cx, row[i].cy);
        line(a.x, a.y, b.x, b.y, rgba(i === 2 ? COL.accent : COL.paper, 0.35 * la), 1.5);
        // pulse travelling up
        const pu = prog(t, LAYER_T[k], LAYER_T[k] + 0.3);
        if (pu > 0 && pu < 1) dot(lerp(a.x, b.x, pu), lerp(a.y, b.y, pu), 4, rgba(COL.paper, 0.9 * (1 - pu)));
      }
      drawCard(xf, la, k + 2);
      ctx.save();
      ctx.setTransform(...xf);
      // flickering attention on each layer
      const R = rng(1000 + k);
      for (let q = 1; q < 3; q++) {
        for (let kk = 0; kk <= q; kk++) {
          const w = q === 2 && kk === 1 ? 0.55 + R() * 0.3 : R() * 0.45;
          const P = arcPts(row, q, kk, 0.75);
          const ap = ease.inOutCubic(prog(t, LAYER_T[k] + 0.08 + kk * 0.03, LAYER_T[k] + 0.4 + kk * 0.03));
          if (ap <= 0) continue;
          const strong = q === 2 && kk === 1;
          strokeBezPartial(P, 0, ap, rgba(strong ? COL.accent : COL.paper, (strong ? 0.95 : 0.4) * la), 2 + 12 * w);
        }
      }
      const nextP = k < LAYER_T.length - 1 ? smooth(prog(t, LAYER_T[k + 1], LAYER_T[k + 1] + 0.25)) : 0;
      const labelA = k === topK ? lp : k === topK - 1 ? 1 - nextP : 0;
      for (let i = 0; i < 3; i++) {
        const c = row[i];
        const hi = isTop && i === 2 ? st.focus : 0;
        dot(c.cx, c.cy, lerp(13, 22, hi), rgba(i === 2 ? COL.accent : COL.paper, la));
        if (labelA > 0) {
          setFont(600, 44, DISPLAY);
          fillText(TOKENS[i].word, c.cx, c.cy + 74, rgba(COL.paper, 0.85 * la * labelA), 'center');
        }
      }
      ctx.restore();
    }
    // layer counter beside the top card
    const shown = LAYER_T.filter((lt) => t >= lt).length;
    if (shown > 0) {
      const top = planeTransform(st.cx, st.cy, st.s, Math.PI / 2, st.theta, st.psi, st.grown * st.gap);
      const anchor = applyXf(top, cardU1, cardW0);
      const total = Math.round(lerp(shown + 1, 32, smooth(prog(t, LAYER_T[LAYER_T.length - 1] + 0.1, LAYER_T[LAYER_T.length - 1] + 0.8))));
      const ca = smooth(prog(t, 32.1, 32.4)) * (1 - st.focus);
      setFont(500, 17, MONO, 2.5);
      fillText(`LAYER ${String(total).padStart(2, '0')} / 32`, anchor.x + 30, anchor.y - 6, rgba(COL.paper, ca), 'left');
    }
    // focus annotation on the final " is" vector
    if (st.focus > 0) {
      const top = planeTransform(st.cx, st.cy, st.s, Math.PI / 2, st.theta, st.psi, st.grown * st.gap);
      const pt = applyXf(top, row[2].cx, row[2].cy);
      const fa = smooth(prog(t, 35.7, 36.2)) * (1 - smooth(prog(t, 37.2, 37.5)));
      const lx = pt.x + 60, ly = pt.y - 120;
      ctx.save();
      line(pt.x + 16, pt.y - 16, lerp(pt.x + 16, lx, ease.emph(fa)), lerp(pt.y - 16, ly, ease.emph(fa)), rgba(COL.accent, fa), 1.5);
      setFont(500, 16, MONO, 2.5);
      fillText('THE LAST TOKEN’S FINAL VECTOR', lx + 12, ly - 6, rgba(COL.paper, fa), 'left');
      fillText('→ USED TO PREDICT WHAT COMES NEXT', lx + 12, ly + 20, rgba(COL.mute, fa), 'left');
      ctx.restore();
      const glow = smooth(prog(t, 36.2, 37.3));
      if (glow > 0) {
        ctx.save();
        ctx.shadowColor = COL.accent;
        ctx.shadowBlur = 40 * glow;
        dot(pt.x, pt.y, 22 + 10 * glow, COL.accent);
        ctx.restore();
      }
      LAY.wipeOrigin = pt;
    }
  }
}

// Accent circle grows out of the final vector; an ink circle then opens chapter 4.
function wipeOrigin(t) {
  // stable origin computed from the stack's end state
  const st = stackState(37.3);
  const top = planeTransform(st.cx, st.cy, st.s, Math.PI / 2, st.theta, st.psi, st.grown * st.gap);
  return applyXf(top, LAY.row3[2].cx, LAY.row3[2].cy);
}

/* ----------------------------------------------------------------------------
   Scene: chapter 4 — the distribution, the pick, generation
---------------------------------------------------------------------------- */
const CHART = { labelX: 760, barX: 790, maxBar: 760, y0: 352, pitch: 62, barH: 30 };

function drawChart(t) {
  if (t < 38.0 || t >= 43.2) return;
  const pick = ease.inOutCubic(prog(t, 42.0, 42.6));
  const hi = smooth(prog(t, 41.3, 41.7));
  // header
  const ha = smooth(prog(t, 38.3, 38.8)) * (1 - pick);
  setFont(500, 20, MONO, 1);
  fillText('P( next token | “The sky is” )', CHART.barX, 284, rgba(COL.mute, ha), 'left');
  line(CHART.barX - 1, 300, CHART.barX - 1, 300 + (DIST.length * CHART.pitch + 100) * ease.emph(prog(t, 38.2, 38.9)), rgba(COL.paper, 0.3 * (1 - pick)), 1.5);

  DIST.forEach((d, r) => {
    const t0 = 38.45 + r * 0.09;
    const g = ease.emph(prog(t, t0, t0 + 0.8));
    if (g <= 0) return;
    const y = CHART.y0 + r * CHART.pitch;
    const top = r === 0;
    const fall = top ? 0 : ease.inCubic(prog(t, 42.0 + r * 0.03, 42.45 + r * 0.03));
    const dimA = top ? 1 : 1 - 0.65 * hi;
    const a = smooth(clamp(g * 2)) * dimA * (1 - fall);
    const yy = y + fall * 40;
    // label
    if (!top || pick < 0.02) {
      setFont(600, 40, DISPLAY);
      const lw = tw(d.w);
      fillText(d.w, CHART.labelX, yy + 14, rgba(top ? COL.paper : COL.paper, a), 'right');
      spaceMark(CHART.labelX - lw - 36, yy + 14, 30, 40, rgba(COL.mute, a * 0.9));
    }
    // bar
    const len = (d.p / DIST[0].p) * CHART.maxBar * g * (top ? 1 - ease.inOutCubic(prog(t, 42.0, 42.5)) : 1);
    fillRoundRect(CHART.barX + 8, yy - CHART.barH / 2, len, CHART.barH, 4, top ? mixHex(COL.paper, COL.accent, Math.max(hi, 0.0), a) : rgba(COL.paper, 0.78 * a));
    // percentage
    setFont(500, 26, MONO);
    const pct = Math.round(d.p * 100 * g);
    const pa = a * (top ? 1 - pick : 1);
    fillText(`${pct}%`, CHART.barX + 8 + len + 18, yy + 9, rgba(top ? (hi > 0 ? COL.accent : COL.paper) : COL.mute, pa), 'left');
  });
  // the long tail
  const ta = smooth(prog(t, 39.2, 39.8)) * (1 - 0.6 * hi) * (1 - pick);
  if (ta > 0) {
    for (let k = 0; k < 18; k++) {
      const y = CHART.y0 + DIST.length * CHART.pitch - 14 + k * 7;
      const len = 26 * Math.exp(-k * 0.16) * ease.emph(prog(t, 39.2 + k * 0.02, 39.8 + k * 0.02));
      ctx.fillStyle = rgba(COL.paper, 0.35 * ta * (1 - k / 20));
      ctx.fillRect(CHART.barX + 8, y, len, 3);
    }
    setFont(500, 16, MONO, 2.5);
    fillText('+ 100,249 MORE TOKENS, EACH WITH A TINY CHANCE', CHART.barX + 80, CHART.y0 + DIST.length * CHART.pitch + 40, rgba(COL.mute, ta), 'left');
  }
  // selection marker
  if (hi > 0 && pick < 1) {
    const y = CHART.y0;
    setFont(500, 26, MONO);
    fillText('▸', CHART.labelX - 150 - (1 - hi) * 20, y + 10, rgba(COL.accent, hi * (1 - pick)), 'right');
  }
}

function paraLayout(t) {
  // vertical centring adapts as lines are added
  const P = LAY.para;
  const lineOf = (tt) => { let ln = 0; for (const p of P.pieces) if (!p.gen || tt >= p.t) ln = Math.max(ln, p.ln); return ln + 1; };
  let lines = 1;
  // smooth the line count over time
  const n1 = lineOf(t);
  let lastChange = M.land;
  for (const p of P.pieces) if (p.gen && t >= p.t && p.ln + 1 === n1) { lastChange = p.t; break; }
  const prevLines = lineOf(lastChange - 0.001);
  lines = lerp(prevLines, n1, ease.emph(prog(t, lastChange, lastChange + 0.6)));
  const top = 470 - (lines - 1) * P.lh / 2;
  return { top };
}

function drawParagraph(t, cam = null) {
  if (t < 42.0) return;
  const P = LAY.para;
  const L = paraLayout(t);
  const pin = ease.swift(prog(t, 42.2, M.land));
  ctx.save();
  if (cam) ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.x * cam.z, H / 2 - cam.y * cam.z);
  setFont(600, P.S, DISPLAY);
  let cursor = null;
  P.pieces.forEach((p, idx) => {
    const x = P.left + p.x;
    const y = L.top + p.ln * P.lh;
    if (!p.gen) {
      const recoil = t > M.land ? -9 * Math.sin(Math.PI * prog(t, M.land, M.land + 0.22)) : 0;
      fillText(p.draw, x - (1 - pin) * 340 + recoil, y, rgba(COL.paper, smooth(clamp(pin * 1.6))), 'left');
      cursor = { x: x + p.w, y };
      return;
    }
    if (idx === 3) {
      // " blue": flies in from the chart
      const fly = prog(t, 42.45, M.land);
      if (fly <= 0) return;
      const e = ease.inOutCubic(fly);
      const fromX = CHART.labelX - wordWidth('blue') * 40, fromY = CHART.y0 + 14;
      const size = lerp(40, P.S, e);
      const tx = x + tw(' '), ty = y;
      const cx = lerp(fromX, tx, e), cy = lerp(fromY, ty, e) - Math.sin(Math.PI * e) * 46;
      const land = spring(t - M.land, 3, 0.35);
      const sc = t >= M.land ? lerp(1.18, 1, land) : 1;
      setFont(600, size * sc, DISPLAY);
      const col = t >= M.land ? COL.accent : mixHex(COL.paper, COL.accent, e);
      fillText('blue', cx, cy, col, 'left');
      // chip outline around the flying token, dissolving after landing
      const oa = t < M.land ? 1 : 1 - prog(t, M.land + 0.1, M.land + 0.7);
      if (oa > 0) {
        const bw = tw('blue');
        strokeRoundRect(cx - 0.22 * size, cy - 0.98 * size * sc, bw + 0.44 * size, 1.3 * size * sc, 10, 1, rgba(COL.accent, oa), 2);
      }
      setFont(600, P.S, DISPLAY);
      if (t >= M.land) cursor = { x: x + p.w, y };
      return;
    }
    if (t < p.t) return;
    const a = ease.emph(prog(t, p.t, p.t + 0.28));
    fillText(p.draw, x, y + (1 - a) * 18, rgba(COL.accent, a), 'left');
    const oa = 1 - prog(t, p.t + 0.05, p.t + 0.45);
    if (oa > 0 && oa < 1) strokeRoundRect(x + (p.draw.startsWith(' ') ? tw(' ') : 0) - 10, y - 0.98 * P.S, p.w - (p.draw.startsWith(' ') ? tw(' ') : 0) + 20, 1.3 * P.S, 10, 1, rgba(COL.accent, oa), 2);
    cursor = { x: x + p.w, y };
  });
  // cursor + the tiny "distribution" flicker before each new token
  if (cursor && t >= M.land - 0.01) {
    let ca = t < 44.4 ? blink(t, 43.6) : 1;
    if (t > 47.6) ca = blink(t, 48.0);
    ca *= 1 - smooth(prog(t, 50.2, 50.6));
    if (t < M.land + 0.3) ca = 0;
    fillRoundRect(cursor.x + 10, cursor.y - 0.8 * P.S, 8, 0.98 * P.S, 1.5, rgba(COL.accent, ca));
    for (let g = 1; g < GEN_T.length; g++) {
      const ft = GEN_T[g];
      const fa = prog(t, ft - 0.2, ft - 0.08) * (1 - prog(t, ft - 0.02, ft + 0.06));
      if (fa <= 0) continue;
      for (let b = 0; b < 3; b++) {
        const len = (b === 0 ? 70 : 52 - b * 16) * (0.6 + 0.4 * hash(g * 11 + b)) * smooth(fa);
        ctx.fillStyle = rgba(b === 0 ? COL.accent : COL.paper, (b === 0 ? 0.95 : 0.5) * fa);
        ctx.fillRect(cursor.x + 30, cursor.y + 22 + b * 9, len, 5);
      }
    }
  }
  ctx.restore();
}

/* ----------------------------------------------------------------------------
   Scene: the corpus — zoom out to the text it learned from
---------------------------------------------------------------------------- */
function corpusCam(t) {
  const P = LAY.para;
  const cx = P.left + P.maxW / 2 - 40, cy = paraLayout(53).top + P.lh * 0.6;
  const z = Math.exp(lerp(0, Math.log(0.045), ease.inOutCubic(prog(t, 50.05, 53.4))));
  const drift = ease.inOutCubic(prog(t, 50.05, 53.4));
  return { x: lerp(W / 2, cx, smooth(prog(t, 50.05, 50.8))), y: lerp(H / 2, cy, smooth(prog(t, 50.05, 50.8))) + drift * 40, z };
}

function drawCorpus(t) {
  if (t < 50.0 || t >= 54.0) return;
  const cam = corpusCam(t);
  const C = LAY.corpus, P = LAY.para;
  const out = 1 - smooth(prog(t, 53.3, 53.9));
  const wa = smooth(prog(t, 50.1, 50.9)) * out;
  const fsz = C.S * cam.z;
  const L = paraLayout(53);
  const ox = P.left, oy = L.top;
  const halfW = W / 2 / cam.z, halfH = H / 2 / cam.z;
  ctx.save();
  if (fsz >= 6) setFont(500, fsz, DISPLAY);
  for (const b of C.blocks) {
    const bx = ox + b.x, by = oy + b.y;
    if (bx > cam.x + halfW || bx + 1700 < cam.x - halfW || by - 100 > cam.y + halfH || by + 420 < cam.y - halfH) continue;
    const d = Math.hypot(b.gx, b.gy * 1.6);
    const da = wa * (0.85 - 0.5 * clamp(d / 22));
    for (let i = 0; i < b.lines.length; i++) {
      const ln = b.lines[i];
      const wx = bx, wy = by + i * P.lh;
      const sx = (wx - cam.x) * cam.z + W / 2, sy = (wy - cam.y) * cam.z + H / 2;
      const col = ln.hi ? COL.paper : COL.mute;
      const alpha = da * (ln.hi ? 0.9 : 0.55);
      if (fsz >= 6) {
        ctx.fillStyle = rgba(col, alpha);
        ctx.fillText(ln.s, sx, sy);
      } else {
        ctx.fillStyle = rgba(col, alpha * 0.8);
        ctx.fillRect(sx, sy - fsz * 0.7, ln.w * cam.z, Math.max(1, fsz * 0.62));
      }
    }
  }
  ctx.restore();
  // the hero paragraph stays in vector form
  ctx.save();
  ctx.globalAlpha = out;
  drawParagraph(t, cam);
  ctx.restore();
  // a ring that keeps the hero findable at the far end of the zoom
  const ra = smooth(prog(t, 52.4, 52.9)) * out;
  if (ra > 0) {
    const hx = (P.left + 700 - cam.x) * cam.z + W / 2, hy = (oy + P.lh * 0.5 - cam.y) * cam.z + H / 2;
    ctx.strokeStyle = rgba(COL.accent, ra);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, lerp(110, 52, ease.emph(ra)), 0, Math.PI * 2);
    ctx.stroke();
    setFont(500, 15, MONO, 2.5);
    fillText('ONE SENTENCE', hx + 70, hy - 4, rgba(COL.paper, ra), 'left');
    fillText('OF TRILLIONS OF WORDS', hx + 70, hy + 20, rgba(COL.mute, ra), 'left');
  }
}

/* ----------------------------------------------------------------------------
   Scene: statements + end card
---------------------------------------------------------------------------- */
function bigLine(t, words, tin, tout, size, y, accentFrom = 99) {
  if (t < tin || t > tout + 0.6) return;
  setFont(700, size, DISPLAY, -2);
  const sp = tw(' ');
  const widths = words.map((w) => tw(w));
  const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let x = W / 2 - total / 2;
  for (let i = 0; i < words.length; i++) {
    const pin = ease.emph(prog(t, tin + i * 0.09, tin + i * 0.09 + 0.8));
    const pout = ease.inCubic(prog(t, tout + i * 0.04, tout + i * 0.04 + 0.4));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 20, y - size * 1.0, widths[i] + 40, size * 1.3);
    ctx.clip();
    const dy = (1 - pin) * size * 1.1 - pout * size * 1.1;
    fillText(words[i], x, y + dy, i >= accentFrom ? COL.accent : COL.paper, 'left');
    ctx.restore();
    x += widths[i] + sp;
  }
}

// Slow push-in for static shots, scaling about the frame centre.
function pushIn(t, t0, t1, amount) {
  const k = 1 + amount * ease.outCubic(prog(t, t0, t1));
  ctx.translate(W / 2, H / 2);
  ctx.scale(k, k);
  ctx.translate(-W / 2, -H / 2);
}

function drawStatements(t) {
  if (t < M.words - 0.1 || t >= M.end + 0.6) return;
  ctx.save();
  pushIn(t, M.words, M.end, 0.05);
  bigLine(t, ['No', 'magic.'], M.words, M.words2 - 0.42, 168, 600);
  bigLine(t, ['Just', 'prediction.'], M.words2, M.end - 0.42, 168, 600, 1);
  ctx.restore();
}

function drawEndCard(t) {
  if (t < M.end) return;
  ctx.save();
  pushIn(t, M.end, M.fade + 1, 0.045);
  drawEndCardContent(t);
  ctx.restore();
}

function drawEndCardContent(t) {
  const words = ['One', 'token', 'at', 'a', 'time.'];
  const size = 124, y = 560;
  setFont(700, size, DISPLAY, -1.5);
  const sp = tw(' ');
  const widths = words.map((w) => tw(w));
  const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1) + 30;
  let x = W / 2 - total / 2;
  for (let i = 0; i < words.length; i++) {
    const t0 = M.end + 0.05 + i * 0.12;
    const pin = ease.emph(prog(t, t0, t0 + 0.85));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 20, y - size * 1.0, widths[i] + 40, size * 1.3);
    ctx.clip();
    fillText(words[i], x, y + (1 - pin) * size * 1.1, COL.paper, 'left');
    ctx.restore();
    x += widths[i] + sp;
  }
  // cursor after the title, blinking on the beat
  const cOn = t >= M.end + 0.75 ? (t < M.end + 1.5 ? 1 : blink(t, 59.0)) : 0;
  fillRoundRect(x - sp + 22, y - 0.78 * size, 11, 0.98 * size, 1.5, rgba(COL.accent, cOn));
  const sa = smooth(prog(t, M.end + 0.9, M.end + 1.5));
  setFont(500, 18, MONO, 5);
  fillText(scramble('HOW A LANGUAGE MODEL WRITES', prog(t, M.end + 0.9, M.end + 1.7), t, 11), W / 2, y + 88, rgba(COL.mute, sa), 'center');
  const ca = smooth(prog(t, 59.2, 59.9));
  setFont(500, 14, MONO, 3.5);
  fillText('EVERY FRAME DRAWN IN CODE  ·  EVERY SOUND SYNTHESIZED FROM SCRATCH', W / 2, 1000, rgba(COL.dim, ca), 'center');
}

/* ----------------------------------------------------------------------------
   Frame
---------------------------------------------------------------------------- */
// Vignette, scrims, chapter title, captions and frame chrome sit above the scene.
function drawOverlays(t) {
  drawVignette();
  drawScrims(smooth(prog(t, 6.0, 7.0)) * (1 - smooth(prog(t, 53.4, 54.0))));
  drawChapterTitle(t);
  drawCaptions(t);
  drawChrome(t);
}

function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  if (t < M.ch4) {
    drawBackground(t, gridState(t));
    drawTokens(t);
    drawMap(t);
    drawAttention(t);
    drawOverlays(t);
    // the final vector swells into an accent circle that fills the frame
    if (t >= 37.3) {
      const o = wipeOrigin();
      dot(o.x, o.y, 2300 * ease.inExpo(prog(t, 37.3, M.ch4)), COL.accent);
    }
  } else {
    // an ink circle opens out of the accent to reveal chapter 4
    const wipeOut = t < 38.65;
    if (wipeOut) {
      ctx.fillStyle = COL.accent;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 2300 * ease.outCubic(prog(t, M.ch4, 38.65)), 0, Math.PI * 2);
      ctx.clip();
    }
    drawBackground(t, gridState(t));
    drawChart(t);
    if (t < M.corpus) drawParagraph(t);
    drawCorpus(t);
    drawStatements(t);
    drawEndCard(t);
    drawOverlays(t);
    if (wipeOut) ctx.restore();
  }

  // fade to black
  const fo = smooth(prog(t, M.fade, M.fade + 1.0));
  if (fo > 0) { ctx.fillStyle = rgba('#000000', fo); ctx.fillRect(0, 0, W, H); }
}

/* ----------------------------------------------------------------------------
   Sound cues — derived from the same timeline as the picture
---------------------------------------------------------------------------- */
function getCues() {
  const C = [];
  const add = (t, type, o = {}) => C.push({ t: Math.round(t * 1000) / 1000, type, ...o });
  const pan = (x) => +(clamp((x - W / 2) / (W / 2), -1, 1) * 0.75).toFixed(3);

  // cold open
  for (const bt of [0.6, 1.6, 4.5, 5.5]) add(bt, 'blink', { pan: pan(LAY.sent[0].start), v: bt < 2 ? 0.8 : 0.6 });
  TYPE_T.forEach((tt, i) => {
    const ct = LAY.charTok[i];
    const s = LAY.sent[ct.tok];
    add(tt, 'key', { pan: pan(s.wordX), v: PROMPT[i] === ' ' ? 0.7 : 1, n: i });
  });
  add(4.0, 'question', { pan: 0 });
  // chapter 1
  add(M.ch1, 'hit', { v: 0.8 });
  add(M.ch1 + 0.05, 'ui', { pan: -0.6 });
  add(6.15, 'whoosh', { dur: 0.8, pan0: 0, pan1: 0, v: 0.5 });
  TOKENS.forEach((_, i) => add(6.55 + i * 0.12, 'pop', { pan: pan(LAY.row1[i].cx), n: i }));
  TOKENS.forEach((tok, i) => {
    add(8.0 + i * 0.18, 'roll', { pan: pan(LAY.row1[i].cx), dur: 0.32 + tok.id.length * 0.07 });
    add(8.35 + i * 0.18 + (tok.id.length - 1) * 0.07 + 0.32, 'lock', { pan: pan(LAY.row1[i].cx), n: i });
  });
  add(10.35, 'morph', { dur: 1.0 });
  add(11.7, 'ui', { pan: 0 });
  // chapter 2
  add(M.ch2, 'hit', { v: 0.9 });
  add(14.0, 'whoosh', { dur: 0.7, pan0: 0, pan1: 0, v: 0.45, rise: true });
  for (let i = 0; i < 3; i++) for (let j = 0; j < VEC_ROWS; j++) add(14.45 + j * 0.045 + i * 0.07, 'data', { pan: pan(LAY.row1[i].cx), n: (j * 3 + i * 2) % 10, v: 0.8 });
  add(17.0, 'collapse', { dur: 0.6 });
  add(17.55, 'whoosh', { dur: 1.3, pan0: -0.2, pan1: 0.1, v: 0.8 });
  for (let i = 0; i < 3; i++) add(18.75 + i * 0.06, 'land', { pan: pan(camApply(mapCam(18.8), LAY.map.tokenPos[i]).x), n: i });
  LAY.map.others.forEach((p, k) => { if (k % 2 === 0) add(p.appear, 'plink', { pan: pan(camApply(mapCam(p.appear), p).x), n: k % 7, v: 0.5 }); });
  add(21.6, 'draw', { dur: 0.75, pan: 0.3 });
  add(22.3, 'ping', { pan: pan(camApply(mapCam(22.3), LAY.map.blue).x), n: 4 });
  add(24.0, 'whoosh', { dur: 1.2, pan0: 0.3, pan1: 0, v: 0.75 });
  for (let i = 0; i < 3; i++) add(25.05 + i * 0.08, 'pop', { pan: pan(LAY.row3Center.x + LAY.row3[i].cx), n: i + 2 });
  // chapter 3
  add(M.ch3, 'hit', { v: 0.9 });
  ATT.forEach((at, n) => add(26.6 + n * 0.42, 'arc', { dur: 0.65, pan: pan(LAY.row3Center.x + LAY.row3[at.k].cx), n: n, v: 0.4 + at.w }));
  add(29.35, 'zap', { dur: 0.6, pan0: 0.0, pan1: pan(LAY.row3Center.x + LAY.row3[2].cx) });
  add(29.95, 'fill', { pan: pan(LAY.row3Center.x + LAY.row3[2].cx) });
  add(31.0, 'tilt', { dur: 1.3 });
  LAYER_T.forEach((lt, k) => add(lt, 'layer', { k, v: 0.6 + k * 0.04 }));
  add(35.1, 'focus', { dur: 1.5 });
  add(35.9, 'riser', { dur: 2.1 });
  // chapter 4
  add(M.ch4, 'hit', { v: 1.0 });
  DIST.forEach((d, r) => add(38.45 + r * 0.09, 'bar', { r, p: d.p, pan: 0.1 }));
  add(39.2, 'tail', { dur: 0.6 });
  add(41.3, 'select', { pan: -0.1 });
  add(42.0, 'drop', {});
  add(42.45, 'whoosh', { dur: 0.7, pan0: -0.1, pan1: 0.25, v: 0.6 });
  add(M.land, 'impact', { pan: 0.25 });
  GEN_T.slice(1).forEach((gt, i) => add(gt, 'gen', { n: i, pan: 0.2 }));
  // corpus
  add(M.corpus, 'zoom', { dur: 3.4 });
  add(52.4, 'ping', { pan: 0, n: 2, v: 0.6 });
  // statements & end
  add(M.words - 0.9, 'swell', { dur: 0.9 });
  add(M.words, 'stab', { chord: 0 });
  add(M.words2, 'stab', { chord: 1 });
  add(M.end, 'title', {});
  for (const bt of [57.75, 59.0, 60.0, 61.0, 62.0]) add(bt, 'blink', { pan: 0.35, v: bt < 58 ? 0.9 : 0.55 });
  return C.sort((a, b) => a.t - b.t);
}

/* ----------------------------------------------------------------------------
   Boot
---------------------------------------------------------------------------- */
window.SCENE = { W, H, FPS, DURATION, M };
window.ready = (async () => {
  const faces = ['500 40px "Inter Display"', '600 40px "Inter Display"', '700 40px "Inter Display"',
    '800 40px "Inter Display"', '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'AaBb0123 ␣▸⋮→—…’“”')));
  await document.fonts.ready;
  initLayout();
  window.renderFrame = renderFrame;
  window.getCues = getCues;
  // Preview: open index.html in a browser to watch it play in real time (silent).
  if (!navigator.webdriver) {
    document.body.classList.add('preview');
    const start = performance.now();
    const tick = () => { renderFrame(((performance.now() - start) / 1000) % DURATION); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  return true;
})();
