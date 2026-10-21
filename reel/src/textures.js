// Procedural PBR texture generators (all made by code, deterministic).
import * as THREE from 'three';
import { rng, fbm, vnoise, hash2, canvas, pixels, normalFromHeight, tex, clamp01, mix, mixc, sstep } from './util.js';

const cache = {};
const memo = (k, f) => (cache[k] ??= f());

function heightCanvas(w, h, fn) {
  const hg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hg[y * w + x] = fn(x, y);
  return hg;
}

// ---------------- wood ----------------
export function wood(seed = 1, base = [176, 118, 66], opts = {}) {
  return memo('wood' + seed + base.join(), () => {
    const W = 512, H = 512;
    const hg = new Float32Array(W * H);
    const col = pixels(W, H, (x, y) => {
      const u = x / W, v = y / H;
      const warp = fbm(u * 4, v * 1, 4, 4, seed) * 2.2;
      const ring = Math.sin((v * 28 + warp * 6) * Math.PI);
      const fine = fbm(u * 64, v * 4, 64, 3, seed + 5);
      const g = 0.5 + 0.5 * ring;
      const knot = sstep(0.82, 0.95, fbm(u * 3, v * 3, 3, 3, seed + 9));
      const t = clamp01(0.55 * g + 0.35 * fine + 0.25 * knot);
      hg[y * W + x] = 0.6 * g + 0.4 * fine;
      const dark = [base[0] * 0.62, base[1] * 0.55, base[2] * 0.5];
      const c = mixc(base, dark, t);
      return c.map((q) => Math.min(255, q));
    });
    const nrm = normalFromHeight(hg, W, H, 1.6);
    const rough = pixels(W, H, (x, y) => { const r = 150 + hg[y * W + x] * 70; return [r, r, r]; });
    return { map: tex(col), normalMap: tex(nrm, { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
  });
}

// ---------------- soil cross-section ----------------
// Texture covers 8 units wide x 9 units deep. v=0 is the lawn surface.
export function soil() {
  return memo('soil', () => {
    const W = 2048, H = 2304;
    const PX = W / 8; // pixels per unit
    const R = rng(77);
    const hg = new Float32Array(W * H);
    const layer = (u, depth) => {
      // returns layer index & blend using wavy boundaries
      const wob = (k) => (fbm(u * 3, k, 3, 3, 40 + k * 3) - 0.5) * 0.35;
      return [0.09 + wob(1) * 0.2, 0.95 + wob(2), 1.95 + wob(3), 2.45 + wob(4), 4.1 + wob(5) * 1.5];
    };
    const cols = [
      [46, 34, 24],   // turf / root mat
      [62, 42, 29],   // topsoil
      [98, 66, 42],   // subsoil
      [124, 80, 52],  // clay
      [104, 94, 82],  // gravel
      [78, 74, 72],   // bedrock
    ];
    const bounds = []; for (let x = 0; x < W; x++) bounds.push(layer(x / W, 0));
    const streakW = []; for (let x = 0; x < W; x++) streakW.push(fbm(x / W * 8, 0.5, 8, 3, 21) * 6);
    const cv = pixels(W, H, (x, y) => {
      const u = x / W * 8; // world units across
      const d = y / PX;     // depth in units
      const b = bounds[x];
      let li = 0; for (let i = 0; i < b.length; i++) if (d > b[i]) li = i + 1;
      const n = fbm(x / W * 32, y / H * 36, 32, 4, 3);
      const n2 = fbm(x / W * 160, y / H * 180, 160, 2, 8);
      let c = cols[li];
      // soft blend near boundaries
      for (let i = 0; i < b.length; i++) {
        const e = d - b[i];
        if (Math.abs(e) < 0.05) c = mixc(cols[i], cols[i + 1], sstep(-0.05, 0.05, e));
      }
      const shade = 0.78 + 0.34 * n + 0.18 * (n2 - 0.5);
      let out = [c[0] * shade, c[1] * shade, c[2] * shade];
      // strata streaks
      const streak = Math.sin((d * 22 + streakW[x] + d * 0.7)) * 0.5 + 0.5;
      out = mixc(out, [out[0] * 0.86, out[1] * 0.86, out[2] * 0.86], streak * 0.35 * (li >= 2 ? 1 : 0.4));
      hg[y * W + x] = n * 0.6 + n2 * 0.4;
      // deeper = slightly darker
      const dk = 1 - Math.min(0.35, d * 0.035);
      return [out[0] * dk, out[1] * dk, out[2] * dk];
    });
    const ctx = cv.getContext('2d');
    // pebbles and stones
    const stone = (cx, cy, rx, ry, rot, base) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      const n = 9; const pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const j = 0.72 + R() * 0.38; pts.push([Math.cos(a) * rx * j, Math.sin(a) * ry * j]); }
      const path = () => { ctx.beginPath(); pts.forEach(([x, y], k) => { const [x2, y2] = pts[(k + 1) % n]; const mx = (x + x2) / 2, my = (y + y2) / 2; if (k === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(x, y, mx, my); }); const [x0, y0] = pts[0]; const [x1, y1] = pts[1]; ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); ctx.closePath(); };
      // dark contact rim
      ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.save(); ctx.scale(1.12, 1.12); path(); ctx.fill(); ctx.restore();
      const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
      g.addColorStop(0, `rgb(${base[0] + 22},${base[1] + 20},${base[2] + 18})`);
      g.addColorStop(1, `rgb(${base[0] * 0.62 | 0},${base[1] * 0.62 | 0},${base[2] * 0.62 | 0})`);
      ctx.fillStyle = g; path(); ctx.fill();
      ctx.restore();
      const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
      const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry; const q = 1 - (dx * dx + dy * dy);
        if (q > 0) hg[yy * W + xx] += Math.sqrt(q) * 1.2;
      }
    };
    for (let i = 0; i < 1400; i++) {
      const cx = R() * W, depth = Math.pow(R(), 0.75) * 9;
      const cy = depth * PX;
      if (depth < 0.15) continue;
      const big = depth > 2.3 ? 1.5 : 0.9;
      const s = (3 + R() * 9) * big * (R() < 0.06 ? 2.6 : 1);
      const g = 80 + R() * 70;
      const base = depth > 3.9 ? [g * 0.92, g * 0.9, g * 0.88] : [g, g * 0.84, g * 0.7];
      stone(cx, cy, s * (0.8 + R() * 0.6), s * (0.55 + R() * 0.4), R() * 3, base.map(Math.floor));
    }
    // fine roots in the top layer only (thin, dark, branching)
    ctx.lineCap = 'round';
    const root = (x, y, w, len, depthMax) => {
      ctx.strokeStyle = `rgba(${120 + R() * 30},${88 + R() * 20},${58 + R() * 15},${0.35 + R() * 0.25})`;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y);
      let ang = Math.PI / 2 + (R() - 0.5) * 0.8;
      for (let k = 0; k < len; k++) {
        ang += (R() - 0.5) * 0.5; x += Math.cos(ang) * 3; y += Math.sin(ang) * 3;
        ctx.lineTo(x, y);
        if (y > depthMax) break;
        if (R() < 0.04 && w > 0.8) { ctx.stroke(); root(x, y, w * 0.6, len * 0.4, depthMax); ctx.beginPath(); ctx.moveTo(x, y); }
      }
      ctx.stroke();
    };
    for (let i = 0; i < 70; i++) root(R() * W, 0.05 * PX + R() * 4, 0.8 + R() * 1.4, 20 + R() * 30, (0.35 + R() * 0.5) * PX);
    // bedrock cracks
    ctx.strokeStyle = 'rgba(30,26,24,0.55)';
    for (let i = 0; i < 40; i++) {
      let x = R() * W, y = (4.3 + R() * 4.5) * PX;
      ctx.lineWidth = 1 + R() * 2.5; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 12; k++) { x += (R() - 0.5) * 40; y += (R() - 0.3) * 25; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const nrm = normalFromHeight(hg, W, H, 3.0);
    const rough = pixels(512, 576, (x, y) => { const v = 205 + (hg[(y * 4) * W + x * 4] - 0.5) * 40; return [v, v, v]; });
    return { map: tex(cv), normalMap: tex(nrm, { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
  });
}

// ---------------- lawn base ----------------
export function lawn() {
  return memo('lawn', () => {
    const W = 1024;
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const u = x / W, v = y / W;
      const n = fbm(u * 24, v * 24, 24, 4, 11);
      const n2 = fbm(u * 128, v * 128, 128, 2, 12);
      const clover = sstep(0.72, 0.8, fbm(u * 10, v * 10, 10, 3, 13));
      hg[y * W + x] = n2;
      let col = mixc([58, 112, 36], [96, 150, 50], n);
      col = mixc(col, [70, 128, 44], clover * 0.6);
      col = mixc(col, [40, 80, 26], (1 - n2) * 0.35);
      return col;
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 2.5), { srgb: false }) };
  });
}

