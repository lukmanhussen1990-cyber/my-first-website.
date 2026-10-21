// Shopping cart (wire basket, red handle, casters) + John's upgrades.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';

let shared = null;
function mats() {
  if (shared) return shared;
  const scratch = TX.makeScratches();
  shared = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1.0, roughness: 0.2, roughnessMap: scratch, envMapIntensity: 1.25 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xc7ccd3, metalness: 1.0, roughness: 0.28, roughnessMap: scratch, envMapIntensity: 1.1 }),
    redPlastic: new THREE.MeshStandardMaterial({ color: 0xd8262b, roughness: 0.32 }),
    greyPlastic: new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1e1f23, roughness: 0.82 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.4, metalness: 0.6 }),
  };
  return shared;
}

// ---- wire helper: collects cylinders and bakes one InstancedMesh per radius class
class WireSet {
  constructor() { this.items = []; }
  add(a, b, r) { this.items.push([a.clone(), b.clone(), r]); }
  poly(pts, r, closed = false) { for (let i = 0; i < pts.length - 1; i++) this.add(pts[i], pts[i + 1], r); if (closed) this.add(pts[pts.length - 1], pts[0], r); }
  build(mat, radial = 7) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, radial, 1, false); geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, this.items.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    this.items.forEach(([a, b, r], i) => {
      d.subVectors(b, a); const L = d.length(); d.normalize();
      q.setFromUnitVectors(up, d);
      // slight overlap so joints look welded
      M.compose(a.clone().addScaledVector(d, -r * 0.6), q, new THREE.Vector3(r, L + r * 1.2, r));
      mesh.setMatrixAt(i, M);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Cart local frame: +X forward, +Y up, +Z = cart's right side.
export const CART = {
  wheelR: 0.07,
  frontX: 0.36, rearX: -0.37, frontZ: 0.2, rearZ: 0.245,
  basketY: 0.5, rimYBack: 0.95, rimYFront: 0.9,
  nest: 0.27, halfW: 0.3, halfL: 0.48,
};

function makeCaster(m, front) {
  const g = new THREE.Group(); // swivel pivot at top
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), m.hub); plate.position.y = 0; g.add(plate);
  const fork = new THREE.Group(); g.add(fork);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.11, 0.008, 1, 0.003), m.hub);
    f.position.set(front ? -0.018 : 0, -0.055, s * 0.024); fork.add(f);
  }
  const wheel = new THREE.Group(); wheel.position.set(front ? -0.025 : 0, -0.095, 0); g.add(wheel);
  const tireProf = []; const R = CART.wheelR, W = 0.034;
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; tireProf.push(new THREE.Vector2(R - 0.012 + Math.cos(a) * 0.012, Math.sin(a) * W / 2)); }
  tireProf.unshift(new THREE.Vector2(0.03, -W / 2)); tireProf.push(new THREE.Vector2(0.03, W / 2));
  const tg = new THREE.LatheGeometry(tireProf, 24); tg.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(tg, m.rubber); tire.castShadow = true; wheel.add(tire);
  const hubG = new THREE.CylinderGeometry(0.032, 0.032, W + 0.004, 16); hubG.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubG, m.hub); wheel.add(hub);
  // a visible spoke mark so rotation reads
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, W + 0.008), m.greyPlastic); wheel.add(mark);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, W + 0.03, 8).rotateX(Math.PI / 2), m.chrome); wheel.add(bolt);
  g.userData = { wheel, fork };
  return g;
}

