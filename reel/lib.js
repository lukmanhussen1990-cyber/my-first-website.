/* Maa ki Lori — shared drawing library.
 * Everything is drawn with the Canvas 2D API on a 1080×1920 (9:16) frame.
 * Characters are posable rigs drawn as dark silhouettes with a thin glowing outline. */

const W = 1080, H = 1920;
const TAU = Math.PI * 2, RAD = Math.PI / 180;

const C = {
  ink: '#050915',
  gold: '#ffc96a',
  goldHot: '#ffe2a3',
  blue: '#c4e3ff',
  rose: '#f1b48e',
  setLine: 'rgba(120,150,215,0.75)',
  setGlow: 'rgba(80,115,200,0.9)',
};

// ---------- math ----------
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const lerpv = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
  return ys[ys.length - 1];
}
function bez(p0, p1, p2, p3, t) {
  const m = 1 - t;
  return [m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
    m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]];
}

// Catmull-Rom spline through points (closed or open).
function crPath(c, pts, closed = true) {
  const n = pts.length;
  c.moveTo(pts[0][0], pts[0][1]);
  const N = closed ? n : n - 1;
  for (let i = 0; i < N; i++) {
    const p0 = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const p3 = closed ? pts[(i + 2) % n] : pts[Math.min(n - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- camera ----------
function cam(ctx, z = 1, cx = W / 2, cy = H / 2, ty = 0) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy + ty);
}

// ---------- glowing silhouette renderer ----------
const pool = { sil: document.createElement('canvas'), comp: document.createElement('canvas') };

/* draw(c, mode, color): mode 'mask' fills every shape with the glow colour,
 * mode 'ink' fills with dark ink and adds the thin inner detail lines. */
function figure(ctx, bbox, draw, color, o = {}) {
  const op = o.opacity ?? 1;
  if (op <= 0.004) return;
  const m = ctx.getTransform();
  const glow = o.glow ?? 22, R = o.line ?? 2.4, ga = o.glowAlpha ?? 1;
  const pad = Math.ceil(glow * 2.6 + R + 6);
  const cs = [[bbox[0], bbox[1]], [bbox[0] + bbox[2], bbox[1]], [bbox[0], bbox[1] + bbox[3]], [bbox[0] + bbox[2], bbox[1] + bbox[3]]]
    .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const x0 = Math.max(0, Math.floor(Math.min(...cs.map(p => p[0])) - pad));
  const y0 = Math.max(0, Math.floor(Math.min(...cs.map(p => p[1])) - pad));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...cs.map(p => p[0])) + pad));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...cs.map(p => p[1])) + pad));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const { sil, comp } = pool;
  sil.width = w; sil.height = h; comp.width = w; comp.height = h;
  const s = sil.getContext('2d'), k = comp.getContext('2d');
  s.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  draw(s, 'mask', color);
  k.filter = `blur(${glow}px)`; k.globalAlpha = 0.6 * ga; k.drawImage(sil, 0, 0);
  k.filter = `blur(${(glow * 0.3).toFixed(1)}px)`; k.globalAlpha = 0.85 * ga; k.drawImage(sil, 0, 0);
  k.filter = 'none'; k.globalAlpha = 1;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; k.drawImage(sil, Math.cos(a) * R, Math.sin(a) * R); }
  k.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  draw(k, 'ink', color);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= op;
  ctx.drawImage(comp, x0, y0);
  ctx.restore();
}

// ---------- character rig ----------
const TS = [0, 0.15, 0.3, 0.45, 0.62, 0.78, 0.9, 1];
const BODY = {
  maa: {
    headR: 0.068, neck: 0.04, torso: 0.3, ua: 0.165, fa: 0.15, hand: 0.055, th: 0.25, sh: 0.245, foot: 0.065, sitH: 0.055,
    tF: [0.05, 0.043, 0.038, 0.045, 0.066, 0.058, 0.044, 0.024], tB: [0.072, 0.058, 0.045, 0.043, 0.048, 0.052, 0.048, 0.024],
    rArm: [0.025, 0.02, 0.017], rLeg: [0.05, 0.036], neckR: 0.024,
  },
  child: {
    headR: 0.096, neck: 0.028, torso: 0.27, ua: 0.15, fa: 0.135, hand: 0.06, th: 0.245, sh: 0.235, foot: 0.075, sitH: 0.05,
    tF: [0.058, 0.06, 0.062, 0.062, 0.062, 0.06, 0.053, 0.03], tB: [0.06, 0.056, 0.053, 0.053, 0.056, 0.058, 0.056, 0.03],
    rArm: [0.03, 0.025, 0.021], rLeg: [0.042, 0.032], neckR: 0.028,
  },
  man: {
    headR: 0.065, neck: 0.045, torso: 0.31, ua: 0.17, fa: 0.155, hand: 0.055, th: 0.25, sh: 0.245, foot: 0.075, sitH: 0.055,
    tF: [0.048, 0.048, 0.048, 0.053, 0.062, 0.065, 0.058, 0.03], tB: [0.053, 0.048, 0.046, 0.048, 0.056, 0.06, 0.058, 0.03],
    rArm: [0.029, 0.023, 0.019], rLeg: [0.046, 0.036], neckR: 0.028,
  },
};
function mixBody(a, b, k) {
  const o = {};
  for (const key in a) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key], k);
  return o;
}
function bodyOf(P) {
  if (P.kind === 'maa') {
    const b = { ...BODY.maa };
    const thin = 1 - 0.1 * (P.old || 0);
    b.tF = b.tF.map(v => v * thin); b.tB = b.tB.map(v => v * thin);
    return b;
  }
  return mixBody(BODY.child, BODY.man, clamp((P.age - 5) / 17));
}

function ik(S, T, a, b, f, bend = 1) {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1, a + b - 0.5);
  const tt = Math.atan2(dx * f, dy) / RAD;
  const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) / RAD;
  const s0 = tt - al * bend;
  const E = [S[0] + Math.sin(s0 * RAD) * f * a, S[1] + Math.cos(s0 * RAD) * a];
  const tf = Math.atan2((T[0] - E[0]) * f, T[1] - E[1]) / RAD;
  return [s0, ((tf - s0 + 540) % 360) - 180];
}

