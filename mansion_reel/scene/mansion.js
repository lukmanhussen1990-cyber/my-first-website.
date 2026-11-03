// Mansion reel sets + props (low-poly, smooth pastel look like the reference). Each builder adds to W.scene and
// returns handles for the animation. Places are far apart (x0) so they never see each other:
//   night street + park + café (x = -200), mansion outside (x = 0), marble hall + golden stairs + couch (x = 100),
//   dining room (x = 160), golden bathroom (x = 220), Paris (x = 320), garden wedding (x = 420)
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp } from './lib.js';
import { textTex, glowSprite, tree, flowerPot, frame, toiletAt } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const soft = (hex, amount = 5, o = {}) => mat(tex(paint(32, 32, (() => { const b = hexToRgb(hex), R = rng(o.seed ?? 3); return () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }; })())), o);
export const GOLD = () => mat('#f0c040', { metal: 0.95, rough: 0.22, emissive: '#6a4a08', emissiveIntensity: 0.35 });
const WHITE = () => mat('#f8f6f0', { rough: 0.5 });

export const ST = { x0: -200 };          // night street: park (bench, lamp, park toilet) + café
export const MO = { x0: 0 };             // mansion outside
export const HA = { x0: 100, stairs: [0, -2.2], couch: [-4.2, 1.6], door: [0, 5.6], top: 3.0, chand: [0, 5.0, 0.6] };
export const DI = { x0: 160 };
export const BA = { x0: 220 };
export const PA = { x0: 320 };
export const GA = { x0: 420 };

// ------------------------------------------------------------------ sky + light
function skyCanvas(stops) {
  const c = canvas(16, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([k, col]) => g.addColorStop(k, col)); x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; return t;
}
const SKIES = {
  night: [[0, '#0a1430'], [0.38, '#1a2c5c'], [0.5, '#3a4a7c'], [0.52, '#1a2236'], [1, '#10141e']],
  day: [[0, '#7ab4ec'], [0.35, '#a8d4f4'], [0.5, '#e4f2fa'], [0.52, '#b8d8a8'], [1, '#90b880']],
  sunset: [[0, '#4a5aa8'], [0.25, '#a88ac8'], [0.38, '#f6a0a8'], [0.46, '#ffc890'], [0.5, '#ffe8b0'], [0.52, '#c8a890'], [1, '#8a7a6a']],
};
export function sky(W, kind, at) {
  const s = M(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({ map: skyCanvas(SKIES[kind]), side: THREE.BackSide, fog: false, depthWrite: false }), { cast: false, receive: false });
  s.position.set(...at); W.scene.add(s);
  if (kind === 'night') {
    const R = rng(77), pos = [];
    for (let i = 0; i < 420; i++) { const a = R() * Math.PI * 2, e = 0.12 + R() * 1.2, r = 90; pos.push(at[0] + Math.cos(a) * Math.cos(e) * r, at[1] + Math.sin(e) * r, at[2] + Math.sin(a) * Math.cos(e) * r); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    W.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6dc, size: 0.4, fog: false })));
    const moon = M(new THREE.CircleGeometry(4, 20), new THREE.MeshBasicMaterial({ color: '#fff4d0', fog: false }), { cast: false, receive: false });
    moon.position.set(at[0] - 30, at[1] + 48, at[2] - 70); moon.lookAt(at[0], at[1], at[2]); W.scene.add(moon);
  }
  return s;
}

// ------------------------------------------------------------------ textures
function marbleTex(base = '#f4f2ee', vein = '#c8c4c0', size = 128, seed = 5) {
  const B = hexToRgb(base), Vn = hexToRgb(vein), R = rng(seed);
  const lines = []; for (let i = 0; i < 9; i++) lines.push([R() * size, R() * size, (R() - 0.5) * 2.4, 0.6 + R() * 1.6, R() * 6]);
  return tex(paint(size, size, (x, y) => {
    let d = 1e9;
    for (const [lx, ly, sl, w, ph] of lines) { const yy = ly + (x - lx) * sl + Math.sin(x * 0.08 + ph) * 6; d = Math.min(d, Math.abs(((y - yy) % size + size) % size) / w); }
    const k = Math.exp(-d * 0.9) * 0.55;
    return [lerp(B[0], Vn[0], k) + (R() - 0.5) * 3, lerp(B[1], Vn[1], k) + (R() - 0.5) * 3, lerp(B[2], Vn[2], k) + (R() - 0.5) * 3];
  }), { nearest: false });
}
function checkMarble(a = '#f6f4ee', b = '#d8d2c8', n = 8, size = 128) {
  const A = hexToRgb(a), B = hexToRgb(b), cell = size / n, R = rng(4);
  return tex(paint(size, size, (x, y) => {
    const c = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) ? A : B; const e = (x % cell === 0 || y % cell === 0) ? -18 : 0;
    const v = Math.sin((x + y * 0.6) * 0.15) * 3 + (R() - 0.5) * 3 + e; return [c[0] + v, c[1] + v, c[2] + v];
  }), { nearest: false });
}
function brickTex(hex = '#b8644a', size = 64) {
  const b = hexToRgb(hex), R = rng(9);
  return tex(paint(size, size, (x, y) => { const r = Math.floor(y / 8), o = (r & 1) * 8; const e = y % 8 === 0 || (x + o) % 16 === 0; const d = e ? 60 : (R() - 0.5) * 16; return e ? [200, 196, 186] : [b[0] + d, b[1] + d, b[2] + d]; }));
}
function stripeTex(a, b, n = 8) {
  return textTex(64, 16, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i & 1 ? b : a; x.fillRect(i * w / n, 0, w / n + 1, h); } });
}
function signTex(text, { w = 256, h = 96, bg = '#e8202a', fg = '#ffffff', font = 'bold 60px sans-serif', border = '#ffffff' } = {}) {
  return textTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = border; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
  });
}
const planeAt = (parent, w, h, material, x, y, z, ry = 0) => { const m = add(parent, M(new THREE.PlaneGeometry(w, h), material, { cast: false }), x, y, z); m.rotation.y = ry; return m; };

