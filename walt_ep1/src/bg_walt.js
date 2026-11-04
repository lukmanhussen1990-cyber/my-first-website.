// ---------- Walt Ep1 backgrounds (world space; parallax via global CAM) ----------
window.CAM = { x: 360, y: 640, z: 1 };
function para(ctx, k, fn) { ctx.save(); ctx.translate((CAM.x - 360) * k, (CAM.y - 640) * k); fn(); ctx.restore(); }
function dust(ctx, t, x0, y0, w, h, n = 24, col = 'rgba(255,240,200,') {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((hash(i) * w + t * 8 * (hash(i + 4) - 0.5) * 6) % w + w) % w, y = y0 + ((hash(i + 9) * h - t * 10 * (0.3 + hash(i + 2))) % h + h) % h;
    const a = 0.25 + 0.35 * Math.sin(t * 1.5 + i); circle(ctx, x, y, 1.5 + hash(i + 5) * 2.5); ctx.fillStyle = col + a + ')'; ctx.fill();
  }
}
function lightBeam(ctx, x1, y1, x2, y2, w1, w2, a) {
  ctx.save(); ctx.globalAlpha = a; const g = ctx.createLinearGradient(x1, y1, x2, y2); g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2); ctx.closePath(); ctx.fill(); ctx.restore();
}
function frameBox(ctx, x, y, w, h, col, inner) {
  rr(ctx, x, y, w, h, 6); fillStroke(ctx, lgrad(ctx, x, y, x + w, y + h, shadeHex(col, 30), shadeHex(col, -30)), OUT, 5);
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 3); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.save(); rr(ctx, x + 10, y + 10, w - 20, h - 20, 3); ctx.clip(); inner && inner(x + 10, y + 10, w - 20, h - 20); ctx.restore();
}

