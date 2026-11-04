// Props. Each prop is a Group whose transform shots set every frame.
import * as THREE from 'three';
import { bx, cyl, at, shade, sackGeo, extrude, starShape } from './build.js';
import { rng } from './util.js';

export function makeTooth(M, s = 1) {
  const g = new THREE.Group();
  const crown = bx(0.06 * s, 0.045 * s, 0.052 * s, M.tooth); crown.position.y = 0.02 * s; g.add(crown);
  for (const x of [-0.016, 0.016]) {
    const b = bx(0.026 * s, 0.014 * s, 0.046 * s, M.tooth); b.position.set(x * s, 0.048 * s, 0); g.add(b);
    const r = cyl(0.013 * s, 0.006 * s, 0.045 * s, 5, M.tooth); r.position.set(x * s, -0.022 * s, 0); g.add(r);
  }
  return g;
}

const coinGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 20);
export function makeCoin(M, s = 1) {
  const m = shade(new THREE.Mesh(coinGeo, [M.coinEdge, M.coinFace, M.coinFace]));
  m.scale.setScalar(s);
  return m;
}

// vintage "brick" mobile phone: the old blocky phone
function makePhone(M) {
  const g = new THREE.Group();
  g.add(bx(0.078, 0.24, 0.052, M.phone));
  const top = bx(0.072, 0.05, 0.054, M.phoneDark); top.position.y = 0.095; g.add(top);
  for (let i = 0; i < 3; i++) { const sl = bx(0.045, 0.005, 0.004, M.black); sl.position.set(0, 0.085 + i * 0.012, 0.028); g.add(sl); }
  const scr = bx(0.052, 0.03, 0.004, M.screen); scr.position.set(0, 0.04, 0.027); g.add(scr);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const k = bx(0.016, 0.012, 0.007, M.phoneKey); k.position.set(-0.021 + c * 0.021, -0.005 - r * 0.021, 0.028); g.add(k); }
  const ant = cyl(0.009, 0.007, 0.1, 6, M.black); ant.position.set(0.022, 0.17, 0); g.add(ant);
  const tip = cyl(0.012, 0.012, 0.015, 6, M.black); tip.position.set(0.022, 0.222, 0); g.add(tip);
  return g;
}

function makeNotepad(M) {
  const g = new THREE.Group();
  const back = bx(0.25, 0.33, 0.01, M.cardboard); g.add(back);
  const pad = shade(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.014), [M.paperWhite, M.paperWhite, M.paperWhite, M.paperWhite, M.notepad, M.paperWhite]));
  pad.position.z = 0.012; g.add(pad);
  const ringG = new THREE.TorusGeometry(0.014, 0.0035, 4, 8);
  for (let i = 0; i < 9; i++) { const r = shade(new THREE.Mesh(ringG, M.spiral)); at(r, -0.1 + i * 0.025, 0.165, 0.006, 0, Math.PI / 2, 0); g.add(r); }
  return g;
}

export class Net {
  constructor(M) {
    this.geo = new THREE.PlaneGeometry(1, 1, 22, 22);
    this.geo.rotateX(-Math.PI / 2);
    this.base = this.geo.attributes.position.array.slice();
    this.mesh = new THREE.Mesh(this.geo, M.net);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    // weights on the rim
    this.weights = [];
    for (let i = 0; i < 8; i++) { const w = bx(0.05, 0.05, 0.05, M.iron); this.root.add(w); this.weights.push(w); }
  }
  // fall: 0..1 drop progress, settle: 0..1 drape progress, size: radius scale
  shape(fall, settle, size = 0.6, dome = 0.32, t = 0) {
    const p = this.geo.attributes.position, b = this.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2];
      const r = Math.min(1, Math.hypot(x, z) * 2);
      const flat = 0.12 * r * r * (1 - settle) + Math.sin(t * 9 + x * 6) * 0.02 * (1 - settle);
      const drape = dome * Math.cos((r * Math.PI) / 2) ** 1.4;
      const y = (1 - settle) * flat + settle * drape;
      const shrink = 1 - 0.18 * settle * r;
      p.setXYZ(i, x * size * 2 * shrink, y, z * size * 2 * shrink);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.weights.forEach((w, i) => {
      const a = (i / 8) * Math.PI * 2;
      const rr = size * (1 - 0.18 * settle) * 0.98;
      w.position.set(Math.cos(a) * rr, (1 - settle) * 0.12 + 0.02, Math.sin(a) * rr);
    });
  }
}

