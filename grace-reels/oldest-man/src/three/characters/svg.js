// Tiny SVG path toolkit for the paper-cut parts. Every part is authored as SVG path data in metres
// (part-local space, y UP, origin = the part's pivot). The same path string is
//   - drawn into the character atlas with canvas Path2D (runtime) or written to .svg files (bake script),
//   - flattened to a polygon for the part's geometry (silhouette edge + outline), so the texture and the
//     geometric edge always match exactly.
// Only absolute M, L, C, Q, Z commands are produced/parsed.

const N = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(5));
const P = (p) => `${N(p[0])} ${N(p[1])}`;

// straight polygon (closed by default)
export function poly(pts, closed = true) {
  let d = `M ${P(pts[0])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${P(pts[i])}`;
  return closed ? d + ' Z' : d;
}

// Catmull-Rom spline through control points as cubic Béziers. A point may carry a 3rd value k:
// tangent scale at that point (0 = sharp corner, 1 = smooth, >1 = rounder).
export function smooth(pts, closed = true, tension = 1) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const k = (p) => (p.length > 2 ? p[2] : 1) * tension / 6;
  let d = `M ${P(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k1 = k(p1), k2 = k(p2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2];
    d += ` C ${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return closed ? d + ' Z' : d;
}

// circular-arc helper (cubic approximation, <= 90° per segment); returns command string without M
function arcCmds(cx, cy, rx, ry, a0, a1) {
  let d = '';
  const segs = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
  const da = (a1 - a0) / segs, kk = (4 / 3) * Math.tan(da / 4);
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + da * i, t1 = t0 + da;
    const p0 = [cx + Math.cos(t0) * rx, cy + Math.sin(t0) * ry], p3 = [cx + Math.cos(t1) * rx, cy + Math.sin(t1) * ry];
    const c1 = [p0[0] - Math.sin(t0) * rx * kk, p0[1] + Math.cos(t0) * ry * kk];
    const c2 = [p3[0] + Math.sin(t1) * rx * kk, p3[1] - Math.cos(t1) * ry * kk];
    d += ` C ${P(c1)} ${P(c2)} ${P(p3)}`;
  }
  return d;
}
export function ellipse(cx, cy, rx, ry = rx) {
  return `M ${P([cx + rx, cy])}` + arcCmds(cx, cy, rx, ry, 0, Math.PI * 2) + ' Z';
}
export function arc(cx, cy, rx, ry, a0, a1, move = true) {
  const p0 = [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry];
  return (move ? `M ${P(p0)}` : ` L ${P(p0)}`) + arcCmds(cx, cy, rx, ry, a0, a1);
}
// limb capsule hanging DOWN from the pivot: round end radius r0 at (0,0), r1 at (0,-len)
export function capsule(len, r0, r1 = r0, dx = 0) {
  let d = `M ${P([-r0, 0])}`;
  d += arcCmds(0, 0, r0, r0, Math.PI, 0);
  d += ` L ${P([dx + r1, -len])}`;
  d += arcCmds(dx, -len, r1, r1, 0, -Math.PI);
  return d + ' Z';
}
export function rrect(x0, y0, x1, y1, r) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  let d = `M ${P([x0 + r, y0])} L ${P([x1 - r, y0])}`;
  d += arcCmds(x1 - r, y0 + r, r, r, -Math.PI / 2, 0);
  d += ` L ${P([x1, y1 - r])}`;
  d += arcCmds(x1 - r, y1 - r, r, r, 0, Math.PI / 2);
  d += ` L ${P([x0 + r, y1])}`;
  d += arcCmds(x0 + r, y1 - r, r, r, Math.PI / 2, Math.PI);
  d += ` L ${P([x0, y0 + r])}`;
  d += arcCmds(x0 + r, y0 + r, r, r, Math.PI, Math.PI * 1.5);
  return d + ' Z';
}
// a stroke-like closed ribbon along a polyline with per-point half-width (for bands, straps, strands)
export function ribbon(pts, w0, w1 = w0) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = w0 + (w1 - w0) * (i / Math.max(1, n - 1));
    L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]); R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  return smooth(L.concat(R.reverse()).map((p, i, arr) => (i === 0 || i === n - 1 || i === n || i === arr.length - 1 ? [p[0], p[1], 0.4] : p)), true);
}
// transform every coordinate of a path (affine: [a,b,c,d,e,f] -> x' = a x + c y + e, y' = b x + d y + f)
export function xform(d, m) {
  const t = tokenize(d); let out = '';
  for (const s of t) {
    out += (out ? ' ' : '') + s.c;
    for (let i = 0; i < s.v.length; i += 2) { const x = s.v[i], y = s.v[i + 1]; out += ` ${N(m[0] * x + m[2] * y + m[4])} ${N(m[1] * x + m[3] * y + m[5])}`; }
  }
  return out;
}
export const mirrorX = (d) => xform(d, [-1, 0, 0, 1, 0, 0]);
export const shift = (d, dx, dy) => xform(d, [1, 0, 0, 1, dx, dy]);
export const scaleP = (d, sx, sy = sx) => xform(d, [sx, 0, 0, sy, 0, 0]);