/* Pose angles are in degrees. Limb angles are measured from straight down,
 * positive = towards the facing direction. torso = forward lean, look = head
 * pitch (+ down). Arms may also be {ik: [x,y] | J => [x,y]} wrist targets. */
function solve(P) {
  const B = bodyOf(P), s = P.h, f = P.f, ps = P.pose;
  const dv = d => [Math.sin(d * RAD) * f, Math.cos(d * RAD)];
  const legRel = L => { const K = [dv(L[0])[0] * B.th * s, dv(L[0])[1] * B.th * s]; return { K, A: add(K, dv(L[0] + L[1]), B.sh * s) }; };
  const rN = legRel(ps.lN), rF = legRel(ps.lF);
  let hip;
  if (P.hipAt) hip = P.hipAt.slice();
  else if (P.sit) hip = [P.x, P.y - B.sitH * s];
  else hip = [P.x, P.y - Math.max(rN.A[1], rF.A[1], rN.K[1], rF.K[1]) - 0.024 * s];
  const legN = { K: add(hip, rN.K), A: add(hip, rN.A) }, legF = { K: add(hip, rF.K), A: add(hip, rF.A) };
  const ta = ps.torso * RAD;
  const up = [Math.sin(ta) * f, -Math.cos(ta)], fw = [Math.cos(ta) * f, Math.sin(ta)];
  const T = (sv, off) => [hip[0] + up[0] * B.torso * s * sv + fw[0] * off * s, hip[1] + up[1] * B.torso * s * sv + fw[1] * off * s];
  const tF = sv => interp(TS, B.tF, sv), tB = sv => interp(TS, B.tB, sv);
  const nb = T(1, 0);
  const L = (ps.look || 0) * RAD, hd = ps.back ? -f : f;
  const nd = [Math.cos(L) * hd, Math.sin(L)], hu = [Math.sin(L) * hd, -Math.cos(L)];
  const r = B.headR * s;
  const hc = add(nb, norm(add(up, hu)), B.neck * s + r * 0.82);
  const S = add(T(0.86, 0), fw, -0.012 * s);
  const J = { B, s, f, hip, legN, legF, up, fw, T, tF, tB, nb, nd, hu, r, hc, S };
  J.eye = add(add(hc, nd, r * 0.72), hu, r * 0.12);
  const arm = A => {
    let s0, e0, w0 = 0;
    if (Array.isArray(A)) [s0, e0, w0 = 0] = A;
    else { [s0, e0] = ik(S, typeof A.ik === 'function' ? A.ik(J) : A.ik, B.ua * s, B.fa * s, f, A.bend ?? 1); w0 = A.w || 0; }
    const E = add(S, dv(s0), B.ua * s), Wr = add(E, dv(s0 + e0), B.fa * s);
    return { S, E, W: Wr, H: add(Wr, dv(s0 + e0 + w0), B.hand * s) };
  };
  J.armN = arm(ps.aN); J.armF = arm(ps.aF);
  const pts = [hip, nb, hc, S, J.armN.H, J.armF.H, legN.A, legF.A, legN.K, legF.K, [hip[0], P.sit || P.hipAt ? hip[1] : P.y]];
  const mg = r * 1.6 + 0.12 * s;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  J.bbox = [Math.min(...xs) - mg, Math.min(...ys) - mg, Math.max(...xs) - Math.min(...xs) + 2 * mg, Math.max(...ys) - Math.min(...ys) + 2 * mg];
  return J;
}

