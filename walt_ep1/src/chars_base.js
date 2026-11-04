// ---------- supporting cast + props ----------

function simpleFace(ctx, x, y, r, t, o = {}) {
  const ex = o.eyes || 'normal';
  for (const sd of [-1, 1]) {
    const cx = x + sd * r * 0.36, cy = y - r * 0.08;
    if (ex === 'closed') { ctx.beginPath(); ctx.arc(cx, cy, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); }
    else if (ex === 'wide') { circle(ctx, cx, cy, r * 0.19); fillStroke(ctx, '#fff', OUT, 3); circle(ctx, cx, cy, r * 0.06); ctx.fillStyle = OUT; ctx.fill(); }
    else if (ex === 'annoyed') {
      circle(ctx, cx, cy, r * 0.1); ctx.fillStyle = OUT; ctx.fill();
      ctx.fillStyle = o.skin || '#f2c6a0'; ctx.fillRect(cx - r * 0.14, cy - r * 0.16, r * 0.28, r * 0.12);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.14, cy - r * 0.04); ctx.lineTo(cx + r * 0.14, cy - r * 0.04); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    }
    else { const bl = blinkAmt(t, o.seed || 3); ell(ctx, cx, cy, r * 0.09, r * 0.11 * (1 - bl * 0.9)); ctx.fillStyle = OUT; ctx.fill(); }
    if (o.brow !== undefined) {
      ctx.beginPath(); ctx.moveTo(cx - r * 0.16, cy - r * 0.26 + sd * o.brow * r * 0.1); ctx.lineTo(cx + r * 0.16, cy - r * 0.26 - sd * o.brow * r * 0.1);
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = o.browCol || OUT; ctx.stroke();
    }
  }
  const my = y + r * 0.42, m = o.mouth || 'smile';
  ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
  if (m === 'smile') { ctx.beginPath(); ctx.arc(x, my - r * 0.1, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  else if (m === 'flat') { ctx.beginPath(); ctx.moveTo(x - r * 0.16, my); ctx.lineTo(x + r * 0.16, my); ctx.stroke(); }
  else if (m === 'o') { ell(ctx, x, my, r * 0.1, r * 0.14); fillStroke(ctx, '#7a2230', OUT, 3); }
  else if (m === 'O') { ell(ctx, x, my + 4, r * 0.15, r * 0.22); fillStroke(ctx, '#7a2230', OUT, 4); }
  else if (m === 'frown') { ctx.beginPath(); ctx.arc(x, my + r * 0.18, r * 0.18, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
  else if (m === 'talk') { const k = Math.abs(Math.sin(t * 16)); ell(ctx, x, my, r * 0.14, r * (0.04 + k * 0.12)); fillStroke(ctx, '#7a2230', OUT, 3); }
}

// Line lady (dress shop queue). seed picks colours/hair
function drawLady(ctx, t, x, y, s, seed, o = {}) {
  const dressC = ['#7ec8e3', '#c39bd3', '#f7a35c', '#6cc68f', '#f06d8c', '#ffd166', '#8e9aaf'][seed % 7];
  const skin = ['#f2c6a0', '#c68a5a', '#8d5a3b', '#f7d3b5', '#e0ac7e'][seed % 5];
  const hairC = ['#3b2416', '#e8c26a', '#1c1c1c', '#a0522d', '#6b4226'][(seed * 3) % 5];
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.faint) ctx.rotate(-o.faint * 1.3 * (seed % 2 ? 1 : -1));
  const tap = o.tap ? Math.max(0, Math.sin(t * 10 + seed)) * 6 : 0;
  ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(-14, -90); ctx.lineTo(-14, -10); ctx.moveTo(14, -90); ctx.lineTo(16, -10 - tap); ctx.stroke();
  ctx.strokeStyle = skin; ctx.lineWidth = 9; ctx.stroke();
  ell(ctx, -18, -6, 14, 7); fillStroke(ctx, '#2b2b35', OUT, 3); ell(ctx, 20, -6 - tap, 14, 7); fillStroke(ctx, '#2b2b35', OUT, 3);
  ctx.beginPath(); ctx.moveTo(-30, -250); ctx.lineTo(30, -250); ctx.lineTo(62, -80); ctx.lineTo(-62, -80); ctx.closePath(); fillStroke(ctx, dressC, OUT, 5);
  if (o.arms === 'fan') {
    const f = Math.sin(t * 18 + seed) * 0.4;
    ctx.save(); ctx.translate(36, -230); ctx.rotate(-0.9 + f); rr(ctx, -8, -60, 16, 60, 8); fillStroke(ctx, skin, OUT, 4); ell(ctx, 0, -66, 22, 14); fillStroke(ctx, '#fff', OUT, 3); ctx.restore();
    rr(ctx, -46, -232, 18, 70, 9); fillStroke(ctx, skin, OUT, 4);
  } else if (o.arms === 'nose') {
    rr(ctx, -46, -232, 18, 70, 9); fillStroke(ctx, skin, OUT, 4);
    ctx.save(); ctx.translate(30, -235); ctx.rotate(-2.2); rr(ctx, -8, 0, 16, 62, 8); fillStroke(ctx, skin, OUT, 4); ctx.restore();
  } else {
    rr(ctx, -42, -210, 84, 22, 11); fillStroke(ctx, skin, OUT, 4);
  }
  const hy = -292;
  if (seed % 3 === 1) { ell(ctx, 0, hy + 10, 50, 62); fillStroke(ctx, hairC, OUT, 4); }
  circle(ctx, 0, hy, 42); fillStroke(ctx, skin, OUT, 5);
  ctx.beginPath(); ctx.arc(0, hy - 6, 44, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(30, hy - 18); ctx.quadraticCurveTo(0, hy - 30, -34, hy - 14); ctx.closePath(); fillStroke(ctx, hairC, OUT, 4);
  if (seed % 3 === 0) { circle(ctx, 0, hy - 52, 20); fillStroke(ctx, hairC, OUT, 4); }
  if (seed % 3 === 2) { for (const sd of [-1, 1]) { circle(ctx, sd * 40, hy - 10, 16); fillStroke(ctx, hairC, OUT, 4); } }
  simpleFace(ctx, 0, hy + 4, 42, t, { eyes: o.eyes || 'annoyed', mouth: o.mouth || 'flat', brow: o.brow !== undefined ? o.brow : 0.6, skin, seed });
  if (o.green) { circle(ctx, 0, hy, 40); ctx.fillStyle = `rgba(120,200,80,${0.45 * o.green})`; ctx.fill(); }
  ctx.restore();
}

// Baker: chef hat, mustache
function drawBaker(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.lean || 0);
  const skin = '#e9b48a';
  rr(ctx, -95, -330, 190, 330, 50); fillStroke(ctx, '#fbfbfb', OUT, 6);
  ctx.fillStyle = '#ffd6e0'; rr(ctx, -70, -240, 140, 240, 20); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
  for (let i = 0; i < 3; i++) { circle(ctx, -40, -300 + i * 26, 5); ctx.fillStyle = OUT; ctx.fill(); circle(ctx, 40, -300 + i * 26, 5); ctx.fill(); }
  const pose = o.pose || 'present';
  ctx.lineCap = 'round';
  const arm = (ax, ay, hx, hy) => { ctx.strokeStyle = OUT; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = '#fbfbfb'; ctx.lineWidth = 30; ctx.stroke(); circle(ctx, hx, hy, 19); fillStroke(ctx, skin, OUT, 5); };
  if (pose === 'present') { arm(-85, -300, -150, -200); arm(85, -300, 160, -250 + Math.sin(t * 3) * 6); }
  else if (pose === 'ask') { arm(-85, -300, -130, -170); arm(85, -300, 120, -380 + Math.sin(t * 8) * 8); }
  else if (pose === 'cover') { arm(-85, -300, -30, -420); arm(85, -300, 30, -418); }
  else { arm(-85, -300, -120, -170); arm(85, -300, 120, -170); }
  const hy = -410;
  circle(ctx, 0, hy, 78); fillStroke(ctx, skin, OUT, 6);
  ctx.beginPath(); ctx.moveTo(-60, hy - 52); ctx.lineTo(-62, hy - 110); ctx.arc(-40, hy - 130, 34, Math.PI * 0.8, Math.PI * 1.7); ctx.arc(0, hy - 150, 40, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(40, hy - 130, 34, Math.PI * 1.3, Math.PI * 2.2); ctx.lineTo(60, hy - 52); ctx.closePath(); fillStroke(ctx, '#fff', OUT, 6);
  ctx.beginPath(); ctx.moveTo(-60, hy - 70); ctx.lineTo(60, hy - 70); ctx.lineWidth = 4; ctx.stroke();
  simpleFace(ctx, 0, hy - 4, 78, t, { eyes: o.eyes || 'normal', mouth: o.talking ? 'talk' : (o.mouth || 'smile'), brow: o.brow !== undefined ? o.brow : -0.2, seed: 9 });
  ctx.beginPath(); ctx.moveTo(0, hy + 18); ctx.bezierCurveTo(-20, hy + 6, -46, hy + 14, -54, hy + 30); ctx.bezierCurveTo(-36, hy + 26, -16, hy + 30, 0, hy + 24);
  ctx.bezierCurveTo(16, hy + 30, 36, hy + 26, 54, hy + 30); ctx.bezierCurveTo(46, hy + 14, 20, hy + 6, 0, hy + 18); fillStroke(ctx, '#5a3a22', OUT, 3);
  circle(ctx, 0, hy + 8, 12); fillStroke(ctx, '#e39a74', OUT, 3);
  if (o.green) { circle(ctx, 0, hy, 74); ctx.fillStyle = `rgba(120,200,80,${0.5 * o.green})`; ctx.fill(); }
  ctx.restore();
}

// Priest: black cassock, white collar
function drawPriest(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s);
  const skin = '#f0c9a6';
  const walk = o.walk ? Math.sin(t * 9) : 0;
  ctx.beginPath(); ctx.moveTo(-70, -350); ctx.lineTo(70, -350); ctx.lineTo(102 + walk * 6, -8); ctx.lineTo(-102 + walk * 6, -8); ctx.closePath(); fillStroke(ctx, '#23232e', OUT, 6);
  ell(ctx, -36 + walk * 12, -6, 30, 12); fillStroke(ctx, '#111', OUT, 4); ell(ctx, 36 - walk * 12, -6, 30, 12); fillStroke(ctx, '#111', OUT, 4);
  ctx.beginPath(); ctx.moveTo(0, -330); ctx.lineTo(0, -20); ctx.lineWidth = 3; ctx.strokeStyle = '#3c3c4c'; ctx.stroke();
  ctx.lineCap = 'round';
  const pose = o.pose || 'pray';
  const arm = (ax, ay, hx, hy) => { ctx.strokeStyle = OUT; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = '#23232e'; ctx.lineWidth = 34; ctx.stroke(); circle(ctx, hx, hy, 18); fillStroke(ctx, skin, OUT, 5); };
  if (pose === 'pray') { arm(-66, -320, -10, -260); arm(66, -320, 10, -260); rr(ctx, -12, -302, 24, 44, 12); fillStroke(ctx, skin, OUT, 4); }
  else if (pose === 'shock') { arm(-66, -320, -130, -420); arm(66, -320, 130, -420); }
  else if (pose === 'nose') { arm(-66, -320, -110, -190); arm(66, -320, 14, -416); }
  else { arm(-66, -320, -100, -180); arm(66, -320, 100, -180); }
  rr(ctx, -40, -372, 80, 30, 10); fillStroke(ctx, '#23232e', OUT, 5); rr(ctx, -12, -366, 24, 18, 4); ctx.fillStyle = '#fff'; ctx.fill();
  const hy = -440;
  circle(ctx, 0, hy, 70); fillStroke(ctx, skin, OUT, 6);
  for (const sd of [-1, 1]) { ell(ctx, sd * 62, hy - 4, 18, 30); fillStroke(ctx, '#d9d9e0', OUT, 4); }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -22, hy - 46, 20, 9, -0.4); ctx.fill();
  simpleFace(ctx, 0, hy + 6, 70, t, { eyes: o.eyes || 'closed', mouth: o.mouth || (o.talking ? 'talk' : 'smile'), brow: o.brow !== undefined ? o.brow : 0.2, browCol: '#9a9aa6', seed: 21 });
  if (o.green) { circle(ctx, 0, hy, 66); ctx.fillStyle = `rgba(120,200,80,${0.5 * o.green})`; ctx.fill(); }
  ctx.restore();
}

// Dog: side view, facing right if facing=1
function drawDog(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing || 1), s);
  const walk = o.walking ? t * 10 : 0;
  const fur = '#c98a4b', furD = '#8a5a2b';
  const wag = o.offended ? 0.2 : Math.sin(t * 16) * 0.5;
  ctx.save(); ctx.translate(-78, -92); ctx.rotate(-0.9 + wag); rr(ctx, -6, -48, 13, 50, 7); fillStroke(ctx, fur, OUT, 4); ctx.restore();
  for (const [lx, ph] of [[-56, 0], [-34, Math.PI], [42, Math.PI], [64, 0]]) {
    const a = o.walking ? Math.sin(walk + ph) * 0.45 : 0;
    ctx.save(); ctx.translate(lx, -62); ctx.rotate(a); rr(ctx, -9, 0, 18, 58, 8); fillStroke(ctx, ph ? furD : fur, OUT, 4); ell(ctx, 4, 58, 14, 7); fillStroke(ctx, furD, OUT, 3); ctx.restore();
  }
  ell(ctx, 0, -86, 92, 42); fillStroke(ctx, fur, OUT, 5);
  ell(ctx, -20, -96, 30, 16, 0.2); ctx.fillStyle = furD; ctx.fill();
  const sniff = o.sniff ? Math.sin(t * 30) * 2 : 0;
  const headUp = o.offended ? -0.45 : (o.sniff ? 0.25 : 0);
  ctx.save(); ctx.translate(78, -118); ctx.rotate(headUp);
  ell(ctx, 10, -10, 44, 38); fillStroke(ctx, fur, OUT, 5);
  rr(ctx, 30, -6, 50, 34, 16); fillStroke(ctx, '#e3b07a', OUT, 5);
  ell(ctx, 80 + sniff, 2, 11, 9); ctx.fillStyle = OUT; ctx.fill();
  ctx.save(); ctx.translate(-14, -36); ctx.rotate(0.4 + (o.offended ? -0.3 : Math.sin(t * 6) * 0.1)); ell(ctx, 0, 26, 16, 32); fillStroke(ctx, furD, OUT, 4); ctx.restore();
  if (o.offended) { ctx.beginPath(); ctx.arc(20, -16, 9, Math.PI * 1.1, Math.PI * 1.9, true); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke(); }
  else { circle(ctx, 22, -18, 7); ctx.fillStyle = OUT; ctx.fill(); circle(ctx, 20, -20, 2.5); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(52, 22); ctx.quadraticCurveTo(62, 26, 70, 20); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(58, -112); ctx.rotate(0.9); rr(ctx, -8, -30, 16, 60, 6); fillStroke(ctx, '#e23b3b', OUT, 3); ctx.restore();
  ctx.restore();
  if (o.sniff) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 3 + i / 3) % 1; ctx.save(); ctx.globalAlpha = 1 - ph; ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + (o.facing || 1) * (175 + ph * 30) * s, y - 115 * s - i * 14, 10 + ph * 6, -0.6, 0.6); ctx.stroke(); ctx.restore();
    }
  }
}

