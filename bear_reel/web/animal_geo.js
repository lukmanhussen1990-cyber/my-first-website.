// Low-poly geometry builders for animals.js only (furry lofts, spikes, ellipsoids, claws, merge with vertex colours).
// All deterministic. Units: metres.
import * as THREE from 'three';
import { hash1, clamp } from './lib.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const basis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

// Quaternion whose local +Y points along `y` and local +Z points as close as possible to `zHint`.
export function frameYZ(y, zHint) {
  const Y = y.clone().normalize();
  let Z = zHint.clone().addScaledVector(Y, -zHint.dot(Y));
  if (Z.lengthSq() < 1e-8) Z = Math.abs(Y.z) < 0.9 ? V(0, 0, 1).addScaledVector(Y, -Y.z) : V(1, 0, 0).addScaledVector(Y, -Y.x);
  Z.normalize();
  const X = V().crossVectors(Y, Z);
  return basis(X, Y, Z);
}
// Quaternion whose local +Z points along `z` and local +Y as close as possible to `yHint`.
export function frameZY(z, yHint) {
  const Z = z.clone().normalize();
  let Y = yHint.clone().addScaledVector(Z, -yHint.dot(Z));
  if (Y.lengthSq() < 1e-8) Y = V(0, 1, 0).addScaledVector(Z, -Z.y);
  Y.normalize();
  const X = V().crossVectors(Y, Z);
  return basis(X, Y, Z);
}

// Non-indexed merge keeping position / uv / color (white when missing).
export function merge(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const p = g.attributes.position, u = g.attributes.uv, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const k = o + i;
      pos[k * 3] = p.getX(i); pos[k * 3 + 1] = p.getY(i); pos[k * 3 + 2] = p.getZ(i);
      if (u) { uv[k * 2] = u.getX(i); uv[k * 2 + 1] = u.getY(i); }
      if (c) { col[k * 3] = c.getX(i); col[k * 3 + 1] = c.getY(i); col[k * 3 + 2] = c.getZ(i); } else { col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 1; }
    }
    o += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Vertex colour: constant [r,g,b] or fn(x,y,z) -> [r,g,b]
