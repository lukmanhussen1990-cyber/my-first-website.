// THE BRAIN-EATING AMOEBA (FILE No. 02): scene choreography.
// Every time is scene-local seconds; s.w('word') = when that word starts in the voiceover.
import { strokePartial, wobblyPath, markerEllipse, xMark, checkMark, inkText, card, arrowHead, setFont } from '../../engine/js/draw.js';
import { glowDot } from '../../engine/js/components.js';
import { drawAmoeba, drawScopeField, glowAmoeba, drawDrop, drawFallingDrop, drawSlide, along } from '../../engine/js/lab.js';
import { drawSun, drawNoseClip, drawWaves, drawPerson } from '../../engine/js/props.js';
import { FONTS } from '../../engine/js/assets.js';

export default function build(R, { U, W, H }) {
  const { ease, clamp, lerp, prog, rng, COLORS } = U;
  const G = R.geometry;
  const HG = G.head_section;
  let fig = 0;
  const S = (id, opts, fn) => R.scene(id, { fig: ++fig, ...opts }, fn);

  // ---- helpers --------------------------------------------------------------
  const P = (sp, t, pt) => sp.point(t, pt[0], pt[1]);
  const heartbeats = (s, from, to, rate = 1, gain = 0.5) => { for (let t = from; t < to - 0.2; t += 1 / rate) s.sfx(t, 'heartbeat', gain); };
  // two-line title: the red line follows 0.3–0.6 s after line 1
  const T2 = (s, lines, t1, t2, o = {}) => s.title(lines, { at: [Math.max(0.05, t1), t2 ?? t1 + 0.45], ...o });
  const pageTurn = (s) => s.sfx(0, 'pageturn', 0.7);

  // X-ray head (from head_section) and the route nose -> smell nerve -> brain
  const HEAD = { x: 560, y: 1160, h: 1160 };
  const head = (s, o = {}) => s.sprite('head_section', { x: HEAD.x, y: HEAD.y, h: HEAD.h, xray: true, ...o });
  const route = (sp) => HG.nerve.map((p) => P(sp, 0, p));
  const brainAt = (sp, t = 0) => P(sp, t, HG.brain);

  // red damage spots spreading through the brain
  function brainSpots(s, sp, o) {
    const r = rng(o.seed || 21);
    const spots = Array.from({ length: o.n || 18 }, () => {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      return { u: HG.brain[0] + Math.cos(a) * d * HG.brainR[0] * 0.92, v: HG.brain[1] + Math.sin(a) * d * HG.brainR[1] * 0.92, k: r(), sz: 0.6 + r() * 0.9 };
    });
    s.custom({ at: o.at, until: o.until, z: 30 }, (ctx, t) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const q of spots) {
        const a = prog(t, o.at + q.k * (o.spread ?? 1.6), 0.6);
        if (a <= 0) continue;
        const [x, y] = P(sp, t, [q.u, q.v]);
        const pulse = 1 + 0.18 * Math.sin(t * 6.3 + q.k * 9);
        glowDot(ctx, x, y, (o.size ?? 9) * q.sz * pulse * (0.6 + 0.4 * a), a * (o.alpha ?? 0.85), [236, 62, 36]);
      }
      ctx.restore();
    });
  }
  // soft red glow over the whole brain, optionally swelling
  function brainGlow(s, sp, o) {
    s.custom({ at: o.at, until: o.until, z: 28 }, (ctx, t) => {
      const a = prog(t, o.at, o.dur ?? 0.8) * (o.alpha ?? 0.5);
      if (a <= 0) return;
      const [cx, cy] = brainAt(sp, t);
      const sw = 1 + (o.swell ? o.swell(t) : 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy); ctx.scale(HG.brainR[0] * sp.w * 1.05 * sw, HG.brainR[1] * sp.h * 1.15 * sw);
      const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
      g.addColorStop(0, `rgba(255,96,44,${0.55 * a})`); g.addColorStop(0.6, `rgba(220,52,30,${0.32 * a})`); g.addColorStop(1, 'rgba(200,40,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
  // the burnt-in route glow (already travelled)
  const routeGlow = (s, sp, at = 0, dur = 0.1, width = 9) => s.glow({ at, sfx: false, paths: [{ pts: route(sp), at, dur, width }] });

  // a typed label with a thin leader line to a (screen) point
  function leader(s, text, o) {
    s.type(text, { at: o.at, until: o.until, x: o.x, y: o.y, size: o.size ?? 26, spacing: 3, cps: o.cps ?? 26, color: o.color, gain: 0.35, soundEvery: 2 });
    s.custom({ at: o.at + 0.1, until: o.until, layer: 'ui', z: 39 }, (ctx, t, sc) => {
      const [tx, ty] = typeof o.to === 'function' ? o.to(t, sc) : o.to;
      const sx = o.x + (o.fromDx ?? -8), sy = o.y + (o.fromDy ?? -9);
      const pts = [[sx, sy], [lerp(sx, tx, 0.5), sy], [tx, ty]];
      strokePartial(ctx, o.straight ? [[sx, sy], [tx, ty]] : pts, prog(t, o.at + 0.1, 0.35, ease.outQuad), 2.5, o.lineColor || (sc.look === 'xray' ? 'rgba(232,226,210,0.8)' : 'rgba(48,30,12,0.8)'));
      if (prog(t, o.at + 0.1, 0.35) >= 1) { ctx.fillStyle = o.lineColor || (sc.look === 'xray' ? 'rgba(240,230,210,0.95)' : '#2e1b0a'); ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill(); }
    });
  }

  // =========================================================== HOOK
  S('S01', { look: 'paper' }, (s) => {
    const tDrop = s.w('बूँद'), tIn = s.w('उसमें'), tLife = s.w('जीव'), tNose = s.w('नाक'), tBrain = s.w('दिमाग़');
    T2(s, ['IT ENTERS', 'THROUGH THE NOSE'], 0.05, 0.5);
    // beat 1: the warm pond, the camera sinks toward the water
    const cut = tDrop - 0.12;
    s.sprite('pond_summer', { x: 540, y: 1060, w: 1060, until: cut, shadow: { ground: 0, drop: 0 }, enter: { from: 'fade', dur: 0.25, sfx: null } });
    s.overlay({ at: cut, until: cut + 0.16, alpha: (t) => 0.55 * (1 - prog(t, cut, 0.15)), color: '#fbf6e8' });
    s.sfx(cut, 'whoosh', 0.45);
    // beat 2: one drop of it on a glass slide
    const DX = 400, DY = 1080;
    s.custom({ at: cut, z: 2 }, (ctx) => drawSlide(ctx, 540, 1090, 820, 300, { rot: -3, label: 'POND WATER\nSAMPLE No. 02' }));
    const land = cut + 0.32;
    s.custom({ at: cut, until: land, z: 4 }, (ctx, t) => drawFallingDrop(ctx, DX, lerp(560, DY - 10, ease.inQuad(prog(t, cut, land - cut))), 22, 1.6));
    s.sfx(land - 0.02, 'drip', 0.9);
    s.custom({ at: land, z: 4 }, (ctx, t) => {
      const p = ease.outBack(prog(t, land, 0.3), 2.2);
      drawDrop(ctx, DX, DY, 120 * p + 1, 78 * p + 1);
      const q = prog(t, land, 0.5);
      if (q < 1) { ctx.save(); ctx.strokeStyle = `rgba(240,248,240,${0.7 * (1 - q)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(DX, DY, 130 + 90 * q, 85 + 55 * q, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    });
    // beat 3: the lens finds something alive in it
    const lensAt = tIn - 0.15;
    s.magnifier({ at: lensAt, to: [DX + 10, DY - 40], from: [W + 300, DY + 380], r: 236, dur: 0.6,
      drawLens: (ctx, t, sc, cx, cy, Rl) => drawScopeField(ctx, cx, cy, Rl, t, { rim: false, reticle: false, seed: 12, draw: (c, X, Y, RR, tt) => {
        const lt = Math.max(0, tt - lensAt);
        const f = 1 - prog(tt, tLife - 0.35, 0.5, ease.outCubic);
        c.save(); if (f > 0.02) c.filter = `blur(${f * 7}px)`;
        drawAmoeba(c, X - RR * 0.12 + lt * RR * 0.03, Y + RR * 0.06 - lt * RR * 0.014, RR * 0.3, tt + 3, { seed: 3, heading: -0.35 });
        c.restore();
      } }) });
    s.sfx(tLife - 0.35, 'click', 0.6);
    s.type('LIVE SPECIMEN', { at: tLife + 0.1, x: 110, y: 760, size: 26, spacing: 4, cps: 24, gain: 0.35, soundEvery: 2 });
    s.target({ at: tBrain - 0.15, layer: 'ui', z: 70, r: 112, sfx: 'beep', gain: 0.4,
      pos: (t) => [DX + 10 - 236 * 0.12 + (t - lensAt) * 236 * 0.03, DY - 40 + 236 * 0.06 - (t - lensAt) * 236 * 0.014] });
    heartbeats(s, tNose, s.dur, 1.0, 0.35);
    s.camera([[0, 1.0, 540, 1120], [cut - 0.01, 1.42, 540, 1240, ease.inQuad], [cut, 1.0, 540, 1060], [lensAt, 1.0, 540, 1060], [s.dur, 1.06, DX, DY - 40, ease.inOutQuad]]);
  });

  S('S02', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.7);
    const hd = head(s);
    const pts = route(hd);
    T2(s, ['AND EATS', 'THE BRAIN'], 0.12, 0.57);
    s.glow({ at: 0.12, paths: [{ pts, at: 0.12, dur: 1.0, width: 11 }], gain: 0.45 });
    s.swarm({ at: 0.2, path: pts, count: 6, gap: 0.12, dur: 1.15, size: 11, sfx: false });
    brainSpots(s, hd, { at: s.w('खाने') - 0.35, n: 24, spread: 1.0, size: 10 });
    brainGlow(s, hd, { at: s.w('खाने') - 0.2, alpha: 0.45 });
    const term = s.terminal('TARGET: BRAIN', { at: 0.3, x: 96, y: 1268, cps: 22, barAt: 1.05, barDur: 1.0,
      wires: [() => { const [bx, by] = brainAt(hd); return [[440, 1268], [440, 1190], [bx, 1190], [bx, by + 30]]; }] });
    s.target({ at: term.barAt + term.barDur, pos: brainAt(hd), r: 78, sfx: false });
    heartbeats(s, 0.15, s.dur, 1.15, 0.4);
    s.camera([[0, 1.0, 560, 1000], [s.dur, 1.07, 600, 900, ease.inOutQuad]]);
  });

  S('S03', { look: 'paper' }, (s) => {
    const t97 = s.w('सत्तानवे'), tEnd = s.w('बचते');
    s.kicker('THE ODDS', { at: 0.1 });
    s.bigNumber('97%', { at: t97 - 0.15, x: 540, y: 1010, size: 520, alpha: 0.2 });
    T2(s, [{ text: '97%', size: 150 }, "DON'T SURVIVE"], t97 - 0.05, t97 + 0.4);
    // 100 dots = 100 people with PAM; 97 fill in, 3 stay open
    const open = new Set([23, 58, 86]);
    const order = []; for (let i = 0; i < 100; i++) if (!open.has(i)) order.push(i);
    const fillAt = new Map(order.map((i, k) => [i, t97 + 0.05 + k * 0.0135]));
    const gx = 540 - 4.5 * 58, gy = 1010 - 4.5 * 58;
    s.custom({ at: 0.15, layer: 'ui', z: 30 }, (ctx, t) => {
      for (let i = 0; i < 100; i++) {
        const x = gx + (i % 10) * 58, y = gy + Math.floor(i / 10) * 58;
        const a = prog(t, 0.15 + (i % 10) * 0.02 + Math.floor(i / 10) * 0.02, 0.2);
        if (a <= 0) continue;
        ctx.save(); ctx.globalAlpha *= a;
        ctx.strokeStyle = 'rgba(46,28,12,0.7)'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
        const f = fillAt.has(i) ? prog(t, fillAt.get(i), 0.08) : 0;
        if (f > 0) { ctx.fillStyle = `rgba(46,28,12,${0.86 * f})`; ctx.beginPath(); ctx.arc(x, y, 18 * (0.5 + 0.5 * f), 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (open.has(i) && t >= tEnd - 0.25) markerEllipse(ctx, x, y, 30, 30, prog(t, tEnd - 0.25, 0.3), { width: 4, seed: i });
      }
    });
    for (let k = 0; k < 97; k += 8) s.sfx(t97 + 0.05 + k * 0.0135, 'tick', 0.22);
    s.sfx(tEnd - 0.25, 'pen', 0.5);
    s.type('EACH DOT = 1 OF 100 PEOPLE WITH PAM', { at: 0.6, x: 540, y: 1340, size: 22, spacing: 2, cps: 40, align: 'center', gain: 0.25, soundEvery: 3 });
    s.type('PAM: PRIMARY AMEBIC MENINGOENCEPHALITIS', { at: s.w('इन्फ़ेक्शन'), x: 540, y: 1380, size: 22, spacing: 2, cps: 40, align: 'center', gain: 0.25, soundEvery: 3 });
    s.stamp('NOT A MOVIE', { at: tEnd + 0.12, x: 570, y: 1120, rot: -9, size: 98 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  S('S04', { look: 'paper' }, (s) => {
    const tName = s.w('नाम'), tF = s.w('फ़ाउलेरी');
    T2(s, ['NOT', 'FICTION'], 0.08, 0.53);
    s.scope({ at: 0.05, pos: [600, 1056], r: 290, focusFrom: 8, focusDur: 0.6, seed: 4,
      amoebas: [{ x: -0.22, y: 0.12, size: 0.3, heading: -0.38, speed: 0.05, seed: 5 }] });
    s.nameTag('BRAIN-EATING AMOEBA', 'NAEGLERIA FOWLERI', { at: tName - 0.2, x: 100, y: 604, size: 50, latinSize: 25 });
    s.stamp('100% REAL', { at: tF + 0.45, x: 660, y: 1300, rot: -8, size: 100 });
    s.camera([[0, 1.0, 600, 1040], [s.dur, 1.05, 600, 1040]]);
  });

  // =========================================================== MEET IT
  S('S06', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tWarm = s.w('गर्म'), tL = s.w('झील'), tR = s.w('नदी'), tP = s.w('तालाब'), tS = s.w('गर्मियों');
    T2(s, ['LOVES', 'WARM WATER'], tWarm - 0.45, tWarm);
    s.sprite('pond_summer', { x: 570, y: 1010, w: 1000, shadow: { ground: 0, drop: 0 }, enter: { from: 'fade', dur: 0.3, sfx: null } });
    s.steam({ at: 0.6, from: [[420, 1090], [640, 1110], [820, 1080]], rise: 160, size: 46, count: 10, life: 2.4, alpha: 0.55, sfx: false });
    s.thermometer({ at: 0.15, x: 70, y: 770, h: 560, from: 16, to: 39, riseAt: tWarm, riseDur: 1.5, rot: -3 });
    s.torn('LAKES', { at: tL, x: 300, y: 1330, size: 54, rot: -3 });
    s.torn('RIVERS', { at: tR, x: 520, y: 1346, size: 54, rot: 2 });
    s.torn('PONDS', { at: tP, x: 758, y: 1326, size: 54, rot: -2 });
    s.custom({ at: tS - 0.1, layer: 'ui', z: 45 }, (ctx, t) => {
      const p = prog(t, tS - 0.1, 0.35, ease.outBack);
      ctx.save(); ctx.translate(880, 655); ctx.scale(p, p); drawSun(ctx, 0, 0, 66, t); ctx.restore();
    });
    s.sfx(tS - 0.1, 'pop', 0.5);
    s.torn({ text: 'SUMMER', red: true }, { at: tS + 0.1, x: 560, y: 598, size: 60, rot: -4 });
    s.type('MOST CASES', { at: tS + 0.45, x: 572, y: 718, size: 24, spacing: 4, cps: 24, gain: 0.3 });
    s.camera([[0, 1.0, 570, 1010], [s.dur, 1.06, 600, 990]]);
  });

  S('S07', { look: 'paper' }, (s) => {
    const tNo1 = s.w('नहीं'), tP = s.w('एक'), tNo2 = s.w('नहीं', 1), tWay = s.w('इसका'), tNose = s.w('नाक');
    s.checklist({ at: 0.05, x: 110, y: 300, w: 860, h: 418, header: 'HOW DOES IT GET IN?', size: 56, rot: -1, items: [
      { text: 'DRINKING IT', at: 0.15, mark: 'x', markAt: tNo1, strikeAt: tNo1 + 0.2 },
      { text: 'FROM A PERSON', at: tP, mark: 'x', markAt: tNo2, strikeAt: tNo2 + 0.2 },
      { text: 'WATER UP THE NOSE', at: tWay, mark: 'check', markAt: tNose, circleAt: tNose + 0.12, color: COLORS.red },
    ] });
    const CX = 540, CY = 1110;
    const pop = (t, at) => ease.outBack(prog(t, at, 0.3));
    // 1. a glass of water, crossed out
    s.custom({ at: 0.2, until: tP, layer: 'ui', z: 30 }, (ctx, t) => {
      const p = pop(t, 0.2);
      ctx.save(); ctx.translate(CX, CY); ctx.scale(p, p);
      ctx.fillStyle = 'rgba(160,196,186,0.35)';
      ctx.beginPath(); ctx.moveTo(-92, -40); ctx.lineTo(92, -40); ctx.lineTo(74, 150); ctx.lineTo(-74, 150); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(46,28,12,0.85)'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-112, -170); ctx.lineTo(-76, 160); ctx.lineTo(76, 160); ctx.lineTo(112, -170); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -40, 94, 13, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-70, -120); ctx.lineTo(-52, 120); ctx.stroke();
      ctx.restore();
      if (t >= tNo1) xMark(ctx, CX, CY, 300, prog(t, tNo1, 0.3), COLORS.redInk, 14);
    });
    s.sfx(0.2, 'pop', 0.4); s.sfx(tNo1, 'pen', 0.7);
    // 2. person to person, crossed out
    s.custom({ at: tP, until: tWay, layer: 'ui', z: 30 }, (ctx, t) => {
      const p = pop(t, tP);
      ctx.save(); ctx.translate(CX, CY); ctx.scale(p, p);
      drawPerson(ctx, -190, 0, 300, 'rgba(46,28,12,0.88)');
      drawPerson(ctx, 190, 0, 300, 'rgba(46,28,12,0.88)');
      ctx.restore();
      strokePartial(ctx, [[CX - 100, CY - 40], [CX + 90, CY - 40]], prog(t, tP + 0.3, 0.4), 6, 'rgba(46,28,12,0.8)', { dash: [16, 12] });
      if (prog(t, tP + 0.3, 0.4) >= 1) arrowHead(ctx, CX + 100, CY - 40, 0, 30, 'rgba(46,28,12,0.85)');
      if (t >= tNo2) xMark(ctx, CX, CY - 40, 200, prog(t, tNo2, 0.3), COLORS.redInk, 14);
    });
    s.sfx(tP, 'pop', 0.4); s.sfx(tNo2, 'pen', 0.7);
    // 3. the nose: the only way in
    s.custom({ at: tWay, layer: 'ui', z: 30 }, (ctx, t, sc) => {
      const p = pop(t, tWay);
      const a = sc.reel.assets.get('head_section'), cr = HG.noseCrop;
      const sw = (cr[2] - cr[0]) * a.w, sh = (cr[3] - cr[1]) * a.h, Rr = 250;
      ctx.save(); ctx.translate(CX, CY); ctx.scale(p, p);
      ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.arc(0, 0, Rr + 14, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, Rr, 0, Math.PI * 2); ctx.clip();
      const k = Math.max((Rr * 2) / sw, (Rr * 2) / sh);
      ctx.drawImage(a.img, cr[0] * a.w, cr[1] * a.h, sw, sh, -sw * k / 2, -sh * k / 2, sw * k, sh * k);
      ctx.restore();
      ctx.strokeStyle = 'rgba(46,28,12,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, Rr + 14, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (t >= tNose) {
        // the nostril inside the crop
        const nx = CX + ((HG.nostril[0] - (cr[0] + cr[2]) / 2) * a.w) * Math.max((Rr * 2) / sw, (Rr * 2) / sh);
        const ny = CY + ((HG.nostril[1] - (cr[1] + cr[3]) / 2) * a.h) * Math.max((Rr * 2) / sw, (Rr * 2) / sh);
        markerEllipse(ctx, nx + 10, ny - 6, 80, 64, prog(t, tNose, 0.4, ease.inOutQuad), { width: 7, seed: 31 });
      }
    });
    s.sfx(tWay, 'whoosh', 0.4); s.sfx(tNose, 'pen', 0.7);
    s.type('THE ONLY WAY IN', { at: s.w('बस'), x: 540, y: 1430 - 30, size: 28, spacing: 5, cps: 26, align: 'center', gain: 0.35 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1000]]);
  });

  // =========================================================== HOW IT ATTACKS
  S('S08', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tJump = s.w('छलांग'), tAnd = s.w('और'), tNose = s.w('नाक');
    const tHit = tAnd - 0.12;
    T2(s, ['ONE', 'DIVE'], tJump - 0.42, tJump);
    // wide: the warm pond, the man drops in feet-first
    s.sprite('pond_summer', { x: 540, y: 1160, w: 1240, until: tHit, shadow: { ground: 0, drop: 0 } });
    s.sprite('diver', { h: 780, until: tHit, anchor: G.diver.feet, shadow: { ground: 0, drop: 0.22 }, z: 4,
      path: [[0, 700, 700], [tJump, 670, 900, ease.outQuad], [tHit, 640, 1330, ease.inQuad]], rotKeys: [[0, 3], [tHit, -2]] });
    s.sfx(tJump - 0.2, 'whoosh', 0.55);
    // the plunge (closer shot): water reaches his nose
    const SP = s.sprite('diver_splash', { at: tHit, x: 560, y: 1040, w: 1040, shadow: { ground: 0, drop: 0 }, z: 6,
      enter: { from: 'scale', s0: 0.9, dur: 0.22, sfx: null } });
    s.sfx(tHit, 'splash', 1.0);
    s.shake(tHit + 0.02, 0.28, 13);
    s.overlay({ at: tHit, until: tHit + 0.2, alpha: (t) => 0.5 * (1 - prog(t, tHit, 0.18)), color: '#fbfff6' });
    const noseW = () => P(SP, 0, G.diver_splash.nose);
    s.droplets({ at: tHit + 0.02, origin: [560, 1040 + (G.diver_splash.water - 0.5) * 1040 * 1425 / 1024], count: 38, width: 460, speed: [700, 1500], size: [4, 12], life: 1.0, z: 20 });
    // water forced up the nostril
    s.custom({ at: tNose - 0.4, z: 22 }, (ctx, t) => {
      const [nx, ny] = noseW();
      for (let i = 0; i < 6; i++) {
        const ph = ((t - (tNose - 0.4)) * 1.6 + i / 6) % 1;
        const x = lerp(nx - 70, nx + 6, ease.inQuad(ph)), y = lerp(ny + 70, ny - 4, ph) + Math.sin(ph * 6 + i) * 4;
        drawFallingDrop(ctx, x, y, 7 * (1 - ph * 0.4), 1.2, Math.sin(ph * Math.PI));
      }
    });
    s.bubbles({ at: tNose - 0.1, origin: () => { const [nx, ny] = noseW(); return [nx + 40, ny + 70]; }, count: 12, width: 120, top: 0, sfx: true, gain: 0.5 });
    s.torn([{ text: 'WATER UP', red: true }, { text: 'THE NOSE', red: true }], { at: tNose, x: 92, y: 640, size: 64, rot: -3 });
    s.custom({ at: tNose + 0.12, layer: 'ui', z: 46 }, (ctx, t, sc) => {
      const [ex, ey] = sc.toScreen(noseW());
      const pts = [[190, 830], [170, ey - 170], [ex - 46, ey - 26]];
      const pp = prog(t, tNose + 0.12, 0.35, ease.outQuad);
      const curve = []; for (let k = 0; k <= 20; k++) { const u = k / 20; curve.push([(1 - u) ** 2 * pts[0][0] + 2 * u * (1 - u) * pts[1][0] + u * u * pts[2][0], (1 - u) ** 2 * pts[0][1] + 2 * u * (1 - u) * pts[1][1] + u * u * pts[2][1]]); }
      strokePartial(ctx, curve, pp, 6, COLORS.red, { dash: [16, 11] });
      if (pp >= 1) arrowHead(ctx, ex - 40, ey - 22, Math.atan2(curve[20][1] - curve[17][1], curve[20][0] - curve[17][0]), 30, COLORS.red);
    });
    s.sfx(tNose + 0.12, 'pen', 0.5);
    const nz = [560 + (G.diver_splash.nose[0] - 0.5) * 1040, 1040 + (G.diver_splash.nose[1] - 0.5) * 1040 * 1425 / 1024];
    s.camera([[0, 1.0, 560, 1100], [tHit - 0.01, 1.04, 560, 1100], [tHit, 1.0, nz[0], nz[1]], [s.dur, 1.2, nz[0], nz[1], ease.inOutQuad]]);
  });

  S('S09', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.7);
    const hd = head(s);
    const pts = route(hd);
    const tNerve = s.w('नस'), tSmell = s.w('सूँघते'), tAm = s.w('अमीबा'), tBone = s.w('हड्डी'), tHoles = s.w('छेदों'), tBrain = s.w('दिमाग़');
    T2(s, ['THE', 'SECRET ROAD'], 0.1, 0.55);
    // the smell nerve: light up the bulb, its tract and the fibres that pass down through the thin bone
    s.custom({ at: tNerve - 0.1, z: 22 }, (ctx, t) => {
      const a = prog(t, tNerve - 0.1, 0.5) * (0.85 + 0.15 * Math.sin(t * 5));
      const [b0x, b0y] = P(hd, t, [0.30, 0.300]), [b1x, b1y] = P(hd, t, [0.44, 0.288]);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      strokePartial(ctx, [[b0x, b0y], [b1x, b1y]], a, 16, 'rgba(255,200,120,0.35)', { shadow: 'rgba(255,160,80,0.95)', shadowBlur: 22 });
      strokePartial(ctx, [[b0x, b0y], [b1x, b1y]], a, 5, 'rgba(255,236,200,0.8)');
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const top = P(hd, t, [0.285 + u * 0.05, 0.312]), bot = P(hd, t, [0.245 + u * 0.075, 0.37]);
        strokePartial(ctx, [top, bot], a, 2.2, 'rgba(255,214,160,0.75)', { shadow: 'rgba(255,150,70,0.8)', shadowBlur: 8 });
      }
      ctx.restore();
    });
    s.sfx(tNerve - 0.1, 'hum', 0.4);
    leader(s, 'SMELL NERVE', { at: tNerve + 0.1, until: tBone - 0.15, x: 600, y: 1350, to: (t, sc) => sc.toScreen(P(hd, t, HG.bulb)), color: 'rgba(240,232,214,0.95)' });
    // amoebas climb the nerve
    s.glow({ at: tAm, paths: [{ pts, at: tAm, dur: tBrain - tAm, width: 9 }], gain: 0.4 });
    s.swarm({ at: tAm, path: pts, count: 8, gap: 0.28, dur: tBrain - tAm + 0.1, size: 12, sfx: false });
    // the thin bone with tiny holes, close up
    const IX = 540, IY = 1060, IR = 196;
    s.custom({ at: tBone - 0.1, until: tBrain - 0.2, layer: 'ui', z: 50 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tBone - 0.1, 0.35));
      ctx.save(); ctx.translate(IX, IY); ctx.scale(p, p);
      ctx.fillStyle = '#121210'; ctx.beginPath(); ctx.arc(0, 0, IR, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(230,230,215,0.07)'; ctx.lineWidth = 1;
      for (let g = -IR; g < IR; g += 34) { ctx.beginPath(); ctx.moveTo(g, -IR); ctx.lineTo(g, IR); ctx.moveTo(-IR, g); ctx.lineTo(IR, g); ctx.stroke(); }
      // bulb above, bone plate across the middle with holes, fibres through them
      ctx.fillStyle = 'rgba(240,220,180,0.22)'; ctx.beginPath(); ctx.ellipse(0, -112, 150, 42, 0, 0, Math.PI * 2); ctx.fill();
      const holes = [-120, -60, 0, 60, 120];
      ctx.fillStyle = 'rgba(214,210,196,0.62)';
      ctx.beginPath(); ctx.moveTo(-IR, -18);
      for (const hx of holes) { ctx.lineTo(hx - 13, -18); ctx.lineTo(hx - 13, 18); ctx.lineTo(hx + 13, 18); ctx.lineTo(hx + 13, -18); }
      ctx.lineTo(IR, -18); ctx.lineTo(IR, 22); ctx.lineTo(-IR, 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#121210'; for (const hx of holes) ctx.fillRect(hx - 12, -19, 24, 42);
      ctx.fillStyle = 'rgba(120,118,104,0.5)'; const rr = rng(5); for (let k = 0; k < 60; k++) { const x = (rr() * 2 - 1) * IR, y = -16 + rr() * 34; if (!holes.some((hx) => Math.abs(x - hx) < 15)) { ctx.beginPath(); ctx.arc(x, y, 1.5 + rr() * 2, 0, Math.PI * 2); ctx.fill(); } }
      ctx.strokeStyle = 'rgba(255,220,170,0.55)'; ctx.lineWidth = 2.5;
      for (const hx of holes) { ctx.beginPath(); ctx.moveTo(hx + 4, IR); ctx.quadraticCurveTo(hx - 6, 60, hx, 0); ctx.quadraticCurveTo(hx + 4, -60, hx * 0.6, -100); ctx.stroke(); }
      // amoebas squeezing up through the holes
      holes.forEach((hx, k) => {
        const ph = ((t - tBone) * 0.55 + k * 0.23) % 1;
        if (t < tBone) return;
        const y = lerp(IR - 10, -110, ph), squeeze = Math.abs(y) < 30 ? 0.55 : 1;
        ctx.save(); ctx.translate(hx + Math.sin(ph * 9) * 3, y); ctx.scale(squeeze, 1 / Math.sqrt(squeeze));
        glowAmoeba(ctx, 0, 0, 13, t, k + 2, Math.sin(ph * Math.PI) * 1.2, -Math.PI / 2);
        ctx.restore();
      });
      ctx.restore();
      ctx.strokeStyle = 'rgba(232,226,210,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, IR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(224,72,44,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, IR + 9, -2.2, -0.9); ctx.stroke();
      ctx.restore();
    });
    s.sfx(tBone - 0.1, 'click', 0.5);
    leader(s, 'THIN BONE', { at: tBone + 0.15, until: tBrain - 0.2, x: 100, y: 800, to: [IX - IR * 0.62, IY - 2], size: 30, color: 'rgba(240,232,214,0.95)' });
    leader(s, 'TINY HOLES', { at: tHoles, until: tBrain - 0.2, x: 100, y: 1330, to: [IX - 60, IY + 12], size: 28, color: 'rgba(244,120,92,0.98)', lineColor: 'rgba(232,90,60,0.9)' });
    s.target({ at: tBrain, pos: brainAt(hd), r: 84 });
    brainGlow(s, hd, { at: tBrain, alpha: 0.4 });
    const nose = P(hd, 0, HG.nostril), plate = P(hd, 0, HG.plate), br = brainAt(hd);
    s.camera([[0, 1.0, 560, 1080], [tSmell, 1.3, nose[0] + 120, nose[1] - 60], [tBone - 0.3, 1.45, plate[0], plate[1] + 20],
      [tBrain - 0.3, 1.45, plate[0] + 60, plate[1] - 20], [s.dur, 1.18, br[0] - 40, br[1] + 60, ease.inOutQuad]]);
    heartbeats(s, 0.3, s.dur, 1.0, 0.35);
  });

  S('S10', { look: 'xray' }, (s) => {
    const hd = head(s);
    const tCells = s.w('सेल्स'), tSw = s.w('सूजन');
    T2(s, ['INTO', 'THE BRAIN'], 0.08, 0.53);
    routeGlow(s, hd, 0, 0.1, 7);
    brainSpots(s, hd, { at: tCells - 0.25, n: 34, spread: 2.2, size: 10 });
    const swell = (t) => (t < tSw ? 0 : 0.05 * prog(t, tSw, 0.6) + 0.035 * Math.max(0, Math.sin((t - tSw) * Math.PI * 2 * 0.9)));
    brainGlow(s, hd, { at: tSw - 0.25, alpha: 0.75, swell });
    // pressure arrows pushing outward from the swelling brain
    s.custom({ at: tSw, z: 32 }, (ctx, t) => {
      const [cx, cy] = brainAt(hd);
      const rx = HG.brainR[0] * hd.w * 0.98, ry = HG.brainR[1] * hd.h * 1.12;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.88 + (i / 6) * Math.PI * 0.76;
        const p = prog(t, tSw + i * 0.04, 0.3, ease.outCubic), k = 1 + swell(t) * 1.6;
        const x0 = cx + Math.cos(a) * rx * k, y0 = cy + Math.sin(a) * ry * k;
        const x1 = x0 + Math.cos(a) * 46 * p, y1 = y0 + Math.sin(a) * 46 * p;
        strokePartial(ctx, [[x0, y0], [x1, y1]], 1, 5, 'rgba(232,74,46,0.95)');
        if (p > 0.6) arrowHead(ctx, x1, y1, a, 22, 'rgba(232,74,46,0.95)');
      }
    });
    s.sfx(tSw, 'inflate', 0.6);
    s.torn({ text: 'SWELLING', red: true }, { at: tSw + 0.15, x: 110, y: 1270, size: 64, rot: -3 });
    heartbeats(s, 0.1, s.dur, 0.85, 0.6);
    const br = brainAt(hd);
    s.camera([[0, 1.15, br[0], br[1] + 120], [s.dur, 1.32, br[0], br[1] + 100, ease.inOutQuad]]);
  });

  S('S11', { look: 'paper' }, (s) => {
    T2(s, ['LOOKS LIKE', 'A FEVER'], 0.08, 0.53);
    s.bigNumber('?', { at: 0.15, x: 780, y: 1000, size: 760, alpha: 0.16 });
    s.dropCards({ items: [
      { text: 'HEADACHE', sub: 'EARLY SIGN', at: s.w('सिरदर्द') - 0.12, x: 410, y: 780, rot: -4 },
      { text: 'FEVER', sub: 'EARLY SIGN', at: s.w('बुखार', 1) - 0.12, x: 650, y: 1020, rot: 3 },
      { text: 'VOMITING', sub: 'EARLY SIGN', at: s.w('उल्टी') - 0.12, x: 430, y: 1260, rot: -2 },
    ] });
    s.thermometer({ at: s.w('बुखार') - 0.1, x: 790, y: 700, h: 420, from: 30, to: 41, riseAt: s.w('बुखार'), riseDur: 1.2, rot: 4, slide: 360 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  S('S12', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const hd = head(s, { alpha: 0.6, h: 1000, y: 1230 });
    const tOne = s.w('एक'), t18 = s.w('अठारह'), tDay = s.w('दिन'), tDie = s.w('दम');
    routeGlow(s, hd, 0, 0.1, 6);
    brainSpots(s, hd, { at: 0, n: 30, spread: 0.2, size: 9, alpha: 0.7 });
    brainGlow(s, hd, { at: 0, alpha: 0.6, swell: (t) => 0.03 * Math.max(0, Math.sin(t * Math.PI * 2 * 1.3)) });
    s.kicker('IT GETS WORSE FAST', { at: 0.12, color: 'rgba(232,226,210,0.9)' });
    s.title([{ text: '1–18', size: 180 }, { text: 'DAYS', red: true, size: 150 }], { at: [tOne - 0.05, t18 + 0.05] });
    s.monitor({ at: 0.3, x: 96, y: 1090, w: 480, h: 240, rate: 1.35, offAt: tDie + 0.3, label: 'PULSE', text: 'FAST', offText: '—' });
    s.dayCounter({ at: s.w('लक्षण') - 0.1, x: 800, y: 1210, from: 1, to: 18, countAt: tOne, countDur: Math.max(0.9, tDay - tOne + 0.1), rot: 2 });
    s.type('1–18 DAYS AFTER SYMPTOMS', { at: tDay + 0.05, x: 100, y: 1390, size: 26, spacing: 3, cps: 30, color: 'rgba(240,232,214,0.92)' });
    for (let t = 0.3, k = 0; t < tDie + 0.25; t += 1 / 1.35, k++) s.sfx(t, 'heartbeat', 0.45);
    s.sfx(tDie + 0.3, 'flat', 0.5);
    s.camera([[0, 1.0, 560, 1000], [s.dur, 1.06, 580, 960]]);
  });

  S('S13', { look: 'paper' }, (s) => {
    const t4 = s.w('चार');
    s.kicker('USA · 1962–2024', { at: 0.1 });
    s.title([{ text: '167 CASES' }, { text: '4 SURVIVED', red: true }], { at: [s.w('एक') - 0.05, t4 - 0.05] });
    s.tally({ at: 0.05, x: 150, y: 690, total: 167, drawAt: 0.35, drawDur: Math.max(1.8, s.w('केस') - 0.55), header: 'REPORTED CASES · CDC',
      circles: [{ index: 18, at: t4 - 0.15 }, { index: 71, at: t4 }, { index: 112, at: t4 + 0.15 }, { index: 153, at: t4 + 0.3 }] });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 980]]);
  });

  // =========================================================== INDIA
  S('S14', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tK = s.w('केरल'), tY = s.w('दो'), tA = s.w('अमीबा'), t170 = s.w('एक'), t42 = s.w('बयालीस');
    T2(s, ['NOW IN', 'INDIA'], tK - 0.5, tK);
    s.caseFile({ at: 0.1, x: 130, y: 640, w: 820, h: 660, tab: 'CASE FILE · KERALA', lines: [
      { label: 'LOCATION', value: 'KERALA, INDIA', at: tK, size: 54 },
      { label: 'YEAR', value: '2025', at: tY, size: 54 },
      { label: 'TYPE', value: 'AMOEBIC BRAIN INFECTIONS', at: tA, size: 40 },
      { label: 'CASES', value: '170', at: t170, size: 54 },
    ] });
    s.type('SOURCE: GOVT. OF INDIA', { at: tA + 1.2, x: 190, y: 1270, size: 20, spacing: 3, cps: 40, gain: 0.25, soundEvery: 3, rot: -2 });
    s.stamp('2025\n170 CASES · 42 DEATHS', { at: t42 + 0.05, x: 560, y: 1262, rot: -6, size: 62, scales: [0.75, 1] });
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== THE STRANGEST PART
  S('S16', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    s.kicker('NEXT', { at: 0.1 });
    T2(s, ['THE STRANGEST', 'PART'], s.w('सबसे') - 0.1, s.w('सबसे') + 0.35);
    s.bigNumber('?', { at: 0.2, x: 760, y: 1040, size: 760, alpha: 0.18 });
    s.folder({ at: 0.25, x: 170, y: 760, w: 720, h: 520, rot: 4, kicker: 'CASE STUDY · CDC', title: 'KARACHI' });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.05, 540, 1000]]);
  });

  S('S17', { look: 'paper' }, (s) => {
    const tK = s.w('कराची'), t17 = s.w('सत्रह'), t13 = s.w('तेरह'), tSwim = s.w('तैरने'), tOne = s.w('एक');
    s.title([{ text: '13 PATIENTS' }, { text: 'ONLY 1 SWAM', red: true }], { at: [t13 - 0.05, tOne - 0.1] });
    s.caseFile({ at: 0.05, x: 130, y: 640, w: 820, h: 330, tab: 'CASE STUDY · CDC', lines: [
      { label: 'LOCATION', value: 'KARACHI, PAKISTAN', at: Math.max(0.3, tK - 0.25), size: 46 },
      { label: 'PERIOD', value: '17 MONTHS', at: t17, size: 46 },
    ] });
    s.figures({ at: t13, x: 540, y: 1110, n: 13, perRow: 7, spacing: 122, size: 132, rowGap: 196,
      others: { at: tSwim + 0.15, text: '?' }, mark: { index: 7, at: tOne - 0.05, label: 'SWAM' } });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1020]]);
  });

  S('S18', { look: 'paper' }, (s) => {
    const tWudu = s.w('वुज़ू'), tTap = s.w('नल'), tHome = s.w('घरों'), tFound = s.w('मिले');
    s.kicker('DOCTORS BELIEVE', { at: 0.1 });
    T2(s, ['THE', 'TAP WATER'], tTap - 0.42, tTap);
    const TL = s.sprite('tap_lota', { x: 540, y: 1080, h: 880, shadow: { ground: 0.25, drop: 0.2, groundAt: 0.985 } });
    const mouth = P(TL, 0, G.tap_lota.mouth), lip = P(TL, 0, G.tap_lota.lotaTop);
    s.drip({ at: 0.25, from: mouth, to: lip[1] + 6, r: 11, period: 1.0, gain: 0.55 });
    leader(s, 'WATER FOR WUDU', { at: tWudu, x: 110, y: 1260, to: [lip[0] - 150, lip[1] + 110] });
    s.hangTag('TAP WATER', { at: tTap + 0.1, anchor: () => P(TL, 0, [0.18, 0.21]), len: 84, size: 44, swing: 0.5 });
    const LR = 168;
    s.magnifier({ at: tHome - 0.25, to: [mouth[0] + 8, mouth[1] + 200], r: LR, dur: 0.5,
      drawLens: (ctx, t, sc, cx, cy, Rl) => drawScopeField(ctx, cx, cy, Rl, t, { rim: false, reticle: false, seed: 31, draw: (c, X, Y, RR, tt) => {
        drawAmoeba(c, X - RR * 0.2 + (tt - tHome) * RR * 0.04, Y + RR * 0.12, RR * 0.2, tt, { seed: 7, heading: -0.5 });
        drawAmoeba(c, X + RR * 0.38, Y - RR * 0.36, RR * 0.12, tt + 1.3, { seed: 11, heading: 2.4 });
      } }) });
    s.torn({ text: 'AMOEBA FOUND', red: true }, { at: tFound - 0.1, x: 96, y: 1030, size: 50, rot: -3 });
    s.type('IN TAP WATER AT', { at: tHome + 0.2, x: 100, y: 1150, size: 22, spacing: 2, cps: 40, gain: 0.3, soundEvery: 3 });
    s.type("PATIENTS' HOMES", { at: tHome + 0.6, x: 100, y: 1184, size: 22, spacing: 2, cps: 40, gain: 0.3, soundEvery: 3 });
    s.camera([[0, 1.0, 560, 1060], [tTap, 1.04, 600, 1000], [s.dur, 1.08, 520, 1020, ease.inOutQuad]]);
  });

  S('S19', { look: 'paper' }, (s) => {
    const tW = s.w('वुज़ू'), tM2 = s.w('मसला', 1), tP = s.w('पानी');
    T2(s, ['IT WAS', 'THE WATER'], tP - 0.45, tP);
    s.custom({ at: 0.05, layer: 'ui', z: 38 }, (ctx, t) => {
      const p = prog(t, 0.05, 0.35, ease.outCubic);
      const c = card(820, 260, { color: '#ece2cb', seed: 77 });
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(130, 660 + (1 - p) * 60); ctx.rotate(-1.5 * Math.PI / 180);
      ctx.drawImage(c.canvas, -c.pad, -c.pad);
      ctx.restore();
    });
    s.sfx(0.05, 'slide', 0.5);
    s.type('NOT THE PRACTICE.', { at: tW, x: 180, y: 760, size: 46, spacing: 2, cps: 24, rot: -1.5 });
    s.type('THE WATER.', { at: tM2, x: 180, y: 860, size: 46, spacing: 2, cps: 24, rot: -1.5, color: COLORS.redInk });
    s.custom({ at: tP + 0.15, layer: 'ui', z: 40 }, (ctx, t) => {
      const pts = wobblyPath([[176, 884], [520, 876]], 4, 2.2, 10);
      ctx.save(); ctx.translate(130, 660); ctx.rotate(-1.5 * Math.PI / 180); ctx.translate(-130, -660);
      strokePartial(ctx, pts, prog(t, tP + 0.15, 0.3), 7, COLORS.red); ctx.restore();
    });
    s.sfx(tP + 0.15, 'pen', 0.6);
    // one drop of the problem water, the amoeba inside
    s.custom({ at: tM2 - 0.2, z: 10 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tM2 - 0.2, 0.35));
      ctx.save(); ctx.translate(560, 1210); ctx.scale(p, p);
      drawDrop(ctx, 0, 0, 230, 150, { inside: (c, x, y) => drawAmoeba(c, x - 40 + t * 6, y + 10, 36, t, { seed: 9, heading: -0.3 }) });
      ctx.restore();
      if (t >= tP) markerEllipse(ctx, 560, 1210, 270, 185, prog(t, tP, 0.45, ease.inOutQuad), { width: 6, seed: 5 });
    });
    s.sfx(tM2 - 0.2, 'drip', 0.6);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== STAY SAFE
  S('S20', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const t1 = s.w('झील'), tKeep = s.w('रखो'), tClip = s.w('नोज़'), t2 = s.w('गर्म'), tHead = s.w('सिर'), tKeep2 = s.w('रखो', 1);
    const t3 = s.w('और'), tWudu = s.w('वुज़ू'), tNeti = s.w('जल'), tBoil = s.w('उबालकर'), tCool = s.w('ठंडा'), tUse = s.w('इस्तेमाल');
    T2(s, ['HOW TO', 'STAY SAFE'], 0.08, 0.53);
    s.checklist({ at: 0.2, x: 110, y: 1032, w: 860, h: 400, header: 'CDC SAFETY TIPS', size: 38, rot: -1, items: [
      { text: 'HOLD YOUR NOSE / USE A NOSE CLIP', at: t1, mark: 'check', markAt: tKeep },
      { text: 'HEAD ABOVE WATER IN HOT SPRINGS', at: t2, mark: 'check', markAt: tKeep2 },
      { text: 'BOILED + COOLED WATER FOR NOSE RINSING', at: t3, mark: 'check', markAt: tUse + 0.1 },
    ] });
    // tip 1: the same man, done the safe way
    s.sprite('diver_holding_nose', { at: t1 - 0.1, until: t2, h: 600, anchor: [0.5, 0.5], shadow: { ground: 0, drop: 0.2 }, z: 3,
      path: [[t1 - 0.1, 740, 790], [t2, 740, 860, ease.linear]], enter: { from: 'top', dur: 0.4, dist: 600, sfx: 'whoosh' } });
    s.custom({ at: tClip - 0.05, until: t2, layer: 'ui', z: 32 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tClip - 0.05, 0.3));
      ctx.save(); ctx.translate(330, 760); ctx.scale(p, p); drawNoseClip(ctx, 0, 0, 190); ctx.restore();
    });
    s.sfx(tClip - 0.05, 'pop', 0.5);
    s.type('NOSE CLIP', { at: tClip + 0.15, until: t2, x: 330, y: 930, size: 28, spacing: 5, cps: 30, align: 'center', gain: 0.3 });
    // tip 2: head above the water in hot springs
    const HS = s.sprite('hot_spring', { at: t2 - 0.05, until: t3, x: 545, y: 830, w: 860, shadow: { ground: 0, drop: 0 }, z: 2, enter: { from: 'fade', dur: 0.25, sfx: 'slide' } });
    s.steam({ at: t2, until: t3, from: [[560, 820], [700, 850], [840, 830], [460, 860]], rise: 220, size: 54, count: 10, life: 2.4, alpha: 0.6, gain: 0.35 });
    s.custom({ at: tHead - 0.1, until: t3, layer: 'world', z: 20 }, (ctx, t) => {
      const g = G.hot_spring, wy = P(HS, t, [0, g.water])[1];
      const x0 = P(HS, t, [g.waterX[0], 0])[0] - 40, x1 = P(HS, t, [g.waterX[1], 0])[0] + 30;
      strokePartial(ctx, [[x0, wy], [x1, wy]], prog(t, tHead - 0.1, 0.35), 4, COLORS.red, { dash: [14, 10] });
      const [hx, hy] = P(HS, t, g.chin);
      const ax = x1 + 26, p = prog(t, tHead + 0.25, 0.35, ease.outCubic);
      strokePartial(ctx, [[ax, wy - 8], [ax, lerp(wy - 8, hy - 70, p)]], 1, 5, COLORS.red);
      if (p > 0.7) arrowHead(ctx, ax, hy - 70, -Math.PI / 2, 26, COLORS.red);
    });
    s.sfx(tHead - 0.1, 'pen', 0.45);
    s.type('HEAD UP', { at: s.w('ऊपर'), until: t3, x: 760, y: 700, size: 30, spacing: 4, cps: 24, color: COLORS.redInk, gain: 0.3 });
    // tip 3: nose rinsing (wudu or jal neti) with boiled and cooled water
    const lb = G.tap_lota.lotaBox;
    const lotaDraw = (ctx, sc, x, y, h, a = 1) => {
      const A = sc.reel.assets.get('tap_lota');
      const sw = (lb[2] - lb[0]) * A.w, sh = (lb[3] - lb[1]) * A.h, w = h * sw / sh;
      ctx.save(); ctx.globalAlpha *= a;
      ctx.save(); ctx.globalAlpha *= 0.3; ctx.filter = 'blur(10px)'; ctx.fillStyle = '#1a1006'; ctx.beginPath(); ctx.ellipse(x, y + h / 2 - 6, w * 0.42, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.drawImage(A.img, lb[0] * A.w, lb[1] * A.h, sw, sh, x - w / 2, y - h / 2, w, h);
      ctx.restore();
    };
    const lotaX = (t) => lerp(540, 770, prog(t, tBoil - 0.1, 0.5, ease.inOutCubic));
    const lotaH = (t) => lerp(400, 330, prog(t, tBoil - 0.1, 0.5, ease.inOutCubic));
    s.custom({ at: t3 - 0.05, z: 4 }, (ctx, t, sc) => {
      const p = prog(t, t3 - 0.05, 0.3, ease.outBack);
      lotaDraw(ctx, sc, lotaX(t), 800 + (1 - p) * 80, lotaH(t), clamp((t - t3 + 0.05) / 0.12));
    });
    s.sfx(t3 - 0.05, 'slide', 0.5);
    s.type('WUDU', { at: tWudu, x: 250, y: 760, size: 32, spacing: 6, cps: 20, until: tBoil - 0.1 });
    s.type('JAL NETI', { at: tNeti, x: 720, y: 640, size: 32, spacing: 6, cps: 20, until: tBoil - 0.1 });
    const K = s.sprite('kettle', { at: tBoil - 0.1, x: 300, y: 790, w: 360, shadow: { ground: 0.25, drop: 0.2 }, z: 5, enter: { from: 'left', dur: 0.45, dist: 700, sfx: 'whoosh' } });
    s.steam({ at: tBoil + 0.2, from: () => P(K, 0, G.kettle.spout), rise: 200, size: 44, count: 9, life: 2.0, alpha: 0.7, drift: -30, gain: 0.35 });
    s.type('BOIL', { at: tBoil + 0.1, x: 300, y: 1004, size: 30, spacing: 6, cps: 20, align: 'center', color: COLORS.redInk });
    s.arrow({ at: tCool - 0.05, pts: [[470, 790], [530, 760], [600, 790]], dur: 0.35, width: 5, head: 26 });
    s.type('COOL', { at: tCool, x: 535, y: 730, size: 30, spacing: 6, cps: 20, align: 'center', color: COLORS.redInk });
    s.type('(OR DISTILLED)', { at: tUse - 0.2, x: 770, y: 1010, size: 22, spacing: 2, cps: 30, align: 'center', gain: 0.25 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1000]]);
  });

  S('S21', { look: 'paper' }, (s) => {
    const tVery = s.w('बहुत'), tRare = s.w('रेयर'), tDont = s.w('डरना');
    T2(s, ['VERY', 'RARE'], tVery, Math.max(tVery + 0.35, Math.min(tVery + 0.6, tRare)));
    s.sprite('pond_summer', { x: 540, y: 1010, w: 1000, shadow: { ground: 0, drop: 0 }, enter: { from: 'fade', dur: 0.4, sfx: null } });
    s.steam({ at: 0.2, from: [[380, 1120], [620, 1140], [820, 1110]], rise: 120, size: 40, count: 8, life: 2.6, alpha: 0.35, sfx: false });
    s.stamp('VERY RARE', { at: tRare + 0.1, x: 560, y: 1070, rot: -8, size: 124, gain: 0.8, shake: 7 });
    s.type("DON'T PANIC. BE CAREFUL.", { at: tDont, x: 540, y: 1405, size: 34, spacing: 3, cps: 22, align: 'center' });
    s.camera([[0, 1.0, 540, 1010], [s.dur, 1.05, 540, 1010]]);
  });

  // =========================================================== ENDING
  S('S23', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    T2(s, ['HOW', 'STRANGE'], s.w('कितनी'), s.w('अजीब'));
    const cx = 540, cy = 1015, Rr = 255;
    s.scope({ at: 0.15, pos: [cx, cy], r: 94, reticle: false, seed: 15, amoebas: [{ x: -0.3, y: 0.1, size: 0.28, heading: -0.3, speed: 0.06, seed: 2 }] });
    const nodes = [
      { label: 'WARM WATER', img: 'pond_summer', crop: G.pond_summer.waterCrop },
      { label: 'NOSE', img: 'head_section', crop: HG.noseCrop },
      { label: 'SMELL NERVE', img: 'head_section', crop: HG.nerveCrop },
      { label: 'BRAIN', img: 'head_section', crop: HG.brainCrop },
    ];
    const step = 0.42;
    nodes.forEach((nd, i) => {
      const ang = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      const x = cx + Math.cos(ang) * Rr * 1.12, y = cy + Math.sin(ang) * Rr;
      const at = 0.3 + i * step;
      s.custom({ at, z: 6 }, (ctx, t, sc) => {
        const p = ease.outBack(prog(t, at, 0.3));
        const A = sc.reel.assets.get(nd.img), cr = nd.crop;
        const sw = (cr[2] - cr[0]) * A.w, sh = (cr[3] - cr[1]) * A.h, rx = 122, ry = 92;
        ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha *= clamp((t - at) / 0.1);
        ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.38)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#f0e7d3'; ctx.beginPath(); ctx.ellipse(0, 0, rx + 10, ry + 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
        const k = Math.max((rx * 2) / sw, (ry * 2) / sh);
        ctx.drawImage(A.img, cr[0] * A.w, cr[1] * A.h, sw, sh, -sw * k / 2, -sh * k / 2, sw * k, sh * k);
        ctx.restore();
        ctx.strokeStyle = 'rgba(46,28,12,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rx + 10, ry + 10, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      s.sfx(at, 'pop', 0.35);
      s.type(nd.label, { at: at + 0.12, x, y: y + 124, size: 21, spacing: 3, cps: 40, align: 'center', gain: 0.2, soundEvery: 4, layer: 'world' });
      if (i < nodes.length - 1) {
        const a0 = ang + 0.42, a1 = ang + (Math.PI * 2) / nodes.length - 0.42, pts = [];
        for (let k = 0; k <= 12; k++) { const a = lerp(a0, a1, k / 12); pts.push([cx + Math.cos(a) * Rr * 1.14, cy + Math.sin(a) * Rr * 1.04]); }
        s.arrow({ at: at + step * 0.7, pts, dur: 0.35, width: 5, head: 24, gain: 0.25 });
      }
    });
    s.type('SAVE THIS · SEND THIS', { at: s.w('भेजो') - 0.1, x: 99, y: 628, size: 32, spacing: 4, cps: 26, color: COLORS.redInk, gain: 0.35 });
    s.camera([[0, 1.0, 540, 1040], [s.dur, 1.03, 540, 1040]]);
  });
}
