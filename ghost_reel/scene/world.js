// "What if your balls doubled" world: bright daylight low-poly city (pale blue-grey buildings with dark windows,
// green grass, grey roads), props (kitchen scale, platform scale, cement bag, cars, tanks, chains), the giant tan
// spheres, the highway jam, mountains, the balance scale, space with the Earth, the black hole.
// Units: metres, +Y up. Places are far apart along x so they never see each other.
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp, hash1 } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const basic = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: hex, fog: o.fog ?? true, ...o });

export const PAL = {
  sky: '#8fb8e2', horizon: '#dde7ee', grass: '#9cbf88', road: '#9095a0', pave: '#c6cad1', walls: ['#aab6c7', '#c7ccd4', '#b9c3d2', '#d6d8dc'],
  win: '#1e2336', winLit: '#bcd9ef', navy: '#2a3048', tan: '#dfb18b', olive: '#5d6b3a',
};
export const PLACES = { street: 0, kitchen: 300, scale: 600, army: 900, big: 1500, news: 2000, hwy: 3000, mtn: 6000, bal: 12000, space: 15000 };

// ------------------------------------------------------------------ canvases / textures
function canvasTex(w, h, draw, { repeat = [1, 1], linear = true } = {}) {
  const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h);
  return tex(c, { repeat, nearest: !linear, mip: true });
}
function noiseFill(g, w, h, hex, amount, seed, cell = 4) {
  const R = rng(seed), b = hexToRgb(hex);
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const d = (R() - 0.5) * amount; g.fillStyle = `rgb(${b[0] + d | 0},${b[1] + d | 0},${b[2] + d | 0})`; g.fillRect(x, y, cell, cell);
  }
}
export function grassTex(rep = 40) { return canvasTex(64, 64, (g) => noiseFill(g, 64, 64, PAL.grass, 10, 3, 4), { repeat: [rep, rep] }); }
// building facade: bays x floors; tall dark windows, some pale-blue ones, a thin band between floors
const _fac = new Map();
export function facadeTex(wall, seed = 1, { bays = 4, floors = 4, lit = 0.22 } = {}) {
  const key = wall + seed + bays + floors;
  if (!_fac.has(key)) _fac.set(key, canvasTex(256, 256, (g) => {
    const R = rng(seed);
    g.fillStyle = wall; g.fillRect(0, 0, 256, 256);
    const bw = 256 / bays, fh = 256 / floors;
    for (let f = 0; f < floors; f++) {
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, f * fh + fh - 5, 256, 5);
      for (let b = 0; b < bays; b++) {
        g.fillStyle = R() < lit ? PAL.winLit : PAL.win;
        g.fillRect(b * bw + bw * 0.28, f * fh + fh * 0.16, bw * 0.44, fh * 0.6);
      }
    }
  }));
  return _fac.get(key);
}
// a facade with many small windows (far white city blocks)
export function smallWinTex(wall = '#eceef0', seed = 3) {
  return canvasTex(128, 128, (g) => {
    const R = rng(seed); g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { g.fillStyle = R() < 0.15 ? '#9ab4cc' : '#3a3f52'; g.fillRect(x * 16 + 4, y * 8 + 2, 8, 4); }
  });
}

// ------------------------------------------------------------------ light + sky
export function day(W, { at = [0, 0, 0], size = 10, from = [-7, 14, 9], hemi = 1.25, sun = 2.2, fog = [60, 260], far = 400, sky = true, shadow = 2048 } = {}) {
  const L = {};
  L.hemi = new THREE.HemisphereLight(0xe2ecff, 0xa6b894, hemi); W.scene.add(L.hemi);
  L.sun = new THREE.DirectionalLight(0xfff3e4, sun); L.sun.castShadow = true; L.sun.shadow.mapSize.set(shadow, shadow);
  L.sun.shadow.bias = -0.0005; L.sun.shadow.normalBias = 0.03; L.sun.shadow.radius = 5;
  const t = V(...at); L.sun.position.copy(t).add(V(...from).normalize().multiplyScalar(Math.max(size * 3, 20))); L.sun.target.position.copy(t);
  Object.assign(L.sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: Math.max(size * 8, 80) });
  L.sun.shadow.camera.updateProjectionMatrix();
  W.scene.add(L.sun); W.scene.add(L.sun.target);
  W.lights = L;
  if (fog) W.scene.fog = new THREE.Fog(PAL.horizon, fog[0], fog[1]);
  if (sky) skyDome(W, at, far * 0.9);
  W.scene.background = new THREE.Color(PAL.horizon);
  return L;
}
export function skyDome(W, at, r) {
  const c = canvas(8, 256), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#6f9fd6'); gr.addColorStop(0.3, PAL.sky); gr.addColorStop(0.5, PAL.horizon); gr.addColorStop(1, '#c8d2c4');
  x.fillStyle = gr; x.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  s.position.set(at[0], 0, at[2]); s.renderOrder = -10; W.scene.add(s); return s;
}

