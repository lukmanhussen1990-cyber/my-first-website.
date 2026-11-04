// Flash POV reel: rainy-night sets + props (low-poly, flat colours). Places far apart (x0):
//   his living room (0), the wet city street (100), the bridge (200), her house (300), the building wall (400)
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp } from './lib.js';
import { textTex, glowSprite, sofa, tree } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const soft = (hex, amount = 5, o = {}) => mat(tex(paint(32, 32, (() => { const b = hexToRgb(hex), R = rng(o.seed ?? 3); return () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }; })())), o);
const glowMat = (hex, k = 2) => mat(hex, { emissive: hex, emissiveIntensity: k, rough: 0.4 });
export const WET = () => mat('#1c1f28', { rough: 0.16, metal: 0.35, flat: false });

export const LIV = { x0: 0 }, ST = { x0: 100 }, BR = { x0: 200 }, HO = { x0: 300 }, WA = { x0: 400 };

// ------------------------------------------------------------------ the stormy night sky + lightning
function skyCanvas() {
  const c = canvas(16, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  [[0, '#05070e'], [0.3, '#0c1222'], [0.48, '#1c2438'], [0.52, '#121622'], [1, '#07080c']].forEach(([k, col]) => g.addColorStop(k, col));
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; return t;
}
export function stormSky(W, at) {
  const s = M(new THREE.SphereGeometry(95, 24, 16), new THREE.MeshBasicMaterial({ map: skyCanvas(), side: THREE.BackSide, fog: false, depthWrite: false }), { cast: false, receive: false });
  s.position.set(...at); W.scene.add(s);
  // heavy clouds (dark, lit from inside by the lightning: W.flashClouds)
  const cm = new THREE.MeshBasicMaterial({ color: '#1a2030', transparent: true, opacity: 0.9, fog: false, depthWrite: false });
  const R = rng(4);
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = 55 + R() * 25; const c = M(new THREE.IcosahedronGeometry(9 + R() * 8, 0).scale(1.8, 0.45, 1.2), cm, { cast: false, receive: false }); c.position.set(at[0] + Math.cos(a) * r, at[1] + 28 + R() * 10, at[2] + Math.sin(a) * r); W.scene.add(c); }
  W.cloudMat = cm;
  W.scene.fog = new THREE.Fog('#0a0e18', 18, 85);
  return s;
}
// a jagged lightning bolt from a to b (+ a couple of branches): bright core + glow; visible only while flashing
export function bolt(parent, a, b, { seed = 1, color = '#ffffff', glow = '#9ab8ff', r = 0.06, branches = 2 } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const R = rng(seed), A = V(...a), Bv = V(...b);
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) { const k = i / n, p = A.clone().lerp(Bv, k); if (i > 0 && i < n) { p.x += (R() - 0.5) * A.distanceTo(Bv) * 0.09; p.z += (R() - 0.5) * A.distanceTo(Bv) * 0.09; } pts.push(p); }
  const core = glowMat(color, 4); core.fog = false;
  const make = (ps, rr) => { const c = new THREE.CatmullRomCurve3(ps, false, 'catmullrom', 0.0); add(g, M(new THREE.TubeGeometry(c, ps.length * 3, rr, 5), core, { cast: false, receive: false })); };
  make(pts, r);
  for (let k = 0; k < branches; k++) {
    const i0 = 3 + Math.floor(R() * (n - 6)), p0 = pts[i0], dir = Bv.clone().sub(A).normalize();
    const bp = [p0.clone()]; let p = p0.clone();
    for (let j = 0; j < 5; j++) { p = p.clone().add(dir.clone().multiplyScalar(A.distanceTo(Bv) * 0.05)).add(V((R() - 0.5) * 1.2, 0, (R() - 0.5) * 1.2).multiplyScalar(A.distanceTo(Bv) * 0.04)); bp.push(p); }
    make(bp, r * 0.5);
  }
  for (let i = 0; i <= n; i += 3) glowSprite(g, [pts[i].x, pts[i].y, pts[i].z], A.distanceTo(Bv) * 0.18 + 0.5, glow, 0.6);
  g.userData.pts = pts;
  return g;
}

