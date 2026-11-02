// Low-poly geometry builders for characters.js only (heads, hair, hands, torso lofts, shoes, glasses).
// All deterministic. Units: metres. Built at "head scale 1" where noted; meshes get scaled by the caller.
import * as THREE from 'three';
import { hash1, clamp, lerp } from './lib.js';
import { FACE } from './char_tex.js';

// ------------------------------------------------------------------ merge (non-indexed, pos/normal/uv)
export function merge(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    const p = g.attributes.position, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(o + i) * 3] = p.getX(i); pos[(o + i) * 3 + 1] = p.getY(i); pos[(o + i) * 3 + 2] = p.getZ(i);
      if (u) { uv[(o + i) * 2] = u.getX(i); uv[(o + i) * 2 + 1] = u.getY(i); }
    }
    o += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// flip triangles of a non-indexed geometry so they face away from `centre` (convex-ish shapes)
export function fixWinding(g, centre = null) {
  const p = g.attributes.position;
  const c = centre || new THREE.Vector3();
  if (!centre) { for (let i = 0; i < p.count; i++) c.add(new THREE.Vector3().fromBufferAttribute(p, i)); c.divideScalar(p.count); }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
    n.subVectors(b, a).cross(m.subVectors(d, a));
    m.copy(a).add(b).add(d).divideScalar(3).sub(c);
    if (n.dot(m) < 0) { p.setXYZ(i + 1, d.x, d.y, d.z); p.setXYZ(i + 2, b.x, b.y, b.z); }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ loft along +Y (torso, pelvis, hair curtains)
// rings: [{y, w, d, z?, x?}] ; superellipse exponent n (2 = ellipse, >2 boxier). Back seam (front centre at u=0.5).
export function loftY(rings, sides = 10, { n = 2.4, capBottom = true, capTop = true } = {}) {
  const pos = [], uv = [], idx = [];
  const y0 = rings[0].y, y1 = rings[rings.length - 1].y;
  const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const sx = -se(Math.sin(a)), sz = -se(Math.cos(a));
      const dz = sz > 0 ? (r.df ?? r.d) : (r.db ?? r.d);
      pos.push(sx * r.w + (r.x || 0), r.y, sz * dz + (r.z || 0));
      uv.push(s / sides, (r.y - y0) / (y1 - y0));
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const cap = (ri, top) => {
    const r = rings[ri], ci = pos.length / 3;
    pos.push(r.x || 0, r.y, r.z || 0); uv.push(0.5, top ? 1 : 0);
    for (let s = 0; s < sides; s++) { const a = ri * row + s, b = a + 1; if (top) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ limb segment along +Y from 0 to len.
// r0 at the start, r1 at the end; flat = z/x radius ratio at the END (x = across, z = thickness).
export function limbGeo(len, r0, r1, sides = 7, { flat0 = 1, flat1 = 1, mid = null } = {}) {
  const rings = [{ y: 0, w: r0, d: r0 * flat0 }];
  if (mid) rings.push({ y: len * mid.at, w: mid.r, d: mid.r * (mid.flat ?? 1) });
  rings.push({ y: len, w: r1, d: r1 * flat1 });
  return loftY(rings, sides, { n: 2 });
}

// ------------------------------------------------------------------ head (unit head scale)
export const HEAD = { rx: 0.078, ry: 0.108, rz: 0.094 };
function deformHead(x, y, z, o) {
  // x,y,z on unit sphere -> head-local metres
  let X = x * HEAD.rx * (o.wide || 1), Y = y * HEAD.ry, Z = z * HEAD.rz;
  if (y < 0.1) { const k = Math.pow(clamp((0.1 - y) / 1.1), 1.35); X *= 1 - (o.jaw ?? 0.3) * k; if (z < 0) Z *= 1 - 0.25 * k; }
  if (z > 0) Z *= 0.93;
  if (z > 0.2 && y < -0.55) Z += 0.008 * (z - 0.2);           // chin forward
  if (z < 0 && y > -0.3) Z *= 1.06;                           // skull back
  if (y > 0.75) { X *= 0.97; }
  if (z > 0.55 && Math.abs(y) < 0.35 && Math.abs(x) > 0.45) Z += 0.004; // cheekbones
  return [X, Y, Z];
}
// Returns geometry with 2 groups: 0 = skin, 1 = face (planar UV from the front).
export function headGeo(o = {}) {
  const sph = new THREE.SphereGeometry(1, 12, 10);
  const p = sph.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [X, Y, Z] = deformHead(p.getX(i), p.getY(i), p.getZ(i), o);
    p.setXYZ(i, X, Y, Z);
  }
  const g0 = sph.toNonIndexed();
  const P = g0.attributes.position, U0 = g0.attributes.uv;
  const tris = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    nrm.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    if (nrm.lengthSq() < 0.5) continue; // degenerate pole tris
    const cy = (a.y + b.y + c.y) / 3;
    const face = nrm.z > 0.32 && cy > FACE.FY0 - 0.01 && cy < FACE.FY1 + 0.03;
    tris.push({ face, v: [a.clone(), b.clone(), c.clone()], uv: [[U0.getX(i), U0.getY(i)], [U0.getX(i + 1), U0.getY(i + 1)], [U0.getX(i + 2), U0.getY(i + 2)]] });
  }
  tris.sort((t1, t2) => (t1.face === t2.face ? 0 : t1.face ? 1 : -1));
  const pos = [], uv = [];
  let nSkin = 0;
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const v = t.v[k];
      pos.push(v.x, v.y, v.z);
      if (t.face) uv.push(0.5 + v.x / (2 * FACE.FX), (v.y - FACE.FY0) / (FACE.FY1 - FACE.FY0));
      else uv.push(t.uv[k][0] * 2, t.uv[k][1]);
    }
    if (!t.face) nSkin++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.addGroup(0, nSkin * 3, 0);
  g.addGroup(nSkin * 3, (tris.length - nSkin) * 3, 1);
  return g;
}
// z of the head surface (unit scale) at x,y (front), by raycasting the geometry
export function frontZ(geo, x, y) {
  const P = geo.attributes.position;
  const ray = new THREE.Ray(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  let best = -1;
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    if (ray.intersectTriangle(a, b, c, false, hit)) best = Math.max(best, hit.z);
  }
  return best;
}

export function noseGeo(o = {}) {
  const L = o.len ?? 0.024, W = o.w ?? 0.013, top = o.top ?? 0.012, bot = o.bot ?? -0.024;
  // pyramid-ish wedge: bridge top, tip, two nostril wings, base points (z=0 is the face surface)
  const v = {
    top: [0, top, 0.0], bridge: [0, top - 0.012, L * 0.45], tip: [0, bot + 0.008, L], under: [0, bot, L * 0.55],
    wl: [W, bot + 0.004, L * 0.25], wr: [-W, bot + 0.004, L * 0.25], bl: [W * 0.7, top - 0.006, -0.004], br: [-W * 0.7, top - 0.006, -0.004],
    ul: [W * 0.9, bot - 0.002, -0.004], ur: [-W * 0.9, bot - 0.002, -0.004],
  };
  const T = [
    ['top', 'br', 'bridge'], ['top', 'bridge', 'bl'], ['bridge', 'br', 'wr'], ['bridge', 'wl', 'bl'], ['bridge', 'wr', 'tip'], ['bridge', 'tip', 'wl'],
    ['tip', 'wr', 'under'], ['tip', 'under', 'wl'], ['wr', 'ur', 'under'], ['wl', 'under', 'ul'], ['br', 'ur', 'wr'], ['bl', 'wl', 'ul'],
  ];
  const pos = [];
  for (const t of T) for (const k of t) pos.push(...v[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2));
  return fixWinding(g, new THREE.Vector3(0, (top + bot) / 2, -0.01));
}

export function earGeo(side) {
  const g = new THREE.SphereGeometry(1, 6, 5);
  g.scale(0.011, 0.028, 0.018);
  g.translate(side * 0.004, 0, 0);
  return g;
}

// ------------------------------------------------------------------ hair shells
// Shell over the head (unit scale) keeping triangles where keep(nx,ny,nz) is true; thick = offset, chunk = noise.
export function hairShell(keep, { thick = 0.014, chunk = 0.006, seed = 1, wSeg = 12, hSeg = 9, scaleY = 1, back = 0, o = {} } = {}) {
  const sph = new THREE.SphereGeometry(1, wSeg, hSeg);
  const p = sph.attributes.position, nrm = sph.attributes.normal;
  const un = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    un.push([x, y, z]);
    const [X, Y, Z] = deformHead(x, y, z, o);
    const len = Math.hypot(X, Y, Z) || 1;
    // deterministic chunk per (rounded) position so seam duplicates move together
    const hk = hash1(Math.round(x * 50) * 7.13 + Math.round(y * 50) * 3.71 + Math.round(z * 50) * 1.37 + seed);
    const off = thick + chunk * (hk - 0.3);
    p.setXYZ(i, X + (X / len) * off, Y * scaleY + (Y / len) * off, Z + (Z / len) * off + back * Math.max(0, -z));
  }
  const idx = sph.index.array, ni = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = un[idx[i]], b = un[idx[i + 1]], c = un[idx[i + 2]];
    const nx = (a[0] + b[0] + c[0]) / 3, ny = (a[1] + b[1] + c[1]) / 3, nz = (a[2] + b[2] + c[2]) / 3;
    if (keep(nx, ny, nz)) ni.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  sph.setIndex(ni);
  const g = sph.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
// cone tuft from base point along dir
export function tuft(base, dir, len, r, sides = 4, rot = 0) {
  const g = new THREE.ConeGeometry(r, len, sides, 1);
  g.rotateY(rot);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  g.applyQuaternion(q);
  g.translate(...base);
  return g;
}

// ------------------------------------------------------------------ hands
// Hand local frame: origin at the wrist, +Y toward the fingers, +Z = back of the hand, thumb at thumbSign*X.
export const HAND = { palmL: 0.09, palmW: 0.08, palmT: 0.03, f1: 0.045, f2: 0.04, fT: 0.018, thumb1: 0.042, thumb2: 0.034 };
export function buildHand(material, side, s, name) {
  const ts = side === 'R' ? -1 : 1;
  const H = {};
  const L = HAND.palmL * s, Wd = HAND.palmW * s, T = HAND.palmT * s;
  const grp = new THREE.Group();
  // palm: tapered (thicker at the heel), bottom (palm side) is flat
  const palm = new THREE.BufferGeometry();
  {
    const g = new THREE.BoxGeometry(Wd, L, T, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0 && z > 0) z *= 0.75;                           // thinner at the knuckles (back side)
      if (y < 0) x *= 0.86;                                     // narrower wrist
      if (y > 0 && x * ts < 0) y -= 0.004 * s;                  // pinky side knuckle lower
      p.setXYZ(i, x, y + L / 2, z);
    }
    g.computeVertexNormals();
    palm.copy(g);
  }
  const mk = (geo, nm) => { const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true; m.name = `${name}.${nm}`; return m; };
  const palmM = mk(palm, `hand${side}`);
  grp.add(palmM);
  // finger geometry helpers: boxes with base at y=0
  const fbox = (w, len, t, x) => { const g = new THREE.BoxGeometry(w, len, t); g.translate(x, len / 2, 0); return g; };
  const fT = HAND.fT * s;
  // index finger
  const ix = ts * (Wd / 2 - 0.0095 * s);
  const i1 = new THREE.Group(); i1.position.set(ix, L, 0);
  const i2 = new THREE.Group(); i2.position.set(0, HAND.f1 * s, 0);
  i1.add(mk(fbox(0.017 * s, HAND.f1 * s, fT, 0), `index1${side}`)); i2.add(mk(fbox(0.016 * s, HAND.f2 * s * 0.95, fT * 0.92, 0), `index2${side}`));
  i1.add(i2); grp.add(i1);
  // middle + ring + pinky block
  const bx0 = ts * (Wd / 2 - 0.019 * s);                         // block edge on the thumb side
  const fw = 0.0175 * s, gap = 0.0015 * s;
  const xs = [0, 1, 2].map((k) => bx0 - ts * (fw / 2 + k * (fw + gap)));
  const b1g = merge([fbox(fw, HAND.f1 * s, fT, xs[0]), fbox(fw, HAND.f1 * s * 0.97, fT, xs[1]), fbox(fw * 0.92, HAND.f1 * s * 0.86, fT * 0.95, xs[2])]);
  const b2g = merge([fbox(fw * 0.95, HAND.f2 * s * 1.05, fT * 0.92, xs[0]), fbox(fw * 0.95, HAND.f2 * s, fT * 0.92, xs[1]), fbox(fw * 0.88, HAND.f2 * s * 0.8, fT * 0.85, xs[2])]);
  const b1 = new THREE.Group(); b1.position.set(0, L, 0);
  const b2 = new THREE.Group(); b2.position.set(0, HAND.f1 * s * 0.93, 0);
  b1.add(mk(b1g, `fingers1${side}`)); b2.add(mk(b2g, `fingers2${side}`));
  b1.add(b2); grp.add(b1);
  // separate middle finger, shown only for the 'scissors' pose (the block then curls into a fist)
  const m1 = new THREE.Group(); m1.position.set(xs[0], L, 0);
  const m2 = new THREE.Group(); m2.position.set(0, HAND.f1 * s, 0);
  m1.add(mk(fbox(fw, HAND.f1 * s * 1.02, fT, 0), `middle1${side}`)); m2.add(mk(fbox(fw * 0.95, HAND.f2 * s * 1.05, fT * 0.92, 0), `middle2${side}`));
  m1.add(m2); grp.add(m1); m1.visible = false;
  // thumb
  const t1 = new THREE.Group(); t1.position.set(ts * (Wd / 2 - 0.006 * s), 0.022 * s, -0.004 * s);
  const t2 = new THREE.Group(); t2.position.set(0, HAND.thumb1 * s, 0);
  t1.add(mk(fbox(0.02 * s, HAND.thumb1 * s, 0.019 * s, 0), `thumb1${side}`)); t2.add(mk(fbox(0.018 * s, HAND.thumb2 * s, 0.017 * s, 0), `thumb2${side}`));
  t1.add(t2); grp.add(t1);
  Object.assign(H, { grp, i1, i2, b1, b2, m1, m2, t1, t2, ts, s, L, T, Wd });
  return H;
}
// finger poses: [block1, block2, index1, index2, thumbSpread, thumbOpp, thumbCurl]
export const HAND_POSES = {
  flat: [0.02, 0.0, 0.02, 0.0, 0.55, 0.12, 0.05],
  relaxed: [0.4, 0.45, 0.3, 0.35, 0.35, 0.45, 0.25],
  grip: [1.5, 1.45, 1.42, 1.4, 0.15, 1.15, 0.55],
  fist: [1.62, 1.75, 1.6, 1.7, 0.12, 1.25, 0.7],
  point: [1.62, 1.75, 0.0, 0.05, 0.2, 1.1, 0.5],
  open: [0.0, 0.0, -0.02, 0.0, 0.75, 0.15, 0.0],
  scissors: [1.62, 1.75, 0.0, 0.0, 0.2, 1.15, 0.5],
};
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3();
export function poseHand(H, pose) {
  const a = HAND_POSES[pose] || HAND_POSES.relaxed;
  H.b1.rotation.set(-a[0], 0, 0); H.b2.rotation.set(-a[1], 0, 0);
  H.i1.rotation.set(-a[2], 0, pose === 'scissors' ? H.ts * 0.42 : 0); H.i2.rotation.set(-a[3], 0, 0);
  if (H.m1) { H.m1.visible = pose === 'scissors'; H.m1.rotation.set(0, 0, -H.ts * 0.3); }
  _q1.setFromAxisAngle(_ax.set(0, 0, 1), -H.ts * a[4]);
  _q2.setFromAxisAngle(_ax.set(1, 0, 0), -a[5]);
  H.t1.quaternion.copy(_q1).multiply(_q2);
  H.t2.rotation.set(-a[6], 0, 0);
}
// grip point (where a handle passes through the fist), in hand-local coords
export function gripPoint(H) { return new THREE.Vector3(0, H.L - 0.012 * H.s, -H.T / 2 - 0.011 * H.s); }

