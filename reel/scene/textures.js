// Procedural textures, all generated in code (no image files).
import * as THREE from 'three';
import { mulberry32, fbm2, vnoise2, clamp } from './util.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function toTex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// height canvas (grey) -> tangent-space normal map canvas
function normalFromHeight(hc, strength = 2.0, wrap = true) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h); const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h); const d = img.data;
  const H = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); }
    return src[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// value-noise field rendered into image data quickly (tileable via periodic hashing)
function noiseField(w, h, scale, oct, seed) {
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, a = 0.5, fq = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      // keep tileable: period scales with frequency
      const px = (x / w) * scale * fq, py = (y / h) * scale * fq;
      const pp = scale * fq;
      const ix = px, iy = py;
      const xs = ((ix % pp) + pp) % pp, ys = ((iy % pp) + pp) % pp;
      s += a * vnP(xs, ys, pp); norm += a; a *= 0.5; fq *= 2;
    }
    f[y * w + x] = s / norm;
  }
  function vnP(x, y, per) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const H = (a, b) => { a = ((a % per) + per) % per; b = ((b % per) + per) % per; const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
    const A = H(ix, iy), B = H(ix + 1, iy), C = H(ix, iy + 1), D = H(ix + 1, iy + 1);
    return (A + (B - A) * ux) * (1 - uy) + (C + (D - C) * ux) * uy;
  }
  return f;
}

// ---------------------------------------------------------------- asphalt (tiling detail)
export function makeAsphalt() {
  const N = 1024, rnd = mulberry32(11);
  const col = canvas(N, N), hgt = canvas(N, N), rough = canvas(N, N);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), rc = rough.getContext('2d');
  const n1 = noiseField(N, N, 8, 5, 1);
  const img = cc.createImageData(N, N), himg = hc.createImageData(N, N), rimg = rc.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = n1[i];
    const g = 70 + v * 26;
    img.data[i * 4] = g * 0.98; img.data[i * 4 + 1] = g * 0.97; img.data[i * 4 + 2] = g * 1.0; img.data[i * 4 + 3] = 255;
    himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = 110 + v * 60; himg.data[i * 4 + 3] = 255;
    const r = 205 + (v - 0.5) * 60; rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = r; rimg.data[i * 4 + 3] = 255;
  }
  cc.putImageData(img, 0, 0); hc.putImageData(himg, 0, 0); rc.putImageData(rimg, 0, 0);
  // aggregate stones: light and dark speckles, drawn tiled
  const dot = (ctx, x, y, r, fill) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      if (x + ox < -r || x + ox > N + r || y + oy < -r || y + oy > N + r) continue;
      ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * (0.6 + 0.4 * ((x * 7) % 1)), (x + y) % 3, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    }
  };
  for (let i = 0; i < 30000; i++) {
    const x = rnd() * N, y = rnd() * N, r = 0.5 + rnd() * rnd() * 1.8;
    const light = rnd() < 0.4;
    const l = light ? 92 + rnd() * 38 : 38 + rnd() * 22;
    dot(cc, x, y, r, `rgb(${l * (0.95 + rnd() * 0.1)},${l},${l * (1.0 + rnd() * 0.08)})`);
    dot(hc, x, y, r, light ? 'rgb(205,205,205)' : 'rgb(70,70,70)');
    if (light) dot(rc, x, y, r, 'rgb(150,150,150)');
  }
  // hairline cracks
  cc.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let x = rnd() * N, y = rnd() * N, a = rnd() * 6.28;
    cc.beginPath(); cc.moveTo(x, y);
    for (let s = 0; s < 40; s++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; cc.lineTo(x, y); }
    cc.strokeStyle = 'rgba(15,15,18,0.55)'; cc.lineWidth = 1.2 + rnd(); cc.stroke();
  }
  const nrm = normalFromHeight(hgt, 3.0, true);
  return { map: toTex(col), normalMap: toTex(nrm, { srgb: false }), roughnessMap: toTex(rough, { srgb: false }) };
}