// white gown on a mannequin
function drawGown(ctx, t, x, y, s, glow = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, -250, 10, 0, -250, 330);
    g.addColorStop(0, `rgba(255,255,240,${0.9 * glow})`); g.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = g; ctx.fillRect(-340, -600, 680, 640);
  }
  rr(ctx, -70, -12, 140, 20, 8); fillStroke(ctx, '#d8c6a8', OUT, 4);
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -60); ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40, -300); ctx.bezierCurveTo(-90, -200, -150, -100, -160, -50); ctx.quadraticCurveTo(0, -20, 160, -50); ctx.bezierCurveTo(150, -100, 90, -200, 40, -300); ctx.closePath();
  fillStroke(ctx, '#ffffff', OUT, 5);
  ctx.strokeStyle = '#d7dce6'; ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -290); ctx.quadraticCurveTo(i * 30, -160, i * 46, -48); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-44, -420); ctx.quadraticCurveTo(0, -400, 44, -420); ctx.lineTo(38, -300); ctx.lineTo(-38, -300); ctx.closePath(); fillStroke(ctx, '#fff', OUT, 5);
  ctx.beginPath(); ctx.moveTo(-40, -305); ctx.lineTo(40, -305); ctx.lineWidth = 8; ctx.strokeStyle = '#f3c6d3'; ctx.stroke();
  rr(ctx, -12, -450, 24, 34, 6); fillStroke(ctx, '#e9dcc8', OUT, 4);
  ell(ctx, 0, -476, 30, 34); fillStroke(ctx, '#e9dcc8', OUT, 4);
  for (let i = 0; i < 5; i++) sparkle(ctx, Math.sin(i * 2.3) * 120, -120 - i * 70, 0.5 + 0.4 * Math.sin(t * 5 + i), clamp(glow + 0.3));
  ctx.restore();
}