// ------------------------------------------------------------------ props
export function streetLamp(parent, x, z, { h = 3.6, light = true, wet = true } = {}) {
  const g = grp(parent, x, 0, z), dark = mat('#2a2e38', { rough: 0.4, metal: 0.5 });
  add(g, M(new THREE.CylinderGeometry(0.05, 0.08, h, 8).translate(0, h / 2, 0), dark));
  add(g, M(new THREE.BoxGeometry(0.7, 0.06, 0.06), dark), 0.3, h, 0);
  add(g, M(new THREE.BoxGeometry(0.32, 0.1, 0.22), glowMat('#ffd890', 2.2)), 0.6, h - 0.06, 0);
  glowSprite(g, [0.6, h - 0.15, 0], 2.0, 'rgba(255,220,150,0.9)', 0.7);
  if (wet) { const r = glowSprite(g, [0.6, 0.02, 0.6], 1.6, 'rgba(255,210,140,0.9)', 0.35); r.scale.set(0.7, 2.6, 1); }   // its reflection on the wet ground
  if (light) { const l = new THREE.PointLight(0xffd8a0, 7, 10, 1.6); l.position.set(0.6, h - 0.3, 0); g.add(l); }
  return g;
}
export function car(parent, x, z, ry = 0, color = '#c83a3a', { lights = true } = {}) {
  const g = grp(parent, x, 0, z, ry), body = mat(color, { rough: 0.25, metal: 0.4 }), glass = mat('#20283a', { rough: 0.1, metal: 0.5 }), tyre = mat('#141416', { rough: 0.8 });
  add(g, M(boxG(1.8, 0.55, 4.0), body), 0, 0.3, 0);
  add(g, M(boxG(1.6, 0.5, 2.0), glass), 0, 0.85, -0.2);
  add(g, M(boxG(1.62, 0.06, 2.02), body), 0, 1.35, -0.2);
  for (const sx of [-0.9, 0.9]) for (const sz of [-1.3, 1.3]) add(g, M(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2), tyre), sx, 0.34, sz);
  if (lights) {
    for (const sx of [-0.6, 0.6]) { add(g, M(new THREE.BoxGeometry(0.34, 0.14, 0.05), glowMat('#fff4d8', 3)), sx, 0.62, 2.0); add(g, M(new THREE.BoxGeometry(0.34, 0.12, 0.05), glowMat('#ff2a2a', 2.5)), sx, 0.64, -2.0); glowSprite(g, [sx, 0.62, 2.1], 1.2, 'rgba(255,245,220,0.9)', 0.6); glowSprite(g, [sx, 0.64, -2.1], 0.8, 'rgba(255,40,40,0.9)', 0.6); }
    const hl = new THREE.SpotLight(0xfff4e0, 12, 14, 0.5, 0.6, 1.4); hl.position.set(0, 0.7, 2.1); hl.target.position.set(0, 0, 8); g.add(hl); g.add(hl.target);
    const rf = glowSprite(g, [0, 0.02, 3.4], 2.2, 'rgba(255,240,210,0.8)', 0.3); rf.scale.set(1.4, 3.0, 1);
  }
  return g;
}
export function building(parent, x, z, w, h, d, { color = '#3a4458', seed = 1, lit = 0.4, ry = 0 } = {}) {
  const R = rng(seed);
  const wt = textTex(32, 64, (c, ww, hh) => { c.fillStyle = color; c.fillRect(0, 0, ww, hh); for (let y = 3; y < hh - 3; y += 5) for (let xx = 2; xx < ww - 2; xx += 5) { c.fillStyle = R() < lit ? (R() < 0.7 ? '#ffd890' : '#9ad0ff') : '#161a24'; c.fillRect(xx, y, 3, 3); } });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 8)));
  const m = mat(wt); m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = wt; m.emissiveIntensity = 0.75;
  const b = add(parent, M(boxG(w, h, d), m), x, 0, z); b.rotation.y = ry;
  add(parent, M(boxG(w + 0.3, 0.3, d + 0.3), mat('#20242e')), x, h, z).rotation.y = ry;
  return b;
}
export function phone(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.075, 0.15, 0.009), mat('#18181c', { rough: 0.3, metal: 0.3 })));
  const S = canvas(180, 360), x = S.getContext('2d'); const t = new THREE.CanvasTexture(S); t.colorSpace = THREE.SRGBColorSpace;
  const scr = add(g, M(new THREE.PlaneGeometry(0.068, 0.138), new THREE.MeshBasicMaterial({ map: t })), 0, 0, 0.0047);
  // draw(mode, k): 'feed' = a social feed (scrolling), 'msg' = the message from Babe (k = 0..1 pop-in)
  const heart = (cx, cy, s, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.45, cy - s, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s, cx + s, cy - s * 0.4, cx, cy + s * 0.35); x.fill(); };
  const smiley = (cx, cy, r) => { x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.fillStyle = '#3a2a10'; x.beginPath(); x.arc(cx - r * 0.35, cy - r * 0.2, r * 0.12, 0, 7); x.arc(cx + r * 0.35, cy - r * 0.2, r * 0.12, 0, 7); x.fill(); x.strokeStyle = '#3a2a10'; x.lineWidth = r * 0.14; x.beginPath(); x.arc(cx, cy + r * 0.05, r * 0.5, 0.25, Math.PI - 0.25); x.stroke(); };
  g.userData.draw = (mode, k = 1, scroll = 0) => {
    x.fillStyle = '#0e1016'; x.fillRect(0, 0, 180, 360);
    if (mode === 'feed') {
      for (let i = -1; i < 5; i++) { const y = 20 + i * 90 - (scroll % 90); x.fillStyle = '#20242e'; x.fillRect(10, y, 160, 80); x.fillStyle = ['#e86a5a', '#5ab0e8', '#e8c85a', '#8ae86a'][(i + 8 + Math.floor(scroll / 90)) % 4]; x.fillRect(18, y + 8, 40, 40); x.fillStyle = '#5a6070'; x.fillRect(66, y + 12, 90, 8); x.fillRect(66, y + 28, 70, 8); }
    } else {
      x.fillStyle = '#1a1e2a'; x.fillRect(0, 0, 180, 52); x.fillStyle = '#ffffff'; x.font = 'bold 22px sans-serif'; x.fillText('Babe', 54, 34); heart(122, 26, 13, '#ff3a5a');
      x.fillStyle = '#e86aa0'; x.beginPath(); x.arc(28, 26, 16, 0, 7); x.fill();
      if (k > 0) {
        const s = Math.min(1, k * 1.3); x.save(); x.translate(14, 100); x.scale(s, s);
        x.fillStyle = '#2a2f3c'; x.beginPath(); x.roundRect(0, 0, 152, 70, 18); x.fill();
        x.fillStyle = '#ffffff'; x.font = 'bold 20px sans-serif'; x.fillText("I'm home", 14, 30); x.fillText('alone', 14, 56); smiley(98, 50, 13);
        x.restore();
      }
    }
    t.needsUpdate = true;
  };
  g.userData.draw('feed');
  g.userData.grip = { pos: [0, -0.04, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  g.userData.screen = scr;
  return g;
}
function snacks(parent, x, y, z) {
  const g = grp(parent, x, y, z);
  const bag = add(g, M(new THREE.IcosahedronGeometry(0.12, 1).scale(1, 1.3, 0.45), mat('#f2c230', { rough: 0.4, metal: 0.2 })), -0.18, 0.15, 0); bag.rotation.z = 0.3;
  add(g, M(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12).translate(0, 0.06, 0), mat('#e8202a', { rough: 0.3, metal: 0.5 })), 0.12, 0, 0.05);
  add(g, M(new THREE.CylinderGeometry(0.14, 0.09, 0.08, 14).translate(0, 0.04, 0), mat('#3a8ad8')), 0.0, 0, -0.12);
  const R = rng(3); for (let i = 0; i < 14; i++) add(g, M(new THREE.IcosahedronGeometry(0.025, 0), mat('#fff6dc')), (R() - 0.5) * 0.18, 0.08 + R() * 0.04, -0.12 + (R() - 0.5) * 0.14);
  return g;
}
export function hoodieProp(parent, color = '#6a7a8a') {
  const geo = new THREE.IcosahedronGeometry(0.3, 1); geo.scale(1.4, 0.35, 0.9);
  const p = geo.attributes.position, R = rng(7); for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (R() - 0.5) * 0.05);
  geo.computeVertexNormals();
  const m = add(parent, M(geo, soft(color, 10)));
  return m;
}
export function smokePuffs(parent, n = 8) {
  const g = new THREE.Group(); parent.add(g);
  const m = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 1, transparent: true, opacity: 0.7, flatShading: true, depthWrite: false });
  for (let i = 0; i < n; i++) add(g, M(new THREE.IcosahedronGeometry(0.3, 1), m, { cast: false }));
  g.userData.mat = m;
  return g;
}

