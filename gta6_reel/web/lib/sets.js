// All the locations, built side by side in one scene.
import * as THREE from 'three';
import { mat, mesh, bx, faceted, rng, LAYER_FX, makeLaptop, makeCup } from './chars.js';
import { makeCanvas, toTex, textTexture, strokeText, FONT, COMIC } from './gfx.js';

export const SET = {
  room: new THREE.Vector3(0, 0, 0),
  sky: new THREE.Vector3(0, 60, -300),
  plaza: new THREE.Vector3(100, 0, 0),
  lobby: new THREE.Vector3(200, 0, 0),
  studio: new THREE.Vector3(-100, 0, 0),
};

const glassMat = (op = 0.25, col = 0xbfe6ff) => new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: op, roughness: 0.05, metalness: 0.2, depthWrite: false });
function fxLayer(o) { o.traverse(x => x.layers.set(LAYER_FX)); return o; }
function add(parent, m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
function plane(w, h, m) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.receiveShadow = true; return p; }

export function posterTex(kind) {
  const [c, g] = makeCanvas(384, 512);
  let grd;
  if (kind === 'GTA 6') { grd = g.createLinearGradient(0, 0, 384, 512); grd.addColorStop(0, '#ff7ac6'); grd.addColorStop(0.55, '#a46bff'); grd.addColorStop(1, '#4fc3ff'); }
  else { grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#9be36c'); grd.addColorStop(1, '#2f9e5a'); }
  g.fillStyle = grd; g.fillRect(0, 0, 384, 512);
  // palm silhouettes / skyline blocks for decoration
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let k = 0; k < 7; k++) g.fillRect(20 + k * 52, 400 - (k * 37 % 90), 40, 200);
  strokeText(g, kind, 192, 200, 120, { fill: '#ffffff', stroke: '#1a1a1a', lw: 0.12 });
  strokeText(g, kind === 'GTA 6' ? 'COMING SOON' : 'OUT NOW', 192, 300, 40, { fill: '#ffe14d', stroke: '#1a1a1a', lw: 0.18 });
  g.lineWidth = 12; g.strokeStyle = '#fff'; g.strokeRect(6, 6, 372, 500);
  return toTex(c);
}

export function screenTex(kind, extra = {}) {
  const [c, g] = makeCanvas(640, 360);
  if (kind === 'soon') {
    const grd = g.createLinearGradient(0, 0, 640, 360); grd.addColorStop(0, '#2b1055'); grd.addColorStop(1, '#d53a9d');
    g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
    strokeText(g, 'GTA 6', 320, 150, 150, { fill: '#fff', stroke: '#000', lw: 0.08 });
    strokeText(g, 'COMING SOON', 320, 275, 58, { fill: '#ffe14d', stroke: '#000', lw: 0.14 });
  } else if (kind === 'done') {
    const grd = g.createLinearGradient(0, 0, 0, 360); grd.addColorStop(0, '#1d6b3a'); grd.addColorStop(1, '#0d2e1b');
    g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
    strokeText(g, 'GTA 5', 320, 115, 110, { fill: '#9be36c', stroke: '#000', lw: 0.08 });
    strokeText(g, 'COMPLETE', 320, 215, 76, { fill: '#fff', stroke: '#000', lw: 0.12 });
    strokeText(g, '100%', 320, 300, 50, { fill: '#ffe14d', stroke: '#000', lw: 0.14 });
  } else if (kind === 'news') {
    g.fillStyle = '#123a8a'; g.fillRect(0, 0, 640, 360);
    g.fillStyle = '#d81e2c'; g.fillRect(0, 250, 640, 70);
    strokeText(g, 'BREAKING NEWS', 320, 286, 46, { fill: '#fff', stroke: '#000', lw: 0.1 });
    strokeText(g, 'NEWS 24', 320, 120, 80, { fill: '#fff', stroke: '#000', lw: 0.1 });
  } else if (kind === 'off') {
    g.fillStyle = '#15171c'; g.fillRect(0, 0, 640, 360);
  }
  return toTex(c);
}

export function buildSets(scene) {
  const W = {};
  // ---------------------------------------------------------------- lights
  W.hemi = new THREE.HemisphereLight(0xfffbf5, 0xcfc3b4, 1.25);
  scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xfff3e2, 2.1);
  W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(2048, 2048);
  W.sun.shadow.bias = -0.0005;
  W.sun.shadow.normalBias = 0.03;
  W.sun.shadow.radius = 4;
  scene.add(W.sun, W.sun.target);
  W.sunAt = (c, size = 9, off = [4, 9, 6]) => {
    W.sun.target.position.copy(c);
    W.sun.position.copy(c).add(new THREE.Vector3(...off));
    Object.assign(W.sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 80 });
    W.sun.shadow.camera.updateProjectionMatrix();
  };
  W.sunAt(SET.room);

  buildRoom(scene, W);
  buildSky(scene, W);
  buildPlaza(scene, W);
  buildLobby(scene, W);
  buildStudio(scene, W);
  return W;
}