export function makeCart({ decorations = null } = {}) {
  const m = mats();
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // tilts / wobbles
  const W = new WireSet(), F = new WireSet(), T = new WireSet();
  const rw = 0.0048, rr = 0.0095, rf = 0.014;
  const bY = CART.basketY;
  // basket corners: bottom (narrower) and top rim (flared)
  const bx0 = -0.42, bx1 = 0.38, bzB = 0.27, bzF = 0.22;
  const tx0 = -0.47, tx1 = 0.45, tzB = 0.3, tzF = 0.25;
  const tyB = CART.rimYBack, tyF = CART.rimYFront;
  const bot = (u, s) => V(bx0 + (bx1 - bx0) * u, bY, s * (bzB + (bzF - bzB) * u));
  const top = (u, s) => V(tx0 + (tx1 - tx0) * u, tyB + (tyF - tyB) * u, s * (tzB + (tzF - tzB) * u));
  // rims
  T.poly([top(0, -1), top(1, -1), top(1, 1), top(0, 1)], rr, true);
  T.poly([bot(0, -1), bot(1, -1), bot(1, 1), bot(0, 1)], rr, true);
  // mid rails
  for (const k of [0.33, 0.66]) {
    const mid = (u, s) => bot(u, s).lerp(top(u, s), k);
    W.poly([mid(0, -1), mid(1, -1), mid(1, 1), mid(0, 1)], rw * 1.1, true);
  }
  // side verticals
  const nSide = 17;
  for (let i = 0; i <= nSide; i++) { const u = i / nSide; for (const s of [-1, 1]) W.add(bot(u, s), top(u, s), rw); }
  // front + back verticals
  const nEnd = 11;
  for (let i = 1; i < nEnd; i++) {
    const v = -1 + 2 * i / nEnd;
    W.add(bot(1, v), top(1, v), rw);
    W.add(bot(0, v), top(0, v), rw);
  }
  // bottom grid
  for (let i = 1; i < 9; i++) { const v = -1 + 2 * i / 9; W.add(bot(0, v), bot(1, v), rw); }
  for (let i = 1; i < 8; i++) { const u = i / 8; W.add(bot(u, -1), bot(u, 1), rw); }
  // chassis
  const cy = 0.175;
  for (const s of [-1, 1]) {
    F.add(V(CART.rearX - 0.02, cy, s * CART.rearZ), V(CART.frontX + 0.02, cy, s * CART.frontZ), rf);
    // rear post up to handle
    F.poly([V(CART.rearX - 0.02, cy, s * CART.rearZ), V(-0.46, bY, s * 0.27), V(-0.52, 0.98, s * 0.27), V(-0.56, 1.04, s * 0.27)], rf);
    // front strut to basket
    F.add(V(CART.frontX, cy, s * CART.frontZ), V(0.36, bY, s * 0.22), rf * 0.8);
  }
  F.add(V(CART.rearX - 0.02, cy, -CART.rearZ), V(CART.rearX - 0.02, cy, CART.rearZ), rf);
  F.add(V(CART.frontX + 0.02, cy, -CART.frontZ), V(CART.frontX + 0.02, cy, CART.frontZ), rf);
  // lower tray
  for (let i = 0; i <= 6; i++) { const z = -0.2 + 0.4 * i / 6; W.add(V(-0.3, cy + 0.03, z), V(0.3, cy + 0.03, z), rw); }
  body.add(W.build(m.chrome, 6), T.build(m.chrome, 8), F.build(m.frame, 10));
  // red handle + grey end caps
  const hg = new THREE.CylinderGeometry(0.024, 0.024, 0.6, 18); hg.rotateX(Math.PI / 2);
  const handle = new THREE.Mesh(hg, m.redPlastic); handle.position.set(-0.565, 1.045, 0); handle.castShadow = true; body.add(handle);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 10), m.greyPlastic); c.position.set(-0.565, 1.045, s * 0.3); body.add(c); }
  // child-seat flap (red plastic) at the back of the basket
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.2, 0.46, 2, 0.012), m.redPlastic); flap.position.set(-0.46, 0.84, 0); flap.rotation.z = 0.2; flap.castShadow = true; body.add(flap);
  // red plastic corner bumpers
  // casters
  const casters = {};
  for (const [name, x, z, front] of [['FL', CART.frontX, -CART.frontZ, true], ['FR', CART.frontX, CART.frontZ, true], ['RL', CART.rearX, -CART.rearZ, false], ['RR', CART.rearX, CART.rearZ, false]]) {
    const c = makeCaster(m, front); c.position.set(x, cy, z); body.add(c); casters[name] = c;
  }
  root.userData = { body, casters };
  if (decorations) decorations(body);
  return root;
}

