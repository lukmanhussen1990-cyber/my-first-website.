// Shared drawing toolkit for the "Imran, I got you!" video.
// Everything is deterministic: given the same time `t` a frame always renders identically.
// Canvas is 1920x1080. Times are in seconds.
(function () {
  const W = 1920, H = 1080;

  const PAL = {
    bg: '#E3D9CB',      // beige paper
    orange: '#D67556',  // blob / Claude orange
    badge: '#DE8053',   // corner badge
    ink: '#16120E',     // brush strokes, text
    chat: '#F2EEE6',    // chat bubble
    white: '#F9F8F5',   // thought bubbles
    lav: '#CAC9DA',     // avatar circle
    pink: '#C2648A',    // avatar person
    shadow: '#B5B5A6',  // badge shadow
    cream: '#F7EBDD',
  };

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, x) => (x - a) / (b - a);
  // progress of `t` through [a,b], clamped to 0..1
  const remap = (t, a, b) => clamp((t - a) / (b - a));
  const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inQuart: (t) => t * t * t * t,
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
    inOutBack: (t, s = 1.70158) => {
      const c2 = s * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },
    outElastic: (t) => {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
  };

  // Damped spring from 0 -> 1 (overshoots). `t` in seconds since start.
  // freq: oscillations per second, damp: 0..1 (higher = settles faster)
  function spring(t, freq = 2.2, damp = 0.45) {
    if (t <= 0) return 0;
    const w = 2 * Math.PI * freq;
    return 1 - Math.exp(-damp * w * t) * Math.cos(w * Math.sqrt(1 - Math.min(damp * damp, 0.99)) * t);
  }

  // Squash & stretch pair for a pop-in: returns [sx, sy] around 1.
  // `v` is a signed "velocity-ish" amount (e.g. spring(t) overshoot).
  function squash(amount) { return [1 + amount, 1 - amount * 0.8]; }

  // ---------- randomness ----------
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  // smooth 1D value noise in [-1,1]
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i;
    const a = hash(i + seed * 1013.13) * 2 - 1, b = hash(i + 1 + seed * 1013.13) * 2 - 1;
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
  // Hand-drawn "boil": an integer that changes `fps` times per second (default 12fps, like the source).
  const boil = (t, fps = 12) => Math.floor(t * fps + 1e-6);

  // ---------- shapes ----------
  // Irregular "cut paper" polygon around (cx,cy). Returns [[x,y],...].
  // n: vertex count, jag: radial irregularity (0..0.3), rot: rotation (rad),
  // jit: extra per-boil jitter in px (pass boil(t) via `b` to make edges re-jitter at 12fps).
  function blobPoints(cx, cy, rx, ry, o = {}) {
    const n = o.n ?? 11, seed = o.seed ?? 1, jag = o.jag ?? 0.07, rot = o.rot ?? 0;
    const jit = o.jit ?? 0, b = o.b ?? 0;
    const r = rng(seed), rj = rng(seed * 7919 + b * 104729 + 13);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2 + (r() - 0.5) * (Math.PI * 2 / n) * 0.35;
      const k = 1 + (r() - 0.5) * 2 * jag;
      const jx = (rj() - 0.5) * 2 * jit, jy = (rj() - 0.5) * 2 * jit;
      pts.push([cx + Math.cos(a) * rx * k + jx, cy + Math.sin(a) * ry * k + jy]);
    }
    return pts;
  }

  // Add per-boil jitter to any point list.
  function jitter(pts, amount, seed = 1) {
    const r = rng(seed * 31 + 7);
    return pts.map((p) => [p[0] + (r() - 0.5) * 2 * amount, p[1] + (r() - 0.5) * 2 * amount]);
  }

  function transformPts(pts, { x = 0, y = 0, s = 1, sx = 1, sy = 1, rot = 0, ox = 0, oy = 0 } = {}) {
    const c = Math.cos(rot), si = Math.sin(rot);
    return pts.map(([px, py]) => {
      let dx = (px - ox) * s * sx, dy = (py - oy) * s * sy;
      return [ox + x + dx * c - dy * si, oy + y + dx * si + dy * c];
    });
  }

  function polyLength(pts, closed) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    if (closed) L += dist(pts[pts.length - 1], pts[0]);
    return L;
  }

  // Evenly resample a polyline/polygon by arc length to `count` points.
  function resample(pts, count, closed = true) {
    const P = closed ? pts.concat([pts[0]]) : pts.slice();
    const seg = []; let L = 0;
    for (let i = 1; i < P.length; i++) { const d = dist(P[i - 1], P[i]); seg.push(d); L += d; }
    const out = []; const n = closed ? count : count - 1;
    let si = 0, acc = 0;
    for (let k = 0; k < count; k++) {
      const target = (k / n) * L;
      while (si < seg.length - 1 && acc + seg[si] < target) { acc += seg[si]; si++; }
      const f = seg[si] > 0 ? (target - acc) / seg[si] : 0;
      out.push(lerpPt(P[si], P[si + 1], clamp(f)));
    }
    return out;
  }

  // Resample a polyline at a fixed spacing (px).
  function resampleBySpacing(pts, spacing = 3, closed = false) {
    const L = polyLength(pts, closed);
    return resample(pts, Math.max(2, Math.ceil(L / spacing) + 1), closed);
  }

  function signedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  function centroid(pts) {
    let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }

  // Prepare two closed shapes for morphing: same point count, same winding, best start alignment.
  function morphPair(A, B, count = 160) {
    let a = resample(A, count, true), b = resample(B, count, true);
    if (Math.sign(signedArea(a)) !== Math.sign(signedArea(b))) b = b.slice().reverse();
    const ca = centroid(a), cb = centroid(b);
    let best = 0, bestD = Infinity;
    for (let off = 0; off < count; off++) {
      let d = 0;
      for (let i = 0; i < count; i += 4) {
        const p = a[i], q = b[(i + off) % count];
        d += Math.pow(p[0] - ca[0] - (q[0] - cb[0]), 2) + Math.pow(p[1] - ca[1] - (q[1] - cb[1]), 2);
      }
      if (d < bestD) { bestD = d; best = off; }
    }
    b = b.map((_, i) => b[(i + best) % count]);
    return [a, b];
  }
  // Morph between aligned shapes (from morphPair). t in 0..1
  function morph(a, b, t) { return a.map((p, i) => lerpPt(p, b[i], t)); }

  // Catmull-Rom spline through points -> dense point list
  function catmull(pts, closed = false, segs = 8, tension = 0.5) {
    const out = [], n = pts.length;
    const get = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let s = 0; s < segs; s++) {
        const t = s / segs, t2 = t * t, t3 = t2 * t;
        const m1x = (p2[0] - p0[0]) * tension, m1y = (p2[1] - p0[1]) * tension;
        const m2x = (p3[0] - p1[0]) * tension, m2y = (p3[1] - p1[1]) * tension;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        out.push([h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x, h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }

  // Path helpers -----------------------------------------------------------
  function polyPath(ctx, pts, closed = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  }
  // Polygon with softly rounded corners (cut-paper look). r = corner radius px.
  function roundPolyPath(ctx, pts, r = 10) {
    const n = pts.length;
    ctx.beginPath();
    const mid = lerpPt(pts[n - 1], pts[0], 0.5);
    ctx.moveTo(mid[0], mid[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const rr = Math.min(r, dist(p, q) * 0.45, dist(p, pts[(i - 1 + n) % n]) * 0.45);
      ctx.arcTo(p[0], p[1], q[0], q[1], rr);
    }
    ctx.closePath();
  }
  function smoothPath(ctx, pts, closed = true) { polyPath(ctx, catmull(pts, closed, 6), closed); }

  function fillPoly(ctx, pts, color, o = {}) {
    ctx.fillStyle = color;
    if (o.smooth) smoothPath(ctx, pts, true);
    else if (o.round) roundPolyPath(ctx, pts, o.round);
    else polyPath(ctx, pts, true);
    ctx.fill();
  }

  // Variable-width tapered brush stroke along a polyline.
  // o: width, taperIn (0..1 fraction of length), taperOut, from (0..1), to (0..1, write-on progress),
  //    color, wob (width wobble 0..1), seed, spacing
  function brushStroke(ctx, pts, o = {}) {
    const width = o.width ?? 10, tin = o.taperIn ?? 0.12, tout = o.taperOut ?? 0.22;
    const from = o.from ?? 0, to = o.to ?? 1, wob = o.wob ?? 0.18, seed = o.seed ?? 1;
    if (to <= from || pts.length < 2) return;
    const dense = resampleBySpacing(pts, o.spacing ?? 2.5, false);
    const n = dense.length, L = polyLength(dense, false);
    const i0 = Math.floor(from * (n - 1)), i1 = Math.max(i0 + 1, Math.ceil(to * (n - 1)));
    const left = [], right = [];
    for (let i = i0; i <= i1 && i < n; i++) {
      const u = i / (n - 1);
      const p = dense[i], pa = dense[Math.max(0, i - 1)], pb = dense[Math.min(n - 1, i + 1)];
      let dx = pb[0] - pa[0], dy = pb[1] - pa[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      let w = width;
      w *= smoothstep(tin > 0 ? u / tin : 1) * 0.85 + 0.15 * (tin > 0 ? clamp(u / tin) : 1);
      w *= smoothstep(tout > 0 ? (1 - u) / tout : 1) * 0.9 + 0.1 * (tout > 0 ? clamp((1 - u) / tout) : 1);
      w *= 1 + wob * noise1(u * L / 40, seed);
      w = Math.max(w, 0.6);
      left.push([p[0] - dy * w / 2, p[1] + dx * w / 2]);
      right.push([p[0] + dy * w / 2, p[1] - dx * w / 2]);
    }
    ctx.fillStyle = o.color ?? PAL.ink;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    // round caps
    const capAt = (k) => {
      const l = left[k], r = right[k];
      const c = lerpPt(l, r, 0.5), rad = dist(l, r) / 2;
      ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, Math.PI * 2); ctx.fill();
    };
    capAt(0); capAt(left.length - 1);
  }

  // ---------- text ----------
  function font(ctx, family, weight = 400, size = 40) {
    ctx.font = `${weight} ${size}px "${family}"`;
  }
  // SVG displacement filter names (defined in index.html) for a hand-drawn edge.
  // strength: 'soft' | 'mid' | 'hard'. Changes with boil so edges "boil" at 12fps.
  function roughFilter(t, strength = 'soft') {
    return `url(#rough-${strength}-${boil(t) % 4})`;
  }

  // Draw text with optional letter-by-letter reveal and rough edges.
  // o: family, weight, size, color, align, baseline, chars (visible character count, may be fractional),
  //    rough ('soft'|'mid'|'hard'|null), t (time, for boil), spacing (letterSpacing px)
  function text(ctx, str, x, y, o = {}) {
    ctx.save();
    font(ctx, o.family ?? 'Shantell Sans', o.weight ?? 700, o.size ?? 48);
    ctx.fillStyle = o.color ?? PAL.ink;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
    if (o.rough && o.t !== undefined) ctx.filter = roughFilter(o.t, o.rough);
    const s = o.chars !== undefined ? str.slice(0, Math.floor(o.chars)) : str;
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  function measure(ctx, str, o = {}) {
    ctx.save();
    font(ctx, o.family ?? 'Shantell Sans', o.weight ?? 700, o.size ?? 48);
    if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
    const m = ctx.measureText(str);
    ctx.restore();
    return m.width;
  }

  // ---------- canvas helpers ----------
  // Run fn with a transform: translate to (x,y), rotate, scale (sx,sy), around origin.
  function at(ctx, { x = 0, y = 0, s = 1, sx = 1, sy = 1, rot = 0, alpha = 1 }, fn) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(s * sx, s * sy);
    if (alpha !== 1) ctx.globalAlpha *= clamp(alpha);
    fn(ctx);
    ctx.restore();
  }
  // Camera: zoom about a focus point (fx,fy) on screen, plus pan + rotation.
  function camera(ctx, { zoom = 1, fx = W / 2, fy = H / 2, panX = 0, panY = 0, rot = 0 } = {}) {
    ctx.translate(fx + panX, fy + panY);
    if (rot) ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);
  }
  function shake(t, amp = 8, freq = 22, seed = 3) {
    return [noise1(t * freq, seed) * amp, noise1(t * freq, seed + 9) * amp];
  }

  // Offscreen canvases (cached by key) for compositing tricks.
  const _off = {};
  function offscreen(key, w = W, h = H) {
    let c = _off[key];
    if (!c || c.width !== w || c.height !== h) {
      c = document.createElement('canvas'); c.width = w; c.height = h; _off[key] = c;
    }
    const cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.filter = 'none';
    cx.globalCompositeOperation = 'source-over';
    cx.clearRect(0, 0, w, h);
    return [c, cx];
  }

  // ---------- 5-point sparkle (Claude-like ✦ star) ----------
  // 4-point star with concave curved sides. pinch: how close the side curves pass to the center (0..1).
  function sparklePath(ctx, x, y, r, pinch = 0.2, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2, b = a + Math.PI / 2, m = a + Math.PI / 4;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.quadraticCurveTo(x + Math.cos(m) * r * pinch, y + Math.sin(m) * r * pinch, x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
    ctx.closePath();
  }
  function sparkle(ctx, x, y, r, color = PAL.cream, rot = 0, pinch = 0.18) {
    ctx.fillStyle = color; sparklePath(ctx, x, y, r, pinch, rot); ctx.fill();
  }

  // ---------- corner badge (matches the source: "✦ CLAUDE / OPUS 5") ----------
  function drawBadge(ctx, alpha = 1) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    const x = 1548, y = 32, w = 321, h = 87;
    ctx.fillStyle = PAL.shadow; ctx.fillRect(x + 6, y + 7, w, h);
    ctx.fillStyle = '#E6D5C2'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = PAL.badge; ctx.fillRect(x, y, w, h);
    sparkle(ctx, x + 45, y + 45, 16, PAL.cream, 0, 0.16);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#3A1E12';
    ctx.font = '400 17px "DejaVu Sans"';
    ctx.fillText('CLAUDE', x + 89, y + 31);
    ctx.font = '700 41px "DejaVu Sans"';
    ctx.fillStyle = 'rgba(90,40,20,0.35)';
    ctx.fillText('OPUS 5', x + 90, y + 74);
    ctx.fillStyle = PAL.cream;
    ctx.fillText('OPUS 5', x + 88, y + 72);
    ctx.restore();
  }

  // ---------- paper grain ----------
  const _grain = [];
  function grainTiles() {
    if (_grain.length) return _grain;
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const cx = c.getContext('2d'); const id = cx.createImageData(256, 256); const r = rng(1000 + k);
      for (let i = 0; i < 256 * 256; i++) {
        const v = 128 + (r() - 0.5) * 120;
        id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
      }
      cx.putImageData(id, 0, 0); _grain.push(c);
    }
    return _grain;
  }
  function grain(ctx, t, amount = 0.07) {
    const tiles = grainTiles();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    ctx.fillStyle = ctx.createPattern(tiles[boil(t) % 4], 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  window.L = {
    W, H, PAL, clamp, lerp, invLerp, remap, smoothstep, lerpPt, dist, ease, spring, squash,
    rng, hash, noise1, boil, blobPoints, jitter, transformPts, polyLength, resample, resampleBySpacing,
    signedArea, centroid, morphPair, morph, catmull, polyPath, roundPolyPath, smoothPath, fillPoly,
    brushStroke, font, roughFilter, text, measure, at, camera, shake, offscreen, sparklePath, sparkle,
    drawBadge, grain,
  };
})();
