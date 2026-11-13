import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mulberry} from '../lib/math';

/** Builds the whole static low-poly town as a handful of merged, vertex-coloured meshes. */
type Bucket = THREE.BufferGeometry[];
const col = new THREE.Color();

const prep = (g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) => {
  let geo = g.index ? g.toNonIndexed() : g;
  geo.applyMatrix4(m);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  col.set(color).convertSRGBToLinear();
  for (let i = 0; i < n; i++) {
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  // drop attributes not shared by all
  Object.keys(geo.attributes).forEach((k) => {
    if (!['position', 'normal', 'color', 'uv'].includes(k)) geo.deleteAttribute(k);
  });
  return geo;
};

const mat4 = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );

const box = (b: Bucket, w: number, h: number, d: number, x: number, y: number, z: number, color: string, ry = 0) =>
  b.push(prep(new THREE.BoxGeometry(w, h, d), color, mat4(x, y, z, ry)));

export type TownGeo = Record<'solid' | 'glass' | 'bulbs' | 'foliage' | 'road' | 'warm', THREE.BufferGeometry>;

const WALLS = ['#c86b4a', '#d9a441', '#ead7b5', '#4f9a94', '#e48f73', '#9db383', '#b5523b', '#a7c4d8', '#e6c07a', '#d47f5f'];
const AWN = ['#c83a3a', '#2f7a5a', '#2c5d8f', '#e0a12b', '#7b3f8c'];

