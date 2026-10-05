// Procedural tree, grass and rock geometry (unit height, scaled per instance)
// plus their shared materials.

import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { Noise } from '../core/noise.js';
import { foliageTexture, barkTexture, grassTexture, grainNormal } from '../core/textures.js';
import { makeSwaying } from './shared.js';

class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.idx = [];
    this.groups = [];
    this._groupStart = 0;
  }

  vertex(x, y, z, nx, ny, nz, u, v) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  endGroup(materialIndex) {
    const count = this.idx.length - this._groupStart;
    if (count > 0) this.groups.push({ start: this._groupStart, count, materialIndex });
    this._groupStart = this.idx.length;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Tapered, slightly bent tube from p0 to p1 (used for trunks and branches). */
function tube(b, p0, p1, r0, r1, sides, vRepeat, bend = null) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  dir.normalize();
  const tmp = Math.abs(dir.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(dir, tmp).normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  const rings = bend ? 4 : 2;
  const base = b.pos.length / 3;
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    const c = new THREE.Vector3().copy(p0).addScaledVector(dir, len * t);
    if (bend) c.addScaledVector(bend, Math.sin(t * Math.PI) * len * 0.06);
    const rad = r0 + (r1 - r0) * t;
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const nx = side.x * Math.cos(a) + up.x * Math.sin(a);
      const ny = side.y * Math.cos(a) + up.y * Math.sin(a);
      const nz = side.z * Math.cos(a) + up.z * Math.sin(a);
      b.vertex(c.x + nx * rad, c.y + ny * rad, c.z + nz * rad, nx, ny, nz, s / sides, t * vRepeat * len);
    }
  }
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const a = base + r * (sides + 1) + s;
      const c = a + sides + 1;
      b.tri(a, c, a + 1);
      b.tri(a + 1, c, c + 1);
    }
  }
}

/**
 * Spruce: bare lower trunk, then stacked drooping skirts of needles with a
 * star-shaped outline. Height 1, groups: 0 bark, 1 foliage.
 */
export function spruceGeometry(seed, opts = {}) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const start = opts.start ?? rng.range(0.16, 0.3);
  const width = opts.width ?? rng.range(0.19, 0.25);
  tube(b, new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 0.97, 0), 0.016, 0.003, 7, 8);
  b.endGroup(0);

  const layers = opts.layers ?? rng.int(10, 13);
  const segs = 12;
  for (let j = 0; j < layers; j++) {
    const t0 = j / layers;
    const yTop = start + (1 - start) * ((j + 1) / layers) + 0.02;
    const yBottom = start + (1 - start) * t0 - (1 - start) / layers * 0.7;
    const prof = Math.pow(1 - t0, 0.92);
    const R = width * prof + 0.012;
    const droop = R * rng.range(0.25, 0.45);
    const rot = rng.next() * Math.PI * 2;
    const base = b.pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const a = rot + (s / segs) * Math.PI * 2;
      const star = s % 2 === 0 ? 1 : rng.range(0.7, 0.85);
      const jit = rng.range(0.88, 1.12);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rTop = R * 0.12;
      const rBot = R * star * jit;
      const u = (s / segs) * 3;
      // Inner ring hugs the trunk; outer ring droops down at the branch tips.
      b.vertex(ca * rTop, yTop, sa * rTop, ca * 0.25, 0.97, sa * 0.25, u, 1);
      b.vertex(ca * rBot, yBottom - droop * (star > 0.9 ? 1 : 0.7), sa * rBot, ca * 0.8, 0.45, sa * 0.8, u, 0);
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2;
      b.tri(a, a + 2, a + 1);
      b.tri(a + 1, a + 2, a + 3);
    }
  }
  b.endGroup(1);
  return b.build();
}

/** Tall pine: long bare trunk with a compact crown near the top. */
export function pineGeometry(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  tube(b, new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.01, 0.94, 0), 0.014, 0.004, 7, 8,
    new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize());
  // A few stubby dead branches on the trunk.
  for (let i = 0; i < 5; i++) {
    const y = rng.range(0.25, 0.6);
    const a = rng.next() * Math.PI * 2;
    const l = rng.range(0.04, 0.09);
    tube(b, new THREE.Vector3(0, y, 0), new THREE.Vector3(Math.cos(a) * l, y + l * 0.3, Math.sin(a) * l), 0.004, 0.001, 4, 4);
  }
  b.endGroup(0);
  const layers = 7;
  const segs = 10;
  for (let j = 0; j < layers; j++) {
    const t0 = j / layers;
    const yTop = 0.66 + 0.34 * ((j + 1) / layers) + 0.02;
    const yBottom = 0.66 + 0.34 * t0 - 0.05;
    const R = (0.13 * Math.sin((1 - t0) * Math.PI * 0.75 + 0.3)) + 0.015;
    const rot = rng.next() * Math.PI * 2;
    const base = b.pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const a = rot + (s / segs) * Math.PI * 2;
      const star = s % 2 === 0 ? 1 : 0.6;
      const rBot = R * star * rng.range(0.85, 1.15);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const u = (s / segs) * 2;
      b.vertex(ca * R * 0.15, yTop, sa * R * 0.15, ca * 0.2, 0.98, sa * 0.2, u, 1);
      b.vertex(ca * rBot, yBottom - R * 0.25, sa * rBot, ca * 0.75, 0.55, sa * 0.75, u, 0);
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2;
      b.tri(a, a + 2, a + 1);
      b.tri(a + 1, a + 2, a + 3);
    }
  }
  b.endGroup(1);
  return b.build();
}