// ================================================================ room
function buildRoom(scene, W) {
  const R = new THREE.Group(); R.position.copy(SET.room); scene.add(R);
  const wallM = mat(0xc8daf2, { flatShading: false }), floorM = mat(0xe9cfa6, { flatShading: false });
  const floor = add(R, plane(7, 7, floorM), 0, 0, 0, -Math.PI / 2);
  for (let k = -3; k <= 3; k++) { const s = bx(7, 0.004, 0.02, mat(0xcfb38a), false); s.position.set(0, 0.002, k); R.add(s); }
  add(R, plane(7, 2.9, wallM), 0, 1.45, -3);
  add(R, plane(7, 2.9, wallM), 3, 1.45, 0, 0, -Math.PI / 2);
  add(R, plane(7, 2.9, wallM), 0, 1.45, 3.5, 0, Math.PI);
  // left wall with a window hole (z -0.4..1.0, y 0.9..2.1)
  const lw = mat(0xc8daf2, { flatShading: false, side: THREE.DoubleSide });
  add(R, plane(3.0, 2.9, lw), -3, 1.45, -1.9, 0, Math.PI / 2);
  add(R, plane(2.5, 2.9, lw), -3, 1.45, 2.25, 0, Math.PI / 2);
  add(R, plane(1.4, 0.9, lw), -3, 0.45, 0.3, 0, Math.PI / 2);
  add(R, plane(1.4, 0.8, lw), -3, 2.5, 0.3, 0, Math.PI / 2);
  const frameM = mat(0xffffff);
  for (const [w, h, y, z] of [[0.08, 1.3, 1.5, -0.4], [0.08, 1.3, 1.5, 1.0], [0.08, 0.08, 0.9, 0.3], [0.08, 0.08, 2.1, 0.3]]) {
    const f = bx(0.1, h, w === 0.08 && h === 0.08 ? 1.48 : 0.08, frameM); f.position.set(-3, y, z); R.add(f);
  }
  const sill = bx(0.25, 0.05, 1.5, frameM); sill.position.set(-2.92, 0.9, 0.3); R.add(sill);
  const gl = add(R, plane(1.4, 1.2, glassMat(0.15)), -3.0, 1.5, 0.3, 0, Math.PI / 2); fxLayer(gl);
  // outside: grass, fence, bike, sky
  add(R, plane(14, 14, mat(0x9fd67f, { flatShading: false })), -10, -0.02, 0.3, -Math.PI / 2);
  for (let k = -4; k <= 4; k++) { const p = bx(0.08, 0.9, 0.08, mat(0xffffff)); p.position.set(-5.2, 0.45, 0.3 + k * 0.5); R.add(p); }
  const rail = bx(0.06, 0.06, 4.4, mat(0xffffff)); rail.position.set(-5.2, 0.75, 0.3); R.add(rail);
  const sky = add(R, plane(30, 14, new THREE.MeshBasicMaterial({ color: 0xbfe7ff })), -14, 5, 0.3, 0, Math.PI / 2);
  W.bike = makeBike(); W.bike.position.set(-4.4, 0, 0.3); W.bike.rotation.y = Math.PI / 2 + 0.2; R.add(W.bike);
  W.bikeHome = W.bike.position.clone();

  // TV + stand + console
  const stand = bx(2.2, 0.5, 0.5, mat(0xf4f1ea)); stand.position.set(0, 0.25, -2.7); R.add(stand);
  const tv = new THREE.Group(); tv.position.set(0, 1.42, -2.86); R.add(tv);
  tv.add(bx(2.15, 1.25, 0.08, mat(0x1b1d22)));
  W.tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.125), new THREE.MeshBasicMaterial({ map: screenTex('soon') }));
  W.tvScreen.position.z = 0.045; tv.add(W.tvScreen);
  W.tvTex = { soon: screenTex('soon'), done: screenTex('done'), news: screenTex('news'), off: screenTex('off') };
  W.tv = tv;
  const ps = new THREE.Group(); ps.position.set(0.55, 0.5, -2.65); R.add(ps);
  ps.add(add(new THREE.Group(), bx(0.42, 0.1, 0.32, mat(0xf2f3f5)), 0, 0.05, 0));
  const blk = bx(0.36, 0.05, 0.3, mat(0x1d1f25)); blk.position.y = 0.11; ps.add(blk);
  const led = bx(0.12, 0.012, 0.01, new THREE.MeshBasicMaterial({ color: 0x4fc3ff })); led.position.set(0, 0.07, 0.161); ps.add(led);
  W.ps = ps; W.psHome = ps.position.clone();
  // calendar
  W.calendar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshStandardMaterial({ map: calendarTex(2020), roughness: 0.9 }));
  W.calendar.position.set(-1.95, 1.75, -2.98); R.add(W.calendar);
  W.calTex = {}; for (let y = 2019; y <= 2026; y++) W.calTex[y] = calendarTex(y);
  const pin = bx(0.04, 0.04, 0.03, mat(0xe23b3b)); pin.position.set(-1.95, 2.17, -2.96); R.add(pin);
  // poster
  const post = add(R, plane(0.75, 1.0, new THREE.MeshStandardMaterial({ map: posterTex('GTA 5'), roughness: 0.8 })), 2.98, 1.7, -1.6, 0, -Math.PI / 2);
  // gaming chair
  const chair = new THREE.Group(); chair.position.set(0, 0, -0.55); R.add(chair);
  const cm = mat(0xe8505b), cb = mat(0x2a2c33);
  add(chair, bx(0.6, 0.12, 0.55, cm), 0, 0.48, 0);
  add(chair, bx(0.6, 0.85, 0.1, cm), 0, 0.95, 0.3, -0.12);
  add(chair, bx(0.05, 0.42, 0.05, cb), 0, 0.22, 0);
  add(chair, bx(0.6, 0.04, 0.6, cb), 0, 0.03, 0);
  W.chair = chair;
  // bed
  const bed = new THREE.Group(); bed.position.set(2.15, 0, -0.9); R.add(bed);
  add(bed, bx(1.3, 0.35, 2.2, mat(0xf3eee6)), 0, 0.2, 0);
  add(bed, bx(1.28, 0.16, 2.0, mat(0x8fd3b6)), 0, 0.45, 0.1);
  add(bed, bx(0.9, 0.14, 0.4, mat(0xffffff)), 0, 0.48, -0.85);
  add(bed, bx(1.3, 0.8, 0.12, mat(0xf3eee6)), 0, 0.5, -1.1);
  W.bed = bed;
  // door (right wall, hinge at z=1.8)
  const fr = mat(0xffffff);
  for (const [h, z, y] of [[2.2, 1.75, 1.1], [2.2, 2.85, 1.1]]) { const f = bx(0.12, h, 0.08, fr); f.position.set(2.97, y, z); R.add(f); }
  const top = bx(0.12, 0.1, 1.2, fr); top.position.set(2.97, 2.2, 2.3); R.add(top);
  add(R, plane(3.0, 2.9, mat(0xf6e9d6, { flatShading: false })), 4.3, 1.45, 2.3, 0, -Math.PI / 2);
  add(R, plane(1.4, 3.0, mat(0xe9cfa6, { flatShading: false })), 3.6, 0.001, 2.3, -Math.PI / 2);
  const door = new THREE.Group(); door.position.set(2.96, 0, 1.8); R.add(door);
  add(door, bx(0.05, 2.12, 1.0, mat(0xf7d9a8)), 0, 1.06, 0.5);
  add(door, mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xd9b14a)), -0.05, 1.0, 0.88);
  W.roomDoor = door;
  // energy drink cans + pizza box + rug
  const cans = new THREE.Group(); R.add(cans);
  const R2 = rng(4);
  const canCols = [0x3cd27a, 0x4fa8ff, 0x3cd27a, 0xff6a3d, 0x4fa8ff, 0x3cd27a, 0xffd23d, 0x4fa8ff, 0x3cd27a, 0xff6a3d, 0x3cd27a, 0x4fa8ff];
  canCols.forEach((col, k) => {
    const c = new THREE.Group();
    add(c, mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 10), mat(col)), 0, 0.065, 0);
    add(c, mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.012, 10), mat(0xd0d4d9, { metalness: 0.6, roughness: 0.3 })), 0, 0.135, 0);
    const lying = k % 3 === 1;
    c.position.set(-1.6 + R2() * 3.0, lying ? 0.035 : 0, -2.2 + R2() * 2.6);
    if (lying) c.rotation.set(Math.PI / 2, R2() * 3, 0);
    if (k < 3) c.position.set(-0.6 + k * 0.18, 0.5, -2.55);
    cans.add(c);
  });
  add(R, mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.01, 24), mat(0xf5b8c8, { flatShading: false })), 0, 0.006, -0.5);
  const pz = bx(0.45, 0.05, 0.45, mat(0xe8c48c)); pz.position.set(-1.1, 0.03, 0.4); pz.rotation.y = 0.4; R.add(pz);
  // lamp
  add(R, mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), mat(0xffffff)), -2.4, 0.75, -2.4);
  add(R, mesh(new THREE.ConeGeometry(0.25, 0.3, 8, 1, true), mat(0xffe9a8, { side: THREE.DoubleSide })), -2.4, 1.6, -2.4);
}

