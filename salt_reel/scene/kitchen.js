// Salt reel: the small pastel kitchen + props (low-poly, smooth, bright like the reference). Builders add to a
// parent and return handles for the animation. One place only (x = 0): YOU sits at the wooden table (facing +z),
// the plate of fries in front of him, the window + counter + cat + wall clock behind him, later a leaf blower.
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp } from './lib.js';
import { textTex, glowSprite, wallClock, flowerPot } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const soft = (hex, amount = 5, o = {}) => mat(tex(paint(32, 32, (() => { const b = hexToRgb(hex), R = rng(o.seed ?? 3); return () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }; })())), o);
const planeAt = (parent, w, h, material, x, y, z, ry = 0) => { const m = add(parent, M(new THREE.PlaneGeometry(w, h), material, { cast: false }), x, y, z); m.rotation.y = ry; return m; };

export const K = { table: [0, 0], top: 0.76, seat: [0, -0.62], plate: [0, 0.78, -0.08], counter: [1.25, -2.15], cat: [1.6, 0.95, -2.2], clock: [-1.0, 2.62, -2.47], blower: [0.95, 0.95, -2.1], window: [-1.0, 1.65, -2.49] };
// the salt material: everything turns white after the BOOM
export const SALT = () => soft('#f6f6f2', 10, { seed: 9, rough: 0.95 });

function woodTex(hex = '#c08a52', size = 64, seed = 4) {
  const b = hexToRgb(hex), R = rng(seed);
  return tex(paint(size, size, (x, y) => { const s = Math.sin(y * 0.55 + Math.sin(x * 0.08) * 2.5) * 10 + (y % 16 === 0 ? -26 : 0) + (R() - 0.5) * 6; return [b[0] + s, b[1] + s * 0.8, b[2] + s * 0.6]; }));
}
function tileTex(a = '#f4efe6', b = '#e6dccc', n = 6, size = 96) {
  const A = hexToRgb(a), B = hexToRgb(b), cell = size / n, R = rng(2);
  return tex(paint(size, size, (x, y) => { const c = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) ? A : B; const e = (x % cell === 0 || y % cell === 0) ? -14 : 0; const d = (R() - 0.5) * 3 + e; return [c[0] + d, c[1] + d, c[2] + d]; }), { nearest: false });
}
function backsplashTex() {
  return tex(paint(64, 64, (x, y) => { const e = (x % 16 === 0 || y % 8 === 0) ? -20 : 0; return [214 + e, 240 + e, 232 + e]; }));
}

