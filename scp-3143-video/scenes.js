'use strict';
// Scene definitions. Each factory receives the scene's narration timing:
//   S.dur        scene length (s)
//   S.cues[i]    local start time of narration line i
//   S.durs[i]    length of narration line i
//   S.at(i, w)   local time the narrator says word `w` in line i
// and returns { draw(ctx, t), sfx: [...], music: [...], transIn }.
// Every draw() is a pure function of local time t.

const G = require('./gfx');
const { W, H, C, clamp, lerp, prog, E, env, txt, measure, wrap, typeLines, hash } = G;

// ------------------------------------------------------------- helpers ----
function bgNight(ctx, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top || '#0c1019'); g.addColorStop(1, o.bottom || '#040508');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// Dark office wall lit through venetian blinds. `noir` 0..1 blends toward a
// flat, clinical Foundation look.
function bgOffice(ctx, t, o = {}) {
  const noir = o.noir === undefined ? 1 : o.noir;
  ctx.fillStyle = mix('#1c2128', '#14161b', noir); ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.3, H * 0.15, 40, W * 0.3, H * 0.15, W);
  g.addColorStop(0, `rgba(255,222,170,${0.07 * noir})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (noir < 1) { // flat overhead fluorescent
    ctx.fillStyle = `rgba(170,190,210,${0.05 * (1 - noir)})`; ctx.fillRect(0, 0, W, H);
  }
  if (noir > 0) G.blinds(ctx, t, { alpha: (o.blindsAlpha || 0.14) * noir, x: o.blindsX || W * 0.6 });
}
// hand-drawn check / cross (the fonts have no glyphs for these)
function mark(ctx, kind, x, y, size, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = size * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'check') { ctx.moveTo(x - size * 0.5, y); ctx.lineTo(x - size * 0.1, y + size * 0.4); ctx.lineTo(x + size * 0.55, y - size * 0.45); }
  else { ctx.moveTo(x - size * 0.45, y - size * 0.45); ctx.lineTo(x + size * 0.45, y + size * 0.45); ctx.moveTo(x + size * 0.45, y - size * 0.45); ctx.lineTo(x - size * 0.45, y + size * 0.45); }
  ctx.stroke(); ctx.restore();
}
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`;
}
function fitFont(ctx, s, maxW, size, family, spacing) {
  let sz = size;
  while (sz > 12 && measure(ctx, s, `${sz}px ${family}`, spacing) > maxW) sz -= 2;
  return `${sz}px ${family}`;
}
// "> ACCESS SCP:/3143/..." terminal line
const ACCESS_CPS = 40;
function access(ctx, t, start, p, o = {}) {
  const s = '> ACCESS ' + p;
  typeLines(ctx, [s], o.x ?? 120, o.y ?? 104, 0, t, start, ACCESS_CPS,
    { font: '32px CourierP', color: C.amber, cursorUntil: start + s.length / ACCESS_CPS + 0.9, alpha: o.alpha });
  return s;
}
function accessSfx(start, p) { return { t: start, type: 'type', n: ('> ACCESS ' + p).length, cps: ACCESS_CPS }; }
// slide+fade helper
function rise(t, start, d = 0.6, dist = 40) {
  const k = E.outCubic(prog(t, start, d));
  return { a: k, dy: (1 - k) * dist };
}
// Word-wrapped layout with per-word boxes so phrases can be highlighted.
function layout(ctx, text, font, maxW, lh) {
  ctx.save(); ctx.font = font;
  const space = ctx.measureText(' ').width;
  const words = [];
  let x = 0, y = 0;
  for (const para of text.split('\n')) {
    for (const w of para.split(' ').filter(Boolean)) {
      const ww = ctx.measureText(w).width;
      if (x > 0 && x + ww > maxW) { x = 0; y += lh; }
      words.push({ w, x, y, ww });
      x += ww + space;
    }
    x = 0; y += lh * 1.45;
  }
  ctx.restore();
  return { words, font, lh, height: y - lh * 0.45 };
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function findPhrase(L, phrase) {
  const p = phrase.split(' ').map(norm).filter(Boolean);
  for (let i = 0; i + p.length <= L.words.length; i++) {
    if (p.every((q, j) => norm(L.words[i + j].w) === q)) return [i, i + p.length - 1];
  }
  throw new Error('phrase not found: ' + phrase);
}
function drawLayout(ctx, L, x0, y0, o = {}) {
  ctx.save(); ctx.font = L.font; ctx.fillStyle = o.color || C.paper;
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  for (const w of L.words) ctx.fillText(w.w, x0 + w.x, y0 + w.y);
  ctx.restore();
}
// marker-pen highlight sweeping across words [a..b] with progress k
function highlight(ctx, L, x0, y0, range, k, color = 'rgba(240,168,64,0.42)') {
  if (k <= 0) return;
  const ws = L.words.slice(range[0], range[1] + 1);
  const total = ws.reduce((s, w) => s + w.ww + 14, 0);
  let left = total * E.inOutCubic(k);
  ctx.save(); ctx.fillStyle = color;
  const fs = parseInt(L.font.match(/(\d+)px/)[1], 10);
  for (const w of ws) {
    if (left <= 0) break;
    const ww = Math.min(w.ww + 14, left);
    ctx.fillRect(x0 + w.x - 6, y0 + w.y - fs * 0.85, ww, fs * 1.15);
    left -= w.ww + 14;
  }
  ctx.restore();
}
function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = o.fill || 'rgba(14,16,20,0.92)';
  G.rrect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = o.stroke || 'rgba(240,168,64,0.35)'; ctx.lineWidth = 2;
  G.rrect(ctx, x, y, w, h, 10); ctx.stroke();
  ctx.restore();
}
function thaumBust(ctx, x, y, s) { // card portrait: lab coat, glasses, scowl
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#d9dde2';
  ctx.beginPath(); ctx.moveTo(-120, 0); ctx.quadraticCurveTo(-118, -90, -40, -110); ctx.lineTo(40, -110); ctx.quadraticCurveTo(118, -90, 120, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8d9199'; ctx.beginPath(); ctx.moveTo(-30, -110); ctx.lineTo(0, -40); ctx.lineTo(30, -110); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.redDark; ctx.beginPath(); ctx.moveTo(-6, -104); ctx.lineTo(6, -104); ctx.lineTo(4, -56); ctx.lineTo(0, -48); ctx.lineTo(-4, -56); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-40, -110); ctx.lineTo(-10, -30); ctx.moveTo(40, -110); ctx.lineTo(10, -30); ctx.stroke();
  ctx.fillStyle = '#c3c8ce'; ctx.fillRect(-16, -132, 32, 28);
  ctx.beginPath(); ctx.ellipse(0, -176, 40, 50, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1f2f4';
  ctx.beginPath(); ctx.ellipse(-37, -186, 9, 22, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(37, -186, 9, 22, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-16, -180, 11, 0, Math.PI * 2); ctx.moveTo(27, -180); ctx.arc(16, -180, 11, 0, Math.PI * 2); ctx.moveTo(-5, -180); ctx.lineTo(5, -180); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-24, -198); ctx.lineTo(-8, -194); ctx.moveTo(24, -198); ctx.lineTo(8, -194); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -148); ctx.quadraticCurveTo(0, -155, 12, -148); ctx.stroke();
  ctx.restore();
}
function labCoat(ctx, x, y, s, o = {}) { // Dr. Thaum: lab coat + glasses
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.rot) ctx.rotate(o.rot);
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  ctx.fillStyle = o.fill || '#d9dde2';
  ctx.beginPath(); ctx.moveTo(-34, -470); ctx.quadraticCurveTo(-96, -462, -104, -420);
  ctx.lineTo(-112, -150); ctx.lineTo(112, -150); ctx.lineTo(104, -420); ctx.quadraticCurveTo(96, -462, 34, -470); ctx.closePath(); ctx.fill();
  ctx.fillRect(-50, -150, 36, 150); ctx.fillRect(14, -150, 36, 150);
  ctx.beginPath(); ctx.ellipse(0, -520, 34, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#30343a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-14, -522, 10, 0, Math.PI * 2); ctx.arc(14, -522, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -470); ctx.lineTo(0, -160); ctx.stroke();
  ctx.restore();
}

// ============================================================== scenes ====
const scenes = {};

// ---------------------------------------------------------- cold open ----
scenes.cold_open = S => {
  const l1 = 'FADE IN:', l2 = 'INT. MURPHY LAW DETECTIVE AGENCY - NIGHT';
  const t1 = 1.0, t2 = S.cues[0] + 0.15, cps2 = 26, tCity = S.cues[1] - 0.3, flash = 0.35;
  return {
    transIn: 'cut',
    sfx: [{ t: 0.15, type: 'thunder' }, { t: t1, type: 'type', n: l1.length, cps: 10 },
      { t: t2, type: 'type', n: l2.length, cps: cps2 }, { t: t2 + l2.length / cps2 + 0.05, type: 'ding' }],
    music: [{ t: 0, level: 0.0 }, { t: S.cues[1], level: 0.45 }],
    rain: 1,
    draw(ctx, t) {
      bgNight(ctx);
      const k = E.outCubic(prog(t, tCity, 4));
      const cityY = H + 30 + (1 - k) * 260;
      G.city(ctx, -40, cityY, W + 80, t, { seed: 11, lights: 0.15 + 0.85 * k });
      const fl = t > flash ? Math.max(0, 1 - (t - flash) / 0.8) * (0.6 + 0.4 * Math.sin(t * 70)) : 0;
      if (fl > 0) {
        ctx.fillStyle = `rgba(200,215,255,${fl * 0.5})`; ctx.fillRect(0, 0, W, H);
        G.city(ctx, -40, cityY, W + 80, t, { seed: 11, fill: '#000', lights: 0 });
      }
      G.rain(ctx, t, 1);
      const up = E.inOutCubic(prog(t, tCity, 2.2)) * 150;
      typeLines(ctx, [l1], 300, 470 - up, 0, t, t1, 10, { font: '54px CourierP', color: C.paper, cursorUntil: t2 });
      typeLines(ctx, [l2], 300, 560 - up, 0, t, t2, cps2, { font: 'bold 54px CourierP', color: C.paper, cursorUntil: S.dur - 1 });
    },
  };
};

// -------------------------------------------------------------- title ----
scenes.title = S => {
  const tNum = S.cues[0] + 0.05, tMur = S.at(0, 'Murphy') - 0.1, tFound = S.at(0, 'Foundation') - 0.1;
  const tTwice = S.at(0, 'rings') - 0.05, tEuc = S.at(1, 'Euclid') - 0.05, tBy = S.at(1, 'written') - 0.1;
  return {
    transIn: 'fade',
    sfx: [{ t: tNum, type: 'boom' }, { t: tFound, type: 'whoosh' }, { t: tEuc + 0.16, type: 'stamp' }],
    music: [{ t: 0, level: 0.9 }],
    draw(ctx, t) {
      bgOffice(ctx, t, { blindsX: W * 0.62, blindsAlpha: 0.15 });
      const push = 1 + t * 0.006;
      ctx.save(); ctx.translate(470, 760); ctx.scale(push, push); ctx.translate(-470, -760);
      G.detective(ctx, 470, 760, 1.4, { t, rim: 'rgba(240,168,64,0.5)' });
      ctx.restore();
      G.rain(ctx, t, 0.28);
      const X = 860;
      const k1 = E.outExpo(prog(t, tNum, 0.9));
      txt(ctx, 'SCP-3143', X + (1 - k1) * 140, 380, { font: '240px Bebas', color: C.amber, alpha: k1, spacing: 8, glow: 'rgba(240,168,64,0.35)', glowBlur: 34 });
      const r2 = rise(t, tMur, 0.6, 24);
      txt(ctx, 'MURPHY LAW IN…', X + 8, 470 + r2.dy, { font: '52px Abril', color: C.paper, alpha: r2.a, spacing: 4 });
      const f3 = fitFont(ctx, 'ALWAYS RINGS TWICE!', 1000, 92, 'Abril');
      const r3 = rise(t, tFound, 0.7, 30), r4 = rise(t, tTwice, 0.7, 30);
      txt(ctx, 'THE FOUNDATION', X + 4, 580 + r3.dy, { font: f3, color: C.white, alpha: r3.a });
      txt(ctx, 'ALWAYS RINGS TWICE!', X + 4, 680 + r4.dy, { font: f3, color: C.white, alpha: r4.a });
      const k5 = E.inOutCubic(prog(t, tTwice + 0.6, 0.7));
      ctx.fillStyle = C.red; ctx.fillRect(X + 8, 712, 980 * k5, 7);
      G.stamp(ctx, 'EUCLID', 1600, 850, t, tEuc, { size: 84, rot: -0.1 });
      const r6 = rise(t, tBy, 0.8, 16);
      txt(ctx, 'by The Great Hippo  ·  SCP Wiki', X + 8, 800 + r6.dy, { font: '34px CourierP', color: C.grey, alpha: r6.a });
    },
  };
};

// --------------------------------------------------------------- what ----
scenes.what = S => {
  const tWord = S.cues[0] + 0.1, tStory = S.at(0, 'living'), tThink = S.at(0, 'thinking'), tWarp = S.at(0, 'warp');
  const tB = S.cues[1] - 0.2, tFlat = S.at(1, 'flattens'), tPage = tFlat + 0.75;
  const tHard = S.at(1, 'hard'), tNoir = S.at(1, 'noir'), t30 = S.at(1, '1930s');
  const page = ['INT. MURPHY LAW DETECTIVE AGENCY - NIGHT', '', 'A blade of moonlight cuts across', 'his face.', '',
    'His name is MURPHY LAW, and if you', "think his number is up, then you", "haven't been counting."];
  const pageChars = page.join('').length, pageCps = 46;
  return {
    transIn: 'blinds',
    sfx: [{ t: tWord, type: 'whoosh' }, { t: tStory, type: 'pop' }, { t: tThink, type: 'pop' }, { t: tWarp, type: 'warp' },
      { t: tFlat, type: 'flatten' }, { t: tPage + 0.3, type: 'type', n: pageChars, cps: pageCps },
      { t: tHard, type: 'stamp', gain: 0.5 }, { t: tNoir, type: 'stamp', gain: 0.5 }, { t: t30, type: 'stamp', gain: 0.5 }],
    music: [{ t: 0, level: 0.6 }],
    draw(ctx, t) {
      bgNight(ctx, { top: '#0e121a', bottom: '#07080c' });
      // reality grid, warping once the story "wakes up"
      const warp = env(t, tWarp - 0.2, tB + 0.6, 0.8, 0.6);
      ctx.save(); ctx.strokeStyle = 'rgba(111,143,181,0.13)'; ctx.lineWidth = 1.5;
      for (let gx = 0; gx <= W; gx += 80) {
        ctx.beginPath();
        for (let gy = 0; gy <= H; gy += 20) {
          const dx = Math.sin(gy * 0.012 + t * 2.4) * 26 * warp * Math.exp(-Math.pow((gx - W / 2) / 700, 2));
          gy === 0 ? ctx.moveTo(gx + dx, gy) : ctx.lineTo(gx + dx, gy);
        }
        ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 80) {
        ctx.beginPath();
        for (let gx = 0; gx <= W; gx += 20) {
          const dy = Math.sin(gx * 0.01 + t * 2) * 22 * warp * Math.exp(-Math.pow((gy - H / 2) / 500, 2));
          gx === 0 ? ctx.moveTo(gx, gy + dy) : ctx.lineTo(gx, gy + dy);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Part A: definition
      const outA = 1 - E.inCubic(prog(t, tB, 0.5));
      if (outA > 0) {
        ctx.save(); ctx.globalAlpha = outA; ctx.translate(0, -(1 - outA) * 60);
        const k = E.outExpo(prog(t, tWord, 1.0));
        txt(ctx, 'INTRAFICTIONAL CONSTRUCT', W / 2, 330, { font: '150px Bebas', color: C.paper, align: 'center', alpha: k, spacing: 4 + (1 - k) * 40 });
        txt(ctx, 'item #: scp-3143  ·  object class: euclid', W / 2, 400, { font: '32px CourierP', color: C.grey, align: 'center', alpha: k });
        const items = [[tStory, 'A STORY', 'that is alive'], [tThink, 'THAT THINKS', 'sapient, self-aware'], [tWarp, 'AND WARPS REALITY', 'the world becomes its page']];
        items.forEach(([ts, a, b], i) => {
          const cx = 480 + i * 480, r = rise(t, ts, 0.6, 30);
          if (r.a <= 0) return;
          ctx.save(); ctx.globalAlpha *= r.a; ctx.translate(0, r.dy);
          if (i === 0) G.iconBook(ctx, cx, 640, 1.0);
          if (i === 1) G.iconEye(ctx, cx, 640, 0.95, t);
          if (i === 2) G.iconWarp(ctx, cx, 640, 1.0, t);
          txt(ctx, a, cx, 790, { font: '58px Bebas', color: i === 2 ? C.amber : C.paper, align: 'center', spacing: 2 });
          txt(ctx, b, cx, 836, { font: '28px CourierP', color: C.grey, align: 'center' });
          if (i < 2) txt(ctx, '+', cx + 240, 660, { font: '70px Bebas', color: C.dim, align: 'center' });
          ctx.restore();
        });
        ctx.restore();
      }

      // Part B: the world flattens into a script
      if (t > tB) {
        const inK = E.outCubic(prog(t, tB + 0.35, 0.7));
        const sq = 1 - E.inOutCubic(prog(t, tFlat, 0.7));
        const baseY = 820;
        if (sq > 0.01) {
          ctx.save(); ctx.globalAlpha = inK;
          G.city(ctx, 360, baseY, 1200, t, { seed: 21, scaleY: Math.max(sq, 0.012) });
          ctx.restore();
        }
        const line = env(t, tFlat + 0.55, tPage + 0.5, 0.15, 0.4);
        if (line > 0) {
          ctx.save(); ctx.fillStyle = `rgba(255,236,200,${line})`; ctx.shadowColor = C.amber; ctx.shadowBlur = 30;
          ctx.fillRect(360, baseY - 3, 1200, 6); ctx.restore();
        }
        const pk = E.outCubic(prog(t, tPage, 0.8));
        if (pk > 0) {
          const ph = 640 * pk, py = lerp(baseY, 190, pk);
          ctx.save(); ctx.beginPath(); ctx.rect(560, py, 800, ph); ctx.clip();
          G.paper(ctx, 560, py, 800, Math.max(ph, 1));
          typeLines(ctx, page, 620, py + 90, 52, t, tPage + 0.3, pageCps, { font: '30px CourierP', color: C.inkText, cursorUntil: S.dur });
          ctx.restore();
        }
        const chips = [[tHard, 'HARD-BOILED'], [tNoir, 'CRIME NOIR'], [t30, '1930s']];
        chips.forEach(([ts, s], i) => G.stamp(ctx, s, i === 1 ? 1600 : (i === 0 ? 330 : 1610), i === 1 ? 420 : (i === 0 ? 560 : 700), t, ts,
          { size: 64, rot: i === 0 ? -0.1 : 0.08, color: i === 2 ? C.amber : C.red }));
      }
    },
  };
};

// ---------------------------------------------------------------- how ----
scenes.how = S => {
  const fx = i => 125 + i * 430, fy = 330, fw = 400, fh = 360;
  const caps = [
    ['THE LEAD', 'SCP-3143 plays a 1930s private eye'],
    ['THE CAST', 'Bystanders become noir characters'],
    ['THE ENDING', 'Case closed: reality snaps back'],
    ['THE AFTERMATH', "Events stay. Memories don't."],
  ];
  const tClosed = S.at(2, 'solved'), tSnap = S.at(2, 'snaps'), tMem = S.at(3, 'remember');
  return {
    transIn: 'blinds',
    sfx: [{ t: 0.4, type: 'projector', dur: S.dur - 0.8 }, ...S.cues.map(c => ({ t: c, type: 'click' })),
      { t: tClosed, type: 'stamp' }, { t: tSnap, type: 'rewind' }],
    music: [{ t: 0, level: 0.55 }],
    draw(ctx, t) {
      bgOffice(ctx, t, { blindsAlpha: 0.08 });
      const hk = E.outCubic(prog(t, 0.2, 0.7));
      txt(ctx, 'HOW IT WORKS', 125, 200, { font: '96px Bebas', color: C.paper, alpha: hk, spacing: 4 });
      ctx.fillStyle = C.amber; ctx.fillRect(127, 222, 260 * hk, 6);
      // film strip
      const sk = E.outCubic(prog(t, 0.1, 0.9));
      ctx.save(); ctx.translate((1 - sk) * W, 0);
      ctx.fillStyle = '#08090b'; ctx.fillRect(0, fy - 60, W, fh + 120);
      ctx.fillStyle = '#1e2026';
      const off = (t * 40) % 60;
      for (let x = -off; x < W; x += 60) { G.rrect(ctx, x, fy - 44, 30, 22, 4); ctx.fill(); G.rrect(ctx, x, fy + fh + 22, 30, 22, 4); ctx.fill(); }
      for (let i = 0; i < 4; i++) {
        const x = fx(i), on = prog(t, S.cues[i] - 0.1, 0.5), act = t >= S.cues[i] - 0.1 && (i === 3 || t < S.cues[i + 1] - 0.1);
        ctx.save();
        ctx.beginPath(); ctx.rect(x, fy, fw, fh); ctx.clip();
        ctx.fillStyle = '#121317'; ctx.fillRect(x, fy, fw, fh);
        if (on > 0) {
          ctx.globalAlpha = E.outCubic(on);
          const g = ctx.createLinearGradient(x, fy, x, fy + fh);
          g.addColorStop(0, '#3a3228'); g.addColorStop(1, '#16130f');
          ctx.fillStyle = g; ctx.fillRect(x, fy, fw, fh);
          drawFrameArt(ctx, i, x, fy, fw, fh, t, S, { tClosed, tSnap, tMem });
        } else {
          txt(ctx, String(i + 1), x + fw / 2, fy + fh / 2 + 50, { font: '160px Bebas', color: '#1d1f24', align: 'center' });
        }
        ctx.restore();
        ctx.strokeStyle = act ? C.amber : '#2a2c32'; ctx.lineWidth = act ? 4 : 2;
        ctx.strokeRect(x, fy, fw, fh);
        const ck = E.outCubic(prog(t, S.cues[i], 0.6));
        txt(ctx, `${i + 1} · ${caps[i][0]}`, x + 4, fy + fh + 140 - (1 - ck) * 20, { font: '50px Bebas', color: act ? C.amber : C.paper, alpha: ck, spacing: 2 });
        wrap(ctx, caps[i][1], fw, '28px CourierP').forEach((ln, j) =>
          txt(ctx, ln, x + 4, fy + fh + 184 + j * 34 - (1 - ck) * 20, { font: '28px CourierP', color: C.grey, alpha: ck }));
      }
      ctx.restore();
    },
  };
};
function drawFrameArt(ctx, i, x, y, w, h, t, S, T) {
  const cx = x + w / 2;
  if (i === 0) {
    G.blinds(ctx, t, { x: cx + 120, y: y - 80, alpha: 0.2, slats: 6, gap: 50, thick: 26, len: 700 });
    G.detective(ctx, cx - 10, y + h - 70, 0.62, { t, rim: 'rgba(240,168,64,0.6)' });
  } else if (i === 1) {
    const k = E.outBack(prog(t, S.cues[1] + 0.9, 0.6));
    const roles = ['THE COP', 'THE DAME', 'THE SNITCH'];
    [-122, 0, 122].forEach((dx, j) => {
      const px = cx + dx, py = y + h - 60;
      const col = k > 0 ? mix('#6d7079', '#050506', clamp(k)) : '#6d7079';
      G.iconPerson(ctx, px, py, 1.15, col);
      if (k > 0) {
        ctx.save(); ctx.globalAlpha = clamp(k); ctx.fillStyle = '#050506';
        if (j === 0) { ctx.fillRect(px - 32, py - 112, 64, 22); ctx.fillRect(px - 40, py - 94, 80, 8); ctx.fillStyle = C.amber; ctx.fillRect(px - 6, py - 106, 12, 10); }
        if (j === 1) { ctx.beginPath(); ctx.ellipse(px, py - 100, 64, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(px, py - 108, 28, Math.PI, 0); ctx.fill(); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(px + 2, py - 74, 5, 0, Math.PI * 2); ctx.fill(); }
        if (j === 2) { ctx.save(); ctx.translate(px, py - 37); ctx.scale(0.42, 0.42); G.hatPath(ctx); ctx.fill(); ctx.restore(); }
        txt(ctx, roles[j], px, y + 60 + (j === 1 ? 36 : 0), { font: '28px Bebas', color: C.amber, align: 'center', alpha: clamp(k) });
        ctx.restore();
      }
    });
  } else if (i === 2) {
    ctx.save(); ctx.translate(cx, y + h / 2 + 10);
    ctx.fillStyle = '#c9a66b'; G.rrect(ctx, -140, -100, 120, 40, 6); ctx.fill();
    ctx.fillStyle = '#d8b67a'; ctx.fillRect(-150, -80, 300, 200);
    txt(ctx, 'CASE FILE', -120, -30, { font: '34px Elite', color: '#3b2a12' });
    ctx.fillStyle = 'rgba(59,42,18,0.4)'; for (let k = 0; k < 4; k++) ctx.fillRect(-120, k * 22, 220 - k * 30, 6);
    ctx.restore();
    G.stamp(ctx, 'CLOSED', cx, y + h / 2 + 40, t, T.tClosed, { size: 70, rot: -0.14 });
    const rk = prog(t, T.tSnap, 0.9);
    if (rk > 0) { // rewind arrow
      ctx.save(); ctx.strokeStyle = C.amber; ctx.lineWidth = 6; ctx.globalAlpha = E.outCubic(rk);
      ctx.beginPath(); ctx.arc(x + w - 70, y + 70, 40, -Math.PI * 0.2, -Math.PI * 0.2 - Math.PI * 1.6 * E.outCubic(rk), true); ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.save(); ctx.translate(cx - 60, y + h - 30);
    ctx.fillStyle = '#050506';
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-60, -110); ctx.bezierCurveTo(-80, -200, -40, -270, 30, -270);
    ctx.bezierCurveTo(100, -270, 120, -210, 110, -170); ctx.lineTo(130, -130); ctx.lineTo(108, -122);
    ctx.lineTo(112, -90); ctx.quadraticCurveTo(90, -70, 60, -80); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    const qk = E.outBack(prog(t, T.tMem - 0.2, 0.6));
    if (qk > 0) {
      ctx.save(); ctx.globalAlpha = clamp(qk);
      ctx.fillStyle = C.paper;
      [[cx + 90, y + 190, 10], [cx + 115, y + 150, 16]].forEach(([bx, by, r]) => { ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.beginPath(); ctx.ellipse(cx + 120, y + 85, 70 * qk, 46 * qk, 0, 0, Math.PI * 2); ctx.fill();
      txt(ctx, '?', cx + 120, y + 106, { font: '64px Abril', color: C.inkText, align: 'center' });
      ctx.restore();
    }
    const ek = E.outCubic(prog(t, S.cues[3] + 0.2, 0.5));
    mark(ctx, 'check', x + 36, y + 38, 20, C.green, ek);
    txt(ctx, 'EVENTS: REAL', x + 58, y + 48, { font: '30px Bebas', color: C.green, alpha: ek, spacing: 1 });
    mark(ctx, 'cross', x + 36, y + 74, 20, C.red, qk > 0 ? clamp(qk) : 0);
    txt(ctx, 'MEMORY: BLANK', x + 58, y + 84, { font: '30px Bebas', color: C.red, alpha: qk > 0 ? clamp(qk) : 0, spacing: 1 });
  }
}

// ---------------------------------------------------------------- pun ----
scenes.pun = S => {
  const tName = S.at(0, 'Murphy') - 0.1, tS = S.at(1, "murphy's"), tQuote = S.at(1, 'anything') - 0.1, tWrong = S.at(1, 'wrong');
  const quote = '“Anything that can go wrong, will.”';
  const qcps = 30;
  const tFall = tQuote + quote.length / qcps + 0.3;
  return {
    transIn: 'blinds',
    sfx: [{ t: tName, type: 'boom' }, { t: tS, type: 'pop' }, { t: tQuote, type: 'type', n: quote.length, cps: qcps }, { t: tFall + 0.35, type: 'clunk' }],
    music: [{ t: 0, level: 0.5 }],
    draw(ctx, t) {
      ctx.fillStyle = '#08090c'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, 420, 30, W / 2, 520, 820);
      g.addColorStop(0, 'rgba(255,220,160,0.20)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      G.rain(ctx, t, 0.25);
      const font = '170px Abril';
      const k = E.outExpo(prog(t, tName, 0.8));
      const sk = E.outBack(prog(t, tS, 0.5));
      const wM = measure(ctx, 'MURPHY', font), wS = measure(ctx, '’S', font), wSp = measure(ctx, ' ', font), wL = measure(ctx, 'L', font), wAW = measure(ctx, 'AW', font);
      const total = wM + wS * clamp(sk) + wSp + wL + wAW;
      let x = W / 2 - total / 2;
      const y = 540;
      ctx.save(); ctx.globalAlpha = k;
      txt(ctx, 'MURPHY', x, y, { font, color: C.paper }); x += wM;
      if (sk > 0) {
        txt(ctx, '’S', x, y - (1 - clamp(sk)) * 120, { font, color: C.red, alpha: clamp(sk * 2) });
        ctx.save(); ctx.globalAlpha *= clamp(sk * 2); ctx.strokeStyle = C.red; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x - 26, y + 70); ctx.lineTo(x, y + 26); ctx.lineTo(x + 26, y + 70); ctx.stroke(); ctx.restore();
        x += wS * clamp(sk);
      }
      x += wSp;
      // the L comes loose: anything that can go wrong...
      const fk = prog(t, tFall, 0.6);
      const ang = fk > 0 ? Math.sin(Math.min(fk, 1) * Math.PI * 0.5) * 0.42 + Math.sin(fk * 14) * 0.05 * (1 - fk) : 0;
      ctx.save(); ctx.translate(x + wL, y); ctx.rotate(ang); txt(ctx, 'L', -wL, 0, { font, color: C.paper }); ctx.restore();
      txt(ctx, 'AW', x + wL, y, { font, color: C.paper });
      ctx.restore();
      typeLines(ctx, [quote], W / 2 - measure(ctx, quote, 'italic 60px CourierP') / 2, 720, 0, t, tQuote, qcps,
        { font: 'italic 60px CourierP', color: C.amber, cursorUntil: tFall });
      if (t > tWrong) txt(ctx, "— MURPHY'S LAW", W / 2, 800, { font: '30px CourierP', color: C.grey, align: 'center', alpha: prog(t, tWrong + 0.3, 0.6) });
    },
  };
};

// -------------------------------------------------------- containment ----
scenes.containment = S => {
  const tUp = S.cues[1] - 0.3;
  const tScan = S.cues[1] + 0.4, tFound = S.at(1, 'Murphy');
  const tDecon = S.at(2, 'deconstruct'), tHunt = S.at(3, 'hunts');
  const words = ['It', 'always', 'rains', 'in', 'this', 'town', 'and', 'Murphy', 'Law', 'is', 'on', 'the', 'case.'];
  return {
    transIn: 'blinds',
    sfx: [{ t: S.cues[0], type: 'boom', gain: 0.6 }, { t: tScan, type: 'scan', dur: tFound - tScan }, { t: tFound, type: 'alert' },
      { t: S.cues[2], type: 'whoosh' }, { t: tDecon, type: 'shatter' }, { t: S.cues[3], type: 'whoosh' }, { t: tHunt, type: 'lock' }],
    music: [{ t: 0, level: 0.55 }],
    draw(ctx, t) {
      bgOffice(ctx, t, { noir: 0.4 });
      const uk = E.inOutCubic(prog(t, tUp, 0.8));
      const hk = E.outCubic(prog(t, S.cues[0] - 0.1, 0.6));
      const size = lerp(120, 66, uk), hy = lerp(560, 150, uk);
      txt(ctx, 'HOW DO YOU CONTAIN A STORY?', W / 2, hy, { font: `${size}px Bebas`, color: C.paper, align: 'center', alpha: hk, spacing: 3 });
      txt(ctx, 'SPECIAL CONTAINMENT PROCEDURES', W / 2, hy + 50, { font: '28px Elite', color: C.amber, align: 'center', alpha: uk });
      const cols = [360, 960, 1560];
      cols.forEach((cx, i) => {
        const r = rise(t, S.cues[i + 1] - 0.2, 0.7, 60);
        if (r.a <= 0) return;
        ctx.save(); ctx.globalAlpha = r.a; ctx.translate(0, r.dy);
        const x = cx - 260, y = 250, w = 520, h = 640;
        panel(ctx, x, y, w, h);
        const titles = [['I/O-ISMETA', 'Foundation bot'], ['PATAPHYSICS DEPT.', 'Experts in the logic of fiction'], ['MTF IOTA-10', '"Damn Freds"']];
        const capt = ['Scans online fiction communities for Murphy', 'Sent in to deconstruct him', 'Hunts for SCP-3143-A, his author'];
        txt(ctx, titles[i][0], cx, y + 78, { font: '62px Bebas', color: C.amber, align: 'center', spacing: 2 });
        txt(ctx, titles[i][1], cx, y + 118, { font: fitFont(ctx, titles[i][1], 470, 28, 'CourierP'), color: C.grey, align: 'center' });
        wrap(ctx, capt[i], 440, '30px CourierP').forEach((ln, j) => txt(ctx, ln, cx, y + h - 74 + j * 36, { font: '30px CourierP', color: C.paper, align: 'center' }));
        if (i === 0) artScanner(ctx, cx, y + 330, t, tScan, tFound);
        if (i === 1) { ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 140, w - 12, h - 240); ctx.clip(); artDecon(ctx, cx, y + 330, t, words, tDecon); ctx.restore(); }
        if (i === 2) artHunt(ctx, cx, y + 330, t, tHunt);
        ctx.restore();
      });
    },
  };
};
function artScanner(ctx, cx, cy, t, tScan, tFound) {
  ctx.save();
  ctx.fillStyle = '#0b0d10'; ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 4;
  G.rrect(ctx, cx - 200, cy - 140, 400, 270, 12); ctx.fill(); ctx.stroke();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = cx - 180 + c * 92, y = cy - 120 + r * 82, hit = r === 1 && c === 2 && t > tFound;
    const pulse = hit ? 0.6 + 0.4 * Math.sin(t * 10) : 0;
    ctx.fillStyle = hit ? `rgba(211,58,44,${0.35 + pulse * 0.4})` : '#171a1f';
    G.rrect(ctx, x, y, 80, 70, 6); ctx.fill();
    ctx.fillStyle = hit ? C.white : '#2c3038';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 10, y + 16 + k * 16, 60 - k * 14, 6);
    if (hit) { ctx.strokeStyle = C.red; ctx.lineWidth = 3; G.rrect(ctx, x - 4, y - 4, 88, 78, 8); ctx.stroke(); }
  }
  if (t > tScan && t < tFound + 0.3) {
    const sy = cy - 140 + ((t - tScan) * 300) % 270;
    const g = ctx.createLinearGradient(0, sy - 40, 0, sy);
    g.addColorStop(0, 'rgba(240,168,64,0)'); g.addColorStop(1, 'rgba(240,168,64,0.35)');
    ctx.fillStyle = g; ctx.fillRect(cx - 196, sy - 40, 392, 40);
    ctx.fillStyle = C.amber; ctx.fillRect(cx - 196, sy, 392, 3);
  }
  if (t > tFound) txt(ctx, 'MURPHY DETECTED', cx, cy + 170, { font: '34px Bebas', color: C.red, align: 'center', spacing: 3, alpha: 0.6 + 0.4 * Math.sin(t * 10) });
  ctx.restore();
}
function artDecon(ctx, cx, cy, t, words, tDecon) {
  const font = '30px CourierP', lines = [[0, 6], [6, 10], [10, 13]];
  const k = prog(t, tDecon - 0.2, 1.6);
  ctx.save();
  lines.forEach(([a, b], li) => {
    const ws = words.slice(a, b), lineW = measure(ctx, ws.join(' '), font);
    let x = cx - lineW / 2;
    ws.forEach((w, j) => {
      const id = a + j, ww = measure(ctx, w, font);
      const dx = (hash(id) - 0.5) * 200 * E.outCubic(k), dy = (hash(id + 40) - 0.5) * 200 * E.outCubic(k);
      const rot = (hash(id + 80) - 0.5) * 1.4 * E.outCubic(k);
      ctx.save(); ctx.translate(x + ww / 2 + dx, cy - 70 + li * 54 + dy); ctx.rotate(rot);
      txt(ctx, w, 0, 0, { font, color: C.paper, align: 'center', alpha: 1 - k * 0.5 });
      ctx.restore();
      x += ww + measure(ctx, ' ', font);
    });
  });
  const sk = E.inOutCubic(prog(t, tDecon - 0.7, 0.5));
  if (sk > 0 && k < 0.3) { // red pen strike before the words fly apart
    ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let li = 0; li < 3; li++) { ctx.beginPath(); ctx.moveTo(cx - 200, cy - 80 + li * 54); ctx.lineTo(cx - 200 + 400 * sk, cy - 84 + li * 54 + 6); ctx.stroke(); }
  }
  ctx.restore();
}
function artHunt(ctx, cx, cy, t, tHunt) {
  G.iconBadge(ctx, cx - 130, cy - 10, 0.95);
  ctx.save();
  G.paper(ctx, cx - 10, cy - 110, 200, 220);
  G.iconPerson(ctx, cx + 90, cy + 40, 0.9, '#3b3a37');
  txt(ctx, 'SCP-3143-A', cx + 90, cy + 92, { font: '28px Bebas', color: C.inkText, align: 'center', spacing: 2 });
  const k = E.outCubic(prog(t, tHunt - 0.4, 0.8));
  const tx = lerp(cx + 230, cx + 90, k), ty = lerp(cy - 160, cy - 10, k);
  ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.globalAlpha = k;
  ctx.beginPath(); ctx.arc(tx, ty, 58, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx - 80, ty); ctx.lineTo(tx - 30, ty); ctx.moveTo(tx + 30, ty); ctx.lineTo(tx + 80, ty);
  ctx.moveTo(tx, ty - 80); ctx.lineTo(tx, ty - 30); ctx.moveTo(tx, ty + 30); ctx.lineTo(tx, ty + 80); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ history ----
scenes.history = S => {
  const t05 = S.at(0, '2005') - 0.15, tBreach = S.at(0, 'containment'), t12 = S.at(1, '2012') - 0.15;
  const x0 = 180, x1 = 640, x2 = 1300, x3 = 1740, y = 600;
  return {
    transIn: 'blinds',
    sfx: [{ t: t05, type: 'pop' }, { t: tBreach, type: 'siren' }, { t: t12, type: 'pop' }],
    music: [{ t: 0, level: 0.5 }],
    draw(ctx, t) {
      bgNight(ctx, { top: '#0d1118', bottom: '#06070a' });
      txt(ctx, 'TIMELINE', 120, 150, { font: '60px Bebas', color: C.grey, spacing: 6, alpha: prog(t, 0.2, 0.6) });
      const siren = env(t, tBreach, S.cues[1] + 0.5, 0.2, 0.8);
      if (siren > 0) {
        const p = 0.5 + 0.5 * Math.sin(t * 9);
        const g = ctx.createRadialGradient(x1, y, 10, x1, y, 620);
        g.addColorStop(0, `rgba(211,58,44,${0.35 * siren * p})`); g.addColorStop(1, 'rgba(211,58,44,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      const a = E.inOutCubic(prog(t, 0.3, t05 - 0.3));
      const b = E.inOutCubic(prog(t, S.cues[1] - 0.1, t12 - S.cues[1] + 0.1));
      const c = E.inOutCubic(prog(t, t12 + 1.0, 1.4));
      ctx.strokeStyle = C.paper; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, a), y);
      if (b > 0) ctx.lineTo(lerp(x1, x2, b), y);
      if (c > 0) ctx.lineTo(lerp(x2, x3, c), y);
      ctx.stroke();
      if (c > 0.95) { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.moveTo(x3 + 22, y); ctx.lineTo(x3 - 4, y - 14); ctx.lineTo(x3 - 4, y + 14); ctx.closePath(); ctx.fill(); }
      [[x1, t05, '2005', 'First noted after a containment breach at Site-95.'],
        [x2, t12, '2012', 'Pataphysics Dept. + Dept. of Analytics make contact.']].forEach(([x, ts, yr, s]) => {
        const k = E.outBack(prog(t, ts, 0.5));
        if (k <= 0) return;
        ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x, y, 16 * k, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = C.amber; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 28 * k, 0, Math.PI * 2); ctx.stroke();
        const r = rise(t, ts + 0.1, 0.7, 30);
        txt(ctx, yr, x, 500 + r.dy, { font: '170px Bebas', color: C.amber, align: 'center', alpha: r.a, spacing: 4 });
        wrap(ctx, s, 520, '34px CourierP').forEach((ln, j) => txt(ctx, ln, x, 690 + j * 44 + r.dy, { font: '34px CourierP', color: C.paper, align: 'center', alpha: r.a }));
      });
      G.rain(ctx, t, 0.2);
    },
  };
};

// ------------------------------------------------------ interview 001 ----
const SCRIPT_A = [
  ['INT. MURPHY LAW DETECTIVE AGENCY - NIGHT', 'b'], [''],
  ['The door to the office flies open. An old'], ['man in a lab-coat enters… This is DR. THAUM.'], [''],
  ['                 DR. THAUM'], ['        Hello, SCP-3143. How are you'], ['        doing, today?'], [''],
];
const SCRIPT_B = [
  ['                 MURPHY'], ['        Give me one good reason why I'], ["        shouldn't ventilate you right"], ['        now, doc.'], [''],
  ['                 DR. THAUM'], ["        Because you can't."], [''],
  ['                 DR. THAUM'], ['        You do know that I can hear'], ['        you narrating, right?'],
];
const TRANSCRIPT = [
  ["SCP-3143: What's going on?!"], ['DR. THAUM: And on top of it all, your name'], ['           is based on an absurdly contrived'], ['           pun.'],
  ['SCP-3143: What are you doing?!'], ["DR. THAUM: I'm deconstructing you,"], ["           SCP-3143. I'm containing you."],
  ["SCP-3143: I… I don't understand…"], ["DR. THAUM: I'd like to speak with the"], ['           author, please. Mr. Lawden?'], ['           Are you there?'],
  ['SCP-3143-A: How…?'],
];
function drawScript(ctx, lines, x, y, lh, alpha, o = {}) {
  lines.forEach(([s, b], i) => {
    if (o.upTo !== undefined && i >= o.upTo) return;
    txt(ctx, s, x, y + i * lh, { font: `${b ? 'bold ' : ''}29px CourierP`, color: C.inkText, alpha });
  });
}
scenes.int001 = S => {
  const P = 'SCP:/3143/interviews/001.log';
  const tAcc = 0.25, tPage = 0.8;
  const tCard = S.at(0, 'Thaddeus') - 0.2, tB = S.cues[1] - 0.1, tGun = S.at(1, '44'), tHear = S.at(1, 'hear') - 0.5;
  const tCrit = S.cues[2], tX = [S.at(2, 'proper'), S.at(2, 'doomed'), S.at(2, 'moral')];
  const tQ = S.cues[3], tIcons = [S.at(3, 'suit'), S.at(3, 'hat'), S.at(3, 'drinking')];
  const tCollapse = S.at(4, 'collapses'), tGone = S.at(4, 'gone');
  const tId = S.cues[5] - 0.1, tShoe = S.at(5, 'shoe'), tJersey = S.at(5, 'jersey'), tCats = S.at(5, 'cats'), tCover = S.cues[6] - 0.1;
  const px = 110, py = 160, pw = 900, ph = 870;
  return {
    transIn: 'blinds',
    sfx: [accessSfx(tAcc, P), { t: tPage, type: 'paper' }, { t: tCard, type: 'whoosh', gain: 0.5 }, { t: tGun, type: 'cock' },
      ...tX.map(x => ({ t: x, type: 'scribble' })), ...tIcons.map(x => ({ t: x, type: 'pop' })),
      { t: tCollapse, type: 'glitch' }, { t: tGone + 0.2, type: 'stamp' }, { t: tId, type: 'paper' },
      { t: tCover, type: 'paper' }],
    music: [{ t: 0, level: 0.45 }, { t: tCollapse - 0.2, level: 0.0 }, { t: tId, level: 0.35 }],
    draw(ctx, t) {
      const noir = 1 - E.inOutCubic(prog(t, tCollapse, 0.6));
      bgOffice(ctx, t, { noir, blindsX: W * 0.35 });
      if (noir > 0) G.rain(ctx, t, 0.12 * noir);
      access(ctx, t, tAcc, P);
      // the page
      const pr = rise(t, tPage, 0.7, 120);
      if (pr.a > 0) {
        ctx.save(); ctx.globalAlpha = pr.a; ctx.translate(0, pr.dy);
        G.paper(ctx, px, py, pw, ph, { rot: -0.008 });
        const lh = 38, x = px + 56, y = py + 72;
        const before = t < tCollapse + 0.05;
        if (before) {
          drawScript(ctx, SCRIPT_A, x, y, lh, 1);
          const kB = clamp((t - tB) / 0.05);
          const shown = t < tHear ? 7 : SCRIPT_B.length;
          if (kB > 0) drawScript(ctx, SCRIPT_B, x, y + SCRIPT_A.length * lh, lh, 1, { upTo: t < tB ? 0 : shown });
          // red-pen critique
          tX.forEach((tx, i) => {
            const k = E.inOutCubic(prog(t, tx, 0.35));
            if (k <= 0) return;
            const ly = [y + 2 * lh - 10, y + 10 * lh - 10, y + 18 * lh - 10][i];
            ctx.save(); ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 10, ly); for (let s = 0; s <= 1.0001; s += 0.05) ctx.lineTo(x - 10 + 760 * s * k, ly + Math.sin(s * 40) * 6); ctx.stroke();
            ctx.restore();
          });
          if (t > tX[0]) txt(ctx, 'NOT NOIR.', px + pw - 250, py + 50, { font: '42px Elite', color: C.red, alpha: prog(t, tX[0], 0.3) });
        } else {
          drawScript(ctx, [['INTERVIEW LOG · 2012/02/02', 'b'], ['']].concat(TRANSCRIPT), x, y, lh, 1);
        }
        ctx.restore();
      }
      G.stamp(ctx, 'DECONSTRUCTED', px + pw / 2, py + ph - 150, t, tGone, { size: 90, rot: -0.08 });
      // right column
      const RX = 1090, RW = 760;
      const cardA = env(t, tCard, tCrit + 0.05, 0.5, 0.35);
      if (cardA > 0) {
        panel(ctx, RX, 160, RW, 360, { alpha: cardA });
        ctx.save(); ctx.globalAlpha = cardA;
        ctx.save(); G.rrect(ctx, RX, 160, RW, 360, 10); ctx.clip(); thaumBust(ctx, RX + 130, 520, 1.25); ctx.restore();
        txt(ctx, 'DR. THADDEUS THAUM', RX + 262, 236, { font: '52px Bebas', color: C.amber, spacing: 2 });
        ['Pataphysics Department', 'Degree in English Literature', 'Specialty: analysis of fiction'].forEach((s, i) =>
          txt(ctx, s, RX + 264, 300 + i * 50, { font: '26px CourierP', color: C.paper }));
        ctx.restore();
      }
      const qA = env(t, tHear, tCrit + 0.05, 0.5, 0.35);
      if (qA > 0) {
        ctx.save(); ctx.globalAlpha = qA;
        txt(ctx, '“You do know that I can hear', RX + 10, 660, { font: 'italic 52px PlayfairI', color: C.white });
        txt(ctx, 'you narrating, right?”', RX + 10, 730, { font: 'italic 52px PlayfairI', color: C.white });
        txt(ctx, '— DR. THAUM', RX + 12, 790, { font: '28px CourierP', color: C.grey });
        ctx.restore();
      }
      const critA = env(t, tCrit + 0.1, tCollapse, 0.4, 0.3);
      if (critA > 0) {
        ctx.save(); ctx.globalAlpha = critA;
        txt(ctx, "THAUM'S REVIEW", RX + 10, 210, { font: '40px Bebas', color: C.grey, spacing: 5 });
        ['NOT PROPER NOIR', 'NO DOOMED ANTI-HERO', 'NO MORAL GREY'].forEach((s, i) => {
          const k = E.outBack(prog(t, tX[i], 0.4));
          if (k <= 0) return;
          mark(ctx, 'cross', RX + 32, 268 + i * 74, 34, C.red, clamp(k));
          txt(ctx, s, RX + 70 - (1 - clamp(k)) * 30, 290 + i * 74, { font: '60px Bebas', color: C.paper, alpha: clamp(k), spacing: 1 });
        });
        const qk = rise(t, tQ - 0.1, 0.6, 20);
        txt(ctx, '“…fantasy escapism dressed up in', RX + 10, 600 + qk.dy, { font: 'italic 44px PlayfairI', color: C.white, alpha: qk.a });
        txt(ctx, 'a suit, a hat, and a drinking habit.”', RX + 10, 660 + qk.dy, { font: 'italic 44px PlayfairI', color: C.white, alpha: qk.a });
        const fns = [G.iconSuit, G.iconHat, G.iconGlass];
        fns.forEach((fn, i) => {
          const k = E.outBack(prog(t, tIcons[i], 0.45));
          if (k <= 0) return;
          ctx.save(); ctx.globalAlpha *= clamp(k);
          const ix = RX + 110 + i * 220, iy = 800;
          ctx.translate(ix, iy); ctx.scale(k, k); ctx.translate(-ix, -iy);
          if (i === 1) fn(ctx, ix, iy + 30, 0.5); else fn(ctx, ix, iy, 0.85);
          ctx.restore();
        });
        ctx.restore();
      }
      // SCP-3143-A ID card + the script that started it
      const idA = rise(t, tId, 0.6, 40);
      if (idA.a > 0) {
        ctx.save(); ctx.globalAlpha = idA.a; ctx.translate(0, idA.dy);
        panel(ctx, RX, 160, RW, 470, { fill: 'rgba(235,227,207,0.97)', stroke: 'rgba(0,0,0,0)' });
        ctx.fillStyle = C.redDark; ctx.fillRect(RX, 160, RW, 70);
        txt(ctx, 'SCP-3143-A  ·  SUBJECT FILE', RX + 30, 208, { font: '40px Bebas', color: C.white, spacing: 3 });
        txt(ctx, 'MURPHY LAWDEN', RX + 30, 310, { font: '86px Bebas', color: C.inkText, spacing: 2 });
        const rows = [[tShoe, 'Retired shoe salesman', 'shoe'], [tJersey, 'New Jersey', 'pin'], [tCats, 'Lives alone with two cats', 'cats']];
        rows.forEach(([ts, s, ic], i) => {
          const k = E.outCubic(prog(t, ts - 0.1, 0.4));
          if (k <= 0) return;
          const yy = 390 + i * 78;
          ctx.save(); ctx.globalAlpha *= k;
          if (ic === 'shoe') G.iconShoe(ctx, RX + 70, yy - 6, 0.42, C.inkText);
          if (ic === 'pin') { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(RX + 70, yy - 22, 14, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(RX + 58, yy - 16); ctx.lineTo(RX + 70, yy + 8); ctx.lineTo(RX + 82, yy - 16); ctx.fill(); }
          if (ic === 'cats') { G.iconCat(ctx, RX + 52, yy - 4, 0.36, C.inkText); G.iconCat(ctx, RX + 92, yy - 4, 0.3, C.inkText); }
          txt(ctx, s, RX + 130, yy, { font: '34px CourierP', color: C.inkText });
          ctx.restore();
        });
        ctx.restore();
      }
      const cv = rise(t, tCover, 0.7, 80);
      if (cv.a > 0) {
        ctx.save(); ctx.globalAlpha = cv.a; ctx.translate(0, cv.dy);
        G.paper(ctx, RX + 150, 600, 470, 400, { rot: 0.035, color: '#e6dcc2' });
        ctx.translate(RX + 385, 800); ctx.rotate(0.035);
        txt(ctx, 'IT ALWAYS RAINS', 0, -70, { font: '54px Elite', color: C.inkText, align: 'center' });
        txt(ctx, 'a screenplay by', 0, -10, { font: '26px CourierP', color: '#5a5245', align: 'center' });
        txt(ctx, 'Murphy Lawden', 0, 28, { font: '30px CourierP', color: C.inkText, align: 'center' });
        txt(ctx, '(unfinished)', 0, 120, { font: 'italic 26px CourierP', color: C.red, align: 'center' });
        ctx.restore();
      }
      const gk = env(t, tCollapse - 0.15, tCollapse + 0.7, 0.1, 0.5);
      if (gk > 0) G.glitch(ctx, gk, Math.floor(t * 20));
    },
  };
};

// ------------------------------------------------------ interview 002 ----
scenes.int002 = S => {
  const P = 'SCP:/3143/interviews/002.log';
  const q = 'SUBJECT:   Did you, uh… did you think it was any good?';
  const tAcc = 0.2, tQ = S.at(0, 'question'), qcps = 30;
  const tSil = S.cues[0] + S.durs[0] + 0.15, tAwful = S.cues[1] - 0.05, tOh = S.cues[1] + S.durs[1] + 0.5;
  return {
    transIn: 'blinds',
    sfx: [accessSfx(tAcc, P), { t: tQ, type: 'type', n: q.length, cps: qcps }, { t: tSil + 0.3, type: 'tick' }, { t: tSil + 0.8, type: 'tick' }, { t: tSil + 1.3, type: 'tick' },
      { t: tAwful, type: 'boom' }],
    music: [{ t: 0, level: 0.35 }, { t: tSil - 0.2, level: 0.0 }, { t: tOh, level: 0.35 }],
    draw(ctx, t) {
      const shake = t > tAwful && t < tAwful + 0.4 ? (hash(Math.floor(t * 60)) - 0.5) * 18 * (1 - prog(t, tAwful, 0.4)) : 0;
      ctx.save(); ctx.translate(shake, shake * 0.5);
      bgOffice(ctx, t, { noir: 0 });
      access(ctx, t, tAcc, P);
      txt(ctx, 'DATE: 2012/02/03   INTERVIEWER: DR. THAUM   SUBJECT: SCP-3143-A', 120, 150, { font: '26px CourierP', color: C.grey, alpha: prog(t, 0.9, 0.5) });
      typeLines(ctx, [q], 220, 400, 0, t, tQ, qcps, { font: '40px CourierP', color: C.paper, cursorUntil: tSil });
      txt(ctx, '(Silence.)', 460, 480, { font: 'italic 40px CourierP', color: C.grey, alpha: prog(t, tSil, 0.4) });
      const k = E.outExpo(prog(t, tAwful, 0.5));
      if (k > 0) {
        txt(ctx, 'DR. THAUM:', 220, 600, { font: '40px CourierP', color: C.paper, alpha: k });
        const s = 1 + (1 - k) * 0.6;
        ctx.save(); ctx.translate(W / 2, 760); ctx.scale(s, s);
        txt(ctx, '“It was fairly awful.”', 0, 0, { font: '120px Abril', color: C.white, align: 'center', alpha: k });
        ctx.restore();
      }
      typeLines(ctx, ['SUBJECT:   Oh.'], 220, 940, 0, t, tOh, 14, { font: '40px CourierP', color: C.paper, cursorUntil: S.dur });
      ctx.restore();
    },
  };
};

// ------------------------------------------------------ interview 018 ----
scenes.int018 = S => {
  const P = 'SCP:/3143/interviews/018.log';
  const tAcc = 0.2;
  const tChips = [S.at(0, 'stopped'), S.at(0, 'pencils'), S.at(0, 'writing')];
  const tWhy = S.cues[1] - 0.1;
  const why = ['SUBJECT: Why did you have to stop the story?', '         What was the problem? He was helping', '         people. It was fun.'];
  const tTurn = S.cues[2], tTerms = S.at(2, 'terms'), tTitles = S.at(2, 'titles'), tLogs = S.at(2, 'interview');
  const tPeel = S.cues[3] + 0.2, tSnap = S.cues[4] + 0.1, tMurphy = S.at(4, "murphy");
  const tLine = S.cues[5] - 0.1, tDime = S.at(5, 'dime'), tToss = S.at(6, 'tosses'), tLight = S.at(6, 'lights'), tWalk = S.at(6, 'walks') - 0.3;
  const quoteText = 'When it comes right down to it, me — them — hell, even you — we\'re all just characters in that trashy dime-store novel called life.';
  return {
    transIn: 'blinds',
    sfx: [accessSfx(tAcc, P), ...tChips.map(x => ({ t: x, type: 'pop' })), { t: tWhy, type: 'type', n: why.join('').length, cps: 48 },
      { t: tTurn, type: 'boom', gain: 0.6 }, { t: tTerms, type: 'pop' }, { t: tTitles, type: 'pop' }, { t: tLogs, type: 'pop' },
      { t: tPeel, type: 'fall' }, { t: tSnap, type: 'glitch' }, { t: tMurphy, type: 'boom' },
      { t: tToss, type: 'thud' }, { t: tLight, type: 'lighter' }, { t: S.dur - 1.2, type: 'door' }],
    music: [{ t: 0, level: 0.3 }, { t: tTurn, level: 0.55 }, { t: tSnap, level: 0.85 }],
    draw(ctx, t) {
      const noir = E.inOutCubic(prog(t, tSnap, 0.8));
      bgOffice(ctx, t, { noir, blindsX: W * 0.55 });
      if (noir > 0) G.rain(ctx, t, 0.22 * noir);
      const room = 1 - prog(t, tSnap - 0.4, 0.4);
      if (room > 0) interrogation(ctx, t, room);
      // Foundation UI: these are the "trappings" that peel away
      const peel = prog(t, tPeel, 1.2);
      const fall = (i) => peel > 0 ? { dy: E.inCubic(clamp(peel * 1.3 - i * 0.12)) * 1100, rot: E.inCubic(clamp(peel * 1.3 - i * 0.12)) * (i % 2 ? 0.5 : -0.4) } : { dy: 0, rot: 0 };
      const uiA = 1 - prog(t, tPeel + 1.0, 0.3);
      if (uiA > 0) {
        ctx.save(); ctx.globalAlpha = uiA;
        const f0 = fall(0);
        ctx.save(); ctx.translate(120, 104 + f0.dy); ctx.rotate(f0.rot); access(ctx, t, tAcc, P, { x: 0, y: 0 }); ctx.restore();
        const parts = [['INTERVIEW LOG', 120], ['INTERVIEWER: DR. THAUM', 420], ['SUBJECT: SCP-3143-A', 890]];
        parts.forEach(([s, x], i) => {
          const f = fall(i + 1);
          ctx.save(); ctx.translate(x, 160 + f.dy); ctx.rotate(f.rot);
          txt(ctx, s, 0, 0, { font: '30px CourierP', color: C.paper, alpha: prog(t, 0.9, 0.5) });
          ctx.restore();
        });
        // highlight tags on the trappings
        const m = s => measure(ctx, s, '30px CourierP');
        const tags = [[tTerms, 'TERMS', 890 + m('SUBJECT: '), 160, m('SCP-3143-A')], [tTitles, 'TITLES', 420 + m('INTERVIEWER: '), 160, m('DR.')],
          [tLogs, 'INTERVIEW LOGS', 120, 160, m('INTERVIEW LOG')]];
        tags.forEach(([ts, label, x, y, w], i) => {
          const k = E.outBack(prog(t, ts, 0.4)), f = fall(i + 1);
          if (k <= 0) return;
          ctx.save(); ctx.translate(0, f.dy); ctx.globalAlpha *= clamp(k);
          ctx.strokeStyle = C.amber; ctx.lineWidth = 3; G.rrect(ctx, x - 10, y - 34, w + 20, 46, 6); ctx.stroke();
          ctx.fillStyle = C.amber; G.rrect(ctx, x - 10, y + 22, measure(ctx, label, '28px Bebas', 2) + 24, 38, 5); ctx.fill();
          txt(ctx, label, x + 2, y + 52, { font: '28px Bebas', color: C.ink, spacing: 2 });
          ctx.restore();
        });
        // status chips + Lawden's complaint
        const chips = ['NOT EATING', 'PENCILS CONFISCATED', 'STILL WRITING ABOUT MURPHY'];
        chips.forEach((s, i) => {
          const k = E.outBack(prog(t, tChips[i], 0.45)), f = fall(4 + i);
          if (k <= 0) return;
          ctx.save(); ctx.translate(120, 300 + i * 84 + f.dy); ctx.rotate(f.rot); ctx.globalAlpha *= clamp(k);
          const w = measure(ctx, s, '40px Bebas', 2) + 40;
          ctx.fillStyle = 'rgba(211,58,44,0.18)'; ctx.strokeStyle = C.red; ctx.lineWidth = 2;
          G.rrect(ctx, 0, -44, w, 62, 8); ctx.fill(); ctx.stroke();
          txt(ctx, s, 20, 2, { font: '40px Bebas', color: C.paper, spacing: 2 });
          ctx.restore();
        });
        const wk = 1 - prog(t, tTurn - 0.2, 0.4);
        if (wk > 0) {
          ctx.save(); ctx.globalAlpha *= wk;
          typeLines(ctx, why, 120, 640, 54, t, tWhy, 48, { font: '40px CourierP', color: C.paper, cursorUntil: tTurn });
          ctx.restore();
        }
        ctx.restore();
      }
      // the turn: Lawden's critique of the Foundation
      const tq = env(t, tTurn - 0.1, tSnap, 0.4, 0.2);
      if (tq > 0) {
        ctx.save(); ctx.globalAlpha = tq;
        const L = ['“You cloak yourself in the outward', '‘trappings’ of science — the terms,', 'the titles, the ‘interview logs’…”'];
        L.forEach((s, i) => txt(ctx, s, 120, 560 + i * 74, { font: 'italic 58px PlayfairI', color: C.white }));
        txt(ctx, '— SUBJECT', 124, 800, { font: '30px CourierP', color: C.grey });
        ctx.restore();
      }
      // SUBJECT → MURPHY
      const lk = env(t, tSnap - 0.05, tLine + 0.2, 0.1, 0.3);
      if (lk > 0) {
        const isM = t > tMurphy - 0.25;
        const g = t > tSnap && t < tMurphy;
        txt(ctx, isM ? 'MURPHY' : 'SUBJECT:', W / 2 + (g ? (hash(Math.floor(t * 30)) - 0.5) * 30 : 0), 600,
          { font: '220px Bebas', color: isM ? C.amber : C.paper, align: 'center', alpha: lk, spacing: 10, glow: isM ? 'rgba(240,168,64,0.5)' : undefined, glowBlur: 40 });
      }
      // the line
      const qa = env(t, tLine, tToss - 0.1, 0.5, 0.4);
      if (qa > 0) {
        ctx.save(); ctx.globalAlpha = qa;
        txt(ctx, 'NARRATOR', W / 2, 250, { font: '34px CourierP', color: C.grey, align: 'center', spacing: 6 });
        const Lq = layout(ctx, quoteText, 'italic 64px PlayfairI', 1500, 92);
        const x0 = W / 2 - 750, y0 = 380;
        highlight(ctx, Lq, x0, y0, findPhrase(Lq, 'even you'), prog(t, tLine + 0.3, 0.4), 'rgba(211,58,44,0.45)');
        highlight(ctx, Lq, x0, y0, findPhrase(Lq, 'dime-store novel called life.'), prog(t, tDime - 0.2, 0.9));
        drawLayout(ctx, Lq, x0, y0, { color: C.white });
        ctx.restore();
      }
      // exit
      const ea = prog(t, tToss - 0.3, 0.4);
      if (ea > 0) {
        ctx.save(); ctx.globalAlpha = ea;
        const doorX = 1520, doorW = 210 * (1 - E.inOutCubic(prog(t, S.dur - 1.2, 0.6)));
        const g = ctx.createLinearGradient(doorX, 0, doorX + 210, 0);
        g.addColorStop(0, 'rgba(255,214,150,0.95)'); g.addColorStop(1, 'rgba(255,190,110,0.8)');
        ctx.fillStyle = g; ctx.fillRect(doorX, 420, doorW, 520);
        ctx.fillStyle = 'rgba(255,200,130,0.10)';
        ctx.beginPath(); ctx.moveTo(doorX, 940); ctx.lineTo(doorX + doorW, 940); ctx.lineTo(doorX + doorW + 300, 1080); ctx.lineTo(doorX - 500, 1080); ctx.closePath(); ctx.fill();
        const tk = E.inCubic(prog(t, tToss, 0.5));
        labCoat(ctx, 520 - tk * 160, 940 + tk * 80, 0.95, { rot: -tk * 1.2, alpha: 1 - prog(t, tToss + 0.5, 0.5) });
        const wk = prog(t, tWalk, S.dur - 1.1 - tWalk);
        const mx = lerp(760, doorX + 105, E.inOutSine(wk));
        G.detectiveFull(ctx, mx, 940, 0.92, { walk: (t - tWalk) * 7, walkAmt: wk > 0 && wk < 1 ? 1 : 0, alpha: 1 - prog(t, S.dur - 1.3, 0.3) });
        const fk = env(t, tLight, tLight + 1.0, 0.05, 0.6);
        if (fk > 0) {
          const fx = mx + 34, fy = 940 - 0.92 * 500;
          const gg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 90);
          gg.addColorStop(0, `rgba(255,190,90,${0.85 * fk})`); gg.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fx, fy, 90, 0, Math.PI * 2); ctx.fill();
        }
        if (t > tLight) G.smoke(ctx, mx + 30, 940 - 0.92 * 495, t, { rise: 200, size: 30, alpha: 0.07 });
        ctx.restore();
      }
      const gk = env(t, tSnap - 0.1, tSnap + 0.7, 0.1, 0.5);
      if (gk > 0) G.glitch(ctx, gk, Math.floor(t * 20) + 7);
    },
  };
};