function makeBike() {
  const g = new THREE.Group();
  const fm = mat(0x2f7dff), tm = mat(0x222222);
  for (const x of [-0.5, 0.5]) { const w = mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 16), tm); w.position.set(x, 0.34, 0); g.add(w); }
  const bar = (x1, y1, x2, y2) => { const l = Math.hypot(x2 - x1, y2 - y1); const b = bx(l, 0.045, 0.045, fm); b.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); b.rotation.z = Math.atan2(y2 - y1, x2 - x1); g.add(b); };
  bar(-0.5, 0.34, 0.0, 0.34); bar(0.0, 0.34, -0.15, 0.78); bar(-0.5, 0.34, -0.15, 0.78); bar(-0.15, 0.78, 0.4, 0.8); bar(0.0, 0.34, 0.4, 0.8); bar(0.5, 0.34, 0.42, 0.95);
  const seat = bx(0.22, 0.05, 0.1, mat(0x1b1b1b)); seat.position.set(-0.17, 0.84, 0); g.add(seat);
  const hb = bx(0.05, 0.05, 0.42, mat(0x1b1b1b)); hb.position.set(0.42, 0.97, 0); g.add(hb);
  return g;
}

export function calendarTex(year) {
  const [c, g] = makeCanvas(256, 330);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 330);
  g.fillStyle = '#e8434f'; g.fillRect(0, 0, 256, 80);
  strokeText(g, String(year), 128, 42, 56, { fill: '#fff', lw: 0 });
  g.fillStyle = '#d9dde3';
  for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) g.fillRect(14 + k * 33, 100 + r * 44, 28, 36);
  g.strokeStyle = '#e8434f'; g.lineWidth = 6;
  for (let i = 0; i < 9; i++) { const r = (i * 3) % 5, k = (i * 5) % 7; g.beginPath(); g.moveTo(16 + k * 33, 102 + r * 44); g.lineTo(40 + k * 33, 134 + r * 44); g.moveTo(40 + k * 33, 102 + r * 44); g.lineTo(16 + k * 33, 134 + r * 44); g.stroke(); }
  return toTex(c);
}