// ------------------------------------------------------------------ shoes (origin at the ankle, sole bottom at y = -ankleH)
export function shoeGeo(ankleH, len, kind = 'sneaker') {
  const k = len / 0.26;
  const b = -ankleH + 0.012;
  const hi = kind === 'boot' ? 0.035 : 0;
  const rings = [
    { z: -0.06 * k, w: 0.032, h: 0.03 + hi * 0.5, y: b + 0.03 + hi * 0.5 },
    { z: -0.035 * k, w: 0.04, h: 0.045 + hi, y: b + 0.045 + hi * 0.7 },
    { z: 0.03 * k, w: 0.045, h: 0.04 + hi * 0.6, y: b + 0.04 + hi * 0.3 },
    { z: 0.11 * k, w: 0.046, h: 0.028, y: b + 0.028 },
    { z: 0.165 * k, w: 0.04, h: 0.02, y: b + 0.02 },
    { z: 0.19 * k, w: 0.024, h: 0.012, y: b + 0.012 },
  ];
  const pos = [], idx = [], sides = 8;
  for (const r of rings) for (let s = 0; s <= sides; s++) {
    const a = (s / sides) * Math.PI * 2;
    const cy = Math.cos(a), sy = Math.sin(a);
    pos.push(sy * r.w, r.y + cy * r.h * (cy < 0 ? 1 : 1), r.z);
  }
  const row = sides + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) { const a = i * row + s, bb = a + 1, c = a + row, d = c + 1; idx.push(a, c, bb, bb, c, d); }
  const addCap = (ri, flip) => { const r = rings[ri], ci = pos.length / 3; pos.push(0, r.y, r.z); for (let s = 0; s < sides; s++) { const a = ri * row + s; if (flip) idx.push(ci, a, a + 1); else idx.push(ci, a + 1, a); } };
  addCap(0, true); addCap(rings.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0).map((_, i) => (i % 2 ? pos[Math.floor(i / 2) * 3 + 1] * 8 : pos[Math.floor(i / 2) * 3 + 2] * 8)), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function soleGeo(ankleH, len) {
  const k = len / 0.26;
  const rings = [
    { z: -0.065 * k, w: 0.034 }, { z: -0.03 * k, w: 0.043 }, { z: 0.06 * k, w: 0.047 }, { z: 0.13 * k, w: 0.05 }, { z: 0.18 * k, w: 0.042 }, { z: 0.2 * k, w: 0.026 },
  ];
  const h = 0.016, y0 = -ankleH;
  const pos = [], idx = [];
  // top and bottom outline polygons
  const outline = [];
  for (const r of rings) outline.push([r.w, r.z]);
  for (let i = rings.length - 1; i >= 0; i--) outline.push([-rings[i].w, rings[i].z]);
  const n = outline.length;
  for (const [x, z] of outline) pos.push(x, y0, z);
  for (const [x, z] of outline) pos.push(x, y0 + h, z);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + i, j, n + j, n + i); }
  const cb = pos.length / 3; pos.push(0, y0, 0.06 * k); const ct = cb + 1; pos.push(0, y0 + h, 0.06 * k);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(cb, j, i); idx.push(ct, n + i, n + j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2));
  g.setIndex(idx);
  return fixWinding(g.toNonIndexed());
}

