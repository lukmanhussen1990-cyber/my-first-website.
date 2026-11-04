// ---------- Walt Ep1 supporting cast + props (shaded) ----------

// Mia: teen granddaughter (front view)
function drawMia(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const skin = '#e8b48c', hair = '#3a2416';
  const sg = ctx.createRadialGradient(0, -4, 6, 0, -4, 110); sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ell(ctx, 0, -4, 110, 18); ctx.fill();
  // legs + sneakers
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 24, -170); ctx.lineTo(sd * 26, -30); ctx.lineWidth = 44; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 34; ctx.strokeStyle = '#3a4a7a'; ctx.stroke();
    ell(ctx, sd * 30, -14, 32, 15); fillStroke(ctx, '#ffffff', OUT, 5); ctx.fillStyle = '#ff6fb5'; rr(ctx, sd * 30 - 10, -26, 20, 6, 3); ctx.fill();
  }
  // hoodie
  ctx.beginPath(); ctx.moveTo(-62, -350); ctx.quadraticCurveTo(-84, -250, -76, -160); ctx.lineTo(76, -160); ctx.quadraticCurveTo(84, -250, 62, -350); ctx.closePath();
  fillStroke(ctx, lgrad(ctx, -80, -350, 80, -160, '#ff9ccc', '#e2589c'), OUT, 6);
  rr(ctx, -34, -250, 68, 40, 12); ctx.lineWidth = 4; ctx.strokeStyle = '#c94585'; ctx.stroke();
  // arms
  const pose = o.pose || 'point';
  const arm = (sx, sy, hx, hy) => { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.lineWidth = 34; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 26; ctx.strokeStyle = '#f07cb6'; ctx.stroke(); circle(ctx, hx, hy, 15); fillStroke(ctx, skin, OUT, 4); };
  if (pose === 'point') { arm(-60, -330, -100, -190); arm(60, -330, 170 + Math.sin(t * 4) * 6, -400); }
  else if (pose === 'phone') { arm(-60, -330, -30, -300); arm(60, -330, 30, -300); rr(ctx, -30, -340, 60, 44, 8); fillStroke(ctx, '#23232e', OUT, 3); }
  else { arm(-60, -330, -100, -190); arm(60, -330, 100, -190); }
  // head
  const hy = -420;
  ell(ctx, 0, hy + 10, 76, 88); ctx.fillStyle = hair; ctx.fill();
  circle(ctx, 0, hy, 66); fillStroke(ctx, rgrad(ctx, 0, hy, 66, '#f4c9a5', skin), OUT, 5);
  ctx.beginPath(); ctx.arc(0, hy - 6, 70, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(20, hy - 40, -40, hy - 30); ctx.closePath(); fillStroke(ctx, hair, OUT, 4);
  // ponytail + scrunchie
  ctx.save(); ctx.translate(58, hy - 50); ctx.rotate(0.6 + Math.sin(t * 3) * 0.08); ell(ctx, 20, 30, 22, 50); fillStroke(ctx, hair, OUT, 4); ctx.restore();
  circle(ctx, 60, hy - 52, 12); fillStroke(ctx, '#ffd23f', OUT, 3);
  simpleFace(ctx, 0, hy + 6, 66, t, { eyes: o.eyes || 'normal', mouth: o.mouth || 'smile', brow: o.brow !== undefined ? o.brow : -0.1, seed: 13 });
  ctx.fillStyle = 'rgba(255,110,130,0.35)'; ell(ctx, -40, hy + 20, 12, 7); ctx.fill(); ell(ctx, 40, hy + 20, 12, 7); ctx.fill();
  ctx.restore();
}