/** Dead snag: crooked trunk with bare, broken branches. Single group (bark). */
export function deadTreeGeometry(seed) {
  const rng = new RNG(seed);
  const b = new GeoBuilder();
  const pts = [new THREE.Vector3(0, -0.02, 0)];
  let p = pts[0].clone();
  const segs = 4;
  for (let i = 1; i <= segs; i++) {
    p = p.clone().add(new THREE.Vector3(rng.range(-0.03, 0.03), 0.92 / segs, rng.range(-0.03, 0.03)));
    pts.push(p);
  }
  for (let i = 0; i < segs; i++) {
    const r0 = 0.022 * (1 - i / segs) + 0.004;
    const r1 = 0.022 * (1 - (i + 1) / segs) + 0.003;
    tube(b, pts[i], pts[i + 1], r0, r1, 7, 7);
  }
  const branches = rng.int(9, 15);
  for (let i = 0; i < branches; i++) {
    const t = rng.range(0.3, 0.92);
    const k = Math.min(segs - 1, Math.floor(t * segs));
    const origin = pts[k].clone().lerp(pts[k + 1], t * segs - k);
    const a = rng.next() * Math.PI * 2;
    const up = rng.range(0.25, 0.9);
    const len = rng.range(0.08, 0.26) * (1.15 - t);
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
    const end = origin.clone().addScaledVector(dir, len);
    tube(b, origin, end, 0.006 * (1.2 - t), 0.0012, 5, 5, new THREE.Vector3(0, -1, 0));
    if (rng.chance(0.6)) {
      const mid = origin.clone().lerp(end, rng.range(0.4, 0.7));
      const a2 = a + rng.range(-1.2, 1.2);
      const dir2 = new THREE.Vector3(Math.cos(a2), rng.range(0.3, 1.0), Math.sin(a2)).normalize();
      tube(b, mid, mid.clone().addScaledVector(dir2, len * 0.45), 0.003, 0.0008, 4, 4);
    }
  }
  b.endGroup(0);
  return b.build();
}

/** Three crossed alpha cards forming a tuft of roadside grass (height 1). */
export function grassGeometry() {
  const b = new GeoBuilder();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const ca = Math.cos(a) * 0.6;
    const sa = Math.sin(a) * 0.6;
    const v0 = b.vertex(-ca, 0, -sa, 0, 1, 0, 0, 0);
    const v1 = b.vertex(ca, 0, sa, 0, 1, 0, 1, 0);
    const v2 = b.vertex(ca * 1.1, 1, sa * 1.1, 0, 1, 0, 1, 1);
    const v3 = b.vertex(-ca * 1.1, 1, -sa * 1.1, 0, 1, 0, 0, 1);
    b.tri(v0, v1, v2);
    b.tri(v0, v2, v3);
  }
  b.endGroup(0);
  return b.build();
}

/** Lumpy boulder with mossy top (vertex colours). */
export function rockGeometry(seed) {
  const noise = new Noise(seed);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.fbm3(v.x * 1.3, v.y * 1.3, v.z * 1.3, 3);
    v.multiplyScalar(1 + n * 0.35);
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const moss = THREE.MathUtils.smoothstep(nrm.getY(i), 0.45, 0.85);
    col[i * 3] = 0.34 - moss * 0.18;
    col[i * 3 + 1] = 0.33 - moss * 0.06;
    col[i * 3 + 2] = 0.31 - moss * 0.2;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

let materials = null;

export function vegetationMaterials() {
  if (materials) return materials;
  const bark = new THREE.MeshLambertMaterial({ color: 0x8a7e72, map: barkTexture() });
  bark.map.repeat.set(1, 1);
  const foliage = makeSwaying(new THREE.MeshLambertMaterial({
    color: 0x8a9688,
    map: foliageTexture(),
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  }), 0.012, 'foliage');
  const deadBark = new THREE.MeshLambertMaterial({ color: 0x9a948c, map: barkTexture() });
  const grass = makeSwaying(new THREE.MeshLambertMaterial({
    color: 0xc8c8b8,
    map: grassTexture(),
    alphaTest: 0.38,
    side: THREE.DoubleSide,
  }), 0.16, 'grass');
  const rock = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    normalMap: grainNormal(17, 256, 3000, 2, 5, 1.2),
  });
  materials = { bark, foliage, deadBark, grass, rock };
  return materials;
}
