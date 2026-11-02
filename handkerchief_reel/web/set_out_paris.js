// PARIS (shots 31-33): a sunny golden afternoon in a Champ-de-Mars-like park. Lawn panels, a gravel avenue on the
// tower axis, round trimmed bushes, benches, Paris lamp posts, rows of round trees, Haussmann blocks with mansard
// roofs on the horizon, a golden dome far away, fluffy low-poly clouds, a few birds, and the EIFFEL TOWER.
// The hollow ring bush at PARIS.bush (YOU crouches in its middle) wiggles with state.bushShake.
import * as THREE from 'three';
import { mat, tex, clamp, rng } from './lib.js';
import { PARIS } from './layout.js';
import { mergeGeos, faceColors, hash2 } from './set_util.js';
import { slabCanvas } from './set_tex2.js';
import { V, C, TAU, msh, merged, boxG, cylG, boxUV, jitter, buildSky, keyLight, groundPlane, patch, patchTint, roundTreeGeos,
  ballBushGeo, grassTuftGeo, flowerGeo, flowerClumpGeo, inst, leafMat, vcMat, vc } from './set_out_kit.js';
import { gravelCanvas, grassCanvas, hausFacadeCanvas, mansardCanvas, barkCanvas, leafCanvas } from './set_out_tex.js';
import { buildEiffel } from './set_out_eiffel.js';

const [OX, OZ] = PARIS.origin;
const [TX, TZ] = PARIS.tower.pos;
const AV = { x0: TX - 3.4, x1: TX + 3.4 };                  // central gravel avenue (on the tower axis)
const PARK = { x0: OX - 42, x1: OX + 54, z0: OZ - 90, z1: TZ + 34 };
const SUN = V(-0.55, 0.52, -0.65).normalize();             // toward the sun: behind the camera, to the left

// ---------------------------------------------------------------- the hollow ring bush (head + shoulders stick out)
// Lathe ring: outer radius r, rim top ~h, hollow centre (inner radius ~0.42 r/0.66); leafy lumps break the silhouette.
export function ringBushGeo(seed, r = 0.66, h = 0.98) {
  const sr = r / 0.66, sh = h / 0.98, R = rng(seed);
  const prof = [[0.50, 0.0], [0.585, 0.1], [0.64, 0.28], [0.66, 0.52], [0.648, 0.74], [0.605, 0.875], [0.545, 0.95], [0.48, 0.968],
    [0.438, 0.93], [0.418, 0.82], [0.41, 0.5], [0.415, 0.15], [0.42, 0.0]];
  let ring = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * sr, y * sh)), 18);
  ring = jitter(ring.toNonIndexed(), 0.022, seed);
  const geos = [ring];
  // lumps on the outer wall (never on the inner side, never higher than the rim)
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + R() * 0.25, y = (0.22 + R() * 0.58) * sh, rr = (0.1 + R() * 0.06) * sr;
    const g = new THREE.IcosahedronGeometry(rr, 1).toNonIndexed(); jitter(g, rr * 0.25, seed + i);
    const rad = (0.6 - 0.02) * sr + Math.sin((y / sh) * Math.PI) * 0.03 * sr;
    g.translate(Math.cos(a) * rad, y, Math.sin(a) * rad); geos.push(g);
  }
  for (let i = 0; i < 12; i++) {                                // a crown of small lumps on the outer half of the rim
    const a = (i / 12) * TAU + R() * 0.3, rr = (0.075 + R() * 0.03) * sr;
    const g = new THREE.IcosahedronGeometry(rr, 1).toNonIndexed(); jitter(g, rr * 0.25, seed + 50 + i);
    g.translate(Math.cos(a) * 0.56 * sr, 0.905 * sh, Math.sin(a) * 0.56 * sr); geos.push(g);
  }
  let g = boxUV(mergeGeos(geos), 0.42);
  g = faceColors(g, (x, y, z, nx, ny, nz, fi) => {
    const rad = Math.hypot(x, z), inward = (nx * x + nz * z) / Math.max(rad, 1e-3) < -0.2 && rad < 0.52 * sr;
    let k = (0.55 + 0.5 * clamp(y / h)) * (0.88 + hash2(fi, seed, 5) * 0.24);
    if (inward) k *= 0.5 + 0.3 * clamp(y / h);
    if (ny < -0.3) k *= 0.6;
    return [k, k, k];
  });
  return g;
}

