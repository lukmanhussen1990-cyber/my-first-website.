// 2D layer: captions, comic sound words, arrow labels, stamps, bubbles,
// banners, mosaic censor, flashes and fades. Sizes are designed for a
// 1080-wide frame and scaled by k.
import { FONT, COMIC, ICONS } from './gfx.js';

const YEL = '#ffd60a';

export class Overlay {
  constructor(W, H) { this.W = W; this.H = H; this.k = W / 1080; }

  text(g, s, x, y, size, { fill = YEL, stroke = '#000', lw = 0.2, font = FONT, weight = 900, align = 'center', shadow = true } = {}) {
    g.save();
    g.font = `${weight} ${size}px ${font}`;
    g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.miterLimit = 2;
    if (shadow) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = size * lw; g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.strokeText(s, x + size * 0.04, y + size * 0.07);
    }
    g.lineWidth = size * lw; g.strokeStyle = stroke; g.strokeText(s, x, y);
    g.fillStyle = fill; g.fillText(s, x, y);
    g.restore();
  }

  // ------------------------------------------------------------ captions
  layout(g, words, size, maxW) {
    g.font = `900 ${size}px ${FONT}`;
    const wid = ws => g.measureText(ws.join(' ')).width;
    if (wid(words) <= maxW) return [words];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i), b = words.slice(i);
      if (wid(a) <= maxW && wid(b) <= maxW) {
        const sc = Math.abs(wid(a) - wid(b));
        if (!best || sc < best.sc) best = { sc, lines: [a, b] };
      }
    }
    return best ? best.lines : null;
  }
  caption(g, cap, t, shake) {
    const k = this.k;
    const words = cap.text.toUpperCase().split(/\s+/);
    let size = (cap.loud ? 92 : 76) * k, lines;
    const maxW = this.W - 120 * k;
    for (;;) { lines = this.layout(g, words, size, maxW); if (lines || size < 40 * k) break; size -= 4 * k; }
    lines = lines || [words];
    const age = t - cap.s;
    // bouncy pop-in
    const u = Math.min(1, age / 0.16);
    const pop = cap.loud ? 1 + 0.5 * Math.pow(1 - u, 2) - 0.08 * Math.sin(u * Math.PI) : 1 + 0.25 * Math.pow(1 - u, 2) - 0.05 * Math.sin(u * Math.PI);
    const cx = this.W / 2 + shake[0], cy = this.H * 0.655 + shake[1];
    g.save();
    g.translate(cx, cy);
    g.scale(pop, pop);
    if (cap.loud) g.rotate(Math.sin(cap.s * 13) * 0.04);
    lines.forEach((ln, i) => {
      const y = (i - (lines.length - 1) / 2) * size * 1.08;
      this.text(g, ln.join(' '), 0, y, size, { fill: YEL, lw: 0.24 });
    });
    g.restore();
  }

  // ------------------------------------------------------------ comic words
  comic(g, w, t) {
    const k = this.k, age = t - w.t;
    if (age < 0 || age > w.dur) return;
    const u = Math.min(1, age / 0.18);
    const bounce = 1 + 0.6 * Math.pow(1 - u, 2) * Math.cos(u * 9);
    const fade = Math.min(1, (w.dur - age) / 0.15);
    const wob = Math.sin(age * 18) * 0.04;
    g.save();
    g.globalAlpha = fade;
    g.translate(w.x * this.W, w.y * this.H - Math.sin(Math.min(1, age / 0.25) * Math.PI) * 18 * k);
    g.rotate((w.rot || 0) + wob);
    g.scale(bounce, bounce);
    const size = (w.size || 120) * k;
    // red/yellow comic word: white inner outline, black outer outline
    g.font = `400 ${size}px ${COMIC}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = size * 0.3; g.strokeStyle = '#111'; g.strokeText(w.text, 0, 0);
    g.lineWidth = size * 0.14; g.strokeStyle = w.inner || '#fff'; g.strokeText(w.text, 0, 0);
    g.fillStyle = w.color || '#ff2e2e'; g.fillText(w.text, 0, 0);
    g.restore();
  }

  // ------------------------------------------------------------ label + arrow
  label(g, l, t) {
    const k = this.k;
    const age = t - (l.t0 ?? -1e9);
    const s = l.t0 == null ? 1 : Math.min(1, age / 0.15) * (1 + 0.25 * Math.max(0, 1 - age / 0.3));
    if (s <= 0) return;
    const lx = l.x * this.W, ly = l.y * this.H;
    const tx = l.tx, ty = l.ty;
    g.save();
    g.globalAlpha = Math.min(1, s * 1.2);
    // arrow
    if (tx != null) {
      const dx = tx - lx, dy = ty - ly, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const sx = lx + ux * (l.gap || 70) * k, sy = ly + uy * (l.gap || 70) * k;
      const ex = tx - ux * 18 * k, ey = ty - uy * 18 * k;
      const head = 34 * k;
      const draw = (w, col) => {
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex - ux * head * 0.6, ey - uy * head * 0.6); g.stroke();
        g.beginPath(); g.moveTo(ex, ey);
        g.lineTo(ex - ux * head - uy * head * 0.6, ey - uy * head + ux * head * 0.6);
        g.lineTo(ex - ux * head + uy * head * 0.6, ey - uy * head - ux * head * 0.6);
        g.closePath(); g.fill(); g.stroke();
      };
      draw(22 * k, '#000'); draw(10 * k, YEL);
    }
    g.translate(lx, ly); g.scale(s, s);
    this.text(g, l.text, 0, 0, (l.size || 56) * k, { fill: l.color || YEL, lw: 0.24 });
    g.restore();
  }

  // ------------------------------------------------------------ stamp
  stamp(g, st, t) {
    const k = this.k, age = t - st.t;
    if (age < 0) return;
    const u = Math.min(1, age / 0.12);
    const sc = age < 0.12 ? 2.6 - 1.6 * u * u : 1 + 0.05 * Math.exp(-(age - 0.12) * 12) * Math.cos((age - 0.12) * 40);
    const a = Math.min(1, age / 0.06);
    g.save();
    g.globalAlpha = a * (st.alpha ?? 1);
    g.translate(st.x * this.W, st.y * this.H);
    g.rotate(st.rot ?? -0.2);
    g.scale(sc, sc);
    const size = (st.size || 130) * k;
    g.font = `900 ${size}px ${FONT}`;
    const w = g.measureText(st.text).width + size * 0.6, h = size * 1.35;
    const col = st.color || '#e3182d';
    g.lineWidth = size * 0.11; g.strokeStyle = col;
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, size * 0.18); g.stroke();
    g.lineWidth = size * 0.04;
    g.beginPath(); g.roundRect(-w / 2 + size * 0.14, -h / 2 + size * 0.14, w - size * 0.28, h - size * 0.28, size * 0.1); g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(st.text, 0, size * 0.05);
    g.restore();
  }

  // ------------------------------------------------------------ dream bubble
  bubble(g, b, t) {
    const k = this.k;
    g.save();
    const cx = b.x * this.W, cy = b.y * this.H, r = (b.r || 230) * k * b.scale;
    if (b.pop > 0) {
      // burst: little pieces flying out
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, d = r * (0.8 + b.pop * 1.4);
        g.globalAlpha = Math.max(0, 1 - b.pop * 1.3);
        g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5 * k;
        g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 22 * k * (1 - b.pop * 0.6), 0, 7); g.fill(); g.stroke();
      }
      g.restore();
      return;
    }
    // trailing dots toward the sleeper
    const dots = [[b.fx, b.fy, 16], [(b.fx * 2 + b.x) / 3, (b.fy * 2 + b.y) / 3 + 0.02, 26], [(b.fx + b.x * 2) / 3, (b.fy + b.y * 2) / 3 + 0.04, 38]];
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 7 * k;
    for (const [x, y, rr] of dots) { g.beginPath(); g.arc(x * this.W, y * this.H, rr * k * b.scale, 0, 7); g.fill(); g.stroke(); }
    g.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const px = cx + Math.cos(a) * r * 1.15, py = cy + Math.sin(a) * r * 0.78;
      const a2 = (i + 0.5) / n * Math.PI * 2;
      const qx = cx + Math.cos(a2) * r * 1.45, qy = cy + Math.sin(a2) * r * 1.05;
      if (i === 0) g.moveTo(px, py); else g.quadraticCurveTo(qx, qy, px, py);
    }
    g.closePath();
    g.lineWidth = 10 * k; g.stroke(); g.fill();
    // content
    const grd = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grd.addColorStop(0, '#ff7ac6'); grd.addColorStop(1, '#4fc3ff');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(cx, cy, r * 0.95, r * 0.62, 0, 0, 7); g.fill();
    this.text(g, 'GTA 6', cx, cy - r * 0.06, r * 0.5, { fill: '#fff', lw: 0.12, shadow: false });
    if (b.hearts) {
      for (let i = 0; i < 3; i++) {
        const c = ICONS.heart, s = 54 * k;
        g.drawImage(c, cx - r * 0.75 + i * r * 0.7 - s / 2, cy + r * 0.32 - s / 2 - Math.sin(t * 4 + i) * 6 * k, s, s);
      }
    }
    g.restore();
  }

  // ------------------------------------------------------------ banner
  newsBanner(g, t, text = 'BREAKING NEWS', sub = 'GTA 6 DELAYED AGAIN') {
    const k = this.k, y = this.H * 0.8;
    const slide = Math.min(1, t / 0.25);
    g.save();
    g.translate((1 - slide) * -this.W, 0);
    g.fillStyle = '#d81e2c'; g.fillRect(0, y, this.W * 0.72, 92 * k);
    g.fillStyle = '#ffffff'; g.fillRect(0, y + 92 * k, this.W, 64 * k);
    g.fillStyle = '#0f2a6b'; g.fillRect(this.W * 0.72, y, this.W * 0.28, 92 * k);
    this.text(g, text, 30 * k, y + 47 * k, 58 * k, { fill: '#fff', lw: 0, align: 'left', shadow: false });
    this.text(g, 'LIVE', this.W * 0.86, y + 47 * k, 50 * k, { fill: '#fff', lw: 0, shadow: false });
    g.save();
    g.beginPath(); g.rect(0, y + 92 * k, this.W, 64 * k); g.clip();
    const tick = `${sub}  •  ${sub}  •  ${sub}  •  `;
    this.text(g, tick, this.W - ((t * 260 * k) % (this.W * 2)), y + 125 * k, 40 * k, { fill: '#111', lw: 0, align: 'left', shadow: false, weight: 800 });
    g.restore();
    g.restore();
  }

  // ------------------------------------------------------------ mosaic censor
  mosaic(g, x, y, w, h, block) {
    x = Math.floor(x); y = Math.floor(y); w = Math.ceil(w); h = Math.ceil(h);
    if (w < 2 || h < 2) return;
    const cw = Math.max(1, Math.round(w / block)), ch = Math.max(1, Math.round(h / block));
    if (!this.tmp) { this.tmp = document.createElement('canvas'); this.tmpG = this.tmp.getContext('2d'); }
    this.tmp.width = cw; this.tmp.height = ch;
    this.tmpG.imageSmoothingEnabled = true;
    this.tmpG.drawImage(g.canvas, x, y, w, h, 0, 0, cw, ch);
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.tmp, 0, 0, cw, ch, x, y, w, h);
    g.restore();
  }

  speedLines(g, t, strength = 1) {
    const n = 40, cx = this.W / 2, cy = this.H / 2;
    g.save();
    g.fillStyle = `rgba(255,255,255,${0.6 * strength})`;
    for (let i = 0; i < n; i++) {
      const r1 = Math.sin(i * 12.9898) * 43758.5453, rr = r1 - Math.floor(r1);
      const a = (i / n) * Math.PI * 2 + rr * 0.1;
      const flick = (Math.floor(t * 24 + i * 7) % 3) / 3;
      const inner = (0.34 + 0.12 * rr + 0.05 * flick) * this.H, outer = this.H;
      const w = (0.006 + 0.01 * rr) * strength;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      g.lineTo(cx + Math.cos(a - w) * outer, cy + Math.sin(a - w) * outer);
      g.lineTo(cx + Math.cos(a + w) * outer, cy + Math.sin(a + w) * outer);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  whoosh(g, t, dir = 1, y = 0.5) {
    const k = this.k;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const yy = (y + (i - 3) * 0.035) * this.H;
      const ph = (t * 2.5 + i * 0.31) % 1;
      const len = (180 + 120 * Math.sin(i * 2.1)) * k;
      const x = dir > 0 ? ph * this.W * 1.4 - len : this.W - ph * this.W * 1.4 + len;
      g.lineWidth = (6 + (i % 3) * 3) * k;
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x - dir * len, yy); g.stroke();
    }
    g.restore();
  }

  fill(g, color, a) { if (a <= 0) return; g.save(); g.globalAlpha = Math.min(1, a); g.fillStyle = color; g.fillRect(0, 0, this.W, this.H); g.restore(); }
  vignette(g, s = 0.25) {
    const grd = g.createRadialGradient(this.W / 2, this.H * 0.48, this.H * 0.3, this.W / 2, this.H * 0.5, this.H * 0.78);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${s})`);
    g.fillStyle = grd; g.fillRect(0, 0, this.W, this.H);
  }
}