function interrogation(ctx, t, a) {
  ctx.save(); ctx.globalAlpha = a;
  const cx = 1460;
  const cone = ctx.createLinearGradient(0, 330, 0, 900);
  cone.addColorStop(0, 'rgba(210,225,240,0.20)'); cone.addColorStop(1, 'rgba(210,225,240,0.03)');
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(cx - 40, 330); ctx.lineTo(cx + 40, 330); ctx.lineTo(cx + 330, 900); ctx.lineTo(cx - 330, 900); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a404a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 300); ctx.stroke();
  ctx.fillStyle = '#2b3038'; ctx.beginPath(); ctx.moveTo(cx - 30, 300); ctx.lineTo(cx + 30, 300); ctx.lineTo(cx + 60, 336); ctx.lineTo(cx - 60, 336); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(235,240,245,0.9)'; ctx.fillRect(cx - 40, 334, 80, 4);
  // Lawden, hunched over the table
  const bob = Math.sin(t * 0.8) * 3;
  ctx.fillStyle = '#3d444f';
  ctx.beginPath(); ctx.moveTo(cx - 150, 830); ctx.quadraticCurveTo(cx - 150, 660 + bob, cx - 10, 650 + bob); ctx.quadraticCurveTo(cx + 140, 660 + bob, cx + 150, 830); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 6, 640 + bob, 44, 52, 0.25, 0, Math.PI * 2); ctx.fill();
  // table, empty plate, blank page
  ctx.fillStyle = '#262a31'; ctx.beginPath(); ctx.moveTo(cx - 330, 800); ctx.lineTo(cx + 330, 800); ctx.lineTo(cx + 380, 870); ctx.lineTo(cx - 380, 870); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b1e23'; ctx.fillRect(cx - 380, 870, 760, 20);
  ctx.strokeStyle = '#8d9199'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx - 180, 832, 58, 14, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(235,227,207,0.8)'; ctx.beginPath(); ctx.moveTo(cx + 120, 815); ctx.lineTo(cx + 230, 815); ctx.lineTo(cx + 250, 850); ctx.lineTo(cx + 110, 850); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// --------------------------------------------------------------- twist ----
