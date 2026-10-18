// Distant set dressing: the stone castle on its hill across the river (+Z), a ruined-tower silhouette in the
// misty -Z background, and a ring of low-poly faceted mountains on the horizon.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { flatten, boxUV, merge, faceColors, hash2 } from './wutil.js';
import { brickTexture, roofTexture } from './textures.js';
import { groundHeight, CASTLE_POS } from './terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return g;
}
function cyl(r, h, x, y, z, seg = 10, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, true);
  g.translate(x, y + h / 2, z);
  return g;
}
function cone(r, h, x, y, z, seg = 10) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, true);
  g.translate(x, y + h / 2, z);
  return g;
}
// crenellated ring of merlons around a round tower top
function merlonsRing(r, x, y, z, n = 10, mw = 0.7, mh = 0.8) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    list.push(box(mw, mh, 0.6, x + Math.cos(a) * r, y, z + Math.sin(a) * r, -a + Math.PI / 2));
  }
  return list;
}
function merlonsLine(x0, z0, x1, z1, y, step = 1.4, mw = 0.75, mh = 0.75, th = 0.7) {
  const list = [];
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / step);
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0.5;
    list.push(box(mw, mh, th, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, ry));
  }
  return list;
}

function stoneify(list, uvScale = 0.5) {
  return list.map((g) => boxUV(flatten(g), uvScale));
}

export function buildCastle() {
  const cx = CASTLE_POS.x, cz = CASTLE_POS.z;
  const gy = groundHeight(cx, cz);
  const stone = [], roofs = [], dark = [];
  const B = gy - 2.5; // foundations sink into the hill
  // curtain wall rectangle (front faces -Z, toward the river/camera)
  const W = 24, D = 16, wallH = 8.5;
  const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const horizontal = Math.abs(z1 - z0) < 0.01;
    stone.push(box(horizontal ? len : 1.4, wallH + 2.5, horizontal ? 1.4 : len, cx + (x0 + x1) / 2, B, cz + (z0 + z1) / 2));
    stone.push(...merlonsLine(cx + x0, cz + z0, cx + x1, cz + z1, gy + wallH));
  }
  // corner towers with conical roofs
  for (const [x, z] of corners) {
    const r = 2.5, h = 13.5;
    stone.push(cyl(r, h + 2.5, cx + x, B, cz + z, 12));
    stone.push(cyl(r + 0.35, 1.0, cx + x, gy + h - 0.2, cz + z, 12)); // corbel band
    roofs.push(cone(r + 0.7, 6.5, cx + x, gy + h + 0.8, cz + z, 12));
    dark.push(box(0.35, 1.4, 0.4, cx + x, gy + h - 4, cz + z - r - 0.05)); // window slit (front)
  }
  // gatehouse (front centre)
  stone.push(box(7, wallH + 4.5, 4, cx, B, cz - D / 2));
  stone.push(...merlonsLine(cx - 3.3, cz - D / 2 - 2, cx + 3.3, cz - D / 2 - 2, gy + wallH + 2));
  dark.push(box(3.0, 4.6, 0.3, cx, gy, cz - D / 2 - 2.05));                          // gate opening
  dark.push(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(cx, gy + 4.6, cz - D / 2 - 2.05));
  for (const sx of [-1, 1]) {
    stone.push(cyl(1.6, wallH + 6.5, cx + sx * 4.2, B, cz - D / 2 - 1.6, 10));
    roofs.push(cone(2.2, 4.5, cx + sx * 4.2, gy + wallH + 4.0, cz - D / 2 - 1.6, 10));
  }
  // keep: tall central block with three towers (the reference silhouette)
  const kx = cx + 1, kz = cz + 2;
  stone.push(box(10, 18 + 2.5, 8, kx, B, kz));
  stone.push(...merlonsLine(kx - 5, kz - 4, kx + 5, kz - 4, gy + 18));
  stone.push(...merlonsLine(kx - 5, kz + 4, kx + 5, kz + 4, gy + 18));
  for (const [tx, tz, r, h, rh] of [[kx - 4.6, kz - 3.2, 2.6, 24, 8.5], [kx + 4.6, kz - 3.2, 2.6, 22.5, 8], [kx + 0.3, kz + 1.5, 3.3, 29, 10.5]]) {
    stone.push(cyl(r, h + 2.5, tx, B, tz, 12));
    stone.push(cyl(r + 0.4, 1.1, tx, gy + h - 0.3, tz, 12));
    roofs.push(cone(r + 0.8, rh, tx, gy + h + 0.8, tz, 12));
    for (let k = 0; k < 3; k++) dark.push(box(0.4, 1.5, 0.4, tx + (k - 1) * 1.1, gy + h - 5 - k * 4.5, tz - r - 0.02));
  }
  // keep windows
  for (let k = 0; k < 3; k++) for (let l = 0; l < 2; l++) dark.push(box(0.6, 1.6, 0.3, kx - 2.5 + k * 2.5, gy + 10 + l * 4, kz - 4.1));
  // a few flags on the tallest roofs
  const flags = [];
  for (const [tx, tz, top] of [[kx + 0.3, kz + 1.5, gy + 29 + 0.8 + 10.5], [kx - 4.6, kz - 3.2, gy + 24 + 0.8 + 8.5]]) {
    dark.push(cyl(0.08, 3, tx, top - 0.3, tz, 4));
    const f = new THREE.PlaneGeometry(2.2, 1.2, 4, 1); f.translate(tx + 1.1, top + 2.0, tz);
    flags.push(f);
  }

  const stoneGeo = merge(stoneify(stone, 0.5));
  // subtle per-face tint variation + darker toward the base
  faceColors(stoneGeo, (c, n, i) => {
    const v = 0.88 + 0.12 * hash2(i, 3, 5);
    const base = THREE.MathUtils.clamp((c.y - gy) / 6, 0, 1);
    return new THREE.Color(0xb8b4c2).multiplyScalar(v * (0.82 + 0.18 * base));
  });
  const roofGeo = merge(roofs.map((g) => { const f = flatten(g); const uv = f.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3); return f; }));
  const darkGeo = merge(dark.map(flatten));
  const stoneMesh = new THREE.Mesh(stoneGeo, new THREE.MeshLambertMaterial({ map: brickTexture(), vertexColors: true, flatShading: true }));
  const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ map: roofTexture(), color: 0x86506a, flatShading: true }));
  const darkMesh = new THREE.Mesh(darkGeo, new THREE.MeshLambertMaterial({ color: 0x24222a }));
  const flagMesh = new THREE.Mesh(merge(flags.map((g) => g.toNonIndexed())), new THREE.MeshLambertMaterial({ color: 0xc8343a, side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.name = 'castle';
  group.add(stoneMesh, roofMesh, darkMesh, flagMesh);
  // flags flutter: vertex wave growing from the pole (pole at local x = 0 of each flag)
  const fp = flagMesh.geometry.attributes.position;
  const rest = Float32Array.from(fp.array);
  const poles = [kx + 0.3, kx - 4.6];
  const uArr = new Float32Array(fp.count);
  for (let i = 0; i < fp.count; i++) {
    const x0 = rest[i * 3];
    const pole = poles.reduce((b, px) => (Math.abs(x0 - px - 1.1) < Math.abs(x0 - b - 1.1) ? px : b), poles[0]);
    uArr[i] = Math.max(0, x0 - pole);
  }
  const flutter = (t) => {
    for (let i = 0; i < fp.count; i++) {
      const u = uArr[i];
      fp.array[i * 3 + 2] = rest[i * 3 + 2] + Math.sin(t * 5.5 - u * 2.6) * 0.16 * u;
      fp.array[i * 3 + 1] = rest[i * 3 + 1] - u * 0.06;
    }
    fp.needsUpdate = true;
  };
  return { group, flutter };
}

// Ruined towers in the misty background (-Z), and a smaller watchtower.
export function buildRuins() {
  const rand = rng(99);
  const parts = [];
  const spots = [[-34, -78, 3.2, 17], [-27, -81, 2.4, 11], [-40, -74, 2.0, 8], [46, -96, 2.6, 14]];
  for (const [x, z, r, h] of spots) {
    const gy = groundHeight(x, z) - 1.5;
    const g = new THREE.CylinderGeometry(r, r * 1.08, h, 9, 3, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > h / 2 - 0.1) p.setY(i, h / 2 - rand() * h * 0.28); // broken top
    }
    g.translate(x, gy + h / 2, z);
    parts.push(boxUV(flatten(g), 0.5));
  }
  parts.push(boxUV(flatten(box(9, 6, 1.2, -31, groundHeight(-31, -79) - 1.5, -79.5)), 0.5));
  const geo = merge(parts);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: brickTexture(), color: 0xa9a6b4, flatShading: true, side: THREE.DoubleSide }));
  mesh.name = 'ruins';
  return mesh;
}