// ---------------------------------------------------------------- park furniture
function benchGeos() {          // Paris park bench: green slats, dark cast iron sides. Origin: seat centre on the ground, faces +Z
  const wood = [], iron = [];
  for (let i = 0; i < 4; i++) wood.push(boxG(1.7, 0.035, 0.085, 0, 0.44, -0.2 + i * 0.105));
  for (let i = 0; i < 3; i++) wood.push(boxG(1.7, 0.09, 0.03, 0, 0.6 + i * 0.13, -0.27 - i * 0.03, -0.22));
  for (const x of [-0.72, 0.72]) {
    iron.push(boxG(0.05, 0.44, 0.05, x, 0.22, 0.17), boxG(0.05, 0.86, 0.05, x, 0.43, -0.27, -0.16));
    iron.push(boxG(0.05, 0.04, 0.5, x, 0.4, -0.04), boxG(0.06, 0.04, 0.42, x, 0.68, 0.02));       // arm rest
    iron.push(boxG(0.05, 0.22, 0.05, x, 0.57, 0.2));
  }
  return { wood: mergeGeos(wood), iron: mergeGeos(iron) };
}
function lampGeos() {           // classic Paris lamp post (dark green cast iron, lantern on top). Origin: foot
  const iron = [], glass = [];
  iron.push(cylG(0.15, 0.2, 0.5, 8, 0, 0.25, 0), cylG(0.12, 0.15, 0.12, 8, 0, 0.56, 0), cylG(0.045, 0.065, 2.5, 8, 0, 1.87, 0));
  iron.push(cylG(0.085, 0.085, 0.08, 8, 0, 1.1, 0), cylG(0.09, 0.06, 0.12, 8, 0, 3.12, 0), cylG(0.13, 0.08, 0.08, 4, 0, 3.22, 0, { ry: Math.PI / 4 }));
  glass.push(cylG(0.2, 0.12, 0.46, 4, 0, 3.49, 0, { ry: Math.PI / 4 }));
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; iron.push(boxG(0.025, 0.5, 0.025, Math.cos(a) * 0.16, 3.49, Math.sin(a) * 0.16, 0, 0, 0)); }
  iron.push(cylG(0.02, 0.28, 0.24, 4, 0, 3.84, 0, { ry: Math.PI / 4 }), cylG(0.03, 0.03, 0.14, 6, 0, 4.02, 0));
  const fin = new THREE.IcosahedronGeometry(0.045, 0).toNonIndexed(); fin.translate(0, 4.12, 0); iron.push(fin);
  return { iron: mergeGeos(iron), glass: mergeGeos(glass) };
}
// place copies of a geometry at [x, z, rotY] (merged into one geometry)
function placeAll(geo, spots) {
  return mergeGeos(spots.map(([x, z, ry]) => { const g = geo.clone(); g.rotateY(ry || 0); g.translate(x, 0, z); return g; }));
}