// Mia avatar (round) for chats
function miaAvatar(ctx, x, y, r) {
  ctx.save(); circle(ctx, x, y, r); ctx.fillStyle = '#ffd6ea'; ctx.fill(); ctx.clip();
  ell(ctx, x, y + r * 0.2, r * 0.75, r * 0.9); ctx.fillStyle = '#3a2416'; ctx.fill();
  circle(ctx, x, y + r * 0.05, r * 0.5); ctx.fillStyle = '#eab48e'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.54, Math.PI * 1.05, Math.PI * 1.95); ctx.fillStyle = '#3a2416'; ctx.fill();
  ctx.fillStyle = '#1b1b22'; circle(ctx, x - r * 0.18, y + r * 0.05, r * 0.06); ctx.fill(); circle(ctx, x + r * 0.18, y + r * 0.05, r * 0.06); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.14, 0.2, Math.PI - 0.2); ctx.lineWidth = r * 0.05; ctx.strokeStyle = '#1b1b22'; ctx.stroke();
  ell(ctx, x, y + r * 1.0, r * 0.7, r * 0.45); ctx.fillStyle = '#ff8cc6'; ctx.fill();
  ctx.restore();
}
function waltAvatar(ctx, x, y, r) {
  ctx.save(); circle(ctx, x, y, r); ctx.fillStyle = '#cfe9f5'; ctx.fill(); ctx.clip();
  ctx.translate(x, y + r * 0.95); ctx.scale(r / 120, r / 120);
  drawWalt(ctx, 0.5, { x: 0, y: 470, s: 1, pose: 'idle', expr: 'neutral', seed: 2 });
  ctx.restore();
}

// orange tabby cat (side view) — optionally carrying a tiny suitcase
function drawCat(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s);
  const fur = '#f2a13c', furD = '#c9781e';
  const walk = o.walking ? t * 12 : 0;
  // tail
  ctx.beginPath(); ctx.moveTo(-58, -60); ctx.quadraticCurveTo(-110, -90 + Math.sin(t * 6) * 10, -96, -150); ctx.lineWidth = 20; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = fur; ctx.stroke();
  // legs
  for (const [lx, ph] of [[-40, 0], [-22, Math.PI], [30, Math.PI], [48, 0]]) {
    const a = o.walking ? Math.sin(walk + ph) * 0.5 : 0;
    ctx.save(); ctx.translate(lx, -40); ctx.rotate(a); rr(ctx, -7, 0, 14, 40, 7); fillStroke(ctx, ph ? furD : fur, OUT, 3.5); ctx.restore();
  }
  // body
  ell(ctx, 0, -58, 66, 32); fillStroke(ctx, lgrad(ctx, 0, -90, 0, -26, '#f7b65a', furD), OUT, 4.5);
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 20 - 6, -88); ctx.quadraticCurveTo(i * 20, -70, i * 20 + 6, -86); ctx.lineWidth = 4; ctx.strokeStyle = furD; ctx.stroke(); }
  // head
  ctx.save(); ctx.translate(62, -86 + (o.hiss ? -8 : 0));
  for (const ex of [-22, 14]) { ctx.beginPath(); ctx.moveTo(ex, -22); ctx.lineTo(ex + 6, -50); ctx.lineTo(ex + 20, -24); ctx.closePath(); fillStroke(ctx, fur, OUT, 4); }
  ell(ctx, 0, 0, 36, 30); fillStroke(ctx, rgrad(ctx, 0, 0, 36, '#f7b65a', fur), OUT, 4.5);
  if (o.hiss) { ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-2, -4); ctx.moveTo(10, -8); ctx.lineTo(22, -4); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); ell(ctx, 10, 12, 9, 8); fillStroke(ctx, '#7a2230', OUT, 3); }
  else if (o.unimpressed) { for (const ex of [-8, 16]) { ctx.beginPath(); ctx.moveTo(ex - 6, -4); ctx.lineTo(ex + 6, -4); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); } ctx.beginPath(); ctx.moveTo(2, 14); ctx.lineTo(12, 14); ctx.stroke(); }
  else { for (const ex of [-8, 16]) { ell(ctx, ex, -4, 5, 7); ctx.fillStyle = OUT; ctx.fill(); } }
  ctx.beginPath(); ctx.moveTo(30, 4); ctx.lineTo(50, 0); ctx.moveTo(30, 10); ctx.lineTo(50, 12); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  ell(ctx, 30, 6, 4, 3); ctx.fillStyle = '#e46a8a'; ctx.fill();
  ctx.restore();
  // suitcase in mouth / hand
  if (o.suitcase) {
    ctx.save(); ctx.translate(96, -40);
    rr(ctx, -6, -40, 12, 14, 4); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    rr(ctx, -30, -28, 60, 40, 6); fillStroke(ctx, lgrad(ctx, 0, -28, 0, 12, '#c0653a', '#8a4020'), OUT, 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-26, -10, 52, 4);
    ctx.restore();
  }
  if (o.hat) { ctx.save(); ctx.translate(62, -126); rr(ctx, -26, 0, 52, 8, 4); fillStroke(ctx, '#2b2b35', OUT, 3); rr(ctx, -16, -24, 32, 26, 6); fillStroke(ctx, '#2b2b35', OUT, 3); ctx.restore(); }
  ctx.restore();
}

