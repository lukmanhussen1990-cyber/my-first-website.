import * as THREE from 'three';
import { RoomEnvironment } from './node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

const P = new URLSearchParams(location.search);
const W = +P.get('w') || 1080, H = +P.get('h') || 1920;
const LQ = P.get('lq') === '1';
const TL = await (await fetch('./timeline.json')).json();
await document.fonts.load('700 30px Pix');
await document.fonts.load('700 30px Silk');

// ------------------------------------------------------------------ helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const easeOut = u => { u = clamp(u); return 1 - Math.pow(1 - u, 3); };
const easeIn = u => { u = clamp(u); return u * u * u; };
const lin = u => clamp(u);
const ramp = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
const win = (t, a, b) => t >= a && t < b;
function kf(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const u = ease((t - t0) / Math.max(1e-6, t1 - t0));
      return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
let _seed = 12345;
const rnd = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mul(h, f) { const [r, g, b] = hex2rgb(h); const c = v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }

// ------------------------------------------------------------------ timeline
const CH = TL.chunks, DUR = TL.duration;
const cs = i => CH[i].s, ce = i => CH[i].e, wd = (i, k) => CH[i].words[k];
const T = {
  ask: cs(1), q: cs(2), qEnd: ce(2), ten: TL.cue.ten, noway: cs(3), nowayEnd: ce(3),
  hundred: cs(4), hundredEnd: ce(4), stops: cs(5), thinks: cs(6), looks: cs(7), white: wd(7, 5).s,
  no: cs(8), noEnd: ce(8), crowd: cs(9), thousand: cs(10), thousandEnd: ce(10), scratch: TL.cue.scratch,
  silence: cs(11), yes: cs(12), sayno: cs(13), closes: cs(14), closesEnd: ce(14), and: cs(15),
  happens: cs(16), happensEnd: ce(16), stepback: cs(17), dog: cs(18), dogRun: wd(18, 2).s,
  done: cs(19), pay: cs(20), payEnd: ce(20), wallet: cs(21), walletWord: wd(21, 3).s, five: cs(22),
  looksYou: cs(23), lookHim: cs(24), lookHimEnd: ce(24), run: cs(25), cant: cs(26), never: cs(27),
};
// everything ambient (traffic, idles, falling money) freezes during the "Silence." beat
const FZ0 = T.scratch + 0.45, FZ1 = T.yes - 0.05;
const ambT = t => t < FZ0 ? t : t < FZ1 ? FZ0 : t - (FZ1 - FZ0);
function speaking(t, idxs) {
  for (const i of idxs) for (const w of CH[i].words) if (t >= w.s - 0.02 && t <= w.e) return true;
  return false;
}

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const overlay = document.createElement('canvas');
overlay.width = W; overlay.height = H;
document.body.appendChild(overlay);
const octx = overlay.getContext('2d');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.03, 220);

// ------------------------------------------------------------------ textures
function ctex(w, h, draw, { repeat = null, nearest = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, base, amt = 0.1, p = 0.4) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = rnd();
    if (r < p) { g.fillStyle = mul(base, r < p / 2 ? 1 - amt : 1 + amt * 0.8); g.fillRect(x, y, 1, 1); }
  }
}
function pixText(g, text, x, y, size, color, align = 'center') {
  g.font = `700 ${size}px Pix`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, x, y);
}
// threshold a canvas' alpha so text drawn into tiny textures stays crisp pixel-art
function crisp(g, w, h) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0;
  g.putImageData(id, 0, 0);
}

const matCache = new Map();
function clothMat(color, pattern = 'noise', opts = {}) {
  const key = color + pattern + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const map = ctex(8, 8, (g, w, h) => {
    if (pattern === 'skin') speckle(g, w, h, color, 0.03, 0.25);
    else if (pattern === 'plain') { g.fillStyle = color; g.fillRect(0, 0, w, h); }
    else speckle(g, w, h, color, pattern === 'denim' ? 0.12 : 0.08, pattern === 'denim' ? 0.55 : 0.4);
    if (pattern === 'stripe') { g.fillStyle = mul(color, 0.85); for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h); }
    if (pattern === 'check') { g.fillStyle = mul(color, 0.88); for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h); }
  });
  const m = opts.physical
    ? new THREE.MeshPhysicalMaterial({ map, roughness: opts.rough ?? 0.4, clearcoat: opts.clearcoat ?? 0.7, clearcoatRoughness: 0.15, flatShading: true })
    : new THREE.MeshStandardMaterial({ map, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, flatShading: true });
  matCache.set(key, m);
  return m;
}
const plainMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: true, ...(o.extra || {}) });
const BLACK = plainMat('#141414', { rough: 0.45 });
const WHITE = plainMat('#ffffff', { rough: 0.6 });

// ------------------------------------------------------------------ geometry helpers
function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }
function box(w, h, d, mat, cast = true) { return mesh(new THREE.BoxGeometry(w, h, d), mat, cast); }
function tbox(wt, wb, h, d, mat) {
  const g = new THREE.CylinderGeometry(wt * Math.SQRT1_2, wb * Math.SQRT1_2, h, 4, 1);
  g.rotateY(Math.PI / 4); g.scale(1, 1, d / ((wt + wb) / 2));
  return mesh(g, mat);
}
function at(o, x, y, z) { o.position.set(x, y, z); return o; }
function halfDisc(r, th, lower = true) {
  const g = new THREE.CylinderGeometry(r, r, th, 12, 1, false, lower ? -Math.PI / 2 : Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2); return g;
}

// ------------------------------------------------------------------ sky / lights
scene.background = ctex(2, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#4fa6ec'); gr.addColorStop(0.55, '#8fcaf4'); gr.addColorStop(1, '#d9eefb');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { nearest: false });
scene.fog = new THREE.Fog(0xcfe6f6, 45, 140);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const hemi = new THREE.HemisphereLight(0xe3f2ff, 0xc2a586, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(LQ ? 1024 : 2048, LQ ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ STREET (static, baked)
const stat = new THREE.Group();
// sidewalk tiles
const sidewalkTex = ctex(16, 16, (g, w, h) => {
  speckle(g, w, h, '#cfcac0', 0.05, 0.5);
  g.fillStyle = '#a9a398'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
  g.fillStyle = '#ddd8cf'; g.fillRect(1, 1, w - 1, 1);
}, { repeat: [80, 4] });
const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.95 });
const sw1 = mesh(new THREE.PlaneGeometry(120, 6), sidewalkMat, false); sw1.rotation.x = -Math.PI / 2; at(sw1, 0, 0, -3); stat.add(sw1);
const sw2 = mesh(new THREE.PlaneGeometry(120, 6), sidewalkMat.clone(), false); sw2.material.map = sidewalkTex.clone(); sw2.material.map.repeat.set(80, 4); sw2.material.map.needsUpdate = true;
sw2.rotation.x = -Math.PI / 2; at(sw2, 0, 0, 11); stat.add(sw2);
const roadTex = ctex(32, 32, (g, w, h) => {
  speckle(g, w, h, '#55575c', 0.12, 0.6);
  for (let i = 0; i < 6; i++) { g.fillStyle = '#4a4c50'; g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 3, 1); }
}, { repeat: [60, 4] });
const road = mesh(new THREE.PlaneGeometry(120, 8), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }), false);
road.rotation.x = -Math.PI / 2; at(road, 0, -0.15, 4); stat.add(road);
const curbMat = clothMat('#b9b4aa', 'noise');
stat.add(at(box(120, 0.17, 0.25, curbMat, false), 0, -0.07, -0.1));
stat.add(at(box(120, 0.17, 0.25, curbMat, false), 0, -0.07, 8.1));
// lane markings
const yellowMat = clothMat('#f2c53d', 'noise', { rough: 0.7 });
const lineWhite = clothMat('#f4f4ee', 'noise', { rough: 0.7 });
stat.add(at(box(120, 0.02, 0.1, yellowMat, false), 0, -0.14, 3.9));
stat.add(at(box(120, 0.02, 0.1, yellowMat, false), 0, -0.14, 4.1));
for (let x = -60; x < 60; x += 4) { stat.add(at(box(2, 0.02, 0.12, lineWhite, false), x, -0.14, 0.6)); stat.add(at(box(2, 0.02, 0.12, lineWhite, false), x, -0.14, 7.4)); }
for (let z = 0.5; z < 7.8; z += 0.9) stat.add(at(box(2.6, 0.02, 0.5, lineWhite, false), -13, -0.14, z));

// building facades
const SIGNS = ['PIZZA', 'DELI', 'BANK', 'TACOS', 'COFFEE', 'SHOES', 'BAGELS', 'BARBER', 'LAUNDRY', 'BOOKS', 'DONUTS', 'GYM', 'PAWN', 'SUSHI', 'FLOWERS', 'BURGERS'];
const WALLS = ['#c8644f', '#e8d8b8', '#7fb7b0', '#b9a3d6', '#e3b56b', '#9cc28a', '#d98b7a', '#c9c3b8', '#8fb1d9', '#e6a3a3'];
const AWN = [['#e2483d', '#f6efe2'], ['#2f8f5a', '#f6efe2'], ['#2f62b5', '#ffffff'], ['#f2a72e', '#fff4dc'], ['#8e44ad', '#f6efe2']];
function wallTex(color, brick) {
  return ctex(16, 16, (g, w, h) => {
    speckle(g, w, h, color, 0.07, 0.45);
    if (brick) {
      g.fillStyle = mul(color, 0.8);
      for (let y = 0; y < h; y += 4) { g.fillRect(0, y, w, 1); const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < w; x += 8) g.fillRect(x, y, 1, 4); }
    }
  });
}
const glassTex = ctex(16, 16, (g, w, h) => {
  speckle(g, w, h, '#3d5f86', 0.08, 0.3);
  g.fillStyle = '#7fb0dc'; for (let i = 0; i < 6; i++) g.fillRect(3 + i, 12 - i, 2, 1);
  g.fillStyle = '#a9d1f2'; g.fillRect(10, 3, 2, 1); g.fillRect(11, 2, 1, 1);
});
const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.15, metalness: 0.3 });
const frameMat = clothMat('#f3efe6', 'noise');
const darkMat = clothMat('#3b2f2a', 'noise');
let signIdx = 0;
function building(x0, w, h, front, side) {
  const g = new THREE.Group();
  const col = WALLS[Math.floor(rnd() * WALLS.length)];
  const brick = rnd() < 0.5;
  const wt = wallTex(col, brick); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(w / 1.2, h / 1.2);
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9, flatShading: true });
  g.add(at(box(w, h, 6, wm, false), w / 2, h / 2, -3));
  g.add(at(box(w + 0.2, 0.35, 0.45, clothMat(mul(col, 0.8))), w / 2, h - 0.1, 0.1));
  // upper windows
  const cols = Math.max(2, Math.floor(w / 1.9));
  for (let fy = 4.6; fy < h - 1.2; fy += 2.9) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * w / cols;
    g.add(at(box(1.0, 1.45, 0.1, frameMat, false), x, fy, 0.03));
    g.add(at(box(0.82, 1.27, 0.1, glassMat, false), x, fy, 0.07));
    g.add(at(box(1.15, 0.1, 0.22, frameMat, false), x, fy - 0.78, 0.1));
  }
  // shop front
  const sw = w - 2.2;
  g.add(at(box(sw + 0.2, 2.5, 0.12, darkMat, false), 1.0 + sw / 2, 1.35, 0.04));
  g.add(at(box(sw, 2.3, 0.12, glassMat, false), 1.0 + sw / 2, 1.35, 0.08));
  g.add(at(box(0.95, 2.3, 0.1, clothMat(mul(col, 0.55)), false), 0.55, 1.15, 0.06));
  g.add(at(box(0.12, 0.12, 0.06, clothMat('#e8c45a'), false), 0.85, 1.1, 0.13));
  // awning (stripes)
  const [a1, a2] = AWN[Math.floor(rnd() * AWN.length)];
  const awT = ctex(16, 8, (gg, ww, hh) => { for (let x = 0; x < ww; x++) { gg.fillStyle = (Math.floor(x / 2) % 2) ? a1 : a2; gg.fillRect(x, 0, 1, hh); } gg.fillStyle = mul(a1, 0.75); gg.fillRect(0, hh - 1, ww, 1); });
  awT.wrapS = THREE.RepeatWrapping; awT.repeat.set(w / 2.2, 1);
  const aw = box(w - 0.4, 0.06, 1.5, new THREE.MeshStandardMaterial({ map: awT, roughness: 0.85 }), true);
  aw.rotation.x = 0.38; at(aw, w / 2, 3.05, 0.72); g.add(aw);
  const valT = awT.clone(); valT.needsUpdate = true;
  g.add(at(box(w - 0.4, 0.3, 0.04, new THREE.MeshStandardMaterial({ map: valT, roughness: 0.85 }), false), w / 2, 2.62, 1.43));
  // sign
  const word = SIGNS[signIdx++ % SIGNS.length];
  const sT = ctex(72, 18, (gg, ww, hh) => {
    gg.fillStyle = '#fbf3df'; gg.fillRect(0, 0, ww, hh); gg.fillStyle = a1; gg.fillRect(0, 0, ww, 2); gg.fillRect(0, hh - 2, ww, 2);
    pixText(gg, word, ww / 2, hh / 2 + 1, 14, '#2b2b2b'); crisp(gg, ww, hh);
    gg.globalCompositeOperation = 'destination-over'; gg.fillStyle = '#fbf3df'; gg.fillRect(0, 0, ww, hh);
  });
  const sm = new THREE.MeshStandardMaterial({ map: sT, roughness: 0.7 });
  g.add(at(box(Math.min(w - 1.2, 4.2), 1.05, 0.14, sm, false), w / 2, 3.95, 0.1));
  g.position.set(x0, 0, front);
  if (side < 0) { g.rotation.y = Math.PI; g.position.x = x0 + w; }
  return g;
}
_seed = 99;
for (let x = -46; x < 46;) { const w = 6 + Math.floor(rnd() * 4); stat.add(building(x, w, 8 + rnd() * 7, -6, 1)); x += w; }
for (let x = -46; x < 46;) { const w = 6 + Math.floor(rnd() * 4); stat.add(building(x, w, 8 + rnd() * 7, 14, -1)); x += w; }