// ------------------------------------------------------------------ 1. his living room at night
export function buildLiving(W) {
  const g = grp(W.scene, LIV.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), soft('#5a4232', 8), { cast: false }), 0, 0, 0);
  const wall = soft('#2a3a48', 5);
  for (const [w, x, z, ry] of [[10, 0, -2.4, 0], [10, -3.4, 0, Math.PI / 2], [10, 3.4, 0, -Math.PI / 2]]) { const p = add(g, M(new THREE.PlaneGeometry(w, 4.5), wall, { cast: false }), x, 2.25, z); p.rotation.y = ry; }
  // the window: rainy night city, flashes with the lightning (userData.win)
  const wt = textTex(64, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e1630'); gr.addColorStop(1, '#2a3450'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { c.fillStyle = '#141826'; c.fillRect(i * 7, 34 - (i * 13 % 18), 6, 40); c.fillStyle = '#ffd890'; for (let k = 0; k < 4; k++) c.fillRect(i * 7 + 1 + (k % 2) * 3, 40 - (i * 13 % 18) + k * 5, 1, 1); } c.strokeStyle = 'rgba(200,220,255,0.35)'; for (let i = 0; i < 40; i++) { const xx = (i * 37) % w, yy = (i * 23) % h; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - 1, yy + 4); c.stroke(); } });
  const winM = mat(wt, { emissive: '#ffffff', emissiveIntensity: 0.5, flat: false }); winM.emissiveMap = wt;
  const win = add(g, M(new THREE.PlaneGeometry(1.8, 1.4), winM, { cast: false }), 1.6, 1.7, -2.38);
  for (const [w, h, x, y] of [[1.95, 0.08, 1.6, 2.42], [1.95, 0.08, 1.6, 0.98], [0.08, 1.5, 0.66, 1.7], [0.08, 1.5, 2.54, 1.7], [0.05, 1.4, 1.6, 1.7]]) add(g, M(new THREE.BoxGeometry(w, h, 0.06), mat('#d8dce2')), x, y, -2.35);
  const couch = sofa(g, '#7a4a6a'); couch.position.set(0, 0, -1.5);
  const tvs = textTex(64, 36, (c, w, h) => { c.fillStyle = '#2a6ad8'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(6, 6, 20, 4); c.fillStyle = '#ffd23a'; c.fillRect(40, 16, 16, 14); });
  const tv = grp(g, 0, 0, 2.2, Math.PI);
  add(tv, M(boxG(1.4, 0.5, 0.45), soft('#2a2420', 6)));
  add(tv, M(new THREE.BoxGeometry(1.5, 0.86, 0.06), mat('#141418')), 0, 0.95, 0);
  add(tv, M(new THREE.PlaneGeometry(1.4, 0.78), mat(tvs, { emissive: '#ffffff', emissiveIntensity: 0.8, flat: false }), { cast: false }), 0, 0.95, 0.035);
  const tvl = new THREE.PointLight(0x6aa0ff, 4, 6, 1.6); tvl.position.set(0, 1.0, 1.6); g.add(tvl);
  add(g, M(boxG(1.1, 0.4, 0.6), soft('#6a4a32', 6)), 0, 0, -0.3);
  snacks(g, 0.1, 0.4, -0.3);
  const lamp = grp(g, -1.5, 0, -1.9); add(lamp, M(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6).translate(0, 0.7, 0), mat('#2a2a2e'))); add(lamp, M(new THREE.CylinderGeometry(0.15, 0.25, 0.3, 10, 1, true), glowMat('#ffd8a0', 0.8)), 0, 1.5, 0);
  const ll = new THREE.PointLight(0xffc890, 2.2, 5, 1.6); ll.position.set(-1.5, 1.45, -1.8); g.add(ll);
  add(g, M(new THREE.CylinderGeometry(1.4, 1.4, 0.01, 24), soft('#3a3a5a', 8)), 0, 0.005, -0.4).scale.set(1.3, 1, 0.9);
  return { g, couch, win, winM, tvl };
}