// ------------------------------------------------------------------ props
export function fries(parent, n = 46, seed = 3) {
  const g = new THREE.Group(); parent.add(g);
  const R = rng(seed), m1 = mat('#f6c650', { rough: 0.7 }), m2 = mat('#e8a83a', { rough: 0.7 });
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.11, h = 0.012 + R() * 0.04;
    const f = add(g, M(new THREE.BoxGeometry(0.014, 0.014, 0.075 + R() * 0.04), i % 3 ? m1 : m2), Math.cos(a) * r, h, Math.sin(a) * r);
    f.rotation.set((R() - 0.5) * 0.8, R() * Math.PI, (R() - 0.5) * 0.6);
  }
  return g;
}
export function plateOfFries(parent, x, y, z) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.17, 0.13, 0.022, 22).translate(0, 0.011, 0), mat('#fbfaf6', { rough: 0.3 })));
  add(g, M(new THREE.TorusGeometry(0.15, 0.008, 4, 22).rotateX(Math.PI / 2), mat('#8ac0e8', { rough: 0.3 })), 0, 0.022, 0);
  const fr = fries(g); fr.position.y = 0.022;
  // the salt mountain (scale it up when the lid falls off)
  const mount = add(g, M(new THREE.ConeGeometry(0.13, 0.16, 12, 3).translate(0, 0.08, 0), SALT()), 0, 0.02, 0);
  mount.scale.setScalar(0.001);
  // a light dusting (scale up for a bit of salt)
  g.userData = { fries: fr, mount, top: V(0, 0.06, 0) };
  return g;
}
// the salt shaker: clear glass body full of salt, a silver lid with holes (the lid can fall off: userData.lid)
export function saltShaker(parent, s = 1.5) {
  const g = new THREE.Group(); parent.add(g);
  const b = new THREE.Group(); g.add(b); b.scale.setScalar(s);
  add(b, M(new THREE.CylinderGeometry(0.026, 0.029, 0.085, 14, 1, true).translate(0, 0.0425, 0), mat('#e8f6ff', { rough: 0.05, transparent: true, opacity: 0.38, side: THREE.DoubleSide }), { cast: false }));
  add(b, M(new THREE.CylinderGeometry(0.024, 0.027, 0.07, 14).translate(0, 0.035, 0), SALT()));
  add(b, M(new THREE.CylinderGeometry(0.029, 0.029, 0.006, 14), mat('#e8f6ff', { rough: 0.05, transparent: true, opacity: 0.5 })), 0, 0.003, 0);
  const lid = grp(b, 0, 0.085, 0);
  const holes = textTex(64, 64, (x, w, h) => { x.fillStyle = '#eef0f4'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2e36'; for (const [px, py] of [[32, 32], [20, 24], [44, 24], [20, 40], [44, 40], [32, 16], [32, 48]]) { x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); } });
  const lm = mat('#e6eaf0', { metal: 0.3, rough: 0.3 });
  add(lid, M(new THREE.CylinderGeometry(0.027, 0.029, 0.02, 14).translate(0, 0.01, 0), lm));
  add(lid, M(new THREE.SphereGeometry(0.027, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), lm), 0, 0.02, 0);
  add(lid, M(new THREE.CircleGeometry(0.02, 18).rotateX(-Math.PI / 2), mat(holes, { metal: 0.2, rough: 0.35, flat: false }), { cast: false }), 0, 0.0325, 0);
  g.userData = { lid, body: b, s, grip: { pos: [0, 0.045 * s, 0], axis: [0, 1, 0], up: [0, 0, 1] }, top: () => lid.localToWorld(V(0, 0.034, 0)) };
  return g;
}
export function needle(parent) {
  const g = new THREE.Group(); parent.add(g);
  const st = mat('#d8dce2', { metal: 0.9, rough: 0.2 });
  add(g, M(new THREE.CylinderGeometry(0.0018, 0.0006, 0.08, 6).translate(0, -0.04, 0), st));
  add(g, M(new THREE.TorusGeometry(0.003, 0.0008, 4, 8), st), 0, 0.004, 0);
  g.userData.grip = { pos: [0, -0.01, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
// the big leaf blower: orange body, handle, long tube; a dial MIN..MAX (userData.dial rotates); the shaker taped on
export function leafBlower(parent) {
  const g = new THREE.Group(); parent.add(g);
  const orange = soft('#f28a2a', 8), dark = mat('#2a2e38', { rough: 0.5 }), grey = mat('#9aa0a8', { rough: 0.4 });
  add(g, M(new THREE.CapsuleGeometry(0.16, 0.22, 4, 10).rotateZ(Math.PI / 2), orange), 0, 0.2, 0);
  add(g, M(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16).rotateZ(Math.PI / 2), dark), -0.3, 0.2, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(g, M(new THREE.BoxGeometry(0.01, 0.02, 0.24), grey), -0.365, 0.2 + Math.sin(a) * 0.08, Math.cos(a) * 0.08).rotation.x = a; }
  const h = new THREE.TorusGeometry(0.11, 0.025, 6, 12, Math.PI); add(g, M(h, dark), 0.0, 0.36, 0);
  // the tube (points +x then toward the plate); the end is where the shaker is taped
  add(g, M(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 12).rotateZ(Math.PI / 2), orange), 0.48, 0.18, 0);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12).rotateZ(Math.PI / 2), dark), 0.8, 0.18, 0);
  // the dial: MIN -> MAX
  const dt = textTex(64, 64, (x, w, hh) => {
    x.fillStyle = '#fbfaf6'; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill();
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.75 + i * 0.15); x.strokeStyle = i > 7 ? '#e8202a' : '#2a2e38'; x.lineWidth = 3; x.beginPath(); x.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); x.lineTo(32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29); x.stroke(); }
    x.fillStyle = '#2a2e38'; x.font = 'bold 9px sans-serif'; x.fillText('MIN', 8, 58); x.fillStyle = '#e8202a'; x.fillText('MAX', 38, 58);
  });
  const face = add(g, M(new THREE.CircleGeometry(0.07, 20), mat(dt, { flat: false }), { cast: false }), 0.02, 0.22, 0.165);
  const dial = grp(g, 0.02, 0.22, 0.17);
  add(dial, M(new THREE.BoxGeometry(0.012, 0.055, 0.01).translate(0, 0.024, 0), mat('#e8202a')));
  add(dial, M(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10).rotateX(Math.PI / 2), dark));
  dial.rotation.z = Math.PI * 0.75;                                          // MIN (turn to -0.75*PI for MAX)
  const tape = mat('#c8ccd2', { rough: 0.8 });
  for (const x of [0.86, 0.92]) add(g, M(new THREE.TorusGeometry(0.066, 0.012, 4, 14).rotateY(Math.PI / 2), tape), x, 0.18, 0);
  g.userData = { dial, nozzle: V(0.83, 0.18, 0), face };
  return g;
}
export function tapeRoll(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.TorusGeometry(0.035, 0.015, 6, 14), mat('#c8ccd2', { rough: 0.8 })));
  g.userData.grip = { pos: [0, -0.04, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  return g;
}
// the cat (sits on the counter); white = true after the BOOM
export function cat(parent, x, y, z, ry = 0, color = '#f2a24a') {
  const g = grp(parent, x, y, z, ry);
  const m = soft(color, 10), m2 = soft(color === '#f6f6f2' ? '#f0f0ec' : '#d8803a', 8), black = mat('#141414');
  add(g, M(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.15, 1.25), m), 0, 0.14, 0);
  const head = grp(g, 0, 0.33, 0.1);
  add(head, M(new THREE.IcosahedronGeometry(0.09, 1).scale(1.1, 0.95, 1), m));
  for (const sx of [-1, 1]) { const e = add(head, M(new THREE.ConeGeometry(0.035, 0.07, 4), m2), sx * 0.055, 0.085, -0.005); e.rotation.z = -sx * 0.25; }
  for (const sx of [-1, 1]) add(head, M(new THREE.BoxGeometry(0.016, 0.03, 0.01), black), sx * 0.035, 0.01, 0.088);
  add(head, M(new THREE.ConeGeometry(0.012, 0.015, 3).rotateX(Math.PI), mat('#f27a8a')), 0, -0.02, 0.095);
  for (const sx of [-1, 1]) for (const k of [0, 1]) add(head, M(new THREE.BoxGeometry(0.07, 0.003, 0.003), mat('#ffffff')), sx * 0.07, -0.025 - k * 0.012, 0.075).rotation.z = sx * (0.1 - k * 0.2);
  for (const sx of [-1, 1]) add(g, M(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 6).translate(0, 0.05, 0), m), sx * 0.06, 0, 0.12);
  const tail = new THREE.TorusGeometry(0.12, 0.022, 5, 10, Math.PI * 0.9); const t = add(g, M(tail, m2), 0.1, 0.05, -0.12); t.rotation.set(Math.PI / 2, 0, 0.3);
  g.userData.head = head;
  return g;
}