// street props
const poleMat = clothMat('#2f4a3c', 'noise', { rough: 0.5, metal: 0.4 });
function lamp(x, z) {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 6), poleMat), 0, 2.3, 0));
  g.add(at(box(0.08, 0.08, 1.0, poleMat), 0, 4.55, 0.45));
  g.add(at(box(0.36, 0.2, 0.5, poleMat), 0, 4.45, 0.95));
  g.add(at(box(0.3, 0.05, 0.42, plainMat('#fff6cf', { extra: { emissive: '#fff1b0', emissiveIntensity: 0.4 } })), 0, 4.34, 0.95));
  g.position.set(x, 0, z); stat.add(g);
}
[-17, -6, 9.5, 21].forEach(x => lamp(x, -0.45));
[-12, 2, 15].forEach(x => { const l = new THREE.Group(); lamp(x, 8.55); });
const leafMat = clothMat('#5aa64a', 'noise');
const leafMat2 = clothMat('#4b9440', 'noise');
function tree(x, z) {
  const g = new THREE.Group();
  g.add(at(box(1.1, 0.45, 1.1, clothMat('#9a8f80')), 0, 0.22, 0));
  g.add(at(box(0.95, 0.06, 0.95, clothMat('#5a4330')), 0, 0.46, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 6), clothMat('#7a5534')), 0, 1.6, 0));
  const c1 = mesh(new THREE.IcosahedronGeometry(1.15, 0), leafMat); c1.scale.set(1, 0.9, 1); at(c1, 0, 3.3, 0); g.add(c1);
  const c2 = mesh(new THREE.IcosahedronGeometry(0.75, 0), leafMat2); at(c2, 0.5, 3.9, -0.2); g.add(c2);
  g.position.set(x, 0, z); stat.add(g);
}
[-9.5, 12.5, -22, 25].forEach(x => tree(x, -0.95));
[-5, 8, 20].forEach(x => tree(x, 9.1));
// hydrant, trash can, bench, newspaper box
{
  const hm = clothMat('#d8342c', 'noise', { rough: 0.5 });
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.6, 8), hm), 0, 0.3, 0));
  g.add(at(mesh(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), hm), 0, 0.6, 0));
  g.add(at(box(0.42, 0.09, 0.09, hm), 0, 0.45, 0));
  g.position.set(-5.3, 0, -0.55); stat.add(g);
  const tc = new THREE.Group();
  tc.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.9, 8), clothMat('#3f6b4d', 'stripe')), 0, 0.45, 0));
  tc.add(at(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), clothMat('#2d4f38')), 0, 0.92, 0));
  tc.position.set(7.4, 0, -0.6); stat.add(tc);
  const b = new THREE.Group(); const wood = clothMat('#a8723f', 'stripe');
  b.add(at(box(1.8, 0.08, 0.5, wood), 0, 0.48, 0)); b.add(at(box(1.8, 0.45, 0.08, wood), 0, 0.75, -0.25));
  [-0.75, 0.75].forEach(x => b.add(at(box(0.08, 0.48, 0.45, poleMat), x, 0.24, 0)));
  b.position.set(-7.5, 0, -5.0); stat.add(b);
  const nb = new THREE.Group(); nb.add(at(box(0.5, 1.0, 0.45, clothMat('#2e6bc4')), 0, 0.5, 0)); nb.add(at(box(0.4, 0.3, 0.05, glassMat), 0, 0.75, 0.23));
  nb.position.set(-3.9, 0, -5.3); stat.add(nb);
}

// hot dog cart
const cart = new THREE.Group();
{
  const steel = clothMat('#d7dbe0', 'noise', { rough: 0.35, metal: 0.5 });
  cart.add(at(box(1.7, 0.85, 0.85, steel), 0, 0.78, 0));
  const hdT = ctex(40, 12, (g, w, h) => { g.fillStyle = '#e23b2f'; g.fillRect(0, 0, w, h); pixText(g, 'HOT DOGS', w / 2, h / 2 + 1, 9, '#ffe066'); crisp(g, w, h); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#e23b2f'; g.fillRect(0, 0, w, h); });
  cart.add(at(box(1.5, 0.45, 0.04, new THREE.MeshStandardMaterial({ map: hdT, roughness: 0.6 })), 0, 0.85, 0.44));
  [[-0.6, 0.45], [0.6, 0.45], [-0.6, -0.45], [0.6, -0.45]].forEach(([x, z]) => { const wh = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), BLACK); wh.rotation.x = Math.PI / 2; at(wh, x, 0.2, z); cart.add(wh); });
  cart.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), steel), 0.6, 2.0, -0.2));
  const umT = ctex(16, 4, (g, w, h) => { for (let x = 0; x < w; x++) { g.fillStyle = (Math.floor(x / 2) % 2) ? '#e8382d' : '#ffd23f'; g.fillRect(x, 0, 1, h); } });
  const um = mesh(new THREE.ConeGeometry(1.25, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: umT, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }));
  at(um, 0.6, 2.95, -0.2); cart.add(um);
  cart.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), clothMat('#e33')), -0.5, 1.32, 0.2));
  cart.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), clothMat('#f5d02c')), -0.35, 1.32, 0.2));
  cart.add(at(box(0.5, 0.06, 0.3, steel), 0.3, 1.24, 0.1));
  cart.position.set(5.4, 0, -1.25);
  stat.add(cart);
}

// bake static geometry by material to keep draw calls low
function bake(group, castFn) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: false });
    const b = buckets.get(key); b.geos.push(g); b.cast = b.cast || o.castShadow;
  });
  const out = new THREE.Group();
  for (const { mat, geos, cast } of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.receiveShadow = true; m.castShadow = cast; out.add(m);
  }
  return out;
}
scene.add(bake(stat));
const ground = mesh(new THREE.PlaneGeometry(400, 400), plainMat('#8f8a80'), false);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; scene.add(ground);

// ------------------------------------------------------------------ TAXIS
const taxis = [];
function makeTaxi() {
  const g = new THREE.Group();
  const yel = clothMat('#f6c331', 'noise', { rough: 0.35 });
  const chk = ctex(16, 2, (gg, w, h) => { for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { gg.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; gg.fillRect(x, y, 1, 1); } });
  chk.wrapS = THREE.RepeatWrapping; chk.repeat.set(3, 1);
  const glass = new THREE.MeshStandardMaterial({ color: '#2b3a4c', roughness: 0.1, metalness: 0.5 });
  g.add(at(box(4.2, 0.7, 1.85, yel), 0, 0.62, 0));
  g.add(at(box(2.3, 0.62, 1.62, yel), -0.2, 1.28, 0));
  g.add(at(box(2.1, 0.46, 1.66, glass), -0.2, 1.3, 0));
  g.add(at(box(2.34, 0.46, 1.5, glass), -0.2, 1.3, 0));
  g.add(at(box(4.22, 0.12, 1.87, new THREE.MeshStandardMaterial({ map: chk, roughness: 0.5 })), 0, 0.78, 0));
  const tT = ctex(24, 8, (gg, w, h) => { gg.fillStyle = '#fff3b0'; gg.fillRect(0, 0, w, h); pixText(gg, 'TAXI', w / 2, h / 2 + 1, 7, '#222'); crisp(gg, w, h); gg.globalCompositeOperation = 'destination-over'; gg.fillStyle = '#fff3b0'; gg.fillRect(0, 0, w, h); });
  g.add(at(box(0.75, 0.24, 0.32, new THREE.MeshStandardMaterial({ map: tT, roughness: 0.5, emissive: '#3a3000' })), -0.2, 1.72, 0));
  [[1.35, 0.86], [-1.35, 0.86], [1.35, -0.86], [-1.35, -0.86]].forEach(([x, z]) => {
    const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), plainMat('#1a1a1a')); w.rotation.x = Math.PI / 2; at(w, x, 0.34, z); g.add(w);
    const hc = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.27, 8), plainMat('#bbbbbb', { metal: 0.6, rough: 0.3 })); hc.rotation.x = Math.PI / 2; at(hc, x, 0.34, z); g.add(hc);
  });
  [0.6, -0.6].forEach(z => { g.add(at(box(0.06, 0.16, 0.35, plainMat('#fffbe0', { extra: { emissive: '#fff4b0', emissiveIntensity: 0.6 } })), 2.1, 0.7, z)); g.add(at(box(0.06, 0.14, 0.3, plainMat('#d0302a')), -2.1, 0.72, z)); });
  g.add(at(box(0.15, 0.18, 1.9, plainMat('#9a9a9a', { metal: 0.5 })), 2.15, 0.38, 0));
  g.add(at(box(0.15, 0.18, 1.9, plainMat('#9a9a9a', { metal: 0.5 })), -2.15, 0.38, 0));
  const b = bake(g); scene.add(b); return b;
}
for (let i = 0; i < 5; i++) taxis.push({ obj: makeTaxi(), lane: i % 2, off: i * 23 + (i % 2) * 9, speed: 8 + (i % 3) });

