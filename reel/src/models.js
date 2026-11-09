import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mk, box, cyl, rng } from './util.js';

const PI = Math.PI;

// ---------- house ----------
export function makeHouse(wall, roof) {
  const g = new THREE.Group();
  mk(box(7, 4.2, 6), M(wall), g, 0, 2.1, 0);
  const sh = new THREE.Shape(); sh.moveTo(-4.1, 0); sh.lineTo(4.1, 0); sh.lineTo(0, 2.4); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 6.9, bevelEnabled: false }); rg.translate(0, 0, -3.45);
  mk(rg, M(roof), g, 0, 4.2, 0);
  const wm = M(0x33485c), fm = M(0xffffff), dm = M(0x5a3d2b);
  for (const [x, y] of [[-2.0, 3.0], [2.0, 3.0], [-2.0, 1.25]]) {
    mk(box(1.4, 1.15, 0.1), fm, g, x, y, 3.02, false);
    mk(box(1.16, 0.92, 0.12), wm, g, x, y, 3.04, false);
    mk(box(1.2, 0.07, 0.14), fm, g, x, y, 3.05, false);
    mk(box(0.07, 0.95, 0.14), fm, g, x, y, 3.05, false);
  }
  mk(box(1.2, 2.1, 0.12), dm, g, 2.0, 1.05, 3.03, false);
  mk(box(1.5, 0.12, 0.5), fm, g, 2.0, 0.06, 3.3);
  for (const sx of [-1, 1]) for (const z of [-1.4, 1.4]) {
    mk(box(0.1, 1.15, 1.3), fm, g, sx * 3.52, 2.9, z, false);
    mk(box(0.12, 0.92, 1.08), wm, g, sx * 3.54, 2.9, z, false);
  }
  mk(box(0.8, 1.7, 0.8), M(0x8a5a44), g, -2.1, 5.6, -1.2);
  return g;
}

// ---------- fence ----------
export function makeFence(segs) {
  const g = new THREE.Group();
  const pm = M(0x9a6233), dk = M(0x74471f);
  const r = rng(7);
  let count = 0;
  for (const s of segs) count += Math.floor(Math.hypot(s[2] - s[0], s[3] - s[1]) / 0.36) + 1;
  const inst = new THREE.InstancedMesh(box(0.31, 1.25, 0.07), pm, count);
  inst.castShadow = true; inst.receiveShadow = true;
  const d = new THREE.Object3D(); let i = 0;
  for (const s of segs) {
    const dx = s[2] - s[0], dz = s[3] - s[1], len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    const n = Math.floor(len / 0.36);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      d.position.set(s[0] + dx * f, 0.66 + r() * 0.05, s[1] + dz * f);
      d.rotation.set(0, -ang, 0); d.updateMatrix(); inst.setMatrixAt(i++, d.matrix);
    }
    for (const y of [0.32, 1.0]) {
      const rail = mk(box(len, 0.1, 0.1), dk, g, s[0] + dx / 2, y, s[1] + dz / 2);
      rail.rotation.y = -ang; rail.translateZ(-0.08);
    }
    const np = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= np; k++) {
      const f = k / np;
      mk(box(0.16, 1.45, 0.16), dk, g, s[0] + dx * f, 0.72, s[1] + dz * f);
    }
  }
  g.add(inst);
  return g;
}