// ----- living room (warm, 70s) -----
function bgLiving(ctx, t, o = {}) {
  // view through window (far parallax)
  para(ctx, 0.45, () => {
    const g = ctx.createLinearGradient(0, 250, 0, 600); g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#d8f1ff'); ctx.fillStyle = g; ctx.fillRect(-200, 200, 600, 420);
    circle(ctx, 120, 470, 90); ctx.fillStyle = '#5cb85c'; ctx.fill(); circle(ctx, 210, 430, 70); ctx.fillStyle = '#4ca84c'; ctx.fill();
    ctx.fillStyle = '#e9d7b0'; ctx.fillRect(40, 420, 120, 160); ctx.fillStyle = '#c0653a'; ctx.beginPath(); ctx.moveTo(30, 420); ctx.lineTo(100, 370); ctx.lineTo(170, 420); ctx.fill();
  });
  // wallpaper (window cut-out)
  ctx.save(); ctx.beginPath(); ctx.rect(-900, -400, 2600, 2000); ctx.rect(250, 280, -210, 290); ctx.clip('evenodd');
  const wg = ctx.createLinearGradient(0, 0, 0, 900); wg.addColorStop(0, '#f6e1bd'); wg.addColorStop(1, '#e5c391'); ctx.fillStyle = wg; ctx.fillRect(-900, -400, 2600, 1400);
  for (let y = 120; y < 860; y += 70) for (let x = -880 + ((y / 70) % 2) * 45; x < 1700; x += 90) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.35;
    for (let p = 0; p < 5; p++) { ctx.rotate(TAU / 5); ell(ctx, 0, -9, 5, 9); ctx.fillStyle = '#d98a5a'; ctx.fill(); }
    circle(ctx, 0, 0, 4); ctx.fillStyle = '#8a5a32'; ctx.fill(); ctx.restore();
  }
  ctx.restore();
  // window frame + curtains
  rr(ctx, 40, 280, 210, 290, 6); ctx.lineWidth = 12; ctx.strokeStyle = '#fffaf0'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(145, 280); ctx.lineTo(145, 570); ctx.moveTo(40, 425); ctx.lineTo(250, 425); ctx.lineWidth = 8; ctx.strokeStyle = '#fffaf0'; ctx.stroke();
  for (const [cx, dir] of [[30, 1], [260, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx - 30 * dir, 250); ctx.lineTo(cx + 40 * dir, 250); ctx.quadraticCurveTo(cx + 10 * dir, 420, cx + 30 * dir, 600); ctx.lineTo(cx - 30 * dir, 600); ctx.closePath();
    fillStroke(ctx, lgrad(ctx, cx - 30, 250, cx + 40, 600, '#e8714a', '#b2462a'), OUT, 5);
  }
  rr(ctx, -10, 238, 310, 16, 8); fillStroke(ctx, '#8a5a32', OUT, 4);
  // window light beam
  lightBeam(ctx, 145, 420, 360, 1000, 100, 260, 0.22);
  // chair rail + wainscot
  ctx.fillStyle = '#b98a5a'; ctx.fillRect(-900, 690, 2600, 16); ctx.fillStyle = '#d7a874'; ctx.fillRect(-900, 706, 2600, 200);
  ctx.strokeStyle = '#b98a5a'; ctx.lineWidth = 3; for (let x = -880; x < 1700; x += 120) { rr(ctx, x, 724, 100, 160, 6); ctx.stroke(); }
  // family photos
  frameBox(ctx, 470, 290, 110, 130, '#c9a14a', (x, y, w, h) => { ctx.fillStyle = '#ffe1ef'; ctx.fillRect(x, y, w, h); miaAvatar(ctx, x + w / 2, y + h / 2 + 4, 40); });
  frameBox(ctx, 600, 330, 96, 110, '#8a5a32', (x, y, w, h) => { ctx.fillStyle = '#d9cbb0'; ctx.fillRect(x, y, w, h); circle(ctx, x + w / 2, y + 50, 22); ctx.fillStyle = '#c9a888'; ctx.fill(); rr(ctx, x + w / 2 - 26, y + 22, 52, 14, 6); ctx.fillStyle = '#fff'; ctx.fill(); ctx.fillStyle = '#20304f'; ctx.fillRect(x + 14, y + 72, w - 28, 40); });
  boldText(ctx, '1962', 648, 455, 16, '#8a5a32', { stroke: 0, shadow: false });
  // cuckoo clock
  ctx.save(); ctx.translate(360, 230);
  ctx.beginPath(); ctx.moveTo(-60, -30); ctx.lineTo(0, -80); ctx.lineTo(60, -30); ctx.closePath(); fillStroke(ctx, '#6b4426', OUT, 4);
  rr(ctx, -50, -30, 100, 100, 6); fillStroke(ctx, '#8a5a32', OUT, 4); circle(ctx, 0, 20, 30); fillStroke(ctx, '#fffaf0', OUT, 3);
  const ha = t * 0.5, ma = t * 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(Math.sin(ha) * 16, 20 - Math.cos(ha) * 16); ctx.moveTo(0, 20); ctx.lineTo(Math.sin(ma) * 24, 20 - Math.cos(ma) * 24); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
  const sw = Math.sin(t * 4) * 0.3; ctx.save(); ctx.translate(0, 70); ctx.rotate(sw); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 90); ctx.lineWidth = 3; ctx.stroke(); circle(ctx, 0, 96, 12); fillStroke(ctx, '#e7b94c', OUT, 3); ctx.restore();
  ctx.restore();
  // floor lamp (right) with warm glow
  ctx.save(); ctx.translate(650, 900);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -380); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke(); ell(ctx, 0, 0, 40, 10); fillStroke(ctx, '#6b4426', OUT, 3);
  ctx.beginPath(); ctx.moveTo(-50, -380); ctx.lineTo(50, -380); ctx.lineTo(34, -460); ctx.lineTo(-34, -460); ctx.closePath(); fillStroke(ctx, '#f7d98b', OUT, 4);
  ctx.restore();
  const lg = ctx.createRadialGradient(650, 450, 10, 650, 450, 420); lg.addColorStop(0, 'rgba(255,214,140,0.55)'); lg.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = lg; ctx.fillRect(230, 30, 840, 840);
  // floor (planks)
  const fg = ctx.createLinearGradient(0, 900, 0, 1300); fg.addColorStop(0, '#a46a3c'); fg.addColorStop(1, '#7a4a28'); ctx.fillStyle = fg; ctx.fillRect(-900, 900, 2600, 600);
  ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 3; for (let y = 930; y < 1500; y += 46) { ctx.beginPath(); ctx.moveTo(-900, y); ctx.lineTo(1700, y); ctx.stroke(); }
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(-900, 896, 2600, 12);
  // oval rug
  ell(ctx, 360, 1110, 330, 90); ctx.fillStyle = '#b8462a'; ctx.fill(); ell(ctx, 360, 1110, 290, 72); ctx.lineWidth = 8; ctx.strokeStyle = '#e8a14a'; ctx.stroke(); ell(ctx, 360, 1110, 230, 54); ctx.strokeStyle = '#f3d9a0'; ctx.lineWidth = 5; ctx.stroke();
  // recliner (left) + side table
  if (!o.noChair) {
    ctx.save(); ctx.translate(-30, 1000);
    rr(ctx, -110, -330, 200, 230, 50); fillStroke(ctx, lgrad(ctx, -110, -330, 90, -100, '#8f6a3a', '#6b4a2a'), OUT, 6);
    rr(ctx, -130, -150, 240, 110, 30); fillStroke(ctx, '#7d5a32', OUT, 6);
    rr(ctx, 70, -200, 60, 140, 26); fillStroke(ctx, '#6b4a2a', OUT, 6);
    ctx.beginPath(); ctx.moveTo(-60, -320); ctx.lineTo(20, -320); ctx.lineTo(10, -280); ctx.lineTo(-50, -280); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); // doily
    ctx.restore();
  }
  ctx.save(); ctx.translate(170, 905); rr(ctx, -50, -120, 100, 14, 4); fillStroke(ctx, '#8a5a32', OUT, 4); ctx.fillStyle = '#6b4426'; ctx.fillRect(-40, -106, 10, 106); ctx.fillRect(30, -106, 10, 106);
  rr(ctx, -40, -150, 54, 30, 4); fillStroke(ctx, '#7ec8e3', OUT, 3); for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ff6fb5', '#ffd23f', '#7cfc5a', '#fff'][i]; ctx.fillRect(-36 + i * 12, -146, 8, 8); }
  ell(ctx, 30, -130, 16, 8); fillStroke(ctx, '#e9e9f2', OUT, 3);
  ctx.restore();
  // CRT TV on stand (right)
  if (!o.noTV) {
    ctx.save(); ctx.translate(560, 900);
    rr(ctx, -80, -100, 160, 100, 6); fillStroke(ctx, '#8a5a32', OUT, 5);
    rr(ctx, -90, -250, 180, 150, 18); fillStroke(ctx, lgrad(ctx, 0, -250, 0, -100, '#9a7a5a', '#6b4a2e'), OUT, 6);
    rr(ctx, -74, -236, 118, 120, 14); ctx.fillStyle = '#2a3a3a'; ctx.fill();
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(t * 20) * 3) * 0.5})`; ctx.fillRect(-74 + hash(i * 2 + Math.floor(t * 20)) * 118, -236 + hash(i * 5 + Math.floor(t * 20)) * 120, 6, 2); }
    circle(ctx, 66, -200, 8); fillStroke(ctx, '#d9b382', OUT, 3); circle(ctx, 66, -170, 8); fillStroke(ctx, '#d9b382', OUT, 3);
    ctx.beginPath(); ctx.moveTo(-10, -250); ctx.lineTo(-60, -340); ctx.moveTo(10, -250); ctx.lineTo(60, -330); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); circle(ctx, -10, -252, 10); ctx.fillStyle = OUT; ctx.fill();
    ctx.restore();
  }
  dust(ctx, t, 60, 420, 520, 520, 26);
}

// ----- classroom flashback -----
function bgClass(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 1280); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#f4d58a'); ctx.fillStyle = g; ctx.fillRect(-300, -300, 1400, 1900);
  // chalkboard
  rr(ctx, 40, 250, 640, 380, 12); fillStroke(ctx, '#7a5a32', OUT, 6); rr(ctx, 60, 270, 600, 340, 6); ctx.fillStyle = '#2f5e4a'; ctx.fill();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.font = '44px "Luckiest Guy"'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center'; ctx.fillText('MY GRANDPA', 360, 330); ctx.fillText('IS FAMOUS!!', 360, 380);
  // chalk doodle of Walt with crown + stars
  ctx.beginPath(); ctx.arc(250, 500, 50, 0, TAU); ctx.stroke(); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(250 + sd * 18, 495, 14, 0, TAU); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(210, 455); ctx.lineTo(220, 420); ctx.lineTo(240, 445); ctx.lineTo(250, 415); ctx.lineTo(262, 445); ctx.lineTo(282, 420); ctx.lineTo(290, 455); ctx.stroke();
  for (const [sx, sy] of [[440, 470], [520, 520], [480, 560]]) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 10 : 24, a = i / 10 * TAU - Math.PI / 2; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); }
  ctx.font = '26px "Luckiest Guy"'; ctx.fillText('1M FOLLOWERS', 500, 600);
  ctx.restore();
  ctx.fillStyle = '#c9a14a'; ctx.fillRect(40, 630, 640, 14);
  // floor
  ctx.fillStyle = '#c9b48f'; ctx.fillRect(-300, 900, 1400, 600);
}
function classKids(ctx, t, amaze) {
  // backs of kids' heads in the foreground
  const cols = ['#3b2416', '#e8c26a', '#1c1c1c', '#a0522d', '#6b4226'];
  for (let i = 0; i < 5; i++) {
    const x = -20 + i * 190, y = 1250 + (i % 2) * 30, bob = amaze ? Math.abs(Math.sin(t * 10 + i)) * 10 : 0;
    rr(ctx, x - 90, y - 120 - bob, 180, 260, 60); fillStroke(ctx, ['#4fc3ff', '#ff6fb5', '#7cfc5a', '#ffd23f', '#b48ce0'][i], OUT, 5);
    circle(ctx, x, y - 190 - bob, 70); fillStroke(ctx, cols[i], OUT, 5);
    if (amaze) boldText(ctx, i % 2 ? '!!' : 'WOW', x, y - 300 - bob, 40, '#fff', { font: 'Luckiest Guy', stroke: 8 });
  }
}

// ----- backyard (time of day 0..1 drives the sky) -----
function bgYard(ctx, t, o = {}) {
  const tod = o.tod || 0;
  para(ctx, 0.5, () => {
    const g = ctx.createLinearGradient(0, -400, 0, 760);
    g.addColorStop(0, lerpCol('#5fb2ff', '#3b2a6b', tod)); g.addColorStop(1, lerpCol('#cfeeff', '#ff9e6b', tod));
    ctx.fillStyle = g; ctx.fillRect(-900, -600, 2600, 1500);
    const sa = lerp(-0.6, 1.4, tod) * Math.PI / 2;
    const sx = 360 + Math.sin(sa) * 380, sy = 460 - Math.cos(sa) * 300;
    circle(ctx, sx, sy, 60); ctx.fillStyle = lerpCol('#ffe066', '#ff7a3b', tod); ctx.fill();
    for (let i = 0; i < 4; i++) puff(ctx, ((i * 300 + t * 20 + tod * 2000) % 1400) - 300, 200 + i * 70, 1.3, 'rgba(255,255,255,0.9)');
    // far trees
    for (let i = 0; i < 9; i++) { circle(ctx, -200 + i * 140, 640 + (i % 2) * 20, 90); ctx.fillStyle = lerpCol('#5cb85c', '#3a5a4a', tod); ctx.fill(); }
  });
  // fence
  for (let x = -600; x < 1500; x += 56) {
    ctx.beginPath(); ctx.moveTo(x, 860); ctx.lineTo(x, 620); ctx.lineTo(x + 24, 596); ctx.lineTo(x + 48, 620); ctx.lineTo(x + 48, 860); ctx.closePath();
    fillStroke(ctx, lgrad(ctx, x, 600, x + 48, 860, '#fff6e6', '#e2d2b8'), OUT, 4);
  }
  ctx.fillStyle = '#d9c7a8'; ctx.fillRect(-600, 680, 2100, 18); ctx.fillRect(-600, 790, 2100, 18);
  // lawn with mower stripes
  const lg = ctx.createLinearGradient(0, 860, 0, 1300); lg.addColorStop(0, lerpCol('#6fcf5a', '#3f7a4a', tod)); lg.addColorStop(1, lerpCol('#46a33a', '#2a5a35', tod));
  ctx.fillStyle = lg; ctx.fillRect(-900, 860, 2600, 700);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = -900; x < 1700; x += 160) ctx.fillRect(x, 860, 80, 700);
  // bushes
  for (const [bx, by, s] of [[-40, 880, 1.6], [700, 870, 1.8], [80, 900, 1.1]]) puff(ctx, bx, by, s, lerpCol('#3fa34a', '#2a5a35', tod), OUT, 4);
  // garden gnome
  ctx.save(); ctx.translate(90, 1010);
  rr(ctx, -26, -60, 52, 60, 14); fillStroke(ctx, '#3b82e2', OUT, 4); circle(ctx, 0, -76, 20); fillStroke(ctx, '#f2c6a0', OUT, 4);
  ctx.beginPath(); ctx.moveTo(-22, -84); ctx.lineTo(0, -150); ctx.lineTo(22, -84); ctx.closePath(); fillStroke(ctx, '#e23b3b', OUT, 4);
  ctx.beginPath(); ctx.moveTo(-18, -70); ctx.quadraticCurveTo(0, -20, 18, -70); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  // book-stack tripod with phone
  if (!o.noTripod) {
    ctx.save(); ctx.translate(600, 1070);
    ['#e23b3b', '#3b82e2', '#ffd23f', '#43c26b'].forEach((c, i) => { rr(ctx, -70 + i * 4, -40 - i * 36, 140 - i * 8, 36, 4); fillStroke(ctx, c, OUT, 4); });
    rr(ctx, -30, -270, 60, 110, 10); fillStroke(ctx, '#23232e', OUT, 4); rr(ctx, -24, -262, 48, 92, 6); ctx.fillStyle = '#9fd3ff'; ctx.fill();
    circle(ctx, 16, -255, 6); ctx.fillStyle = Math.sin(t * 6) > 0 ? '#e23b3b' : '#7a1a1a'; ctx.fill();
    ctx.restore();
  }
}
function lerpCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, k)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, k)), bl = Math.round(lerp(pa & 255, pb & 255, k));
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

// ----- bingo hall -----
function bgBingo(ctx, t, o = {}) {
  ctx.fillStyle = '#b98a5a'; ctx.fillRect(-900, -400, 2600, 1400);
  for (let x = -900; x < 1700; x += 60) { ctx.fillStyle = (x / 60) % 2 ? '#a97a4a' : '#c4956a'; ctx.fillRect(x, -400, 60, 1300); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, -400, 3, 1300); }
  // ceiling + fluorescent panels
  ctx.fillStyle = '#e9e4d8'; ctx.fillRect(-900, -400, 2600, 470);
  for (let x = -300; x < 1100; x += 260) { rr(ctx, x, 20, 200, 34, 6); ctx.fillStyle = '#f7fbff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#b8c0cc'; ctx.stroke(); }
  // banner
  rr(ctx, 160, 110, 400, 80, 14); fillStroke(ctx, '#e23b3b', OUT, 5); boldText(ctx, 'BINGO NIGHT', 360, 152, 52, '#ffd23f', { stroke: 7, font: 'Luckiest Guy' });
  // bingo board
  rr(ctx, 60, 220, 600, 330, 12); fillStroke(ctx, '#23232e', OUT, 6);
  const L = 'BINGO';
  for (let r = 0; r < 5; r++) {
    boldText(ctx, L[r], 100, 260 + r * 60, 40, '#ffd23f', { stroke: 0, shadow: false });
    for (let c = 0; c < 9; c++) {
      const n = r * 15 + c + 1, lit = hash(n * 3.1) < 0.35 || (o.flash && Math.floor(t * 6) % 9 === c && r === 2);
      circle(ctx, 160 + c * 56, 260 + r * 60, 22); ctx.fillStyle = lit ? '#ff6f3c' : '#3a3a48'; ctx.fill();
      boldText(ctx, String(n), 160 + c * 56, 261 + r * 60, 20, lit ? '#fff' : '#8a8a99', { stroke: 0, shadow: false });
    }
  }
  // floor
  ctx.fillStyle = '#7a8a9a'; ctx.fillRect(-900, 900, 2600, 600);
  for (let y = 900; y < 1500; y += 60) for (let x = -900 + ((y / 60) % 2) * 60; x < 1700; x += 120) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, 60, 60); }
  // cool fluorescent tint
  ctx.fillStyle = 'rgba(200,230,255,0.08)'; ctx.fillRect(-900, -400, 2600, 1900);
}
function bingoTable(ctx, t, y) {
  rr(ctx, -200, y, 1120, 40, 8); fillStroke(ctx, '#f4f4f7', OUT, 6);
  rr(ctx, -200, y + 40, 1120, 300, 0); ctx.fillStyle = '#d9dde6'; ctx.fill();
  for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-80 + i * 160, y + 8); ctx.rotate((hash(i) - 0.5) * 0.2); rr(ctx, -50, -24, 100, 30, 4); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#b8b08a'; ctx.stroke(); for (let k = 0; k < 4; k++) { circle(ctx, -36 + k * 24, -9, 6); ctx.fillStyle = ['#ff4fa0', '#4fc3ff', '#7cfc5a', '#ffd23f'][(i + k) % 4]; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1; } ctx.restore(); }
}

// ----- kitchen -----
function bgKitchen(ctx, t) {
  ctx.fillStyle = '#fff1b8'; ctx.fillRect(-900, -400, 2600, 1400);
  // tile backsplash
  for (let y = 520; y < 760; y += 40) for (let x = -900; x < 1700; x += 40) { ctx.fillStyle = ((x + y) / 40) % 2 ? '#bfe6dc' : '#e6f7f2'; ctx.fillRect(x, y, 40, 40); }
  // cabinets
  for (let x = -100; x < 900; x += 170) { rr(ctx, x, 230, 150, 250, 8); fillStroke(ctx, lgrad(ctx, x, 230, x + 150, 480, '#ff9e6b', '#e2764a'), OUT, 5); circle(ctx, x + 128, 360, 7); fillStroke(ctx, '#ffd23f', OUT, 3); }
  // window
  rr(ctx, 260, 520, 200, 160, 8); fillStroke(ctx, '#9fd8ff', OUT, 6); ctx.beginPath(); ctx.moveTo(360, 520); ctx.lineTo(360, 680); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  // counter
  rr(ctx, -900, 760, 2600, 40, 4); fillStroke(ctx, '#f4f4f7', OUT, 5);
  ctx.fillStyle = '#e2764a'; ctx.fillRect(-900, 800, 2600, 100);
  // kettle + fridge
  ctx.save(); ctx.translate(120, 760); ell(ctx, 0, -40, 50, 40); fillStroke(ctx, '#e23b3b', OUT, 5); ctx.beginPath(); ctx.arc(0, -84, 22, Math.PI, 0); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke(); ctx.restore();
  rr(ctx, 560, 200, 180, 700, 20); fillStroke(ctx, lgrad(ctx, 560, 200, 740, 900, '#f7fbff', '#cfd8e6'), OUT, 6);
  ctx.beginPath(); ctx.moveTo(560, 480); ctx.lineTo(740, 480); ctx.lineWidth = 5; ctx.stroke();
  for (const [mx, my, c] of [[610, 300, '#ff6fb5'], [660, 360, '#ffd23f'], [600, 560, '#7cfc5a']]) { circle(ctx, mx, my, 14); fillStroke(ctx, c, OUT, 3); }
  ctx.fillStyle = '#c9b48f'; ctx.fillRect(-900, 900, 2600, 600);
}
function kitchenTable(ctx, t, letterK, lines) {
  // checkered tablecloth in foreground
  ctx.save(); ctx.beginPath(); ctx.moveTo(-100, 1000); ctx.lineTo(820, 1000); ctx.lineTo(900, 1400); ctx.lineTo(-180, 1400); ctx.closePath(); ctx.clip();
  for (let y = 1000; y < 1400; y += 50) for (let x = -200; x < 920; x += 50) { ctx.fillStyle = ((x + y) / 50) % 2 ? '#e23b3b' : '#fff'; ctx.fillRect(x, y, 50, 50); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-100, 1000); ctx.lineTo(820, 1000); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
  // letter paper
  ctx.save(); ctx.translate(360, 1110); ctx.rotate(-0.05);
  rr(ctx, -200, -100, 400, 230, 6); fillStroke(ctx, '#fffaf0', OUT, 5);
  ctx.strokeStyle = 'rgba(80,120,200,0.25)'; ctx.lineWidth = 2; for (let y = -60; y < 120; y += 30) { ctx.beginPath(); ctx.moveTo(-180, y); ctx.lineTo(180, y); ctx.stroke(); }
  ctx.font = 'italic 700 26px "DejaVu Serif"'; ctx.fillStyle = '#1b3a8a';
  lines.forEach((ln, i) => { const n = Math.floor(clamp(letterK * lines.length - i) * ln.length); if (n > 0) ctx.fillText(ln.slice(0, n), -176, -70 + i * 30); });
  ctx.restore();
}

// ----- suburban street (wide) -----
function bgSuburb(ctx, t, o = {}) {
  para(ctx, 0.5, () => {
    const g = ctx.createLinearGradient(0, -300, 0, 800); g.addColorStop(0, '#6fbfff'); g.addColorStop(1, '#ffe3b8'); ctx.fillStyle = g; ctx.fillRect(-1600, -600, 4400, 1500);
    circle(ctx, 560, 300, 70); ctx.fillStyle = '#ffe066'; ctx.fill();
    for (let i = 0; i < 6; i++) puff(ctx, ((i * 400 + t * 15) % 2600) - 1000, 180 + (i % 3) * 60, 1.4, 'rgba(255,255,255,0.9)');
    for (let i = 0; i < 14; i++) { circle(ctx, -1200 + i * 230, 660, 110); ctx.fillStyle = '#7cc47a'; ctx.fill(); }
  });
  // houses
  const hc = ['#ffd6a5', '#bde0fe', '#cdb4db', '#ffafcc', '#caffbf', '#fdffb6'];
  for (let i = 0; i < 9; i++) {
    const x = -1300 + i * 340, w = 260;
    rr(ctx, x, 560, w, 300, 4); fillStroke(ctx, lgrad(ctx, x, 560, x + w, 860, hc[i % 6], shadeHex(hc[i % 6], -40)), OUT, 5);
    ctx.beginPath(); ctx.moveTo(x - 20, 570); ctx.lineTo(x + w / 2, 440); ctx.lineTo(x + w + 20, 570); ctx.closePath(); fillStroke(ctx, ['#c0653a', '#5a6b8a', '#8a4a6a'][i % 3], OUT, 5);
    rr(ctx, x + w / 2 - 34, 720, 68, 140, 6); fillStroke(ctx, '#8a5a32', OUT, 4);
    for (const wx of [x + 30, x + w - 90]) { rr(ctx, wx, 620, 60, 60, 4); fillStroke(ctx, '#e6f6ff', OUT, 4); }
  }
  // picket fences + lawns
  ctx.fillStyle = '#6fcf5a'; ctx.fillRect(-1600, 860, 4400, 80);
  for (let x = -1600; x < 2800; x += 34) { ctx.beginPath(); ctx.moveTo(x, 900); ctx.lineTo(x, 840); ctx.lineTo(x + 12, 828); ctx.lineTo(x + 24, 840); ctx.lineTo(x + 24, 900); ctx.closePath(); fillStroke(ctx, '#ffffff', OUT, 3); }
  // sidewalk + road
  ctx.fillStyle = '#d9d4c8'; ctx.fillRect(-1600, 940, 4400, 150); ctx.strokeStyle = '#bdb6a6'; ctx.lineWidth = 3; for (let x = -1600; x < 2800; x += 120) { ctx.beginPath(); ctx.moveTo(x, 940); ctx.lineTo(x, 1090); ctx.stroke(); }
  ctx.fillStyle = '#5a5e6a'; ctx.fillRect(-1600, 1090, 4400, 500); ctx.fillStyle = '#ffd23f'; for (let x = -1600; x < 2800; x += 140) ctx.fillRect(x, 1210, 80, 12);
}

// ----- screen-space finishing: warm grade + vignette -----
function grade(ctx, col, a) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function vignette(ctx, a = 0.35) { const v = ctx.createRadialGradient(360, 620, 380, 360, 640, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,10,0,${a})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }

// ----- phone backdrop (likes + hearts drifting) -----
function bgPhone(ctx, t, tint = '#2a0f3d') {
  const g = ctx.createRadialGradient(360, 640, 60, 360, 640, 820);
  g.addColorStop(0, '#8a3aa8'); g.addColorStop(0.55, tint); g.addColorStop(1, '#0b0512');
  ctx.fillStyle = g; ctx.fillRect(-300, -300, W + 600, H + 600);
  ctx.save(); ctx.globalAlpha = 0.07; ctx.translate(360, 640); ctx.rotate(t * 0.1);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -120); ctx.lineTo(1400, 120); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.18; ctx.textAlign = 'center';
  for (let i = 0; i < 10; i++) { const y = ((hash(i) * 1280 - t * 40 * (0.5 + hash(i + 3))) % 1400 + 1400) % 1400 - 60; ctx.font = `${30 + hash(i + 2) * 30}px "Noto Color Emoji"`; ctx.fillText(['❤️', '👍', '⭐', '🔥', '💬'][i % 5], 40 + hash(i + 7) * 640, y); }
  ctx.restore();
}
