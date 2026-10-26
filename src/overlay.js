// 2D text layer: DAY labels (+ draining battery), captions with red words,
// gold info labels and name tags. Drawn on a canvas at output resolution.
import { clamp, ease, ramp } from './util.js';

export const GOLD = '#F2B544';
export const RED = '#E5383B';
export const SAFE = { top: 300, bottom: 1400, right: 160, left: 40 };
export const WATERMARK = '@garden_reels';

export async function loadFonts() {
  const faces = [
    new FontFace('MontBlack', 'url(/assets/fonts/Montserrat-Black.ttf)', { weight: '900' }),
    new FontFace('MontXB', 'url(/assets/fonts/Montserrat-ExtraBold.ttf)', { weight: '800' }),
  ];
  for (const f of faces) {
    await f.load();
    document.fonts.add(f);
  }
}

export class Overlay {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.k = W / 1080; // all layout is authored for 1080x1920
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  // gold uppercase label (Montserrat Black, letter spacing 2px, soft dark shadow)
  label(text, x, y, size, o = {}) {
    const c = this.ctx, k = this.k;
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.002) return;
    c.save();
    c.translate(x * k, y * k);
    const s = o.scale ?? 1;
    c.scale(s, s);
    c.font = `900 ${size * k}px MontBlack`;
    c.letterSpacing = `${2 * k}px`;
    c.textAlign = o.align ?? 'center';
    c.textBaseline = 'middle';
    c.globalAlpha = alpha;
    c.shadowColor = 'rgba(0,0,0,0.75)';
    c.shadowBlur = 14 * k;
    c.shadowOffsetY = 3 * k;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(20,12,0,0.45)';
    c.lineWidth = Math.max(2, size * 0.09) * k;
    c.strokeText(text.toUpperCase(), 0, 0);
    c.shadowColor = 'transparent';
    c.fillStyle = o.color ?? GOLD;
    c.fillText(text.toUpperCase(), 0, 0);
    c.restore();
  }

  // headlamp battery: level 0..1, red when low, optional blink
  battery(x, y, level, alpha = 1, blinkOn = true) {
    if (alpha <= 0.002) return;
    const c = this.ctx, k = this.k;
    const w = 74 * k, h = 32 * k, r = 7 * k;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x * k, y * k);
    c.shadowColor = 'rgba(0,0,0,0.7)';
    c.shadowBlur = 10 * k;
    c.shadowOffsetY = 2 * k;
    // tiny lamp glyph
    c.strokeStyle = 'rgba(255,255,255,0.92)';
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.lineWidth = 3.2 * k;
    const lx = -w / 2 - 30 * k;
    c.beginPath();
    c.arc(lx, 0, 7 * k, 0, Math.PI * 2);
    c.fill();
    for (const a of [-0.55, 0, 0.55]) {
      c.beginPath();
      c.moveTo(lx + Math.cos(a) * 12 * k, Math.sin(a) * 12 * k);
      c.lineTo(lx + Math.cos(a) * 19 * k, Math.sin(a) * 19 * k);
      c.stroke();
    }
    // body
    const rr = (x0, y0, ww, hh, rad) => {
      c.beginPath();
      c.moveTo(x0 + rad, y0);
      c.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, rad);
      c.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, rad);
      c.arcTo(x0, y0 + hh, x0, y0, rad);
      c.arcTo(x0, y0, x0 + ww, y0, rad);
      c.closePath();
    };
    rr(-w / 2, -h / 2, w, h, r);
    c.stroke();
    c.shadowColor = 'transparent';
    c.fillRect(w / 2 + 2 * k, -h / 4, 5 * k, h / 2);
    const low = level < 0.3;
    if (blinkOn && level > 0) {
      c.fillStyle = low ? RED : GOLD;
      const inner = (w - 10 * k) * clamp(level, 0, 1);
      rr(-w / 2 + 5 * k, -h / 2 + 5 * k, Math.max(inner, 3 * k), h - 10 * k, 3 * k);
      c.fill();
    }
    c.restore();
  }

  // caption with red words; pop-in scale .92->1 + fade over 150ms
  caption(cap, t) {
    if (!cap) return;
    const c = this.ctx, k = this.k;
    const age = t - cap.start;
    const pop = ease.outCubic(ramp(age, 0, 0.15));
    const out = 1 - ramp(t, cap.end - 0.08, cap.end);
    const alpha = pop * out;
    if (alpha <= 0.002) return;
    const s = 0.92 + 0.08 * pop;
    const size = cap.size ?? 60;
    const lh = size * 1.2;
    const cx = 490, cy = 1300;
    const red = new Set((cap.red || []).map((w) => w.toLowerCase()));
    c.save();
    c.globalAlpha = alpha;
    c.translate(cx * k, cy * k);
    c.scale(s, s);
    c.font = `800 ${size * k}px MontXB`;
    c.letterSpacing = '0px';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const lines = cap.lines;
    const y0 = -((lines.length - 1) * lh) / 2;
    for (let li = 0; li < lines.length; li++) {
      const words = lines[li].split(' ');
      const space = c.measureText(' ').width;
      const widths = words.map((w) => c.measureText(w).width);
      const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
      let x = -total / 2;
      const y = (y0 + li * lh) * k;
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        const core = w.replace(/[^\w']/g, '').toLowerCase();
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 16 * k;
        c.shadowOffsetY = 3 * k;
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 7 * k;
        c.strokeText(w, x, y);
        c.shadowColor = 'transparent';
        c.fillStyle = red.has(core) ? RED : '#FFFFFF';
        c.fillText(w, x, y);
        x += widths[wi] + space;
      }
    }
    c.restore();
  }

  // dotted measuring line (screen coords) with progress 0..1 from top to bottom
  dotted(x, y1, y2, progress, alpha = 1) {
    if (alpha <= 0.002 || progress <= 0) return;
    const c = this.ctx, k = this.k;
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 6 * k;
    c.strokeStyle = GOLD;
    c.lineWidth = 5 * k;
    c.lineCap = 'round';
    c.setLineDash([2 * k, 16 * k]);
    const yEnd = y1 + (y2 - y1) * progress;
    c.beginPath();
    c.moveTo(x * k, y1 * k);
    c.lineTo(x * k, yEnd * k);
    c.stroke();
    c.setLineDash([]);
    c.lineWidth = 4 * k;
    c.beginPath();
    c.moveTo((x - 22) * k, y1 * k);
    c.lineTo((x + 22) * k, y1 * k);
    if (progress >= 0.999) {
      c.moveTo((x - 22) * k, y2 * k);
      c.lineTo((x + 22) * k, y2 * k);
    }
    c.stroke();
    c.restore();
  }

  watermark() {
    const c = this.ctx, k = this.k;
    c.save();
    c.font = `800 ${26 * k}px MontXB`;
    c.letterSpacing = `${1 * k}px`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.globalAlpha = 0.62;
    c.shadowColor = 'rgba(0,0,0,0.7)';
    c.shadowBlur = 8 * k;
    c.shadowOffsetY = 2 * k;
    c.fillStyle = '#FFFFFF';
    c.fillText(WATERMARK, 60 * k, 1385 * k);   // bottom-left, inside the safe zone, below the captions
    c.restore();
  }

  draw(st, t) {
    this.clear();
    this.watermark();
    if (!st) return;
    if (st.day) {
      const d = st.day;
      const age = t - d.t0;
      const pop = age < 0 ? 0 : age < 0.18 ? ease.outCubic(age / 0.18) * 1.14 : 1.14 - 0.14 * ease.outCubic(ramp(age, 0.18, 0.36));
      const a = ramp(age, 0, 0.12) * (d.alpha ?? 1);
      this.label(d.text, 520, 330, d.size ?? 74, { alpha: a, scale: Math.max(0.01, 0.55 + 0.45 * pop) });
      if (d.battery !== null && d.battery !== undefined) {
        const blink = d.blink ? Math.floor(t * 3.2) % 2 === 0 : true;
        this.battery(540, 410, d.battery, ramp(age, 0.15, 0.35) * (d.alpha ?? 1), blink);
      }
    }
    for (const ln of st.lines || []) this.dotted(ln.x, ln.y1, ln.y2, ln.progress, ln.alpha);
    for (const lb of st.labels || []) {
      const x = clamp(lb.x, SAFE.left + 120, 1080 - SAFE.right - 120);
      const y = clamp(lb.y, SAFE.top + 20, SAFE.bottom - 20);
      this.label(lb.text, x, y, lb.size ?? 44, { alpha: lb.alpha ?? 1, scale: lb.scale ?? 1 });
    }
    if (st.caption) this.caption(st.caption, t);
  }
}
