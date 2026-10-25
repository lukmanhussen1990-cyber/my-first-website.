// WHY IS THERE NO CURE FOR CANCER? (FILE No. 03): scene choreography.
// Every time is scene-local seconds; s.w('word') = when that word starts in the voiceover.
import { strokePartial, wobblyPath, markerEllipse, xMark, checkMark, inkText, card, paperTexture, arrowHead, setFont } from '../../engine/js/draw.js';
import { glowDot } from '../../engine/js/components.js';
import { drawCell, drawVirus, drawDNA, drawBadge, drawBootprint, drawToolIcon } from '../../engine/js/cells.js';
import { FONTS } from '../../engine/js/assets.js';

export default function build(R, { U, W, H }) {
  const { ease, clamp, lerp, prog, rng, COLORS } = U;
  const G = R.geometry;
  let fig = 0;
  const S = (id, opts, fn) => R.scene(id, { fig: ++fig, ...opts }, fn);

  // ---- helpers --------------------------------------------------------------
  const P = (sp, t, pt) => sp.point(t, pt[0], pt[1]);
  const heartbeats = (s, from, to, rate = 1, gain = 0.5) => { for (let t = from; t < to - 0.2; t += 1 / rate) s.sfx(t, 'heartbeat', gain); };
  const T2 = (s, lines, t1, t2, o = {}) => s.title(lines, { at: [Math.max(0.05, t1), t2 ?? t1 + 0.45], ...o });
  const pageTurn = (s) => s.sfx(0, 'pageturn', 0.7);
  const CREAM = 'rgba(232,226,210,0.9)';
  // a cell actor; pos/alpha/R can be functions of t
  function cell(s, o) {
    return s.custom({ at: o.at ?? 0, until: o.until, z: o.z ?? 20, layer: o.layer || 'world' }, (ctx, t, sc) => {
      const p = prog(t, o.at ?? 0, o.inDur ?? 0.3, ease.outBack);
      const [x, y] = typeof o.pos === 'function' ? o.pos(t) : o.pos;
      const r = (typeof o.r === 'function' ? o.r(t) : o.r) * (o.pop === false ? 1 : p);
      const a = (typeof o.alpha === 'function' ? o.alpha(t) : (o.alpha ?? 1)) * clamp((t - (o.at ?? 0)) / 0.1);
      drawCell(ctx, x, y, Math.max(1, r), t, { type: o.type, look: sc.look, seed: o.seed ?? 1, alpha: a, sx: o.sx, sy: o.sy });
      if (o.after) o.after(ctx, t, x, y, r);
    });
  }
  // a typed label with a thin leader line to a (screen) point; the line leaves from the
  // side of the text that faces the target (or its top/bottom), so it never crosses the letters
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
      if (prog(t, o.at + 0.1, 0.35) >= 1) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill(); }
    });
  }
  // aged WANTED poster with a portrait drawn by fn(ctx, cx, cy, r, t)
  function poster(s, o) {
    s.custom({ at: o.at, until: o.until, layer: 'ui', z: o.z ?? 30 }, (ctx, t) => {
      const p = prog(t, o.at, 0.4, ease.outBack);
      const w = o.w ?? 480, h = o.h ?? 640;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(((o.rot ?? -2) + (1 - p) * 8) * Math.PI / 180); ctx.scale(lerp(0.8, 1, p), lerp(0.8, 1, p));
      ctx.globalAlpha *= clamp((t - o.at) / 0.1);
      const c = card(w, h, { color: '#e3cfa2', seed: 91 });
      ctx.drawImage(c.canvas, -w / 2 - c.pad, -h / 2 - c.pad);
      ctx.strokeStyle = 'rgba(70,45,20,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36);
      const ink = inkText('WANTED', FONTS.title, 104, COLORS.ink, { spacing: 4 });
      ctx.drawImage(ink.canvas, -ink.width / 2 - ink.pad, -h / 2 + 34 + 104 * 0.86 - ink.base);
      // portrait frame
      const fy = -h / 2 + 170, fh = h * 0.46;
      ctx.fillStyle = 'rgba(250,244,228,0.6)'; ctx.fillRect(-w / 2 + 50, fy, w - 100, fh);
      ctx.strokeStyle = 'rgba(70,45,20,0.75)'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 50, fy, w - 100, fh);
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 52, fy + 2, w - 104, fh - 4); ctx.clip();
      o.portrait(ctx, 0, fy + fh / 2, fh * 0.32, t);
      ctx.restore();
      setFont(ctx, FONTS.type, 24); ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(48,30,12,0.88)'; ctx.textAlign = 'center';
      (o.lines || []).forEach((ln, i) => { if (t >= (ln.at ?? 0)) { ctx.fillStyle = ln.red ? COLORS.redInk : 'rgba(48,30,12,0.88)'; ctx.fillText(ln.text, 0, fy + fh + 50 + i * 38); } });
      ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
      // red pins
      for (const sx of [-1, 1]) { ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(sx * (w / 2 - 34), -h / 2 + 30, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(sx * (w / 2 - 34) - 3, -h / 2 + 26, 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    s.sfx(o.at, 'slide', 0.6); s.sfx(o.at + 0.3, 'pop', 0.35);
  }
  // a cream card with typed lines (used for trial / ID / note cards)
  function noteCard(s, o) {
    s.custom({ at: o.at, until: o.until, layer: 'ui', z: o.z ?? 36 }, (ctx, t) => {
      const p = prog(t, o.at, 0.35, ease.outCubic);
      const c = card(o.w, o.h, { color: o.color || '#ece2cb', seed: o.seed ?? 21 });
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(o.x, o.y + (1 - p) * 60); ctx.rotate((o.rot ?? -1.5) * Math.PI / 180);
      ctx.drawImage(c.canvas, -c.pad, -c.pad);
      if (o.draw) o.draw(ctx, t);
      ctx.restore();
    });
    s.sfx(o.at, 'slide', 0.5);
  }

  // X-ray body (from anatomy_body)
  const BODY = { x: 540, y: 1225, h: 1250 };
  const body = (s, o = {}) => s.sprite('anatomy_body', { x: BODY.x, y: BODY.y, h: BODY.h, xray: true, ...o });
  const BG = G.anatomy_body || {};

  // =========================================================== HOOK
  S('S01', { look: 'paper' }, (s) => {
    const tMoon = s.w('चाँद'), tReach = s.w('पहुँच'), tBut = s.w('लेकिन'), tCure = s.w('इलाज'), tNo = s.w('नहीं');
    T2(s, ['WHY NO', 'CURE?'], 0.05, 0.5);
    const moon = s.sprite('moon_plate', { x: 540, y: 960, w: 620, shadow: { ground: 0, drop: 0.25 }, enter: { from: 'scale', s0: 0.85, dur: 0.4, sfx: 'whoosh' } });
    s.custom({ at: tMoon + 0.1, z: 5 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tMoon + 0.1, 0.3));
      const [x, y] = P(moon, t, G.moon_plate.spot);
      ctx.save(); ctx.globalAlpha *= clamp((t - tMoon - 0.1) / 0.08); ctx.translate(x, y); ctx.scale(p, p);
      drawBootprint(ctx, 0, 0, 120, -0.35); ctx.restore();
    });
    s.sfx(tMoon + 0.1, 'thud', 0.45);
    s.type('MOON LANDING · 1969  ✓', { at: tReach, x: 110, y: 1370, size: 30, spacing: 3, cps: 30, gain: 0.35, soundEvery: 2 });
    s.type('CANCER CURE  ·  ?', { at: tCure - 0.2, x: 110, y: 1418, size: 30, spacing: 3, cps: 30, color: COLORS.redInk, gain: 0.35, soundEvery: 2 });
    s.stamp('CANCER CURE:\nNOT FOUND', { at: tNo - 0.05, x: 560, y: 1080, rot: -8, size: 92, scales: [0.8, 1] });
    s.camera([[0, 1.0, 540, 960], [tBut, 1.04, 540, 960], [s.dur, 1.1, 560, 1020, ease.inOutQuad]]);
  });

  S('S02', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const tEnemy = s.w('दुश्मन'), tOwn = s.w('हमारे'), tCells = s.w('सेल्स');
    T2(s, ['THE ENEMY', 'IS YOU'], tEnemy - 0.05, tEnemy + 0.4);
    const bd = body(s);
    // scanner line sweeping down the body
    const scanA = 0.2, scanB = Math.max(1.6, tOwn - 0.6);
    s.custom({ at: scanA, until: scanB + 0.3, z: 40 }, (ctx, t) => {
      const y = lerp(560, 1700, ease.inOutQuad(prog(t, scanA, scanB - scanA)));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 1 - prog(t, scanB, 0.3);
      const g = ctx.createLinearGradient(0, y - 110, 0, y);
      g.addColorStop(0, 'rgba(255,80,50,0)'); g.addColorStop(1, 'rgba(255,90,60,0.26)');
      ctx.fillStyle = g; ctx.fillRect(230, y - 110, 620, 110);
      const l = ctx.createLinearGradient(200, 0, 880, 0);
      l.addColorStop(0, 'rgba(255,200,170,0)'); l.addColorStop(0.15, 'rgba(255,200,170,0.95)'); l.addColorStop(0.85, 'rgba(255,200,170,0.95)'); l.addColorStop(1, 'rgba(255,200,170,0)');
      ctx.fillStyle = l; ctx.fillRect(200, y - 2, 680, 4);
      ctx.restore();
    });
    s.sfx(scanA, 'scanner', 0.7);
    const term = s.terminal('SCANNING FOR ENEMY', { at: 0.25, x: 96, y: 1180, cps: 24, barAt: 1.1, barDur: Math.max(0.9, tOwn - 1.3), result: 'ENEMY = YOU', resultAt: tOwn - 0.05 });
    const spot = P(bd, 0, BG.lung || [0.43, 0.27]);
    cell(s, { at: tCells - 0.15, pos: spot, r: 30, type: 'cancer', seed: 4, z: 30 });
    s.target({ at: tCells, pos: spot, r: 62, sfx: 'beep', gain: 0.45 });
    heartbeats(s, 0.2, s.dur, 1.0, 0.4);
    s.camera([[0, 1.0, 540, 1100], [tCells, 1.04, 540, 1050], [s.dur, 1.1, spot[0], spot[1] + 100, ease.inOutQuad]]);
  });

  S('S03', { look: 'paper' }, (s) => {
    const t97 = s.w('सत्तानवे'), tLakh = s.w('लाख'), tWhy = s.w('क्यों');
    T2(s, ['9.7 MILLION', 'DEATHS A YEAR'], t97 - 0.05, t97 + 0.4);
    s.odometer('9,700,000', { at: 0.1, x: 540 - 313, y: 830, rollAt: 0.35, rollDur: Math.max(1.2, tLakh + 0.35 - 0.35) });
    s.type('CANCER DEATHS, WORLD, 2022', { at: tLakh, x: 540, y: 1080, size: 30, spacing: 4, cps: 30, align: 'center', gain: 0.35 });
    s.type('SOURCE: IARC GLOBOCAN', { at: tLakh + 0.8, x: 540, y: 1124, size: 20, spacing: 3, cps: 40, align: 'center', gain: 0.25, soundEvery: 3 });
    s.custom({ at: tWhy - 0.1, layer: 'ui', z: 45 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tWhy - 0.1, 0.3));
      const q = inkText('?', FONTS.title, 300, COLORS.red);
      ctx.save(); ctx.translate(540, 1300); ctx.scale(p, p); ctx.rotate(0.08);
      ctx.drawImage(q.canvas, -q.width / 2 - q.pad, -150 - (q.base - 300 * 0.86)); ctx.restore();
    });
    s.sfx(tWhy - 0.1, 'pop', 0.6);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== REASON 1: NOT ONE DISEASE
  S('S04', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tOne = s.w('एक'), t100 = s.w('सौ');
    s.kicker('REASON No. 1', { at: 0.12 });
    T2(s, ['NOT ONE', 'DISEASE'], tOne - 0.05, tOne + 0.4);
    const cab = s.sprite('specimen_cabinet', { x: 540, y: 960, w: 960, shadow: { ground: 0.28, drop: 0.2, groundAt: 0.985 } });
    const g = G.specimen_cabinet;
    const labels = ['BREAST', 'LUNG', 'MOUTH', 'BLOOD', 'BRAIN', 'SKIN', 'LIVER', 'CERVIX'];
    const slots = [[1, 0], [4, 1], [2, 2], [0, 1], [3, 0], [5, 2], [1, 3], [4, 3]];
    const t0 = 0.5, step = Math.max(0.22, (t100 + 0.6 - t0) / labels.length);
    slots.forEach(([cx, cy], i) => {
      const at = t0 + i * step;
      s.custom({ at, z: 10 }, (ctx, t, sc) => {
        const A = sc.reel.assets.get('specimen_cabinet');
        const nx = g.x0 + cx * g.px, ny = g.y0 + cy * g.py, dw = g.w, dh = g.h;
        const [X0, Y0] = P(cab, t, [nx, ny]), [X1, Y1] = P(cab, t, [nx + dw, ny + dh]);
        const w = X1 - X0, h = Y1 - Y0;
        const p = ease.outCubic(prog(t, at, 0.35));
        // dark opening behind the drawer
        ctx.fillStyle = 'rgba(25,14,6,0.85)'; ctx.fillRect(X0 + 3, Y0 + 3, w - 6, h - 6);
        // the drawer front comes out toward us (grows and drops a little)
        const k = 1 + 0.16 * p, dy = 0.22 * h * p;
        const fw = w * k, fh = h * k, fx = X0 + w / 2 - fw / 2, fy = Y0 + dy + h / 2 - fh / 2;
        // drawer sides
        ctx.fillStyle = '#4a2c16'; ctx.fillRect(fx + 4, Y0 + 4, fw - 8, fy - Y0 + 4);
        ctx.save(); ctx.shadowColor = 'rgba(20,10,4,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
        ctx.drawImage(A.img, nx * A.w, ny * A.h, dw * A.w, dh * A.h, fx, fy, fw, fh);
        ctx.restore();
        // label on the drawer's card
        if (p > 0.6) {
          const lb = g.label;
          setFont(ctx, FONTS.monoBold, Math.max(12, fh * 0.17)); ctx.fillStyle = 'rgba(40,24,10,0.95)'; ctx.textAlign = 'center'; ctx.letterSpacing = '0px';
          ctx.globalAlpha *= prog(t, at + 0.2, 0.15);
          ctx.fillText(labels[i], fx + fw * lb[0], fy + fh * (lb[1] + 0.06));
          ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
        }
      });
      s.sfx(at, 'drawer', 0.7, { v: i % 4 });
    });
    s.odometer('100+', { at: t100 - 0.25, x: 540 - 165, y: 1300, h: 100, dw: 64, rollAt: t100 - 0.1, rollDur: 0.9 });
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.05, 540, 1000]]);
  });

  // =========================================================== IT HAS YOUR FACE
  S('S06', { look: 'paper' }, (s) => {
    const tPolice = s.w('पुलिस'), tFace = s.w('चेहरा'), tVirus = s.w('वायरस');
    T2(s, ['HOW A', 'VACCINE WORKS'], 0.08, 0.53);
    // the vial first (left), then the WANTED poster takes its place
    s.sprite('vaccine_vial', { at: 0.05, until: tFace, x: 330, y: 960, w: 400, shadow: { ground: 0.25, drop: 0.2 }, enter: { from: 'scale', s0: 0.8, dur: 0.35, sfx: 'whoosh' }, exit: { at: tFace - 0.5, to: 'left', dur: 0.35 } });
    s.type('VACCINE', { at: 0.3, until: tFace - 0.5, x: 330, y: 1200, size: 28, spacing: 6, cps: 24, align: 'center', gain: 0.3 });
    poster(s, { at: tFace - 0.35, x: 330, y: 960, w: 470, h: 640, rot: -2,
      portrait: (ctx, cx, cy, r, t) => drawVirus(ctx, cx, cy, r * 0.82, t),
      lines: [{ text: 'FACE: KNOWN', at: tFace + 0.3 }, { text: 'REWARD: IMMUNITY', at: tFace + 0.8, red: true }] });
    // the immune cell (the police) reads the poster, then catches the virus
    const tCatch = tVirus + 0.25, VX = 790, VY = 1300;
    const ipos = (t) => {
      if (t < tFace + 0.2) return [lerp(1180, 790, ease.outCubic(prog(t, tPolice - 0.1, 0.8))), 960];
      if (t < tCatch) return [lerp(790, 730, prog(t, tFace + 0.2, 0.5, ease.inOutQuad)), 960 + Math.sin(t * 3) * 6];
      return [lerp(730, VX, prog(t, tCatch, 0.35, ease.inOutQuad)), lerp(960, VY, prog(t, tCatch, 0.35, ease.inOutQuad))];
    };
    cell(s, { at: tPolice - 0.1, pos: ipos, r: 92, type: 'immune', seed: 3, z: 40, layer: 'world', pop: false });
    leader(s, 'IMMUNE CELL = POLICE', { at: tPolice + 0.2, until: tVirus - 0.1, x: 760, y: 1200, align: 'center', to: (t) => { const [x, y] = ipos(t); return [x, y + 100]; }, size: 22 });
    s.custom({ at: tVirus - 0.05, z: 35 }, (ctx, t) => {
      const caught = prog(t, tCatch + 0.3, 0.4);
      if (caught < 1) drawVirus(ctx, VX, VY, 42 * (1 - 0.6 * caught), t, {});
    });
    s.sfx(tVirus - 0.05, 'pop', 0.45); s.sfx(tCatch + 0.3, 'squish', 0.6);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  S('S07', { look: 'paper' }, (s) => {
    const tFace = s.w('चेहरा'), tPolice = s.w('पुलिस'), tNo = s.w('नहीं');
    T2(s, ['IT HAS', 'YOUR FACE'], tFace - 0.05, tFace + 0.4);
    poster(s, { at: 0.05, x: 330, y: 960, w: 470, h: 640, rot: -2,
      portrait: (ctx, cx, cy, r, t) => drawCell(ctx, cx, cy, r * 0.95, t, { type: 'normal', seed: 2, shadow: false }),
      lines: [{ text: 'FACE: LOOKS NORMAL', at: tFace }, { text: 'IT LOOKS LIKE YOU', at: tFace + 0.9, red: true }] });
    // ID card pinned to the poster
    noteCard(s, { at: s.w('हमारे') - 0.1, x: 150, y: 1250, w: 330, h: 150, rot: 4, z: 42, seed: 44, draw: (ctx, t) => {
      setFont(ctx, FONTS.type, 18); ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(60,40,18,0.75)'; ctx.fillText('ID CARD', 24, 36);
      ctx.letterSpacing = '1px'; setFont(ctx, FONTS.monoBold, 34); ctx.fillStyle = '#21170c'; ctx.fillText('NAME: YOU', 24, 84);
      setFont(ctx, FONTS.type, 20); ctx.fillStyle = 'rgba(60,40,18,0.85)'; ctx.fillText('TYPE: OWN CELL', 24, 122);
    } });
    // the cancer cell looks like a normal cell; the immune cell comes close and stops
    cell(s, { at: 0.3, pos: [770, 1050], r: 88, type: 'normal', seed: 6, z: 20,
      after: (ctx, t, x, y, r) => { const a = 0.25 + 0.2 * Math.sin(t * 3); ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = COLORS.red; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } });
    leader(s, 'CANCER CELL', { at: 0.6, x: 770, y: 1250, align: 'center', to: [770, 1145], size: 22 });
    const ipos = (t) => [lerp(1150, 860, ease.outCubic(prog(t, tPolice - 0.2, 0.8))) + (t > tNo ? -18 * prog(t, tNo, 0.3) : 0), 830];
    cell(s, { at: tPolice - 0.2, pos: ipos, r: 70, type: 'immune', seed: 3, z: 22, pop: false });
    s.custom({ at: tNo, layer: 'ui', z: 45 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tNo, 0.3));
      const q = inkText('?', FONTS.title, 140, COLORS.red);
      const [x, y] = ipos(t);
      ctx.save(); ctx.translate(x + 10, y - 140); ctx.scale(p, p); ctx.drawImage(q.canvas, -q.width / 2 - q.pad, -70 - (q.base - 140 * 0.86)); ctx.restore();
    });
    s.sfx(tNo, 'pop', 0.6);
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== IT KEEPS CHANGING
  S('S08', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const tChange = s.w('बदलते'), tDNA = s.w('डीएनए'), tNew = s.w('नई-नई'), tErr = s.w('गलतियाँ');
    s.kicker('REASON No. 2', { at: 0.12, color: CREAM });
    T2(s, ['IT KEEPS', 'CHANGING'], tChange - 0.05, tChange + 0.4);
    const copyA = Math.max(1.0, s.w('उनके') - 0.2), copyB = s.dur - 0.3;
    const errs = [{ u: 0.22, at: tNew }, { u: 0.5, at: tErr }, { u: 0.71, at: tErr + 0.45 }, { u: 0.88, at: tErr + 0.9 }];
    s.custom({ at: 0, z: 20 }, (ctx, t) => {
      const p = prog(t, 0, 0.5);
      ctx.save(); ctx.globalAlpha *= p;
      drawDNA(ctx, 100, 980, 840, t, { look: 'xray', copy: prog(t, copyA, copyB - copyA), errors: errs, gap: 230 });
      ctx.restore();
    });
    s.sfx(copyA, 'hum', 0.35);
    errs.forEach((e) => { s.sfx(e.at, 'beep', 0.35); });
    const ex = 100 + 880 * errs[1].u;
    s.target({ at: tErr + 0.05, pos: [ex, 1070], r: 48, sfx: false });
    s.torn({ text: 'MUTATION', red: true }, { at: tErr + 0.1, x: 110, y: 1270, size: 60, rot: -3 });
    s.custom({ at: tErr + 0.2, layer: 'ui', z: 44 }, (ctx, t) => strokePartial(ctx, [[300, 1265], [ex - 20, 1110]], prog(t, tErr + 0.2, 0.3), 3, 'rgba(232,90,60,0.9)'));
    s.camera([[0, 1.0, 540, 950], [s.dur, 1.05, 540, 960]]);
  });

  S('S09', { look: 'xray' }, (s) => {
    const tKill = s.w('मार'), tSurv = s.w('बच'), tNoEffect = s.w('असर'), tAgain = s.w('फिर'), tTumor = s.w('ट्यूमर');
    T2(s, ['MOST DIE', 'ONE SURVIVES'], tSurv - 0.5, tSurv - 0.05);
    const cols = 7, rows = 5, sp = 98, gx = 540 - (cols - 1) * sp / 2, gy = 1010 - (rows - 1) * sp / 2;
    const survivor = 17;
    const waveA = Math.max(0.55, s.w('सेल्स') - 0.15), waveB = Math.max(waveA + 1.1, tKill + 0.7);
    const waveX = (t) => lerp(60, 1040, ease.inOutQuad(prog(t, waveA, waveB - waveA)));
    // treatment wave
    s.custom({ at: waveA, until: waveB + 0.4, z: 30 }, (ctx, t) => {
      const x = waveX(t), a = 1 - prog(t, waveB, 0.4);
      const g = ctx.createLinearGradient(x - 160, 0, x + 20, 0);
      g.addColorStop(0, 'rgba(150,210,255,0)'); g.addColorStop(0.8, `rgba(170,220,255,${0.32 * a})`); g.addColorStop(1, `rgba(230,245,255,${0.9 * a})`);
      ctx.fillStyle = g; ctx.fillRect(x - 160, 700, 180, 640);
      setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '6px'; ctx.fillStyle = `rgba(210,236,255,${0.9 * a})`;
      ctx.save(); ctx.translate(x - 26, 1300); ctx.rotate(-Math.PI / 2); ctx.fillText('TREATMENT', 0, 0); ctx.restore(); ctx.letterSpacing = '0px';
    });
    s.sfx(waveA, 'whoosh', 0.8);
    const r = rng(9);
    for (let i = 0; i < cols * rows; i++) {
      const x = gx + (i % cols) * sp + (r() - 0.5) * 18, y = gy + Math.floor(i / cols) * sp + (r() - 0.5) * 18;
      const killT = waveA + (waveB - waveA) * clamp((x - 60) / 980) * 0.98;
      if (i === survivor) continue;
      cell(s, { at: 0.05 + r() * 0.2, pos: [x, y], r: (t) => 34 * (1 - 0.35 * prog(t, killT, 0.5)), type: 'cancer', seed: i + 2, alpha: (t) => 1 - 0.88 * prog(t, killT, 0.6) });
    }
    // the survivor, then it multiplies back into a tumor
    const sx = gx + (survivor % cols) * sp, sy = gy + Math.floor(survivor / cols) * sp;
    const kids = [];
    const rr = rng(4);
    for (let k = 0; k < 16; k++) { const a = k * 2.399, d = 34 * Math.sqrt(k) * 1.15; kids.push([sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.9]); }
    const gens = [tAgain - 0.1, tAgain + 0.4, tTumor - 0.1, tTumor + 0.4];
    kids.forEach(([x, y], k) => {
      const gen = k === 0 ? -1 : Math.floor(Math.log2(k));
      const born = gen < 0 ? 0.05 : gens[Math.min(3, gen)];
      const parent = k === 0 ? [sx, sy] : kids[k - (1 << gen)];
      cell(s, { at: born, pos: (t) => { const q = gen < 0 ? 1 : ease.outCubic(prog(t, born, 0.4)); return [lerp(parent[0], x, q), lerp(parent[1], y, q)]; }, r: 34, type: 'cancer', seed: 40 + k, z: 24, pop: gen >= 0 });
    });
    gens.forEach((g2, i) => s.sfx(g2, 'pop', 0.35 + i * 0.05, { v: i }));
    s.torn({ text: 'RESISTANT', red: true }, { at: tSurv + 0.1, x: sx + 70, y: sy - 150, size: 48, rot: 4 });
    s.target({ at: tSurv, pos: [sx, sy], r: 58, sfx: 'beep', gain: 0.4 });
    s.type('EXAMPLE', { at: 0.4, x: 100, y: 1400, size: 22, spacing: 6, cps: 30, color: 'rgba(232,226,210,0.75)', gain: 0.25 });
    heartbeats(s, 0.3, s.dur, 1.0, 0.35);
    s.camera([[0, 1.0, 540, 1000], [tAgain, 1.04, 540, 1000], [s.dur, 1.18, sx, sy, ease.inOutQuad]]);
  });

  // =========================================================== IT HIDES
  S('S10', { look: 'xray' }, (s) => {
    const tFake = s.w('नकली'), tBadge = s.w('बैज'), tImm = s.w('इम्यून'), tStop = s.w('हमला');
    s.kicker('TRICK No. 3', { at: 0.12, color: CREAM });
    T2(s, ['A FAKE', 'BADGE'], tFake - 0.05, tBadge);
    const CX = 650, CY = 1060;
    cell(s, { at: 0.2, pos: [CX, CY], r: 130, type: 'cancer', seed: 8, z: 20 });
    s.custom({ at: tBadge - 0.1, layer: 'world', z: 30 }, (ctx, t) => {
      const p = ease.outBack(prog(t, tBadge - 0.1, 0.35), 2.2);
      drawBadge(ctx, CX - 80, CY - 70, 124 * p, { rot: -0.12 });
    });
    s.sfx(tBadge - 0.1, 'pop', 0.6);
    leader(s, 'PD-L1', { at: tBadge + 0.35, x: 110, y: 760, to: [CX - 140, CY - 110], size: 30, color: 'rgba(244,120,92,0.98)', lineColor: 'rgba(232,90,60,0.9)' });
    const ipos = (t) => {
      const go = ease.outCubic(prog(t, tImm - 0.2, Math.max(0.8, tStop - tImm + 0.2)));
      const x = lerp(-120, CX - 320, go) - (t > tStop + 0.1 ? 26 * prog(t, tStop + 0.1, 0.35, ease.outBack) : 0);
      return [x, CY + 40];
    };
    cell(s, { at: tImm - 0.2, pos: ipos, r: 96, type: 'immune', seed: 5, z: 22, pop: false });
    s.type('IMMUNE CELL', { at: tImm + 0.3, x: CX - 320, y: CY + 200, align: 'center', size: 24, spacing: 4, cps: 26, color: CREAM, gain: 0.3 });
    s.custom({ at: tStop + 0.1, layer: 'world', z: 40 }, (ctx, t) => {
      const p = prog(t, tStop + 0.1, 0.25);
      const x = CX - 200;
      ctx.save(); ctx.globalAlpha *= p; ctx.strokeStyle = 'rgba(240,80,50,0.95)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, CY - 70); ctx.lineTo(x, CY + 150); ctx.stroke(); ctx.restore();
    });
    s.sfx(tStop + 0.1, 'beep', 0.5);
    heartbeats(s, 0.2, s.dur, 1.0, 0.35);
    s.camera([[0, 1.0, 560, 1040], [s.dur, 1.06, 560, 1040]]);
  });

  S('S11', { look: 'paper' }, (s) => {
    const tNobel = s.w('नोबेल'), tDrugs = s.w('दवाओं'), tBrake = s.w('ब्रेक'), tRemove = s.w('हटा'), tFight = s.w('लड़े');
    s.title(['THE BRAKE', { text: 'REMOVED', red: true }], { at: [tBrake - 0.05, tRemove + 0.05] });
    const medal = s.sprite('gold_medal', { x: 540, y: 860, w: 470, shadow: { ground: 0, drop: 0.3 }, enter: { from: 'drop', dur: 0.5, dist: 300, sfx: 'whoosh' },
      path: [[0, 540, 880], [tDrugs - 0.2, 540, 880], [tDrugs + 0.3, 850, 700, ease.inOutCubic]], scaleKeys: [[0, 1], [tDrugs - 0.2, 1], [tDrugs + 0.3, 0.42, ease.inOutCubic]] });
    s.type('2018 · NOBEL PRIZE IN MEDICINE', { at: tNobel - 0.25, until: tDrugs - 0.1, x: 540, y: 1260, size: 30, spacing: 3, cps: 32, align: 'center', gain: 0.35 });
    // the brake comes off: badge ripped away, the immune cell attacks
    const CX = 640, CY = 1120, tRip = tRemove + 0.05;
    cell(s, { at: tDrugs, pos: [CX, CY], r: 120, type: 'cancer', seed: 8, z: 20,
      alpha: (t) => 1 - 0.8 * prog(t, tFight - 0.3, 0.9), r: (t) => 120 * (1 - 0.3 * prog(t, tFight - 0.3, 0.9)) });
    s.custom({ at: tDrugs, z: 30 }, (ctx, t) => {
      const q = prog(t, tRip, 0.6, ease.inCubic);
      ctx.save(); ctx.translate(lerp(0, 380, q), lerp(0, -460, q)); ctx.globalAlpha *= 1 - prog(t, tRip + 0.35, 0.3);
      drawBadge(ctx, CX - 70, CY - 50, 84, { rot: -0.12 + q * 2.4 });
      ctx.restore();
    });
    s.sfx(tRip, 'rip', 0.9);
    s.shake(tRip, 0.16, 7);
    const ipos = (t) => [lerp(160, CX - 150, ease.inOutCubic(prog(t, tRip + 0.2, 0.7))), CY + 30];
    cell(s, { at: tDrugs + 0.2, pos: ipos, r: 88, type: 'immune', seed: 5, z: 22, pop: false });
    s.sfx(tRip + 0.85, 'squish', 0.6);
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 560, 1000]]);
  });

  // =========================================================== THE TWIST
  S('S13', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    s.kicker('BUT WAIT', { at: 0.1 });
    const tBig = s.w('बड़ा'), tTwist = s.w('ट्विस्ट');
    T2(s, ['THE', 'TWIST'], Math.min(tBig, tTwist - 0.35), tTwist);
    s.custom({ at: 0.1, layer: 'bg', z: 2 }, (ctx, t) => {
      const a = prog(t, 0.1, 1.2);
      const g = ctx.createRadialGradient(540, 1040, 40, 540, 1040, 560);
      g.addColorStop(0, `rgba(255,246,214,${0.55 * a})`); g.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    s.sprite('vaccine_vial', { x: 540, y: 1040, w: 520, shadow: { ground: 0.25, drop: 0.2 }, enter: { from: 'scale', s0: 0.8, dur: 0.5, sfx: 'whoosh' }, bob: { amp: 4, freq: 0.5, rot: 0.4 } });
    s.camera([[0, 1.0, 540, 1040], [s.dur, 1.08, 540, 1040]]);
  });

  S('S14', { look: 'paper' }, (s) => {
    const tVac = s.w('वैक्सीन'), tVirus = s.w('वायरस'), tHPV = s.w('एचपीवी'), tHep = s.w('हेपेटाइटिस'), tEnd = s.voEnd;
    T2(s, ['CANCER VACCINES', 'ALREADY EXIST'], tVac - 0.05, tVac + 0.45);
    // virus -> cancer: why a vaccine can work here
    const dA = s.w('क्योंकि') - 0.1, dB = tHPV - 0.2;
    s.custom({ at: dA, until: dB + 0.3, z: 10 }, (ctx, t) => {
      const a = prog(t, dA, 0.3) * (1 - prog(t, dB, 0.3));
      ctx.save(); ctx.globalAlpha *= a;
      drawVirus(ctx, 300, 1000, 70, t);
      strokePartial(ctx, [[420, 1000], [640, 1000]], prog(t, dA + 0.4, 0.5), 6, COLORS.red, { dash: [16, 12] });
      if (prog(t, dA + 0.4, 0.5) >= 1) arrowHead(ctx, 650, 1000, 0, 30, COLORS.red);
      ctx.restore();
    });
    cell(s, { at: dA + 0.8, until: dB + 0.3, pos: [790, 1000], r: 90, type: 'cancer', seed: 3, alpha: (t) => 1 - prog(t, dB, 0.3) });
    s.type('VIRUS', { at: dA + 0.2, until: dB, x: 300, y: 1140, size: 26, spacing: 5, cps: 24, align: 'center', gain: 0.3 });
    s.type('CANCER', { at: dA + 0.9, until: dB, x: 790, y: 1150, size: 26, spacing: 5, cps: 24, align: 'center', gain: 0.3 });
    s.sfx(dA + 0.4, 'pen', 0.45);
    const vialCard = (at, y, a, b) => noteCard(s, { at, x: 110, y, w: 860, h: 230, rot: -1, z: 30, seed: Math.round(y), draw: (ctx, t, sc) => {
      const A = R.assets.get('vaccine_vial');
      const hh = 200, ww = hh * A.w / A.h;
      ctx.drawImage(A.img, 30, 15, ww, hh);
      const i1 = inkText(a, FONTS.title, 56, COLORS.ink), i2 = inkText(b, FONTS.title, 56, COLORS.red);
      const x0 = 50 + ww;
      ctx.drawImage(i1.canvas, x0 - i1.pad, 40 + 56 * 0.86 - i1.base);
      arrowHead(ctx, x0 + 22, 160, 0, 30, COLORS.red); ctx.fillStyle = COLORS.red; ctx.fillRect(x0, 156, 18, 8);
      ctx.drawImage(i2.canvas, x0 + 50 - i2.pad, 122 + 56 * 0.86 - i2.base);
    } });
    vialCard(tHPV - 0.1, 700, 'HPV VACCINE', 'CERVICAL CANCER');
    vialCard(tHep - 0.1, 975, 'HEPATITIS B VACCINE', 'LIVER CANCER');
    s.stamp('IN USE TODAY', { at: Math.min(tHep + 1.0, tEnd - 0.8), x: 560, y: 1330, rot: -7, size: 96 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1000]]);
  });

  S('S15', { look: 'paper' }, (s) => {
    const tAge = s.w('बारह-तेरह'), tVac = s.w('वैक्सीन'), tOne = s.w('एक'), tCase = s.w('केस'), tNot = s.w('नहीं');
    T2(s, ['SCOTLAND', 'ZERO CASES'], 0.05, 0.5);
    s.caseFile({ at: 0.05, x: 130, y: 640, w: 820, h: 520, tab: 'CASE FILE · SCOTLAND', lines: [
      { label: 'LOCATION', value: 'SCOTLAND', at: 0.2, size: 50 },
      { label: 'STUDY', value: '2024 · PUBLIC HEALTH SCOTLAND', at: 0.9, size: 32 },
      { label: 'WHO', value: 'WOMEN VACCINATED AT 12–13', at: tAge - 0.1, size: 36 },
    ] });
    s.stamp('CERVICAL CANCER CASES\n0', { at: tNot - 0.05, x: 560, y: 1290, rot: -6, size: 64, scales: [0.62, 2.6] });
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 540, 1000]]);
  });

  S('S16', { look: 'paper' }, (s) => {
    const tIndia = s.w('भारत'), tFeb = s.w('फ़रवरी'), t14 = s.w('चौदह'), tFree = s.w('मुफ़्त');
    T2(s, ['AND NOW', 'INDIA'], 0.05, 0.5);
    s.caseFile({ at: 0.05, x: 130, y: 640, w: 820, h: 560, tab: 'CASE FILE · INDIA', lines: [
      { label: 'STARTED', value: '28 FEB 2026', at: tFeb, size: 48 },
      { label: 'WHO', value: 'GIRLS AGE 14 · ONE DOSE', at: t14, size: 38 },
      { label: 'VACCINE', value: 'FREE HPV VACCINE', at: tFree - 0.2, size: 44, red: true },
    ] });
    s.sprite('vaccine_vial', { at: tIndia + 0.1, x: 810, y: 1335, w: 230, shadow: { ground: 0, drop: 0.25 }, rot: 8, z: 45, layer: 'world', enter: { from: 'scale', s0: 0.7, dur: 0.35, sfx: 'pop' } });
    s.type("INDIA HAS ~25% OF THE WORLD'S", { at: tFree + 0.2, x: 120, y: 1300, size: 27, spacing: 2, cps: 40, gain: 0.3, soundEvery: 3 });
    s.type('CERVICAL CANCER DEATHS', { at: tFree + 0.55, x: 120, y: 1340, size: 27, spacing: 2, cps: 40, color: COLORS.redInk, gain: 0.3, soundEvery: 3 });
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== THE FUTURE
  S('S17', { look: 'xray', transition: { type: 'scan', dur: 0.4 } }, (s) => {
    s.sfx(0, 'scan', 0.6);
    const tVac = s.w('वैक्सीन'), tTumor = s.w('ट्यूमर');
    T2(s, ['A VACCINE', 'JUST FOR YOU'], tVac - 0.4, tVac + 0.05);
    const st = [0.15, 0.95, 1.9, 2.9];
    // 1. tumour sample in a tube
    s.custom({ at: st[0], z: 20 }, (ctx, t) => {
      const a = prog(t, st[0], 0.3);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(210, 800);
      ctx.strokeStyle = 'rgba(232,226,210,0.85)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-34, -120); ctx.lineTo(-34, 70); ctx.arc(0, 70, 34, Math.PI, 0, true); ctx.lineTo(34, -120); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 6; i++) drawCell(ctx, 210 + ((i % 3) - 1) * 18, 860 - Math.floor(i / 3) * 30, 14, t, { type: 'cancer', look: 'xray', seed: i, alpha: a });
    });
    s.type('TUMOR SAMPLE', { at: st[0] + 0.2, x: 210, y: 970, size: 20, spacing: 3, cps: 40, align: 'center', color: CREAM, gain: 0.25, soundEvery: 3 });
    // 2. its DNA is read
    s.arrow({ at: st[1] - 0.2, pts: [[280, 800], [370, 800]], dur: 0.25, width: 5, head: 22 });
    s.custom({ at: st[1], z: 20 }, (ctx, t) => { ctx.save(); ctx.globalAlpha *= prog(t, st[1], 0.3); drawDNA(ctx, 400, 700, 800, t, { look: 'xray', amp: 34, wave: 150 }); ctx.restore(); });
    s.type('DNA READ', { at: st[1] + 0.2, x: 550, y: 900, size: 20, spacing: 3, cps: 40, align: 'center', color: CREAM, gain: 0.25, soundEvery: 3 });
    // 3. a custom mRNA message prints
    s.arrow({ at: st[2] - 0.2, pts: [[740, 800], [800, 860], [800, 960]], dur: 0.25, width: 5, head: 22 });
    const msg = 'AUG·GCU·UCC·GAA·CUG·ACG·UAC·';
    s.custom({ at: st[2], z: 20 }, (ctx, t) => {
      const p = prog(t, st[2], 1.2);
      const w = 720 * p;
      ctx.save(); ctx.translate(880, 1010);
      ctx.fillStyle = 'rgba(240,232,214,0.12)'; ctx.strokeStyle = 'rgba(240,232,214,0.75)'; ctx.lineWidth = 2;
      ctx.fillRect(-w, -30, w, 60); ctx.strokeRect(-w, -30, w, 60);
      ctx.beginPath(); ctx.rect(-w, -30, w, 60); ctx.clip();
      setFont(ctx, FONTS.monoBold, 34); ctx.fillStyle = 'rgba(255,170,120,0.95)';
      ctx.fillText(msg, -w + 14, 12);
      ctx.restore();
      ctx.fillStyle = 'rgba(60,60,52,0.95)'; ctx.fillRect(870, 960, 60, 100);
    });
    for (let k = 0; k < 8; k++) s.sfx(st[2] + k * 0.14, 'type', 0.35, { v: k % 6 });
    s.type('mRNA MESSAGE', { at: st[2] + 0.3, x: 160, y: 1090, size: 20, spacing: 3, cps: 40, color: CREAM, gain: 0.25, soundEvery: 3 });
    // 4. immune cells learn the cancer's real face and close in
    const C0 = [700, 1270];
    cell(s, { at: st[3], pos: C0, r: 56, type: 'cancer', seed: 12, z: 24, alpha: (t) => 1 - 0.7 * prog(t, s.dur - 0.6, 0.5) });
    [[-1, 0.6], [-0.2, -1], [0.9, 0.5]].forEach(([dx, dy], k) => {
      const home = [C0[0] + dx * 260, C0[1] + dy * 150];
      const pos = (t) => { const q = ease.inOutCubic(prog(t, st[3] + 0.6 + k * 0.1, 0.8)); return [lerp(home[0], C0[0] + dx * 86, q), lerp(home[1], C0[1] + dy * 70, q)]; };
      cell(s, { at: st[3] + 0.1 + k * 0.1, pos, r: 48, type: 'immune', seed: 20 + k, z: 26, after: (ctx, t, x, y) => {
        const a = prog(t, st[3] + 0.4 + k * 0.1, 0.25);
        if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(240,80,50,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.moveTo(x - 24, y); ctx.lineTo(x + 24, y); ctx.moveTo(x, y - 24); ctx.lineTo(x, y + 24); ctx.stroke(); ctx.restore(); }
      } });
    });
    s.sfx(st[3] + 0.5, 'beep', 0.4); s.sfx(st[3] + 1.4, 'squish', 0.5);
    s.type('MADE FROM YOUR OWN TUMOR', { at: tTumor - 0.2, x: 100, y: 1420, size: 26, spacing: 3, cps: 34, color: 'rgba(244,120,92,0.98)', gain: 0.3 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1020]]);
  });

  S('S18', { look: 'paper' }, (s) => {
    const tSkin = s.w('स्किन'), t1100 = s.w('ग्यारह'), tTrial = s.w('ट्रायल'), tWin = s.w('कामयाब'), tOnly = s.w('बस');
    T2(s, ['BIG TRIAL', 'SUCCESS'], tWin - 0.45, tWin);
    s.caseFile({ at: 0.05, x: 130, y: 640, w: 820, h: 530, tab: 'CLINICAL TRIAL', lines: [
      { label: 'STAGE', value: 'PHASE 3', at: 0.2, size: 52, gap: 26 },
      { label: 'CANCER', value: 'MELANOMA (SKIN CANCER)', at: tSkin - 0.1, size: 36, gap: 26 },
      { label: 'PATIENTS', value: '1,137', at: t1100 - 0.1, size: 52, gap: 26 },
      { label: 'RESULT', value: 'AUG 2026: SUCCESS', at: tWin - 0.05, size: 44, red: true },
    ] });
    // phase track: 1 ✓, 2 ✓, 3 ✓ ... approval still open
    s.custom({ at: 0.3, layer: 'ui', z: 44 }, (ctx, t) => {
      const steps = [['1', 0.3], ['2', 0.5], ['3', tWin], ['OK?', tOnly]];
      const y = 1262;
      ctx.save(); ctx.globalAlpha *= prog(t, 0.3, 0.3);
      ctx.strokeStyle = 'rgba(46,28,12,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(820, y); ctx.stroke();
      steps.forEach(([lab, at], i) => {
        const x = 220 + i * 200, done = i < 3 && t >= at, open = i === 3;
        ctx.fillStyle = done ? '#2e1b0a' : '#ece2cb'; ctx.strokeStyle = open && t >= at ? COLORS.red : '#2e1b0a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        setFont(ctx, FONTS.title, open ? 26 : 34); ctx.textAlign = 'center'; ctx.fillStyle = done ? '#efe3c6' : (open && t >= at ? COLORS.red : '#2e1b0a');
        ctx.fillText(open ? '?' : lab, x, y + 12);
        setFont(ctx, FONTS.type, 18); ctx.fillStyle = 'rgba(46,28,12,0.85)'; ctx.fillText(open ? 'APPROVAL' : `PHASE ${lab}`, x, y + 70);
        ctx.textAlign = 'left';
      });
      ctx.restore();
    });
    s.sfx(tWin, 'pen', 0.5);
    s.torn({ text: 'NOT APPROVED YET', red: true }, { at: tOnly, x: 330, y: 1366, size: 44, rot: -3 });
    s.camera([[0, 1.0, 540, 980], [s.dur, 1.04, 540, 1000]]);
  });

  // =========================================================== ENDING
  S('S20', { look: 'paper', transition: { type: 'curl', dur: 0.45 } }, (s) => {
    pageTurn(s);
    const tWeap = s.w('हथियार'), tEarly = s.w('जल्दी');
    T2(s, ['NOT ONE CURE', 'MANY WEAPONS'], tWeap - 0.45, tWeap);
    // tray
    s.custom({ at: 0.15, z: 2 }, (ctx, t) => {
      const p = prog(t, 0.15, 0.4, ease.outCubic);
      ctx.save(); ctx.translate(0, (1 - p) * 300); ctx.globalAlpha *= clamp((t - 0.15) / 0.15);
      ctx.save(); ctx.filter = 'blur(18px)'; ctx.fillStyle = 'rgba(30,18,6,0.4)'; ctx.fillRect(130, 720, 840, 560); ctx.restore();
      const g = ctx.createLinearGradient(0, 700, 0, 1280);
      g.addColorStop(0, '#e9e6dc'); g.addColorStop(1, '#c9c4b5');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(110, 700, 860, 570, 36); ctx.fill();
      ctx.strokeStyle = '#4c6a7a'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(126, 716, 828, 538, 28); ctx.stroke();
      ctx.restore();
    });
    s.sfx(0.15, 'slide', 0.6);
    const tools = [['surgery', 'SURGERY', 260, 890], ['chemo', 'CHEMO', 540, 880], ['radiation', 'RADIATION', 820, 890], ['immuno', 'IMMUNOTHERAPY', 400, 1130], ['vaccine', 'VACCINES', 680, 1130]];
    const step = 0.32, t0 = tWeap - 0.1;
    tools.forEach(([k, lab, x, y], i) => {
      const at = t0 + i * step;
      s.custom({ at, z: 10 }, (ctx, t) => {
        const p = ease.outBack(prog(t, at, 0.3));
        ctx.save(); ctx.globalAlpha *= clamp((t - at) / 0.08); ctx.translate(x, y - (1 - p) * 40);
        drawToolIcon(ctx, k, 0, 0, 92, t); ctx.restore();
      });
      s.sfx(at + 0.12, 'tick', 0.5, { v: i });
      s.type(lab, { at: at + 0.15, x, y: y + (k === 'chemo' ? 124 : 100), size: 24, spacing: 3, cps: 40, align: 'center', gain: 0.25, soundEvery: 3, layer: 'world' });
    });
    s.type('MANY CANCERS CAN BE CURED', { at: tEarly - 0.2, x: 540, y: 1356, size: 32, spacing: 2, cps: 40, align: 'center', gain: 0.3, soundEvery: 3 });
    s.type('IF FOUND EARLY', { at: tEarly + 0.5, x: 540, y: 1404, size: 34, spacing: 3, cps: 30, align: 'center', color: COLORS.redInk, gain: 0.3, soundEvery: 2 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.04, 540, 1020]]);
  });

  S('S21', { look: 'paper' }, (s) => {
    const tTob = s.w('तंबाकू'), tAway = s.w('रहो'), tGirls = s.w('बेटियों'), tGet = s.w('लगवाओ'), tLump = s.w('गाँठ'), tWound = s.w('घाव'), tBleed = s.w('ब्लीडिंग'), tDoc = s.w('डॉक्टर'), tShow = s.w('दिखाओ');
    T2(s, ['WHAT', 'YOU CAN DO'], 0.08, 0.53);
    s.checklist({ at: 0.2, x: 110, y: 1040, w: 860, h: 400, header: 'WHAT YOU CAN DO', size: 40, rot: -1, items: [
      { text: 'NO TOBACCO', at: tTob - 0.1, mark: 'check', markAt: tAway },
      { text: 'HPV VACCINE FOR GIRLS', at: tGirls - 0.1, mark: 'check', markAt: tGet },
      { text: 'GET CHECKED EARLY', at: tLump - 0.4, mark: 'check', markAt: tShow },
    ] });
    // 1. tobacco, crossed out
    const leaf = s.sprite('tobacco_leaf', { at: tTob - 0.15, until: tGirls, x: 540, y: 820, w: 400, shadow: { ground: 0, drop: 0.25 }, enter: { from: 'scale', s0: 0.8, dur: 0.3, sfx: 'whoosh' } });
    s.custom({ at: tAway - 0.1, until: tGirls, layer: 'ui', z: 40 }, (ctx, t) => xMark(ctx, 540, 820, 330, prog(t, tAway - 0.1, 0.3), COLORS.redInk, 16));
    s.sfx(tAway - 0.1, 'pen', 0.7);
    // 2. the HPV vaccine
    s.sprite('vaccine_vial', { at: tGirls - 0.1, until: tLump - 0.4, x: 540, y: 810, w: 340, shadow: { ground: 0.25, drop: 0.2 }, enter: { from: 'scale', s0: 0.8, dur: 0.3, sfx: 'whoosh' } });
    s.type('HPV VACCINE', { at: tGirls + 0.2, until: tLump - 0.4, x: 540, y: 1012, size: 26, spacing: 5, cps: 26, align: 'center', gain: 0.3 });
    // 3. get checked early: the warning signs
    s.magnifier({ at: tLump - 0.45, to: [265, 715], from: [-300, 800], r: 115, dur: 0.45, drawLens: (ctx, t, sc, cx, cy, Rl) => {
      ctx.fillStyle = '#efe4cc'; ctx.fillRect(cx - Rl, cy - Rl, Rl * 2, Rl * 2);
      drawCell(ctx, cx + 6, cy + 4, Rl * 0.5, t, { type: 'cancer', seed: 3 });
    } });
    const signs = [['A LUMP', tLump], ["A WOUND THAT WON'T HEAL", tWound], ['UNUSUAL BLEEDING', tBleed]];
    signs.forEach(([txt, at], i) => s.type(txt, { at: at - 0.05, x: 490, y: 665 + i * 56, size: 28, spacing: 2, cps: 34, gain: 0.3, soundEvery: 2 }));
    s.type('→ SEE A DOCTOR', { at: tDoc - 0.1, x: 490, y: 860, size: 34, spacing: 3, cps: 30, color: COLORS.redInk, gain: 0.35 });
    s.camera([[0, 1.0, 540, 1000], [s.dur, 1.03, 540, 1000]]);
  });

  S('S22', { look: 'paper' }, (s) => {
    const tFight = s.w('लड़ाई'), tWin = s.w('जीत');
    T2(s, ['THE FIGHT', 'GOES ON'], tFight - 0.45, tFight);
    const cx = 540, cy = 1015, Rr = 255;
    // labels sit where no arrow passes: below the top/bottom nodes, above the two side nodes
    const nodes = [
      { label: 'NORMAL CELL', type: 'normal', lab: [0, 124] },
      { label: 'MUTATES', type: 'cancer', mark: 'dna', lab: [25, -112] },
      { label: 'HIDES', type: 'cancer', mark: 'badge', lab: [0, 124] },
      { label: 'FOUND', type: 'cancer', mark: 'target', lab: [0, 124] },
      { label: 'FOUGHT', type: 'immune', lab: [-25, -112] },
    ];
    const step = Math.min(0.42, (tFight - 0.3) / nodes.length);
    nodes.forEach((nd, i) => {
      const ang = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      const x = cx + Math.cos(ang) * Rr, y = cy + Math.sin(ang) * Rr;
      const at = 0.2 + i * step;
      s.custom({ at, z: 6 }, (ctx, t) => {
        const p = ease.outBack(prog(t, at, 0.3));
        ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha *= clamp((t - at) / 0.1);
        ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#f0e7d3'; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(46,28,12,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
        drawCell(ctx, 0, 0, 52, t, { type: nd.type, seed: i + 3, shadow: false });
        if (nd.mark === 'badge') drawBadge(ctx, -26, -22, 40, { rot: -0.15 });
        if (nd.mark === 'dna') { ctx.strokeStyle = COLORS.red; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(30, -50); ctx.lineTo(50, -30); ctx.moveTo(50, -50); ctx.lineTo(30, -30); ctx.stroke(); }
        if (nd.mark === 'target') { ctx.strokeStyle = COLORS.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.stroke(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(dx * 40, dy * 40); ctx.lineTo(dx * 86, dy * 86); ctx.stroke(); } }
        ctx.restore();
      });
      s.sfx(at, 'pop', 0.35);
      s.type(nd.label, { at: at + 0.1, x: x + nd.lab[0], y: y + nd.lab[1], size: 20, spacing: 3, cps: 40, align: 'center', gain: 0.2, soundEvery: 4, layer: 'world' });
      if (i < nodes.length - 1) {
        const a0 = ang + 0.42, a1 = ang + (Math.PI * 2) / nodes.length - 0.42, pts = [];
        for (let k = 0; k <= 12; k++) { const a = lerp(a0, a1, k / 12); pts.push([cx + Math.cos(a) * Rr * 1.02, cy + Math.sin(a) * Rr * 1.02]); }
        s.arrow({ at: at + step * 0.7, pts, dur: 0.3, width: 5, head: 22, gain: 0.25 });
      }
    });
    s.type('SAVE · SHARE', { at: tWin - 0.2, x: 99, y: 628, size: 32, spacing: 6, cps: 26, color: COLORS.redInk, gain: 0.35 });
    s.camera([[0, 1.0, 540, 1040], [s.dur, 1.03, 540, 1040]]);
  });
}
