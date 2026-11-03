// Tank Office Reel -- deterministic Three.js scene. window.renderFrame(frame) renders one frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  V, clamp, lerp, smooth, easeOutBack, easeOut, rng, noise1, canvasTex, noiseTex, M, box, unitBox,
  pixelSpriteTex, sprite, makeChar, reach, rootPt, spinePt, headPt, headPos, resetPose, walkPose, seatPose, blink, mergeGeometries,
} from './lib.js';

const FPS = 30, W = 1080, H = 1920;
const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const TL = await (await fetch('./timeline.json', { cache: 'no-store' })).json();
const DUR = TL.duration;
const DEG = Math.PI / 180;

for (const f of [new FontFace('Pixelify', 'url(/node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2)'),
  new FontFace('Hand', 'url(/node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2)')]) { await f.load(); document.fonts.add(f); }

// ------------------------------------------------------------------ timeline helpers
const LINES = TL.lines;
const LN = {}; LINES.forEach((l, i) => { LN[l.id] = { ...l, i }; });
const S = (id) => LN[id].start;
const Se = (id) => LN[id].end;
const Wd = (id, k) => LN[id].words[Math.min(k, LN[id].words.length - 1)].s;
const We = (id, k) => LN[id].words[Math.min(k, LN[id].words.length - 1)].e;
function beat(id) { const l = LN[id]; return [l.i === 0 ? 0 : l.start, l.i < LINES.length - 1 ? LINES[l.i + 1].start : DUR]; }
const B0 = (id) => beat(id)[0], B1 = (id) => beat(id)[1];
const atF = (id, f) => { const [a, b] = beat(id); return a + (b - a) * f; };
const inBeats = (t, a, b) => t >= B0(a) && t < B1(b);
const FREEZE = () => [B0('L09'), B1('L09')];

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const out = document.getElementById('out'); out.width = RW; out.height = RH;
const octx = out.getContext('2d');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 220);
const hemi = new THREE.HemisphereLight('#fff6e6', '#6e6458', 1.3); scene.add(hemi);
const amb = new THREE.AmbientLight('#ffffff', 0.35); scene.add(amb);
const sun = new THREE.DirectionalLight('#fff0d6', 2.3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 0.5, far: 60 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SKY = new THREE.Color('#9fd3f5');

// ------------------------------------------------------------------ static geometry helpers
const bins = new Map();
function sgeo(geo, mat, x, y, z, ry = 0, cast = true) {
  geo.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1)));
  const k = mat.uuid + cast; if (!bins.has(k)) bins.set(k, { mat, cast, geos: [] }); bins.get(k).geos.push(geo);
}
const sbox = (w, h, d, mat, x, y, z, ry = 0, cast = true) => sgeo(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, cast);
function flushStatic() { for (const { mat, cast, geos } of bins.values()) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m); } bins.clear(); }
function plane(w, h, mat, x, y, z, rx = 0, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; scene.add(m); return m; }
const texMat = (tex, opts = {}) => new THREE.MeshLambertMaterial({ map: tex, ...opts });
function textTex(w, h, bg, fg, text, font, opts = {}) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + (opts.dy || 0)); if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); } }, { nearest: false });
}

// ================================================================== OFFICE (origin)
const officeFloor = noiseTex('#5f6f86', 0.09, 16, 2, [26, 22]);
plane(16, 14, texMat(officeFloor), 0, 0, 0.5, -Math.PI / 2);
const wallM = M('#ece8df'), trim = M('#9aa3ad');
sbox(16, 3.4, 0.2, wallM, 0, 1.7, -6.1, 0, false);           // back wall
sbox(16, 3.4, 0.2, wallM, 0, 1.7, 7.6, 0, false);            // front wall
sbox(0.2, 3.4, 13.7, wallM, 8.1, 1.7, 0.75, 0, false);       // right wall (door)
sbox(16.2, 0.2, 14, M('#f4f2ec'), 0, 3.5, 0.5, 0, false);    // ceiling
sbox(16, 0.12, 0.06, trim, 0, 0.06, -5.98, 0, false);
// glass wall on the left + city backdrop
const glassM = new THREE.MeshLambertMaterial({ color: '#bfe6f5', transparent: true, opacity: 0.28, depthWrite: false });
plane(13.6, 3.4, glassM, -8.0, 1.7, 0.75, 0, Math.PI / 2);
for (let z = -6; z <= 7.6; z += 2.27) sbox(0.12, 3.4, 0.12, M('#3d4650'), -8.0, 1.7, z, 0, false);
sbox(0.14, 0.12, 13.7, M('#3d4650'), -8.0, 0.06, 0.75, 0, false); sbox(0.14, 0.12, 13.7, M('#3d4650'), -8.0, 3.35, 0.75, 0, false);
const skyline = canvasTex(256, 96, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(1, '#dff3ff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
  const r = rng(5); let x = 0;
  while (x < 256) { const w = 14 + r() * 26, h = 30 + r() * 55; g.fillStyle = ['#7c8ea3', '#91a1b4', '#6f8197', '#a7b4c4'][Math.floor(r() * 4)]; g.fillRect(x, 96 - h, w, h);
    g.fillStyle = '#d8ecff'; for (let yy = 96 - h + 4; yy < 92; yy += 7) for (let xx = x + 3; xx < x + w - 3; xx += 6) if (r() < 0.7) g.fillRect(xx, yy, 3, 4); x += w + 2; }
});
plane(30, 11, new THREE.MeshBasicMaterial({ map: skyline }), -14, 4, 0.75, 0, Math.PI / 2);
// door on the right wall
sbox(0.12, 2.5, 1.5, M('#3d4650'), 8.0, 1.25, 4.0, 0, false);
plane(1.3, 2.3, new THREE.MeshLambertMaterial({ color: '#cdeefa', transparent: true, opacity: 0.6 }), 7.93, 1.2, 4.0, 0, -Math.PI / 2);
const exitTex = textTex(128, 48, '#1f9d4a', '#ffffff', 'EXIT', '34px Pixelify');
plane(0.7, 0.26, new THREE.MeshBasicMaterial({ map: exitTex }), 7.98, 2.8, 4.0, 0, -Math.PI / 2);
// logo on the front wall + back wall
const logoTex = textTex(512, 128, '#ece8df', '#2c5aa0', 'BIG CORP', '92px Pixelify');
plane(4, 1, texMat(logoTex), 0, 2.2, 7.49, 0, Math.PI);
plane(4, 1, texMat(logoTex), 2.5, 2.3, -5.99);
// ceiling lights
const lightM = new THREE.MeshBasicMaterial({ color: '#fffdf2' });
for (const x of [-4.5, 0, 4.5]) for (const z of [-3.5, 0.5, 4.5]) { const m = new THREE.Mesh(unitBox, lightM); m.scale.set(1.2, 0.04, 0.6); m.position.set(x, 3.38, z); scene.add(m); }
// desks + monitors + keyboards
const screenTex = canvasTex(64, 40, (g) => { g.fillStyle = '#1d2f5a'; g.fillRect(0, 0, 64, 40); const r = rng(8); for (let y = 4; y < 38; y += 4) { g.fillStyle = ['#7fd3ff', '#ffffff', '#9cf09c'][Math.floor(r() * 3)]; g.fillRect(4 + Math.floor(r() * 8), y, 10 + Math.floor(r() * 40), 2); } });
const kbTex = canvasTex(48, 16, (g) => { g.fillStyle = '#2b2e33'; g.fillRect(0, 0, 48, 16); g.fillStyle = '#4b5058'; for (let y = 1; y < 15; y += 3) for (let x = 1; x < 47; x += 3) g.fillRect(x, y, 2, 2); });
const DESKS = [];
for (const z of [-3.9, -1.2]) for (const x of [-5, -1, 3.2]) {
  DESKS.push({ x, z });
  sbox(1.6, 0.06, 0.8, M('#e9e9e4'), x, 0.76, z - 0.55);
  for (const dx of [-0.74, 0.74]) sbox(0.06, 0.74, 0.7, M('#8b9199'), x + dx, 0.37, z - 0.55);
  sbox(0.62, 0.42, 0.05, M('#222428'), x, 1.06, z - 0.82); sbox(0.06, 0.18, 0.06, M('#222428'), x, 0.85, z - 0.84);
  plane(0.56, 0.36, new THREE.MeshBasicMaterial({ map: screenTex }), x, 1.06, z - 0.79);
  plane(0.5, 0.16, texMat(kbTex), x, 0.795, z - 0.48, -Math.PI / 2);
  sbox(0.5, 0.08, 0.5, M('#2a2b30'), x, 0.47, z + 0.02); sbox(0.5, 0.5, 0.08, M('#2a2b30'), x, 0.78, z + 0.26); sbox(0.06, 0.44, 0.06, M('#5a5d63'), x, 0.22, z + 0.02);
}
// water cooler, printer table
sbox(0.5, 1.0, 0.5, M('#f2f2f0'), -7.2, 0.5, -5.2); const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), new THREE.MeshLambertMaterial({ color: '#7cc3ff', transparent: true, opacity: 0.75 })); jug.position.set(-7.2, 1.25, -5.2); scene.add(jug);
sbox(1.2, 0.7, 0.7, M('#c9ccd1'), 6.6, 0.35, -5.2);
flushStatic();

// printer (animated)
const PRINTER = new THREE.Group(); PRINTER.position.set(6.6, 0.7, -5.2); scene.add(PRINTER);
box(PRINTER, 0.9, 0.5, 0.6, M('#e3e4e6'), 0, 0.25, 0); box(PRINTER, 0.92, 0.08, 0.62, M('#5b6068'), 0, 0.52, 0);
box(PRINTER, 0.6, 0.03, 0.3, M('#ffffff'), 0, 0.57, -0.05);
const printLed = box(PRINTER, 0.06, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: '#20e020' }), 0.33, 0.4, 0.31, false);
const paperTex = canvasTex(32, 40, (g) => { g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, 32, 40); g.fillStyle = '#7c8aa6'; for (let y = 6; y < 38; y += 4) g.fillRect(4, y, 18 + (y % 3) * 3, 1); });
const paperM = new THREE.MeshLambertMaterial({ map: paperTex, side: THREE.DoubleSide });
const outPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), paperM); outPaper.position.set(0, 0.3, 0.32); PRINTER.add(outPaper);
const jamPapers = [0, 1, 2, 3].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), paperM); m.position.set(-0.15 + i * 0.1, 0.5, 0.3); m.visible = false; PRINTER.add(m); return m; });

// office plant (animated wilt)
const PLANT = new THREE.Group(); PLANT.position.set(-2.4, 0, 4.6); scene.add(PLANT);
const plantPivot = new THREE.Group(); PLANT.add(plantPivot); // tips over around the pot base
box(plantPivot, 0.5, 0.5, 0.5, M('#b8643a'), 0, 0.25, 0); box(plantPivot, 0.52, 0.06, 0.52, M('#8a4426'), 0, 0.5, 0);
const stem = box(plantPivot, 0.07, 0.7, 0.07, M('#3d7a2a'), 0, 0.85, 0);
const LEAVES = [];
for (let i = 0; i < 10; i++) {
  const piv = new THREE.Group(); piv.position.set(0, 0.72 + i * 0.065, 0); piv.rotation.y = i * 2.4; plantPivot.add(piv);
  const lf = box(piv, 0.46, 0.03, 0.26, M('#3aa845'), 0.24, 0, 0); LEAVES.push({ piv, lf, base: 0.3 + (i % 3) * 0.12 });
}
const leafGreen = M('#3aa845'), leafBrown = M('#8a6a2e');