// ------------------------------------------------------------------ small props
export function streetLamp(parent, x, z, { h = 3.4, light = true, color = '#fff0c8' } = {}) {
  const g = grp(parent, x, 0, z), dark = mat('#2a2e38', { rough: 0.4, metal: 0.5 });
  add(g, M(new THREE.CylinderGeometry(0.05, 0.08, h, 8).translate(0, h / 2, 0), dark));
  add(g, M(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8), dark), 0, h + 0.38, 0);
  add(g, M(new THREE.CylinderGeometry(0.13, 0.08, 0.32, 8), mat(color, { emissive: color, emissiveIntensity: 1.6, rough: 0.3 })), 0, h + 0.16, 0);
  glowSprite(g, [0, h + 0.15, 0], 1.6, 'rgba(255,230,170,0.9)', 0.75);
  if (light) { const l = new THREE.PointLight(0xffe2b0, 6, 9, 1.6); l.position.set(0, h + 0.1, 0); g.add(l); }
  return g;
}
export function bench(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry), wood = soft('#b8784a', 10), iron = mat('#2a2e38', { rough: 0.45, metal: 0.4 });
  for (let i = 0; i < 3; i++) add(g, M(boxG(1.6, 0.04, 0.12), wood), 0, 0.44, -0.16 + i * 0.15);
  for (let i = 0; i < 2; i++) { const b = add(g, M(boxG(1.6, 0.11, 0.035), wood), 0, 0.58 + i * 0.16, -0.25); b.rotation.x = -0.12; }
  for (const sx of [-0.7, 0.7]) { add(g, M(boxG(0.06, 0.44, 0.42), iron), sx, 0, -0.03); add(g, M(boxG(0.06, 0.5, 0.05), iron), sx, 0.44, -0.26); }
  return g;
}
export function goldToilet(parent, x, z, ry = 0, s = 1.0) {
  const g = grp(parent, x, 0, z, ry); g.scale.setScalar(s);
  const t = toiletAt(g, 0, 0, { water: 0.2 });
  const gold = GOLD();
  t.group.traverse((o) => { if (o.isMesh && o !== t.water) o.material = gold; });
  add(g, M(new THREE.CylinderGeometry(0.34, 0.38, 0.04, 20), mat('#e8d8f0', { rough: 0.6 })), 0, 0.0, -0.05);   // round rug
  const l = new THREE.PointLight(0xffd880, 2.5, 3, 2); l.position.set(0, 1.0, 0.6); g.add(l);
  g.userData.top = V(0, 0.6, 0);
  return g;
}
export function chandelier(parent, x, y, z, s = 1) {
  const pivot = grp(parent, x, y, z); const g = grp(pivot, 0, 0, 0); g.scale.setScalar(s);
  const gold = GOLD(), crystal = mat('#ffffff', { rough: 0.05, metal: 0.1, emissive: '#cfe4ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
  add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6).translate(0, -0.6, 0), gold));
  add(g, M(new THREE.SphereGeometry(0.1, 8, 6), gold), 0, -1.25, 0);
  for (const [r, yy, n] of [[0.75, -1.45, 10], [0.48, -1.2, 8], [0.25, -0.98, 6]]) {
    const ring = new THREE.TorusGeometry(r, 0.025, 5, 24); ring.rotateX(Math.PI / 2); add(g, M(ring, gold), 0, yy, 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = Math.cos(a) * r, pz = Math.sin(a) * r;
      add(g, M(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6), mat('#fff8ec')), px, yy + 0.07, pz);
      add(g, M(new THREE.SphereGeometry(0.035, 6, 4), mat('#fff2c0', { emissive: '#ffd890', emissiveIntensity: 2 })), px, yy + 0.15, pz);
      add(g, M(new THREE.OctahedronGeometry(0.05, 0).scale(0.6, 1.4, 0.6), crystal), px, yy - 0.12, pz);
      add(g, M(new THREE.OctahedronGeometry(0.035, 0).scale(0.6, 1.4, 0.6), crystal), px * 0.92, yy - 0.26, pz * 0.92);
    }
  }
  add(g, M(new THREE.OctahedronGeometry(0.12, 0).scale(0.7, 1.6, 0.7), crystal), 0, -1.62, 0);
  glowSprite(g, [0, -1.25, 0], 3.2, 'rgba(255,226,160,0.9)', 0.55);
  const l = new THREE.PointLight(0xffe2b0, 5, 12, 1.5); l.position.set(0, -1.3, 0); g.add(l);
  return pivot;
}
export function bigCouch(parent, x, z, ry = 0, color = '#9ad0c8') {
  const g = grp(parent, x, 0, z, ry), m = soft(color, 6), m2 = soft(color, 10, { seed: 4 }), leg = mat('#c8a060', { metal: 0.6, rough: 0.3 });
  add(g, M(boxG(2.9, 0.42, 1.1), m), 0, 0.1, 0);
  add(g, M(boxG(2.9, 0.68, 0.32), m), 0, 0.42, -0.42);
  for (const sx of [-1, 1]) add(g, M(boxG(0.3, 0.42, 1.1), m), sx * 1.32, 0.42, 0);
  for (const sx of [-0.68, 0.68]) add(g, M(new THREE.BoxGeometry(1.3, 0.16, 0.85).translate(0, 0.08, 0), m2), sx, 0.52, 0.08);
  for (const [sx, c] of [[-0.9, '#f4c8d8'], [0.95, '#f8e8b8'], [0.0, '#ffffff']]) { const p = add(g, M(new THREE.BoxGeometry(0.46, 0.4, 0.14), soft(c, 6)), sx, 0.88, -0.25); p.rotation.set(-0.25, sx * 0.1, sx * 0.08); }
  for (const sx of [-1.3, 1.3]) for (const sz of [-0.45, 0.45]) add(g, M(boxG(0.07, 0.1, 0.07), leg), sx, 0, sz);
  g.userData.seatY = 0.6;
  return g;
}
export function blanket(parent, color = '#f6b8c8') {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.BoxGeometry(1.9, 0.09, 1.25, 10, 1, 8), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + Math.sin(x * 4) * 0.025 + Math.cos(z * 5 + x) * 0.02 - (Math.abs(z) > 0.5 ? (Math.abs(z) - 0.5) * 0.5 : 0)); }
  geo.computeVertexNormals();
  const t = textTex(64, 64, (x, w, h) => { x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 8; i++) { x.fillRect(i * 8, 0, 2, h); x.fillRect(0, i * 8, w, 2); } });
  add(g, M(geo, mat(t, { rough: 0.95, flat: false })));
  return g;
}
export function tvSet(parent, x, y, z, ry = 0) {
  const g = grp(parent, x, y, z, ry);
  add(g, M(new THREE.BoxGeometry(1.9, 1.1, 0.08), mat('#1a1a20', { rough: 0.3 })));
  const scr = textTex(128, 72, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8ad0ff'); gr.addColorStop(1, '#d8f0ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#6ac86a'; c.fillRect(0, 50, w, 22); c.fillStyle = '#ffe040'; c.beginPath(); c.arc(100, 20, 10, 0, 7); c.fill(); c.fillStyle = '#f07a9a'; c.fillRect(30, 30, 18, 22); c.fillStyle = '#7a9af0'; c.fillRect(60, 34, 16, 18); });
  add(g, M(new THREE.PlaneGeometry(1.78, 0.98), mat(scr, { emissive: '#ffffff', emissiveIntensity: 0.55, flat: false }), { cast: false }), 0, 0, 0.045);
  const l = new THREE.PointLight(0x9ad0ff, 1.5, 5, 2); l.position.set(0, 0, 0.8); g.add(l);
  return g;
}
export function towel(parent, color = '#f2a0b8') {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.BoxGeometry(0.16, 0.02, 0.62, 1, 1, 8), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) - Math.max(0, Math.abs(z) - 0.08) * 1.2); p.setZ(i, z * (Math.abs(z) > 0.08 ? 0.45 : 1)); }
  geo.computeVertexNormals();
  add(g, M(geo, soft(color, 10)));
  return g;
}
export function tinyBag(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.SphereGeometry(0.11, 8, 6).scale(1.2, 0.85, 0.8), soft('#c87a5a', 10)), 0, 0.09, 0);
  add(g, M(new THREE.TorusGeometry(0.07, 0.012, 4, 10, Math.PI), mat('#7a4a2a')), 0, 0.17, 0);
  g.userData.grip = { pos: [0, 0.2, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  return g;
}
export function sock(parent, color = '#f2c040') {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.06, 0.16, 0.05), soft(color, 8)), 0, 0.08, 0);
  add(g, M(new THREE.BoxGeometry(0.06, 0.05, 0.11), soft(color, 8)), 0, 0.0, 0.03);
  return g;
}
export function toothbrush(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.015, 0.17, 0.012), mat('#4ab0e8', { rough: 0.3 })), 0, 0.085, 0);
  add(g, M(new THREE.BoxGeometry(0.018, 0.03, 0.02), mat('#ffffff')), 0, 0.16, 0.012);
  return g;
}
export function candle(parent, x, y, z, h = 0.22) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.022, 0.022, h, 8).translate(0, h / 2, 0), mat('#fff8ea', { rough: 0.6 })));
  const fl = add(g, M(new THREE.ConeGeometry(0.014, 0.05, 6).translate(0, 0.025, 0), mat('#ffd060', { emissive: '#ffb030', emissiveIntensity: 3 }), { cast: false }), 0, h + 0.005, 0);
  glowSprite(g, [0, h + 0.03, 0], 0.32, 'rgba(255,200,110,0.95)', 0.85);
  g.userData.flame = fl;
  return g;
}
export function candelabra(parent, x, y, z) {
  const g = grp(parent, x, y, z), gold = GOLD();
  add(g, M(new THREE.CylinderGeometry(0.02, 0.07, 0.3, 8).translate(0, 0.15, 0), gold));
  add(g, M(new THREE.BoxGeometry(0.42, 0.025, 0.025), gold), 0, 0.3, 0);
  for (const sx of [-0.2, 0, 0.2]) { add(g, M(new THREE.CylinderGeometry(0.03, 0.02, 0.04, 8), gold), sx, 0.32, 0); candle(g, sx, 0.33 + (sx === 0 ? 0.06 : 0), 0, 0.2); }
  const l = new THREE.PointLight(0xffc070, 3.5, 6, 1.6); l.position.set(0, 0.7, 0); g.add(l);
  return g;
}
export function ringBox(parent) {
  const g = new THREE.Group(); parent.add(g);
  const vel = soft('#c8203a', 8);
  add(g, M(boxG(0.08, 0.045, 0.08), vel));
  add(g, M(boxG(0.066, 0.004, 0.066), mat('#f4f0f0', { rough: 0.9 })), 0, 0.045, 0);
  const lid = grp(g, 0, 0.045, -0.04); add(lid, M(new THREE.BoxGeometry(0.08, 0.03, 0.08).translate(0, 0.015, 0.04), vel));
  const ring = grp(g, 0, 0.05, 0.0);
  const tp = textTex(64, 16, (x, w, h) => { x.fillStyle = '#fbfbf6'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8d8d0'; for (let i = 0; i < w; i += 8) x.fillRect(i, 0, 1, h); x.fillStyle = '#ececec'; x.fillRect(0, 7, w, 1); });
  const band = new THREE.TorusGeometry(0.024, 0.009, 6, 16); band.rotateX(0.15);
  add(ring, M(band, mat(tp, { rough: 0.95, emissive: '#fffaf0', emissiveIntensity: 0.25 })), 0, 0.022, 0);
  const dia = add(ring, M(new THREE.OctahedronGeometry(0.014, 0).scale(1, 1.25, 1), mat('#e8f6ff', { rough: 0.02, metal: 0.2, emissive: '#a8d8ff', emissiveIntensity: 0.6 })), 0, 0.058, 0.003);
  g.userData = { lid, ring, diamond: dia, grip: { pos: [0, 0.0, 0], axis: [1, 0, 0], up: [0, 1, 0] } };
  return g;
}
function whiteChair(parent, x, z, ry = 0) {
  const g = grp(parent, x, 0, z, ry), w = mat('#fbfaf6', { rough: 0.4 });
  add(g, M(boxG(0.44, 0.05, 0.44), w), 0, 0.45, 0);
  for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19]) add(g, M(boxG(0.035, 0.45, 0.035), w), sx, 0, sz);
  for (const sx of [-0.19, 0.19]) add(g, M(boxG(0.035, 0.5, 0.035), w), sx, 0.5, -0.19);
  for (let i = 0; i < 3; i++) add(g, M(boxG(0.38, 0.035, 0.03), w), 0, 0.62 + i * 0.13, -0.19);
  const bow = add(g, M(new THREE.TorusGeometry(0.05, 0.015, 4, 8), mat('#f6b8c8')), 0, 0.85, -0.22); bow.scale.set(1.4, 0.8, 0.4);
  return g;
}
function hedge(parent, x, z, w, h = 0.9, d = 0.7) { return add(parent, M(boxG(w, h, d), soft('#5aa05a', 18)), x, 0, z); }
function lantern(parent, x, y, z, color = '#ffe8a8', s = 0.12) {
  add(parent, M(new THREE.SphereGeometry(s * 0.5, 8, 6), mat(color, { emissive: color, emissiveIntensity: 1.8 }), { cast: false }), x, y, z);
  glowSprite(parent, [x, y, z], s * 5, 'rgba(255,226,150,0.9)', 0.6);
}
export function stringLights(parent, a, b, n = 12, sag = 0.5) {
  const A = V(...a), B = V(...b), pts = [];
  for (let i = 0; i <= 24; i++) { const k = i / 24; const p = A.clone().lerp(B, k); p.y -= sag * 4 * k * (1 - k); pts.push(p); }
  const curve = new THREE.CatmullRomCurve3(pts);
  add(parent, M(new THREE.TubeGeometry(curve, 24, 0.008, 4), mat('#3a3a2a'), { cast: false }));
  for (let i = 1; i < n; i++) { const p = curve.getPoint(i / n); lantern(parent, p.x, p.y - 0.06, p.z, '#fff0b8', 0.09); }
}

