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

// thin rod between two points (gutters, downspouts, hip caps, branches)
const _up = new THREE.Vector3(0, 1, 0);
export function rod(a, b, r0, r1 = r0, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// bake crown occlusion (uv.x) and a hue (uv.y) into a foliage cluster: vertices
// facing out of the crown and near its rim are lit, the inside goes dark
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3();
export function shadeFoliage(g, center, radii, hue, base = 0, cluster = null) {
  const p = g.attributes.position, nr = g.attributes.normal, n = p.count;
  const uv = new Float32Array(n * 2);
  // the cluster's own place in the crown evens out the shading across each ball
  let aoC = -1;
  if (cluster) {
    _d.subVectors(cluster, center).divide(radii);
    const r = _d.length(), up = Math.min(1, Math.max(-1, _d.y));
    aoC = Math.min(1, Math.max(0, base + 0.22 + 0.6 * Math.min(1, Math.max(0, (r - 0.3) / 0.7)) + 0.16 * up));
  }
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(p, i);
    _n.fromBufferAttribute(nr, i);
    _d.subVectors(_v, center).divide(radii);
    const radial = _d.length();
    const facing = _n.dot(_d.normalize());
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const up = Math.min(1, Math.max(-1, (_v.y - center.y) / radii.y));
    const aoV = Math.min(1, Math.max(0, base + 0.16 + 0.42 * sm(-0.25, 0.85, facing) + 0.4 * sm(0.35, 1.0, radial) + 0.14 * up));
    uv[i * 2] = aoC < 0 ? aoV : 0.55 * aoV + 0.45 * aoC;
    uv[i * 2 + 1] = hue;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------------------------------------------------------------------------
// Two-story house: white French doors under a little canopy, tile roof with
// gutters and hip caps; beige render with blue shutters and window boxes, or
// light green lap siding with plain white windows
// ---------------------------------------------------------------------------
export function buildHouse(mats, roofMat, { wall = 'wall', shade = 'wallShade', shutters = true, chimney = 1, open = null, lintel = 'sillStone', boxes = 'up', dress = [], extras = 'hose' } = {}) {
  const grp = new THREE.Group();
  const W = 9.6, D = 6.6, H = 5.6, zf = 0; // local: front face at z=0, house extends to -D
  const lists = {};
  const put = (k, g) => (lists[k] || (lists[k] = [])).push(g);
  const matOf = { wall, wallShade: shade, glass: 'houseGlass' };
  const rnd = mulberry32(chimney > 0 ? 5 : 9);
  // main walls, plinth with a capping and a few air bricks
  put('wall', boxMM(-W / 2, 0.38, -D, W / 2, H, zf));
  put('wallShade', boxMM(-W / 2 - 0.05, 0, -D - 0.05, W / 2 + 0.05, 0.38, zf + 0.05));
  put(lintel, boxMM(-W / 2 - 0.08, 0.36, zf - 0.02, W / 2 + 0.08, 0.43, zf + 0.09));
  for (const x of [-4.1, -3.15, 3.15, 4.1]) put('grille', boxMM(x - 0.12, 0.12, zf + 0.05, x + 0.12, 0.25, zf + 0.06));
  // story band + corner boards
  put('trim', boxMM(-W / 2 - 0.04, 2.78, zf - 0.02, W / 2 + 0.04, 2.92, zf + 0.04));
  put('trim', boxMM(-W / 2 - 0.05, 2.78, -D - 0.04, -W / 2 + 0.02, 2.92, zf));
  put('trim', boxMM(W / 2 - 0.02, 2.78, -D - 0.04, W / 2 + 0.05, 2.92, zf));
  for (const sx of [-1, 1]) put('trim', boxMM(sx * W / 2 - 0.12, 0.43, zf - 0.02, sx * W / 2 + 0.06 * sx, H, zf + 0.05));
  // windows
  let wi = 0;
  const win = (cx, cy, w, h, box) => {
    const z = zf;
    const isOpen = open && Math.abs(open[0] - cx) < 0.01 && Math.abs(open[1] - cy) < 0.01;
    const look = dress[wi++] || 'none';
    // glass sits just proud of the wall face, inside the frame
    if (!isOpen) {
      put('glass', boxMM(cx - w / 2, cy - h / 2, z - 0.005, cx + w / 2, cy + h / 2, z + 0.008));
      // curtains or a blind behind the glazing bars
      const cz0 = z + 0.008, cz1 = z + 0.016;
      if (look === 'curtains' || look === 'half') {
        for (const s of look === 'half' ? [-1] : [-1, 1]) {
          const x0 = s < 0 ? cx - w / 2 : cx + w / 2 - 0.25, x1 = x0 + 0.25;
          put('curtainCream', boxMM(x0, cy - h / 2 + 0.03, cz0, x1, cy + h / 2, cz1));
          for (let k = 1; k < 3; k++) put('blind', boxMM(x0 + k * 0.083 - 0.012, cy - h / 2 + 0.03, cz1, x0 + k * 0.083 + 0.012, cy + h / 2, cz1 + 0.004)); // folds
        }
      } else if (look === 'blind') {
        put('blind', boxMM(cx - w / 2, cy + h / 2 - h * 0.38, cz0, cx + w / 2, cy + h / 2, cz1));
        put('trim', boxMM(cx - w / 2, cy + h / 2 - h * 0.38 - 0.03, cz0, cx + w / 2, cy + h / 2 - h * 0.38, cz1 + 0.006));
      }
    } else {
      // open window: dim room behind, curtains pulled to the sides
      put('room', boxMM(cx - w / 2, cy - h / 2, z - 0.005, cx + w / 2, cy + h / 2, z + 0.004));
      for (const s of [-1, 1]) put('curtain', boxMM(s < 0 ? cx - w / 2 : cx + w / 2 - 0.12, cy - h / 2, z + 0.004, s < 0 ? cx - w / 2 + 0.12 : cx + w / 2, cy + h / 2, z + 0.03));
    }
    const f = 0.09;
    put('trim', boxMM(cx - w / 2 - f, cy - h / 2 - f, z - 0.05, cx + w / 2 + f, cy - h / 2, z + 0.05));
    put('trim', boxMM(cx - w / 2 - f, cy + h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2 + f, z + 0.05));
    put('trim', boxMM(cx - w / 2 - f, cy - h / 2, z - 0.05, cx - w / 2, cy + h / 2, z + 0.05));
    put('trim', boxMM(cx + w / 2, cy - h / 2, z - 0.05, cx + w / 2 + f, cy + h / 2, z + 0.05));
    // glazing bars
    if (!isOpen) {
      put('trim', boxMM(cx - 0.025, cy - h / 2, z + 0.004, cx + 0.025, cy + h / 2, z + 0.03));
      put('trim', boxMM(cx - w / 2, cy - 0.025, z + 0.004, cx + w / 2, cy + 0.025, z + 0.03));
    }
    // sill and lintel
    const sillTop = cy - h / 2 - f + 0.01;
    put(lintel, boxMM(cx - w / 2 - 0.16, sillTop - 0.08, z - 0.02, cx + w / 2 + 0.16, sillTop, z + 0.16));
    put(lintel, boxMM(cx - w / 2 - f - 0.1, cy + h / 2 + f, z - 0.02, cx + w / 2 + f + 0.1, cy + h / 2 + f + 0.13, z + 0.07));
    // shutters with louvres
    if (shutters) for (const s of [-1, 1]) {
      const sx0 = s < 0 ? cx - w / 2 - f - 0.56 : cx + w / 2 + f + 0.04;
      const sx1 = sx0 + 0.52;
      put('shutter', boxMM(sx0, cy - h / 2 - 0.02, z, sx1, cy + h / 2 + 0.02, z + 0.07));
      const n = 11;
      for (let i = 0; i < n; i++) {
        const yy = cy - h / 2 + 0.1 + (i * (h - 0.16)) / (n - 1);
        put('shutterDark', boxMM(sx0 + 0.06, yy - 0.018, z + 0.065, sx1 - 0.06, yy + 0.018, z + 0.085));
      }
      put('brass', boxMM(sx0 + (s < 0 ? 0.44 : 0.04), cy - 0.02, z + 0.07, sx0 + (s < 0 ? 0.48 : 0.08), cy + 0.02, z + 0.095));
    }
    // window box full of flowers
    if (box) {
      const x0 = cx - w / 2 - 0.02, x1 = cx + w / 2 + 0.02;
      put('pot', boxMM(x0, sillTop - 0.34, z + 0.17, x1, sillTop - 0.1, z + 0.42));
      put('potDark', boxMM(x0 + 0.03, sillTop - 0.11, z + 0.2, x1 - 0.03, sillTop - 0.09, z + 0.39));
      for (let i = 0; i < 9; i++) {
        const lx = lerp(x0 + 0.08, x1 - 0.08, (i + rnd() * 0.6) / 9), ly = sillTop - 0.06 + rnd() * 0.08, lz = z + 0.24 + rnd() * 0.13;
        const leaf = placed(lumpyBlob(0.08 + rnd() * 0.035, 1, 0.12, 900 + wi * 17 + i), lx, ly, lz, rnd() * 3, rnd() * 3, 0, 1, 0.8, 1);
        put('leaf', shadeFoliage(leaf, new THREE.Vector3(cx, sillTop - 0.1, z + 0.3), new THREE.Vector3(0.6, 0.2, 0.2), rnd(), 0.15));
      }
      const kinds = ['flowerPink', 'flowerRed', 'flowerWhite', 'flowerYellow'];
      for (let i = 0; i < 13; i++) {
        const fx = lerp(x0 + 0.06, x1 - 0.06, rnd()), fy = sillTop + 0.01 + rnd() * 0.09, fz = z + 0.25 + rnd() * 0.14;
        put(kinds[(i + wi) % (box === 'mixed' ? 4 : 2)], placed(new THREE.IcosahedronGeometry(0.038 + rnd() * 0.014, 1), fx, fy, fz));
      }
    }
  };
  const upY = 4.25, dnY = 1.65;
  // (no window box on the middle one: it would sit right on top of the door canopy)
  for (const x of [-3.15, 0, 3.15]) win(x, upY, 1.05, 1.4, boxes === 'up' && x !== 0 ? 'mixed' : null);
  for (const x of [-3.15, 3.15]) win(x, dnY, 1.05, 1.4, boxes === 'down' ? 'pair' : null);
  // French doors under a little canopy, lanterns either side, a doormat on the step
  {
    const cx = 0, w = 2.0, h = 2.3, y0 = 0.38, z = zf;
    const f = 0.12;
    put('trim', boxMM(cx - w / 2 - f, y0, z - 0.04, cx - w / 2, y0 + h + f, z + 0.07));
    put('trim', boxMM(cx + w / 2, y0, z - 0.04, cx + w / 2 + f, y0 + h + f, z + 0.07));
    put('trim', boxMM(cx - w / 2 - f, y0 + h, z - 0.04, cx + w / 2 + f, y0 + h + f, z + 0.07));
    for (const s of [-1, 1]) {
      const lx0 = s < 0 ? cx - w / 2 : cx + 0.01, lx1 = s < 0 ? cx - 0.01 : cx + w / 2;
      const st = 0.1;
      put('glass', boxMM(lx0, y0, z - 0.005, lx1, y0 + h, z + 0.006));
      put('trim', boxMM(lx0, y0, z, lx0 + st, y0 + h, z + 0.03));
      put('trim', boxMM(lx1 - st, y0, z, lx1, y0 + h, z + 0.03));
      put('trim', boxMM(lx0, y0, z, lx1, y0 + 0.42, z + 0.03));
      put('trim', boxMM(lx0, y0 + h - st, z, lx1, y0 + h, z + 0.03));
      const mx = (lx0 + lx1) / 2;
      put('trim', boxMM(mx - 0.022, y0 + 0.42, z + 0.006, mx + 0.022, y0 + h, z + 0.025));
      for (let k = 1; k < 4; k++) {
        const yy = y0 + 0.42 + (k * (h - 0.42 - st)) / 4;
        put('trim', boxMM(lx0, yy - 0.022, z + 0.006, lx1, yy + 0.022, z + 0.025));
      }
      // lever handles
      const hx = s < 0 ? lx1 - 0.06 : lx0 + 0.06;
      put('brass', boxMM(hx - 0.018, y0 + 1.0, z + 0.03, hx + 0.018, y0 + 1.1, z + 0.05));
      put('brass', boxMM(hx - (s < 0 ? 0.11 : 0.0), y0 + 1.07, z + 0.05, hx + (s < 0 ? 0.0 : 0.11), y0 + 1.1, z + 0.075));
      // lantern
      const lx = s * 1.45;
      put('grille', boxMM(lx - 0.035, y0 + 1.62, z, lx + 0.035, y0 + 1.68, z + 0.12));
      put('grille', boxMM(lx - 0.085, y0 + 1.66, z + 0.05, lx + 0.085, y0 + 1.7, z + 0.22));
      put('lampGlass', boxMM(lx - 0.065, y0 + 1.4, z + 0.07, lx + 0.065, y0 + 1.66, z + 0.2));
      put('grille', boxMM(lx - 0.075, y0 + 1.36, z + 0.06, lx + 0.075, y0 + 1.4, z + 0.21));
      // canopy bracket
      put('trim', placed(new THREE.BoxGeometry(0.06, 0.06, 0.62), s * 1.3, y0 + h + 0.38, z + 0.27, 0.62, 0, 0));
    }
    // canopy: a white timber hood with a tiled top
    put('trim', placed(new THREE.BoxGeometry(2.9, 0.08, 0.86), 0, y0 + h + 0.55, z + 0.4, 0.2, 0, 0));
    const tiles = new THREE.BoxGeometry(3.0, 0.05, 0.9);
    const tu = tiles.attributes.uv;
    for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) * 3.0, tu.getY(i) * 0.9); // uv in metres, like the roof
    put('roofTile', placed(tiles, 0, y0 + h + 0.61, z + 0.41, 0.2, 0, 0));
    // step, doormat, patio
    put('patio', boxMM(-1.9, 0, z, 1.9, 0.22, z + 0.9));
    put('patio', boxMM(-2.6, 0, z, 2.6, 0.06, z + 1.9));
    put('doormat', boxMM(-0.7, 0.22, z + 0.15, 0.7, 0.236, z + 0.75));
  }
  // chimney with a concrete cap and two pots
  const cx0 = chimney > 0 ? 2.3 : -3.1, cx1 = cx0 + 0.8;
  put('chimneyBrick', boxMM(cx0, H - 0.5, -4.6, cx1, H + 3.55, -3.8));
  put('sillStone', boxMM(cx0 - 0.08, H + 3.5, -4.68, cx1 + 0.08, H + 3.66, -3.72));
  for (const k of [0, 1]) put('pot', placed(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 14), cx0 + 0.22 + k * 0.36, H + 3.86, -4.2));
  // garden kit: hose reel on the beige house, an air-conditioning unit on the green one
  if (extras === 'hose') {
    put('hose', placed(new THREE.TorusGeometry(0.2, 0.06, 8, 20), -4.25, 0.42, zf + 0.3));
    put('grille', boxMM(-4.3, 0, zf + 0.22, -4.2, 0.42, zf + 0.38));
    put('grille', placed(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), -4.25, 0.42, zf + 0.3, Math.PI / 2, 0, 0));
  } else if (extras === 'ac') {
    put('acUnit', boxMM(3.55, 0.06, zf + 0.12, 4.45, 0.7, zf + 0.62));
    put('grille', placed(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), 3.92, 0.38, zf + 0.625, Math.PI / 2, 0, 0));
    put('grille', boxMM(4.24, 0.14, zf + 0.62, 4.38, 0.62, zf + 0.63));
    put('grille', boxMM(4.42, 0.5, zf + 0.0, 4.47, 0.56, zf + 0.3)); // pipe into the wall
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
    // fascia, soffit, gutters with downspouts
    put('trim', boxMM(x0 - 0.04, yE - 0.22, z0 - 0.02, x1 + 0.04, yE + 0.02, z0 + 0.06));
    put('trim', boxMM(x0 - 0.04, yE - 0.22, z1 - 0.06, x1 + 0.04, yE + 0.02, z1 + 0.02));
    put('trim', boxMM(x0 - 0.06, yE - 0.22, z1, x0 + 0.02, yE + 0.02, z0));
    put('trim', boxMM(x1 - 0.02, yE - 0.22, z1, x1 + 0.06, yE + 0.02, z0));
    put(shade, boxMM(x0, yE - 0.05, z1, x1, yE, z0));
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    put('gutter', rod(V(x0 - 0.05, yE - 0.12, z0 + 0.12), V(x1 + 0.05, yE - 0.12, z0 + 0.12), 0.075, 0.075, 10));
    put('gutter', rod(V(x0 + 0.12, yE - 0.12, z0 + 0.12), V(x0 + 0.12, yE - 0.12, z1 - 0.12), 0.075, 0.075, 10));
    put('gutter', rod(V(x1 - 0.12, yE - 0.12, z0 + 0.12), V(x1 - 0.12, yE - 0.12, z1 - 0.12), 0.075, 0.075, 10));
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.3);
      put('gutter', rod(V(x, yE - 0.14, z0 + 0.12), V(x, yE - 0.62, zf + 0.09), 0.046, 0.046, 8));
      put('gutter', rod(V(x, yE - 0.6, zf + 0.09), V(x, 0.5, zf + 0.09), 0.046, 0.046, 8));
      put('gutter', rod(V(x, 0.52, zf + 0.09), V(x, 0.3, zf + 0.3), 0.046, 0.046, 8));
      for (const y of [1.2, 2.6, 4.0]) put('gutter', boxMM(x - 0.06, y - 0.02, zf, x + 0.06, y + 0.02, zf + 0.12));
    }
    // ridge and hip caps
    const caps = [rod(V(-rx - 0.1, yR + 0.03, zc), V(rx + 0.1, yR + 0.03, zc), 0.09, 0.09, 10)];
    for (const [p, q] of [[A, R0], [B, R1], [C, R1], [Dd, R0]]) caps.push(rod(V(p[0], p[1] + 0.05, p[2]), V(q[0], q[1] + 0.03, q[2]), 0.075, 0.075, 8));
    const ridge = new THREE.Mesh(mergeAll(caps), roofMat);
    ridge.castShadow = true;
    grp.add(ridge);
  }
  // potted topiary balls by the doors
  for (const s of [-1, 1]) {
    put('pot', placed(new THREE.CylinderGeometry(0.28, 0.21, 0.45, 18), s * 1.55, 0.44, zf + 0.55));
    put('pot', placed(new THREE.TorusGeometry(0.27, 0.035, 6, 20), s * 1.55, 0.66, zf + 0.55, Math.PI / 2, 0, 0));
    put('potDark', placed(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16), s * 1.55, 0.655, zf + 0.55));
    const c = new THREE.Vector3(s * 1.55, 1.02, zf + 0.55);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996, yy = i === 0 ? 0.12 : (i % 2 ? 0.05 : -0.1);
      const d = i === 0 ? 0 : 0.2;
      const b = placed(lumpyBlob(0.2 + rnd() * 0.05, 1, 0.12, 700 + i + (s > 0 ? 50 : 0)), c.x + Math.cos(a) * d, c.y + yy, c.z + Math.sin(a) * d * 0.8);
      put('leaf', shadeFoliage(b, c, new THREE.Vector3(0.42, 0.4, 0.42), 0.35 + 0.3 * rnd()));
    }
  }
  if (lists.roofTile) {
    const m = new THREE.Mesh(mergeAll(lists.roofTile), roofMat);
    m.castShadow = true;
    grp.add(m);
    delete lists.roofTile;
  }
  for (const [k, list] of Object.entries(lists)) {
    const m = new THREE.Mesh(mergeAll(list), mats[matOf[k] || k]);
    m.castShadow = true;
    m.receiveShadow = true;
    grp.add(m);
  }
  if (open) grp.userData.open = new THREE.Vector3(open[0], open[1], zf);
  return grp;
}

