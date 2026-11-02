// ---------- LARRY: puppet character ----------
const SKIN = '#f7c59f', SKIN_D = '#d99a6c', SHIRT = '#f5a623', SHIRT_D = '#c97c10', PANTS = '#4256a4', PANTS_D = '#2f3f80', HAIR = '#5a3a22';

const POSES = {
  idle:    { L: [-118, -168], R: [118, -168] },
  hips:    { L: [-104, -222], R: [104, -222] },
  clutch:  { L: [-30, -205], R: [30, -200] },
  pray:    { L: [-8, -322], R: [8, -322] },
  raise:   { L: [-150, -520], R: [150, -520] },
  thumbs:  { L: [-118, -168], R: [158, -330] },
  thumbs2: { L: [-158, -330], R: [158, -330] },
  eat:     { L: [-118, -168], R: [40, -392] },
  shrug:   { L: [-170, -300], R: [170, -300] },
  point:   { L: [-118, -168], R: [205, -330] },
  wave:    { L: [-118, -168], R: [150, -470] },
  nose:    { L: [-118, -168], R: [14, -428] },
  phone:   { L: [-40, -300], R: [40, -300] },
  grab:    { L: [-118, -168], R: [205, -250] },
  cheer:   { L: [-170, -470], R: [170, -470] },
  face:    { L: [-62, -440], R: [62, -440] },
};
function mixPose(a, b, k) {
  a = typeof a === 'string' ? POSES[a] : a; b = typeof b === 'string' ? POSES[b] : b;
  return { L: [lerp(a.L[0], b.L[0], k), lerp(a.L[1], b.L[1], k)], R: [lerp(a.R[0], b.R[0], k), lerp(a.R[1], b.R[1], k)] };
}
// pose timeline: [[time, poseName], ...] -> blended pose (0.18s blends)
function poseAt(t, list, blend = 0.18) {
  let cur = list[0][1], prev = list[0][1], t0 = -99;
  for (const [tt, p] of list) { if (t >= tt) { prev = cur; cur = p; t0 = tt; } }
  const k = E.inOut(P(t, t0, blend));
  return mixPose(prev, cur, k);
}
// expression timeline
function exprAt(t, list) { let e = list[0][1]; for (const [tt, x] of list) if (t >= tt) e = x; return e; }

const EXPR = {
  neutral:  { lid: 0.42, sc: 1.0, pupil: 8, brow: 0.0, browY: 0, mouth: 'flat' },
  smug:     { lid: 0.52, sc: 1.0, pupil: 8, brow: -0.15, browY: 0, mouth: 'smirk', browUp: true },
  worried:  { lid: 0.08, sc: 1.05, pupil: 7, brow: 0.4, browY: -6, mouth: 'wavy' },
  panic:    { lid: 0.0, sc: 1.18, pupil: 5, brow: 0.5, browY: -14, mouth: 'o' },
  relief:   { lid: 1.0, happyEyes: true, sc: 1, pupil: 8, brow: 0.15, browY: -4, mouth: 'smile', blush: 1 },
  strain:   { lid: 1.0, squeeze: true, sc: 1, pupil: 8, brow: -0.45, browY: 6, mouth: 'grimace', red: 0.35 },
  fake:     { lid: 0.12, sc: 1.08, pupil: 5, brow: 0.45, browY: -8, mouth: 'grin' },
  shocked:  { lid: 0.0, sc: 1.25, pupil: 4, brow: 0.3, browY: -18, mouth: 'O' },
  sad:      { lid: 0.5, sc: 1.0, pupil: 8, brow: 0.5, browY: -2, mouth: 'frown' },
  happy:    { lid: 0.18, sc: 1.0, pupil: 8, brow: 0.1, browY: -6, mouth: 'smile', blush: 0.6 },
  chew:     { lid: 0.55, sc: 1.0, pupil: 8, brow: 0.0, browY: 0, mouth: 'chew' },
  pray:     { lid: 1.0, squeeze: true, sc: 1, pupil: 8, brow: 0.5, browY: -6, mouth: 'wavy', red: 0.15 },
  talk:     { lid: 0.35, sc: 1.0, pupil: 8, brow: 0.05, browY: -2, mouth: 'talk' },
};