// Horizon ring of faceted low-poly mountains (vertex coloured, they sink into the mist).
export function buildMountains() {
  const rand = rng(31337);
  const geos = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const az = (i / N) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    // keep the castle direction (az ~ 0.16 rad from +Z) less cluttered: lower peaks there
    const towardCastle = Math.abs(Math.atan2(Math.sin(az - 0.16), Math.cos(az - 0.16))) < 0.35;
    const R = 175 + rand() * 90;
    const r = 40 + rand() * 45;
    const h = (towardCastle ? 22 : 30) + rand() * (towardCastle ? 14 : 38);
    const seg = 5 + Math.floor(rand() * 3);
    const g = new THREE.ConeGeometry(r, h, seg, 2, true);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      const j = y > h / 2 - 0.01 ? 0.12 : 0.18;
      p.setXYZ(k, p.getX(k) * (1 + (rand() - 0.5) * j * 2), y + (y > -h / 2 + 0.01 && y < h / 2 - 0.01 ? (rand() - 0.5) * h * 0.18 : 0), p.getZ(k) * (1 + (rand() - 0.5) * j * 2));
    }
    g.rotateY(rand() * Math.PI);
    g.translate(Math.sin(az) * R, h / 2 - 6, Math.cos(az) * R);
    geos.push(flatten(g));
  }
  const geo = merge(geos);
  const lo = new THREE.Color(0x9fb14a), hi = new THREE.Color(0xd2d77c), sh = new THREE.Color(0x7e9440);
  faceColors(geo, (c, n, i) => {
    const t = THREE.MathUtils.clamp(c.y / 50, 0, 1);
    const col = lo.clone().lerp(hi, t * 0.8);
    col.lerp(sh, Math.max(0, -n.x * 0.5 + n.z * 0.2) * 0.4);
    return col.multiplyScalar(0.94 + 0.12 * hash2(i, 1, 2));
  });
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.name = 'mountains';
  return mesh;
}
