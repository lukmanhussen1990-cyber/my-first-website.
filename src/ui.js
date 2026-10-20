// 2D overlay compositor. Draws the WebGL frame, then captions / bubbles / phone card / choice card / watermark.
import { RED, WATERMARK, CHOICE, PHONE } from './story.js';
import { clamp, easeOut, easeOutBack } from './lib/util.js';

export const SAFE = { top: 300, bottom: 1400, left: 72, right: 1080 - 160 };
const CAPTION_SIZE = 118;
const POP = 0.15; // seconds

const normWord = (w) => w.toUpperCase().replace(/[^A-Z']/g, '');

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g, words, maxW) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const test = [...cur, w].join(' ');
    if (cur.length && g.measureText(test).width > maxW) { lines.push(cur); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function pop(t, start, end, dur = POP) {
  const a = clamp((t - start) / dur);
  const out = end !== undefined ? clamp((end - t) / 0.12) : 1;
  return { a: easeOut(a) * out, s: 0.9 + 0.1 * easeOut(a), on: t >= start && (end === undefined || t < end) };
}

export class Overlay {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  compose(glCanvas, s) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(glCanvas, 0, 0, this.W, this.H);
    if (s.phoneCard) this.phoneCard(glCanvas, s.phoneCard);
    if (s.choice) this.choiceCard(glCanvas, s.choice, s.t);
    if (s.bubble) this.bubble(s.bubble, s.t);
    if (s.caption) this.caption(s.caption, s.t);
    this.watermark();
    return this.canvas;
  }

  // ---------------------------------------------------------------- captions
  caption(c, t) {
    const p = pop(t, c.start, c.end);
    if (!p.on) return;
    const g = this.g;
    g.save();
    g.font = `${CAPTION_SIZE}px Anton`;
    g.textBaseline = 'alphabetic';
    const words = c.text.split(' ');
    const lines = wrap(g, words, SAFE.right - 160);
    const lh = CAPTION_SIZE * 1.04;
    const cx = (160 + SAFE.right) / 2;
    const blockH = lines.length * lh;
    const cy = c.y ?? 1235;
    let y = cy - blockH / 2 + CAPTION_SIZE * 0.86;
    g.translate(cx, cy);
    g.scale(p.s, p.s);
    g.translate(-cx, -cy);
    g.globalAlpha = p.a;
    const red = normWord(c.red);
    for (const line of lines) {
      const space = g.measureText(' ').width;
      const widths = line.map((w) => g.measureText(w).width);
      const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
      let x = cx - total / 2;
      line.forEach((w, i) => {
        g.fillStyle = normWord(w) === red ? RED : '#ffffff';
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 26; g.shadowOffsetY = 6;
        g.fillText(w, x, y);
        g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
        g.fillText(w, x, y);
        x += widths[i] + space;
      });
      y += lh;
    }
    g.restore();
  }

  // ---------------------------------------------------------------- speech bubble
  bubble(b, t) {
    const p = pop(t, b.start, b.end);
    if (!p.on) return;
    const g = this.g;
    g.save();
    const size = 54;
    g.font = `800 ${size}px Nunito`;
    const words = b.text.split(' ');
    const lines = wrap(g, words, 560);
    const lh = size * 1.18;
    const bw = Math.max(...lines.map((l) => g.measureText(l.join(' ')).width)) + 76;
    const bh = lines.length * lh + 52;
    // place above the anchor, clamped into the safe zone
    const A = b.anchor;
    let x = clamp(A.x - bw * (b.side === 'left' ? 0.78 : 0.22), SAFE.left, SAFE.right - bw);
    let y = clamp(A.y - bh - 70, 380, SAFE.bottom - bh);
    const tipX = clamp(A.x, x + 40, x + bw - 40), tipY = Math.min(A.y - 14, y + bh + 70);
    const ox = tipX, oy = y + bh;
    g.globalAlpha = p.a;
    g.translate(ox, oy); g.scale(p.s, p.s); g.translate(-ox, -oy);
    g.shadowColor = 'rgba(0,0,0,0.38)'; g.shadowBlur = 34; g.shadowOffsetY = 12;
    g.fillStyle = '#ffffff';
    rrect(g, x, y, bw, bh, 40); g.fill();
    // tail
    const baseX = clamp(tipX + (b.side === 'left' ? 30 : -30), x + 50, x + bw - 50);
    g.beginPath();
    g.moveTo(baseX - 26, y + bh - 2); g.quadraticCurveTo(baseX, y + bh + 10, tipX, tipY); g.quadraticCurveTo(baseX + 6, y + bh + 6, baseX + 26, y + bh - 2);
    g.closePath(); g.fill();
    g.shadowColor = 'transparent';
    g.textBaseline = 'alphabetic';
    let yy = y + 26 + size * 0.95;
    let wi = 0;
    for (const line of lines) {
      let xx = x + 38;
      for (const w of line) {
        const timing = b.words && b.words[Math.min(wi, b.words.length - 1)];
        const said = !timing || t >= timing.start - 0.05;
        g.fillStyle = said ? '#1d1b22' : 'rgba(29,27,34,0.32)';
        g.fillText(w, xx, yy);
        xx += g.measureText(w + ' ').width;
        wi++;
      }
      yy += lh;
    }
    g.restore();
  }

  // ---------------------------------------------------------------- phone notification
  phoneCard(gl, c) {
    const g = this.g;
    const k = easeOut(clamp(c.p / 0.25));
    if (k <= 0) return;
    const x = 96, w = SAFE.right - x, h = 318;
    const y = c.y - (1 - k) * 40;
    g.save();
    g.globalAlpha = k;
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    g.fillStyle = 'rgba(20,20,26,0.35)';
    rrect(g, x, y, w, h, 44); g.fill();
    g.shadowColor = 'transparent';
    g.save();
    rrect(g, x, y, w, h, 44); g.clip();
    g.filter = 'blur(24px) saturate(1.5)';
    g.drawImage(gl, x - 40, y - 40, w + 80, h + 80, x - 40, y - 40, w + 80, h + 80);
    g.filter = 'none';
    g.fillStyle = 'rgba(246,244,250,0.78)';
    g.fillRect(x, y, w, h);
    g.restore();
    // generic chat icon (no real app logos)
    const ix = x + 34, iy = y + 34;
    const grd = g.createLinearGradient(ix, iy, ix, iy + 64);
    grd.addColorStop(0, '#6fd3a8'); grd.addColorStop(1, '#2fa37a');
    g.fillStyle = grd; rrect(g, ix, iy, 64, 64, 16); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(ix + 32, iy + 30, 20, 15, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(ix + 20, iy + 40); g.lineTo(ix + 16, iy + 52); g.lineTo(ix + 30, iy + 43); g.fill();
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#1c1c1e';
    g.font = '700 46px Inter';
    g.fillText(PHONE.sender, ix + 88, iy + 46);
    const nameW = g.measureText(PHONE.sender + ' ').width;
    heart(g, ix + 88 + nameW + 18, iy + 30, 17, RED);
    g.font = '500 34px Inter';
    g.fillStyle = 'rgba(60,60,67,0.7)';
    const tm = `${PHONE.time} ${PHONE.ampm}`;
    g.fillText(tm, x + w - 34 - g.measureText(tm).width, iy + 44);
    g.fillStyle = '#1c1c1e';
    g.font = '500 44px Inter';
    const lines = wrap(g, PHONE.message.split(' '), w - 68);
    lines.forEach((l, i) => g.fillText(l.join(' '), x + 34, y + 164 + i * 56));
    g.restore();
  }

  // ---------------------------------------------------------------- choice card
  choiceCard(gl, c, t) {
    const g = this.g;
    const k = clamp((t - c.start) / 0.25);
    if (k <= 0) return;
    const s = 0.9 + 0.1 * easeOutBack(k);
    const x = 100, w = SAFE.right - x, y = 868, h = 520;
    const cx = x + w / 2, cy = y + h / 2;
    g.save();
    g.globalAlpha = easeOut(k);
    g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
    g.save();
    rrect(g, x, y, w, h, 46); g.clip();
    g.filter = 'blur(20px)';
    g.drawImage(gl, x - 40, y - 40, w + 80, h + 80, x - 40, y - 40, w + 80, h + 80);
    g.filter = 'none';
    g.fillStyle = 'rgba(10,12,18,0.62)';
    g.fillRect(x, y, w, h);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
    rrect(g, x + 1, y + 1, w - 2, h - 2, 45); g.stroke();
    // title
    g.font = '86px Anton';
    g.textBaseline = 'alphabetic';
    const words = CHOICE.title.split(' ');
    const sp = g.measureText(' ').width;
    const tw = words.reduce((a, wd) => a + g.measureText(wd).width, 0) + sp * (words.length - 1);
    let tx = cx - tw / 2;
    for (const wd of words) {
      g.fillStyle = normWord(wd) === normWord(CHOICE.red) ? RED : '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16; g.shadowOffsetY = 4;
      g.fillText(wd, tx, y + 118);
      tx += g.measureText(wd).width + sp;
    }
    g.shadowColor = 'transparent';
    const row = (label, text, ry, hi) => {
      const rh = 150;
      g.fillStyle = `rgba(255,255,255,${0.08 + hi * 0.14})`;
      rrect(g, x + 34, ry, w - 68, rh, 30); g.fill();
      if (hi > 0.01) { g.strokeStyle = `rgba(255,255,255,${hi * 0.55})`; g.lineWidth = 3; rrect(g, x + 34, ry, w - 68, rh, 30); g.stroke(); }
      const bs = 92 + hi * 8;
      const bx = x + 62, by = ry + (rh - bs) / 2;
      g.fillStyle = '#ffffff'; rrect(g, bx, by, bs, bs, 22); g.fill();
      g.fillStyle = '#14151a'; g.font = `${Math.round(66 + hi * 6)}px Anton`;
      g.fillText(label, bx + bs / 2 - g.measureText(label).width / 2, by + bs * 0.77);
      g.fillStyle = '#ffffff'; g.font = '54px Anton';
      const lines = wrap(g, text.split(' '), w - 68 - 160);
      const ly0 = ry + rh / 2 - ((lines.length - 1) * 60) / 2 + 20;
      lines.forEach((l, i) => g.fillText(l.join(' '), bx + bs + 32, ly0 + i * 60));
    };
    row('A', CHOICE.a, y + 166, c.hiA);
    row('B', CHOICE.b, y + 336, c.hiB);
    g.restore();
  }

  watermark() {
    const g = this.g;
    g.save();
    g.font = '600 34px Inter';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(255,255,255,0.62)';
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 10; g.shadowOffsetY = 2;
    g.fillText(WATERMARK, SAFE.left, SAFE.top + 14);
    g.restore();
  }
}

export function heart(g, x, y, s, color) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  g.fill();
  g.restore();
}

// Lock screen for the 3D phone (drawn into its screen texture).
export function drawLockScreen(g, w, h, notif) {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1f3550'); bg.addColorStop(0.55, '#3b2f5c'); bg.addColorStop(1, '#14182a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '500 28px Inter';
  g.fillText(PHONE.date, w / 2, h * 0.17);
  g.font = '600 150px Inter';
  g.fillText(PHONE.time, w / 2, h * 0.34);
  if (notif > 0) {
    g.globalAlpha = notif;
    const x = 18, y = h * 0.43, cw = w - 36, ch = 150;
    g.fillStyle = 'rgba(245,245,250,0.86)'; rrect(g, x, y, cw, ch, 26); g.fill();
    g.fillStyle = '#2fa37a'; rrect(g, x + 16, y + 18, 40, 40, 10); g.fill();
    g.textAlign = 'left';
    g.fillStyle = '#1c1c1e'; g.font = '700 28px Inter';
    g.fillText(PHONE.sender, x + 68, y + 48);
    heart(g, x + 68 + g.measureText(PHONE.sender).width + 18, y + 38, 10, RED);
    g.font = '500 22px Inter'; g.fillStyle = 'rgba(60,60,67,0.75)';
    g.fillText(`${PHONE.time} ${PHONE.ampm}`, x + cw - 100, y + 46);
    g.fillStyle = '#1c1c1e'; g.font = '500 24px Inter';
    g.fillText('Stuck in traffic. Running late.', x + 18, y + 92);
    g.fillText("Don't open the door for anyone.", x + 18, y + 124);
    g.globalAlpha = 1;
  }
  g.textAlign = 'left';
}
