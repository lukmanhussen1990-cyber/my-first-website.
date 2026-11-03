// Wedding sets + props (low-poly, pixel-noisy textures, warm light). Each builder adds to W.scene and returns handles.
// Units: metres, +Y up. Places are far apart so they never see each other:
//   hall (origin), hallway (x = 60), bathroom (x = -60), kids' bathroom (x = 120).
import * as THREE from 'three';
import { mat, matNoisy, tex, paint, noisyCanvas, canvas, rng, hexToRgb, clamp } from './lib.js';
import { CHAIR } from './cast.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

// ------------------------------------------------------------------ textures
function stripes(c1, c2, n = 8, size = 32, seed = 3) {
  const a = hexToRgb(c1), b = hexToRgb(c2), R = rng(seed);
  return tex(paint(size, size, (x, y) => { const c = (Math.floor(x / (size / n)) & 1) ? a : b; const d = (R() - 0.5) * 10; return [c[0] + d, c[1] + d, c[2] + d]; }));
}
function planks(hex = '#9a6a3c', size = 64, seed = 5) {
  const base = hexToRgb(hex), R = rng(seed);
  const rows = 8, off = [];
  for (let i = 0; i < rows; i++) off.push(Math.floor(R() * size));
  const tone = []; for (let i = 0; i < rows * 4; i++) tone.push((R() - 0.5) * 34);
  return tex(paint(size, size, (x, y) => {
    const r = Math.floor(y / (size / rows)), seg = Math.floor(((x + off[r]) % size) / (size / 2));
    const edge = (y % (size / rows) === 0) || (((x + off[r]) % (size / 2)) === 0);
    const d = tone[r * 4 + seg] + (R() - 0.5) * 12 + (edge ? -40 : 0);
    return [base[0] + d, base[1] + d * 0.8, base[2] + d * 0.6];
  }));
}
function carpet(size = 64, seed = 9) {
  const a = hexToRgb('#7a1e2c'), b = hexToRgb('#b8893a'), R = rng(seed);
  return tex(paint(size, size, (x, y) => {
    const u = (x % 16) - 8, v = (y % 16) - 8, r = Math.abs(u) + Math.abs(v);
    const c = (r === 6 || r === 2) ? b : a;
    const d = (R() - 0.5) * 14; return [c[0] + d, c[1] + d, c[2] + d];
  }));
}
function marble(hex = '#ece4d6', size = 64, seed = 11) {
  const base = hexToRgb(hex), R = rng(seed);
  const vein = [];
  for (let i = 0; i < 4; i++) vein.push([R() * size, R() * 0.8 + 0.2, R() * 6]);
  return tex(paint(size, size, (x, y) => {
    let d = (R() - 0.5) * 8;
    for (const [x0, k, ph] of vein) { const yy = x0 + Math.sin(y * 0.15 + ph) * 6 + y * k; if (Math.abs(((x - yy) % size + size) % size) < 1.2) d -= 30; }
    if (x % 32 === 0 || y % 32 === 0) d -= 22;                                // tile joints
    return [base[0] + d, base[1] + d, base[2] + d * 1.05];
  }));
}
function tiles(hex = '#5aa7d8', size = 64, seed = 13) {
  const base = hexToRgb(hex), R = rng(seed);
  return tex(paint(size, size, (x, y) => {
    const j = (x % 16 === 0) || (y % 16 === 0);
    const d = j ? 90 : (R() - 0.5) * 16;
    return j ? [235, 240, 245] : [base[0] + d, base[1] + d, base[2] + d];
  }));
}
function wall(hex = '#efe2c8', trim = '#d8c39a', size = 32, seed = 15) {
  const a = hexToRgb(hex), b = hexToRgb(trim), R = rng(seed);
  return tex(paint(size, size, (x, y) => { const c = (x % 16 < 1) ? b : a; const d = (R() - 0.5) * 9; return [c[0] + d, c[1] + d, c[2] + d]; }));
}
export function textCanvas(w, h, draw) {
  const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ------------------------------------------------------------------ lights
export function lights(W, kind = 'hall') {
  const g = new THREE.Group(); W.scene.add(g);
  const L = {};
  const warm = kind !== 'kids';
  L.hemi = new THREE.HemisphereLight(warm ? 0xfff0dc : 0xeef6ff, warm ? 0x9a7a60 : 0xa0b0c0, kind === 'dark' ? 0.25 : 0.85); g.add(L.hemi);
  L.key = new THREE.DirectionalLight(warm ? 0xffe2b8 : 0xffffff, kind === 'dark' ? 0.25 : 1.6);
  L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048);
  L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.02; L.key.shadow.radius = 4;
  g.add(L.key); g.add(L.key.target);
  L.fill = new THREE.PointLight(0xffd6a8, kind === 'dark' ? 0 : 1.2, 12, 2); g.add(L.fill);
  W.lights = L;
  return L;
}
// aim the shadow-casting key light at a spot (shadow box sized to the shot)
export function keyAt(W, target, { from = [2.5, 6, 4], size = 4 } = {}) {
  const L = W.lights; const t = V(...target);
  L.key.position.copy(t).add(V(...from)); L.key.target.position.copy(t);
  Object.assign(L.key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 30 });
  L.key.shadow.camera.updateProjectionMatrix();
}
export function spot(W, pos, target, { color = 0xfff4e0, intensity = 60, angle = 0.32, cone = true, coneOpacity = 0.07 } = {}) {
  const s = new THREE.SpotLight(color, intensity, 30, angle, 0.45, 1.6);
  s.position.set(...pos); s.target.position.set(...target); s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0005;
  W.scene.add(s); W.scene.add(s.target);
  if (cone) {
    const h = V(...pos).distanceTo(V(...target)), r = Math.tan(angle) * h;
    const g = new THREE.ConeGeometry(r, h, 20, 1, true); g.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: coneOpacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(...pos); m.lookAt(...target); m.rotateX(-Math.PI / 2); W.scene.add(m);
  }
  return s;
}

