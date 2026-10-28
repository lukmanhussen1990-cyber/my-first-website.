// Small 2D geometry helpers for the SVG character rig.
export type P = [number, number];
export const D2R = Math.PI / 180;

/** Unit vector for a limb hanging at `deg` from straight down (positive = forward / +x). */
export const down = (deg: number): P => [Math.sin(deg * D2R), Math.cos(deg * D2R)];
export const addv = (p: P, v: P, l = 1): P => [p[0] + v[0] * l, p[1] + v[1] * l];
export const rot = (p: P, deg: number, o: P = [0, 0]): P => {
  const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  const x = p[0] - o[0], y = p[1] - o[1];
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
};
export const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Closed smooth path through points (Catmull-Rom → cubic Bézier). */
export const smoothClosed = (pts: P[], k = 1) => {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
};
/** Open smooth path through points. */
export const smoothOpen = (pts: P[], k = 1) => {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
};
export const poly = (pts: P[]) => 'M' + pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' L') + 'Z';

/** Tapered capsule between two points (limbs). */
export const capsule = (a: P, b: P, ra: number, rb: number) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const a1: P = [a[0] + nx * ra, a[1] + ny * ra], a2: P = [a[0] - nx * ra, a[1] - ny * ra];
  const b1: P = [b[0] + nx * rb, b[1] + ny * rb], b2: P = [b[0] - nx * rb, b[1] - ny * rb];
  return `M${f(a1[0])},${f(a1[1])} L${f(b1[0])},${f(b1[1])} A${f(rb)},${f(rb)} 0 0 0 ${f(b2[0])},${f(b2[1])} L${f(a2[0])},${f(a2[1])} A${f(ra)},${f(ra)} 0 0 0 ${f(a1[0])},${f(a1[1])}Z`;
};
/** Transform a list of local points by rotation (deg) around origin then translate. */
export const tf = (pts: P[], deg: number, at: P, sx = 1): P[] => pts.map((p) => addv(rot([p[0] * sx, p[1]], deg), at as P));