// ------------------------------------------------------------------ 1. the night street: park (bench, lamp, toilet) + café
export function buildStreet(W) {
  const g = grp(W.scene, ST.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(60, 40).rotateX(-Math.PI / 2), soft('#4a7a4a', 10), { cast: false }), 0, 0, -6);            // grass
  add(g, M(new THREE.PlaneGeometry(60, 3).rotateX(-Math.PI / 2), soft('#9a96a0', 8), { cast: false }), 0, 0.01, 2.6);           // sidewalk
  add(g, M(new THREE.PlaneGeometry(60, 8).rotateX(-Math.PI / 2), soft('#3a3c48', 6), { cast: false }), 0, 0.005, 8);            // road
  for (let i = -6; i < 6; i++) add(g, M(new THREE.PlaneGeometry(1.4, 0.15).rotateX(-Math.PI / 2), mat('#e8e0b0'), { cast: false }), i * 4, 0.012, 8);
  // the park: bench under a lamp, path, trees, bushes
  add(g, M(new THREE.PlaneGeometry(2.4, 14).rotateX(-Math.PI / 2), soft('#c8b090', 8), { cast: false }), -2.5, 0.008, -4);
  const bn = bench(g, -1.0, -0.6, 0);
  streetLamp(g, -2.2, -0.4);
  [[-6, -6, 1.3, 2], [-4.5, -9, 1.6, 3], [3.5, -9, 1.4, 4], [-8, -2, 1.2, 5], [1.5, -12, 1.8, 6]].forEach(([x, z, s, sd]) => tree(g, x, z, s, sd));
  for (const [x, z] of [[0.6, -1.6], [-3.6, -1.4], [5.5, -3.5]]) add(g, M(new THREE.IcosahedronGeometry(0.5, 0).scale(1.2, 0.7, 1), soft('#3a8a4a', 14)), x, 0.3, z);
  // the park toilet: small brick building, green door with a red CLOSED sign + a chain
  const pt = grp(g, 4.2, 0, -3.2);
  add(pt, M(boxG(2.6, 2.5, 2.2), mat(brickTex('#c8805a'), {})));
  add(pt, M(boxG(2.9, 0.18, 2.5), mat('#5a6a7a')), 0, 2.5, 0);
  const door = add(pt, M(boxG(0.86, 1.95, 0.06), soft('#3a8a6a', 8)), 0, 0, 1.11);
  add(pt, M(new THREE.SphereGeometry(0.04, 8, 6), GOLD()), 0.32, 1.0, 1.16);
  const sign = planeAt(pt, 0.64, 0.24, mat(signTex('CLOSED', { w: 256, h: 96 }), { flat: false }), 0, 1.45, 1.15);
  const wc = planeAt(pt, 0.5, 0.3, mat(signTex('WC', { w: 128, h: 80, bg: '#2a6ad8', font: 'bold 52px sans-serif' }), { flat: false }), 0.9, 2.1, 1.111);
  for (let i = 0; i < 7; i++) { const l = add(pt, M(new THREE.TorusGeometry(0.035, 0.009, 4, 8), mat('#b8b8c0', { metal: 0.8, rough: 0.3 })), -0.25 + i * 0.08, 1.02 + Math.sin(i / 6 * Math.PI) * -0.06, 1.17); l.rotation.y = i & 1 ? Math.PI / 2 : 0; }
  add(pt, M(new THREE.BoxGeometry(0.1, 0.12, 0.05), mat('#8a8a90', { metal: 0.8, rough: 0.3 })), 0.05, 0.94, 1.18);
  streetLamp(g, 2.6, -1.0, { h: 3.0 });
  // the café: facade across the street corner (x 9..15): striped awning, warm window, CAFÉ sign, door
  const cf = grp(g, 12, 0, -2.0);
  add(cf, M(boxG(7, 4.2, 0.4), soft('#f2dcc0', 6)), 0, 0, -0.2);
  add(cf, M(boxG(7, 4.4, 6), soft('#e8cfb0', 6)), 0, 0, -3.4);
  const win = add(cf, M(new THREE.PlaneGeometry(3.2, 1.7), mat('#ffe0a0', { emissive: '#ffc870', emissiveIntensity: 0.9, flat: false }), { cast: false }), -1.3, 1.55, 0.02);
  add(cf, M(new THREE.BoxGeometry(3.4, 0.08, 0.12), mat('#5a3a2a')), -1.3, 0.66, 0.05);
  for (const tx of [-1.0, -0.4, 0.2]) for (const ty of [0, 1]) add(cf, M(new THREE.CylinderGeometry(0.12, 0.1, 0.05, 10), mat('#f8f4ec')), -2.2 + tx * 1.5, 0.9 + ty * 0.6, -0.4);
  const cdoor = add(cf, M(boxG(1.0, 2.2, 0.06), soft('#7a4a3a', 8)), 1.6, 0, 0.0);
  const glass = add(cf, M(new THREE.PlaneGeometry(0.6, 0.9), mat('#ffe0a0', { emissive: '#ffc870', emissiveIntensity: 0.8, flat: false }), { cast: false }), 1.6, 1.45, 0.035);
  const aw = add(cf, M(new THREE.BoxGeometry(6.6, 0.06, 1.2), mat(stripeTex('#f26a7a', '#fff6f0', 14), { flat: false })), 0, 2.95, 0.55); aw.rotation.x = 0.35;
  add(cf, M(new THREE.BoxGeometry(6.6, 0.25, 0.02), mat(stripeTex('#f26a7a', '#fff6f0', 14), { flat: false })), 0, 2.63, 1.12);
  planeAt(cf, 1.8, 0.55, mat(signTex('CAFÉ', { w: 256, h: 80, bg: '#2a5a4a', fg: '#ffe9b0', font: 'bold 56px serif', border: '#ffe9b0' }), { flat: false }), 0, 3.6, 0.02);
  planeAt(cf, 1.1, 0.42, mat(signTex('CUSTOMERS ONLY', { w: 256, h: 96, bg: '#ffffff', fg: '#d8202a', font: 'bold 30px sans-serif', border: '#d8202a' }), { flat: false }), -1.3, 1.95, 0.03);
  for (const tx of [-2.7, 0.0]) { add(cf, M(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), mat('#f8f6f0')), tx, 0.74, 1.2); add(cf, M(new THREE.CylinderGeometry(0.03, 0.05, 0.74, 6).translate(0, 0.37, 0), mat('#2a2e38')), tx, 0, 1.2); }
  const l = new THREE.PointLight(0xffc880, 5, 8, 1.6); l.position.set(-1, 2.0, 1.5); cf.add(l);
  streetLamp(g, 8.0, 1.6, { h: 3.4 });
  // city buildings behind (lit windows)
  const R = rng(5);
  for (let i = 0; i < 14; i++) {
    const w = 4 + R() * 4, h = 8 + R() * 16, x = -26 + i * 5 + R() * 2, z = -22 - R() * 6;
    const col = ['#3a4a6a', '#4a3a5a', '#2a3a4a', '#4a4a5a'][i % 4];
    const wt = textTex(32, 64, (c, ww, hh) => { c.fillStyle = col; c.fillRect(0, 0, ww, hh); for (let yy = 2; yy < hh - 4; yy += 6) for (let xx = 2; xx < ww - 2; xx += 6) { c.fillStyle = R() < 0.45 ? '#ffd890' : '#2a3040'; c.fillRect(xx, yy, 3, 4); } });
    const bm = mat(wt); bm.emissive = new THREE.Color('#ffffff'); bm.emissiveMap = wt; bm.emissiveIntensity = 0.55; add(g, M(boxG(w, h, 4), bm), x, 0, z);
  }
  return { g, bench: bn, door, sign, cafeDoor: cdoor, cafe: cf, toilet: pt, x0: ST.x0 };
}

