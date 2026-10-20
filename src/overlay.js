// 2D overlay: captions (Anton, white + one red word, soft shadow, 150 ms pop-in),
// her whisper speech bubble, and the A/B choice card. Designed in 1080x1920 space and
// kept inside the Instagram safe zone (y 300..1400, >= 160 px from the right edge).
import * as THREE from 'three';

const RED = '#D7263D';
const SAFE = { top: 300, bottom: 1400, left: 160, right: 920 };
const POP = 0.15;
const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const norm = (w) => w.replace(/[^A-Z0-9:']/gi, '').toUpperCase();

export class Overlay {
  constructor(W, H, scale, timeline) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.s = scale;
    this.tl = timeline;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.visible = false;
    this.lastKey = '';
  }

  draw(t, state) {
    const cap = this.tl.captions.find((c) => t >= c.start && t < c.end);
    const b = this.tl.bubble;
    const bubbleOn = b && t >= b.start && t < b.end && state.bubbleAnchor;
    const card = this.tl.choiceCard && t >= this.tl.choiceCard.start;
    // redraw only when something on the overlay changes
    const q = (x) => Math.round(Math.min(1, x) * 12);
    const key = [
      cap ? cap.text + ':' + q((t - cap.start) / POP) + ':' + (cap.wordTimes ? cap.wordTimes.map((w) => q((t - w) / POP)).join(',') : '') : '',
      bubbleOn ? q((t - b.start) / POP) + ':' + Math.round(state.bubbleAnchor.x / 6) + ',' + Math.round(state.bubbleAnchor.y / 6) : '',
      card ? [0, 0.12, 0.24].map((d) => q((t - this.tl.choiceCard.start - d) / POP)).join(',') : '',
    ].join('|');
    this.visible = !!(cap || bubbleOn || card);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    if (card) this.drawCard(t - this.tl.choiceCard.start);
    if (bubbleOn) this.drawBubble(b.text, t - b.start, state.bubbleAnchor);
    if (cap) this.drawCaption(cap, t);
    this.texture.needsUpdate = true;
  }

  shadowed(fn, blur = 22, alpha = 0.75, dy = 5) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${alpha})`;
    ctx.shadowBlur = blur * this.s;
    ctx.shadowOffsetY = dy * this.s;
    fn();
    ctx.shadowBlur = blur * 0.3 * this.s;
    ctx.shadowColor = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.shadowOffsetY = 2 * this.s;
    fn();
    ctx.restore();
  }

  // Balanced wrapping: one line if it fits, else the 2-line split with the shortest
  // longest line, else greedy. A non-breaking space keeps "2:58 AM." together.
  layout(words, size, maxW) {
    const ctx = this.ctx;
    ctx.font = `${size}px Anton`;
    const space = ctx.measureText(' ').width;
    const ws = words.map((w) => ({ text: w, width: ctx.measureText(w).width }));
    const width = (arr) => arr.reduce((s, w, i) => s + w.width + (i ? space : 0), 0);
    const line = (arr) => ({ words: arr, width: width(arr) });
    if (width(ws) <= maxW) return { lines: [line(ws)], space };
    let best = null;
    for (let i = 1; i < ws.length; i++) {
      const a = line(ws.slice(0, i));
      const b = line(ws.slice(i));
      const m = Math.max(a.width, b.width);
      if (!best || m < best.m) best = { m, lines: [a, b] };
    }
    if (best && best.m <= maxW) return { lines: best.lines, space };
    const lines = [];
    let cur = [];
    for (const w of ws) {
      if (cur.length && width([...cur, w]) > maxW) {
        lines.push(line(cur));
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) lines.push(line(cur));
    return { lines, space };
  }

  drawCaption(cap, t) {
    const ctx = this.ctx;
    const words = cap.text.split(/\s+/);
    const maxW = SAFE.right - SAFE.left - 20;
    let size = 100;
    let L = this.layout(words, size, maxW);
    while ((L.lines.length > 2 || L.lines.some((l) => l.width > maxW)) && size > 64) {
      size -= 6;
      L = this.layout(words, size, maxW);
    }
    const lh = size * 1.08;
    const bottom = 1335;
    const top = bottom - L.lines.length * lh;
    const cx = (SAFE.left + SAFE.right) / 2;
    const cy = (top + bottom) / 2;
    const p = easeOut((t - cap.start) / POP);
    ctx.save();
    if (!cap.wordTimes) {
      ctx.translate(cx, cy);
      ctx.scale(0.9 + 0.1 * p, 0.9 + 0.1 * p);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = p;
    }
    ctx.font = `${size}px Anton`;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
    let wi = 0;
    L.lines.forEach((line, li) => {
      let x = cx - line.width / 2;
      const y = top + (li + 1) * lh - size * 0.2;
      for (const w of line.words) {
        const isRed = cap.red && norm(w.text) === norm(cap.red);
        let wp = 1;
        if (cap.wordTimes) wp = easeOut((t - cap.wordTimes[Math.min(wi, cap.wordTimes.length - 1)]) / POP);
        if (wp > 0) {
          ctx.save();
          if (cap.wordTimes) {
            const wx = x + w.width / 2;
            const wy = y - size * 0.35;
            ctx.translate(wx, wy);
            ctx.scale(0.9 + 0.1 * wp, 0.9 + 0.1 * wp);
            ctx.translate(-wx, -wy);
            ctx.globalAlpha = wp;
          }
          const parts = w.text.split('\u00a0');
          let px = x;
          parts.forEach((part, pi) => {
            const label = pi < parts.length - 1 ? part + '\u00a0' : part;
            const red = isRed || (cap.red && norm(part) === norm(cap.red));
            ctx.fillStyle = red ? RED : '#FFFFFF';
            const tx = px;
            this.shadowed(() => ctx.fillText(label, tx, y));
            px += ctx.measureText(label).width;
          });
          ctx.restore();
        }
        x += w.width + L.space;
        wi++;
      }
    });
    ctx.restore();
  }

  drawBubble(text, lt, anchor) {
    const ctx = this.ctx;
    const p = easeOut(lt / POP);
    const size = 52;
    ctx.font = `700 ${size}px Oswald`;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const tryL = cur ? cur + ' ' + w : w;
      if (ctx.measureText(tryL).width > 430 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = tryL;
    }
    lines.push(cur);
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = 40;
    const padY = 28;
    const lh = size * 1.18;
    const bw = tw + padX * 2;
    const bh = lines.length * lh + padY * 2 - (lh - size) * 0.6;
    // keep the bubble above her reflected face, inside the safe zone
    const bx = Math.min(SAFE.right - bw, Math.max(60, anchor.x - bw * 0.55));
    const by = Math.min(SAFE.bottom - 520 - bh, Math.max(SAFE.top + 40, anchor.y - bh - 150));
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.9 + 0.1 * p, 0.9 + 0.1 * p);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = p;
    // tail: from the bubble's bottom edge, pointing at her face
    const ax = Math.min(bx + bw - 60, Math.max(bx + 60, anchor.x));
    const dir = Math.atan2(anchor.y - (by + bh), anchor.x - ax);
    const tipLen = 58;
    const tip = { x: ax + Math.cos(dir) * tipLen, y: by + bh + Math.max(30, Math.sin(dir) * tipLen) };
    const path = new Path2D();
    const r = 38;
    path.moveTo(bx + r, by);
    path.arcTo(bx + bw, by, bx + bw, by + bh, r);
    path.arcTo(bx + bw, by + bh, bx, by + bh, r);
    path.lineTo(ax + 24, by + bh);
    path.lineTo(tip.x, tip.y);
    path.lineTo(ax - 18, by + bh);
    path.arcTo(bx, by + bh, bx, by, r);
    path.arcTo(bx, by, bx + bw, by, r);
    path.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 30 * this.s;
    ctx.shadowOffsetY = 8 * this.s;
    ctx.fillStyle = '#FFFFFF';
    ctx.fill(path);
    ctx.restore();
    ctx.fillStyle = '#121826';
    ctx.font = `700 ${size}px Oswald`;
    ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, cx, by + padY + size * 0.86 + i * lh));
    ctx.restore();
  }

  drawCard(lt) {
    const ctx = this.ctx;
    const C = this.tl.choiceCard;
    const x = SAFE.left;
    const w = SAFE.right - SAFE.left;
    const y = 520;
    const h = 560;
    const p = easeOut(lt / POP);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.9 + 0.1 * p, 0.9 + 0.1 * p);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = p;
    const panel = new Path2D();
    panel.roundRect(x, y, w, h, 40);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40 * this.s;
    ctx.fillStyle = 'rgba(8,12,21,0.84)';
    ctx.fill(panel);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.stroke(panel);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '82px Anton';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillText(C.title, cx, y + 118);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 60, y + 146, 120, 4);
    C.options.forEach(([letter, label], i) => {
      const op = easeOut((lt - 0.12 * (i + 1)) / POP);
      if (op <= 0) return;
      const oy = y + 190 + i * 170;
      const ox = x + 34;
      const ow = w - 68;
      const oh = 140;
      ctx.save();
      ctx.globalAlpha = p * op;
      const ocx = ox + ow / 2;
      const ocy = oy + oh / 2;
      ctx.translate(ocx, ocy);
      ctx.scale(0.9 + 0.1 * op, 0.9 + 0.1 * op);
      ctx.translate(-ocx, -ocy);
      const pill = new Path2D();
      pill.roundRect(ox, oy, ow, oh, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill(pill);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke(pill);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ox + 72, ocy, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1524';
      ctx.font = '60px Anton';
      ctx.textAlign = 'center';
      ctx.fillText(letter, ox + 72, ocy + 22);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      const maxTW = ow - 150;
      let size = 58;
      ctx.font = `${size}px Anton`;
      const words = label.split(' ');
      let lines = [label];
      if (ctx.measureText(label).width > maxTW) {
        size = 50;
        ctx.font = `${size}px Anton`;
        const half = Math.ceil(words.length / 2);
        lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
      }
      const lh = size * 1.05;
      const ty = ocy - ((lines.length - 1) * lh) / 2 + size * 0.36;
      lines.forEach((l, k) => ctx.fillText(l, ox + 140, ty + k * lh));
      ctx.restore();
    });
    ctx.restore();
  }
}
