// 2D compositing: captions (white pixel font, black outline), comic sound
// words, giant hearts, speed lines, vignette, flashes and fades.
import { ICON_CANVAS } from './pixel.js';

const FONT = '"Press Start 2P"';

export class Overlay {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.k = W / 1080; // design units are for a 1080px wide frame
    this.cache = new Map();
  }

  // draw text with a crisp pixel outline (stamps the text in 8 directions)
  outlinedText(g, text, x, y, size, { fill = '#ffffff', outline = '#000000', shadow = true, align = 'center' } = {}) {
    g.save();
    g.font = `${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const o = Math.max(2, Math.round(size / 8));
    if (shadow) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(text, x + o * 1.6, y + o * 1.8);
    }
    g.fillStyle = outline;
    for (let dx = -o; dx <= o; dx += o) for (let dy = -o; dy <= o; dy += o) {
      if (dx || dy) g.fillText(text, x + dx, y + dy);
    }
    g.fillStyle = fill;
    g.fillText(text, x, y);
    g.restore();
  }

  // monospace pixel font: a word is len*size wide; spaces are drawn narrower
  lineWidth(words, size) { return words.reduce((a, w) => a + w.length * size, 0) + (words.length - 1) * size * 0.55; }

  layoutCaption(text, loud) {
    const k = this.k;
    const maxW = this.W - 2 * 60 * k;
    const words = text.toUpperCase().replace(/…/g, '...').split(/\s+/);
    let size = (loud ? 96 : 64) * k;
    const minSize = 40 * k;
    for (;;) {
      if (this.lineWidth(words, size) <= maxW) return { lines: [words], size };
      // best balanced two-line split that fits
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i), b = words.slice(i);
        const wa = this.lineWidth(a, size), wb = this.lineWidth(b, size);
        if (wa <= maxW && wb <= maxW) {
          const sc = Math.abs(wa - wb);
          if (!best || sc < best.sc) best = { sc, lines: [a, b] };
        }
      }
      if (best) return { lines: best.lines, size };
      if (size <= minSize) return { lines: [words], size };
      size = Math.max(minSize, size - 8 * k);
    }
  }

  caption(g, cap, t, shake) {
    const age = t - cap.s;
    const { lines, size } = this.layoutCaption(cap.text, cap.loud);
    const pop = cap.loud ? 1 + 0.45 * Math.max(0, 1 - age / 0.12) : 1 + 0.18 * Math.max(0, 1 - age / 0.09);
    const lh = size * 1.35;
    const cx = this.W / 2 + shake[0], cy = this.H * 0.52 + shake[1];
    g.save();
    g.translate(cx, cy);
    g.scale(pop, pop);
    if (cap.loud) g.rotate(Math.sin(cap.s * 13) * 0.035);
    lines.forEach((ws, i) => {
      const y = (i - (lines.length - 1) / 2) * lh;
      let x = -this.lineWidth(ws, size) / 2;
      for (const w of ws) {
        this.outlinedText(g, w, x, y, size, { fill: '#ffffff', align: 'left' });
        x += w.length * size + size * 0.55;
      }
    });
    g.restore();
  }

  // comic sound words ("CREEEAK", "THUD!")
  sfxWord(g, w, t) {
    const k = this.k;
    const age = t - w.t;
    if (age < 0 || age > w.dur) return;
    const pop = 1 + 0.5 * Math.max(0, 1 - age / 0.1);
    const fade = Math.min(1, (w.dur - age) / 0.15);
    g.save();
    g.globalAlpha = fade;
    g.translate(w.x * this.W, w.y * this.H);
    g.rotate(w.rot || 0);
    g.scale(pop, pop);
    const wob = w.wobble ? Math.sin(age * 40) * 3 * k : 0;
    this.outlinedText(g, w.text, wob, 0, (w.size || 48) * k, { fill: w.color || '#ffd93b', outline: '#1a0a00' });
    g.restore();
  }

  heart2D(g, x, y, size, alpha = 1, rot = 0) {
    const c = ICON_CANVAS.heart;
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = alpha;
    g.translate(x, y); g.rotate(rot);
    const w = size, h = size * c.height / c.width;
    g.drawImage(c, -w / 2, -h / 2, w, h);
    g.restore();
  }

  speedLines(g, t, strength = 1, cx = this.W / 2, cy = this.H / 2, seed = 1) {
    const n = 46;
    g.save();
    g.fillStyle = `rgba(255,255,255,${0.55 * strength})`;
    for (let i = 0; i < n; i++) {
      const r1 = Math.sin(i * 12.9898 + seed) * 43758.5453;
      const rr = r1 - Math.floor(r1);
      const a = (i / n) * Math.PI * 2 + rr * 0.1;
      const flick = (Math.floor(t * 24 + i * 7) % 3) / 3;
      const inner = (0.32 + 0.12 * rr + 0.06 * flick) * this.H;
      const outer = this.H * 0.9;
      const w = (0.006 + 0.01 * rr) * strength;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 1.0);
      g.lineTo(cx + Math.cos(a - w) * outer, cy + Math.sin(a - w) * outer);
      g.lineTo(cx + Math.cos(a + w) * outer, cy + Math.sin(a + w) * outer);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // horizontal motion streaks near a screen position (running / whoosh)
  motionStreaks(g, x, y, t, { dir = 1, n = 6, len = 220, alpha = 0.8 } = {}) {
    const k = this.k;
    g.save();
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < n; i++) {
      const yy = y + (i - n / 2) * 46 * k + Math.sin(i * 3.1) * 12 * k;
      const ph = ((t * 3 + i * 0.37) % 1);
      const l = len * k * (0.6 + 0.4 * Math.sin(i * 1.7));
      const xx = x - dir * (80 * k + ph * 120 * k);
      g.fillRect(dir > 0 ? xx - l : xx, yy, l, 7 * k);
      g.strokeRect(dir > 0 ? xx - l : xx, yy, l, 7 * k);
    }
    g.restore();
  }

  vignette(g, strength = 0.55) {
    const grd = g.createRadialGradient(this.W / 2, this.H * 0.48, this.H * 0.25, this.W / 2, this.H * 0.5, this.H * 0.75);
    grd.addColorStop(0, 'rgba(20,10,0,0)');
    grd.addColorStop(1, `rgba(20,8,0,${strength})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, this.W, this.H);
  }

  fill(g, color, alpha) {
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, alpha); g.fillStyle = color; g.fillRect(0, 0, this.W, this.H); g.restore();
  }
}
