// Helpers for set.js only: deterministic 2D noise, distances, geometry merging/colouring, instancing by cells.
import * as THREE from 'three';
import { clamp } from './lib.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- noise (pure functions of the inputs)
export function hash2(ix, iy, seed = 0) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul((seed | 0) + 1013, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// smooth value noise in [0,1]
export function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 31); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---------------------------------------------------------------- 2D distances
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / L2) : 0;
  const qx = ax + dx * t, qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t };
}
// distance to a polyline [[x,z],...]; returns {d, s} where s = arc length of the closest point
export function polyDist(px, pz, pts) {
  let best = 1e9, bs = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const r = segDist(px, pz, ax, az, bx, bz);
    if (r.d < best) { best = r.d; bs = acc + r.t * L; }
    acc += L;
  }
  return { d: best, s: bs };
}
// Catmull-Rom resample of a 2D polyline
export function smoothPath(pts, perSeg = 8) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

// ---------------------------------------------------------------- geometry helpers
// Non-indexed copy with per-face colours: fn(cx,cy,cz, nx,ny,nz, faceIndex) -> [r,g,b] (linear 0..1 multipliers)
export function faceColors(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const a = V(), b = V(), c = V(), e1 = V(), e2 = V(), nn = V();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    const rgb = fn((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, nn.x, nn.y, nn.z, i / 3);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = rgb[0]; col[(i + k) * 3 + 1] = rgb[1]; col[(i + k) * 3 + 2] = rgb[2]; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Per-vertex colours: fn(x,y,z,i) -> [r,g,b]
export function vertColors(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i), i); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Merge geometries into one non-indexed BufferGeometry (position, normal, uv, color).
export function mergeGeos(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const anyUV = list.some((g) => g.attributes.uv), anyCol = list.some((g) => g.attributes.color);
  let total = 0; for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const uv = anyUV ? new Float32Array(total * 2) : null, col = anyCol ? new Float32Array(total * 3) : null;
  let o = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (uv && g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, n * 3), o * 3); else col.fill(1, o * 3, (o + n) * 3); }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

// Build a geometry from raw triangle lists: tris = [[ax,ay,az, bx,by,bz, cx,cy,cz], ...], uvs optional, cols optional
export class TriBuilder {
  constructor() { this.p = []; this.uv = []; this.c = []; }
  tri(a, b, c, ua = [0, 0], ub = [0, 0], uc = [0, 0], col = [1, 1, 1], colB = null, colC = null) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    const cb = colB || col, cc = colC || col;
    this.c.push(col[0], col[1], col[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }
  quad(a, b, c, d, ua, ub, uc, ud, col, colB, colC, colD) { // a-b-c-d counter-clockwise
    this.tri(a, b, c, ua, ub, uc, col, colB, colC);
    this.tri(a, c, d, ua, uc, ud, col, colC, colD);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

// Bake a group of meshes (world placed) into one mesh per material
export function bakeGroup(root, name) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((m) => {
    if (!m.isMesh) return;
    let g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    g.applyMatrix4(m.matrixWorld);
    if (m.matrixWorld.determinant() < 0) flipWinding(g);
    const key = m.material.uuid + '|' + m.castShadow + '|' + m.receiveShadow;
    if (!groups.has(key)) groups.set(key, { material: m.material, cast: m.castShadow, receive: m.receiveShadow, geos: [] });
    groups.get(key).geos.push(g);
  });
  return [...groups.values()].map((it) => {
    const m = new THREE.Mesh(mergeGeos(it.geos), it.material);
    m.castShadow = it.cast; m.receiveShadow = it.receive; m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  });
}
function flipWinding(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], s = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
  }
}

// ---------------------------------------------------------------- instancing in spatial cells
// items: [{x,y,z, ry, s, sy?, rx?, rz?, col:[r,g,b]?}] -> list of InstancedMesh (one per cell), each positioned at its cell
// centre so three.js sorts them front-to-back and frustum-culls them (also for the shadow pass).
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function instancedCells(name, geo, material, items, { cell = 24, cast = true, receive = true, depthMat = null } = {}) {
  const cells = new Map();
  for (const it of items) {
    const key = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  const out = [];
  for (const list of cells.values()) {
    let cx = 0, cz = 0; for (const it of list) { cx += it.x; cz += it.z; } cx /= list.length; cz /= list.length;
    const im = new THREE.InstancedMesh(geo, material, list.length);
    im.name = name; im.castShadow = cast; im.receiveShadow = receive;
    if (depthMat) im.customDepthMaterial = depthMat;
    im.position.set(cx, 0, cz);
    const hasCol = list.some((it) => it.col);
    list.forEach((it, i) => {
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'); _q.setFromEuler(_e);
      _s.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
      _p.set(it.x - cx, it.y || 0, it.z - cz);
      _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
      if (hasCol) im.setColorAt(i, new THREE.Color(...(it.col || [1, 1, 1])));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.computeBoundingBox();
    im.userData.items = list; im.userData.center = [cx, cz];
    out.push(im);
  }
  return out;
}

// world-space UV for a canvas texture covering [x0,x1] x [z0,z1]
export const uvXZ = (x, z, x0, x1, z0, z1) => [(x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0)];