// ------------------------------------------------------------------ furniture + props
const GOLD = () => mat('#d4a640', { rough: 0.35, metal: 0.75 });
export function goldChair(parent, x, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  const gm = GOLD(), cush = matNoisy('#f2ead8', { amount: 8 });
  add(g, M(boxG(0.42, 0.04, 0.4), gm), 0, CHAIR.seatY - 0.06, 0);
  add(g, M(boxG(0.4, 0.035, 0.38), cush), 0, CHAIR.seatY - 0.03, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, M(boxG(0.03, CHAIR.seatY - 0.06, 0.03), gm), sx * 0.18, 0, sz * 0.17);
  for (const sx of [-1, 1]) add(g, M(boxG(0.03, 0.5, 0.03), gm), sx * 0.18, CHAIR.seatY - 0.02, -0.18);
  for (let i = 0; i < 4; i++) add(g, M(boxG(0.36, 0.022, 0.022), gm), 0, CHAIR.seatY + 0.1 + i * 0.12, -0.18);
  return g;
}
export function roundTable(parent, x, z, { r = 0.85, centre = true, plates = 8, seed = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const cloth = matNoisy('#f7f3ea', { amount: 7, seed: 21 });
  add(g, M(new THREE.CylinderGeometry(r, r + 0.06, 0.74, 20).translate(0, 0.37, 0), cloth), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.025, 20).translate(0, 0.0125, 0), cloth), 0, 0.74, 0);
  const T = { group: g, topY: 0.765, r, seats: [] };
  if (centre) T.centre = centrepiece(g, 0, 0.765, 0, seed);
  for (let i = 0; i < plates; i++) {
    const a = (i / plates) * Math.PI * 2;
    plate(g, Math.sin(a) * (r - 0.22), 0.765, Math.cos(a) * (r - 0.22));
    flute(g, Math.sin(a + 0.25) * (r - 0.3), 0.765, Math.cos(a + 0.25) * (r - 0.3), { fill: 0.7 });
    T.seats.push({ x: x + Math.sin(a) * (r + 0.42), z: z + Math.cos(a) * (r + 0.42), rotY: a + Math.PI, a });
  }
  return T;
}
export function centrepiece(parent, x, y, z, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 8).translate(0, 0.21, 0), mat('#dfeef2', { rough: 0.1, transparent: true, opacity: 0.55 })), 0, 0, 0);
  const R = rng(seed + 50);
  const cols = ['#f6f2ee', '#f2b8c6', '#e88aa4', '#fffaf0'];
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, rr = 0.05 + R() * 0.17, h = 0.48 + R() * 0.22;
    add(g, M(new THREE.IcosahedronGeometry(0.045 + R() * 0.03, 0), mat(cols[i % 4], { rough: 0.8 })), Math.cos(a) * rr, h, Math.sin(a) * rr);
  }
  for (let i = 0; i < 8; i++) {
    const a = R() * Math.PI * 2;
    const l = add(g, M(new THREE.ConeGeometry(0.03, 0.14, 4), mat('#3f7a3a')), Math.cos(a) * 0.16, 0.48, Math.sin(a) * 0.16);
    l.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
  }
  return g;
}
export function plate(parent, x, y, z) {
  return add(parent, M(new THREE.CylinderGeometry(0.13, 0.1, 0.018, 14).translate(0, 0.009, 0), mat('#fbfaf6', { rough: 0.3 })), x, y, z);
}
const GLASS = () => mat('#eaf6ff', { rough: 0.05, metal: 0.1, transparent: true, opacity: 0.35 });
const BUBBLY = () => mat('#f0cf6a', { rough: 0.2, transparent: true, opacity: 0.8, emissive: '#6a5010', emissiveIntensity: 0.25 });
export function flute(parent, x, y, z, { fill = 0.7, tilt = 0, s = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = tilt; g.scale.setScalar(s); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 10).translate(0, 0.003, 0), GLASS()), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6).translate(0, 0.05, 0), GLASS()), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.033, 0.022, 0.15, 10, 1, true).translate(0, 0.175, 0), GLASS(), { cast: false }), 0, 0, 0);
  if (fill > 0) g.userData.liquid = add(g, M(new THREE.CylinderGeometry(0.022 + 0.01 * fill, 0.021, 0.14 * fill, 10).translate(0, 0.1 + 0.07 * fill, 0), BUBBLY(), { cast: false }), 0, 0, 0);
  return g;
}
export function bottle(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const gm = mat('#1f4a2a', { rough: 0.2, metal: 0.2 });
  add(g, M(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10).translate(0, 0.1, 0), gm), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.016, 0.045, 0.1, 10).translate(0, 0.25, 0), gm), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8).translate(0, 0.33, 0), mat('#d4a640', { rough: 0.3, metal: 0.7 })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.046, 0.046, 0.07, 10).translate(0, 0.08, 0), mat('#f2ead2')), 0, 0, 0);
  g.userData.grip = { pos: [0, 0.12, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function chandelier(parent, x, y, z, { r = 0.9, tiers = 2, lightOn = true, intensity = 6 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);       // y = ceiling attach point
  const gm = GOLD(), crys = mat('#f4fbff', { rough: 0.05, metal: 0.3, emissive: '#fff2d0', emissiveIntensity: 0.35 });
  const swing = new THREE.Group(); g.add(swing);
  add(swing, M(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6).translate(0, -0.45, 0), gm), 0, 0, 0);
  const R = rng(Math.round(x * 10 + z * 3) + 7);
  for (let t = 0; t < tiers; t++) {
    const yy = -0.95 - t * 0.38, rr = r * (1 - t * 0.35);
    const ring = M(new THREE.TorusGeometry(rr, 0.025, 5, 16), gm); ring.rotation.x = Math.PI / 2; add(swing, ring, 0, yy, 0);
    const n = 10 - t * 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      add(swing, M(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6).translate(0, 0.05, 0), mat('#fff6e6')), Math.cos(a) * rr, yy, Math.sin(a) * rr);
      add(swing, M(new THREE.SphereGeometry(0.035, 6, 4), mat('#ffe8b0', { emissive: '#ffd27a', emissiveIntensity: 2.2 }), { cast: false }), Math.cos(a) * rr, yy + 0.13, Math.sin(a) * rr);
      for (let k = 0; k < 3; k++) add(swing, M(new THREE.OctahedronGeometry(0.03 + R() * 0.02, 0), crys, { cast: false }), Math.cos(a + 0.3) * rr * 0.97, yy - 0.08 - k * 0.07, Math.sin(a + 0.3) * rr * 0.97);
    }
  }
  add(swing, M(new THREE.SphereGeometry(0.16, 8, 6), crys), 0, -0.95 - tiers * 0.38, 0);
  for (let k = 0; k < 4; k++) add(swing, M(new THREE.OctahedronGeometry(0.05, 0), crys, { cast: false }), 0, -1.15 - tiers * 0.38 - k * 0.1, 0);
  if (lightOn) { const pl = new THREE.PointLight(0xffcf8a, intensity, 14, 1.8); pl.position.set(0, -1.1, 0); swing.add(pl); g.userData.light = pl; }
  g.userData.swing = swing;
  return g;
}
export function djBooth(parent, x, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  add(g, M(boxG(1.7, 0.95, 0.7), matNoisy('#1c1c22', { amount: 10 })), 0, 0, 0);
  add(g, M(boxG(1.72, 0.04, 0.72), mat('#2a2a30', { rough: 0.4 })), 0, 0.95, 0);
  // front panel with light strips
  const strip = (c, y) => add(g, M(boxG(1.6, 0.04, 0.01), mat(c, { emissive: c, emissiveIntensity: 2 }), { cast: false }), 0, y, 0.355);
  strip('#ff3d9a', 0.25); strip('#3dd5ff', 0.45); strip('#ffd23d', 0.65);
  const tts = [];
  for (const sx of [-0.5, 0.5]) {
    add(g, M(boxG(0.5, 0.06, 0.42), mat('#3a3a42', { rough: 0.5 })), sx, 0.99, 0);
    const rec = add(g, M(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20).translate(0, 0.006, 0), mat('#111114', { rough: 0.3 })), sx, 1.05, 0);
    add(rec, M(new THREE.CylinderGeometry(0.05, 0.05, 0.004, 12).translate(0, 0.012, 0), mat('#e8463a')), 0, 0, 0);
    tts.push(rec);
  }
  // laptop
  const lap = new THREE.Group(); lap.position.set(0, 0.99, 0.05); g.add(lap);
  add(lap, M(boxG(0.32, 0.015, 0.22), mat('#c8ccd2', { rough: 0.3, metal: 0.6 })), 0, 0, 0);
  const scr = add(lap, M(new THREE.BoxGeometry(0.32, 0.22, 0.012), mat('#c8ccd2', { rough: 0.3, metal: 0.6 })), 0, 0.11, -0.11); scr.rotation.x = -0.25;
  const glow = add(lap, M(new THREE.PlaneGeometry(0.29, 0.19), mat('#5ad1ff', { emissive: '#3aa0ff', emissiveIntensity: 1.2 }), { cast: false }), 0, 0.11, -0.104); glow.rotation.x = -0.25;
  // speakers
  for (const sx of [-1.25, 1.25]) {
    add(g, M(boxG(0.45, 1.3, 0.4), matNoisy('#15151a', { amount: 8 })), sx, 0, -0.1);
    add(g, M(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 14).rotateX(Math.PI / 2), mat('#2c2c34')), sx, 0.9, 0.11);
    add(g, M(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12).rotateX(Math.PI / 2), mat('#2c2c34')), sx, 0.45, 0.11);
  }
  // party lights (little coloured heads on a bar)
  const lights = [];
  add(g, M(boxG(2.6, 0.05, 0.05), mat('#202024')), 0, 2.3, -0.2);
  ['#ff3d9a', '#3dd5ff', '#ffd23d', '#7dff6a'].forEach((c, i) => {
    const h = add(g, M(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 8), mat(c, { emissive: c, emissiveIntensity: 2.5 }), { cast: false }), -0.9 + i * 0.6, 2.18, -0.2);
    const pl = new THREE.PointLight(new THREE.Color(c), 1.2, 4, 2); pl.position.set(-0.9 + i * 0.6, 2.0, 0.3); g.add(pl); lights.push(pl);
  });
  return { group: g, turntables: tts, lights };
}
export function banner(parent, x, y, z, text = 'Just Married', { w = 3.6, h = 0.8 } = {}) {
  const t = textCanvas(1024, 228, (g, W, H) => {
    g.fillStyle = '#d9b24c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,240,180,${Math.random() * 0.25})`; g.fillRect(Math.random() * W, Math.random() * H, 4, 4); }
    g.strokeStyle = '#8a6420'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28);
    g.fillStyle = '#4a2a10'; g.font = 'italic bold 130px "DejaVu Serif"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 6);
  });
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  add(g, M(new THREE.BoxGeometry(w, h, 0.03), [mat('#d9b24c'), mat('#d9b24c'), mat('#d9b24c'), mat('#d9b24c'), mat(t, { rough: 0.6, flat: false }), mat('#d9b24c')]), 0, 0, 0);
  for (const sx of [-1, 1]) add(g, M(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4).translate(0, 0.6, 0), mat('#7a5a2a')), sx * w * 0.45, h / 2, -0.02);
  // bunting
  for (let i = 0; i < 9; i++) {
    const f = M(new THREE.ConeGeometry(0.1, 0.22, 3), mat(['#f2b8c6', '#ffffff', '#e8c45a'][i % 3]));
    f.rotation.x = Math.PI; add(g, f, -w * 0.55 + i * (w * 1.1 / 8), -h / 2 - 0.2 - Math.sin((i / 8) * Math.PI) * 0.15, 0.04);
  }
  return g;
}
export function placeCard(parent, x, y, z, text = 'Reserved: Mom', rotY = 0) {
  const t = textCanvas(512, 256, (g, W, H) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9a04a'; g.lineWidth = 8; g.strokeRect(12, 12, W - 24, H - 24);
    g.fillStyle = '#2a1e14'; g.font = 'italic bold 54px "DejaVu Serif"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 4);
  });
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
  const cm = mat('#fbf8f0');
  const front = M(new THREE.PlaneGeometry(0.22, 0.11), mat(t, { flat: false, rough: 0.7 })); front.position.set(0, 0.052, 0.024); front.rotation.x = -0.42; g.add(front);
  const tent = M(new THREE.BoxGeometry(0.22, 0.12, 0.004), cm); tent.position.set(0, 0.05, 0.02); tent.rotation.x = -0.42; tent.scale.set(0.99, 0.99, 1); g.add(tent);
  front.position.z += 0.003;
  const back = M(new THREE.BoxGeometry(0.22, 0.12, 0.004), cm); back.position.set(0, 0.05, -0.02); back.rotation.x = 0.42; g.add(back);
  return g;
}
export function phone(parent) {
  const g = new THREE.Group(); parent.add(g);
  const t = textCanvas(256, 512, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a6fdb'); gr.addColorStop(1, '#7a4ad8'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const cols = ['#3ddc84', '#ff5a5a', '#ffcc33', '#33b5ff', '#ffffff', '#ff8a3d', '#b05aff', '#2ad1c8'];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) {
      c.fillStyle = cols[(r * 4 + k) % cols.length];
      const x = 22 + k * 58, y = 70 + r * 72; c.beginPath(); c.roundRect(x, y, 42, 42, 10); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.roundRect(20, H - 70, W - 40, 50, 18); c.fill();
    c.fillStyle = '#fff'; c.fillRect(W / 2 - 30, 22, 60, 8);
  });
  add(g, M(new THREE.BoxGeometry(0.075, 0.155, 0.009), mat('#1a1a1e', { rough: 0.3 })), 0, 0, 0);
  const scr = add(g, M(new THREE.PlaneGeometry(0.066, 0.142), mat(t, { flat: false, rough: 0.3, emissive: '#ffffff', emissiveIntensity: 0.0 }), { cast: false }), 0, 0, 0.0047);
  scr.material.emissiveMap = t; scr.material.emissiveIntensity = 0.55; scr.material.emissive = new THREE.Color('#ffffff');
  g.userData.grip = { pos: [0, -0.03, -0.012], axis: [0, 1, 0], up: [0, 0, -1] };
  return g;
}
export function toiletRoll(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 14).translate(0, 0, 0), matNoisy('#fbfbf8', { amount: 6 })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.022, 0.022, 0.112, 10), mat('#a07a4a')), 0, 0, 0);
  const tail = add(g, M(new THREE.BoxGeometry(0.1, 0.08, 0.004), matNoisy('#fbfbf8', { amount: 6 })), 0, -0.06, 0.058); tail.rotation.x = 0.2;
  g.userData.grips = { L: { pos: [0.065, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] }, R: { pos: [-0.065, 0, 0], axis: [0, 0, -1], up: [0, 1, 0] } };
  return g;
}
export function cake(parent) {
  const g = new THREE.Group(); parent.add(g);
  const icing = matNoisy('#fbf7f0', { amount: 6 });
  add(g, M(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20).translate(0, 0.0125, 0), mat('#e8e2d6', { rough: 0.3, metal: 0.4 })), 0, 0, 0);
  [[0.24, 0.2], [0.18, 0.18], [0.12, 0.16]].reduce((y, [r, h]) => {
    add(g, M(new THREE.CylinderGeometry(r, r, h, 16).translate(0, h / 2, 0), icing), 0, y, 0);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(g, M(new THREE.SphereGeometry(0.018, 5, 4), mat('#f2b8c6')), Math.cos(a) * r, y + h, Math.sin(a) * r); }
    return y + h;
  }, 0.025);
  // little couple on top
  add(g, M(boxG(0.03, 0.09, 0.025), mat('#1d1d22')), -0.025, 0.565, 0);
  add(g, M(boxG(0.035, 0.08, 0.03), mat('#ffffff')), 0.025, 0.565, 0);
  g.userData.grips = { L: { pos: [0.3, 0.0, 0], axis: [0, 0, 1], up: [0, 1, 0] }, R: { pos: [-0.3, 0.0, 0], axis: [0, 0, -1], up: [0, 1, 0] } };
  return g;
}
export function highChair(parent, x, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  const w = matNoisy('#f4f0e6', { amount: 8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = add(g, M(boxG(0.035, 0.75, 0.035), w), sx * 0.2, 0, sz * 0.2); l.rotation.set(sz * 0.08, 0, -sx * 0.08); }
  add(g, M(boxG(0.38, 0.05, 0.38), w), 0, 0.72, 0);
  add(g, M(boxG(0.38, 0.45, 0.04), w), 0, 0.77, -0.18);
  add(g, M(boxG(0.44, 0.04, 0.3), w), 0, 0.98, 0.22);
  return g;
}
export function podium(parent, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const cols = ['#e8c23a', '#c8ccd4', '#c98a4a'];
  [[0, 0.5], [-0.62, 0.32], [0.62, 0.2]].forEach(([dx, h], i) => add(g, M(boxG(0.6, h, 0.55), matNoisy(cols[i], { amount: 10 })), dx, 0, 0));
  return g;
}
export function medal(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 12).rotateX(Math.PI / 2), mat('#e8c23a', { rough: 0.25, metal: 0.8 })), 0, 0, 0);
  return g;
}
export function walkingStick(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 0.86, 6).translate(0, 0.43, 0), mat('#5a3a20')), 0, 0, 0);
  const h = add(g, M(new THREE.TorusGeometry(0.05, 0.013, 5, 8, Math.PI), mat('#5a3a20')), -0.05, 0.86, 0); h.rotation.z = 0;
  g.userData.grip = { pos: [-0.02, 0.9, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  return g;
}

// ------------------------------------------------------------------ places
// The hall: floor (dance floor in the middle), walls, ceiling, chandeliers, tables, DJ, banner, flower arch.
export function buildHall(W, o = {}) {
  const g = new THREE.Group(); W.scene.add(g);
  const H = { group: g, tables: [], chandeliers: [] };
  const X = 9, Z0 = -11, Z1 = 9, CEIL = 5.2;
  add(g, M(new THREE.PlaneGeometry(2 * X, Z1 - Z0).rotateX(-Math.PI / 2), mat(carpet(), { rough: 0.95 }).clone()), 0, 0, (Z0 + Z1) / 2).material.map.repeat.set(9, 10);
  const df = add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), mat(planks('#b07a46'), { rough: 0.35 })), 0, 0.004, -2);
  df.material.map.repeat.set(4, 4);
  const wm = mat(wall(), { rough: 0.9 }); wm.map.repeat.set(10, 2);
  const wall1 = (w, x, z, ry) => { const m = add(g, M(new THREE.PlaneGeometry(w, CEIL), wm), x, CEIL / 2, z); m.rotation.y = ry; return m; };
  wall1(2 * X, 0, Z0, 0); wall1(2 * X, 0, Z1, Math.PI); wall1(Z1 - Z0, -X, (Z0 + Z1) / 2, Math.PI / 2); wall1(Z1 - Z0, X, (Z0 + Z1) / 2, -Math.PI / 2);
  const wains = mat(stripes('#d8c39a', '#cdb68a', 16), { rough: 0.8 });
  for (const [w, x, z, ry] of [[2 * X, 0, Z0 + 0.01, 0], [Z1 - Z0, -X + 0.01, (Z0 + Z1) / 2, Math.PI / 2], [Z1 - Z0, X - 0.01, (Z0 + Z1) / 2, -Math.PI / 2]]) {
    const m = add(g, M(new THREE.PlaneGeometry(w, 1.0), wains), x, 0.5, z); m.rotation.y = ry;
  }
  const ceil = add(g, M(new THREE.PlaneGeometry(2 * X, Z1 - Z0).rotateX(Math.PI / 2), matNoisy('#f4ead6', { amount: 6 })), 0, CEIL, (Z0 + Z1) / 2);
  // windows / drapes on the left wall
  for (let i = 0; i < 4; i++) {
    const z = Z0 + 3 + i * 4.5;
    add(g, M(new THREE.BoxGeometry(0.05, 2.6, 1.4), mat('#203050', { emissive: '#1a2a4a', emissiveIntensity: 0.6 })), -X + 0.03, 1.2, z);
    for (const s of [-1, 1]) add(g, M(boxG(0.12, 3.6, 0.45), matNoisy('#8a1e2c', { amount: 14 })), -X + 0.1, 0.4, z + s * 0.85);
  }
  // hallway opening on the right wall (dark, leads to the bathroom)
  add(g, M(new THREE.BoxGeometry(0.06, 2.6, 1.8), mat('#3a2a20', { emissive: '#2a1a10', emissiveIntensity: 0.3 })), X - 0.03, 1.3, 2.5);
  add(g, M(new THREE.BoxGeometry(0.12, 0.18, 2.1), GOLD()), X - 0.06, 2.65, 2.5);
  // chandeliers
  for (const [x, z] of o.chandeliers ?? [[0, -2], [-5, -6], [5, -6], [-5, 3], [5, 3]]) H.chandeliers.push(chandelier(g, x, CEIL, z, { intensity: o.chandelierI ?? 6 }));
  // tables
  for (const [x, z, seed] of o.tables ?? [[-5, -6, 1], [5, -6, 2], [-5.5, -1.5, 3], [5.5, -1.5, 4], [-5, 3, 5], [5, 3, 6], [-1.8, 4.5, 7], [1.8, 4.5, 8]]) {
    const T = roundTable(g, x, z, { seed, plates: o.plates ?? 8, centre: o.centre ?? true });
    if (o.chairs !== false) T.chairs = T.seats.map((s) => goldChair(g, s.x, s.z, s.rotY));
    H.tables.push(T);
  }
  if (o.dj !== false) H.dj = djBooth(g, 0, -9.3);
  if (o.banner !== false) H.banner = banner(g, 0, 3.4, Z0 + 0.06);
  // flower arch behind the dance floor
  if (o.arch !== false) {
    const am = matNoisy('#f6f2ee', { amount: 8 });
    const arch = M(new THREE.TorusGeometry(1.6, 0.12, 6, 18, Math.PI), am); add(g, arch, 3.6, 0, -9.6);
    const R = rng(77);
    for (let i = 0; i < 40; i++) { const a = R() * Math.PI; add(g, M(new THREE.IcosahedronGeometry(0.09, 0), mat(['#f2b8c6', '#ffffff', '#e88aa4'][i % 3])), 3.6 + Math.cos(a) * 1.6, Math.sin(a) * 1.6, -9.55); }
  }
  H.CEIL = CEIL; H.X = X; H.Z0 = Z0; H.Z1 = Z1;
  return H;
}

