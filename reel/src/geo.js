// Low-poly geometry builders. All meshes are flat shaded with a subtle per-facet tint so every triangle reads.
import * as THREE from 'three';
import { mulberry32, TAU } from './util.js';

// Turn any geometry into a faceted one with per-triangle brightness/hue jitter stored in vertex colors.
export function facet(geo, jitter = 0.07, seed = 1, tint = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count; const col = new Float32Array(n * 3); const rnd = mulberry32(seed * 7919 + 13);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (rnd() - 0.5) * 2 * jitter; const w = (rnd() - 0.5) * jitter * 0.6;
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = k + w; col[(i + j) * 3 + 1] = k; col[(i + j) * 3 + 2] = k - w; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export const FAST = !new URLSearchParams(location.search).get('debug')?.includes('pbr');
export function mat(color, o = {}) {
  if (FAST && !(o.metalness > 0.3) && !o.keepStd) { const { roughness, metalness, keepStd, ...rest } = o; return new THREE.MeshLambertMaterial({ color, flatShading: true, vertexColors: true, ...rest }); }
  return new THREE.MeshStandardMaterial({ color, flatShading: true, vertexColors: true, roughness: 0.82, metalness: 0, ...o });
}

export function mesh(geo, material, o = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  if (o.pos) m.position.set(...o.pos); if (o.rot) m.rotation.set(...o.rot); if (o.scale) (typeof o.scale === 'number' ? m.scale.setScalar(o.scale) : m.scale.set(...o.scale));
  if (o.parent) o.parent.add(m);
  return m;
}

// Loft through elliptical sections along Y. secs: [{y, rx, rz, x?, z?}]
export function loft(secs, sides = 8, o = {}) {
  const stagger = o.stagger ?? true; const rings = [];
  secs.forEach((s, i) => {
    const off = (stagger && (i % 2)) ? Math.PI / sides : 0; const ring = [];
    for (let j = 0; j < sides; j++) { const a = j / sides * TAU + off + (s.rot || 0); ring.push(new THREE.Vector3((s.x || 0) + Math.sin(a) * s.rx, s.y, (s.z || 0) + Math.cos(a) * s.rz)); }
    rings.push(ring);
  });
  const pos = [];
  const tri = (a, b, c, out) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(out) < 0) { const t = b; b = c; c = t; }
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1]; const sa = secs[i], sb = secs[i + 1];
    const cen = new THREE.Vector3(((sa.x || 0) + (sb.x || 0)) / 2, (sa.y + sb.y) / 2, ((sa.z || 0) + (sb.z || 0)) / 2);
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides; const a0 = A[j], a1 = A[j1], b0 = B[j], b1 = B[j1];
      const out = (p, q, r) => new THREE.Vector3().add(p).add(q).add(r).multiplyScalar(1 / 3).sub(cen).setY(0);
      if (!stagger || i % 2 === 0) { tri(a0, a1, b0, out(a0, a1, b0)); tri(a1, b1, b0, out(a1, b1, b0)); }
      else { tri(a0, a1, b1, out(a0, a1, b1)); tri(a0, b1, b0, out(a0, b1, b0)); }
    }
  }
  const cap = (ring, s, dir) => {
    const c = new THREE.Vector3(s.x || 0, s.y + (s.capH || 0) * dir, s.z || 0);
    for (let j = 0; j < sides; j++) tri(c, ring[j], ring[(j + 1) % sides], new THREE.Vector3(0, dir, 0));
  };
  if (o.capStart ?? true) cap(rings[0], { ...secs[0], capH: o.capH0 ?? 0 }, -1);
  if (o.capEnd ?? true) cap(rings[rings.length - 1], { ...secs[secs.length - 1], capH: o.capH1 ?? 0 }, 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return facet(g, o.jitter ?? 0.07, o.seed ?? 3);
}

// Tapered limb segment along +Y from 0..1 (scaled to length when placed between joints)
export function limbGeo(r0, r1, sides = 6, o = {}) {
  const k = o.bulge ?? 1.12;
  return loft([
    { y: 0, rx: r0, rz: r0 * (o.flat ?? 1) },
    { y: 0.4, rx: (r0 * 0.6 + r1 * 0.4) * k, rz: (r0 * 0.6 + r1 * 0.4) * k * (o.flat ?? 1) },
    { y: 1, rx: r1, rz: r1 * (o.flat ?? 1) },
  ], sides, { capH0: -r0 * 0.5, capH1: r1 * 0.5, seed: o.seed ?? 5, jitter: o.jitter ?? 0.06 });
}

// Deformed icosphere blob
export function blob(radius, detail, fn, o = {}) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  if (fn) { const p = g.attributes.position; const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, v.clone().normalize()); p.setXYZ(i, v.x, v.y, v.z); } }
  return facet(g, o.jitter ?? 0.07, o.seed ?? 9);
}

export function box(w, h, d, o = {}) { return facet(new THREE.BoxGeometry(w, h, d, o.sx || 1, o.sy || 1, o.sz || 1), o.jitter ?? 0.04, o.seed ?? 2); }

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
// place a unit-length limb mesh between two points
export function span(m, a, b, twistRef) {
  m.position.copy(a); _d.subVectors(b, a); const len = _d.length(); _d.normalize();
  if (twistRef) {
    // build basis so local Z faces twistRef as closely as possible
    const z = _a.copy(twistRef).addScaledVector(_d, -twistRef.dot(_d)).normalize(); const x = new THREE.Vector3().crossVectors(_d, z).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, _d, z));
  } else m.quaternion.setFromUnitVectors(_Y, _d);
  m.scale.set(1, len, 1);
}

// analytic two-bone IK: returns elbow/knee position
export function ik2(S, T, a, b, pole, out = new THREE.Vector3()) {
  const dir = new THREE.Vector3().subVectors(T, S); let d = dir.length(); const max = (a + b) * 0.999; if (d > max) d = max; dir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d); const h = Math.sqrt(Math.max(a * a - x * x, 0));
  const p = new THREE.Vector3().copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  return out.copy(S).addScaledVector(dir, x).addScaledVector(p, h);
}

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = o.aniso ?? 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  t.userData.canvas = c; t.userData.ctx = ctx;
  return t;
}
