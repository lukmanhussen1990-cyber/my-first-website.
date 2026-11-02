// Pixel textures for the mansion reel sets (canvas, deterministic, NearestFilter via lib.tex).
import { paint, canvas, rng, noise2, hexToRgb, clamp } from './lib.js';

const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// red-brown bricks with mortar lines (64 x 64 = 4 x 8 bricks)
export function brickCanvas(base = '#9a4a34', mortar = '#b9a58c', seed = 3) {
  const R = rng(seed), N = noise2(64, 64, 8, seed + 1);
  const b = hexToRgb(base), m = hexToRgb(mortar);
  const tint = Array.from({ length: 64 }, () => (R() - 0.5) * 34);
  return paint(64, 64, (x, y) => {
    const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, col = Math.floor((x + off) / 16);
    if (y % 8 === 7 || (x + off) % 16 === 15) return add(m, (N[y * 64 + x] - 0.5) * 16);
    const d = tint[(row * 5 + col) % 64] + (N[y * 64 + x] - 0.5) * 22 + (R() - 0.5) * 10;
    return add(b, d);
  });
}
// painted stucco / plaster
export function plasterCanvas(base, seed = 5, amount = 14) {
  const N = noise2(64, 64, 10, seed), R = rng(seed + 7), b = hexToRgb(base);
  return paint(64, 64, (x, y) => add(b, (N[y * 64 + x] - 0.5) * amount * 1.6 + (R() - 0.5) * amount * 0.5));
}
// concrete sidewalk slabs (1 tile = 1 slab)
export function slabCanvas(base = '#a7a39b', seed = 9) {
  const N = noise2(32, 32, 6, seed), R = rng(seed + 3), b = hexToRgb(base);
  return paint(32, 32, (x, y) => {
    if (x === 0 || y === 0) return add(b, -34);
    let c = add(b, (N[y * 32 + x] - 0.5) * 18 + (R() - 0.5) * 10);
    if ((x * 7 + y * 13) % 97 === 0) c = add(c, -40);                         // gum / stains
    return c;
  });
}
// asphalt
export function asphaltCanvas(seed = 11) {
  const N = noise2(64, 64, 5, seed), R = rng(seed + 3);
  return paint(64, 64, (x, y) => { const v = 58 + (N[y * 64 + x] - 0.5) * 18 + (R() - 0.5) * 14; return [v, v, v + 3]; });
}
// shop window: dark glass with a warm interior glow, frame lines and a diagonal reflection
export function windowCanvas(o = {}) {
  const W = 64, H = 64, R = rng(o.seed || 1), N = noise2(W, H, 8, (o.seed || 1) + 5);
  const inside = hexToRgb(o.inside || '#5a3a24'), frame = hexToRgb(o.frame || '#2a2622');
  return paint(W, H, (x, y) => {
    if (x < 3 || x > W - 4 || y < 3 || y > H - 4) return add(frame, (R() - 0.5) * 8);
    if (o.mullion && (Math.abs(x - W / 2) < 2 || Math.abs(y - H * 0.45) < 2)) return add(frame, (R() - 0.5) * 8);
    let c = mix(inside, [255, 214, 150], clamp((1 - y / H) * 0.25 + N[y * 64 + x] * 0.25));
    if (o.shelves && y % 14 < 2) c = add(c, -40);
    if (o.shelves && y % 14 >= 2 && y % 14 < 9 && (x * 3 + Math.floor(y / 14) * 7) % 11 < 6) c = mix(c, hexToRgb(['#d2462a', '#e8c040', '#3a8ad0', '#5ab040'][(x + y) % 4]), 0.6);
    const refl = (x + y * 0.6) % 46;
    if (refl > 6 && refl < 12) c = mix(c, [235, 240, 250], 0.32);
    return c;
  });
}
// striped awning
export function awningCanvas(c1, c2, seed = 2) {
  const a = hexToRgb(c1), b = hexToRgb(c2), R = rng(seed);
  return paint(32, 16, (x, y) => add((Math.floor(x / 4) % 2 ? a : b), (R() - 0.5) * 10 + (y > 12 ? -14 : 0)));
}
// metal roll shutter
export function shutterCanvas(seed = 4) {
  const R = rng(seed);
  return paint(32, 32, (x, y) => { const v = 120 + (y % 3 === 0 ? -26 : 6) + (R() - 0.5) * 12; return [v, v + 2, v + 6]; });
}
// cardboard (flattened box)
export function cardboardFlatCanvas(seed = 6) {
  const N = noise2(32, 32, 6, seed), R = rng(seed + 1);
  return paint(32, 32, (x, y) => {
    let c = [176 + (N[y * 32 + x] - 0.5) * 26 + (R() - 0.5) * 10, 134 + (N[y * 32 + x] - 0.5) * 20, 84];
    if (Math.abs(x - 16) < 1) c = add(c, -30);                                  // fold
    if ((x - 22) ** 2 / 20 + (y - 9) ** 2 / 9 < 1) c = add(c, -26);            // stain
    return c;
  });
}
// a sign with text drawn in Pixelify Sans (falls back to sans-serif)
export function signCanvas(lines, o = {}) {
  const W = o.w || 256, H = o.h || 128;
  const c = canvas(W, H), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = o.bg || '#f4f1e8'; g.fillRect(0, 0, W, H);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = o.borderW || 8; g.strokeRect(4, 4, W - 8, H - 8); }
  g.fillStyle = o.color || '#c4161c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length, lh = (H - 24) / n;
  lines.forEach((ln, i) => {
    let size = Math.floor(lh * (o.scale || 0.82));
    g.font = `700 ${size}px "Pixelify Sans", sans-serif`;
    while (g.measureText(ln).width > W - 26 && size > 8) { size -= 2; g.font = `700 ${size}px "Pixelify Sans", sans-serif`; }
    g.fillText(ln, W / 2, 12 + lh * (i + 0.5) + 2);
  });
  if (o.icon === 'noToilet') {               // small toilet pictogram with a red no-sign (top-left corner)
    const x = 26, y = 26;
    g.fillStyle = '#2a2a2a'; g.fillRect(x - 6, y - 10, 10, 8); g.fillRect(x - 8, y - 2, 16, 6); g.fillRect(x - 4, y + 4, 8, 6);
    g.strokeStyle = '#c4161c'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - 10, y - 10); g.lineTo(x + 10, y + 10); g.stroke();
  }
  return c;
}
// white marble with soft grey/gold veins
export function marbleCanvas(o = {}) {
  const S = o.size || 64, R = rng(o.seed || 7), N = noise2(S, S, 12, (o.seed || 7) + 3), N2 = noise2(S, S, 5, (o.seed || 7) + 9);
  const base = hexToRgb(o.base || '#ece6dc'), vein = hexToRgb(o.vein || '#a89c8c'), gold = hexToRgb(o.gold || '#c9a040');
  return paint(S, S, (x, y) => {
    const v = Math.abs(Math.sin((x * 0.09 + y * 0.05 + N[y * S + x] * 3.2) * Math.PI));
    let c = add(base, (N2[y * S + x] - 0.5) * 12 + (R() - 0.5) * 6);
    if (v < 0.07) c = mix(c, o.goldVeins ? gold : vein, 0.75);
    else if (v < 0.16) c = mix(c, vein, 0.25);
    if (o.grout && (x === 0 || y === 0)) c = o.goldGrout ? gold : add(base, -40);
    return c;
  });
}
// gold: warm yellow with dark/bright pixel noise (used with metalness + env map)
export function goldCanvas(o = {}) {
  const S = o.size || 32, R = rng(o.seed || 13), N = noise2(S, S, 6, (o.seed || 13) + 1);
  const b = hexToRgb(o.base || '#e8b440');
  return paint(S, S, (x, y) => add(b, (N[y * S + x] - 0.5) * (o.amount || 30) + (R() - 0.5) * 12));
}
// gold wall panel (wainscot): raised panel with bevel lines
export function goldPanelCanvas(seed = 21) {
  const R = rng(seed), N = noise2(64, 64, 8, seed + 2);
  const b = [214, 166, 62];
  return paint(64, 64, (x, y) => {
    let c = add(b, (N[y * 64 + x] - 0.5) * 26 + (R() - 0.5) * 8);
    const inX = x > 7 && x < 56, inY = y > 7 && y < 56;
    if (inX && inY && (x === 8 || y === 8)) c = add(c, 46);
    if (inX && inY && (x === 55 || y === 55)) c = add(c, -50);
    if (x < 3 || y < 3 || x > 60 || y > 60) c = add(c, -28);
    return c;
  });
}
// red carpet with gold border pattern (u across, v along)
export function carpetCanvas(seed = 23) {
  const R = rng(seed), N = noise2(32, 64, 6, seed + 1);
  return paint(32, 64, (x, y) => {
    let c = [150 + (N[y * 32 + x] - 0.5) * 24 + (R() - 0.5) * 10, 22, 30];
    if (x < 3 || x > 28) c = [214, 168, 64];
    if ((x === 4 || x === 27) && y % 4 < 2) c = [214, 168, 64];
    if (Math.abs(x - 16) + Math.abs((y % 16) - 8) === 5) c = [196, 150, 54];   // diamond pattern
    return c;
  });
}
// portrait painting (the rich guy, pixel art) in a dark background
export function portraitCanvas(variant = 0) {
  const c = canvas(48, 64), g = c.getContext('2d');
  const bgs = ['#2a3a2a', '#3a2a2a', '#2a2a3a', '#3a3424'];
  g.fillStyle = bgs[variant % 4]; g.fillRect(0, 0, 48, 64);
  const R = rng(variant + 31);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,220,160,${0.04 + R() * 0.05})`; g.fillRect(Math.floor(R() * 48), Math.floor(R() * 64), 3, 3); }
  g.fillStyle = '#e8b832'; g.fillRect(8, 44, 32, 20);                      // gold robe shoulders
  g.fillStyle = '#c08a24'; g.fillRect(20, 44, 8, 20);
  g.fillStyle = '#e0a982'; g.fillRect(16, 18, 16, 22); g.fillRect(21, 40, 6, 5); // face + neck
  g.fillStyle = '#1e1612'; g.fillRect(15, 14, 18, 6); g.fillRect(14, 18, 3, 6); g.fillRect(31, 18, 3, 6); // hair
  g.fillStyle = '#120c0a'; g.fillRect(19, 25, 3, 3); g.fillRect(26, 25, 3, 3);   // eyes
  g.fillStyle = '#1e1612'; g.fillRect(18, 32, 12, 2); g.fillRect(16, 30, 2, 3); g.fillRect(30, 30, 2, 3); // moustache
  if (variant % 2) { g.fillStyle = '#7a1a1a'; g.fillRect(4, 4, 6, 6); }
  return c;
}
// skyscraper facade: window grid; lit = fraction of warm lit windows
export function towerCanvas(o = {}) {
  const W = 32, H = 64, R = rng(o.seed || 1);
  const wall = hexToRgb(o.wall || '#8a8a92'), glass = hexToRgb(o.glass || '#3a4a62');
  const lit = o.lit ?? 0.25;
  const litMap = Array.from({ length: 256 }, () => R() < lit);
  return paint(W, H, (x, y) => {
    const cx = x % 4, cy = y % 4;
    if (cx === 0 || cy === 0) return add(wall, (R() - 0.5) * 10);
    const k = (Math.floor(x / 4) + Math.floor(y / 4) * 8) % 256;
    if (litMap[k]) return add(mix(wall, [255, 206, 128], 0.55), (R() - 0.5) * 16);
    return add(mix(wall, glass, 0.55), (R() - 0.5) * 12 + (y / H) * 14);
  });
}
// pool water (blue, ripples)
export function poolCanvas(seed = 41) {
  const N = noise2(64, 64, 6, seed), R = rng(seed + 1);
  return paint(64, 64, (x, y) => {
    const n = N[y * 64 + x];
    let c = [40 + n * 30, 140 + n * 40, 190 + n * 30];
    if (n > 0.68 && (x + y) % 3) c = [200, 240, 255];
    return add(c, (R() - 0.5) * 8);
  });
}
// grey stone / rock
export function stoneCanvas(base = '#8d8a84', seed = 43) {
  const N = noise2(32, 32, 5, seed), R = rng(seed + 2), b = hexToRgb(base);
  return paint(32, 32, (x, y) => add(b, (N[y * 32 + x] - 0.5) * 40 + (R() - 0.5) * 14));
}
// lawn grass (stripes like a mowed lawn)
export function lawnCanvas(seed = 47) {
  const N = noise2(64, 64, 6, seed), R = rng(seed + 1);
  return paint(64, 64, (x, y) => {
    const stripe = Math.floor(x / 16) % 2 ? 8 : -6;
    return [70 + stripe + (N[y * 64 + x] - 0.5) * 22 + (R() - 0.5) * 12, 132 + stripe + (N[y * 64 + x] - 0.5) * 26, 48 + (R() - 0.5) * 10];
  });
}
// leafy hedge / tree foliage
export function leafyCanvas(base = '#3f7a32', seed = 51) {
  const N = noise2(32, 32, 4, seed), R = rng(seed + 1), b = hexToRgb(base);
  return paint(32, 32, (x, y) => { const n = N[y * 32 + x]; return add(b, (n - 0.5) * 50 + (R() < 0.12 ? 26 : 0) + (R() - 0.5) * 10); });
}
// wooden door panels (white painted, gold trim)
export function doorCanvas(o = {}) {
  const b = hexToRgb(o.base || '#f2eee6'), trim = hexToRgb(o.trim || '#d0a040'), R = rng(o.seed || 61);
  return paint(32, 64, (x, y) => {
    let c = add(b, (R() - 0.5) * 8);
    const p1 = x > 4 && x < 27 && y > 5 && y < 28, p2 = x > 4 && x < 27 && y > 33 && y < 59;
    if ((p1 || p2) && (x === 5 || x === 26 || y === 6 || y === 27 || y === 34 || y === 58)) c = trim;
    if (x < 2 || x > 29 || y < 2 || y > 61) c = add(trim, -20);
    return c;
  });
}
export function glowDiscCanvas(S = 64, inner = 0.0) {
  const c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, S * inner, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return c;
}
