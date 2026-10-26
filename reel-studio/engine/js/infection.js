// Infection and mosquito props, drawn in the plate style (paper and X-ray versions):
// red blood cells and a flowing blood stream, the four dengue virus types, Y-shaped
// antibodies, an immune cell with a receptor "door", eggs, wriggling larvae, a tiny
// mosquito icon, a 24-hour day clock, a house, a tear-off calendar, pills, a smiley,
// a shield and a pinned specimen frame.
import { W, clamp, lerp, ease, prog, rng, COLORS } from './util.js';
import { FONTS } from './assets.js';
import { Actor, Scene } from './timeline.js';
import { setFont, inkText, paperTexture } from './draw.js';
import { smoothPath } from './lab.js';
import { drawSun } from './props.js';

const TAU = Math.PI * 2;
const ga = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------------------------------------------------------------- the 4 dengue types
export const DENV = {
  1: { c: '#e2a03a', hi: '#f7dba0', lo: '#93601a', glow: [255, 186, 86] },
  2: { c: '#3f9fd0', hi: '#b2e0f6', lo: '#1d5a80', glow: [112, 196, 255] },
  3: { c: '#67b058', hi: '#c4e8ae', lo: '#376b2e', glow: [146, 232, 126] },
  4: { c: '#ad6dce', hi: '#e4c6f3', lo: '#673784', glow: [212, 156, 255] },
};

// points spread evenly over a sphere (surface "rafts" of the virus)
const SPHERE = (() => {
  const pts = [], n = 110, g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r, (i * 37) % 6]);
  }
  return pts;
})();

