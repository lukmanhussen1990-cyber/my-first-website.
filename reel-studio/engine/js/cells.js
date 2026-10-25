// Cell biology props, drawn in the plate style: normal, cancer and immune cells
// (paper and X-ray versions), a virus, a DNA double helix with copy errors, a rolling
// odometer counter, a fake "don't attack me" badge, a moon bootprint and ink tool icons.
import { clamp, lerp, ease, prog, rng, hash, noise1, makeCanvas, COLORS } from './util.js';
import { FONTS } from './assets.js';
import { Actor, Scene } from './timeline.js';
import { setFont, cached, inkText, strokePartial } from './draw.js';
import { smoothPath } from './lab.js';

const TAU = Math.PI * 2;

// lumpy (or round) outline, in units of the radius
function blob(seed, t, lump, n = 64) {
  const r = rng(seed * 101 + 7), ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + lump * (0.55 * Math.sin(3 * a + ph[0] + t * 0.35) + 0.35 * Math.sin(5 * a + ph[1] - t * 0.25) + 0.22 * Math.sin(8 * a + ph[2] + t * 0.6))
      + 0.012 * Math.sin(4 * a + ph[3] + t * 1.3);
    pts.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  return smoothPath(pts);
}

function hatch(ctx, path, color, step = 0.11, w = 0.012) {
  // engraving hatch on the shadow side (lower right), clipped to the cell
  ctx.save(); ctx.clip(path);
  const g = ctx.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, color);
  ctx.strokeStyle = g; ctx.lineWidth = w;
  for (let k = -2; k < 2; k += step) { ctx.beginPath(); ctx.moveTo(k, -1.2); ctx.lineTo(k + 1.4, 1.2); ctx.stroke(); }
  ctx.restore();
}