// ---------- palm ----------
function leafGeo(L = 2.8, w = 0.42, n = 5) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, x = L * s, y = 0.9 * s - 1.9 * s * s;
    const ww = w * Math.sin(PI * Math.min(1, s * 0.92 + 0.08));
    pos.push(x, y - 0.16 * (ww / w), -ww, x, y, 0, x, y - 0.16 * (ww / w), ww);
  }
  for (let i = 0; i < n; i++) { const a = i * 3, b = (i + 1) * 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
const LEAF = leafGeo();
let palmMats = null;
export function makePalm(h = 5.5, seed = 1) {
  if (!palmMats) palmMats = { t1: M(0x8d6238), t2: M(0x7a5230), l1: M(0x2f9a3a, { side: THREE.DoubleSide }), l2: M(0x3fb04a, { side: THREE.DoubleSide }), c: M(0x5a3a1c) };
  const r = rng(seed * 97 + 3);
  const g = new THREE.Group();
  const n = 6, sl = h / n; let cur = g; const bend = (r() - 0.5) * 0.16;
  for (let i = 0; i < n; i++) {
    const seg = new THREE.Group(); seg.position.y = i === 0 ? 0 : sl; seg.rotation.z = bend; cur.add(seg);
    const rb = 0.26 - i * 0.02;
    mk(cyl(rb - 0.03, rb, sl * 1.02, 7), i % 2 ? palmMats.t1 : palmMats.t2, seg, 0, sl / 2, 0);
    cur = seg;
  }
  const crown = new THREE.Group(); crown.position.y = sl; cur.add(crown);
  const nl = 8;
  for (let i = 0; i < nl; i++) {
    const p = new THREE.Group(); p.rotation.y = (i / nl) * PI * 2 + r() * 0.3; crown.add(p);
    const lf = mk(LEAF, i % 2 ? palmMats.l1 : palmMats.l2, p, 0, 0, 0);
    lf.rotation.z = 0.25 + r() * 0.3; lf.scale.setScalar(0.85 + r() * 0.35);
  }
  for (let i = 0; i < 3; i++) mk(new THREE.IcosahedronGeometry(0.17, 0), palmMats.c, crown, Math.cos(i * 2.1) * 0.2, -0.12, Math.sin(i * 2.1) * 0.2);
  return g;
}

// ---------- bush / rock ----------
let bushMats = null;
export function makeBush(seed = 1) {
  if (!bushMats) bushMats = [M(0x2f8f35), M(0x3aa042), M(0x267a2e)];
  const r = rng(seed * 31 + 11); const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = 0.35 + r() * 0.3;
    mk(new THREE.IcosahedronGeometry(s, 0), bushMats[i % 3], g, (r() - 0.5) * 0.7, s * 0.75, (r() - 0.5) * 0.7).rotation.set(r() * 3, r() * 3, 0);
  }
  return g;
}
let rockMats = null;
export function makeRock(seed = 1, s = 0.5) {
  if (!rockMats) rockMats = [M(0x8e9093), M(0x7b7d80), M(0xa3a5a7)];
  const r = rng(seed * 53 + 5);
  const m = mk(new THREE.DodecahedronGeometry(s, 0), rockMats[seed % 3], null, 0, s * 0.45, 0);
  m.scale.set(1 + r() * 0.5, 0.65 + r() * 0.3, 1 + r() * 0.4); m.rotation.set(r(), r() * 6, r());
  const g = new THREE.Group(); g.add(m); return g;
}

// ---------- poop swirl ----------
let POOP_GEO = null;
export function poopGeo() {
  if (POOP_GEO) return POOP_GEO;
  const parts = [];
  const add = (geo, y, rx = 0, x = 0) => { geo.rotateX(rx); geo.translate(x, y, 0); parts.push(geo.toNonIndexed ? geo.toNonIndexed() : geo); };
  const tor = (R, t) => { const g = new THREE.TorusGeometry(R, t, 6, 10); g.rotateX(PI / 2); return g; };
  add(tor(0.27, 0.17), 0.17); add(cyl(0.3, 0.3, 0.3, 10), 0.17);
  add(tor(0.17, 0.14), 0.42); add(cyl(0.2, 0.2, 0.24, 10), 0.42);
  add(tor(0.08, 0.11), 0.62);
  const tip = new THREE.ConeGeometry(0.12, 0.3, 7); tip.rotateZ(-0.35); add(tip, 0.82, 0, 0.03);
  for (const p of parts) { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k); }
  POOP_GEO = mergeGeometries(parts); POOP_GEO.computeVertexNormals();
  return POOP_GEO;
}
let poopMat = null;
export const poopMaterial = () => poopMat || (poopMat = M(0x7b4a22));
export function makePoop(s = 1) { const m = mk(poopGeo(), poopMaterial(), null); m.scale.setScalar(s); return m; }

