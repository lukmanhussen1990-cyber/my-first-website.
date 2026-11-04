// Sets: cozy dining room, sunny park, rainy back yard with the dog house and
// YOU's bedroom behind the window. Everything is low-poly with pixel textures.
import * as THREE from 'three';
import { mat, mesh, bx, faceted } from './chars.js';
import { DT } from './dtex.js';
import { rng, makeCanvas, toTex, pixelText } from './pixel.js';

export const SET = {
  home: new THREE.Vector3(0, 0, 0),
  park: new THREE.Vector3(60, 0, 0),
  yard: new THREE.Vector3(120, 0, 0),
};
// dining table (home-local); rot = the way the sitter faces
export const TABLE = {
  y: 0.76,
  seat: {
    dad: { x: -0.55, z: -0.84, rot: 0 },
    mom: { x: 0.55, z: -0.84, rot: 0 },
    sis: { x: -0.55, z: 0.84, rot: Math.PI },
    you: { x: 0.55, z: 0.84, rot: Math.PI },
    dog: { x: 1.62, z: 0, rot: -Math.PI / 2 },
  },
};
export const DOGHOUSE = { x: 1.05, z: 4.4 };   // yard-local, door faces the house (-z)
export const BED = { x: 0, z: -1.15, top: 0.6 };  // yard-local (the bedroom is behind the yard wall)

const add = (p, m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; };
const plane = (w, h, m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.receiveShadow = true; return p; };
const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
const basic = (map) => new THREE.MeshBasicMaterial({ map });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

export function buildSets(scene) {
  const W = {};
  W.hemi = new THREE.HemisphereLight(0xffe9cc, 0x5a4030, 0.8); scene.add(W.hemi);
  W.amb = new THREE.AmbientLight(0xffd8a8, 0.12); scene.add(W.amb);
  W.sun = new THREE.DirectionalLight(0xffdcae, 1.2);
  W.sun.castShadow = true; W.sun.shadow.mapSize.set(2048, 2048); W.sun.shadow.bias = -0.0006; W.sun.shadow.normalBias = 0.03;
  scene.add(W.sun, W.sun.target);
  W.sunAt = (c, size = 8, off = [3, 10, 4]) => {
    W.sun.target.position.copy(c); W.sun.position.copy(c).add(new THREE.Vector3(...off));
    Object.assign(W.sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 60 });
    W.sun.shadow.camera.updateProjectionMatrix();
  };
  buildHome(scene, W);
  buildPark(scene, W);
  buildYard(scene, W);
  return W;
}

function frame(parent, tex, w, h, x, y, z, ry, col = 0x5a3a20) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  add(g, bx(w + 0.07, h + 0.07, 0.035, mat(col)), 0, 0, 0);
  add(g, plane(w, h, mat(tex, { flatShading: false, roughness: 0.6 })), 0, 0, 0.02);
  return g;
}
function chair(parent, x, z, rot, wood, cushion = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  add(g, bx(0.46, 0.05, 0.46, wood), 0, 0.455, 0);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(g, bx(0.045, 0.45, 0.045, wood), lx, 0.225, lz);
  for (const lx of [-0.2, 0.2]) add(g, bx(0.045, 0.6, 0.045, wood), lx, 0.78, -0.21);
  add(g, bx(0.46, 0.09, 0.045, wood), 0, 1.04, -0.21);
  for (const lx of [-0.09, 0, 0.09]) add(g, bx(0.035, 0.42, 0.03, wood), lx, 0.75, -0.21);
  if (cushion) add(g, mesh(new THREE.BoxGeometry(0.42, cushion, 0.42), mat(0xc8463a)), 0, 0.48 + cushion / 2, 0.01);
  return g;
}
function spaghetti(parent, x, z, R) {
  const g = new THREE.Group(); g.position.set(x, 0.762, z); parent.add(g);
  add(g, mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.018, 14), mat(0xfafaf4)), 0, 0.009, 0);
  add(g, mesh(faceted(0.09, 70 + Math.floor(R() * 20), [1.0, 0.32, 1.0], 1, 0.12), mat(0xf2d27a)), 0, 0.035, 0);
  add(g, mesh(faceted(0.05, 90, [1.0, 0.35, 1.0], 1, 0.2), mat(0xc8321e)), 0.01, 0.06, 0);
  for (let k = 0; k < 3; k++) add(g, mesh(faceted(0.026, 95 + k, [1, 0.9, 1], 0, 0.15), mat(0x6a3a1e)), Math.cos(k * 2.1) * 0.045, 0.07, Math.sin(k * 2.1) * 0.045);
  return g;
}
function cutlery(parent, x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0.765, z); g.rotation.y = rot; parent.add(g);
  const steel = mat(0xc8ccd4, { metalness: 0.6, roughness: 0.3 });
  add(g, bx(0.016, 0.006, 0.17, steel), -0.2, 0, 0);
  add(g, bx(0.016, 0.006, 0.18, steel), 0.2, 0, 0);
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
  add(g, mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10), glass, false), 0.22, 0.06, -0.15);
  add(g, mesh(new THREE.CylinderGeometry(0.031, 0.027, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.45, roughness: 0.1 }), false), 0.22, 0.035, -0.15);
}

