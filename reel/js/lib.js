// Shared helpers: maths, easing, seeded noise, path builders.
(function () {
  const L = {};

  L.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  L.lerp = (a, b, k) => a + (b - a) * k;
  L.inv = (a, b, v) => L.clamp((v - a) / (b - a));
  L.smooth = (k) => { k = L.clamp(k); return k * k * (3 - 2 * k); };
  L.easeInOut = (k) => { k = L.clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  L.easeInOutSine = (k) => { k = L.clamp(k); return -(Math.cos(Math.PI * k) - 1) / 2; };
  L.easeOut = (k) => { k = L.clamp(k); return 1 - Math.pow(1 - k, 3); };
  L.easeIn = (k) => { k = L.clamp(k); return k * k * k; };
  L.easeOutQuint = (k) => { k = L.clamp(k); return 1 - Math.pow(1 - k, 5); };
  // eased progress of t through the window [a, b]
  L.win = (t, a, b, ease = L.easeInOut) => ease(L.inv(a, b, t));
  // 0 -> 1 -> 0 envelope: rises over [a,b], holds, falls over [c,d]
  L.env = (t, a, b, c, d, ease = L.easeInOutSine) => ease(L.inv(a, b, t)) * (1 - ease(L.inv(c, d, t)));

  L.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // smooth 1D value noise in [-1, 1]
  const perm = (() => { const r = L.rng(99); const a = []; for (let i = 0; i < 512; i++) a.push(r() * 2 - 1); return a; })();
  L.noise1 = (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return L.lerp(perm[((i % 512) + 512) % 512], perm[(((i + 1) % 512) + 512) % 512], u);
  };
  L.noise2 = (x, y) => L.noise1(x + L.noise1(y * 0.7 + 13.1) * 3.1 + y * 1.37);

  L.hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  L.mix = (a, b, k) => [L.lerp(a[0], b[0], k), L.lerp(a[1], b[1], k), L.lerp(a[2], b[2], k)];
  L.rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // Catmull-Rom smoothed path through points. A point [x, y, 's'] is a sharp corner.
  L.smoothPath = function (pts, closed = true, path = new Path2D()) {
    const n = pts.length;
    const get = (i) => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    path.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const k1 = p1[2] === 's' ? 0 : 1 / 6, k2 = p2[2] === 's' ? 0 : 1 / 6;
      path.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1,
        p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2,
        p2[0], p2[1]);
    }
    if (closed) path.closePath();
    return path;
  };

  // A tapered limb around a centre line. widths[i] is the full width at pts[i].
  L.taperPts = function (pts, widths, capStart = true, capEnd = true) {
    const n = pts.length, left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const w = widths[i] / 2;
      left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
      right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const out = [];
    const cap = (p, q, w, dir) => { // rounded cap point
      let dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] - dx / len * w * 0.9 * dir, p[1] - dy / len * w * 0.9 * dir];
    };
    if (capStart) out.push(cap(pts[0], pts[1], widths[0] / 2, 1));
    for (const p of left) out.push(p);
    if (capEnd) out.push(cap(pts[n - 1], pts[n - 2], widths[n - 1] / 2, 1));
    for (let i = n - 1; i >= 0; i--) out.push(right[i]);
    return out;
  };
  L.taper = (pts, widths, path) => L.smoothPath(L.taperPts(pts, widths), true, path);

  L.ellipse = (cx, cy, rx, ry, rot = 0, path = new Path2D()) => {
    path.moveTo(cx + Math.cos(rot) * rx, cy + Math.sin(rot) * rx);
    path.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    path.closePath();
    return path;
  };
  L.circle = (cx, cy, r, path = new Path2D()) => L.ellipse(cx, cy, r, r, 0, path);

  // two-segment limb (e.g. a leg) from root with absolute angles (0 = straight down,
  // positive = rotate toward -x).  Returns joint positions.
  L.chain = (root, segs) => {
    const out = [root.slice()];
    let p = root.slice();
    for (const [len, ang] of segs) {
      p = [p[0] - Math.sin(ang) * len, p[1] + Math.cos(ang) * len];
      out.push(p);
    }
    return out;
  };

  L.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  window.L = L;
})();
