// ---------- backgrounds (world space, frame = 0..720 x 0..1280 at zoom 1) ----------

function storeSign(ctx, text, bg, fg = '#fff', y = 0) {
  ctx.fillStyle = bg; ctx.fillRect(-1200, y - 400, 3600, 510);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-1200, y + 100, 3600, 10);
  boldText(ctx, text, 360, y + 62, 46, fg, { stroke: 0, shadow: true });
}

// ----- Larry's bedroom -----
function bgRoom(ctx, t, o = {}) {
  ctx.fillStyle = '#23275a'; ctx.fillRect(-800, -400, 2400, 1700);
  ctx.fillStyle = '#292e68';
  for (let x = -800; x < 1600; x += 64) ctx.fillRect(x, -400, 30, 1700);
  // window (night)
  rr(ctx, 20, 250, 190, 190, 10); fillStroke(ctx, '#0e1030', OUT, 8);
  for (let i = 0; i < 14; i++) { const sx = 36 + hash(i) * 160, sy = 266 + hash(i + 9) * 160; const tw = 0.5 + 0.5 * Math.sin(t * 3 + i); circle(ctx, sx, sy, 1.5 + tw * 1.5); ctx.fillStyle = '#fff'; ctx.fill(); }
  circle(ctx, 170, 290, 20); ctx.fillStyle = '#ffe9a8'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(115, 250); ctx.lineTo(115, 440); ctx.moveTo(20, 345); ctx.lineTo(210, 345); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke();
  // poster
  rr(ctx, 560, 230, 120, 150, 6); fillStroke(ctx, '#d63a6b', OUT, 6);
  ctx.beginPath(); ctx.moveTo(620, 250); ctx.lineTo(655, 350); ctx.lineTo(585, 350); ctx.closePath(); fillStroke(ctx, '#ffc93c', OUT, 5);
  // sister photo frame
  ctx.save(); ctx.translate(118, 560); ctx.rotate(-0.05);
  rr(ctx, -62, -50, 124, 100, 6); fillStroke(ctx, '#ff9ec4', OUT, 6);
  rr(ctx, -48, -38, 96, 76, 4); ctx.fillStyle = '#fff4f8'; ctx.fill();
  circle(ctx, 0, -6, 15); fillStroke(ctx, '#f2c6a0', OUT, 3);
  ctx.beginPath(); ctx.moveTo(-14, -20); ctx.quadraticCurveTo(-30, 10, -26, 34); ctx.lineTo(26, 34); ctx.quadraticCurveTo(30, 10, 14, -20); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#c9cbd6'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-16, 36); ctx.lineTo(-20, 10); ctx.lineTo(20, 10); ctx.lineTo(16, 36); ctx.fillStyle = '#fff'; ctx.fill();
  boldText(ctx, 'SIS', 0, 62, 20, '#fff', { stroke: 4 });
  ctx.restore();
  if (o.photoGlow) { ctx.save(); ctx.globalAlpha = o.photoGlow; for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; boldText(ctx, '♥', 118 + Math.cos(a) * 95, 560 + Math.sin(a) * 70, 30, '#ff4f9a', { stroke: 4, font: 'DejaVu Sans' }); } ctx.restore(); }
  // calendar
  drawCalendar(ctx, t, 600, 470, 0.8, { crossed: 7, circle: 17, title: 'WEDDING' });
  // desk + monitor (right)
  ctx.fillStyle = '#5b3d2e'; ctx.fillRect(470, 760, 400, 26); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.strokeRect(470, 760, 400, 26);
  ctx.fillRect(500, 786, 18, 140); ctx.fillRect(820, 786, 18, 140);
  rr(ctx, 500, 590, 230, 150, 10); fillStroke(ctx, '#151726', OUT, 7);
  rr(ctx, 512, 602, 206, 126, 4); ctx.fillStyle = '#4fc3f7'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(512, 728); ctx.lineTo(570, 650); ctx.lineTo(620, 700); ctx.lineTo(670, 640); ctx.lineTo(718, 728); ctx.closePath(); ctx.fillStyle = '#43c26b'; ctx.fill();
  ctx.fillStyle = '#151726'; ctx.fillRect(600, 740, 30, 22);
  // RGB strip
  for (let i = 0; i < 12; i++) { ctx.fillStyle = `hsl(${(i * 30 + t * 120) % 360},90%,60%)`; ctx.fillRect(472 + i * 33, 786, 30, 6); }
  // gamer chair (left)
  rr(ctx, -70, 660, 150, 260, 30); fillStroke(ctx, '#2b2f45', OUT, 7);
  rr(ctx, -40, 700, 90, 170, 20); ctx.fillStyle = '#e23b3b'; ctx.fill();
  // floor
  ctx.fillStyle = '#4b3934'; ctx.fillRect(-800, 900, 2400, 600);
  ctx.fillStyle = '#3e2f2b'; ctx.fillRect(-800, 900, 2400, 14);
  // mess
  const mess = [[60, 1150, '#ffc93c'], [640, 1180, '#43c26b'], [120, 1230, '#e23b3b'], [560, 1100, '#ffc93c'], [690, 1250, '#4fc3f7'], [30, 1060, '#43c26b'], [610, 1020, '#e23b3b']];
  mess.forEach(([x, y, c], i) => { ctx.save(); ctx.translate(x, y); ctx.rotate(i); ctx.fillStyle = c; ctx.fillRect(-6, -9, 12, 18); ctx.restore(); });
  // chip bag (generic)
  ctx.save(); ctx.translate(110, 1010); ctx.rotate(-0.3);
  ctx.beginPath(); ctx.moveTo(-40, -50); ctx.lineTo(40, -50); ctx.lineTo(46, 50); ctx.lineTo(-46, 50); ctx.closePath(); fillStroke(ctx, '#ff7a1a', OUT, 5);
  boldText(ctx, 'CHIPS', 0, 0, 22, '#fff', { stroke: 4 }); ctx.restore();
  // cans
  for (const [x, y, r] of [[600, 1060, 0.2], [660, 1090, 1.4]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); rr(ctx, -16, -30, 32, 60, 8); fillStroke(ctx, '#3ccf7a', OUT, 4); ctx.fillStyle = '#1b1b22'; ctx.fillRect(-16, -6, 32, 10); ctx.restore(); }
  // pizza box
  ctx.save(); ctx.translate(570, 1210); ctx.rotate(0.08); rr(ctx, -80, -24, 160, 48, 6); fillStroke(ctx, '#d9b382', OUT, 5); ctx.restore();
}