function blinkAmt(t, seed = 0) {
  const per = 2.9; const k = Math.floor((t + seed) / per);
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

function drawArm(ctx, side, sh, target, o) {
  const { elbow, hand } = ik(sh[0], sh[1], target[0], target[1], 92, 90, side);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // outline pass
  ctx.strokeStyle = OUT; ctx.lineWidth = 40;
  ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  // skin
  ctx.strokeStyle = SKIN; ctx.lineWidth = 30;
  ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  // sleeve
  const sx = lerp(sh[0], elbow[0], 0.55), sy = lerp(sh[1], elbow[1], 0.55);
  ctx.strokeStyle = OUT; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(sx, sy); ctx.stroke();
  ctx.strokeStyle = SHIRT; ctx.lineWidth = 36; ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(sx, sy); ctx.stroke();
  // hand
  const hx = hand[0], hy = hand[1];
  if (o.thumb && side > 0) {
    ctx.save(); ctx.translate(hx, hy);
    rr(ctx, -7, -40, 15, 30, 7); fillStroke(ctx, SKIN, OUT, 4.5);
    circle(ctx, 0, 0, 21); fillStroke(ctx, SKIN, OUT, 5);
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(10, -4); ctx.moveTo(-12, 6); ctx.lineTo(10, 6); ctx.lineWidth = 3; ctx.strokeStyle = SKIN_D; ctx.stroke();
    ctx.restore();
  } else if (o.thumbL && side < 0) {
    ctx.save(); ctx.translate(hx, hy);
    rr(ctx, -8, -40, 15, 30, 7); fillStroke(ctx, SKIN, OUT, 4.5);
    circle(ctx, 0, 0, 21); fillStroke(ctx, SKIN, OUT, 5);
    ctx.restore();
  } else {
    circle(ctx, hx, hy, 20); fillStroke(ctx, SKIN, OUT, 5);
  }
  if (o.fork && side > 0) {
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-2.3);
    ctx.fillStyle = '#c9d1dc'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    rr(ctx, -3, -8, 6, 52, 3); ctx.fill(); ctx.stroke();
    rr(ctx, -9, 40, 18, 10, 3); ctx.fill(); ctx.stroke();
    for (let i = -1; i <= 1; i++) { rr(ctx, i * 6 - 1.5, 48, 3, 16, 1); ctx.fill(); }
    if (o.forkCake) { ell(ctx, 0, 58, 14, 10); fillStroke(ctx, '#fff6dc', OUT, 3); ell(ctx, 0, 52, 14, 4); ctx.fillStyle = '#ffb3c7'; ctx.fill(); }
    ctx.restore();
  }
  if (o.phoneHand && side > 0) {
    ctx.save(); ctx.translate(hx - 30, hy - 30); rr(ctx, -6, -28, 50, 84, 9); fillStroke(ctx, '#222634', OUT, 4);
    rr(ctx, 0, -20, 38, 66, 5); ctx.fillStyle = '#9fd3ff'; ctx.fill(); ctx.restore();
  }
}

function drawLegs(ctx, t, o) {
  const mode = o.legs || 'stand';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const leg = (pts, footX, footY, footRot) => {
    ctx.strokeStyle = OUT; ctx.lineWidth = 58; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.strokeStyle = PANTS; ctx.lineWidth = 48; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // shoe
    ctx.save(); ctx.translate(footX, footY); ctx.rotate(footRot || 0);
    ell(ctx, 0, 0, 36, 17); fillStroke(ctx, '#f4f4f4', OUT, 5);
    ctx.beginPath(); ctx.ellipse(0, 6, 33, 9, 0, 0.1, Math.PI - 0.1); ctx.lineWidth = 4; ctx.strokeStyle = '#b9bec8'; ctx.stroke();
    ctx.fillStyle = '#e23b3b'; rr(ctx, -10, -15, 20, 6, 3); ctx.fill();
    ctx.restore();
  };
  if (mode === 'stand') {
    leg([[-36, -160], [-38, -30]], -42, -14); leg([[36, -160], [38, -30]], 42, -14);
  } else if (mode === 'cross') {
    const j = Math.sin(t * 38) * 4 * (o.urgency || 0.5);
    leg([[-40, -160], [-8 + j, -92], [-40, -30]], -40, -14, 0.25); leg([[40, -160], [8 + j, -92], [40, -30]], 40, -14, -0.25);
  } else if (mode === 'walk' || mode === 'run') {
    const ph = o.walkPhase || 0, amp = mode === 'run' ? 0.75 : 0.42;
    for (const sd of [-1, 1]) {
      const a = Math.sin(ph + (sd > 0 ? Math.PI : 0)) * amp;
      const lift = Math.max(0, Math.cos(ph + (sd > 0 ? Math.PI : 0))) * (mode === 'run' ? 34 : 16);
      const hx = sd * 30, hy = -160;
      const kx = hx + Math.sin(a) * 70, ky = hy + Math.cos(a) * 70;
      const fx = kx + Math.sin(a * 0.3) * 62 * (mode === 'run' ? 1 : 0.5), fy = -26 - lift;
      leg([[hx, hy], [kx, ky], [fx, fy]], fx + 6, fy + 12, 0);
    }
  } else if (mode === 'kneel') {
    leg([[-36, -160], [-46, -40]], -60, -18, -0.4); leg([[36, -160], [46, -40]], 60, -18, 0.4);
  } else if (mode === 'sit') {
    leg([[-36, -160], [-50, -120], [-48, -30]], -50, -14); leg([[36, -160], [50, -120], [48, -30]], 50, -14);
  }
}