// ------------------------------------------------------------------ 2. the wet city street (+ a tall building for the wall run)
export function buildStreet(W) {
  const g = grp(W.scene, ST.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(9, 140).rotateX(-Math.PI / 2), WET(), { cast: false }), 0, 0, -40);
  for (const sx of [-1, 1]) add(g, M(boxG(3, 0.15, 140), mat('#3a3c44', { rough: 0.3, metal: 0.2 })), sx * 6, 0, -40);
  for (let i = 0; i < 24; i++) add(g, M(new THREE.PlaneGeometry(0.15, 1.6).rotateX(-Math.PI / 2), glowMat('#d8d0a0', 0.4), { cast: false }), 0, 0.01, 20 - i * 5);
  const cols = ['#3a4458', '#4a3a48', '#384a4a', '#4a4438', '#2e3a52'];
  for (let i = 0; i < 16; i++) for (const sx of [-1, 1]) { const w = 6 + (i % 3) * 2, h = 10 + ((i * 7 + (sx > 0 ? 3 : 0)) % 5) * 5; building(g, sx * (11 + w / 2 - 3), 14 - i * 9, w, h, 7, { color: cols[(i + (sx > 0 ? 2 : 0)) % 5], seed: i * 2 + (sx > 0 ? 1 : 0) }); }
  for (let i = 0; i < 12; i++) for (const sx of [-1, 1]) streetLamp(g, sx * 5.2, 12 - i * 11, { light: i < 6 });
  for (let i = 0; i < 8; i++) tree(g, (i % 2 ? 1 : -1) * 6.6, 6 - i * 13, 1.4, i + 3);
  const cars = [[-2.1, 0, 0, '#c83a3a'], [2.1, -9, Math.PI, '#3a7ad8'], [-2.1, -18, 0, '#e8c040'], [2.1, -27, Math.PI, '#e8e8e4'], [-2.1, -36, 0, '#3ab06a']].map(([x, z, r, c]) => car(g, x, z, r, c));
  // a traffic light
  const tl = grp(g, -4.4, 0, -5); add(tl, M(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8).translate(0, 1.7, 0), mat('#2a2e38'))); add(tl, M(boxG(0.3, 0.8, 0.25), mat('#1a1c22')), 0, 3.0, 0); add(tl, M(new THREE.SphereGeometry(0.08, 8, 6), glowMat('#ff2a2a', 3)), 0, 3.6, 0.13); glowSprite(tl, [0, 3.6, 0.2], 0.9, 'rgba(255,50,50,0.9)', 0.6);
  return { g, cars };
}
// the building wall he runs up: a tall facade (x0 = 400), looked at from below
export function buildWall(W) {
  const g = grp(W.scene, WA.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), WET(), { cast: false }), 0, 0, 5);
  const b = building(g, 0, -4, 14, 60, 8, { color: '#3a4458', seed: 21, lit: 0.55 });
  building(g, -14, -6, 9, 40, 8, { color: '#4a3a48', seed: 22 }); building(g, 14, -6, 9, 46, 8, { color: '#384a4a', seed: 23 });
  for (const sx of [-4, 4]) streetLamp(g, sx, 2.0);
  return { g };
}

