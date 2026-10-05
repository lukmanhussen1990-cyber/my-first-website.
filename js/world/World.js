// Streams the landscape in 120 m chunks around the car: road ribbon, terrain
// strips, forest, verge grass, rocks, delineator posts, guard rails and any
// scheduled props. Chunk building is time-sliced across frames.

import * as THREE from 'three';
import { ROAD, LAYER } from '../config.js';
import { RNG } from '../core/rng.js';
import { Noise } from '../core/noise.js';
import { clamp, smoothstep } from '../core/math.js';
import { forestFloorTextures } from '../core/textures.js';
import { U, makeRetroReflective } from './shared.js';
import { createRoadMaterial } from './roadMaterial.js';
import {
  spruceGeometry, pineGeometry, deadTreeGeometry, grassGeometry, rockGeometry, vegetationMaterials,
} from './vegetation.js';
import { buildProp } from './props.js';

const RIB = [-6, -5.3, -4.6, -3.45, -2.3, -1.15, 0, 1.15, 2.3, 3.45, 4.6, 5.3, 6];
const LAT = [6.0, 6.7, 7.4, 8.1, 8.8, 9.8, 11, 12.5, 14.5, 17, 20, 24, 29, 35, 42, 50, 59, 70];

const _p = {};
const _q = {};
const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();