// ------------------------------------------------------------------ PEOPLE
const icoGeo = new THREE.IcosahedronGeometry(0.25, 1);
const SKULL = [1, 1.06, 0.95];
function dome(r, frac, mat) {
  const m = mesh(new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI * frac), mat);
  m.scale.set(...SKULL); return m;
}
function makePerson(o) {
  const S = o.scale || 1;
  const skinM = clothMat(o.skin, 'skin');
  const shirtM = o.shirtMat || clothMat(o.shirt, o.shirtPattern || 'noise');
  const pantsM = o.pantsMat || clothMat(o.pants, o.pantsPattern || 'denim');
  const shoeM = clothMat(o.shoes || '#2a2a2a', 'noise', { rough: 0.5 });
  const hairM = clothMat(o.hairC || '#2a1b12', 'noise');
  const root = new THREE.Group(); const body = new THREE.Group(); body.scale.setScalar(S); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.86; body.add(hips);
  const pelvis = tbox(0.37, 0.35, 0.22, 0.24, pantsM); pelvis.position.y = 0.03; hips.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  const chest = tbox(0.46, 0.38, 0.48, 0.26, shirtM); chest.position.y = 0.23; torso.add(chest);
  if (o.dress) { const sk = tbox(0.38, 0.56, 0.5, 0.36, shirtM); sk.position.y = -0.18; hips.add(sk); }
  const neck = tbox(0.11, 0.11, 0.1, 0.11, skinM); neck.position.y = 0.5; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.5; torso.add(head);
  const face = new THREE.Group(); face.position.y = 0.24; head.add(face);
  const skull = mesh(icoGeo, skinM); skull.scale.set(...SKULL); face.add(skull);
  // pixel eyes
  const eyes = [-1, 1].map(s => { const g = new THREE.Group(); at(g, s * 0.088, 0.03, 0.2); g.add(box(0.062, 0.105, 0.07, BLACK, false)); face.add(g); return g; });
  const brows = [-1, 1].map(s => { const b = box(0.09, 0.024, 0.05, clothMat(mul(o.hairC || '#2a1b12', 0.8)), false); at(b, s * 0.09, 0.128, 0.205); face.add(b); b.visible = !!o.brows; return b; });
  face.add(at(box(0.052, 0.08, 0.07, clothMat(mul(o.skin, 0.9), 'skin'), false), 0, -0.035, 0.225));
  [-1, 1].forEach(s => face.add(at(box(0.05, 0.1, 0.07, skinM, false), s * 0.245, 0.0, -0.01)));
  // mouths
  const mouth = new THREE.Group(); at(mouth, 0, -0.112, 0.198); face.add(mouth);
  const M = {};
  M.grin = new THREE.Group(); M.grin.add(at(mesh(halfDisc(0.088, 0.045), BLACK, false), 0, 0.02, 0)); M.grin.add(at(box(0.15, 0.03, 0.05, WHITE, false), 0, 0.006, 0.004));
  M.smile = at(mesh(halfDisc(0.07, 0.045), BLACK, false), 0, 0.015, 0); M.smile.scale.y = 0.42;
  M.flat = box(0.1, 0.022, 0.045, BLACK, false);
  M.tight = box(0.06, 0.02, 0.045, BLACK, false);
  M.o = at(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.045, 10).rotateX(Math.PI / 2), BLACK, false), 0, -0.015, 0);
  M.O = at(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.045, 10).rotateX(Math.PI / 2), BLACK, false), 0, -0.025, 0); M.O.scale.y = 1.2;
  M.frown = at(mesh(halfDisc(0.065, 0.045, false), BLACK, false), 0, -0.03, 0); M.frown.scale.y = 0.42;
  M.wavy = new THREE.Group(); for (let i = 0; i < 5; i++) M.wavy.add(at(box(0.026, 0.02, 0.045, BLACK, false), -0.052 + i * 0.026, (i % 2) * 0.016, 0));
  for (const k in M) { mouth.add(M[k]); M[k].visible = false; }
  M.grin.visible = true;
  // hair styles
  const hs = o.hair;
  const addDome = (r, frac, mat, tilt = -0.38, y = 0.03) => { const d = dome(r, frac, mat); d.rotation.x = tilt; d.position.y = y; face.add(d); return d; };
  if (hs === 'cap') {
    const capM = clothMat(o.capC || '#e23b3b', 'noise');
    addDome(0.272, 0.5, capM, -0.15, 0.06);
    const brim = box(0.25, 0.028, 0.2, clothMat(mul(o.capC || '#e23b3b', 0.8))); brim.rotation.x = -0.15; at(brim, 0, 0.075, -0.33); face.add(brim);
    face.add(at(box(0.05, 0.03, 0.05, capM), 0, 0.33, -0.02));
    face.add(at(box(0.09, 0.05, 0.04, hairM, false), 0, 0.16, 0.235));
    face.add(at(box(0.11, 0.035, 0.03, clothMat('#f0e6d0')), 0, 0.11, 0.25));
    [-1, 1].forEach(s => face.add(at(box(0.04, 0.09, 0.12, hairM, false), s * 0.245, 0.0, -0.06)));
  } else if (hs === 'neat') {
    addDome(0.27, 0.42, hairM);
    const q = box(0.33, 0.075, 0.17, hairM); q.rotation.z = 0.06; q.rotation.x = -0.25; at(q, 0.02, 0.215, 0.1); face.add(q);
    face.add(at(box(0.42, 0.24, 0.12, hairM), 0, 0.01, -0.19));
    [-1, 1].forEach(s => face.add(at(box(0.035, 0.1, 0.07, hairM, false), s * 0.243, 0.03, 0.04)));
  } else if (hs === 'bun') {
    addDome(0.27, 0.45, hairM); face.add(at(mesh(new THREE.IcosahedronGeometry(0.11, 0), hairM), 0, 0.22, -0.2));
    face.add(at(box(0.42, 0.26, 0.12, hairM), 0, 0.0, -0.19));
  } else if (hs === 'long') {
    addDome(0.27, 0.45, hairM);
    face.add(at(box(0.48, 0.5, 0.12, hairM), 0, -0.12, -0.18));
    [-1, 1].forEach(s => face.add(at(box(0.07, 0.4, 0.17, hairM), s * 0.24, -0.08, -0.04)));
  } else if (hs === 'flatcap') {
    const cm = clothMat(o.capC || '#7b6a55', 'check');
    addDome(0.27, 0.36, cm, -0.2, 0.05);
    face.add(at(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.07, 8), cm), 0, 0.2, -0.01));
    const br = box(0.26, 0.03, 0.12, cm); br.rotation.x = 0.2; at(br, 0, 0.17, 0.28); face.add(br);
    [-1, 1].forEach(s => face.add(at(box(0.04, 0.08, 0.13, clothMat('#cfcfcf')), s * 0.245, -0.01, -0.05)));
  } else if (hs === 'beanie') {
    const bm = clothMat(o.capC || '#d94848', 'stripe');
    addDome(0.275, 0.5, bm, -0.25, 0.05);
    face.add(at(mesh(new THREE.IcosahedronGeometry(0.065, 0), clothMat('#ffffff')), 0, 0.33, -0.05));
    [-1, 1].forEach(s => face.add(at(box(0.04, 0.08, 0.12, hairM, false), s * 0.245, 0.0, -0.06)));
  } else if (hs === 'bald') {
    face.add(at(box(0.42, 0.13, 0.1, hairM), 0, -0.02, -0.21));
    [-1, 1].forEach(s => face.add(at(box(0.05, 0.12, 0.2, hairM), s * 0.24, 0.0, -0.08)));
  } else if (hs === 'curly') {
    addDome(0.265, 0.42, hairM);
    [[0, 0.24, 0.05], [0.13, 0.22, -0.02], [-0.13, 0.22, -0.02], [0.17, 0.12, -0.12], [-0.17, 0.12, -0.12], [0, 0.2, -0.15], [0.08, 0.27, -0.08], [-0.08, 0.27, -0.08]]
      .forEach(([x, y, z]) => face.add(at(mesh(new THREE.IcosahedronGeometry(0.085, 0), hairM), x, y, z)));
  } else if (hs === 'paper') {
    addDome(0.265, 0.4, hairM);
    face.add(at(tbox(0.38, 0.42, 0.13, 0.26, clothMat('#ffffff')), 0, 0.27, 0));
  }
  // glasses
  if (o.glasses) {
    const fm = plainMat('#1b1b1b', { rough: 0.3 });
    const lensM = new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2 });
    [-1, 1].forEach(s => {
      const cx = s * 0.092;
      face.add(at(box(0.14, 0.018, 0.018, fm, false), cx, 0.095, 0.25));
      face.add(at(box(0.14, 0.018, 0.018, fm, false), cx, -0.03, 0.25));
      face.add(at(box(0.018, 0.14, 0.018, fm, false), cx - 0.065, 0.032, 0.25));
      face.add(at(box(0.018, 0.14, 0.018, fm, false), cx + 0.065, 0.032, 0.25));
      face.add(at(box(0.12, 0.11, 0.005, lensM, false), cx, 0.032, 0.252));
      face.add(at(box(0.016, 0.016, 0.22, fm, false), s * 0.158, 0.08, 0.13));
    });
    face.add(at(box(0.05, 0.016, 0.016, fm, false), 0, 0.06, 0.25));
  }
  // arms
  const sleeveM = o.shortSleeve ? skinM : shirtM;
  function arm(side) {
    const sh = new THREE.Group(); at(sh, side * 0.27, 0.42, 0); torso.add(sh);
    const ua = tbox(0.125, 0.11, 0.3, 0.12, shirtM); ua.position.y = -0.14; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    const fa = tbox(0.11, 0.1, 0.27, 0.11, sleeveM); fa.position.y = -0.13; el.add(fa);
    const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
    hand.add(at(box(0.1, 0.11, 0.085, skinM), 0, -0.05, 0));
    hand.add(at(box(0.035, 0.055, 0.04, skinM), -side * 0.055, -0.03, 0.035));
    return { sh, el, hand };
  }
  const armL = arm(1), armR = arm(-1);
  function leg(side) {
    const hip = new THREE.Group(); at(hip, side * 0.1, -0.05, 0); hips.add(hip);
    const th = tbox(0.165, 0.145, 0.42, 0.165, pantsM); th.position.y = -0.21; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const sn = tbox(0.145, 0.125, 0.38, 0.145, pantsM); sn.position.y = -0.19; knee.add(sn);
    const ankle = new THREE.Group(); ankle.position.y = -0.38; knee.add(ankle);
    ankle.add(at(box(0.135, 0.085, 0.26, shoeM), 0, 0.03, 0.05));
    return { hip, knee, ankle };
  }
  const legL = leg(1), legR = leg(-1);
  const c = { root, body, hips, torso, head, face, chest, pelvis, eyes, brows, mouth: M, armL, armR, legL, legR, S, o };
  c.setMouth = name => { for (const k in M) M[k].visible = k === name; };
  c.setEyes = (sy = 1, dy = 0, sx = 1) => eyes.forEach(e => { e.scale.set(sx, sy, 1); e.position.y = 0.03 + dy; });
  c.setBrows = (mode) => { // 'none' | 'flat' | 'worried' | 'angry' | 'up'
    brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1; // index0 at -x (char's right)
      b.visible = mode !== 'none' && !!o.brows;
      b.position.y = 0.128 + (mode === 'up' ? 0.03 : mode === 'angry' ? -0.012 : 0);
      b.rotation.z = mode === 'worried' ? s * -0.35 : mode === 'angry' ? s * 0.4 : 0;
    });
  };
  root.traverse(m => { if (m.isMesh && m.castShadow === undefined) m.castShadow = true; });
  scene.add(root);
  return c;
}
function resetPose(c) {
  c.hips.position.set(0, 0.86, 0); c.hips.rotation.set(0, 0, 0); c.torso.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0);
  for (const a of [c.armL, c.armR]) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); a.hand.rotation.set(0, 0, 0); }
  for (const l of [c.legL, c.legR]) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); l.ankle.rotation.set(0, 0, 0); }
  c.armL.sh.rotation.z = 0.09; c.armR.sh.rotation.z = -0.09; c.armL.el.rotation.x = -0.12; c.armR.el.rotation.x = -0.12;
}
function idle(c, t, seed = 0, amt = 1) {
  c.torso.rotation.x += 0.02 * amt * Math.sin(t * 1.9 + seed);
  c.head.rotation.y += 0.05 * amt * noise1(t * 0.6 + seed * 7);
  c.head.rotation.z += 0.03 * amt * noise1(t * 0.5 + seed * 3 + 11);
  c.armL.sh.rotation.x += 0.03 * amt * Math.sin(t * 1.9 + seed + 1);
  c.armR.sh.rotation.x += 0.03 * amt * Math.sin(t * 1.9 + seed + 2);
}
function walkPose(c, ph, amp = 1) {
  const s = Math.sin(ph), k = Math.cos(ph);
  c.legL.hip.rotation.x += -0.48 * amp * s; c.legR.hip.rotation.x += 0.48 * amp * s;
  c.legL.knee.rotation.x += 0.7 * amp * Math.max(0, k); c.legR.knee.rotation.x += 0.7 * amp * Math.max(0, -k);
  c.legL.ankle.rotation.x += -0.2 * amp * Math.max(0, k); c.legR.ankle.rotation.x += -0.2 * amp * Math.max(0, -k);
  c.armL.sh.rotation.x += 0.42 * amp * s; c.armR.sh.rotation.x += -0.42 * amp * s;
  c.hips.position.y -= 0.035 * amp * Math.abs(k);
  c.hips.rotation.y += 0.08 * amp * s;
  c.torso.rotation.y -= 0.1 * amp * s;
}
function runPose(c, ph) {
  const s = Math.sin(ph), k = Math.cos(ph);
  c.legL.hip.rotation.x += -0.95 * s - 0.15; c.legR.hip.rotation.x += 0.95 * s - 0.15;
  c.legL.knee.rotation.x += 0.4 + 1.1 * Math.max(0, k); c.legR.knee.rotation.x += 0.4 + 1.1 * Math.max(0, -k);
  c.armL.sh.rotation.x += 1.0 * s; c.armR.sh.rotation.x += -1.0 * s;
  c.armL.el.rotation.x = -1.5; c.armR.el.rotation.x = -1.5;
  c.torso.rotation.x += 0.28;
  c.hips.position.y += 0.06 * Math.abs(Math.sin(ph)) - 0.04;
  c.hips.rotation.y += 0.12 * s;
}
function waddlePose(c, ph) {
  const s = Math.sin(ph);
  c.legL.hip.rotation.z += 0.24; c.legR.hip.rotation.z -= 0.24;
  c.legL.hip.rotation.x += -0.28 * s - 0.1; c.legR.hip.rotation.x += 0.28 * s - 0.1;
  c.legL.knee.rotation.x += 0.35; c.legR.knee.rotation.x += 0.35;
  c.legL.ankle.rotation.z -= 0.22; c.legR.ankle.rotation.z += 0.22;
  c.hips.rotation.z += 0.16 * s; c.torso.rotation.z -= 0.08 * s;
  c.hips.position.y += -0.07 + 0.035 * Math.abs(s);
  c.armL.sh.rotation.z += 0.45 + 0.1 * s; c.armR.sh.rotation.z -= 0.45 - 0.1 * s;
  c.armL.sh.rotation.x -= 0.3; c.armR.sh.rotation.x -= 0.3;
  c.torso.rotation.x += 0.18;
}
function setArm(a, [x, z, e, hx = 0]) { a.sh.rotation.x = x; a.sh.rotation.z = z; a.el.rotation.x = e; a.hand.rotation.x = hx; }
function addArm(a, [x, z, e]) { a.sh.rotation.x += x; a.sh.rotation.z += z; a.el.rotation.x += e; }
function lookAtYaw(c, target, max = 1.1) {
  const p = c.root.position; let y = Math.atan2(target.x - p.x, target.z - p.z) - c.root.rotation.y;
  while (y > Math.PI) y -= Math.PI * 2; while (y < -Math.PI) y += Math.PI * 2;
  return clamp(y, -max, max);
}
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// ---- cast
const you = makePerson({ skin: '#e2a982', shirt: '#ff8a3d', pants: '#3d5fa3', shoes: '#f2f2f2', hair: 'cap', hairC: '#3a2416', capC: '#e0333a', scale: 0.98 });
// hoodie details
{
  const hm = clothMat('#ff8a3d'); const dk = clothMat('#e0702a');
  const hood = tbox(0.36, 0.42, 0.14, 0.16, dk); at(hood, 0, 0.5, -0.13); you.torso.add(hood);
  you.torso.add(at(box(0.3, 0.13, 0.03, dk), 0, 0.08, 0.132));
  [-0.05, 0.05].forEach(x => you.torso.add(at(box(0.018, 0.13, 0.02, WHITE), x, 0.38, 0.135)));
  you.torso.add(at(box(0.44, 0.06, 0.27, dk), 0, 0.01, 0));
}
const mic = new THREE.Group();
{
  mic.add(at(mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.2, 8), plainMat('#1d1d1d', { rough: 0.4 })), 0, 0.04, 0));
  const mh = mesh(new THREE.IcosahedronGeometry(0.048, 1), clothMat('#6d6d6d', 'check', { rough: 0.4, metal: 0.6 })); at(mh, 0, 0.17, 0); mic.add(mh);
  const flagT = ctex(12, 12, (g, w, h) => { g.fillStyle = '#e8312f'; g.fillRect(0, 0, w, h); pixText(g, 'TV', w / 2, h / 2 + 1, 8, '#fff'); crisp(g, w, h); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#e8312f'; g.fillRect(0, 0, w, h); });
  mic.add(at(box(0.07, 0.07, 0.07, new THREE.MeshStandardMaterial({ map: flagT, roughness: 0.6 })), 0, 0.1, 0));
  mic.rotation.x = Math.PI / 2 * 0.0;
  at(mic, 0, -0.07, 0.03);
  you.armR.hand.add(mic);
}
const whitePants = clothMat('#ffffff', 'plain', { physical: true, rough: 0.28, clearcoat: 0.8 });
const man = makePerson({ skin: '#f0c49c', shirt: '#5d9be8', shirtPattern: 'stripe', pantsMat: whitePants, shoes: '#2a1d16', hair: 'neat', hairC: '#4a2e1b', glasses: true, brows: true });
{
  const tie = tbox(0.07, 0.09, 0.36, 0.03, clothMat('#22396d', 'stripe')); at(tie, 0, 0.27, 0.135); man.torso.add(tie);
  man.torso.add(at(box(0.09, 0.06, 0.04, clothMat('#22396d')), 0, 0.45, 0.13));
  man.torso.add(at(box(0.38, 0.05, 0.27, plainMat('#1a1a1a', { rough: 0.4 })), 0, -0.07, 0));
  man.torso.add(at(box(0.05, 0.04, 0.02, plainMat('#d9b44a', { metal: 0.8, rough: 0.3 })), 0, -0.07, 0.14));
}
const briefcase = new THREE.Group();
{
  const bm = clothMat('#7a4a26', 'noise', { rough: 0.5 });
  briefcase.add(at(box(0.42, 0.3, 0.1, bm), 0, -0.2, 0));
  briefcase.add(at(box(0.14, 0.03, 0.03, plainMat('#3a2412')), 0, -0.03, 0));
  [-0.12, 0.12].forEach(x => briefcase.add(at(box(0.04, 0.04, 0.105, plainMat('#d8b04a', { metal: 0.8, rough: 0.3 })), x, -0.1, 0)));
  briefcase.rotation.y = Math.PI / 2;
  at(briefcase, 0, -0.06, 0); man.armR.hand.add(briefcase);
}
// the unfortunate stain (seat of the pants)
const stain = new THREE.Group();
{
  const sm = clothMat('#8c6a35', 'noise');
  stain.add(at(box(0.16, 0.12, 0.02, sm, false), 0, 0, 0));
  stain.add(at(box(0.08, 0.06, 0.02, sm, false), 0.06, -0.08, 0));
  stain.add(at(box(0.06, 0.08, 0.02, sm, false), -0.07, -0.05, 0));
  at(stain, 0, -0.03, -0.13); man.hips.add(stain); stain.scale.setScalar(0.001);
}
const vendor = makePerson({ skin: '#c98d62', shirt: '#f5f5f0', pants: '#3a3a44', hair: 'paper', hairC: '#1d1410', brows: true });
vendor.torso.add(at(box(0.4, 0.5, 0.03, clothMat('#d8392f', 'noise')), 0, 0.1, 0.135));
vendor.root.position.set(5.6, 0, -2.05);

const CROWD_DEF = [
  { o: { skin: '#c68a5e', shirt: '#e86fa3', pants: '#3b3b58', hair: 'bun', hairC: '#2b1d14' }, ang: 252, from: -1 },
  { o: { skin: '#f0c29a', shirt: '#4caf6e', pants: '#6b5a45', hair: 'flatcap', hairC: '#bcbcbc', capC: '#8a7a62', brows: true }, ang: 288, from: 1 },
  { o: { skin: '#8a5a3c', shirt: '#ffd34d', pants: '#355c9a', hair: 'curly', hairC: '#1d140f', scale: 0.72, shortSleeve: true }, ang: 200, from: -1 },
  { o: { skin: '#e8b58e', shirt: '#8a5cd6', pants: '#2d2d2d', hair: 'beanie', hairC: '#5a3b22', capC: '#3fb6c8' }, ang: 312, from: 1 },
  { o: { skin: '#f3cfb0', shirt: '#e5483f', pants: '#2d2d2d', hair: 'long', hairC: '#c9902f', dress: true, shoes: '#e5483f' }, ang: 228, from: -1 },
  { o: { skin: '#5e3d2a', shirt: '#2fa4a8', pants: '#c9b48a', hair: 'bald', hairC: '#1c1c1c', brows: true }, ang: 340, from: 1 },
  { o: { skin: '#e3a87f', shirt: '#b5d86a', pants: '#4b4b60', hair: 'neat', hairC: '#7a4b22', shortSleeve: true }, ang: 160, from: -1 },
  { o: { skin: '#d39a70', shirt: '#f2efe6', shirtPattern: 'stripe', pants: '#2c4f7c', hair: 'long', hairC: '#111111' }, ang: 20, from: 1 },
];
const CENTER = V(1.4, 0, -1.6);
const crowd = CROWD_DEF.map((d, i) => {
  const c = makePerson(d.o);
  const a = d.ang * Math.PI / 180;
  c.target = V(CENTER.x + 2.25 * Math.cos(a), 0, CENTER.z + 2.25 * Math.sin(a));
  c.start = V(c.target.x + d.from * 6.5, 0, c.target.z + (rnd() - 0.5));
  c.arrive = 15.25 + i * 0.3; c.walkDur = 1.55; c.seed = i * 1.7 + 0.3;
  c.mood = ['smile', 'flat', 'smile', 'flat', 'smile', 'flat', 'flat', 'smile'][i];
  return c;
});

// ---- dog
const dog = (() => {
  const root = new THREE.Group();
  const fur = clothMat('#c98a4b', 'noise'), dark = clothMat('#6b4325', 'noise'), light = clothMat('#ecd2a8', 'noise');
  const body = new THREE.Group(); body.position.y = 0.36; root.add(body);
  body.add(at(box(0.24, 0.22, 0.56, fur), 0, 0, 0));
  body.add(at(box(0.18, 0.12, 0.3, light), 0, -0.07, 0.08));
  const head = new THREE.Group(); at(head, 0, 0.16, 0.3); body.add(head);
  head.add(at(box(0.22, 0.2, 0.22, fur), 0, 0.03, 0.02));
  head.add(at(box(0.12, 0.1, 0.14, light), 0, -0.02, 0.17));
  head.add(at(box(0.05, 0.035, 0.03, BLACK), 0, 0.025, 0.245));
  [-1, 1].forEach(s => head.add(at(box(0.035, 0.05, 0.03, BLACK, false), s * 0.06, 0.07, 0.125)));
  const ears = [-1, 1].map(s => { const e = new THREE.Group(); at(e, s * 0.11, 0.12, 0.0); e.add(at(box(0.05, 0.13, 0.08, dark), 0, -0.06, 0)); e.rotation.z = s * 0.35; head.add(e); return e; });
  const tongue = at(box(0.045, 0.012, 0.07, plainMat('#ff7f9a')), 0, -0.075, 0.2); head.add(tongue);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const l = new THREE.Group(); at(l, sx * 0.08, -0.06, sz * 0.2); l.add(at(box(0.065, 0.28, 0.065, fur), 0, -0.14, 0)); l.add(at(box(0.075, 0.04, 0.09, light), 0, -0.28, 0.015)); body.add(l); return l; });
  const tail = new THREE.Group(); at(tail, 0, 0.08, -0.28); tail.add(at(box(0.045, 0.045, 0.22, dark), 0, 0, -0.1)); body.add(tail);
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(root);
  return { root, body, head, ears, tongue, legs, tail };
})();

