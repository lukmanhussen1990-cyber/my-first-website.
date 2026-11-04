// Blocky low-poly characters with pixel-textured clothes, faceted heads,
// pixel eyes and blocky four-finger hands.
import * as THREE from 'three';
import { rng } from './pixel.js';

const BLACK = new THREE.MeshBasicMaterial({ color: 0x0d0d0d });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const TONGUE = new THREE.MeshBasicMaterial({ color: 0xc8424f });
const TEAR = new THREE.MeshBasicMaterial({ color: 0x5ec4ff, transparent: true, opacity: 0.92 });

const cache = new Map();
export function mat(c, o = {}) {
  if (c && c.isTexture) {
    const k = c.uuid + JSON.stringify(o);
    if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ map: c, roughness: 0.88, metalness: 0, flatShading: true, ...o }));
    return cache.get(k);
  }
  const k = c + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, flatShading: true, ...o }));
  return cache.get(k);
}
export function mesh(g, m, cast = true) { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; }
export function bx(w, h, d, m, cast = true) { return mesh(new THREE.BoxGeometry(w, h, d), m, cast); }
function hang(w, h, d, m) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0); return mesh(g, m); }

export function faceted(r, seed, scale = [1, 1, 1], detail = 1, jit = 0.06) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.attributes.position, R = rng(seed), seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) { j = [(R() - 0.5) * jit * r, (R() - 0.5) * jit * r, (R() - 0.5) * jit * r]; seen.set(key, j); }
    pos.setXYZ(i, (pos.getX(i) + j[0]) * scale[0], (pos.getY(i) + j[1]) * scale[1], (pos.getZ(i) + j[2]) * scale[2]);
  }
  g.computeVertexNormals();
  return g;
}
function shell(geo, f, keep) {
  const p = geo.attributes.position, out = [];
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
    const skin = this.skinMat = mat(o.skin || 0xe0ab84);
    this.root = new THREE.Group();
    const s = o.scale || 1, wd = o.wide || 1;
    this.root.scale.set(s * wd, s, s * wd);
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hipY = 0.92;
    this.hips = new THREE.Group(); this.hips.position.y = this.hipY; this.body.add(this.hips);
    const shirt = mat(o.shirt || 0xffffff), shirtF = mat(o.shirtFront || o.shirt || 0xffffff), pants = mat(o.pants || 0x333333);
    this.hips.add(bx(0.4, 0.2, 0.25, pants));
    this.spine = new THREE.Group(); this.spine.position.y = 0.06; this.hips.add(this.spine);
    const TH = this.torsoH = 0.58;
    const tg = new THREE.BoxGeometry(0.44, TH, 0.26);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) tp.setX(i, tp.getX(i) * 1.08);
    tg.translate(0, TH / 2, 0);
    this.torso = mesh(tg, [shirt, shirt, shirt, shirt, shirtF, shirt]);
    this.spine.add(this.torso);
    if (o.bowtie) {
      const bt = new THREE.Group();
      for (const k of [-1, 1]) { const w = bx(0.07, 0.06, 0.03, mat(o.bowtie)); w.position.x = k * 0.04; w.rotation.z = k * 0.25; bt.add(w); }
      bt.add(bx(0.03, 0.035, 0.035, mat(o.bowtie)));
      bt.position.set(0, TH - 0.04, 0.14); this.spine.add(bt);
    }
    if (o.flower) { const f = bx(0.05, 0.05, 0.03, mat(o.flower)); f.position.set(0.13, TH - 0.1, 0.14); this.spine.add(f); }
    // long skirt / robe hides the legs
    if (o.skirt) {
      const sg = new THREE.CylinderGeometry(o.skirtTop || 0.24, o.skirtBottom || 0.5, 0.95, 10, 1, false);
      sg.translate(0, -0.47, 0);
      this.skirt = mesh(sg, mat(o.skirt));
      this.skirt.position.y = 0.04;
      this.hips.add(this.skirt);
    }

    this.neck = new THREE.Group(); this.neck.position.y = TH; this.spine.add(this.neck);
    const nk = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 7), skin); nk.position.y = 0.04; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = 0.3; this.neck.add(this.head);
    this.buildHead(o, skin);

    this.arm = {}; for (const sd of ['L', 'R']) this.arm[sd] = this.buildArm(sd, o, skin, shirt);
    this.leg = {}; for (const sd of ['L', 'R']) this.leg[sd] = this.buildLeg(sd, o, pants);
    if (o.skirt) for (const sd of ['L', 'R']) this.leg[sd].hp.visible = false;

    this.tears = [];
    for (const side of [1, -1]) {
      const t = hang(0.024, 0.2, 0.012, TEAR); t.castShadow = false;
      t.position.set(side * this.eyeX, this.eyeY - 0.045, this.surfZ(this.eyeX, this.eyeY) + 0.012);
      t.visible = false; this.head.add(t); this.tears.push(t);
    }
    this.reset();
  }

  surfZ(x, y) { const r = this.R, sc = this.sc; return sc[2] * Math.sqrt(Math.max(0.0004, r * r - x * x - (y / sc[1]) ** 2)); }
  place(m, x, y, dz = 0) {
    const z = this.surfZ(x, y);
    m.position.set(x, y, z + dz);
    m.rotation.y = Math.atan2(x, z) * 0.9; m.rotation.x = -Math.atan2(y, z) * 0.6;
    this.head.add(m); return m;
  }

  buildHead(o, skin) {
    const R = this.R = 0.24, sc = this.sc = [1, 1.06, 0.97];
    const base = faceted(R, o.seed || 3, [1, 1, 1], 1, 0.08);
    const hg = base.clone(); hg.scale(...sc);
    this.head.add(mesh(hg, o.bald ? mat(o.skin || 0xe0ab84, { roughness: 0.45 }) : skin));
    const hairM = mat(o.hairColor || 0x3a2416, { side: THREE.DoubleSide });
    const hairS = (f, keep) => { const g = shell(base, f, keep); g.scale(...sc); const m = mesh(g, hairM); this.head.add(m); return m; };
    const h = o.hair;
    if (h === 'styled') {
      hairS(1.08, (x, y, z) => y > 0.06 || (z < -0.03 && y > -0.12) || (Math.abs(x) > 0.17 && y > -0.02 && z < 0.06));
      const q = mesh(faceted(0.13, 11, [1.6, 0.55, 1.05], 1, 0.15), hairM); q.position.set(0.03, 0.23, 0.08); q.rotation.set(-0.35, 0.15, 0.12); this.head.add(q);
    } else if (h === 'long') {
      hairS(1.07, (x, y, z) => y > 0.02 || (z < 0.02 && y > -0.3) || (Math.abs(x) > 0.16 && y > -0.2 && z < 0.08));
      const back = bx(0.42, 0.5, 0.12, hairM); back.position.set(0, -0.2, -0.17); this.head.add(back);
      const fr = bx(0.36, 0.06, 0.08, hairM); fr.position.set(0, 0.2, 0.17); fr.rotation.x = -0.35; this.head.add(fr);
    } else if (h === 'bun') {
      hairS(1.07, (x, y, z) => y > 0.03 || (z < 0.0 && y > -0.12) || (Math.abs(x) > 0.16 && y > -0.05 && z < 0.05));
      const bun = mesh(faceted(0.1, 7, [1, 1, 1], 1), hairM); bun.position.set(0, 0.22, -0.13); this.head.add(bun);
    } else if (h === 'short') {
      hairS(1.05, (x, y, z) => y > 0.08 || (z < -0.03 && y > -0.1));
    } else if (h === 'sides') { // grandpa: bald top, hair on the sides
      hairS(1.05, (x, y, z) => (Math.abs(x) > 0.15 && y > -0.08 && y < 0.1 && z < 0.08) || (z < -0.14 && y > -0.1 && y < 0.1));
    } else if (h === 'pigtails') {
      hairS(1.07, (x, y, z) => y > 0.03 || (z < 0.0 && y > -0.12));
      for (const k of [-1, 1]) { const p = mesh(faceted(0.08, 13 + k, [0.8, 1.5, 0.8], 0), hairM); p.position.set(k * 0.27, 0.02, -0.03); p.rotation.z = k * 0.4; this.head.add(p); }
    } else if (h === 'curly') {
      hairS(1.07, (x, y, z) => y > 0.05 || (z < 0.0 && y > -0.1));
      const R2 = rng(o.seed || 9);
      for (let k = 0; k < 9; k++) { const c = mesh(faceted(0.07, k + 30, [1, 1, 1], 0), hairM); const a = R2() * 6.28; c.position.set(Math.cos(a) * 0.18, 0.18 + R2() * 0.08, Math.sin(a) * 0.15 - 0.03); this.head.add(c); }
    }
    if (o.beard) {
      const g = shell(base, 1.045, (x, y, z) => (y < -0.06 && z > -0.06) || (Math.abs(x) > 0.17 && y < 0.05 && y > -0.12 && z > -0.1 && z < 0.06));
      g.scale(...sc); this.head.add(mesh(g, mat(o.beardColor || o.hairColor || 0x3a2416, { side: THREE.DoubleSide })));
    }
    const nose = this.nose = bx(0.05, 0.07, 0.07, mat(new THREE.Color(o.skin || 0xe0ab84).multiplyScalar(0.92).getHex()));
    this.place(nose, 0, -0.03, 0.0); nose.rotation.x = 0.15;
    const ex = this.eyeX = 0.085, ey = this.eyeY = 0.035;
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group(); this.place(g, side * ex, ey, -0.004);
      const pupil = bx(0.05, 0.08, 0.03, BLACK, false); g.add(pupil);
      const hl = bx(0.016, 0.016, 0.01, WHITE, false); hl.position.set(0.01, 0.022, 0.017); g.add(hl);
      const caret = new THREE.Group();
      for (const k of [-1, 1]) { const b = bx(0.04, 0.014, 0.03, BLACK, false); b.position.set(k * 0.014, 0, 0); b.rotation.z = -k * 0.6; caret.add(b); }
      g.add(caret);
      const lash = new THREE.Group();
      if (o.lashes) for (const k of [-1, 1]) { const b = bx(0.014, 0.03, 0.02, BLACK, false); b.position.set(side * 0.03 + k * 0.004, 0.05, 0); b.rotation.z = -side * 0.5; lash.add(b); }
      g.add(lash);
      const brow = bx(0.075, 0.018, 0.026, mat(o.browColor || o.hairColor || 0x2a1a10), false);
      this.place(brow, side * ex, ey + 0.085, 0.0);
      this.eyes.push({ g, pupil, hl, caret, brow, side });
    }
    if (o.blush) for (const k of [-1, 1]) { const b = bx(0.06, 0.03, 0.01, mat(0xff8fa8), false); this.place(b, k * 0.12, -0.04, 0.0); }
    let mouthY = -0.11, mouthDz = 0.004;
    if (o.mustache) {
      const mm = mat(o.mustacheColor || o.hairColor || 0x1e140e);
      const m = new THREE.Group();
      m.add(bx(0.2, 0.06, 0.06, mm));
      for (const k of [-1, 1]) { const b = bx(0.1, 0.05, 0.05, mm); b.position.set(k * 0.12, -0.03, -0.01); b.rotation.z = k * 0.45; m.add(b); }
      this.place(m, 0, -0.075, 0.012); mouthY = -0.135; mouthDz = 0;
    }
    if (o.beard) mouthDz = 0.03;
    const mouth = this.mouth = new THREE.Group(); this.place(mouth, 0, mouthY, mouthDz);
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
    { M.grin.add(bx(0.14, 0.05, 0.03, BLACK, false)); const t = bx(0.12, 0.02, 0.034, WHITE, false); t.position.y = 0.008; M.grin.add(t); }
    M.wavy = new THREE.Group();
    for (let k = 0; k < 5; k++) { const b = bx(0.02, 0.016, 0.03, BLACK, false); b.position.set(-0.04 + k * 0.02, (k % 2 ? 0.007 : -0.007), 0); M.wavy.add(b); }
    for (const k of ['smile', 'frown', 'flat', 'o', 'open', 'grin', 'wavy']) mouth.add(M[k]);
    if (o.lipstick) { M.smile.children.forEach(c => { c.material = mat(o.lipstick); }); M.grin.children[0].material = mat(o.lipstick); }

    if (o.glasses) {
      const g = new THREE.Group(), fm = mat(o.glasses);
      for (const k of [-1, 1]) for (const [w, hh, x, y] of [[0.085, 0.014, 0, 0.04], [0.085, 0.014, 0, -0.04], [0.014, 0.08, 0.04, 0], [0.014, 0.08, -0.04, 0]]) {
        const b = bx(w, hh, 0.014, fm, false); b.position.set(k * 0.085 + x, y, 0); g.add(b);
      }
      const br = bx(0.06, 0.012, 0.012, fm, false); br.position.y = 0.02; g.add(br);
      this.place(g, 0, this.eyeY, 0.024); g.rotation.set(0, 0, 0);
    }
    if (o.sunglasses) {
      const g = new THREE.Group(), sg = mat(0x101014, { roughness: 0.15, metalness: 0.5 });
      for (const k of [-1, 1]) { const l = bx(0.13, 0.09, 0.025, sg, false); l.position.x = k * 0.085; g.add(l); }
      const br = bx(0.27, 0.02, 0.025, sg, false); br.position.y = 0.035; g.add(br);
      this.place(g, 0, this.eyeY, 0.024); g.rotation.set(0, 0, 0);
      this.sunglasses = g;
    }
    if (o.veil) {
      const vm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false });
      const vg = new THREE.PlaneGeometry(0.62, 1.5, 1, 6); vg.translate(0, -0.75, 0);
      const vp = vg.attributes.position; for (let i = 0; i < vp.count; i++) { const y = vp.getY(i); vp.setX(i, vp.getX(i) * (0.8 + 0.6 * (-y / 1.5))); vp.setZ(i, -0.06 * (-y)); }
      vg.computeVertexNormals();
      this.veil = new THREE.Mesh(vg, vm); this.veil.position.set(0, 0.2, -0.17); this.veil.rotation.x = 0.12;
      this.head.add(this.veil);
      const tiara = bx(0.3, 0.04, 0.06, mat(0xfff2b0, { emissive: 0x6a5a20 })); tiara.position.set(0, 0.24, 0.05); this.head.add(tiara);
    }
  }

  buildArm(side, o, skin, shirt) {
    const sx = side === 'L' ? 1 : -1;
    const sh = new THREE.Group(); sh.position.set(sx * 0.29, this.torsoH - 0.07, 0); this.spine.add(sh);
    sh.add(hang(0.13, 0.3, 0.13, o.bareArms ? skin : shirt));
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    el.add(hang(0.12, 0.27, 0.12, o.shortSleeves || o.bareArms ? skin : shirt));
    if (o.cuffs) { const c = hang(0.125, 0.04, 0.125, mat(o.cuffs)); c.position.y = -0.22; el.add(c); }
    const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
    hand.add(hang(0.05, 0.09, 0.1, o.gloves ? mat(o.gloves) : skin));
    const fingers = [];
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group(); f.position.set(0, -0.088, -0.036 + k * 0.024); hand.add(f);
      f.add(hang(0.044, 0.07, 0.021, o.gloves ? mat(o.gloves) : skin));
      fingers.push(f);
    }
    const thumb = new THREE.Group(); thumb.position.set(-sx * 0.012, -0.03, 0.05); hand.add(thumb);
    thumb.add(hang(0.03, 0.06, 0.028, skin)); thumb.rotation.x = -0.5;
    if (o.ring && side === 'L') { const r = bx(0.052, 0.016, 0.027, mat(0xffc83a, { metalness: 0.4, roughness: 0.3, emissive: 0x5a4000 })); r.position.y = -0.02; fingers[2].add(r); }
    return { side, sx, sh, el, hand, fingers, thumb };
  }

  buildLeg(side, o, pants) {
    const sx = side === 'L' ? 1 : -1;
    const hp = new THREE.Group(); hp.position.set(sx * 0.11, -0.04, 0); this.hips.add(hp);
    hp.add(hang(0.17, 0.45, 0.18, pants));
    const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
    kn.add(hang(0.15, 0.41, 0.16, o.bareLegs ? this.skinMat : pants));
    const ft = new THREE.Group(); ft.position.y = -0.41; kn.add(ft);
    const shoe = bx(0.16, 0.08, 0.28, mat(o.shoes || 0x111111)); shoe.position.set(0, -0.04, 0.05); ft.add(shoe);
    return { hp, kn, ft };
  }

  reset() {
    this.root.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.hips.rotation.set(0, 0, 0); this.spine.rotation.set(0, 0, 0); this.spine.scale.set(1, 1, 1);
    this.neck.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0); this.head.scale.setScalar(1);
    for (const s of ['L', 'R']) {
      const a = this.arm[s];
      a.sh.rotation.set(0, 0, a.sx * 0.08); a.el.rotation.set(-0.12, 0, 0); a.hand.rotation.set(0, 0, 0);
      a.fingers.forEach(f => f.rotation.set(0, 0, 0)); a.thumb.rotation.set(-0.5, 0, 0);
      const l = this.leg[s]; l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); l.ft.rotation.set(0, 0, 0);
    }
    if (this.skirt) { this.skirt.scale.set(1, 1, 1); this.skirt.position.y = 0.04; this.skirt.rotation.set(0, 0, 0); }
    if (this.veil) this.veil.rotation.set(0.12, 0, 0);
    this.face({});
  }

  face({ eyes = 'normal', eyeScale = 1, brows = 'neutral', mouth = 'flat', open = 0.5, look = [0, 0], tears = 0, blink = 0, twitch = 0 } = {}) {
    for (const e of this.eyes) {
      const s = e.side;
      e.pupil.visible = eyes !== 'happy';
      e.caret.visible = eyes === 'happy';
      e.hl.visible = eyes === 'wide' || eyes === 'sparkle';
      let sy = 1, sxx = 1;
      if (eyes === 'wide') { sy = 1.4; sxx = 1.2; }
      if (eyes === 'sparkle') { sy = 1.45; sxx = 1.3; }
      if (eyes === 'closed') sy = 0.15;
      if (eyes === 'squint') sy = 0.38;
      if (eyes === 'nervous') { sy = 0.8 + 0.2 * Math.sin(s * 3 + twitch * 40); sxx = 0.85; }
      if (twitch && (s > 0)) sy *= 1 - 0.6 * twitch;
      sy *= 1 - 0.85 * blink;
      e.pupil.scale.set(sxx * eyeScale, sy * eyeScale, 1);
      e.pupil.position.set(look[0] * 0.02, look[1] * 0.02, 0);
      e.hl.position.set(0.01 * sxx + look[0] * 0.02, 0.026 * sy + look[1] * 0.02, 0.017);
      let rz = 0, y = this.eyeY + 0.085;
      if (brows === 'worried') { rz = -s * 0.35; y += 0.015; }
      if (brows === 'angry') { rz = s * 0.4; y -= 0.012; }
      if (brows === 'raised') y += 0.035;
      if (eyes === 'wide' || eyes === 'sparkle') y += 0.02;
      e.brow.position.y = y; e.brow.rotation.z = rz;
    }
    for (const k of ['smile', 'frown', 'flat', 'o', 'open', 'grin', 'wavy']) this.mouths[k].visible = mouth === k;
    if (mouth === 'open') { this.mouths.openBox.scale.y = 0.25 + open; this.mouths.tongue.position.y = -0.035 * (0.25 + open) + 0.01; }
    if (mouth === 'o') this.mouths.o.scale.set(0.6 + open * 0.9, 1, 0.6 + open * 0.9);
    this.tears.forEach(t => { t.visible = tears > 0; t.scale.y = Math.max(0.01, tears); });
  }

  headWorld(v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.head.getWorldPosition(v); }
  handWorld(side, v = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.arm[side].hand.getWorldPosition(v); }
  at(x, z, rotY = 0, y = 0) { this.root.position.set(x, y, z); this.root.rotation.set(0, rotY, 0); return this; }
  // hand shapes for rock / paper / scissors
  handShape(side, shape) {
    const a = this.arm[side];
    a.fingers.forEach((f, k) => {
      let c = 0;
      if (shape === 'rock') c = 1.5;
      if (shape === 'scissors') c = k >= 2 ? 0 : 1.5;  // fingers 2,3 are index+middle (front)
      if (shape === 'paper') c = 0;
      f.rotation.z = a.sx * c;
      f.rotation.x = shape === 'scissors' && k >= 2 ? (k === 2 ? 0.25 : -0.25) : 0;
    });
    a.thumb.rotation.x = shape === 'rock' ? -1.2 : -0.5;
  }
}

