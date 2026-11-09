// 2D layer drawn on top of each rendered frame: captions, comic pops, speed lines, hearts, watermark.
import { clamp, easeOutBack, easeOut, mulberry32, invLerp } from './util.js';

export const W = 1080, H = 1920;
const CAP_Y = 805;           // caption block centre (a bit above the middle)
const WM_Y = 930;            // watermark just below captions
const FONT = 'Fredoka';

// Split the spoken words into 1-3 word caption chunks.
export function buildChunks(words, ctx) {
  ctx.font = `700 104px ${FONT}`;
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  words.forEach((w, i) => {
    cur.push(i);
    const next = words[i + 1];
    const punct = /[.,!?…]$/.test(w.text);
    const gap = next ? next.start - w.end : 1;
    const text = cur.map((k) => words[k].text.toUpperCase()).join(' ');
    const tooWide = next && ctx.measureText(text + ' ' + next.text.toUpperCase()).width > 960;
    if (punct || cur.length >= 3 || gap > 0.32 || tooWide || (cur.length >= 2 && next && next.text.length > 7)) flush();
  });
  flush();
  return chunks.map((idx, ci) => {
    const first = words[idx[0]], last = words[idx[idx.length - 1]];
    const nextChunk = chunks[ci + 1];
    const t0 = first.start - 0.04;
    const t1 = nextChunk ? Math.min(words[nextChunk[0]].start - 0.04, last.end + 0.6) : last.end + 0.9;
    return { idx, t0, t1 };
  });
}

function strokeFillText(g, text, x, y, fill, stroke, lw) {
  g.lineJoin = 'round'; g.miterLimit = 2;
  g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}

export function drawCaptions(g, t, words, chunks) {
  const ch = chunks.find((c) => t >= c.t0 && t < c.t1);
  if (!ch) return;
  const size = 104;
  g.font = `700 ${size}px ${FONT}`;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const items = ch.idx.map((k) => ({ k, text: words[k].text.toUpperCase().replace(/…/g, '...'), w: 0 }));
  const space = size * 0.26;
  items.forEach((it) => { it.w = g.measureText(it.text).width; });
  // line breaking (max 2 lines)
  let lines = [items];
  const total = items.reduce((a, b) => a + b.w, 0) + space * (items.length - 1);
  if (total > 980 && items.length > 1) lines = [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))];
  const lineH = size * 1.08;
  lines.forEach((line, li) => {
    const lw = line.reduce((a, b) => a + b.w, 0) + space * (line.length - 1);
    let x = W / 2 - lw / 2;
    const y = CAP_Y + (li - (lines.length - 1) / 2) * lineH;
    for (const it of line) {
      const wd = words[it.k];
      if (t >= wd.start - 0.03) {
        const nextStart = words[it.k + 1] ? words[it.k + 1].start : wd.end + 0.5;
        const active = t < nextStart - 0.02 || it.k === ch.idx[ch.idx.length - 1] && t < wd.end + 0.25;
        const age = t - (wd.start - 0.03);
        const s = 0.55 + 0.45 * easeOutBack(clamp(age / 0.16), 2.6);
        const cx = x + it.w / 2;
        g.save();
        g.translate(cx, y); g.scale(s, s); g.rotate(active ? -0.02 : 0);
        // soft drop shadow
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(it.text, -it.w / 2 + 4, 9);
        strokeFillText(g, it.text, -it.w / 2, 0, active ? '#ffd21f' : '#ffffff', '#111111', 20);
        g.restore();
      }
      x += it.w + space;
    }
  });
}

