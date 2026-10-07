// "Powered by Sunlight" — scene, camera and timeline.
// renderFrame(t) draws the illustration layer and the separate text layer.
(function (PS) {
  'use strict';
  const {
    W, H, TAU, PAL, LW, LW_FINE, clamp, lerp, seg, smooth, lerpPt, dist, rot, deg, ease, bezierEase, monotone, rng, noise1,
    spline, quad, bezier, circlePts, resample, resampleN, wobble, centroid, xf, cam, setCam, toS, toSArr, anchorCam,
    stroke, fillPoly, polyPath, glow, mix, leafShape, droplet, hexagon, superellipse, blobCircle, cellShape,
  } = PS;

  // ------------------------------------------------------------------
  // audio cues (consumed by the sound-design script)
  const CUES = [];
  const cue = (t, type, o = {}) => CUES.push({ t: Math.round(t * 1000) / 1000, type, ...o });

  // ------------------------------------------------------------------
  // world layout
  const SUN = [480, 330], SUN_R = 92;
  const B = [1300, 700];                       // hero leaf base = stem junction
  const G = [1290, 1010];                      // stem meets soil
  const TH0 = deg(-95), TH1 = deg(-128);
  const HERO = leafShape({ len: 290, width: 150, petiole: 40, curve: 9, seed: 3, veins: [0.24, 0.44, 0.63] });
  const heroAngle = (t) => TH0 + (TH1 - TH0) * ease.settle(seg(t, 2.05, 2.9));
  const heroW1 = (pts) => xf(pts, B[0], B[1], TH1);

  const CONTACT_L = HERO.edge(-1, 0.55);
  const CONTACT = heroW1([CONTACT_L])[0];
  const HERO_CENTER = heroW1([HERO.center])[0];

  const RAY = (() => {
    const v = [CONTACT[0] - SUN[0], CONTACT[1] - SUN[1]];
    const L = Math.hypot(v[0], v[1]);
    const d = [v[0] / L, v[1] / L], n = [d[1], -d[0]];
    const P0 = [SUN[0] + d[0] * (SUN_R + 18), SUN[1] + d[1] * (SUN_R + 18)];
    const P1 = [P0[0] + d[0] * L * 0.3 + n[0] * L * 0.2, P0[1] + d[1] * L * 0.3 + n[1] * L * 0.2];
    const P2 = [CONTACT[0] - d[0] * L * 0.3 + n[0] * L * 0.17, CONTACT[1] - d[1] * L * 0.3 + n[1] * L * 0.17];
    return resample(bezier(P0, P1, P2, CONTACT, 80), 3);
  })();
  const rayAt = (f) => {
    const i = clamp(f) * (RAY.length - 1), k = Math.min(RAY.length - 2, Math.floor(i));
    return lerpPt(RAY[k], RAY[k + 1], i - k);
  };

  // stems and roots (world)
  const STEM_LOW = wobble(spline([B, [1306, 790], [1284, 905], G], 18), 1.1, 60, 41);
  const T_TOP = [1338, 432];
  const STEM_UP = wobble(spline([B, [1318, 602], [1332, 506], T_TOP], 18), 1.1, 60, 42);
  const atPath = (P, f) => { const R = resampleN(P, 101); return R[Math.round(clamp(f) * 100)]; };
  const ROOTS = [
    [[1290, 1012], [1286, 1080], [1295, 1140], [1284, 1196]],
    [[1289, 1028], [1240, 1052], [1202, 1092], [1172, 1128]],
    [[1291, 1036], [1342, 1064], [1376, 1104], [1394, 1142]],
    [[1288, 1094], [1252, 1124], [1232, 1162]],
    [[1290, 1108], [1324, 1140], [1338, 1172]],
  ].map((c, i) => wobble(spline(c, 12), 1.0, 40, 50 + i));
  const ROOT_T = [[7.2, 7.9], [7.35, 7.95], [7.45, 8.05], [7.6, 8.1], [7.65, 8.15]];

  // plant leaves
  const LEAF_R = { shape: leafShape({ len: 220, width: 122, petiole: 30, curve: -7, seed: 5, veins: [0.3, 0.55] }), at: atPath(STEM_LOW, 0.36), ang: deg(-30), from: deg(-75), t: [7.2, 7.95] };
  const LEAF_L = { shape: leafShape({ len: 172, width: 96, petiole: 26, curve: 6, seed: 6, veins: [0.32, 0.58] }), at: atPath(STEM_LOW, 0.72), ang: deg(-162), from: deg(-110), t: [7.4, 8.1] };
  const NEW_LEAVES = [
    { shape: leafShape({ len: 200, width: 112, petiole: 28, curve: -6, seed: 7, veins: [0.3, 0.56] }), at: atPath(STEM_UP, 0.38), ang: deg(-24), from: deg(-80), t: [17.15, 17.95] },
    { shape: leafShape({ len: 166, width: 92, petiole: 24, curve: 6, seed: 8, veins: [0.32, 0.58] }), at: atPath(STEM_UP, 0.72), ang: deg(-56), from: deg(-88), t: [17.4, 18.2] },
    { shape: leafShape({ len: 116, width: 64, petiole: 14, curve: -4, seed: 9, veins: [0.36] }), at: T_TOP, ang: deg(-118), from: deg(-92), t: [17.65, 18.4] },
    { shape: leafShape({ len: 124, width: 68, petiole: 14, curve: 4, seed: 10, veins: [0.36] }), at: T_TOP, ang: deg(-66), from: deg(-90), t: [17.7, 18.45] },
  ];

  // soil line (world), split at the stem
  const SOIL_N = noise1(77);
  const soilY = (x) => 1010 + 5 * SOIL_N(x / 260) + 2.5 * SOIL_N(x / 70 + 9);
  const SOIL_L = []; for (let x = G[0]; x >= -760; x -= 8) SOIL_L.push([x, soilY(x)]);
  const SOIL_R = []; for (let x = G[0]; x <= 3360; x += 8) SOIL_R.push([x, soilY(x)]);
  const soilExtent = (t) => {
    const a = 560 * ease.outCubic(seg(t, 7.05, 7.7));
    const b = 3000 * ease.inOutCubic(seg(t, 18.0, 19.4));
    return Math.max(a, b);
  };
  const SPECKS = (() => {
    const r = rng(404), out = [];
    for (let i = 0; i < 70; i++) {
      const x = -700 + r() * 4000, y = 1036 + r() * 110, a = (r() - 0.5) * 0.8, l = 6 + r() * 7;
      if (Math.abs(x - G[0]) < 150) continue;
      out.push({ x, pts: [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]] });
    }
    return out;
  })();

  // micro world (cp units = screen px when fully zoomed in)
  const L_LOCAL = [HERO.X(0.52), HERO.YC(0.52) - 0.3 * HERO.HW(0.52)];
  const LENS = heroW1([L_LOCAL])[0];
  const LENS_R = 40;
  const K = 150, CP0 = [960, 470];

  // garden framing
  const GARDEN_C = [1130, 760], GARDEN_Z = 0.6;
  const S_GARDEN = [(LENS[0] - GARDEN_C[0]) * GARDEN_Z + W / 2, (LENS[1] - GARDEN_C[1]) * GARDEN_Z + H / 2];

  // ------------------------------------------------------------------
  // camera
  const LN = Math.log;
  const camFree = {
    x: monotone([[0, 480], [0.8, 480], [2.15, 905], [2.95, 918], [3.95, 1218], [6.55, 1222], [7.95, 1150], [10.75, 1140]]),
    y: monotone([[0, 330], [0.8, 330], [2.15, 522], [2.95, 528], [3.95, 595], [6.55, 592], [7.95, 800], [10.75, 796]]),
    lz: monotone([[0, LN(1.28)], [0.8, LN(1.28)], [2.15, 0], [2.95, LN(1.03)], [3.95, LN(2.05)], [6.55, LN(2.14)], [7.95, LN(0.78)], [10.75, LN(0.81)]]),
  };
  const T_DIVE = 10.75, T_PULL = 15.55, T_GARDEN = 19.9;
  const diveLZ = monotone([[T_DIVE, LN(0.81)], [11.1, LN(1.35)], [11.45, LN(8)], [11.8, LN(60)], [12.2, LN(166)], [T_PULL, LN(174)]]);
  const pullLZ = monotone([[T_PULL, LN(174)], [16.05, LN(42)], [16.5, LN(5)], [16.95, LN(1.3)], [18.0, LN(0.78)], [T_GARDEN, LN(GARDEN_Z)]]);
  let DIVE_S0 = null;

  function camAt(t) {
    if (t < T_DIVE) { setCam(camFree.x(t), camFree.y(t), Math.exp(camFree.lz(t))); return; }
    if (!DIVE_S0) {
      setCam(camFree.x(T_DIVE), camFree.y(T_DIVE), Math.exp(camFree.lz(T_DIVE)));
      DIVE_S0 = toS(LENS);
    }
    let z, S;
    if (t < T_PULL) {
      z = Math.exp(diveLZ(t));
      S = lerpPt(DIVE_S0, CP0, ease.inOutCubic(seg(t, T_DIVE, 11.85)));
    } else {
      z = Math.exp(pullLZ(t));
      S = lerpPt(CP0, S_GARDEN, ease.inOutCubic(seg(t, 15.9, T_GARDEN)));
    }
    const c = anchorCam(LENS, S, z);
    setCam(c[0], c[1], z);
  }

  // ------------------------------------------------------------------
  // display list
  let DL = [], LABELS = [];
  const dStroke = (pts, o = {}) => DL.push({ k: 'stroke', pts, ...o });
  const dFill = (pts, color, o = {}) => DL.push({ k: 'fill', pts, color, ...o });
  const dFn = (fn, o = {}) => DL.push({ k: 'fn', fn, ...o });
  const label = (text, x, y, o = {}) => LABELS.push({ text, x, y, size: 33, alpha: 1, align: 'left', ...o });
  const S = (pts) => toSArr(pts);
  const onScreen = (p, m = 200) => p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < H + m;

  function renderDL(ctx, list) {
    for (const e of list) {
      if (e.k === 'stroke') stroke(ctx, e.pts, e);
      else if (e.k === 'fill') fillPoly(ctx, e.pts, e.color, e.alpha ?? 1);
      else if (e.k === 'fn') { ctx.save(); e.fn(ctx); ctx.restore(); }
    }
  }

  // generic leaf drawer (world placement)
  function leafDL(shape, at, angle, scale, st) {
    const T = (pts) => S(xf(pts, at[0], at[1], angle, scale));
    const fillS = T(shape.fill);
    if ((st.fillA ?? 0) > 0) dFill(fillS, st.fillColor ?? PAL.green, { alpha: st.fillA, morph: 'green' });
    if (st.soak) {
      const blob = T(st.soak.pts);
      const wet = st.soak.wet;
      dFn((ctx) => {
        ctx.beginPath(); polyPath(ctx, fillS); ctx.clip();
        fillPoly(ctx, blob, PAL.green, 1);
        if (wet > 0) {
          ctx.lineJoin = 'round';
          ctx.strokeStyle = PAL.greenDark;
          ctx.globalAlpha = 0.38 * wet;
          ctx.lineWidth = 9;
          ctx.beginPath(); polyPath(ctx, blob); ctx.stroke();
          ctx.globalAlpha = 0.18 * wet;
          ctx.lineWidth = 22;
          ctx.beginPath(); polyPath(ctx, blob); ctx.stroke();
        }
      });
    }
    const w = st.width ?? LW;
    if ((st.pet ?? 1) > 0) dStroke(T(shape.petiole), { to: st.pet ?? 1, width: w, morph: 1 });
    if ((st.edge ?? 1) > 0) {
      dStroke(T(shape.left), { to: st.edge ?? 1, width: w, morph: 1 });
      dStroke(T(shape.right), { to: st.edge ?? 1, width: w, morph: 1 });
    }
    if ((st.mid ?? 0) > 0) dStroke(T(shape.mid), { to: st.mid, width: w, morph: 1 });
    if (st.veins) shape.veins.forEach((v, i) => { const p = st.veins[i >> 1] ?? 0; if (p > 0) dStroke(T(v), { to: p, width: w, morph: 1 }); });
  }

  // ------------------------------------------------------------------
  // SCENE 1–2: sun, ray, hero leaf
  const SUN_DISC = blobCircle(1, 21, 0.02);
  const SUN_OUT = wobble(circlePts(0, 0, SUN_R + 3, 90, deg(200), deg(348)), 1.4, 50, 22);
  cue(0.25, 'pop', { x: 0 });
  cue(0.55, 'swell', { x: 0, dur: 0.8 });
  cue(1.15, 'scratch', { x: -0.2, dur: 0.6 });
  cue(1.05, 'scratch', { x: 0.35, dur: 0.8 });
  cue(1.35, 'shimmer', { x: 0, dur: 1.1 });
  cue(2.05, 'rustle', { x: 0.35, dur: 0.7 });

  function sunDL(t, fade = 1) {
    if (t < 0.25 || fade <= 0) return;
    const pop = ease.outBack(seg(t, 0.25, 0.45), 2.2);
    const grow = ease.outCubic(seg(t, 0.55, 1.3));
    const r = lerp(10 * pop, SUN_R, grow);
    const c = toS(SUN), z = cam.z;
    // halo + radiating rings
    dFn((ctx) => {
      ctx.globalAlpha = fade;
      glow(ctx, c[0], c[1], r * z * 2.4, 'rgba(248,212,119,0.55)', 0.85 * smooth(0.5, 1.4, t));
      for (let k = 0; k < 20; k++) {
        const t0 = 1.35 + k * 1.25, a = t - t0;
        if (a < 0 || a > 1.9) continue;
        const rr = r * z * (1.16 + 0.75 * (a / 1.9));
        ctx.globalAlpha = fade * 0.5 * Math.pow(1 - a / 1.9, 1.5);
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, TAU); ctx.stroke();
      }
    }, { morph: 'fade' });
    dFill(S(xf(SUN_DISC, SUN[0], SUN[1], 0, r)), PAL.gold, { alpha: fade, morph: 'gold' });
    const op = ease.inOutCubic(seg(t, 1.15, 1.75));
    if (op > 0) dStroke(S(xf(SUN_OUT, SUN[0] - 7, SUN[1] - 5, 0, r / SUN_R)), { to: op, alpha: fade, morph: 1 });
  }

  function rayDL(t) {
    const head = t < 3.0 ? 0.62 * ease.inOutSine(seg(t, 1.35, 2.45)) : lerp(0.62, 1, ease.inOutCubic(seg(t, 3.0, 3.9)));
    const tail = ease.inCubic(seg(t, 3.95, 4.6));
    if (head <= 0 || tail >= 1) return;
    const pts = S(RAY);
    dFn((ctx) => {
      stroke(ctx, pts, { from: tail, to: head, width: 26, color: PAL.goldLight, alpha: 0.55 });
      stroke(ctx, pts, { from: tail, to: head, width: 11, color: PAL.gold });
      const h = toS(rayAt(head));
      if (tail < 0.98) glow(ctx, h[0], h[1], 34, 'rgba(250,218,128,0.95)', 1 - tail);
    });
  }

  // ink-soak blob in hero-leaf local coordinates
  const SOAK_N1 = noise1(61), SOAK_N2 = noise1(62);
  function soakBlob(R) {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const k = 1 + 0.24 * SOAK_N1(ca * 1.6 + 4) + 0.12 * SOAK_N2(sa * 3.1 + ca * 2.2 + 9);
      pts.push([CONTACT_L[0] + ca * R * k, CONTACT_L[1] + sa * R * k * 0.92]);
    }
    return pts;
  }

  cue(3.0, 'whoosh', { x: 0.2, dur: 0.9, up: 1 });
  cue(3.92, 'sparkle', { x: 0.1 });
  cue(3.98, 'soak', { x: 0.05, dur: 1.2 });
  cue(4.75, 'scratch', { x: 0, dur: 0.5 });
  [0, 1, 2].forEach((k) => cue(5.1 + k * 0.2, 'tick', { x: 0, n: k }));

  function heroDL(t) {
    if (t < 1.05) return;
    const ang = heroAngle(t);
    const st = {
      pet: ease.outCubic(seg(t, 1.05, 1.3)),
      edge: ease.inOutCubic(seg(t, 1.15, 1.85)),
      mid: ease.outCubic(seg(t, 4.75, 5.25)),
      veins: [0, 1, 2].map((k) => ease.outCubic(seg(t, 5.1 + 0.2 * k, 5.42 + 0.2 * k))),
      fillA: t >= 5.15 ? 1 : 0,
    };
    if (t >= 3.95 && t < 5.15) {
      const p = seg(t, 3.95, 5.15);
      st.soak = { pts: soakBlob(380 * ease.outQuad(p) + 2), wet: 1 - ease.inQuad(p) };
    }
    leafDL(HERO, B, ang, 1, st);
    // sparkle where the ray lands
    if (t > 3.88 && t < 4.6) {
      const a = seg(t, 3.88, 4.6), c = toS(CONTACT);
      dFn((ctx) => {
        glow(ctx, c[0], c[1], 90 * ease.outCubic(a) + 20, 'rgba(250,218,128,0.9)', 1 - a);
        ctx.fillStyle = PAL.gold;
        for (let i = 0; i < 7; i++) {
          const an = deg(-150 + i * 34), rr = 26 + 70 * ease.outCubic(a);
          ctx.globalAlpha = 1 - a;
          ctx.beginPath(); ctx.arc(c[0] + Math.cos(an) * rr, c[1] + Math.sin(an) * rr, 6 * (1 - a) + 1.5, 0, TAU); ctx.fill();
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // SCENE 3: plant, soil, roots, water, CO2
  cue(6.75, 'scratch', { x: 0.2, dur: 0.7 });
  cue(7.05, 'scratch', { x: 0, dur: 0.6, soft: 1 });
  cue(7.2, 'rustle', { x: 0.3, dur: 0.6 });
  cue(7.4, 'rustle', { x: -0.1, dur: 0.6 });
  ROOT_T.forEach((r, i) => cue(r[0], 'scratch', { x: 0.1 * (i % 2 ? 1 : -1), dur: r[1] - r[0], soft: 1 }));

  function soilDL(t) {
    const ext = soilExtent(t);
    if (ext <= 0) return;
    const fL = Math.min(1, ext / (G[0] + 760)), fR = Math.min(1, ext / (3360 - G[0]));
    const sl = S(SOIL_L), sr = S(SOIL_R);
    // soil tint
    const x0 = G[0] - ext, x1 = G[0] + ext;
    const a = smooth(7.05, 7.6, t);
    dFn((ctx) => {
      const p0 = toS([x0, 1010]), p1 = toS([x1, 1010]);
      const gr = ctx.createLinearGradient(p0[0], 0, p1[0], 0);
      const e = Math.min(0.2, 120 / Math.max(1, p1[0] - p0[0]));
      gr.addColorStop(0, 'rgba(234,223,196,0)');
      gr.addColorStop(e, 'rgba(234,223,196,1)');
      gr.addColorStop(1 - e, 'rgba(234,223,196,1)');
      gr.addColorStop(1, 'rgba(234,223,196,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = gr;
      ctx.beginPath();
      const top = [];
      for (let x = x0; x <= x1; x += 16) top.push(toS([x, soilY(x) + 2]));
      ctx.moveTo(top[0][0], top[0][1]);
      for (const p of top) ctx.lineTo(p[0], p[1]);
      const yb = toS([0, 1900])[1];
      ctx.lineTo(top[top.length - 1][0], Math.max(yb, H + 10));
      ctx.lineTo(top[0][0], Math.max(yb, H + 10));
      ctx.closePath();
      ctx.fill();
    }, { morph: 'fade' });
    for (const s of SPECKS) {
      if (Math.abs(s.x - G[0]) > ext * 0.95) continue;
      dStroke(S(s.pts), { width: LW_FINE, alpha: 0.55 * a, morph: 'fade' });
    }
    dStroke(sl, { to: fL, morph: 1 });
    dStroke(sr, { to: fR, morph: 1 });
  }

  function stemDL(pts, p, alpha = 1) {
    if (p <= 0) return;
    const sp = S(pts);
    const off = sp.map((q) => [q[0] + 4, q[1] + 3]);
    dStroke(off, { to: p, width: Math.max(10, 15 * Math.min(1, cam.z)), color: PAL.green, alpha, morph: 'fadeline' });
    dStroke(sp, { to: p, alpha, morph: 1 });
  }

  function growLeafDL(L, t) {
    const p = seg(t, L.t[0], L.t[1]);
    if (p <= 0) return;
    const sc = lerp(0.25, 1, ease.settle(p));
    const ang = lerp(L.from, L.ang, ease.settle(seg(t, L.t[0], L.t[1] + 0.1)));
    leafDL(L.shape, L.at, ang, sc, {
      pet: ease.outCubic(seg(p, 0, 0.3)),
      edge: ease.outCubic(seg(p, 0.1, 0.75)),
      mid: ease.outCubic(seg(p, 0.45, 0.95)),
      veins: L.shape.veins.map((_, i) => ease.outCubic(seg(p, 0.6 + i * 0.06, 1))),
      fillA: smooth(0.35, 0.8, p),
    });
  }

  function plantDL(t) {
    if (t < 6.75) return;
    const lowP = ease.inOutCubic(seg(t, 6.75, 7.45));
    stemDL(STEM_LOW, lowP);
    ROOTS.forEach((r, i) => {
      const p = ease.outCubic(seg(t, ROOT_T[i][0], ROOT_T[i][1]));
      if (p > 0) dStroke(S(r), { to: p, morph: 1 });
    });
    stemDL(STEM_UP, ease.inOutCubic(seg(t, 16.95, 17.6)));
    growLeafDL(LEAF_L, t);
    growLeafDL(LEAF_R, t);
    NEW_LEAVES.forEach((L) => growLeafDL(L, t));
  }

  // water droplet paths: root tip -> stem -> petiole -> leaf
  const PETIOLE_W = heroW1(HERO.petiole), MID_W = heroW1(HERO.mid);
  const STEM_LOW_REV = STEM_LOW.slice().reverse();
  const toLeafPath = [...STEM_LOW_REV, ...PETIOLE_W, ...MID_W.slice(0, 14)];
  const WATER = [0, 1, 2].map((i) => {
    const root = ROOTS[[1, 0, 2][i]].slice().reverse();
    return { path: resample([...root, ...toLeafPath], 4), t0: 7.6 + i * 0.28, dur: 1.75 };
  });
  WATER.forEach((d, i) => { cue(d.t0, 'plip', { x: 0.15, n: i }); cue(d.t0 + d.dur - 0.1, 'bloop', { x: 0.05, n: i }); });
  const DROP = droplet(1);

  function dropletAt(pos, dir, size, alpha = 1, morph = 'fade') {
    const a = Math.atan2(dir[1], dir[0]) + Math.PI / 2;
    const pts = xf(DROP, pos[0], pos[1], a, size);
    dFill(pts, PAL.water, { alpha, morph });
    dStroke(pts, { width: Math.max(2, Math.min(3.5, size * 0.3)), alpha, morph });
    dFn((ctx) => {
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#FFFFFF';
      const hp = [pos[0] + Math.cos(a + 2.4) * size * 0.45, pos[1] + Math.sin(a + 2.4) * size * 0.45];
      ctx.beginPath(); ctx.ellipse(hp[0], hp[1], size * 0.2, size * 0.3, a, 0, TAU); ctx.fill();
    });
  }

  function waterDL(t) {
    WATER.forEach((d, i) => {
      const p = seg(t, d.t0, d.t0 + d.dur);
      if (p <= 0 || p >= 1) return;
      const f = ease.inOutSine(p);
      const idx = f * (d.path.length - 1), k = Math.min(d.path.length - 2, Math.floor(idx));
      const pos = toS(lerpPt(d.path[k], d.path[k + 1], idx - k));
      const nxt = toS(d.path[Math.min(d.path.length - 1, k + 3)]);
      const prv = toS(d.path[Math.max(0, k - 3)]);
      const dir = [nxt[0] - prv[0], nxt[1] - prv[1]];
      const s = 13 * ease.outBack(seg(p, 0, 0.12)) * (1 - ease.inCubic(seg(p, 0.86, 1)));
      dropletAt(pos, dir, s);
      if (i === 0) {
        const la = smooth(0.02, 0.12, p) * (1 - smooth(0.62, 0.74, p));
        if (la > 0) label('H_2O', pos[0] + 30, pos[1] + 6, { alpha: la });
      }
    });
  }

  // CO2 drifting into the leaf
  const CO2 = [
    { from: [740, 455], u: 0.5, side: -1, t0: 8.65 },
    { from: [800, 610], u: 0.32, side: -1, t0: 8.82 },
    { from: [690, 735], u: 0.2, side: -1, t0: 8.99 },
    { from: [870, 360], u: 0.72, side: -1, t0: 9.16 },
  ].map((c, i) => {
    const e = heroW1([[HERO.X(c.u), HERO.YC(c.u) + c.side * HERO.HW(c.u) * 0.55]])[0];
    const mid = [(c.from[0] + e[0]) / 2, (c.from[1] + e[1]) / 2 - 40 + i * 18];
    const base = resample(quad(c.from, mid, e, 40), 4);
    const n = noise1(300 + i);
    const path = base.map((p, j) => {
      const f = j / (base.length - 1);
      return [p[0], p[1] + 14 * Math.sin(f * TAU * 1.3 + i) * (1 - f) + 6 * n(f * 4)];
    });
    return { path, t0: c.t0, dur: 1.3 };
  });
  CO2.forEach((c, i) => { cue(c.t0, 'puff', { x: -0.5 + i * 0.05, n: i }); cue(c.t0 + c.dur - 0.12, 'tick', { x: 0.05, soft: 1, n: i + 3 }); });

  function co2DL(t) {
    CO2.forEach((c) => {
      const p = seg(t, c.t0, c.t0 + c.dur);
      if (p <= 0 || p >= 1) return;
      const f = ease.inOutSine(p);
      const P = S(c.path);
      const idx = f * (P.length - 1), k = Math.min(P.length - 2, Math.floor(idx));
      const pos = lerpPt(P[k], P[k + 1], idx - k);
      const sc = ease.outBack(seg(p, 0, 0.15)) * (1 - ease.inCubic(seg(p, 0.85, 1)));
      const trailFrom = Math.max(0, f - 0.22);
      dFn((ctx) => {
        ctx.setLineDash([2, 12]);
        stroke(ctx, P, { from: trailFrom, to: f, width: 4, alpha: 0.45 * sc });
        ctx.setLineDash([]);
        ctx.globalAlpha = sc > 0 ? 1 : 0;
        ctx.fillStyle = PAL.ink;
        ctx.beginPath(); ctx.arc(pos[0], pos[1], 9 * sc, 0, TAU); ctx.fill();
      }, { morph: 'fade' });
      const la = smooth(0.05, 0.16, p) * (1 - smooth(0.78, 0.9, p));
      if (la > 0) label('CO_2', pos[0] + 17, pos[1] + 1, { alpha: la });
    });
  }

  // ------------------------------------------------------------------
  // SCENE 4: lens, cells, chloroplast
  const MICRO = (() => {
    const r = rng(99);
    const TC = [960, 470 + 2300], RC = 3300, D = 6800;
    const cells = [];
    const rotL = deg(8);
    for (let q = -2; q <= 2; q++) {
      for (let s = -2; s <= 2; s++) {
        if (Math.abs(q + s) > 2) continue;
        let x = D * (q + s / 2), y = D * (s * Math.sqrt(3) / 2);
        [x, y] = rot([x, y], rotL);
        const target = q === 0 && s === 0;
        const c = target ? TC : [TC[0] + x + (r() - 0.5) * 300, TC[1] + y + (r() - 0.5) * 300];
        const shape = xf(cellShape(RC * (target ? 1 : 0.96 + r() * 0.08), 500 + cells.length), c[0], c[1], r() * TAU);
        const chl = [];
        for (let k = 0; k < 8; k++) {
          const tk = target && k === 0;
          const a = deg(-90) + (k * TAU) / 8 + (tk ? 0 : (r() - 0.5) * 0.16);
          const rr = tk ? 2300 : 2300 * (0.97 + r() * 0.06);
          chl.push({ c: [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr], ang: tk ? 0 : a + Math.PI / 2 + (r() - 0.5) * 0.3, s: tk ? 1 : 0.9 + r() * 0.12, target: tk });
        }
        cells.push({ c, shape, chl, target });
      }
    }
    return { cells };
  })();
  const CHLORO = wobble(superellipse(520, 250, 2.5, 140), 3.5, 130, 801, true);
  const CHLORO_IN = wobble(superellipse(498, 230, 2.5, 140), 2.5, 130, 802, true);
  const GRANA_MINI = [[-230, 30, 70, 30], [0, -34, 74, 30], [230, 24, 70, 30]];
  const STACKS = [[700, 468], [842, 522], [984, 452]];
  const DISC = wobble(superellipse(60, 12.5, 3.2, 48), 0.8, 30, 803, true);
  const CYCLE_C = [1238, 470], CYCLE_R = 76;
  const LAMELLAE = [
    quad([760, 482], [790, 500], [782, 510], 12),
    quad([902, 508], [924, 480], [924, 466], 12),
    quad([640, 454], [610, 462], [580, 470], 12),
    quad([1044, 466], [1100, 470], [1158, 474], 14),
  ].map((p, i) => wobble(p, 1.2, 40, 810 + i));

  const PULSES = [
    { hit: 12.5, from: [300, -70], s: 0 }, { hit: 12.75, from: [450, -90], s: 1 }, { hit: 13.0, from: [600, -100], s: 2 },
    { hit: 13.5, from: [330, -80], s: 0 }, { hit: 14.0, from: [620, -100], s: 2 }, { hit: 14.5, from: [470, -90], s: 1 }, { hit: 15.0, from: [320, -80], s: 0 },
  ].map((p) => ({ ...p, to: [STACKS[p.s][0], STACKS[p.s][1] - 60] }));
  PULSES.forEach((p, i) => cue(p.hit, 'ping', { x: (p.to[0] - 960) / 960, n: i, soft: i > 2 ? 1 : 0 }));
  const H2O_CP = [
    { from: [40, 1010], ctrl: [300, 650], s: 0, t0: 12.6, arr: 13.3, split: 14.0 },
    { from: [-60, 900], ctrl: [360, 700], s: 1, t0: 12.8, arr: 13.5, split: 14.25 },
    { from: [120, 1110], ctrl: [520, 760], s: 2, t0: 13.0, arr: 13.7, split: 14.5 },
  ].map((d) => ({ ...d, to: [STACKS[d.s][0], STACKS[d.s][1] + 66], path: resample(quad(d.from, d.ctrl, [STACKS[d.s][0], STACKS[d.s][1] + 66], 40), 4) }));
  H2O_CP.forEach((d, i) => { cue(d.t0 + 0.2, 'plip', { x: -0.6, n: i + 3, soft: 1 }); cue(d.split, 'bubble', { x: (d.to[0] - 960) / 960, n: i }); });
  const CO2_CP = [
    { from: [1620, -40], t0: 12.75, arr: 13.35 },
    { from: [1730, 70], t0: 12.9, arr: 13.5 },
    { from: [1540, -100], t0: 13.05, arr: 13.62 },
  ].map((c, i) => ({ ...c, path: resample(quad(c.from, [c.from[0] - 60, 300], [CYCLE_C[0], CYCLE_C[1] - CYCLE_R], 40), 4) }));
  CO2_CP.forEach((c, i) => cue(c.t0, 'puff', { x: 0.6, n: i + 4, soft: 1 }));
  const SUGAR_CP = [
    { pop: 13.75, to: [1575, 815], ctrl: [1440, 560], t1: 15.3 },
    { pop: 14.3, to: [1720, 690], ctrl: [1520, 470], t1: 15.55 },
  ];
  SUGAR_CP.forEach((s, i) => cue(s.pop, 'clink', { x: 0.3, n: i }));
  const SPARKS = [13.05, 13.2, 13.35];
  cue(10.8, 'scratch', { x: 0.1, dur: 0.35, soft: 1 });
  cue(10.95, 'whoosh', { x: 0, dur: 1.25, up: 1, big: 1 });
  cue(12.1, 'swell', { x: 0, dur: 0.6, soft: 1 });

  function lensState(t) {
    const open = ease.inOutCubic(seg(t, 10.8, 11.12));
    const close = ease.inOutCubic(seg(t, 16.75, 17.05));
    return { draw: t < 16.75 ? open : 1 - close, content: t < 16.75 ? smooth(10.85, 11.05, t) : 1 - smooth(16.75, 17.0, t) };
  }

  function microDL(t) {
    const ls = lensState(t);
    if (ls.content <= 0 && ls.draw <= 0) return;
    const Ls = toS(LENS), z = cam.z, f = z / K;
    const R = LENS_R * z;
    const cpS = (p) => [Ls[0] + (p[0] - CP0[0]) * f, Ls[1] + (p[1] - CP0[1]) * f];
    const cpSA = (pts) => pts.map(cpS);
    const clip = R < 1250;
    dFn((ctx) => {
      if (ls.content <= 0) return;
      ctx.globalAlpha = ls.content;
      if (clip) { ctx.beginPath(); ctx.arc(Ls[0], Ls[1], R, 0, TAU); ctx.clip(); }
      ctx.fillStyle = PAL.greenLight;
      ctx.fillRect(0, 0, W, H);
      const wCell = LW_FINE * Math.min(1, z / 8);
      const wChl = LW * Math.min(1, z / K);
      const stromaCol = mix(PAL.greenMid, PAL.stroma, smooth(20, 75, z));
      for (const cell of MICRO.cells) {
        const cs = cpS(cell.c), rad = 3500 * f;
        if (cs[0] + rad < 0 || cs[0] - rad > W || cs[1] + rad < 0 || cs[1] - rad > H) continue;
        const sh = cpSA(cell.shape);
        fillPoly(ctx, sh, PAL.cellFill, 1);
        stroke(ctx, sh, { width: wCell, alpha: 0.85 });
        for (const ch of cell.chl) {
          const c = cpS(ch.c), rr = 540 * f * ch.s;
          if (c[0] + rr < 0 || c[0] - rr > W || c[1] + rr < 0 || c[1] - rr > H) continue;
          const outl = xf(CHLORO, c[0], c[1], ch.ang, f * ch.s);
          fillPoly(ctx, outl, ch.target ? stromaCol : mix(PAL.greenMid, PAL.stroma, smooth(20, 75, z) * 0.8), 1);
          if (!ch.target || z < 30) {
            if (rr > 25) {
              for (const g of GRANA_MINI) {
                const gc = xf([[g[0], g[1]]], c[0], c[1], ch.ang, f * ch.s)[0];
                ctx.fillStyle = PAL.greenDark;
                ctx.globalAlpha = ls.content * smooth(25, 60, rr) * (ch.target ? 1 - smooth(18, 30, z) : 1);
                ctx.beginPath(); ctx.ellipse(gc[0], gc[1], g[2] * f * ch.s, g[3] * f * ch.s, ch.ang, 0, TAU); ctx.fill();
                ctx.globalAlpha = ls.content;
              }
            }
          }
          if (wChl > 0.6) stroke(ctx, outl, { width: wChl });
        }
      }
    });
    if (z > 14) targetChloroDL(t, f, cpS, cpSA, ls.content);
    // lens rim (constant weight)
    if (ls.draw > 0 && R < 2600) {
      const rim = circlePts(Ls[0], Ls[1], R, 160, deg(-90), TAU);
      dStroke(rim, { to: ls.draw, morph: 'fade' });
    }
  }

  function targetChloroDL(t, f, cpS, cpSA, alpha) {
    const z = cam.z;
    const dA = smooth(25, 80, z) * alpha;
    if (dA <= 0) return;
    const w = LW * Math.min(1, z / K), wf = LW_FINE * Math.min(1, z / K);
    const glowOf = (s) => {
      let g = 0;
      for (const p of PULSES) if (p.s === s && t >= p.hit) g += Math.exp(-(t - p.hit) / 0.32);
      return Math.min(1.2, g);
    };
    dFn((ctx) => {
      ctx.globalAlpha = dA;
      stroke(ctx, cpSA(xf(CHLORO_IN, CP0[0], CP0[1])), { width: Math.max(1, 3 * Math.min(1, z / K)), color: PAL.greenDark, alpha: 0.55 });
      LAMELLAE.forEach((l) => stroke(ctx, cpSA(l), { width: 5 * Math.min(1, z / K), color: PAL.greenDark }));
      STACKS.forEach((sc, si) => {
        const g = glowOf(si);
        const c = cpS(sc);
        if (g > 0) glow(ctx, c[0], c[1], 150 * f, 'rgba(250,212,110,0.95)', 0.9 * g);
        for (let k = 0; k < 4; k++) {
          const d = DISC.map((p) => cpS([sc[0] + p[0], sc[1] + p[1] + (k - 1.5) * 29]));
          fillPoly(ctx, d, g > 0.05 ? mix(PAL.greenDark, '#C9A43A', Math.min(0.55, g * 0.5)) : PAL.greenDark, 1);
          stroke(ctx, d, { width: wf });
        }
      });
      // Calvin cycle: circular arrow, turns while it works
      const spin = 1.6 * ease.inOutSine(seg(t, 13.2, 15.2)) * TAU * 0.35;
      const cg = smooth(13.35, 13.6, t) * (1 - smooth(13.9, 14.6, t));
      const cc = cpS(CYCLE_C);
      if (cg > 0) glow(ctx, cc[0], cc[1], 130 * f, 'rgba(250,212,110,0.95)', 0.8 * cg);
      const arc = circlePts(CYCLE_C[0], CYCLE_C[1], CYCLE_R, 60, deg(-80) + spin, deg(300));
      const arcS = cpSA(arc);
      stroke(ctx, arcS, { width: w });
      const e = arc[arc.length - 1], e2 = arc[arc.length - 4];
      const dir = Math.atan2(e[1] - e2[1], e[0] - e2[0]);
      const ah = [[e[0] - Math.cos(dir - 0.55) * 26, e[1] - Math.sin(dir - 0.55) * 26], e, [e[0] - Math.cos(dir + 0.55) * 26, e[1] - Math.sin(dir + 0.55) * 26]];
      stroke(ctx, cpSA(ah), { width: w });
    });
    // outer membrane on top of its contents
    const outl = cpSA(xf(CHLORO, CP0[0], CP0[1], 0, 1));
    dStroke(outl, { width: w, alpha: alpha });
    if (t > 11.9 && t < 16.2) processDL(t, f, cpS, cpSA, alpha);
  }

  function processDL(t, f, cpS, cpSA, alpha) {
    const fadeOut = 1 - smooth(15.55, 15.95, t);
    const A = alpha * fadeOut;
    if (A <= 0) return;
    const sz = (v) => v * f;
    // light pulses
    dFn((ctx) => {
      ctx.globalAlpha = A;
      for (const p of PULSES) {
        const a = seg(t, p.hit - 0.5, p.hit);
        if (a <= 0 || a >= 1) continue;
        const pos = lerpPt(p.from, p.to, ease.inQuad(a));
        const dx = p.to[0] - p.from[0], dy = p.to[1] - p.from[1], L = Math.hypot(dx, dy);
        const d = [dx / L, dy / L], n = [-d[1], d[0]];
        const pts = [];
        for (let s = -120; s <= 24; s += 4) {
          const env = Math.sin(((s + 120) / 144) * Math.PI);
          const off = 15 * Math.sin((s / 40) * TAU - t * 18) * env;
          pts.push(cpS([pos[0] + d[0] * s + n[0] * off, pos[1] + d[1] * s + n[1] * off]));
        }
        stroke(ctx, pts, { width: sz(22), color: PAL.goldLight, alpha: 0.55 });
        stroke(ctx, pts, { width: sz(9), color: PAL.gold });
        const h = cpS(pos);
        glow(ctx, h[0], h[1], sz(46), 'rgba(250,218,128,0.95)', 0.95);
      }
      // energy sparks along the lamella to the cycle
      const lam = cpSA(LAMELLAE[3]);
      SPARKS.forEach((s0) => {
        const a = seg(t, s0, s0 + 0.38);
        if (a <= 0 || a >= 1) return;
        const k = a * (lam.length - 1), i = Math.min(lam.length - 2, Math.floor(k));
        const p = lerpPt(lam[i], lam[i + 1], k - i);
        glow(ctx, p[0], p[1], sz(30), 'rgba(250,212,110,0.95)', 1);
        ctx.fillStyle = PAL.gold;
        ctx.beginPath(); ctx.arc(p[0], p[1], sz(7), 0, TAU); ctx.fill();
      });
    });
    // water droplets
    H2O_CP.forEach((d, i) => {
      if (t < d.t0 || t > d.split + 0.3) return;
      let pos, dir = [1, -1];
      if (t < d.arr) {
        const a = ease.inOutSine(seg(t, d.t0, d.arr));
        const k = a * (d.path.length - 1), j = Math.min(d.path.length - 2, Math.floor(k));
        pos = lerpPt(d.path[j], d.path[j + 1], k - j);
        const q = d.path[Math.min(d.path.length - 1, j + 2)], r = d.path[Math.max(0, j - 2)];
        dir = [q[0] - r[0], q[1] - r[1]];
      } else {
        pos = [d.to[0] + Math.sin((t - d.arr) * 9) * 2, d.to[1]];
        dir = [0, -1];
      }
      const pop = seg(t, d.split, d.split + 0.3);
      const s = 19 * ease.outBack(seg(t, d.t0, d.t0 + 0.15)) * (1 + 0.5 * pop);
      dropletAt(cpS(pos), dir, sz(s), A * (1 - pop));
      if (i === 0 && t < d.arr + 0.2) {
        const p = cpS(pos);
        label('H_2O', p[0] + sz(30), p[1] + sz(8), { alpha: A * smooth(d.t0 + 0.05, d.t0 + 0.25, t) * (1 - smooth(d.arr, d.arr + 0.2, t)) });
      }
    });
    // CO2 into the cycle
    CO2_CP.forEach((c, i) => {
      if (t < c.t0 || t > 13.85) return;
      let pos;
      if (t < c.arr) {
        const a = ease.inOutSine(seg(t, c.t0, c.arr));
        const k = a * (c.path.length - 1), j = Math.min(c.path.length - 2, Math.floor(k));
        pos = lerpPt(c.path[j], c.path[j + 1], k - j);
      } else {
        const an = deg(-90) + (t - c.arr) * 5.5;
        const rr = CYCLE_R * (1 - ease.inCubic(seg(t, 13.62, 13.8)));
        pos = [CYCLE_C[0] + Math.cos(an) * rr, CYCLE_C[1] + Math.sin(an) * rr];
      }
      const sc = ease.outBack(seg(t, c.t0, c.t0 + 0.15)) * (1 - seg(t, 13.72, 13.82));
      const p = cpS(pos);
      dFn((ctx) => { ctx.globalAlpha = A; ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(p[0], p[1], sz(12) * sc, 0, TAU); ctx.fill(); });
      const la = A * smooth(c.t0 + 0.05, c.t0 + 0.2, t) * (1 - smooth(c.arr - 0.1, c.arr + 0.1, t));
      if (la > 0) label('CO_2', p[0] + sz(20), p[1] + sz(1), { alpha: la });
    });
    // sugar
    SUGAR_CP.forEach((s, i) => {
      if (t < s.pop) return;
      const a = ease.inOutSine(seg(t, s.pop + 0.2, s.t1));
      const pos = quad(CYCLE_C, s.ctrl, s.to, 30)[Math.round(a * 30)];
      const sc = ease.outBack(seg(t, s.pop, s.pop + 0.25), 2.0);
      hexDL(cpS(pos), sz(30) * sc, A, t * 0.6 + i);
      if (i === 0) {
        const p = cpS(pos);
        label('sugar', p[0] + sz(46), p[1] + sz(2), { alpha: A * smooth(s.pop + 0.35, s.pop + 0.6, t) });
      }
    });
    // oxygen bubbles
    H2O_CP.forEach((d, i) => {
      const a = seg(t, d.split, d.split + 1.7);
      if (a <= 0 || a >= 1) return;
      const y = lerp(d.to[1] - 10, -140, ease.inOutSine(a));
      const x = d.to[0] + 70 * ease.inOutSine(a) + 12 * Math.sin(a * TAU * 1.5 + i);
      const p = cpS([x, y]);
      const sc = ease.outBack(seg(a, 0, 0.18), 2);
      bubbleDL(p, sz(31) * sc, A);
    });
    // static labels for the diagram
    const la = A * smooth(12.2, 12.55, t);
    const lp = cpS([300, 228]);
    if (la > 0) label('light', lp[0], lp[1], { alpha: la, color: '#8A6A12' });
    const cl = cpS([960, 790]);
    if (la > 0) label('CHLOROPLAST', cl[0], cl[1], { alpha: la * 0.8, align: 'center', size: 24, tracking: 4, font: 'label' });
  }

  function hexDL(p, r, alpha, spin = 0) {
    const hx = xf(hexagon(1, deg(30) + spin * 0.15), p[0], p[1], 0, r);
    dFill(hx.map((q) => [q[0] + r * 0.12, q[1] + r * 0.1]), PAL.gold, { alpha, morph: 'fade' });
    dStroke(hx, { width: Math.min(LW_FINE, Math.max(2, r * 0.17)), alpha, morph: 'fade' });
  }

  function bubbleDL(p, r, alpha, lab = true) {
    if (r <= 0.5) return;
    dFn((ctx) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PAL.cream;
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.min(LW_FINE, Math.max(2, r * 0.16));
      ctx.strokeStyle = PAL.ink;
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.68, deg(200), deg(250)); ctx.stroke();
    }, { morph: 'fade' });
    if (lab) label('O_2', p[0], p[1] + r * 0.06, { alpha, align: 'center', size: Math.max(10, r * 0.92) });
  }

  // ------------------------------------------------------------------
  // SCENE 5: growth, sugar transport, oxygen, garden
  cue(16.0, 'whoosh', { x: 0, dur: 1.3, up: 0, big: 1 });
  cue(16.95, 'scratch', { x: 0.1, dur: 0.6 });
  NEW_LEAVES.forEach((L, i) => cue(L.t[0], 'rustle', { x: 0.1 + i * 0.08, dur: 0.7, n: i }));
  const SUGAR_UP = resample([...MID_W.slice(0, 16).reverse(), ...PETIOLE_W.slice().reverse(), ...STEM_UP], 4);
  const SUGAR_DOWN = resample([...MID_W.slice(0, 16).reverse(), ...PETIOLE_W.slice().reverse(), ...STEM_LOW, ...ROOTS[0]], 4);
  const SUGAR5 = [
    { path: SUGAR_UP, t0: 17.1, dur: 1.5 }, { path: SUGAR_DOWN, t0: 17.25, dur: 1.9 },
    { path: SUGAR_UP, t0: 17.45, dur: 1.5 }, { path: SUGAR_DOWN, t0: 17.6, dur: 1.9 },
    { path: SUGAR_UP, t0: 17.8, dur: 1.5 }, { path: SUGAR_DOWN, t0: 17.95, dur: 1.9 },
  ];
  SUGAR5.forEach((s, i) => cue(s.t0 + 0.05, 'tick', { x: 0.1, soft: 1, n: i + 7 }));
  const leafCenterW = (L, f = 0.5) => xf([[L.shape.X(f), L.shape.YC(f)]], L.at[0], L.at[1], L.ang)[0];
  const BUBBLES5 = [
    { from: HERO_CENTER, dx: -150, t0: 17.9 }, { from: leafCenterW(LEAF_R), dx: 160, t0: 18.15 },
    { from: leafCenterW(NEW_LEAVES[0]), dx: 120, t0: 18.4 }, { from: leafCenterW(LEAF_L), dx: -170, t0: 18.6 },
    { from: heroW1([[HERO.X(0.75), HERO.YC(0.75)]])[0], dx: -90, t0: 18.85 }, { from: leafCenterW(NEW_LEAVES[1]), dx: 140, t0: 19.1 },
    { from: leafCenterW(NEW_LEAVES[2]), dx: -60, t0: 19.35 }, { from: leafCenterW(LEAF_R, 0.8), dx: 110, t0: 19.6 },
  ];
  BUBBLES5.forEach((b, i) => cue(b.t0, 'bubble', { x: b.dx > 0 ? 0.3 : -0.2, n: i + 3, soft: 1 }));

  function sugarTransportDL(t) {
    SUGAR5.forEach((s, i) => {
      const p = seg(t, s.t0, s.t0 + s.dur);
      if (p <= 0 || p >= 1) return;
      const f = ease.inOutSine(p);
      const P = s.path;
      const k = f * (P.length - 1), j = Math.min(P.length - 2, Math.floor(k));
      const pos = toS(lerpPt(P[j], P[j + 1], k - j));
      const sc = ease.outBack(seg(p, 0, 0.12), 2) * (1 - ease.inCubic(seg(p, 0.85, 1)));
      hexDL(pos, 14 * sc, 1, t + i);
      if (i === 0) label('sugar', pos[0] + 26, pos[1] + 1, { alpha: smooth(0.05, 0.15, p) * (1 - smooth(0.6, 0.75, p)) });
    });
  }

  function bubbles5DL(t) {
    BUBBLES5.forEach((b, i) => {
      const a = seg(t, b.t0, b.t0 + 2.4);
      if (a <= 0 || a >= 1) return;
      const y = b.from[1] - 420 * ease.outSine(a);
      const x = b.from[0] + b.dx * ease.outSine(a) + 14 * Math.sin(a * TAU * 1.2 + i);
      const p = toS([x, y]);
      const sc = ease.outBack(seg(a, 0, 0.12), 2) * (1 - smooth(0.82, 1, a));
      bubbleDL(p, 29 * sc, 1);
    });
  }

  // garden elements (world, base on the soil line)
  const GARDEN = [
    { make: () => PS.leafyStalk(901, 380, -1), x: 780, t: [18.25, 19.15] },
    { make: () => PS.tulip(911), x: 560, t: [18.45, 19.35] },
    { make: () => PS.grass(921, 1), x: 950, t: [18.3, 18.75] },
    { make: () => PS.sprout(931, 1), x: 1090, t: [18.35, 18.9] },
    { make: () => PS.grass(941, 1.1), x: 1520, t: [18.5, 18.95] },
    { make: () => PS.pebble(951, 26, 15), x: 1450, t: [18.6, 18.95] },
    { make: () => PS.sunflower(961), x: 1720, t: [18.55, 19.5] },
    { make: () => PS.bush(971, 0.9), x: 2000, t: [18.8, 19.45] },
    { make: () => PS.tree(981), x: 2230, t: [18.9, 19.85] },
    { make: () => PS.sprout(991, 0.8), x: 2450, t: [19.05, 19.5] },
    { make: () => PS.grass(1001, 0.9), x: 2580, t: [19.1, 19.5] },
    { make: () => PS.leafyStalk(1011, 300, 1), x: 340, t: [18.7, 19.55] },
    { make: () => PS.bush(1021, 0.7), x: 120, t: [18.9, 19.45] },
    { make: () => PS.grass(1031, 0.9), x: -10, t: [19.0, 19.4] },
    { make: () => PS.pebble(1041, 16, 10), x: 880, t: [18.5, 18.85] },
  ].map((g) => { const d = g.make(); return { ...g, d, base: [g.x, soilY(g.x) + 2] }; });
  GARDEN.forEach((g, i) => { cue(g.t[0], 'scratch', { x: (g.x - 1130) / 1714 * 0.9, dur: Math.min(0.6, g.t[1] - g.t[0]), soft: 1 }); if (i % 3 === 1) cue(g.t[0] + 0.25, 'rustle', { x: (g.x - 1130) / 1714 * 0.9, dur: 0.5, soft: 1, n: i }); });

  function gardenDL(t) {
    for (const g of GARDEN) {
      const p = seg(t, g.t[0], g.t[1]);
      if (p <= 0) continue;
      const T = (pts) => S(xf(pts, g.base[0], g.base[1]));
      for (const f of g.d.fills) {
        const a = smooth(f.order, f.order + 0.3, p);
        if (a > 0) dFill(T(f.pts), f.color, { alpha: a, morph: f.color === PAL.gold ? 'gold' : f.color === PAL.cream ? 'fade' : 'green' });
      }
      for (const s of g.d.strokes) {
        const q = ease.outCubic(seg(p, s.order * 0.85, s.order * 0.85 + 0.4));
        if (q > 0) dStroke(T(s.pts), { to: q, morph: 1 });
      }
    }
  }

  // ------------------------------------------------------------------
  // SCENE 6: flow into the emblem, end card
  const T_MORPH = 20.85, T_SETTLE = 21.75;
  const EM_DISC_C = [960, 300], EM_DISC_R = 104;
  const EM_LEAF = leafShape({ len: 330, width: 156, petiole: 52, curve: -10, seed: 77, veins: [0.22, 0.42, 0.61], wob: 1.2 });
  const EM_BASE = [858, 420], EM_ANG = deg(-50);
  const EM_T = (pts) => xf(pts, EM_BASE[0], EM_BASE[1], EM_ANG);
  const NM = 56;
  const EM_LINES = [EM_LEAF.left, EM_LEAF.right, EM_LEAF.mid, EM_LEAF.petiole, ...EM_LEAF.veins].map((p) => resampleN(EM_T(p), NM));
  const EM_FILL = resampleN(EM_T(EM_LEAF.fill), 96);
  const EM_DISC = resampleN(xf(blobCircle(1, 88, 0.015), EM_DISC_C[0], EM_DISC_C[1], 0, EM_DISC_R), 96);
  cue(T_MORPH, 'gather', { x: 0, dur: T_SETTLE - T_MORPH });
  cue(T_SETTLE, 'chime', { x: 0 });

  let MORPH_SRC = null;

  function alignClosed(src, tgt) {
    // rotate the closed source ring so it starts nearest to the target start
    let best = 0, bd = Infinity;
    for (let i = 0; i < src.length; i++) { const d = dist(src[i], tgt[0]); if (d < bd) { bd = d; best = i; } }
    return [...src.slice(best), ...src.slice(0, best)];
  }

  // emblem fill soaks in from the leaf base (a callback to scene 2)
  const EM_SOAK_C = EM_T([[EM_LEAF.X(0.08), EM_LEAF.YC(0.08)]])[0];
  function emSoakBlob(R) {
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const k = 1 + 0.2 * SOAK_N1(ca * 1.6 + 14) + 0.1 * SOAK_N2(sa * 3.1 + ca * 2.2 + 3);
      pts.push([EM_SOAK_C[0] + ca * R * k, EM_SOAK_C[1] + sa * R * k]);
    }
    return pts;
  }

  // target groups: edges first, then petiole + midrib, then veins
  const EM_GROUP_DELAY = [0, 0, 0.12, 0.08, 0.2, 0.2, 0.24, 0.24, 0.28, 0.28];

  function buildMorph() {
    DL = []; LABELS = [];
    camAt(T_MORPH);
    drawWorld(T_MORPH);
    const lines = [], golds = [], rest = [];
    for (const e of DL) {
      if (e.k === 'stroke' && e.morph === 1 && (e.to ?? 1) > 0.99 && (e.alpha ?? 1) > 0.5) lines.push(e);
      else if (e.k === 'fill' && e.morph === 'gold' && (e.alpha ?? 1) > 0.5) golds.push(e);
      else rest.push(e);
    }
    // the longest outlines flow into the emblem; the others dissolve
    const lenOf = (pts) => { const c = PS.cumLen(pts); return c[c.length - 1]; };
    lines.forEach((e) => { e._len = lenOf(e.pts); });
    lines.sort((a, b) => b._len - a._len);
    const flow = lines.slice(0, 30), dissolve = lines.slice(30);
    const ctr = [960, 300];
    const items = flow.map((e) => {
      const p = resampleN(e.pts, NM);
      const c = centroid(p);
      return { p, c, ang: Math.atan2(c[1] - ctr[1], c[0] - ctr[0]) };
    });
    items.sort((a, b) => a.ang - b.ang);
    const r = rng(2024);
    items.forEach((it, i) => {
      const ti = Math.floor((i / items.length) * EM_LINES.length) % EM_LINES.length;
      const tgt = EM_LINES[ti];
      const fwd = dist(it.p[0], tgt[0]) + dist(it.p[NM - 1], tgt[NM - 1]);
      const rev = dist(it.p[NM - 1], tgt[0]) + dist(it.p[0], tgt[NM - 1]);
      if (rev < fwd) it.p = it.p.slice().reverse();
      it.tgt = tgt;
      it.delay = EM_GROUP_DELAY[ti] + 0.05 * r();
      it.swirl = 0.16 + 0.06 * r();
    });
    const goldItems = golds.map((e) => {
      let p = resampleN([...e.pts, e.pts[0]], 97).slice(0, 96);
      p = alignClosed(p, EM_DISC);
      return { p, delay: 0.04 * r() };
    });
    const fadeLayer = document.createElement('canvas');
    fadeLayer.width = W; fadeLayer.height = H;
    renderDL(fadeLayer.getContext('2d'), [...rest, ...dissolve]);
    MORPH_SRC = { items, goldItems, fadeLayer };
  }

  function morphDL(t) {
    if (!MORPH_SRC) buildMorph();
    DL = []; LABELS = [];
    const M = MORPH_SRC;
    const tEnd = T_SETTLE - 0.03;
    // fills, tint, specks, bubbles and minor lines dissolve together
    const fa = 1 - ease.inOutSine(seg(t, T_MORPH, T_MORPH + 0.32));
    if (fa > 0) dFn((ctx) => { ctx.globalAlpha = fa; ctx.drawImage(M.fadeLayer, 0, 0); });
    // the sun (and other golds) glide into the emblem disc
    let discIn = false;
    const golds = [];
    for (const it of M.goldItems) {
      const u0 = seg(t, T_MORPH + 0.05 + it.delay, T_SETTLE - 0.2);
      if (u0 >= 1) { discIn = true; continue; }
      const u = ease.inOutCubic(u0);
      golds.push(it.p.map((q, i) => lerpPt(q, EM_DISC[i], u)));
    }
    if (discIn) dFill(EM_DISC, PAL.gold);
    golds.forEach((g) => dFill(g, PAL.gold));
    // emblem green soaks in
    const sp = seg(t, T_SETTLE - 0.42, tEnd);
    if (sp >= 1) dFill(EM_FILL, PAL.green);
    else if (sp > 0) {
      const blob = emSoakBlob(380 * ease.outQuad(sp) + 4);
      const wet = 1 - ease.inQuad(sp);
      dFn((ctx) => {
        ctx.beginPath(); polyPath(ctx, EM_FILL); ctx.clip();
        fillPoly(ctx, blob, PAL.green, 1);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = PAL.greenDark;
        ctx.globalAlpha = 0.35 * wet; ctx.lineWidth = 8;
        ctx.beginPath(); polyPath(ctx, blob); ctx.stroke();
      });
    }
    // outlines flow in as ribbons: the head leads, the tail follows
    const arrived = new Set();
    const moving = [];
    const LAG = 0.14;
    for (const it of M.items) {
      const t0 = T_MORPH + it.delay;
      const dur = tEnd - LAG - t0;
      if (t >= tEnd || seg(t, t0 + LAG, t0 + LAG + dur) >= 1) { arrived.add(it.tgt); continue; }
      moving.push(it.p.map((q, i) => {
        const lagI = LAG * (i / (NM - 1));
        const u = ease.inOutCubic(seg(t, t0 + lagI, t0 + lagI + dur));
        const g = it.tgt[i];
        const dx = g[0] - q[0], dy = g[1] - q[1];
        const sw = Math.sin(Math.PI * u) * it.swirl;
        return [q[0] + dx * u - dy * sw, q[1] + dy * u + dx * sw];
      }));
    }
    for (const l of EM_LINES) if (arrived.has(l)) dStroke(l, { width: LW });
    moving.forEach((pts) => dStroke(pts, { width: LW }));
  }

  function emblemDL() {
    dFill(EM_DISC, PAL.gold);
    dFill(EM_FILL, PAL.green);
    for (const l of EM_LINES) dStroke(l, { width: LW });
  }

  // ------------------------------------------------------------------
  function drawWorld(t) {
    soilDL(t);
    sunDL(t);
    rayDL(t);
    plantDL(t);
    heroDL(t);
    gardenDL(t);
    waterDL(t);
    co2DL(t);
    microDL(t);
    sugarTransportDL(t);
    bubbles5DL(t);
  }

  function buildArt(t) {
    if (t >= T_SETTLE) { DL = []; LABELS = []; emblemDL(); return; }
    if (t >= T_MORPH) { morphDL(t); return; }
    DL = []; LABELS = [];
    camAt(t);
    const z = cam.z;
    if (t >= T_DIVE && t < T_PULL + 2 && LENS_R * z > 1400) {
      microDL(t);
    } else {
      drawWorld(t);
    }
  }

  // ------------------------------------------------------------------
  // TEXT LAYER
  const FONT = {
    caption: "64px 'Fraunces Text'",
    title: "116px 'Fraunces Title'",
    tagline: "56px 'Fraunces Italic'",
    label: "'DM Sans Label Bold'",
    labelReg: "'DM Sans Label'",
    small: "40px 'DM Sans Medium'",
    name: "92px 'DM Sans Display'",
  };
  const CAP_Y = 972;
  const CAPTIONS = [
    { tin: 0.55, tout: 2.62, words: [['Can'], ['sunlight', PAL.gold], ['become'], ['food?']] },
    { tin: 3.2, tout: 6.35, words: [['It'], ['starts'], ['with'], ['a'], ['leaf.', PAL.green]] },
    { tin: 7.3, tout: 10.4, words: [['Water', PAL.water], ['+'], ['carbon', PAL.ink, 'cd'], ['dioxide', PAL.ink, 'cd']] },
    { tin: 12.0, tout: 15.4, words: [['Sunlight', PAL.gold], ['powers'], ['the'], ['process.']] },
    { tin: 16.6, tout: 20.45, words: [['Food', PAL.gold], ['for'], ['growth.'], ['Oxygen', null, null, 1.35], ['for'], ['the'], ['air.']] },
  ];
  CAPTIONS.forEach((c) => cue(c.tin, 'type', { x: 0 }));

  const UL_N = noise1(5150);
  function underline(ctx, x0, x1, y, p, color, alpha, seed) {
    if (p <= 0) return;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const f = i / 30;
      pts.push([lerp(x0, x1, f), y + 3 * Math.sin(f * Math.PI) * -1 + 1.6 * UL_N(seed + f * 3) + f * -2]);
    }
    stroke(ctx, pts, { to: p, width: 6, color, alpha });
  }

  function captionText(ctx, c, t, ci) {
    if (t < c.tin || t > c.tout + 0.35) return;
    ctx.font = FONT.caption;
    ctx.textBaseline = 'alphabetic';
    const sp = ctx.measureText(' ').width;
    const ws = c.words.map((w) => ctx.measureText(w[0]).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    let x = W / 2 - total / 2;
    const ex = seg(t, c.tout, c.tout + 0.3);
    let extra = 0;
    // merged underline spans (e.g. "carbon dioxide")
    const spans = [];
    c.words.forEach((w, i) => {
      if (w[3]) extra = w[3];
      const wt = c.tin + extra + i * 0.075;
      const a = ease.outCubic(seg(t, wt, wt + 0.5));
      const alpha = a * (1 - ex);
      const y = CAP_Y + 20 * (1 - a) - 8 * ease.inCubic(ex);
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = PAL.ink;
        ctx.fillText(w[0], x, y);
      }
      if (w[1]) {
        const key = w[2] || 'w' + i;
        let s = spans.find((q) => q.key === key);
        if (!s) { s = { key, x0: x, x1: x + ws[i], color: w[1], t0: wt + 0.3 }; spans.push(s); } else s.x1 = x + ws[i];
      }
      x += ws[i] + sp;
    });
    ctx.globalAlpha = 1;
    spans.forEach((s, k) => {
      const p = ease.outCubic(seg(t, s.t0, s.t0 + 0.45));
      underline(ctx, s.x0 - 4, s.x1 + 4, CAP_Y + 17, p, s.color, 1 - ex, ci * 10 + k);
    });
  }

  function chemText(ctx, l) {
    const size = l.size;
    const fam = l.font === 'label' ? FONT.labelReg : FONT.label;
    const parts = [];
    const str = l.text;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '_') { parts.push({ s: str[i + 1], sub: true }); i++; } else {
        if (parts.length && !parts[parts.length - 1].sub) parts[parts.length - 1].s += str[i]; else parts.push({ s: str[i], sub: false });
      }
    }
    const fN = `${size}px ${fam}`, fS = `${Math.round(size * 0.66)}px ${fam}`;
    const track = l.tracking ?? 0;
    ctx.letterSpacing = track + 'px';
    let wsum = 0;
    for (const p of parts) { ctx.font = p.sub ? fS : fN; p.w = ctx.measureText(p.s).width; wsum += p.w; }
    let x = l.align === 'center' ? l.x - (wsum - track) / 2 : l.x;
    const base = l.y + size * 0.36;
    ctx.globalAlpha = l.alpha;
    ctx.fillStyle = l.color ?? PAL.ink;
    for (const p of parts) {
      ctx.font = p.sub ? fS : fN;
      ctx.fillText(p.s, x, p.sub ? base + size * 0.2 : base);
      x += p.w;
    }
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }

  // end card (title, tagline, credit)
  function endCardText(ctx, t) {
    if (t < 21.2) return;
    ctx.textBaseline = 'alphabetic';
    // PHOTOSYNTHESIS, letter by letter
    const title = 'PHOTOSYNTHESIS';
    ctx.font = FONT.title;
    ctx.letterSpacing = '7px';
    const tw = ctx.measureText(title).width - 7;
    let x = W / 2 - tw / 2;
    ctx.fillStyle = PAL.ink;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const cw = ctx.measureText(ch).width;
      const a = ease.outCubic(seg(t, 21.28 + i * 0.022, 21.28 + i * 0.022 + 0.38));
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.fillText(ch, x, 592 + 16 * (1 - a));
      }
      x += cw;
    }
    ctx.letterSpacing = '0px';
    // tagline
    const ta = ease.outCubic(seg(t, 21.5, 21.88));
    if (ta > 0) {
      ctx.font = FONT.tagline;
      ctx.globalAlpha = ta;
      ctx.fillStyle = PAL.greenDark;
      ctx.textAlign = 'center';
      ctx.fillText('Powered by sunlight.', W / 2, 672 + 14 * (1 - ta));
      ctx.textAlign = 'left';
    }
    // credit
    ctx.font = FONT.small;
    const w1 = ctx.measureText('Created by').width;
    ctx.font = FONT.name;
    ctx.letterSpacing = '4px';
    const w2 = ctx.measureText('IMRAN').width - 4;
    ctx.letterSpacing = '0px';
    const gap = 20;
    const x0 = W / 2 - (w1 + gap + w2) / 2;
    const cy = 862;
    const ca = ease.outCubic(seg(t, 21.56, 21.92));
    if (ca > 0) {
      ctx.font = FONT.small;
      ctx.globalAlpha = ca * 0.82;
      ctx.fillStyle = PAL.ink;
      ctx.fillText('Created by', x0, cy + 12 * (1 - ca));
    }
    const na = ease.outCubic(seg(t, 21.6, 21.95));
    if (na > 0) {
      ctx.font = FONT.name;
      ctx.letterSpacing = '4px';
      ctx.globalAlpha = na;
      ctx.fillStyle = PAL.ink;
      ctx.fillText('IMRAN', x0 + w1 + gap, cy + 12 * (1 - na));
      ctx.letterSpacing = '0px';
    }
    const up = ease.outCubic(seg(t, 21.7, 21.97));
    if (up > 0) underline(ctx, x0 + w1 + gap - 2, x0 + w1 + gap + w2 + 2, cy + 22, up, PAL.gold, 1, 900);
    ctx.globalAlpha = 1;
  }

  function buildText(ctx, t) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    CAPTIONS.forEach((c, i) => captionText(ctx, c, t, i));
    for (const l of LABELS) if (l.alpha > 0.01) chemText(ctx, l);
    endCardText(ctx, t);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  let PAPER = null;
  function renderFrame(t, opts = {}) {
    const art = document.getElementById('art').getContext('2d');
    const txt = document.getElementById('text').getContext('2d');
    if (!PAPER) PAPER = PS.makePaper();
    buildArt(t);
    art.save();
    art.globalCompositeOperation = 'source-over';
    art.globalAlpha = 1;
    art.fillStyle = PAL.paper;
    art.fillRect(0, 0, W, H);
    renderDL(art, DL);
    art.globalCompositeOperation = 'multiply';
    art.drawImage(PAPER, 0, 0);
    art.restore();
    buildText(txt, t);
    if (opts.debug) {
      txt.save();
      txt.font = "28px 'DM Sans Label Bold'";
      txt.fillStyle = 'rgba(200,0,60,0.85)';
      txt.fillText(t.toFixed(2) + 's  z=' + cam.z.toFixed(2), 24, 44);
      txt.restore();
    }
  }

  CUES.sort((a, b) => a.t - b.t);
  Object.assign(PS, { renderFrame, CUES, CAPTIONS, T_SETTLE });
})(window.PS);