// ------------------------------------------------------------------ IK
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion();
export function reach(p, side, target, hint = null) {
  const a = p.arm[side];
  p.root.updateMatrixWorld(true);
  const sp = p.spine;
  const T = sp.worldToLocal(target.clone()).sub(a.sh.position);
  const L1 = 0.29, L2 = 0.27;
  const d = THREE.MathUtils.clamp(T.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.005);
  const phi = Math.PI - Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  a.el.rotation.set(-phi, 0, 0);
  const A = new THREE.Vector3(0, -L1 - L2 * Math.cos(phi), L2 * Math.sin(phi)), E = new THREE.Vector3(0, -L1, 0);
  const h = (hint ? hint.clone() : new THREE.Vector3(0, -1, 0)).applyQuaternion(sp.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (!hint) h.add(new THREE.Vector3(a.sx * 0.6, 0, -0.5)).normalize();
  const basis = (dir, ref) => {
    const x = dir.clone().normalize(), y = ref.clone().addScaledVector(x, -ref.dot(x));
    if (y.lengthSq() < 1e-6) y.set(0, 0, 1).addScaledVector(x, -x.z);
    y.normalize();
    return new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y));
  };
  _m1.copy(basis(T, h)).multiply(basis(A, E).transpose());
  a.sh.quaternion.setFromRotationMatrix(_m1);
  a.sh.rotation.setFromQuaternion(a.sh.quaternion);
}
export function handDir(p, side, fingers, palm) {
  const a = p.arm[side];
  p.root.updateMatrixWorld(true);
  const Y = fingers.clone().normalize().negate();
  const X = palm.clone().addScaledVector(Y, -palm.dot(Y)).normalize().multiplyScalar(-a.sx);
  _m2.makeBasis(X, Y, new THREE.Vector3().crossVectors(X, Y));
  const wq = new THREE.Quaternion().setFromRotationMatrix(_m2);
  a.hand.quaternion.copy(a.el.getWorldQuaternion(_q).invert().multiply(wq));
  a.hand.rotation.setFromQuaternion(a.hand.quaternion);
}

