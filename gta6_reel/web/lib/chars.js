// Smooth low-poly "mannequin" characters: faceted heads, black rectangle
// eyes, thin box limbs and blocky hands.
import * as THREE from 'three';

export const LAYER_FX = 2;      // transparent stuff (not in the censor depth pass)
export const LAYER_CENSOR = 1;  // the invisible "private zone" proxy

const BLACK = new THREE.MeshBasicMaterial({ color: 0x141414 });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const TONGUE = new THREE.MeshBasicMaterial({ color: 0xd2475a });
const TEAR = new THREE.MeshBasicMaterial({ color: 0x6fd0ff });

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!o.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, flatShading: true, ...o });
  delete m.unique;
  if (!o.unique) matCache.set(key, m);
  return m;
}
export function mesh(geo, m, cast = true) {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = cast;
  x.receiveShadow = true;
  return x;
}
export function bx(w, h, d, m, cast = true) { return mesh(new THREE.BoxGeometry(w, h, d), m, cast); }
function hang(w, h, d, m, taper = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (taper !== 1) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { p.setX(i, p.getX(i) * taper); p.setZ(i, p.getZ(i) * taper); }
  }
  g.translate(0, -h / 2, 0);
  return mesh(g, m);
}

export function faceted(r, seed, scale = [1, 1, 1], detail = 1, jit = 0.04) {
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
function shell(geo, f, keep) {
  const p = geo.attributes.position;
  const out = [];
  for (let i = 0; i < p.count; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += p.getX(i + k); cy += p.getY(i + k); cz += p.getZ(i + k); }
    if (!keep(cx / 3, cy / 3, cz / 3)) continue;
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
    const skin = this.skinMat = mat(o.skin || 0xeab894);
    this.root = new THREE.Group();
    this.root.scale.set((o.scale || 1) * (o.wide || 1), o.scale || 1, (o.scale || 1) * (o.wide || 1));
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.hipY = 0.92;
    this.hips = new THREE.Group();
    this.hips.position.y = this.hipY;
    this.body.add(this.hips);

    this.clothed = { shirt: o.shirt, pants: o.pants, shoes: o.shoes || 0x3a3a44, longSleeves: !!o.longSleeves, longPants: o.longPants !== false };
    this.parts = { shirt: [], sleeve: [], fore: [], pants: [], shin: [], shoe: [] };

    const pelvis = this.pelvis = bx(0.34, 0.2, 0.2, skin);
    this.hips.add(pelvis);
    this.parts.pants.push(pelvis);

    this.spine = new THREE.Group();
    this.spine.position.y = 0.06;
    this.hips.add(this.spine);
    const TH = this.torsoH = 0.56;
    const tg = new THREE.BoxGeometry(0.36, TH, 0.21);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) { tp.setX(i, tp.getX(i) * 1.18); tp.setZ(i, tp.getZ(i) * 1.05); }
    tg.translate(0, TH / 2, 0);
    tg.computeVertexNormals();
    this.torso = mesh(tg, skin);
    this.spine.add(this.torso);
    this.parts.shirt.push(this.torso);

    // accessories on the torso (apron, tie, jacket lapels...)
    this.extras = new THREE.Group();
    this.spine.add(this.extras);
    if (o.apron) {
      const a = bx(0.34, 0.62, 0.02, mat(o.apron)); a.position.set(0, 0.12, 0.115); this.extras.add(a);
      const pk = bx(0.16, 0.08, 0.01, mat(new THREE.Color(o.apron).multiplyScalar(0.85).getHex())); pk.position.set(0, 0.05, 0.128); this.extras.add(pk);
    }
    if (o.tie) {
      const t = bx(0.05, 0.3, 0.015, mat(o.tie)); t.position.set(0, 0.36, 0.115); this.extras.add(t);
      const sh = bx(0.12, 0.14, 0.01, mat(0xf4f4f4)); sh.position.set(0, 0.47, 0.11); this.extras.add(sh);
      this.extras.add(t);
    }
    if (o.lapels) {
      for (const sx of [-1, 1]) { const l = bx(0.08, 0.3, 0.01, mat(o.lapels)); l.position.set(sx * 0.08, 0.38, 0.113); l.rotation.z = -sx * 0.25; this.extras.add(l); }
    }
    if (o.print) { // little game print on a t-shirt
      const p = bx(0.16, 0.1, 0.01, mat(o.print)); p.position.set(0, 0.36, 0.112); this.extras.add(p);
    }

    this.neck = new THREE.Group();
    this.neck.position.y = TH;
    this.spine.add(this.neck);
    const nk = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 7), skin);
    nk.position.y = 0.04;
    this.neck.add(nk);
    this.head = new THREE.Group();
    this.head.position.y = 0.25;
    this.neck.add(this.head);
    this.buildHead(o, skin);

    this.arm = {};
    for (const s of ['L', 'R']) this.arm[s] = this.buildArm(s, skin);
    this.leg = {};
    for (const s of ['L', 'R']) this.leg[s] = this.buildLeg(s, skin);

    // tears
    this.tears = [];
    for (const side of [1, -1]) {
      const t = hang(0.022, 0.18, 0.01, TEAR);
      t.castShadow = false;
      t.position.set(side * this.eyeX, this.eyeY - 0.04, this.surfZ(this.eyeX, this.eyeY) + 0.01);
      t.visible = false;
      this.head.add(t);
      this.tears.push(t);
    }

    // censor proxy: an invisible box around the private zone, front and back
    if (o.censor) {
      const g = new THREE.BoxGeometry(0.5, 0.44, 0.36);
      g.translate(0, -0.1, 0);
      this.censorProxy = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      this.censorProxy.layers.set(LAYER_CENSOR);
      this.hips.add(this.censorProxy);
    }
    this.setNaked(false);
    this.reset();
  }

  setNaked(n) {
    this.naked = n;
    const sk = this.skinMat, c = this.clothed;
    const shirt = n || !c.shirt ? sk : mat(c.shirt);
    const pants = n || !c.pants ? sk : mat(c.pants);
    this.parts.shirt.forEach(m => { m.material = shirt; });
    this.parts.sleeve.forEach(m => { m.material = shirt; });
    this.parts.fore.forEach(m => { m.material = !n && c.longSleeves ? shirt : sk; });
    this.parts.pants.forEach(m => { m.material = pants; });
    this.parts.shin.forEach(m => { m.material = !n && c.longPants ? pants : sk; });
    this.parts.shoe.forEach(m => { m.material = n ? sk : mat(c.shoes); });
    this.extras.visible = !n;
    if (this.censorProxy) this.censorProxy.visible = n;
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
    const R = this.R = 0.19;
    const sc = this.sc = [0.95, 1.13, 1.0];
    const base = faceted(R, o.seed || 3, [1, 1, 1], 2, 0.05);
    const hg = base.clone();
    hg.scale(sc[0], sc[1], sc[2]);
    this.headMesh = mesh(hg, skin);
    this.head.add(this.headMesh);
    const hairM = mat(o.hairColor || 0x3b2a1e, { side: THREE.DoubleSide });
    const hairS = (f, keep) => { const g = shell(base, f, keep); g.scale(sc[0], sc[1], sc[2]); const m = mesh(g, hairM); this.head.add(m); return m; };
    if (o.hair === 'messy') {
      hairS(1.05, (x, y, z) => y > 0.05 || (z < -0.02 && y > -0.1));
      const R2 = rng(o.seed || 5);
      this.spikes = [];
      for (let k = 0; k < 13; k++) {
        const a = R2() * Math.PI * 2, el = 0.35 + R2() * 0.9;
        const cg = new THREE.ConeGeometry(0.05 + R2() * 0.03, 0.14 + R2() * 0.1, 4);
        cg.translate(0, 0.06, 0);
        const sp = mesh(cg, hairM);
        const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) * 0.9 - 0.15).normalize();
        sp.position.copy(dir.clone().multiplyScalar(R * 0.95)).multiply(new THREE.Vector3(sc[0], sc[1], sc[2]));
        sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.add(new THREE.Vector3((R2() - 0.5) * 0.8, 0, (R2() - 0.5) * 0.8)).normalize());
        this.head.add(sp);
        this.spikes.push(sp);
      }
    } else if (o.hair === 'short') {
      hairS(1.03, (x, y, z) => y > 0.07 || (z < -0.03 && y > -0.08));
    } else if (o.hair === 'bun') {
      hairS(1.05, (x, y, z) => y > 0.03 || (z < 0.0 && y > -0.12) || (Math.abs(x) > 0.15 && y > -0.05 && z < 0.05));
      const bun = mesh(faceted(0.085, 7, [1, 1, 1], 1), hairM); bun.position.set(0, 0.2, -0.1); this.head.add(bun);
    } else if (o.hair === 'bob') {
      hairS(1.06, (x, y, z) => y > 0.02 || (z < 0.03 && y > -0.2) || (Math.abs(x) > 0.13 && y > -0.18 && z < 0.08));
    } else if (o.hair === 'ponytail') {
      hairS(1.05, (x, y, z) => y > 0.04 || (z < 0.0 && y > -0.12));
      const pt = mesh(new THREE.ConeGeometry(0.06, 0.3, 5), hairM); pt.position.set(0, 0.0, -0.24); pt.rotation.x = -0.4; this.head.add(pt);
    }

    // beard that can grow (scene 2)
    if (o.beard) {
      const bm = mat(o.hairColor || 0x3b2a1e, { side: THREE.DoubleSide });
      const g = shell(base, 1.03, (x, y, z) => (y < -0.06 && z > -0.05) || (Math.abs(x) > 0.15 && y < 0.04 && y > -0.1 && z > -0.08 && z < 0.06));
      g.scale(sc[0], sc[1], sc[2]);
      this.beardShell = mesh(g, bm);
      this.head.add(this.beardShell);
      const cg = new THREE.ConeGeometry(0.13, 1, 5);
      cg.translate(0, -0.5, 0);
      cg.rotateX(Math.PI); // point down
      cg.translate(0, 0, 0);
      const long = mesh(new THREE.ConeGeometry(0.12, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI), bm);
      long.position.set(0, -0.16, 0.08);
      this.head.add(long);
      this.beardLong = long;
    }

    const nose = this.nose = bx(0.04, 0.06, 0.06, mat(new THREE.Color(o.skin || 0xeab894).multiplyScalar(0.94).getHex()));
    this.place(nose, 0, -0.025, 0.0);
    nose.rotation.x = 0.2;

    const ex = this.eyeX = 0.068, ey = this.eyeY = 0.025;
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      this.place(g, side * ex, ey, -0.002);
      const pupil = bx(0.036, 0.068, 0.025, BLACK, false); g.add(pupil);
      const hl = bx(0.012, 0.012, 0.01, WHITE, false); hl.position.set(0.008, 0.018, 0.014); g.add(hl);
      const white = bx(0.07, 0.085, 0.012, WHITE, false); white.position.z = -0.006; g.add(white);
      const red = new THREE.Group();
      for (let k = 0; k < 3; k++) { const v = bx(0.026, 0.004, 0.004, new THREE.MeshBasicMaterial({ color: 0xe0303a }), false); v.position.set(side * (0.024 + 0.004 * k), -0.01 + 0.016 * k, 0.001); v.rotation.z = side * (0.4 - 0.4 * k); red.add(v); }
      g.add(red);
      const caret = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.032, 0.012, 0.025, BLACK, false); b.position.set(k * 0.012, 0, 0); b.rotation.z = -k * 0.6; caret.add(b); }
      g.add(caret);
      const xm = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.06, 0.013, 0.025, BLACK, false); b.rotation.z = k * 0.785; xm.add(b); }
      g.add(xm);
      const circ = bx(0.06, 0.022, 0.012, mat(0x6e4f7a), false); circ.position.set(0, -0.052, -0.004); g.add(circ);
      const circ2 = bx(0.05, 0.014, 0.012, mat(0x8a6a92), false); circ2.position.set(0, -0.07, -0.006); g.add(circ2);
      const brow = bx(0.06, 0.016, 0.022, mat(o.browColor || o.hairColor || 0x3b2a1e), false);
      this.place(brow, side * ex, ey + 0.07, 0.0);
      this.eyes.push({ g, pupil, hl, white, red, caret, xm, circ, circ2, brow, side });
    }

    let mouthY = -0.09, mouthDz = 0.004;
    if (o.mustache) {
      const m = bx(0.12, 0.03, 0.03, mat(o.hairColor || 0x2a1a10)); this.place(m, 0, -0.06, 0.01);
      mouthY = -0.1;
    }
    if (o.beard) mouthDz = 0.026;
    this.mouthY = mouthY;
    const mouth = this.mouth = new THREE.Group();
    this.place(mouth, 0, mouthY, mouthDz);
    const M = this.mouths = {};
    M.smile = new THREE.Group();
    { const b = bx(0.06, 0.016, 0.025, BLACK, false); b.position.y = -0.006; M.smile.add(b);
      for (const k of [-1, 1]) { const c = bx(0.016, 0.024, 0.025, BLACK, false); c.position.set(k * 0.036, 0.005, 0); M.smile.add(c); } }
    M.frown = new THREE.Group();
    { const b = bx(0.06, 0.016, 0.025, BLACK, false); b.position.y = 0.005; M.frown.add(b);
      for (const k of [-1, 1]) { const c = bx(0.016, 0.024, 0.025, BLACK, false); c.position.set(k * 0.036, -0.006, 0); M.frown.add(c); } }
    M.flat = bx(0.055, 0.014, 0.025, BLACK, false);
    M.o = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.025, 8), BLACK, false); M.o.rotation.x = Math.PI / 2;
    M.open = new THREE.Group();
    { const b = bx(0.08, 0.06, 0.025, BLACK, false); M.open.add(b); M.openBox = b;
      const t = bx(0.05, 0.016, 0.027, TONGUE, false); t.position.y = -0.018; M.open.add(t); M.tongue = t; }
    M.grin = new THREE.Group();
    { const b = bx(0.11, 0.045, 0.025, BLACK, false); M.grin.add(b);
      const t = bx(0.095, 0.016, 0.028, WHITE, false); t.position.y = 0.008; M.grin.add(t); }
    M.wavy = new THREE.Group();
    for (let k = 0; k < 5; k++) { const b = bx(0.016, 0.013, 0.025, BLACK, false); b.position.set(-0.032 + k * 0.016, (k % 2 ? 0.006 : -0.006), 0); M.wavy.add(b); }
    for (const k of ['smile', 'frown', 'flat', 'o', 'open', 'grin', 'wavy']) mouth.add(M[k]);

    if (o.sunglasses) {
      const g = new THREE.Group();
      const sg = mat(0x0c0c10, { roughness: 0.2, metalness: 0.4 });
      for (const k of [-1, 1]) { const l = bx(0.085, 0.055, 0.02, sg, false); l.position.x = k * 0.07; g.add(l); }
      const br = bx(0.2, 0.015, 0.02, sg, false); br.position.y = 0.02; g.add(br);
      this.place(g, 0, this.eyeY, 0.018);
      g.rotation.set(0, 0, 0);
      this.sunglasses = g;
    }
    if (o.glasses) {
      const g = new THREE.Group();
      const fm = mat(o.glasses);
      for (const k of [-1, 1]) {
        for (const [w, h, x, y] of [[0.075, 0.012, 0, 0.035], [0.075, 0.012, 0, -0.035], [0.012, 0.07, 0.034, 0], [0.012, 0.07, -0.034, 0]]) {
          const b = bx(w, h, 0.012, fm, false); b.position.set(k * 0.07 + x, y, 0); g.add(b);
        }
      }
      this.place(g, 0, this.eyeY, 0.022);
      g.rotation.set(0, 0, 0);
    }
    // gas mask (scene 31)
    const gm = this.gasMask = new THREE.Group();
    const gmm = mat(0x4b5560), lens = mat(0x9fd8ff, { roughness: 0.1, metalness: 0.3 });
    const snout = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.09, 8), gmm); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.07, 0.2); gm.add(snout);
    for (const k of [-1, 1]) {
      const f = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), mat(0x2e343a)); f.rotation.z = Math.PI / 2; f.position.set(k * 0.09, -0.08, 0.17); gm.add(f);
      const l = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10), lens); l.rotation.x = Math.PI / 2; l.position.set(k * 0.068, 0.03, 0.18); gm.add(l);
    }
    const strap = bx(0.4, 0.03, 0.4, gmm); strap.position.set(0, 0.02, 0); gm.add(strap);
    gm.visible = false;
    this.head.add(gm);
  }

  buildArm(side, skin) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group();
    sh.position.set(sx * 0.255, this.torsoH - 0.06, 0);
    this.spine.add(sh);
    const upper = hang(0.09, 0.3, 0.09, skin, 0.9); sh.add(upper); this.parts.sleeve.push(upper);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    const fore = hang(0.08, 0.27, 0.08, skin, 0.85); el.add(fore); this.parts.fore.push(fore);
    const hand = new THREE.Group(); hand.position.y = -0.26; el.add(hand);
    const palm = hang(0.042, 0.08, 0.085, skin); hand.add(palm);
    const fingers = [];
    for (let k = 0; k < 2; k++) {
      // mannequin hands: two chunky finger blocks
      const f = new THREE.Group(); f.position.set(0, -0.078, -0.021 + k * 0.042); hand.add(f);
      f.add(hang(0.038, 0.06, 0.04, skin));
      fingers.push(f);
    }
    const thumb = new THREE.Group(); thumb.position.set(-sx * 0.01, -0.025, 0.045); hand.add(thumb);
    thumb.add(hang(0.026, 0.055, 0.026, skin)); thumb.rotation.x = -0.5;
    return { side, sx, sh, el, hand, fingers, thumb };
  }

  buildLeg(side, skin) {
    const sx = side === 'L' ? 1 : -1;
    const hp = new THREE.Group(); hp.position.set(sx * 0.095, -0.05, 0); this.hips.add(hp);
    const th = hang(0.13, 0.44, 0.14, skin, 0.88); hp.add(th); this.parts.pants.push(th);
    const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
    const shin = hang(0.105, 0.41, 0.115, skin, 0.85); kn.add(shin); this.parts.shin.push(shin);
    const ft = new THREE.Group(); ft.position.y = -0.41; kn.add(ft);
    const shoe = bx(0.11, 0.07, 0.24, skin); shoe.position.set(0, -0.03, 0.05); ft.add(shoe); this.parts.shoe.push(shoe);
    return { hp, kn, ft };
  }

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
      a.sh.rotation.set(0, 0, a.sx * 0.08);
      a.el.rotation.set(-0.1, 0, 0);
      a.hand.rotation.set(0, 0, 0);
      a.hand.position.y = -0.26;
      a.fingers.forEach(f => f.rotation.set(0, 0, 0));
      a.thumb.rotation.set(-0.5, 0, 0);
      const l = this.leg[s];
      l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); l.ft.rotation.set(0, 0, 0);
    }
    if (this.beardLong) { this.beardLong.scale.set(1, 0.001, 1); this.beardLong.visible = false; this.beardShell.visible = false; }
    this.gasMask.visible = false;
    this.face({});
    this.tears.forEach(t => { t.visible = false; });
  }

  face({ eyes = 'normal', eyeScale = 1, brows = 'neutral', mouth = 'flat', open = 0.5, look = [0, 0], tears = 0, blink = 0, crazy = 0 } = {}) {
    for (const e of this.eyes) {
      const s = e.side;
      e.pupil.visible = !['happy', 'x'].includes(eyes);
      e.caret.visible = eyes === 'happy';
      e.xm.visible = eyes === 'x';
      e.white.visible = eyes === 'crazy';
      e.red.visible = eyes === 'crazy';
      e.hl.visible = eyes === 'crazy' || eyes === 'wide';
      e.circ.visible = e.circ2.visible = !!this.o.darkCircles;
      let sy = 1, sxx = 1, ox = 0, oy = 0;
      if (eyes === 'wide') { sy = 1.35; sxx = 1.2; }
      if (eyes === 'crazy') { sy = s > 0 ? 0.75 + 0.2 * crazy : 0.55 - 0.25 * crazy; sxx = s > 0 ? 0.7 : 0.55; ox = look[0] * 0.012; oy = look[1] * 0.012; e.white.scale.set(s > 0 ? 1.15 : 0.95, s > 0 ? 1.1 : 0.9, 1); }
      if (eyes === 'closed') sy = 0.16;
      if (eyes === 'squint') sy = 0.4;
      sy *= 1 - 0.85 * blink;
      e.pupil.scale.set(sxx * eyeScale, sy * eyeScale, 1);
      e.pupil.position.set(look[0] * 0.012 + ox, look[1] * 0.012 + oy, 0);
      let rz = 0, y = this.eyeY + 0.07;
      if (brows === 'worried') { rz = -s * 0.35; y += 0.012; }
      if (brows === 'angry') { rz = s * 0.35; y -= 0.008; }
      if (brows === 'raised') y += 0.03;
      if (eyes === 'crazy') { rz = s > 0 ? -0.3 : 0.5; y += s > 0 ? 0.03 : -0.005; }
      e.brow.position.y = y;
      e.brow.rotation.z = rz;
    }
    for (const k of ['smile', 'frown', 'flat', 'o', 'open', 'grin', 'wavy']) this.mouths[k].visible = mouth === k;
    if (mouth === 'open') { this.mouths.openBox.scale.y = 0.25 + open; this.mouths.tongue.position.y = -0.03 * (0.25 + open) + 0.008; }
    if (mouth === 'o') this.mouths.o.scale.set(0.6 + open * 0.8, 1, 0.6 + open * 0.8);
    this.tears.forEach(t => { t.visible = tears > 0; t.scale.y = Math.max(0.01, tears); });
  }

  beard(len) {
    if (!this.beardLong) return;
    this.beardShell.visible = len > 0.02;
    this.beardLong.visible = len > 0.05;
    this.beardLong.scale.set(1 + len * 0.3, Math.max(0.001, len), 1 + len * 0.15);
  }

  headWorld(v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.head.getWorldPosition(v); }
  handWorld(side, v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.arm[side].hand.getWorldPosition(v); }
  at(x, z, rotY = 0, y = 0) { this.root.position.set(x, y, z); this.root.rotation.set(0, rotY, 0); return this; }
  facing() { const a = this.root.rotation.y; return new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); }
}

