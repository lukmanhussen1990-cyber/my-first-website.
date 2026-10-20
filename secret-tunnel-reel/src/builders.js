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

// ---------------------------------------------------------------------------
// Two-story house: white French doors, tile roof; beige with blue shutters by
// default, or e.g. light green with plain white windows
// ---------------------------------------------------------------------------
export function buildHouse(mats, roofMat, { wall = 'wall', shade = 'wallShade', shutters = true, chimney = 1, open = null } = {}) {
  const grp = new THREE.Group();
  const W = 9.6, D = 6.6, H = 5.6, zf = 0; // local: front face at z=0, house extends to -D
  const lists = { wall: [], trim: [], shutter: [], shutterDark: [], glass: [], brick: [], patio: [], wallShade: [], room: [], curtain: [] };
  const matOf = { wall, wallShade: shade, glass: 'houseGlass' };
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
    const isOpen = open && Math.abs(open[0] - cx) < 0.01 && Math.abs(open[1] - cy) < 0.01;
    // glass sits just proud of the wall face, inside the frame
    if (!isOpen) lists.glass.push(boxMM(cx - w / 2, cy - h / 2, z - 0.005, cx + w / 2, cy + h / 2, z + 0.008));
    else {
      // open window: dim room behind, curtains pulled to the sides
      lists.room.push(boxMM(cx - w / 2, cy - h / 2, z - 0.005, cx + w / 2, cy + h / 2, z + 0.004));
      for (const s of [-1, 1]) lists.curtain.push(boxMM(s < 0 ? cx - w / 2 : cx + w / 2 - 0.12, cy - h / 2, z + 0.004, s < 0 ? cx - w / 2 + 0.12 : cx + w / 2, cy + h / 2, z + 0.03));
    }
    const f = 0.09;
    lists.trim.push(boxMM(cx - w / 2 - f, cy - h / 2 - f, z - 0.05, cx + w / 2 + f, cy - h / 2, z + 0.05));
    lists.trim.push(boxMM(cx - w / 2 - f, cy + h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2 + f, z + 0.05));
    lists.trim.push(boxMM(cx - w / 2 - f, cy - h / 2, z - 0.05, cx - w / 2, cy + h / 2, z + 0.05));
    lists.trim.push(boxMM(cx + w / 2, cy - h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2, z + 0.05));
    // muntins
    if (!isOpen) {
      lists.trim.push(boxMM(cx - 0.025, cy - h / 2, z + 0.004, cx + 0.025, cy + h / 2, z + 0.03));
      lists.trim.push(boxMM(cx - w / 2, cy - 0.025, z + 0.004, cx + w / 2, cy + 0.025, z + 0.03));
    }
    // sill
    lists.trim.push(boxMM(cx - w / 2 - 0.16, cy - h / 2 - f - 0.07, z - 0.02, cx + w / 2 + 0.16, cy - h / 2 - f + 0.01, z + 0.16));
    // shutters with louvres
    if (shutters) for (const s of [-1, 1]) {
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
      lists.glass.push(boxMM(lx0, y0, z - 0.005, lx1, y0 + h, z + 0.006));
      lists.trim.push(boxMM(lx0, y0, z, lx0 + st, y0 + h, z + 0.03));
      lists.trim.push(boxMM(lx1 - st, y0, z, lx1, y0 + h, z + 0.03));
      lists.trim.push(boxMM(lx0, y0, z, lx1, y0 + 0.42, z + 0.03));
      lists.trim.push(boxMM(lx0, y0 + h - st, z, lx1, y0 + h, z + 0.03));
      const mx = (lx0 + lx1) / 2;
      lists.trim.push(boxMM(mx - 0.022, y0 + 0.42, z + 0.006, mx + 0.022, y0 + h, z + 0.025));
      for (let k = 1; k < 4; k++) {
        const yy = y0 + 0.42 + (k * (h - 0.42 - st)) / 4;
        lists.trim.push(boxMM(lx0, yy - 0.022, z + 0.006, lx1, yy + 0.022, z + 0.025));
      }
    }
    // little step + patio
    lists.patio.push(boxMM(-1.9, 0, z, 1.9, 0.22, z + 0.9));
    lists.patio.push(boxMM(-2.6, 0, z, 2.6, 0.06, z + 1.9));
  }
  // chimney
  const cx0 = chimney > 0 ? 2.3 : -3.1, cx1 = cx0 + 0.8;
  lists.brick.push(boxMM(cx0, H - 0.5, -4.6, cx1, H + 3.55, -3.8));
  lists.trim.push(boxMM(cx0 - 0.08, H + 3.5, -4.68, cx1 + 0.08, H + 3.66, -3.72));

  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeAll(list), mats[matOf[k] || k]);
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
    const sof = new THREE.Mesh(boxMM(x0, yE - 0.05, z1, x1, yE, z0), mats[shade]);
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
  if (open) grp.userData.open = new THREE.Vector3(open[0], open[1], zf);
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
