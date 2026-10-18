// Trees (big autumn tree + scattered trees), bushes, grass tufts, reeds and pixel flowers.
// Trunks are merged faceted cylinders; every leaf block in the world is ONE InstancedMesh of cubes
// (per-instance colour + wind sway in the vertex shader). Grass/reeds/flowers are InstancedMeshes.
import * as THREE from 'three';
import { rng, smoothstep, clamp, lerp } from '../core/util.js';
import { limb, merge, flatten, patchSway, noise2, hash2 } from './wutil.js';
import { leafTexture, barkTexture } from './textures.js';
import { litMaterial } from './litmat.js';
import { groundHeight, riverCenter, riverHalfWidth, RIVER } from './terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Tree builder -> { trunk: [geometries], leaves: [{p, s:[sx,sy,sz], rot:[x,y,z], color}] }
// ---------------------------------------------------------------------------------------------
const PALETTES = {
  autumn: [0xffd447, 0xf7c235, 0xe8b23a, 0xc2b440, 0xa9ae3c, 0xf59a32, 0xffe27a, 0xe8822e, 0xfff0a0],
  golden: [0xffe27a, 0xffd04f, 0xf5c040, 0xe6d064, 0xfff2b0, 0xd8b84a],
  orange: [0xf59a32, 0xe8822e, 0xffb44a, 0xd96a2c, 0xffcc55, 0xc9622a],
  green: [0x8cc43a, 0x76b432, 0xa2d044, 0xb6d84e, 0x6aa42e, 0xc4dc56],
  olive: [0xa8b23e, 0x98a83a, 0xc0c050, 0xd2c452, 0x8c9a36],
};

