// Bed-shake reel: the "dollhouse" cutaway apartment building (bright, warm, flat colours) like the reference:
// the bedroom upstairs (light blue walls, wooden floor, a teal striped blanket), the old neighbors' living room
// downstairs (cream walls, orange checkered floor, green sofa, the chandelier), the basement, a party flat on top;
// plus the building outside at night, the subway tunnel, and props (hammer, nails, giant wrench + bolts, drumsticks).
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp, hash1 } from './lib.js';
import { glowSprite, ideaBulb, teddy } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const ctex = (w, h, draw, rep = [1, 1]) => { const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h); return tex(c, { repeat: rep, nearest: false }); };
const noisy = (hex, amount = 8, seed = 3, rep = [1, 1]) => { const b = hexToRgb(hex), R = rng(seed); return tex(paint(32, 32, () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }), { repeat: rep }); };

export const PL = { house: 0, street: 300, subway: 600, news: 900 };
export const HB = { W: 7, D: 5, H: 3, floors: { base: -3, f1: 0, f2: 3, f3: 6 } };   // building box: x -3.5..3.5, z -5..0 (front open)
export const BED = { x: 0.3, z: -2.6, top: 0.62 };                                     // the bed (on the bedroom floor), headboard at +x

// ------------------------------------------------------------------ warm cosy lights for the cutaway
export function homeLights(W, { at = [0, 4, -2], size = 7, night = true } = {}) {
  const L = {};
  L.hemi = new THREE.HemisphereLight(0xfff4e8, 0xb8a080, 1.15); W.scene.add(L.hemi);
  L.key = new THREE.DirectionalLight(0xfff0dc, 1.6); L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048);
  L.key.shadow.bias = -0.0005; L.key.shadow.normalBias = 0.03; L.key.shadow.radius = 5;
  const t = V(...at); L.key.position.copy(t).add(V(3, 6, 9)); L.key.target.position.copy(t);
  Object.assign(L.key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 40 }); L.key.shadow.camera.updateProjectionMatrix();
  W.scene.add(L.key); W.scene.add(L.key.target);
  W.scene.background = new THREE.Color(night ? '#2a3260' : '#bcd4ec');
  W.lights = L;
  return L;
}