// ================================================================ sky + plane
function buildSky(scene, W) {
  const S = new THREE.Group(); S.position.copy(SET.sky); scene.add(S);
  const cloudM = mat(0xffffff, { roughness: 1 });
  const R = rng(9);
  for (let k = 0; k < 28; k++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(R() * 4);
    for (let j = 0; j < n; j++) { const p = mesh(faceted(1, k * 7 + j, [1, 0.7, 1], 1, 0.15), cloudM, false); p.position.set(j * 1.3 - n * 0.6, R() * 0.6, R() * 0.8); p.scale.setScalar(1 + R() * 0.8); c.add(p); }
    c.position.set((R() - 0.5) * 80, -6 + R() * 14, -10 - R() * 40);
    c.scale.setScalar(0.8 + R() * 1.4);
    S.add(c);
  }
  // plane: fuselage along +x, windows on the +z side
  const P = new THREE.Group(); S.add(P);
  const white = mat(0xf7f9fc, { side: THREE.DoubleSide }), blue = mat(0x3d7bf2);
  const fus = new THREE.Group(); P.add(fus);
  // fuselage shell with a window cut-out texture
  // texture: u runs around the fuselage (u=0.5 faces +z), v along its length
  const [c, g] = makeCanvas(256, 1024);
  g.fillStyle = '#f7f9fc'; g.fillRect(0, 0, 256, 1024);
  g.fillStyle = '#3d7bf2'; g.fillRect(0.47 * 256 - 6, 0, 12, 1024);
  g.fillStyle = '#3d7bf2'; g.fillRect(0.53 * 256 - 6, 0, 12, 1024);
  g.globalCompositeOperation = 'destination-out';
  W.planeWindowsV = [];
  for (let k = 0; k < 14; k++) {
    const v = 0.12 + k * 0.058;
    g.beginPath(); g.roundRect(0.565 * 256 - 9, (1 - v) * 1024 - 16, 18, 32, 8); g.fill();
    W.planeWindowsV.push(v);
  }
  g.globalCompositeOperation = 'source-over';
  const ftex = toTex(c);
  ftex.wrapS = ftex.wrapT = THREE.ClampToEdgeWrapping;
  const shellG = new THREE.CylinderGeometry(1.0, 1.0, 10, 40, 1, true, -Math.PI, Math.PI * 2);
  shellG.rotateZ(Math.PI / 2);
  const shellM = new THREE.MeshStandardMaterial({ map: ftex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, flatShading: false });
  const fusMesh = new THREE.Mesh(shellG, shellM); fusMesh.castShadow = true; fus.add(fusMesh);
  // window k sits at x = -(v - 0.5) * 10 (rotateZ maps height y -> -x), angle 0.065 turn above +z
  W.planeWindowPos = (k) => new THREE.Vector3(-(W.planeWindowsV[k] - 0.5) * 10, Math.sin(0.065 * Math.PI * 2), Math.cos(0.065 * Math.PI * 2));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 10, 24, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdfe6f0, side: THREE.BackSide }));
  fus.add(inner);
  const nose = mesh(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), white); nose.scale.set(1.6, 1, 1); nose.position.x = 5; fus.add(nose);
  const tail = mesh(new THREE.ConeGeometry(1.0, 3, 20, 1, true).rotateZ(Math.PI / 2), white); tail.position.x = -6.5; fus.add(tail);
  const fin = bx(1.6, 2.0, 0.12, blue); fin.position.set(-6.6, 1.3, 0); fin.rotation.z = 0.5; P.add(fin);
  const wing = bx(2.4, 0.12, 9, white); wing.position.set(0.3, -0.45, 0); wing.rotation.y = 0.0; P.add(wing);
  const stab = bx(1.0, 0.08, 3.5, white); stab.position.set(-6.8, 0.3, 0); P.add(stab);
  for (const z of [-2.6, 2.6]) { const eng = mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.3, 12).rotateZ(Math.PI / 2), mat(0xc9d1dc)); eng.position.set(0.8, -0.9, z); P.add(eng); }
  const cabin = new THREE.PointLight(0xfff1dd, 6, 4, 1.5); cabin.position.set(0, 0.3, 0.2); P.add(cabin);
  W.plane = P;
  W.planeFus = fus;
  // window glass planes
  const glassG = new THREE.Group(); P.add(glassG);
  W.windowGlass = glassG;
  // seats inside
  for (let k = 0; k < 6; k++) { const s = bx(0.5, 0.7, 0.5, mat(0x3d7bf2)); s.position.set(-3 + k * 1.2, -0.45, 0.3); P.add(s); }
  W.skyBg = 0x9fd8ff;
}

