// DENGUE: WHY THE SECOND TIME IS WORSE (FILE No. 04): scene choreography.
// Every time is scene-local seconds; s.w('word') = when that word starts in the voiceover.
import { strokePartial, wobblyPath, markerEllipse, xMark, checkMark, inkText, card, arrowHead, setFont } from '../../engine/js/draw.js';
import { FONTS } from '../../engine/js/assets.js';
import { DENV, drawDengueVirus, drawAntibody, drawGateCell, doorPoint, drawEgg, drawLarva, drawDayClock, drawHouse, drawCalendar, drawPill, drawShield, drawSpecimenFrame, drawPin, drawSmiley } from '../../engine/js/infection.js';

export default function build(R, { U, W, H }) {
  const { ease, clamp, lerp, prog, rng, COLORS } = U;
  const G = R.geometry;
  let fig = 0;
  const S = (id, opts, fn) => R.scene(id, { fig: ++fig, ...opts }, fn);
  const TAU = Math.PI * 2;

  // ---- helpers --------------------------------------------------------------
  const P = (sp, t, pt) => sp.point(t, pt[0], pt[1]);
  const heartbeats = (s, from, to, rate = 1, gain = 0.5) => { for (let t = from; t < to - 0.2; t += 1 / rate) s.sfx(t, 'heartbeat', gain); };
  const T2 = (s, lines, t1, t2, o = {}) => s.title(lines, { at: [Math.max(0.05, t1), t2 ?? t1 + 0.45], ...o });
  const pageTurn = (s) => s.sfx(0, 'pageturn', 0.7);
  const CREAM = 'rgba(232,226,210,0.9)';
  // a typed label with a thin leader line to a point; the line leaves from the side of the
  // text that faces the target (or its top/bottom), so it never crosses the letters
  function leader(s, text, o) {
    const size = o.size ?? 26, spacing = 3;
    s.type(text, { at: o.at, until: o.until, x: o.x, y: o.y, size, spacing, cps: o.cps ?? 26, color: o.color, align: o.align, gain: 0.35, soundEvery: 2 });
    s.custom({ at: o.at + 0.1, until: o.until, layer: 'ui', z: 39 }, (ctx, t, sc) => {
      const [tx, ty] = typeof o.to === 'function' ? o.to(t, sc) : o.to;
      setFont(ctx, FONTS.type, size); ctx.letterSpacing = `${spacing}px`;
      const tw = ctx.measureText(text).width; ctx.letterSpacing = '0px';
      const left = o.align === 'center' ? o.x - tw / 2 : o.x, right = left + tw, midY = o.y - size * 0.35;
      let pts;
      if (tx > right + 24) pts = [[right + 12, midY], [lerp(right + 12, tx, 0.4), midY], [tx, ty]];
      else if (tx < left - 24) pts = [[left - 12, midY], [lerp(left - 12, tx, 0.4), midY], [tx, ty]];
      else { const sx = clamp(tx, left + 10, right - 10); pts = [[sx, ty < o.y ? o.y - size - 8 : o.y + 12], [tx, ty]]; }
      const col = o.lineColor || (sc.look === 'xray' ? 'rgba(232,226,210,0.8)' : 'rgba(48,30,12,0.8)');
      strokePartial(ctx, pts, prog(t, o.at + 0.1, 0.35, ease.outQuad), 2.5, col);
      if (prog(t, o.at + 0.1, 0.35) >= 1) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, TAU); ctx.fill(); }
    });
  }
  // big Anton text drawn in a custom actor (centre-aligned at x)
  const bigText = (ctx, text, x, y, size, color) => { const ink = inkText(text, FONTS.title, size, color); ctx.drawImage(ink.canvas, x - ink.width / 2 - ink.pad, y - ink.base); return ink.width; };

  // ---- antibody-dependent enhancement: a virus caught by antibodies is carried to an
  // immune cell's door like a key, the lock clicks, the door opens and it multiplies inside.
  const ABS = 78, VR = 40, SPREAD = 0.6;
  const bindDist = (r0 = VR, s = ABS) => { const L = s * 0.68; return L * Math.cos(SPREAD) + Math.sqrt(Math.max(1, r0 * r0 - (L * Math.sin(SPREAD)) ** 2)); };
  function ade(s, o) {
    const [CX, CY] = o.cell, CR = o.cellR, DA = o.doorAng ?? Math.PI;
    const keyPhi = DA + Math.PI, d = bindDist(), stem = ABS * 0.55;
    const DP = doorPoint(CX, CY, CR, DA);
    const VD = [DP[0] - Math.cos(keyPhi) * (d + stem), DP[1] - Math.sin(keyPhi) * (d + stem)];
    const VI = [CX + Math.cos(DA) * CR * 0.3, CY + Math.sin(DA) * CR * 0.3];
    const tDock = o.tMove + (o.moveDur ?? 0.65), tClick = tDock + 0.05, tOpen = tClick + 0.18, tEnter = tOpen + 0.3, tIn = tEnter + 0.55;
    const drift = o.drift || ((t) => [o.v0[0] + Math.sin(t * 1.1) * 14 - t * 6, o.v0[1] + Math.sin(t * 1.7 + 1) * 12]);
    const V = (t) => {
      if (t < o.tMove) return drift(t);
      if (t < tDock) { const q = ease.inOutCubic(prog(t, o.tMove, tDock - o.tMove)), a = drift(o.tMove); return [lerp(a[0], VD[0], q), lerp(a[1], VD[1], q)]; }
      if (t < tEnter) return [VD[0] + Math.sin(t * 30) * 1.5 * prog(t, tDock, 0.1), VD[1]];
      const q = ease.inOutQuad(prog(t, tEnter, tIn - tEnter)); return [lerp(VD[0], VI[0], q), lerp(VD[1], VI[1], q)];
    };
    const phis = [keyPhi, keyPhi + 2.25, keyPhi - 2.25];
    // the immune cell
    s.custom({ at: o.cellAt ?? 0, z: 24 }, (ctx, t, sc) => {
      const inf = ease.inOutQuad(prog(t, tIn - 0.1, o.infDur ?? 1.0));
      drawGateCell(ctx, CX, CY, CR, t, { look: sc.look, door: DA, unlock: prog(t, tClick, 0.22, ease.outBack), open: ease.outCubic(prog(t, tOpen, 0.32)),
        lockGlow: prog(t, tDock - 0.1, 0.2), infected: inf, copies: (o.copies ?? 9) * prog(t, tIn, o.infDur ?? 1.0), virusType: o.type, alpha: prog(t, o.cellAt ?? 0, 0.3) });
    });
    // virus + bound antibodies
    s.custom({ at: o.at ?? 0, z: 30 }, (ctx, t, sc) => {
      const [vx, vy] = V(t), gone = prog(t, tIn - 0.15, 0.2);
      if (gone >= 1) return;
      const vs = lerp(1, 0.55, prog(t, tEnter, tIn - tEnter));
      drawDengueVirus(ctx, vx, vy, VR * vs, t, { type: o.type, look: sc.look, alpha: (1 - gone) * prog(t, o.at ?? 0, 0.3), glow: 1 });
      phis.forEach((phi, i) => {
        const bt = o.tBind + i * 0.14, q = ease.outCubic(prog(t, bt, 0.5));
        if (q <= 0) return;
        const hx = vx + Math.cos(phi) * d * vs, hy = vy + Math.sin(phi) * d * vs;
        const [fx, fy] = o.from[i];
        const a = (1 - prog(t, tEnter + 0.15, 0.3)) * clamp((t - bt) / 0.12);
        drawAntibody(ctx, lerp(fx, hx, q), lerp(fy, hy, q), ABS * vs, phi - Math.PI / 2 + (1 - q) * 1.6, { look: sc.look, type: o.abType, alpha: a });
      });
    });
    s.sfx(o.tBind, 'whoosh', 0.5);
    for (let i = 0; i < 3; i++) s.sfx(o.tBind + 0.45 + i * 0.14, 'click', 0.25, { v: i });
    s.sfx(tClick, 'lock', 0.9);
    s.sfx(tEnter, 'squish', 0.45);
    for (let k = 0; k < 6; k++) s.sfx(tIn + 0.1 + k * 0.16, 'pop', 0.22 + 0.04 * k, { v: k });
    return { V, tDock, tClick, tEnter, tIn, DP };
  }

  // larvae swimming in a round patch of water (used inside the magnifier lens)
  const lensWater = (ctx, t, sc, cx, cy, Rl) => {
    const g = ctx.createRadialGradient(cx - Rl * 0.3, cy - Rl * 0.35, Rl * 0.1, cx, cy, Rl * 1.1);
    g.addColorStop(0, '#dbe7dd'); g.addColorStop(1, '#9cb7ab');
    ctx.fillStyle = g; ctx.fillRect(cx - Rl, cy - Rl, Rl * 2, Rl * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); for (let x = cx - Rl; x <= cx + Rl; x += 10) { const y = cy - Rl * 0.62 + Math.sin(x * 0.05 + t * 2) * 3; x === cx - Rl ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    drawLarva(ctx, cx - Rl * 0.05, cy - Rl * 0.1, Rl * 0.95, t, { ang: 1.25, amp: 0.2 });
    drawLarva(ctx, cx + Rl * 0.45, cy + Rl * 0.2, Rl * 0.7, t + 0.5, { ang: 1.7, phase: 1.5 });
    drawLarva(ctx, cx - Rl * 0.5, cy + Rl * 0.35, Rl * 0.6, t + 0.9, { ang: 0.9, phase: 3 });
  };

  // =========================================================== HOOK
  S('S01', { look: 'xray' }, (s) => {
    const tDanger = s.w('ख़तरनाक'), tWhy = s.w('वजह'), tYour = s.w('तुम्हारी'), tImm = s.w('इम्युनिटी');
    T2(s, ['THE 2ND TIME', 'IS WORSE'], 0.05, 0.5);
    s.bloodStream({ at: 0, y: 1080, hh: 470, n: 40, r: 34, speed: 60, dir: -1 });
    // the other three types drifting by
    for (const [k, x0, y0] of [[1, 200, 760], [3, 900, 700], [4, 190, 1380]]) {
      s.custom({ at: 0.1 + k * 0.1, z: 22 }, (ctx, t, sc) => drawDengueVirus(ctx, x0 - t * 14 + Math.sin(t + k) * 12, y0 + Math.sin(t * 1.3 + k) * 16, 36, t, { type: k, look: sc.look, alpha: prog(t, 0.1 + k * 0.1, 0.4) }));
    }
    const A = ade(s, { cell: [720, 1130], cellR: 190, type: 2, abType: 1, v0: [230, 1130], tBind: tDanger - 0.1, tMove: tWhy - 0.25, copies: 10, infDur: 1.1,
      from: [[-60, 860], [80, 1500], [-80, 1250]] });
    leader(s, 'YOUR OWN ANTIBODIES', { at: tDanger + 0.45, until: tWhy - 0.2, x: 110, y: 1420, to: (t) => { const [x, y] = A.V(t); return [x - 60, y + 50]; }, size: 22, color: CREAM });
    s.type('IMMUNE CELL', { at: tYour, x: 720, y: 1400, size: 24, spacing: 4, cps: 26, align: 'center', color: CREAM, gain: 0.3 });
    heartbeats(s, 0.2, s.dur, 1.0, 0.45);
    s.camera([[0, 1.0, 540, 1020], [tWhy, 1.03, 560, 1060], [s.dur, 1.1, 640, 1110, ease.inOutQuad]]);
  });

  S('S02', { look: 'paper' }, (s) => {
    const tSci = s.w('विज्ञान'), tCase = s.w('केस');
    T2(s, ['NOT', 'A MYTH'], 0.05, 0.5);
    s.folder({ at: 0.05, x: 160, y: 700, w: 760, h: 480, rot: 3, kicker: 'CASE FILE · No. 04', title: 'DENGUE' });
    s.stamp('NOT A MYTH', { at: tSci - 0.05, x: 560, y: 1050, rot: -9, size: 104 });
    s.nameTag('DENGUE VIRUS', '4 TYPES · DENV-1 TO DENV-4', { at: tCase - 0.45, x: 120, y: 1260 });
    for (let k = 1; k <= 4; k++) {
      const at = tCase - 0.3 + k * 0.08;
      s.custom({ at, layer: 'ui', z: 46 }, (ctx, t) => drawDengueVirus(ctx, 520 + k * 90, 1300, 34 * ease.outBack(prog(t, at, 0.3)), t, { type: k }));
      s.sfx(at, 'pop', 0.3, { v: k });
    }
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== MEET THE CULPRIT
  S('S03', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tAedes = s.w('एडीज़'), tStripes = s.w('काली-सफ़ेद'), tBite = s.w('काटती'), tFemale = s.w('मादा');
    T2(s, ['THE', 'CULPRIT'], 0.1, 0.55);
    const m = s.sprite('aedes_mosquito', { at: 0.12, x: 560, y: 960, w: 940, shadow: { ground: 0, drop: 0.3 }, enter: { from: 'right', dur: 0.55, dist: 900, sfx: 'whoosh' }, bob: { amp: 5, freq: 0.6, rot: 0.5 } });
    s.sfx(0.15, 'buzz', 0.8);
    s.nameTag('AEDES AEGYPTI', null, { at: tAedes - 0.05, x: 110, y: 1296 });
    leader(s, 'BLACK + WHITE STRIPES', { at: tStripes, x: 560, y: 1338, to: (t) => P(m, t, G.aedes_mosquito.abdomen), size: 22 });
    leader(s, 'ONLY FEMALES BITE', { at: tBite - 0.1, x: 110, y: 1430, to: (t) => P(m, t, G.aedes_mosquito.proboscis), size: 30, color: COLORS.redInk, lineColor: 'rgba(184,58,38,0.9)' });
    s.custom({ at: tFemale, layer: 'ui', z: 45 }, (ctx, t) => markerEllipse(ctx, 290, 1419, 215, 36, prog(t, tFemale, 0.4, ease.inOutQuad), { width: 5, seed: 7, color: COLORS.red }));
    s.sfx(tFemale, 'pen', 0.5);
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 540, 1000]]);
  });

  S('S04', { look: 'paper' }, (s) => {
    const tMorning = s.w('सुबह'), tEvening = s.w('शाम'), tDay = s.w('दिन');
    T2(s, ['IT BITES', 'IN DAYLIGHT'], 0.05, 0.5);
    const hourAt = (t) => lerp(5.5, 19.5, ease.inOutQuad(prog(t, 0.2, s.dur - 0.35)));
    s.custom({ at: 0.05, z: 10 }, (ctx, t) => {
      const p = ease.outBack(prog(t, 0.05, 0.4));
      ctx.save(); ctx.translate(540, 1030); ctx.scale(p, p); ctx.translate(-540, -1030);
      drawDayClock(ctx, 540, 1030, 290, t, { hour: hourAt(t), peaks: [[6, 9, prog(t, tMorning, 0.5)], [16, 19, prog(t, tEvening, 0.5)]] });
      ctx.restore();
    });
    for (let k = 0; k < 13; k++) s.sfx(0.3 + k * 0.25, 'clock', 0.4, { v: k });
    s.sfx(tMorning, 'pen', 0.5); s.sfx(tEvening, 'pen', 0.5);
    s.torn({ text: 'DAYTIME BITER', red: true }, { at: tDay, x: 300, y: 1380, size: 52, rot: -3 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1010]]);
  });

  S('S05', { look: 'paper' }, (s) => {
    const tAvg = s.w('औसतन'), tMeter = s.w('मीटर'), tFly = s.w('उड़ता'), tBit = s.w('काटा'), tHome = s.w('घर'), tBorn = s.w('पैदा');
    T2(s, ['BORN', 'NEAR YOU'], 0.05, 0.5);
    const C = [540, 1010], RR = 330;
    s.custom({ at: 0.05, z: 8 }, (ctx, t) => {
      // the dashed 100 m circle and its radius
      const p = prog(t, tAvg, 1.1, ease.inOutQuad), pts = [];
      for (let k = 0; k <= 96; k++) { const a = -Math.PI / 2 + (k / 96) * TAU; pts.push([C[0] + Math.cos(a) * RR, C[1] + Math.sin(a) * RR]); }
      ctx.save(); ctx.fillStyle = `rgba(200,68,44,${0.07 * p})`; ctx.beginPath(); ctx.arc(C[0], C[1], RR, 0, TAU); ctx.fill(); ctx.restore();
      strokePartial(ctx, pts, p, 6, COLORS.red, { dash: [18, 12] });
      const q = prog(t, tMeter - 0.1, 0.4, ease.outQuad), ang = -0.35, ex = C[0] + Math.cos(ang) * RR * q, ey = C[1] + Math.sin(ang) * RR * q;
      if (q > 0) { strokePartial(ctx, [[C[0], C[1]], [ex, ey]], 1, 4, COLORS.redInk); if (q >= 1) arrowHead(ctx, ex, ey, ang, 22, COLORS.redInk); }
      const hp = ease.outBack(prog(t, 0.1, 0.4));
      drawHouse(ctx, C[0], C[1] + 10, 130 * hp);
    });
    s.sfx(tAvg, 'pen', 0.6);
    s.type('~106 M', { at: tMeter, x: 690, y: 878, size: 40, spacing: 3, cps: 16, color: COLORS.redInk, gain: 0.35 });
    s.type('AVERAGE FLIGHT: ~106 M', { at: tFly, x: 540, y: 1420, size: 32, spacing: 3, cps: 30, align: 'center', gain: 0.35, soundEvery: 2 });
    // the mosquito never strays far: it loops inside the circle
    const mPath = (t) => [C[0] - 150 + Math.sin(t * 1.3) * 120 + Math.sin(t * 2.7) * 40, C[1] - 120 + Math.cos(t * 1.1) * 110];
    const keys = []; for (let t = 0.2; t <= s.dur + 0.05; t += 0.1) { const [x, y] = mPath(t); keys.push([t, x, y]); }
    s.sprite('aedes_mosquito', { at: 0.25, w: 170, path: keys, shadow: { ground: 0, drop: 0.2 }, enter: { from: 'scale', s0: 0.5, dur: 0.3 } });
    s.sfx(0.3, 'buzz', 0.6, { v: 1 }); s.sfx(tBit - 0.5, 'buzz', 0.5, { v: 2 });
    s.sfx(tBit, 'slap', 0.9); s.shake(tBit, 0.15, 6);
    // born here: a pot of standing water right next to the house
    const pot = s.sprite('flower_pot', { at: tHome - 0.05, x: 760, y: 1150, w: 130, shadow: { ground: 0.2, drop: 0.2 }, enter: { from: 'scale', s0: 0.6, dur: 0.3, sfx: 'pop' } });
    s.custom({ at: tBorn, layer: 'ui', z: 45 }, (ctx, t) => markerEllipse(ctx, 760, 1150, 95, 85, prog(t, tBorn, 0.4, ease.inOutQuad), { width: 6, seed: 4 }));
    s.type('BORN HERE', { at: tBorn + 0.1, x: 760, y: 1280, size: 26, spacing: 3, cps: 30, align: 'center', color: COLORS.redInk, gain: 0.3 });
    s.sfx(tBorn, 'pen', 0.55);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1010]]);
  });

  S('S06', { look: 'paper' }, (s) => {
    const tClean = s.w('साफ़'), tCooler = s.w('कूलर'), tPot = s.w('गमले'), tTyre = s.w('टायर'), tBottle = s.w('बोतल');
    T2(s, ['ITS', 'NURSERY'], 0.05, 0.5);
    s.type('CLEAN STANDING WATER', { at: tClean, x: 112, y: 600, size: 30, spacing: 4, cps: 28, color: COLORS.redInk, gain: 0.35, soundEvery: 2 });
    const items = [
      ['air_cooler', 300, 900, { h: 400 }, 0.2, tCooler],
      ['flower_pot', 790, 880, { h: 330 }, tPot - 0.15, tPot],
      ['old_tyre', 300, 1290, { w: 380 }, tTyre - 0.15, tTyre],
      ['water_bottle', 790, 1270, { h: 400 }, tBottle - 0.15, tBottle],
    ];
    const sp = {};
    for (const [name, x, y, size, at] of items) {
      sp[name] = s.sprite(name, { at, x, y, ...size, shadow: { ground: 0.22, drop: 0.2 }, enter: { from: 'scale', s0: 0.6, dur: 0.3, sfx: 'pop' } });
    }
    // red tick-circles as each one is named
    for (const [name, x, y, , , at] of items) {
      s.custom({ at, layer: 'ui', z: 44 }, (ctx, t) => checkMark(ctx, x + 150, y - 150, 60, prog(t, at, 0.25), COLORS.redInk, 8));
      s.sfx(at, 'pen', 0.45);
    }
    // the magnifier visits the water in each
    const spot = (name, t) => P(sp[name], t, G[name].water);
    s.magnifier({ at: 0.55, r: 98, from: [-200, 1000], path: [
      [0.55, -200, 1000], [1.05, ...spot('air_cooler', 1.1)], [tPot, ...spot('air_cooler', 1.1)], [tPot + 0.3, ...spot('flower_pot', tPot + 0.4), ease.inOutCubic],
      [tTyre, ...spot('flower_pot', tPot + 0.4)], [tTyre + 0.3, ...spot('old_tyre', tTyre + 0.4), ease.inOutCubic],
      [tBottle, ...spot('old_tyre', tTyre + 0.4)], [tBottle + 0.3, ...spot('water_bottle', tBottle + 0.4), ease.inOutCubic]], drawLens: lensWater });
    s.sfx(1.05, 'drip', 0.6); s.sfx(tPot + 0.3, 'drip', 0.5, { v: 1 }); s.sfx(tTyre + 0.3, 'drip', 0.5, { v: 2 }); s.sfx(tBottle + 0.3, 'drip', 0.5, { v: 3 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1000]]);
  });

  S('S07', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const tEggs = s.w('अंडे'), tWithout = s.w('बिना'), tYear = s.w('साल'), tMore = s.w('ज़्यादा'), tAlive = s.w('ज़िंदा'), tWater = s.w('पानी', 1), tGot = s.w('मिला'), tMosq = s.w('मच्छर');
    T2(s, ['EGGS SURVIVE', 'A YEAR DRY'], 0.05, 0.5);
    s.type('CONTAINER WALL · CLOSE-UP', { at: 0.3, x: 112, y: 600, size: 22, spacing: 4, cps: 34, color: CREAM, gain: 0.25, soundEvery: 3 });
    const WL = (t) => t < tWithout + 0.1 ? 1140 : t < tWater ? lerp(1140, 1440, ease.inOutCubic(prog(t, tWithout + 0.1, 0.9))) : lerp(1440, 985, ease.outCubic(prog(t, tWater, 0.75)));
    const r = rng(17), eggs = [];
    for (let i = 0; i < 18; i++) {
      const x = 140 + i * 44 + (r() - 0.5) * 18, y = 1090 + (r() - 0.5) * 40;
      eggs.push({ x, y, rot: (r() - 0.5) * 0.6, h: tGot + 0.05 + r() * 0.55, tx: 160 + r() * 760, ty: 1120 + r() * 300, ph: r() * 6 });
    }
    s.custom({ at: 0, z: 10 }, (ctx, t, sc) => {
      // the wall (a plastic drum seen from inside), its ribs and the water against it
      ctx.save(); ctx.globalAlpha *= prog(t, 0, 0.4);
      ctx.fillStyle = 'rgba(200,205,195,0.06)'; ctx.fillRect(60, 640, 960, 860);
      ctx.strokeStyle = 'rgba(225,228,218,0.10)'; ctx.lineWidth = 3;
      for (let y = 700; y < 1500; y += 70) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(1020, y + 6); ctx.stroke(); }
      const wl = WL(t);
      const g = ctx.createLinearGradient(0, wl, 0, 1500);
      g.addColorStop(0, 'rgba(120,195,255,0.26)'); g.addColorStop(1, 'rgba(80,150,220,0.12)');
      ctx.fillStyle = g; ctx.fillRect(60, wl, 960, 1500 - wl);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(170,225,255,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); for (let x = 60; x <= 1020; x += 12) { const y = wl + Math.sin(x * 0.03 + t * 3) * 3; x === 60 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.restore();
      ctx.restore();
      // eggs stuck just above the old waterline; they hatch when the water comes back
      for (const e of eggs) {
        const hp = prog(t, e.h, 0.3);
        drawEgg(ctx, e.x, e.y, 46, e.rot, { look: sc.look, hatch: hp, alpha: prog(t, 0.2, 0.4) * (1 - 0.5 * prog(t, e.h + 1.2, 0.5)) });
        if (hp > 0) {
          const q = ease.inOutQuad(prog(t, e.h + 0.15, 1.3));
          drawLarva(ctx, lerp(e.x, e.tx, q), lerp(e.y, e.ty, q), 74 * clamp(0.4 + q), t, { look: sc.look, ang: Math.PI / 2 + 0.6 * Math.sin(t + e.ph), phase: e.ph, alpha: prog(t, e.h + 0.1, 0.2) });
        }
      }
    });
    leader(s, 'EGGS', { at: tEggs + 0.1, until: tYear, x: 112, y: 960, to: [eggs[1].x, eggs[1].y - 12], size: 26, color: CREAM });
    s.sfx(tWithout + 0.1, 'drip', 0.5); s.sfx(tWithout + 0.5, 'drip', 0.4, { v: 2 });
    // a year goes by on the calendar while they stay dry
    s.custom({ at: tYear - 0.25, layer: 'ui', z: 44 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tYear - 0.25, 0.3)), m = 12 * prog(t, tYear, Math.max(0.8, tAlive - tYear + 0.1));
      ctx.save(); ctx.globalAlpha *= 1 - prog(t, tWater, 0.35); ctx.translate(800, 820); ctx.scale(p, p); drawCalendar(ctx, 0, 0, 250, 220, m, { label: 'STILL DRY' }); ctx.restore();
    });
    const nflip = 12, fd = Math.max(0.8, tAlive - tYear + 0.1) / nflip;
    for (let k = 1; k <= nflip; k++) s.sfx(tYear + k * fd - 0.05, 'flip', 0.35, { v: k });
    s.type('1 YEAR+', { at: tMore, until: tWater + 0.2, x: 800, y: 1000, size: 40, spacing: 4, cps: 20, align: 'center', color: 'rgba(255,190,120,0.98)', gain: 0.35 });
    s.sfx(tWater, 'splash', 0.7);
    eggs.forEach((e, i) => { if (i % 3 === 0) s.sfx(e.h, 'pop', 0.35, { v: i }); });
    // ...and a new mosquito rises out of the water
    s.sprite('aedes_mosquito', { at: tMosq - 0.35, xray: true, w: 300, path: [[tMosq - 0.35, 470, 1010], [tMosq + 0.5, 760, 700, ease.outCubic]], scaleKeys: [[tMosq - 0.35, 0.3], [tMosq + 0.5, 1, ease.outCubic]] });
    s.sfx(tMosq - 0.3, 'buzz', 0.7, { v: 3 });
    heartbeats(s, 0.3, s.dur, 0.9, 0.3);
    s.camera([[0, 1.0, 540, 1050], [s.dur, 1.04, 540, 1060]]);
  });

  // =========================================================== THE DISEASE
  S('S08', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tFour = s.w('चार'), tTen = s.w('दस'), tAfter = s.w('बाद'), tFever = s.w('बुखार'), tHead = s.w('सिरदर्द'), tEyes = s.w('आँखों'), tBody = s.w('बदन'), tBreak = s.w('हड्डी-तोड़');
    T2(s, ['BREAKBONE', 'FEVER'], 0.1, 0.55);
    s.dayCounter({ at: 0.15, x: 245, y: 760, from: 1, to: 4, countAt: tFour - 0.25, countDur: 0.4 });
    s.arrow({ at: tTen - 0.15, pts: [[385, 760], [480, 760]], dur: 0.2, width: 6, head: 24 });
    s.dayCounter({ at: tTen - 0.1, x: 620, y: 760, from: 4, to: 10, countAt: tTen, countDur: 0.45, rot: -2 });
    s.type('AFTER THE BITE', { at: tAfter, x: 122, y: 912, size: 28, spacing: 4, cps: 30, gain: 0.35, soundEvery: 2 });
    s.thermometer({ at: tFever - 0.4, x: 800, y: 660, h: 540, min: 30, max: 44, from: 37, to: 40, riseAt: tFever, riseDur: 1.0, rot: 3 });
    s.type('40°C', { at: tFever + 1.0, x: 885, y: 1250, size: 34, spacing: 2, cps: 20, align: 'center', color: COLORS.redInk, gain: 0.3 });
    s.dropCards({ items: [
      { text: 'HIGH FEVER', at: tFever, x: 330, y: 1030, w: 500, h: 100, size: 50, rot: -1.5 },
      { text: 'HEADACHE', at: tHead, x: 330, y: 1145, w: 500, h: 100, size: 50, rot: 1 },
      { text: 'PAIN BEHIND THE EYES', at: tEyes, x: 330, y: 1260, w: 500, h: 100, size: 42, rot: -1 },
      { text: 'BODY PAIN', at: tBody, x: 330, y: 1375, w: 500, h: 100, size: 50, rot: 1.5 },
    ] });
    s.stamp('BREAKBONE FEVER', { at: tBreak - 0.05, x: 740, y: 1360, rot: -9, size: 44 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1010]]);
  });

  // =========================================================== THE TWIST
  S('S10', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tMost = s.w('सबसे'), tOdd = s.w('अजीब');
    s.kicker('NOW', { at: 0.12 });
    T2(s, ['THE STRANGEST', 'PART'], tMost - 0.1, tMost + 0.35);
    s.custom({ at: tOdd - 0.1, layer: 'ui', z: 45 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tOdd - 0.1, 0.35));
      ctx.save(); ctx.translate(540, 1080); ctx.scale(p, p); ctx.rotate(0.08); bigText(ctx, '?', 0, 170, 420, COLORS.red); ctx.restore();
    });
    s.sfx(tOdd - 0.1, 'pop', 0.7);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.05, 540, 1000]]);
  });

  S('S11', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const tFour = s.w('चार'), tOnce = s.w('एक'), tLife = s.w('ज़िंदगी'), tSafe = s.w('बचा'), tRest = s.w('बाकी'), tNot = s.w('नहीं');
    T2(s, ['4 TYPES', '4 ENEMIES'], tFour - 0.05, tFour + 0.4);
    const xs = [165, 395, 625, 855], VY = 860;
    xs.forEach((x, i) => {
      const k = i + 1, at = 0.25 + i * 0.16;
      s.custom({ at, z: 20 }, (ctx, t, sc) => {
        const inf = k === 1 ? prog(t, tOnce, 0.3) : 0;
        if (inf > 0) { ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.9 * inf})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, VY, 86 + 6 * Math.sin(t * 6), 0, TAU); ctx.stroke(); ctx.restore(); }
        drawDengueVirus(ctx, x, VY + Math.sin(t * 1.4 + i) * 6, 62 * ease.outBack(prog(t, at, 0.35)), t, { type: k, look: sc.look });
      });
      s.sfx(at, 'pop', 0.35, { v: i });
      const c = DENV[k].glow;
      s.type(`DENV-${k}`, { at: at + 0.15, x, y: 980, size: 26, spacing: 3, cps: 30, align: 'center', color: `rgba(${c[0]},${c[1]},${c[2]},0.98)`, gain: 0.25, soundEvery: 3 });
      // the shields: type 1 for life, the others only briefly
      s.custom({ at: k === 1 ? tLife : tSafe, z: 18 }, (ctx, t, sc) => {
        const st = k === 1 ? ease.outBack(prog(t, tLife, 0.4)) : 0.55 * prog(t, tSafe, 0.3) * (1 - prog(t, tRest + 0.25 + i * 0.15, 0.6));
        const cr = k === 1 ? 0 : prog(t, tRest + i * 0.15, 0.4);
        drawShield(ctx, x, 1170, k === 1 ? 150 : 120, { look: sc.look, glow: c, strength: st, crack: cr });
      });
    });
    s.type('INFECTED ONCE', { at: tOnce + 0.1, x: 112, y: 690, size: 24, spacing: 4, cps: 30, color: 'rgba(255,150,110,0.98)', gain: 0.3 });
    s.sfx(tLife, 'inflate', 0.5);
    s.type('FOR LIFE', { at: tLife + 0.3, x: 165, y: 1300, size: 26, spacing: 2, cps: 34, align: 'center', color: 'rgba(255,200,120,0.98)', gain: 0.3, soundEvery: 2 });
    for (let i = 1; i < 4; i++) s.sfx(tRest + i * 0.15, 'crack', 0.35, { v: i });
    s.type('NO LASTING PROTECTION', { at: tNot - 0.1, x: 625, y: 1300, size: 22, spacing: 2, cps: 34, align: 'center', color: 'rgba(255,120,90,0.98)', gain: 0.3, soundEvery: 2 });
    heartbeats(s, 0.3, s.dur, 1.0, 0.3);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1010]]);
  });

  S('S12', { look: 'xray' }, (s) => {
    const tNew = s.w('नया'), tOld = s.w('पुरानी'), tGrab = s.w('पकड़ती'), tKill = s.w('मार'), tRev = s.w('उल्टा'), tInto = s.w('पहुँचा'), tGrow = s.w('बढ़ता');
    T2(s, ['THE GUARD', 'OPENS THE DOOR'], 0.05, 0.5);
    s.type('ANTIBODY-DEPENDENT ENHANCEMENT', { at: tInto - 0.2, x: 112, y: 600, size: 22, spacing: 3, cps: 36, color: CREAM, gain: 0.25, soundEvery: 3 });
    s.bloodStream({ at: 0, y: 1110, hh: 430, n: 34, r: 30, speed: 50, dir: -1, alpha: 0.75 });
    const drift = (t) => { const q = ease.outCubic(prog(t, tNew - 0.2, 0.9)); return [lerp(-100, 270, q) + Math.sin(t * 1.2) * 10, 1000 + Math.sin(t * 1.6) * 12]; };
    const A = ade(s, { at: tNew - 0.2, cell: [740, 1220], cellR: 200, type: 2, abType: 1, drift, tBind: tOld - 0.05, tMove: tRev - 0.1, moveDur: 0.75, copies: 12, infDur: 1.4,
      from: [[150, 640], [-80, 1300], [480, 760]] });
    leader(s, 'NEW TYPE 2', { at: tNew + 0.3, until: tRev, x: 112, y: 820, to: (t) => { const [x, y] = A.V(t); return [x - 30, y - 45]; }, size: 26, color: 'rgba(130,205,255,0.98)', lineColor: 'rgba(130,205,255,0.8)' });
    leader(s, 'OLD TYPE-1 ANTIBODIES', { at: tGrab, until: tRev, x: 112, y: 1400, to: (t) => { const [x, y] = A.V(t); return [x - 20, y + 95]; }, size: 24, color: 'rgba(255,196,110,0.98)', lineColor: 'rgba(255,196,110,0.8)' });
    s.torn({ text: "CAN'T KILL IT", red: true }, { at: tKill - 0.05, until: tRev + 0.2, x: 470, y: 820, size: 46, rot: 4 });
    s.sfx(tKill - 0.05, 'beep', 0.45);
    s.type('IT MULTIPLIES', { at: tGrow - 0.2, x: 740, y: 1462, size: 26, spacing: 4, cps: 30, align: 'center', color: 'rgba(255,130,100,0.98)', gain: 0.3 });
    heartbeats(s, 0.2, s.dur, 1.0, 0.4);
    s.camera([[0, 1.0, 540, 1040], [tRev, 1.02, 560, 1080], [s.dur, 1.08, 660, 1160, ease.inOutQuad]]);
  });

  S('S13', { look: 'paper' }, (s) => {
    const tSecond = s.w('दूसरी'), tSevere = s.w('गंभीर'), tMore = s.w('ज़्यादा');
    T2(s, ['HIGHER', 'RISK'], 0.05, 0.5);
    s.type('2ND INFECTION, DIFFERENT TYPE', { at: tSecond, x: 540, y: 760, size: 32, spacing: 3, cps: 34, align: 'center', gain: 0.35, soundEvery: 2 });
    s.custom({ at: tSecond + 0.2, z: 10 }, (ctx, t) => {
      for (const [k, x] of [[1, 380], [2, 700]]) drawDengueVirus(ctx, x, 880, 46 * ease.outBack(prog(t, tSecond + 0.2 + (k - 1) * 0.25, 0.3)), t, { type: k });
      strokePartial(ctx, [[450, 880], [630, 880]], prog(t, tSecond + 0.5, 0.3), 5, COLORS.red, { dash: [14, 10] });
      if (prog(t, tSecond + 0.5, 0.3) >= 1) arrowHead(ctx, 640, 880, 0, 24, COLORS.red);
    });
    s.stamp('SEVERE DENGUE\nRISK', { at: tSevere - 0.05, x: 470, y: 1150, rot: -7, size: 78 });
    s.custom({ at: tMore - 0.1, layer: 'ui', z: 50 }, (ctx, t) => {
      const p = prog(t, tMore - 0.1, 0.35, ease.outCubic);
      strokePartial(ctx, [[860, 1290], [860, 1060]], p, 22, COLORS.red);
      if (p >= 1) arrowHead(ctx, 860, 1035, -Math.PI / 2, 70, COLORS.red);
    });
    s.sfx(tMore - 0.1, 'whoosh', 0.5);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1010]]);
  });

  // =========================================================== THE DANGER WINDOW
  S('S14', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tDown = s.w('उतरने'), tFine = s.w('ठीक'), tReal = s.w('असली'), t24 = s.w('चौबीस');
    T2(s, ['WHEN THE FEVER', 'GOES DOWN'], 0.05, 0.5);
    s.thermometer({ at: 0.1, x: 140, y: 650, h: 440, min: 30, max: 44, from: 40, to: 37, riseAt: tDown, riseDur: 1.2, rot: -2 });
    s.custom({ at: tFine - 0.1, layer: 'ui', z: 44 }, (ctx, t) => drawSmiley(ctx, 640, 840, 95, prog(t, tFine - 0.1, 0.35)));
    s.sfx(tFine - 0.1, 'pop', 0.5);
    s.type('FEELS FINE...?', { at: tFine + 0.25, x: 640, y: 1000, size: 34, spacing: 3, cps: 26, align: 'center', gain: 0.35 });
    // the alarm card
    s.custom({ at: tReal - 0.1, layer: 'ui', z: 46 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tReal - 0.1, 0.35)), blink = 0.5 + 0.5 * Math.sin((t - tReal) * 10);
      const x = 110, y = 1110, w = 860, h = 250;
      ctx.save(); ctx.translate(540, y + h / 2); ctx.scale(p, p); ctx.translate(-540, -(y + h / 2));
      const c = card(w, h, { color: '#f1e6cf', seed: 71 }); ctx.drawImage(c.canvas, x - c.pad, y - c.pad);
      ctx.strokeStyle = `rgba(200,52,32,${0.55 + 0.45 * blink})`; ctx.lineWidth = 12; ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      // warning triangle
      ctx.fillStyle = COLORS.red; ctx.beginPath(); ctx.moveTo(x + 110, y + 50); ctx.lineTo(x + 180, y + 180); ctx.lineTo(x + 40, y + 180); ctx.closePath(); ctx.fill();
      bigText(ctx, '!', x + 110, y + 168, 92, '#f4e9d4');
      const i1 = inkText('WATCH THE NEXT', FONTS.title, 56, COLORS.ink); ctx.drawImage(i1.canvas, x + 220 - i1.pad, y + 100 - i1.base);
      if (t >= t24 - 0.05) { const q = ease.outBack(prog(t, t24 - 0.05, 0.3)), i2 = inkText('24–48 HOURS', FONTS.title, 96, COLORS.red); ctx.save(); ctx.translate(x + 220, y + 205); ctx.scale(q, q); ctx.drawImage(i2.canvas, -i2.pad, -i2.base); ctx.restore(); }
      ctx.restore();
    });
    s.sfx(tReal - 0.1, 'alarm', 0.8); s.sfx(tReal + 0.6, 'alarm', 0.6, { v: 1 }); s.sfx(t24 - 0.05, 'stamp', 0.5);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1010]]);
  });

  S('S15', { look: 'paper' }, (s) => {
    const w = (k, n = 0) => s.w(k, n);
    const tStomach = w('पेट'), tPain = w('दर्द'), tAgain = w('बार-बार'), tVomit = w('उल्टी'), tGums = w('मसूड़ों'), tBlood = w('ख़ून'), tVery = w('बहुत'), tRest = w('बेचैनी'), tNow = w('तुरंत'), tHosp = w('अस्पताल');
    T2(s, ['GO TO', 'HOSPITAL'], 0.05, 0.5);
    s.checklist({ at: 0.1, x: 110, y: 640, w: 860, header: 'WARNING SIGNS', size: 44, rot: -1, items: [
      { text: 'SEVERE STOMACH PAIN', at: tStomach + 0.05, mark: 'check', markAt: tPain, markColor: COLORS.redInk },
      { text: 'VOMITING AGAIN AND AGAIN', at: tAgain - 0.1, mark: 'check', markAt: tVomit + 0.1, markColor: COLORS.redInk },
      { text: 'BLEEDING GUMS OR NOSE', at: tGums - 0.1, mark: 'check', markAt: tBlood, markColor: COLORS.redInk },
      { text: 'VERY TIRED OR RESTLESS', at: tVery - 0.1, mark: 'check', markAt: tRest, markColor: COLORS.redInk },
    ] });
    for (const at of [tPain, tVomit + 0.1, tBlood, tRest]) s.sfx(at + 0.05, 'alarm', 0.35);
    s.custom({ at: tNow - 0.1, layer: 'ui', z: 46 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tNow - 0.1, 0.3));
      ctx.save(); ctx.translate(540, 1330); ctx.scale(p, p); const tw = bigText(ctx, 'HOSPITAL NOW', 0, 40, 104, COLORS.red); ctx.restore();
      markerEllipse(ctx, 540, 1325, 340, 92, prog(t, tHosp - 0.15, 0.45, ease.inOutQuad), { width: 7, seed: 9, color: COLORS.redInk });
    });
    s.sfx(tNow - 0.1, 'stamp', 0.6); s.sfx(tHosp - 0.15, 'pen', 0.7);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1010]]);
  });

  // =========================================================== INDIA NOW + SAFETY
  S('S16', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tSix = s.w('छह'), t24 = s.w('चौबीस'), tSeason = s.w('सीज़न'), tMonsoon = s.w('मानसून'), tAfter = s.w('बाद'), tNow = s.w('अभी');
    T2(s, ['RIGHT NOW', 'IN INDIA'], 0.05, 0.5);
    s.caseFile({ at: 0.05, x: 130, y: 640, w: 820, h: 470, tab: 'CASE FILE · INDIA', lines: [
      { label: 'COUNTRY', value: 'INDIA', at: 0.2, size: 44 },
      { label: 'PERIOD', value: 'JAN–JUN 2026', at: tSix - 0.1, size: 44 },
      { label: 'DENGUE CASES', value: '23,952', at: t24 - 0.1, size: 62, red: true },
    ] });
    s.type('SOURCE: NATIONAL DATA', { at: t24 + 0.6, x: 150, y: 1160, size: 18, spacing: 3, cps: 40, gain: 0.2, soundEvery: 4 });
    const MON = 'JFMAMJJASOND', X0 = 120, CW = 66, Y = 1270;
    s.custom({ at: tSeason - 0.3, layer: 'ui', z: 40 }, (ctx, t) => {
      const a = prog(t, tSeason - 0.3, 0.3);
      ctx.save(); ctx.globalAlpha *= a;
      const pm = prog(t, tMonsoon - 0.1, 0.4), pk = prog(t, tAfter - 0.1, 0.4);
      ctx.fillStyle = 'rgba(79,111,143,0.35)'; ctx.fillRect(X0 + 5 * CW, Y, 4 * CW * pm, 60);
      ctx.fillStyle = 'rgba(200,68,44,0.45)'; ctx.fillRect(X0 + 9 * CW, Y, 2 * CW * pk, 60);
      ctx.strokeStyle = 'rgba(46,28,12,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) ctx.strokeRect(X0 + i * CW, Y, CW, 60);
      setFont(ctx, FONTS.title, 38); ctx.textAlign = 'center'; ctx.fillStyle = COLORS.ink;
      for (let i = 0; i < 12; i++) ctx.fillText(MON[i], X0 + i * CW + CW / 2, Y + 45);
      setFont(ctx, FONTS.type, 18); ctx.letterSpacing = '3px'; ctx.fillStyle = `rgba(46,70,100,${pm})`;
      ctx.fillText('MONSOON', X0 + 7 * CW, Y - 12); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
      ctx.restore();
    });
    s.type('PEAK SEASON: AFTER THE MONSOON', { at: tAfter - 0.1, x: 120, y: 1400, size: 28, spacing: 2, cps: 36, color: COLORS.redInk, gain: 0.3, soundEvery: 2 });
    s.custom({ at: tNow - 0.15, layer: 'ui', z: 46 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tNow - 0.15, 0.3)), x = X0 + 9 * CW + CW / 2;
      ctx.save(); ctx.translate(x, Y - 10); ctx.scale(p, p);
      strokePartial(ctx, [[0, -70], [0, -12]], 1, 6, COLORS.red); arrowHead(ctx, 0, -6, Math.PI / 2, 24, COLORS.red);
      bigText(ctx, 'NOW', 0, -80, 46, COLORS.red);
      ctx.restore();
    });
    s.sfx(tNow - 0.15, 'stamp', 0.5);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1010]]);
  });

  S('S17', { look: 'paper' }, (s) => {
    const tIbu = s.w('आइबुप्रोफ़ेन'), tAsp = s.w('एस्पिरिन'), tBlood = s.w('ख़ून'), tPara = s.w('पैरासिटामोल'), tDoc = s.w('डॉक्टर');
    T2(s, ['WHICH', 'MEDICINE?'], 0.05, 0.5);
    s.type('NO PAINKILLERS ON YOUR OWN', { at: 0.6, x: 112, y: 600, size: 24, spacing: 2, cps: 40, color: COLORS.redInk, gain: 0.3, soundEvery: 3 });
    const rows = [
      { name: 'IBUPROFEN', pill: 'oval', at: tIbu - 0.1, ok: false, sub: 'CAN RAISE BLEEDING RISK', subAt: tBlood, y: 660 },
      { name: 'ASPIRIN', pill: 'small', at: tAsp - 0.1, ok: false, sub: 'CAN RAISE BLEEDING RISK', subAt: tBlood + 0.2, y: 870 },
      { name: 'PARACETAMOL', pill: 'round', at: tPara - 0.1, ok: true, sub: 'FOR FEVER AND PAIN', subAt: tPara + 0.5, y: 1080 },
    ];
    for (const r0 of rows) {
      s.custom({ at: r0.at, layer: 'ui', z: 40 }, (ctx, t) => {
        const p = prog(t, r0.at, 0.35, ease.outCubic), x = 110, w = 860, h = 180;
        ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 60);
        const c = card(w, h, { color: r0.ok ? '#ece6cf' : '#efe2cc', seed: r0.y }); ctx.drawImage(c.canvas, x - c.pad, r0.y - c.pad);
        drawPill(ctx, x + 95, r0.y + 90, 96, r0.pill, -0.3);
        const ink = inkText(r0.name, FONTS.title, 62, COLORS.ink); ctx.drawImage(ink.canvas, x + 190 - ink.pad, r0.y + 92 - ink.base);
        if (t >= r0.subAt) { setFont(ctx, FONTS.type, 24); ctx.letterSpacing = '2px'; ctx.fillStyle = r0.ok ? 'rgba(46,28,12,0.85)' : COLORS.redInk; ctx.fillText(r0.sub.slice(0, Math.floor((t - r0.subAt) * 34 + 1)), x + 192, r0.y + 140); ctx.letterSpacing = '0px'; }
        const mp = prog(t, r0.at + 0.35, 0.25);
        if (r0.ok) checkMark(ctx, x + 770, r0.y + 92, 90, mp, COLORS.ink, 10); else xMark(ctx, x + 770, r0.y + 90, 90, mp, COLORS.redInk, 10);
        ctx.restore();
      });
      s.sfx(r0.at, 'slide', 0.5); s.sfx(r0.at + 0.35, 'pen', 0.6);
    }
    s.stamp('SEE A DOCTOR', { at: tDoc - 0.05, x: 540, y: 1390, rot: -6, size: 84 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1010]]);
  });

  S('S18', { look: 'paper' }, (s) => {
    const tWeek = s.w('हफ़्ते'), tCooler = s.w('कूलर'), tPots = s.w('गमलों'), tPans = s.w('बर्तनों'), tEmpty = s.w('खाली'), tDo = s.w('करो'), tScrub = s.w('रगड़कर'), tOut = s.w('निकल'),
      tAMPM = s.w('सुबह-शाम'), tRep = s.w('रिपेलेंट');
    T2(s, ['STOP IT', 'AT HOME'], 0.05, 0.5);
    const X = 110, Y = 650, CWD = 860, CH = 660;
    const rows = [
      { main: 'EMPTY + SCRUB EVERY WEEK', sub: 'COOLERS, POTS, CONTAINERS', at: tWeek - 0.15, tick: tDo, y: Y + 110 },
      { main: 'FULL SLEEVES + REPELLENT', sub: 'MORNING & EVENING', at: tAMPM - 0.1, tick: tRep, y: Y + 420 },
      { main: 'COVER WATER TANKS', sub: '', at: tAMPM + 0.9, tick: Math.min(s.dur - 0.5, tRep + 0.45), y: Y + 545 },
    ];
    s.custom({ at: 0.15, layer: 'ui', z: 40 }, (ctx, t) => {
      const p = prog(t, 0.15, 0.35, ease.outCubic);
      ctx.save(); ctx.translate(0, (1 - p) * 500); ctx.rotate(-0.8 * Math.PI / 180);
      const c = card(CWD, CH, { seed: 12 }); ctx.drawImage(c.canvas, X - c.pad, Y - c.pad);
      setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '5px'; ctx.fillStyle = 'rgba(60,40,18,0.75)'; ctx.fillText('STOP THE NURSERY', X + 40, Y + 54); ctx.letterSpacing = '0px';
      for (const r0 of rows) {
        if (t < r0.at) continue;
        const a = prog(t, r0.at, 0.2);
        ctx.save(); ctx.globalAlpha *= a;
        ctx.strokeStyle = 'rgba(40,26,10,0.85)'; ctx.lineWidth = 4; ctx.strokeRect(X + 40, r0.y - 22, 44, 44);
        checkMark(ctx, X + 62, r0.y, 50, prog(t, r0.tick, 0.25), COLORS.ink, 7);
        const ink = inkText(r0.main, FONTS.title, 46, COLORS.ink); ctx.drawImage(ink.canvas, X + 110 - ink.pad, r0.y + 18 - ink.base);
        if (r0.sub) { setFont(ctx, FONTS.type, 24); ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(60,40,18,0.85)'; ctx.fillText(r0.sub.slice(0, Math.floor((t - r0.at - 0.3) * 36 + 1)), X + 112, r0.y + 60); ctx.letterSpacing = '0px'; }
        ctx.restore();
      }
      ctx.restore();
    });
    for (const r0 of rows) { s.sfx(r0.at, 'pop', 0.35); s.sfx(r0.tick, 'pen', 0.6); }
    // what to empty: cooler, pot, pan (container) thumbnails
    const thumbs = [['air_cooler', tCooler, 210], ['flower_pot', tPots, 350], ['water_bottle', tPans, 470]];
    for (const [name, at, x] of thumbs) s.sprite(name, { at: at - 0.05, layer: 'ui', z: 45, x, y: Y + 260, h: 150, shadow: { ground: 0.15, drop: 0.15 }, enter: { from: 'scale', s0: 0.5, dur: 0.25, sfx: 'pop' } });
    // a strip of container wall with eggs; a brush scrubs them off
    const strip = { x: 570, y: Y + 205, w: 360, h: 110 }, r = rng(5), eggs = [];
    for (let i = 0; i < 9; i++) eggs.push([strip.x + 30 + i * 36 + (r() - 0.5) * 10, strip.y + 50 + (r() - 0.5) * 30, (r() - 0.5) * 0.6]);
    const brushX = (t) => strip.x + 40 + (strip.w - 80) * (0.5 + 0.5 * Math.sin((t - tScrub) * 7 - Math.PI / 2)) * clamp((t - tScrub) / 0.2);
    s.custom({ at: tEmpty - 0.1, layer: 'ui', z: 46 }, (ctx, t) => {
      const a = prog(t, tEmpty - 0.1, 0.3);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = '#d9d2c0'; ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
      ctx.strokeStyle = 'rgba(46,28,12,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(strip.x, strip.y, strip.w, strip.h);
      const wl = strip.y + strip.h - 18 + 30 * prog(t, tEmpty, 0.6);
      ctx.fillStyle = 'rgba(120,170,190,0.45)'; ctx.fillRect(strip.x, Math.min(wl, strip.y + strip.h), strip.w, Math.max(0, strip.y + strip.h - wl));
      for (const [ex, ey, er] of eggs) {
        const gone = t > tScrub ? prog(t, tScrub + 0.25 + (ex - strip.x) / strip.w * (tOut - tScrub), 0.25) : 0;
        drawEgg(ctx, ex, ey, 30, er, { alpha: 1 - gone });
      }
      if (t >= tScrub) {
        const bx = brushX(t), by = strip.y + 30, fade = 1 - prog(t, tOut + 0.4, 0.3);
        ctx.globalAlpha *= fade;
        ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = 'rgba(40,24,10,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(bx - 50, by - 46, 100, 34, 10); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,170,110,0.95)'; ctx.lineWidth = 3;
        for (let k = -42; k <= 42; k += 7) { ctx.beginPath(); ctx.moveTo(bx + k, by - 12); ctx.lineTo(bx + k + Math.sin(t * 40 + k) * 2, by + 14); ctx.stroke(); }
      }
      ctx.restore();
    });
    s.type('WALLS TOO: EGGS STICK THERE', { at: tScrub + 0.2, x: 750, y: Y + 360, size: 18, spacing: 2, cps: 40, align: 'center', color: COLORS.redInk, gain: 0.2, soundEvery: 4, layer: 'ui' });
    for (let k = 0; k < 5; k++) s.sfx(tScrub + 0.1 + k * 0.42, 'scribble', 0.5, { v: k });
    s.sfx(tEmpty, 'drip', 0.5);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.02, 540, 1005]]);
  });

  // =========================================================== ENDING
  S('S20', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tMosq = s.w('मच्छर'), tFour = s.w('चार'), tReel = s.w('रील'), tCooler = s.w('कूलर');
    T2(s, ['ONE MOSQUITO', 'FOUR ENEMIES'], 0.05, 0.5);
    const FX = 220, FY = 660, FW = 640, FH = 330;
    s.custom({ at: 0.1, layer: 'ui', z: 30 }, (ctx, t, sc) => {
      const p = prog(t, 0.1, 0.4, ease.outCubic);
      ctx.save(); ctx.translate(0, (1 - p) * -400); ctx.globalAlpha *= clamp((t - 0.1) / 0.1);
      drawSpecimenFrame(ctx, FX, FY, FW, FH, { inside: (c, ix, iy, iw, ih) => {
        const A = sc.reel.assets.get('aedes_mosquito'), h = ih * 0.9, w = h * A.w / A.h;
        c.drawImage(A.img, ix + iw / 2 - w / 2, iy + ih / 2 - h / 2 - 6, w, h);
        setFont(c, FONTS.type, 16); c.letterSpacing = '3px'; c.fillStyle = 'rgba(46,28,12,0.85)'; c.fillText('AEDES AEGYPTI', ix + 14, iy + ih - 12); c.letterSpacing = '0px';
      } });
      if (t > 0.45) drawPin(ctx, FX + FW / 2 - 46, FY + FH / 2 - 52, 9);
      ctx.restore();
      markerEllipse(ctx, FX + FW / 2, FY + FH / 2, 290, 150, prog(t, tMosq - 0.05, 0.45, ease.inOutQuad), { width: 6, seed: 2, color: COLORS.redInk });
    });
    s.sfx(0.45, 'click', 0.5); s.sfx(tMosq - 0.05, 'pen', 0.6);
    // the route: BITE -> FEVER -> NEW TYPE -> DANGER
    const CX = 540, CY = 1240, RD = 170, nodes = [
      { label: 'BITE', ang: -3 * Math.PI / 4, side: -1 }, { label: 'FEVER', ang: -Math.PI / 4, side: 1 },
      { label: 'NEW TYPE', ang: Math.PI / 4, side: 1 }, { label: 'DANGER', ang: 3 * Math.PI / 4, side: -1 }];
    const step = 0.28;
    nodes.forEach((nd, i) => {
      const x = CX + Math.cos(nd.ang) * RD, y = CY + Math.sin(nd.ang) * RD, at = tFour - 0.15 + i * step;
      s.custom({ at, layer: 'ui', z: 36 }, (ctx, t, sc) => {
        const p = ease.outBack(prog(t, at, 0.3));
        ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha *= clamp((t - at) / 0.1);
        ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#f0e7d3'; ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(46,28,12,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.stroke();
        if (i === 0) { const A = sc.reel.assets.get('aedes_mosquito'), w = 116, h = w * A.h / A.w; ctx.drawImage(A.img, -w / 2, -h / 2, w, h); }
        if (i === 1) { ctx.fillStyle = '#cf4a30'; ctx.strokeStyle = 'rgba(46,28,12,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-9, -42, 18, 60, 9); ctx.fillStyle = '#f6f1e4'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#cf4a30'; ctx.fillRect(-4, -20, 8, 38); ctx.beginPath(); ctx.arc(0, 30, 15, 0, TAU); ctx.fill(); ctx.stroke(); }
        if (i === 2) drawDengueVirus(ctx, 0, 0, 38, t, { type: 2 });
        if (i === 3) { ctx.fillStyle = COLORS.red; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(42, 34); ctx.lineTo(-42, 34); ctx.closePath(); ctx.fill(); bigText(ctx, '!', 0, 26, 56, '#f4e9d4'); }
        ctx.restore();
      });
      s.sfx(at, 'pop', 0.4, { v: i });
      s.type(nd.label, { at: at + 0.1, x: x + nd.side * 84, y: y + 9, size: 24, spacing: 3, cps: 40, align: nd.side < 0 ? 'right' : 'left', gain: 0.25, soundEvery: 3, layer: 'ui' });
      if (i < nodes.length - 1) {
        const a0 = nd.ang + 0.45, a1 = nodes[i + 1].ang - 0.45, pts = [];
        for (let k = 0; k <= 12; k++) { const a = lerp(a0, a1, k / 12); pts.push([CX + Math.cos(a) * RD * 1.0, CY + Math.sin(a) * RD * 1.0]); }
        s.arrow({ at: at + step * 0.6, pts, dur: 0.25, width: 5, head: 20, gain: 0.25 });
      }
    });
    s.type('SAVE · SHARE', { at: tReel - 0.2, x: 112, y: 610, size: 30, spacing: 6, cps: 26, color: COLORS.redInk, gain: 0.35 });
    s.sprite('air_cooler', { at: tCooler - 0.15, layer: 'ui', z: 40, x: 170, y: 1418, h: 140, rot: -4, shadow: { ground: 0.15, drop: 0.2 }, enter: { from: 'scale', s0: 0.5, dur: 0.3, sfx: 'pop' } });
    s.type('COOLER AT HOME? SHARE THIS', { at: tCooler + 0.05, x: 250, y: 1448, size: 22, spacing: 2, cps: 40, color: COLORS.redInk, gain: 0.25, soundEvery: 3, layer: 'ui' });
    s.sfx(tCooler - 0.2, 'buzz', 0.4, { v: 5 });
    s.camera([[0, 1.0, 540, 1040], [s.dur, 1.03, 540, 1040]]);
  });
}
