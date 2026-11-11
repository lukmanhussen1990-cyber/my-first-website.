// Shared helpers: math, easing, seeded noise, canvas textures, geometry builders.
import * as THREE from 'three';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ss = (a, b, x) => smooth((x - a) / (b - a));          // smoothstep a..b
export const lin = (a, b, x) => clamp((x - a) / (b - a));           // linear ramp a..b
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export const easeOut = (t) => { t = 1 - clamp(t); return 1 - t * t * t; };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t, s = 1.70158) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
// springy settle: overshoots then rings down to 1
export const spring = (t, freq = 3.2, damp = 5.5) => { if (t <= 0) return 0; return 1 - Math.exp(-damp * t) * Math.cos(freq * Math.PI * 2 * t * 0.5); };
export const pulse = (a, b, x, edge = 0.1) => ss(a, a + edge, x) * (1 - ss(b - edge, b, x));
export const TAU = Math.PI * 2;
export const deg = (d) => d * Math.PI / 180;

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hash3(x, y, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), u), x10 = lerp(h(0, 1, 0), h(1, 1, 0), u);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), u), x11 = lerp(h(0, 1, 1), h(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;      // -1..1
}
export function fbm(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
// smooth 1-D wobble for idle motion (deterministic in t)
export const wob = (t, seed = 0, speed = 1) => noise3(t * speed, seed * 17.13, seed * 3.7);

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  return t;
}
// fill canvas with tileable-ish value noise between two colours + speckles
export function noiseFill(g, w, h, c0, c1, scale = 8, oct = 4, seed = 1) {
  const img = g.createImageData(w, h); const d = img.data;
  const A = new THREE.Color(c0), B = new THREE.Color(c1);
  A.convertLinearToSRGB(); B.convertLinearToSRGB();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // tile by blending wrapped coordinates
    const u = x / w, v = y / h;
    const n = tileNoise(u, v, scale, oct, seed) * 0.5 + 0.5;
    const i = (y * w + x) * 4;
    d[i] = lerp(A.r, B.r, n) * 255; d[i + 1] = lerp(A.g, B.g, n) * 255; d[i + 2] = lerp(A.b, B.b, n) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
export function tileNoise(u, v, scale, oct, seed) {
  // 4-corner blend for seamless tiling
  const f = (a, b) => fbm(a * scale, b * scale, seed * 9.7, oct);
  const a = f(u, v), b = f(u - 1, v), c = f(u, v - 1), d = f(u - 1, v - 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 1.5;
}

// ---------- geometry builders ----------
const sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** Loft through elliptical rings. ring: {c:[x,y,z], rx, rz, pw (superellipse 2=ellipse, >2 boxier), f:(theta)=>radial scale}
 *  axis: rings are stacked along Y by default (ring plane = XZ).  theta=0 -> +Z (front), theta=PI/2 -> +X.
 *  Returns geometry with attribute 'ring' (float index along rings) for skinning. */
export function loft(rings, radial = 24, { capTop = true, capBottom = true } = {}) {
  const pos = [], uv = [], ringAttr = [], idx = [];
  const n = rings.length;
  let vlen = 0; const vs = [0];
  for (let i = 1; i < n; i++) { const a = rings[i - 1].c, b = rings[i].c; vlen += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); vs.push(vlen); }
  for (let i = 0; i < n; i++) {
    const r = rings[i]; const p = 2 / (r.pw || 2);
    for (let j = 0; j <= radial; j++) {
      const th = j / radial * TAU; const s = Math.sin(th), c = Math.cos(th);
      const k = r.f ? r.f(th) : 1;
      let x = r.rx * sp(s, p) * k, z = (c >= 0 ? (r.rzf ?? r.rz) : (r.rzb ?? r.rz)) * sp(c, p) * k, y = 0;
      if (r.tilt) { y = -z * Math.sin(r.tilt); z = z * Math.cos(r.tilt); }      // tilt ring about X
      pos.push(r.c[0] + x, r.c[1] + y, r.c[2] + z);
      uv.push(j / radial, vs[i] / (vlen || 1));
      ringAttr.push(i);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, d, a, d, c);                // CCW seen from outside when rings ascend in +Y
  }
  const cap = (ri, top) => {
    const r = rings[ri]; const base = pos.length / 3;
    pos.push(r.c[0], r.c[1] + (r.capH || 0) * (top ? 1 : -1), r.c[2]); uv.push(0.5, top ? 1 : 0); ringAttr.push(ri);
    for (let j = 0; j < radial; j++) { const a = ri * row + j, b = a + 1; if (top) idx.push(a, b, base); else idx.push(b, a, base); }
  };
  const asc = rings[n - 1].c[1] >= rings[0].c[1];
  if (!asc) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  if (capTop) cap(n - 1, asc);
  if (capBottom) cap(0, !asc);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('ring', new THREE.Float32BufferAttribute(ringAttr, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixSeamNormals(g, radial, n);
  return g;
}
function fixSeamNormals(g, radial, n) {
  const nrm = g.attributes.normal; const row = radial + 1;
  for (let i = 0; i < n; i++) {
    const a = i * row, b = a + radial;
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
  }
}

/** Tube along a polyline of Vector3 (already smooth). rad: number | (u)=>number | (u)=>[rx,ry]. */
export function tube(points, rad, radial = 10, { caps = true, uvScale = 1, normals = null } = {}) {
  const n = points.length; const pos = [], uv = [], idx = [];
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const t = V3().subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]).normalize(); T.push(t);
  }
  let nrm = V3(0, 1, 0); if (Math.abs(T[0].dot(nrm)) > 0.9) nrm = V3(1, 0, 0);
  nrm = nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize();
  for (let i = 0; i < n; i++) {
    if (normals) nrm = normals[i].clone();                       // caller-supplied frame (e.g. radial for hair locks)
    nrm = nrm.clone().sub(T[i].clone().multiplyScalar(nrm.dot(T[i]))).normalize();
    N.push(nrm.clone()); B.push(V3().crossVectors(T[i], nrm).normalize());
  }
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1); let r = typeof rad === 'function' ? rad(u) : rad; const rx = Array.isArray(r) ? r[0] : r, ry = Array.isArray(r) ? r[1] : r;
    for (let j = 0; j <= radial; j++) {
      const th = j / radial * TAU; const c = Math.cos(th) * rx, s = Math.sin(th) * ry;
      pos.push(points[i].x + N[i].x * c + B[i].x * s, points[i].y + N[i].y * c + B[i].y * s, points[i].z + N[i].z * c + B[i].z * s);
      uv.push(j / radial, u * uvScale);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * row + j, b = a + 1, c = a + row, d = c + 1; idx.push(a, d, c, a, b, d); }
  if (caps) {
    for (const [ri, flip] of [[0, false], [n - 1, true]]) {
      const base = pos.length / 3; pos.push(points[ri].x, points[ri].y, points[ri].z); uv.push(0.5, ri ? 1 : 0);
      for (let j = 0; j < radial; j++) { const a = ri * row + j, b = a + 1; if (flip) idx.push(a, b, base); else idx.push(b, a, base); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // seam normals
  const nr = g.attributes.normal;
  for (let i = 0; i < n; i++) { const a = i * row, b = a + radial; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b); const l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }
  return g;
}
export function curvePts(ctrl, n = 24, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(p => Array.isArray(p) ? V3(...p) : p), false, 'catmullrom', tension);
  return c.getPoints(n);
}

/** Lumpy boulder / blob: displaced icosphere with smooth normals. */
export function blobGeo(r = 1, detail = 3, seed = 1, amp = 0.25, freq = 1.2, squash = [1, 1, 1]) {
  const g0 = new THREE.IcosahedronGeometry(1, detail);
  const g = mergeVerts(g0);
  const p = g.attributes.position; const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = 1 + amp * fbm(v.x * freq + seed * 5.1, v.y * freq + seed * 1.7, v.z * freq - seed * 3.3, 3) + amp * 0.35 * noise3(v.x * freq * 3.1, v.y * freq * 3.1 + seed, v.z * freq * 3.1);
    p.setXYZ(i, v.x * d * r * squash[0], v.y * d * r * squash[1], v.z * d * r * squash[2]);
  }
  g.computeVertexNormals();
  // spherical-ish UVs
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv[i * 2] = (Math.atan2(v.x, v.z) / TAU + 0.5) * 2; uv[i * 2 + 1] = v.y / (r * 2) + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export function mergeVerts(g, tol = 1e-4) {
  const p = g.attributes.position; const map = new Map(); const np = [], idx = [];
  const key = (x, y, z) => `${Math.round(x / tol)}_${Math.round(y / tol)}_${Math.round(z / tol)}`;
  const src = g.index ? g.index.array : null; const cnt = src ? src.length : p.count;
  for (let i = 0; i < cnt; i++) {
    const vi = src ? src[i] : i; const x = p.getX(vi), y = p.getY(vi), z = p.getZ(vi); const k = key(x, y, z);
    let j = map.get(k); if (j === undefined) { j = np.length / 3; np.push(x, y, z); map.set(k, j); }
    idx.push(j);
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); o.setIndex(idx); o.computeVertexNormals();
  return o;
}
export function mesh(geo, mat, { cast = true, receive = true, pos, rot, scale, name } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive;
  if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot);
  if (scale !== undefined) { if (Array.isArray(scale)) m.scale.set(...scale); else m.scale.setScalar(scale); }
  if (name) m.name = name;
  return m;
}
export function group(children = [], { pos, rot, scale, name } = {}) {
  const g = new THREE.Group(); children.forEach(c => c && g.add(c));
  if (pos) g.position.set(...pos); if (rot) g.rotation.set(...rot);
  if (scale !== undefined) { if (Array.isArray(scale)) g.scale.set(...scale); else g.scale.setScalar(scale); }
  if (name) g.name = name;
  return g;
}
export const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
