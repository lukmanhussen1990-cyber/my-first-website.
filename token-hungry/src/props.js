// Paper props: tokens, prompt strips, the usage meter, the idea spark and
// the finished illustrated page.
import { TAU, clamp, lerp, hash, E, vnoise } from './util.js';
import { C, softEllipse, brush, bez, wobble, roundRectPts, pathFrom, blobPts, setShadow, curScale } from './style.js';
import { F } from './type.js';

// ---------------------------------------------------------------------------
// Tokens: small cream / terracotta paper tiles with an abstract mark.
export const MARKS = ['lines', 'dot', 'arc', 'zig', 'ring', 'plus', 'slash', 'tri', 'wave'];

function tilePath(ctx, s, seed) {
  // Hand-cut rounded square, unit-centred, size s.
  const h = s / 2;
  const r0 = s * 0.2;
  const j = (k) => 1 + (hash(k, seed) - 0.5) * 0.3;
  const rs = [r0 * j(1), r0 * j(2), r0 * j(3), r0 * j(4)];
  const bow = (k) => (hash(k + 10, seed) - 0.5) * s * 0.035;
  ctx.beginPath();
  ctx.moveTo(-h + rs[0], -h);
  ctx.quadraticCurveTo(0, -h + bow(1), h - rs[1], -h);
  ctx.quadraticCurveTo(h, -h, h, -h + rs[1]);
  ctx.quadraticCurveTo(h + bow(2), 0, h, h - rs[2]);
  ctx.quadraticCurveTo(h, h, h - rs[2], h);
  ctx.quadraticCurveTo(0, h + bow(3), -h + rs[3], h);
  ctx.quadraticCurveTo(-h, h, -h, h - rs[3]);
  ctx.quadraticCurveTo(-h + bow(4), 0, -h, -h + rs[0]);
  ctx.quadraticCurveTo(-h, -h, -h + rs[0], -h);
  ctx.closePath();
}

