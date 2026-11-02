// Exam Crush Reel -- deterministic Three.js scene. window.renderFrame(frame) renders one frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FPS = 30, W = 1080, H = 1920;
const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const TL = await (await fetch('./timeline.json', { cache: 'no-store' })).json();
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ utils
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; x = clamp(x); return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const noise1 = (t, s = 0) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 5.3 + s * 0.7) * 0.2;

// ------------------------------------------------------------------ timeline helpers
const SEGS = TL.segments;
const SEG = {}; SEGS.forEach((s, i) => { SEG[s.id] = { ...s, i }; });
const E = TL.ending_start, END = TL.duration;
function beat(id) {
  const s = SEG[id];
  const t0 = s.i === 0 ? 0 : s.start;
  const t1 = s.i < SEGS.length - 1 ? SEGS[s.i + 1].start : E;
  return [t0, t1];
}
const Ws = (id, k) => SEG[id].words[Math.min(k, SEG[id].words.length - 1)].s;
const We = (id, k) => SEG[id].words[Math.min(k, SEG[id].words.length - 1)].e;
const S = (id) => SEG[id].start;
const Se = (id) => SEG[id].end;
const atFrac = (id, f) => { const [a, b] = beat(id); return a + (b - a) * f; };

// ------------------------------------------------------------------ fonts
async function loadFonts() {
  const fonts = [
    new FontFace('Pixelify', 'url(/node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2)'),
    new FontFace('Hand', 'url(/node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2)'),
  ];
  for (const f of fonts) { await f.load(); document.fonts.add(f); }
}
await loadFonts();

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const out = document.getElementById('out');
out.width = RW; out.height = RH;
const octx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9d2c0');
const FOG_BASE = new THREE.Color('#d8cfbb'), FOG_GREEN = new THREE.Color('#8fbf5a');
scene.fog = new THREE.FogExp2(FOG_BASE.clone(), 0.0);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 80);

// ------------------------------------------------------------------ materials / textures
const matCache = new Map();
function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
function canvasTex(w, h, draw, { nearest = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c;
  return t;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m); return m;
}

// static geometry, merged per material
const bins = new Map();
function sgeo(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, cast = true) {
  const m4 = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));
  geo.applyMatrix4(m4);
  const key = mat.uuid + (cast ? 'c' : 'n');
  if (!bins.has(key)) bins.set(key, { mat, cast, geos: [] });
  bins.get(key).geos.push(geo);
}
const sbox = (w, h, d, mat, x, y, z, ry = 0, cast = true) => sgeo(new THREE.BoxGeometry(w, h, d), mat, x, y, z, 0, ry, 0, cast);
function flushStatic() {
  for (const { mat, cast, geos } of bins.values()) {
    const g = mergeGeometries(geos.map(x => x.index ? x : x));
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    scene.add(mesh);
  }
  bins.clear();
}

// ------------------------------------------------------------------ lights
const hemi = new THREE.HemisphereLight('#fff3df', '#7d6c58', 1.35); scene.add(hemi);
const amb = new THREE.AmbientLight('#ffffff', 0.35); scene.add(amb);
const sun = new THREE.DirectionalLight('#ffe7c2', 2.4);
sun.position.set(-13, 11, 3); sun.target.position.set(0, 0, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ hall
const HALL = { x0: -10, x1: 10, z0: -11, z1: 10, h: 5.2 };
const floorTex = canvasTex(256, 256, (g) => {
  const r = rng(7);
  g.fillStyle = '#bdb6a8'; g.fillRect(0, 0, 256, 256);
  const cols = ['#8f887b', '#d7d0c2', '#6f695f', '#a59e90', '#e6e0d3', '#9a5a4a'];
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = cols[Math.floor(r() * (r() < 0.97 ? 5 : 6))];
    const s = 2 + Math.floor(r() * 3);
    g.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), s, s);
  }
  g.fillStyle = '#958e81'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256); g.fillRect(0, 127, 256, 2); g.fillRect(127, 0, 2, 256);
}, { repeat: [10, 10.5] });
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 21), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -0.5); floor.receiveShadow = true; scene.add(floor);
}
const wallM = M('#e8dcc2'), dadoM = M('#6f9c88'), trimM = M('#4c7867'), ceilM = M('#efe9de');
// walls (do not cast shadows so the window "sun" comes in)
sbox(20, 5.2, 0.2, wallM, 0, 2.6, -11.1, 0, false);
sbox(20, 5.2, 0.2, wallM, 0, 2.6, 10.1, 0, false);
sbox(0.2, 5.2, 21, wallM, -10.1, 2.6, -0.5, 0, false);
sbox(0.2, 5.2, 21, wallM, 10.1, 2.6, -0.5, 0, false);
sbox(20, 0.2, 21, ceilM, 0, 5.3, -0.5, 0, false);
// dado + trim
sbox(20, 1.3, 0.04, dadoM, 0, 0.65, -10.98, 0, false); sbox(20, 0.08, 0.06, trimM, 0, 1.32, -10.97, 0, false);
sbox(20, 1.3, 0.04, dadoM, 0, 0.65, 9.98, 0, false); sbox(20, 0.08, 0.06, trimM, 0, 1.32, 9.97, 0, false);
sbox(0.04, 1.3, 21, dadoM, -9.98, 0.65, -0.5, 0, false); sbox(0.06, 0.08, 21, trimM, -9.97, 1.32, -0.5, 0, false);
sbox(0.04, 1.3, 21, dadoM, 9.98, 0.65, -0.5, 0, false); sbox(0.06, 0.08, 21, trimM, 9.97, 1.32, -0.5, 0, false);
// skirting
sbox(20, 0.12, 0.06, M('#3d5e52'), 0, 0.06, -10.95, 0, false);
sbox(20, 0.12, 0.06, M('#3d5e52'), 0, 0.06, 9.95, 0, false);

// windows (left wall = daylight)
const skyTex = canvasTex(64, 64, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#a9dcff'); gr.addColorStop(0.55, '#e6f6ff'); gr.addColorStop(1, '#f6fbff');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const r = rng(3);
  for (let i = 0; i < 26; i++) { g.fillStyle = ['#7fb86a', '#69a65a', '#93c97b'][i % 3]; const s = 6 + r() * 12; g.fillRect(r() * 64 - 4, 40 + r() * 20, s, s); }
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(8, 10, 14, 4); g.fillRect(12, 7, 8, 4); g.fillRect(40, 18, 12, 3);
}, { nearest: true });
const skyM = new THREE.MeshBasicMaterial({ map: skyTex, color: '#ffffff', fog: false });
const frameM = M('#3f6b60'), barM = M('#2b4a42');
function windowAt(side, z, y = 2.55, w = 2.3, h = 2.3) {
  const x = side * 9.96;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyM);
  pane.position.set(x - side * 0.02, y, z); pane.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(pane);
  const fx = x - side * 0.05;
  sbox(0.1, 0.12, w + 0.2, frameM, fx, y + h / 2 + 0.05, z, 0, false);
  sbox(0.1, 0.12, w + 0.2, frameM, fx, y - h / 2 - 0.05, z, 0, false);
  sbox(0.1, h, 0.12, frameM, fx, y, z - w / 2 - 0.05, 0, false);
  sbox(0.1, h, 0.12, frameM, fx, y, z + w / 2 + 0.05, 0, false);
  sbox(0.06, 0.07, w, frameM, fx, y + 0.25, z, 0, false);
  for (let i = 1; i < 7; i++) sbox(0.035, h, 0.035, barM, x - side * 0.09, y, z - w / 2 + (w * i) / 7, 0, true);
  sbox(0.25, 0.06, w + 0.3, M('#d9ceb5'), x - side * 0.12, y - h / 2 - 0.12, z, 0, false);
}
[-7.5, -3.0, 1.5, 6.0].forEach(z => windowAt(-1, z));
[0.5, 5.5].forEach(z => windowAt(1, z));
// door (right wall)
sbox(0.08, 2.4, 1.3, M('#7a4b2a'), 9.94, 1.2, -8.0, 0, false);
sbox(0.1, 0.06, 0.12, M('#d4b45a'), 9.88, 1.15, -7.55, 0, false);

// beams of daylight (soft, additive)
const beamTex = canvasTex(32, 128, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,245,215,0.85)'); gr.addColorStop(1, 'rgba(255,245,215,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 128);
}, { nearest: false });
const beamM = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
[-7.5, -3.0, 1.5, 6.0].forEach(z => {
  const g = new THREE.PlaneGeometry(2.3, 5.2);
  const m = new THREE.Mesh(g, beamM);
  m.position.set(-7.6, 1.9, z); m.rotation.set(0, Math.PI / 2, -0.95); scene.add(m);
});

// chalkboard
function chalkify(g, w, h, seed) {
  const r = rng(seed);
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.restore();
}
const boardTex = canvasTex(1400, 520, (g, w, h) => {
  g.fillStyle = '#2f5b46'; g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 60 + r() * 220, 20 + r() * 70); }
  const c = document.createElement('canvas'); c.width = w; c.height = h; const t = c.getContext('2d');
  t.fillStyle = '#f4f2e6'; t.textAlign = 'center'; t.textBaseline = 'middle';
  t.font = '78px Hand'; t.fillText('FINAL EXAMINATION', 520, 70);
  t.fillRect(220, 112, 600, 5);
  t.textAlign = 'left'; t.font = '50px Hand';
  t.fillText('Subject: Physics', 70, 190);
  t.fillText('Time: 3 hours', 70, 260);
  t.fillText('10:00 AM - 1:00 PM', 70, 330);
  t.font = '46px Hand';
  t.fillText('F = ma', 560, 200); t.fillText('E = mc²', 560, 270); t.fillText('∫ sin x dx = ?', 560, 340);
  t.fillText('Write your roll no.', 70, 440);
  // NO TOILET BREAKS box
  t.strokeStyle = '#f7e9a8'; t.lineWidth = 7; t.strokeRect(985, 120, 380, 375);
  t.fillStyle = '#f7e9a8'; t.textAlign = 'center'; t.font = '108px Hand';
  t.fillText('NO', 1175, 200); t.fillText('TOILET', 1175, 305); t.fillText('BREAKS!', 1175, 410);
  t.fillRect(1030, 465, 290, 7);
  chalkify(t, w, h, 5);
  g.drawImage(c, 0, 0);
}, { nearest: false });
{
  sbox(7.4, 2.9, 0.08, M('#6b4423'), 0, 2.3, -10.96, 0, false);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshLambertMaterial({ map: boardTex }));
  board.position.set(0, 2.3, -10.91); scene.add(board);
  sbox(7, 0.06, 0.14, M('#6b4423'), 0, 0.99, -10.86, 0, true);
  sbox(0.12, 0.05, 0.05, M('#ffffff'), -2.4, 1.04, -10.85, 0, false);
  sbox(0.1, 0.05, 0.05, M('#f6e27a'), -2.1, 1.04, -10.85, 0, false);
  sbox(0.22, 0.07, 0.1, M('#3a3a3a'), 2.2, 1.05, -10.85, 0, false);
}
const BOARD_TEXT = V(2.25, 2.0, -10.9); // centre of "NO TOILET BREAKS!"

// clock
const clockTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, 256, 256);
  g.save(); g.translate(128, 128);
  for (let i = 0; i < 60; i++) {
    g.save(); g.rotate(i * Math.PI / 30);
    g.fillStyle = '#1b1b1b';
    if (i % 5 === 0) g.fillRect(-5, -118, 10, 30); else g.fillRect(-2, -118, 4, 10);
    g.restore();
  }
  g.restore();
  g.fillStyle = '#1b1b1b'; g.font = '22px Pixelify'; g.textAlign = 'center'; g.fillText('QUARTZ', 128, 180);
}, { nearest: false });
const CLOCK = new THREE.Group(); CLOCK.position.set(0, 4.32, -10.9); scene.add(CLOCK);
{
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20), M('#1c1c1c'));
  rim.rotation.x = Math.PI / 2; rim.castShadow = true; CLOCK.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), new THREE.MeshLambertMaterial({ map: clockTex }));
  face.position.z = 0.045; CLOCK.add(face);
}
function hand(len, wid, color, z) {
  const pivot = new THREE.Group(); pivot.position.z = z; CLOCK.add(pivot);
  box(pivot, wid, len, 0.012, M(color), 0, len / 2 - 0.05, 0, false); return pivot;
}
const hHour = hand(0.26, 0.05, '#151515', 0.055), hMin = hand(0.38, 0.034, '#151515', 0.065), hSec = hand(0.42, 0.016, '#d42020', 0.075);
box(CLOCK, 0.05, 0.05, 0.03, M('#d42020'), 0, 0, 0.085, false);