// ================================================================== STREET (x = 80)
const OX = 80;
plane(140, 60, texMat(noiseTex('#3b3e44', 0.08, 16, 4, [70, 30])), OX, 0.0, 0.25, -Math.PI / 2);      // asphalt
const dashTex = canvasTex(32, 4, (g) => { g.fillStyle = '#f2d34a'; g.fillRect(0, 0, 18, 4); }, { repeat: [40, 1] });
plane(140, 0.18, new THREE.MeshLambertMaterial({ map: dashTex, transparent: true }), OX, 0.01, 0.25, -Math.PI / 2);
const walkTex = canvasTex(32, 32, (g) => { g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, 32, 32); const r = rng(3); for (let i = 0; i < 60; i++) { g.fillStyle = ['#a9a69e', '#c7c4bc'][i % 2]; g.fillRect(r() * 32, r() * 32, 2, 2); } g.fillStyle = '#97948c'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); }, { repeat: [70, 2] });
const walkM = texMat(walkTex);
const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(140, 0.14, 3.6), walkM); sidewalk.position.set(OX, 0.07, -6.3); sidewalk.receiveShadow = true; scene.add(sidewalk);
const sidewalk2 = new THREE.Mesh(new THREE.BoxGeometry(140, 0.14, 3.4), walkM); sidewalk2.position.set(OX, 0.07, 6.7); sidewalk2.receiveShadow = true; scene.add(sidewalk2);
// office building (explodes)
const BUILDING = new THREE.Group(); scene.add(BUILDING);
const winTex = canvasTex(32, 32, (g) => { g.fillStyle = '#cfc8bb'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#5f9fd0'; g.fillRect(5, 6, 22, 20); g.fillStyle = '#9fd0f2'; g.fillRect(6, 7, 8, 6); g.fillStyle = '#b8b1a4'; g.fillRect(0, 28, 32, 4); }, { repeat: [9, 6] });
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 10), [texMat(winTex), texMat(winTex), M('#b8b1a4'), M('#b8b1a4'), texMat(winTex), texMat(winTex)]);
  body.position.set(OX, 9.2, -13); body.castShadow = true; body.receiveShadow = true; BUILDING.add(body);
  box(BUILDING, 18, 3.2, 10, M('#d9d4ca'), OX, 1.6, -13);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.8), new THREE.MeshLambertMaterial({ color: '#8fc6e8' })); lobby.position.set(OX, 1.5, -7.99); BUILDING.add(lobby);
  for (let x = -7; x <= 7; x += 1.75) box(BUILDING, 0.12, 2.9, 0.12, M('#3d4650'), OX + x, 1.45, -7.95);
  box(BUILDING, 2.4, 2.6, 0.1, M('#2f3640'), OX, 1.3, -7.92);
  const doorG = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.4), new THREE.MeshLambertMaterial({ color: '#bfe6f5' })); doorG.position.set(OX, 1.25, -7.86); BUILDING.add(doorG);
  box(BUILDING, 0.05, 2.4, 0.05, M('#2f3640'), OX, 1.25, -7.84);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), texMat(textTex(512, 102, '#2c5aa0', '#ffffff', 'BIG CORP', '80px Pixelify'))); sign.position.set(OX, 3.7, -7.95); BUILDING.add(sign);
}
// neighbours + far side buildings
{
  const r = rng(77);
  const cols = ['#d98c5f', '#9bb7d4', '#e6d39a', '#b9a3d1', '#a7c99a', '#e3a5a5'];
  for (const x of [OX - 22, OX + 22, OX - 36, OX + 36]) { const h = 8 + r() * 10; sbox(12, h, 10, M(cols[Math.floor(r() * 6)]), x, h / 2, -13, 0, false); }
  for (let x = OX - 48; x <= OX + 48; x += 13) { const h = 7 + r() * 12; sbox(12, h, 8, M(cols[Math.floor(r() * 6)]), x, h / 2, 14, 0, false); }
  for (const x of [OX - 12, OX + 12, OX - 30, OX + 30]) { // streetlights
    sbox(0.15, 4.2, 0.15, M('#4a4f57'), x, 2.1, -4.9); sbox(0.9, 0.12, 0.25, M('#4a4f57'), x, 4.2, -4.6);
  }
  for (const x of [OX - 11, OX + 9, OX - 19, OX + 17]) { sbox(0.3, 1.2, 0.3, M('#6b4a2e'), x, 0.7, -4.9); sbox(1.4, 1.4, 1.4, M('#3f9a3c'), x, 2.0, -4.9); }
}
flushStatic();
// rubble (shown after the explosion)
const RUBBLE = new THREE.Group(); RUBBLE.visible = false; scene.add(RUBBLE);
{
  const r = rng(31);
  for (let i = 0; i < 60; i++) { const s = 0.5 + r() * 1.8; const m = box(RUBBLE, s, s * 0.6, s, M(['#b8b1a4', '#8f897e', '#cfc8bb', '#6e6a62'][i % 4]), OX + (r() - 0.5) * 17, s * 0.3 + r() * 1.2, -13 + (r() - 0.5) * 9); m.rotation.set(r(), r() * 3, r()); }
  box(RUBBLE, 4, 5, 1, M('#b8b1a4'), OX - 6, 2.5, -9); box(RUBBLE, 3, 3.5, 1, M('#b8b1a4'), OX + 6.5, 1.75, -10);
}
// cars
function makeCar(color) {
  const g = new THREE.Group();
  box(g, 2.2, 0.55, 1.05, M(color), 0, 0.5, 0); box(g, 1.2, 0.45, 0.95, M(color), -0.1, 0.98, 0);
  box(g, 1.15, 0.36, 0.97, M('#9fd6f0'), -0.1, 0.98, 0, false);
  for (const x of [-0.72, 0.72]) for (const z of [-0.52, 0.52]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10), M('#1e1e22')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.24, z); g.add(w); }
  scene.add(g); return g;
}
const CARS = [{ c: makeCar('#e04848'), x: 56, z: -1.8, dz: -2.0 }, { c: makeCar('#f2c23a'), x: 63, z: 1.6, dz: 2.4 }, { c: makeCar('#3f7fe0'), x: 69, z: -1.5, dz: -2.1 }];

// ================================================================== HOME (x = -80)
const HX = -80;
const woodTex = canvasTex(32, 32, (g) => { g.fillStyle = '#b5814f'; g.fillRect(0, 0, 32, 32); const r = rng(6); for (let y = 0; y < 32; y += 8) { g.fillStyle = '#9c6c3f'; g.fillRect(0, y, 32, 1); for (let i = 0; i < 12; i++) { g.fillStyle = ['#a8754a', '#c08c58'][i % 2]; g.fillRect(r() * 32, y + 1 + r() * 6, 3, 1); } } }, { repeat: [3, 3] });
plane(6.4, 6.4, texMat(woodTex), HX, 0.01, 0, -Math.PI / 2);
const homeWall = M('#a9c7e8');
sbox(6.4, 3, 0.15, homeWall, HX, 1.5, -3.2, 0, false); sbox(0.15, 3, 6.4, homeWall, HX - 3.2, 1.5, 0, 0, false); sbox(0.15, 3, 6.4, homeWall, HX + 3.2, 1.5, 0, 0, false); sbox(6.4, 3, 0.15, homeWall, HX, 1.5, 3.2, 0, false);
sbox(6.4, 0.1, 6.4, M('#f3efe6'), HX, 3.0, 0, 0, false);
// bed
sbox(1.6, 0.35, 2.4, M('#7a5233'), HX - 2.2, 0.2, -1.8); sbox(1.5, 0.2, 2.3, M('#ffffff'), HX - 2.2, 0.45, -1.8); sbox(1.5, 0.12, 1.6, M('#4b78c8'), HX - 2.2, 0.6, -1.4); sbox(1.0, 0.18, 0.45, M('#f4f1ea'), HX - 2.2, 0.62, -2.75);
// wardrobe, poster, door, lamp
sbox(1.4, 2.3, 0.6, M('#8a5d3b'), HX + 2.3, 1.15, -2.8); sbox(0.04, 2.1, 0.02, M('#5c3b22'), HX + 2.3, 1.15, -2.49);
sbox(0.1, 2.3, 1.1, M('#7a5233'), HX + 3.12, 1.15, 1.6);
const posterTex = canvasTex(64, 90, (g) => { g.fillStyle = '#1d2a44'; g.fillRect(0, 0, 64, 90); g.fillStyle = '#4caf50'; g.fillRect(10, 50, 44, 18); g.fillRect(24, 40, 18, 12); g.fillRect(40, 44, 22, 4); g.fillStyle = '#ffeb3b'; g.font = '13px Pixelify'; g.textAlign = 'center'; g.fillText('TANKS', 32, 22); });
plane(0.9, 1.3, texMat(posterTex), HX - 0.5, 1.8, -3.11);
// window (day or night handled by material colour)
const homeWinM = new THREE.MeshBasicMaterial({ color: '#bfe6ff' });
plane(1.3, 1.1, homeWinM, HX + 0.9, 1.8, -3.11); sbox(1.4, 0.08, 0.1, M('#f4f1ea'), HX + 0.9, 1.8, -3.08); sbox(0.08, 1.2, 0.1, M('#f4f1ea'), HX + 0.9, 1.8, -3.08);
// table for the biryani flashback
sbox(1.2, 0.06, 0.8, M('#9c6b3e'), HX + 0.6, 0.76, 0.6); for (const dx of [-0.52, 0.52]) for (const dz of [-0.32, 0.32]) sbox(0.06, 0.74, 0.06, M('#7a5233'), HX + 0.6 + dx, 0.37, 0.6 + dz);
sbox(0.5, 0.08, 0.5, M('#7a5233'), HX + 0.6, 0.47, 1.3); sbox(0.5, 0.5, 0.08, M('#7a5233'), HX + 0.6, 0.78, 1.56);
flushStatic();
const BIRYANI = new THREE.Group(); BIRYANI.position.set(HX + 0.6, 0.79, 0.45); scene.add(BIRYANI);
{
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.05, 12), M('#f4f4f0')); plate.position.y = 0.03; BIRYANI.add(plate);
  const riceM = new THREE.MeshLambertMaterial({ map: canvasTex(16, 16, (g) => { const r = rng(4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = ['#f6d36b', '#f2c14e', '#fff3c4', '#e8a33a', '#f6d36b'][Math.floor(r() * 5)]; g.fillRect(x, y, 1, 1); } }) });
  const tiers = [[0.66, 0.12], [0.52, 0.12], [0.38, 0.11], [0.24, 0.1]];
  let y = 0.06; for (const [w, h] of tiers) { box(BIRYANI, w, h, w, riceM, 0, y + h / 2, 0); y += h; }
  for (const [x, z, ry] of [[0.2, 0.15, 0.3], [-0.18, 0.1, 1.2], [0.05, -0.22, 2.2]]) { const d = box(BIRYANI, 0.18, 0.09, 0.09, M('#8a4b22'), x, 0.24, z); d.rotation.set(0, ry, 0.3); }
  box(BIRYANI, 0.07, 0.04, 0.07, M('#e53935'), -0.08, 0.5, 0.05); box(BIRYANI, 0.05, 0.04, 0.05, M('#3aa845'), 0.08, 0.5, -0.05);
}
// house exterior (x = -80, z = 40)
plane(40, 30, texMat(noiseTex('#6fb04f', 0.1, 16, 9, [20, 15])), HX, 0.0, 45, -Math.PI / 2);
plane(4, 12, texMat(noiseTex('#a9a59c', 0.06, 16, 2, [2, 6])), HX + 4, 0.01, 45, -Math.PI / 2);
sbox(7, 3.2, 5, M('#f1e3c4'), HX - 2, 1.6, 38);
{
  const roofGeo = new THREE.CylinderGeometry(0.01, 4.6, 2.2, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.scale(1.08, 1, 0.78);
  const roof = new THREE.Mesh(roofGeo, M('#b8473a')); roof.position.set(HX - 2, 4.3, 38); roof.castShadow = true; scene.add(roof);
}
sbox(1.0, 2.0, 0.1, M('#7a4a2a'), HX - 2, 1.0, 40.55); sbox(1.1, 0.9, 0.1, M('#9fd6f0'), HX - 4.2, 1.8, 40.55); sbox(1.1, 0.9, 0.1, M('#9fd6f0'), HX + 0.2, 1.8, 40.55);
for (const x of [HX - 8, HX + 9]) { sbox(0.3, 1.4, 0.3, M('#6b4a2e'), x, 0.7, 41); sbox(1.6, 1.6, 1.6, M('#3f9a3c'), x, 2.1, 41); }
flushStatic();

// ================================================================== TANK
const TANK = new THREE.Group(); scene.add(TANK);
const tankGreen = M('#56a83a'), tankDark = M('#3c7a28'), trackM = new THREE.MeshLambertMaterial({ map: canvasTex(16, 16, (g) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#4a4a50'; for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 2); }, { repeat: [1, 6] }) });
box(TANK, 2.5, 0.7, 4.2, tankGreen, 0, 0.95, 0); box(TANK, 2.2, 0.35, 3.2, tankDark, 0, 1.45, -0.2);
const TRACKS = [-1, 1].map(s => box(TANK, 0.62, 0.95, 4.7, trackM, s * 1.45, 0.48, 0));
const WHEELS = [];
for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), M('#6b6f74')); w.rotation.z = Math.PI / 2; w.position.set(s * 1.78, 0.42, -1.7 + i * 0.85); TANK.add(w); WHEELS.push(w); }
const TURRET = new THREE.Group(); TURRET.position.set(0, 1.62, -0.25); TANK.add(TURRET);
{ const t = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.8, 2.1, 1, 0.12), tankGreen); t.position.y = 0.4; t.castShadow = true; TURRET.add(t); }
const BARREL = new THREE.Group(); BARREL.position.set(0, 0.45, 1.0); TURRET.add(BARREL);
{ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.8, 10), tankDark); b.rotation.x = Math.PI / 2; b.position.z = 1.4; b.castShadow = true; BARREL.add(b); box(BARREL, 0.38, 0.38, 0.4, tankDark, 0, 0, 2.85); }
const HATCH = new THREE.Group(); HATCH.position.set(0.25, 0.82, -0.75); TURRET.add(HATCH);
{ const h = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12), tankDark); h.position.z = 0.42; HATCH.add(h); }
const starTex = pixelSpriteTex(['....W....', '...WWW...', 'WWWWWWWWW', '.WWWWWWW.', '..WWWWW..', '.WWW.WWW.', 'WW.....WW'], { W: '#ffffff' });
for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshLambertMaterial({ map: starTex, transparent: true })); st.position.set(s * 0.96, 0.42, 0); st.rotation.y = s * Math.PI / 2; TURRET.add(st); }
box(TANK, 0.25, 0.25, 0.4, M('#45484d'), -0.7, 1.35, -2.2); box(TANK, 0.25, 0.25, 0.4, M('#45484d'), 0.7, 1.35, -2.2);

