'use strict';
/* ------------------------------------------------------------------
   Master timeline: scenes, cameras, transitions, overlays.
   renderAt(t) draws one deterministic frame for time t (seconds).
------------------------------------------------------------------- */
const DURATION = 71.5;
const FREEZE_AT = 68.05;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; return c; };
const layerC = mk(), lctx = layerC.getContext('2d');
const bufC = mk(), bctx = bufC.getContext('2d');
const tmpC = mk(), tctx = tmpC.getContext('2d');
const pixC = document.createElement('canvas'); pixC.width = 96; pixC.height = 62; const pctx = pixC.getContext('2d');
const footC = document.createElement('canvas'); footC.width = 550; footC.height = 354; const fctx = footC.getContext('2d');
const SC = cv.width / W;

let ENV = [];
const envAt = t => { const i = Math.round(t * 30); return i >= 0 && i < ENV.length ? ENV[i] : 0; };

/* ---------------- camera ---------------- */
function camApply(c, cam) {
  c.translate((cam.cx || 360) + (cam.sx || 0), 640 + (cam.sy || 0));
  if (cam.r) c.rotate(cam.r);
  c.scale(cam.z, cam.z);
  c.translate(-cam.fx, -cam.fy);
}
function camMap(cam, p) {
  let x = (p[0] - cam.fx) * cam.z, y = (p[1] - cam.fy) * cam.z;
  if (cam.r) { const cs = Math.cos(cam.r), sn = Math.sin(cam.r); [x, y] = [x * cs - y * sn, x * sn + y * cs]; }
  return [x + (cam.cx || 360) + (cam.sx || 0), y + 640 + (cam.sy || 0)];
}
const IMPACTS = [
  [3.78, 3, 6], [7.2, 3, 8], [16.75, 2.5, 9], [21.45, 9, 6], [27.42, 11, 6], [28.35, 3.5, 8], [38.2, 13, 5.5],
  [50.08, 3, 8], [50.65, 4, 8], [52.1, 12, 5.5], [55.65, 6, 7], [58.3, 4, 9], [62.82, 5, 7], [67.98, 7, 6],
];
function shakeAt(t) {
  let x = 0, y = 0;
  for (const [t0, a, d] of IMPACTS) {
    if (t < t0 || t > t0 + 1.5) continue;
    const k = a * Math.exp(-(t - t0) * d);
    x += noise1((t - t0) * 38 + t0 * 3) * k; y += noise1((t - t0) * 38 + 50 + t0) * k;
  }
  return [x, y];
}
function camFor(scene, t) {
  let c;
  if (scene === 'mall') c = { fx: kf(t, [[0, 350], [4.7, 400, E.ioS]]), fy: kf(t, [[0, 640], [4.7, 652, E.ioS]]), z: kf(t, [[0, 1.0], [4.7, 1.13, E.ioS]]) };
  else if (scene === 'bed') {
    const p = kf(t, [[5.2, [345, 640, 1.0]], [6.1, [330, 630, 1.04], E.ioS], [6.9, [262, 540, 1.38], E.ioC], [9.25, [268, 548, 1.4]], [10.1, [300, 590, 1.12], E.ioC], [11.8, [305, 600, 1.15]]]);
    c = { fx: p[0], fy: p[1], z: p[2] };
  } else if (scene === 'desk') {
    const p = kf(t, [[11.75, [330, 640, 1.0]], [14.5, [395, 610, 1.06], E.ioS], [15.2, [430, 590, 1.12], E.ioC], [18.1, [440, 590, 1.15]]]);
    c = { fx: p[0], fy: p[1], z: p[2] };
  } else if (scene === 'room') {
    const p = kf(t, [
      [18.0, [345, 600, 1.12]], [21.2, [352, 596, 1.13]], [22.3, [372, 590, 1.17], E.ioC], [26.9, [374, 588, 1.19]],
      [27.42, [384, 574, 1.3], E.outC], [28.2, [380, 584, 1.21], E.ioS], [40.45, [380, 588, 1.23]],
      [40.78, [306, 452, 3.6], E.inC],
      [45.3, [330, 560, 1.42]], [45.95, [386, 592, 1.18], E.outC], [50.2, [386, 580, 1.28], E.ioS], [53.6, [386, 582, 1.29]],
    ]);
    c = { fx: p[0], fy: p[1], z: p[2] };
  } else c = { fx: 360, fy: 640, z: 1 };
  const [sx, sy] = shakeAt(t);
  c.sx = sx; c.sy = sy;
  return c;
}