// ================================================================ dining room
function buildHome(scene, W) {
  const H = new THREE.Group(); H.position.copy(SET.home); scene.add(H);
  const R = rng(3);
  const X0 = -4, X1 = 4, Z0 = -3.2, Z1 = 3.2, HT = 2.8, WS = 0.95;
  add(H, plane(8, 6.4, mat(rep(DT.floor, 7, 6), { flatShading: false })), 0, 0, 0, -Math.PI / 2);
  add(H, plane(3.6, 2.6, mat(DT.rug, { flatShading: false })), 0.2, 0.006, 0, -Math.PI / 2);
  const rail = mat(0x5a3a20);
  const wall = (len, x, z, ry) => {
    add(H, plane(len, HT - WS, mat(rep(DT.wallpaper, len / 0.7, (HT - WS) / 0.7), { flatShading: false })), x, WS + (HT - WS) / 2, z, 0, ry);
    add(H, plane(len, WS, mat(rep(DT.wainscot, len / 0.8, 1), { flatShading: false })), x, WS / 2, z, 0, ry);
    add(H, bx(len, 0.06, 0.05, rail), x, WS, z, 0, ry);
    add(H, bx(len, 0.1, 0.03, rail), x, 0.05, z, 0, ry);
    add(H, bx(len, 0.08, 0.06, mat(0xf2e2c8)), x, HT - 0.04, z, 0, ry);
  };
  wall(8, 0, Z0, 0); wall(8, 0, Z1, Math.PI); wall(6.4, X0, 0, Math.PI / 2); wall(6.4, X1, 0, -Math.PI / 2);
  add(H, plane(8, 6.4, mat(0xf6ead6, { flatShading: false })), 0, HT, 0, Math.PI / 2);

  // back wall: sideboard + family photos (behind dad and mom)
  const wood = mat(rep(DT.tableWood, 1, 1));
  add(H, bx(2.2, 0.82, 0.45, wood), 0, 0.41, Z0 + 0.24);
  for (const x of [-0.55, 0.55]) add(H, bx(1.0, 0.6, 0.01, mat(0x6a3e1e)), x, 0.42, Z0 + 0.47);
  for (const x of [-0.1, 0.1]) add(H, bx(0.03, 0.06, 0.03, mat(0xd9b24a)), x, 0.5, Z0 + 0.48);
  const vase = add(H, mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8), mat(0x3a7ad0)), -0.75, 0.97, Z0 + 0.24);
  for (let k = 0; k < 5; k++) add(H, mesh(faceted(0.06, 300 + k, [1, 1, 1], 0), mat([0xff8fb8, 0xffd23d, 0xffffff][k % 3]), false), -0.75 + (R() - 0.5) * 0.16, 1.2 + R() * 0.1, Z0 + 0.24 + (R() - 0.5) * 0.1);
  W.sideLamp = new THREE.PointLight(0xffc880, 2.2, 4, 1.6); W.sideLamp.position.set(0.8, 1.35, Z0 + 0.35); H.add(W.sideLamp);
  add(H, mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), mat(0xd9b24a)), 0.8, 0.97, Z0 + 0.24);
  add(H, mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 10, 1, true), mat(DT.lampShade, { side: THREE.DoubleSide, emissive: 0x6a4010 })), 0.8, 1.22, Z0 + 0.24);
  const photos = [[-1.15, 1.72, 0.36, 0.45, 0], [-0.55, 1.95, 0.32, 0.4, 1], [0.05, 1.7, 0.42, 0.52, 2], [0.62, 1.98, 0.3, 0.38, 3], [1.15, 1.7, 0.34, 0.42, 1]];
  for (const [x, y, w, h, i] of photos) frame(H, DT.photos[i], w, h, x, y, Z0 + 0.03, 0, [0x5a3a20, 0xd9b24a, 0x2a2a2a][i % 3]);
  // front wall: window with curtains, floor lamp, plant, clock (behind YOU and the sister)
  const win = new THREE.Group(); win.position.set(-0.9, 1.55, Z1 - 0.02); win.rotation.y = Math.PI; H.add(win);
  add(win, plane(1.3, 1.1, basic(DT.nightWindow)), 0, 0, -0.005);
  for (const [w, h, x, y] of [[1.42, 0.07, 0, 0.58], [1.42, 0.07, 0, -0.58], [0.07, 1.2, 0.68, 0], [0.07, 1.2, -0.68, 0], [0.04, 1.1, 0, 0], [1.3, 0.04, 0, 0]]) add(win, bx(w, h, 0.05, mat(0xf4efe4)), x, y, 0.01);
  add(win, bx(1.55, 0.06, 0.16, mat(0xf4efe4)), 0, -0.62, 0.06);
  for (const s of [-1, 1]) add(win, mesh(new THREE.BoxGeometry(0.42, 1.6, 0.05), mat(DT.curtain)), s * 0.9, -0.05, 0.05);
  add(win, bx(2.3, 0.05, 0.06, mat(0x5a3a20)), 0, 0.8, 0.08);
  const fl = new THREE.Group(); fl.position.set(-2.55, 0, Z1 - 0.45); H.add(fl);
  add(fl, mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 10), mat(0x2a2a2a)), 0, 0.02, 0);
  add(fl, mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6), mat(0x2a2a2a)), 0, 0.77, 0);
  add(fl, mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 10, 1, true), mat(DT.lampShade, { side: THREE.DoubleSide, emissive: 0x8a5a20 })), 0, 1.58, 0);
  W.floorLamp = new THREE.PointLight(0xffc070, 3.0, 5, 1.6); W.floorLamp.position.set(-2.55, 1.5, Z1 - 0.45); H.add(W.floorLamp);
  const pot = new THREE.Group(); pot.position.set(1.7, 0, Z1 - 0.4); H.add(pot);
  add(pot, mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 8), mat(0xc8643a)), 0, 0.2, 0);
  for (let k = 0; k < 7; k++) { const l = mesh(faceted(0.16, 120 + k, [0.6, 1.4, 0.6], 0), mat([0x3f8f3a, 0x56a84a][k % 2])); l.position.set(Math.cos(k) * 0.12, 0.6 + (k % 3) * 0.18, Math.sin(k) * 0.12); l.rotation.set(Math.sin(k) * 0.5, k, Math.cos(k) * 0.5); pot.add(l); }
  const clock = new THREE.Group(); clock.position.set(0.6, 2.15, Z1 - 0.03); clock.rotation.y = Math.PI; H.add(clock);
  add(clock, mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), mat(0x5a3a20)), 0, 0, 0, Math.PI / 2);
  add(clock, mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.045, 14), mat(0xfbf6ea)), 0, 0, 0.005, Math.PI / 2);
  add(clock, bx(0.012, 0.1, 0.01, mat(0x111111)), 0, 0.04, 0.03); add(clock, bx(0.07, 0.012, 0.01, mat(0x111111)), 0.03, 0, 0.03);
  // right wall (behind the dog): his portrait, a shelf with a trophy, his empty bed, a kitchen door
  frame(H, DT.photos[1], 0.42, 0.52, X1 - 0.03, 1.72, 0.05, -Math.PI / 2, 0xd9b24a);
  add(H, bx(0.22, 0.04, 0.9, wood), X1 - 0.11, 1.32, -1.25);
  add(H, mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.14, 8), mat(0xd9b24a, { metalness: 0.6, roughness: 0.3 })), X1 - 0.11, 1.42, -1.45);
  add(H, mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.04, 8), mat(0x5a3a20)), X1 - 0.11, 1.36, -1.45);
  add(H, mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 12), mat(0x8a4a6a)), X1 - 0.5, 0.1, 1.6, Math.PI / 2);
  add(H, mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), mat(0xd9a0c0)), X1 - 0.5, 0.05, 1.6);
  const door = new THREE.Group(); door.position.set(X1 - 0.02, 0, -2.0); door.rotation.y = -Math.PI / 2; H.add(door);
  add(door, bx(0.9, 2.1, 0.04, mat(0x8a5a33)), 0, 1.05, 0);
  for (const [w, h, x, y] of [[0.08, 2.18, 0.49, 1.09], [0.08, 2.18, -0.49, 1.09], [1.06, 0.08, 0, 2.18]]) add(door, bx(w, h, 0.06, mat(0xf2e2c8)), x, y, 0.01);
  add(door, mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(0xd9b24a, { metalness: 0.6 })), -0.34, 1.0, 0.04);
  // left wall: painting + cabinet
  frame(H, DT.photos[3], 0.8, 0.62, X0 + 0.03, 1.8, -0.3, Math.PI / 2, 0x3a2a1a);
  add(H, bx(0.45, 1.6, 1.0, wood), X0 + 0.24, 0.8, 1.6);

  // the table
  const tw = mat(rep(DT.tableWood, 3, 1.5));
  add(H, bx(2.5, 0.06, 1.15, tw), 0, 0.73, 0);
  for (const [x, z] of [[-1.15, -0.48], [1.15, -0.48], [-1.15, 0.48], [1.15, 0.48]]) add(H, bx(0.08, 0.7, 0.08, tw), x, 0.35, z);
  add(H, plane(2.2, 0.36, mat(DT.runner, { flatShading: false })), 0, 0.761, 0, -Math.PI / 2);
  const cw = mat(rep(DT.tableWood, 1, 1));
  W.chairs = {};
  for (const [k, s] of Object.entries(TABLE.seat)) W.chairs[k] = chair(H, s.x, s.z, s.rot, cw, k === 'dog' ? 0.12 : 0);
  chair(H, -1.62, 0, Math.PI / 2, cw);
  // place settings
  for (const k of ['dad', 'you', 'sis']) { const s = TABLE.seat[k]; const pz = s.z * 0.42; spaghetti(H, s.x, pz, R); cutlery(H, s.x, pz, s.rot); }
  { const s = TABLE.seat.mom; const pz = s.z * 0.42; cutlery(H, s.x, pz, s.rot);
    const bowl = new THREE.Group(); bowl.position.set(s.x, 0.762, pz); H.add(bowl);
    add(bowl, mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.018, 14), mat(0xfafaf4)), 0, 0.009, 0);
    add(bowl, mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.07, 12, 1, true), mat(0xfafaf4, { side: THREE.DoubleSide })), 0, 0.05, 0);
    add(bowl, mesh(new THREE.CircleGeometry(0.092, 12), mat(0xe8963a)), 0, 0.07, 0, -Math.PI / 2);
    W.momBowl = bowl;
    const saucer = add(H, mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 12), mat(0xfafaf4)), s.x + 0.24, 0.768, pz + 0.1);
    W.cupSpot = new THREE.Vector3(s.x + 0.24, 0.775, pz + 0.1);
  }
  { // the dog's place: a shiny bowl of kibble on a placemat
    const s = TABLE.seat.dog; const px = 0.95;
    add(H, plane(0.36, 0.28, mat(0xd94a4a, { flatShading: false })), px, 0.763, 0, -Math.PI / 2, 0, Math.PI / 2);
    const b = new THREE.Group(); b.position.set(px, 0.765, 0); H.add(b);
    add(b, mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.08, 12, 1, true), mat(0xc8ccd4, { metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide })), 0, 0.04, 0);
    add(b, mesh(new THREE.CircleGeometry(0.1, 12), mat(0xc8ccd4, { metalness: 0.7, roughness: 0.25 })), 0, 0.002, 0, -Math.PI / 2);
    for (let k = 0; k < 14; k++) add(b, bx(0.03, 0.02, 0.03, mat([0x8a4a1e, 0x6a3a16][k % 2]), false), (R() - 0.5) * 0.15, 0.06 + R() * 0.02, (R() - 0.5) * 0.15, 0, R() * 3);
  }
  // centre: bread, salad, pitcher, candles
  const bread = new THREE.Group(); bread.position.set(-0.2, 0.762, 0.05); H.add(bread);
  add(bread, mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.08, 10, 1, true), mat(0xc9a06a, { side: THREE.DoubleSide })), 0, 0.04, 0);
  for (let k = 0; k < 4; k++) add(bread, mesh(faceted(0.05, 130 + k, [1.5, 0.8, 1], 0), mat(0xd9a05a)), (k % 2 - 0.5) * 0.09, 0.08, (k > 1 ? 1 : -1) * 0.04, 0, k);
  const salad = new THREE.Group(); salad.position.set(0.3, 0.762, -0.05); H.add(salad);
  add(salad, mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 12, 1, true), mat(0xffffff, { side: THREE.DoubleSide })), 0, 0.05, 0);
  for (let k = 0; k < 9; k++) add(salad, mesh(faceted(0.05, 140 + k, [1, 0.6, 1], 0), mat([0x5fb04a, 0x7ad05a, 0xe84a3a][k % 3])), Math.cos(k * 2.4) * 0.07, 0.09, Math.sin(k * 2.4) * 0.07);
  const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
  add(H, mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 10), glassM, false), -0.7, 0.88, 0.12);
  W.candles = [];
  for (const x of [0.75, -0.95]) {
    add(H, mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 8), mat(0xd9b24a, { metalness: 0.6 })), x, 0.775, -0.15);
    add(H, mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), mat(0xfff8e6)), x, 0.89, -0.15);
    W.candles.push(add(H, mesh(new THREE.ConeGeometry(0.018, 0.05, 6), glow(0xffd36a), false), x, 1.015, -0.15));
  }
  // pendant lamp over the table
  add(H, mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4), mat(0x222222)), 0, HT - 0.4, 0);
  add(H, mesh(new THREE.CylinderGeometry(0.12, 0.42, 0.3, 12, 1, true), mat(0x2f5a4a, { side: THREE.DoubleSide, roughness: 0.6 })), 0, 1.86, 0);
  add(H, mesh(new THREE.SphereGeometry(0.07, 8, 6), glow(0xfff0c0), false), 0, 1.76, 0);
  W.pendant = new THREE.PointLight(0xffd29a, 6.5, 7, 1.4); W.pendant.position.set(0, 1.68, 0); H.add(W.pendant);
}

