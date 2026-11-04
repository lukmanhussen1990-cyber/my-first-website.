// shared rig helpers (from the Larry rig)
function blinkAmt(t, seed = 0) {
  const per = 3.1; const k = Math.floor((t + seed) / per);
  const bs = k * per + hash(k * 7.3 + seed) * 1.6 - seed;
  const d = t - bs; if (d < 0 || d > 0.14) return 0;
  return Math.sin(Math.PI * d / 0.14);
}
function ik(sx, sy, tx, ty, L1, L2, outward) {
  let dx = tx - sx, dy = ty - sy; let d = Math.hypot(dx, dy);
  const maxd = L1 + L2 - 0.5; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  if (d < 1) d = 1;
  const a = Math.atan2(dy, dx);
  const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const e1 = [sx + Math.cos(a + A) * L1, sy + Math.sin(a + A) * L1];
  const e2 = [sx + Math.cos(a - A) * L1, sy + Math.sin(a - A) * L1];
  const elbow = (e1[0] * outward > e2[0] * outward) ? e1 : e2;
  return { elbow, hand: [sx + dx, sy + dy] };
}
