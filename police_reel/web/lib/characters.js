// Low-poly characters: faceted heads, pixel eyes, blocky hands.
import * as THREE from 'three';
import { TEX, rng, photoTexture } from './pixel.js';

const BLACK = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const TONGUE = new THREE.MeshBasicMaterial({ color: 0xc8424f });
const TEAR = new THREE.MeshBasicMaterial({ color: 0x5ec4ff, transparent: true, opacity: 0.92 });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.35, metalness: 0.3, emissive: 0x6a4a00 });

export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, flatShading: true, ...o });
}
export function tmat(map, o = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, flatShading: true, ...o });
}

function mesh(geo, m, cast = true) {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = cast;
  x.receiveShadow = true;
  return x;
}
// a box that hangs below its pivot (top face at y=0)
function hang(w, h, d, m) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, -h / 2, 0);
  return mesh(g, m);
}
function bx(w, h, d, m, cast = true) { return mesh(new THREE.BoxGeometry(w, h, d), m, cast); }

export function facetedSphere(r, seed, scale = [1, 1, 1], detail = 2, jit = 0.05) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.attributes.position;
  const R = rng(seed);
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let j = cache.get(key);
    if (!j) { j = [(R() - 0.5) * jit * r, (R() - 0.5) * jit * r, (R() - 0.5) * jit * r]; cache.set(key, j); }
    pos.setXYZ(i, (x + j[0]) * scale[0], (y + j[1]) * scale[1], (z + j[2]) * scale[2]);
  }
  g.computeVertexNormals();
  return g;
}