// ------------------------------------------------------------------ 2. the mansion (outside): facade, huge door, fountain, golden gate
export function mansionFacade(parent, { night = true } = {}) {
  const g = grp(parent, 0, 0, 0);
  const wall = soft('#f8f2e6', 4), trim = WHITE(), roof = soft('#6a7a9a', 8);
  add(g, M(boxG(18, 9.2, 9), wall), 0, 0, -4.5);                                   // main block (front face z = 0)
  for (const sx of [-1, 1]) add(g, M(boxG(8, 7.2, 8), wall), sx * 12.5, 0, -5.2); // wings
  add(g, M(boxG(18.6, 0.5, 9.6), trim), 0, 9.2, -4.5);                             // cornice
  const rf = new THREE.CylinderGeometry(0.01, 9.0, 3.2, 4, 1); rf.rotateY(Math.PI / 4); rf.scale(1.45, 1, 0.75);
  add(g, M(rf.translate(0, 1.6, 0), roof), 0, 9.7, -4.5);
  for (const sx of [-1, 1]) add(g, M(boxG(8.4, 0.4, 8.4), trim), sx * 12.5, 7.2, -5.2);
  // windows: 3 floors, warm glow at night, pale blue by day
  const wm = night ? mat('#ffe2a0', { emissive: '#ffc870', emissiveIntensity: 1.0, flat: false }) : mat('#bcdcf0', { rough: 0.1, metal: 0.3 });
  const frameM = WHITE();
  const win = (x, y, z, w = 1.1, h = 1.7) => { add(g, M(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.1), frameM), x, y, z + 0.02); add(g, M(new THREE.PlaneGeometry(w, h), wm, { cast: false }), x, y, z + 0.08); add(g, M(new THREE.BoxGeometry(w + 0.4, 0.12, 0.24), frameM), x, y - h / 2 - 0.16, z + 0.08); };
  for (const y of [1.9, 4.6, 7.2]) for (const x of [-7.2, -5.0, -2.8, 2.8, 5.0, 7.2]) win(x, y, 0);
  for (const y of [4.6, 7.2]) win(0, y, 0);
  for (const sx of [-1, 1]) for (const y of [1.9, 4.6]) for (const x of [-2.2, 0, 2.2]) win(sx * 12.5 + x, y, -1.2);
  // portico: 4 columns, pediment, steps
  for (const x of [-3.0, -1.6, 1.6, 3.0]) { add(g, M(new THREE.CylinderGeometry(0.28, 0.32, 5.6, 12).translate(0, 2.8, 0), trim), x, 0.6, 1.9); add(g, M(boxG(0.8, 0.25, 0.8), trim), x, 6.2, 1.9); }
  add(g, M(boxG(7.4, 0.5, 2.6), trim), 0, 6.4, 1.1);
  const ped = new THREE.CylinderGeometry(0.01, 4.2, 1.6, 3, 1); ped.rotateY(Math.PI / 2); ped.rotateX(Math.PI / 2); ped.scale(1, 1, 1);
  const tri = new THREE.Shape(); tri.moveTo(-3.8, 0); tri.lineTo(3.8, 0); tri.lineTo(0, 1.5); tri.lineTo(-3.8, 0);
  add(g, M(new THREE.ExtrudeGeometry(tri, { depth: 2.6, bevelEnabled: false }), trim), 0, 6.9, -0.3);
  for (let i = 0; i < 4; i++) add(g, M(boxG(7.6 - i * 0.4, 0.15, 3.4 - i * 0.5), soft('#ece6da', 4)), 0, i * 0.15, 2.3 - i * 0.25);
  add(g, M(boxG(4.4, 0.6, 0.7), soft('#ece6da', 4)), 0, 0, 0.3);                     // the landing in front of the door
  // the HUGE front door: two leaves hinged at the sides (rotate leafL/leafR.rotation.y to open)
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.3, 4.3, 0.3), trim), sx * 1.35, 0.6 + 2.15, 0.05);   // door frame
  add(g, M(new THREE.BoxGeometry(3.0, 0.4, 0.3), trim), 0, 0.6 + 4.1, 0.05);
  const inner = add(g, M(new THREE.PlaneGeometry(2.4, 3.8), mat('#fff0c8', { emissive: '#ffd890', emissiveIntensity: 1.3, flat: false }), { cast: false }), 0, 0.6 + 1.9, 0.02);
  const wood = soft('#7a4428', 10), gold = GOLD();
  const leaf = (sx) => {
    const p = grp(g, sx * 1.2, 0.6, 0.12);
    const l = add(p, M(boxG(1.2, 3.8, 0.12), wood), -sx * 0.6, 0, 0);
    for (const yy of [0.5, 2.0]) add(p, M(boxG(0.9, 1.2, 0.03), soft('#8a5432', 8)), -sx * 0.6, yy, 0.07);
    add(p, M(new THREE.TorusGeometry(0.1, 0.022, 6, 14), gold), -sx * 1.05, 1.9, 0.12);
    add(p, M(new THREE.SphereGeometry(0.05, 8, 6), gold), -sx * 1.05, 2.02, 0.12);
    return p;
  };
  const leafL = leaf(-1), leafR = leaf(1);
  const glow = glowSprite(g, [0, 2.6, 0.2], 5.5, 'rgba(255,230,170,0.95)', 0.0);
  const doorLight = new THREE.PointLight(0xffe0a8, 0, 9, 1.4); doorLight.position.set(0, 2.6, 1.0); g.add(doorLight);
  // lanterns either side of the door
  for (const sx of [-1, 1]) lantern(g, sx * 1.9, 3.2, 0.35, '#ffe8a8', 0.2);
  return { g, leafL, leafR, glow, doorLight, inner };
}
export function fountain(parent, x, z) {
  const g = grp(parent, x, 0, z), stone = soft('#ece6da', 5), water = mat('#9ad8f0', { emissive: '#4aa8d8', emissiveIntensity: 0.35, rough: 0.05, metal: 0.2 });
  add(g, M(new THREE.CylinderGeometry(2.0, 2.1, 0.6, 24, 1, true).translate(0, 0.3, 0), stone));
  add(g, M(new THREE.TorusGeometry(2.05, 0.12, 5, 24).rotateX(Math.PI / 2), stone), 0, 0.6, 0);
  add(g, M(new THREE.CircleGeometry(2.0, 24).rotateX(-Math.PI / 2), water, { cast: false }), 0, 0.45, 0);
  add(g, M(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 10).translate(0, 0.8, 0), stone));
  add(g, M(new THREE.CylinderGeometry(0.9, 0.3, 0.3, 16).translate(0, 0.15, 0), stone), 0, 1.5, 0);
  add(g, M(new THREE.CylinderGeometry(0.4, 0.15, 0.22, 12).translate(0, 0.11, 0), stone), 0, 2.3, 0);
  add(g, M(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 8).translate(0, 0.4, 0), stone), 0, 1.75, 0);
  const jets = [];
  for (const [r, y0, n] of [[0.85, 1.75, 10], [0.36, 2.48, 6]]) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, j = add(g, M(new THREE.CylinderGeometry(0.015, 0.03, y0 - 0.45, 4).translate(0, -(y0 - 0.45) / 2, 0), mat('#c8f0ff', { emissive: '#8ad8ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.55 }), { cast: false }), Math.cos(a) * (r + 0.05), y0, Math.sin(a) * (r + 0.05));
    jets.push(j);
  }
  add(g, M(new THREE.SphereGeometry(0.12, 8, 6), GOLD()), 0, 2.62, 0);
  const l = new THREE.PointLight(0x9ad8ff, 2, 5, 2); l.position.set(0, 1.0, 0); g.add(l);
  return g;
}
export function goldenGate(parent, z, { open = 0 } = {}) {
  const g = grp(parent, 0, 0, z), gold = GOLD(), stone = soft('#ece6da', 5);
  for (const sx of [-1, 1]) {
    add(g, M(boxG(0.7, 2.8, 0.7), stone), sx * 2.6, 0, 0);
    add(g, M(new THREE.SphereGeometry(0.3, 10, 8), gold), sx * 2.6, 3.1, 0);
    // fence going out to the sides
    for (let i = 0; i < 14; i++) { const x = sx * (3.3 + i * 0.35); add(g, M(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 5).translate(0, 0.9, 0), gold), x, 0, 0); add(g, M(new THREE.ConeGeometry(0.05, 0.14, 5), gold), x, 1.86, 0); }
    add(g, M(new THREE.BoxGeometry(5, 0.05, 0.05), gold), sx * 5.6, 1.6, 0); add(g, M(new THREE.BoxGeometry(5, 0.05, 0.05), gold), sx * 5.6, 0.3, 0);
    const leaf = grp(g, sx * 2.25, 0, 0); leaf.rotation.y = sx * open * 1.3;
    for (let i = 0; i < 6; i++) { const x = -sx * (0.18 + i * 0.36), h = 2.2 + Math.sin((i + 0.5) / 6 * Math.PI / 2) * 0.5 * (sx > 0 ? 1 : 1); add(leaf, M(new THREE.CylinderGeometry(0.03, 0.03, h, 5).translate(0, h / 2, 0), gold), x, 0, 0); add(leaf, M(new THREE.ConeGeometry(0.06, 0.16, 5), gold), x, h + 0.06, 0); }
    for (const y of [0.35, 1.2, 1.95]) add(leaf, M(new THREE.BoxGeometry(2.2, 0.05, 0.05), gold), -sx * 1.1, y, 0);
    add(leaf, M(new THREE.TorusGeometry(0.28, 0.03, 5, 16), gold), -sx * 1.1, 1.55, 0);
  }
  return g;
}
export function buildMansionOut(W, { night = true, doorOpen = 0 } = {}) {
  const g = grp(W.scene, MO.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2), soft(night ? '#3a6a4a' : '#7ac078', 8), { cast: false }), 0, 0, 10);
  add(g, M(new THREE.PlaneGeometry(4.2, 18).rotateX(-Math.PI / 2), soft('#e8dcc4', 6), { cast: false }), 0, 0.01, 11);
  add(g, M(new THREE.CircleGeometry(4.4, 28).rotateX(-Math.PI / 2), soft('#e8dcc4', 6), { cast: false }), 0, 0.012, 8.5);
  const F = mansionFacade(g, { night });
  const ft = fountain(g, 0, 8.5);
  const gate = goldenGate(g, 15.5, { open: 0.9 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) hedge(g, sx * 3.4, 2.6 + i * 3.2, 0.9, 0.8, 2.4);
    for (let i = 0; i < 3; i++) { const p = grp(g, sx * 2.6, 0, 3.6 + i * 4.2); add(p, M(new THREE.ConeGeometry(0.45, 1.6, 7).translate(0, 1.0, 0), soft('#3a8a4a', 14))); add(p, M(new THREE.CylinderGeometry(0.3, 0.25, 0.4, 8).translate(0, 0.2, 0), soft('#ece6da', 5))); }
    streetLamp(g, sx * 2.6, 13.8, { h: 2.6, light: night });
    tree(g, sx * 10, 6, 1.9, 3 + sx); tree(g, sx * 15, 12, 2.2, 5 + sx);
    for (let i = 0; i < 5; i++) add(g, M(new THREE.IcosahedronGeometry(0.45, 0).scale(1.2, 0.7, 1), soft(['#f2a0c0', '#fff0f4', '#f8d070'][i % 3], 10)), sx * (5 + i * 1.6), 0.25, 1.4);
  }
  F.leafL.rotation.y = doorOpen * 1.35; F.leafR.rotation.y = -doorOpen * 1.35;        // the doors open inward
  return { g, ...F, fountain: ft, gate, x0: MO.x0 };
}
export const doorPos = () => [MO.x0, 0.6, 0.3];