// ================================================================== CHARACTERS
const youTie = (c) => {
  const sp = c.spine;
  box(sp, 0.1, 0.42, 0.02, M('#d32f2f'), 0, 0.36, 0.17, false); box(sp, 0.14, 0.08, 0.03, M('#b71c1c'), 0, 0.58, 0.17, false);
  box(sp, 0.15, 0.07, 0.05, M('#ffffff'), -0.09, 0.6, 0.16).rotation.z = -0.35; box(sp, 0.15, 0.07, 0.05, M('#ffffff'), 0.09, 0.6, 0.16).rotation.z = 0.35;
  const h = c.head, hm = M('#2a1c14');
  box(h, 0.56, 0.12, 0.56, hm, 0, 0.31, 0); box(h, 0.56, 0.3, 0.07, hm, 0, 0.12, -0.27);
  box(h, 0.05, 0.2, 0.46, hm, -0.28, 0.16, -0.04); box(h, 0.05, 0.2, 0.46, hm, 0.28, 0.16, -0.04);
  box(h, 0.36, 0.12, 0.09, hm, -0.09, 0.22, 0.26); const q = box(h, 0.3, 0.12, 0.3, hm, 0.05, 0.4, 0.12); q.rotation.set(0.3, 0.2, 0);
  const glasses = new THREE.Group(); h.add(glasses); glasses.visible = false; c.glasses = glasses;
  const gm = M('#0d0d10', { plain: true });
  box(glasses, 0.2, 0.11, 0.03, gm, -0.12, 0.02, 0.285, false); box(glasses, 0.2, 0.11, 0.03, gm, 0.12, 0.02, 0.285, false); box(glasses, 0.56, 0.03, 0.03, gm, 0, 0.065, 0.285, false);
  box(glasses, 0.05, 0.03, 0.03, new THREE.MeshBasicMaterial({ color: '#ffffff' }), -0.17, 0.05, 0.302, false);
};
const shinyShoes = new THREE.MeshPhongMaterial({ map: noiseTex('#141418', 0.12), shininess: 120, specular: '#ffffff' });
const YOU = makeChar(scene, { skin: '#c99266', shirt: '#fbfbf8', sleeve: '#fbfbf8', forearm: '#fbfbf8', pants: '#26304a', shoes: '#141418', shoeMat: shinyShoes, eyeW: 7, build: youTie, seed: 1 });
const NEW_PANTS = M('#c9b38a');
const BULGE = new THREE.Group(); BULGE.position.set(0, -0.08, -0.2); YOU.pelvis.add(BULGE);
{ const bm = new THREE.MeshLambertMaterial({ map: noiseTex('#26304a', 0.08), flatShading: true });
  for (const [x, y, z, r, sx] of [[0, 0, -0.08, 0.25, 1.25], [0.15, -0.09, -0.13, 0.17, 1], [-0.15, -0.07, -0.12, 0.18, 1], [0.02, -0.16, -0.2, 0.15, 1.2]]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bm); m.position.set(x, y, z); m.scale.set(sx, 1, 1); m.castShadow = true; BULGE.add(m); } }

const BOSS = makeChar(scene, { skin: '#e2a982', shirt: '#7d828a', sleeve: '#7d828a', forearm: '#7d828a', pants: '#6f747c', shoes: '#3a2a1e', wide: 1.25, scale: 1.12, thickBrows: true, browColor: '#4a3a2e', mouthY: 27, eyeY: 12, build: (c) => {
  const sp = c.spine;
  c.belly = box(sp, 0.74, 0.46, 0.3, M('#7d828a'), 0, 0.2, 0.2);
  box(sp, 0.16, 0.44, 0.02, M('#f5f5f0'), 0, 0.38, 0.215, false); box(sp, 0.07, 0.36, 0.025, M('#7a1f2b'), 0, 0.4, 0.225, false);
  const h = c.head, fm = M('#a39b90');
  c.fringe = [box(h, 0.06, 0.14, 0.26, fm, -0.285, -0.02, -0.13), box(h, 0.06, 0.14, 0.26, fm, 0.285, -0.02, -0.13), box(h, 0.56, 0.16, 0.07, fm, 0, -0.02, -0.275)];
  const spikes = new THREE.Group(); h.add(spikes); spikes.visible = false; c.spikes = spikes;
  for (let i = 0; i < 9; i++) { const sp2 = box(spikes, 0.07, 0.3, 0.07, M('#2b2622'), -0.24 + i * 0.06, 0.38, -0.1 + (i % 3) * 0.1); sp2.rotation.z = (i - 4) * 0.12; }
  c.mustache = new THREE.Group(); h.add(c.mustache); c.mustache.position.set(0, -0.125, 0.28);
  box(c.mustache, 0.36, 0.09, 0.07, M('#3d2c22'), 0, 0, 0); box(c.mustache, 0.1, 0.07, 0.06, M('#3d2c22'), -0.2, -0.04, 0); box(c.mustache, 0.1, 0.07, 0.06, M('#3d2c22'), 0.2, -0.04, 0);
  c.nose = box(h, 0.11, 0.11, 0.09, M('#e89a7a'), 0, -0.035, 0.29);
  // coffee mug in the right hand
  const mug = new THREE.Group(); mug.position.set(0, -0.12, 0.06); c.arms[0].hand.add(mug); c.mug = mug;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.18, 10), M('#f4f1ea')); cup.position.y = 0.04; mug.add(cup); c.cup = cup;
  c.coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 10), M('#5a3420', { plain: true })); c.coffee.position.y = 0.125; mug.add(c.coffee);
  box(mug, 0.03, 0.1, 0.07, M('#f4f1ea'), 0.1, 0.04, 0);
  const broken = new THREE.Group(); broken.visible = false; mug.add(broken); c.broken = broken;
  const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.07, 10, 1, true, 0, Math.PI * 1.3), new THREE.MeshLambertMaterial({ color: '#f4f1ea', side: THREE.DoubleSide })); bc.position.y = -0.01; broken.add(bc);
  for (let i = 0; i < 3; i++) { const sh = box(broken, 0.04, 0.06, 0.01, M('#f4f1ea'), Math.cos(i * 1.4) * 0.085, 0.045, Math.sin(i * 1.4) * 0.085); sh.rotation.y = -i * 1.4; }
} });

const WORKERS = [];
{
  const r = rng(42);
  const shirts = ['#cfe3f5', '#f1e4c8', '#e7c9d9', '#d5e8cf', '#ffffff', '#c9d3f0'];
  const skins = ['#8d5a3b', '#c99266', '#efc6a4', '#a86f4c', '#d9a77f', '#6b4228'];
  DESKS.forEach((d, i) => {
    const girl = i % 2 === 1;
    const hc = ['#15100d', '#3b2618', '#7a4a22', '#1d1714'][i % 4];
    const c = makeChar(scene, { skin: skins[i], shirt: shirts[i], pants: ['#2b2f3a', '#3a3f4a', '#26304a'][i % 3], shoes: '#1d1d1f', seed: 10 + i, build: (c) => {
      const h = c.head, m = M(hc);
      box(h, 0.56, 0.12, 0.56, m, 0, 0.31, 0); box(h, 0.56, girl ? 0.6 : 0.3, 0.07, m, 0, girl ? -0.02 : 0.12, -0.27);
      box(h, 0.05, girl ? 0.48 : 0.2, 0.46, m, -0.28, girl ? 0.04 : 0.16, -0.04); box(h, 0.05, girl ? 0.48 : 0.2, 0.46, m, 0.28, girl ? 0.04 : 0.16, -0.04);
      box(h, 0.56, 0.08, 0.08, m, 0, 0.23, 0.26);
      if (girl && i === 1) { box(h, 0.2, 0.2, 0.2, m, 0, 0.36, -0.22); }
      if (!girl) box(c.spine, 0.08, 0.36, 0.02, M(['#2c5aa0', '#2e7d32', '#6a1b9a'][i % 3]), 0, 0.38, 0.17, false);
    } });
    c.desk = d; c.phase = r() * 10; c.freezeAt = 0; c.runOff = V(0.8 + i * 1.15 + r() * 0.4, 0, 6.0 + (i % 3) * 0.55); c.runDelay = r() * 0.8;
    WORKERS.push(c);
  });
}
const GUARDS = [-1, 1].map((s, i) => makeChar(scene, { skin: ['#8d5a3b', '#d9a77f'][i], shirt: '#1e2026', sleeve: '#1e2026', forearm: '#1e2026', pants: '#18191d', shoes: '#0d0d0f', seed: 30 + i, scale: 1.08, build: (c) => {
  const h = c.head; box(h, 0.58, 0.14, 0.58, M('#14151a'), 0, 0.31, 0); box(h, 0.58, 0.04, 0.25, M('#14151a'), 0, 0.25, 0.36); box(h, 0.1, 0.1, 0.02, M('#f2c23a'), 0, 0.32, 0.295, false);
  box(c.spine, 0.12, 0.1, 0.02, M('#f2c23a'), 0.15, 0.48, 0.17, false); box(c.spine, 0.6, 0.06, 0.34, M('#3a3a3a'), 0, 0.02, 0);
} }));
const ALL = [YOU, BOSS, ...WORKERS, ...GUARDS];

// ================================================================== icons & effects
const sparkTex = pixelSpriteTex(['...Y...', '...W...', '..WWW..', 'YWWWWWY', '..WWW..', '...W...', '...Y...'], { W: '#ffffff', Y: '#fff2a8' });
const chilliTex = pixelSpriteTex(['......GG', '.....GG.', '....RRR.', '...RRHR.', '..RRRR..', '.RRRR...', 'RRR.....', 'RR......'], { G: '#3aa845', R: '#e53935', H: '#ff8a80' });
const softTex = (col) => canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, { nearest: false });
const puffTex = canvasTex(128, 128, (g) => { const r = rng(9); for (let i = 0; i < 9; i++) { const x = 34 + r() * 60, y = 34 + r() * 60, rad = 22 + r() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }, { nearest: false });
const SPARKS = Array.from({ length: 40 }, () => sprite(scene, sparkTex));
const CHILLIS = Array.from({ length: 14 }, () => sprite(scene, chilliTex));
const STEAM = Array.from({ length: 10 }, () => sprite(scene, softTex('rgba(255,255,255,0.7)')));
const SMOKE = Array.from({ length: 70 }, () => sprite(scene, puffTex, { color: '#9a958e' }));
const STINK = [0, 1, 2, 3].map((i) => { const tex = canvasTex(64, 256, () => { }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); s.visible = false; scene.add(s); return { s, tex, i }; });
function drawStink(st, t) {
  const g = st.tex.userData.canvas.getContext('2d'); g.clearRect(0, 0, 64, 256);
  const ph = t * 5 + st.i * 2.1;
  for (let y = 250; y > 6; y -= 5) {
    const x = 32 + Math.sin(y * 0.045 + ph) * 13, a = Math.min(1, (250 - y) / 40) * Math.min(1, y / 70);
    g.fillStyle = `rgba(40,110,25,${a})`; g.fillRect(Math.round(x / 4) * 4 - 6, y - 3, 12, 7);
    g.fillStyle = `rgba(150,230,80,${a})`; g.fillRect(Math.round(x / 4) * 4 - 3, y - 2, 6, 5);
  }
  st.tex.needsUpdate = true;
}
const dropGeo = mergeGeometries([new THREE.SphereGeometry(0.035, 8, 6), new THREE.ConeGeometry(0.034, 0.065, 8).translate(0, 0.045, 0)]);
const dropM = new THREE.MeshLambertMaterial({ color: '#5cc2ff', emissive: '#1e6fa8', emissiveIntensity: 0.6 });
function addDrops(c, list) { return list.map(([x, y, z]) => { const m = new THREE.Mesh(dropGeo, dropM); m.visible = false; c.head.add(m); return { m, at: V(x, y, z) }; }); }
const YOU_DROPS = addDrops(YOU, [[0.18, 0.15, 0.29], [-0.2, 0.12, 0.29], [0.28, 0.05, 0.1], [-0.28, 0.08, 0.05]]);
const BOSS_DROPS = addDrops(BOSS, [[0.2, 0.18, 0.29], [-0.22, 0.14, 0.29]]);
// box of things
const BOXG = new THREE.Group(); scene.add(BOXG);
box(BOXG, 0.5, 0.3, 0.36, M('#c49a62'), 0, 0, 0); box(BOXG, 0.08, 0.22, 0.08, M('#3aa845'), 0.12, 0.2, 0); box(BOXG, 0.1, 0.12, 0.1, M('#f4f1ea'), -0.1, 0.18, 0.05); box(BOXG, 0.16, 0.2, 0.03, M('#d9c38f'), -0.02, 0.22, -0.1);
// phone
const PHONE = new THREE.Group(); scene.add(PHONE);
box(PHONE, 0.11, 0.2, 0.02, M('#1b1b1f', { plain: true }), 0, 0, 0, false);
const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.17), new THREE.MeshBasicMaterial({ map: canvasTex(60, 108, (g) => {
  g.fillStyle = '#10264a'; g.fillRect(0, 0, 60, 108); g.fillStyle = '#ffffff'; g.font = '11px Pixelify'; g.textAlign = 'center'; g.fillText('Calling...', 30, 20);
  g.font = '18px Pixelify'; g.fillText('BRO', 30, 46); g.fillStyle = '#ffcc80'; g.fillRect(20, 54, 20, 20); g.fillStyle = '#5d4037'; g.fillRect(24, 60, 4, 4); g.fillRect(32, 60, 4, 4);
  g.fillStyle = '#e53935'; g.fillRect(22, 84, 16, 14); g.fillStyle = '#fff'; g.fillRect(25, 90, 10, 3);
}) }));
phoneScreen.position.z = 0.011; PHONE.add(phoneScreen);
// explosion parts
const FIRE = Array.from({ length: 24 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: i < 3 ? '#fffbe0' : ['#fff27a', '#ffd23a', '#ff9a1f', '#ff6a1f', '#ffe14a', '#ffb52e'][i % 6], transparent: true, fog: false })); m.visible = false; scene.add(m); return m; });
const RING = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true })); RING.rotation.x = Math.PI / 2; RING.visible = false; scene.add(RING);
const confColors = ['#ff4d6d', '#ffd23f', '#3bceac', '#4d96ff', '#b46cff', '#ff8c42', '#ffffff'];
const BITS = Array.from({ length: 170 }, (_, i) => {
  const isPaper = i < 60;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(isPaper ? 0.42 : 0.14, isPaper ? 0.55 : 0.09), isPaper ? paperM : new THREE.MeshBasicMaterial({ color: confColors[i % 7], side: THREE.DoubleSide }));
  m.visible = false; scene.add(m); const r = rng(900 + i);
  return { m, paper: isPaper, v: V((r() - 0.5) * 30, 6 + r() * 9, 14 + r() * 18), spin: V(r() * 7, r() * 7, r() * 7), delay: r() * 0.25, fall: 1.1 + r() * 0.9 };
});
const CHUNKS = Array.from({ length: 24 }, (_, i) => { const r = rng(300 + i); const s = 0.6 + r() * 1.2; const m = new THREE.Mesh(unitBox, M(['#cfc8bb', '#5f9fd0', '#b8b1a4'][i % 3])); m.scale.set(s, s * 0.7, s); m.visible = false; scene.add(m); return { m, v: V((r() - 0.5) * 26, 10 + r() * 14, (r() - 0.2) * 14), spin: V(r() * 6, r() * 6, r() * 6) }; });
const SHELL = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), M('#3c3c40')); SHELL.rotation.x = Math.PI / 2; SHELL.visible = false; scene.add(SHELL);
const FLASH = sprite(scene, softTex('rgba(255,250,200,1)'));

