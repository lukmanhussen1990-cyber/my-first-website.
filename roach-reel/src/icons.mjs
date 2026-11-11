// Motion-graphic badges: door, ticket, permission slip, stamps, price tag, counter.
import { TAU, clamp, lerp, E, rgb, hex, pop } from './core.mjs';
import { drawMesh, slab, cached, glow } from './poly.mjs';
import { rr } from './fx.mjs';

function badgeBase(ctx, r, col = '#ffffff') {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(8, 14, r, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 9; ctx.stroke();
}

/** door badge: close 0 (open) .. 1 (shut) */
export function doorIcon(ctx, x, y, s, close, shakeK = 0) {
  ctx.save(); ctx.translate(x + Math.sin(shakeK * 80) * 12 * shakeK, y); ctx.scale(s, s);
  badgeBase(ctx, 130, '#ffe9b0');
  ctx.fillStyle = '#4a2a14'; ctx.fillRect(-58, -86, 116, 160);
  const open = 1 - clamp(close);
  ctx.fillStyle = open > 0.02 ? '#ffd27a' : '#1a0f08'; ctx.fillRect(-46, -74, 92, 148);
  if (open > 0.02) glow(ctx, 0, 0, 120, [255, 210, 120], 0.5 * open);
  const w = Math.max(0.1, Math.cos(open * 1.4));
  ctx.save(); ctx.translate(-46, 0); ctx.scale(w, 1);
  drawMesh(ctx, cached('door:panel', () => slab(0, -74, 92, 148, { bevel: 10, seed: 401, cols: 1, rows: 2 })), { c: hex('#b8692e'), kd: 0.8, spec: 0.2 });
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(76, 6, 7, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function ticketIcon(ctx, x, y, s, rot = -0.12) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const w = 300, h = 140;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, -w / 2 + 8, -h / 2 + 12, w, h, 18); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, -18); ctx.arc(w / 2, 0, 18, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(-w / 2, 18); ctx.arc(-w / 2, 0, 18, Math.PI / 2, -Math.PI / 2, true); ctx.closePath();
  ctx.fillStyle = '#ffcf3d'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.stroke();
  ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(70, -h / 2 + 10); ctx.lineTo(70, h / 2 - 10); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '44px "Luckiest Guy"'; ctx.fillText('ADMIT', -40, -18); ctx.fillText('ONE', -40, 28);
  ctx.font = '30px "Luckiest Guy"'; ctx.save(); ctx.translate(110, 0); ctx.rotate(-Math.PI / 2); ctx.fillText('No.001', 0, 0); ctx.restore();
  ctx.restore();
}

export function slipIcon(ctx, x, y, s, rot = 0.1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const w = 290, h = 360;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
  ctx.fillStyle = '#fbfaf3'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = 7; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = '40px "Luckiest Guy"'; ctx.fillText('PERMISSION', 0, -120); ctx.font = '30px "Luckiest Guy"'; ctx.fillText('SLIP', 0, -82);
  ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-110, -36 + i * 36); ctx.lineTo(110, -36 + i * 36); ctx.stroke(); }
  ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(-60, 140); ctx.lineTo(110, 140); ctx.stroke();
  ctx.font = '34px "Luckiest Guy"'; ctx.textAlign = 'left'; ctx.fillText('X', -100, 146);
  ctx.restore();
}

export function stamp(ctx, text, x, y, s, rot, t, t0, col = '#e8203c') {
  if (t < t0) return;
  const k = t - t0;
  const sc = k < 0.08 ? lerp(2.4, 0.92, E.inQuad(k / 0.08)) : k < 0.2 ? lerp(0.92, 1, E.outBack((k - 0.08) / 0.12)) : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * sc, s * sc);
  ctx.globalAlpha *= clamp(k / 0.05);
  ctx.font = '96px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 50;
  ctx.strokeStyle = col; ctx.lineWidth = 12; rr(ctx, -w / 2, -66, w, 128, 18); ctx.stroke();
  ctx.fillStyle = col; ctx.fillText(text, 0, 6);
  ctx.restore();
}

export function redX(ctx, x, y, s, t, t0) {
  if (t < t0) return;
  const k = clamp((t - t0) / 0.14);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#111'; ctx.lineCap = 'round'; ctx.lineWidth = 46;
  const L = 150;
  const seg = (a, b, u) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u)); ctx.stroke(); };
  const u1 = clamp(k * 2), u2 = clamp(k * 2 - 1);
  seg([-L, -L], [L, L], u1); if (u2 > 0) seg([L, -L], [-L, L], u2);
  ctx.strokeStyle = '#ff2a3d'; ctx.lineWidth = 30;
  seg([-L, -L], [L, L], u1); if (u2 > 0) seg([L, -L], [-L, L], u2);
  ctx.restore();
}

/** bread crumb (low-poly nugget) */
export function crumb(ctx, x, y, s, seed = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  drawMesh(ctx, cached('crumb' + seed, () => slab(-22, -16, 44, 32, { bevel: 9, seed: 410 + seed, cols: 2, rows: 1, chamfer: 9, jitter: 0.5 })), { c: hex('#d7a04f'), kd: 0.85, spec: 0.15 });
  ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.beginPath(); ctx.arc(-6, -4, 4, 0, TAU); ctx.fill();
  ctx.restore();
}

/** RENT envelope */
export function envelope(ctx, x, y, s, rot = 0, open = 0, label = 'RENT') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const w = 220, h = 140;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + 6, -h / 2 + 10, w, h);
  ctx.fillStyle = '#f3e7cf'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 5; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 + (open ? -60 * open : 70)); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
  ctx.fillStyle = '#d9203a'; ctx.font = '50px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 26);
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -h / 2 + 64, 12, 0, TAU); ctx.fill();
  ctx.restore();
}
