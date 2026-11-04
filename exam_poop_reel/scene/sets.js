// Gardyloo sets + props (low-poly, pixel-noisy textures, soft light). Each builder adds to W.scene, returns handles.
// Units: metres, +Y up. Places are far apart so they never see each other:
//   house + street outside (origin), upstairs hallway (x = 60), bathroom (x = -60), dining room (x = 120),
//   old Edinburgh (x = 200).
import * as THREE from 'three';
import { mat, matNoisy, tex, paint, canvas, rng, hexToRgb, clamp, hash1, lerp } from './lib.js';
import { CHAIR } from './cast.js';
import { photoCanvases } from './set_tex.js';
import { worldUV } from './set_util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };

// ------------------------------------------------------------------ textures
function px(fn, size = 64, repeat = [1, 1]) { return tex(paint(size, size, fn), { repeat }); }
function tilesTex(hex, grout = '#eef4f0', size = 64, seed = 13, n = 4) {
  const base = hexToRgb(hex), g = hexToRgb(grout), R = rng(seed), cell = size / n;
  const tone = []; for (let i = 0; i < n * n; i++) tone.push((R() - 0.5) * 16);
  return px((x, y) => {
    if (x % cell === 0 || y % cell === 0) return g;
    const d = tone[Math.floor(y / cell) * n + Math.floor(x / cell)] + (R() - 0.5) * 8 + ((x % cell) === 1 || (y % cell) === 1 ? 10 : 0);
    return [base[0] + d, base[1] + d, base[2] + d];
  }, size);
}
function checkerTex(a, b, size = 64, n = 8, seed = 3) {
  const A = hexToRgb(a), B = hexToRgb(b), R = rng(seed), cell = size / n;
  return px((x, y) => { const c = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) ? A : B; const d = (R() - 0.5) * 10 - (x % cell === 0 || y % cell === 0 ? 16 : 0); return [c[0] + d, c[1] + d, c[2] + d]; }, size);
}
function sidingTex(hex, size = 64, seed = 5) {           // horizontal wooden siding boards
  const base = hexToRgb(hex), R = rng(seed);
  return px((x, y) => { const r = y % 8; const d = (r === 0 ? -34 : r === 1 ? 14 : 0) + (R() - 0.5) * 10; return [base[0] + d, base[1] + d, base[2] + d * 0.8]; }, size);
}
function planksTex(hex = '#9a6a3c', size = 64, seed = 5) {
  const base = hexToRgb(hex), R = rng(seed), rows = 8, off = [];
  for (let i = 0; i < rows; i++) off.push(Math.floor(R() * size));
  const tone = []; for (let i = 0; i < rows * 4; i++) tone.push((R() - 0.5) * 30);
  return px((x, y) => {
    const r = Math.floor(y / (size / rows)), seg = Math.floor(((x + off[r]) % size) / (size / 2));
    const edge = (y % (size / rows) === 0) || (((x + off[r]) % (size / 2)) === 0);
    const d = tone[r * 4 + seg] + (R() - 0.5) * 10 + (edge ? -36 : 0);
    return [base[0] + d, base[1] + d * 0.8, base[2] + d * 0.6];
  }, size);
}
function stoneTex(hex = '#8a8478', size = 64, seed = 9) {   // big grey stone blocks (old Edinburgh)
  const base = hexToRgb(hex), R = rng(seed), rows = 6, off = [], tone = [];
  for (let i = 0; i < rows; i++) off.push(Math.floor(R() * 20));
  for (let i = 0; i < rows * 6; i++) tone.push((R() - 0.5) * 34);
  return px((x, y) => {
    const r = Math.floor(y / (size / rows)), bw = 16 + (r % 3) * 5, c = Math.floor((x + off[r]) / bw);
    const edge = (y % (size / rows) === 0) || ((x + off[r]) % bw === 0);
    const d = tone[(r * 6 + c) % tone.length] + (R() - 0.5) * 14 + (edge ? -42 : 0);
    return [base[0] + d, base[1] + d, base[2] + d * 0.9];
  }, size);
}
function cobbleTex(size = 64, seed = 11) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < 40; i++) pts.push([R() * size, R() * size, (R() - 0.5) * 40]);
  return px((x, y) => {
    let d1 = 1e9, d2 = 1e9, k = 0;
    for (let i = 0; i < pts.length; i++) {
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        const dx = x - pts[i][0] - ox, dy = y - pts[i][1] - oy, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
      }
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.6;
    const v = edge ? 70 : 128 + pts[k][2] + (R() - 0.5) * 12;
    return [v * 1.0, v * 0.96, v * 0.9];
  }, size);
}
function roofTex(hex = '#6a3a30', size = 64, seed = 15) {
  const base = hexToRgb(hex), R = rng(seed);
  return px((x, y) => { const r = Math.floor(y / 6), o = (r & 1) * 5; const edge = y % 6 === 0 || (x + o) % 10 === 0; const d = (edge ? -30 : 0) + (R() - 0.5) * 16; return [base[0] + d, base[1] + d, base[2] + d]; }, size);
}
function wallpaperTex(a = '#e6c89a', b = '#d8b480', size = 32, seed = 17) {
  const A = hexToRgb(a), B = hexToRgb(b), R = rng(seed);
  return px((x, y) => { const c = (x % 8 < 3) ? B : A; const dot = (x % 8 === 5 && y % 8 === 4) ? -26 : 0; const d = (R() - 0.5) * 8 + dot; return [c[0] + d, c[1] + d, c[2] + d]; }, size);
}
function skyTex(kind) {
  const c = canvas(16, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  if (kind === 'night') { g.addColorStop(0, '#060a1e'); g.addColorStop(0.45, '#0e1a3e'); g.addColorStop(0.5, '#1a2a52'); g.addColorStop(1, '#0a0e1a'); }
  else if (kind === 'sepia') { g.addColorStop(0, '#c8c0b0'); g.addColorStop(0.5, '#e8e0d0'); g.addColorStop(1, '#a8a090'); }
  else { g.addColorStop(0, '#3a5a9a'); g.addColorStop(0.28, '#8a7ab8'); g.addColorStop(0.4, '#f08a7a'); g.addColorStop(0.47, '#ffc070'); g.addColorStop(0.5, '#ffe0a0'); g.addColorStop(1, '#5a6a4a'); }
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; return t;
}
export function textTex(w, h, draw) {
  const c = canvas(w, h), g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}

// ------------------------------------------------------------------ light + sky
export function lights(W, { sky = 0xbfd4ff, ground = 0x8a7a5a, hemi = 0.8, key = 0xffd6a0, keyI = 1.8, fill = 0xffd6a8, fillI = 1.0 } = {}) {
  const g = new THREE.Group(); W.scene.add(g);
  const L = {};
  L.hemi = new THREE.HemisphereLight(sky, ground, hemi); g.add(L.hemi);
  L.key = new THREE.DirectionalLight(key, keyI);
  L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048);
  L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.02; L.key.shadow.radius = 4;
  g.add(L.key); g.add(L.key.target);
  L.fill = new THREE.PointLight(fill, fillI, 14, 2); g.add(L.fill);
  W.lights = L;
  return L;
}
export function keyAt(W, target, { from = [2.5, 6, 4], size = 4 } = {}) {
  const L = W.lights; const t = V(...target);
  L.key.position.copy(t).add(V(...from)); L.key.target.position.copy(t);
  Object.assign(L.key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 60 });
  L.key.shadow.camera.updateProjectionMatrix();
}
export function skyDome(W, kind = 'sunset', at = [0, 0, 0]) {
  const g = new THREE.SphereGeometry(90, 24, 16);
  const m = new THREE.MeshBasicMaterial({ map: skyTex(kind), side: THREE.BackSide, fog: false, depthWrite: false });
  const s = M(g, m, { cast: false, receive: false }); s.position.set(...at); W.scene.add(s);
  if (kind === 'night') {                                          // stars
    const R = rng(77), pos = [];
    for (let i = 0; i < 500; i++) {
      const a = R() * Math.PI * 2, e = 0.08 + R() * 1.3, r = 85;
      pos.push(at[0] + Math.cos(a) * Math.cos(e) * r, at[1] + Math.sin(e) * r, at[2] + Math.sin(a) * Math.cos(e) * r);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    W.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6dc, size: 0.35, fog: false })));
  }
  return s;
}
// additive light beam (god-ray / window light) from a to b
export function beam(parent, a, b, r0, r1, color = 0xffd890, opacity = 0.12) {
  const A = V(...a), B = V(...b), h = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r0, r1, h, 4, 1, true); g.rotateY(Math.PI / 4); g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  m.position.copy(A); m.quaternion.setFromUnitVectors(V(0, -1, 0), B.clone().sub(A).normalize()); parent.add(m);
  return m;
}
export function glowSprite(parent, pos, size, color = '#ffd890', opacity = 0.8) {
  const c = canvas(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.position.set(...pos); s.scale.set(size, size, 1); parent.add(s); return s;
}

// ------------------------------------------------------------------ props
export function bouquet(parent) {
  const g = new THREE.Group(); parent.add(g);
  const wrap = new THREE.ConeGeometry(0.11, 0.34, 6, 1, true); wrap.rotateX(Math.PI); wrap.translate(0, 0.0, 0);
  const wm = mat('#f4e6c8', { rough: 0.8 }); wm.side = THREE.DoubleSide;
  add(g, M(wrap, wm), 0, 0, 0);
  const cols = ['#e8344a', '#f6c23a', '#f06aa8', '#ffffff', '#ff7a2a', '#b05ae0', '#e8344a', '#f6c23a', '#f06aa8'];
  const R = rng(5);
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, r = R() * 0.1;
    const f = add(g, M(new THREE.IcosahedronGeometry(0.032 + R() * 0.012, 0), mat(cols[i % cols.length], { rough: 0.7 })), Math.cos(a) * r, 0.17 + R() * 0.06, Math.sin(a) * r);
    f.rotation.set(R() * 3, R() * 3, R() * 3);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = add(g, M(new THREE.ConeGeometry(0.02, 0.09, 3), mat('#3a8a3a')), Math.cos(a) * 0.1, 0.16, Math.sin(a) * 0.1);
    l.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
  const rib = add(g, M(new THREE.TorusGeometry(0.06, 0.012, 4, 10), mat('#d8326a')), 0, -0.06, 0); rib.rotation.x = Math.PI / 2;
  g.userData.grip = { pos: [0, -0.08, -0.0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.grips = { L: { pos: [0.02, -0.1, 0], axis: [0, 1, 0], up: [0, 0, 1] }, R: { pos: [-0.02, -0.06, 0], axis: [0, 1, 0], up: [0, 0, 1] } };
  return g;
}
// the small white toilet-paper bundle (with an optional pink bow) -- the only "poop" we ever see
export function bundle(parent, { bow = true, s = 1 } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const pm = mat(tex(paint(32, 32, (x, y) => { const q = ((x + y * 2) % 9 === 0 || (x * 3 + y) % 11 === 0) ? -18 : 0; const v = 246 + q + ((x * 7 + y * 13) % 5); return [v, v, v - 4]; })), { rough: 0.95 });
  const geo = new THREE.IcosahedronGeometry(0.055 * s, 1); geo.scale(1.15, 0.85, 1.0);
  const pos = geo.attributes.position, R = rng(31);
  for (let i = 0; i < pos.count; i++) { const k = 1 + (R() - 0.5) * 0.16; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  g.userData.ball = add(g, M(geo, pm), 0, 0, 0);
  for (let i = 0; i < 3; i++) {   // paper flaps
    const f = add(g, M(new THREE.BoxGeometry(0.05 * s, 0.003, 0.03 * s), pm), (i - 1) * 0.025 * s, 0.045 * s, (i % 2 ? 1 : -1) * 0.01 * s);
    f.rotation.set(0.4 * (i - 1), i, 0.3);
  }
  if (bow) {
    const bm = mat('#f27aa8', { rough: 0.6 });
    const bw = new THREE.Group(); g.add(bw); bw.position.set(0, 0.048 * s, 0);
    for (const sd of [-1, 1]) {
      const loop = add(bw, M(new THREE.TorusGeometry(0.018 * s, 0.006 * s, 4, 8), bm), sd * 0.02 * s, 0.008 * s, 0); loop.rotation.set(0, 0, sd * 0.5); loop.scale.set(1.2, 0.8, 1);
      const tail = add(bw, M(new THREE.BoxGeometry(0.008 * s, 0.03 * s, 0.004), bm), sd * 0.012 * s, -0.012 * s, 0.01 * s); tail.rotation.z = sd * 0.5;
    }
    add(bw, M(new THREE.BoxGeometry(0.014 * s, 0.014 * s, 0.014 * s), bm), 0, 0.006 * s, 0);
    const band = add(g, M(new THREE.TorusGeometry(0.058 * s, 0.004 * s, 4, 14), bm), 0, 0, 0); band.rotation.y = Math.PI / 2; band.scale.set(1, 0.85, 1.12);
    g.userData.bow = bw;
  }
  g.userData.grip = { pos: [0, -0.045 * s, 0], axis: [1, 0, 0], up: [0, -1, 0] };
  return g;
}
export function rollProp(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14), matNoisy('#fbfbf8', { amount: 6 })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 0.102, 10), mat('#a07a4a')), 0, 0, 0);
  return g;
}
export function briefcase(parent) {
  const g = new THREE.Group(); parent.add(g);
  const bm = mat(tex(paint(16, 16, (x, y) => { const v = 34 + ((x * 3 + y * 5) % 7); return [v, v - 4, v - 6]; })), { rough: 0.45 });
  add(g, M(new THREE.BoxGeometry(0.44, 0.32, 0.1), bm), 0, -0.2, 0);
  const h = add(g, M(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), bm), 0, -0.04, 0);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.04, 0.025, 0.11), mat('#c8a040', { metal: 0.8, rough: 0.3 })), sx * 0.12, -0.06, 0);
  g.userData.grip = { pos: [0, 0.0, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  return g;
}
export function car(parent, { doorOpen = 1, color = '#1e2c5a' } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const body = mat(tex(paint(16, 16, (x, y) => { const c = hexToRgb(color); const d = ((x * 5 + y * 3) % 7) - 3; return [c[0] + d, c[1] + d, c[2] + d * 2]; })), { rough: 0.25, metal: 0.3 });
  const glass = mat('#20283a', { rough: 0.05, metal: 0.4 }), tyre = mat('#141414'), chrome = mat('#c8ccd0', { metal: 0.9, rough: 0.2 });
  add(g, M(boxG(1.8, 0.55, 4.3), body), 0, 0.32, 0);
  const cab = new THREE.CylinderGeometry(0.62, 0.9, 0.5, 4, 1); cab.rotateY(Math.PI / 4); cab.scale(1.25, 1, 2.0); cab.translate(0, 0.25, 0);
  add(g, M(cab, glass), 0, 0.85, -0.15);
  const roof = new THREE.BoxGeometry(1.5, 0.06, 1.7); add(g, M(roof, body), 0, 1.35, -0.15);
  for (const [x, z] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]]) {
    const w = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10); w.rotateZ(Math.PI / 2);
    add(g, M(w, tyre), x, 0.33, z);
    const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 8); hub.rotateZ(Math.PI / 2); add(g, M(hub, chrome), x, 0.33, z);
  }
  for (const sx of [-1, 1]) { add(g, M(new THREE.BoxGeometry(0.3, 0.12, 0.04), mat('#fff6d8', { emissive: '#fff0c0', emissiveIntensity: 0.6 })), sx * 0.6, 0.62, 2.16); add(g, M(new THREE.BoxGeometry(0.3, 0.1, 0.04), mat('#c81a1a', { emissive: '#801010', emissiveIntensity: 0.4 })), sx * 0.6, 0.62, -2.16); }
  add(g, M(new THREE.BoxGeometry(1.0, 0.12, 0.05), chrome), 0, 0.42, 2.17);
  // driver door (left side, -x when the car faces +z), hinged at the front edge
  const door = new THREE.Group(); door.position.set(-0.9, 0.32, 0.55); g.add(door);
  add(door, M(new THREE.BoxGeometry(0.06, 0.55, 1.15).translate(0, 0.275, -0.575), body));
  add(door, M(new THREE.BoxGeometry(0.04, 0.42, 0.95).translate(0, 0.78, -0.55), glass));
  door.rotation.y = 1.0 * doorOpen;
  g.userData.door = door;
  return g;
}
export function wallClock(parent, { r = 0.24 } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const face = textTex(128, 128, (x, w, h) => {
    x.fillStyle = '#f6f0e0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2a2420';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, L = i % 5 === 0 ? 12 : 5, t = i % 5 === 0 ? 4 : 2; x.save(); x.translate(64, 64); x.rotate(a); x.fillRect(-t / 2, -60, t, L); x.restore(); }
  });
  const fg = new THREE.CircleGeometry(r * 0.92, 24);
  add(g, M(new THREE.CylinderGeometry(r, r, 0.05, 20).rotateX(Math.PI / 2), mat('#5a3a22', { rough: 0.5 })), 0, 0, 0);
  add(g, M(fg, mat(face, { rough: 0.6, flat: false })), 0, 0, 0.027);
  const hand = (len, w, col, z) => { const h = new THREE.Group(); g.add(h); h.position.z = z; add(h, M(new THREE.BoxGeometry(w, len, 0.006).translate(0, len / 2 - 0.02, 0), mat(col))); return h; };
  g.userData.hour = hand(r * 0.5, 0.022, '#1a1614', 0.034); g.userData.min = hand(r * 0.75, 0.016, '#1a1614', 0.04);
  g.userData.sec = hand(r * 0.85, 0.007, '#d0201a', 0.046);
  add(g, M(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8).rotateX(Math.PI / 2), mat('#d0201a')), 0, 0, 0.05);
  g.userData.hour.rotation.z = -(7.5 / 12) * Math.PI * 2; g.userData.min.rotation.z = -(0.5) * Math.PI * 2;
  g.userData.set = (sec) => { g.userData.sec.rotation.z = -(Math.floor(sec) / 60) * Math.PI * 2 - Math.min(1, (sec % 1) * 8) * Math.PI * 2 / 60 + Math.PI * 2 / 60; };
  return g;
}
export function spaghettiPlate(parent, x, y, z, { full = true, seed = 1 } = {}) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 16).translate(0, 0.01, 0), mat('#fbfaf6', { rough: 0.3 })));
  if (full) {
    const sm = mat('#f0cc6a', { rough: 0.7 }), R = rng(seed);
    for (let i = 0; i < 6; i++) { const t = add(g, M(new THREE.TorusGeometry(0.05 + R() * 0.025, 0.012, 4, 10), sm), (R() - 0.5) * 0.04, 0.03 + i * 0.006, (R() - 0.5) * 0.04); t.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.6); }
    add(g, M(new THREE.IcosahedronGeometry(0.04, 0).scale(1, 0.45, 1), mat('#c8321e', { rough: 0.6 })), 0, 0.065, 0);
    for (let i = 0; i < 3; i++) add(g, M(new THREE.IcosahedronGeometry(0.016, 0), mat('#6a3a24')), (R() - 0.5) * 0.06, 0.06, (R() - 0.5) * 0.06);
  }
  return g;
}
export function fork(parent, { spaghetti = true } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const fm = mat('#d8dce0', { metal: 0.85, rough: 0.25 });
  add(g, M(new THREE.BoxGeometry(0.014, 0.15, 0.006).translate(0, -0.075, 0), fm));
  for (let i = -1.5; i <= 1.5; i++) add(g, M(new THREE.BoxGeometry(0.004, 0.045, 0.004).translate(0, 0.022, 0), fm), i * 0.006, 0, 0);
  if (spaghetti) {
    const sm = mat('#f0cc6a', { rough: 0.7 });
    add(g, M(new THREE.TorusGeometry(0.022, 0.009, 4, 8).rotateY(Math.PI / 2), sm), 0, 0.03, 0);
    for (let i = 0; i < 5; i++) add(g, M(new THREE.CylinderGeometry(0.003, 0.003, 0.11 + i * 0.015, 4).translate(0, -0.06, 0), sm), (i - 2) * 0.007, 0.02, 0.004 * (i % 2));
  }
  g.userData.grip = { pos: [0, -0.12, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.tip = [0, 0.03, 0];
  return g;
}
export function waterGlass(parent, x, y, z) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10, 1, true).translate(0, 0.06, 0), mat('#dff0ff', { rough: 0.05, transparent: true, opacity: 0.4 })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.032, 0.029, 0.08, 10).translate(0, 0.04, 0), mat('#a8d4f0', { rough: 0.05, transparent: true, opacity: 0.45 })), 0, 0.002, 0);
  return g;
}
export function bucket(parent) {
  const g = new THREE.Group(); parent.add(g);
  const wm = mat(planksTex('#7a5232', 32, 21), { rough: 0.9 }); wm.side = THREE.DoubleSide;
  add(g, M(new THREE.CylinderGeometry(0.15, 0.12, 0.26, 10, 1, true).translate(0, 0.13, 0), wm));
  add(g, M(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 10).translate(0, 0.01, 0), wm));
  for (const y of [0.05, 0.21]) add(g, M(new THREE.TorusGeometry(0.13 + y * 0.1, 0.008, 4, 12).rotateX(Math.PI / 2), mat('#3a3430', { metal: 0.5 })), 0, y, 0);
  const h = add(g, M(new THREE.TorusGeometry(0.15, 0.008, 4, 10, Math.PI), mat('#3a3430', { metal: 0.5 })), 0, 0.26, 0);
  g.userData.grips = { L: { pos: [0.15, 0.2, 0], axis: [0, 0, 1], up: [0, 1, 0] }, R: { pos: [-0.15, 0.2, 0], axis: [0, 0, -1], up: [0, 1, 0] } };
  return g;
}
export function chicken(parent, x, y, z, ry = 0) {
  const g = grp(parent, x, y, z, ry);
  const wm = mat('#f2ece0', { rough: 0.9 });
  add(g, M(new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.85, 1.25), wm), 0, 0.28, 0);
  add(g, M(new THREE.IcosahedronGeometry(0.08, 0), wm), 0, 0.46, 0.15);
  add(g, M(new THREE.ConeGeometry(0.03, 0.06, 4).rotateX(Math.PI / 2), mat('#f0a020')), 0, 0.45, 0.24);
  add(g, M(new THREE.BoxGeometry(0.02, 0.06, 0.07), mat('#d8201a')), 0, 0.54, 0.15);
  for (const sx of [-1, 1]) { add(g, M(new THREE.BoxGeometry(0.01, 0.012, 0.012), mat('#111')), sx * 0.05, 0.48, 0.21); add(g, M(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4).translate(0, 0.08, 0), mat('#f0a020')), sx * 0.05, 0, 0); }
  const wings = [];
  for (const sx of [-1, 1]) { const w = grp(g, sx * 0.14, 0.32, 0); add(w, M(new THREE.BoxGeometry(0.2, 0.02, 0.16).translate(sx * 0.1, 0, 0), wm)); wings.push(w); }
  add(g, M(new THREE.ConeGeometry(0.06, 0.14, 4).rotateX(-0.6), wm), 0, 0.38, -0.2);
  g.userData.wings = wings;
  return g;
}
export function flowerPot(parent, x, z, seed = 1) {
  const g = grp(parent, x, 0, z);
  add(g, M(new THREE.CylinderGeometry(0.2, 0.14, 0.3, 8).translate(0, 0.15, 0), matNoisy('#b8603a', { amount: 12 })));
  add(g, M(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 0.8, 1), matNoisy('#3a8a3a', { amount: 18 })), 0, 0.42, 0);
  const R = rng(seed);
  for (let i = 0; i < 7; i++) { const a = R() * 6.3; add(g, M(new THREE.IcosahedronGeometry(0.045, 0), mat(['#e8344a', '#f6c23a', '#f06aa8', '#ffffff'][i % 4])), Math.cos(a) * 0.16, 0.5 + R() * 0.12, Math.sin(a) * 0.16); }
  return g;
}
export function tree(parent, x, z, s = 1, seed = 1) {
  const g = grp(parent, x, 0, z);
  add(g, M(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 6).translate(0, 0.8 * s, 0), matNoisy('#5a3a22', { amount: 14 })));
  const R = rng(seed);
  for (let i = 0; i < 3; i++) add(g, M(new THREE.IcosahedronGeometry((0.9 + R() * 0.4) * s, 0), matNoisy(['#3a7a34', '#4a8a3a', '#2f6a2e'][i], { amount: 22, seed: seed + i })), (R() - 0.5) * 0.8 * s, (2.0 + i * 0.5) * s, (R() - 0.5) * 0.8 * s);
  return g;
}
export function fly3d(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.IcosahedronGeometry(0.008, 0).scale(1.3, 1, 1), mat('#141414', { rough: 0.4 })));
  add(g, M(new THREE.IcosahedronGeometry(0.0055, 0), mat('#7a1a1a')), 0.009, 0.002, 0);
  for (const sz of [-1, 1]) { const w = add(g, M(new THREE.BoxGeometry(0.012, 0.0008, 0.007), mat('#dfe8f0', { transparent: true, opacity: 0.55 })), -0.002, 0.006, sz * 0.006); w.rotation.set(sz * 0.4, 0, 0.3); }
  return g;
}
// a framed picture on a wall (canvas texture), facing +z of the parent
export function frame(parent, canvasOrTex, x, y, z, w, h, { ry = 0, color = '#5a3a22' } = {}) {
  const g = grp(parent, x, y, z, ry);
  const t = canvasOrTex.isTexture ? canvasOrTex : (() => { const q = new THREE.CanvasTexture(canvasOrTex); q.colorSpace = THREE.SRGBColorSpace; q.magFilter = THREE.NearestFilter; return q; })();
  add(g, M(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.03), mat(color, { rough: 0.5 })), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(w, h), mat(t, { rough: 0.6, flat: false })), 0, 0, 0.016);
  return g;
}
// pixel portrait of the big serious dad (bathroom wall photo)
export function dadPortrait() {
  return textTex(48, 60, (x, w, h) => {
    const p = (a, b, c, d, col) => { x.fillStyle = col; x.fillRect(a, b, c, d); };
    p(0, 0, w, h, '#6a7a8a'); for (let yy = 0; yy < h; yy++) p(0, yy, w, 1, `rgb(${110 - yy},${125 - yy},${140 - yy})`);
    p(8, 40, 32, 20, '#3a3c43'); p(21, 40, 6, 20, '#f2f0ea'); p(23, 42, 2, 18, '#1f2d5a');            // suit, shirt, tie
    p(19, 34, 10, 7, '#c8905e');                                                                      // neck
    p(13, 12, 22, 24, '#d29a6c');                                                                     // face
    p(12, 8, 24, 6, '#9a9a96'); p(12, 12, 2, 8, '#9a9a96'); p(34, 12, 2, 8, '#9a9a96');               // grey hair
    p(16, 18, 6, 2, '#2a2622'); p(26, 18, 6, 2, '#2a2622');                                           // angry brows
    p(18, 21, 3, 3, '#120c0a'); p(27, 21, 3, 3, '#120c0a');                                           // eyes
    p(17, 28, 14, 4, '#141010');                                                                      // mustache
    p(20, 33, 8, 1, '#5a2a20');
  });
}

