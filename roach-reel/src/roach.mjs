// Cartoon low-poly cockroach rig (front 3/4 view, upright). Origin = between the feet.
import { TAU, rgb, hex, mixc, clamp, lerp, noise1 } from './core.mjs';
import { blob, ellipsePts, ellipseBlob, cached, drawMesh, limb, taper, bezierPts, glow, softShadow, path, slab } from './poly.mjs';

const COL = {
  shell: hex('#6b3a1c'), shellDk: hex('#3d1f0e'), belly: hex('#c27f43'), bellyDk: hex('#8f5426'),
  margin: hex('#d9a464'), head: hex('#7a4321'), leg: hex('#4a2612'), legLt: hex('#7d4524'),
  eye: hex('#fbf7ee'), pupil: hex('#140c08'), mouth: hex('#3a0d0d'), tongue: hex('#d2545f'), teeth: hex('#fffdf3'),
  brow: hex('#24120a'),
};

const M = {
  head: () => ellipseBlob(52, 45, { n: 14, rings: [0.7, 0.36], bulge: 0.7, seed: 3, apex: [-0.18, -0.25] }),
  abdomen: () => blob(ellipsePts(60, 84, 16, 0, 0, 0, 0.0, 5).map(([x, y]) => [x * (y > 0 ? 0.86 : 1), y]), { rings: [0.72, 0.4], bulge: 0.75, seed: 6 }),
  belly: () => blob(ellipsePts(38, 70, 14, 0, 0, 0, 0, 7).map(([x, y]) => [x * (y > 0 ? 0.8 : 1), y]), { rings: [0.6], bulge: 0.5, seed: 8 }),
  pronotum: () => blob([[-70, 8], [-62, -14], [-40, -30], [0, -36], [40, -30], [62, -14], [70, 8], [50, 26], [0, 32], [-50, 26]], { rings: [0.7, 0.35], bulge: 0.65, seed: 9 }),
  pronIn: () => blob([[-56, 6], [-50, -10], [-32, -24], [0, -28], [32, -24], [50, -10], [56, 6], [40, 20], [0, 24], [-40, 20]], { rings: [0.6], bulge: 0.6, seed: 10 }),
  wingL: () => blob([[-30, -90], [-48, -76], [-63, -40], [-65, 10], [-54, 56], [-32, 84], [-16, 90], [-30, 40], [-36, -20]], { rings: [0.6], bulge: 0.6, seed: 11, apex: [-0.3, -0.2] }),
  eye: () => ellipseBlob(21, 25, { n: 12, rings: [0.62], bulge: 0.45, seed: 12, apex: [-0.25, -0.3] }),
};
const mesh = (k) => cached('roach:' + k, M[k]);

// shared materials
const mat = {
  shell: { c: COL.shell, kd: 0.85, spec: 0.75, shin: 26, jit: 0.07 },
  belly: { c: COL.belly, kd: 0.75, spec: 0.12, shin: 10, jit: 0.06 },
  margin: { c: COL.margin, kd: 0.8, spec: 0.4, shin: 20, jit: 0.05 },
  head: { c: COL.head, kd: 0.85, spec: 0.45, shin: 22, jit: 0.06 },
  eye: { c: COL.eye, kd: 0.3, amb: 1.0, emit: 0.55, spec: 0.35, shin: 30, jit: 0.02, rim: 0.2 },
};

const legCol = (k = 1) => [rgb(mixc(COL.legLt, [0, 0, 0], 1 - k)), rgb(mixc(COL.leg, [0, 0, 0], 1 - k))];