// ================================================================ park (sunny flashback)
function tree(parent, x, z, s, R) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  add(g, mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.0, 7), mat(rep(DT.bark, 1, 2))), 0, 1.0, 0);
  const greens = [0x4f9a3a, 0x5fb04a, 0x3f8a32];
  for (let k = 0; k < 3; k++) add(g, mesh(faceted(1.0 - k * 0.15, 200 + Math.floor(R() * 100), [1, 0.9, 1], 1, 0.22), mat(greens[k])), (R() - 0.5) * 0.6, 2.4 + k * 0.55, (R() - 0.5) * 0.6);
  return g;
}
function buildPark(scene, W) {
  const P = new THREE.Group(); P.position.copy(SET.park); scene.add(P);
  const R = rng(17);
  add(P, plane(90, 90, mat(rep(DT.grass, 36, 36), { flatShading: false })), 0, 0, 0, -Math.PI / 2);
  add(P, plane(90, 2.0, mat(rep(DT.path, 45, 1), { flatShading: false })), 0, 0.008, 0, -Math.PI / 2);
  for (const z of [-1.04, 1.04]) add(P, bx(90, 0.05, 0.08, mat(0xb8b0a0)), 0, 0.02, z);
  for (const [x, z, s] of [[-9, -4.5, 1.1], [-3.5, -5.5, 1.3], [3, -4.2, 1.0], [8.5, -5.8, 1.25], [14, -4.5, 1.1], [-14, -5, 1.2], [-6, 4.6, 1.15], [1.5, 5.8, 1.3], [7, 4.4, 1.0], [12.5, 5.5, 1.2], [-12, 5.2, 1.1], [19, -6, 1.3], [-19, 6, 1.3], [0, -9, 1.5], [-7, -10, 1.4], [9, -11, 1.6]]) tree(P, x, z, s, R);
  for (let k = 0; k < 18; k++) add(P, mesh(faceted(0.45 + R() * 0.3, 260 + k, [1.3, 0.7, 1], 1, 0.2), mat([0x4a9a3a, 0x3f8a32][k % 2])), -20 + k * 2.4 + R(), 0.25, (k % 2 ? -1 : 1) * (2.4 + R() * 1.2));
  for (let k = 0; k < 60; k++) add(P, bx(0.06, 0.05, 0.06, mat([0xff5a7a, 0xffe35a, 0xffffff, 0xc79bff][k % 4]), false), -18 + R() * 36, 0.04, (k % 2 ? -1 : 1) * (1.4 + R() * 2.5));
  // bench
  const bench = new THREE.Group(); bench.position.set(1.9, 0, -1.55); P.add(bench);
  const bw = mat(rep(DT.benchWood, 2, 1)), iron = mat(0x2a2a2e);
  for (const z of [-0.1, 0.05, 0.2]) add(bench, bx(1.8, 0.05, 0.12, bw), 0, 0.46, z);
  for (const y of [0.65, 0.82]) add(bench, bx(1.8, 0.12, 0.04, bw), 0, y, -0.2, -0.15);
  for (const x of [-0.8, 0.8]) { add(bench, bx(0.06, 0.46, 0.4, iron), x, 0.23, 0.05); add(bench, bx(0.06, 0.5, 0.05, iron), x, 0.7, -0.22); }
  for (const x of [-6, 9]) {
    add(P, mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), iron), x, 1.6, -1.35);
    add(P, mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 6), mat(0xfff6c8, { emissive: 0x5a5020 })), x, 3.25, -1.35);
  }
  // hills + clouds
  for (let k = 0; k < 7; k++) add(P, mesh(faceted(9 + R() * 5, 280 + k, [1.6, 0.5, 1], 1, 0.15), mat(0x6ab44a)), -40 + k * 13, -1.5, -32 - R() * 6);
  W.clouds = [];
  for (let k = 0; k < 8; k++) { const c = add(P, mesh(faceted(1.6 + R(), 300 + k, [1.8, 0.7, 1], 1, 0.15), mat(0xffffff, { emissive: 0x9aa8b8 })), -36 + k * 10, 13 + R() * 4, -28 - R() * 8); W.clouds.push(c); }
  // a trash bin next to the bench
  add(P, mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 8), mat(0x2f6a3a)), 3.25, 0.35, -1.5);
}

