// Smooth low-poly "mannequin" style: faceted shapes, black rectangle eyes, blocky hands, pastel colours.
import * as THREE from './lib/three.module.js';
export { THREE };
export const PI = Math.PI;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t = clamp(t), t * t * (3 - 2 * t));
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function RNG(seed) {
  let s = (seed * 2654435761) >>> 0 || 7;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- materials ----------
const mcache = new Map();
export function M(hex, o = {}) {
  const key = hex + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (mcache.has(key)) return mcache.get(key);
  let m;
  if (o.basic) m = new THREE.MeshBasicMaterial({ color: hex });
  else if (o.std) m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.65, metalness: o.metal ?? 0, flatShading: o.flat ?? true });
  else m = new THREE.MeshLambertMaterial({ color: hex, flatShading: o.flat ?? true });
  if (o.map) { m.map = o.map; }
  if (o.emissive != null) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.dw ?? false; }
  if (o.double) m.side = THREE.DoubleSide;
  mcache.set(key, m);
  return m;
}
export function mesh(geo, mat, parent = null, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export const box = (w, h, d, mat, parent, x, y, z, sh) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, sh);
export const cyl = (rt, rb, h, seg, mat, parent, x, y, z, sh) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, parent, x, y, z, sh);
export const ico = (r, det, mat, parent, x, y, z, sh) => mesh(new THREE.IcosahedronGeometry(r, det), mat, parent, x, y, z, sh);

