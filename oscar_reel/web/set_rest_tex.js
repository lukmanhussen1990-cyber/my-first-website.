// Pixel textures for the void, the restaurant and the interior (canvas, deterministic, NearestFilter via lib.tex).
// No text anywhere.
import { paint, canvas, rng, noise2, hexToRgb, clamp } from './lib.js';

const rgb = hexToRgb;
const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// ---------------------------------------------------------------- restaurant
// gold damask wallpaper: a mirrored flower/leaf medallion + a small diamond in a half-drop repeat (32 x 48 tile)
export function damaskCanvas(o = {}) {
  const W = 32, H = 48, seed = o.seed || 5;
  const base = rgb(o.base || '#b07c2a'), hi = rgb(o.hi || '#e6bd60'), lo = rgb(o.lo || '#7a5016');
  const R = rng(seed), N = noise2(W, H, 6, seed + 1);
  const big = (u, v) => {                       // u in [0,1] (mirrored), v in [-1,1] (down)
    if (u < 0.08 && Math.abs(v) < 0.5) return true;                                   // stem
    if ((u / 0.2) ** 2 + ((v + 0.62) / 0.22) ** 2 < 1) return true;                    // top bud
    if ((u / 0.34) ** 2 + ((v - 0.55) / 0.11) ** 2 < 1) return true;                   // base leaf
    const a = -0.6, x = u - 0.36, y = v + 0.08, rx = x * Math.cos(a) - y * Math.sin(a), ry = x * Math.sin(a) + y * Math.cos(a);
    if ((rx / 0.3) ** 2 + (ry / 0.1) ** 2 < 1) return true;                            // side leaves
    const d = Math.hypot((u - 0.5) * 1.0, (v - 0.3) * 0.7);
    if (d > 0.13 && d < 0.2 && v > 0.22) return true;                                 // scroll curls
    if (Math.hypot(u - 0.74, (v + 0.52) * 0.7) < 0.08) return true;                   // dots
    return false;
  };
  const small = (u, v) => Math.abs(u) + Math.abs(v) < 0.26 && Math.abs(u) + Math.abs(v) > 0.1;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = Math.abs(x + 0.5 - W / 2) / (W / 2), v = (y + 0.5 - H / 2) / (H / 2);
    const cx = ((x + W / 2) % W + 0.5 - W / 2) / (W / 2), cy = ((y + H / 2) % H + 0.5 - H / 2) / (H / 2);
    mask[y * W + x] = big(u, v) || small(cx, cy) ? 1 : 0;
  }
  const at = (x, y) => mask[((y + H) % H) * W + ((x + W) % W)];
  return paint(W, H, (x, y) => {
    const n = (N[y * W + x] - 0.5) * 18 + (R() - 0.5) * 8;
    if (at(x, y)) return add(hi, n + (at(x, y - 1) ? 0 : 14));
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) return add(lo, n * 0.5);
    return add(base, n);
  });
}

// basket-weave parquet: blocks of 3 planks, alternating direction (48 x 48 = 4 x 4 blocks)
export function parquetCanvas(o = {}) {
  const S = 48, B = 12, P = 4, seed = o.seed || 31;
  const R = rng(seed), N = noise2(S, S, 3, seed + 1);
  const woods = (o.woods || ['#6c3c20', '#7a4826', '#62361c', '#84502a', '#5a321a', '#73421f']).map(rgb);
  return paint(S, S, (x, y) => {
    const bx = Math.floor(x / B), by = Math.floor(y / B), lx = x % B, ly = y % B;
    const horiz = (bx + by) % 2 === 0;
    const plank = horiz ? Math.floor(ly / P) : Math.floor(lx / P);
    const along = horiz ? lx : ly, across = horiz ? ly % P : lx % P;
    const id = Math.abs(bx * 7 + by * 13 + plank * 5) % woods.length;
    let c = woods[id].slice();
    const grain = Math.sin(along * 1.3 + plank * 2.1 + bx * 3.7 + by * 1.9 + across * 0.7);
    c = add(c, grain * 7 + (N[y * S + x] - 0.5) * 12 + (R() - 0.5) * 6);
    if (across === 0) c = add(c, 10);                                   // lit plank edge
    if (across === P - 1) c = add(c, -30);                              // seam
    if (lx === B - 1 || ly === B - 1) c = add(c, -26);
    return c;
  });
}

