import * as THREE from 'three';
import { clamp, ease, remap, lerp } from './util.js';

// Caption palette (sRGB, drawn after tone mapping).
export const C = {
  white: '#FFFFFF',
  yellow: '#FFD60A',
  red: '#FF3B30',
  green: '#3DF07F',
  blue: '#5AC8FF',
  ink: 'rgba(4, 8, 22, 0.92)',
};

export const SAFE = { left: 70, right: 1010, top: 250, bottom: 1500 };

const font = (size, weight = 900) => `${weight} ${size}px Montserrat`;

export class Overlay {
  constructor(W, H, scale) {
    this.W = W;
    this.H = H;
    this.scale = scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.premultiplyAlpha = true;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }
  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }
  end() {
    this.texture.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------
// Kinetic captions
// ---------------------------------------------------------------------------------------------

function splitWords(parts) {
  // -> [{text, color}] words with trailing-space info
  const words = [];
  for (const [text, color] of parts) {
    const tokens = text.split(/(\s+)/);
    for (const tok of tokens) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) {
        if (words.length) words[words.length - 1].space = true;
        continue;
      }
      words.push({ text: tok, color, space: false });
    }
  }
  return words;
}

function drawWord(ctx, text, x, y, size, color, { alpha = 1, flash = 0, glow = 0 } = {}) {
  ctx.globalAlpha = alpha;
  ctx.font = font(size);
  // soft drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 10, 0.75)';
  ctx.shadowBlur = size * 0.32;
  ctx.shadowOffsetY = size * 0.07;
  ctx.lineWidth = size * 0.17;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(text, x, y);
  ctx.restore();
  // crisp outline
  ctx.lineWidth = size * 0.15;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(text, x, y);
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.5 * glow;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * glow * 0.6;
    ctx.fillText(text, x, y);
    ctx.restore();
    ctx.globalAlpha = alpha;
  }
  // fill: subtle vertical gradient for depth
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
  const top = flash > 0 ? mixHex(color, '#FFFFFF', flash) : color;
  g.addColorStop(0, mixHex(top, '#FFFFFF', 0.18));
  g.addColorStop(0.55, top);
  g.addColorStop(1, mixHex(top, '#000000', 0.12));
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
function rgbToHex(s) {
  if (s.startsWith('#')) return s;
  const m = s.match(/\d+/g).map(Number);
  return '#' + m.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Line animation state for time since the line's start (tin) and until the caption's end (tout).
function lineAnim(anim, tin, tout, outAnim, outDur) {
  let s = 1;
  let a = 1;
  let dy = 0;
  let dx = 0;
  let flash = 0;
  let blur = 0;
  if (anim === 'slam') {
    const p = clamp(tin / 0.22);
    s = lerp(2.3, 1, ease.outCubic(p));
    if (p >= 1) s = 1 + 0.035 * Math.exp(-(tin - 0.22) * 9) * Math.sin((tin - 0.22) * 40);
    a = clamp(tin / 0.07);
    flash = 1 - clamp((tin - 0.12) / 0.35);
  } else if (anim === 'slide') {
    const p = clamp(tin / 0.38);
    dx = lerp(-700, 0, ease.outExpo(p));
    a = clamp(tin / 0.12);
    blur = 1 - p;
  } else if (anim === 'rise') {
    const p = clamp(tin / 0.45);
    dy = lerp(70, 0, ease.outCubic(p));
    a = ease.outQuad(p);
  } else {
    // 'pop' handled per word; whole-line fallback
    const p = clamp(tin / 0.3);
    s = p <= 0 ? 0 : ease.outBack(p, 2.2) * 0.25 + 0.75 * ease.outCubic(p);
    a = clamp(tin / 0.1);
  }
  if (tout < outDur) {
    const q = 1 - clamp(tout / outDur);
    if (outAnim === 'up') {
      dy -= 90 * ease.inCubic(q);
      a *= 1 - ease.inQuad(q);
    } else if (outAnim === 'fade') {
      a *= 1 - q;
    } else if (outAnim === 'zoom') {
      s *= 1 + 0.6 * ease.inCubic(q);
      a *= 1 - ease.inQuad(q);
    } else {
      s *= lerp(1, 0.6, ease.inBack(q, 1.8));
      a *= 1 - ease.inQuad(q);
    }
  }
  return { s, a, dy, dx, flash, blur };
}

// cap: { t0, t1, x?, y, maxWidth?, lineGap?, out?, outDur?, lines: [{ parts:[[text,color]...], size, at, anim, stagger }] }
export function drawCaption(ctx, cap, t, shake = [0, 0]) {
  if (t < cap.t0 || t > cap.t1) return;
  const cx = (cap.x ?? 540) + shake[0];
  const maxW = cap.maxWidth ?? 940;
  const gap = cap.lineGap ?? 1.08;
  const outDur = cap.outDur ?? 0.22;
  // fit sizes
  const lines = cap.lines.map((ln) => {
    const words = splitWords(ln.parts);
    let size = ln.size;
    ctx.font = font(size);
    const spaceW = () => ctx.measureText(' ').width;
    const measure = () => words.reduce((w, wd, i) => w + ctx.measureText(wd.text).width + (wd.space && i < words.length - 1 ? spaceW() : 0), 0);
    let total = measure();
    if (total > maxW) {
      size = Math.floor((size * maxW) / total);
      ctx.font = font(size);
      total = measure();
    }
    return { ...ln, words, size, total };
  });
  // vertical layout: cap.y is the centre of the block
  const heights = lines.map((l) => l.size * 0.74);
  const blockH = heights.reduce((a, h) => a + h, 0) + lines.slice(1).reduce((a, l) => a + l.size * (gap - 0.74), 0);
  let y = cap.y - blockH / 2 + shake[1];
  lines.forEach((ln, li) => {
    if (li > 0) y += ln.size * (gap - 0.74);
    y += heights[li];
    const tin = t - (cap.t0 + (ln.at ?? 0));
    const tout = cap.t1 - t;
    if (tin < 0) return;
    ctx.font = font(ln.size);
    const spaceW = ctx.measureText(' ').width;
    const st = lineAnim(ln.anim || 'pop', tin, tout, cap.out || 'pop', outDur);
    if (st.a <= 0.001) return;
    const baseline = y - ln.size * 0.02;
    let x = cx - ln.total / 2;
    const midY = baseline - ln.size * 0.36;
    ln.words.forEach((wd, wi) => {
      const ww = ctx.measureText(wd.text).width;
      const wx = x + ww / 2;
      let s = st.s;
      let a = st.a;
      let dy = st.dy;
      if ((ln.anim || 'pop') === 'pop') {
        const wt = tin - wi * (ln.stagger ?? 0.07);
        const p = clamp(wt / 0.32);
        s = p <= 0 ? 0 : ease.outBack(p, 1.5);
        a = clamp(wt / 0.08);
        dy = lerp(26, 0, ease.outCubic(p));
        if (tout < outDur) {
          const o = lineAnim('none', 1, tout, cap.out || 'pop', outDur);
          s *= o.s;
          a *= o.a;
          dy += o.dy;
        }
      }
      if (s > 0.001 && a > 0.001) {
        ctx.save();
        ctx.translate(wx + st.dx, midY + dy);
        ctx.scale(s, s);
        if (st.blur > 0.02) {
          for (let k = 3; k >= 1; k--) {
            ctx.save();
            ctx.translate(-k * 38 * st.blur, 0);
            drawWord(ctx, wd.text, -ww / 2, baseline - midY, ln.size, rgbToHex(wd.color), { alpha: a * 0.18 });
            ctx.restore();
          }
        }
        drawWord(ctx, wd.text, -ww / 2, baseline - midY, ln.size, rgbToHex(wd.color), {
          alpha: a,
          flash: st.flash,
          glow: ln.glow ?? 0,
        });
        ctx.restore();
      }
      x += ww + (wd.space ? spaceW : 0);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Labels, chips, divider, icons
// ---------------------------------------------------------------------------------------------

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Pill label centred at (x, y). p = appear progress (0..1+), a = alpha.
export function drawPill(ctx, { x, y, text, size = 40, color = C.white, accent = C.blue, p = 1, a = 1, icon = null, weight = 800 }) {
  if (p <= 0 || a <= 0) return;
  const s = ease.outBack(clamp(p), 2.0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a * clamp(p * 3);
  ctx.font = font(size, weight);
  const tw = ctx.measureText(text).width;
  const iconW = icon ? size * 1.15 : 0;
  const padX = size * 0.62;
  const w = tw + iconW + padX * 2;
  const h = size * 1.62;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(6, 12, 32, 0.78)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = accent;
  ctx.stroke();
  // inner glow line
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.globalAlpha *= 0.65;
  ctx.stroke();
  ctx.restore();
  let tx = -w / 2 + padX;
  if (icon) {
    icon(ctx, tx + size * 0.45, 0, size * 0.48, accent);
    tx += iconW;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, tx, size * 0.04);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// Before/after divider line with a round handle.
export function drawDivider(ctx, x, a, { top = 0, bottom = 1920, handleY = 960 } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(140, 210, 255, 0.95)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - 3, top, 6, bottom - top);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, handleY, 38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 14, 34, 0.9)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + d * 8, handleY - 12);
    ctx.lineTo(x + d * 22, handleY);
    ctx.lineTo(x + d * 8, handleY + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Vertical double-headed arrow from y0 to y1 at x (screen space).
export function drawRangeArrow(ctx, x, y0, y1, { color = C.blue, a = 1, width = 12, head = 30 } = {}) {
  if (a <= 0 || Math.abs(y1 - y0) < 2) return;
  const top = Math.min(y0, y1);
  const bot = Math.max(y0, y1);
  const len = bot - top;
  const hh = Math.min(head, len * 0.42);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + hh * 0.85, top + hh);
  ctx.lineTo(x + width / 2, top + hh);
  ctx.lineTo(x + width / 2, bot - hh);
  ctx.lineTo(x + hh * 0.85, bot - hh);
  ctx.lineTo(x, bot);
  ctx.lineTo(x - hh * 0.85, bot - hh);
  ctx.lineTo(x - width / 2, bot - hh);
  ctx.lineTo(x - width / 2, top + hh);
  ctx.lineTo(x - hh * 0.85, top + hh);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

// Simple line icons drawn around (x, y) with radius r.
export const ICONS = {
  compass(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.42, y - r * 0.42);
    ctx.lineTo(x + r * 0.12, y + r * 0.12);
    ctx.lineTo(x - r * 0.42, y + r * 0.42);
    ctx.lineTo(x - r * 0.12, y - r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  eye(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y - r * 1.05, x + r, y);
    ctx.quadraticCurveTo(x, y + r * 1.05, x - r, y);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  cycle(ctx, x, y, r, color) {
    // lunar cycle: crescent inside circular arrows
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI * 0.35, Math.PI * 1.25);
    ctx.stroke();
    const ax = x + r * Math.cos(-Math.PI * 0.35);
    const ay = y + r * Math.sin(-Math.PI * 0.35);
    ctx.beginPath();
    ctx.moveTo(ax + r * 0.32, ay - r * 0.05);
    ctx.lineTo(ax - r * 0.1, ay - r * 0.32);
    ctx.lineTo(ax - r * 0.05, ay + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.48, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x - r * 0.18, y, r * 0.38, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  check(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.05);
    ctx.lineTo(x - r * 0.2, y + r * 0.55);
    ctx.lineTo(x + r * 0.75, y - r * 0.55);
    ctx.stroke();
    ctx.restore();
  },
  sun(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(an) * r * 0.68, y + Math.sin(an) * r * 0.68);
      ctx.lineTo(x + Math.cos(an) * r * 0.98, y + Math.sin(an) * r * 0.98);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// Pop-in progress helper for overlay elements: returns {p, a} for an element visible in [t0, t1].
export function appear(t, t0, t1, inDur = 0.35, outDur = 0.2) {
  const p = remap(t, t0, t0 + inDur);
  const a = t < t0 ? 0 : t > t1 ? 0 : 1 - remap(t, t1 - outDur, t1);
  return { p, a };
}