// Hallway to the bathroom: carpet runner, wall lamps, vases, the bathroom door at the far end (z = -12).
export function buildHallway(W, { x0 = 60 } = {}) {
  const g = new THREE.Group(); g.position.x = x0; W.scene.add(g);
  const Wd = 2.6, L = 14, CEIL = 3.0;
  add(g, M(new THREE.PlaneGeometry(Wd, L).rotateX(-Math.PI / 2), mat(planks('#7a5232'), { rough: 0.5 })), 0, 0, -L / 2 + 1).material.map.repeat.set(1, 6);
  add(g, M(new THREE.PlaneGeometry(1.2, L).rotateX(-Math.PI / 2), mat(carpet(), { rough: 0.95 })), 0, 0.005, -L / 2 + 1).material.map.repeat.set(1, 8);
  const wm = mat(wall('#efe0c4', '#d9c49e'), { rough: 0.9 }); wm.map.repeat.set(6, 1);
  for (const s of [-1, 1]) {
    const m = add(g, M(new THREE.PlaneGeometry(L, CEIL), wm), s * Wd / 2, CEIL / 2, -L / 2 + 1); m.rotation.y = -s * Math.PI / 2;
    const wn = add(g, M(new THREE.PlaneGeometry(L, 0.9), mat(stripes('#8a5a3a', '#7a4a2a', 16), { rough: 0.8 })), s * (Wd / 2 - 0.01), 0.45, -L / 2 + 1); wn.rotation.y = -s * Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const z = -1 - i * 3;
      add(g, M(new THREE.BoxGeometry(0.08, 0.3, 0.2), GOLD()), s * (Wd / 2 - 0.05), 1.9, z);
      add(g, M(new THREE.ConeGeometry(0.12, 0.2, 6), mat('#fff0c8', { emissive: '#ffd890', emissiveIntensity: 1.6 }), { cast: false }), s * (Wd / 2 - 0.15), 2.1, z);
      const pl = new THREE.PointLight(0xffc880, 1.6, 4, 2); pl.position.set(s * (Wd / 2 - 0.3), 2.0, z); g.add(pl);
      if (i % 2 === 0) { add(g, M(boxG(0.35, 0.8, 0.35), matNoisy('#d8c8a8', { amount: 8 })), s * (Wd / 2 - 0.25), 0, z - 1.5); centrepiece(g, s * (Wd / 2 - 0.25), 0.8, z - 1.5, i + 3); }
    }
  }
  add(g, M(new THREE.PlaneGeometry(Wd, L).rotateX(Math.PI / 2), matNoisy('#f2e8d4', { amount: 6 })), 0, CEIL, -L / 2 + 1);
  // end wall + door
  const endZ = -L + 1;
  add(g, M(new THREE.PlaneGeometry(Wd, CEIL), wm), 0, CEIL / 2, endZ);
  const door = add(g, M(boxG(1.0, 2.15, 0.06), mat(planks('#4a2a18', 32, 3), { rough: 0.6 })), 0, 0, endZ + 0.04);
  for (const s of [-1, 1]) add(g, M(boxG(0.1, 2.25, 0.1), mat('#3a2010')), s * 0.55, 0, endZ + 0.05);
  add(g, M(boxG(1.2, 0.1, 0.1), mat('#3a2010')), 0, 2.2, endZ + 0.05);
  add(g, M(new THREE.SphereGeometry(0.035, 6, 4), GOLD()), 0.38, 1.05, endZ + 0.1);
  // restroom sign: a gold plate with a little man symbol (no words)
  const sign = textCanvas(128, 128, (c, w, h) => {
    c.fillStyle = '#d9b24c'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a2410';
    c.beginPath(); c.arc(64, 30, 13, 0, Math.PI * 2); c.fill(); c.fillRect(46, 48, 36, 40); c.fillRect(48, 86, 12, 30); c.fillRect(68, 86, 12, 30);
  });
  add(g, M(new THREE.BoxGeometry(0.22, 0.22, 0.02), [GOLD(), GOLD(), GOLD(), GOLD(), mat(sign, { flat: false, rough: 0.4 }), GOLD()]), 0, 1.65, endZ + 0.08);
  const pl = new THREE.PointLight(0xffd29a, 2.5, 5, 2); pl.position.set(0, 2.5, endZ + 1.2); g.add(pl);
  return { group: g, x0, endZ, doorPos: [x0, 1.1, endZ + 0.08], doorTop: [x0, 2.15, endZ + 0.08], doorBottom: [x0, 0.05, endZ + 0.1] };
}