// ---- pigeons
const pigeons = [];
for (let i = 0; i < 6; i++) {
  const root = new THREE.Group();
  const grey = clothMat('#8e95a6', 'noise'), dk = clothMat('#5d6372', 'noise'), neckM = clothMat('#5f8f7c', 'noise');
  const body = new THREE.Group(); body.position.y = 0.13; root.add(body);
  const b = mesh(new THREE.IcosahedronGeometry(0.1, 0), grey); b.scale.set(0.8, 0.8, 1.35); body.add(b);
  const head = new THREE.Group(); at(head, 0, 0.1, 0.1); body.add(head);
  head.add(at(mesh(new THREE.IcosahedronGeometry(0.055, 0), neckM), 0, 0, 0));
  head.add(at(box(0.025, 0.02, 0.05, plainMat('#e39a3c')), 0, -0.01, 0.06));
  [-1, 1].forEach(s => head.add(at(box(0.012, 0.018, 0.012, BLACK, false), s * 0.04, 0.012, 0.03)));
  const wings = [-1, 1].map(s => { const w = new THREE.Group(); at(w, s * 0.07, 0.03, 0); w.add(at(box(0.16, 0.02, 0.17, dk), s * 0.08, 0, -0.02)); body.add(w); return w; });
  body.add(at(box(0.08, 0.02, 0.12, dk), 0, 0.01, -0.17));
  [-1, 1].forEach(s => root.add(at(box(0.015, 0.07, 0.015, plainMat('#d9706b')), s * 0.03, 0.035, 0)));
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  root.position.set(-3.9 + i * 0.36 + (i % 2) * 0.1, 0, -1.25 + (i % 3) * 0.36);
  root.rotation.y = (i * 2.3) % (Math.PI * 2);
  scene.add(root);
  pigeons.push({ root, body, head, wings, home: root.position.clone(), yaw0: root.rotation.y, seed: i * 1.3 });
}

// ---- money rain
const billTex = ctex(32, 14, (g, w, h) => {
  g.fillStyle = '#9fd38a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5c9e4c'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
  g.fillStyle = '#e8f5d8'; g.fillRect(12, 3, 8, 8); pixText(g, '$', 16, 7.5, 9, '#2f6b2a'); crisp(g, w, h);
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#9fd38a'; g.fillRect(0, 0, w, h);
});
const billMat = new THREE.MeshStandardMaterial({ map: billTex, roughness: 0.8, side: THREE.DoubleSide });
const billGeo = new THREE.PlaneGeometry(0.32, 0.14);
const bills = [];
_seed = 4242;
for (let i = 0; i < 90; i++) {
  const m = new THREE.Mesh(billGeo, billMat); m.castShadow = true;
  scene.add(m);
  bills.push({ m, x: rr(-1.9, 4.9), z: rr(-4.6, 1.2), y0: rr(3.2, 7.8), t0: T.thousand + 0.05 + rr(0, 0.7), v: rr(1.2, 1.9), r: [rr(-4, 4), rr(-3, 3), rr(-4, 4)], ph: rr(0, 6) });
}

// ---- wallet, $5 bill, moth
const wallet = new THREE.Group();
const walletNormal = () => V(0, 0, 1).applyQuaternion(wallet.quaternion).normalize();
const wInner = new THREE.Group(); wInner.rotation.z = Math.PI; wallet.add(wInner);
const leather = clothMat('#6b3f22', 'noise'), leatherIn = clothMat('#8a5632', 'noise');
const wLeft = new THREE.Group(); wInner.add(wLeft);
wLeft.add(at(box(0.115, 0.09, 0.012, leather), -0.0575, 0, 0));
wLeft.add(at(box(0.1, 0.075, 0.004, leatherIn, false), -0.0575, 0, 0.007));
[0.018, -0.008].forEach(y => wLeft.add(at(box(0.095, 0.004, 0.006, clothMat('#5a341c'), false), -0.0575, y, 0.009)));
const wRightHinge = new THREE.Group(); wInner.add(wRightHinge);
wRightHinge.add(at(box(0.115, 0.09, 0.012, leather), 0.0575, 0, 0));
wRightHinge.add(at(box(0.1, 0.075, 0.004, leatherIn, false), 0.0575, 0, 0.007));
const fiveTex = ctex(64, 28, (g, w, h) => {
  g.fillStyle = '#b9c99a'; g.fillRect(0, 0, w, h); g.fillStyle = '#7e8f62'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
  g.fillStyle = '#d8e0c4'; g.fillRect(22, 5, 20, 18); g.font = '700 16px Silk'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3d4d27'; g.fillText('5', 32, 15); g.font = '700 8px Silk'; g.fillText('5', 9, 8); g.fillText('5', 55, 21); crisp(g, w, h);
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#b9c99a'; g.fillRect(0, 0, w, h);
});
const fivePivot = new THREE.Group(); at(fivePivot, -0.0575, -0.03, 0.011); wInner.add(fivePivot);
const fiveBill = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.045), new THREE.MeshStandardMaterial({ map: fiveTex, roughness: 0.9, side: THREE.DoubleSide }));
fiveBill.position.set(0, 0.0225, 0); fivePivot.add(fiveBill);
const moth = new THREE.Group();
{
  const mm = clothMat('#5e5444', 'noise'), mw = clothMat('#8c7e64', 'noise');
  moth.add(at(box(0.008, 0.008, 0.03, mm, false), 0, 0, 0));
  moth.wings = [-1, 1].map(s => { const w = new THREE.Group(); w.add(at(box(0.03, 0.002, 0.026, mw, false), s * 0.015, 0, -0.002)); moth.add(w); return w; });
  [-1, 1].forEach(s => { const a = box(0.002, 0.002, 0.016, mm, false); a.rotation.y = s * 0.4; at(a, s * 0.004, 0.003, 0.02); moth.add(a); });
}
scene.add(wallet); scene.add(moth);
wallet.scale.setScalar(1.6);
wallet.visible = false; moth.visible = false;