// ------------------------------------------------------------------ 3. the marble hall: golden stairs, chandelier, the big couch + TV
export function buildHall(W, { night = false, candles = false, petals = false } = {}) {
  const g = grp(W.scene, HA.x0, 0, 0);
  const fl = add(g, M(new THREE.PlaneGeometry(22, 18).rotateX(-Math.PI / 2), mat(checkMarble(), { rough: 0.18, metal: 0.05, flat: false }), { cast: false }), 0, 0, 0);
  fl.material.map.repeat.set(5, 4);
  const wallM = mat(marbleTex('#fbf6ee', '#e4d8c8'), { rough: 0.5, flat: false });
  planeAt(g, 22, 9, wallM, 0, 4.5, -8);
  planeAt(g, 18, 9, wallM, -9, 4.5, 1, Math.PI / 2);
  planeAt(g, 18, 9, wallM, 9, 4.5, 1, -Math.PI / 2);
  planeAt(g, 22, 9, wallM, 0, 4.5, 7, Math.PI);
  add(g, M(new THREE.PlaneGeometry(22, 18).rotateX(Math.PI / 2), mat('#fbf8f2', { rough: 0.9 }), { cast: false }), 0, 9, 0);
  // pilasters + gold trim
  for (const x of [-7.5, -4.5, 4.5, 7.5]) { add(g, M(boxG(0.5, 9, 0.3), WHITE()), x, 0, -7.85); add(g, M(boxG(0.6, 0.25, 0.4), GOLD()), x, 8.6, -7.8); }
  add(g, M(new THREE.BoxGeometry(22, 0.18, 0.12), GOLD()), 0, 8.7, -7.92);
  // the golden stairs: wide steps from z = -1.0 up to a landing at y = 3.0 (z -5 .. -8), gold railings, red carpet
  const st = grp(g, HA.stairs[0], 0, HA.stairs[1]);
  const N = 12, rise = HA.top / N, run = 0.34, Wd = 3.2;
  const stepM = mat(marbleTex('#fbf8f0', '#e0d4c0', 64, 7), { rough: 0.25, flat: false }), carpet = soft('#c8304a', 8);
  for (let i = 0; i < N; i++) {
    add(st, M(boxG(Wd, rise * (i + 1), run), stepM), 0, 0, 1.0 - i * run);
    add(st, M(boxG(1.6, 0.012, run), carpet), 0, rise * (i + 1), 1.0 - i * run);
    add(st, M(new THREE.BoxGeometry(Wd + 0.02, 0.03, 0.03), GOLD()), 0, rise * (i + 1), 1.0 - i * run + run / 2);
  }
  add(st, M(boxG(Wd + 3, HA.top, 3.2), stepM), 0, 0, 1.0 - N * run - 1.4);     // landing
  add(st, M(boxG(1.6, 0.012, 3.2), carpet), 0, HA.top, 1.0 - N * run - 1.4);
  const gold = GOLD();
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= N; i += 2) { const y = rise * i, z = 1.0 - i * run + run / 2; add(st, M(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6).translate(0, 0.47, 0), gold), sx * (Wd / 2 - 0.08), y, z); }
    const a = V(sx * (Wd / 2 - 0.08), 0.95, 1.0 + run / 2), b = V(sx * (Wd / 2 - 0.08), HA.top + 0.95, 1.0 - N * run + run / 2);
    const rail = new THREE.CylinderGeometry(0.045, 0.045, a.distanceTo(b), 8); const rm = add(st, M(rail, gold), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); rm.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    add(st, M(new THREE.SphereGeometry(0.1, 10, 8), gold), sx * (Wd / 2 - 0.08), 1.0, 1.0 + run / 2);
  }
  // the bathroom door upstairs (on the landing, back wall)
  const bdoor = add(g, M(boxG(1.1, 2.3, 0.08), soft('#f2ece0', 4)), 0, HA.top, -7.92);
  add(g, M(new THREE.BoxGeometry(1.4, 2.55, 0.06), GOLD()), 0, HA.top + 1.2, -7.97);
  add(g, M(new THREE.SphereGeometry(0.05, 8, 6), GOLD()), 0.4, HA.top + 1.05, -7.82);
  planeAt(g, 0.42, 0.42, mat(textTex(64, 64, (x, w, h) => { x.fillStyle = '#f0c040'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill(); x.fillStyle = '#ffffff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WC', 32, 34); }), { flat: false }), 0, HA.top + 1.85, -7.86);
  // the chandelier
  const ch = chandelier(g, HA.chand[0], 9, HA.chand[2], 1.25);
  // the cosy corner: big couch, rug, coffee table, TV on the left wall
  const couch = bigCouch(g, HA.couch[0], HA.couch[1], -Math.PI / 2, '#9ad0c8');          // faces -x (the TV on the left wall)
  const rug = add(g, M(new THREE.CylinderGeometry(2.0, 2.0, 0.02, 24), soft('#f4d8e0', 6)), HA.couch[0] - 2.0, 0.01, HA.couch[1]); rug.scale.set(1, 1, 1.3);
  add(g, M(boxG(0.8, 0.36, 1.4), soft('#f8f2e8', 4)), HA.couch[0] - 1.9, 0, HA.couch[1]);
  const tv = tvSet(g, -8.85, 1.75, HA.couch[1], Math.PI / 2);
  add(g, M(boxG(0.5, 0.8, 2.4), soft('#f8f2e8', 4)), -8.7, 0, HA.couch[1]);
  // plants, paintings, front door
  for (const [x, z] of [[-2.2, -5.5], [2.2, -5.5], [-8.2, -7.2], [8.2, -7.2], [6.5, 5.8]]) { const p = flowerPot(g, x, z, 3); p.scale.setScalar(1.6); }
  const art = (c1, c2) => textTex(48, 36, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(34, 12, 5, 0, 7); x.fill(); x.fillStyle = 'rgba(80,140,90,0.8)'; x.beginPath(); x.moveTo(0, h); x.lineTo(16, 18); x.lineTo(30, h); x.fill(); });
  frame(g, art('#a8d4f4', '#f8e0c8'), -6, 4.0, -7.95, 2.2, 1.6, { color: '#e0b040' });
  frame(g, art('#f8c8d8', '#fff0c0'), 6, 4.0, -7.95, 2.2, 1.6, { color: '#e0b040' });
  frame(g, art('#c8e8d0', '#f8f0d0'), 8.95, 4.2, 1.6, 2.0, 1.4, { ry: -Math.PI / 2, color: '#e0b040' });
  const fd = grp(g, 0, 0, 6.95);
  add(fd, M(new THREE.BoxGeometry(3.0, 4.4, 0.1), WHITE()), 0, 2.2, 0);
  const dl = add(fd, M(boxG(1.2, 3.8, 0.12), soft('#7a4428', 10)), -0.6, 0, -0.08), dr = add(fd, M(boxG(1.2, 3.8, 0.12), soft('#7a4428', 10)), 0.6, 0, -0.08);
  for (const sx of [-1, 1]) add(fd, M(new THREE.TorusGeometry(0.1, 0.022, 6, 14), GOLD()), sx * 0.15, 1.9, -0.16);
  // lights
  const l1 = new THREE.PointLight(0xfff0dc, 5, 16, 1.4); l1.position.set(0, 6.5, 2); g.add(l1);
  if (candles || petals) {
    const R = rng(12);
    if (candles) for (let i = 0; i < 18; i++) { const a = R() * Math.PI * 2, r = 1.6 + R() * 2.2; candle(g, Math.cos(a) * r, 0, 2.2 + Math.sin(a) * r * 0.7, 0.12 + R() * 0.2); }
    if (petals) for (let i = 0; i < 120; i++) { const p = add(g, M(new THREE.CircleGeometry(0.035, 5).rotateX(-Math.PI / 2), mat(R() < 0.7 ? '#e8203a' : '#f6a0b0', { side: THREE.DoubleSide }), { cast: false }), (R() - 0.5) * 6, 0.006 + R() * 0.002, 2.2 + (R() - 0.5) * 5); p.rotation.y = R() * 6; }
  }
  return { g, stairs: st, chand: ch, couch, tv, bdoor, frontL: dl, frontR: dr, x0: HA.x0 };
}
export const stairPoint = (k) => { const N = 12, run = 0.34; const i = clamp(k) * N; return [HA.x0 + HA.stairs[0], HA.top * clamp(k), HA.stairs[1] + 1.0 - i * run]; };