function drawTorso(ctx, t, o) {
  // body / belly shape
  const belly = 1 + (o.bellyPuff || 0);
  ctx.beginPath();
  ctx.moveTo(-46, -372);
  ctx.bezierCurveTo(-80, -372, -96, -350, -96, -320);
  ctx.bezierCurveTo(-100 * belly, -280, -124 * belly, -230, -112 * belly, -188);
  ctx.bezierCurveTo(-100 * belly, -150, -60, -138, 0, -138);
  ctx.bezierCurveTo(60, -138, 100 * belly, -150, 112 * belly, -188);
  ctx.bezierCurveTo(124 * belly, -230, 100 * belly, -280, 96, -320);
  ctx.bezierCurveTo(96, -350, 80, -372, 46, -372);
  ctx.closePath();
  ctx.save(); fillStroke(ctx, SKIN, OUT, 6); ctx.clip();
  // pants waistband (behind belly bottom)
  ctx.fillStyle = PANTS; ctx.fillRect(-150, -164, 300, 60);
  // shirt (too short: belly pokes out)
  ctx.beginPath(); ctx.moveTo(-160, -400); ctx.lineTo(160, -400); ctx.lineTo(160, -236);
  for (let x = 160; x >= -160; x -= 20) ctx.lineTo(x, -232 + Math.sin(x * 0.09) * 5 + (Math.abs(x) < 60 ? -8 : 0));
  ctx.closePath(); ctx.fillStyle = SHIRT; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  // belly redraw over pants for the round bottom
  ctx.beginPath(); ctx.ellipse(0, -186, 108 * belly, 50, 0, 0, Math.PI); ctx.fillStyle = SKIN; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -186, 108 * belly, 50, 0, 0.05, Math.PI - 0.05); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.restore();
  // waistband line
  ctx.beginPath(); ctx.ellipse(0, -150, 92, 14, 0, 0.25, Math.PI - 0.25); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  // belly button + hair
  ell(ctx, 0, -190, 6, 4); ctx.fillStyle = SKIN_D; ctx.fill();
  ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const x = -30 + i * 10, y = -205 + (i % 2) * 18; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y - 5, x + 1, y - 9); ctx.stroke(); }
  // shirt stains
  ctx.globalAlpha = 0.85;
  ell(ctx, -40, -300, 18, 12, 0.4); ctx.fillStyle = SHIRT_D; ctx.fill();
  ell(ctx, 52, -270, 13, 9, -0.2); ctx.fillStyle = '#d4552b'; ctx.fill();
  ell(ctx, 18, -335, 9, 6); ctx.fillStyle = SHIRT_D; ctx.fill();
  ctx.globalAlpha = 1;
  // collar
  ctx.beginPath(); ctx.ellipse(0, -368, 36, 13, 0, 0, Math.PI); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  // chip crumbs
  const cr = o.crumbs || 0;
  if (cr > 0) {
    const pts = [[-60, -320], [-20, -280], [30, -310], [64, -300], [-48, -262], [10, -250], [44, -340], [-12, -340], [70, -255], [-72, -288]];
    pts.forEach((p, i) => {
      const k = E.back(clamp(cr * pts.length - i));
      if (k <= 0) return;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(i * 1.7); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(0, -9); ctx.lineTo(10, 7); ctx.closePath();
      ctx.fillStyle = '#ffc93c'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#b07400'; ctx.stroke();
      ctx.restore();
    });
  }
}