// ------------------------------------------------------------------ 3. the bridge in the rain
export function buildBridge(W) {
  const g = grp(W.scene, BR.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat('#0c1420', { rough: 0.08, metal: 0.6, flat: false }), { cast: false }), 0, -6, -40);   // dark water
  const deck = add(g, M(boxG(7, 0.6, 120), mat('#2e323c', { rough: 0.3 })), 0, -0.6, -30);
  add(g, M(new THREE.PlaneGeometry(6, 120).rotateX(-Math.PI / 2), WET(), { cast: false }), 0, 0.01, -30);
  for (const sz of [-10, -50]) for (const sx of [-1, 1]) { add(g, M(boxG(0.8, 22, 0.8), mat('#5a6070')), sx * 3.6, -6, sz); add(g, M(new THREE.SphereGeometry(0.25, 8, 6), glowMat('#ff3a3a', 3)), sx * 3.6, 16.2, sz); }
  const cm = mat('#8a90a0', { rough: 0.4, metal: 0.5 });
  for (const sx of [-1, 1]) for (const [z0, z1] of [[-10, 15], [-10, -30], [-50, -30], [-50, -75]]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const k = i / 16, z = lerp(z0, z1, k); pts.push(V(sx * 3.6, 16 - 15 * Math.sin(k * Math.PI / 2) * (z0 === -10 || z0 === -50 ? 1 : 1), z)); }
    add(g, M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 4), cm, { cast: false }));
  }
  for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffd8a0, 6, 12, 1.5); l.position.set((i % 2 ? 1 : -1) * 3.0, 2.2, 8 - i * 7); g.add(l); }
  for (let i = 0; i < 14; i++) for (const sx of [-1, 1]) { add(g, M(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6).translate(0, 0.8, 0), mat('#2a2e38')), sx * 3.2, 0, 10 - i * 7); add(g, M(new THREE.SphereGeometry(0.12, 8, 6), glowMat('#ffd890', 2.5)), sx * 3.2, 1.65, 10 - i * 7); glowSprite(g, [sx * 3.2, 1.65, 10 - i * 7], 1.0, 'rgba(255,215,140,0.9)', 0.6); }
  for (let i = 0; i < 18; i++) building(g, -60 + i * 7, -95 - (i % 3) * 6, 5, 14 + (i * 7 % 5) * 6, 5, { color: '#2a3446', seed: 40 + i, lit: 0.5 });
  const cars = [[-1.5, -6, Math.PI, '#e8e8e4'], [1.5, -20, 0, '#c83a3a']].map(([x, z, r, c]) => car(g, x, z, r, c));
  return { g, cars };
}

