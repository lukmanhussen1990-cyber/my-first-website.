// Effects: glowing force arrows, sparks, speed lines, dust puffs, confetti, stars, centre-of-mass dot.
import * as THREE from 'three';
import { clamp, mulberry32, smooth, fract } from './util.js';
import * as TX from './textures.js';

const glowTex = { t: null };
const glow = () => (glowTex.t ||= TX.makeGlowSprite());

// ------------------------------------------------------------------ glowing arrow (billboarded around its axis)
function arrowShape(len, w, headL, headW) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(0, -r);
  s.lineTo(len - headL, -r); s.lineTo(len - headL, -headW / 2); s.lineTo(len, 0); s.lineTo(len - headL, headW / 2); s.lineTo(len - headL, r); s.lineTo(0, r);
  s.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}
export class GlowArrow {
  constructor(color, len = 1, width = 0.16) {
    this.group = new THREE.Group();
    this.len = len;
    const sh = arrowShape(1, width, 0.38, width * 2.6);
    const geo = new THREE.ShapeGeometry(sh, 12);
    this.core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4.0), transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, toneMapped: true }));
    const halo = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape(1.0, width * 2.8, 0.5, width * 5.0), 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    halo.position.z = -0.002; halo.position.x = -0.04;
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape(0.95, width * 0.4, 0.3, width * 1.2), 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    inner.position.z = 0.002; inner.position.x = 0.02;
    this.halo = halo; this.inner = inner;
    this.group.add(halo, this.core, inner);
    this.group.renderOrder = 10;
    for (const m of [halo, this.core, inner]) m.renderOrder = 10;
    this.group.visible = false;
  }
  // place: from point p along unit dir d with length L, facing camera
  set(p, d, L, cam, alpha = 1, pulse = 0) {
    this.group.visible = alpha > 0.01 && L > 0.02;
    if (!this.group.visible) return;
    const x = d.clone().normalize();
    const toCam = cam.position.clone().sub(p).normalize();
    let y = new THREE.Vector3().crossVectors(toCam, x); if (y.lengthSq() < 1e-6) y.set(0, 1, 0); y.normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const m = new THREE.Matrix4().makeBasis(x, y, z);
    this.group.quaternion.setFromRotationMatrix(m);
    this.group.position.copy(p);
    const thick = 1 + pulse * 0.15;
    this.group.scale.set(L, thick, 1);
    this.core.material.opacity = alpha; this.halo.material.opacity = 0.35 * alpha * (1 + pulse * 0.5); this.inner.material.opacity = 0.85 * alpha;
  }
}

// chevrons flowing along a direction (air flow)
export class FlowChevrons {
  constructor(color, n = 5) {
    this.group = new THREE.Group();
    this.items = [];
    const s = new THREE.Shape(); const w = 0.07;
    s.moveTo(-0.12, -0.16); s.lineTo(0.0, 0.0); s.lineTo(-0.12, 0.16); s.lineTo(-0.12 + w, 0.16); s.lineTo(w, 0.0); s.lineTo(-0.12 + w, -0.16); s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3.5), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.renderOrder = 11; this.group.add(m); this.items.push(m);
    }
    this.group.visible = false;
  }
  set(p, d, L, cam, t, alpha = 1, speed = 2.5, size = 1) {
    this.group.visible = alpha > 0.01;
    if (!this.group.visible) return;
    const x = d.clone().normalize();
    const toCam = cam.position.clone().sub(p).normalize();
    let y = new THREE.Vector3().crossVectors(toCam, x); y.normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const n = this.items.length;
    this.items.forEach((m, i) => {
      const u = fract(t * speed / L + i / n);
      m.position.copy(p).addScaledVector(x, u * L);
      m.quaternion.copy(q);
      const sc = size * (0.75 + 0.5 * Math.sin(u * Math.PI));
      m.scale.setScalar(sc);
      m.material.opacity = alpha * Math.sin(u * Math.PI);
    });
  }
}