// ------------------------------------------------------------------ glasses (unit head scale), eyes at (+-ex, ey, ez)
export function glassesGeo(ex, ey, ez, { w = 0.04, h = 0.028, t = 0.0035, earZ = -0.02, earX = 0.08 } = {}) {
  const parts = [];
  const bar = (cx, cy, cz, sx, sy, sz) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz); parts.push(g); };
  for (const s of [-1, 1]) {
    const cx = s * ex;
    bar(cx, ey + h / 2, ez, w, t, t); bar(cx, ey - h / 2, ez, w * 0.92, t, t);
    bar(cx + w / 2, ey, ez, t, h, t); bar(cx - w / 2, ey, ez, t, h, t);
    // temple arm back to the ear
    const ax = s * (ex + w / 2), len = Math.hypot(earX - Math.abs(ax), ez - earZ);
    const g = new THREE.BoxGeometry(t * 0.8, t * 0.8, len);
    g.rotateY(Math.atan2(s * (earX - Math.abs(ax)), -(ez - earZ)) - Math.PI);
    g.translate((ax + s * earX) / 2, ey + h * 0.3, (ez + earZ) / 2);
    parts.push(g);
  }
  bar(0, ey + h * 0.18, ez + 0.002, 2 * ex - w, t, t);
  return merge(parts);
}
export function lensGeo(ex, ey, ez, { w = 0.04, h = 0.028 } = {}) {
  const parts = [];
  for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(w - 0.002, h - 0.002); g.translate(s * ex, ey, ez - 0.0005); parts.push(g); }
  return merge(parts);
}