function drawWeddingCake(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(ctx, -150, -16, 300, 16, 6); fillStroke(ctx, '#d9dde6', OUT, 4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40); ctx.lineWidth = 14; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#d9dde6'; ctx.stroke();
  const tiers = [[130, 80], [96, 70], [64, 60]];
  let yy = -16;
  tiers.forEach(([w, h], i) => {
    const off = i === 2 ? (o.topSlide || 0) : 0;
    ctx.save(); ctx.translate(off * 160, off * 40); ctx.rotate(off * 0.6);
    rr(ctx, -w, yy - h, w * 2, h, 12); fillStroke(ctx, '#fff8ec', OUT, 5);
    ctx.beginPath(); for (let k = -w + 8; k <= w - 8; k += 16) { ctx.moveTo(k + 8, yy - h + 2); ctx.arc(k, yy - h + 2, 8, 0, Math.PI); } ctx.fillStyle = '#ffc2d1'; ctx.fill();
    for (let k = -w + 20; k < w; k += 32) { circle(ctx, k, yy - h * 0.45, 5); ctx.fillStyle = '#ff8fab'; ctx.fill(); }
    ctx.restore();
    yy -= h;
  });
  const faint = o.topperFaint || 0;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 18 + (o.topSlide || 0) * 160, yy); ctx.rotate(faint * sd * 1.3);
    rr(ctx, -9, -44, 18, 44, 6); fillStroke(ctx, sd < 0 ? '#fff' : '#23232e', OUT, 3);
    circle(ctx, 0, -54, 11); fillStroke(ctx, '#f2c6a0', OUT, 3);
    if (sd < 0) { ctx.beginPath(); ctx.moveTo(-10, -62); ctx.lineTo(-18, -20); ctx.lineTo(0, -60); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

// wall calendar with days crossed off
function drawCalendar(ctx, t, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.rot || 0);
  rr(ctx, -80, -90, 160, 180, 10); fillStroke(ctx, '#fff', OUT, 5);
  rr(ctx, -80, -90, 160, 44, 10); fillStroke(ctx, '#e23b3b', OUT, 5);
  boldText(ctx, o.title || 'JUNE', 0, -68, 26, '#fff', { stroke: 0, shadow: false });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const cx = -60 + c * 30, cy = -28 + r * 30, n = r * 5 + c;
    if (n === (o.circle || 17)) { ctx.beginPath(); ctx.arc(cx, cy, 15, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ff4f9a'; ctx.stroke(); boldText(ctx, '♥', cx, cy + 1, 18, '#ff4f9a', { stroke: 0, shadow: false, font: 'DejaVu Sans' }); }
    else if (n < (o.crossed || 7)) { ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.lineWidth = 3.5; ctx.strokeStyle = '#e23b3b'; ctx.stroke(); }
    else { circle(ctx, cx, cy, 3); ctx.fillStyle = '#9aa0ad'; ctx.fill(); }
  }
  ctx.restore();
}

// stopwatch overlay
function drawStopwatch(ctx, t, x, y, s, label) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(ctx, -22, -150, 44, 30, 8); fillStroke(ctx, '#c9d1dc', OUT, 5);
  circle(ctx, 0, 0, 130); fillStroke(ctx, '#f4f7fb', OUT, 8);
  circle(ctx, 0, 0, 108); fillStroke(ctx, '#fff', '#c9d1dc', 4);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 92, Math.sin(a) * 92); ctx.lineTo(Math.cos(a) * 104, Math.sin(a) * 104); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); }
  const a = t * 6 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.lineWidth = 7; ctx.strokeStyle = '#e23b3b'; ctx.lineCap = 'round'; ctx.stroke();
  circle(ctx, 0, 0, 10); ctx.fillStyle = OUT; ctx.fill();
  boldText(ctx, label, 0, 50, 46, '#1b1b22', { stroke: 0, shadow: false });
  ctx.restore();
}