// ------------------------------------------------------------------ the house outside + the street (origin)
// Front of the house faces +z (front wall at z = 3). Red door at x = -1.4. Driveway x 2..5.2 with the dark-blue
// car nose-in at (3.6, 6.4). The small upstairs bathroom window is at (3.0, 4.6, 3.0), right above the driveway.
export function buildHouse(W, { night = false, doorOpen = 0, carDoor = 1, bathOpen = 0, bathGlow = false, wall = '#f2c84a', doorCol = '#b8262a', vehicle = 'car', vanX = 0 } = {}) {
  const g = new THREE.Group(); W.scene.add(g);
  const H = { group: g };
  const grass = mat(tex(paint(32, 32, (x, y) => { const d = ((x * 7 + y * 13) % 9) * 3 + ((x ^ y) & 3) * 4; return [70 + d, 130 + d, 60 + d * 0.5]; }), { repeat: [40, 40] }), { rough: 1 });
  add(g, M(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), grass), 0, 0, 0);
  const asph = mat(tex(paint(32, 32, (x, y) => { const d = ((x * 11 + y * 7) % 13) * 2; return [70 + d, 72 + d, 78 + d]; }), { repeat: [40, 2] }), { rough: 0.9 });
  add(g, M(new THREE.PlaneGeometry(160, 7).rotateX(-Math.PI / 2), asph), 0, 0.01, 17);
  const conc = mat(tilesTex('#b8b4aa', '#8a8680', 32, 3, 2), { rough: 0.9 }); conc.map.repeat.set(2, 6);
  add(g, M(new THREE.PlaneGeometry(3.2, 11).rotateX(-Math.PI / 2), conc), 3.6, 0.015, 8.5);       // driveway
  const path = mat(tilesTex('#c8b8a0', '#8a7a6a', 32, 4, 2), { rough: 0.9 }); path.map.repeat.set(1, 6);
  add(g, M(new THREE.PlaneGeometry(1.2, 10).rotateX(-Math.PI / 2), path), -1.4, 0.016, 8.0);
  const walk = mat(tilesTex('#c4c0b8', '#9a968e', 32, 5, 2), { rough: 0.9 }); walk.map.repeat.set(60, 1);
  add(g, M(new THREE.PlaneGeometry(160, 1.8).rotateX(-Math.PI / 2), walk), 0, 0.02, 13.0);
  // house body
  const wallM = mat(sidingTex(wall, 64, 5), { rough: 0.85 }); wallM.map.repeat.set(4, 4);
  const wallW = mat(sidingTex(wall, 64, 5), { rough: 0.85 });              // world-mapped (1 repeat = 2 m)
  const wpart = (x0, x1, y0, y1, z0, z1) => add(g, M(worldUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), 2), wallW));
  wpart(-4, 4, 0, 6, -3, 2.1);                                                  // main body
  const hx0 = 2.67, hx1 = 3.33, hy0 = 4.27, hy1 = 4.93;                         // the bathroom window hole
  wpart(-4, hx0, 0, 6, 2.75, 3); wpart(hx1, 4, 0, 6, 2.75, 3); wpart(hx0, hx1, 0, hy0, 2.75, 3); wpart(hx0, hx1, hy1, 6, 2.75, 3);
  for (const sx of [-4, 3.75]) wpart(sx, sx + 0.25, 0, 6, 2.1, 2.75);           // side walls of the gap
  wpart(-3.75, 3.75, 0, 3.0, 2.1, 2.75); wpart(-3.75, 3.75, 5.9, 6, 2.1, 2.75); wpart(-3.75, 2.2, 3.0, 5.9, 2.1, 2.75); wpart(3.6, 3.75, 3.0, 5.9, 2.1, 2.75);
  const roomM = night && bathGlow ? mat('#ffd890', { emissive: '#ffc860', emissiveIntensity: 1.1 }) : mat(tilesTex('#8ed6b8', '#eef8f2', 64, 13, 4), { rough: 0.5 });
  roomM.side = THREE.BackSide; if (roomM.map) roomM.map.repeat.set(2, 2);
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  add(g, M(new THREE.BoxGeometry(1.4, 2.9, 0.65), [roomM, roomM, roomM, roomM, hide, roomM], { cast: false }), 2.9, 4.45, 2.43);    // the bathroom seen through the hole
  add(g, M(boxG(8.3, 0.25, 6.3), mat('#f4f2ea')), 0, 2.95, 0);                                     // floor trim
  const roofM = mat(roofTex('#7a3a2e'), { rough: 0.9 }); roofM.map.repeat.set(6, 3);
  for (const sz of [-1, 1]) { const r = add(g, M(new THREE.BoxGeometry(8.8, 0.18, 4.3), roofM), 0, 7.05, sz * 1.55); r.rotation.x = sz * 0.68; }
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-3, 6, 0, 3, 6, 0, 0, 8.4, 0], 3)); gable.computeVertexNormals();
  for (const sx of [-1, 1]) { const gm = add(g, M(gable, wallM), sx * 4.0, 0, 0); gm.rotation.y = Math.PI / 2 * sx; gm.material = wallM.clone(); gm.material.side = THREE.DoubleSide; }
  add(g, M(boxG(0.7, 1.6, 0.7), matNoisy('#9a4a3a', { amount: 16 })), -2.4, 7.0, -1.0);           // chimney
  // windows
  const glassDay = mat('#4a6a8a', { rough: 0.08, metal: 0.3 });
  const glassLit = mat('#ffd890', { emissive: '#ffcc70', emissiveIntensity: 1.2, rough: 0.4 });
  const glassDark = mat('#1a2030', { rough: 0.1, metal: 0.2 });
  const frameM = mat('#f6f6f2', { rough: 0.6 });
  H.windows = [];
  const win = (x, y, w, h, lit) => {
    const wg = grp(g, x, y, 3.0);
    add(wg, M(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.1), frameM), 0, 0, 0.02);
    const gl = add(wg, M(new THREE.PlaneGeometry(w, h), night ? (lit ? glassLit : glassDark) : glassDay), 0, 0, 0.075);
    add(wg, M(new THREE.BoxGeometry(0.05, h, 0.04), frameM), 0, 0, 0.09); add(wg, M(new THREE.BoxGeometry(w, 0.05, 0.04), frameM), 0, 0, 0.09);
    add(wg, M(new THREE.BoxGeometry(w + 0.3, 0.07, 0.18), frameM), 0, -h / 2 - 0.1, 0.08);
    H.windows.push(wg); return wg;
  };
  win(-3.0, 1.5, 1.1, 1.2, false); win(0.6, 1.5, 1.1, 1.2, false);
  win(-3.0, 4.5, 1.0, 1.1, false); win(-1.2, 4.5, 1.0, 1.1, false); win(0.8, 4.5, 1.0, 1.1, false);
  // the small bathroom window (casement, hinged on its left edge, opens outward)
  const bw = grp(g, 3.0, 4.6, 3.0); H.bathWin = bw;
  for (const [w, h, x, y] of [[0.86, 0.1, 0, 0.38], [0.86, 0.1, 0, -0.38], [0.1, 0.86, -0.38, 0], [0.1, 0.86, 0.38, 0]]) add(bw, M(new THREE.BoxGeometry(w, h, 0.14), frameM), x, y, 0.01);
  add(bw, M(new THREE.BoxGeometry(1.0, 0.07, 0.2), frameM), 0, -0.48, 0.08);
  const sash = grp(bw, -0.33, 0, 0.08); H.sash = sash;
  add(sash, M(new THREE.BoxGeometry(0.66, 0.66, 0.04).translate(0.33, 0, 0), frameM));
  add(sash, M(new THREE.PlaneGeometry(0.56, 0.56).translate(0.33, 0, 0.022), night ? glassDark : mat('#7a9ab8', { rough: 0.05, metal: 0.4 })));
  sash.rotation.y = -1.6 * bathOpen;
  H.bathPos = V(3.0, 4.6, 3.0);
  if (bathGlow) { const pl = new THREE.PointLight(0xffd080, 6, 6, 2); pl.position.set(3.0, 4.6, 3.6); g.add(pl); glowSprite(g, [3.0, 4.6, 3.15], 2.2, 'rgba(255,210,120,1)', 0.55); }
  else { const il = new THREE.PointLight(0xfff0d8, 1.5, 2.5, 2); il.position.set(2.9, 5.4, 2.4); g.add(il); }
  // front door + porch
  const door = grp(g, -1.85, 0.12, 3.02); H.door = door;
  add(door, M(boxG(0.9, 2.05, 0.08).translate(0.45, 0, 0), matNoisy(doorCol, { amount: 10 })));
  add(door, M(new THREE.SphereGeometry(0.035, 6, 4), mat('#d8b040', { metal: 0.8, rough: 0.3 })), 0.78, 1.0, 0.07);
  for (let i = 0; i < 2; i++) add(door, M(new THREE.BoxGeometry(0.6, 0.6, 0.02), matNoisy(doorCol, { amount: 14, seed: 3 })), 0.45, 0.5 + i * 0.85, 0.045);
  door.rotation.y = -1.3 * doorOpen;
  add(g, M(new THREE.PlaneGeometry(0.9, 2.05), mat('#3a2418', { emissive: '#ffb860', emissiveIntensity: night ? 0.6 : 0.15 })), -1.4, 1.145, 3.005);
  add(g, M(boxG(1.0, 2.2, 0.06), frameM), -1.4, 0.0, 2.98).scale.set(1.18, 1.03, 1);
  add(g, M(boxG(2.2, 0.12, 1.6), mat('#c8c0b4')), -1.4, 0, 3.8);                                    // step
  add(g, M(new THREE.BoxGeometry(2.4, 0.1, 1.5), frameM), -1.4, 2.6, 3.75);                          // porch roof
  for (const sx of [-1, 1]) add(g, M(boxG(0.1, 2.55, 0.1), frameM), -1.4 + sx * 1.0, 0.05, 4.4);
  const lamp = add(g, M(new THREE.BoxGeometry(0.14, 0.2, 0.14), mat('#fff0c0', { emissive: '#ffd890', emissiveIntensity: 1.5 })), -0.7, 2.1, 3.1);
  const pl = new THREE.PointLight(0xffc880, night ? 3 : 1.5, 5, 2); pl.position.set(-0.7, 2.0, 3.5); g.add(pl);
  flowerPot(g, -2.7, 3.6, 1); flowerPot(g, -0.1, 3.6, 2); flowerPot(g, -3.3, 3.5, 3);
  // flower bed + bushes along the front
  for (let i = 0; i < 6; i++) add(g, M(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.7, 1), matNoisy('#3f8a3a', { amount: 20, seed: i })), -3.6 + i * 0.75 + (i > 2 ? 2.6 : 0), 0.2, 3.5);
  // the car
  if (vehicle === 'car') { H.car = car(g, { doorOpen: carDoor }); H.car.position.set(3.6, 0, 6.9); }
  else if (vehicle === 'van') { H.van = van(g); H.van.position.set(vanX, 0, 16.4); H.van.rotation.y = Math.PI / 2; }
  // garden, fence, trees, neighbours
  const fenceM = mat('#f2f0e8', { rough: 0.7 });
  for (let i = 0; i < 26; i++) { const x = -12 + i * 0.45; if (x > -2.2 && x < -0.6) continue; if (x > 1.8 && x < 5.4) continue; add(g, M(boxG(0.08, 0.8, 0.05), fenceM), x, 0, 12.0); }
  add(g, M(new THREE.BoxGeometry(9.6, 0.06, 0.04), fenceM), -7.3, 0.6, 12.0);
  tree(g, -6.5, 4, 1.4, 3); tree(g, 7.6, 2, 1.6, 5); tree(g, -9, -4, 1.8, 7); tree(g, 9, 9, 1.2, 9); tree(g, -13, 9, 1.5, 11);
  tree(g, 14, -6, 2.0, 13); tree(g, -16, -8, 2.2, 15); tree(g, 0, -12, 2.4, 17);
  const neighbour = (x, z, col, roofCol, s = 1) => {
    const n = grp(g, x, 0, z); const m = mat(sidingTex(col, 64, 7), { rough: 0.85 }); m.map.repeat.set(4, 4);
    add(n, M(boxG(7 * s, 5.6 * s, 6 * s), m));
    const rm = mat(roofTex(roofCol), { rough: 0.9 }); rm.map.repeat.set(5, 3);
    for (const sz of [-1, 1]) { const r = add(n, M(new THREE.BoxGeometry(7.6 * s, 0.18, 4.2 * s), rm), 0, 6.6 * s, sz * 1.5 * s); r.rotation.x = sz * 0.68; }
    for (const [wx, wy] of [[-2, 1.5], [2, 1.5], [-2, 4.2], [0, 4.2], [2, 4.2]]) {
      const lit = night && hash1(x * 3 + wx + wy) > 0.5;
      add(n, M(new THREE.PlaneGeometry(1.0 * s, 1.1 * s), night ? (lit ? glassLit : glassDark) : glassDay), wx * s, wy * s, 3.01 * s);
      add(n, M(new THREE.BoxGeometry(1.15 * s, 1.25 * s, 0.05), frameM), wx * s, wy * s, 2.99 * s);
    }
    return n;
  };
  neighbour(-13, 0, '#a8c8e8', '#4a4a5a'); neighbour(13.5, 0.5, '#f2f0ea', '#5a3a2a'); neighbour(-26, 1, '#e8a8a0', '#4a3a3a');
  neighbour(26, 0, '#c8e0b0', '#5a4a3a'); neighbour(-4, 24, '#e0d0b0', '#5a3a2a').rotation.y = Math.PI; neighbour(9, 24, '#b0c8d8', '#4a4a5a').rotation.y = Math.PI;
  for (let i = -6; i <= 6; i++) { if (i === 0) continue; add(g, M(boxG(0.12, 3.6, 0.12), mat('#5a5a5a')), i * 9 + 1, 0, 14.2); if (night) { add(g, M(new THREE.BoxGeometry(0.4, 0.15, 0.3), mat('#fff0c0', { emissive: '#ffd890', emissiveIntensity: 2 })), i * 9 + 1, 3.6, 14.2); } }
  if (night) { const sl = new THREE.PointLight(0xffd080, 4, 12, 2); sl.position.set(10, 3.4, 14.2); g.add(sl); }
  return H;
}

// ------------------------------------------------------------------ upstairs hallway (x = 60)
// Corridor along -z (from z = 2 to z = -5), 1.8 m wide. The white bathroom door is on the right wall (x = +0.9)
// at z = -3.2, open a little, warm light inside.
export function buildHallway(W, { x0 = 60 } = {}) {
  const g = grp(W.scene, x0); const H = { group: g, x0 };
  const fm = mat(planksTex('#a8743e', 64, 7), { rough: 0.6 }); fm.map.repeat.set(2, 6);
  add(g, M(new THREE.PlaneGeometry(1.8, 9).rotateX(-Math.PI / 2), fm), 0, 0, -1.5);
  const wm = mat(wallpaperTex('#f0d8b0', '#e6c89c'), { rough: 0.9 }); wm.map.repeat.set(10, 3);
  for (const sx of [-1, 1]) { const w = add(g, M(new THREE.PlaneGeometry(9, 2.7), wm), sx * 0.9, 1.35, -1.5); w.rotation.y = -sx * Math.PI / 2; }
  add(g, M(new THREE.PlaneGeometry(1.8, 2.7), wm), 0, 1.35, -6.0);
  add(g, M(new THREE.PlaneGeometry(1.8, 9).rotateX(Math.PI / 2), matNoisy('#f6f0e4', { amount: 5 })), 0, 2.7, -1.5);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.03, 0.12, 9), mat('#f6f2e8')), sx * 0.885, 0.06, -1.5);
  // bathroom door (right wall), hinged at the back edge, open a little
  const frameM = mat('#f6f6f2', { rough: 0.6 });
  add(g, M(new THREE.BoxGeometry(0.06, 2.15, 1.0), frameM), 0.89, 1.075, -3.2);
  add(g, M(new THREE.PlaneGeometry(0.84, 2.05), mat('#ffe0a8', { emissive: '#ffd090', emissiveIntensity: 1.0 })), 0.875, 1.025, -3.2).rotation.y = -Math.PI / 2;
  const door = grp(g, 0.86, 0.0, -3.62); H.door = door;
  add(door, M(boxG(0.05, 2.03, 0.84).translate(0, 0, 0.42), mat('#fbfbf6', { rough: 0.5 })));
  add(door, M(new THREE.SphereGeometry(0.03, 6, 4), mat('#d8b040', { metal: 0.8, rough: 0.3 })), -0.05, 1.0, 0.75);
  door.rotation.y = -0.45;
  const pl = new THREE.PointLight(0xffd8a0, 2.5, 4, 2); pl.position.set(1.4, 1.6, -3.2); g.add(pl);
  // family photos
  const P = photoCanvases();
  frame(g, P.fam, -0.88, 1.6, -1.0, 0.5, 0.36, { ry: Math.PI / 2 });
  frame(g, P.dog, -0.88, 1.5, -2.2, 0.3, 0.3, { ry: Math.PI / 2 });
  frame(g, P.wedding, -0.88, 1.65, -3.2, 0.3, 0.38, { ry: Math.PI / 2 });
  frame(g, P.baby, 0.88, 1.6, -1.4, 0.26, 0.32, { ry: -Math.PI / 2 });
  frame(g, P.landscape, 0.88, 1.6, -0.3, 0.5, 0.33, { ry: -Math.PI / 2 });
  frame(g, dadPortrait(), -0.88, 1.6, -4.3, 0.34, 0.42, { ry: Math.PI / 2 });
  // little table with a vase + runner
  add(g, M(boxG(0.4, 0.8, 1.0), mat(planksTex('#6a4024', 32, 9))), -0.68, 0, 0.6);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8).translate(0, 0.125, 0), mat('#4a7ab0', { rough: 0.3 })), -0.68, 0.8, 0.6);
  for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffd8a8, 1.8, 5, 2); l.position.set(0, 2.5, -i * 3); g.add(l); add(g, M(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10), mat('#fff4dc', { emissive: '#ffe0b0', emissiveIntensity: 1.2 })), 0, 2.66, -i * 3); }
  return H;
}