function drawPerson(c, mode, col, P, J) {
  const isMask = mode === 'mask', ink = isMask ? col : C.ink;
  const { B, s, f, hip, T, tF, tB, nb, nd, hu, r, hc, up, fw } = J;
  const LW = 2.2;
  c.fillStyle = ink;
  const disc = (p, rr) => { c.beginPath(); c.arc(p[0], p[1], rr, 0, TAU); c.fill(); };
  const blob = pts => { c.beginPath(); crPath(c, pts, true); c.fill(); };
  const limbs = (segs, outline) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (outline && !isMask) {
      c.strokeStyle = col;
      for (const [a, b, w, skip] of segs) if (!skip) { c.lineWidth = w + LW * 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    }
    c.strokeStyle = ink;
    for (const [a, b, w] of segs) { c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  };
  const detail = (fn, a = 0.7, w = 1.7) => {
    if (isMask) return;
    c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); fn(); c.stroke(); c.restore();
  };
  const isBeta = P.kind !== 'maa';
  const k = isBeta ? clamp((P.age - 5) / 17) : 0;
  const armSegs = A => {
    const segs = [[A.S, A.E, B.rArm[0] * 2 * s], [A.E, A.W, B.rArm[1] * 2 * s], [A.W, A.H, B.rArm[2] * 2.1 * s]];
    if (isBeta) segs.unshift([A.S, lerpv(A.S, A.E, 0.42), B.rArm[0] * 2.55 * s]);
    return segs;
  };
  if (P.only === 'nearArm') { limbs(armSegs(J.armN), true); return; }
  if (P.only === 'nearHand') { const A = J.armN; limbs([[lerpv(A.E, A.W, 0.55), A.W, B.rArm[1] * 2 * s], [A.W, A.H, B.rArm[2] * 2.1 * s]], true); return; }

  // far arm
  limbs(armSegs(J.armF), false);

  if (!isBeta) {
    if (P.sit) {
      const kFr = J.legN.K[0] * f > J.legF.K[0] * f ? J.legN.K : J.legF.K;
      const rr = 0.055 * s, g = P.y;
      const wF = T(0.22, tF(0.22) + 0.01);
      const kneeTop = [kFr[0], kFr[1] - rr * 1.05];
      const kneeTip = [kFr[0] + f * rr * 1.1, kFr[1] + rr * 0.15];
      const floorF = [kFr[0] + f * rr * 0.7, g], floorB = [hip[0] - f * 0.13 * s, g];
      blob([wF, [lerp(wF[0], kneeTop[0], 0.5), Math.min(wF[1], kneeTop[1]) - rr * 0.25], kneeTop, kneeTip, floorF,
        [hip[0] + f * 0.05 * s, g + 0.004 * s], floorB, [hip[0] - f * 0.14 * s, g - 0.06 * s], T(0.2, -tB(0.2) - 0.012)]);
      detail(() => { c.moveTo(kneeTip[0] - f * 0.02 * s, g - 0.028 * s); c.lineTo(floorB[0] + f * 0.03 * s, g - 0.028 * s); }, 0.55);
      detail(() => { crPath(c, [lerpv(wF, kneeTop, 0.3), [lerp(wF[0], kneeTip[0], 0.55), lerp(wF[1], g, 0.55)], [kneeTip[0] - f * 0.06 * s, g - 0.04 * s]], false); }, 0.4);
    } else {
      const aN = J.legN.A, aF = J.legF.A, kN = J.legN.K, kF = J.legF.K;
      const aFront = aN[0] * f > aF[0] * f ? aN : aF, aBack = aFront === aN ? aF : aN;
      const kFr = kN[0] * f > kF[0] * f ? kN : kF;
      const wF = T(0.2, tF(0.2) + 0.004), wB = T(0.2, -tB(0.2) - 0.004), hB = T(0, -tB(0) - 0.006);
      const hemY = P.y - 0.006 * s;
      const hemF = [aFront[0] + f * 0.055 * s, hemY], hemB = [aBack[0] - f * 0.05 * s, hemY];
      const kneeP = [kFr[0] + f * 0.042 * s, kFr[1]];
      blob([wF, [lerp(wF[0], kneeP[0], 0.5) + f * 0.004 * s, lerp(wF[1], kneeP[1], 0.5)], kneeP, hemF,
        [lerp(hemF[0], hemB[0], 0.5), hemY + 0.004 * s], hemB,
        [lerp(hB[0], hemB[0], 0.5) - f * 0.012 * s, lerp(hB[1], hemB[1], 0.5)], hB, wB]);
      disc([aFront[0] + f * 0.06 * s, P.y - 0.01 * s], 0.013 * s);
      detail(() => { c.moveTo(hemF[0] - f * 0.004 * s, hemY - 0.032 * s); c.lineTo(hemB[0] + f * 0.006 * s, hemY - 0.032 * s); }, 0.55);
      detail(() => {
        for (let i = 0; i < 3; i++) {
          const a = lerpv(wF, wB, 0.12 + i * 0.1), b = lerpv(hemF, hemB, 0.08 + i * 0.12);
          c.moveTo(a[0], a[1] + 0.05 * s); c.lineTo(b[0], b[1] - 0.045 * s);
        }
      }, 0.32, 1.4);
    }
  } else {
    // far leg + shorts
    const legSegs = (Lg, outline) => {
      const K = Lg.K, A = Lg.A;
      const toe = [A[0] + f * B.foot * s, A[1] + 0.016 * s], heel = [A[0] - f * 0.02 * s, A[1] + 0.012 * s];
      return [[outline ? lerpv(hip, K, 0.35) : hip, K, B.rLeg[0] * 2 * s, false], [K, A, B.rLeg[1] * 2 * s], [heel, toe, 0.036 * s * (0.8 + 0.2 * k)],
        [hip, lerpv(hip, K, 0.62), B.rLeg[0] * 2 * s * lerp(1.38, 1.0, k)]];
    };
    const far = legSegs(J.legF, false);
    limbs(far, false);
  }

  // torso
  blob([...TS.map((sv, i) => T(sv, B.tF[i])), ...TS.slice().reverse().map(sv => T(sv, -tB(sv)))]);

  // backpack
  if (isBeta && P.pack > 0) {
    const pk = P.pack;
    blob([T(0.93, -tB(0.93) + 0.006), T(0.93, -tB(0.93) - 0.06 * pk), T(0.7, -tB(0.7) - 0.088 * pk), T(0.42, -tB(0.42) - 0.078 * pk), T(0.38, -tB(0.38) + 0.006)]);
    detail(() => { crPath(c, [T(0.95, tF(0.95) * 0.3), T(0.78, tF(0.78) * 0.15), T(0.58, -tB(0.58) * 0.45)], false); }, 0.6 * pk);
    detail(() => { crPath(c, [T(0.82, -tB(0.82) - 0.05 * pk), T(0.55, -tB(0.55) - 0.06 * pk)], false); }, 0.35 * pk);
  }

  // neck + head
  limbs([[add(nb, up, -0.02 * s), add(hc, hu, -r * 0.35), B.neckR * 2 * s]], false);
  disc(hc, r);
  disc(add(add(hc, nd, r * 0.42), hu, -r * 0.52), r * 0.52);
  disc(add(add(hc, nd, r * 0.9), hu, -r * 0.16), r * 0.2);

  if (!isBeta) {
    const bun = add(add(hc, nd, -r * 0.86), hu, -r * 0.42);
    const hoodC = add(add(hc, nd, -r * 0.26), hu, r * 0.1);
    disc(bun, r * 0.42);
    disc(hoodC, r * 1.1);
    const fl = Math.sin((P.time || 0) * 1.3) * 0.012;
    blob([add(hoodC, hu, r * 1.08), add(add(hoodC, nd, -r * 1.08), hu, r * 0.15), add(add(bun, nd, -r * 0.38), hu, -r * 0.25),
      T(0.82, -tB(0.82) - 0.03), T(0.52, -tB(0.52) - 0.034 - fl), T(0.26, -tB(0.26) - 0.042 - fl * 2),
      T(0.3, -tB(0.3) + 0.01), T(0.7, -tB(0.7) + 0.015), add(nb, fw, -0.01 * s), add(hoodC, nd, r * 0.2)]);
    detail(() => {
      crPath(c, [add(add(hoodC, hu, r * 1.04), nd, r * 0.5), add(add(hc, nd, r * 0.6), hu, r * 0.42), add(add(hc, nd, r * 0.3), hu, -r * 0.85),
        T(0.97, tF(0.97) * 0.3), T(0.62, tF(0.62) * 0.2), T(0.34, -tB(0.34) + 0.012)], false);
    }, 0.8);
  } else {
    // hair: short, messy when small
    disc(add(add(hc, hu, r * 0.12), nd, -r * 0.12), r * 1.0);
    const tufts = [[30, 0.16, -40], [72, 0.24, 20], [100, 0.3, 26], [128, 0.26, 30], [158, 0.3, 34], [190, 0.18, 30], [212, 0.12, 20]];
    c.beginPath();
    for (const [deg, l, tilt] of tufts) {
      const th = deg * RAD, len = r * (0.05 + (1 - k) * l);
      const v = a => add(add([0, 0], nd, Math.cos(a)), hu, Math.sin(a));
      const b1 = add(hc, v(th - 0.24), r * 0.96), b2 = add(hc, v(th + 0.24), r * 0.96), tip = add(hc, v(th + tilt * RAD * 0.5), r * 1.02 + len);
      c.moveTo(b1[0], b1[1]); c.quadraticCurveTo(lerp(b1[0], tip[0], 0.6), lerp(b1[1], tip[1], 0.4), tip[0], tip[1]); c.lineTo(b2[0], b2[1]); c.closePath();
    }
    c.fill();
    // near leg
    const Lg = J.legN, K = Lg.K, A = Lg.A;
    const toe = [A[0] + f * B.foot * s, A[1] + 0.016 * s], heel = [A[0] - f * 0.02 * s, A[1] + 0.012 * s];
    limbs([[lerpv(hip, K, 0.35), K, B.rLeg[0] * 2 * s], [K, A, B.rLeg[1] * 2 * s], [heel, toe, 0.036 * s * (0.8 + 0.2 * k)]], P.legLines !== false);
    limbs([[hip, lerpv(hip, K, 0.62), B.rLeg[0] * 2 * s * lerp(1.38, 1.0, k)]], false);
    detail(() => { const a = T(0.06, tF(0.06) + 0.004), b = T(0.08, -tB(0.08) - 0.004); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }, 0.45, 1.4);
  }

  if (P.only !== 'noNearArm') limbs(armSegs(J.armN), true);
}