// ------------------------------------------------------------------ PER-FRAME ANIMATION
const MAN_POS2 = 2.0, MAN_POS3 = 1.5, YOU_POS2 = 0.75, Z0 = -1.6;
const YOU_YAW = Math.PI / 2 - 0.3, MAN_YAW = -Math.PI / 2 + 0.34;
function youX(t) {
  if (t < 1.85) { const u = clamp((t - 0.1) / 1.75); return -4.6 + 4.0 * (1.5 * u - 0.5 * u * u * u); }
  if (t < T.hundred - 0.05) return -0.6;
  if (t < T.hundred + 0.9) { const u = clamp((t - T.hundred + 0.05) / 0.95); return -0.6 + 1.35 * (1.5 * u - 0.5 * u * u * u); }
  if (t < T.run + 0.1) return YOU_POS2;
  const tau = t - T.run - 0.1;
  return YOU_POS2 - (tau < 0.3 ? 8.33 * tau * tau : 0.75 + 5 * (tau - 0.3));
}
const MAN_WALK0 = T.noway + 0.5, MAN_STRIDE = 0.54;
function manX(t) {
  if (t < MAN_WALK0) return 0.65;
  if (t < T.stops) return 0.65 + 1.35 * (t - MAN_WALK0) / (T.stops - MAN_WALK0);
  if (t < T.looksYou - 0.35) return MAN_POS2;
  if (t < T.run + 0.55) return lerp(MAN_POS2, MAN_POS3, smooth(ramp(t, T.looksYou - 0.35, T.looksYou + 0.1)));
  const tau = t - T.run - 0.55;
  return MAN_POS3 - (tau < 0.4 ? 0.9 * tau * tau : 0.144 + 1.55 * (tau - 0.4));
}
function talk(c, t, idxs, base, open = 'o') {
  if (speaking(t, idxs) && Math.sin(t * 34) > -0.2) c.setMouth(open); else c.setMouth(base);
}

function updateYou(t) {
  const c = you; resetPose(c);
  const ta = ambT(t);
  const x = youX(t);
  c.root.position.set(x, 0, Z0);
  let yaw = YOU_YAW;
  if (t < 1.85) yaw = Math.PI / 2;
  else if (t < 2.2) yaw = lerp(Math.PI / 2, YOU_YAW, smooth((t - 1.85) / 0.35));
  if (win(t, T.hundred - 0.05, T.hundred + 0.9)) yaw = lerp(YOU_YAW, Math.PI / 2, Math.sin(Math.PI * ramp(t, T.hundred - 0.05, T.hundred + 0.9)));
  if (t >= T.run) yaw = lerp(YOU_YAW, -Math.PI / 2, smooth((t - T.run) / 0.18));
  c.root.rotation.y = yaw;
  const moving = t < 1.85 || win(t, T.hundred - 0.05, T.hundred + 0.9);
  if (t >= T.run + 0.05) {
    const d = YOU_POS2 - x; runPose(c, d / 0.75 * Math.PI);
  } else if (moving) {
    const amp = t < 1.85 ? clamp((1.85 - t) / 0.25) : clamp(Math.min(t - T.hundred + 0.05, T.hundred + 0.9 - t) / 0.15);
    walkPose(c, (x + 10) / 0.55 * Math.PI, amp);
  } else idle(c, ta, 1.3);
  // right (mic) arm
  const DOWN = [0.15, -0.12, -0.35], OUT = [-1.32, 0.16, -0.18], MOUTH = [-0.55, 0.5, -2.05], WAL = [-0.72, 0.3, -1.15];
  const keys = [[0, DOWN], [T.ask, DOWN], [T.ask + 0.35, OUT], [T.q - 0.3, OUT], [T.q - 0.05, MOUTH], [T.qEnd, MOUTH], [T.qEnd + 0.3, OUT],
    [T.hundred - 0.25, OUT], [T.hundred, MOUTH], [T.hundredEnd + 0.05, MOUTH], [T.hundredEnd + 0.35, OUT],
    [T.thousand - 0.3, OUT], [T.thousand - 0.05, MOUTH], [T.thousandEnd + 0.1, MOUTH], [T.thousandEnd + 0.45, OUT],
    [T.wallet - 0.75, OUT], [T.wallet - 0.35, WAL], [T.looksYou - 0.3, WAL], [T.looksYou + 0.1, DOWN]];
  if (t < T.run + 0.05) {
    const ra = kf(t, keys); addArm(c.armR, [ra[0], ra[1] + 0.09, ra[2] + 0.12]);
    if (win(t, T.wallet - 0.6, T.looksYou)) addArm(c.armL, [lerp(0, -0.72, smooth(ramp(t, T.wallet - 0.6, T.wallet - 0.3))), lerp(0, -0.38, smooth(ramp(t, T.wallet - 0.6, T.wallet - 0.3))), lerp(0, -1.03, smooth(ramp(t, T.wallet - 0.6, T.wallet - 0.3)))]);
  }
  mic.visible = !win(t, T.wallet - 0.45, T.looksYou - 0.15);
  // face
  c.setEyes(1, 0);
  let base = 'grin';
  if (win(t, T.wallet - 0.5, T.looksYou)) base = 'grin';
  if (t > T.run) { base = 'O'; c.setEyes(1.25, 0.005); }
  talk(c, t, [2, 4, 10], base, 'O');
  if (win(t, T.lookHim - 0.2, T.run)) c.setEyes(1.15, 0);
  if (win(t, T.thousand - 0.3, T.thousandEnd + 0.5)) { c.head.rotation.x -= 0.08; c.torso.rotation.x += 0.08; }
}

function updateMan(t) {
  const c = man; resetPose(c);
  const ta = ambT(t);
  const x = manX(t);
  c.root.position.set(x, 0, Z0);
  // facing
  let yaw;
  if (t < 1.55) yaw = -0.35;
  else if (t < MAN_WALK0 - 0.35) yaw = lerp(-0.35, MAN_YAW, smooth((t - 1.55) / 0.4));
  else if (t < T.no - 0.45) yaw = lerp(MAN_YAW, Math.PI / 2, smooth((t - MAN_WALK0 + 0.35) / 0.4));
  else if (t < T.run + 0.4) yaw = lerp(Math.PI / 2, MAN_YAW, smooth((t - T.no + 0.45) / 0.35));
  else yaw = lerp(MAN_YAW, -Math.PI / 2, smooth((t - T.run - 0.4) / 0.25));
  c.root.rotation.y = yaw;
  const walking = win(t, MAN_WALK0, T.no - 0.25);
  if (t >= T.run + 0.55) {
    waddlePose(c, (MAN_POS3 - x) / 0.32 * Math.PI);
  } else if (walking) {
    const amp = t < T.stops ? clamp((t - MAN_WALK0) / 0.2) : 1 - smooth(ramp(t, T.no - 0.5, T.no - 0.25));
    walkPose(c, (x - 0.65) / MAN_STRIDE * Math.PI, amp);
  } else if (win(t, T.looksYou - 0.35, T.looksYou + 0.1)) {
    walkPose(c, (MAN_POS2 - x) / 0.5 * Math.PI, Math.sin(Math.PI * ramp(t, T.looksYou - 0.35, T.looksYou + 0.1)));
  } else if (t < T.stops || t > T.no) idle(c, ta, 2.1, 0.8);
  // briefcase arm a bit out
  addArm(c.armR, [0.05, -0.08, 0.05]);
  // watch check at start
  if (t < 1.75) {
    const w = 1 - smooth(ramp(t, 1.45, 1.75));
    addArm(c.armL, [-0.95 * w, -0.4 * w, -1.55 * w]);
    c.head.rotation.x += 0.38 * w; c.head.rotation.y += 0.25 * w;
  }
  // head shake "No way"
  if (win(t, T.noway - 0.05, T.noway + 0.7)) c.head.rotation.y += 0.45 * Math.sin((t - T.noway + 0.05) * 2 * Math.PI * 3.2) * Math.sin(Math.PI * ramp(t, T.noway - 0.05, T.noway + 0.7));
  // He stops (frozen) -> thinks (hand to chin, look up) -> looks at pants
  if (win(t, T.thinks - 0.15, T.looks)) {
    const w = smooth(ramp(t, T.thinks - 0.15, T.thinks + 0.2)) * (1 - smooth(ramp(t, T.looks - 0.25, T.looks)));
    addArm(c.armL, [-0.65 * w, -0.42 * w, -2.0 * w]);
    c.head.rotation.x -= 0.32 * w; c.head.rotation.z += 0.12 * w;
  }
  if (win(t, T.looks - 0.1, T.no - 0.3)) {
    const w = smooth(ramp(t, T.looks - 0.1, T.looks + 0.3)) * (1 - smooth(ramp(t, T.no - 0.6, T.no - 0.3)));
    c.head.rotation.x += 0.62 * w; c.torso.rotation.x += 0.12 * w;
  }
  // slow "No."
  if (win(t, T.no - 0.05, T.no + 1.25)) c.head.rotation.y += 0.32 * Math.sin((t - T.no + 0.05) * 2 * Math.PI * 1.25) * Math.sin(Math.PI * ramp(t, T.no - 0.05, T.no + 1.25));
  // $1,000 lean back
  if (win(t, T.thousand, T.yes)) { const w = smooth(ramp(t, T.thousand, T.thousand + 0.3)); c.torso.rotation.x -= 0.1 * w; c.head.rotation.x -= 0.06 * w; }
  // straining / "it happens"
  if (win(t, T.happens - 0.1, T.happensEnd + 0.6)) {
    const w = Math.sin(Math.PI * ramp(t, T.happens - 0.1, T.happensEnd + 0.6));
    c.hips.position.y -= 0.05 * w; c.legL.knee.rotation.x += 0.2 * w; c.legR.knee.rotation.x += 0.2 * w;
    c.legL.hip.rotation.x -= 0.1 * w; c.legR.hip.rotation.x -= 0.1 * w;
    c.head.rotation.z += 0.025 * Math.sin(t * 70) * w; c.torso.rotation.z += 0.015 * Math.sin(t * 63) * w;
  }
  // proud "Done. Pay me."
  if (win(t, T.done - 0.15, T.looksYou - 0.1)) {
    const w = smooth(ramp(t, T.done - 0.15, T.done + 0.2)) * (1 - smooth(ramp(t, T.looksYou - 0.5, T.looksYou - 0.1)));
    c.torso.rotation.x -= 0.12 * w; c.head.rotation.x -= 0.18 * w;
    const h = smooth(ramp(t, T.pay - 0.2, T.pay + 0.15)) * (1 - smooth(ramp(t, T.looksYou - 0.5, T.looksYou - 0.1)));
    addArm(c.armL, [-1.25 * h, -0.15 * h, -0.3 * h]);
    c.armL.hand.rotation.y = -1.3 * h;
  }
  // face
  let mouth = 'smile', ey = 1, edy = 0, brows = 'flat';
  if (t < 1.6) mouth = 'flat';
  if (t > T.q + 0.4) mouth = 'flat';
  if (t > T.noway - 0.05) mouth = 'frown';
  if (t > T.nowayEnd + 0.2) mouth = 'flat';
  if (t > T.stops) { mouth = 'o'; brows = 'up'; }
  if (t > T.thinks - 0.1) { mouth = 'tight'; edy = 0.018; brows = 'flat'; }
  if (t > T.looks) { mouth = 'flat'; edy = -0.01; }
  if (t > T.no - 0.3) { mouth = 'frown'; edy = 0; }
  if (t > T.noEnd + 0.4) mouth = 'flat';
  if (t > T.thousand + 0.05) { mouth = 'O'; ey = 1.25; brows = 'up'; }
  if (t > T.scratch) { mouth = 'flat'; ey = 1.1; brows = 'flat'; }
  if (t > T.yes - 0.1) { mouth = 'wavy'; ey = 1; brows = 'worried'; }
  if (t > T.closes) { mouth = 'tight'; }
  if (t > T.closes + 0.45) ey = lerp(1, 0.1, smooth(ramp(t, T.closes + 0.45, T.closesEnd - 0.1)));
  if (t > T.happens - 0.1) { mouth = 'wavy'; ey = 0.1; brows = 'worried'; }
  if (t > T.happensEnd + 0.3) { mouth = 'smile'; ey = 0.1; brows = 'flat'; }
  if (t > T.stepback - 0.1) { ey = 0.7; }
  if (t > T.done - 0.2) { mouth = 'grin'; ey = 0.75; brows = 'up'; }
  if (t > T.looksYou - 0.25) { mouth = 'flat'; ey = 0.55; brows = 'angry'; }
  if (t > T.run + 0.3) { mouth = 'frown'; ey = 0.55; brows = 'angry'; }
  c.setEyes(ey, edy); c.setBrows(brows);
  talk(c, t, [3, 8, 19, 20], mouth, 'o');
  // stain grows
  const st = smooth(ramp(t, T.happensEnd - 0.2, T.happensEnd + 0.8));
  stain.scale.setScalar(Math.max(0.001, st));
}