// ================================================================ plaza + building
function buildPlaza(scene, W) {
  const B = new THREE.Group(); B.position.copy(SET.plaza); scene.add(B);
  add(B, plane(140, 140, mat(0xd9dde3, { flatShading: false })), 0, 0, 10, -Math.PI / 2);
  // plaza tiles
  for (let k = -10; k <= 10; k++) { const l = bx(40, 0.005, 0.03, mat(0xc5cad2), false); l.position.set(0, 0.003, 4 + k * 1.2); B.add(l); }
  // building body
  const bodyM = mat(0x9fc9ea, { roughness: 0.2, metalness: 0.15, flatShading: false });
  const body = bx(16, 30, 10.6, bodyM); body.position.set(0, 15, -12.9); B.add(body);
  for (const sx of [-1, 1]) { const sp = bx(0.3, 30, 1.6, mat(0xffffff)); sp.position.set(sx * 8, 15, -6.85); B.add(sp); }
  // window grid on the sides/back via thin white bars
  const frame = mat(0xffffff, { roughness: 0.4 });
  const top = 30, F = 1.1;
  // front facade (z = -6.1): frame grid + glass + dark interior + faces
  const fz = -6.1;
  W.facadeZ = fz;
  const interior = add(B, plane(16, 30, mat(0x6d86a3, { flatShading: false })), 0, 15, fz - 1.45);
  for (let fl = 1; fl < 10; fl++) { const s = bx(16, 0.25, 1.4, mat(0xe8edf2)); s.position.set(0, F + fl * 3.0 - 0.12, fz - 0.7); B.add(s); }
  for (let x = -8; x <= 8.01; x += 2) { const v = bx(0.18, top, 0.25, frame); v.position.set(x, top / 2, fz); B.add(v); }
  for (let fl = 0; fl <= 10; fl++) { const h = bx(16.2, 0.2, 0.25, frame); h.position.set(0, F + fl * 3.0, fz); B.add(h); }
  const glass = add(B, plane(16, top - F, glassMat(0.32, 0xbfe2ff)), 0, F + (top - F) / 2, fz + 0.05); fxLayer(glass);
  // faces behind the windows (shown in scenes 23-25)
  W.faces = [];
  const skins = [0xeab894, 0xd39a74, 0xa86f48, 0xf1c9a5, 0x8a5a3c];
  const hairs = [0x3b2a1e, 0x111111, 0x8a5a2b, 0xd8b45a, 0x5a3a2a];
  const shirts = [0xffffff, 0x8fc1ff, 0xffb3c7, 0xb3f0c2, 0xffe08a, 0xd0b3ff];
  const R = rng(17);
  for (let fl = 0; fl < 9; fl++) {
    for (let col = 0; col < 8; col++) {
      const x = -7 + col * 2, y = F + fl * 3.0;
      const per = 1 + Math.floor(R() * 2);
      for (let k = 0; k < per; k++) {
        const f = makeFace(skins[Math.floor(R() * 5)], hairs[Math.floor(R() * 5)], shirts[Math.floor(R() * 6)], Math.floor(R() * 1000));
        f.position.set(x - 0.45 + k * 0.9 + (R() - 0.5) * 0.2, y + 1.45 + (R() - 0.5) * 0.15, fz - 0.45);
        f.userData.base = f.position.clone();
        f.userData.floor = fl; f.userData.col = col;
        f.visible = false;
        B.add(f);
        W.faces.push(f);
      }
    }
  }
  // ground floor: entrance doors
  const doorG = new THREE.Group(); doorG.position.set(0, F, fz + 0.12); B.add(doorG);
  W.plazaDoors = [];
  for (const sx of [-1, 1]) {
    const d = new THREE.Group(); d.position.x = sx * 0.6; doorG.add(d);
    const gp = plane(1.18, 2.6, glassMat(0.35, 0xd8f0ff)); gp.position.y = 1.3; d.add(gp); fxLayer(gp);
    const h = bx(0.04, 0.5, 0.06, mat(0xbfc5cc, { metalness: 0.6 })); h.position.set(-sx * 0.45, 1.25, 0.04); d.add(h);
    W.plazaDoors.push(d);
  }
  // "ROCKSTAR" plain text: on top and above the entrance
  W.signTop = add(B, plane(15, 2.4, new THREE.MeshBasicMaterial({ map: signTex(), transparent: true })), 0, 27.6, fz + 0.2);
  fxLayer(W.signTop);
  const signBoard = bx(7.2, 1.25, 0.25, mat(0x1d2433)); signBoard.position.set(0, F + 3.45, fz + 0.25); B.add(signBoard);
  W.signLow = add(B, plane(6.8, 1.05, new THREE.MeshBasicMaterial({ map: signTex(true) })), 0, F + 3.45, fz + 0.39);
  // steps: 6 steps from z = -6 down to z = -2.4, top at y = 1.1
  const stepM = mat(0xf5f6f8, { roughness: 0.15, metalness: 0.05, flatShading: false });
  W.steps = [];
  for (let k = 0; k < 6; k++) {
    const h = F - k * (F / 6);
    const s = bx(12, h, 0.62, stepM); s.position.set(0, h / 2, -5.8 + k * 0.6 + 0.3); B.add(s);
    W.steps.push(s);
  }
  const landing = bx(12, F, 0.6, stepM); landing.position.set(0, F / 2, -6.1 + 0.3); B.add(landing);
  W.stepsTop = new THREE.Vector3(SET.plaza.x, F, SET.plaza.z - 5.2);
  // trees + lamps + benches + other buildings
  const R3 = rng(23);
  for (const x of [-10, -7, 7, 10]) {
    const t = new THREE.Group(); t.position.set(x, 0, -1.5); B.add(t);
    add(t, mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6), mat(0x8a5a3c)), 0, 0.8, 0);
    add(t, mesh(faceted(1.1, x * 3 + 50, [1, 1.2, 1], 1, 0.2), mat(0x7fcf6a)), 0, 2.4, 0);
  }
  for (let k = 0; k < 9; k++) {
    const b = bx(8 + R3() * 6, 14 + R3() * 26, 8, mat([0xf2d1c9, 0xd6e4f0, 0xf6e6b8, 0xd8cdea][k % 4], { flatShading: false }));
    const side = k % 2 ? 1 : -1;
    b.position.set(side * (18 + R3() * 18), 0, -25 - R3() * 25); b.position.y = b.geometry.parameters.height / 2; B.add(b);
  }
  W.plazaFloorY = 0;
}
function signTex(board = false) {
  const [c, g] = makeCanvas(1024, board ? 160 : 164);
  if (board) { g.fillStyle = '#1d2433'; g.fillRect(0, 0, 1024, 160); }
  strokeText(g, 'ROCKSTAR', 512, board ? 84 : 86, board ? 128 : 140, { fill: '#ffffff', stroke: '#1d2433', lw: board ? 0 : 0.06, weight: 900 });
  return toTex(c);
}
export function makeFace(skin, hair, shirt, seed) {
  const g = new THREE.Group();
  const head = mesh(faceted(0.19, seed, [0.95, 1.12, 1], 1, 0.05), mat(skin), false);
  g.add(head);
  const hairM = mat(hair, { side: THREE.DoubleSide });
  const cap = mesh(faceted(0.2, seed + 1, [0.97, 0.6, 1.0], 1, 0.05), hairM, false); cap.position.set(0, 0.1, -0.03); g.add(cap);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x141414 });
  const eyes = [];
  for (const k of [-1, 1]) { const e = bx(0.036, 0.068, 0.02, eyeM, false); e.position.set(k * 0.065, 0.025, 0.18); g.add(e); eyes.push(e); }
  const mouth = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 8), eyeM, false); mouth.rotation.x = Math.PI / 2; mouth.position.set(0, -0.085, 0.175); g.add(mouth);
  const sh = bx(0.5, 0.3, 0.22, mat(shirt), false); sh.position.set(0, -0.42, -0.02); g.add(sh);
  const nk = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), mat(skin), false); nk.position.y = -0.24; g.add(nk);
  // hands that can press on the glass
  const hands = [];
  for (const k of [-1, 1]) { const h = bx(0.09, 0.12, 0.04, mat(skin), false); h.position.set(k * 0.28, 0.05, 0.12); h.visible = false; g.add(h); hands.push(h); }
  g.userData = { head, eyes, mouth, hands };
  return g;
}

