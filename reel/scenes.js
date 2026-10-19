/* Maa ki Lori — the eight scenes and the timeline, cut to the 'Luka Chuppi' excerpt. Depends on lib.js. */

const BEAT = 0.58, BAR = BEAT * 4;

function babyFig(ctx, o) {
  const { c: ctr, ang, len, th } = o, hr = o.headR;
  const draw = (c, mode, col) => {
    const ink = mode === 'mask' ? col : C.ink;
    c.save(); c.translate(ctr[0], ctr[1]); c.rotate(ang); if (o.front) c.scale(-1, 1); c.fillStyle = ink;
    c.beginPath();
    crPath(c, [[-len * 0.36, -th * 0.52], [-len * 0.05, -th * 0.56], [len * 0.36, -th * 0.42], [len * 0.5, -th * 0.05], [len * 0.38, th * 0.4], [0, th * 0.5], [-len * 0.38, th * 0.45]], true);
    c.fill();
    const hx = -len * 0.5, hy = -th * 0.06;
    // swaddle hood, the little face turned up, a tiny fist
    c.beginPath(); c.arc(hx + hr * 0.45, hy - hr * 0.1, hr * 1.18, 0, TAU); c.fill();
    c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
    c.beginPath(); c.arc(hx - hr * 0.15, hy - hr * 0.98, hr * 0.2, 0, TAU); c.fill();
    c.beginPath(); c.arc(-len * 0.12, -th * 0.62 + Math.sin((o.time || 0) * 2.2) * 3, hr * 0.28, 0, TAU); c.fill();
    if (mode === 'ink') {
      c.globalAlpha = 0.6; c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
      c.arc(hx + hr * 0.45, hy - hr * 0.1, hr * 1.0, Math.PI * 0.6, Math.PI * 1.4);
      c.moveTo(-len * 0.2, -th * 0.54); c.quadraticCurveTo(-len * 0.03, 0, -len * 0.18, th * 0.46);
      c.moveTo(len * 0.12, -th * 0.5); c.quadraticCurveTo(len * 0.27, 0, len * 0.12, th * 0.48);
      c.stroke();
    }
    c.restore();
  };
  const R = len * 0.75;
  figure(ctx, [ctr[0] - R, ctr[1] - R, 2 * R, 2 * R], draw, C.blue, { glow: 18 });
}

// Rising golden lullaby notes / stars.
function lullabyStars(ctx, mouth, t) {
  for (let i = 0; i < 40; i++) {
    const b = i * BEAT / 2 - 2 * BEAT, age = t - b;
    if (age < 0) continue;
    const r = rng(i * 77 + 3), r1 = r(), r2 = r(), r3 = r();
    const life = 5.4, settle = i % 3 === 0;
    const ag = settle ? Math.min(age, life * 0.8) : age;
    const x = mouth[0] + ag * (48 + 44 * r1) + Math.sin(ag * 1.4 + i) * 24;
    const y = mouth[1] - ag * (80 + 46 * r2) - ag * ag * 6;
    let a;
    if (settle && age > life * 0.8) a = 0.5 + 0.3 * Math.sin(t * 2 + i);
    else a = smooth(0, 0.35, age) * (1 - smooth(life * 0.6, life, age));
    const sz = (2.4 + 2.0 * r3) * (1 - 0.4 * clamp(ag / life));
    sparkle(ctx, x, y, sz, '255,196,100', a);
  }
}

// Backdrop shared by scenes 2 and 3.
function backdrop23(ctx, t) {
  const HZ = 1250;
  sky(ctx, { top: -300, horizon: HZ, seed: 202, n: 430, time: t });
  moon(ctx, 300, 420, 160);
  town(ctx, 13, HZ + 6, { temple: 905 });
  parapet(ctx, HZ);
  tank(ctx, 92, HZ + 88, 0.8);
  return clothesline(ctx, { x1: 150, x2: 790, yTop: 810, yBase: 1475, sag: 26 }, t);
}