// keep only the triangles of `geo` (scaled by f) whose centroid passes `keep`
function shell(geo, f, keep) {
  const p = geo.attributes.position;
  const out = [];
  for (let i = 0; i < p.count; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += p.getX(i + k); cy += p.getY(i + k); cz += p.getZ(i + k); }
    cx /= 3; cy /= 3; cz /= 3;
    if (!keep(cx, cy, cz)) continue;
    for (let k = 0; k < 3; k++) out.push(p.getX(i + k) * f, p.getY(i + k) * f, p.getZ(i + k) * f);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ person
export class Person {
  constructor(o) {
    this.o = o;
    const s = o.scale || 1;
    const skin = mat(o.skin);
    this.skinMat = skin;
    const root = this.root = new THREE.Group();
    root.scale.setScalar(s);
    const body = this.body = new THREE.Group();
    root.add(body);

    this.hipY = 0.96;
    const hips = this.hips = new THREE.Group();
    hips.position.y = this.hipY;
    body.add(hips);

    const pantsM = tmat(o.pants);
    const pelvis = bx(0.44, 0.2, 0.27, pantsM);
    pelvis.position.y = 0.0;
    hips.add(pelvis);

    // torso
    const spine = this.spine = new THREE.Group();
    spine.position.y = 0.05;
    hips.add(spine);
    const TH = this.torsoH = 0.62;
    const tg = new THREE.BoxGeometry(0.48, TH, 0.28);
    // widen shoulders a touch
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) tp.setX(i, tp.getX(i) * 1.08);
    tg.translate(0, TH / 2, 0);
    const shirtSide = tmat(o.shirt), shirtFront = tmat(o.shirtFront || o.shirt);
    const torso = mesh(tg, [shirtSide, shirtSide, shirtSide, shirtSide, shirtFront, shirtSide]);
    spine.add(torso);
    this.torso = torso;
    if (o.vest) { // skin showing at the neckline of the vest
      const v = bx(0.2, 0.1, 0.02, skin); v.position.set(0, TH - 0.05, 0.142); spine.add(v);
    }
    if (o.collar) {
      for (const sx of [-1, 1]) {
        const c = bx(0.11, 0.05, 0.05, mat(o.collar)); c.position.set(sx * 0.07, TH + 0.005, 0.11);
        c.rotation.z = sx * 0.35; spine.add(c);
      }
    }
    if (o.epaulettes) {
      for (const sx of [-1, 1]) {
        const e = bx(0.16, 0.03, 0.12, mat(0x16203a)); e.position.set(sx * 0.2, TH + 0.01, 0); spine.add(e);
      }
    }

    // neck + head
    const neck = this.neck = new THREE.Group();
    neck.position.y = TH;
    spine.add(neck);
    const nk = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 7), skin);
    nk.position.y = 0.05;
    neck.add(nk);
    const head = this.head = new THREE.Group();
    head.position.y = 0.3;
    neck.add(head);
    this.buildHead(o, skin);

    // arms
    this.arm = {};
    for (const side of ['L', 'R']) this.arm[side] = this.buildArm(side, o, skin);
    // legs
    this.leg = {};
    for (const side of ['L', 'R']) this.leg[side] = this.buildLeg(side, o, pantsM);

    // tears (two streams per eye)
    this.tears = [];
    for (const side of [1, -1]) {
      const t = hang(0.026, 0.2, 0.012, TEAR);
      t.castShadow = false;
      t.position.set(side * this.eyeX, this.eyeY - 0.045, this.surfZ(this.eyeX, this.eyeY) + 0.012);
      t.visible = false;
      this.head.add(t);
      this.tears.push(t);
    }
    this.reset();
  }

  surfZ(x, y) {
    const r = this.R, sc = this.sc;
    return sc[2] * Math.sqrt(Math.max(0.0004, r * r - x * x - (y / sc[1]) ** 2));
  }

  place(m, x, y, dz = 0) {
    const z = this.surfZ(x, y);
    m.position.set(x, y, z + dz);
    m.rotation.y = Math.atan2(x, z) * 0.9;
    m.rotation.x = -Math.atan2(y, z) * 0.6;
    this.head.add(m);
    return m;
  }

  buildHead(o, skin) {
    const R = this.R = 0.25;
    const sc = this.sc = [1, 1.08, 0.97];
    const base = facetedSphere(R, o.seed || 3, [1, 1, 1], 2, 0.06);
    const hg = base.clone();
    hg.scale(sc[0], sc[1], sc[2]);
    const hm = mesh(hg, o.bald ? mat(o.skin, { roughness: 0.45 }) : skin);
    this.head.add(hm);
    this.headMesh = hm;
    const shellMat = (c) => mat(c, { side: THREE.DoubleSide });

    if (o.hair === 'styled') {
      const g = shell(base, 1.07, (x, y, z) => y > 0.06 || (z < -0.03 && y > -0.13) || (Math.abs(x) > 0.17 && y > -0.01 && z < 0.07));
      g.scale(sc[0], sc[1], sc[2]);
      const hair = mesh(g, shellMat(o.hairColor));
      this.head.add(hair);
      const q = mesh(facetedSphere(0.14, 11, [1.55, 0.55, 1.05], 1, 0.15), mat(o.hairColor));
      q.position.set(0.035, 0.235, 0.085);
      q.rotation.set(-0.35, 0.15, 0.12);
      this.head.add(q);
      this.quiff = q;
    } else if (o.hair === 'buzz') {
      const g = shell(base, 1.025, (x, y, z) => y > 0.09 || (z < -0.02 && y > -0.1));
      g.scale(sc[0], sc[1], sc[2]);
      this.head.add(mesh(g, shellMat(o.hairColor)));
    }
    if (o.beard) {
      const g = shell(base, 1.03, (x, y, z) => (y < -0.085 && z > -0.07) || (Math.abs(x) > 0.185 && y < 0.05 && y > -0.12 && z > -0.1 && z < 0.06));
      g.scale(sc[0], sc[1], sc[2]);
      this.head.add(mesh(g, shellMat(o.beardColor || o.hairColor)));
    }
    if (o.stubble) {
      const g = shell(base, 1.012, (x, y, z) => (y < -0.05 && z > -0.04));
      g.scale(sc[0], sc[1], sc[2]);
      this.head.add(mesh(g, new THREE.MeshStandardMaterial({ color: 0x2a2420, transparent: true, opacity: 0.45, flatShading: true, side: THREE.DoubleSide })));
    }

    // nose
    const nose = this.nose = bx(0.05, 0.075, 0.075, mat(new THREE.Color(o.skin).multiplyScalar(0.9).getHex()));
    this.place(nose, 0, -0.03, 0.005);
    nose.rotation.x = 0.15;

    // eyes
    const ex = this.eyeX = 0.088, ey = this.eyeY = 0.035;
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      this.place(g, side * ex, ey, -0.004);
      const pupil = bx(0.054, 0.088, 0.032, BLACK, false);
      g.add(pupil);
      const hl = bx(0.018, 0.018, 0.01, WHITE, false); hl.position.set(0.011, 0.022, 0.018); g.add(hl);
      const hl2 = bx(0.011, 0.011, 0.01, WHITE, false); hl2.position.set(-0.012, -0.022, 0.018); g.add(hl2);
      const lid = bx(0.07, 0.052, 0.04, mat(new THREE.Color(o.skin).multiplyScalar(0.82).getHex()), false);
      lid.position.set(0, 0.024, 0.006); g.add(lid);
      const bag = bx(0.066, 0.014, 0.02, mat(0x7a5a78), false); bag.position.set(0, -0.06, 0.0); g.add(bag);
      const caret = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.042, 0.016, 0.03, BLACK, false); b.position.set(k * 0.015, 0, 0); b.rotation.z = -k * 0.6; caret.add(b); }
      g.add(caret);
      const xm = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.08, 0.017, 0.03, BLACK, false); b.rotation.z = k * 0.785; xm.add(b); }
      g.add(xm);
      const brow = bx(0.08, 0.02, 0.03, mat(o.browColor || o.hairColor || 0x2a1a10), false);
      this.place(brow, side * ex, ey + 0.085, 0.0);
      this.eyes.push({ g, pupil, hl, hl2, lid, bag, caret, xm, brow, side });
    }

    // facial hair in front of the mouth area
    let mouthY = -0.11, mouthDz = 0.004;
    if (o.mustache) {
      const big = o.mustache === 'huge' ? 1.3 : 1.1;
      const m = new THREE.Group();
      const mm = mat(o.mustacheColor || 0x1e140e);
      const c = bx(0.16 * big, 0.05 * big, 0.06, mm); m.add(c);
      for (const k of [-1, 1]) {
        const b = bx(0.1 * big, 0.045 * big, 0.055, mm);
        b.position.set(k * 0.105 * big, -0.025 * big, -0.01); b.rotation.z = k * 0.5; m.add(b);
        const tip = bx(0.04 * big, 0.04 * big, 0.05, mm);
        tip.position.set(k * 0.15 * big, -0.06 * big, -0.02); tip.rotation.z = k * 0.9; m.add(tip);
      }
      this.place(m, 0, -0.075, 0.012);
      this.mustache = m;
      mouthY = -0.135; mouthDz = 0.0;
    }
    if (o.beard) mouthDz = 0.03;
    this.mouthY = mouthY;

    // mouths
    const mouth = this.mouth = new THREE.Group();
    this.place(mouth, 0, mouthY, mouthDz);
    const M = this.mouths = {};
    M.smile = new THREE.Group();
    { const b = bx(0.075, 0.02, 0.03, BLACK, false); b.position.y = -0.008; M.smile.add(b);
      for (const k of [-1, 1]) { const c = bx(0.02, 0.03, 0.03, BLACK, false); c.position.set(k * 0.045, 0.006, 0); M.smile.add(c); } }
    M.frown = new THREE.Group();
    { const b = bx(0.075, 0.02, 0.03, BLACK, false); b.position.y = 0.006; M.frown.add(b);
      for (const k of [-1, 1]) { const c = bx(0.02, 0.03, 0.03, BLACK, false); c.position.set(k * 0.045, -0.008, 0); M.frown.add(c); } }
    M.flat = bx(0.07, 0.018, 0.03, BLACK, false);
    M.o = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 8), BLACK, false); M.o.rotation.x = Math.PI / 2;
    M.open = new THREE.Group();
    { const b = bx(0.1, 0.07, 0.03, BLACK, false); M.open.add(b); M.openBox = b;
      const t = bx(0.06, 0.02, 0.032, TONGUE, false); t.position.y = -0.022; M.open.add(t); M.tongue = t; }
    M.grin = new THREE.Group();
    { const b = bx(0.13, 0.05, 0.03, BLACK, false); M.grin.add(b);
      const t = bx(0.11, 0.02, 0.034, WHITE, false); t.position.y = 0.008; M.grin.add(t); }
    M.wavy = new THREE.Group();
    for (let k = 0; k < 5; k++) { const b = bx(0.02, 0.016, 0.03, BLACK, false); b.position.set(-0.04 + k * 0.02, (k % 2 ? 0.007 : -0.007), 0); M.wavy.add(b); }
    for (const k in M) if (M[k].isObject3D && !['openBox', 'tongue'].includes(k)) mouth.add(M[k]);

    if (o.cap) {
      const capM = mat(0x1a2440), band = mat(0x0c0c10);
      const top = mesh(new THREE.CylinderGeometry(0.3, 0.255, 0.15, 8), capM); top.position.y = 0.27; this.head.add(top);
      const b = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.06, 8), band); b.position.y = 0.2; this.head.add(b);
      const v = bx(0.3, 0.025, 0.15, band); v.position.set(0, 0.185, 0.25); v.rotation.x = 0.3; this.head.add(v);
      const badge = bx(0.05, 0.055, 0.02, mat(0xc9961e, { emissive: 0x3a2800 })); badge.position.set(0, 0.27, 0.285); badge.rotation.x = -0.1; this.head.add(badge);
      this.cap = top;
    }
  }

  buildArm(side, o, skin) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group();
    sh.position.set(sx * 0.3, this.torsoH - 0.07, 0);
    this.spine.add(sh);
    const upper = hang(0.14, 0.32, 0.14, o.vest ? skin : tmat(o.shirt));
    sh.add(upper);
    if (o.sleeveCuff) { const c = hang(0.15, 0.06, 0.15, tmat(o.shirt)); sh.add(c); }
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const fore = hang(0.125, 0.28, 0.125, o.longSleeves ? tmat(o.shirt) : skin);
    el.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
    const palm = hang(0.05, 0.09, 0.1, skin); hand.add(palm);
    const fingers = [];
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group(); f.position.set(0, -0.088, -0.036 + k * 0.024); hand.add(f);
      const fm = hang(0.044, 0.065, 0.021, skin); f.add(fm);
      fingers.push(f);
    }
    const thumb = new THREE.Group(); thumb.position.set(-sx * 0.012, -0.03, 0.05); hand.add(thumb);
    const tm = hang(0.03, 0.06, 0.028, skin); thumb.add(tm); thumb.rotation.x = -0.5;
    let ring = null;
    if (o.ring && side === 'L') {
      ring = bx(0.052, 0.016, 0.027, GOLD); ring.position.y = -0.02; fingers[1].add(ring);
    }
    return { side, sx, sh, el, hand, fingers, thumb, ring };
  }

  buildLeg(side, o, pantsM) {
    const sx = side === 'L' ? 1 : -1;
    const hp = new THREE.Group(); hp.position.set(sx * 0.12, -0.04, 0); this.hips.add(hp);
    hp.add(hang(0.18, 0.45, 0.19, pantsM));
    const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
    kn.add(hang(0.16, 0.41, 0.17, pantsM));
    const ft = new THREE.Group(); ft.position.y = -0.41; kn.add(ft);
    const shoe = bx(0.17, 0.085, 0.29, mat(o.shoes || 0x3b2a1e)); shoe.position.set(0, -0.04, 0.05); ft.add(shoe);
    return { hp, kn, ft };
  }

  // neutral standing pose, neutral face
  reset() {
    this.root.visible = true;
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.hips.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.head.scale.setScalar(1);
    for (const s of ['L', 'R']) {
      const a = this.arm[s];
      a.sh.rotation.set(0, 0, a.sx * 0.1);
      a.el.rotation.set(-0.12, 0, 0);
      a.hand.rotation.set(0, 0, 0);
      a.fingers.forEach(f => f.rotation.set(0, 0, 0));
      const l = this.leg[s];
      l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); l.ft.rotation.set(0, 0, 0);
    }
    if (this.nose) { this.nose.scale.setScalar(1); this.nose.position.y = -0.03; }
    if (this.mustache) { this.mustache.rotation.z = 0; this.mustache.scale.setScalar(1); }
    this.face({});
    this.tears.forEach(t => { t.visible = false; t.scale.y = 1; });
  }

  // face expression
  face({ eyes = 'normal', eyeScale = 1, brows = 'neutral', browLift = 0, mouth = 'flat', open = 0.5, look = [0, 0], tears = 0, blink = 0 } = {}) {
    for (const e of this.eyes) {
      const s = e.side;
      e.pupil.visible = !['happy', 'x'].includes(eyes);
      e.caret.visible = eyes === 'happy';
      e.xm.visible = eyes === 'x';
      e.hl.visible = eyes === 'wide' || eyes === 'sparkle';
      e.hl2.visible = eyes === 'sparkle';
      e.lid.visible = eyes === 'tired';
      e.bag.visible = !!this.o.tired;
      let sy = 1, sxx = 1;
      if (eyes === 'wide') { sy = 1.45; sxx = 1.25; }
      if (eyes === 'sparkle') { sy = 1.5; sxx = 1.35; }
      if (eyes === 'closed') { sy = 0.16; }
      if (eyes === 'squint') { sy = 0.35; }
      if (eyes === 'tired') { sy = 0.85; }
      sy *= 1 - 0.85 * blink;
      e.pupil.scale.set(sxx * eyeScale, sy * eyeScale, 1);
      e.pupil.position.set(look[0] * 0.02, look[1] * 0.02, 0);
      e.hl.position.set(0.011 * sxx + look[0] * 0.02, 0.026 * sy + look[1] * 0.02, 0.018);
      // brows
      let rz = 0, y = this.eyeY + 0.085 + browLift;
      if (brows === 'worried') { rz = -s * 0.35; y += 0.015; }
      if (brows === 'angry') { rz = s * 0.35; y -= 0.01; }
      if (brows === 'raised') { y += 0.035; }
      if (eyes === 'wide' || eyes === 'sparkle') y += 0.02;
      e.brow.position.y = y;
      e.brow.rotation.z = rz;
    }
    for (const k of ['smile', 'frown', 'flat', 'o', 'open', 'grin', 'wavy']) this.mouths[k].visible = mouth === k;
    if (mouth === 'open') { this.mouths.openBox.scale.y = 0.25 + open; this.mouths.tongue.position.y = -0.035 * (0.25 + open) + 0.01; }
    if (mouth === 'o') this.mouths.o.scale.set(0.6 + open * 0.8, 1, 0.6 + open * 0.8);
    this.tears.forEach(t => { t.visible = tears > 0; t.scale.y = Math.max(0.01, tears); });
  }

  // world position of the head centre
  headWorld(v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.head.getWorldPosition(v); }
  handWorld(side, v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.arm[side].hand.getWorldPosition(v); }
  at(x, z, rotY = 0) { this.root.position.set(x, 0, z); this.root.rotation.set(0, rotY, 0); return this; }
}