// ------------------------------------------------------------------ buildings
export function building(parent, x, z, w, h, d, { wall, seed = 1, ry = 0, bay = 3, floor = 3.2, lit, roof = true } = {}) {
  wall = wall || PAL.walls[seed % PAL.walls.length];
  const t = facadeTex(wall, seed, { lit: lit ?? 0.22 }).clone(); t.needsUpdate = true;
  const tF = t; tF.repeat.set(Math.max(1, Math.round(w / bay)) / 4, Math.max(1, Math.round(h / floor)) / 4);
  const tS = t.clone(); tS.needsUpdate = true; tS.repeat.set(Math.max(1, Math.round(d / bay)) / 4, Math.max(1, Math.round(h / floor)) / 4);
  const mF = mat(tF, { rough: 0.9 }), mS = mat(tS, { rough: 0.9 }), mT = mat(new THREE.Color(wall).multiplyScalar(0.92).getHex(), { rough: 0.95 });
  const b = M(boxG(w, h, d), [mS, mS, mT, mT, mF, mF]); b.position.set(x, 0, z); b.rotation.y = ry; parent.add(b);
  if (roof) { const r = M(boxG(w + 0.3, 0.35, d + 0.3), mT); r.position.set(0, h, 0); b.add(r); }
  return b;
}
export function house(parent, x, z, { w = 6, h = 4, d = 6, ry = 0, wall = '#eceae6', roofC = '#c0463a', seed = 1 } = {}) {
  const g = grp(parent, x, 0, z, ry);
  add(g, M(boxG(w, h, d), mat(facadeTex(wall, seed, { bays: 2, floors: 1, lit: 0.1 }))));
  const rf = new THREE.CylinderGeometry(0.01, w * 0.62, h * 0.45, 4, 1); rf.rotateY(Math.PI / 4); rf.scale(1, 1, d / w);
  add(g, M(rf, mat(roofC)), 0, h + h * 0.225, 0);
  return g;
}
export function lampPost(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry), m = mat(PAL.navy, { rough: 0.6 });
  add(g, M(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6).translate(0, 2.3, 0), m));
  add(g, M(new THREE.BoxGeometry(1.2, 0.09, 0.09), m), 0.55, 4.55, 0);
  add(g, M(new THREE.BoxGeometry(0.4, 0.12, 0.22), m), 1.1, 4.45, 0);
  return g;
}
export function busShelter(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry), m = mat(PAL.navy, { rough: 0.6 });
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.6, 0.6]) add(g, M(new THREE.BoxGeometry(0.08, 2.5, 0.08).translate(0, 1.25, 0), m), sx, 0, sz);
  add(g, M(new THREE.BoxGeometry(3.1, 0.1, 1.5), m), 0, 2.5, 0);
  add(g, M(new THREE.PlaneGeometry(2.8, 1.9), mat('#c8dcec', { transparent: true, opacity: 0.45, rough: 0.1 })), 0, 1.25, -0.6);
  add(g, M(new THREE.BoxGeometry(2.4, 0.08, 0.4), mat('#8a6a4a')), 0, 0.5, -0.35);
  return g;
}

// ------------------------------------------------------------------ the street (where it all starts)
// He stands at the origin facing +z; pavement around, a row of buildings behind (facades at z = -7), road between.
export function buildStreet(W, { x0 = PLACES.street, lamp = true, shelter = false } = {}) {
  const g = grp(W.scene, x0); const S = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), mat(grassTex(150), { rough: 1 }), { cast: false }), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(60, 5).rotateX(-Math.PI / 2), mat('#c3c7ce', { rough: 0.95 }), { cast: false }), 0, 0.01, -2.2);
  add(g, M(new THREE.PlaneGeometry(200, 7).rotateX(-Math.PI / 2), mat(PAL.road, { rough: 0.95 }), { cast: false }), 0, 0.008, 9);
  for (let x = -90; x < 90; x += 5) add(g, M(new THREE.PlaneGeometry(2.2, 0.16).rotateX(-Math.PI / 2), mat('#eceae4'), { cast: false }), x, 0.012, 9);
  add(g, M(new THREE.PlaneGeometry(200, 1.2).rotateX(-Math.PI / 2), mat('#b5bac2'), { cast: false }), 0, 0.03, 5.0);
  // buildings behind (two rows) and on the far side of the road
  const R = rng(5);
  let x = -40;
  while (x < 40) { const w = 8 + R() * 6, h = 11 + R() * 10; building(g, x + w / 2, -11, w - 0.8, h, 8, { seed: 2 + Math.floor(R() * 40) }); x += w; }
  x = -60;
  while (x < 60) { const w = 9 + R() * 8, h = 18 + R() * 20; building(g, x + w / 2, -26, w - 1, h, 10, { seed: 50 + Math.floor(R() * 40) }); x += w; }
  x = -60;
  while (x < 60) { const w = 9 + R() * 7, h = 10 + R() * 12; building(g, x + w / 2, 19, w - 1, h, 8, { seed: 90 + Math.floor(R() * 40), ry: Math.PI }); x += w; }
  if (lamp) { lampPost(g, 2.6, -3.6); lampPost(g, -9, -3.6); }
  if (shelter) S.shelter = busShelter(g, 3.8, -4.2);
  return S;
}