// Fancy marble bathroom with a row of dark-wood toilet stalls. Stall 0 is YOU's (door closed, gap under it).
export function buildBathroom(W, { x0 = -60, doorOpen = false } = {}) {
  const g = new THREE.Group(); g.position.x = x0; W.scene.add(g);
  const mm = mat(marble(), { rough: 0.3 }); mm.map.repeat.set(6, 6);
  add(g, M(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mm), 0, 0, 0);
  const wmm = mat(marble('#e6dccb', 64, 17), { rough: 0.35 }); wmm.map.repeat.set(5, 2);
  for (const [w, x, z, ry] of [[8, 0, -1.6, 0], [8, -4, 2.4, Math.PI / 2], [8, 4, 2.4, -Math.PI / 2], [8, 0, 4.5, Math.PI]]) { const m = add(g, M(new THREE.PlaneGeometry(w, 3.2), wmm), x, 1.6, z); m.rotation.y = ry; }
  add(g, M(new THREE.PlaneGeometry(8, 8).rotateX(Math.PI / 2), matNoisy('#f4ecdc', { amount: 5 })), 0, 3.2, 0);
  const wood = mat(planks('#4a2a18', 32, 7), { rough: 0.55 });
  // stalls: depth 1.5 (z -1.6 .. -0.1), width 0.95, partitions 0.15 above the floor up to 2.0
  const S = { group: g, stalls: [] };
  for (let i = -2; i <= 2; i++) {
    const cx = i * 1.0;
    for (const s of [-1, 1]) add(g, M(boxG(0.04, 1.85, 1.5), wood), cx + s * 0.5, 0.15, -0.85);
    const door = new THREE.Group(); door.position.set(cx - 0.45, 0.15, -0.1); g.add(door);
    add(door, M(boxG(0.9, 1.85, 0.04), wood), 0.45, 0, 0);
    add(door, M(new THREE.BoxGeometry(0.05, 0.12, 0.03), GOLD()), 0.8, 0.95, 0.04);
    if (i === 0 && doorOpen) door.rotation.y = -1.2;
    S.stalls.push({ cx, door });
    // toilet inside
    add(g, M(boxG(0.38, 0.4, 0.5), mat('#fbfbf8', { rough: 0.2 })), cx, 0, -1.25);
    add(g, M(boxG(0.4, 0.05, 0.52), mat('#fbfbf8', { rough: 0.2 })), cx, 0.4, -1.24);
    add(g, M(boxG(0.42, 0.45, 0.18), mat('#fbfbf8', { rough: 0.2 })), cx, 0.4, -1.52);
  }
  add(g, M(boxG(5.1, 0.06, 0.08), GOLD()), 0, 2.0, -0.1);           // top rail
  // sinks / mirror on the side
  add(g, M(boxG(0.08, 1.0, 2.4), wmm), 3.9, 1.2, 2.2);
  const pl = new THREE.PointLight(0xffe0b0, 3.0, 8, 2); pl.position.set(0, 2.8, 1.2); g.add(pl);
  const pl2 = new THREE.PointLight(0xffe0b0, 1.6, 4, 2); pl2.position.set(0, 2.4, -0.9); g.add(pl2);
  S.x0 = x0; S.seat = [x0, -1.05];                                   // where YOU sits (facing +z, on the closed lid)
  return S;
}

