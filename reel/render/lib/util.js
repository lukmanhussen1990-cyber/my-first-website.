// Small math + geometry helpers shared by the scene modules.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => smootherstep(0, 1, t);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);

// Overshooting "pop" used for parts that snap into place: 0 -> ~1.12 -> 1.
export function popBounce(t) {
  t = clamp(t);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 + Math.sin(t * Math.PI * 2.4) * Math.exp(-t * 5.5) * 0.9 * (1 - t) - (1 - t) * Math.exp(-t * 9);
}

// Damped spring settle: starts at 1 (full offset) and settles to 0 with wobble.
export const springSettle = (t, freq = 3.2, damp = 5.0) =>
  t <= 0 ? 1 : Math.exp(-damp * t) * Math.cos(Math.PI * 2 * freq * t);

// Piecewise-linear lookup in a table of [x, value] pairs (x in any order).
export function table(pairs) {
  const p = [...pairs].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        const t = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        return lerp(p[i - 1][1], p[i][1], t);
      }
    }
    return p[p.length - 1][1];
  };
}

// Smooth (Catmull-Rom) lookup in a table of [x, value] pairs.
export function smoothTable(pairs) {
  const p = [...pairs].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[p.length - 1][0]) return p[p.length - 1][1];
    let i = 1;
    while (x > p[i][0]) i++;
    const p0 = p[Math.max(0, i - 2)], p1 = p[i - 1], p2 = p[i], p3 = p[Math.min(p.length - 1, i + 1)];
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

// Seeded random so every frame of the film sees the same "random" layout.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Loft a mirrored car-like body from cross-sections.
 * stations: [{ pts: [[x,y,z], ...] }] half profiles (z >= 0), same point count each.
 * bandMaterial(i, j) -> material index for the quad between stations i,i+1 and points j,j+1 (or -1 to skip).
 * Returns a non-indexed BufferGeometry with groups per material and creased normals.
 */
export function loftMirrored(stations, bandMaterial, creaseDeg = 28) {
  const buckets = new Map();
  const push = (m, a, b, c) => {
    // Skip slivers so collapsed bands don't produce NaN normals.
    const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
    if (ab.cross(ac).lengthSq() < 1e-12) return;
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const V = (p, mirror) => new THREE.Vector3(p[0], p[1], mirror ? -p[2] : p[2]);
  for (let i = 0; i < stations.length - 1; i++) {
    const A = stations[i].pts, B = stations[i + 1].pts;
    for (let j = 0; j < A.length - 1; j++) {
      const m = bandMaterial(i, j);
      if (m < 0) continue;
      for (const mirror of [false, true]) {
        const a = V(A[j], mirror), b = V(A[j + 1], mirror), c = V(B[j + 1], mirror), d = V(B[j], mirror);
        // Stations run front (+x) to back, profile points run bottom -> side -> top,
        // so (a,b,c) faces outward on the +z half; the mirrored half is reversed.
        if (!mirror) { push(m, a, b, c); push(m, a, c, d); }
        else { push(m, a, c, b); push(m, a, d, c); }
      }
    }
  }
  return buildGrouped(buckets, creaseDeg);
}

export function buildGrouped(buckets, creaseDeg = 28) {
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const all = [];
  const groups = [];
  let start = 0;
  for (const k of keys) {
    const arr = buckets.get(k);
    all.push(...arr);
    groups.push({ start, count: arr.length / 3, materialIndex: k });
    start += arr.length / 3;
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
  g = toCreasedNormals(g, THREE.MathUtils.degToRad(creaseDeg));
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}

// Triangle soup helper: add a quad / polygon fan to a bucket map.
export function addQuad(buckets, m, a, b, c, d) {
  if (!buckets.has(m)) buckets.set(m, []);
  const arr = buckets.get(m);
  arr.push(...a, ...b, ...c, ...a, ...c, ...d);
}

// Extrude a flat strip along a polyline lying on a surface (used for seams, light bars).
export function ribbon(points, normals, width, offset = 0.003) {
  const pos = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const n0 = normals[i], n1 = normals[i + 1];
    const t = new THREE.Vector3().subVectors(p1, p0).normalize();
    const s0 = new THREE.Vector3().crossVectors(n0, t).normalize().multiplyScalar(width / 2);
    const s1 = new THREE.Vector3().crossVectors(n1, t).normalize().multiplyScalar(width / 2);
    const a = p0.clone().addScaledVector(n0, offset).sub(s0), b = p0.clone().addScaledVector(n0, offset).add(s0);
    const c = p1.clone().addScaledVector(n1, offset).add(s1), d = p1.clone().addScaledVector(n1, offset).sub(s1);
    pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
