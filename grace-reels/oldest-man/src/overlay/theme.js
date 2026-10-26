// Overlay look + layout + shared pure helpers. Everything in px on the 1080x1920 canvas, time in seconds.
import * as THREE from 'three';
import { SERIF, SANS, EMOJI } from '../lib/fonts.js';
import { clamp, hash01, lerp, fbm, noise2 } from '../lib/util.js';
import { plan } from '../lib/planInstance.js';
import { cameraShot } from '../lib/director.js';

export { SERIF, SANS, EMOJI };
export const W = 1080, H = 1920;
export const C = {
  gold: '#f4c766', goldHi: '#ffe6a6', goldDeep: '#c98b26', goldInk: '#9c6416', goldCard: '#a8680f',
  ink: '#2a1a10', inkSoft: '#5a3d24', cream: '#f8eedb', warm: '#fbf3e4', paper: '#f5ead2',
  red: '#a8452c', olive: '#76803c', slate: '#4b6a7a',
};
// Instagram safe zone: text inside x 60–1000, y 220–1560; the right ~120 px between y 1100–1700 is under the IG buttons
export const SAFE = { x0: 60, x1: 1000, y0: 220, y1: 1560, igX: 950, igY0: 1100, igY1: 1700 };
export const L = { headerY: 150, capTop: 250, capBottom: 600, capX: 72, capW: 916, trackY: 640, trackH: 120 };

// ------------------------------------------------------------------ tiny pure animation helpers
export const ease = {
  out: (u) => 1 - (1 - clamp(u)) ** 3,
  out5: (u) => 1 - (1 - clamp(u)) ** 5,
  in: (u) => clamp(u) ** 3,
  inOut: (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; },
  sine: (u) => -(Math.cos(Math.PI * clamp(u)) - 1) / 2,
  back: (u, k = 1.7) => { u = clamp(u); return 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2; },
};
export const win = (t, a, b, fi = 0.18, fo = 0.18) => clamp((t - a) / fi) * clamp((b - t) / fo);
// damped "pop" after an event at t0: 0 before, overshoot, settles to 0
export const pop = (t, t0, amp = 0.2, f = 15, d = 7) => (t < t0 ? 0 : amp * Math.exp(-d * (t - t0)) * Math.cos(f * (t - t0)));
// a landing with weight: anticipation dip before t0, hard arrival, overshoot, settle. Returns { y, s } offsets.
export function land(t, t0, { pre = 0.16, dip = 10, drop = 46, settle = 0.5 } = {}) {
  if (t < t0 - pre) return { y: -drop, s: 0, o: 0 };
  if (t < t0) { const u = (t - (t0 - pre)) / pre; return { y: -drop * (1 - ease.in(u)), s: 0.6 + 0.4 * ease.in(u), o: clamp(u * 2) }; }
  const d = t - t0;
  return { y: dip * Math.exp(-9 * d) * Math.cos(16 * d), s: 1 + 0.18 * Math.exp(-7 * d) * Math.cos(15 * d + 0.4) * (d < settle ? 1 : Math.exp(-(d - settle) * 6)), o: 1 };
}
// deterministic shake
export const shake = (frame, seed, amp) => [(hash01(frame, seed) - 0.5) * 2 * amp, (hash01(frame, seed + 7) - 0.5) * 2 * amp];
export const mixHex = (a, b, k) => {
  const pa = [1, 3, 5].map((j) => parseInt(a.slice(j, j + 2), 16)), pb = [1, 3, 5].map((j) => parseInt(b.slice(j, j + 2), 16));
  return '#' + pa.map((v, j) => Math.round(lerp(v, pb[j], clamp(k))).toString(16).padStart(2, '0')).join('');
};
export const shotById = (id) => plan.shots.find((s) => s.id === id);

