'use strict';
/* ------------------------------------------------------------------
   Close-ups and inserts:
   - CAM 3 CCTV footage
   - close-up of YOU (sweat, slow blink) + thought bubble
   - Larry pressed against the glass
   - Larry's "statement" card illustration
------------------------------------------------------------------- */

// grey-green CCTV palette version of Larry
const LARRY_CCTV = Object.assign({}, CH.larry, {
  skin: '#a9b5a1', hairC: '#46513f', topC: '#8a9783', topC2: '#76836f', pants: '#5d6956', socks: '#cbd5c3', shoes: '#384235', brow: '#3c4636',
});

function drawSquatter(ctx, ch, x, y, s, face, look, t, blink) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadowBlob(ctx, 0, 0, 30, 9, 0.35);
  // legs: knees up and out
  for (const side of [-1, 1]) {
    const hip = [side * 7, -24], knee = [side * 20, -46], foot = [side * 15, -2];
    line(ctx, hip[0], hip[1], knee[0], knee[1], ch.pants, 11);
    line(ctx, knee[0], knee[1], foot[0], foot[1], ch.skin, 8);
    line(ctx, lerp(knee[0], foot[0], 0.5), lerp(knee[1], foot[1], 0.5), foot[0], foot[1], ch.socks, 9);
    ellipse(ctx, foot[0] + side * 2, foot[1] + 1.5, 8, 4.4, ch.shoes);
  }
  // torso (crouched)
  rrect(ctx, -20, -86, 40, 60, 13, ch.topC);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(9, -84, 10, 56);
  // arms hugging knees
  for (const side of [-1, 1]) { line(ctx, side * 16, -78, side * 22, -48, ch.topC2, 9); circle(ctx, side * 22, -46, 5, ch.skin); }
  ctx.fillStyle = shade(ch.skin, 0.1); ctx.fillRect(-4.5, -94, 9, 9);
  drawSmallHead(ctx, ch, { face, look, eyes: 'normal', blink, brows: 'worried', mouth: 'flat', sweat: 1, sweatT: t * 0.8 }, face * 2, -112);
  ctx.restore();
}