// ---------------- Scene 1 – Lori ----------------
function scene1(ctx, t, u) {
  cam(ctx, lerp(1, 1.07, ease(u)), 520, 1250);
  const HZ = 1300;
  sky(ctx, { top: -300, horizon: HZ, seed: 101, n: 430, time: t });
  moon(ctx, 470, 1040, 270);
  town(ctx, 7, HZ + 6, { temple: 860 });
  parapet(ctx, HZ);
  tank(ctx, 1000, HZ + 100, 0.9);
  const rock = Math.sin(t * TAU / BAR);
  const P = {
    kind: 'maa', x: 400, y: 1640, h: 980, f: 1, sit: true, time: t,
    pose: { torso: 9 + rock * 3, look: 40 + rock * 3, aN: [20, 60], aF: [20, 60], lN: [84, -158], lF: [80, -163] },
  };
  // the baby rests across her lap; one hand pats it, the other cradles its head
  const J0 = solve(P);
  const len = 0.25 * P.h, th = 0.088 * P.h, ang = -0.22 + rock * 0.04;
  const bc = add(J0.S, [P.f * 0.215 * P.h, 0.205 * P.h + rock * 6]);
  const head = add(bc, [Math.cos(ang), Math.sin(ang)], len * 0.5);
  P.pose.aN = { ik: add(bc, [-0.03 * P.h + Math.sin(t * 3.4) * 4, -th * 0.42]) };
  P.pose.aF = { ik: add(bc, [0, th * 0.5]) };
  const J = drawFig(ctx, P);
  babyFig(ctx, { c: bc, ang, len, th, headR: 0.046 * P.h, time: t, front: true });
  drawFig(ctx, { ...P, only: 'nearHand' });
  softLight(ctx, head[0], head[1], 120, '170,210,255', 0.12);
  diya(ctx, 835, 1655, 1, t);
  lullabyStars(ctx, add(add(J.hc, J.nd, J.r * 0.95), J.hu, -J.r * 0.4), t);
}

// ---------------- Scene 2 – Hide and seek ----------------
function scene2(ctx, t, u) {
  cam(ctx, lerp(1, 1.04, u), 540, 1300);
  const lineY = backdrop23(ctx, t);
  const pk = smooth(0.2, 0.85, 0.5 + 0.5 * Math.sin(t * TAU / BAR - 1.2));
  const xb = 632;
  const JB = drawFig(ctx, {
    kind: 'beta', age: 5, x: 548 + pk * 30, y: 1484, h: 470, f: 1, time: t,
    pose: { torso: 6 + 24 * pk, look: 8 - 6 * pk, aN: { ik: J => [xb - 4, J.S[1] + 0.07 * J.s] }, aF: [-22, 38], lN: [14 + 6 * pk, -18], lF: [-10, -6] },
  });
  saree(ctx, { xa: 228, xb, len: 590, alpha: 0.93 }, lineY, t);
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.3 + i / 4) % 1;
    sparkle(ctx, JB.hc[0] + 36 + i * 14 + ph * 34, JB.hc[1] - 46 - ph * 70, 1.4 + (i % 2), '200,230,255', clamp((pk - 0.5) * 2) * Math.sin(ph * Math.PI) * 0.9);
  }
  // starlight dust trail from his feet back to where he ran from
  const P0 = [600, 1492], P1 = [720, 1500], P2 = [660, 1700], P3 = [880, 1714];
  for (let i = 0; i < 80; i++) {
    const r = rng(i * 13 + 5), tt = r(), p = bez(P0, P1, P2, P3, tt);
    const rise = (t * (10 + r() * 14) + r() * 40) % 46;
    const a = (1 - tt * 0.7) * (0.45 + 0.55 * Math.sin(t * (2 + r() * 3) + i)) * (1 - rise / 46);
    sparkle(ctx, p[0] + (r() - 0.5) * 34, p[1] + (r() - 0.5) * 16 - rise, 1.1 + r() * 1.9, '200,228,255', a);
  }
  diya(ctx, 640, 1716, 1, t);
  drawFig(ctx, {
    kind: 'maa', x: 800, y: 1682, h: 960, f: 1, time: t,
    pose: {
      torso: 3 + Math.sin(t * 3.2) * 1.6, look: 14 + Math.sin(t * 3.2) * 3,
      aN: { ik: J => add(J.eye, [-J.f * 0.04 * J.s, 0.05 * J.s]) }, aF: { ik: J => add(J.eye, [-J.f * 0.025 * J.s, 0.03 * J.s]) },
      lN: [3, -4], lF: [-3, -3],
    },
  });
}