// type: 'normal' | 'cancer' | 'immune'; look: 'paper' | 'xray'
export function drawCell(ctx, x, y, R, t, o = {}) {
  const type = o.type || 'normal', xr = o.look === 'xray', seed = o.seed ?? 1;
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.rot ?? 0);
  const breathe = 1 + 0.015 * Math.sin(t * 1.7 + seed);
  ctx.scale(R * breathe * (o.sx ?? 1), R * breathe * (o.sy ?? 1));
  ctx.globalAlpha *= a;
  const u = 1 / R;
  const lump = type === 'cancer' ? 0.085 : type === 'immune' ? 0.02 : 0.03;
  const path = blob(seed, t, lump);
  if (type === 'immune') {
    // short surface spikes (receptors)
    const n = 28;
    ctx.save();
    ctx.strokeStyle = xr ? 'rgba(190,232,255,0.85)' : 'rgba(78,74,112,0.85)'; ctx.lineWidth = 2.4 * u; ctx.lineCap = 'round';
    if (xr) { ctx.shadowColor = 'rgba(140,210,255,0.9)'; ctx.shadowBlur = 8; }
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + seed, len = 0.14 + 0.05 * Math.sin(i * 2.3 + t * 2 + seed);
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 0.98, Math.sin(ang) * 0.98); ctx.lineTo(Math.cos(ang) * (1 + len), Math.sin(ang) * (1 + len)); ctx.stroke();
      ctx.beginPath(); ctx.arc(Math.cos(ang) * (1 + len), Math.sin(ang) * (1 + len), 0.035, 0, TAU);
      ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }
    ctx.restore();
  }
  if (xr) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (type === 'cancer') {
      const glow = 0.75 + 0.25 * Math.sin(t * 3.1 + seed);
      ctx.shadowColor = `rgba(255,80,36,${0.95 * glow})`; ctx.shadowBlur = Math.max(12, R * 0.9);
      ctx.fillStyle = `rgba(255,96,44,${0.5 * glow})`; ctx.fill(path);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,170,120,0.9)'; ctx.lineWidth = 2.5 * u; ctx.stroke(path);
      ctx.fillStyle = 'rgba(255,226,190,0.85)'; ctx.beginPath(); ctx.ellipse(0.06, -0.02, 0.42, 0.36, 0.4, 0, TAU); ctx.fill();
    } else if (type === 'immune') {
      ctx.shadowColor = 'rgba(140,210,255,0.9)'; ctx.shadowBlur = Math.max(10, R * 0.6);
      ctx.fillStyle = 'rgba(150,205,240,0.28)'; ctx.fill(path);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(205,238,255,0.9)'; ctx.lineWidth = 2.5 * u; ctx.stroke(path);
      ctx.fillStyle = 'rgba(200,232,255,0.55)'; ctx.beginPath(); ctx.arc(-0.05, 0.03, 0.6, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(225,225,214,0.12)'; ctx.fill(path);
      ctx.strokeStyle = 'rgba(230,230,220,0.55)'; ctx.lineWidth = 2 * u; ctx.stroke(path);
      ctx.fillStyle = 'rgba(230,230,220,0.22)'; ctx.beginPath(); ctx.arc(0.08, -0.05, 0.34, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    return;
  }
  // paper look: soft contact shadow, stained-plate colours, engraving hatch
  if (o.shadow !== false) {
    ctx.save(); ctx.globalAlpha *= 0.25; ctx.translate(0.08, 0.12); ctx.fillStyle = '#2a1a0a';
    ctx.filter = `blur(${Math.max(2, R * 0.08)}px)`; ctx.fill(path); ctx.restore();
  }
  if (type === 'cancer') {
    const glow = 0.7 + 0.3 * Math.sin(t * 2.6 + seed);
    ctx.save(); ctx.shadowColor = `rgba(205,55,35,${0.65 * glow})`; ctx.shadowBlur = Math.max(14, R * 0.55);
    ctx.fillStyle = '#d99c87'; ctx.fill(path); ctx.restore();
  }
  const g = ctx.createRadialGradient(-0.3, -0.35, 0.1, 0, 0, 1.05);
  if (type === 'cancer') { g.addColorStop(0, '#f1d0c2'); g.addColorStop(0.6, '#dea08b'); g.addColorStop(1, '#c4735d'); }
  else if (type === 'immune') { g.addColorStop(0, '#f1eff6'); g.addColorStop(0.65, '#d9d8e7'); g.addColorStop(1, '#b9b9d1'); }
  else { g.addColorStop(0, '#f6ecd6'); g.addColorStop(0.65, '#e6d4b2'); g.addColorStop(1, '#cdb48a'); }
  ctx.fillStyle = g; ctx.fill(path);
  // cytoplasm granules
  const r = rng(seed * 31 + 9);
  ctx.fillStyle = type === 'cancer' ? 'rgba(120,40,30,0.25)' : type === 'immune' ? 'rgba(90,80,130,0.2)' : 'rgba(110,80,40,0.2)';
  for (let i = 0; i < 26; i++) { const aa = r() * TAU, d = 0.3 + r() * 0.6; ctx.beginPath(); ctx.arc(Math.cos(aa) * d, Math.sin(aa) * d, 0.018 + r() * 0.02, 0, TAU); ctx.fill(); }
  hatch(ctx, path, type === 'cancer' ? 'rgba(110,30,20,0.35)' : 'rgba(70,50,30,0.3)');
  // nucleus
  ctx.save();
  if (type === 'immune') {
    const ng = ctx.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 0.66);
    ng.addColorStop(0, '#9a86bf'); ng.addColorStop(1, '#5b477e');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.ellipse(-0.04, 0.04, 0.64, 0.6, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(50,36,80,0.7)'; ctx.lineWidth = 1.6 * u; ctx.stroke();
  } else if (type === 'cancer') {
    const np = blob(seed + 7, t * 0.6, 0.14, 40);
    ctx.translate(0.06, -0.02); ctx.scale(0.5, 0.44); ctx.rotate(0.4);
    const ng = ctx.createRadialGradient(-0.3, -0.3, 0.05, 0, 0, 1);
    ng.addColorStop(0, '#a85a45'); ng.addColorStop(1, '#6c2b1f');
    ctx.fillStyle = ng; ctx.fill(np);
    ctx.strokeStyle = 'rgba(70,20,14,0.8)'; ctx.lineWidth = 3 * u / 0.47; ctx.stroke(np);
    ctx.fillStyle = '#3a120c'; ctx.beginPath(); ctx.arc(-0.25, 0.1, 0.17, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0.3, -0.18, 0.12, 0, TAU); ctx.fill();
  } else {
    const ng = ctx.createRadialGradient(-0.12, -0.12, 0.03, 0.06, -0.04, 0.34);
    ng.addColorStop(0, '#c49d70'); ng.addColorStop(1, '#94683f');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0.06, -0.04, 0.33, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,52,26,0.75)'; ctx.lineWidth = 1.6 * u; ctx.stroke();
    ctx.fillStyle = '#5c3a1c'; ctx.beginPath(); ctx.arc(0.1, -0.06, 0.09, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // membrane
  ctx.strokeStyle = type === 'cancer' ? 'rgba(150,40,26,0.95)' : type === 'immune' ? 'rgba(70,64,104,0.9)' : 'rgba(110,78,44,0.85)';
  ctx.lineWidth = (type === 'cancer' ? 3.2 : 2.4) * u; ctx.stroke(path);
  ctx.save(); ctx.scale(0.955, 0.955); ctx.strokeStyle = 'rgba(255,250,240,0.45)'; ctx.lineWidth = 1.4 * u; ctx.stroke(path); ctx.restore();
  ctx.restore();
}

// A virus drawn like an engraving: stippled sphere with club-shaped spikes.
export function drawVirus(ctx, x, y, R, t = 0, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot ?? 0) + t * 0.15); ctx.scale(R, R);
  const u = 1 / R, ink = o.ink || 'rgba(46,28,12,0.92)';
  const n = 16;
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.95, Math.sin(a) * 0.95); ctx.lineTo(Math.cos(a) * 1.28, Math.sin(a) * 1.28); ctx.stroke();
    ctx.fillStyle = o.accent || '#b8432c';
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * 1.34, Math.sin(a) * 1.34, 0.1, 0.075, a, 0, TAU); ctx.fill(); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-0.35, -0.35, 0.1, 0, 0, 1);
  g.addColorStop(0, '#e9dcc0'); g.addColorStop(1, '#bfa57a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
  const r = rng(77);
  ctx.fillStyle = 'rgba(60,40,20,0.5)';
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, d = Math.sqrt(r());
    const sx = Math.cos(a) * d, sy = Math.sin(a) * d;
    if (sx + sy < -0.2 && r() < 0.7) continue; // light side has fewer dots
    ctx.beginPath(); ctx.arc(sx, sy, 0.022, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = ink; ctx.lineWidth = 3.2 * u; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- DNA
// Double helix along x0..x1 at height y. o.copy (0..1) draws a second helix below
// being built; o.errors = [{u, at}] marks red copy mistakes; o.look 'xray' glows.
export function drawDNA(ctx, x0, x1, y, t, o = {}) {
  const A = o.amp ?? 46, L = o.wave ?? 260, ph = t * (o.spin ?? 1.6);
  const xr = o.look === 'xray';
  const col = xr ? ['rgba(240,232,214,0.9)', 'rgba(255,160,90,0.85)'] : ['rgba(46,28,12,0.9)', 'rgba(184,58,38,0.9)'];
  const pairs = xr ? ['rgba(255,140,70,0.75)', 'rgba(150,210,255,0.7)', 'rgba(255,220,150,0.7)', 'rgba(200,170,255,0.7)']
    : ['#b8432c', '#4f6f8f', '#c99a3a', '#6b8f5a'];
  const strand = (yy, k, prog1 = 1) => {
    const pts = [];
    for (let x = x0; x <= x0 + (x1 - x0) * prog1; x += 6) pts.push([x, yy + A * Math.sin(TAU * (x - x0) / L + ph + k * Math.PI)]);
    return pts;
  };
  const one = (yy, p, errs) => {
    ctx.save();
    if (xr) { ctx.globalCompositeOperation = 'lighter'; }
    // rungs
    const step = L / 10;
    for (let x = x0 + step / 2, i = 0; x <= x0 + (x1 - x0) * p; x += step, i++) {
      const s = Math.sin(TAU * (x - x0) / L + ph);
      const err = errs && errs.find((e) => Math.abs(e.x - x) < step * 0.5 && t >= e.at);
      ctx.strokeStyle = err ? (xr ? 'rgba(255,60,40,1)' : '#c8442c') : pairs[(i * 7 + 3) % 4];
      ctx.lineWidth = err ? 7 : 5;
      if (xr && err) { ctx.shadowColor = 'rgba(255,50,30,1)'; ctx.shadowBlur = 16; } else ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(x, yy + A * s); ctx.lineTo(x, yy - A * s); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const k of [0, 1]) {
      const pts = strand(yy, k, p);
      if (pts.length < 2) continue;
      if (xr) { ctx.shadowColor = k ? 'rgba(255,140,60,0.9)' : 'rgba(255,240,220,0.7)'; ctx.shadowBlur = 12; }
      strokePartial(ctx, pts, 1, 7, col[k]);
    }
    ctx.restore();
  };
  one(y, 1, null);
  if (o.copy !== undefined && o.copy > 0) {
    const errs = (o.errors || []).map((e) => ({ x: x0 + (x1 - x0) * e.u, at: e.at }));
    one(y + (o.gap ?? 190), o.copy, errs);
    // the copying head
    const hx = x0 + (x1 - x0) * o.copy;
    if (o.copy < 1) {
      ctx.save(); ctx.globalCompositeOperation = xr ? 'lighter' : 'source-over';
      ctx.fillStyle = xr ? 'rgba(255,230,190,0.9)' : 'rgba(46,28,12,0.85)';
      ctx.beginPath(); ctx.arc(hx, y + (o.gap ?? 190), 12, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- odometer counter
// digits: target string like '9,700,000' or '100+'; rolls from 0 to the number.
export function drawOdometer(ctx, x, y, text, p, o = {}) {
  const h = o.h ?? 120, dw = o.dw ?? 74, gap = 6;
  const num = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
  const v = num * clamp(p);
  const chars = text.split('');
  const ndig = chars.filter((c) => /[0-9]/.test(c)).length;
  const width = chars.reduce((a, c) => a + (/[0-9]/.test(c) ? dw + gap : dw * 0.45), 0);
  ctx.save(); ctx.translate(x, y);
  // frame
  ctx.save(); ctx.shadowColor = 'rgba(30,18,6,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = o.frame || '#2b1f14'; ctx.beginPath(); ctx.roundRect(-18, -18, width + 36, h + 36, 14); ctx.fill(); ctx.restore();
  let cx = 0, di = ndig - 1;
  for (const c of chars) {
    if (!/[0-9]/.test(c)) {
      setFont(ctx, FONTS.title, h * 0.7); ctx.fillStyle = o.sepColor || '#efe3c6'; ctx.textAlign = 'center';
      ctx.fillText(c, cx + dw * 0.22, h * 0.82); cx += dw * 0.45; continue;
    }
    const place = Math.pow(10, di);
    const d = v / place;
    let digit = Math.floor(d) % 10, roll = 0;
    const below = v % place;
    if (place === 1) roll = d - Math.floor(d);
    else roll = clamp((below - (place - 1)) / 1);
    if (p >= 1) { digit = Math.floor(num / place) % 10; roll = 0; }
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx, 0, dw, h, 8); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#cbbd9e'); g.addColorStop(0.15, '#f4ead3'); g.addColorStop(0.85, '#f4ead3'); g.addColorStop(1, '#bdae8c');
    ctx.fillStyle = g; ctx.fillRect(cx, 0, dw, h);
    setFont(ctx, FONTS.title, h * 0.74); ctx.fillStyle = o.color || '#21170c'; ctx.textAlign = 'center';
    ctx.fillText(String(digit), cx + dw / 2, h * 0.8 - roll * h);
    ctx.fillText(String((digit + 1) % 10), cx + dw / 2, h * 1.8 - roll * h);
    const sh = ctx.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = sh; ctx.fillRect(cx, 0, dw, h);
    ctx.restore();
    cx += dw + gap; di--;
  }
  ctx.textAlign = 'left';
  ctx.restore();
  return width;
}

export class Odometer extends Actor {
  constructor(scene, text, o) {
    super({ layer: 'ui', z: 46, ...o });
    this.text = text;
    const at = o.rollAt ?? this.at + 0.3, dur = o.rollDur ?? 1.6;
    scene.sfx(this.at, 'slide', 0.5);
    for (let k = 0; k < Math.round(dur / 0.08); k++) scene.sfx(at + k * 0.08, 'tick', 0.16 + 0.1 * (k % 2), { v: k % 4 });
    scene.sfx(at + dur, 'beep', 0.4);
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, o.rollAt ?? this.at + 0.3, o.rollDur ?? 1.6, ease.outCubic);
    const a = prog(t, this.at, 0.25, ease.outCubic);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 40);
    drawOdometer(ctx, o.x, o.y, this.text, p, o);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- fake badge
export function drawBadge(ctx, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -0.08); ctx.scale(s / 100, s / 100);
  ctx.save(); ctx.shadowColor = 'rgba(20,10,4,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  // shield shape
  const p = new Path2D();
  p.moveTo(-70, -48); p.lineTo(70, -48); p.lineTo(70, 6); p.quadraticCurveTo(70, 48, 0, 70); p.quadraticCurveTo(-70, 48, -70, 6); p.closePath();
  const g = ctx.createLinearGradient(-70, -48, 70, 70);
  g.addColorStop(0, '#f0d58c'); g.addColorStop(0.5, '#c79a3e'); g.addColorStop(1, '#8a6220');
  ctx.fillStyle = g; ctx.fill(p); ctx.restore();
  ctx.strokeStyle = '#5b3d10'; ctx.lineWidth = 4; ctx.stroke(p);
  ctx.save(); ctx.scale(0.84, 0.84); ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 3; ctx.stroke(p); ctx.restore();
  setFont(ctx, FONTS.title, 26); ctx.fillStyle = '#3b2408'; ctx.textAlign = 'center';
  ctx.fillText("DON'T", 0, -16); ctx.fillText('ATTACK', 0, 12); ctx.fillText('ME', 0, 40);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ---------------------------------------------------------------- bootprint
export function drawBootprint(ctx, x, y, s, rot = -0.3, color = 'rgba(40,36,30,0.8)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 100, s / 100);
  const sole = new Path2D();
  sole.moveTo(0, -50); sole.bezierCurveTo(22, -50, 26, -28, 24, -6); sole.bezierCurveTo(22, 12, 16, 22, 16, 34);
  sole.bezierCurveTo(16, 48, 8, 54, 0, 54); sole.bezierCurveTo(-8, 54, -16, 48, -16, 34); sole.bezierCurveTo(-16, 22, -22, 12, -24, -6);
  sole.bezierCurveTo(-26, -28, -22, -50, 0, -50); sole.closePath();
  // pressed into dust: a light rim on the lower side, a dark hollow inside
  ctx.save(); ctx.translate(2.5, 3.5); ctx.strokeStyle = 'rgba(255,252,240,0.7)'; ctx.lineWidth = 5; ctx.stroke(sole); ctx.restore();
  ctx.fillStyle = 'rgba(30,27,22,0.42)'; ctx.fill(sole);
  ctx.save(); ctx.clip(sole);
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  for (let k = -46; k < 54; k += 9) { ctx.beginPath(); ctx.moveTo(-30, k + 4); ctx.lineTo(0, k); ctx.lineTo(30, k + 4); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(sole);
  ctx.restore();
}

// ---------------------------------------------------------------- treatment tool icons (ink)
export function drawToolIcon(ctx, kind, x, y, s, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ink = 'rgba(40,26,12,0.92)', steel = (a, b) => { const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, '#f2f2ee'); g.addColorStop(0.5, '#a9aaa6'); g.addColorStop(1, '#e8e8e2'); return g; };
  ctx.strokeStyle = ink; ctx.lineWidth = 3;
  if (kind === 'surgery') {
    ctx.rotate(-0.6);
    ctx.fillStyle = steel([-70, -8], [-70, 8]); ctx.beginPath(); ctx.roundRect(-78, -9, 92, 18, 6); ctx.fill(); ctx.stroke();
    for (let k = -64; k < 0; k += 10) { ctx.beginPath(); ctx.moveTo(k, -5); ctx.lineTo(k, 5); ctx.stroke(); }
    ctx.fillStyle = steel([14, -18], [14, 10]);
    ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(44, -6); ctx.quadraticCurveTo(76, -6, 82, 8); ctx.quadraticCurveTo(52, 12, 14, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === 'chemo') {
    ctx.fillStyle = 'rgba(232,240,236,0.9)';
    ctx.beginPath(); ctx.roundRect(-42, -78, 84, 104, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(220,120,90,0.55)'; ctx.beginPath(); ctx.roundRect(-38, -30, 76, 52, 18); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -66, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, 44); ctx.stroke();
    ctx.fillStyle = 'rgba(232,240,236,0.9)'; ctx.beginPath(); ctx.roundRect(-9, 44, 18, 26, 5); ctx.fill(); ctx.stroke();
    const dp = (t * 1.2) % 1; ctx.fillStyle = 'rgba(200,100,70,0.9)'; ctx.beginPath(); ctx.arc(0, 50 + dp * 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.quadraticCurveTo(10, 90, 30, 92); ctx.stroke();
  } else if (kind === 'radiation') {
    ctx.fillStyle = '#ead9a8'; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = 'rgba(40,26,12,0.92)';
    for (let k = 0; k < 3; k++) {
      const a0 = -Math.PI / 2 + k * (Math.PI * 2 / 3) - Math.PI / 6;
      ctx.beginPath(); ctx.arc(0, 0, 58, a0, a0 + Math.PI / 3); ctx.arc(0, 0, 16, a0 + Math.PI / 3, a0, true); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'immuno') {
    // antibody: a Y of rounded chains
    ctx.lineWidth = 16; ctx.strokeStyle = '#6d5a8e';
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, 4); ctx.lineTo(-44, -54); ctx.moveTo(0, 4); ctx.lineTo(44, -54); ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = '#a99bc8';
    ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-56, -40); ctx.moveTo(16, -6); ctx.lineTo(56, -40); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.arc(-50, -62, 8, 0, Math.PI * 2); ctx.arc(50, -62, 8, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'vaccine') {
    ctx.rotate(-0.7);
    ctx.fillStyle = 'rgba(236,244,242,0.85)'; ctx.beginPath(); ctx.roundRect(-50, -14, 92, 28, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(120,170,190,0.45)'; ctx.fillRect(-12, -12, 52, 24);
    for (let k = -40; k < 40; k += 10) { ctx.beginPath(); ctx.moveTo(k, -14); ctx.lineTo(k, -6); ctx.stroke(); }
    ctx.fillStyle = steel([-80, -6], [-80, 6]); ctx.beginPath(); ctx.roundRect(-82, -6, 34, 12, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-82, -18); ctx.lineTo(-82, 18); ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(56, 0); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(92, 0); ctx.stroke();
  }
  ctx.restore();
}

Object.assign(Scene.prototype, {
  odometer(text, o = {}) { return this.add(new Odometer(this, text, o)); },
});