// ---------------- stucco ----------------
export function stucco(base = [226, 205, 168], seed = 3) {
  return memo('stucco' + base.join() + seed, () => {
    const W = 512;
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const n = fbm(x / W * 16, y / W * 16, 16, 4, seed);
      const n2 = fbm(x / W * 96, y / W * 96, 96, 2, seed + 1);
      hg[y * W + x] = n2 * 0.7 + n * 0.3;
      const s = 0.9 + 0.12 * n + 0.06 * (n2 - 0.5);
      return [base[0] * s, base[1] * s, base[2] * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 1.8), { srgb: false }) };
  });
}

// ---------------- roof shingles ----------------
export function shingles(base = [92, 72, 64]) {
  return memo('shingles' + base.join(), () => {
    const W = 1024, rows = 16, cols = 10;
    const R = rng(5);
    const hg = new Float32Array(W * W);
    const tint = [];
    for (let i = 0; i < rows * cols * 2; i++) tint.push(0.8 + R() * 0.35);
    const c = pixels(W, W, (x, y) => {
      const v = y / W * rows; const row = Math.floor(v); const fv = v - row;
      const off = (row % 2) * 0.5;
      const u = x / W * cols + off; const colI = Math.floor(u); const fu = u - colI;
      const t = tint[(row * cols + (colI % cols)) % tint.length];
      const edge = Math.min(fu, 1 - fu) * 6;
      const n = fbm(x / W * 64, y / W * 64, 64, 3, 6);
      const h = fv * 0.8 + n * 0.2 - (edge < 0.25 ? 0.4 : 0);
      hg[y * W + x] = h;
      const s = t * (0.72 + 0.4 * fv) * (0.9 + 0.2 * n) * (edge < 0.25 ? 0.55 : 1);
      return [base[0] * s, base[1] * s, base[2] * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 3), { srgb: false }) };
  });
}