export class World {
  constructor({ scene, road, quality, schedule }) {
    this.scene = scene;
    this.road = road;
    this.q = quality;
    this.schedule = schedule;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.chunks = new Map();
    this.building = null;
    this.lamps = []; // world-space light sources of streetlights in loaded chunks
    this.densityNoise = new Noise(road.seed * 31 + 9);

    this.roadMat = createRoadMaterial({ reflection: quality.reflection > 0 });
    const floor = forestFloorTextures();
    this.terrainMat = new THREE.MeshStandardMaterial({
      map: floor.albedo,
      normalMap: floor.normal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      vertexColors: true,
      roughness: 0.92,
    });
    this.terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWetness = U.uWetness;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWetness;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(1.0, 0.62, uWetness);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.55, uWetness * vColor.g * 0.6);`);
    };
    this.terrainMat.customProgramCacheKey = () => 'terrain';

    this.veg = vegetationMaterials();
    this.treeTypes = [
      { geo: spruceGeometry(11), mats: [this.veg.bark, this.veg.foliage], h: [14, 26], w: 0.34 },
      { geo: spruceGeometry(23), mats: [this.veg.bark, this.veg.foliage], h: [12, 24], w: 0.27 },
      { geo: spruceGeometry(37, { start: 0.12 }), mats: [this.veg.bark, this.veg.foliage], h: [10, 20], w: 0.14 },
      { geo: pineGeometry(5), mats: [this.veg.bark, this.veg.foliage], h: [20, 31], w: 0.15 },
      { geo: deadTreeGeometry(71), mats: [this.veg.deadBark], h: [10, 19], w: 0.1 },
    ];
    this.grassGeo = grassGeometry();
    this.rockGeo = rockGeometry(3);

    // Delineator posts with retro-reflective tabs.
    this.postGeo = new THREE.BoxGeometry(0.06, 1.1, 0.03);
    this.postGeo.translate(0, 0.55, 0);
    this.postMat = new THREE.MeshStandardMaterial({ color: 0x3d4a40, roughness: 0.55, metalness: 0.4 });
    this.tabGeo = new THREE.BoxGeometry(0.075, 0.2, 0.012);
    this.tabGeo.translate(0, 0.98, -0.02);
    this.tabWhite = makeRetroReflective(new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.35 }), 6, 'retro-tab');
    this.tabAmber = makeRetroReflective(new THREE.MeshStandardMaterial({ color: 0xffa020, roughness: 0.35 }), 6, 'retro-tab');

    this.railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.42, metalness: 0.75, side: THREE.DoubleSide });
    this.railPostGeo = new THREE.BoxGeometry(0.1, 0.8, 0.16);
    this.railPostGeo.translate(0, 0.32, 0);
  }

  get chunkSamples() {
    return ROAD.chunkLength / ROAD.ds;
  }

  /** Streams chunks around arc length sCar. Spends at most `budgetMs` building. */
  update(sCar, budgetMs = 4) {
    const L = ROAD.chunkLength;
    const kCar = Math.floor(sCar / L);
    const kMin = Math.max(0, kCar - ROAD.behindChunks);
    const kMax = kCar + ROAD.aheadChunks;

    for (const [k, chunk] of this.chunks) {
      if (k < kMin - 1 || k > kMax + 1) this._dispose(k, chunk);
    }

    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (!this.building) {
        let next = -1;
        // Build nearest missing chunk first (ahead before behind).
        for (let k = kCar; k <= kMax; k++) if (!this.chunks.has(k)) { next = k; break; }
        if (next < 0) for (let k = kCar - 1; k >= kMin; k--) if (!this.chunks.has(k)) { next = k; break; }
        if (next < 0) break;
        this.building = { k: next, gen: this._build(next) };
      }
      const r = this.building.gen.next();
      if (r.done) {
        this.chunks.set(this.building.k, r.value);
        this.building = null;
      }
    }
  }

  /** Synchronously build everything needed around sCar (used while loading). */
  prime(sCar) {
    for (let i = 0; i < 400; i++) {
      this.update(sCar, 1000);
      if (!this.building && this._allLoaded(sCar)) break;
    }
  }

  _allLoaded(sCar) {
    const kCar = Math.floor(sCar / ROAD.chunkLength);
    for (let k = Math.max(0, kCar - ROAD.behindChunks); k <= kCar + ROAD.aheadChunks; k++) {
      if (!this.chunks.has(k)) return false;
    }
    return true;
  }

  _dispose(k, chunk) {
    this.root.remove(chunk.group);
    chunk.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && o.userData.ownGeometry) o.geometry.dispose();
    });
    for (const lamp of chunk.lamps) {
      const idx = this.lamps.indexOf(lamp);
      if (idx >= 0) this.lamps.splice(idx, 1);
    }
    this.chunks.delete(k);
  }

  *_build(k) {
    const road = this.road;
    const n = this.chunkSamples;
    const i0 = k * n;
    const i1 = i0 + n;
    road.ensure((i1 + 60) * ROAD.ds);
    const origin = new THREE.Vector3(road.x[i0], road.y[i0], road.z[i0]);
    const group = new THREE.Group();
    group.position.copy(origin);
    group.name = `chunk-${k}`;
    const chunk = { k, group, lamps: [], s0: i0 * ROAD.ds, s1: i1 * ROAD.ds };

    group.add(this._buildRibbon(i0, i1, origin));
    yield;
    group.add(this._buildTerrain(i0, i1, origin));
    yield;
    const rng = new RNG((road.seed * 92821 + k * 68917) >>> 0);
    for (const m of this._buildTrees(i0, i1, origin, rng)) group.add(m);
    yield;
    for (const m of this._buildGround(i0, i1, origin, rng)) group.add(m);
    yield;
    for (const m of this._buildRoadside(i0, i1, origin, rng)) group.add(m);
    yield;
    if (this.schedule) {
      for (const entry of this.schedule.inRange(chunk.s0, chunk.s1)) {
        const built = buildProp(entry, road, origin);
        if (!built) continue;
        group.add(built.object);
        for (const lamp of built.lamps) {
          chunk.lamps.push(lamp);
          this.lamps.push(lamp);
        }
      }
    }
    group.updateMatrixWorld(true);
    this.root.add(group);
    return chunk;
  }

  _noPassing(i) {
    const road = this.road;
    const a = Math.max(0, i - 45);
    const b = Math.min(road.n - 1, i + 45);
    let m = 0;
    for (let j = a; j <= b; j += 3) m = Math.max(m, Math.abs(road.kappa[j]));
    return m > 0.0034 ? 1 : 0;
  }

  _buildRibbon(i0, i1, origin) {
    const road = this.road;
    const cols = RIB.length;
    const rows = i1 - i0 + 1;
    const pos = new Float32Array(rows * cols * 3);
    const nrm = new Float32Array(rows * cols * 3);
    const uv = new Float32Array(rows * cols * 2);
    const zone = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const i = i0 + r;
      const z = this._noPassing(i);
      for (let c = 0; c < cols; c++) {
        const d = RIB[c];
        const v = r * cols + c;
        road.stripPoint(i, d, _p);
        pos[v * 3] = _p.x - origin.x;
        pos[v * 3 + 1] = _p.y - origin.y;
        pos[v * 3 + 2] = _p.z - origin.z;
        this._normal(i, d, nrm, v);
        uv[v * 2] = d;
        uv[v * 2 + 1] = i * ROAD.ds;
        zone[v] = z;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aZone', new THREE.BufferAttribute(zone, 1));
    geo.setIndex(gridIndex(rows, cols));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.roadMat);
    mesh.receiveShadow = true;
    mesh.userData.ownGeometry = true;
    mesh.layers.set(LAYER.NO_REFLECT);
    mesh.name = 'road';
    return mesh;
  }

  /** Surface normal at strip coordinates via central differences. */
  _normal(i, d, out, v) {
    const road = this.road;
    const ia = Math.max(0, i - 1);
    const ib = Math.min(road.n - 1, i + 1);
    road.stripPoint(ia, d, _p);
    const ax = _p.x, ay = _p.y, az = _p.z;
    road.stripPoint(ib, d, _p);
    const fx = _p.x - ax, fy = _p.y - ay, fz = _p.z - az;
    road.stripPoint(i, d - 0.15, _p);
    const bx = _p.x, by = _p.y, bz = _p.z;
    road.stripPoint(i, d + 0.15, _p);
    const rx = _p.x - bx, ry = _p.y - by, rz = _p.z - bz;
    // normal = right x forward
    let nx = ry * fz - rz * fy;
    let ny = rz * fx - rx * fz;
    let nz = rx * fy - ry * fx;
    const l = Math.hypot(nx, ny, nz) || 1;
    out[v * 3] = nx / l;
    out[v * 3 + 1] = ny / l;
    out[v * 3 + 2] = nz / l;
  }

  _buildTerrain(i0, i1, origin) {
    const road = this.road;
    const lat = [...LAT.map((d) => -d).reverse(), ...LAT];
    const half = LAT.length;
    const rows = i1 - i0 + 1;
    const colsSide = LAT.length;
    const vertsSide = rows * colsSide;
    const pos = new Float32Array(vertsSide * 2 * 3);
    const nrm = new Float32Array(vertsSide * 2 * 3);
    const uv = new Float32Array(vertsSide * 2 * 2);
    const col = new Float32Array(vertsSide * 2 * 3);
    const dn = this.densityNoise;
    for (let side = 0; side < 2; side++) {
      for (let r = 0; r < rows; r++) {
        const i = i0 + r;
        for (let c = 0; c < colsSide; c++) {
          const d = lat[side * half + c];
          const v = side * vertsSide + r * colsSide + c;
          road.stripPoint(i, d, _p);
          pos[v * 3] = _p.x - origin.x;
          pos[v * 3 + 1] = _p.y - origin.y;
          pos[v * 3 + 2] = _p.z - origin.z;
          this._normal(i, d, nrm, v);
          uv[v * 2] = _p.x / 7;
          uv[v * 2 + 1] = _p.z / 7;
          const e = Math.abs(d) - ROAD.asphaltHalf;
          const ditch = e > 1.4 && e < 4.2 ? Math.sin(Math.PI * (e - 1.4) / 2.8) : 0;
          const moss = 0.5 + 0.5 * dn.n2(_p.x / 13, _p.z / 13);
          const shade = 0.85 - ditch * 0.35 + moss * 0.15;
          col[v * 3] = shade * (1 - moss * 0.18);
          col[v * 3 + 1] = shade * (0.95 + ditch * 0.4);
          col[v * 3 + 2] = shade * (1 - moss * 0.25);
        }
      }
    }
    const idx = [];
    for (let side = 0; side < 2; side++) {
      const base = side * vertsSide;
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < colsSide - 1; c++) {
          const a = base + r * colsSide + c;
          const b = a + 1;
          const c2 = a + colsSide;
          const d2 = c2 + 1;
          idx.push(a, b, c2, b, d2, c2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.ownGeometry = true;
    mesh.name = 'terrain';
    return mesh;
  }

  /** World position on the strip at fractional arc length s and lateral d. */
  _stripAt(s, d, out) {
    const road = this.road;
    const fr = road.sample(s, _q);
    out.x = fr.x + fr.rx * d;
    out.z = fr.z + fr.rz * d;
    const i = clamp(Math.round(s / ROAD.ds), 0, road.n - 1);
    out.y = road.surfaceY(i, d, out.x, out.z);
    return out;
  }

  _forestDensity(x, z) {
    const n = this.densityNoise.fbm2(x / 70, z / 70, 3);
    return smoothstep(-0.45, 0.25, n);
  }

  _buildTrees(i0, i1, origin, rng) {
    const road = this.road;
    const q = this.q.trees;
    const s0 = i0 * ROAD.ds;
    const s1 = i1 * ROAD.ds;
    const lists = this.treeTypes.map(() => []);
    const cell = 4.3 / Math.sqrt(q);
    const add = (type, x, y, z, h, tilt = 0.03) => {
      _pos.set(x - origin.x, y - origin.y - 0.15, z - origin.z);
      _euler.set(rng.range(-tilt, tilt), rng.next() * Math.PI * 2, rng.range(-tilt, tilt));
      _quat.setFromEuler(_euler);
      const w = h * rng.range(0.9, 1.1);
      _scl.set(w, h, w);
      lists[type].push(_m.compose(_pos, _quat, _scl).clone());
    };
    for (const side of [-1, 1]) {
      for (let s = s0; s < s1; s += cell) {
        for (let d = 9.6; d < 68; d += cell) {
          const ss = s + rng.next() * cell;
          const dd = (d + rng.next() * cell) * side;
          this._stripAt(ss, dd, _p);
          const dens = this._forestDensity(_p.x, _p.z);
          if (rng.next() > 0.12 + 0.88 * dens) continue;
          if (road.distanceTo(_p.x, _p.z) < 9.0) continue;
          const r = rng.next();
          const type = r < 0.08 ? 4 : r < 0.27 ? 3 : r < 0.55 ? 0 : r < 0.8 ? 1 : 2;
          const tt = this.treeTypes[type];
          const near = smoothstep(9, 20, Math.abs(dd));
          const h = rng.range(tt.h[0], tt.h[1]) * (0.75 + 0.25 * near);
          add(type, _p.x, _p.y, _p.z, h, type === 4 ? 0.12 : 0.04);
        }
      }
      // Saplings and young trees on the verge.
      const count = Math.round(14 * q);
      for (let n = 0; n < count; n++) {
        const ss = rng.range(s0, s1);
        const dd = rng.range(8.6, 13) * side;
        this._stripAt(ss, dd, _p);
        if (road.distanceTo(_p.x, _p.z) < 8.2) continue;
        add(rng.chance(0.5) ? 2 : 1, _p.x, _p.y, _p.z, rng.range(1.2, 4.5), 0.06);
      }
    }
    const meshes = [];
    lists.forEach((mats, type) => {
      if (!mats.length) return;
      const tt = this.treeTypes[type];
      const mesh = new THREE.InstancedMesh(tt.geo, tt.mats.length > 1 ? tt.mats : tt.mats[0], mats.length);
      mats.forEach((m, j) => mesh.setMatrixAt(j, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `trees-${type}`;
      meshes.push(mesh);
    });
    return meshes;
  }

  _buildGround(i0, i1, origin, rng) {
    const road = this.road;
    const s0 = i0 * ROAD.ds;
    const s1 = i1 * ROAD.ds;
    const grass = [];
    const count = Math.round(170 * this.q.grass);
    for (const side of [-1, 1]) {
      for (let n = 0; n < count; n++) {
        const ss = rng.range(s0, s1);
        // Dense along the verge, sparse into the forest.
        const e = rng.next() < 0.75 ? rng.range(1.25, 6.5) : rng.range(6.5, 30);
        const dd = (ROAD.asphaltHalf + e) * side;
        this._stripAt(ss, dd, _p);
        if (road.distanceTo(_p.x, _p.z) < ROAD.asphaltHalf + 1.1) continue;
        _pos.set(_p.x - origin.x, _p.y - origin.y - 0.03, _p.z - origin.z);
        _euler.set(0, rng.next() * Math.PI, 0);
        _quat.setFromEuler(_euler);
        const h = rng.range(0.32, 0.85) * (e < 2 ? 0.7 : 1);
        _scl.set(h * rng.range(0.8, 1.4), h, h * rng.range(0.8, 1.4));
        grass.push(_m.compose(_pos, _quat, _scl).clone());
      }
    }
    const meshes = [];
    if (grass.length) {
      const mesh = new THREE.InstancedMesh(this.grassGeo, this.veg.grass, grass.length);
      grass.forEach((m, j) => mesh.setMatrixAt(j, m));
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      mesh.name = 'grass';
      meshes.push(mesh);
    }
    const rocks = [];
    for (let n = 0; n < 7; n++) {
      const ss = rng.range(s0, s1);
      const dd = rng.range(8.8, 26) * rng.sign();
      this._stripAt(ss, dd, _p);
      if (road.distanceTo(_p.x, _p.z) < 8.5) continue;
      const sc = rng.range(0.35, 1.5);
      _pos.set(_p.x - origin.x, _p.y - origin.y - sc * 0.15, _p.z - origin.z);
      _euler.set(rng.range(-0.2, 0.2), rng.next() * 6.3, rng.range(-0.2, 0.2));
      _quat.setFromEuler(_euler);
      _scl.set(sc * rng.range(0.8, 1.5), sc, sc * rng.range(0.8, 1.3));
      rocks.push(_m.compose(_pos, _quat, _scl).clone());
    }
    if (rocks.length) {
      const mesh = new THREE.InstancedMesh(this.rockGeo, this.veg.rock, rocks.length);
      rocks.forEach((m, j) => mesh.setMatrixAt(j, m));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'rocks';
      meshes.push(mesh);
    }
    return meshes;
  }

  _railSide(i) {
    const road = this.road;
    const s = i * ROAD.ds;
    const hill = road.hillside(s);
    if (Math.abs(hill) > 0.12) return hill > 0 ? -1 : 1; // downhill side
    const k = road.kappa[i];
    if (Math.abs(k) > 0.0048) return k > 0 ? 1 : -1; // outside of the bend
    return 0;
  }

  _buildRoadside(i0, i1, origin, rng) {
    const road = this.road;
    const meshes = [];
    // Guard rails: contiguous runs where the land falls away or the bend is tight.
    const railSides = [];
    for (let i = i0; i <= i1; i++) railSides.push(this._railSide(i));
    const posts = [];
    for (const side of [-1, 1]) {
      let start = -1;
      for (let r = 0; r <= railSides.length; r++) {
        const on = r < railSides.length && railSides[r] === side;
        if (on && start < 0) start = r;
        if (!on && start >= 0) {
          if (r - start >= 6) meshes.push(this._rail(i0 + start, i0 + r - 1, side, origin, posts));
          start = -1;
        }
      }
    }
    if (posts.length) {
      const mesh = new THREE.InstancedMesh(this.railPostGeo, this.postMat, posts.length);
      posts.forEach((m, j) => mesh.setMatrixAt(j, m));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }

    // Delineators every ~32 m where there is no rail.
    const postM = [];
    const tabW = [];
    const tabA = [];
    const spacing = 32;
    const s0 = i0 * ROAD.ds;
    const s1 = i1 * ROAD.ds;
    for (let s = Math.ceil(s0 / spacing) * spacing; s < s1; s += spacing) {
      const i = Math.round(s / ROAD.ds);
      for (const side of [-1, 1]) {
        if (railSides[Math.min(railSides.length - 1, i - i0)] === side) continue;
        if (rng.chance(0.08)) continue; // knocked down
        const d = (ROAD.asphaltHalf + 0.95) * side;
        this._stripAt(s, d, _p);
        const fr = road.sample(s, _q);
        _pos.set(_p.x - origin.x, _p.y - origin.y - 0.05, _p.z - origin.z);
        _euler.set(rng.range(-0.04, 0.04), fr.theta, rng.range(-0.06, 0.06));
        _quat.setFromEuler(_euler);
        _scl.set(1, 1, 1);
        const m = _m.compose(_pos, _quat, _scl).clone();
        postM.push(m);
        (side > 0 ? tabW : tabA).push(m);
      }
    }
    const inst = (geo, mat, list, name) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, j) => mesh.setMatrixAt(j, m));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      meshes.push(mesh);
    };
    inst(this.postGeo, this.postMat, postM, 'delineators');
    inst(this.tabGeo, this.tabWhite, tabW, 'tabs-white');
    inst(this.tabGeo, this.tabAmber, tabA, 'tabs-amber');
    return meshes;
  }

  /** W-beam guard rail following the road between samples ia..ib. */
  _rail(ia, ib, side, origin, posts) {
    const road = this.road;
    const d = (ROAD.asphaltHalf + 0.75) * side;
    // Cross-section (lateral offset outward, height) of a W-beam.
    const prof = [[0, 0.48], [0.07, 0.55], [0.0, 0.62], [0.07, 0.69], [0, 0.76]];
    const rows = ib - ia + 1;
    const cols = prof.length;
    const pos = new Float32Array(rows * cols * 3);
    const uv = new Float32Array(rows * cols * 2);
    for (let r = 0; r < rows; r++) {
      const i = ia + r;
      road.stripPoint(i, d, _p);
      const th = road.theta[i];
      const rx = Math.cos(th) * side;
      const rz = -Math.sin(th) * side;
      for (let c = 0; c < cols; c++) {
        const v = r * cols + c;
        pos[v * 3] = _p.x + rx * prof[c][0] - origin.x;
        pos[v * 3 + 1] = _p.y + prof[c][1] - origin.y;
        pos[v * 3 + 2] = _p.z + rz * prof[c][0] - origin.z;
        uv[v * 2] = c / (cols - 1);
        uv[v * 2 + 1] = i * ROAD.ds;
      }
      if (r % 2 === 0) {
        _pos.set(_p.x + rx * 0.16 - origin.x, _p.y - origin.y, _p.z + rz * 0.16 - origin.z);
        _euler.set(0, th, 0);
        _quat.setFromEuler(_euler);
        _scl.set(1, 1, 1);
        posts.push(_m.compose(_pos, _quat, _scl).clone());
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(gridIndex(rows, cols));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.railMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.ownGeometry = true;
    mesh.name = 'rail';
    return mesh;
  }
}

function gridIndex(rows, cols) {
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const c2 = a + cols;
      const d2 = c2 + 1;
      idx.push(a, b, c2, b, d2, c2);
    }
  }
  return idx;
}
