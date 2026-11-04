// ---------- GRANDPA WALT: puppet character with soft shading ----------
const W_SKIN = '#f3c6a5', W_SKIN_L = '#fbdcc4', W_SKIN_D = '#d99c7c';
const CARDI = '#3f8f8a', CARDI_L = '#58aaa3', CARDI_D = '#2c6c68';
const SHIRT_W = '#cfe3f7', PANTS_W = '#8a6240', PANTS_WD = '#6b4a2e', HAIR_W = '#f4f4f7';

// vertical light->dark gradient helper (light from top-left)
function lgrad(ctx, x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function rgrad(ctx, x, y, r, a, b) { const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

const WPOSES = {
  idle:     { L: [-112, -170], R: [112, -170] },
  cane:     { L: [-120, -150], R: [112, -170] },
  phoneUp:  { L: [-112, -170], R: [44, -420] },
  phoneTwo: { L: [-34, -410], R: [34, -410] },
  phoneFar: { L: [-112, -170], R: [205, -400] },
  selfie:   { L: [-112, -170], R: [150, -560] },
  dance1:   { L: [-175, -470], R: [150, -250] },
  dance2:   { L: [-150, -250], R: [175, -470] },
  cheer:    { L: [-165, -490], R: [165, -490] },
  face:     { L: [-70, -440], R: [70, -440] },
  write:    { L: [-60, -250], R: [70, -240] },
  fist:     { L: [-112, -170], R: [150, -520] },
  point:    { L: [-112, -170], R: [215, -350] },
  shrug:    { L: [-170, -300], R: [170, -300] },
  hips:     { L: [-104, -232], R: [104, -232] },
  drive:    { L: [-60, -300], R: [60, -300] },
  mail:     { L: [-112, -170], R: [200, -300] },
};
function wPoseAt(t, list, blend = 0.18) {
  let cur = list[0][1], prev = list[0][1], t0 = -99;
  for (const [tt, p] of list) { if (t >= tt) { prev = cur; cur = p; t0 = tt; } }
  const a = typeof prev === 'string' ? WPOSES[prev] : prev, b = typeof cur === 'string' ? WPOSES[cur] : cur;
  const k = E.inOut(P(t, t0, blend));
  return { L: [lerp(a.L[0], b.L[0], k), lerp(a.L[1], b.L[1], k)], R: [lerp(a.R[0], b.R[0], k), lerp(a.R[1], b.R[1], k)] };
}

const WEXPR = {
  neutral:  { lid: 0.35, sc: 1.0, pupil: 10, brow: 0.0, browY: 0, mouth: 'flat' },
  squint:   { lid: 0.62, sc: 1.0, pupil: 9, brow: -0.3, browY: 6, mouth: 'flat', lean: true },
  proud:    { lid: 0.45, sc: 1.0, pupil: 10, brow: -0.1, browY: -4, mouth: 'smile', blush: 0.5 },
  happy:    { lid: 0.1, sc: 1.05, pupil: 11, brow: 0.25, browY: -8, mouth: 'smile', blush: 0.8 },
  shocked:  { lid: 0.0, sc: 1.3, pupil: 5, brow: 0.5, browY: -18, mouth: 'O' },
  scream:   { lid: 0.0, sc: 1.35, pupil: 4, brow: 0.6, browY: -22, mouth: 'scream' },
  worried:  { lid: 0.1, sc: 1.08, pupil: 8, brow: 0.45, browY: -8, mouth: 'wavy' },
  grumpy:   { lid: 0.45, sc: 1.0, pupil: 9, brow: -0.55, browY: 8, mouth: 'frown' },
  confused: { lid: 0.2, sc: 1.05, pupil: 9, brow: 0.3, browY: -6, mouth: 'wavy', browUp: true },
  pain:     { lid: 1.0, squeeze: true, sc: 1, pupil: 9, brow: -0.5, browY: 6, mouth: 'grimace', red: 0.25 },
  talk:     { lid: 0.3, sc: 1.0, pupil: 10, brow: 0.1, browY: -2, mouth: 'talk' },
  rant:     { lid: 0.25, sc: 1.05, pupil: 8, brow: -0.6, browY: 8, mouth: 'talk', red: 0.2 },
  joy:      { lid: 1.0, happyEyes: true, sc: 1, pupil: 10, brow: 0.2, browY: -8, mouth: 'smile', blush: 1 },
  cool:     { lid: 0.5, sc: 1.0, pupil: 10, brow: -0.2, browY: 0, mouth: 'smirk', browUp: true },
};

function wArm(ctx, side, sh, target, o) {
  const { elbow, hand } = ik(sh[0], sh[1], target[0], target[1], 90, 88, side);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); };
  path(); ctx.strokeStyle = OUT; ctx.lineWidth = 46; ctx.stroke();
  path(); ctx.strokeStyle = CARDI; ctx.lineWidth = 36; ctx.stroke();
  // sleeve highlight
  ctx.save(); ctx.translate(-4, -4); path(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.stroke(); ctx.restore();
  // cuff
  const cx = lerp(elbow[0], hand[0], 0.78), cy = lerp(elbow[1], hand[1], 0.78);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lerp(elbow[0], hand[0], 0.86), lerp(elbow[1], hand[1], 0.86)); ctx.strokeStyle = CARDI_D; ctx.lineWidth = 38; ctx.stroke();
  const hx = hand[0], hy = hand[1];
  circle(ctx, hx, hy, 19); fillStroke(ctx, rgrad(ctx, hx, hy, 19, W_SKIN_L, W_SKIN), OUT, 5);
  circle(ctx, hx + 5, hy + 4, 2.5); ctx.fillStyle = 'rgba(160,100,70,0.5)'; ctx.fill();
  if (o.phone && side > 0) {
    ctx.save(); ctx.translate(hx, hy - 18); ctx.rotate(o.phoneRot || -0.15);
    rr(ctx, -26, -46, 52, 92, 10); fillStroke(ctx, '#23232e', OUT, 4);
    rr(ctx, -21, -39, 42, 76, 6); ctx.fillStyle = o.phoneGlow ? '#cfeaff' : '#7fb8e8'; ctx.fill();
    if (o.phoneText) { ctx.font = '700 30px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#111'; ctx.fillText(o.phoneText, 0, 6); }
    if (o.live) { rr(ctx, -18, -34, 30, 14, 4); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.font = '800 9px Inter'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('LIVE', -15, -24); }
    ctx.restore();
  }
  if (o.pen && side > 0) {
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(0.6 + Math.sin(o.t * 30) * 0.08);
    rr(ctx, -4, -46, 8, 50, 3); fillStroke(ctx, '#1b1b22', OUT, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -46, 8, 8); ctx.restore();
  }
  if (o.letter && side > 0) {
    ctx.save(); ctx.translate(hx + 10, hy - 10); ctx.rotate(-0.2);
    rr(ctx, -10, -28, 78, 52, 4); fillStroke(ctx, '#fffaf0', OUT, 4);
    ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(29, 2); ctx.lineTo(68, -28); ctx.lineWidth = 3; ctx.stroke();
    circle(ctx, 29, 2, 7); ctx.fillStyle = '#c0392b'; ctx.fill(); ctx.restore();
  }
}

