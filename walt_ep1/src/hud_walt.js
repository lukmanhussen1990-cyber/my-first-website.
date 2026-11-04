// ---------- Walt HUD: DAYS LEFT + rolling FOLLOWERS counter with goal bar ----------
const FOLLOW = [];   // [{t0, t1, from, to}] rolls; instantaneous when t0==t1
const FPOPS = [];    // pop times
function followersAt(t) {
  let v = 3;
  for (const f of FOLLOW) { if (t >= f.t1) v = f.to; else if (t >= f.t0) { const k = E.in(P(t, f.t0, f.t1 - f.t0)); v = Math.round(lerp(f.from, f.to, k)); } }
  return v;
}
function lastPop(t) { let p = -99; for (const x of FPOPS) if (t >= x) p = x; return p; }
function fmt(n) { return n.toLocaleString('en-US'); }
function drawHUD(ctx, t) {
  ctx.save();
  const Y = 136, Hh = 104;
  rr(ctx, 22, Y, 156, Hh, 16); ctx.fillStyle = 'rgba(14,16,26,0.92)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
  boldText(ctx, 'DAYS LEFT', 100, Y + 22, 21, '#ffffff', { stroke: 0, shadow: false });
  let days = 5, dk = 1;
  if (t >= DAY2_T) { dk = P(t, DAY2_T, 0.35); days = dk < 0.5 ? 5 : 4; }
  const flipS = t >= DAY2_T ? Math.abs(Math.cos(dk * Math.PI)) : 1;
  ctx.save(); ctx.translate(100, Y + 66); ctx.scale(1, Math.max(0.05, flipS));
  boldText(ctx, String(days), 0, 0, 56, days === 4 ? '#ff5a5a' : '#ffd23f', { stroke: 6 }); ctx.restore();
  // FOLLOWERS
  const v = followersAt(t), lp = lastPop(t), since = t - lp;
  const rolling = FOLLOW.some(f => t >= f.t0 && t < f.t1 && f.t1 > f.t0);
  const flash = clamp(1 - since / 0.5);
  const bx = 190, bw = 310;
  rr(ctx, bx, Y, bw, Hh, 16); ctx.fillStyle = 'rgba(14,16,26,0.92)'; ctx.fill();
  ctx.lineWidth = 3 + flash * 4 + (rolling ? 2 : 0); ctx.strokeStyle = flash > 0 || rolling ? `rgba(255,111,181,${0.5 + flash * 0.5})` : 'rgba(255,255,255,0.16)'; ctx.stroke();
  boldText(ctx, 'FOLLOWERS', bx + bw / 2, Y + 22, 21, '#ffffff', { stroke: 0, shadow: false });
  const pop = lp > 0 && since < 0.6 ? 1 + spring(t, lp, 0.6, 2.2, 7) : 1;
  const jit = rolling ? Math.sin(t * 50) * 1.5 : 0;
  ctx.save(); ctx.translate(bx + bw / 2 + 18, Y + 58 + jit); ctx.scale(Math.max(0.4, pop), Math.max(0.4, pop));
  boldText(ctx, fmt(v), 0, 0, 48, v >= 900 ? '#ffd23f' : '#ff8cc6', { stroke: 6 }); ctx.restore();
  ctx.font = '30px "Noto Color Emoji"'; ctx.textAlign = 'center'; ctx.fillText('👥', bx + 46, Y + 70);
  // goal bar to 1,000
  const k = clamp(v / 1000);
  rr(ctx, bx + 18, Y + 86, bw - 36, 9, 4.5); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  if (k > 0) { rr(ctx, bx + 18, Y + 86, Math.max(9, (bw - 36) * k), 9, 4.5); ctx.fillStyle = lgrad(ctx, bx, 0, bx + bw, 0, '#ff6fb5', '#ffd23f'); ctx.fill(); }
  // delta floater
  const d = FDELTA.find(x => t >= x.t && t < x.t + 1.0);
  if (d) { const kk = (t - d.t) / 1.0; ctx.globalAlpha = 1 - kk; boldText(ctx, d.label, bx + bw + 46, Y + 50 - kk * 40, 44, d.col, { stroke: 6 }); ctx.globalAlpha = 1;
    if (d.burst && t - d.t < 0.45) for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, r = 30 + E.out((t - d.t) / 0.45) * 120; sparkle(ctx, bx + bw / 2 + Math.cos(a) * r, Y + 58 + Math.sin(a) * r * 0.7, 0.5 * (1 - (t - d.t) / 0.45), 1, i % 2 ? '#fff7b0' : '#ffb3da'); } }
  // goal tag
  ctx.globalAlpha = 0.9; boldText(ctx, 'GOAL 1,000', bx + bw - 54, Y + 22, 14, '#ffd23f', { stroke: 0, shadow: false }); ctx.globalAlpha = 1;
  ctx.restore();
}
const FDELTA = []; // {t, label, col, burst}