export function tint(g, c) {
  const p = g.attributes.position, arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = typeof c === 'function' ? c(p.getX(i), p.getY(i), p.getZ(i)) : c; arr[i * 3] = v[0]; arr[i * 3 + 1] = v[1]; arr[i * 3 + 2] = v[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Loft along +Z through rings {z, x?, y?, w, top, bot}; a = 0 at the top (+Y) turning toward +X.
// n = superellipse exponent (2 ellipse, >2 boxier); jag = random radial roughness (chunky fur facets).
export function loftZ(rings, sides, { n = 2.2, jag = 0, seed = 1, capStart = true, capEnd = true, uv = [1, 1], color = null } = {}) {
  const pos = [], uvs = [], cols = [], idx = [];
  const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);
  rings.forEach((r, i) => {
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2, sx = se(Math.sin(a)), sy = se(Math.cos(a));
      const j = 1 + jag * (hash1((s % sides) * 13.7 + i * 71.3 + seed * 5.1) - 0.5) * 2 * (r.jag ?? 1);
      const x = sx * r.w * j + (r.x || 0), y = (sy >= 0 ? sy * r.top : sy * r.bot) * j + (r.y || 0);
      pos.push(x, y, r.z);
      uvs.push((s / sides) * uv[0], r.z * uv[1]);
      const c = color ? color(x, y, r.z, a, i) : [1, 1, 1];
      cols.push(c[0], c[1], c[2]);
    }
  });
  const row = sides + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const addCap = (ri, start) => {
    const r = rings[ri], ci = pos.length / 3;
    pos.push(r.x || 0, r.y || 0, r.z); uvs.push(0.5, r.z * uv[1]);
    const c = color ? color(r.x || 0, r.y || 0, r.z, 0, ri, true) : [1, 1, 1];
    cols.push(c[0], c[1], c[2]);
    for (let s = 0; s < sides; s++) { const a = ri * row + s, b = a + 1; if (start) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(rings.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  const ni = g.toNonIndexed();
  ni.computeVertexNormals();
  return ni;
}

// Limb segment along +Y from 0 to len (loft rotated): rings {t (0..1), w (half width, X), back, front (half depths), x?, z?}.
// Front of the limb = +Z.
export function limbY(len, rings, sides = 7, o = {}) {
  const g = loftZ(rings.map((r) => ({ z: r.t * len, w: r.w, top: r.back, bot: r.front ?? r.back, x: r.x || 0, y: -(r.z || 0), jag: r.jag })), sides, o);
  // loft is along +Z with "top" = +Y. Rotate so the loft axis becomes +Y and loft +Y becomes -Z (back of the limb).
  g.rotateX(-Math.PI / 2);
  return g;
}

// Chunky fur spike / tuft: pyramid with its base at `base`, pointing along `dir`. Base sunk `sink` of its length.
export function spike(base, dir, len, r, { sides = 4, rot = 0, sink = 0.3, color = null, flat = 1 } = {}) {
  const g = new THREE.ConeGeometry(r, len, sides, 1);
  g.scale(1, 1, flat);
  g.rotateY(rot);
  g.translate(0, len / 2 - len * sink, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(...dir).normalize());
  g.applyQuaternion(q);
  g.translate(...base);
  const ng = g.toNonIndexed();
  if (color) {
    // colour by height along the spike: root colour -> tip colour
    const p = ng.attributes.position, arr = new Float32Array(p.count * 3), b = V(...base), d = V(...dir).normalize();
    for (let i = 0; i < p.count; i++) {
      const k = clamp(V(p.getX(i), p.getY(i), p.getZ(i)).sub(b).dot(d) / len);
      const c = typeof color === 'function' ? color(k) : color;
      arr.set(c, i * 3);
    }
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return ng;
}

// Low-poly ellipsoid with an optional per-vertex deform(x,y,z on the unit sphere) -> [X,Y,Z]
export function ellipsoid(rx, ry, rz, w = 10, h = 8, deform = null) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (deform) { const [X, Y, Z] = deform(x, y, z); p.setXYZ(i, X, Y, Z); } else p.setXYZ(i, x * rx, y * ry, z * rz);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

// z of the frontmost surface of a (non-indexed) geometry at x,y (raycast from +Z)
export function frontZ(geo, x, y, from = 5) {
  const P = geo.attributes.position;
  const ray = new THREE.Ray(V(x, y, from), V(0, 0, -1));
  const a = V(), b = V(), c = V(), hit = V();
  let best = -Infinity;
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    if (ray.intersectTriangle(a, b, c, false, hit)) best = Math.max(best, hit.z);
  }
  return best;
}
// surface point of a geometry along a ray from `origin` in direction `dir` (first hit), or null
export function rayHit(geo, origin, dir) {
  const P = geo.attributes.position;
  const ray = new THREE.Ray(origin.clone(), dir.clone().normalize());
  const a = V(), b = V(), c = V(), hit = V();
  let best = null, bd = Infinity;
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    if (ray.intersectTriangle(a, b, c, false, hit)) { const d = hit.distanceTo(origin); if (d < bd) { bd = d; best = hit.clone(); } }
  }
  return best;
}

// Curved claw: a tapered 4-sided tube bending downward along +Z from the origin.
export function clawGeo(len, r, bend = 0.9, sides = 4) {
  const rings = [], n = 4, R = len / Math.max(bend, 1e-3);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = bend * t, k = 1 - t * 0.88;
    rings.push({ z: R * Math.sin(a), y: -R * (1 - Math.cos(a)), w: r * k, top: r * k, bot: r * k * 0.85 });
  }
  return loftZ(rings, sides, { n: 2, capStart: true, capEnd: true });
}

// Thin polyline made of boxes (for closed-eye lines etc.), pts [[x,y],...] in a plane at z
export function polyline(pts, thick, depth, z = 0) {
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const g = new THREE.BoxGeometry(len + thick * 0.9, thick, depth);
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    parts.push(g);
  }
  return merge(parts);
}