// ------------------------------------------------------------------ bathroom (x = -60)
// Small room x -1.2..1.2, z -1.1..1.2. Toilet against the back wall (bowl centre x = -0.45, z = -0.72) facing +z,
// chrome flush button on top of the tank. The small square window is in the right wall (x = 1.2), centre
// z = -0.25, y = 1.7 (0.62 square), casement opening outward. Dad's portrait hangs on the back wall.
export const BATH = { x0: -60, bowl: [-0.45, -0.72], seatY: 0.43, win: [1.2, 1.7, -0.25] };
export function buildBathroom(W, { x0 = -60, water = 0, open = 0, golden = 0, curtain = true } = {}) {
  const g = grp(W.scene, x0); const B = { group: g, x0 };
  const tm = mat(tilesTex('#8ed6b8', '#eef8f2', 64, 13, 4), { rough: 0.35 }); tm.map.repeat.set(6, 6);
  const fm = mat(checkerTex('#f4f4f0', '#9aa8a2', 64, 8, 5), { rough: 0.4 }); fm.map.repeat.set(2, 2);
  add(g, M(new THREE.PlaneGeometry(2.4, 2.3).rotateX(-Math.PI / 2), fm), 0, 0, 0.05);
  add(g, M(new THREE.PlaneGeometry(2.4, 2.6), tm), 0, 1.3, -1.1);                                 // back wall
  add(g, M(new THREE.PlaneGeometry(2.3, 2.6), tm), -1.2, 1.3, 0.05).rotation.y = Math.PI / 2;     // left wall
  add(g, M(new THREE.PlaneGeometry(2.4, 2.6), tm), 0, 1.3, 1.2).rotation.y = Math.PI;              // front wall (behind camera)
  // right wall with the window hole (z -0.56..0.06, y 1.39..2.01)
  const wz0 = -0.56, wz1 = 0.06, wy0 = 1.39, wy1 = 2.01;
  const part = (z0, z1, y0, y1) => { const m = add(g, M(new THREE.PlaneGeometry(z1 - z0, y1 - y0), tm), 1.2, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.y = -Math.PI / 2; };
  part(-1.1, wz0, 0, 2.6); part(wz1, 1.2, 0, 2.6); part(wz0, wz1, 0, wy0); part(wz0, wz1, wy1, 2.6);
  add(g, M(new THREE.PlaneGeometry(2.4, 2.3).rotateX(Math.PI / 2), matNoisy('#f6f6f0', { amount: 4 })), 0, 2.6, 0.05);
  // window frame + sash + outside sky
  const frameM = mat('#fbfbf6', { rough: 0.5 });
  const wf = grp(g, 1.2, (wy0 + wy1) / 2, (wz0 + wz1) / 2); B.win = wf;
  for (const [w, h, y, z] of [[0.12, 0.74, 0, -0.37], [0.12, 0.74, 0, 0.37], [0.12, 0.08, 0.35, 0], [0.12, 0.08, -0.35, 0]]) add(wf, M(new THREE.BoxGeometry(w, h, z === 0 ? 0.74 : 0.08), frameM), 0, y, z);
  add(wf, M(new THREE.BoxGeometry(0.22, 0.04, 0.82), frameM), -0.06, -0.37, 0);                    // sill
  const sash = grp(wf, 0.06, 0, -0.31); B.sash = sash;
  add(sash, M(new THREE.BoxGeometry(0.04, 0.62, 0.62).translate(0, 0, 0.31), frameM));
  add(sash, M(new THREE.PlaneGeometry(0.52, 0.52).translate(0, 0, 0).rotateY(Math.PI / 2).translate(-0.022, 0, 0.31), mat('#bcd8e8', { rough: 0.05, metal: 0.3, transparent: true, opacity: 0.35 })));
  sash.rotation.y = 1.7 * open;
  const skyM = new THREE.MeshBasicMaterial({ map: skyTex('sunset'), fog: false });
  const sky = add(g, M(new THREE.PlaneGeometry(14, 10), skyM, { cast: false, receive: false }), 6, 1.5, -0.25); sky.rotation.y = -Math.PI / 2;
  // rooftops + a tree seen through the window
  add(g, M(boxG(3, 1.0, 4), mat('#7a3a2e')), 5, 0.6, 1.5); add(g, M(new THREE.IcosahedronGeometry(1.2, 0), matNoisy('#3a7a34', { amount: 20 })), 5.4, 1.7, -2.4);
  if (curtain) {
    const cm = mat('#ffffff', { transparent: true, opacity: 0.75, rough: 0.9 }); cm.side = THREE.DoubleSide;
    const c = new THREE.PlaneGeometry(0.66, 0.22, 6, 1); const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i)); c.computeVertexNormals();
    B.curtain = add(g, M(c, cm, { cast: false }), 1.12, wy1 - 0.1, (wz0 + wz1) / 2); B.curtain.rotation.y = -Math.PI / 2;
  }
  // golden light through the window (shots 11, 12)
  B.golden = [];
  if (golden > 0) {
    const wc = [1.2, (wy0 + wy1) / 2, (wz0 + wz1) / 2];
    B.golden.push(beam(g, [wc[0] + 0.3, wc[1] + 0.2, wc[2]], [-0.9, 0.6, wc[2] + 0.1], 0.3, 0.9, 0xffd27a, 0.13 * golden));
    B.golden.push(beam(g, [wc[0] + 0.3, wc[1] + 0.25, wc[2] + 0.12], [-0.6, 0.2, wc[2] + 0.6], 0.18, 0.6, 0xffe2a0, 0.09 * golden));
    B.golden.push(beam(g, [wc[0] + 0.3, wc[1] + 0.15, wc[2] - 0.15], [-0.7, 0.9, wc[2] - 0.6], 0.15, 0.5, 0xffe2a0, 0.08 * golden));
    const sp = new THREE.SpotLight(0xffd080, 14 * golden, 8, 0.5, 0.5, 1.5); sp.position.set(x0 + 2.2, 2.2, wc[2]); sp.target.position.set(x0 - 0.6, 1.0, wc[2] + 0.2);
    sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); W.scene.add(sp); W.scene.add(sp.target);
    B.glow = glowSprite(g, [1.3, wc[1], wc[2]], 1.1, 'rgba(255,214,130,1)', 0.45 * golden);
    const R = rng(9), dpos = [];
    for (let i = 0; i < 70; i++) { const k = R(); dpos.push(lerp(1.1, -0.6, k) + (R() - 0.5) * 0.3, lerp(1.75, 0.8, k) + (R() - 0.5) * 0.5, -0.25 + (R() - 0.5) * 0.7); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
    B.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c0, size: 0.012, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(B.dust);
  }
  // toilet
  const white = mat('#fbfbf8', { rough: 0.18 });
  const tg = grp(g, BATH.bowl[0], 0, BATH.bowl[1]); B.toilet = tg;
  const prof = [[0.0, 0.0], [0.13, 0.0], [0.14, 0.12], [0.2, 0.3], [0.215, 0.4], [0.2, 0.41], [0.17, 0.38], [0.11, 0.24], [0.07, 0.16], [0.0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.LatheGeometry(prof, 16); bowl.scale(1, 1, 1.22);
  add(tg, M(bowl, white), 0, 0, 0.02);
  add(tg, M(boxG(0.44, 0.4, 0.2), white), 0, 0.38, -0.3);                                           // tank
  add(tg, M(boxG(0.47, 0.04, 0.23), white), 0, 0.78, -0.3);                                          // tank lid
  B.button = add(tg, M(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 14).translate(0, 0.01, 0), mat('#e8ecf2', { metal: 0.35, rough: 0.25 })), 0, 0.815, -0.3);
  add(tg, M(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 14), mat('#c4cad2', { metal: 0.35, rough: 0.3 })), 0, 0.812, -0.3);
  add(tg, M(boxG(0.16, 0.38, 0.14), white), 0, 0, -0.22);
  const seat = new THREE.TorusGeometry(0.17, 0.028, 4, 16); seat.rotateX(Math.PI / 2); seat.scale(1, 1, 1.25);
  add(tg, M(seat, mat('#ffffff', { rough: 0.3 })), 0, 0.425, 0.03);
  const lid = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 14); lid.scale(1, 1, 1.25); lid.rotateX(Math.PI / 2 - 0.12);
  add(tg, M(lid, mat('#ffffff', { rough: 0.3 })), 0, 0.64, -0.17);                                   // lid up against the tank
  const wm = mat('#9ad2ec', { rough: 0.02, metal: 0.2, transparent: true, opacity: 0.85 });
  const wy = lerp(0.2, 0.395, water), wr = lerp(0.085, 0.2, Math.pow(water, 0.8));
  B.water = add(tg, M(new THREE.CircleGeometry(wr, 16).rotateX(-Math.PI / 2).scale(1, 1, 1.22), wm, { cast: false }), 0, wy, 0.02);
  B.waterInfo = { lerpY: [0.2, 0.395], lerpR: [0.085, 0.2], r0: wr };
  // towel rail + yellow towel, sink + mirror, roll holder, photos, rug
  add(g, M(new THREE.BoxGeometry(0.6, 0.025, 0.025), mat('#d0d4d8', { metal: 0.9, rough: 0.2 })), 0.55, 1.3, -1.06);
  add(g, M(boxG(0.5, 0.6, 0.05), matNoisy('#f6c63a', { amount: 14 })), 0.55, 0.72, -1.05);
  add(g, M(boxG(0.5, 0.82, 0.38), mat('#f4f2ec', { rough: 0.5 })), 0.65, 0, -0.9);
  add(g, M(boxG(0.54, 0.06, 0.42), white), 0.65, 0.82, -0.9);
  frame(g, dadPortrait(), -0.45, 1.55, -1.08, 0.34, 0.42);
  frame(g, photoCanvases().fam, 0.0, 1.85, -1.08, 0.3, 0.22, { color: '#f6f2e8' });
  const holder = grp(g, -1.17, 0.7, -0.4); add(holder, M(new THREE.BoxGeometry(0.03, 0.04, 0.16), mat('#d0d4d8', { metal: 0.9, rough: 0.2 })));
  const r = rollProp(holder); r.rotation.x = Math.PI / 2; r.position.set(0.07, -0.02, 0);
  add(g, M(new THREE.CylinderGeometry(0.35, 0.35, 0.012, 14).scale(1.3, 1, 0.8), matNoisy('#f2a8b8', { amount: 14 })), 0.0, 0.006, 0.2);
  // lights: ceiling lamp + soft window light
  add(g, M(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), mat('#fff8e8', { emissive: '#fff0d0', emissiveIntensity: 1.3 })), 0, 2.58, 0.05);
  const pl = new THREE.PointLight(0xfff0dc, 3.2, 6, 2); pl.position.set(0, 2.3, 0.3); g.add(pl);
  const wl = new THREE.PointLight(0xffd8a0, 1.4 + golden * 1.5, 4, 2); wl.position.set(0.9, 1.7, -0.25); g.add(wl);
  return B;
}
export function setWater(B, level) {
  const k = clamp(level), y = lerp(...B.waterInfo.lerpY, k), r = lerp(...B.waterInfo.lerpR, Math.pow(k, 0.8));
  B.water.position.y = y; const k2 = r / B.waterInfo.r0; B.water.scale.set(k2, 1, k2);
}

// ------------------------------------------------------------------ dining room (x = 120)
// Table along z (x -0.55..0.55, z -1.3..1.3, top at 0.76). Dad at the far end (0, -1.75) facing +z. YOU on the
// left side (-0.85, -0.55) facing +x, GF next to him (-0.85, 0.4). Mom stands on the right (0.95, -0.3), little
// brother sits right (0.85, 0.5) facing -x. Round wall clock on the back wall behind the dad (0, 2.05, -2.95).
export const DIN = { x0: 120, top: 0.76, dad: [0, -1.75], you: [-0.86, -0.55], gf: [-0.86, 0.42], mom: [0.98, -0.35], bro: [0.86, 0.5], clock: [0, 2.05, -2.94] };
export function buildDining(W, { x0 = 120, night = true } = {}) {
  const g = grp(W.scene, x0); const D = { group: g, x0 };
  const fm = mat(planksTex('#8a5a32', 64, 11), { rough: 0.6 }); fm.map.repeat.set(4, 4);
  add(g, M(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), fm), 0, 0, 0);
  const wm = mat(wallpaperTex('#d8a868', '#c89458', 32, 23), { rough: 0.9 }); wm.map.repeat.set(10, 4);
  for (const [w, x, z, ry] of [[7, 0, -3.0, 0], [7, -3.5, 0, Math.PI / 2], [7, 3.5, 0, -Math.PI / 2], [7, 0, 3.5, Math.PI]]) add(g, M(new THREE.PlaneGeometry(w, 3.0), wm), x, 1.5, z).rotation.y = ry;
  const pan = mat(planksTex('#6a4024', 32, 12), { rough: 0.6 }); pan.map.repeat.set(8, 1);
  for (const [w, x, z, ry] of [[7, 0, -2.99, 0], [7, -3.49, 0, Math.PI / 2], [7, 3.49, 0, -Math.PI / 2]]) add(g, M(new THREE.PlaneGeometry(w, 0.9), pan), x, 0.45, z).rotation.y = ry;
  add(g, M(new THREE.PlaneGeometry(7, 7).rotateX(Math.PI / 2), matNoisy('#f2e8d8', { amount: 5 })), 0, 3.0, 0);
  // table + white tablecloth
  const wood = mat(planksTex('#6a4024', 32, 9), { rough: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, M(boxG(0.07, 0.72, 0.07), wood), sx * 0.48, 0, sz * 1.2);
  const cloth = mat(tex(paint(32, 32, (x, y) => { const v = 246 - ((x % 8 === 0 || y % 8 === 0) ? 10 : 0) - ((x * 3 + y * 7) % 5); return [v, v - 2, v - 6]; }), { repeat: [3, 6] }), { rough: 0.9 });
  add(g, M(boxG(1.2, 0.04, 2.8), cloth), 0, 0.72, 0);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.01, 0.25, 2.8), cloth), sx * 0.6, 0.62, 0);
  for (const sz of [-1, 1]) add(g, M(new THREE.BoxGeometry(1.2, 0.25, 0.01), cloth), 0, 0.62, sz * 1.4);
  // chairs
  const chair = (x, z, ry) => { const c = grp(g, x, 0, z, ry); add(c, M(boxG(0.42, 0.05, 0.42), wood), 0, CHAIR.seatY - 0.05, 0); for (const a of [-1, 1]) for (const b of [-1, 1]) add(c, M(boxG(0.04, CHAIR.seatY - 0.05, 0.04), wood), a * 0.18, 0, b * 0.18); add(c, M(boxG(0.42, 0.55, 0.04), wood), 0, CHAIR.seatY, -0.2); return c; };
  chair(DIN.dad[0], DIN.dad[1], 0); chair(DIN.you[0], DIN.you[1], Math.PI / 2); chair(DIN.gf[0], DIN.gf[1], Math.PI / 2);
  chair(DIN.bro[0], DIN.bro[1], -Math.PI / 2); chair(0.86, -0.45, -Math.PI / 2);
  // plates, glasses, a big spaghetti bowl, candles
  const T = DIN.top;
  D.plates = [spaghettiPlate(g, 0, T, -1.12, { seed: 1 }), spaghettiPlate(g, -0.33, T, -0.55, { seed: 2 }), spaghettiPlate(g, -0.33, T, 0.42, { seed: 3 }), spaghettiPlate(g, 0.33, T, 0.5, { seed: 4 }), spaghettiPlate(g, 0.33, T, -0.4, { seed: 5, full: false })];
  for (const [x, z] of [[0.18, -1.2], [-0.4, -0.3], [-0.4, 0.65], [0.4, 0.75]]) waterGlass(g, x, T, z);
  const big = grp(g, 0.05, T, 0.0); add(big, M(new THREE.CylinderGeometry(0.2, 0.13, 0.12, 14, 1, true).translate(0, 0.06, 0), mat('#f4f0e6', { rough: 0.3, side: THREE.DoubleSide })));
  spaghettiPlate(big, 0, 0.03, 0, { seed: 9 }).scale.setScalar(1.3);
  for (const z of [-0.6, 0.6]) { add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6).translate(0, 0.11, 0), mat('#f6f0dc')), 0.12, T, z); glowSprite(g, [0.12, T + 0.25, z], 0.22, 'rgba(255,200,120,1)', 0.9); add(g, M(new THREE.ConeGeometry(0.012, 0.035, 5), mat('#ffd060', { emissive: '#ffb030', emissiveIntensity: 2 })), 0.12, T + 0.245, z); }
  // the round wall clock behind the dad
  D.clock = wallClock(g, { r: 0.26 }); D.clock.position.set(...DIN.clock);
  // window with curtains (night), sideboard, pictures
  const win = grp(g, 3.48, 1.6, 0.6, -Math.PI / 2);
  add(win, M(new THREE.PlaneGeometry(1.2, 1.3), mat(night ? '#0e1630' : '#9ac0e0', { rough: 0.1 })), 0, 0, 0.01);
  add(win, M(new THREE.BoxGeometry(1.32, 1.42, 0.05), mat('#f6f2e8')), 0, 0, -0.01);
  for (const sx of [-1, 1]) add(win, M(boxG(0.45, 1.9, 0.06), matNoisy('#8a2a2a', { amount: 14 })), sx * 0.8, -1.0, 0.05);
  add(g, M(boxG(1.6, 0.9, 0.45), wood), -2.0, 0, -2.75);
  frame(g, photoCanvases().fam, -2.0, 1.7, -2.97, 0.6, 0.43);
  frame(g, photoCanvases().landscape, 1.8, 1.7, -2.97, 0.7, 0.47);
  // pendant lamp over the table
  const shade = new THREE.ConeGeometry(0.32, 0.26, 10, 1, true); const sm = mat('#2a5a3a', { rough: 0.6 }); sm.side = THREE.DoubleSide;
  add(g, M(shade, sm, { cast: false }), 0, 1.95, -0.2);
  add(g, M(new THREE.CylinderGeometry(0.006, 0.006, 1.0, 4), mat('#222')), 0, 2.5, -0.2);
  add(g, M(new THREE.SphereGeometry(0.07, 8, 6), mat('#fff4d0', { emissive: '#ffe0a0', emissiveIntensity: 2 }), { cast: false }), 0, 1.86, -0.2);
  const pl = new THREE.PointLight(0xffd8a0, 7, 7, 1.8); pl.position.set(0, 1.75, -0.2); pl.castShadow = true; pl.shadow.mapSize.set(1024, 1024); pl.shadow.bias = -0.002; g.add(pl);
  return D;
}

