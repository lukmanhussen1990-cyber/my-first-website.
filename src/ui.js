// 2D overlay drawn per frame into a canvas (plus a glass mask the final pass
// uses for the blurred-backdrop cards). Instagram safe zone: every glyph stays
// within y 300..1400 and at least 160 px from the right edge.
import * as THREE from 'three';
import { clamp, easeOutCubic, easeOutBack, noise1 } from './util.js';
import { warningIcon } from './textures.js';

export const SAFE = { top: 300, bottom: 1400, left: 80, right: 1080 - 160 };
const RED = '#D7263D';

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

const norm = (w) => w.toUpperCase().replace(/[^A-Z']/g, '');

export class UI {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.g = this.canvas.getContext('2d');
    this.mask = document.createElement('canvas');
    this.mask.width = w;
    this.mask.height = h;
    this.m = this.mask.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.maskTex = new THREE.CanvasTexture(this.mask);
    for (const t of [this.tex, this.maskTex]) {
      t.colorSpace = THREE.NoColorSpace;
      t.generateMipmaps = false;
      t.minFilter = t.magFilter = THREE.LinearFilter;
    }
    this.bounds = [];
  }

  // Track drawn text boxes so the renderer can assert the safe zone.
  note(x0, y0, x1, y1, what) {
    this.bounds.push({ x0, y0, x1, y1, what });
  }

  caption(t, cap) {
    const g = this.g;
    const p = clamp((t - cap.start) / 0.15);
    const out = clamp((cap.end - t) / 0.12);
    const a = easeOutCubic(p) * out;
    if (a <= 0) return;
    const s = 0.9 + 0.1 * easeOutCubic(p);
    let size = 118;
    g.font = `${size}px Anton`;
    let lines = wrap(g, cap.text, SAFE.right - 160);
    while ((lines.length > 2 || lines.some((l) => g.measureText(l).width > SAFE.right - 160)) && size > 70) {
      size -= 4;
      g.font = `${size}px Anton`;
      lines = wrap(g, cap.text, SAFE.right - 160);
    }
    const lh = size * 1.04;
    const cx = 540;
    const cy = 1185;
    const y0 = cy - (lines.length * lh) / 2;
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);
    g.translate(-cx, -cy);
    g.globalAlpha = a;
    g.textBaseline = 'alphabetic';
    lines.forEach((line, li) => {
      const words = line.split(' ');
      const space = g.measureText(' ').width;
      const widths = words.map((w) => g.measureText(w).width);
      const total = widths.reduce((x, y) => x + y, 0) + space * (words.length - 1);
      let x = cx - total / 2;
      const y = y0 + (li + 1) * lh - size * 0.16;
      this.note(x, y - size * 0.86, x + total, y + size * 0.08, 'caption');
      words.forEach((w, i) => {
        const red = norm(w) === norm(cap.red);
        for (const [blur, col, oy] of [[26, 'rgba(0,0,0,0.75)', 7], [6, 'rgba(0,0,0,0.6)', 2]]) {
          g.shadowColor = col;
          g.shadowBlur = blur;
          g.shadowOffsetY = oy;
          g.fillStyle = red ? RED : '#ffffff';
          g.fillText(w, x, y);
        }
        g.shadowColor = 'transparent';
        g.fillText(w, x, y);
        x += widths[i] + space;
      });
    });
    g.restore();
  }

  glassCard(x, y, w, h, r, a, { tint = 'rgba(255,255,255,0.10)', border = 'rgba(255,255,255,0.30)' } = {}) {
    const g = this.g;
    this.m.save();
    this.m.globalAlpha = a;
    this.m.fillStyle = '#fff';
    rr(this.m, x, y, w, h, r);
    this.m.fill();
    this.m.restore();
    g.save();
    g.globalAlpha = a;
    rr(g, x, y, w, h, r);
    g.fillStyle = tint;
    g.fill();
    const sheen = g.createLinearGradient(0, y, 0, y + h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    g.fillStyle = sheen;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = border;
    g.stroke();
    g.restore();
  }

  notification(t, n, { top = 420, urgent = false } = {}) {
    const g = this.g;
    const p = clamp((t - n.start) / 0.38);
    if (p <= 0) return;
    const a = easeOutCubic(clamp(p * 1.6)) * clamp((n.end - t) / 0.15);
    const x = 140;
    const w = SAFE.right - x;
    const dy = (1 - easeOutBack(p, 1.2)) * -40;
    g.font = urgent ? '800 52px Inter' : '600 46px Inter';
    const lines = wrap(g, n.body, w - 72);
    const lh = urgent ? 64 : 58;
    const h = 128 + lines.length * lh + 18;
    const y = top + dy;
    this.glassCard(x, y, w, h, 42, a);
    g.save();
    g.globalAlpha = a;
    // app icon
    rr(g, x + 30, y + 30, 66, 66, 16);
    const ig = g.createLinearGradient(0, y + 30, 0, y + 96);
    ig.addColorStop(0, '#3a2a12');
    ig.addColorStop(1, '#1a1208');
    g.fillStyle = ig;
    g.fill();
    warningIcon(g, x + 63, y + 65, 40);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = '700 30px Inter';
    g.letterSpacing = '2px';
    g.fillText('RAILWAY ALERT', x + 118, y + 74);
    g.letterSpacing = '0px';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '500 28px Inter';
    g.textAlign = 'right';
    g.fillText('now', x + w - 34, y + 74);
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.font = urgent ? '800 52px Inter' : '600 46px Inter';
    lines.forEach((l, i) => g.fillText(l, x + 36, y + 150 + i * lh + (urgent ? 4 : 0)));
    g.restore();
    this.note(x + 30, y + 30, x + w - 34, y + 150 + (lines.length - 1) * lh + 14, 'notification');
  }

  bubble(t, b) {
    const g = this.g;
    const p = clamp((t - b.start - 0.05) / 0.28);
    if (p <= 0) return;
    const a = easeOutCubic(p) * clamp((b.end - t) / 0.15);
    const s = 0.85 + 0.15 * easeOutBack(p, 1.3);
    const x = 100;
    const y = 640;
    const w = 640;
    const h = 150;
    const jx = noise1(t * 9, 3) * 1.6;
    const jy = noise1(t * 8, 5) * 1.6;
    g.save();
    g.translate(x + 30, y + h);
    g.scale(s, s);
    g.translate(-(x + 30) + jx, -(y + h) + jy);
    g.globalAlpha = a * 0.95;
    g.fillStyle = 'rgba(238,236,230,0.95)';
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 30;
    rr(g, x, y, w, h, 75);
    g.fill();
    g.beginPath();
    g.moveTo(x + 70, y + h - 8);
    g.quadraticCurveTo(x + 40, y + h + 40, x - 10, y + h + 52);
    g.quadraticCurveTo(x + 60, y + h + 26, x + 130, y + h - 6);
    g.fill();
    g.shadowColor = 'transparent';
    g.font = '600 50px Inter';
    g.fillStyle = '#121624';
    const words = b.text.split(' ');
    let cx = x + 50;
    words.forEach((w, i) => {
      const wt = b.words[i] ? b.words[i].start : b.start + i * 0.3;
      const wa = clamp((t - wt + 0.05) / 0.18);
      g.globalAlpha = a * (0.12 + 0.88 * wa);
      g.fillText(w, cx, y + 92);
      cx += g.measureText(w + ' ').width;
    });
    g.restore();
    this.note(x, y, x + w, y + h + 52, 'bubble');
  }

  choice(t, c, holdEnd) {
    const g = this.g;
    const p = clamp((t - c.start) / 0.32);
    if (p <= 0) return;
    const a = easeOutCubic(p);
    const s = 0.92 + 0.08 * easeOutBack(p, 1.2);
    const x = 150;
    const w = SAFE.right - x;
    const y = 330;
    const h = 600;
    const cx = x + w / 2;
    g.save();
    g.translate(cx, y + h / 2);
    g.scale(s, s);
    g.translate(-cx, -(y + h / 2));
    this.glassCard(x, y, w, h, 46, a, { tint: 'rgba(6,10,20,0.50)', border: 'rgba(255,255,255,0.22)' });
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = '96px Anton';
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 18;
    g.fillText('WHAT WOULD YOU DO?', cx, y + 132);
    g.shadowColor = 'transparent';
    const opts = [
      ['A', c.a, '#ffffff', '#0d1526'],
      ['B', c.b, RED, '#ffffff'],
    ];
    opts.forEach(([letter, label, badge, ink], i) => {
      const q = easeOutCubic(clamp((t - c.start - 0.16 - i * 0.14) / 0.3));
      const oy = y + 180 + i * 142 + (1 - q) * 30;
      g.globalAlpha = a * q;
      rr(g, x + 40, oy, w - 80, 120, 60);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.stroke();
      g.beginPath();
      g.arc(x + 108, oy + 60, 40, 0, Math.PI * 2);
      g.fillStyle = badge;
      g.fill();
      g.fillStyle = ink;
      g.font = '54px Anton';
      g.fillText(letter, x + 108, oy + 80);
      g.textAlign = 'left';
      g.fillStyle = '#fff';
      g.font = '62px Anton';
      g.fillText(label, x + 174, oy + 84);
      g.textAlign = 'center';
    });
    const q = easeOutCubic(clamp((t - c.comment) / 0.3));
    g.globalAlpha = a * q;
    g.font = '700 34px Inter';
    g.letterSpacing = '6px';
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.fillText('COMMENT  A  OR  B', cx, y + 540 + (1 - q) * 14);
    g.letterSpacing = '0px';
    g.restore();
    this.note(x + 40, y + 50, x + w - 40, y + 550, 'choice');
  }

  watermark(text) {
    const g = this.g;
    g.save();
    g.font = '600 30px Inter';
    g.letterSpacing = '3px';
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 8;
    g.fillText(text, 80, 336);
    const w = g.measureText(text).width;
    g.restore();
    this.note(80, 312, 80 + w, 342, 'watermark');
  }

  draw(t, tl, sceneIdx) {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    this.m.clearRect(0, 0, this.w, this.h);
    this.bounds = [];
    let glass = false;
    const sc = tl.scenes[sceneIdx];
    if (sc.caption) this.caption(t, sc.caption);
    if (sc.id === 's02') {
      this.notification(t, { start: sc.start + 0.12, end: sc.end, body: "If a passenger's feet point backward, pretend to sleep." }, { top: 640 });
      glass = true;
    }
    if (sc.notification) {
      this.notification(t, { start: sc.notification.start, end: sc.end, body: sc.notification.text }, { top: 400, urgent: true });
      glass = glass || t >= sc.notification.start;
    }
    if (sc.bubble) this.bubble(t, sc.bubble);
    const choiceScene = sc.choice ? sc : sc.choice_hold ? tl.scenes[sceneIdx - 1] : null;
    if (choiceScene) {
      this.choice(t, choiceScene.choice);
      glass = true;
    }
    this.watermark(tl.watermark);
    this.tex.needsUpdate = true;
    this.maskTex.needsUpdate = true;
    return glass;
  }
}
