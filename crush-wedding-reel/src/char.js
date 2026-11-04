// Blocky low-poly characters: faceted chamfered heads with pixel-art faces,
// rounded box limbs, chunky hair, simple rig (hip / legs / torso / arms / neck).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './tex.js';
import { rng } from './util.js';

// planar per-side UVs (RoundedBoxGeometry's own UVs collapse the flat centre region)
export function fixUV(geo, w, h, d) {
  const pos = geo.attributes.position.array, uv = geo.attributes.uv.array;
  const faceTris = pos.length / 6;
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const x = pos[i] / w + 0.5, y = pos[i + 1] / h + 0.5, z = pos[i + 2] / d + 0.5;
    const side = Math.floor(i / faceTris);
    let u, v;
    switch (side) {
      case 0: u = 1 - z; v = y; break;
      case 1: u = z; v = y; break;
      case 2: u = x; v = 1 - z; break;
      case 3: u = x; v = z; break;
      case 4: u = x; v = y; break;
      default: u = 1 - x; v = y;
    }
    uv[j] = u; uv[j + 1] = v;
  }
  geo.attributes.uv.needsUpdate = true;
  return geo;
}
const GEO = new Map();
export function rbox(w, h, d, seg = 2, r = 0.1) {
  const k = [w, h, d, seg, r].join(',');
  if (!GEO.has(k)) GEO.set(k, fixUV(new RoundedBoxGeometry(w, h, d, seg, r), w, h, d));
  return GEO.get(k);
}
const ico = new Map();
export function icoGeo(r, detail = 0) {
  const k = r + ':' + detail;
  if (!ico.has(k)) ico.set(k, new THREE.IcosahedronGeometry(r, detail));
  return ico.get(k);
}

export function stdMat(o) {
  return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.62, metalness: 0.0 }, o));
}

function shadowAll(obj) {
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}

export class Character {
  constructor(spec) {
    this.spec = spec;
    const s = spec;
    this.root = new THREE.Group();
    this.root.name = s.name || 'char';
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hip = new THREE.Group(); this.hip.position.y = 2; this.body.add(this.hip);
    const skin = s.skin || '#f2c9a0';
    const skinMat = stdMat({ map: T.fabric(skin, { amp: 0.025, seed: 8 }), roughness: 0.55 });
    this.skinMat = skinMat;
    const shirt = s.shirt || '#3a6fd8';
    const sleeve = s.sleeve || shirt;
    const pants = s.pants || '#2c3550';
    const shoe = s.shoe || '#1d1d22';
    const fabOpt = s.fabric || {};

    // legs
    const legMat = stdMat({ map: T.legTex(pants, shoe) });
    const legGeo = rbox(0.97, 2.0, 0.97, 2, 0.12);
    this.legL = new THREE.Group(); this.legL.position.set(-0.5, 0, 0); this.hip.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.5, 0, 0); this.hip.add(this.legR);
    for (const L of [this.legL, this.legR]) { const m = new THREE.Mesh(legGeo, legMat); m.position.y = -1.0; L.add(m); }

