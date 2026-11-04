import * as THREE from 'three';
import { mat, mesh, bx, faceted, Guest } from './chars.js';
import { WT } from './wtex.js';
import { rng, signTexture } from './pixel.js';

export const SET = {
  church: new THREE.Vector3(0, 0, 0),
  hall: new THREE.Vector3(40, 0, 0),
  bath: new THREE.Vector3(60, 0, 0),
  park: new THREE.Vector3(100, 0, 0),
  kids: new THREE.Vector3(140, 0, 0),
};
const add = (p, m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; };
const plane = (w, h, m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.receiveShadow = true; return p; };
const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
const basic = (map) => new THREE.MeshBasicMaterial({ map });

export function buildSets(scene) {
  const W = {};
  W.hemi = new THREE.HemisphereLight(0xffe9cc, 0x5a4030, 0.85); scene.add(W.hemi);
  W.amb = new THREE.AmbientLight(0xffd8a8, 0.15); scene.add(W.amb);
  W.sun = new THREE.DirectionalLight(0xffdcae, 1.5);
  W.sun.castShadow = true; W.sun.shadow.mapSize.set(2048, 2048); W.sun.shadow.bias = -0.0006; W.sun.shadow.normalBias = 0.03;
  scene.add(W.sun, W.sun.target);
  W.sunAt = (c, size = 10, off = [5, 12, 6]) => {
    W.sun.target.position.copy(c); W.sun.position.copy(c).add(new THREE.Vector3(...off));
    Object.assign(W.sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 60 });
    W.sun.shadow.camera.updateProjectionMatrix();
  };
  buildChurch(scene, W);
  buildHall(scene, W);
  buildBath(scene, W);
  buildPark(scene, W);
  buildKids(scene, W);
  return W;
}

