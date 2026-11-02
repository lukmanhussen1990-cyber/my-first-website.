// ---------- core helpers: math, easing, noise, timing ----------
const W = 720, H = 1280, FPS = 30;
const TAU = Math.PI * 2;
const DUR = 98.0;               // total video length (s)
const POLL_LEN = 12.0;          // ending poll = last 12 s
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  in: t => t * t * t,
  back: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
// decaying oscillation that starts at t0
function spring(t, t0, amp = 1, freq = 3, decay = 6) {
  if (t < t0) return 0; const d = t - t0; return amp * Math.exp(-decay * d) * Math.cos(TAU * freq * d);
}
// 0 -> 1 progress of an animation starting at a with duration d
const P = (t, a, d) => clamp((t - a) / d);
// pop-in scale: 0 -> overshoot -> 1
function popScale(t, a, d = 0.22) { if (t < a) return 0; return E.back(P(t, a, d)); }

// ---------- word timing ----------
const WORDS = window.WORDS;
const ws = i => WORDS[i].s;
const we = i => WORDS[i].e;

// ---------- cue list (shared with the audio mixer) ----------
const CUES = [];
function cue(t, name, vol = 1, opts = {}) { CUES.push(Object.assign({ t: +t.toFixed(3), name, vol }, opts)); }

// ---------- shake events ----------
const SHAKES = [];
function shakeAt(t, amp = 14, dur = 0.35, freq = 28) { SHAKES.push({ t, amp, dur, freq }); }
function shakeOffset(t) {
  let x = 0, y = 0, r = 0;
  for (const s of SHAKES) {
    if (t < s.t || t > s.t + s.dur) continue;
    const k = 1 - (t - s.t) / s.dur, a = s.amp * k * k;
    x += noise((t - s.t) * s.freq + s.t * 3.1) * a;
    y += noise((t - s.t) * s.freq + 50 + s.t) * a;
    r += noise((t - s.t) * s.freq * 0.5 + 99) * a * 0.0016;
  }
  return { x, y, r };
}

// ---------- drawing helpers ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
function fillStroke(ctx, fill, stroke = '#1b1b22', lw = 5) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke && lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
const OUT = '#1b1b22'; // outline colour used everywhere

// outlined bold text
function boldText(ctx, str, x, y, size, fill = '#fff', opts = {}) {
  const font = opts.font || 'Anton';
  ctx.save();
  ctx.font = `${opts.weight || ''} ${size}px "${font}"`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.maxW) { const m = ctx.measureText(str).width; if (m > opts.maxW) { ctx.translate(x, y); ctx.scale(opts.maxW / m, opts.maxW / m); x = 0; y = 0; } }
  if (opts.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(str, x + 0, y + size * 0.07); }
  const sw = opts.stroke === undefined ? size * 0.16 : opts.stroke;
  if (sw > 0) { ctx.lineWidth = sw; ctx.strokeStyle = opts.strokeColor || OUT; ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
  ctx.restore();
}

// emoji / plain text
function plainText(ctx, str, x, y, size, color = '#111', opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 600} ${size}px ${opts.font || 'Inter, "Noto Color Emoji"'}`;
  ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.baseline || 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}

// starburst / speed lines background
function speedLines(ctx, cx, cy, t, c1, c2, n = 28, rot = 0.25) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * rot);
  ctx.fillStyle = c1; ctx.fillRect(-2000, -2000, 4000, 4000);
  ctx.fillStyle = c2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 2000, Math.sin(a) * 2000); ctx.lineTo(Math.cos(a + TAU / n / 2) * 2000, Math.sin(a + TAU / n / 2) * 2000);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// soft cartoon cloud puff
function puff(ctx, x, y, s, fill, stroke = null, lw = 4) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(-26, 6, 22, 0, TAU); ctx.arc(0, -10, 28, 0, TAU); ctx.arc(28, 4, 22, 0, TAU); ctx.arc(4, 14, 22, 0, TAU);
  if (stroke) { ctx.lineWidth = lw / s; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}

// green stink: wavy lines + little clouds around a point
function stink(ctx, x, y, t, level = 1, spread = 1) {
  if (level <= 0.01) return;
  ctx.save(); ctx.globalAlpha = clamp(level);
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.6 + i * 0.27) % 1;
    const xx = x + (i - 1.5) * 52 * spread + Math.sin(t * 2 + i) * 6;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const yy = y - ph * 120 - k * 9;
      const ox = Math.sin(k * 0.9 + t * 6 + i) * 9;
      k ? ctx.lineTo(xx + ox, yy) : ctx.moveTo(xx + ox, yy);
    }
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(110,190,60,${0.9 * (1 - ph)})`; ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3) % 1;
    const px = x + Math.sin(i * 2.1 + t) * 90 * spread, py = y - 40 - ph * 150;
    ctx.globalAlpha = clamp(level) * Math.sin(ph * Math.PI) * 0.9;
    puff(ctx, px, py, 0.55 + ph * 0.5, '#8fd16a', '#4f8f2f', 4);
  }
  ctx.restore();
}