// ---------------- Scene 3 – Found you ----------------
function scene3(ctx, t, u) {
  cam(ctx, lerp(1.0, 1.1, ease(u)), 640, 1150);
  const lineY = backdrop23(ctx, t);
  const pull = ease(smooth(0.1, 1.0, t)), jump = smooth(1.05, 2.2, t), glow = smooth(1.8, 2.8, t);
  const xb = lerp(632, 405, pull);
  const hm = 980;
  const PM = { kind: 'maa', x: 705, y: 1690, h: hm, f: -1, time: t, pose: { torso: lerp(4, -5, jump), look: lerp(8, 18, jump), aN: [20, 20], aF: [10, 10], lN: [3, -4], lF: [-3, -3] } };
  const JM0 = solve(PM);
  const bStand = { kind: 'beta', age: 5, x: 535, y: 1585, h: 560, f: 1, time: t, pose: { torso: 0, look: -16, aN: [150, 15], aF: [140, 20], lN: [4, -5], lF: [-4, -4] } };
  const JBs = solve(bStand);
  const held = [JM0.S[0] + JM0.f * 0.118 * hm, JM0.S[1] + 0.21 * hm];
  const hip = add(lerpv(JBs.hip, held, jump), [0, -Math.sin(jump * Math.PI) * 90]);
  const PB = {
    ...bStand, hipAt: hip,
    pose: {
      torso: lerp(0, -4, jump), look: lerp(-16, 6, jump),
      aN: { ik: J => lerpv(add(J.S, [J.f * 0.07 * J.s, -0.29 * J.s]), [JM0.nb[0] - JM0.f * 0.03 * hm, JM0.nb[1] + 0.025 * hm], jump) },
      aF: { ik: J => lerpv(add(J.S, [J.f * 0.03 * J.s, -0.3 * J.s]), [JM0.nb[0] - JM0.f * 0.02 * hm, JM0.nb[1] - 0.005 * hm], jump) },
      lN: [lerp(4, 72, jump), lerp(-5, -95, jump)], lF: [lerp(-4, 55, jump), lerp(-4, -100, jump)],
    },
  };
  const JB = solve(PB);
  const pullT = [xb + 12, lineY(xb) + 215];
  PM.pose.aN = { ik: lerpv(pullT, JB.T(0.5, -JB.tB(0.5) * 0.15), jump) };
  PM.pose.aF = { ik: lerpv(add(JM0.S, [JM0.f * 0.05 * hm, 0.3 * hm]), [JB.hip[0] - 0.02 * JB.s, JB.hip[1] + 0.05 * JB.s], jump) };
  if (jump < 0.5) drawFig(ctx, PB);
  saree(ctx, { xa: 228, xb, len: 590, bunch: pull }, lineY, t);
  const JM = drawFig(ctx, { ...PM, only: 'noNearArm' });
  if (jump >= 0.5) drawFig(ctx, PB);
  drawFig(ctx, { ...PM, only: 'nearArm' });
  diya(ctx, 330, 1712, 1, t);
  if (glow > 0) {
    const ctr = lerpv(JB.T(0.65, 0.06), JM.T(0.7, 0.07), 0.5);
    const pulse = 1 + 0.08 * Math.sin(t * 3);
    softLight(ctx, ctr[0] + 40, ctr[1], 260 * pulse, '255,190,100', 0.2 * glow);
    softLight(ctx, ctr[0] - 40, ctr[1], 240 * pulse, '140,190,255', 0.2 * glow);
    softLight(ctx, ctr[0], ctr[1], 110 * pulse, '255,250,235', 0.14 * glow);
    const sc = lerpv(JB.hc, JM.hc, 0.5), cy = sc[1] + 170;
    for (let i = 0; i < 46; i++) {
      for (let tr = 0; tr < 4; tr++) {
        const th = (i / 46) * TAU + (t - tr * 0.05) * 1.3;
        const rx = 300 + 34 * Math.sin(i * 1.7), ry = 120 + 20 * Math.cos(i * 2.3);
        const x = sc[0] + Math.cos(th) * rx, y = cy + Math.sin(th) * ry - Math.cos(th) * 60 - (i % 5) * 18;
        const depth = 0.55 + 0.45 * Math.sin(th);
        sparkle(ctx, x, y, (1.2 + (i % 3) * 0.6) * (1 - tr * 0.2), i % 2 ? '255,205,120' : '190,225,255', glow * depth * (1 - tr * 0.28) * 0.9);
      }
    }
  }
}

