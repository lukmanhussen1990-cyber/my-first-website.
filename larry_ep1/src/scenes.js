// ---------- scene timeline (everything keyed to voiceover word times) ----------
const POLL_T = DUR - POLL_LEN;   // 86.0

function camAt(t, kfs) {
  let cur = { x: kfs[0].x, y: kfs[0].y, z: kfs[0].z, r: kfs[0].r || 0 };
  for (let i = 1; i < kfs.length; i++) {
    const k = kfs[i]; if (t < k.t) break;
    const p = E[k.e || 'inOut'](P(t, k.t, k.d === undefined ? 0.6 : k.d));
    cur = { x: lerp(cur.x, k.x, p), y: lerp(cur.y, k.y, p), z: lerp(cur.z, k.z, p), r: lerp(cur.r, k.r || 0, p) };
  }
  return cur;
}
function track(t, kfs) { // [[t, v, d]]
  let v = kfs[0][1];
  for (let i = 1; i < kfs.length; i++) { const [tt, vv, d] = kfs[i]; if (t < tt) break; v = lerp(v, vv, E.inOut(P(t, tt, d === undefined ? 0.3 : d))); }
  return v;
}
const PUNCH = [];
function punch(t0, amt = 0.07) { PUNCH.push([t0, amt]); }
function punchZ(t) { let z = 0; for (const [t0, a] of PUNCH) if (t >= t0 && t < t0 + 0.6) z += a * Math.exp(-(t - t0) * 9) * Math.sin(Math.min(1, (t - t0) / 0.06) * Math.PI / 2); return z; }

function countEvent(t, v, toot) {
  COUNT_EVENTS.push({ t, v });
  cue(t, 'pop', 0.9); cue(t + 0.02, toot, 0.85);
  punch(t, 0.09); shakeAt(t, 12, 0.35);
}

const SCENES = [];
function addScene(name, a, b, o) { SCENES.push(Object.assign({ name, a, b, capY: 985, whip: true }, o)); }