function makePliers(M) {
  const g = new THREE.Group();
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); g.add(a);
    const handle = bx(0.028, 0.016, 0.17, M.redGrip); at(handle, s * 0.012, 0, -0.1, 0, s * 0.07, 0); a.add(handle);
    const shank = bx(0.02, 0.014, 0.05, M.steel); at(shank, 0, 0, -0.005, 0, 0, 0); a.add(shank);
    const jaw = bx(0.018, 0.014, 0.075, M.steel); at(jaw, -s * 0.004, 0, 0.055, 0, -s * 0.05, 0); a.add(jaw);
    arms.push({ a, s });
  }
  const pin = cyl(0.012, 0.012, 0.03, 8, M.steel); g.add(pin);
  g.userData.open = (k) => arms.forEach(({ a, s }) => (a.rotation.y = s * k * 0.25));
  g.userData.tip = new THREE.Object3D(); g.userData.tip.position.set(0, 0, 0.09); g.add(g.userData.tip);
  return g;
}

function makeThrone(M) {
  const g = new THREE.Group();
  const G = M.throneGold;
  const seat = bx(0.95, 0.12, 0.72, G); seat.position.y = 0.46; g.add(seat);
  const cush = bx(0.8, 0.1, 0.62, M.velvet); cush.position.set(0, 0.56, 0.02); g.add(cush);
  for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) { const l = bx(0.11, 0.42, 0.11, G); l.position.set(x, 0.2, z); g.add(l); }
  const back = bx(0.95, 1.25, 0.12, G); back.position.set(0, 1.1, -0.32); g.add(back);
  const bc = bx(0.72, 0.9, 0.06, M.velvet); bc.position.set(0, 1.03, -0.25); g.add(bc);
  const crest1 = bx(0.75, 0.16, 0.14, G); crest1.position.set(0, 1.8, -0.32); g.add(crest1);
  const crest2 = bx(0.42, 0.18, 0.14, G); crest2.position.set(0, 1.96, -0.32); g.add(crest2);
  for (const [x, y, r] of [[-0.47, 1.78, 0.08], [0.47, 1.78, 0.08], [0, 2.12, 0.1]]) { const f = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), G)); f.position.set(x, y, -0.32); g.add(f); }
  for (const s of [-1, 1]) {
    const arm = bx(0.12, 0.1, 0.68, G); arm.position.set(s * 0.47, 0.82, 0.02); g.add(arm);
    const post = bx(0.1, 0.32, 0.1, G); post.position.set(s * 0.47, 0.64, 0.3); g.add(post);
    const knob = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), G)); knob.position.set(s * 0.47, 0.9, 0.34); g.add(knob);
  }
  const jewel = shade(new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), M.std('#4fa3e0', { m: 0.3, r: 0.2, env: true, map: null }))); jewel.position.set(0, 1.96, -0.24); g.add(jewel);
  for (const s of [-1, 1]) { const j = shade(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), M.std('#e0485f', { m: 0.3, r: 0.2, env: true, map: null }))); j.position.set(s * 0.26, 1.8, -0.24); g.add(j); }
  return g;
}