// ---------------- floor planks ----------------
export function planks() {
  return memo('planks', () => {
    const W = 1024, N = 8;
    const R = rng(9);
    const tones = []; for (let i = 0; i < 64; i++) tones.push(0.8 + R() * 0.3);
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const u = x / W * N; const pi = Math.floor(u); const fu = u - pi;
      const seg = Math.floor(y / W * 2 + (pi % 3) * 0.33);
      const tone = tones[(pi * 7 + seg * 13) % 64];
      const grain = Math.sin((fu * 6 + fbm(x / W * 4, y / W * 16, 4, 4, 2 + pi) * 5) * Math.PI * 2) * 0.5 + 0.5;
      const n = fbm(x / W * 32, y / W * 128, 32, 3, 30);
      const gap = fu < 0.025 || fu > 0.975 || Math.abs(((y / W * 2 + (pi % 3) * 0.33) % 1)) < 0.006;
      hg[y * W + x] = gap ? 0 : 0.6 + grain * 0.2 + n * 0.2;
      const s = tone * (0.85 + 0.15 * grain) * (0.9 + 0.2 * n) * (gap ? 0.45 : 1);
      return [196 * s, 140 * s, 92 * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 2), { srgb: false }) };
  });
}

// ---------------- wallpaper ----------------
export function wallpaper() {
  return memo('wallpaper', () => {
    const W = 512;
    const c = pixels(W, W, (x, y) => {
      const u = x / W * 8, v = y / W * 8;
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      const stripe = Math.abs(fu - 0.5) < 0.05 ? 1 : 0;
      const dx = fu - 0.5, dy = ((fv + 0.5) % 1) - 0.5;
      const dia = Math.abs(dx) + Math.abs(dy) < 0.12 ? 1 : 0;
      const n = fbm(x / W * 8, y / W * 8, 8, 3, 44);
      const base = [236, 222, 196];
      const s = 0.96 + 0.06 * n;
      let col = [base[0] * s, base[1] * s, base[2] * s];
      if (stripe) col = mixc(col, [214, 190, 160], 0.6);
      if (dia) col = mixc(col, [190, 120, 100], 0.55);
      return col;
    });
    return { map: tex(c) };
  });
}

