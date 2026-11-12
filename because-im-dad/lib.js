// lib.js — tiny SVG toolkit, easing, timing helpers and screen effects.
'use strict';

const W = 720, H = 720;          // full square frame
const PIC_Y = 120, PIC_H = 480;  // picture area between the black bars
const FPS = 24, BPM = 128, BEAT = 60 / BPM; // matches the original song: 128 BPM, 0.469 s per beat
const OUT = '#2a2331';           // outline ink
const DEG = Math.PI / 180;

/* ---------- math + easing ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (t, a, b) => clamp((t - a) / (b - a));
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - t, 3);
const ei = t => t * t * t;
const sine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const back = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const pop = t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 9));
const lin = t => t;
// keyframes: [[time, value, easeIntoThisKey?], ...]
function kf(t, keys, ease = eio) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1, e] = keys[i];
      return lerp(v0, v1, (e || ease)((t - t0) / (t1 - t0 || 1)));
    }
  }
  return keys[keys.length - 1][1];
}
const n2 = v => Math.round(v * 100) / 100;
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wob = (t, f = 1, ph = 0) => Math.sin(t * f * Math.PI * 2 + ph);
// smooth "handheld" drift
const drift = (t, amp = 1, seed = 0) => amp * (Math.sin(t * 0.9 + seed) * 0.6 + Math.sin(t * 1.7 + seed * 2.3) * 0.4);

/* ---------- per-frame defs (gradients etc.) ---------- */
let DEFS = [], UID = 0;
function resetDefs() { DEFS = []; UID = 0; }
function uid(p = 'u') { return `${p}${++UID}`; }
function lg(x1, y1, x2, y2, stops, units = 'objectBoundingBox') {
  const id = uid('lg');
  DEFS.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="${units}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
}
function rg(stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy) {
  const id = uid('rg');
  DEFS.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx !== undefined ? ` fx="${fx}" fy="${fy}"` : ''}>${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('')}</radialGradient>`);
  return `url(#${id})`;
}
function clip(inner) { const id = uid('cp'); DEFS.push(`<clipPath id="${id}">${inner}</clipPath>`); return `clip-path="url(#${id})"`; }
function blurF(sd, sdy) { const id = uid('bl'); DEFS.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}${sdy !== undefined ? ' ' + sdy : ''}"/></filter>`); return `filter="url(#${id})"`; }

/* ---------- primitives ---------- */
const stk = sw => (sw ? ` stroke="${OUT}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : '');
const P = (d, fill = 'none', sw = 3, x = '') => `<path d="${d}" fill="${fill}"${stk(sw)} ${x}/>`;
const PS = (d, color, w, x = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
const C = (cx, cy, r, fill, sw = 3, x = '') => `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(Math.max(0, r))}" fill="${fill}"${stk(sw)} ${x}/>`;
const E = (cx, cy, rx, ry, fill, sw = 3, x = '') => `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(Math.max(0, rx))}" ry="${n2(Math.max(0, ry))}" fill="${fill}"${stk(sw)} ${x}/>`;
const R = (x0, y0, w, h, rx, fill, sw = 3, x = '') => `<rect x="${n2(x0)}" y="${n2(y0)}" width="${n2(Math.max(0, w))}" height="${n2(Math.max(0, h))}" rx="${rx}" fill="${fill}"${stk(sw)} ${x}/>`;
const G = (tr, inner, x = '') => `<g${tr ? ` transform="${tr}"` : ''} ${x}>${inner}</g>`;
const T = (x = 0, y = 0, r = 0, s = 1, sy) =>
  `translate(${n2(x)},${n2(y)})${r ? ` rotate(${n2(r)})` : ''}${s !== 1 || sy !== undefined ? ` scale(${n2(s)}${sy !== undefined ? ',' + n2(sy) : ''})` : ''}`;
const op = (o, inner) => (o >= 0.999 ? inner : o <= 0.001 ? '' : `<g opacity="${n2(o)}">${inner}</g>`);
const blend = (mode, inner) => `<g style="mix-blend-mode:${mode}">${inner}</g>`;
function TX(x, y, str, size, fill, o = {}) {
  const fam = o.font || "Inter, 'Liberation Sans', sans-serif";
  return `<text x="${n2(x)}" y="${n2(y)}" font-family="${fam}" font-size="${size}" font-weight="${o.weight || 700}" fill="${fill}" text-anchor="${o.anchor || 'middle'}" dominant-baseline="${o.base || 'central'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 3}" paint-order="stroke" stroke-linejoin="round"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${n2(x)} ${n2(y)})"` : ''} ${o.x || ''}>${str}</text>`;
}
const HAND = "'Patrick Hand', 'Comic Sans MS', cursive";
// points -> smooth closed path (Catmull-Rom)
function smooth(pts, closed = true, tension = 0.5) {
  const n = pts.length; let d = `M${n2(pts[0][0])},${n2(pts[0][1])}`;
  const get = i => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += ` C${n2(c1[0])},${n2(c1[1])} ${n2(c2[0])},${n2(c2[1])} ${n2(p2[0])},${n2(p2[1])}`;
  }
  return d + (closed ? ' Z' : '');
}

/* ---------- screen effects (picture space 720x480) ---------- */
function vignette(o = 0.55, col = '#0b0814') {
  return `<rect x="-40" y="-40" width="800" height="560" fill="${rg([[0.45, col, 0], [1, col, o]], 0.5, 0.5, 0.75)}"/>`;
}
function tint(col, o, mode = 'multiply') {
  return blend(mode, `<rect x="-40" y="-40" width="800" height="560" fill="${col}" opacity="${n2(o)}"/>`);
}
function glow(cx, cy, r, col, o = 0.8, mode = 'screen') {
  return blend(mode, `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${rg([[0, col, o], [0.45, col, o * 0.45], [1, col, 0]])}"/>`);
}
function ray(x1, y1, x2a, x2b, y2, col, o) { // light cone/wedge
  return blend('screen', `<path d="M${x1 - 6},${y1} L${x1 + 6},${y1} L${x2b},${y2} L${x2a},${y2} Z" fill="${lg(0, 0, 0, 1, [[0, col, o], [1, col, 0]])}"/>`);
}
function star4(x, y, r, col = '#fff', o = 1, rot = 0) {
  const k = r * 0.22;
  return `<path transform="translate(${n2(x)},${n2(y)}) rotate(${n2(rot)})" d="M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r} Z" fill="${col}" opacity="${n2(o)}"/>`;
}
function sparkles(t, x, y, w, h, n, seed = 1, col = '#fff', size = 10) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, ph = r(), sp = 0.8 + r() * 1.2;
    const k = Math.max(0, Math.sin((t * sp + ph) * Math.PI * 2));
    s += star4(px, py, size * (0.4 + 0.6 * k) * (0.6 + r() * 0.6), col, k, 0);
  }
  return s;
}
function rain(t, o = {}) {
  const r = rng(o.seed || 7), n = o.n || 110, ang = o.ang || 12, sp = o.speed || 900, len = o.len || 26;
  let d = '';
  for (let i = 0; i < n; i++) {
    const x0 = r() * 860 - 70, y0 = r() * 600, v = sp * (0.8 + r() * 0.4);
    const y = ((y0 + t * v) % 600) - 60, x = x0 + y * Math.tan(ang * DEG);
    const dx = len * Math.sin(ang * DEG), dy = len * Math.cos(ang * DEG);
    d += `M${n2(x)},${n2(y)} l${n2(dx)},${n2(dy)} `;
  }
  return `<path d="${d}" stroke="${o.col || '#cfe0ff'}" stroke-width="${o.w || 1.6}" stroke-linecap="round" opacity="${o.op || 0.55}"/>`;
}
function bokeh(t, n, seed, cols, o = 0.25, rmin = 10, rmax = 30) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 720, y = r() * 480, rad = rmin + r() * (rmax - rmin), c = cols[i % cols.length];
    const dx = Math.sin(t * 0.4 + i) * 6;
    s += `<circle cx="${n2(x + dx)}" cy="${n2(y)}" r="${n2(rad)}" fill="${c}" opacity="${n2(o * (0.5 + r() * 0.5))}"/>`;
  }
  return blend('screen', s);
}
// little falling sweat drop
function drop(x, y, s = 1, col = '#bfe6ff') {
  return `<path transform="translate(${n2(x)},${n2(y)}) scale(${n2(s)})" d="M0,-9 C4,-3 6,1 6,4 A6,6 0 0 1 -6,4 C-6,1 -4,-3 0,-9 Z" fill="${col}" stroke="${OUT}" stroke-width="1.6"/>`;
}

/* ---------- name tag ---------- */
function label(x, y, txt, s = 1, o = 1) {
  const w = (txt.length * 7.6 + 16) * s, h = 19 * s;
  return op(o, `<g transform="translate(${n2(x)},${n2(y)})"><rect x="${n2(-w / 2)}" y="${n2(-h / 2)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(4 * s)}" fill="#3a3646" fill-opacity="0.55"/>${TX(0, 0.5 * s, txt, n2(12.5 * s), '#fff', { weight: 700 })}</g>`);
}

/* ---------- camera ---------- */
// cam = {x, y, z, r}: point (x,y) of the 720x480 scene lands in the picture center
function camWrap(inner, cam) {
  const z = cam.z || 1, r = cam.r || 0;
  return `<g transform="translate(360,240) rotate(${n2(r)}) scale(${n2(z)}) translate(${n2(-cam.x)},${n2(-cam.y)})">${inner}</g>`;
}
function shake(t, amp, freq = 22, seed = 3) {
  return [amp * Math.sin(t * freq + seed), amp * Math.sin(t * freq * 1.31 + seed * 2)];
}
