// Procedural low-res textures (PS2 look: small canvases + nearest-neighbour magnification).
// Every function is deterministic (seeded) so re-renders match frame-for-frame.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Tileable value noise in [0,1].
export function noise2(w, h, cell, seed) {
  const r = rng(seed);
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(w * h);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = sm(gx - x0), fy = sm(gy - y0);
      const a = g[(y0 % gh) * gw + (x0 % gw)], b = g[(y0 % gh) * gw + ((x0 + 1) % gw)];
      const c = g[((y0 + 1) % gh) * gw + (x0 % gw)], d = g[((y0 + 1) % gh) * gw + ((x0 + 1) % gw)];
      out[y * w + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
  }
  return out;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => a + (b - a) * t;
const mixRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));

export function toTexture(c, { repeat = [1, 1], nearest = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : (nearest ? THREE.NearestFilter : THREE.LinearFilter);
  t.generateMipmaps = mip;
  t.anisotropy = 4;
  return t;
}

// Paint a pixel buffer through a per-pixel colour function.
function paint(w, h, fn) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = clamp(r); img.data[i + 1] = clamp(g); img.data[i + 2] = clamp(b); img.data[i + 3] = clamp(a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- fur ----------
// u runs along the body part, v around it (v=0 top/dorsal, 0.5 belly). Stripes vary along u.
export function furCanvas(p, { w = 128, h = 64, stripes = 9, belly = true, bib = false, sock = 0, tipDark = 0, seed = 1 } = {}) {
  const base = hexToRgb(p.base), dark = hexToRgb(p.stripe || p.base), light = hexToRgb(p.belly || '#f4ece0');
  const n1 = noise2(w, h, 4, seed), n2 = noise2(w, h, 2, seed + 7), n3 = noise2(w, h, 16, seed + 13);
  const R = rng(seed + 31);
  return paint(w, h, (x, y) => {
    const u = x / w, v = y / h;
    let col = base.slice();
    // fine fur grain + per-pixel speckle (reads as pixelated fur when magnified)
    const grain = (n2[y * w + x] - 0.5) * 34 + (n1[y * w + x] - 0.5) * 26 + (R() - 0.5) * 26;
    // tabby stripes (wavy), stronger on the back
    if (p.stripe && stripes > 0) {
      const dorsal = 1 - Math.min(1, Math.abs(v - 0.0) * 2.2, Math.abs(v - 1) * 2.2);
      const wav = Math.sin((u * stripes + (n3[y * w + x] - 0.5) * 0.9 + Math.sin(v * 12.6) * 0.12) * Math.PI * 2);
      const s = Math.max(0, wav - 0.25) / 0.75;
      col = mixRgb(col, dark, Math.min(1, s * (0.55 + 0.45 * dorsal) * (p.stripeStrength ?? 1)));
      // dark dorsal line
      col = mixRgb(col, dark, Math.max(0, dorsal - 0.75) * 1.4 * (p.stripeStrength ?? 1));
    }
    if (p.patches) {
      const pn = n3[y * w + x];
      if (pn > 0.62) col = mixRgb(col, hexToRgb(p.patches[0]), Math.min(1, (pn - 0.62) * 8));
      else if (pn < 0.33 && p.patches[1]) col = mixRgb(col, hexToRgb(p.patches[1]), Math.min(1, (0.33 - pn) * 8));
    }
    if (belly) {
      const bd = Math.abs(v - 0.5);
      const width = 0.11 + (bib ? Math.max(0, u - 0.62) * 0.55 : 0);
      const bt = Math.max(0, Math.min(1, (width - bd + (n1[y * w + x] - 0.5) * 0.07) / 0.05));
      col = mixRgb(col, light, bt);
    }
    if (sock > 0) {
      const st = Math.max(0, Math.min(1, (u - (1 - sock) + (n1[y * w + x] - 0.5) * 0.08) / 0.05));
      col = mixRgb(col, light, st);
    }
    if (tipDark > 0) {
      const tt = Math.max(0, Math.min(1, (u - (1 - tipDark)) / 0.06));
      col = mixRgb(col, dark, tt * 0.85);
    }
    return [col[0] + grain, col[1] + grain * 0.9, col[2] + grain * 0.8];
  });
}

// ---------- cat face ----------
// Painted face for the front of the head. Variants: eyes 'open'|'half'|'closed'|'happy', mouth 'closed'|'open'|'wide'.
// Layout (in 0..1 texture space, y down): eyes at y≈0.42, nose at y≈0.62, mouth at y≈0.70.
export function catFaceCanvas(p, { eyes = 'open', mouth = 'closed', size = 256, seed = 3, kitten = false, lookX = 0, lookY = 0, tears = false } = {}) {
  const c = furCanvas(p, { w: size, h: size, stripes: 0, belly: false, seed });
  const ctx = c.getContext('2d');
  const S = size;
  const base = p.base, dark = p.stripe || p.base, light = p.belly || '#f4ece0';
  const R = rng(seed + 99);
  // forehead "M" stripes
  if (p.stripe) {
    ctx.strokeStyle = dark; ctx.lineCap = 'round';
    ctx.globalAlpha = (p.stripeStrength ?? 1) * 0.9;
    for (let i = -2; i <= 2; i++) {
      ctx.lineWidth = S * (i === 0 ? 0.035 : 0.028);
      ctx.beginPath();
      const x = 0.5 + i * 0.075;
      ctx.moveTo(S * x, S * 0.06);
      ctx.quadraticCurveTo(S * (x + i * 0.01), S * 0.18, S * (0.5 + i * 0.05), S * 0.3);
      ctx.stroke();
    }
    // cheek stripes
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        ctx.lineWidth = S * 0.022;
        ctx.beginPath();
        ctx.moveTo(S * (0.5 + sd * (0.3 + k * 0.03)), S * (0.47 + k * 0.07));
        ctx.quadraticCurveTo(S * (0.5 + sd * 0.42), S * (0.5 + k * 0.07), S * (0.5 + sd * 0.49), S * (0.48 + k * 0.08));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  if (p.facePatch) { // e.g. tuxedo / calico mask
    ctx.fillStyle = p.facePatch.color;
    ctx.beginPath();
    for (const pt of p.facePatch.poly) ctx.lineTo(pt[0] * S, pt[1] * S);
    ctx.closePath(); ctx.fill();
  }
  // muzzle (light)
  const mg = ctx.createRadialGradient(S * 0.5, S * 0.7, S * 0.02, S * 0.5, S * 0.7, S * 0.2);
  mg.addColorStop(0, light); mg.addColorStop(0.7, light); mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.7, S * 0.21, S * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  // bridge of nose light
  ctx.fillStyle = light; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.52, S * 0.045, S * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // eyes
  const eyeY = 0.43, eyeDX = kitten ? 0.165 : 0.155, er = kitten ? 0.105 : 0.085;
  for (const sd of [-1, 1]) {
    const cx = S * (0.5 + sd * eyeDX), cy = S * eyeY, rx = S * er * 1.08, ry = S * er;
    // dark socket rim
    ctx.fillStyle = 'rgba(30,20,10,0.55)';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.18, ry * 1.18, sd * -0.12, 0, Math.PI * 2); ctx.fill();
    if (eyes === 'closed' || eyes === 'happy') {
      // fur-coloured lid + dark lash arc (the reference's crude closed-eye look)
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.2, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = S * 0.02; ctx.lineCap = 'round';
      ctx.beginPath();
      if (eyes === 'happy') ctx.arc(cx, cy + ry * 0.35, rx * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      else ctx.arc(cx, cy - ry * 0.55, rx * 0.95, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      // tiny lashes
      for (let k = -1; k <= 1; k++) {
        const a = Math.PI * (0.5 + k * 0.22);
        const lx = cx + Math.cos(a) * rx * 0.95, ly = cy - ry * 0.55 + Math.sin(a) * rx * 0.95;
        if (eyes === 'closed') { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a) * S * 0.018, ly + Math.sin(a) * S * 0.018); ctx.stroke(); }
      }
      continue;
    }
    // iris
    const ig = ctx.createRadialGradient(cx, cy + ry * 0.2, ry * 0.1, cx, cy, ry);
    ig.addColorStop(0, p.irisInner || '#e6d36a'); ig.addColorStop(0.75, p.iris || '#9bb54a'); ig.addColorStop(1, '#3d4a1c');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // pupil (big & round = cute)
    ctx.fillStyle = '#0d0a08';
    const pr = kitten ? 0.72 : 0.55;
    ctx.beginPath(); ctx.ellipse(cx + lookX * rx * 0.3, cy + lookY * ry * 0.25, rx * pr * 0.8, ry * pr, 0, 0, Math.PI * 2); ctx.fill();
    // highlights
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.3, cy - ry * 0.35, rx * 0.2, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + rx * 0.3, cy + ry * 0.3, rx * 0.08, ry * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    if (eyes === 'angry') { // slit pupils + slanted brow lids
      ctx.fillStyle = '#0d0a08';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.16, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.4, cy - ry * (sd < 0 ? 1.4 : 0.1));
      ctx.lineTo(cx + rx * 1.4, cy - ry * (sd < 0 ? 0.1 : 1.4));
      ctx.lineTo(cx + rx * 1.4, cy - ry * 1.6); ctx.lineTo(cx - rx * 1.4, cy - ry * 1.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = S * 0.016;
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.1, cy - ry * (sd < 0 ? 1.1 : 0.2)); ctx.lineTo(cx + rx * 1.1, cy - ry * (sd < 0 ? 0.2 : 1.1)); ctx.stroke();
    }
    if (eyes === 'half') { // upper lid
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.55, rx * 1.25, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = S * 0.012;
      ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.55, rx * 1.1, ry * 0.85, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
    if (tears) {
      ctx.strokeStyle = 'rgba(70,170,255,0.95)'; ctx.lineWidth = S * 0.03; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + sd * rx * 0.2, cy + ry * 0.9);
      ctx.quadraticCurveTo(cx + sd * rx * 0.45, cy + ry * 1.8, cx + sd * rx * 0.3, cy + ry * 2.6); ctx.stroke();
    }
  }
  // nose
  ctx.fillStyle = p.nose || '#d98c8c';
  ctx.beginPath();
  ctx.moveTo(S * 0.455, S * 0.6); ctx.lineTo(S * 0.545, S * 0.6); ctx.lineTo(S * 0.5, S * 0.655); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(S * 0.49, S * 0.607, S * 0.015, S * 0.006, 0, 0, Math.PI * 2); ctx.fill();
  // mouth
  ctx.strokeStyle = '#4a2a22'; ctx.lineWidth = S * 0.011; ctx.lineCap = 'round';
  if (mouth === 'closed') {
    ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.655); ctx.lineTo(S * 0.5, S * 0.69);
    ctx.quadraticCurveTo(S * 0.47, S * 0.72, S * 0.44, S * 0.7);
    ctx.moveTo(S * 0.5, S * 0.69); ctx.quadraticCurveTo(S * 0.53, S * 0.72, S * 0.56, S * 0.7); ctx.stroke();
  } else {
    const open = mouth === 'wide' ? 0.11 : 0.07;
    ctx.fillStyle = '#3a1416';
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * (0.7 + open * 0.45), S * 0.065, S * open * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0606a';
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * (0.7 + open * 0.75), S * 0.04, S * open * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(S * (0.5 + sd * 0.045), S * 0.682); ctx.lineTo(S * (0.5 + sd * 0.03), S * 0.682);
      ctx.lineTo(S * (0.5 + sd * 0.038), S * 0.71); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.655); ctx.lineTo(S * 0.5, S * 0.68); ctx.stroke();
  }
  // whisker dots + whiskers
  ctx.fillStyle = 'rgba(60,40,30,0.6)';
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) {
    ctx.beginPath(); ctx.arc(S * (0.5 + sd * (0.06 + j * 0.03)), S * (0.675 + k * 0.018), S * 0.005, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = S * 0.006;
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(S * (0.5 + sd * 0.1), S * (0.68 + k * 0.02));
    ctx.quadraticCurveTo(S * (0.5 + sd * 0.3), S * (0.66 + k * 0.035), S * (0.5 + sd * 0.48), S * (0.66 + k * 0.05));
    ctx.stroke();
  }
  return c;
}