// ---------- dog (faces +x) ----------
export function makeDog() {
  const g = new THREE.Group();
  const B = M(0xa8733f), Dk = M(0x6b4423), Wm = M(0xf3e3c8), K = M(0x1c1c1c), Wh = M(0xffffff);
  const body = new THREE.Group(); body.position.y = 0.44; g.add(body);
  mk(box(0.85, 0.38, 0.42), B, body);
  const head = new THREE.Group(); head.position.set(0.42, 0.2, 0); body.add(head);
  mk(box(0.42, 0.4, 0.46), B, head, 0.1, 0.1, 0);
  mk(box(0.24, 0.2, 0.28), Wm, head, 0.38, 0.0, 0);
  mk(box(0.09, 0.09, 0.13), K, head, 0.52, 0.07, 0);
  const eyes = [];
  for (const sz of [-1, 1]) {
    const e = mk(new THREE.SphereGeometry(0.075, 8, 6), Wh, head, 0.3, 0.2, sz * 0.14, false);
    mk(new THREE.SphereGeometry(0.04, 6, 5), K, e, 0.05, 0, 0, false); eyes.push(e);
  }
  const ears = [];
  for (const sz of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0.02, 0.3, sz * 0.24); head.add(p);
    mk(box(0.13, 0.32, 0.1), Dk, p, 0, -0.14, 0); ears.push(p);
  }
  const legs = [];
  for (const [x, z] of [[0.3, 0.14], [0.3, -0.14], [-0.3, 0.14], [-0.3, -0.14]]) {
    const p = new THREE.Group(); p.position.set(x, -0.14, z); body.add(p);
    mk(box(0.13, 0.36, 0.13), B, p, 0, -0.16, 0); legs.push(p);
  }
  const tail = new THREE.Group(); tail.position.set(-0.42, 0.14, 0); body.add(tail);
  mk(box(0.34, 0.09, 0.09), Dk, tail, -0.15, 0.08, 0).rotation.z = -0.5;
  g.userData = { body, head, ears, legs, tail, eyes };
  return g;
}

// ---------- person (faces +x) ----------
export function makePerson(shirt, pants, skin = 0xf0c39a, hair = 0x3a2a1c) {
  const g = new THREE.Group();
  const S = M(shirt), P = M(pants), Sk = M(skin), Hr = M(hair), K = M(0x1c1c1c);
  const legs = [], arms = [];
  for (const sz of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0, 0.8, sz * 0.14); g.add(p);
    mk(box(0.22, 0.8, 0.22), P, p, 0, -0.4, 0); legs.push(p);
  }
  const torso = mk(cyl(0.27, 0.33, 0.72, 7), S, g, 0, 1.15, 0);
  for (const sz of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0, 1.45, sz * 0.38); g.add(p);
    mk(box(0.15, 0.6, 0.15), S, p, 0, -0.3, 0);
    mk(box(0.14, 0.14, 0.14), Sk, p, 0, -0.66, 0); arms.push(p);
  }
  const head = new THREE.Group(); head.position.y = 1.76; g.add(head);
  mk(new THREE.IcosahedronGeometry(0.27, 1), Sk, head);
  const hm = mk(new THREE.SphereGeometry(0.29, 8, 5, 0, PI * 2, 0, PI * 0.5), Hr, head, -0.03, 0.03, 0);
  for (const sz of [-1, 1]) mk(new THREE.SphereGeometry(0.035, 6, 5), K, head, 0.25, 0.02, sz * 0.1, false);
  const splat = mk(new THREE.IcosahedronGeometry(0.36, 1), poopMaterial(), head, 0, 0.16, 0); splat.scale.set(0, 0, 0);
  g.userData = { legs, arms, head, torso, splat };
  return g;
}

