// ---------- Grandpa Walt Ep1 timeline (keyed to voiceover word times) ----------
const POLL_T = DUR - POLL_LEN;
function camAt(t, kfs) {
  let cur = { x: kfs[0].x, y: kfs[0].y, z: kfs[0].z, r: kfs[0].r || 0 };
  for (let i = 1; i < kfs.length; i++) {
    const k = kfs[i]; if (t < k.t) break;
    const p = E[k.e || 'inOut'](P(t, k.t, k.d === undefined ? 0.6 : k.d));
    cur = { x: lerp(cur.x, k.x, p), y: lerp(cur.y, k.y, p), z: lerp(cur.z, k.z, p), r: lerp(cur.r, k.r || 0, p) };
  }
  return cur;
}
function track(t, kfs) { let v = kfs[0][1]; for (let i = 1; i < kfs.length; i++) { const [tt, vv, d] = kfs[i]; if (t < tt) break; v = lerp(v, vv, E.inOut(P(t, tt, d === undefined ? 0.3 : d))); } return v; }
const PUNCH = [];
function punch(t0, amt = 0.07) { PUNCH.push([t0, amt]); }
function punchZ(t) { let z = 0; for (const [t0, a] of PUNCH) if (t >= t0 && t < t0 + 0.6) z += a * Math.exp(-(t - t0) * 9) * Math.sin(Math.min(1, (t - t0) / 0.06) * Math.PI / 2); return z; }
const SCENES = [];
function addScene(name, a, b, o) { SCENES.push(Object.assign({ name, a, b, capY: 990, whip: true, grade: ['#ffb070', 0.18], vig: 0.35 }, o)); }
function roll(t0, t1, from, to) { FOLLOW.push({ t0, t1, from, to }); }
function notifCard(ctx, t, t0, t1, icon, title, body) {
  if (t < t0 || t > t1 + 0.3) return;
  const k = E.back(P(t, t0, 0.35)) * (1 - E.in(P(t, t1, 0.3)));
  ctx.save(); ctx.translate(0, lerp(-200, 0, k));
  rr(ctx, 40, 262, 640, 104, 26); ctx.fillStyle = 'rgba(250,250,255,0.96)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.stroke();
  ctx.font = '48px "Noto Color Emoji"'; ctx.textAlign = 'center'; ctx.fillText(icon, 100, 330);
  plainText(ctx, title, 150, 302, 24, '#111', { weight: 800 }); plainText(ctx, body, 150, 336, 22, '#444', { weight: 600 });
  plainText(ctx, 'now', 640, 302, 18, '#999', { align: 'right', weight: 600 });
  ctx.restore();
}
function burstText(ctx, t, t0, str, x, y, size, col, rot = -0.08) {
  if (t < t0 || t > t0 + 1.6) return;
  const k = E.back(P(t, t0, 0.2)), out = P(t, t0 + 1.3, 0.3);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k * (1 + out * 0.3), k * (1 + out * 0.3)); ctx.globalAlpha = 1 - out;
  ctx.beginPath(); for (let i = 0; i < 22; i++) { const r = i % 2 ? size * 1.1 : size * 1.9, a = i / 22 * TAU; ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r); } ctx.closePath();
  fillStroke(ctx, '#ffd23f', OUT, 6);
  boldText(ctx, str, 0, 4, size, col, { font: 'Luckiest Guy', stroke: size * 0.16 });
  ctx.restore();
}

