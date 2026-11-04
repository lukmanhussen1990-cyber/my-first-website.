// Procedural pixel-art textures (clothes, floors, walls, faces, icons).
// Every texture is drawn on a tiny canvas and sampled with NearestFilter, which gives the
// crisp "pixel" look requested for clothes / carpets / walls / eyes.
import * as THREE from 'three';
import { rng } from './util.js';

const cache = new Map();
let ANISO = 8;
export function setAniso(a) { ANISO = a; }

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (o.smooth) { t.magFilter = THREE.LinearFilter; }
  else { t.magFilter = THREE.NearestFilter; }
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = ANISO;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  if (o.wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

export function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

const C = (c) => new THREE.Color(c);
export function css(c, f = 1) {
  const k = C(c);
  const r = Math.max(0, Math.min(255, Math.round(k.r * 255 * f)));
  const g = Math.max(0, Math.min(255, Math.round(k.g * 255 * f)));
  const b = Math.max(0, Math.min(255, Math.round(k.b * 255 * f)));
  return `rgb(${r},${g},${b})`;
}

// --- pixel painter --------------------------------------------------------
export function painter(g) {
  const P = {
    px(x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
    rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    disc(cx, cy, rx, c, ry = rx) {
      g.fillStyle = c;
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
        }
    },
    ring(cx, cy, r, th, c) {
      g.fillStyle = c;
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r && d >= r - th) g.fillRect(x, y, 1, 1);
        }
    },
    line(x0, y0, x1, y1, c, th = 1) {
      g.fillStyle = c;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        g.fillRect(Math.round(x - th / 2), Math.round(y - th / 2), th, th);
      }
    },
    arc(cx, cy, rx, ry, a0, a1, c, th = 1) {
      g.fillStyle = c;
      const n = Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * 3) + 2;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        g.fillRect(Math.round(x - th / 2), Math.round(y - th / 2), th, th);
      }
    },
    poly(pts, c) {
      g.fillStyle = c;
      // scanline fill with pixel centers
      let minY = 1e9, maxY = -1e9;
      pts.forEach((p) => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
          if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
        }
      }
    },
  };
  return P;
}

// noise-dithered base fill (the "pixel fabric" look)
export function noiseFill(g, w, h, color, amp = 0.08, seed = 1, cells = 1) {
  const r = rng(seed);
  const base = C(color);
  for (let y = 0; y < h; y += cells)
    for (let x = 0; x < w; x += cells) {
      const f = 1 + (r() - 0.5) * 2 * amp;
      g.fillStyle = `rgb(${Math.min(255, base.r * 255 * f) | 0},${Math.min(255, base.g * 255 * f) | 0},${Math.min(255, base.b * 255 * f) | 0})`;
      g.fillRect(x, y, cells, cells);
    }
}

// --- generic surfaces -----------------------------------------------------
export function fabric(color, opt = {}) {
  const key = 'fab' + color + JSON.stringify(opt);
  return cached(key, () => canvasTex(16, 16, (g, w, h) => {
    noiseFill(g, w, h, color, opt.amp ?? 0.06, opt.seed ?? 3);
    const P = painter(g);
    if (opt.pattern === 'dots') for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) P.px(x, y, opt.c2);
    if (opt.pattern === 'stripes') for (let x = 0; x < 16; x += 4) P.rect(x, 0, 1, 16, opt.c2);
    if (opt.pattern === 'plaid') { for (let x = 0; x < 16; x += 8) P.rect(x, 0, 2, 16, opt.c2); for (let y = 0; y < 16; y += 8) P.rect(0, y, 16, 1, opt.c2); }
    if (opt.pattern === 'floral') for (let i = 0; i < 6; i++) { const x = (i * 5 + 2) % 16, y = (i * 7 + 3) % 16; P.px(x, y, opt.c2); P.px(x + 1, y, opt.c2); P.px(x, y + 1, opt.c2); P.px(x - 1, y, opt.c2); P.px(x, y - 1, opt.c2); P.px(x, y, '#fff6c0'); }
    if (opt.pattern === 'lace') for (let y = 0; y < 16; y += 2) for (let x = (y % 4) / 2; x < 16; x += 3) P.px(x, y, opt.c2);
    if (opt.wrinkle) { const r = rng(9); for (let i = 0; i < 5; i++) { const x = r() * 16, y = r() * 16; P.line(x, y, x + 3, y + 2, css(color, 0.72)); } }
  }, { wrap: true }));
}