// ----- phone backdrop -----
function bgPhone(ctx, t, tint = '#2a0f3d') {
  const g = ctx.createRadialGradient(360, 640, 60, 360, 640, 820);
  g.addColorStop(0, '#6b2a8f'); g.addColorStop(0.55, tint); g.addColorStop(1, '#0b0512');
  ctx.fillStyle = g; ctx.fillRect(-300, -300, W + 600, H + 600);
  ctx.save(); ctx.globalAlpha = 0.07; ctx.translate(360, 640); ctx.rotate(t * 0.1);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -120); ctx.lineTo(1400, 120); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.12;
  for (let i = 0; i < 9; i++) { const y = ((hash(i) * 1280 - t * 40 * (0.5 + hash(i + 3))) % 1400 + 1400) % 1400 - 60; poopIcon(ctx, 40 + hash(i + 7) * 640, y, 0.8 + hash(i + 2) * 0.6, true); }
  ctx.restore();
}

// ----- bridal shop (wide: x -100..1700) -----
function bgDress(ctx, t, o = {}) {
  ctx.fillStyle = '#ffdbe6'; ctx.fillRect(-900, -300, 3400, 1600);
  ctx.fillStyle = '#ffd0de';
  for (let x = -900; x < 2500; x += 90) ctx.fillRect(x, 120, 40, 800);
  // wainscoting
  ctx.fillStyle = '#f6b7cb'; ctx.fillRect(-900, 640, 3400, 270);
  ctx.strokeStyle = '#d98aa6'; ctx.lineWidth = 4;
  for (let x = -880; x < 2500; x += 160) { rr(ctx, x, 664, 130, 216, 10); ctx.stroke(); }
  ctx.fillStyle = '#e48fae'; ctx.fillRect(-900, 636, 3400, 12);
  // chandelier
  for (const cx of [240, 1080]) {
    ctx.beginPath(); ctx.moveTo(cx, 110); ctx.lineTo(cx, 250); ctx.lineWidth = 4; ctx.strokeStyle = '#b8902f'; ctx.stroke();
    ell(ctx, cx, 270, 80, 22); fillStroke(ctx, '#ffd36b', OUT, 4);
    for (let i = -2; i <= 2; i++) { circle(ctx, cx + i * 32, 300, 8 + Math.sin(t * 4 + i) * 1.2); ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#b8902f'; ctx.stroke(); }
  }
  // mirror
  rr(ctx, 860, 330, 170, 290, 80); fillStroke(ctx, '#e6f3ff', '#d4a73b', 10);
  ctx.beginPath(); ctx.moveTo(900, 400); ctx.lineTo(960, 360); ctx.moveTo(910, 450); ctx.lineTo(990, 395); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  // floor checker
  for (let r = 0; r < 15; r++) for (let c = -12; c < 30; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#fff0f5' : '#f3c2d3';
    ctx.fillRect(c * 70, 910 + r * 60, 70, 60);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-900, 910, 3400, 10);
  // pedestal + gown at x=150
  drawGown(ctx, t, 120, 900, 0.95, o.gownGlow || 0);
  // fitting room door at x 520..700
  rr(ctx, 500, 330, 210, 580, 8); fillStroke(ctx, '#b57a5e', OUT, 7);
  rr(ctx, 520, 350, 170, 250, 6); ctx.lineWidth = 4; ctx.strokeStyle = '#8f5b44'; ctx.stroke();
  rr(ctx, 520, 630, 170, 250, 6); ctx.stroke();
  const rattle = o.rattle ? Math.sin(t * 60) * 4 : 0;
  circle(ctx, 680, 640 + rattle, 13); fillStroke(ctx, '#ffd36b', OUT, 4);
  rr(ctx, 520, 270, 170, 46, 8); fillStroke(ctx, '#fff', OUT, 5);
  boldText(ctx, 'FITTING ROOM', 605, 294, 26, '#d63a6b', { stroke: 0, shadow: false });
  const blink = o.occupied ? (Math.sin(t * 10) > 0 ? 1 : 0.55) : 0.4;
  rr(ctx, 545, 400, 120, 40, 8); ctx.fillStyle = `rgba(226,59,59,${blink})`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  boldText(ctx, 'OCCUPIED', 605, 421, 22, '#fff', { stroke: 0, shadow: false });
  // store sign
  storeSign(ctx, 'VEIL & GRACE BRIDAL', '#e85d8f');
}

// ----- bakery -----
function bgBakery(ctx, t, o = {}) {
  ctx.fillStyle = '#dff6ec'; ctx.fillRect(-900, -300, 2600, 1600);
  ctx.fillStyle = '#cdeee0'; for (let x = -900; x < 1700; x += 80) ctx.fillRect(x, 110, 36, 900);
  // awning scallops
  for (let x = -40; x < 800; x += 80) { ctx.beginPath(); ctx.arc(x + 40, 112, 40, 0, Math.PI); ctx.fillStyle = (x / 80) % 2 ? '#ff9ec4' : '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); }
  // shelves
  for (const sy of [380, 560]) {
    ctx.fillStyle = '#c88f5a'; ctx.fillRect(-100, sy, 920, 18); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.strokeRect(-100, sy, 920, 18);
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 95;
      if ((i + sy / 10) % 3 < 1.5) { // cupcake
        ctx.beginPath(); ctx.moveTo(x - 22, sy - 34); ctx.lineTo(x + 22, sy - 34); ctx.lineTo(x + 16, sy); ctx.lineTo(x - 16, sy); ctx.closePath(); fillStroke(ctx, '#f7a35c', OUT, 3);
        ell(ctx, x, sy - 42, 26, 16); fillStroke(ctx, ['#ffc2d1', '#bde0fe', '#fff1a8'][i % 3], OUT, 3); circle(ctx, x, sy - 60, 6); ctx.fillStyle = '#e23b3b'; ctx.fill();
      } else { ell(ctx, x, sy - 22, 40, 22); fillStroke(ctx, '#d9a25c', OUT, 3); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * 16 - 6, sy - 34); ctx.lineTo(x + k * 16 + 6, sy - 14); ctx.lineWidth = 3; ctx.strokeStyle = '#a8732f'; ctx.stroke(); } }
    }
  }
  // floor
  ctx.fillStyle = '#f2e3cf'; ctx.fillRect(-900, 900, 2600, 600);
  for (let x = -900; x < 1700; x += 90) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(x, 900, 45, 600); }
  storeSign(ctx, 'SWEET TIERS BAKERY', '#2fb58f');
}
function bakeryCounter(ctx, t, o = {}) {
  rr(ctx, 380, 820, 520, 300, 14); fillStroke(ctx, '#ffffff', OUT, 7);
  ctx.fillStyle = '#ff9ec4'; for (let x = 396; x < 890; x += 60) ctx.fillRect(x, 840, 30, 260);
  rr(ctx, 360, 800, 560, 36, 10); fillStroke(ctx, '#f7d9e3', OUT, 6);
}