// Many coins as one InstancedMesh: cone-shaped piles + scattered coins.
function makeCoinPiles(M, piles, scatter, seed = 3) {
  const R = rng(seed);
  const mats = [];
  for (const p of piles) {
    for (let i = 0; i < p.n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * p.r;
      const h = p.h * Math.pow(1 - rr / p.r, 1.2) + 0.006;
      const pos = new THREE.Vector3(p.x + Math.cos(a) * rr, p.y + h * (0.6 + R() * 0.4), p.z + Math.sin(a) * rr);
      const slope = Math.atan(p.h / p.r);
      const e = new THREE.Euler((R() - 0.5) * 0.6 + Math.sin(a) * slope, R() * 6.28, (R() - 0.5) * 0.6 - Math.cos(a) * slope);
      mats.push(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1)));
    }
  }
  for (const s of scatter) {
    for (let i = 0; i < s.n; i++) {
      const pos = new THREE.Vector3(s.x + (R() - 0.5) * s.w, s.y + 0.006, s.z + (R() - 0.5) * s.d);
      const e = new THREE.Euler((R() - 0.5) * 0.15, R() * 6.28, (R() - 0.5) * 0.15);
      mats.push(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1)));
    }
  }
  const im = new THREE.InstancedMesh(coinGeo, [M.coinEdge, M.coinFace, M.coinFace], mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

// Bendable chapati (polar grid so it can flop).
export class Chapati {
  constructor(M, R = 0.15) {
    const rings = 7, segs = 24, pos = [], uv = [], idx = [];
    pos.push(0, 0, 0); uv.push(0.5, 0.5);
    for (let r = 1; r <= rings; r++)
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2, rr = (r / rings) * R * (1 + (s % 3 === 0 && r === rings ? -0.04 : 0));
        pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
        uv.push(0.5 + (Math.cos(a) * rr) / (2 * R), 0.5 + (Math.sin(a) * rr) / (2 * R));
      }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + s, 1 + ((s + 1) % segs));
    for (let r = 1; r < rings; r++)
      for (let s = 0; s < segs; s++) {
        const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
        idx.push(a, c, b, b, c, d);
      }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.base = pos.slice();
    this.R = R;
    this.mesh = shade(new THREE.Mesh(this.geo, M.chapati));
    this.bend(0, 0);
  }
  // curl: the far half (-y) flops down away from the normal; bite: dent at the +y edge (mouth)
  bend(curl, bite, t = 0) {
    const p = this.geo.attributes.position, b = this.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      const u = -y / this.R;
      let z = -curl * Math.max(0, u + 0.25) ** 2 * this.R * 0.85 + Math.sin(x * 30 + t) * 0.002;
      const near = Math.max(0, 1 - Math.hypot(x / this.R, (y - this.R) / this.R) * 2.4);
      z -= bite * near * 0.035;
      p.setXYZ(i, x, y - bite * near * 0.02, z);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

function makeDinner(M) {
  const g = new THREE.Group();
  const top = bx(1.3, 0.06, 0.78, M.table); top.position.y = 0.6; g.add(top);
  const cloth = bx(1.32, 0.012, 0.8, M.tableCloth, { uv: 'world', density: 2.2 }); cloth.position.y = 0.636; g.add(cloth);
  const drape = bx(1.32, 0.18, 0.012, M.tableCloth, { uv: 'world', density: 2.2 }); drape.position.set(0, 0.55, 0.405); g.add(drape);
  for (const [x, z] of [[-0.58, -0.32], [0.58, -0.32], [-0.58, 0.32], [0.58, 0.32]]) { const l = bx(0.07, 0.58, 0.07, M.table); l.position.set(x, 0.29, z); g.add(l); }
  const plateG = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.36, 0.025), new THREE.Vector2(0.37, 0.03)], 22);
  const plate = shade(new THREE.Mesh(plateG, M.plate)); plate.position.set(0, 0.643, 0); g.add(plate);
  const rice = shade(new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.rice)); rice.scale.y = 0.65; rice.position.set(-0.1, 0.648, -0.04); g.add(rice);
  const curry = cyl(0.12, 0.13, 0.03, 12, M.curry); curry.position.set(0.12, 0.66, 0.0); g.add(curry);
  const R = rng(81);
  for (let i = 0; i < 6; i++) { const c = bx(0.035, 0.03, 0.035, M.curryChunk); at(c, 0.12 + (R() - 0.5) * 0.15, 0.678, (R() - 0.5) * 0.15, R(), R(), R()); g.add(c); }
  for (let i = 0; i < 3; i++) { const c = cyl(0.14, 0.14, 0.01, 18, M.chapati); c.position.set(0.02 - i * 0.01, 0.66 + i * 0.011, 0.19 + i * 0.008); g.add(c); }
  const glass = cyl(0.05, 0.045, 0.16, 12, M.glass, true); glass.position.set(0.5, 0.72, -0.18); glass.castShadow = false; g.add(glass);
  const water = cyl(0.046, 0.042, 0.11, 12, M.water); water.position.set(0.5, 0.7, -0.18); water.castShadow = false; g.add(water);
  return g;
}