function person(P) {
  const J = solve(P);
  return { J, bbox: J.bbox, draw: (c, mode, col) => drawPerson(c, mode, col, P, J) };
}
function drawFig(ctx, P, o = {}) {
  const p = person(P);
  figure(ctx, p.bbox, p.draw, P.kind === 'maa' ? C.gold : C.blue, o);
  return p.J;
}

// Walk cycle: phase in radians.
function walkPose(ph, amp = 1, extra = {}) {
  const sn = Math.sin(ph), cs = Math.cos(ph);
  return {
    torso: 4, look: 0,
    lN: [24 * sn * amp, -(6 + 34 * Math.max(0, cs)) * amp], lF: [-24 * sn * amp, -(6 + 34 * Math.max(0, -cs)) * amp],
    aN: [-20 * sn * amp, 18], aF: [20 * sn * amp, 18], ...extra,
  };
}

// ---------- sky ----------
const starCache = {};
function starField(seed, n, x0, y0, x1, y1) {
  const key = [seed, n, x0, y0, x1, y1].join();
  if (starCache[key]) return starCache[key];
  const r = rng(seed), arr = [];
  for (let i = 0; i < n; i++) {
    const big = r() < 0.05;
    arr.push({
      x: x0 + r() * (x1 - x0), y: y0 + Math.pow(r(), 1.2) * (y1 - y0),
      r: big ? 1.5 + r() * 1.4 : 0.55 + r() * 1.05, a: 0.35 + r() * 0.65, ph: r() * TAU, sp: 0.6 + r() * 2.4,
      warm: r() < 0.12, big, fade: r(),
    });
  }
  return (starCache[key] = arr);
}
function drawStars(ctx, stars, time, o = {}) {
  const fill = o.fill ?? 1, alpha = o.alpha ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    if (s.fade > fill) continue;
    const vis = clamp((fill - s.fade) * 10);
    const a = s.a * (0.62 + 0.38 * Math.sin(time * s.sp + s.ph)) * vis * alpha;
    const col = s.warm ? '255,226,180' : '214,232,255';
    if (s.big) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 7);
      g.addColorStop(0, `rgba(${col},${a * 0.5})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(s.x - s.r * 7, s.y - s.r * 7, s.r * 14, s.r * 14);
      ctx.strokeStyle = `rgba(${col},${a * 0.45})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(s.x - s.r * 5, s.y); ctx.lineTo(s.x + s.r * 5, s.y); ctx.moveTo(s.x, s.y - s.r * 5); ctx.lineTo(s.x, s.y + s.r * 5); ctx.stroke();
    }
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function sky(ctx, o) {
  const top = o.top ?? -200, hz = o.horizon;
  const g = ctx.createLinearGradient(0, top, 0, hz);
  g.addColorStop(0, '#02050f'); g.addColorStop(0.5, '#071433'); g.addColorStop(1, '#152d66');
  ctx.fillStyle = g; ctx.fillRect(-400, top - 400, W + 800, hz - top + 1200);
  if (o.milky) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(W * 0.5, (top + hz) * 0.42); ctx.rotate(-0.55);
    const mg = ctx.createLinearGradient(0, -170, 0, 170);
    mg.addColorStop(0, 'rgba(90,120,210,0)'); mg.addColorStop(0.5, 'rgba(110,140,225,0.10)'); mg.addColorStop(1, 'rgba(90,120,210,0)');
    ctx.fillStyle = mg; ctx.fillRect(-1400, -170, 2800, 340);
    ctx.restore();
  }
  drawStars(ctx, starField(o.seed, o.n ?? 420, -60, top, W + 60, hz - 30), o.time, { fill: o.fill, alpha: o.alpha });
  if (o.milky) drawStars(ctx, milkyField(o.seed, top, hz), o.time, { fill: o.fill, alpha: 0.8 });
  const hg = ctx.createLinearGradient(0, hz - 260, 0, hz);
  hg.addColorStop(0, 'rgba(70,100,180,0)'); hg.addColorStop(1, 'rgba(85,115,195,0.22)');
  ctx.fillStyle = hg; ctx.fillRect(-400, hz - 260, W + 800, 270);
}
function milkyField(seed, top, hz) {
  const key = 'm' + seed + top + hz;
  if (starCache[key]) return starCache[key];
  const r = rng(seed + 9), arr = [], cx = W * 0.5, cy = (top + hz) * 0.42, a = -0.55;
  for (let i = 0; i < 520; i++) {
    const u = (r() - 0.5) * 2600, v = (r() + r() + r() - 1.5) * 110;
    arr.push({ x: cx + u * Math.cos(a) - v * Math.sin(a), y: cy + u * Math.sin(a) + v * Math.cos(a), r: 0.4 + r() * 0.7, a: 0.25 + r() * 0.5, ph: r() * TAU, sp: 0.5 + r() * 2, warm: r() < 0.1, big: false, fade: r() });
  }
  return (starCache[key] = arr.filter(s => s.y < hz - 30));
}

