'use strict';
/* ------------------------------------------------------------------
   Scene A: outside the closed mall (cold open, police lights)
   Scene B: your bedroom at 2:04 AM
------------------------------------------------------------------- */

function sceneMall(ctx, t) {
  const o = [360, 320];
  // background
  ctx.fillStyle = '#121624'; ctx.fillRect(-400, -400, W + 800, H + 800);

  // ---- plaza + street ground ----
  isoPoly(ctx, o, [[-900, 0], [1400, 0], [1400, 530], [-900, 530]], '#2b3147');
  // plaza tiles
  ctx.save(); path(ctx, [[-900, 0], [1400, 0], [1400, 530], [-900, 530]].map(p => iso(o, p[0], p[1]))); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1.2;
  for (let x = -900; x <= 1400; x += 70) { const a = iso(o, x, 0), b = iso(o, x, 530); line(ctx, a[0], a[1], b[0], b[1], 'rgba(255,255,255,0.045)', 1.2); }
  for (let y = 0; y <= 530; y += 70) { const a = iso(o, -900, y), b = iso(o, 1400, y); line(ctx, a[0], a[1], b[0], b[1], 'rgba(255,255,255,0.045)', 1.2); }
  ctx.restore();
  // curb + street
  isoPoly(ctx, o, [[-900, 530, 0], [1400, 530, 0], [1400, 540, 0], [-900, 540, 0]], '#4a5068');
  isoPoly(ctx, o, [[-900, 540, 0], [1400, 540, 0], [1400, 540, -8], [-900, 540, -8]], '#3a3f55');
  isoPoly(ctx, o, [[-900, 540, -8], [1400, 540, -8], [1400, 980, -8], [-900, 980, -8]], '#1b1f2e');
  for (let x = -900; x < 1400; x += 120) isoPoly(ctx, o, [[x, 742, -8], [x + 60, 742, -8], [x + 60, 752, -8], [x, 752, -8]], 'rgba(230,220,170,0.35)');

  // ---- mall building facade (plane y = 0) ----
  const FH = 300;
  isoPoly(ctx, o, [[-900, 0, 0], [900, 0, 0], [900, 0, FH], [-900, 0, FH]], '#363d58');
  // base trim
  isoPoly(ctx, o, [[-900, 0, 0], [900, 0, 0], [900, 0, 14], [-900, 0, 14]], '#2a2f45');
  // store windows
  const win = (x0, x1, z0, z1, lit) => {
    isoPoly(ctx, o, [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], '#1a2033');
    isoPoly(ctx, o, [[x0 + 6, 0, z0 + 6], [x1 - 6, 0, z0 + 6], [x1 - 6, 0, z1 - 6], [x0 + 6, 0, z1 - 6]], lit ? '#2b3a55' : '#222a40');
    // reflections
    ctx.save(); path(ctx, [[x0 + 6, 0, z0 + 6], [x1 - 6, 0, z0 + 6], [x1 - 6, 0, z1 - 6], [x0 + 6, 0, z1 - 6]].map(p => iso(o, p[0], p[1], p[2]))); ctx.clip();
    for (let k = 0; k < 3; k++) { const xx = x0 + 20 + k * 38; isoPoly(ctx, o, [[xx, 0, z0], [xx + 14, 0, z0], [xx + 64, 0, z1], [xx + 50, 0, z1]], 'rgba(160,190,255,0.06)'); }
    ctx.restore();
  };
  win(-520, -330, 30, 170); win(-300, -110, 30, 170); win(-80, 90, 30, 170);
  // entrance (glass doors)
  isoPoly(ctx, o, [[110, 0, 0], [290, 0, 0], [290, 0, 175], [110, 0, 175]], '#161b2b');
  for (const dx of [118, 202]) {
    isoPoly(ctx, o, [[dx, 0, 4], [dx + 80, 0, 4], [dx + 80, 0, 165], [dx, 0, 165]], '#24304a');
    isoPoly(ctx, o, [[dx + 8, 0, 4], [dx + 20, 0, 4], [dx + 60, 0, 165], [dx + 48, 0, 165]], 'rgba(160,190,255,0.07)');
  }
  // door handles + chain + CLOSED sign
  for (const dx of [190, 210]) isoPoly(ctx, o, [[dx, 0, 70], [dx + 3, 0, 70], [dx + 3, 0, 110], [dx, 0, 110]], '#9aa3b5');
  ctx.save(); isoPlane(ctx, o, 'xz', 165, 0, 150);
  rrect(ctx, 0, 0, 72, 30, 3, '#c9302c');
  text(ctx, 'CLOSED', 36, 21, "800 16px 'Barlow Condensed'", '#fff', 'center');
  ctx.restore();
  win(310, 500, 30, 170); win(520, 720, 30, 170);
  // sign band
  isoPoly(ctx, o, [[-900, 0, 205], [900, 0, 205], [900, 0, 268], [-900, 0, 268]], '#2c3249');
  // glowing sign letters
  ctx.save(); isoPlane(ctx, o, 'xz', 60, 0, 258);
  const flick = 0.85 + 0.15 * Math.sin(t * 23) * (hash(Math.floor(t * 8)) > 0.8 ? 1 : 0);
  ctx.shadowColor = 'rgba(255,120,190,0.9)'; ctx.shadowBlur = 16;
  text(ctx, 'CITY MALL', 0, 44, "800 50px 'Montserrat'", rgba('#ffd1ea', flick), 'left');
  ctx.shadowBlur = 0;
  ctx.restore();
  glow(ctx, ...iso(o, 200, 0, 235), 210, '#ff6fb5', 0.13 * flick);
  // roof line
  isoPoly(ctx, o, [[-900, 0, FH], [900, 0, FH], [900, -20, FH], [-900, -20, FH]], '#454d6b');

  // ---- fountain ----
  const F = [195, 265];
  // police tape posts
  const PR = 200 / Math.SQRT2;
  // left, back, right, front
  const posts = [[F[0] - PR, F[1] + PR], [F[0] - PR, F[1] - PR], [F[0] + PR, F[1] - PR], [F[0] + PR, F[1] + PR]];
  const tapeZ = 46;
  const drawTape = (a, b) => {
    const p1 = iso(o, a[0], a[1], tapeZ), p2 = iso(o, b[0], b[1], tapeZ);
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    ctx.save(); ctx.translate(p1[0], p1[1]); ctx.rotate(ang);
    const sag = 8;
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.quadraticCurveTo(L / 2, sag - 3.5, L, -3.5); ctx.lineTo(L, 3.5); ctx.quadraticCurveTo(L / 2, sag + 3.5, 0, 3.5); ctx.closePath();
    ctx.fillStyle = '#f2c81e'; ctx.fill();
    ctx.font = "800 6px 'Barlow Condensed'"; ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center';
    for (let k = 20; k < L - 10; k += 46) { const yy = sag * 4 * (k / L) * (1 - k / L); ctx.fillText('POLICE LINE', k, yy + 2.2); }
    ctx.restore();
  };
  const drawPost = (p) => { isoBox(ctx, o, p[0] - 3, p[1] - 3, 0, 6, 6, 52, '#f2c81e', '#c9a414', '#a8890f'); };
  drawPost(posts[1]); drawPost(posts[0]); drawPost(posts[2]);
  drawTape(posts[0], posts[1]); drawTape(posts[1], posts[2]);

  // basin
  const r = 118;
  isoCylinder(ctx, o, F[0], F[1], 0, r + 8, 36, '#5c637d', '#7e86a1');
  isoCircle(ctx, o, F[0], F[1], 36, r - 6, '#1d4f78');
  // water surface + light
  ctx.save();
  const wc = iso(o, F[0], F[1], 36);
  ctx.beginPath(); ctx.ellipse(wc[0], wc[1], (r - 6) * C30 * Math.SQRT2, (r - 6) * S30 * Math.SQRT2, 0, 0, TAU); ctx.clip();
  const wg = ctx.createRadialGradient(wc[0], wc[1], 10, wc[0], wc[1], 150);
  wg.addColorStop(0, '#3a8fc4'); wg.addColorStop(1, '#16405f');
  ctx.fillStyle = wg; ctx.fillRect(wc[0] - 200, wc[1] - 120, 400, 240);
  // ripples
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.5 + k / 4) % 1;
    ctx.beginPath(); ctx.ellipse(wc[0], wc[1], 20 + ph * 130, (20 + ph * 130) * 0.5, 0, 0, TAU);
    ctx.strokeStyle = `rgba(190,235,255,${0.35 * (1 - ph)})`; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
  // inner rim highlight
  isoCircle(ctx, o, F[0], F[1], 36, r - 6, null, 'rgba(170,180,210,0.6)', 3);
  // center column + bowl
  isoCylinder(ctx, o, F[0], F[1], 30, 16, 64, '#6c7490', '#8890ab');
  isoCylinder(ctx, o, F[0], F[1], 92, 46, 10, '#6c7490', '#2a6c9c');
  isoCylinder(ctx, o, F[0], F[1], 100, 8, 26, '#7c84a0', '#9aa2bd');
  // water arcs
  const top = iso(o, F[0], F[1], 128);
  for (let k = 0; k < 6; k++) {
    const ang = k / 6 * TAU;
    ctx.beginPath();
    for (let s = 0; s <= 20; s++) {
      const u = s / 20;
      const dx = Math.cos(ang) * 40 * u, dy = Math.sin(ang) * 20 * u;
      const yy = top[1] - 18 * Math.sin(u * Math.PI * 0.9) + u * u * 34;
      if (s === 0) ctx.moveTo(top[0] + dx, yy + dy); else ctx.lineTo(top[0] + dx, yy + dy);
    }
    ctx.strokeStyle = 'rgba(170,225,255,0.55)'; ctx.lineWidth = 2.2; ctx.stroke();
  }
  for (let k = 0; k < 14; k++) {
    const ph = (t * 1.6 + k * 0.137) % 1, ang = k * 2.4;
    const xx = top[0] + Math.cos(ang) * 40 * ph, yy = top[1] - 18 * Math.sin(ph * Math.PI * 0.9) + ph * ph * 34 + Math.sin(ang) * 20 * ph;
    circle(ctx, xx, yy, 1.6, 'rgba(210,240,255,0.8)');
  }
  glow(ctx, wc[0], wc[1], 170, '#3aa0ff', 0.12);
  // front tape (in front of the basin)
  drawPost(posts[3]);
  drawTape(posts[2], posts[3]); drawTape(posts[3], posts[0]);

  // smell cloud (the evidence...)
  stinkCloud(ctx, wc[0] + 12, wc[1] - 40, 1.25, t, 0.95, 1);

  // ---- streetlamp ----
  const L = [610, 160];
  isoBox(ctx, o, L[0] - 5, L[1] - 5, 0, 10, 10, 230, '#4b526c', '#3b4159', '#2e3348');
  isoBox(ctx, o, L[0] - 22, L[1] - 12, 222, 34, 24, 12, '#5b6382', '#4b526c', '#3b4159');
  const lamp = iso(o, L[0] - 5, L[1], 220);
  glow(ctx, lamp[0], lamp[1], 60, '#ffe2a8', 0.55);
  const lg = iso(o, L[0] - 10, L[1] + 10, 0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const cone = ctx.createRadialGradient(lg[0], lg[1], 5, lg[0], lg[1], 170);
  cone.addColorStop(0, 'rgba(255,214,150,0.22)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = cone; ctx.beginPath(); ctx.ellipse(lg[0], lg[1], 170, 85, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // ---- characters: cop + Larry (handcuffed) ----
  const sway = Math.sin(t * 1.3) * 0.6;
  const larry = iso(o, 500, 420), cop = iso(o, 520, 340);
  drawPerson(ctx, CH.cop, { x: cop[0], y: cop[1], s: 1.12, face: -0.75, arms: 'down', blink: blinkAt(t, 5), look: [-0.6, 0.3], brows: 'angry' });
  // cop's hand on Larry's shoulder
  const hb = iso(o, 500, 420);
  line(ctx, cop[0] - 14, cop[1] - 108, hb[0] + 16, hb[1] - 112, CH.cop.topC2, 9.5);
  circle(ctx, hb[0] + 16, hb[1] - 111, 5.4, CH.cop.skin);
  const peek = kf(t, [[0, 0], [2.3, 0], [2.6, 1, E.outC], [3.4, 1], [3.7, 0]]);
  drawPerson(ctx, CH.larry, {
    x: larry[0] + sway, y: larry[1], s: 1.14, face: -0.5, arms: 'behind', headDown: 1 - peek * 0.8,
    eyes: peek > 0.5 ? 'shifty' : 'normal', look: peek > 0.5 ? [-1, -0.2] : [0, 1], blink: blinkAt(t, 3), brows: 'worried',
    mouth: 'frown', sweat: 1, sweatT: t * 0.6,
  });
  // handcuff glint behind back
  const cg = [larry[0] + sway + 16, larry[1] - 78];
  circle(ctx, cg[0], cg[1], 3.2, '#cfd6e6'); circle(ctx, cg[0] - 1, cg[1] - 1, 1.2, '#ffffff');

  // ---- police car (on the street, front) ----
  drawPoliceCar(ctx, o, 170, 566, t);

  // ---- police light wash ----
  const phase = (t * 2.4) % 1;
  const redOn = phase < 0.5 ? (Math.sin(phase * 2 * Math.PI * 2) > -0.2 ? 1 : 0.4) : 0;
  const blueOn = phase >= 0.5 ? (Math.sin((phase - 0.5) * 2 * Math.PI * 2) > -0.2 ? 1 : 0.4) : 0;
  const bar = iso(o, 295, 619, 112);
  glow(ctx, bar[0] - 20, bar[1], 560, '#ff2a3a', 0.2 * redOn, 'screen');
  glow(ctx, bar[0] + 20, bar[1], 560, '#2a5bff', 0.22 * blueOn, 'screen');
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = redOn ? 'rgba(255,40,60,0.2)' : 'rgba(40,90,255,0.2)';
  ctx.fillRect(-400, -400, W + 800, H + 800);
  ctx.restore();
  return { larryHead: [larry[0], larry[1] - 150] };
}

function drawPoliceCar(ctx, o, x, y, t) {
  const Lx = 250, Dy = 105;
  // shadow
  const c = iso(o, x + Lx / 2, y + Dy / 2, -8);
  shadowBlob(ctx, c[0], c[1] + 4, 190, 70, 0.45);
  // wheels (back side, mostly hidden)
  // body lower
  isoBox(ctx, o, x, y, 4, Lx, Dy, 44, '#e9ecf2', '#d9dde6', '#c4c9d4');
  // black panels (front/back)
  isoBox(ctx, o, x, y, 4, 54, Dy, 44, '#1d2130', '#161924', '#151823');
  isoBox(ctx, o, x + Lx - 54, y, 4, 54, Dy, 44, '#1d2130', '#161924', '#11141d');
  // side text POLICE on the +y face
  ctx.save(); isoPlane(ctx, o, 'xz', x + 74, y + Dy, 36);
  text(ctx, 'POLICE', 0, 22, "800 25px 'Barlow Condensed'", '#1d2a5e', 'left');
  ctx.fillStyle = '#2b4fd9'; ctx.fillRect(0, 26, 116, 4);
  ctx.restore();
  // cabin
  isoBox(ctx, o, x + 64, y + 8, 48, 120, Dy - 16, 40, '#e9ecf2', '#d4d8e2', '#c4c9d4');
  // windows on +y face and +x face
  isoPoly(ctx, o, [[x + 70, y + Dy - 8, 52], [x + 118, y + Dy - 8, 52], [x + 118, y + Dy - 8, 82], [x + 76, y + Dy - 8, 82]], '#202838');
  isoPoly(ctx, o, [[x + 124, y + Dy - 8, 52], [x + 178, y + Dy - 8, 52], [x + 172, y + Dy - 8, 82], [x + 124, y + Dy - 8, 82]], '#202838');
  isoPoly(ctx, o, [[x + 184, y + 12, 52], [x + 184, y + Dy - 12, 52], [x + 184, y + Dy - 12, 84], [x + 184, y + 12, 84]], '#263042');
  // light bar
  const phase = (t * 2.4) % 1;
  const redOn = phase < 0.5, flash = (Math.sin(phase * TAU * 4) > -0.3);
  isoBox(ctx, o, x + 100, y + 22, 88, 50, Dy - 44, 9, '#d9dde6', '#b9bfcc', '#a9afbc');
  isoBox(ctx, o, x + 100, y + 22, 97, 50, (Dy - 44) / 2, 9, redOn && flash ? '#ff4a55' : '#7a1f26', redOn && flash ? '#ff2a3a' : '#5d151b', '#5d151b');
  isoBox(ctx, o, x + 100, y + 22 + (Dy - 44) / 2, 97, 50, (Dy - 44) / 2, 9, !redOn && flash ? '#5a86ff' : '#1d2d6e', !redOn && flash ? '#2a5bff' : '#16225a', !redOn && flash ? '#2a5bff' : '#16225a');
  const lb = iso(o, x + 125, y + Dy / 2, 102);
  if (flash) glow(ctx, lb[0], lb[1], 90, redOn ? '#ff3344' : '#3a6bff', 0.9);
  // wheels on the +y side
  for (const wx of [x + 40, x + Lx - 40]) {
    const w = iso(o, wx, y + Dy, 14);
    ellipse(ctx, w[0], w[1], 17, 19, '#0d0f15', -0.52);
    ellipse(ctx, w[0], w[1], 8, 9, '#4a5064', -0.52);
  }
  // headlights (front at +x)
  const hl = iso(o, x + Lx, y + 20, 30), hl2 = iso(o, x + Lx, y + Dy - 20, 30);
  glow(ctx, hl[0], hl[1], 26, '#fff4cc', 0.8); glow(ctx, hl2[0], hl2[1], 26, '#fff4cc', 0.8);
}

/* ===================== bedroom ===================== */
function sceneBedroom(ctx, t, st) {
  st = st || {};
  const o = [370, 330];
  const Wd = 470, Dd = 470, Hh = 300;
  ctx.fillStyle = '#0f121c'; ctx.fillRect(-400, -400, W + 800, H + 800);
  const R = { W: Wd, D: Dd, H: Hh, floor: '#3a3450', wallL: '#433f61', wallR: '#3a3757', cap: '#5c5880', slabL: '#262338', slabR: '#1f1d2f', lowL: '#2f2b45', lowR: '#28253c' };
  drawRoomBack(ctx, o, R);
  // floor planks
  ctx.save(); path(ctx, [[0, 0], [Wd, 0], [Wd, Dd], [0, Dd]].map(p => iso(o, p[0], p[1]))); ctx.clip();
  for (let y = 0; y < Dd; y += 34) { const a = iso(o, 0, y), b = iso(o, Wd, y); line(ctx, a[0], a[1], b[0], b[1], 'rgba(0,0,0,0.12)', 1.2); }
  ctx.restore();
  // window on back-right wall with moon light
  const wx0 = 250, wx1 = 400, wz0 = 120, wz1 = 250;
  isoPoly(ctx, o, [[wx0 - 8, 0, wz0 - 8], [wx1 + 8, 0, wz0 - 8], [wx1 + 8, 0, wz1 + 8], [wx0 - 8, 0, wz1 + 8]], '#5c5880');
  isoPoly(ctx, o, [[wx0, 0, wz0], [wx1, 0, wz0], [wx1, 0, wz1], [wx0, 0, wz1]], '#1c2a4a');
  ctx.save(); path(ctx, [[wx0, 0, wz0], [wx1, 0, wz0], [wx1, 0, wz1], [wx0, 0, wz1]].map(p => iso(o, p[0], p[1], p[2]))); ctx.clip();
  const mp = iso(o, 350, 0, 215); circle(ctx, mp[0], mp[1], 18, '#e9f0ff'); glow(ctx, mp[0], mp[1], 70, '#9fbfff', 0.35);
  for (let i = 0; i < 6; i++) { const sp = iso(o, wx0 + 15 + i * 23, 0, wz0 + 20 + (i * 37) % 90); circle(ctx, sp[0], sp[1], 1.2, 'rgba(255,255,255,0.8)'); }
  ctx.restore();
  isoPoly(ctx, o, [[(wx0 + wx1) / 2 - 3, 0, wz0], [(wx0 + wx1) / 2 + 3, 0, wz0], [(wx0 + wx1) / 2 + 3, 0, wz1], [(wx0 + wx1) / 2 - 3, 0, wz1]], '#5c5880');
  // curtains
  isoPoly(ctx, o, [[wx0 - 30, 0, 90], [wx0 + 6, 0, 90], [wx0 + 2, 0, 262], [wx0 - 30, 0, 262]], '#5a3c6e');
  isoPoly(ctx, o, [[wx1 - 6, 0, 90], [wx1 + 30, 0, 90], [wx1 + 30, 0, 262], [wx1 - 2, 0, 262]], '#5a3c6e');
  // moonlight patch on floor
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  isoPoly(ctx, o, [[wx0 + 10, 40], [wx1 + 10, 40], [wx1 + 90, 250], [wx0 + 90, 250]], 'rgba(120,150,230,0.10)');
  ctx.restore();
  // poster on back-left wall
  ctx.save(); isoPlane(ctx, o, 'yz', 0, 330, 250);
  rrect(ctx, 0, 0, 100, 130, 3, '#2a2140');
  ctx.fillStyle = '#e94f64'; ctx.beginPath(); ctx.arc(50, 52, 30, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(50, 52, 14, 0, TAU); ctx.fill();
  text(ctx, 'NIGHT SHIFT', 50, 108, "800 14px 'Barlow Condensed'", '#f5e9ff', 'center');
  ctx.restore();
  // shelf + books on back-left wall
  ctx.save(); isoPlane(ctx, o, 'yz', 0, 200, 190);
  ctx.fillStyle = '#5c4a3a'; ctx.fillRect(0, 34, 110, 6);
  ['#d94f4f', '#4f8fd9', '#e6c34a', '#59b36b', '#b05fd1'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(8 + i * 18, 6 + (i % 2) * 4, 13, 28 - (i % 2) * 4); });
  ctx.restore();

  // rug
  isoPoly(ctx, o, [[150, 250], [400, 250], [400, 430], [150, 430]], '#4c3a66');
  isoPoly(ctx, o, [[165, 265], [385, 265], [385, 415], [165, 415]], '#58457a');

  // ---- bed against the back-right wall (headboard at x = 0 side) ----
  const bx = 20, by = 30, bw = 260, bd = 170;
  isoBox(ctx, o, bx - 14, by, 0, 14, bd, 120, '#5a4636', '#4a392c', '#3e3025'); // headboard
  isoBox(ctx, o, bx, by, 0, bw, bd, 34, '#5a4636', '#4a392c', '#3e3025'); // frame
  isoBox(ctx, o, bx, by, 34, bw, bd, 22, '#d9dbe8', '#c3c5d6', '#b0b2c4'); // mattress
  // pillow
  isoBox(ctx, o, bx + 8, by + 18, 56, 70, bd - 36, 14, '#eef0f8', '#d6d8e6', '#c8cad9');
  // sleeping YOU: head on pillow
  const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
  const roll = st.roll || 0; // 0 facing up, 1 rolled over
  const hp = iso(o, bx + 46, by + bd / 2, 84);
  // blanket with body bump
  const bl0 = iso(o, bx + 80, by - 2, 56), bl1 = iso(o, bx + bw + 2, by - 2, 56), bl2 = iso(o, bx + bw + 2, by + bd + 2, 56), bl3 = iso(o, bx + 80, by + bd + 2, 56);
  // body bump under blanket
  const bump0 = iso(o, bx + 95, by + bd / 2, 70), bump1 = iso(o, bx + bw - 30, by + bd / 2, 66);
  fillPoly(ctx, [bl0, bl1, bl2, bl3].map(p => [p[0], p[1] - 4]), '#3f6fb3');
  ctx.save();
  ctx.translate((bump0[0] + bump1[0]) / 2, (bump0[1] + bump1[1]) / 2);
  ctx.rotate(Math.atan2(bump1[1] - bump0[1], bump1[0] - bump0[0]));
  const bl = Math.hypot(bump1[0] - bump0[0], bump1[1] - bump0[1]);
  ellipse(ctx, 0, -10, bl / 2 + 10, 26 + breath * 3 + roll * 3, '#4a7cc2');
  ellipse(ctx, -bl * 0.18, -16 - breath * 2, bl * 0.3, 14, 'rgba(255,255,255,0.08)');
  ctx.restore();
  // blanket front fold (+y face)
  fillPoly(ctx, [bl3, bl2, iso(o, bx + bw + 2, by + bd + 2, 30), iso(o, bx + 80, by + bd + 2, 30)], '#3561a0');
  fillPoly(ctx, [bl1, bl2, iso(o, bx + bw + 2, by + bd + 2, 30), iso(o, bx + bw + 2, by - 2, 30)], '#2d548c');
  // head
  ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate(-0.95 + roll * 0.25);
  drawPerson(ctx, CH.you, { x: 0, y: 128 * 0.95, s: 0.95, face: 0.2 + roll * 0.5, eyes: 'closed', mouth: st.snore ? 'o' : 'flat', noShadow: true, onlyHead: true });
  ctx.restore();
  // drool bubble (sleep gag)
  if (st.bubble > 0) {
    const bpos = [hp[0] + 28, hp[1] + 4];
    const br = 3 + st.bubble * 12;
    circle(ctx, bpos[0] + br * 0.6, bpos[1], br, 'rgba(200,230,255,0.45)');
    ctx.beginPath(); ctx.arc(bpos[0] + br * 0.6, bpos[1], br, 0, TAU); ctx.strokeStyle = 'rgba(230,245,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    circle(ctx, bpos[0] + br * 0.35, bpos[1] - br * 0.35, br * 0.22, 'rgba(255,255,255,0.8)');
  }

  // ---- nightstand + phone + alarm clock ----
  const nx = 20, ny = 220;
  isoBox(ctx, o, nx, ny, 0, 64, 64, 62, '#6a5442', '#5a4636', '#4a392c');
  isoPoly(ctx, o, [[nx + 4, ny + 64, 30], [nx + 60, ny + 64, 30], [nx + 60, ny + 64, 32], [nx + 4, ny + 64, 32]], '#3e3025');
  // alarm clock
  isoBox(ctx, o, nx + 8, ny + 6, 62, 22, 34, 18, '#2a2a33', '#22222a', '#1b1b22');
  ctx.save(); isoPlane(ctx, o, 'yz', nx + 30, ny + 38, 78);
  text(ctx, st.clock || '2:04', 4, 12, "700 13px 'Barlow Condensed'", '#ff4a3d', 'left');
  ctx.restore();
  glow(ctx, ...iso(o, nx + 30, ny + 24, 72), 26, '#ff3b30', 0.25);
  // phone lying flat
  const buzz = st.buzz || 0;
  const jx = buzz ? Math.sin(t * 90) * 2.2 * buzz : 0;
  const lit = st.lit || 0;
  ctx.save(); ctx.translate(jx, 0);
  isoBox(ctx, o, nx + 36, ny + 16, 62, 20, 36, 3, lit ? mix('#26304a', '#bfe0ff', lit) : '#1c2232', '#11141d', '#0d1018');
  if (lit) {
    const pp = iso(o, nx + 46, ny + 34, 66);
    glow(ctx, pp[0], pp[1], 90 * lit, '#8fc6ff', 0.55 * lit);
  }
  ctx.restore();
  if (buzz > 0.05) {
    const pp = iso(o, nx + 46, ny + 34, 66);
    ctx.strokeStyle = `rgba(220,235,255,${0.8 * buzz})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
      ctx.beginPath(); ctx.arc(pp[0], pp[1], 20 + k * 8, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); ctx.stroke();
    }
  }

  // sneakers on the floor
  isoBox(ctx, o, 330, 380, 0, 30, 14, 10, '#eeeef3', '#d6d6de', '#c6c6cf');
  isoBox(ctx, o, 340, 400, 0, 30, 14, 10, '#eeeef3', '#d6d6de', '#c6c6cf');

  // dresser on the right side wall
  isoBox(ctx, o, 410, 20, 0, 60, 120, 110, '#5d4a3b', '#4d3c2f', '#3f3126');
  for (const zz of [30, 70]) isoPoly(ctx, o, [[410, 140, zz], [470, 140, zz], [470, 140, zz + 26], [410, 140, zz + 26]], '#57453a');
  drawRoomFront(ctx, o, R);

  // Zzz
  if (st.zzz > 0) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.45 + k / 3) % 1;
      const zx = hp[0] + 30 + ph * 50 + Math.sin(ph * 6 + k) * 6, zy = hp[1] - 30 - ph * 90;
      ctx.save(); ctx.globalAlpha *= st.zzz * Math.sin(ph * Math.PI);
      outlinedText(ctx, 'Z', zx, zy, `800 ${18 + ph * 16}px 'Montserrat'`, '#dfe8ff', '#1a1f33', 4);
      ctx.restore();
    }
  }
  // night ambience
  vignette(ctx, 0.55, 0.3);
  return { phone: iso(o, nx + 46, ny + 34, 66), head: hp };
}

/* shared room shell */
function drawRoomBack(ctx, o, R) {
  const { W: Wr, D: Dr, H: Hr } = R; const t = R.t || 16, slab = R.slab || 30;
  isoPoly(ctx, o, [[0, Dr, 0], [Wr, Dr, 0], [Wr, Dr, -slab], [0, Dr, -slab]], R.slabL);
  isoPoly(ctx, o, [[Wr, 0, 0], [Wr, Dr, 0], [Wr, Dr, -slab], [Wr, 0, -slab]], R.slabR);
  isoPoly(ctx, o, [[0, 0, 0], [Wr, 0, 0], [Wr, Dr, 0], [0, Dr, 0]], R.floor);
  isoPoly(ctx, o, [[0, 0, 0], [0, Dr, 0], [0, Dr, Hr], [0, 0, Hr]], R.wallL);
  isoPoly(ctx, o, [[0, 0, 0], [Wr, 0, 0], [Wr, 0, Hr], [0, 0, Hr]], R.wallR);
  // skirting
  isoPoly(ctx, o, [[0, 0, 0], [0, Dr, 0], [0, Dr, 10], [0, 0, 10]], shade(R.wallL, 0.18));
  isoPoly(ctx, o, [[0, 0, 0], [Wr, 0, 0], [Wr, 0, 10], [0, 0, 10]], shade(R.wallR, 0.18));
  // caps
  isoPoly(ctx, o, [[-t, -t, Hr], [0, -t, Hr], [0, Dr, Hr], [-t, Dr, Hr]], R.cap);
  isoPoly(ctx, o, [[-t, -t, Hr], [Wr, -t, Hr], [Wr, 0, Hr], [-t, 0, Hr]], R.cap);
  isoPoly(ctx, o, [[-t, Dr, 0], [0, Dr, 0], [0, Dr, Hr], [-t, Dr, Hr]], shade(R.cap, 0.2));
  isoPoly(ctx, o, [[Wr, -t, 0], [Wr, 0, 0], [Wr, 0, Hr], [Wr, -t, Hr]], shade(R.cap, 0.3));
  // corner shading line
  const c0 = iso(o, 0, 0, 0), c1 = iso(o, 0, 0, Hr);
  line(ctx, c0[0], c0[1], c1[0], c1[1], 'rgba(0,0,0,0.18)', 2);
}
function drawRoomFront(ctx, o, R) {
  const { W: Wr, D: Dr } = R, h = R.low || 22, t = R.t || 16;
  isoBox(ctx, o, -t, Dr, 0, Wr + t, t, h, R.cap, R.lowL, null);
  isoBox(ctx, o, Wr, -t, 0, t, Dr + t * 2, h, R.cap, R.lowL, R.lowR);
}