// grandma at a bingo table (upper body)
function drawGrandma(ctx, t, x, y, s, seed, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const skin = ['#f2c6a0', '#c68a5a', '#e9b38c', '#8d5a3b'][seed % 4];
  const hair = ['#e9e9f2', '#c7b8e8', '#d9d9d9', '#f4f4f7'][(seed + 1) % 4];
  const top = ['#e86a92', '#7ec8e3', '#b48ce0', '#f2a65a'][seed % 4];
  const bob = o.giggle ? Math.abs(Math.sin(t * 14 + seed)) * 6 : 0;
  ctx.translate(0, -bob);
  // torso
  ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-74, -110, -40, -130); ctx.lineTo(40, -130); ctx.quadraticCurveTo(74, -110, 70, 0); ctx.closePath();
  fillStroke(ctx, lgrad(ctx, -70, -130, 70, 0, top, OUT === top ? top : shadeHex(top, -40)), OUT, 5);
  for (let i = 0; i < 6; i++) { circle(ctx, -50 + i * 20, -112, 6); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
  // head + curly hair
  const hy = -190;
  for (let i = 0; i < 7; i++) { const a = Math.PI * (1.0 + i / 6); circle(ctx, Math.cos(a) * 56, hy - 6 + Math.sin(a) * 50, 22); fillStroke(ctx, hair, OUT, 4); }
  circle(ctx, 0, hy, 56); fillStroke(ctx, rgrad(ctx, 0, hy, 56, '#fde0c8', skin), OUT, 5);
  for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + i / 6.5); circle(ctx, Math.cos(a) * 50, hy - 4 + Math.sin(a) * 46, 18); ctx.fillStyle = hair; ctx.fill(); }
  // cat-eye glasses
  for (const sd of [-1, 1]) { ell(ctx, sd * 22, hy, 18, 14); ctx.fillStyle = 'rgba(220,240,255,0.4)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#b8327a'; ctx.stroke(); }
  for (const sd of [-1, 1]) { if (o.giggle) { ctx.beginPath(); ctx.arc(sd * 22, hy + 4, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke(); } else { circle(ctx, sd * 22, hy, 4.5); ctx.fillStyle = OUT; ctx.fill(); } }
  if (o.giggle) { ctx.beginPath(); ctx.arc(0, hy + 22, 13, 0.1, Math.PI - 0.1); ctx.closePath(); fillStroke(ctx, '#7a2230', OUT, 3); }
  else { ctx.beginPath(); ctx.arc(0, hy + 20, 11, 0.2, Math.PI - 0.2); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,110,130,0.45)'; ell(ctx, -36, hy + 16, 10, 6); ctx.fill(); ell(ctx, 36, hy + 16, 10, 6); ctx.fill();
  // pearl necklace
  for (let i = 0; i < 9; i++) { const a = 0.25 + i * 0.33; circle(ctx, Math.cos(a) * 30 - 0, -136 + Math.sin(a) * 10, 4); ctx.fillStyle = '#fffaf0'; ctx.fill(); }
  // dauber arm
  ctx.save(); ctx.translate(46, -40); ctx.rotate(-0.6 + (o.daub ? Math.max(0, Math.sin(t * 9 + seed)) * 0.5 : 0));
  rr(ctx, -10, -70, 20, 70, 10); fillStroke(ctx, top, OUT, 4);
  rr(ctx, -9, -100, 18, 34, 6); fillStroke(ctx, ['#ff4fa0', '#4fc3ff', '#7cfc5a', '#ffd23f'][seed % 4], OUT, 3);
  ctx.restore();
  ctx.restore();
}
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// teen running with phone up (side-ish)
function drawTeen(ctx, t, x, y, s, seed, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s);
  const hood = ['#7cfc5a', '#4fc3ff', '#ff6fb5', '#ffd23f', '#b48ce0', '#ff8a3b'][seed % 6];
  const skin = ['#f2c6a0', '#c68a5a', '#8d5a3b', '#e0ac7e'][seed % 4];
  const hair = ['#1c1c1c', '#6b4226', '#e8c26a', '#3b2416'][(seed * 3) % 4];
  const ph = t * 14 + seed;
  ctx.translate(0, -Math.abs(Math.sin(ph)) * 10);
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    const a = Math.sin(ph + (sd > 0 ? Math.PI : 0)) * 0.6;
    ctx.save(); ctx.translate(sd * 10, -120); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 110); ctx.lineWidth = 30; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 22; ctx.strokeStyle = '#2f3f6a'; ctx.stroke();
    ell(ctx, 8, 116, 22, 10); fillStroke(ctx, '#ffffff', OUT, 4);
    ctx.restore();
  }
  rr(ctx, -44, -260, 88, 150, 30); fillStroke(ctx, lgrad(ctx, 0, -260, 0, -110, hood, shadeHex(hood, -50)), OUT, 5);
  // phone arm raised forward
  ctx.beginPath(); ctx.moveTo(20, -230); ctx.lineTo(80, -290); ctx.lineWidth = 26; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 18; ctx.strokeStyle = hood; ctx.stroke();
  rr(ctx, 74, -330, 30, 50, 6); fillStroke(ctx, '#23232e', OUT, 3);
  ctx.fillStyle = Math.sin(t * 20 + seed) > 0.7 ? '#ffffff' : '#9fd3ff'; rr(ctx, 78, -325, 22, 38, 4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-20, -230); ctx.lineTo(-50, -170 + Math.sin(ph) * 20); ctx.lineWidth = 26; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 18; ctx.strokeStyle = hood; ctx.stroke();
  // head
  const hy = -305;
  circle(ctx, 0, hy, 44); fillStroke(ctx, rgrad(ctx, 0, hy, 44, '#fbe0c8', skin), OUT, 5);
  if (seed % 2) { ctx.beginPath(); ctx.arc(0, hy - 6, 46, Math.PI, Math.PI * 2); ctx.closePath(); fillStroke(ctx, hood, OUT, 4); rr(ctx, 0, hy - 16, 60, 12, 6); fillStroke(ctx, hood, OUT, 3); }
  else { ctx.beginPath(); ctx.arc(0, hy - 8, 46, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); fillStroke(ctx, hair, OUT, 4); }
  circle(ctx, 16, hy + 2, 5); ctx.fillStyle = OUT; ctx.fill(); circle(ctx, 34, hy + 2, 5); ctx.fill();
  ell(ctx, 26, hy + 22, 9, 10); fillStroke(ctx, '#7a2230', OUT, 3);
  ctx.restore();
}

