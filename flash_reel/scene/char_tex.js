// Textures for characters.js only: pixel-noisy clothing fabrics + cached canvas face textures.
// Deterministic (rng/hash only). Canvases are tiny and sampled with NearestFilter (PS1 look).
import * as THREE from 'three';
import { paint, tex, rng, hexToRgb, clamp, noise2, canvas } from './lib.js';

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const addc = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const css = (c) => `rgb(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))})`;

// ------------------------------------------------------------------ fabrics (return [r,g,b] for pixel x,y)
// Each fabric is a function f(x, y) -> rgb so torso painters can compose them with details.
// Mansion reel: smooth, clean mannequin look (like the reference) -> fabric noise is softened (plaid keeps its checks)
const SMOOTH = 0.4;
export function fabric(kind, o = {}) {
  const f = fabricRaw(kind, o);
  if (kind === 'plaid') return f;
  const base = hexToRgb(o.color || '#888888');
  return (x, y) => { const c = f(x, y); return [base[0] + (c[0] - base[0]) * SMOOTH, base[1] + (c[1] - base[1]) * SMOOTH, base[2] + (c[2] - base[2]) * SMOOTH]; };
}
function fabricRaw(kind, o = {}) {
  const R = rng(o.seed ?? 5);
  const N = noise2(64, 64, 6, (o.seed ?? 5) + 17);
  const base = hexToRgb(o.color || '#888888');
  const jit = () => (R() - 0.5);
  switch (kind) {
    case 'knit': // stockinette "V" columns + row lines
      return (x, y) => {
        const cx = x % 4, row = (y + (Math.floor(x / 4) & 1)) % 3;
        let d = (cx === 0 || cx === 3) ? -11 : 7;
        if (row === 0) d -= 6;
        d += (N[(y & 63) * 64 + (x & 63)] - 0.5) * 14 + jit() * 8;
        return addc(base, d);
      };
    case 'rib': // vertical ribbing (cuffs / hems)
      return (x, y) => addc(base, ((x % 3) === 0 ? -14 : 4) + jit() * 6);
    case 'fleece': // hoodie / quarter-zip: soft mottled
      return (x, y) => addc(base, (N[(y & 63) * 64 + (x & 63)] - 0.5) * 18 + jit() * 9);
    case 'denim': {
      return (x, y) => {
        const tw = ((x + y) % 4) < 2 ? 9 : -6;
        const fade = (N[(y & 63) * 64 + (x & 63)] - 0.5) * 22;
        return [base[0] + tw + fade * 0.8 + jit() * 6, base[1] + tw + fade + jit() * 6, base[2] + tw * 1.2 + fade + jit() * 6];
      };
    }
    case 'plaid': { // buffalo check: o.color + o.color2 (dark)
      const dark = hexToRgb(o.color2 || '#1a1414'), per = o.period || 12;
      return (x, y) => {
        const bx = (x % per) < per / 2, by = (y % per) < per / 2;
        let c = bx && by ? dark : (bx || by) ? mixc(base, dark, 0.5) : base;
        const tw = ((x + y) & 1) ? 6 : -4;
        return addc(c, tw + jit() * 8);
      };
    }
    case 'jersey': // athletic mesh dots
      return (x, y) => addc(base, ((x % 3 === 0) && (y % 3 === 0) ? 16 : 0) + (N[(y & 63) * 64 + (x & 63)] - 0.5) * 10 + jit() * 6);
    case 'cotton':
    default:
      return (x, y) => addc(base, (N[(y & 63) * 64 + (x & 63)] - 0.5) * (o.amount ?? 12) + jit() * (o.amount ?? 12) * 0.5);
  }
}

export function fabricTex(kind, o = {}, size = 32, repeat = [1, 1]) {
  const f = fabric(kind, o);
  return tex(paint(size, size, f), { repeat });
}

// Upper-arm texture for short sleeves: v < split is sleeve fabric (shoulder end), above is skin.
export function sleeveSplitTex(kind, o, skinHex, split = 0.45, band = null) {
  const f = fabric(kind, o), s = fabric('cotton', { color: skinHex, amount: 6, seed: 3 });
  const bandC = band ? hexToRgb(band) : null;
  const W = 32, H = 32;
  return tex(paint(W, H, (x, y) => {
    const v = 1 - (y + 0.5) / H; // v up
    if (v < split) {
      if (bandC && v > split - 0.12 && v < split - 0.05) return addc(bandC, ((x + y) & 1) * 5);
      return f(x, y);
    }
    return s(x, y);
  }));
}