function updateCrowd(t) {
  const ta = ambT(t);
  const manP = man.root.position;
  crowd.forEach((c, i) => {
    resetPose(c);
    const u = (t - c.arrive) / c.walkDur;
    let pos;
    if (u <= 0) { c.root.visible = false; return; }
    c.root.visible = true;
    if (u < 1) {
      const e = 1.5 * u - 0.5 * u * u * u;
      pos = c.start.clone().lerp(c.target, e);
      c.root.rotation.y = yawTo(c.start, c.target);
      walkPose(c, pos.distanceTo(c.start) / 0.55 * Math.PI, clamp((1 - u) / 0.15));
    } else {
      pos = c.target.clone();
      const toMan = yawTo(c.target, manP);
      c.root.rotation.y = lerp(yawTo(c.start, c.target), toMan, smooth((u - 1) * 3));
      idle(c, ta, c.seed);
    }
    // step back
    const sb = T.stepback + 0.05 + i * 0.045;
    if (t > sb) {
      const dir = c.target.clone().sub(manP).setY(0).normalize();
      const k = easeOut((t - sb) / 0.38);
      pos.addScaledVector(dir, 1.25 * k);
      pos.y = 0.3 * Math.sin(Math.PI * clamp((t - sb) / 0.38));
      c.torso.rotation.x -= 0.25 * Math.sin(Math.PI * clamp((t - sb) / 0.5));
      if (i % 3 === 0) { const w = smooth((t - sb - 0.2) / 0.3); addArm(c.armR, [-0.75 * w, 0.42 * w, -2.1 * w]); }
      else if (i % 3 === 1) { const w = smooth((t - sb) / 0.25); addArm(c.armL, [-0.5 * w, 0.25 * w, -0.6 * w]); addArm(c.armR, [-0.5 * w, -0.25 * w, -0.6 * w]); }
    }
    c.root.position.copy(pos);
    // gaze: man, later the chase
    if (u >= 1) {
      let target = manP.clone();
      if (t > T.run + 0.2) target = V(you.root.position.x * 0.5 + manP.x * 0.5, 0, Z0);
      c.head.rotation.y += lookAtYaw(c, target, 0.9);
    }
    // face
    let m = c.mood, ey = 1, br = 'flat';
    if (t > T.thousand + 0.1 + i * 0.04) { m = 'O'; ey = 1.2; br = 'up'; }
    if (t > T.thousandEnd + 0.4) { m = 'o'; ey = 1.1; }
    if (t > T.scratch) { m = 'flat'; ey = 1.15; br = 'flat'; }
    if (t > T.happens + 0.3) { m = 'o'; ey = 1.2; br = 'up'; }
    if (t > T.stepback) { m = 'wavy'; ey = 0.45; br = 'worried'; }
    if (t > T.run + 0.4) { m = (i % 2) ? 'O' : 'wavy'; ey = 1.1; }
    c.setMouth(m); c.setEyes(ey, 0); c.setBrows(br);
  });
  // vendor
  resetPose(vendor); idle(vendor, ta, 5);
  vendor.root.rotation.y = 0.2;
  vendor.head.rotation.y += lookAtYaw(vendor, manP, 1.0);
  vendor.setMouth(t > T.stepback ? 'wavy' : t > T.thousand ? 'O' : 'smile');
  vendor.setEyes(t > T.stepback ? 0.45 : 1, 0); vendor.setBrows(t > T.stepback ? 'worried' : 'flat');
  if (t > T.stepback + 0.1) { const w = smooth((t - T.stepback - 0.1) / 0.3); addArm(vendor.armR, [-0.75 * w, 0.42 * w, -2.1 * w]); }
}

function updateDog(t) {
  const ta = ambT(t);
  const home = V(-0.95, 0, -0.2);
  const runT = T.dogRun - 0.25;
  dog.body.rotation.set(0, 0, 0); dog.head.rotation.set(0, 0, 0); dog.body.position.y = 0.36;
  if (t < runT) {
    dog.root.position.copy(home);
    dog.root.rotation.y = yawTo(home, man.root.position) - 0.3;
    dog.tail.rotation.set(0.6, 0.6 * Math.sin(ta * 16), 0);
    dog.head.rotation.z = 0.15 * Math.sin(ta * 1.3);
    dog.head.rotation.y = 0.2 * noise1(ta * 0.7);
    dog.legs.forEach(l => l.rotation.set(0, 0, 0));
    dog.tongue.visible = t < T.happens;
    dog.ears.forEach((e, i) => e.rotation.z = (i ? 1 : -1) * 0.35);
    if (t > T.happens + 0.4) { dog.head.rotation.x = -0.25; dog.ears.forEach((e, i) => e.rotation.z = (i ? 1 : -1) * 0.1); }
  } else {
    const tau = t - runT;
    const turn = smooth(tau / 0.15);
    dog.root.rotation.y = lerp(yawTo(home, man.root.position) - 0.3, -Math.PI / 2 + 0.18, turn);
    const d = tau < 0.15 ? 0 : 5.2 * (tau - 0.15);
    dog.root.position.set(home.x - d, 0, home.z + d * 0.18);
    const ph = tau * 22;
    dog.legs.forEach((l, i) => l.rotation.x = (i < 2 ? 1 : -1) * 0.9 * Math.sin(ph + (i % 2) * 0.5));
    dog.body.rotation.x = 0.12 * Math.sin(ph);
    dog.body.position.y = 0.36 + 0.06 * Math.abs(Math.sin(ph));
    dog.tail.rotation.set(-0.2, 0, 0);
    dog.ears.forEach((e, i) => e.rotation.z = (i ? 1 : -1) * (1.0 + 0.4 * Math.sin(ph * 2)));
    dog.tongue.visible = true;
  }
}

function updatePigeons(t) {
  const ta = ambT(t);
  pigeons.forEach((p, i) => {
    const fly = T.dogRun + 0.15 + i * 0.06;
    const tf = ta - (ambT(fly));
    p.wings.forEach((w, k) => w.rotation.z = 0);
    if (t < fly) {
      p.root.position.copy(p.home);
      p.root.rotation.y = p.yaw0 + 0.4 * noise1(ta * 0.5 + p.seed);
      const peck = Math.max(0, Math.sin(ta * 5 + p.seed * 3));
      p.head.rotation.x = 0.9 * Math.pow(peck, 3);
      p.head.position.z = 0.1 + 0.03 * Math.sin(ta * 9 + p.seed);
    } else {
      const u = tf;
      p.root.position.set(p.home.x - 2.2 * u - 0.5 * u * u, 0.0 + 2.6 * u + 0.6 * u * u, p.home.z + (i % 2 ? 1 : -1) * 0.6 * u);
      p.root.rotation.y = -Math.PI / 2 + (i % 2 ? 0.4 : -0.4);
      const f = Math.sin(u * 55 + i);
      p.wings[0].rotation.z = 1.1 * f; p.wings[1].rotation.z = -1.1 * f;
      p.body.rotation.x = -0.35;
      p.head.rotation.x = 0;
    }
  });
}

function updateTaxis(t) {
  const ta = ambT(t);
  taxis.forEach(q => {
    const L = 100;
    let x = ((ta * q.speed + q.off) % L + L) % L - L / 2;
    if (q.lane === 0) { q.obj.position.set(x, -0.15, 2.0); q.obj.rotation.y = 0; }
    else { q.obj.position.set(-x, -0.15, 6.0); q.obj.rotation.y = Math.PI; }
  });
}

function updateProps(t) {
  const ta = ambT(t);
  const showBills = win(t, T.thousand, T.yes + 0.25);
  bills.forEach(b => {
    const tau = ta - b.t0;
    if (!showBills || tau < 0) { b.m.visible = false; return; }
    const y = b.y0 - b.v * tau;
    if (y < 0.02) { b.m.visible = true; b.m.position.set(b.x, 0.02, b.z); b.m.rotation.set(-Math.PI / 2, 0, b.ph); return; }
    b.m.visible = true;
    b.m.position.set(b.x + 0.25 * Math.sin(tau * 2.5 + b.ph), y, b.z + 0.2 * Math.cos(tau * 2 + b.ph));
    b.m.rotation.set(b.r[0] * tau + b.ph, b.r[1] * tau, b.r[2] * tau);
  });
  // wallet in YOU's hands
  const wv = win(t, T.wallet - 0.45, T.looksYou - 0.1);
  wallet.visible = wv;
  if (wv) {
    you.root.updateMatrixWorld(true);
    const p = you.root.localToWorld(V(0.0, 1.1 * you.S, 0.42));
    wallet.position.copy(p);
    wallet.rotation.set(-2.13, you.root.rotation.y, 0, 'YXZ');
    const open = smooth(ramp(t, T.wallet + 0.3, T.walletWord + 0.4));
    wRightHinge.rotation.y = lerp(-Math.PI + 0.02, -0.1, open);
    wRightHinge.position.z = lerp(0.013, 0, open);
    fivePivot.visible = open > 0.6;
    const pop = smooth(ramp(t, T.five - 0.12, T.five + 0.12));
    const wilt = smooth(ramp(t, T.five + 0.45, T.five + 1.05));
    fivePivot.rotation.x = 0.9 * pop - 0.8 * wilt + 0.1 * Math.sin((t - T.five) * 14) * pop * (1 - wilt);
  }
  const mv = win(t, T.five + 0.35, T.looksYou - 0.15);
  moth.visible = mv;
  if (mv) {
    const u = (t - T.five - 0.35) / (T.looksYou - 0.15 - T.five - 0.35);
    const n = walletNormal();
    const rx = V(1, 0, 0).applyQuaternion(wallet.quaternion), ry = V(0, -1, 0).applyQuaternion(wallet.quaternion);
    const p = wallet.position.clone().addScaledVector(n, 0.02 + 0.3 * u * u)
      .addScaledVector(rx, -0.05 + 0.05 * Math.sin(u * 15) + 0.08 * u)
      .addScaledVector(ry, 0.03 * Math.sin(u * 21 + 1) - 0.05 * u);
    moth.position.copy(p);
    moth.up.copy(n);
    moth.lookAt(p.clone().addScaledVector(ry, 1).addScaledVector(rx, 0.6));
    const f = Math.sin(t * 70);
    moth.wings[0].rotation.z = 0.9 * f; moth.wings[1].rotation.z = -0.9 * f;
    moth.scale.setScalar(1.7);
  }
}