export const buildTown = (seed = 4): TownGeo => {
  const r = mulberry(seed);
  const solid: Bucket = [];
  const glass: Bucket = [];
  const bulbs: Bucket = [];
  const foliage: Bucket = [];
  const road: Bucket = [];
  const warm: Bucket = [];

  // ground & road
  road.push(prep(new THREE.PlaneGeometry(8, 300).rotateX(-Math.PI / 2), '#45464b', mat4(0, 0, 0)));
  road.push(prep(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), '#8b9a6c', mat4(0, -0.05, -40)));
  for (let z = 140; z > -86; z -= 5) box(road, 0.16, 0.012, 2.2, 0, 0.006, z, '#f1ecd9');
  // crosswalks
  for (const cz of [-22, -84]) for (let x = -3.4; x <= 3.4; x += 0.85) box(road, 0.5, 0.014, 3, x, 0.007, cz, '#f1ecd9');
  // sidewalks + curbs
  for (const sd of [-1, 1]) {
    box(road, 3, 0.16, 236, 5.5 * sd, 0.08, 32, '#cdbda5');
    box(road, 0.22, 0.2, 236, 4.05 * sd, 0.1, 32, '#9a948c');
    for (let z = 148; z > -86; z -= 1.5) box(road, 2.96, 0.005, 0.03, 5.5 * sd, 0.163, z, '#b5a68e');
  }

  // buildings on both sides
  for (const sd of [-1, 1]) {
    let z = 150;
    let bi = 0;
    while (z > -86) {
      const wz = 6 + Math.floor(r() * 4) * 1.5;
      const floors = 2 + Math.floor(r() * 4);
      const h = floors * 3 + 1;
      const dep = 9;
      const wall = WALLS[Math.floor(r() * WALLS.length)];
      const cx = (7 + dep / 2) * sd;
      const cz = z - wz / 2;
      box(solid, dep, h, wz - 0.1, cx, h / 2, cz, wall);
      // cornice + base
      const trim = r() > 0.5 ? '#f3ead8' : '#5b4a3f';
      box(solid, dep + 0.5, 0.45, wz + 0.15, cx - 0.15 * sd, h + 0.2, cz, trim);
      box(solid, 0.25, 0.6, wz - 0.1, 7.05 * sd, 0.3, cz, '#6b5a4c');
      // floor bands
      for (let f = 1; f < floors; f++) box(solid, 0.18, 0.18, wz - 0.1, 7.06 * sd, f * 3 + 0.9, cz, trim);
      // roof props
      if (r() > 0.4) box(solid, 1.6, 0.9, 1.4, cx + 1.5 * sd, h + 0.85, cz + (r() - 0.5) * 2, '#8c8f94');
      if (r() > 0.6) {
        const pr = new THREE.CylinderGeometry(0.01, dep * 0.62, 2.6, 4, 1).rotateY(Math.PI / 4).scale(1, 1, wz / dep);
        solid.push(prep(pr, '#7d3b2c', mat4(cx, h + 1.5, cz)));
      }
      // windows upper floors
      const cols = Math.max(2, Math.floor(wz / 2.1));
      for (let f = 1; f < floors; f++) {
        for (let ci = 0; ci < cols; ci++) {
          const wzpos = z - (wz / cols) * (ci + 0.5);
          const wy = f * 3 + 2.1;
          box(solid, 0.12, 1.75, 1.15, 7.0 * sd, wy, wzpos, '#f5efe2');
          box(solid, 0.3, 0.1, 1.3, 7.08 * sd, wy - 0.92, wzpos, '#f5efe2');
          const lit = r() > 0.45;
          box(lit ? warm : glass, 0.06, 1.5, 0.95, 6.96 * sd, wy, wzpos, lit ? '#ffcf86' : '#33465e');
          box(solid, 0.08, 1.5, 0.06, 6.94 * sd, wy, wzpos, '#f5efe2');
        }
      }
      // shopfront
      const awn = AWN[(bi + (sd > 0 ? 1 : 3)) % AWN.length];
      box(solid, 0.14, 2.6, wz - 1.2, 7.0 * sd, 1.65, cz, '#3c3530');
      box(warm, 0.06, 2.2, wz * 0.55, 6.95 * sd, 1.6, cz + wz * 0.12, '#ffd9a0');
      box(solid, 0.08, 2.3, 1.0, 6.95 * sd, 1.35, cz - wz * 0.32, '#5a3a28');
      // striped awning
      const stripes = Math.floor(wz / 0.6);
      for (let i = 0; i < stripes; i++) {
        const sz = z - 0.3 - i * ((wz - 0.6) / stripes) - 0.3;
        const g = new THREE.BoxGeometry(1.6, 0.06, (wz - 0.6) / stripes);
        solid.push(prep(g, i % 2 ? '#f6efe0' : awn, mat4(6.25 * sd, 3.15, sz + 0.0, 0, 0, -0.32 * sd)));
      }
      z -= wz;
      bi++;
    }
  }

  // trees, lamps, benches along both sidewalks
  for (const sd of [-1, 1]) {
    for (let z = 140; z > -84; z -= 11) {
      const tz = z + (sd > 0 ? 0 : 5.5);
      box(solid, 1.1, 0.4, 1.1, 5.9 * sd, 0.3, tz, '#7d6a58');
      solid.push(prep(new THREE.CylinderGeometry(0.11, 0.15, 2.4, 6), '#6b4a2f', mat4(5.9 * sd, 1.5, tz)));
      const greens = ['#5f9e4f', '#77b35a', '#4e8a45', '#86bf63'];
      for (let k = 0; k < 3; k++) {
        const g = new THREE.IcosahedronGeometry(0.85 + r() * 0.45, 0);
        foliage.push(
          prep(g, greens[Math.floor(r() * greens.length)], mat4(5.9 * sd + (r() - 0.5) * 0.9, 3.0 + k * 0.55 + r() * 0.3, tz + (r() - 0.5) * 0.9, r() * 3, r(), r()))
        );
      }
    }
    for (let z = 144; z > -84; z -= 14) {
      const lz = z - (sd > 0 ? 3 : 10);
      solid.push(prep(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 6), '#2d3138', mat4(4.45 * sd, 2.3, lz)));
      box(solid, 0.9, 0.08, 0.08, 4.05 * sd, 4.55, lz, '#2d3138');
      box(solid, 0.36, 0.16, 0.3, 3.65 * sd, 4.47, lz, '#2d3138');
      bulbs.push(prep(new THREE.BoxGeometry(0.28, 0.06, 0.22), '#fff1c9', mat4(3.65 * sd, 4.37, lz)));
    }
    // benches & bins
    for (let z = 132; z > -80; z -= 23) {
      const bz = z - (sd > 0 ? 7 : 15);
      box(solid, 0.5, 0.06, 1.6, 6.6 * sd, 0.55, bz, '#8a5a35');
      box(solid, 0.06, 0.5, 1.6, 6.85 * sd, 0.85, bz, '#8a5a35');
      box(solid, 0.4, 0.45, 0.08, 6.6 * sd, 0.3, bz - 0.7, '#2d3138');
      box(solid, 0.4, 0.45, 0.08, 6.6 * sd, 0.3, bz + 0.7, '#2d3138');
      solid.push(prep(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 7), '#3f6b4f', mat4(4.6 * sd, 0.55, bz - 3)));
    }
  }

  // parked cars (kept away from the action lanes)
  const car = (x: number, z: number, c: string, ry = 0) => {
    box(solid, 1.7, 0.7, 3.9, x, 0.62, z, c, ry);
    box(solid, 1.5, 0.6, 2.0, x, 1.25, z - 0.2, c, ry);
    box(glass, 1.52, 0.42, 2.02, x, 1.27, z - 0.2, '#2a3647', ry);
    for (const [dx, dz] of [
      [-0.8, 1.2],
      [0.8, 1.2],
      [-0.8, -1.2],
      [0.8, -1.2],
    ])
      solid.push(prep(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 8).rotateZ(Math.PI / 2), '#1c1c1e', mat4(x + dx, 0.33, z + dz)));
    bulbs.push(prep(new THREE.BoxGeometry(1.2, 0.12, 0.05), '#fff3d6', mat4(x, 0.75, z + 1.96)));
  };
  car(-3.0, 30, '#3a78c2');
  car(-3.0, 6, '#e8e3d6');
  car(-3.0, -44, '#c9473d');
  car(3.0, 44, '#2f8c6e');
  car(3.0, -60, '#e2b13c');

  // distant skyline behind the school and at the far end
  for (let i = 0; i < 26; i++) {
    const x = -70 + i * 5.6 + r() * 2;
    const h = 10 + r() * 22;
    box(solid, 5, h, 5, x, h / 2, -150 - r() * 20, '#9aa6b8');
  }

  const merge = (b: Bucket) => mergeGeometries(b, false);
  return {
    solid: merge(solid),
    glass: merge(glass),
    bulbs: merge(bulbs),
    foliage: merge(foliage),
    road: merge(road),
    warm: merge(warm),
  };
};