// ------------------------------------------------------------------ torso textures (u around, front centre at u=0.5; v up)
// style: 'hoodie' | 'cardigan' | 'flannel' | 'sweater' | 'quarterzip' | 'girltop' | 'jersey'
const DIG = { // 3x5 pixel digits
  '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
};
export function torsoTex(style, c) {
  const W = 64, H = 64;
  let f;
  const det = [];
  if (style === 'hoodie') f = fabric('fleece', { color: c.main, seed: 11 });
  else if (style === 'cardigan') f = fabric('knit', { color: c.main, seed: 12 });
  else if (style === 'flannel') f = fabric('plaid', { color: c.main, color2: c.dark, seed: 13, period: 10 });
  else if (style === 'sweater') f = fabric('knit', { color: c.main, seed: 14 });
  else if (style === 'quarterzip') f = fabric('fleece', { color: c.main, seed: 15 });
  else if (style === 'girltop') f = fabric('cotton', { color: c.main, seed: 16, amount: 10 });
  else if (style === 'jersey') f = fabric('jersey', { color: c.main, seed: 17 });
  else if (style === 'suit' || style === 'tux' || style === 'vest') f = fabric('cotton', { color: c.main, seed: 18, amount: 9 });
  else if (style === 'dress' || style === 'gown') f = fabric('cotton', { color: c.main, seed: 19, amount: 7 });
  else if (style === 'hawaii') f = fabric('cotton', { color: c.main, seed: 20, amount: 8 });
  else if (style === 'shawl') f = fabric('knit', { color: c.main, seed: 23 });
  else f = fabric('cotton', { color: c.main, seed: 24, amount: 9 });
  const rib = fabric('rib', { color: c.rib || c.main, seed: 21 });
  const blouse = c.inner ? fabric('cotton', { color: c.inner, seed: 22, amount: 8 }) : null;
  const acc = c.accent ? hexToRgb(c.accent) : [255, 255, 255];
  const number = c.number || '';
  const img = paint(W, H, (x, y) => {
    const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H, du = u - 0.5, adu = Math.abs(du);
    let col = f(x, y);
    if (style === 'hoodie') {
      if (v < 0.07) col = rib(x, y);                                   // waistband
      if (adu < 0.13 && v > 0.1 && v < 0.36) {                          // kangaroo pocket
        const edge = (adu > 0.115) || (v > 0.34) || (adu > 0.08 && v > 0.36 - (0.13 - adu) * 1.2);
        col = addc(col, edge ? -26 : 4);
      }
      if (v > 0.93) col = addc(rib(x, y), -8);                          // neckline
    } else if (style === 'cardigan') {
      const open = v > 0.6 ? 0.008 + (v - 0.6) * 0.1 : 0.0;          // V opening showing the blouse
      if (adu < open && blouse) col = blouse(x, y);
      else if (adu < open + 0.022) col = addc(f(x, y), 14);            // button band
      if (v <= 0.6 && adu < 0.012 && (y % 8) < 3) col = [70, 40, 30];  // buttons
      if (v < 0.06) col = rib(x, y);
    } else if (style === 'flannel') {
      if (adu < 0.014) col = addc(col, 10);                             // placket
      if (adu < 0.006 && (y % 9) < 2) col = [235, 225, 210];            // buttons
      if (du > 0.07 && du < 0.16 && v > 0.62 && v < 0.75 && (v > 0.735 || du < 0.075 || du > 0.155)) col = addc(col, -25); // pocket seam
      if (v > 0.95) col = addc(col, -12);
    } else if (style === 'sweater') {
      if (v < 0.07 || v > 0.94) col = rib(x, y);
    } else if (style === 'quarterzip') {
      if (v > 0.66 && adu < 0.011) col = (adu < 0.005) ? [178, 182, 190] : addc(col, -14);   // zipper
      if (v > 0.66 && v < 0.7 && adu < 0.02) col = [200, 204, 210];                          // pull
      if (v < 0.06) col = rib(x, y);
      if (du > 0.09 && du < 0.13 && v > 0.73 && v < 0.77) col = [210, 210, 214];             // little logo
    } else if (style === 'girltop') {
      if (v > 0.56 && v < 0.64) col = addc(acc, ((x + y) & 1) * 6);                          // teal band
      if (v > 0.93) col = addc(acc, -10);
    } else if (style === 'suit' || style === 'tux' || style === 'vest') {
      // jacket / vest with a V opening: white shirt, tie or bow tie, lapels, buttons (+ rose for the groom)
      const shirt = [242, 240, 234], tieC = hexToRgb(c.tie || '#7a1c22');
      const open = v > 0.45 ? (v - 0.45) * 0.17 : 0;
      if (adu < open) {
        col = addc(shirt, ((x + y) & 1) * 4 - 2);
        if (c.bow) { if (v > 0.86 && v < 0.93 && adu < 0.05 && (adu < 0.012 || Math.abs(v - 0.895) < 0.035 - adu * 0.35)) col = addc(tieC, ((x * 3 + y) % 3) * 4); }
        else if (adu < 0.018 && v > 0.45) col = addc(tieC, ((x + 2 * y) % 4 < 2 ? 8 : -6));
      } else if (adu < open + 0.03 && v > 0.47) col = addc(col, style === 'vest' ? -10 : 16);          // lapel
      if (!c.bow && style !== 'vest' && adu < 0.016 && v > 0.3 && v <= 0.47) col = addc(tieC, ((x + 2 * y) % 4 < 2 ? 8 : -6)); // tie below the V
      if (v < 0.42 && adu < 0.008 && (y % 10) < 3) col = style === 'tux' ? [235, 232, 222] : [30, 26, 24];  // buttons
      if (style !== 'vest' && du > 0.12 && du < 0.2 && v > 0.66 && v < 0.69) col = addc(col, -18);         // breast pocket
      if (c.rose && du < -0.1 && du > -0.2 && v > 0.62 && v < 0.74) {
        const rx = (du + 0.15) / 0.05, ry = (v - 0.68) / 0.06;
        if (rx * rx + ry * ry < 1) col = ((x + y) % 3 === 0) ? [120, 10, 24] : [196, 26, 44];
      }
      if (v < 0.05) col = addc(col, -8);
    } else if (style === 'dress' || style === 'gown') {
      // sleeveless bodice: skin above the neckline, a waist band, satin sheen
      const neck = 0.8 - (adu < 0.1 ? 0.03 * Math.cos(adu * 31) : 0);
      if (v > neck && c.skin) col = fabric('cotton', { color: c.skin, amount: 5, seed: 3 })(x, y);
      else {
        col = addc(col, Math.round(8 * Math.sin(x * 0.6 + y * 0.2)));
        if (v > 0.22 && v < 0.27) col = addc(hexToRgb(c.accent || c.main), -14);
        if (style === 'dress' && ((x * 7 + y * 5) % 23 === 0)) col = [255, 255, 255];                    // little pearls
      }
    } else if (style === 'hawaii') {
      // bright party shirt: big flowers + leaves, open collar, buttons
      const fx = (x % 16) - 8, fy = (y % 16) - 8 + ((Math.floor(x / 16) & 1) ? 8 : 0);
      const fy2 = ((fy + 16 + 8) % 16) - 8;
      const r2 = fx * fx + fy2 * fy2;
      if (r2 < 10) col = hexToRgb(c.flower || '#ffd23a');
      else if (r2 < 22 && ((x + y) & 1)) col = hexToRgb(c.accent || '#ff5a8a');
      else if (((x * 5 + y * 3) % 19) < 3) col = hexToRgb(c.leaf || '#2e9e6a');
      if (adu < 0.012) col = addc(col, -20);
      if (v > 0.9 && adu < 0.08) col = addc(col, 18);
    } else if (style === 'jersey') {
      if (v > 0.92) col = addc(acc, -6);                                                       // collar trim
      // number front (u=0.5) and back (u=0/1)
      for (const cu of [0.5, 0.0, 1.0]) {
        const sx = Math.round((u - cu) * W), sy = Math.round((0.78 - v) * H);
        const n = number.length, cw = 4 * 2, totalW = n * cw - 2;
        const lx = sx + Math.floor(totalW / 2), ly = sy;
        if (lx >= 0 && lx < totalW && ly >= 0 && ly < 15) {
          const ci = Math.floor(lx / cw), px = Math.floor((lx % cw) / 2), py = Math.floor(ly / 3);
          const g = DIG[number[ci]];
          if (g && px < 3 && g[py] && g[py][px] === '1') col = addc(acc, ((x * 3 + y) % 5) - 2);
        }
      }
    } else if (style === 'shirt' || style === 'polo') {
      // button-up shirt (YOU) / polo (the dad at dinner): collar, placket, buttons, breast pocket, belt
      const pl = style === 'shirt' ? 0.0 : 0.72;
      if (v > pl && adu < 0.014) col = addc(col, 9);                                          // placket
      if (v > pl && adu < 0.005 && (y % 8) < 2) col = [246, 246, 242];                        // buttons
      if (v > 0.9 && adu < 0.13) col = addc(col, (adu > 0.115 || v < 0.915) ? -24 : 12);      // collar
      if (style === 'shirt' && du > 0.07 && du < 0.15 && v > 0.62 && v < 0.74 && (v > 0.725 || du < 0.075 || du > 0.145)) col = addc(col, -20);
      if (c.belt && v < 0.055) col = addc(hexToRgb(c.belt), ((x + y) % 3) * 3 - (adu < 0.02 ? -40 : 0));
    } else if (style === 'stripes') {
      col = (y % 8) < 4 ? addc(hexToRgb(c.main), ((x + y) & 1) * 5) : addc(acc, ((x + y) & 1) * 5 - 3);
      if (v > 0.93) col = addc(hexToRgb(c.main), -18);
    } else if (style === 'apron') {
      // flowery blouse + red apron bib with straps (front = u 0.5)
      const fx = (x % 10) - 5, fy = ((y + (Math.floor(x / 10) & 1) * 5) % 10) - 5;
      if (fx * fx + fy * fy < 4) col = ((x + y) % 2) ? [236, 120, 150] : [250, 210, 90];
      else if (fx * fx + fy * fy < 7 && ((x + y) & 1)) col = [110, 170, 100];
      const ap = hexToRgb(c.apron || '#c8322e');
      if ((adu < 0.17 && v < 0.74) || (Math.abs(adu - 0.14) < 0.02 && v >= 0.74)) col = addc(ap, ((x * 3 + y) % 4) * 3 - 4);
      if (adu < 0.17 && Math.abs(v - 0.74) < 0.012) col = addc(ap, -28);                     // hem of the bib
      if (adu < 0.08 && v > 0.3 && v < 0.45 && (Math.abs(v - 0.3) < 0.015 || adu > 0.07)) col = addc(ap, -30); // pocket
    } else if (style === 'shawl') {
      // old-fashioned brown knit shawl over the shoulders, crossed in front, dress below
      const inner = fabric('cotton', { color: c.inner || '#6a5a48', seed: 25, amount: 9 });
      const edge = 0.52 + Math.max(0, 0.2 - adu) * 0.9;
      if (v < edge) col = inner(x, y);
      else if (v < edge + 0.025) col = addc(col, -18);
      if (v < edge && v > 0.3 && adu < 0.03) col = addc(f(x, y), -6);                          // knot
    } else if (style === 'labcoat') {
      // white doctor's coat open over a light-blue shirt + tie; lapels, two lower pockets, a pen in the breast pocket
      const shirt = [170, 200, 236], tieC = hexToRgb(c.tie || '#2a3a7a');
      const open = v > 0.42 ? (v - 0.42) * 0.2 : 0.012;
      if (adu < open) {
        col = addc(shirt, ((x + y) & 1) * 4 - 2);
        if (adu < 0.018 && v > 0.3) col = addc(tieC, ((x + 2 * y) % 4 < 2 ? 8 : -6));
      } else if (adu < open + 0.035 && v > 0.45) col = addc(col, -14);
      if (Math.abs(du) > 0.1 && Math.abs(du) < 0.21 && v > 0.12 && v < 0.27 && (Math.abs(v - 0.27) < 0.012 || Math.abs(Math.abs(du) - 0.1) < 0.008 || Math.abs(Math.abs(du) - 0.21) < 0.008)) col = addc(col, -30);
      if (du > 0.12 && du < 0.2 && Math.abs(v - 0.7) < 0.01) col = addc(col, -26);
      if (du > 0.14 && du < 0.15 && v > 0.7 && v < 0.78) col = [40, 80, 200];
    } else if (style === 'overalls') {
      // work overalls: white t-shirt above, the blue bib with two straps + a chest pocket + brass buttons
      const tee = hexToRgb(c.inner || '#f2f0ea');
      const bib = v < 0.62 && adu < 0.16, strap = v >= 0.62 && Math.abs(adu - 0.12) < 0.03;
      const back = adu > 0.3 && v < 0.55;
      if (!(bib || strap || back || v < 0.42)) col = addc(tee, ((x + y) & 1) * 4 - 2);
      if (strap && Math.abs(v - 0.64) < 0.03) col = [214, 178, 80];
      if (bib && adu < 0.08 && v > 0.4 && v < 0.52 && (Math.abs(v - 0.52) < 0.012 || adu > 0.07)) col = addc(col, -26);
    } else if (style === 'coat') {
      // old long coat over a waistcoat: two button rows, wide lapels, white neck cloth
      const open = v > 0.62 ? (v - 0.62) * 0.4 : 0;
      if (adu < open) col = v > 0.86 ? [236, 232, 220] : addc(hexToRgb(c.inner || '#8a6a3a'), ((x + y) & 1) * 5);
      else if (adu < open + 0.04 && v > 0.6) col = addc(col, -16);
      if (v < 0.62 && Math.abs(adu - 0.06) < 0.008 && (y % 9) < 3) col = [196, 160, 80];       // brass buttons
    }
    if (style === 'hero') {
      // red suit: darker side panels, a gold-ish belt, a simple yellow lightning bolt on the chest (no circle, no logo)
      const red = hexToRgb(c.main), bolt = hexToRgb(c.bolt || '#ffd23a');
      col = addc(red, ((x + y) & 1) * 3 + (adu > 0.3 ? -26 : 0));
      if (v > 0.14 && v < 0.2) col = [200, 160, 50];
      const bx = du / 0.16, by = (v - 0.62) / 0.2;                  // a zigzag bolt: three slanted segments
      const seg = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, k = Math.max(0, Math.min(1, ((bx - x0) * dx + (by - y0) * dy) / L2)); const px = x0 + k * dx - bx, py = y0 + k * dy - by; return px * px + py * py < w * w; };
      if (seg(0.35, 0.9, -0.15, 0.05, 0.13) || seg(-0.15, 0.05, 0.25, -0.05, 0.13) || seg(0.25, -0.05, -0.3, -0.9, 0.13)) col = addc(bolt, ((x * 3 + y) % 3) * 3);
    } else if (style === 'torn') {
      // old torn jacket, open over a grey t-shirt: patches with stitches, rips, a broken zip
      const tee = hexToRgb(c.inner || '#8a8a86');
      if (adu < 0.055 && v > 0.08) col = addc(tee, ((x * 3 + y) % 5) - 2 + (v > 0.9 ? -10 : 0));
      else if (adu < 0.07 && v > 0.08) col = addc(col, (y % 3 === 0) ? -30 : -12);              // the zip edge
      const patch = (u0, u1, v0, v1, pc) => {
        if (du > u0 && du < u1 && v > v0 && v < v1) {
          const edge = du - u0 < 0.012 || u1 - du < 0.012 || v - v0 < 0.012 || v1 - v < 0.012;
          col = edge && (x + y) % 3 === 0 ? [236, 228, 200] : addc(hexToRgb(pc), ((x + y) & 1) * 6);
        }
      };
      patch(0.1, 0.2, 0.22, 0.34, c.patch || '#7a5a9a');
      patch(-0.24, -0.14, 0.55, 0.64, c.patch2 || '#3a6a8a');
      // rips: dark jagged slits
      for (const [ru, rv, rl] of [[-0.16, 0.3, 0.07], [0.15, 0.62, 0.05], [0.32, 0.4, 0.06], [-0.36, 0.7, 0.05]]) {
        if (Math.abs(v - rv - 0.012 * Math.sin((du - ru) * 160)) < 0.012 && Math.abs(du - ru) < rl) col = [40, 32, 26];
      }
      if (v < 0.07) col = addc(col, -14);
    } else if (style === 'robe') {
      // silk dressing robe: deep V showing the chest, gold trim on the lapels and cuffs, a sash at the waist, silk sheen
      const skin = hexToRgb(c.skin || '#e0ae88'), trim = hexToRgb(c.trim || '#d8b04a');
      col = addc(hexToRgb(c.main), Math.round(10 * Math.sin(x * 0.35 + y * 0.12)) + ((x + y) & 1) * 2);
      const open = v > 0.36 ? (v - 0.36) * 0.36 : 0;
      if (adu < open) col = addc(skin, ((x + y) & 1) * 3);
      else if (adu < open + 0.035 && v > 0.3) col = addc(trim, ((x * 2 + y) % 4) * 4 - 6);
      if (v > 0.2 && v < 0.27) col = addc(trim, ((x + y) % 3) * 5 - 8);                        // the sash
      if (du > 0.05 && du < 0.08 && v > 0.04 && v < 0.21) col = addc(trim, -4);                // sash end hanging
    }
    if (c.pin && (style === 'suit')) {                                                          // pinstripes
      const open = v > 0.45 ? (v - 0.45) * 0.17 : 0;
      if (adu > open + 0.03 && x % 6 === 0) col = addc(col, 22);
    }
    return col;
  });
  return tex(img);
}