// ---------- environment ----------
export function wallpaperCanvas({ base = '#9fae96', seed = 11 } = {}) {
  const w = 128, h = 128;
  const n = noise2(w, h, 8, seed);
  const c = paint(w, h, (x, y) => {
    const b = hexToRgb(base);
    const g = (n[y * w + x] - 0.5) * 14;
    return [b[0] + g, b[1] + g, b[2] + g];
  });
  const ctx = c.getContext('2d');
  const R = rng(seed);
  const flowers = ['#c98b8f', '#b5656e', '#e3c0c0', '#a35a62'];
  for (let i = 0; i < 46; i++) {
    const x = R() * w, y = R() * h;
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      ctx.fillStyle = '#6f8a5e';
      ctx.fillRect(x + ox + 2, y + oy + 1, 2, 1);
      ctx.fillStyle = flowers[i % flowers.length];
      ctx.fillRect(x + ox, y + oy, 2, 2);
      ctx.fillRect(x + ox - 1, y + oy + 1, 1, 1);
      ctx.fillStyle = '#efe0d8';
      ctx.fillRect(x + ox + 1, y + oy, 1, 1);
    }
  }
  return c;
}

export function rugCanvas({ seed = 21 } = {}) {
  const w = 96, h = 136;
  const R = rng(seed);
  const pal = ['#8e1b1b', '#a32a22', '#6d1416', '#c9a46a', '#1f2e5a', '#e7d9b8', '#2f5a4a', '#b5552f'];
  const n = noise2(w, h, 3, seed);
  return paint(w, h, (x, y) => {
    const cx = (x + 0.5) / w - 0.5, cy = (y + 0.5) / h - 0.5;
    const bx = Math.min(x, w - 1 - x), by = Math.min(y, h - 1 - y), bd = Math.min(bx, by);
    let col;
    if (bd < 2) col = '#e7d9b8';
    else if (bd < 9) col = ((x + y) % 6 < 3) ? '#1f2e5a' : (bd % 3 === 0 ? '#c9a46a' : '#24305c');
    else if (bd < 11) col = '#c9a46a';
    else {
      const d = Math.abs(cx) * 1.4 + Math.abs(cy); // diamond medallion
      const ring = Math.floor(d * 22);
      if (d < 0.12) col = ring % 2 ? '#1f2e5a' : '#c9a46a';
      else if (d < 0.2) col = ring % 2 ? '#e7d9b8' : '#2f5a4a';
      else if (d < 0.23) col = '#1f2e5a';
      else {
        const motif = (Math.floor(x / 4) * 7 + Math.floor(y / 4) * 13) % 11;
        col = motif === 0 ? '#c9a46a' : motif === 3 ? '#1f2e5a' : motif === 7 ? '#b5552f' : (motif % 2 ? '#8e1b1b' : '#a32a22');
      }
    }
    const c = hexToRgb(col);
    const g = (n[y * w + x] - 0.5) * 40 + (R() - 0.5) * 20;
    return [c[0] + g, c[1] + g * 0.8, c[2] + g * 0.8];
  });
}

