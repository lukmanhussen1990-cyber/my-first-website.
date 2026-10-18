// Geometry helpers for the Jesus character (lofts, smooth tables, skin attributes, merging).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BONE_NAMES } from '../core/rig.js';

export const BI = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));

// Smooth (cubic Hermite, Catmull-Rom tangents) interpolation over a table [[x, v], ...] sorted by x.
export function makeTable(pts) {
  const n = pts.length;
  const slope = (i) => {
    if (i <= 0) return (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]);
    if (i >= n - 1) return (pts[n - 1][1] - pts[n - 2][1]) / (pts[n - 1][0] - pts[n - 2][0]);
    return (pts[i + 1][1] - pts[i - 1][1]) / (pts[i + 1][0] - pts[i - 1][0]);
  };
  const m = pts.map((_, i) => slope(i));
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 1;
    while (pts[i][0] < x) i++;
    const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
    const h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m[i];
  };
}

export const gauss2 = (dx, dy) => Math.exp(-(dx * dx + dy * dy));

// Grid surface. fn(u, v, i, j) -> [x, y, z]; u in [0,1] (nu segments), v in [0,1] (nv segments).
// Winding assumes increasing u then v gives an outward normal (u x v points outward); pass flip to invert.
// wrapU: the u=0 and u=1 columns coincide -> their normals are averaged (no seam).
export function gridGeometry(nu, nv, fn, { flip = false, wrapU = true, uv = null, poleNormals = null, keepFace = null } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uvs = new Float32Array((nu + 1) * (nv + 1) * 2);
  let k = 0, q = 0;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i / nu, j / nv, i, j);
    pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
    const t = uv ? uv(i / nu, j / nv, p) : [i / nu, j / nv];
    uvs[q++] = t[0]; uvs[q++] = t[1];
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (keepFace && !keepFace(i, j, [a, b, c, d])) continue;
    if (flip) idx.push(a, d, b, a, c, d); else idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  if (wrapU) {
    for (let j = 0; j <= nv; j++) {
      const a = j * (nu + 1), b = a + nu;
      const v = new THREE.Vector3(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
      nrm.setXYZ(a, v.x, v.y, v.z); nrm.setXYZ(b, v.x, v.y, v.z);
    }
  }
  if (poleNormals) {
    for (const [j, n] of poleNormals) for (let i = 0; i <= nu; i++) nrm.setXYZ(j * (nu + 1) + i, n[0], n[1], n[2]);
  }
  return g;
}