// soft velvet (red by default): vertical streaks + pixel noise
export function velvetCanvas(base = '#9a1426', seed = 47) {
  const S = 32, R = rng(seed), N = noise2(S, S, 4, seed + 1), b = rgb(base);
  return paint(S, S, (x, y) => add(b, Math.sin(x * 1.7 + N[y * S + x] * 3) * 7 + (N[y * S + x] - 0.5) * 20 + (R() - 0.5) * 8));
}

// coffered ceiling panel: cream field, gold frame with bevels, a small rosette in the middle (64 x 64 = one coffer)
export function cofferCanvas(seed = 61) {
  const S = 64, R = rng(seed), N = noise2(S, S, 8, seed + 1);
  const cream = rgb('#efe0bc'), gold = rgb('#d4a446'), goldD = rgb('#94681e'), goldL = rgb('#f4cf72');
  return paint(S, S, (x, y) => {
    const n = (N[y * S + x] - 0.5) * 12 + (R() - 0.5) * 6;
    const e = Math.min(x, y, S - 1 - x, S - 1 - y);
    if (e < 5) return add(e === 0 || e === 4 ? goldD : e === 1 ? goldL : gold, n);
    if (e < 9) { const lit = x < y ? (x + y < S) : (x + y < S); return add(mix(cream, gold, 0.25), n + (lit ? 10 : -16) + (e === 8 ? -18 : 0)); }
    const d = Math.hypot(x - 31.5, y - 31.5);
    if (d < 4) return add(goldL, n);
    if (d < 7 && Math.cos(Math.atan2(y - 31.5, x - 31.5) * 8) > 0) return add(gold, n);
    if (d > 9 && d < 10.5) return add(mix(cream, gold, 0.6), n);
    return add(cream, n);
  });
}

// night outside a tall window: deep blue sky, stars, a moon, far city skyline with warm windows; gold mullions
// (32 x 96; the arched top is cut by the window geometry)
export function nightWindowCanvas(o = {}) {
  const W = 32, H = 96, seed = o.seed || 41, R = rng(seed), N = noise2(W, H, 8, seed + 1);
  const top = rgb('#060b24'), hor = rgb('#26346a'), city = rgb('#101634'), lit = rgb('#ffc86a'), litB = rgb('#bcd8ff');
  const gold = rgb('#d6a640'), goldD = rgb('#8a6420');
  const sky = 74;                                                 // skyline baseline row
  const heights = Array.from({ length: W }, (_, x) => 0);
  for (let x = 0, h = 6; x < W;) { const w = 2 + Math.floor(R() * 4), hh = 4 + Math.floor(R() * 14); for (let k = 0; k < w && x < W; k++, x++) heights[x] = hh; h = hh; }
  const winLit = Array.from({ length: W * H }, () => R());
  const moon = o.moon ? { x: 9, y: 16 } : null;
  return paint(W, H, (x, y) => {
    if (x === 15 || x === 16) return x === 15 ? gold : goldD;     // mullion + transom bars
    if (y % 24 === 23) return goldD;
    if (y % 24 === 22) return gold;
    if (y > sky - heights[x]) {
      let c = add(city, (N[y * W + x] - 0.5) * 10);
      if (y > sky - heights[x] + 1 && (x % 3 !== 0) && (y % 3 !== 0) && winLit[y * W + x] < 0.3) c = winLit[y * W + x] < 0.06 ? litB : lit;
      if (y >= sky + 8) c = mix(c, rgb('#2a2440'), 0.4);
      return c;
    }
    let c = mix(top, hor, clamp(y / sky) ** 1.6);
    c = add(c, (N[y * W + x] - 0.5) * 10);
    if (moon && Math.hypot(x - moon.x, y - moon.y) < 3.2) c = Math.hypot(x - moon.x - 1.2, y - moon.y + 0.8) < 2.6 ? mix(c, top, 0.6) : rgb('#fff4d6');
    else if (moon && Math.hypot(x - moon.x, y - moon.y) < 6) c = mix(c, rgb('#6a78b0'), 0.25);
    if (winLit[y * W + x] > 0.985 && y < sky - 12) c = rgb('#f4f0ff');
    else if (winLit[y * W + x] > 0.97 && y < sky - 12) c = mix(c, rgb('#c8d0ff'), 0.6);
    return c;
  });
}