const EMAIL = [
  'It might not have worked, but this was nevertheless an excellent test-run for ‘Dr. Thaum’ and the ‘Pataphysics Department’. […] it’s not like a fictitious department with fictitious employees has a costly upkeep.',
  'Otherwise, leave the article as is. It might contain several inconsistencies (the fact that neither Murphy Lawden nor It Always Rains actually exist being the most glaring) […]',
  'Let’s leave SCP-3143 alone for a while. Yes, we’ve learned quite a bit about him, but he’s also learned quite a bit about us. […] it sounds like he thinks we’re all just as fictitious as he is.',
  'On a final note: SCP-423 is currently missing.',
].join('\n');
scenes.twist = S => {
  const P = 'SCP:/3143/files/email001.log';
  const tAcc = S.cues[0] + 0.6, tMail = S.cues[1] - 0.2;
  const tH1 = S.at(1, 'admits'), tH2 = S.at(1, 'test') + 0.6, tH3 = S.cues[2] + 0.1;
  const tBig = S.cues[3] - 0.1, tFail = S.at(3, "didn't") - 0.05, tBack = S.cues[4] - 0.1;
  const tH4 = S.at(4, "learned", 1), tH5 = S.cues[5] + 0.3, t423 = S.at(5, 'creature') - 0.2, tMissing = S.at(5, 'missing');
  return {
    transIn: 'glitch',
    sfx: [{ t: 0.1, type: 'alarm' }, { t: 0.8, type: 'alarm' }, { t: 1.5, type: 'alarm' }, accessSfx(tAcc, P), { t: tMail, type: 'whoosh' },
      { t: tH1, type: 'marker' }, { t: tH2, type: 'marker' }, { t: tH3, type: 'marker' }, { t: tBig, type: 'boom' }, { t: tFail + 0.16, type: 'stamp' },
      { t: tH4, type: 'marker' }, { t: tH5, type: 'marker' }, { t: tMissing + 0.16, type: 'stamp' }],
    music: [{ t: 0, level: 0.0, mode: 'tension' }, { t: tMail, level: 0.5, mode: 'tension' }, { t: tBig, level: 0.8, mode: 'tension' }, { t: tBack, level: 0.45, mode: 'tension' }],
    draw(ctx, t) {
      ctx.fillStyle = '#0b0c0f'; ctx.fillRect(0, 0, W, H);
      // classified warning
      const wa = 1 - prog(t, tMail, 0.4);
      if (wa > 0) {
        ctx.save(); ctx.globalAlpha = wa;
        const fl = Math.floor(t * 2.6) % 2 === 0 ? 1 : 0.55;
        ctx.fillStyle = `rgba(211,58,44,${0.22 * fl})`; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.red;
        for (let x = -200 + ((t * 120) % 120); x < W; x += 120) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 20, 50); ctx.lineTo(x - 40, 50); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x, H - 50); ctx.lineTo(x + 60, H - 50); ctx.lineTo(x + 20, H); ctx.lineTo(x - 40, H); ctx.fill();
        }
        txt(ctx, 'WARNING', W / 2, 380, { font: '150px Bebas', color: C.red, align: 'center', spacing: 20, alpha: fl });
        txt(ctx, 'THE FOLLOWING FILE IS LEVEL 4/3143 CLASSIFIED', W / 2, 480, { font: '60px Bebas', color: C.paper, align: 'center', spacing: 4 });
        txt(ctx, 'ANY ATTEMPT TO ACCESS THIS FILE WITHOUT LEVEL 4/3143 AUTHORIZATION WILL BE LOGGED', W / 2, 540, { font: '26px CourierP', color: C.grey, align: 'center' });
        access(ctx, t, tAcc, P, { x: W / 2 - 360, y: 700 });
        ctx.restore();
      }
      // the email
      const ma = rise(t, tMail, 0.7, 60);
      if (ma.a > 0) {
        const dim = 1 - 0.9 * env(t, tBig, tBack, 0.3, 0.4);
        ctx.save(); ctx.globalAlpha = ma.a * dim; ctx.translate(0, ma.dy);
        const x = 200, y = 90, w = 1520, h = 900;
        panel(ctx, x, y, w, h, { fill: 'rgba(20,22,27,0.98)', stroke: 'rgba(211,58,44,0.5)' });
        ctx.fillStyle = 'rgba(211,58,44,0.85)'; ctx.fillRect(x, y, w, 52);
        txt(ctx, 'LEVEL 4/3143 · EMAIL001.LOG', x + 24, y + 38, { font: '32px Bebas', color: C.white, spacing: 3 });
        const hdr = [['DATE:', '2012/03/15'], ['FROM:', 'Site Director August'], ['TO:', 'O5-5 Secretary'], ['SUBJECT:', 'SCP-3143']];
        hdr.forEach(([a, b], i) => { txt(ctx, a, x + 40, y + 110 + i * 40, { font: '28px CourierP', color: C.grey }); txt(ctx, b, x + 200, y + 110 + i * 40, { font: 'bold 28px CourierP', color: C.paper }); });
        ctx.fillStyle = '#2b2f37'; ctx.fillRect(x + 40, y + 250, w - 80, 2);
        let fs = 36, L; do { L = layout(ctx, EMAIL, `${fs}px CourierP`, w - 100, Math.round(fs * 1.42)); fs -= 1; } while (L.height > h - 400 && fs > 24);
        const bx = x + 46, by = y + 310;
        const hl = [['test-run for ‘Dr. Thaum’ and the ‘Pataphysics Department’.', tH1], ['fictitious department with fictitious employees', tH2],
          ['neither Murphy Lawden nor It Always Rains actually exist', tH3], ['he’s also learned quite a bit about us.', tH4], ['SCP-423 is currently missing.', tH5]];
        hl.forEach(([p, ts], i) => highlight(ctx, L, bx, by, findPhrase(L, p), prog(t, ts, 0.8), i === 4 ? 'rgba(211,58,44,0.5)' : undefined));
        drawLayout(ctx, L, bx, by, { color: C.paper });
        txt(ctx, '— Site Director August', bx, by + L.height + 30, { font: 'italic 30px CourierP', color: C.grey });
        ctx.restore();
      }
      // the punchline
      const ba = env(t, tBig, tBack + 0.2, 0.4, 0.4);
      if (ba > 0) {
        ctx.save(); ctx.globalAlpha = ba;
        txt(ctx, 'THE FOUNDATION TRIED TO BEAT A STORY', W / 2, 440, { font: '110px Bebas', color: C.white, align: 'center', spacing: 3 });
        const k2 = rise(t, S.at(3, 'writing') - 0.2, 0.5, 20);
        txt(ctx, 'BY WRITING A BETTER ONE.', W / 2, 560 + k2.dy, { font: '110px Bebas', color: C.amber, align: 'center', spacing: 3, alpha: k2.a });
        ctx.restore();
        G.stamp(ctx, "IT DIDN'T WORK", W / 2, 740, t, tFail, { size: 110, rot: -0.07, until: tBack });
      }
      // SCP-423 card
      const ca = rise(t, t423, 0.6, 40);
      if (ca.a > 0) {
        ctx.save(); ctx.globalAlpha = ca.a; ctx.translate(0, ca.dy);
        G.paper(ctx, 1280, 640, 520, 300, { rot: 0.03 });
        ctx.translate(1540, 790); ctx.rotate(0.03);
        txt(ctx, 'SCP-423', 0, -70, { font: '80px Bebas', color: C.inkText, align: 'center', spacing: 3 });
        txt(ctx, 'a creature that slips', 0, -12, { font: '30px CourierP', color: C.inkText, align: 'center' });
        txt(ctx, 'into written stories', 0, 26, { font: '30px CourierP', color: C.inkText, align: 'center' });
        ctx.restore();
        G.stamp(ctx, 'MISSING', 1560, 890, t, tMissing, { size: 76, rot: -0.12 });
      }
      if (t < 0.45) G.glitch(ctx, 1 - t / 0.45, Math.floor(t * 30));
    },
  };
};