// ------------------------------------------------------------------ faces
// Face texture covers head-local x in [-FX, FX], y in [FY0, FY1] (times head scale), drawn on a 128 px canvas.
export const FACE = { FX: 0.085, FY0: -0.11, FY1: 0.06, S: 128 };
const PX = (x) => Math.round(64 + (x / FACE.FX) * 64);                    // head-local x (unscaled) -> canvas px
const PY = (y) => Math.round(((FACE.FY1 - y) / (FACE.FY1 - FACE.FY0)) * 128);

// fs: { skin, brow, line, lash, blush, freckles, beard, eyeW, eyeH, eyeX, eyeY, browY, mouthY, mouthW, seed }
export function makeFaceSet(fs) {
  const S = FACE.S;
  const skin = hexToRgb(fs.skin);
  const sk = fabric('cotton', { color: fs.skin, amount: 5, seed: fs.seed || 2 });
  const beard = fs.beard ? hexToRgb(fs.beard) : null;
  const R = rng((fs.seed || 2) + 300);
  const eyeX = PX(fs.eyeX ?? 0.031) - 64, eyeY = PY(fs.eyeY ?? 0.004), browY = PY(fs.browY ?? 0.027), mouthY = PY(fs.mouthY ?? -0.05);
  const base = paint(S, S, (x, y) => {
    let c = sk(x, y);
    if (fs.blush) { // soft cheeks
      for (const s of [-1, 1]) {
        const dx = (x - (64 + s * (eyeX + 4))) / 10, dy = (y - (eyeY + 17)) / 6;
        const d = dx * dx + dy * dy;
        if (d < 1) c = mixc(c, hexToRgb(fs.blush), 0.28 * (1 - d));
      }
    }
    if (fs.freckles) {
      for (const s of [-1, 1]) {
        const dx = x - (64 + s * (eyeX + 2)), dy = y - (eyeY + 13);
        if (Math.abs(dx) < 9 && Math.abs(dy) < 4 && ((x * 7 + y * 13) % 11 === 0)) c = mixc(c, [150, 90, 60], 0.45);
      }
    }
    if (beard) { // painted beard around the mouth (the 3D beard shell covers jaw + chin)
      const yy = (FACE.FY1 - ((y + 0.5) / S) * (FACE.FY1 - FACE.FY0)), xx = ((x + 0.5) / S * 2 - 1) * FACE.FX;
      const must = yy < -0.031 && yy > -0.046 && Math.abs(xx) < 0.03 - (yy + 0.031) * -0.2;
      const chin = yy < -0.046 && Math.abs(xx) < 0.05;
      const cheeks = yy < -0.012 + Math.abs(xx) * 0.0 && Math.abs(xx) > 0.04 && yy < -0.02;
      if (must || chin || cheeks) {
        const n = ((x * 5 + (y >> 1) * 3) % 7) - 3;
        c = addc(beard, n * 4 + (R() - 0.5) * 10);
      }
    }
    return c;
  });
  const cache = new Map();
  const C = (r) => css(r);
  const LINE = fs.line || '#1c120e', MOUTH_IN = '#3b1214', TEETH = '#f2ede2', TONGUE = '#b8505a', WHITE = '#f4f1ea', PUPIL = '#120c0a';
  const browC = fs.brow || '#3a2a20';
  const eW = fs.eyeW ?? 8, eH = fs.eyeH ?? 12;

  function draw(g, eyes, brows, mouth, tq, pdx, pdy, chewPh) {
    const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    // ---- eyes
    const eyesIn = eyes;
    for (const s of [-1, 1]) {
      const cx = 64 + s * eyeX, cy = eyeY;
      const ox = pdx * 3, oy = -pdy * 2;
      eyes = eyesIn === 'peek' ? (s < 0 ? 'closed' : 'open') : eyesIn;   // 'peek': one eye shut, one peeking (fake sleep)
      if (eyes === 'closed') {
        rect(cx - 6, cy + 1, 12, 3, LINE); rect(cx - 7 + (s > 0 ? 12 : 0), cy - 1 + 2, 2, 2, LINE);
      } else if (eyes === 'happy') { // ^ shapes
        for (let i = -6; i <= 6; i++) { const yy = cy - 2 + Math.round(Math.abs(i) * 0.6); rect(cx + i, yy, 1, 3, LINE); }
      } else if (eyes === 'squint') {
        rect(cx - 6 + ox * 0.5, cy - 1, 12, 4, LINE);
      } else if (eyes === 'wide' || eyes === 'stare') {
        const w = 14, h = eyes === 'wide' ? 17 : 15;
        g.fillStyle = WHITE; g.fillRect(cx - w / 2 + 1, cy - h / 2, w - 2, h); g.fillRect(cx - w / 2, cy - h / 2 + 1, w, h - 2);
        g.fillStyle = LINE; g.fillRect(cx - w / 2 + 1, cy - h / 2 - 1, w - 2, 2);                    // upper lid line
        const pw = eyes === 'wide' ? 7 : 4, ph = eyes === 'wide' ? 10 : 5;
        rect(cx - pw / 2 + ox * 1.1, cy - ph / 2 + oy * 1.2, pw, ph, PUPIL);
      } else if (eyes === 'heart' || eyes === 'heartBig') {
        const HP = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
        const k = eyes === 'heartBig' ? 4 : 3, w = 7 * k, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 3.5 * k - 1);
        for (let r = 0; r < 7; r++) for (let q = 0; q < 7; q++) {
          if (HP[r][q] !== 'X') continue;
          const edge = q === 0 || q === 6 || HP[r][q - 1] !== 'X' || HP[r][q + 1] !== 'X' || r === 6 || !HP[r + 1] || HP[r + 1][q] !== 'X' || r === 0 || HP[r - 1][q] !== 'X';
          rect(x0 + q * k, y0 + r * k, k, k, edge ? '#9a0a1e' : '#ec1c34');
        }
        rect(x0 + k, y0 + k, k, k, '#ffb0bc');                                                   // shine
      } else { // open: black rectangles (reference look)
        rect(cx - eW / 2 + ox, cy - eH / 2 + oy, eW, eH, PUPIL);
        rect(cx - eW / 2 + ox + 1, cy - eH / 2 + oy - 1, eW - 2, 1, PUPIL);
        rect(cx - eW / 2 + ox + 1, cy + eH / 2 + oy, eW - 2, 1, PUPIL);
        rect(cx - eW / 2 + ox + 2, cy - eH / 2 + oy + 2, 2, 2, '#4a3c36');                            // tiny catchlight-ish
      }
      if (fs.lash && eyes !== 'closed' && eyes !== 'happy') { const lx = cx + s * (eyes === 'wide' || eyes === 'stare' ? 7 : 5) + ox * (eyes === 'open' ? 1 : 0); rect(lx - (s < 0 ? 2 : 0), cy - (eyes === 'open' ? eH / 2 : 8) - 1 + (eyes === 'open' ? oy : 0), 2, 2, LINE); }
    }
    // ---- brows (outer -> inner line, pixel steps). s=-1: viewer-left (character's right) brow
    const bt = fs.browT ?? 3;
    for (const s of [-1, 1]) {
      const outer = 64 + s * (eyeX + 8), inner = 64 + s * (eyeX - 7);
      let yo = 0, yi = 0, arch = 1;
      if (brows === 'worried') { yo = 1; yi = -5; arch = 0; }
      else if (brows === 'angry') { yo = -2; yi = 5; arch = 0; }
      else if (brows === 'raised') { yo = -4; yi = -5; arch = 2; }
      else if (brows === 'sad') { yo = 3; yi = -4; arch = 0; }
      else if (brows === 'skeptic') { if (s < 0) { yo = -6; yi = -7; arch = 3; } else { yo = -1; yi = 4; arch = 0; } }
      const n = Math.abs(inner - outer);
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = outer + Math.sign(inner - outer) * i;
        const y = browY + yo + (yi - yo) * k - arch * Math.sin(k * Math.PI);
        rect(x, y, 1, bt, browC);
      }
    }
    // ---- mouth
    const my = mouthY, mx = 64;
    let shape = mouth;
    const tl = tq / 4; // 0..1
    if (tl > 0.01 && (mouth === 'neutral' || mouth === 'tight' || mouth === 'chew')) shape = 'talkOpen';
    if (tl > 0.01 && mouth === 'smile') shape = 'smileOpen';
    if (tl > 0.01 && mouth === 'frown') shape = 'frownOpen';
    const curve = (hw, bend, thick, col, dy = 0) => { // bend>0 corners up
      for (let i = -hw; i <= hw; i++) { const k = i / hw; rect(mx + i, my + dy - bend * k * k, 1, thick, col); }
    };
    const dShape = (hw, top, h, bendTop, teeth, tongue) => { // open mouth: flat-ish top, round bottom
      for (let i = -hw; i <= hw; i++) {
        const k = i / hw, yt = my + top - bendTop * k * k, yb = my + top + h * Math.sqrt(Math.max(0, 1 - k * k)) - bendTop * k * k * 0.3;
        if (yb - yt < 1) continue;
        rect(mx + i, yt, 1, yb - yt, MOUTH_IN);
        if (teeth && Math.abs(k) < 0.85) rect(mx + i, yt, 1, Math.min(teeth, yb - yt), TEETH);
        if (tongue && Math.abs(k) < 0.6 && yb - yt > 6) rect(mx + i, yb - 3, 1, 3, TONGUE);
        rect(mx + i, yt - 1, 1, 1, LINE);
        rect(mx + i, yb, 1, 1, LINE);
      }
    };
    const mw = fs.mouthW ?? 1;
    if (shape === 'neutral') curve(Math.round(8 * mw), 0.5, 2, LINE);
    else if (shape === 'smile') curve(Math.round(11 * mw), 4, 2, LINE, 1);
    else if (shape === 'frown') curve(Math.round(9 * mw), -3.5, 2, LINE, -1);
    else if (shape === 'tight') { curve(Math.round(7 * mw), 0, 2, LINE); rect(mx - 8 * mw, my - 1, 1, 3, LINE); rect(mx + 8 * mw, my - 1, 1, 3, LINE); }
    else if (shape === 'chew') { const o = chewPh ? 1 : -1; for (let i = -7; i <= 7; i++) rect(mx + i + o, my + (i * o > 3 ? -1 : 0), 1, 2, LINE); }
    else if (shape === 'talkOpen') dShape(Math.round(7 * mw), -1, 2 + tl * 8, 0, tl > 0.5 ? 2 : 0, false);
    else if (shape === 'smileOpen') dShape(Math.round(10 * mw), -1, 2 + tl * 8, 3, 2, false);
    else if (shape === 'frownOpen') dShape(Math.round(8 * mw), 0, 2 + tl * 6, -2, 0, false);
    else if (shape === 'open') dShape(Math.round(7 * mw), -3, 8 + tl * 4, 0, 0, true);
    else if (shape === 'o') { for (let i = -4; i <= 4; i++) { const h = Math.round(5.5 * Math.sqrt(1 - (i / 4.6) ** 2)); rect(mx + i, my - h + 1, 1, 2 * h, MOUTH_IN); rect(mx + i, my - h, 1, 1, LINE); rect(mx + i, my + h + 1, 1, 1, LINE); } }
    else if (shape === 'yell') dShape(Math.round(12 * mw), -6, 36, 0, 3, true);
    else if (shape === 'grin') dShape(Math.round(13 * mw), -2, 6 + tl * 5, 4, 4, false);
    else if (shape === 'laugh') dShape(Math.round(13 * mw), -3, 10 + tl * 6, 4, 3, true);
    else if (shape === 'grimace') {
      const hw = Math.round(13 * mw), h = 7;
      rect(mx - hw, my - 3, 2 * hw + 1, h, TEETH);
      g.fillStyle = LINE; g.fillRect(mx - hw - 1, my - 4, 2 * hw + 3, 1); g.fillRect(mx - hw - 1, my - 3 + h, 2 * hw + 3, 1);
      g.fillRect(mx - hw - 1, my - 4, 1, h + 2); g.fillRect(mx + hw + 1, my - 4, 1, h + 2); g.fillRect(mx - hw, my, 2 * hw + 1, 1);
      for (let i = -hw + 4; i < hw; i += 4) g.fillRect(mx + i, my - 3, 1, h);
    }
  }

  return function get(eyes, brows, mouth, talk, pdx, pdy, chewPh) {
    const tq = Math.round(clamp(talk) * 4), qx = Math.round(clamp(pdx, -1, 1) * 2) / 2, qy = Math.round(clamp(pdy, -1, 1) * 2) / 2;
    const cp = mouth === 'chew' ? (chewPh ? 1 : 0) : 0;
    const key = `${eyes}|${brows}|${mouth}|${tq}|${qx}|${qy}|${cp}`;
    let t = cache.get(key);
    if (t) return t;
    const c = canvas(S, S), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0);
    draw(g, eyes, brows, mouth, tq, qx, qy, cp);
    t = tex(c, { mip: true });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    cache.set(key, t);
    return t;
  };
}

// plain skin texture (matches the face background noise)
export function skinTex(hex, seed = 2) { return fabricTex('cotton', { color: hex, amount: 5, seed }, 32); }