// ================================================================ lobby
function buildLobby(scene, W) {
  const L = new THREE.Group(); L.position.copy(SET.lobby); scene.add(L);
  const floorM = mat(0xf3f4f6, { roughness: 0.15, metalness: 0.05, flatShading: false });
  add(L, plane(16, 14, floorM), 0, 0, 0, -Math.PI / 2);
  for (let k = -7; k <= 7; k++) { const a = bx(16, 0.004, 0.02, mat(0xdfe2e7), false); a.position.set(0, 0.003, k); L.add(a); const b = bx(0.02, 0.004, 14, mat(0xdfe2e7), false); b.position.set(k, 0.003, 0); L.add(b); }
  const wallM = mat(0xfbe8dc, { flatShading: false }), wall2 = mat(0xdcebf6, { flatShading: false });
  add(L, plane(16, 4.5, wallM), 0, 2.25, -6);
  add(L, plane(14, 4.5, wall2), -8, 2.25, 0, 0, Math.PI / 2);
  add(L, plane(14, 4.5, wall2), 8, 2.25, 0, 0, -Math.PI / 2);
  add(L, plane(16, 14, mat(0xffffff, { flatShading: false })), 0, 4.5, 0, Math.PI / 2);
  // glass front wall with sliding doors (z = +6)
  const fr = mat(0xffffff);
  for (let x = -8; x <= 8.01; x += 2) { const v = bx(0.12, 4.5, 0.12, fr); v.position.set(x, 2.25, 6); L.add(v); }
  const tb = bx(16, 0.15, 0.15, fr); tb.position.set(0, 3.2, 6); L.add(tb);
  for (const x of [-4.8, 4.8]) { const g = add(L, plane(6.4, 4.5, glassMat(0.25, 0xd8f0ff)), x, 2.25, 6, 0, Math.PI); fxLayer(g); }
  W.lobbyDoors = [];
  for (const sx of [-1, 1]) {
    const d = new THREE.Group(); d.position.set(sx * 0.6, 0, 6); L.add(d);
    const gp = plane(1.18, 3.1, glassMat(0.3, 0xd8f0ff)); gp.position.y = 1.55; gp.rotation.y = Math.PI; d.add(gp); fxLayer(gp);
    const h = bx(0.04, 0.5, 0.06, mat(0xbfc5cc)); h.position.set(-sx * 0.45, 1.3, 0); d.add(h);
    W.lobbyDoors.push(d);
  }
  // outside the glass: daylight
  add(L, plane(40, 20, new THREE.MeshBasicMaterial({ color: 0xcfeeff })), 0, 5, 14, 0, Math.PI);
  add(L, plane(40, 20, mat(0xd9dde3)), 0, -0.01, 16, -Math.PI / 2);
  // reception desk (front faces +z)
  const desk = new THREE.Group(); desk.position.set(0, 0, -2.2); L.add(desk);
  add(desk, bx(3.2, 1.1, 0.8, mat(0xffffff, { roughness: 0.3 })), 0, 0.55, 0);
  add(desk, bx(3.3, 0.06, 0.95, mat(0x7fb7e6)), 0, 1.12, 0.05);
  const deskSign = add(desk, plane(1.8, 0.3, new THREE.MeshBasicMaterial({ map: textTexture('RECEPTION', { w: 512, h: 86, bg: '#7fb7e6', fg: '#fff', size: 52 }) })), 0, 0.75, 0.41);
  W.desk = desk;
  W.deskTop = new THREE.Vector3(SET.lobby.x, 1.15, SET.lobby.z - 2.0);
  // ROCKSTAR text on the back wall + posters
  add(L, plane(6.5, 1.2, new THREE.MeshBasicMaterial({ map: signTex(), transparent: true })), 0, 3.4, -5.97);
  add(L, plane(1.5, 2.0, new THREE.MeshStandardMaterial({ map: posterTex('GTA 6'), roughness: 0.6 })), -4.5, 2.2, -5.95);
  add(L, plane(1.5, 2.0, new THREE.MeshStandardMaterial({ map: posterTex('GTA 5'), roughness: 0.6 })), 4.5, 2.2, -5.95);
  W.lobbyPoster6 = new THREE.Vector3(SET.lobby.x - 4.5, 2.2, SET.lobby.z - 5.9);
  add(L, plane(1.5, 2.0, new THREE.MeshStandardMaterial({ map: posterTex('GTA 6'), roughness: 0.6 })), -7.95, 2.2, -1.0, 0, Math.PI / 2);
  // couches, plants
  for (const [x, z, ry] of [[-5, 1.5, Math.PI / 2], [5, 1.5, -Math.PI / 2]]) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; L.add(c);
    add(c, bx(2.2, 0.45, 0.9, mat(0xff9eb5)), 0, 0.3, 0);
    add(c, bx(2.2, 0.6, 0.25, mat(0xff8aa6)), 0, 0.65, -0.35);
  }
  for (const [x, z] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) {
    const p = new THREE.Group(); p.position.set(x, 0, z); L.add(p);
    add(p, mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 8), mat(0xffffff)), 0, 0.3, 0);
    add(p, mesh(faceted(0.6, x * 7 + z, [1, 1.4, 1], 1, 0.2), mat(0x6cc56a)), 0, 1.2, 0);
  }
  // coffee table with laptop
  const tbl = bx(1.2, 0.4, 0.7, mat(0xffffff)); tbl.position.set(-5, 0.2, 3.2); L.add(tbl);
}

