// 2D overlay layer drawn on top of the 3D frame (1080x1920): captions, chips, bubbles, stickers, FX.
export const W = 1080, H = 1920;
export const YELLOW = '#FFD21F';
const OUTLINE = '#0b0b0b';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// pop-in scale curve: 0 -> overshoot -> 1
export function popScale(age, dur = 0.18, over = 1.14) {
  if (age <= 0) return 0;
  if (age >= dur) return 1;
  const t = age / dur;
  return t < 0.6 ? (t / 0.6) * over : over + (1 - over) * ((t - 0.6) / 0.4);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------- captions ----------------
// words: [{text, active}] ; age: seconds since this chunk appeared
export function drawCaption(ctx, words, { y = 1340, size = 88, age = 1, maxW = 800 } = {}) {
  if (!words.length) return;
  ctx.save();
  let fs = size;
  ctx.font = `${fs}px Anton`;
  const space = () => ctx.measureText(' ').width * 0.95;
  const measure = () => words.reduce((s, w) => s + ctx.measureText(w.text).width, 0) + space() * (words.length - 1);
  let total = measure();
  if (total > maxW) { fs = Math.floor(fs * maxW / total); ctx.font = `${fs}px Anton`; total = measure(); }
  const s = popScale(age, 0.12, 1.07);
  ctx.translate(W / 2, y);
  ctx.scale(s, s);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  let x = -total / 2;
  const positions = words.map((w) => { const p = x; x += ctx.measureText(w.text).width + space(); return p; });
  // outline pass (with soft shadow), then fill pass
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = fs * 0.2;
  words.forEach((w, i) => ctx.strokeText(w.text, positions[i], 0));
  ctx.shadowColor = 'transparent';
  words.forEach((w, i) => { ctx.fillStyle = w.active ? YELLOW : '#ffffff'; ctx.fillText(w.text, positions[i], 0); });
  ctx.restore();
}

// ---------------- chips ----------------
export const CHIP_COLORS = { blue: '#2f7cf6', pink: '#ef6aac', yellow: '#f4c43e', green: '#35b24a', red: '#e5463a', dark: '#3a3a3e' };
export function chipSize(ctx, text, size = 64) {
  ctx.font = `${size}px Anton`;
  const tw = ctx.measureText(text).width;
  return { w: tw + size * 0.85, h: size * 1.42 };
}
export function drawChip(ctx, text, cx, cy, { size = 64, color = 'pink', age = 1, textColor = '#fff', rot = 0 } = {}) {
  const s = popScale(age, 0.2, 1.18);
  if (s <= 0) return;
  ctx.save();
  const { w, h } = chipSize(ctx, text, size);
  ctx.translate(cx, cy);
  ctx.rotate(rot + (age < 0.3 ? Math.sin(age * 40) * 0.05 * (1 - age / 0.3) : 0));
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.26);
  ctx.fillStyle = CHIP_COLORS[color] || color; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = size * 0.11; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.font = `${size}px Anton`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor; ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}
// Lay out a row of chips centred on W/2 (positions fixed so chips don't shift as more appear).
export function chipRow(ctx, items, y, size = 64, gap = 26) {
  const sizes = items.map((it) => chipSize(ctx, it.text, size).w);
  const total = sizes.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = W / 2 - total / 2;
  return items.map((it, i) => { const cx = x + sizes[i] / 2; x += sizes[i] + gap; return { ...it, x: cx, y }; });
}