// A dengue virus: a smooth sphere tiled with E-protein rafts (three short parallel bars,
// the herringbone look of flaviviruses) on a slowly turning surface, tinted by type 1-4.
export function drawDengueVirus(ctx, x, y, R, t, o = {}) {
  const T = DENV[o.type || 1], xr = o.look === 'xray', a = o.alpha ?? 1;
  if (a <= 0.003 || R < 0.5) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
  if (xr) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 2.2);
    g.addColorStop(0, ga(T.glow, 0.42 * (o.glow ?? 1))); g.addColorStop(1, ga(T.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (o.shadow !== false) {
    ctx.save(); ctx.globalAlpha *= 0.28; ctx.fillStyle = '#2a1a0a'; ctx.filter = `blur(${Math.max(2, R * 0.12)}px)`;
    ctx.beginPath(); ctx.arc(R * 0.1, R * 0.15, R, 0, TAU); ctx.fill(); ctx.restore();
  }
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.08, 0, 0, R);
  if (xr) { g.addColorStop(0, ga(T.glow, 0.95)); g.addColorStop(0.6, ga(T.glow, 0.5)); g.addColorStop(1, ga(T.glow, 0.22)); }
  else { g.addColorStop(0, T.hi); g.addColorStop(0.6, T.c); g.addColorStop(1, T.lo); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  if (R >= 7) {
    const spin = (o.spin ?? 0.6) * t + (o.rot ?? 0), cs = Math.cos(spin), sn = Math.sin(spin);
    const ct = Math.cos(0.35), st = Math.sin(0.35);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, TAU); ctx.clip();
    ctx.lineCap = 'round';
    for (const [px, py, pz, k] of SPHERE) {
      const X = px * cs + pz * sn, Z = -px * sn + pz * cs;
      const Y2 = py * ct - Z * st, Z2 = py * st + Z * ct;
      if (Z2 <= 0.03) continue;
      const sx = X * R, sy = Y2 * R, sc = R * 0.17 * (0.35 + 0.65 * Z2);
      const ang = Math.atan2(sy, sx) + (k % 3) * 1.05;
      ctx.strokeStyle = xr ? `rgba(255,255,255,${0.2 + 0.45 * Z2})` : `rgba(40,24,10,${0.16 + 0.38 * Z2})`;
      ctx.lineWidth = Math.max(0.8, R * 0.045 * Z2);
      const dx = Math.cos(ang) * sc, dy = Math.sin(ang) * sc, nx = -dy * 0.32, ny = dx * 0.32;
      ctx.beginPath();
      for (const m of [-1, 0, 1]) { ctx.moveTo(sx - dx * 0.5 + nx * m, sy - dy * 0.5 + ny * m); ctx.lineTo(sx + dx * 0.5 + nx * m, sy + dy * 0.5 + ny * m); }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.lineWidth = Math.max(1.5, R * 0.07);
  ctx.strokeStyle = xr ? ga(T.glow, 0.95) : 'rgba(46,28,12,0.85)';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  if (!xr) { ctx.strokeStyle = 'rgba(255,250,240,0.45)'; ctx.lineWidth = Math.max(1, R * 0.035); ctx.beginPath(); ctx.arc(0, 0, R * 0.88, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- antibody
// Y-shaped antibody with the hinge at (x, y); at ang = 0 the two arms point up and the
// stem points down. o.type colours it like the virus type it was made against.
export function drawAntibody(ctx, x, y, s, ang = 0, o = {}) {
  const xr = o.look === 'xray', a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const T = o.type ? DENV[o.type] : null;
  const heavy = xr ? (T ? ga(T.glow, 0.95) : 'rgba(255,236,200,0.95)') : (T ? T.lo : '#57467a');
  const light = xr ? 'rgba(255,252,240,0.9)' : (T ? T.c : '#9886c0');
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha *= a;
  if (xr) { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = T ? ga(T.glow, 0.9) : 'rgba(255,220,160,0.9)'; ctx.shadowBlur = s * 0.22; }
  ctx.lineCap = 'round';
  const w = s * 0.12, sp = o.spread ?? 0.6, L = s * 0.62, stem = s * 0.55;
  if (!xr) { // ink outline under the colour, like an engraving
    ctx.strokeStyle = 'rgba(40,24,10,0.85)'; ctx.lineWidth = w + 4;
    ctx.beginPath(); ctx.moveTo(-w * 0.55, w * 0.3); ctx.lineTo(-w * 0.55, stem); ctx.moveTo(w * 0.55, w * 0.3); ctx.lineTo(w * 0.55, stem);
    for (const sg of [-1, 1]) { const d = -Math.PI / 2 + sg * sp; ctx.moveTo(sg * w * 0.4, 0); ctx.lineTo(Math.cos(d) * L, Math.sin(d) * L); }
    ctx.stroke();
  }
  ctx.strokeStyle = heavy; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(-w * 0.55, w * 0.3); ctx.lineTo(-w * 0.55, stem); ctx.moveTo(w * 0.55, w * 0.3); ctx.lineTo(w * 0.55, stem); ctx.stroke();
  for (const sg of [-1, 1]) {
    const d = -Math.PI / 2 + sg * sp, dx = Math.cos(d), dy = Math.sin(d), nx = -dy * sg, ny = dx * sg;
    ctx.strokeStyle = heavy; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sg * w * 0.4, 0); ctx.lineTo(dx * L, dy * L); ctx.stroke();
    const off = w * 1.05;
    if (!xr) { ctx.strokeStyle = 'rgba(40,24,10,0.85)'; ctx.lineWidth = w * 0.9 + 4; ctx.beginPath(); ctx.moveTo(dx * L * 0.38 + nx * off, dy * L * 0.38 + ny * off); ctx.lineTo(dx * L + nx * off, dy * L + ny * off); ctx.stroke(); }
    ctx.strokeStyle = light; ctx.lineWidth = w * 0.9;
    ctx.beginPath(); ctx.moveTo(dx * L * 0.38 + nx * off, dy * L * 0.38 + ny * off); ctx.lineTo(dx * L + nx * off, dy * L + ny * off); ctx.stroke();
  }
  ctx.restore();
}

// where an antibody's arm tips and stem end are (for binding and docking)
export function antibodyPoints(x, y, s, ang = 0, spread = 0.6) {
  const L = s * 0.62 + s * 0.06, c = Math.cos(ang), sn = Math.sin(ang);
  const P = (px, py) => [x + px * c - py * sn, y + px * sn + py * c];
  const tip = (sg) => { const d = -Math.PI / 2 + sg * spread; return P(Math.cos(d) * L, Math.sin(d) * L); };
  return { left: tip(-1), right: tip(1), top: P(0, -L * Math.cos(spread)), stem: P(0, s * 0.55) };
}

// ---------------------------------------------------------------- immune cell with a door
// A big immune cell (monocyte). o.door = angle of a receptor "door" in its membrane;
// o.open 0..1 swings it open; o.lockGlow 0..1 lights the keyhole; o.infected 0..1 fills
// the cell with red glow; o.copies = number of new virus copies (type o.virusType) inside.
export function drawGateCell(ctx, x, y, R, t, o = {}) {
  const xr = o.look === 'xray', seed = o.seed ?? 3, inf = o.infected ?? 0;
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
  const r = rng(seed * 13 + 5), ph = [r() * 6, r() * 6, r() * 6], pts = [];
  for (let i = 0; i < 72; i++) {
    const an = (i / 72) * TAU;
    const k = 1 + 0.035 * Math.sin(3 * an + ph[0] + t * 0.5) + 0.025 * Math.sin(5 * an + ph[1] - t * 0.4) + 0.018 * Math.sin(9 * an + ph[2] + t * 0.9);
    pts.push([Math.cos(an) * R * k, Math.sin(an) * R * k]);
  }
  const path = smoothPath(pts);
  if (xr) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(140,210,255,0.8)'; ctx.shadowBlur = R * 0.22;
    ctx.fillStyle = 'rgba(120,180,225,0.15)'; ctx.fill(path); ctx.shadowBlur = 0;
    if (inf > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 5);
      ctx.save(); ctx.shadowColor = `rgba(255,60,30,${0.9 * inf})`; ctx.shadowBlur = R * 0.35 * inf;
      const g = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R * 1.02);
      g.addColorStop(0, `rgba(255,96,52,${0.95 * inf * pulse})`); g.addColorStop(0.7, `rgba(255,56,28,${0.6 * inf * pulse})`); g.addColorStop(1, `rgba(255,50,24,${0.25 * inf})`);
      ctx.fillStyle = g; ctx.fill(path); ctx.restore();
    }
    ctx.fillStyle = `rgba(200,232,255,${0.2 * (1 - 0.6 * inf)})`;
    ctx.beginPath(); ctx.ellipse(R * 0.22, R * 0.08, R * 0.4, R * 0.27, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = inf > 0.3 ? `rgba(255,${Math.round(205 - 120 * inf)},${Math.round(255 - 190 * inf)},0.9)` : 'rgba(205,238,255,0.9)';
    ctx.lineWidth = Math.max(2, R * 0.025); ctx.stroke(path);
    ctx.restore();
  } else {
    ctx.save(); ctx.globalAlpha *= 0.25; ctx.translate(R * 0.06, R * 0.09); ctx.fillStyle = '#2a1a0a'; ctx.filter = `blur(${Math.max(2, R * 0.06)}px)`; ctx.fill(path); ctx.restore();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.05);
    g.addColorStop(0, '#f2f0f7'); g.addColorStop(0.65, '#d8d6e6'); g.addColorStop(1, '#b6b5cf');
    ctx.fillStyle = g; ctx.fill(path);
    if (inf > 0) { const g2 = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R); g2.addColorStop(0, `rgba(205,60,40,${0.55 * inf})`); g2.addColorStop(1, 'rgba(205,60,40,0)'); ctx.fillStyle = g2; ctx.fill(path); }
    ctx.fillStyle = 'rgba(91,71,126,0.75)'; ctx.beginPath(); ctx.ellipse(R * 0.22, R * 0.08, R * 0.4, R * 0.27, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,64,104,0.9)'; ctx.lineWidth = Math.max(2, R * 0.022); ctx.stroke(path);
  }
  // new virus copies inside, on a slow spiral
  const nc = Math.floor(o.copies ?? 0);
  for (let i = 0; i < nc; i++) {
    const an = i * 2.4 + t * 0.4, d = R * (0.18 + 0.55 * Math.sqrt((i + 1) / (nc + 1)));
    drawDengueVirus(ctx, Math.cos(an) * d, Math.sin(an) * d, R * 0.085, t, { type: o.virusType || 2, look: o.look, alpha: clamp((o.copies - i) * 2), shadow: false, glow: 0.8 });
  }
  if (o.door !== undefined) drawDoor(ctx, R, o.door, o.open ?? 0, o.lockGlow ?? 0, xr, o.unlock);
  ctx.restore();
}