// ceiling fans + tube lights
const FANS = [];
const fanM = M('#e7e2d6'), fanDark = M('#5b5852');
for (const x of [-3.6, 3.6]) for (const z of [-6.0, -1.0, 4.0]) {
  sbox(0.06, 0.55, 0.06, fanDark, x, 4.92, z, 0, false);
  const g = new THREE.Group(); g.position.set(x, 4.6, z); scene.add(g);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 8), fanDark); g.add(motor);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3; g.add(arm);
    box(arm, 0.82, 0.025, 0.2, fanM, 0.55, -0.02, 0, true).rotation.x = 0.12;
  }
  FANS.push(g);
}
const tubeM = new THREE.MeshBasicMaterial({ color: '#fffbea' });
for (const x of [-6, 0, 6]) for (const z of [-8, -3.5, 1, 5.5]) {
  sbox(1.5, 0.05, 0.16, M('#cfcac0'), x, 5.18, z, 0, false);
  const t = new THREE.Mesh(unitBox, tubeM); t.scale.set(1.4, 0.05, 0.08); t.position.set(x, 5.14, z); scene.add(t);
}

// back wall: notice board + sign
const signTex = canvasTex(512, 160, (g) => {
  g.fillStyle = '#fbfaf3'; g.fillRect(0, 0, 512, 160);
  g.fillStyle = '#b3261e'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 146, 512, 14);
  g.fillStyle = '#222'; g.font = '84px Pixelify'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SILENCE', 256, 84);
});
{
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshLambertMaterial({ map: signTex }));
  s.position.set(3.5, 2.9, 9.93); s.rotation.y = Math.PI; scene.add(s);
  sbox(3.2, 1.5, 0.06, M('#b98a55'), -3.2, 2.4, 9.95, 0, false);
  const r = rng(21);
  for (let i = 0; i < 7; i++) sbox(0.42, 0.55, 0.02, M(['#ffffff', '#fff7c2', '#d9f0ff'][i % 3]), -4.4 + (i % 4) * 0.8 + r() * 0.1, 2.8 - Math.floor(i / 4) * 0.7, 9.91, (r() - 0.5) * 0.2, false);
  // side wall posters
  sbox(0.03, 1.0, 0.75, M('#f4e7c6'), 9.95, 2.6, 3.0, 0, false);
  sbox(0.03, 0.8, 1.2, M('#cfe3f7'), 9.95, 2.5, -4.0, 0, false);
}

// teacher desk
{
  const x = -3.2, z = -8.7;
  sbox(1.9, 0.07, 0.9, M('#7b4a26'), x, 0.82, z);
  sbox(1.9, 0.72, 0.05, M('#6a3f20'), x, 0.43, z + 0.42);
  for (const dx of [-0.88, 0.88]) sbox(0.08, 0.8, 0.85, M('#6a3f20'), x + dx, 0.4, z);
  sbox(0.5, 0.12, 0.36, M('#ffffff'), x - 0.4, 0.92, z - 0.05);
  sbox(0.48, 0.05, 0.34, M('#2d4f8a'), x + 0.3, 0.88, z);
  sbox(0.1, 0.1, 0.1, M('#d42a2a'), x + 0.75, 0.9, z + 0.1);
  sbox(0.02, 0.05, 0.02, M('#5a3a1a'), x + 0.75, 0.97, z + 0.1);
}

// desks + chairs grid
const COLS = [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0];
const ROWS = [-6.2, -4.5, -2.8, -1.1, 0.6, 2.3, 4.0, 5.7];
const deskTop = M('#9a6234'), deskLeg = M('#5e3a1c'), chairM = M('#7a4a26');
const paperTex = canvasTex(64, 80, (g) => {
  g.fillStyle = '#fbfbf5'; g.fillRect(0, 0, 64, 80);
  g.fillStyle = '#9fb3d1'; for (let y = 14; y < 80; y += 7) g.fillRect(4, y, 56, 1);
  g.fillStyle = '#3a3a5a'; g.fillRect(6, 4, 30, 3);
  const r = rng(4); for (let y = 15; y < 70; y += 7) g.fillRect(6, y - 3, 12 + r() * 40, 2);
});
const paperM = new THREE.MeshLambertMaterial({ map: paperTex });
const SEATS = [];
for (let ci = 0; ci < COLS.length; ci++) for (let ri = 0; ri < ROWS.length; ri++) {
  const x = COLS[ci], z = ROWS[ri];
  SEATS.push({ ci, ri, x, z });
  const dz = z - 0.62;
  sbox(1.16, 0.06, 0.62, deskTop, x, 0.78, dz);
  for (const lx of [-0.52, 0.52]) for (const lz of [-0.26, 0.26]) sbox(0.06, 0.76, 0.06, deskLeg, x + lx, 0.38, dz + lz);
  sbox(1.0, 0.04, 0.5, deskLeg, x, 0.55, dz); // book shelf
  const pg = new THREE.PlaneGeometry(0.32, 0.4); pg.rotateX(-Math.PI / 2);
  sgeo(pg, paperM, x - 0.05 + ((ci * 7 + ri * 3) % 5 - 2) * 0.02, 0.812, dz + 0.04, 0, ((ci + ri) % 3 - 1) * 0.12, 0, false);
  // chair
  sbox(0.52, 0.05, 0.46, chairM, x, 0.46, z + 0.02);
  for (const lx of [-0.22, 0.22]) for (const lz of [-0.19, 0.21]) sbox(0.045, 0.46, 0.045, deskLeg, x + lx, 0.23, z + 0.02 + lz);
  sbox(0.52, 0.32, 0.05, chairM, x, 0.82, z + 0.25);
  for (const lx of [-0.22, 0.22]) sbox(0.045, 0.4, 0.045, deskLeg, x + lx, 0.66, z + 0.25);
}
flushStatic();

// ------------------------------------------------------------------ faces (32x32 pixel grid on 256px canvas)
const CELL = 8;
function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x) * CELL, Math.round(y) * CELL, w * CELL, h * CELL); }
const FACE_DEF = { look: [0, 0], open: 1, size: 1, pupil: 'normal', brow: 'neutral', mouth: 'flat', blush: 0, lids: 0, talk: 0, eyes: 'normal' };

function drawFaceBoy(g, s, skin, o) {
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  const big = s.size;
  const ew = big > 1.15 ? 8 : big > 1.02 ? 7 : 6, eh = ew + (big > 1.15 ? 1 : 0);
  const pw = s.pupil === 'tiny' ? 1 : s.pupil === 'small' ? 2 : 3;
  const ph = s.pupil === 'tiny' ? 2 : pw;
  for (const cx of [10, 22]) {
    const x0 = cx - Math.floor(ew / 2), y0 = 16 - Math.floor(eh / 2);
    if (s.open < 0.2) { px(g, x0, 16, ew, 1, '#1b120e'); continue; }
    px(g, x0, y0, ew, eh, '#ffffff');
    const pxo = Math.round(s.look[0] * (ew - pw) / 2), pyo = -Math.round(s.look[1] * (eh - ph) / 2);
    px(g, cx - Math.floor(pw / 2) + pxo, 16 - Math.floor(ph / 2) + pyo, pw, ph, '#120c0a');
    if (s.lids > 0) { const lh = Math.round(eh * s.lids); px(g, x0, y0, ew, lh, skin); px(g, x0, y0 + lh, ew, 1, '#1b120e'); }
    // brows
    const by = y0 - 3 - (s.brow === 'up' ? 1 : 0);
    const inner = cx < 16 ? 1 : -1;
    if (s.brow === 'worried') {
      for (let i = 0; i < ew; i++) { const xx = x0 + i; const isInner = (inner > 0 ? i >= ew / 2 : i < ew / 2); px(g, xx, by + (isInner ? -1 : 0), 1, 2, '#17110e'); }
    } else if (s.brow === 'angry') {
      for (let i = 0; i < ew; i++) { const xx = x0 + i; const isInner = (inner > 0 ? i >= ew / 2 : i < ew / 2); px(g, xx, by + (isInner ? 1 : 0), 1, 2, '#17110e'); }
    } else px(g, x0, by, ew, 2, '#17110e');
  }
  if (s.blush > 0.01) {
    g.globalAlpha = clamp(s.blush) * 0.95;
    px(g, 3, 21, 6, 3, '#ff5f7c'); px(g, 23, 21, 6, 3, '#ff5f7c');
    g.globalAlpha = clamp(s.blush) * 0.9;
    px(g, 5, 21, 1, 1, '#ffb3c0'); px(g, 24, 21, 1, 1, '#ffb3c0');
    g.globalAlpha = 1;
  }
  const mc = '#5c2a22';
  switch (s.mouth) {
    case 'smile': px(g, 12, 23, 1, 1, mc); px(g, 13, 24, 6, 1, mc); px(g, 19, 23, 1, 1, mc); break;
    case 'shy': px(g, 13, 24, 1, 1, mc); px(g, 14, 25, 4, 1, mc); px(g, 18, 24, 1, 1, mc); break;
    case 'o': px(g, 15, 23, 3, 3, mc); px(g, 16, 24, 1, 1, '#a0453a'); break;
    case 'O': px(g, 14, 23, 4, 4, mc); px(g, 15, 25, 2, 1, '#c45a5a'); break;
    case 'wobble': for (let i = 0; i < 9; i++) px(g, 12 + i, 24 + (i % 2), 1, 1, mc); break;
    case 'grimace':
      px(g, 11, 23, 11, 4, mc); px(g, 12, 24, 9, 2, '#ffffff');
      for (const x of [14, 16, 18]) px(g, x, 24, 1, 2, '#c9c2b8'); break;
    default: px(g, 13, 24, 6, 1, mc);
  }
}

function drawFaceGirl(g, s, skin) { // the crush: big sparkly eyes
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  // brows (thin, under the bangs)
  const bc = '#3a2724';
  if (s.brow === 'suspicious') { px(g, 8, 11, 2, 1, bc); px(g, 10, 12, 2, 1, bc); px(g, 21, 10, 4, 1, bc); }
  else if (s.brow === 'up') { px(g, 8, 10, 4, 1, bc); px(g, 20, 10, 4, 1, bc); }
  else { px(g, 8, 11, 4, 1, bc); px(g, 20, 11, 4, 1, bc); }
  const lash = '#160d0d';
  for (const [cx, side] of [[10, -1], [22, 1]]) {
    if (s.eyes === 'happy') { // ^ ^
      px(g, cx - 3, 18, 1, 1, lash); px(g, cx - 2, 17, 1, 1, lash); px(g, cx - 1, 16, 3, 1, lash); px(g, cx + 2, 17, 1, 1, lash); px(g, cx + 3, 18, 1, 1, lash);
      continue;
    }
    if (s.eyes === 'squeeze') { // > <
      const d = side < 0 ? 1 : -1;
      px(g, cx - 2 * d, 15, 1, 1, lash); px(g, cx - d, 16, 1, 1, lash); px(g, cx, 17, 1, 1, lash); px(g, cx - d, 18, 1, 1, lash); px(g, cx - 2 * d, 19, 1, 1, lash);
      px(g, cx + d, 17, 1, 1, lash);
      continue;
    }
    if (s.open < 0.2) { px(g, cx - 3, 18, 7, 1, lash); px(g, cx + 3 * side + side, 17, 1, 1, lash); continue; }
    // big round iris
    px(g, cx - 3, 14, 7, 8, '#2a1716');
    px(g, cx - 3, 17, 7, 2, '#4a2a26');
    px(g, cx - 3, 19, 7, 2, '#7d4936');
    px(g, cx - 2, 21, 5, 1, '#b06c4c');
    px(g, cx - 3, 21, 1, 1, skin); px(g, cx + 3, 21, 1, 1, skin);
    const lx = Math.round(s.look[0] * 1), ly = -Math.round(s.look[1] * 1);
    px(g, cx - 1 + lx, 16 + ly, 3, 3, '#0e0707');
    // sparkles
    px(g, cx - 2 + lx, 15 + ly, 2, 2, '#ffffff');
    px(g, cx + 1 + lx, 19 + ly, 1, 1, '#ffffff');
    px(g, cx + 2 + lx, 15 + ly, 1, 1, '#ffd6e6');
    // lashes with a little outer flick
    px(g, cx - 3, 13, 7, 1, lash);
    px(g, side < 0 ? cx - 4 : cx + 4, 13, 1, 1, lash);
    px(g, side < 0 ? cx - 5 : cx + 5, 12, 1, 1, lash);
    if (s.lids > 0) { const lh = Math.round(8 * s.lids); px(g, cx - 4, 13, 9, lh, skin); px(g, cx - 3, 13 + lh, 7, 1, lash); }
  }
  // blush
  const b = clamp(0.55 + s.blush * 0.45);
  g.globalAlpha = b * 0.85; px(g, 4, 23, 5, 2, '#ff8aa5'); px(g, 23, 23, 5, 2, '#ff8aa5');
  g.globalAlpha = b; px(g, 5, 23, 1, 1, '#ffd0db'); px(g, 24, 23, 1, 1, '#ffd0db');
  g.globalAlpha = 1;
  // nose
  if (s.eyes === 'squeeze') { px(g, 14, 21, 1, 1, '#d99a86'); px(g, 17, 21, 1, 1, '#d99a86'); px(g, 15, 22, 2, 1, '#d99a86'); }
  else px(g, 16, 22, 1, 1, '#e3a993');
  const mc = '#b8435c';
  if (s.talk > 0.5) { px(g, 15, 25, 3, 2, '#7a2236'); px(g, 15, 26, 3, 1, '#e0707f'); }
  else switch (s.mouth) {
    case 'cat': px(g, 13, 25, 1, 1, mc); px(g, 14, 26, 1, 1, mc); px(g, 15, 25, 2, 1, mc); px(g, 17, 26, 1, 1, mc); px(g, 18, 25, 1, 1, mc); break;
    case 'smile': px(g, 14, 25, 1, 1, mc); px(g, 15, 26, 3, 1, mc); px(g, 18, 25, 1, 1, mc); break;
    case 'small': px(g, 15, 26, 2, 1, mc); break;
    case 'o': px(g, 15, 25, 2, 2, '#8a2a3e'); break;
    case 'pout': px(g, 15, 26, 3, 1, mc); px(g, 14, 25, 1, 1, mc); break;
    default: px(g, 15, 26, 3, 1, mc);
  }
}