// ------------------------------------------------------------------ old Edinburgh (x = 200): steep narrow street
// Street along -z, rising uphill (y = slope * -z beyond z < 0). Tall crooked stone houses both sides (x = +-2.4
// faces), laundry lines across, the castle on its rock far up the street. The bonnet woman's window is in the left
// house at (x -2.4, y 4.3, z -3.0) facing +x.
export const OLD = { x0: 200, slope: 0.12, win: [-2.4, 4.3, -3.0] };
export function streetY(z) { return z < 0 ? -z * OLD.slope : 0; }
export function buildOldStreet(W, { x0 = 200 } = {}) {
  const g = grp(W.scene, x0); const O = { group: g, x0 };
  const cm = mat(cobbleTex(), { rough: 0.95 }); cm.map.repeat.set(3, 24);
  const road = new THREE.PlaneGeometry(4.8, 60, 1, 30).rotateX(-Math.PI / 2); const rp = road.attributes.position;
  for (let i = 0; i < rp.count; i++) { const z = rp.getZ(i) - 20; rp.setZ(i, z); rp.setY(i, streetY(z)); }
  road.computeVertexNormals(); add(g, M(road, cm), 0, 0, 0);
  const stone = (seed, hex) => { const m = mat(stoneTex(hex, 64, seed), { rough: 0.95 }); m.map.repeat.set(3, 4); return m; };
  const woodM = mat(planksTex('#5a3a22', 32, 31), { rough: 0.9 });
  const darkWin = mat('#1a1410', { rough: 1 });
  const R = rng(5);
  O.houses = [];
  for (const side of [-1, 1]) {
    let z = 4;
    let k = 0;
    while (z > -36) {
      let w = 3.2 + R() * 1.6; const h = 9 + R() * 5, d = 5, y0 = streetY(z) - 0.5;
      if (side < 0 && k === 1) w = Math.max(w, z - (OLD.win[2] - 0.8));   // this house holds the bonnet woman's window
      const hz = z - w / 2;
      const hg = grp(g, side * (2.4 + d / 2), y0, hz);
      hg.rotation.z = (R() - 0.5) * 0.035; hg.rotation.y = (R() - 0.5) * 0.04;
      const m = stone(11 + k + (side > 0 ? 40 : 0), ['#8a8478', '#7a7468', '#948c7e', '#6e6a62'][k % 4]);
      const isWinHouse = side < 0 && k === 1;
      if (isWinHouse) {
        // the front wall is a 0.3 m slab with a real window hole; behind it a dark little room, then the house body
        const fx = -side * (d / 2 - 0.15);
        const wy0 = OLD.win[1] - 0.45 - y0, wy1 = OLD.win[1] + 0.45 - y0, wz0 = OLD.win[2] - 0.5 - hz, wz1 = OLD.win[2] + 0.5 - hz;
        const part = (za, zb, ya, yb) => add(hg, M(new THREE.BoxGeometry(0.3, yb - ya, zb - za), m), fx, (ya + yb) / 2, (za + zb) / 2);
        part(-w / 2, wz0, 0, h); part(wz1, w / 2, 0, h); part(wz0, wz1, 0, wy0); part(wz0, wz1, wy1, h);
        add(hg, M(new THREE.BoxGeometry(d - 1.3, h, w), m), side * 0.65, h / 2, 0);
        const room = mat('#2a2018', { rough: 1 }); room.side = THREE.BackSide;
        add(hg, M(new THREE.BoxGeometry(1.0, 2.2, 1.8), room, { cast: false }), -side * (d / 2 - 0.8), (wy0 + wy1) / 2 - 0.3, (wz0 + wz1) / 2);
        // wooden window frame + open shutters
        for (const yy of [wy0 - 0.05, wy1 + 0.05]) add(hg, M(new THREE.BoxGeometry(0.2, 0.1, wz1 - wz0 + 0.2), woodM), fx - side * 0.04, yy, (wz0 + wz1) / 2);
        for (const zz of [wz0 - 0.05, wz1 + 0.05]) add(hg, M(new THREE.BoxGeometry(0.2, wy1 - wy0 + 0.2, 0.1), woodM), fx - side * 0.04, (wy0 + wy1) / 2, zz);
        for (const [zz, sg] of [[wz0 - 0.3, -1], [wz1 + 0.3, 1]]) { const sh = add(hg, M(new THREE.BoxGeometry(0.05, wy1 - wy0, 0.48), woodM), fx - side * 0.2, (wy0 + wy1) / 2, zz); sh.rotation.y = sg * 0.5; }
        O.winHouse = hg;
      } else {
        add(hg, M(new THREE.BoxGeometry(d, h, w), m), 0, h / 2, 0);
      }
      // windows (dark with wooden frames + shutters), a door at street level
      const face = -side * (d / 2 + 0.01);
      for (let fl = 0; fl < Math.floor(h / 2.4); fl++) for (let c = -1; c <= 1; c += 2) {
        const wy = 1.9 + fl * 2.3, wz = c * w * 0.22;
        if (isWinHouse && Math.abs(wy + y0 - OLD.win[1]) < 1.2) continue;
        const wn = grp(hg, face, wy, wz, side < 0 ? Math.PI / 2 : -Math.PI / 2);
        add(wn, M(new THREE.PlaneGeometry(0.62, 0.86), darkWin), 0, 0, 0.01);
        add(wn, M(new THREE.BoxGeometry(0.74, 0.96, 0.04), woodM), 0, 0, -0.005);
        if (R() > 0.4) for (const sx of [-1, 1]) add(wn, M(new THREE.BoxGeometry(0.34, 0.86, 0.03), woodM), sx * 0.52, 0, 0.03).rotation.y = sx * 0.5;
      }
      add(hg, M(new THREE.PlaneGeometry(0.9, 1.9), woodM), face, 0.95 + 0.5, w * 0.3).rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      // pointed roof
      const rf = new THREE.ConeGeometry(Math.max(d, w) * 0.72, 2.2 + R() * 1.2, 4); rf.rotateY(Math.PI / 4); rf.scale(d / Math.max(d, w), 1, w / Math.max(d, w));
      add(hg, M(rf, matNoisy('#4a3e36', { amount: 16 })), 0, h + 1.1, 0);
      add(hg, M(boxG(0.5, 1.3, 0.5), stone(70 + k, '#7a7468')), (R() - 0.5) * 2, h + 0.5, (R() - 0.5) * w * 0.5);
      O.houses.push(hg);
      z -= w + 0.05; k++;
    }
  }
  // laundry lines across the street
  const lineM = mat('#d8d0c0');
  const clothCols = ['#f2eee4', '#c84a3a', '#4a6a9a', '#e8d070', '#f2eee4', '#8a6a4a'];
  for (const [zl, yl] of [[-6.5, 6.6], [-11, 7.6], [-16.5, 8.6], [-22, 9.4]]) {
    const yy = yl + streetY(zl) * 0.5;
    add(g, M(new THREE.CylinderGeometry(0.01, 0.01, 4.8, 3).rotateZ(Math.PI / 2), lineM, { cast: false }), 0, yy, zl);
    for (let i = 0; i < 6; i++) { const cw = 0.3 + R() * 0.3, ch = 0.35 + R() * 0.4; add(g, M(new THREE.BoxGeometry(cw, ch, 0.01), mat(clothCols[(i + Math.round(zl)) % clothCols.length], { rough: 0.9 })), -1.9 + i * 0.75, yy - ch / 2, zl); }
  }
  // the castle on its rock, far up the street
  const rock = new THREE.IcosahedronGeometry(9, 1); rock.scale(1.4, 0.9, 1.0);
  add(g, M(rock, matNoisy('#5a564c', { amount: 22 })), 0, streetY(-58) + 1, -62);
  const cs = stone(90, '#8a8478'); cs.map.repeat.set(4, 2);
  const cy = streetY(-58) + 8;
  add(g, M(boxG(11, 4, 5), cs), 0, cy, -62);
  for (const [x, hgt] of [[-5, 7], [5, 7.5], [0, 9], [-2.4, 6]]) {
    add(g, M(new THREE.CylinderGeometry(1.1, 1.2, hgt, 8).translate(0, hgt / 2, 0), cs), x, cy, -61);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(g, M(boxG(0.4, 0.5, 0.4), cs), x + Math.cos(a) * 1.05, cy + hgt, -61 + Math.sin(a) * 1.05); }
  }
  for (let i = -5; i <= 5; i++) add(g, M(boxG(0.6, 0.6, 0.5), cs), i * 1.0, cy + 4, -59.6);
  add(g, M(new THREE.BoxGeometry(0.05, 1.2, 0.8), mat('#c8322e')), 0.0, cy + 9.6, -61);   // flag
  return O;
}