// ------------------------------------------------------------- credits ----
scenes.credits = S => {
  const blocks = [
    { role: 'SCP-3143', name: 'MURPHY LAW IN… THE FOUNDATION ALWAYS RINGS TWICE!', title: true },
    { role: 'DR. THAUM', name: 'THADDEUS THAUM' },
    { role: 'SITE DIRECTOR AUGUST', name: 'JEREMIAH AUGUST' },
    { role: 'MTF IOTA-10', name: 'FRED' },
    { role: 'and MURPHY LAW', name: 'HIMSELF', star: true },
    { role: 'WITH SPECIAL THANKS TO', name: 'THE PATAPHYSICS DEPARTMENT', plain: true },
    { role: 'LOOK FOR THADDEUS THAUM TO RETURN IN…', name: '…NEVER METAFICTIONAL CHARACTER I DIDN’T LIKE!', plain: true },
  ];
  const gap = 330;
  blocks.forEach((b, i) => { b.y = i * gap; });
  // block i is centred on screen at these times (eased between)
  const keys = [
    [0, -700], [S.cues[0] + 0.3, blocks[0].y], [S.cues[1] - 0.1, blocks[0].y + 60],
    [S.at(1, 'thaddeus') - 0.1, blocks[1].y], [S.at(1, 'thaddeus') + 0.5, blocks[1].y + 20],
    [S.at(1, 'fred') - 0.1, blocks[3].y], [S.cues[2] - 0.1, blocks[3].y + 40],
    [S.at(2, 'himself') - 0.1, blocks[4].y], [S.at(2, 'himself') + 1.4, blocks[4].y],
    [S.dur, blocks[6].y + 60],
  ];
  const scroll = t => {
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, ya] = keys[i], [tb, yb] = keys[i + 1];
      if (t <= tb) return lerp(ya, yb, E.inOutSine(prog(t, ta, tb - ta)));
    }
    return keys[keys.length - 1][1];
  };
  const tStar = S.at(2, 'himself');
  return {
    transIn: 'fade',
    sfx: [{ t: S.cues[0], type: 'projector', dur: S.dur - S.cues[0] - 0.3 }, { t: tStar, type: 'boom', gain: 0.7 }],
    music: [{ t: 0, level: 0.75 }, { t: tStar, level: 1.0 }],
    draw(ctx, t) {
      ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H);
      const off = scroll(t);
      blocks.forEach(b => {
        const y = H / 2 + b.y - off;
        if (y < -200 || y > H + 200) return;
        const a = clamp(1 - Math.abs(y - H / 2) / 620);
        ctx.save(); ctx.globalAlpha = a;
        if (b.title) {
          txt(ctx, b.role, W / 2, y - 30, { font: '120px Bebas', color: C.amber, align: 'center', spacing: 8 });
          txt(ctx, b.name, W / 2, y + 50, { font: fitFont(ctx, b.name, 1500, 48, 'Abril'), color: C.paper, align: 'center' });
        } else if (b.plain) {
          txt(ctx, b.role, W / 2, y - 26, { font: '34px CourierP', color: C.grey, align: 'center', spacing: 4 });
          txt(ctx, b.name, W / 2, y + 44, { font: fitFont(ctx, b.name, 1600, 64, 'Abril'), color: C.paper, align: 'center' });
        } else {
          txt(ctx, b.role, W / 2, y - 60, { font: '38px CourierP', color: C.grey, align: 'center', spacing: 5 });
          txt(ctx, 'played by…', W / 2, y - 8, { font: 'italic 36px PlayfairI', color: C.grey, align: 'center' });
          const glow = b.star ? 'rgba(240,168,64,0.6)' : undefined;
          txt(ctx, b.name, W / 2, y + 80, { font: b.star ? '120px Abril' : '84px Abril', color: b.star ? C.amber : C.paper, align: 'center', glow, glowBlur: 40 });
        }
        ctx.restore();
      });
      G.rain(ctx, t, 0.15);
    },
  };
};