// ------------------------------------------------------------------ the cutaway building
function planks(hex = '#c88a52') { return ctex(128, 128, (g) => { g.fillStyle = hex; g.fillRect(0, 0, 128, 128); const R = rng(4); for (let r = 0; r < 8; r++) { g.fillStyle = 'rgba(80,40,10,0.25)'; g.fillRect(0, r * 16, 128, 2); for (let k = 0; k < 3; k++) { const x = Math.floor(R() * 128); g.fillRect(x, r * 16, 2, 16); } g.fillStyle = `rgba(255,255,255,${0.04 + R() * 0.05})`; g.fillRect(0, r * 16 + 2, 128, 14); } }, [3, 2]); }
function checker(a = '#f08a5a', b = '#fff4ea') { return ctex(64, 64, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) & 1 ? a : b; g.fillRect(x * 8, y * 8, 8, 8); } }, [4, 3]); }
function room(parent, y0, { wall, floor, ceiling = '#f6f2ea', sideL = true, sideR = true, back = true } = {}) {
  const g = grp(parent, 0, y0, 0), { W: w, D: d, H: h } = HB;
  add(g, M(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), floor, { cast: false }), 0, 0.001, -d / 2);
  const wm = typeof wall === 'string' ? mat(noisy(wall, 6, Math.floor(y0 * 7 + 11)), { rough: 0.95 }) : wall;
  if (back) add(g, M(new THREE.PlaneGeometry(w, h), wm, { cast: false }), 0, h / 2, -d);
  if (sideL) { const p = add(g, M(new THREE.PlaneGeometry(d, h), wm, { cast: false }), -w / 2, h / 2, -d / 2); p.rotation.y = Math.PI / 2; }
  if (sideR) { const p = add(g, M(new THREE.PlaneGeometry(d, h), wm, { cast: false }), w / 2, h / 2, -d / 2); p.rotation.y = -Math.PI / 2; }
  add(g, M(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), mat(ceiling), { cast: false }), 0, h - 0.26, -d / 2);
  return g;
}
function windowOn(parent, x, y, z, w = 1.0, h = 1.2, { sky = '#1c2a5e', moon = false } = {}) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.PlaneGeometry(w, h), mat(sky, { emissive: sky, emissiveIntensity: 0.6 }), { cast: false }), 0, 0, 0.005);
  if (moon) add(g, M(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8' }), { cast: false }), w * 0.25, h * 0.25, 0.008);
  const fr = mat('#f8f6f0');
  for (const [ww, hh, xx, yy] of [[w + 0.12, 0.08, 0, h / 2], [w + 0.12, 0.08, 0, -h / 2], [0.08, h, -w / 2, 0], [0.08, h, w / 2, 0], [0.05, h, 0, 0], [w, 0.05, 0, 0]]) add(g, M(new THREE.BoxGeometry(ww, hh, 0.06), fr), xx, yy, 0.03);
  return g;
}
export function bed(parent, x, z, { blanket = '#2aa894' } = {}) {
  const g = grp(parent, x, 0, z), wood = mat('#b8743a', { rough: 0.7 }), dark = mat('#8a5228');
  add(g, M(boxG(2.1, 0.3, 1.5), wood), 0, 0.12, 0);
  for (const [lx, lz] of [[-0.98, -0.68], [0.98, -0.68], [-0.98, 0.68], [0.98, 0.68]]) g.userData[`leg${lx > 0 ? 'R' : 'L'}${lz > 0 ? 'F' : 'B'}`] = add(g, M(boxG(0.1, 0.14, 0.1), dark), lx, 0, lz);
  add(g, M(boxG(0.1, 1.0, 1.55), wood), 1.08, 0, 0);                        // headboard (+x)
  add(g, M(boxG(0.08, 0.55, 1.55), wood), -1.08, 0, 0);                     // footboard
  add(g, M(boxG(2.0, 0.2, 1.42), mat('#fbfaf4')), 0, 0.42, 0);              // mattress
  for (const pz of [-0.36, 0.36]) add(g, M(new THREE.BoxGeometry(0.42, 0.14, 0.6).translate(0, 0.07, 0), mat('#ffffff')), 0.78, 0.62, pz).rotation.z = 0.2;
  const bt = ctex(128, 64, (c) => { c.fillStyle = blanket; c.fillRect(0, 0, 128, 64); c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 4; i++) c.fillRect(10 + i * 30, 0, 6, 64); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 4; i++) c.fillRect(17 + i * 30, 0, 2, 64); });
  const geo = new THREE.BoxGeometry(1.75, 0.36, 1.55, 10, 1, 8); geo.translate(-0.18, 0.18, 0);
  const blank = add(g, M(geo, mat(bt, { rough: 0.9 })), 0, 0.56, 0);
  g.userData.blanket = blank; g.userData.base = Float32Array.from(geo.attributes.position.array);
  // shake the bed: k 0..1 (frame rattle + blanket waves)
  g.userData.shake = (t, k = 1) => {
    g.position.x = x + Math.sin(t * 47) * 0.02 * k; g.rotation.z = Math.sin(t * 39) * 0.012 * k; g.position.y = Math.abs(Math.sin(t * 23)) * 0.03 * k;
    const p = geo.attributes.position, b = g.userData.base;
    for (let i = 0; i < p.count; i++) { const bx = b[i * 3], by = b[i * 3 + 1], bz = b[i * 3 + 2]; p.setY(i, by + (by > 0.2 ? Math.sin(t * 30 + bx * 6 + bz * 3) * 0.05 * k : 0)); }
    p.needsUpdate = true; geo.computeVertexNormals();
  };
  return g;
}
export function sofa(parent, x, z, ry = 0, color = '#6aae5a') {
  const g = grp(parent, x, 0, z, ry), m = mat(color, { rough: 0.9 }), d = mat(new THREE.Color(color).multiplyScalar(0.8).getHex());
  add(g, M(boxG(2.0, 0.42, 0.85), m)); add(g, M(boxG(2.0, 0.55, 0.22), d), 0, 0.42, -0.32);
  for (const sx of [-1, 1]) add(g, M(boxG(0.22, 0.62, 0.85), d), sx * 1.0, 0, 0);
  for (const sx of [-0.48, 0.48]) add(g, M(boxG(0.92, 0.12, 0.62), m), sx, 0.42, 0.08);
  return g;
}
export function chandelier(parent, x, y, z) {
  const g = grp(parent, x, y, z), gold = mat('#d8b04a', { metal: 0.7, rough: 0.3 });
  const arm = grp(g); add(arm, M(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5).translate(0, -0.35, 0), mat('#3a3028')));
  const body = grp(arm, 0, -0.7, 0);
  add(body, M(new THREE.CylinderGeometry(0.05, 0.12, 0.14, 8), gold));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(body, M(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5).rotateZ(Math.PI / 2).translate(0.18, 0, 0), gold), 0, -0.02, 0).rotation.y = a; const c = add(body, M(new THREE.SphereGeometry(0.035, 8, 6), mat('#fff4c8', { emissive: '#ffd880', emissiveIntensity: 1.5 }), { cast: false }), Math.cos(a) * 0.34, 0.04, -Math.sin(a) * 0.34); }
  glowSprite(body, [0, 0, 0], 1.2, 'rgba(255,220,150,0.8)', 0.35);
  const l = new THREE.PointLight(0xffd8a0, 4, 6, 1.5); body.add(l);
  g.userData = { arm, body };
  return g;
}
export function buildHouse(W, { x0 = PL.house, party = false } = {}) {
  const g = grp(W.scene, x0); const H = { g, x0 };
  // basement
  H.base = room(g, -3, { wall: mat(noisy('#8a8e96', 14, 5), { rough: 1 }), floor: mat(noisy('#6a6e76', 12, 6, [3, 3])), ceiling: '#7a7e86' });
  for (const z of [-4.6, -4.3]) add(g, M(new THREE.CylinderGeometry(0.07, 0.07, 7, 8).rotateZ(Math.PI / 2), mat('#a85a3a', { metal: 0.4, rough: 0.5 })), 0, -0.55, z);
  H.bulb = add(g, M(new THREE.SphereGeometry(0.07, 8, 6), mat('#fff0c0', { emissive: '#ffd880', emissiveIntensity: 2 }), { cast: false }), 0.4, -0.75, -2.4);
  const bl = new THREE.PointLight(0xffd8a0, 6, 6, 1.5); bl.position.set(0.4, -0.9, -2.0); g.add(bl);
  // floor 1: the old neighbors' living room
  H.f1 = room(g, 0, { wall: '#f4e4b4', floor: mat(checker(), { rough: 0.6 }) });
  H.sofa = sofa(H.f1, 0.3, -3.9);
  add(H.f1, M(boxG(0.9, 0.42, 0.55), mat('#b8743a')), 0.3, 0, -2.4);                                                   // coffee table
  add(H.f1, M(boxG(0.06, 1.5, 0.06), mat('#3a3028')), 2.3, 0, -4.4); add(H.f1, M(new THREE.CylinderGeometry(0.16, 0.28, 0.32, 10).translate(0, -0.16, 0), mat('#fff2d0', { emissive: '#ffd890', emissiveIntensity: 0.6 })), 2.3, 1.75, -4.4);
  add(H.f1, M(new THREE.PlaneGeometry(0.9, 0.6), mat('#f29ab4')), -1.6, 1.8, -4.99);
  add(H.f1, M(new THREE.BoxGeometry(0.98, 0.68, 0.03), mat('#ffffff')), -1.6, 1.8, -4.995);
  H.door = grp(H.f1, -3.48, 0, -1.4); add(H.door, M(boxG(0.06, 2.1, 0.95).translate(0, 0, 0.475), mat('#a8683a'))); add(H.door, M(new THREE.SphereGeometry(0.04, 6, 5), mat('#d8b04a')), 0.05, 1.0, 0.85);
  windowOn(H.f1, 1.6, 1.7, -4.98, 1.0, 1.0);
  H.chand = chandelier(H.f1, 0.3, 2.74, -2.4);
  // floor 2: the bedroom
  H.f2 = room(g, 3, { wall: '#b8d4ec', floor: mat(planks(), { rough: 0.8 }) });
  windowOn(H.f2, 0.75, 1.85, -4.98, 1.3, 1.3, { moon: true });
  H.bed = bed(H.f2, BED.x, BED.z);
  add(H.f2, M(boxG(1.1, 2.1, 0.55), mat('#c08048')), -2.6, 0, -4.6);                                                  // wardrobe
  add(H.f2, M(boxG(0.45, 0.5, 0.4), mat('#c08048')), 1.85, 0, -3.8);
  add(H.f2, M(new THREE.CylinderGeometry(0.12, 0.18, 0.25, 8).translate(0, 0.62, 0), mat('#fff2d0', { emissive: '#ffd890', emissiveIntensity: 0.5 })), 1.85, 0, -3.8);
  add(H.f2, M(boxG(1.2, 0.02, 0.8), mat('#e8c060')), -0.8, 0.005, -1.3);                                                // rug
  // floor 3: another flat (the party at the end)
  H.f3 = room(g, 6, { wall: '#c8b0e8', floor: mat(planks('#b88458'), { rough: 0.8 }) });
  windowOn(H.f3, 1.4, 1.7, -4.98, 1.0, 1.1);
  // slabs: cream front edges like the reference
  const edge = mat('#fbf2e2', { rough: 0.8 });
  for (const y of [-3, 0, 3, 6, 9]) add(g, M(new THREE.BoxGeometry(HB.W + 0.3, 0.26, 0.1), edge), 0, y - 0.13, 0.0);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.15, 12.2, 0.1), edge), sx * (HB.W / 2 + 0.08), 3.0, 0.0);
  add(g, M(new THREE.BoxGeometry(HB.W + 0.4, 0.3, HB.D + 0.3), mat('#9a5a40')), 0, 9.1, -HB.D / 2);                      // the roof
  // a dark-blue night outside the cutaway
  add(g, M(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: '#2a3260' }), { cast: false, receive: false }), 0, 5, -12);
  return H;
}