// ---------------- Scene 4 – Growing up ----------------
function s4state(t) {
  const dur = SCENES[3].dur;
  const x = lerp(95, 690, clamp(t / (dur - 0.1)));
  const age = 5 + 17 * clamp(t / (dur * 0.94));
  const h = lerp(0.62, 1.1, (age - 5) / 17) * 520 * 1.07;
  return {
    kind: 'beta', age, x, y: 1690, h, f: 1, time: t, pack: smooth(16, 20, age),
    pose: walkPose(t * Math.PI / BEAT, lerp(1, 0.8, (age - 5) / 17), { torso: lerp(3, 5, (age - 5) / 17), look: lerp(-4, 2, (age - 5) / 17) }),
  };
}
function scene4(ctx, t, u) {
  cam(ctx, lerp(1.04, 1.0, ease(u)), 540, 1400);
  const HZ = 1340;
  sky(ctx, { top: -300, horizon: HZ, seed: 404, n: 470, time: t });
  moon(ctx, 290, 540, 150);
  town(ctx, 19, HZ + 6, { temple: 640 });
  parapet(ctx, HZ, { ph: 44 });
  tank(ctx, 1000, HZ + 92, 0.72);
  clothesline(ctx, { x1: 70, x2: 560, yTop: 1060, yBase: 1470, sag: 18, saree: { xa: 150, xb: 470, len: 360 } }, t);
  stairwell(ctx, { x0: 770, x1: 1080, yF: 1712, yN: 1780, n: 5, railH: 60 });
  const JM = drawFig(ctx, {
    kind: 'maa', x: 880, y: 1585, h: 520, f: -1, time: t,
    pose: { torso: 2, look: 8, aN: { ik: J => add(J.S, [J.f * 0.2 * J.s, 0.13 * J.s]) }, aF: { ik: J => add(J.S, [J.f * 0.19 * J.s, 0.12 * J.s]) }, lN: [3, -4], lF: [-3, -3] },
  });
  diya(ctx, JM.armN.H[0] - 6, JM.armN.H[1] + 10, 0.55, t, { held: true, halo: 420 });
  // echoes of his younger selves
  for (const ga of [5, 11, 17]) {
    const tA = ((ga - 5) / 17) * SCENES[3].dur * 0.94;
    if (t < tA + 0.05) continue;
    const op = 0.34 * smooth(tA, tA + 0.35, t) * (1 - 0.45 * smooth(tA + 1.5, tA + 4.5, t));
    figure(ctx, ...(() => { const p = person(s4state(tA)); return [p.bbox, p.draw]; })(), C.blue, { opacity: op, glow: 16 });
  }
  drawFig(ctx, s4state(t));
}

// ---------------- Scene 5 – Goodbye ----------------
function scene5(ctx, t, u) {
  cam(ctx, lerp(1.0, 1.05, ease(u)), 540, 1350);
  const HZ = 1220;
  sky(ctx, { top: -300, horizon: HZ, seed: 505, n: 430, time: t });
  moon(ctx, 690, 610, 215);
  town(ctx, 29, HZ + 6);
  parapet(ctx, HZ);
  tank(ctx, 110, HZ + 92, 0.8);
  const SW = { x0: 40, x1: 560, yF: 1420, yN: 1565, n: 8, tw: 50, rh: 80, railH: 70 };
  const stepY = stairwell(ctx, SW);
  const wave = smooth(1.0, 1.8, t);
  const PM = {
    kind: 'maa', x: 640, y: 1500, h: 840, f: -1, time: t,
    pose: {
      torso: 2, look: lerp(10, 24, smooth(0, 3, t)),
      aN: { ik: J => add(J.S, [J.f * 0.15 * J.s, 0.27 * J.s]) },
      aF: [lerp(15, 152, wave), lerp(10, 20 + 14 * Math.sin(t * 5.5), wave), 10], lN: [3, -4], lF: [-3, -3],
    },
  };
  // golden diya light on the floor with her long shadow stretched across it
  const JM0 = solve(PM), F = [PM.x, PM.y];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(F[0] + 230, F[1] + 200); ctx.rotate(0.62); ctx.scale(1, 0.36);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 560);
  pool.addColorStop(0, 'rgba(255,170,80,0.34)'); pool.addColorStop(0.55, 'rgba(255,150,60,0.12)'); pool.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, 560, 0, TAU); ctx.fill();
  ctx.restore();
  for (const [col, blur] of [['rgba(255,190,100,0.55)', 6], ['rgba(2,4,14,0.82)', 2]]) {
    ctx.save(); ctx.filter = `blur(${blur}px)`;
    ctx.transform(1, 0, -0.42, -0.42, 0.42 * F[1], 1.42 * F[1]);
    if (blur > 3) { ctx.translate(-3, 2); }
    drawPerson(ctx, 'mask', col, PM, JM0);
    ctx.restore();
  }
  // Beta goes down the stairs, turning back once
  const dur = SCENES[4].dur, d = smooth(0, dur + 0.2, t), turned = t > 0.8 && t < dur - 0.9, bx = lerp(525, 130, d);
  ctx.save(); ctx.beginPath(); ctx.rect(-500, -3000, W + 1000, SW.yN + 3000); ctx.clip();
  drawFig(ctx, {
    kind: 'beta', age: 22, pack: 1, x: bx, y: stepY(bx) + 6, h: 930, f: -1, time: t,
    pose: { ...walkPose(t * Math.PI / (2 * BEAT), 0.55), torso: 6, back: turned, look: turned ? -18 : 4 },
  });
  ctx.restore();
  const JM = drawFig(ctx, PM);
  diya(ctx, JM.armN.H[0] - 10, JM.armN.H[1] + 12, 0.9, t, { held: true });
}