// ----- church -----
function bgChurch(ctx, t, o = {}) {
  ctx.fillStyle = '#efe2c8'; ctx.fillRect(-900, -300, 2600, 1600);
  ctx.fillStyle = '#e6d6b8'; for (let y = 120; y < 900; y += 54) for (let x = -900 + ((y / 54) % 2) * 60; x < 1700; x += 120) { ctx.fillRect(x, y, 112, 48); }
  // ceiling arches
  ctx.fillStyle = '#6b4a35'; ctx.fillRect(-900, -300, 2600, 360);
  for (let x = -60; x < 900; x += 260) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.quadraticCurveTo(x + 130, 260, x + 260, 60); ctx.lineWidth = 16; ctx.strokeStyle = '#6b4a35'; ctx.stroke(); }
  // stained glass windows
  for (const wx of [90, 630]) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(wx - 70, 640); ctx.lineTo(wx - 70, 330); ctx.quadraticCurveTo(wx, 230, wx + 70, 330); ctx.lineTo(wx + 70, 640); ctx.closePath();
    ctx.fillStyle = '#2b2b35'; ctx.fill(); ctx.clip();
    const cols = ['#e23b3b', '#3b82e2', '#ffc93c', '#43c26b', '#a35be2', '#ff8a3b'];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = cols[(r * 4 + c * 3 + (wx > 300 ? 2 : 0)) % 6]; ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 2 + r + c); ctx.fillRect(wx - 70 + c * 35 + 3, 240 + r * 45 + 3, 29, 39); }
    ctx.restore(); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(wx - 70, 640); ctx.lineTo(wx - 70, 330); ctx.quadraticCurveTo(wx, 230, wx + 70, 330); ctx.lineTo(wx + 70, 640); ctx.closePath(); ctx.stroke();
    // light ray
    ctx.save(); ctx.globalAlpha = 0.16 + 0.04 * Math.sin(t * 1.5); ctx.fillStyle = '#fff7d6';
    ctx.beginPath(); ctx.moveTo(wx - 70, 400); ctx.lineTo(wx + 70, 380); ctx.lineTo(wx + (wx < 300 ? 320 : -320) + 120, 1100); ctx.lineTo(wx + (wx < 300 ? 320 : -320) - 120, 1100); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // altar arch at back center
  ctx.beginPath(); ctx.moveTo(250, 860); ctx.lineTo(250, 520); ctx.quadraticCurveTo(360, 380, 470, 520); ctx.lineTo(470, 860); ctx.closePath(); fillStroke(ctx, '#d9c3a0', OUT, 6);
  rr(ctx, 280, 760, 160, 100, 6); fillStroke(ctx, '#fff', OUT, 5); ctx.fillStyle = '#d4a73b'; ctx.fillRect(280, 790, 160, 12);
  for (const cx of [300, 420]) { rr(ctx, cx - 7, 710, 14, 50, 4); fillStroke(ctx, '#fff8e0', OUT, 3); ell(ctx, cx, 700 + Math.sin(t * 12 + cx) * 1.5, 6, 11); ctx.fillStyle = '#ffb02e'; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(360, 560); ctx.lineTo(360, 700); ctx.moveTo(320, 600); ctx.lineTo(400, 600); ctx.lineWidth = 12; ctx.strokeStyle = '#d4a73b'; ctx.lineCap = 'round'; ctx.stroke();
  // floor + carpet
  ctx.fillStyle = '#c9b48f'; ctx.fillRect(-900, 860, 2600, 600);
  ctx.beginPath(); ctx.moveTo(320, 860); ctx.lineTo(400, 860); ctx.lineTo(560, 1300); ctx.lineTo(160, 1300); ctx.closePath(); ctx.fillStyle = '#b8323c'; ctx.fill();
  // flower arrangements
  for (const fx of [200, 520]) { for (let i = 0; i < 6; i++) { circle(ctx, fx + Math.cos(i) * 22, 830 + Math.sin(i * 2) * 14, 12); ctx.fillStyle = i % 2 ? '#fff' : '#ffc2d1'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); } }
}
function churchPews(ctx, t) {
  for (const [x, y, w] of [[-120, 1080, 300], [540, 1080, 300], [-160, 1190, 330], [560, 1190, 330]]) {
    rr(ctx, x, y - 80, w, 60, 10); fillStroke(ctx, '#8a5a3b', OUT, 6);
    rr(ctx, x, y - 20, w, 110, 6); fillStroke(ctx, '#6e452c', OUT, 6);
  }
}