// red mobility scooter (side view) — Walt sits on it
function drawScooter(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s);
  const spin = t * 20;
  for (const wx of [-90, 90]) {
    circle(ctx, wx, -34, 34); fillStroke(ctx, '#23232e', OUT, 5); circle(ctx, wx, -34, 14); ctx.fillStyle = '#c9d1dc'; ctx.fill();
    ctx.save(); ctx.translate(wx, -34); ctx.rotate(spin); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore();
  }
  rr(ctx, -130, -100, 260, 50, 22); fillStroke(ctx, lgrad(ctx, 0, -100, 0, -50, '#ff5a4a', '#b8261a'), OUT, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; rr(ctx, -110, -94, 160, 10, 5); ctx.fill();
  // steering column + basket
  ctx.beginPath(); ctx.moveTo(110, -90); ctx.lineTo(130, -230); ctx.lineWidth = 14; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#c9d1dc'; ctx.stroke();
  rr(ctx, 100, -246, 70, 18, 8); fillStroke(ctx, '#23232e', OUT, 4);
  rr(ctx, 130, -200, 74, 50, 6); fillStroke(ctx, '#d9b382', OUT, 4);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(140 + i * 16, -200); ctx.lineTo(140 + i * 16, -150); ctx.lineWidth = 2; ctx.strokeStyle = '#9a7650'; ctx.stroke(); }
  // flag
  ctx.beginPath(); ctx.moveTo(-120, -100); ctx.lineTo(-120, -300); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-120, -300); ctx.lineTo(-70 + Math.sin(t * 20) * 6, -284); ctx.lineTo(-120, -268); ctx.closePath(); fillStroke(ctx, '#ffd23f', OUT, 3);
  // seat
  rr(ctx, -90, -170, 100, 70, 18); fillStroke(ctx, '#2b2b35', OUT, 5);
  rr(ctx, -110, -250, 34, 110, 14); fillStroke(ctx, '#2b2b35', OUT, 5);
  ctx.restore();
}