function segLeg(ctx, root, a1, l1, a2, l2, w1 = 11, w2 = 8, footA = 0, k = 1, spines = true) {
  const p1 = [root[0] + Math.sin(a1) * l1, root[1] + Math.cos(a1) * l1];
  const p2 = [p1[0] + Math.sin(a2) * l2, p1[1] + Math.cos(a2) * l2];
  const p3 = [p2[0] + Math.sin(a2 + footA) * l2 * 0.45, p2[1] + Math.cos(a2 + footA) * l2 * 0.45];
  const [lt, dk] = legCol(k);
  limb(ctx, [root, p1], [w1, w1 * 0.85], lt, dk);
  limb(ctx, [p1, p2], [w1 * 0.8, w2], lt, dk);
  limb(ctx, [p2, p3], [w2 * 0.8, w2 * 0.35], lt, dk);
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.arc(p1[0], p1[1], w1 * 0.48, 0, TAU); ctx.fill();
  if (spines) {
    // little gross spines along the shin
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const x = p1[0] + (p2[0] - p1[0]) * t, y = p1[1] + (p2[1] - p1[1]) * t;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, s = Math.sign(Math.sin(a2)) || 1;
      ctx.beginPath();
      ctx.moveTo(x - (dx / l) * 2.5, y - (dy / l) * 2.5);
      ctx.lineTo(x + nx * 8 * s + (dx / l) * 4, y + ny * 8 * s + (dy / l) * 4);
      ctx.lineTo(x + (dx / l) * 2.5, y + (dy / l) * 2.5);
      ctx.fill();
    }
  }
  return { p1, p2, p3 };
}

function antenna(ctx, root, ang, len, droop, t, phase, wig, k = 1) {
  // ang: initial direction (radians, 0 = up, + = right). Wiggly bezier.
  const w1 = Math.sin(t * 7.3 + phase) * wig, w2 = Math.sin(t * 11.1 + phase * 1.7) * wig * 1.4;
  const d = (a, l) => [Math.sin(a) * l, -Math.cos(a) * l];
  const c1 = d(ang + w1 * 0.4, len * 0.4);
  const c2 = d(ang + droop * 0.5 + w1, len * 0.75);
  const e = d(ang + droop + w2, len);
  const pts = bezierPts(root, [root[0] + c1[0], root[1] + c1[1]], [root[0] + c2[0], root[1] + c2[1]], [root[0] + e[0], root[1] + e[1]], 22);
  const [lt, dk] = legCol(k);
  taper(ctx, pts, 7, 2.2, dk);
  // highlight line
  ctx.strokeStyle = rgb(mixc(COL.legLt, [255, 220, 170], 0.25), 0.55 * k);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(pts[1][0] - 1.5, pts[1][1]);
  for (let i = 2; i < pts.length - 4; i++) ctx.lineTo(pts[i][0] - 1.5, pts[i][1]);
  ctx.stroke();
  // segment ticks
  ctx.fillStyle = dk;
  for (let i = 3; i < pts.length - 1; i += 3) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 3.6 - i * 0.1, 0, TAU); ctx.fill(); }
}