function wLegs(ctx, t, o) {
  const mode = o.legs || 'stand';
  const leg = (pts, fx, fy, fr = 0) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
    path(); ctx.strokeStyle = OUT; ctx.lineWidth = 54; ctx.stroke();
    path(); ctx.strokeStyle = PANTS_W; ctx.lineWidth = 44; ctx.stroke();
    ctx.save(); ctx.translate(-5, 0); path(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 10; ctx.stroke(); ctx.restore();
    // white socks + brown orthopedic shoes
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(fr);
    rr(ctx, -14, -30, 28, 20, 6); ctx.fillStyle = '#f7f7f7'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ell(ctx, 4, 0, 38, 17); fillStroke(ctx, lgrad(ctx, 0, -17, 0, 17, '#8a5a32', '#5b3a1e'), OUT, 5);
    ctx.beginPath(); ctx.ellipse(4, 7, 34, 8, 0, 0.1, Math.PI - 0.1); ctx.lineWidth = 5; ctx.strokeStyle = '#2d1d10'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -10, -7, 12, 4, -0.2); ctx.fill();
    ctx.restore();
  };
  if (mode === 'stand') { leg([[-34, -170], [-36, -36]], -40, -16); leg([[34, -170], [36, -36]], 42, -16); }
  else if (mode === 'walk' || mode === 'run') {
    const ph = o.walkPhase || 0, amp = mode === 'run' ? 0.6 : 0.36;
    for (const sd of [-1, 1]) {
      const a = Math.sin(ph + (sd > 0 ? Math.PI : 0)) * amp, lift = Math.max(0, Math.cos(ph + (sd > 0 ? Math.PI : 0))) * (mode === 'run' ? 26 : 12);
      const hx = sd * 30, kx = hx + Math.sin(a) * 70, ky = -170 + Math.cos(a) * 70, fx = kx + Math.sin(a * 0.3) * 40, fy = -36 - lift;
      leg([[hx, -170], [kx, ky], [fx, fy]], fx + 4, fy + 20);
    }
  } else if (mode === 'dance') {
    const k = o.danceK || 0; // 0..1 knee lift on the right
    leg([[-34, -170], [-38, -36]], -42, -16);
    const kx = 46 + k * 40, ky = -110 - k * 45;
    leg([[34, -170], [kx, ky], [kx - 10 + k * 10, -36 - k * 70]], kx - 6 + k * 10, -16 - k * 70, -k * 0.3);
  } else if (mode === 'sit') {
    leg([[-34, -170], [-70, -150], [-74, -60]], -78, -40); leg([[34, -170], [70, -150], [74, -60]], 80, -40);
  } else if (mode === 'kneel') {
    leg([[-36, -170], [-46, -46]], -60, -22, -0.4); leg([[36, -170], [46, -46]], 60, -22, 0.4);
  }
}