export function legTex(pants, shoe) {
  return cached('leg' + pants + shoe, () => canvasTex(16, 32, (g) => {
    noiseFill(g, 16, 32, pants, 0.06, 5);
    noiseFill(g, 16, 1, pants, 0.0, 5);
    g.fillStyle = css(shoe); g.fillRect(0, 26, 16, 6);
    g.fillStyle = css(shoe, 1.5); g.fillRect(0, 26, 16, 1);
  }));
}

// torso front designs
export function torsoTex(kind, o = {}) {
  const key = 'torso' + kind + JSON.stringify(o);
  return cached(key, () => canvasTex(32, 32, (g) => {
    const P = painter(g);
    const base = o.base || '#444';
    noiseFill(g, 32, 32, base, 0.06, 11);
    if (kind === 'suit' || kind === 'groom' || kind === 'guard' || kind === 'messy') {
      const shirt = o.shirt || '#f4f4f0';
      P.poly([[10, 0], [22, 0], [16, 15]], shirt);
      // lapels
      P.line(9, 0, 16, 17, css(base, 0.6), 1);
      P.line(23, 0, 16, 17, css(base, 0.6), 1);
      P.line(8, 0, 13, 10, css(base, 1.35), 1);
      P.line(24, 0, 19, 10, css(base, 1.35), 1);
      if (kind === 'groom') {
        // bow tie + pocket square + boutonniere
        P.poly([[12, 2], [16, 4], [12, 6]], '#151515'); P.poly([[20, 2], [16, 4], [20, 6]], '#151515'); P.rect(15, 3, 2, 2, '#2a2a2a');
        P.rect(5, 9, 4, 2, '#ffffff'); P.px(6, 8, '#ffffff');
        P.disc(24.5, 9.5, 2, '#ff6f9a'); P.px(24, 9, '#ffd1e0'); P.px(26, 11, '#3a9a3a');
        P.px(16, 8, '#cfcfcf'); P.px(16, 12, '#cfcfcf');
      } else {
        const tie = o.tie || '#b0202a';
        const dx = o.crooked ? 2 : 0;
        P.poly([[15, 1], [17, 1], [17 + dx * 0.3, 3]], tie);
        P.poly([[15 + dx * 0.3, 3], [17 + dx * 0.4, 3], [18 + dx, 12], [16 + dx, 14], [14 + dx, 12]], tie);
        P.px(16 + dx, 6, css(tie, 1.3));
      }
      P.px(16, 20, css(base, 0.5)); P.px(16, 25, css(base, 0.5));
      if (o.wrinkled) {
        const r = rng(21);
        for (let i = 0; i < 12; i++) { const x = r() * 30, y = 14 + r() * 17; P.line(x, y, x + 2 + r() * 3, y + (r() - 0.5) * 3, css(base, 0.68)); }
        for (let i = 0; i < 6; i++) { const x = r() * 30, y = r() * 30; P.px(x, y, css(base, 1.3)); }
        P.rect(20, 22, 3, 2, css(base, 0.75)); // stain
        P.px(12, 15, '#eeeeee'); P.px(13, 16, '#eeeeee'); // untucked shirt bit
      }
      if (kind === 'guard') { P.rect(5, 10, 3, 1, '#2b2b2b'); }
    }
    if (kind === 'dress' || kind === 'bride' || kind === 'grandma') {
      const skin = o.skin || '#f2c9a0';
      if (kind !== 'grandma') {
        P.rect(0, 0, 32, 4, skin);
        P.disc(10, 4, 6, base, 2.4); P.disc(22, 4, 6, base, 2.4);
        P.rect(4, 5, 24, 2, base);
        P.rect(0, 0, 5, 9, skin); P.rect(27, 0, 5, 9, skin);
      }
      if (kind === 'bride') {
        const r = rng(4);
        for (let i = 0; i < 70; i++) P.px(r() * 32, 6 + r() * 26, r() > 0.5 ? '#e3e1ea' : '#fffbe8');
        for (let i = 0; i < 10; i++) P.px(r() * 32, 6 + r() * 26, '#fff2a8');
        P.rect(4, 24, 24, 3, '#f7d6df'); P.rect(15, 23, 3, 5, '#f2b8c8');
        P.disc(16, 2.5, 1.5, '#eef6ff'); // necklace pendant
      }
      if (kind === 'dress') {
        if (o.pattern === 'dots') for (let y = 10; y < 32; y += 4) for (let x = (y % 8 ? 2 : 0); x < 32; x += 4) P.px(x, y, o.c2);
        if (o.pattern === 'floral') for (let i = 0; i < 12; i++) { const x = (i * 11 + 3) % 30 + 1, y = 9 + (i * 7) % 22; P.px(x, y, o.c2); P.px(x + 1, y, o.c2); P.px(x - 1, y, o.c2); P.px(x, y + 1, o.c2); P.px(x, y - 1, o.c2); }
        P.rect(0, 24, 32, 2, css(base, 0.75));
        if (o.necklace) for (let x = 11; x <= 21; x += 2) P.px(x, 1 + Math.abs(x - 16) * -0.2 + 1.5, '#fff6dc');
      }
      if (kind === 'grandma') {
        P.poly([[10, 0], [22, 0], [16, 7]], '#f3efe6');
        for (let a = 0; a <= 10; a++) { const t = a / 10; P.px(10 + t * 12, 2 + Math.sin(t * Math.PI) * 5, '#fffaf0'); }
        for (let y = 11; y < 31; y += 5) P.px(16, y, '#e9d36a');
        P.line(16, 7, 16, 32, css(base, 0.7));
      }
    }
    if (kind === 'robe') {
      P.rect(12, 0, 8, 3, '#1d1d1d'); P.rect(15, 0, 2, 3, '#ffffff');
      P.rect(8, 2, 4, 30, '#d9a83a'); P.rect(20, 2, 4, 30, '#d9a83a');
      P.rect(8, 2, 1, 30, '#f2cf6a'); P.rect(20, 2, 1, 30, '#f2cf6a');
      P.rect(9, 22, 2, 6, '#8b1d2c'); P.rect(8, 24, 4, 2, '#8b1d2c');
      P.rect(21, 22, 2, 6, '#8b1d2c'); P.rect(20, 24, 4, 2, '#8b1d2c');
    }
  }));
}