// ================================================================== CHOREOGRAPHY
const tFreeze = (t) => { const [a, b] = FREEZE(); return t >= a && t < b ? a : t; };
const DOOR_IN = V(7.4, 0, 4.0), HUG_YOU = V(-0.62, 0, 3.2), HUG_BOSS = V(0.66, 0, 3.2);
const STREET_DOOR = V(OX, 0, -7.4);
const TANK_STOP = V(OX - 4.6, 0, 0.6);
const HOUSE_TANK = V(HX + 4, 0, 44);
const tFire = () => Wd('L25', 0) - 0.12;
const tBoom = () => Wd('L25', 0) + 0.12;
let stage = 'office';

function place(c, p, ry) { c.root.position.copy(p); c.root.rotation.set(0, ry, 0); c.root.visible = true; }
function hideAllChars() { for (const c of ALL) c.root.visible = false; }

function updateCharacters(t) {
  const ta = tFreeze(t);
  hideAllChars();
  for (const c of ALL) { resetPose(c); c.face.set({ open: blink(ta, c.o.seed || 1), t: ta }); }
  YOU.glasses.visible = false;
  { const tp = Wd('L08', 1); const k = easeOutBack(smooth(tp, tp + 0.5, ta)); const on = t >= tp && t < Wd('L17', 3); BULGE.visible = on; const wob = 1 + 0.035 * Math.sin(t * 6.3); BULGE.scale.set((0.2 + 0.8 * k) * wob, (0.2 + 0.8 * k) / wob, 0.2 + 0.8 * k); }
  YOU.pantsMeshes.forEach(m => { m.material = M('#26304a'); });
  BOSS.nose.scale.set(0.11, 0.11, 0.09); BOSS.nose.position.set(0, -0.035, 0.29); BOSS.mustache.position.set(0, -0.125, 0.28);
  BOSS.mug.visible = true; BOSS.broken.visible = false; BOSS.cup.visible = true; BOSS.coffee.visible = true; BOSS.spikes.visible = false; BOSS.fringe.forEach(f => f.visible = true);
  BOX_HELD = false; PHONE.visible = false; BOXG.visible = false;
  const happy = { eyes: 'normal', size: 1.15, glint: 1, brow: 'up', mouth: 'grin', open: blink(ta, 1) };

  // ---------- L01-L02: walking to the building (street)
  if (t < B0('L03')) {
    stage = 'street';
    const kw = smooth(0, B0('L02'), t);                       // walks during L01, then poses proudly
    const p = V(lerp(OX - 9, OX - 2.4, kw), 0, -6.0);
    place(YOU, p, Math.PI / 2 + 0.25);
    walkPose(YOU, ta * 7.5, 1 - smooth(B0('L02') - 0.35, B0('L02'), t)); YOU.spine.rotation.x = -0.08; YOU.head.rotation.x = -0.12;
    if (t >= B0('L02')) { reach(YOU, 0, spinePt(YOU, -0.36, 0.08, 0.05)); reach(YOU, 1, spinePt(YOU, 0.36, 0.08, 0.05)); YOU.legs[0].hip.rotation.z = 0.08; YOU.legs[1].hip.rotation.z = -0.08; }
    YOU.face.set({ ...happy, mouth: t > Wd('L02', 4) ? 'grin' : 'smile' });
    return;
  }
  // ---------- L03: biryani flashback (home, night)
  if (t < B0('L04')) {
    stage = 'flashback';
    place(YOU, V(HX + 0.6, 0, 1.25), Math.PI); seatPose(YOU);
    const k = (ta * 3.2) % 1; // spoon cycle
    const plate = V(HX + 0.6, 1.0, 0.45), mouth = headPt(YOU, 0, -0.12, 0.35);
    reach(YOU, 0, plate.clone().lerp(mouth, k < 0.5 ? smooth(0, 0.5, k) : 1 - smooth(0.5, 1, k)));
    reach(YOU, 1, rootPt(YOU, 0.3, 0.86, 0.5));
    YOU.head.rotation.x = 0.15;
    YOU.face.set({ eyes: Math.floor(ta * 2) % 2 ? 'squint' : 'normal', size: 1.1, mouth: 'chew', red: smooth(B0('L03'), B0('L03') + 1.5, t) * 0.7, tears: 0.6, brow: 'worried', t: ta });
    return;
  }
  // ---------- L04-L14: office
  if (t < B0('L15')) {
    stage = 'office';
    // workers at desks
    WORKERS.forEach((c, i) => {
      place(c, V(c.desk.x, 0, c.desk.z), Math.PI); seatPose(c);
      const freezeT = S('L11') + 0.25 + i * 0.28;
      const typing = ta < freezeT ? 1 : 0;
      const ph = c.phase, tt = Math.min(ta, freezeT);
      reach(c, 0, rootPt(c, -0.14 + 0.03 * Math.sin(tt * 16 + ph) * typing, 0.84 + 0.02 * Math.abs(Math.sin(tt * 21 + ph)) * typing, 0.45));
      reach(c, 1, rootPt(c, 0.14 + 0.03 * Math.sin(tt * 14 + ph + 1) * typing, 0.84 + 0.02 * Math.abs(Math.sin(tt * 19 + ph)) * typing, 0.45));
      c.head.rotation.x = typing ? 0.12 : -0.05;
      if (!typing) { c.head.rotation.y = -0.25 * Math.sign(c.desk.x + 0.5); c.face.set({ size: 1.2, pupil: 2, brow: 'up', mouth: t > S('L13') ? 'wobble' : 'o', open: 1 }); }
      if (t > S('L14')) c.face.set({ eyes: 'pop', mouth: 'o', open: 1 });
    });
    // boss walks in slow-motion (L04), then hug spot
    const w0 = B0('L04'), w1 = B0('L05');
    if (t < w1) {
      const k = smooth(w0, w1 - 0.1, t);
      const p = DOOR_IN.clone().lerp(HUG_BOSS, k);
      place(BOSS, p, -Math.PI / 2 - 0.25 * (1 - k));
      walkPose(BOSS, ta * 3.2, 1 - smooth(w1 - 0.4, w1 - 0.1, t));
      BOSS.face.set({ mouth: 'smile', eyes: 'normal', open: blink(ta, 2) });
    } else place(BOSS, HUG_BOSS, -Math.PI / 2);
    place(YOU, HUG_YOU, Math.PI / 2);
    YOU.face.set({ ...happy, look: [0, 0] });
    reach(BOSS, 0, spinePt(BOSS, -0.28, 0.25, 0.3)); // mug held at chest
    BOSS.head.rotation.x = 0;
    // L05 welcome: arms open wide
    if (t >= B0('L05') && t < B0('L06')) {
      const k = easeOutBack(smooth(B0('L05'), B0('L05') + 0.4, t));
      reach(BOSS, 0, spinePt(BOSS, lerp(-0.28, -0.9, k), lerp(0.25, 0.75, k), lerp(0.3, 0.15, k)));
      reach(BOSS, 1, spinePt(BOSS, lerp(0.3, 0.9, k), lerp(0.1, 0.75, k), 0.15));
      BOSS.face.set({ eyes: 'happy', mouth: 'yell', brow: 'up' }); BOSS.head.rotation.x = -0.1;
      YOU.face.set({ ...happy });
    }
    // L06-L08 hug (squeeze)
    const hugOn = t >= B0('L06') && t < B0('L10');
    if (hugOn) {
      const kIn = smooth(B0('L06'), B0('L06') + 0.35, ta);
      const tight = smooth(Wd('L06', 3) - 0.1, Wd('L06', 3) + 0.15, ta) + smooth(S('L07') - 0.1, S('L07') + 0.15, ta);
      place(BOSS, HUG_BOSS.clone().lerp(V(0.3, 0, 3.2), kIn), -Math.PI / 2);
      YOU.root.position.y = 0.12 * kIn + 0.06 * tight + (tight > 0.5 ? Math.abs(Math.sin(ta * 30)) * 0.02 : 0);
      reach(BOSS, 0, spinePt(YOU, lerp(-0.9, -0.2, kIn), 0.35, -0.12));
      reach(BOSS, 1, spinePt(YOU, lerp(0.9, 0.2, kIn), 0.35, -0.12));
      BOSS.face.set({ eyes: 'happy', mouth: 'grin', brow: 'up' }); BOSS.spine.rotation.x = 0.08;
      YOU.arms.forEach(a => { a.sh.rotation.z = a.side * 0.35; }); YOU.legs[0].hip.rotation.x = 0.15 * Math.sin(ta * 9) * tight; YOU.legs[1].hip.rotation.x = -0.15 * Math.sin(ta * 9) * tight;
      YOU.head.rotation.y = -1.25 * kIn; YOU.head.rotation.z = 0.15 * kIn;
      const sq = 0.12 * tight;
      YOU.head.scale.set(1 - sq, 1 + sq * 0.8, 1);
      YOU.face.set(tight > 0.6 ? { eyes: 'pop', mouth: 'wobble', red: 0.4 * (tight - 0.6) } : { eyes: 'squint', mouth: 'grin' });
      if (t >= S('L08')) { // released, frozen in shock
        const kOut = smooth(S('L08'), S('L08') + 0.3, ta);
        place(BOSS, V(0.3, 0, 3.2).lerp(HUG_BOSS, kOut), -Math.PI / 2);
        YOU.root.position.y = 0; YOU.head.scale.set(1, 1, 1);
        reach(BOSS, 0, spinePt(BOSS, -0.28, 0.25, 0.3)); reach(BOSS, 1, spinePt(BOSS, 0.3, 0.0, 0.1));
        YOU.face.set({ eyes: 'pop', mouth: 'o', open: 1 }); BOSS.face.set({ eyes: 'happy', mouth: 'smile' });
      }
    }
    if (t >= B0('L09')) { YOU.face.set({ eyes: 'pop', mouth: 'flat', open: 1 }); BOSS.face.set({ eyes: 'normal', mouth: 'flat', open: 1 }); }
    // L10 sniffing
    if (t >= B0('L10')) {
      reach(BOSS, 1, spinePt(BOSS, 0.3, 0.0, 0.1));
      const sn = [Wd('L10', 3), Wd('L10', 4), Wd('L10', 5)];
      let k = 0; for (const s of sn) k = Math.max(k, smooth(s - 0.05, s + 0.05, ta) * (1 - smooth(s + 0.3, s + 0.45, ta)));
      BOSS.nose.position.set(0.012 * Math.sin(ta * 60) * k, -0.035 + 0.03 * k, 0.29 + 0.02 * k);
      BOSS.nose.scale.set(0.11 * (1 + 0.35 * k), 0.11 * (1 + 0.25 * k), 0.09);
      BOSS.head.rotation.x = -0.15 * k;
      BOSS.face.set({ eyes: k > 0.3 ? 'squint' : 'normal', mouth: 'flat', open: 1, brow: t > Wd('L10', 2) ? 'angry' : 'none', look: [-0.4, 0] });
      YOU.face.set({ eyes: 'normal', size: 1.2, pupil: 2, look: [Math.sin(ta * 5) > 0 ? 1 : -1, 0], mouth: 'grin', brow: 'worried', open: 1 });
    }
    if (t >= B0('L11')) { const red = smooth(B0('L11'), B0('L14'), t); BOSS.face.set({ eyes: 'normal', size: 0.8, red: red * 0.8, brow: 'angry', mouth: 'frown', open: 1 }); }
    // L14 FIRED
    if (t >= B0('L14')) {
      BOSS.face.set({ eyes: 'normal', size: 0.8, red: 1, brow: 'angry', mouth: 'yell', open: 1 });
      const k = easeOutBack(smooth(B0('L14') - 0.05, B0('L14') + 0.2, t));
      reach(BOSS, 1, spinePt(BOSS, lerp(0.3, 0.75, k), lerp(0.0, 0.62, k), lerp(0.1, 0.55, k)));
      BOSS.spine.rotation.y = 0.15 * k; BOSS.head.rotation.x = -0.12;
      YOU.face.set({ eyes: 'pop', mouth: 'open', brow: 'worried', open: 1 }); YOU.spine.rotation.x = -0.12;
    }
    return;
  }
  // ---------- L15: security carries you out (office)
  if (t < B0('L16')) {
    stage = 'office';
    WORKERS.forEach((c) => { place(c, V(c.desk.x, 0, c.desk.z), Math.PI); seatPose(c); c.head.rotation.y = 0.5; c.face.set({ eyes: 'pop', mouth: 'o' }); reach(c, 1, headPt(c, 0, -0.04, 0.34)); reach(c, 0, rootPt(c, -0.14, 0.84, 0.45)); });
    place(BOSS, HUG_BOSS, -Math.PI / 2); BOSS.face.set({ red: 0.8, brow: 'angry', mouth: 'frown', size: 0.8 }); reach(BOSS, 0, spinePt(BOSS, -0.28, 0.25, 0.3));
    const k = smooth(B0('L15'), B1('L15'), t);
    const p = HUG_YOU.clone().lerp(V(6.6, 0, 4.0), k);
    place(YOU, p.clone().add(V(0, 0.32, 0)), Math.PI / 2);
    YOU.legs[0].hip.rotation.x = 0.4 * Math.sin(ta * 12); YOU.legs[1].hip.rotation.x = -0.4 * Math.sin(ta * 12);
    YOU.face.set({ eyes: 'normal', mouth: 'frown', brow: 'worried', tears: 0.4, t: ta, open: 1 });
    GUARDS.forEach((g, i) => {
      const side = i === 0 ? -1 : 1; // -1: guard on YOU's left (+z), 1: right (-z)
      place(g, p.clone().add(V(0, 0, -side * 0.62)), Math.PI / 2); walkPose(g, ta * 8 + i * 3, 1);
      const yArm = YOU.arms[side > 0 ? 0 : 1];
      YOU.root.updateMatrixWorld(true);
      const grip = yArm.el.localToWorld(V(0, -0.05, 0));
      reach(g, side > 0 ? 1 : 0, grip);
      reach(g, side > 0 ? 0 : 1, headPt(g, 0, -0.05, 0.34));
      g.face.set({ eyes: 'squint', mouth: 'wobble' });
      reach(YOU, side > 0 ? 0 : 1, spinePt(YOU, side * -0.7, 0.55, 0.0));
    });
    return;
  }
  // ---------- L16: outside in the rain with the box (street)
  if (t < B0('L17')) {
    stage = 'rain';
    place(YOU, V(OX + 3.2, 0, -6.0), 0.15);
    BOX_HELD = true;
    YOU.head.rotation.x = 0.18;
    YOU.face.set({ eyes: 'normal', lids: 0.35, mouth: 'frown', brow: 'worried', tears: 1, t: ta, look: [0, -0.4] });
    return;
  }
  // ---------- L17-L19: home
  if (t < B0('L20')) {
    stage = 'home';
    if (t < Wd('L17', 3)) { // walks in, sad
      const k = smooth(B0('L17'), Wd('L17', 3), t);
      place(YOU, V(HX + 2.6, 0, 1.6).lerp(V(HX + 0.5, 0, 0.6), k), -Math.PI / 2 - 0.4); walkPose(YOU, ta * 5, 1);
      YOU.face.set({ eyes: 'normal', lids: 0.4, mouth: 'frown', brow: 'worried' }); YOU.head.rotation.x = 0.2;
    } else {
      YOU.pantsMeshes.forEach(m => { m.material = NEW_PANTS; });
      place(YOU, V(HX + 0.3, 0, 0.4), 0.15);
      YOU.face.set({ eyes: 'normal', lids: 0.42, brow: 'angry', mouth: 'flat' });
      reach(YOU, 0, spinePt(YOU, -0.36, 0.08, 0.05)); reach(YOU, 1, spinePt(YOU, 0.36, 0.08, 0.05)); // hands on hips
      if (t >= B0('L18')) {
        PHONE.visible = true;
        const toEar = smooth(B0('L19') - 0.3, B0('L19'), t);
        const front = headPt(YOU, 0.0, -0.22, 0.55), ear = headPt(YOU, -0.3, 0, 0.05);
        reach(YOU, 0, front.clone().lerp(ear, toEar).add(V(0, -0.08, 0)));
        YOU.root.updateMatrixWorld(true);
        YOU.arms[0].hand.localToWorld(PHONE.position.set(0, -0.02, 0.14));
        PHONE.quaternion.copy(YOU.head.getWorldQuaternion(new THREE.Quaternion()));
        if (toEar > 0.5) PHONE.rotateY(-Math.PI / 2);
        YOU.head.rotation.x = 0.25 * (1 - toEar);
        YOU.face.set({ eyes: 'normal', lids: 0.45, brow: 'angry', mouth: (t >= S('L19') && t < Se('L19') && Math.floor(ta * 9) % 2) ? 'o' : 'flat', look: [0, toEar > 0.5 ? 0 : -0.6] });
      }
    }
    return;
  }
  // ---------- L20: tank at the house
  if (t < B0('L21')) { stage = 'house'; return; }
  // ---------- L21-L27: street, tank, explosion
  stage = t >= tBoom() ? 'boom' : 'street';
  YOU.pantsMeshes.forEach(m => { m.material = NEW_PANTS; });
  // YOU inside the tank
  TANK.updateMatrixWorld(true);
  const hatchW = HATCH.getWorldPosition(V());
  const pop = smooth(B0('L24') - 0.1, B0('L24') + 0.35, t);
  const youY = lerp(-1.6, -0.95, easeOutBack(pop));
  place(YOU, hatchW.clone().add(V(0, youY, 0.3)), TANK.rotation.y + TURRET.rotation.y);
  YOU.root.visible = pop > 0.01;
  const gl = smooth(Wd('L24', 1) - 0.2, Wd('L24', 1) + 0.4, t);
  if (pop > 0.01) {
    reach(YOU, 1, headPt(YOU, 0.25, -0.3, 0.3).lerp(headPt(YOU, 0.14, 0.02, 0.32), gl));
    reach(YOU, 0, spinePt(YOU, -0.45, 0.35, 0.1));
    YOU.glasses.visible = gl > 0.05; YOU.glasses.position.set(0, lerp(-0.35, 0, gl), lerp(0.1, 0, gl));
    YOU.face.set({ eyes: 'normal', lids: 0.4, brow: 'angry', mouth: gl > 0.6 ? 'smirk' : 'flat' });
  }
  if (t >= tBoom()) { YOU.glasses.visible = true; YOU.glasses.position.set(0, 0, 0); YOU.face.set({ mouth: 'smirk', dust: 0.6 }); }
  // workers run out (L22) and stand on the far sidewalk
  WORKERS.forEach((c, i) => {
    const r0 = B0('L22') + c.runDelay * 0.6, r1 = r0 + 1.6;
    const from = STREET_DOOR.clone(), to = V(OX + c.runOff.x, 0, c.runOff.z);
    if (t < r0) { c.root.visible = false; return; }
    const k = smooth(r0, r1, t);
    const p = from.lerp(to, k);
    const dir = to.clone().sub(STREET_DOOR);
    place(c, p, k < 1 ? Math.atan2(dir.x, dir.z) : Math.PI);
    c.running = k < 1;
    if (k < 1) { walkPose(c, ta * 13 + i, 1, true); c.face.set({ eyes: 'pop', mouth: 'open' }); }
    else { c.face.set({ eyes: t > tBoom() + 0.6 ? 'normal' : 'pop', mouth: 'o', dust: t > tBoom() ? 0.8 : 0, open: blink(ta, i) }); c.root.rotation.y = Math.PI; }
  });
  // boss comes out last with coffee (L23)
  if (t >= B0('L23')) {
    const b0 = B0('L23'), b1 = atF('L23', 0.55);
    const k = smooth(b0, b1, t);
    const p = STREET_DOOR.clone().lerp(V(OX + 3.4, 0, -2.6), k);
    place(BOSS, p, 0.2);
    walkPose(BOSS, ta * 3, 1 - smooth(b1 - 0.3, b1, t));
    const sip = t < b1;
    reach(BOSS, 0, sip ? headPt(BOSS, -0.02, -0.17, 0.34) : spinePt(BOSS, -0.3, 0.3, 0.32));
    reach(BOSS, 1, spinePt(BOSS, 0.3, 0.0, 0.1));
    BOSS.face.set(sip ? { eyes: 'closed', mouth: 'sip', brow: 'none' } : { eyes: 'pop', mouth: 'o' });
    if (!sip) BOSS.mustache.position.y = -0.125 + 0.01 * Math.sin(ta * 40);
    if (t >= tBoom()) {
      BOSS.face.set({ soot: 1, eyes: 'normal', size: 1.1, open: blink(ta * 0.9, 3) > 0 ? 1 : 0, mouth: 'flat', brow: 'none' });
      BOSS.spikes.visible = true; BOSS.fringe.forEach(f => f.visible = false);
      BOSS.cup.visible = false; BOSS.coffee.visible = false; BOSS.broken.visible = true;
      reach(BOSS, 0, spinePt(BOSS, -0.25, 0.3, 0.38));
      BOSS.root.rotation.y = 0.15;
    }
  }
}
let BOX_HELD = false;