function drawHead(ctx, t, o) {
  const ex = Object.assign({}, EXPR[o.expr || 'neutral']);
  const hy = -462;
  ctx.save(); ctx.translate(0, hy); ctx.rotate(o.headTilt || 0); ctx.translate(0, -hy);
  // neck
  rr(ctx, -30, -400, 60, 40, 14); fillStroke(ctx, SKIN, OUT, 5);
  // ears
  ell(ctx, -100, hy + 6, 16, 22); fillStroke(ctx, SKIN, OUT, 5);
  ell(ctx, 100, hy + 6, 16, 22); fillStroke(ctx, SKIN, OUT, 5);
  // head
  ell(ctx, 0, hy, 100, 96); fillStroke(ctx, SKIN, OUT, 6);
  // red face (strain) tint
  if (ex.red || o.red) { ell(ctx, 0, hy + 10, 94, 84); ctx.fillStyle = `rgba(235,60,50,${(ex.red || 0) + (o.red || 0)})`; ctx.fill(); }
  // hair
  ctx.beginPath();
  ctx.moveTo(-92, hy - 30);
  ctx.bezierCurveTo(-96, hy - 92, -40, hy - 112, 0, hy - 104);
  const spikes = [[-60, -122], [-30, -132], [0, -126], [26, -138], [56, -120], [80, -100]];
  for (const [x, y] of spikes) ctx.lineTo(x + Math.sin(t * 3 + x) * 1.5, hy + y);
  ctx.bezierCurveTo(98, hy - 80, 98, hy - 50, 92, hy - 30);
  ctx.bezierCurveTo(70, hy - 66, 20, hy - 70, -20, hy - 62);
  ctx.bezierCurveTo(-50, hy - 58, -80, hy - 50, -92, hy - 30);
  ctx.closePath(); fillStroke(ctx, HAIR, OUT, 5);
  // cowlick
  ctx.beginPath(); ctx.moveTo(10, hy - 126); ctx.quadraticCurveTo(30, hy - 170, 0, hy - 160 + Math.sin(t * 5) * 3); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = HAIR; ctx.stroke();
  // headset band (over the hair)
  ctx.beginPath(); ctx.ellipse(0, hy - 4, 110, 118, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.lineWidth = 20; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.lineWidth = 11; ctx.strokeStyle = '#30343f'; ctx.stroke();
  // spots / pimples
  const spots = [[-70, 22], [62, -12], [-56, 52], [74, 30], [36, -52], [-30, -48], [56, 58]];
  for (const [x, y] of spots) { circle(ctx, x, hy + y, 4.2); ctx.fillStyle = '#e0605a'; ctx.fill(); }
  // stubble
  ctx.fillStyle = 'rgba(90,58,34,0.45)';
  for (let i = 0; i < 26; i++) { const a = 0.35 + (i / 26) * (Math.PI - 0.7); circle(ctx, Math.cos(a) * (64 + (i % 3) * 7), hy + 30 + Math.sin(a) * (54 + (i % 2) * 6), 1.8); ctx.fill(); }
  // blush
  const bl = Math.max(ex.blush || 0, o.blush || 0);
  if (bl > 0) { ctx.fillStyle = `rgba(255,110,130,${0.45 * bl})`; ell(ctx, -64, hy + 26, 18, 10); ctx.fill(); ell(ctx, 64, hy + 26, 18, 10); ctx.fill(); }
  // eyes (behind glasses)
  const blink = Math.max(blinkAmt(t, o.seed || 0), 0);
  const look = o.look || [0, 0];
  for (const sd of [-1, 1]) {
    const cx = sd * 40, cy = hy - 8;
    if (ex.happyEyes) {
      ctx.beginPath(); ctx.arc(cx, cy + 6, 13, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke();
      continue;
    }
    if (ex.squeeze) {
      ctx.beginPath(); ctx.moveTo(cx - 14 * sd, cy - 10); ctx.lineTo(cx + 10 * sd, cy); ctx.lineTo(cx - 14 * sd, cy + 10);
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.stroke();
      continue;
    }
    const rx = 19 * ex.sc, ry = 21 * ex.sc;
    ell(ctx, cx, cy, rx, ry); fillStroke(ctx, '#fff', OUT, 3.5);
    ctx.save(); ell(ctx, cx, cy, rx, ry); ctx.clip();
    circle(ctx, cx + look[0] * 7, cy + look[1] * 6 + 2, ex.pupil); ctx.fillStyle = '#1b1b22'; ctx.fill();
    circle(ctx, cx + look[0] * 7 - 2.5, cy + look[1] * 6 - 1, ex.pupil * 0.3); ctx.fillStyle = '#fff'; ctx.fill();
    const lid = clamp(Math.max(ex.lid + (o.lidAdd || 0), blink));
    if (lid > 0) {
      ctx.fillStyle = SKIN; ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, (ry * 2 + 4) * lid);
      ctx.beginPath(); ctx.moveTo(cx - rx - 2, cy - ry - 2 + (ry * 2 + 4) * lid); ctx.lineTo(cx + rx + 2, cy - ry - 2 + (ry * 2 + 4) * lid);
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.restore();
  }
  // glasses
  for (const sd of [-1, 1]) {
    circle(ctx, sd * 40, hy - 8, 32); ctx.fillStyle = 'rgba(200,230,255,0.22)'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sd * 40 - 16, hy - 26); ctx.lineTo(sd * 40 - 4, hy - 34); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-9, hy - 12); ctx.quadraticCurveTo(0, hy - 20, 9, hy - 12); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-72, hy - 12); ctx.lineTo(-96, hy - 4); ctx.moveTo(72, hy - 12); ctx.lineTo(96, hy - 4); ctx.lineWidth = 6; ctx.stroke();
  // brows
  for (const sd of [-1, 1]) {
    const by = hy - 56 + ex.browY + (sd > 0 && ex.browUp ? -10 : 0);
    const tilt = ex.brow * 18;
    ctx.beginPath(); ctx.moveTo(sd * 18, by - tilt); ctx.lineTo(sd * 60, by + tilt * 0.4);
    ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.strokeStyle = HAIR; ctx.stroke();
  }
  // nose
  ctx.beginPath(); ctx.ellipse(0, hy + 26, 15, 12, 0, 0, TAU); ctx.fillStyle = '#f0b08a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  // mouth
  drawMouth(ctx, t, ex.mouth, hy + 58, o);
  // headset cups + mic
  for (const sd of [-1, 1]) {
    rr(ctx, sd * 108 - 19, hy - 30, 38, 70, 16); fillStroke(ctx, '#e23b3b', OUT, 6);
    rr(ctx, sd * 108 - 10, hy - 18, 20, 46, 9); ctx.fillStyle = '#30343f'; ctx.fill();
  }
  if (o.glint > 0) sparkle(ctx, 112, hy - 20, o.glint * 1.6, o.glint);
  ctx.beginPath(); ctx.moveTo(-108, hy + 30); ctx.quadraticCurveTo(-100, hy + 72, -48, hy + 66); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#30343f'; ctx.stroke();
  ell(ctx, -44, hy + 66, 12, 9); fillStroke(ctx, '#30343f', OUT, 4);
  ctx.restore();
}

