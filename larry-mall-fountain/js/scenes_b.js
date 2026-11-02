'use strict';
/* ------------------------------------------------------------------
   Scene C: police station front desk
   Scene D: interrogation room (used by most of the story)
------------------------------------------------------------------- */

function sceneDesk(ctx, t, env) {
  const o = [380, 300];
  const Wr = 560, Dr = 560, Hr = 330;
  ctx.fillStyle = '#151a2a'; ctx.fillRect(-400, -400, W + 800, H + 800);
  const R = { W: Wr, D: Dr, H: Hr, floor: '#5f6690', wallL: '#6d7399', wallR: '#5f668c', cap: '#8f95b8', slabL: '#3a3f5c', slabR: '#2f3450', lowL: '#4a5073', lowR: '#3d4263' };
  drawRoomBack(ctx, o, R);
  // floor tiles
  ctx.save(); path(ctx, [[0, 0], [Wr, 0], [Wr, Dr], [0, Dr]].map(p => iso(o, p[0], p[1]))); ctx.clip();
  for (let k = 0; k <= Wr; k += 56) {
    let a = iso(o, k, 0), b = iso(o, k, Dr); line(ctx, a[0], a[1], b[0], b[1], 'rgba(255,255,255,0.07)', 1.2);
    a = iso(o, 0, k); b = iso(o, Wr, k); line(ctx, a[0], a[1], b[0], b[1], 'rgba(255,255,255,0.07)', 1.2);
  }
  ctx.restore();
  // sign "POLICE · FRONT DESK"
  ctx.save(); isoPlane(ctx, o, 'xz', 150, 0, 282);
  rrect(ctx, 0, 0, 290, 46, 4, '#1e2645');
  text(ctx, 'POLICE · FRONT DESK', 145, 33, "700 28px 'Barlow Condensed'", '#e9edf8', 'center');
  ctx.restore();
  // bulletin board with posters
  ctx.save(); isoPlane(ctx, o, 'xz', 20, 0, 225);
  rrect(ctx, 0, 0, 110, 90, 3, '#9b7650');
  ctx.fillStyle = '#f1ece0'; ctx.fillRect(8, 8, 40, 52); ctx.fillStyle = '#c84a3a'; ctx.fillRect(8, 8, 40, 9);
  text(ctx, 'WANTED', 28, 16, "800 8px 'Barlow Condensed'", '#fff', 'center');
  circle(ctx, 28, 34, 10, '#c79a76'); ctx.fillStyle = '#5a5050'; ctx.fillRect(18, 44, 20, 12);
  ctx.fillStyle = '#f6e7a8'; ctx.fillRect(56, 10, 44, 30); ctx.fillStyle = '#e8eef6'; ctx.fillRect(60, 46, 40, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) ctx.fillRect(64, 52 + i * 7, 30, 2);
  ctx.restore();
  // wall clock (back-left wall)
  ctx.save(); isoPlane(ctx, o, 'yz', 0, 300, 255);
  circle(ctx, 30, 30, 26, '#e9ecf4'); ctx.beginPath(); ctx.arc(30, 30, 26, 0, TAU); ctx.strokeStyle = '#2a2f45'; ctx.lineWidth = 4; ctx.stroke();
  const mins = 37 + t / 60, hr = 4 + mins / 60;
  line(ctx, 30, 30, 30 + Math.sin(hr / 12 * TAU) * 13, 30 - Math.cos(hr / 12 * TAU) * 13, '#1b1f2e', 3);
  line(ctx, 30, 30, 30 + Math.sin(mins / 60 * TAU) * 20, 30 - Math.cos(mins / 60 * TAU) * 20, '#1b1f2e', 2);
  ctx.restore();
  // interview door on back-left wall
  isoPoly(ctx, o, [[0, 150, 0], [0, 250, 0], [0, 250, 205], [0, 150, 205]], '#4b5070');
  isoPoly(ctx, o, [[0, 158, 0], [0, 242, 0], [0, 242, 197], [0, 158, 197]], '#7a6450');
  isoPoly(ctx, o, [[0, 175, 120], [0, 225, 120], [0, 225, 170], [0, 175, 170]], '#3a4560');
  ctx.save(); isoPlane(ctx, o, 'yz', 0, 280, 248); rrect(ctx, 0, 0, 160, 26, 3, '#1e2645'); text(ctx, 'INTERVIEW ROOMS →', 80, 18, "700 15px 'Barlow Condensed'", '#e9edf8', 'center'); ctx.restore();
  // bench
  isoBox(ctx, o, 0, 330, 0, 50, 170, 44, '#5a4a4a', '#4a3d3d', '#3f3434');
  // plant in corner
  isoBox(ctx, o, 470, 20, 0, 40, 40, 40, '#a0644a', '#8a553f', '#764835');
  const pl = iso(o, 490, 40, 60);
  for (let k = 0; k < 7; k++) ellipse(ctx, pl[0] + Math.cos(k * 0.9) * 16, pl[1] - 10 - Math.sin(k * 1.7) * 14 + Math.sin(t * 2 + k) * 1, 12, 7, k % 2 ? '#3f8a52' : '#4fa063', k * 0.8);

  // ---- officer behind the counter ----
  const off = iso(o, 330, 95);
  const typing = t < 14.8;
  const offTalk = (t >= 15.0 && t <= 15.95) || (t >= 16.22 && t <= 17.6) ? env : 0;
  drawPerson(ctx, CH.officer, {
    x: off[0], y: off[1], s: 1.15, face: -0.6, pose: 'sit', arms: 'table', dir: [-C30, S30],
    blink: blinkAt(t, 11), look: typing ? [0.2, 0.9] : [-0.8, 0.4], headDown: typing ? 0.6 : 0, talk: offTalk, brows: 'neutral',
  });
  if (typing) { // little typing hands
    const hh = iso(o, 300, 150, 102);
    circle(ctx, hh[0] - 6 + Math.sin(t * 30) * 2, hh[1] - 2, 4.4, CH.officer.skin);
    circle(ctx, hh[0] + 8 + Math.cos(t * 27) * 2, hh[1] + 2, 4.4, CH.officer.skin);
  }
  // monitor (back) + mug on counter
  isoBox(ctx, o, 225, 105, 100, 14, 60, 48, '#2d3142', '#24273a', '#1d2030');
  isoBox(ctx, o, 470, 165, 100, 14, 14, 16, '#e9e9f0', '#d0d0da', '#bfbfca');
  const steam = iso(o, 477, 172, 120);
  for (let k = 0; k < 2; k++) { const ph = (t * 0.6 + k * 0.5) % 1; ctx.beginPath(); ctx.moveTo(steam[0], steam[1] - ph * 25); ctx.quadraticCurveTo(steam[0] + 6 * Math.sin(t * 3 + k), steam[1] - 10 - ph * 25, steam[0], steam[1] - 18 - ph * 25); ctx.strokeStyle = `rgba(255,255,255,${0.3 * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 2; ctx.stroke(); }

  // ---- counter + glass ----
  isoBox(ctx, o, 60, 150, 0, Wr - 60, 70, 100, '#6e6168', '#4d4249', '#433940');
  isoPoly(ctx, o, [[60, 220, 92], [Wr, 220, 92], [Wr, 220, 100], [60, 220, 100]], '#7e7178');
  // glass partition (plane y = 185)
  const gz0 = 100, gz1 = 220;
  ctx.save();
  isoPoly(ctx, o, [[60, 185, gz0], [Wr, 185, gz0], [Wr, 185, gz1], [60, 185, gz1]], 'rgba(185,215,240,0.16)');
  path(ctx, [[60, 185, gz0], [Wr, 185, gz0], [Wr, 185, gz1], [60, 185, gz1]].map(p => iso(o, p[0], p[1], p[2]))); ctx.clip();
  for (let k = 0; k < 5; k++) { const xx = 80 + k * 110; isoPoly(ctx, o, [[xx, 185, gz0], [xx + 18, 185, gz0], [xx + 58, 185, gz1], [xx + 40, 185, gz1]], 'rgba(255,255,255,0.08)'); }
  ctx.restore();
  for (let xx = 60; xx <= Wr; xx += 125) { const a = iso(o, xx, 185, gz0), b = iso(o, xx, 185, gz1); line(ctx, a[0], a[1], b[0], b[1], 'rgba(220,235,250,0.55)', 2.5); }
  { const a = iso(o, 60, 185, gz1), b = iso(o, Wr, 185, gz1); line(ctx, a[0], a[1], b[0], b[1], 'rgba(220,235,250,0.7)', 3); }
  // speak-through hole
  const hole = iso(o, 300, 185, 150);
  ellipse(ctx, hole[0], hole[1], 13, 9, 'rgba(30,35,50,0.35)', 0.5);

  // ---- YOU walking to the desk ----
  const w0 = [150, 600], w1 = [300, 300];
  const wk = inv(11.8, 14.45, t);
  const pos = [lerp(w0[0], w1[0], E.ioS(wk)), lerp(w0[1], w1[1], E.ioS(wk))];
  const walking = t > 11.8 && t < 14.4;
  // turn toward camera at 16.35
  const turn = inv(16.3, 16.6, t);
  const step2 = inv(17.55, 18.2, t);
  pos[0] += step2 * -10; pos[1] += step2 * 40;
  const p = iso(o, pos[0], pos[1]);
  const back = turn < 0.5;
  const squashX = Math.abs(Math.cos(turn * Math.PI));
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(turn > 0 && turn < 1 ? Math.max(0.15, squashX) : 1, 1); ctx.translate(-p[0], -p[1]);
  const dirW = [0.982, -0.189];
  drawPerson(ctx, CH.you, {
    x: p[0], y: p[1], s: 1.2, face: back ? 0.8 : -0.55, back,
    pose: walking || step2 > 0.02 && step2 < 0.98 ? 'walk' : 'stand',
    phase: walking ? E.ioS(wk) * 335 / 20 : step2 * 9, dir: back ? dirW : [-C30, S30],
    blink: blinkAt(t, 1), eyes: t > 16.7 ? 'wide' : 'normal', look: [-0.3, 0.2], brows: 'worried',
    mouth: t > 16.7 ? 'nervous' : 'flat', sweat: inv(16.6, 17.2, t), sweatT: (t - 16.6) * 0.5,
  });
  ctx.restore();

  drawRoomFront(ctx, o, R);
  // fluorescent light wash
  glow(ctx, 420, 380, 420, '#d8e4ff', 0.08);
  vignette(ctx, 0.55, 0.35);
  return { officerHead: [off[0] - 5, off[1] - 130], youHead: [p[0], p[1] - 160] };
}

/* ===================== interrogation room ===================== */
const IR = { o: [400, 380], W: 760, D: 760, H: 330 };
const IR_YOU = [150, 258], IR_DET = [376, 268], IR_TABLE = [205, 180, 110, 160];

function irState(t, env) {
  const s = {};
  // ---- YOU ----
  const walkT = inv(18.05, 19.6, t);
  s.youWalking = t >= 18.05 && t < 19.6;
  s.youPos = [lerp(12, IR_YOU[0], E.ioS(walkT)), lerp(250, IR_YOU[1], E.ioS(walkT))];
  s.youSitK = E.ioC(inv(19.72, 20.18, t));
  s.youAlpha = clamp((t - 18.0) / 0.15);
  // expressions over time
  let face = 0.8, look = [0.6, 0.1], eyes = 'normal', mouth = 'flat', brows = 'worried', sweat = 0;
  if (t > 20.8 && t < 21.6) { face = -0.2; look = [-1, -0.3]; }
  if (t >= 21.45 && t < 21.9) { eyes = 'wide'; mouth = 'o'; }
  if (t >= 27.42 && t < 28.6) { eyes = 'wide'; mouth = 'o'; }
  if (t >= 28.6) sweat = 0.6;
  if (t >= 38.15) { sweat = 1; mouth = 'nervous'; }
  if (t >= 45.3) { sweat = 1; mouth = 'flat'; look = [0.8, 0]; }
  if (t >= 47.9 && t < 49.4) { mouth = 'nervous'; }
  if (t >= 49.4 && t < 51.4) { eyes = 'wide'; mouth = 'o'; look = [0.5, 0]; }
  if (t >= 51.4) { mouth = 'nervous'; }
  if (t >= 53.6) { face = 0.9; look = [1, -0.1]; eyes = 'normal'; mouth = 'nervous'; }
  if (t >= 58.2 && t < 61.0) { face = 0.4; look = [0.2, 1]; eyes = 'wide'; mouth = 'o'; }
  if (t >= 61.0) { face = 0.9; look = [1, 0]; eyes = 'normal'; mouth = 'nervous'; }
  if (t >= 62.6 && t < 64.6) { look = [Math.sin(t * 7) > 0 ? 1 : -0.6, 0]; }
  if (t >= 64.6 && t < 65.9) { face = 0.2; look = [-0.7, 0.4]; }
  if (t >= 65.9 && t < 67.2) { face = 0.7; look = [0.8, 0.4]; }
  if (t >= 67.2) { face = 0.15; look = [0, 0]; eyes = 'normal'; mouth = 'nervous'; }
  s.you = { face, look, eyes, mouth, brows, sweat };
  s.youFlinch = Math.max(Math.exp(-Math.max(0, t - 21.45) * 9) * (t >= 21.45 ? 1 : 0), Math.exp(-Math.max(0, t - 27.42) * 9) * (t >= 27.42 ? 1 : 0), Math.exp(-Math.max(0, t - 50.08) * 7) * (t >= 50.08 ? 1 : 0));
  // ---- detective ----
  s.detTalk = ((t >= 22.4 && t <= 24.75) || (t >= 26.58 && t <= 27.85) || (t >= 35.97 && t <= 37.7) || (t >= 45.4 && t <= 50.1)) ? env : 0;
  s.detSlap = kf(t, [[26.7, 0], [27.12, 0.5, E.outQ], [27.42, 1, E.inQ], [27.9, 1], [28.4, 0]]);
  s.detLean = kf(t, [[45.35, 0], [45.95, 1, E.outBack], [50.2, 1], [50.9, 0.35], [53.6, 0.35]]);
  s.detPoint = kf(t, [[47.75, 0], [48.05, 1, E.outBack], [49.9, 1], [50.3, 0]]);
  // ---- door ----
  s.door = kf(t, [[18.0, 1.35], [20.8, 1.35], [21.45, 0, E.inQ], [21.6, 0.06, E.outQ], [21.75, 0, E.inQ]]);
  s.lampSwing = t > 21.45 ? Math.sin((t - 21.45) * 4.2) * Math.exp(-(t - 21.45) * 0.9) * 0.09 : 0;
  s.folderBump = t > 27.42 ? Math.abs(Math.sin((t - 27.42) * 14)) * Math.exp(-(t - 27.42) * 7) * 10 : 0;
  return s;
}

function sceneInterrogation(ctx, t, env, opts) {
  opts = opts || {};
  const s = irState(t, env);
  const o = IR.o, { W: Wr, D: Dr, H: Hr } = IR;
  ctx.fillStyle = '#12151f'; ctx.fillRect(-600, -600, W + 1200, H + 1200);
  const R = { W: Wr, D: Dr, H: Hr, floor: '#959aa9', wallL: '#aeb3c0', wallR: '#9ea3b1', cap: '#cdd1db', slabL: '#5d616e', slabR: '#4c505c', lowL: '#7b7f8c', lowR: '#666a77', t: 18 };
  drawRoomBack(ctx, o, R);
  // subtle floor tiles
  ctx.save(); path(ctx, [[0, 0], [Wr, 0], [Wr, Dr], [0, Dr]].map(p => iso(o, p[0], p[1]))); ctx.clip();
  for (let k = 0; k <= Wr; k += 80) {
    let a = iso(o, k, 0), b = iso(o, k, Dr); line(ctx, a[0], a[1], b[0], b[1], 'rgba(0,0,0,0.05)', 1.2);
    a = iso(o, 0, k); b = iso(o, Wr, k); line(ctx, a[0], a[1], b[0], b[1], 'rgba(0,0,0,0.05)', 1.2);
  }
  ctx.restore();

  // ---- one-way mirror (back-right wall) ----
  const mx0 = 150, mx1 = 430, mz0 = 95, mz1 = 245;
  isoPoly(ctx, o, [[mx0 - 10, 0, mz0 - 10], [mx1 + 10, 0, mz0 - 10], [mx1 + 10, 0, mz1 + 10], [mx0 - 10, 0, mz1 + 10]], '#80869a');
  isoPoly(ctx, o, [[mx0, 0, mz0], [mx1, 0, mz0], [mx1, 0, mz1], [mx0, 0, mz1]], '#323a4b');
  ctx.save(); path(ctx, [[mx0, 0, mz0], [mx1, 0, mz0], [mx1, 0, mz1], [mx0, 0, mz1]].map(p => iso(o, p[0], p[1], p[2]))); ctx.clip();
  for (let k = 0; k < 3; k++) { const xx = mx0 + 30 + k * 90; isoPoly(ctx, o, [[xx, 0, mz0], [xx + 26, 0, mz0], [xx + 86, 0, mz1], [xx + 60, 0, mz1]], 'rgba(255,255,255,0.06)'); }
  if (opts.larryGhost) { const gp = iso(o, 320, 0, 160); ctx.globalAlpha *= opts.larryGhost; ctx.save(); ctx.translate(gp[0], gp[1]); ctx.scale(0.42, 0.42); drawBust(ctx, CH.larry, { squish: 1, mouth: 'squish', eyes: 'teary', brows: 'worried', tears: 1, t }, 60); ctx.restore(); }
  ctx.restore();

  // ---- security camera (top corner) ----
  const camP = iso(o, 30, 30, 300);
  const camYaw = opts.camYaw || 0;
  ctx.save(); ctx.translate(camP[0], camP[1]);
  line(ctx, 0, -18, 0, 0, '#4a4f5e', 4);
  ctx.rotate(0.45 + camYaw);
  rrect(ctx, -6, -8, 36, 16, 4, '#e3e6ee'); rrect(ctx, 26, -6, 8, 12, 2, '#2a2e3a');
  const ledOn = Math.floor(t * 1.6) % 2 === 0;
  circle(ctx, 4, -2, 2.4, ledOn ? '#ff3b30' : '#5a1a1a');
  ctx.restore();
  if (ledOn) glow(ctx, camP[0] + 3, camP[1] + 3, 16, '#ff3b30', 0.5);

  // ---- door (back-left wall, hinge at y=200) ----
  const dy0 = 200, dyw = 100, dH = 210;
  isoPoly(ctx, o, [[0, dy0 - 8, 0], [0, dy0 + dyw + 8, 0], [0, dy0 + dyw + 8, dH + 8], [0, dy0 - 8, dH + 8]], '#6f7484');
  isoPoly(ctx, o, [[0, dy0, 0], [0, dy0 + dyw, 0], [0, dy0 + dyw, dH], [0, dy0, dH]], '#1a1d27');
  // hallway light spilling in
  if (s.door > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    isoPoly(ctx, o, [[0, dy0 + 5, 0], [0, dy0 + dyw - 5, 0], [140 * Math.min(1, s.door), dy0 + dyw + 30, 0], [140 * Math.min(1, s.door), dy0 - 10, 0]], `rgba(255,236,190,${0.12 * Math.min(1, s.door)})`);
    ctx.restore();
  }
  const a = s.door; // radians open
  const fe = [dyw * Math.sin(a), dy0 + dyw * Math.cos(a)];
  const doorCol = mix('#8b90a0', '#6d7282', clamp(a / 1.4));
  isoPoly(ctx, o, [[0, dy0, 0], [fe[0], fe[1], 0], [fe[0], fe[1], dH], [0, dy0, dH]], doorCol);
  // door window + handle
  const dp = (u, z) => [lerp(0, fe[0], u), lerp(dy0, fe[1], u), z];
  isoPoly(ctx, o, [dp(0.3, 130), dp(0.7, 130), dp(0.7, 180), dp(0.3, 180)], '#3d4556');
  const hd = iso(o, ...dp(0.85, 100)); circle(ctx, hd[0], hd[1], 3.2, '#c9ced9');

  // ---- light pool on the floor ----
  const tc = [IR_TABLE[0] + IR_TABLE[2] / 2, IR_TABLE[1] + IR_TABLE[3] / 2];
  const pool = iso(o, tc[0] + 10, tc[1] + 10, 0);
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const pg = ctx.createRadialGradient(pool[0], pool[1], 20, pool[0], pool[1], 330);
  pg.addColorStop(0, 'rgba(255,255,255,0.75)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(pool[0], pool[1], 330, 190, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // ---- YOU's chair ----
  const chair = (cx, cy, backSide) => {
    const sw = 46;
    for (const [lx, ly] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) isoBox(ctx, o, cx + lx - 2, cy + ly - 2, 0, 4, 4, 40, '#3a3e4a', '#2f333d', '#282b34');
    if (backSide < 0) isoBox(ctx, o, cx - sw / 2 - 6, cy - sw / 2, 44, 6, sw, 66, '#4a4f5e', '#3b3f4b', '#343844');
    isoBox(ctx, o, cx - sw / 2, cy - sw / 2, 40, sw, sw, 6, '#4f5464', '#3d414e', '#353946');
  };
  chair(IR_YOU[0], IR_YOU[1], -1);
  // ---- YOU ----
  const yp = iso(o, s.youPos[0], s.youPos[1]);
  const ys = s.you;
  const sitting = s.youSitK > 0;
  ctx.save();
  if (s.youFlinch > 0.01) { ctx.translate(yp[0], yp[1]); ctx.scale(1 - s.youFlinch * 0.06, 1 + s.youFlinch * 0.05); ctx.translate(-yp[0], -yp[1]); }
  drawPerson(ctx, CH.you, {
    x: yp[0], y: yp[1], s: 1.2, face: ys.face, alpha: s.youAlpha,
    pose: s.youWalking ? 'walk' : sitting ? 'sit' : 'stand', sitK: s.youSitK, phase: (s.youPos[0] - 12) / 16, dir: [C30, S30],
    arms: sitting && s.youSitK > 0.7 ? (t >= 58.2 && t < 61 ? 'down' : 'table') : 'down',
    blink: ys.eyes === 'wide' ? 0 : blinkAt(t, 2), eyes: ys.eyes, look: ys.look, brows: ys.brows, mouth: ys.mouth,
    sweat: ys.sweat, sweatT: t * 0.5, noShadow: sitting,
  });
  ctx.restore();
  if (t >= 58.2 && t < 61) { const pg2 = iso(o, s.youPos[0] + 18, s.youPos[1] + 6, 46); glow(ctx, pg2[0], pg2[1], 40, '#9cc9ff', 0.6 * (0.6 + 0.4 * Math.sin(t * 30))); }

  // ---- table ----
  const [tx, ty, tw2, td] = IR_TABLE;
  for (const [lx, ly] of [[6, 6], [tw2 - 10, 6], [6, td - 10], [tw2 - 10, td - 10]]) isoBox(ctx, o, tx + lx, ty + ly, 0, 4, 4, 74, '#5e6372', '#4c505d', '#434754');
  isoBox(ctx, o, tx, ty, 74, tw2, td, 6, '#c9ccd6', '#9a9eab', '#8a8e9b');
  // paper + pen near YOU
  isoPoly(ctx, o, [[tx + 12, ty + 50, 80.5], [tx + 52, ty + 50, 80.5], [tx + 52, ty + 104, 80.5], [tx + 12, ty + 104, 80.5]], '#f4f3ef');
  { const a1 = iso(o, tx + 30, ty + 95, 81), b1 = iso(o, tx + 48, ty + 62, 81); line(ctx, a1[0], a1[1], b1[0], b1[1], '#20232c', 3); }
  // folder (manila) near detective
  const fb = s.folderBump;
  isoBox(ctx, o, tx + 58, ty + 40, 80 + fb, 44, 62, 4, '#e2c27c', '#c7a560', '#b8964f');
  // coffee cup
  isoCylinder(ctx, o, tx + 88, ty + 128, 80, 9, 18, '#e6e7ee', '#4a3326');
  const sp = iso(o, tx + 88, ty + 128, 100);
  for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; ctx.beginPath(); ctx.moveTo(sp[0], sp[1] - ph * 30); ctx.bezierCurveTo(sp[0] + 7 * Math.sin(t * 2 + k), sp[1] - 10 - ph * 30, sp[0] - 7 * Math.sin(t * 2 + k), sp[1] - 18 - ph * 30, sp[0], sp[1] - 28 - ph * 30); ctx.strokeStyle = `rgba(255,255,255,${0.28 * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 2.2; ctx.stroke(); }

  // ---- detective ----
  chairSeat(ctx, o, IR_DET[0], IR_DET[1]);
  const dp2 = iso(o, IR_DET[0], IR_DET[1]);
  drawPerson(ctx, CH.detective, {
    x: dp2[0], y: dp2[1], s: 1.22, back: true, face: -0.7, pose: 'sit', sitK: 1, dir: [-C30, -S30],
    arms: s.detPoint > 0.02 ? 'point' : s.detSlap > 0.02 ? 'slap' : 'table', armT: s.detPoint > 0.02 ? s.detPoint : s.detSlap,
    lean: s.detLean * 0.9 + (s.detTalk > 0 ? Math.sin(t * 5) * 0.03 : 0), noShadow: true,
  });
  isoBox(ctx, o, IR_DET[0] + 22, IR_DET[1] - 23, 44, 6, 46, 66, '#4a4f5e', '#3b3f4b', '#343844');

  // ---- hanging lamp ----
  const lampBase = iso(o, tc[0], tc[1], 400);
  const lampP = iso(o, tc[0], tc[1], 262);
  ctx.save(); ctx.translate(lampBase[0], lampBase[1]); ctx.rotate(s.lampSwing); ctx.translate(-lampBase[0], -lampBase[1]);
  line(ctx, lampBase[0], lampBase[1], lampP[0], lampP[1] - 12, '#2a2d36', 2);
  ctx.beginPath(); ctx.moveTo(lampP[0] - 9, lampP[1] - 14); ctx.lineTo(lampP[0] + 9, lampP[1] - 14); ctx.lineTo(lampP[0] + 30, lampP[1] + 6); ctx.lineTo(lampP[0] - 30, lampP[1] + 6); ctx.closePath();
  ctx.fillStyle = '#353a46'; ctx.fill();
  ellipse(ctx, lampP[0], lampP[1] + 6, 30, 7, '#fff6d8');
  glow(ctx, lampP[0], lampP[1] + 10, 120, '#fff1c8', 0.35);
  ctx.restore();

  drawRoomFront(ctx, o, R);
  // room lighting: darken edges
  ctx.save();
  const lg = ctx.createRadialGradient(pool[0], pool[1] - 60, 80, pool[0], pool[1] - 60, 640);
  lg.addColorStop(0, 'rgba(8,10,16,0)'); lg.addColorStop(1, 'rgba(8,10,16,0.62)');
  ctx.fillStyle = lg; ctx.fillRect(-600, -600, W + 1200, H + 1200);
  ctx.restore();

  const youHeadY = sitting ? yp[1] - lerp(160, 148, s.youSitK) : yp[1] - 160;
  return { youHead: [yp[0] + 4, youHeadY], detHead: [dp2[0] - 10 - s.detLean * 14, dp2[1] - 150 + s.detLean * 6], you: yp, table: iso(o, tc[0], tc[1], 80), camera: camP };
}
function chairSeat(ctx, o, cx, cy) {
  const sw = 46;
  for (const [lx, ly] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) isoBox(ctx, o, cx + lx - 2, cy + ly - 2, 0, 4, 4, 40, '#3a3e4a', '#2f333d', '#282b34');
  isoBox(ctx, o, cx - sw / 2, cy - sw / 2, 40, sw, sw, 6, '#4f5464', '#3d414e', '#353946');
}