function wTorso(ctx, t, o) {
  // body shape (cardigan)
  ctx.beginPath();
  ctx.moveTo(-40, -376);
  ctx.bezierCurveTo(-74, -376, -88, -356, -90, -326);
  ctx.bezierCurveTo(-96, -270, -104, -220, -96, -180);
  ctx.bezierCurveTo(-90, -160, -60, -152, 0, -152);
  ctx.bezierCurveTo(60, -152, 90, -160, 96, -180);
  ctx.bezierCurveTo(104, -220, 96, -270, 90, -326);
  ctx.bezierCurveTo(88, -356, 74, -376, 40, -376);
  ctx.closePath();
  ctx.save();
  fillStroke(ctx, lgrad(ctx, -90, -380, 90, -160, CARDI_L, CARDI_D), OUT, 6); ctx.clip();
  // shirt opening (V) + plaid
  ctx.beginPath(); ctx.moveTo(-34, -376); ctx.lineTo(0, -250); ctx.lineTo(34, -376); ctx.closePath(); ctx.fillStyle = SHIRT_W; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(80,130,190,0.45)'; ctx.lineWidth = 3;
  for (let i = -40; i < 40; i += 12) { ctx.beginPath(); ctx.moveTo(i, -380); ctx.lineTo(i, -240); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-40, -380 + (i + 40) * 1.5); ctx.lineTo(40, -380 + (i + 40) * 1.5); ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-34, -376); ctx.lineTo(0, -250); ctx.lineTo(34, -376); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  // high-waisted pants up to the chest
  ctx.beginPath(); ctx.moveTo(-120, -262); ctx.quadraticCurveTo(0, -250, 120, -262); ctx.lineTo(120, -100); ctx.lineTo(-120, -100); ctx.closePath();
  ctx.fillStyle = lgrad(ctx, 0, -262, 0, -140, PANTS_W, PANTS_WD); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  // belt + buckle
  ctx.fillStyle = '#2a1d14'; ctx.fillRect(-120, -262, 240, 16);
  rr(ctx, -15, -266, 30, 24, 4); fillStroke(ctx, '#e7b94c', OUT, 3);
  ctx.restore();
  // cardigan buttons
  for (let i = 0; i < 2; i++) { circle(ctx, 22 - i * 4, -330 + i * 36, 5); ctx.fillStyle = '#e9d7b0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
  // pocket with pens
  rr(ctx, -74, -330, 34, 32, 4); ctx.lineWidth = 3; ctx.strokeStyle = CARDI_D; ctx.stroke();
  ctx.fillStyle = '#e23b3b'; ctx.fillRect(-66, -344, 5, 18); ctx.fillStyle = '#3b82e2'; ctx.fillRect(-56, -342, 5, 16);
  // bow tie
  ctx.save(); ctx.translate(0, -368);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, -12); ctx.lineTo(-24, 12); ctx.closePath(); fillStroke(ctx, '#d6453b', OUT, 4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -12); ctx.lineTo(24, 12); ctx.closePath(); fillStroke(ctx, '#d6453b', OUT, 4);
  circle(ctx, 0, 0, 7); fillStroke(ctx, '#b33027', OUT, 3);
  ctx.restore();
}