function drawMouth(ctx, t, type, y, o) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 6;
  const talk = o.talking ? Math.abs(Math.sin(t * 17)) : 0;
  if (type === 'talk' || (o.talking && type !== 'grin')) {
    ell(ctx, 0, y, 22, 4 + talk * 13); fillStroke(ctx, '#7a2230', OUT, 5); return;
  }
  switch (type) {
    case 'flat': ctx.beginPath(); ctx.moveTo(-24, y); ctx.quadraticCurveTo(0, y + 3, 24, y - 2); ctx.stroke(); break;
    case 'smirk': ctx.beginPath(); ctx.moveTo(-22, y + 2); ctx.quadraticCurveTo(8, y + 8, 28, y - 8); ctx.stroke(); break;
    case 'smile': ctx.beginPath(); ctx.moveTo(-30, y - 6); ctx.quadraticCurveTo(0, y + 22, 30, y - 6); ctx.closePath(); fillStroke(ctx, '#7a2230', OUT, 5);
      ctx.save(); ctx.clip(); ctx.fillStyle = '#ff8fa0'; ell(ctx, 0, y + 12, 14, 7); ctx.fill(); ctx.restore(); break;
    case 'wavy': ctx.beginPath(); ctx.moveTo(-26, y + 2); for (let x = -26; x <= 26; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.35 + t * 12) * 4); ctx.stroke(); break;
    case 'o': ell(ctx, 0, y + 4, 13, 16); fillStroke(ctx, '#7a2230', OUT, 5); break;
    case 'O': ell(ctx, 0, y + 8, 20, 26); fillStroke(ctx, '#7a2230', OUT, 5); ell(ctx, 0, y + 22, 11, 7); ctx.fillStyle = '#ff8fa0'; ctx.fill(); break;
    case 'frown': ctx.beginPath(); ctx.moveTo(-24, y + 6); ctx.quadraticCurveTo(0, y - 10, 24, y + 6); ctx.stroke(); break;
    case 'grimace': case 'grin': {
      const w = type === 'grin' ? 40 : 32, h = type === 'grin' ? 26 : 18;
      rr(ctx, -w, y - h / 2, w * 2, h, 9); fillStroke(ctx, '#fff', OUT, 5);
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); for (let x = -w + 12; x < w; x += 12) { ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); }
      ctx.lineWidth = 3; ctx.stroke(); break;
    }
    case 'chew': { const k = Math.abs(Math.sin(t * 14)); ell(ctx, Math.sin(t * 7) * 4, y, 18, 3 + k * 8); fillStroke(ctx, '#7a2230', OUT, 5); break; }
  }
}