// ---------------------------------------------------------------- paint overlay for the whole lot
// world rect: x0..x1, z0..z1. Draw callback receives a ctx in metres (x right, z down).
export function makeLotPaint(rect, pxPerM, draw) {
  const W = Math.round((rect.x1 - rect.x0) * pxPerM), H = Math.round((rect.z1 - rect.z0) * pxPerM);
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.scale(pxPerM, pxPerM); ctx.translate(-rect.x0, -rect.z0);
  draw(ctx, pxPerM);
  ctx.restore();
  const t = toTex(c, { aniso: 16 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------- soil cut face
// u: along the face (texture spans 12 m, repeats), v: depth below surface (0..1 = 0..7 m)
export const SOIL_DEPTH = 7.0;
export function makeSoil() {
  const W = 2048, H = 1200, rnd = mulberry32(5);
  const col = canvas(W, H), hgt = canvas(W, H);
  const cc = col.getContext('2d'), hc = hgt.getContext('2d');
  const mPerPx = SOIL_DEPTH / H;
  const per = 12 / mPerPx; // px per repeat horizontally = W
  const nA = noiseField(W, H, 6, 5, 3);
  // layer boundaries in metres below surface, wobbling along the face (tileable using sin of x)
  const wob = (x, k, amp) => amp * (Math.sin((x / W) * Math.PI * 2 * k) * 0.6 + Math.sin((x / W) * Math.PI * 2 * (k * 2 + 1) + 1.3) * 0.4);
  const layers = [
    { d: 0.08, c: [46, 46, 52], name: 'asphalt' },
    { d: 0.2, c: [150, 142, 130], name: 'gravel' },
    { d: 0.5, c: [96, 64, 44], name: 'topsoil' },
    { d: 0.95, c: [156, 98, 58], name: 'clay' },
    { d: 1.6, c: [190, 146, 96], name: 'sand' },
    { d: 3.2, c: [132, 84, 60], name: 'deep clay' },
    { d: 99, c: [116, 100, 92], name: 'rock' },
  ];
  const img = cc.createImageData(W, H), himg = hc.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const depth = y * mPerPx, i = y * W + x, n = nA[i];
    let L = 0;
    for (let k = 0; k < layers.length; k++) {
      const b = layers[k].d + (k === 0 ? 0 : k === 1 ? (n - 0.5) * 0.02 : wob(x, 1 + k, 0.02 + 0.025 * k) + (n - 0.5) * 0.04 * k);
      if (depth < b) { L = k; break; }
      L = k + 1;
    }
    L = Math.min(L, layers.length - 1);
    const base = layers[L].c;
    let shade = 0.82 + n * 0.36;
    // fine horizontal strata
    shade *= 0.97 + 0.03 * Math.sin(depth * 22 + n * 9);
    const o = i * 4;
    img.data[o] = base[0] * shade; img.data[o + 1] = base[1] * shade; img.data[o + 2] = base[2] * shade; img.data[o + 3] = 255;
    const hv = 120 + n * 70;
    himg.data[o] = himg.data[o + 1] = himg.data[o + 2] = hv; himg.data[o + 3] = 255;
  }
  cc.putImageData(img, 0, 0); hc.putImageData(himg, 0, 0);
  // stones: gravel layer has many small grey stones, deeper layers bigger rounded stones
  const stone = (x, y, rx, ry, rot, l, tint) => {
    for (const ox of [-W, 0, W]) {
      const X = x + ox; if (X < -rx * 2 || X > W + rx * 2) continue;
      const g = cc.createRadialGradient(X - rx * 0.3, y - ry * 0.35, rx * 0.1, X, y, Math.max(rx, ry));
      g.addColorStop(0, `rgb(${l * 1.25 * tint[0]},${l * 1.25 * tint[1]},${l * 1.25 * tint[2]})`);
      g.addColorStop(0.7, `rgb(${l * tint[0]},${l * tint[1]},${l * tint[2]})`);
      g.addColorStop(1, `rgb(${l * 0.55 * tint[0]},${l * 0.55 * tint[1]},${l * 0.55 * tint[2]})`);
      cc.save(); cc.translate(X, y); cc.rotate(rot); cc.beginPath(); cc.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      cc.shadowColor = 'rgba(0,0,0,0.35)'; cc.shadowBlur = rx * 0.35; cc.shadowOffsetY = ry * 0.18;
      cc.fillStyle = g; cc.fill(); cc.restore();
      const hg = hc.createRadialGradient(X, y, 0, X, y, Math.max(rx, ry));
      hg.addColorStop(0, 'rgb(255,255,255)'); hg.addColorStop(1, 'rgb(120,120,120)');
      hc.save(); hc.translate(X, y); hc.rotate(rot); hc.beginPath(); hc.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); hc.fillStyle = hg; hc.fill(); hc.restore();
    }
  };
  const pxm = 1 / mPerPx;
  for (let i = 0; i < 3400; i++) { // gravel base
    const y = (0.09 + rnd() * 0.11) * pxm, r = (0.004 + rnd() * 0.009) * pxm;
    const l = 120 + rnd() * 90; stone(rnd() * W, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, l, [1, 0.98, 0.95]);
  }
  for (let i = 0; i < 420; i++) { // pebbles in soil
    const y = (0.25 + Math.pow(rnd(), 0.7) * 6.6) * pxm, r = (0.008 + rnd() * rnd() * 0.06) * pxm * (y > 1.6 * pxm ? 2.2 : 1);
    const l = 110 + rnd() * 80; const warm = rnd() < 0.5;
    stone(rnd() * W, y, r, r * (0.55 + rnd() * 0.4), rnd() * 3, l, warm ? [1.05, 0.95, 0.85] : [0.95, 0.97, 1.02]);
  }
  for (let i = 0; i < 26; i++) { // a few big boulders in the rocky layer
    const y = (4.9 + rnd() * 1.9) * pxm, r = (0.25 + rnd() * 0.35) * pxm;
    stone(rnd() * W, y, r, r * (0.6 + rnd() * 0.3), rnd() * 3, 120 + rnd() * 50, [0.95, 0.95, 0.98]);
  }
  // little roots in the topsoil
  cc.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    let x = rnd() * W, y = (0.22 + rnd() * 0.2) * pxm, a = Math.PI / 2 + (rnd() - 0.5);
    cc.beginPath(); cc.moveTo(x, y);
    for (let s = 0; s < 10; s++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 4; y += Math.sin(a) * 4; cc.lineTo(x, y); }
    cc.strokeStyle = 'rgba(60,38,22,0.55)'; cc.lineWidth = 0.8 + rnd() * 1.2; cc.stroke();
  }
  const nrm = normalFromHeight(hgt, 4.0, true);
  return { map: toTex(col, { aniso: 16 }), normalMap: toTex(nrm, { srgb: false, aniso: 16 }), repeatMeters: 12 };
}