function wHead(ctx, t, o) {
  const ex = Object.assign({}, WEXPR[o.expr || 'neutral']);
  const hy = -470;
  ctx.save(); ctx.translate(0, hy + 60); ctx.rotate(o.headTilt || 0); ctx.translate(0, -hy - 60);
  // neck with wrinkles
  rr(ctx, -24, -410, 48, 44, 14); fillStroke(ctx, W_SKIN_D, OUT, 5);
  // hair tufts behind ears
  for (const sd of [-1, 1]) { puff(ctx, sd * 86, hy - 18, 0.95, HAIR_W, OUT, 5); }
  // ears
  for (const sd of [-1, 1]) {
    ell(ctx, sd * 92, hy + 6, 22, 33, sd * 0.12); fillStroke(ctx, W_SKIN, OUT, 5);
    ell(ctx, sd * 94, hy + 8, 10, 18, sd * 0.12); ctx.fillStyle = '#e8a08a'; ctx.fill();
  }
  // hearing aid
  rr(ctx, 98, hy - 22, 14, 30, 7); fillStroke(ctx, '#e9cfa8', OUT, 3);
  // head (shaded)
  ell(ctx, 0, hy, 86, 98); fillStroke(ctx, rgrad(ctx, 0, hy, 98, W_SKIN_L, W_SKIN_D), OUT, 6);
  // bald shine
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, -26, hy - 66, 28, 12, -0.35); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, 6, hy - 78, 9, 5, -0.2); ctx.fill();
  // three lone hairs
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) { const x = -10 + i * 10; ctx.beginPath(); ctx.moveTo(x, hy - 96); ctx.quadraticCurveTo(x + 8 + Math.sin(t * 3 + i) * 4, hy - 120, x + 2, hy - 128); ctx.stroke(); }
  // forehead wrinkles
  ctx.strokeStyle = 'rgba(150,90,60,0.55)'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, hy - 10 + i * 10, 60 - i * 6, Math.PI * 1.32, Math.PI * 1.68); ctx.stroke(); }
  if (ex.red || o.red) { ell(ctx, 0, hy + 10, 82, 86); ctx.fillStyle = `rgba(235,70,60,${(ex.red || 0) + (o.red || 0)})`; ctx.fill(); }
  const bl = Math.max(ex.blush || 0, o.blush || 0);
  if (bl > 0) { ctx.fillStyle = `rgba(255,110,120,${0.4 * bl})`; ell(ctx, -54, hy + 38, 18, 10); ctx.fill(); ell(ctx, 54, hy + 38, 18, 10); ctx.fill(); }
  // magnified eyes behind thick glasses
  const blink = blinkAmt(t, o.seed || 0);
  const look = o.look || [0, 0];
  for (const sd of [-1, 1]) {
    const cx = sd * 36, cy = hy + 2;
    if (ex.happyEyes) { ctx.beginPath(); ctx.arc(cx, cy + 8, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke(); continue; }
    if (ex.squeeze) { ctx.beginPath(); ctx.moveTo(cx - 16 * sd, cy - 12); ctx.lineTo(cx + 12 * sd, cy); ctx.lineTo(cx - 16 * sd, cy + 12); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.stroke(); continue; }
    const rx = 25 * ex.sc, ry = 27 * ex.sc;
    ell(ctx, cx, cy, rx, ry); fillStroke(ctx, '#ffffff', OUT, 3.5);
    ctx.save(); ell(ctx, cx, cy, rx, ry); ctx.clip();
    circle(ctx, cx + look[0] * 9, cy + look[1] * 8 + 2, ex.pupil); ctx.fillStyle = '#5b7fa8'; ctx.fill();
    circle(ctx, cx + look[0] * 9, cy + look[1] * 8 + 2, ex.pupil * 0.6); ctx.fillStyle = '#1b1b22'; ctx.fill();
    circle(ctx, cx + look[0] * 9 - 3, cy + look[1] * 8 - 2, ex.pupil * 0.3); ctx.fillStyle = '#fff'; ctx.fill();
    const lid = clamp(Math.max(ex.lid + (o.lidAdd || 0), blink));
    if (lid > 0) {
      const h = (ry * 2 + 4) * lid;
      ctx.fillStyle = W_SKIN; ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, h);
      ctx.beginPath(); ctx.moveTo(cx - rx - 2, cy - ry - 2 + h); ctx.lineTo(cx + rx + 2, cy - ry - 2 + h); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.restore();
  }
  // crow's feet
  ctx.strokeStyle = 'rgba(150,90,60,0.6)'; ctx.lineWidth = 2.5;
  for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sd * 76, hy + 2 + i * 10); ctx.lineTo(sd * 88, hy + 2 + i * 14); ctx.stroke(); }
  // thick tortoiseshell glasses
  for (const sd of [-1, 1]) {
    circle(ctx, sd * 36, hy + 2, 37); ctx.fillStyle = 'rgba(210,235,255,0.18)'; ctx.fill();
    ctx.lineWidth = 11; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#7a4a22'; ctx.stroke();
    ctx.beginPath(); ctx.arc(sd * 36, hy + 2, 28, Math.PI * 1.15, Math.PI * 1.45); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-8, hy - 4); ctx.quadraticCurveTo(0, hy - 12, 8, hy - 4); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-73, hy - 4); ctx.lineTo(-88, hy + 2); ctx.moveTo(73, hy - 4); ctx.lineTo(88, hy + 2); ctx.lineWidth = 7; ctx.stroke();
  // bushy white eyebrows
  for (const sd of [-1, 1]) {
    const by = hy - 46 + ex.browY + (sd > 0 && ex.browUp ? -12 : 0), tilt = ex.brow * 20;
    ctx.save(); ctx.translate(sd * 38, by); ctx.rotate(sd * (-tilt / 60));
    for (let i = -2; i <= 2; i++) { ell(ctx, i * 10, Math.abs(i) * 2, 10, 8); fillStroke(ctx, HAIR_W, OUT, 3); }
    for (let i = -2; i <= 2; i++) { ell(ctx, i * 10, Math.abs(i) * 2, 9, 7); ctx.fillStyle = HAIR_W; ctx.fill(); }
    ctx.restore();
  }
  // big nose
  ell(ctx, 0, hy + 42, 22, 19); fillStroke(ctx, rgrad(ctx, 0, hy + 42, 22, '#f7c4a4', '#e2957a'), OUT, 4.5);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -7, hy + 35, 6, 4, -0.4); ctx.fill();
  // mouth + mustache
  wMouth(ctx, t, ex.mouth, hy + 78, o);
  ctx.save(); ctx.translate(0, hy + 64);
  ctx.beginPath(); ctx.moveTo(0, -6);
  ctx.bezierCurveTo(-18, -14, -44, -10, -54, 8); ctx.bezierCurveTo(-40, 6, -30, 10, -20, 6); ctx.bezierCurveTo(-12, 4, -6, 6, 0, 2);
  ctx.bezierCurveTo(6, 6, 12, 4, 20, 6); ctx.bezierCurveTo(30, 10, 40, 6, 54, 8); ctx.bezierCurveTo(44, -10, 18, -14, 0, -6);
  fillStroke(ctx, HAIR_W, OUT, 4);
  ctx.restore();
  ctx.restore();
}