// ================================================================ church
export const PEW_ROWS = 13;
export const pewZ = r => -13 + r * 1.65;
function buildChurch(scene, W) {
  const C = new THREE.Group(); scene.add(C);
  add(C, plane(16, 34, mat(rep(WT.floor, 8, 17), { flatShading: false })), 0, 0, -5, -Math.PI / 2);
  const wallM = (len, h = 10) => mat(rep(WT.stone, len / 3, h / 3), { flatShading: false });
  add(C, plane(34, 10, wallM(34)), -8, 5, -5, 0, Math.PI / 2);
  // right wall with the side door gap (z -15.2..-13.8)
  add(C, plane(26.2, 10, wallM(26.2)), 8, 5, -0.7 + 0.0, 0, -Math.PI / 2);
  add(C, plane(6.8, 10, wallM(6.8)), 8, 5, -18.6, 0, -Math.PI / 2);
  add(C, plane(1.4, 7.6, wallM(1.4, 7.6)), 8, 6.2, -14.5, 0, -Math.PI / 2);
  add(C, plane(16, 10, wallM(16)), 0, 5, -22);
  add(C, plane(16, 10, wallM(16)), 0, 5, 12, 0, Math.PI);
  add(C, plane(16, 34, mat(0x5a3b24, { flatShading: false })), 0, 10, -5, Math.PI / 2);
  for (let z = -20; z <= 10; z += 4) { const b = bx(16, 0.35, 0.35, mat(rep(WT.wood, 4, 1))); b.position.set(0, 9.8, z); C.add(b); }
  // aisle carpet + petals
  add(C, plane(1.8, 28.5, mat(WT.carpet, { flatShading: false })), 0, 0.01, -3.25, -Math.PI / 2);
  const R = rng(5);
  const petalM = [mat(0xff8fb8), mat(0xfff4f0), mat(0xff6fa0)];
  W.aislePetals = [];
  for (let k = 0; k < 120; k++) {
    const p = bx(0.07, 0.006, 0.06, petalM[k % 3], false);
    p.position.set((R() - 0.5) * 1.6, 0.016, -16.5 + R() * 27); p.rotation.y = R() * 3;
    C.add(p); W.aislePetals.push(p);
  }
  // pews and guests
  const wood = mat(rep(WT.wood, 3, 1));
  W.pews = [];
  for (let r = 0; r < PEW_ROWS; r++) {
    const z = pewZ(r);
    for (const side of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(side * 4.15, 0, z); C.add(g);
      add(g, bx(5.6, 0.1, 0.55, wood), 0, 0.46, 0);
      add(g, bx(5.6, 0.7, 0.08, wood), 0, 0.85, -0.3);
      add(g, bx(5.6, 0.42, 0.08, wood), 0, 0.21, 0.22);
      for (const e of [-1, 1]) add(g, bx(0.1, 1.05, 0.65, wood), e * 2.82, 0.52, -0.02);
      W.pews.push(g);
      // flowers on the aisle end
      const fl = new THREE.Group(); fl.position.set(side * 1.3, 1.0, z - 0.25); C.add(fl);
      for (let k = 0; k < 5; k++) { const b = mesh(faceted(0.09, r * 10 + k, [1, 1, 1], 0), mat([0xffffff, 0xff9ec2, 0xffd6e6][k % 3]), false); b.position.set((R() - 0.5) * 0.2, (R() - 0.5) * 0.15, (R() - 0.5) * 0.1); fl.add(b); }
      add(fl, bx(0.04, 0.2, 0.04, mat(0x4a8a3a)), 0, -0.15, 0);
    }
  }
  W.guests = [];
  const skins = [0xf1c9a5, 0xe0ab84, 0xc68a5c, 0xa86f48, 0x8a5a3c, 0xf4d2b4];
  const hairs = [0x2a1a10, 0x111111, 0x6b4a2e, 0xc9a24a, 0x8a8a8a, 0xa0522d, 0xdedede];
  const cloths = [0x2f3a5a, 0x7a2a3a, 0x3a6a5a, 0xc9a6d9, 0xf2c8a0, 0x4a4a52, 0x8fbcd9, 0xe6a6b8, 0x6a5a3a, 0x2a2a2e];
  let gi = 0;
  for (let r = 1; r < PEW_ROWS; r++) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        if (R() < 0.08) continue;
        const o = { skin: skins[Math.floor(R() * 6)], hair: hairs[Math.floor(R() * 7)], cloth: cloths[Math.floor(R() * 10)], long: R() < 0.4, hat: R() < 0.12 ? [0xd9a6c9, 0x2a2a2e, 0xf2e6c9][Math.floor(R() * 3)] : 0 };
        const g = new Guest(o, 100 + gi++);
        g.root.position.set(side * (1.75 + k * 1.3 + (R() - 0.5) * 0.25), 0, pewZ(r) + 0.02);
        g.root.rotation.y = Math.PI + (R() - 0.5) * 0.15; // facing the altar (-z)
        g.row = r; g.side = side;
        C.add(g.root); W.guests.push(g);
      }
    }
  }
  // altar platform, table, arch
  add(C, bx(16, 0.22, 5, mat(rep(WT.wood, 4, 2))), 0, 0.11, -19.5);
  add(C, bx(10, 0.22, 4.4, mat(rep(WT.wood, 3, 2))), 0, 0.33, -19.8);
  add(C, plane(1.8, 4.4, mat(WT.carpet, { flatShading: false })), 0, 0.452, -19.8, -Math.PI / 2);
  add(C, bx(2.2, 1.0, 0.9, mat(WT.dress)), 0, 0.95, -21.0);
  for (const x of [-0.8, 0.8]) { add(C, mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0xfff8e6)), x, 1.65, -21.0); add(C, mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd36a })), x, 1.9, -21.0); }
  const arch = new THREE.Group(); arch.position.set(0, 0.44, -18.9); C.add(arch);
  const tor = mesh(new THREE.TorusGeometry(1.9, 0.09, 6, 18, Math.PI), mat(0xf2efe6)); tor.position.y = 1.6; arch.add(tor);
  for (const x of [-1.9, 1.9]) add(arch, bx(0.16, 1.6, 0.16, mat(0xf2efe6)), x, 0.8, 0);
  const R2 = rng(9);
  for (let k = 0; k < 34; k++) {
    const a = (k / 33) * Math.PI;
    const b = mesh(faceted(0.17 + R2() * 0.08, 200 + k, [1, 1, 1], 0), mat([0xffffff, 0xff9ec2, 0xffc6d9, 0x7fbf6a][k % 4]), false);
    b.position.set(Math.cos(a) * 1.9, 1.6 + Math.sin(a) * 1.9, 0.08); arch.add(b);
  }
  // stained glass windows
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = -15 + i * 7.5;
    const w = add(C, plane(1.6, 3.6, basic(WT.stained[i % 3])), side * 7.97, 5.2, z, 0, -side * Math.PI / 2);
    const fr = bx(0.1, 3.8, 1.8, mat(0x6b4a2e)); fr.position.set(side * 7.99, 5.2, z); C.add(fr);
    fr.scale.set(1, 1, 1); fr.material = mat(0x4a3220);
    C.remove(fr);
  }
  const rose = add(C, mesh(new THREE.CircleGeometry(1.4, 12), basic(WT.stained[1])), 0, 6.8, -21.96);
  // chandelier (pivot at the ceiling so it can swing)
  const ch = new THREE.Group(); ch.position.set(0, 10, -5); C.add(ch);
  add(ch, mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), mat(0x2a2a2a)), 0, -1.1, 0);
  const gold = mat(0xd9b24a, { metalness: 0.6, roughness: 0.35 });
  add(ch, mesh(new THREE.CylinderGeometry(0.25, 0.12, 0.5, 8), gold), 0, -2.45, 0);
  for (const [rad, y, n] of [[1.1, -2.6, 10], [0.65, -2.25, 6]]) {
    add(ch, mesh(new THREE.TorusGeometry(rad, 0.05, 5, 16), gold), 0, y, 0, Math.PI / 2);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      add(ch, mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 5), mat(0xfff8e6)), Math.cos(a) * rad, y + 0.15, Math.sin(a) * rad);
      add(ch, mesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd36a }), false), Math.cos(a) * rad, y + 0.3, Math.sin(a) * rad);
    }
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(ch, mesh(new THREE.OctahedronGeometry(0.06), mat(0xe8f4ff, { metalness: 0.3, roughness: 0.1 })), Math.cos(a) * 1.1, -2.85, Math.sin(a) * 1.1); }
  W.chandelier = ch;
  W.chLight = new THREE.PointLight(0xffcf8a, 18, 16, 1.4); W.chLight.position.set(0, -2.4, 0); ch.add(W.chLight);
  W.altarLight = new THREE.PointLight(0xffe0b0, 10, 12, 1.5); W.altarLight.position.set(0, 4, -17); C.add(W.altarLight);
  // side door (right wall) to the bathroom hallway
  const df = mat(0x4a3220);
  for (const [w, h, z, y] of [[0.14, 2.5, -15.25, 1.25], [0.14, 2.5, -13.75, 1.25], [1.64, 0.14, -14.5, 2.45]]) { const f = bx(0.14, h, w === 1.64 ? 1.64 : 0.14, df); f.position.set(7.98, y, z); C.add(f); }
  const door = new THREE.Group(); door.position.set(7.97, 0, -15.2); C.add(door);
  add(door, bx(0.07, 2.4, 1.38, mat(rep(WT.wood, 1, 3))), 0, 1.2, 0.69);
  add(door, mesh(new THREE.SphereGeometry(0.05, 6, 4), gold), -0.07, 1.1, 1.2);
  W.sideDoor = door;
  add(C, plane(1.4, 2.4, new THREE.MeshBasicMaterial({ color: 0x3a2c22 })), 8.6, 1.2, -14.5, 0, -Math.PI / 2);
  // organ
  const org = new THREE.Group(); org.position.set(-6.6, 0, -16.5); C.add(org);
  add(org, bx(1.2, 1.1, 1.8, mat(rep(WT.wood, 1, 1))), -0.4, 0.55, 0);
  add(org, bx(0.4, 0.06, 1.6, mat(0xf4f1ea)), 0.25, 1.0, 0);
  for (let k = 0; k < 12; k++) add(org, bx(0.06, 0.03, 0.08, mat(0x111111)), 0.3, 1.04, -0.66 + k * 0.12);
  add(org, bx(0.25, 0.08, 1.6, mat(0xd9c9a8)), 0.2, 1.2, 0, 0, 0, -0.5);
  for (let k = 0; k < 11; k++) { const h = 2.2 + Math.sin(k / 10 * Math.PI) * 1.8; add(org, mesh(new THREE.CylinderGeometry(0.11, 0.11, h, 8), mat(WT.pipe)), -1.15, 1.2 + h / 2, -1.0 + k * 0.2); }
  const bench = bx(0.45, 0.08, 1.2, mat(rep(WT.wood, 1, 1))); bench.position.set(-6.6 + 1.05, 0.48, -16.5); C.add(bench);
  W.organ = org; W.organSeat = new THREE.Vector3(-6.6 + 1.05, 0, -16.5);
  // "Reserved: Mom" sign on the front-left pew, aisle seat
  const sign = new THREE.Group(); sign.position.set(-1.75, 0.52, pewZ(0) + 0.05); C.add(sign);
  add(sign, bx(0.42, 0.24, 0.03, mat(0x5a3a20)), 0, 0.12, 0, -0.25);
  add(sign, plane(0.4, 0.2, basic(WT.reserved)), 0, 0.12, 0.02, -0.25);
  W.reservedSign = sign;
}

