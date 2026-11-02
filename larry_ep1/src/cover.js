// Instagram Reels cover, 1080x1920. Drawn in the video's 720x1280 space, scaled 1.5x.
// Profile grid shows the centre 3:4 (logical y 160..1120), so all key content lives there.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
function titleLine(str, x, y, size, fill, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  boldText(ctx, str, 0, 8, size, '#1b1b22', { font: 'Luckiest Guy', stroke: size * 0.26, strokeColor: '#1b1b22', shadow: false }); // drop layer
  boldText(ctx, str, 0, 0, size, fill, { font: 'Luckiest Guy', stroke: size * 0.2, shadow: false });
  ctx.restore();
}
function hudBadge(label, value, valCol, x, y, rot, w = 170) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  rr(ctx, -w / 2, -52, w, 104, 16); ctx.fillStyle = 'rgba(16,18,28,0.95)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
  boldText(ctx, label, 0, -26, 22, '#fff', { stroke: 0, shadow: false });
  boldText(ctx, value, 0, 18, 56, valCol, { stroke: 7 });
  ctx.restore();
}
function renderCover(t = 1.37) {
  ctx.setTransform(1.5, 0, 0, 1.5, 0, 0);
  // background: comic burst
  speedLines(ctx, 360, 640, 0.6, '#ffc93c', '#ffb02e', 30, 0);
  const g = ctx.createRadialGradient(360, 660, 150, 360, 660, 900);
  g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(70,20,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // floating poops in the far background
  ctx.save(); ctx.globalAlpha = 0.22;
  [[70, 520, 1.3, -0.3], [650, 470, 1.1, 0.4], [90, 900, 1.0, 0.2], [640, 960, 1.4, -0.2]].forEach(([x, y, s, r]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); poopIcon(ctx, 0, 0, s, true); ctx.restore(); });
  ctx.restore();
  // Larry: holding it
  drawLarry(ctx, t, { x: 360, y: 1150, s: 1.08, legs: 'cross', pose: 'clutch', expr: 'panic', urgency: 0, sweat: 1, stink: 1.0, flies: 3, crumbs: 1, seed: 0.5, look: [0.3, -0.2] });
  // HUD badges beside his head
  hudBadge('DAYS LEFT', '10', '#ffd23f', 112, 610, -0.1, 160);
  hudBadge('POOP COUNT', '5', '#7cfc5a', 606, 640, 0.09, 180);
  // title
  titleLine('LARRY', 360, 238, 150, '#ffffff', -0.04);
  titleLine('POOPS', 360, 362, 112, '#9b5b2e', 0.03);
  titleLine('EVERYWHERE', 360, 468, 92, '#7cfc5a', -0.03);
  // episode pill (inside the grid crop)
  ctx.save(); ctx.translate(360, 1065); ctx.rotate(-0.02);
  rr(ctx, -290, -40, 580, 80, 40); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  boldText(ctx, "EP. 1 · HIS SISTER'S WEDDING", 0, 3, 40, '#fff', { stroke: 0 });
  ctx.restore();
  // bottom strip (full 9:16 only)
  ctx.fillStyle = '#1b1b22'; ctx.fillRect(0, 1150, W, 130);
  boldText(ctx, '10 DAYS. ONE RULE: NO POOP EMERGENCIES.', 360, 1205, 34, '#ffd23f', { stroke: 0, maxW: 660 });
}
window.READY = true;