// ------------------------------------------------------------------ CAMERA SHOTS
const bodyAnchor = (c, y) => V(c.root.position.x, y * c.S, c.root.position.z);
function orbit(c, ang, dist, dy = 0, look = [0, 0, 0], y = 1.7) {
  const a = bodyAnchor(c, y); const yaw = c.root.rotation.y + ang;
  return { pos: V(a.x + Math.sin(yaw) * dist, a.y + dy, a.z + Math.cos(yaw) * dist), look: a.clone().add(V(...look)) };
}
function punch(t, tp, amt = 0.14) {
  const x = t - tp; if (x < 0) return 1;
  return 1 - amt * (x < 0.07 ? x / 0.07 : Math.exp(-(x - 0.07) / 0.3));
}
const lv = (a, b, u) => V(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u));
const MANYAW_FIX = MAN_YAW, YOUYAW_FIX = YOU_YAW;
// fixed-yaw orbit (so a head shake/turn doesn't swing the camera)
function orbitFix(c, yaw0, ang, dist, dy = 0, look = [0, 0, 0], y = 1.7) {
  const a = bodyAnchor(c, y); const yaw = yaw0 + ang;
  return { pos: V(a.x + Math.sin(yaw) * dist, a.y + dy, a.z + Math.cos(yaw) * dist), look: a.clone().add(V(...look)) };
}
const SHOTS = [
  { t: 0, f: (u) => ({ pos: lv([-1.7, 2.2, 6.0], [-1.5, 2.0, 5.3], u), look: V(-1.4, 1.05, -1.6), fov: 54 }) },
  { t: 1.05, f: (u, t) => { const x = you.root.position.x; return { pos: V(x + 1.7, 1.45, -3.75), look: V(x + 0.1, 1.35, -1.6), fov: 50 }; } },
  { t: T.ask, f: (u) => ({ pos: lv([-1.95, 1.92, -0.72], [-1.75, 1.9, -0.82], u), look: V(0.65, 1.62, -1.65), fov: 40 }) },
  { t: T.ask + 1.22, f: (u) => { const o = orbitFix(you, YOUYAW_FIX, -0.55, lerp(1.95, 1.65, u), 0.02, [0, -0.06, 0]); return { ...o, fov: 40 }; } },
  { t: T.q + 0.46, f: (u) => { const o = orbitFix(man, MANYAW_FIX, -0.95, lerp(1.9, 1.7, u), 0.0, [0, -0.06, 0]); return { ...o, fov: 40 }; } },
  { t: T.ten - 0.1, f: (u, t) => ({ pos: lv([0.02, 1.5, 2.6], [0.02, 1.45, 2.3], u), look: V(0.02, 1.3, -1.6), fov: 46 * punch(t, T.ten) }) },
  { t: T.noway - 0.07, f: (u) => { const x = man.root.position.x; return { pos: V(x + 1.35, 1.4, 0.9 + 0.2 * u), look: V(x + 0.1, 1.35, -1.6), fov: 46 }; } },
  { t: T.hundred - 0.06, f: (u, t) => { const x = you.root.position.x; return { pos: V(x + 0.05, 1.55, 1.75), look: V(x + 0.75, 1.4, -1.6), fov: 50 * punch(t, T.hundred) }; } },
  { t: T.stops - 0.17, f: (u) => { const o = orbitFix(man, Math.PI / 2, -0.45, lerp(2.6, 2.2, u), -1.05, [0, -0.5, 0]); return { ...o, fov: 50 }; } },
  { t: T.thinks - 0.05, f: (u) => { const o = orbitFix(man, Math.PI / 2, -0.55, lerp(2.4, 2.15, u), -0.05, [0, 0.22, 0]); return { ...o, fov: 46 }; } },
  { t: T.looks - 0.07, f: (u) => { const o = orbitFix(man, Math.PI / 2, -0.3, lerp(2.2, 2.0, u), 0.25, [0, -0.5, 0]); return { ...o, fov: 50 }; } },
  { t: T.white - 0.05, f: (u) => { const o = orbitFix(man, Math.PI / 2, -0.35, lerp(1.7, 1.4, u), 0.05, [0, 0, 0], 0.62); return { ...o, fov: 44 }; } },
  { t: T.no - 0.13, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.45, lerp(1.8, 1.62, u), 0, [0, -0.06, 0]); return { ...o, fov: 40 }; } },
  { t: T.crowd - 0.07, f: (u) => ({ pos: lv([1.4, 2.9, 6.6], [1.4, 2.7, 5.9], u), look: V(1.4, 0.95, -2.1), fov: 58 }) },
  { t: T.thousand - 0.49, f: (u, t) => { const o = orbitFix(you, YOUYAW_FIX, -0.5, lerp(1.85, 1.6, u), 0.02, [0, -0.06, 0]); return { ...o, fov: 42 * punch(t, T.thousand, 0.18) }; } },
  { t: T.thousand + 0.61, f: (u) => ({ pos: lv([1.4, 1.9, 4.4], [1.4, 1.8, 3.9], u), look: V(1.4, 1.4, -1.9), fov: 56 }) },
  { t: T.scratch, f: (u, t) => { const j = t < T.scratch + 0.18 ? 0.04 * Math.sin((t - T.scratch) * 90) : 0; return { pos: V(1.4 + j, 2.15, 5.2), look: V(1.4, 1.2, -2.0), fov: 54 }; } },
  { t: T.silence + 0.84, f: (u) => ({ pos: lv([1.4, 6.2, 2.4], [1.4, 5.8, 2.0], u), look: V(1.4, 0.5, -2.0), fov: 50 }) },
  { t: T.yes, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.3, lerp(1.7, 1.5, u), 0, [0, -0.04, 0]); return { ...o, fov: 40 }; } },
  { t: T.sayno - 0.03, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 1.2, lerp(1.6, 1.45, u), 0.02, [0, -0.04, 0]); return { ...o, fov: 40 }; } },
  { t: T.closes - 0.09, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.15, lerp(1.5, 1.35, u), 0, [0, -0.04, 0]); return { ...o, fov: 40 }; } },
  { t: T.closes + 0.76, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.05, lerp(1.0, 0.85, u), 0.03, [0, 0.03, 0]); return { ...o, fov: 40 }; } },
  { t: T.and - 0.33, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.2, lerp(2.6, 1.5, smooth(u)), lerp(0.45, 0.08, smooth(u)), [0, 0, 0], 0.66); return { ...o, fov: 44 }; } },
  { t: T.happens - 0.06, f: (u, t) => { const o = orbitFix(man, MANYAW_FIX, 2.6, lerp(1.4, 1.2, u), 0.1, [0, 0.0, 0], 0.62); const sh = win(t, T.happens + 0.2, T.happensEnd + 0.7) ? 0.03 : 0.004; o.look.x += sh * noise1(t * 40); o.look.y += sh * noise1(t * 37 + 5); return { ...o, fov: 46 }; } },
  { t: T.stepback - 0.03, f: (u) => ({ pos: lv([1.6, 2.55, 6.0], [1.6, 2.65, 6.5], u), look: V(1.6, 1.0, -2.3), fov: 60 }) },
  { t: T.dog - 0.08, f: (u) => ({ pos: lv([0.0, 0.5, 1.9], [-1.0, 0.55, 2.0], u), look: lv([-1.0, 0.45, -0.4], [-3.4, 0.8, -0.6], smooth(u)), fov: 56 }) },
  { t: T.done - 0.43, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.5, lerp(2.0, 1.7, u), -0.85, [0, -0.3, 0]); return { ...o, fov: 50 }; } },
  { t: T.wallet - 0.49, f: (u) => { const o = orbitFix(you, YOUYAW_FIX, -0.4, lerp(1.6, 1.4, u), -0.15, [0, -0.3, 0]); return { ...o, fov: 46 }; } },
  { t: T.wallet + 0.66, f: (u) => { const n = walletNormal(); return { pos: wallet.position.clone().addScaledVector(n, lerp(0.55, 0.46, u)), look: wallet.position.clone(), fov: 46 }; } },
  { t: T.five - 0.02, f: (u) => { const n = walletNormal(); return { pos: wallet.position.clone().addScaledVector(n, lerp(0.42, 0.37, u)), look: wallet.position.clone(), fov: 46 }; } },
  { t: T.looksYou - 0.2, f: (u) => { const o = orbitFix(man, MANYAW_FIX, 0.6, lerp(1.6, 1.42, u), 0, [0, -0.04, 0]); return { ...o, fov: 40 }; } },
  { t: T.lookHim - 0.09, f: (u) => { const o = orbitFix(you, YOUYAW_FIX, -0.6, lerp(1.6, 1.42, u), 0, [0, -0.04, 0]); return { ...o, fov: 40 }; } },
  { t: T.lookHimEnd - 0.12, f: (u) => ({ pos: lv([1.12, 1.68, 1.15], [1.12, 1.68, 1.0], u), look: V(1.12, 1.62, -1.6), fov: 46 }) },
  { t: T.run, f: (u) => { const x = you.root.position.x; return { pos: V(x - 2.7, 1.25, -0.7), look: V(x, 1.15, -1.6), fov: 50 }; } },
  { t: T.cant - 0.06, f: (u) => { const x = man.root.position.x; return { pos: V(x - 0.45, 1.15, 1.5), look: V(x - 0.15, 0.9, -1.6), fov: 52 }; } },
  { t: T.never - 0.03, f: (u) => ({ pos: lv([5.6, 2.6, 3.1], [6.2, 3.0, 3.8], u), look: lv([-2.0, 0.9, -1.6], [-3.5, 0.8, -1.6], u), fov: 54 }) },
];
const SHOT_HEAD_HIDE = new Set([28, 29]);
function shotAt(t) {
  let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t) i++;
  const s = SHOTS[i], end = i + 1 < SHOTS.length ? SHOTS[i + 1].t : DUR;
  return { i, u: clamp((t - s.t) / (end - s.t)), s };
}