// --- architecture ---------------------------------------------------------
export function woodFloor() {
  return cached('woodFloor', () => canvasTex(64, 64, (g) => {
    const r = rng(7); const P = painter(g);
    for (let row = 0; row < 8; row++) {
      const off = (row * 23) % 64;
      for (let k = 0; k < 2; k++) {
        const shade = 0.85 + r() * 0.3;
        const x0 = (off + k * 32) % 64;
        for (let x = 0; x < 32; x++) for (let y = 0; y < 8; y++) {
          const f = shade * (1 + (r() - 0.5) * 0.08) * (y === 0 ? 0.78 : 1);
          g.fillStyle = css('#a86b3d', f); g.fillRect((x0 + x) % 64, row * 8 + y, 1, 1);
        }
        g.fillStyle = css('#a86b3d', 0.55); g.fillRect(x0, row * 8, 1, 8);
        for (let i = 0; i < 4; i++) { const gx = (x0 + 2 + r() * 28) % 64, gy = row * 8 + 2 + r() * 5; P.rect(gx, gy, 3 + r() * 5, 1, css('#a86b3d', 0.75 * shade)); }
      }
    }
  }, { wrap: true }));
}
export function pewWood() {
  return cached('pewWood', () => canvasTex(32, 32, (g) => {
    const r = rng(17);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const band = Math.sin((y + Math.sin(x * 0.3) * 1.5) * 0.9) * 0.06;
      g.fillStyle = css('#9a5530', 1 + band + (r() - 0.5) * 0.08); g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = css('#9a5530', 1.25); g.fillRect(0, 0, 32, 1);
  }, { wrap: true }));
}
export function carpet() {
  return cached('carpet', () => canvasTex(32, 32, (g) => {
    const r = rng(5); const P = painter(g);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = (Math.abs(((x - 16 + 32) % 16) - 8) + Math.abs(((y + 32) % 16) - 8));
      let c = '#b0142c', f = 1 + (r() - 0.5) * 0.1;
      if (d === 6 || d === 7) f *= 0.8;
      if (d < 2) { c = '#e0a93b'; }
      g.fillStyle = css(c, f); g.fillRect(x, y, 1, 1);
    }
    P.rect(0, 0, 3, 32, '#d89b2e'); P.rect(29, 0, 3, 32, '#d89b2e');
    P.rect(1, 0, 1, 32, '#f3cd63'); P.rect(30, 0, 1, 32, '#f3cd63');
    for (let y = 0; y < 32; y += 4) { P.px(4, y + 1, '#d89b2e'); P.px(27, y + 1, '#d89b2e'); }
  }, { wrap: true }));
}
export function plaster() {
  return cached('plaster', () => canvasTex(64, 64, (g) => {
    const r = rng(33);
    noiseFill(g, 64, 64, '#f0dcbc', 0.04, 33);
    for (let row = 0; row < 4; row++) {
      const y = row * 16; g.fillStyle = css('#f0dcbc', 0.9); g.fillRect(0, y, 64, 1);
      const off = row % 2 ? 0 : 16;
      for (let x = off; x < 64; x += 32) g.fillRect(x, y, 1, 16);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = css('#f0dcbc', 1.05); g.fillRect(r() * 64, r() * 64, 2, 1); }
  }, { wrap: true }));
}
export function wainscot() {
  return cached('wainscot', () => canvasTex(32, 32, (g) => {
    noiseFill(g, 32, 32, '#6e3a20', 0.06, 8);
    const P = painter(g);
    P.rect(3, 4, 26, 24, css('#6e3a20', 1.18)); P.rect(4, 5, 24, 22, css('#6e3a20', 0.95));
    P.rect(3, 4, 26, 1, css('#6e3a20', 1.4)); P.rect(3, 27, 26, 1, css('#6e3a20', 0.6));
    P.rect(0, 0, 32, 2, css('#6e3a20', 1.3));
  }, { wrap: true }));
}
export function stone(color = '#d8c8a8', key = 'stone') {
  return cached(key + color, () => canvasTex(64, 64, (g) => {
    const r = rng(44);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 0 : 8;
      for (let k = -1; k < 4; k++) {
        const x0 = off + k * 16, f = 0.88 + r() * 0.2;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
          g.fillStyle = css(color, f * (1 + (r() - 0.5) * 0.07) * (y === 0 ? 1.08 : 1));
          g.fillRect(x0 + x, row * 8 + y, 1, 1);
        }
        g.fillStyle = css(color, 0.68); g.fillRect(x0, row * 8, 1, 8);
      }
      g.fillStyle = css(color, 0.68); g.fillRect(0, row * 8 + 7, 64, 1);
    }
  }, { wrap: true }));
}
export function paving() {
  return cached('paving', () => canvasTex(32, 32, (g) => {
    const r = rng(77);
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      const f = 0.86 + r() * 0.22;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = css('#c9c2b4', f * (1 + (r() - 0.5) * 0.06) * (x === 0 || y === 0 ? 0.72 : 1));
        g.fillRect(bx * 8 + x, by * 8 + y, 1, 1);
      }
    }
  }, { wrap: true }));
}
export function grassTex() {
  return cached('grass', () => canvasTex(32, 32, (g) => {
    noiseFill(g, 32, 32, '#5aa845', 0.12, 91);
    const r = rng(92); for (let i = 0; i < 30; i++) { g.fillStyle = css('#5aa845', 1.25); g.fillRect(r() * 32, r() * 32, 1, 2); }
  }, { wrap: true }));
}
export function leafTex(color = '#4f9a3c') {
  return cached('leaf' + color, () => canvasTex(16, 16, (g) => {
    noiseFill(g, 16, 16, color, 0.18, 12);
  }, { wrap: true }));
}
export function doorWood() {
  return cached('doorWood', () => canvasTex(32, 64, (g) => {
    const r = rng(3); const P = painter(g);
    for (let k = 0; k < 4; k++) {
      const f = 0.9 + r() * 0.18;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 8; x++) { g.fillStyle = css('#6a3518', f * (1 + (r() - 0.5) * 0.1)); g.fillRect(k * 8 + x, y, 1, 1); }
      P.rect(k * 8, 0, 1, 64, css('#6a3518', 0.55));
    }
    for (const y of [10, 50]) {
      P.rect(0, y, 32, 3, '#2d2a28'); P.rect(0, y, 32, 1, '#5d5853');
      for (let x = 2; x < 32; x += 5) P.px(x, y + 1, '#9c958c');
    }
    P.rect(26, 30, 3, 5, '#c9a040'); P.px(27, 31, '#ffe08a');
  }));
}
export function stainedGlass(seed) {
  return cached('glass' + seed, () => canvasTex(32, 64, (g, w, h) => {
    const r = rng(seed);
    const pal = [['#e8364b', '#3a6fe0', '#f2c335', '#3fbf6a', '#9a4ee8', '#ff8a3a'], ['#3a6fe0', '#46c3f0', '#f2c335', '#e8364b'], ['#9a4ee8', '#e8364b', '#f2c335', '#2fbfa0', '#ff7fb0']][seed % 3];
    g.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inArch = y >= 16 ? true : Math.hypot(x + 0.5 - 16, y + 0.5 - 16) <= 16;
      if (!inArch) continue;
      const u = Math.floor((x + y) / 6), v = Math.floor((x - y + 64) / 6);
      const lead = (x + y) % 6 === 0 || (x - y + 64) % 6 === 0;
      const edge = x < 2 || x > 29 || y > 61 || (y < 16 && Math.hypot(x + 0.5 - 16, y + 0.5 - 16) > 14);
      if (edge) { g.fillStyle = '#3a2d24'; }
      else if (lead) { g.fillStyle = '#20160f'; }
      else { const c = pal[(u * 7 + v * 3 + seed) % pal.length]; g.fillStyle = css(c, 0.9 + ((u * 13 + v * 5) % 5) * 0.06); }
      g.fillRect(x, y, 1, 1);
    }
    // central figure: a heart / flower motif
    const P = painter(g);
    P.disc(16, 30, 5, '#fff1b0'); P.disc(16, 30, 3, '#ffd23a');
    for (let a = 0; a < 6; a++) P.disc(16 + Math.cos(a) * 6, 30 + Math.sin(a) * 6, 2, '#ff5c7a');
  }));
}
export function roseWindow() {
  return cached('rose', () => canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    const pal = ['#e8364b', '#3a6fe0', '#f2c335', '#9a4ee8', '#3fbf6a', '#ff8a3a'];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = x + 0.5 - 32, dy = y + 0.5 - 32; const d = Math.hypot(dx, dy);
      if (d > 31) continue;
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      const ring = Math.floor(d / 6); const petal = Math.floor(a * 12 + (ring % 2) * 0.5);
      let c;
      if (d > 29) c = '#3a2d24';
      else if (d % 6 < 1 || Math.abs(((a * 12 + (ring % 2) * 0.5) % 1) - 0.5) > 0.46) c = '#20160f';
      else if (d < 5) c = '#fff1b0';
      else c = pal[(petal + ring * 2) % pal.length];
      g.fillStyle = c; g.fillRect(x, y, 1, 1);
    }
  }));
}
export function skyTex(top = '#3f86df', mid = '#9fd0f5', low = '#ffd9a8') {
  return cached('sky' + top + mid + low, () => canvasTex(4, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(0.8, low); gr.addColorStop(1, '#ffe7c4');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  }, { smooth: true }));
}
export function shaftTex() {
  return cached('shaft', () => canvasTex(64, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    const gx = g.createLinearGradient(0, 0, 64, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.25, 'rgba(0,0,0,0)'); gx.addColorStop(0.75, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 64, 128);
  }, { smooth: true }));
}
export function glowTex() {
  return cached('glow', () => canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,180,0.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { smooth: true }));
}
export function blobShadowTex() {
  return cached('blob', () => canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { smooth: true }));
}
export function fanTex() {
  return cached('fan', () => canvasTex(32, 16, (g) => {
    for (let x = 0; x < 32; x++) { g.fillStyle = (x >> 2) % 2 ? '#e24a8c' : '#ffd0e4'; g.fillRect(x, 0, 1, 16); }
    g.fillStyle = '#7a1b45'; g.fillRect(0, 15, 32, 1);
  }));
}
export function bibleTex() {
  return cached('bible', () => canvasTex(16, 16, (g) => {
    noiseFill(g, 16, 16, '#5a1a1a', 0.08, 2);
    g.fillStyle = '#e6c04a'; g.fillRect(7, 3, 2, 10); g.fillRect(4, 6, 8, 2);
    g.fillStyle = '#e6c04a'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  }));
}