// ================================================================== plumber reel: props
export function van(parent) {
  const g = new THREE.Group(); parent.add(g);
  const body = mat(tex(paint(16, 16, (x, y) => { const d = ((x * 5 + y * 3) % 7) - 3; return [236 + d, 238 + d, 240 + d]; })), { rough: 0.35, metal: 0.1 });
  const glass = mat('#20283a', { rough: 0.05, metal: 0.4 }), tyre = mat('#141414'), chrome = mat('#c8ccd0', { metal: 0.6, rough: 0.3 });
  add(g, M(boxG(2.0, 1.95, 3.6), body), 0, 0.35, -0.7);                       // cargo box
  add(g, M(boxG(2.0, 1.2, 1.5), body), 0, 0.35, 1.8);                         // cab
  const ws = new THREE.BoxGeometry(1.8, 0.7, 0.05); ws.rotateX(-0.35); add(g, M(ws, glass), 0, 1.25, 2.45);
  add(g, M(new THREE.BoxGeometry(1.9, 0.5, 1.2), glass), 0, 1.65, 1.6).scale.set(1, 1, 0.98);
  add(g, M(boxG(2.02, 0.5, 0.6), body), 0, 1.55, 1.25);
  for (const [x, z] of [[-0.95, 1.9], [0.95, 1.9], [-0.95, -1.6], [0.95, -1.6]]) {
    const w = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10); w.rotateZ(Math.PI / 2); add(g, M(w, tyre), x, 0.36, z);
    const hb = new THREE.CylinderGeometry(0.15, 0.15, 0.27, 8); hb.rotateZ(Math.PI / 2); add(g, M(hb, chrome), x, 0.36, z);
  }
  // blue stripe + a big friendly wrench/drop logo on the side (no text)
  for (const sx of [-1, 1]) {
    add(g, M(new THREE.BoxGeometry(0.02, 0.18, 5.0), mat('#2f5aa8')), sx * 1.005, 0.85, 0.3);
    const logo = add(g, M(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 12), mat('#2f8ad8')), sx * 1.01, 1.55, -0.6); logo.rotation.z = Math.PI / 2;
    const drop = add(g, M(new THREE.ConeGeometry(0.15, 0.3, 8), mat('#ffffff')), sx * 1.025, 1.6, -0.6); drop.rotation.z = 0;
  }
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.32, 0.14, 0.04), mat('#fff6d8', { emissive: '#fff0c0', emissiveIntensity: 0.8 })), sx * 0.7, 0.75, 2.56);
  add(g, M(new THREE.BoxGeometry(1.9, 0.14, 0.08), chrome), 0, 0.5, 2.58);
  add(g, M(new THREE.BoxGeometry(1.6, 0.05, 0.6), mat('#8a8a8a', { metal: 0.5 })), 0, 2.33, -0.4);       // roof ladder rack
  return g;
}
export function plunger(parent, { broken = false } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const wood = mat(planksTex('#b07a42', 16, 3), { rough: 0.6 });
  const cup = new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); cup.scale(1, 0.9, 1);
  const cupM = mat('#b8261e', { rough: 0.5 }); cupM.side = THREE.DoubleSide;
  g.userData.cup = add(g, M(cup, cupM), 0, 0, 0);
  g.userData.lower = add(g, M(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6).translate(0, 0.18, 0), wood), 0, 0.06, 0);
  const upper = new THREE.Group(); upper.position.set(0, 0.42, 0); g.add(upper);
  add(upper, M(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 6).translate(0, 0.19, 0), wood));
  g.userData.upper = upper;
  for (const k of [0, 1]) add(k ? upper : g, M(new THREE.ConeGeometry(0.016, 0.03, 5).rotateX(k ? Math.PI : 0), wood), 0, k ? 0.0 : 0.43, 0);
  if (broken) upper.visible = false;
  g.userData.grip = { pos: [0, 0.72, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.grips = { L: { pos: [0, 0.75, 0], axis: [0, 1, 0], up: [0, 0, 1] }, R: { pos: [0, 0.62, 0], axis: [0, 1, 0], up: [0, 0, 1] } };
  return g;
}
export function stick(parent) {     // the broken upper half of the plunger handle
  const g = new THREE.Group(); parent.add(g);
  const wood = mat(planksTex('#b07a42', 16, 3), { rough: 0.6 });
  add(g, M(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 6).translate(0, 0.19, 0), wood));
  for (let i = 0; i < 4; i++) add(g, M(new THREE.ConeGeometry(0.006, 0.035, 3), wood), (i - 1.5) * 0.007, -0.012, (i % 2) * 0.006).rotation.x = Math.PI;
  g.userData.grip = { pos: [0, 0.22, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function toolbox(parent) {
  const g = new THREE.Group(); parent.add(g);
  const red = mat(tex(paint(16, 16, (x, y) => { const d = ((x * 3 + y * 7) % 5) * 3; return [196 + d, 40 + d, 32 + d]; })), { rough: 0.4, metal: 0.4 });
  add(g, M(new THREE.BoxGeometry(0.46, 0.2, 0.22), red), 0, -0.22, 0);
  add(g, M(new THREE.BoxGeometry(0.47, 0.03, 0.23), mat('#8a1a14', { metal: 0.4 })), 0, -0.12, 0);
  add(g, M(new THREE.TorusGeometry(0.07, 0.012, 4, 8, Math.PI), mat('#2a2a2a', { metal: 0.6 })), 0, -0.1, 0);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.04, 0.03, 0.03), mat('#c8ccd0', { metal: 0.7 })), sx * 0.16, -0.13, 0.115);
  g.userData.grip = { pos: [0, -0.03, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  return g;
}
export function teddy(parent) {
  const g = new THREE.Group(); parent.add(g);
  const fur = matNoisy('#9a6a3a', { amount: 18, seed: 21 });
  add(g, M(new THREE.IcosahedronGeometry(0.07, 0).scale(1, 1.2, 0.9), fur), 0, 0, 0);
  add(g, M(new THREE.IcosahedronGeometry(0.055, 0), fur), 0, 0.11, 0);
  for (const sx of [-1, 1]) { add(g, M(new THREE.IcosahedronGeometry(0.022, 0), fur), sx * 0.045, 0.16, 0); add(g, M(new THREE.IcosahedronGeometry(0.028, 0).scale(1, 1.4, 1), fur), sx * 0.075, 0.0, 0.01); add(g, M(new THREE.BoxGeometry(0.01, 0.01, 0.01), mat('#111')), sx * 0.018, 0.12, 0.05); }
  add(g, M(new THREE.IcosahedronGeometry(0.02, 0), mat('#d8b890')), 0, 0.1, 0.05);
  return g;
}
export function wheelchair(parent) {
  const g = new THREE.Group(); parent.add(g);
  const metal = mat('#b8bcc4', { metal: 0.6, rough: 0.3 }), seat = mat('#3a3a48', { rough: 0.8 });
  add(g, M(boxG(0.46, 0.05, 0.44), seat), 0, 0.42, 0);
  add(g, M(boxG(0.46, 0.45, 0.04), seat), 0, 0.47, -0.21);
  for (const sx of [-1, 1]) {
    const w = new THREE.TorusGeometry(0.28, 0.02, 4, 16); w.rotateY(Math.PI / 2); add(g, M(w, mat('#222')), sx * 0.27, 0.3, -0.05);
    const sp = new THREE.CylinderGeometry(0.26, 0.26, 0.01, 12); sp.rotateZ(Math.PI / 2); add(g, M(sp, mat('#c8ccd0', { metal: 0.6, transparent: true, opacity: 0.4 })), sx * 0.27, 0.3, -0.05);
    add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8).rotateZ(Math.PI / 2), mat('#222')), sx * 0.2, 0.06, 0.25);
    add(g, M(boxG(0.03, 0.25, 0.03), metal), sx * 0.24, 0.45, 0.15);
    add(g, M(boxG(0.03, 0.03, 0.3), metal), sx * 0.24, 0.68, 0.0);
  }
  add(g, M(boxG(0.36, 0.02, 0.14), metal), 0, 0.1, 0.32);
  return g;
}
export function teacup(parent) {
  const g = new THREE.Group(); parent.add(g);
  const por = mat('#f6f2ea', { rough: 0.25 });
  add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 12), por), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.036, 0.026, 0.05, 10, 1, true).translate(0, 0.03, 0), mat('#f6f2ea', { rough: 0.25, side: THREE.DoubleSide })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.033, 0.033, 0.004, 10), mat('#8a4a1e')), 0, 0.045, 0);
  add(g, M(new THREE.TorusGeometry(0.014, 0.004, 4, 8), por), 0.042, 0.03, 0);
  g.userData.grip = { pos: [0, -0.01, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  return g;
}
export function rulerProp(parent, { len = 0.15, color = '#e8d070' } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const t = textTex(64, 8, (x, w, h) => { x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2420'; for (let i = 0; i <= 30; i++) x.fillRect(Math.round(i * (w - 1) / 30), 0, 1, i % 5 === 0 ? 5 : 3); });
  add(g, M(new THREE.BoxGeometry(len, 0.004, 0.025), [mat(color), mat(color), mat(t, { flat: false }), mat(color), mat(color), mat(color)]), len / 2, 0, 0);
  g.userData.grip = { pos: [0.01, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] };
  return g;
}
export function tapeMeasure(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.09, 0.09, 0.04), mat('#f2c230', { rough: 0.4 })), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.03, 0.03, 0.042, 10).rotateX(Math.PI / 2), mat('#2a2a2a')), 0, 0, 0);
  const tt2 = textTex(256, 8, (x, w, h) => { x.fillStyle = '#f6d84a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1a1a'; for (let i = 0; i < 128; i++) x.fillRect(i * 2, 0, 1, i % 5 === 0 ? 6 : 3); });
  tt2.wrapS = THREE.RepeatWrapping;
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.003, 0.025).translate(0.5, 0, 0), mat(tt2, { flat: false, rough: 0.4 }));
  tape.castShadow = true; tape.position.set(0.045, -0.04, 0); g.add(tape);
  g.userData.setLen = (L) => { tape.scale.x = Math.max(0.001, L); tt2.repeat.set(L / 1.0, 1); };
  g.userData.setLen(0.01);
  g.userData.grip = { pos: [0, -0.02, -0.01], axis: [0, 0, 1], up: [0, 1, 0] };
  return g;
}
export function phoneProp(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.075, 0.155, 0.009), mat('#1a1a1e', { rough: 0.3 })), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(0.066, 0.142), mat('#3a6ad8', { emissive: '#4a7ae8', emissiveIntensity: 0.5 })), 0, 0, -0.0047).rotation.y = Math.PI;
  g.userData.grip = { pos: [0, -0.03, -0.012], axis: [0, 1, 0], up: [0, 0, -1] };
  return g;
}
export function wrench(parent) {
  const g = new THREE.Group(); parent.add(g);
  const m = mat('#c8ccd0', { metal: 0.7, rough: 0.3 });
  add(g, M(new THREE.BoxGeometry(0.03, 0.32, 0.015).translate(0, 0.16, 0), m));
  add(g, M(new THREE.BoxGeometry(0.08, 0.05, 0.02), m), 0, 0.33, 0); add(g, M(new THREE.BoxGeometry(0.02, 0.04, 0.02), m), -0.03, 0.37, 0);
  g.userData.grip = { pos: [0, 0.06, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function caneProp(parent) {
  const g = new THREE.Group(); parent.add(g);
  const m = mat('#4a2a18', { rough: 0.4 });
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6).translate(0, 0.425, 0), m));
  add(g, M(new THREE.TorusGeometry(0.04, 0.012, 4, 8, Math.PI).rotateY(Math.PI / 2), m), 0, 0.86, 0.04);
  g.userData.grip = { pos: [0, 0.86, 0.06], axis: [0, 0, 1], up: [0, 1, 0] };
  return g;
}
// a lumpy cartoon fossil: looks like a little dark stone, never gross
export function fossil(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.CapsuleGeometry(0.035 * s, 0.13 * s, 3, 6); geo.rotateZ(Math.PI / 2);
  const p = geo.attributes.position, R = rng(17);
  for (let i = 0; i < p.count; i++) { const k = 1 + (R() - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * (1 + (R() - 0.5) * 0.06), p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals();
  add(g, M(geo, mat(tex(paint(16, 16, (x, y) => { const d = ((x * 7 + y * 5) % 9) * 4; return [92 + d, 66 + d * 0.8, 44 + d * 0.6]; })), { rough: 0.95 })), 0, 0.035 * s, 0).rotation.y = 0.3;
  return g;
}

// ================================================================== plumber reel: places
export function toiletAt(g, x, z, { water = 0.15 } = {}) {
  const white = mat('#fbfbf8', { rough: 0.18 });
  const tg = grp(g, x, 0, z);
  const prof = [[0.0, 0.0], [0.13, 0.0], [0.14, 0.12], [0.2, 0.3], [0.215, 0.4], [0.2, 0.41], [0.17, 0.38], [0.11, 0.24], [0.07, 0.16], [0.0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.LatheGeometry(prof, 16); bowl.scale(1, 1, 1.22);
  add(tg, M(bowl, white), 0, 0, 0.02);
  add(tg, M(boxG(0.44, 0.4, 0.2), white), 0, 0.38, -0.3);
  add(tg, M(boxG(0.47, 0.04, 0.23), white), 0, 0.78, -0.3);
  const button = add(tg, M(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 14).translate(0, 0.01, 0), mat('#e8ecf2', { metal: 0.35, rough: 0.25 })), 0, 0.815, -0.3);
  add(tg, M(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 14), mat('#c4cad2', { metal: 0.35, rough: 0.3 })), 0, 0.812, -0.3);
  add(tg, M(boxG(0.16, 0.38, 0.14), white), 0, 0, -0.22);
  const seat = new THREE.TorusGeometry(0.17, 0.028, 4, 16); seat.rotateX(Math.PI / 2); seat.scale(1, 1, 1.25);
  add(tg, M(seat, mat('#ffffff', { rough: 0.3 })), 0, 0.425, 0.03);
  const lid = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 14); lid.scale(1, 1, 1.25); lid.rotateX(Math.PI / 2 - 0.12);
  add(tg, M(lid, mat('#ffffff', { rough: 0.3 })), 0, 0.64, -0.17);
  // water with a swirl pattern (rotate it for the flush)
  const sw = textTex(64, 64, (x, w, h) => {
    x.fillStyle = '#9ad2ec'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8f2ff'; x.lineWidth = 2;
    for (let a = 0; a < 3; a++) { x.beginPath(); for (let i = 0; i < 60; i++) { const r = i / 60 * 30, th = a * 2.09 + i * 0.12; x.lineTo(32 + r * Math.cos(th), 32 + r * Math.sin(th)); } x.stroke(); }
  });
  const wm = mat(sw, { rough: 0.02, metal: 0.2, flat: false });
  const wy = lerp(0.2, 0.395, water), wr = lerp(0.085, 0.2, Math.pow(water, 0.8));
  const wmesh = add(tg, M(new THREE.CircleGeometry(wr, 20).rotateX(-Math.PI / 2), wm, { cast: false }), 0, wy, 0.02);
  wmesh.scale.set(1, 1, 1.22);
  return { group: tg, button, water: wmesh, bowlTop: [x, 0.41, z + 0.02], buttonPos: [x, 0.83, z - 0.3] };
}
function doorLeaf(parent, color = '#fbfbf6') {
  const d = new THREE.Group(); parent.add(d);
  add(d, M(boxG(0.84, 2.03, 0.05).translate(0.42, 0, 0), mat(color, { rough: 0.5 })));
  for (let i = 0; i < 2; i++) add(d, M(new THREE.BoxGeometry(0.56, 0.7, 0.012), mat('#f0f0ea', { rough: 0.5 })), 0.42, 0.55 + i * 0.95, 0.03);
  add(d, M(new THREE.SphereGeometry(0.03, 6, 4), mat('#d8b040', { metal: 0.8, rough: 0.3 })), 0.75, 1.0, 0.05);
  add(d, M(new THREE.SphereGeometry(0.03, 6, 4), mat('#d8b040', { metal: 0.8, rough: 0.3 })), 0.75, 1.0, -0.05);
  return d;
}
function duckPicture() {
  return textTex(40, 32, (x, w, h) => {
    const p = (a, b, c, d, col) => { x.fillStyle = col; x.fillRect(a, b, c, d); };
    p(0, 0, w, h, '#9cd0f0'); p(0, 22, w, 10, '#5a9ad0');
    p(12, 12, 16, 10, '#ffd23a'); p(24, 7, 8, 8, '#ffd23a'); p(31, 10, 5, 3, '#f08a2a'); p(27, 9, 2, 2, '#111');
    p(10, 22, 20, 2, '#3a7ab0');
  });
}
// The small cosy bathroom (x = -60): toilet against the back wall (z = -1.2) at x = -0.4, the door in the front
// wall (z = 1.4) at x = 0.45..1.31 opening to a bit of hallway; plunger in the back-right corner; duck picture on
// the left wall; round mirror over the sink on the back wall; one ceiling lamp (B.lamp = light, flicker it).
export const PB = { x0: -60, toilet: [-0.4, -0.92], door: [0.45, 1.4], plunger: [1.05, -1.0] };
export function buildPlumberBath(W, { x0 = -60, water = 0.15, doorOpen = 0, hall = true, poo = true } = {}) {
  const g = grp(W.scene, x0); const B = { group: g, x0 };
  const tm = mat(tilesTex('#f2dc8a', '#fbf6e6', 64, 13, 4), { rough: 0.35 }); tm.map.repeat.set(6, 6);
  const fm = mat(checkerTex('#f4f4f0', '#8a9aa8', 64, 8, 5), { rough: 0.4 }); fm.map.repeat.set(2, 2);
  add(g, M(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), fm), 0, 0, 0.1);
  add(g, M(new THREE.PlaneGeometry(2.6, 2.6), tm), 0, 1.3, -1.2);
  add(g, M(new THREE.PlaneGeometry(2.6, 2.6), tm), -1.3, 1.3, 0.1).rotation.y = Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(2.6, 2.6), tm), 1.3, 1.3, 0.1).rotation.y = -Math.PI / 2;
  // front wall with the door hole (x 0.45..1.31, y 0..2.05)
  const fpart = (x0_, x1_, y0, y1) => { const m = add(g, M(new THREE.PlaneGeometry(x1_ - x0_, y1 - y0), tm), (x0_ + x1_) / 2, (y0 + y1) / 2, 1.4); m.rotation.y = Math.PI; };
  fpart(-1.3, 0.45, 0, 2.6); fpart(1.31, 1.3 + 0.001, 0, 2.6); fpart(0.45, 1.31, 2.05, 2.6);
  add(g, M(new THREE.PlaneGeometry(2.6, 2.6).rotateX(Math.PI / 2), matNoisy('#f6f6f0', { amount: 4 })), 0, 2.6, 0.1);
  const frameM = mat('#fbfbf6', { rough: 0.5 });
  for (const x of [0.43, 1.33]) add(g, M(boxG(0.05, 2.08, 0.12), frameM), x, 0, 1.4);
  add(g, M(boxG(0.95, 0.06, 0.12), frameM), 0.88, 2.05, 1.4);
  B.door = doorLeaf(g); B.door.position.set(0.45, 0, 1.42); B.door.rotation.y = -1.5 * doorOpen;
  if (hall) {   // a bit of hallway outside the door (for the family in the doorway)
    const hw = mat(wallpaperTex('#f2e2c4', '#e8d4b0'), { rough: 0.9 }); hw.map.repeat.set(6, 3);
    const hf = mat(planksTex('#a8743e', 64, 7), { rough: 0.6 }); hf.map.repeat.set(2, 3);
    add(g, M(new THREE.PlaneGeometry(5, 4).rotateX(-Math.PI / 2), hf), 0.9, 0, 3.4);
    add(g, M(new THREE.PlaneGeometry(5, 2.7), hw), 0.9, 1.35, 5.4).rotation.y = Math.PI;
    for (const sx of [-1.6, 3.4]) add(g, M(new THREE.PlaneGeometry(4, 2.7), hw), sx, 1.35, 3.4).rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    const hl = new THREE.PointLight(0xffd8a8, 2.5, 6, 2); hl.position.set(0.9, 2.4, 3.0); g.add(hl);
  }
  B.toilet = toiletAt(g, PB.toilet[0], PB.toilet[1], { water });
  if (poo) {   // way too big for the bowl: it sticks up out of it
    B.poop = poop(g, { s: 0.92 }); B.poop.position.set(PB.toilet[0], 0.2, PB.toilet[1] + 0.03);
  }
  // sink + round mirror, towel, plunger in the corner, the duck picture, a little rug
  add(g, M(boxG(0.5, 0.82, 0.38), mat('#f4f2ec', { rough: 0.5 })), 0.62, 0, -1.0);
  add(g, M(boxG(0.54, 0.06, 0.42), mat('#fbfbf8', { rough: 0.2 })), 0.62, 0.82, -1.0);
  add(g, M(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16).rotateX(Math.PI / 2), mat('#cfe6f2', { rough: 0.05, metal: 0.5 })), 0.62, 1.45, -1.18);
  add(g, M(new THREE.TorusGeometry(0.22, 0.02, 4, 16), mat('#d8b040', { metal: 0.6, rough: 0.3 })), 0.62, 1.45, -1.17);
  add(g, M(boxG(0.45, 0.55, 0.05), matNoisy('#4aa0d8', { amount: 14 })), -1.25, 0.8, -0.2).rotation.y = Math.PI / 2;
  B.plunger = plunger(g); B.plunger.position.set(PB.plunger[0], 0, PB.plunger[1]); B.plunger.rotation.z = 0.12;
  B.picture = frame(g, duckPicture(), -1.27, 1.6, 0.35, 0.4, 0.32, { ry: Math.PI / 2, color: '#6a4024' });
  add(g, M(new THREE.CylinderGeometry(0.4, 0.4, 0.012, 14).scale(1.2, 1, 0.8), matNoisy('#5ab08a', { amount: 14 })), 0.0, 0.006, 0.3);
  const holder = grp(g, -1.27, 0.7, -0.55); add(holder, M(new THREE.BoxGeometry(0.03, 0.04, 0.16), mat('#d0d4d8', { metal: 0.5, rough: 0.2 })));
  const r = rollProp(holder); r.rotation.x = Math.PI / 2; r.position.set(0.07, -0.02, 0);
  // ceiling lamp
  B.lampMesh = add(g, M(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), mat('#fff8e8', { emissive: '#fff0d0', emissiveIntensity: 1.3 })), 0, 2.58, 0.1);
  B.lamp = new THREE.PointLight(0xfff0dc, 3.4, 7, 2); B.lamp.position.set(0, 2.3, 0.3); g.add(B.lamp);
  B.setLamp = (k) => { B.lamp.intensity = 3.4 * k; B.lampMesh.material.emissiveIntensity = 1.3 * k; };
  return B;
}
// Upstairs hallway (x = 60): corridor along z (z -5 .. 3), 2.4 m wide; the bathroom door is in the end wall
// (z = -5), centred, closed. The family waits in a row around z = -3.4.
export function buildPlumberHall(W, { x0 = 60, doorOpen = 0 } = {}) {
  const g = grp(W.scene, x0); const H = { group: g, x0 };
  const fm = mat(planksTex('#a8743e', 64, 7), { rough: 0.6 }); fm.map.repeat.set(3, 8);
  add(g, M(new THREE.PlaneGeometry(2.4, 9).rotateX(-Math.PI / 2), fm), 0, 0, -0.5);
  const wm = mat(wallpaperTex('#f2e2c4', '#e8d4b0'), { rough: 0.9 }); wm.map.repeat.set(10, 3);
  for (const sx of [-1, 1]) add(g, M(new THREE.PlaneGeometry(9, 2.7), wm), sx * 1.2, 1.35, -0.5).rotation.y = -sx * Math.PI / 2;
  const endW = (x0_, x1_, y0, y1) => add(g, M(new THREE.PlaneGeometry(x1_ - x0_, y1 - y0), wm), (x0_ + x1_) / 2, (y0 + y1) / 2, -5.0);
  endW(-1.2, -0.43, 0, 2.7); endW(0.43, 1.2, 0, 2.7); endW(-0.43, 0.43, 2.05, 2.7);
  add(g, M(new THREE.PlaneGeometry(2.4, 2.7), wm), 0, 1.35, 4.0).rotation.y = Math.PI;
  add(g, M(new THREE.PlaneGeometry(2.4, 9).rotateX(Math.PI / 2), matNoisy('#f6f0e4', { amount: 5 })), 0, 2.7, -0.5);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.03, 0.12, 9), mat('#f6f2e8')), sx * 1.185, 0.06, -0.5);
  const frameM = mat('#fbfbf6', { rough: 0.5 });
  for (const x of [-0.45, 0.45]) add(g, M(boxG(0.06, 2.08, 0.1), frameM), x, 0, -5.0);
  add(g, M(boxG(0.96, 0.07, 0.1), frameM), 0, 2.05, -5.0);
  add(g, M(new THREE.PlaneGeometry(0.86, 2.05), mat('#2a2420')), 0, 1.025, -5.06);
  H.door = doorLeaf(g); H.door.position.set(-0.42, 0, -5.0); H.door.rotation.y = 1.4 * doorOpen;
  H.doorPos = [x0, 1.2, -5.0];
  const P = photoCanvases();
  frame(g, P.fam, -1.18, 1.6, -1.2, 0.5, 0.36, { ry: Math.PI / 2 });
  frame(g, P.dog, -1.18, 1.5, -2.6, 0.3, 0.3, { ry: Math.PI / 2 });
  frame(g, P.baby, 1.18, 1.6, -2.0, 0.26, 0.32, { ry: -Math.PI / 2 });
  frame(g, P.landscape, 1.18, 1.6, -0.2, 0.5, 0.33, { ry: -Math.PI / 2 });
  frame(g, P.school, 1.18, 1.55, 1.4, 0.3, 0.36, { ry: -Math.PI / 2 });
  add(g, M(boxG(0.4, 0.8, 1.0), mat(planksTex('#6a4024', 32, 9))), -0.98, 0, 1.6);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8).translate(0, 0.125, 0), mat('#4a7ab0', { rough: 0.3 })), -0.98, 0.8, 1.6);
  const rug = mat(tex(paint(32, 32, (x, y) => { const c = ((x >> 2) + (y >> 2)) & 1 ? [170, 50, 50] : [200, 160, 80]; const e = x < 2 || y < 2 || x > 29 || y > 29; return e ? [90, 40, 30] : c; })), { rough: 1 });
  add(g, M(new THREE.PlaneGeometry(1.1, 5).rotateX(-Math.PI / 2), rug), 0, 0.005, -1.0);
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffd8a8, 2.0, 5, 2); l.position.set(0, 2.45, 1.5 - i * 2.7); g.add(l); add(g, M(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10), mat('#fff4dc', { emissive: '#ffe0b0', emissiveIntensity: 1.2 })), 0, 2.66, 1.5 - i * 2.7); }
  return H;
}
// Museum hall (x = 200): polished floor, two rows of stone columns, the glass case on a pedestal in the middle
// (0, 0, -4) under a spotlight, red rope barriers. MUS.case = top of the pedestal.
export const MUS = { x0: 200, case: [0, 1.0, -4] };
export function buildMuseum(W, { x0 = 200 } = {}) {
  const g = grp(W.scene, x0); const Mu = { group: g, x0 };
  const fl = mat(checkerTex('#e8dcc8', '#9a8a74', 64, 4, 7), { rough: 0.15, metal: 0.1 }); fl.map.repeat.set(8, 8);
  add(g, M(new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2), fl), 0, 0, -4);
  const st = mat(stoneTex('#c8bca8', 64, 21), { rough: 0.8 }); st.map.repeat.set(6, 3);
  for (const [w, x, z, ry] of [[24, 0, -14, 0], [24, -10, -4, Math.PI / 2], [24, 10, -4, -Math.PI / 2], [24, 0, 7, Math.PI]]) add(g, M(new THREE.PlaneGeometry(w, 8), st), x, 4, z).rotation.y = ry;
  add(g, M(new THREE.PlaneGeometry(24, 24).rotateX(Math.PI / 2), matNoisy('#d8ccb8', { amount: 6 })), 0, 8, -4);
  const colM = mat(stoneTex('#e2d8c6', 32, 23), { rough: 0.7 }); colM.map.repeat.set(1, 3);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const z = 3 - i * 4;
    add(g, M(new THREE.CylinderGeometry(0.4, 0.45, 7, 10).translate(0, 3.5, 0), colM), sx * 4.5, 0, z);
    add(g, M(boxG(1.1, 0.3, 1.1), colM), sx * 4.5, 0, z); add(g, M(boxG(1.1, 0.3, 1.1), colM), sx * 4.5, 7.0, z);
  }
  // paintings on the far wall
  const P = photoCanvases();
  frame(g, P.landscape, -5, 3.2, -13.95, 2.4, 1.6, { color: '#c8a040' }); frame(g, P.fish, 5, 3.2, -13.95, 2.0, 1.6, { color: '#c8a040' });
  // pedestal + glass case + the fossil + a label + a ruler inside
  const [cx, cy, cz] = MUS.case;
  add(g, M(boxG(0.8, cy, 0.8), mat('#2a2420', { rough: 0.4 })), cx, 0, cz);
  add(g, M(boxG(0.5, 0.04, 0.3), mat('#7a1a2a', { rough: 0.9 })), cx, cy, cz);
  Mu.fossil = fossil(g, 1.0); Mu.fossil.position.set(cx, cy + 0.04, cz);
  Mu.label = add(g, M(new THREE.BoxGeometry(0.12, 0.07, 0.005), mat('#f2ead2')), cx + 0.2, cy + 0.06, cz + 0.12); Mu.label.rotation.x = -0.6;
  Mu.ruler = rulerProp(g, { len: 0.25 }); Mu.ruler.position.set(cx - 0.12, cy + 0.045, cz + 0.08);
  const glass = mat('#dff0ff', { rough: 0.02, transparent: true, opacity: 0.12 });
  add(g, M(boxG(0.7, 0.55, 0.7), glass, { cast: false }), cx, cy, cz);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) add(g, M(boxG(0.015, 0.55, 0.015), mat('#c8a040', { metal: 0.6 })), cx + x, cy, cz + z);
  // rope barriers
  const postM = mat('#c8a040', { metal: 0.6, rough: 0.3 }), rope = mat('#9a1a24', { rough: 0.8 });
  const posts = [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]];
  for (const [x, z] of posts) { add(g, M(new THREE.CylinderGeometry(0.03, 0.06, 0.95, 8).translate(0, 0.475, 0), postM), cx + x, 0, cz + z); add(g, M(new THREE.SphereGeometry(0.05, 8, 6), postM), cx + x, 0.98, cz + z); }
  for (let i = 0; i < 4; i++) {
    const a = posts[i], b = posts[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const r = add(g, M(new THREE.CylinderGeometry(0.018, 0.018, L, 5).rotateZ(Math.PI / 2), rope), cx + (a[0] + b[0]) / 2, 0.84, cz + (a[1] + b[1]) / 2);
    r.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  // spotlight on the case + light cone
  Mu.spot = spot(W, [x0 + cx, 6.5, cz + 0.5], [x0 + cx, cy, cz], { intensity: 90, angle: 0.18, coneOpacity: 0.09 });
  const amb = new THREE.PointLight(0xffe8c8, 3, 18, 1.6); amb.position.set(0, 6, 0); g.add(amb);
  return Mu;
}
export function spot(W, pos, target, { color = 0xfff4e0, intensity = 60, angle = 0.32, cone = true, coneOpacity = 0.07 } = {}) {
  const s = new THREE.SpotLight(color, intensity, 30, angle, 0.45, 1.6);
  s.position.set(...pos); s.target.position.set(...target); s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0005;
  W.scene.add(s); W.scene.add(s.target);
  if (cone) {
    const h = V(...pos).distanceTo(V(...target)), r = Math.tan(angle) * h;
    const cg = new THREE.ConeGeometry(r, h, 20, 1, true); cg.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: coneOpacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(...pos); m.lookAt(...target); m.rotateX(-Math.PI / 2); W.scene.add(m);
  }
  return s;
}
// Flashback kitchen (x = 260): counter along the back wall (z = -1.2) with a sink cabinet (doors open, pipes),
// window, cupboards. KIT.sink = the sink cabinet front.
export const KIT = { x0: 260, sink: [0, -0.95] };
export function buildKitchen(W, { x0 = 260 } = {}) {
  const g = grp(W.scene, x0); const K = { group: g, x0 };
  const fm = mat(checkerTex('#e8e2d0', '#b84a3a', 64, 8, 9), { rough: 0.5 }); fm.map.repeat.set(3, 3);
  add(g, M(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), fm), 0, 0, 0.5);
  const wm = mat(tilesTex('#e8f0e0', '#c8d0c0', 64, 5, 8), { rough: 0.5 }); wm.map.repeat.set(5, 3);
  add(g, M(new THREE.PlaneGeometry(5, 2.8), wm), 0, 1.4, -1.5);
  add(g, M(new THREE.PlaneGeometry(5, 2.8), wm), -2.5, 1.4, 0.5).rotation.y = Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(5, 2.8), wm), 2.5, 1.4, 0.5).rotation.y = -Math.PI / 2;
  const wood = mat(planksTex('#c89a5a', 32, 13), { rough: 0.6 });
  for (const x of [-1.4, -0.7, 0.7, 1.4]) add(g, M(boxG(0.68, 0.86, 0.56), wood), x, 0, -1.2);
  add(g, M(boxG(3.6, 0.05, 0.62), mat('#ece6da', { rough: 0.3 })), 0, 0.86, -1.18);
  // sink cabinet with open doors + pipes
  add(g, M(boxG(0.7, 0.86, 0.04), mat('#5a3a22')), 0, 0, -1.46);
  for (const sx of [-1, 1]) { const d = add(g, M(boxG(0.34, 0.8, 0.03).translate(sx * 0.17, 0, 0), wood), sx * 0.35, 0.03, -0.9); d.rotation.y = -sx * 1.2; }
  const pm = mat('#b8bcc4', { metal: 0.6, rough: 0.3 });
  add(g, M(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8).translate(0, 0.3, 0), pm), 0, 0.2, -1.25);
  const u = add(g, M(new THREE.TorusGeometry(0.08, 0.035, 6, 10, Math.PI), pm), 0.08, 0.25, -1.25); u.rotation.z = Math.PI;
  add(g, M(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8).rotateZ(Math.PI / 2), pm), 0.4, 0.3, -1.3);
  K.pipe = [x0 + 0.16, 0.25, -1.25];
  add(g, M(new THREE.BoxGeometry(0.5, 0.02, 0.4), mat('#c8ccd0', { metal: 0.5 })), 0, 0.87, -1.15);
  add(g, M(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), pm), 0, 1.02, -1.38);
  // window + cupboards
  add(g, M(new THREE.PlaneGeometry(1.0, 0.8), mat('#bfe0f4', { emissive: '#e8f4ff', emissiveIntensity: 0.6 })), 0, 1.65, -1.49);
  add(g, M(new THREE.BoxGeometry(1.1, 0.9, 0.04), mat('#f6f2e8')), 0, 1.65, -1.5);
  for (const x of [-1.3, 1.3]) add(g, M(boxG(0.9, 0.7, 0.35), wood), x, 1.5, -1.3);
  const l = new THREE.PointLight(0xfff0dc, 4, 7, 2); l.position.set(0, 2.4, 0.4); g.add(l);
  // the burst pipe spray (hidden unless used)
  K.spray = new THREE.Group(); K.spray.position.set(...[0.16, 0.25, -1.2]); g.add(K.spray);
  const sm = new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 26; i++) { const R = rng(i + 5); const d = add(K.spray, new THREE.Mesh(new THREE.SphereGeometry(0.02 + R() * 0.02, 5, 4), sm)); d.userData.v = [(R() - 0.5) * 1.6, 0.8 + R() * 1.6, 0.6 + R() * 1.2]; d.userData.ph = R(); }
  K.spray.visible = false;
  return K;
}

// a big cartoon poop, like the poop emoji: a glossy brown swirl of stacked rings with a curly tip and two dot eyes
export function poop(parent, { s = 1, eyes = true } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const brown = mat(tex(paint(16, 16, (x, y) => { const d = ((x * 5 + y * 3) % 7) * 3; return [118 + d, 72 + d * 0.7, 38 + d * 0.5]; })), { rough: 0.35, flat: true });
  const rings = [[0.24, 0.075, 0.07], [0.19, 0.068, 0.19], [0.14, 0.06, 0.3], [0.09, 0.05, 0.39]];
  for (const [R, r, y] of rings) {
    const t = new THREE.TorusGeometry(R * s, r * s, 6, 14); t.rotateX(Math.PI / 2);
    add(g, M(t, brown), 0, y * s, 0);
    add(g, M(new THREE.CylinderGeometry(R * s, R * s, r * 1.6 * s, 14), brown), 0, y * s, 0);
  }
  const tip = new THREE.ConeGeometry(0.06 * s, 0.12 * s, 8); tip.rotateZ(-0.5);
  add(g, M(tip, brown), 0.02 * s, 0.47 * s, 0);
  g.userData.eyes = [];
  if (eyes) {
    for (const sx of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(sx * 0.06 * s, 0.31 * s, 0.185 * s); g.add(e);
      add(e, M(new THREE.SphereGeometry(0.05 * s, 10, 8), mat('#ffffff', { rough: 0.3, flat: false })));
      add(e, M(new THREE.SphereGeometry(0.024 * s, 8, 6), mat('#111111', { rough: 0.3, flat: false })), 0, 0, 0.038 * s);
      g.userData.eyes.push(e);
    }
  }
  g.userData.blink = (k) => g.userData.eyes.forEach((e) => { e.scale.y = Math.max(0.08, 1 - k); });
  return g;
}