function drawFaceTeacher(g, s, skin) {
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  for (const cx of [10, 22]) {
    if (s.open < 0.2) { px(g, cx - 2, 16, 4, 1, '#1b120e'); continue; }
    px(g, cx - 2, 15, 4, 3, '#ffffff');
    const lx = Math.round(s.look[0]), ly = -Math.round(s.look[1]);
    px(g, cx - 1 + lx, 15 + ly + 1, 2, 2, '#120c0a');
  }
  const bc = '#2e2622';
  if (s.brow === 'raised') {
    for (let i = 0; i < 6; i++) px(g, 7 + i, 12 + (i >= 4 ? 1 : 0), 1, 2, bc);
    for (let i = 0; i < 6; i++) px(g, 19 + i, 10, 1, 2, bc);
  } else {
    for (let i = 0; i < 6; i++) px(g, 7 + i, 12 + (i >= 3 ? 1 : 0), 1, 2, bc);
    for (let i = 0; i < 6; i++) px(g, 19 + i, 12 + (i < 3 ? 1 : 0), 1, 2, bc);
  }
  px(g, 15, 18, 2, 4, '#c08a66'); // nose shade
  px(g, 6, 20, 2, 1, '#c99472'); px(g, 24, 20, 2, 1, '#c99472');
  const mc = '#5a2c22';
  if (s.mouth === 'o') px(g, 15, 26, 2, 2, mc); else { px(g, 13, 26, 6, 1, mc); px(g, 12, 27, 1, 1, mc); px(g, 19, 27, 1, 1, mc); }
}

function drawFaceStudent(g, s, skin, o) {
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  const v = o.faceVar;
  for (const cx of [10, 22]) {
    if (s.open < 0.2) { px(g, cx - 2, 16, 4, 1, '#1b120e'); continue; }
    if (s.size > 1.05 || v === 0) {
      const ew = s.size > 1.05 ? 6 : 5;
      px(g, cx - Math.floor(ew / 2), 14, ew, ew, '#ffffff');
      const lx = Math.round(s.look[0] * 1.4), ly = -Math.round(s.look[1] * 1.4);
      const pw = s.size > 1.05 ? 2 : 2;
      px(g, cx - 1 + lx, 16 + ly, pw, pw, '#120c0a');
    } else {
      const lx = Math.round(s.look[0]), ly = -Math.round(s.look[1]);
      px(g, cx - 1 + lx, 15 + ly, 3, 3, '#120c0a');
      px(g, cx - 1 + lx, 15 + ly, 1, 1, '#ffffff');
    }
    if (s.lids > 0) px(g, cx - 3, 13, 7, 2, skin), px(g, cx - 3, 15, 7, 1, '#1b120e');
    const by = 11;
    if (s.brow === 'angry') { px(g, cx - 3, by + (cx < 16 ? 0 : 1), 3, 1, '#20160f'); px(g, cx, by + (cx < 16 ? 1 : 0), 3, 1, '#20160f'); }
    else if (v !== 2) px(g, cx - 3, by, 6, 1, '#20160f');
  }
  if (o.girl) { g.globalAlpha = 0.55; px(g, 5, 21, 4, 2, '#ff8a9b'); px(g, 23, 21, 4, 2, '#ff8a9b'); g.globalAlpha = 1; }
  const mc = '#5c2a22';
  switch (s.mouth) {
    case 'smile': px(g, 13, 24, 1, 1, mc); px(g, 14, 25, 4, 1, mc); px(g, 18, 24, 1, 1, mc); break;
    case 'o': px(g, 15, 24, 2, 2, mc); break;
    case 'disgust': for (let i = 0; i < 7; i++) px(g, 13 + i, 25 + (i % 2), 1, 1, mc); break;
    default: px(g, 14, 25, 4, 1, mc);
  }
}

class Face {
  constructor(style, skin, o) {
    this.style = style; this.skin = skin; this.o = o;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 256;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = THREE.NearestFilter;
    this.material = new THREE.MeshLambertMaterial({ map: this.tex });
    this.key = '';
    this.state = { ...FACE_DEF };
  }
  set(st) { this.state = { ...FACE_DEF, ...st }; }
  update() {
    const s = this.state;
    const key = JSON.stringify(s, (k, v) => typeof v === 'number' ? Math.round(v * 20) / 20 : v);
    if (key === this.key) return;
    this.key = key;
    const f = { boy: drawFaceBoy, girl: drawFaceGirl, teacher: drawFaceTeacher, student: drawFaceStudent }[this.style];
    f(this.g, s, this.skin, this.o);
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ characters
const ALL = [];
function makeChar(o) {
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 0.52; root.add(pelvis);
  box(pelvis, 0.56, 0.2, 0.32, M(o.hips || o.pants), 0, 0.02, 0);
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * 0.135, 0, 0); pelvis.add(hip);
    box(hip, 0.25, 0.46, 0.27, M(o.legUpper || o.pants), 0, -0.21, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
    box(knee, 0.24, 0.42, 0.25, M(o.legLower || o.pants), 0, -0.2, 0);
    if (o.socks) box(knee, 0.246, 0.12, 0.256, M(o.socks), 0, -0.35, 0);
    box(knee, 0.26, 0.11, 0.36, M(o.shoes), 0, -0.44, 0.05);
    return { hip, knee };
  });
  const spine = new THREE.Group(); spine.position.y = 0.08; spine.rotation.order = 'YXZ'; pelvis.add(spine);
  const torso = box(spine, 0.58, 0.62, 0.32, M(o.shirt), 0, 0.31, 0);
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.385, 0.56, 0); spine.add(sh);
    box(sh, 0.19, 0.34, 0.22, M(o.sleeve || o.shirt), 0, -0.13, 0);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    box(el, 0.18, 0.26, 0.21, M(o.forearm || o.skin), 0, -0.12, 0);
    const hand = new THREE.Group(); hand.position.set(0, -0.29, 0); el.add(hand);
    box(hand, 0.17, 0.12, 0.2, M(o.skin), 0, -0.01, 0);
    return { sh, el, hand, side: s };
  });
  const neck = new THREE.Group(); neck.position.y = 0.62; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.28; head.rotation.order = 'YXZ'; neck.add(head);
  const face = new Face(o.faceStyle, o.skin, o);
  const sk = M(o.skin);
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), [sk, sk, sk, sk, face.material, sk]);
  headMesh.castShadow = true; headMesh.receiveShadow = true; head.add(headMesh);
  const c = { root, pelvis, legs, spine, torso, arms, neck, head, face, o, hidden: false };
  if (o.hair) o.hair(c);
  if (o.outfit) o.outfit(c);
  if (o.pencil !== false) {
    const p = new THREE.Group(); p.position.set(0, -0.07, 0.08); p.rotation.x = 0.9; arms[0].hand.add(p);
    box(p, 0.025, 0.17, 0.025, M('#f2c12e'), 0, 0, 0, false);
    box(p, 0.027, 0.03, 0.027, M('#f08aa0'), 0, 0.095, 0, false);
    box(p, 0.015, 0.03, 0.015, M('#3a2a1a'), 0, -0.095, 0, false);
    c.pencil = p;
  }
  if (o.scale) root.scale.setScalar(o.scale);
  scene.add(root); ALL.push(c);
  return c;
}