// generic blue street mailbox (no branding)
function drawMailbox(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(ctx, -50, -60, 24, 60, 4); fillStroke(ctx, '#2a4f8f', OUT, 4); rr(ctx, 26, -60, 24, 60, 4); fillStroke(ctx, '#2a4f8f', OUT, 4);
  ctx.beginPath(); ctx.moveTo(-80, -60); ctx.lineTo(-80, -230); ctx.arc(0, -230, 80, Math.PI, 0); ctx.lineTo(80, -60); ctx.closePath();
  fillStroke(ctx, lgrad(ctx, -80, -300, 80, -60, '#4f86d9', '#244a8a'), OUT, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, -66, -280, 20, 200, 10); ctx.fill();
  const flap = o.flap || 0;
  ctx.save(); ctx.translate(0, -250); ctx.rotate(-flap * 0.7);
  rr(ctx, -50, -12, 100, 24, 6); fillStroke(ctx, '#d9dde6', OUT, 4); ctx.restore();
  rr(ctx, -46, -190, 92, 40, 6); fillStroke(ctx, '#fff', OUT, 4);
  boldText(ctx, 'MAIL', 0, -169, 30, '#2a4f8f', { stroke: 0, shadow: false });
  ctx.restore();
}

// front-camera "nostril cam" close-up (screen-space, fills frame)
function drawNostrilCam(ctx, t, k, scream) {
  ctx.save();
  // ceiling + fan
  ctx.fillStyle = '#f3e7d3'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(360, 210); ctx.rotate(t * 3);
  for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); rr(ctx, 10, -18, 190, 36, 16); fillStroke(ctx, '#8a5a32', OUT, 5); }
  ctx.restore(); circle(ctx, 360, 210, 30); fillStroke(ctx, '#d4a73b', OUT, 5);
  // giant face from below
  const sh = scream ? Math.sin(t * 60) * 8 : 0;
  ctx.translate(360 + sh, 980 + k * 60); const s = 2.3 + k * 0.6; ctx.scale(s, s);
  ell(ctx, 0, 0, 160, 200); fillStroke(ctx, rgrad(ctx, 0, 40, 200, W_SKIN_L, W_SKIN_D), OUT, 4);
  // chins
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 60 + i * 34, 120 - i * 18, 0.25 * Math.PI, 0.75 * Math.PI); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(150,90,60,0.6)'; ctx.stroke(); }
  // mustache + mouth
  if (scream) { ell(ctx, 0, 70, 50, 60); fillStroke(ctx, '#5a1622', OUT, 4); ell(ctx, 0, 110, 28, 16); ctx.fillStyle = '#ff8fa0'; ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-34, 70); ctx.quadraticCurveTo(0, 84, 34, 70); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-90, 40); ctx.quadraticCurveTo(0, 0, 90, 40); ctx.quadraticCurveTo(0, 30, -90, 40); fillStroke(ctx, HAIR_W, OUT, 3);
  // big nose from below with nostrils
  ell(ctx, 0, -40, 70, 54); fillStroke(ctx, rgrad(ctx, 0, -40, 70, '#f7c4a4', '#d98a6a'), OUT, 4);
  for (const sd of [-1, 1]) { ell(ctx, sd * 28, -30, 18 + (scream ? 6 : 0), 24 + (scream ? 8 : 0), sd * 0.3); ctx.fillStyle = '#3a1a10'; ctx.fill(); }
  // nose hairs
  ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 1.5;
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sd * 28 + (i - 1.5) * 6, -10); ctx.lineTo(sd * 28 + (i - 1.5) * 8, 2); ctx.stroke(); }
  // glasses far up + eyes tiny from below
  for (const sd of [-1, 1]) { ell(ctx, sd * 60, -150, 44, 20); ctx.fillStyle = 'rgba(210,235,255,0.4)'; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = '#7a4a22'; ctx.stroke(); ell(ctx, sd * 60, -150, 14, scream ? 10 : 6); ctx.fillStyle = OUT; ctx.fill(); }
  ctx.restore();
  // camera UI
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 1110, W, 170); ctx.fillRect(0, 0, W, 120);
  circle(ctx, 360, 1195, 52); ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke(); circle(ctx, 360, 1195, 40); ctx.fillStyle = '#fff'; ctx.fill();
  rr(ctx, 560, 1170, 60, 50, 10); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
  circle(ctx, 120, 1195, 28); ctx.fillStyle = '#c9d1dc'; ctx.fill();
  boldText(ctx, 'PHOTO', 360, 1112, 22, '#ffd23f', { stroke: 0, shadow: false });
  ctx.restore();
  // edge vignette (lens)
  const v = ctx.createRadialGradient(360, 640, 300, 360, 640, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// social profile screen inside a phone frame
function phoneFrame(ctx, t, fn, o = {}) {
  const pw = 450, ph = 800, px = 360 - pw / 2, py = 262;
  ctx.save();
  rr(ctx, px - 6, py + 16, pw + 12, ph, 62); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  rr(ctx, px - 14, py - 14, pw + 28, ph + 28, 66); ctx.fillStyle = '#16151c'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#3a3846'; ctx.stroke();
  rr(ctx, px, py, pw, ph, 52); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.save(); rr(ctx, px, py, pw, ph, 52); ctx.clip(); fn(px, py, pw, ph); ctx.restore();
  rr(ctx, 360 - 62, py + 14, 124, 30, 15); ctx.fillStyle = '#16151c'; ctx.fill();
  ctx.restore();
}
function drawProfile(ctx, t, o) {
  phoneFrame(ctx, t, (px, py, pw, ph) => {
    ctx.fillStyle = '#f3f3f7'; ctx.fillRect(px, py, pw, ph);
    waltAvatar(ctx, px + 90, py + 150, 58);
    circle(ctx, px + 90, py + 150, 58); ctx.lineWidth = 5; ctx.strokeStyle = '#ff3f97'; ctx.stroke();
    plainText(ctx, '@walt.81', px + 168, py + 136, 30, '#111', { weight: 800 });
    plainText(ctx, 'Retired · Likes soup', px + 168, py + 170, 19, '#666', { weight: 600 });
    const fk = o.pulse || 0;
    ctx.save(); ctx.translate(px + 225, py + 262); ctx.scale(1 + fk * 0.15, 1 + fk * 0.15);
    boldText(ctx, '3', -90, 0, 52, '#111', { stroke: 0, shadow: false }); plainText(ctx, 'followers', -122, 34, 18, '#666', { weight: 700 });
    boldText(ctx, '0', 90, 0, 52, '#111', { stroke: 0, shadow: false }); plainText(ctx, 'posts', 66, 34, 18, '#666', { weight: 700 });
    ctx.restore();
    plainText(ctx, 'FOLLOWERS', px + 30, py + 352, 18, '#999', { weight: 800 });
    const rows = [['Dr. Patel', 'Cardiology', '#5fa8d3', true], ['Dr. Kim', 'Knees & Hips', '#7ccf9a', true], ['Mia ✨', 'granddaughter', '#ff8cc6', false]];
    rows.forEach(([n, sub, c, doc], i) => {
      const y = py + 400 + i * 104, k = popScale(t, (o.rowT || 0) + i * 0.18, 0.25);
      if (k <= 0) return;
      ctx.save(); ctx.translate(px + 30, y); ctx.scale(1, k);
      rr(ctx, 0, -40, pw - 60, 88, 20); ctx.fillStyle = '#fff'; ctx.fill();
      if (n.startsWith('Mia')) miaAvatar(ctx, 46, 4, 32); else { circle(ctx, 46, 4, 32); ctx.fillStyle = c; ctx.fill(); ctx.beginPath(); ctx.arc(46, 34, 16, Math.PI, 0); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); plainText(ctx, '🩺', 30, 14, 30, '#fff'); }
      plainText(ctx, n, 92, 0, 24, '#111', { weight: 800 }); plainText(ctx, sub, 92, 28, 17, '#777', { weight: 600 });
      ctx.restore();
      if (doc && o.stampT && t > o.stampT + i * 0.25) stamp(ctx, 'DOCTOR', px + pw - 110, y + 2, 26, t, o.stampT + i * 0.25, '#e23b3b', -0.15);
    });
  });
}