// A padlock icon (upright on screen); u 0..1 lifts and swings the shackle open.
export function drawPadlock(ctx, x, y, s, u = 0, o = {}) {
  const xr = o.look === 'xray';
  ctx.save(); ctx.translate(x, y);
  const ink = xr ? 'rgba(235,245,255,0.95)' : 'rgba(40,24,10,0.95)';
  // shackle: lifts, then swings around its right leg
  ctx.save(); ctx.translate(s * 0.28, -s * 0.18 - u * s * 0.22); ctx.rotate(-u * 0.9); ctx.translate(-s * 0.28, 0);
  ctx.strokeStyle = xr ? 'rgba(200,225,240,0.95)' : '#8d8d86'; ctx.lineWidth = s * 0.13; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(-s * 0.28, 0); ctx.lineTo(-s * 0.28, -s * 0.2); ctx.arc(0, -s * 0.2, s * 0.28, Math.PI, 0); ctx.lineTo(s * 0.28, 0); ctx.stroke();
  ctx.restore();
  // body
  const g = ctx.createLinearGradient(0, -s * 0.2, 0, s * 0.45);
  if (xr) { g.addColorStop(0, 'rgba(255,214,140,0.95)'); g.addColorStop(1, 'rgba(220,150,70,0.9)'); }
  else { g.addColorStop(0, '#e2b45a'); g.addColorStop(1, '#a8772c'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-s * 0.42, -s * 0.2, s * 0.84, s * 0.66, s * 0.1); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, s * 0.05); ctx.stroke();
  ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, s * 0.06, s * 0.08, 0, TAU); ctx.fill();
  ctx.fillRect(-s * 0.035, s * 0.06, s * 0.07, s * 0.2);
  ctx.restore();
}