function wMouth(ctx, t, type, y, o) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
  const talk = o.talking ? Math.abs(Math.sin(t * 15)) : 0;
  if (type === 'talk' || (o.talking && type !== 'scream')) { ell(ctx, 0, y + 2, 20, 4 + talk * 12); fillStroke(ctx, '#7a2230', OUT, 4); return; }
  switch (type) {
    case 'flat': ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(18, y); ctx.stroke(); break;
    case 'smile': ctx.beginPath(); ctx.moveTo(-24, y - 4); ctx.quadraticCurveTo(0, y + 18, 24, y - 4); ctx.closePath(); fillStroke(ctx, '#7a2230', OUT, 4); break;
    case 'smirk': ctx.beginPath(); ctx.moveTo(-18, y + 2); ctx.quadraticCurveTo(6, y + 8, 22, y - 6); ctx.stroke(); break;
    case 'frown': ctx.beginPath(); ctx.moveTo(-20, y + 8); ctx.quadraticCurveTo(0, y - 6, 20, y + 8); ctx.stroke(); break;
    case 'wavy': ctx.beginPath(); ctx.moveTo(-20, y); for (let x = -20; x <= 20; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.4 + t * 12) * 3); ctx.stroke(); break;
    case 'O': ell(ctx, 0, y + 6, 15, 20); fillStroke(ctx, '#7a2230', OUT, 4); break;
    case 'scream': ell(ctx, 0, y + 12, 24, 32 + Math.sin(t * 40) * 2); fillStroke(ctx, '#5a1622', OUT, 5); ell(ctx, 0, y + 30, 13, 8); ctx.fillStyle = '#ff8fa0'; ctx.fill(); break;
    case 'grimace': rr(ctx, -24, y - 8, 48, 18, 8); fillStroke(ctx, '#fff', OUT, 4); ctx.beginPath(); ctx.moveTo(-24, y + 1); ctx.lineTo(24, y + 1); ctx.lineWidth = 2.5; ctx.stroke(); break;
  }
}

