// Exam reel sets + props (low-poly, flat bright colours like the semi-genius references). Places far apart:
//   the exam hall (x = 0), old England: the hill with the giant lump of graphite (x = 200), the school at sunset (x = 400)
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp } from './lib.js';
import { textTex, glowSprite, wallClock, flowerPot, tree } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const soft = (hex, amount = 5, o = {}) => mat(tex(paint(32, 32, (() => { const b = hexToRgb(hex), R = rng(o.seed ?? 3); return () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }; })())), o);
const planeAt = (parent, w, h, material, x, y, z, ry = 0) => { const m = add(parent, M(new THREE.PlaneGeometry(w, h), material, { cast: false }), x, y, z); m.rotation.y = ry; return m; };

// ------------------------------------------------------------------ layout of the exam hall
export const HALL = { cols: [-3.3, -1.1, 1.1, 3.3], rows: [-3.0, -1.4, 0.2, 1.8, 3.4], top: 0.74, you: [2, 2], back: [1, 4],
  tdesk: [0, -5.4], board: [0, 1.75, -6.95], clock: [0, 3.05, -6.92], sign: [3.3, 1.9, -6.93] };
export const deskPos = (c, r) => [HALL.cols[c], HALL.rows[r]];                     // desk centre (x, z)
export const seatPos = (c, r) => [HALL.cols[c], HALL.rows[r] + 0.5];               // student sits here, faces -z
const woodTex = (hex = '#c08a52', seed = 4) => { const b = hexToRgb(hex), R = rng(seed); return tex(paint(64, 64, (x, y) => { const s = Math.sin(y * 0.6 + Math.sin(x * 0.07) * 2.4) * 9 + (y % 16 === 0 ? -24 : 0) + (R() - 0.5) * 6; return [b[0] + s, b[1] + s * 0.8, b[2] + s * 0.6]; })); };

