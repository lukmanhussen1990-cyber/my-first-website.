// Geometry helpers for soft, rounded, toy-like shapes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './anim.js';

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// Tapered capsule hanging DOWN from the origin: radius r0 at the top (y=0), r1 at the bottom (y=-len).
export function limb(r0, r1, len, radial = 20, cap = 6) {
  return cached(`limb${r0},${r1},${len},${radial}`, () => {
    const pts = [];
    for (let i = 0; i <= cap; i++) {          // bottom cap
      const a = -Math.PI / 2 + (i / cap) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.cos(a) * r1, -len + Math.sin(a) * r1));
    }
    for (let i = 0; i <= cap; i++) {          // top cap
      const a = (i / cap) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0));
    }
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    return new THREE.LatheGeometry(pts, radial);
  });
}

// Lathe from [radius, y] pairs (bottom to top), smooth.
export function lathe(profile, radial = 32) {
  return cached(`lathe${JSON.stringify(profile)},${radial}`, () =>
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), radial));
}

// Smooth closed profile through control points, resampled (Catmull-Rom).
export function smoothLathe(ctrl, samples = 40, radial = 36) {
  return cached(`slathe${JSON.stringify(ctrl)},${samples},${radial}`, () => {
    const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
    const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
    return new THREE.LatheGeometry(pts, radial);
  });
}

export function roundedBox(w, h, d, r = 0.02, seg = 4) {
  return cached(`rbox${w},${h},${d},${r},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
}

export function sphere(r = 1, ws = 40, hs = 28) {
  return cached(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}
export function cyl(rt, rb, h, rs = 24, open = false) {
  return cached(`cyl${rt},${rb},${h},${rs},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, rs, 1, open));
}
export function capsule(r, len, cap = 8, radial = 20) {
  return cached(`cap${r},${len},${cap},${radial}`, () => new THREE.CapsuleGeometry(r, len, cap, radial));
}
export function torus(R, r, rs = 16, ts = 40, arc = Math.PI * 2) {
  return cached(`tor${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
}
export function cone(r, h, rs = 24) {
  return cached(`cone${r},${h},${rs}`, () => new THREE.ConeGeometry(r, h, rs));
}

// Lumpy blob (trees, bushes, clouds, curls): icosphere with smooth noise, smooth normals.
export function blob(r = 1, detail = 3, amp = 0.12, seed = 1, flatBottom = 0) {
  return cached(`blob${r},${detail},${amp},${seed},${flatBottom}`, () => {
    let g = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const rnd = mulberry32(seed);
    const waves = Array.from({ length: 6 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, 1.5 + rnd() * 2.5, rnd() * 6]);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let n = 0;
      for (const [a, b, c, f, ph] of waves) n += Math.sin((v.x * a + v.y * b + v.z * c) * f + ph);
      let rr = r * (1 + amp * n / 3);
      v.multiplyScalar(rr);
      if (flatBottom && v.y < -r * flatBottom) v.y = -r * flatBottom + (v.y + r * flatBottom) * 0.15;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Merge many meshes (same material) into one geometry, keeping transforms (for static crowds/sets).
export function mergeMeshes(meshes) {
  const geos = meshes.map((m) => { m.updateWorldMatrix(true, false); return m.geometry.clone().applyMatrix4(m.matrixWorld); });
  return mergeGeometries(geos, false);
}

// A flat 2D shape (THREE.Shape) extruded with rounded bevels.
export function extrude(shape, depth = 0.05, bevel = 0.01, curve = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return g;
}

// For grid meshes built ring by ring (rings x (segs+1) vertices) whose first and last columns
// coincide: average the normals across that seam so no shading line shows.
export function weldSeamNormals(geo, rings, segs) {
  const n = geo.attributes.normal.array;
  for (let i = 0; i <= rings; i++) {
    const a = (i * (segs + 1)) * 3, b = (i * (segs + 1) + segs) * 3;
    for (let k = 0; k < 3; k++) { const m = (n[a + k] + n[b + k]) / 2; n[a + k] = m; n[b + k] = m; }
  }
  geo.attributes.normal.needsUpdate = true;
}