function moon(ctx, x, y, r, o = {}) {
  const glow = o.glow ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.4);
  g.addColorStop(0, `rgba(185,205,255,${0.26 * glow})`); g.addColorStop(0.3, `rgba(120,150,230,${0.1 * glow})`); g.addColorStop(1, 'rgba(60,80,160,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3.5, y - r * 3.5, r * 7, r * 7);
  ctx.restore();
  g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.75, '#f5e9cf'); g.addColorStop(1, '#e6d3ad');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(150,130,100,0.10)';
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.28], [0.15, -0.35, 0.18], [0.25, 0.1, 0.24], [-0.1, 0.35, 0.16], [-0.45, 0.2, 0.12]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, rr * r, rr * r * 0.8, 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(255,245,220,0.95)'; ctx.shadowBlur = 34;
  ctx.strokeStyle = 'rgba(255,250,235,0.85)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}

// ---------- set pieces ----------
function glowPath(ctx, fn, color, w, blur, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); fn(ctx); ctx.stroke(); ctx.restore();
}

const townCache = {};
function townData(seed, temple) {
  const key = seed + ':' + temple;
  if (townCache[key]) return townCache[key];
  const r = rng(seed), items = [];
  let x = -40;
  while (x < W + 40) {
    if (r() < 0.08) { items.push({ type: 'tree', x: x + 10, w: 46 + r() * 40, h: 46 + r() * 36 }); x += 34 + r() * 20; continue; }
    const w = 46 + r() * 96, h = 34 + Math.pow(r(), 1.5) * 118;
    const it = { type: 'box', x, w, h, tank: r() < 0.22, stair: r() < 0.2, tx: 0.15 + r() * 0.5, win: [] };
    if (r() < 0.6) for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) it.win.push([0.15 + r() * 0.65, 0.3 + r() * 0.45, r() < 0.7]);
    items.push(it);
    x += w + (r() < 0.35 ? r() * 16 : -8);
  }
  if (temple != null) items.unshift({ type: 'temple', x: temple, w: 74, h: 200 });
  return (townCache[key] = items);
}
function town(ctx, seed, yB, o = {}) {
  const items = townData(seed, o.temple);
  const sc = o.scale ?? 1;
  ctx.save();
  ctx.fillStyle = '#060c24';
  ctx.strokeStyle = 'rgba(70,100,170,0.85)'; ctx.lineWidth = 1.3; ctx.shadowColor = 'rgba(70,100,180,0.8)'; ctx.shadowBlur = 5;
  for (const it of items) {
    const h = it.h * sc, w = it.w;
    ctx.beginPath();
    if (it.type === 'tree') {
      ctx.arc(it.x + w * 0.5, yB - h * 0.62, w * 0.42, 0, TAU);
      ctx.arc(it.x + w * 0.25, yB - h * 0.45, w * 0.3, 0, TAU);
      ctx.arc(it.x + w * 0.75, yB - h * 0.42, w * 0.32, 0, TAU);
      ctx.fill(); ctx.stroke(); ctx.fillRect(it.x + w * 0.2, yB - h * 0.5, w * 0.6, h * 0.5);
      continue;
    }
    if (it.type === 'temple') {
      const cx = it.x + w / 2;
      ctx.moveTo(it.x, yB); ctx.lineTo(it.x + 6, yB - h * 0.45);
      ctx.quadraticCurveTo(it.x + w * 0.12, yB - h * 0.92, cx, yB - h);
      ctx.quadraticCurveTo(it.x + w * 0.88, yB - h * 0.92, it.x + w - 6, yB - h * 0.45);
      ctx.lineTo(it.x + w, yB); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, yB - h - 6, 13, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, yB - h - 12); ctx.lineTo(cx, yB - h - 44); ctx.lineTo(cx + 22, yB - h - 36); ctx.lineTo(cx, yB - h - 30); ctx.stroke();
      continue;
    }
    ctx.rect(it.x, yB - h, w, h + 40);
    if (it.stair) ctx.rect(it.x + w * 0.6, yB - h - h * 0.3 - 10, w * 0.3, h * 0.3 + 10);
    if (it.tank) ctx.rect(it.x + w * it.tx, yB - h - 18, 20, 18);
    ctx.fill(); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const it of items) {
    if (it.type !== 'box') continue;
    for (const [wx, wy, lit] of it.win) {
      if (!lit) continue;
      const x = it.x + wx * it.w, y = yB - it.h * sc * wy;
      ctx.fillStyle = 'rgba(255,196,110,0.75)'; ctx.fillRect(x, y, 6, 8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 22);
      g.addColorStop(0, 'rgba(255,180,90,0.22)'); g.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 20, y - 20, 46, 48); ctx.restore();
    }
  }
  const hg = ctx.createLinearGradient(0, yB - 230, 0, yB);
  hg.addColorStop(0, 'rgba(40,65,140,0)'); hg.addColorStop(1, 'rgba(45,72,150,0.3)');
  ctx.fillStyle = hg; ctx.fillRect(-400, yB - 230, W + 800, 240);
  ctx.restore();
}