// ================================================================== genius reel: props
const brightM = (hex, o = {}) => mat(hex, { rough: 0.6, ...o });
export function screenCanvas(w = 128, h = 256) {
  const c = canvas(w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter;
  return { c, g: c.getContext('2d'), t };
}
// phone on a tripod (the creator's camera); P.draw(views, live) repaints its screen
export function phoneTripod(parent) {
  const g = new THREE.Group(); parent.add(g);
  const dark = mat('#1a1a1e', { rough: 0.4 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = add(g, M(new THREE.CylinderGeometry(0.008, 0.008, 1.25, 5).translate(0, 0.62, 0), dark), Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); l.rotation.set(Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17); }
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6).translate(0, 0.15, 0), dark), 0, 1.15, 0);
  const ph = grp(g, 0, 1.47, 0); g.userData.phone = ph;
  add(ph, M(new THREE.BoxGeometry(0.085, 0.17, 0.01), dark));
  const S = screenCanvas(128, 256);
  add(ph, M(new THREE.PlaneGeometry(0.076, 0.156), new THREE.MeshBasicMaterial({ map: S.t })), 0, 0, 0.0055);
  add(ph, M(new THREE.PlaneGeometry(0.076, 0.156), new THREE.MeshBasicMaterial({ map: S.t })), 0, 0, -0.0055).rotation.y = Math.PI;
  g.userData.draw = (views = 0, live = false, lt = 0) => {
    const { c, g: x, t } = S;
    const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(1, '#1a1a2a'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#e8b890'; x.fillRect(44, 70, 40, 46); x.fillStyle = '#2a1a10'; x.fillRect(42, 64, 44, 12); x.fillStyle = '#d8322e'; x.fillRect(30, 116, 68, 70);
    if (live) {
      x.fillStyle = '#e8202a'; x.beginPath(); x.roundRect(8, 10, 54, 24, 6); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 17px sans-serif'; x.fillText('LIVE', 14, 29);
      if (views != null) {
        x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.roundRect(66, 10, 56, 24, 6); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif';
        const v = views >= 1e9 ? (views / 1e9).toFixed(0) + 'B' : views >= 1e6 ? (views / 1e6).toFixed(0) + 'M' : views >= 1e3 ? (views / 1e3).toFixed(views < 1e4 ? 1 : 0) + 'K' : String(Math.round(views));
        x.fillText(v, 74, 28);
      }
      for (let i = 0; i < 4; i++) { x.fillStyle = ['#ff4a6a', '#ffd23a', '#4ad8ff', '#ff4a6a'][i]; x.beginPath(); x.arc(108 - (i % 2) * 8, 230 - i * 24 - ((lt * 90 + i * 30) % 120), 7, 0, 7); x.fill(); }
    }
    t.needsUpdate = true;
  };
  g.userData.draw(0, false);
  return g;
}
export function ringLight(parent) {
  const g = new THREE.Group(); parent.add(g);
  const dark = mat('#222226', { rough: 0.5 });
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 6).translate(0, 0.75, 0), dark));
  add(g, M(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 10), dark));
  add(g, M(new THREE.TorusGeometry(0.26, 0.035, 6, 24), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2.2 })), 0, 1.6, 0);
  const l = new THREE.PointLight(0xffffff, 3, 4, 2); l.position.set(0, 1.6, 0.2); g.add(l);
  return g;
}
export function notebook(parent) {
  const g = new THREE.Group(); parent.add(g);
  const pageM = mat('#fbfaf4', { rough: 0.9 });
  for (const sx of [-1, 1]) { const p = add(g, M(new THREE.BoxGeometry(0.2, 0.012, 0.28), pageM), sx * 0.102, 0.006, 0); p.rotation.z = -sx * 0.06; }
  add(g, M(new THREE.BoxGeometry(0.42, 0.006, 0.3), mat('#2a5ad8')), 0, 0.0, 0);
  add(g, M(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 5).rotateZ(Math.PI / 2), mat('#1a1a1a')), 0.12, 0.016, 0.1).rotation.y = 0.5;
  return g;
}
export function tumbleweed(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g);
  const m = mat('#a07a48', { rough: 1 }), R = rng(19);
  for (let i = 0; i < 26; i++) {
    const t = new THREE.TorusGeometry(0.12 * s + R() * 0.06 * s, 0.006 * s, 3, 8, Math.PI * (0.8 + R() * 0.8));
    const me = add(g, M(t, m)); me.rotation.set(R() * 6, R() * 6, R() * 6);
  }
  return g;
}
export function ideaBulb(parent) {
  const g = new THREE.Group(); parent.add(g);
  const glassOn = mat('#fff3a0', { emissive: '#ffe050', emissiveIntensity: 1.8, rough: 0.2 }), glassOff = mat('#8a8a80', { rough: 0.2, transparent: true, opacity: 0.6 });
  const bulb = add(g, M(new THREE.SphereGeometry(0.1, 12, 10), glassOn), 0, 0.06, 0);
  add(g, M(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 10), mat('#b8bcc4', { metal: 0.6, rough: 0.3 })), 0, -0.05, 0);
  const halo = glowSprite(g, [0, 0.06, 0], 0.7, 'rgba(255,230,120,1)', 0.8);
  const rays = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = add(g, M(new THREE.BoxGeometry(0.012, 0.06, 0.012), mat('#ffe050', { emissive: '#ffe050', emissiveIntensity: 1.5 })), Math.cos(a) * 0.17, 0.06 + Math.sin(a) * 0.17, 0); r.rotation.z = a - Math.PI / 2; rays.push(r); }
  g.userData.set = (on) => { bulb.material = on ? glassOn : glassOff; halo.visible = on; rays.forEach((r) => (r.visible = on)); };
  return g;
}
export function sofa(parent, color = '#f07a2a') {
  const g = new THREE.Group(); parent.add(g);
  const m = matNoisy(color, { amount: 10 }), leg = mat('#3a2a1a');
  add(g, M(boxG(2.1, 0.42, 0.85), m), 0, 0.08, 0);
  add(g, M(boxG(2.1, 0.55, 0.22), m), 0, 0.5, -0.33);
  for (const sx of [-1, 1]) add(g, M(boxG(0.2, 0.32, 0.85), m), sx * 0.95, 0.5, 0);
  for (const sx of [-0.5, 0.5]) add(g, M(boxG(1.0, 0.12, 0.62), matNoisy(color, { amount: 16, seed: 3 })), sx * 0.96, 0.5, 0.08);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, M(boxG(0.06, 0.08, 0.06), leg), sx * 0.98, 0, sz * 0.36);
  return g;
}
export function tvCamera(parent) {
  const g = new THREE.Group(); parent.add(g);
  const dark = mat('#2a2a30', { rough: 0.4 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = add(g, M(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 5).translate(0, 0.7, 0), dark), Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }
  add(g, M(new THREE.BoxGeometry(0.3, 0.3, 0.6), dark), 0, 1.45, 0);
  add(g, M(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 10).rotateX(Math.PI / 2), mat('#111')), 0, 1.45, 0.4);
  add(g, M(new THREE.SphereGeometry(0.03, 6, 4), mat('#ff2020', { emissive: '#ff2020', emissiveIntensity: 2 })), 0.1, 1.62, 0.25);
  return g;
}
export function umbrella(parent, color = '#e8402a') {
  const g = new THREE.Group(); parent.add(g);
  const canopy = new THREE.Group(); g.add(canopy); canopy.position.y = 0.85;
  const cm = mat(color, { rough: 0.6 }); cm.side = THREE.DoubleSide;
  const cone = new THREE.ConeGeometry(0.55, 0.28, 8, 1, true); cone.translate(0, -0.14, 0);
  add(canopy, M(cone, cm));
  add(g, M(new THREE.CylinderGeometry(0.01, 0.01, 0.95, 5).translate(0, 0.47, 0), mat('#2a2a2a')));
  add(g, M(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), mat('#3a2a1a')), 0.05, 0.0, 0).rotation.z = Math.PI;
  g.userData.canopy = canopy;
  g.userData.open = (k) => { canopy.scale.set(0.15 + 0.85 * k, 1 + (1 - k) * 1.8, 0.15 + 0.85 * k); };
  g.userData.grip = { pos: [0, 0.08, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.top = () => canopy.localToWorld(V(0, 0, 0));
  return g;
}
// the poop: a small brown blob (it is always covered by the pixel mosaic in the edit)
export function blob(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g);
  const m = mat('#7a4a22', { rough: 0.5 });
  add(g, M(new THREE.IcosahedronGeometry(0.07 * s, 0).scale(1, 0.8, 1), m), 0, 0, 0);
  add(g, M(new THREE.IcosahedronGeometry(0.05 * s, 0), m), 0.02 * s, 0.06 * s, 0);
  return g;
}
// a brown cartoon splat (flat star-ish blob), lying in the local XZ plane
export function splat(parent, s = 1, seed = 1) {
  const g = new THREE.Group(); parent.add(g);
  const R = rng(seed), pts = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = (i % 2 ? 0.55 : 1.0) * (0.8 + R() * 0.4) * 0.18 * s; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const sh = new THREE.Shape(pts); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
  const m = mat('#6a3e1c', { rough: 0.6 }); m.side = THREE.DoubleSide; m.polygonOffset = true; m.polygonOffsetFactor = -2;
  add(g, M(geo, m, { cast: false }), 0, 0.003, 0);
  for (let i = 0; i < 4; i++) { const a = R() * 6.28, r = (0.26 + R() * 0.1) * s; add(g, M(new THREE.CircleGeometry(0.025 * s, 6).rotateX(-Math.PI / 2), m, { cast: false }), Math.cos(a) * r, 0.003, Math.sin(a) * r); }
  return g;
}
// a mosaic-textured splat decal for the ending (seen from far away: brown pixel blocks, already "censored")
export function mosaicSplat(parent, s = 4, seed = 1) {
  const R = rng(seed);
  const t = tex(paint(6, 6, (x, y) => { const d = Math.hypot(x - 2.5, y - 2.5); if (d > 2.9 + R() * 0.6) return [0, 0, 0, 0]; const v = [[106, 62, 28], [138, 90, 46], [92, 54, 26], [160, 112, 66], [120, 76, 40]][Math.floor(R() * 5)]; return [...v, 255]; }), { mip: false });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2), m); parent.add(me); return me;
}
export function helicopter(parent) {
  const g = new THREE.Group(); parent.add(g);
  const body = mat('#e8b020', { rough: 0.35, metal: 0.1 }), dark = mat('#2a2a30', { rough: 0.4 }), glass = mat('#3a5a7a', { rough: 0.05, metal: 0.3, transparent: true, opacity: 0.55 });
  // cabin shell: floor, roof, back, the right side; the left side is the open door (local +x is the left side)
  add(g, M(boxG(1.6, 0.08, 2.4), body), 0, 0.5, 0);
  add(g, M(boxG(1.6, 0.1, 2.2), body), 0, 2.0, -0.1);
  add(g, M(boxG(1.6, 1.5, 0.1), body), 0, 0.5, -1.2);
  add(g, M(boxG(0.08, 1.5, 2.4), body), -0.8, 0.5, 0);
  add(g, M(boxG(0.08, 1.5, 0.5), body), 0.8, 0.5, -0.95);
  const nose = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateX(Math.PI / 2); nose.scale(0.8, 0.78, 0.9);
  add(g, M(nose, glass), 0, 1.28, 1.2);
  add(g, M(boxG(1.6, 0.4, 0.2), body), 0, 0.5, 1.15);
  // tail boom + fins + tail rotor
  add(g, M(new THREE.CylinderGeometry(0.12, 0.28, 4.2, 8).rotateX(Math.PI / 2), body), 0, 1.5, -3.2);
  add(g, M(new THREE.BoxGeometry(0.06, 0.9, 0.5), body), 0, 1.85, -5.2);
  const tr = grp(g, 0.1, 1.85, -5.25); g.userData.tailRotor = tr;
  for (let i = 0; i < 2; i++) add(tr, M(new THREE.BoxGeometry(0.02, 0.75, 0.06), dark)).rotation.x = i * Math.PI / 2;
  // skids
  for (const sx of [-1, 1]) { add(g, M(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6).rotateX(Math.PI / 2), dark), sx * 0.8, 0.05, 0.1); for (const z of [-0.6, 0.7]) add(g, M(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5).translate(0, 0.25, 0), dark), sx * 0.75, 0.05, z).rotation.z = -sx * 0.25; }
  // main rotor: hub + 4 long blades + a faint motion disc
  add(g, M(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8), dark), 0, 2.25, -0.1);
  const rot = grp(g, 0, 2.42, -0.1); g.userData.rotor = rot;
  for (let i = 0; i < 4; i++) add(rot, M(new THREE.BoxGeometry(5.6, 0.03, 0.22), dark)).rotation.y = i * Math.PI / 4;
  add(g, M(new THREE.CircleGeometry(2.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2a30', transparent: true, opacity: 0.12, depthWrite: false })), 0, 2.43, -0.1);
  // seats
  for (const sx of [-0.4, 0.4]) { add(g, M(boxG(0.5, 0.45, 0.5), mat('#3a3a40')), sx, 0.58, 0.55); add(g, M(boxG(0.5, 0.7, 0.1), mat('#3a3a40')), sx, 1.0, 0.3); }
  add(g, M(boxG(0.9, 0.45, 0.5), mat('#3a3a40')), 0, 0.58, -0.8);
  add(g, M(boxG(0.9, 0.7, 0.1), mat('#3a3a40')), 0, 1.0, -1.05);
  add(g, M(boxG(1.4, 0.5, 0.2), dark), 0, 0.9, 1.15);
  g.userData.spin = (t) => { rot.rotation.y = t * 22; tr.rotation.x = t * 40; };
  return g;
}

// ================================================================== genius reel: places
function lightsOn(W) { return W.lights; }
// creator bedroom (x = -60): YOU sits at (0, -0.4) facing +z; the desk is in front of him, the phone on its tripod
// and the ring light face him from z = +1.3. Back wall at z = -1.6 with posters and a purple LED strip.
export const BED = { x0: -60, seat: [0, -0.45], phone: [0.05, 1.25] };
export function buildBedroom(W, { x0 = -60 } = {}) {
  const g = grp(W.scene, x0); const B = { group: g, x0 };
  const fm = mat(planksTex('#c89a62', 64, 9), { rough: 0.6 }); fm.map.repeat.set(3, 3);
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), fm), 0, 0, 0.5);
  const wm = matNoisy('#9ab8e8', { amount: 6 });
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 0, 1.5, -1.6);
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), -2.4, 1.5, 0.5).rotation.y = Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 2.4, 1.5, 0.5).rotation.y = -Math.PI / 2;
  add(g, M(new THREE.BoxGeometry(4.8, 0.04, 0.04), mat('#b04aff', { emissive: '#b04aff', emissiveIntensity: 2.5 })), 0, 2.6, -1.58);
  // posters, shelf, bed, window
  [['#ff4a6a', -1.2, 1.7, 0.7, 0.9], ['#ffd23a', 0.2, 1.8, 0.55, 0.7], ['#4ad8a0', 1.3, 1.65, 0.6, 0.8]].forEach(([c, x, y, w, h], i) => {
    const pt = tex(paint(16, 20, (px, py) => { const b = hexToRgb(c); const s = ((px >> 2) + (py >> 2) + i) % 3 === 0 ? 40 : 0; return [b[0] - s, b[1] - s, b[2] - s]; }));
    add(g, M(new THREE.PlaneGeometry(w, h), mat(pt)), x, y, -1.59);
  });
  add(g, M(boxG(1.0, 0.05, 0.25), mat('#f4f2ec')), -1.6, 1.15, -1.47);
  for (let i = 0; i < 4; i++) add(g, M(boxG(0.08, 0.22, 0.16), mat(['#e8402a', '#2a8ad8', '#f2d030', '#3ab04a'][i])), -1.95 + i * 0.12, 1.2, -1.47);
  add(g, M(boxG(1.0, 0.45, 1.9), matNoisy('#f2f0ea', { amount: 6 })), 1.85, 0, -0.4);
  add(g, M(boxG(1.0, 0.18, 1.9), matNoisy('#4a5ad8', { amount: 12 })), 1.85, 0.45, -0.4);
  add(g, M(new THREE.PlaneGeometry(0.9, 1.0), mat('#cfe8ff', { emissive: '#e8f4ff', emissiveIntensity: 0.7 })), -2.39, 1.55, -0.3).rotation.y = Math.PI / 2;
  // desk + notebook, chair, phone tripod, ring light
  add(g, M(boxG(1.4, 0.04, 0.7), mat('#f4f2ec', { rough: 0.4 })), 0, 0.74, 0.25);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, M(boxG(0.04, 0.74, 0.04), mat('#2a2a30')), sx * 0.65, 0, 0.25 + sz * 0.3);
  B.notebook = notebook(g); B.notebook.position.set(0.0, 0.762, 0.2);
  add(g, M(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 10).translate(0, 0.05, 0), mat('#e8402a')), 0.45, 0.76, 0.35);
  const chair = grp(g, BED.seat[0], 0, BED.seat[1]);
  add(chair, M(boxG(0.5, 0.08, 0.5), mat('#1a1a1e')), 0, 0.4, 0); add(chair, M(boxG(0.5, 0.75, 0.08), mat('#d8322e')), 0, 0.48, -0.26);
  add(chair, M(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6).translate(0, 0.2, 0), mat('#2a2a30')));
  add(chair, M(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 5), mat('#2a2a30')));
  B.tripod = phoneTripod(g); B.tripod.position.set(BED.phone[0], 0, BED.phone[1]); B.tripod.rotation.y = Math.PI;
  B.ring = ringLight(g); B.ring.position.set(BED.phone[0], 0, BED.phone[1] + 0.12); B.ring.rotation.y = Math.PI;
  B.ring.children.forEach((c) => { if (c.geometry && c.geometry.type === 'TorusGeometry') c.position.y = 1.47; });
  const pl = new THREE.PointLight(0xfff4e8, 3, 7, 2); pl.position.set(0, 2.5, 0.8); g.add(pl);
  return B;
}
// bright TV studio (x = 60): the sofa faces +z at z = -0.6; the audience bleachers face it from z = +4.
export const TV = { x0: 60 };
export function buildTVStudio(W, { x0 = 60 } = {}) {
  const g = grp(W.scene, x0); const T = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), mat(checkerTex('#2a3a8a', '#24327a', 64, 4, 3), { rough: 0.25, metal: 0.1 })), 0, 0, 2);
  const back = new THREE.CylinderGeometry(6, 6, 5, 24, 1, true, Math.PI * 0.75, Math.PI * 0.5);
  const bm = mat(tex(paint(64, 32, (x, y) => { const c = ((x >> 3) % 3 === 0) ? [255, 90, 160] : ((x >> 3) % 3 === 1) ? [70, 140, 255] : [255, 210, 60]; return (x % 8 === 0) ? [255, 255, 255] : c; })), { emissive: '#3a2a6a', emissiveIntensity: 0.3 }); bm.side = THREE.BackSide;
  add(g, M(back, bm), 0, 2.5, 3.6);
  for (let i = 0; i < 5; i++) { const r = add(g, M(new THREE.TorusGeometry(0.5 + i * 0.18, 0.04, 4, 20), mat(['#ffffff', '#ffd23a', '#ff5aa0', '#4ad8ff', '#ffffff'][i], { emissive: '#ffffff', emissiveIntensity: 0.4 })), 0, 2.4, -2.3); }
  T.sofa = sofa(g); T.sofa.position.set(0, 0, -0.6);
  add(g, M(boxG(1.0, 0.35, 0.5), mat('#f4f2ec', { rough: 0.3 })), 0, 0, 0.45);
  for (const x of [-0.25, 0.25]) add(g, M(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8).translate(0, 0.05, 0), mat(x < 0 ? '#e8402a' : '#2a8ad8')), x, 0.35, 0.45);
  // audience bleachers (3 rows) facing the stage
  for (let r = 0; r < 3; r++) add(g, M(boxG(7, 0.45 + r * 0.45, 0.8), mat('#5a5a6a')), 0, 0, 4.0 + r * 0.8);
  for (const x of [-3.2, 3.2]) { T.cam = tvCamera(g); T.cam.position.set(x, 0, 2.2); T.cam.rotation.y = Math.PI + (x > 0 ? 0.35 : -0.35); }
  // light truss
  add(g, M(new THREE.BoxGeometry(8, 0.15, 0.15), mat('#b8bcc4', { metal: 0.6 })), 0, 4.4, 1.5);
  for (let i = -3; i <= 3; i++) { add(g, M(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 8), mat('#2a2a30')), i * 1.1, 4.2, 1.5); add(g, M(new THREE.CircleGeometry(0.11, 8).rotateX(Math.PI / 2), mat('#fff', { emissive: '#fff', emissiveIntensity: 2 })), i * 1.1, 4.04, 1.5); }
  const sp = new THREE.SpotLight(0xffffff, 60, 14, 0.6, 0.6, 1.4); sp.position.set(0, 4.2, 2.5); sp.target.position.set(x0, 0.8, -0.6); sp.castShadow = true; W.scene.add(sp); W.scene.add(sp.target);
  const fl = new THREE.PointLight(0xffe8f0, 4, 12, 1.6); fl.position.set(0, 3, 3); g.add(fl);
  return T;
}
// stadium at night (x = 300): pitch 40 x 26 m centred at (0, 0), stands all round with blocky fans (instanced),
// four floodlight towers, the big screen at the far end (z = -24) showing T.screenTex.
export const STAD = { x0: 300, screen: [0, 13, -24], screenW: 16, screenH: 9 };
export function buildStadium(W, { x0 = 300, fans = 2600 } = {}) {
  const g = grp(W.scene, x0); const St = { group: g, x0 };
  const grass = mat(tex(paint(64, 64, (x, y) => { const s = ((y >> 3) & 1) ? 0 : 14; const d = ((x * 7 + y * 13) % 9); return [52 + s + d, 132 + s + d, 52 + s]; }), { repeat: [4, 4] }), { rough: 1 });
  add(g, M(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), grass), 0, 0, 0);
  const line = mat('#f4f4f0');
  for (const [w, d, x, z] of [[40, 0.12, 0, 13], [40, 0.12, 0, -13], [0.12, 26, 20, 0], [0.12, 26, -20, 0], [0.12, 26, 0, 0]]) add(g, M(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), line, { cast: false }), x, 0.01, z);
  add(g, M(new THREE.RingGeometry(4.5, 4.65, 32).rotateX(-Math.PI / 2), line, { cast: false }), 0, 0.012, 0);
  // goals
  for (const sx of [-1, 1]) { const gl = grp(g, sx * 20, 0, 0); for (const z of [-3.6, 3.6]) add(gl, M(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).translate(0, 1.2, 0), line), 0, 0, z); add(gl, M(new THREE.CylinderGeometry(0.06, 0.06, 7.2, 6).rotateX(Math.PI / 2), line), 0, 2.4, 0); }
  // stands: 4 sloped tiers + fans (instanced body + head)
  const standM = mat('#3a3a48', { rough: 0.9 });
  const sides = [[0, -18, 0, 48], [0, 18, Math.PI, 48], [-27, 0, Math.PI / 2, 40], [27, 0, -Math.PI / 2, 40]];
  const bodyG = new THREE.BoxGeometry(0.42, 0.55, 0.3), headG = new THREE.BoxGeometry(0.26, 0.28, 0.26);
  const bodyM = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), headM = new THREE.MeshStandardMaterial({ color: '#d8a882', roughness: 0.8, flatShading: true });
  const bodies = new THREE.InstancedMesh(bodyG, bodyM, fans), heads = new THREE.InstancedMesh(headG, headM, fans);
  g.add(bodies); g.add(heads); St.heads = heads; St.fanData = [];
  const R = rng(9), cols = ['#e8402a', '#f2a01e', '#f2d030', '#3ab04a', '#2a8ad8', '#8a4ad8', '#e84a9a', '#20b0b0', '#ffffff', '#2a6ad8'];
  const o = new THREE.Object3D(); let k = 0;
  for (const [sx, sz, ry, len] of sides) {
    const sg = grp(g, sx, 0, sz, ry);
    for (let row = 0; row < 14; row++) add(sg, M(boxG(len, 0.6 + row * 0.75, 0.9), standM), 0, 0, -row * 0.9);
    for (let row = 0; row < 14 && k < fans; row++) for (let c = 0; c < len / 0.62 && k < fans; c++) {
      if (R() < 0.2) continue;
      const lx = -len / 2 + 0.3 + c * 0.62 + (R() - 0.5) * 0.1, ly = 0.6 + row * 0.75, lz = -row * 0.9;
      const p = V(lx, ly + 0.27, lz).applyAxisAngle(V(0, 1, 0), ry).add(V(sx, 0, sz));
      o.position.copy(p); o.rotation.set(0, ry, 0); o.scale.setScalar(1); o.updateMatrix(); bodies.setMatrixAt(k, o.matrix);
      bodies.setColorAt(k, new THREE.Color(cols[Math.floor(R() * cols.length)]));
      St.fanData.push({ p: p.clone().add(V(0, 0.42, 0)), ry, ph: R() });
      k++;
    }
  }
  bodies.count = heads.count = k; bodies.instanceMatrix.needsUpdate = true; if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  St.setHeads = (turn, t = 0) => {   // turn 0 = look at the pitch, 1 = look at the big screen
    const scr = V(STAD.screen[0], STAD.screen[1], STAD.screen[2]);
    St.fanData.forEach((f, i) => {
      const toScr = Math.atan2(scr.x - f.p.x, scr.z - f.p.z);
      let d = toScr - f.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
      const k2 = clamp(turn * 1.4 - f.ph * 0.4);
      o.position.copy(f.p); o.position.y += 0.03 * Math.sin(t * 9 + i) * (1 - k2); o.rotation.set(-0.2 * k2, f.ry + d * k2, 0); o.updateMatrix(); heads.setMatrixAt(i, o.matrix);
    });
    heads.instanceMatrix.needsUpdate = true;
  };
  St.setHeads(0);
  // floodlights
  for (const [x, z] of [[-26, -17], [26, -17], [-26, 17], [26, 17]]) {
    add(g, M(new THREE.CylinderGeometry(0.3, 0.5, 22, 6).translate(0, 11, 0), mat('#5a5a62')), x * 1.15, 0, z * 1.25);
    add(g, M(new THREE.BoxGeometry(4, 2, 0.4), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 2.5 })), x * 1.15, 22, z * 1.25).lookAt(x0, 0, 0);
    glowSprite(g, [x * 1.15, 22, z * 1.25], 14, 'rgba(255,255,240,1)', 0.8);
  }
  // the big screen
  const [scx, scy, scz] = STAD.screen;
  add(g, M(boxG(STAD.screenW + 1, STAD.screenH + 1, 0.6), mat('#1a1a1e')), scx, scy - STAD.screenH / 2 - 0.5, scz - 0.4);
  add(g, M(boxG(0.6, scy - STAD.screenH / 2, 0.6), mat('#3a3a40')), scx - 5, 0, scz - 0.4); add(g, M(boxG(0.6, scy - STAD.screenH / 2, 0.6), mat('#3a3a40')), scx + 5, 0, scz - 0.4);
  St.rt = new THREE.WebGLRenderTarget(640, 360); St.rt.texture.colorSpace = THREE.SRGBColorSpace;
  St.screen = add(g, M(new THREE.PlaneGeometry(STAD.screenW, STAD.screenH), new THREE.MeshBasicMaterial({ map: St.rt.texture, toneMapped: false })), scx, scy, scz - 0.08);
  St.ball = add(g, M(new THREE.IcosahedronGeometry(0.11, 1), mat('#ffffff', { rough: 0.4 })), 0, 0.11, 0);
  return St;
}
// low-poly city at sunset around the origin: a grid of colourful blocks with window grids, roads, a tall tower with
// the rooftop helipad at (0, 42, 0). CITY.pad = helipad centre.
export const CITY = { pad: [0, 42, 0] };
export function buildCity(W, { splats = 0 } = {}) {
  const g = grp(W.scene); const C = { group: g };
  add(g, M(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat('#4a4e58', { rough: 1 })), 0, 0, 0);
  const winT = (base) => { const b = hexToRgb(base); return tex(paint(16, 32, (x, y) => (x % 4 === 0 || y % 4 === 0) ? b : (((x * 7 + y * 3) % 11) > 7 ? [255, 214, 140] : [b[0] * 0.55, b[1] * 0.6, b[2] * 0.75])), { repeat: [2, 3] }); };
  const cols = ['#e8a87c', '#d8d0c0', '#9ab8e8', '#f2d27a', '#c88aa8', '#8ac8a8', '#e87c6a', '#b8b0d8'];
  const R = rng(4);
  C.roofs = [];
  for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) {
    if (i === 0 && j === 0) continue;
    const bx = i * 26, bz = j * 26, n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const w = 7 + R() * 9, d = 7 + R() * 9, h = 8 + R() * (Math.abs(i) + Math.abs(j) < 5 ? 45 : 22);
      const x = bx + (R() - 0.5) * 10, z = bz + (R() - 0.5) * 10, c = cols[Math.floor(R() * cols.length)];
      const m = mat(winT(c), { rough: 0.8 }); m.map.repeat.set(Math.round(w / 3), Math.round(h / 4));
      add(g, M(boxG(w, h, d), [m, m, mat(c), mat(c), m, m]), x, 0, z);
      C.roofs.push([x, h, z, Math.min(w, d)]);
    }
  }
  for (let i = -8; i <= 8; i++) { add(g, M(new THREE.PlaneGeometry(900, 5).rotateX(-Math.PI / 2), mat('#2a2c32'), { cast: false }), 0, 0.02, i * 26 + 13); add(g, M(new THREE.PlaneGeometry(5, 900).rotateX(-Math.PI / 2), mat('#2a2c32'), { cast: false }), i * 26 + 13, 0.02, 0); }
  // the helipad tower
  const tm = mat(winT('#5a6a8a'), { rough: 0.6 }); tm.map.repeat.set(4, 12);
  add(g, M(boxG(16, 42, 16), tm), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(6, 6, 0.2, 24), mat('#3a3a40')), 0, 42, 0);
  add(g, M(new THREE.RingGeometry(4.6, 5.2, 32).rotateX(-Math.PI / 2), mat('#f2d030'), { cast: false }), 0, 42.11, 0);
  const H = mat('#ffffff'); for (const x of [-1.2, 1.2]) add(g, M(new THREE.PlaneGeometry(0.6, 3.6).rotateX(-Math.PI / 2), H, { cast: false }), x, 42.12, 0);
  add(g, M(new THREE.PlaneGeometry(1.8, 0.6).rotateX(-Math.PI / 2), H, { cast: false }), 0, 42.12, 0);
  // splats all over the city (ending)
  C.splats = [];
  const R2 = rng(77);
  for (let s = 0; s < splats; s++) { const r = C.roofs[Math.floor(R2() * C.roofs.length)]; const sp = mosaicSplat(g, 3 + R2() * 3, s + 3); sp.position.set(r[0] + (R2() - 0.5) * r[3] * 0.5, r[1] + 0.05, r[2] + (R2() - 0.5) * r[3] * 0.5); C.splats.push(sp); }
  for (let s = 0; s < splats / 2; s++) { const sp = mosaicSplat(g, 3 + R2() * 2, s + 900); sp.position.set((Math.floor(R2() * 16) - 8) * 26 + 13, 0.06, (R2() - 0.5) * 360); }
  return C;
}
// busy street (x = 600): road along z, sidewalk on the right (x = 3..6), shops; CROWD positions on the sidewalk.
export const STREET = { x0: 600 };
export function buildStreet(W, { x0 = 600 } = {}) {
  const g = grp(W.scene, x0); const Sx = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(6, 80).rotateX(-Math.PI / 2), mat('#3a3c44', { rough: 0.9 })), 0, 0, -20);
  for (let z = -60; z < 20; z += 4) add(g, M(new THREE.PlaneGeometry(0.15, 1.8).rotateX(-Math.PI / 2), mat('#f2f0e8'), { cast: false }), 0, 0.01, z);
  const sw = mat(tilesTex('#c8c4bc', '#9a968e', 32, 5, 2), { rough: 0.9 }); sw.map.repeat.set(2, 30);
  for (const sx of [-1, 1]) add(g, M(boxG(4, 0.15, 80), sw), sx * 5, 0, -20);
  const cols = ['#e87c6a', '#9ab8e8', '#f2d27a', '#8ac8a8', '#c88aa8', '#e8a87c'];
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) {
    const c = cols[(i + (sx > 0 ? 2 : 0)) % cols.length], h = 9 + (i * 7 % 5) * 3, z = 12 - i * 9;
    const wm = mat(tex(paint(16, 32, (x, y) => { const b = hexToRgb(c); return (x % 4 === 0 || y % 5 === 0) ? b : [b[0] * 0.5, b[1] * 0.55, b[2] * 0.7]; })), { rough: 0.8 }); wm.map.repeat.set(3, Math.round(h / 3));
    add(g, M(boxG(5, h, 8.8), wm), sx * 9.5, 0, z);
    add(g, M(new THREE.BoxGeometry(0.2, 0.9, 7), mat(cols[(i + 3) % cols.length])), sx * 6.95, 3.2, z);
    add(g, M(new THREE.PlaneGeometry(6, 2.2), mat('#cfe0f0', { emissive: '#fff4d8', emissiveIntensity: 0.35 })), sx * 6.98, 1.4, z).rotation.y = -sx * Math.PI / 2;
  }
  for (const z of [6, -6, -18]) { add(g, M(new THREE.CylinderGeometry(0.07, 0.07, 4, 6).translate(0, 2, 0), mat('#3a3a40')), 3.4, 0.15, z); }
  return Sx;
}
// traffic jam (x = 700): three lanes of cars along -z.
export const TRAF = { x0: 700 };
export function buildTraffic(W, { x0 = 700 } = {}) {
  const g = grp(W.scene, x0); const T = { group: g, x0, cars: [] };
  add(g, M(new THREE.PlaneGeometry(14, 120).rotateX(-Math.PI / 2), mat('#3a3c44', { rough: 0.9 })), 0, 0, -40);
  for (const x of [-2.3, 2.3]) for (let z = 10; z > -100; z -= 4) add(g, M(new THREE.PlaneGeometry(0.14, 2).rotateX(-Math.PI / 2), mat('#f2f0e8'), { cast: false }), x, 0.01, z);
  const cols = ['#d8322e', '#2a6ad8', '#f2d030', '#3ab04a', '#f4f4f0', '#1e2c5a', '#f08a2a', '#8a4ad8', '#20b0b0'];
  let k = 0;
  for (let lane = -1; lane <= 1; lane++) for (let i = 0; i < 9; i++) {
    const c = car(g, { doorOpen: 0, color: cols[(k * 4 + lane + 9) % cols.length] });
    c.position.set(lane * 4.6, 0, 4 - i * 6.2 - (lane + 1) * 1.3);
    // wipers on the windshield (the cars face +z, toward the camera)
    const ws = [];
    for (const sx of [-0.42, 0.28]) { const wb = grp(c, sx, 0.9, 1.1); wb.rotation.x = -0.9; const wp = grp(wb, 0, 0, 0.01); add(wp, M(new THREE.BoxGeometry(0.035, 0.55, 0.03).translate(0, 0.27, 0), mat('#111'))); ws.push(wp); }
    c.userData.wipers = ws; T.cars.push(c); k++;
  }
  const cols2 = ['#e8a87c', '#9ab8e8', '#d8d0c0', '#8ac8a8'];
  for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) { const h = 12 + (i * 5 % 7) * 3; add(g, M(boxG(8, h, 9), mat(cols2[(i + (sx > 0 ? 1 : 0)) % 4], { rough: 0.8 })), sx * 13, 0, 8 - i * 10); }
  return T;
}
// TV news studio (x = 120): the anchor's desk at z = 0 (she sits behind it at z = -0.55 facing +z), a big open window
// behind her (z = -2.2) with the city outside, monitors with a LIVE badge.
export const NEWS = { x0: 120, seat: [0, -0.55], win: [0, 1.7, -2.2] };
export function buildNews(W, { x0 = 120 } = {}) {
  const g = grp(W.scene, x0); const N = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), mat(checkerTex('#1e2a4a', '#18223e', 64, 4, 5), { rough: 0.3 })), 0, 0, 1);
  // back wall with the big window opening (x -1.6..1.6, y 0.9..2.6)
  const wm = mat('#2a4a8a', { rough: 0.6 });
  const part = (x0_, x1_, y0, y1) => add(g, M(new THREE.PlaneGeometry(x1_ - x0_, y1 - y0), wm), (x0_ + x1_) / 2, (y0 + y1) / 2, -2.2);
  part(-5, -1.6, 0, 4); part(1.6, 5, 0, 4); part(-1.6, 1.6, 0, 0.9); part(-1.6, 1.6, 2.6, 4);
  const fr = mat('#c8ccd0', { metal: 0.5, rough: 0.3 });
  for (const [w, h, x, y] of [[3.3, 0.08, 0, 0.9], [3.3, 0.08, 0, 2.6], [0.08, 1.7, -1.62, 1.75], [0.08, 1.7, 1.62, 1.75]]) add(g, M(new THREE.BoxGeometry(w, h, 0.12), fr), x, y, -2.2);
  // the city outside the window
  const sky = new THREE.MeshBasicMaterial({ map: skyTex('sunset'), fog: false });
  add(g, M(new THREE.PlaneGeometry(40, 30), sky, { cast: false, receive: false }), 0, 4, -30);
  const R = rng(12);
  for (let i = 0; i < 18; i++) { const h = 6 + R() * 18; add(g, M(boxG(3 + R() * 3, h, 3), mat(['#e8a87c', '#9ab8e8', '#d8d0c0', '#c88aa8'][i % 4], { rough: 0.8 })), -18 + i * 2.2, -6, -16 - R() * 6); }
  // desk + LIVE monitors + lights
  add(g, M(boxG(2.6, 0.78, 0.7), mat('#f4f4f0', { rough: 0.3 })), 0, 0, 0);
  add(g, M(new THREE.BoxGeometry(2.62, 0.25, 0.02), mat('#d8202a', { emissive: '#d8202a', emissiveIntensity: 0.5 })), 0, 0.45, 0.36);
  const live = screenCanvas(256, 128);
  { const x = live.g; x.fillStyle = '#0e1a3a'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#e8202a'; x.beginPath(); x.roundRect(14, 14, 100, 42, 8); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 32px sans-serif'; x.fillText('LIVE', 26, 47); x.fillStyle = '#f2f2f2'; x.font = 'bold 30px sans-serif'; x.fillText('NEWS', 130, 47); x.fillStyle = '#2a6ad8'; x.fillRect(0, 80, 256, 48); live.t.needsUpdate = true; }
  for (const x of [-3, 3]) { add(g, M(new THREE.BoxGeometry(1.7, 1.0, 0.08), mat('#111')), x, 2.0, -2.1); add(g, M(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: live.t })), x, 2.0, -2.05); }
  N.papers = add(g, M(new THREE.BoxGeometry(0.24, 0.006, 0.32), mat('#fbfaf4')), 0, 0.785, 0.1);
  const sp = new THREE.SpotLight(0xffffff, 40, 10, 0.5, 0.6, 1.4); sp.position.set(0, 3.5, 3); sp.target.position.set(x0, 1.0, -0.5); sp.castShadow = true; W.scene.add(sp); W.scene.add(sp.target);
  const fl = new THREE.PointLight(0xe8f0ff, 3, 10, 1.6); fl.position.set(0, 2.5, 2); g.add(fl);
  return N;
}