function updateProps(t) {
  const ta = tFreeze(t);
  // printer
  const jam = t >= S('L12') + 0.35;
  jamPapers.forEach((p, i) => { p.visible = jam; p.rotation.set(-0.6 + i * 0.3, i * 0.5, 0.2 * i); p.position.y = 0.5 + i * 0.03; });
  outPaper.position.y = jam ? 0.3 : 0.3 + ((ta * 0.8) % 1) * -0.05; outPaper.position.z = jam ? 0.32 : 0.32 + ((ta * 0.8) % 1) * 0.25;
  printLed.material.color.set(jam ? (Math.floor(ta * 6) % 2 ? '#ff2020' : '#401010') : '#20e020');
  PRINTER.position.x = 6.6 + (jam && t < S('L12') + 0.9 ? 0.02 * Math.sin(ta * 70) : 0);
  // plant wilts (L13)
  const wilt = smooth(S('L13') + 0.1, S('L13') + 0.9, t), fall = smooth(We('L13', 3) - 0.1, We('L13', 3) + 0.4, t);
  LEAVES.forEach(l => { l.piv.rotation.z = lerp(l.base, -1.2, wilt); l.lf.material = wilt > 0.5 ? leafBrown : leafGreen; });
  stem.rotation.z = 0.5 * wilt; plantPivot.rotation.z = -1.45 * easeOutBack(fall) * (fall > 0 ? 1 : 0); plantPivot.position.x = 0.25 * fall;
  // phone, box
  BOXG.visible = BOX_HELD;
  if (BOX_HELD) { YOU.root.updateMatrixWorld(true); BOXG.position.copy(spinePt(YOU, 0, 0.12, 0.42)); BOXG.rotation.set(0, YOU.root.rotation.y, 0); reach(YOU, 0, spinePt(YOU, -0.22, 0.1, 0.36)); reach(YOU, 1, spinePt(YOU, 0.22, 0.1, 0.36)); YOU.root.updateMatrixWorld(true); }
  // tank placement
  TANK.visible = t >= B0('L20');
  TURRET.rotation.y = 0; HATCH.rotation.x = 0;
  if (t >= B0('L20') && t < B0('L21')) { TANK.position.copy(HOUSE_TANK); TANK.rotation.set(0, -0.6, 0); }
  if (t >= B0('L21')) {
    const d0 = B0('L21'), d1 = B0('L23') - 0.2;
    const k = smooth(d0, d1, t);
    const x = lerp(OX - 34, TANK_STOP.x, k);
    TANK.position.set(x, 0, TANK_STOP.z); TANK.rotation.set(0, Math.PI / 2, 0);
    TANK.position.y = k < 1 ? 0.03 * Math.abs(Math.sin(ta * 18)) : 0;
    const speed = k < 1 ? 1 : 0;
    trackM.map.offset.y = -x * 0.5; WHEELS.forEach(w => { w.rotation.x = -x * 3; });
    TURRET.rotation.y = smooth(B0('L23') + 0.3, atF('L23', 0.9), t) * Math.PI / 2;
    HATCH.rotation.x = -1.9 * smooth(B0('L24') - 0.2, B0('L24') + 0.15, t);
    // recoil
    const rc = smooth(tFire(), tFire() + 0.05, t) * (1 - smooth(tFire() + 0.1, tFire() + 0.5, t));
    BARREL.position.z = 1.0 - 0.35 * rc;
    // cars move aside
    CARS.forEach(c => { const near = smooth(x - 2, x + 6, c.x) ; c.c.position.set(c.x, 0, c.z + c.dz * (1 - smooth(x - 1, x + 7, c.x))); c.c.rotation.y = 0.3 * Math.sign(c.dz) * (1 - smooth(x - 1, x + 7, c.x)) * smooth(x + 9, x + 6, c.x); });
  } else CARS.forEach(c => { c.c.position.set(c.x, 0, c.z); c.c.rotation.y = 0; });
  // building / rubble
  const boomed = t >= tBoom() + 0.25;
  BUILDING.visible = !boomed; RUBBLE.visible = boomed;
}