function parapet(ctx, y, o = {}) {
  const ph = o.ph ?? 52;
  const fg = ctx.createLinearGradient(0, y + ph, 0, y + ph + 900);
  fg.addColorStop(0, '#0c1738'); fg.addColorStop(0.5, '#08112b'); fg.addColorStop(1, '#040815');
  ctx.fillStyle = fg; ctx.fillRect(-400, y + ph, W + 800, 3000);
  ctx.fillStyle = '#070e26'; ctx.fillRect(-400, y, W + 800, ph);
  ctx.fillStyle = '#0d1a3e'; ctx.fillRect(-400, y - 7, W + 800, 11);
  glowPath(ctx, c => { c.moveTo(-400, y - 7); c.lineTo(W + 400, y - 7); }, 'rgba(150,180,240,0.7)', 1.6, 8);
  glowPath(ctx, c => { c.moveTo(-400, y + ph); c.lineTo(W + 400, y + ph); }, 'rgba(90,120,200,0.45)', 1.2, 4);
  ctx.save(); ctx.strokeStyle = 'rgba(80,105,170,0.18)'; ctx.lineWidth = 1;
  const r = rng(Math.round(y));
  for (let i = 0; i < 5; i++) {
    const x = r() * W; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + (r() - 0.5) * 10, y + 18 + r() * 24); ctx.stroke();
  }
  ctx.restore();
}

function tank(ctx, x, yB, sc = 1) {
  const w = 150 * sc, h = 160 * sc, st = 30 * sc, top = yB - st - h;
  ctx.save();
  ctx.fillStyle = '#060b1e';
  ctx.fillRect(x - w * 0.42, yB - st, w * 0.18, st); ctx.fillRect(x + w * 0.24, yB - st, w * 0.18, st);
  ctx.fillRect(x - w * 0.56, yB - st - 6 * sc, w * 1.12, 10 * sc);
  const body = c => {
    c.moveTo(x - w / 2, yB - st - 6 * sc); c.lineTo(x - w / 2, top + h * 0.2);
    c.quadraticCurveTo(x - w * 0.48, top + 2, x, top); c.quadraticCurveTo(x + w * 0.48, top + 2, x + w / 2, top + h * 0.2);
    c.lineTo(x + w / 2, yB - st - 6 * sc); c.closePath();
  };
  ctx.beginPath(); body(ctx); ctx.fill();
  glowPath(ctx, body, C.setLine, 1.6, 8);
  glowPath(ctx, c => { c.rect(x - w * 0.56, yB - st - 6 * sc, w * 1.12, 10 * sc); c.moveTo(x - w * 0.33, yB - st + 4); c.lineTo(x - w * 0.33, yB); c.moveTo(x + w * 0.33, yB - st + 4); c.lineTo(x + w * 0.33, yB); }, C.setLine, 1.2, 4, 0.7);
  ctx.save(); ctx.beginPath(); body(ctx); ctx.clip();
  for (let i = 1; i <= 4; i++) {
    const yy = top + h * (0.2 + 0.17 * i);
    glowPath(ctx, c => { c.moveTo(x - w / 2, yy); c.quadraticCurveTo(x, yy + 9 * sc, x + w / 2, yy); }, 'rgba(110,140,210,0.35)', 1, 0);
  }
  const rim = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  rim.addColorStop(0, 'rgba(140,170,240,0.16)'); rim.addColorStop(0.25, 'rgba(140,170,240,0)'); rim.addColorStop(1, 'rgba(140,170,240,0)');
  ctx.fillStyle = rim; ctx.fillRect(x - w / 2, top, w, h);
  ctx.restore();
  ctx.fillStyle = '#060b1e'; ctx.fillRect(x - w * 0.14, top - 12 * sc, w * 0.28, 14 * sc);
  glowPath(ctx, c => c.rect(x - w * 0.14, top - 12 * sc, w * 0.28, 14 * sc), C.setLine, 1.2, 5, 0.8);
  ctx.restore();
}

function clothesline(ctx, o, time) {
  const lineY = x => { const t = (x - o.x1) / (o.x2 - o.x1); return o.yTop + 4 * o.sag * t * (1 - t); };
  for (const px of [o.x1, o.x2]) {
    ctx.save(); ctx.strokeStyle = '#070d22'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(px, o.yBase); ctx.lineTo(px, o.yTop - 16); ctx.stroke(); ctx.restore();
    glowPath(ctx, c => { c.moveTo(px - 4, o.yBase); c.lineTo(px - 4, o.yTop - 16); c.moveTo(px + 4, o.yBase); c.lineTo(px + 4, o.yTop - 16); c.moveTo(px - 16, o.yTop - 14); c.lineTo(px + 16, o.yTop - 14); }, C.setLine, 1.2, 5, 0.7);
  }
  glowPath(ctx, c => { c.moveTo(o.x1, o.yTop); for (let i = 1; i <= 30; i++) { const x = lerp(o.x1, o.x2, i / 30); c.lineTo(x, lineY(x)); } }, 'rgba(170,195,245,0.8)', 1.4, 6);
  if (o.saree) saree(ctx, o.saree, lineY, time);
  return lineY;
}