// ------------------------------------------------------------------ 4. the candle-light dinner
export function buildDining(W) {
  const g = grp(W.scene, DI.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(14, 12).rotateX(-Math.PI / 2), mat(checkMarble('#f2e8dc', '#c8b49a', 6), { rough: 0.25, flat: false }), { cast: false }), 0, 0, 0);
  const wall = mat(marbleTex('#f4e6d8', '#dcc4ac', 128, 9), { rough: 0.6, flat: false });
  planeAt(g, 14, 6, wall, 0, 3, -4); planeAt(g, 12, 6, wall, -6, 3, 0, Math.PI / 2); planeAt(g, 12, 6, wall, 6, 3, 0, -Math.PI / 2);
  // a tall window with the night sky + moon
  const nw = textTex(32, 64, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2a5a'); gr.addColorStop(1, '#4a5a8a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#fff4d0'; x.beginPath(); x.arc(22, 14, 5, 0, 7); x.fill(); x.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) x.fillRect((i * 13) % w, (i * 29) % (h - 20), 1, 1); });
  planeAt(g, 1.6, 3.0, mat(nw, { emissive: '#ffffff', emissiveIntensity: 0.6, flat: false }), 0, 2.4, -3.98);
  add(g, M(new THREE.BoxGeometry(1.8, 3.2, 0.06), GOLD()), 0, 2.4, -4.02);
  for (const sx of [-1, 1]) add(g, M(boxG(0.7, 3.6, 0.12), soft('#c8304a', 8)), sx * 1.2, 0.5, -3.9);
  // the long table, white cloth, candelabra, plates, glasses, two high-back chairs
  const T = grp(g, 0, 0, 0);
  add(T, M(boxG(2.6, 0.76, 1.1), soft('#7a4a2a', 8)));
  add(T, M(boxG(2.7, 0.03, 1.2), mat('#fbfaf6', { rough: 0.9 })), 0, 0.76, 0);
  add(T, M(boxG(0.4, 0.004, 1.24), soft('#c8304a', 6)), 0, 0.79, 0);
  const cand = candelabra(T, 0, 0.79, 0);
  for (const sx of [-1, 1]) {
    const pl = grp(T, sx * 0.85, 0.79, 0); add(pl, M(new THREE.CylinderGeometry(0.16, 0.12, 0.02, 18).translate(0, 0.01, 0), mat('#fbfaf6', { rough: 0.3 })));
    add(pl, M(new THREE.SphereGeometry(0.08, 8, 5).scale(1, 0.4, 1), soft('#e8a050', 10)), 0, 0.03, 0);
    add(pl, M(new THREE.SphereGeometry(0.04, 6, 4), soft('#5a8a3a', 10)), 0.06, 0.04, 0.03);
    const wg = grp(T, sx * 0.62, 0.79, -0.3);
    add(wg, M(new THREE.CylinderGeometry(0.035, 0.02, 0.1, 10, 1, true).translate(0, 0.2, 0), mat('#e8f4ff', { transparent: true, opacity: 0.45, rough: 0.05 })));
    add(wg, M(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 10).translate(0, 0.17, 0), mat('#a8102a', { rough: 0.2 })));
    add(wg, M(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 5).translate(0, 0.075, 0), mat('#e8f4ff', { transparent: true, opacity: 0.6 })));
    add(wg, M(new THREE.CylinderGeometry(0.04, 0.04, 0.006, 10), mat('#e8f4ff', { transparent: true, opacity: 0.6 })));
  }
  const chairs = [-1, 1].map((sx) => { const c = grp(g, sx * 1.75, 0, 0, -sx * Math.PI / 2); const cm = soft('#c8304a', 8), wd = soft('#7a4a2a', 8); add(c, M(boxG(0.5, 0.08, 0.5), cm), 0, 0.44, 0); add(c, M(boxG(0.5, 0.9, 0.08), cm), 0, 0.5, -0.24); for (const a of [-0.2, 0.2]) for (const b of [-0.2, 0.2]) add(c, M(boxG(0.05, 0.44, 0.05), wd), a, 0, b); add(c, M(new THREE.SphereGeometry(0.06, 8, 6), GOLD()), 0, 1.45, -0.24); return c; });
  const ch = chandelier(g, 0, 6, 0, 0.7);
  return { g, table: T, cand, chairs, x0: DI.x0 };
}

