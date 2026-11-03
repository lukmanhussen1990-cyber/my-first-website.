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
export function buildHouse(W, { night = false, doorOpen = 0, carDoor = 1, bathOpen = 0, bathGlow = false } = {}) {
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
  const wallM = mat(sidingTex('#f2c84a', 64, 5), { rough: 0.85 }); wallM.map.repeat.set(4, 4);
  const wallW = mat(sidingTex('#f2c84a', 64, 5), { rough: 0.85 });              // world-mapped (1 repeat = 2 m)
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
  add(door, M(boxG(0.9, 2.05, 0.08).translate(0.45, 0, 0), matNoisy('#b8262a', { amount: 10 })));
  add(door, M(new THREE.SphereGeometry(0.035, 6, 4), mat('#d8b040', { metal: 0.8, rough: 0.3 })), 0.78, 1.0, 0.07);
  for (let i = 0; i < 2; i++) add(door, M(new THREE.BoxGeometry(0.6, 0.6, 0.02), matNoisy('#a01e22', { amount: 10 })), 0.45, 0.5 + i * 0.85, 0.045);
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
  H.car = car(g, { doorOpen: carDoor }); H.car.position.set(3.6, 0, 6.9);
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
