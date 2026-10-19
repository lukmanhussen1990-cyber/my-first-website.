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

// Axis aligned box subtraction (used to carve the pit and the sump out of the soil block)
export function subtractBox(boxes, c) {
  const out = [];
  for (const b of boxes) {
    if (b.max.x <= c.min.x || b.min.x >= c.max.x || b.max.y <= c.min.y || b.min.y >= c.max.y || b.max.z <= c.min.z || b.min.z >= c.max.z) {
      out.push(b);
      continue;
    }
    const min = b.min.clone(), max = b.max.clone();
    if (min.x < c.min.x) { out.push(new THREE.Box3(min.clone(), V3(c.min.x, max.y, max.z))); min.x = c.min.x; }
    if (max.x > c.max.x) { out.push(new THREE.Box3(V3(c.max.x, min.y, min.z), max.clone())); max.x = c.max.x; }
    if (min.y < c.min.y) { out.push(new THREE.Box3(min.clone(), V3(max.x, c.min.y, max.z))); min.y = c.min.y; }
    if (max.y > c.max.y) { out.push(new THREE.Box3(V3(min.x, c.max.y, min.z), max.clone())); max.y = c.max.y; }
    if (min.z < c.min.z) { out.push(new THREE.Box3(min.clone(), V3(max.x, max.y, c.min.z))); min.z = c.min.z; }
    if (max.z > c.max.z) { out.push(new THREE.Box3(V3(min.x, min.y, c.max.z), max.clone())); max.z = c.max.z; }
  }
  return out;
}
// Faces of the solid made of `boxes`. Each box face is split on every box
// breakpoint so partly buried faces keep exactly their exposed cells; faces that
// can never be seen from the front camera (undersides, backs, far sides) are dropped.
export function boxesToGeometry(boxes, { maxX = 17.9 } = {}) {
  const pos = [], nrm = [];
  const inside = (x, y, z) => boxes.some((b) => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z);
  const bp = { x: new Set(), y: new Set(), z: new Set() };
  for (const b of boxes) for (const a of ['x', 'y', 'z']) { bp[a].add(b.min[a]); bp[a].add(b.max[a]); }
  const cuts = (a, lo, hi) => [lo, ...[...bp[a]].filter((v) => v > lo + 1e-6 && v < hi - 1e-6).sort((p, q) => p - q), hi];
  const quad = (a, b, c, d, n) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) nrm.push(...n);
  };
  const e = 1e-3;
  for (const B of boxes) {
    const { min: m0, max: m1 } = B;
    // +z face (u = x, v = y)
    for (const [u0, u1] of pairs(cuts('x', m0.x, m1.x))) for (const [v0, v1] of pairs(cuts('y', m0.y, m1.y))) {
      if (inside((u0 + u1) / 2, (v0 + v1) / 2, m1.z + e)) continue;
      quad([u0, v0, m1.z], [u1, v0, m1.z], [u1, v1, m1.z], [u0, v1, m1.z], [0, 0, 1]);
    }
    // +y face (u = x, v = z)
    for (const [u0, u1] of pairs(cuts('x', m0.x, m1.x))) for (const [v0, v1] of pairs(cuts('z', m0.z, m1.z))) {
      if (inside((u0 + u1) / 2, m1.y + e, (v0 + v1) / 2)) continue;
      quad([u0, m1.y, v1], [u1, m1.y, v1], [u1, m1.y, v0], [u0, m1.y, v0], [0, 1, 0]);
    }
    // +x / -x faces (u = z, v = y)
    for (const [side, X] of [[1, m1.x], [-1, m0.x]]) {
      if (Math.abs(X) >= maxX) continue;
      for (const [u0, u1] of pairs(cuts('z', m0.z, m1.z))) for (const [v0, v1] of pairs(cuts('y', m0.y, m1.y))) {
        if (inside(X + side * e, (v0 + v1) / 2, (u0 + u1) / 2)) continue;
        if (side > 0) quad([X, v0, u1], [X, v0, u0], [X, v1, u0], [X, v1, u1], [1, 0, 0]);
        else quad([X, v0, u0], [X, v0, u1], [X, v1, u1], [X, v1, u0], [-1, 0, 0]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}
function pairs(list) {
  const out = [];
  for (let i = 1; i < list.length; i++) out.push([list[i - 1], list[i]]);
  return out;
}

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

// ---------------------------------------------------------------------------
// House: two-story beige house, blue shutters, white French doors, red tile roof
// ---------------------------------------------------------------------------
export function buildHouse(mats, roofMat) {
  const grp = new THREE.Group();
  const W = 9.6, D = 6.6, H = 5.6, zf = 0; // local: front face at z=0, house extends to -D
  const lists = { wall: [], trim: [], shutter: [], shutterDark: [], glass: [], brick: [], patio: [], wallShade: [] };
  // main walls
  lists.wall.push(boxMM(-W / 2, 0.38, -D, W / 2, H, zf));
  lists.wallShade.push(boxMM(-W / 2 - 0.05, 0, -D - 0.05, W / 2 + 0.05, 0.38, zf + 0.05)); // foundation
  // story band + corner boards
  lists.trim.push(boxMM(-W / 2 - 0.04, 2.78, zf - 0.02, W / 2 + 0.04, 2.92, zf + 0.04));
  lists.trim.push(boxMM(-W / 2 - 0.05, 2.78, -D - 0.04, -W / 2 + 0.02, 2.92, zf));
  lists.trim.push(boxMM(W / 2 - 0.02, 2.78, -D - 0.04, W / 2 + 0.05, 2.92, zf));
  for (const sx of [-1, 1]) {
    lists.trim.push(boxMM(sx * W / 2 - 0.12, 0.38, zf - 0.02, sx * W / 2 + 0.06 * sx, H, zf + 0.05));
  }
  // windows
  const win = (cx, cy, w, h) => {
    const z = zf;
    lists.glass.push(boxMM(cx - w / 2, cy - h / 2, z - 0.1, cx + w / 2, cy + h / 2, z - 0.02));
    const f = 0.09;
    lists.trim.push(boxMM(cx - w / 2 - f, cy - h / 2 - f, z - 0.05, cx + w / 2 + f, cy - h / 2, z + 0.05));
    lists.trim.push(boxMM(cx - w / 2 - f, cy + h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2 + f, z + 0.05));
    lists.trim.push(boxMM(cx - w / 2 - f, cy - h / 2, z - 0.05, cx - w / 2, cy + h / 2, z + 0.05));
    lists.trim.push(boxMM(cx + w / 2, cy - h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2, z + 0.05));
    // muntins
    lists.trim.push(boxMM(cx - 0.025, cy - h / 2, z - 0.07, cx + 0.025, cy + h / 2, z - 0.01));
    lists.trim.push(boxMM(cx - w / 2, cy - 0.025, z - 0.07, cx + w / 2, cy + 0.025, z - 0.01));
    // sill
    lists.trim.push(boxMM(cx - w / 2 - 0.16, cy - h / 2 - f - 0.07, z - 0.02, cx + w / 2 + 0.16, cy - h / 2 - f + 0.01, z + 0.16));
    // shutters with louvres
    for (const s of [-1, 1]) {
      const sx0 = s < 0 ? cx - w / 2 - f - 0.56 : cx + w / 2 + f + 0.04;
      const sx1 = sx0 + 0.52;
      lists.shutter.push(boxMM(sx0, cy - h / 2 - 0.02, z, sx1, cy + h / 2 + 0.02, z + 0.07));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const yy = cy - h / 2 + 0.1 + (i * (h - 0.16)) / (n - 1);
        lists.shutterDark.push(boxMM(sx0 + 0.06, yy - 0.018, z + 0.065, sx1 - 0.06, yy + 0.018, z + 0.085));
      }
    }
  };
  const upY = 4.25, dnY = 1.65;
  for (const x of [-3.15, 0, 3.15]) win(x, upY, 1.05, 1.4);
  for (const x of [-3.15, 3.15]) win(x, dnY, 1.05, 1.4);
  // French doors
  {
    const cx = 0, w = 2.0, h = 2.3, y0 = 0.38, z = zf;
    const f = 0.12;
    lists.trim.push(boxMM(cx - w / 2 - f, y0, z - 0.04, cx - w / 2, y0 + h + f, z + 0.07));
    lists.trim.push(boxMM(cx + w / 2, y0, z - 0.04, cx + w / 2 + f, y0 + h + f, z + 0.07));
    lists.trim.push(boxMM(cx - w / 2 - f, y0 + h, z - 0.04, cx + w / 2 + f, y0 + h + f, z + 0.07));
    for (const s of [-1, 1]) {
      const lx0 = s < 0 ? cx - w / 2 : cx + 0.01, lx1 = s < 0 ? cx - 0.01 : cx + w / 2;
      const st = 0.1;
      lists.glass.push(boxMM(lx0, y0, z - 0.09, lx1, y0 + h, z - 0.04));
      lists.trim.push(boxMM(lx0, y0, z - 0.06, lx0 + st, y0 + h, z + 0.02));
      lists.trim.push(boxMM(lx1 - st, y0, z - 0.06, lx1, y0 + h, z + 0.02));
      lists.trim.push(boxMM(lx0, y0, z - 0.06, lx1, y0 + 0.42, z + 0.02));
      lists.trim.push(boxMM(lx0, y0 + h - st, z - 0.06, lx1, y0 + h, z + 0.02));
      const mx = (lx0 + lx1) / 2;
      lists.trim.push(boxMM(mx - 0.022, y0 + 0.42, z - 0.07, mx + 0.022, y0 + h, z));
      for (let k = 1; k < 4; k++) {
        const yy = y0 + 0.42 + (k * (h - 0.42 - st)) / 4;
        lists.trim.push(boxMM(lx0, yy - 0.022, z - 0.07, lx1, yy + 0.022, z));
      }
    }
    // little step + patio
    lists.patio.push(boxMM(-1.9, 0, z, 1.9, 0.22, z + 0.9));
    lists.patio.push(boxMM(-2.6, 0, z, 2.6, 0.06, z + 1.9));
  }
  // chimney
  lists.brick.push(boxMM(2.3, H - 0.5, -4.6, 3.1, H + 3.55, -3.8));
  lists.trim.push(boxMM(2.22, H + 3.5, -4.68, 3.18, H + 3.66, -3.72));

  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeAll(list), mats[k]);
    m.castShadow = true;
    m.receiveShadow = true;
    grp.add(m);
  }

  // hip roof with tile uvs
  {
    const o = 0.5;
    const x0 = -W / 2 - o, x1 = W / 2 + o, z0 = zf + o, z1 = -D - o;
    const rise = 2.75;
    const yE = H, yR = H + rise;
    const zc = (z0 + z1) / 2;
    const half = (z0 - z1) / 2;
    const rx = (x1 - x0) / 2 - half;
    const A = [x0, yE, z0], B = [x1, yE, z0], C = [x1, yE, z1], Dd = [x0, yE, z1];
    const R0 = [-rx, yR, zc], R1 = [rx, yR, zc];
    const slope = Math.hypot(half, rise);
    const pos = [], uv = [];
    const tri = (p, q, r, up, uq, ur) => { pos.push(...p, ...q, ...r); uv.push(...up, ...uq, ...ur); };
    // front (A,B,R1,R0): u along x, v up slope
    tri(A, B, R1, [x0, 0], [x1, 0], [rx, slope]);
    tri(A, R1, R0, [x0, 0], [rx, slope], [-rx, slope]);
    // back (C,D,R0,R1)
    tri(C, Dd, R0, [-x1, 0], [-x0, 0], [rx, slope]);
    tri(C, R0, R1, [-x1, 0], [rx, slope], [-rx, slope]);
    // sides
    const slopeS = Math.hypot((x1 - x0) / 2 - rx, rise);
    tri(B, C, R1, [0, 0], [z0 - z1, 0], [z0 - zc, slopeS]);
    tri(Dd, A, R0, [0, 0], [z0 - z1, 0], [z0 - zc, slopeS]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const roof = new THREE.Mesh(g, roofMat);
    roof.castShadow = true;
    roof.receiveShadow = true;
    grp.add(roof);
    // fascia + ridge cap
    const fas = [];
    fas.push(boxMM(x0 - 0.04, yE - 0.22, z0 - 0.02, x1 + 0.04, yE + 0.02, z0 + 0.06));
    fas.push(boxMM(x0 - 0.04, yE - 0.22, z1 - 0.06, x1 + 0.04, yE + 0.02, z1 + 0.02));
    fas.push(boxMM(x0 - 0.06, yE - 0.22, z1, x0 + 0.02, yE + 0.02, z0));
    fas.push(boxMM(x1 - 0.02, yE - 0.22, z1, x1 + 0.06, yE + 0.02, z0));
    const fm = new THREE.Mesh(mergeAll(fas), mats.trim);
    fm.castShadow = true;
    grp.add(fm);
    // soffit underside (shadowed)
    const sof = new THREE.Mesh(boxMM(x0, yE - 0.05, z1, x1, yE, z0), mats.wallShade);
    grp.add(sof);
    const ridge = new THREE.Mesh(placed(new THREE.CylinderGeometry(0.09, 0.09, rx * 2 + 0.2, 10), 0, yR + 0.02, zc, 0, 0, Math.PI / 2), roofMat);
    ridge.castShadow = true;
    grp.add(ridge);
  }
  // potted bushes by the doors
  const pots = [];
  const bushes = [];
  for (const s of [-1, 1]) {
    pots.push(placed(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 16), s * 1.55, 0.44, zf + 0.55));
    bushes.push(placed(new THREE.SphereGeometry(0.38, 16, 12), s * 1.55, 0.95, zf + 0.55));
  }
  const potM = new THREE.Mesh(mergeAll(pots), mats.brick);
  potM.castShadow = true;
  grp.add(potM);
  const bushM = new THREE.Mesh(mergeAll(bushes), mats.leaf);
  bushM.castShadow = true;
  grp.add(bushM);
  return grp;
}