export const P = {
  walk(p, phase, amp = 1, { swagger = 0, arms = true } = {}) {
    const s = Math.sin(phase), c = Math.cos(phase);
    p.leg.L.hp.rotation.x = -0.55 * amp * s; p.leg.R.hp.rotation.x = 0.55 * amp * s;
    p.leg.L.kn.rotation.x = 0.75 * amp * Math.max(0, Math.sin(phase - 1.2));
    p.leg.R.kn.rotation.x = 0.75 * amp * Math.max(0, -Math.sin(phase - 1.2));
    if (arms) {
      p.arm.L.sh.rotation.x = 0.5 * amp * s; p.arm.R.sh.rotation.x = -0.5 * amp * s;
      p.arm.L.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, -s); p.arm.R.el.rotation.x = -0.3 - 0.2 * amp * Math.max(0, s);
    }
    p.body.position.y = 0.03 * amp * Math.abs(c);
    p.spine.rotation.y = 0.1 * amp * s; p.hips.rotation.y = -0.07 * amp * s;
    if (p.skirt) p.skirt.rotation.z = 0.06 * amp * s;
  },
  run(p, phase, amp = 1) {
    const s = Math.sin(phase);
    p.leg.L.hp.rotation.x = -0.9 * amp * s; p.leg.R.hp.rotation.x = 0.9 * amp * s;
    p.leg.L.kn.rotation.x = 0.4 + 1.0 * amp * Math.max(0, Math.sin(phase - 1.0));
    p.leg.R.kn.rotation.x = 0.4 + 1.0 * amp * Math.max(0, -Math.sin(phase - 1.0));
    p.arm.L.sh.rotation.x = 0.8 * amp * s; p.arm.R.sh.rotation.x = -0.8 * amp * s;
    p.arm.L.el.rotation.x = -1.2; p.arm.R.el.rotation.x = -1.2;
    p.body.position.y = 0.06 * Math.abs(Math.cos(phase)); p.spine.rotation.x = 0.2;
  },
  sit(p, seatH = 0.48) {
    p.body.position.y = seatH - p.hipY + 0.02;
    for (const s of ['L', 'R']) { p.leg[s].hp.rotation.x = -Math.PI / 2; p.leg[s].kn.rotation.x = Math.PI / 2; }
  },
};
export function talk(t, rate = 11) { return 0.25 + 0.45 * Math.abs(Math.sin(t * rate)) * (0.6 + 0.4 * Math.sin(t * 3.7)); }