export function leatherCanvas({ base = '#6e1a17', seed = 31 } = {}) {
  const w = 64, h = 64;
  const n = noise2(w, h, 4, seed), n2 = noise2(w, h, 16, seed + 1);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    // diamond tufting: buttons on a diamond lattice
    const gx = ((x + 0.5) / 16) % 1, gy = ((y + 0.5) / 16) % 1;
    const d1 = Math.min(Math.hypot(gx - 0.5, gy - 0.5), Math.hypot(gx, gy), Math.hypot(1 - gx, gy), Math.hypot(gx, 1 - gy), Math.hypot(1 - gx, 1 - gy));
    const puff = Math.min(1, d1 * 2.4);
    let k = 0.55 + puff * 0.65;
    if (d1 < 0.07) k = 0.35;
    const hl = Math.max(0, n2[y * w + x] - 0.55) * 1.6;
    const g = (n[y * w + x] - 0.5) * 0.25;
    return [b[0] * (k + g) + hl * 120, b[1] * (k + g) + hl * 60, b[2] * (k + g) + hl * 55];
  });
}

export function woodFloorCanvas({ base = '#c99a5e', seed = 41 } = {}) {
  const w = 128, h = 128;
  const n = noise2(w, h, 2, seed), n2 = noise2(w, h, 32, seed + 3);
  const R = rng(seed);
  const plankTone = Array.from({ length: 64 }, () => (R() - 0.5) * 34);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    const row = Math.floor(y / 16);
    const off = (row * 37) % 128;
    const col = Math.floor(((x + off) % 128) / 64);
    const id = row * 2 + col;
    let t = plankTone[id % 64];
    if (y % 16 === 0 || ((x + off) % 64) === 0) t -= 55;
    const grain = Math.sin((x * 0.35 + n2[y * w + x] * 20 + id * 3)) * 9 + (n[y * w + x] - 0.5) * 16;
    return [b[0] + t + grain, b[1] + t * 0.85 + grain * 0.85, b[2] + t * 0.6 + grain * 0.6];
  });
}