// white tablecloth: faint woven damask squares
export function clothCanvas(seed = 71) {
  const S = 32, R = rng(seed), N = noise2(S, S, 5, seed + 1), b = rgb('#f6f2ea');
  return paint(S, S, (x, y) => {
    let c = add(b, (N[y * S + x] - 0.5) * 8 + (R() - 0.5) * 5);
    const u = (x % 16) - 7.5, v = (y % 16) - 7.5;
    if (Math.abs(Math.abs(u) + Math.abs(v) - 5) < 0.6) c = add(c, -10);
    return c;
  });
}

// seared steak top: brown crust, black grill marks, juicy highlights, a little marbling (64 x 48)
export function steakCanvas(seed = 81) {
  const W = 64, H = 48, R = rng(seed), N = noise2(W, H, 6, seed + 1), N2 = noise2(W, H, 3, seed + 2);
  const crust = rgb('#7c3818'), dark = rgb('#4a1e0a'), mark = rgb('#24100a'), juicy = rgb('#c06a3c'), fat = rgb('#e8c890');
  return paint(W, H, (x, y) => {
    let c = mix(crust, dark, N[y * W + x] * 0.7);
    c = add(c, (N2[y * W + x] - 0.5) * 22 + (R() - 0.5) * 10);
    const m = ((x * 0.8 + y * 0.6) % 11 + 11) % 11;
    if (m < 1.8) c = mix(c, mark, 0.85);                                  // grill marks
    else if (m < 2.6) c = mix(c, mark, 0.35);
    const marb = Math.sin(x * 0.35 + Math.sin(y * 0.4) * 2.2 + N[y * W + x] * 4);
    if (marb > 0.94 && m > 3) c = mix(c, fat, 0.32);                     // marbling
    if (R() < 0.05 && m > 3) c = mix(c, juicy, 0.65);                     // juicy shine
    if (y < 5) c = mix(c, fat, 0.55 - y * 0.08);                          // fat cap along one side
    return c;
  });
}
// steak sides: dark crust with a cream fat band
export function steakSideCanvas(seed = 83) {
  const S = 32, R = rng(seed), N = noise2(S, S, 4, seed + 1);
  return paint(S, S, (x, y) => {
    let c = mix(rgb('#5a2610'), rgb('#8a3c1c'), N[y * S + x]);
    if (y > 12 && y < 18) c = mix(c, rgb('#e2c08a'), 0.5);
    return add(c, (R() - 0.5) * 12);
  });
}

// grand piano keyboard: white keys with black keys on top (64 x 16, u along the keyboard)
export function keysCanvas() {
  const W = 64, H = 16;
  const blackAt = (k) => [1, 2, 4, 5, 6].includes(k % 7);     // black key before white key k
  return paint(W, H, (x, y) => {
    const wk = Math.floor(x / 2), edge = x % 2 === 1;
    let c = edge && y > 0 ? [168, 164, 156] : [246, 242, 232];
    if (y < 9 && x % 2 === 0 && blackAt(wk)) c = [18, 18, 22];
    if (y < 9 && x % 2 === 1 && blackAt(wk + 1)) c = [18, 18, 22];
    if (y === 0) c = [60, 54, 50];
    return c;
  });
}
// piano soundboard (seen when the lid is open): gold plate + dark strings
export function pianoInsideCanvas(seed = 91) {
  const S = 32, R = rng(seed), N = noise2(S, S, 5, seed + 1);
  return paint(S, S, (x, y) => {
    let c = add(rgb('#c8963e'), (N[y * S + x] - 0.5) * 24 + (R() - 0.5) * 8);
    if (x % 2 === 0) c = mix(c, rgb('#3a2a1a'), 0.55);
    if ((x + y) % 11 === 0) c = add(c, 24);
    return c;
  });
}

// kentia palm frond (u across, v along) with transparent background
export function frondCanvas(seed = 101) {
  const W = 32, H = 64, R = rng(seed);
  const g1 = rgb('#3f7a34'), g2 = rgb('#2c5a26'), g3 = rgb('#6aa048');
  return paint(W, H, (x, y) => {
    const u = (x + 0.5) / W - 0.5, v = 1 - (y + 0.5) / H;          // v: 0 base -> 1 tip
    if (Math.abs(u) < 0.03) return [...g2, 255];                     // rib
    const env = Math.sin(Math.PI * Math.min(1, v * 1.15)) * 0.5;     // frond outline
    const leaflet = ((v * 22 + Math.abs(u) * 9) % 1);
    if (Math.abs(u) > env || leaflet < 0.28) return [0, 0, 0, 0];
    const c = mix(g1, Math.abs(u) > env * 0.7 ? g3 : g2, R() * 0.5);
    return [...add(c, (R() - 0.5) * 14), 255];
  });
}