// ---------------- brushed metal ----------------
export function brushed() {
  return memo('brushed', () => {
    const W = 512;
    const hg = new Float32Array(W * W);
    const r = pixels(W, W, (x, y) => {
      const n = fbm(x / W * 2, y / W * 256, 2, 3, 70);
      hg[y * W + x] = n;
      const v = 80 + n * 90; return [v, v, v];
    });
    return { roughnessMap: tex(r, { srgb: false }), normalMap: tex(normalFromHeight(hg, W, W, 0.7), { srgb: false }) };
  });
}

// ---------------- copper wire windings ----------------
export function copperWire() {
  return memo('copperWire', () => {
    const W = 256;
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const v = y / W * 24; const f = v - Math.floor(v);
      const h = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
      hg[y * W + x] = h;
      const n = fbm(x / W * 8, y / W * 8, 8, 3, 90);
      const s = 0.75 + 0.3 * h + 0.1 * n;
      return [232 * s, 128 * s, 76 * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 4), { srgb: false }) };
  });
}

// ---------------- knit fabric ----------------
export function knit(base, seed = 1) {
  return memo('knit' + base.join() + seed, () => {
    const W = 256;
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const u = x / W * 16, v = y / W * 24;
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      const vshape = Math.abs(fu - 0.5) * 2; // V stitches
      const st = Math.sin((fv + vshape * 0.5) * Math.PI * 2) * 0.5 + 0.5;
      const n = fbm(x / W * 32, y / W * 32, 32, 2, seed);
      const h = st * 0.7 + n * 0.3 - (fu < 0.06 || fu > 0.94 ? 0.3 : 0);
      hg[y * W + x] = h;
      const s = 0.82 + 0.25 * h;
      return [base[0] * s, base[1] * s, base[2] * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, 2.4), { srgb: false }) };
  });
}

// ---------------- generic noise (rubber, concrete, asphalt, bark, hair) ----------------
export function noiseTex(name, base, scale = 16, contrast = 0.2, nstr = 1.5, size = 256, streak = 1) {
  return memo('noise' + name, () => {
    const W = size;
    const hg = new Float32Array(W * W);
    const c = pixels(W, W, (x, y) => {
      const n = fbm(x / W * scale, y / W * scale * streak, scale, 4, name.length * 13 + 1);
      hg[y * W + x] = n;
      const s = 1 - contrast + 2 * contrast * n;
      return [base[0] * s, base[1] * s, base[2] * s];
    });
    return { map: tex(c), normalMap: tex(normalFromHeight(hg, W, W, nstr), { srgb: false }) };
  });
}