// ---------------------------------------------------------------------------
// Stylized tree / bush blobs
// ---------------------------------------------------------------------------
// returns geometries (local to the tree base) grouped by material key
export function buildTree(seed, scale = 1) {
  const rnd = mulberry32(seed);
  const trunk = placed(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 2.6 * scale, 10), 0, 1.3 * scale, 0);
  const leaf = [], leafDark = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const r = (1.0 + rnd() * 0.6) * scale;
    const a = (i / n) * Math.PI * 2 + rnd();
    const d = i === 0 ? 0 : (0.7 + rnd() * 0.5) * scale;
    const gg = lumpyBlob(r, 2, 0.06, seed * 13 + i);
    placed(gg, Math.cos(a) * d, (3.3 + rnd() * 1.1) * scale + (i === 0 ? 0.6 * scale : 0), Math.sin(a) * d * 0.7);
    (i % 2 ? leafDark : leaf).push(gg);
  }
  return { trunk: [trunk], leaf, leafDark };
}

export function buildBush(seed, scale = 1) {
  const rnd = mulberry32(seed);
  const list = [];
  for (let i = 0; i < 3; i++) {
    const r = (0.45 + rnd() * 0.25) * scale;
    list.push(placed(lumpyBlob(r, 2, 0.08, seed + i * 7), (i - 1) * 0.5 * scale, r * 0.75, (rnd() - 0.5) * 0.3 * scale));
  }
  return mergeAll(list);
}