// ---------- excavator (faces +x) ----------
export function makeExcavator() {
  const g = new THREE.Group();
  const Y = M(0xf5bd12), D = M(0x2c2c30), G = M(0x5c6168), glass = M(0x8fd0ea);
  for (const sz of [-0.85, 0.85]) {
    mk(box(2.5, 0.5, 0.5), D, g, 0, 0.3, sz);
    for (const ex of [-1.25, 1.25]) mk(cyl(0.25, 0.25, 0.5, 8), D, g, ex, 0.3, sz).rotation.x = PI / 2;
    for (let i = 0; i < 4; i++) mk(cyl(0.17, 0.17, 0.56, 8), G, g, -0.9 + i * 0.6, 0.3, sz).rotation.x = PI / 2;
  }
  mk(box(1.5, 0.22, 1.3), D, g, 0, 0.6, 0);
  const turret = new THREE.Group(); turret.position.y = 0.72; g.add(turret);
  mk(box(2.0, 0.7, 1.6), Y, turret, -0.2, 0.38, 0);
  mk(box(0.6, 0.55, 1.62), D, turret, -1.0, 0.46, 0);
  mk(box(0.95, 1.05, 0.78), Y, turret, 0.25, 1.25, -0.4);
  mk(box(0.97, 0.6, 0.64), glass, turret, 0.27, 1.36, -0.4, false);
  mk(box(1.05, 0.08, 0.86), D, turret, 0.25, 1.8, -0.4);
  const boomP = new THREE.Group(); boomP.position.set(0.55, 0.75, 0.35); turret.add(boomP);
  mk(box(2.7, 0.3, 0.3), Y, boomP, 1.3, 0, 0);
  mk(box(1.2, 0.1, 0.1), G, boomP, 0.9, 0.24, 0);
  const stickP = new THREE.Group(); stickP.position.set(2.6, 0, 0); boomP.add(stickP);
  mk(box(2.1, 0.24, 0.24), Y, stickP, 1.0, 0, 0);
  mk(box(0.9, 0.09, 0.09), G, stickP, 0.6, 0.2, 0);
  const buckP = new THREE.Group(); buckP.position.set(2.0, 0, 0); stickP.add(buckP);
  mk(box(0.55, 0.55, 0.7), D, buckP, 0.22, -0.18, 0);
  for (let i = -1; i <= 1; i++) mk(box(0.16, 0.1, 0.12), G, buckP, 0.52, -0.42, i * 0.25);
  g.userData = { turret, boomP, stickP, buckP };
  return g;
}

// ---------- wheelbarrow (wheel at +x) ----------
export function makeWheelbarrow() {
  const g = new THREE.Group();
  const T = M(0x2f9e8f), W = M(0x8d6238), D = M(0x2c2c30);
  const tg = new THREE.CylinderGeometry(0.72, 0.45, 0.42, 4, 1); tg.rotateY(PI / 4); tg.scale(1.25, 1, 0.9);
  mk(tg, T, g, 0, 0.62, 0);
  mk(cyl(0.26, 0.26, 0.14, 10), D, g, 0.85, 0.26, 0).rotation.x = PI / 2;
  for (const sz of [-1, 1]) {
    const hd = mk(box(1.9, 0.07, 0.07), W, g, -0.45, 0.46, sz * 0.36); hd.rotation.z = -0.12;
    mk(box(0.07, 0.42, 0.07), D, g, -0.45, 0.21, sz * 0.36);
  }
  const load = new THREE.Group(); g.add(load);
  const r = rng(5);
  for (let i = 0; i < 6; i++) { const p = makePoop(0.55 + r() * 0.15); p.position.set(-0.45 + (i % 3) * 0.42, 0.72 + Math.floor(i / 3) * 0.3, (r() - 0.5) * 0.5); p.rotation.y = r() * 6; load.add(p); }
  g.userData = { load };
  return g;
}

// ---------- BBQ grill ----------
export function makeGrill() {
  const g = new THREE.Group();
  const K = M(0x25262a), S = M(0x9da3a8), R = M(0xff5a1f, { emissive: 0xff3b00, emissiveIntensity: 0.9 });
  const bowl = new THREE.SphereGeometry(0.62, 10, 5, 0, PI * 2, PI / 2, PI / 2);
  mk(bowl, K, g, 0, 1.05, 0);
  mk(cyl(0.6, 0.6, 0.04, 10), R, g, 0, 1.03, 0, false);
  mk(cyl(0.63, 0.63, 0.03, 10), S, g, 0, 1.08, 0, false);
  const lid = mk(new THREE.SphereGeometry(0.63, 10, 5, 0, PI * 2, 0, PI / 2), K, g, -0.5, 1.35, 0); lid.rotation.z = 1.1;
  for (let i = 0; i < 3; i++) { const a = i * 2.094; const l = mk(cyl(0.035, 0.035, 0.95, 5), S, g, Math.cos(a) * 0.42, 0.47, Math.sin(a) * 0.42); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); }
  const sm = M(0xb5532e);
  for (let i = 0; i < 3; i++) mk(cyl(0.05, 0.05, 0.42, 6), sm, g, -0.2 + i * 0.2, 1.13, 0.05).rotation.x = PI / 2;
  const cover = mk(new THREE.IcosahedronGeometry(1.0, 1), poopMaterial(), g, 0, 0.55, 0); cover.scale.set(0, 0, 0);
  g.userData = { cover };
  return g;
}