// ------------------------------------------------------------------ IK
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion();
// place the wrist of an arm at a world-space target; `hint` is a world
// direction the elbow should bend toward (default: down/back/outward)
export function reach(p, side, target, hint = null) {
  const a = p.arm[side];
  p.root.updateMatrixWorld(true);
  const sp = p.spine;
  const T = sp.worldToLocal(target.clone()).sub(a.sh.position);
  const L1 = 0.3, L2 = 0.27;
  const d = THREE.MathUtils.clamp(T.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.005);
  const cosE = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const phi = Math.PI - Math.acos(THREE.MathUtils.clamp(cosE, -1, 1));
  a.el.rotation.set(-phi, 0, 0);
  // arm chain in shoulder space (before shoulder rotation)
  const A = new THREE.Vector3(0, -L1 - L2 * Math.cos(phi), L2 * Math.sin(phi));
  const E = new THREE.Vector3(0, -L1, 0);
  // elbow hint in spine space
  const sq = sp.getWorldQuaternion(new THREE.Quaternion()).invert();
  const h = (hint ? hint.clone() : new THREE.Vector3(0, -1, 0)).applyQuaternion(sq);
  if (!hint) h.add(new THREE.Vector3(a.sx * 0.6, 0, -0.5)).normalize();
  const basis = (dir, ref) => {
    const x = dir.clone().normalize();
    const y = ref.clone().addScaledVector(x, -ref.dot(x));
    if (y.lengthSq() < 1e-6) y.set(0, 0, 1).addScaledVector(x, -x.z);
    y.normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const B1 = basis(A, E), B2 = basis(T, h);
  _m1.copy(B2).multiply(B1.clone().transpose());
  a.sh.quaternion.setFromRotationMatrix(_m1);
  a.sh.rotation.setFromQuaternion(a.sh.quaternion);
}

// orient a hand in world space: fingers pointing along `fingers`, palm facing `palm`
export function handDir(p, side, fingers, palm) {
  const a = p.arm[side];
  p.root.updateMatrixWorld(true);
  const Y = fingers.clone().normalize().negate();
  const X = palm.clone().addScaledVector(Y, -palm.dot(Y)).normalize().multiplyScalar(-a.sx);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  _m2.makeBasis(X, Y, Z);
  const wq = new THREE.Quaternion().setFromRotationMatrix(_m2);
  const pq = a.el.getWorldQuaternion(_q).invert();
  a.hand.quaternion.copy(pq.multiply(wq));
  a.hand.rotation.setFromQuaternion(a.hand.quaternion);
}

export function noseWorld(p) {
  p.root.updateMatrixWorld(true);
  return p.nose.getWorldPosition(new THREE.Vector3());
}
export function faceDir(p) {
  p.root.updateMatrixWorld(true);
  return new THREE.Vector3(0, 0, 1).transformDirection(p.head.matrixWorld);
}

// ------------------------------------------------------------------ poses
export const P = {
  walk(p, phase, amp = 1, { swagger = 0, armAmp = 1 } = {}) {
    const s = Math.sin(phase), c = Math.cos(phase);
    p.leg.L.hp.rotation.x = -0.55 * amp * s;
    p.leg.R.hp.rotation.x = 0.55 * amp * s;
    p.leg.L.kn.rotation.x = 0.75 * amp * Math.max(0, Math.sin(phase - 1.2));
    p.leg.R.kn.rotation.x = 0.75 * amp * Math.max(0, -Math.sin(phase - 1.2));
    p.arm.L.sh.rotation.x = 0.5 * amp * armAmp * s;
    p.arm.R.sh.rotation.x = -0.5 * amp * armAmp * s;
    p.arm.L.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, -s);
    p.arm.R.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, s);
    p.body.position.y = 0.035 * amp * Math.abs(c);
    p.spine.rotation.y = 0.12 * amp * s * (1 + swagger);
    p.hips.rotation.y = -0.08 * amp * s;
    if (swagger) { p.spine.rotation.x = -0.1 * swagger; p.neck.rotation.x = -0.12 * swagger; p.arm.L.sh.rotation.z = 0.25 * swagger; p.arm.R.sh.rotation.z = -0.25 * swagger; }
  },
  run(p, phase, amp = 1) {
    const s = Math.sin(phase);
    p.leg.L.hp.rotation.x = -0.9 * amp * s;
    p.leg.R.hp.rotation.x = 0.9 * amp * s;
    p.leg.L.kn.rotation.x = 0.4 + 1.0 * amp * Math.max(0, Math.sin(phase - 1.0));
    p.leg.R.kn.rotation.x = 0.4 + 1.0 * amp * Math.max(0, -Math.sin(phase - 1.0));
    p.body.position.y = 0.06 * Math.abs(Math.cos(phase));
    p.spine.rotation.x = 0.18;
  },
  sit(p, seatH = 0.5) {
    p.body.position.y = seatH - p.hipY + 0.02;
    for (const s of ['L', 'R']) { p.leg[s].hp.rotation.x = -Math.PI / 2; p.leg[s].kn.rotation.x = Math.PI / 2; }
  },
  kneel(p) {
    p.body.position.y = -0.42;
    for (const s of ['L', 'R']) { p.leg[s].hp.rotation.x = -0.05; p.leg[s].kn.rotation.x = Math.PI / 2; p.leg[s].ft.rotation.x = 0.2; }
  },
  pray(p, t) {
    // hands together in front of the chest
    for (const s of ['L', 'R']) {
      const a = p.arm[s];
      a.sh.rotation.set(-0.75, 0, -a.sx * 0.12);
      a.el.rotation.set(-1.45, 0, 0);
      a.hand.rotation.set(0.1, -a.sx * 0.5, a.sx * 0.15);
    }
    p.spine.rotation.x = 0.05 + 0.03 * Math.sin(t * 6);
  },
  type(p, t, on = true, kb = null) {
    // wrists just behind the keyboard, fingers pointing forward onto the keys
    const f = new THREE.Vector3(Math.sin(p.root.rotation.y), 0, Math.cos(p.root.rotation.y));
    const l = new THREE.Vector3(f.z, 0, -f.x);
    const c = kb || p.root.position.clone().addScaledVector(f, 0.42 * p.root.scale.x).add(new THREE.Vector3(0, 1.13, 0));
    for (const s of ['L', 'R']) {
      const a = p.arm[s];
      const bob = on ? 0.018 * Math.max(0, Math.sin(t * 19 + (s === 'L' ? 0 : 2.1))) : 0;
      const tgt = c.clone().addScaledVector(l, a.sx * 0.11).addScaledVector(f, -0.07).add(new THREE.Vector3(0, 0.035 + bob, 0));
      reach(p, s, tgt, new THREE.Vector3(a.sx * 0.8, -0.6, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.root.rotation.y));
      handDir(p, s, f.clone().add(new THREE.Vector3(0, -0.35, 0)), new THREE.Vector3(0, -1, 0));
      a.fingers.forEach((fg, k) => {
        const tap = on ? Math.max(0, Math.sin(t * 22 + k * 1.9 + (s === 'L' ? 0 : 2.4))) : 0;
        fg.rotation.z = a.sx * (0.15 + 0.6 * tap);
      });
    }
  },
  holdNose(p, side = 'R') {
    const a = p.arm[side];
    const n = noseWorld(p), fd = faceDir(p);
    const tgt = n.clone().addScaledVector(fd, 0.05 * p.root.scale.x).add(new THREE.Vector3(0, -0.075 * p.root.scale.x, 0));
    reach(p, side, tgt, new THREE.Vector3(a.sx * 1.2, -0.7, -0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.root.rotation.y));
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(fd, -0.25);
    const lft = new THREE.Vector3(fd.z, 0, -fd.x);
    handDir(p, side, up, lft.multiplyScalar(-a.sx));
    a.fingers.forEach((f, k) => { f.rotation.z = a.sx * (k < 2 ? -0.9 : -1.4); });
    a.thumb.rotation.x = -1.0;
  },
  armsUp(p, spread = 1, wave = 0) {
    for (const s of ['L', 'R']) {
      const a = p.arm[s];
      a.sh.rotation.set(-0.3, 0, a.sx * (2.5 * spread + 0.3 * wave * (s === 'L' ? 1 : -1)));
      a.el.rotation.set(-0.25, 0, 0);
    }
  },
  armsOpen(p, amt = 1) {
    for (const s of ['L', 'R']) {
      const a = p.arm[s];
      a.sh.rotation.set(-1.25 * amt, 0, a.sx * 0.85 * amt);
      a.el.rotation.set(-0.2, 0, 0);
      a.hand.rotation.set(0, a.sx * 0.5, 0);
    }
  },
};