// =====================================================================
function buildTimeline() {
  // ---------------- HOOK + SETUP : Larry's room ----------------
  const R0 = 0, R1 = ws(34) - 0.15;
  const LAND = 0.32;
  const hookCounts = [ws(5), ws(6), ws(7)];
  cue(0.0, 'whoosh', 0.6); cue(LAND, 'thud', 1.0); cue(LAND + 0.02, 'boing', 0.55); shakeAt(LAND, 16, 0.3);
  countEvent(hookCounts[0], 1, 'toot1'); countEvent(hookCounts[1], 2, 'toot2'); countEvent(hookCounts[2], 3, 'toot3');
  RESET_T = ws(12) + 0.05; cue(RESET_T, 'rewind', 0.8); cue(RESET_T + 0.05, 'whistle', 0.7);
  cue(ws(20), 'sparkle', 0.5);
  cue(ws(23), 'snapzoom', 0.8); punch(ws(23), 0.05);
  cue(ws(26) + 0.12, 'ding', 0.6);
  cue(ws(28) + 0.05, 'crunch', 0.8); cue(ws(29) + 0.1, 'crunch', 0.7); cue(ws(31) - 0.05, 'crunch', 0.7);
  cue(ws(32), 'tada', 0.7); punch(ws(32), 0.05);
  addScene('room', R0, R1, {
    whip: false,
    cam: [
      { t: 0, x: 360, y: 690, z: 1.12 },
      { t: ws(3), x: 360, y: 680, z: 1.2, d: 1.2 },
      { t: ws(12) + 0.1, x: 600, y: 440, z: 1.75, d: 0.35, e: 'out' },
      { t: ws(17), x: 140, y: 520, z: 1.8, d: 0.5, e: 'inOut' },
      { t: ws(23) - 0.02, x: 360, y: 610, z: 2.0, d: 0.16, e: 'out' },
      { t: ws(26), x: 420, y: 600, z: 2.15, d: 0.3, e: 'out' },
      { t: ws(28), x: 360, y: 760, z: 1.65, d: 0.3, e: 'out' },
      { t: ws(32), x: 360, y: 690, z: 1.12, d: 0.25, e: 'out' },
    ],
    draw(ctx, t) {
      bgRoom(ctx, t, { photoGlow: clamp(P(t, ws(19), 0.3)) * (1 - P(t, ws(23), 0.2)) });
      const fall = t < LAND ? (1 - E.in(P(t, 0, LAND))) * 900 : 0;
      let squash = spring(t, LAND, -0.24, 2.4, 7);
      for (const hc of hookCounts) squash += spring(t, hc, 0.12, 3, 9);
      const hop = fall + hookCounts.reduce((a, hc) => a + (t > hc && t < hc + 0.25 ? Math.sin(P(t, hc, 0.25) * Math.PI) * 26 : 0), 0);
      const relief = hookCounts.some(hc => t >= hc && t < hc + 0.3);
      const pose = poseAt(t, [[0, 'idle'], [0.5, 'wave'], [ws(3), 'idle'], [ws(8), 'shrug'], [ws(12), 'idle'], [ws(20), 'clutch'], [ws(23), 'idle'], [ws(32), 'thumbs2']]);
      const expr = relief ? 'relief' : exprAt(t, [[0, 'neutral'], [ws(8), 'smug'], [ws(12), 'neutral'], [ws(19), 'worried'], [ws(23), 'neutral'], [ws(32), 'smug']]);
      drawLarry(ctx, t, {
        x: 360, y: 1062, s: 1, hop, squash, pose, expr, seed: 0.3,
        armWobble: t > 0.5 && t < ws(3) ? 0 : 0,
        armShakeR: t > 0.5 && t < ws(3) ? Math.sin(t * 14) * 30 : 0,
        crumbs: clamp(P(t, ws(28), we(31) - ws(28))),
        flies: t < hookCounts[0] ? 1 : t < hookCounts[1] ? 2 : 3,
        stink: Math.max(...hookCounts.map(hc => (t >= hc ? Math.exp(-(t - hc) * 1.2) : 0))) * 1.0 + 0.25,
        glint: t > ws(26) && t < ws(28) ? Math.sin(P(t, ws(26) + 0.1, 0.5) * Math.PI) : 0,
        thumb: pose === POSES.thumbs2 || t >= ws(32), thumbL: t >= ws(32) + 0.05,
        look: t >= ws(14) && t < ws(23) ? [-0.6, -0.8] : [0, 0],
        urgency: t > ws(20) && t < ws(23) ? 0.3 : 0,
      });
    },
    overlay(ctx, t) {
      // "10 DAYS TO THE WEDDING" banner
      if (t >= ws(12) && t < ws(23) + 0.2) {
        const k = E.back(P(t, ws(12) + 0.15, 0.3)) * (1 - E.in(P(t, ws(23) - 0.1, 0.25)));
        ctx.save(); ctx.translate(360, 390); ctx.scale(k, k); ctx.rotate(-0.03);
        rr(ctx, -250, -40, 500, 80, 18); ctx.fillStyle = '#1b1b22'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
        boldText(ctx, '10 DAYS TO THE WEDDING', 0, 3, 42, '#ffffff', { stroke: 0, shadow: false });
        ctx.restore();
      }
      // shame-o-meter
      if (t >= ws(32)) {
        const k = popScale(t, ws(32) + 0.1, 0.3);
        ctx.save(); ctx.translate(590, 560); ctx.scale(k, k); ctx.rotate(0.06);
        rr(ctx, -100, -66, 200, 132, 18); fillStroke(ctx, '#fff', OUT, 6);
        boldText(ctx, 'SHAME', 0, -38, 30, '#1b1b22', { stroke: 0, shadow: false });
        ctx.beginPath(); ctx.arc(0, 40, 62, Math.PI, 0); ctx.lineWidth = 16; ctx.strokeStyle = '#e9e9ef'; ctx.stroke();
        const needle = Math.PI + Math.max(0, Math.sin(t * 9)) * 0.05;
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(Math.cos(needle) * 58, 40 + Math.sin(needle) * 58); ctx.lineWidth = 6; ctx.strokeStyle = '#e23b3b'; ctx.lineCap = 'round'; ctx.stroke();
        boldText(ctx, '0%', 0, 26, 34, '#e23b3b', { stroke: 0, shadow: false });
        ctx.restore();
      }
    },
  });

  // ---------------- PHONE 1 ----------------
  const P1a = R1, P1b = ws(61) - 0.12;
  cue(P1a, 'swoosh', 0.8);
  const msgs1 = [
    { t: ws(37), from: 'her', text: 'Larry.' },
    { t: ws(40), from: 'her', text: 'Read this carefully.' },
    { t: ws(42) + 0.05, from: 'her', text: 'Rule #1: NO POOP EMERGENCIES.', kind: 'warning' },
    { t: ws(44), from: 'her', text: 'Please.' },
    { t: ws(45) + 0.05, from: 'her', text: 'Just one day.' },
    { t: ws(48), from: 'her', text: 'Hold it. 🙏' },
    { t: ws(56), from: 'me', text: '👍', kind: 'emoji', note: 'Sent from the toilet' },
  ];
  msgs1.forEach((m, i) => cue(m.t, m.kind === 'warning' ? 'alarm' : m.from === 'me' ? 'send' : 'msg', m.kind === 'warning' ? 0.6 : 0.7));
  cue(ws(56) + 0.08, 'boing', 0.5); shakeAt(ws(42) + 0.05, 10, 0.4);
  countEvent(ws(60), 1, 'toot2');
  addScene('phone1', P1a, P1b, {
    capY: 1150, whip: false,
    cam: [{ t: P1a, x: 360, y: 640, z: 1 }, { t: ws(42), x: 360, y: 640, z: 1.06, d: 0.3, e: 'out' }, { t: ws(50), x: 360, y: 700, z: 1.12, d: 1.5 }, { t: ws(56), x: 400, y: 820, z: 1.32, d: 0.25, e: 'out' }, { t: ws(58), x: 360, y: 660, z: 1.05, d: 0.4 }],
    draw(ctx, t) {
      bgPhone(ctx, t);
      const k = E.back(P(t, P1a, 0.4));
      ctx.save(); ctx.translate(0, (1 - k) * 900);
      drawPhone(ctx, t, { msgs: msgs1, shake: (t > ws(42) && t < ws(42) + 0.4 ? 1 : 0) + (t > ws(60) && t < ws(60) + 0.4 ? 1 : 0), typing: [ws(60) + 0.4, 99] });
      ctx.restore();
    },
    screenSpaceBG: true,
  });

  // ---------------- TITLE: "Ten days to survive" ----------------
  const T1a = P1b, T1b = ws(65) - 0.12;
  cue(ws(61), 'impact', 1.0); cue(ws(63), 'impact', 0.9); shakeAt(ws(61), 22, 0.4); shakeAt(ws(63), 18, 0.4);
  addScene('title', T1a, T1b, {
    capY: null,
    cam: [{ t: T1a, x: 360, y: 640, z: 1 }, { t: T1a + 0.1, x: 360, y: 640, z: 1.08, d: 1.5 }],
    draw(ctx, t) {
      ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-200, -200, 1200, 1700);
      ctx.translate(360, 640); ctx.rotate(-0.5); ctx.fillStyle = '#1b1b22';
      for (let i = -14; i < 14; i++) ctx.fillRect(i * 110 + ((t * 160) % 110), -1200, 55, 2400);
      ctx.restore();
      const g = ctx.createRadialGradient(360, 640, 200, 360, 640, 900); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = g; ctx.fillRect(-200, -200, 1200, 1700);
      drawLarry(ctx, t, { x: 360, y: 1560, s: 1.15, expr: 'panic', pose: 'face', urgency: 1, flies: 2, seed: 2 });
      const k1 = P(t, ws(61), 0.18), k2 = P(t, ws(63), 0.18);
      if (t >= ws(61)) { ctx.save(); ctx.translate(360, 520); const s = lerp(3, 1, E.out(k1)); ctx.scale(s, s); ctx.rotate(-0.06); boldText(ctx, '10 DAYS', 0, 0, 150, '#ffffff', { font: 'Luckiest Guy', stroke: 22 }); ctx.restore(); }
      if (t >= ws(63)) { ctx.save(); ctx.translate(360, 680); const s = lerp(3, 1, E.out(k2)); ctx.scale(s, s); ctx.rotate(0.04); boldText(ctx, 'TO SURVIVE', 0, 0, 96, '#ff4d4d', { font: 'Luckiest Guy', stroke: 18 }); ctx.restore(); }
    },
  });

  // ---------------- DRESS SHOP ----------------
  const D0 = T1b, D1 = ws(96) - 0.12;
  const walkIn = ws(70);
  cue(D0, 'whoosh', 0.8); cue(walkIn, 'bell', 0.7); cue(walkIn + 0.1, 'steps', 0.5);
  cue(ws(74), 'choir', 0.65);
  cue(ws(77), 'growl', 1.0); cue(ws(79), 'snapzoom', 0.6); shakeAt(ws(79), 14, 0.6); punch(ws(79), 0.06);
  cue(ws(84), 'rattle', 0.9); cue(ws(81), 'whoosh', 0.5);
  cue(ws(87), 'zoomout', 0.6); cue(ws(91), 'dundun', 0.8);
  countEvent(ws(95), 2, 'toot3'); cue(ws(95) + 0.35, 'gasp', 0.6);
  const ladies = [760, 890, 1020, 1150, 1280, 1410, 1540];
  addScene('dress', D0, D1, {
    cam: [
      { t: D0, x: 360, y: 640, z: 1.0 }, { t: D0 + 0.2, x: 360, y: 650, z: 1.06, d: 2.5 },
      { t: ws(73), x: 140, y: 610, z: 1.45, d: 0.45, e: 'out' },
      { t: ws(77) + 0.18, x: 420, y: 870, z: 2.1, d: 0.16, e: 'out' },
      { t: ws(81), x: 565, y: 640, z: 1.25, d: 0.22, e: 'out' },
      { t: ws(87) + 0.1, x: 900, y: 640, z: 0.62, d: 0.9, e: 'inOut' },
      { t: ws(95), x: 760, y: 700, z: 0.85, d: 0.25, e: 'out' },
    ],
    draw(ctx, t) {
      bgDress(ctx, t, { gownGlow: clamp(P(t, ws(73), 0.4)) * (1 - P(t, ws(77), 0.3)) + 0.15, occupied: t > ws(81), rattle: t > ws(84) && t < ws(87) });
      const relief = t > ws(95);
      // ladies
      ladies.forEach((lx, i) => {
        const faint = relief && (i === 1 || i === 4) ? E.out(P(t, ws(95) + 0.3 + i * 0.05, 0.4)) : 0;
        drawLady(ctx, t, lx, 1065, 1.15, i + 1, { tap: !relief, faint, arms: relief ? (i % 2 ? 'fan' : 'nose') : null, green: relief ? clamp(P(t, ws(95) + 0.2, 0.4)) : 0, eyes: relief ? 'closed' : 'annoyed', mouth: relief ? 'frown' : 'flat' });
      });
      // Larry
      let x = 420, legs = 'stand', ph = 0;
      if (t < walkIn) x = -260;
      else if (t < walkIn + 1.0) { const k = P(t, walkIn, 1.0); x = lerp(-260, 420, E.out(k)); legs = k < 0.85 ? 'walk' : 'stand'; ph = t * 11; }
      if (t >= ws(81)) { x = 450; legs = 'cross'; }
      const urg = track(t, [[0, 0.1], [ws(77), 0.7, 0.2], [ws(81), 0.8], [ws(87), 1.0], [ws(95), 0, 0.15]]);
      const pose = poseAt(t, [[0, 'idle'], [ws(77), 'clutch'], [ws(81), 'grab'], [ws(87), 'clutch'], [ws(95), 'idle']], 0.15);
      const expr = relief ? 'relief' : exprAt(t, [[0, 'neutral'], [ws(73), 'happy'], [ws(77), 'panic'], [ws(81), 'worried'], [ws(87), 'strain']]);
      drawLarry(ctx, t, {
        x, y: 1062, s: 1, legs, walkPhase: ph, pose, expr, urgency: relief ? 0 : urg, seed: 1.1,
        look: t >= ws(73) && t < ws(77) ? [-1, -0.2] : [0, 0],
        bellyPuff: t > ws(77) && t < ws(81) ? Math.abs(Math.sin(t * 18)) * 0.06 : 0,
        stink: relief ? 1.2 : 0.2, flies: 2, crumbs: 1,
        squash: spring(t, walkIn + 1.0, -0.12, 3, 8) + spring(t, ws(95), 0.15, 3, 8),
      });
      if (t > ws(77) && t < ws(81)) {
        // stomach rumble swirls
        ctx.save(); ctx.translate(x, 862); ctx.rotate(t * 6);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 36 + i * 18, i, i + 2.2); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(70,160,40,0.75)'; ctx.lineCap = 'round'; ctx.stroke(); }
        ctx.restore();
      }
    },
    overlay(ctx, t) {
      if (t > ws(77) + 0.15 && t < ws(81)) { ctx.save(); ctx.globalAlpha = 0.18; speedLines(ctx, 360, 640, t, 'rgba(0,0,0,0)', '#3a7a20', 26, 0.4); ctx.restore(); }
    },
  });

  // ---------------- CAKE TASTING ----------------
  const C0 = D1, C1 = ws(125) - 0.12;
  cue(C0, 'whoosh', 0.8); cue(C0 + 0.15, 'bell', 0.5);
  cue(ws(101), 'munch', 0.9); cue(ws(103), 'munch', 0.8);
  cue(ws(105), 'growl', 0.8); cue(ws(106) + 0.05, 'paper', 0.8); cue(ws(108) + 0.1, 'stamp', 1.0); shakeAt(ws(108) + 0.1, 10, 0.3);
  cue(ws(112), 'blip', 0.6);
  cue(ws(117), 'blip2', 0.6); cue(ws(117), 'boing', 0.4);
  cue(ws(121), 'buzzer', 0.8); shakeAt(ws(121), 14, 0.4); punch(ws(121), 0.06);
  countEvent(ws(124), 3, 'toot4'); cue(ws(124) + 0.35, 'slide', 0.6);
  addScene('cake', C0, C1, {
    cam: [
      { t: C0, x: 380, y: 640, z: 1.0 }, { t: C0 + 0.2, x: 400, y: 650, z: 1.05, d: 2.5 },
      { t: ws(100), x: 230, y: 660, z: 1.65, d: 0.3, e: 'out' },
      { t: ws(104), x: 240, y: 860, z: 1.45, d: 0.3, e: 'out' },
      { t: ws(109), x: 400, y: 640, z: 1.05, d: 0.3, e: 'out' },
      { t: ws(115), x: 250, y: 650, z: 1.4, d: 0.25, e: 'out' },
      { t: ws(122), x: 390, y: 640, z: 1.02, d: 0.3, e: 'out' },
    ],
    draw(ctx, t) {
      bgBakery(ctx, t);
      const ask = t >= ws(109) && t < ws(115);
      const sick = t > ws(124);
      drawBaker(ctx, t, 640, 1000, 0.95, { pose: sick ? 'cover' : ask ? 'ask' : 'present', talking: t > ws(112) && t < we(114), eyes: sick ? 'closed' : t > ws(119) ? 'wide' : 'normal', mouth: sick ? 'frown' : undefined, green: sick ? clamp(P(t, ws(124) + 0.2, 0.4)) : 0, brow: ask ? 0.5 : -0.2 });
      bakeryCounter(ctx, t);
      drawWeddingCake(ctx, t, 520, 800, 0.85, { topperFaint: sick ? E.out(P(t, ws(124) + 0.3, 0.4)) : 0, topSlide: sick ? E.inOut(P(t, ws(124) + 0.6, 0.8)) * 0.35 : 0 });
      const urg = track(t, [[0, 0.15], [ws(104), 0.75, 0.2], [ws(115), 0.95], [ws(124), 0, 0.15]]);
      const eating = t >= ws(100) && t < we(103) + 0.25;
      const pose = poseAt(t, [[0, 'idle'], [ws(100), 'eat'], [we(103) + 0.25, 'idle'], [ws(104), 'clutch'], [ws(115), 'thumbs'], [ws(122), 'clutch'], [ws(124), 'idle']], 0.15);
      const expr = sick ? 'relief' : exprAt(t, [[0, 'neutral'], [ws(101), 'chew'], [ws(104), 'panic'], [ws(109), 'worried'], [ws(115), 'fake']]);
      drawLarry(ctx, t, {
        x: 200, y: 1075, s: 0.95, pose, expr, urgency: urg, seed: 2.2, fork: eating, forkCake: eating && t < ws(101) + 0.1,
        thumb: t >= ws(115) && t < ws(122), lidAdd: t > ws(119) && t < ws(122) ? Math.max(0, Math.sin(t * 22)) * 0.5 : 0,
        bellyPuff: t > ws(104) && t < ws(109) ? Math.abs(Math.sin(t * 16)) * 0.05 : 0,
        stink: sick ? 1.1 : 0.2, flies: 2, crumbs: 1, squash: spring(t, ws(124), 0.14, 3, 8),
      });
      // complaint form from his stomach
      if (t > ws(106) && t < ws(110)) {
        const k = E.back(P(t, ws(106), 0.35)), out = E.in(P(t, ws(109) + 0.3, 0.4));
        ctx.save(); ctx.translate(lerp(200, 320, k) + out * 500, lerp(880, 760, k)); ctx.rotate(lerp(0.4, -0.08, k)); ctx.scale(k * 0.9, k * 0.9);
        rr(ctx, -110, -130, 220, 260, 8); fillStroke(ctx, '#fffdf3', OUT, 5);
        boldText(ctx, 'FORMAL', 0, -100, 28, '#1b1b22', { stroke: 0, shadow: false });
        boldText(ctx, 'COMPLAINT', 0, -68, 34, '#1b1b22', { stroke: 0, shadow: false });
        plainText(ctx, 'FROM: Stomach', -88, -20, 20, '#333', { weight: 700 });
        plainText(ctx, 'RE: Vanilla', -88, 12, 20, '#333', { weight: 700 });
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#c9cbd6'; ctx.fillRect(-88, 34 + i * 22, 170 - i * 30, 6); }
        ctx.restore();
        stamp(ctx, 'FILED', lerp(200, 320, k) + out * 500 + 20, lerp(880, 760, k) + 60, 44, t, ws(108) + 0.1, '#e23b3b', -0.25);
      }
      // speech bubbles
      if (t > ws(112) && t < ws(115) + 0.1) {
        const k = popScale(t, ws(112), 0.25);
        bubble(ctx, 560, 440, 290, 90, 610, 520, k);
        if (k > 0.5) boldText(ctx, 'Everything okay?', 560, 442, 36, '#1b1b22', { stroke: 0, shadow: false, font: 'Luckiest Guy' });
      }
      if (t > ws(117) && t < ws(122)) {
        const k = popScale(t, ws(117), 0.25);
        ctx.save(); ctx.translate(Math.sin(t * 50) * 2, 0);
        bubble(ctx, 330, 470, 290, 96, 250, 560, k, '#fffbe0');
        if (k > 0.5) boldText(ctx, 'GREAT CAKE!!', 330, 473, 44, '#e2725b', { stroke: 0, shadow: false, font: 'Luckiest Guy' });
        ctx.restore();
      }
    },
    overlay(ctx, t) {
      if (t > ws(121) - 0.05 && t < ws(122) + 0.2) {
        const k = popScale(t, ws(121) - 0.05, 0.2), on = Math.sin(t * 30) > -0.3;
        ctx.save(); ctx.translate(360, 850); ctx.scale(k, k); ctx.rotate(-0.05);
        rr(ctx, -230, -48, 460, 96, 16); ctx.fillStyle = on ? '#e23b3b' : '#9c1f1f'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
        boldText(ctx, 'LIE DETECTED', 0, 3, 58, '#fff', { stroke: 0 });
        ctx.restore();
      }
    },
  });

  // ---------------- CHURCH ----------------
  const H0 = C1, H1 = ws(140) - 0.1;
  cue(H0, 'organ', 0.75);
  cue(ws(129) + 0.2, 'crickets', 0.6);
  cue(ws(132) + 0.1, 'aah', 0.35);
  cue(ws(136), 'choir', 0.6); cue(ws(138), 'sparkle', 0.5);
  addScene('church', H0, H1, {
    cam: [
      { t: H0, x: 360, y: 640, z: 1.0 }, { t: H0 + 0.1, x: 360, y: 660, z: 1.1, d: 3.5 },
      { t: ws(132), x: 250, y: 560, z: 1.6, d: 0.4, e: 'out' },
      { t: ws(136) - 0.02, x: 470, y: 770, z: 1.3, d: 0.2, e: 'out' },
      { t: ws(136) + 0.3, x: 475, y: 760, z: 1.38, d: 2.0 },
    ],
    draw(ctx, t) {
      bgChurch(ctx, t);
      drawPriest(ctx, t, 230, 900, 0.75, { pose: 'pray', eyes: 'closed', mouth: 'flat', brow: 0.1 });
      if (t > ws(132)) { ctx.save(); ctx.globalAlpha = 0.35 * clamp(P(t, ws(132), 0.4)); const g = ctx.createRadialGradient(230, 560, 10, 230, 560, 150); g.addColorStop(0, '#fff7c2'); g.addColorStop(1, 'rgba(255,247,194,0)'); ctx.fillStyle = g; ctx.fillRect(60, 380, 340, 360); ctx.restore(); }
      churchPews(ctx, t);
      const praying = t >= ws(136);
      drawLarry(ctx, t, {
        x: 500, y: 1125, s: 0.92, pose: praying ? 'pray' : 'clutch', expr: praying ? 'pray' : exprAt(t, [[0, 'worried'], [ws(129), 'strain']]),
        urgency: praying ? 1 : 0.7, legs: 'cross', seed: 3.3, flies: 2, crumbs: 1, stink: 0.3,
        look: t < ws(132) ? [-0.8, -0.3] : [0, 0],
      });
      // shhh
      if (t > ws(129) && t < ws(132)) {
        for (let i = 0; i < 3; i++) { const k = P(t, ws(129) + i * 0.25, 1.4); if (k <= 0 || k >= 1) continue; ctx.globalAlpha = Math.sin(k * Math.PI); boldText(ctx, 'shhh...', 120 + i * 230, 700 - k * 120, 36, '#fff', { stroke: 6, font: 'Luckiest Guy' }); ctx.globalAlpha = 1; }
      }
      // thought bubble: glowing toilet
      if (praying) {
        const k = popScale(t, ws(137), 0.3);
        ctx.save(); ctx.translate(640, 590); ctx.scale(k, k);
        for (const [dx, dy, r] of [[-120, 120, 12], [-95, 90, 18]]) { circle(ctx, dx, dy, r); fillStroke(ctx, '#fff', OUT, 4); }
        circle(ctx, 0, 0, 92); fillStroke(ctx, '#fffbe6', OUT, 5);
        ctx.save(); circle(ctx, 0, 0, 88); ctx.clip(); ctx.rotate(t * 1.5);
        for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, -18); ctx.lineTo(120, 18); ctx.closePath(); ctx.fillStyle = 'rgba(255,210,63,0.45)'; ctx.fill(); }
        ctx.restore();
        toiletIcon(ctx, 0, 6, 0.9 + Math.sin(t * 6) * 0.04);
        ctx.restore();
      }
    },
  });

  // ---------------- CHURCH RESTROOM ----------------
  const B0 = H1, B1 = ws(156) - 0.12;
  cue(B0, 'whoosh', 0.6); cue(ws(142), 'creak', 0.9);
  cue(ws(146), 'scratch', 1.0); shakeAt(ws(146), 10, 0.3); punch(ws(146), 0.08);
  countEvent(ws(150), 4, 'flush');
  cue(ws(152), 'ticktock', 0.7);
  addScene('restroom', B0, B1, {
    cam: [
      { t: B0, x: 360, y: 640, z: 1.0 }, { t: B0 + 0.1, x: 360, y: 640, z: 1.05, d: 1.5 },
      { t: ws(146), x: 400, y: 560, z: 1.32, d: 0.14, e: 'out' },
      { t: ws(150), x: 360, y: 640, z: 1.05, d: 0.3, e: 'out' },
    ],
    draw(ctx, t) {
      const open = E.inOut(P(t, ws(142), 0.6));
      const pin = ws(144) - 0.1;
      const px = t < pin ? 900 : lerp(900, 610, E.out(P(t, pin, 0.7)));
      const shocked = t >= ws(146);
      bgRestroom(ctx, t, {
        doorOpen: open,
        drawPriest: () => { if (t > pin - 0.2) drawPriest(ctx, t, px, 980, 0.85, { pose: t > ws(150) + 0.2 ? 'nose' : shocked ? 'shock' : 'idle', eyes: shocked ? 'wide' : 'normal', mouth: shocked ? 'O' : 'smile', walk: t < pin + 0.7, green: t > ws(150) + 0.2 ? clamp(P(t, ws(150) + 0.2, 0.5)) : 0, brow: shocked ? 0.6 : 0.1 }); },
      });
      stallFeet(ctx, t, t < ws(150) ? 1 : 0.2);
      // Larry's eyes peeking over the stall
      if (t >= ws(146) - 0.05) {
        const rise = E.back(P(t, ws(146) - 0.05, 0.25));
        ctx.save(); ctx.beginPath(); ctx.rect(-200, -400, 1200, 652); ctx.clip();
        drawLarry(ctx, t, { x: 210, y: 655 + (1 - rise) * 120, s: 0.85, expr: t > ws(150) ? 'relief' : 'shocked', pose: 'idle', seed: 4 });
        ctx.restore();
        rr(ctx, -40, 250, 470, 30, 6); fillStroke(ctx, '#9cc5a8', OUT, 6);
      }
      if (t > ws(150)) stink(ctx, 210, 250, t, clamp(P(t, ws(150), 0.4)) * 1.2, 1.4);
      if (t > ws(148) && t < ws(151)) { ctx.save(); ctx.translate(Math.sin(t * 60) * 3, 0); ctx.restore(); }
    },
    overlay(ctx, t) {
      if (t >= ws(146) && t < ws(148)) {
        const k = popScale(t, ws(146) + 0.15, 0.2);
        ctx.save(); ctx.translate(360, 330); ctx.scale(k, k);
        boldText(ctx, '. . .', 0, 0, 90, '#fff', { stroke: 12, font: 'Luckiest Guy' });
        ctx.restore();
      }
      if (t >= ws(151) - 0.05) {
        const k = popScale(t, ws(151) - 0.05, 0.3);
        ctx.fillStyle = `rgba(10,12,30,${0.55 * clamp(P(t, ws(151) - 0.05, 0.2))})`; ctx.fillRect(0, 0, W, H);
        drawStopwatch(ctx, t, 360, 600, 1.15 * k, '6:00');
        if (k > 0.6) boldText(ctx, 'SINCE THE LAST ONE', 360, 820, 44, '#ffd23f', { stroke: 8 });
      }
    },
  });

  // ---------------- STREET ----------------
  const S0 = B1, S1 = ws(175) - 0.1;
  const runA = ws(156) - 0.05, runB = ws(158) + 0.45;
  const dogIn = ws(160), dogSniff = ws(164), dogOff = ws(166);
  cue(S0, 'whoosh', 0.6); cue(runA, 'zip', 0.8); cue(runB, 'skid', 0.8); shakeAt(runB, 8, 0.25);
  cue(dogSniff, 'sniff', 0.9); cue(dogSniff + 0.35, 'sniff', 0.8);
  cue(dogOff + 0.1, 'hmph', 0.8);
  cue(ws(170) + 0.1, 'tiltup', 0.6);
  addScene('street', S0, S1, {
    cam: [
      { t: S0, x: 330, y: 650, z: 1.0 },
      { t: dogSniff - 0.1, x: 420, y: 850, z: 1.35, d: 0.35, e: 'out' },
      { t: dogOff + 0.4, x: 420, y: 760, z: 1.12, d: 0.6 },
      { t: ws(170) + 0.1, x: 400, y: -320, z: 1.0, d: 1.1, e: 'inOut' },
    ],
    draw(ctx, t) {
      bgStreet(ctx, t);
      // sun high in the sky (revealed on tilt)
      drawSun(ctx, t, 470, -420, 1.0, {});
      // Larry runs in
      let x = 300, legs = 'cross', lean = 0, ph = 0;
      if (t < runB) { const k = P(t, runA, runB - runA); x = lerp(-320, 300, E.out(k)); legs = 'run'; lean = 0.14 * (1 - k); ph = t * 17; }
      const urg = track(t, [[0, 0.8], [dogOff, 0.9]]);
      const runPose = { L: [-118 + Math.sin(ph) * 50, -230 - Math.cos(ph) * 40], R: [118 - Math.sin(ph) * 50, -230 + Math.cos(ph) * 40] };
      drawLarry(ctx, t, {
        x, y: 1062, s: 1, legs, walkPhase: ph, lean, pose: legs === 'run' ? runPose : poseAt(t, [[0, 'clutch'], [dogOff, 'nose'], [ws(170), 'clutch']]),
        expr: exprAt(t, [[0, 'worried'], [dogSniff, 'panic'], [dogOff, 'sad']]), urgency: legs === 'run' ? 0 : urg, seed: 5,
        look: t >= ws(170) ? [0, -1] : t >= dogIn ? [0.8, 0.3] : [0, 0], flies: 3, crumbs: 1, stink: 0.5,
        squash: spring(t, runB, -0.16, 3, 8),
      });
      if (legs === 'run') { ctx.save(); ctx.strokeStyle = 'rgba(30,30,40,0.5)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const yy = 700 + i * 70; ctx.beginPath(); ctx.moveTo(x - 160 - i * 20, yy); ctx.lineTo(x - 300 - i * 30, yy); ctx.stroke(); } ctx.restore(); }
      if (t > runB && t < runB + 0.6) { const k = P(t, runB, 0.6); ctx.globalAlpha = 1 - k; puff(ctx, x - 90 - k * 60, 1040, 0.7 + k * 0.6, '#d9d0c4'); puff(ctx, x + 80 + k * 40, 1050, 0.5 + k * 0.5, '#d9d0c4'); ctx.globalAlpha = 1; }
      // dog
      if (t > dogIn - 0.1) {
        let dx, facing, walking = true, sniff = false, off = false;
        if (t < dogSniff) { dx = lerp(900, 520, E.out(P(t, dogIn, dogSniff - dogIn))); facing = -1; walking = t < dogSniff - 0.15; }
        else if (t < dogOff) { dx = 520; facing = -1; walking = false; sniff = true; }
        else { dx = lerp(520, 1000, E.in(P(t, dogOff + 0.25, 1.6))); facing = 1; off = true; walking = t > dogOff + 0.25; }
        drawDog(ctx, t, dx, 1075, 0.95, { facing, walking, sniff, offended: off });
        if (off && t < dogOff + 2.2) {
          const k = popScale(t, dogOff + 0.1, 0.25);
          bubble(ctx, dx + 40, 860, 150, 70, dx + 70, 940, k);
          if (k > 0.5) boldText(ctx, 'hmph.', dx + 40, 862, 38, '#1b1b22', { stroke: 0, shadow: false, font: 'Luckiest Guy' });
        }
      }
    },
  });

  // ---------------- SKY: the reversal ----------------
  const K0 = S1, K1 = ws(188) - 0.12;
  const shades = ws(183) + 0.05, curtains = ws(185) - 0.1, sign = ws(187) - 0.05;
  cue(ws(181), 'pop', 0.5);
  cue(shades, 'shades', 0.9); cue(curtains, 'curtain', 0.9); cue(ws(186), 'seen', 0.7); cue(sign + 0.1, 'thud', 0.6);
  cue(we(187) + 0.05, 'sadtrombone', 0.8);
  addScene('sky', K0, K1, {
    capY: 760, whip: false,
    cam: [{ t: K0, x: 360, y: 640, z: 1.0 }, { t: K0 + 0.05, x: 360, y: 610, z: 1.06, d: 4 }],
    draw(ctx, t) {
      const g = ctx.createLinearGradient(0, -200, 0, 1400); g.addColorStop(0, '#3d8fd6'); g.addColorStop(1, '#bfe6ff');
      ctx.fillStyle = g; ctx.fillRect(-200, -200, 1200, 1700);
      for (let i = 0; i < 4; i++) puff(ctx, ((i * 300 + t * 15) % 1100) - 200, 260 + (i % 2) * 380 + i * 40, 1.2, '#fff');
      drawSun(ctx, t, 360, 400, 1.15, { shades: t > shades ? P(t, shades, 0.35) : 0 });
      // cloud curtains
      const ck = E.out(P(t, curtains, 0.55));
      if (ck > 0) {
        for (const sd of [-1, 1]) {
          const cx = 360 + sd * lerp(560, 110, ck);
          for (let i = 0; i < 5; i++) puff(ctx, cx + sd * (i % 2) * 60, 240 + i * 80, 2.4, '#f4f8ff', '#9db8d6', 4);
        }
      }
      // CLOSED sign swinging from the clouds
      if (t > sign) {
        const k = E.out(P(t, sign, 0.25)), sw = spring(t, sign + 0.2, 0.35, 1.2, 1.8);
        ctx.save(); ctx.translate(360, lerp(-200, 330, k)); ctx.rotate(sw);
        ctx.beginPath(); ctx.moveTo(-80, -40); ctx.lineTo(0, -130); ctx.lineTo(80, -40); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        rr(ctx, -130, -40, 260, 100, 14); fillStroke(ctx, '#fff', OUT, 6);
        boldText(ctx, 'CLOSED', 0, 12, 64, '#e23b3b', { stroke: 0, shadow: false });
        ctx.restore();
      }
      // Larry kneeling, arms up
      drawLarry(ctx, t, { x: 360, y: 1420, s: 1.0, legs: 'kneel', pose: 'raise', expr: t > ws(186) ? 'sad' : 'worried', look: [0, -1], urgency: 0.6, seed: 6, flies: 2, crumbs: 1, sweat: 0.6 });
      // help? bubble + read receipt
      if (t > ws(181)) {
        const k = popScale(t, ws(181), 0.25);
        bubble(ctx, 560, 900, 150, 74, 470, 980, k);
        if (k > 0.5) boldText(ctx, 'help?', 560, 902, 40, '#1b1b22', { stroke: 0, shadow: false, font: 'Luckiest Guy' });
        if (t > ws(186)) { ctx.globalAlpha = clamp(P(t, ws(186), 0.15)); plainText(ctx, 'Seen ✓✓', 625, 960, 22, '#ffffff', { align: 'right', weight: 800 }); ctx.globalAlpha = 1; }
      }
    },
  });

  // ---------------- PHONE 2 ----------------
  const Q0 = K1, Q1 = POLL_T;
  const apology = 'Dear sister, I am so deeply sorry for everything my stomach has done, and everything it will do. You deserve a perfect day. I will be strong. I will hold it. I will';
  const typeA = ws(194), typeB = we(198) + 0.2, delA = ws(200) - 0.05, delB = we(201) + 0.05, kT = we(205) + 0.12;
  cue(Q0, 'swoosh', 0.8); cue(ws(191) - 0.05, 'msg', 0.8);
  cue(typeA, 'typing', 0.7); cue(delA, 'backspace', 0.8);
  cue(kT, 'key', 0.9); cue(ws(206), 'send', 0.9); cue(ws(206) + 0.06, 'thud', 0.5); punch(ws(206), 0.07);
  countEvent(ws(212), 5, 'toot5');
  const msgs2 = msgs1.concat([
    { t: ws(191) - 0.05, from: 'her', text: 'Larry?' },
    { t: ws(206), from: 'me', text: 'K', note: 'Sent from the toilet' },
  ]);
  addScene('phone2', Q0, Q1, {
    capY: 1150, whip: false,
    cam: [{ t: Q0, x: 360, y: 640, z: 1 }, { t: typeA, x: 360, y: 820, z: 1.28, d: 0.4, e: 'out' }, { t: ws(206), x: 360, y: 760, z: 1.18, d: 0.25, e: 'out' }, { t: ws(207), x: 360, y: 650, z: 1.02, d: 0.5 }],
    draw(ctx, t) {
      bgPhone(ctx, t, '#2d0b2a');
      let input = '';
      if (t >= typeA && t < delA) input = apology.slice(0, Math.floor(apology.length * E.inOut(P(t, typeA, typeB - typeA))));
      else if (t >= delA && t < delB) input = apology.slice(0, Math.floor(apology.length * (1 - P(t, delA, delB - delA))));
      else if (t >= kT && t < ws(206)) input = 'K';
      const k = E.back(P(t, Q0, 0.4));
      ctx.save(); ctx.translate(0, (1 - k) * 900);
      drawPhone(ctx, t, { msgs: msgs2, input, cursor: t >= typeA && t < ws(206), shake: (t > ws(212) && t < ws(212) + 0.5 ? 1 : 0), typing: [ws(207) + 0.2, 99] });
      ctx.restore();
      if (t > typeA + 0.3 && t < delA) { for (let i = 0; i < 4; i++) sparkle(ctx, 180 + i * 120, 760 + Math.sin(t * 4 + i) * 30, 0.5 + 0.3 * Math.sin(t * 7 + i), 0.9); }
    },
  });

  // ---------------- POLL ----------------
  const L0 = POLL_T;
  DAY2_T = DUR - 1.0;
  cue(L0, 'impact', 0.9); cue(L0 + 0.02, 'whoosh', 0.7);
  cue(ws(218), 'pop', 0.6); cue(ws(221), 'boing', 0.6); cue(ws(223), 'zip', 0.6);
  cue(ws(225), 'pop', 0.8); cue(ws(228), 'sparkle', 0.5);
  const TAP = we(233) + 0.6;
  cue(TAP, 'click', 0.9); cue(TAP + 0.05, 'confetti', 0.6);
  cue(DAY2_T, 'flip', 0.9); cue(DAY2_T + 0.05, 'rumble', 0.9); cue(DAY2_T + 0.1, 'sting', 0.8);
  addScene('poll', L0, DUR, {
    capY: 1112, whip: false,
    cam: [{ t: L0, x: 360, y: 640, z: 1 }],
    draw(ctx, t) {
      const k = E.out(P(t, L0, 0.35));
      // halves
      ctx.save(); ctx.translate(-(1 - k) * 380, 0);
      let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a0d17'); g.addColorStop(1, '#a01d2e'); ctx.fillStyle = g; ctx.fillRect(-20, 0, 380, H);
      ctx.restore();
      ctx.save(); ctx.translate((1 - k) * 380, 0);
      g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b4421'); g.addColorStop(1, '#16803c'); ctx.fillStyle = g; ctx.fillRect(360, 0, 380, H);
      ctx.restore();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(357, 250, 6, H);
      // header
      const hk = popScale(t, L0 + 0.15, 0.3) * (1 + (t > ws(218) && t < ws(218) + 0.3 ? Math.sin(P(t, ws(218), 0.3) * Math.PI) * 0.12 : 0));
      ctx.save(); ctx.translate(360, 296); ctx.scale(hk, hk);
      rr(ctx, -250, -34, 500, 68, 34); ctx.fillStyle = '#1b1b22'; ctx.fill();
      boldText(ctx, 'COMMENT ONE WORD', 0, 2, 46, '#ffd23f', { stroke: 0 });
      ctx.restore();
      // titles
      const lb = 1 + (t > ws(221) && t < ws(221) + 0.45 ? Math.sin(P(t, ws(221), 0.45) * Math.PI) * 0.2 : 0) + Math.sin(t * 4) * 0.02;
      const rb = 1 + (t > ws(223) && t < ws(223) + 0.45 ? Math.sin(P(t, ws(223), 0.45) * Math.PI) * 0.2 : 0) + Math.sin(t * 4 + 1.5) * 0.02;
      const tk = popScale(t, L0 + 0.25, 0.3);
      ctx.save(); ctx.translate(180, 400); ctx.scale(tk * lb, tk * lb); boldText(ctx, 'HOLD IT', 0, 0, 84, '#ffd23f', { stroke: 12 }); ctx.restore();
      ctx.save(); ctx.translate(540, 400); ctx.scale(tk * rb, tk * rb); boldText(ctx, 'RUN', 0, 0, 92, '#5fd4ff', { stroke: 12 }); ctx.restore();
      if (tk > 0.5) {
        boldText(ctx, '10 DAYS. ZERO BREAKS.', 180, 466, 26, '#ffffff', { stroke: 5 });
        boldText(ctx, 'ANY BATHROOM. ANYWHERE.', 540, 466, 26, '#ffffff', { stroke: 5 });
      }
      // left Larry: holding it
      drawLarry(ctx, t, { x: 180, y: 960, s: 0.66, legs: 'cross', pose: 'clutch', expr: 'strain', urgency: 1, seed: 7, flies: 1, crumbs: 1, squash: Math.sin(t * 9) * 0.02 + (t > ws(221) && t < ws(221) + 0.5 ? spring(t, ws(221), 0.12, 3, 7) : 0) });
      // right Larry: running in place
      const ph = t * 16;
      const runPose = { L: [-118 + Math.sin(ph) * 50, -230 - Math.cos(ph) * 40], R: [118 - Math.sin(ph) * 50, -230 + Math.cos(ph) * 40] };
      drawLarry(ctx, t, { x: 540, y: 960, s: 0.66, legs: 'run', walkPhase: ph, lean: 0.1, pose: runPose, expr: 'panic', seed: 8, flies: 1, crumbs: 1, stink: 0.4 });
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const yy = 700 + i * 50; ctx.beginPath(); ctx.moveTo(430 - i * 8, yy); ctx.lineTo(395 - i * 12, yy); ctx.stroke(); }
      ctx.restore();
      // WC sign
      ctx.save(); ctx.translate(650, 560); ctx.rotate(Math.sin(t * 3) * 0.05);
      rr(ctx, -46, -36, 92, 72, 12); fillStroke(ctx, '#2f8bff', OUT, 5);
      boldText(ctx, 'WC →', 0, 2, 34, '#fff', { stroke: 0, shadow: false });
      ctx.restore();
      // VOTE NOW button
      if (t >= ws(225) - 0.05) {
        const bk = popScale(t, ws(225) - 0.05, 0.3);
        const press = t > TAP && t < TAP + 0.25 ? 1 - Math.sin(P(t, TAP, 0.25) * Math.PI) * 0.12 : 1;
        const pulse = 1 + Math.sin(t * 7) * 0.035;
        ctx.save(); ctx.translate(360, 1020); ctx.scale(bk * pulse * press, bk * pulse * press);
        rr(ctx, -165, -36, 330, 82, 41); ctx.fillStyle = '#b8860b'; ctx.fill();
        rr(ctx, -165, -44, 330, 82, 41); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        boldText(ctx, 'VOTE NOW', 0, -2, 50, '#1b1b22', { stroke: 0, shadow: false });
        ctx.restore();
        // tapping hand
        if (t > we(233)) {
          const hk = E.out(P(t, we(233), 0.4)), tap = t > TAP - 0.1 && t < TAP + 0.25 ? Math.sin(P(t, TAP - 0.1, 0.35) * Math.PI) * 14 : 0;
          ctx.save(); ctx.translate(lerp(620, 470, hk), lerp(1240, 1060, hk) + tap); ctx.rotate(-0.4); ctx.font = '74px "Noto Color Emoji"'; ctx.textAlign = 'center'; ctx.fillText('👆', 0, 0); ctx.restore();
        }
        if (t > TAP) {
          for (let i = 0; i < 26; i++) {
            const a = hash(i) * TAU, sp = 300 + hash(i + 5) * 500, d = t - TAP; if (d > 1.2) continue;
            const cx = 360 + Math.cos(a) * sp * d, cy = 1000 + Math.sin(a) * sp * d + 600 * d * d;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(d * 10 + i); ctx.fillStyle = ['#ffd23f', '#ff6fb5', '#5fd4ff', '#7cfc5a'][i % 4]; ctx.fillRect(-7, -4, 14, 8); ctx.restore();
          }
        }
      }
      if (t >= ws(228)) {
        const a = clamp(P(t, ws(228), 0.3));
        ctx.globalAlpha = a;
        boldText(ctx, 'DAY 2 STARTS WITH YOUR CHOICE  →', 360 + Math.sin(t * 5) * 4, 1210, 34, '#ffffff', { stroke: 6 });
        ctx.globalAlpha = 1;
      }
    },
    overlay(ctx, t) {
      // last second: Day 2 tease
      if (t >= DAY2_T - 0.12) {
        const k = P(t, DAY2_T - 0.12, 0.2);
        ctx.fillStyle = `rgba(6,6,10,${0.94 * k})`; ctx.fillRect(0, 0, W, H);
        if (t >= DAY2_T) {
          const s = E.back(P(t, DAY2_T, 0.3));
          ctx.save(); ctx.translate(360, 560); ctx.scale(s, s); ctx.rotate(-0.04);
          boldText(ctx, 'DAY 2', 0, 0, 170, '#ffffff', { font: 'Luckiest Guy', stroke: 20 });
          ctx.restore();
          const s2 = E.back(P(t, DAY2_T + 0.25, 0.3));
          ctx.save(); ctx.translate(360, 720); ctx.scale(s2, s2); ctx.rotate(0.03);
          rr(ctx, -270, -46, 540, 92, 20); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
          boldText(ctx, 'THE ALL-YOU-CAN-EAT BUFFET', 0, 3, 42, '#fff', { stroke: 0 });
          ctx.restore();
          const s3 = clamp(P(t, DAY2_T + 0.45, 0.2));
          ctx.globalAlpha = s3;
          for (let i = 0; i < 3; i++) poopIcon(ctx, 230 + i * 130, 880 + Math.sin(t * 10 + i) * 8, 1.2, true);
          ctx.globalAlpha = 1;
        }
      }
    },
  });

  // ---------------- captions: 1–3 words, colored key words ----------------
  const C = (a, b, col, size) => CHUNKS.push({ a, b, col: col || {}, size });
  C(0, 1); C(2, 2, { 2: 'Y' }); C(3, 5, { 5: 'G' }); C(6, 7, { 6: 'Y' }); C(8, 9); C(10, 11);
  C(12, 13, { 12: 'Y', 13: 'Y' }); C(14, 16); C(17, 19); C(20, 22, { 21: 'P', 22: 'P' });
  C(23, 25); C(26, 27, { 26: 'B' }); C(28, 29, { 28: 'Y' }); C(30, 31); C(32, 33, { 32: 'R', 33: 'R' });
  C(34, 36, { 36: 'P' }); C(37, 37); C(38, 40); C(41, 41); C(42, 43, { 43: 'R' });
  C(44, 44, { 44: 'P' }); C(45, 47, { 46: 'Y' }); C(48, 49, { 48: 'R', 49: 'R' });
  C(50, 52); C(53, 55); C(56, 57, { 56: 'B', 57: 'B' }); C(58, 59, { 58: 'G', 59: 'G' }); C(60, 60, { 60: 'Y' }, 96);
  C(61, 62, { 61: 'Y', 62: 'Y' }); C(63, 64, { 64: 'R' });
  C(65, 66); C(67, 69, { 68: 'P', 69: 'P' }); C(70, 72); C(73, 74); C(75, 76, { 76: 'B' }); C(77, 78, { 78: 'G' }); C(79, 80, { 80: 'R' });
  C(81, 83); C(84, 86, { 86: 'R' }); C(87, 88); C(89, 90); C(91, 92, { 92: 'Y' }); C(93, 94, { 93: 'G', 94: 'G' }); C(95, 95, { 95: 'Y' }, 96);
  C(96, 96); C(97, 99, { 98: 'P', 99: 'P' }); C(100, 101); C(102, 103, { 103: 'Y' }); C(104, 105, { 105: 'G' }); C(106, 108, { 108: 'R' });
  C(109, 111); C(112, 114, { 114: 'B' }); C(115, 116); C(117, 118, { 117: 'G', 118: 'G' }); C(119, 121, { 121: 'R' });
  C(122, 123, { 122: 'G', 123: 'G' }); C(124, 124, { 124: 'Y' }, 96);
  C(125, 125); C(126, 128, { 127: 'B', 128: 'B' }); C(129, 131, { 131: 'B' }); C(132, 133); C(134, 135, { 135: 'Y' }); C(136, 137); C(138, 139, { 138: 'Y', 139: 'Y' });
  C(140, 141, { 141: 'B' }); C(142, 143); C(144, 145); C(146, 147, { 146: 'R', 147: 'R' });
  C(148, 149, { 148: 'G', 149: 'G' }); C(150, 150, { 150: 'Y' }, 96); C(151, 153); C(154, 155, { 154: 'Y', 155: 'Y' });
  C(156, 158); C(159, 159); C(160, 161, { 161: 'Y' }); C(162, 163); C(164, 165, { 164: 'G' }); C(166, 168); C(169, 169, { 169: 'R' }, 90);
  C(170, 171); C(172, 174, { 174: 'B' }); C(175, 176); C(177, 178, { 177: 'Y', 178: 'Y' }); C(179, 180); C(181, 182, { 182: 'G' });
  C(183, 184, { 184: 'B' }); C(185, 187, { 186: 'R', 187: 'R' });
  C(188, 189, { 189: 'P' }); C(190, 191); C(192, 192, { 192: 'P' }, 90); C(193, 194); C(195, 196, { 196: 'Y' }); C(197, 198, { 197: 'P', 198: 'P' });
  C(199, 201, { 200: 'R' }); C(202, 203); C(204, 205, { 204: 'Y', 205: 'Y' }); C(206, 206, { 206: 'B' }, 120);
  C(207, 209, { 207: 'Y', 208: 'Y' }); C(210, 211, { 210: 'G', 211: 'G' }); C(212, 212, { 212: 'Y' }, 96);
  C(213, 215); C(216, 217, { 216: 'Y', 217: 'Y' }); C(218, 220, { 218: 'Y' }); C(221, 222, { 221: 'Y', 222: 'Y' }, 88); C(223, 224, { 224: 'B' }, 88);
  C(225, 227); C(228, 230, { 228: 'Y', 229: 'Y' }); C(231, 233, { 233: 'Y' });

  // ---------------- music sections ----------------
  window.MUSIC = [
    { t: 0, style: 'main' },
    { t: T1a, style: 'tension' },
    { t: D0, style: 'main' },
    { t: H0, style: 'church' },
    { t: ws(146), style: 'stop' },
    { t: ws(148) + 0.1, style: 'main' },
    { t: ws(183), style: 'stop' },
    { t: K1, style: 'soft' },
    { t: L0, style: 'poll' },
    { t: DAY2_T, style: 'tease' },
    { t: DUR, style: 'end' },
  ];
  CUES.sort((a, b) => a.t - b.t);
}