// ------------------------------------------------------------------ 4. her house: the front door with a porch light
export function buildHouse(W) {
  const g = grp(W.scene, HO.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), soft('#1e2a1e', 8), { cast: false }), 0, 0, 5);
  add(g, M(new THREE.PlaneGeometry(1.8, 12).rotateX(-Math.PI / 2), WET(), { cast: false }), 0, 0.01, 6);
  const siding = tex(paint(64, 64, (x, y) => { const r = y % 8; const d = r === 0 ? -30 : r === 1 ? 12 : 0; return [196 + d, 206 + d, 214 + d]; })); siding.repeat.set(4, 3);
  add(g, M(boxG(12, 6, 0.4), mat(siding)), 0, 0, -0.2);
  add(g, M(boxG(3.4, 0.3, 2.2), mat('#6a6e78', { rough: 0.25, metal: 0.2 })), 0, 0, 1.0);                      // the porch (wet)
  add(g, M(boxG(3.0, 0.15, 0.5), mat('#6a6e78')), 0, 0, 2.3);
  add(g, M(boxG(3.6, 0.15, 2.4), mat('#f2f0ea')), 0, 2.85, 1.0);
  for (const sx of [-1.5, 1.5]) add(g, M(boxG(0.14, 2.55, 0.14), mat('#f2f0ea')), sx, 0.3, 2.0);
  for (const sx of [-1, 1]) add(g, M(boxG(0.14, 2.35, 0.14), mat('#f2f0ea')), sx * 0.62, 0.3, 0.02);
  add(g, M(boxG(1.38, 0.16, 0.14), mat('#f2f0ea')), 0, 2.5, 0.02);
  const door = grp(g, -0.55, 0.3, 0.06);                                                                    // hinge on the left
  add(door, M(boxG(1.1, 2.2, 0.07), soft('#7a2a2a', 8)), 0.55, 0, 0);
  for (const yy of [0.4, 1.3]) add(door, M(boxG(0.8, 0.7, 0.02), soft('#6a2222', 6)), 0.55, yy, 0.045);
  add(door, M(new THREE.SphereGeometry(0.045, 8, 6), mat('#e0b840', { metal: 0.8, rough: 0.3 })), 0.98, 1.05, 0.08);
  const inside = add(g, M(new THREE.PlaneGeometry(1.1, 2.2), mat('#ffd8a0', { emissive: '#ffb860', emissiveIntensity: 0.9 }), { cast: false }), 0, 1.4, 0.012);
  // the porch light
  add(g, M(new THREE.BoxGeometry(0.2, 0.3, 0.12), glowMat('#ffd890', 2.5)), 1.0, 2.2, 0.12);
  glowSprite(g, [1.0, 2.2, 0.3], 1.8, 'rgba(255,215,140,0.95)', 0.7);
  const pl = new THREE.PointLight(0xffd090, 8, 7, 1.5); pl.position.set(1.0, 2.15, 0.6); g.add(pl);
  const rf = glowSprite(g, [0.7, 0.32, 1.4], 1.6, 'rgba(255,210,140,0.9)', 0.3); rf.scale.set(1.0, 2.2, 1);
  for (const [w, x] of [[1.2, -3.6], [1.2, 3.6]]) { add(g, M(new THREE.BoxGeometry(w, 1.0, 0.08), mat('#f2f0ea')), x, 2.6, 0.02); add(g, M(new THREE.PlaneGeometry(w - 0.15, 0.85), mat('#ffd890', { emissive: '#ffb860', emissiveIntensity: 0.7 }), { cast: false }), x, 2.6, 0.07); }
  for (const sx of [-1, 1]) add(g, M(new THREE.IcosahedronGeometry(0.5, 0).scale(1.2, 0.8, 1), soft('#2a4a2a', 12)), sx * 2.4, 0.35, 1.3);
  tree(g, -5.5, 3, 1.6, 9); tree(g, 6, 4, 1.8, 10);
  return { g, door, inside, pl };
}