// hair / outfits
function hairBoy(color, variant = 0) {
  return (c) => {
    const h = c.head, m = M(color);
    box(h, 0.56, 0.12, 0.56, m, 0, 0.31, 0);
    box(h, 0.56, 0.32, 0.07, m, 0, 0.12, -0.27);
    box(h, 0.05, 0.2, 0.46, m, -0.28, 0.16, -0.04); box(h, 0.05, 0.2, 0.46, m, 0.28, 0.16, -0.04);
    if (variant === 0) { box(h, 0.56, 0.09, 0.08, m, 0, 0.22, 0.26); }
    if (variant === 1) { box(h, 0.36, 0.12, 0.08, m, -0.1, 0.21, 0.26); box(h, 0.18, 0.07, 0.08, m, 0.19, 0.24, 0.26); }
    if (variant === 2) { box(h, 0.56, 0.06, 0.08, m, 0, 0.24, 0.26); box(h, 0.3, 0.1, 0.3, m, 0, 0.4, 0.05); }
  };
}
function hairME(c) {
  const h = c.head, m = M('#15100d');
  box(h, 0.57, 0.13, 0.57, m, 0, 0.31, 0);
  box(h, 0.57, 0.1, 0.08, m, 0, 0.22, 0.265);
  box(h, 0.57, 0.36, 0.07, m, 0, 0.1, -0.27);
  box(h, 0.05, 0.22, 0.48, m, -0.285, 0.15, -0.03); box(h, 0.05, 0.22, 0.48, m, 0.285, 0.15, -0.03);
  const sp = [[-0.17, 0.4, 0.14, 0.3, 0, 0.3], [0.02, 0.42, 0.17, 0.25, 0.2, 0], [0.19, 0.4, 0.1, 0.2, 0, -0.35], [-0.05, 0.41, -0.1, -0.2, 0.3, 0.1], [0.15, 0.39, -0.15, 0, 0.5, -0.2]];
  for (const [x, y, z, rx, ry, rz] of sp) { const b = box(h, 0.17, 0.12, 0.17, m, x, y, z); b.rotation.set(rx, ry, rz); }
}
function hairGirl(color, variant) {
  return (c) => {
    const h = c.head, m = M(color);
    box(h, 0.56, 0.13, 0.56, m, 0, 0.305, 0);
    box(h, 0.56, 0.62, 0.07, m, 0, -0.02, -0.28);
    box(h, 0.06, 0.5, 0.5, m, -0.285, 0.05, -0.02); box(h, 0.06, 0.5, 0.5, m, 0.285, 0.05, -0.02);
    box(h, 0.56, 0.1, 0.06, m, 0, 0.22, 0.265);
    if (variant === 1) { box(h, 0.12, 0.42, 0.12, m, -0.16, -0.4, -0.3); box(h, 0.12, 0.42, 0.12, m, 0.16, -0.4, -0.3); }
    if (variant === 2) { box(h, 0.16, 0.16, 0.16, m, 0, 0.3, -0.3); box(h, 0.13, 0.38, 0.13, m, 0, 0.05, -0.36); }
  };
}
function hairCrush(c) {
  const h = c.head, m = M('#140e0e'), pink = M('#ff6fa8'), pinkL = M('#ffb3d1');
  box(h, 0.565, 0.13, 0.565, m, 0, 0.305, 0);
  box(h, 0.565, 0.58, 0.075, m, 0, 0.02, -0.285);
  box(h, 0.065, 0.48, 0.52, m, -0.287, 0.07, -0.01); box(h, 0.065, 0.48, 0.52, m, 0.287, 0.07, -0.01);
  // straight bangs
  box(h, 0.56, 0.15, 0.05, m, 0, 0.19, 0.275);
  box(h, 0.07, 0.34, 0.04, m, -0.245, 0.01, 0.27); box(h, 0.07, 0.34, 0.04, m, 0.245, 0.01, 0.27);
  // two small ponytails + pink clips
  for (const s of [-1, 1]) {
    const pt = new THREE.Group(); pt.position.set(s * 0.32, 0.14, -0.12); pt.rotation.z = s * 0.35; h.add(pt);
    box(pt, 0.14, 0.32, 0.14, m, 0, -0.17, 0);
    box(pt, 0.1, 0.1, 0.1, m, 0, -0.36, 0);
    box(pt, 0.17, 0.07, 0.17, pink, 0, 0.0, 0);
    box(pt, 0.06, 0.06, 0.06, pinkL, s * 0.06, 0.05, 0.06, false);
  }
  // hair clip on the bangs
  box(h, 0.12, 0.04, 0.03, pink, 0.13, 0.215, 0.305, false);
  box(h, 0.04, 0.04, 0.032, pinkL, 0.09, 0.215, 0.31, false);
}
function outfitME(c) {
  const sp = c.spine;
  box(sp, 0.05, 0.6, 0.012, M('#d9d9d2'), 0, 0.3, 0.165, false);
  for (const y of [0.15, 0.3, 0.45]) box(sp, 0.03, 0.03, 0.012, M('#b9b9b2'), 0, y, 0.172, false);
  box(sp, 0.16, 0.08, 0.06, M('#e9e9e2'), -0.1, 0.6, 0.16).rotation.z = -0.3;
  box(sp, 0.16, 0.08, 0.06, M('#e9e9e2'), 0.1, 0.6, 0.16).rotation.z = 0.3;
  box(sp, 0.14, 0.13, 0.012, M('#e2e2db'), 0.15, 0.42, 0.166, false);
  box(sp, 0.02, 0.1, 0.02, M('#2a5bd7'), 0.12, 0.48, 0.17, false);
}
function outfitCrush(c) {
  const sp = c.spine;
  box(sp, 0.18, 0.6, 0.012, M('#f8f8f4'), 0, 0.31, 0.165, false);
  for (const y of [0.12, 0.27, 0.42]) { box(sp, 0.03, 0.03, 0.012, M('#c9cfe8'), -0.11, y, 0.168, false); }
  box(sp, 0.14, 0.08, 0.06, M('#ffffff'), -0.08, 0.61, 0.16).rotation.z = -0.35;
  box(sp, 0.14, 0.08, 0.06, M('#ffffff'), 0.08, 0.61, 0.16).rotation.z = 0.35;
  // ribbon bow
  box(sp, 0.08, 0.07, 0.03, M('#e8507a'), -0.06, 0.55, 0.18, false); box(sp, 0.08, 0.07, 0.03, M('#e8507a'), 0.06, 0.55, 0.18, false);
  box(sp, 0.04, 0.05, 0.035, M('#c63b62'), 0, 0.55, 0.185, false);
  box(c.pelvis, 0.6, 0.2, 0.36, M('#2f3553'), 0, -0.03, 0.02);
}
function outfitTeacher(c) {
  const sp = c.spine;
  box(sp, 0.2, 0.26, 0.012, M('#f2f2ee'), 0, 0.5, 0.165, false);
  box(sp, 0.06, 0.34, 0.016, M('#23305c'), 0, 0.44, 0.17, false);
  box(sp, 0.13, 0.07, 0.06, M('#f2f2ee'), -0.08, 0.61, 0.16).rotation.z = -0.35;
  box(sp, 0.13, 0.07, 0.06, M('#f2f2ee'), 0.08, 0.61, 0.16).rotation.z = 0.35;
  const h = c.head, hm = M('#3d3936'), gm = M('#151515');
  box(h, 0.56, 0.06, 0.5, M('#57514c'), 0, 0.28, -0.02);
  box(h, 0.06, 0.26, 0.42, hm, -0.285, 0.08, -0.04); box(h, 0.06, 0.26, 0.42, hm, 0.285, 0.08, -0.04);
  box(h, 0.56, 0.3, 0.07, hm, 0, 0.05, -0.27);
  box(h, 0.3, 0.07, 0.05, M('#2a221f'), 0, -0.13, 0.28); // mustache
  box(h, 0.1, 0.05, 0.05, M('#2a221f'), -0.13, -0.16, 0.28); box(h, 0.1, 0.05, 0.05, M('#2a221f'), 0.13, -0.16, 0.28);
  // glasses
  for (const x of [-0.098, 0.098]) {
    box(h, 0.16, 0.02, 0.02, gm, x, 0.035, 0.275, false); box(h, 0.16, 0.02, 0.02, gm, x, -0.045, 0.275, false);
    box(h, 0.02, 0.1, 0.02, gm, x - 0.07, -0.005, 0.275, false); box(h, 0.02, 0.1, 0.02, gm, x + 0.07, -0.005, 0.275, false);
  }
  box(h, 0.06, 0.02, 0.02, gm, 0, 0.02, 0.275, false);
  box(h, 0.02, 0.02, 0.3, gm, -0.27, 0.02, 0.13, false); box(h, 0.02, 0.02, 0.3, gm, 0.27, 0.02, 0.13, false);
  const lens = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.18 });
  for (const x of [-0.098, 0.098]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.07), lens); l.position.set(x, -0.005, 0.276); h.add(l); }
}
function outfitGirlStudent(c) {
  box(c.spine, 0.6, 0.42, 0.34, M('#26315a'), 0, 0.2, 0);
  box(c.pelvis, 0.6, 0.2, 0.36, M('#26315a'), 0, -0.03, 0.02);
}

// --- cast
const SKINS = ['#8d5a3b', '#a86f4c', '#c08a5e', '#d9a77f', '#efc6a4', '#6b4228', '#b7794f'];
const HAIRS = ['#15100d', '#241711', '#38241a', '#1d1714'];
const ME_SEAT = SEATS.find(s => s.ci === 3 && s.ri === 4);
const CR_SEAT = SEATS.find(s => s.ci === 3 && s.ri === 5);

const ME = makeChar({ skin: '#c48659', shirt: '#f4f4ef', sleeve: '#f4f4ef', pants: '#2b3550', shoes: '#1d1d1f', faceStyle: 'boy', hair: hairME, outfit: outfitME });
ME.root.position.set(ME_SEAT.x, 0, ME_SEAT.z); ME.root.rotation.y = Math.PI;
const CR = makeChar({ skin: '#f7d8c3', shirt: '#22305d', sleeve: '#22305d', forearm: '#22305d', pants: '#2f3553', legUpper: '#2f3553', legLower: '#f7d8c3', socks: '#ffffff', shoes: '#2a1d1a', faceStyle: 'girl', hair: hairCrush, outfit: outfitCrush, scale: 0.95 });
CR.root.position.set(CR_SEAT.x, 0, CR_SEAT.z); CR.root.rotation.y = Math.PI;
const TE = makeChar({ skin: '#d29c76', shirt: '#868a90', sleeve: '#f2f2ee', forearm: '#f2f2ee', pants: '#3a3a42', shoes: '#4a2e1e', faceStyle: 'teacher', outfit: outfitTeacher, scale: 1.06, pencil: false });
{ // pointer stick
  const p = new THREE.Group(); p.position.set(0, -0.06, 0.02); TE.arms[1].hand.add(p);
  box(p, 0.025, 0.025, 0.85, M('#8a5a2b'), 0, 0, 0.4, false); TE.pointer = p;
}

// ME's pants: a big, poop-filled bulge that inflates on "pooped"
const BULGE = new THREE.Group(); BULGE.position.set(0, -0.07, -0.2); ME.pelvis.add(BULGE);
{
  const bm = new THREE.MeshLambertMaterial({ color: '#2d3756', flatShading: true });
  const lumps = [[0, 0, -0.08, 0.25, [1.25, 1.0, 1.05]], [0.15, -0.09, -0.13, 0.17, [1, 1, 1]], [-0.15, -0.07, -0.12, 0.18, [1, 1, 1]], [0.02, -0.15, -0.2, 0.15, [1.2, 0.9, 1]]];
  for (const [x, y, z, r, sc] of lumps) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bm);
    m.position.set(x, y, z); m.scale.set(...sc); m.castShadow = true; m.receiveShadow = true; BULGE.add(m);
  }
  // seams so it reads as trousers stretched over the load
  box(BULGE, 0.03, 0.4, 0.03, M('#1f2740'), 0, -0.02, -0.33, false).rotation.x = 0.5;
  box(BULGE, 0.5, 0.035, 0.03, M('#1f2740'), 0, 0.13, -0.2, false);
}
const STUDENTS = [];
{
  const r = rng(1234);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const cand = SEATS.filter(s => s !== ME_SEAT && s !== CR_SEAT);
  const front = cand.filter(s => s.ri <= 3 && (s.ci >= 2 && s.ci <= 4)), front2 = cand.filter(s => s.ri <= 3 && (s.ci < 2 || s.ci > 4)), mid = cand.filter(s => s.ri === 4), back = cand.filter(s => s.ri >= 5);
  const take = (arr, n) => { const a = [...arr]; const res = []; while (res.length < n) res.push(a.splice(Math.floor(r() * a.length), 1)[0]); return res; };
  const seats = [...front, ...take(front2, 8), ...take(mid, 4), ...take(back, 6)];
  seats.forEach((seat, i) => {
    const girl = r() < 0.5;
    const skin = pick(SKINS), hc = pick(HAIRS);
    const o = girl
      ? { skin, shirt: '#f2f2ee', pants: '#26315a', legUpper: '#26315a', legLower: skin, socks: '#f2f2ee', shoes: '#1d1d1f', faceStyle: 'student', girl: true, faceVar: Math.floor(r() * 3), hair: hairGirl(hc, Math.floor(r() * 3)), outfit: outfitGirlStudent }
      : { skin, shirt: '#f2f2ee', pants: pick(['#26315a', '#2a2a30', '#3a3f4a']), shoes: '#1d1d1f', faceStyle: 'student', faceVar: Math.floor(r() * 3), hair: hairBoy(hc, Math.floor(r() * 3)) };
    const c = makeChar(o);
    c.root.position.set(seat.x, 0, seat.z); c.root.rotation.y = Math.PI;
    c.seat = seat;
    c.phase = r() * 10; c.speed = 0.7 + r() * 0.6;
    c.turnDelay = r() * 0.9;
    c.nose = r() < 0.35;
    c.noseDelay = r() * 2.5;
    STUDENTS.push(c);
  });
}

