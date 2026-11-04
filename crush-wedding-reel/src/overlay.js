// 2D overlay: word-synced pixel-font captions with blocky black outline, comic SFX text,
// labels and fades. Drawn on a canvas stacked above the WebGL canvas.
import { clamp, easeOutBack, seg, noise1 } from './util.js';

const FONT = '"Pixelify Sans"';
// the pixel font has an 'fi' ligature that reads like 'A' — break ligatures with ZWNJ so words show exactly as spoken
const noLig = (s) => s.replace(/([fF])(?=[a-zA-Z])/g, '$1\u200C');

export class Overlay {
  constructor(canvas, W, H) {
    this.c = canvas; this.c.width = W; this.c.height = H;
    this.g = this.c.getContext('2d');
    this.W = W; this.H = H; this.k = W / 1080;
    this.items = [];
  }
  begin() { this.items = []; this.fadeA = 0; this.flashA = 0; this.shake = [0, 0]; }

  // draw text with a square pixel outline + hard drop shadow
  outlined(text, x, y, size, o = {}) {
    const g = this.g, k = this.k;
    text = noLig(text);
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (o.scale) g.scale(o.scale, o.scale);
    g.font = `700 ${size}px ${FONT}`;
    g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    const ow = Math.max(2, Math.round((o.outline ?? size * 0.11)));
    const step = Math.max(1, Math.round(ow / 3));
    // drop shadow
    if (o.shadow !== false) {
      g.fillStyle = o.shadowColor || 'rgba(0,0,0,0.55)';
      const sd = Math.round(size * 0.09);
      for (let dy = -ow; dy <= ow; dy += step) for (let dx = -ow; dx <= ow; dx += step) g.fillText(text, dx + sd * 0.35, dy + sd);
    }
    g.fillStyle = o.outlineColor || '#000';
    for (let dy = -ow; dy <= ow; dy += step) for (let dx = -ow; dx <= ow; dx += step) g.fillText(text, dx, dy);
    g.fillStyle = o.fill || '#fff';
    g.fillText(text, 0, 0);
    if (o.shine) { g.fillStyle = 'rgba(255,255,255,0.0)'; }
    g.restore();
  }

  // caption group: words [{w,t}] revealed as spoken, centred, 2-3 words, wraps if needed
  caption(group, t) {
    const g = this.g, k = this.k;
    const loud = group.loud, caps = group.loud || group.big;
    const size = Math.round((loud ? 122 : group.big ? 112 : 92) * k);
    g.font = `700 ${size}px ${FONT}`;
    const words = group.words.map((w) => ({ ...w, text: noLig(caps ? w.w.toUpperCase() : w.w) }));
    const space = size * 0.32;
    const maxW = this.W - 120 * k;
    // layout lines
    const lines = [[]]; let lw = 0;
    for (const w of words) {
      w.width = g.measureText(w.text).width;
      if (lines[lines.length - 1].length && lw + space + w.width > maxW) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(w); lw += (lw ? space : 0) + w.width;
    }
    const lh = size * 1.12;
    const cy = this.H * 0.6 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, li) => {
      const total = line.reduce((a, w) => a + w.width, 0) + space * (line.length - 1);
      let x = this.W / 2 - total / 2;
      for (const w of line) {
        const age = t - w.t;
        if (age >= -0.001) {
          const p = clamp(age / (loud ? 0.16 : 0.12));
          let sc = loud ? 1.32 - 0.32 * easeOutBack(p, 2.2) : 1.16 - 0.16 * easeOutBack(p, 2.0);
          let jx = 0, jy = 0, rot = 0;
          if (loud) { const a = Math.max(0, 1 - age / 0.45) * 9 * k + 2.5 * k; jx = noise1(t * 40 + w.t * 9) * a; jy = noise1(t * 43 + 5 + w.t * 7) * a; rot = noise1(t * 20 + w.t) * 0.03; }
          this.outlined(w.text, x + w.width / 2 + jx + this.shake[0], cy + li * lh + jy + this.shake[1], size, { scale: sc, rot, outline: Math.round(size * 0.12) });
        }
        x += w.width + space;
      }
    });
  }

  comic(text, x, y, size, o = {}) { this.items.push({ type: 'comic', text, x, y, size, o }); }
  label(text, x, y, size, age) { this.items.push({ type: 'label', text, x, y, size, age }); }

  drawItems() {
    const g = this.g, k = this.k;
    for (const it of this.items) {
      if (it.type === 'comic') {
        this.outlined(it.text, it.x + this.shake[0], it.y + this.shake[1], it.size * k, Object.assign({ outline: Math.round(it.size * k * 0.13) }, it.o));
      }
      if (it.type === 'label') {
        const sc = easeOutBack(clamp(it.age / 0.25), 2.5);
        if (sc <= 0) continue;
        g.save(); g.translate(it.x, it.y); g.scale(sc, sc); g.rotate(-0.08);
        const size = it.size * k;
        g.font = `700 ${size}px ${FONT}`;
        const w = g.measureText(it.text).width + size * 0.9, h = size * 1.35;
        const px = Math.round(6 * k);
        // pixel speech tag
        g.fillStyle = '#000'; g.fillRect(-w / 2 - px, -h / 2 - px, w + px * 2, h + px * 2);
        g.fillStyle = '#fff'; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = '#000'; for (let i = 0; i < 4; i++) g.fillRect(-w * 0.25 - i * px, h / 2 + i * px, px * (4 - i) + px, px);
        g.fillStyle = '#d9d9d9'; g.fillRect(-w / 2, h / 2 - px, w, px);
        g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.text, 0, size * 0.04);
        g.restore();
      }
    }
  }

  draw(t, caption) {
    const g = this.g;
    g.clearRect(0, 0, this.W, this.H);
    this.drawItems();
    if (caption) this.caption(caption, t);
    if (this.flashA > 0) { g.fillStyle = `rgba(255,255,255,${this.flashA})`; g.fillRect(0, 0, this.W, this.H); }
    if (this.fadeA > 0) { g.fillStyle = `rgba(0,0,0,${this.fadeA})`; g.fillRect(0, 0, this.W, this.H); }
  }
}