export function talk(t, rate = 11) {
  // mouth openness while speaking (deterministic)
  return 0.25 + 0.4 * Math.abs(Math.sin(t * rate)) * (0.6 + 0.4 * Math.sin(t * 3.7));
}

// ------------------------------------------------------------------ props held
export function makePhoto() {
  const g = new THREE.Group();
  const frame = bx(0.3, 0.38, 0.03, mat(0x4a2e1a));
  g.add(frame);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.32), new THREE.MeshBasicMaterial({ map: photoTexture() }));
  pic.position.z = 0.017;
  g.add(pic);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.32), new THREE.MeshBasicMaterial({ map: photoTexture() }));
  back.position.z = -0.017; back.rotation.y = Math.PI;
  g.add(back);
  return g;
}

// ------------------------------------------------------------------ dog
// German shepherd built as two poses: sitting, and fainted on its back.
export class Dog {
  constructor() {
    const fur = tmat(TEX.fur), saddle = tmat(TEX.furBack), dark = mat(0x231a12), light = mat(0xd9a466), paw = mat(0xb07a3e);
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.85);
    const add = (parent, m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
    const makeHead = () => {
      const H = new THREE.Group();
      add(H, bx(0.25, 0.22, 0.24, fur), 0, 0, 0);
      add(H, bx(0.26, 0.07, 0.2, saddle), 0, 0.1, -0.03);
      add(H, bx(0.14, 0.1, 0.19, light), 0, -0.05, 0.19);
      add(H, bx(0.145, 0.04, 0.17, mat(0x3a2a1c)), 0, 0.005, 0.2);
      add(H, bx(0.065, 0.05, 0.04, BLACK), 0, -0.01, 0.295);
      const tongue = add(H, bx(0.06, 0.02, 0.13, TONGUE), 0.03, -0.11, 0.24, 0.9, 0, 0);
      const eyes = [];
      for (const k of [-1, 1]) {
        const e = add(H, bx(0.036, 0.046, 0.02, BLACK, false), k * 0.07, 0.035, 0.122);
        const xm = new THREE.Group();
        for (const q of [-1, 1]) { const b = bx(0.06, 0.015, 0.02, BLACK, false); b.rotation.z = q * 0.785; xm.add(b); }
        add(H, xm, k * 0.07, 0.035, 0.127);
        eyes.push({ e, xm });
        add(H, mesh(new THREE.ConeGeometry(0.06, 0.17, 4), dark), k * 0.085, 0.18, -0.03, -0.12, Math.PI / 4, k * -0.18);
      }
      return { H, eyes, tongue };
    };

    // ---- sitting
    const S = this.sitG = new THREE.Group();
    this.root.add(S);
    add(S, bx(0.36, 0.26, 0.42, fur), 0, 0.13, -0.08);
    add(S, bx(0.37, 0.1, 0.32, saddle), 0, 0.27, -0.12);
    add(S, bx(0.3, 0.52, 0.3, fur), 0, 0.48, 0.05, 0.22);
    add(S, bx(0.31, 0.44, 0.1, saddle), 0, 0.5, -0.07, 0.22);
    add(S, bx(0.2, 0.3, 0.03, light), 0, 0.44, 0.205, 0.22);
    for (const k of [-1, 1]) {
      add(S, bx(0.085, 0.44, 0.085, fur), k * 0.09, 0.22, 0.2);
      add(S, bx(0.095, 0.05, 0.13, paw), k * 0.09, 0.025, 0.24);
      add(S, bx(0.1, 0.06, 0.17, paw), k * 0.2, 0.03, 0.12);
      add(S, bx(0.09, 0.2, 0.26, fur), k * 0.2, 0.12, -0.02, 0.2);
    }
    add(S, bx(0.18, 0.26, 0.18, fur), 0, 0.78, 0.14, 0.3);
    const hs = makeHead();
    this.head = hs.H; this.eyes = hs.eyes; this.tongue = hs.tongue;
    add(S, hs.H, 0, 0.94, 0.2);
    add(S, bx(0.075, 0.075, 0.42, saddle), 0.14, 0.05, -0.42, 0, 0.45, 0);

    // ---- fainted, legs in the air
    const F = this.flatG = new THREE.Group();
    this.root.add(F);
    add(F, bx(0.32, 0.27, 0.74, fur), 0, 0.14, 0);
    add(F, bx(0.24, 0.02, 0.55, light), 0, 0.28, 0.02);
    add(F, bx(0.33, 0.1, 0.5, saddle), 0, 0.05, -0.03);
    this.flatLegs = [];
    for (const [x, z] of [[0.1, 0.27], [-0.1, 0.27], [0.11, -0.27], [-0.11, -0.27]]) {
      const lg = new THREE.Group();
      add(F, lg, x, 0.24, z);
      const l = bx(0.085, 0.36, 0.085, fur); l.position.y = 0.18; lg.add(l);
      const pw = bx(0.095, 0.05, 0.12, paw); pw.position.y = 0.38; lg.add(pw);
      this.flatLegs.push(lg);
    }
    const hf = makeHead();
    this.headF = hf.H; this.eyesF = hf.eyes; this.tongueF = hf.tongue;
    add(F, hf.H, 0.03, 0.13, 0.5, -0.5, 0.2, 1.35);
    add(F, bx(0.075, 0.075, 0.42, saddle), -0.1, 0.05, -0.55, 0, -0.4, 0);
    this.sit();
  }
  xEyes(on) {
    for (const o of [...this.eyes, ...this.eyesF]) { o.e.visible = !on; o.xm.visible = on; }
    this.tongue.visible = on; this.tongueF.visible = on;
  }
  sit() {
    this.sitG.visible = true; this.flatG.visible = false;
    this.root.rotation.set(0, 0, 0);
    this.root.position.y = 0;
    this.head.rotation.set(0, 0, 0);
    this.eyes.forEach(o => o.e.scale.set(1, 1, 1));
    this.xEyes(false);
  }
  legsUp(twitch = 0) {
    this.sitG.visible = false; this.flatG.visible = true;
    this.flatLegs.forEach((l, k) => l.rotation.set((k < 2 ? 0.25 : -0.25) + twitch * (k % 2 ? 1 : -1), 0, (k % 2 ? -0.18 : 0.18)));
    this.xEyes(true);
  }
}
