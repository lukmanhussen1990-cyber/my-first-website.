// Generic (unbranded) group-chat phone UI drawn to a canvas, fully time-driven. Also the low-poly family avatars.
import { T, MESSAGE, typedCount, keyTimes } from './times.js';
import { clamp, lerp, sat, prog, ease, pop, impulse, TAU, mulberry32, spring } from './util.js';

export const UI = { W: 360, H: 774, CW: 1080, CH: 2322 };
const F = (w, s) => `${w} ${s}px Nunito, "Noto Color Emoji", sans-serif`;
const GREEN = '#22b964', GREEN_D = '#119a4e', INK = '#1d2433', MUTE = '#7b8598';

function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function poly(c, pts, fill) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); }
export function heart(c, x, y, s, col = '#f0354b') {
  c.save(); c.translate(x, y); c.scale(s, s); c.beginPath(); c.moveTo(0, 0.38); c.bezierCurveTo(-0.62, -0.02, -0.5, -0.5, -0.24, -0.5); c.bezierCurveTo(-0.1, -0.5, 0, -0.4, 0, -0.28); c.bezierCurveTo(0, -0.4, 0.1, -0.5, 0.24, -0.5); c.bezierCurveTo(0.5, -0.5, 0.62, -0.02, 0, 0.38); c.closePath();
  const g = c.createLinearGradient(0, -0.5, 0, 0.4); g.addColorStop(0, '#ff5b6e'); g.addColorStop(1, col); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-0.22, -0.3, 0.09, 0.06, -0.6, 0, TAU); c.fill(); c.restore();
}
function sparkle(c, x, y, s, a, col = '#ffd84d') { if (a <= 0) return; c.save(); c.globalAlpha *= a; c.translate(x, y); c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s; const an = i / 8 * TAU; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); c.fill(); c.restore(); }

// ------------------------------------------------------------------ avatars (low-poly portraits)
const AV = {
  mom: { bg: ['#f9b9c8', '#f39ab0', '#fbd0da'], skin: ['#eab892', '#d9a27c'], shirt: '#2a9d8f', hair: ['#a7adb8', '#8e949f'] },
  dad: { bg: ['#a9c6f2', '#86abe6', '#c5d9f7'], skin: ['#dba57c', '#c78f66'], shirt: '#39425c', hair: ['#3a302a', '#2a221d'] },
  uncle: { bg: ['#f6d98a', '#eec564', '#fae6ac'], skin: ['#e2ad84', '#cf986e'], shirt: '#c8553d', hair: ['#4a3b30', '#3a2d24'] },
  grandma: { bg: ['#cdb6ef', '#b79be6', '#e0d0f6'], skin: ['#ecc3a2', '#dcae8b'], shirt: '#7c5cad', hair: ['#f6f6f8', '#dcdde4'] },
  you: { bg: ['#9be0c0', '#72cfa6', '#bdeed8'], skin: ['#edb48e', '#d99f78'], shirt: '#2f6fe0', hair: ['#5a371c', '#472a14'] },
};
export const NAMES = { mom: 'Mom', dad: 'Dad', uncle: 'Uncle', grandma: 'Grandma' };
export const NAME_COL = { mom: '#d6336c', dad: '#1c6dd0', uncle: '#c26a00', grandma: '#7b4bc9' };

