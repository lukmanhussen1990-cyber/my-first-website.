// Geometry helpers: a tiny triangle builder, prisms with metric UVs, lofts, merging.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class GB {
  constructor(withColor = false) { this.p = []; this.n = []; this.u = []; this.c = withColor ? [] : null; }
  vert(p, n, uv, col) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.u.push(uv[0], uv[1]);
    if (this.c) this.c.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1);
  }
  // triangle with flat normal, auto-oriented to face `face` direction if given
  tri(a, b, c, ua, ub, uc, face = null, col = null) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (face && n.dot(face) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n.negate(); }
    n.normalize();
    this.vert(a, n, ua, col); this.vert(b, n, ub, col); this.vert(c, n, uc, col);
  }
  quad(a, b, c, d, ua, ub, uc, ud, face = null, col = null) {
    this.tri(a, b, c, ua, ub, uc, face, col);
    this.tri(a, c, d, ua, uc, ud, face, col);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Vertical prism from a 2D footprint [[x,z],...] between y0..y1. UVs in "tile" units.
// opts: tileW, tileH, offU, offV, cap ('top'|'none'|'both'), capTile
export function prism(gb, poly, y0, y1, opts = {}) {
  const tw = opts.tileW || 1, th = opts.tileH || 1, ou = opts.offU || 0, ov = opts.offV || 0;
  const n = poly.length;
  let cx = 0, cz = 0; poly.forEach((p) => { cx += p[0]; cz += p[1]; }); cx /= n; cz /= n;
  let per = 0;
  if (opts.sides !== false) {
    for (let i = 0; i < n; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % n];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const mid = V((p0[0] + p1[0]) / 2 - cx, 0, (p0[1] + p1[1]) / 2 - cz);
      const out = V(p1[1] - p0[1], 0, -(p1[0] - p0[0])); if (out.dot(mid) < 0) out.negate();
      const u0 = per / tw + ou, u1 = (per + len) / tw + ou;
      const v0 = y0 / th + ov, v1 = y1 / th + ov;
      gb.quad(V(p0[0], y0, p0[1]), V(p1[0], y0, p1[1]), V(p1[0], y1, p1[1]), V(p0[0], y1, p0[1]),
        [u0, v0], [u1, v0], [u1, v1], [u0, v1], out, opts.color);
      per += len;
    }
  }
  const cap = opts.cap || 'top';
  if (cap === 'top' || cap === 'both') {
    const ct = opts.capTile || 6;
    const tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const t of tris) {
      const a = poly[t[0]], b = poly[t[1]], c = poly[t[2]];
      gb.tri(V(a[0], y1, a[1]), V(b[0], y1, b[1]), V(c[0], y1, c[1]), [a[0] / ct, a[1] / ct], [b[0] / ct, b[1] / ct], [c[0] / ct, c[1] / ct], V(0, 1, 0), opts.capColor || opts.color);
    }
  }
  return per;
}

export function rectPoly(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
export function chamferPoly(x0, z0, x1, z1, c) {
  return [[x0 + c, z0], [x1 - c, z0], [x1, z0 + c], [x1, z1 - c], [x1 - c, z1], [x0 + c, z1], [x0, z1 - c], [x0, z0 + c]];
}
export function circlePoly(cx, cz, r, seg = 20) {
  const p = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return p;
}

// horizontal rectangle (y up) with metric uv
export function hrect(gb, x0, z0, x1, z1, y, tile = 1, offU = 0, offV = 0) {
  gb.quad(V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1),
    [x0 / tile + offU, z0 / tile + offV], [x1 / tile + offU, z0 / tile + offV], [x1 / tile + offU, z1 / tile + offV], [x0 / tile + offU, z1 / tile + offV], V(0, 1, 0));
}

export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  if (!list.length) return null;
  // align attributes
  const hasColor = list.some((g) => g.getAttribute('color'));
  for (const g of list) {
    if (hasColor && !g.getAttribute('color')) {
      const n = g.getAttribute('position').count; const c = new Float32Array(n * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  }
  return mergeGeometries(list, false);
}

// apply a matrix to a cloned geometry
export function xf(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
  g.applyMatrix4(m);
  return g;
}

// paint a constant vertex colour onto a geometry
export function tint(geo, rgb) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count; const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// vertical gradient vertex colour (fake AO / sky light)
export function gradientTint(geo, y0, y1, c0, c1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position'); const n = pos.count; const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    for (let k = 0; k < 3; k++) c[i * 3 + k] = c0[k] + (c1[k] - c0[k]) * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