function drawMark(ctx, mark, s, color, seed) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.085;
  const u = s;
  ctx.beginPath();
  switch (mark) {
    case 'lines':
      ctx.moveTo(-0.22 * u, -0.09 * u);
      ctx.lineTo(0.2 * u, -0.09 * u);
      ctx.moveTo(-0.22 * u, 0.1 * u);
      ctx.lineTo(0.05 * u, 0.1 * u);
      ctx.stroke();
      break;
    case 'dot':
      ctx.arc(0, 0, 0.13 * u, 0, TAU);
      ctx.fill();
      break;
    case 'arc':
      ctx.arc(0, 0.08 * u, 0.17 * u, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      break;
    case 'zig':
      ctx.moveTo(-0.22 * u, 0.07 * u);
      ctx.lineTo(-0.08 * u, -0.08 * u);
      ctx.lineTo(0.06 * u, 0.07 * u);
      ctx.lineTo(0.2 * u, -0.08 * u);
      ctx.stroke();
      break;
    case 'ring':
      ctx.arc(0, 0, 0.15 * u, 0, TAU);
      ctx.stroke();
      break;
    case 'plus':
      ctx.moveTo(-0.17 * u, 0);
      ctx.lineTo(0.17 * u, 0);
      ctx.moveTo(0, -0.17 * u);
      ctx.lineTo(0, 0.17 * u);
      ctx.stroke();
      break;
    case 'slash':
      ctx.moveTo(-0.16 * u, 0.13 * u);
      ctx.lineTo(-0.02 * u, -0.13 * u);
      ctx.moveTo(0.04 * u, 0.13 * u);
      ctx.lineTo(0.18 * u, -0.13 * u);
      ctx.stroke();
      break;
    case 'tri':
      ctx.moveTo(0, -0.16 * u);
      ctx.lineTo(0.16 * u, 0.12 * u);
      ctx.lineTo(-0.16 * u, 0.12 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case 'wave':
      ctx.moveTo(-0.22 * u, 0.02 * u);
      ctx.bezierCurveTo(-0.12 * u, -0.16 * u, -0.02 * u, 0.18 * u, 0.06 * u, 0.0);
      ctx.bezierCurveTo(0.12 * u, -0.12 * u, 0.18 * u, -0.06 * u, 0.22 * u, 0.02 * u);
      ctx.stroke();
      break;
  }
}

export function tokenLook(i) {
  const kind = hash(i, 77) < 0.58 ? 'cream' : 'terra';
  const mark = MARKS[(i * 4 + Math.floor(hash(i, 91) * 3)) % MARKS.length];
  const markInk = hash(i, 55) < 0.5;
  return { kind, mark, markInk, seed: i + 3 };
}

// tk: {x, y, size, rot, flip (scaleX), sq (squash y), kind, mark, markInk, seed,
//      alpha, lift (shadow distance), contact (0..1 contact-shadow strength)}
export function drawToken(ctx, tk) {
  const s = tk.size;
  if (tk.alpha <= 0 || s < 0.5) return;
  const flip = tk.flip ?? 1;
  const sq = tk.sq ?? 1;
  const lift = tk.lift ?? 0;
  const th = s * 0.09;
  ctx.save();
  ctx.globalAlpha *= tk.alpha ?? 1;
  // contact shadow (on the surface below)
  if (tk.contact > 0.01 && tk.groundY != null) {
    const k = tk.contact;
    softEllipse(ctx, tk.x + s * 0.06, tk.groundY + 1, s * 0.55, s * 0.09, `rgba(70,46,22,${0.34 * k})`, 5);
  }
  const front = tk.kind === 'terra' ? C.terra : C.cream;
  const edge = tk.kind === 'terra' ? C.terraDeep : C.creamEdge;
  const showFront = flip >= 0;
  // thickness (screen-down extrusion); it also casts the soft shadow
  ctx.save();
  setShadow(ctx, 3 + lift * 0.1, 6 + lift * 0.16, 7 + lift * 0.08, `rgba(80,52,26,${0.24 / (1 + lift / 120)})`);
  ctx.translate(tk.x, tk.y + th);
  ctx.rotate(tk.rot);
  ctx.scale(Math.max(Math.abs(flip), 0.08), sq);
  tilePath(ctx, s, tk.seed);
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = s * 0.055;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
  // face
  ctx.save();
  ctx.translate(tk.x, tk.y);
  ctx.rotate(tk.rot);
  ctx.scale(Math.max(Math.abs(flip), 0.08), sq);
  tilePath(ctx, s, tk.seed);
  ctx.fillStyle = showFront ? front : edge;
  ctx.fill();
  ctx.lineWidth = s * 0.055;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (showFront && (tk.markAlpha ?? 1) > 0) {
    ctx.globalAlpha *= tk.markAlpha ?? 1;
    const mc = tk.kind === 'terra' ? C.cream : tk.markInk ? C.ink : C.terra;
    drawMark(ctx, tk.mark, s, mc, tk.seed);
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Prompt strip: a cream paper slip that unfolds (gatefold) to show its text,
// then splits into pieces that become tokens.
export function drawStrip(ctx, st) {
  const { x, y, w, h, text } = st;
  const u = clamp(st.unfold);
  if (st.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= st.alpha;
  ctx.translate(x, y);
  ctx.rotate(st.rot || 0);
  ctx.scale(st.scale ?? 1, st.scale ?? 1);
  const pw = w / 3;
  const phi = (1 - u) * Math.PI; // flap angle: PI = folded over, 0 = flat
  const cphi = Math.cos(phi);
  const left = -pw * 1.5;
  // overall shadow (cast from the visible paper area)
  const extent = pw / 2 + Math.max(0, cphi) * pw;
  ctx.save();
  setShadow(ctx, 5, 9, 14, 'rgba(80,52,26,0.22)');
  ctx.fillStyle = C.cream;
  ctx.fillRect(-extent, -h / 2, extent * 2, h);
  ctx.restore();

  const drawText = () => {
    ctx.fillStyle = C.ink;
    ctx.font = `${st.fontSize || 34}px ${F.sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 0, h * 0.14);
  };
  const lw = 3.2;
  // middle panel
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pw / 2, -h / 2, pw, h);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.clip();
  drawText();
  ctx.restore();
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  // flaps
  for (const side of [-1, 1]) {
    const hinge = (side * pw) / 2;
    const fw = pw * cphi; // projected width (negative = folded over middle)
    ctx.save();
    if (cphi >= 0) {
      // front side visible: map flat coords via scale about the hinge
      ctx.beginPath();
      const x0 = hinge;
      const x1 = hinge + side * fw;
      ctx.rect(Math.min(x0, x1), -h / 2, Math.abs(x1 - x0), h);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha *= Math.pow(cphi, 1.5);
      ctx.translate(hinge, 0);
      ctx.scale(Math.max(cphi, 0.001), 1);
      ctx.translate(-hinge, 0);
      drawText();
      ctx.restore();
      // shading for the angle
      ctx.fillStyle = `rgba(120,90,50,${(1 - cphi) * 0.22})`;
      ctx.fill();
    } else {
      // folded over: show the plain back of the flap
      const x0 = hinge;
      const x1 = hinge + side * fw;
      ctx.beginPath();
      ctx.rect(Math.min(x0, x1), -h / 2, Math.abs(x1 - x0), h);
      ctx.fillStyle = '#EFE4CF';
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  // middle outline (only visible parts)
  ctx.beginPath();
  if (cphi >= 0) {
    ctx.moveTo(-pw / 2 - pw * cphi, -h / 2);
    ctx.lineTo(pw / 2 + pw * cphi, -h / 2);
    ctx.moveTo(-pw / 2 - pw * cphi, h / 2);
    ctx.lineTo(pw / 2 + pw * cphi, h / 2);
  } else {
    ctx.rect(-pw / 2, -h / 2, pw, h);
  }
  ctx.stroke();
  // fold creases
  if (u > 0.5) {
    ctx.strokeStyle = `rgba(42,37,33,${0.12 * (u - 0.5) * 2})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-pw / 2, -h / 2 + 6);
    ctx.lineTo(-pw / 2, h / 2 - 6);
    ctx.moveTo(pw / 2, -h / 2 + 6);
    ctx.lineTo(pw / 2, h / 2 - 6);
    ctx.stroke();
  }
  // outer ends
  if (cphi >= 0) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-pw / 2 - pw * cphi, -h / 2);
    ctx.lineTo(-pw / 2 - pw * cphi, h / 2);
    ctx.moveTo(pw / 2 + pw * cphi, -h / 2);
    ctx.lineTo(pw / 2 + pw * cphi, h / 2);
    ctx.stroke();
  }
  ctx.restore();
}

// A piece of a strip mid-way through turning into a token.
// p: {x, y, w, h, k (0..1 morph), rot, kind, mark, markInk, seed, text, textOffset, stripW, fontSize, alpha}
export function drawStripPiece(ctx, p) {
  const k = clamp(p.k);
  const size = lerp(1, 1, k);
  const pw = lerp(p.w, p.size, E.inOutCubic(k));
  const ph = lerp(p.h, p.size, E.inOutCubic(k));
  ctx.save();
  ctx.globalAlpha *= p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const r = lerp(2, p.size * 0.2, k);
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
  const target = p.kind === 'terra' ? C.terra : C.cream;
  ctx.save();
  setShadow(ctx, 4, 7, 10, 'rgba(80,52,26,0.2)');
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.restore();
  if (p.kind === 'terra' && k > 0) {
    ctx.globalAlpha *= 1;
    ctx.save();
    ctx.globalAlpha *= E.inOutSine(k);
    ctx.fillStyle = target;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.clip();
  if (k < 0.6) {
    ctx.globalAlpha *= 1 - k / 0.6;
    ctx.fillStyle = C.ink;
    ctx.font = `${p.fontSize}px ${F.sans}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.text, -p.textOffset, p.h * 0.14);
  }
  ctx.restore();
  ctx.lineWidth = lerp(3.2, p.size * 0.055, k);
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (k > 0.5) {
    ctx.save();
    ctx.globalAlpha *= (k - 0.5) * 2;
    const mc = p.kind === 'terra' ? C.cream : p.markInk ? C.ink : C.terra;
    drawMark(ctx, p.mark, p.size, mc, p.seed);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// "Claude usage" meter: a hand-drawn capsule that fills with each bite.
export function drawMeter(ctx, m, t) {
  if (m.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= m.alpha;
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot || 0);
  const w = m.w;
  const h = m.h;
  const seed = m.boil | 0;
  // label
  ctx.fillStyle = C.ink;
  ctx.font = `30px ${F.sans}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Claude usage', 46, -24);
  // tiny token icon by the label
  drawToken(ctx, { x: 16, y: -36, size: 26, rot: -0.12, kind: 'terra', mark: 'dot', seed: 5, alpha: 1, lift: 0 });
  // capsule (casts a soft shadow)
  ctx.save();
  setShadow(ctx, 4, 7, 12, 'rgba(80,52,26,0.18)');
  ctx.fillStyle = C.cream;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  // fill level with a lively edge
  const lvl = clamp(m.level, 0, 1);
  if (lvl > 0.002) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(5, 5, w - 10, h - 10, (h - 10) / 2);
    ctx.clip();
    const fx = 5 + (w - 10) * lvl;
    const amp = 4 + m.slosh * 9;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(fx, -2);
    for (let i = 0; i <= 12; i++) {
      const yy = (i / 12) * (h + 4) - 2;
      ctx.lineTo(fx + Math.sin(i * 0.9 + t * 9) * amp * 0.5 * (0.3 + m.slosh), yy);
    }
    ctx.lineTo(0, h + 2);
    ctx.closePath();
    ctx.fillStyle = C.terra;
    ctx.fill();
    ctx.clip();
    // hatching
    ctx.strokeStyle = 'rgba(251,245,232,0.32)';
    ctx.lineWidth = 3;
    for (let xx = -h; xx < w + h; xx += 15) {
      ctx.beginPath();
      ctx.moveTo(xx, h + 4);
      ctx.lineTo(xx + h, -4);
      ctx.stroke();
    }
    ctx.restore();
  }
  // hand-drawn outline
  const pts = wobble(roundRectPts(0, 0, w, h, h / 2, 10), 1.1, seed + 3, 0.03);
  pts.push(pts[0]);
  brush(ctx, pts, 5.2, C.ink, { taper: 0.0, minW: 1, seed, widthJitter: 0.18 });
  // ticks (no numbers)
  ctx.strokeStyle = 'rgba(42,37,33,0.55)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 1; i < 8; i++) {
    const xx = (w * i) / 8;
    ctx.beginPath();
    ctx.moveTo(xx, h + 12);
    ctx.lineTo(xx + 0.6, h + (i % 2 ? 20 : 26));
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Idea spark that can morph into a page outline.
function sparkOutline(r, morph, pw, ph, n = 18) {
  // 4 edges; star edges are concave curves between points.
  const rot = morph * (Math.PI / 4);
  const pts = [];
  const outerR = lerp(r, Math.hypot(pw, ph) / 2, morph);
  for (let e = 0; e < 4; e++) {
    const a0 = -Math.PI / 2 + e * (Math.PI / 2) + rot;
    const a1 = a0 + Math.PI / 2;
    const P0s = [Math.cos(a0) * r, Math.sin(a0) * r];
    const P1s = [Math.cos(a1) * r, Math.sin(a1) * r];
    const Cs = [Math.cos(a0 + Math.PI / 4) * r * 0.2, Math.sin(a0 + Math.PI / 4) * r * 0.2];
    // rectangle corners in the same order (clockwise from top-left)
    const corners = [
      [-pw / 2, -ph / 2],
      [pw / 2, -ph / 2],
      [pw / 2, ph / 2],
      [-pw / 2, ph / 2],
    ];
    const R0 = corners[e];
    const R1 = corners[(e + 1) % 4];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const m = 1 - u;
      const sx = m * m * P0s[0] + 2 * m * u * Cs[0] + u * u * P1s[0];
      const sy = m * m * P0s[1] + 2 * m * u * Cs[1] + u * u * P1s[1];
      const rx = lerp(R0[0], R1[0], u);
      const ry = lerp(R0[1], R1[1], u);
      const k = E.inOutCubic(morph);
      pts.push([lerp(sx, rx, k), lerp(sy, ry, k)]);
    }
  }
  return pts;
}

export function drawSpark(ctx, sp) {
  if (sp.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= sp.alpha;
  ctx.translate(sp.x, sp.y);
  ctx.rotate(sp.rot || 0);
  ctx.scale(sp.scale, sp.scale);
  const r = sp.r;
  const pts = sparkOutline(r, 0, 0, 0);
  // glow
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
  g.addColorStop(0, 'rgba(255,214,107,0.55)');
  g.addColorStop(1, 'rgba(255,214,107,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, TAU);
  ctx.fill();
  pathFrom(ctx, pts);
  ctx.fillStyle = C.goldLight;
  ctx.fill();
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // radiating dashes
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.1;
  const rays = sp.rays ?? 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const r0 = r * (1.25 + 0.1 * Math.sin(i * 2.1));
    const r1 = r0 + r * 0.42 * rays;
    if (rays <= 0.01) continue;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

// The finished illustrated page. morph < 1 draws the spark->page transition.
export function drawPage(ctx, pg, t) {
  if (pg.alpha <= 0) return;
  const w = pg.w;
  const h = pg.h;
  const morph = clamp(pg.morph ?? 1);
  ctx.save();
  ctx.globalAlpha *= pg.alpha;
  ctx.translate(pg.x, pg.y);
  ctx.rotate(pg.rot || 0);
  ctx.scale(pg.scale ?? 1, pg.scale ?? 1);
  const lineK = 1 / (pg.scale ?? 1);
  const pts = sparkOutline(pg.r ?? 30, morph, w, h);
  pathFrom(ctx, pts);
  const k = E.inOutCubic(morph);
  ctx.save();
  setShadow(ctx, 8 * (pg.shadowOff ?? 1), 14 * (pg.shadowOff ?? 1), 22 * (pg.shadowBlurK ?? 1), `rgba(80,52,26,${0.22 * (pg.shadowK ?? 1)})`);
  ctx.fillStyle = morph < 1 ? mixHex(C.goldLight, '#FCF8EE', k) : '#FCF8EE';
  ctx.fill();
  ctx.restore();
  const reveal = clamp(pg.reveal ?? 0);
  const contentA = clamp(pg.contentAlpha ?? 1);
  if (reveal > 0 && contentA > 0) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha *= contentA;
    pageContent(ctx, w, h, reveal, pg.boil | 0);
    ctx.restore();
  }
  pathFrom(ctx, pts);
  ctx.lineWidth = Math.max(4.2 * lineK, (pg.r ?? 30) * 0.12 * (1 - k));
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function mixHex(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(lerp(v, pb[i], k)));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

function seg(r, a, b) {
  return E.outCubic(clamp((r - a) / (b - a)));
}

function pageContent(ctx, w, h, r, boil) {
  const L = -w / 2 + 28;
  const T = -h / 2 + 26;
  const iw = w - 56;
  // heading strokes
  const h1 = seg(r, 0.0, 0.25);
  if (h1 > 0) {
    brush(ctx, [[L, T + 16], [L + 130 * h1, T + 15]], 10, C.ink, { taper: 0.1, minW: 0.7, seed: 4 });
    const h2 = seg(r, 0.08, 0.3);
    if (h2 > 0) brush(ctx, [[L, T + 38], [L + 82 * h2, T + 38]], 6, C.terra, { taper: 0.1, minW: 0.7, seed: 5 });
  }
  // illustration panel
  const py = T + 58;
  const ph = 132;
  const pa = seg(r, 0.12, 0.42);
  if (pa > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, py, iw, ph);
    ctx.fillStyle = '#F6E7CC';
    ctx.globalAlpha *= pa;
    ctx.fill();
    ctx.clip();
    // sun (a little golden ball, echoing our hero)
    const sk = seg(r, 0.25, 0.5);
    if (sk > 0) {
      const sx = L + iw * 0.7;
      const sy = py + 46 + (1 - sk) * 40;
      ctx.beginPath();
      ctx.arc(sx, sy, 21, 0, TAU);
      ctx.fillStyle = C.gold;
      ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }
    // hills
    const hk = seg(r, 0.3, 0.58);
    if (hk > 0) {
      const base = py + ph + 4;
      ctx.beginPath();
      ctx.moveTo(L - 5, base);
      ctx.lineTo(L - 5, base - 40 * hk);
      ctx.bezierCurveTo(L + iw * 0.25, base - 95 * hk, L + iw * 0.45, base - 30 * hk, L + iw * 0.6, base - 52 * hk);
      ctx.bezierCurveTo(L + iw * 0.75, base - 75 * hk, L + iw * 0.9, base - 40 * hk, L + iw + 5, base - 46 * hk);
      ctx.lineTo(L + iw + 5, base);
      ctx.closePath();
      ctx.fillStyle = C.terra;
      ctx.fill();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(L - 5, base);
      ctx.lineTo(L - 5, base - 14 * hk);
      ctx.bezierCurveTo(L + iw * 0.3, base - 30 * hk, L + iw * 0.6, base - 6 * hk, L + iw + 5, base - 24 * hk);
      ctx.lineTo(L + iw + 5, base);
      ctx.closePath();
      ctx.fillStyle = C.terraDeep;
      ctx.fill();
      ctx.stroke();
    }
    // birds
    const bk = seg(r, 0.45, 0.65);
    if (bk > 0) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const [bx, by, bs] of [
        [L + 34, py + 34, 9],
        [L + 58, py + 50, 7],
      ]) {
        ctx.beginPath();
        ctx.moveTo(bx - bs, by - bs * 0.4 * bk);
        ctx.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.55 * bk, bx, by);
        ctx.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.55 * bk, bx + bs, by - bs * 0.4 * bk);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= pa;
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(L, py, iw, ph);
    ctx.restore();
  }
  // text lines
  const lens = [0.92, 0.78, 0.86, 0.55];
  for (let i = 0; i < 4; i++) {
    const lk = seg(r, 0.5 + i * 0.09, 0.66 + i * 0.09);
    if (lk <= 0) continue;
    const yy = py + ph + 30 + i * 21;
    brush(ctx, [[L, yy], [L + iw * lens[i] * lk, yy + (hash(i, 9) - 0.5) * 1.5]], 5.2, 'rgba(42,37,33,0.86)', {
      taper: 0.05,
      minW: 0.8,
      seed: 11 + i,
    });
  }
  // little signature
  const sg = seg(r, 0.86, 1.0);
  if (sg > 0) {
    const sx = L + iw - 60;
    const sy = h / 2 - 26;
    const pts = [];
    for (let i = 0; i <= 24 * sg; i++) {
      const u = i / 24;
      pts.push([sx + u * 56, sy + Math.sin(u * 13) * 5 * (1 - u * 0.4) - u * 4]);
    }
    if (pts.length > 1) brush(ctx, pts, 3.4, C.terra, { taper: 0.2, minW: 0.5, seed: 21 });
  }
}

// Short ink "action" marks radiating from a point.
export function drawActionMarks(ctx, x, y, angles, r0, len, w, k, color = C.ink) {
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  const grow = clamp(k * 2);
  const fade = clamp((1 - k) * 3);
  ctx.globalAlpha *= fade;
  for (const a of angles) {
    const s0 = r0 + len * clamp((k - 0.35) * 1.6);
    const s1 = r0 + len * grow;
    if (s1 - s0 < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s0, y + Math.sin(a) * s0);
    ctx.lineTo(x + Math.cos(a) * s1, y + Math.sin(a) * s1);
    ctx.stroke();
  }
  ctx.restore();
}

// Small 4-point twinkle (glints, sparkles).
export function drawTwinkle(ctx, x, y, r, k, color = '#FFF8E6', outline = true) {
  if (k <= 0) return;
  const s = r * Math.sin(Math.PI * clamp(k));
  if (s < 0.3) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(k * 0.6);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU - Math.PI / 2;
    const b = a + Math.PI / 4;
    if (i === 0) ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s);
    else ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.quadraticCurveTo(Math.cos(b) * s * 0.18, Math.sin(b) * s * 0.18, Math.cos(a + Math.PI / 2) * s, Math.sin(a + Math.PI / 2) * s);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.strokeStyle = C.ink;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}