// a cartoon fly orbiting a point
function fly(ctx, cx, cy, t, seed, r = 70) {
  const a = t * (2.2 + hash(seed) * 1.5) + seed * 2;
  const x = cx + Math.sin(a) * r * (0.8 + hash(seed + 1) * 0.6), y = cy + Math.sin(a * 2 + seed) * r * 0.45;
  ctx.save(); ctx.translate(x, y);
  const flap = Math.sin(t * 90 + seed) * 0.5 + 0.5;
  ctx.fillStyle = 'rgba(220,235,255,0.85)'; ctx.strokeStyle = 'rgba(40,40,60,0.6)'; ctx.lineWidth = 1.5;
  ell(ctx, -5, -6, 6, 3 + flap * 3, -0.6); ctx.fill(); ctx.stroke();
  ell(ctx, 5, -6, 6, 3 + flap * 3, 0.6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1b1b22'; ell(ctx, 0, 0, 6, 5); ctx.fill();
  ctx.restore();
}

// sparkle star
function sparkle(ctx, x, y, s, a = 1, col = '#fff7b0') {
  if (s <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 22; const an = (i / 8) * TAU; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2.5 / s; ctx.strokeStyle = '#e0a400'; ctx.stroke();
  ctx.restore();
}

// sweat drop
function sweat(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(11, 2, 0, 9); ctx.quadraticCurveTo(-11, 2, 0, -16);
  ctx.fillStyle = '#8fd8ff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#2d7fb8'; ctx.stroke();
  ctx.fillStyle = '#fff'; ell(ctx, -3, 0, 2.5, 4); ctx.fill();
  ctx.restore();
}

// comic speech bubble with tail pointing to (tx,ty)
function bubble(ctx, x, y, w, h, tx, ty, s = 1, fill = '#fff') {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const bx = -w / 2, by = -h / 2;
  rr(ctx, bx, by, w, h, 26);
  const lx = (tx - x) / s, ly = (ty - y) / s;
  ctx.moveTo(-18, h / 2 - 2); ctx.lineTo(lx, ly); ctx.lineTo(16, h / 2 - 2);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
  rr(ctx, bx + 3, by + 3, w - 6, h - 6, 24); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}

// rubber stamp text
function stamp(ctx, str, x, y, size, t, t0, color = '#e23b3b', rot = -0.18) {
  if (t < t0) return;
  const k = P(t, t0, 0.16);
  const sc = lerp(2.6, 1, E.out(k));
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = clamp(k * 1.6);
  ctx.font = `${size}px "Anton"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(str).width + size * 0.6, h = size * 1.35;
  rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = color; ctx.stroke();
  rr(ctx, -w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 6); ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = color; ctx.fillText(str, 0, 3);
  ctx.restore();
}

// tiny cartoon poop icon (used in HUD + gags). Silly, not gross.
function poopIcon(ctx, x, y, s, face = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const layers = [[0, 10, 30, 13], [0, -6, 23, 11], [0, -19, 15, 9]];
  for (const [lx, ly, rx, ry] of layers) { ell(ctx, lx, ly, rx, ry); ctx.fillStyle = '#9b5b2e'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#4a2a12'; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -27); ctx.quadraticCurveTo(10, -38, 4, -42); ctx.lineWidth = 3.5; ctx.strokeStyle = '#4a2a12'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -10, 6, 7, 3, -0.3); ctx.fill();
  if (face) {
    ctx.fillStyle = '#fff'; circle(ctx, -8, -4, 5); ctx.fill(); circle(ctx, 8, -4, 5); ctx.fill();
    ctx.fillStyle = '#111'; circle(ctx, -7, -3, 2.4); ctx.fill(); circle(ctx, 9, -3, 2.4); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 6, 7, 0.15, Math.PI - 0.15); ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a160a'; ctx.stroke();
  }
  ctx.restore();
}

// cartoon toilet (for thought bubbles, signs)
function toiletIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(ctx, 6, -70, 40, 50, 6); fillStroke(ctx, '#f4f7fb', OUT, 4);
  rr(ctx, -40, -24, 76, 16, 8); fillStroke(ctx, '#f4f7fb', OUT, 4);
  ctx.beginPath(); ctx.moveTo(-38, -8); ctx.quadraticCurveTo(-34, 22, -8, 26); ctx.lineTo(-14, 44); ctx.lineTo(20, 44); ctx.lineTo(18, 24); ctx.quadraticCurveTo(34, 14, 34, -8); ctx.closePath();
  fillStroke(ctx, '#f4f7fb', OUT, 4);
  ctx.restore();
}