export function drawAvatar(c, who, cx, cy, r, o = {}) {
  const A = AV[who]; const shock = o.shock || 0, crack = o.crack || 0, happy = o.happy || 0;
  c.save(); c.translate(cx, cy); c.scale(r, r);
  c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.clip();
  // faceted background
  poly(c, [[-1, -1], [1, -1], [1, 1], [-1, 1]], A.bg[0]); poly(c, [[-1, -1], [0.3, -1], [-1, 0.6]], A.bg[2]); poly(c, [[1, -0.2], [1, 1], [-0.1, 1]], A.bg[1]);
  const jy = -shock * 0.05; c.translate(0, jy);
  // shoulders
  poly(c, [[-0.95, 1.1], [-0.72, 0.68], [-0.2, 0.52], [0.2, 0.52], [0.72, 0.68], [0.95, 1.1]], A.shirt); poly(c, [[0, 0.52], [0.2, 0.52], [0.72, 0.68], [0.95, 1.1], [0, 1.1]], 'rgba(0,0,0,0.13)');
  if (who === 'grandma') { poly(c, [[-0.2, 0.52], [0, 0.82], [0.2, 0.52]], '#f1e4ff'); }
  if (who === 'dad') { poly(c, [[-0.2, 0.52], [0, 0.78], [0.2, 0.52]], '#eef1f6'); poly(c, [[-0.05, 0.6], [0, 0.95], [0.05, 0.6]], '#b23a48'); }
  // neck
  poly(c, [[-0.16, 0.3], [0.16, 0.3], [0.2, 0.56], [0, 0.66], [-0.2, 0.56]], A.skin[1]);
  // hair back
  if (who === 'mom') { poly(c, [[-0.2, -0.86], [0, -1.0], [0.2, -0.86], [0.24, -0.66], [0, -0.56], [-0.24, -0.66]], A.hair[1]); poly(c, [[-0.2, -0.86], [0, -1.0], [0, -0.56], [-0.24, -0.66]], A.hair[0]); }
  if (who === 'grandma') { for (const [x, y, s] of [[-0.42, -0.42, 0.24], [-0.22, -0.62, 0.26], [0.05, -0.68, 0.27], [0.3, -0.58, 0.25], [0.46, -0.36, 0.22], [-0.52, -0.12, 0.2], [0.54, -0.1, 0.2]]) { c.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + x * 3; c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } c.closePath(); c.fillStyle = (x + y) * 10 % 2 > 0.6 ? A.hair[0] : A.hair[1]; c.fill(); } }
  // ears
  for (const s of [-1, 1]) poly(c, [[s * 0.4, -0.12], [s * 0.5, -0.1], [s * 0.52, 0.08], [s * 0.42, 0.14]], A.skin[1]);
  if (who === 'mom') for (const s of [-1, 1]) { c.fillStyle = '#ffd84d'; c.beginPath(); c.arc(s * 0.47, 0.2, 0.045, 0, TAU); c.fill(); }
  // head (faceted two-tone)
  const jaw = shock * 0.07;
  const headPts = [[-0.3, -0.5], [0.3, -0.5], [0.43, -0.25], [0.42, 0.1], [0.3, 0.36 + jaw], [0.1, 0.5 + jaw], [-0.1, 0.5 + jaw], [-0.3, 0.36 + jaw], [-0.42, 0.1], [-0.43, -0.25]];
  poly(c, headPts, A.skin[0]); poly(c, [[0, -0.5], [0.3, -0.5], [0.43, -0.25], [0.42, 0.1], [0.3, 0.36 + jaw], [0.1, 0.5 + jaw], [0, 0.5 + jaw], [0.06, 0.1]], A.skin[1]);
  poly(c, [[-0.3, 0.36 + jaw], [-0.1, 0.5 + jaw], [0.1, 0.5 + jaw], [0, 0.3 + jaw]], 'rgba(0,0,0,0.06)');
  // hair front
  if (who === 'mom') { poly(c, [[-0.45, -0.2], [-0.4, -0.5], [-0.2, -0.62], [0.2, -0.62], [0.4, -0.5], [0.45, -0.2], [0.34, -0.36], [0.05, -0.44], [-0.2, -0.36], [-0.36, -0.2]], A.hair[0]); poly(c, [[0.05, -0.44], [0.2, -0.62], [0.4, -0.5], [0.45, -0.2], [0.34, -0.36]], A.hair[1]); }
  if (who === 'dad') { poly(c, [[-0.46, -0.1], [-0.44, -0.46], [-0.22, -0.62], [0.24, -0.62], [0.44, -0.46], [0.46, -0.1], [0.36, -0.3], [0.2, -0.4], [-0.24, -0.4], [-0.36, -0.3]], A.hair[0]); poly(c, [[-0.46, -0.1], [-0.44, -0.4], [-0.36, -0.3]], '#8d8d95'); poly(c, [[0.46, -0.1], [0.44, -0.4], [0.36, -0.3]], '#8d8d95'); }
  if (who === 'uncle') { poly(c, [[-0.47, 0.0], [-0.46, -0.3], [-0.38, -0.24], [-0.4, 0.0]], A.hair[0]); poly(c, [[0.47, 0.0], [0.46, -0.3], [0.38, -0.24], [0.4, 0.0]], A.hair[1]); poly(c, [[-0.2, -0.46], [-0.02, -0.48], [-0.12, -0.34]], 'rgba(255,255,255,0.35)'); }
  if (who === 'grandma') { poly(c, [[-0.44, -0.22], [-0.3, -0.5], [0.3, -0.5], [0.44, -0.22], [0.25, -0.4], [0, -0.36], [-0.25, -0.4]], A.hair[0]); }
  if (who === 'you') { poly(c, [[-0.46, -0.16], [-0.42, -0.5], [-0.2, -0.7], [0.1, -0.74], [0.4, -0.56], [0.46, -0.16], [0.36, -0.36], [0.1, -0.3], [-0.1, -0.42], [-0.36, -0.3]], A.hair[0]); }
  // wrinkles
  if (who === 'grandma') { c.strokeStyle = 'rgba(120,70,50,0.35)'; c.lineWidth = 0.02; c.beginPath(); c.moveTo(-0.15, -0.3); c.lineTo(0.15, -0.3); c.moveTo(-0.3, 0.22); c.lineTo(-0.24, 0.3); c.moveTo(0.3, 0.22); c.lineTo(0.24, 0.3); c.stroke(); }
  // eyes
  const ey = -0.08, ex = 0.19; const big = 1 + shock * 0.9;
  for (const s of [-1, 1]) {
    if (shock > 0.05) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(s * ex, ey, 0.085 * big, 0.1 * big, 0, 0, TAU); c.fill(); c.fillStyle = '#16161c'; c.beginPath(); c.arc(s * ex, ey + 0.01, 0.04 + 0.01 * (1 - shock), 0, TAU); c.fill(); }
    else if (happy > 0.5 || who === 'mom' || who === 'grandma') { c.strokeStyle = '#16161c'; c.lineWidth = 0.04; c.lineCap = 'round'; c.beginPath(); c.arc(s * ex, ey + 0.04, 0.07, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else { c.fillStyle = '#16161c'; rr(c, s * ex - 0.045, ey - 0.06, 0.09, 0.12, 0.02); c.fill(); }
  }
  // brows
  c.strokeStyle = who === 'grandma' ? '#b9b9c2' : who === 'mom' ? '#7d828c' : A.hair[1]; c.lineWidth = who === 'dad' ? 0.06 : 0.04; c.lineCap = 'round';
  const by = ey - 0.15 - shock * 0.12; const ba = who === 'dad' ? 0.05 * (1 - shock) : -0.02;
  c.beginPath(); c.moveTo(-ex - 0.09, by - ba); c.lineTo(-ex + 0.09, by + ba); c.moveTo(ex - 0.09, by + ba); c.lineTo(ex + 0.09, by - ba); c.stroke();
  // nose
  poly(c, [[0, -0.04], [0.09, 0.14], [-0.02, 0.16]], 'rgba(110,55,30,0.28)');
  // glasses
  if (who === 'uncle' || who === 'grandma') {
    c.strokeStyle = who === 'grandma' ? '#b3456f' : '#22252e'; c.lineWidth = 0.035; const gr = who === 'grandma' ? 0.17 : 0.13;
    for (const s of [-1, 1]) { c.fillStyle = 'rgba(255,255,255,0.22)'; if (who === 'grandma') { c.beginPath(); c.arc(s * ex, ey, gr, 0, TAU); c.fill(); c.stroke(); } else { rr(c, s * ex - gr, ey - gr * 0.8, gr * 2, gr * 1.6, 0.04); c.fill(); c.stroke(); } }
    c.beginPath(); c.moveTo(-ex + gr, ey); c.lineTo(ex - gr, ey); c.moveTo(-ex - gr, ey); c.lineTo(-0.46, ey - 0.04); c.moveTo(ex + gr, ey); c.lineTo(0.46, ey - 0.04); c.stroke();
    if (crack > 0.01) {
      c.save(); c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 0.022; c.lineJoin = 'miter'; const k = sat(crack);
      const lines = [[[0.19, -0.08], [0.25, -0.16], [0.22, -0.2], [0.3, -0.24]], [[0.19, -0.08], [0.1, -0.02], [0.07, 0.04]], [[0.19, -0.08], [0.24, 0.0], [0.33, 0.03]], [[0.19, -0.08], [0.12, -0.17], [0.13, -0.23]], [[-0.19, -0.08], [-0.27, -0.01], [-0.3, 0.06]], [[-0.19, -0.08], [-0.13, -0.18]], [[-0.19, -0.08], [-0.1, -0.04]]];
      for (const L of lines) { c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i < L.length; i++) { const kk = sat(k * L.length - (i - 1)); c.lineTo(lerp(L[i - 1][0], L[i][0], kk), lerp(L[i - 1][1], L[i][1], kk)); if (kk < 1) break; } c.stroke(); }
      c.strokeStyle = 'rgba(40,40,60,0.5)'; c.lineWidth = 0.008; for (const L of lines) { c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0] + 0.012, p[1] + 0.012) : c.moveTo(p[0] + 0.012, p[1] + 0.012)); c.stroke(); }
      c.restore();
    }
  }
  // mouth
  const my = 0.29;
  if (who === 'dad') { poly(c, [[-0.2, my - 0.02 + jaw * 0.3], [-0.1, my - 0.11], [0, my - 0.08], [0.1, my - 0.11], [0.2, my - 0.02 + jaw * 0.3], [0.08, my - 0.01], [0, my - 0.03], [-0.08, my - 0.01]], A.hair[0]); }
  if (shock > 0.05) { c.fillStyle = '#3a1418'; c.beginPath(); c.ellipse(0, my + 0.04 + jaw * 0.6, 0.07 + shock * 0.03, 0.03 + shock * 0.09, 0, 0, TAU); c.fill(); }
  else if (who === 'dad') { c.strokeStyle = '#5a2c22'; c.lineWidth = 0.035; c.beginPath(); c.moveTo(-0.08, my + 0.05); c.lineTo(0.08, my + 0.05); c.stroke(); }
  else { c.strokeStyle = '#7a2d2a'; c.lineWidth = 0.04; c.lineCap = 'round'; c.beginPath(); c.arc(0, my - 0.06, 0.13, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
  if (who === 'mom') { c.fillStyle = 'rgba(240,90,110,0.35)'; c.beginPath(); c.arc(-0.29, 0.14, 0.06, 0, TAU); c.arc(0.29, 0.14, 0.06, 0, TAU); c.fill(); }
  c.restore();
  // ring
  c.lineWidth = r * 0.07; c.strokeStyle = o.ring || '#ffffff'; c.beginPath(); c.arc(cx, cy, r * 0.965, 0, TAU); c.stroke();
}

// ------------------------------------------------------------------ chat screen
const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEYS = keyTimes;
let _keys = null;

function wrapText(c, text, maxW) { const out = []; for (const para of text.split('\n')) { let line = ''; for (const w of para.split(' ')) { const tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > maxW && line) { out.push(line); line = w; } else line = tt; } out.push(line); } return out; }

