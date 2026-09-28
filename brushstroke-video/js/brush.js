/* brush.js - the brush engine.
   A stroke is a spline through control points, given a pressure profile
   (tapered in, swelling, tapered out), ragged edges, and dry-brush bristle
   gaps. Each stroke is painted on a scratch canvas first so its dry gaps
   only cut into itself, then composited onto the target layer. */
(function () {
  'use strict';
  const BV = window.BV;
  const U = BV.util;

  let scratch = null;
  let sctx = null;
  function scratchCtx(w, h) {
    if (!scratch || scratch.width < w || scratch.height < h) {
      scratch = U.makeCanvas(Math.max(w, scratch ? scratch.width : 0), Math.max(h, scratch ? scratch.height : 0));
      sctx = scratch.getContext('2d');
    }
    return sctx;
  }

  const DEFAULTS = {
    w: 6, // base width in px
    tin: null, // taper-in length in px (auto when null)
    tout: null, // taper-out length in px (auto when null)
    minTip: 0.12, // width multiplier at the very tips
    swell: 0.12, // extra width mid-stroke
    wobble: 0.16, // slow pressure variation
    edge: 0.14, // ragged edge amount
    dry: 0.25, // 0 = wet, solid ink; 1 = very dry, streaky
    bristles: 0, // bristle count for dry gaps (auto when 0)
    step: 1.1, // resample spacing in px
    color: '#131813',
    alpha: 1,
    seed: 1,
  };

  function make(points, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const pts = U.resample(U.spline(points, 1.5), o.step);
    const n = pts.length;
    const xs = new Float32Array(n), ys = new Float32Array(n);
    const nx = new Float32Array(n), ny = new Float32Array(n);
    const hw = new Float32Array(n), cum = new Float32Array(n);
    const lx = new Float32Array(n), ly = new Float32Array(n);
    const rx = new Float32Array(n), ry = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = pts[i][0];
      ys[i] = pts[i][1];
      if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    const L = Math.max(cum[n - 1], 0.01);
    const tin = o.tin != null ? o.tin : Math.min(L * 0.3, o.w * 1.6);
    const tout = o.tout != null ? o.tout : Math.min(L * 0.45, o.w * 3.2);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      nx[i] = -ty;
      ny[i] = tx;
      const s = cum[i];
      const u = s / L;
      let p = 1;
      if (s < tin) p *= U.lerp(o.minTip, 1, Math.pow(s / tin, 0.55));
      if (L - s < tout) p *= U.lerp(o.minTip, 1, Math.pow((L - s) / tout, 0.7));
      p *= 1 + o.swell * Math.sin(Math.PI * u);
      p *= 1 + o.wobble * (U.fbm1(s / (o.w * 5 + 8), o.seed) - 0.5) * 2;
      const h = o.w * 0.5 * p;
      hw[i] = h;
      const el = 1 + o.edge * (U.fbm1(s / (o.w * 0.8 + 1), o.seed + 31) - 0.5) * 2;
      const er = 1 + o.edge * (U.fbm1(s / (o.w * 0.8 + 1), o.seed + 57) - 0.5) * 2;
      lx[i] = xs[i] + nx[i] * h * el;
      ly[i] = ys[i] + ny[i] * h * el;
      rx[i] = xs[i] - nx[i] * h * er;
      ry[i] = ys[i] - ny[i] * h * er;
      x0 = Math.min(x0, lx[i], rx[i]);
      y0 = Math.min(y0, ly[i], ry[i]);
      x1 = Math.max(x1, lx[i], rx[i]);
      y1 = Math.max(y1, ly[i], ry[i]);
    }

    // Dry-brush gaps: each bristle runs along the stroke at a fixed lateral
    // offset and "runs out of ink" where noise dips below the dryness level.
    // Dryness climbs toward the end of the stroke, like a real brush.
    const gaps = [];
    if (o.dry > 0) {
      const nb = o.bristles || U.clamp(Math.round(o.w / 1.4), 3, 18);
      const r = U.rng(o.seed * 7 + 3);
      for (let b = 0; b < nb; b++) {
        const off = -0.95 + (1.9 * (b + 0.5)) / nb + (r() - 0.5) * (1.2 / nb);
        const sb = o.seed * 131 + b * 17;
        const edgeBias = 0.55 + 0.45 * Math.abs(off);
        const freq = 1 / (o.w * (0.6 + r() * 1.4) + 2);
        const runs = [];
        let start = -1;
        for (let i = 0; i < n; i++) {
          const u = cum[i] / L;
          const dryness = o.dry * edgeBias * (0.3 + 0.9 * U.smooth(0.25, 1, u));
          const gap = U.noise1(cum[i] * freq, sb) < dryness * 0.75;
          if (gap && start < 0) start = i;
          if ((!gap || i === n - 1) && start >= 0) {
            if (i - start > 1) runs.push(start, i);
            start = -1;
          }
        }
        if (runs.length) gaps.push({ off, runs, lw: Math.max(0.7, (o.w / nb) * (0.7 + r() * 0.9)) });
      }
    }

    const pad = 3;
    return {
      o, n, L, xs, ys, nx, ny, hw, cum, lx, ly, rx, ry, gaps,
      bbox: [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)],
    };
  }

  // Paint stroke st up to progress (0..1) onto ctx.
  function draw(ctx, st, progress, alphaMul, fillOverride) {
    if (progress <= 0 || st.n < 2) return;
    const k = progress >= 1 ? st.n - 1 : Math.max(1, Math.floor(progress * (st.n - 1)));
    const [bx0, by0, bx1, by1] = st.bbox;
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bw <= 0 || bh <= 0) return;
    const s = scratchCtx(bw, bh);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.clearRect(0, 0, bw, bh);
    s.translate(-bx0, -by0);

    const { lx, ly, rx, ry, xs, ys, hw, nx, ny } = st;
    s.fillStyle = fillOverride || st.o.color;
    s.beginPath();
    s.moveTo(rx[0], ry[0]);
    s.lineTo(lx[0], ly[0]);
    for (let i = 1; i <= k; i++) s.lineTo(lx[i], ly[i]);
    // round, slightly flattened brush head at the leading end
    const ang = Math.atan2(ny[k], nx[k]);
    s.arc(xs[k], ys[k], hw[k], ang, ang - Math.PI, true);
    for (let i = k; i >= 0; i--) s.lineTo(rx[i], ry[i]);
    s.closePath();
    s.fill();

    if (st.gaps.length) {
      s.globalCompositeOperation = 'destination-out';
      s.strokeStyle = '#000';
      s.lineCap = 'round';
      for (const g of st.gaps) {
        s.lineWidth = g.lw;
        s.beginPath();
        for (let r = 0; r < g.runs.length; r += 2) {
          const a = g.runs[r];
          if (a > k) break;
          const b = Math.min(g.runs[r + 1], k);
          s.moveTo(xs[a] + nx[a] * hw[a] * g.off, ys[a] + ny[a] * hw[a] * g.off);
          for (let i = a + 1; i <= b; i++) s.lineTo(xs[i] + nx[i] * hw[i] * g.off, ys[i] + ny[i] * hw[i] * g.off);
        }
        s.stroke();
      }
    }

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * st.o.alpha * (alphaMul == null ? 1 : alphaMul);
    ctx.drawImage(scratch, 0, 0, bw, bh, bx0, by0, bw, bh);
    ctx.globalAlpha = prevAlpha;
  }

  // ---------- watercolour washes ----------
  // Layered, recursively-deformed translucent polygons give soft bleeding
  // edges and darker overlaps, like pigment pooling on paper.
  function gauss(r) {
    return (r() + r() + r() + r() - 2) / 2;
  }

  function deform(poly, depth, variance, r) {
    let P = poly;
    for (let d = 0; d < depth; d++) {
      const Q = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        const v = a[2] != null ? a[2] : variance;
        Q.push([a[0], a[1], v]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const m = [(a[0] + b[0]) / 2 + gauss(r) * len * v, (a[1] + b[1]) / 2 + gauss(r) * len * v, v * (0.6 + r() * 0.5)];
        Q.push(m);
      }
      P = Q;
    }
    return P;
  }

  function makeWash(poly, opts) {
    const o = Object.assign({ color: '#6b4a32', alpha: 0.045, layers: 22, variance: 0.22, seed: 1 }, opts);
    const r = U.rng(o.seed);
    const base = deform(poly, 3, o.variance, r);
    const layers = [];
    for (let j = 0; j < o.layers; j++) layers.push(deform(base, 3, o.variance * 0.75, r));
    return { o, layers };
  }

  function drawWash(ctx, wash, alphaMul) {
    ctx.save();
    ctx.fillStyle = wash.o.color;
    ctx.globalAlpha = wash.o.alpha * (alphaMul == null ? 1 : alphaMul);
    for (const P of wash.layers) {
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- hatching ----------
  // Parallel dry-brush strokes clipped to a region polygon.
  function makeHatch(poly, opts) {
    const o = Object.assign({ angle: -35, gap: 9, w: 1.8, color: '#3a2618', alpha: 0.5, jitter: 0.35, curve: 3, dry: 0.5, seed: 1, minLen: 10 }, opts);
    const r = U.rng(o.seed);
    const a = (o.angle * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const qx = -dy, qy = dx;
    let pmin = Infinity, pmax = -Infinity, dmin = Infinity, dmax = -Infinity;
    for (const p of poly) {
      const pr = p[0] * qx + p[1] * qy;
      const dd = p[0] * dx + p[1] * dy;
      pmin = Math.min(pmin, pr);
      pmax = Math.max(pmax, pr);
      dmin = Math.min(dmin, dd);
      dmax = Math.max(dmax, dd);
    }
    const strokes = [];
    let idx = 0;
    for (let off = pmin + o.gap * 0.5; off < pmax; off += o.gap * (1 + (r() - 0.5) * o.jitter)) {
      let run = null;
      const step = 3;
      for (let d = dmin; d <= dmax + step; d += step) {
        const x = qx * off + dx * d, y = qy * off + dy * d;
        const inside = d <= dmax && U.pointInPoly(x, y, poly);
        if (inside) {
          if (!run) run = [[x, y]];
          else run[1] = [x, y];
        } else if (run) {
          if (run[1]) pushHatch(run[0], run[1]);
          run = null;
        }
      }
    }
    function pushHatch(p0, p1) {
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (len < o.minLen) return;
      // shorten randomly at both ends so the hatching looks hand-made
      const s0 = r() * 0.12, s1 = 1 - r() * 0.12;
      const A = [U.lerp(p0[0], p1[0], s0), U.lerp(p0[1], p1[1], s0)];
      const B = [U.lerp(p0[0], p1[0], s1), U.lerp(p0[1], p1[1], s1)];
      const c = (r() - 0.5) * o.curve;
      const M = [(A[0] + B[0]) / 2 + qx * c, (A[1] + B[1]) / 2 + qy * c];
      strokes.push(
        make([A, M, B], {
          w: o.w * (0.75 + r() * 0.5),
          color: o.color,
          alpha: o.alpha * (0.7 + r() * 0.3),
          dry: o.dry,
          edge: 0.1,
          seed: o.seed * 1000 + idx++,
        })
      );
    }
    return strokes;
  }

  BV.brush = { make, draw, makeWash, drawWash, makeHatch };
})();