// ------------------------------------------------------------------ 5. the golden bathroom
export function buildBath(W) {
  const g = grp(W.scene, BA.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), mat(checkMarble('#fbfaf6', '#2a2a30', 8), { rough: 0.15, flat: false }), { cast: false }), 0, 0, 0);
  const wall = mat(marbleTex('#fbf8f4', '#d8ccc0', 128, 11), { rough: 0.35, flat: false });
  planeAt(g, 10, 5, wall, 0, 2.5, -2.5); planeAt(g, 10, 5, wall, -2.6, 2.5, 0, Math.PI / 2); planeAt(g, 10, 5, wall, 2.6, 2.5, 0, -Math.PI / 2);
  add(g, M(new THREE.PlaneGeometry(10, 10).rotateX(Math.PI / 2), mat('#fbf8f2'), { cast: false }), 0, 4.2, 0);
  add(g, M(new THREE.BoxGeometry(5.2, 0.12, 0.06), GOLD()), 0, 1.0, -2.47);
  add(g, M(new THREE.BoxGeometry(5.2, 0.12, 0.06), GOLD()), 0, 3.9, -2.47);
  const toilet = goldToilet(g, 0, -1.95, 0, 1.15);
  // gold-framed mirror, marble sink with a golden tap, plants, towel rail, little window with curtains
  add(g, M(new THREE.BoxGeometry(1.0, 1.3, 0.06), GOLD()), 1.6, 2.1, -2.45);
  add(g, M(new THREE.PlaneGeometry(0.85, 1.15), mat('#d8eef8', { rough: 0.02, metal: 0.9 }), { cast: false }), 1.6, 2.1, -2.41);
  add(g, M(boxG(0.9, 0.85, 0.5), mat(marbleTex('#ffffff', '#d0c8c0', 64, 3), { rough: 0.2, flat: false })), 1.6, 0, -2.2);
  add(g, M(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8).translate(0, 0.11, 0), GOLD()), 1.6, 0.85, -2.38);
  for (const x of [-2.1, 2.2]) { const p = flowerPot(g, x, -2.0, 7); p.scale.setScalar(1.4); }
  const tw = add(g, M(new THREE.BoxGeometry(0.06, 0.06, 0.8), GOLD()), -2.5, 1.4, -0.8);
  add(g, M(boxG(0.04, 0.6, 0.6), soft('#f6c0d0', 8)), -2.46, 0.82, -0.8);
  const ch = chandelier(g, 0, 4.2, -0.6, 0.65);
  add(g, M(new THREE.CylinderGeometry(1.0, 1.0, 0.015, 24), soft('#f8e0e8', 6)), 0, 0.008, -0.6);
  const l = new THREE.PointLight(0xfff0dc, 3, 8, 1.6); l.position.set(0, 3.4, 0.8); g.add(l);
  return { g, toilet, chand: ch, x0: BA.x0 };
}
export const bathToilet = () => [BA.x0, 0.55, -1.95];