export function buildProps(M, scene) {
  const P = {};
  const add = (k, o) => { P[k] = o; o.userData.home = scene; scene.add(o); return o; };
  add('tooth', makeTooth(M));
  add('baitTooth', makeTooth(M));
  add('coin', makeCoin(M));
  add('phone', makePhone(M));
  add('notepad', makeNotepad(M));
  P.net = new Net(M); add('netRoot', P.net.root);
  add('pliers', makePliers(M));
  add('pliersTooth', makeTooth(M, 0.6));
  const sack = new THREE.Group();
  const sm = shade(new THREE.Mesh(sackGeo(0.2, 0.32, 9, false), M.burlap)); sm.material = M.burlap; sack.add(sm);
  const rim = shade(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 4, 9), M.burlapDark)); at(rim, 0, 0.32, 0, Math.PI / 2, 0, 0); sack.add(rim);
  const pileR = rng(91);
  for (let i = 0; i < 12; i++) { const t = makeTooth(M, 0.7); at(t, (pileR() - 0.5) * 0.16, 0.26 + pileR() * 0.04, (pileR() - 0.5) * 0.16, pileR() * 3, pileR() * 3, pileR() * 3); sack.add(t); }
  add('sack', sack);
  P.looseTeeth = [];
  for (let i = 0; i < 14; i++) P.looseTeeth.push(add('lt' + i, makeTooth(M, 0.7)));
  add('throne', makeThrone(M));
  add('coinPiles', makeCoinPiles(M,
    [
      { x: -1.15, y: 0, z: -2.3, r: 0.55, h: 0.55, n: 420 },
      { x: 1.3, y: 0, z: -2.35, r: 0.6, h: 0.65, n: 480 },
      { x: -0.75, y: 0, z: -1.25, r: 0.32, h: 0.25, n: 140 },
      { x: 1.05, y: 0, z: -1.2, r: 0.38, h: 0.3, n: 180 },
      { x: 2.0, y: 0, z: -1.7, r: 0.45, h: 0.45, n: 260 },
      { x: -1.9, y: 0, z: -1.6, r: 0.42, h: 0.4, n: 240 },
    ],
    [{ x: 0.1, y: 0, z: -1.0, w: 3.4, d: 1.6, n: 160 }]));
  P.dinner = add('dinner', makeDinner(M));
  P.chapati = new Chapati(M); add('chapatiMesh', P.chapati.mesh);
  P.floatCoins = [];
  for (let i = 0; i < 10; i++) P.floatCoins.push(add('fc' + i, makeCoin(M, 0.9)));
  for (const k in P) if (P[k] && P[k].isObject3D) P[k].visible = false;
  P.looseTeeth.forEach((t) => (t.visible = false));
  P.floatCoins.forEach((c) => (c.visible = false));
  P.all = Object.values(P).filter((o) => o && o.isObject3D).concat(P.looseTeeth, P.floatCoins);
  return P;
}
