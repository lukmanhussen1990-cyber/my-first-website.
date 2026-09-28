/* util.js - seeded randomness, noise, easing and path helpers.
   Everything in the video is deterministic: the same time t always
   produces the same frame, so the render can be split across workers. */
(function () {
  'use strict';
  const BV = (window.BV = window.BV || {});

  function hashInt(x) {
    x |= 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  }

  // Uniform [0,1) value for integer i under a seed.
  function hash(i, seed) {
    return hashInt((i | 0) ^ hashInt((seed | 0) + 0x9e3779b9)) / 4294967296;
  }

  // Small fast PRNG (mulberry32).
  function rng(seed) {
    let a = hashInt(seed | 0);
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth 1D value noise in [0,1).
  function noise1(x, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = hash(i, seed);
    const b = hash(i + 1, seed);
    return a + (b - a) * u;
  }

  function fbm1(x, seed) {
    return noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.3 + noise1(x * 4.37, seed + 13) * 0.1;
  }

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIn = (t) => Math.pow(clamp(t, 0, 1), 3);
  const easeInOut = (t) => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Rise over [a, a+fin], hold, fall over [b-fout, b]. Returns 0..1.
  function envelope(t, a, b, fin, fout) {
    if (t <= a || t >= b) return 0;
    return Math.min(smooth(a, a + fin, t), 1 - smooth(b - fout, b, t));
  }

  // Points on an ellipse arc; angles in degrees, y axis pointing down.
  function arc(cx, cy, rx, ry, a0, a1, stepDeg) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (stepDeg || 12)) + 1);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }

  // Concatenate point runs, dropping duplicated joints.
  function cat() {
    const out = [];
    for (const part of arguments) {
      for (const p of part) {
        const q = out[out.length - 1];
        if (q && Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6) {
          if (p[2]) q[2] = p[2];
          continue;
        }
        out.push(p.slice());
      }
    }
    return out;
  }

  // Centripetal Catmull-Rom through pts. A point with p[2] === 1 is a sharp
  // corner: the curve is split there so it keeps its angle.
  function spline(pts, step) {
    if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
    const pieces = [];
    let cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      cur.push(pts[i]);
      if (pts[i][2] === 1 && i < pts.length - 1) {
        pieces.push(cur);
        cur = [pts[i]];
      }
    }
    pieces.push(cur);
    const out = [];
    for (const pc of pieces) {
      const seg = splinePiece(pc, step);
      if (out.length) seg.shift();
      for (const p of seg) out.push(p);
    }
    return out;
  }

  function splinePiece(P, step) {
    const out = [];
    if (P.length === 2) {
      const d = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
      const n = Math.max(1, Math.ceil(d / step));
      for (let i = 0; i <= n; i++) out.push([lerp(P[0][0], P[1][0], i / n), lerp(P[0][1], P[1][1], i / n)]);
      return out;
    }
    const m = P.length;
    const ext = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
    const Q = [ext(P[0], P[1])].concat(P, [ext(P[m - 1], P[m - 2])]);
    for (let i = 1; i < Q.length - 2; i++) {
      const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.max(1, Math.ceil(d / step));
      const t0 = 0;
      const t1 = t0 + Math.max(1e-4, Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])));
      const t2 = t1 + Math.max(1e-4, Math.sqrt(d));
      const t3 = t2 + Math.max(1e-4, Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const t = t1 + ((t2 - t1) * j) / n;
        const a1x = ((t1 - t) / (t1 - t0)) * p0[0] + ((t - t0) / (t1 - t0)) * p1[0];
        const a1y = ((t1 - t) / (t1 - t0)) * p0[1] + ((t - t0) / (t1 - t0)) * p1[1];
        const a2x = ((t2 - t) / (t2 - t1)) * p1[0] + ((t - t1) / (t2 - t1)) * p2[0];
        const a2y = ((t2 - t) / (t2 - t1)) * p1[1] + ((t - t1) / (t2 - t1)) * p2[1];
        const a3x = ((t3 - t) / (t3 - t2)) * p2[0] + ((t - t2) / (t3 - t2)) * p3[0];
        const a3y = ((t3 - t) / (t3 - t2)) * p2[1] + ((t - t2) / (t3 - t2)) * p3[1];
        const b1x = ((t2 - t) / (t2 - t0)) * a1x + ((t - t0) / (t2 - t0)) * a2x;
        const b1y = ((t2 - t) / (t2 - t0)) * a1y + ((t - t0) / (t2 - t0)) * a2y;
        const b2x = ((t3 - t) / (t3 - t1)) * a2x + ((t - t1) / (t3 - t1)) * a3x;
        const b2y = ((t3 - t) / (t3 - t1)) * a2y + ((t - t1) / (t3 - t1)) * a3y;
        out.push([
          ((t2 - t) / (t2 - t1)) * b1x + ((t - t1) / (t2 - t1)) * b2x,
          ((t2 - t) / (t2 - t1)) * b1y + ((t - t1) / (t2 - t1)) * b2y,
        ]);
      }
    }
    return out;
  }

  // Re-sample a dense polyline at an even spacing.
  function resample(pts, spacing) {
    if (pts.length < 2) return pts.slice();
    const out = [[pts[0][0], pts[0][1]]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][1];
      const dx = pts[i][0] - ax, dy = pts[i][1] - ay;
      const d = Math.hypot(dx, dy);
      if (d === 0) continue;
      let pos = spacing - carry;
      while (pos <= d) {
        out.push([ax + (dx * pos) / d, ay + (dy * pos) / d]);
        pos += spacing;
      }
      carry = d - (pos - spacing);
    }
    const last = pts[pts.length - 1];
    const q = out[out.length - 1];
    if (Math.hypot(last[0] - q[0], last[1] - q[1]) > spacing * 0.25) out.push([last[0], last[1]]);
    return out;
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  BV.util = {
    hashInt, hash, rng, noise1, fbm1, clamp, lerp, smooth, easeOut, easeIn, easeInOut,
    envelope, arc, cat, spline, resample, pointInPoly, makeCanvas,
  };
})();