// ---------------- sprites ----------------
export function puff() {
  return memo('puff', () => {
    const W = 256;
    const c = pixels(W, W, (x, y) => {
      const dx = x / W - 0.5, dy = y / W - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const n = fbm(x / W * 6, y / W * 6, 6, 5, 123);
      const a = clamp01((1 - r * (0.8 + 0.5 * n)) * 1.6) ** 1.5;
      const s = 200 + n * 55;
      return [s, s, s, a * 255];
    });
    const t = tex(c, { srgb: true });
    return t;
  });
}
export function glowSprite() {
  return memo('glow', () => {
    const W = 128;
    const c = pixels(W, W, (x, y) => {
      const r = Math.hypot(x / W - 0.5, y / W - 0.5) * 2;
      const a = Math.exp(-r * r * 5) * 0.9 + Math.exp(-r * 18) * 0.6;
      return [255, 255, 255, clamp01(a) * 255];
    });
    return tex(c, { srgb: true });
  });
}
export function streakSprite() {
  return memo('streak', () => {
    const c = pixels(16, 128, (x, y) => {
      const u = Math.abs(x / 16 - 0.5) * 2, v = y / 128;
      const a = (1 - u * u) * Math.sin(v * Math.PI) ** 0.7;
      return [255, 255, 255, clamp01(a) * 255];
    });
    return tex(c, { srgb: true });
  });
}

// ---------------- donut frosting ----------------
export function frosting() {
  return memo('frosting', () => {
    const W = 512;
    const c = pixels(W, W / 2, (x, y) => {
      const n = fbm(x / W * 8, y / W * 8, 8, 3, 5);
      const s = 0.92 + 0.1 * n;
      return [244 * s, 120 * s, 168 * s];
    });
    return tex(c);
  });
}

// ---------------- TV picture ----------------
export function tvPicture() {
  return memo('tv', () => {
    const c = canvas(512, 288);
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 288);
    sky.addColorStop(0, '#3a8fe0'); sky.addColorStop(0.6, '#9fd3ff'); sky.addColorStop(0.61, '#4caf50'); sky.addColorStop(1, '#2e7d32');
    g.fillStyle = sky; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(420, 60, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    for (const [x, y, s] of [[90, 60, 1], [200, 40, 0.7], [300, 80, 0.8]]) { g.beginPath(); g.ellipse(x, y, 40 * s, 16 * s, 0, 0, 7); g.ellipse(x + 26 * s, y - 10 * s, 26 * s, 14 * s, 0, 0, 7); g.fill(); }
    g.fillStyle = '#ff5252'; g.beginPath(); g.arc(250, 220, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(40, 238, 140, 26);
    g.fillStyle = '#e53935'; g.fillRect(40, 238, 46, 26);
    return tex(c);
  });
}

// ---------------- battery label / bolt icon ----------------
export function boltIcon() {
  return memo('bolt', () => {
    const c = canvas(256, 256);
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#ffd23a';
    g.beginPath();
    g.moveTo(150, 14); g.lineTo(60, 146); g.lineTo(120, 146); g.lineTo(98, 244); g.lineTo(196, 104); g.lineTo(134, 104); g.closePath();
    g.fill();
    return tex(c);
  });
}

export function stars() {
  return memo('stars', () => {
    const W = 1024, R = rng(31);
    const c = canvas(W, W / 2); const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W / 2);
    for (let i = 0; i < 900; i++) {
      const x = R() * W, y = R() * W / 2 * 0.55; const s = R();
      g.fillStyle = `rgba(255,255,255,${0.25 + s * 0.75})`;
      g.beginPath(); g.arc(x, y, 0.4 + s * 1.1, 0, 7); g.fill();
    }
    return tex(c);
  });
}