// ------------------------------------------------------------------ text measuring + own line layout
// (we lay words out ourselves so each word can pop/glow without reflowing the line, and so bands /
// underlines know the exact text box)
let _ctx = null;
const _mcache = new Map();
export function measure(font, text) {
  const key = font + '|' + text;
  const hit = _mcache.get(key); if (hit !== undefined) return hit;
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = font;
  const w = _ctx.measureText(text).width;
  let ok = false; try { ok = document.fonts.check(font, text); } catch (e) { ok = false; }
  if (ok) _mcache.set(key, w);
  return w;
}
// items: [{ text, font, extra?, glue? }] -> { items:[{x,y,w,line}], lines, lineW:[], width, height }
// glue: keep this item on the same line as the previous one (a gold run never splits across lines)
export function layoutWords(items, { maxW, lineH, align = 'left', space }) {
  const out = []; const lineW = []; let line = 0, x = 0;
  const spOf = (it) => (space ?? measure(it.font, ' '));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const w = measure(it.font, it.text) + (it.extra || 0);
    if (x > 0 && x + spOf(it) + w > maxW) {
      let rs = i; while (rs > 0 && items[rs].glue && out[rs - 1].line === line) rs--;
      if (rs < i && out[rs].x > 0) {               // carry the glued run to the next line
        lineW[line] = out[rs - 1].x + out[rs - 1].w; line++; x = 0;
        for (let j = rs; j < i; j++) { const o = out[j]; o.x = x === 0 ? 0 : x + spOf(o); o.line = line; o.y = line * lineH; x = o.x + o.w; }
        if (x + spOf(it) + w > maxW) { lineW[line] = x; line++; x = 0; }
      } else { lineW[line] = x; line++; x = 0; }
    }
    const xx = x === 0 ? 0 : x + spOf(it);
    out.push({ ...it, x: xx, y: line * lineH, w, line });
    x = xx + w;
  }
  lineW[line] = x;
  if (align !== 'left') out.forEach((o) => { const free = maxW - lineW[o.line]; o.x += align === 'center' ? free / 2 : free; });
  return { items: out, lines: line + 1, lineW, width: Math.max(...lineW), height: (line + 1) * lineH };
}
// display form of a timeline word: typographic quotes and apostrophes
export const pretty = (s) => s.replace(/^"/, '“').replace(/"$/, '”').replace(/"([.,;:!?…]*)$/, '”$1').replace(/'/g, '’');

// ------------------------------------------------------------------ projection of world anchors
const _cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 4000);
const _v = new THREE.Vector3();
export function project(shot, t, p) {
  if (!p) return null;
  const c = cameraShot(plan, shot, t);
  _cam.fov = c.fov; _cam.aspect = W / H; _cam.position.set(...c.pos); _cam.up.set(0, 1, 0); _cam.lookAt(...c.look);
  if (c.roll) _cam.rotateZ(c.roll);
  _cam.updateProjectionMatrix(); _cam.updateMatrixWorld();
  _v.set(p[0], p[1], p[2]).project(_cam);
  const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
  const behind = _v.z > 1 || _v.z < -1;
  return { x, y, z: _v.z, on: !behind && x > 20 && x < W - 20 && y > 20 && y < H - 20 };
}