// ---------------------------------------------------------------- cardboard
export function makeCardboard(seed = 1) {
  const W = 512, H = 512, rnd = mulberry32(seed + 40);
  const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#c89a62'); g.addColorStop(1, '#b8874f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '230,200,150'},${rnd() * 0.12})`; ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2); }
  for (let y = 0; y < H; y += 6) { ctx.fillStyle = 'rgba(80,50,20,0.05)'; ctx.fillRect(0, y, W, 2); }
  // tape stripe
  ctx.fillStyle = 'rgba(210,175,120,0.85)'; ctx.fillRect(W * 0.44, 0, W * 0.12, H);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(W * 0.46, 0, W * 0.02, H);
  // printed "this side up" arrows & a cup icon (no words)
  ctx.strokeStyle = 'rgba(40,30,25,0.75)'; ctx.fillStyle = 'rgba(40,30,25,0.75)'; ctx.lineWidth = 7;
  const arrow = (x, y) => { ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 14, y + 12); ctx.lineTo(x, y - 6); ctx.lineTo(x + 14, y + 12); ctx.closePath(); ctx.fill(); };
  arrow(70, 60); arrow(110, 60);
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(360, 380); ctx.lineTo(372, 440); ctx.lineTo(412, 440); ctx.lineTo(424, 380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(392, 440); ctx.lineTo(392, 470); ctx.moveTo(375, 470); ctx.lineTo(409, 470); ctx.stroke();
  // scuffs / dust
  for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(70,45,20,${0.05 + rnd() * 0.1})`; ctx.beginPath(); ctx.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 40, 4 + rnd() * 12, rnd() * 3, 0, 6.28); ctx.fill(); }
  // edge darkening
  const e = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
  e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(60,35,10,0.35)'); ctx.fillStyle = e; ctx.fillRect(0, 0, W, H);
  return toTex(c);
}

// ---------------------------------------------------------------- burlap
export function makeBurlap() {
  const W = 512, H = 512, rnd = mulberry32(77);
  const c = canvas(W, H), ctx = c.getContext('2d'), h = canvas(W, H), hx = h.getContext('2d');
  ctx.fillStyle = '#9b7a4c'; ctx.fillRect(0, 0, W, H); hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, H);
  const step = 16;
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const odd = ((x / step + y / step) & 1) === 1;
    const l = 150 + rnd() * 40;
    ctx.fillStyle = `rgb(${l},${l * 0.78},${l * 0.5})`;
    if (odd) ctx.fillRect(x + 1, y + 3, step - 2, step - 6); else ctx.fillRect(x + 3, y + 1, step - 6, step - 2);
    hx.fillStyle = 'rgb(220,220,220)'; if (odd) hx.fillRect(x + 1, y + 3, step - 2, step - 6); else hx.fillRect(x + 3, y + 1, step - 6, step - 2);
  }
  for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(60,40,20,${rnd() * 0.15})`; ctx.fillRect(rnd() * W, rnd() * H, 1, 3 + rnd() * 6); }
  return { map: toTex(c, { repeat: [3, 3] }), normalMap: toTex(normalFromHeight(h, 3, true), { srgb: false, repeat: [3, 3] }) };
}