// comments / reactions floating up
function floatComments(ctx, t, t0, items, x, y, o = {}) {
  items.forEach((c, i) => {
    const st = t0 + i * (o.gap || 0.45); if (t < st) return;
    const k = P(t, st, o.life || 2.4); if (k >= 1) return;
    const yy = y - k * (o.rise || 360), a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + (i % 2 ? 20 : -10), yy); ctx.scale(o.s || 1, o.s || 1);
    ctx.font = '700 24px Inter, "Noto Color Emoji"'; const w = ctx.measureText(c).width + 70;
    rr(ctx, -10, -26, w, 50, 25); ctx.fillStyle = 'rgba(20,20,30,0.75)'; ctx.fill();
    circle(ctx, 16, -1, 15); ctx.fillStyle = ['#ff6fb5', '#4fc3ff', '#7cfc5a', '#ffd23f', '#b48ce0'][i % 5]; ctx.fill();
    plainText(ctx, c, 40, 8, 24, '#fff', { weight: 700 });
    ctx.restore();
  });
}

// floating hearts
function hearts(ctx, t, t0, n, x, y) {
  for (let i = 0; i < n; i++) {
    const st = t0 + i * 0.06; if (t < st) continue;
    const k = P(t, st, 1.4); if (k >= 1) continue;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(x + Math.sin(i * 2.1 + k * 6) * 60 * k + (hash(i) - 0.5) * 80, y - k * 420);
    ctx.font = `${30 + hash(i + 3) * 30}px "Noto Color Emoji"`; ctx.textAlign = 'center'; ctx.fillText(i % 5 === 4 ? '🔥' : '❤️', 0, 0); ctx.restore();
  }
}
