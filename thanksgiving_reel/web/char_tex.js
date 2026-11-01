// Textures for characters.js only: pixel-noisy clothing fabrics + cached canvas face textures.
// Deterministic (rng/hash only). Canvases are tiny and sampled with NearestFilter (PS1 look).
import * as THREE from 'three';
import { paint, tex, rng, hexToRgb, clamp, noise2, canvas } from './lib.js';

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const addc = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const css = (c) => `rgb(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))})`;

// ------------------------------------------------------------------ fabrics (return [r,g,b] for pixel x,y)
// Each fabric is a function f(x, y) -> rgb so torso painters can compose them with details.
export function fabric(kind, o = {}) {
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
  else f = fabric('cotton', { color: c.main });
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
    for (const s of [-1, 1]) {
      const cx = 64 + s * eyeX, cy = eyeY;
      const ox = pdx * 3, oy = -pdy * 2;
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
