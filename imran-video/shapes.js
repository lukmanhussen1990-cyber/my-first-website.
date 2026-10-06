// Shared shapes + deterministic shared state used by several scenes (spec §1.5, §3.5, §3.6, §3.7).
(function () {
  const { PAL } = L;

  // Minimal SVG path flattener: absolute M, L, C, Q, Z. Returns array of subpaths (closed point lists).
  function pathToPoints(d, segs = 14) {
    const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
    const out = []; let cur = [], i = 0, cmd = null, x = 0, y = 0;
    const num = () => parseFloat(tok[i++]);
    while (i < tok.length) {
      if (/[MLCQZ]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
      if (cmd === 'M') { if (cur.length) out.push(cur); x = num(); y = num(); cur = [[x, y]]; cmd = 'L'; }
      else if (cmd === 'L') { x = num(); y = num(); cur.push([x, y]); }
      else if (cmd === 'C') {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num();
        for (let s = 1; s <= segs; s++) {
          const t = s / segs, u = 1 - t;
          cur.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                    u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
        }
        x = x3; y = y3;
      } else if (cmd === 'Q') {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num();
        for (let s = 1; s <= segs; s++) {
          const t = s / segs, u = 1 - t;
          cur.push([u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2]);
        }
        x = x2; y = y2;
      } else if (cmd === 'Z') { if (cur.length) out.push(cur); cur = []; }
      else i++;
    }
    if (cur.length) out.push(cur);
    // drop duplicated closing point
    return out.map((p) => (p.length > 2 && L.dist(p[0], p[p.length - 1]) < 0.5 ? p.slice(0, -1) : p));
  }

  // Resample to n points, clockwise in y-down screen space, starting at the top-most point (spec §1.5).
  function canon(pts, n = 96) {
    let r = L.resample(pts, n, true);
    if (L.signedArea(r) < 0) r = r.reverse(); // positive area in y-down = clockwise on screen
    let top = 0; r.forEach((p, i) => { if (p[1] < r[top][1]) top = i; });
    return r.map((_, i) => r[(i + top) % n]);
  }
  // Morph pair per spec: both canonical, offset search within ±8.
  function pair(A, B, n = 96) {
    const a = canon(A, n), b0 = canon(B, n);
    let best = 0, bestD = Infinity;
    for (let off = -8; off <= 8; off++) {
      let d = 0;
      for (let i = 0; i < n; i++) { const q = b0[(i + off + n) % n]; d += (a[i][0] - q[0]) ** 2 + (a[i][1] - q[1]) ** 2; }
      if (d < bestD) { bestD = d; best = off; }
    }
    return [a, b0.map((_, i) => b0[(i + best + n) % n])];
  }
  // Point-wise lerp; t may overshoot past 1 (extrapolates, intended).
  const lerpShape = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);

  // Boil: seeded per-vertex offset; shapes under 40px get smaller amplitude (spec §1.3).
  function boilPts(pts, shapeId, t, amp) {
    const b = L.boil(t);
    if (amp === undefined) {
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
      amp = Math.max(maxx - minx, maxy - miny) < 40 ? 1.2 : 2.5;
    }
    const r = L.rng(shapeId * 7919 + b);
    return pts.map((p) => [p[0] + (r() - 0.5) * 2 * amp, p[1] + (r() - 0.5) * 2 * amp]);
  }

  // ---------------- shape library (relative to their own center) ----------------
  const C_D = 'M 40 -200 C 110 -210 130 -140 80 -100 C 40 -70 10 -40 20 0 C 30 30 80 40 130 50 C 190 60 190 170 110 180 C 20 195 -120 190 -165 120 C -190 60 -170 -20 -110 -60 C -60 -100 -30 -195 40 -200 Z';
  // Thumbs-up (spec §3.6 silhouette, refined: tapered thumb with a rounded tip instead of a flat bar)
  const THUMB_D = 'M -45 -244 C -5 -252 28 -232 26 -196 C 24 -160 22 -110 32 -72 L 125 -62 C 165 -60 172 -10 135 -5 C 175 0 178 52 138 58 C 175 64 176 114 136 120 C 168 128 165 182 125 188 L -105 196 C -140 196 -150 170 -150 140 L -150 -20 C -150 -50 -125 -62 -104 -74 C -96 -120 -98 -170 -88 -205 C -80 -232 -66 -240 -45 -244 Z';
  const HEART_D = 'M 0 22 C -10 14 -30 4 -28 -8 C -26 -20 -10 -22 0 -10 C 10 -22 26 -20 28 -8 C 30 4 10 14 0 22 Z';

  const C_SHAPE = canon(pathToPoints(C_D)[0]);
  // C2: wider mouth, scaled (1.08,1.12), rotated -8° (spec §3.6)
  const C2_SHAPE = (() => {
    const a = (-8 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return canon(C_SHAPE.map(([x, y]) => {
      if (y < -60) y -= 14; else if (y > 40) y += 14;
      x *= 1.08; y *= 1.12;
      return [x * c - y * s, x * s + y * c];
    }));
  })();
  const THUMB = canon(pathToPoints(THUMB_D, 18)[0]);
  const HEART = canon(pathToPoints(HEART_D)[0], 32);
  const THUMB_CREASES = [[[70, -5], [138, -5]], [[70, 58], [140, 58]], [[70, 120], [136, 120]]];

  // Hero blob base: 18-gon, r 200, fixed ±8% radial variation (seeded), centered at 0,0 (spec §3.5)
  const HERO_BASE = (() => {
    const r = L.rng(4242), pts = [];
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (i / 18) * Math.PI * 2;
      const k = 1 + (r() - 0.5) * 0.16;
      pts.push([Math.cos(a) * 200 * k, Math.sin(a) * 200 * k]);
    }
    return canon(pts);
  })();

  // Hero squash spring (global, spec §3.5): sx = WOBBLE(t − 8.90; 0.32, 3, 0.25), sy = 1/sx
  function heroSpring(t) {
    if (t < T.T_IMPACT) return [1, 1];
    const sx = L.WOBBLE(t - T.T_IMPACT, 0.32, 3, 0.25);
    return [sx, 1 / sx];
  }

  // Hero idle breath (spec §3.6): scale 1 ± 0.02 at 1.2 Hz, phase-locked to the impact so merge -> blob is seamless.
  function heroBreath(t) { return 1 + 0.02 * Math.sin(2 * Math.PI * 1.2 * Math.max(0, t - T.T_IMPACT)); }
  // Hero blob center (spec §3.5/3.6)
  const HERO_CENTER = [960, 555];

  // Draw a closed point list with 6px rounded corners (cut-paper).
  function fill(ctx, pts, color, round = 6) {
    L.fillPoly(ctx, pts, color, { round });
  }

  // Thumbs-up: shape + finger creases. o: x, y (center), s (scale), rot (rad), t (for boil),
  // creases: [p0,p1,p2] write-on progress 0..1 each (default all 1), color, id (boil seed)
  function drawThumb(ctx, o) {
    const s = o.s ?? 1, t = o.t ?? 0;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.sx || o.sy) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    const pts = (o.shape || THUMB).map(([x, y]) => [x * s, y * s]);
    fill(ctx, boilPts(pts, o.id ?? 77, t), o.color ?? PAL.orange, 6 * Math.min(1, s * 2));
    const cr = o.creases ?? [1, 1, 1];
    THUMB_CREASES.forEach((seg, k) => {
      if (cr[k] <= 0) return;
      const p = seg.map(([x, y]) => [x * s, y * s]);
      L.brushStroke(ctx, boilPts([p[0], L.lerpPt(p[0], p[1], 0.5), p[1]], 300 + k, t, 1.2 * Math.min(1, s * 2)),
        { width: Math.max(2, 7 * s), to: cr[k], taperIn: 0.25, taperOut: 0.3, wob: 0.08, seed: k + 1 });
    });
    ctx.restore();
  }

  // Bounding-box center of the thumbs-up shape relative to its origin, at scale s (for chip hand-off, spec §3.7).
  const _tb = (() => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, y] of THUMB) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } return [(a + b) / 2, (c + d) / 2]; })();
  const thumbBBoxCenter = (s = 1) => [_tb[0] * s, _tb[1] * s];

  window.S = { heroBreath, HERO_CENTER, thumbBBoxCenter, pathToPoints, canon, pair, lerpShape, boilPts, fill, C_SHAPE, C2_SHAPE, THUMB, HEART, THUMB_CREASES, HERO_BASE, heroSpring, drawThumb };
})();
