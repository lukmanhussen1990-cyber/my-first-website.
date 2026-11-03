// Low-poly blocky world for the wedding reel (PS1 / Roblox look).
import * as THREE from './lib/three.module.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
export { THREE };

export const PI = Math.PI;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t = clamp(t), t * t * (3 - 2 * t));
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export function RNG(seed) {
  let s = (seed * 2654435761) >>> 0 || 7;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- textures & materials ----------
const texCache = new Map();
export function noiseTex(hex, amt = 0.07, size = 8, seed = 1) {
  const key = `${hex}|${amt}|${size}|${seed}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r0 = (hex >> 16) & 255, g0 = (hex >> 8) & 255, b0 = hex & 255;
  const rnd = RNG(seed * 97 + size + (hex & 0xffff));
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const k = 1 + (rnd() * 2 - 1) * amt;
    img.data[i * 4] = Math.min(255, r0 * k);
    img.data[i * 4 + 1] = Math.min(255, g0 * k);
    img.data[i * 4 + 2] = Math.min(255, b0 * k);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const matCache = new Map();
export function mat(hex, o = {}) {
  const key = hex + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (o.basic) {
    m = new THREE.MeshBasicMaterial({ color: hex });
  } else {
    m = new THREE.MeshLambertMaterial({ map: noiseTex(hex, o.noise ?? 0.06, o.size ?? 8, o.seed ?? 1) });
  }
  m.userData.hex = hex;
  if (o.emissive != null) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.double) m.side = THREE.DoubleSide;
  if (o.repeat) { const t = m.map.clone(); t.needsUpdate = true; t.repeat.set(o.repeat, o.repeat); m.map = t; }
  matCache.set(key, m);
  return m;
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function box(w, h, d, m, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), typeof m === 'number' ? mat(m) : m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}
export function cyl(rt, rb, h, seg, m, x = 0, y = 0, z = 0, parent = null) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof m === 'number' ? mat(m) : m);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

// ---------- palette ----------
export const C = {
  skinA: 0xb9794b, skinB: 0xd9a77c, skinC: 0x8a5634, skinD: 0xe8bf98,
  black: 0x17171d, suit: 0x1c1c24, white: 0xf4f2ec, dress: 0xf7f5f0,
  hairBlack: 0x15110f, hairBrown: 0x5a3820, hairGrey: 0xb9b6b0, hairBlond: 0xd8b25a,
  pink: 0xf4a6c0, red: 0xd8435a, gold: 0xe6b93a, purple: 0x6a3f9e,
  grass: 0x67a243, wood: 0xb08355, eyeDark: 0x141414, mouth: 0x6e1f22,
  stink: 0x8fe03a, tear: 0x8fd3ff, brownStain: 0x7a4a22,
};

// ---------- people ----------
const UP = new THREE.Vector3(0, -1, 0);
export class Person {
  constructor(cfg) {
    cfg = this.cfg = Object.assign({
      kind: 'man', skin: C.skinA, hair: C.hairBlack, hairStyle: 'short', top: 0x3a5ea8, sleeve: null,
      bottom: 0x2a2a35, shoes: 0x1a1a1a, scale: 1, glasses: false, eyes: 'white',
    }, cfg);
    const sleeve = cfg.sleeve ?? cfg.top;
    this.group = new THREE.Group();
    this.root = new THREE.Group(); this.group.add(this.root);
    this.root.scale.setScalar(cfg.scale);
    this.hips = new THREE.Group(); this.hips.position.y = 0.9; this.root.add(this.hips);
    // legs (thigh + knee + shin)
    this.legs = [];
    for (const sx of [1, -1]) {
      const thigh = new THREE.Group(); thigh.position.set(0.125 * sx, 0, 0); this.hips.add(thigh);
      box(0.22, 0.46, 0.25, cfg.bottom, 0, -0.22, 0, thigh);
      const knee = new THREE.Group(); knee.position.y = -0.45; thigh.add(knee);
      box(0.21, 0.42, 0.24, cfg.bottom, 0, -0.2, 0, knee);
      box(0.23, 0.1, 0.33, cfg.shoes, 0, -0.4, 0.04, knee);
      this.legs.push({ thigh, knee });
    }
    // torso
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    this.torsoMesh = box(0.54, 0.64, 0.3, cfg.top, 0, 0.32, 0, this.torso);
    // arms
    this.arms = [];
    for (const sx of [1, -1]) {
      const a = new THREE.Group(); a.position.set(0.37 * sx, 0.58, 0); this.torso.add(a);
      box(0.17, 0.56, 0.19, sleeve, 0, -0.26, 0, a);
      const hand = box(0.15, 0.15, 0.16, cfg.skin, 0, -0.6, 0, a);
      this.arms.push({ g: a, hand, sx });
    }
    this.armL = this.arms[0]; this.armR = this.arms[1];
    // head
    box(0.17, 0.08, 0.17, cfg.skin, 0, 0.68, 0, this.torso);
    this.head = new THREE.Group(); this.head.position.set(0, 0.71, 0); this.torso.add(this.head);
    this.headMesh = box(0.46, 0.46, 0.42, cfg.skin, 0, 0.24, 0, this.head);
    this.face = new THREE.Group(); this.face.position.set(0, 0.24, 0.21); this.head.add(this.face);
    this.noseG = new THREE.Group(); this.noseG.position.set(0, -0.03, 0); this.face.add(this.noseG);
    const sk = cfg.skin, nc = (((sk >> 16) & 255) * 0.86) << 16 | (((sk >> 8) & 255) * 0.86) << 8 | ((sk & 255) * 0.86);
    this.nose = box(0.075, 0.1, 0.08, nc, 0, 0, 0.04, this.noseG);
    this.features = new THREE.Group(); this.face.add(this.features);
    this.faceKey = '';
    this.buildHair(cfg.hairStyle, cfg.hair);
    this.buildOutfit();
    this.setFace({});
    this.reset();
  }
  buildHair(style, col) {
    const h = this.head;
    const hm = mat(col, { noise: 0.1 });
    if (style === 'slick') {
      box(0.48, 0.1, 0.45, hm, 0, 0.5, -0.01, h);
      box(0.48, 0.3, 0.06, hm, 0, 0.34, -0.205, h);
      box(0.05, 0.22, 0.4, hm, 0.235, 0.38, -0.02, h); box(0.05, 0.22, 0.4, hm, -0.235, 0.38, -0.02, h);
      box(0.3, 0.06, 0.08, hm, 0.06, 0.47, 0.2, h); // front quiff
    } else if (style === 'bun') {
      box(0.5, 0.12, 0.46, hm, 0, 0.5, -0.01, h);
      box(0.5, 0.44, 0.08, hm, 0, 0.28, -0.22, h);
      box(0.06, 0.34, 0.42, hm, 0.245, 0.33, -0.02, h); box(0.06, 0.34, 0.42, hm, -0.245, 0.33, -0.02, h);
      box(0.22, 0.2, 0.18, hm, 0, 0.52, -0.25, h); // bun
    } else if (style === 'bald') {
      box(0.06, 0.16, 0.36, hm, 0.24, 0.3, -0.03, h); box(0.06, 0.16, 0.36, hm, -0.24, 0.3, -0.03, h);
      box(0.48, 0.16, 0.06, hm, 0, 0.3, -0.215, h);
    } else if (style === 'cap') {
      box(0.5, 0.14, 0.46, mat(0xc0392b), 0, 0.52, 0, h);
      box(0.46, 0.035, 0.2, mat(0xa93226), 0, 0.46, 0.3, h);
      box(0.48, 0.16, 0.06, hm, 0, 0.36, -0.215, h);
    } else if (style === 'pigtails') {
      box(0.5, 0.12, 0.46, hm, 0, 0.5, -0.01, h);
      box(0.5, 0.36, 0.07, hm, 0, 0.32, -0.22, h);
      box(0.12, 0.26, 0.12, hm, 0.31, 0.3, -0.08, h); box(0.12, 0.26, 0.12, hm, -0.31, 0.3, -0.08, h);
      box(0.2, 0.06, 0.06, mat(C.pink), 0, 0.57, 0.12, h);
    } else if (style === 'long') {
      box(0.5, 0.12, 0.46, hm, 0, 0.5, -0.01, h);
      box(0.5, 0.62, 0.08, hm, 0, 0.2, -0.22, h);
      box(0.06, 0.5, 0.4, hm, 0.245, 0.24, -0.03, h); box(0.06, 0.5, 0.4, hm, -0.245, 0.24, -0.03, h);
    } else if (style === 'roman') {
      box(0.48, 0.1, 0.45, hm, 0, 0.5, -0.01, h);
      box(0.48, 0.26, 0.06, hm, 0, 0.36, -0.205, h);
      const lm = mat(0x6f7a2a);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * PI * 2;
        const leaf = box(0.09, 0.05, 0.05, lm, Math.sin(a) * 0.255, 0.47 + (i % 2) * 0.02, Math.cos(a) * 0.235, h);
        leaf.rotation.y = a;
      }
      box(0.4, 0.14, 0.05, hm, 0, 0.02, 0.215, h); // beard
      box(0.07, 0.14, 0.3, hm, 0.235, 0.12, 0.05, h); box(0.07, 0.14, 0.3, hm, -0.235, 0.12, 0.05, h);
    } else if (style === 'messy') {
      box(0.5, 0.12, 0.47, hm, 0, 0.5, -0.01, h);
      box(0.5, 0.3, 0.07, hm, 0, 0.34, -0.215, h);
      box(0.06, 0.2, 0.4, hm, 0.245, 0.38, -0.02, h); box(0.06, 0.2, 0.4, hm, -0.245, 0.38, -0.02, h);
      const r = RNG(5);
      for (let i = 0; i < 9; i++) {
        const b = box(0.12 + r() * 0.08, 0.12 + r() * 0.1, 0.12, hm, (r() - 0.5) * 0.42, 0.57 + r() * 0.05, (r() - 0.5) * 0.36, h);
        b.rotation.set((r() - 0.5) * 0.8, (r() - 0.5) * 1.2, (r() - 0.5) * 0.9);
      }
      const f = box(0.3, 0.09, 0.08, hm, -0.08, 0.46, 0.21, h); f.rotation.z = 0.2;
    } else if (style === 'afro') {
      box(0.68, 0.44, 0.62, hm, 0, 0.52, -0.05, h);
      box(0.13, 0.38, 0.52, hm, 0.3, 0.3, -0.06, h); box(0.13, 0.38, 0.52, hm, -0.3, 0.3, -0.06, h);
    } else if (style === 'seventies') {
      box(0.58, 0.2, 0.54, hm, 0, 0.53, -0.02, h); box(0.58, 0.56, 0.1, hm, 0, 0.28, -0.25, h);
      box(0.1, 0.42, 0.48, hm, 0.28, 0.3, -0.03, h); box(0.1, 0.42, 0.48, hm, -0.28, 0.3, -0.03, h);
      const f = box(0.38, 0.1, 0.1, hm, 0.06, 0.5, 0.22, h); f.rotation.z = -0.15;
    } else { // short
      box(0.48, 0.1, 0.45, hm, 0, 0.5, -0.01, h);
      box(0.48, 0.24, 0.06, hm, 0, 0.36, -0.205, h);
      box(0.05, 0.16, 0.36, hm, 0.235, 0.4, -0.03, h); box(0.05, 0.16, 0.36, hm, -0.235, 0.4, -0.03, h);
    }
  }
  hideLegs() { for (const l of this.legs) l.thigh.visible = false; }
  buildOutfit() {
    const c = this.cfg, t = this.torso;
    if (c.kind === 'groom' || c.kind === 'boy') {
      box(0.17, 0.5, 0.012, C.white, 0, 0.36, 0.152, t);
      box(0.06, 0.07, 0.02, C.black, 0.045, 0.56, 0.165, t); box(0.06, 0.07, 0.02, C.black, -0.045, 0.56, 0.165, t);
      box(0.035, 0.04, 0.03, C.black, 0, 0.56, 0.17, t);
      box(0.03, 0.03, 0.02, C.black, 0, 0.3, 0.162, t); box(0.03, 0.03, 0.02, C.black, 0, 0.18, 0.162, t);
      if (c.kind === 'groom') {
        box(0.07, 0.07, 0.05, 0xffffff, 0.17, 0.48, 0.16, t); box(0.04, 0.04, 0.03, C.pink, 0.17, 0.48, 0.19, t);
      }
    }
    if (c.kind === 'bride' || c.kind === 'girl' || c.kind === 'woman') {
      this.hideLegs();
      const skirtCol = c.kind === 'bride' ? C.dress : c.bottom;
      const sk = cyl(0.28, 0.62, 0.92, 8, mat(skirtCol, { noise: 0.04 }), 0, -0.44, 0, this.hips);
      if (c.kind === 'bride') {
        cyl(0.3, 0.3, 0.06, 8, mat(0xe9e2d4), 0, 0.0, 0, this.hips);
        // veil
        const veil = box(0.52, 1.05, 0.02, mat(0xffffff, { opacity: 0.55, noise: 0.02 }), 0, -0.12, -0.25, this.head, false);
        veil.rotation.x = 0.08;
        box(0.36, 0.05, 0.05, mat(C.gold), 0, 0.53, 0.06, this.head); // tiara
        box(0.06, 0.06, 0.06, mat(0xbde8ff, { emissive: 0x335566 }), 0, 0.57, 0.08, this.head);
      }
      this.skirt = sk;
    }
    if (c.kind === 'priest' || c.kind === 'roman') {
      this.hideLegs();
      const robeCol = c.kind === 'priest' ? 0xf1eee6 : 0xe6d7b4;
      cyl(0.3, 0.42, 0.92, 6, mat(robeCol, { noise: 0.05 }), 0, -0.45, 0, this.hips);
      if (c.kind === 'priest') {
        const st = mat(c.stole ?? C.purple);
        box(0.08, 0.66, 0.015, st, 0.1, 0.3, 0.155, t); box(0.08, 0.66, 0.015, st, -0.1, 0.3, 0.155, t);
        box(0.08, 0.66, 0.015, st, 0.1, -0.2, 0.31, this.hips); box(0.08, 0.66, 0.015, st, -0.1, -0.2, 0.31, this.hips);
        box(0.1, 0.05, 0.02, mat(C.gold), 0.1, -0.5, 0.322, this.hips); box(0.1, 0.05, 0.02, mat(C.gold), -0.1, -0.5, 0.322, this.hips);
      } else {
        const sash = box(0.2, 0.9, 0.34, mat(0xd4c29a), 0.05, 0.3, 0.0, t);
        sash.rotation.z = 0.55;
        box(0.25, 0.08, 0.3, mat(0x7b5a34), 0.14, -0.88, 0.04, this.hips); box(0.25, 0.08, 0.3, mat(0x7b5a34), -0.14, -0.88, 0.04, this.hips);
      }
    }
    if (c.kind === 'photog') {
      box(0.2, 0.2, 0.012, mat(0x3b3b3b), 0, 0.42, 0.152, t); // shirt print
      const cam = this.camera = new THREE.Group();
      box(0.26, 0.17, 0.14, mat(0x1d1d1f), 0, 0, 0, cam);
      box(0.1, 0.07, 0.08, mat(0x2a2a2a), -0.06, 0.12, 0, cam);
      box(0.12, 0.05, 0.06, mat(0xf4f4f4, { emissive: 0x222222 }), -0.06, 0.18, 0.0, cam);
      const lens = cyl(0.075, 0.085, 0.26, 10, mat(0x111111), 0.02, -0.01, 0.18, cam); lens.rotation.x = PI / 2;
      const glass = cyl(0.06, 0.06, 0.01, 10, mat(0x3a5a8a, { emissive: 0x112244 }), 0.02, -0.01, 0.315, cam); glass.rotation.x = PI / 2;
      box(0.06, 0.04, 0.02, mat(0xd03030), 0.08, 0.05, 0.075, cam);
    }
    const shade = (hex, k) => ((((hex >> 16) & 255) * k) << 16) | ((((hex >> 8) & 255) * k) << 8) | ((hex & 255) * k);
    if (c.kind === 'hoodie') {
      const dk = shade(c.top, 0.82);
      box(0.46, 0.2, 0.16, dk, 0, 0.62, -0.17, t);
      box(0.36, 0.15, 0.02, dk, 0, 0.12, 0.156, t);
      box(0.025, 0.16, 0.02, 0xf2f2f2, 0.06, 0.5, 0.16, t); box(0.025, 0.16, 0.02, 0xf2f2f2, -0.06, 0.5, 0.16, t);
      box(0.56, 0.06, 0.31, dk, 0, 0.03, 0, t);
      for (const a of this.arms) box(0.18, 0.07, 0.2, dk, 0, -0.5, 0, a.g);
    }
    if (c.kind === 'coat') {
      box(0.16, 0.5, 0.012, 0x9cc8ea, 0, 0.37, 0.152, t);
      box(0.05, 0.36, 0.016, 0x2c4f7a, 0, 0.36, 0.16, t);
      const l1 = box(0.07, 0.32, 0.02, 0xf7f7f7, 0.1, 0.47, 0.165, t); l1.rotation.z = 0.3;
      const l2 = box(0.07, 0.32, 0.02, 0xf7f7f7, -0.1, 0.47, 0.165, t); l2.rotation.z = -0.3;
      for (const sx of [1, -1]) {
        box(0.26, 0.62, 0.04, 0xf7f7f7, 0.14 * sx, -0.3, 0.17, this.hips);
        box(0.04, 0.62, 0.34, 0xf7f7f7, 0.29 * sx, -0.3, 0, this.hips);
      }
      box(0.58, 0.62, 0.04, 0xf7f7f7, 0, -0.3, -0.17, this.hips);
      box(0.12, 0.1, 0.02, 0xe6e6e6, -0.15, 0.4, 0.162, t);
      box(0.02, 0.1, 0.02, 0x2a5ad0, -0.17, 0.47, 0.168, t); box(0.02, 0.1, 0.02, 0xd03030, -0.13, 0.47, 0.168, t);
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 4, 12, PI), mat(0x333840)); st.rotation.z = PI; st.position.set(0, 0.6, 0.16); t.add(st);
      box(0.05, 0.05, 0.03, 0xa0a8b0, 0.0, 0.42, 0.17, t);
    }
    if (c.kind === 'scrubs') {
      const v = box(0.13, 0.13, 0.012, c.skin, 0, 0.6, 0.152, t); v.rotation.z = PI / 4;
      box(0.14, 0.12, 0.02, shade(c.top, 0.9), 0.14, 0.4, 0.156, t);
    }
    if (c.kind === 'tee') {
      const bp = this.backpack = new THREE.Group(); t.add(bp);
      box(0.42, 0.5, 0.2, 0xe07a2a, 0, 0.32, -0.26, bp); box(0.3, 0.2, 0.06, 0xc8641c, 0, 0.2, -0.38, bp);
      box(0.05, 0.55, 0.015, 0xc8641c, 0.15, 0.33, 0.153, t); box(0.05, 0.55, 0.015, 0xc8641c, -0.15, 0.33, 0.153, t);
    }
    if (c.collar) {
      for (const sx of [1, -1]) { const k = box(0.2, 0.05, 0.16, c.collar, 0.09 * sx, 0.62, 0.11, t); k.rotation.z = -0.55 * sx; k.rotation.y = 0.3 * sx; }
    }
    if (c.tie) box(0.08, 0.46, 0.016, c.tie, 0, 0.36, 0.156, t);
    if (c.flare) for (const l of this.legs) box(0.31, 0.16, 0.34, c.bottom, 0, -0.33, 0.02, l.knee);
    if (c.mustache) box(0.2, 0.045, 0.03, c.hair, 0, -0.09, 0.016, this.face);
    if (c.beard) {
      box(0.47, 0.17, 0.05, c.hair, 0, -0.205, -0.005, this.face);
      box(0.06, 0.26, 0.3, c.hair, 0.235, -0.12, -0.13, this.face); box(0.06, 0.26, 0.3, c.hair, -0.235, -0.12, -0.13, this.face);
    }
    if (c.glasses) {
      const g = this.glasses = new THREE.Group(); this.face.add(g);
      const fm = mat(0x1a1a1a);
      for (const sx of [1, -1]) {
        box(0.15, 0.022, 0.02, fm, 0.1 * sx, 0.115, 0.035, g); box(0.15, 0.022, 0.02, fm, 0.1 * sx, 0.0, 0.035, g);
        box(0.022, 0.13, 0.02, fm, 0.175 * sx, 0.057, 0.035, g); box(0.022, 0.13, 0.02, fm, 0.025 * sx, 0.057, 0.035, g);
        box(0.02, 0.02, 0.2, fm, 0.235 * sx, 0.1, -0.07, g);
        box(0.12, 0.1, 0.005, mat(0xddeeff, { opacity: 0.25 }), 0.1 * sx, 0.057, 0.04, g, false);
      }
      box(0.06, 0.02, 0.02, fm, 0, 0.08, 0.035, g);
      if (c.glasses === 'big') g.scale.set(1.18, 1.4, 1);
    }
  }
  // face: {eyes, brows, mouth, look:[x,y], blush, sweat}
  setFace(f) {
    f = Object.assign({ eyes: 'normal', brows: 'normal', mouth: 'flat', look: [0, 0], blush: false }, f);
    const key = JSON.stringify(f);
    if (key === this.faceKey) return;
    this.faceKey = key;
    const F = this.features;
    while (F.children.length) F.remove(F.children[0]);
    const dark = mat(C.eyeDark, { noise: 0.02 }), white = mat(0xffffff, { noise: 0.02 }), mm = mat(C.mouth, { noise: 0.03 });
    const [lx, ly] = f.look;
    for (const sx of [1, -1]) {
      const ex = 0.105 * sx, ey = 0.06;
      let ek = f.eyes === 'twitch' ? (sx === 1 ? 'wide' : (f.tw ? 'closed' : 'squint')) : f.eyes;
      if (sx === 1 && f.eyeR) ek = f.eyeR; if (sx === -1 && f.eyeL) ek = f.eyeL;
      if (ek === 'puppy') {
        box(0.13, 0.14, 0.012, white, ex, ey + 0.01, 0.006, F, false);
        box(0.1, 0.11, 0.012, dark, ex + lx, ey + 0.005 + ly, 0.012, F, false);
        box(0.035, 0.035, 0.012, white, ex + lx - 0.022, ey + 0.03 + ly, 0.018, F, false);
        box(0.02, 0.02, 0.012, white, ex + lx + 0.025, ey - 0.02 + ly, 0.018, F, false);
      } else if (ek === 'tired') {
        box(0.115, 0.05, 0.012, white, ex, ey - 0.02, 0.006, F, false);
        box(0.05, 0.04, 0.012, dark, ex + lx, ey - 0.022, 0.013, F, false);
        box(0.12, 0.022, 0.012, mat(0x5a3a2a), ex, ey + 0.008, 0.014, F, false);
        box(0.11, 0.03, 0.008, mat(0x7a5a6a, { opacity: 0.7 }), ex, ey - 0.07, 0.006, F, false);
      } else if (ek === 'dot') {
        box(0.055, 0.065, 0.012, dark, ex + lx, ey + ly, 0.006, F, false);
      } else if (ek === 'wide') {
        box(0.15, 0.15, 0.012, white, ex, ey + 0.01, 0.006, F, false);
        box(0.045, 0.05, 0.012, dark, ex + lx, ey + 0.01 + ly, 0.013, F, false);
      } else if (ek === 'happy') {
        const a = box(0.06, 0.024, 0.012, dark, ex - 0.026, ey, 0.006, F, false); a.rotation.z = 0.55;
        const b = box(0.06, 0.024, 0.012, dark, ex + 0.026, ey, 0.006, F, false); b.rotation.z = -0.55;
      } else if (ek === 'closed') {
        box(0.11, 0.024, 0.012, dark, ex, ey - 0.01, 0.006, F, false);
      } else if (ek === 'squint') {
        box(0.12, 0.035, 0.012, white, ex, ey, 0.006, F, false);
        box(0.05, 0.035, 0.012, dark, ex + lx, ey, 0.013, F, false);
      } else if (ek === 'tight') { // squeezed shut  > <
        const a = box(0.07, 0.022, 0.012, dark, ex, ey + 0.018, 0.006, F, false); a.rotation.z = -0.4 * sx;
        const b = box(0.07, 0.022, 0.012, dark, ex, ey - 0.018, 0.006, F, false); b.rotation.z = 0.4 * sx;
      } else {
        box(0.115, 0.095, 0.012, white, ex, ey, 0.006, F, false);
        box(0.05, 0.062, 0.012, dark, ex + lx, ey + ly - 0.004, 0.013, F, false);
      }
      // brows
      if (f.brows !== 'none') {
        const br = box(0.13, 0.03, 0.015, mat(this.cfg.hairStyle === 'bald' || this.cfg.hair === C.hairGrey ? 0x8d8a85 : C.eyeDark), ex, 0.15, 0.008, F, false);
        if (f.brows === 'worried') { br.rotation.z = -0.35 * sx; br.position.y = 0.16; }
        if (f.brows === 'angry') { br.rotation.z = 0.35 * sx; br.position.y = 0.14; }
        if (f.brows === 'raised') { br.position.y = 0.2; }
        if (f.brows === 'high') { br.position.y = 0.22; br.rotation.z = -0.15 * sx; }
      }
      if (f.blush) box(0.08, 0.04, 0.01, mat(0xf08a9a, { opacity: 0.8 }), 0.15 * sx, -0.07, 0.006, F, false);
    }
    if (f.cheeks) for (const sx of [1, -1]) {
      const sk = this.cfg.skin;
      box(0.12, 0.11, 0.07, ((((sk >> 16) & 255) * 0.97) << 16) | ((((sk >> 8) & 255) * 0.85) << 8) | ((sk & 255) * 0.85), 0.14 * sx, -0.11, 0.025, F, true);
    }
    const my = -0.135;
    switch (f.mouth) {
      case 'smile':
        box(0.12, 0.028, 0.012, mm, 0, my, 0.006, F, false);
        box(0.03, 0.03, 0.012, mm, 0.072, my + 0.02, 0.006, F, false); box(0.03, 0.03, 0.012, mm, -0.072, my + 0.02, 0.006, F, false);
        break;
      case 'bigsmile':
        box(0.18, 0.07, 0.012, mm, 0, my, 0.006, F, false);
        box(0.16, 0.022, 0.012, white, 0, my + 0.018, 0.012, F, false);
        break;
      case 'o': box(0.07, 0.08, 0.012, mm, 0, my, 0.006, F, false); break;
      case 'open': box(0.12, 0.07, 0.012, mm, 0, my, 0.006, F, false); break;
      case 'grimace':
        box(0.2, 0.08, 0.012, mm, 0, my, 0.006, F, false);
        box(0.18, 0.055, 0.012, white, 0, my, 0.01, F, false);
        for (const x of [-0.05, 0, 0.05]) box(0.008, 0.055, 0.012, mat(0x999999), x, my, 0.014, F, false);
        break;
      case 'wavy':
        for (let i = 0; i < 4; i++) box(0.042, 0.024, 0.012, mm, -0.063 + i * 0.042, my + (i % 2 ? 0.012 : -0.012), 0.006, F, false);
        break;
      case 'frown':
        box(0.12, 0.028, 0.012, mm, 0, my, 0.006, F, false);
        box(0.03, 0.03, 0.012, mm, 0.072, my - 0.02, 0.006, F, false); box(0.03, 0.03, 0.012, mm, -0.072, my - 0.02, 0.006, F, false);
        break;
      case 'creepy':
        box(0.34, 0.12, 0.012, mm, 0, my + 0.005, 0.006, F, false);
        box(0.31, 0.075, 0.012, white, 0, my + 0.01, 0.01, F, false);
        for (let i = -3; i <= 3; i++) box(0.007, 0.075, 0.012, mat(0xb8b8b8), i * 0.042, my + 0.01, 0.014, F, false);
        box(0.05, 0.05, 0.012, mm, 0.17, my + 0.05, 0.006, F, false); box(0.05, 0.05, 0.012, mm, -0.17, my + 0.05, 0.006, F, false);
        break;
      case 'yell':
        box(0.2, 0.13, 0.012, mm, 0, my - 0.01, 0.006, F, false);
        box(0.17, 0.03, 0.012, white, 0, my + 0.04, 0.01, F, false);
        box(0.09, 0.04, 0.012, mat(0xd86a7a), 0, my - 0.05, 0.01, F, false);
        break;
      case 'tight': box(0.08, 0.022, 0.012, mm, 0, my, 0.006, F, false); break;
      case 'whisper': box(0.05, 0.04, 0.012, mm, 0.01, my, 0.006, F, false); break;
      case 'none': break;
      default: box(0.14, 0.028, 0.012, mm, 0, my, 0.006, F, false);
    }
  }
  pointArm(arm, dir) { // dir in torso space, arm hangs along -Y by default
    const v = new THREE.Vector3(...dir).normalize();
    arm.g.quaternion.setFromUnitVectors(UP, v);
  }
  reset() {
    this.hips.position.set(0, 0.9, 0);
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.head.position.set(0, 0.71, 0);
    for (const l of this.legs) { l.thigh.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
    for (const a of this.arms) { a.g.rotation.set(0, 0, 0.06 * a.sx); }
    this.noseG.scale.set(1, 1, 1); this.noseG.rotation.set(0, 0, 0); this.noseG.position.set(0, -0.03, 0);
    if (this.glasses) { this.glasses.position.set(0, 0, 0); this.glasses.rotation.set(0, 0, 0); }
  }
  sit(seatY = 0.47) {
    this.hips.position.y = seatY;
    for (const l of this.legs) { l.thigh.rotation.x = -PI / 2; l.knee.rotation.x = PI / 2; }
  }
  crouch(amount = 1) {
    const a = amount;
    this.hips.position.y = 0.9 - 0.42 * a;
    for (const [i, l] of this.legs.entries()) {
      l.thigh.rotation.x = -1.35 * a + (i ? 0.25 : -0.1) * a;
      l.knee.rotation.x = 1.9 * a - (i ? 0.3 : 0) * a;
    }
    this.torso.rotation.x = 0.35 * a;
  }
}

// merged static guest crowd -------------------------------------------------
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.08, 8, 5) });
export function bakePerson(p, matrix) {
  p.group.updateMatrixWorld(true);
  const geos = [];
  p.group.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    let vis = true; let q = o.parent;
    while (q) { if (!q.visible) vis = false; q = q.parent; }
    if (!vis || (o.material.transparent && o.material.opacity < 0.5)) return;
    const g = o.geometry.clone().toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, o.matrixWorld));
    const col = o.material.userData.hex != null ? new THREE.Color(o.material.userData.hex) : o.material.color.clone();
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    geos.push(g);
  });
  return geos;
}

// ---------- the garden wedding ----------
export function buildGarden(scene) {
  const W = {};
  // sky
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sctx = sky.getContext('2d'); const grd = sctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#5aa6e8'); grd.addColorStop(0.6, '#a9d6f5'); grd.addColorStop(1, '#e8f4fb');
  sctx.fillStyle = grd; sctx.fillRect(0, 0, 4, 256);
  W.skyTex = new THREE.CanvasTexture(sky); W.skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = W.skyTex;
  scene.fog = new THREE.Fog(0xcfe8f6, 28, 75);

  const g = W.group = new THREE.Group(); scene.add(g);
  // ground
  const gt = noiseTex(C.grass, 0.12, 16, 9).clone(); gt.needsUpdate = true; gt.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = true; g.add(ground);
  // aisle runner
  const runT = noiseTex(0xf3efe6, 0.04, 8, 4).clone(); runT.needsUpdate = true; runT.repeat.set(1, 16);
  const runner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 22), new THREE.MeshLambertMaterial({ map: runT }));
  runner.position.set(0, 0.01, 12.2); runner.receiveShadow = true; g.add(runner);
  // petals on the aisle
  const rnd = RNG(11);
  const petalGeo = new THREE.BoxGeometry(0.07, 0.008, 0.06);
  const petCols = [0xf4a6c0, 0xe0566e, 0xffffff, 0xf7c0d0];
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshLambertMaterial(), 500);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 500; i++) {
    const z = 0.9 + rnd() * 22, x = (rnd() - 0.5) * 1.3;
    q.setFromEuler(e.set(0, rnd() * PI, 0));
    m4.compose(new THREE.Vector3(x, 0.025, z), q, new THREE.Vector3(1, 1, 1));
    petals.setMatrixAt(i, m4); petals.setColorAt(i, new THREE.Color(petCols[i % 4]));
  }
  petals.receiveShadow = true; g.add(petals);
  // altar platform
  box(6.2, 0.15, 3.0, mat(0xeee7da, { noise: 0.05, size: 16 }), 0, 0.075, -0.75, g);
  box(1.4, 0.08, 0.6, mat(0xeee7da, { noise: 0.05 }), 0, 0.04, 0.95, g);
  // arch
  const archMats = [mat(0xf6f3ee)];
  const arch = W.arch = new THREE.Group(); arch.position.set(0, 0.15, -1.55); g.add(arch);
  for (const sx of [1, -1]) box(0.16, 2.7, 0.16, archMats[0], 1.65 * sx, 1.35, 0, arch);
  const R = 1.65, N = 14;
  for (let i = 0; i <= N; i++) {
    const a = i / N * PI;
    const b = box(0.4, 0.16, 0.16, archMats[0], Math.cos(a) * R, 2.7 + Math.sin(a) * R, 0, arch);
    b.rotation.z = a + PI / 2;
  }
  // flowers on arch (merged)
  const fgeos = [];
  const fcols = [0xf4a6c0, 0xffffff, 0xe0566e, 0xf7c59f, 0xfde2ea, 0x4e8a3a, 0x3f7a35, 0x5d9a44];
  const addCube = (x, y, z, s, col) => {
    const bg = new THREE.BoxGeometry(s, s, s).toNonIndexed();
    bg.rotateX(rnd() * PI); bg.rotateY(rnd() * PI);
    bg.translate(x, y, z);
    const c = new THREE.Color(col); const n = bg.attributes.position.count; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    bg.setAttribute('color', new THREE.BufferAttribute(arr, 3)); fgeos.push(bg);
  };
  for (let i = 0; i < 260; i++) {
    let x, y;
    const u = rnd();
    if (u < 0.55) { const a = rnd() * PI; x = Math.cos(a) * R; y = 2.7 + Math.sin(a) * R; }
    else { x = (rnd() < 0.5 ? -1 : 1) * R; y = 1.2 + rnd() * 1.5; }
    x += (rnd() - 0.5) * 0.3; y += (rnd() - 0.5) * 0.3;
    addCube(x, y + 0.15, -1.55 + (rnd() - 0.5) * 0.35, 0.1 + rnd() * 0.13, fcols[Math.floor(rnd() * fcols.length)]);
  }
  // flower stands at row ends + bushes
  for (let r = 0; r < 14; r += 3) for (const sx of [1, -1]) {
    const z = 2.7 + r * 1.05, x = 0.95 * sx;
    box(0.08, 0.9, 0.08, mat(0xf6f3ee), x, 0.45, z, g);
    for (let k = 0; k < 14; k++) addCube(x + (rnd() - 0.5) * 0.3, 1.0 + (rnd() - 0.3) * 0.28, z + (rnd() - 0.5) * 0.3, 0.09 + rnd() * 0.07, fcols[Math.floor(rnd() * 6)]);
  }
  const flowers = new THREE.Mesh(mergeGeometries(fgeos), new THREE.MeshLambertMaterial({ vertexColors: true }));
  flowers.castShadow = true; g.add(flowers);
  // chairs (merged white)
  const cg = [];
  const seats = [];
  for (let r = 0; r < 14; r++) for (let k = 0; k < 6; k++) for (const sx of [1, -1]) {
    const x = (1.3 + k * 0.78) * sx, z = 2.7 + r * 1.05;
    seats.push({ x, z, r, k, sx });
    const parts = [[0.5, 0.06, 0.48, 0, 0.45, 0], [0.5, 0.5, 0.05, 0, 0.75, 0.23], [0.05, 0.45, 0.05, 0.21, 0.22, -0.2], [0.05, 0.45, 0.05, -0.21, 0.22, -0.2], [0.05, 0.45, 0.05, 0.21, 0.22, 0.2], [0.05, 0.45, 0.05, -0.21, 0.22, 0.2]];
    for (const [w, h, d, px, py, pz] of parts) { const bg = new THREE.BoxGeometry(w, h, d); bg.translate(x + px, py, z + pz); cg.push(bg); }
  }
  const chairs = new THREE.Mesh(mergeGeometries(cg), mat(0xf7f6f2, { noise: 0.04 }));
  chairs.castShadow = true; chairs.receiveShadow = true; g.add(chairs);
  W.seats = seats;
  // trees & hedges
  const tg = [];
  const addBox = (w, h, d, x, y, z, col, ry = 0) => {
    const bg = new THREE.BoxGeometry(w, h, d).toNonIndexed(); bg.rotateY(ry); bg.translate(x, y, z);
    const c = new THREE.Color(col); const n = bg.attributes.position.count; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    bg.setAttribute('color', new THREE.BufferAttribute(arr, 3)); tg.push(bg);
  };
  const treeAt = (x, z, s) => {
    addBox(0.4 * s, 2.4 * s, 0.4 * s, x, 1.2 * s, z, 0x6b4a2e);
    const lc = [0x3f8a3a, 0x4c9a43, 0x357a33];
    addBox(2.2 * s, 1.4 * s, 2.2 * s, x, 2.9 * s, z, lc[0], rnd());
    addBox(1.6 * s, 1.1 * s, 1.6 * s, x + 0.2 * s, 3.9 * s, z - 0.1 * s, lc[1], rnd());
    addBox(1.0 * s, 0.8 * s, 1.0 * s, x - 0.1 * s, 4.7 * s, z + 0.1 * s, lc[2], rnd());
  };
  for (let i = 0; i < 26; i++) { const a = rnd(); treeAt((rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 10), -8 + rnd() * 34, 0.9 + rnd() * 0.7); }
  for (let i = 0; i < 12; i++) treeAt(-14 + i * 2.6 + rnd(), -7 - rnd() * 5, 1 + rnd() * 0.6);
  for (let z = -3; z < 20; z += 1.6) for (const sx of [1, -1]) addBox(1.5, 0.9, 1.5, 6.6 * sx, 0.45, z, 0x3f8a3a);
  for (let x = -6; x <= 6; x += 1.6) addBox(1.5, 1.2, 1.2, x, 0.6, -4.2, 0x3f8a3a);
  const trees = new THREE.Mesh(mergeGeometries(tg), new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.12, 8, 21) }));
  trees.castShadow = true; trees.receiveShadow = true; g.add(trees);
  // distant hills
  const hm = new THREE.MeshLambertMaterial({ color: 0x8fbf6a });
  for (let i = 0; i < 6; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rnd() * 10, 7, 4, 0, PI * 2, 0, PI / 2), hm);
    hill.position.set(-50 + i * 20, -6, -45 - rnd() * 10); hill.scale.y = 0.5; g.add(hill);
  }
  // clouds
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x555555 });
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) box(3 + rnd() * 3, 1 + rnd(), 2 + rnd() * 2, cm, k * 2 - 3, rnd() * 0.6, rnd(), cl, false);
    cl.position.set(-40 + i * 9 + rnd() * 4, 16 + rnd() * 8, -30 - rnd() * 20);
    g.add(cl);
  }
  return W;
}

// guests: two merged variants (normal / pinching nose)
export function buildGuests(scene, seats) {
  const rnd = RNG(42);
  const skins = [C.skinA, C.skinB, C.skinC, C.skinD, 0xa0663e];
  const tops = [0x3a5ea8, 0x9c3b4f, 0x4c8a6a, 0x6b4f9e, 0xd98c3a, 0x2f2f3a, 0x8a8f99, 0xc9568a, 0x3d7fb5, 0xe0c25a];
  const hairs = [C.hairBlack, C.hairBrown, C.hairBlond, C.hairGrey, 0x8a3b1e];
  const variants = { normal: [], nose: [] };
  const people = [];
  for (const s of seats) {
    const female = rnd() < 0.5;
    const cfg = {
      kind: female ? 'woman' : 'man', skin: skins[Math.floor(rnd() * skins.length)], top: tops[Math.floor(rnd() * tops.length)],
      bottom: female ? tops[Math.floor(rnd() * tops.length)] : [0x2a2a35, 0x3b3f4a, 0x4a3a2a][Math.floor(rnd() * 3)],
      hair: hairs[Math.floor(rnd() * hairs.length)], hairStyle: female ? 'long' : 'short',
    };
    people.push({ s, cfg, look: (rnd() - 0.5) * 0.02, tilt: (rnd() - 0.5) * 0.15 });
  }
  for (const v of ['normal', 'nose']) {
    const geos = [];
    for (const { s, cfg, look, tilt } of people) {
      const p = new Person(cfg);
      p.sit(0.47);
      if (cfg.kind === 'woman' && p.skirt) { p.skirt.scale.set(0.8, 0.6, 1.2); p.skirt.position.set(0, -0.08, 0.18); }
      p.setFace({ eyes: v === 'nose' ? 'squint' : 'normal', mouth: v === 'nose' ? 'wavy' : (rnd() < 0.5 ? 'smile' : 'flat'), look: [look, 0], brows: v === 'nose' ? 'worried' : 'normal' });
      p.head.rotation.y = tilt;
      if (v === 'nose') {
        p.pointArm(p.armR, [0.38, 0.36, 0.42]);
        p.head.rotation.x = -0.05;
      } else {
        p.pointArm(p.armR, [-0.05, -0.8, 0.45]); p.pointArm(p.armL, [0.05, -0.8, 0.45]);
      }
      const m = new THREE.Matrix4().compose(new THREE.Vector3(s.x, 0, s.z - 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI, 0)), new THREE.Vector3(1, 1, 1));
      geos.push(...bakePerson(p, m));
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), vcMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); variants[v] = mesh;
  }
  return variants;
}

// ---------- effects ----------
export class StinkLines {
  constructor(parent, n = 4, o = {}) {
    this.o = Object.assign({ spread: 0.35, height: 1.2, radius: 0.028, color: C.stink, amp: 0.09, speed: 1 }, o);
    this.group = new THREE.Group(); parent.add(this.group);
    this.mat = new THREE.MeshBasicMaterial({ color: this.o.color, transparent: true, opacity: 0.95 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: this.o.color, transparent: true, opacity: 0.18, depthWrite: false });
    this.lines = [];
    const rnd = RNG(n * 13 + 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + rnd();
      this.lines.push({ x: Math.cos(a) * this.o.spread * (0.4 + rnd() * 0.6), z: Math.sin(a) * this.o.spread * (0.4 + rnd() * 0.6), ph: rnd() * 6, h: this.o.height * (0.7 + rnd() * 0.5), mesh: null, glow: null });
    }
    this.update(0);
  }
  update(t) {
    const o = this.o;
    for (const L of this.lines) {
      const pts = [];
      const rise = ((t * 0.35 * o.speed + L.ph * 0.1) % 1) * 0.25;
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        pts.push(new THREE.Vector3(L.x + Math.sin(u * 9 + t * 4 * o.speed + L.ph) * o.amp * (0.4 + u), u * L.h + rise, L.z + Math.cos(u * 7 + t * 3 * o.speed + L.ph) * o.amp * 0.4));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 28, o.radius, 5, false);
      const ggeo = new THREE.TubeGeometry(curve, 16, o.radius * 3.2, 6, false);
      if (L.mesh) { L.mesh.geometry.dispose(); L.mesh.geometry = geo; L.glow.geometry.dispose(); L.glow.geometry = ggeo; }
      else { L.mesh = new THREE.Mesh(geo, this.mat); L.glow = new THREE.Mesh(ggeo, this.glowMat); this.group.add(L.mesh, L.glow); }
    }
  }
  set visible(v) { this.group.visible = v; }
}

export class Particles { // falling petals / confetti
  constructor(parent, n, cols, o = {}) {
    this.o = Object.assign({ size: [0.07, 0.05], area: [3, 3, 3], center: [0, 2, 0], fall: 0.6, spin: 3, seed: 3 }, o);
    const geo = new THREE.PlaneGeometry(this.o.size[0], this.o.size[1]);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), n);
    const rnd = RNG(this.o.seed);
    this.p = [];
    for (let i = 0; i < n; i++) {
      this.p.push({ x: (rnd() - 0.5) * this.o.area[0], y: rnd() * this.o.area[1], z: (rnd() - 0.5) * this.o.area[2], rx: rnd() * 6, ry: rnd() * 6, sp: 0.6 + rnd() * 0.8, ph: rnd() * 6 });
      this.mesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.update(0);
  }
  update(t, speed = 1) {
    const o = this.o, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
    this.p.forEach((p, i) => {
      let y = p.y - t * o.fall * p.sp * speed;
      y = ((y % o.area[1]) + o.area[1]) % o.area[1];
      const pos = new THREE.Vector3(o.center[0] + p.x + Math.sin(t * speed * 1.3 + p.ph) * 0.15, o.center[1] - o.area[1] / 2 + y, o.center[2] + p.z + Math.cos(t * speed + p.ph) * 0.1);
      q.setFromEuler(e.set(p.rx + t * o.spin * speed * p.sp, p.ry + t * o.spin * 0.7 * speed, 0));
      m4.compose(pos, q, s); this.mesh.setMatrixAt(i, m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function makeTearStream(person, side) {
  // a blue blocky stream under one eye; returns {group, set(len)}
  const g = new THREE.Group(); person.face.add(g);
  const m = mat(C.tear, { emissive: 0x2a5a80, noise: 0.03 });
  const seg = box(0.045, 1, 0.02, m, 0, 0, 0.012, g, false);
  const drop = box(0.06, 0.07, 0.04, m, 0, 0, 0.03, g, false);
  g.position.set(0.105 * side, 0.01, 0);
  return {
    group: g,
    set(len, dropY = null) {
      g.visible = len > 0.001;
      seg.scale.y = Math.max(0.001, len); seg.position.y = -len / 2;
      drop.position.y = dropY ?? -len - 0.03;
    },
  };
}

export function makeSweat(parent) {
  const g = new THREE.Group(); parent.add(g);
  const m = mat(0xbfe6ff, { emissive: 0x3a6a8a, noise: 0.02 });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), m); g.add(s);
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), m); c.position.y = 0.04; g.add(c);
  return g;
}

export function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.18);
  s.bezierCurveTo(-0.45, 0.45, -0.1, 0.5, 0, 0.25);
  s.bezierCurveTo(0.1, 0.5, 0.45, 0.45, 0.5, 0.18);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  return s;
}
export function makeHeart(col = 0xe0304a, glow = true) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1, curveSegments: 5 });
  geo.translate(0, 0, -0.09);
  const m = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, flatShading: true });
  g.add(new THREE.Mesh(geo, m));
  // shine
  const sh = box(0.1, 0.06, 0.02, mat(0xffffff, { basic: true }), -0.22, 0.2, 0.15, g, false); sh.rotation.z = 0.6;
  if (glow) {
    const gm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false });
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), gm); g.add(gl); g.userData.glow = gl;
  }
  return g;
}

export function makeHand(skin, o = {}) {
  // big blocky hand (left hand, palm facing camera +z, fingers up)
  const g = new THREE.Group();
  const m = mat(skin, { noise: 0.06 });
  box(0.5, 0.52, 0.16, m, 0, 0, 0, g);
  const fingers = [];
  const xs = [-0.18, -0.06, 0.06, 0.18], ls = [0.36, 0.44, 0.4, 0.3];
  xs.forEach((x, i) => { const f = box(0.105, ls[i], 0.13, m, x, 0.26 + ls[i] / 2, 0, g); fingers.push(f); });
  const th = box(0.12, 0.3, 0.13, m, 0.3, 0.02, 0.02, g); th.rotation.z = -0.6;
  box(0.36, 0.3, 0.17, m, 0, -0.4, 0, g); // wrist
  g.userData.fingers = fingers;
  return g;
}