// ---------------------------------------------------------------- upgrades for John's cart
export function makeWrench() {
  const m = mats();
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.045, 0.02, 2, 0.008), m.chrome); shaft.position.x = 0.2; g.add(shaft);
  // open-end head at origin (wraps the bolt)
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.017, 10, 24, Math.PI * 1.45), m.chrome); head.rotation.z = Math.PI * 0.27 + Math.PI; g.add(head);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.016, 10, 24), m.chrome); ring.position.x = 0.4; g.add(ring);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeLeafBlower() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xf28a1e, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.6 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.6 });
  const bodyM = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.26, 0.24, 4, 0.08), orange); g.add(bodyM);
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 24), dark); engine.rotation.x = Math.PI / 2; engine.position.set(0.02, 0.0, 0.0); g.add(engine);
  for (let i = 0; i < 6; i++) { const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.012, 24), grey); fin.rotation.x = Math.PI / 2; fin.position.set(0.02, 0, -0.08 + i * 0.032); g.add(fin); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20, Math.PI), dark); handle.position.set(0, 0.13, 0); g.add(handle);
  // nozzle tube pointing backwards (-X) and slightly down
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 18, 1, true), orange); tube.material = orange;
  tube.rotation.z = Math.PI / 2 + 0.28; tube.position.set(-0.36, -0.08, 0); g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.012, 8, 18), dark); lip.rotation.y = Math.PI / 2; lip.rotation.x = 0.28; lip.position.set(-0.625, -0.158, 0); g.add(lip);
  // straps
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.02), dark); st.position.set(0.12, 0.05, s * 0.13); g.add(st); }
  const pull = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), dark); pull.position.set(0.18, 0.08, 0.13); g.add(pull);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.nozzle = new THREE.Vector3(-0.64, -0.165, 0); // local nozzle tip
  return g;
}

export function makeSteeringBar() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: TX.makeWood(), roughness: 0.6 });
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.48, 2, 0.01), wood); g.add(bar);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8b13a, roughness: 0.7 })); knot.position.set(0.0, 0.02, 0); g.add(knot);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeBroom() {
  const g = new THREE.Group(); // origin at the mount, handle runs along -X down to bristles
  const wood = new THREE.MeshStandardMaterial({ map: TX.makeWood(), roughness: 0.55 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1.05, 12), wood);
  handle.rotation.z = Math.PI / 2; handle.position.x = -0.52; g.add(handle);
  const head = new THREE.Group(); head.position.x = -1.05; g.add(head);
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 0.34, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 })); head.add(block);
  const straw = new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.8 });
  for (let i = 0; i < 26; i++) {
    const z = -0.15 + 0.3 * (i / 25);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.015, 0.2, 5), straw);
    b.position.set(-0.07, -0.06, z); b.rotation.z = 1.0 + ((i * 37) % 7) * 0.03; head.add(b);
  }
  g.userData.head = head;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makePotatoBag(seed = 0) {
  const burl = TX.makeBurlap();
  const mat = new THREE.MeshStandardMaterial({ map: burl.map, normalMap: burl.normalMap, roughness: 0.92 });
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.15, 28, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    // lumpy potatoes inside
    const lump = 1 + 0.08 * Math.sin(v.x * 40 + seed) * Math.sin(v.z * 37 + v.y * 23) + 0.05 * Math.sin(v.y * 55 + seed * 2);
    v.multiply(new THREE.Vector3(1.25, 0.95, 1.0)).multiplyScalar(lump);
    if (v.y > 0.08) v.x *= 0.6 + 0.4 * (1 - (v.y - 0.08) / 0.07); // gathered neck
    if (v.y < -0.1) v.y = -0.1 - (v.y + 0.1) * 0.3; // flat bottom
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const sack = new THREE.Mesh(geo, mat); sack.castShadow = true; sack.receiveShadow = true; g.add(sack);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), new THREE.MeshStandardMaterial({ color: 0xc23b22, roughness: 0.6 })); tie.rotation.x = Math.PI / 2; tie.position.y = 0.14; g.add(tie);
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.07, 10), mat); tuft.position.y = 0.18; tuft.rotation.x = Math.PI; g.add(tuft);
  return g;
}

// rope as a tube along a curve, rebuilt each frame
export class Rope {
  constructor() {
    this.mat = new THREE.MeshStandardMaterial({ map: TX.makeRope(), roughness: 0.75 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
  }
  update(points) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.011, 8, false);
  }
}