// ------------------------------------------------------------------ the kitchen
export function buildKitchen(W, { white = false } = {}) {
  const g = grp(W.scene, 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(10, 9).rotateX(-Math.PI / 2), mat(tileTex(), { rough: 0.5, flat: false }), { cast: false }), 0, 0, 0).material.map.repeat.set(4, 4);
  const wall = soft('#cdeee2', 4), wall2 = soft('#fbe6d6', 4);
  planeAt(g, 10, 4, wall, 0, 2, -2.5); planeAt(g, 9, 4, wall2, -2.8, 2, 2, Math.PI / 2); planeAt(g, 9, 4, wall2, 2.8, 2, 2, -Math.PI / 2);
  add(g, M(new THREE.PlaneGeometry(10, 9).rotateX(Math.PI / 2), mat('#fbf8f2'), { cast: false }), 0, 3.2, 2);
  // the window: sky + a tree, white frame, curtains
  const sky = textTex(64, 64, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7ac0f0'); gr.addColorStop(1, '#d8f0fc'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(18, 18, 7, 0, 7); x.arc(26, 16, 9, 0, 7); x.arc(34, 19, 6, 0, 7); x.fill(); x.fillStyle = '#7ac86a'; x.beginPath(); x.arc(50, 58, 16, 0, 7); x.fill(); });
  planeAt(g, 1.1, 0.9, mat(sky, { emissive: '#ffffff', emissiveIntensity: 0.55, flat: false }), K.window[0], K.window[1], K.window[2]);
  const wf = mat('#ffffff', { rough: 0.4 });
  for (const [w, h, x, y] of [[1.22, 0.07, 0, 0.48], [1.22, 0.07, 0, -0.48], [0.07, 1.0, -0.58, 0], [0.07, 1.0, 0.58, 0], [1.1, 0.04, 0, 0], [0.04, 0.9, 0, 0]]) add(g, M(new THREE.BoxGeometry(w, h, 0.05), wf), K.window[0] + x, K.window[1] + y, K.window[2] + 0.02);
  add(g, M(new THREE.BoxGeometry(1.4, 0.05, 0.16), wf), K.window[0], K.window[1] - 0.52, K.window[2] + 0.08);
  for (const sx of [-1, 1]) add(g, M(boxG(0.28, 1.1, 0.05), soft('#f6b8c8', 6)), K.window[0] + sx * 0.75, K.window[1] - 0.6, K.window[2] + 0.06);
  flowerPot(g, K.window[0] - 0.35, K.window[2] + 0.1, 5).position.y = K.window[1] - 0.5;
  // the counter: pastel cabinets, white top, backsplash, upper cabinets, sink, kettle
  const cg = grp(g, K.counter[0], 0, K.counter[1]);
  add(cg, M(boxG(2.6, 0.88, 0.62), soft('#f8d0a8', 5)));
  for (let i = 0; i < 4; i++) { add(cg, M(new THREE.BoxGeometry(0.6, 0.7, 0.02), soft('#fbdcbc', 4)), -0.96 + i * 0.64, 0.45, 0.32); add(cg, M(new THREE.BoxGeometry(0.16, 0.025, 0.03), mat('#c8a060', { metal: 0.7, rough: 0.3 })), -0.96 + i * 0.64, 0.72, 0.34); }
  add(cg, M(boxG(2.7, 0.05, 0.68), mat('#fbfaf6', { rough: 0.3 })), 0, 0.88, 0);
  planeAt(cg, 2.7, 0.6, mat(backsplashTex(), { flat: false }), 0, 1.22, -0.3);
  add(cg, M(boxG(2.6, 0.7, 0.36), soft('#f8d0a8', 5)), 0, 1.85, -0.14);
  add(cg, M(new THREE.BoxGeometry(0.5, 0.04, 0.36), mat('#c8ccd2', { metal: 0.7, rough: 0.3 })), -0.75, 0.92, 0);
  add(cg, M(new THREE.CylinderGeometry(0.09, 0.11, 0.2, 12).translate(0, 0.1, 0), mat('#8ac0e8', { rough: 0.3 })), 0.85, 0.93, -0.1);
  // the wall clock
  const clock = wallClock(g, { r: 0.22 }); clock.position.set(...K.clock);
  // the wooden table + YOU's chair
  const tg = grp(g, K.table[0], 0, K.table[1]);
  const wood = mat(woodTex(), { rough: 0.6 });
  add(tg, M(boxG(1.3, 0.05, 0.85), wood), 0, K.top - 0.05, 0);
  for (const sx of [-0.58, 0.58]) for (const sz of [-0.36, 0.36]) add(tg, M(boxG(0.06, K.top - 0.05, 0.06), wood), sx, 0, sz);
  const ch = grp(g, K.seat[0], 0, K.seat[1] - 0.05);
  add(ch, M(boxG(0.46, 0.05, 0.44), wood), 0, 0.42, 0);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.19, 0.19]) add(ch, M(boxG(0.04, 0.42, 0.04), wood), sx, 0, sz);
  add(ch, M(boxG(0.46, 0.5, 0.04), wood), 0, 0.47, -0.21);
  const plate = plateOfFries(g, ...K.plate);
  add(g, M(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10).translate(0, 0.06, 0), mat('#f26a5a', { rough: 0.4 })), 0.42, K.top, -0.05);   // a ketchup bottle
  const glass = add(g, M(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 10, 1, true).translate(0, 0.055, 0), mat('#e8f6ff', { rough: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide })), -0.4, K.top, 0.05);
  const kitty = cat(g, ...K.cat, -0.5);
  const l = new THREE.PointLight(0xfff4e4, 3, 7, 1.6); l.position.set(0, 2.6, 1.0); g.add(l);
  const res = { g, clock, plate, cat: kitty, table: tg };
  if (white) whiten(W.scene);
  return res;
}
// after the BOOM: every surface (except the sky in the window, glows and the characters' faces) turns white with salt
export function whiten(root, { skip = [] } = {}) {
  const salt = SALT();
  root.traverse((o) => {
    if (!o.isMesh || skip.some((s) => o.name.startsWith(s))) return;
    if (o.material && (o.material.transparent || o.material.isMeshBasicMaterial)) return;
    if (Array.isArray(o.material)) return;
    o.material = salt;
  });
  return salt;
}