// ----- church restroom -----
function bgRestroom(ctx, t, o = {}) {
  ctx.fillStyle = '#cfe9f5'; ctx.fillRect(-900, -300, 2600, 1600);
  ctx.strokeStyle = '#b4d7e8'; ctx.lineWidth = 3;
  for (let y = 0; y < 920; y += 50) { ctx.beginPath(); ctx.moveTo(-900, y); ctx.lineTo(1700, y); ctx.stroke(); }
  for (let x = -900; x < 1700; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 920); ctx.stroke(); }
  ctx.fillStyle = '#9fb3bf'; ctx.fillRect(-900, 920, 2600, 600);
  for (let x = -900; x < 1700; x += 80) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 920, 40, 600); }
  // entrance door on right (opens)
  const op = o.doorOpen || 0;
  ctx.fillStyle = '#fff6d6'; ctx.fillRect(500, 330, 200, 590);
  if (op > 0) { ctx.save(); ctx.globalAlpha = op * 0.6; ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.moveTo(500, 330); ctx.lineTo(700, 330); ctx.lineTo(760, 1100); ctx.lineTo(300, 1100); ctx.closePath(); ctx.fill(); ctx.restore(); }
  if (o.drawPriest) o.drawPriest();
  ctx.save(); ctx.translate(700, 0); ctx.scale(1 - op * 0.85, 1);
  rr(ctx, -200, 330, 200, 590, 4); fillStroke(ctx, '#7aa0b8', OUT, 7);
  circle(ctx, -170, 640, 12); fillStroke(ctx, '#d9d9e0', OUT, 4);
  ctx.restore();
  ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.strokeRect(500, 330, 200, 590);
  // stall on left
  rr(ctx, -40, 250, 470, 30, 6); fillStroke(ctx, '#9cc5a8', OUT, 6);
  rr(ctx, 30, 280, 360, 560, 6); fillStroke(ctx, '#b7dcc1', OUT, 7);
  rr(ctx, 310, 520, 50, 26, 6); fillStroke(ctx, '#fff', OUT, 4);
  ctx.fillStyle = '#e23b3b'; rr(ctx, 316, 526, 38, 14, 4); ctx.fill();
  rr(ctx, -40, 280, 70, 640, 4); fillStroke(ctx, '#9cc5a8', OUT, 6);
  rr(ctx, 390, 280, 60, 640, 4); fillStroke(ctx, '#9cc5a8', OUT, 6);
  // sign
  rr(ctx, 120, 330, 180, 60, 10); fillStroke(ctx, '#fff', OUT, 5);
  boldText(ctx, 'PLEASE KNOCK', 210, 361, 26, '#3b82e2', { stroke: 0, shadow: false });
}
// feet & pants under the stall door
function stallFeet(ctx, t, shake = 0) {
  const j = Math.sin(t * 50) * 3 * shake;
  ctx.save(); ctx.translate(210 + j, 905);
  ctx.beginPath(); ctx.moveTo(-90, -20); ctx.quadraticCurveTo(-60, -60, 0, -50); ctx.quadraticCurveTo(60, -60, 90, -20); ctx.lineTo(80, 4); ctx.lineTo(-80, 4); ctx.closePath(); fillStroke(ctx, PANTS, OUT, 5);
  ctx.beginPath(); ctx.moveTo(-60, -30); ctx.quadraticCurveTo(-30, -14, -6, -30); ctx.moveTo(10, -32); ctx.quadraticCurveTo(40, -16, 64, -30); ctx.lineWidth = 3; ctx.strokeStyle = PANTS_D; ctx.stroke();
  for (const sd of [-1, 1]) { ell(ctx, sd * 58, 6, 38, 17); fillStroke(ctx, '#f4f4f4', OUT, 5); ctx.fillStyle = '#e23b3b'; rr(ctx, sd * 58 - 10, -9, 20, 6, 3); ctx.fill(); }
  ctx.restore();
}

