// Helpers for set.js only (geometry utilities, static batching, baked colours). Deterministic.
import * as THREE from 'three';
import { rng, canvas, clamp } from './lib.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Box-projected UVs in world units (tile = metres per texture repeat). Returns a non-indexed geometry.
export function worldUV(geo, tile = 1, tileV = tile) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tileV;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Per-face baked colour (for the unlit exterior + vertex-coloured bits): returns non-indexed geometry with 'color'.
export function bakeColors(geo, hex, { sun = [0.5, 0.75, 0.6], amb = 0.6, jitter = 0.05, seed = 1, palette = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const n = g.attributes.normal, c = new Float32Array(n.count * 3), R = rng(seed);
  const s = V(...sun).normalize();
  const cols = (palette || [hex]).map((h) => new THREE.Color(h));
  for (let i = 0; i < n.count; i += 3) {
    const d = Math.max(0, n.getX(i) * s.x + n.getY(i) * s.y + n.getZ(i) * s.z);
    const k = (amb + (1 - amb) * d) * (1 + (R() - 0.5) * jitter * 2);
    const base = cols[Math.floor(R() * cols.length) % cols.length];
    for (let j = 0; j < 3; j++) { c[(i + j) * 3] = base.r * k; c[(i + j) * 3 + 1] = base.g * k; c[(i + j) * 3 + 2] = base.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Constant vertex colour (so geometries with/without colour can be merged into one vertex-coloured mesh)
export function tint(geo, hex, jitter = 0, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(hex), R = rng(seed);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (R() - 0.5) * jitter * 2;
    for (let j = 0; j < 3 && i + j < n; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Merge geometries (already in the same space) into one non-indexed BufferGeometry.
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
    if (col) { if (g.attributes.color && g.attributes.color.itemSize === 3) col.set(g.attributes.color.array.subarray(0, n * 3), o * 3); else col.fill(1, o * 3, (o + n) * 3); }
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

// Geometry of a mesh tree baked into the root's space (handles mirrored transforms).
export function bakeTree(root, filter = null) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((m) => {
    if (!m.isMesh || (filter && !filter(m))) return;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    let g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    g.applyMatrix4(mtx);
    if (mtx.determinant() < 0) flipWinding(g);
    const key = m.material.uuid + '|' + m.castShadow + '|' + m.receiveShadow;
    if (!groups.has(key)) groups.set(key, { material: m.material, cast: m.castShadow, receive: m.receiveShadow, geos: [] });
    groups.get(key).geos.push(g);
  });
  return [...groups.values()];
}
function flipWinding(g) {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], s = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
  }
}

// Replace a tree of meshes by one merged mesh per material (draw-call reduction). Returns a Group.
export function flatten(root, name = '') {
  const out = new THREE.Group(); out.name = name;
  out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  const saved = root.matrix.clone();
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1); root.updateMatrix();
  for (const it of bakeTree(root)) {
    const m = new THREE.Mesh(mergeGeos(it.geos), it.material);
    m.castShadow = it.cast; m.receiveShadow = it.receive; m.name = name; out.add(m);
  }
  root.matrix.copy(saved); root.matrix.decompose(root.position, root.quaternion, root.scale);
  return out;
}

// Static batch: add finished meshes/groups (world placed), build() merges by material into `parent`.
export class Batch {
  constructor() { this.root = new THREE.Group(); }
  add(...objs) { for (const o of objs) this.root.add(o); return objs[0]; }
  build(parent, name = 'static') {
    const groups = bakeTree(this.root);
    for (const it of groups) {
      const m = new THREE.Mesh(mergeGeos(it.geos), it.material);
      m.castShadow = it.cast; m.receiveShadow = it.receive; m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
      parent.add(m);
    }
    return groups.length;
  }
}

// 1-px-wide vertical band texture for lathe profiles: colors[k] paints profile segment k.
export function bandTex(colors) {
  const n = colors.length, c = canvas(1, n), x = c.getContext('2d');
  for (let k = 0; k < n; k++) { x.fillStyle = colors[k]; x.fillRect(0, n - 1 - k, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// Lathe from [[r,y],...] (counter-clockwise in (r,y): along the bottom outward, up the outside, back in along the top)
export function latheGeo(profile, sides = 16, phi = 0, len = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), sides, phi, len);
}

// Polar disc (rings x segs) for animated liquid surfaces; returns geometry with userData.r0 (rest radii)
export function polarDisc(radius, rings = 4, segs = 16) {
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2, rr = (r / rings) * radius;
    pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
    const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = 1 + r * segs + s, d = 1 + r * segs + ((s + 1) % segs);
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData.rest = Float32Array.from(pos);
  return g;
}

// Maple-ish leaf outline in the XZ plane (pointing +Z), size ~1, lying flat (y=0). Slight fold along the midrib.
export function leafGeo(size = 0.05, fold = 0.25, kind = 0) {
  const s = new THREE.Shape();
  const pts = kind === 1
    ? [[0, -0.5], [0.22, -0.2], [0.28, 0.15], [0.12, 0.42], [0, 0.55], [-0.12, 0.42], [-0.28, 0.15], [-0.22, -0.2]]   // oval leaf
    : [[0, -0.45], [0.12, -0.2], [0.42, -0.12], [0.3, 0.05], [0.48, 0.25], [0.2, 0.22], [0.14, 0.5], [0, 0.32], [-0.14, 0.5], [-0.2, 0.22], [-0.48, 0.25], [-0.3, 0.05], [-0.42, -0.12], [-0.12, -0.2]];
  s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x * size, Math.abs(x) * fold * size, -y * size); }
  g.computeVertexNormals();
  return g;
}

// Rounded rectangle Shape (x,y plane)
export function roundRect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
export function rectPath(x0, y0, x1, y1, hole = false) {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  if (hole) { p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); }
  else { p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.closePath(); }
  return p;
}

// Horizontal ring (frame) around a rectangle in XZ: outer rect expanded by `embed`, inner by -depth. y0..y1.
export function ringXZ(minX, maxX, minZ, maxZ, depth, embed, y0, y1, curve = 1) {
  const s = rectPath(minX - embed, -(maxZ + embed), maxX + embed, -(minZ - embed));
  s.holes.push(rectPath(minX + depth, -(maxZ - depth), maxX - depth, -(minZ + depth), true));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: curve });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}

// Picture-frame ring in XY (facing +Z): outer w x h, border b, depth d (z from 0 to d)
export function frameXY(w, h, b, d) {
  const s = rectPath(-w / 2, -h / 2, w / 2, h / 2);
  s.holes.push(rectPath(-w / 2 + b, -h / 2 + b, w / 2 - b, h / 2 - b, true));
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: Math.min(0.004, d * 0.3), bevelSize: Math.min(0.004, b * 0.3), bevelSegments: 1 });
}

// Footprint registry on the table top (circles), for placing decor without overlaps.
export class Footprints {
  constructor() { this.c = []; }
  add(x, z, r, tag = '') { this.c.push({ x, z, r, tag }); }
  free(x, z, r, margin = 0.01) { return this.c.every((c) => Math.hypot(c.x - x, c.z - z) >= c.r + r + margin); }
}

// radial gradient canvas (for glows)
export function glowCanvas(size = 64, inner = 'rgba(255,220,150,1)', outer = 'rgba(255,160,60,0)') {
  const c = canvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

export const wrap01 = (x) => x - Math.floor(x);
export const sat = clamp;