// ------------------------------------------------------------------ deterministic particle systems
// streak particles (sparks / air wisps): instanced quads stretched along velocity, facing camera
export class Streaks {
  constructor(max, color, { additive = true, width = 0.012, tex = null } = {}) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(-0.5, 0, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, map: tex });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.width = width;
  }
  // list: [{p:Vector3, v:Vector3 (direction*len), w, c:Color, a}]
  draw(list, cam) {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3();
    let n = 0;
    for (const it of list) {
      if (n >= this.max) break;
      const L = it.v.length(); if (L < 1e-5) continue;
      const x = it.v.clone().divideScalar(L);
      const toCam = cam.position.clone().sub(it.p).normalize();
      const y = new THREE.Vector3().crossVectors(toCam, x).normalize();
      const z = new THREE.Vector3().crossVectors(x, y);
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      S.set(L, it.w ?? this.width, 1);
      M.compose(it.p, q, S);
      this.mesh.setMatrixAt(n, M);
      const c = (it.c || new THREE.Color(1, 1, 1)).clone().multiplyScalar(it.a ?? 1);
      this.mesh.setColorAt(n, c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = n > 0;
  }
}

// soft sprites (dust puffs / glow dots)
export class Puffs {
  constructor(max, color, additive = false) {
    this.items = [];
    this.group = new THREE.Group();
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.visible = false; s.renderOrder = 9; this.group.add(s); this.items.push(s);
    }
  }
  draw(list) {
    this.items.forEach((s, i) => {
      const it = list[i];
      if (!it) { s.visible = false; return; }
      s.visible = true; s.position.copy(it.p); s.scale.setScalar(it.s); s.material.opacity = it.a; if (it.c) s.material.color.copy(it.c);
    });
  }
}

// confetti: small tumbling coloured cards
export class Confetti {
  constructor(n = 220) {
    this.n = n;
    const geo = new THREE.PlaneGeometry(0.1, 0.15);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.2, emissive: 0x222222 }), n);
    this.mesh.frustumCulled = false;
    const cols = [0xff4d6d, 0xffd23f, 0x3bceac, 0x5e60ce, 0xff8c42, 0x4cc9f0, 0xffffff];
    const r = mulberry32(99); const c = new THREE.Color();
    this.parts = [];
    for (let i = 0; i < n; i++) {
      c.set(cols[i % cols.length]); this.mesh.setColorAt(i, c);
      this.parts.push({ side: r() < 0.5 ? -1 : 1, vx: (r() - 0.5) * 7.0, vy: -1.5 + r() * 5.0, vz: (r() - 0.5) * 5.0, spin: r() * 12, ax: r(), az: r(), ph: r() * 6, delay: r() * 0.25 });
    }
    this.mesh.visible = false;
  }
  // origins: [Vector3, Vector3] (left/right posts), age in seconds
  draw(origins, age) {
    if (age < 0 || age > 6) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    this.parts.forEach((pt, i) => {
      const a = Math.max(0, age - pt.delay);
      const B = origins; const oz = B.z0 + (B.z1 - B.z0) * pt.ax;
      // drag: velocity decays, terminal fall speed ~0.7 m/s with flutter
      const k = 2.4, tf = 0.7;
      const decay = (1 - Math.exp(-k * a)) / k;
      p.set(B.x + pt.vx * decay + Math.sin(a * 3 + pt.ph) * 0.18 * a, B.y + pt.vy * decay - tf * a, oz + pt.vz * decay + Math.cos(a * 2.6 + pt.ph) * 0.15 * a);
      p.y = Math.max(p.y, B.y - 2.95);
      e.set(pt.spin * a * pt.ax, pt.spin * a, pt.spin * a * pt.az); q.setFromEuler(e);
      const sc = a <= 0 ? 0 : 1; s.setScalar(sc);
      M.compose(p, q, s); this.mesh.setMatrixAt(i, M);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// little cartoon stars circling after the bonk
export function makeStars() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.035 : 0.08, a = (i / 10) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: 2.2, roughness: 0.3 });
  const items = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(geo, mat); g.add(m); items.push(m); }
  g.userData.items = items; g.visible = false;
  return g;
}

// centre-of-mass marker: glowing dot with halo + dashed drop line, drawn on top
export function makeComDot() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd23f).multiplyScalar(2.0), depthTest: false, transparent: true }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9f1c).multiplyScalar(1.6), depthTest: false, transparent: true, side: THREE.DoubleSide }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffc040, depthTest: false, transparent: true, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.5);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe066).multiplyScalar(2), depthTest: false, transparent: true, opacity: 0.7 }));
  line.position.y = -0.5;
  const lineG = new THREE.Group(); lineG.add(line);
  g.add(lineG, halo, core, ring);
  for (const m of [core, ring, halo, line]) m.renderOrder = 20;
  g.userData = { core, ring, halo, lineG, line };
  g.visible = false;
  return g;
}

export { glow };