// ---------------- speech bubbles ----------------
// style: 'comic' (ellipse + wedge tail), 'rect' (rounded rect + thin line tail), 'dark' (grey pill, white text)
export function drawBubble(ctx, text, x, y, { style = 'rect', size = 64, age = 1, tail = null, font = 'Anton', textColor, wobble = 0 } = {}) {
  const s = popScale(age, 0.18, 1.15);
  if (s <= 0) return;
  ctx.save();
  ctx.font = `${size}px ${font}`;
  const tw = ctx.measureText(text).width;
  ctx.lineJoin = 'round';
  if (style === 'comic') {
    const rx = tw / 2 + size * 0.75, ry = size * 1.05;
    // tail (drawn in unscaled space toward target, then bubble on top)
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.scale(s, s);
    if (tail) {
      const tx = (tail[0] - x) / s, ty = (tail[1] - y) / s;
      const a = Math.atan2(ty, tx), b = 0.28;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - b) * rx * 0.7, Math.sin(a - b) * ry * 0.7);
      ctx.lineTo(tx * 0.62, ty * 0.62);
      ctx.lineTo(Math.cos(a + b) * rx * 0.7, Math.sin(a + b) * ry * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = size * 0.11;
      ctx.stroke(); ctx.fill();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = size * 0.11; ctx.strokeStyle = OUTLINE; ctx.stroke();
    if (tail) { // cover the tail seam
      const tx = (tail[0] - x) / s, ty = (tail[1] - y) / s, a = Math.atan2(ty, tx);
      ctx.beginPath(); ctx.ellipse(0, 0, rx - size * 0.06, ry - size * 0.06, 0, a - 0.3, a + 0.3); ctx.lineTo(0, 0); ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor || OUTLINE; ctx.fillText(text, 0, size * 0.06);
  } else {
    const padX = size * 0.4, h = size * 1.38, w = tw + padX * 2;
    if (tail && style === 'rect') { // thin leader line to the speaker (drawn unscaled)
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + Math.sign(tail[0] - x) * w * 0.45 * s, y + h * 0.1 * s); ctx.lineTo(tail[0], tail[1]); ctx.stroke();
    }
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    roundRect(ctx, -w / 2, -h / 2, w, h, size * 0.28);
    ctx.fillStyle = style === 'dark' ? 'rgba(52,52,56,0.92)' : '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (style !== 'dark') { ctx.lineWidth = size * 0.085; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
    if (tail && style === 'pointer') {
      const dir = Math.sign(tail[1] - y) || 1;
      ctx.beginPath(); ctx.moveTo(-size * 0.22, dir * h / 2 - dir * 2); ctx.lineTo(0, dir * (h / 2 + size * 0.42)); ctx.lineTo(size * 0.22, dir * h / 2 - dir * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = size * 0.085; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.fillRect(-size * 0.2, dir * h / 2 - dir * 8 - 4, size * 0.4, 8);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor || (style === 'dark' ? '#fff' : OUTLINE); ctx.fillText(text, 0, size * 0.04);
  }
  ctx.restore();
}

// ---------------- stickers ----------------
export function drawHeart(ctx, x, y, size, { age = 1, color = '#ff3f6c', alpha = 1 } = {}) {
  const s = popScale(age, 0.22, 1.25) * size;
  if (s <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.bezierCurveTo(-10, 25, -50, 5, -50, -18);
    ctx.bezierCurveTo(-50, -42, -22, -52, 0, -28);
    ctx.bezierCurveTo(22, -52, 50, -42, 50, -18);
    ctx.bezierCurveTo(50, 5, 10, 25, 0, 35);
    ctx.closePath();
  };
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  path(); ctx.fillStyle = color; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 8; ctx.strokeStyle = '#2a0710'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(-26, -22, 9, 13, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawMark(ctx, ch, x, y, size, { age = 1, color = '#fff', rot = 0, font = 'Luckiest Guy' } = {}) {
  const s = popScale(age, 0.2, 1.25);
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = OUTLINE; ctx.strokeText(ch, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; ctx.fillText(ch, 0, 0);
  ctx.restore();
}

export function drawCheck(ctx, x, y, size, { age = 1 } = {}) {
  const s = popScale(age, 0.2, 1.25) * size / 100;
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-10, 28); ctx.lineTo(42, -34);
  ctx.lineWidth = 34; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.lineWidth = 20; ctx.strokeStyle = '#3cc84e'; ctx.stroke();
  ctx.restore();
}

export function drawSparkle(ctx, x, y, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = '#fff7c0';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? size * 0.22 : size;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// impact lines radiating from a point (for big moments like MEOW!)
export function drawBurst(ctx, x, y, r0, r1, n, alpha = 1, seed = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const j = ((i * 7919 + seed * 13) % 10) / 10;
    ctx.lineWidth = 6 + j * 6;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0 * (0.9 + j * 0.2), y + Math.sin(a) * r0 * (0.9 + j * 0.2));
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- watermark ----------------
export function drawWatermark(ctx, text = '@Grace In Motion') {
  ctx.save();
  ctx.font = '40px Anton';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(text, 44, H - 70);
  ctx.restore();
}

// ---------------- full-frame FX ----------------
export function vignette(ctx, color, inner = 0.45, outer = 0.95, alpha = 1) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * inner * 0.5, W / 2, H / 2, H * outer * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function flash(ctx, amount, color = '#fff') {
  if (amount <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(amount, 0, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// cheap deterministic film grain
export function grain(ctx, seed, alpha = 0.06) {
  ctx.save();
  ctx.globalAlpha = alpha;
  let a = seed * 9301 + 49297;
  for (let i = 0; i < 1400; i++) {
    a = (a * 9301 + 49297) % 233280;
    const x = (a / 233280) * W;
    a = (a * 9301 + 49297) % 233280;
    const y = (a / 233280) * H;
    ctx.fillStyle = i % 2 ? '#000' : '#fff';
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}