// ---------------------------------------------------------------- rope
export function makeRope() {
  const W = 256, H = 64, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8b13a'; ctx.fillRect(0, 0, W, H);
  for (let x = -H; x < W + H; x += 16) {
    ctx.fillStyle = 'rgba(160,90,20,0.55)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x + 6 + H, H); ctx.lineTo(x + H, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.35)'; ctx.beginPath(); ctx.moveTo(x + 9, 0); ctx.lineTo(x + 11, 0); ctx.lineTo(x + 11 + H, H); ctx.lineTo(x + 9 + H, H); ctx.closePath(); ctx.fill();
  }
  return toTex(c, { repeat: [20, 1] });
}

// ---------------------------------------------------------------- checker
export function makeChecker(nx = 8, ny = 2, a = '#111', b = '#f4f4f4') {
  const s = 64, c = canvas(nx * s, ny * s), ctx = c.getContext('2d');
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { ctx.fillStyle = (x + y) % 2 ? a : b; ctx.fillRect(x * s, y * s, s, s); }
  const t = toTex(c); t.magFilter = THREE.LinearFilter; return t;
}

// ---------------------------------------------------------------- brushed / scratched metal roughness
export function makeScratches() {
  const W = 512, H = 512, rnd = mulberry32(9), c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(70,70,70)'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W, y = rnd() * H, a = (rnd() - 0.5) * 0.5 + (rnd() < 0.5 ? 0 : 1.57), L = 10 + rnd() * 60;
    ctx.strokeStyle = `rgba(${200 + rnd() * 55},${200},${200},${0.15 + rnd() * 0.4})`; ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(160,160,160,${rnd() * 0.3})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 2 + rnd() * 10, 0, 6.28); ctx.fill(); }
  return toTex(c, { srgb: false, repeat: [2, 2] });
}

