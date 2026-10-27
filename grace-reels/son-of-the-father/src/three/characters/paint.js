// Colour + drawing-element helpers for the SVG part library.
import { xform } from './svg.js';

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
export function rgb(hex) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export function hex([r, g, b]) { return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join(''); }
export const shade = (h, k) => hex(rgb(h).map((v) => v * k));
export const mixc = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
// line work: darker and a little warmer than the fill (never the outline black)
export const ink = (h, k = 0.6) => { const [r, g, b] = rgb(h); return hex([r * k + 10, g * k * 0.93, b * k * 0.86]); };
export const lift = (h, k = 0.25) => mixc(h, '#fff6e6', k);
export const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// drawing elements (canvas + svg): fill / stroke
export const F = (d, fill, x = {}) => ({ d, fill, ...x });
export const L = (d, stroke, w, x = {}) => ({ d, stroke, w, ...x });

// scale/translate a whole part spec (shape, holes, draw paths, stroke widths, blur)
export function xpart(p, s = 1, dx = 0, dy = 0, sy = s) {
  if (s === 1 && sy === 1 && !dx && !dy) return p;
  const m = [s, 0, 0, sy, dx, dy], k = Math.sqrt(Math.abs(s * sy));
  const q = { ...p, shape: xform(p.shape, m) };
  if (p.holes) q.holes = p.holes.map((d) => xform(d, m));
  if (p.draw) q.draw = p.draw.map((e) => ({ ...e, d: xform(e.d, m), ...(e.w ? { w: e.w * k } : {}), ...(e.blur ? { blur: e.blur * k } : {}), ...(e.dash ? { dash: e.dash.map((v) => v * k) } : {}) }));
  if (p.shapeFrom) q.shapeFrom = { ...p.shapeFrom, dx: (p.shapeFrom.dx || 0) * s, dy: (p.shapeFrom.dy || 0) * sy };
  if (p.anchors) { q.anchors = {}; for (const [a, v] of Object.entries(p.anchors)) q.anchors[a] = [v[0] * s + dx, v[1] * sy + dy]; }
  return q;
}