// ================================================================ news studio
function buildStudio(scene, W) {
  const S = new THREE.Group(); S.position.copy(SET.studio); scene.add(S);
  add(S, plane(14, 12, mat(0x1d2b55, { roughness: 0.3, flatShading: false })), 0, 0, 0, -Math.PI / 2);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshBasicMaterial({ map: studioBackTex() }));
  back.position.set(0, 2.5, -4); S.add(back);
  const desk = new THREE.Group(); desk.position.set(0, 0, -1.2); S.add(desk);
  add(desk, bx(3.2, 1.0, 0.9, mat(0xffffff, { roughness: 0.3 })), 0, 0.5, 0);
  add(desk, bx(3.3, 0.06, 1.0, mat(0x2f6bff)), 0, 1.02, 0);
  add(desk, plane(2.2, 0.35, new THREE.MeshBasicMaterial({ map: textTexture('NEWS 24', { w: 512, h: 80, bg: '#2f6bff', fg: '#fff', size: 56 }) })), 0, 0.6, 0.46);
  W.studioDesk = desk;
}
function studioBackTex() {
  const [c, g] = makeCanvas(1200, 500);
  const grd = g.createLinearGradient(0, 0, 0, 500); grd.addColorStop(0, '#3a74ff'); grd.addColorStop(1, '#0f2a6b');
  g.fillStyle = grd; g.fillRect(0, 0, 1200, 500);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let k = 0; k < 14; k++) g.fillRect(k * 90, 260 - (k * 53 % 140), 70, 300);
  strokeText(g, 'NEWS 24', 600, 110, 110, { fill: '#ffffff', stroke: '#0b1c45', lw: 0.08 });
  return toTex(c);
}