// ================================================================ back yard at night (rain) + YOU's bedroom
function buildYard(scene, W) {
  const Y = new THREE.Group(); Y.position.copy(SET.yard); scene.add(Y);
  const R = rng(29);
  const WX = 0.8, WY0 = 0.78, WY1 = 1.95, T = 0.18, WALLH = 3.2;
  // ---- outside
  add(Y, plane(24, 18, mat(rep(DT.mudGrass, 12, 9), { flatShading: false })), 0, 0, 9, -Math.PI / 2);
  const sid = (w, h) => mat(rep(DT.siding, w / 1.2, h / 1.2), { flatShading: false });
  const out = (w, h, x, y) => add(Y, plane(w, h, sid(w, h)), x, y, T / 2);
  out(7.2, WALLH, -(WX + 3.6), WALLH / 2); out(7.2, WALLH, WX + 3.6, WALLH / 2);
  out(2 * WX, WY0, 0, WY0 / 2); out(2 * WX, WALLH - WY1, 0, (WALLH + WY1) / 2);
  add(Y, bx(16, 0.25, 1.0, mat(0x3a3a46)), 0, WALLH + 0.1, 0.35);
  add(Y, bx(16, 0.12, 0.25, mat(0xf2f2ee)), 0, 0.06, T / 2 + 0.1);
  // window frame + glass (shared by both sides)
  const wf = mat(0xf4f1ea);
  for (const [w, h, x, y] of [[2 * WX + 0.16, 0.08, 0, WY1 + 0.04], [2 * WX + 0.16, 0.08, 0, WY0 - 0.04], [0.08, WY1 - WY0, WX + 0.04, (WY0 + WY1) / 2], [0.08, WY1 - WY0, -WX - 0.04, (WY0 + WY1) / 2], [0.05, WY1 - WY0, 0, (WY0 + WY1) / 2]]) add(Y, bx(w, h, T + 0.04, wf), x, y, 0);
  add(Y, bx(2 * WX + 0.3, 0.05, T + 0.2, wf), 0, WY0 - 0.08, 0.05);
  const glassM = new THREE.MeshStandardMaterial({ color: 0xa8c8e8, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  add(Y, plane(2 * WX, WY1 - WY0, glassM), 0, (WY0 + WY1) / 2, 0);
  W.windowLight = new THREE.PointLight(0xffc070, 4.5, 7, 1.5); W.windowLight.position.set(0, 1.4, 0.9); Y.add(W.windowLight);
  W.kennelLight = new THREE.PointLight(0xffb070, 2.2, 3.2, 1.6); W.kennelLight.position.set(DOGHOUSE.x - 0.2, 1.2, DOGHOUSE.z - 1.7); Y.add(W.kennelLight);
  // dog house (door faces the house)
  const dh = new THREE.Group(); dh.position.set(DOGHOUSE.x, 0, DOGHOUSE.z); dh.rotation.y = Math.PI; Y.add(dh);
  const kw = mat(rep(DT.kennel, 1.5, 1.5)), inner = mat(0x2a1a14), trim = mat(0xf2efe6);
  const DW = 1.5, DD = 1.6, DH = 1.25, DOORW = 0.78, DOORH = 1.08;
  add(dh, bx(DW + 0.1, 0.1, DD + 0.1, mat(0x5a3a22)), 0, 0.05, 0);
  add(dh, bx(DW, DH, 0.08, kw), 0, DH / 2, -DD / 2);
  for (const s of [-1, 1]) add(dh, bx(0.08, DH, DD, kw), s * DW / 2, DH / 2, 0);
  const side = (DW - DOORW) / 2;
  for (const s of [-1, 1]) add(dh, bx(side, DH, 0.08, kw), s * (DOORW / 2 + side / 2), DH / 2, DD / 2);
  add(dh, bx(DOORW, DH - DOORH, 0.08, kw), 0, DOORH + (DH - DOORH) / 2, DD / 2);
  for (const [w, h, x, y] of [[0.07, DOORH, DOORW / 2 + 0.035, DOORH / 2], [0.07, DOORH, -DOORW / 2 - 0.035, DOORH / 2], [DOORW + 0.14, 0.07, 0, DOORH + 0.035]]) add(dh, bx(w, h, 0.1, trim), x, y, DD / 2 + 0.01);
  add(dh, plane(DW - 0.1, DH - 0.1, inner), 0, DH / 2, -DD / 2 + 0.05);
  for (const s of [-1, 1]) add(dh, plane(DD - 0.1, DH - 0.1, inner), s * (DW / 2 - 0.05), DH / 2, 0, 0, -s * Math.PI / 2);
  // gables + roof
  const tri = new THREE.Shape(); tri.moveTo(-DW / 2, 0); tri.lineTo(DW / 2, 0); tri.lineTo(0, 0.62); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
  for (const z of [DD / 2 - 0.04, -DD / 2 - 0.04]) add(dh, mesh(tg, kw), 0, DH, z);
  const slope = Math.atan2(0.62, DW / 2), rl = Math.hypot(DW / 2, 0.62) + 0.22;
  for (const s of [-1, 1]) add(dh, bx(rl, 0.07, DD + 0.35, mat(rep(DT.shingles, 2, 2))), s * (DW / 4 + 0.02), DH + 0.33, 0, 0, 0, -s * slope);
  add(dh, bx(0.1, 0.1, DD + 0.4, mat(0x2a2a34)), 0, DH + 0.66, 0);
  // name plate: DOG (crossed out) -> YOU
  {
    const [c, g] = makeCanvas(40, 20);
    g.fillStyle = '#f6efd8'; g.fillRect(0, 0, 40, 20); g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, 40, 1); g.fillRect(0, 19, 40, 1); g.fillRect(0, 0, 1, 20); g.fillRect(39, 0, 1, 20);
    pixelText(g, 'DOG', 20, 2, 8, 0x222222, 'center');
    g.fillStyle = '#e02a2a'; g.fillRect(6, 5, 28, 2);
    pixelText(g, 'YOU', 20, 11, 8, 0xe02a2a, 'center');
    add(dh, plane(0.46, 0.23, mat(toTex(c), { flatShading: false })), 0, DOORH + 0.29, DD / 2 + 0.07);
  }
  const bowl = add(Y, mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 10), mat(0xc83a3a)), DOGHOUSE.x - 1.05, 0.04, DOGHOUSE.z - 1.15);
  W.dogHouse = dh;
  // fence, tree, puddles
  const fw = mat(rep(DT.fence, 6, 1));
  add(Y, bx(18, 1.6, 0.06, fw), 0, 0.8, 12.5);
  for (const s of [-1, 1]) add(Y, bx(0.06, 1.6, 12.4, fw), s * 9, 0.8, 6.3);
  for (let k = -8; k <= 8; k++) add(Y, bx(0.12, 1.75, 0.1, mat(0x6a4a2a)), k, 0.87, 12.45);
  tree(Y, -4.2, 7.5, 1.1, R);
  tree(Y, 5.8, 9.5, 1.3, R);
  const pud = new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.08, metalness: 0.6 });
  for (const [x, z, r] of [[-0.6, 3.0, 0.5], [2.4, 2.4, 0.35], [-1.8, 5.6, 0.6], [0.4, 6.4, 0.45]]) add(Y, mesh(new THREE.CircleGeometry(r, 10), pud, false), x, 0.012, z, -Math.PI / 2);
  // rain: line streaks re-placed every frame (pure function of t)
  const N = 2200, pos = new Float32Array(N * 6);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb8d4ff, transparent: true, opacity: 0.55, depthWrite: false }));
  rain.frustumCulled = false; rain.renderOrder = 8; Y.add(rain);
  const seeds = Array.from({ length: N }, () => [R(), R(), R(), R()]);
  W.rain = rain;
  W.rainAt = (t, on = 1) => {
    rain.visible = on > 0; rain.material.opacity = 0.55 * on;
    for (let i = 0; i < N; i++) {
      const [a, b, c, d] = seeds[i];
      const x = -7 + a * 14, z = 0.25 + b * 12.5;
      const y = 6.5 - ((t * (8.5 + d * 2) + c * 6.5) % 6.5);
      const L = 0.28 + d * 0.12;
      pos.set([x, y, z, x + 0.04, y + L, z], i * 6);
    }
    rg.attributes.position.needsUpdate = true;
  };
  W.rainAt(0, 0);
  // ---- bedroom (behind the wall, z < 0)
  const BX = 2.4, BZ = -3.6, BH = 2.6;
  add(Y, plane(2 * BX, -BZ, mat(rep(DT.carpet, 4, 3), { flatShading: false })), 0, 0, BZ / 2, -Math.PI / 2);
  const bw = (w, h) => mat(rep(DT.bedWall, w / 0.8, h / 0.8), { flatShading: false });
  const inn = (w, h, x, y) => add(Y, plane(w, h, bw(w, h)), x, y, -T / 2, 0, Math.PI);
  inn(BX - WX, BH, -(WX + (BX - WX) / 2), BH / 2); inn(BX - WX, BH, WX + (BX - WX) / 2, BH / 2);
  inn(2 * WX, WY0, 0, WY0 / 2); inn(2 * WX, BH - WY1, 0, (BH + WY1) / 2);
  add(Y, plane(2 * BX, BH, bw(2 * BX, BH)), 0, BH / 2, BZ);
  for (const s of [-1, 1]) add(Y, plane(-BZ, BH, bw(-BZ, BH)), s * BX, BH / 2, BZ / 2, 0, -s * Math.PI / 2);
  add(Y, plane(2 * BX, -BZ, mat(0xe8e4f0, { flatShading: false })), 0, BH, BZ / 2, Math.PI / 2);
  // bed: headboard under the window, the dog sleeps facing into the room
  const bed = new THREE.Group(); bed.position.set(BED.x, 0, BED.z); Y.add(bed);
  add(bed, bx(1.15, 0.32, 2.05, mat(0x6a4a2e)), 0, 0.2, 0);
  add(bed, bx(1.08, 0.16, 1.98, mat(0xf6f6f2)), 0, 0.44, 0);
  add(bed, bx(1.25, 0.95, 0.08, mat(0x6a4a2e)), 0, 0.48, 1.03);
  add(bed, bx(1.25, 0.55, 0.08, mat(0x6a4a2e)), 0, 0.3, -1.03);
  W.pillow = add(bed, mesh(faceted(0.3, 401, [1.45, 0.35, 0.8], 1, 0.08), mat(0xffffff)), 0, 0.62, 0.68);
  W.blanket = add(bed, bx(1.18, 0.12, 1.45, mat(rep(DT.blanket, 2, 2.5))), 0, 0.55, -0.3);
  W.blanketLump = add(bed, mesh(faceted(0.36, 402, [1.5, 0.62, 1.9], 1, 0.07), mat(rep(DT.blanket, 2, 2))), 0, 0.6, -0.12);
  const ns = new THREE.Group(); ns.position.set(-1.0, 0, 0.62 + BED.z + 0.25); Y.add(ns);
  add(ns, bx(0.45, 0.55, 0.4, mat(0x8a5a33)), 0, 0.275, 0);
  add(ns, mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 8), mat(0xd9b24a)), 0, 0.66, 0);
  add(ns, mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.18, 10, 1, true), mat(DT.lampShade, { side: THREE.DoubleSide, emissive: 0x8a5a20 })), 0, 0.84, 0);
  W.bedLamp = new THREE.PointLight(0xffb860, 4.2, 5, 1.5); W.bedLamp.position.set(-1.0, 0.95, BED.z + 0.87); Y.add(W.bedLamp);
  frame(Y, DT.poster, 0.55, 0.72, 1.6, 1.55, BZ + 0.03, 0, 0x1a1a1a);
  frame(Y, DT.photos[2], 0.4, 0.5, -BX + 0.03, 1.6, -1.8, Math.PI / 2, 0x1a1a1a);
  add(Y, bx(0.6, 1.9, 1.1, mat(0x7a5a3a)), BX - 0.32, 0.95, -2.6);
  add(Y, mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.06, 10), mat(0xc8ccd4, { metalness: 0.7, roughness: 0.25 })), 0.85, 0.03, -0.55);
  add(Y, plane(1.6, 1.0, mat(0x5a8ad0, { flatShading: false })), 0.2, 0.006, -2.6, -Math.PI / 2);
}