// ------------------------------------------------------------------ props
export function pencilBox(parent, { color = '#3a8ad8', bundle = false } = {}) {
  const g = new THREE.Group(); parent.add(g);
  const tin = mat(color, { rough: 0.35, metal: 0.3 }), inner = mat('#2a2e38', { rough: 0.6 });
  // a hollow tin: bottom + four walls (so the pencils and the bundle can be seen inside when it is open)
  add(g, M(boxG(0.26, 0.004, 0.1), tin));
  add(g, M(new THREE.BoxGeometry(0.25, 0.002, 0.09), inner), 0, 0.005, 0);
  for (const sz of [-1, 1]) add(g, M(boxG(0.26, 0.06, 0.004), tin), 0, 0, sz * 0.048);
  for (const sx of [-1, 1]) add(g, M(boxG(0.004, 0.06, 0.1), tin), sx * 0.128, 0, 0);
  const lid = grp(g, 0, 0.06, -0.05);
  add(lid, M(new THREE.BoxGeometry(0.26, 0.012, 0.1).translate(0, 0.006, 0.05), tin));
  add(lid, M(new THREE.BoxGeometry(0.06, 0.004, 0.03).translate(0, 0.014, 0.05), mat('#f2f2ee')));   // a little sticker
  const stuff = grp(g, 0, 0.012, 0);
  const pens = [];
  for (const [i, col] of [[0, '#f2c230'], [1, '#e8402a'], [2, '#3ab04a']].map((x) => x)) {
    const p = add(stuff, M(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 6).rotateZ(Math.PI / 2), mat(col)), -0.01, 0.006, -0.025 + i * 0.016);
    add(p, M(new THREE.ConeGeometry(0.005, 0.02, 6).rotateZ(-Math.PI / 2), mat('#e8c8a0')), 0.095, 0, 0); pens.push(p);
  }
  add(stuff, M(new THREE.BoxGeometry(0.035, 0.012, 0.02), mat('#f27a9a')), 0.09, 0.006, 0.02);
  g.userData = { lid, stuff, pens };
  if (bundle) { g.userData.bundle = tpBundle(stuff, 0.42); g.userData.bundle.position.y = -0.012; }
  return g;
}
// the toilet-paper bundle: a white crinkled package tied like a tiny present (no poop visible)
export function tpBundle(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g); g.scale.setScalar(s);
  const geo = new THREE.IcosahedronGeometry(0.06, 1); geo.scale(1.35, 0.75, 1.0);
  const p = geo.attributes.position, R = rng(17);
  for (let i = 0; i < p.count; i++) { const k = 1 + (R() - 0.5) * 0.16; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const tp = mat('#fbfbf6', { rough: 0.95 });
  const body = add(g, M(geo, tp), 0, 0.045, 0);
  const rib = mat('#f4f0e8', { rough: 0.95 });
  add(g, M(new THREE.TorusGeometry(0.07, 0.006, 4, 16).rotateY(Math.PI / 2), rib), 0, 0.045, 0).scale.set(1, 0.66, 1.0);
  add(g, M(new THREE.TorusGeometry(0.075, 0.006, 4, 16), rib), 0, 0.045, 0).scale.set(1.12, 0.6, 1);
  const bow = grp(g, 0, 0.095, 0);
  for (const sx of [-1, 1]) { const l = add(bow, M(new THREE.TorusGeometry(0.018, 0.006, 4, 10), rib), sx * 0.018, 0.008, 0); l.rotation.set(0, 0, sx * 0.5); }
  g.userData = { body, bow };
  return g;
}
export function tpRoll(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 16, 1, true), mat('#fbfbf6', { rough: 0.95, side: THREE.DoubleSide })));
  add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10, 1, true), mat('#c8a070', { side: THREE.DoubleSide })));
  add(g, M(new THREE.RingGeometry(0.02, 0.055, 16).rotateX(-Math.PI / 2), mat('#f2f2ec', { side: THREE.DoubleSide })), 0, 0.05, 0);
  return g;
}
export function tpSheet(parent, w = 0.22, l = 0.36) {
  const geo = new THREE.PlaneGeometry(w, l, 4, 6), p = geo.attributes.position, R = rng(5);
  for (let i = 0; i < p.count; i++) p.setZ(i, (R() - 0.5) * 0.008);
  geo.computeVertexNormals();
  const t = textTex(32, 64, (x, ww, h) => { x.fillStyle = '#fbfbf6'; x.fillRect(0, 0, ww, h); x.fillStyle = '#e4e4dc'; for (let y = 0; y < h; y += 16) x.fillRect(0, y, ww, 1); });
  const m = add(parent, M(geo, mat(t, { rough: 0.95, side: THREE.DoubleSide })));
  m.rotation.x = -Math.PI / 2;
  return m;
}
export function blob(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.IcosahedronGeometry(0.03, 1).scale(1, 1.3, 1), mat('#6a4022', { rough: 0.6 })));
  return g;
}
export function clipboard(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.22, 0.3, 0.008), mat('#b8844a', { rough: 0.6 })));
  const pt = textTex(32, 48, (x, w, h) => { x.fillStyle = '#fbfaf4'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a6a8a'; for (let y = 8; y < h - 4; y += 5) x.fillRect(4, y, w - 8 - (y % 3) * 3, 1); });
  add(g, M(new THREE.PlaneGeometry(0.19, 0.25), mat(pt, { flat: false })), 0, -0.015, 0.005);
  add(g, M(new THREE.BoxGeometry(0.08, 0.025, 0.02), mat('#c8ccd2', { metal: 0.7, rough: 0.3 })), 0, 0.14, 0.01);
  g.userData.grip = { pos: [0, -0.1, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function pencil(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), mat('#f2c230')));
  add(g, M(new THREE.ConeGeometry(0.004, 0.016, 6).rotateX(Math.PI), mat('#e8c8a0')), 0, -0.083, 0);
  add(g, M(new THREE.CylinderGeometry(0.0045, 0.0045, 0.012, 6), mat('#f27a9a')), 0, 0.08, 0);
  g.userData.grip = { pos: [0, -0.045, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}
export function ceilingFan(parent, x, y, z) {
  const g = grp(parent, x, y, z), m = mat('#f2f2ec', { rough: 0.5 }), dark = mat('#5a5a60', { rough: 0.4, metal: 0.4 });
  add(g, M(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6).translate(0, -0.175, 0), dark));
  add(g, M(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 12), dark), 0, -0.4, 0);
  const rot = grp(g, 0, -0.43, 0);
  for (let i = 0; i < 4; i++) { const b = add(rot, M(new THREE.BoxGeometry(0.62, 0.012, 0.13).translate(0.36, 0, 0), m)); b.rotation.y = i * Math.PI / 2; b.rotation.x = 0.08; }
  g.userData.rot = rot;
  return g;
}
function desk(parent, x, z, wood) {
  const g = grp(parent, x, 0, z), steel = mat('#5a6070', { rough: 0.5, metal: 0.4 });
  add(g, M(boxG(0.74, 0.04, 0.52), wood), 0, HALL.top - 0.04, 0);
  for (const sx of [-0.33, 0.33]) for (const sz of [-0.22, 0.22]) add(g, M(boxG(0.035, HALL.top - 0.04, 0.035), steel), sx, 0, sz);
  add(g, M(boxG(0.66, 0.03, 0.42), steel), 0, 0.5, 0);      // the shelf under the top
  // the chair behind (the student faces -z)
  const ch = grp(g, 0, 0, 0.52);
  add(ch, M(boxG(0.42, 0.04, 0.4), wood), 0, 0.44, 0);
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.17, 0.17]) add(ch, M(boxG(0.03, 0.44, 0.03), steel), sx, 0, sz);
  add(ch, M(boxG(0.42, 0.32, 0.03), wood), 0, 0.56, 0.19);
  for (const sx of [-0.18, 0.18]) add(ch, M(boxG(0.03, 0.46, 0.03), steel), sx, 0.44, 0.19);
  // exam paper
  const pt = textTex(32, 44, (c, w, h) => { c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a30'; c.fillRect(4, 4, 14, 2); c.fillStyle = '#7a8aa8'; for (let y = 10; y < h - 3; y += 4) c.fillRect(4, y, w - 8 - (y * 7 % 9), 1); });
  const pp = add(g, M(new THREE.PlaneGeometry(0.21, 0.29).rotateX(-Math.PI / 2), mat(pt, { flat: false }), { cast: false }), -0.04, HALL.top + 0.002, 0.04);
  pp.rotation.y = 0.08;
  return { g, chair: ch };
}

// ------------------------------------------------------------------ the exam hall
export function buildHall(W, { students = true, day2 = false } = {}) {
  const g = grp(W.scene, 0, 0, 0);
  const planks = tex(paint(64, 64, (() => { const R = rng(3); return (x, y) => { const r = Math.floor(y / 8), o = (r * 23) % 64; const e = y % 8 === 0 || (x + o) % 64 === 0 ? -30 : 0; const d = e + (R() - 0.5) * 8 + ((r * 37) % 11) - 5; return [178 + d, 132 + d * 0.8, 88 + d * 0.6]; }; })()));
  const fl = add(g, M(new THREE.PlaneGeometry(14, 16).rotateX(-Math.PI / 2), mat(planks, { rough: 0.6 }), { cast: false }), 0, 0, 0); fl.material.map.repeat.set(6, 7);
  const wallM = soft(day2 ? '#f2e2c8' : '#e4ecd8', 4), lower = soft(day2 ? '#c8a878' : '#8ab08a', 4);
  planeAt(g, 14, 4, wallM, 0, 2, -7); planeAt(g, 16, 4, wallM, -7, 2, 0, Math.PI / 2); planeAt(g, 16, 4, wallM, 7, 2, 0, -Math.PI / 2); planeAt(g, 14, 4, wallM, 0, 2, 8, Math.PI);
  for (const [w, x, z, ry] of [[14, 0, -6.98, 0], [16, -6.98, 0, Math.PI / 2], [16, 6.98, 0, -Math.PI / 2]]) planeAt(g, w, 1.0, lower, x, 0.5, z, ry);
  add(g, M(new THREE.PlaneGeometry(14, 16).rotateX(Math.PI / 2), mat('#f8f6f0'), { cast: false }), 0, 4.0, 0);
  // chalkboard + the big wall clock + the toilet sign (no text: a toilet icon with a red cross)
  const bd = textTex(128, 48, (c, w, h) => { c.fillStyle = '#2f5a44'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(10 + i * 22, 10 + i * 5); c.lineTo(40 + i * 20, 14 + i * 6); c.stroke(); } });
  add(g, M(new THREE.BoxGeometry(4.6, 1.6, 0.05), mat('#8a5a32')), HALL.board[0], HALL.board[1], -6.97);
  planeAt(g, 4.4, 1.4, mat(bd, { flat: false }), HALL.board[0], HALL.board[1], -6.94);
  add(g, M(new THREE.BoxGeometry(4.4, 0.05, 0.1), mat('#8a5a32')), HALL.board[0], HALL.board[1] - 0.72, -6.9);
  const clock = wallClock(g, { r: 0.38 }); clock.position.set(...HALL.clock);
  const st = textTex(256, 256, (c, w, h) => {
    c.scale(256 / 96, 256 / 96); w = 96; h = 96;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a2a30'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#2a6ad8';                                                              // a simple toilet icon
    c.fillRect(30, 30, 10, 26); c.beginPath(); c.ellipse(52, 56, 20, 9, 0, 0, 7); c.fill(); c.fillRect(40, 56, 22, 18); c.fillRect(34, 74, 34, 6);
    c.strokeStyle = '#e8202a'; c.lineWidth = 10; c.beginPath(); c.moveTo(16, 16); c.lineTo(80, 80); c.moveTo(80, 16); c.lineTo(16, 80); c.stroke();
  });
  st.magFilter = THREE.LinearFilter; st.minFilter = THREE.LinearFilter;
  const sign = planeAt(g, 0.7, 0.7, mat(st, { flat: false }), HALL.sign[0], HALL.sign[1], HALL.sign[2]);
  // windows on the left wall with daylight
  const sky = textTex(32, 48, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8ac8f4'); gr.addColorStop(1, '#e0f4fc'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#7ac86a'; c.beginPath(); c.arc(8, 46, 10, 0, 7); c.arc(24, 48, 9, 0, 7); c.fill(); });
  for (const z of [-4.2, -0.6, 3.0]) {
    planeAt(g, 1.9, 1.6, mat(sky, { emissive: '#ffffff', emissiveIntensity: 0.6, flat: false }), -6.97, 2.0, z, Math.PI / 2);
    for (const [w, h, y, dz] of [[0.08, 1.75, 2.0, -0.96], [0.08, 1.75, 2.0, 0.96], [0.08, 1.75, 2.0, 0]]) add(g, M(new THREE.BoxGeometry(0.06, h, w), mat('#f8f8f4')), -6.94, y, z + dz);
    for (const y of [1.2, 2.8, 2.0]) add(g, M(new THREE.BoxGeometry(0.06, 0.08, 2.0), mat('#f8f8f4')), -6.94, y, z);
  }
  // the teacher's desk + chair, a plant, a bin
  const tw = mat(woodTex('#a86a3a', 7), { rough: 0.6 });
  const td = grp(g, HALL.tdesk[0], 0, HALL.tdesk[1]);
  add(td, M(boxG(1.6, 0.76, 0.7), tw)); add(td, M(boxG(1.7, 0.04, 0.78), tw), 0, 0.76, 0);
  add(td, M(boxG(0.26, 0.06, 0.2), mat('#e8e4d8')), 0.45, 0.8, 0.05);
  const tch = grp(g, HALL.tdesk[0], 0, HALL.tdesk[1] - 0.65); add(tch, M(boxG(0.46, 0.05, 0.44), tw), 0, 0.45, 0); add(tch, M(boxG(0.46, 0.55, 0.05), tw), 0, 0.48, -0.2);
  for (const [x, z] of [[-5.9, -6.2], [5.9, -6.2]]) flowerPot(g, x, z, 3).scale.setScalar(1.6);
  // the ceiling fans
  const fans = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.0], [2.2, 2.0]].map(([x, z]) => ceilingFan(g, x, 4.0, z));
  // desks (+ chairs, exam papers, pencil boxes)
  const wood = mat(woodTex('#c08a52', 4), { rough: 0.6 });
  const desks = {}, boxes = {};
  HALL.cols.forEach((x, c) => HALL.rows.forEach((z, r) => {
    const d = desk(g, x, z, wood); desks[`${c},${r}`] = d;
    const isYou = c === HALL.you[0] && r === HALL.you[1];
    const b = pencilBox(g, { color: ['#3a8ad8', '#e8402a', '#3ab04a', '#f2a01e', '#8a4ad8'][(c * 5 + r) % 5], bundle: isYou });
    b.position.set(x + 0.2, HALL.top, z - 0.14); b.rotation.y = 0.05 * ((c + r) % 3 - 1); boxes[`${c},${r}`] = b;
  }));
  const l1 = new THREE.PointLight(0xfff4e4, 4, 16, 1.4); l1.position.set(0, 3.6, 0); g.add(l1);
  return { g, clock, sign, fans, desks, boxes, youBox: boxes[`${HALL.you[0]},${HALL.you[1]}`] };
}