// --- faces ----------------------------------------------------------------
// spec: {skin, eyes, mouth, brows, blush, tears, sweat, glasses, lips, green, lashes, look:[dx,dy], moustache}
export function faceTex(spec) {
  const key = 'face' + JSON.stringify(spec);
  return cached(key, () => canvasTex(48, 48, (g) => drawFace(g, spec)));
}

const INK = '#1b1414';
function drawFace(g, s) {
  const P = painter(g);
  let skin = s.skin || '#f2c9a0';
  if (s.green) { const k = C(skin).lerp(C('#8fd16a'), s.green); skin = '#' + k.getHexString(); }
  noiseFill(g, 48, 48, skin, 0.025, 61);
  const L = [16, 22], R = [32, 22];
  const look = s.look || [0, 0];
  const lx = look[0], ly = look[1];
  // blush
  if (s.blush) { P.rect(9, 28, 6, 2, '#f59aa8'); P.rect(33, 28, 6, 2, '#f59aa8'); P.rect(10, 27, 4, 1, '#f7b3bd'); P.rect(34, 27, 4, 1, '#f7b3bd'); }
  // eyes
  const eye = (c, side) => {
    const [cx, cy] = c;
    switch (s.eyes) {
      case 'pretty':
        P.disc(cx + lx, cy + ly, 2.7, INK, 3.4);
        P.px(cx - 1 + lx, cy - 2 + ly, '#fff'); P.px(cx + 1 + lx, cy + 1 + ly, '#9ab0ff');
        P.line(cx + side * 2.5, cy - 3, cx + side * 4.5, cy - 5, INK, 1);
        P.line(cx + side * 3, cy - 1.5, cx + side * 5, cy - 2.5, INK, 1);
        break;
      case 'wide':
        P.disc(cx, cy, 4.6, INK); P.disc(cx, cy, 3.7, '#ffffff');
        P.disc(cx + lx, cy + ly, 1.8, INK); P.px(cx - 1 + lx, cy - 1 + ly, '#fff');
        break;
      case 'crazy': {
        const r = side < 0 ? 6.2 : 5.2;
        P.disc(cx, cy - 1, r, INK); P.disc(cx, cy - 1, r - 1, '#ffffff');
        P.px(cx + side * 4, cy - 1, '#ff7a7a'); P.px(cx + side * 3, cy + 2, '#ff9a9a');
        const px = side < 0 ? cx - 1.2 : cx + 1.6, py = side < 0 ? cy - 2.2 : cy + 0.2;
        P.disc(px, py, 2.1, INK); P.px(px - 1, py - 1, '#ffffff');
        break;
      }
      case 'swirl':
        P.disc(cx, cy, 5.2, INK); P.disc(cx, cy, 4.3, '#ffffff');
        for (let a = 0; a < Math.PI * 5; a += 0.15) { const rr = a / (Math.PI * 5) * 4; P.px(cx - 0.5 + Math.cos(a + side) * rr, cy - 0.5 + Math.sin(a + side) * rr, INK); }
        break;
      case 'happy': P.arc(cx, cy + 1.5, 3.2, 3, Math.PI * 1.05, Math.PI * 1.95, INK, 2); break;
      case 'closed': P.arc(cx, cy - 1, 3.2, 2.5, Math.PI * 0.1, Math.PI * 0.9, INK, 1); break;
      case 'squint':
        P.line(cx - side * 3, cy - 3, cx + side * 2, cy, INK, 2); P.line(cx + side * 2, cy, cx - side * 3, cy + 3, INK, 2);
        break;
      case 'heart':
        P.disc(cx - 1.6, cy - 1, 2, '#ff3d7f'); P.disc(cx + 1.6, cy - 1, 2, '#ff3d7f');
        P.poly([[cx - 3.6, cy - 0.5], [cx + 3.6, cy - 0.5], [cx, cy + 3.8]], '#ff3d7f'); P.px(cx - 2, cy - 2, '#ffd0e0');
        break;
      case 'x':
        P.line(cx - 2.5, cy - 2.5, cx + 2.5, cy + 2.5, INK, 2); P.line(cx + 2.5, cy - 2.5, cx - 2.5, cy + 2.5, INK, 2);
        break;
      case 'none': break;
      case 'teary':
        P.disc(cx, cy, 4.2, INK); P.disc(cx, cy, 3.4, '#ffffff');
        P.disc(cx + lx, cy + 0.5 + ly, 2, INK); P.px(cx - 1, cy - 1, '#fff'); P.px(cx + 1, cy + 1, '#fff');
        P.rect(cx - 3, cy + 3, 6, 1, '#7fd0ff');
        break;
      default: // dot
        P.disc(cx + lx, cy + ly, 2.2, INK, 2.8); P.px(cx - 1 + lx, cy - 2 + ly, '#ffffff');
    }
  };
  eye(L, -1); eye(R, 1);
  // brows
  const b = s.brows;
  if (b === 'raised') { P.arc(16, 15, 4, 2, Math.PI * 1.1, Math.PI * 1.9, INK, 1); P.arc(32, 15, 4, 2, Math.PI * 1.1, Math.PI * 1.9, INK, 1); }
  if (b === 'high') { P.arc(16, 12, 4, 2, Math.PI * 1.1, Math.PI * 1.9, INK, 2); P.arc(32, 12, 4, 2, Math.PI * 1.1, Math.PI * 1.9, INK, 2); }
  if (b === 'angry') { P.line(12, 14, 19, 17, INK, 2); P.line(36, 14, 29, 17, INK, 2); }
  if (b === 'worried') { P.line(12, 17, 19, 14, INK, 2); P.line(36, 17, 29, 14, INK, 2); }
  if (b === 'crazy') { P.line(9, 12, 19, 9, INK, 2); P.line(29, 14, 37, 15, INK, 2); }
  if (b === 'proud') { P.line(12, 15, 20, 14, INK, 2); P.line(28, 14, 36, 15, INK, 2); }
  if (b === 'thick') { P.rect(11, 15, 9, 2, INK); P.rect(28, 15, 9, 2, INK); }
  // glasses
  if (s.glasses === 'round') { P.ring(16, 22, 6, 1, '#5a3a1a'); P.ring(32, 22, 6, 1, '#5a3a1a'); P.rect(22, 21, 4, 1, '#5a3a1a'); P.px(12, 18, '#ffffff'); P.px(28, 18, '#ffffff'); }
  if (s.glasses === 'square') { const c = '#7a3a12'; P.rect(9, 17, 14, 1, c); P.rect(9, 27, 14, 1, c); P.rect(9, 17, 1, 11, c); P.rect(22, 17, 1, 11, c); P.rect(25, 17, 14, 1, c); P.rect(25, 27, 14, 1, c); P.rect(25, 17, 1, 11, c); P.rect(38, 17, 1, 11, c); P.rect(23, 20, 2, 1, c); P.rect(11, 19, 2, 1, '#fff'); P.rect(27, 19, 2, 1, '#fff'); }
  // mouth
  const lip = s.lips || INK;
  const mouthDark = '#4a0f1c';
  switch (s.mouth) {
    case 'smile': P.arc(24, 29, 5, 3.5, Math.PI * 0.15, Math.PI * 0.85, lip, 2); break;
    case 'smallsmile': P.arc(24, 30, 3.5, 2.5, Math.PI * 0.15, Math.PI * 0.85, lip, 1); break;
    case 'pretty': P.arc(24, 30, 4, 2.8, Math.PI * 0.12, Math.PI * 0.88, '#d2435f', 2); P.px(24, 33, '#f08aa0'); break;
    case 'creepy': {
      P.poly([[9, 29], [39, 29], [35, 37], [24, 40], [13, 37]], INK);
      P.poly([[10.5, 30], [37.5, 30], [34, 36], [24, 38.6], [14, 36]], '#fffef2');
      for (let x = 13; x <= 35; x += 3) P.rect(x, 30, 1, 8, '#b9b3a2');
      P.rect(10, 33, 28, 1, '#b9b3a2');
      P.line(8, 29, 6, 26, INK, 2); P.line(40, 29, 42, 26, INK, 2);
      break;
    }
    case 'grin': P.poly([[15, 28], [33, 28], [30, 34], [24, 36], [18, 34]], INK); P.poly([[16.5, 29], [31.5, 29], [29, 33], [24, 34.5], [19, 33]], '#fffef2'); break;
    case 'laugh': {
      P.disc(24, 30, 9, INK, 8); P.rect(14, 22, 20, 8, skin);
      P.disc(24, 30, 7.6, mouthDark, 6.6); P.rect(15, 23, 18, 7, skin);
      P.rect(15, 29, 18, 1, INK);
      P.rect(17, 30, 14, 2, '#ffffff');
      P.disc(24, 35, 4, '#ff7a8c', 1.8);
      break;
    }
    case 'o': P.disc(24, 32, 3, INK, 3.4); P.disc(24, 32, 1.8, mouthDark, 2.2); break;
    case 'gasp': P.disc(24, 33, 3.6, INK, 4.6); P.disc(24, 33, 2.6, mouthDark, 3.6); P.disc(24, 35.5, 1.6, '#ff7a8c', 0.9); break;
    case 'scream': P.disc(24, 34, 5, INK, 7); P.disc(24, 34, 4, mouthDark, 6); P.disc(24, 38, 2.5, '#ff7a8c', 1.4); P.rect(20, 28, 8, 1, '#ffffff'); break;
    case 'flat': P.rect(18, 31, 12, 2, INK); break;
    case 'smug': P.line(18, 31, 27, 31.5, INK, 2); P.line(27, 31.5, 31, 28.5, INK, 2); break;
    case 'frown': P.arc(24, 34, 4.5, 3, Math.PI * 1.15, Math.PI * 1.85, INK, 2); break;
    case 'wavy': for (let x = 16; x <= 32; x++) P.rect(x, 31 + Math.round(Math.sin((x - 16) * 0.9) * 1.2), 1, 2, INK); break;
    case 'drop': P.disc(24, 38, 6, INK, 10); P.disc(24, 38, 5, mouthDark, 9); P.disc(24, 44, 3.5, '#ff7a8c', 2.2); P.rect(19, 29, 10, 1, '#ffffff'); break;
    case 'grit': P.rect(15, 28, 18, 7, INK); P.rect(16, 29, 16, 5, '#ffffff'); P.rect(16, 31, 16, 1, '#9a9a9a'); for (let x = 19; x < 32; x += 3) P.rect(x, 29, 1, 5, '#9a9a9a'); break;
    case 'none': break;
    default: P.arc(24, 29, 5, 3.5, Math.PI * 0.15, Math.PI * 0.85, lip, 2);
  }
  if (s.moustache) { P.rect(17, 26, 14, 3, s.moustache); P.rect(15, 27, 2, 2, s.moustache); P.rect(31, 27, 2, 2, s.moustache); }
  if (s.tears) {
    for (const [cx] of [L, R]) {
      P.rect(cx - 2, 26, 4, 22, '#5bc4ff'); P.rect(cx - 1, 26, 1, 22, '#c9f0ff');
      P.rect(cx - 3, 26, 6, 2, '#5bc4ff');
    }
  }
  if (s.sweat) { P.disc(41, 11, 2.3, '#5bc4ff', 3); P.poly([[39, 10], [43, 10], [41, 5]], '#5bc4ff'); P.px(40, 10, '#e5f8ff'); }
  if (s.cheekLines) { P.line(6, 32, 9, 30, INK, 1); P.line(42, 32, 39, 30, INK, 1); }
}