// ------------------------------------------------------------------ the building from outside at night (the street)
function facadeTex() {
  return ctex(256, 256, (g) => {
    g.fillStyle = '#d8a078'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(120,60,40,0.18)';
    for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 256; x += 16) g.fillRect(x, y, 15, 1);
    for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 256, 1);
  }, [1, 1]);
}
export function buildStreet(W, { x0 = PL.street } = {}) {
  const g = grp(W.scene, x0); const S = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat(noisy('#3a3e48', 10, 3, [40, 40]))), 0, 0, 0);
  add(g, M(boxG(40, 0.15, 3.2), mat(noisy('#9a9aa2', 10, 4, [12, 1]))), 0, 0, 1.6);
  const b = grp(g, 0, 0, -0.1); S.building = b;
  add(b, M(boxG(8.4, 9.4, 6), mat(facadeTex(), { rough: 0.9 })), 0, 0, -3);
  add(b, M(boxG(8.8, 0.35, 6.4), mat('#8a4a34')), 0, 9.4, -3);
  S.windows = [];
  for (let fl = 0; fl < 3; fl++) for (let i = 0; i < 3; i++) {
    const lit = !(fl === 0 && i === 2);
    const w = add(b, M(new THREE.PlaneGeometry(1.1, 1.3), mat(lit ? '#ffd890' : '#2a3048', { emissive: lit ? '#ffb850' : '#1a2030', emissiveIntensity: lit ? 1.0 : 0.3 }), { cast: false }), -2.6 + i * 2.6, 1.6 + fl * 3.0, 0.005);
    add(b, M(new THREE.BoxGeometry(1.25, 1.45, 0.08), mat('#f6f0e6')), -2.6 + i * 2.6, 1.6 + fl * 3.0, -0.03);
    S.windows.push(w);
  }
  add(b, M(boxG(1.2, 2.2, 0.08), mat('#5a3a2a')), 0, 0, 0.0);                                         // front door
  add(b, M(new THREE.BoxGeometry(1.4, 0.08, 0.5), mat('#3a3a40')), 0, 2.4, 0.25);
  const lamp = grp(g, 3.6, 0, 2.6); add(lamp, M(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 8).translate(0, 1.8, 0), mat('#2a2e38')));
  add(lamp, M(new THREE.BoxGeometry(0.3, 0.12, 0.3), mat('#ffe8b0', { emissive: '#ffd890', emissiveIntensity: 2 })), 0, 3.6, 0);
  glowSprite(lamp, [0, 3.5, 0], 2.0, 'rgba(255,220,150,0.9)', 0.6);
  const sl = new THREE.PointLight(0xffd8a0, 12, 12, 1.4); sl.position.set(0, 3.3, 0); lamp.add(sl);
  for (const [x, w, h, c] of [[-10, 8, 12, '#a87860'], [10, 8, 10, '#8a9ab0'], [-18, 7, 8, '#b8a090'], [18, 7, 14, '#9a8070']]) add(g, M(boxG(w, h, 6), mat(c)), x, 0, -3.2);
  // moon + stars
  add(g, M(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }), { cast: false, receive: false }), -6, 16, -40);
  return S;
}