// bark of an indoor palm trunk (rings)
export function trunkCanvas(seed = 103) {
  const S = 16, R = rng(seed);
  return paint(S, S * 2, (x, y) => add(rgb(y % 6 < 2 ? '#5e4428' : '#8a6a44'), (R() - 0.5) * 18));
}

// 4-point sparkle star (transparent), for crystals / void twinkles
export function starCanvas(S = 32) {
  const c = canvas(S, S), g = c.getContext('2d');
  const h = S / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(h, 0); g.lineTo(h + S * 0.07, h); g.lineTo(h, S); g.lineTo(h - S * 0.07, h); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, h); g.lineTo(h, h - S * 0.07); g.lineTo(S, h); g.lineTo(h, h + S * 0.07); g.closePath(); g.fill();
  return c;
}

// tiny cake slice + cream (side) for the dessert plates
export function cakeCanvas(seed = 111) {
  const S = 16, R = rng(seed);
  return paint(S, S, (x, y) => {
    const band = Math.floor(y / 4);
    const c = band % 2 ? rgb('#f6e6d0') : rgb('#e87a98');
    return add(c, (R() - 0.5) * 10);
  });
}

// ---------------------------------------------------------------- interior
// old floral wallpaper: cream with pale stripes, pink roses + leaves, little lilac sprigs (64 x 64, half-drop)
export function floralCanvas(seed = 121) {
  const S = 64, R = rng(seed), N = noise2(S, S, 8, seed + 1);
  const cream = rgb('#efe2c2'), stripe = rgb('#e6d4ae'), pink = rgb('#e08a98'), pinkD = rgb('#b4506a'), pinkL = rgb('#f4b8c0');
  const leaf = rgb('#7f9e5a'), leafD = rgb('#56763c'), lilac = rgb('#a492c8'), stem = rgb('#8aa06a');
  const roses = [[16, 16], [48, 48]], sprigs = [[48, 16], [16, 48]];
  const wrap = (d) => { d = ((d % S) + S) % S; return d > S / 2 ? d - S : d; };
  return paint(S, S, (x, y) => {
    let c = (x % 16 < 2) ? stripe : cream;
    c = add(c, (N[y * S + x] - 0.5) * 10 + (R() - 0.5) * 5);
    for (const [rx, ry] of roses) {
      const dx = wrap(x - rx), dy = wrap(y - ry), d = Math.hypot(dx, dy);
      // two leaves (diagonal ellipses) under the rose
      for (const sd of [-1, 1]) {
        const lx = dx - sd * 6.5, ly = dy - 4, a = sd * 0.7;
        const ux = lx * Math.cos(a) - ly * Math.sin(a), uy = lx * Math.sin(a) + ly * Math.cos(a);
        const e = (ux / 4.6) ** 2 + (uy / 2.2) ** 2;
        if (e < 1) c = e > 0.6 ? leafD : (Math.abs(uy) < 0.5 ? leafD : leaf);
      }
      if (d < 5.6) {
        const ang = Math.atan2(dy, dx), sp = (ang / (Math.PI * 2) * 3 + d * 0.42) % 1;
        c = d < 1.6 ? pinkD : (sp < 0.22 || sp > 0.92) ? pinkD : d < 3.4 ? pink : (dy < 0 ? pinkL : pink);
        if (d > 4.8) c = mix(c, pinkD, 0.5);
      }
    }
    for (const [sx, sy] of sprigs) {
      const dx = wrap(x - sx), dy = wrap(y - sy);
      if (Math.abs(dx + dy * 0.3) < 0.6 && dy > -3 && dy < 5) c = stem;
      for (const [fx, fy] of [[0, -4], [-3, -1], [3, 0], [-1, 2]]) if (Math.abs(dx - fx) + Math.abs(dy - fy) < 1.6) c = (dx === fx && dy === fy) ? rgb('#f4e6a0') : lilac;
    }
    return c;
  });
}