// ---------------------------------------------------------------- Haussmann city around the park
function buildCity(R) {
  const facadeMats = ['#e6d8bc', '#ddcfb4', '#e9dcc4', '#d6c6aa'].map((b, i) => mat(tex(hausFacadeCanvas(421 + i, b), { repeat: [1, 1] }), { rough: 0.9 }));
  const roofM = mat(tex(mansardCanvas(), { repeat: [8, 1] }), { rough: 0.7 });
  const chimM = mat(tex(slabCanvas('#c88a64', 31)), { rough: 0.9 });
  const bodies = [[], [], [], []], roofs = [], chims = [];
  const TILE_W = 12, TILE_H = 22;
  const box = (W, H, D, x, y, z) => {             // facade box with UVs in tiles of 12 x 22 m
    const g = new THREE.BoxGeometry(W, H, D); const uv = g.attributes.uv;
    const fw = [D, D, W, W, W, W], fh = [H, H, D, D, H, H];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * fw[f] / TILE_W, uv.getY(i) * fh[f] / TILE_H); }
    g.translate(x, y, z); return g.toNonIndexed();
  };
  const near = (x, z) => x > PARK.x0 - 4 && x < PARK.x1 + 4 && z > PARK.z0 - 4 && z < PARK.z1 + 4;
  const STEP_X = 52, STEP_Z = 44;
  for (let bx = OX - 330; bx < OX + 340; bx += STEP_X) for (let bz = OZ - 300; bz < OZ + 360; bz += STEP_Z) {
    // a city block (36 x 30 m) split into 2-4 buildings along X
    const cx = bx + (R() - 0.5) * 6, cz = bz + (R() - 0.5) * 6;
    const d = Math.hypot(cx - TX, cz - (TZ - 30));
    if (d > 330) continue;
    const BW = 38, BD = 30;
    if (near(cx - BW / 2, cz - BD / 2) || near(cx + BW / 2, cz + BD / 2) || near(cx - BW / 2, cz + BD / 2) || near(cx + BW / 2, cz - BD / 2)) continue;
    const n = 2 + Math.floor(R() * 3);
    let x = cx - BW / 2;
    for (let i = 0; i < n; i++) {
      const W = i === n - 1 ? cx + BW / 2 - x : BW / n * (0.75 + R() * 0.5);
      const Hb = 17 + R() * 5, D = BD * (0.9 + R() * 0.1), xm = x + W / 2;
      bodies[Math.floor(R() * 4)].push(box(W, Hb, D, xm, Hb / 2, cz));
      // mansard: square frustum (4-sided cylinder) scaled to the rectangle
      const hm = 3.4 + R() * 1.2;
      const m = new THREE.CylinderGeometry(0.62, 1, hm, 4, 1); m.rotateY(Math.PI / 4);
      m.scale(W / Math.SQRT2 * 1.0, 1, D / Math.SQRT2 * 1.0); m.translate(xm, Hb + hm / 2, cz); roofs.push(m.toNonIndexed());
      // chimney stacks along the roof
      const nc = 2 + Math.floor(R() * 3);
      for (let c = 0; c < nc; c++) {
        const chx = xm + (c / Math.max(1, nc - 1) - 0.5) * W * 0.55, chz = cz + (R() - 0.5) * D * 0.3, chh = 1.6 + R() * 1.2;
        chims.push(boxG(0.7, chh, 2.2, chx, Hb + hm + chh / 2 - 0.4, chz));
      }
      x += W;
    }
  }
  const g = new THREE.Group(); g.name = 'set.paris.city';
  const o = { cast: false, receive: false };
  bodies.forEach((list, i) => list.length && g.add(merged(list, facadeMats[i], 'set.paris.buildings', o)));
  g.add(merged(roofs, roofM, 'set.paris.mansards', o));
  g.add(merged(chims, chimM, 'set.paris.chimneys', o));
  // a golden dome far away (Invalides-like) for the skyline
  const dome = new THREE.Group(); dome.position.set(TX + 62, 0, TZ + 190); dome.name = 'set.paris.goldDome';
  const stoneM = mat(tex(slabCanvas('#d8ccb4', 33)), { rough: 0.9 }), goldM = mat('#d9a83a', { rough: 0.35, metal: 0.6, emissive: '#6a4a10', emissiveIntensity: 0.25 });
  dome.add(msh(new THREE.BoxGeometry(34, 18, 34).translate(0, 9, 0), stoneM, 'set.paris.domeBase', o));
  dome.add(msh(new THREE.CylinderGeometry(9, 9.5, 10, 16).translate(0, 23, 0), stoneM, 'set.paris.domeDrum', o));
  dome.add(msh(new THREE.SphereGeometry(9.2, 16, 8, 0, TAU, 0, Math.PI / 2).translate(0, 28, 0), goldM, 'set.paris.domeGold', o));
  dome.add(msh(new THREE.CylinderGeometry(1.4, 1.8, 5, 8).translate(0, 39, 0), goldM, 'set.paris.domeLantern', o));
  dome.add(msh(new THREE.ConeGeometry(0.9, 7, 8).translate(0, 45, 0), goldM, 'set.paris.domeSpire', o));
  g.add(dome);
  return g;
}