// --------------------------------------------------------------- outro ----
scenes.outro = S => {
  const tQ = S.cues[2] + S.durs[2] + 0.4, tIris = S.dur - 2.6, tEnd = S.dur - 1.7;
  const tSus = S.at(1, 'suspects') - 0.1;
  const LX = 1360, LY = 930;
  return {
    transIn: 'blinds',
    sfx: [{ t: tEnd, type: 'boom', gain: 0.8 }],
    music: [{ t: 0, level: 0.7 }, { t: tQ, level: 0.9 }, { t: S.dur - 0.5, level: 0.6 }],
    draw(ctx, t) {
      bgNight(ctx, { top: '#0a0d14', bottom: '#030405' });
      G.city(ctx, -60, 760, W + 120, t, { seed: 5, lights: 0.3, fill: '#0b0d12' });
      ctx.fillStyle = '#06070a'; ctx.fillRect(0, 760, W, H - 760);
      ctx.save(); ctx.globalAlpha = 0.12; ctx.translate(0, 1520); ctx.scale(1, -1); // wet street reflection
      G.city(ctx, -60, 760, W + 120, t, { seed: 5, lights: 0.3, fill: '#0b0d12' });
      ctx.restore();
      // street lamp
      ctx.fillStyle = '#0a0b0d'; ctx.fillRect(LX + 160, 260, 14, LY - 260); ctx.fillRect(LX + 70, 250, 110, 12);
      ctx.beginPath(); ctx.moveTo(LX + 40, 270); ctx.lineTo(LX + 110, 270); ctx.lineTo(LX + 96, 248); ctx.lineTo(LX + 54, 248); ctx.closePath(); ctx.fill();
      const cone = ctx.createLinearGradient(0, 270, 0, LY + 40);
      cone.addColorStop(0, 'rgba(255,210,140,0.32)'); cone.addColorStop(1, 'rgba(255,210,140,0.04)');
      ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(LX + 50, 270); ctx.lineTo(LX + 100, 270); ctx.lineTo(LX + 330, LY + 40); ctx.lineTo(LX - 180, LY + 40); ctx.closePath(); ctx.fill();
      const pool = ctx.createRadialGradient(LX + 75, LY + 20, 10, LX + 75, LY + 20, 340);
      pool.addColorStop(0, 'rgba(255,210,140,0.22)'); pool.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = pool; ctx.fillRect(LX - 300, LY - 100, 760, 300);
      G.detectiveFull(ctx, LX + 30, LY, 0.95, { fill: '#030304' });
      G.smoke(ctx, LX + 60, LY - 0.95 * 495, t, { rise: 220, size: 30, alpha: 0.08 });
      ctx.save(); ctx.beginPath(); ctx.moveTo(LX + 50, 270); ctx.lineTo(LX + 100, 270); ctx.lineTo(LX + 330, LY + 40); ctx.lineTo(LX - 180, LY + 40); ctx.closePath(); ctx.clip();
      G.rain(ctx, t, 1.2, { seed: 9, color: '255,225,180' });
      ctx.restore();
      G.rain(ctx, t, 0.6);
      // text column
      const X = 130;
      const a0 = env(t, S.cues[0] - 0.1, S.cues[1] - 0.1, 0.5, 0.35);
      txt(ctx, 'SO, WHAT IS', X, 380, { font: '80px Bebas', color: C.grey, alpha: a0, spacing: 4 });
      txt(ctx, 'SCP-3143?', X, 560, { font: '210px Bebas', color: C.amber, alpha: a0, spacing: 6 });
      const a1 = env(t, S.cues[1] - 0.1, S.cues[2] - 0.1, 0.5, 0.35), a1b = prog(t, tSus, 0.5);
      txt(ctx, 'A DETECTIVE WHO', X, 360, { font: '96px Bebas', color: C.paper, alpha: a1, spacing: 3 });
      txt(ctx, 'KNOWS HE’S FICTIONAL…', X, 460, { font: '96px Bebas', color: C.paper, alpha: a1, spacing: 3 });
      txt(ctx, '…AND SUSPECTS', X, 600, { font: '96px Bebas', color: C.paper, alpha: a1 * a1b, spacing: 3 });
      txt(ctx, 'YOU ARE TOO.', X, 700, { font: '96px Bebas', color: C.amber, alpha: a1 * a1b, spacing: 3 });
      const a2 = env(t, S.cues[2] - 0.1, tQ - 0.05, 0.5, 0.35);
      txt(ctx, 'EVERY CONTAINMENT', X, 420, { font: '96px Bebas', color: C.paper, alpha: a2, spacing: 3 });
      txt(ctx, 'IS JUST ANOTHER', X, 520, { font: '96px Bebas', color: C.paper, alpha: a2, spacing: 3 });
      txt(ctx, 'STORY.', X, 620, { font: '96px Bebas', color: C.amber, alpha: a2, spacing: 3 });
      const a3 = env(t, tQ, tIris + 0.4, 0.6, 0.4);
      txt(ctx, '“I’m just the guy you call', X, 440, { font: 'italic 66px PlayfairI', color: C.white, alpha: a3 });
      txt(ctx, 'when everything that could', X, 530, { font: 'italic 66px PlayfairI', color: C.white, alpha: a3 });
      txt(ctx, 'go wrong… did.”', X, 620, { font: 'italic 66px PlayfairI', color: C.white, alpha: a3 });
      txt(ctx, '— MURPHY LAW', X + 4, 690, { font: '32px CourierP', color: C.amber, alpha: a3, spacing: 4 });
      // iris out on the detective, then THE END
      const ik = E.inOutCubic(prog(t, tIris, 1.0));
      if (ik > 0) {
        const cx = LX + 40, cy = LY - 280, r = lerp(2400, 0, ik);
        ctx.save(); ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(r, 0.1), 0, Math.PI * 2, true); ctx.fill('evenodd');
        ctx.restore();
      }
      const ek = E.outCubic(prog(t, tEnd, 0.8));
      txt(ctx, 'The End', W / 2, H / 2 + 40, { font: 'italic 150px PlayfairI', color: C.paper, align: 'center', alpha: ek * (1 - prog(t, S.dur - 0.5, 0.5)) });
    },
  };
};