// the handkerchief: faded pink silk, gold edge with lace dots, a tiny red heart in one corner, a few brownish
// (tea-coloured) spots, faint creases + crusty speckles. Funny, not gross.
export function hankyCanvas(seed = 131) {
  const S = 64, R = rng(seed), N = noise2(S, S, 10, seed + 1), N2 = noise2(S, S, 3, seed + 2);
  const pink = rgb('#e6a0b2'), faded = rgb('#f2cfd4'), deep = rgb('#cc7c94'), gold = rgb('#dcae48'), goldD = rgb('#9a7026');
  const stain = rgb('#b08254'), stainRim = rgb('#8a5c36'), heart = rgb('#c81e3a');
  const spots = [[20, 22, 6.5], [44, 38, 4.5], [30, 46, 3.2], [49, 15, 2.6]];
  const creases = [[0.35, 0.94, 6], [-0.82, 0.57, 40], [0.9, 0.42, 30]];   // (dir x, dir y, offset)
  return paint(S, S, (x, y) => {
    const e = Math.min(x, y, S - 1 - x, S - 1 - y);
    if (e < 2) return add((x + y) % 3 === 0 ? goldD : gold, (R() - 0.5) * 16);                 // gold hem
    if (e === 2) return (x + y) % 2 ? add(faded, 6) : add(gold, -10);                            // lace dots
    let c = mix(pink, faded, clamp(N[y * S + x] * 1.5 - 0.35));
    c = mix(c, deep, clamp(0.35 - N[y * S + x]) * 0.8);
    if (e === 5 && (x + y) % 4 < 2) c = mix(c, gold, 0.75);                                    // inner embroidered line
    for (const [dx, dy, o] of creases) { const d = Math.abs(x * dx + y * dy - o - (N2[y * S + x] - 0.5) * 4); if (d < 0.7) c = mix(c, deep, 0.45); else if (d < 1.4) c = add(c, 8); }
    for (const [sx, sy, r] of spots) {
      const d = Math.hypot(x - sx, (y - sy) * 1.15) + (N2[y * S + x] - 0.5) * 2.4;
      if (d < r) c = mix(c, d > r - 1.1 ? stainRim : stain, d > r - 1.1 ? 0.62 : 0.42);
    }
    // tiny heart, bottom-right corner
    const hx = (x - 51.5) / 4.2, hy = -(y - 50.5) / 4.2;
    if ((hx * hx + hy * hy - 1) ** 3 - hx * hx * hy * hy * hy < 0) c = add(heart, (R() - 0.5) * 14);
    if (R() < 0.035) c = add(c, -22);                                                            // crusty speckles
    return add(c, (R() - 0.5) * 6);
  });
}

// dark velvet backing inside the frame
export function backingCanvas(base = '#1e4a44', seed = 141) {
  const S = 32, R = rng(seed), N = noise2(S, S, 6, seed + 1), b = rgb(base);
  return paint(S, S, (x, y) => add(b, (N[y * S + x] - 0.5) * 14 + (R() - 0.5) * 8));
}

// warm wooden planks (floor / wainscot), u across the planks
export function planksCanvas(o = {}) {
  const W = 32, H = 64, seed = o.seed || 151, R = rng(seed), N = noise2(W, H, 4, seed + 1);
  const b = rgb(o.base || '#8a5a34'), d = rgb(o.dark || '#5a3820');
  const pw = o.plank || 8;
  const offs = Array.from({ length: 16 }, () => Math.floor(R() * H));
  return paint(W, H, (x, y) => {
    const p = Math.floor(x / pw), lx = x % pw;
    let c = mix(b, d, N[y * W + x] * 0.45 + (p % 2) * 0.12);
    c = add(c, Math.sin((y + offs[p % 16]) * 0.5 + lx * 0.9) * 6 + (R() - 0.5) * 8);
    if (lx === pw - 1) c = mix(c, d, 0.8);
    if ((y + offs[p % 16]) % H === 0) c = mix(c, d, 0.9);
    return c;
  });
}

// glass glare streaks (alpha in the texture): two diagonal soft bands
export function glareCanvas() {
  const W = 32, H = 32;
  return paint(W, H, (x, y) => {
    const d = (x + y * 0.8);
    const a = Math.exp(-(((d - 16) / 2.2) ** 2)) * 0.9 + Math.exp(-(((d - 24) / 1.0) ** 2)) * 0.6;
    return [255, 255, 255, clamp(a) * 255];
  });
}

// vertical gradient for backdrops (top -> bottom), 4 x 64
export function gradientCanvas(top, bottom) {
  const a = rgb(top), b = rgb(bottom);
  return paint(4, 64, (x, y) => mix(a, b, y / 63));
}

export { mix as mixRGB, add as addRGB, mul as mulRGB };