// ---------- party table ----------
export function makeTable() {
  const g = new THREE.Group();
  const W = M(0x8d6238), C = M(0xf7f3ea), Rd = M(0xd8382f), Yl = M(0xf2c14e), Br = M(0x9b5a2a), Gn = M(0x4caf50);
  mk(box(2.6, 0.1, 1.3), C, g, 0, 0.88, 0);
  mk(box(2.7, 0.3, 1.36), Rd, g, 0, 0.72, 0);
  for (const [x, z] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) mk(box(0.1, 0.8, 0.1), W, g, x, 0.4, z);
  for (const [x, z] of [[-0.8, 0.2], [0.1, -0.25], [0.85, 0.2]]) {
    mk(cyl(0.2, 0.2, 0.03, 10), C, g, x, 0.95, z);
    mk(cyl(0.13, 0.13, 0.06, 8), Br, g, x, 0.99, z); mk(cyl(0.14, 0.14, 0.03, 8), Yl, g, x, 1.03, z); mk(cyl(0.13, 0.12, 0.06, 8), Br, g, x, 1.07, z);
  }
  for (const [x, z] of [[-0.35, 0.35], [0.5, 0.4], [-1.05, -0.3], [1.05, -0.35]]) mk(cyl(0.07, 0.05, 0.16, 7), Rd, g, x, 1.01, z);
  mk(cyl(0.22, 0.22, 0.2, 10), Gn, g, -0.3, 1.03, -0.3);
  const cover = mk(new THREE.IcosahedronGeometry(1.0, 1), poopMaterial(), g, 0, 0.75, 0); cover.scale.set(0, 0, 0);
  g.userData = { cover };
  return g;
}

// ---------- dog house ----------
export function makeDogHouse() {
  const g = new THREE.Group();
  mk(box(1.3, 0.9, 1.5), M(0xc9483b), g, 0, 0.45, 0);
  const sh = new THREE.Shape(); sh.moveTo(-0.85, 0); sh.lineTo(0.85, 0); sh.lineTo(0, 0.7); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: false }); rg.translate(0, 0, -0.85);
  mk(rg, M(0x4a3a35), g, 0, 0.9, 0);
  mk(box(0.5, 0.55, 0.06), M(0x1c1c1c), g, 0, 0.3, 0.76, false);
  return g;
}

// ---------- cyan arrow (points -y, tip at origin) ----------
export function makeArrow() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(0.75, 0.9); sh.lineTo(0.3, 0.9); sh.lineTo(0.3, 2.1); sh.lineTo(-0.3, 2.1); sh.lineTo(-0.3, 0.9); sh.lineTo(-0.75, 0.9); sh.closePath();
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false });
  const inner = new THREE.Group(); g.add(inner);
  const a = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1fe3ff })); inner.add(a);
  const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0b5f8a })); b.scale.set(1.16, 1.08, 0.9); b.position.set(0, -0.09, -0.06); inner.add(b);
  g.userData = { inner };
  return g;
}

