// Shape generators. All shapes are built once in local coordinates and then
// transformed per frame. Outlines carry a small, fixed hand-drawn wobble.
(function (PS) {
  'use strict';
  const { TAU, PAL, spline, quad, bezier, circlePts, resample, wobble, centroid, xf, clamp, lerp, rng } = PS;

  // ---------- leaf ----------
  // Local frame: petiole starts at (0,0); the blade points along +x.
  function leafShape(o = {}) {
    const len = o.len ?? 300, width = o.width ?? 150, pet = o.petiole ?? 40, curve = o.curve ?? 8;
    const veinsU = o.veins ?? [0.26, 0.46, 0.65];
    const seed = o.seed ?? 1, amp = o.wob ?? 1.3, wl = o.wl ?? 46;
    const shape = o.shape ?? 0.8;
    const N = 44, bl = len - pet;
    const X = (u) => pet + u * bl;
    const YC = (u) => curve * Math.sin(Math.PI * u);
    const HW = (u) => (width / 2) * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp(u), shape))), 0.85);
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      left.push([X(u), YC(u) - HW(u)]);
      right.push([X(u), YC(u) + HW(u)]);
    }
    const mid = [];
    for (let i = 0; i <= 30; i++) { const u = (0.93 * i) / 30; mid.push([X(u), YC(u)]); }
    const petiole = quad([0, 0], [pet * 0.5, o.petBend ?? 2], [pet, 0], 10);
    const veins = [];
    const vl = o.veinLen ?? 0.17;
    veinsU.forEach((u0, k) => {
      [-1, 1].forEach((side) => {
        const u1 = u0 + vl;
        const v = quad([X(u0), YC(u0)], [X(u0 + vl * 0.28), YC(u0 + vl * 0.28) + side * HW(u0 + vl * 0.28) * 0.52],
          [X(u1), YC(u1) + side * HW(u1) * 0.8], 14);
        veins.push(wobble(v, amp * 0.6, wl * 0.7, seed * 31 + k * 7 + (side + 1)));
      });
    });
    const fillRaw = [...left, ...right.slice(0, -1).reverse()];
    const c = centroid(fillRaw);
    const fs = o.fillScale ?? 1.035;
    const fdx = o.fdx ?? 3, fdy = o.fdy ?? 5;
    let fill = wobble(resample([...fillRaw, fillRaw[0]], 6), amp * 2.2, wl * 1.6, seed * 13 + 5, true);
    fill = fill.map((p) => [c[0] + (p[0] - c[0]) * fs + fdx, c[1] + (p[1] - c[1]) * fs + fdy]);
    return {
      len, width, pet, X, YC, HW,
      left: wobble(left, amp, wl, seed * 3 + 1, false, 18),
      right: wobble(right, amp, wl, seed * 3 + 2, false, 18),
      mid: wobble(mid, amp * 0.7, wl, seed * 3 + 3),
      petiole: wobble(petiole, amp * 0.5, wl, seed * 3 + 4),
      veins,
      fill,
      center: [X(0.42), YC(0.42)],
      edge: (side, u) => [X(u), YC(u) + side * HW(u)],
    };
  }

  // ---------- small symbols (local, centred at origin) ----------
  function droplet(r = 1) {
    // circle with a tangent point at (0,-2r): tip points "up" (-y)
    const pts = [];
    const tip = [0, -2.05 * r];
    const a0 = (-30 * Math.PI) / 180, a1 = (210 * Math.PI) / 180;
    pts.push(tip);
    const side1 = quad(tip, [0.35 * r, -1.35 * r], [Math.cos(a0) * r, Math.sin(a0) * r], 8).slice(1);
    pts.push(...side1);
    for (let i = 1; i < 30; i++) { const a = a0 + ((a1 - a0) * i) / 30; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    pts.push(...quad([Math.cos(a1) * r, Math.sin(a1) * r], [-0.35 * r, -1.35 * r], tip, 8).slice(1));
    return pts;
  }

  function hexagon(r = 1, rot = 0) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = rot + (i * TAU) / 6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return pts;
  }

  function superellipse(a, b, p = 2.4, n = 120) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * TAU, c = Math.cos(t), s = Math.sin(t);
      pts.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]);
    }
    return pts;
  }

  function blobCircle(r, seed, amp = 0.025, n = 96) {
    const nz = PS.noise1(seed);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + amp * (nz(Math.cos(a) * 1.3 + 7) * 0.6 + nz(Math.sin(a) * 1.7 + 19) * 0.4);
      pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
    }
    pts[n] = pts[0].slice();
    return pts;
  }

  // Rounded hexagonal plant cell, local around origin.
  function cellShape(R, seed) {
    const r = rng(seed);
    const ctrl = [];
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6 + Math.PI / 6;
      const ac = a + TAU / 12;
      ctrl.push([Math.cos(a) * R * (0.96 + r() * 0.06), Math.sin(a) * R * (0.96 + r() * 0.06)]);
      ctrl.push([Math.cos(ac) * R * (0.86 + r() * 0.04), Math.sin(ac) * R * (0.86 + r() * 0.04)]);
    }
    return spline(ctrl, 8, true);
  }

  // ---------- garden plants ----------
  // Each returns { strokes:[{pts,order,w}], fills:[{pts,color,order}] } in local
  // coordinates with the base at (0,0) and "up" = -y.
  function leafOn(at, angleDeg, o) {
    const L = leafShape(o);
    const a = (angleDeg * Math.PI) / 180;
    const T = (pts) => xf(pts, at[0], at[1], a);
    return { left: T(L.left), right: T(L.right), mid: T(L.mid), petiole: T(L.petiole), veins: L.veins.map(T), fill: T(L.fill) };
  }

  function addLeaf(d, lf, order, opts = {}) {
    d.fills.push({ pts: lf.fill, color: opts.color ?? PAL.green, order: order + 0.1 });
    d.strokes.push({ pts: lf.petiole, order });
    d.strokes.push({ pts: lf.left, order: order + 0.05 });
    d.strokes.push({ pts: lf.right, order: order + 0.05 });
    if (opts.mid !== false) d.strokes.push({ pts: lf.mid, order: order + 0.15 });
    if (opts.veins) lf.veins.forEach((v, i) => d.strokes.push({ pts: v, order: order + 0.2 + i * 0.02 }));
  }

  function tulip(seed) {
    const d = { strokes: [], fills: [] };
    const stem = wobble(spline([[0, 0], [6, -120], [-4, -250], [4, -330]], 14), 1.2, 40, seed);
    d.strokes.push({ pts: stem, order: 0 });
    // long blade leaves
    addLeaf(d, leafOn([0, -10], -112, { len: 230, width: 64, petiole: 6, curve: -18, seed: seed + 1, veins: [] }), 0.2, { mid: false });
    addLeaf(d, leafOn([2, -40], -62, { len: 190, width: 56, petiole: 6, curve: 14, seed: seed + 2, veins: [] }), 0.3, { mid: false });
    // cup flower
    const cup = wobble(spline([[-34, -330], [-40, -372], [-26, -404], [-12, -380], [2, -414], [16, -380], [30, -404], [42, -372], [34, -330], [0, -318], [-34, -330]], 6), 1.2, 30, seed + 3);
    d.fills.push({ pts: cup.map((p) => [p[0] + 4, p[1] + 3]), color: PAL.gold, order: 0.55 });
    d.strokes.push({ pts: cup, order: 0.5 });
    return d;
  }

  function sunflower(seed) {
    const d = { strokes: [], fills: [] };
    const stem = wobble(spline([[0, 0], [-8, -160], [6, -320], [0, -470]], 14), 1.2, 40, seed);
    d.strokes.push({ pts: stem, order: 0 });
    addLeaf(d, leafOn([-3, -150], -150, { len: 170, width: 110, petiole: 30, curve: -8, seed: seed + 1, veins: [] }), 0.2);
    addLeaf(d, leafOn([3, -250], -35, { len: 160, width: 100, petiole: 28, curve: 8, seed: seed + 2, veins: [] }), 0.3);
    // flower head: scalloped golden disc + centre
    const cx = 0, cy = -500;
    const petals = [];
    const n = 13;
    for (let i = 0; i <= n * 8; i++) {
      const a = (i / (n * 8)) * TAU;
      const k = 1 + 0.16 * Math.pow(Math.abs(Math.cos((a * n) / 2)), 1.6);
      petals.push([cx + Math.cos(a) * 62 * k, cy + Math.sin(a) * 62 * k]);
    }
    const pw = wobble(petals, 1.2, 30, seed + 4, true);
    d.fills.push({ pts: pw.map((p) => [p[0] + 4, p[1] + 4]), color: PAL.gold, order: 0.55 });
    d.strokes.push({ pts: pw, order: 0.5 });
    const ctr = wobble(circlePts(cx, cy, 28, 48), 0.8, 20, seed + 5, true);
    d.fills.push({ pts: ctr, color: PAL.greenDark, order: 0.7 });
    d.strokes.push({ pts: ctr, order: 0.65 });
    return d;
  }

  function leafyStalk(seed, h = 380, lean = -1) {
    const d = { strokes: [], fills: [] };
    const top = [lean * 50, -h];
    const stem = wobble(spline([[0, 0], [lean * 5, -h * 0.35], [lean * 22, -h * 0.7], top], 14), 1.2, 40, seed);
    d.strokes.push({ pts: stem, order: 0 });
    const S = PS.resample(stem, 4);
    const at = (f) => S[Math.floor(f * (S.length - 1))];
    addLeaf(d, leafOn(at(0.28), lean < 0 ? -160 : -20, { len: 150, width: 80, petiole: 18, seed: seed + 1, veins: [] }), 0.2);
    addLeaf(d, leafOn(at(0.52), lean < 0 ? -30 : -150, { len: 140, width: 76, petiole: 18, seed: seed + 2, veins: [] }), 0.32);
    addLeaf(d, leafOn(at(0.74), lean < 0 ? -150 : -30, { len: 120, width: 66, petiole: 16, seed: seed + 3, veins: [] }), 0.44);
    addLeaf(d, leafOn(top, lean < 0 ? -110 : -70, { len: 100, width: 56, petiole: 10, seed: seed + 4, veins: [] }), 0.56);
    return d;
  }

  function sprout(seed, s = 1) {
    const d = { strokes: [], fills: [] };
    const stem = wobble(quad([0, 0], [4 * s, -40 * s], [0, -80 * s], 10), 0.8, 30, seed);
    d.strokes.push({ pts: stem, order: 0 });
    addLeaf(d, leafOn([0, -80 * s], -150, { len: 70 * s, width: 44 * s, petiole: 6, seed: seed + 1, veins: [], wob: 0.9 }), 0.3, { mid: false });
    addLeaf(d, leafOn([0, -80 * s], -30, { len: 74 * s, width: 46 * s, petiole: 6, seed: seed + 2, veins: [], wob: 0.9 }), 0.36, { mid: false });
    return d;
  }

  function grass(seed, s = 1) {
    const d = { strokes: [], fills: [] };
    const r = rng(seed);
    const blades = [[-14, -60, -26], [-5, -84, -8], [5, -96, 6], [14, -70, 24]];
    blades.forEach((b, i) => {
      const pts = quad([b[0] * 0.4 * s, 0], [b[0] * s, b[1] * 0.55 * s], [b[2] * s + (r() - 0.5) * 6, b[1] * s], 12);
      d.strokes.push({ pts: wobble(pts, 0.7, 30, seed + i), order: i * 0.08 });
    });
    return d;
  }

  function tree(seed) {
    const d = { strokes: [], fills: [] };
    const trunkL = wobble(spline([[-12, 0], [-8, -120], [-10, -230]], 12), 1.1, 40, seed);
    const trunkR = wobble(spline([[12, 0], [9, -120], [12, -230]], 12), 1.1, 40, seed + 1);
    const branch = wobble(quad([6, -170], [40, -200], [56, -250], 10), 1, 30, seed + 2);
    d.strokes.push({ pts: trunkL, order: 0 }, { pts: trunkR, order: 0.02 }, { pts: branch, order: 0.15 });
    // canopy: scalloped cloud blob
    const ctrl = [];
    const r = rng(seed + 3);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      const rr = 160 * (0.92 + r() * 0.14);
      ctrl.push([Math.cos(a) * rr * 1.08, -370 + Math.sin(a) * rr * 0.92]);
    }
    const scallop = [];
    for (let i = 0; i < n; i++) {
      const p = ctrl[i], q = ctrl[(i + 1) % n];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const out = [m[0] * 1.0 + (m[0] - 0) * 0.16, -370 + (m[1] + 370) * 1.16];
      scallop.push(...quad(p, out, q, 10).slice(0, -1));
    }
    scallop.push(scallop[0].slice());
    const can = wobble(scallop, 1.3, 40, seed + 4, true);
    d.fills.push({ pts: can.map((p) => [p[0] + 6, p[1] + 6]), color: PAL.greenMid, order: 0.45 });
    d.strokes.push({ pts: can, order: 0.35 });
    return d;
  }

  function bush(seed, s = 1) {
    const d = { strokes: [], fills: [] };
    const pts = [];
    const n = 5;
    const ctrl = [[-110 * s, 0]];
    for (let i = 0; i < n; i++) {
      const a = Math.PI + ((i + 0.5) / n) * Math.PI;
      ctrl.push([Math.cos(a) * 110 * s, Math.sin(a) * 92 * s]);
    }
    ctrl.push([110 * s, 0]);
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p = ctrl[i], q = ctrl[i + 1];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const len = Math.hypot(m[0], m[1]) || 1;
      pts.push(...quad(p, [m[0] + (m[0] / len) * 26 * s, m[1] + (m[1] / len) * 26 * s], q, 10).slice(0, -1));
    }
    pts.push(ctrl[ctrl.length - 1]);
    const w = wobble(pts, 1.1, 34, seed);
    d.fills.push({ pts: [...w.map((p) => [p[0] + 5, p[1] + 5]), [110 * s + 5, 6], [-110 * s + 5, 6]], color: PAL.green, order: 0.3 });
    d.strokes.push({ pts: w, order: 0 });
    return d;
  }

  function pebble(seed, rx, ry) {
    const d = { strokes: [], fills: [] };
    const pts = wobble(PS.superellipse(rx, ry, 2.2, 48).map((p) => [p[0], p[1] - ry * 0.6]), 0.7, 20, seed, true);
    d.fills.push({ pts: pts.map((p) => [p[0] + 3, p[1] + 3]), color: PAL.cream, order: 0.4 });
    d.strokes.push({ pts, order: 0 });
    return d;
  }

  Object.assign(PS, {
    leafShape, droplet, hexagon, superellipse, blobCircle, cellShape,
    leafOn, tulip, sunflower, leafyStalk, sprout, grass, tree, bush, pebble,
  });
})(window.PS);