// ------------------------------------------------------------------ IK
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion();
export function reach(p, side, target, hint = null) {
  const a = p.arm[side];
  p.root.updateMatrixWorld(true);
  const sp = p.spine;
  const T = sp.worldToLocal(target.clone()).sub(a.sh.position);
  const L1 = 0.29, L2 = 0.26;
  const d = THREE.MathUtils.clamp(T.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.005);
  const cosE = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const phi = Math.PI - Math.acos(THREE.MathUtils.clamp(cosE, -1, 1));
  a.el.rotation.set(-phi, 0, 0);
  const A = new THREE.Vector3(0, -L1 - L2 * Math.cos(phi), L2 * Math.sin(phi));
  const E = new THREE.Vector3(0, -L1, 0);
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

// ------------------------------------------------------------------ poses
export const P = {
  walk(p, phase, amp = 1, { swagger = 0, arms = true } = {}) {
    const s = Math.sin(phase), c = Math.cos(phase);
    p.leg.L.hp.rotation.x = -0.55 * amp * s;
    p.leg.R.hp.rotation.x = 0.55 * amp * s;
    p.leg.L.kn.rotation.x = 0.75 * amp * Math.max(0, Math.sin(phase - 1.2));
    p.leg.R.kn.rotation.x = 0.75 * amp * Math.max(0, -Math.sin(phase - 1.2));
    if (arms) {
      p.arm.L.sh.rotation.x = 0.5 * amp * s;
      p.arm.R.sh.rotation.x = -0.5 * amp * s;
      p.arm.L.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, -s);
      p.arm.R.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, s);
    }
    p.body.position.y = 0.03 * amp * Math.abs(c);
    p.spine.rotation.y = 0.1 * amp * s;
    p.hips.rotation.y = -0.07 * amp * s;
    if (swagger) { p.spine.rotation.x = -0.08 * swagger; p.neck.rotation.x = -0.1 * swagger; }
  },
  sit(p, seatH = 0.48) {
    p.body.position.y = seatH - p.hipY + 0.02;
    for (const s of ['L', 'R']) { p.leg[s].hp.rotation.x = -Math.PI / 2; p.leg[s].kn.rotation.x = Math.PI / 2; }
  },
  kneel(p) {
    p.body.position.y = -0.4;
    for (const s of ['L', 'R']) { p.leg[s].hp.rotation.x = -0.05; p.leg[s].kn.rotation.x = Math.PI / 2; p.leg[s].ft.rotation.x = 0.2; }
  },
  squat(p, amt = 1) {
    // deep squat: hips down and back, knees forward
    p.body.position.y = -0.5 * amt;
    p.body.position.z = -0.12 * amt;
    for (const s of ['L', 'R']) {
      p.leg[s].hp.rotation.set(-1.75 * amt, 0, (s === 'L' ? 1 : -1) * 0.25 * amt);
      p.leg[s].kn.rotation.x = 2.05 * amt;
      p.leg[s].ft.rotation.x = -0.3 * amt;
    }
    p.spine.rotation.x = 0.45 * amt;
    p.neck.rotation.x = -0.35 * amt;
  },
  lieBack(p) {
    p.body.rotation.x = -Math.PI / 2;
    p.body.position.set(0, 0.12, -0.9);
  },
};
export function talk(t, rate = 11) {
  return 0.25 + 0.45 * Math.abs(Math.sin(t * rate)) * (0.6 + 0.4 * Math.sin(t * 3.7));
}