// ------------------------------------------------------------------ 6. Paris at sunset: the Eiffel Tower
export function eiffel(parent, x, z, s = 1) {
  const g = grp(parent, x, 0, z); g.scale.setScalar(s);
  const m = soft('#8a5a4a', 10);
  const leg = (sx, sz) => {
    const a = V(sx * 6, 0, sz * 6), b = V(sx * 2.2, 9, sz * 2.2), l = a.distanceTo(b);
    const geo = new THREE.BoxGeometry(1.4, l, 1.4); geo.translate(0, l / 2, 0);
    const me = add(g, M(geo, m), a.x, a.y, a.z); me.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(sx, sz);
  // arches between the legs
  for (let k = 0; k < 4; k++) { const arc = new THREE.TorusGeometry(3.9, 0.35, 5, 16, Math.PI); const me = add(g, M(arc, m), 0, 1.0, 0); me.rotation.y = k * Math.PI / 2; me.position.set(Math.sin(k * Math.PI / 2) * 4.7, 0.6, Math.cos(k * Math.PI / 2) * 4.7); }
  add(g, M(boxG(7.2, 0.8, 7.2), m), 0, 8.8, 0);
  const upper = new THREE.CylinderGeometry(0.4, 3.0, 22, 4, 6); upper.rotateY(Math.PI / 4); add(g, M(upper.translate(0, 11, 0), m), 0, 9.5, 0);
  add(g, M(boxG(3.4, 0.6, 3.4), m), 0, 17.0, 0);
  add(g, M(boxG(1.2, 1.2, 1.2), m), 0, 31.2, 0);
  add(g, M(new THREE.CylinderGeometry(0.08, 0.2, 3.4, 5).translate(0, 1.7, 0), m), 0, 32.4, 0);
  // lattice look: little crossing beams on the upper part
  for (let i = 0; i < 9; i++) { const y = 11 + i * 2.2, w = lerp(4.6, 1.3, i / 9); for (let k = 0; k < 4; k++) { const b = add(g, M(new THREE.BoxGeometry(w, 0.12, 0.12), mat('#6a3a2a')), 0, y, 0); b.rotation.y = k * Math.PI / 2; b.position.set(Math.sin(k * Math.PI / 2) * w * 0.36, y, Math.cos(k * Math.PI / 2) * w * 0.36); } }
  for (let i = 0; i < 24; i++) lantern(g, Math.cos(i) * 2.0, 9.4 + (i % 6) * 3.6, Math.sin(i) * 2.0, '#ffe8a8', 0.6);
  return g;
}
export function buildParis(W) {
  const g = grp(W.scene, PA.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), soft('#e8d8c0', 6), { cast: false }), 0, 0, -30);
  for (const sx of [-1, 1]) add(g, M(new THREE.PlaneGeometry(10, 60).rotateX(-Math.PI / 2), soft('#8ac078', 8), { cast: false }), sx * 9, 0.01, -30);
  const tw = eiffel(g, 0, -42, 1.2);
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) { tree(g, sx * (6 + (i % 2)), -6 - i * 5, 1.4, i + 10); }
  const R = rng(14);
  for (let i = 0; i < 18; i++) { const sx = i & 1 ? 1 : -1, x = sx * (18 + R() * 20), z = -20 - R() * 50; const h = 6 + R() * 6; add(g, M(boxG(6, h, 6), soft('#f4e6cc', 5)), x, 0, z); add(g, M(new THREE.CylinderGeometry(2.6, 4.2, 2.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0), soft('#7a8aa8', 6)), x, h, z); }
  for (const sx of [-2.6, 2.6]) streetLamp(g, sx, -1.5, { h: 3.0, light: false });
  bench(g, 3.6, -1.4, -0.2);
  return { g, tower: tw, x0: PA.x0 };
}

// ------------------------------------------------------------------ 7. the garden wedding: flower arch, white chairs, string lights
export function buildGarden(W) {
  const g = grp(W.scene, GA.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), soft('#8ac878', 10), { cast: false }), 0, 0, -10);
  add(g, M(new THREE.PlaneGeometry(1.4, 12).rotateX(-Math.PI / 2), mat('#fbfaf6', { rough: 0.9 }), { cast: false }), 0, 0.01, 4);
  // the flower arch
  const ar = grp(g, 0, 0, -1.2);
  const arc = new THREE.TorusGeometry(1.6, 0.07, 6, 24, Math.PI); add(ar, M(arc, WHITE()), 0, 1.6, 0);
  for (const sx of [-1, 1]) add(ar, M(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8).translate(0, 0.8, 0), WHITE()), sx * 1.6, 0, 0);
  const R = rng(21), cols = ['#f6a0b8', '#ffffff', '#f8d0a0', '#f27a9a', '#fde6ee'];
  for (let i = 0; i < 70; i++) {
    const k = R(); let x, y;
    if (k < 0.7) { const a = R() * Math.PI; x = Math.cos(a) * 1.6; y = 1.6 + Math.sin(a) * 1.6; } else { const sx = R() < 0.5 ? -1 : 1; x = sx * 1.6; y = R() * 1.6; }
    add(ar, M(new THREE.IcosahedronGeometry(0.11 + R() * 0.07, 0), mat(cols[i % 5], { rough: 0.8 })), x + (R() - 0.5) * 0.15, y + (R() - 0.5) * 0.15, (R() - 0.5) * 0.2);
    if (i % 3 === 0) add(ar, M(new THREE.IcosahedronGeometry(0.09, 0).scale(1.4, 0.5, 1), mat('#5aa05a')), x + (R() - 0.5) * 0.25, y + (R() - 0.5) * 0.2, (R() - 0.5) * 0.2);
  }
  // white chairs: 5 rows each side of the aisle, facing the arch (-z)
  const chairs = [];
  for (let r = 0; r < 5; r++) for (const sx of [-1, 1]) for (let c = 0; c < 3; c++) chairs.push(whiteChair(g, sx * (1.1 + c * 0.6), 1.6 + r * 1.0, Math.PI));
  // string lights over the aisle, hedges, trees, the mansion behind
  for (let i = 0; i < 4; i++) stringLights(g, [-4.5, 3.6, 0.5 + i * 2.2], [4.5, 3.6, 0.5 + i * 2.2], 14, 0.6);
  for (const sx of [-1, 1]) { add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6).translate(0, 1.8, 0), mat('#7a5a3a')), sx * 4.5, 0, 0.5); add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6).translate(0, 1.8, 0), mat('#7a5a3a')), sx * 4.5, 0, 7.1); }
  for (const sx of [-1, 1]) { hedge(g, sx * 6, -4, 6, 1.2, 1); tree(g, sx * 8.5, -2, 2.0, 30 + sx); tree(g, sx * 9, 5, 1.8, 33 + sx); }
  const mf = grp(g, 0, 0, -26); mansionFacade(mf, { night: false });
  for (let i = 0; i < 14; i++) add(g, M(new THREE.IcosahedronGeometry(0.3, 0).scale(1.2, 0.6, 1), mat(cols[i % 5])), (i < 7 ? -1 : 1) * (2.4 + (i % 7) * 0.9), 0.15, -1.9);
  return { g, arch: ar, chairs, x0: GA.x0 };
}