// --- icons (sprites) ------------------------------------------------------
export function iconTex(kind, frame = 0) {
  return cached('icon' + kind + frame, () => {
    if (kind === 'drop' || kind === 'tear') {
      return canvasTex(12, 16, (g) => {
        const P = painter(g);
        const fill = kind === 'drop' ? '#47b4ff' : '#8fdcff';
        P.disc(6, 10.5, 5.2, '#14407a', 5.2); P.poly([[1.2, 9.5], [10.8, 9.5], [6, 0]], '#14407a');
        P.disc(6, 10.5, 4.2, fill, 4.2); P.poly([[2.2, 9.6], [9.8, 9.6], [6, 2]], fill);
        P.rect(3, 9, 2, 3, '#ffffff'); P.px(4, 7, '#ffffff');
      });
    }
    if (kind === 'heart') {
      return canvasTex(14, 13, (g) => {
        const P = painter(g);
        const H = (o, c) => { P.disc(4, 4.5, 3.6 + o, c); P.disc(10, 4.5, 3.6 + o, c); P.poly([[0.6 - o, 5.4], [13.4 + o, 5.4], [7, 12.4 + o]], c); };
        H(0.9, '#8e0f3c'); H(0, '#ff4f97');
        P.rect(3, 3, 2, 2, '#ffd3e6');
      });
    }
    if (kind === 'sparkle') {
      return canvasTex(11, 11, (g) => {
        const P = painter(g);
        P.rect(5, 0, 1, 11, '#fff7c0'); P.rect(0, 5, 11, 1, '#fff7c0');
        P.rect(4, 3, 3, 5, '#ffffff'); P.rect(3, 4, 5, 3, '#ffffff'); P.px(5, 5, '#ffe36a');
      });
    }
    if (kind === 'swirl') {
      return canvasTex(32, 32, (g) => {
        const P = painter(g);
        for (let a = 0; a < Math.PI * 6; a += 0.04) { const r = 1 + a * 0.75; P.rect(16 + Math.cos(a) * r - 1.5, 16 + Math.sin(a) * r - 1.5, 4, 4, '#2a0f4a'); }
        for (let a = 0; a < Math.PI * 6; a += 0.04) { const r = 1 + a * 0.75; P.rect(16 + Math.cos(a) * r - 0.5, 16 + Math.sin(a) * r - 0.5, 2, 2, a % 2 < 1 ? '#c27bff' : '#ffffff'); }
      });
    }
    if (kind === 'stink') {
      return canvasTex(14, 40, (g) => {
        const P = painter(g);
        const pts = [];
        for (let y = 2; y < 38; y += 0.5) pts.push([7 + Math.sin(y * 0.35 + frame * Math.PI * 0.5) * 3.2, y]);
        pts.forEach(([x, y]) => P.rect(x - 2, y - 1, 4, 3, '#1f5a12'));
        pts.forEach(([x, y]) => P.rect(x - 1, y, 2, 1, y < 8 ? '#b8ff7a' : '#78e040'));
      });
    }
    if (kind === 'dust') {
      return canvasTex(24, 16, (g) => {
        const P = painter(g);
        [[6, 10, 5], [12, 7, 6], [18, 10, 5]].forEach(([x, y, r]) => P.disc(x, y, r + 1, '#6d625a'));
        [[6, 10, 5], [12, 7, 6], [18, 10, 5]].forEach(([x, y, r]) => P.disc(x, y, r, '#e8e0d4'));
        P.rect(9, 4, 3, 2, '#ffffff');
      });
    }
    if (kind === 'flame') {
      return canvasTex(8, 12, (g) => {
        const P = painter(g);
        P.disc(4, 8, 3.2, '#ff9a2a', 3.8); P.poly([[1, 7], [7, 7], [4, 0]], '#ff9a2a');
        P.disc(4, 8.5, 1.8, '#fff2a0', 2.5);
      });
    }
    return null;
  });
}