// ---------------- Scene 6 – Waiting ----------------
function scene6(ctx, t, u) {
  cam(ctx, lerp(1.1, 1.0, ease(u)), 450, 1450);
  const HZ = 1400;
  sky(ctx, { top: -300, horizon: HZ, seed: 606, n: 760, time: t, milky: true });
  const ss = smooth(2.4, 3.3, t);
  if (ss > 0 && ss < 1) {
    const p0 = [140, 260], p1 = [620, 520], x = lerp(p0[0], p1[0], ss), y = lerp(p0[1], p1[1], ss);
    glowPath(ctx, c => { c.moveTo(x, y); c.lineTo(x - 150, y - 81); }, 'rgba(230,240,255,0.8)', 1.6, 10, Math.sin(ss * Math.PI));
    sparkle(ctx, x, y, 1.8, '220,235,255', Math.sin(ss * Math.PI));
  }
  moon(ctx, 780, 600, 175);
  town(ctx, 37, HZ + 6, { temple: 180 });
  parapet(ctx, HZ);
  tank(ctx, 960, HZ + 92, 0.8);
  clothesline(ctx, { x1: 120, x2: 700, yTop: 1150, yBase: 1530, sag: 20 }, t);
  drawFig(ctx, {
    kind: 'maa', old: 1, x: 400, y: 1650, h: 620, f: 1, sit: true, time: t,
    pose: {
      torso: 24, look: -38 + 3 * Math.sin(t * 0.5),
      aN: { ik: J => [J.legN.K[0] - J.f * 0.03 * J.s, J.legN.K[1] - 0.07 * J.s] }, aF: { ik: J => [J.legF.K[0] - J.f * 0.06 * J.s, J.legF.K[1] - 0.075 * J.s] },
      lN: [84, -158], lF: [80, -163],
    },
  });
  diya(ctx, 575, 1656, 0.75, t);
}

