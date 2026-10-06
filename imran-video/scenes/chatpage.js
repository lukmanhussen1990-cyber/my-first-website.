// chat page (world layer, page 'chat') for the WHOLE video, 0.50 → end (spec §1.8, §3.2, §3.3 anticipation, §3.7 home).
//  - 'chat' entry: bubble + avatar + "Imran, I got you!" + typed "I’ve got it" + orange "!" + underline + caret,
//    the 3.40 dot anticipation, the 13.12 reaction wobble, avatar hops, and the 14.55 word wave.
//  - 'home' entry (z 1): reaction chip + mini thumb, the spark dot's return arc + landing, the pink heart.
// The "!" dot is owned by drop.js (screen flyer) from 3.52 and comes back here at 13.32 (arc) / 13.67 (whole).
// Exports window.CHATPG = { inkStroke, dotShape, drawDot } for drop.js.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const DEG = Math.PI / 180;
  const RES = 2;           // text sprites are rendered at 2x (stay crisp under the 1.195 push-in × 1.10 wave pop)
  const TXT_DISP = 2.5;    // spec §1.3: chat text displacement scale
  const TXT_FREQ = 0.035;  // spec §1.3: turbulence base frequency

  // ---------------------------------------------------------------- timings (absolute s)
  const T_POP = 0.50, T_AV = 0.60;
  const WORD_T = [0.76, 0.86, 0.96, 1.08];
  const T_NOD = 1.20, T_CARET = 1.36;
  const TYPE_T = [1.48, 1.54, 1.60, 1.66, 1.84, 1.90, 1.97, 2.04, 2.11, 2.18, 2.25]; // I ’ v e _ g o t _ i t
  const T_BANG = 2.46, T_UL0 = 2.58, T_UL1 = 2.88, T_BREATH = 2.90;
  const T_ANTIC = 3.40, T_HOP = 3.52;
  const T_CHIP = 13.04, T_LAND = 13.12, T_RET0 = 13.32, T_RET1 = 13.67;
  const T_HEART0 = 13.72, T_HEART1 = 14.62, T_HOPS = 13.77;
  const WAVE_T = [14.55, 14.65, 14.75, 14.85], T_PUMP = 14.85;

  let G = null; // geometry, built in SCENE_INIT once LAYOUT exists

  // ---------------------------------------------------------------- helpers
  // spec §1.3 ink stroke: width profile w·sin(πs)^0.6 along normalized length s, boiled centerline (±1.2 px)
  // and width (±8%) at 12 fps; draws arc length [from, to] (write-on: to < 1, write-off: from > 0).
  function inkStroke(ctx, pts, o) {
    const width = o.width ?? 8, from = clamp(o.from ?? 0), to = clamp(o.to ?? 1);
    if (to - from < 1e-3) return;
    const t = o.t ?? 0, id = o.id ?? 1, minW = o.minW ?? 0.6;
    let P = o.noBoil ? pts : S.boilPts(pts, id, t, o.boil ?? 1.2);
    if (o.smooth) P = L.catmull(P, false, 12); // boil sparse control points, then a smooth centerline
    const n = P.length, acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = acc[n - 1] || 1, ph = L.boil(t);
    const wAt = (s) => Math.max(minW, width * Math.pow(Math.max(0, Math.sin(Math.PI * s)), o.pow ?? 0.6) *
      (1 + 0.08 * L.noise1(s * 3.3, id * 13 + ph * 7)));
    const ptAt = (s) => {
      const d = s * total; let i = 1; while (i < n - 1 && acc[i] < d) i++;
      const f = (d - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
      return [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)];
    };
    const steps = Math.max(8, Math.ceil(total * (to - from) / 3));
    const left = [], right = [], cen = [];
    for (let k = 0; k <= steps; k++) {
      const s = from + (to - from) * (k / steps);
      const a = ptAt(Math.max(0, s - 0.004)), b = ptAt(Math.min(1, s + 0.004)), p = ptAt(s);
      let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = wAt(s) / 2;
      left.push([p[0] - dy * w, p[1] + dx * w]); right.push([p[0] + dy * w, p[1] - dx * w]); cen.push([p, w]);
    }
    ctx.fillStyle = o.color ?? PAL.ink;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
    for (const [p, w] of [cen[0], cen[cen.length - 1]]) { if (w > 0.8) { ctx.beginPath(); ctx.arc(p[0], p[1], w, 0, Math.PI * 2); ctx.fill(); } }
  }

  // The spark dot: a 10-gon (same family as the thought-page seed, spec §3.3), unit radius.
  const dotShape = (() => {
    const r = L.rng(3407), pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2 + (r() - 0.5) * 0.12;
      const k = 1 + (r() - 0.5) * 0.08;
      pts.push([Math.cos(a) * k, Math.sin(a) * k]);
    }
    return pts;
  })();
  // Draw the dot centered at (x,y), radius rad, squash sx/sy (applied along `rot`, about the center), boiled.
  function drawDot(ctx, x, y, rad, t, o = {}) {
    if (rad <= 0.05) return;
    const sx = o.sx ?? 1, sy = o.sy ?? 1, id = o.id ?? 681;
    const amp = o.amp ?? (rad < 20 ? 0.9 : lerp(0.9, 2.2, clamp((rad - 20) / 14)));
    const pts = S.boilPts(dotShape.map(([a, b]) => [a * rad, b * rad]), id, t, amp);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sx, sy);
    if (o.rot) ctx.rotate(-o.rot);
    L.fillPoly(ctx, pts, o.color ?? PAL.orange, { round: Math.min(6, rad * 0.35) });
    ctx.restore();
  }

  // ---- text sprites: pre-rendered once per (string, boil phase) through our own displacement filter
  const _tc = new Map();
  function textSprite(str, fam, wt, size, phase) {
    const key = `${str}|${fam}|${wt}|${size}|${phase}`;
    let e = _tc.get(key); if (e) return e;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${wt} ${size}px "${fam}"`;
    const m = mc.measureText(str), pad = 24;
    const left = Math.ceil(m.actualBoundingBoxLeft) + pad, right = Math.ceil(m.actualBoundingBoxRight) + pad;
    const asc = Math.ceil(m.actualBoundingBoxAscent) + pad, desc = Math.ceil(m.actualBoundingBoxDescent) + pad;
    const w = left + right, h = asc + desc;
    const c = document.createElement('canvas'); c.width = w * RES; c.height = h * RES;
    const x = c.getContext('2d');
    x.scale(RES, RES);
    x.font = `${wt} ${size}px "${fam}"`; x.fillStyle = PAL.ink; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.filter = `url(#cp-rough-${phase})`;
    x.fillText(str, left, asc);
    e = { c, ox: left, oy: asc, w, h };
    _tc.set(key, e);
    return e;
  }
  // Draw a sprite with its text origin (left, baseline) at (x, y).
  function drawSprite(ctx, e, x, y) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(e.c, x - e.ox, y - e.oy, e.w, e.h);
  }

  function makeFilters() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    for (let k = 0; k < 3; k++) {
      const f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', `cp-rough-${k}`);
      f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '1'); f.setAttribute('height', '1');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      const tb = document.createElementNS(NS, 'feTurbulence');
      tb.setAttribute('type', 'fractalNoise'); tb.setAttribute('baseFrequency', String(TXT_FREQ / RES));
      tb.setAttribute('numOctaves', '2'); tb.setAttribute('seed', String(31 * 7919 + k)); // seed = shapeId*7919 + boil
      const dm = document.createElementNS(NS, 'feDisplacementMap');
      dm.setAttribute('in', 'SourceGraphic'); dm.setAttribute('scale', String(TXT_DISP * RES));
      dm.setAttribute('xChannelSelector', 'R'); dm.setAttribute('yChannelSelector', 'G');
      f.appendChild(tb); f.appendChild(dm); svg.appendChild(f);
    }
    document.body.appendChild(svg);
  }

  // Rounded rect → hand-cut control points (dense on the corners), clockwise from the top-left corner's end.
  function roundRectCtrl(x0, y0, x1, y1, r, edgeH, edgeV, seed, cutAmp) {
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i < 4; i++) { const a = (a0 + i * 30) * DEG; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    const edge = (p, q, k) => { for (let i = 1; i <= k; i++) pts.push([lerp(p[0], q[0], i / (k + 1)), lerp(p[1], q[1], i / (k + 1))]); };
    edge([x0 + r, y0], [x1 - r, y0], edgeH);
    corner(x1 - r, y0 + r, -90);
    edge([x1, y0 + r], [x1, y1 - r], edgeV);
    corner(x1 - r, y1 - r, 0);
    edge([x1 - r, y1], [x0 + r, y1], edgeH);
    corner(x0 + r, y1 - r, 90);
    edge([x0, y1 - r], [x0, y0 + r], edgeV);
    corner(x0 + r, y0 + r, 180);
    // fixed hand-cut irregularity along the normal
    const rr = L.rng(seed), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return pts.map(([px, py]) => {
      const k = (rr() - 0.5) * 2 * cutAmp;
      const nx = px - cx, ny = py - cy, d = Math.hypot(nx * 0.3, ny) || 1;
      return [px + (nx * 0.3 / d) * k, py + (ny / d) * k];
    });
  }
  function ngon(cx, cy, rad, n, irr, seed, ry) {
    const r = L.rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.08;
      const k = 1 + (r() - 0.5) * 2 * irr;
      out.push([cx + Math.cos(a) * rad * k, cy + Math.sin(a) * (ry ?? rad) * k]);
    }
    return out;
  }

  SCENE_INIT.push(async () => {
    makeFilters();
    const Lo = LAYOUT, B = Lo.bubble;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${Lo.msgFont[1]} ${Lo.msgSize}px "${Lo.msgFont[0]}"`;
    const wordW = Lo.words.map((w) => mc.measureText(w).width);
    G = {
      bubbleCtrl: roundRectCtrl(B.L, B.top, B.R, B.bottom, B.radius, 11, 1, 5101, 1.3), // 40 control points
      avatarPts: ngon(Lo.avatar.x, Lo.avatar.y, Lo.avatar.r, 16, 0.02, 6116),
      headPts: ngon(Lo.avatar.head.x, Lo.avatar.head.y, Lo.avatar.head.r, 18, 0.015, 6117),
      shoulderPts: ngon(Lo.avatar.shoulders.x, Lo.avatar.shoulders.y, Lo.avatar.shoulders.rx, 22, 0.015, 6118, Lo.avatar.shoulders.ry),
      wordW,
      chipPts: (() => { const c = Lo.chip; return L.resample(P.roundRectPoints(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, c.r, 12), 44, true); })(),
      chipRingPts: (() => { const c = Lo.chip, g = 6; return L.resample(P.roundRectPoints(c.x - c.w / 2 - g, c.y - c.h / 2 - g, c.w + 2 * g, c.h + 2 * g, c.r + g, 12), 44, true); })(),
      ulPts: (() => { // 7 control points on the quadratic; boiled then Catmull-smoothed per frame
        const u = Lo.underline, xm = (u.gLeft + u.end) / 2, out = [];
        for (let i = 0; i <= 6; i++) { const s = i / 6, a = 1 - s; out.push([a * a * u.gLeft + 2 * a * s * xm + s * s * u.end, a * a * u.y0 + 2 * a * s * u.yc + s * s * u.y1]); }
        return out;
      })(),
    };
    // stem: tapered quad, origin at its bottom-center (spec: y 621→668, top w 15, bottom w 9, tilt +3°)
    const bg = Lo.bang, hS = bg.stemBottom - bg.stemTop;
    G.stemPts = [[-bg.topW / 2, -hS], [bg.topW / 2, -hS], [bg.bottomW / 2, 0], [-bg.bottomW / 2, 0]];
    // warm the text sprite cache (all strings × 3 boil phases) so no frame pays for it
    for (let ph = 0; ph < 3; ph++) {
      Lo.words.forEach((w) => textSprite(w, Lo.msgFont[0], Lo.msgFont[1], Lo.msgSize, ph));
      for (const ch of Lo.REPLY) if (ch !== ' ') textSprite(ch, Lo.replyFont[0], Lo.replyFont[1], Lo.replySize, ph);
    }
  });

  // ---------------------------------------------------------------- state functions (absolute t)
  // Bubble pop: scaleX/scaleY easeOutBack(2.0) about (L, 426), Y delayed 0.05 s.
  function bubbleScale(t) {
    const B = LAYOUT.bubble;
    const kx = ease.outBack(remap(t, T_POP, T_POP + 0.40), 2.0);
    const ky = ease.outBack(remap(t, T_POP + 0.05, T_POP + 0.45), 2.0);
    return { kx, ky, ox: B.L, oy: B.cy };
  }
  // 13.12 reaction: sy = 1/WOBBLE(τ; 0.03, 5, 0.10), sx = 1/sy
  function reactWobble(t) {
    if (t < T_LAND) return [1, 1];
    const sx = L.WOBBLE(t - T_LAND, 0.03, 5, 0.10);
    return [sx, 1 / sx];
  }
  // Silhouette nod / breath / happy hops
  function silhouette(t) {
    let dy = 0, s = 1;
    const un = remap(t, T_NOD, T_NOD + 0.18);
    if (un > 0 && un < 1) dy -= 7 * Math.sin(Math.PI * un);
    if (t >= T_BREATH) s = 1 + 0.015 * Math.sin(2 * Math.PI * 1.2 * (t - T_BREATH));
    for (let h = 0; h < 2; h++) {
      const u = remap(t, T_HOPS + h * 0.2, T_HOPS + (h + 1) * 0.2);
      if (u > 0 && u < 1) dy -= 6 * 4 * u * (1 - u);
    }
    return { dy, s };
  }
  // Word pop (0.76…) and wave (14.55…): returns {s, dy, rot, a}
  function wordState(i, t) {
    const tau = t - WORD_T[i];
    if (tau < 0) return null;
    let s = 1, dy = 0, rot = 0;
    if (tau < 0.24) { const e = ease.outBack(tau / 0.24, 1.8); s = lerp(0.55, 1, e); dy = 18 * (1 - e); }
    const a = clamp(tau / 0.08);
    if (i === 3) rot += -8 * DEG * (1 - L.SPRING_IN(tau, 4, 0.45));
    const tw = t - WAVE_T[i];
    if (tw >= 0 && tw < 0.22) { const k = Math.sin(Math.PI * tw / 0.22); dy -= 16 * k; s *= 1 + 0.10 * k; }
    if (i === 3 && tw >= 0 && tw < 0.7) {
      // ±6° wobble on SPRING_IN(4 Hz, ζ 0.45): the spring's (normalized) velocity term — starts at 0, swings to −6°, settles
      const w = 2 * Math.PI * 4, z = 0.45, wd = w * Math.sqrt(1 - z * z);
      rot += -6 * DEG * (Math.exp(-z * w * tw) * Math.sin(wd * tw)) / 0.512;
    }
    return { s, dy, rot, a };
  }
  // Number of typed reply glyphs at t
  function typedCount(t) { let n = 0; while (n < TYPE_T.length && t >= TYPE_T[n]) n++; return n; }
  function caretState(t) {
    if (t < T_CARET || t >= 3.20) return null;
    if (t >= 2.71 && t < 2.96) return null;
    const a = t >= 3.12 ? 1 - remap(t, 3.12, 3.20) : 1;
    const Lo = LAYOUT;
    let x;
    if (t >= T_BANG) x = Lo.bang.x + 18;
    else { const n = typedCount(t); x = n === 0 ? Lo.text.x : Lo.glyphX[n] + 8; }
    return { x, a };
  }
  // The "!" dot on the page: {x, y, sx, sy} or null when it is away (drop.js / the return arc own it).
  function pageDot(t) {
    const d = LAYOUT.bang.dot;
    if (t < T_BANG) return null;
    if (t >= T_HOP && t < T_RET1) return null;
    if (t < T_HOP) {
      const k = ease.outQuad(remap(t, T_ANTIC, T_HOP));
      const sx = lerp(1, 1.3, k), sy = lerp(1, 0.7, k);
      return { x: d.x, y: d.y + d.r - d.r * sy, sx, sy }; // bottom-anchored at y 691
    }
    // 13.67 landing: squash 1.3 / 0.75, recovering on WOBBLE (bottom-anchored)
    const tau = t - T_RET1;
    const sx = L.WOBBLE(tau, 0.30, 5.5, 0.045), sy = 1 / sx;
    return { x: d.x, y: d.y + d.r - d.r * sy, sx, sy };
  }

  // ---------------------------------------------------------------- draw: chat page base
  function drawChat(ctx, t) {
    if (!G) return;
    const Lo = LAYOUT, B = Lo.bubble, ph = L.boil(t);
    const bs = bubbleScale(t);
    if (bs.kx <= 0.001) return;
    const [wx, wy] = reactWobble(t);

    // ---- bubble group (bubble, avatar, words) — reaction wobble about the bubble center
    ctx.save();
    ctx.translate(B.cx, B.cy); ctx.scale(wx, wy); ctx.translate(-B.cx, -B.cy);

    // bubble
    ctx.save();
    ctx.translate(bs.ox, bs.oy); ctx.scale(Math.max(0.001, bs.kx), Math.max(0.001, bs.ky)); ctx.translate(-bs.ox, -bs.oy);
    const bp = S.boilPts(G.bubbleCtrl, 101, t, 2.5);
    ctx.fillStyle = PAL.chat; L.smoothPath(ctx, bp, true); ctx.fill();
    ctx.restore();

    // avatar
    const ka = ease.outBack(remap(t, T_AV, T_AV + 0.30), 2.2);
    if (ka > 0.001) {
      const A = Lo.avatar;
      const un = remap(t, T_NOD, T_NOD + 0.18), nod = un > 0 && un < 1 ? Math.sin(Math.PI * un) : 0;
      ctx.save();
      ctx.translate(A.x, A.y);
      ctx.rotate(-12 * DEG * (1 - ka));
      ctx.scale(ka * (1 + 0.04 * nod), ka * (1 - 0.04 * nod));
      ctx.translate(-A.x, -A.y);
      const ap = S.boilPts(G.avatarPts, 102, t, 1.6);
      ctx.fillStyle = PAL.lav; L.smoothPath(ctx, ap, true); ctx.fill();
      const ks = ease.outBack(remap(t, T_AV + 0.05, T_AV + 0.35), 2.2);
      if (ks > 0.001) {
        L.smoothPath(ctx, ap, true); ctx.clip();
        const sh = silhouette(t), py = A.y + A.r; // breathe/pop about the circle's bottom-center
        ctx.translate(A.x, py + sh.dy); ctx.scale(ks * sh.s, ks * sh.s); ctx.translate(-A.x, -py);
        ctx.fillStyle = PAL.pink;
        L.smoothPath(ctx, S.boilPts(G.headPts, 103, t, 0.7), true); ctx.fill();
        L.smoothPath(ctx, S.boilPts(G.shoulderPts, 104, t, 1.0), true); ctx.fill();
      }
      ctx.restore();
    }

    // bubble words
    for (let i = 0; i < 4; i++) {
      const st = wordState(i, t); if (!st) continue;
      const e = textSprite(Lo.words[i], Lo.msgFont[0], Lo.msgFont[1], Lo.msgSize, ph);
      const x0 = Lo.wordX[i], bx = x0 + G.wordW[i] / 2, by = Lo.text.baseline;
      ctx.save();
      ctx.globalAlpha *= st.a;
      ctx.translate(bx, by + st.dy); if (st.rot) ctx.rotate(st.rot); ctx.scale(st.s, st.s); ctx.translate(-bx, -by);
      drawSprite(ctx, e, x0, by);
      ctx.restore();
    }
    ctx.restore(); // bubble group

    // ---- reply "I’ve got it"
    const n = typedCount(t);
    for (let i = 0; i < n; i++) {
      const ch = Lo.REPLY[i]; if (ch === ' ') continue;
      const tau = t - TYPE_T[i];
      const e = ease.outBack(clamp(tau / 0.10), 1.7);
      const s = lerp(1.25, 1, e), dy = lerp(-6, 0, e);
      const x0 = Lo.glyphX[i], cx = (x0 + Lo.glyphX[i + 1]) / 2, by = Lo.reply.baseline;
      const sp = textSprite(ch, Lo.replyFont[0], Lo.replyFont[1], Lo.replySize, ph);
      ctx.save();
      ctx.translate(cx, by + dy); ctx.scale(s, s); ctx.translate(-cx, -by);
      drawSprite(ctx, sp, x0, by);
      ctx.restore();
    }

    // ---- orange underline (2.58–2.88 write-on)
    if (t >= T_UL0) {
      const p = ease.outCubic(remap(t, T_UL0, T_UL1));
      inkStroke(ctx, G.ulPts, { width: Lo.underline.width, to: p, t, id: 105, color: PAL.orange, smooth: true });
    }

    // ---- orange "!" (stem + dot), pops at 2.46 about the stem bottom
    if (t >= T_BANG) {
      const bg = Lo.bang;
      const e = ease.outBack(remap(t, T_BANG, T_BANG + 0.25), 2.5);
      const s = lerp(1.5, 1, e), rot = lerp(10, 0, e) * DEG;
      ctx.save();
      ctx.translate(bg.x, bg.stemBottom); ctx.rotate(rot); ctx.scale(s, s);
      // stem: tilted +3° about its bottom; a tiny recoil when the spark lands back (13.67)
      ctx.save();
      ctx.rotate(bg.tiltDeg * DEG);
      const rec = t >= T_RET1 ? 1 - 0.10 * Math.exp(-(t - T_RET1) / 0.05) * Math.cos(2 * Math.PI * 6 * (t - T_RET1)) : 1;
      ctx.scale(1 / Math.sqrt(rec), rec);
      L.fillPoly(ctx, S.boilPts(G.stemPts, 106, t, 0.9), PAL.orange, { round: 4 });
      ctx.restore();
      const d = pageDot(t);
      if (d) drawDot(ctx, d.x - bg.x, d.y - bg.stemBottom, bg.dot.r, t, { sx: d.sx, sy: d.sy });
      ctx.restore();
    }

    // ---- caret
    const c = caretState(t);
    if (c) {
      const pop = clamp((t - T_CARET) / 0.06);
      const cw = Lo.caret.w, ch = Lo.caret.h, top = Lo.caret.top;
      ctx.save();
      ctx.globalAlpha *= c.a;
      const hh = ch * (0.4 + 0.6 * pop), y0 = top + (ch - hh) / 2;
      L.fillPoly(ctx, S.boilPts([[c.x, y0], [c.x + cw, y0], [c.x + cw, y0 + hh], [c.x, y0 + hh]], 107, t, 0.5), PAL.ink, { round: 2 });
      ctx.restore();
    }

    // ---- pop-off ticks (3.52): three tiny ink ticks flick out from the dot spot as it leaves
    ticks(ctx, t, T_HOP, Lo.bang.dot.x, Lo.bang.dot.y, 110, [200, -20, 90]);
  }

  // Three short INK ticks radiating from (x,y): write on in 0.05 s, write off by +0.17 s.
  function ticks(ctx, t, t0, x, y, id, angles) {
    const tau = t - t0;
    if (tau < 0 || tau > 0.18) return;
    angles.forEach((aDeg, k) => {
      const a = aDeg * DEG, r0 = 19 + (k === 2 ? 2 : 0), len = k === 2 ? 10 : 14;
      const p0 = [x + Math.cos(a) * r0, y + Math.sin(a) * r0], p1 = [x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len)];
      const on = ease.outCubic(clamp(tau / 0.05)), off = ease.inQuad(clamp((tau - 0.07) / 0.10));
      inkStroke(ctx, [p0, L.lerpPt(p0, p1, 0.5), p1], { width: 4.5, from: off, to: on, t, id: id + k, boil: 0.6, pow: 0.35, minW: 1.2 });
    });
  }

  // ---------------------------------------------------------------- draw: home (chip, thumb, dot return, heart)
  function drawHome(ctx, t) {
    if (!G) return;
    const Lo = LAYOUT, C = Lo.chip;

    // reaction chip (13.04–13.29 pop), BG cut-out ring + WHITE pill
    const kc = ease.outBack(remap(t, T_CHIP, T_CHIP + 0.25), 2.2);
    if (kc > 0.001) {
      const tp = t - T_PUMP;
      const bump = tp >= 0 && tp < 0.3 ? 1 + 0.035 * Math.sin(Math.PI * tp / 0.3) : 1; // chip answers the thumb pump
      ctx.save();
      ctx.translate(C.x, C.y); ctx.scale(kc * bump, kc * bump); ctx.translate(-C.x, -C.y);
      ctx.fillStyle = PAL.bg; L.smoothPath(ctx, S.boilPts(G.chipRingPts, 120, t, 1.6), true); ctx.fill();
      ctx.fillStyle = PAL.white; L.smoothPath(ctx, S.boilPts(G.chipPts, 121, t, 1.6), true); ctx.fill();
      ctx.restore();
    }

    // mini thumb in the chip from 13.12: scale 0.22→0.20 easeOutBack 0.15 s, bbox-centred; 14.85 pump −8°→0°
    if (t >= T_LAND) {
      const e = ease.outBack(remap(t, T_LAND, T_LAND + 0.15));
      const s = lerp(0.22, 0.20, e);
      const bb = S.thumbBBoxCenter(s);
      let rot = 0;
      if (t >= T_PUMP) rot = -8 * DEG * (1 - ease.outBack(remap(t, T_PUMP, T_PUMP + 0.20)));
      ctx.save();
      // pump pivots about the bbox bottom-center (the wrist), keeping the bbox center at (Cx, 534) at rest
      const piv = [C.x, C.y + 43 * (s / 0.2)];
      ctx.translate(piv[0], piv[1]); ctx.rotate(rot); ctx.translate(-piv[0], -piv[1]);
      S.drawThumb(ctx, { x: C.x - bb[0], y: C.y - bb[1], s, t, id: 77 });
      ctx.restore();
    }

    // heart 13.72–14.62
    if (t >= T_HEART0 && t < T_HEART1) {
      const tau = t - T_HEART0;
      const k = ease.outBack(clamp(tau / 0.25));
      const rise = ease.outSine(remap(t, T_HEART0, T_HEART1));
      const x = C.x + 8 * Math.sin(2 * Math.PI * 2 * tau), y = lerp(478, 350, rise);
      const a = 1 - remap(t, 14.32, 14.62);
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(x, y); ctx.rotate(-7 * DEG * Math.cos(2 * Math.PI * 2 * tau)); ctx.scale(k, k);
      S.fill(ctx, S.boilPts(S.HEART, 122, t, 1.2), PAL.pink, 4);
      ctx.restore();
    }

    // the spark comes home 13.32–13.67: quadratic arc from the chip's lower-left via (1260,520) to the "!" dot
    if (t >= T_RET0 && t < T_RET1) {
      const d = Lo.bang.dot, p0 = [C.x - 40, 560], pc = [1260, 520], p1 = [d.x, d.y];
      const posAt = (tt) => {
        const u = ease.inOutSine(remap(tt, T_RET0, T_RET1)), a = 1 - u;
        return [a * a * p0[0] + 2 * a * u * pc[0] + u * u * p1[0], a * a * p0[1] + 2 * a * u * pc[1] + u * u * p1[1]];
      };
      const pop = ease.outBack(clamp((t - T_RET0) / 0.08), 2.0);
      const drawAt = (tt, alpha) => {
        const p = posAt(tt), q = posAt(tt - 1 / 60), r = posAt(tt + 1 / 60);
        const v = [(r[0] - q[0]) * 30, (r[1] - q[1]) * 30], sp = Math.hypot(v[0], v[1]);
        const st = 1 + Math.min(0.35, sp / 3000);
        ctx.save(); ctx.globalAlpha *= alpha;
        drawDot(ctx, p[0], p[1], d.r * (tt >= T_RET0 + 0.08 ? 1 : pop), t, { sx: st, sy: 1 / st, rot: Math.atan2(v[1], v[0]) });
        ctx.restore();
      };
      // smear echoes (spec §1.4), only once the dot is out
      [[3, 0.10], [2, 0.20], [1, 0.35]].forEach(([k, op]) => { if (t - k / 30 >= T_RET0 + 0.03) drawAt(t - k / 30, op); });
      drawAt(t, 1);
    }
    // landing ticks at 13.67 (rhymes with the pop-off ticks)
    ticks(ctx, t, T_RET1, Lo.bang.dot.x, Lo.bang.dot.y, 130, [200, -20, 90]);
  }

  SCENE({ id: 'chat', start: T.T_BUBBLE, end: T.T_END + 1, layer: 'world', page: 'chat', z: 0, draw: (ctx, lt, t) => drawChat(ctx, t) });
  SCENE({ id: 'home', start: T.scenes.home[0], end: T.T_END + 1, layer: 'world', page: 'chat', z: 1, draw: (ctx, lt, t) => drawHome(ctx, t) });

  window.CHATPG = { inkStroke, dotShape, drawDot, pageDot };
})();