// ================================================================ hallway to the WC
function buildHall(scene, W) {
  const H = new THREE.Group(); H.position.copy(SET.hall); scene.add(H);
  add(H, plane(3, 16, mat(rep(WT.floor, 2, 10), { flatShading: false })), 0, 0, -5, -Math.PI / 2);
  add(H, plane(1.2, 15, mat(WT.carpet, { flatShading: false })), 0, 0.01, -5, -Math.PI / 2);
  for (const s of [-1, 1]) add(H, plane(16, 3.4, mat(rep(WT.stone, 5, 1.2), { flatShading: false })), s * 1.4, 1.7, -5, 0, -s * Math.PI / 2);
  add(H, plane(3, 16, mat(0x5a3b24, { flatShading: false })), 0, 3.4, -5, Math.PI / 2);
  add(H, plane(3, 3.4, mat(rep(WT.stone, 1, 1.2), { flatShading: false })), 0, 1.7, -12.5);
  for (const z of [-1, -5, -9]) for (const s of [-1, 1]) {
    const l = add(H, bx(0.12, 0.25, 0.2, mat(0xd9b24a)), s * 1.33, 2.3, z);
    add(H, mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), false), s * 1.28, 2.45, z);
  }
  for (const z of [-3, -7]) for (const s of [-1, 1]) add(H, bx(0.06, 2.1, 0.95, mat(rep(WT.wood, 1, 3))), s * 1.37, 1.05, z);
  W.hallLight = new THREE.PointLight(0xffd6a0, 8, 12, 1.5); W.hallLight.position.set(0, 2.8, -6); H.add(W.hallLight);
  // the WC door at the end
  const door = new THREE.Group(); door.position.set(-0.48, 0, -12.45); H.add(door);
  add(door, bx(0.96, 2.2, 0.07, mat(rep(WT.wood, 1, 3))), 0.48, 1.1, 0);
  add(door, mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0xd9b24a)), 0.85, 1.05, 0.06);
  W.wcDoor = door;
  add(H, plane(0.5, 0.3, basic(signTexture('WC', { w: 24, h: 14, bg: 0xf6f3ea, fg: 0x1b3a8a, border: 0x1b3a8a }))), 0, 2.5, -12.44);
  add(H, plane(1.0, 2.2, new THREE.MeshBasicMaterial({ color: 0xe8f0f2 })), 0, 1.1, -12.6);
}