// ================================================================== doctor reel: props
// wall calendar: a month grid; C.userData.cross(n, k) draws n red X marks (the last one growing with k 0..1)
export function calendar(parent) {
  const g = new THREE.Group(); parent.add(g);
  const S2 = screenCanvas(256, 300);
  const draw = (n = 0, k = 1) => {
    const x = S2.g; x.fillStyle = '#fbfaf4'; x.fillRect(0, 0, 256, 300);
    x.fillStyle = '#d8322e'; x.fillRect(0, 0, 256, 62); x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.fillText('MAY', 92, 44);
    x.fillStyle = '#e8e4d8'; for (let c = 0; c < 7; c++) for (let r = 0; r < 5; r++) x.fillRect(8 + c * 35, 72 + r * 44, 33, 42);
    x.fillStyle = '#3a3a40'; x.font = 'bold 14px sans-serif';
    for (let d = 1; d <= 31; d++) { const c = (d + 2) % 7, r = Math.floor((d + 2) / 7); if (r < 5) x.fillText(String(d), 12 + c * 35, 88 + r * 44); }
    x.strokeStyle = '#e8101a'; x.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const d = 11 + i, c = (d + 2) % 7, r = Math.floor((d + 2) / 7), cx = 8 + c * 35 + 16, cy = 72 + r * 44 + 21, kk = i === n - 1 ? k : 1;
      x.lineWidth = i === n - 1 ? 7 : 6;
      x.beginPath(); x.moveTo(cx - 14, cy - 16); x.lineTo(cx - 14 + 28 * Math.min(1, kk * 2), cy - 16 + 32 * Math.min(1, kk * 2)); x.stroke();
      if (kk > 0.5) { x.beginPath(); x.moveTo(cx + 14, cy - 16); x.lineTo(cx + 14 - 28 * (kk - 0.5) * 2, cy - 16 + 32 * (kk - 0.5) * 2); x.stroke(); }
    }
    S2.t.needsUpdate = true;
  };
  draw(0);
  add(g, M(new THREE.BoxGeometry(0.62, 0.74, 0.02), mat('#d8322e')), 0, 0, -0.012);
  add(g, M(new THREE.PlaneGeometry(0.6, 0.7), new THREE.MeshStandardMaterial({ map: S2.t, roughness: 0.9 })), 0, 0, 0.0);
  add(g, M(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).rotateX(Math.PI / 2), mat('#888')), 0, 0.38, 0.0);
  g.userData.cross = draw;
  return g;
}
// the strongest medicine: a dark glass bottle that glows, with a white skull sticker
export function medBottle(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.13 * s, 10).translate(0, 0.065 * s, 0), mat('#7a2ad8', { emissive: '#a050ff', emissiveIntensity: 0.9, rough: 0.15 })));
  add(g, M(new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.03 * s, 10).translate(0, 0.145 * s, 0), mat('#7a2ad8', { emissive: '#a050ff', emissiveIntensity: 0.9 })));
  add(g, M(new THREE.CylinderGeometry(0.024 * s, 0.024 * s, 0.03 * s, 10).translate(0, 0.175 * s, 0), mat('#f2f2ee')));
  const sk = textTex(64, 64, (x, w, h) => {
    x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1a1a1e'; x.beginPath(); x.arc(32, 26, 15, 0, 7); x.fill(); x.fillRect(22, 34, 20, 12);
    x.fillStyle = '#f6f4ee'; x.beginPath(); x.arc(26, 26, 4, 0, 7); x.arc(38, 26, 4, 0, 7); x.fill(); x.fillRect(29, 33, 6, 4);
    x.fillStyle = '#1a1a1e'; x.fillRect(12, 50, 40, 5); x.fillRect(20, 46, 5, 13); x.fillRect(39, 46, 5, 13);
  });
  const lab = new THREE.CylinderGeometry(0.0465 * s, 0.0465 * s, 0.07 * s, 10, 1, true, -0.9, 1.8);
  add(g, M(lab, mat(sk, { flat: false, rough: 0.8 })), 0, 0.065 * s, 0);
  g.userData.glow = glowSprite(g, [0, 0.08 * s, 0], 0.5 * s, 'rgba(190,120,255,1)', 0.85);
  const pl = new THREE.PointLight(0xb070ff, 1.2, 1.5, 2); pl.position.set(0, 0.1 * s, 0.1 * s); g.add(pl);
  g.userData.grip = { pos: [0, 0.05 * s, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  return g;
}
export function pill(parent, color = '#f4f4f0') {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.CapsuleGeometry(0.009, 0.018, 3, 6); geo.rotateZ(Math.PI / 2);
  add(g, M(geo, mat(color, { rough: 0.3 })));
  return g;
}
// the bill: B.userData.write(k) writes it progressively (0..1 for the lines), B.userData.show(n) shows n big red prices
export function billPaper(parent) {
  const g = new THREE.Group(); parent.add(g);
  const S2 = screenCanvas(256, 340);
  const draw = (lines = 0, prices = 0) => {
    const x = S2.g; x.fillStyle = '#fbfaf2'; x.fillRect(0, 0, 256, 340);
    x.fillStyle = '#2a6ad8'; x.fillRect(0, 0, 256, 46); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('+ CLINIC', 60, 33);
    x.fillStyle = '#2a2a30'; x.font = 'bold 26px sans-serif'; x.fillText('BILL', 98, 84);
    x.strokeStyle = '#c8c4b8'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(14, 112 + i * 38); x.lineTo(242, 112 + i * 38); x.stroke(); }
    x.font = 'italic bold 21px sans-serif'; x.fillStyle = '#1a2a6a';
    if (lines > 0) x.fillText('Treatment'.slice(0, Math.ceil(9 * Math.min(1, lines))), 16, 140);
    if (lines > 1) x.fillText('New shoes'.slice(0, Math.ceil(9 * Math.min(1, lines - 1))), 16, 200);
    x.fillStyle = '#e8101a'; x.font = 'bold 34px sans-serif';
    if (prices > 0) x.fillText('$50', 168, 142);
    if (prices > 1) { x.font = 'bold 40px sans-serif'; x.fillText('$500', 148, 204); }
    if (prices > 1) { x.strokeStyle = '#e8101a'; x.lineWidth = 3; x.beginPath(); x.ellipse(192, 192, 62, 26, -0.05, 0, 7); x.stroke(); }
    S2.t.needsUpdate = true;
  };
  draw(0, 0);
  add(g, M(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: S2.t, roughness: 0.95, side: THREE.DoubleSide })), 0, 0, 0);
  g.userData.write = draw;
  g.userData.grip = { pos: [0, -0.12, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function pen(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.006, 0.004, 0.14, 6).translate(0, 0.07, 0), mat('#1a3a9a', { rough: 0.3 })));
  add(g, M(new THREE.ConeGeometry(0.004, 0.012, 5).rotateX(Math.PI), mat('#c8ccd0', { metal: 0.6 })), 0, -0.006, 0);
  g.userData.grip = { pos: [0, 0.03, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.tip = [0, -0.012, 0];
  return g;
}
export function magazine(parent) {
  const g = new THREE.Group(); parent.add(g);
  const cv = textTex(64, 80, (x, w, h) => { x.fillStyle = '#f2d030'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8402a'; x.fillRect(4, 4, 56, 14); x.fillStyle = '#2a6ad8'; x.fillRect(10, 26, 44, 34); x.fillStyle = '#ffffff'; x.fillRect(14, 64, 36, 4); x.fillRect(14, 71, 28, 4); });
  for (const sx of [-1, 1]) { const p = add(g, M(new THREE.BoxGeometry(0.16, 0.22, 0.004), [mat('#fff'), mat('#fff'), mat('#fff'), mat('#fff'), mat(cv, { flat: false }), mat('#f6f4ee')]), sx * 0.08, 0, 0); p.rotation.y = -sx * 0.35; }
  g.userData.grips = { L: { pos: [0.15, -0.05, 0], axis: [0, 1, 0], up: [0, 0, 1] }, R: { pos: [-0.15, -0.05, 0], axis: [0, 1, 0], up: [0, 0, 1] } };
  return g;
}
function chairRow(parent, x, z, n = 5, ry = 0, color = '#2a8ad8') {
  const g = grp(parent, x, 0, z, ry); const chairs = [];
  const metal = mat('#9aa0a8', { metal: 0.5, rough: 0.4 }), seat = mat(color, { rough: 0.5 });
  add(g, M(new THREE.BoxGeometry(n * 0.55, 0.05, 0.05), metal), 0, 0.3, 0);
  for (let i = 0; i < n; i++) {
    const c = grp(g, (i - (n - 1) / 2) * 0.55, 0, 0);
    add(c, M(boxG(0.48, 0.05, 0.44), seat), 0, 0.44, 0); add(c, M(boxG(0.48, 0.5, 0.05), seat), 0, 0.46, -0.2);
    chairs.push(c);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, M(boxG(0.04, 0.32, 0.04), metal), sx * n * 0.26, 0, sz * 0.18);
  g.userData.chairs = chairs;
  return g;
}

// ================================================================== doctor reel: places
// the friend's living room (x = -60): sofa against the back wall (z = -1.2) facing +z, TV across (z = +2.2),
// the calendar on the left wall, the kitchen doorway on the right wall.
export const LIV = { x0: -60, sofa: [0, -0.95], cal: [-1.97, 1.55, -0.2] };
export function buildLiving(W, { x0 = -60 } = {}) {
  const g = grp(W.scene, x0); const L = { group: g, x0 };
  const fm = mat(planksTex('#b0804a', 64, 7), { rough: 0.6 }); fm.map.repeat.set(4, 4);
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), fm), 0, 0, 0.6);
  const wm = mat(wallpaperTex('#e8d2a8', '#dcc294'), { rough: 0.9 }); wm.map.repeat.set(10, 4);
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 0, 1.5, -1.5);
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), -2.0, 1.5, 0.6).rotation.y = Math.PI / 2;
  const part = (z0, z1, y0, y1) => add(g, M(new THREE.PlaneGeometry(z1 - z0, y1 - y0), wm), 2.0, (y0 + y1) / 2, (z0 + z1) / 2).rotation.y = -Math.PI / 2;
  part(-1.5, -0.2, 0, 3); part(0.7, 3.6, 0, 3); part(-0.2, 0.7, 2.1, 3);
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 0, 1.5, 3.6).rotation.y = Math.PI;
  add(g, M(new THREE.PlaneGeometry(4, 3).rotateY(-Math.PI / 2), mat(tilesTex('#f2f2ea', '#c8c8c0', 64, 3, 4))), 3.6, 1.5, 0.25);   // kitchen beyond
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(Math.PI / 2), matNoisy('#f6f0e2', { amount: 5 })), 0, 3.0, 0.6);
  L.sofa = sofa(g, '#6a8a4a'); L.sofa.position.set(...[LIV.sofa[0], 0, LIV.sofa[1]]);
  for (const x of [-0.6, 0.6]) add(g, M(new THREE.BoxGeometry(0.42, 0.42, 0.14), matNoisy(x < 0 ? '#e8a030' : '#d85a4a', { amount: 14 })), x, 0.72, -1.1).rotation.x = -0.25;
  add(g, M(boxG(1.0, 0.4, 0.55), mat(planksTex('#7a4a2a', 32, 9))), 0, 0, 0.35);
  add(g, M(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8).translate(0, 0.05, 0), mat('#e8402a')), 0.25, 0.4, 0.35);
  const rug = mat(tex(paint(32, 32, (x, y) => { const c = ((x >> 2) + (y >> 2)) & 1 ? [170, 60, 50] : [210, 170, 90]; return (x < 2 || y < 2 || x > 29 || y > 29) ? [90, 40, 30] : c; })), { rough: 1 });
  add(g, M(new THREE.PlaneGeometry(2.4, 1.8).rotateX(-Math.PI / 2), rug), 0, 0.005, 0.4);
  add(g, M(boxG(1.4, 0.5, 0.4), mat(planksTex('#5a3a22', 32, 11))), 0, 0, 2.3);
  add(g, M(new THREE.BoxGeometry(1.1, 0.65, 0.06), mat('#1a1a1e')), 0, 0.85, 2.3);
  add(g, M(new THREE.PlaneGeometry(1.0, 0.56), mat('#3a6ad8', { emissive: '#4a7ae8', emissiveIntensity: 0.5 })), 0, 0.85, 2.265).rotation.y = Math.PI;
  // lamp + plant + window + photos
  add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).translate(0, 0.75, 0), mat('#2a2a30')), 1.4, 0, -1.2);
  add(g, M(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 10, 1, true).translate(0, 1.6, 0), mat('#f2e2c0', { emissive: '#ffd890', emissiveIntensity: 0.8, side: THREE.DoubleSide })), 1.4, 0, -1.2);
  const lamp = new THREE.PointLight(0xffc880, 3.5, 6, 2); lamp.position.set(1.4, 1.5, -1.0); g.add(lamp);
  flowerPot(g, -1.6, -1.2, 4);
  add(g, M(new THREE.PlaneGeometry(1.0, 0.9), mat('#bfe0f4', { emissive: '#e0f0ff', emissiveIntensity: 0.6 })), -0.8, 1.7, -1.49);
  for (const sx of [-1, 1]) add(g, M(boxG(0.3, 1.3, 0.04), matNoisy('#c84a3a', { amount: 12 })), -0.8 + sx * 0.62, 1.05, -1.46);
  frame(g, photoCanvases().fam, 0.8, 1.75, -1.48, 0.5, 0.36);
  L.cal = calendar(g); L.cal.position.set(LIV.cal[0], LIV.cal[1], LIV.cal[2]); L.cal.rotation.y = Math.PI / 2;
  const pl = new THREE.PointLight(0xffe0b0, 2.5, 7, 2); pl.position.set(0, 2.6, 0.6); g.add(pl);
  return L;
}
// the clinic entrance outside (x = 300): a white building with a big red cross and sliding glass doors at z = 0
export const CLIN = { x0: 300 };
export function buildClinic(W, { x0 = 300 } = {}) {
  const g = grp(W.scene, x0); const C = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), mat(tilesTex('#c8c4bc', '#9a968e', 32, 5, 4), { rough: 0.9 })), 0, 0, 5);
  add(g, M(new THREE.PlaneGeometry(40, 8).rotateX(-Math.PI / 2), mat('#3a3c44', { rough: 0.9 })), 0, 0.01, 12);
  const wm = mat(tex(paint(32, 32, (x, y) => { const d = ((x * 7 + y * 3) % 5); return y % 16 === 0 ? [200, 206, 214] : [238 - d, 240 - d, 242 - d]; })), { rough: 0.7 }); wm.map.repeat.set(8, 4);
  add(g, M(boxG(14, 7, 6), wm), 0, 0, -3.05);
  add(g, M(new THREE.BoxGeometry(14.1, 0.5, 0.1), mat('#2a8ad8')), 0, 3.0, -0.0);
  for (const [w, h, y] of [[0.9, 2.7, 5.2], [2.7, 0.9, 5.2]]) add(g, M(new THREE.BoxGeometry(w, h, 0.25), mat('#e8202a', { emissive: '#ff3030', emissiveIntensity: 0.4 })), -3.5, y, 0.1);
  const sign = textTex(256, 64, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a6ad8'; x.font = 'bold 46px sans-serif'; x.fillText('CLINIC', 40, 48); });
  add(g, M(new THREE.PlaneGeometry(3.2, 0.8), mat(sign, { flat: false })), 1.6, 5.2, 0.05);
  // sliding glass doors (open) + frame, a canopy, planters
  add(g, M(new THREE.PlaneGeometry(2.4, 2.4), mat('#3a4a5a', { emissive: '#ffe8c8', emissiveIntensity: 0.25 })), 0, 1.2, 0.02);
  const gl = mat('#bfe0f4', { rough: 0.05, transparent: true, opacity: 0.35 });
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(1.0, 2.3, 0.04), gl), sx * 1.55, 1.15, 0.1);
  add(g, M(new THREE.BoxGeometry(2.8, 0.15, 0.15), mat('#9aa0a8', { metal: 0.5 })), 0, 2.45, 0.1);
  add(g, M(new THREE.BoxGeometry(3.6, 0.12, 1.6), mat('#f4f4f0')), 0, 2.9, 0.8);
  for (const x of [-2.6, 2.6]) { flowerPot(g, x, 0.6, x > 0 ? 6 : 7); }
  for (const x of [-6, 6]) tree(g, x, 3, 1.2, x > 0 ? 3 : 5);
  return C;
}
// the doctor's office (x = 60): exam bed (x = -1.0, z = -0.4, along x), medicine shelf on the back wall (z = -1.6),
// desk with a computer on the right (x = 1.1, z = 0.2), an eye chart, a sink.
export const OFF = { x0: 60, bed: [-0.95, -0.45], shelf: [0.2, -1.5], desk: [1.15, 0.25] };
export function buildOffice(W, { x0 = 60 } = {}) {
  const g = grp(W.scene, x0); const O = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), mat(checkerTex('#dfe8e8', '#b8c8cc', 64, 8, 4), { rough: 0.35 })), 0, 0, 0.8);
  const wm = matNoisy('#cfe8e2', { amount: 6 });
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 0, 1.5, -1.65);
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), -2.2, 1.5, 0.8).rotation.y = Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 2.2, 1.5, 0.8).rotation.y = -Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(6, 3), wm), 0, 1.5, 3.6).rotation.y = Math.PI;
  add(g, M(new THREE.PlaneGeometry(6, 6).rotateX(Math.PI / 2), matNoisy('#f6f6f2', { amount: 4 })), 0, 3.0, 0.8);
  // exam bed with a paper sheet
  const bed = grp(g, OFF.bed[0], 0, OFF.bed[1]);
  add(bed, M(boxG(1.9, 0.12, 0.7), mat('#5a8ab0', { rough: 0.5 })), 0, 0.62, 0);
  add(bed, M(boxG(0.5, 0.12, 0.7), mat('#5a8ab0', { rough: 0.5 })), -0.75, 0.74, 0).rotation.z = -0.3;
  add(bed, M(boxG(1.7, 0.01, 0.5), mat('#fbfaf4')), 0.1, 0.745, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(bed, M(boxG(0.05, 0.62, 0.05), mat('#c8ccd0', { metal: 0.5 })), sx * 0.85, 0, sz * 0.3);
  add(bed, M(boxG(1.8, 0.1, 0.62), mat('#e8eaee')), 0, 0.2, 0);
  // medicine shelf with coloured bottles + boxes
  const sh = grp(g, OFF.shelf[0], 0, OFF.shelf[1]);
  add(sh, M(boxG(1.6, 2.0, 0.32), mat('#f4f4f0', { rough: 0.5 })), 0, 0.2, 0);
  const R = rng(5);
  for (let r = 0; r < 4; r++) {
    add(sh, M(boxG(1.5, 0.03, 0.3), mat('#d8d8d4')), 0, 0.45 + r * 0.45, 0.02);
    for (let i = 0; i < 9; i++) {
      const c = ['#e8402a', '#2a8ad8', '#f2d030', '#3ab04a', '#ffffff', '#f08a2a', '#8a4ad8'][Math.floor(R() * 7)];
      if (R() > 0.5) add(sh, M(new THREE.CylinderGeometry(0.035, 0.035, 0.1 + R() * 0.08, 8).translate(0, 0.07, 0), mat(c, { rough: 0.3 })), -0.66 + i * 0.165, 0.48 + r * 0.45, 0.06);
      else add(sh, M(boxG(0.1, 0.14 + R() * 0.06, 0.08), mat(c, { rough: 0.6 })), -0.66 + i * 0.165, 0.48 + r * 0.45, 0.06);
    }
  }
  // desk + computer + papers + pen holder + chair
  const dk = grp(g, OFF.desk[0], 0, OFF.desk[1]);
  add(dk, M(boxG(0.8, 0.04, 1.4), mat(planksTex('#a87a4a', 32, 7), { rough: 0.5 })), 0, 0.74, 0);
  for (const sz of [-1, 1]) add(dk, M(boxG(0.76, 0.74, 0.04), mat('#8a6a4a')), 0, 0, sz * 0.66);
  add(dk, M(new THREE.BoxGeometry(0.06, 0.38, 0.5), mat('#1a1a1e')), 0.2, 1.0, -0.25);
  add(dk, M(new THREE.PlaneGeometry(0.46, 0.32), mat('#3a8ad8', { emissive: '#5aa0f0', emissiveIntensity: 0.5 })), 0.165, 1.0, -0.25).rotation.y = -Math.PI / 2;
  add(dk, M(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8).translate(0, 0.05, 0), mat('#2a2a30')), 0.25, 0.76, 0.4);
  add(dk, M(new THREE.BoxGeometry(0.22, 0.01, 0.3), mat('#fbfaf4')), -0.05, 0.765, 0.2);
  // eye chart + a skeleton-free poster + sink + window
  const ec = textTex(48, 72, (x, w, h) => { x.fillStyle = '#fbfaf4'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1a1e'; [16, 12, 9, 7, 5, 4].forEach((s, r) => { const y = 6 + r * 11; for (let i = 0; i < Math.floor(36 / s); i++) x.fillRect(6 + i * (s + 2), y, s, s - 1 > 2 ? s - 1 : 2); }); });
  frame(g, ec, -1.2, 1.7, -1.63, 0.45, 0.68, { color: '#f4f4f0' });
  add(g, M(new THREE.PlaneGeometry(0.9, 0.9), mat('#bfe0f4', { emissive: '#e8f4ff', emissiveIntensity: 0.6 })), 2.19, 1.6, -0.6).rotation.y = -Math.PI / 2;
  add(g, M(boxG(0.6, 0.85, 0.45), mat('#f4f4f0')), -1.8, 0, 1.4);
  const pl = new THREE.PointLight(0xfff4e8, 3.2, 8, 2); pl.position.set(0, 2.6, 0.4); g.add(pl);
  add(g, M(new THREE.BoxGeometry(1.4, 0.04, 0.3), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 })), 0, 2.97, 0.4);
  return O;
}
// the waiting room (x = 120): two rows of chairs facing -z (a TV on the back wall z = -3), the receptionist's desk
// on the right (x = 2.6), the toilet door in the left wall (x = -3.4, z = -1.2) with a red OCCUPIED sign, a plant,
// the wall clock, posters. The line for the toilet runs along the left wall.
export const WR = { x0: 120, rows: [[0, 0.4], [0, 1.5]], door: [-3.4, -1.2], recep: [2.6, -0.8], clock: [-0.65, 2.2, -2.98] };
export function buildWaiting(W, { x0 = 120, doorOpen = 0 } = {}) {
  const g = grp(W.scene, x0); const R2 = { group: g, x0 };
  add(g, M(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mat(checkerTex('#e8e2d0', '#c8bea8', 64, 8, 9), { rough: 0.4 })), 0, 0, 0.6);
  const wm = mat(tex(paint(32, 32, (x, y) => { const d = ((x * 7 + y * 3) % 5); return y > 22 ? [150, 190, 200] : [236 - d, 230 - d, 210 - d]; })), { rough: 0.8 }); wm.map.repeat.set(10, 1);
  add(g, M(new THREE.PlaneGeometry(8, 3), wm), 0, 1.5, -3.0);
  add(g, M(new THREE.PlaneGeometry(8, 3), wm), 4.0, 1.5, 0.6).rotation.y = -Math.PI / 2;
  add(g, M(new THREE.PlaneGeometry(8, 3), wm), 0, 1.5, 4.0).rotation.y = Math.PI;
  const part = (z0, z1, y0, y1) => add(g, M(new THREE.PlaneGeometry(z1 - z0, y1 - y0), wm), -3.4, (y0 + y1) / 2, (z0 + z1) / 2).rotation.y = Math.PI / 2;
  part(-3, -1.62, 0, 3); part(-0.78, 4, 0, 3); part(-1.62, -0.78, 2.1, 3);
  add(g, M(new THREE.PlaneGeometry(8, 8).rotateX(Math.PI / 2), matNoisy('#f4f0e6', { amount: 4 })), 0, 3.0, 0.6);
  for (let i = -1; i <= 1; i++) add(g, M(new THREE.BoxGeometry(1.2, 0.04, 0.3), mat('#ffffff', { emissive: '#fff8e8', emissiveIntensity: 1.4 })), i * 2.2, 2.97, 0.4);
  const pl = new THREE.PointLight(0xffecd0, 4, 10, 1.8); pl.position.set(0, 2.6, 0.6); g.add(pl);
  // chair rows (facing -z), the TV, magazines table, plant, water cooler
  R2.rows = WR.rows.map(([x, z], i) => chairRow(g, x, z, 6, Math.PI, i ? '#e8742a' : '#2a8ad8'));
  add(g, M(new THREE.BoxGeometry(1.3, 0.75, 0.06), mat('#1a1a1e')), 0.6, 1.95, -2.95);
  const tvt = textTex(64, 40, (x, w, h) => { x.fillStyle = '#3aa0e8'; x.fillRect(0, 0, w, h); x.fillStyle = '#3ab04a'; x.fillRect(0, 26, w, 14); x.fillStyle = '#f2d030'; x.beginPath(); x.arc(50, 10, 6, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(8, 8, 20, 6); });
  add(g, M(new THREE.PlaneGeometry(1.2, 0.66), mat(tvt, { emissive: '#ffffff', emissiveIntensity: 0.35, flat: false })), 0.6, 1.95, -2.915);
  add(g, M(boxG(0.8, 0.4, 0.45), mat(planksTex('#a87a4a', 32, 3))), -2.4, 0, 0.9);
  for (let i = 0; i < 3; i++) add(g, M(new THREE.BoxGeometry(0.2, 0.01, 0.26), mat(['#f2d030', '#e8402a', '#2a8ad8'][i])), -2.5 + i * 0.12, 0.41 + i * 0.01, 0.9).rotation.y = i * 0.4;
  flowerPot(g, 3.4, -2.5, 8); flowerPot(g, -2.9, -2.6, 9);
  add(g, M(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 10).translate(0, 1.15, 0), mat('#bfe0f4', { transparent: true, opacity: 0.6 })), 3.6, 0, 2.6);
  add(g, M(boxG(0.36, 0.95, 0.36), mat('#f4f4f0')), 3.6, 0, 2.6);
  // posters + the clock
  [['#3ab04a', -1.6], ['#e8402a', 2.2]].forEach(([c, x], i) => {
    const pt = textTex(32, 44, (cx, w, h) => { cx.fillStyle = '#fbfaf4'; cx.fillRect(0, 0, w, h); cx.fillStyle = c; cx.fillRect(3, 3, 26, 22); cx.fillStyle = '#fff'; cx.fillRect(13, 6, 6, 16); cx.fillRect(8, 11, 16, 6); cx.fillStyle = '#5a5a60'; for (let r = 0; r < 4; r++) cx.fillRect(4, 29 + r * 4, 24 - (r % 2) * 6, 2); });
    frame(g, pt, x, 1.7, -2.97, 0.5, 0.68, { color: '#f4f4f0' });
  });
  R2.clock = wallClock(g, { r: 0.28 }); R2.clock.position.set(...WR.clock);
  // reception desk (+ window) on the right
  const rd = grp(g, WR.recep[0], 0, WR.recep[1]);
  add(rd, M(boxG(0.7, 1.05, 2.0), mat('#f4f4f0', { rough: 0.4 })), 0, 0, 0);
  add(rd, M(boxG(0.8, 0.06, 2.1), mat(planksTex('#a87a4a', 32, 5))), 0, 1.05, 0);
  add(rd, M(new THREE.BoxGeometry(0.02, 0.4, 1.8), mat('#2a8ad8')), -0.36, 0.7, 0);
  // the toilet door (left wall) with the red OCCUPIED sign
  const fr = mat('#f4f4f0', { rough: 0.5 });
  for (const z of [-1.64, -0.76]) add(g, M(boxG(0.1, 2.12, 0.06), fr), -3.4, 0, z);
  add(g, M(boxG(0.1, 0.07, 0.94), fr), -3.4, 2.07, -1.2);
  R2.inside = add(g, M(new THREE.PlaneGeometry(0.84, 2.05), mat('#2a2420')), -3.45, 1.025, -1.2); R2.inside.rotation.y = Math.PI / 2;
  R2.door = new THREE.Group(); R2.door.position.set(-3.38, 0, -1.62); g.add(R2.door);
  add(R2.door, M(boxG(0.05, 2.03, 0.84).translate(0, 0, 0.42), mat('#7aa0c8', { rough: 0.5 })));
  add(R2.door, M(new THREE.SphereGeometry(0.03, 6, 4), mat('#d8b040', { metal: 0.6, rough: 0.3 })), 0.05, 1.0, 0.75);
  const occ = textTex(128, 40, (x, w, h) => { x.fillStyle = '#e8101a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.font = 'bold 22px sans-serif'; x.fillText('OCCUPIED', 9, 28); });
  R2.sign = add(R2.door, M(new THREE.PlaneGeometry(0.42, 0.13), mat(occ, { emissive: '#ff2020', emissiveIntensity: 0.6, flat: false })), 0.03, 1.55, 0.42);
  R2.sign.rotation.y = Math.PI / 2;
  const tl = textTex(48, 48, (x, w, h) => { x.fillStyle = '#2a6ad8'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(15, 12, 5, 0, 7); x.arc(33, 12, 5, 0, 7); x.fill(); x.fillRect(11, 19, 8, 18); x.beginPath(); x.moveTo(27, 19); x.lineTo(39, 19); x.lineTo(42, 32); x.lineTo(24, 32); x.fill(); });
  add(R2.door, M(new THREE.PlaneGeometry(0.2, 0.2), mat(tl, { flat: false })), 0.03, 1.8, 0.42).rotation.y = Math.PI / 2;
  R2.door.rotation.y = -1.5 * doorOpen;
  return R2;
}