// ---------------------------------------------------------------- birds (little Vs gliding in circles)
function buildBirds(n, seed) {
  const R = rng(seed), g = new THREE.Group(); g.name = 'set.paris.birds';
  const wm = new THREE.MeshBasicMaterial({ color: C('#3a3a44'), side: THREE.DoubleSide, fog: true });
  const wingG = new THREE.BufferGeometry();
  wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, 0, 0, 0.12, 0.36, 0, -0.04], 3));
  wingG.computeVertexNormals();
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); b.name = 'set.paris.bird';
    const L = new THREE.Mesh(wingG, wm), Rw = new THREE.Mesh(wingG, wm); Rw.scale.x = -1; L.name = Rw.name = 'set.paris.birdWing';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.26), wm); body.name = 'set.paris.birdBody';
    b.add(L, Rw, body); L.userData.noAudit = Rw.userData.noAudit = body.userData.noAudit = true;
    b.userData = { cx: TX - 14 + R() * 26, cz: 32 + R() * 30, cy: 20 + R() * 16, r: 5 + R() * 7, w: (0.25 + R() * 0.15) * (R() < 0.5 ? -1 : 1), ph: R() * TAU, fl: 7 + R() * 3, s: 1.3 + R() * 0.5 };
    b.scale.setScalar(b.userData.s);
    g.add(b); birds.push(b);
  }
  return { group: g, update(t) {
    for (const b of birds) {
      const u = b.userData, a = u.ph + t * u.w;
      b.position.set(u.cx + Math.cos(a) * u.r, u.cy + Math.sin(t * 0.7 + u.ph) * 0.8, u.cz + Math.sin(a) * u.r);
      b.rotation.set(0, -a + (u.w > 0 ? 0 : Math.PI), Math.sin(t * 0.9 + u.ph) * 0.15);
      const f = Math.sin(t * u.fl + u.ph) * 0.55;
      b.children[0].rotation.z = f; b.children[1].rotation.z = -f;
    }
  } };
}