const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Trees: tapered trunk with a root flare, limbs reaching into the crown, and a
// crown of many small leaf clusters with gaps between them.
//   broad: rounded broadleaf   oak: wide and layered   tall: narrow, columnar
// ---------------------------------------------------------------------------
const TREE = {
  broad: { trunkH: 3.7, crownY: 4.0, rx: 1.8, ry: 1.55, n: 46, rc: [0.36, 0.62], limbs: 5, flat: 0.84 },
  oak: { trunkH: 3.3, crownY: 3.75, rx: 2.35, ry: 1.45, n: 56, rc: [0.38, 0.64], limbs: 6, flat: 0.78 },
  tall: { trunkH: 2.4, crownY: 4.1, rx: 0.9, ry: 2.85, n: 44, rc: [0.28, 0.44], limbs: 3, flat: 0.9 },
};
// returns geometries (local to the tree base) grouped by material key
export function buildTree(seed, scale = 1, kind = 'broad') {
  const rnd = mulberry32(seed);
  const sp = TREE[kind];
  const S = scale;
  const lean = (rnd() - 0.5) * 0.1;
  // trunk: lathe profile with a flare and root lobes at the bottom
  const prof = [];
  const rTop = 0.075 * S, rBase = 0.17 * S, top = sp.trunkH * S;
  for (let i = 0; i <= 14; i++) {
    const y = (top * i) / 14;
    const r = rTop + (rBase - rTop) * Math.pow(Math.max(0, 1 - y / top), 1.4) + 0.13 * S * Math.exp(-y / (0.2 * S));
    prof.push(new THREE.Vector2(r, y));
  }
  const trunk = new THREE.LatheGeometry(prof, 14);
  {
    const p = trunk.attributes.position, ph = rnd() * 6.28;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const lobe = 1 + 0.45 * Math.exp(-y / (0.16 * S)) * Math.pow(Math.max(0, Math.cos(2.5 * a + ph)), 2);
      p.setXYZ(i, x * lobe + lean * y * y / top, y, z * lobe);
    }
    trunk.computeVertexNormals();
  }
  const wood = [trunk];
  const C = new THREE.Vector3(lean * top, sp.crownY * S, 0);
  const R = new THREE.Vector3(sp.rx * S, sp.ry * S, sp.rx * S * 0.8);
  // limbs from the upper trunk out into the crown, each ending in a cluster
  const tips = [];
  for (let i = 0; i < sp.limbs; i++) {
    const a = (i / sp.limbs) * Math.PI * 2 + rnd() * 0.8;
    const el = kind === 'tall' ? 0.9 + rnd() * 0.4 : 0.25 + rnd() * 0.55;
    const from = new THREE.Vector3(lean * top * 0.6, (sp.crownY - sp.ry * (kind === 'tall' ? 0.75 : 0.55) + rnd() * 0.4) * S, 0);
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) * 0.8);
    const tip = C.clone().add(new THREE.Vector3(dir.x * R.x, dir.y * R.y, dir.z * R.z).multiplyScalar(0.62 + rnd() * 0.15));
    const mid = from.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.25 * S, 0));
    wood.push(rod(from, mid, 0.065 * S, 0.045 * S, 6), rod(mid, tip, 0.045 * S, 0.02 * S, 6));
    tips.push(tip);
  }
  // clusters: one on every limb tip, the rest spread over the crown shell (more on
  // top, fewer underneath) with a few dark ones inside for depth
  const centers = tips.map((t) => [t, sp.rc[1] * S * (0.85 + 0.2 * rnd())]);
  let tries = 0;
  while (centers.length < sp.n && tries++ < 600) {
    const u = rnd() * 2 - 1, phi = rnd() * Math.PI * 2;
    const y = kind === 'tall' ? u : u * 0.85 + 0.15 * Math.abs(u);
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const inner = centers.length > sp.n * 0.85;
    const k = inner ? 0.35 + rnd() * 0.2 : 0.72 + rnd() * 0.22;
    const p = C.clone().add(new THREE.Vector3(Math.cos(phi) * rr * R.x * k, y * R.y * k, Math.sin(phi) * rr * R.z * k));
    const r = lerp(sp.rc[0], sp.rc[1], rnd()) * S * (kind === 'tall' ? 1.0 - 0.35 * Math.max(0, y) : 1);
    if (centers.some(([q, qr]) => q.distanceTo(p) < (qr + r) * 0.42)) continue;
    centers.push([p, r]);
  }
  const leaves = [];
  const hueT = rnd();
  centers.forEach(([p, r], i) => {
    const g = lumpyBlob(r, 2, 0.22, seed * 31 + i);
    placed(g, p.x, p.y, p.z, rnd() * 3, rnd() * 3, rnd() * 3, 1, sp.flat, 1);
    leaves.push(shadeFoliage(g, C, R, Math.min(1, Math.max(0, hueT + (rnd() - 0.5) * 0.55)), 0, p));
  });
  return kind === 'tall' ? { trunk: wood, leaf: [], leafDark: leaves } : { trunk: wood, leaf: leaves, leafDark: [] };
}

// Bush: a dome of small leaf clusters
export function buildBush(seed, scale = 1) {
  const rnd = mulberry32(seed);
  const C = new THREE.Vector3(0, 0.5 * scale, 0), R = new THREE.Vector3(0.95 * scale, 0.62 * scale, 0.6 * scale);
  const list = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + rnd() * 0.5, u = i / (n - 1);
    const rr = Math.sqrt(1 - u) * 0.8;
    const r = (0.3 + rnd() * 0.12) * scale;
    const g = placed(lumpyBlob(r, 1, 0.14, seed + i * 7), Math.cos(a) * rr * R.x, (0.28 + 0.62 * u) * R.y + r * 0.4, Math.sin(a) * rr * R.z, rnd() * 3, rnd() * 3, 0, 1, 0.85, 1);
    list.push(shadeFoliage(g, C, R, 0.3 + 0.4 * rnd()));
  }
  return mergeAll(list);
}
