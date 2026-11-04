// In-world icons: pixel sprites (hearts, sweat drops, sparkles, stink lines)
// and the low-poly green smell cloud. Everything is pooled and re-placed
// from scratch every frame, so any frame can be rendered independently.
import * as THREE from 'three';
import { ICON, rng } from './pixel.js';

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
        let f = cache.get(key); if (!f) { f = 0.8 + R() * 0.35; cache.set(key, f); }
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.85, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      return g;
    });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  }

  begin() {
    for (const k in this.pools) this.pools[k].forEach(o => { o.visible = false; });
    this.used = {};
  }

  _get(kind, make) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    const i = this.used[kind] || 0;
    this.used[kind] = i + 1;
    if (!pool[i]) { pool[i] = make(); this.scene.add(pool[i]); }
    const o = pool[i];
    o.visible = true;
    return o;
  }

  _sprite(kind, tex) {
    const s = this._get(kind, () => {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
      const sp = new THREE.Sprite(m);
      sp.renderOrder = 10;
      return sp;
    });
    return s;
  }

  icon(kind, pos, size, { opacity = 1, rot = 0, aspect = null } = {}) {
    const tex = ICON[kind];
    const s = this._sprite(kind, tex);
    const img = tex.image;
    const a = aspect || img.width / img.height;
    s.scale.set(size * a, size, 1);
    s.position.copy(pos);
    s.material.opacity = opacity;
    s.material.rotation = rot;
    return s;
  }
  heart(pos, size, o = {}) { return this.icon('heart', pos, size, o); }
  drop(pos, size, o = {}) { return this.icon('drop', pos, size, o); }
  sparkle(pos, size, o = {}) { return this.icon('sparkle', pos, size, o); }

  stink(pos, size, phase, opacity = 1) {
    const f = ((Math.floor(phase * 8) % 8) + 8) % 8;
    const s = this._get('stink', () => {
      const m = new THREE.SpriteMaterial({ map: ICON.stink[0], transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(m); sp.renderOrder = 11; return sp;
    });
    s.material.map = ICON.stink[f];
    s.material.opacity = opacity;
    s.scale.set(size * 9 / 26, size, 1);
    s.position.copy(pos);
    return s;
  }

  // hide smell puffs that would sit right on the camera lens
  cullNear(camPos) {
    for (const m of this.pools.puff || []) {
      if (!m.visible) continue;
      const d = m.position.distanceTo(camPos);
      const r = m.scale.x * 1.4;
      if (d < r) m.visible = false;
      else if (d < r * 2.2) m.material.opacity *= (d - r) / (r * 1.2);
    }
  }

  // a rising bundle of green stink lines around a point
  stinkLines(center, t, { n = 3, spread = 0.35, height = 0.9, size = 0.45, opacity = 1, seed = 1 } = {}) {
    const R = rng(seed);
    for (let k = 0; k < n; k++) {
      const off = R() * 10, sp = (R() - 0.5) * 2 * spread, period = 1.1 + R() * 0.5;
      const ph = ((t + off) / period) % 1;
      const p = new THREE.Vector3(center.x + sp, center.y + ph * height, center.z + (R() - 0.5) * spread);
      const a = Math.sin(Math.PI * ph);
      this.stink(p, size * (0.8 + 0.4 * R()), t * 1.6 + off, opacity * Math.min(1, a * 1.6));
    }
  }

  puff(pos, size, opacity = 0.6, seed = 0) {
    const m = this._get('puff', () => {
      const mm = new THREE.MeshStandardMaterial({ color: 0x8ccf3f, emissive: 0x2f5a10, emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 });
      const me = new THREE.Mesh(this.puffGeo[0], mm);
      me.renderOrder = 5;
      return me;
    });
    m.geometry = this.puffGeo[seed % 3];
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.rotation.set(seed * 0.7, seed * 1.3, seed * 0.4);
    m.material.opacity = opacity;
    return m;
  }

  // cloud of puffs: centre, radius, count, time (for drifting)
  cloud(center, radius, t, { n = 20, size = 0.35, opacity = 0.55, seed = 3, rise = 0.6, swirl = 0, flat = 1 } = {}) {
    const R = rng(seed);
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2 + swirl * (0.6 + R());
      const rr = Math.sqrt(R()) * radius;
      const y = (R() - 0.3) * rise;
      const wob = 0.08 * Math.sin(t * (0.8 + R()) + k);
      const p = new THREE.Vector3(center.x + Math.cos(a) * rr + wob, center.y + y * flat + wob, center.z + Math.sin(a) * rr);
      const s = size * (0.6 + 0.8 * R()) * (1 + 0.06 * Math.sin(t * 2 + k));
      this.puff(p, s, opacity * (0.7 + 0.3 * R()), k);
    }
  }

  // light beam (a translucent box) from a point toward another
  beam(from, to, width = 0.6, opacity = 0.18) {
    const b = this._get('beam', () => {
      const g = new THREE.CylinderGeometry(0.5, 1, 1, 6, 1, true);
      g.translate(0, -0.5, 0);
      const me = new THREE.Mesh(g, this.beamMat.clone());
      me.renderOrder = 12;
      return me;
    });
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    b.position.copy(from);
    b.scale.set(width, len, width);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    b.material.opacity = opacity;
    return b;
  }

  // tear drops flying out of the eyes in arcs (dramatic crying)
  tearSpray(person, t, { rate = 1, size = 0.06, spread = 1, seed = 9 } = {}) {
    person.root.updateMatrixWorld(true);
    const R = rng(seed);
    for (const e of person.eyes) {
      const origin = e.g.getWorldPosition(new THREE.Vector3());
      const right = new THREE.Vector3(e.side, 0, 0).transformDirection(person.head.matrixWorld);
      for (let k = 0; k < 7; k++) {
        const off = R(), period = 0.55 + R() * 0.25;
        const ph = ((t * rate + off * period) / period) % 1;
        const v = 0.9 + R() * 0.5;
        const p = origin.clone()
          .addScaledVector(right, ph * v * 0.55 * spread)
          .add(new THREE.Vector3(0, ph * 0.35 - ph * ph * 1.2, 0));
        this.drop(p, size * (0.8 + R() * 0.5), { opacity: ph < 0.85 ? 1 : (1 - ph) / 0.15 });
      }
    }
  }
}