function buildTimeline() {
  // ================= A. HOOK: living room =================
  const A0 = 0, A1 = ws(14) - 0.12;
  cue(0.02, 'whoosh', 0.5); cue(ws(3) + 0.05, 'pop', 0.7); cue(ws(11) - 0.05, 'boing', 0.7); punch(ws(11) - 0.05, 0.06);
  addScene('hook', A0, A1, {
    whip: false,
    cam: [{ t: 0, x: 360, y: 700, z: 1.12 }, { t: 0.05, x: 360, y: 660, z: 1.22, d: 3.0 }],
    draw(ctx, t) {
      bgLiving(ctx, t);
      const phone = t >= ws(6) - 0.1;
      drawWalt(ctx, t, { x: 360, y: 1080, s: 1.0, pose: wPoseAt(t, [[0, 'cane'], [ws(6) - 0.1, 'phoneUp']]), cane: !phone, phone, phoneText: 'Aa', expr: phone ? 'squint' : 'neutral', seed: 0.4, squash: spring(t, 0.05, -0.1, 2.5, 6) });
    },
    overlay(ctx, t) {
      // LVL 81 badge
      if (t > ws(3) && t < ws(6) + 0.2) {
        const k = popScale(t, ws(3) + 0.05, 0.25) * (1 - P(t, ws(6), 0.2));
        ctx.save(); ctx.translate(560, 420); ctx.scale(k, k); ctx.rotate(0.08);
        rr(ctx, -100, -46, 200, 92, 20); ctx.fillStyle = '#1b1b22'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
        boldText(ctx, 'LVL 81', 0, 3, 54, '#ffd23f', { stroke: 0, font: 'Luckiest Guy' });
        ctx.restore();
      }
      // giant-font phone
      if (t >= ws(11) - 0.06) {
        const k = E.back(P(t, ws(11) - 0.06, 0.3));
        ctx.save(); ctx.translate(360, 640 + (1 - k) * 900); ctx.rotate(-0.04);
        rr(ctx, -230, -380, 460, 760, 56); ctx.fillStyle = '#16151c'; ctx.fill();
        rr(ctx, -212, -362, 424, 724, 44); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.save(); rr(ctx, -212, -362, 424, 724, 44); ctx.clip();
        ctx.font = '520px Inter'; ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.fillText('He', -230, 180);
        ctx.restore();
        boldText(ctx, 'FONT SIZE: 72', 0, -300, 34, '#ff3f97', { stroke: 0, shadow: false });
        ctx.restore();
      }
    },
  });

  // ================= B. TITLE: 5 days to go viral =================
  const B0 = A1, B1 = ws(24) - 0.1;
  cue(ws(14), 'impact', 1.0); cue(ws(22), 'impact', 0.9); shakeAt(ws(14), 20, 0.4); shakeAt(ws(22), 16, 0.4);
  addScene('title', B0, B1, {
    capY: null, grade: ['#ff70c0', 0.1],
    cam: [{ t: B0, x: 360, y: 640, z: 1 }, { t: B0 + 0.1, x: 360, y: 640, z: 1.07, d: 3.5 }],
    draw(ctx, t) {
      speedLines(ctx, 360, 640, t, '#ff5fa8', '#ff8cc6', 30, 0.3);
      const g = ctx.createRadialGradient(360, 640, 100, 360, 640, 900); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(60,0,40,0.6)'); ctx.fillStyle = g; ctx.fillRect(-200, -200, 1200, 1700);
      for (let i = 0; i < 14; i++) { const k = (t * 0.4 + hash(i)) % 1; ctx.save(); ctx.globalAlpha = 0.8 * (1 - k); ctx.translate(60 + hash(i + 2) * 600, 1300 - k * 1400); ctx.font = '40px "Noto Color Emoji"'; ctx.fillText(['❤️', '👍', '🔥', '⭐'][i % 4], 0, 0); ctx.restore(); }
      drawWalt(ctx, t, { x: 360, y: 1620, s: 1.25, pose: 'selfie', phone: true, expr: 'proud', seed: 1.2 });
      if (t >= ws(14)) { ctx.save(); ctx.translate(360, 470); const s = lerp(3, 1, E.out(P(t, ws(14), 0.18))); ctx.scale(s, s); ctx.rotate(-0.06); boldText(ctx, '5 DAYS', 0, 0, 160, '#ffffff', { font: 'Luckiest Guy', stroke: 22 }); ctx.restore(); }
      if (t >= ws(22)) { ctx.save(); ctx.translate(360, 640); const s = lerp(3, 1, E.out(P(t, ws(22), 0.18))); ctx.scale(s, s); ctx.rotate(0.04); boldText(ctx, 'TO GO VIRAL', 0, 0, 100, '#ffd23f', { font: 'Luckiest Guy', stroke: 18 }); ctx.restore(); }
    },
  });

  // ================= C. CLASSROOM flashback =================
  const C0 = B1, C1 = ws(34) - 0.1;
  cue(C0, 'whoosh', 0.6); cue(ws(33) + 0.05, 'sparkle', 0.6);
  addScene('class', C0, C1, {
    grade: ['#ffe08a', 0.2],
    cam: [{ t: C0, x: 360, y: 640, z: 1.0 }, { t: C0 + 0.1, x: 380, y: 620, z: 1.08, d: 4 }],
    draw(ctx, t) {
      bgClass(ctx, t);
      drawMia(ctx, t, 560, 1090, 1.0, { pose: 'point', mouth: t > ws(28) && t < we(33) ? 'smile' : 'smile', eyes: 'normal' });
      classKids(ctx, t, t > ws(33));
      if (t > ws(33)) for (let i = 0; i < 6; i++) sparkle(ctx, 120 + i * 100, 300 + Math.sin(t * 5 + i) * 30, 0.6 + 0.3 * Math.sin(t * 8 + i), 1);
    },
    overlay(ctx, t) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 14; ctx.setLineDash([2, 22]); ctx.lineCap = 'round'; rr(ctx, 14, 252, 692, 1010, 30); ctx.stroke(); ctx.restore();
      rr(ctx, 40, 668, 220, 50, 25); ctx.fillStyle = 'rgba(27,27,34,0.85)'; ctx.fill(); boldText(ctx, 'LAST WEEK', 150, 694, 28, '#ffd23f', { stroke: 0, shadow: false });
    },
  });

  // ================= D. "He is not." =================
  const D0 = C1, D1 = ws(37) - 0.08;
  cue(we(36) + 0.05, 'rimshot', 0.8);
  addScene('not', D0, D1, {
    cam: [{ t: D0, x: 300, y: 600, z: 1.35 }],
    draw(ctx, t) {
      bgLiving(ctx, t);
      drawWalt(ctx, t, { x: 300, y: 1080, s: 1.0, pose: { L: [-112, -170], R: [70, -455] }, phone: false, expr: 'neutral', seed: 2.1, talking: t > ws(35) });
      // TV remote held to the ear like a phone
      ctx.save(); ctx.translate(300 + 70, 1080 - 470); ctx.rotate(-0.4); rr(ctx, -14, -50, 28, 100, 10); fillStroke(ctx, '#2b2b35', OUT, 4); for (let i = 0; i < 4; i++) { circle(ctx, 0, -30 + i * 18, 5); ctx.fillStyle = ['#e23b3b', '#ffd23f', '#7cfc5a', '#4fc3ff'][i]; ctx.fill(); } ctx.restore();
    },
    overlay(ctx, t) { if (t > ws(35)) { const k = popScale(t, ws(35), 0.2); bubble(ctx, 520, 420, 200, 80, 440, 500, k); if (k > 0.5) boldText(ctx, 'HELLO?', 520, 422, 40, '#1b1b22', { stroke: 0, shadow: false, font: 'Luckiest Guy' }); } },
  });

  // ================= E. profile: 3 followers, 2 doctors =================
  const E0 = D1, E1 = ws(47) - 0.1;
  cue(E0, 'swoosh', 0.7); FPOPS.push(ws(39)); cue(ws(39), 'pop', 0.7);
  cue(ws(44) + 0.1, 'stamp', 0.9); cue(ws(44) + 0.35, 'stamp', 0.9);
  addScene('profile', E0, E1, {
    capY: 1150, whip: false, grade: ['#c070ff', 0.1],
    cam: [{ t: E0, x: 360, y: 640, z: 1 }, { t: ws(41), x: 360, y: 720, z: 1.1, d: 0.5 }],
    draw(ctx, t) {
      bgPhone(ctx, t);
      const k = E.back(P(t, E0, 0.4)); ctx.save(); ctx.translate(0, (1 - k) * 900);
      drawProfile(ctx, t, { rowT: ws(39), stampT: ws(44) + 0.1, pulse: t > ws(39) && t < ws(40) + 0.4 ? Math.sin(P(t, ws(39), 0.6) * Math.PI) : 0 });
      ctx.restore();
    },
  });

  // ================= F. PHONE 1: Mia texts =================
  const F0 = E1, F1 = ws(71) - 0.1;
  const msgs1 = [
    { t: ws(50), from: 'her', text: 'Grandpa.' },
    { t: ws(51), from: 'her', text: 'My friends visit Saturday.' },
    { t: ws(55), from: 'her', text: 'Please. Be. Famous. 🙏' },
    { t: ws(66), from: 'me', text: 'WHO IS THIS.', big: true },
  ];
  const typeA = ws(61), typeB = ws(66) - 0.1;
  cue(F0, 'swoosh', 0.7); msgs1.forEach(m => cue(m.t, m.from === 'me' ? 'send' : 'ding', m.from === 'me' ? 0.9 : 0.6));
  cue(typeA, 'typing', 0.6, { dur: typeB - typeA }); cue(ws(66) + 0.08, 'boing', 0.5); punch(ws(66), 0.06);
  FPOPS.push(ws(70)); cue(ws(70), 'pop', 0.8);
  addScene('phone1', F0, F1, {
    capY: 1150, whip: false, grade: ['#c070ff', 0.1],
    cam: [{ t: F0, x: 360, y: 640, z: 1 }, { t: ws(61), x: 360, y: 760, z: 1.12, d: 0.4 }, { t: ws(69), x: 360, y: 650, z: 1.0, d: 0.4 }],
    draw(ctx, t) {
      bgPhone(ctx, t, '#3a0f4a');
      let input = '';
      const caps = 'WHO IS THIS.';
      if (t >= typeA && t < ws(66)) input = caps.slice(0, Math.floor(caps.length * P(t, typeA, typeB - typeA)));
      const k = E.back(P(t, F0, 0.4)); ctx.save(); ctx.translate(0, (1 - k) * 900);
      drawPhone(ctx, t, { msgs: msgs1, input, cursor: t >= typeA && t < ws(66), contact: { name: 'Mia 🌸', sub: 'Granddaughter' }, shake: t > ws(66) && t < ws(66) + 0.4 ? 1 : 0, typing: [ws(68) + 0.2, 99] });
      ctx.restore();
      if (t > typeA - 0.2 && t < ws(66)) { ctx.save(); ctx.translate(360, 1232); ctx.rotate(-0.03); boldText(ctx, 'CAPS LOCK: ON', 0, 0, 30, '#ff4d4d', { stroke: 6 }); ctx.restore(); }
    },
  });

  // ================= G. SELFIE: wrong camera, scream, cat moves out =================
  const G0 = F1, G1 = ws(97) - 0.1;
  const camOn = ws(78) - 0.05, scr = ws(90) - 0.08, back = ws(90) + 0.35, catT = ws(91) - 0.1;
  cue(G0, 'whoosh', 0.6); cue(ws(77), 'shutter', 0.8); cue(camOn, 'scratch', 0.8); shakeAt(camOn, 10, 0.3);
  cue(scr, 'scream', 1.0); shakeAt(scr, 24, 0.7); cue(catT + 0.05, 'cat', 0.9);
  FOLLOW.push({ t0: ws(96), t1: ws(96), from: 3, to: 2 }); FPOPS.push(ws(96)); FDELTA.push({ t: ws(96), label: '-1', col: '#ff4d4d' }); cue(ws(96), 'slide', 0.6);
  addScene('selfie', G0, G1, {
    cam: [{ t: G0, x: 360, y: 640, z: 1.05 }, { t: ws(74), x: 380, y: 600, z: 1.2, d: 1.2 },
      { t: back, x: 360, y: 640, z: 1.1, d: 0.01 }, { t: catT, x: 420, y: 760, z: 1.05, d: 0.4 }],
    draw(ctx, t) {
      bgLiving(ctx, t);
      const screaming = t >= back && t < catT + 0.5;
      const flying = t >= back;
      drawWalt(ctx, t, {
        x: 300, y: 1080, s: 1.0, seed: 3, shake: screaming ? 1 : 0,
        pose: flying ? wPoseAt(t, [[back, 'face'], [catT + 0.8, 'shrug']]) : wPoseAt(t, [[0, 'idle'], [ws(71), 'selfie']]),
        phone: !flying, phoneGlow: true,
        expr: screaming ? 'scream' : flying ? 'confused' : t > ws(75) ? 'proud' : 'neutral', look: t > catT + 0.4 ? [1, 0.2] : [0, 0],
      });
      if (flying && t < back + 1.2) { const k = P(t, back, 1.2); ctx.save(); ctx.translate(300 + k * 200, 560 - Math.sin(k * Math.PI) * 420); ctx.rotate(k * 14); rr(ctx, -26, -46, 52, 92, 10); fillStroke(ctx, '#23232e', OUT, 4); ctx.restore(); }
      // the cat moves out (with luggage)
      if (t >= catT) {
        const k = P(t, catT, 2.2), x = lerp(60, 900, E.inOut(k));
        drawCat(ctx, t, x, 1100, 1.15, { walking: true, suitcase: true, hat: true, unimpressed: k > 0.15, hiss: k < 0.15 });
      }
    },
    overlay(ctx, t) {
      if (t >= camOn && t < back) { drawNostrilCam(ctx, t, P(t, camOn, back - camOn), t > scr); if (t > ws(86) && t < ws(89)) { ctx.save(); ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 8; circle(ctx, 360, 900, 170 + Math.sin(t * 10) * 8); ctx.stroke(); ctx.restore(); } }
      notifCard(ctx, t, ws(95) - 0.1, G1 - 0.2, '🐈', 'Mr. Whiskers', 'unfollowed you.');
    },
  });

  // ================= H. YARD: dance trend + knee crack =================
  const H0 = G1, H1 = ws(123) - 0.1;
  const tlA = ws(101), tlB = ws(106) - 0.1, move = ws(110), crack = ws(112) + 0.02;
  cue(H0, 'whoosh', 0.6); cue(tlA, 'zip', 0.5); cue(ws(104), 'tada', 0.6);
  cue(move - 0.1, 'swoosh', 0.5); cue(crack, 'knee', 1.0); cue(crack + 0.02, 'impact', 0.6); shakeAt(crack, 18, 0.4); punch(crack, 0.1);
  cue(ws(117), 'notif', 0.8); cue(ws(119) + 0.2, 'pop', 0.5);
  addScene('yard', H0, H1, {
    grade: ['#ffc070', 0.15],
    cam: [{ t: H0, x: 360, y: 640, z: 1.0 }, { t: tlA, x: 360, y: 640, z: 0.96, d: 0.3 }, { t: ws(106), x: 330, y: 700, z: 1.15, d: 0.4 },
      { t: crack - 0.02, x: 380, y: 940, z: 1.7, d: 0.12, e: 'out' }, { t: ws(117), x: 360, y: 640, z: 1.0, d: 0.3 }],
    draw(ctx, t) {
      const tod = t < tlA ? 0 : t < tlB ? E.inOut(P(t, tlA, tlB - tlA)) : 1;
      bgYard(ctx, t, { tod: tod * 0.85 });
      let pose = 'idle', legs = 'stand', dk = 0, expr = 'neutral', hip = 0, sweat = 0;
      if (t >= ws(98) && t < tlA) { pose = 'point'; expr = 'squint'; }
      if (t >= tlA && t < tlB) { const ph = Math.floor(t * 9) % 2; pose = ph ? 'dance1' : 'dance2'; legs = ph ? 'dance' : 'stand'; dk = ph; hip = ph ? 18 : -18; expr = 'pain'; sweat = 1; }
      if (t >= tlB) { pose = wPoseAt(t, [[tlB, 'idle'], [move - 0.3, 'dance2'], [move, 'dance1']]); legs = t > move ? 'dance' : 'stand'; dk = E.back(P(t, move, 0.25)); expr = t > crack ? 'pain' : 'cool'; hip = t > move ? 14 : 0; }
      if (t >= ws(117)) { expr = 'proud'; }
      const ox = t >= tlA && t < tlB ? Math.sin(t * 60) * 4 : 0;
      drawWalt(ctx, t, { x: 330 + ox, y: 1090, s: 1.0, pose, legs, danceK: dk, hipSway: hip, expr, sweat, seed: 4 });
      if (t > crack && t < crack + 0.9) { // impact lines on knee
        const k = P(t, crack, 0.9); ctx.save(); ctx.translate(400, 960); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.lineTo(Math.cos(a) * (90 + k * 60), Math.sin(a) * (90 + k * 60)); ctx.stroke(); } ctx.restore();
      }
    },
    overlay(ctx, t) {
      if (t >= ws(98) && t < tlA + 0.2) { const k = popScale(t, ws(99), 0.25); ctx.save(); ctx.translate(360, 330); ctx.scale(k, k); rr(ctx, -210, -38, 420, 76, 38); ctx.fillStyle = '#1b1b22'; ctx.fill(); boldText(ctx, '#GRANDPASHUFFLE', 0, 2, 40, '#5fd4ff', { stroke: 0, shadow: false }); ctx.restore(); }
      if (t >= ws(104) - 0.1 && t < tlB + 0.3) { ctx.save(); ctx.translate(360, 380); ctx.rotate(-0.05); const k = popScale(t, ws(104) - 0.1, 0.25); ctx.scale(k, k); rr(ctx, -230, -50, 460, 100, 12); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(); boldText(ctx, '3 HOURS LATER', 0, 4, 58, '#1b1b22', { font: 'Luckiest Guy', stroke: 0, shadow: false }); ctx.restore(); }
      burstText(ctx, t, crack, 'CRACK!', 470, 640, 78, '#e23b3b');
      if (t >= ws(117) - 0.05) {
        const k = E.back(P(t, ws(117) - 0.05, 0.3));
        ctx.save(); ctx.translate(360, 560); ctx.scale(k, k);
        rr(ctx, -200, -170, 400, 340, 28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        rr(ctx, -180, -150, 360, 220, 18); ctx.fillStyle = '#6fcf5a'; ctx.fill();
        ctx.save(); rr(ctx, -180, -150, 360, 220, 18); ctx.clip(); drawWalt(ctx, t, { x: 0, y: 175, s: 0.42, pose: 'dance1', legs: 'dance', danceK: 1, expr: 'pain', seed: 4 }); ctx.restore();
        circle(ctx, 30, 95, 34); ctx.lineWidth = 6; ctx.strokeStyle = '#e23b3b'; ctx.stroke();
        ctx.font = '44px "Noto Color Emoji"'; ctx.textAlign = 'left'; ctx.fillText('❤️', -170, 130); boldText(ctx, '40', -90, 116, 52, '#1b1b22', { stroke: 0, shadow: false, align: 'left' });
        plainText(ctx, 'likes', -26, 128, 26, '#666', { weight: 700 });
        ctx.restore();
        hearts(ctx, t, ws(117), 24, 560, 820);
      }
      if (t >= ws(119)) floatComments(ctx, t, ws(119), ['THE KNEE 💀', 'knee on beat fr', 'knee needs its own account', '🦴🦴🦴'], 110, 900, { gap: 0.3, life: 2.0, rise: 260 });
    },
  });

  // ================= I. BINGO LIVE =================
  const I0 = H1, I1 = ws(145) - 0.1;
  cue(I0, 'whoosh', 0.6); cue(I0 + 0.05, 'bingo', 0.55, { dur: I1 - I0 }); cue(ws(126), 'ding', 0.6); cue(ws(127), 'scratch', 0.7);
  cue(ws(141) + 0.1, 'grandmas', 0.9);
  roll(ws(131), ws(144), 2, 812); FPOPS.push(ws(144)); FDELTA.push({ t: ws(144), label: '+810', col: '#7cfc5a', burst: true }); cue(ws(144), 'notif', 0.9); cue(ws(144), 'pop', 0.6);
  const comments = ['hi grandpa!!', 'is this live??', 'B-12!!!', 'what app is this', 'ur glasses r huge', 'who is this man 😭', 'he reads them ALL', 'grandpa ur iconic'];
  addScene('bingo', I0, I1, {
    grade: ['#9fd8ff', 0.12],
    cam: [{ t: I0, x: 360, y: 640, z: 1.0 }, { t: ws(131), x: 330, y: 700, z: 1.15, d: 0.6 }, { t: ws(140), x: 300, y: 560, z: 1.55, d: 0.35, e: 'out' }, { t: ws(143), x: 360, y: 640, z: 1.05, d: 0.4 }],
    draw(ctx, t) {
      bgBingo(ctx, t, { flash: true });
      const giggle = t > ws(141) + 0.1;
      [[110, 0], [270, 1], [470, 2], [630, 3]].forEach(([gx, sd]) => drawGrandma(ctx, t, gx, 880, 0.95, sd, { giggle, daub: !giggle }));
      const reading = t >= ws(131);
      drawWalt(ctx, t, { x: 330, y: 1250, s: 1.0, pose: t > ws(141) && t < ws(143) ? { L: [-92, -470], R: [44, -420] } : 'phoneUp', phone: true, live: t > ws(126), phoneGlow: true, expr: t > ws(141) && t < ws(143) ? 'confused' : reading ? 'squint' : 'neutral', talking: reading && !(t > ws(141) && t < ws(143)), seed: 5 });
      bingoTable(ctx, t, 1010);
    },
    overlay(ctx, t) {
      if (t > ws(126)) {
        const k = popScale(t, ws(126), 0.25); ctx.save(); ctx.translate(140, 290); ctx.scale(k, k);
        rr(ctx, -100, -28, 200, 56, 12); ctx.fillStyle = '#e23b3b'; ctx.fill(); circle(ctx, -70, 0, 9); ctx.fillStyle = Math.sin(t * 8) > 0 ? '#fff' : '#ffb3b3'; ctx.fill();
        boldText(ctx, 'LIVE', -10, 2, 34, '#fff', { stroke: 0, shadow: false });
        const viewers = Math.floor(lerp(1, 2400, E.in(P(t, ws(131), ws(144) - ws(131)))));
        boldText(ctx, '👁 ' + fmt(viewers), 160, 2, 28, '#fff', { stroke: 5, align: 'left', font: 'Anton' });
        ctx.restore();
      }
      if (t >= ws(131)) floatComments(ctx, t, ws(131), comments, 430, 900, { gap: 0.5, life: 2.6, rise: 460, s: 0.95 });
      if (t >= ws(140) && t < ws(143) + 0.3) {
        const k = E.back(P(t, ws(140), 0.3)); ctx.save(); ctx.translate(380, 420); ctx.scale(k * 1.25, k * 1.25); ctx.rotate(-0.04);
        rr(ctx, -150, -36, 300, 72, 36); ctx.fillStyle = '#ff6fb5'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
        plainText(ctx, 'nice ears 👂', 0, 12, 36, '#fff', { align: 'center', weight: 800 }); ctx.restore();
      }
    },
  });

  // ================= J. "OK boomer" -> handwritten letter -> mailbox =================
  const J0 = I1, Jm = ws(155) - 0.1, J1 = ws(165) - 0.1;
  const letter = ['Dear Kyle,', 'In 1962 I had no phone,', 'no internet, and no', 'complaints. Sincerely,', 'Walt (81)'];
  cue(J0, 'whoosh', 0.6); cue(ws(148), 'scratch', 0.8); cue(ws(150) + 0.1, 'sparkle', 0.4);
  cue(Jm, 'whoosh', 0.6); cue(ws(156) + 0.35, 'mailbox', 1.0);
  roll(ws(152), ws(159), 812, 999); FPOPS.push(ws(159)); FDELTA.push({ t: ws(159), label: '+187', col: '#7cfc5a', burst: true }); cue(ws(159), 'notif', 0.9);
  cue(ws(160), 'ticktock', 0.6, { dur: J1 - ws(160) });
  addScene('letter', J0, Jm, {
    grade: ['#ffd070', 0.15], capY: 1170,
    cam: [{ t: J0, x: 360, y: 640, z: 1.0 }, { t: ws(148), x: 360, y: 620, z: 1.08, d: 0.3 }, { t: ws(150), x: 360, y: 880, z: 1.1, d: 0.5 }],
    draw(ctx, t) {
      bgKitchen(ctx, t);
      const writing = t >= ws(150);
      drawWalt(ctx, t, { x: 360, y: 1250, s: 1.0, pose: writing ? { L: [-70, -250], R: [60 + Math.sin(t * 9) * 30, -240] } : 'phoneUp', phone: !writing, pen: writing, expr: writing ? 'grumpy' : t > ws(148) ? 'grumpy' : 'squint', lidAdd: 0, seed: 6 });
      kitchenTable(ctx, t, writing ? P(t, ws(150) + 0.1, Jm - ws(150) - 0.2) : 0, letter);
    },
    overlay(ctx, t) {
      if (t >= ws(147) && t < ws(150) + 0.2) {
        const k = E.back(P(t, ws(147), 0.3)) * (1 - E.in(P(t, ws(150), 0.2)));
        ctx.save(); ctx.translate(360, 420); ctx.scale(k * 1.2, k * 1.2);
        rr(ctx, -230, -54, 460, 108, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ddd'; ctx.stroke();
        circle(ctx, -180, 0, 30); ctx.fillStyle = '#4fc3ff'; ctx.fill(); plainText(ctx, '🧢', -196, 12, 30, '#000');
        plainText(ctx, 'kyle_2011', -134, -10, 22, '#111', { weight: 800 }); plainText(ctx, 'ok boomer', -134, 26, 30, '#333', { weight: 700 });
        ctx.restore();
      }
    },
  });
  addScene('mailbox', Jm, J1, {
    grade: ['#ffb070', 0.15],
    cam: [{ t: Jm, x: 420, y: 660, z: 1.15 }, { t: ws(159), x: 420, y: 640, z: 1.05, d: 0.5 }],
    draw(ctx, t) {
      bgSuburb(ctx, t);
      const drop = ws(156) + 0.1, flap = t > drop && t < drop + 0.6 ? Math.sin(P(t, drop, 0.6) * Math.PI) : 0;
      drawMailbox(ctx, t, 560, 1030, 1.1, { flap });
      drawWalt(ctx, t, { x: 300, y: 1060, s: 1.0, pose: t < drop + 0.25 ? 'mail' : 'hips', letter: t < drop + 0.25, expr: t > drop + 0.3 ? 'proud' : 'grumpy', cane: false, seed: 7 });
      if (t > drop + 0.15 && t < drop + 0.5) { const k = P(t, drop + 0.15, 0.35); ctx.save(); ctx.translate(lerp(520, 560, k), lerp(780, 770, k)); ctx.scale(1 - k, 1 - k); rr(ctx, -40, -26, 80, 52, 4); fillStroke(ctx, '#fffaf0', OUT, 4); ctx.restore(); }
    },
    overlay(ctx, t) {
      if (t >= ws(160) - 0.05) {
        const k = popScale(t, ws(160) - 0.05, 0.3);
        ctx.fillStyle = `rgba(10,12,30,${0.5 * clamp(P(t, ws(160) - 0.05, 0.2))})`; ctx.fillRect(0, 0, W, H);
        drawStopwatch(ctx, t * 4, 360, 610, 1.1 * k, '6 HRS');
        if (k > 0.6) boldText(ctx, 'SINCE HE OPENED THE APP', 360, 820, 40, '#ffd23f', { stroke: 8 });
      }
    },
  });

  // ================= K. CHASE: the trend chases him =================
  const K0 = J1, K1 = ws(178) - 0.12;
  const out = ws(166), mob = ws(174) - 0.1;
  cue(K0, 'whoosh', 0.6); cue(ws(171), 'ding', 0.6); cue(mob, 'chase', 1.0); cue(mob + 0.1, 'sting', 0.8); cue(ws(176), 'scooter', 0.9); shakeAt(mob + 0.2, 10, 0.6);
  addScene('chase', K0, K1, {
    grade: ['#ffb070', 0.18],
    cam: [{ t: K0, x: 360, y: 640, z: 1.05 }, { t: ws(169), x: 380, y: 660, z: 1.12, d: 0.5 }, { t: mob, x: 300, y: 640, z: 0.9, d: 0.3 }],
    camFn(t, c) { const run = t > mob ? Math.pow(P(t, mob + 0.3, 1.4), 1.3) : 0; c.x += run * 900; return c; },
    draw(ctx, t) {
      const run = t > mob ? Math.pow(P(t, mob + 0.3, 1.4), 1.3) : 0;
      bgSuburb(ctx, t);
      const wx = t < mob + 0.3 ? lerp(160, 360, E.out(P(t, out, 0.9))) : 360 + run * 1150;
      if (t < mob + 0.3) {
        drawWalt(ctx, t, { x: wx, y: 1060, s: 1.0, pose: t > mob ? 'face' : 'cane', cane: t <= mob, legs: t > out && t < out + 0.9 ? 'walk' : 'stand', walkPhase: t * 8, expr: t > mob ? 'scream' : t > ws(169) ? 'confused' : 'neutral', look: t > ws(169) && t < mob ? [Math.sin(t * 3), 0] : [0, 0], seed: 8 });
      } else {
        drawScooter(ctx, t, wx, 1100, 0.9, {});
        drawWalt(ctx, t, { x: wx - 20, y: 1010, s: 0.85, legs: 'sit', pose: 'drive', expr: 'scream', seed: 8, lean: -0.08 });
        for (let i = 0; i < 4; i++) { const yy = 860 + i * 40; ctx.save(); ctx.strokeStyle = 'rgba(30,30,40,0.5)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(wx - 170 - i * 10, yy); ctx.lineTo(wx - 300 - i * 20, yy); ctx.stroke(); ctx.restore(); }
      }
      // the trend: a crowd of teens with phones
      if (t > mob - 0.2) {
        const cx = lerp(-800, -120, E.out(P(t, mob - 0.2, 0.6))) + run * 700;
        for (let i = 0; i < 9; i++) drawTeen(ctx, t, cx + (i % 5) * 70 - Math.floor(i / 5) * 40, 1080 + (i % 3) * 30, 0.95, i, {});
      }
    },
    overlay(ctx, t) {
      if (t > ws(171) - 0.05) { const k = popScale(t, ws(171) - 0.05, 0.25); ctx.save(); ctx.translate(360, 320); ctx.scale(k, k); ctx.rotate(-0.03); rr(ctx, -250, -40, 500, 80, 40); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); boldText(ctx, '🔥 #KNEEGRANDPA TRENDING', 0, 3, 36, '#fff', { stroke: 0, shadow: false }); ctx.restore(); }
    },
  });

  // ================= L. PHONE 2 =================
  const L0 = K1, L1 = POLL_T;
  const para2 = 'My dearest Mia. When I was a boy we had one telephone and it was nailed to the wall. Today I was chased by forty teenagers and a boy named Kyle. I am proud. I am tired. I will';
  const tA = ws(187), tB = we(191) + 0.15, dA = ws(193) - 0.05, dB = we(194) + 0.05, sA = ws(196), sB = ws(199) - 0.1;
  const msgs2 = msgs1.concat([
    { t: ws(182), from: 'her', text: 'Grandpa...' },
    { t: ws(183), from: 'her', text: 'are you TRENDING?? 😱' },
    { t: ws(199), from: 'me', text: 'WHO IS THIS.', big: true },
  ]);
  cue(L0, 'swoosh', 0.7); cue(ws(182), 'ding', 0.6); cue(ws(183), 'ding', 0.7);
  cue(tA, 'typing', 0.6, { dur: tB - tA }); cue(dA, 'backspace', 0.7, { dur: dB - dA }); cue(sA, 'typing', 0.5, { dur: sB - sA });
  cue(ws(199), 'send', 0.9); cue(we(201) + 0.08, 'rimshot', 0.9); punch(ws(199), 0.07);
  addScene('phone2', L0, L1, {
    capY: 1150, whip: false, grade: ['#c070ff', 0.1],
    cam: [{ t: L0, x: 360, y: 640, z: 1 }, { t: tA, x: 360, y: 770, z: 1.12, d: 0.4 }, { t: ws(199), x: 360, y: 700, z: 1.06, d: 0.3 }],
    draw(ctx, t) {
      bgPhone(ctx, t, '#3a0f4a');
      let input = '';
      if (t >= tA && t < dA) input = para2.slice(0, Math.floor(para2.length * E.inOut(P(t, tA, tB - tA))));
      else if (t >= dA && t < dB) input = para2.slice(0, Math.floor(para2.length * (1 - P(t, dA, dB - dA))));
      else if (t >= sA && t < ws(199)) input = 'WHO IS THIS.'.slice(0, Math.floor(12 * P(t, sA, sB - sA)));
      const k = E.back(P(t, L0, 0.4)); ctx.save(); ctx.translate(0, (1 - k) * 900);
      drawPhone(ctx, t, { msgs: msgs2, input, cursor: t >= tA && t < ws(199), contact: { name: 'Mia 🌸', sub: 'Granddaughter' }, shake: t > ws(199) && t < ws(199) + 0.4 ? 1 : 0, typing: [we(201) + 0.3, 99] });
      ctx.restore();
      if (t > tA + 0.3 && t < dA) for (let i = 0; i < 4; i++) sparkle(ctx, 180 + i * 120, 760 + Math.sin(t * 4 + i) * 30, 0.5 + 0.3 * Math.sin(t * 7 + i), 0.9);
    },
  });

  // ================= M. POLL =================
  const M0 = POLL_T; DAY2_T = DUR - 1.0;
  const TAP = we(223) + 0.6;
  cue(M0, 'impact', 0.9); cue(M0 + 0.02, 'whoosh', 0.6); cue(ws(208), 'pop', 0.6); FPOPS.push(ws(209));
  cue(ws(212), 'pop', 0.6); cue(ws(215), 'boing', 0.6); cue(ws(217), 'scratch', 0.5); cue(ws(218) - 0.3, 'pop', 0.8);
  cue(TAP, 'click', 0.9); cue(TAP + 0.05, 'confetti', 0.6);
  cue(DAY2_T, 'flip', 0.9); cue(DAY2_T + 0.05, 'sting', 0.9);
  addScene('poll', M0, DUR, {
    capY: 1112, whip: false, grade: ['#ffffff', 0.0], vig: 0.25,
    cam: [{ t: M0, x: 360, y: 640, z: 1 }],
    draw(ctx, t) {
      const k = E.out(P(t, M0, 0.35));
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-50, -50, W + 100, H + 100);
      ctx.save(); ctx.translate(-(1 - k) * 380, 0); let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a0d17'); g.addColorStop(1, '#a01d2e'); ctx.fillStyle = g; ctx.fillRect(-20, 0, 380, H); ctx.restore();
      ctx.save(); ctx.translate((1 - k) * 380, 0); g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b4421'); g.addColorStop(1, '#16803c'); ctx.fillStyle = g; ctx.fillRect(360, 0, 380, H); ctx.restore();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(357, 250, 6, H);
      const hk = popScale(t, M0 + 0.15, 0.3) * (1 + (t > ws(212) && t < ws(212) + 0.3 ? Math.sin(P(t, ws(212), 0.3) * Math.PI) * 0.12 : 0));
      ctx.save(); ctx.translate(360, 300); ctx.scale(hk, hk); rr(ctx, -250, -34, 500, 68, 34); ctx.fillStyle = '#1b1b22'; ctx.fill(); boldText(ctx, 'COMMENT ONE WORD', 0, 2, 46, '#ffd23f', { stroke: 0 }); ctx.restore();
      const lb = 1 + (t > ws(215) && t < ws(215) + 0.45 ? Math.sin(P(t, ws(215), 0.45) * Math.PI) * 0.2 : 0) + Math.sin(t * 4) * 0.02;
      const rb = 1 + (t > ws(217) && t < ws(217) + 0.45 ? Math.sin(P(t, ws(217), 0.45) * Math.PI) * 0.2 : 0) + Math.sin(t * 4 + 1.5) * 0.02;
      const tk = popScale(t, M0 + 0.25, 0.3);
      ctx.save(); ctx.translate(180, 404); ctx.scale(tk * lb, tk * lb); boldText(ctx, 'DANCE', 0, 0, 88, '#ffd23f', { stroke: 12 }); ctx.restore();
      ctx.save(); ctx.translate(540, 404); ctx.scale(tk * rb, tk * rb); boldText(ctx, 'RANT', 0, 0, 88, '#5fd4ff', { stroke: 12 }); ctx.restore();
      if (tk > 0.5) { boldText(ctx, 'THE KNEE RETURNS', 180, 470, 26, '#fff', { stroke: 5 }); boldText(ctx, 'KYLE GETS LETTER #2', 540, 470, 26, '#fff', { stroke: 5 }); }
      const ph = Math.floor(t * 3) % 2;
      drawWalt(ctx, t, { x: 180, y: 960, s: 0.66, pose: ph ? 'dance1' : 'dance2', legs: ph ? 'dance' : 'stand', danceK: ph, hipSway: ph ? 14 : -14, expr: 'cool', seed: 9 });
      drawWalt(ctx, t, { x: 540, y: 960, s: 0.66, pose: 'fist', expr: 'rant', talking: true, seed: 10, shake: 0.4 });
      bubble(ctx, 600, 560, 190, 66, 570, 610, popScale(t, M0 + 0.5, 0.3)); if (t > M0 + 0.6) boldText(ctx, 'IN MY DAY...', 600, 562, 30, '#1b1b22', { stroke: 0, shadow: false, font: 'Luckiest Guy' });
      if (t >= ws(218) - 0.35) {
        const bk = popScale(t, ws(218) - 0.35, 0.3), press = t > TAP && t < TAP + 0.25 ? 1 - Math.sin(P(t, TAP, 0.25) * Math.PI) * 0.12 : 1, pulse = 1 + Math.sin(t * 7) * 0.035;
        ctx.save(); ctx.translate(360, 1020); ctx.scale(bk * pulse * press, bk * pulse * press);
        rr(ctx, -165, -36, 330, 82, 41); ctx.fillStyle = '#b8860b'; ctx.fill(); rr(ctx, -165, -44, 330, 82, 41); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        boldText(ctx, 'VOTE NOW', 0, -2, 50, '#1b1b22', { stroke: 0, shadow: false }); ctx.restore();
        if (t > we(223)) { const hk = E.out(P(t, we(223), 0.4)), tap = t > TAP - 0.1 && t < TAP + 0.25 ? Math.sin(P(t, TAP - 0.1, 0.35) * Math.PI) * 14 : 0; ctx.save(); ctx.translate(lerp(620, 470, hk), lerp(1240, 1060, hk) + tap); ctx.rotate(-0.4); ctx.font = '74px "Noto Color Emoji"'; ctx.textAlign = 'center'; ctx.fillText('👆', 0, 0); ctx.restore(); }
        if (t > TAP) for (let i = 0; i < 26; i++) { const a = hash(i) * TAU, sp = 300 + hash(i + 5) * 500, d = t - TAP; if (d > 1.2) continue; ctx.save(); ctx.translate(360 + Math.cos(a) * sp * d, 1000 + Math.sin(a) * sp * d + 600 * d * d); ctx.rotate(d * 10 + i); ctx.fillStyle = ['#ffd23f', '#ff6fb5', '#5fd4ff', '#7cfc5a'][i % 4]; ctx.fillRect(-7, -4, 14, 8); ctx.restore(); }
      }
      if (t >= ws(218)) { ctx.globalAlpha = clamp(P(t, ws(218), 0.3)); boldText(ctx, 'DAY 2 STARTS WITH YOUR CHOICE  →', 360 + Math.sin(t * 5) * 4, 1210, 34, '#ffffff', { stroke: 6 }); ctx.globalAlpha = 1; }
    },
    overlay(ctx, t) {
      // "be follower #1,000" pill under the HUD
      if (t > ws(209) - 0.1 && t < DAY2_T) { const k = popScale(t, ws(209) - 0.1, 0.3) * (1 + Math.sin(t * 6) * 0.04); ctx.save(); ctx.translate(610, 188); ctx.scale(k, k); ctx.rotate(0.05); rr(ctx, -96, -40, 192, 80, 20); ctx.fillStyle = '#ff6fb5'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); boldText(ctx, 'BE FOLLOWER', 0, -14, 24, '#fff', { stroke: 0, shadow: false }); boldText(ctx, '#1,000 👆', 0, 16, 28, '#ffd23f', { stroke: 0, shadow: false }); ctx.restore(); }
      if (t >= DAY2_T - 0.12) {
        const k = P(t, DAY2_T - 0.12, 0.2); ctx.fillStyle = `rgba(6,6,10,${0.94 * k})`; ctx.fillRect(0, 0, W, H);
        if (t >= DAY2_T) {
          const s = E.back(P(t, DAY2_T, 0.3)); ctx.save(); ctx.translate(360, 470); ctx.scale(s, s); ctx.rotate(-0.04); boldText(ctx, 'DAY 2', 0, 0, 150, '#ffffff', { font: 'Luckiest Guy', stroke: 20 }); ctx.restore();
          const s2 = E.back(P(t, DAY2_T + 0.2, 0.3)); ctx.save(); ctx.translate(360, 610); ctx.scale(s2, s2); ctx.rotate(0.03); rr(ctx, -250, -42, 500, 84, 20); ctx.fillStyle = '#ff6fb5'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke(); boldText(ctx, 'HE DISCOVERS FILTERS', 0, 3, 46, '#fff', { stroke: 0 }); ctx.restore();
          // Walt with a puppy filter
          const s3 = E.back(P(t, DAY2_T + 0.35, 0.3)); ctx.save(); ctx.translate(360, 1260); ctx.scale(s3, s3);
          drawWalt(ctx, t, { x: 0, y: 0, s: 0.95, pose: 'idle', expr: 'joy', seed: 11 });
          for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 84, -515); ctx.rotate(sd * 0.4); ell(ctx, 0, 0, 34, 66); fillStroke(ctx, '#8a5a2b', OUT, 5); ell(ctx, 0, 6, 18, 44); ctx.fillStyle = '#e3b07a'; ctx.fill(); ctx.restore(); }
          ell(ctx, 0, -405, 26, 18); fillStroke(ctx, '#1b1b22', OUT, 4); ctx.beginPath(); ctx.moveTo(-14, -362); ctx.quadraticCurveTo(0, -300, 14, -362); ctx.closePath(); fillStroke(ctx, '#ff6f8f', OUT, 4);
          ctx.restore();
        }
      }
    },
  });

  // ================= captions =================
  const C = (a, b, col, size) => CHUNKS.push({ a, b, col: col || {}, size });
  C(0, 1); C(2, 2, { 2: 'Y' }); C(3, 4); C(5, 5, { 5: 'Y' }, 96); C(6, 8); C(9, 10); C(11, 13, { 11: 'B', 12: 'B', 13: 'Y' });
  C(14, 15, { 14: 'Y', 15: 'Y' }); C(16, 18); C(19, 20); C(21, 23, { 23: 'P' });
  C(24, 24); C(25, 26, { 26: 'P' }); C(27, 28, { 27: 'P' }); C(29, 31); C(32, 33, { 33: 'Y' });
  C(34, 36, { 36: 'R' }, 92);
  C(37, 38); C(39, 40, { 39: 'Y', 40: 'P' }); C(41, 43); C(44, 46, { 46: 'B' });
  C(47, 49, { 48: 'P' }); C(50, 50, { 50: 'P' }); C(51, 52); C(53, 54, { 54: 'Y' }); C(55, 55); C(56, 57, { 57: 'Y' });
  C(58, 60); C(61, 62); C(63, 65, { 64: 'B', 65: 'B' }); C(66, 68, { 66: 'R', 67: 'R', 68: 'R' }, 96);
  C(69, 69, { 69: 'P' }); C(70, 70, { 70: 'Y' }, 96);
  C(71, 73, { 73: 'B' }); C(74, 75); C(76, 77); C(78, 79, { 78: 'R' }, 92); C(80, 82); C(83, 85); C(86, 86, { 86: 'G' }, 96); C(87, 88, { 88: 'Y' });
  C(89, 90, { 90: 'R' }, 92); C(91, 92, { 92: 'Y' }); C(93, 94, { 93: 'R', 94: 'R' }); C(95, 95, { 95: 'P' }); C(96, 96, { 96: 'R' }, 96);
  C(97, 97); C(98, 100, { 99: 'B', 100: 'B' }); C(101, 102); C(103, 105, { 104: 'Y', 105: 'Y' }); C(106, 107); C(108, 109, { 109: 'Y' });
  C(110, 111, { 111: 'B' }); C(112, 113, { 112: 'R' }); C(114, 116, { 116: 'Y' }); C(117, 118, { 117: 'P', 118: 'P' }, 92); C(119, 120); C(121, 122, { 122: 'B' }, 92);
  C(123, 124); C(125, 126, { 126: 'R' }); C(127, 128); C(129, 130, { 130: 'Y' }); C(131, 133, { 132: 'Y', 133: 'Y' }); C(134, 135); C(136, 137); C(138, 139); C(140, 140); C(141, 142, { 141: 'P', 142: 'P' }, 96);
  C(143, 143, { 143: 'P' }); C(144, 144, { 144: 'Y' }, 100);
  C(145, 146); C(147, 147); C(148, 149, { 148: 'R', 149: 'R' }, 92); C(150, 152); C(153, 154, { 154: 'B' }); C(155, 157, { 156: 'G' });
  C(158, 158, { 158: 'P' }); C(159, 159, { 159: 'Y' }, 100); C(160, 162); C(163, 164, { 163: 'Y', 164: 'Y' });
  C(165, 166); C(167, 168); C(169, 171); C(172, 173, { 173: 'P' }); C(174, 175, { 175: 'P' }); C(176, 177, { 176: 'R' }, 92);
  C(178, 179, { 179: 'P' }); C(180, 181); C(182, 182, { 182: 'P' }); C(183, 185, { 185: 'Y' }); C(186, 187); C(188, 189); C(190, 191, { 190: 'P' });
  C(192, 194, { 193: 'R' }); C(195, 196); C(197, 198, { 197: 'Y' }); C(199, 201, { 199: 'R', 200: 'R', 201: 'R' }, 96);
  C(202, 204); C(205, 206, { 205: 'Y', 206: 'Y' }); C(207, 208); C(209, 211, { 209: 'Y', 211: 'P' }); C(212, 214, { 212: 'Y' }); C(215, 215, { 215: 'Y' }, 90); C(216, 217, { 217: 'B' }, 90);
  C(218, 220, { 218: 'Y', 219: 'Y' }); C(221, 223, { 223: 'Y' });

  // ================= music sections =================
  window.MUSIC = [
    { t: 0, style: 'main' }, { t: B0, style: 'tension' }, { t: C0, style: 'main' },
    { t: camOn, style: 'stop' }, { t: catT, style: 'main' },
    { t: crack, style: 'stop' }, { t: ws(117), style: 'main' },
    { t: I0, style: 'soft' }, { t: J0, style: 'main' }, { t: ws(148), style: 'stop' }, { t: ws(150), style: 'main' },
    { t: mob, style: 'poll' }, { t: L0, style: 'soft' }, { t: ws(199), style: 'stop' }, { t: M0, style: 'poll' },
    { t: DAY2_T, style: 'tease' }, { t: DUR, style: 'end' },
  ];
  CUES.sort((a, b) => a.t - b.t);
}