function tree(rand, o) {
  const { x, z, h = 6, trunkR = 0.25, pal = 'autumn', spread = 1, cube = 0.5, density = 1, lean = 0, limbs = 4, barkCol = 0x8d8288 } = o;
  const y0 = groundHeight(x, z) - 0.15;
  const trunk = [];
  const leaves = [];
  const shadowBoxes = []; // coarse canopy boxes used only for the sun shadow map
  const colors = PALETTES[pal];
  const pick = () => new THREE.Color(colors[Math.floor(rand() * colors.length)]);
  const forkY = h * (o.fork ?? (0.4 + rand() * 0.06));
  const base = V(x, y0, z);
  const leanDir = V(Math.cos(lean), 0, Math.sin(lean)).multiplyScalar(0.06 * h);
  const fork = V(x, y0 + forkY, z).add(leanDir);
  const r1 = trunkR * 0.7;
  trunk.push(limb(base, fork, trunkR, r1, 8, 2.2, rand()));
  // flared base (a short faceted frustum) + a few low root humps, mostly buried
  trunk.push(limb(V(x, y0 - 0.05, z), V(x, y0 + 0.15 + trunkR * 1.6, z).add(leanDir.clone().multiplyScalar(0.12)), trunkR * 1.65, trunkR * 1.02, 8, 2.2, rand()));
  const nRoots = trunkR > 0.3 ? 5 : 3;
  for (let i = 0; i < nRoots; i++) {
    const a = (i / nRoots) * Math.PI * 2 + rand() * 0.6;
    const out = V(x + Math.cos(a) * trunkR * 2.5, y0 + 0.08, z + Math.sin(a) * trunkR * 2.5);
    trunk.push(limb(out, V(x + Math.cos(a) * trunkR * 1.0, y0 + 0.15 + trunkR * 0.5, z + Math.sin(a) * trunkR * 1.0), trunkR * 0.16, trunkR * 0.32, 5, 2.2));
  }
  // cluster helper: shell-weighted ellipsoid of cubes
  const cluster = (c, rx, ry, rz, n) => {
    shadowBoxes.push({ p: c.clone(), s: [rx * 1.35, ry * 1.25, rz * 1.35], rot: [0, rand() * Math.PI, 0] });
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      const rr = 0.62 + 0.38 * Math.pow(rand(), 0.5);
      const p = V(c.x + Math.cos(th) * sq * rx * rr, c.y + u * ry * rr * (u < 0 ? 0.75 : 1), c.z + Math.sin(th) * sq * rz * rr);
      const s = cube * (0.75 + rand() * 0.45);
      const col = pick();
      if (p.y < c.y - ry * 0.3) col.multiplyScalar(0.82); // underside a touch darker
      leaves.push({ p, s: [s * (0.9 + rand() * 0.3), s * (0.75 + rand() * 0.3), s * (0.9 + rand() * 0.3)], rot: [(rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5], color: col });
    }
  };
  const canopyY = y0 + h * 0.64;
  const R = h * 0.44 * spread;
  // main limbs
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rand() * 0.9;
    const outR = R * (0.55 + rand() * 0.35);
    const end = V(fork.x + Math.cos(a) * outR, canopyY + (rand() - 0.3) * h * 0.18, fork.z + Math.sin(a) * outR * 0.85);
    const mid = fork.clone().lerp(end, 0.5).add(V(0, h * 0.08, 0));
    trunk.push(limb(fork, mid, r1 * 0.72, r1 * 0.5, 6, 2.2));
    trunk.push(limb(mid, end, r1 * 0.5, r1 * 0.22, 6, 2.2));
    // side twig
    const tw = mid.clone().add(V(Math.cos(a + 1.2) * R * 0.35, h * 0.12, Math.sin(a + 1.2) * R * 0.3));
    trunk.push(limb(mid, tw, r1 * 0.3, r1 * 0.12, 5, 2.2));
    const cs = R * (0.5 + rand() * 0.2);
    cluster(end, cs, cs * 0.66, cs, Math.round(30 * density * (cs / (cube * 2.6)) ** 2 + 6));
    cluster(tw, cs * 0.7, cs * 0.55, cs * 0.7, Math.round(14 * density * (cs / (cube * 2.6)) ** 2 + 4));
  }
  // crown + centre fill
  const top = V(fork.x, canopyY + h * 0.14, fork.z);
  trunk.push(limb(fork, top, r1 * 0.6, r1 * 0.2, 6, 2.2));
  cluster(top, R * 0.66, R * 0.46, R * 0.66, Math.round(34 * density * (R / (cube * 4.5)) ** 2 + 8));
  cluster(V(fork.x, canopyY - h * 0.03, fork.z), R * 0.85, R * 0.34, R * 0.85, Math.round(30 * density * (R / (cube * 4.5)) ** 2 + 6));
  return { trunk, leaves, barkCol, shadowBoxes };
}

function bush(rand, x, z, size = 0.6, pal = 'green', shadowBoxes = null) {
  const leaves = [];
  if (shadowBoxes) shadowBoxes.push({ p: V(x, groundHeight(x, z) + size * 0.35, z), s: [size * 1.1, size * 0.7, size * 1.1], rot: [0, rand() * 3, 0] });
  const colors = PALETTES[pal];
  const y0 = groundHeight(x, z);
  const n = Math.round(7 + size * 12);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, u = rand();
    const r = Math.sqrt(1 - u * u) * size * 0.62, hy = u * size * 0.55;
    const s = size * (0.3 + rand() * 0.2);
    const p = V(x + Math.cos(a) * r, y0 + s * 0.3 + hy, z + Math.sin(a) * r);
    const col = new THREE.Color(colors[Math.floor(rand() * colors.length)]);
    leaves.push({ p, s: [s, s * 0.8, s], rot: [(rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3], color: col });
  }
  return leaves;
}