// ---------------- Scene 7 – Far away ----------------
const cityCache = {};
function cityData() {
  if (cityCache.d) return cityCache.d;
  const r = rng(7070), far = [], near = [];
  for (let x = 230; x < W + 40;) { const w = 50 + r() * 70, top = lerp(1280, 1020, clamp((x - 230) / 700)) - r() * 120; far.push({ x, w, top, ant: r() < 0.3, seed: r() }); x += w + r() * 10; }
  for (let x = 300; x < W + 40;) { const w = 70 + r() * 90, top = lerp(1460, 1240, clamp((x - 300) / 600)) - r() * 90; near.push({ x, w, top, tank: r() < 0.35, seed: r() }); x += w + 4 + r() * 18; }
  return (cityCache.d = { far, near });
}
function cityLayer(ctx, list, o, t) {
  for (const b of list) {
    const path = c => c.rect(b.x, b.top, b.w, H + 200 - b.top);
    ctx.fillStyle = o.fill; ctx.beginPath(); path(ctx); ctx.fill();
    glowPath(ctx, path, o.line, 1.4, o.blur, o.alpha);
    if (b.ant) glowPath(ctx, c => { c.moveTo(b.x + b.w * 0.6, b.top); c.lineTo(b.x + b.w * 0.6, b.top - 46); }, o.line, 1.1, 5, o.alpha);
    if (b.tank) glowPath(ctx, c => c.rect(b.x + b.w * 0.2, b.top - 16, 22, 16), o.line, 1.1, 4, o.alpha * 0.8);
    const r = rng(Math.floor(b.seed * 1e6));
    for (let y = b.top + 16; y < H; y += o.gy) for (let x = b.x + 9; x < b.x + b.w - 8; x += o.gx) {
      const v = r();
      if (v < 0.55) continue;
      const warm = v > 0.93, tw = 0.75 + 0.25 * Math.sin(t * 0.7 + x * 0.3 + y);
      ctx.fillStyle = warm ? `rgba(255,200,120,${0.55 * tw})` : `rgba(180,210,255,${0.28 * tw})`;
      ctx.fillRect(x, y, o.ww, o.wh);
    }
  }
}
function scene7(ctx, t, u) {
  cam(ctx, lerp(1.04, 1.0, ease(u)), 540, 1100);
  const HZ = 1330;
  sky(ctx, { top: -300, horizon: HZ, seed: 707, n: 460, time: t });
  moon(ctx, 330, 560, 230);
  // far horizon with the small home rooftop
  ctx.fillStyle = '#050b22';
  ctx.beginPath(); ctx.moveTo(-50, HZ + 20);
  for (let x = -50; x <= 500; x += 25) ctx.lineTo(x, HZ - 8 - Math.sin(x * 0.012) * 10 - Math.sin(x * 0.031) * 4);
  ctx.lineTo(500, H); ctx.lineTo(-50, H); ctx.closePath(); ctx.fill();
  glowPath(ctx, c => { c.moveTo(-50, HZ - 8); for (let x = -50; x <= 500; x += 25) c.lineTo(x, HZ - 8 - Math.sin(x * 0.012) * 10 - Math.sin(x * 0.031) * 4); }, 'rgba(90,120,200,0.6)', 1.2, 5);
  const hx = 92, hy = HZ - 14;
  ctx.fillStyle = '#060c24'; ctx.fillRect(hx, hy - 20, 46, 22); ctx.fillRect(hx + 30, hy - 30, 9, 10);
  glowPath(ctx, c => { c.rect(hx, hy - 20, 46, 22); c.rect(hx + 30, hy - 30, 9, 10); }, 'rgba(120,150,220,0.8)', 1, 4);
  const home = [hx + 14, hy - 24];
  const done = smooth(4.4, 5.2, t);
  softLight(ctx, home[0], home[1], 46 + 30 * done, '255,180,90', 0.55 + 0.35 * done);
  sparkle(ctx, home[0], home[1], 1.6 + done, '255,210,130', 0.9);
  // city
  const cd = cityData();
  cityLayer(ctx, cd.far, { fill: '#071029', line: 'rgba(140,180,250,0.9)', blur: 6, alpha: 0.5, gx: 13, gy: 17, ww: 3, wh: 4 }, t);
  const hg = ctx.createLinearGradient(0, 1050, 0, 1500);
  hg.addColorStop(0, 'rgba(50,80,160,0)'); hg.addColorStop(1, 'rgba(50,80,160,0.22)');
  ctx.fillStyle = hg; ctx.fillRect(220, 1050, W, 460);
  cityLayer(ctx, cd.near, { fill: '#050a1f', line: 'rgba(175,210,255,0.95)', blur: 8, alpha: 0.75, gx: 17, gy: 22, ww: 4, wh: 6 }, t);
  // his apartment block on the right, with the balcony sticking out of it
  const BX = 930, line = 'rgba(170,200,255,0.9)';
  ctx.fillStyle = '#040816'; ctx.fillRect(BX, 560, W - BX + 60, H);
  glowPath(ctx, c => { c.moveTo(BX, H + 20); c.lineTo(BX, 560); c.lineTo(W + 40, 560); }, line, 1.6, 8, 0.8);
  for (let y = 600; y < H; y += 120) for (let x = BX + 28; x < W; x += 56) {
    if ((x * 7 + y * 3) % 5 === 0 && y < 1500) continue;
    const warm = (x + y) % 3 === 0;
    ctx.fillStyle = warm ? 'rgba(255,196,120,0.55)' : 'rgba(150,180,240,0.18)'; ctx.fillRect(x, y, 22, 34);
  }
  ctx.fillStyle = '#040816'; ctx.fillRect(BX - 20, 1060, 40, 600);
  ctx.fillStyle = 'rgba(255,190,110,0.16)'; ctx.fillRect(BX - 6, 1180, 16, 420);
  ctx.fillStyle = '#050a1c'; ctx.fillRect(520, 1600, BX - 520, 46);
  glowPath(ctx, c => { c.rect(520, 1600, BX - 520, 46); }, line, 1.6, 8, 0.85);
  const JB = drawFig(ctx, {
    kind: 'beta', age: 22, pack: 1, x: 760, y: 1600, h: 900, f: -1, time: t,
    pose: { torso: 5, look: -24 + Math.sin(t * 0.6) * 2, aN: { ik: [690, 1092] }, aF: { ik: [676, 1086] }, lN: [3, -4], lF: [-3, -3] },
  });
  ctx.fillStyle = '#040817'; ctx.fillRect(520, 1074, BX - 520, 10);
  glowPath(ctx, c => {
    c.moveTo(520, 1074); c.lineTo(BX, 1074); c.moveTo(520, 1084); c.lineTo(BX, 1084);
    for (let x = 520; x <= BX; x += 34) { c.moveTo(x, 1084); c.lineTo(x, 1600); }
  }, line, 1.5, 7, 0.75);
  // the golden thread, from his heart to home
  const st = JB.T(0.7, JB.tF(0.7) + 0.01), c1 = [st[0] - 250, st[1] - 270], c2 = [home[0] + 300, home[1] - 340];
  const p = ease(smooth(0.5, 4.8, t)), N = 140;
  if (p > 0) {
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(bez(st, c1, c2, home, (i / N) * p));
    for (const [w, a, b] of [[10, 0.18, 22], [4, 0.45, 12], [1.6, 0.95, 6]]) {
      glowPath(ctx, c => { c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); }, w > 3 ? '#ffb347' : '#ffe6a8', w, b, a);
    }
    for (let i = 0; i < 7; i++) {
      const s = ((t * 0.28 + i / 7) % 1) * p, q = bez(st, c1, c2, home, s);
      sparkle(ctx, q[0], q[1], 1.6 + (i % 2), '255,210,130', 0.85);
    }
    const tip = pts[pts.length - 1];
    sparkle(ctx, tip[0], tip[1], 2.6, '255,220,150', 1 - done * 0.6);
    softLight(ctx, st[0], st[1], 90, '255,190,100', 0.35);
  }
}