// Average normals of vertices that share the same position (removes seams after merging/duplication).
export function weldNormals(g, eps = 1e-5) {
  const p = g.attributes.position, n = g.attributes.normal;
  const map = new Map();
  const key = (i) => `${Math.round(p.getX(i) / eps)},${Math.round(p.getY(i) / eps)},${Math.round(p.getZ(i) / eps)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  const v = new THREE.Vector3();
  for (const list of map.values()) {
    if (list.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of list) v.x += n.getX(i), v.y += n.getY(i), v.z += n.getZ(i);
    v.normalize();
    for (const i of list) n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

// Constant vertex colour attribute.
export function setColor(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Skin attributes from a weight function wf(x, y, z) -> {boneIndex: weight}. Keeps the 4 largest, normalised.
export function setSkin(g, wf) {
  const p = g.attributes.position;
  const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const w = wf(p.getX(i), p.getY(i), p.getZ(i), i);
    const ent = Object.entries(w).map(([b, v]) => [+b, v]).filter((e) => e[1] > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = ent.reduce((s, e) => s + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      si[i * 4 + k] = ent[k] ? ent[k][0] : 0;
      sw[i * 4 + k] = ent[k] ? ent[k][1] / sum : 0;
    }
    if (!ent.length) sw[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}

// Rigid skin: all vertices on one bone.
export const rigidSkin = (g, bone) => setSkin(g, () => ({ [BI[bone]]: 1 }));

// Add a float attribute computed per vertex.
export function setAttr(g, name, fn, itemSize = 1) {
  const p = g.attributes.position;
  const a = new Float32Array(p.count * itemSize);
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i), i);
    if (itemSize === 1) a[i] = v; else for (let k = 0; k < itemSize; k++) a[i * itemSize + k] = v[k];
  }
  g.setAttribute(name, new THREE.BufferAttribute(a, itemSize));
  return g;
}

// Merge geometries that may have different attribute sets: keeps only attributes common to all;
// converts all to indexed.
export function merge(list) {
  const geos = list.filter(Boolean).map((g) => (g.index ? g : indexify(g)));
  const names = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => g.attributes[n]));
  const clean = geos.map((g) => {
    const c = new THREE.BufferGeometry();
    for (const n of names) c.setAttribute(n, g.attributes[n]);
    c.setIndex(g.index);
    return c;
  });
  return mergeGeometries(clean, false);
}

function indexify(g) {
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}

// Mirror a geometry across X (fixes winding).
export function mirrorX(g) {
  const m = g.clone();
  m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  m.index.needsUpdate = true;
  return m;
}

// Superellipsoid blob: centre c, half-extents r, exponents (e1 vertical, e2 horizontal; 1 = ellipsoid, <1 boxier).
export function superEllipsoid(r, c = [0, 0, 0], { e1 = 1, e2 = 1, wSeg = 16, hSeg = 10 } = {}) {
  const sp = (w, e) => Math.sign(w) * Math.pow(Math.abs(w), e);
  const g = gridGeometry(wSeg, hSeg, (u, v) => {
    const th = u * Math.PI * 2, ph = -Math.PI / 2 + v * Math.PI;
    const cp = sp(Math.cos(ph), e1), spv = sp(Math.sin(ph), e1);
    return [c[0] + r[0] * cp * sp(Math.sin(th), e2), c[1] + r[1] * spv, c[2] + r[2] * cp * sp(Math.cos(th), e2)];
  }, { poleNormals: [[0, [0, -1, 0]], [hSeg, [0, 1, 0]]] });
  return g;
}

// Tube along a polyline with per-point radius (rx, rz) and frame normal; closed ends optional.
// pts: [{p: Vector3, rx, rz, side?: Vector3}]; seg: radial segments.
export function loftTube(pts, seg = 10, { capStart = true, capEnd = true } = {}) {
  const n = pts.length;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3().subVectors(pts[Math.min(n - 1, i + 1)].p, pts[Math.max(0, i - 1)].p).normalize();
    let side = pts[i].side ? pts[i].side.clone() : new THREE.Vector3(1, 0, 0);
    side.addScaledVector(t, -side.dot(t)).normalize();
    const up = new THREE.Vector3().crossVectors(t, side).normalize();
    frames.push({ t, side, up });
  }
  const g = gridGeometry(seg, n - 1, (u, v, i, j) => {
    const a = u * Math.PI * 2, P = pts[j], f = frames[j];
    const q = P.p.clone().addScaledVector(f.side, Math.sin(a) * P.rx).addScaledVector(f.up, Math.cos(a) * P.rz);
    return [q.x, q.y, q.z];
  }, { flip: true });
  const parts = [g];
  // caps: fan to the end point
  const cap = (j, dir) => {
    const P = pts[j], f = frames[j];
    const c = P.p.clone().addScaledVector(f.t, dir * Math.min(P.rx, P.rz) * 0.6);
    const pos = [c.x, c.y, c.z], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const q = P.p.clone().addScaledVector(f.side, Math.sin(a) * P.rx).addScaledVector(f.up, Math.cos(a) * P.rz);
      pos.push(q.x, q.y, q.z);
    }
    for (let i = 0; i < seg; i++) if (dir > 0) idx.push(0, i + 2, i + 1); else idx.push(0, i + 1, i + 2);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((seg + 2) * 2).fill(0.5), 2));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    return cg;
  };
  if (capStart) parts.push(cap(0, -1));
  if (capEnd) parts.push(cap(n - 1, 1));
  return merge(parts);
}
