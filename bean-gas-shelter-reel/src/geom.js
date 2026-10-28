import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './util.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------
export function clean(g) {
  let h = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
  if (!h.attributes.uv) {
    const n = h.attributes.position.count;
    h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return h;
}
export function mergeAll(list) {
  return mergeGeometries(list.map(clean), false);
}
export function placed(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}
export const box = (sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => placed(new THREE.BoxGeometry(sx, sy, sz), x, y, z, rx, ry, rz);
// box from min/max corners
export const boxMM = (x0, y0, z0, x1, y1, z1) => box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

// lumpy blob (dirt chunks, puffs)
export function lumpyBlob(radius, detail, amp, seed) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const rnd = mulberry32(seed);
  const p = g.attributes.position;
  const offs = [];
  for (let i = 0; i < 6; i++) offs.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 6.28]);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let d = 0;
    for (const o of offs) d += Math.sin(n.x * o[0] * 4 + n.y * o[1] * 4 + n.z * o[2] * 4 + o[3]);
    v.multiplyScalar(1 + (amp * d) / offs.length);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// thin rod between two points (posts, ropes, handles)
const _up = new THREE.Vector3(0, 1, 0);
export function rod(a, b, r0, r1 = r0, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