// ----- street (wide), sky above (y < 300) -----
function bgStreet(ctx, t, o = {}) {
  const g = ctx.createLinearGradient(0, -1300, 0, 900);
  g.addColorStop(0, '#4aa3e8'); g.addColorStop(1, '#bfe6ff');
  ctx.fillStyle = g; ctx.fillRect(-900, -1400, 2800, 2400);
  for (let i = 0; i < 6; i++) { const cx = ((i * 260 + t * 12) % 1800) - 400, cy = -900 + i * 180 + (i % 2) * 60; puff(ctx, cx, cy, 1.4, '#fff'); }
  // sun with face
  drawSun(ctx, t, 600, 220, 0.8, {});
  // buildings
  const cols = ['#f29e4c', '#9b5de5', '#f15bb5', '#00bbf9', '#00c49a', '#fee440', '#e2725b'];
  for (let i = 0; i < 16; i++) {
    const x = -700 + i * 150, h = 380 + hash(i * 3.3) * 300, w = 140;
    ctx.fillStyle = cols[i % 7]; ctx.fillRect(x, 900 - h, w, h); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeRect(x, 900 - h, w, h);
    for (let r = 0; r < Math.floor(h / 70); r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x + 16 + c * 42, 900 - h + 22 + r * 70, 26, 36); ctx.lineWidth = 3; ctx.strokeRect(x + 16 + c * 42, 900 - h + 22 + r * 70, 26, 36); }
  }
  // trees
  for (const tx of [-260, 120, 690, 1100]) { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(tx - 10, 780, 20, 130); circle(ctx, tx, 760, 60); fillStroke(ctx, '#43c26b', OUT, 5); }
  // sidewalk + road
  ctx.fillStyle = '#c9ccd4'; ctx.fillRect(-900, 900, 2800, 180); ctx.fillStyle = '#9aa0ad'; ctx.fillRect(-900, 1070, 2800, 16);
  ctx.strokeStyle = '#aeb2bd'; ctx.lineWidth = 3; for (let x = -900; x < 1900; x += 110) { ctx.beginPath(); ctx.moveTo(x, 900); ctx.lineTo(x - 30, 1070); ctx.stroke(); }
  ctx.fillStyle = '#4a4e5a'; ctx.fillRect(-900, 1086, 2800, 400);
  ctx.fillStyle = '#ffd23f'; for (let x = -900; x < 1900; x += 120) ctx.fillRect(x, 1190, 70, 12);
  // lamp + hydrant
  ctx.fillStyle = '#30343f'; ctx.fillRect(-60, 560, 14, 350); ell(ctx, -53, 556, 30, 14); fillStroke(ctx, '#30343f', OUT, 4); circle(ctx, -53, 572, 12); ctx.fillStyle = '#fff6c8'; ctx.fill();
  rr(ctx, 860, 840, 44, 66, 10); fillStroke(ctx, '#e23b3b', OUT, 5);
}
function drawSun(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.save(); ctx.rotate(t * 0.4);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); rr(ctx, 92, -8, 40, 16, 8); ctx.fillStyle = '#ffb703'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.restore();
  circle(ctx, 0, 0, 84); fillStroke(ctx, '#ffd23f', OUT, 6);
  if (o.shades) {
    const k = o.shades;
    ctx.save(); ctx.translate(0, lerp(-160, -8, E.out(k)));
    rr(ctx, -66, -22, 60, 40, 14); ctx.fillStyle = '#111'; ctx.fill(); rr(ctx, 6, -22, 60, 40, 14); ctx.fill();
    ctx.fillRect(-10, -14, 20, 8); ctx.beginPath(); ctx.moveTo(-50, -12); ctx.lineTo(-28, -12); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-26, 40); ctx.quadraticCurveTo(0, 30, 30, 34); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  } else {
    for (const sd of [-1, 1]) { circle(ctx, sd * 30, -10, 9); ctx.fillStyle = OUT; ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 18, 26, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,120,80,0.35)'; ell(ctx, -52, 22, 14, 8); ctx.fill(); ell(ctx, 52, 22, 14, 8); ctx.fill();
  ctx.restore();
}