// ------------------------------------------------------------------ posing helpers
const _v = V(), _w = V();
function poseSeated(c) {
  c.pelvis.position.set(0, 0.52, 0); c.pelvis.rotation.set(0, 0, 0);
  c.legs[0].hip.rotation.set(-Math.PI / 2 + 0.04, 0.05, 0); c.legs[1].hip.rotation.set(-Math.PI / 2 + 0.04, -0.05, 0);
  for (const L of c.legs) L.knee.rotation.set(Math.PI / 2 - 0.04, 0, 0);
  c.spine.rotation.set(0, 0, 0); c.neck.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0);
}
function poseStanding(c, walk = 0, t = 0) {
  c.pelvis.position.set(0, 0.95, 0); c.pelvis.rotation.set(0, 0, 0);
  const sw = Math.sin(t * 7) * 0.45 * walk;
  c.legs[0].hip.rotation.set(sw, 0, 0); c.legs[1].hip.rotation.set(-sw, 0, 0);
  c.legs[0].knee.rotation.set(Math.max(0, -sw) * 0.6, 0, 0); c.legs[1].knee.rotation.set(Math.max(0, sw) * 0.6, 0, 0);
  c.pelvis.position.y = 0.95 + Math.abs(Math.sin(t * 7)) * 0.03 * walk;
  c.spine.rotation.set(0, 0, 0); c.neck.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0);
}
// 2-bone IK: point arm `a` of character c at world target T
function reach(c, a, T) {
  const arm = c.arms[a];
  c.root.updateMatrixWorld(true);
  const tl = c.spine.worldToLocal(_v.copy(T)).sub(arm.sh.position);
  const A = 0.3, B = 0.31;
  const d = clamp(tl.length(), 0.08, A + B - 0.002);
  const dir = tl.normalize();
  const sz = clamp(dir.x, -0.999, 0.999);
  const thz = Math.asin(sz), cz = Math.cos(thz);
  const thx = Math.atan2(-dir.z / cz, -dir.y / cz);
  const alpha = Math.acos(clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1));
  const beta = Math.PI - Math.acos(clamp((A * A + B * B - d * d) / (2 * A * B), -1, 1));
  arm.sh.rotation.set(thx + alpha, 0, thz);
  arm.el.rotation.set(-beta, 0, 0);
}
const rootPt = (c, x, y, z) => c.root.localToWorld(V(x, y, z));
const spinePt = (c, x, y, z) => c.spine.localToWorld(V(x, y, z));
function writeArms(c, t, amt, phase = 0, rest = true) {
  c.root.updateMatrixWorld(true);
  const wx = 0.03 * Math.sin(t * 9 + phase) * amt, wz = 0.025 * Math.sin(t * 5.3 + phase) * amt, wy = 0.012 * Math.abs(Math.sin(t * 17 + phase)) * amt;
  reach(c, 0, rootPt(c, -0.12 + wx, 0.86 + wy, 0.47 + wz));
  if (rest) reach(c, 1, rootPt(c, 0.22, 0.85, 0.42));
}
function headPos(c) { c.root.updateMatrixWorld(true); return c.head.getWorldPosition(V()); }
function fwdOf(c) { const y = c.root.rotation.y; return V(Math.sin(y), 0, Math.cos(y)); }
function blink(t, seed) { const p = (t + seed * 1.37) % 3.3; return p < 0.09 ? 0 : 1; }

// ------------------------------------------------------------------ sprites: hearts, sparkles, stink, puffs, sweat
function pixelSpriteTex(rows, palette, scale = 8) {
  const h = rows.length, w = rows[0].length;
  return canvasTex(w * scale, h * scale, (g) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (palette[ch]) { g.fillStyle = palette[ch]; g.fillRect(x * scale, y * scale, scale, scale); } }
  });
}
const heartTex = pixelSpriteTex([
  '.XX...XX.',
  'XHHX.XPPX',
  'XHPPXPPPX',
  'XPPPPPPPX',
  '.XPPPPPX.',
  '..XPPPX..',
  '...XPX...',
  '....X....'], { X: '#b0164c', P: '#ff5c9a', H: '#ffd3e4' });
const sparkTex = pixelSpriteTex([
  '...Y...',
  '...W...',
  '..WWW..',
  'YWWWWWY',
  '..WWW..',
  '...W...',
  '...Y...'], { W: '#ffffff', Y: '#ffe1f0' });
const POOL = [];
function sprite(tex, opts = {}) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, ...opts });
  const s = new THREE.Sprite(m); s.visible = false; scene.add(s); return s;
}
const heartPool = Array.from({ length: 40 }, () => sprite(heartTex));
const sparkPool = Array.from({ length: 30 }, () => sprite(sparkTex));

// heart / sparkle bursts: {t, at: () => Vector3, n, spread, size, kind}
const BURSTS = [];
function burst(t, at, n = 6, spread = 0.45, size = 0.14, kind = 'heart', life = 1.6) { BURSTS.push({ t, at, n, spread, size, kind, life }); }

// stink lines (animated canvas sprites)
const STINK = [0, 1, 2].map((i) => {
  const tex = canvasTex(64, 256, () => { }, { nearest: true });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.visible = false; scene.add(s); return { s, tex, i };
});
function drawStink(st, t) {
  const c = st.tex.userData.canvas, g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  const ph = t * 5 + st.i * 2.1;
  for (let y = 250; y > 6; y -= 5) {
    const x = 32 + Math.sin(y * 0.045 + ph) * 13;
    const a = Math.min(1, (250 - y) / 40) * Math.min(1, y / 70);
    g.fillStyle = `rgba(40,110,25,${a})`; g.fillRect(Math.round(x / 4) * 4 - 7, y - 3, 14, 8);
    g.fillStyle = `rgba(150,230,80,${a})`; g.fillRect(Math.round(x / 4) * 4 - 4, y - 2, 8, 6);
  }
  st.tex.needsUpdate = true;
}

// smell puffs
const puffTex = canvasTex(128, 128, (g) => {
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const x = 34 + r() * 60, y = 34 + r() * 60, rad = 22 + r() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(168,214,96,0.55)'); gr.addColorStop(0.6, 'rgba(140,196,78,0.3)'); gr.addColorStop(1, 'rgba(120,180,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
}, { nearest: false });
const PUFFS = Array.from({ length: 90 }, (_, i) => {
  const r = rng(500 + i);
  const s = sprite(puffTex, { opacity: 0.3 });
  const ang = i < 8 ? (Math.PI * 0.5 + (r() - 0.5) * 1.0) : r() * Math.PI * 2; // first ones drift back to the crush
  return { s, born: i * 0.34, ang, R: i < 8 ? 2.2 + r() * 1.5 : 4 + r() * 8, rise: 0.5 + r() * 2.3, size: 1.0 + r() * 1.4, wob: r() * 10 };
});

// sweat drops on ME
const dropGeo = mergeGeometries([new THREE.SphereGeometry(0.032, 8, 6), new THREE.ConeGeometry(0.031, 0.06, 8).translate(0, 0.04, 0)]);
const dropM = new THREE.MeshLambertMaterial({ color: '#69c8ff', emissive: '#1e6fa8', emissiveIntensity: 0.6 });
const DROPS = [
  { at: V(0.17, 0.15, 0.285), t0: () => Ws('S1', 2) + 0.1, period: 1.7 },
  { at: V(-0.2, 0.12, 0.285), t0: () => S('S6'), period: 1.4 },
  { at: V(0.27, 0.05, 0.12), t0: () => S('S8'), period: 1.9 },
  { at: V(-0.05, 0.16, 0.285), t0: () => S('C1'), period: 1.1 },
  { at: V(-0.28, 0.08, 0.1), t0: () => S('C1') + 0.4, period: 1.3 },
  { at: V(0.08, 0.16, 0.285), t0: () => S('S17'), period: 1.0 },
].map(d => { const m = new THREE.Mesh(dropGeo, dropM); m.visible = false; ME.head.add(m); box(m, 0.012, 0.018, 0.01, M('#ffffff'), -0.01, 0.01, 0.03, false); return { ...d, m }; });

// folded note + open note
const noteFolded = new THREE.Group(); scene.add(noteFolded);
box(noteFolded, 0.22, 0.02, 0.15, M('#fffaf0'), 0, 0, 0);
box(noteFolded, 0.07, 0.024, 0.06, M('#ff5c9a'), 0.03, 0.001, 0.0, false);
const noteTex = canvasTex(600, 760, (g, w, h) => {
  g.fillStyle = '#fffdf5'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b9cdf0'; for (let y = 120; y < h; y += 62) g.fillRect(0, y, w, 3);
  g.fillStyle = '#f2a0a0'; g.fillRect(70, 0, 3, h);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, h / 2 - 2, w, 4);
  g.fillStyle = '#2b3c93'; g.font = '86px Hand'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText("It's okay,", 95, 230); g.fillText('it happened', 95, 354); g.fillText('to me too', 95, 478);
  g.font = '92px "Noto Color Emoji"'; g.fillText('\u{1F642}', 445, 485);
  const heart = (x, y, s) => { for (const [dx, dy, c] of [[1, 0, 1], [2, 0, 1], [5, 0, 1], [6, 0, 1], [0, 1, 1], [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 1], [6, 1, 1], [7, 1, 1], [0, 2, 1], [1, 2, 1], [2, 2, 1], [3, 2, 1], [4, 2, 1], [5, 2, 1], [6, 2, 1], [7, 2, 1], [1, 3, 1], [2, 3, 1], [3, 3, 1], [4, 3, 1], [5, 3, 1], [6, 3, 1], [2, 4, 1], [3, 4, 1], [4, 4, 1], [5, 4, 1], [3, 5, 1], [4, 5, 1]]) { g.fillStyle = '#ff5c9a'; g.fillRect(x + dx * s, y + dy * s, s, s); } g.fillStyle = '#ffd3e4'; g.fillRect(x + s, y + s, s, s); };
  heart(380, 560, 12); heart(480, 600, 9); heart(310, 640, 7); heart(470, 70, 8); heart(120, 600, 8);
  g.fillStyle = '#ff5c9a'; g.font = '56px Hand'; g.fillText('- M', 400, 700);
}, { nearest: false });
const noteOpen = new THREE.Group(); scene.add(noteOpen); noteOpen.visible = false;
const NOTE_W = 0.34, NOTE_H = 0.43;
const noteBot = new THREE.Mesh(new THREE.PlaneGeometry(NOTE_W, NOTE_H / 2), new THREE.MeshLambertMaterial({ map: noteTex }));
{ const uv = noteBot.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5); }
noteBot.rotation.x = -Math.PI / 2; noteBot.position.set(0, 0, NOTE_H / 4); noteOpen.add(noteBot);
const noteHinge = new THREE.Group(); noteOpen.add(noteHinge);
const noteTop = new THREE.Mesh(new THREE.PlaneGeometry(NOTE_W, NOTE_H / 2), new THREE.MeshLambertMaterial({ map: noteTex }));
{ const uv = noteTop.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5 + uv.getY(i) * 0.5); }
noteTop.rotation.x = -Math.PI / 2; noteTop.position.set(0, 0.001, -NOTE_H / 4); noteHinge.add(noteTop);
const noteTopBack = new THREE.Mesh(new THREE.PlaneGeometry(NOTE_W, NOTE_H / 2), M('#f3efe4'));
noteTopBack.rotation.x = Math.PI / 2; noteTopBack.position.set(0, 0.0, -NOTE_H / 4); noteHinge.add(noteTopBack);
const NOTE_POS = V(ME_SEAT.x - 0.02, 0.818, ME_SEAT.z - 0.66);
noteOpen.position.copy(NOTE_POS);

// glasses glint
const glintTex = pixelSpriteTex(['..W..', '..W..', 'WWWWW', '..W..', '..W..'], { W: '#ffffff' });
const glint = sprite(glintTex);