// ------------------------------------------------------------------ a cheap seated guest (head, torso, arms) for filling the church
export class Guest {
  constructor(o, seed) {
    const R = rng(seed);
    this.root = new THREE.Group();
    const skin = mat(o.skin), cloth = mat(o.cloth);
    const torso = bx(0.42, 0.55, 0.26, cloth); torso.position.y = 0.78; this.root.add(torso);
    const lap = bx(0.4, 0.14, 0.42, mat(o.pants || o.cloth)); lap.position.set(0, 0.52, 0.12); this.root.add(lap);
    this.neck = new THREE.Group(); this.neck.position.y = 1.06; this.root.add(this.neck);
    const head = mesh(faceted(0.22, seed, [1, 1.05, 0.97], 1, 0.08), skin); head.position.y = 0.26; this.neck.add(head);
    this.head = head;
    const hair = mesh(faceted(0.23, seed + 1, [1.02, 0.62, 1.02], 1, 0.06), mat(o.hair, { side: THREE.DoubleSide })); hair.position.set(0, 0.36, -0.03); this.neck.add(hair);
    if (o.long) { const b = bx(0.38, 0.36, 0.1, mat(o.hair)); b.position.set(0, 0.16, -0.16); this.neck.add(b); }
    if (o.hat) { const h = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), mat(o.hat)); h.position.y = 0.45; this.neck.add(h); const c = mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.12, 10), mat(o.hat)); c.position.y = 0.5; this.neck.add(c); }
    this.eyes = [];
    for (const k of [-1, 1]) { const e = bx(0.045, 0.075, 0.03, BLACK, false); e.position.set(k * 0.08, 0.29, 0.2); this.neck.add(e); this.eyes.push(e); }
    this.mouth = bx(0.06, 0.016, 0.02, BLACK, false); this.mouth.position.set(0, 0.17, 0.205); this.neck.add(this.mouth);
    this.arms = [];
    for (const k of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(k * 0.26, 0.98, 0); this.root.add(a);
      const up = hang(0.12, 0.3, 0.12, cloth); a.add(up);
      const fo = new THREE.Group(); fo.position.y = -0.28; a.add(fo);
      fo.add(hang(0.11, 0.26, 0.11, cloth));
      const hd = bx(0.1, 0.1, 0.11, skin); hd.position.y = -0.3; fo.add(hd);
      a.rotation.x = -0.35; fo.rotation.x = -0.9;
      this.arms.push({ a, fo });
    }
    this.phase = R() * 10;
  }
}