// --------------------------------------------------------- attribution ----
scenes.attribution = S => ({
  transIn: 'fade',
  sfx: [],
  music: [{ t: 0, level: 0.55 }, { t: S.dur - 2.0, level: 0.0 }],
  draw(ctx, t) {
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, W, H);
    const a = Math.min(E.outCubic(prog(t, 0.4, 0.8)), 1 - prog(t, S.dur - 1.0, 0.9));
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, 'BASED ON', W / 2, 250, { font: '34px Bebas', color: C.grey, align: 'center', spacing: 8 });
    txt(ctx, 'SCP-3143: “Murphy Law in… The Foundation Always Rings Twice!”', W / 2, 330, { font: fitFont(ctx, 'SCP-3143: “Murphy Law in… The Foundation Always Rings Twice!”', 1600, 52, 'Playfair'), color: C.paper, align: 'center' });
    txt(ctx, 'by The Great Hippo', W / 2, 400, { font: 'italic 44px PlayfairI', color: C.amber, align: 'center' });
    txt(ctx, 'scp-wiki.wikidot.com/scp-3143', W / 2, 470, { font: '34px CourierP', color: C.paper, align: 'center' });
    txt(ctx, 'Licensed under Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0).', W / 2, 560, { font: '30px CourierP', color: C.grey, align: 'center' });
    txt(ctx, 'This video is an adaptation and is released under CC BY-SA 3.0.', W / 2, 604, { font: '30px CourierP', color: C.grey, align: 'center' });
    txt(ctx, 'Quotes are from the original article. Narration: synthetic voice (Kokoro TTS).', W / 2, 700, { font: '26px CourierP', color: C.dim, align: 'center' });
    txt(ctx, 'Music & sound: synthesized for this video. Fonts: Courier Prime, Bebas Neue, Abril Fatface,', W / 2, 740, { font: '26px CourierP', color: C.dim, align: 'center' });
    txt(ctx, 'Playfair Display, Oswald (SIL OFL 1.1) · Special Elite (Apache 2.0).', W / 2, 780, { font: '26px CourierP', color: C.dim, align: 'center' });
    ctx.restore();
  },
});

module.exports = scenes;