// Bright kids' bathroom with blue tiles (twist shots).
export function buildKidsBath(W, { x0 = 120 } = {}) {
  const g = new THREE.Group(); g.position.x = x0; W.scene.add(g);
  const tm = mat(tiles('#5aa7d8'), { rough: 0.3 }); tm.map.repeat.set(5, 2);
  const fm = mat(tiles('#f4f4f0', 64, 5), { rough: 0.3 }); fm.map.repeat.set(5, 5);
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), fm), 0, 0, 0);
  for (const [w, x, z, ry] of [[6, 0, -2, 0], [6, -3, 1, Math.PI / 2], [6, 3, 1, -Math.PI / 2]]) { const m = add(g, M(new THREE.PlaneGeometry(w, 3), tm), x, 1.5, z); m.rotation.y = ry; }
  add(g, M(boxG(0.4, 0.38, 0.5), mat('#ffffff', { rough: 0.2 })), -1.6, 0, -1.6);
  add(g, M(boxG(0.42, 0.42, 0.18), mat('#ffffff', { rough: 0.2 })), -1.6, 0.38, -1.9);
  add(g, M(boxG(0.7, 0.85, 0.45), mat('#ffffff', { rough: 0.2 })), 1.6, 0, -1.75);
  // rubber duck + towel
  add(g, M(new THREE.SphereGeometry(0.08, 6, 5), mat('#ffd23a')), 1.5, 0.92, -1.7);
  add(g, M(boxG(0.5, 0.7, 0.04), matNoisy('#ff8ab0', { amount: 10 })), 0.5, 0.9, -1.97);
  const pl = new THREE.PointLight(0xffffff, 2.2, 8, 2); pl.position.set(0, 2.6, 1); g.add(pl);
  return { group: g, x0 };
}