// ------------------------------------------------------------------ choreography
function faceME(t) {
  const st = { look: [0, -0.5], brow: 'neutral', mouth: 'flat', size: 1, pupil: 'normal', open: blink(t, 1) };
  const tp = Ws('S1', 2);
  if (t >= tp) Object.assign(st, { look: [0, 0], size: 1.3, pupil: 'small', brow: 'up', mouth: 'o', open: 1 });
  if (t >= S('S2')) Object.assign(st, { size: 1, pupil: 'normal', brow: 'neutral', mouth: 'smile', look: [0.6, 0.2], open: blink(t, 1) });
  if (t >= We('S2', 6) + 0.15) Object.assign(st, { mouth: 'flat', brow: 'worried', look: [0, 0], size: 1.05 });
  if (t >= S('S3')) Object.assign(st, { look: [0, 1], mouth: 'wobble', brow: 'worried', size: 1.1, pupil: 'small' });
  if (t >= S('S4')) Object.assign(st, { look: [0, 0.4], mouth: 'flat', brow: 'worried', size: 1.15 });
  if (t >= S('S5')) Object.assign(st, { look: [0, 0], size: 1.2, pupil: 'small', mouth: 'flat', brow: 'neutral', open: 1 });
  if (t >= S('S6')) Object.assign(st, { mouth: 'grimace', brow: 'worried', look: [Math.sin(t * 7) > 0 ? 1 : -1, 0] });
  if (t >= S('S7')) Object.assign(st, { mouth: 'wobble', brow: 'worried', size: 1.15, look: [0, 0] });
  if (t >= S('S8')) Object.assign(st, { look: [-1, 0], mouth: 'flat', size: 1.2 });
  if (t >= Ws('S13', 1)) Object.assign(st, { look: [1, 0], brow: 'worried', mouth: 'grimace' });
  if (t >= S('S14')) Object.assign(st, { look: [-0.4, 1], mouth: 'o', brow: 'up', size: 1.05, pupil: 'normal' });
  if (t >= S('S15')) Object.assign(st, { look: [0, 0], size: 1.25, pupil: 'small', mouth: 'flat', brow: 'worried' });
  if (t >= Ws('C1', 1)) Object.assign(st, { size: 1.35, pupil: 'tiny', mouth: 'wobble', brow: 'worried', look: [0, 0] });
  if (t >= S('S17')) Object.assign(st, { mouth: 'grimace' });
  if (t >= S('S19')) Object.assign(st, { lids: 0.45, size: 1.1, pupil: 'small', mouth: 'flat', brow: 'worried' });
  if (t >= E) Object.assign(st, { lids: 0, size: 1.05, pupil: 'normal', look: [-0.8, 0], mouth: 'o', brow: 'up', open: 1 });
  if (t >= E + 2.0) Object.assign(st, { look: [0, -1], mouth: 'flat', brow: 'up' });
  if (t >= E + 4.5) Object.assign(st, { look: [0.2, 0], mouth: 'shy', brow: 'neutral', size: 1, open: blink(t, 2), blush: smooth(E + 4.5, E + 5.6, t) });
  return st;
}
function updateME(t) {
  const c = ME; poseSeated(c);
  const tp = Ws('S1', 2);
  let write = t < tp ? 1 : 0;
  let pitch = 0.32;
  if (t >= tp) pitch = lerp(0.32, -0.04, smooth(tp, tp + 0.12, t));
  if (t >= S('S2')) { pitch = 0.0; c.head.rotation.z = 0.08 * smooth(S('S2'), S('S2') + 0.3, t); }
  if (t >= S('S3')) { pitch = -0.3; c.head.rotation.z = 0; }
  if (t >= S('S4')) pitch = -0.05;
  if (t >= S('S6')) { pitch = 0.18; write = 0.35; }
  if (t >= S('S7')) { pitch = 0.0; write = 0; c.spine.rotation.z = 0.012 * Math.sin(t * 45); }
  if (t >= S('S14')) { pitch = -0.55; c.head.rotation.y = -0.55; c.spine.rotation.y = -0.1; }
  if (t >= S('S15')) { pitch = 0; c.head.rotation.y = 0; c.spine.rotation.y = 0; }
  if (t >= Ws('C1', 1)) { c.pelvis.position.y = 0.48; c.spine.rotation.x = -0.1; c.spine.rotation.z = 0.015 * Math.sin(t * 50); }
  if (t >= E) { c.spine.rotation.z = 0; c.spine.rotation.x = 0; pitch = 0; c.head.rotation.y = 0.35 * smooth(E, E + 0.4, t); }
  if (t >= E + 1.7) { c.head.rotation.y = 0; pitch = 0.5; }
  if (t >= E + 4.5) { pitch = 0.08; c.head.rotation.z = -0.1; c.head.rotation.y = -0.12; }
  c.head.rotation.x = pitch;
  // arms
  if (t >= E && t < E + 1.75) {
    c.root.updateMatrixWorld(true);
    const k = smooth(E + 0.2, E + 0.9, t) * (1 - smooth(E + 1.35, E + 1.75, t));
    const handoff = HANDOFF();
    const rest = rootPt(c, -0.12, 0.86, 0.47);
    reach(c, 0, rest.lerp(handoff, k));
    reach(c, 1, rootPt(c, 0.22, 0.85, 0.42));
  } else if (t >= E + 1.75) {
    c.root.updateMatrixWorld(true);
    reach(c, 0, rootPt(c, -0.3, 0.86, 0.5)); reach(c, 1, rootPt(c, 0.3, 0.86, 0.5));
  } else writeArms(c, t, write, 0.5);
  c.face.set(faceME(t));
}
function updateBulge(t) {
  const tp = Ws('S1', 2);
  const k = easeOutBack(smooth(tp, tp + 0.45, t));
  BULGE.visible = t >= tp;
  const wob = 1 + 0.035 * Math.sin(t * 6.3);
  BULGE.scale.set((0.2 + 0.8 * k) * wob, (0.2 + 0.8 * k) / wob, 0.2 + 0.8 * k);
}
function HANDOFF() { return V(ME_SEAT.x + 0.42, 0.98, ME_SEAT.z + 0.62); }

const SNIFFS = () => [We('S10', 1) + 0.03, We('S11', 0) + 0.03, We('S12', 0) + 0.03];
function updateCrush(t) {
  const c = CR; poseSeated(c);
  c.root.position.set(CR_SEAT.x, 0, CR_SEAT.z);
  const t8 = atFrac('S8', 0.5);
  let write = t < S('S9') + 0.15 ? 1 : 0;
  let pitch = 0.3, st = { look: [0, -0.7], mouth: 'smile', blush: 0.3, open: blink(t, 3), eyes: 'normal', brow: 'neutral' };
  if (t >= t8) { pitch = 0.05; write = 0.3; Object.assign(st, { look: [0, 0], mouth: 'cat', blush: 1 }); }
  if (t >= S('S9')) { pitch = 0.05; Object.assign(st, { look: [0, 0], mouth: 'small', blush: 0.4 }); }
  const sniffs = SNIFFS();
  if (t >= S('S10')) Object.assign(st, { mouth: 'pout', eyes: 'normal', lids: 0.3 });
  for (const ts of sniffs) {
    const k = smooth(ts - 0.05, ts + 0.08, t) * (1 - smooth(ts + 0.35, ts + 0.5, t));
    if (k > 0.3) Object.assign(st, { eyes: 'squeeze', mouth: 'small' });
    pitch -= 0.14 * k;
  }
  if (t >= Ws('S13', 1)) { Object.assign(st, { eyes: 'normal', lids: 0.42, look: [0, -0.6], brow: 'suspicious', mouth: 'pout' }); pitch = 0.18; c.head.rotation.z = -0.1; }
  if (t >= S('S16')) { Object.assign(st, { lids: 0, look: [0, 0.6], brow: 'up', mouth: 'smile', blush: 0.6 }); pitch = -0.05; c.head.rotation.z = 0; }
  const tr = Ws('S16', 2);
  if (t >= S('C1')) {
    let talk = 0;
    for (const [a, b] of SEG.C1.visemes || []) if (t >= a && t < b) talk = 1;
    Object.assign(st, { talk, mouth: 'smile', look: [0, 0.4], blush: 0.8 });
  }
  if (t >= S('S17')) Object.assign(st, { talk: 0, mouth: 'cat', look: [0, -0.3], blush: 0.8 });
  if (t >= E) Object.assign(st, { look: [0, -0.5], mouth: 'cat', blush: 1, lids: 0, eyes: 'normal' });
  if (t >= E + 4.5) Object.assign(st, { eyes: 'happy', mouth: 'cat' });
  c.head.rotation.x = pitch;
  // arms
  if (t >= E && t < E + 2.0) {
    const k = smooth(E, E + 0.6, t) * (1 - smooth(E + 1.5, E + 2.0, t));
    c.root.position.z = CR_SEAT.z - 0.22 * k;
    c.spine.rotation.x = 0.42 * k;
    c.head.rotation.x = 0.25 * k;
    c.root.updateMatrixWorld(true);
    const rest = rootPt(c, -0.12, 0.86, 0.47);
    reach(c, 0, rest.lerp(HANDOFF().add(V(0, 0.02, 0.1)), k));
    reach(c, 1, rootPt(c, 0.22, 0.85, 0.42));
  } else if (t >= tr && t < S('S17') + 0.7) {
    const k = smooth(tr - 0.1, tr + 0.35, t) * (1 - smooth(S('S17'), S('S17') + 0.7, t));
    c.root.updateMatrixWorld(true);
    const rest = rootPt(c, -0.12, 0.86, 0.47);
    const up = spinePt(c, -0.42, 1.25, 0.08);
    reach(c, 0, rest.lerp(up, k));
    reach(c, 1, rootPt(c, 0.22, 0.85, 0.42));
    c.arms[0].hand.rotation.z = -0.3 * k;
  } else writeArms(c, t, write, 2.0);
  c.face.set(st);
}

const TE_BOARD = V(1.05, 0, -10.15), TE_DESK = V(-3.2, 0, -7.75);
function updateTeacher(t) {
  const c = TE;
  // path: board until S5, walk to desk during S5..S7
  const w0 = S('S5'), w1 = S('S7');
  const k = smooth(w0, w1, t);
  const pos = TE_BOARD.clone().lerp(TE_DESK, k);
  const walking = t > w0 && t < w1 ? 1 : 0;
  c.root.position.copy(pos);
  let yaw = 0;
  if (walking) { const d = TE_DESK.clone().sub(TE_BOARD); yaw = Math.atan2(d.x, d.z); }
  c.root.rotation.y = yaw;
  poseStanding(c, walking, t);
  let st = { look: [0, 0], brow: 'angry', mouth: 'flat', open: blink(t, 5) };
  let pitch = 0;
  c.root.updateMatrixWorld(true);
  // default: hands behind back
  reach(c, 0, spinePt(c, -0.12, 0.12, -0.32)); reach(c, 1, spinePt(c, 0.12, 0.12, -0.32));
  if (t < S('S5')) {
    // pointing at "NO TOILET BREAKS!" during S4, otherwise standing by the board
    const kp = smooth(S('S4') - 0.4, S('S4') - 0.05, t) * (1 - smooth(S('S5') - 0.1, S('S5') + 0.2, t));
    if (kp > 0) {
      const tap = 0.04 * Math.abs(Math.sin(t * 9)) * (t > S('S4') ? 1 : 0);
      const target = BOARD_TEXT.clone().add(V(-0.4, 0.1 + tap, 0.3));
      const rest = spinePt(c, 0.12, 0.12, -0.32);
      reach(c, 1, rest.lerp(target, kp));
      c.spine.rotation.y = 0.25 * kp; c.head.rotation.y = 0.15 * kp;
      if (c.pointer) c.pointer.rotation.set(-0.5 * kp - 0.0, 0.9 * kp, 0);
    }
  } else if (c.pointer) c.pointer.rotation.set(0, 0, 0);
  if (t >= w1) { // at desk: reading papers, then looks up at S15
    pitch = 0.35;
    if (t >= atFrac('S15', 0.5)) pitch = lerp(0.35, -0.02, smooth(atFrac('S15', 0.5), atFrac('S15', 0.5) + 0.9, t));
    if (t >= S('C1')) { c.head.rotation.y = 0.25; st.brow = 'raised'; st.look = [1, 0]; }
    if (t >= S('S17')) { c.head.rotation.y = 0.35; c.spine.rotation.y = 0.15; st = { look: [1, 0], brow: 'angry', mouth: 'o', open: 1 }; }
  }
  c.head.rotation.x = pitch;
  c.face.set(st);
}

function updateStudents(t) {
  const tq = S('S15'), tTurn = S('S17');
  const meHead = headPos(ME);
  for (const c of STUDENTS) {
    poseSeated(c);
    const ph = c.phase;
    let write = t < tq ? 1 : 0;
    let pitch = t < tq ? 0.3 + 0.05 * Math.sin(t * 0.7 + ph) : 0.12;
    let st = { look: [0, -0.6], mouth: 'flat', open: blink(t, ph), size: 1 };
    if (t >= tq) { st.look = [0, 0]; }
    const noseOn = c.nose && t >= S('S12') + c.noseDelay;
    if (noseOn) { st.mouth = 'disgust'; st.lids = 1; }
    // turning around
    const k = smooth(tTurn - 0.2 + c.turnDelay * 0.6, tTurn - 0.2 + c.turnDelay * 0.6 + 1.5, t);
    c.root.updateMatrixWorld(true);
    if (k > 0) {
      const local = c.root.worldToLocal(meHead.clone());
      let phi = Math.atan2(local.x, local.z);
      const sy = clamp(phi * 0.55, -1.5, 1.5), hy = clamp(phi - sy, -1.65, 1.65);
      c.spine.rotation.y = sy * k; c.head.rotation.y = hy * k;
      pitch = lerp(pitch, -0.05, k);
      write = 0;
      if (k > 0.5) Object.assign(st, { look: [0, 0], size: 1.2, mouth: noseOn ? 'disgust' : 'flat', lids: 0, open: 1 });
    }
    c.head.rotation.x = pitch;
    c.root.updateMatrixWorld(true);
    if (k > 0) {
      reach(c, 0, spinePt(c, -0.2, 0.05, 0.3)); reach(c, 1, spinePt(c, 0.2, 0.05, 0.3));
    } else writeArms(c, t * c.speed, write, ph);
    if (noseOn) {
      const kn = smooth(S('S12') + c.noseDelay, S('S12') + c.noseDelay + 0.4, t);
      c.root.updateMatrixWorld(true);
      const nose = c.head.localToWorld(V(0, -0.06, 0.36));
      const from = rootPt(c, 0.22, 0.85, 0.42);
      reach(c, 1, from.lerp(nose, kn));
    }
    c.face.set(st);
  }
}