export function drawWatermark(g) {
  g.save();
  g.font = `600 34px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.globalAlpha = 0.5;
  g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 5;
  g.strokeText('@garden_reels', W / 2, WM_Y);
  g.fillStyle = '#ffffff'; g.fillText('@garden_reels', W / 2, WM_Y);
  g.restore();
}

// Comic burst: "RIIIP!" etc.
export function drawPop(g, pop, t) {
  const age = t - pop.t;
  const dur = pop.dur ?? 0.85;
  if (age < 0 || age > dur) return;
  const sIn = easeOutBack(clamp(age / 0.18), 3.2);
  const out = invLerp(dur - 0.18, dur, age);
  const s = sIn * (1 + 0.04 * Math.sin(age * 30) * (1 - out)) * (1 - 0.35 * out);
  g.save();
  g.globalAlpha = 1 - out;
  g.translate(pop.x, pop.y); g.rotate(pop.rot + Math.sin(age * 9) * 0.03); g.scale(s, s);
  const r = mulberry32(pop.seed || 7);
  // burst lines
  g.strokeStyle = pop.lines || '#ffffff'; g.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2;
    const r0 = 230 + r() * 30, r1 = r0 + 60 + r() * 70 + age * 120;
    g.lineWidth = 10 + r() * 8;
    g.globalAlpha = (1 - out) * 0.9;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.62); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.62); g.stroke();
  }
  g.globalAlpha = 1 - out;
  // star burst shape
  const spikes = 14;
  g.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = (i % 2 === 0 ? 230 : 165) * (0.92 + r() * 0.16);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6);
  }
  g.closePath();
  g.fillStyle = pop.burst || '#ffd21f'; g.fill();
  g.lineWidth = 12; g.strokeStyle = '#111'; g.lineJoin = 'round'; g.stroke();
  // text
  g.font = `700 ${pop.size || 132}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText(pop.text, 6, 12);
  strokeFillText(g, pop.text, 0, 4, pop.color || '#e8241c', '#111', 22);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.save(); g.beginPath(); g.rect(-400, -70, 800, 40); g.clip(); g.fillText(pop.text, 0, 4); g.restore();
  g.restore();
}

// Anime focus lines around the edges.
export function drawSpeedLines(g, t, amount, seed = 1) {
  if (amount <= 0.01) return;
  const frame = Math.floor(t * 30);
  const r = mulberry32(seed * 1000 + frame);
  g.save();
  g.globalAlpha = clamp(amount) * 0.8;
  g.fillStyle = '#ffffff';
  const cx = W / 2, cy = H * 0.45;
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const inner = 520 + r() * 260, outer = 1500;
    const wdt = 0.004 + r() * 0.012;
    g.beginPath();
    g.moveTo(cx + Math.cos(a - wdt) * outer, cy + Math.sin(a - wdt) * outer);
    g.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    g.lineTo(cx + Math.cos(a + wdt) * outer, cy + Math.sin(a + wdt) * outer);
    g.fill();
  }
  g.restore();
}

export function drawHeart(g, x, y, size, alpha, rot = 0) {
  g.save();
  g.globalAlpha = alpha; g.translate(x, y); g.rotate(rot); g.scale(size / 100, size / 100);
  g.beginPath();
  g.moveTo(0, 30);
  g.bezierCurveTo(-70, -20, -45, -80, 0, -45);
  g.bezierCurveTo(45, -80, 70, -20, 0, 30);
  g.closePath();
  g.fillStyle = '#ff4d7d'; g.fill();
  g.lineWidth = 8; g.strokeStyle = '#7a0f2e'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-22, -38, 10, 6, -0.6, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function drawSparkle(g, x, y, size, alpha) {
  g.save(); g.globalAlpha = alpha; g.translate(x, y);
  g.fillStyle = '#fffbe0';
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rr = i % 2 === 0 ? size : size * 0.18; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.shadowColor = '#fff2a0'; g.shadowBlur = 20; g.fill();
  g.restore();
}

export function drawFlash(g, amount, color = '255,255,255') {
  if (amount <= 0.001) return;
  g.save(); g.fillStyle = `rgba(${color},${clamp(amount)})`; g.fillRect(0, 0, W, H); g.restore();
}
