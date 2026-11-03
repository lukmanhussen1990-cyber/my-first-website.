// In-world effects, pooled and re-placed every frame (frames are stateless).
// Everything here lives on LAYER_FX so it never hides the censor proxy.
import * as THREE from 'three';
import { ICONS } from './gfx.js';
import { rng, LAYER_FX } from './chars.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.pools = {};
    this.used = {};
    this.puffGeo = [0, 1, 2].map(k => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position, R = rng(50 + k), cache = new Map();
      for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        let f = cache.get(key); if (!f) { f = 0.82 + R() * 0.3; cache.set(key, f); }
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      return g;
    });
  }
  begin() {
    for (const k in this.pools) this.pools[k].forEach(o => { o.visible = false; });
    this.used = {};
  }
  _get(kind, make) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    const i = this.used[kind] || 0;
    this.used[kind] = i + 1;
    if (!pool[i]) {
      const o = make();
      o.traverse(x => x.layers.set(LAYER_FX));
      pool[i] = o;
      this.scene.add(o);
    }
    pool[i].visible = true;
    return pool[i];
  }
  icon(kind, pos, size, { opacity = 1, rot = 0 } = {}) {
    const tex = ICONS.tex[kind];
    const s = this._get('ic_' + kind, () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.renderOrder = 10;
      return sp;
    });
    const a = tex.image.width / tex.image.height;
    s.scale.set(size * a, size, 1);
    s.position.copy(pos);
    s.material.opacity = opacity;
    s.material.rotation = rot;
    return s;
  }
  heart(p, s, o) { return this.icon('heart', p, s, o); }
  drop(p, s, o) { return this.icon('drop', p, s, o); }
  sparkle(p, s, o) { return this.icon('sparkle', p, s, o); }
  z(p, s, o) { return this.icon('z', p, s, o); }
  coffee(p, s, o) { return this.icon('coffee', p, s, o); }

  stink(pos, size, phase, opacity = 1) {
    const f = ((Math.floor(phase * 8) % 8) + 8) % 8;
    const s = this._get('stink', () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.tex.stink[0], transparent: true, depthWrite: false }));
      sp.renderOrder = 11; return sp;
    });
    s.material.map = ICONS.tex.stink[f];
    s.material.opacity = opacity;
    s.scale.set(size / 3, size, 1);
    s.position.copy(pos);
    return s;
  }
  stinkLines(center, t, { n = 3, spread = 0.35, height = 0.9, size = 0.45, opacity = 1, seed = 1 } = {}) {
    const R = rng(seed);
    for (let k = 0; k < n; k++) {
      const off = R() * 10, sp = (R() - 0.5) * 2 * spread, period = 1.1 + R() * 0.5;
      const ph = ((t + off) / period) % 1;
      const p = new THREE.Vector3(center.x + sp, center.y + ph * height, center.z + (R() - 0.5) * spread);
      this.stink(p, size * (0.8 + 0.4 * R()), t * 1.6 + off, opacity * Math.min(1, Math.sin(Math.PI * ph) * 1.6));
    }
  }
  puff(pos, size, opacity = 0.6, seed = 0, color = 0x9ad94e) {
    const m = this._get('puff', () => {
      const mm = new THREE.MeshStandardMaterial({ color, emissive: 0x2f5a10, emissiveIntensity: 0.35, flatShading: true, transparent: true, opacity, depthWrite: false, roughness: 1 });
      const me = new THREE.Mesh(this.puffGeo[0], mm);
      me.renderOrder = 5;
      return me;
    });
    m.geometry = this.puffGeo[seed % 3];
    m.material.color.setHex(color);
    m.material.emissive.setHex(color === 0x9ad94e ? 0x2f5a10 : 0x333333);
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.rotation.set(seed * 0.7, seed * 1.3, seed * 0.4);
    m.material.opacity = opacity;
    return m;
  }
  cloud(center, radius, t, { n = 20, size = 0.35, opacity = 0.55, seed = 3, rise = 0.6, color = 0x9ad94e, flat = 1 } = {}) {
    const R = rng(seed);
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2;
      const rr = Math.sqrt(R()) * radius;
      const y = (R() - 0.3) * rise;
      const wob = 0.06 * Math.sin(t * (0.8 + R()) + k) * radius;
      const p = new THREE.Vector3(center.x + Math.cos(a) * rr + wob, center.y + y * flat + wob * 0.5, center.z + Math.sin(a) * rr * flat);
      const s = size * (0.6 + 0.8 * R()) * (1 + 0.06 * Math.sin(t * 2 + k));
      this.puff(p, s, opacity * (0.7 + 0.3 * R()), k, color);
    }
  }
  cullNear(camPos) {
    for (const m of this.pools.puff || []) {
      if (!m.visible) continue;
      const d = m.position.distanceTo(camPos), r = m.scale.x * 1.4;
      if (d < r) m.visible = false;
      else if (d < r * 2.2) m.material.opacity *= (d - r) / (r * 1.2);
    }
  }
  // generic small box particle (coffee drops, paper bits, bubble bits)
  bit(pos, size, color, rot = 0) {
    const m = this._get('bit', () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.6 })));
    m.material.color.setHex(color);
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.rotation.set(rot, rot * 1.3, rot * 0.7);
    return m;
  }
  // a textured card (calendar page, ticket, sign)
  card(tex, pos, w, h, rot = [0, 0, 0]) {
    const m = this._get('card', () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true })));
    m.material.map = tex;
    m.material.needsUpdate = true;
    m.position.copy(pos);
    m.scale.set(w, h, 1);
    m.rotation.set(rot[0], rot[1], rot[2]);
    return m;
  }
}