// ---------------------------------------------------------------------------------------------
export function buildTrees() {
  const rand = rng(1234);
  const trunks = [];
  const groups = []; // leaf groups -> one InstancedMesh each (frustum culled separately)
  const proxies = []; // shadow-only canopy boxes
  const add = (t, name, castShadow) => {
    const c = new THREE.Color(t.barkCol);
    for (const g of t.trunk) {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      trunks.push(g);
    }
    groups.push({ name, leaves: t.leaves, castShadow });
    if (castShadow) proxies.push(...t.shadowBoxes);
  };
  // THE big autumn tree behind the seats
  add(tree(rand, { x: 0.6, z: -2.6, h: 7.6, trunkR: 0.42, pal: 'autumn', spread: 1.05, cube: 0.6, density: 1.0, limbs: 5, fork: 0.34, barkCol: 0xb8aeb0 }), 'bigTree', true);
  // scattered trees (none within 1.2 m of the seats, sight-lines across the river kept clear)
  const spots = [
    [-5.2, -4.8, 5.2, 'golden'], [5.8, -5.4, 5.6, 'orange'], [-9.5, -2.0, 6.0, 'green'], [10.5, -3.2, 5.4, 'autumn'],
    [-3.0, -9.5, 6.4, 'olive'], [3.6, -11.0, 6.8, 'golden'], [-13.5, -8.5, 7.0, 'autumn'], [14.0, -9.5, 6.6, 'green'],
    [-1.0, -16.0, 7.2, 'orange'], [8.5, -16.5, 6.2, 'olive'], [-8.5, -15.0, 6.5, 'golden'], [-20, -5, 7, 'green'],
    [20, -6, 7, 'golden'], [-17, 1.0, 6.0, 'orange'], [17.5, 0.0, 6.2, 'olive'],
    // across the river, flanking (keeps the castle / wide sight-lines open)
    [-10.5, 9.0, 5.5, 'autumn'], [-15, 14, 6.5, 'green'], [-7.5, 16, 5.0, 'golden'], [17, 11, 6.0, 'orange'],
    [23, 20, 7.0, 'green'], [-22, 24, 7.0, 'golden'], [-28, 10, 6.5, 'olive'], [28, 6, 6.0, 'autumn'],
    [-6, 30, 6.5, 'green'], [-14, 38, 7.5, 'autumn'], [30, 34, 7.0, 'golden'], [-30, -18, 7.5, 'orange'], [26, -22, 7.5, 'autumn'],
  ];
  spots.forEach(([x, z, h, pal], i) => {
    const d = Math.hypot(x, z);
    const far = d > 14;
    add(tree(rand, { x, z, h, trunkR: 0.16 + h * 0.022, pal, spread: 0.85 + rand() * 0.25, cube: (far ? 0.7 : 0.52) + h * 0.03, density: far ? 0.6 : 0.8, limbs: 3 + Math.floor(rand() * 2), lean: rand() * 6.28, barkCol: rand() < 0.5 ? 0xa0948e : 0x988a80 }),
      'tree' + i, d < 9);
  });
  // bushes / small blocky plants, grouped by side for culling
  const bushSpots = [
    [-1.9, -2.3, 0.55, 'green'], [2.3, -2.9, 0.7, 'green'], [-0.9, -3.4, 0.5, 'olive'], [3.4, -1.9, 0.45, 'green'],
    [-3.6, -3.0, 0.75, 'green'], [4.9, -3.4, 0.6, 'olive'], [-4.9, -1.0, 0.5, 'green'], [-6.5, -3.6, 0.8, 'green'],
    [7.0, -2.0, 0.7, 'olive'], [-7.2, 1.0, 0.55, 'green'], [8.2, 0.8, 0.6, 'green'], [-4.6, 4.9, 0.5, 'olive'],
    [5.6, 5.2, 0.55, 'green'], [-8.0, 5.5, 0.7, 'green'], [9.5, 6.0, 0.7, 'olive'], [-2.6, -6.5, 0.8, 'green'],
    [6.5, -7.2, 0.9, 'olive'], [-11, -4.5, 0.9, 'green'], [12, 3, 0.8, 'green'], [-12, 4, 0.8, 'olive'],
  ];
  const bushGroups = { bushesNear: [], bushesLeft: [], bushesRight: [], bushesFar: [] };
  for (const [x, z, sz, pal] of bushSpots) {
    const key = z > 3.6 ? 'bushesFar' : Math.abs(x) < 5 ? 'bushesNear' : x < 0 ? 'bushesLeft' : 'bushesRight';
    bushGroups[key].push(...bush(rand, x, z, sz, pal, key === 'bushesNear' ? proxies : null));
  }
  for (const [k, list] of Object.entries(bushGroups)) groups.push({ name: k, leaves: list, castShadow: false });

  // ---- trunk mesh
  const trunkGeo = merge(trunks);
  const trunkMat = litMaterial({ map: barkTexture(), vertexColors: true });
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.name = 'trunks';
  trunkMesh.castShadow = true; trunkMesh.receiveShadow = false;

  // ---- leaf cubes: shared geometry + material, one InstancedMesh per tree / bush group
  const box = new THREE.BoxGeometry(1, 1, 1); // indexed: 24 verts / cube (vertex cache friendly)
  const leafMat = litMaterial({ map: leafTexture(), glow: 0.16, vertexColors: true, instAttr: true, sway: `
    float hgt = smoothstep(0.8, 6.0, inst.y);
    float ph = dot(inst.xz, vec2(0.37, 0.23));
    sway = vec3(sin(uTime * 1.15 + ph) + 0.4 * sin(uTime * 2.7 + ph * 3.1), 0.25 * sin(uTime * 1.6 + ph * 2.0), 0.6 * cos(uTime * 0.93 + ph * 1.7)) * (0.022 + 0.05 * uWind) * hgt;` });
  const leafGroup = new THREE.Group();
  leafGroup.name = 'leaves';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  let leafCount = 0;
  for (const G of groups) {
    if (!G.leaves.length) continue;
    // front-to-back for the usual cameras on the +Z side (better early-z rejection of hidden cubes)
    const eye = V(0.5, 1.2, 7);
    const list = G.leaves.slice().sort((a, b) => a.p.distanceToSquared(eye) - b.p.distanceToSquared(eye));
    // merged static geometry (SwiftShader handles big instance counts poorly); aInst = cube centre for sway
    const bp = box.attributes.position, bn = box.attributes.normal, bu = box.attributes.uv, bi = box.index;
    const nv = bp.count, ni = bi.count, n = list.length;
    const P = new Float32Array(n * nv * 3), Nn = new Float32Array(n * nv * 3), U = new Float32Array(n * nv * 2), Cc = new Float32Array(n * nv * 3), I = new Float32Array(n * nv * 3);
    const idx = new Uint32Array(n * ni);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    list.forEach((L, c) => {
      q.setFromEuler(e.set(L.rot[0], L.rot[1], L.rot[2]));
      m.compose(L.p, q, s.set(L.s[0], L.s[1], L.s[2]));
      nm.getNormalMatrix(m);
      for (let k = 0; k < nv; k++) {
        const o = c * nv + k;
        v.fromBufferAttribute(bp, k).applyMatrix4(m); P.set([v.x, v.y, v.z], o * 3);
        v.fromBufferAttribute(bn, k).applyMatrix3(nm).normalize(); Nn.set([v.x, v.y, v.z], o * 3);
        U.set([bu.getX(k), bu.getY(k)], o * 2);
        Cc.set([L.color.r, L.color.g, L.color.b], o * 3);
        I.set([L.p.x, L.p.y, L.p.z], o * 3);
      }
      for (let k = 0; k < ni; k++) idx[c * ni + k] = bi.getX(k) + c * nv;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    g.setAttribute('aInst', new THREE.BufferAttribute(I, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    g.boundingSphere.radius += 0.2; // sway margin
    const im = new THREE.Mesh(g, leafMat);
    im.name = 'leaves_' + G.name;
    im.castShadow = false; im.receiveShadow = false; // shadows come from the proxy below
    leafGroup.add(im);
    leafCount += list.length;
  }
  // Shadow-only proxy: a few big boxes per canopy cluster. Drawn into the shadow map only (count is zeroed
  // for the camera pass), which keeps the 1000s of leaf cubes out of the (fill-rate bound) shadow pass.
  const proxy = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), proxies.length);
  proxies.forEach((B, i) => {
    q.setFromEuler(e.set(B.rot[0], B.rot[1], B.rot[2]));
    m.compose(B.p, q, s.set(B.s[0], B.s[1], B.s[2]));
    proxy.setMatrixAt(i, m);
  });
  proxy.instanceMatrix.needsUpdate = true;
  proxy.computeBoundingSphere();
  proxy.name = 'leafShadowProxy';
  proxy.castShadow = true; proxy.receiveShadow = false;
  const N = proxies.length;
  proxy.onBeforeShadow = () => { proxy.count = N; };
  proxy.onAfterShadow = () => { proxy.count = 0; };
  proxy.onBeforeRender = () => { proxy.count = 0; };
  proxy.count = 0;
  leafGroup.add(proxy);
  return { trunkMesh, leafMesh: leafGroup, leafCount };
}

// ---------------------------------------------------------------------------------------------
// Grass tufts, reeds and flowers
// ---------------------------------------------------------------------------------------------
function tuftGeometry(rand, blades, hMin, hMax, spread, wBase, colBase, colTip) {
  const pos = [], col = [], nor = [];
  const cb = new THREE.Color(colBase), ct = new THREE.Color(colTip);
  for (let i = 0; i < blades; i++) {
    const a = rand() * Math.PI * 2, r = rand() * spread;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const h = lerp(hMin, hMax, rand());
    const yaw = rand() * Math.PI;
    const lean = 0.15 + rand() * 0.35;
    const tx = bx + Math.cos(a) * h * lean, tz = bz + Math.sin(a) * h * lean;
    const wx = Math.cos(yaw) * wBase, wz = Math.sin(yaw) * wBase;
    pos.push(bx - wx, 0, bz - wz, bx + wx, 0, bz + wz, tx, h, tz);
    const tipC = ct.clone().multiplyScalar(0.9 + rand() * 0.2);
    col.push(cb.r, cb.g, cb.b, cb.r, cb.g, cb.b, tipC.r, tipC.g, tipC.b);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function flowerGeometry() {
  // stem (two crossed thin blades, green) + a pixel head (small box, aHead = 1 takes the instance colour)
  const pos = [], col = [], nor = [], head = [];
  const g0 = new THREE.Color(0x5f9a2c), g1 = new THREE.Color(0x7fb436);
  const H = 0.13;
  for (const [dx, dz] of [[0.006, 0], [0, 0.006]]) {
    pos.push(-dx, 0, -dz, dx, 0, dz, 0, H, 0);
    col.push(g0.r, g0.g, g0.b, g0.r, g0.g, g0.b, g1.r, g1.g, g1.b);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); head.push(0, 0, 0);
  }
  // leaf
  pos.push(0, 0.03, 0, 0.05, 0.08, 0.012, 0.004, 0.07, 0);
  col.push(g0.r, g0.g, g0.b, g1.r, g1.g, g1.b, g1.r, g1.g, g1.b);
  nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); head.push(0, 0, 0);
  const b = new THREE.BoxGeometry(0.03, 0.018, 0.03).toNonIndexed();
  b.translate(0, H + 0.008, 0);
  const bp = b.attributes.position, bn = b.attributes.normal;
  for (let i = 0; i < bp.count; i++) {
    pos.push(bp.getX(i), bp.getY(i), bp.getZ(i));
    const top = bn.getY(i) > 0.5 ? 1.0 : 0.82;
    col.push(top, top, top);
    nor.push(bn.getX(i), Math.max(0.3, bn.getY(i)), bn.getZ(i)); head.push(1);
  }
  // centre pixel (yellow) on top
  const c = new THREE.BoxGeometry(0.011, 0.022, 0.011).toNonIndexed();
  c.translate(0, H + 0.01, 0);
  const cp = c.attributes.position;
  for (let i = 0; i < cp.count; i++) { pos.push(cp.getX(i), cp.getY(i), cp.getZ(i)); col.push(1.0, 0.85, 0.2); nor.push(0, 1, 0); head.push(0); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aHead', new THREE.Float32BufferAttribute(head, 1));
  return g;
}

// Keep-out zones for vegetation: [x, z, radius]
const KEEP_OUT = [
  [-0.55, -0.05, 0.62], [0.80, 0.05, 0.66],   // seats
  [-0.45, 0.6, 0.35], [0.35, 0.62, 0.32],     // ending stand spots (short tufts only around)
  [0.6, -2.6, 0.75],                          // big tree trunk
];
function blocked(x, z, extra = 0) {
  for (const [kx, kz, r] of KEEP_OUT) if (Math.hypot(x - kx, z - kz) < r + extra) return true;
  return false;
}
function riverDist(x, z) { return Math.abs(z - riverCenter(x)) - riverHalfWidth(x); }

export function buildGrass() {
  const rand = rng(777);
  const sway = `
    float hgt = objPos.y;
    float ph = dot(inst.xz, vec2(1.7, 1.3));
    float g = sin(uTime * 1.9 + ph) * 0.6 + sin(uTime * 3.3 + ph * 1.7) * 0.25;
    sway = vec3(g, 0.0, g * 0.4) * hgt * hgt * (0.35 + 1.1 * uWind);`;
  const mkMat = () => litMaterial({ vertexColors: true, side: THREE.DoubleSide, upNormal: true, sway });

  // --- short tufts (everywhere on the meadow, dense near the action)
  const tuft = tuftGeometry(rand, 6, 0.06, 0.15, 0.05, 0.011, 0x92bc36, 0xdcef64);
  const tufts = [];
  const tryPlace = (n, area, test) => {
    let placed = 0, guard = 0;
    while (placed < n && guard++ < n * 20) {
      const x = area[0] + rand() * (area[1] - area[0]), z = area[2] + rand() * (area[3] - area[2]);
      if (!test(x, z)) continue;
      tufts.push([x, z]); placed++;
    }
  };
  const meadow = (x, z) => riverDist(x, z) > 0.12 && !blocked(x, z) && groundHeight(x, z) > -0.05;
  tryPlace(650, [-5, 5, -3.5, 1.65], (x, z) => meadow(x, z) && !(Math.abs(x + 0.6) < 0.15 && Math.abs(z - 0.5) < 0.12));
  tryPlace(380, [-5, 6, 3.6, 7], meadow);
  tryPlace(1100, [-16, 16, -14, 14], (x, z) => meadow(x, z) && !(Math.abs(x) < 5 && z > -3.5 && z < 7));
  tryPlace(450, [-35, 35, -30, 30], (x, z) => meadow(x, z) && Math.hypot(x, z) > 14);
  const tuftMesh = new THREE.InstancedMesh(tuft, mkMat(), tufts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  tufts.forEach(([x, z], i) => {
    const sc = 0.8 + rand() * 0.5 + Math.min(0.8, Math.max(0, Math.hypot(x, z) - 8) * 0.03);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(p.set(x, groundHeight(x, z) - 0.005, z), q, s.set(sc, sc * (0.8 + rand() * 0.5), sc));
    tuftMesh.setMatrixAt(i, m);
    tuftMesh.setColorAt(i, c.setRGB(0.92 + rand() * 0.12, 0.95 + rand() * 0.08, 0.85 + rand() * 0.2));
  });
  tuftMesh.name = 'grassTufts';
  tuftMesh.receiveShadow = true;

  // --- tall reeds / dark olive tufts (bank edges, meadow edges, far side)
  const reed = tuftGeometry(rand, 9, 0.26, 0.58, 0.07, 0.015, 0x6c7e2a, 0xb8bc52);
  const reeds = [];
  let guard = 0;
  while (reeds.length < 260 && guard++ < 20000) {
    const x = -24 + rand() * 48, z = -14 + rand() * 32;
    const rd = riverDist(x, z);
    const nearBank = rd > 0.05 && rd < 0.7;
    const meadowEdge = Math.hypot(x * 0.6, (z + 1) * 0.9) > 6.5;
    if (!(nearBank ? rand() < 0.9 : meadowEdge && rand() < 0.35)) continue;
    if (rd < 0.05 || blocked(x, z, 0.6)) continue;
    // keep the central near/far banks clear (camera sight-lines; hook shot is low over the river)
    if (Math.abs(x - 0.3) < 3.2 && z > -3.5 && z < 6.5) continue;
    if (x > -2.5 && x < 9 && z > 5 && z < 15) continue; // wide / establishing camera foregrounds
    if (x > 0.5 && x < 7 && z > -0.5 && z < 1.6) continue; // Jesus's walk path
    reeds.push([x, z]);
  }
  const reedMesh = new THREE.InstancedMesh(reed, mkMat(), reeds.length);
  reeds.forEach(([x, z], i) => {
    const sc = 0.8 + rand() * 0.6;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(p.set(x, groundHeight(x, z) - 0.01, z), q, s.set(sc, sc * (0.8 + rand() * 0.5), sc));
    reedMesh.setMatrixAt(i, m);
    reedMesh.setColorAt(i, c.setRGB(0.85 + rand() * 0.25, 0.85 + rand() * 0.2, 0.8 + rand() * 0.25));
  });
  reedMesh.name = 'reeds';
  reedMesh.castShadow = false; reedMesh.receiveShadow = true;

  // --- flowers (pink / yellow / white / lilac pixel heads)
  const fl = flowerGeometry();
  const flowerMat = litMaterial({ vertexColors: true, side: THREE.DoubleSide, sway, extraAttribs: 'attribute float aHead;',
    colorMix: 'vColor = color * mix(vec3(1.0), instanceColor, aHead);' });
  const heads = [0xff8fc0, 0xffe25a, 0xffffff, 0xd9a8ff, 0xff6f8a, 0xfff2a8];
  const flowers = [];
  guard = 0;
  while (flowers.length < 520 && guard++ < 30000) {
    const near = flowers.length < 200;
    const x = near ? -5 + rand() * 11 : -18 + rand() * 36, z = near ? -3.5 + rand() * 11 : -14 + rand() * 30;
    if (!meadow(x, z) || blocked(x, z, 0.1)) continue;
    // little patches: accept more where noise is high
    if (noise2(x * 0.8, z * 0.8, 31) < 0.1) continue;
    flowers.push([x, z]);
  }
  const flowerMesh = new THREE.InstancedMesh(fl, flowerMat, flowers.length);
  flowers.forEach(([x, z], i) => {
    const sc = 0.7 + rand() * 0.6;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(p.set(x, groundHeight(x, z) - 0.005, z), q, s.set(sc, sc * (0.8 + rand() * 0.6), sc));
    flowerMesh.setMatrixAt(i, m);
    flowerMesh.setColorAt(i, c.set(heads[Math.floor(rand() * heads.length)]));
  });
  flowerMesh.name = 'flowers';
  flowerMesh.receiveShadow = true;

  for (const im of [tuftMesh, reedMesh, flowerMesh]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  return { tuftMesh, reedMesh, flowerMesh, counts: { tufts: tufts.length, reeds: reeds.length, flowers: flowers.length } };
}