// ------------------------------------------------------------------ shots
const SHOTS = [];
function addShots(id, list) {
  const [t0, t1] = beat(id);
  list.forEach((e, i) => {
    const a = t0 + (t1 - t0) * e[0];
    const b = i + 1 < list.length ? t0 + (t1 - t0) * list[i + 1][0] : t1;
    SHOTS.push({ t0: a, t1: b, name: e[1], fn: e[2], whoosh: !!(e[3] && e[3].whoosh) });
  });
}
function addAbs(t0, t1, name, fn, opt = {}) { SHOTS.push({ t0, t1, name, fn, whoosh: !!opt.whoosh }); }
const distFor = (w, fov) => (w * 16 / 9) / (2 * Math.tan(fov * DEG / 2));
// close-up on a character's face. yaw/pitch are relative to the direction the character faces.
function cu(c, { w = 1.0, fov = 36, yaw = 0, pitch = 0.04, push = 0.06, ty = null, tx = 0, shake = 0, roll = 0, fovEnd = null, wEnd = null } = {}) {
  return (u, t) => {
    const h = headPos(c);
    const f = fwdOf(c);
    const fv = fovEnd != null ? lerp(fov, fovEnd, u) : fov;
    const ww = wEnd != null ? lerp(w, wEnd, smooth(0, 1, u)) : w;
    const d = distFor(ww, fv) * (1 - push * u);
    const dir = f.clone().applyAxisAngle(V(0, 1, 0), yaw);
    dir.y = Math.tan(pitch); dir.normalize();
    const pos = h.clone().addScaledVector(dir, d);
    const tgt = h.clone().add(V(0, ty != null ? ty : -0.3 * ww, 0));
    const side = V(-dir.z, 0, dir.x).normalize();
    tgt.addScaledVector(side, tx);
    if (shake) { pos.x += noise1(t * 9, 1) * shake; pos.y += noise1(t * 9, 4) * shake; }
    return { pos, tgt, fov: fv, roll, subject: c };
  };
}
function fixed(p0, p1, t0, t1, fov = 50, opt = {}) {
  return (u, t) => ({ pos: p0.clone().lerp(p1, smooth(0, 1, u)), tgt: t0.clone().lerp(t1, smooth(0, 1, u)), fov: opt.fovEnd ? lerp(fov, opt.fovEnd, u) : fov, roll: opt.roll || 0, up: opt.up, subject: opt.subject });
}
const MEp = V(ME_SEAT.x, 0, ME_SEAT.z), CRp = V(CR_SEAT.x, 0, CR_SEAT.z);

addShots('S1', [
  [0, 'wide-establish', fixed(V(7.4, 3.6, -9.6), V(6.4, 3.2, -8.3), V(0.6, 0.2, 1.2), V(1.0, 0.4, 0.8), 62)],
  [0.45, 'me-cu-shock', cu(ME, { w: 1.23, wEnd: 0.94, fov: 38, push: 0.0, shake: 0.006 }), { whoosh: true }],
]);
addShots('S2', [
  [0, 'pants-bulge', fixed(MEp.clone().add(V(1.05, 0.62, 1.15)), MEp.clone().add(V(0.9, 0.6, 1.0)), MEp.clone().add(V(0, 0.5, 0.38)), MEp.clone().add(V(0, 0.5, 0.38)), 46), { whoosh: true }],
  [0.36, 'me-low-34', cu(ME, { w: 1.5, fov: 44, yaw: 0.7, pitch: -0.12, ty: -0.25, push: 0.06 })],
  [0.7, 'me-cu-smug', cu(ME, { w: 1.01, fov: 36, yaw: -0.3, push: 0.08 })],
]);
addShots('S3', [
  [0, 'clock-ecu', fixed(V(0.15, 3.95, -8.25), V(0.1, 4.0, -8.6), CLOCK.position.clone(), CLOCK.position.clone(), 40), { whoosh: true }],
  [0.55, 'me-eyes-up', cu(ME, { w: 0.81, fov: 34, pitch: -0.05, push: 0.05 })],
]);
addShots('S4', [
  [0, 'board-no-toilet', fixed(V(1.75, 1.9, -6.6), V(1.8, 1.95, -6.9), V(1.6, 2.0, -10.9), V(1.75, 2.0, -10.9), 44)],
  [0.55, 'teacher-cu', cu(TE, { w: 1.04, fov: 36, pitch: -0.1, push: 0.08, yaw: -0.25 })],
]);
addShots('S5', [
  [0, 'me-medium-still', cu(ME, { w: 1.35, fov: 40, ty: -0.25, push: 0.03 })],
  [0.55, 'me-high-34', cu(ME, { w: 1.3, fov: 40, yaw: 0.75, pitch: 0.3, ty: -0.35, push: 0.04 })],
]);
addShots('S6', [
  [0, 'me-ecu-grimace', cu(ME, { w: 0.78, fov: 34, push: 0.04 })],
  [0.58, 'me-topdown', fixed(MEp.clone().add(V(0.35, 3.0, -0.9)), MEp.clone().add(V(0.3, 2.8, -0.8)), MEp.clone().add(V(0, 0.8, -0.35)), MEp.clone().add(V(0, 0.8, -0.35)), 44)],
]);
addShots('S7', [
  [0, 'chair-lowangle', fixed(MEp.clone().add(V(1.25, 0.55, 1.2)), MEp.clone().add(V(1.15, 0.6, 1.1)), MEp.clone().add(V(0, 0.7, 0.35)), MEp.clone().add(V(0, 0.85, 0.35)), 50)],
  [0.5, 'wide-cloud', fixed(V(-5.5, 3.8, -8.4), V(-5.0, 3.6, -7.6), MEp.clone().add(V(0, 0.9, 0)), MEp.clone().add(V(0, 1.0, 0)), 56)],
]);
addShots('S8', [
  [0, 'ots-crush', (u, t) => { const ch = headPos(CR); return { pos: MEp.clone().add(V(-1.0 + 0.06 * u, 1.4, -1.35)), tgt: ch.clone().add(V(0.05, -0.18, 0)), fov: 42, subject: CR, keep: [ME] }; }],
  [0.5, 'crush-cu-smile', cu(CR, { w: 1.01, fov: 36, push: 0.07 })],
]);
addShots('S9', [
  [0, 'crush-hand-stop', (u, t) => { CR.root.updateMatrixWorld(true); const hp = CR.arms[0].hand.getWorldPosition(V()); return { pos: hp.clone().add(V(0.55, 0.6, -0.75)), tgt: hp.clone().add(V(0, -0.02, 0)), fov: 42, subject: CR }; }],
  [0.5, 'crush-cu', cu(CR, { w: 0.94, fov: 36, push: 0.05, yaw: 0.2 })],
]);
addShots('S10', [[0, 'crush-sniff', cu(CR, { w: 0.81, fov: 36, push: 0.03 })]]);
addShots('S11', [[0, 'crush-sniff-2', cu(CR, { w: 0.62, fov: 34, push: 0.03 }), { whoosh: true }]]);
addShots('S12', [[0, 'crush-sniff-3', cu(CR, { w: 0.47, fov: 32, push: 0.03, roll: 0.06 }), { whoosh: true }]]);
addShots('S13', [
  [0, 'crush-suspicious', cu(CR, { w: 0.86, fov: 36, push: 0.05, yaw: -0.15 })],
  [0.58, 'crush-pov', (u, t) => { const ch = headPos(CR); return { pos: ch.clone().add(V(0.5, 0.25, 0.8)), tgt: headPos(ME).add(V(0, -0.1, 0)), fov: 40, subject: ME, keep: [CR] }; }],
]);
addShots('S14', [
  [0, 'me-whistle', cu(ME, { w: 0.91, fov: 36, push: 0.05, yaw: -0.2 })],
  [0.45, 'fan-pov', (u, t) => { const hp = headPos(ME); return { pos: hp.clone().add(V(0.2, 0.1, -0.2)), tgt: FANS[3].position.clone().add(V(0, 0.0, 0)), fov: 42 - 6 * u, subject: null }; }],
]);
addShots('S15', [
  [0, 'wide-quiet', fixed(V(8.4, 4.6, 9.4), V(7.9, 4.4, 8.8), V(0.5, 0.8, -2.5), V(0.6, 0.9, -2.2), 60)],
  [0.5, 'teacher-looks-up', cu(TE, { w: 1.1, fov: 36, push: 0.05, pitch: 0.0 })],
]);
addShots('S16', [
  [0, 'crush-raise-medium', cu(CR, { w: 1.55, fov: 42, ty: 0.12, push: 0.04, yaw: 0.25 })],
  [0.5, 'crush-hand-lowangle', cu(CR, { w: 1.6, fov: 50, pitch: -0.42, ty: 0.35, yaw: -0.3, push: 0.05 })],
]);
addShots('C1', [
  [0, 'crush-speaks', cu(CR, { w: 1.04, fov: 36, push: 0.06 })],
  [0.68, 'me-horror', cu(ME, { w: 0.75, fov: 34, push: 0.0, shake: 0.008 }), { whoosh: true }],
]);
addShots('S17', [
  [0, 'pov-turn', (u, t) => ({ ...fixed(MEp.clone().add(V(0.05, 1.95, 0.45)), MEp.clone().add(V(0.05, 1.9, 0.25)), MEp.clone().add(V(0, 1.0, -5.5)), MEp.clone().add(V(0, 1.05, -5.5)), 74)(u, t), keep: [...STUDENTS, CR, TE] })],
  [0.5, 'stare-front', (u, t) => { const s = STUDENTS.filter(c => c.seat.ri === 3 && Math.abs(c.seat.x - ME_SEAT.x) < 2.6); const a = s.length ? headPos(s[0]) : V(); const b = s.length > 1 ? headPos(s[1]) : a; const mid = a.clone().lerp(b, 0.5); return { pos: headPos(ME).add(V(0, 0.05, -0.15 - 0.15 * u)), tgt: mid, fov: 46, subject: null, keep: s }; }],
]);
addShots('S18', [[0, 'me-dolly-zoom', cu(ME, { w: 1.1, fov: 62, fovEnd: 18, push: 0, shake: 0.002 })]]);
addShots('S19', [
  [0, 'wide-all-stare', fixed(V(-2.4, 2.4, -8.0), V(-2.6, 3.4, -9.4), MEp.clone().add(V(0, 1.0, 0)), MEp.clone().add(V(0, 0.9, 0)), 46)],
  [0.55, 'me-defeated', cu(ME, { w: 0.91, fov: 36, push: 0.05 })],
]);
// ending (no voice)
addAbs(E, E + 1.05, 'end-crush-lean', cu(CR, { w: 1.23, fov: 38, yaw: 0.55, push: 0.05 }));
addAbs(E + 1.05, E + 2.0, 'end-handoff', (u, t) => { const hp = HANDOFF(); return { pos: hp.clone().add(V(2.3 - 0.15 * u, 0.55, -0.25)), tgt: hp.clone().add(V(-0.2, 0.18, 0.0)), fov: 46, subject: null, keep: [ME, CR] }; });
addAbs(E + 2.0, E + 2.75, 'end-me-looks-down', cu(ME, { w: 1.25, fov: 40, pitch: 0.22, push: 0.05 }));
addAbs(E + 2.75, E + 4.5, 'end-note', fixed(NOTE_POS.clone().add(V(0, 1.0, 0.04)), NOTE_POS.clone().add(V(0, 0.86, 0.03)), NOTE_POS.clone(), NOTE_POS.clone(), 40, { up: V(0, 0, -1) }), { whoosh: true });
addAbs(E + 4.5, END + 0.01, 'end-me-blush', cu(ME, { w: 1.07, fov: 36, push: 0.1, yaw: -0.1 }));
SHOTS.sort((a, b) => a.t0 - b.t0);
const shotAt = (t) => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// bursts of hearts / sparkles
burst(atFrac('S8', 0.5) + 0.25, () => headPos(CR).add(V(0, 0.15, -0.2)), 6, 0.5, 0.13, 'heart');
burst(atFrac('S8', 0.5) + 0.15, () => headPos(CR).add(V(0, 0.1, -0.25)), 6, 0.55, 0.1, 'spark');
burst(S('C1') + 0.25, () => headPos(CR).add(V(0, 0.18, -0.2)), 7, 0.55, 0.13, 'heart');
burst(Ws('S16', 3), () => CR.arms[0].hand.getWorldPosition(V()).add(V(0, 0.1, -0.1)), 6, 0.35, 0.09, 'spark');
burst(E + 0.25, () => headPos(CR).add(V(0, 0.15, -0.25)), 6, 0.5, 0.12, 'heart');
burst(E + 3.0, () => NOTE_POS.clone().add(V(0, 0.08, -0.27)), 6, 0.2, 0.05, 'heart', 1.6);
burst(E + 3.3, () => NOTE_POS.clone().add(V(0, 0.08, 0.27)), 6, 0.2, 0.04, 'spark', 1.3);
burst(E + 4.8, () => headPos(ME).add(V(0, 0.2, -0.25)), 8, 0.6, 0.12, 'heart', 2.2);