// ================================================================ bathroom with one stall
function buildBath(scene, W) {
  const B = new THREE.Group(); B.position.copy(SET.bath); scene.add(B);
  const tile = (w, h) => mat(rep(WT.tile, w / 0.8, h / 0.8), { flatShading: false });
  add(B, plane(5, 5, tile(5, 5)), 0, 0, 0, -Math.PI / 2);
  add(B, plane(5, 3, tile(5, 3)), 0, 1.5, -2.5);
  add(B, plane(5, 3, tile(5, 3)), -2.5, 1.5, 0, 0, Math.PI / 2);
  add(B, plane(5, 3, tile(5, 3)), 2.5, 1.5, 0, 0, -Math.PI / 2);
  add(B, plane(5, 3, tile(5, 3)), 0, 1.5, 2.5, 0, Math.PI);
  add(B, plane(5, 5, mat(0xf4f4f0, { flatShading: false })), 0, 3, 0, Math.PI / 2);
  const stallM = mat(WT.stall);
  // stall: side panel at x=0.3 (z -2.5..0.3), front at z=0.3 (x 0.3..2.5), door x 0.9..1.9
  add(B, bx(0.05, 1.9, 2.8, stallM), 0.3, 1.2, -1.1);
  add(B, bx(0.6, 1.9, 0.05, stallM), 0.6, 1.2, 0.3);
  add(B, bx(0.6, 1.9, 0.05, stallM), 2.2, 1.2, 0.3);
  add(B, bx(1.0, 0.1, 0.05, stallM), 1.4, 2.12, 0.3);
  const door = new THREE.Group(); door.position.set(0.9, 0, 0.3); B.add(door);
  add(door, bx(1.0, 1.75, 0.05, stallM), 0.5, 1.2, 0);
  add(door, bx(0.1, 0.06, 0.06, mat(0xbfc5cc)), 0.85, 1.2, 0.05);
  W.stallDoor = door;
  // toilet
  const porc = mat(0xf7f7f4);
  const toilet = new THREE.Group(); toilet.position.set(1.4, 0, -1.6); B.add(toilet);
  add(toilet, mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 8), porc), 0, 0.21, 0.1);
  add(toilet, mesh(new THREE.TorusGeometry(0.2, 0.05, 5, 10), porc), 0, 0.44, 0.12, Math.PI / 2);
  add(toilet, bx(0.46, 0.5, 0.2, porc), 0, 0.65, -0.18);
  W.toilet = toilet;
  const roll = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 8), mat(0xffffff)); roll.rotation.z = Math.PI / 2; roll.position.set(0.42, 0.75, -1.2); B.add(roll);
  // sink + mirror on the left
  add(B, bx(0.5, 0.15, 0.6, porc), -2.2, 0.9, -1.0);
  add(B, plane(0.05, 1, mat(0xcfe8f0, { roughness: 0.1, metalness: 0.3 })), -2.47, 1.7, -1.0, 0, Math.PI / 2).scale.set(14, 1, 1);
  W.bathLight = new THREE.PointLight(0xfff2dc, 7, 8, 1.5); W.bathLight.position.set(0, 2.7, 0); B.add(W.bathLight);
}