// ------------------------------------------------------------------ effects
const shellFrom = () => { TANK.updateMatrixWorld(true); return BARREL.localToWorld(V(0, 0, 3.0)); };
const BOOM_AT = V(OX, 5.5, -11.5);
function updateEffects(t, cam) {
  const ta = tFreeze(t);
  // sparkles (shirt / shoes / smile / tank at house / hatch)
  SPARKS.forEach(s => { s.visible = false; });
  const sparkAt = [];
  const sp = (pos, t0, n, spread, size) => sparkAt.push({ pos, t0, n, spread, size });
  if (t >= B0('L02') && t < B0('L03')) { YOU.root.updateMatrixWorld(true); sp(spinePt(YOU, 0, 0.4, 0.3), Wd('L02', 0), 4, 0.25, 0.05); sp(YOU.legs[0].shoe.getWorldPosition(V()).add(V(0, 0.1, 0)), Wd('L02', 2), 4, 0.2, 0.045); sp(headPos(YOU).add(V(0, 0.1, 0.3)), Wd('L02', 4), 5, 0.4, 0.09); }
  if (t >= B0('L20') && t < B0('L21')) { sp(HOUSE_TANK.clone().add(V(0, 2.2, 0)), B0('L20'), 12, 2.4, 0.28); }
  if (t >= Wd('L24', 1)) sp(headPos(YOU).add(V(0.12, 0.05, 0.3)), Wd('L24', 2), 3, 0.15, 0.06);
  let si = 0;
  for (const g of sparkAt) {
    const r = rng(Math.floor(g.t0 * 100));
    for (let k = 0; k < g.n; k++) {
      const s = SPARKS[si++]; if (!s) break;
      const ph = r() * 6, off = V((r() - 0.5) * 2 * g.spread, (r() - 0.3) * g.spread, (r() - 0.5) * g.spread);
      const age = t - g.t0 - k * 0.08; if (age < 0) continue;
      s.visible = true; s.position.copy(g.pos).add(off);
      const sc = g.size * Math.max(0, Math.sin(age * 5 + ph)) * easeOutBack(Math.min(1, age / 0.2));
      s.scale.set(sc, sc, 1);
    }
  }
  // chillies + steam in flashback
  CHILLIS.forEach((c, i) => {
    c.visible = stage === 'flashback';
    if (!c.visible) return;
    const r = rng(50 + i), age = (t * 0.6 + r()) % 1;
    c.position.set(HX + 0.6 + (r() - 0.5) * 1.6, 1.0 + age * 1.6, 0.5 + (r() - 0.5) * 1.0);
    const s = 0.14 * Math.sin(Math.PI * age); c.scale.set(s, s, 1); c.material.rotation = Math.sin(t * 3 + i) * 0.4;
  });
  STEAM.forEach((s, i) => {
    let base = null;
    if (stage === 'flashback') base = V(HX + 0.6 + (i % 3 - 1) * 0.15, 1.15, 0.45);
    else if ((stage === 'office' || stage === 'street') && BOSS.root.visible && BOSS.coffee.visible) { BOSS.root.updateMatrixWorld(true); base = BOSS.coffee.getWorldPosition(V()).add(V(0, 0.06, 0)); }
    s.visible = !!base && i < (stage === 'flashback' ? 10 : 3);
    if (!s.visible) return;
    const age = (ta * 0.8 + i * 0.33) % 1;
    s.position.copy(base).add(V(Math.sin(age * 6 + i) * 0.04, age * 0.35, 0));
    const sc = (stage === 'flashback' ? 0.35 : 0.14) * (0.5 + age); s.scale.set(sc, sc, 1); s.material.opacity = 0.6 * Math.sin(Math.PI * age);
  });
  // stink lines: from the pants after "it happens", in the office, and on the street (rain shot)
  const stinkOn = (t >= Wd('L08', 1) && t < B0('L15') + 0.0) || (t >= B0('L15') && t < B0('L17'));
  STINK.forEach((st, i) => {
    st.s.visible = stinkOn && YOU.root.visible;
    if (!st.s.visible) return;
    drawStink(st, t);
    YOU.root.updateMatrixWorld(true);
    const base = YOU.pelvis.localToWorld(V((i - 1.5) * 0.18, 0.1, -0.25));
    const rise = (t * 0.4 + i * 0.27) % 1;
    st.s.position.copy(base).add(V(0, 0.2 + rise * 0.7, 0));
    st.s.scale.set(0.22, 0.85, 1);
    st.s.material.opacity = (1 - smooth(0.7, 1, rise)) * smooth(0, 0.15, rise) * smooth(0.8, 1.8, st.s.position.distanceTo(cam));
  });
  // sweat drops
  const sweatYou = (t >= B0('L03') && t < B0('L04')) || (t >= B0('L06') && t < B0('L20'));
  YOU_DROPS.forEach((d, i) => { d.m.visible = sweatYou && YOU.root.visible && !(stage === 'rain' && i > 1); if (!d.m.visible) return; const ph = ((t * 0.7 + i * 0.37) % 1); d.m.position.copy(d.at).add(V(0, -ph * 0.16, 0)); d.m.scale.setScalar(easeOutBack(Math.min(1, ph * 6)) * (1 - smooth(0.85, 1, ph)) * 1.1 + 0.001); });
  const sweatBoss = t >= B0('L23') && t < tBoom();
  BOSS_DROPS.forEach((d, i) => { d.m.visible = sweatBoss && BOSS.root.visible && t > atF('L23', 0.55); if (!d.m.visible) return; const ph = ((t * 0.9 + i * 0.5) % 1); d.m.position.copy(d.at).add(V(0, -ph * 0.16, 0)); d.m.scale.setScalar(easeOutBack(Math.min(1, ph * 6)) * (1 - smooth(0.85, 1, ph)) * 1.1 + 0.001); });
  // smoke: tank exhaust, muzzle, explosion, boss smoking hair
  SMOKE.forEach(s => { s.visible = false; });
  let mi = 0;
  const puff = (pos, size, op, col = '#9a958e') => { const s = SMOKE[mi++]; if (!s) return; s.visible = true; s.position.copy(pos); s.scale.set(size, size, 1); s.material.opacity = op; s.material.color.set(col); };
  if (TANK.visible && t >= B0('L21') && t < tBoom() + 3) {
    TANK.updateMatrixWorld(true);
    for (let i = 0; i < 6; i++) { const age = (ta * 1.5 + i / 6) % 1; puff(TANK.localToWorld(V((i % 2 ? 0.7 : -0.7), 1.5 + age * 1.2, -2.5 - age * 0.8)), 0.4 + age * 0.9, 0.5 * (1 - age), '#6f6f73'); }
  }
  if (t >= tFire() && t < tFire() + 1.2) { const age = t - tFire(); const p = shellFrom(); for (let i = 0; i < 5; i++) puff(p.clone().add(V(Math.sin(i * 2) * 0.4 * age * 3, 0.3 * i * age, Math.cos(i * 2) * 0.4 * age * 3)), 0.6 + age * 2, 0.7 * (1 - age / 1.2), '#d8d4cc'); }
  if (t >= tBoom()) {
    const age = t - tBoom();
    for (let i = 0; i < 26; i++) { const r = rng(700 + i); const d = 3 + r() * 9; const a = r() * Math.PI * 2; const p = BOOM_AT.clone().add(V(Math.cos(a) * d * easeOut(age / 2), -3 + r() * 8 + age * (0.5 + r()), Math.sin(a) * d * 0.6 * easeOut(age / 2) + 2)); puff(p, 3 + r() * 4 + age * 1.2, clamp(0.85 - age * 0.06, 0.2, 0.85) * smooth(0.15, 0.5, age), ['#8c867e', '#a8a29a', '#6e6a64'][i % 3]); }
    BOSS.root.updateMatrixWorld(true);
    if (BOSS.root.visible) for (let i = 0; i < 5; i++) { const a2 = (ta * 0.9 + i / 5) % 1; puff(headPt(BOSS, (i - 2) * 0.09, 0.55 + a2 * 0.6, -0.05), 0.15 + a2 * 0.35, 0.6 * (1 - a2), '#5d5955'); }
  }
  // shell flight + fireballs + ring + bits + chunks + flash
  SHELL.visible = false;
  if (t >= tFire() && t < tBoom()) { const k = (t - tFire()) / (tBoom() - tFire()); SHELL.visible = true; SHELL.position.copy(shellFrom().lerp(BOOM_AT, k)); SHELL.lookAt(BOOM_AT); SHELL.rotateX(Math.PI / 2); }
  const age = t - tBoom();
  FIRE.forEach((f, i) => {
    f.visible = age >= 0 && age < 2.6;
    if (!f.visible) return;
    const r = rng(600 + i), d = i < 3 ? r() * 1.5 : 2 + r() * 6, a = r() * Math.PI * 2;
    const grow = easeOutBack(Math.min(1, (age - r() * 0.15) / 0.45));
    f.position.copy(BOOM_AT).add(V(Math.cos(a) * d * grow, (r() - 0.3) * 4 * grow + age * 1.2, Math.sin(a) * d * 0.5 * grow + 1));
    const s = (i < 3 ? 4.6 : 1.8 + r() * 2.8) * Math.max(0.01, grow) * (1 - smooth(1.4, 2.6, age) * 0.6);
    f.scale.setScalar(s); f.rotation.set(age + i, age * 0.7, i);
    f.material.opacity = 1 - smooth(1.2, 2.6, age);
  });
  RING.visible = age >= 0 && age < 1.2; if (RING.visible) { RING.position.copy(BOOM_AT).setY(1); RING.scale.setScalar(1 + age * 22); RING.material.opacity = 1 - age / 1.2; }
  BITS.forEach(b => {
    const a2 = age - b.delay; b.m.visible = a2 >= 0 && a2 < 12; if (!b.m.visible) return;
    const e = (1 - Math.exp(-1.5 * a2)) / 1.5;
    b.m.position.copy(BOOM_AT).add(V(b.v.x * e + Math.sin(a2 * 2 + b.spin.x) * 0.4, b.v.y * e - b.fall * a2, b.v.z * e));
    if (b.m.position.y < 0.05) b.m.position.y = 0.05;
    b.m.rotation.set(b.spin.x * a2, b.spin.y * a2, b.spin.z * a2);
  });
  CHUNKS.forEach(c => { c.m.visible = age >= 0 && age < 3; if (!c.m.visible) return; c.m.position.copy(BOOM_AT).add(V(c.v.x * age * 0.5, c.v.y * age - 9 * age * age, c.v.z * age * 0.5)); if (c.m.position.y < 0.3) c.m.position.y = 0.3; c.m.rotation.set(c.spin.x * age, c.spin.y * age, c.spin.z * age); });
  FLASH.visible = (age >= 0 && age < 0.4) || (t >= tFire() && t < tFire() + 0.15);
  if (FLASH.visible) { if (age >= 0) { FLASH.position.copy(BOOM_AT); FLASH.scale.setScalar(30 * (1 - age / 0.4) + 5); FLASH.material.opacity = 1 - age / 0.4; } else { FLASH.position.copy(shellFrom()); FLASH.scale.setScalar(3.5); FLASH.material.opacity = 1; } }
}

// ================================================================== SHOTS
const SHOTS = [];
function addShots(id, list) { const [t0, t1] = beat(id); list.forEach((e, i) => { const a = t0 + (t1 - t0) * e[0], b = i + 1 < list.length ? t0 + (t1 - t0) * list[i + 1][0] : t1; SHOTS.push({ t0: a, t1: b, name: e[1], fn: e[2], whoosh: !!(e[3] && e[3].whoosh) }); }); }
function addAt(id, list) { // list: [time, name, fn, opts]; last ends at beat end
  const t1 = B1(id); list.forEach((e, i) => SHOTS.push({ t0: e[0], t1: i + 1 < list.length ? list[i + 1][0] : t1, name: e[1], fn: e[2], whoosh: !!(e[3] && e[3].whoosh) }));
}
const distFor = (w, fov) => (w * 16 / 9) / (2 * Math.tan(fov * DEG / 2));
const fwd = (c) => { const y = c.root.rotation.y; return V(Math.sin(y), 0, Math.cos(y)); };
function cu(c, { w = 1.0, fov = 36, yaw = 0, pitch = 0.04, push = 0.07, ty = null, shake = 0, wEnd = null, roll = 0, at = null } = {}) {
  return (u, t) => {
    const h = at ? at() : headPos(c);
    const ww = wEnd != null ? lerp(w, wEnd, smooth(0, 1, u)) : w;
    const d = distFor(ww, fov) * (1 - push * u);
    const dir = fwd(c).applyAxisAngle(V(0, 1, 0), yaw); dir.y = Math.tan(pitch); dir.normalize();
    const pos = h.clone().addScaledVector(dir, d), tgt = h.clone().add(V(0, ty != null ? ty : -0.3 * ww, 0));
    if (shake) { pos.x += noise1(t * 11, 1) * shake; pos.y += noise1(t * 11, 4) * shake; }
    return { pos, tgt, fov, roll, subject: c };
  };
}
function fixed(p0, p1, t0, t1, fov = 50, opt = {}) {
  return (u) => ({ pos: (typeof p0 === 'function' ? p0() : p0).clone().lerp(typeof p1 === 'function' ? p1() : p1, smooth(0, 1, u)), tgt: (typeof t0 === 'function' ? t0() : t0).clone().lerp(typeof t1 === 'function' ? t1() : t1, smooth(0, 1, u)), fov: opt.fovEnd ? lerp(fov, opt.fovEnd, smooth(0, 1, u)) : fov, roll: opt.roll || 0 });
}
const youP = () => YOU.root.position.clone();
const bossP = () => BOSS.root.position.clone();
const pantsP = () => { YOU.root.updateMatrixWorld(true); return YOU.pelvis.getWorldPosition(V()); };