// ------------------------------------------------------------------ effects update
const tSmell = () => S('S7');
function smellAmount(t) { return smooth(S('S7'), S('S15'), t) * 0.75 + smooth(S('S15'), E, t) * 0.25; }
function updateEffects(t, cam) {
  // clock (starts at 10:00:12, real time)
  const secs = 10 * 3600 + 12 + Math.floor(t);
  hSec.rotation.z = -(secs % 60) / 60 * Math.PI * 2;
  hMin.rotation.z = -((secs / 60) % 60) / 60 * Math.PI * 2;
  hHour.rotation.z = -((secs / 3600) % 12) / 12 * Math.PI * 2;
  FANS.forEach((f, i) => { f.rotation.y = t * 7.5 + i; });
  // fog
  const sm = smellAmount(t);
  scene.fog.color.copy(FOG_BASE).lerp(FOG_GREEN, clamp(sm * 1.2));
  scene.fog.density = 0.004 + sm * 0.055;
  // stink lines
  const showStink = (t >= S('S7') && t < E) || (t >= Ws('S2', 6) - 0.1 && t < Ws('S2', 6) + 0.9);
  STINK.forEach((st, i) => {
    st.s.visible = showStink;
    if (!showStink) return;
    drawStink(st, t);
    const rise = ((t * 0.35 + i * 0.33) % 1);
    st.s.position.copy(MEp).add(V((i - 1) * 0.28, 0.75 + rise * 0.5, 0.32 + (i % 2) * 0.08));
    st.s.scale.set(0.22, 0.85, 1);
    st.s.material.opacity = (t < S('S7') ? 0.6 : 1) * (1 - smooth(0.75, 1, rise)) * smooth(0, 0.15, rise) * smooth(1.3, 2.6, st.s.position.distanceTo(cam));
  });
  // puffs
  for (const p of PUFFS) {
    const age = t - tSmell() - p.born;
    if (age <= 0) { p.s.visible = false; continue; }
    p.s.visible = true;
    const d = p.R * (1 - Math.exp(-age / 9));
    const pos = MEp.clone().add(V(Math.cos(p.ang) * d, 0.6 + Math.min(p.rise, age * 0.16) + Math.sin(age + p.wob) * 0.08, Math.sin(p.ang) * d + 0.3));
    p.s.position.copy(pos);
    const sz = p.size * (0.5 + Math.min(2.0, age * 0.2));
    p.s.scale.set(sz, sz * 0.8, 1);
    const dc = pos.distanceTo(cam);
    p.s.material.opacity = 0.32 * smooth(0, 1.2, age) * smooth(1.6, 3.8, dc) * (t > E ? 0.35 : 1);
    p.s.material.rotation = p.wob + age * 0.1;
  }
  // sweat
  for (const d of DROPS) {
    const t0 = d.t0();
    if (t < t0 || t > E + 4.5) { d.m.visible = false; continue; }
    const ph = ((t - t0) % d.period) / d.period;
    d.m.visible = true;
    d.m.position.copy(d.at).add(V(0, -ph * 0.16, 0));
    const s = easeOutBack(Math.min(1, ph * 6)) * (1 - smooth(0.85, 1, ph));
    d.m.scale.setScalar(Math.max(0.001, s) * 1.15);
  }
  // hearts & sparkles
  let hi = 0, si = 0;
  for (const p of heartPool) p.visible = false;
  for (const p of sparkPool) p.visible = false;
  for (const b of BURSTS) {
    const age0 = t - b.t;
    if (age0 < 0 || age0 > b.life + 0.6) continue;
    const base = b.at();
    const r = rng(Math.floor(b.t * 1000));
    for (let k = 0; k < b.n; k++) {
      const delay = k * 0.07, age = age0 - delay;
      const ox = (r() - 0.5) * 2 * b.spread, oz = (r() - 0.5) * 0.3, vy = 0.25 + r() * 0.25, ph = r() * 6;
      if (age < 0 || age > b.life) continue;
      const pool = b.kind === 'heart' ? heartPool : sparkPool;
      const s = pool[b.kind === 'heart' ? hi++ : si++]; if (!s) continue;
      s.visible = true;
      s.position.copy(base).add(V(ox * (0.4 + age * 0.6) + Math.sin(age * 4 + ph) * 0.03, age * vy, oz));
      let sc = b.size * easeOutBack(Math.min(1, age / 0.25));
      if (b.kind === 'spark') sc *= 0.7 + 0.3 * Math.sin(age * 18 + ph);
      s.scale.set(sc, sc, 1);
      s.material.opacity = 1 - smooth(b.life - 0.4, b.life, age);
    }
  }
  // pencils away during the note exchange
  if (ME.pencil) ME.pencil.visible = t < E;
  if (CR.pencil) CR.pencil.visible = t < E || t > E + 2.2;
  // note
  noteFolded.visible = false; noteOpen.visible = false;
  if (t >= E && t < E + 1.5) {
    noteFolded.visible = t >= E + 0.15;
    CR.root.updateMatrixWorld(true);
    CR.arms[0].hand.getWorldPosition(noteFolded.position); noteFolded.position.y -= 0.1;
    noteFolded.rotation.set(0, 0.3, 0.2);
  } else if (t >= E + 1.5 && t < E + 2.05) {
    noteFolded.visible = true;
    ME.root.updateMatrixWorld(true);
    ME.arms[0].hand.getWorldPosition(noteFolded.position); noteFolded.position.y -= 0.1;
    noteFolded.rotation.set(0, -0.2, 0);
  } else if (t >= E + 2.05) {
    noteOpen.visible = true;
    const k = smooth(E + 2.25, E + 2.75, t);
    noteHinge.rotation.x = lerp(Math.PI * 0.98, 0, k);
    noteHinge.position.y = 0.002 + 0.002 * (1 - k);
  }
  // glint on teacher glasses
  const tg = atFrac('S4', 0.55) + 0.25;
  glint.visible = t > tg && t < tg + 0.35;
  if (glint.visible) {
    TE.root.updateMatrixWorld(true);
    glint.position.copy(TE.head.localToWorld(V(0.1, 0.03, 0.3)));
    const k = Math.sin((t - tg) / 0.35 * Math.PI);
    glint.scale.setScalar(0.12 * k); glint.material.rotation = (t - tg) * 3;
  }
}

// ------------------------------------------------------------------ camera + occluder hiding
const _seg = V();
function applyCamera(t) {
  const sh = shotAt(t);
  const u = clamp((t - sh.t0) / Math.max(0.001, sh.t1 - sh.t0));
  const r = sh.fn(u, t);
  camera.position.copy(r.pos);
  camera.up.copy(r.up || V(0, 1, 0));
  camera.fov = r.fov; camera.updateProjectionMatrix();
  camera.lookAt(r.tgt);
  if (r.roll) camera.rotateZ(r.roll);
  // hide characters between camera and target
  const keep = new Set([r.subject, ...(r.keep || [])]);
  const a = r.pos, b = r.tgt, ab = _seg.copy(b).sub(a); const L2 = ab.lengthSq();
  for (const c of ALL) {
    c.root.visible = true;
    if (keep.has(c)) continue;
    c.root.updateMatrixWorld(true);
    for (const p of [c.head.getWorldPosition(V()), c.spine.localToWorld(V(0, 0.3, 0))]) {
      const tt = clamp(p.clone().sub(a).dot(ab) / L2, 0, 1);
      if (tt > 0.94) continue;
      const q = a.clone().addScaledVector(ab, tt);
      if ((q.distanceTo(p) < 0.5 && p.distanceTo(a) < 2.4) || p.distanceTo(a) < 0.55) { c.root.visible = false; break; }
    }
  }
  return sh;
}

// ------------------------------------------------------------------ overlay (tint, captions, fade)
function captionAt(t) { for (const c of TL.captions) if (t >= c.s && t < c.e) return c; return null; }
const noLig = (s) => s.replace(/f(?=[filt])/g, 'f\u200C');
function drawCaption(g, cap, t) {
  cap = { ...cap, text: noLig(cap.text) };
  const age = t - cap.s;
  const pop = age < 0.1 ? lerp(1.22, 1.0, easeOutBack(age / 0.1)) : 1;
  let size = 92;
  g.font = `${size}px Pixelify`;
  let lines = [cap.text];
  if (g.measureText(cap.text).width > 900) {
    const w = cap.text.split(' ');
    let best = null, bw = 1e9;
    for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '); const m = Math.max(g.measureText(a).width, g.measureText(b).width); if (m < bw) { bw = m; best = [a, b]; } }
    lines = best;
    if (bw > 940) { size = Math.floor(size * 940 / bw); g.font = `${size}px Pixelify`; }
  }
  const cx = W / 2, cy = H * 0.56;
  g.save();
  g.translate(cx, cy); g.scale(pop, pop);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = size * 1.08;
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(ln, 0, y + 12);
    g.fillStyle = '#000';
    const R = 9;
    for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; g.fillText(ln, Math.round(Math.cos(an) * R), y + Math.round(Math.sin(an) * R)); }
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; g.fillText(ln, Math.round(Math.cos(an) * 5), y + Math.round(Math.sin(an) * 5)); }
    g.fillStyle = '#ffffff'; g.fillText(ln, 0, y);
  });
  g.restore();
}
function drawOverlay(t) {
  const g = octx;
  g.save(); g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const sm = smellAmount(t);
  if (sm > 0.001) { g.fillStyle = `rgba(118,178,58,${0.17 * sm})`; g.fillRect(0, 0, W, H); }
  const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const cap = captionAt(t);
  if (cap) drawCaption(g, cap, t);
  const fade = smooth(END - 1.0, END - 0.1, t);
  if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  g.restore();
}

// ------------------------------------------------------------------ frame
function update(t) {
  updateME(t); updateBulge(t); updateCrush(t); updateTeacher(t); updateStudents(t);
  for (const c of ALL) c.face.update();
  scene.updateMatrixWorld(true);
  const sh = applyCamera(t);
  updateEffects(t, camera.position);
  return sh;
}
window.renderFrame = (frame, fmt = 'jpeg') => {
  const t = frame / FPS;
  const sh = update(t);
  renderer.render(scene, camera);
  octx.drawImage(renderer.domElement, 0, 0, RW, RH);
  drawOverlay(t);
  window.__lastShot = sh.name;
  return fmt === 'png' ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.94);
};
window.getShots = () => SHOTS.map(s => ({ t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), name: s.name, whoosh: s.whoosh }));
window.getEvents = () => ({
  sniffs: SNIFFS(), poop: Ws('S1', 2), clockShots: SHOTS.filter(x => x.name.startsWith('clock')).map(x => [x.t0, x.t1]),
  hearts: BURSTS.filter(b => b.kind === 'heart').map(b => b.t),
  noteOpen: E + 2.25, raise: Ws('S16', 2),
  ending: E,
});
window.renderFrame(0);
window.READY = true;