// main entry. o.x,o.y = feet position in world; o.s = scale
function drawLarry(ctx, t, o) {
  const s0 = o.s || 1;
  if (o.stink) { stink(ctx, o.x - 135 * s0, o.y - 170 * s0, t, o.stink, s0 * 0.8); stink(ctx, o.x + 135 * s0, o.y - 190 * s0, t + 0.7, o.stink, s0 * 0.8); }
  ctx.save();
  const urg = o.urgency || 0;
  const jx = urg > 0 ? (Math.sin(t * 71) * 3.2 + noise(t * 30) * 3) * urg : 0;
  ctx.translate(o.x + jx, o.y);
  const s = o.s || 1;
  ctx.scale(s * (o.facing || 1), s);
  ctx.rotate(o.lean || 0);
  // squash & stretch: breathing + custom squash
  const breathe = 1 + Math.sin(t * 2.3 + (o.seed || 0)) * 0.012;
  const sq = (o.squash || 0);
  const sy = breathe * (1 + sq), sx = 1 / Math.sqrt(sy * sy);
  // ground shadow
  ctx.save(); ctx.scale(1 / Math.max(0.6, 1 - (o.hop || 0) / 300), 1);
  ell(ctx, 0, -4, 120, 18); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); ctx.restore();
  ctx.translate(0, -(o.hop || 0));
  ctx.scale(sx, sy);
  const kneel = o.legs === 'kneel' ? 70 : 0, sit = 0;
  const bob = (o.legs === 'walk' || o.legs === 'run') ? -Math.abs(Math.sin(o.walkPhase || 0)) * (o.legs === 'run' ? 16 : 8) : 0;
  drawLegs(ctx, t, o);
  ctx.translate(0, kneel + sit + bob);
  const pose = o.pose ? (typeof o.pose === 'string' ? POSES[o.pose] : o.pose) : POSES.idle;
  // arm motion extras
  const wob = o.armWobble ? Math.sin(t * 9) * 10 : 0;
  // back arm first if pose crosses body? draw torso, then arms in front
  drawTorso(ctx, t, o);
  drawHead(ctx, t, o);
  drawArm(ctx, -1, [-84, -338], [pose.L[0] - wob, pose.L[1] + (o.armShakeL || 0)], o);
  drawArm(ctx, 1, [84, -338], [pose.R[0] + wob, pose.R[1] + (o.armShakeR || 0)], o);
  // sweat when urgent
  const sw = o.sweat !== undefined ? o.sweat : clamp((urg - 0.35) * 2);
  if (sw > 0) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.9 + i * 0.37) % 1;
      ctx.globalAlpha = sw * (1 - ph);
      sweat(ctx, (i === 1 ? 1 : -1) * (96 + i * 6), -520 + ph * 90 + i * 14, 1.1);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // world-space extras (not squashed)
  const headX = o.x + jx, headY = o.y - 462 * s - (o.hop || 0) * s + (o.legs === 'kneel' ? 70 * s : 0);
  const nf = o.flies || 0;
  for (let i = 0; i < nf; i++) fly(ctx, headX, headY - 40 * s, t, i * 3.7 + 1, 150 * s);
  if (o.wiggleLines) {
    ctx.save(); ctx.strokeStyle = 'rgba(30,30,40,0.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const xx = o.x + sd * (150 + i * 12) * s, yy = o.y - (330 - i * 40) * s;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + sd * 20 * s, yy - 6 * s + Math.sin(t * 40 + i) * 4); ctx.stroke();
    }
    ctx.restore();
  }
  return { headX, headY };
}
