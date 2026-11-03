// Street with the house far away (origin, walking towards -z), front porch (x=60), hallway (x=100); street people & props.
import { THREE, PI, RNG, M, mesh, box, cyl, ico, canvasTex, P, V, Mannequin } from './toon.js';
export const PO = V(60, 0, 0), HA = V(100, 0, 0);
const FONT = '"Bangers", sans-serif';
const hex = c => '#' + c.toString(16).padStart(6, '0');

export function makeHouse(parent, s = 1) {
  const g = new THREE.Group(); parent.add(g); g.scale.setScalar(s);
  box(6, 3.2, 5, M(0xffd6c4, { std: true, r: 0.9 }), g, 0, 1.6, 0);
  const roof = mesh(new THREE.ConeGeometry(4.6, 2.2, 4), M(0xe8735f, { std: true }), g, 0, 4.3, 0); roof.rotation.y = PI / 4; roof.scale.set(1, 1, 0.82);
  box(1.1, 2.0, 0.1, M(0x6aa88a, { std: true }), g, 0, 1.0, 2.52);
  for (const x of [-1.9, 1.9]) { box(1.1, 1.0, 0.1, M(0xbfe6f7, { std: true, emissive: 0xfff2b0, ei: 0.25 }), g, x, 1.8, 2.52); box(1.25, 0.1, 0.15, M(0xffffff), g, x, 1.25, 2.55); }
  box(0.6, 1.2, 0.6, M(0xc96a5a, { std: true }), g, 1.6, 4.6, -0.5);
  for (const x of [-2.6, 2.6]) { const b = ico(0.7, 1, M(0x7cc48a, { std: true }), g, x, 0.6, 3.0); b.scale.y = 0.8; }
  return g;
}
// ===================== STREET =====================
export function buildStreet(scene) {
  const S = {}; const G = S.group = new THREE.Group(); scene.add(G);
  S.stretch = new THREE.Group(); G.add(S.stretch);   // everything that stretches with "every step feels like a mile"
  const road = mesh(new THREE.PlaneGeometry(5, 220), M(0x8f98a8, { std: true, r: 0.9 }), S.stretch, -1.0, 0, -100); road.rotation.x = -PI / 2;
  for (let i = 0; i < 70; i++) box(0.12, 0.01, 1.2, M(0xfff3c4), S.stretch, -1.0, 0.01, 6 - i * 3.2);
  const swt = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#e8e0d2'; x.fillRect(0, 0, w, h); x.strokeStyle = '#cfc6b6'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); });
  swt.wrapS = swt.wrapT = THREE.RepeatWrapping; swt.repeat.set(2, 110);
  for (const [x, w] of [[2.4, 2.8], [-4.6, 2.2]]) box(w, 0.14, 220, M(0xffffff, { std: true, map: swt }), S.stretch, x, 0.07, -100);
  const grass = mesh(new THREE.PlaneGeometry(80, 240), M(0xa8d8a0), G, 0, -0.02, -100); grass.rotation.x = -PI / 2;
  const cols = [0xf6c7b6, 0xc9e3d6, 0xfde3a7, 0xcdd7f2, 0xf2d0e6, 0xd6efc7, 0xffe0c2];
  const r = RNG(4);
  for (let i = 0; i < 26; i++) for (const side of [1, -1]) {
    const z = 4 - i * 7.5 - r() * 2, h = 4 + r() * 6, w = 5 + r() * 2, c = cols[(i * 3 + (side > 0 ? 1 : 4)) % 7];
    const win = canvasTex(64, 64, (x, W, H) => { x.fillStyle = hex(c); x.fillRect(0, 0, W, H); x.fillStyle = '#9fc9e6'; x.fillRect(12, 12, 16, 18); x.fillRect(36, 12, 16, 18); x.fillRect(12, 38, 16, 18); x.fillRect(36, 38, 16, 18); });
    win.wrapS = win.wrapT = THREE.RepeatWrapping; win.repeat.set(w / 2.5, h / 2.5);
    box(4, h, w, M(0xffffff, { std: true, map: win }), S.stretch, side > 0 ? 6.0 : -8.2, h / 2, z, false);
  }
  for (let i = 0; i < 30; i++) { const z = 2 - i * 5.5; cyl(0.05, 0.06, 3.0, 6, M(0x5d6b7a, { std: true }), S.stretch, 3.6, 1.5, z); box(0.5, 0.1, 0.18, M(0x5d6b7a), S.stretch, 3.4, 3.0, z); ico(0.08, 0, M(0xfff6d0, { emissive: 0xfff0b0, ei: 0.6 }), S.stretch, 3.2, 2.92, z, false);
    if (i % 2 === 0) { cyl(0.12, 0.15, 1.6, 6, M(0xb08060), S.stretch, 1.2, 0.8, z - 2.7); const t = ico(0.9, 1, M([0x8fd18f, 0x7cc48a, 0x9fdc9a][i % 3], { std: true }), S.stretch, 1.2, 2.2, z - 2.7); t.scale.y = 0.9; } }
  S.house = makeHouse(G, 1.0); S.house.position.set(0.5, 0, -48); S.house.rotation.y = 0;
  return S;
}
// ===================== FRONT PORCH =====================
export function buildPorch(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(PO); scene.add(G);
  const g = mesh(new THREE.PlaneGeometry(30, 30), M(0xa8d8a0), G, 0, -0.02, 4); g.rotation.x = -PI / 2;
  box(3.0, 0.16, 2.2, M(0xe8e0d2, { std: true }), G, 0, 0.08, 1.0); box(1.6, 0.16, 6, M(0xe8e0d2, { std: true }), G, 0, 0.02, 5);
  const wall = M(0xffd6c4, { std: true, r: 0.9 });
  box(2.5, 3.4, 0.25, wall, G, -2.0, 1.7, -0.12, false); box(2.5, 3.4, 0.25, wall, G, 2.0, 1.7, -0.12, false); box(1.6, 1.1, 0.25, wall, G, 0, 2.85, -0.12, false);
  for (const x of [-2.1, 2.1]) { box(1.0, 1.0, 0.08, M(0xbfe6f7, { std: true, emissive: 0xfff2b0, ei: 0.2 }), G, x, 1.8, 0.03); }
  // the door (hinged on its left edge) + golden light behind it
  S.glow = mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }), G, 0, 1.15, -0.2, false);
  S.door = new THREE.Group(); S.door.position.set(-0.75, 0.16, 0.02); G.add(S.door);
  box(1.5, 2.2, 0.08, M(0x6aa88a, { std: true }), S.door, 0.75, 1.1, 0);
  for (const [y, h] of [[1.55, 0.7], [0.6, 0.7]]) box(1.1, h, 0.03, M(0x5a9878, { std: true }), S.door, 0.75, y, 0.05);
  S.knob = cyl(0.045, 0.045, 0.08, 10, M(0xe0c060, { std: true, metal: 0.5, r: 0.3 }), S.door, 1.3, 1.05, 0.08); S.knob.rotation.x = PI / 2;
  S.lock = cyl(0.03, 0.03, 0.04, 10, M(0xc8ccd2, { std: true, metal: 0.6, r: 0.3 }), S.door, 1.3, 1.2, 0.06); S.lock.rotation.x = PI / 2;
  S.lockPos = V(PO.x - 0.75 + 1.3, 1.36, 0.1);
  // doormat (WELCOME), plant pot, porch lamp
  const mt = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#c9a271'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a5a3a'; x.font = `56px ${FONT}`; x.textAlign = 'center'; x.fillText('WELCOME', w / 2, 82); });
  S.mat = new THREE.Group(); S.mat.position.set(0, 0.17, 0.75); G.add(S.mat);
  box(1.2, 0.025, 0.6, [M(0xc9a271), M(0xc9a271), M(0xffffff, { std: true, map: mt }), M(0xc9a271), M(0xc9a271), M(0xc9a271)].length ? M(0xc9a271, { std: true }) : null, S.mat, 0, 0, 0.3);
  mesh(new THREE.PlaneGeometry(1.18, 0.58), M(0xffffff, { std: true, map: mt }), S.mat, 0, 0.014, 0.3, false).rotation.x = -PI / 2;
  S.mat.children.forEach(c => c.position.z = 0.3); S.mat.position.z = 0.45;
  const pot = new THREE.Group(); pot.position.set(1.05, 0.16, 0.7); G.add(pot);
  cyl(0.22, 0.16, 0.42, 10, M(0xe8735f, { std: true }), pot, 0, 0.21, 0); const r = RNG(2);
  for (let i = 0; i < 9; i++) { const l = new THREE.Group(); l.rotation.set(0.3 + r() * 0.5, i / 9 * PI * 2, 0, 'YXZ'); l.position.y = 0.42; pot.add(l); const lf = ico(1, 0, M(0x6fbf7a, { std: true }), l, 0, 0.3, 0); lf.scale.set(0.07, 0.3, 0.02); }
  box(0.18, 0.28, 0.18, M(0xfff3c4, { std: true, emissive: 0xffe08a, ei: 0.7 }), G, 1.0, 2.35, 0.05);
  return S;
}
// ===================== HALLWAY =====================
export function buildHall(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(HA); scene.add(G);
  const wood = canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e7cfa5' : '#dfc497'; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(0, i * 32, w, 2); } });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(1, 4);
  box(2.4, 0.06, 10, M(0xffffff, { std: true, map: wood }), G, 0, -0.03, 0);
  box(1.1, 0.012, 9, M(0x9fc9ee, { std: true }), G, 0, 0.005, 0);
  const wm = M(0xd8ecf2, { std: true, r: 0.95 });
  for (const s of [1, -1]) box(0.15, 2.8, 10, wm, G, 1.2 * s, 1.4, 0, false);
  box(2.4, 0.1, 10, M(0xffffff), G, 0, 2.8, 0, false);
  for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1; const f = canvasTex(64, 48, (x, w, h) => { x.fillStyle = hex([0xffb3cf, 0xa9d6f2, 0xffe48f, 0x9ee0c8][i]); x.fillRect(0, 0, w, h); x.fillStyle = '#f0c4a0'; x.beginPath(); x.arc(w / 2, h / 2, 10, 0, PI * 2); x.fill(); });
    const g2 = new THREE.Group(); g2.position.set(1.1 * s, 1.6, 2.5 - i * 1.6); g2.rotation.y = -PI / 2 * s; G.add(g2); box(0.5, 0.4, 0.03, M(0xffffff), g2, 0, 0, 0); mesh(new THREE.PlaneGeometry(0.42, 0.32), M(0xffffff, { std: true, map: f }), g2, 0, 0, 0.017, false); }
  // bathroom door at the end (z = -4.4), with a sign and a light gap under it
  box(2.4, 2.8, 0.15, wm, G, 0, 1.4, -4.55, false);
  S.bdoor = new THREE.Group(); S.bdoor.position.set(0, 0.06, -4.45); G.add(S.bdoor);
  box(1.0, 2.1, 0.07, M(0xf3e3c9, { std: true }), S.bdoor, 0, 1.05, 0); cyl(0.04, 0.04, 0.08, 10, M(0xe0c060, { std: true, metal: 0.5 }), S.bdoor, 0.38, 1.0, 0.06).rotation.x = PI / 2;
  const sg = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(64, 64, 60, 0, PI * 2); x.fill(); x.fillStyle = '#4a7ab0'; x.font = `64px ${FONT}`; x.textAlign = 'center'; x.fillText('WC', 64, 86); });
  mesh(new THREE.PlaneGeometry(0.28, 0.28), M(0xffffff, { std: true, map: sg }), S.bdoor, 0, 1.6, 0.04, false);
  S.gap = mesh(new THREE.PlaneGeometry(1.0, 0.07), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), G, 0, 0.045, -4.40, false);
  S.gapPos = V(HA.x, 0.05, -4.38);
  return S;
}
// ===================== props & extras =====================
export function makeBackpack(m) {
  const g = new THREE.Group(); g.position.set(0, 0.22, -0.17); m.spine.add(g); const c = M(0xe8735f, { std: true, r: 0.8 });
  box(0.34, 0.42, 0.18, c, g, 0, 0, 0); box(0.26, 0.16, 0.06, M(0xd8604c, { std: true }), g, 0, -0.08, -0.11); box(0.36, 0.03, 0.2, M(0x3a3a40), g, 0, 0.13, 0);
  for (const s of [1, -1]) { const st = box(0.05, 0.42, 0.02, M(0x3a3a40, { std: true }), m.spine, 0.11 * s, 0.25, 0.122); st.rotation.x = 0.05; }
  m.backpack = g; return g;
}
export function makeDog(parent) {
  const g = new THREE.Group(); parent.add(g); const c = M(0xd9a86a, { std: true, r: 0.8 }), d = M(0x9a6a3a, { std: true });
  const body = box(0.42, 0.2, 0.2, c, g, 0, 0.3, 0); const head = new THREE.Group(); head.position.set(0.26, 0.42, 0); g.add(head);
  box(0.18, 0.16, 0.16, c, head, 0, 0, 0); box(0.08, 0.06, 0.08, c, head, 0.11, -0.03, 0); box(0.03, 0.03, 0.03, M(P.ink), head, 0.16, -0.01, 0);
  for (const s of [1, -1]) { box(0.05, 0.1, 0.03, d, head, -0.02, 0.07, 0.06 * s).rotation.x = 0.4 * s; box(0.02, 0.02, 0.01, M(P.ink), head, 0.08, 0.03, 0.07 * s); }
  const legs = []; for (const [x, z] of [[0.15, 0.07], [0.15, -0.07], [-0.15, 0.07], [-0.15, -0.07]]) { const l = new THREE.Group(); l.position.set(x, 0.22, z); g.add(l); box(0.05, 0.22, 0.05, c, l, 0, -0.11, 0); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(-0.21, 0.36, 0); g.add(tail); box(0.03, 0.14, 0.03, c, tail, 0, 0.07, 0).rotation.z = 0.5;
  return { g, head, legs, tail };
}
export function makeBike(parent) {
  const g = new THREE.Group(); parent.add(g); const fr = M(0xff8f86, { std: true }), tm = M(0x2c2f36, { std: true });
  const wheels = []; for (const x of [-0.42, 0.42]) { const w = mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 18), tm, g, x, 0.29, 0); wheels.push(w); for (let k = 0; k < 3; k++) { const sp = box(0.01, 0.5, 0.01, M(0xc0c7cf), w, 0, 0, 0); sp.rotation.z = k * PI / 3; } }
  const a = box(0.86, 0.04, 0.04, fr, g, 0, 0.55, 0); const b = box(0.04, 0.4, 0.04, fr, g, -0.12, 0.45, 0); b.rotation.z = 0.4; const c = box(0.04, 0.45, 0.04, fr, g, 0.36, 0.5, 0); c.rotation.z = -0.3;
  box(0.18, 0.04, 0.1, M(0x2c2f36), g, -0.16, 0.72, 0); const h = box(0.04, 0.04, 0.4, M(0x2c2f36), g, 0.42, 0.78, 0);
  return { g, wheels };
}
export function makeSnail(parent) {
  const g = new THREE.Group(); parent.add(g);
  const body = ico(0.06, 1, M(0xb9d98a, { std: true, r: 0.4 }), g, 0, 0.03, 0); body.scale.set(2.4, 0.6, 0.9);
  const shell = mesh(new THREE.TorusGeometry(0.06, 0.035, 8, 16), M(0xe8a46a, { std: true }), g, -0.02, 0.1, 0); shell.scale.set(1, 1, 0.9);
  ico(0.04, 1, M(0xd98a52, { std: true }), g, -0.02, 0.1, 0);
  for (const s of [1, -1]) { const st = cyl(0.006, 0.006, 0.08, 4, M(0xb9d98a), g, 0.13, 0.09, 0.02 * s); st.rotation.z = -0.4; box(0.02, 0.02, 0.02, M(P.ink), g, 0.15, 0.13, 0.02 * s); }
  return g;
}
export function makeKeys(parent) {
  const g = new THREE.Group(); parent.add(g); const km = M(0xe0c060, { std: true, metal: 0.6, r: 0.3 }), sm = M(0xc8ccd2, { std: true, metal: 0.6, r: 0.3 });
  mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 14), sm, g, 0, 0, 0);
  for (const [a, m] of [[0.4, km], [-0.5, sm]]) { const k = new THREE.Group(); k.rotation.z = a; g.add(k); cyl(0.02, 0.02, 0.006, 10, m, k, 0, -0.045, 0).rotation.x = PI / 2; box(0.008, 0.06, 0.004, m, k, 0, -0.085, 0); }
  return g;
}