// ---------------------------------------------------------------------------
// Small shiny red hatchback (no logos). Local frame: +x = front, +z = side
// facing the camera, origin on the ground at the centre of the wheelbase.
// ---------------------------------------------------------------------------
function profileShape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}
function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
function extrudeCentered(shape, width, bevel) {
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelOffset: -bevel * 0.9, // keep the outline, round the edges inwards
    bevelSegments: 5,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// thin panel lying on the profile edge a->b (x,y), pushed out along the edge normal
function slantedPanel(a, b, lenScale, width, out) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  let nx = -dy / len, ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const g = new THREE.BoxGeometry(len * lenScale, 0.03, width);
  return placed(g, (a[0] + b[0]) / 2 + nx * out, (a[1] + b[1]) / 2 + ny * out, 0, 0, 0, ang);
}

export function buildCar(mats) {
  const root = new THREE.Group(); // world position + yaw
  const pitch = new THREE.Group(); // tipping rotation (about z)
  const body = new THREE.Group(); // suspension bounce / squash
  root.add(pitch);
  pitch.add(body);

  const WA = 1.12; // half wheelbase
  const R = 0.34; // wheel radius
  const AR = 0.43; // arch radius
  const bottom = 0.26;
  // lower body profile (counter clockwise from the rear bottom)
  const pts = [];
  pts.push([-1.66, bottom]);
  pts.push([-1.78, 0.33], [-1.83, 0.44], [-1.84, 0.62], [-1.81, 0.82], [-1.72, 0.99]);
  pts.push([-0.6, 1.0], [0.72, 0.99]);
  pts.push([1.15, 0.93], [1.5, 0.86], [1.7, 0.8], [1.8, 0.72], [1.85, 0.6], [1.86, 0.46], [1.82, 0.34], [1.72, bottom]);
  // front arch (going backwards along the bottom)
  pts.push([WA + AR + 0.02, bottom]);
  pts.push(...arcPts(WA, R, AR, 0, Math.PI, 12).slice(1, -1));
  pts.push([WA - AR - 0.02, bottom]);
  pts.push([-WA + AR + 0.02, bottom]);
  pts.push(...arcPts(-WA, R, AR, 0, Math.PI, 12).slice(1, -1));
  pts.push([-WA - AR - 0.02, bottom]);
  // reverse so the shape winds counter clockwise
  const lower = profileShape(pts.reverse());
  const lowerG = extrudeCentered(lower, 1.72, 0.13);
  const paintParts = [lowerG];
  // cabin (painted) with glass panels on top
  const cab = profileShape([
    [-1.66, 0.97], [-1.6, 1.18], [-1.5, 1.38], [-1.36, 1.46], [0.12, 1.47], [0.3, 1.43], [0.55, 1.22], [0.84, 0.97],
  ]);
  const cabG = extrudeCentered(cab, 1.5, 0.1);
  paintParts.push(cabG);
  const paint = new THREE.Mesh(mergeAll(paintParts), mats.carPaint);
  paint.castShadow = true;
  paint.receiveShadow = true;
  body.add(paint);

  // glass: side windows (both sides), windshield, rear glass
  const glassParts = [];
  const sideWin = profileShape([[-1.42, 1.04], [-1.36, 1.2], [-1.28, 1.36], [-1.18, 1.395], [0.08, 1.395], [0.22, 1.37], [0.46, 1.17], [0.68, 1.03]]);
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(sideWin, { depth: 0.03, bevelEnabled: false });
    g.translate(0, 0, s > 0 ? 0.735 : -0.765);
    glassParts.push(g);
  }
  // windshield: slanted quad following the cabin front
  {
    glassParts.push(slantedPanel([0.3, 1.43], [0.84, 0.97], 0.92, 1.3, 0.018));
  }
  {
    glassParts.push(slantedPanel([-1.43, 1.42], [-1.61, 1.13], 0.95, 1.24, 0.018));
  }
  const glass = new THREE.Mesh(mergeAll(glassParts), mats.carGlass);
  body.add(glass);
  // B-pillar strips over the side glass
  const pillarParts = [];
  for (const s of [-1, 1]) pillarParts.push(box(0.11, 0.37, 0.02, -0.42, 1.2, s * 0.775));
  const pill = new THREE.Mesh(mergeAll(pillarParts), mats.carPaint);
  body.add(pill);

  // trims: bumpers, grille, skirts, door seams, handles, mirrors
  const trim = [];
  trim.push(box(0.12, 0.16, 1.6, 1.82, 0.36, 0)); // front bumper lip
  trim.push(box(0.12, 0.16, 1.6, -1.8, 0.36, 0)); // rear bumper
  trim.push(box(0.05, 0.12, 0.9, 1.86, 0.5, 0)); // grille
  for (const s of [-1, 1]) {
    trim.push(box(1.1, 0.07, 0.04, 0.0, 0.33, s * 0.86)); // side skirt
    trim.push(box(0.018, 0.6, 0.012, 0.74, 0.66, s * 0.866)); // door seam front
    trim.push(box(0.018, 0.6, 0.012, -0.62, 0.66, s * 0.866)); // door seam rear
    trim.push(box(0.16, 0.04, 0.03, -0.45, 0.88, s * 0.868)); // handle
    trim.push(placed(new RoundedBoxGeometry(0.16, 0.12, 0.18, 2, 0.04), 0.62, 1.03, s * 0.86)); // mirror
  }
  const trimM = new THREE.Mesh(mergeAll(trim), mats.trimBlack);
  trimM.castShadow = true;
  body.add(trimM);
  // tail pipe (camera side)
  const tail = new THREE.Mesh(placed(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), -1.86, 0.3, 0.45, 0, 0, Math.PI / 2), mats.chrome);
  body.add(tail);
  // lights
  const hl = [];
  for (const s of [-1, 1]) hl.push(placed(new RoundedBoxGeometry(0.06, 0.16, 0.34, 2, 0.03), 1.79, 0.73, s * 0.55, 0, 0, -0.35));
  const headlights = new THREE.Mesh(mergeAll(hl), mats.headlight);
  body.add(headlights);
  const tl = [];
  for (const s of [-1, 1]) tl.push(placed(new RoundedBoxGeometry(0.05, 0.3, 0.16, 2, 0.02), -1.82, 0.82, s * 0.66));
  const taillights = new THREE.Mesh(mergeAll(tl), mats.taillight);
  body.add(taillights);
  // headlight glow sprites + beams (driven in the finale)
  const glowParts = [];
  for (const s of [-1, 1]) glowParts.push(placed(new THREE.CircleGeometry(0.32, 24), 1.9, 0.73, s * 0.55, 0, Math.PI / 2, 0));
  const glow = new THREE.Mesh(mergeAll(glowParts), mats.glow);
  glow.renderOrder = 5;
  body.add(glow);
  const beamParts = [];
  for (const s of [-1, 1]) {
    const c = new THREE.ConeGeometry(0.9, 3.2, 24, 1, true);
    placed(c, 1.9 + 1.6, 0.7, s * 0.55, 0, 0, Math.PI / 2);
    beamParts.push(c);
  }
  const beams = new THREE.Mesh(mergeAll(beamParts), mats.beam);
  beams.renderOrder = 6;
  body.add(beams);

  // wheels
  const wheels = [];
  const tireG = (() => {
    const pts2 = [];
    const w = 0.13;
    pts2.push(new THREE.Vector2(0.2, -w));
    pts2.push(new THREE.Vector2(0.3, -w));
    pts2.push(new THREE.Vector2(0.335, -w * 0.7));
    pts2.push(new THREE.Vector2(R, -w * 0.3));
    pts2.push(new THREE.Vector2(R, w * 0.3));
    pts2.push(new THREE.Vector2(0.335, w * 0.7));
    pts2.push(new THREE.Vector2(0.3, w));
    pts2.push(new THREE.Vector2(0.2, w));
    const g = new THREE.LatheGeometry(pts2, 32);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  for (const [x, s] of [[WA, 1], [-WA, 1], [WA, -1], [-WA, -1]]) {
    const wg = new THREE.Group();
    wg.position.set(x, R, s * 0.72);
    const spin = new THREE.Group();
    wg.add(spin);
    const tire = new THREE.Mesh(tireG, mats.tire);
    tire.castShadow = true;
    spin.add(tire);
    const rimParts = [placed(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 24), 0, 0, 0, Math.PI / 2, 0, 0)];
    // spokes on the outer face
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      rimParts.push(placed(new THREE.BoxGeometry(0.05, 0.19, 0.03), Math.cos(a) * 0.1, Math.sin(a) * 0.1, s * 0.105, 0, 0, a + Math.PI / 2));
    }
    rimParts.push(placed(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), 0, 0, s * 0.11, Math.PI / 2, 0, 0));
    const rim = new THREE.Mesh(mergeAll(rimParts), mats.rim);
    spin.add(rim);
    const dark = new THREE.Mesh(placed(new THREE.CylinderGeometry(0.205, 0.205, 0.02, 24), 0, 0, s * 0.092, Math.PI / 2, 0, 0), mats.trimBlack);
    spin.add(dark);
    pitch.add(wg);
    wheels.push({ group: wg, spin, baseY: R });
  }
  return { root, pitch, body, wheels, headlights, glow, beams, taillights, R, WA };
}