function tokenize(d) {
  const re = /([MLCQZ])([^MLCQZ]*)/gi, out = [];
  let m;
  while ((m = re.exec(d))) out.push({ c: m[1].toUpperCase(), v: m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [] });
  return out;
}

// flatten a path to polygons (one per subpath). tol = max deviation in path units.
export function flatten(d, tol = 0.0004) {
  const subs = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0;
  const bez = (x0, y0, x1, y1, x2, y2, x3, y3, depth) => {
    const dx = x3 - x0, dy = y3 - y0, l = Math.hypot(dx, dy) || 1e-9;
    const d1 = Math.abs((x1 - x3) * dy - (y1 - y3) * dx) / l, d2 = Math.abs((x2 - x3) * dy - (y2 - y3) * dx) / l;
    if (depth > 9 || Math.max(d1, d2) < tol) { cur.push([x3, y3]); return; }
    const x01 = (x0 + x1) / 2, y01 = (y0 + y1) / 2, x12 = (x1 + x2) / 2, y12 = (y1 + y2) / 2, x23 = (x2 + x3) / 2, y23 = (y2 + y3) / 2;
    const xa = (x01 + x12) / 2, ya = (y01 + y12) / 2, xb = (x12 + x23) / 2, yb = (y12 + y23) / 2, xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    bez(x0, y0, x01, y01, xa, ya, xm, ym, depth + 1); bez(xm, ym, xb, yb, x23, y23, x3, y3, depth + 1);
  };
  for (const s of tokenize(d)) {
    const v = s.v;
    if (s.c === 'M') { cur = [[v[0], v[1]]]; subs.push(cur); x = sx = v[0]; y = sy = v[1]; for (let i = 2; i < v.length; i += 2) { cur.push([v[i], v[i + 1]]); x = v[i]; y = v[i + 1]; } }
    else if (s.c === 'L') { for (let i = 0; i < v.length; i += 2) { cur.push([v[i], v[i + 1]]); x = v[i]; y = v[i + 1]; } }
    else if (s.c === 'C') { for (let i = 0; i < v.length; i += 6) { bez(x, y, v[i], v[i + 1], v[i + 2], v[i + 3], v[i + 4], v[i + 5], 0); x = v[i + 4]; y = v[i + 5]; } }
    else if (s.c === 'Q') { for (let i = 0; i < v.length; i += 4) { const c1x = x + 2 / 3 * (v[i] - x), c1y = y + 2 / 3 * (v[i + 1] - y), c2x = v[i + 2] + 2 / 3 * (v[i] - v[i + 2]), c2y = v[i + 3] + 2 / 3 * (v[i + 1] - v[i + 3]); bez(x, y, c1x, c1y, c2x, c2y, v[i + 2], v[i + 3], 0); x = v[i + 2]; y = v[i + 3]; } }
    else if (s.c === 'Z') { x = sx; y = sy; }
  }
  // drop duplicate closing points
  return subs.map((p) => {
    const q = [];
    for (const a of p) { const l = q[q.length - 1]; if (!l || Math.hypot(a[0] - l[0], a[1] - l[1]) > 1e-6) q.push(a); }
    if (q.length > 2 && Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) < 1e-6) q.pop();
    return q;
  });
}

export function bboxOf(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
export function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }

// SVG document for a set of drawing elements (used by the bake script; y is flipped for SVG)
export function svgDoc(elems, [x0, y0, x1, y1], pxPerM = 1000) {
  const w = (x1 - x0) * pxPerM, h = (y1 - y0) * pxPerM;
  const body = elems.map((e) => {
    const a = [`d="${e.d}"`];
    a.push(`fill="${e.fill || 'none'}"`);
    if (e.stroke) a.push(`stroke="${e.stroke}" stroke-width="${e.w}" stroke-linecap="${e.cap || 'round'}" stroke-linejoin="${e.join || 'round'}"`);
    if (e.a != null && e.a !== 1) a.push(`opacity="${e.a}"`);
    if (e.dash) a.push(`stroke-dasharray="${e.dash.join(' ')}"`);
    return `<path ${a.join(' ')}/>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}">\n<g transform="matrix(${pxPerM} 0 0 ${-pxPerM} ${-x0 * pxPerM} ${y1 * pxPerM})">\n${body}\n</g>\n</svg>\n`;
}