export function createUI() {
  const canvas = document.createElement('canvas'); canvas.width = UI.CW; canvas.height = UI.CH; const c = canvas.getContext('2d');
  const R = {};   // layout rects (dp) exported for camera/thumb targeting
  const wallpaper = document.createElement('canvas'); wallpaper.width = 360; wallpaper.height = 774;
  { const w = wallpaper.getContext('2d'); w.fillStyle = '#e9e4da'; w.fillRect(0, 0, 360, 774); const rnd = mulberry32(9); w.globalAlpha = 0.5; for (let i = 0; i < 90; i++) { const x = rnd() * 360, y = rnd() * 774, k = Math.floor(rnd() * 4); w.strokeStyle = '#d6cfc1'; w.fillStyle = '#d9d2c5'; w.lineWidth = 1.4; w.beginPath(); if (k === 0) w.arc(x, y, 5 + rnd() * 4, 0, TAU); else if (k === 1) { w.moveTo(x - 6, y); w.lineTo(x + 6, y); w.moveTo(x, y - 6); w.lineTo(x, y + 6); } else if (k === 2) { w.moveTo(x - 6, y + 5); w.lineTo(x, y - 6); w.lineTo(x + 6, y + 5); w.closePath(); } else { w.rect(x - 4, y - 4, 8, 8); } w.stroke(); } }

  function draw(t, roi) {
    if (!_keys) _keys = KEYS();
    const sx = UI.CW / roi.w, sy = UI.CH / roi.h;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, UI.CW, UI.CH);
    c.setTransform(sx, 0, 0, sy, -roi.x * sx, -roi.y * sy);
    c.save(); rr(c, 0, 0, UI.W, UI.H, 30); c.clip();
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';

    // ---- geometry of fixed chrome
    const kbK = t < T.S3 - 0.3 ? 1 : 1 - ease.inOut(prog(t, T.KB_HIDE, T.KB_HIDE + 0.4));
    const kbH = 262 * kbK; const inputH = 56; const inputY = UI.H - kbH - inputH - (1 - kbK) * 14; const headH = 96;
    c.drawImage(wallpaper, 0, 0);

    // ---- messages layout (bottom anchored)
    const typed = t < T.SEND ? MESSAGE.slice(0, typedCount(t)) : '';
    const msgs = [
      { who: 'mom', text: 'Sunday lunch at home. Everyone come!', time: '7:12 PM', t0: -9 },
      { who: 'grandma', text: 'God bless you all 🙏', time: '7:15 PM', t0: -9 },
      { who: 'dad', text: 'Ok.', time: '7:31 PM', t0: -9 },
      { who: 'uncle', text: '👍', time: '7:40 PM', t0: -9 },
      { sys: 'TODAY', t0: -9 },
      { me: true, text: MESSAGE, time: '2:47 AM', t0: T.SEND, id: 'mine' },
      { seen: true, t0: T.SEEN, id: 'seen' },
      { sys: 'Grandma left', t0: T.LEFT, id: 'left', big: true },
      { who: 'mom', text: 'Thank you beta ♥\nYour father never says that.', time: '2:49 AM', t0: T.MOM_REPLY, id: 'reply' },
    ];
    const typingWho = [];
    if (t >= T.MOM_TYPING && t < T.MOM_REPLY) typingWho.push({ who: 'mom', t0: T.MOM_TYPING });
    if ((t >= T.DAD_TYPING && t < T.DAD_STOP) || t >= T.DAD_AGAIN) typingWho.push({ who: 'dad', t0: t >= T.DAD_AGAIN ? T.DAD_AGAIN : T.DAD_TYPING });
    // measure
    const maxBW = 250;
    for (const m of msgs) {
      m.k = m.t0 < 0 ? 1 : ease.outQuint(prog(t, m.t0, m.t0 + 0.32)); m.vis = t >= m.t0;
      if (m.sys) { m.h = m.big ? 40 : 30; }
      else if (m.seen) { m.h = 132; }
      else { c.font = F(600, 16); m.lines = wrapText(c, m.text, maxBW - 24); m.tw = Math.max(...m.lines.map((l) => c.measureText(l).width)); m.bw = Math.max(m.tw + 24, m.me ? 96 : 92); m.bh = (m.me ? 10 : 28) + m.lines.length * 21 + 20; m.h = m.bh + 8; }
    }
    let y = inputY - 10;
    for (const tw of typingWho) { tw.k = ease.outQuint(prog(t, tw.t0, tw.t0 + 0.3)); y -= 46 * tw.k; tw.y = y; }
    for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (!m.vis) continue; y -= m.h * m.k; m.y = y; }

    // ---- draw messages
    c.save(); c.beginPath(); c.rect(0, headH, UI.W, inputY - headH); c.clip();
    for (const m of msgs) {
      if (!m.vis) continue;
      if (m.sys) {
        c.font = F(800, m.big ? 13.5 : 11.5); const w = c.measureText(m.sys).width + (m.big ? 56 : 24); const hh = m.big ? 30 : 22;
        const slide = m.big ? (1 - ease.outBack(prog(t, m.t0, m.t0 + 0.42), 1.4)) * -260 : 0; const x = (UI.W - w) / 2 + slide;
        c.globalAlpha = m.big ? sat(m.k * 2) : 1; c.fillStyle = m.big ? 'rgba(50,56,74,0.92)' : 'rgba(255,255,255,0.85)'; rr(c, x, m.y + 4, w, hh, hh / 2); c.fill();
        c.fillStyle = m.big ? '#fff' : MUTE; c.textAlign = 'center'; c.fillText(m.sys, UI.W / 2 + slide + (m.big ? 11 : 0), m.y + 4 + hh / 2 + (m.big ? 4.8 : 4)); c.textAlign = 'left';
        if (m.big) { drawAvatar(c, 'grandma', x + 17, m.y + 4 + hh / 2, 11, { shock: 1, crack: 1 }); R.left = { x, y: m.y + 4, w, h: hh }; }
        c.globalAlpha = 1; continue;
      }
      if (m.seen) {
        const cw = 268, ch = 120, x = UI.W - 12 - cw, yy = m.y + 4; const a = pop(t, m.t0, 0.3);
        c.save(); c.translate(x + cw, yy); c.scale(a, a); c.translate(-(x + cw), -yy);
        c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 14 * sx / 3; c.shadowOffsetY = 3 * sy; c.fillStyle = '#ffffff'; rr(c, x, yy, cw, ch, 18); c.fill(); c.shadowColor = 'transparent';
        c.font = F(800, 13); c.fillStyle = '#2f8ef0'; c.fillText('✓✓', x + 14, yy + 22); c.fillStyle = MUTE; c.fillText('Seen by', x + 38, yy + 22);
        const who = [['dad', T.SEEN_DAD], ['uncle', T.SEEN_UNCLE], ['grandma', T.SEEN_GRANDMA]];
        who.forEach(([w, tt], i) => {
          const ax = x + 50 + i * 84, ay = yy + 66; R['seen_' + w] = { x: ax, y: ay };
          c.strokeStyle = '#dfe3ea'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.arc(ax, ay, 27, 0, TAU); c.stroke(); c.setLineDash([]);
          if (t >= tt) {
            const s = spring(t - tt, 3.2, 9) ; const sh = impulse(t, tt, 0.02, 0.35); const jx = Math.sin((t - tt) * 70) * 3.2 * sh;
            const shock = sat(prog(t, tt + 0.1, tt + 0.28)); const crack = w === 'grandma' ? prog(t, tt + 0.22, tt + 0.5) : 0;
            c.save(); c.translate(ax + jx, ay - sh * 6); c.scale(s, s); drawAvatar(c, w, 0, 0, 30, { shock, crack }); c.restore();
            // pop ring
            const rk = prog(t, tt, tt + 0.4); if (rk < 1) { c.strokeStyle = `rgba(47,142,240,${(1 - rk) * 0.8})`; c.lineWidth = 3 * (1 - rk); c.beginPath(); c.arc(ax, ay, 30 + rk * 22, 0, TAU); c.stroke(); }
            c.font = F(800, 12.5); c.fillStyle = INK; c.textAlign = 'center'; c.globalAlpha = sat((t - tt) * 6); c.fillText(NAMES[w], ax, ay + 47); c.globalAlpha = 1; c.textAlign = 'left';
            if (shock > 0.2) { const ek = pop(t, tt + 0.16, 0.3); c.font = F(900, 17); c.fillStyle = '#f0354b'; c.textAlign = 'center'; c.save(); c.translate(ax + 24, ay - 24); c.rotate(0.25); c.scale(ek, ek); c.fillText(w === 'grandma' ? '!!!' : w === 'uncle' ? '?!' : '!', 0, 5); c.restore(); c.textAlign = 'left'; }
          }
        });
        c.restore(); R.seen = { x, y: yy, w: cw, h: ch }; continue;
      }
      const bw = m.bw, bh = m.bh;
      if (m.me) {
        // send flight: from the input field up into place
        const fl = ease.outBack(prog(t, m.t0, m.t0 + 0.3), 1.9); const x1 = UI.W - 12 - bw, y1 = m.y + 4; const x0 = 54, y0 = inputY + 8;
        const x = lerp(x0, x1, fl), yy = lerp(y0, y1, fl); const st = 1 + Math.sin(sat(prog(t, m.t0, m.t0 + 0.3)) * Math.PI) * 0.25;
        R.mine = { x: x1, y: y1, w: bw, h: bh };
        if (fl < 1) { for (let i = 1; i <= 4; i++) { const f2 = ease.outBack(prog(t - i * 0.016, m.t0, m.t0 + 0.3), 1.9); c.globalAlpha = 0.1; c.fillStyle = GREEN; rr(c, lerp(x0, x1, f2), lerp(y0, y1, f2), bw, bh, 17); c.fill(); } c.globalAlpha = 1; }
        const menuK = menuAmt(t); const hl = menuK;
        c.save(); c.translate(x + bw / 2, yy + bh / 2); c.scale(1 / Math.sqrt(st), st); c.translate(-(x + bw / 2), -(yy + bh / 2));
        c.shadowColor = 'rgba(0,0,0,0.16)'; c.shadowBlur = 5 * sx / 3; c.shadowOffsetY = 1.5 * sy;
        const g = c.createLinearGradient(0, yy, 0, yy + bh); g.addColorStop(0, '#2ccb72'); g.addColorStop(1, GREEN_D); c.fillStyle = g; rr(c, x, yy, bw, bh, 17); c.fill(); c.shadowColor = 'transparent';
        c.beginPath(); c.moveTo(x + bw - 8, yy + bh - 14); c.quadraticCurveTo(x + bw + 2, yy + bh - 4, x + bw + 9, yy + bh); c.quadraticCurveTo(x + bw - 4, yy + bh + 1, x + bw - 14, yy + bh - 4); c.fillStyle = GREEN_D; c.fill();
        c.font = F(700, 16); c.fillStyle = '#fff'; m.lines.forEach((l, i) => c.fillText(l, x + 12, yy + 24 + i * 21));
        c.font = F(700, 10.5); c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'right'; const seenAll = t > T.SEEN; c.fillText(m.time, x + bw - 30, yy + bh - 8);
        c.fillStyle = seenAll ? '#bfe4ff' : 'rgba(255,255,255,0.85)'; c.font = F(900, 11); c.fillText(t > m.t0 + 0.55 ? '✓✓' : '✓', x + bw - 10, yy + bh - 8); c.textAlign = 'left';
        c.restore();
        continue;
      }
      // incoming
      const a = m.t0 < 0 ? 1 : pop(t, m.t0, 0.34); const x = 50, yy = m.y + 4;
      c.save(); c.translate(x, yy + bh); c.scale(a, a); c.translate(-x, -(yy + bh));
      drawAvatar(c, m.who, 28, yy + bh - 16, 16, { happy: m.id === 'reply' ? 1 : 0 });
      c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 4 * sx / 3; c.shadowOffsetY = 1.2 * sy; c.fillStyle = '#fff'; rr(c, x, yy, bw, bh, 17); c.fill(); c.shadowColor = 'transparent';
      c.beginPath(); c.moveTo(x + 8, yy + bh - 14); c.quadraticCurveTo(x - 2, yy + bh - 4, x - 9, yy + bh); c.quadraticCurveTo(x + 4, yy + bh + 1, x + 14, yy + bh - 4); c.fillStyle = '#fff'; c.fill();
      c.font = F(800, 12.5); c.fillStyle = NAME_COL[m.who]; c.fillText(NAMES[m.who], x + 12, yy + 19);
      c.font = F(600, 16); c.fillStyle = INK;
      m.lines.forEach((l, i) => { const hi = l.indexOf('♥'); if (hi >= 0) { const pre = l.slice(0, hi); c.fillText(pre, x + 12, yy + 40 + i * 21); const hx = x + 12 + c.measureText(pre).width + 9; const beat = 1 + 0.18 * Math.max(0, Math.sin((t - m.t0) * 7)) * sat(1.5 - (t - m.t0) * 0.5); heart(c, hx, yy + 35 + i * 21, 17 * beat * pop(t, m.t0 + 0.2, 0.3)); } else c.fillText(l, x + 12, yy + 40 + i * 21); });
      c.font = F(700, 10.5); c.fillStyle = MUTE; c.textAlign = 'right'; c.fillText(m.time, x + bw - 10, yy + bh - 8); c.textAlign = 'left';
      c.restore();
      if (m.id === 'reply') {
        R.reply = { x, y: yy, w: bw, h: bh };
        const rnd = mulberry32(31);
        for (let i = 0; i < 12; i++) { const ang = rnd() * TAU, d0 = 20 + rnd() * 30, dl = rnd() * 0.5, life = 0.9 + rnd() * 0.8; const u = (t - m.t0 - dl) / life; if (u <= 0 || u >= 1) continue; const px = x + bw / 2 + Math.cos(ang) * (bw / 2 + d0 * (0.4 + u)), py = yy + bh / 2 + Math.sin(ang) * (bh / 2 + d0 * (0.4 + u)) - u * 18; const al = Math.sin(u * Math.PI); if (i % 3 === 0) { c.globalAlpha = al; heart(c, px, py, 10 + rnd() * 6); c.globalAlpha = 1; } else sparkle(c, px, py, 5 + rnd() * 5, al, i % 2 ? '#ffd84d' : '#ff9ec4'); }
      }
    }
    // typing indicators
    for (const tw of typingWho) {
      const yy = tw.y + 2, x = 50; const a = pop(t, tw.t0, 0.3);
      c.save(); c.translate(x, yy + 38); c.scale(a, a); c.translate(-x, -(yy + 38));
      drawAvatar(c, tw.who, 28, yy + 22, 16); c.fillStyle = tw.who === 'dad' ? '#3a4054' : '#fff'; c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 4 * sx / 3; rr(c, x, yy, 66, 38, 19); c.fill(); c.shadowColor = 'transparent';
      for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin((t - tw.t0) * 6 - i * 0.9)); c.fillStyle = tw.who === 'dad' ? `rgba(255,255,255,${0.5 + b * 0.5})` : `rgba(120,130,150,${0.5 + b * 0.5})`; c.beginPath(); c.arc(x + 19 + i * 14, yy + 20 - b * 5, 4.3, 0, TAU); c.fill(); }
      c.restore(); R['typing_' + tw.who] = { x, y: yy, w: 66, h: 38 };
    }
    c.restore();

    // ---- context menu (delete attempt)
    const mk = menuAmt(t);
    if (mk > 0.001 && R.mine) {
      c.fillStyle = `rgba(10,14,24,${0.42 * mk})`; c.fillRect(0, 0, UI.W, UI.H);
      // re-draw highlighted bubble on top
      const b = R.mine; c.save(); const g = c.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#2ccb72'); g.addColorStop(1, GREEN_D); c.fillStyle = g; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 16 * sx / 3; rr(c, b.x, b.y, b.w, b.h, 17); c.fill(); c.shadowColor = 'transparent';
      c.font = F(700, 16); c.fillStyle = '#fff'; c.fillText(MESSAGE, b.x + 12, b.y + 24); c.font = F(700, 10.5); c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'right'; c.fillText('2:47 AM  ✓✓', b.x + b.w - 10, b.y + b.h - 8); c.textAlign = 'left'; c.restore();
      const items = ['Reply', 'Forward', 'Copy', 'Pin', 'Delete']; const mw = 196, rowH = 46, mh = items.length * rowH + 10; const mx = UI.W - 14 - mw, my = b.y - mh - 10;
      c.save(); c.translate(mx + mw, my); const s = lerp(0.6, 1, ease.outBack(mk, 1.6)); c.scale(s, s); c.translate(-(mx + mw), -my); c.globalAlpha = sat(mk * 1.5);
      c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 22 * sx / 3; c.shadowOffsetY = 6 * sy; c.fillStyle = '#fff'; rr(c, mx, my, mw, mh, 18); c.fill(); c.shadowColor = 'transparent';
      const flashes = [[T.TAPS[0], 3], [T.TAPS[2], 2], [T.PIN, 3]]; const pinned = t > T.PIN + 0.06;
      items.forEach((it, i) => {
        const ry = my + 5 + i * rowH; const del = it === 'Delete';
        let fl = 0; for (const [ft, fi] of flashes) if (fi === i) fl = Math.max(fl, impulse(t, ft + 0.03, 0.02, 0.22));
        if (fl > 0.01) { c.fillStyle = `rgba(120,140,170,${0.28 * fl})`; rr(c, mx + 5, ry + 1, mw - 10, rowH - 2, 12); c.fill(); }
        if (del) { c.fillStyle = '#fff0f1'; rr(c, mx + 5, ry + 1, mw - 10, rowH - 2, 12); c.fill(); }
        if (i > 0) { c.fillStyle = '#eceef2'; c.fillRect(mx + 16, ry, mw - 32, 1); }
        const isPin = it === 'Pin' && pinned; if (isPin) { c.fillStyle = '#e4f0ff'; rr(c, mx + 5, ry + 1, mw - 10, rowH - 2, 12); c.fill(); }
        c.font = F(del || isPin ? 900 : 700, 16.5); c.fillStyle = del ? '#e5303f' : isPin ? '#1c6dd0' : INK; c.fillText(isPin ? 'Pinned ✓' : it, mx + 20, ry + rowH / 2 + 6);
        // icons
        const ix = mx + mw - 30, iy = ry + rowH / 2; c.strokeStyle = del ? '#e5303f' : '#5b6578'; c.fillStyle = c.strokeStyle; c.lineWidth = 1.9; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
        if (it === 'Reply') { c.moveTo(ix - 2, iy - 6); c.lineTo(ix - 8, iy); c.lineTo(ix - 2, iy + 6); c.moveTo(ix - 8, iy); c.lineTo(ix + 2, iy); c.quadraticCurveTo(ix + 8, iy, ix + 8, iy + 6); }
        else if (it === 'Forward') { c.moveTo(ix + 2, iy - 6); c.lineTo(ix + 8, iy); c.lineTo(ix + 2, iy + 6); c.moveTo(ix + 8, iy); c.lineTo(ix - 2, iy); c.quadraticCurveTo(ix - 8, iy, ix - 8, iy + 6); }
        else if (it === 'Copy') { c.rect(ix - 7, iy - 4, 10, 11); c.moveTo(ix - 3, iy - 7); c.lineTo(ix + 7, iy - 7); c.lineTo(ix + 7, iy + 4); }
        else if (it === 'Pin') { c.moveTo(ix - 5, iy - 7); c.lineTo(ix + 5, iy - 7); c.lineTo(ix + 3, iy); c.lineTo(ix + 7, iy + 3); c.lineTo(ix - 7, iy + 3); c.lineTo(ix - 3, iy); c.closePath(); c.moveTo(ix, iy + 3); c.lineTo(ix, iy + 9); }
        else { c.moveTo(ix - 7, iy - 5); c.lineTo(ix + 7, iy - 5); c.moveTo(ix - 3, iy - 5); c.lineTo(ix - 2, iy - 8); c.lineTo(ix + 2, iy - 8); c.lineTo(ix + 3, iy - 5); c.moveTo(ix - 5, iy - 5); c.lineTo(ix - 4, iy + 8); c.lineTo(ix + 4, iy + 8); c.lineTo(ix + 5, iy - 5); c.moveTo(ix - 1.5, iy - 1); c.lineTo(ix - 1.5, iy + 5); c.moveTo(ix + 1.5, iy - 1); c.lineTo(ix + 1.5, iy + 5); }
        c.stroke();
        if (del) R.del = { x: mx, y: ry, w: mw, h: rowH }; R['row' + i] = { x: mx, y: ry, w: mw, h: rowH };
      });
      c.restore(); R.menu = { x: mx, y: my, w: mw, h: mh };
      // tap ripples (missed taps)
      for (const tp of (R.taps || [])) { const u = prog(t, tp.t, tp.t + 0.45); if (u > 0 && u < 1) { c.strokeStyle = `rgba(255,255,255,${(1 - u) * 0.9})`; c.fillStyle = `rgba(90,110,150,${(1 - u) * 0.28})`; c.lineWidth = 2.5 * (1 - u); c.beginPath(); c.arc(tp.x, tp.y, 8 + ease.out(u) * 30, 0, TAU); c.fill(); c.stroke(); } }
      // "pinned" toast
      const pk = pop(t, T.PIN + 0.08, 0.3) * (1 - prog(t, T.MENU_OUT - 0.02, T.MENU_OUT + 0.2));
      if (pk > 0.01) { const tw2 = 176, tx = (UI.W - tw2) / 2, ty = b.y + b.h + 8; c.save(); c.translate(UI.W / 2, ty + 18); c.scale(pk, pk); c.translate(-UI.W / 2, -(ty + 18)); c.fillStyle = '#1d2433'; c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 12 * sx / 3; rr(c, tx, ty, tw2, 36, 18); c.fill(); c.shadowColor = 'transparent'; c.font = F(800, 13.5); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('📌  Pinned for everyone', UI.W / 2, ty + 23); c.textAlign = 'left'; c.restore(); }
    }

    // ---- header
    c.save(); c.shadowColor = 'rgba(0,0,0,0.14)'; c.shadowBlur = 8 * sx / 3; c.shadowOffsetY = 2 * sy; c.fillStyle = '#ffffff'; c.fillRect(0, 0, UI.W, headH); c.restore();
    c.fillStyle = INK; c.font = F(800, 13); c.fillText('2:47', 26, 24);
    // status icons
    for (let i = 0; i < 4; i++) { c.fillStyle = i < 3 ? INK : '#c3c8d2'; rr(c, 278 + i * 5.2, 23 - 3 - i * 2.2, 3.4, 4 + i * 2.2, 1); c.fill(); }
    c.strokeStyle = INK; c.lineWidth = 1.2; rr(c, 310, 13.5, 22, 11, 3.2); c.stroke(); c.fillStyle = '#e5303f'; rr(c, 312, 15.5, 5, 7, 1.5); c.fill(); c.fillStyle = INK; rr(c, 333, 17, 2, 4, 1); c.fill();
    // back chevron
    c.strokeStyle = GREEN_D; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(22, 54); c.lineTo(14, 63); c.lineTo(22, 72); c.stroke();
    // group avatar: 2x2 collage
    c.save(); c.beginPath(); c.arc(54, 63, 21, 0, TAU); c.clip(); c.fillStyle = '#ffe3ea'; c.fillRect(30, 40, 50, 50); [['mom', 43.5, 52.5], ['dad', 64.5, 52.5], ['uncle', 43.5, 73.5], ['grandma', 64.5, 73.5]].forEach(([w, x, yy]) => drawAvatar(c, w, x, yy, 10.6, { ring: 'rgba(255,255,255,0.9)' })); c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(54, 63, 21, 0, TAU); c.stroke();
    const hb = 1 + 0.16 * (impulse(t, T.BEAT1, 0.04, 0.16) + impulse(t, T.BEAT2, 0.04, 0.16) + impulse(t, T.BEAT3, 0.04, 0.16));
    c.font = F(900, 20); c.fillStyle = INK; c.fillText('FAMILY', 86, 61); const fw = c.measureText('FAMILY').width; heart(c, 86 + fw + 15, 54.5, 21 * hb);
    R.title = { x: 86, y: 43, w: fw + 30, h: 22 };
    const sub = typingWho.length ? (typingWho.length > 1 ? 'Mom, Dad are typing…' : NAMES[typingWho[0].who] + ' is typing…') : (t >= T.LEFT ? 'Mom, Dad, Uncle, You' : 'Mom, Dad, Uncle, Grandma, You');
    c.font = F(700, 12.5); c.fillStyle = typingWho.length ? GREEN_D : MUTE; c.fillText(sub, 86, 80);
    c.strokeStyle = '#5b6578'; c.lineWidth = 2; c.beginPath(); c.arc(318, 60, 8, 0, TAU); c.moveTo(324, 66); c.lineTo(330, 72); c.stroke();   // search
    for (let i = 0; i < 3; i++) { c.fillStyle = '#5b6578'; c.beginPath(); c.arc(344, 54 + i * 6.5, 1.9, 0, TAU); c.fill(); }

    // ---- input bar
    c.fillStyle = '#f4f2ee'; c.fillRect(0, inputY, UI.W, UI.H - inputY);
    c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,0.08)'; c.shadowBlur = 4 * sx / 3; rr(c, 10, inputY + 8, 290, 40, 20); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = '#9aa3b2'; c.lineWidth = 1.8; c.beginPath(); c.arc(30, inputY + 28, 9, 0, TAU); c.moveTo(25.5, inputY + 30.5); c.quadraticCurveTo(30, inputY + 35, 34.5, inputY + 30.5); c.stroke(); c.fillStyle = '#9aa3b2'; c.beginPath(); c.arc(26.8, inputY + 25.5, 1.3, 0, TAU); c.arc(33.2, inputY + 25.5, 1.3, 0, TAU); c.fill();
    c.font = F(600, 16);
    if (typed.length) { c.fillStyle = INK; c.fillText(typed, 48, inputY + 33.5); const cw = c.measureText(typed).width; if (Math.floor(t * 2.2) % 2 === 0 || true) { c.fillStyle = GREEN; c.fillRect(48 + cw + 1.5, inputY + 18, 2, 20); } }
    else { c.fillStyle = '#a7aebb'; c.fillText('Message', 48, inputY + 33.5); if (t < T.SEND) { c.fillStyle = GREEN; c.fillRect(47, inputY + 18, 2, 20); } }
    const sp = 1 + 0.25 * impulse(t, T.SEND - 0.05, 0.05, 0.12); const sg = c.createLinearGradient(0, inputY + 8, 0, inputY + 48); sg.addColorStop(0, '#2ccb72'); sg.addColorStop(1, GREEN_D);
    c.save(); c.translate(328, inputY + 28); c.scale(sp, sp); c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-7, -8); c.lineTo(10, 0); c.lineTo(-7, 8); c.lineTo(-4, 0); c.closePath(); c.fill(); c.restore();
    R.send = { x: 308, y: inputY + 8, w: 40, h: 40 }; R.input = { x: 10, y: inputY + 8, w: 290, h: 40 };

    // ---- keyboard
    if (kbK > 0.01) {
      const ky = UI.H - kbH; c.fillStyle = '#d7dae1'; c.fillRect(0, ky, UI.W, 262);
      let pressed = null, pk2 = 0; for (const k of _keys) { const d = t - k.t; if (d >= -0.01 && d < 0.11) { pressed = k.ch; pk2 = 1 - d / 0.11; } }
      const sendP = impulse(t, T.SEND - 0.05, 0.03, 0.12);
      const keyW = 31.6, gap = 4, kh = 44;
      KB_ROWS.forEach((row, ri) => {
        const total = row.length * keyW + (row.length - 1) * gap; const x0 = (UI.W - total) / 2; const yy = ky + 10 + ri * (kh + 10);
        [...row].forEach((ch, i) => { const x = x0 + i * (keyW + gap); const on = pressed === ch; c.fillStyle = 'rgba(0,0,0,0.25)'; rr(c, x, yy + 1.2, keyW, kh, 6); c.fill(); c.fillStyle = on ? '#b9c0cc' : '#fff'; rr(c, x, yy, keyW, kh, 6); c.fill(); c.fillStyle = INK; c.font = F(600, 20); c.textAlign = 'center'; c.fillText(ch, x + keyW / 2, yy + 29);
          if (on) { c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 8 * sx / 3; rr(c, x - 7, yy - 52, keyW + 14, 54, 9); c.fill(); c.shadowColor = 'transparent'; c.fillStyle = INK; c.font = F(700, 30); c.fillText(ch, x + keyW / 2, yy - 16); } });
        if (ri === 2) { for (const [x, lab] of [[5, '⇧'], [UI.W - 5 - 44, '⌫']]) { c.fillStyle = 'rgba(0,0,0,0.25)'; rr(c, x, yy + 1.2, 44, kh, 6); c.fill(); c.fillStyle = '#b4bac6'; rr(c, x, yy, 44, kh, 6); c.fill(); c.fillStyle = INK; c.font = F(700, 18); c.fillText(lab, x + 22, yy + 29); } }
      });
      const yy = ky + 10 + 3 * (kh + 10);
      const bot = [[5, 44, '123', '#b4bac6'], [53, 38, ',', '#fff'], [95, 170, 'space', pressed === ' ' ? '#b9c0cc' : '#fff'], [269, 38, '.', '#fff'], [311, 44, '↵', sendP > 0.1 ? GREEN_D : GREEN]];
      for (const [x, w, lab, col] of bot) { c.fillStyle = 'rgba(0,0,0,0.25)'; rr(c, x, yy + 1.2, w, kh, 6); c.fill(); c.fillStyle = col; rr(c, x, yy, w, kh, 6); c.fill(); c.fillStyle = lab === '↵' ? '#fff' : (lab === 'space' ? MUTE : INK); c.font = F(700, lab === 'space' ? 14 : 17); c.textAlign = 'center'; c.fillText(lab, x + w / 2, yy + 28); }
      c.textAlign = 'left'; c.fillStyle = '#1d2433'; rr(c, 120, ky + 247, 120, 4.5, 2.5); c.fill();
      R.kb = { y: ky };
    } else { c.fillStyle = '#1d2433'; rr(c, 120, UI.H - 9, 120, 4.5, 2.5); c.fill(); }
    c.restore();
    return R;
  }
  function menuAmt(t) { return ease.out(prog(t, T.MENU_IN, T.MENU_IN + 0.2)) * (1 - ease.out(prog(t, T.MENU_OUT, T.MENU_OUT + 0.18))); }
  return { canvas, draw, R, setTaps: (taps) => { R.taps = taps; } };
}