// ================================================================ parking lot
function buildPark(scene, W) {
  const P = new THREE.Group(); P.position.copy(SET.park); scene.add(P);
  add(P, plane(60, 60, mat(rep(WT.asphalt, 12, 12), { flatShading: false })), 0, 0, 0, -Math.PI / 2);
  for (let k = -5; k <= 5; k++) add(P, bx(0.12, 0.01, 4.5, mat(0xf2f2ea), false), k * 2.6, 0.006, -2);
  // church facade
  add(P, bx(20, 9, 1, mat(rep(WT.brick, 6, 3))), 0, 4.5, -8);
  add(P, mesh(new THREE.ConeGeometry(2.4, 4, 4), mat(0x6a3a2a)), 0, 11, -8, 0, Math.PI / 4);
  add(P, bx(2.2, 6, 2.2, mat(rep(WT.brick, 1, 2))), 0, 6, -8);
  add(P, plane(1.4, 2.4, basic(WT.stained[0])), -4, 4.8, -7.48);
  add(P, plane(1.4, 2.4, basic(WT.stained[2])), 4, 4.8, -7.48);
  add(P, bx(2.0, 2.8, 0.1, mat(rep(WT.wood, 1, 3))), 0, 1.4, -7.46);
  for (const x of [-12, 12]) { add(P, mesh(new THREE.CylinderGeometry(0.2, 0.25, 2, 6), mat(0x6b4a2e)), x, 1, -3); add(P, mesh(faceted(1.6, x + 70, [1, 1.2, 1], 1, 0.2), mat(0x5fa94f)), x, 3.2, -3); }
  // parked cars + mom's car
  const car = (col) => {
    const c = new THREE.Group();
    add(c, bx(1.8, 0.62, 3.8, mat(col)), 0, 0.55, 0);
    add(c, bx(1.62, 0.6, 2.0, mat(col)), 0, 1.15, -0.25);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd0ef, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
    add(c, plane(1.5, 0.5, glass), 0, 1.17, 0.77, -0.35);
    add(c, plane(1.5, 0.5, glass), 0, 1.17, -1.27, 0.25, Math.PI);
    for (const s of [-1, 1]) add(c, plane(1.8, 0.48, glass), s * 0.815, 1.17, -0.25, 0, s * Math.PI / 2);
    const wheels = [];
    for (const [x, z] of [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.25], [0.9, -1.25]]) { const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), mat(0x1a1a1a)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); c.add(w); wheels.push(w); }
    for (const x of [-0.6, 0.6]) add(c, bx(0.3, 0.14, 0.04, new THREE.MeshBasicMaterial({ color: 0xfff6c8 })), x, 0.65, 1.91);
    c.userData.wheels = wheels;
    return c;
  };
  for (const [x, col] of [[-7.8, 0x3a6aa8], [-2.6, 0xd8d8d8], [5.2, 0x2a2a2e], [7.8, 0xb03a2e]]) { const c = car(col); c.position.set(x, 0, -2); P.add(c); }
  W.momCar = car(0xf2b8c8); P.add(W.momCar);
  W.momCarHome = new THREE.Vector3(SET.park.x + 1.6, 0, SET.park.z + 3.5);
  const wheel = mesh(new THREE.TorusGeometry(0.17, 0.03, 5, 12), mat(0x222222)); wheel.position.set(-0.4, 1.1, 0.35); wheel.rotation.x = -0.5; W.momCar.add(wheel);
  W.momWheel = wheel;
  const seat = bx(0.55, 0.12, 0.5, mat(0x5a4a3a)); seat.position.set(-0.4, 0.62, -0.25); W.momCar.add(seat);
}

// ================================================================ flashback: kids with toilet paper
function buildKids(scene, W) {
  const K = new THREE.Group(); K.position.copy(SET.kids); scene.add(K);
  add(K, plane(14, 14, mat(0xbfe6ff, { flatShading: false })), 0, 0, 0, -Math.PI / 2);
  add(K, plane(14, 6, mat(0xfff0a8, { flatShading: false })), 0, 3, -3);
  for (let k = 0; k < 8; k++) add(K, bx(0.9, 0.9, 0.05, mat([0xff8fb8, 0x8fd3ff, 0xa8e68f, 0xffd36a][k % 4])), -5.25 + k * 1.5, 3.6, -2.95);
  W.kidsBanner = K;
}
