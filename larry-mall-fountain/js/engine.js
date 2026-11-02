'use strict';
/* ------------------------------------------------------------------
   Core helpers: math, easing, keyframes, isometric projection, shapes.
   Design space is 720x1280; the canvas renders at 1.5x (1080x1920).
------------------------------------------------------------------- */
const W = 720, H = 1280, FPS = 30;
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const TAU = Math.PI * 2;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a));
const E = {
  lin: t => t,
  inQ: t => t * t,
  outQ: t => 1 - (1 - t) * (1 - t),
  ioQ: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inC: t => t * t * t,
  outC: t => 1 - Math.pow(1 - t, 3),
  ioC: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBackS: t => { const c1 = 3.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  ioS: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outS: t => Math.sin(t * Math.PI / 2),
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
};
const tw = (t, t0, t1, a, b, ease = E.ioC) => lerp(a, b, ease(inv(t0, t1, t)));
// keyframes [[time, value(number|array), ease?], ...]
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1, ease] = keys[i];
      const e = (ease || E.ioC)(inv(t0, t1, t));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], e)) : lerp(v0, v1, e);
    }
  }
  return keys[keys.length - 1][1];
}
// 0 -> 1 envelope: fades in over [a, a+fi], out over [b-fo, b]
const win = (t, a, b, fi = 0.2, fo = 0.2) => Math.min(inv(a, a + fi, t), 1 - inv(b - fo, b, t));
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// Natural blinking: returns eyelid closure 0..1
function blinkAt(t, seed = 0) {
  const period = 3.1 + hash(seed) * 1.6;
  const k = Math.floor((t + seed * 1.37) / period);
  const local = (t + seed * 1.37) - k * period;
  const at = 0.4 + hash(k * 7.3 + seed) * (period - 0.9);
  const d = Math.abs(local - at);
  let c = d < 0.075 ? 1 - d / 0.075 : 0;
  // occasional double blink
  if (hash(k * 3.1 + seed * 2) > 0.7) { const d2 = Math.abs(local - at - 0.22); if (d2 < 0.07) c = Math.max(c, 1 - d2 / 0.07); }
  return clamp(c * 1.25);
}

/* ---------------- color helpers ---------------- */
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join(''); }
const shade = (h, t) => mix(h, '#000000', t);
const tint = (h, t) => mix(h, '#ffffff', t);