// ---------------- Scene 8 – Luka chuppi again ----------------
function scene8(ctx, t, u) {
  const rise = ease(smooth(6.4, 9.5, t));
  cam(ctx, 1, 540, 960, rise * 1700);
  const HZ = 1360;
  const fill = lerp(0.55, 1, smooth(4.8, 8.2, t));
  sky(ctx, { top: -2100, horizon: HZ, seed: 808, n: 1500, time: t, fill, milky: true });
  moon(ctx, 540, -720, 270, { glow: 1 + 0.6 * rise });
  town(ctx, 41, HZ + 6, { temple: 880 });
  parapet(ctx, HZ);
  tank(ctx, 995, HZ + 95, 0.85);
  const SW = { x0: 40, x1: 330, yF: 1500, yN: 1585, n: 5, railH: 66 };
  stairwell(ctx, SW);
  const hm = 900;
  const MP = { kind: 'maa', old: 1, x: 620, y: 1655, h: hm, f: 1, sit: true, time: t, pose: { torso: 15, look: -4, aN: [30, 50], aF: [30, 50], lN: [84, -158], lF: [80, -163] } };
  const JM0 = solve(MP);
  // Beta: up the stairs, across, kneel, cover her eyes
  const climb = smooth(0, 1.9, t), walk = smooth(1.9, 3.1, t), kneel = ease(smooth(3.05, 4.1, t));
  const bx = climb < 1 ? lerp(150, 290, climb) : lerp(290, 432, walk);
  const by = climb < 1 ? lerp(2000, 1560, ease(climb)) : lerp(1560, 1606, walk);
  const wp = walkPose(t * Math.PI / BEAT, (1 - kneel) * (climb < 1 ? 0.6 : 0.8 * (1 - smooth(2.8, 3.1, t))));
  const eyeT = add(JM0.eye, [-0.05 * hm, 0.008 * hm]), eyeT2 = add(JM0.eye, [-0.035 * hm, -0.02 * hm]);
  const BP = {
    kind: 'beta', age: 22, pack: 0, x: bx, y: by, h: 980, f: 1, time: t,
    pose: {
      torso: lerp(4, 6, kneel), look: lerp(0, 24, kneel),
      lN: [lerp(wp.lN[0], 75, kneel), lerp(wp.lN[1], -165, kneel)], lF: [lerp(wp.lF[0], 70, kneel), lerp(wp.lF[1], -168, kneel)],
      aN: { ik: J => lerpv(add(J.S, [J.f * 0.04 * J.s, 0.31 * J.s]), eyeT, kneel) },
      aF: { ik: J => lerpv(add(J.S, [-J.f * 0.02 * J.s, 0.31 * J.s]), eyeT2, kneel) },
    },
  };
  const hold = ease(smooth(4.5, 5.5, t));
  const JB = solve(BP);
  MP.pose.look = lerp(-4, -12, hold);
  MP.pose.aN = { ik: J => lerpv([J.legN.K[0] - J.f * 0.03 * J.s, J.legN.K[1] - 0.08 * J.s], add(lerpv(JB.armN.E, JB.armN.W, 0.62), [0, 0.035 * hm]), hold), bend: 1 };
  MP.pose.aF = { ik: J => [J.legF.K[0] - J.f * 0.06 * J.s, J.legF.K[1] - 0.08 * J.s] };
  if (climb < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-500, -3000, W + 1000, SW.yN + 3000); ctx.clip(); }
  drawFig(ctx, { ...BP, only: 'noNearArm' });
  if (climb < 1) ctx.restore();
  const JM = drawFig(ctx, { ...MP, only: 'noNearArm' });
  drawFig(ctx, { ...BP, only: 'nearArm' });
  drawFig(ctx, { ...MP, only: 'nearArm' });
  const I = lerp(1, 2.7, smooth(5.0, 6.8, t));
  diya(ctx, 830, 1662, 1.1, t, { intensity: I });
  const g = smooth(5.0, 6.0, t);
  if (g > 0) {
    softLight(ctx, JM.hc[0] - 20, JM.hc[1], 260, '255,190,100', 0.22 * g);
    softLight(ctx, JB.hc[0] - 10, JB.hc[1] + 40, 240, '140,190,255', 0.2 * g);
  }
  // a gold and a blue spark rise together to the moon
  const sp = smooth(6.7, 9.5, t);
  if (sp > 0) {
    const start = lerpv(JM.hc, JB.hc, 0.5), end = [540, -720];
    for (const [k, rgb] of [[0, '255,205,120'], [Math.PI, '190,225,255']]) {
      for (let tr = 0; tr < 6; tr++) {
        const e = ease(clamp(sp - tr * 0.012)), rad = 70 * (1 - e);
        const pos = add(lerpv(start, end, e), [Math.cos(t * 3 - tr * 0.15 + k) * rad, Math.sin(t * 3 - tr * 0.15 + k) * rad * 0.4]);
        sparkle(ctx, pos[0], pos[1], (2.6 - tr * 0.3), rgb, (1 - tr * 0.15) * (1 - smooth(0.92, 1, sp)));
      }
    }
  }
}