// ---------------------------------------------------------------- the place
export function buildParis(env, world) {
  const group = new THREE.Group(); group.name = 'set.paris';
  const R = rng(9001);
  const camOk = (x, z) => true;

  // ---- sky
  const sky = buildSky('paris', {
    zenith: '#3d84d6', mid: '#86b8ea', horizon: '#d9e4ea', horizonSun: '#f3e6cc', below: '#d9e4ea', glow: '#fff3da',
    sunDir: SUN, hzBand: 0.2, midStart: 0.1, midBand: 0.95, glowPow: 5, glowAmt: 0.55,
    cloudTop: '#ffffff', cloudShade: '#bccbe0', cloudRim: '#fff6e6',
    clouds: [
      { at: [-0.14, 0.12], w: 86, h: 19, seed: 11 }, { at: [0.2, 0.2], w: 62, h: 16, seed: 12 }, { at: [-0.04, 0.4], w: 72, h: 20, seed: 13 },
      { at: [0.3, 0.55], w: 56, h: 16, seed: 14 }, { at: [-0.32, 0.3], w: 66, h: 18, seed: 15 }, { at: [0.48, 0.13], w: 92, h: 20, seed: 16 },
      { at: [0.66, 0.32], w: 60, h: 16, seed: 17 }, { at: [-0.55, 0.13], w: 80, h: 18, seed: 18 }, { at: [1.15, 0.2], w: 70, h: 18, seed: 19 },
      { at: [-1.05, 0.24], w: 70, h: 18, seed: 20 }, { at: [2.2, 0.17], w: 80, h: 18, seed: 21 }, { at: [-2.3, 0.22], w: 76, h: 18, seed: 22 },
      { at: [3.1, 0.28], w: 70, h: 18, seed: 23 }, { at: [0.05, 0.75], w: 50, h: 14, seed: 24, flat: true }, { at: [1.7, 0.45], w: 60, h: 16, seed: 25 },
      { at: [-1.6, 0.5], w: 60, h: 16, seed: 26 },
    ],
  });
  group.add(sky.root);

  // ---- lights
  const key = keyLight('paris', '#ffdcaa', 2.7, SUN); group.add(key, key.target);
  const hemi = new THREE.HemisphereLight(C('#bcd6ff'), C('#6a7448'), 1.15); hemi.name = 'set.paris.hemi'; group.add(hemi);
  const fill = new THREE.DirectionalLight(C('#ffe8d0'), 0.35); fill.name = 'set.paris.fill'; fill.position.set(OX + 3, 6, OZ - 12); fill.target.position.set(OX, 1, OZ); group.add(fill, fill.target);

  // ---- ground: park lawn, city pavement, gravel avenue / alleys / plaza
  const lawnM = mat(tex(grassCanvas({ seed: 413, stripes: true, base: '#62a03e', light: '#93c856', dark: '#3f7a2a' }), { repeat: [1 / 3.2, 1 / 3.2] }), { rough: 0.95 }); lawnM.vertexColors = true;
  group.add(groundPlane('set.paris.lawn', lawnM, { ...PARK, seg: 64, tint: (x, z) => { const k = 1 + (hash2(Math.floor(x / 3), Math.floor(z / 3), 3) - 0.5) * 0.04 + (patchTint(7, 0.07, 0.07)(x, z)[0] - 1); return [k, k * 1.01, k]; } }));
  const paveM = mat(tex(slabCanvas('#b6aea0', 41), { repeat: [1 / 2.5, 1 / 2.5] }), { rough: 0.95 });
  const city = groundPlane('set.paris.pavement', paveM, { x0: OX - 420, x1: OX + 420, z0: OZ - 400, z1: OZ + 440, seg: 8, y: -0.02 });
  group.add(city);
  const gravM = mat(tex(gravelCanvas('#d8c9a6', 411), { repeat: [1 / 2.2, 1 / 2.2] }), { rough: 0.97 }); gravM.vertexColors = true;
  const gt = patchTint(17, 0.06, 0.2);
  group.add(patch('set.paris.avenue', gravM, AV.x0, AV.x1, PARK.z0, TZ - 17, 0.012, { seg: 8, tint: gt }));
  group.add(patch('set.paris.plaza', gravM, TX - 18, TX + 18, TZ - 17, TZ + 18, 0.012, { seg: 8, tint: gt }));
  for (const [a, b] of [[OX - 18.5, OX - 15], [OX + 27, OX + 30.5]]) group.add(patch('set.paris.alley', gravM, a, b, PARK.z0, TZ + 18, 0.011, { seg: 8, tint: gt }));
  // dark steel lawn edging along the avenue
  const edgeM = mat('#4a5a38', { rough: 0.9 });
  group.add(merged([boxG(0.06, 0.04, TZ - 17 - PARK.z0, AV.x0 - 0.03, 0.02, (PARK.z0 + TZ - 17) / 2), boxG(0.06, 0.04, TZ - 17 - PARK.z0, AV.x1 + 0.03, 0.02, (PARK.z0 + TZ - 17) / 2)], edgeM, 'set.paris.edging', { cast: false }));

  // ---- the Eiffel Tower
  const eif = buildEiffel(PARIS.tower.h);
  eif.group.position.set(TX, 0, TZ); group.add(eif.group);

  // ---- the city on the horizon
  group.add(buildCity(rng(77)));

  // ---- trees: rows along the side alleys, clumps on the lawns, a ring around the plaza
  const barkM = mat(tex(barkCanvas('#6a5040', 441)), { rough: 0.95 });
  const crownM = leafMat(leafCanvas('#4f8f36', 461, { n: 70 }));
  const TV = [roundTreeGeos(101, { trunkH: 2.8, trunkR: 0.24, crownR: 2.6, blobs: 6 }), roundTreeGeos(102, { trunkH: 2.5, trunkR: 0.22, crownR: 2.3, blobs: 5 }),
    roundTreeGeos(103, { trunkH: 3.0, trunkR: 0.26, crownR: 2.9, blobs: 7, squash: 0.8 })];
  const trees = [[], [], []];
  const addTree = (x, z, s = 1) => { const v = Math.floor(R() * 3); trees[v].push({ x, z, y: 0, ry: R() * TAU, s: s * (0.9 + R() * 0.2), col: [0.86 + R() * 0.2, 0.92 + R() * 0.14, 0.82 + R() * 0.18] }); };
  for (let z = PARK.z0 + 4; z < TZ + 20; z += 7.5) for (const x of [OX - 21, OX + 33]) addTree(x + (R() - 0.5) * 0.4, z + (R() - 0.5) * 0.6, 1.1);
  for (let z = PARK.z0 + 8; z < TZ + 22; z += 8.5) for (const x of [OX - 28, OX + 40]) addTree(x + (R() - 0.5) * 1.2, z + (R() - 0.5) * 1.5, 1.15);
  for (const [x, z, s] of [[OX - 11, 30, 0.95], [OX - 13.5, 41, 1.05], [OX - 9, 52, 0.9], [OX + 21.5, 26, 1.0], [OX + 23.5, 44, 1.1], [OX + 19.5, 54, 0.9],
    [OX - 12, -14, 1.0], [OX + 22, -18, 1.05], [TX - 22, TZ + 26, 1.2], [TX + 23, TZ + 27, 1.2], [TX - 10, TZ + 30, 1.1], [TX + 9, TZ + 31, 1.15], [TX + 1, TZ + 34, 1.2]]) addTree(x, z, s);
  for (let i = 0; i < 3; i++) {
    for (const im of inst('set.paris.trunk', TV[i].trunk, barkM, trees[i].map((t) => ({ ...t, col: undefined })), { cell: 40 })) group.add(im);
    for (const im of inst('set.paris.crown', TV[i].crown, crownM, trees[i], { cell: 40 })) group.add(im);
  }

  // ---- round trimmed bushes along the avenue + a few on the lawns
  const bushLeaf = leafMat(leafCanvas('#3f7a2e', 451, { n: 64 }));
  const ballG = ballBushGeo(31, 0.55);
  const balls = [];
  for (let z = -22.5; z < TZ - 20; z += 9) for (const x of [AV.x0 - 0.75, AV.x1 + 0.75]) {
    if (x < TX && Math.abs(z) < 4) continue;                          // keep the hiding bush alone
    balls.push({ x, z, y: 0, ry: R() * TAU, s: 0.95 + R() * 0.15 });
  }
  for (const [x, z, s] of [[OX - 4.2, 7.5, 1.0], [OX - 5.0, 9.2, 0.75], [OX - 7.5, 18, 1.1], [OX + 16.5, 9, 1.0], [OX + 15, 21, 0.9], [OX - 3, 15, 0.8]]) balls.push({ x, z, y: 0, ry: R() * TAU, s });
  for (const im of inst('set.paris.ballBush', ballG, bushLeaf, balls, { cell: 30 })) group.add(im);

  // ---- flower beds (red / pink / white clumps) on the left lawn, behind the hiding bush
  const bedCols = [[vc('#e8343a'), vc('#ff5a6a')], [vc('#ff8ac0'), vc('#f8f4f0')], [vc('#ffffff'), vc('#ffd23a')]];
  const clumpGs = bedCols.map((c, i) => flowerClumpGeo(300 + i, c, { r: 0.2, h: 0.24, n: 8 }));
  const clumpM = vcMat('#ffffff', { rough: 0.85 });
  const clumps = [[], [], []];
  const bed = (x0, x1, z0, z1, kind) => { for (let x = x0; x <= x1; x += 0.36) for (let z = z0; z <= z1; z += 0.36) clumps[kind].push({ x: x + (R() - 0.5) * 0.12, z: z + (R() - 0.5) * 0.12, y: 0, ry: R() * TAU, s: 0.85 + R() * 0.3 }); };
  const soilM = mat(tex(gravelCanvas('#6a4a32', 419), { repeat: [1, 1] }), { rough: 1 });
  for (const [x0, x1, z0, z1, kind] of [[OX - 7, OX - 1.5, 11.5, 13.0, 0], [OX - 8, OX - 2, 24, 25.6, 1], [OX + 13, OX + 18, 13, 14.5, 2], [OX - 8.5, OX - 3, 36, 37.6, 0]]) {
    group.add(patch('set.paris.bedSoil', soilM, x0 - 0.25, x1 + 0.25, z0 - 0.25, z1 + 0.25, 0.015));
    bed(x0, x1, z0, z1, kind);
  }
  clumps.forEach((list, i) => { for (const im of inst('set.paris.flowers', clumpGs[i], clumpM, list, { cell: 20 })) group.add(im); });

  // ---- benches + lamp posts along the avenue
  const bg = benchGeos(), lg = lampGeos();
  const benchSpots = [], lampSpots = [];
  for (const z of [7, 19, 31, 43]) { benchSpots.push([AV.x0 + 0.42, z, Math.PI / 2]); benchSpots.push([AV.x1 - 0.42, z - 6, -Math.PI / 2]); }
  for (const z of [-10, 1.5, 13, 25, 37, 49]) { lampSpots.push([AV.x0 + 0.25, z, 0]); lampSpots.push([AV.x1 - 0.25, z, 0]); }
  for (const z of [-6, 8, 22, 36, 50]) for (const x of [OX - 16.75, OX + 28.75]) lampSpots.push([x, z, 0]);
  const woodM = mat(tex(slabCanvas('#3c6a46', 51)), { rough: 0.8 }), ironM = mat('#252b27', { rough: 0.55, metal: 0.3 });
  const glassM = mat('#fff3d2', { rough: 0.2, emissive: '#ffd890', emissiveIntensity: 0.2 });
  group.add(msh(placeAll(bg.wood, benchSpots), woodM, 'set.paris.benchWood'));
  group.add(msh(placeAll(bg.iron, benchSpots), ironM, 'set.paris.benchIron'));
  group.add(msh(placeAll(lg.iron, lampSpots), ironM, 'set.paris.lampIron'));
  group.add(msh(placeAll(lg.glass, lampSpots), glassM, 'set.paris.lampGlass', { cast: false }));

  // ---- grass tufts + daisies near the action, avoiding gravel
  const onLawn = (x, z) => !(x > AV.x0 - 0.1 && x < AV.x1 + 0.1);
  const tuftG = grassTuftGeo(5, { blades: 7, h: 0.12 }), tuftM = vcMat('#7fbf4a', { rough: 0.95, side: THREE.DoubleSide });
  const tufts = [];
  for (let i = 0; i < 1500; i++) {
    const a = R() * TAU, r = 0.5 + Math.pow(R(), 0.7) * 14, x = OX + 1 + Math.cos(a) * r, z = OZ + 6 + Math.sin(a) * r * 1.3;
    if (!onLawn(x, z) || Math.hypot(x - OX, z - OZ) < 0.75) continue;
    tufts.push({ x, z, y: 0, ry: R() * TAU, s: 0.7 + R() * 0.7 });
  }
  for (const im of inst('set.paris.grass', tuftG, tuftM, tufts, { cell: 8, cast: false })) group.add(im);
  const daisyG = flowerGeo(vc('#ffffff'), vc('#ffcf30'), { h: 0.07, r: 0.022 }), daisyM = vcMat('#ffffff', { rough: 0.8, side: THREE.DoubleSide });
  const daisies = [];
  for (let i = 0; i < 260; i++) {
    const x = OX - 6 + R() * 14, z = OZ - 4 + R() * 20;
    if (!onLawn(x, z) || Math.hypot(x - OX, z - OZ) < 0.8) continue;
    daisies.push({ x, z, y: 0, ry: R() * TAU, s: 0.8 + R() * 0.5 });
  }
  for (const im of inst('set.paris.daisy', daisyG, daisyM, daisies, { cell: 10, cast: false })) group.add(im);

  // ---- THE hollow bush (pivot at its base centre)
  const [BX, BZ] = PARIS.bush.pos;
  const bush = new THREE.Group(); bush.name = 'set.paris.bush'; bush.position.set(BX, 0, BZ); group.add(bush);
  const hideLeaf = leafMat(leafCanvas('#447f30', 457, { n: 70 }));
  bush.add(msh(ringBushGeo(777, PARIS.bush.r, PARIS.bush.h), hideLeaf, 'set.paris.bushLeaves'));
  const litter = msh(new THREE.CircleGeometry(0.43, 12).rotateX(-Math.PI / 2).translate(0, 0.02, 0), mat('#2c3a1e', { rough: 1 }), 'set.paris.bushFloor', { cast: false });
  bush.add(litter);
  // mulch ring around the bush foot
  group.add(msh(new THREE.RingGeometry(0.5, 0.86, 18).rotateX(-Math.PI / 2).translate(BX, 0.008, BZ), mat(tex(gravelCanvas('#5e4430', 423)), { rough: 1 }), 'set.paris.bushMulch', { cast: false }));

  // ---- birds
  const birds = buildBirds(6, 515); group.add(birds.group);

  const props = { bush, tower: eif.group, towerPos: [TX, 0, TZ], towerH: PARIS.tower.h, key, sky: sky.root, benches: benchSpots, lamps: lampSpots, birds: birds.group };
  return {
    name: 'paris', group, props, key,
    look: { background: null, fog: { color: '#d9e4ea', near: 70, far: 420 }, exposure: 1.0, shadowCenter: [OX + 1.5, 0.6, OZ + 5], shadowRadius: 13 },
    defaults: () => ({ bushShake: 0, birds: 1 }),
    update(t, s, ctx) {
      sky.update(ctx.camera);
      const bs = clamp(s.bushShake ?? 0);
      if (bs > 0.001) {
        bush.rotation.set(Math.sin(t * 31) * 0.045 * bs, Math.sin(t * 17) * 0.06 * bs, Math.sin(t * 27 + 1) * 0.05 * bs);
        const k = 1 + Math.sin(t * 41) * 0.03 * bs; bush.scale.set(k, 1 + Math.sin(t * 37 + 2) * 0.03 * bs, k);
      } else { bush.rotation.set(0, 0, 0); bush.scale.set(1, 1, 1); }
      birds.group.visible = (s.birds ?? 1) > 0;
      if (birds.group.visible) birds.update(t);
    },
  };
}