export function brickCanvas({ seed = 51 } = {}) {
  const w = 128, h = 128;
  const R = rng(seed);
  const n = noise2(w, h, 2, seed);
  const tones = Array.from({ length: 256 }, () => [150 + R() * 50, 62 + R() * 25, 48 + R() * 18]);
  return paint(w, h, (x, y) => {
    const bh = 8, bw = 21.33;
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    const col = Math.floor((x + off) / bw);
    const mortar = (y % bh) === 0 || Math.floor((x + off) % bw) === 0;
    const g = (n[y * w + x] - 0.5) * 40;
    if (mortar) return [178 + g * 0.4, 168 + g * 0.4, 152 + g * 0.4];
    const tc = tones[(row * 7 + col) % 256];
    return [tc[0] + g, tc[1] + g * 0.6, tc[2] + g * 0.5];
  });
}

export function asphaltCanvas({ seed = 61, base = '#77777a' } = {}) {
  const w = 128, h = 128;
  const n = noise2(w, h, 1, seed), n2 = noise2(w, h, 8, seed + 1), n3 = noise2(w, h, 32, seed + 2);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    const g = (n[y * w + x] - 0.5) * 34 + (n2[y * w + x] - 0.5) * 18 + (n3[y * w + x] - 0.5) * 22;
    return [b[0] + g, b[1] + g, b[2] + g + 2];
  });
}