// ---------- big red button on a post ----------
export function makeButton() {
  const g = new THREE.Group();
  mk(box(0.22, 1.0, 0.22), M(0x8d6238), g, 0, 0.5, 0);
  mk(box(0.8, 0.3, 0.8), M(0xf2c21a), g, 0, 1.12, 0);
  const K = M(0x1c1c1c);
  for (let i = -1; i <= 1; i++) { mk(box(0.1, 0.31, 0.81), K, g, i * 0.26, 1.12, 0, false).rotation.z = 0; }
  mk(cyl(0.34, 0.34, 0.06, 14), M(0x3a3a3e), g, 0, 1.3, 0);
  const btn = new THREE.Group(); btn.position.y = 1.33; g.add(btn);
  const Rm = M(0xe32020, { emissive: 0x7a0000, emissiveIntensity: 0.5 });
  mk(cyl(0.27, 0.27, 0.16, 14), Rm, btn, 0, 0.08, 0);
  const dome = mk(new THREE.SphereGeometry(0.27, 12, 5, 0, PI * 2, 0, PI / 2), Rm, btn, 0, 0.16, 0); dome.scale.y = 0.45;
  // sign
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#d22'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
  x.fillStyle = '#d22'; x.font = '900 44px Fredoka, sans-serif'; x.textAlign = 'center'; x.fillText('DO NOT', 128, 54); x.fillText('PRESS', 128, 104);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshLambertMaterial({ map: tex }));
  sign.position.set(0, 0.72, 0.13); g.add(sign);
  // hand
  const hand = new THREE.Group(); g.add(hand);
  const Sk = M(0xf0c39a), Sl = M(0x2f6fd0);
  mk(box(0.34, 0.16, 0.36), Sk, hand, 0, 0.1, 0);
  mk(box(0.5, 0.22, 0.4), Sl, hand, -0.42, 0.14, 0);
  hand.rotation.z = -0.35;
  g.userData = { btn, hand };
  return g;
}

// ---------- pump with dial ----------
export function makePump() {
  const g = new THREE.Group();
  const nc = true;
  const R = M(0xe02a2a, {}, nc), Rd = M(0xa81c1c, {}, nc), D = M(0x2c2c30, {}, nc), S = M(0xb9bec4, {}, nc);
  mk(box(1.7, 0.16, 1.0), D, g, 0, -0.62, 0);
  mk(box(1.0, 1.0, 0.9), R, g, -0.3, -0.05, 0);
  mk(cyl(0.48, 0.48, 0.8, 12), Rd, g, 0.5, -0.1, 0).rotation.z = PI / 2;
  for (let i = 0; i < 4; i++) mk(cyl(0.5, 0.5, 0.05, 12), D, g, 0.2 + i * 0.2, -0.1, 0).rotation.z = PI / 2;
  mk(cyl(0.56, 0.56, 0.14, 12), S, g, -0.86, -0.25, 0).rotation.z = PI / 2;
  mk(cyl(0.56, 0.56, 0.14, 12), S, g, 0.96, -0.25, 0).rotation.z = PI / 2;
  mk(cyl(0.07, 0.07, 0.3, 6), S, g, -0.3, 0.58, 0.2);
  const dial = new THREE.Group(); dial.position.set(-0.3, 1.1, 0.3); g.add(dial);
  mk(cyl(0.56, 0.56, 0.12, 20), D, dial, 0, 0, -0.07).rotation.x = PI / 2;
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24), basic(0xffffff)); dial.add(face);
  const ring = (a0, a1, col) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 10, 1, a0 * PI / 180, (a1 - a0) * PI / 180), basic(col)); m.position.z = 0.005; dial.add(m); };
  ring(66, 210, 0x3cc04a); ring(18, 66, 0xf2c21a); ring(-30, 18, 0xe32020);
  const needle = new THREE.Group(); needle.position.z = 0.02; dial.add(needle);
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.42), basic(0x111111)); nm.position.y = 0.19; needle.add(nm);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), basic(0x111111)); cap.position.z = 0.03; dial.add(cap);
  g.userData = { dial, needle };
  return g;
}
export function setNeedle(pump, v) { pump.userData.needle.rotation.z = (210 - v * 240 - 90) * PI / 180; }

// ---------- cloud ----------
export function makeCloud(seed) {
  const r = rng(seed * 13 + 1); const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 5; i++) { const s = 3 + r() * 3; const c = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), m); c.position.set((i - 2) * 3.4, r() * 1.5, r() * 2); c.scale.y = 0.6; g.add(c); }
  return g;
}