// ------------------------------------------------------------------ the subway tunnel + train
export function buildSubway(W, { x0 = PL.subway } = {}) {
  const g = grp(W.scene, x0); const Sb = { g, x0 };
  const wall = mat(noisy('#5a6070', 14, 8, [8, 2]), { rough: 1 });
  const tun = new THREE.CylinderGeometry(3.2, 3.2, 120, 16, 1, true, Math.PI / 2, Math.PI); tun.rotateZ(Math.PI / 2);
  add(g, M(tun, new THREE.MeshStandardMaterial({ color: '#5a6070', roughness: 1, side: THREE.BackSide, flatShading: true }), { cast: false }), 0, 0.2, 0);
  add(g, M(new THREE.PlaneGeometry(120, 6.4).rotateX(-Math.PI / 2), mat(noisy('#3a3a40', 12, 4, [30, 2]))), 0, 0, 0);
  for (const z of [-0.72, 0.72]) add(g, M(new THREE.BoxGeometry(120, 0.08, 0.08), mat('#c8ccd4', { metal: 0.8, rough: 0.3 })), 0, 0.06, z);
  for (let x = -60; x < 60; x += 0.8) add(g, M(new THREE.BoxGeometry(0.16, 0.05, 2.0), mat('#4a3a2a')), x, 0.025, 0);
  for (let x = -50; x < 50; x += 8) { add(g, M(new THREE.BoxGeometry(0.5, 0.1, 0.2), mat('#fff6d8', { emissive: '#ffe8a8', emissiveIntensity: 1.6 }), { cast: false }), x, 2.6, -2.2); const l = new THREE.PointLight(0xfff0d0, 3, 7, 1.5); l.position.set(x, 2.4, -1.8); g.add(l); }
  // the train (3 cars)
  const train = grp(g); Sb.train = train; Sb.cars = [];
  for (let k = 0; k < 3; k++) {
    const car = grp(train, -k * 9.4, 0, 0);
    add(car, M(boxG(9, 2.6, 2.6), mat('#e8ecf0', { rough: 0.4, metal: 0.2 })), 0, 0.35, 0);
    add(car, M(boxG(9.02, 0.3, 2.62), mat('#2a6ad8')), 0, 0.9, 0);
    for (let i = 0; i < 6; i++) add(car, M(new THREE.PlaneGeometry(0.9, 0.8), mat('#fff4d0', { emissive: '#ffe0a0', emissiveIntensity: 0.9 }), { cast: false }), -3.6 + i * 1.45, 2.0, 1.31);
    if (k === 0) { add(car, M(new THREE.BoxGeometry(0.1, 1.0, 1.8), mat('#1a2030', { emissive: '#203050', emissiveIntensity: 0.5 })), 4.52, 2.1, 0); for (const z of [-0.8, 0.8]) { add(car, M(new THREE.CircleGeometry(0.15, 10), mat('#fff8e0', { emissive: '#fff4c0', emissiveIntensity: 3 }), { cast: false }), 4.53, 0.8, z).rotation.y = Math.PI / 2; } }
    Sb.cars.push(car);
  }
  return Sb;
}