// L01 street
addShots('L01', [
  [0, 'street-lowwide', fixed(V(OX + 3.5, 0.35, -2.6), V(OX + 3.2, 0.45, -3.0), V(OX - 1.5, 3.2, -8), V(OX - 1, 3.6, -8), 62)],
  [0.5, 'you-walk-front', (u, t) => { const h = headPos(YOU); return { pos: h.clone().add(V(2.4, -0.25, 0.75)), tgt: h.clone().add(V(0, -0.35, 0)), fov: 40 }; }],
]);
addAt('L02', [
  [B0('L02'), 'shirt-cu', (u) => { YOU.root.updateMatrixWorld(true); const p = spinePt(YOU, 0, 0.38, 0); const d = fwd(YOU); return { pos: p.clone().addScaledVector(d, 1.7 - 0.2 * u).add(V(0, 0.1, 0)), tgt: p.clone().add(V(0, -0.05, 0)), fov: 36 }; }, { whoosh: true }],
  [Wd('L02', 2), 'shoes-cu', (u) => { YOU.root.updateMatrixWorld(true); const p = YOU.legs[0].shoe.getWorldPosition(V()); const d = fwd(YOU); return { pos: p.clone().addScaledVector(d, 0.45).add(V(0, 0.28, 0.85)), tgt: p.clone().addScaledVector(d, 0.15).add(V(0, 0.22, 0.1)), fov: 40 }; }, { whoosh: true }],
  [Wd('L02', 4), 'face-smile', cu(YOU, { w: 0.85, fov: 36, push: 0.1 }), { whoosh: true }],
]);
// L03 flashback
addShots('L03', [
  [0, 'flash-wide', fixed(V(HX + 2.6, 1.8, -1.4), V(HX + 2.3, 1.7, -1.1), V(HX + 0.6, 0.9, 0.7), V(HX + 0.6, 0.95, 0.7), 46)],
  [0.5, 'flash-eat-cu', cu(YOU, { w: 0.95, fov: 38, push: 0.1, pitch: 0.12 })],
]);
// L04 boss walks in
addShots('L04', [
  [0, 'office-wide-boss', fixed(V(-3.5, 1.4, 6.8), V(-3.2, 1.35, 6.6), V(4, 1.2, 3.5), V(2.5, 1.2, 3.4), 56)],
  [0.55, 'boss-lowangle', (u) => { const b = bossP(); return { pos: b.clone().add(V(-2.6, 0.95, 1.1)), tgt: b.clone().add(V(0, 1.55, 0)), fov: 44 - 5 * u }; }],
]);
addShots('L05', [[0, 'boss-arms-open', cu(BOSS, { w: 2.1, fov: 44, ty: -0.45, push: 0.06, pitch: -0.03, yaw: -0.75 })]]);
addAt('L06', [
  [B0('L06'), 'hug-side', fixed(V(-0.1, 1.6, 7.3), V(-0.1, 1.6, 7.0), V(-0.1, 1.45, 3.2), V(-0.1, 1.45, 3.2), 42)],
  [Wd('L06', 3), 'hug-tight', fixed(V(-0.2, 1.9, 5.6), V(-0.2, 1.9, 5.4), V(-0.25, 1.75, 3.2), V(-0.25, 1.75, 3.2), 40), { whoosh: true }],
]);
addShots('L07', [[0, 'you-squeezed-cu', (u, t) => { const h = headPos(YOU); return { pos: h.clone().add(V(0.1, 0.05, 1.75 - 0.2 * u)), tgt: h.clone().add(V(0.1, -0.12, 0)), fov: 36, shake: 0.012 }; }, { whoosh: true }]]);
addShots('L08', [
  [0, 'pants-zoom-1', (u) => { const p = pantsP(); const k = smooth(0, 1, u); return { pos: p.clone().add(V(lerp(-2.4, -1.7, k), lerp(0.55, 0.35, k), lerp(1.6, 1.15, k))), tgt: p.clone().add(V(-0.15, 0.05, 0)), fov: 42 }; }],
  [0.5, 'pants-zoom-2', (u) => { const p = pantsP(); const k = smooth(0, 1, u); return { pos: p.clone().add(V(lerp(-1.3, -0.95, k), lerp(0.15, 0.05, k), lerp(0.85, 0.6, k))), tgt: p.clone().add(V(-0.3, -0.08, 0)), fov: 40 }; }],
]);
addShots('L09', [
  [0, 'freeze-wide', fixed(V(0, 1.6, 7.2), V(0, 1.6, 7.0), V(0, 1.1, 3.2), V(0, 1.1, 3.2), 50)],
  [0.5, 'freeze-stink', (u) => { const p = pantsP(); return { pos: p.clone().add(V(-1.6, 0.6, 1.0)), tgt: p.clone().add(V(0, 0.55, -0.1)), fov: 44 - 4 * u }; }],
]);
addAt('L10', [
  [B0('L10'), 'boss-stops', cu(BOSS, { w: 0.95, fov: 36, push: 0.05, yaw: 0.25 })],
  [Wd('L10', 2), 'boss-sniff', cu(BOSS, { w: 0.7, fov: 34, push: 0.04, yaw: 0.15 }), { whoosh: true }],
  [Wd('L10', 4), 'nose-once', cu(BOSS, { w: 0.5, fov: 32, ty: -0.1, push: 0.03, yaw: 0.1 }), { whoosh: true }],
  [Wd('L10', 5), 'nose-twice', cu(BOSS, { w: 0.46, fov: 30, ty: -0.08, push: 0.03, roll: 0.07 }), { whoosh: true }],
]);
addShots('L11', [
  [0, 'office-workers', fixed(V(-1, 1.7, -5.7), V(-0.8, 1.7, -5.5), V(-1, 1.0, -1.5), V(-1, 1.0, -1.5), 62)],
  [0.55, 'worker-cu', cu(WORKERS[4], { w: 1.0, fov: 36, push: 0.06 })],
]);
addShots('L12', [[0, 'printer-jam', fixed(V(5.4, 1.5, -3.5), V(5.6, 1.45, -3.8), V(6.6, 1.0, -5.1), V(6.6, 1.0, -5.1), 42)]]);
addShots('L13', [
  [0, 'plant-wilt', fixed(V(-2.4, 1.0, 6.4), V(-2.4, 1.0, 6.1), V(-2.4, 0.9, 4.6), V(-2.4, 0.85, 4.6), 42)],
  [0.62, 'plant-falls', fixed(V(-1.4, 0.6, 5.6), V(-1.4, 0.55, 5.5), V(-2.2, 0.4, 4.6), V(-2.2, 0.35, 4.6), 46), { whoosh: true }],
]);
addShots('L14', [
  [0, 'boss-fired', cu(BOSS, { w: 1.7, fov: 44, ty: -0.4, push: 0.1, yaw: -1.0, shake: 0.03 }), { whoosh: true }],
  [0.6, 'you-shock', cu(YOU, { w: 0.9, fov: 36, push: 0.05, shake: 0.01 })],
]);
addShots('L15', [
  [0, 'carry-side', (u) => { const p = youP(); return { pos: p.clone().add(V(1.6, 3.2, 3.2)), tgt: p.clone().add(V(0.2, 1.0, 0)), fov: 46 }; }],
  [0.5, 'carry-front', (u) => { const p = youP(); return { pos: p.clone().add(V(3.4, 1.6, 0.35)), tgt: p.clone().add(V(0, 1.15, 0)), fov: 48, keep: GUARDS }; }],
]);
addAt('L16', [
  [B0('L16'), 'rain-box', (u) => { const h = headPos(YOU); return { pos: h.clone().add(V(0.4, -0.3, 2.6 - 0.3 * u)), tgt: h.clone().add(V(0, -0.55, 0)), fov: 44 }; }],
  [Wd('L16', 3), 'rain-tears', cu(YOU, { w: 0.8, fov: 36, push: 0.07, pitch: 0.08 })],
  [Wd('L16', 5), 'rain-pullback', (u) => { const p = youP(); return { pos: p.clone().add(V(-1.5 - 2 * u, 2.4 + 2.5 * u, 5.5 + 4 * u)), tgt: p.clone().add(V(0, 1.2, 0)), fov: 50 }; }],
]);
addAt('L17', [
  [B0('L17'), 'home-enter', fixed(V(HX - 2.0, 1.7, 2.6), V(HX - 1.8, 1.65, 2.4), V(HX + 1.2, 1.0, 0.8), V(HX + 0.8, 1.0, 0.6), 54)],
  [Wd('L17', 3), 'new-pants', (u) => { const p = youP(); const k = smooth(0.1, 0.9, u); return { pos: p.clone().add(V(0.35, lerp(0.7, 1.55, k), 2.1)), tgt: p.clone().add(V(0, lerp(0.6, 1.45, k), 0)), fov: 40 }; }, { whoosh: true }],
]);
addShots('L18', [[0, 'phone-cu', (u) => { const p = PHONE.getWorldPosition(V()); const d = fwd(YOU); return { pos: p.clone().addScaledVector(d, 0.62 - 0.1 * u).add(V(0, 0.12, 0)), tgt: p.clone().add(V(0, 0.08, 0)), fov: 40, subject: YOU }; }]]);
addShots('L19', [
  [0, 'phone-serious-low', cu(YOU, { w: 1.3, fov: 40, pitch: -0.3, yaw: 0.35, push: 0.08 })],
  [0.5, 'phone-serious-ecu', cu(YOU, { w: 0.7, fov: 34, push: 0.06, yaw: 0.2 })],
]);
addShots('L20', [
  [0, 'tank-house-wide', fixed(V(HX + 12, 2.4, 52), V(HX + 11, 2.2, 51), V(HX + 1, 1.8, 41), V(HX + 2, 1.6, 42), 50)],
  [0.55, 'tank-sparkle-cu', fixed(V(HX + 7.2, 2.4, 47.8), V(HX + 6.9, 2.35, 47.4), HOUSE_TANK.clone().add(V(0, 1.6, 0)), HOUSE_TANK.clone().add(V(0, 1.7, 0)), 42)],
]);
addShots('L21', [
  [0, 'tank-road-front', (u, t) => { const p = TANK.position.clone(); return { pos: p.clone().add(V(9 - 2 * u, 0.6, 1.2)), tgt: p.clone().add(V(0, 1.5, 0)), fov: 44, shake: 0.04 }; }],
  [0.38, 'cars-swerve', (u, t) => { const p = TANK.position.clone(); return { pos: V(p.x + 10, 4.5, 8), tgt: V(p.x + 6, 0.5, 0), fov: 46, shake: 0.03 }; }, { whoosh: true }],
  [0.7, 'tank-side', (u, t) => { const p = TANK.position.clone(); return { pos: p.clone().add(V(-1.5, 1.3, 7.5)), tgt: p.clone().add(V(0, 1.4, 0)), fov: 46, shake: 0.035 }; }],
]);
addShots('L22', [
  [0, 'workers-door', fixed(V(OX + 1.5, 1.6, -0.5), V(OX + 1.4, 1.6, -0.8), V(OX, 1.2, -7), V(OX, 1.2, -7), 56)],
  [0.5, 'workers-street', fixed(V(OX + 6.5, 1.7, -3.2), V(OX + 6.2, 1.7, -3.0), V(OX + 1.5, 1.0, 6.2), V(OX + 1.5, 1.0, 6.2), 54)],
]);
addShots('L23', [
  [0, 'boss-exit-sip', cu(BOSS, { w: 1.7, fov: 42, ty: -0.5, push: 0.05 })],
  [0.55, 'boss-sees-tank', cu(BOSS, { w: 0.9, fov: 36, push: 0.12, yaw: 0.2 }), { whoosh: true }],
]);
addShots('L24', [
  [0, 'hatch-pop', cu(YOU, { w: 2.6, fov: 44, pitch: 0.12, yaw: -0.55, push: 0.08, ty: -0.55 })],
  [0.5, 'sunglasses-cu', cu(YOU, { w: 0.75, fov: 34, push: 0.06, yaw: -0.15 })],
]);
addShots('L25', [
  [0, 'tank-fire', fixed(V(OX + 7, 2.2, 6.5), V(OX + 7.2, 2.2, 6.8), V(OX - 1, 2.5, -4), V(OX - 1, 3, -5), 54), { whoosh: true }],
  [0.2, 'explosion-wide', fixed(V(OX - 14, 3.0, 13), V(OX - 15, 3.2, 14), V(OX, 6, -10), V(OX, 6.5, -10), 62)],
  [0.62, 'explosion-close', fixed(V(OX + 6.5, 1.3, 4.5), V(OX + 7, 1.2, 5.2), V(OX + 1.5, 5, -10), V(OX + 1.5, 5.5, -10), 64)],
]);
addShots('L26', [
  [0, 'safe-lineup', fixed(V(OX + 4.2, 2.0, -0.6), V(OX + 4.2, 1.9, -0.2), V(OX + 4.2, 1.2, 6.6), V(OX + 4.2, 1.2, 6.6), 60)],
  [0.52, 'you-dusty', cu(YOU, { w: 1.3, fov: 40, push: 0.08, yaw: -0.3 })],
]);
addShots('L27', [
  [0, 'boss-soot-medium', cu(BOSS, { w: 1.5, fov: 40, push: 0.06, ty: -0.35 })],
  [0.42, 'boss-soot-cu', cu(BOSS, { w: 0.95, wEnd: 0.75, fov: 36, push: 0.0 })],
]);
SHOTS.sort((a, b) => a.t0 - b.t0);
const shotAt = (t) => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