export function concreteCanvas({ seed = 71, base = '#b9b6ae', joint = 64 } = {}) {
  const w = 128, h = 128;
  const n = noise2(w, h, 2, seed), n2 = noise2(w, h, 16, seed + 1);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    let g = (n[y * w + x] - 0.5) * 22 + (n2[y * w + x] - 0.5) * 20;
    if (joint && (x % joint === 0)) g -= 45;
    return [b[0] + g, b[1] + g, b[2] + g];
  });
}

export function grassCanvas({ seed = 81, dry = 0.7 } = {}) {
  const w = 128, h = 128;
  const n = noise2(w, h, 1, seed), n2 = noise2(w, h, 6, seed + 1), n3 = noise2(w, h, 24, seed + 2);
  const green = [104, 122, 64], tan = [176, 158, 104];
  return paint(w, h, (x, y) => {
    const t = Math.min(1, Math.max(0, dry + (n3[y * w + x] - 0.5) * 0.9));
    const c = mixRgb(green, tan, t);
    const g = (n[y * w + x] - 0.5) * 50 + (n2[y * w + x] - 0.5) * 20;
    return [c[0] + g, c[1] + g, c[2] + g * 0.7];
  });
}

export function skyCanvas({ mode = 'day' } = {}) {
  const w = 512, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (mode === 'red') {
    g.addColorStop(0, '#1a0204'); g.addColorStop(0.45, '#5e0709'); g.addColorStop(0.62, '#9c0f0f'); g.addColorStop(0.72, '#d42a12'); g.addColorStop(1, '#3a0505');
  } else if (mode === 'dusk') {
    g.addColorStop(0, '#2b3b6b'); g.addColorStop(0.55, '#7b6aa0'); g.addColorStop(0.7, '#e59a7a'); g.addColorStop(1, '#f2c79a');
  } else {
    g.addColorStop(0, '#3f7fd0'); g.addColorStop(0.5, '#79aee6'); g.addColorStop(0.7, '#b7d4f0'); g.addColorStop(1, '#dfe9f2');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const R = rng(mode === 'red' ? 5 : 9);
  if (mode === 'day') {
    for (let i = 0; i < 26; i++) {
      const x = R() * w, y = 20 + R() * 120, s = 12 + R() * 30;
      for (let k = 0; k < 7; k++) {
        const gx = x + (R() - 0.5) * s * 2.6, gy = y + (R() - 0.5) * s * 0.6;
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, s);
        rg.addColorStop(0, 'rgba(255,255,255,0.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg;
        for (const ox of [-w, 0, w]) { ctx.beginPath(); ctx.arc(gx + ox, gy, s, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  } else if (mode === 'red') {
    // faint stars + glowing horizon
    ctx.fillStyle = 'rgba(255,180,160,0.5)';
    for (let i = 0; i < 60; i++) ctx.fillRect(R() * w, R() * h * 0.4, 1, 1);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.75, 5, w * 0.5, h * 0.75, w * 0.45);
    rg.addColorStop(0, 'rgba(255,60,20,0.55)'); rg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
  return c;
}

export function ginghamCanvas({ color = '#d8262c', seed = 91 } = {}) {
  const w = 64, h = 64;
  const n = noise2(w, h, 2, seed);
  const r = hexToRgb(color);
  return paint(w, h, (x, y) => {
    const a = Math.floor(x / 8) % 2, b = Math.floor(y / 8) % 2;
    let c = [246, 240, 236];
    if (a && b) c = r; else if (a || b) c = mixRgb(r, [246, 240, 236], 0.45);
    const g = (n[y * w + x] - 0.5) * 22;
    return [c[0] + g, c[1] + g, c[2] + g];
  });
}

export function checkerCanvas({ a = '#efefea', b = '#1b1b1d', n = 4, seed = 101 } = {}) {
  const w = 64, h = 64;
  const nz = noise2(w, h, 2, seed);
  const A = hexToRgb(a), B = hexToRgb(b);
  return paint(w, h, (x, y) => {
    const c = ((Math.floor(x / (w / n)) + Math.floor(y / (h / n))) % 2) ? B : A;
    const g = (nz[y * w + x] - 0.5) * 16;
    return [c[0] + g, c[1] + g, c[2] + g];
  });
}

export function tilesCanvas({ base = '#f1f1ee', grout = '#b9bab4', n = 4 } = {}) {
  const w = 64, h = 64;
  const B = hexToRgb(base), G = hexToRgb(grout);
  const nz = noise2(w, h, 4, 7);
  return paint(w, h, (x, y) => {
    const t = w / n;
    const isG = (x % t) === 0 || (y % t) === 0;
    const c = isG ? G : B;
    const g = (nz[y * w + x] - 0.5) * 10;
    return [c[0] + g, c[1] + g, c[2] + g];
  });
}

export function clothCanvas({ base = '#3c5a8a', kind = 'denim', seed = 111 } = {}) {
  const w = 64, h = 64;
  const n = noise2(w, h, 1, seed), n2 = noise2(w, h, 8, seed + 1);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    let g = (n[y * w + x] - 0.5) * 26 + (n2[y * w + x] - 0.5) * 30;
    if (kind === 'denim') g += ((x + y) % 3 === 0) ? 10 : -4;
    if (kind === 'knit') g += (Math.abs(((x % 6) - 3)) < 1 ? -18 : 6) + ((y % 4) === 0 ? -8 : 0);
    return [b[0] + g, b[1] + g, b[2] + g];
  });
}

export function foliageCanvas({ seed = 121, base = '#4f6e2c' } = {}) {
  const w = 64, h = 64;
  const n = noise2(w, h, 2, seed), n2 = noise2(w, h, 6, seed + 1);
  const b = hexToRgb(base);
  return paint(w, h, (x, y) => {
    const g = (n[y * w + x] - 0.5) * 70 + (n2[y * w + x] - 0.5) * 50;
    return [b[0] + g, b[1] + g * 1.1, b[2] + g * 0.6];
  });
}

// Dry bush billboard (alpha).
export function bushCanvas({ seed = 131 } = {}) {
  const w = 64, h = 64;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const R = rng(seed);
  const cols = ['#8a6a3a', '#a7834a', '#6e5430', '#b99a5c', '#7a6a3a'];
  for (let i = 0; i < 140; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.4;
    const len = 18 + R() * 30;
    const x0 = 32 + (R() - 0.5) * 10, y0 = 63;
    ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 1 + (R() < 0.3 ? 1 : 0);
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); ctx.stroke();
  }
  return c;
}

export function blobShadowCanvas() {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function solidCanvas(hex, seed = 141, amp = 18) {
  const w = 32, h = 32;
  const n = noise2(w, h, 2, seed);
  const b = hexToRgb(hex);
  return paint(w, h, (x, y) => {
    const g = (n[y * w + x] - 0.5) * amp;
    return [b[0] + g, b[1] + g, b[2] + g];
  });
}