/* ---------------- helpers ---------------- */
function baseTransform(c) { c.setTransform(SC, 0, 0, SC, 0, 0); }
function drawToLayer(fn) {
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, layerC.width, layerC.height);
  baseTransform(lctx); fn(lctx);
}
function compositeLayer(alpha) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(layerC, 0, 0); ctx.restore();
}
function dimScreen(a) { if (a > 0.005) { ctx.fillStyle = `rgba(6,8,13,${a})`; ctx.fillRect(0, 0, W, H); } }

function glitch(t, I, fwd) {
  if (I <= 0.01) return;
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bufC.width, bufC.height); bctx.drawImage(cv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0c12'; ctx.fillRect(0, 0, cv.width, cv.height);
  const n = 32, sh = cv.height / n, seed = Math.floor(t * 24);
  for (let i = 0; i < n; i++) {
    const big = hash(i * 1.3 + seed * 0.7) > 0.72 ? 1 : 0.18;
    const off = (hash(i * 3.7 + seed) - 0.5) * 220 * I * big;
    ctx.drawImage(bufC, 0, i * sh, cv.width, sh, off, i * sh, cv.width, sh);
  }
  // red / cyan fringe
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'source-over'; tctx.drawImage(bufC, 0, 0);
  tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = '#ff2020'; tctx.fillRect(0, 0, tmpC.width, tmpC.height);
  tctx.globalCompositeOperation = 'source-over';
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55 * I; ctx.drawImage(tmpC, (fwd ? -1 : 1) * 16 * I, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // tint + scanlines + noise bars
  ctx.fillStyle = `rgba(${fwd ? '120,255,190' : '120,170,255'},${0.12 * I})`; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = `rgba(0,0,0,${0.25 * I})`; for (let y = 0; y < cv.height; y += 6) ctx.fillRect(0, y, cv.width, 2);
  for (let k = 0; k < 4; k++) { const yy = ((hash(k * 9.1 + seed * 0.3) + t * (fwd ? -1.5 : 1.5)) % 1 + 1) % 1 * cv.height; ctx.fillStyle = `rgba(255,255,255,${0.22 * I})`; ctx.fillRect(0, yy, cv.width, 6 + hash(k + seed) * 18); }
  ctx.restore();
  baseTransform(ctx);
  ctx.save(); ctx.globalAlpha = I * 0.85;
  outlinedText(ctx, fwd ? '▶▶' : '◀◀', 360, 640, "800 110px 'Inter'", 'rgba(255,255,255,0.9)', 'rgba(0,0,0,0.5)', 6);
  ctx.restore();
}

function desaturate(amount) {
  if (amount <= 0.01) return;
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bufC.width, bufC.height); bctx.drawImage(cv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `saturate(${1 - amount * 0.55}) brightness(${1 - amount * 0.12})`;
  ctx.drawImage(bufC, 0, 0); ctx.filter = 'none';
  ctx.restore();
}

/* ---------------- CAM 3 footage content ---------------- */
function camState(t, replay) {
  if (replay) return { zoom: 1.6, zoomC: [372, 232], circle: 1, headFace: Math.sin(t * 3) > 0 ? 1 : -1, look: [Math.sin(t * 3) > 0 ? 1 : -1, 0], typed: 1, clockT: t - 28.24, cloud: 1.3, recBlink: Math.floor(t * 2.5) % 2 === 0 };
  const hf = kf(t, [[33.65, 0], [33.85, -1, E.outBack], [34.75, -1], [34.97, 1, E.outBack], [35.85, 1], [36.3, 0.3]]);
  return {
    zoom: kf(t, [[31.95, 1], [32.4, 1.75, E.outC], [35.6, 1.75], [36.0, 1.35, E.ioC]]),
    zoomC: [372, 232],
    circle: inv(32.72, 33.15, t), headFace: hf, look: [hf, 0.1], typed: inv(28.24, 28.95, t),
    tsFlash: win(t, 30.45, 31.6, 0.05, 0.35), enhance: win(t, 31.98, 35.75, 0.1, 0.25), clockT: t - 28.24,
    cloud: 1 + 0.35 * inv(32.72, 33.0, t),
  };
}
function footageContent(t, replay) {
  return (c, w, h) => {
    const st = camState(t, replay);
    const pix = !replay ? win(t, 31.98, 32.32, 0.02, 0.2) : 0;
    if (pix > 0.05) {
      // pixelated "enhance" burst
      fctx.setTransform(1, 0, 0, 1, 0, 0); drawCamFootage(fctx, t, 550, 354, st);
      pctx.imageSmoothingEnabled = true; pctx.clearRect(0, 0, pixC.width, pixC.height);
      const q = Math.max(8, Math.round(lerp(550, 40, pix)));
      pixC.width = q; pixC.height = Math.round(q * 354 / 550);
      pctx.drawImage(footC, 0, 0, pixC.width, pixC.height);
      c.imageSmoothingEnabled = false; c.drawImage(pixC, 0, 0, w, h); c.imageSmoothingEnabled = true;
    } else {
      c.save(); c.scale(w / 550, h / 354); drawCamFootage(c, t, 550, 354, st); c.restore();
    }
  };
}

/* ---------------- portraits ---------------- */
function portraitPop(t, a, b) {
  if (t < a || t > b + 0.2) return 0;
  const inK = E.outBack(clamp((t - a) / 0.26));
  const outK = clamp((t - b) / 0.18);
  return inK * (1 - outK * 0.25);
}
function portraitAlpha(t, a, b) { return clamp((t - a) / 0.08) * (1 - clamp((t - b) / 0.18)); }

/* ---------------- main render ---------------- */
function renderAt(tReal) {
  const frozen = tReal >= FREEZE_AT;
  const t = frozen ? FREEZE_AT : tReal;
  const env = envAt(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1018'; ctx.fillRect(0, 0, cv.width, cv.height);
  baseTransform(ctx);
  let anchors = {}, cam = null;

  // ---------------- scenes ----------------
  if (t < 4.9) {
    cam = camFor('mall', t);
    ctx.save(); camApply(ctx, cam); anchors = sceneMall(ctx, t); ctx.restore();
  } else if (t < 11.75) {
    cam = camFor('bed', t);
    const bst = {
      buzz: Math.max(win(t, 6.15, 6.95, 0.04, 0.12), win(t, 7.15, 7.7, 0.04, 0.12)), lit: t > 6.15 ? clamp((t - 6.15) * 8) * (1 - inv(10.6, 11.2, t)) : 0,
      zzz: Math.max(win(t, 4.9, 6.2, 0.2, 0.2), win(t, 9.4, 11.75, 0.3, 0.1)), roll: E.ioC(inv(9.25, 9.85, t)),
      snore: t > 10.0 && Math.sin((t - 10.0) * 4.4) > 0, bubble: t > 10.35 ? 0.5 + 0.5 * Math.sin((t - 10.35) * 4.4 - 1.2) : 0, clock: '2:04',
    };
    ctx.save(); camApply(ctx, cam); anchors = sceneBedroom(ctx, t, bst); ctx.restore();
  } else if (t < 18.15) {
    cam = camFor('desk', t);
    ctx.save(); camApply(ctx, cam); anchors = sceneDesk(ctx, t, env); ctx.restore();
    if (t > 17.9) {
      const rc = camFor('room', t);
      drawToLayer(c => { c.save(); camApply(c, rc); sceneInterrogation(c, t, env); c.restore(); });
      compositeLayer(E.ioS(inv(17.9, 18.15, t)));
    }
  } else if (t < 40.78 || (t >= 45.3 && t < 53.6)) {
    cam = camFor('room', t);
    ctx.save(); camApply(ctx, cam); anchors = sceneInterrogation(ctx, t, env); ctx.restore();
    if (t > 40.66 && t < 40.78) {
      drawToLayer(c => sceneCloseYou(c, t, {}));
      compositeLayer(inv(40.66, 40.78, t));
    }
    if (t >= 45.3 && t < 45.42) { ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - inv(45.3, 45.42, t))})`; ctx.fillRect(0, 0, W, H); }
  } else if (t < 45.3) {
    cam = { fx: 360, fy: 640, z: 1 + (t - 40.78) * 0.012 };
    const [sx, sy] = shakeAt(t); cam.sx = sx; cam.sy = sy;
    ctx.save(); camApply(ctx, cam);
    anchors = sceneCloseYou(ctx, t, { bubble: win(t, 42.12, 45.2, 0.35, 0.15) });
    ctx.restore();
  } else {
    // ---- split screen: you | Larry ----
    const sk = E.ioC(inv(53.6, 54.15, t));
    const divX = lerp(720, 360, sk);
    const full = camFor('room', Math.min(t, 53.6));
    const tgt = { fx: 300, fy: 500, z: 1.62, cx: 180 };
    const push = inv(67.29, 68.0, t) * 0.05;
    const lc = { fx: lerp(full.fx, tgt.fx, sk), fy: lerp(full.fy, tgt.fy, sk), z: lerp(full.z, tgt.z, sk) + push, cx: lerp(360, 180, sk) };
    const [sx, sy] = shakeAt(t); lc.sx = sx * (t < 55 || t > 58 ? 1 : 0.3); lc.sy = sy;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, divX, H); ctx.clip();
    ctx.save(); camApply(ctx, lc); const ia = sceneInterrogation(ctx, t, env); ctx.restore();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(divX, 0, W - divX, H); ctx.clip();
    const gs = t > 55.6 && t < 56.3 ? shakeAt(t) : [0, 0];
    ctx.translate(gs[0], gs[1]);
    const pz = 1 + push;
    ctx.translate(divX + 180, 600); ctx.scale(pz, pz); ctx.translate(-(divX + 180), -600);
    const la = sceneLarryGlass(ctx, t, divX + 180, 360);
    ctx.restore();
    // divider
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(divX + 2, 0, 5, H);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(divX - 2, 0, 4, H);
    anchors = { youHead: camMap(lc, ia.youHead), larryHead: la.head };
    cam = null;
  }

  // ---------------- dimming for inserts ----------------
  const dim = Math.max(
    0.45 * win(t, 6.95, 9.75, 0.25, 0.3),
    0.58 * win(t, 28.12, 35.95, 0.3, 0.3), 0.36 * win(t, 35.9, 37.95, 0.2, 0.3),
    0.5 * win(t, 37.9, 40.25, 0.2, 0.3), 0.5 * win(t, 50.4, 53.65, 0.25, 0.25),
    0.42 * win(t, 58.1, 61.35, 0.25, 0.3), 0.35 * win(t, 62.55, 64.6, 0.2, 0.25),
  );
  dimScreen(dim);
  const toScreen = p => (cam && p ? camMap(cam, p) : p);

  // ---------------- inserts / cards ----------------
  // Larry's statement card
  drawStatementCard(ctx, t, 205, 520, inv(23.3, 23.62, t) - (t > 26.1 ? inv(26.1, 26.4, t) * 1.2 : 0));
  // CAM 3 evidence
  {
    const k = inv(28.12, 28.52, t), out = inv(37.85, 38.12, t);
    const sh = kf(t, [[35.85, 0], [36.2, 1, E.outC]]);
    ctx.save();
    ctx.translate(360, 573 - sh * 88); ctx.scale(1 - sh * 0.3, 1 - sh * 0.3); ctx.translate(-360, -573);
    drawEvidenceCard(ctx, t, k, out, 'EVIDENCE · CASE 24-0211', footageContent(t, false));
    ctx.restore();
  }
  // CAM replay: "the camera never lies"
  {
    const k = inv(62.55, 62.88, t), out = inv(64.32, 64.58, t);
    ctx.save(); ctx.translate(360, 566); ctx.scale(0.72, 0.72); ctx.translate(-360, -573);
    drawEvidenceCard(ctx, t, k, out, 'CAM 3 · REPLAY', footageContent(t, true));
    ctx.restore();
  }
  // violation card
  drawViolationCard(ctx, t, inv(50.42, 50.8, t), inv(53.45, 53.75, t), inv(52.08, 52.3, t));

  // ---------------- portraits ----------------
  const pt = (a, b, x, y, ch, ex, tailTo, rot) => {
    const pop = portraitPop(t, a, b), al = portraitAlpha(t, a, b);
    if (al <= 0) return;
    drawPortrait(ctx, { x, y, size: 186, rot: rot || -0.03, ch, ex, tail: tailTo, pop, alpha: al });
  };
  if (t >= 14.9 && t < 18.0) pt(14.95, 17.75, 572, 676, CH.officer, { face: -0.2, look: [-0.5, 0.1], blink: blinkAt(t, 31), talk: envAt(t) * ((t > 15.0 && t < 15.95) || (t > 16.2 && t < 17.6) ? 1 : 0), brows: t > 16.2 ? 'raised' : 'neutral', t }, toScreen(anchors.officerHead), 0.03);
  if (t >= 22.3 && t < 25.1) pt(22.35, 24.85, 576, 432, CH.detective, { face: -0.15, look: [-0.6, 0.1], blink: blinkAt(t, 41), talk: envAt(t) * (t < 24.75 ? 1 : 0), brows: 'skeptic', eyes: 'squint', t }, toScreen(anchors.detHead));
  if (t >= 26.45 && t < 28.2) pt(26.5, 27.95, 576, 432, CH.detective, { face: -0.1, look: [-0.7, 0.2], blink: 0, talk: envAt(t), brows: 'angry', eyes: t > 27.35 ? 'wide' : 'squint', t }, toScreen(anchors.detHead), 0.02);
  if (t >= 35.9 && t < 37.95) pt(35.95, 37.75, 584, 716, CH.detective, { face: -0.15, look: [-0.5, 0], blink: blinkAt(t, 43), talk: envAt(t), brows: 'skeptic', eyes: 'half', t }, toScreen(anchors.detHead), -0.02);
  if (t >= 45.3 && t < 50.45) pt(45.35, 50.25, 580, 436, CH.detective, { face: -0.2, look: t > 47.85 ? [-0.9, 0.3] : [-0.6, 0.15], blink: blinkAt(t, 47), talk: envAt(t), brows: t > 47.85 ? 'angry' : 'skeptic', eyes: t > 47.85 ? 'squint' : 'normal', t }, toScreen(anchors.detHead), 0.025);

  // ---------------- phones ----------------
  {
    const k = inv(6.95, 7.32, t), out = inv(9.45, 9.8, t);
    if (k > 0 && out < 1) drawPhone(ctx, t, { k: k, notif: inv(7.15, 7.45, t), buzz: win(t, 7.15, 7.75, 0.03, 0.15), time: '2:04', title: 'Larry 🚨', body: 'bro emergency 🚨', y: 545 + E.inC(out) * 900 });
    const k2 = inv(58.08, 58.42, t), out2 = inv(61.05, 61.38, t);
    if (k2 > 0 && out2 < 1) drawPhone(ctx, t, { k: k2, notif: inv(58.9, 59.2, t), buzz: win(t, 58.2, 59.0, 0.03, 0.15), time: '4:43', title: 'Larry', body: "don't tell them anything 😭", y: 530 + E.inC(out2) * 900 });
  }

  // ---------------- HUD ----------------
  drawClockHUD(ctx, t, 1);
  {
    const appear = inv(16.3, 16.62, t);
    const slam = kf(t, [[37.9, 0], [38.15, 1, E.outBack], [39.55, 1], [40.05, 0, E.ioC]]);
    const fx = lerp(FOLDER_POS[0], 150, slam) + (1 - E.outBack(appear)) * 360;
    const fy = lerp(FOLDER_POS[1], 438, slam);
    const amount = t < 38.2 ? (t < 16.72 ? '' : '$50') : '$500';
    const stampK = t >= 38.2 ? inv(38.2, 38.42, t) : inv(16.72, 16.9, t);
    if (slam > 0.02) dimScreen(0);
    drawFolder(ctx, t, fx, fy, lerp(1, 1.9, slam), amount, appear, stampK);
    if (t >= 38.2 && t < 39.8) {
      // ink burst + "x10"
      const k = inv(38.2, 38.5, t), out = inv(39.4, 39.8, t);
      ctx.save(); ctx.globalAlpha *= (1 - out);
      outlinedText(ctx, '×10', 520, 470 - k * 20, "900 52px 'Montserrat'", '#ff4848', '#ffffff', 7, 'center');
      ctx.restore();
    }
  }

  // ---------------- choice buttons ----------------
  const pulseB = frozen ? 0 : (t > 64.7 && t < 65.9 ? 0.5 + 0.5 * Math.sin(t * 9) : 0) + (t > 67.3 ? 0.5 + 0.5 * Math.sin(t * 7) : 0);
  const pulseR = frozen ? 0 : (t > 66.0 && t < 67.2 ? 0.5 + 0.5 * Math.sin(t * 9) : 0) + (t > 67.3 ? 0.5 + 0.5 * Math.sin(t * 7 + Math.PI) : 0);
  drawButton(ctx, t, 220, 765, 'SHOW THE TEXT', '#1f6ff0', inv(64.62, 64.96, tReal), pulseB);
  drawButton(ctx, t, 500, 765, 'PROTECT LARRY', '#d91f26', inv(65.92, 66.26, tReal), pulseR);

  // ---------------- captions ----------------
  if (tReal < FREEZE_AT + 0.2) drawCaptions(ctx, tReal);
  // ---------------- transitions / post ----------------
  if (t > 4.5 && t < 5.35) glitch(t, t < 4.9 ? E.inQ(inv(4.5, 4.9, t)) : 1 - E.outQ(inv(4.9, 5.35, t)), false);
  if (t > 11.5 && t < 12.1) glitch(t, t < 11.75 ? E.inQ(inv(11.5, 11.75, t)) : 1 - E.outQ(inv(11.75, 12.1, t)), true);
  if (frozen) {
    desaturate(clamp((tReal - FREEZE_AT) / 0.25));
    baseTransform(ctx);
    // re-draw buttons crisp on top of the frozen frame
    drawButton(ctx, t, 220, 765, 'SHOW THE TEXT', '#1f6ff0', 1, 0);
    drawButton(ctx, t, 500, 765, 'PROTECT LARRY', '#d91f26', 1, 0);
    drawClockHUD(ctx, t, 1);
    const fl = 1 - clamp((tReal - FREEZE_AT) / 0.18);
    if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fillRect(0, 0, W, H); }
    drawCTA(ctx, tReal, inv(68.3, 68.62, tReal));
  }
  // global film grain + edge vignette for cohesion
  baseTransform(ctx);
  vignette(ctx, 0.35, 0.45);
}

/* ---------------- boot ---------------- */
window.DURATION = DURATION;
window.renderAt = renderAt;
window.ready = (async () => {
  const [script, env] = await Promise.all([
    fetch('data/script.json').then(r => r.json()),
    fetch('data/vo_env.json').then(r => r.json()),
  ]);
  SCRIPT = script; ENV = env.env;
  await Promise.all([
    "800 37px 'Montserrat'", "900 40px 'Montserrat'", "700 40px 'Montserrat'", "600 20px 'Barlow Condensed'", "700 20px 'Barlow Condensed'", "800 20px 'Barlow Condensed'",
    "700 16px 'Courier Prime'", "400 16px 'Courier Prime'", "italic 700 16px 'Courier Prime'", "500 20px 'Inter'", "700 20px 'Inter'", "400 20px 'Inter'", "40px 'Noto Color Emoji'",
  ].map(f => document.fonts.load(f, f.includes('Emoji') ? '🔵🔴🚨😭' : 'AB12$')));
  await document.fonts.ready;
  renderAt(0);
  return true;
})();

/* ---------------- interactive preview (not used during capture) ---------------- */
if (!location.search.includes('capture')) {
  const audio = new Audio();
  audio.src = 'assets/final_mix.m4a';
  audio.onerror = () => { audio.src = 'assets/voiceover.mp3'; };
  const btn = document.getElementById('play'), bar = document.getElementById('seek');
  window.ready.then(() => {
    let playing = false;
    const loop = () => { if (!playing) return; const t = audio.currentTime; renderAt(Math.min(t, DURATION)); bar.value = t / DURATION * 1000; if (audio.ended || t >= DURATION) { playing = false; btn.textContent = '▶ Play'; } else requestAnimationFrame(loop); };
    btn.onclick = () => { if (playing) { audio.pause(); playing = false; btn.textContent = '▶ Play'; } else { audio.play(); playing = true; btn.textContent = '❚❚ Pause'; loop(); } };
    bar.oninput = () => { audio.currentTime = bar.value / 1000 * DURATION; renderAt(audio.currentTime); };
  });
}