// ------------------------------------------------------------------ props
export function makeController() {
  const g = new THREE.Group();
  const body = mat(0x2b2d33);
  const c = bx(0.16, 0.035, 0.08, body); g.add(c);
  for (const k of [-1, 1]) {
    const h = bx(0.05, 0.035, 0.09, body); h.position.set(k * 0.07, -0.005, -0.045); h.rotation.y = -k * 0.35; g.add(h);
    const st = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 8), mat(0x111111)); st.position.set(k * 0.03, 0.025, -0.01); g.add(st);
  }
  const btns = [[0.055, 0.0, 0x4fd16b], [0.07, -0.015, 0xff5a5a], [0.04, -0.015, 0x5aa0ff], [0.055, -0.03, 0xffd84a]];
  for (const [x, z, col] of btns) { const b = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 6), mat(col)); b.position.set(x, 0.022, z + 0.01); g.add(b); }
  const dpad = bx(0.03, 0.01, 0.01, mat(0x111111)); dpad.position.set(-0.055, 0.022, 0.0); g.add(dpad);
  const dpad2 = bx(0.01, 0.01, 0.03, mat(0x111111)); dpad2.position.set(-0.055, 0.022, 0.0); g.add(dpad2);
  return g;
}
export function makeCup(color = 0xffffff, sleeve = 0xc28a4a) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.12, 10), mat(color)); g.add(c);
  const s = mesh(new THREE.CylinderGeometry(0.047, 0.042, 0.05, 10), mat(sleeve)); s.position.y = -0.005; g.add(s);
  const lid = mesh(new THREE.CylinderGeometry(0.048, 0.046, 0.015, 10), mat(0xf2f2f2)); lid.position.y = 0.066; g.add(lid);
  return g;
}
export function makeLaptop(color = 0xbfc6cf) {
  const g = new THREE.Group();
  const base = bx(0.32, 0.015, 0.22, mat(color)); g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.008, -0.11); g.add(lid);
  const scr = bx(0.32, 0.21, 0.012, mat(color)); scr.position.set(0, 0.105, 0); lid.add(scr);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.18), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }));
  disp.position.set(0, 0.105, 0.007); lid.add(disp);
  lid.rotation.x = -0.3;
  return g;
}
export function makeMic() {
  const g = new THREE.Group();
  const h = mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.2, 8), mat(0x222222)); h.position.y = -0.05; g.add(h);
  const b = mesh(new THREE.IcosahedronGeometry(0.04, 1), mat(0x555a60)); b.position.y = 0.08; g.add(b);
  const flag = bx(0.06, 0.05, 0.06, mat(0xe03a3a)); flag.position.y = 0.025; g.add(flag);
  return g;
}
export function makePhone() {
  const g = new THREE.Group();
  const b = bx(0.075, 0.15, 0.012, mat(0x1d1f24)); g.add(b);
  return g;
}
