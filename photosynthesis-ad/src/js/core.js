// Core utilities: maths, easing, noise, path geometry, camera and paper texture.
// Everything is deterministic: the same time value always draws the same frame.
(function (PS) {
  'use strict';

  const W = 1920, H = 1080;
  const TAU = Math.PI * 2;

  const PAL = {
    paper: '#F4EDDC',
    ink: '#26231F',
    green: '#4E8B47',
    greenDark: '#2F6B3A',
    greenMid: '#5F9A4E',
    greenLight: '#A9CF8A',
    stroma: '#B5D596',
    cellFill: '#E6ECCD',
    gold: '#F0AE2C',
    goldLight: '#F8D477',
    water: '#6FA8CA',
    waterLight: '#CFE5F0',
    cream: '#FCF8EE',
    soil: '#EADFC4',
  };

  const LW = 7;        // main ink weight, constant in screen pixels
  const LW_FINE = 4.5; // fine ink weight for small parts

  // ---------- maths ----------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerpPt = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
  const deg = (d) => d * Math.PI / 180;

  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    // gentle damped settle (small overshoot), used for leaves turning and growing
    settle: (t) => {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return 1 - Math.exp(-5 * t) * Math.cos(6 * t) * (1 - t);
    },
  };

  // CSS-style cubic-bezier easing
  function bezierEase(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let u = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(u) - x; const d = dx(u);
        if (Math.abs(e) < 1e-6) break;
        if (Math.abs(d) < 1e-6) break;
        u -= e / d;
      }
      u = clamp(u);
      return sy(u);
    };
  }

  // Monotone cubic interpolation (Fritsch–Carlson) through [t, v] keys.
  function monotone(keys) {
    const n = keys.length;
    const xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
    }
    return (t) => {
      if (t <= xs[0]) return ys[0];
      if (t >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (t > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] +
        (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }

  // ---------- deterministic randomness ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noise1(seed) {
    const r = rng(seed * 7919 + 13);
    const N = 512, v = new Float32Array(N);
    for (let i = 0; i < N; i++) v[i] = r() * 2 - 1;
    return (x) => {
      const i = Math.floor(x), f = x - i;
      const a = v[((i % N) + N) % N], b = v[(((i + 1) % N) + N) % N];
      const s = f * f * (3 - 2 * f);
      return a + (b - a) * s;
    };
  }

  // ---------- path geometry ----------
  function cumLen(pts) {
    const c = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + dist(pts[i - 1], pts[i]);
    return c;
  }

  // Centripetal Catmull–Rom spline through control points.
  function spline(ctrl, perSeg = 16, closed = false) {
    const P = closed ? [ctrl[ctrl.length - 1], ...ctrl, ctrl[0], ctrl[1]] : [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
    const out = [];
    const segs = closed ? ctrl.length : ctrl.length - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
      const t0 = 0;
      const t1 = t0 + Math.pow(Math.max(dist(p0, p1), 1e-6), 0.5);
      const t2 = t1 + Math.pow(Math.max(dist(p1, p2), 1e-6), 0.5);
      const t3 = t2 + Math.pow(Math.max(dist(p2, p3), 1e-6), 0.5);
      for (let j = 0; j < perSeg; j++) {
        const t = t1 + ((t2 - t1) * j) / perSeg;
        const A1 = lerpPt(p0, p1, (t - t0) / (t1 - t0));
        const A2 = lerpPt(p1, p2, (t - t1) / (t2 - t1));
        const A3 = lerpPt(p2, p3, (t - t2) / (t3 - t2));
        const B1 = lerpPt(A1, A2, (t - t0) / (t2 - t0));
        const B2 = lerpPt(A2, A3, (t - t1) / (t3 - t1));
        out.push(lerpPt(B1, B2, (t - t1) / (t2 - t1)));
      }
    }
    out.push(closed ? out[0].slice() : ctrl[ctrl.length - 1].slice());
    return out;
  }

  function bezier(p0, p1, p2, p3, n = 32) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  }

  function quad(p0, p1, p2, n = 20) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }

  function circlePts(cx, cy, r, n = 72, a0 = 0, sweep = TAU) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }

  function resample(pts, step) {
    const c = cumLen(pts), L = c[c.length - 1];
    const n = Math.max(2, Math.ceil(L / step));
    return resampleN(pts, n + 1, c);
  }

  function resampleN(pts, n, c) {
    c = c || cumLen(pts);
    const L = c[c.length - 1];
    const out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (L * i) / (n - 1);
      while (j < pts.length - 2 && c[j + 1] < s) j++;
      const segL = c[j + 1] - c[j] || 1;
      out.push(lerpPt(pts[j], pts[j + 1], clamp((s - c[j]) / segL)));
    }
    return out;
  }

  // Hand-drawn irregularity: displace along normals with smooth noise.
  function wobble(pts, amp, wl, seed, closed = false, taper = 0) {
    const n = noise1(seed);
    const c = cumLen(pts), L = c[c.length - 1] || 1;
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      let a, b;
      if (closed) {
        a = pts[i === 0 ? pts.length - 2 : i - 1];
        b = pts[i === pts.length - 1 ? 1 : i + 1];
      } else {
        a = pts[Math.max(0, i - 1)];
        b = pts[Math.min(pts.length - 1, i + 1)];
      }
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const s = c[i] / wl;
      let v = n(s) * 0.72 + n(s * 2.6 + 31.7) * 0.28;
      if (closed) {
        const s2 = (c[i] - L) / wl;
        const v2 = n(s2) * 0.72 + n(s2 * 2.6 + 31.7) * 0.28;
        const w = c[i] / L;
        v = v * (1 - w) + v2 * w;
      }
      let k = 1;
      if (taper > 0) k = Math.min(1, c[i] / taper, (L - c[i]) / taper);
      out[i] = [pts[i][0] - dy * amp * v * k, pts[i][1] + dx * amp * v * k];
    }
    return out;
  }

  function centroid(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }

  // Affine transform: scale, rotate, then translate.
  function xf(pts, tx, ty, angle = 0, sx = 1, sy = sx) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0] * sx, y = pts[i][1] * sy;
      out[i] = [tx + x * c - y * s, ty + x * s + y * c];
    }
    return out;
  }

  // ---------- camera ----------
  const cam = { x: W / 2, y: H / 2, z: 1 };
  function setCam(x, y, z) { cam.x = x; cam.y = y; cam.z = z; }
  function toS(p) { return [(p[0] - cam.x) * cam.z + W / 2, (p[1] - cam.y) * cam.z + H / 2]; }
  function toSArr(pts) {
    const out = new Array(pts.length), z = cam.z, ox = W / 2 - cam.x * z, oy = H / 2 - cam.y * z;
    for (let i = 0; i < pts.length; i++) out[i] = [pts[i][0] * z + ox, pts[i][1] * z + oy];
    return out;
  }
  // camera centre that puts world point A at screen point S with zoom z
  function anchorCam(A, S, z) { return [A[0] - (S[0] - W / 2) / z, A[1] - (S[1] - H / 2) / z]; }

  // ---------- drawing (screen space) ----------
  function pathPartial(ctx, pts, from, to) {
    if (to <= from || pts.length < 2) return false;
    const c = cumLen(pts), L = c[c.length - 1];
    if (L <= 0) return false;
    const A = from * L, B = to * L;
    let started = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = c[i], l1 = c[i + 1];
      if (l1 < A) continue;
      if (l0 > B) break;
      const sl = l1 - l0 || 1;
      const p = lerpPt(pts[i], pts[i + 1], clamp((A - l0) / sl));
      const q = lerpPt(pts[i], pts[i + 1], clamp((B - l0) / sl));
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
      ctx.lineTo(q[0], q[1]);
    }
    return started;
  }

  function stroke(ctx, pts, opt = {}) {
    const from = opt.from ?? 0, to = opt.to ?? 1;
    if (to - from <= 1e-4) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = opt.width ?? LW;
    ctx.strokeStyle = opt.color ?? PAL.ink;
    ctx.globalAlpha *= opt.alpha ?? 1;
    ctx.beginPath();
    if (pathPartial(ctx, pts, from, to)) ctx.stroke();
    ctx.restore();
  }

  function fillPoly(ctx, pts, color, alpha = 1) {
    if (alpha <= 0 || pts.length < 3) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function polyPath(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function glow(ctx, x, y, r, color, alpha) {
    if (alpha <= 0 || r <= 0) return;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(248,212,119,0)');
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function hexToRgb(h) {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((x, i) => Math.round(x + (B[i] - x) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // ---------- paper texture (multiply layer, generated once) ----------
  function makePaper(seed = 11) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    const r = rng(seed);
    // coarse lattices for mottling
    function lattice(cell, s) {
      const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
      const rr = rng(s); const v = new Float32Array(gw * gh);
      for (let i = 0; i < v.length; i++) v[i] = rr() * 2 - 1;
      return (x, y) => {
        const fx = x / cell, fy = y / cell;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const a = v[iy * gw + ix], b = v[iy * gw + ix + 1], c = v[(iy + 1) * gw + ix], e = v[(iy + 1) * gw + ix + 1];
        return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty;
      };
    }
    const m1 = lattice(260, seed + 1), m2 = lattice(70, seed + 2), m3 = lattice(9, seed + 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const grain = r() - 0.5;
        const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2);
        const vig = 0.045 * Math.pow(Math.min(1, (nx * nx * 0.8 + ny * ny) / 1.6), 1.4);
        let m = 1 - 0.5 * (0.022 * (m1(x, y) + 1) + 0.016 * (m2(x, y) + 1) + 0.014 * (m3(x, y) + 1)) - 0.028 * grain - vig;
        m = clamp(m, 0.85, 1);
        d[i] = 255 * m;
        d[i + 1] = 255 * (m - 0.004);
        d[i + 2] = 255 * (m - 0.010);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // a few faint paper fibres
    g.globalCompositeOperation = 'multiply';
    g.lineCap = 'round';
    for (let k = 0; k < 420; k++) {
      const x = r() * W, y = r() * H, a = r() * TAU, l = 6 + r() * 22;
      g.strokeStyle = `rgba(150,130,100,${0.05 + r() * 0.06})`;
      g.lineWidth = 0.6 + r() * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return cv;
  }

  Object.assign(PS, {
    W, H, TAU, PAL, LW, LW_FINE,
    clamp, lerp, seg, smooth, lerpPt, dist, rot, deg, ease, bezierEase, monotone,
    rng, noise1, cumLen, spline, bezier, quad, circlePts, resample, resampleN, wobble, centroid, xf,
    cam, setCam, toS, toSArr, anchorCam,
    pathPartial, stroke, fillPoly, polyPath, glow, mix, hexToRgb, makePaper,
  });
})(window.PS = window.PS || {});
