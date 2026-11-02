// The forest at sunset (assembles the set_* building blocks). API: CONTRACTS.md (set.js).
// Everything visual is a pure function of t + state (reset every frame).
import * as THREE from 'three';
import { mat, tex, clamp, lerp, smooth, rng, hash1, noise1, v3, lowSphere } from './lib.js';
import { HIDE_TREE, HIDE_BUSH, LEAF_BUSH, GIANT_LEAF, TENT, BRANCH, FORE_BRANCH, SUN, SKY, FOREST, YOU_SPOT, COMPARE, BEAR_PATH } from './layout.js';
import { pineGeo, farTreeGeo, grassGeo, fernGeo, smallBushGeo, rockGeo, pineConeGeo, mushroomGeo, flowerGeo } from './set_geo.js';
import { treeAtlasCanvas, hideBarkCanvas, groundDetailCanvas, bushLeafCanvas, rockCanvas, logEndCanvas, dryWoodCanvas, tentCanvas, cardboardCanvas, giantLeafCanvases, waterCanvas, rayCanvas, glowCanvas } from './set_tex.js';
import { instancedCells, mergeGeos, hash2, vnoise, fbm } from './set_util.js';
import { groundY, placeTrees, placeFarTrees, placePlants, VARIANTS, FORE_TREE, RIVER_PTS, WATER_Y, trailEdgeDist, treeDensityGrid, FIRE, SUN_DIR, riverDist } from './set_world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
const SUNV = V(...SUN_DIR).normalize();

function named(m, n) { m.name = `set.${n}`; return m; }
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return named(m, n); }