function drawWalt(ctx, t, o) {
  const s0 = o.s || 1;
  ctx.save();
  const urg = o.shake || 0;
  const jx = urg > 0 ? (Math.sin(t * 71) * 3 + noise(t * 30) * 3) * urg : 0;
  ctx.translate(o.x + jx, o.y);
  ctx.scale(s0 * (o.facing || 1), s0);
  // soft ground shadow
  const sg = ctx.createRadialGradient(0, -6, 10, 0, -6, 140); sg.addColorStop(0, 'rgba(0,0,0,0.28)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ell(ctx, 0, -6, 140, 24); ctx.fill();
  ctx.rotate(o.lean || 0);
  ctx.translate(0, -(o.hop || 0));
  const breathe = 1 + Math.sin(t * 2.0 + (o.seed || 0)) * 0.01;
  const sy = breathe * (1 + (o.squash || 0)), sx = 1 / sy;
  ctx.scale(sx, sy);
  // cane (behind left hand)
  const pose = o.pose ? (typeof o.pose === 'string' ? WPOSES[o.pose] : o.pose) : WPOSES.idle;
  if (o.cane) {
    const hx = pose.L[0] - 6, hy = pose.L[1];
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 10, -6); ctx.lineWidth = 14; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#8a5a32'; ctx.stroke();
    ctx.beginPath(); ctx.arc(hx + 14, hy, 16, Math.PI, Math.PI * 2); ctx.lineWidth = 14; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#8a5a32'; ctx.stroke();
  }
  const hip = o.hipSway || 0;
  ctx.save(); ctx.translate(hip, 0); wLegs(ctx, t, o); ctx.restore();
  const kneel = o.legs === 'kneel' ? 70 : o.legs === 'sit' ? 40 : 0;
  const bob = (o.legs === 'walk' || o.legs === 'run') ? -Math.abs(Math.sin(o.walkPhase || 0)) * 8 : 0;
  ctx.translate(hip * 0.6, kneel + bob);
  ctx.rotate(hip * 0.002);
  wTorso(ctx, t, o);
  wHead(ctx, t, o);
  const oo = Object.assign({ t }, o);
  wArm(ctx, -1, [-82, -340], pose.L, oo);
  wArm(ctx, 1, [82, -340], pose.R, oo);
  if (o.sweat) {
    for (let i = 0; i < 2; i++) { const ph = (t * 0.9 + i * 0.5) % 1; ctx.globalAlpha = o.sweat * (1 - ph); sweat(ctx, (i ? 1 : -1) * 96, -560 + ph * 80, 1.1); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
