// Navy blanket: a cloth grid that drapes over whatever is in the bed (height field over character bones),
// can be pulled up / bunched at the foot, and can fly off the bed to become the ghost's superhero cape.
import * as THREE from 'three';
import { BED } from './scene.js';

const NX = 46, NS = 56, HWB = 1.15, LEN = 2.3;
export class Blanket {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((NX + 1) * (NS + 1) * 3);
    const col = new Float32Array((NX + 1) * (NS + 1) * 3), idx = [], uv = new Float32Array((NX + 1) * (NS + 1) * 2);
    const c0 = new THREE.Color(0x1b2f78), c1 = new THREE.Color(0x4f79d8);
    for (let j = 0; j <= NS; j++) for (let i = 0; i <= NX; i++) {
      const k = j * (NX + 1) + i, s = j / NS;
      const c = (s > 0.03 && s < 0.075) ? c1 : c0; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      uv[k * 2] = i / NX; uv[k * 2 + 1] = s;
      if (i < NX && j < NS) idx.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2);
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.tmp = new THREE.Vector3();
  }
  // st: { top, bumps:[{x,y,z,r}], cape:{k, origin:Vector3, quat:Quaternion, t}, lift }
  update(st) {
    const base = BED.top + 0.03, hw = BED.hw, zf = BED.zFoot;
    const span = (zf + 0.32) - st.top, c = Math.min(1, span / LEN), wr = Math.min(1, Math.max(0, (1 - c) * 2.2));
    const bumps = st.bumps || [], cape = st.cape, k = cape ? cape.k : 0;
    const p = this.pos, v = this.tmp;
    for (let j = 0; j <= NS; j++) for (let i = 0; i <= NX; i++) {
      const n = (j * (NX + 1) + i) * 3, u = (i / NX) * 2 - 1, s = j / NS;
      let x = 0, y = 0, z = 0;
      if (k < 1) {
        const X = u * HWB, Z = st.top + s * span;
        const cx = Math.max(-hw, Math.min(hw, X)), cz = Math.min(zf, Z);
        let h = base;
        for (const b of bumps) {
          const dx = cx - b.x, dz = cz - b.z, w = b.r * 1.55 + 0.07;
          const hh = base + (b.y + b.r - base) * Math.exp(-(dx * dx + dz * dz) / (w * w) * 1.15);
          if (hh > h) h = hh;
        }
        h += wr * 0.035 * Math.sin(s * 38 + u * 2.5) + wr * 0.012 * Math.sin(u * 9 + s * 5);
        h += 0.006 * Math.sin(u * 7 + s * 3) * Math.sin(s * 9);
        x = cx; y = h; z = cz;
        const dX = Math.abs(X) - hw; if (dX > 0) { x = Math.sign(X) * (hw + 0.025); y -= dX * 1.05; }
        const dZ = Z - zf; if (dZ > 0) { z = zf + 0.03; y -= dZ * 1.05; }
        if (y < 0.03) y = 0.03;
      }
      if (k > 0) {
        const t = cape.t;
        const wave = 0.07 * Math.sin(5.5 * s - t * 9 + u * 1.8) * s + 0.035 * Math.sin(11 * s - t * 14 - u * 3) * s;
        v.set(u * (0.2 + 0.36 * s), -0.03 - s * 0.95 + 0.05 * Math.abs(u) * s, -0.2 - 0.34 * s - wave - 0.1 * s * Math.sin(t * 3));
        v.applyQuaternion(cape.quat).add(cape.origin);
        if (k < 1) {
          const e = k * k * (3 - 2 * k), arc = Math.sin(Math.PI * k);
          x += (v.x - x) * e + arc * 0.25 * Math.sin(u * 3 + s * 6 + t * 20);
          y += (v.y - y) * e + arc * (0.75 + 0.25 * Math.sin(s * 7 + u * 2));
          z += (v.z - z) * e + arc * 0.2 * Math.cos(s * 5 + t * 18);
        } else { x = v.x; y = v.y; z = v.z; }
      }
      p[n] = x; p[n + 1] = y; p[n + 2] = z;
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  }
}

// Bones that push the blanket up, with their radii (metres).
const BUMP = [['Head', 0.2, [0, 0.22, 0]], ['Head', 0.14, [0, 0.05, 0.05]], ['Spine2', 0.16], ['Spine', 0.16], ['Hips', 0.16], ['LeftLeg', 0.09], ['RightLeg', 0.09], ['LeftFoot', 0.09], ['RightFoot', 0.09],
  ['LeftToeBase', 0.07], ['RightToeBase', 0.07], ['LeftForeArm', 0.07], ['RightForeArm', 0.07], ['LeftHand', 0.07], ['RightHand', 0.07], ['LeftArm', 0.08], ['RightArm', 0.08]];
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
export function bumpsFor(actor, top, { extra = 1, exclude = null, mid = true } = {}) {
  const out = [];
  const add = (x, y, z, r) => { if (z > top - 0.12) out.push({ x, y, z, r: r * Math.min(1, (z - top + 0.12) / 0.2 + 0.35) }); };
  for (const [n, r, off] of BUMP) {
    if (exclude && exclude.test(n)) continue;
    const b = actor.bones[n]; b.getWorldPosition(_v);
    if (off) { b.getWorldQuaternion(_q); const o = new THREE.Vector3(...off).applyQuaternion(_q).applyQuaternion(actor.rest[n].Wb.clone().invert()); _v.add(o); }
    add(_v.x, _v.y, _v.z, r * extra);
  }
  if (mid) for (const [a, b, r] of [['Hips', 'LeftLeg', 0.1], ['Hips', 'RightLeg', 0.1], ['LeftLeg', 'LeftFoot', 0.08], ['RightLeg', 'RightFoot', 0.08], ['Spine', 'Spine2', 0.16], ['Spine2', 'Head', 0.15]]) {
    const pa = actor.bones[a].getWorldPosition(new THREE.Vector3()), pb = actor.bones[b].getWorldPosition(new THREE.Vector3());
    pa.lerp(pb, 0.5); add(pa.x, pa.y, pa.z, r * extra);
  }
  return out;
}