/* ---------------- shapes ---------------- */
function path(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillPoly(ctx, pts, fill) { path(ctx, pts); ctx.fillStyle = fill; ctx.fill(); }
function rrectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
  rrectPath(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function line(ctx, x1, y1, x2, y2, color, lw, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = cap; ctx.stroke();
}
function glow(ctx, x, y, r, color, a = 1, op = 'lighter') {
  ctx.save(); ctx.globalCompositeOperation = op;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.45, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function shadowBlob(ctx, x, y, rx, ry, a = 0.32) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
  ctx.fillStyle = g; ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2); ctx.restore();
}
function vignette(ctx, strength = 0.65, inner = 0.35, color = '#05070c') {
  const g = ctx.createRadialGradient(W / 2, H * 0.47, H * inner * 0.5, W / 2, H * 0.47, H * 0.78);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/* ---------------- isometric ---------------- */
// world (x right-down, y left-down, z up) -> screen, relative to origin o
const iso = (o, x, y, z = 0) => [o[0] + (x - y) * C30, o[1] + (x + y) * S30 - z];
function isoPoly(ctx, o, pts, fill) { fillPoly(ctx, pts.map(p => iso(o, p[0], p[1], p[2] || 0)), fill); }
// axis-aligned box; draws top, +y face (screen-left/front) and +x face (screen-right/front)
function isoBox(ctx, o, x, y, z, w, d, h, top, left, right) {
  if (left) isoPoly(ctx, o, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left);
  if (right) isoPoly(ctx, o, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right);
  if (top) isoPoly(ctx, o, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top);
}
// set a transform so 2D drawing lands on an iso plane.
// plane 'xz': wall facing +y (text runs down-right).  plane 'yz': wall facing +x (text runs up-right along -y)
function isoPlane(ctx, o, plane, x, y, z) {
  const [px, py] = iso(o, x, y, z);
  if (plane === 'xz') ctx.transform(C30, S30, 0, 1, px, py);
  else if (plane === 'yz') ctx.transform(C30, -S30, 0, 1, px, py);
  else if (plane === 'xy') ctx.transform(C30, S30, -C30, S30, px, py); // floor
}
// isometric ellipse (circle lying on the floor plane at height z)
function isoCircle(ctx, o, cx, cy, z, r, fill, stroke, lw) {
  const [x, y] = iso(o, cx, cy, z);
  ctx.beginPath(); ctx.ellipse(x, y, r * C30 * Math.SQRT2, r * S30 * Math.SQRT2, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// vertical cylinder side (the front half), for fountains, lamps, etc.
function isoCylinder(ctx, o, cx, cy, z, r, h, side, top) {
  const [x, y] = iso(o, cx, cy, z);
  const rx = r * C30 * Math.SQRT2, ry = r * S30 * Math.SQRT2;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI); ctx.lineTo(x - rx, y - h); ctx.ellipse(x, y - h, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
  ctx.fillStyle = side; ctx.fill();
  if (top) { ctx.beginPath(); ctx.ellipse(x, y - h, rx, ry, 0, 0, TAU); ctx.fillStyle = top; ctx.fill(); }
}

/* ---------------- text ---------------- */
function text(ctx, s, x, y, font, color, align = 'left', base = 'alphabetic') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
}
function outlinedText(ctx, s, x, y, font, fill, stroke, lw, align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y);
}

/* ---------------- running gag: smell cloud ---------------- */
// x,y = base of the cloud, s = scale, t = time, a = alpha
function stinkCloud(ctx, x, y, s, t, a = 1, seed = 0) {
  if (a <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
  // puffs rising and wobbling
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.55 + i / 6 + seed * 0.13) % 1;
    const px = Math.sin(t * 1.7 + i * 2.1 + seed) * 10 + (i % 2 ? 9 : -9) * (1 - ph);
    const py = -ph * 70;
    const r = 13 + ph * 15 + Math.sin(t * 3 + i) * 1.5;
    const al = Math.sin(ph * Math.PI) * 0.85;
    circle(ctx, px, py, r, `rgba(122,196,76,${0.55 * al})`);
    circle(ctx, px - r * 0.25, py - r * 0.3, r * 0.55, `rgba(176,232,120,${0.35 * al})`);
  }
  // wavy stink lines
  ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  for (let k = -1; k <= 1; k++) {
    const ph = (t * 0.7 + (k + 1) * 0.33 + seed * 0.21) % 1;
    const al = Math.sin(ph * Math.PI);
    ctx.strokeStyle = `rgba(150,214,92,${0.9 * al})`;
    ctx.beginPath();
    for (let j = 0; j <= 12; j++) {
      const yy = -30 - ph * 60 - j * 3.2;
      const xx = k * 20 + Math.sin(j * 0.9 + t * 6 + k) * 5;
      if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  // a couple of buzzing flies
  for (let f = 0; f < 2; f++) {
    const ang = t * (4.2 + f) + f * 3 + seed;
    const fx = Math.cos(ang) * (22 + f * 8), fy = -55 + Math.sin(ang * 1.7) * 14 - f * 10;
    circle(ctx, fx, fy, 2.3, 'rgba(25,25,25,0.9)');
    ellipse(ctx, fx - 2, fy - 2.5, 2.4, 1.3, 'rgba(255,255,255,0.55)', -0.5 + Math.sin(t * 60) * 0.4);
    ellipse(ctx, fx + 2, fy - 2.5, 2.4, 1.3, 'rgba(255,255,255,0.55)', 0.5 - Math.sin(t * 60) * 0.4);
  }
  ctx.restore();
}

// teardrop (sweat / tears). x,y = tip top; s = size
function drop(ctx, x, y, s, fill = '#bfe7ff', a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 0.55, s * 0.75, s * 0.75, s * 1.15, 0, s * 1.45);
  ctx.bezierCurveTo(-s * 0.75, s * 1.15, -s * 0.55, s * 0.75, 0, 0); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(40,110,170,0.55)'; ctx.lineWidth = Math.max(0.8, s * 0.09); ctx.stroke();
  ellipse(ctx, -s * 0.18, s * 0.95, s * 0.12, s * 0.2, 'rgba(255,255,255,0.9)', 0.3);
  ctx.restore();
}