function drawDoor(ctx, R, ang, open, glow, xr, unlock) {
  const dw = R * 0.5, th = R * 0.11;
  ctx.save(); ctx.rotate(ang); ctx.translate(R, 0);
  // the doorway behind the door
  if (open > 0.02) {
    ctx.save();
    if (xr) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,150,90,${0.55 * open})`; }
    else ctx.fillStyle = `rgba(40,24,12,${0.7 * open})`;
    ctx.fillRect(-th, -dw / 2, th * 2, dw); ctx.restore();
  }
  // the door leaf, hinged at its top end, swinging outward
  ctx.save(); ctx.translate(0, -dw / 2); ctx.rotate(-open * 1.75); ctx.translate(0, dw / 2);
  ctx.fillStyle = xr ? 'rgba(160,215,245,0.55)' : '#cfc5a6';
  ctx.strokeStyle = xr ? 'rgba(225,245,255,0.95)' : 'rgba(46,28,12,0.9)'; ctx.lineWidth = Math.max(2, R * 0.018);
  ctx.beginPath(); ctx.roundRect(-th, -dw / 2, th * 2, dw, th * 0.6); ctx.fill(); ctx.stroke();
  // keyhole
  ctx.save();
  if (xr) { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = `rgba(255,190,110,${glow})`; ctx.shadowBlur = R * 0.12 * glow; }
  ctx.fillStyle = xr ? `rgba(255,${Math.round(200 + 40 * glow)},150,${0.55 + 0.45 * glow})` : (glow > 0.5 ? COLORS.red : 'rgba(46,28,12,0.9)');
  const k = th * 0.55;
  ctx.beginPath(); ctx.arc(th * 0.15, -k * 0.5, k, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(th * 0.15 - k * 0.55, -k * 0.2); ctx.lineTo(th * 0.15 + k * 0.55, -k * 0.2); ctx.lineTo(th * 0.15 + k * 0.3, k * 1.6); ctx.lineTo(th * 0.15 - k * 0.3, k * 1.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // padlock hanging in front of the door, kept upright on screen; it fades once the door opens
  if (unlock !== undefined && open < 0.98) {
    ctx.save(); ctx.translate(th + R * 0.2, 0); ctx.rotate(-ang); ctx.globalAlpha *= 1 - clamp((open - 0.5) / 0.48);
    drawPadlock(ctx, 0, 0, R * 0.24, unlock, { look: xr ? 'xray' : 'paper' });
    ctx.restore();
  }
  ctx.restore();
}

// where an antibody stem "key" meets a gate cell's padlock (outer side of the door)
export function doorPoint(x, y, R, ang) { const d = R * 1.31; return [x + Math.cos(ang) * d, y + Math.sin(ang) * d + R * 0.24 * 0.1]; }

// ---------------------------------------------------------------- red blood cells
// A biconcave red blood cell; o.tilt turns it (0 = face on, pi/2 = edge on).
export function drawRBC(ctx, x, y, r, o = {}) {
  const xr = o.look === 'xray', k = Math.max(0.28, Math.abs(Math.cos(o.tilt ?? 0))), a = o.alpha ?? 1;
  if (a <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? 0); ctx.scale(1, k); ctx.globalAlpha *= a;
  if (xr) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
    g.addColorStop(0, 'rgba(110,26,20,0.10)'); g.addColorStop(0.5, 'rgba(190,52,40,0.20)'); g.addColorStop(0.84, 'rgba(255,96,74,0.42)'); g.addColorStop(1, 'rgba(255,110,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.08, 0, 0, r);
    g.addColorStop(0, '#eaa999'); g.addColorStop(0.5, '#d87a66'); g.addColorStop(0.85, '#c25540'); g.addColorStop(1, '#a3402e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    const d = ctx.createRadialGradient(r * 0.05, r * 0.08, 0, 0, 0, r * 0.55);
    d.addColorStop(0, 'rgba(120,30,20,0.32)'); d.addColorStop(1, 'rgba(120,30,20,0)');
    ctx.fillStyle = d; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,35,22,0.75)'; ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// A blood vessel band with red cells flowing through it (and faint plasma streaks).
// o: y (centre), hh (half height), n (cells), r (cell radius), speed (px/s), dir (-1 = to the left)
export class BloodStream extends Actor {
  constructor(scene, o) {
    super({ layer: 'world', z: 3, ...o });
    const r = rng(o.seed ?? 5);
    this.cells = [];
    for (let i = 0; i < (o.n ?? 44); i++) this.cells.push({ u: r(), v: r() * 2 - 1, s: 0.55 + r() * 0.75, ph: r() * TAU, spin: (r() - 0.5) * 1.4, rot: r() * TAU });
    this.cells.sort((p, q) => p.s - q.s);
    this.streaks = [];
    for (let i = 0; i < 26; i++) this.streaks.push({ u: r(), v: r() * 2 - 1, l: 60 + r() * 160, s: 1.2 + r() });
  }
  draw(ctx, t, s) {
    const o = this.o, xr = s.look === 'xray', cy = o.y ?? 1040, hh = o.hh ?? 430, sp = (o.speed ?? 110) * (o.dir ?? 1);
    const span = W + 400, x0 = -200, a = clamp((t - this.at) / 0.4) * (o.alpha ?? 1);
    ctx.save(); ctx.globalAlpha *= a;
    // vessel walls
    ctx.save();
    if (xr) ctx.globalCompositeOperation = 'lighter';
    for (const sg of [-1, 1]) {
      const g = ctx.createLinearGradient(0, cy + sg * hh - 40, 0, cy + sg * hh + 40);
      g.addColorStop(0, xr ? 'rgba(255,120,90,0)' : 'rgba(150,60,40,0)'); g.addColorStop(0.5, xr ? 'rgba(255,130,100,0.22)' : 'rgba(150,60,40,0.22)'); g.addColorStop(1, xr ? 'rgba(255,120,90,0)' : 'rgba(150,60,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, cy + sg * hh - 40, W, 80);
      ctx.strokeStyle = xr ? 'rgba(255,170,140,0.35)' : 'rgba(120,50,30,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) { const yy = cy + sg * hh + Math.sin(x * 0.01 + t * 0.6 + sg) * 10; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
    // plasma streaks
    ctx.strokeStyle = xr ? 'rgba(255,170,140,0.12)' : 'rgba(150,70,50,0.12)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const k of this.streaks) {
      const x = x0 + ((((k.u * span + t * sp * k.s) % span) + span) % span), y = cy + k.v * hh * 0.85;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(sp || 1) * k.l, y); ctx.stroke();
    }
    ctx.restore();
    for (const c of this.cells) {
      const x = x0 + ((((c.u * span + t * sp * c.s) % span) + span) % span);
      const y = cy + c.v * hh * 0.82 + Math.sin(t * 0.8 + c.ph) * 10;
      drawRBC(ctx, x, y, (o.r ?? 36) * c.s, { look: s.look, tilt: c.ph + t * c.spin, rot: c.rot, alpha: 0.45 + 0.55 * c.s });
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- eggs and larvae
// An Aedes egg: tiny, black, cigar-shaped, with a faint net pattern. o.hatch 0..1 lifts
// the cap at the front end.
export function drawEgg(ctx, x, y, s, rot = 0, o = {}) {
  const xr = o.look === 'xray', h = o.hatch ?? 0, a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const L = s, Wd = s * 0.3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a;
  const body = new Path2D(); body.ellipse(0, 0, L / 2, Wd / 2, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
  g.addColorStop(0, xr ? '#55554e' : '#4a433b'); g.addColorStop(0.3, xr ? '#9a9a90' : '#7a7068'); g.addColorStop(1, '#0d0b09');
  ctx.save();
  if (h > 0) { ctx.beginPath(); ctx.rect(-L, -L, L * 0.5 + L * 0.32, 2 * L); ctx.clip(); }
  ctx.fillStyle = g; ctx.fill(body);
  ctx.strokeStyle = xr ? 'rgba(235,230,215,0.7)' : 'rgba(18,12,6,0.95)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke(body);
  ctx.strokeStyle = xr ? 'rgba(235,230,215,0.18)' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(0.6, s * 0.012);
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * L * 0.12, -Wd * 0.42); ctx.lineTo(k * L * 0.12 + L * 0.05, Wd * 0.42); ctx.stroke(); }
  ctx.restore();
  if (h > 0) { // the lifted cap
    ctx.save(); ctx.translate(L * 0.32 + h * L * 0.14, -h * Wd * 0.9); ctx.rotate(-h * 0.9);
    ctx.beginPath(); ctx.ellipse(L * 0.09, 0, L * 0.11, Wd / 2, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = xr ? 'rgba(235,230,215,0.7)' : 'rgba(18,12,6,0.95)'; ctx.lineWidth = Math.max(1, s * 0.035); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// A mosquito larva ("wriggler"): head, wide thorax, 8 abdominal segments and a breathing
// siphon, bending in a travelling S-wave. o.ang = direction the head points.
export function drawLarva(ctx, x, y, s, t, o = {}) {
  const xr = o.look === 'xray', a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const n = 18, ph = o.phase ?? 0, amp = o.amp ?? 0.22, f = o.freq ?? 2.2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.ang ?? 0); ctx.globalAlpha *= a;
  const sp = [];
  for (let i = 0; i <= n; i++) { const u = i / n; sp.push([-u * s, amp * s * u * Math.sin(TAU * (u * 0.9 - f * t) + ph)]); }
  const wOf = (u) => (u < 0.08 ? 0.07 : u < 0.27 ? 0.14 * Math.sin(Math.PI * clamp((u - 0.06) / 0.23)) + 0.03 : lerp(0.07, 0.032, (u - 0.27) / 0.73)) * s;
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const p = sp[i], q = sp[Math.min(n, i + 1)], pr = sp[Math.max(0, i - 1)];
    const dx = q[0] - pr[0], dy = q[1] - pr[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = wOf(i / n);
    left.push([p[0] + nx * w, p[1] + ny * w]); right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  const outline = smoothPath(left.concat(right.reverse()));
  const ink = xr ? 'rgba(236,232,218,0.9)' : 'rgba(30,20,10,0.9)';
  ctx.save();
  if (xr) { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = 'rgba(230,226,210,0.6)'; ctx.shadowBlur = s * 0.08; }
  ctx.fillStyle = xr ? 'rgba(220,214,196,0.35)' : 'rgba(120,98,64,0.85)'; ctx.fill(outline);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, s * 0.018); ctx.stroke(outline);
  // segment lines across the abdomen
  ctx.lineWidth = Math.max(0.8, s * 0.012);
  for (let k = 0; k < 8; k++) {
    const u = 0.32 + k * 0.075, i = Math.round(u * n), p = sp[i], q = sp[Math.min(n, i + 1)];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = wOf(u) * 0.95;
    ctx.beginPath(); ctx.moveTo(p[0] + nx * w, p[1] + ny * w); ctx.lineTo(p[0] - nx * w, p[1] - ny * w); ctx.stroke();
  }
  // head darker, small hair tufts on the thorax, the siphon at the tail
  const hd = sp[1];
  ctx.fillStyle = xr ? 'rgba(255,250,235,0.6)' : 'rgba(40,26,12,0.9)';
  ctx.beginPath(); ctx.ellipse(sp[0][0] - s * 0.03, sp[0][1], s * 0.055, s * 0.065, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.7, s * 0.01);
  for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) {
    const p = sp[2 + k]; ctx.beginPath(); ctx.moveTo(p[0], p[1] + sg * s * 0.12); ctx.lineTo(p[0] + s * 0.05, p[1] + sg * s * 0.22); ctx.stroke();
  }
  // a small bristle on each abdominal segment
  for (let k = 0; k < 7; k++) {
    const i = Math.round((0.34 + k * 0.075) * n), p = sp[i], w = wOf(i / n);
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(p[0], p[1] + sg * w); ctx.lineTo(p[0] + s * 0.02, p[1] + sg * (w + s * 0.06)); ctx.stroke(); }
  }
  const tl = sp[n], pt = sp[n - 1], ta = Math.atan2(tl[1] - pt[1], tl[0] - pt[0]);
  ctx.save(); ctx.translate(tl[0], tl[1]); ctx.rotate(ta - 0.55);
  ctx.fillStyle = xr ? 'rgba(220,214,196,0.5)' : 'rgba(70,50,28,0.95)';
  ctx.beginPath(); ctx.roundRect(0, -s * 0.022, s * 0.2, s * 0.044, s * 0.02); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

// A small mosquito icon (side view), for flying dots and route icons. o.flap animates wings.
export function drawMosquitoIcon(ctx, x, y, s, t, o = {}) {
  const xr = o.look === 'xray', a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const ink = o.color || (xr ? 'rgba(236,232,218,0.95)' : 'rgba(30,20,10,0.95)');
  ctx.save(); ctx.translate(x, y); ctx.scale((o.flip ? -1 : 1) * s / 100, s / 100); ctx.globalAlpha *= a;
  if (xr) { ctx.globalCompositeOperation = 'lighter'; }
  // wings (blurred flap)
  const fl = o.flap === false ? 0.5 : 0.5 + 0.5 * Math.sin(t * 90);
  ctx.fillStyle = xr ? 'rgba(220,230,240,0.25)' : 'rgba(170,190,200,0.35)'; ctx.strokeStyle = xr ? 'rgba(220,230,240,0.5)' : 'rgba(60,70,80,0.45)'; ctx.lineWidth = 1.5;
  for (const k of [0, 1]) { ctx.save(); ctx.translate(-4, -8); ctx.rotate(-0.5 - fl * 0.5 - k * 0.25); ctx.beginPath(); ctx.ellipse(-26, 0, 28, 7, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round';
  // legs with white bands (dots)
  ctx.lineWidth = 2.2;
  const legs = [[6, 4, 30, 30, 44, 52], [0, 6, 6, 36, 2, 60], [-8, 6, -26, 34, -40, 56]];
  for (const [ax, ay, bx, by, cx, cy] of legs) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.save(); ctx.fillStyle = xr ? 'rgba(255,255,255,0.9)' : '#f4efe2';
    for (const u of [0.35, 0.7]) { ctx.beginPath(); ctx.arc(lerp(bx, cx, u), lerp(by, cy, u), 1.8, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // abdomen, thorax, head, proboscis
  ctx.beginPath(); ctx.ellipse(-30, 6, 26, 7, 0.32, 0, TAU); ctx.fill();
  ctx.save(); ctx.strokeStyle = xr ? 'rgba(255,255,255,0.8)' : '#f4efe2'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 4; k++) { const xx = -44 + k * 10; ctx.beginPath(); ctx.moveTo(xx, 2 + k * 1.5); ctx.lineTo(xx + 1.5, 11 + k * 1.5); ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, -1, 12, 10, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(14, 2, 6, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(40, 14); ctx.stroke();
  ctx.save(); ctx.strokeStyle = xr ? 'rgba(255,255,255,0.85)' : '#f4efe2'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-4, -7); ctx.quadraticCurveTo(0, -2, -4, 4); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- day clock (24 h)
// Noon at the top, midnight at the bottom; the night half is shaded. o.hour moves the
// hand; o.peaks = [[6, 9], [16, 19]] red bands with suns; o.p (0..1) draws the bands.
export function drawDayClock(ctx, x, y, R, t, o = {}) {
  const angOf = (h) => Math.PI / 2 + (h / 24) * TAU;
  ctx.save(); ctx.translate(x, y);
  // face
  ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  ctx.drawImage(paperTexture(Math.round(R * 2), Math.round(R * 2), '#ece2c8', 37, false), -R, -R);
  // night half (18h -> 6h through midnight) shaded with hatching
  ctx.fillStyle = 'rgba(60,52,70,0.16)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, angOf(18), angOf(30)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,52,70,0.18)'; ctx.lineWidth = 2;
  for (let k = -R; k < R; k += 14) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + R * 0.6, R); ctx.stroke(); }
  ctx.restore();
  // peak bands
  // peaks: [[h0, h1, p?], ...]; p (0..1) draws that band (default o.p)
  for (const [h0, h1, pk] of o.peaks || []) {
    const p = pk ?? o.p ?? 1, a0 = angOf(h0), a1 = lerp(a0, angOf(h1), clamp(p));
    if (p <= 0) continue;
    ctx.strokeStyle = 'rgba(200,68,44,0.75)'; ctx.lineWidth = R * 0.12; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.86, a0, a1); ctx.stroke();
  }
  // ticks and labels
  ctx.strokeStyle = 'rgba(46,28,12,0.85)';
  for (let h = 0; h < 24; h++) {
    const an = angOf(h), big = h % 6 === 0;
    ctx.lineWidth = big ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * (big ? 0.72 : 0.78), Math.sin(an) * R * (big ? 0.72 : 0.78)); ctx.lineTo(Math.cos(an) * R * 0.93, Math.sin(an) * R * 0.93); ctx.stroke();
  }
  setFont(ctx, FONTS.type, Math.round(R * 0.085)); ctx.fillStyle = 'rgba(46,28,12,0.9)'; ctx.textAlign = 'center'; ctx.letterSpacing = '2px';
  const lab = [[12, 'NOON'], [6, '6 AM'], [18, '6 PM'], [0, 'MIDNIGHT']];
  for (const [h, txt] of lab) { const an = angOf(h); ctx.fillText(txt, Math.cos(an) * R * 0.55, Math.sin(an) * R * 0.55 + R * 0.03); }
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  // suns in the peak bands, a small moon at midnight
  for (const [h0, h1, pk] of o.peaks || []) {
    const an = angOf((h0 + h1) / 2), sp = clamp(((pk ?? o.p ?? 1) - 0.6) / 0.4);
    if (sp > 0) { ctx.save(); ctx.globalAlpha *= sp; drawSun(ctx, Math.cos(an) * R * 1.18, Math.sin(an) * R * 1.18, R * 0.13, t); ctx.restore(); }
  }
  ctx.save(); const mn = angOf(0); ctx.translate(Math.cos(mn) * R * 0.33, Math.sin(mn) * R * 0.33);
  ctx.fillStyle = 'rgba(60,52,70,0.75)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e6dcc4'; ctx.beginPath(); ctx.arc(R * 0.03, -R * 0.02, R * 0.06, 0, TAU); ctx.fill(); ctx.restore();
  // hand
  if (o.hour !== undefined) {
    const an = angOf(o.hour);
    ctx.strokeStyle = '#2e1b0a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-Math.cos(an) * R * 0.1, -Math.sin(an) * R * 0.1); ctx.lineTo(Math.cos(an) * R * 0.68, Math.sin(an) * R * 0.68); ctx.stroke();
    ctx.fillStyle = '#2e1b0a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = COLORS.red; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#2e1b0a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(46,28,12,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- small ink icons
export function drawHouse(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,24,10,0.95)'; ctx.lineWidth = 3.5;
  ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#ecdfc2'; ctx.fillRect(-40, -12, 80, 62); ctx.restore();
  ctx.strokeRect(-40, -12, 80, 62);
  ctx.fillStyle = '#b5583a'; ctx.beginPath(); ctx.moveTo(-54, -10); ctx.lineTo(0, -58); ctx.lineTo(54, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,24,10,0.35)'; ctx.lineWidth = 1.5;
  for (let k = -40; k < 40; k += 9) { ctx.beginPath(); ctx.moveTo(k, -12); ctx.lineTo(k * 0.15, -54 + Math.abs(k) * 0.1); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(40,24,10,0.95)'; ctx.lineWidth = 3.5;
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-12, 18, 22, 32); ctx.strokeRect(-12, 18, 22, 32);
  ctx.fillStyle = '#cfe0e0'; ctx.fillRect(16, 4, 16, 15); ctx.strokeRect(16, 4, 16, 15);
  ctx.beginPath(); ctx.moveTo(24, 4); ctx.lineTo(24, 19); ctx.moveTo(16, 11.5); ctx.lineTo(32, 11.5); ctx.stroke();
  ctx.fillStyle = '#8c4a32'; ctx.fillRect(20, -50, 10, 20); ctx.strokeRect(20, -50, 10, 20);
  ctx.restore();
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// A tear-off calendar; m = month index (the fraction flips the top page up).
export function drawCalendar(ctx, x, y, w, h, m, o = {}) {
  const i = ((Math.floor(m) % 12) + 12) % 12, f = m - Math.floor(m);
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot ?? -2) * Math.PI / 180);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#e9dfc6'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
  const page = (k) => {
    ctx.drawImage(paperTexture(Math.round(w), Math.round(h * 0.82), '#efe6cf', 11 + k, false), -w / 2, -h / 2 + h * 0.18);
    const ink = inkText(MONTHS[k], FONTS.title, Math.round(h * 0.4), COLORS.ink);
    ctx.drawImage(ink.canvas, -ink.width / 2 - ink.pad, h * 0.2 - ink.base + h * 0.4 * 0.43);
  };
  page((i + 1) % 12);
  // the flipping top page
  if (f < 0.5) {
    ctx.save(); ctx.translate(0, -h / 2 + h * 0.18); ctx.scale(1, Math.cos(f * Math.PI)); ctx.translate(0, h / 2 - h * 0.18);
    page(i); ctx.restore();
  }
  // binding strip with rings
  ctx.fillStyle = COLORS.red; ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
  ctx.fillStyle = 'rgba(30,18,8,0.85)';
  for (const sx of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.arc(sx * w, -h / 2 + h * 0.09, h * 0.035, 0, TAU); ctx.fill(); }
  if (o.label) { setFont(ctx, FONTS.type, Math.round(h * 0.075)); ctx.fillStyle = '#f4e9d4'; ctx.textAlign = 'center'; ctx.letterSpacing = '3px'; ctx.fillText(o.label, 0, -h / 2 + h * 0.135); ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; }
  ctx.strokeStyle = 'rgba(40,24,10,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// Generic tablets (no brands): 'round' scored tablet, 'oval' coated caplet, 'small' tablet.
export function drawPill(ctx, x, y, s, kind = 'round', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = s * 0.2; ctx.shadowOffsetY = s * 0.08;
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.05, 0, 0, s * 0.6);
  if (kind === 'oval') { g.addColorStop(0, '#f6e2c8'); g.addColorStop(1, '#d4a777'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d6cc'); }
  ctx.fillStyle = g; ctx.beginPath();
  if (kind === 'oval') ctx.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, TAU);
  else ctx.arc(0, 0, kind === 'small' ? s * 0.36 : s * 0.48, 0, TAU);
  ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(46,28,12,0.75)'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke();
  if (kind === 'round') { ctx.strokeStyle = 'rgba(46,28,12,0.4)'; ctx.beginPath(); ctx.moveTo(-s * 0.36, 0); ctx.lineTo(s * 0.36, 0); ctx.stroke(); }
  ctx.restore();
}

// A relieved smiley drawn in ink (p 0..1 pops it in).
export function drawSmiley(ctx, x, y, r, p = 1, color = 'rgba(40,24,10,0.92)') {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); const k = ease.outBack(clamp(p)); ctx.scale(k, k);
  ctx.fillStyle = '#f3e3b0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * 0.07); ctx.lineCap = 'round'; ctx.stroke();
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * r * 0.36, -r * 0.12, r * 0.14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.5, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  ctx.restore();
}

// A heater shield; o.color fill, o.strength 0..1 (opacity and glow), o.crack 0..1.
export function drawShield(ctx, x, y, s, o = {}) {
  const xr = o.look === 'xray', st = o.strength ?? 1;
  if (st <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.globalAlpha *= st;
  const p = new Path2D();
  p.moveTo(-46, -50); p.lineTo(46, -50); p.lineTo(46, 0); p.quadraticCurveTo(44, 40, 0, 60); p.quadraticCurveTo(-44, 40, -46, 0); p.closePath();
  const c = o.glow || [255, 220, 150];
  if (xr) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = ga(c, 0.9); ctx.shadowBlur = 30 * st;
    ctx.fillStyle = ga(c, 0.22 + 0.25 * st); ctx.fill(p); ctx.restore();
    ctx.strokeStyle = ga(c, 0.95); ctx.lineWidth = 6; ctx.stroke(p);
  } else {
    ctx.fillStyle = o.color || '#c9a74e'; ctx.fill(p); ctx.strokeStyle = 'rgba(46,28,12,0.9)'; ctx.lineWidth = 5; ctx.stroke(p);
  }
  if (o.crack > 0) {
    ctx.strokeStyle = xr ? 'rgba(20,20,18,0.9)' : 'rgba(46,28,12,0.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const pts = [[-10, -50], [4, -22], [-8, -2], [10, 22], [0, 58]], n = Math.max(1, Math.round(clamp(o.crack) * (pts.length - 1)));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  ctx.restore();
}

// A dark wooden specimen box with a cream backing; o.inside(ctx, ix, iy, iw, ih) draws the content.
export function drawSpecimenFrame(ctx, x, y, w, h, o = {}) {
  const b = o.border ?? 34;
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.shadowColor = 'rgba(30,18,6,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#6a4426'); g.addColorStop(0.5, '#4a2c16'); g.addColorStop(1, '#341e0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,170,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.strokeStyle = 'rgba(20,10,4,0.7)'; ctx.lineWidth = 4; ctx.strokeRect(b - 4, b - 4, w - 2 * b + 8, h - 2 * b + 8);
  ctx.drawImage(paperTexture(Math.round(w - 2 * b), Math.round(h - 2 * b), '#efe6cf', 19, false), b, b);
  ctx.save(); ctx.beginPath(); ctx.rect(b, b, w - 2 * b, h - 2 * b); ctx.clip();
  if (o.inside) o.inside(ctx, b, b, w - 2 * b, h - 2 * b);
  // glass sheen
  const sh = ctx.createLinearGradient(b, b, w * 0.7, h * 0.7);
  sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.03)'); sh.addColorStop(0.32, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(b, b, w - 2 * b, h - 2 * b);
  ctx.restore();
  ctx.restore();
}

// An entomology pin seen from the front: a glossy black head with a little shadow.
export function drawPin(ctx, x, y, r = 9) {
  ctx.save();
  ctx.fillStyle = 'rgba(30,18,6,0.35)'; ctx.beginPath(); ctx.ellipse(x + r * 0.9, y + r * 1.2, r * 1.1, r * 0.6, 0.5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.35, '#2a2a2a'); g.addColorStop(1, '#050505');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

Object.assign(Scene.prototype, {
  bloodStream(o = {}) { return this.add(new BloodStream(this, o)); },
});