function eyeball(ctx, x, y, sx, p) {
  // sx: horizontal scale for 3/4 turn; p: pose
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  drawMesh(ctx, mesh('eye'), mat.eye);
  // pupil
  const ps = 9.5 * (p.pupil ?? 1);
  const lx = clamp(p.look?.[0] ?? 0, -1, 1) * 8, ly = clamp(p.look?.[1] ?? 0, -1, 1) * 10;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, 20.5, 24.5, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = rgb(COL.pupil);
  ctx.beginPath(); ctx.ellipse(lx, ly + 2, ps, ps * 1.12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(lx - ps * 0.38, ly - ps * 0.32, ps * 0.36, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(lx + ps * 0.35, ly + ps * 0.45, ps * 0.14, 0, TAU); ctx.fill();
  if (p.evilGlow) { ctx.fillStyle = `rgba(255,40,40,${p.evilGlow * 0.55})`; ctx.beginPath(); ctx.ellipse(lx, ly + 2, ps * 0.55, ps * 0.6, 0, 0, TAU); ctx.fill(); }
  // lids
  const open = clamp(p.eyeOpen ?? 1, 0, 1), low = clamp(p.lowerLid ?? 0, 0, 1);
  const lidC = rgb(mixc(COL.head, [0, 0, 0], 0.1));
  const topY = -25 + (1 - open) * 50;
  ctx.fillStyle = lidC;
  ctx.beginPath();
  ctx.moveTo(-30, -40); ctx.lineTo(30, -40); ctx.lineTo(30, topY + (p.lidTilt || 0) * 10); ctx.lineTo(-30, topY - (p.lidTilt || 0) * 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgb(COL.brow); ctx.lineWidth = 3.2;
  if (open < 0.98) { ctx.beginPath(); ctx.moveTo(-30, topY - (p.lidTilt || 0) * 10); ctx.lineTo(30, topY + (p.lidTilt || 0) * 10); ctx.stroke(); }
  if (low > 0) {
    const by = 25 - low * 30;
    ctx.fillStyle = lidC;
    ctx.beginPath(); ctx.moveTo(-30, 40); ctx.lineTo(30, 40); ctx.lineTo(30, by); ctx.quadraticCurveTo(0, by - 6, -30, by); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-30, by); ctx.quadraticCurveTo(0, by - 6, 30, by); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,18,8,0.85)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(0, 0, 21, 25, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

function mouth(ctx, p) {
  const type = p.mouth || 'smile', o = clamp(p.mouthOpen ?? 0, 0, 1), g = p.grin ?? 0.6;
  ctx.save();
  ctx.translate(0, -229);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (type === 'evil' || type === 'grin') {
    const w = 18 + g * 12, h = 6 + g * 8 + o * 10;
    ctx.beginPath();
    ctx.moveTo(-w, -4 - g * 6);
    ctx.quadraticCurveTo(0, h * 1.4, w, -4 - g * 6);
    ctx.quadraticCurveTo(0, h * 0.25 - 2, -w, -4 - g * 6);
    ctx.closePath();
    ctx.fillStyle = rgb(COL.mouth); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgb(COL.teeth);
    // teeth row (pointy for evil)
    ctx.beginPath();
    const n = 6;
    ctx.moveTo(-w, -6 - g * 6);
    for (let i = 0; i <= n; i++) {
      const x = -w + (2 * w * i) / n;
      ctx.lineTo(x, -6);
      if (i < n) ctx.lineTo(x + w / n, type === 'evil' ? 6 + g * 4 : 2.5);
    }
    ctx.lineTo(w, -12 - g * 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgb(COL.tongue); ctx.beginPath(); ctx.ellipse(0, h * 0.95, w * 0.45, 5 + o * 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgb(COL.brow); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-w, -4 - g * 6); ctx.quadraticCurveTo(0, h * 1.4, w, -4 - g * 6); ctx.stroke();
    // cheek creases
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-w - 3, -10 - g * 6); ctx.lineTo(-w + 2, -2 - g * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w + 3, -10 - g * 6); ctx.lineTo(w - 2, -2 - g * 6); ctx.stroke();
  } else if (type === 'open' || type === 'o') {
    const w = type === 'o' ? 8 + o * 4 : 12 + o * 8, h = type === 'o' ? 9 + o * 6 : 8 + o * 16;
    ctx.beginPath(); ctx.ellipse(0, 2 + h * 0.3, w, h, 0, 0, TAU);
    ctx.fillStyle = rgb(COL.mouth); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgb(COL.tongue); ctx.beginPath(); ctx.ellipse(0, 2 + h * 1.1, w * 0.8, h * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(COL.teeth); ctx.fillRect(-w, 2 + h * 0.3 - h, w * 2, h * 0.32);
    ctx.restore();
    ctx.strokeStyle = rgb(COL.brow); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 2 + h * 0.3, w, h, 0, 0, TAU); ctx.stroke();
  } else if (type === 'flat') {
    ctx.strokeStyle = rgb(COL.brow); ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 1); ctx.stroke();
  } else { // smile
    const w = 14 + g * 8;
    ctx.strokeStyle = rgb(COL.brow); ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(-w, -3 - g * 3); ctx.quadraticCurveTo(0, 8 + g * 8, w, -3 - g * 3); ctx.stroke();
    if (o > 0.05) {
      ctx.beginPath(); ctx.moveTo(-w, -3 - g * 3); ctx.quadraticCurveTo(0, 8 + g * 8 + o * 14, w, -3 - g * 3);
      ctx.quadraticCurveTo(0, 6 + g * 6, -w, -3 - g * 3); ctx.fillStyle = rgb(COL.mouth); ctx.fill();
    }
  }
  ctx.restore();
}

function brows(ctx, p, ex) {
  const b = p.brow ?? 0; // -1 evil, 0 neutral, 1 raised/happy
  const y = -294 - (p.browY || 0) - Math.max(0, b) * 6;
  ctx.fillStyle = rgb(COL.brow);
  for (const s of [-1, 1]) {
    const cx = ex + s * 22;
    const rot = -s * (b < 0 ? -b * 0.45 : 0) + s * (p.browSad || 0) * 0.4;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-16, 2); ctx.quadraticCurveTo(0, -6 - Math.max(0, b) * 4, 16, 2); ctx.lineTo(14, 7); ctx.quadraticCurveTo(0, 0, -14, 7); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function hat(ctx, kind, col, ex) {
  ctx.save();
  ctx.translate(ex, -296);
  const c = hex(col || '#2b2b38');
  const m = { c, kd: 0.8, spec: 0.3, shin: 16 };
  if (kind === 'top') {
    drawMesh(ctx, cached('hat:top:brim', () => ellipseBlob(46, 9, { n: 10, rings: [0.5], bulge: 0.3, seed: 41 })), m);
    drawMesh(ctx, cached('hat:top', () => slab(-28, -64, 56, 60, { bevel: 7, seed: 42, cols: 2, rows: 2 })), m);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-28, -18, 56, 9);
  } else if (kind === 'cap') {
    drawMesh(ctx, cached('hat:cap', () => blob(ellipsePts(42, 28, 12, 0, 0, -10).map(([x, y]) => [x, Math.min(y, 2)]), { rings: [0.6], bulge: 0.6, seed: 43 })), m);
    drawMesh(ctx, cached('hat:capbill', () => ellipseBlob(34, 8, { n: 10, rings: [0.5], bulge: 0.2, seed: 44, cx: 24, cy: 4 })), { ...m, c: c.map((v) => v * 0.8) });
  } else if (kind === 'party') {
    drawMesh(ctx, cached('hat:party', () => blob([[-26, 4], [0, -70], [26, 4], [0, 10]], { rings: [0.5], bulge: 0.3, seed: 45 })), m);
    ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.arc(0, -72, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-17, -18); ctx.lineTo(12, -32); ctx.moveTo(-9, -42); ctx.lineTo(8, -50); ctx.stroke();
  } else if (kind === 'cowboy') {
    drawMesh(ctx, cached('hat:cowbrim', () => blob([[-64, 2], [-50, -8], [-20, -6], [20, -6], [50, -8], [64, 2], [40, 10], [-40, 10]], { rings: [0.5], bulge: 0.25, seed: 46 })), m);
    drawMesh(ctx, cached('hat:cow', () => blob([[-30, -2], [-28, -34], [-10, -44], [0, -36], [10, -44], [28, -34], [30, -2]], { rings: [0.55], bulge: 0.45, seed: 47 })), m);
  } else if (kind === 'beanie') {
    drawMesh(ctx, cached('hat:beanie', () => blob(ellipsePts(44, 36, 12, 0, 0, -8).map(([x, y]) => [x, Math.min(y, 6)]), { rings: [0.6], bulge: 0.6, seed: 48 })), m);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, -46, 9, 0, TAU); ctx.fill();
  } else if (kind === 'chef') {
    drawMesh(ctx, cached('hat:chef', () => blob([[-30, 4], [-34, -30], [-20, -54], [0, -60], [20, -54], [34, -30], [30, 4]], { rings: [0.6], bulge: 0.55, seed: 49 })), { ...m, c: hex('#f4f4f4') });
  } else if (kind === 'bow') {
    ctx.fillStyle = col || '#ff5fa2';
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-24, -18); ctx.lineTo(-24, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(24, -18); ctx.lineTo(24, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -4, 7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the roach.
 * p: {x, y, s, flip, t, turn, lean, squash, headRot, eyeOpen, lowerLid, pupil, look, brow, mouth, mouthOpen, grin,
 *     antWig, antL, antR, arms:[[a1,a2],[a1,a2]], legs:[[a1,a2],[a1,a2]], mids, walk, acc:{...}, holdL, holdR, dim, shadow}
 */
export function drawRoach(ctx, p) {
  const t = p.t || 0;
  ctx.save();
  ctx.translate(p.x || 0, p.y || 0);
  const s = p.s || 1;
  ctx.scale(s * (p.flip ? -1 : 1), s);
  if (p.shadow !== false) softShadow(ctx, 0, 2, 92, 16, p.shadowA ?? 0.5);
  ctx.rotate(p.lean || 0);
  const sq = p.squash || 1;
  ctx.scale(1 / Math.sqrt(sq), sq);
  const turn = p.turn || 0;
  const k = p.dim ?? 1; // darkening for distant cousins
  const breathe = Math.sin(t * 2.6 + (p.seed || 0)) * 0.012;
  const walk = p.walk;

  // ---- legs
  let legs = p.legs || [[-0.62, 0.12], [0.62, -0.12]];
  if (walk != null) {
    const w = walk * TAU;
    legs = [
      [-0.5 + Math.sin(w) * 0.38, 0.1 + Math.max(0, Math.cos(w)) * 0.55],
      [0.5 + Math.sin(w + Math.PI) * 0.38, -0.1 - Math.max(0, Math.cos(w + Math.PI)) * 0.55],
    ];
  }
  const bob = walk != null ? -Math.abs(Math.sin(walk * TAU)) * 8 : 0;
  ctx.translate(0, bob);
  // hind legs (behind body)
  segLeg(ctx, [-26 + turn * 6, -64], legs[0][0], 38, legs[0][1], 40, 12, 9, -0.9, k);
  segLeg(ctx, [26 + turn * 6, -64], legs[1][0], 38, legs[1][1], 40, 12, 9, 0.9, k);
  // middle legs
  const mids = p.mids || [0, 0];
  const mw = Math.sin(t * 9 + 1) * (p.midWig ?? 0.12);
  segLeg(ctx, [-50 + turn * 4, -140], -1.95 + mids[0] + mw, 34, -0.9 + mids[0] * 0.5 - mw, 36, 10, 7, -0.6, k);
  segLeg(ctx, [50 + turn * 4, -140], 1.95 + mids[1] - mw, 34, 0.9 + mids[1] * 0.5 + mw, 36, 10, 7, 0.6, k);

  // ---- antennae (behind head)
  const hx = turn * 14;
  const HS = p.headScale || 1.22;
  ctx.save();
  ctx.translate(0, -222);
  ctx.rotate(p.headRot || 0);
  ctx.scale(HS, HS);
  ctx.translate(0, 230);
  const wig = p.antWig ?? 0.12;
  antenna(ctx, [hx - 16, -292], -0.45 + (p.antL || 0), p.antLen || 205, -0.95, t, 0.3, wig, k);
  antenna(ctx, [hx + 16, -292], 0.45 + (p.antR || 0), p.antLen || 205, 0.95, t, 2.1, wig, k);
  ctx.restore();

  // ---- body
  ctx.save();
  ctx.translate(turn * 5, -122);
  ctx.scale(0.9 * (1 + breathe), 0.88 * (1 - breathe * 0.5));
  const km = (m0) => (k < 1 ? { ...m0, c: mixc(m0.c, [0, 0, 0], 1 - k) } : m0);
  drawMesh(ctx, mesh('abdomen'), km(mat.shell));
  ctx.save(); ctx.translate(turn * 6, 4); drawMesh(ctx, mesh('belly'), km(mat.belly));
  // belly segment bands
  ctx.strokeStyle = rgb(mixc(COL.bellyDk, [0, 0, 0], (1 - k) * 0.8), 0.9); ctx.lineWidth = 3;
  for (let i = -2; i <= 3; i++) { const y = i * 19; const w = 36 * Math.sqrt(Math.max(0, 1 - (y / 70) ** 2)) * (y > 0 ? 0.82 : 1); ctx.beginPath(); ctx.moveTo(-w, y - 3); ctx.quadraticCurveTo(0, y + 6, w, y - 3); ctx.stroke(); }
  ctx.restore();
  // wing covers
  ctx.save(); ctx.translate(-2 - turn * 4, 0); ctx.scale(1 - turn * 0.25, 1); drawMesh(ctx, mesh('wingL'), km({ ...mat.shell, c: mixc(COL.shell, COL.shellDk, 0.25) })); ctx.restore();
  ctx.save(); ctx.translate(2 - turn * 4, 0); ctx.scale(-(1 + turn * 0.25), 1); drawMesh(ctx, mesh('wingL'), km({ ...mat.shell, c: mixc(COL.shell, COL.shellDk, 0.25) })); ctx.restore();
  ctx.restore();

  // ---- pronotum
  ctx.save();
  ctx.translate(turn * 8, -204);
  drawMesh(ctx, mesh('pronotum'), km(mat.margin));
  ctx.translate(turn * 2, -1);
  drawMesh(ctx, mesh('pronIn'), km(mat.shell));
  ctx.restore();

  // ---- arms (front legs)
  const arms = p.arms || [[-0.75, 0.35], [0.75, -0.35]];
  const armR = segLeg(ctx, [52 + turn * 8, -196], arms[1][0], 40, arms[1][1], 38, 11, 8, 0.5, k, true);
  const armL = segLeg(ctx, [-52 + turn * 8, -196], arms[0][0], 40, arms[0][1], 38, 11, 8, -0.5, k, true);
  if (p.holdL) { ctx.save(); ctx.translate(armL.p2[0], armL.p2[1]); p.holdL(ctx); ctx.restore(); }
  if (p.holdR) { ctx.save(); ctx.translate(armR.p2[0], armR.p2[1]); p.holdR(ctx); ctx.restore(); }

  // ---- head
  ctx.save();
  ctx.translate(0, -222);
  ctx.rotate(p.headRot || 0);
  ctx.scale(HS, HS);
  ctx.translate(0, 230);
  ctx.save(); ctx.translate(hx * 0.4, -254); drawMesh(ctx, mesh('head'), km(mat.head)); ctx.restore();
  // mandibles
  ctx.fillStyle = rgb(mixc(COL.leg, [0, 0, 0], 1 - k));
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(hx + sd * 26, -226); ctx.quadraticCurveTo(hx + sd * 34, -214, hx + sd * 22, -210); ctx.lineTo(hx + sd * 22, -218); ctx.closePath(); ctx.fill();
  }
  // eyes
  const nearL = 1 - Math.max(0, turn) * 0.25, nearR = 1 + Math.min(0, turn) * 0.25;
  if ((p.acc?.goggles || 0) > 0.02) { ctx.fillStyle = '#1d5d6b'; ctx.fillRect(hx - 54, -270, 108, 9); }
  eyeball(ctx, hx - 21, -262, nearL, p);
  eyeball(ctx, hx + 21, -262, nearR, p);
  brows(ctx, p, hx);
  ctx.save(); ctx.translate(hx, 0); mouth(ctx, p); ctx.restore();
  if (p.acc?.mustache) {
    ctx.fillStyle = '#1a0d06';
    ctx.save(); ctx.translate(hx, -238);
    ctx.beginPath(); ctx.moveTo(0, -2);
    ctx.bezierCurveTo(-10, -9, -24, -6, -30, 4); ctx.bezierCurveTo(-36, 0, -40, -8, -34, -12); ctx.bezierCurveTo(-26, 2, -14, -2, 0, 4);
    ctx.bezierCurveTo(14, -2, 26, 2, 34, -12); ctx.bezierCurveTo(40, -8, 36, 0, 30, 4); ctx.bezierCurveTo(24, -6, 10, -9, 0, -2);
    ctx.fill(); ctx.restore();
  }
  // accessories on face
  const sg = p.acc?.sunglasses || 0;
  if (sg > 0.02) {
    const dy = (1 - sg) * -70;
    ctx.save(); ctx.translate(hx, -264 + dy); ctx.globalAlpha *= clamp(sg * 3);
    ctx.fillStyle = '#0d0d12';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * 2, -24); ctx.lineTo(sd * 48, -26); ctx.lineTo(sd * 44, 14); ctx.quadraticCurveTo(sd * 24, 28, sd * 5, 12); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(-6, -22, 12, 7); ctx.fillRect(-56, -26, 12, 6); ctx.fillRect(44, -26, 12, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 16, -12); ctx.lineTo(sd * 21, -12); ctx.lineTo(sd * 12, 6); ctx.lineTo(sd * 8, 4); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 30, -14); ctx.lineTo(sd * 36, -14); ctx.lineTo(sd * 30, 6); ctx.lineTo(sd * 26, 6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const gg = p.acc?.goggles || 0;
  if (gg > 0.02) {
    ctx.save(); ctx.translate(hx, -262 + (1 - gg) * -60); ctx.globalAlpha *= clamp(gg * 3);
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#e8f7ff'; ctx.beginPath(); ctx.ellipse(sd * 22, 0, 26, 28, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(70,200,230,0.45)'; ctx.beginPath(); ctx.ellipse(sd * 22, 0, 20, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(sd * 22 - 7, -8, 6, 4, -0.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#e8f7ff'; ctx.fillRect(-6, -4, 12, 6);
    ctx.restore();
  }
  if (p.acc?.hat) hat(ctx, p.acc.hat, p.acc.hatCol, hx * 0.5);
  ctx.restore();
  if (p.acc?.bowtie) {
    ctx.save(); ctx.translate(turn * 8, -218); ctx.fillStyle = p.acc.bowtie;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -10); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, -10); ctx.lineTo(18, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

/** Simple automatic blink: returns eyeOpen multiplier. */
export function blink(t, seed = 0, every = 3.1) {
  const ph = (t + seed * 1.37) % every;
  if (ph < 0.14) return 1 - Math.sin((ph / 0.14) * Math.PI);
  return 1;
}

/** Tiny suitcase prop (drawn around origin = handle). */
export function suitcase(ctx, w = 80, h = 56, col = '#8a4b2a', sticker = true, open = 0) {
  const c = hex(col);
  ctx.save();
  ctx.strokeStyle = '#2a160b'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, 8); ctx.stroke();
  drawMesh(ctx, cached(`case:${w}:${h}`, () => slab(-w / 2, 6, w, h, { bevel: 7, seed: 51, cols: 2, rows: 1, chamfer: 6 })), { c, kd: 0.8, spec: 0.25, shin: 14 });
  ctx.fillStyle = '#d9a35a'; ctx.fillRect(-w / 2 + 12, 6, 6, h); ctx.fillRect(w / 2 - 18, 6, 6, h);
  if (sticker) {
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(-4, 6 + h * 0.5, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5bc0eb'; ctx.fillRect(8, 6 + h * 0.3, 14, 10);
  }
  ctx.restore();
}

export { COL as ROACH_COL };