// ------------------------------------------------------------------ generated textures (deterministic, built once per tab)
let _grain = null;
export function grainURL() {
  if (_grain) return _grain;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = Math.round(hash01(i, 99) * 255); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); _grain = c.toDataURL(); return _grain;
}
// paper fibre texture (grey, for multiply over cream): soft mottling + fine fibres + speckles
const _paper = {};
export function paperURL(w = 512, h = 512, seed = 3) {
  const key = `${w}x${h}:${seed}`; if (_paper[key]) return _paper[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const m = fbm(x / 110, y / 110, 3, seed) * 0.5 + fbm(x / 20, y / 20, 2, seed + 5) * 0.18;
    const n = (hash01(y * w + x, seed + 11) - 0.5) * 0.14;
    const v = clamp(0.95 + m * 0.11 + n * 0.7, 0, 1) * 255;
    img.data[i] = v; img.data[i + 1] = v * 0.985; img.data[i + 2] = v * 0.96; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibres
  g.lineCap = 'round';
  for (let k = 0; k < 520; k++) {
    const x = hash01(k, seed + 1) * w, y = hash01(k, seed + 2) * h, a = hash01(k, seed + 3) * Math.PI * 2, l = 6 + 26 * hash01(k, seed + 4);
    g.strokeStyle = hash01(k, seed + 5) < 0.6 ? `rgba(120,90,50,${0.05 + 0.08 * hash01(k, seed + 6)})` : `rgba(255,255,255,${0.10 + 0.12 * hash01(k, seed + 6)})`;
    g.lineWidth = 0.6 + hash01(k, seed + 7) * 0.8;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (hash01(k, 9) - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (hash01(k, 10) - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // speckles
  for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(90,60,30,${0.12 + 0.25 * hash01(k, seed + 20)})`;
    g.beginPath(); g.arc(hash01(k, seed + 21) * w, hash01(k, seed + 22) * h, 0.5 + 1.1 * hash01(k, seed + 23), 0, Math.PI * 2); g.fill();
  }
  _paper[key] = c.toDataURL('image/jpeg', 0.9); return _paper[key];
}
// a full parchment sheet: warm base, stains, darker burnt edges (colour, 540x960, scaled 2x)
let _parch = null;
export function parchmentURL() {
  if (_parch) return _parch;
  const w = 540, h = 960; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const A = [243, 228, 196], B = [222, 196, 148], D = [150, 104, 56];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const u = x / w, v = y / h;
    const st = fbm(u * 5.5, v * 9, 4, 41) * 0.5 + 0.5;               // large stains
    const fine = fbm(u * 40, v * 70, 2, 43) * 0.5 + 0.5;
    const ex = Math.min(u, 1 - u) * 2, ey = Math.min(v, 1 - v) * 2;   // 0 at edges, 1 centre
    const e = Math.min(ex * 1.4, ey * 2.2) + fbm(u * 8, v * 14, 3, 47) * 0.22;
    const burn = 1 - clamp(e / 0.55);
    const k1 = clamp(st * 0.85 + (fine - 0.5) * 0.25);
    const n = (hash01(i >> 2, 49) - 0.5) * 6;
    for (let ch = 0; ch < 3; ch++) img.data[i + ch] = clamp((lerp(A[ch], B[ch], k1) * (1 - burn * 0.55) + D[ch] * burn * 0.55 + n) / 255) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // faint fibres and a few foxing spots
  for (let k = 0; k < 420; k++) {
    const x = hash01(k, 51) * w, y = hash01(k, 52) * h, a = hash01(k, 53) * Math.PI, l = 4 + 16 * hash01(k, 54);
    g.strokeStyle = `rgba(110,75,35,${0.05 + 0.07 * hash01(k, 55)})`; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let k = 0; k < 18; k++) {
    const x = hash01(k, 61) * w, y = hash01(k, 62) * h, r = 3 + 12 * hash01(k, 63);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(150,95,40,${0.10 + 0.1 * hash01(k, 64)})`); gr.addColorStop(1, 'rgba(150,95,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  _parch = c.toDataURL('image/jpeg', 0.92); return _parch;
}
// irregular (deckled) paper edge as a CSS polygon, in % of the box
export function deckle(seed, n = 26, amp = 0.35) {
  const pts = [];
  const j = (k, s) => (hash01(k, seed + s) - 0.5) * 2 * amp;
  for (let k = 0; k <= n; k++) pts.push(`${(k / n) * 100}% ${clamp(0 + Math.abs(j(k, 1)) * 0.6, 0, 3)}%`);
  for (let k = 0; k <= n; k++) pts.push(`${clamp(100 - Math.abs(j(k, 2)) * 0.35, 97, 100)}% ${(k / n) * 100}%`);
  for (let k = n; k >= 0; k--) pts.push(`${(k / n) * 100}% ${clamp(100 - Math.abs(j(k, 3)) * 0.6, 97, 100)}%`);
  for (let k = n; k >= 0; k--) pts.push(`${clamp(Math.abs(j(k, 4)) * 0.35, 0, 3)}% ${(k / n) * 100}%`);
  return `polygon(${pts.join(',')})`;
}
export { clamp, lerp, hash01, noise2 };