/** The school at the end of the street. Facade faces +Z at z = -100. */
export const buildSchool = () => {
  const solid: Bucket = [];
  const glass: Bucket = [];
  const warm: Bucket = [];
  const r = mulberry(99);
  const Z = -100;
  // yard
  solid.push(prep(new THREE.PlaneGeometry(60, 16).rotateX(-Math.PI / 2), '#b9ad97', mat4(0, 0.02, -94)));
  // main block
  box(solid, 44, 11, 14, 0, 5.5, Z - 7, '#efe1c4');
  box(solid, 45, 0.6, 15, 0, 11.2, Z - 7, '#b85b3e');
  const roof = new THREE.CylinderGeometry(0.01, 10.5, 3.2, 4, 1).rotateY(Math.PI / 4).scale(2.2, 1, 0.72);
  solid.push(prep(roof, '#4a4f5c', mat4(0, 13.1, Z - 7)));
  for (const fy of [0.6, 3.9, 7.4]) box(solid, 44.2, 0.3, 0.3, 0, fy, Z + 0.05, '#b85b3e');
  // windows
  for (let f = 0; f < 3; f++) {
    for (let i = 0; i < 14; i++) {
      const x = -20 + i * 3.08;
      if (Math.abs(x) < 3.5 && f === 0) continue;
      const y = 2.2 + f * 3.4;
      box(solid, 2.0, 2.3, 0.12, x, y, Z + 0.02, '#f7f1e3');
      const lit = r() > 0.35;
      box(lit ? warm : glass, 1.7, 2.0, 0.1, x, y, Z + 0.06, lit ? '#ffd79a' : '#3a5068');
      box(solid, 0.08, 2.0, 0.14, x, y, Z + 0.08, '#f7f1e3');
    }
  }
  // central tower + belfry
  box(solid, 7, 15, 6, 0, 7.5, Z - 2.5, '#e9d6b4');
  box(solid, 7.4, 0.5, 6.4, 0, 15.2, Z - 2.5, '#b85b3e');
  for (const [dx, dz] of [
    [-2.8, 0],
    [2.8, 0],
    [-2.8, -5],
    [2.8, -5],
  ])
    box(solid, 0.6, 3.2, 0.6, dx, 17, Z + dz, '#e9d6b4');
  box(solid, 7.4, 0.5, 6.4, 0, 18.7, Z - 2.5, '#b85b3e');
  const tRoof = new THREE.ConeGeometry(5, 3.6, 4).rotateY(Math.PI / 4);
  solid.push(prep(tRoof, '#4a4f5c', mat4(0, 20.7, Z - 2.5)));
  // clock
  solid.push(prep(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 16).rotateX(Math.PI / 2), '#f8f3e6', mat4(0, 12.4, Z + 0.55)));
  solid.push(prep(new THREE.TorusGeometry(1.4, 0.12, 4, 16), '#6a3b29', mat4(0, 12.4, Z + 0.62)));
  box(solid, 0.1, 0.9, 0.06, 0, 12.75, Z + 0.7, '#222');
  box(solid, 0.65, 0.1, 0.06, 0.3, 12.4, Z + 0.7, '#222');
  // entrance
  box(solid, 5.2, 4.2, 0.6, 0, 2.1, Z + 0.3, '#b85b3e');
  box(warm, 3.6, 3.2, 0.1, 0, 1.6, Z + 0.62, '#ffcf8a');
  box(solid, 0.12, 3.2, 0.14, 0, 1.6, Z + 0.66, '#5a3a28');
  // steps
  for (let i = 0; i < 3; i++) box(solid, 6 - i * 0.4, 0.18, 1.2 - i * 0.3, 0, 0.09 + i * 0.18, Z + 1.2 - i * 0.2, '#c9c0b0');

  // fence + gate pillars (gate arch sign is a separate mesh)
  for (const sd of [-1, 1]) {
    box(solid, 1.1, 4.2, 1.1, 3.4 * sd, 2.1, -90, '#a8553c');
    box(solid, 1.4, 0.35, 1.4, 3.4 * sd, 4.35, -90, '#e9d6b4');
    for (let x = 4.4; x < 30; x += 0.45) {
      solid.push(prep(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 5), '#24352c', mat4(x * sd, 1.05, -90)));
    }
    box(solid, 26, 0.08, 0.08, 17 * sd, 1.9, -90, '#24352c');
    box(solid, 26, 0.08, 0.08, 17 * sd, 0.4, -90, '#24352c');
    box(solid, 26, 0.4, 0.5, 17 * sd, 0.2, -90, '#a8553c');
  }
  box(solid, 7.9, 0.5, 0.7, 0, 4.95, -90, '#a8553c');
  return {
    solid: mergeGeometries(solid, false),
    glass: mergeGeometries(glass, false),
    warm: mergeGeometries(warm, false),
  };
};