function saree(ctx, sa, lineY, time) {
  const N = 28, top = [], bot = [], mid = [];
  const bunch = sa.bunch || 0;
  const sway = Math.sin(time * 0.9) * 9 * (1 - bunch * 0.6), sw2 = Math.sin(time * 1.6 + 1) * 4;
  const waves = lerp(2.2, 6, bunch), amp = lerp(7, 16, bunch);
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = lerp(sa.xa, sa.xb, t), y0 = lineY(x);
    const wv = Math.sin(t * TAU * waves + time * 1.1) * amp;
    top.push([x, y0]);
    bot.push([x + sway * (0.5 + 0.5 * t) + sw2 * Math.sin(t * 5), y0 + sa.len + wv]);
    mid.push([x + sway * 0.4 * (0.5 + 0.5 * t), y0 + sa.len * 0.42 + wv * 0.6]);
  }
  const shape = c => { c.moveTo(top[0][0], top[0][1]); for (const p of top) c.lineTo(p[0], p[1]); crPathTo(c, bot.slice().reverse()); c.closePath(); };
  ctx.save();
  ctx.fillStyle = `rgba(10,13,34,${sa.alpha ?? 0.86})`;
  ctx.beginPath(); shape(ctx); ctx.fill();
  glowPath(ctx, shape, C.rose, 1.8, 12, 0.85);
  const line = (pts, off, a, w = 1.4, dash) => glowPath(ctx, c => { if (dash) c.setLineDash(dash); c.moveTo(pts[0][0], pts[0][1] + off); for (const p of pts) c.lineTo(p[0], p[1] + off); }, C.rose, w, 6, a);
  line(mid, 0, 0.75, 1.6);
  line(mid, -12, 0.55, 1.1);
  line(mid, -6, 0.55, 2, [2, 9]);
  line(bot, -16, 0.6, 1.1);
  line(bot, -30, 0.5, 1.1);
  line(bot, -23, 0.55, 2.2, [2, 10]);
  const folds = Math.round(lerp(3, 9, bunch));
  for (let i = 1; i <= folds; i++) {
    const t = i / (folds + 1), a = top[Math.round(t * N)], b = bot[Math.round(t * N)];
    glowPath(ctx, c => { c.moveTo(a[0], a[1] + 10); c.quadraticCurveTo(lerp(a[0], b[0], 0.5) + Math.sin(i * 1.7) * 8, lerp(a[1], b[1], 0.5), b[0], b[1] - 34); }, C.rose, 1, 4, 0.22 + bunch * 0.15);
  }
  ctx.restore();
}
function crPathTo(c, pts) {
  const n = pts.length;
  c.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

// Stairwell: an opening in the floor with steps going down to the left.
function stairwell(ctx, o) {
  const { x0, x1, yF, yN } = o, n = o.n ?? 6, ins = (x1 - x0) * 0.035;
  const hole = c => { c.moveTo(x0 + ins, yF); c.lineTo(x1 - ins, yF); c.lineTo(x1, yN); c.lineTo(x0, yN); c.closePath(); };
  ctx.save();
  // far wall of the stairwell, faintly lit near the top
  const wg = ctx.createLinearGradient(0, yF, 0, yN);
  wg.addColorStop(0, '#16224a'); wg.addColorStop(1, '#03050f');
  ctx.fillStyle = wg; ctx.beginPath(); hole(ctx); ctx.fill();
  ctx.beginPath(); hole(ctx); ctx.clip();
  // steps seen from the side: a zig-zag going down to the left into darkness
  const tw = o.tw ?? 64, rh = o.rh ?? 56;
  const zig = [[x1 + 10, yF + 4]];
  for (let i = 0; i < n + 12; i++) {
    const [px, py] = zig[zig.length - 1];
    zig.push([px - tw, py], [px - tw, py + rh]);
  }
  ctx.fillStyle = '#060b1f';
  ctx.beginPath(); ctx.moveTo(x1 + 10, yN + 400);
  for (const p of zig) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(x0 - 400, yN + 400); ctx.closePath(); ctx.fill();
  for (let i = 0; i < zig.length - 1; i++) {
    const a = zig[i], b = zig[i + 1], l = clamp(1 - (a[1] - yF) / (yN - yF));
    glowPath(ctx, c => { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }, 'rgba(140,170,235,1)', 1.3, 5, 0.15 + 0.6 * l);
  }
  const sh = ctx.createLinearGradient(0, yF, 0, yN);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,1,6,0.75)');
  ctx.fillStyle = sh; ctx.fillRect(x0 - 10, yF, x1 - x0 + 20, yN - yF);
  ctx.restore();
  // floor lip in front of the opening
  glowPath(ctx, c => { c.moveTo(x0 + ins, yF); c.lineTo(x1 - ins, yF); c.moveTo(x1 - ins, yF); c.lineTo(x1, yN); c.moveTo(x0 + ins, yF); c.lineTo(x0, yN); }, C.setLine, 1.3, 6, 0.6);
  glowPath(ctx, c => { c.moveTo(x0 - 6, yN); c.lineTo(x1 + 6, yN); }, 'rgba(160,190,250,0.9)', 2.4, 10, 0.9);
  // a handrail running down alongside the steps
  const railH = o.railH ?? 78, slope = rh / tw;
  const rail = x => yF + 4 - railH + (x1 + 10 - x) * slope;
  ctx.save(); ctx.beginPath(); ctx.rect(-500, -3000, W + 1000, yN + 3000); ctx.clip();
  ctx.strokeStyle = '#060b1f'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x1 + 10, rail(x1 + 10)); ctx.lineTo(x0 - 200, rail(x0 - 200)); ctx.stroke();
  glowPath(ctx, c => {
    c.moveTo(x1 + 10, rail(x1 + 10) - 3); c.lineTo(x0 - 200, rail(x0 - 200) - 3);
    for (let x = x1 + 10 - tw * 0.5; x > x0 - 200; x -= tw * 2) {
      const tread = yF + 4 + Math.ceil((x1 + 10 - x) / tw) * rh;
      c.moveTo(x, rail(x)); c.lineTo(x, tread);
    }
  }, C.setLine, 1.4, 6, 0.85);
  ctx.restore();
  // tread height at x, for placing feet on the steps
  return x => yF + 4 + Math.max(0, (x1 + 10 - x) / tw - 0.5) * rh;
}

