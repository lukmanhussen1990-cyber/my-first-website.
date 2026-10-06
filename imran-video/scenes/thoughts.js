// thoughts (4.20–8.21), spec §3.4: the seed lands, puff chains pop four white thought bubbles out of it,
// cursive scribbles write on with a pen nib, each scribble comes into focus as a real handwritten word,
// "for Imran" makes the seed hop, then orange ignites clockwise through every bubble with ink action ticks.
// The bubble model (geometry, idle bob, drawing helpers) is shared with merge.js via window.THOUGHTS.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const DEG = Math.PI / 180;
  const SEED_C = [960, 555], SEED_R = 34;

  // ---------------- 2D affine matrices, canvas order [a, b, c, d, e, f] ----------------
  const MX = {
    mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
    tr: (x, y) => [1, 0, 0, 1, x, y],
    rot: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; },
    sc: (sx, sy = sx) => [sx, 0, 0, sy, 0, 0],
    ap: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]],
  };
  MX.chain = (...ms) => ms.reduce((acc, m) => MX.mul(acc, m));
  // scale `sa` along the axis at angle a and `sb` across it
  MX.axis = (a, sa, sb) => MX.chain(MX.rot(a), MX.sc(sa, sb), MX.rot(-a));

  // ---------------- the four thoughts (spec §3.4 tables) ----------------
  const DEFS = [
    { key: 'TL', c: [585, 325], small: [888, 511], big: [824, 471], tS: 4.40, tB: 4.48, tP: 4.56, w0: 4.70, word: 'hmm…', wrot: -3, r0: 6.30, ph: 0.0, iS: 7.59, iB: 7.64, Ti: 7.69, seed: 101 },
    { key: 'TR', c: [1335, 325], small: [1032, 511], big: [1096, 471], tS: 4.80, tB: 4.88, tP: 4.96, w0: 5.10, word: 'what if…', wrot: 2, r0: 6.46, ph: 0.6, iS: 7.76, iB: 7.81, Ti: 7.86, seed: 202 },
    { key: 'BL', c: [585, 785], small: [888, 599], big: [824, 639], tS: 5.20, tB: 5.28, tP: 5.36, w0: 5.50, word: 'try this!', wrot: -2, r0: 6.62, ph: 1.2, iS: 7.42, iB: 7.47, Ti: 7.52, seed: 303 },
    { key: 'BR', c: [1335, 785], small: [1032, 599], big: [1096, 639], tS: 5.60, tB: 5.68, tP: 5.76, w0: 5.90, word: 'for Imran', wrot: 3, r0: 6.85, ph: 1.8, iS: 7.25, iB: 7.30, Ti: 7.35, seed: 404, hero: true },
  ];
  const WRITE_DUR = 0.35, RESOLVE_DUR = 0.28, POP_ANCHOR = 0.6;
  const UNWRITE_K = 0.4, WORD_FADE = 0.08;
  const NIB_R = 8; // spec r 6, scaled with the bolder scribble stroke so the nib still reads at the head
  // Tick sizes: spec 30×7 (action) and 14×4 (joy) read as specks next to 440 px bubbles, so they are a bit larger.
  const TICK_LEN = 40, TICK_W = 8, JOY_LEN = 18, JOY_W = 5;
  const WORD_SIZE = 108, WORD_MAXW = 380, WORD_MIN = 100;

  // Bubble outline: WHITE 14-gon on an ellipse rx 220 / ry 170, radial jitter ±4 %, angle jitter ±5° (local coords).
  function bubblePoly(seed) {
    const r = L.rng(seed), pts = [];
    for (let k = 0; k < 14; k++) {
      const a = -Math.PI / 2 + (k / 14) * Math.PI * 2 + (r() - 0.5) * 2 * 5 * DEG;
      const j = 1 + (r() - 0.5) * 2 * 0.04;
      pts.push([Math.cos(a) * 220 * j, Math.sin(a) * 170 * j]);
    }
    return pts;
  }
  // Small irregular n-gon (puffs, seed, spill), unit radius.
  function ngon(n, jag, seed, rot = -Math.PI / 2) {
    const r = L.rng(seed), pts = [];
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2 + (r() - 0.5) * (Math.PI * 2 / n) * 0.3;
      const j = 1 + (r() - 0.5) * 2 * jag;
      pts.push([Math.cos(a) * j, Math.sin(a) * j]);
    }
    return pts;
  }
  // Distance from the origin to a closed polygon along direction angle a.
  function rayHit(poly, a) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const s = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den;
      if (s > 0 && u >= 0 && u <= 1) best = Math.max(best, s);
    }
    return best;
  }

  // ---------------- cursive scribble ribbon (spec §3.4 Beat B) ----------------
  // Each scribble is a chain of cursive "letters", one trough-to-trough cycle each, of a prolate cycloid
  //   x = a·ψ + b·sin ψ,  y = −H·(1 − cos ψ)/2   (trough at ψ = 0, top at ψ = π), sheared forward by `slant`.
  // b > a gives a loop at the top whose counter opens as b/a grows; b < a gives a rounded hump with no loop.
  // Deviation from the literal spec cycloid (one height-modulated cycloid, φ ∈ [0, 8π]): that rendered as four
  // near-identical round curls. Here every bubble gets its own letter rhythm (like the source frames: ulle / lulu /
  // ulu / lull), tall "l" loops have open counters, "u" humps are about half as tall, and the lead-in and tail
  // vary per bubble (rising flick, long flat trail, hook), so the 6.25 frame reads as four different thoughts.
  const LETTER = {
    l: { H: 96, a: 11.0, k: 2.45, n: 1 },  // tall ascender loop, open counter
    e: { H: 46, a: 9.5, k: 2.1, n: 1 },    // small loop
    u: { H: 42, a: 7.4, k: 1.05, n: 2 },   // two short pointed humps, no loop
  };
  const SCRIB = { slant: 0.55, w: [9, 16, 8] };
  const SCRIB_SPEC = {
    TL: { pat: 'ulle', lead: [-46, 14], tail: [58, -44], off: [10, 6] },  // ends in a rising flick
    TR: { pat: 'lulu', lead: [-40, 24], tail: [86, 6], off: [14, 4] },    // long flat trailing stroke
    BL: { pat: 'ulu', lead: [-50, 10], tail: [104, -12], off: [16, 6] },  // short word, long trail
    BR: { pat: 'lull', lead: [-44, 20], tail: [46, -18], off: [10, 4] },  // tall and busy, small hook
  };
  function makeScribble(seed, spec, P = SCRIB) {
    const r = L.rng(seed);
    const pat = spec.pat.split('');
    const base = [0]; for (let k = 0; k < 12; k++) base.push((r() - 0.5) * 2 * 5); // baseline drift ±5 px
    let raw = [], x0 = 0;
    const cyc = []; pat.forEach((ch) => { for (let q = 0; q < LETTER[ch].n; q++) cyc.push(ch); });
    cyc.forEach((ch, k) => {
      const Lt = LETTER[ch];
      const H = Lt.H * (0.92 + r() * 0.16), a = Lt.a * (0.94 + r() * 0.12), b = a * Lt.k * (0.95 + r() * 0.1);
      const sl = P.slant * (0.9 + r() * 0.2);
      const n = 70;
      for (let j = k ? 1 : 0; j <= n; j++) {
        const psi = (j / n) * 2 * Math.PI;
        const yb = lerp(base[k], base[k + 1], (1 - Math.cos(psi / 2)) / 2);
        const hy = H * (1 - Math.cos(psi)) / 2;
        raw.push([x0 + a * psi + b * Math.sin(psi) + sl * hy, yb - hy]);
      }
      x0 += 2 * Math.PI * a;
    });
    // lead-in from lower left, arriving horizontally at the first trough; tail leaving the last trough horizontally
    const quad = (A, Cc, B, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * A[0] + 2 * u * t * Cc[0] + t * t * B[0], u * u * A[1] + 2 * u * t * Cc[1] + t * t * B[1]]); } return o; };
    const p0 = raw[0], pN = raw[raw.length - 1];
    const S0 = [p0[0] + spec.lead[0], p0[1] + spec.lead[1]];
    const lead = quad(S0, [p0[0] + spec.lead[0] * 0.45, p0[1] + 1], p0, 16).slice(0, -1);
    const E = [pN[0] + spec.tail[0], pN[1] + spec.tail[1]];
    const tail = quad(pN, [pN[0] + spec.tail[0] * 0.55, pN[1] + (spec.tail[1] < -20 ? 4 : spec.tail[1] * 0.3)], E, 24).slice(1);
    let pts = lead.concat(raw, tail);
    const leadLen = L.polyLength(lead.concat([p0]), false);
    // center on the bubble (ink bbox), tilt −4°, offset slightly right/down so any overflow is on the right
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const p of pts) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, ca = Math.cos(-4 * DEG), sa = Math.sin(-4 * DEG);
    pts = pts.map(([x, y]) => { x -= cx; y -= cy; return [x * ca - y * sa + spec.off[0], x * sa + y * ca + spec.off[1]]; });
    const dense = L.resampleBySpacing(pts, 2, false);
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + L.dist(dense[i - 1], dense[i]));
    const len = cum[cum.length - 1];
    const u = cum.map((c) => c / len);
    // width 8 → 15 → 7 px along the length, with brush pressure: downstrokes ~25 % heavier than upstrokes
    const n = dense.length, press = dense.map((p, i) => {
      const a = dense[Math.max(0, i - 3)], b = dense[Math.min(n - 1, i + 3)];
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return (b[1] - a[1]) / dl; // +1 straight down, −1 straight up
    });
    const w = u.map((s, i) => {
      const w0 = s < 0.4 ? lerp(P.w[0], P.w[1], ease.inOutSine(s / 0.4)) : lerp(P.w[1], P.w[2], ease.inOutSine((s - 0.4) / 0.6));
      return w0 * (0.9 + 0.22 * press[i]);
    });
    // uMeet: arc fraction of the first trough (end of the lead-in), where the un-write converges (see drawThoughts)
    return { pts: dense, u, w, len, seed, width: bx1 - bx0, height: by1 - by0, uMeet: leadLen / len };
  }

  // Variable-width ink ribbon along a precomputed line {pts, u (0..1 arc fraction), w, len, seed},
  // trimmed to [from, to]. Boil: centerline ±1.2 px and width ±8 %, smooth along the stroke, re-seeded at 12 fps.
  // Returns the head point (for the pen nib).
  function ribbon(ctx, line, from, to, t, o = {}) {
    if (to - from <= 1e-4) return null;
    const { pts, u, w, len, seed } = line, n = pts.length, b = L.boil(t);
    if ((to - from) * len < (o.minLen ?? 0)) return null; // never leave a lone speck or dot behind
    const ws = o.wscale ?? 1, cap = o.caps ?? true;
    const idx = (f) => { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (u[m] <= f) lo = m; else hi = m; } return lo; };
    const at = (f) => { const i = idx(f), j = Math.min(n - 1, i + 1), k = u[j] > u[i] ? clamp((f - u[i]) / (u[j] - u[i])) : 0; return [L.lerpPt(pts[i], pts[j], k), lerp(w[i], w[j], k)]; };
    const P = [], WW = [], SS = [];
    const a = at(from); P.push(a[0]); WW.push(a[1]); SS.push(from);
    for (let i = idx(from) + 1; i < n && u[i] < to; i++) { if (u[i] > from) { P.push(pts[i]); WW.push(w[i]); SS.push(u[i]); } }
    const z = at(to); P.push(z[0]); WW.push(z[1]); SS.push(to);
    if (P.length < 2) return null;
    const sd = seed * 7919 + b * 131;
    const left = [], right = [], C = [];
    for (let i = 0; i < P.length; i++) {
      const pa = P[Math.max(0, i - 1)], pb = P[Math.min(P.length - 1, i + 1)];
      let dx = pb[0] - pa[0], dy = pb[1] - pa[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const s = SS[i] * len;
      const ox = 1.2 * L.noise1(s / 38, sd), oy = 1.2 * L.noise1(s / 38, sd + 17);
      const hw = (WW[i] * ws * (1 + 0.08 * L.noise1(s / 55, sd + 33))) / 2;
      const c = [P[i][0] + ox, P[i][1] + oy];
      C.push([c, hw]);
      left.push([c[0] - dy * hw, c[1] + dx * hw]); right.push([c[0] + dy * hw, c[1] - dx * hw]);
    }
    ctx.fillStyle = o.color ?? PAL.ink;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
    if (cap) for (const [c, hw] of [C[0], C[C.length - 1]]) { ctx.beginPath(); ctx.arc(c[0], c[1], hw, 0, Math.PI * 2); ctx.fill(); }
    return C[C.length - 1][0];
  }

  // ---------------- per-bubble static geometry ----------------
  DEFS.forEach((d, i) => {
    d.i = i;
    d.poly = bubblePoly(d.seed);
    d.toSeed = Math.atan2(SEED_C[1] - d.c[1], SEED_C[0] - d.c[0]); // bubble -> seed direction
    d.out = d.toSeed + Math.PI;                                    // seed -> bubble direction (outward)
    d.rimSeed = rayHit(d.poly, d.toSeed);                          // rim point nearest the seed
    // TR's fan is turned 6° counter-clockwise and its top tick shortened, so it ends well left of the badge corner
    d.tickRim = (d.key === 'TR' ? [-34, -6, 22] : [-28, 0, 28]).map((da, k) => { const a = d.out + da * DEG; return { a, r: rayHit(d.poly, a), len: d.key === 'TR' && k === 0 ? 32 : TICK_LEN }; });
    d.scribble = makeScribble(d.seed + 7, SCRIB_SPEC[d.key]);
    d.puffPoly = { small: ngon(8, 0.09, d.seed + 31), big: ngon(8, 0.09, d.seed + 47) };
    d.spillPoly = ngon(20, 0.10, d.seed + 59, 0); // spec: 12-gon; 20 reads as a liquid flood rather than a polygon wipe
  });
  const SEED_POLY = ngon(10, 0.06, 1234);

  // ---------------- words: pre-rendered once, displaced per frame (spec §3.4 Beat C) ----------------
  const RS = 1.5;             // offscreen supersampling (words are shown up to ~1.4× on screen)
  const MARGIN = 40;
  const NS = 'http://www.w3.org/2000/svg';
  let dispNodes = null;       // [word][boil] -> feDisplacementMap element (scale set per draw)
  function makeFilters() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute;left:0;top:0');
    const defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    dispNodes = DEFS.map((d, wi) => [0, 1, 2].map((b) => {
      const f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', `thw-${wi}-${b}`);
      f.setAttribute('x', '-5%'); f.setAttribute('y', '-5%'); f.setAttribute('width', '110%'); f.setAttribute('height', '110%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      const tb = document.createElementNS(NS, 'feTurbulence');
      tb.setAttribute('type', 'fractalNoise'); tb.setAttribute('baseFrequency', String(0.035 / RS));
      tb.setAttribute('numOctaves', '2'); tb.setAttribute('seed', String(d.seed * 7919 + b));
      const dm = document.createElementNS(NS, 'feDisplacementMap');
      dm.setAttribute('in', 'SourceGraphic'); dm.setAttribute('scale', String(3 * RS));
      dm.setAttribute('xChannelSelector', 'R'); dm.setAttribute('yChannelSelector', 'G');
      f.appendChild(tb); f.appendChild(dm); defs.appendChild(f);
      return dm;
    }));
    document.body.appendChild(svg);
  }
  function makeWord(d) {
    const fam = 'Caveat Brush';
    const c0 = document.createElement('canvas').getContext('2d');
    let size = WORD_SIZE;
    c0.font = `400 ${size}px "${fam}"`;
    let m = c0.measureText(d.word);
    // auto-fit to 380 px, never below 100 px (all four words fit at 108 px: 236 / 332 / 314 / 375)
    if (m.width > WORD_MAXW) { size = Math.max(WORD_MIN, (size * WORD_MAXW) / m.width); c0.font = `400 ${size}px "${fam}"`; m = c0.measureText(d.word); }
    const asc = Math.ceil(m.actualBoundingBoxAscent), desc = Math.ceil(m.actualBoundingBoxDescent);
    const half = Math.ceil(Math.max(m.actualBoundingBoxLeft, m.actualBoundingBoxRight, m.width / 2));
    const wpx = Math.ceil((2 * half + 2 * MARGIN) * RS), hpx = Math.ceil((asc + desc + 2 * MARGIN) * RS);
    const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
    const cx = cv.getContext('2d');
    const ax = wpx / 2, ay = (MARGIN + asc) * RS; // anchor: baseline, horizontally centered
    cx.scale(RS, RS);
    cx.font = `400 ${size}px "${fam}"`; cx.fillStyle = PAL.ink; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.fillText(d.word, ax / RS, ay / RS);
    const tmp = document.createElement('canvas'); tmp.width = wpx; tmp.height = hpx;
    const inkC = [(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, (desc - asc) / 2]; // ink-bbox center rel. to anchor
    d.wordImg = { cv, tmp, ax, ay, size, width: m.width, inkC, cache: {} };
  }
  // Ink-bbox center of the word in bubble-local coords (baseline at +34, rotated by wrot).
  function wordLocalCenter(d) {
    const w = d.wordImg, a = d.wrot * DEG;
    return [w.inkC[0] * Math.cos(a) - w.inkC[1] * Math.sin(a), 34 + w.inkC[0] * Math.sin(a) + w.inkC[1] * Math.cos(a)];
  }
  // Draw the word in the current (bubble-local) transform. o: alpha, disp (displacement px), scale (about ink center), dy
  function drawWord(ctx, d, t, o = {}) {
    const w = d.wordImg; if (!w) return;
    const alpha = o.alpha ?? 1, disp = o.disp ?? 3, s = o.scale ?? 1;
    if (alpha <= 0.002 || s <= 0.001) return;
    const b = L.boil(t);
    const steady = Math.abs(disp - 3) < 0.05;
    let img = steady ? w.cache[b] : null;
    if (!img) {
      dispNodes[d.i][b].setAttribute('scale', (disp * RS).toFixed(2));
      const target = steady ? Object.assign(document.createElement('canvas'), { width: w.cv.width, height: w.cv.height }) : w.tmp;
      const tc = target.getContext('2d');
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, target.width, target.height);
      tc.filter = `url(#thw-${d.i}-${b})`;
      tc.drawImage(w.cv, 0, 0);
      tc.filter = 'none';
      if (steady) w.cache[b] = target;
      img = target;
    }
    ctx.save();
    ctx.translate(0, 34 + (o.dy ?? 0));
    ctx.rotate(d.wrot * DEG);
    ctx.translate(w.inkC[0], w.inkC[1]); ctx.scale(s, s); ctx.translate(-w.inkC[0], -w.inkC[1]);
    ctx.globalAlpha *= clamp(alpha);
    ctx.scale(1 / RS, 1 / RS);
    ctx.drawImage(img, -w.ax, -w.ay);
    ctx.restore();
  }
  SCENE_INIT.push(async () => { makeFilters(); DEFS.forEach(makeWord); });

  // ---------------- motion model ----------------
  // Idle bob once popped: y ±6 px, rotation ±1.5°, period 2.4 s, phase offsets 0 / 0.6 / 1.2 / 1.8 s.
  // Faded in over ~0.9 s after the pop so it starts without a jump.
  function bob(i, t) {
    const d = DEFS[i], tau = t - d.tP;
    if (tau <= 0) return [0, 0];
    const env = ease.inOutSine(clamp((tau - 0.1) / 0.8));
    const ph = (2 * Math.PI * (t - d.ph)) / 2.4;
    return [6 * Math.sin(ph) * env, 1.5 * DEG * Math.cos(ph) * env];
  }
  // Puffs follow 0.08 s behind at half the amplitude.
  function puffBob(i, t) { const [dy, r] = bob(i, t - 0.08); return [dy * 0.5, r * 0.5]; }

  // Ignition scale pulse 1 → 1.10 → 0.98 → 1.
  function ignPulse(tau) {
    if (tau <= 0 || tau >= 0.3) return 1;
    if (tau < 0.1) return 1 + 0.10 * ease.outQuad(tau / 0.1);
    if (tau < 0.2) return lerp(1.10, 0.98, ease.inOutSine((tau - 0.1) / 0.1));
    return lerp(0.98, 1.0, ease.inOutSine((tau - 0.2) / 0.1));
  }
  // Sympathetic word hop: y −8 px at τ 0.05, back by τ 0.20.
  function wordHop(tau) {
    if (tau <= 0 || tau >= 0.2) return 0;
    if (tau < 0.05) return -8 * ease.outQuad(tau / 0.05);
    return -8 * (1 - ease.inOutSine((tau - 0.05) / 0.15));
  }

  // Bubble group matrix during the thoughts scene: pop spring + squash wobble + emerge from the tail + bob + ignition pulse.
  function bubbleMatrix(i, t) {
    const d = DEFS[i], tau = t - d.tP;
    if (tau <= 0) return null;
    const s = L.SPRING_IN(tau, 3.2, 0.55);
    const wob = 0.10 * Math.sin(2 * Math.PI * 4 * tau) * Math.exp(-6 * tau);
    const rot = -8 * DEG * (1 - s);
    const em = 40 * (1 - ease.outCubic(clamp(tau / 0.30)));
    const [bdy, brot] = bob(i, t);
    const pulse = ignPulse(t - d.Ti);
    const x = d.c[0] + Math.cos(d.toSeed) * em, y = d.c[1] + Math.sin(d.toSeed) * em + bdy;
    // The pop spring scales about a point 60 % of the way to the rim facing the seed (not the bubble center),
    // so the bubble visibly inflates out of its puff tail instead of appearing mid-air.
    const ox = Math.cos(d.toSeed) * d.rimSeed * POP_ANCHOR, oy = Math.sin(d.toSeed) * d.rimSeed * POP_ANCHOR;
    return MX.chain(MX.tr(x, y), MX.rot(rot + brot), MX.tr(ox, oy), MX.sc(s * (1 + wob) * pulse, s * (1 - wob) * pulse), MX.tr(-ox, -oy));
  }

  // World-space, boiled outline of a bubble under matrix m.
  function bubbleWorld(d, m, t, id) { return S.boilPts(d.poly.map((p) => MX.ap(m, p)), id ?? 21 + d.i, t); }
  function fillShape(ctx, pts, color) { L.fillPoly(ctx, pts, color, { round: 6 }); }

  // A puff (8-gon) at world pos; radius 15 (small) or 26 (big) times s.
  function drawPuff(ctx, d, which, pos, s, color, t, rot = 0, extra) {
    if (s <= 0.002) return;
    const r = (which === 'small' ? 15 : 26) * s;
    const ca = Math.cos(rot), sa = Math.sin(rot);
    let pts = d.puffPoly[which].map(([x, y]) => [x * r, y * r]);
    if (extra) pts = pts.map((p) => MX.ap(extra, p));
    pts = pts.map(([x, y]) => [pos[0] + x * ca - y * sa, pos[1] + x * sa + y * ca]);
    fillShape(ctx, S.boilPts(pts, 31 + d.i * 2 + (which === 'big' ? 1 : 0), t), color);
  }

  // Seed: ORANGE 10-gon r 34 (±6 %). o: scale (uniform, about the center), sx/sy (about the bottom), dy, r
  function drawSeed(ctx, t, o = {}) {
    const R = o.r ?? SEED_R, sc = o.scale ?? 1, sx = o.sx ?? 1, sy = o.sy ?? 1, dy = o.dy ?? 0;
    const cx = SEED_C[0], bottom = SEED_C[1] + R;
    const pts = SEED_POLY.map(([x, y]) => [cx + x * R * sc * sx, bottom + dy + (y * R * sc - R) * sy]);
    fillShape(ctx, S.boilPts(pts, 11, t), PAL.orange);
  }

  // ---------------- seed timeline (4.20–8.21) ----------------
  function seedState(t) {
    // landing squash, bottom-anchored at y 589: sx = WOBBLE(τ; 0.45, 4, 0.12), sy = 1/sx
    let sx = L.WOBBLE(t - 4.20, 0.45, 4, 0.12), sy = 1 / sx;
    // breath from 4.55: 1 ± 0.04, 1.2 s period
    let sc = 1 + (t > 4.55 ? 0.04 * Math.sin((2 * Math.PI * (t - 4.55)) / 1.2) : 0);
    // pulse at each bubble pop: 1.12 → 1 (easeOutQuad, 0.12 s) after a 1-frame rise
    for (const d of DEFS) {
      const tau = t - d.tP;
      if (tau >= 0 && tau < 0.033) sc *= lerp(1, 1.12, ease.outQuad(tau / 0.033));
      else if (tau >= 0.033 && tau < 0.153) sc *= lerp(1.12, 1, ease.outQuad((tau - 0.033) / 0.12));
    }
    // a small blip as each ignition leaves the seed (the light travels outward from it)
    for (const d of DEFS) {
      const tau = t - d.iS;
      if (tau >= 0 && tau < 0.14) sc *= 1 + 0.06 * Math.sin((Math.PI * tau) / 0.14);
    }
    // Beat D hop: anticipation 6.97–7.05, up 20 px 7.05–7.15 (easeOutQuad, stretched sy 1.25 / sx 0.85),
    // down 7.15–7.25 (easeInQuad), landing squash sx 1.15 / sy 0.85 recovering by ~7.35.
    let dy = 0, st = 1;
    if (t >= 6.97 && t < 7.05) st = lerp(1, 0.88, ease.outQuad(remap(t, 6.97, 7.05)));
    else if (t >= 7.05 && t < 7.15) {
      const u = remap(t, 7.05, 7.15);
      dy = -20 * ease.outQuad(u);
      st = u < 0.3 ? lerp(0.88, 1.25, ease.outQuad(u / 0.3)) : lerp(1.25, 1.0, ease.inOutSine((u - 0.3) / 0.7));
    } else if (t >= 7.15 && t < 7.25) {
      const u = remap(t, 7.15, 7.25);
      dy = -20 * (1 - ease.inQuad(u));
      st = lerp(1.0, 1.08, ease.inQuad(u));
    } else if (t >= 7.25 && t < 7.50) {
      const w = L.WOBBLE(t - 7.25, 0.15, 5, 0.035);
      sx *= w; sy /= w;
    }
    if (st !== 1) { sy *= st; sx *= st > 1 ? 1 - (st - 1) * 0.6 : 1 + (1 - st); }
    return { sx, sy, scale: sc, dy };
  }

  // ---------------- small tapered ink tick ----------------
  function tick(ctx, p0, p1, from, to, width, id, t) {
    if ((to - from) * L.dist(p0, p1) < 6) return; // no end-of-stroke dots
    const pts = S.boilPts([p0, L.lerpPt(p0, p1, 0.5), p1], id, t, 1.2);
    L.brushStroke(ctx, pts, { width: width * (1 + 0.08 * L.noise1(L.boil(t) * 3.3, id)), from, to, taperIn: 0.3, taperOut: 0.35, wob: 0.06, seed: id, spacing: 1.5 });
  }

  // ---------------- the scene ----------------
  function drawThoughts(ctx, t) {
    // puffs (behind the bubbles)
    for (const d of DEFS) {
      for (const which of ['small', 'big']) {
        const t0 = which === 'small' ? d.tS : d.tB, ti = which === 'small' ? d.iS : d.iB;
        const tau = t - t0;
        if (tau <= 0) continue;
        let s = ease.outBack(clamp(tau / 0.12), 2.2);
        const it = t - ti, lit = it >= 0;
        if (lit && it < 0.12) s *= 1.3 - 0.3 * ease.outBack(it / 0.12);
        const [bdy, brot] = puffBob(d.i, t);
        drawPuff(ctx, d, which, [d[which][0], d[which][1] + bdy], s, lit ? PAL.orange : PAL.white, t, brot);
      }
    }
    // bubbles and their children
    for (const d of DEFS) {
      const m = bubbleMatrix(d.i, t);
      if (!m) continue;
      const pts = bubbleWorld(d, m, t);
      const ti = t - d.Ti;
      fillShape(ctx, pts, ti >= 0.25 ? PAL.orange : PAL.white);
      // orange spill from the rim point nearest the seed (irregular 12-gon r 0 → 520), clipped to the bubble
      if (ti >= 0 && ti < 0.25) {
        const R = 520 * ease.outCubic(ti / 0.25);
        const c = MX.ap(m, [Math.cos(d.toSeed) * d.rimSeed, Math.sin(d.toSeed) * d.rimSeed]);
        ctx.save();
        L.roundPolyPath(ctx, pts, 6); ctx.clip();
        fillShape(ctx, S.boilPts(d.spillPoly.map(([x, y]) => [c[0] + x * R, c[1] + y * R]), 41 + d.i, t), PAL.orange);
        ctx.restore();
      }
      ctx.save();
      ctx.transform(...m);
      const wt = t - d.w0, ru = (t - d.r0) / RESOLVE_DUR;
      // scribble write-on (easeInOutSine, 0.35 s) and, in Beat C, un-write from its end (easeInCubic)
      if (wt > 0 && ru < UNWRITE_K) {
        const p = ease.inOutSine(clamp(wt / WRITE_DUR));
        // Un-write (spec: from its end, easeInCubic over the whole 0.28 s). That left the full scribble crossing the
        // solid word for several frames ("for Imran" read as crossed out). Instead it retracts fast (easeOutCubic, gone
        // by ru 0.4) and thins to 0.3: the end retracts first (clearing the right of the word, i.e. "Imran", first)
        // while the lead-in swash is eaten from the start, both meeting at the first letter's foot, under the word.
        let from = 0, to = p, ws = 1;
        if (ru > 0) {
          const k = clamp(ru / UNWRITE_K);
          const meet = d.scribble.uMeet;
          to = lerp(p, meet, ease.outCubic(k));
          from = meet * ease.inOutSine(k);
          ws = lerp(1, 0.3, ease.outCubic(k));
        }
        const head = ribbon(ctx, d.scribble, from, to, t, { wscale: ws, minLen: ru > 0 ? 6 : 0 });
        // pen nib: INK dot r 6 riding the head while writing, scaling out over 0.06 s afterwards
        const nibS = wt < WRITE_DUR ? ease.outQuad(clamp(wt / 0.04)) : 1 - ease.inQuad(clamp((wt - WRITE_DUR) / 0.06));
        if (head && nibS > 0 && ru <= 0) { ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(head[0], head[1], NIB_R * nibS, 0, Math.PI * 2); ctx.fill(); }
      }
      // focus pull: the word comes out of the scribble (opacity, scale 1.15/1.25 → 1, displacement 28 → 3)
      if (ru > 0) {
        const tau = t - d.r0;
        drawWord(ctx, d, t, {
          alpha: clamp(tau / WORD_FADE), // spec 0.12 s; shorter so the half-opacity grey ghost lasts one frame
          scale: lerp(d.hero ? 1.25 : 1.15, 1, ease.outBack(clamp(ru))),
          disp: lerp(28, 3, ease.outCubic(clamp(ru))),
          dy: wordHop(ti),
        });
      }
      ctx.restore();
    }
    // ignition action ticks: INK, length 30, width 7, along seed→bubble and ±28°, from rim + 18 px
    for (const d of DEFS) {
      const ti = t - d.Ti;
      if (ti < 0.04 || ti > 0.30) continue;
      const m = bubbleMatrix(d.i, t), ctr = MX.ap(m, [0, 0]), pulse = ignPulse(ti);
      d.tickRim.forEach((rk, k) => {
        const tt = ti - [0.04, 0.07, 0.10][k];
        if (tt < 0 || tt > 0.20) return;
        let from = 0, to = 1, drift = 0;
        if (tt < 0.07) to = ease.outQuad(tt / 0.07);
        else if (tt > 0.13) { const u = (tt - 0.13) / 0.07; from = ease.inQuad(u); drift = 10 * ease.outQuad(u); }
        const r0 = rk.r * pulse + 18 + drift, dir = [Math.cos(rk.a), Math.sin(rk.a)];
        tick(ctx, [ctr[0] + dir[0] * r0, ctr[1] + dir[1] * r0], [ctr[0] + dir[0] * (r0 + rk.len), ctr[1] + dir[1] * (r0 + rk.len)], from, to, TICK_W, 61 + d.i * 3 + k, t);
      });
    }
    // seed (on top)
    const ss = seedState(t);
    drawSeed(ctx, t, ss);
    // Beat D joy ticks: two INK ticks 14 × 4 px at ±30° from vertical, from r 46 above the seed, 7.10–7.24
    if (t >= 7.10 && t < 7.24) {
      const tt = t - 7.10;
      let from = 0, to = 1;
      if (tt < 0.06) to = ease.outQuad(tt / 0.06); else if (tt > 0.08) from = ease.inQuad(clamp((tt - 0.08) / 0.06));
      [-30, 30].forEach((ang, k) => {
        const a = -Math.PI / 2 + ang * DEG, dir = [Math.cos(a), Math.sin(a)], c = [SEED_C[0], SEED_C[1] + ss.dy];
        tick(ctx, [c[0] + dir[0] * 46, c[1] + dir[1] * 46], [c[0] + dir[0] * (46 + JOY_LEN), c[1] + dir[1] * (46 + JOY_LEN)], from, to, JOY_W, 71 + k, t);
      });
    }
  }

  SCENE({ id: 'thoughts', start: 4.20, end: 8.21, layer: 'world', page: 'thought', z: 0,
    draw(ctx, lt, t) { drawThoughts(ctx, t); } });

  window.THOUGHTS = { makeScribble, SCRIB, SCRIB_SPEC, LETTER, DEFS, SEED_C, SEED_R, MX, bob, puffBob, bubbleMatrix, bubbleWorld, fillShape, drawPuff, drawSeed, seedState, drawWord, wordLocalCenter, ribbon, tick, ignPulse };
})();