// ------------------------------------------------------------------ old England: the hill with the giant lump of graphite (sepia)
export const ENG = { x0: 200 };
export function buildEngland(W) {
  const g = grp(W.scene, ENG.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), soft('#7a9a5a', 12), { cast: false }), 0, 0, -20);
  const hill = add(g, M(new THREE.SphereGeometry(9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.38, 1), soft('#6a8a4a', 14)), 0, -0.2, -14);
  // the dug pit + piles of dark earth
  add(g, M(new THREE.CylinderGeometry(1.7, 1.2, 0.5, 14), soft('#3a2a1e', 12)), 0, 0.06, -1.6);
  for (const [x, z, s] of [[-2.2, -0.6, 0.8], [2.0, -0.9, 0.7], [-1.4, 0.6, 0.5]]) add(g, M(new THREE.IcosahedronGeometry(s, 0).scale(1.3, 0.55, 1), soft('#4a3424', 14)), x, s * 0.3, z);
  // THE GIANT LUMP OF GRAPHITE: dark, shiny, glowing
  const lump = grp(g, 0, 0.55, -1.6);
  const lg = new THREE.IcosahedronGeometry(0.85, 1); const p = lg.attributes.position, R = rng(9);
  for (let i = 0; i < p.count; i++) { const k = 1 + (R() - 0.5) * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
  lg.computeVertexNormals();
  add(lump, M(lg, mat('#2a2c32', { metal: 0.7, rough: 0.25, emissive: '#3a4050', emissiveIntensity: 0.3 })));
  const glow = glowSprite(lump, [0, 0.1, 0], 4.5, 'rgba(255,240,200,0.9)', 0.6);
  const ll = new THREE.PointLight(0xfff0c8, 5, 8, 1.6); ll.position.set(0, 1.0, 0.8); lump.add(ll);
  // tools, a cart, an old fence, little old houses far away
  for (const [x, z, r] of [[1.6, 0.4, 0.4], [-1.9, 0.9, -0.6]]) { const t = grp(g, x, 0.05, z, r); add(t, M(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6).rotateZ(Math.PI / 2), soft('#8a6a4a', 8))); add(t, M(new THREE.BoxGeometry(0.06, 0.3, 0.05), mat('#6a6a70', { metal: 0.6 })), 0.5, 0, 0); }
  const cart = grp(g, 3.4, 0, -0.6, 0.4); add(cart, M(boxG(1.2, 0.5, 0.7), soft('#7a5a3a', 10)), 0, 0.35, 0); for (const sx of [-0.45, 0.45]) for (const sz of [-0.38, 0.38]) add(cart, M(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10).rotateX(Math.PI / 2), soft('#5a4a3a', 8)), sx, 0.22, sz);
  for (let i = 0; i < 6; i++) { const h = grp(g, -14 + i * 5.5, 0, -24 - (i % 2) * 4); add(h, M(boxG(3, 2.2, 2.6), soft('#e8dcc0', 6))); const rf = new THREE.CylinderGeometry(0.01, 2.3, 1.4, 4).rotateY(Math.PI / 4); rf.scale(1.1, 1, 0.9); add(h, M(rf.translate(0, 0.7, 0), soft('#8a5a3a', 8)), 0, 2.2, 0); }
  for (let i = 0; i < 8; i++) tree(g, -16 + i * 4.5, -14 - (i % 3) * 3, 1.4, i + 2);
  return { g, lump, glow };
}