// st: {zoom (1..), circle (0..1 draw progress), headFace, look, enhance (0..1 pixel burst), recBlink}
function drawCamFootage(ctx, t, w, h, st) {
  // background
  ctx.fillStyle = '#4f5b4d'; ctx.fillRect(0, 0, w, h);
  ctx.save();
  const zc = st.zoomC || [w * 0.62, h * 0.55];
  const z = st.zoom || 1;
  ctx.translate(zc[0], zc[1]); ctx.scale(z, z); ctx.translate(-zc[0], -zc[1]);
  // mall wall
  ctx.fillStyle = '#3c473b'; ctx.fillRect(-50, -50, w + 100, h * 0.3 + 50);
  ctx.fillStyle = '#2f392e'; ctx.fillRect(-50, h * 0.3, w + 100, 8);
  for (let k = 0; k < 4; k++) { ctx.fillStyle = '#334032'; ctx.fillRect(30 + k * 140, 20, 100, h * 0.22); ctx.fillStyle = 'rgba(200,220,190,0.05)'; ctx.fillRect(40 + k * 140, 25, 18, h * 0.2); }
  // floor tiles in perspective
  ctx.strokeStyle = 'rgba(220,235,210,0.08)'; ctx.lineWidth = 1.5;
  for (let k = -6; k <= 12; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * 40, h * 0.31); ctx.lineTo(w / 2 + k * 95, h + 40); ctx.stroke(); }
  for (let k = 0; k < 6; k++) { const yy = h * 0.31 + Math.pow(k / 6, 1.4) * h * 0.75; ctx.beginPath(); ctx.moveTo(-50, yy); ctx.lineTo(w + 50, yy); ctx.stroke(); }
  // fountain basin
  const fx = w * 0.42, fy = h * 0.6;
  ctx.fillStyle = '#6f7c6a'; ctx.beginPath(); ctx.ellipse(fx, fy + 22, 190, 60, 0, 0, Math.PI); ctx.lineTo(fx - 190, fy); ctx.ellipse(fx, fy, 190, 60, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ellipse(ctx, fx, fy, 190, 60, '#97a490');
  ellipse(ctx, fx, fy + 2, 174, 50, '#3f4f45');
  for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; ctx.beginPath(); ctx.ellipse(fx, fy + 2, 20 + ph * 150, (20 + ph * 150) * 0.29, 0, 0, TAU); ctx.strokeStyle = `rgba(210,230,205,${0.25 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
  // center column + bowl
  ctx.fillStyle = '#7e8b78'; ctx.fillRect(fx - 12, fy - 70, 24, 72);
  ellipse(ctx, fx, fy - 70, 54, 14, '#97a490'); ellipse(ctx, fx, fy - 71, 46, 10, '#4a5a4f');
  for (let k = 0; k < 10; k++) { const ph = (t * 1.5 + k * 0.1) % 1, side = k % 2 ? 1 : -1; circle(ctx, fx + side * (10 + ph * 40), fy - 92 + ph * ph * 30 - Math.sin(ph * 3) * 10, 1.6, 'rgba(225,240,220,0.7)'); }
  // smell cloud (the only color in the footage)
  const lx = w * 0.66, ly = h * 0.88;
  stinkCloud(ctx, lx + 6, ly - 70, 1.15 * (st.cloud || 1), t, 0.95, 4);
  // Larry squatting next to the basin
  drawSquatter(ctx, LARRY_CCTV, lx, ly, 1.35, st.headFace || 0, st.look || [0, 0], t, blinkAt(t, 9));
  ctx.restore();

  // red circle annotation
  if (st.circle > 0) {
    const cc = [(lx - zc[0]) * z + zc[0], (ly - 75 - zc[1]) * z + zc[1]];
    const rr = 92 * Math.min(z, 1.5);
    ctx.save(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    const a0 = -2.2, span = TAU * 1.08 * E.outC(st.circle);
    for (let k = 0; k <= 40; k++) { const a = a0 + span * k / 40; const wob = 1 + Math.sin(a * 3) * 0.04; const px = cc[0] + Math.cos(a) * rr * 1.05 * wob, py = cc[1] + Math.sin(a) * rr * 0.92 * wob; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke(); ctx.restore();
  }
  // CCTV treatment: scanlines, noise, vignette, tracking band
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; for (let yy = 0; yy < h; yy += 3) ctx.fillRect(0, yy, w, 1);
  const seed = Math.floor(t * 30);
  for (let k = 0; k < 260; k++) { const nx = hash(seed * 13.1 + k * 1.7) * w, ny = hash(seed * 7.7 + k * 3.1) * h; ctx.fillStyle = hash(k + seed) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(nx, ny, 2, 2); }
  const band = ((t * 0.35) % 1.3) * h;
  ctx.fillStyle = 'rgba(230,255,220,0.05)'; ctx.fillRect(0, band, w, 18);
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // HUD text
  const label = 'CAM 3 · MALL FOUNTAIN';
  const typed = st.typed === undefined ? label.length : Math.floor(st.typed * label.length);
  text(ctx, label.slice(0, typed), 16, 30, "700 17px 'Courier Prime'", '#f2f2ea');
  if ((st.recBlink === undefined ? Math.floor(t * 2) % 2 === 0 : st.recBlink)) { circle(ctx, w - 70, 24, 7, '#ff3b30'); }
  text(ctx, 'REC', w - 56, 30, "700 16px 'Courier Prime'", '#f2f2ea');
  const sec = 7 + Math.floor(Math.max(0, (st.clockT || 0)));
  const ts = `02:11:${String(sec % 60).padStart(2, '0')} AM`;
  if (st.tsFlash > 0) { ctx.fillStyle = `rgba(255,212,59,${0.85 * st.tsFlash})`; ctx.fillRect(10, h - 42, 190, 30); }
  text(ctx, ts, 16, h - 20, "700 18px 'Courier Prime'", st.tsFlash > 0.5 ? '#111' : '#f2f2ea');
  text(ctx, 'PLAZA LEVEL', w - 16, h - 20, "700 14px 'Courier Prime'", 'rgba(242,242,234,0.8)', 'right');
  if (st.enhance > 0) {
    ctx.save(); ctx.globalAlpha = st.enhance;
    const bx = w * 0.42, by = h * 0.16, bw = w * 0.44, bh = h * 0.74;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    for (const [cx, cy, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 22, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * 22); ctx.stroke(); }
    text(ctx, 'ENHANCE ×2', bx + 6, by - 8, "700 14px 'Courier Prime'", '#ffffff');
    ctx.restore();
  }
}

/* ---------- close-up of YOU (scene 6) ---------- */
function sceneCloseYou(ctx, t, st) {
  // background: blurred interrogation room under a hard lamp
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2b3140'); bg.addColorStop(0.6, '#1c212c'); bg.addColorStop(1, '#0d1017');
  ctx.fillStyle = bg; ctx.fillRect(-300, -300, W + 600, H + 600);
  // soft shapes (out of focus mirror + wall corner)
  ctx.fillStyle = 'rgba(70,80,100,0.35)'; ctx.fillRect(470, 160, 300, 260);
  ctx.fillStyle = 'rgba(20,24,34,0.35)'; ctx.fillRect(-20, 120, 140, 900);
  glow(ctx, 380, 120, 520, '#fff1c8', 0.22, 'screen');
  // table edge in the foreground
  ctx.fillStyle = '#5b606e'; ctx.beginPath(); ctx.moveTo(-50, 1080); ctx.lineTo(W + 50, 1010); ctx.lineTo(W + 50, H + 50); ctx.lineTo(-50, H + 50); ctx.closePath(); ctx.fill();

  const R = 150;
  const cx = 318 + Math.sin(t * 0.9) * 3, cy = 700 + Math.sin(t * 1.3) * 2;
  // slow blink 41.05 - 41.75
  const slow = kf(t, [[41.05, 0], [41.35, 1, E.ioS], [41.5, 1], [41.8, 0, E.ioS]]);
  const look = t < 41.0 ? [-0.6, 0.2] : t < 42.1 ? [0, 0.15] : t < 43.85 ? [0.75, -0.75] : [-0.2, 0.25];
  const mouth = t < 43.85 ? 'flat' : 'nervous';
  const sweat = [
    { x: 0.62, y: -0.55 + E.inQ(inv(40.9, 45.2, t)) * 0.95, s: 0.15, a: 1 },
  ];
  if (t > 43.4) sweat.push({ x: -0.7, y: -0.35 + E.inQ(inv(43.4, 45.4, t)) * 0.6, s: 0.12, a: clamp((t - 43.4) * 4) });
  const gulp = kf(t, [[44.55, 0], [44.7, 1], [44.95, 0]]);
  ctx.save(); ctx.translate(cx, cy);
  drawBust(ctx, CH.you, {
    face: t < 42.1 ? -0.25 : t < 43.85 ? 0.15 : -0.05, look, blink: Math.max(slow, slow > 0.01 ? 0 : blinkAt(t, 21)), eyes: 'normal',
    brows: 'worried', mouth, sweat, gulp, t,
  }, R);
  ctx.restore();
  // lamp light from above on the beanie
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const lg = ctx.createRadialGradient(360, 300, 20, 360, 300, 420);
  lg.addColorStop(0, 'rgba(255,240,210,0.6)'); lg.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  vignette(ctx, 0.7, 0.32);

  // thought bubble: locked mall toilets
  const tb = st.bubble || 0;
  if (tb > 0.01) drawToiletBubble(ctx, t, tb, cx, cy);
  return { head: [cx, cy] };
}

function drawToiletBubble(ctx, t, k, hx, hy) {
  const bx = 522, by = 452;
  const sc = E.outBack(clamp(k)) * 0.8;
  // trailing dots
  for (const [i, px, py, r] of [[0, bx - 98, by + 152, 9], [1, bx - 72, by + 118, 13]]) {
    const kk = clamp(k * 3 - i * 0.6);
    circle(ctx, px, py, r * kk, 'rgba(250,250,255,0.95)');
  }
  ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc);
  // cloud shape
  ctx.fillStyle = 'rgba(250,250,255,0.97)';
  ctx.beginPath();
  const puffs = [[-100, -40, 62], [-30, -78, 70], [60, -70, 66], [112, -10, 58], [80, 64, 64], [-10, 84, 66], [-98, 50, 60], [0, 0, 100]];
  for (const [px, py, pr] of puffs) { ctx.moveTo(px + pr, py); ctx.arc(px, py, pr, 0, TAU); }
  ctx.fill();
  // content: restroom door, chained + padlock
  const shakeL = t > 43.16 && t < 43.7 ? Math.sin((t - 43.16) * 60) * 4 * (1 - inv(43.16, 43.7, t)) : 0;
  ctx.save(); ctx.translate(-50, 0);
  rrect(ctx, -52, -86, 104, 168, 6, '#6f7d99');
  rrect(ctx, -44, -78, 88, 152, 4, '#8794b0');
  // WC sign
  rrect(ctx, -26, -70, 52, 26, 4, '#2f6fd1');
  text(ctx, 'WC', 0, -50, "800 19px 'Montserrat'", '#ffffff', 'center');
  // chain X
  ctx.strokeStyle = '#4d535f'; ctx.lineWidth = 4;
  for (const [a, b] of [[[-48, -20], [48, 50]], [[48, -20], [-48, 50]]]) {
    for (let i = 0; i <= 9; i++) { const u = i / 9; const px = lerp(a[0], b[0], u), py = lerp(a[1], b[1], u); ctx.beginPath(); ctx.ellipse(px, py, 5.5, 3.2, Math.atan2(b[1] - a[1], b[0] - a[0]) + (i % 2 ? Math.PI / 2 : 0), 0, TAU); ctx.stroke(); }
  }
  // padlock
  ctx.save(); ctx.translate(shakeL, 18);
  ctx.beginPath(); ctx.arc(0, -10, 13, Math.PI, 0); ctx.strokeStyle = '#9aa1ad'; ctx.lineWidth = 6; ctx.stroke();
  rrect(ctx, -19, -10, 38, 32, 6, '#e3b341'); circle(ctx, 0, 3, 4.5, '#5b4710'); ctx.fillStyle = '#5b4710'; ctx.fillRect(-1.6, 3, 3.2, 9);
  ctx.restore();
  // CLOSED sign
  ctx.save(); ctx.rotate(-0.08); rrect(ctx, -38, 52, 76, 24, 3, '#d8342f'); text(ctx, 'CLOSED', 0, 70, "800 16px 'Barlow Condensed'", '#fff', 'center'); ctx.restore();
  ctx.restore();
  // tiny Larry doing the potty dance (from 43.9)
  const dance = inv(43.85, 44.05, t);
  if (dance > 0) {
    ctx.save(); ctx.globalAlpha *= dance;
    const bounce = Math.abs(Math.sin(t * 13)) * 6;
    drawPerson(ctx, CH.larry, { x: 72, y: 70 - bounce, s: 0.62, face: -0.3, eyes: 'wide', look: [-1, 0], brows: 'worried', mouth: 'nervous', sweat: 1, sweatT: t * 2, arms: 'down', noShadow: false, kneesIn: 1 });
    // fly-off sweat drops
    for (let i = 0; i < 3; i++) { const ph = (t * 2.2 + i / 3) % 1; drop(ctx, 72 + (i - 1) * 18 * ph * 2, -35 - ph * 25 - bounce, 4, '#c8ecff', 1 - ph); }
    ctx.restore();
  }
  // ...and the inevitable
  if (t > 44.45) stinkCloud(ctx, 100, 20, 0.55, t, clamp((t - 44.45) * 3), 7);
  ctx.restore();
}

/* ---------- Larry pressed against the glass ---------- */
// drawn into a panel of width pw (centered at pcx)
function sceneLarryGlass(ctx, t, pcx, pw) {
  const x0 = pcx - pw / 2;
  // holding room behind the glass
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#39405a'); bg.addColorStop(1, '#1d2232');
  ctx.fillStyle = bg; ctx.fillRect(x0 - 50, -300, pw + 100, H + 600);
  // cinder block wall
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  for (let r = 0; r < 26; r++) { const yy = 120 + r * 34; ctx.beginPath(); ctx.moveTo(x0 - 50, yy); ctx.lineTo(x0 + pw + 50, yy); ctx.stroke(); for (let c = 0; c < 6; c++) { const xx = x0 - 50 + c * 80 + (r % 2) * 40; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 34); ctx.stroke(); } }
  // bench + floor
  ctx.fillStyle = '#262b3b'; ctx.fillRect(x0 - 50, 930, pw + 100, 500);
  ctx.fillStyle = '#4d4552'; ctx.fillRect(x0 + 10, 860, pw - 20, 26); ctx.fillStyle = '#3a3440'; ctx.fillRect(x0 + 10, 886, pw - 20, 50);
  glow(ctx, pcx, 230, 300, '#cfe0ff', 0.12, 'screen');
  // small smell cloud lingering behind Larry (running gag)
  stinkCloud(ctx, x0 + pw - 70, 830, 0.75, t, 0.8, 3);

  // Larry approaching then squishing onto the glass
  const appr = E.outBack(inv(55.35, 55.7, t));
  const R = lerp(70, 94, appr);
  const squish = kf(t, [[55.55, 0], [55.7, 1, E.outQ], [56.0, 0.85], [62.0, 0.85]]);
  const slide = kf(t, [[56.4, 0], [57.6, 18, E.ioS], [58.4, 12]]);
  const cy = lerp(600, 560, appr) + slide;
  // hands on the glass
  const handsOn = inv(55.62, 55.72, t);
  const typing = t >= 58.0 && t < 59.45;
  const ex = {
    face: 0, t,
    eyes: t > 61.1 ? 'teary' : t > 56.9 ? 'teary' : 'normal',
    look: t < 55.4 ? [0.2, 0.3] : [0, 0], blink: blinkAt(t, 13),
    brows: 'worried', mouth: squish > 0.3 ? (t > 57.0 && t < 58.0 ? 'talk' : 'squish') : 'frown',
    talk: t > 57.0 && t < 58.0 ? 0.35 + 0.35 * Math.abs(Math.sin(t * 9)) : 0,
    squish, tears: inv(56.8, 57.4, t), blush: 0.5,
  };
  if (typing) { ex.look = [0, 1]; ex.eyes = 'normal'; }
  if (t > 61.1) { ex.look = [0, -0.2]; }
  ctx.save(); ctx.translate(pcx, cy);
  drawBust(ctx, CH.larry, ex, R);
  ctx.restore();
  if (typing) {
    // phone in hands below face, thumbs typing
    const py = cy + R * 1.15;
    rrect(ctx, pcx - 26, py - 30, 52, 74, 7, '#1b1f2b');
    rrect(ctx, pcx - 21, py - 25, 42, 62, 4, '#cfe6ff');
    glow(ctx, pcx, py, 70, '#9cc9ff', 0.4);
    circle(ctx, pcx - 20 + Math.sin(t * 25) * 3, py + 18, 9, CH.larry.skin);
    circle(ctx, pcx + 20 + Math.cos(t * 23) * 3, py + 18, 9, CH.larry.skin);
  } else if (handsOn > 0) {
    // palms flat on the glass
    for (const side of [-1, 1]) {
      const hx = pcx + side * (R * 1.48), hy = cy - R * 0.3;
      ctx.save(); ctx.globalAlpha *= handsOn; ctx.translate(hx, hy); ctx.rotate(side * 0.15);
      ellipse(ctx, 0, 0, 30, 34, tint(CH.larry.skin, 0.12));
      for (let f = 0; f < 4; f++) { const fx = -18 + f * 12; rrect(ctx, fx - 5, -64 + Math.abs(f - 1.5) * 6, 10, 40, 5, tint(CH.larry.skin, 0.12)); }
      rrect(ctx, side < 0 ? 18 : -38, -6, 20, 10, 5, tint(CH.larry.skin, 0.12));
      ellipse(ctx, 0, 2, 22, 24, 'rgba(255,255,255,0.18)');
      ctx.restore();
    }
  }
  // breath fog on the glass
  if (squish > 0.3) {
    const fogA = 0.22 + 0.12 * Math.sin(t * 3.2);
    const fg = ctx.createRadialGradient(pcx, cy + R * 0.6, 5, pcx, cy + R * 0.6, R * 0.9);
    fg.addColorStop(0, `rgba(235,245,255,${fogA})`); fg.addColorStop(1, 'rgba(235,245,255,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(pcx, cy + R * 0.6, R * 0.95, R * 0.55, 0, 0, TAU); ctx.fill();
  }
  // mouthed "PLEASE"
  const pl = win(t, 57.0, 59.4, 0.15, 0.3);
  if (pl > 0) {
    ctx.save(); ctx.globalAlpha *= pl;
    ctx.setLineDash([5, 4]); rrect(ctx, pcx - 70, cy - R * 1.7 - 10, 140, 40, 18, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.75)', 2); ctx.setLineDash([]);
    text(ctx, 'PLEASE…', pcx, cy - R * 1.7 + 17, "italic 800 22px 'Montserrat'", '#ffffff', 'center');
    text(ctx, '(mouthing)', pcx, cy - R * 1.7 + 44, "italic 600 13px 'Montserrat'", 'rgba(255,255,255,0.7)', 'center');
    ctx.restore();
  }
  // glass reflections
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [k, wv] of [[0, 46], [1, 18], [2, 30]]) {
    const xx = x0 + 40 + k * 120 - 200 + ((t * 8) % 40);
    ctx.fillStyle = 'rgba(200,220,255,0.06)';
    ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx + wv, 0); ctx.lineTo(xx + wv + 420, H); ctx.lineTo(xx + 420, H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // glass frame edge
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, 0, 8, H);
  return { head: [pcx, cy] };
}

/* ---------- Larry's statement card (dropped phone) ---------- */
function drawStatementCard(ctx, t, x, y, k) {
  if (k <= 0.01) return;
  const sc = E.outBack(clamp(k));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.05); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-142 + 6, -128 + 8, 284, 256);
  ctx.fillStyle = '#f3efe4'; ctx.fillRect(-142, -128, 284, 256);
  ctx.fillStyle = '#2b2622'; ctx.fillRect(-142, -128, 284, 30);
  text(ctx, "LARRY'S STATEMENT", -130, -107, "700 15px 'Courier Prime'", '#f3efe4');
  text(ctx, '#1', 130, -107, "700 15px 'Courier Prime'", '#f2c94c', 'right');
  // illustration: fountain + falling phone
  ctx.save(); ctx.beginPath(); ctx.rect(-126, -88, 252, 150); ctx.clip();
  ctx.fillStyle = '#d9e4ec'; ctx.fillRect(-126, -88, 252, 150);
  ellipse(ctx, 0, 40, 120, 30, '#8f99ab'); ellipse(ctx, 0, 36, 108, 24, '#4e94c7');
  const fall = inv(23.35, 24.45, t);
  const py = lerp(-80, 30, E.inQ(fall));
  if (fall < 1) {
    ctx.save(); ctx.translate(10, py); ctx.rotate(fall * 4);
    rrect(ctx, -12, -20, 24, 40, 4, '#1d2230'); rrect(ctx, -9, -16, 18, 30, 2, '#7fb3e6');
    ctx.restore();
    for (let i = 0; i < 3; i++) line(ctx, -14 + i * 12, py - 34 - i * 4, -14 + i * 12, py - 54 - i * 4, 'rgba(40,50,70,0.4)', 2);
  } else {
    const sp = inv(24.45, 25.2, t);
    for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 8); const rr = 10 + sp * 50; circle(ctx, 10 + Math.cos(a) * rr, 32 + Math.sin(a) * rr * 0.9 + sp * sp * 30, 4 * (1 - sp * 0.7), '#7fc4f2'); }
    ctx.beginPath(); ctx.ellipse(10, 36, 18 + sp * 60, (18 + sp * 60) * 0.25, 0, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - sp)})`; ctx.lineWidth = 2; ctx.stroke();
    if (sp < 0.9) outlinedText(ctx, 'SPLASH!', 58, -30, "800 22px 'Montserrat'", '#2b7fd0', '#ffffff', 5);
  }
  // even the innocent version has a little cloud...
  if (t > 24.9) stinkCloud(ctx, -60, 30, 0.42, t, clamp((t - 24.9) * 2) * 0.9, 2);
  ctx.restore();
  text(ctx, '"I just dropped my phone."', 0, 94, "italic 700 15px 'Courier Prime'", '#2b2622', 'center');
  text(ctx, '— Larry, 2:47 AM', 0, 114, "400 12px 'Courier Prime'", '#6b625a', 'center');
  // skeptical red question mark
  const q = inv(25.3, 25.75, t);
  if (q > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(q * 2); ctx.translate(96, -20); ctx.rotate(0.15); ctx.scale(E.outBack(q), E.outBack(q));
    outlinedText(ctx, '?', 0, 30, "900 86px 'Montserrat'", '#e0352b', 'rgba(255,255,255,0.9)', 6);
    ctx.restore();
  }
  ctx.restore();
}