export function canvasTex(w, h, draw, nearest = false, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------- palette ----------
export const P = {
  skin: 0xf0c4a0, skin2: 0xc98a62, skin3: 0x8d5a3a, skin4: 0xf6d6bd,
  mint: 0x9ee0c8, peach: 0xffc9a8, lavender: 0xc9b6ec, baby: 0xa9d6f2, butter: 0xffe48f, coral: 0xff8f86,
  pink: 0xffb3cf, teal: 0x6cc7bd, cream: 0xfaf5ec, white: 0xffffff, ink: 0x15151a, mouth: 0x5a1f24,
};

// ---------- mannequin ----------
const HEAD_R = [0.117, 0.146, 0.13]; // ellipsoid radii of the head (x, y, z)
function surfZ(x, y) { return HEAD_R[2] * Math.sqrt(Math.max(0, 1 - (x / HEAD_R[0]) ** 2 - (y / HEAD_R[1]) ** 2)); }

export class Mannequin {
  constructor(cfg) {
    cfg = this.cfg = Object.assign({
      skin: P.skin, top: null, bottom: null, dress: null, dressMap: null, sleeves: 'short', legs: 'shorts', shoes: 0xffffff,
      hair: 0x3a2618, hairStyle: 'short', glasses: false, scale: 1, wet: false, collar: false, straps: false,
    }, cfg);
    const skin = this.skinMat = M(cfg.skin, { std: true, r: cfg.wet ? 0.32 : 0.62 });
    const topM = cfg.top != null ? M(cfg.top, { std: true, r: 0.8, map: cfg.dressMap && cfg.dress != null ? cfg.dressMap : null }) : skin;
    const botM = cfg.bottom != null ? M(cfg.bottom, { std: true, r: 0.8 }) : skin;
    const shoeM = M(cfg.shoes, { std: true, r: 0.6 });
    this.private = []; // meshes from chest to knees (for the mosaic box)
    this.group = new THREE.Group(); this.root = new THREE.Group(); this.group.add(this.root);
    this.root.scale.setScalar(cfg.scale);
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.95; this.root.add(hips);
    this.pelvis = cyl(0.135, 0.125, 0.2, 9, botM, hips, 0, 0.03, 0); this.pelvis.scale.z = 0.72;
    this.private.push(this.pelvis);
    const spine = this.spine = new THREE.Group(); spine.position.y = 0.12; hips.add(spine);
    this.torso = cyl(0.19, 0.138, 0.44, 9, topM, spine, 0, 0.22, 0); this.torso.scale.z = 0.62;
    this.cap = ico(0.2, 1, topM, spine, 0, 0.42, 0); this.cap.scale.set(1.04, 0.33, 0.62);
    this.private.push(this.torso, this.cap);
    if (cfg.collar) { for (const s of [1, -1]) { const c = box(0.07, 0.03, 0.05, topM, spine, 0.04 * s, 0.47, 0.095); c.rotation.z = -0.5 * s; }
      box(0.012, 0.012, 0.01, M(0xffffff), spine, 0, 0.4, 0.122); box(0.012, 0.012, 0.01, M(0xffffff), spine, 0, 0.35, 0.124); }
    if (cfg.straps) for (const s of [1, -1]) box(0.03, 0.12, 0.13, topM, spine, 0.1 * s, 0.47, 0);
    this.neck = cyl(0.046, 0.052, 0.13, 8, skin, spine, 0, 0.5, 0);
    const head = this.head = new THREE.Group(); head.position.y = 0.55; spine.add(head);
    this.headMesh = ico(0.13, 1, skin, head, 0, 0.13, 0); this.headMesh.scale.set(HEAD_R[0] / 0.13, HEAD_R[1] / 0.13, 1);
    for (const s of [1, -1]) { const e = ico(0.026, 0, skin, head, 0.112 * s, 0.13, -0.005); e.scale.set(0.6, 1, 1); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), skin); nose.rotation.x = PI / 2; nose.position.set(0, 0.11, surfZ(0, -0.02) * 0.95 + 0.012); nose.castShadow = true; head.add(nose); this.nose = nose;
    this.features = new THREE.Group(); this.features.position.y = 0.13; head.add(this.features);
    // arms
    this.arms = [];
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0.215 * s, 0.4, 0); spine.add(sh);
      ico(0.056, 1, cfg.sleeves !== 'none' && cfg.top != null ? topM : skin, sh, 0, 0, 0);
      cyl(0.049, 0.043, 0.3, 8, skin, sh, 0, -0.15, 0);
      if (cfg.sleeves === 'short' && cfg.top != null) cyl(0.06, 0.055, 0.15, 8, topM, sh, 0, -0.06, 0);
      if (cfg.sleeves === 'long' && cfg.top != null) cyl(0.056, 0.05, 0.3, 8, topM, sh, 0, -0.15, 0);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      ico(0.044, 1, skin, el, 0, 0, 0);
      cyl(0.043, 0.035, 0.26, 8, skin, el, 0, -0.13, 0);
      const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
      box(0.078, 0.09, 0.036, skin, hand, 0, -0.04, 0);
      const fingers = box(0.072, 0.055, 0.032, skin, hand, 0, -0.11, 0);
      const thumb = box(0.024, 0.055, 0.026, skin, hand, -0.045 * s, -0.04, 0.012); thumb.rotation.z = 0.35 * s;
      this.arms.push({ sh, el, hand, fingers, thumb, s });
    }
    this.armL = this.arms[0]; this.armR = this.arms[1];
    // legs
    this.legs = [];
    for (const s of [1, -1]) {
      const th = new THREE.Group(); th.position.set(0.082 * s, 0, 0); hips.add(th);
      const thighM = cfg.legs === 'pants' || cfg.legs === 'shorts' ? botM : skin;
      const thigh = cyl(0.075, 0.058, 0.44, 9, cfg.legs === 'shorts' ? skin : thighM, th, 0, -0.22, 0);
      this.private.push(thigh);
      if (cfg.legs === 'shorts' && cfg.bottom != null) { const sh = cyl(0.085, 0.075, 0.22, 9, botM, th, 0, -0.08, 0); this.private.push(sh); }
      const kn = new THREE.Group(); kn.position.y = -0.44; th.add(kn);
      const knee = ico(0.057, 1, cfg.legs === 'pants' ? botM : skin, kn, 0, 0, 0); this.private.push(knee);
      cyl(0.055, 0.042, 0.42, 9, cfg.legs === 'pants' ? botM : skin, kn, 0, -0.21, 0);
      const foot = box(0.088, 0.06, 0.23, shoeM, kn, 0, -0.44, 0.05);
      this.legs.push({ th, kn, foot, s });
    }
    // dress / skirt
    if (cfg.dress != null) {
      const dm = M(cfg.dress, { std: true, r: 0.8, map: cfg.dressMap || null });
      const sk = this.skirt = new THREE.Group(); hips.add(sk); sk.position.y = 0.1;
      this.skirtMesh = cyl(0.15, 0.32, 0.56, 12, dm, sk, 0, -0.28, 0);
    }
    this.buildHair(cfg.hairStyle, cfg.hair);
    if (cfg.glasses) this.buildGlasses();
    this.faceKey = ''; this.setFace({});
    this.reset();
  }
  buildHair(style, col) {
    const hm = M(col, { std: true, r: this.cfg.wet ? 0.22 : 0.7 });
    const h = this.head, y0 = 0.13;
    const blob = (sx, sy, sz, x, y, z, rx = 0) => { const m = ico(1, 1, hm, h, x, y0 + y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; return m; };
    if (style === 'none') return;
    blob(0.124, 0.075, 0.135, 0, 0.09, -0.008);             // top cap
    blob(0.12, 0.115, 0.07, 0, 0.02, -0.075);               // back
    if (style === 'wet') {
      for (const [x, r] of [[-0.05, 0.4], [-0.015, -0.1], [0.03, 0.25], [0.06, -0.3]]) {
        const st = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 4), hm); st.position.set(x, y0 + 0.095, surfZ(x, 0.09) * 0.9 + 0.01);
        st.rotation.set(PI + 0.5, 0, r); h.add(st);
      }
    } else if (style === 'ponytail') {
      blob(0.05, 0.13, 0.05, 0, 0.03, -0.18, 0.5);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 4, 8), M(P.coral, { std: true })); tie.position.set(0, y0 + 0.1, -0.135); tie.rotation.x = 0.9; h.add(tie);
      const bang = box(0.17, 0.035, 0.05, hm, h, 0.02, y0 + 0.105, 0.098); bang.rotation.z = -0.15;
    } else if (style === 'bob') {
      for (const s of [1, -1]) blob(0.04, 0.1, 0.11, 0.1 * s, -0.01, -0.01);
      blob(0.125, 0.04, 0.12, 0, 0.11, 0.02);
    } else if (style === 'bun') {
      blob(0.06, 0.055, 0.06, 0, 0.12, -0.07);
    } else if (style === 'curly') {
      const r = RNG(7); for (let i = 0; i < 9; i++) blob(0.045, 0.045, 0.045, (r() - 0.5) * 0.2, 0.06 + r() * 0.06, (r() - 0.6) * 0.18);
    } else if (style === 'balding') {
      // grey sides only: shrink top cap
      h.children[h.children.length - 2].scale.set(0.11, 0.05, 0.11);
    }
  }
  buildGlasses() {
    const g = this.glasses = new THREE.Group(); this.features.add(g);
    const fm = M(0x222228, { std: true, r: 0.4 });
    for (const s of [1, -1]) {
      const x = 0.044 * s, z = surfZ(x, 0.012) * 0.95 + 0.02;
      box(0.058, 0.008, 0.008, fm, g, x, 0.036, z); box(0.058, 0.008, 0.008, fm, g, x, -0.012, z);
      box(0.008, 0.05, 0.008, fm, g, x + 0.029, 0.012, z); box(0.008, 0.05, 0.008, fm, g, x - 0.029, 0.012, z);
      box(0.006, 0.006, 0.11, fm, g, 0.1 * s, 0.03, z - 0.06);
    }
    box(0.03, 0.006, 0.006, fm, g, 0, 0.026, surfZ(0, 0.02) * 0.95 + 0.022);
  }
  // face: {eyes, brows, mouth, look:[x,y], blush}
  setFace(f) {
    f = Object.assign({ eyes: 'normal', brows: 'normal', mouth: 'flat', look: [0, 0], blush: false, eyeL: null, eyeR: null }, f);
    const key = JSON.stringify(f); if (key === this.faceKey) return; this.faceKey = key;
    const F = this.features;
    for (let i = F.children.length - 1; i >= 0; i--) if (F.children[i] !== this.glasses) F.remove(F.children[i]);
    const ink = M(P.ink, { std: true, r: 0.5 }), mm = M(P.mouth, { std: true, r: 0.6 }), white = M(0xffffff, { std: true, r: 0.5 });
    const put = (w, h, x, y, mat, rz = 0, d = 0.02) => { const b = box(w, h, d, mat, F, x, y, surfZ(x, y) * 0.95 + 0.006, false); b.rotation.z = rz; return b; };
    const [lx, ly] = f.look;
    for (const s of [1, -1]) {
      const ex = 0.043 * s, ey = 0.012;
      const e = (s === 1 ? f.eyeL : f.eyeR) || f.eyes;
      if (e === 'wide') put(0.032, 0.062, ex + lx, ey + 0.004 + ly, ink);
      else if (e === 'squint') put(0.032, 0.012, ex + lx, ey, ink);
      else if (e === 'closed') put(0.034, 0.007, ex, ey - 0.006, ink);
      else if (e === 'happy') { put(0.022, 0.008, ex - 0.009, ey, ink, 0.6); put(0.022, 0.008, ex + 0.009, ey, ink, -0.6); }
      else if (e === 'blank') put(0.02, 0.03, ex + lx, ey + ly, ink);
      else if (e === 'half') put(0.03, 0.02, ex + lx, ey - 0.008 + ly, ink);
      else if (e === 'determined') put(0.034, 0.024, ex + lx, ey + ly, ink, 0.15 * s);
      else put(0.024, 0.042, ex + lx, ey + ly, ink);
      if (f.brows !== 'none') {
        const bm = M(this.cfg.hair, { std: true, r: 0.7 });
        if (f.brows === 'up') put(0.042, 0.008, ex, 0.07, bm);
        else if (f.brows === 'angry') put(0.046, 0.009, ex - 0.002 * s, 0.055, bm, -0.45 * s);
        else if (f.brows === 'worried') put(0.044, 0.008, ex, 0.062, bm, 0.35 * s);
        else if (f.brows === 'cocky') put(0.044, 0.008, ex, s === 1 ? 0.07 : 0.055, bm, s === 1 ? -0.2 : 0.1);
        else put(0.042, 0.008, ex, 0.057, bm);
      }
      if (f.blush) put(0.03, 0.014, 0.065 * s, -0.035, M(0xff8fa0, { opacity: 0.75 }), 0, 0.012);
    }
    const my = -0.07;
    switch (f.mouth) {
      case 'smile': put(0.04, 0.009, 0, my - 0.004, mm); put(0.016, 0.009, 0.027, my + 0.002, mm, 0.6); put(0.016, 0.009, -0.027, my + 0.002, mm, -0.6); break;
      case 'grin': put(0.085, 0.038, 0, my, mm); put(0.078, 0.013, 0, my + 0.009, white, 0, 0.024); break;
      case 'smirk': put(0.04, 0.008, 0.008, my, mm, 0.18); break;
      case 'open': put(0.04, 0.034, 0, my, mm); break;
      case 'o': put(0.026, 0.032, 0, my, mm); break;
      case 'drop': put(0.05, 0.075, 0, my - 0.018, mm); break;
      case 'frown': put(0.04, 0.009, 0, my, mm); put(0.016, 0.009, 0.027, my - 0.006, mm, -0.6); put(0.016, 0.009, -0.027, my - 0.006, mm, 0.6); break;
      case 'chew': put(0.042, 0.016, 0, my, mm); break;
      case 'wavy': for (let i = 0; i < 4; i++) put(0.014, 0.008, -0.021 + i * 0.014, my + (i % 2 ? 0.004 : -0.004), mm, i % 2 ? -0.5 : 0.5); break;
      case 'tight': put(0.03, 0.007, 0, my, mm); break;
      case 'none': break;
      default: put(0.044, 0.008, 0, my, mm);
    }
  }
  // posing helpers (angles in radians)
  arm(side, fwd = 0, out = 0.08, twist = 0, bend = 0) { // side: 'L' | 'R'
    const a = side === 'L' ? this.armL : this.armR;
    a.sh.rotation.set(-fwd, twist * a.s, out * a.s, 'XZY'); a.el.rotation.set(-bend, 0, 0);
    return a;
  }
  leg(side, fwd = 0, out = 0, bend = 0) {
    const l = side === 'L' ? this.legs[0] : this.legs[1];
    l.th.rotation.set(-fwd, 0, out * l.s); l.kn.rotation.set(bend, 0, 0);
  }
  reset() {
    this.hips.position.set(0, 0.95, 0); this.hips.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    this.arm('L'); this.arm('R'); this.leg('L'); this.leg('R');
    for (const a of this.arms) a.hand.rotation.set(0, 0, 0);
    if (this.skirt) { this.skirt.rotation.set(0, 0, 0); this.skirt.scale.set(1, 1, 1); }
  }
  sit(h = 0.47) {
    this.hips.position.y = h;
    this.leg('L', PI / 2, 0.04, PI / 2); this.leg('R', PI / 2, 0.04, PI / 2);
    if (this.skirt) { this.skirt.rotation.x = -1.25; this.skirt.scale.set(1.02, 0.9, 0.62); this.skirt.position.z = 0.03; }
  }
  // world-space points (for anchors)
  worldOf(obj, local = V(0, 0, 0)) { obj.updateWorldMatrix(true, false); return obj.localToWorld(local.clone()); }
  faceCenter() { return this.worldOf(this.head, V(0, 0.12, 0.14)); }
}

// ---------- hearts / misc props ----------
export function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.18); s.bezierCurveTo(-0.45, 0.45, -0.1, 0.5, 0, 0.25);
  s.bezierCurveTo(0.1, 0.5, 0.45, 0.45, 0.5, 0.18); s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.1); return g;
}
export function softSprite(color = '#ffffff') {
  return canvasTex(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, color); g.addColorStop(0.5, color + 'aa'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