// ---------------- timeline ----------------
const SCENES = [
  { name: 'Lori', dur: 6.36, fn: scene1, still: 4.4 },               // intro
  { name: 'Hide and seek', dur: 4.4, fn: scene2, still: 3.34 },     // Luka chuppi bahut hui
  { name: 'Found you', dur: 4.8, fn: scene3, still: 3.9 },          // saamne aa jaa naa
  { name: 'Growing up', dur: 8.8, fn: scene4, still: 7.9 },         // kahaan kahaan dhoondha tujhe, thak gayi hai ab teri maa
  { name: 'Goodbye', dur: 5.4, fn: scene5, still: 3.4 },            // aaja saanjh hui, mujhe teri fikar
  { name: 'Waiting', dur: 7.18, fn: scene6, still: 3.0 },           // dhundhla gayi dekh meri nazar, aa jaa naa
  { name: 'Far away', dur: 8.64, fn: scene7, still: 6.5 },          // chanda tu hai kahaan, mere chanda tu hai kahaan
  { name: 'Luka chuppi again', dur: 9.8, fn: scene8, still: 5.9 }, // Luka chuppi bahut hui, saamne aa jaa naa
];
{ let acc = 0; for (const s of SCENES) { s.start = acc; acc += s.dur; } }
const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
const XF = 0.9;
const bufs = [document.createElement('canvas'), document.createElement('canvas')];
for (const b of bufs) { b.width = W; b.height = H; }

function renderScene(ctx, i, lt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#02050f'; ctx.fillRect(0, 0, W, H);
  SCENES[i].fn(ctx, lt, clamp(lt / SCENES[i].dur));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function renderAt(ctx, time) {
  let i = SCENES.findIndex(s => time < s.start + s.dur);
  if (i < 0) i = SCENES.length - 1;
  const s = SCENES[i];
  let a = -1, b = -1;
  if (i < SCENES.length - 1 && time > s.start + s.dur - XF / 2) { a = i; b = i + 1; }
  else if (i > 0 && time < s.start + XF / 2) { a = i - 1; b = i; }
  if (a >= 0) {
    const edge = SCENES[b].start, k = smooth(edge - XF / 2, edge + XF / 2, time);
    const ca = bufs[0].getContext('2d'), cb = bufs[1].getContext('2d');
    renderScene(ca, a, time - SCENES[a].start);
    renderScene(cb, b, time - SCENES[b].start);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(bufs[0], 0, 0);
    ctx.globalAlpha = k; ctx.drawImage(bufs[1], 0, 0); ctx.globalAlpha = 1;
  } else renderScene(ctx, i, time - s.start);
  finish(ctx, { seed: Math.round(time * 30) });
  const fade = Math.max(1 - smooth(0, 0.8, time), 0.85 * smooth(TOTAL - 0.8, TOTAL, time));
  if (fade > 0) { ctx.fillStyle = `rgba(2,5,15,${fade})`; ctx.fillRect(0, 0, W, H); }
}
function renderStill(ctx, i) {
  renderScene(ctx, i, SCENES[i].still);
  finish(ctx);
}
window.REEL = { W, H, SCENES, TOTAL, renderAt, renderStill };