// ------------------------------------------------------------------ the school at sunset (the last shot): green stink out of one window
export const SCH = { x0: 400, window: [0.0, 4.4, 0.06] };
export function buildSchool(W) {
  const g = grp(W.scene, SCH.x0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), soft('#6aa060', 12), { cast: false }), 0, 0, 10);
  add(g, M(new THREE.PlaneGeometry(4, 30).rotateX(-Math.PI / 2), soft('#c8b8a0', 6), { cast: false }), 0, 0.01, 15);
  const brick = soft('#c8785a', 10), trim = mat('#f4efe4', { rough: 0.6 });
  add(g, M(boxG(22, 6.4, 9), brick), 0, 0, -4.5);
  add(g, M(boxG(22.6, 0.4, 9.6), trim), 0, 6.4, -4.5);
  const rf = new THREE.CylinderGeometry(0.01, 13, 2.6, 4).rotateY(Math.PI / 4); rf.scale(1.25, 1, 0.55);
  add(g, M(rf.translate(0, 1.3, 0), soft('#5a6a8a', 8)), 0, 6.8, -4.5);
  const winWarm = mat('#ffd890', { emissive: '#ffb860', emissiveIntensity: 0.9, flat: false }), winDark = mat('#4a5a7a', { rough: 0.2, metal: 0.2 });
  const green = mat('#9af08a', { emissive: '#4ae05a', emissiveIntensity: 1.4, flat: false });
  let k = 0;
  for (const y of [1.7, 4.4]) for (let i = -4; i <= 4; i++) {
    const x = i * 2.3; if (y < 2 && i === 0) continue;
    const isGreen = Math.abs(x - SCH.window[0]) < 0.1 && Math.abs(y - SCH.window[1]) < 0.1;
    add(g, M(new THREE.BoxGeometry(1.5, 1.5, 0.08), trim), x, y, 0.02);
    add(g, M(new THREE.PlaneGeometry(1.3, 1.3), isGreen ? green : ((k++ % 3 === 0) ? winWarm : winDark), { cast: false }), x, y, 0.07);
    if (isGreen) glowSprite(g, [x, y, 0.4], 4.0, 'rgba(120,255,120,0.9)', 0.5);
  }
  add(g, M(boxG(2.0, 2.6, 0.2), mat('#7a4a2a')), 0, 0, 0.0); add(g, M(boxG(2.6, 0.3, 0.6), trim), 0, 2.6, 0.2);
  add(g, M(new THREE.CylinderGeometry(0.05, 0.05, 9, 6).translate(0, 4.5, 0), mat('#d8dce2', { metal: 0.6 })), 6.5, 0, 4);
  const flag = add(g, M(new THREE.PlaneGeometry(1.4, 0.9), mat('#e8402a', { side: THREE.DoubleSide })), 7.2, 8.4, 4);
  for (const [x, z, s] of [[-9, 4, 1.8], [9.5, 3, 2.0], [-13, 8, 2.2], [13, 9, 1.6], [-5, 12, 1.4], [6, 13, 1.5]]) tree(g, x, z, s, Math.round(x * 3));
  return { g, flag };
}