// ------------------------------------------------------------------ props
export function hammer(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 6).translate(0, 0.17, 0), mat('#b87a3a')));
  add(g, M(new THREE.BoxGeometry(0.16, 0.06, 0.06), mat('#5a5e66', { metal: 0.8, rough: 0.3 })), 0.02, 0.34, 0);
  g.userData.grip = { pos: [0, 0.06, 0], axis: [0, 1, 0], up: [1, 0, 0] };
  return g;
}
export function nail(parent, x, y, z, s = 1) {
  const g = grp(parent, x, y, z); const m = mat('#9aa0a8', { metal: 0.8, rough: 0.3 });
  add(g, M(new THREE.CylinderGeometry(0.006 * s, 0.004 * s, 0.12 * s, 5).translate(0, -0.06 * s, 0), m)); add(g, M(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.006, 8), m));
  return g;
}
export function bigBolt(parent, x, y, z, s = 1, ry = 0, rx = 0) {
  const g = grp(parent, x, y, z, ry); g.rotation.x = rx; const m = mat('#a8aeb8', { metal: 0.85, rough: 0.3 });
  add(g, M(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 1.0 * s, 10).translate(0, -0.5 * s, 0), m));
  add(g, M(new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 0.1 * s, 6), m));
  for (let i = 0; i < 6; i++) add(g, M(new THREE.TorusGeometry(0.062 * s, 0.01 * s, 4, 10).rotateX(Math.PI / 2), m), 0, -0.2 * s - i * 0.12 * s, 0);
  return g;
}
export function wrench(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g); const m = mat('#b8c0c8', { metal: 0.85, rough: 0.3 });
  add(g, M(new THREE.BoxGeometry(0.06 * s, 0.9 * s, 0.03 * s).translate(0, 0.45 * s, 0), m));
  const head = add(g, M(new THREE.TorusGeometry(0.12 * s, 0.035 * s, 6, 10, Math.PI * 1.5), m), 0, 0.98 * s, 0); head.rotation.z = Math.PI * 0.25;
  g.userData.grip = { pos: [0, 0.12 * s, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function drumstick(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.008, 0.013, 0.4, 6).translate(0, 0.2, 0), mat('#e8c890')));
  add(g, M(new THREE.SphereGeometry(0.014, 6, 5), mat('#e8c890')), 0, 0.4, 0);
  g.userData.grip = { pos: [0, 0.06, 0], axis: [0, 1, 0], up: [1, 0, 0] };
  return g;
}
export function discoBall(parent, x, y, z) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4).translate(0, 0.25, 0), mat('#222')));
  const b = add(g, M(new THREE.IcosahedronGeometry(0.2, 1), mat('#e8eef8', { metal: 0.9, rough: 0.15, emissive: '#8890a8', emissiveIntensity: 0.4 })));
  g.userData.ball = b;
  return g;
}
export { ideaBulb, teddy };