// ------------------------------------------------------------------ 2D PIXEL OVERLAY
const LW = 360, LH = 640;
const pix = document.createElement('canvas'); pix.width = LW; pix.height = LH;
const px = pix.getContext('2d');
function project(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * LW, y: (1 - p.y) / 2 * LH, ok: p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.4 && Math.abs(p.y) < 1.4 };
}
function pxPerM(v) { const d = v.distanceTo(camera.position); return LH / (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
const bmpCache = new Map();
function textBitmap(text, size, fill, outline = '#000000', ow = 5, shadow = 2, fam = 'Pix') {
  const key = [text, size, fill, outline, ow, shadow, fam].join('|');
  if (bmpCache.has(key)) return bmpCache.get(key);
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `700 ${size}px ${fam}`;
  const w = Math.ceil(g.measureText(text).width + ow * 2 + 8), h = Math.ceil(size * 1.3 + ow * 2 + 8 + shadow);
  c.width = w; c.height = h;
  g.font = `700 ${size}px ${fam}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = ow;
  const cx = w / 2, cy = (h - shadow) / 2 + size * 0.06;
  g.strokeStyle = outline; g.fillStyle = outline;
  if (shadow) { g.strokeText(text, cx, cy + shadow); g.fillText(text, cx, cy + shadow); }
  g.strokeText(text, cx, cy); g.fillStyle = fill; g.fillText(text, cx, cy);
  const id = g.getImageData(0, 0, w, h), d = id.data; const F = hex2rgb(fill), O = hex2rgb(outline);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 120) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    const df = (d[i] - F[0]) ** 2 + (d[i + 1] - F[1]) ** 2 + (d[i + 2] - F[2]) ** 2;
    const dO = (d[i] - O[0]) ** 2 + (d[i + 1] - O[1]) ** 2 + (d[i + 2] - O[2]) ** 2;
    const C = df < dO ? F : O; d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2];
  }
  g.putImageData(id, 0, 0);
  bmpCache.set(key, c);
  return c;
}
function blit(bmp, x, y, s = 1, rot = 0) {
  px.save(); px.translate(Math.round(x), Math.round(y)); if (rot) px.rotate(rot); px.scale(s, s);
  px.drawImage(bmp, -bmp.width / 2, -bmp.height / 2); px.restore();
}
function sweatDrop(x, y, s) {
  px.save(); px.translate(x, y); px.scale(s / 10, s / 10);
  px.beginPath(); px.moveTo(0, -10); px.bezierCurveTo(4, -4, 6, -1, 6, 3); px.arc(0, 3, 6, 0, Math.PI); px.bezierCurveTo(-6, -1, -4, -4, 0, -10); px.closePath();
  px.fillStyle = '#1b4f9c'; px.lineWidth = 3.2; px.strokeStyle = '#1b4f9c'; px.stroke();
  px.fillStyle = '#5ec6ff'; px.fill();
  px.fillStyle = '#d9f4ff'; px.fillRect(-3.5, 0, 2.5, 3.5);
  px.restore();
}
function wavy(x, y, len, amp, ph, w, col = '#7fdc45', out = '#2d6a14') {
  const pts = []; for (let j = 0; j <= 12; j++) pts.push([x + amp * Math.sin(ph + j * 0.85), y - len * j / 12]);
  for (const [lw, c] of [[w + 2.4, out], [w, col]]) {
    px.beginPath(); pts.forEach(([a, b], k) => k ? px.lineTo(a, b) : px.moveTo(a, b));
    px.lineWidth = lw; px.lineCap = 'round'; px.lineJoin = 'round'; px.strokeStyle = c; px.stroke();
  }
}
function stinkCluster(p, k, t, strength = 1, n = 3) {
  for (let i = 0; i < n; i++) {
    const c = (t * 0.75 + i / n) % 1;
    if (c > 0.92) continue;
    const xo = (i - (n - 1) / 2) * 0.21 * k;
    const len = 0.42 * k * strength * (0.6 + 0.4 * Math.sin(Math.PI * c));
    const yb = p.y - c * 0.35 * k;
    wavy(p.x + xo, yb, len, 0.045 * k, t * 6 + i * 2, Math.max(1.4, 0.022 * k));
  }
}
function cloud(x, y, s, t) {
  const circ = [[-0.36, 0.02, 0.27], [0, -0.12, 0.33], [0.36, 0.02, 0.27], [-0.17, 0.16, 0.25], [0.19, 0.15, 0.26]];
  const bub = [[-0.42, 0.52, 0.06], [-0.3, 0.36, 0.09]];
  for (const pass of [0, 1]) {
    px.fillStyle = pass ? '#ffffff' : '#111111';
    for (const [a, b, r] of [...circ, ...bub]) { px.beginPath(); px.arc(x + a * s, y + b * s, r * s + (pass ? 0 : 2.2), 0, Math.PI * 2); px.fill(); }
  }
  const d = textBitmap('$', Math.round(s * 0.26), '#3fdc4f', '#000000', 3, 1, 'Silk');
  [[-0.27, 0.04, 0], [0.02, -0.05, 1.3], [0.29, 0.05, 2.6]].forEach(([a, b, ph]) => blit(d, x + a * s, y + b * s + Math.sin(t * 7 + ph) * s * 0.04, 1));
}
function sparkle(x, y, s, col = '#ffffff') {
  px.save(); px.translate(x, y);
  const pts = [[0, -1], [0.22, -0.22], [1, 0], [0.22, 0.22], [0, 1], [-0.22, 0.22], [-1, 0], [-0.22, -0.22]];
  for (const [w, c] of [[1.5, '#c99a00'], [0, col]]) {
    px.beginPath(); pts.forEach(([a, b], k) => { const X = a * (s + w), Y = b * (s + w); k ? px.lineTo(X, Y) : px.moveTo(X, Y); }); px.closePath(); px.fillStyle = c; px.fill();
  }
  px.fillStyle = '#fff6a8'; px.fillRect(-1, -1, 2, 2);
  px.restore();
}
function motionLines(x, y, dx, dy, len, n, spread, t, seed = 0) {
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const nx = -dy, ny = dx;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * spread + 3 * Math.sin(t * 20 + i + seed);
    const ll = len * (0.6 + 0.4 * hash(i + seed * 13 + Math.floor(t * 12)));
    const x0 = x + nx * o + dx * 6, y0 = y + ny * o + dy * 6;
    for (const [w, c] of [[4, '#1a1a1a'], [2, '#ffffff']]) {
      px.beginPath(); px.moveTo(x0, y0); px.lineTo(x0 + dx * ll, y0 + dy * ll); px.lineWidth = w; px.lineCap = 'round'; px.strokeStyle = c; px.stroke();
    }
  }
}
function floatDollars(t, t0, dur, n, area, seed, size = 18) {
  if (!win(t, t0, t0 + dur)) return;
  const d = textBitmap('$', size, '#3fdc4f', '#000000', 3, 1, 'Silk');
  for (let i = 0; i < n; i++) {
    const st = t0 + hash(i + seed) * dur * 0.5; const a = t - st; if (a < 0) continue;
    const life = 0.9; if (a > life) continue;
    const x = area[0] + hash(i * 3.1 + seed) * (area[2] - area[0]) + 6 * Math.sin(a * 6 + i);
    const y = area[3] - (area[3] - area[1]) * hash(i * 7.7 + seed) * 0.4 - a * 90;
    const s = a < 0.1 ? a / 0.1 : a > life - 0.15 ? (life - a) / 0.15 : 1;
    blit(d, x, y, Math.max(0.01, s));
  }
}

function drawIcons(t) {
  const ta = ambT(t);
  man.root.updateMatrixWorld(true);
  // thought cloud with $ signs
  if (win(t, T.thinks - 0.02, T.looks - 0.07)) {
    const hw = man.face.localToWorld(V(0, 0, 0)).add(V(0.08, 0.5, 0));
    const p = project(hw); const k = pxPerM(hw);
    const age = t - T.thinks;
    const s = Math.min(120, 0.55 * k) * clamp(age / 0.15);
    if (p.ok && s > 2) cloud(p.x, p.y, s, t);
  }
  // sparkles on the white pants
  if (win(t, T.looks + 0.2, T.no - 0.13)) {
    const pts = [[0.1, -0.15, 0.13], [-0.08, -0.35, 0.12], [0.12, -0.55, 0.1], [-0.12, -0.05, 0.14], [0.02, -0.72, 0.1], [-0.1, -0.62, 0.1]];
    pts.forEach(([a, b, c], i) => {
      const wp = man.hips.localToWorld(V(a, b, c));
      const p = project(wp); if (!p.ok) return;
      const k = pxPerM(wp);
      const ph = (t * 1.8 + i * 0.37) % 1;
      const sz = Math.sin(Math.PI * ph) * Math.min(16, 0.07 * k);
      if (sz > 1) sparkle(p.x, p.y, sz);
    });
  }
  // sweat drops
  const sweats = [];
  if (win(t, T.yes + 0.1, T.and - 0.33)) { sweats.push([man, [0.205, 0.13, 0.08], t - T.yes]); if (t > T.sayno) sweats.push([man, [0.19, -0.02, 0.12], t - T.sayno]); }
  if (win(t, T.wallet - 0.49, T.looksYou - 0.2)) sweats.push([you, [-0.21, 0.12, 0.08], t - T.wallet]);
  if (win(t, T.lookHim - 0.09, T.run)) { sweats.push([you, [-0.21, 0.12, 0.08], t - T.lookHim]); sweats.push([you, [0.21, 0.08, 0.08], t - T.lookHim - 0.3]); }
  for (const [c, off, age] of sweats) {
    if (age < 0) continue;
    const wp = c.face.localToWorld(V(...off));
    const ph = (age * 0.55) % 1;
    const k = pxPerM(wp);
    wp.y -= ph * 0.1;
    const p = project(wp); if (!p.ok) continue;
    sweatDrop(p.x, p.y, Math.min(34, 0.06 * k) * clamp(age / 0.12));
  }
  // stink lines
  if (t > T.happens + 0.18) {
    const strength = t < T.happens + 0.5 ? (t - T.happens - 0.18) / 0.32 : t < T.done ? 1 : 0.75;
    const wp = man.hips.localToWorld(V(0, -0.05, -0.12));
    const p = project(wp);
    if (p.ok) stinkCluster(p, pxPerM(wp), t, strength, 3);
    // trail during the chase
    if (t > T.run + 0.6) {
      const mx = man.root.position.x;
      for (let k = 1; k < 16; k++) {
        const tx = mx + 0.75 * k; if (tx > MAN_POS3 + 0.2) break;
        const tw = V(tx, 0.55, Z0 + 0.08 * Math.sin(k * 1.7));
        const tp = project(tw); if (!tp.ok) continue;
        stinkCluster(tp, pxPerM(tw) * 0.8, t + k * 0.21, Math.max(0.35, 1 - k * 0.05), 2);
      }
    }
  }
  // motion lines
  if (win(t, T.stepback + 0.05, T.stepback + 0.7)) {
    crowd.forEach((c, i) => {
      const sb = T.stepback + 0.05 + i * 0.045; const a = t - sb; if (a < 0 || a > 0.45) return;
      const wp = c.root.position.clone().add(V(0, 1.2 * c.S, 0));
      const p = project(wp); if (!p.ok) return;
      const towardMan = project(man.root.position.clone().add(V(0, 1.2, 0)));
      const k = pxPerM(wp);
      motionLines(p.x, p.y, towardMan.x - p.x, towardMan.y - p.y, 0.5 * k, 3, 0.18 * k, t, i);
    });
  }
  if (win(t, T.dogRun - 0.1, T.dogRun + 1.0)) {
    const wp = dog.root.position.clone().add(V(0, 0.4, 0)); const p = project(wp);
    if (p.ok) { const k = pxPerM(wp); const q = project(wp.clone().add(V(1, 0, 0))); motionLines(p.x, p.y, q.x - p.x, q.y - p.y, 0.6 * k, 3, 0.12 * k, t, 7); }
  }
  if (win(t, T.run + 0.15, T.never + 2.0)) {
    const wp = you.root.position.clone().add(V(0, 1.0 * you.S, 0)); const p = project(wp);
    if (p.ok) {
      const k = pxPerM(wp); const q = project(wp.clone().add(V(1, 0, 0)));
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.45 * k) for (const sd of [-1, 1]) motionLines(p.x + sd * 0.42 * k, p.y - 0.1 * k, sd, -0.15, 0.45 * k, 3, 0.16 * k, t, 3 + sd);
      else motionLines(p.x, p.y, q.x - p.x, q.y - p.y, 0.9 * k, 4, 0.22 * k, t, 3);
    }
  }
  // floating dollars
  floatDollars(t, T.ten, 1.1, 6, [60, 180, 300, 330], 1);
  floatDollars(t, T.hundred, 1.4, 8, [40, 160, 320, 330], 2);
  floatDollars(t, T.thousand, 1.7, 16, [20, 120, 340, 380], 3, 22);
  // dust puff out of the wallet
  if (win(t, T.walletWord + 0.25, T.walletWord + 0.9) && wallet.visible) {
    const p = project(wallet.position); const a = (t - T.walletWord - 0.25) / 0.65;
    if (p.ok) for (let i = 0; i < 10; i++) {
      const ang = hash(i * 9.1) * Math.PI * 2, r = 20 + 90 * a * (0.6 + 0.6 * hash(i * 3.3));
      const s = Math.max(0, 5 * (1 - a));
      px.fillStyle = i % 2 ? '#bdb5a3' : '#8f8676';
      px.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r * 0.7 - 20 * a), s, s);
    }
  }
}
function crispLayer() {
  const id = px.getImageData(0, 0, LW, LH), d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  px.putImageData(id, 0, 0);
}
const CAP_Y = 0.635 * LH;
function drawCaptions(t) {
  for (const cp of TL.captions) {
    if (t < cp.show || t >= cp.hide) continue;
    const age = t - cp.show;
    let text = cp.text; if (!text.endsWith('...')) text = text.replace(/[.,]+$/, '');
    if (!cp.money) {
      let size = 36, bmp = textBitmap(text, size, '#ffffff', '#000000', 6, 2);
      if (bmp.width > 346) { size = Math.floor(36 * 338 / bmp.width); bmp = textBitmap(text, size, '#ffffff', '#000000', 6, 2); }
      const s = age < 0.1 ? lerp(0.78, 1.06, age / 0.1) : age < 0.16 ? lerp(1.06, 1, (age - 0.1) / 0.06) : 1;
      blit(bmp, LW / 2, CAP_Y, s);
    } else {
      const sad = text.startsWith('$5');
      let size = text === '$1,000' ? 62 : 66;
      let fill = '#3fdc4f', droop = 0;
      if (sad) { droop = smooth((age - 0.45) / 0.5); if (droop > 0.5) fill = '#94a85a'; }
      let bmp = textBitmap(text, size, fill, '#000000', 6, 3, 'Silk');
      if (bmp.width > 350) { size = Math.floor(size * 340 / bmp.width); bmp = textBitmap(text, size, fill, '#000000', 6, 3, 'Silk'); }
      const sp = 1 - Math.exp(-9 * age) * Math.cos(17 * age);
      const s = Math.max(0.02, sp) * (1 - 0.22 * droop) * (1 + 0.025 * Math.sin(age * 9));
      const rot = 0.09 * Math.sin(age * 11) * Math.exp(-3.5 * age) + 0.32 * droop;
      blit(bmp, LW / 2, CAP_Y - 10 + 2 * Math.sin(age * 6) + 22 * droop, s, rot);
    }
  }
}

// ------------------------------------------------------------------ RENDER
function poseAll(t) {
  updateYou(t); updateMan(t); updateCrowd(t); updateDog(t); updatePigeons(t); updateTaxis(t);
  scene.updateMatrixWorld(true);
  updateProps(t);
  scene.updateMatrixWorld(true);
}
// hide any taxi that would drive between the camera and the actors during a shot
const taxiHide = new Map();
function taxiHiddenFor(si) {
  if (taxiHide.has(si)) return taxiHide.get(si);
  const s = SHOTS[si], t0 = s.t, t1 = si + 1 < SHOTS.length ? SHOTS[si + 1].t : DUR;
  const hidden = new Set(), b3 = new THREE.Box3();
  for (let k = 0; k <= 10; k++) {
    const ts = lerp(t0, t1 - 0.002, k / 10);
    poseAll(ts);
    const cam = s.f(clamp((ts - t0) / (t1 - t0)), ts);
    camera.position.copy(cam.pos); camera.lookAt(cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const subj = [you, man, dog, ...crowd.filter(c => c.root.visible)].map(c => c.root);
    let sx0 = 9, sx1 = -9, sy0 = 9, sy1 = -9, sd = 1e9;
    for (const r of subj) for (const hh of [0.05, 2.0]) {
      const v = r.position.clone(); v.y += hh; const d = v.distanceTo(camera.position); const pp = v.project(camera);
      if (pp.z > 1) continue;
      sx0 = Math.min(sx0, pp.x); sx1 = Math.max(sx1, pp.x); sy0 = Math.min(sy0, pp.y); sy1 = Math.max(sy1, pp.y); sd = Math.min(sd, d);
    }
    taxis.forEach((q, i) => {
      b3.setFromObject(q.obj);
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9, behind = 0;
      for (let c = 0; c < 8; c++) {
        const v = V(c & 1 ? b3.max.x : b3.min.x, c & 2 ? b3.max.y : b3.min.y, c & 4 ? b3.max.z : b3.min.z).project(camera);
        if (v.z > 1 || v.z < -1) { behind++; continue; }
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      if (behind === 8) return;
      const d = q.obj.position.distanceTo(camera.position);
      if (behind > 0) { if (d < 15) hidden.add(i); return; }
      if (!(x1 > -1 && x0 < 1 && y1 > -1 && y0 < 1)) return;
      if (x1 > sx0 && x0 < sx1 && y1 > sy0 && y0 < sy1 && d < sd + 1.5) hidden.add(i);
    });
  }
  taxiHide.set(si, hidden);
  return hidden;
}
function renderAt(t) {
  const { i: si, u, s } = shotAt(t);
  const hide = taxiHiddenFor(si);
  poseAll(t);
  taxis.forEach((q, i) => { q.obj.visible = !hide.has(i); });
  you.head.visible = !SHOT_HEAD_HIDE.has(si);
  const cam = s.f(u, t);
  camera.position.copy(cam.pos);
  const hand = V(0.01 * noise1(t * 1.3 + 3), 0.008 * noise1(t * 1.1 + 9), 0);
  camera.lookAt(cam.look.clone().add(hand.multiplyScalar(cam.pos.distanceTo(cam.look))));
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  // sun follows the action
  const tgt = cam.look.clone(); tgt.y = 0;
  sun.target.position.copy(tgt); sun.position.copy(tgt).add(V(-9, 22, 13));
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  // overlay
  px.clearRect(0, 0, LW, LH);
  px.imageSmoothingEnabled = false;
  drawIcons(t);
  crispLayer();
  drawCaptions(t);
  octx.clearRect(0, 0, W, H);
  octx.imageSmoothingEnabled = false;
  octx.drawImage(pix, 0, 0, W, H);
  const fade = smooth(ramp(t, DUR - 1.35, DUR - 0.05));
  if (fade > 0) { octx.fillStyle = `rgba(0,0,0,${fade})`; octx.fillRect(0, 0, W, H); }
}
window.renderAt = renderAt;
window.DUR = DUR;
window.SHOT_MIDS = SHOTS.map((sh, i) => (sh.t + (i + 1 < SHOTS.length ? SHOTS[i + 1].t : DUR)) / 2);
renderAt(0);
window.READY = true;