// Clay diya with a living flame.
function diya(ctx, x, y, s, time, o = {}) {
  const I = o.intensity ?? 1;
  const fl = 1 + 0.07 * Math.sin(time * 11.3) + 0.05 * Math.sin(time * 23.7 + 1.3) + 0.03 * Math.sin(time * 37.1 + 0.4);
  const sway = Math.sin(time * 3.1) * 2.2 * s + Math.sin(time * 7.7) * 1.2 * s;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (!o.held) {
    ctx.save(); ctx.translate(x, y + 4 * s); ctx.scale(1, 0.32);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 330 * s * Math.sqrt(I));
    pg.addColorStop(0, `rgba(255,170,70,${0.36 * Math.min(I, 1.2) * fl})`); pg.addColorStop(0.4, `rgba(255,150,60,${0.12 * Math.min(I, 1.2)})`); pg.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 330 * s * Math.sqrt(I), 0, TAU); ctx.fill(); ctx.restore();
  }
  const fy = y - 20 * s;
  const R = (o.halo ?? 300) * s * Math.sqrt(I) * fl;
  let g = ctx.createRadialGradient(x, fy - 14 * s, 0, x, fy - 14 * s, R);
  g.addColorStop(0, `rgba(255,190,90,${0.42 * Math.min(I, 1.25)})`); g.addColorStop(0.18, `rgba(255,160,60,${0.14 * Math.min(I, 1.25)})`); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, fy - 14 * s, R, 0, TAU); ctx.fill();
  if (I > 1.2) {
    // rays when the flame blooms
    const k = clamp((I - 1.2) / 1.5), n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + time * 0.15, len = (90 + 60 * Math.sin(i * 2.7 + time * 1.3)) * s * (0.5 + k);
      const rg = ctx.createLinearGradient(x + 30 * s, fy - 22 * s, x + 30 * s + Math.cos(a) * len, fy - 22 * s + Math.sin(a) * len);
      rg.addColorStop(0, `rgba(255,210,130,${0.35 * k})`); rg.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.strokeStyle = rg; ctx.lineWidth = 2.2 * s;
      ctx.beginPath(); ctx.moveTo(x + 30 * s, fy - 22 * s); ctx.lineTo(x + 30 * s + Math.cos(a) * len, fy - 22 * s + Math.sin(a) * len); ctx.stroke();
    }
  }
  ctx.restore();
  // bowl
  ctx.save();
  const bowl = c => {
    c.moveTo(x - 30 * s, y - 14 * s);
    c.quadraticCurveTo(x - 4 * s, y - 20 * s, x + 26 * s, y - 15 * s);
    c.quadraticCurveTo(x + 36 * s, y - 18 * s, x + 42 * s, y - 21 * s);
    c.quadraticCurveTo(x + 34 * s, y - 6 * s, x + 18 * s, y - 2 * s);
    c.quadraticCurveTo(x, y + 3 * s, x - 18 * s, y - 2 * s);
    c.quadraticCurveTo(x - 30 * s, y - 6 * s, x - 30 * s, y - 14 * s);
  };
  ctx.fillStyle = '#140b07'; ctx.beginPath(); bowl(ctx); ctx.fill();
  glowPath(ctx, bowl, C.gold, 1.8, 10, 0.95);
  glowPath(ctx, c => { c.ellipse(x + 2 * s, y - 16 * s, 24 * s, 3.2 * s, 0, 0, TAU); }, C.goldHot, 1.2, 6, 0.6);
  // flame
  const fh = 30 * s * fl * (0.75 + 0.25 * Math.sqrt(I)), fw = 8.5 * s * (0.85 + 0.15 * Math.sqrt(I));
  const bx = x + 30 * s, by = y - 21 * s;
  const flame = c => {
    c.moveTo(bx, by);
    c.bezierCurveTo(bx - fw * 1.4, by - fh * 0.25, bx - fw * 0.6 + sway * 0.5, by - fh * 0.75, bx + sway, by - fh);
    c.bezierCurveTo(bx + fw * 0.6 + sway * 0.5, by - fh * 0.75, bx + fw * 1.4, by - fh * 0.25, bx, by);
  };
  ctx.globalCompositeOperation = 'lighter';
  g = ctx.createRadialGradient(bx, by - fh * 0.4, 0, bx, by - fh * 0.4, fh * 1.6);
  g.addColorStop(0, `rgba(255,210,120,${0.8})`); g.addColorStop(0.35, 'rgba(255,150,50,0.3)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by - fh * 0.4, fh * 1.6, 0, TAU); ctx.fill();
  g = ctx.createLinearGradient(bx, by, bx, by - fh);
  g.addColorStop(0, 'rgba(255,140,40,0.95)'); g.addColorStop(0.35, 'rgba(255,230,160,1)'); g.addColorStop(1, 'rgba(255,190,90,0.85)');
  ctx.fillStyle = g; ctx.beginPath(); flame(ctx); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.95)';
  ctx.beginPath(); ctx.ellipse(bx + sway * 0.3, by - fh * 0.3, fw * 0.35, fh * 0.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
  return [bx, by - fh * 0.5];
}

// 4-point sparkle.
function sparkle(ctx, x, y, r, rgb, a) {
  if (a <= 0.003) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
  g.addColorStop(0, `rgba(${rgb},${a * 0.9})`); g.addColorStop(0.25, `rgba(${rgb},${a * 0.3})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);
  // the core is painted normally so it still shows on top of the bright moon
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${rgb},${Math.min(1, a * 1.1)})`;
  const q = r * 2.3;
  ctx.beginPath(); ctx.moveTo(x, y - q); ctx.quadraticCurveTo(x, y, x + q, y); ctx.quadraticCurveTo(x, y, x, y + q);
  ctx.quadraticCurveTo(x, y, x - q, y); ctx.quadraticCurveTo(x, y, x, y - q); ctx.fill();
  ctx.fillStyle = `rgba(255,255,248,${Math.min(1, a)})`;
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
  ctx.restore();
}
function softLight(ctx, x, y, r, rgb, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

// Screen-space finishing: bloom, haze and vignette.
const bloomC = document.createElement('canvas');
bloomC.width = W / 4; bloomC.height = H / 4;
function finish(ctx, o = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const b = bloomC.getContext('2d');
  b.filter = 'none'; b.clearRect(0, 0, bloomC.width, bloomC.height);
  b.drawImage(ctx.canvas, 0, 0, bloomC.width, bloomC.height);
  b.filter = 'blur(6px)'; b.drawImage(bloomC, 0, 0); b.filter = 'none';
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = o.bloom ?? 0.45;
  ctx.drawImage(bloomC, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,2,10,0)'); v.addColorStop(1, 'rgba(0,2,10,0.62)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // fine moving grain hides gradient banding
  const n = noiseTile();
  const ox = Math.floor((o.seed ?? 0) * 97) % 256, oy = Math.floor((o.seed ?? 0) * 61) % 256;
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.5;
  ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(n, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
let noiseC = null;
function noiseTile() {
  if (noiseC) return noiseC;
  noiseC = document.createElement('canvas'); noiseC.width = noiseC.height = 256;
  const c = noiseC.getContext('2d'), img = c.createImageData(256, 256), r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() - 0.5) * 18; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  c.putImageData(img, 0, 0);
  return noiseC;
}