// ------------------------------------------------------------------ kitchen scale (40 g)
export function digitScreen(w, h, { color = '#7ff0b8', bg = '#141b21', font = 'Nunito Black', glow = true } = {}) {
  const c = canvas(w, h), x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (txt) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.font = `900 ${Math.round(h * 0.62)}px "${font}", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (glow) { x.shadowColor = color; x.shadowBlur = h * 0.12; }
    x.fillStyle = color; x.fillText(txt, w / 2, h * 0.54); x.shadowBlur = 0; t.needsUpdate = true;
  };
  draw('');
  return { t, draw };
}
export function buildKitchen(W, { x0 = PLACES.kitchen } = {}) {
  const g = grp(W.scene, x0); const K = { g, x0 };
  const wood = canvasTex(128, 128, (x) => { noiseFill(x, 128, 128, '#b4703e', 18, 9, 2); x.strokeStyle = 'rgba(80,40,20,0.35)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, 6 + i * 14); x.bezierCurveTo(40, 2 + i * 14, 80, 12 + i * 14, 128, 6 + i * 14); x.stroke(); } }, { repeat: [3, 2] });
  add(g, M(boxG(3, 0.9, 1.2), mat(wood, { rough: 0.7 })), 0, 0, -0.3);
  const tile = canvasTex(64, 64, (x) => { x.fillStyle = '#dde9e8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#b9cbca'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64); }, { repeat: [12, 8] });
  add(g, M(new THREE.PlaneGeometry(3, 2), mat(tile, { rough: 0.35 })), 0, 1.9, -0.9);
  // the scale: white base, grey round platform, dark display with green digits
  const sc = grp(g, 0, 0.9, -0.15);
  add(sc, M(new THREE.BoxGeometry(0.26, 0.045, 0.24).translate(0, 0.0225, 0), mat('#f2f3f4', { rough: 0.35 })));
  add(sc, M(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 24).translate(0, 0.051, 0), mat('#c7ccd3', { rough: 0.4 })));
  K.screen = digitScreen(256, 96);
  add(sc, M(new THREE.BoxGeometry(0.17, 0.05, 0.004), mat('#2a3038')), 0, 0.023, 0.121);
  add(sc, M(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshBasicMaterial({ map: K.screen.t }), { cast: false }), 0, 0.023, 0.1236);
  K.balls = [-1, 1].map((sd) => add(sc, M(new THREE.SphereGeometry(0.017, 12, 9), mat(PAL.tan, { rough: 0.8 })), sd * 0.022, 0.0745, 0.0));
  K.scale = sc;
  return K;
}

// ------------------------------------------------------------------ platform scale (41 kg) + cement bag + floor crack
export function platformScale(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry);
  add(g, M(boxG(1.3, 0.07, 1.0), mat('#3a3e48', { rough: 0.6 })));
  const plank = canvasTex(64, 64, (c) => { noiseFill(c, 64, 64, '#b98250', 16, 4, 2); c.fillStyle = 'rgba(70,40,20,0.4)'; for (let i = 1; i < 4; i++) c.fillRect(0, i * 16, 64, 1); });
  add(g, M(boxG(1.2, 0.05, 0.9), mat(plank)), 0, 0.07, 0);
  const m = mat(PAL.navy, { rough: 0.6 });
  add(g, M(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6).translate(0, 0.75, 0), m), 0.5, 0.07, -0.46);
  const scr = digitScreen(256, 160, { color: '#ff6a3c', bg: '#14161c' });
  add(g, M(new THREE.BoxGeometry(0.5, 0.34, 0.06), mat('#14161c')), 0.5, 1.75, -0.42);
  add(g, M(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ map: scr.t }), { cast: false }), 0.5, 1.75, -0.388);
  g.userData.screen = scr;
  return g;
}
export function cementBag(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry);
  const geo = new THREE.BoxGeometry(0.52, 0.2, 0.36, 3, 2, 3); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 - Math.abs(y) * 0.9; p.setX(i, p.getX(i) * (0.92 + 0.08 * k)); p.setZ(i, p.getZ(i) * (0.9 + 0.1 * k)); }
  geo.computeVertexNormals(); geo.translate(0, 0.1, 0);
  add(g, M(geo, mat('#e6e3dc', { rough: 0.95 })));
  const lab = canvasTex(256, 96, (c) => { c.fillStyle = '#2f6fd0'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.font = '900 46px "Nunito Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CEMENT', 128, 52); });
  add(g, M(new THREE.PlaneGeometry(0.3, 0.1), mat(lab), { cast: false }), 0, 0.2015, 0.02).rotation.x = -Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(0.28, 0.08), mat(lab), { cast: false }), 0, 0.1, 0.181);
  return g;
}
// crack in the floor: jagged black lines from the centre (k 0..1 grows them)
export function crackDecal(parent, x, z, size = 3, seed = 4) {
  const c = canvas(512, 512), cx = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const R = rng(seed), lines = [];
  for (let i = 0; i < 11; i++) {
    let a = (i / 11) * Math.PI * 2 + (R() - 0.5) * 0.4, px = 256, py = 256; const pts = [[px, py]];
    const n = 7 + Math.floor(R() * 6);
    for (let k = 0; k < n; k++) { a += (R() - 0.5) * 0.9; const l = 14 + R() * 26; px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]); }
    lines.push(pts);
  }
  const draw = (k) => {
    cx.clearRect(0, 0, 512, 512); cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (const pts of lines) {
      const n = Math.max(1, Math.floor(pts.length * k));
      for (const [w, col] of [[9, 'rgba(40,40,46,0.35)'], [4, 'rgba(25,25,30,0.95)']]) {
        cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(...pts[0]); for (let i = 1; i <= n && i < pts.length; i++) cx.lineTo(...pts[i]); cx.stroke();
      }
    }
    t.needsUpdate = true;
  };
  draw(0);
  const m = add(parent, M(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), { cast: false, receive: false }), x, 0.02, z);
  m.userData.draw = draw;
  return m;
}
// debris chunks (crack / crushed things): returns { g, update(k) } flying out from a point
export function debris(parent, at, { n = 14, size = 0.08, color = '#a8acb4', spread = 1.6, up = 2.2, seed = 9 } = {}) {
  const g = grp(parent), R = rng(seed), parts = [];
  const m = mat(color, { rough: 0.9 });
  for (let i = 0; i < n; i++) {
    const s = size * (0.5 + R());
    const mesh = add(g, M(new THREE.IcosahedronGeometry(s, 0), m), at[0], at[1], at[2]);
    const a = R() * Math.PI * 2, v = spread * (0.5 + R());
    parts.push({ mesh, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: up * (0.5 + R()), rs: (R() - 0.5) * 14 });
  }
  return { g, update(t) {
    for (const p of parts) {
      const y = at[1] + p.vy * t - 4.9 * t * t;
      p.mesh.visible = t > 0;
      p.mesh.position.set(at[0] + p.vx * t, Math.max(size * 0.5, y), at[2] + p.vz * t);
      p.mesh.rotation.set(p.rs * t, p.rs * 0.7 * t, 0);
    }
  } };
}

// ------------------------------------------------------------------ the giant tan spheres (plain, smooth low-poly)
export function tanSpheres(parent, r, { x = 0, z = 0, gap = 0.02, seg = 18, y = null } = {}) {
  const g = grp(parent, x, 0, z);
  const m = mat(PAL.tan, { rough: 0.9 });
  const balls = [-1, 1].map((sd) => add(g, M(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66)), m), sd * r * (1 + gap), y ?? r, 0));
  g.userData.balls = balls; g.userData.r = r;
  return g;
}

// ------------------------------------------------------------------ cars
const CAR_COLS = ['#d8372f', '#2f6fd0', '#f2c230', '#3fae5a', '#f4f4f0', '#22263a', '#f08a2a', '#8a4ad8', '#20b0b0', '#e86a9a'];
export function boxCar(parent, x, z, { color = '#3fae5a', ry = 0, s = 1 } = {}) {
  const g = grp(parent, x, 0, z, ry); g.scale.setScalar(s);
  const body = mat(color, { rough: 0.45, metal: 0.1 }), dark = mat('#20263a', { rough: 0.3, metal: 0.2 }), tyre = mat('#18181c', { rough: 0.9 });
  add(g, M(boxG(1.8, 0.62, 4.1), body), 0, 0.28, 0);
  add(g, M(boxG(1.62, 0.6, 2.1), dark), 0, 0.9, -0.2);
  for (const [wx, wz] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.3], [0.82, -1.3]]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10); w.rotateZ(Math.PI / 2); add(g, M(w, tyre), wx, 0.34, wz); }
  for (const sx of [-1, 1]) { add(g, M(new THREE.BoxGeometry(0.32, 0.12, 0.04), mat('#fff6d8', { emissive: '#fff0c0', emissiveIntensity: 0.5 })), sx * 0.6, 0.66, 2.06); add(g, M(new THREE.BoxGeometry(0.32, 0.1, 0.04), mat('#d02a2a', { emissive: '#801010', emissiveIntensity: 0.6 })), sx * 0.6, 0.66, -2.06); }
  return g;
}
// many cars at once (instanced): list of [x, z, ry, colorIndex]
export function carCrowd(parent, list) {
  const n = list.length, g = grp(parent);
  const bodyG = boxG(1.8, 0.62, 4.1).translate(0, 0.28, 0), cabG = boxG(1.62, 0.6, 2.1).translate(0, 0.9, -0.2);
  const wheelG = new THREE.BoxGeometry(1.9, 0.5, 0.6).translate(0, 0.3, 0);
  const body = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1, flatShading: true }), n);
  const cab = new THREE.InstancedMesh(cabG, mat('#20263a', { rough: 0.3 }), n);
  const wheels = new THREE.InstancedMesh(wheelG, mat('#18181c'), n * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), col = new THREE.Color();
  list.forEach(([x, z, ry, ci], i) => {
    q.setFromAxisAngle(V(0, 1, 0), ry); m4.compose(V(x, 0, z), q, one);
    body.setMatrixAt(i, m4); cab.setMatrixAt(i, m4); body.setColorAt(i, col.set(CAR_COLS[ci % CAR_COLS.length]));
    for (const k of [0, 1]) { const off = V(0, 0, k ? 1.3 : -1.3).applyQuaternion(q); m4.compose(V(x, 0, z).add(off), q, one); wheels.setMatrixAt(i * 2 + k, m4); }
  });
  for (const im of [body, cab, wheels]) { im.castShadow = true; im.receiveShadow = true; g.add(im); }
  return g;
}

// ------------------------------------------------------------------ army: tanks, chains, rifles
export function tank(parent, x, z, ry = 0, s = 1) {
  const g = grp(parent, x, 0, z, ry); g.scale.setScalar(s);
  const ol = mat(PAL.olive, { rough: 0.8 }), dk = mat('#3a4228', { rough: 0.9 }), tr = mat('#2a2c26', { rough: 1 });
  const wheels = [];
  for (const sx of [-1, 1]) {
    add(g, M(boxG(0.7, 0.75, 5.4), tr), sx * 1.35, 0, 0);
    for (let i = 0; i < 6; i++) { const w = new THREE.CylinderGeometry(0.3, 0.3, 0.72, 8); w.rotateZ(Math.PI / 2); wheels.push(add(g, M(w, dk), sx * 1.35, 0.32, -2.1 + i * 0.84)); }
  }
  g.userData.wheels = wheels;
  const hull = new THREE.CylinderGeometry(1, 1.15, 0.7, 4, 1); hull.rotateY(Math.PI / 4); hull.scale(1.45, 1, 3.6); hull.translate(0, 1.05, 0);
  add(g, M(hull, ol));
  const tur = new THREE.CylinderGeometry(0.75, 0.95, 0.55, 6); tur.scale(1, 1, 1.25); add(g, M(tur, ol), 0, 1.65, -0.3);
  g.userData.turret = add(g, M(new THREE.CylinderGeometry(0.09, 0.11, 2.8, 8).rotateX(Math.PI / 2).translate(0, 0, 1.4), dk), 0, 1.7, 0.4);
  add(g, M(new THREE.BoxGeometry(0.3, 0.14, 0.3), dk), 0, 1.0, -2.75);           // rear hook
  g.userData.hook = V(0, 1.0, -2.85);
  g.userData.spin = (a) => wheels.forEach((w) => { w.rotation.x = a; });
  return g;
}
// a chain of torus links from a to b (with a little sag)
export function chain(parent, a, b, { link = 0.16, r = 0.035, sag = 0.3 } = {}) {
  const A = V(...a), B = V(...b), n = Math.max(2, Math.round(A.distanceTo(B) / (link * 0.78)));
  const im = new THREE.InstancedMesh(new THREE.TorusGeometry(link * 0.42, r, 5, 8), mat('#5a5e66', { rough: 0.4, metal: 0.6 }), n);
  const m4 = new THREE.Matrix4(), one = V(1, 1, 1);
  const set = (A, B, sagNow, jig = 0) => {
    const dir = B.clone().sub(A).normalize();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, p = A.clone().lerp(B, k); p.y -= Math.sin(k * Math.PI) * sagNow + Math.sin(i * 1.7) * jig;
      const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir); q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), (i % 2) * Math.PI / 2));
      m4.compose(p, q, one); im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  set(A, B, sag); im.castShadow = true; parent.add(im);
  im.userData.set = set;
  return im;
}
export function rifle(parent) {
  const g = new THREE.Group(); parent.add(g); const m = mat('#2a2c28', { rough: 0.6 }), w = mat('#5a4a32');
  add(g, M(new THREE.BoxGeometry(0.05, 0.08, 0.5), m), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6).rotateX(Math.PI / 2), m), 0, 0.015, 0.42);
  add(g, M(new THREE.BoxGeometry(0.045, 0.1, 0.22), w), 0, -0.02, -0.33);
  add(g, M(new THREE.BoxGeometry(0.035, 0.12, 0.05), m), 0, -0.08, 0.05);
  return g;
}

// ------------------------------------------------------------------ the far city (white blocks + red-roof houses), for the big shots
export function farCity(parent, cx, cz, { radius = 120, n = 40, seed = 7, minR = 30, hMax = 40 } = {}) {
  const g = grp(parent), R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = minR + R() * (radius - minR), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (R() < 0.35) house(g, x, z, { w: 6 + R() * 3, h: 4 + R() * 2, d: 6 + R() * 3, ry: R() * 3, seed: i });
    else { const w = 8 + R() * 10, h = 12 + R() * hMax; const b = M(boxG(w, h, w * (0.7 + R() * 0.5)), mat(smallWinTex(R() < 0.5 ? '#eceef0' : '#d9dde4', i), { rough: 0.9 })); b.material.map.repeat.set(Math.round(w / 4), Math.round(h / 8)); b.position.set(x, 0, z); b.rotation.y = R() * 0.3; g.add(b); }
  }
  return g;
}

// ------------------------------------------------------------------ highway jam (cars toward the spheres far away)
export function buildHighway(W, { x0 = PLACES.hwy, len = 520, lanes = 6, skip = [] } = {}) {
  const g = grp(W.scene, x0); const H = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), mat(grassTex(400), { rough: 1 }), { cast: false }), 0, 0, -400);
  const lw = 3.6, half = lanes * lw / 2;
  add(g, M(new THREE.PlaneGeometry(lanes * lw + 2, len + 40).rotateX(-Math.PI / 2), mat('#3a3e48', { rough: 0.95 }), { cast: false }), 0, 0.02, -len / 2 + 20);
  for (let l = 1; l < lanes; l++) for (let z = 20; z > -len; z -= 9) add(g, M(new THREE.PlaneGeometry(0.18, 4).rotateX(-Math.PI / 2), mat(l === lanes / 2 ? '#f2d030' : '#f2f2ee'), { cast: false }), -half + l * lw, 0.03, z);
  for (const sx of [-1, 1]) add(g, M(new THREE.PlaneGeometry(0.25, len + 40).rotateX(-Math.PI / 2), mat('#f2f2ee'), { cast: false }), sx * (half + 0.4), 0.03, -len / 2 + 20);
  const R = rng(21), list = [];
  for (let l = 0; l < lanes; l++) for (let z = 10 - R() * 4; z > -len + 30; z -= 5.4 + R() * 1.6) { const x = -half + (l + 0.5) * lw + (R() - 0.5) * 0.3; if (skip.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r)) continue; list.push([x, z, Math.PI + (R() - 0.5) * 0.06, Math.floor(R() * 10)]); }
  H.cars = carCrowd(g, list); H.list = list;
  return H;
}

// ------------------------------------------------------------------ mountains (km scale) + crushed peaks
export function mountainRange(parent, cx, cz, { n = 14, spread = 9000, hMin = 900, hMax = 2200, seed = 3, crushAt = null, crushR = 0 } = {}) {
  const g = grp(parent), R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = cx + (i / (n - 1) - 0.5) * spread + (R() - 0.5) * 500, z = cz + (R() - 0.5) * 1800;
    const h = hMin + R() * (hMax - hMin), r = h * (0.9 + R() * 0.5);
    const geo = new THREE.ConeGeometry(r, h, 7 + Math.floor(R() * 3), 3); geo.translate(0, h / 2, 0);
    const p = geo.attributes.position, cols = [];
    let crushed = 0;
    if (crushAt) { const d = Math.hypot(x - crushAt[0], z - crushAt[1]); crushed = clamp(1 - (d - crushR * 0.6) / (crushR * 0.9)); }
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
      const j = (hash1(k * 3.1 + i * 17) - 0.5) * r * 0.18;
      let ny = vy * (1 - crushed * 0.75) + (vy > 1 && vy < h - 1 ? j * 0.5 : 0);
      p.setXYZ(k, vx + (vy < h - 1 ? j : 0) * (vy > 1 ? 1 : 0), ny, vz + (vy < h - 1 ? j * 0.7 : 0) * (vy > 1 ? 1 : 0));
      const snow = ny > h * (1 - crushed * 0.75) * 0.72 && crushed < 0.5;
      const base = snow ? [0.95, 0.96, 0.98] : (vy < h * 0.3 ? [0.52, 0.5, 0.44] : [0.6, 0.56, 0.5]);
      const d = (hash1(k * 7.7 + i) - 0.5) * 0.08; cols.push(base[0] + d, base[1] + d, base[2] + d);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = M(geo.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    m.position.set(x, 0, z); g.add(m);
  }
  return g;
}

// ------------------------------------------------------------------ the giant balance scale (8 billion people vs the spheres)
export function balanceScale(parent, x, z, { s = 1 } = {}) {
  const g = grp(parent, x, 0, z); g.scale.setScalar(s);
  const wood = mat('#8a5a36', { rough: 0.8 }), dark = mat('#6a4428', { rough: 0.8 });
  add(g, M(new THREE.CylinderGeometry(1.4, 1.6, 0.3, 16), dark), 0, 0.15, 0);
  add(g, M(new THREE.CylinderGeometry(0.16, 0.2, 5.4, 8).translate(0, 2.7, 0), wood), 0, 0.3, 0);
  const beam = grp(g, 0, 5.7, 0);
  add(beam, M(new THREE.BoxGeometry(9.2, 0.22, 0.26), wood));
  add(g, M(new THREE.SphereGeometry(0.28, 10, 8), dark), 0, 5.7, 0);
  const pans = [-1, 1].map((sd) => {
    const hang = grp(g); const pan = grp(hang);
    add(pan, M(new THREE.CylinderGeometry(1.7, 1.45, 0.2, 18), wood), 0, -0.1, 0);
    const strings = [0, 1, 2].map((k) => add(hang, M(new THREE.CylinderGeometry(0.02, 0.02, 1, 4).translate(0, -0.5, 0), dark)));
    return { sd, hang, pan, strings };
  });
  g.userData = { beam, pans, tilt(a) {
    beam.rotation.z = a;
    for (const P of pans) {
      const tip = V(P.sd * 4.4 * Math.cos(a), 5.7 + P.sd * 4.4 * Math.sin(a), 0);
      P.pan.position.set(tip.x, tip.y - 2.6, 0);
      P.strings.forEach((st, k) => { const ang = k * Math.PI * 2 / 3; const e = V(tip.x + Math.cos(ang) * 1.5, tip.y - 2.6, Math.sin(ang) * 1.5); st.position.copy(tip); const d = e.clone().sub(tip); st.scale.set(1, d.length(), 1); st.quaternion.setFromUnitVectors(V(0, -1, 0), d.normalize()); });
    }
  } };
  g.userData.tilt(0);
  return g;
}
// a heap of tiny colourful people (instanced capsules) on a pan
export function peopleHeap(parent, n = 500, r = 1.45, h = 0.9, seed = 5) {
  const R = rng(seed), im = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.05, 0.1, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), mat('#e8b894'), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, y = 0.08 + (1 - d / r) * h * R();
    q.setFromEuler(new THREE.Euler((R() - 0.5) * 2, R() * 6, (R() - 0.5) * 2));
    const p = V(Math.cos(a) * d, y, Math.sin(a) * d);
    m4.compose(p, q, one); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(CAR_COLS[Math.floor(R() * CAR_COLS.length)]));
    m4.compose(p.clone().add(V(0, 0.11, 0).applyQuaternion(q)), q, one); heads.setMatrixAt(i, m4);
  }
  const g = new THREE.Group(); g.add(im); g.add(heads); im.castShadow = heads.castShadow = true; parent.add(g);
  return g;
}

// ------------------------------------------------------------------ space: stars, the Earth, the black hole
export function spaceBg(W, at = [0, 0, 0], { n = 1600, r = 900 } = {}) {
  W.scene.background = new THREE.Color('#0b0d28'); W.scene.fog = null;
  const R = rng(91), pos = [], col = [];
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.push(at[0] + Math.cos(a) * s * r, at[1] + u * r, at[2] + Math.sin(a) * s * r);
    const b = 0.55 + R() * 0.45, tint = R(); col.push(b * (tint < 0.2 ? 0.8 : 1), b * (tint < 0.2 ? 0.9 : 1), b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.9 }));
  W.scene.add(pts);
  const hemi = new THREE.HemisphereLight(0x9aa8ff, 0x1a1a3a, 0.5); W.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.6); sun.position.set(at[0] - 40, at[1] + 25, at[2] + 30); sun.target.position.set(...at); W.scene.add(sun); W.scene.add(sun.target);
  W.lights = { hemi, sun };
  return pts;
}
export function earth(parent, r = 1, seed = 4) {
  const geo = new THREE.IcosahedronGeometry(r, 3).toNonIndexed(), p = geo.attributes.position, cols = [];
  const blob = (v) => { let s = 0; for (const [cx, cy, cz, w] of [[0.6, 0.5, 0.6, 0.55], [-0.5, 0.2, 0.8, 0.45], [0.1, -0.6, 0.7, 0.4], [-0.7, 0.6, -0.3, 0.5], [0.5, -0.2, -0.8, 0.5], [0.0, 0.9, 0.1, 0.35]]) s = Math.max(s, w - V(cx, cy, cz).normalize().distanceTo(v)); return s; };
  for (let i = 0; i < p.count; i += 3) {
    const c = V(); for (let k = 0; k < 3; k++) c.add(V(p.getX(i + k), p.getY(i + k), p.getZ(i + k))); c.normalize();
    const land = blob(c) + (hash1(i * 0.37 + seed) - 0.5) * 0.12 > 0.05, ice = Math.abs(c.y) > 0.9;
    const col = ice ? [0.95, 0.97, 1] : land ? [0.28 + hash1(i) * 0.06, 0.62, 0.3] : [0.16, 0.38 + hash1(i * 3) * 0.05, 0.86];
    for (let k = 0; k < 3; k++) cols.push(...col);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const m = M(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }));
  parent.add(m); return m;
}
// accretion disk texture: white-hot inner edge -> yellow -> orange -> red -> magenta -> transparent
function diskTex() {
  const c = canvas(512, 512), x = c.getContext('2d'), gr = x.createRadialGradient(256, 256, 60, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,170,1)'); gr.addColorStop(0.35, 'rgba(255,170,60,0.95)');
  gr.addColorStop(0.55, 'rgba(240,70,60,0.85)'); gr.addColorStop(0.78, 'rgba(200,40,140,0.5)'); gr.addColorStop(1, 'rgba(120,20,140,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  const R = rng(5); x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, d = 90 + R() * 160; x.strokeStyle = `rgba(0,0,0,${0.15 + R() * 0.3})`; x.lineWidth = 2 + R() * 6; x.beginPath(); x.arc(256, 256, d, a, a + 0.3 + R() * 1.2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function blackHole(parent, { r = 1 } = {}) {
  const g = grp(parent);
  const disk = new THREE.Mesh(new THREE.RingGeometry(r * 1.25, r * 5.2, 96, 1), new THREE.MeshBasicMaterial({ map: diskTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  // ring UVs -> radial texture: remap so the texture centre sits at the hole
  const uv = disk.geometry.attributes.uv, pos = disk.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) { uv.setXY(i, 0.5 + pos.getX(i) / (r * 10.4), 0.5 + pos.getY(i) / (r * 10.4)); }
  disk.rotation.x = -Math.PI / 2 + 0.22; g.add(disk);
  const hole = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshBasicMaterial({ color: '#000000', fog: false })); g.add(hole);
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, r * 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  g.add(ringGlow);
  const jc = canvas(32, 256), jx = jc.getContext('2d'), jg = jx.createLinearGradient(0, 0, 0, 256); jg.addColorStop(0, 'rgba(160,200,255,0)'); jg.addColorStop(0.75, 'rgba(200,230,255,0.7)'); jg.addColorStop(1, 'rgba(255,255,255,1)'); jx.fillStyle = jg; jx.fillRect(0, 0, 32, 256);
  const jt = new THREE.CanvasTexture(jc); jt.colorSpace = THREE.SRGBColorSpace;
  const jets = [1, -1].map((sd) => { const j = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 9, 12, 1, true), new THREE.MeshBasicMaterial({ map: jt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); j.position.y = sd * r * 4.6; if (sd > 0) j.rotation.x = Math.PI; g.add(j); return j; });
  g.userData = { disk, hole, ringGlow, jets };
  return g;
}

// soft dust / smoke puffs: sprites with a round soft texture; returns the group (userData.mat = the shared material)
export function puffs(parent, n = 10, color = 'rgba(214,206,190,1)', opacity = 0.75) {
  const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, color); gr.addColorStop(0.6, color.replace(/,1\)$/, ',0.6)')); gr.addColorStop(1, color.replace(/,1\)$/, ',0)'));
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity, depthWrite: false });
  const g = new THREE.Group(); parent.add(g);
  for (let i = 0; i < n; i++) g.add(new THREE.Sprite(m));
  g.userData.mat = m;
  return g;
}
// a phone with a bright app screen (held with ch.p.gripR = phone)
export function phone(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.075, 0.155, 0.009), mat('#16161a', { rough: 0.3 })), 0, 0, 0);
  const sc = canvasTex(64, 128, (x) => { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#2a2f45'); gr.addColorStop(1, '#14182a'); x.fillStyle = gr; x.fillRect(0, 0, 64, 128);
    const cols = ['#f2c230', '#3fae5a', '#e8402a', '#2f6fd0', '#f08a2a']; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 5]; x.fillRect(6, 8 + i * 14, 12 + (i * 17) % 40, 8); } });
  const s = add(g, M(new THREE.PlaneGeometry(0.066, 0.142), new THREE.MeshBasicMaterial({ map: sc })), 0, 0, -0.0047); s.rotation.y = Math.PI;
  g.userData.grip = { pos: [0, -0.03, -0.012], axis: [0, 1, 0], up: [0, 0, -1] };
  return g;
}