// ------------------------------------------------------------------ ground (non-uniform grid: fine in the middle)
function axis(a0, a1, f0, f1, fine, coarse) {
  const out = [];
  for (let x = a0; x < f0; x += coarse) out.push(x);
  for (let x = f0; x < f1; x += fine) out.push(x);
  for (let x = f1; x <= a1; x += coarse) out.push(x);
  return out;
}
function buildGround(trees) {
  const xs = axis(-240, 240, -70, 70, 1.6, 6), zs = axis(-180, 310, -60, 140, 1.6, 6);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  const dens = treeDensityGrid(trees, -70, -60, 140, 200, 1.0);
  const needles = [0.36, 0.27, 0.18], moss = [0.30, 0.36, 0.17], grass = [0.38, 0.47, 0.20], bank = [0.33, 0.40, 0.22], far = [0.24, 0.27, 0.15];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++, k++) {
    const x = xs[i], z = zs[j], y = groundY(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 3.2; uv[k * 2 + 1] = z / 3.2;
    let c = mix(needles, moss, clamp(fbm(x * 0.09, z * 0.09, 3, 3) * 1.3 - 0.25));
    const te = trailEdgeDist(x, z);
    c = mix(c, grass, smooth(clamp((1.6 - te) / 2.2)) * 0.9);
    for (const cc of [[COMPARE.pos, 7], [[TENT.pos[0], TENT.pos[1]], 5], [YOU_SPOT.pos, 2.4]]) c = mix(c, grass, smooth(clamp((cc[1] - Math.hypot(x - cc[0][0], z - cc[0][1])) / 3)) * 0.75);
    const rd = riverDist(x, z); if (rd < 9) c = mix(c, bank, smooth(clamp((9 - rd) / 5)));
    const gi = Math.floor(x + 70), gj = Math.floor(z + 60);
    if (gi >= 0 && gi < 140 && gj >= 0 && gj < 200) c = c.map((v) => v * (1 - clamp(dens[gj * 140 + gi] * 0.25, 0, 0.35)));
    const outside = x < FOREST.minX - 4 || x > FOREST.maxX + 4 || z < FOREST.minZ - 4 || z > FOREST.maxZ + 4;
    if (outside) c = mix(c, far, 0.6);
    const n = 0.92 + vnoise(x * 0.7, z * 0.7, 9) * 0.16;
    col[k * 3] = c[0] * n; col[k * 3 + 1] = c[1] * n; col[k * 3 + 2] = c[2] * n;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = mat(tex(groundDetailCanvas()), { rough: 0.97 }); m.vertexColors = true;
  return msh(g, m, 'ground', { cast: false });
}

// ------------------------------------------------------------------ sky dome + sun
function buildSky() {
  const g = new THREE.SphereGeometry(360, 48, 24);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const hz = C(SKY.horizon), mid = C(SKY.mid), zen = C(SKY.zenith), opp = C(SKY.opposite), glow = C('#ffd9a0'), below = C('#2a2620');
  const sunH = V(SUNV.x, 0, SUNV.z).normalize();
  for (let i = 0; i < p.count; i++) {
    const d = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const el = Math.asin(clamp(d.y, -1, 1));
    const az = V(d.x, 0, d.z).normalize().dot(sunH);
    const h = opp.clone().lerp(hz, Math.pow(clamp((az + 1) / 2), 1.6));
    let c = h.clone().lerp(mid, smooth(clamp(el / 0.32)));
    c.lerp(zen, smooth(clamp((el - 0.22) / 0.95)));
    const sg = Math.pow(Math.max(0, d.dot(SUNV)), 10);
    c.lerp(glow, clamp(sg * 0.9));
    if (el < 0) c.lerp(below, smooth(clamp(-el / 0.12)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = msh(g, m, 'sky', { cast: false, receive: false }); sky.renderOrder = -10; sky.userData.noAudit = true;
  const sm = new THREE.SpriteMaterial({ map: tex(glowCanvas(64), { nearest: false }), color: C('#ffe2a8'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sun = new THREE.Sprite(sm); sun.scale.set(62, 62, 1); sun.position.copy(SUNV.clone().multiplyScalar(330)); named(sun, 'sunDisc'); sun.userData.noAudit = true;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(glowCanvas(64), { nearest: false }), color: C('#fff6e0'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.set(19, 19, 1); core.position.copy(sun.position); named(core, 'sunCore'); core.userData.noAudit = true;
  return { sky, sun, core };
}

// ------------------------------------------------------------------ river ribbon
function buildRiver() {
  const pts = RIVER_PTS, W = 3.2, pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], [x2, z2] = pts[Math.min(i + 1, pts.length - 1)], [x0, z0] = pts[Math.max(i - 1, 0)];
    const dx = x2 - x0, dz = z2 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    if (i > 0) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    pos.push(x + nx * W, WATER_Y, z + nz * W, x - nx * W, WATER_Y, z - nz * W);
    uv.push(acc / 6, 0, acc / 6, 1);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = mat(tex(waterCanvas()), { rough: 0.18, metal: 0.05 }); m.color = C('#9fd0d8'); m.emissive = C('#1d4450'); m.emissiveIntensity = 0.35;
  return msh(g, m, 'river', { cast: false });
}

// ------------------------------------------------------------------ special props
function buildHideTree(barkM, treeM) {
  const g = new THREE.Group(); g.position.set(HIDE_TREE.pos[0], 0, HIDE_TREE.pos[1]); named(g, 'hideTree');
  const R = HIDE_TREE.trunkR;
  const prof = [[R * 1.55, -0.3], [R * 1.4, 0.0], [R * 1.12, 0.35], [R * 1.0, 1.2], [R * 0.95, 3.5], [R * 0.8, 7.5], [R * 0.55, 12], [R * 0.25, 16.5]];
  const tg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 11);
  const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.06 * Math.sin(a * 5 + y * 0.7) + (y < 0.6 ? 0.12 * Math.max(0, Math.sin(a * 4 + 1)) * (0.6 - y) : 0); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  tg.computeVertexNormals();
  const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 7);
  g.add(msh(tg, barkM, 'hideTrunk'));
  // a few dead lower branch stubs (not on YOU's side)
  const R2 = rng(77);
  for (const [a, y, len] of [[2.4, 2.6, 0.9], [3.6, 3.4, 1.2], [1.2, 4.6, 0.8], [4.6, 5.2, 1.4]]) {
    const b = new THREE.CylinderGeometry(0.025, 0.07, len, 5); b.translate(0, len / 2, 0);
    const m = msh(b, barkM, 'hideStub'); m.position.set(Math.cos(a) * R * 0.85, y, Math.sin(a) * R * 0.85); m.rotation.set(0, -a, -1.15 - R2() * 0.25, 'YXZ'); g.add(m);
  }
  const crown = pineGeo({ h: 17.6, trunkR: 0.2, crownBase: 7.2, crownR: 3.4, tiers: 7, sides: 8, seed: 5 });
  const cm = msh(crown, treeM, 'hideCrown'); g.add(cm);
  return g;
}

function blobBush(leafM, r, h, seed, n = 7) {
  const R = rng(seed), geos = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6, d = i === 0 ? 0 : r * (0.35 + R() * 0.3);
    const rr = r * (i === 0 ? 0.78 : 0.48 + R() * 0.2), hh = h * (i === 0 ? 0.62 : 0.4 + R() * 0.18);
    const g = lowSphere(rr, hh, rr, 9, 7);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const j = 1 + (hash2(Math.round(p.getX(k) * 300), Math.round(p.getY(k) * 300) + i, seed) - 0.5) * 0.22; p.setXYZ(k, p.getX(k) * j, p.getY(k) * j, p.getZ(k) * j); }
    g.translate(Math.cos(a) * d, i === 0 ? h * 0.55 : hh * 0.75 + R() * h * 0.2, Math.sin(a) * d);
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const g = mergeGeos(geos);
  // scale to exactly the planned footprint (radius r, height h, resting on y=0)
  g.computeBoundingBox(); const bb = g.boundingBox;
  const sx = (2 * r) / (bb.max.x - bb.min.x), sz = (2 * r) / (bb.max.z - bb.min.z), sy = h / (bb.max.y - Math.max(bb.min.y, 0));
  g.translate(-(bb.max.x + bb.min.x) / 2, 0, -(bb.max.z + bb.min.z) / 2); g.scale(sx, sy, sz);
  g.computeVertexNormals();
  return new THREE.Mesh(g, leafM);
}

function leafBladeGeo(len, w) {
  // leaf outline (stem at y=0, tip at y=len), slightly cupped + bent back, a 6 x 10 grid
  const cols = 6, rows = 10, pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows, y = v * len;
    const half = w / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.75) * (1 - 0.15 * v) + 0.004;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, x = (u - 0.5) * 2 * half;
      const cup = 0.045 * (1 - (2 * u - 1) ** 2) * Math.sin(Math.PI * v), bend = -0.06 * v * v * len;
      pos.push(x, y, cup + bend); uv.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildGiantLeaf() {
  const { leaf, glow } = giantLeafCanvases();
  const m = new THREE.MeshStandardMaterial({ map: tex(leaf), emissiveMap: tex(glow), emissive: C('#ffffff'), emissiveIntensity: 0.32, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
  const g = new THREE.Group(); named(g, 'giantLeaf');
  const blade = msh(leafBladeGeo(GIANT_LEAF.len, GIANT_LEAF.w), m, 'giantLeafBlade'); blade.position.y = 0.03; g.add(blade);
  const st = new THREE.CylinderGeometry(0.006, 0.009, 0.06, 5); st.translate(0, 0.0, 0); g.add(msh(st, mat('#6d8a3c'), 'giantLeafStem'));
  // fuzzy hairs on the edge (tiny pale spikes)
  const hairs = [], R = rng(9);
  for (let i = 0; i < 46; i++) {
    const v = 0.08 + R() * 0.86, side = R() < 0.5 ? -1 : 1, half = GIANT_LEAF.w / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.75) * (1 - 0.15 * v);
    const c = new THREE.ConeGeometry(0.0025, 0.016, 3); c.rotateZ(-side * Math.PI / 2 + (R() - 0.5) * 0.6); c.translate(side * (half + 0.006), 0.03 + v * GIANT_LEAF.len, 0.02 * Math.sin(Math.PI * v) - 0.06 * v * v * GIANT_LEAF.len);
    hairs.push(c.toNonIndexed());
  }
  g.add(msh(mergeGeos(hairs), mat('#e3ecc8', { rough: 0.9 }), 'giantLeafHairs', { cast: false }));
  g.userData.grip = { pos: [0.11, 0.03 + GIANT_LEAF.len * 0.72, 0.02], axis: [0, 0, -1], up: [-1, 0, 0] };
  g.userData.home = { pos: V(...GIANT_LEAF.stem), rot: new THREE.Euler(-0.32, 0.55, 0.18) };
  return g;
}

function buildTube() {
  const outM = mat(tex(cardboardCanvas(false)), { rough: 0.9, side: THREE.FrontSide });
  const inM = mat(tex(cardboardCanvas(true)), { rough: 0.95, side: THREE.BackSide });
  const g = new THREE.Group(); named(g, 'tpTube');
  const og = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 14, 1, true);
  g.add(msh(og, outM, 'tubeOut')); g.add(msh(og.clone(), inM, 'tubeIn'));
  // spiral seam
  const sg = new THREE.TorusGeometry(0.0222, 0.0009, 3, 24, Math.PI * 2); sg.rotateX(Math.PI / 2); sg.scale(1, 1, 1);
  g.userData.grip = { pos: [0, -0.022, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}

function buildTent() {
  const g = new THREE.Group(); g.position.set(TENT.pos[0], groundY(TENT.pos[0], TENT.pos[1]), TENT.pos[1]); g.rotation.y = TENT.rotY; named(g, 'tent');
  const s = TENT.size;
  const dome = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(s * 0.55, s * 0.6, s * 0.62);
  const tm = mat(tex(tentCanvas(), { repeat: [2, 1] }), { rough: 0.8 });
  g.add(msh(dome, tm, 'tentDome'));
  const door = new THREE.CircleGeometry(s * 0.27, 3, Math.PI / 2 - Math.PI / 3, Math.PI * 2 / 3 * 1.0); door.scale(1, 1.35, 1); door.translate(0, s * 0.02, s * 0.62 * 0.86);
  const dm = msh(door, mat('#5a2a10', { rough: 0.9, side: THREE.DoubleSide, polygonOffset: 1 }), 'tentDoor', { cast: false }); dm.rotation.x = -0.32; dm.position.set(0, 0.02, 0.03); g.add(dm);
  const pm = mat('#2b2b30', { rough: 0.5 });
  for (const a of [0.8, -0.8]) { const arc = new THREE.TorusGeometry(s * 0.6, 0.012, 4, 16, Math.PI); const m = msh(arc, pm, 'tentPole', { cast: false }); m.rotation.set(0, a, 0); m.scale.set(0.93, 1.0, 1); g.add(m); }
  const lm = new THREE.LineBasicMaterial({ color: '#d9d2c0' });
  const pts = []; for (const [dx, dz] of [[1.25, 1.25], [-1.25, 1.25], [1.25, -1.25], [-1.25, -1.25]]) pts.push(V(dx * s * 0.28, s * 0.45, dz * s * 0.3), V(dx * s * 0.62, 0.02, dz * s * 0.62));
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lm); named(lines, 'tentGuys'); g.add(lines);
  return g;
}

function buildFire(rockM, logM) {
  const g = new THREE.Group(); named(g, 'fireRing'); g.position.set(FIRE.pos[0], groundY(FIRE.pos[0], FIRE.pos[1]), FIRE.pos[1]);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const r = msh(rockGeo(300 + i), rockM, 'fireStone'); r.scale.setScalar(0.17 + hash1(i) * 0.05); r.position.set(Math.cos(a) * FIRE.r, 0.02, Math.sin(a) * FIRE.r); g.add(r); }
  for (let i = 0; i < 3; i++) { const l = new THREE.CylinderGeometry(0.045, 0.05, 0.7, 6); l.rotateZ(Math.PI / 2); const m = msh(l, logM, 'fireLog'); m.position.set(0, 0.06 + i * 0.03, 0); m.rotation.y = i * 1.05; g.add(m); }
  const ash = new THREE.CircleGeometry(FIRE.r * 0.8, 10); ash.rotateX(-Math.PI / 2); g.add(msh(ash, mat('#3b3430', { rough: 1, polygonOffset: 1 }), 'fireAsh', { cast: false }));
  return g;
}

function buildBranch(woodM) {
  const g = new THREE.Group(); g.position.set(BRANCH.pos[0], groundY(BRANCH.pos[0], BRANCH.pos[1]) + 0.032, BRANCH.pos[1]); g.rotation.y = 0.35; named(g, 'branch');
  const half = BRANCH.len / 2, halves = [];
  for (const sd of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(0, 0, 0); g.add(piv);
    const cg = new THREE.CylinderGeometry(sd < 0 ? 0.034 : 0.026, 0.031, half, 6); cg.rotateZ(Math.PI / 2); cg.translate(sd * half / 2, 0, 0);
    piv.add(msh(cg, woodM, `branchHalf${sd < 0 ? 'A' : 'B'}`));
    const tw = new THREE.CylinderGeometry(0.006, 0.012, 0.22, 4); tw.rotateZ(Math.PI / 2 + sd * 0.6); tw.translate(sd * half * 0.62, 0.05, sd * 0.03);
    piv.add(msh(tw, woodM, 'branchTwig'));
    // splintered break end
    const sp = new THREE.ConeGeometry(0.03, 0.05, 5); sp.rotateZ(sd * Math.PI / 2); sp.translate(-sd * 0.012, 0, 0);
    const spm = msh(sp, mat('#d9c39a', { rough: 0.9 }), 'branchSplinter', { cast: false }); spm.visible = false; piv.add(spm);
    piv.userData = { sd, splinter: spm }; halves.push(piv);
  }
  g.userData.halves = halves;
  return g;
}

function buildForeBranch(treeM, woodM) {
  const g = new THREE.Group(); named(g, 'foreBranch');
  const base = V(...FORE_BRANCH.pos), dir = V(...FORE_BRANCH.dir).normalize(), len = 3.2;
  const b = new THREE.CylinderGeometry(0.035, 0.085, len, 6); b.translate(0, len / 2, 0);
  const m = msh(b, woodM, 'foreBranchWood'); m.position.copy(base); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir); g.add(m);
  const R = rng(55), clumps = [];
  for (let i = 0; i < 9; i++) {
    const u = 0.15 + i / 9 * 0.85, p = base.clone().addScaledVector(dir, u * len);
    const c = new THREE.ConeGeometry(0.35 - u * 0.15, 0.32, 7); c.rotateX(R() * 0.6 - 0.3);
    c.translate(p.x + (R() - 0.5) * 0.25, p.y - 0.12 - R() * 0.06, p.z + (R() - 0.5) * 0.35);
    clumps.push(c.toNonIndexed());
  }
  const needleM = mat('#2f5a2a', { rough: 0.9 });
  g.add(msh(mergeGeos(clumps), needleM, 'foreBranchNeedles'));
  g.userData.path = (u) => base.clone().addScaledVector(dir, clamp(u) * len * 0.9).add(V(0, 0.085 - u * 0.05, 0));
  return g;
}

function buildRays() {
  const g = new THREE.Group(); named(g, 'rays');
  const m = new THREE.MeshBasicMaterial({ map: tex(rayCanvas(), { nearest: false }), color: C('#ffd59a'), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const spots = [[-3.5, 4], [2.5, 7], [-2, 12], [4, -3], [-5, -6], [1, 18], [-6, 9], [6, 14], [3, 2], [-2.5, -2]];
  const items = [];
  for (const [i, [x, z]] of spots.entries()) {
    const geo = new THREE.PlaneGeometry(1.6 + hash1(i) * 1.6, 26); geo.translate(0, -13, 0);
    const mm = new THREE.Mesh(geo, m); mm.userData.noAudit = true; named(mm, 'ray');
    const top = V(x, 0, z).addScaledVector(SUNV, 26 / Math.max(SUNV.y, 0.2) * 0.55);
    mm.position.copy(top); g.add(mm); items.push({ m: mm, top, i });
  }
  g.userData.items = items; g.userData.mat = m;
  return g;
}

// ------------------------------------------------------------------ build
export function buildSet(world) {
  const scene = world.scene;
  const group = new THREE.Group(); named(group, 'root'); scene.add(group);
  scene.fog = new THREE.Fog(C('#c98d6f'), 30, 190);
  const trees = placeTrees(), far = placeFarTrees(), plants = placePlants(trees);

  // materials
  const atlas = tex(treeAtlasCanvas());
  const treeM = mat(atlas, { rough: 0.92 }); treeM.vertexColors = true;
  const treeDarkM = treeM.clone(); treeDarkM.color = C('#9a9a88');
  const barkM = mat(tex(hideBarkCanvas()), { rough: 0.95 });
  const leafM = mat(tex(bushLeafCanvas()), { rough: 0.9 });
  const hideLeafM = mat(tex(bushLeafCanvas('#3f7a2e', 777)), { rough: 0.9 });
  const rockM = mat(tex(rockCanvas()), { rough: 0.95 }); rockM.vertexColors = true;
  const woodM = mat(tex(dryWoodCanvas()), { rough: 0.95 });
  const grassM = mat('#7a9a44', { rough: 0.9, side: THREE.DoubleSide }); grassM.vertexColors = true;
  const fernM = mat('#5a8a3a', { rough: 0.9, side: THREE.DoubleSide }); fernM.vertexColors = true;
  const vcM = mat('#ffffff', { rough: 0.9 }); vcM.vertexColors = true;

  // ground, sky, river
  group.add(buildGround(trees));
  const sk = buildSky(); scene.add(sk.sky); scene.add(sk.sun); scene.add(sk.core);
  group.add(buildRiver());

  // instanced forest
  for (const v of ['A', 'B', 'C', 'D']) {
    const geo = pineGeo(VARIANTS[v]);
    const lit = trees.filter((t) => t.v === v && !t.dark), dark = trees.filter((t) => t.v === v && t.dark);
    for (const im of instancedCells(`set.tree${v}`, geo, treeM, lit, { cell: 24 })) group.add(im);
    for (const im of instancedCells(`set.treeDark${v}`, geo, treeDarkM, dark, { cell: 24 })) group.add(im);
  }
  const fore = pineGeo({ ...VARIANTS.A, h: FORE_TREE.h, trunkR: FORE_TREE.trunkR, crownBase: FORE_TREE.crownBase, seed: 61 });
  const foreTree = msh(fore, treeM, 'foreTree'); foreTree.position.set(FORE_TREE.pos[0], groundY(FORE_TREE.pos[0], FORE_TREE.pos[1]) - 0.05, FORE_TREE.pos[1]); group.add(foreTree);
  for (const im of instancedCells('set.farTree', farTreeGeo(), treeDarkM, far, { cell: 60, cast: false })) group.add(im);
  const gGeo = [grassGeo(1), grassGeo(2, 8), grassGeo(3, 5)];
  plants.grass.forEach((p, i) => (p.k = i % 3));
  for (let k = 0; k < 3; k++) for (const im of instancedCells('set.grass', gGeo[k], grassM, plants.grass.filter((p) => p.k === k), { cell: 16, cast: false })) group.add(im);
  for (const im of instancedCells('set.fern', fernGeo(5), fernM, plants.ferns, { cell: 16 })) group.add(im);
  for (const im of instancedCells('set.bush', smallBushGeo(7), leafM, plants.bushes, { cell: 16 })) group.add(im);
  for (const im of instancedCells('set.rock', rockGeo(3), rockM, plants.rocks, { cell: 20 })) group.add(im);
  for (const im of instancedCells('set.cone', pineConeGeo(), vcM, plants.cones, { cell: 16, cast: false })) group.add(im);
  for (const im of instancedCells('set.shroom', mushroomGeo(), vcM, plants.shrooms, { cell: 16, cast: false })) group.add(im);
  const fc = ['#f2e9d8', '#f1c84a', '#d97ab0'];
  for (let c = 0; c < 3; c++) for (const im of instancedCells('set.flower', flowerGeo(fc[c]), vcM, plants.flowers.filter((f) => f.c === c), { cell: 16, cast: false })) group.add(im);

  // special props
  const hideTree = buildHideTree(barkM, treeM); group.add(hideTree);
  const hideBush = new THREE.Group(); named(hideBush, 'hideBush'); hideBush.position.set(HIDE_BUSH.pos[0], 0, HIDE_BUSH.pos[1]); group.add(hideBush);
  const hb = blobBush(hideLeafM, HIDE_BUSH.r, HIDE_BUSH.h, 31, 8); named(hb, 'hideBushLeaves'); hb.castShadow = hb.receiveShadow = true; hideBush.add(hb);
  const leafBush = new THREE.Group(); named(leafBush, 'leafBush'); leafBush.position.set(LEAF_BUSH.pos[0], 0, LEAF_BUSH.pos[1]); group.add(leafBush);
  const lb = blobBush(leafM, LEAF_BUSH.r, LEAF_BUSH.h, 41, 6); named(lb, 'leafBushLeaves'); lb.castShadow = lb.receiveShadow = true; leafBush.add(lb);
  // a few more giant leaves on the leaf bush (static)
  const giantLeaf = buildGiantLeaf(); group.add(giantLeaf);
  for (const [dx, dy, dz, ry, rx] of [[0.25, 0.5, 0.15, 1.6, -0.4], [0.05, 0.55, -0.3, 3.1, -0.5], [0.35, 0.45, -0.15, 2.3, -0.7]]) {
    const extra = buildGiantLeaf(); extra.scale.setScalar(0.75); extra.position.set(LEAF_BUSH.pos[0] + dx, dy, LEAF_BUSH.pos[1] + dz); extra.rotation.set(rx, ry, 0); group.add(extra);
  }
  const tpTube = buildTube(); tpTube.visible = false; group.add(tpTube);
  const tent = buildTent(); group.add(tent);
  group.add(buildFire(rockM, woodM));
  const branch = buildBranch(woodM); group.add(branch);
  const foreBranch = buildForeBranch(treeM, woodM); group.add(foreBranch);
  // two fallen logs along the trail edges
  const logEndM = mat(tex(logEndCanvas()), { rough: 0.95 });
  for (const [x, z, ry, len] of [[3.2, 6.2, 0.4, 2.6], [-4.6, 15.5, -0.3, 3.2]]) {
    const lg = new THREE.CylinderGeometry(0.2, 0.24, len, 8); lg.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(lg, [woodM, logEndM, logEndM]); m.castShadow = m.receiveShadow = true; named(m, 'log');
    m.position.set(x, groundY(x, z) + 0.18, z); m.rotation.y = ry; group.add(m);
  }
  const rays = buildRays(); group.add(rays);

  // lights
  const sun = new THREE.DirectionalLight(C(SUN.color), SUN.intensity); named(sun, 'sun');
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  group.add(sun); group.add(sun.target);
  const hemi = new THREE.HemisphereLight(C('#ffd2b8'), C('#4a4a2c'), 1.7); named(hemi, 'hemi'); group.add(hemi);
  const fill = new THREE.DirectionalLight(C('#ffe6d2'), 0); named(fill, 'fill'); group.add(fill); group.add(fill.target);

  // colliders (for the audit): trunks near the play area, tent, logs, hide tree
  const colliders = [];
  const box = (n, a, b) => colliders.push({ name: n, box: new THREE.Box3(V(...a), V(...b)) });
  box('hideTrunk', [HIDE_TREE.pos[0] - HIDE_TREE.trunkR * 0.95, 0, HIDE_TREE.pos[1] - HIDE_TREE.trunkR * 0.95], [HIDE_TREE.pos[0] + HIDE_TREE.trunkR * 0.95, 9, HIDE_TREE.pos[1] + HIDE_TREE.trunkR * 0.95]);
  for (const t of trees) if (Math.hypot(t.x, t.z - 6) < 26) { const r = VARIANTS[t.v].trunkR * t.s; box(`trunk${t.v}`, [t.x - r, t.y, t.z - r], [t.x + r, t.y + VARIANTS[t.v].h * t.s * 0.6, t.z + r]); }
  box('tent', [TENT.pos[0] - TENT.size * 0.45, 0, TENT.pos[1] - TENT.size * 0.45], [TENT.pos[0] + TENT.size * 0.45, TENT.size * 0.5, TENT.pos[1] + TENT.size * 0.45]);

  const props = { hideTree, hideBush, leafBush, giantLeaf, tpTube, tent, branch, foreBranch, sun, hemi, fill, rays, sky: sk.sky };
  const defaults = () => ({
    fog: { color: '#d99a78', near: 35, far: 210 }, shadow: { center: [0, 1, 2], radius: 10 },
    fill: { dir: [0, 0.3, 1], intensity: 0.3, color: '#ffe6d2' }, exposure: 1.12, sunIntensity: 1.25, skyDark: 0, rays: 0.5,
    bushShake: 0, branchSnap: 0, leafTorn: false, wind: 1,
  });
  const set = { group, colliders, props, anchors: { trees, plants }, state: defaults(),
    reset(t) {
      set.state = defaults();
      const h = giantLeaf.userData.home; giantLeaf.position.copy(h.pos); giantLeaf.rotation.copy(h.rot); giantLeaf.visible = true; giantLeaf.scale.setScalar(1);
      tpTube.visible = false; tpTube.position.set(0, -10, 0); tpTube.rotation.set(0, 0, 0);
      hideBush.rotation.set(0, 0, 0); hideBush.scale.set(1, 1, 1);
      foreBranch.position.set(0, 0, 0);
    },
    commit(ctx) {
      const s = set.state, t = ctx.t, cam = ctx.camera;
      const dark = clamp(s.skyDark);
      scene.fog.color.set(s.fog.color).lerp(C('#3a3550'), dark * 0.55); scene.fog.near = s.fog.near; scene.fog.far = s.fog.far;
      world.renderer.toneMappingExposure = s.exposure * (1 - dark * 0.25);
      sk.sky.material.color.setRGB(1, 1, 1).lerp(C('#7f86b8'), dark * 0.6);
      sun.intensity = SUN.intensity * s.sunIntensity * (1 - dark * 0.35);
      hemi.intensity = 1.7 * (1 - dark * 0.3);
      // sky dome + sun follow the camera (always inside the far plane)
      sk.sky.position.copy(cam.position); sk.sun.position.copy(cam.position).addScaledVector(SUNV, 330); sk.core.position.copy(sk.sun.position);
      // shadow box follows the shot
      const c = V(...s.shadow.center), r = s.shadow.radius;
      sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUNV, 60);
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
      fill.intensity = s.fill.intensity; fill.color.set(s.fill.color);
      fill.target.position.copy(c); fill.position.copy(c).addScaledVector(V(...s.fill.dir).normalize(), 20);
      // rays: billboard around the sun axis, fade near the camera
      rays.visible = s.rays > 0.01;
      if (rays.visible) {
        rays.userData.mat.opacity = 0.16 * s.rays * (1 - dark * 0.5);
        for (const it of rays.userData.items) {
          const m = it.m; m.position.copy(it.top);
          m.quaternion.setFromUnitVectors(V(0, 1, 0), SUNV);
          const toCam = cam.position.clone().sub(it.top); const ax = SUNV;
          const fwd = toCam.addScaledVector(ax, -toCam.dot(ax)).normalize();
          const X = V().crossVectors(ax, fwd).normalize();
          m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, ax, V().crossVectors(X, ax)));
          const d = cam.position.distanceTo(it.top.clone().addScaledVector(SUNV, -13));
          m.visible = d > 6;
        }
      }
      // bush shake
      const bs = clamp(s.bushShake);
      if (bs > 0) {
        hideBush.rotation.set(Math.sin(t * 31) * 0.05 * bs, Math.sin(t * 17) * 0.04 * bs, Math.sin(t * 27 + 1) * 0.06 * bs);
        const k = 1 + Math.sin(t * 41) * 0.025 * bs; hideBush.scale.set(k, 1 + Math.sin(t * 37 + 2) * 0.03 * bs, k);
      }
      // branch snap: halves kick up into a V
      const sn = clamp(s.branchSnap);
      for (const piv of branch.userData.halves) {
        const sd = piv.userData.sd;
        piv.rotation.set(0, sd * 0.25 * sn, sd * 0.42 * sn);
        piv.position.set(-sd * 0.01 * sn, 0.012 * sn, 0);
        piv.userData.splinter.visible = sn > 0.05;
      }
      giantLeaf.visible = true;
    },
  };
  return set;
}