    // skirts
    this.skirt = null;
    if (s.outfit === 'gown') {
      const g = new THREE.CylinderGeometry(0.98, 2.55, 2.25, 14, 2);
      const m = stdMat({ map: T.fabric('#f4f1ea', { pattern: 'lace', c2: '#dcd8e4', amp: 0.04 }), flatShading: true, roughness: 0.6 });
      this.skirt = new THREE.Mesh(g, m); this.skirt.position.y = -1.08;
      const hem = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 4, 14), stdMat({ color: '#f3dfe6', flatShading: true }));
      hem.rotation.x = Math.PI / 2; hem.position.y = -1.08; this.skirt.add(hem);
      this.legL.visible = this.legR.visible = false;
    } else if (s.outfit === 'robe') {
      const g = new THREE.CylinderGeometry(1.14, 1.5, 2.1, 10, 1);
      const m = stdMat({ map: T.fabric('#f7f5ef', { amp: 0.04 }), flatShading: true });
      this.skirt = new THREE.Mesh(g, m); this.skirt.position.y = -1.0;
      const st = new THREE.Mesh(rbox(0.45, 2.0, 0.1, 1, 0.03), stdMat({ color: '#d9a83a' }));
      st.position.set(-0.45, 0.0, 1.22); st.rotation.x = -0.14; this.skirt.add(st);
      const st2 = st.clone(); st2.position.x = 0.45; this.skirt.add(st2);
      this.legL.visible = this.legR.visible = false;
    } else if (s.outfit === 'dress') {
      const g = new THREE.CylinderGeometry(1.08, 1.5, 1.35, 10, 1);
      const m = stdMat({ map: T.fabric(shirt, fabOpt), flatShading: true });
      this.skirt = new THREE.Mesh(g, m); this.skirt.position.y = -0.62;
    }
    if (this.skirt) this.hip.add(this.skirt);

    // torso
    this.torso = new THREE.Group(); this.hip.add(this.torso);
    const side = stdMat({ map: T.fabric(shirt, Object.assign({ wrinkle: s.wrinkled }, fabOpt)) });
    const front = stdMat({ map: T.torsoTex(s.torsoKind || 'plain', Object.assign({ base: shirt, skin }, s.torsoOpts || {})) });
    const tw = s.torsoW || 2.0;
    this.torsoMesh = new THREE.Mesh(rbox(tw, 2.0, 1.0, 2, 0.12), [side, side, side, side, front, side]);
    this.torsoMesh.position.y = 1.0; this.torso.add(this.torsoMesh);

    // arms
    const sleeveMat = stdMat({ map: T.fabric(sleeve, Object.assign({ wrinkle: s.wrinkled }, fabOpt)) });
    const sleeveGeo = rbox(0.96, 1.52, 0.96, 2, 0.12);
    const handGeo = rbox(0.8, 0.52, 0.8, 1, 0.1);
    const handMat = skinMat;
    this.armL = new THREE.Group(); this.armL.position.set(-(tw / 2 + 0.5), 1.5, 0); this.torso.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(tw / 2 + 0.5, 1.5, 0); this.torso.add(this.armR);
    this.handL = null; this.handR = null;
    for (const A of [this.armL, this.armR]) {
      const sl = new THREE.Mesh(sleeveGeo, sleeveMat); sl.position.y = -0.26; A.add(sl);
      const h = new THREE.Mesh(handGeo, handMat); h.position.y = -1.28; A.add(h);
      const hp = new THREE.Group(); hp.position.y = -1.4; A.add(hp);
      if (A === this.armL) this.handL = hp; else this.handR = hp;
    }

    // head
    this.neck = new THREE.Group(); this.neck.position.y = 2.0; this.torso.add(this.neck);
    this.head = new THREE.Group(); this.neck.add(this.head);
    const HW = 1.38, HH = 1.28, HD = 1.26;
    this.faceSpec = Object.assign({ skin, eyes: 'dot', mouth: 'smile' }, s.face || {});
    this.faceMat = stdMat({ map: T.faceTex(this.faceSpec), flatShading: true, roughness: 0.5 });
    const headSide = stdMat({ map: T.fabric(skin, { amp: 0.025, seed: 8 }), flatShading: true, roughness: 0.5 });
    this.headSideMat = headSide;
    this.headMesh = new THREE.Mesh(rbox(HW, HH, HD, 1, 0.3), [headSide, headSide, headSide, headSide, this.faceMat, headSide]);
    this.headMesh.position.y = 0.68; this.head.add(this.headMesh);
    this.buildHair(s.hair || { style: 'short', color: '#4a2e1a' });
    this.buildAccessories(s.acc || []);
    if (s.scale) this.body.scale.setScalar(s.scale);
    if (s.wide) this.body.scale.x *= s.wide;
    this.baseScale = this.body.scale.clone();
    shadowAll(this.root);
    if (this.veil) { this.veil.castShadow = false; }
    this.curFaceKey = '';
    this.resetPose();
  }

  hairMat(color, smooth) {
    return stdMat({ map: T.fabric(color, { amp: 0.1, pattern: 'stripes', c2: T.css(color, 0.82), seed: 4 }), flatShading: !smooth, roughness: smooth ? 0.28 : 0.5, metalness: smooth ? 0.05 : 0 });
  }
  addHair(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y + 0.68, z); m.rotation.set(rx, ry, rz); this.head.add(m); return m;
  }
  buildHair(h) {
    const c = h.color;
    const r = rng(h.seed || 5);
    switch (h.style) {
      case 'messy': {
        const m = this.hairMat(c);
        this.addHair(rbox(1.5, 0.5, 1.38, 1, 0.16), m, 0, 0.6, -0.02);
        this.addHair(rbox(1.48, 0.95, 0.34, 1, 0.12), m, 0, 0.2, -0.53);
        this.addHair(rbox(0.26, 0.75, 1.1, 1, 0.08), m, -0.69, 0.25, -0.05, 0, 0, 0.1);
        this.addHair(rbox(0.26, 0.75, 1.1, 1, 0.08), m, 0.69, 0.25, -0.05, 0, 0, -0.1);
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * Math.PI * 2 + r() * 0.4;
          const rad = 0.25 + r() * 0.45;
          const g = rbox(0.34 + r() * 0.16, 0.6 + r() * 0.45, 0.34 + r() * 0.12, 1, 0.07);
          this.addHair(g, m, Math.cos(a) * rad, 0.82 + r() * 0.15, Math.sin(a) * rad - 0.05, (r() - 0.5) * 1.4, r() * 3, (r() - 0.5) * 1.6);
        }
        for (let i = 0; i < 4; i++) this.addHair(rbox(0.32, 0.5, 0.22, 1, 0.06), m, -0.45 + i * 0.3, 0.45, 0.62, 0.35, 0, (r() - 0.5) * 1.2);
        break;
      }
      case 'slick': {
        const m = this.hairMat(c, true);
        this.addHair(rbox(1.46, 0.42, 1.36, 2, 0.18), m, 0, 0.62, -0.02);
        this.addHair(rbox(1.44, 0.85, 0.28, 2, 0.12), m, 0, 0.25, -0.55);
        this.addHair(rbox(0.22, 0.5, 1.1, 2, 0.08), m, -0.7, 0.4, -0.05);
        this.addHair(rbox(0.22, 0.5, 1.1, 2, 0.08), m, 0.7, 0.4, -0.05);
        this.addHair(rbox(1.0, 0.34, 0.5, 2, 0.14), m, 0.18, 0.72, 0.45, 0.1, 0, -0.18);
        break;
      }
      case 'short': {
        const m = this.hairMat(c);
        this.addHair(rbox(1.46, 0.42, 1.36, 1, 0.14), m, 0, 0.62, -0.02);
        this.addHair(rbox(1.44, 0.8, 0.28, 1, 0.1), m, 0, 0.25, -0.55);
        this.addHair(rbox(1.2, 0.3, 0.26, 1, 0.08), m, -0.05, 0.47, 0.58, 0.2, 0, 0.08);
        break;
      }
      case 'buzz': {
        const m = this.hairMat(c);
        this.addHair(rbox(1.42, 0.26, 1.32, 1, 0.12), m, 0, 0.6, -0.02);
        this.addHair(rbox(1.42, 0.5, 0.2, 1, 0.08), m, 0, 0.35, -0.56);
        break;
      }
      case 'long':
      case 'bride': {
        const m = this.hairMat(c, h.style === 'bride');
        this.addHair(rbox(1.5, 0.46, 1.4, 1, 0.16), m, 0, 0.6, -0.02);
        this.addHair(rbox(1.52, 2.1, 0.4, 1, 0.14), m, 0, -0.2, -0.56);
        this.addHair(rbox(0.32, 1.5, 0.72, 1, 0.1), m, -0.74, 0.0, 0.12);
        this.addHair(rbox(0.32, 1.5, 0.72, 1, 0.1), m, 0.74, 0.0, 0.12);
        this.addHair(rbox(0.9, 0.3, 0.3, 1, 0.08), m, -0.28, 0.5, 0.58, 0.25, 0, 0.3);
        this.addHair(rbox(0.7, 0.28, 0.28, 1, 0.08), m, 0.38, 0.52, 0.58, 0.25, 0, -0.25);
        break;
      }
      case 'bun': {
        const m = this.hairMat(c);
        this.addHair(rbox(1.46, 0.44, 1.38, 1, 0.16), m, 0, 0.6, -0.02);
        this.addHair(rbox(1.44, 0.8, 0.3, 1, 0.1), m, 0, 0.25, -0.55);
        const b = new THREE.Mesh(icoGeo(0.46, 1), m); b.position.set(0, 1.42, -0.32); this.head.add(b);
        break;
      }
      case 'bald': {
        const m = this.hairMat(c);
        this.addHair(rbox(0.16, 0.45, 1.0, 1, 0.05), m, -0.72, 0.05, -0.1);
        this.addHair(rbox(0.16, 0.45, 1.0, 1, 0.05), m, 0.72, 0.05, -0.1);
        this.addHair(rbox(1.3, 0.45, 0.16, 1, 0.05), m, 0, 0.05, -0.64);
        break;
      }
      case 'curly': {
        const m = this.hairMat(c);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const b = new THREE.Mesh(icoGeo(0.36, 0), m);
          b.position.set(Math.cos(a) * 0.62, 1.15 + (i % 3) * 0.08, Math.sin(a) * 0.55 - 0.08); this.head.add(b);
        }
        this.addHair(rbox(1.4, 0.5, 1.3, 1, 0.16), m, 0, 0.6, -0.05);
        break;
      }
      case 'none': break;
    }
    if (h.hat === 'top') {
      const m = stdMat({ color: '#1b1b1f', roughness: 0.35 });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 12), m); b.position.y = 1.46; this.head.add(b);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 1.0, 12), m); t.position.y = 1.98; this.head.add(t);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.71, 0.71, 0.18, 12), stdMat({ color: '#8b1d2c' })); band.position.y = 1.58; this.head.add(band);
    }
    if (h.hat === 'sun') {
      const m = stdMat({ color: h.hatColor || '#f4d7a0', flatShading: true, map: T.fabric(h.hatColor || '#f4d7a0', { pattern: 'plaid', c2: T.css(h.hatColor || '#f4d7a0', 0.85) }) });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.4, 0.07, 14), m); b.position.y = 1.42; b.rotation.x = 0.08; this.head.add(b);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.5, 14), m); t.position.y = 1.66; this.head.add(t);
      const fl = new THREE.Mesh(icoGeo(0.22, 0), stdMat({ color: '#ff6f9a', flatShading: true })); fl.position.set(0.7, 1.6, 0.3); this.head.add(fl);
    }
    if (h.hat === 'fascinator') {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10), stdMat({ color: h.hatColor || '#c0306a' }));
      d.position.set(0.45, 1.42, 0.05); d.rotation.z = -0.4; this.head.add(d);
      const f = new THREE.Mesh(rbox(0.1, 0.9, 0.2, 1, 0.04), stdMat({ color: '#ffffff' })); f.position.set(0.62, 1.8, -0.05); f.rotation.z = -0.5; this.head.add(f);
    }
  }
  buildAccessories(list) {
    for (const a of list) {
      if (a === 'sunglasses') {
        const g = new THREE.Group();
        const m = stdMat({ color: '#0b0b0e', roughness: 0.15, metalness: 0.6 });
        const l1 = new THREE.Mesh(rbox(0.56, 0.34, 0.08, 1, 0.04), m); l1.position.set(-0.32, 0, 0); g.add(l1);
        const l2 = l1.clone(); l2.position.x = 0.32; g.add(l2);
        const br = new THREE.Mesh(rbox(1.44, 0.08, 0.06, 1, 0.02), m); br.position.y = 0.12; g.add(br);
        const sh = new THREE.Mesh(rbox(0.12, 0.06, 0.02, 1, 0.01), stdMat({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 }));
        sh.position.set(-0.45, 0.08, 0.05); sh.rotation.z = 0.4; g.add(sh);
        g.position.set(0, 0.86, 0.66); this.head.add(g);
        const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), stdMat({ color: '#cfd6dd' }));
        ear.position.set(0.72, 0.5, 0.15); ear.rotation.x = 0.4; this.head.add(ear);
      }
      if (a === 'tiara') {
        const m = stdMat({ color: '#f5e6a8', metalness: 0.8, roughness: 0.25, emissive: '#5a4a20' });
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 4, 16, Math.PI), m);
        t.position.set(0, 1.34, 0.05); t.rotation.x = -1.2; this.head.add(t);
        for (let i = 0; i < 5; i++) { const gm = new THREE.Mesh(icoGeo(0.08, 0), stdMat({ color: '#dff6ff', emissive: '#88c8ff', emissiveIntensity: 0.8 })); const an = (i / 4) * Math.PI; gm.position.set(Math.cos(an) * 0.6, 1.42 + Math.sin(an) * 0.12, 0.05 + Math.sin(an) * 0.2); this.head.add(gm); }
      }
      if (a === 'veil') {
        const g = new THREE.CylinderGeometry(0.8, 1.9, 4.6, 14, 4, true, Math.PI * 0.55, Math.PI * 0.9);
        const m = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.42, side: THREE.DoubleSide, roughness: 0.4, depthWrite: false, flatShading: true });
        this.veil = new THREE.Mesh(g, m); this.veil.position.set(0, -1.0, -0.1); this.head.add(this.veil);
        this.veil.renderOrder = 2;
      }
      if (a === 'bouquet') {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.12, 0.9, 7), stdMat({ color: '#4e8f3a', flatShading: true })); stem.position.y = -0.35; g.add(stem);
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 7), stdMat({ color: '#ffffff' })); rib.position.y = -0.15; g.add(rib);
        const cols = ['#ff6f9a', '#ffffff', '#ff3d5e', '#ffc2d6', '#ffffff', '#ff8fb5', '#f9e07a'];
        for (let i = 0; i < 11; i++) {
          const an = i * 2.4, rr = i === 0 ? 0 : 0.42 + (i % 2) * 0.12;
          const f = new THREE.Mesh(icoGeo(0.27, 0), stdMat({ color: cols[i % cols.length], flatShading: true, roughness: 0.5 }));
          f.position.set(Math.cos(an) * rr, 0.25 + (i === 0 ? 0.18 : 0), Math.sin(an) * rr); g.add(f);
        }
        for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(rbox(0.16, 0.5, 0.06, 1, 0.02), stdMat({ color: '#3f8a35' })); const an = i * 1.05; lf.position.set(Math.cos(an) * 0.55, 0.05, Math.sin(an) * 0.55); lf.rotation.set(Math.sin(an) * 0.8, 0, -Math.cos(an) * 0.8); g.add(lf); }
        this.bouquet = g; this.handL.add(g); g.position.set(0.2, -0.1, 0.2);
      }
      if (a === 'bible') {
        const b = new THREE.Mesh(rbox(0.9, 1.15, 0.3, 1, 0.04), [stdMat({ color: '#f3ead2' }), stdMat({ color: '#f3ead2' }), stdMat({ color: '#f3ead2' }), stdMat({ color: '#f3ead2' }), stdMat({ map: T.bibleTex() }), stdMat({ map: T.bibleTex() })]);
        this.bible = b; this.handL.add(b); b.position.set(0.1, -0.15, 0.45); b.rotation.set(-0.3, 0, 0);
      }
      if (a === 'fan') {
        const m = new THREE.MeshStandardMaterial({ map: T.fanTex(), side: THREE.DoubleSide, roughness: 0.6 });
        const f = new THREE.Mesh(new THREE.CircleGeometry(1.0, 9, 0, Math.PI), m);
        this.fan = new THREE.Group(); this.fan.add(f); f.position.y = 0.0; this.handR.add(this.fan);
        this.fan.position.set(0, -0.15, 0.3);
      }
      if (a === 'boutonniere') { /* painted on torso */ }
    }
  }

  resetPose() {
    const zero = (o) => { o.rotation.set(0, 0, 0); };
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0, 'XYZ'); this.root.visible = true;
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    if (this.baseScale) this.body.scale.copy(this.baseScale);
    this.hip.position.set(0, 2, 0);
    [this.hip, this.legL, this.legR, this.torso, this.armL, this.armR, this.neck, this.head].forEach(zero);
    if (this.skirt) this.skirt.visible = true;
    this.faceOverride = null;
    this.green = 0;
  }
  sitAt(x, seatTop, z, rotY = Math.PI) {
    this.root.position.set(x, seatTop - 1.5, z);
    this.root.rotation.y = rotY;
    this.legL.rotation.x = this.legR.rotation.x = -Math.PI / 2;
    if (this.spec.outfit === 'dress') this.skirt.visible = false;
  }
  standAt(x, y, z, rotY = 0) { this.root.position.set(x, y, z); this.root.rotation.y = rotY; }
  walk(phase, amt = 1, armAmt = 0.8) {
    const s = Math.sin(phase);
    this.legL.rotation.x = s * 0.65 * amt; this.legR.rotation.x = -s * 0.65 * amt;
    this.armL.rotation.x = -s * 0.55 * armAmt; this.armR.rotation.x = s * 0.55 * armAmt;
    this.hip.position.y = 2 + Math.abs(Math.cos(phase)) * 0.12 * amt;
  }
  run(phase, amt = 1) {
    const s = Math.sin(phase);
    this.legL.rotation.x = s * 1.0 * amt; this.legR.rotation.x = -s * 1.0 * amt;
    this.hip.position.y = 2 + Math.abs(Math.cos(phase)) * 0.3 * amt;
    this.torso.rotation.x = 0.18 * amt;
  }
  armsUpPanic(t, amt = 1, seed = 0) {
    this.armL.rotation.x = -2.6 * amt + Math.sin(t * 22 + seed) * 0.35;
    this.armR.rotation.x = -2.6 * amt + Math.sin(t * 22 + seed + 1.7) * 0.35;
    this.armL.rotation.z = -0.35 * amt; this.armR.rotation.z = 0.35 * amt;
  }
  face(over) { this.faceOverride = Object.assign(this.faceOverride || {}, over); }
  applyFace(t) {
    const spec = Object.assign({}, this.faceSpec, this.faceOverride || {});
    if (this.green) spec.green = Math.round(this.green * 4) / 4;
    // natural blinking for idle eyes
    if (!this.noBlink && (spec.eyes === 'dot' || spec.eyes === 'pretty' || !spec.eyes)) {
      const per = 3.1 + (this.blinkSeed || 0) * 1.7;
      const ph = (t + (this.blinkSeed || 0) * 2.3) % per;
      if (ph < 0.11) spec.eyes = 'closed';
    }
    const key = JSON.stringify(spec);
    if (key !== this.curFaceKey) { this.faceMat.map = T.faceTex(spec); this.curFaceKey = key; }
  }
  worldHeadPos(v = new THREE.Vector3()) {
    this.headMesh.getWorldPosition(v); return v;
  }
}