// ---------------------------------------------------------------- tire tread
export function makeTread() {
  const W = 256, H = 64, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#26272b'; ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 12) { ctx.fillStyle = '#121316'; ctx.fillRect(x, 8, 5, H - 16); }
  ctx.fillStyle = '#34353a'; ctx.fillRect(0, 0, W, 5); ctx.fillRect(0, H - 5, W, 5);
  return toTex(c, { repeat: [3, 1] });
}

// ---------------------------------------------------------------- wood
export function makeWood() {
  const W = 128, H = 512, rnd = mulberry32(3), c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#b07a43'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = rnd() * W; ctx.strokeStyle = `rgba(90,50,20,${0.1 + rnd() * 0.25})`; ctx.lineWidth = 1 + rnd() * 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + rnd() * 10 - 5, H / 3, x + rnd() * 10 - 5, H * 2 / 3, x, H); ctx.stroke(); }
  return toTex(c);
}

// ---------------------------------------------------------------- store window (lit interior)
export function makeStoreWindow(seed = 1) {
  const W = 1024, H = 512, rnd = mulberry32(seed * 13 + 1), c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fff3cf'); g.addColorStop(0.45, '#ffe2a2'); g.addColorStop(1, '#f2b46a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ceiling lights
  for (let x = 40; x < W; x += 140) { ctx.fillStyle = 'rgba(255,255,245,0.95)'; ctx.fillRect(x, 30, 90, 10); }
  // shelves with colourful products
  const cols = ['#e2483c', '#f4b23a', '#3da35d', '#3b7dd8', '#f07fa8', '#8b5cc8', '#f6e7c1', '#24a3a3'];
  for (let s = 0; s < 6; s++) {
    const x0 = 30 + s * 170, w = 130;
    ctx.fillStyle = 'rgba(120,80,50,0.65)'; ctx.fillRect(x0, 150, w, 330);
    for (let r = 0; r < 4; r++) {
      const y = 170 + r * 78; ctx.fillStyle = 'rgba(90,60,40,0.8)'; ctx.fillRect(x0, y + 62, w, 6);
      for (let x = x0 + 4; x < x0 + w - 10; x += 12 + rnd() * 6) {
        const h = 30 + rnd() * 28; ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
        ctx.fillRect(x, y + 62 - h, 9 + rnd() * 5, h);
      }
    }
  }
  // soft bloom-ish haze
  const hz = ctx.createLinearGradient(0, 0, 0, H); hz.addColorStop(0, 'rgba(255,250,230,0.35)'); hz.addColorStop(0.5, 'rgba(255,240,200,0.05)'); hz.addColorStop(1, 'rgba(255,220,170,0.25)');
  ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
  return toTex(c);
}

// ---------------------------------------------------------------- generic soft radial sprite (glows)
export function makeGlowSprite() {
  const N = 128, c = canvas(N, N), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  const t = toTex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// soft streak (speed lines) gradient along u
export function makeStreak() {
  const W = 256, H = 16, c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) { const k = Math.sin((y + 0.5) / H * Math.PI); for (let x = 0; x < W; x++) v.data[(y * W + x) * 4 + 3] *= k; }
  ctx.putImageData(v, 0, 0);
  const t = toTex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// car body: subtle dirt/dust gradient towards the bottom (used as an AO-ish map)
export function makeDustGrad() {
  const c = canvas(16, 256), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#f4efe6'); g.addColorStop(1, '#b9a690');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
  return toTex(c);
}