// ------------------------------------------------------------------ camera + environment per stage
let curShot = null;
function applyCamera(t) {
  const sh = shotAt(t); curShot = sh;
  const u = clamp((t - sh.t0) / Math.max(0.001, sh.t1 - sh.t0));
  const r = sh.fn(u, t);
  let shake = r.shake || 0;
  const cap = captionAt(t);
  if (cap && cap.loud) shake += 0.06 * (1 - smooth(cap.s, cap.s + 0.6, t));
  if (t >= tBoom() && t < tBoom() + 1.4) shake += 0.25 * (1 - smooth(tBoom(), tBoom() + 1.4, t));
  if (t >= B0('L21') && t < B0('L23')) shake += 0.015;
  camera.position.copy(r.pos); camera.up.set(0, 1, 0); camera.fov = r.fov; camera.updateProjectionMatrix();
  camera.lookAt(r.tgt);
  if (shake) { camera.position.add(V(noise1(t * 23, 1) * shake, noise1(t * 23, 7) * shake, 0)); camera.rotateZ(noise1(t * 19, 3) * shake * 0.3); }
  if (r.roll) camera.rotateZ(r.roll);
  // hide characters standing between the lens and the subject (close to the camera)
  const keep = new Set([r.subject, ...(r.keep || [])]);
  const a = r.pos, ab = r.tgt.clone().sub(a), L2 = ab.lengthSq();
  for (const c of ALL) {
    if (!c.root.visible || keep.has(c)) continue;
    c.root.updateMatrixWorld(true);
    for (const p of [c.head.getWorldPosition(V()), c.spine.localToWorld(V(0, 0.3, 0))]) {
      const tt = clamp(p.clone().sub(a).dot(ab) / L2, 0, 1);
      if (tt > 0.9) continue;
      const q = a.clone().addScaledVector(ab, tt);
      if ((q.distanceTo(p) < 0.45 && p.distanceTo(a) < 3.2) || p.distanceTo(a) < 0.5) { c.root.visible = false; break; }
    }
  }
  // sun follows the action
  sun.target.position.copy(r.tgt); sun.position.copy(r.tgt).add(V(-6, 12, 7));
  return sh;
}
function applyStage(t) {
  const night = stage === 'flashback';
  scene.background = stage === 'rain' ? new THREE.Color('#5e6a74') : night ? new THREE.Color('#0d1530') : SKY;
  homeWinM.color.set(night ? '#1b2a55' : '#bfe6ff');
  sun.intensity = stage === 'rain' ? 0.7 : night ? 0.4 : 2.3;
  hemi.intensity = stage === 'rain' ? 1.0 : night ? 0.9 : 1.3;
  hemi.color.set(night ? '#ffb070' : '#fff6e6');
  scene.fog = stage === 'rain' ? new THREE.FogExp2('#5e6a74', 0.03) : null;
}

// ------------------------------------------------------------------ overlay
function captionAt(t) { for (const c of TL.captions) if (t >= c.s && t < c.e) return c; return null; }
const noLig = (s) => s.replace(/f(?=[filt])/g, 'f‌');
function drawCaption(g, cap, t) {
  const age = t - cap.s;
  const big = cap.loud;
  let size = big ? 150 : 78;
  const pop = age < 0.12 ? lerp(big ? 1.6 : 1.2, 1.0, easeOutBack(age / 0.12)) : 1;
  const text = noLig(cap.text);
  g.font = `${size}px Pixelify`;
  let lines = [text];
  if (g.measureText(text).width > 950) { const w = text.split(' '); const m = Math.ceil(w.length / 2); lines = [w.slice(0, m).join(' '), w.slice(m).join(' ')]; const mw = Math.max(...lines.map(l => g.measureText(l).width)); if (mw > 950) { size = Math.floor(size * 950 / mw); g.font = `${size}px Pixelify`; } }
  let cx = W / 2, cy = H * 0.565;
  if (big) { const k = 1 - smooth(cap.s, cap.s + 0.7, t); cx += noise1(t * 40, 2) * 18 * k; cy += noise1(t * 40, 9) * 18 * k; }
  g.save(); g.translate(cx, cy); g.scale(pop, pop); g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = size * 1.1;
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    const R = big ? 10 : 6;
    g.fillStyle = '#000';
    for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; g.fillText(ln, Math.round(Math.cos(an) * R), y + Math.round(Math.sin(an) * R)); }
    g.fillStyle = big ? '#fff5d6' : '#ffffff'; g.fillText(ln, 0, y);
  });
  g.restore();
}
function project(p) { const v = p.clone().project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z]; }
function motionLines(g, center, dirX, n, len, t, rad = 0.4, col = 'rgba(255,255,255,0.92)') {
  const [x, y, z] = project(center); if (z > 1) return;
  const right = V(1, 0, 0).applyQuaternion(camera.quaternion);
  const [x2] = project(center.clone().addScaledVector(right, rad));
  const R = Math.max(40, Math.abs(x2 - x));
  const r = rng(Math.floor(t * 12));
  g.strokeStyle = col; g.lineWidth = Math.max(5, R * 0.05); g.lineCap = 'square';
  for (let i = 0; i < n; i++) { const yy = y + (r() - 0.5) * R * 1.4, xx = x - dirX * R * (1.0 + r() * 0.3); const L = R * len * (0.6 + r() * 0.6); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - dirX * L, yy); g.stroke(); }
}
function drawOverlay(t) {
  const g = octx; g.save(); g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  // flashback look
  if (stage === 'flashback') {
    g.fillStyle = 'rgba(255,170,90,0.16)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, 110); g.fillRect(0, H - 110, W, 110);
    const r = rng(Math.floor(t * 30)); g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) g.fillRect(r() * W, r() * H, 3, 3);
  }
  // freeze ("Silence."): slight desaturated cool tint
  const [fa, fb] = FREEZE(); if (t >= fa && t < fb) { g.fillStyle = 'rgba(160,190,200,0.14)'; g.fillRect(0, 0, W, H); }
  // rain
  if (stage === 'rain') {
    g.fillStyle = 'rgba(40,55,70,0.18)'; g.fillRect(0, 0, W, H);
    const r = rng(Math.floor(t * 30) + 1); g.strokeStyle = 'rgba(210,225,240,0.6)'; g.lineWidth = 4;
    for (let i = 0; i < 140; i++) { const x = r() * W * 1.2 - 100, y = r() * H, L = 50 + r() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x - L * 0.25, y + L); g.stroke(); }
  }
  // motion lines: hug squeeze, running workers, tank, cars
  const sh = curShot ? curShot.name : '';
  if (sh === 'hug-tight' || sh === 'you-squeezed-cu') { const p = headPos(YOU); motionLines(g, p, 1, 4, 0.5, t, 0.33); motionLines(g, p, -1, 4, 0.5, t, 0.33); }
  if (sh === 'workers-street' || sh === 'workers-door') WORKERS.forEach(c => { if (c.root.visible && c.running) motionLines(g, c.spine.getWorldPosition(V()), Math.sign(c.root.position.x - OX) || 1, 2, 0.7, t + c.phase, 0.4); });
  if (sh === 'tank-side' || sh === 'tank-road-front') motionLines(g, TANK.position.clone().add(V(-0.5, 1, 0)), 1, 4, 0.5, t, 2.6);
  if (sh === 'carry-side' || sh === 'carry-front') motionLines(g, YOU.spine.getWorldPosition(V()), 1, 3, 0.6, t, 0.5);
  // comic star-burst behind the explosion (old cartoon look)
  if (t >= tBoom() && t < tBoom() + 0.9) {
    const [bx, by, bz] = project(BOOM_AT);
    if (bz < 1) {
      const k = easeOutBack(Math.min(1, (t - tBoom()) / 0.18)), fade = 1 - smooth(tBoom() + 0.55, tBoom() + 0.9, t);
      const R = 520 * k, r0 = rng(5);
      for (const [col, sc] of [['rgba(255,90,40,', 1.0], ['rgba(255,214,58,', 0.72], ['rgba(255,255,230,', 0.42]]) {
        g.fillStyle = col + (0.9 * fade) + ')'; g.beginPath();
        for (let i = 0; i < 28; i++) { const an = i / 28 * Math.PI * 2 + 0.1, rr = R * sc * (i % 2 ? 0.55 : 1) * (0.85 + r0() * 0.3); g.lineTo(bx + Math.cos(an) * rr, by + Math.sin(an) * rr); }
        g.closePath(); g.fill();
      }
    }
  }
  // white flash at the boom
  const fl = 1 - smooth(tBoom(), tBoom() + 0.25, t); if (t >= tBoom() && fl > 0) { g.fillStyle = `rgba(255,250,230,${0.85 * fl})`; g.fillRect(0, 0, W, H); }
  // dust haze after
  if (stage === 'boom' && t > tBoom() + 0.3) { g.fillStyle = 'rgba(190,175,150,0.10)'; g.fillRect(0, 0, W, H); }
  // vignette
  const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.32, W / 2, H / 2, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const cap = captionAt(t); if (cap) drawCaption(g, cap, t);
  const fade = smooth(DUR - 1.3, DUR - 0.15, t); if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  g.restore();
}

// ------------------------------------------------------------------ frame
function update(t) {
  updateCharacters(t);
  updateProps(t);
  for (const c of ALL) c.face.update();
  scene.updateMatrixWorld(true);
  const sh = applyCamera(t);
  applyStage(t);
  updateEffects(t, camera.position);
  return sh;
}
window.renderFrame = (frame, fmt = 'jpeg') => {
  const t = frame / FPS;
  const sh = update(t);
  renderer.render(scene, camera);
  octx.drawImage(renderer.domElement, 0, 0, RW, RH);
  drawOverlay(t);
  window.__lastShot = sh.name; window.__cam = [camera.position.toArray().map(v => +v.toFixed(2)), camera.fov];
  return fmt === 'png' ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.94);
};
window.__ray = (frame) => {
  window.renderFrame(frame);
  const rc = new THREE.Raycaster(); rc.setFromCamera({ x: 0, y: 0 }, camera);
  const names = new Map(ALL.map((c, i) => [c.root, ['YOU', 'BOSS', 'W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'G0', 'G1'][i]]));
  const vis = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
  return rc.intersectObjects(scene.children, true).filter(h => vis(h.object)).slice(0, 6).map(h => { let o = h.object, n = '?'; while (o) { if (names.has(o)) { n = names.get(o) + (o.visible ? '' : '(hidden-root)'); break; } o = o.parent; } const chain = []; { let o3 = h.object; while (o3 && chain.length < 8) { chain.push((o3.type || '') + (o3 === BOSS.head ? '[BOSS.head]' : o3 === BOSS.headMesh ? '[BOSS.headMesh]' : o3 === YOU.head ? '[YOU.head]' : '') + ':' + o3.position.toArray().map(v => v.toFixed(2)).join('/')); o3 = o3.parent; } } const ws = h.object.getWorldScale(V()); const wp = h.point; let depth = 0, o2 = h.object; while (o2 && !names.has(o2)) { depth++; o2 = o2.parent; } return n + ' d=' + h.distance.toFixed(2) + ' scale=' + ws.toArray().map(v => v.toFixed(2)) + ' pos=' + wp.toArray().map(v => v.toFixed(2)) + ' depth=' + depth + ' chain=' + chain.join(' < '); });
};
window.__pos = (frame) => { window.renderFrame(frame); return { shot: window.__lastShot, cam: window.__cam, workers: WORKERS.map(c => c.root.visible ? c.root.position.toArray().map(v => +v.toFixed(1)) : 'hidden') }; };
window.getShots = () => SHOTS.map(s => ({ t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), name: s.name, whoosh: s.whoosh }));
window.getEvents = () => ({
  typing: [B0('L04'), S('L11') + 0.25 + 5 * 0.28], printJam: S('L12') + 0.35, plantFall: We('L13', 3), fired: Wd('L14', 0),
  sniffs: [Wd('L10', 3), Wd('L10', 4), Wd('L10', 5)], tank: [B0('L21'), B0('L23') - 0.2], fire: tFire(), boom: tBoom(),
  rain: [B0('L16'), B0('L17')], duration: DUR, frames: Math.round(DUR * FPS),
});
window.renderFrame(0);
window.READY = true;
