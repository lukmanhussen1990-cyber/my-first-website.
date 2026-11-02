// The WEDDING garden (flower arch, white chairs, aisle runner + petals) and the PORCH house at sunset (wooden house,
// glowing windows, porch with railing + steps, the porch swing on chains, garden, picket fence). Place contract:
// see set.js. Kit + textures from the Paris builder (set_out_kit.js, set_out_tex.js).
import * as THREE from 'three';
import { mat, tex, clamp, rng } from './lib.js';
import { WEDDING, PORCH } from './layout.js';
import { mergeGeos, faceColors, hash2 } from './set_util.js';
import { V, C, TAU, msh, merged, boxG, cylG, buildSky, keyLight, groundPlane, patch, patchTint, roundTreeGeos, ballBushGeo,
  hedgeGeo, flowerClumpGeo, inst, leafMat, vcMat, vc } from './set_out_kit.js';
import { grassCanvas, runnerCanvas, whiteWoodCanvas, sidingCanvas, shingleCanvas, deckCanvas, beadboardCanvas, warmWindowCanvas,
  porchDoorCanvas, flagstoneCanvas, barkCanvas, leafCanvas } from './set_out_tex.js';

const T = (c, r = [1, 1]) => tex(c, { repeat: r });
const box = (g, w, h, d, m, x, y, z, name, cast = true) => { const o = msh(new THREE.BoxGeometry(w, h, d), m, name, { cast }); o.position.set(x, y, z); g.add(o); return o; };
const PINK = [[1.0, 0.62, 0.74], [1.0, 1.0, 0.98], [1.0, 0.8, 0.86], [0.98, 0.5, 0.66]];

function lawnMat(seed) {
  const m = mat(tex(grassCanvas({ seed, base: '#64a03e', light: '#93c856', dark: '#3f7a2a' }), { repeat: [1 / 3, 1 / 3] }), { rough: 0.95 });
  m.vertexColors = true; return m;
}
function treesAround(group, name, cx, cz, spots, seed) {
  const R = rng(seed);
  const barkM = mat(tex(barkCanvas('#6a5040', 441)), { rough: 0.95 });
  const crownM = leafMat(leafCanvas('#4f8f36', 461, { n: 70 }));
  const TV = [roundTreeGeos(seed + 1, { trunkH: 2.6, trunkR: 0.22, crownR: 2.4, blobs: 6 }), roundTreeGeos(seed + 2, { trunkH: 3.0, trunkR: 0.26, crownR: 2.8, blobs: 7, squash: 0.8 })];
  const lists = [[], []];
  for (const [x, z, s] of spots) lists[Math.floor(R() * 2)].push({ x: cx + x, z: cz + z, y: 0, ry: R() * TAU, s: s * (0.9 + R() * 0.2), col: [0.86 + R() * 0.2, 0.92 + R() * 0.14, 0.82 + R() * 0.18] });
  for (let i = 0; i < 2; i++) {
    for (const im of inst(`${name}.trunk`, TV[i].trunk, barkM, lists[i].map((t) => ({ ...t, col: undefined })), { cell: 40 })) group.add(im);
    for (const im of inst(`${name}.crown`, TV[i].crown, crownM, lists[i], { cell: 40 })) group.add(im);
  }
}

// ================================================================= WEDDING
export function buildWedding(env) {
  const group = new THREE.Group(); group.name = 'set.wedding';
  const [OX, OZ] = WEDDING.origin;
  const SUN = V(-0.45, 0.62, -0.62).normalize();
  const sky = buildSky('wedding', {
    zenith: '#3f86d8', mid: '#8fc2ee', horizon: '#e4eef2', horizonSun: '#f6ecd8', below: '#e4eef2', glow: '#fff6e0',
    sunDir: SUN, hzBand: 0.2, midStart: 0.1, midBand: 0.95, glowPow: 5, glowAmt: 0.5,
    cloudTop: '#ffffff', cloudShade: '#c4d2e4', cloudRim: '#fff8ec',
    clouds: [{ at: [0.1, 0.18], w: 80, h: 18, seed: 41 }, { at: [0.5, 0.28], w: 60, h: 16, seed: 42 }, { at: [-0.3, 0.22], w: 70, h: 18, seed: 43 },
      { at: [-0.7, 0.14], w: 80, h: 18, seed: 44 }, { at: [0.85, 0.16], w: 70, h: 18, seed: 45 }, { at: [0.0, 0.5], w: 54, h: 14, seed: 46, flat: true }],
  });
  group.add(sky.root);
  const key = keyLight('wedding', '#fff0d8', 2.6, SUN); group.add(key, key.target);
  group.add(new THREE.HemisphereLight(C('#c4dcff'), C('#6a7a48'), 1.15));
  // lawn + aisle runner with petals
  group.add(groundPlane('set.wedding.lawn', lawnMat(415), { x0: OX - 60, x1: OX + 60, z0: OZ - 40, z1: OZ + 60, seg: 40, tint: patchTint(9, 0.08, 0.1) }));
  const runM = mat(T(runnerCanvas(461), [1, 6]), { rough: 0.85 });
  group.add(patch('set.wedding.runner', runM, OX - 0.55, OX + 0.55, OZ - 2.5, OZ + 4.6, 0.012));
  const R = rng(777);
  const petalG = new THREE.PlaneGeometry(0.05, 0.035); petalG.rotateX(-Math.PI / 2); petalG.translate(0, 0.016, 0);
  const petalItems = [];
  for (let i = 0; i < 160; i++) petalItems.push({ x: OX + (R() - 0.5) * 1.3, z: OZ - 2.4 + R() * 7.2, y: 0, ry: R() * TAU, s: 0.8 + R() * 0.5, col: PINK[i % 4] });
  for (const im of inst('set.wedding.petals', petalG, mat('#ffffff', { rough: 0.8, side: THREE.DoubleSide }), petalItems, { cell: 6, cast: false })) group.add(im);
  // the flower arch: two white posts + a half-circle arc, covered in pink + white flower clumps
  const woodM = mat(T(whiteWoodCanvas(465)), { rough: 0.7 });
  const [ax, az] = WEDDING.arch.pos;
  for (const sd of [-1, 1]) box(group, 0.12, 1.55, 0.12, woodM, ax + sd * 0.95, 0.775, az, 'archPost');
  const arc = msh(new THREE.TorusGeometry(0.95, 0.06, 6, 20, Math.PI), woodM, 'archArc'); arc.position.set(ax, 1.55, az); group.add(arc);
  const clumpGs = [0, 1, 2].map((i) => flowerClumpGeo(500 + i, PINK, { r: 0.2, h: 0.24, n: 9, fr: 0.05 }));
  const archFlowers = [[], [], []];
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; archFlowers[i % 3].push({ x: ax + Math.cos(a) * 0.95, z: az + (R() - 0.5) * 0.08, y: 1.55 + Math.sin(a) * 0.95 - 0.12, ry: R() * TAU, s: 0.9 + R() * 0.4 }); }
  for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) archFlowers[k % 3].push({ x: ax + sd * 0.95 + (R() - 0.5) * 0.08, z: az + (R() - 0.5) * 0.1, y: 0.1 + k * 0.26, ry: R() * TAU, s: 0.75 + R() * 0.3 });
  archFlowers.forEach((list, i) => { for (const im of inst('set.wedding.archFlowers', clumpGs[i], vcMat('#ffffff'), list, { cell: 8 })) group.add(im); });
  // white folding chairs facing +Z on both sides of the aisle
  const seats = [];
  const chairGeo = mergeGeos([boxG(0.42, 0.04, 0.4, 0, WEDDING.seatY, 0), boxG(0.42, 0.06, 0.03, 0, WEDDING.seatY + 0.42, -0.19), boxG(0.42, 0.04, 0.03, 0, WEDDING.seatY + 0.26, -0.19),
    ...[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, z]) => boxG(0.035, WEDDING.seatY, 0.035, x, WEDDING.seatY / 2, z)),
    boxG(0.035, 0.5, 0.035, -0.18, WEDDING.seatY + 0.22, -0.19), boxG(0.035, 0.5, 0.035, 0.18, WEDDING.seatY + 0.22, -0.19)]);
  const chairs = [];
  for (const z of WEDDING.rows) for (const sd of [-1, 1]) for (let i = 0; i < WEDDING.seatsPerSide; i++) {
    const x = OX + sd * (WEDDING.aisle + 0.31 + i * WEDDING.seatGap);
    chairs.push({ x, z: OZ + z, y: 0, ry: 0, s: 1 }); seats.push({ pos: [x, OZ + z], rotY: 0 });
  }
  for (const im of inst('set.wedding.chairs', chairGeo, woodM, chairs, { cell: 8 })) group.add(im);
  // little bouquets on the aisle chairs
  const bq = [];
  for (const z of WEDDING.rows) for (const sd of [-1, 1]) bq.push({ x: OX + sd * (WEDDING.aisle + 0.1), z: OZ + z - 0.19, y: WEDDING.seatY + 0.3, ry: 0, s: 0.45 });
  for (const im of inst('set.wedding.bouquets', clumpGs[0], vcMat('#ffffff'), bq, { cell: 8 })) group.add(im);
  // hedges + flower beds behind the arch, trees around
  const hedgeM = leafMat(leafCanvas('#3f7a2e', 451, { n: 64 }));
  group.add(msh(hedgeGeo(61, 14, 1.6, 0.9).translate(OX, 0, OZ + 8.2), hedgeM, 'set.wedding.hedge'));
  for (const sd of [-1, 1]) group.add(msh(hedgeGeo(62 + sd, 9, 1.4, 0.8).rotateY(Math.PI / 2).translate(OX + sd * 7.5, 0, OZ + 3.5), hedgeM, 'set.wedding.hedgeSide'));
  const beds = [];
  for (let i = 0; i < 22; i++) beds.push({ x: OX - 6.5 + i * 0.62, z: OZ + 7.4 + (i % 2) * 0.2, y: 0, ry: R() * TAU, s: 1.1 + R() * 0.4 });
  for (const im of inst('set.wedding.beds', clumpGs[1], vcMat('#ffffff'), beds, { cell: 8 })) group.add(im);
  treesAround(group, 'set.wedding', OX, OZ, [[-11, 9, 1.2], [-13, 2, 1.1], [-12, -6, 1.0], [11, 9, 1.2], [13, 1, 1.1], [12, -7, 1.0], [-5, 13, 1.25], [4, 14, 1.3], [0, 18, 1.4], [-18, 12, 1.3], [18, 12, 1.3]], 600);
  // a small cake table on the side
  const clothM = mat('#fbfaf6', { rough: 0.8 });
  const ct = msh(new THREE.CylinderGeometry(0.42, 0.46, 0.76, 14), clothM, 'cakeTable'); ct.position.set(OX + 3.6, 0.38, OZ + 5.4); group.add(ct);
  for (const [r, y] of [[0.24, 0.86], [0.17, 1.02], [0.11, 1.16]]) { const c = msh(new THREE.CylinderGeometry(r, r, 0.15, 14), mat('#fff6f0', { rough: 0.6 }), 'cake'); c.position.set(OX + 3.6, y, OZ + 5.4); group.add(c); }
  return {
    name: 'wedding', group, props: { seats, arch: [ax, 0, az] }, key,
    look: { background: null, fog: { color: '#e4eef2', near: 60, far: 300 }, exposure: 1.0, shadowCenter: [OX, 0.8, OZ + 3], shadowRadius: 8 },
    defaults: () => ({}),
    update(t, s, ctx) { sky.update(ctx.camera); },
  };
}

// ================================================================= PORCH (sunset)
export function buildPorch(env) {
  const group = new THREE.Group(); group.name = 'set.porch';
  const [OX, OZ] = PORCH.origin;
  const SUN = V(-0.62, 0.2, -0.76).normalize();          // low sun behind the camera, to the left: lights the house front
  const sky = buildSky('porch', {
    zenith: '#3a4a8e', mid: '#c0789a', horizon: '#ffb98a', horizonSun: '#ffd28a', midSun: '#f0a07a', below: '#ffb98a', glow: '#ffe4a8',
    sunDir: SUN, hzBand: 0.25, midStart: 0.12, midBand: 1.0, glowPow: 4, glowAmt: 0.7, sunAzPow: 2,
    cloudTop: '#ffd8c0', cloudShade: '#a86a8a', cloudRim: '#fff0c0',
    clouds: [{ at: [3.0, 0.12], w: 90, h: 16, seed: 71 }, { at: [3.4, 0.22], w: 70, h: 14, seed: 72 }, { at: [2.6, 0.3], w: 60, h: 14, seed: 73 },
      { at: [-0.2, 0.2], w: 80, h: 16, seed: 74 }, { at: [0.4, 0.32], w: 60, h: 14, seed: 75 }, { at: [-0.6, 0.4], w: 54, h: 12, seed: 76, flat: true }],
  });
  group.add(sky.root);
  const key = keyLight('porch', '#ffb878', 2.5, SUN); group.add(key, key.target);
  group.add(new THREE.HemisphereLight(C('#f0a8b8'), C('#4a5a34'), 1.1));
  // ground + stone path to the steps
  group.add(groundPlane('set.porch.lawn', lawnMat(417), { x0: OX - 70, x1: OX + 70, z0: OZ - 80, z1: OZ + 60, seg: 40, tint: patchTint(11, 0.08, 0.1) }));
  const flagM = mat(T(flagstoneCanvas(485), [1, 6]), { rough: 0.9 });
  group.add(patch('set.porch.path', flagM, OX - 0.6, OX + 0.6, OZ - 9.0, OZ - 0.9, 0.012));
  // the house
  const H = { x0: OX - 5.5, x1: OX + 5.5, z0: OZ + PORCH.houseZ, z1: OZ + 10, wall: 5.4 };
  const W = H.x1 - H.x0, D = H.z1 - H.z0, hx = (H.x0 + H.x1) / 2, hz = (H.z0 + H.z1) / 2;
  const sidingM = mat(T(sidingCanvas('#9fc0d4', 471), [W / 2.4, H.wall / 2.4]), { rough: 0.8 });
  box(group, W, H.wall, D, sidingM, hx, H.wall / 2, hz, 'houseBody');
  const trimM = mat(T(whiteWoodCanvas(467, '#f6f4ee')), { rough: 0.7 });
  for (const sd of [-1, 1]) box(group, 0.18, H.wall, 0.18, trimM, hx + sd * W / 2, H.wall / 2, H.z0 - 0.02, 'cornerTrim');
  // gable roof (ridge along x), shingles
  const roofM = mat(T(shingleCanvas('#6a5552', 473), [W / 2, 3]), { rough: 0.85 });
  const rise = 2.8, half = D / 2 + 0.5;
  const slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const sd of [-1, 1]) {
    const r = box(group, W + 0.8, 0.14, slope, roofM, hx, H.wall + rise / 2, hz + sd * half / 2, 'roof');
    r.rotation.x = sd * ang;
  }
  const gable = new THREE.Shape(); gable.moveTo(-D / 2 - 0.02, 0); gable.lineTo(D / 2 + 0.02, 0); gable.lineTo(0, rise); gable.lineTo(-D / 2 - 0.02, 0);
  for (const sd of [-1, 1]) { const gg = new THREE.ShapeGeometry(gable); const gm = msh(gg, sidingM, 'gable'); gm.rotation.y = Math.PI / 2; gm.position.set(hx + sd * (W / 2 + 0.001) * 1, H.wall, hz); if (sd < 0) gm.rotation.y = -Math.PI / 2; group.add(gm); }
  box(group, 0.7, 1.8, 0.7, mat('#8a4a3a', { rough: 0.9 }), hx + 3.2, H.wall + rise * 0.7, hz + 1.2, 'chimney');
  // windows (glowing warm) + front door
  const winM = (seed) => { const m = mat(T(warmWindowCanvas({ seed })), { rough: 0.3, emissive: '#ffffff', emissiveIntensity: 0.85 }); m.emissiveMap = m.map; return m; };
  const wins = [[hx - 3.4, 1.65], [hx + 3.4, 1.65], [hx - 3.4, 4.0], [hx, 4.0], [hx + 3.4, 4.0]];
  for (const [i, [wx, wy]] of wins.entries()) {
    box(group, 1.15, 1.55, 0.04, winM(481 + i), wx, wy, H.z0 - 0.02, 'window', false);
    box(group, 1.35, 0.12, 0.12, trimM, wx, wy - 0.84, H.z0 - 0.06, 'sill', false);
    for (const sd of [-1, 1]) box(group, 0.28, 1.6, 0.05, mat('#3a6a5a', { rough: 0.7 }), wx + sd * 0.74, wy, H.z0 - 0.05, 'shutter', false);
  }
  const doorM = mat(T(porchDoorCanvas('#a8473a', 483)), { rough: 0.6 });
  box(group, 1.05, 2.15, 0.06, doorM, hx + 1.55, PORCH.deckY + 1.075, H.z0 - 0.02, 'frontDoor', false);
  box(group, 1.25, 0.12, 0.1, trimM, hx + 1.55, PORCH.deckY + 2.2, H.z0 - 0.05, 'doorTrim', false);
  // porch: deck, lattice skirt, posts, railing, steps, roof with beadboard ceiling
  const deckM = mat(T(deckCanvas('#b07a48', 475), [4, 1]), { rough: 0.75 });
  const P = { x0: OX - 4.2, x1: OX + 4.2, z0: OZ, z1: H.z0 };
  box(group, P.x1 - P.x0, PORCH.deckY, P.z1 - P.z0, deckM, OX, PORCH.deckY / 2, (P.z0 + P.z1) / 2, 'deck');
  box(group, P.x1 - P.x0, PORCH.deckY - 0.06, 0.04, mat('#e8e2d4', { rough: 0.8 }), OX, (PORCH.deckY - 0.06) / 2, P.z0 - 0.02, 'lattice', false);
  const ceilY = 2.95;
  for (const x of [P.x0 + 0.1, OX - 1.0, OX + 1.0, P.x1 - 0.1]) box(group, 0.14, ceilY - PORCH.deckY, 0.14, trimM, x, PORCH.deckY + (ceilY - PORCH.deckY) / 2, P.z0 + 0.1, 'porchPost');
  const rail = (a, b) => {
    box(group, b - a, 0.07, 0.08, trimM, (a + b) / 2, PORCH.deckY + 0.85, P.z0 + 0.1, 'rail');
    box(group, b - a, 0.05, 0.06, trimM, (a + b) / 2, PORCH.deckY + 0.08, P.z0 + 0.1, 'railLow', false);
    for (let x = a + 0.12; x < b - 0.06; x += 0.16) box(group, 0.035, 0.8, 0.035, trimM, x, PORCH.deckY + 0.45, P.z0 + 0.1, 'baluster', false);
  };
  rail(P.x0 + 0.1, OX - 1.0); rail(OX + 1.0, P.x1 - 0.1);
  for (let i = 0; i < 3; i++) box(group, 1.9, 0.15, 0.3, deckM, OX, PORCH.deckY - 0.15 * (i + 1) + 0.075, P.z0 - 0.15 - i * 0.3, 'step');
  const ceilM = mat(T(beadboardCanvas('#bfe2e0', 477), [4, 1]), { rough: 0.8 });
  box(group, P.x1 - P.x0 + 0.4, 0.06, P.z1 - P.z0 + 0.3, ceilM, OX, ceilY, (P.z0 + P.z1) / 2 - 0.1, 'porchCeiling', false);
  const pr = box(group, P.x1 - P.x0 + 0.6, 0.1, P.z1 - P.z0 + 0.6, roofM, OX, ceilY + 0.22, (P.z0 + P.z1) / 2 - 0.15, 'porchRoof'); pr.rotation.x = -0.12;
  // a porch light by the door
  const pl = new THREE.PointLight('#ffcf8a', 6, 6, 1.6); pl.position.set(hx + 0.75, PORCH.deckY + 2.0, H.z0 - 0.25); group.add(pl);
  box(group, 0.14, 0.22, 0.1, new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf80', emissiveIntensity: 2 }), hx + 0.75, PORCH.deckY + 2.0, H.z0 - 0.07, 'porchLamp', false);
  // the porch swing: hangs from two hooks on the ceiling; state.swing rotates it around the hook line (x axis)
  const [sx, sz] = PORCH.swing.pos;
  const L = 1.55, hookY = PORCH.swing.seatY + L;
  const swing = new THREE.Group(); swing.position.set(sx, hookY, sz); group.add(swing);
  const slatM = mat(T(deckCanvas('#c89a62', 479), [2, 1]), { rough: 0.7 });
  const sw = PORCH.swing.w;
  box(swing, sw, 0.06, 0.5, slatM, 0, -L, 0.02, 'swingSeat');
  const back = box(swing, sw, 0.5, 0.05, slatM, 0, -L + 0.3, 0.26, 'swingBack'); back.rotation.x = -0.12;   // backrest on the house side (+Z)
  for (const sd of [-1, 1]) {
    box(swing, 0.06, 0.32, 0.5, slatM, sd * (sw / 2 - 0.03), -L + 0.16, 0.02, 'swingArm');
    const ch = msh(new THREE.CylinderGeometry(0.012, 0.012, L - 0.1, 4), mat('#3a3a3a', { rough: 0.4, metal: 0.6 }), 'swingChain'); ch.position.set(sd * (sw / 2 - 0.03), -(L - 0.1) / 2, 0.02); swing.add(ch);
  }
  const cushion = box(swing, sw - 0.2, 0.08, 0.42, mat('#d86a7a', { rough: 0.9 }), 0, -L + 0.07, 0.04, 'swingCushion');
  // garden: bushes along the porch, flower beds, trees, white picket fence with a gate gap at the path
  const R = rng(4321);
  const bushLeaf = leafMat(leafCanvas('#3f7a2e', 452, { n: 64 }));
  const ballG = ballBushGeo(33, 0.5);
  const balls = [];
  for (const x of [-3.6, -2.4, 2.4, 3.6]) balls.push({ x: OX + x, z: OZ - 0.55, y: 0, ry: R() * TAU, s: 0.9 + R() * 0.25 });
  for (const [x, z, s] of [[-4.5, -4.5, 1.2], [4.8, -4.2, 1.1], [-7.5, -1.5, 1.3], [7.6, -1.0, 1.25], [-2.6, -7.2, 0.9], [2.8, -7.4, 0.95]]) balls.push({ x: OX + x, z: OZ + z, y: 0, ry: R() * TAU, s });
  for (const im of inst('set.porch.bushes', ballG, bushLeaf, balls, { cell: 20 })) group.add(im);
  const petals = [[[1.0, 0.85, 0.3], [1.0, 1.0, 0.95]], [[0.98, 0.5, 0.66], [1.0, 0.75, 0.82]], [[0.75, 0.55, 0.95], [1.0, 1.0, 0.95]]];
  const fcs = petals.map((p, i) => flowerClumpGeo(700 + i, p, { r: 0.24, h: 0.28, n: 8 }));
  const fl = [[], [], []];
  for (let i = 0; i < 26; i++) { const sd = i % 2 ? 1 : -1; fl[i % 3].push({ x: OX + sd * (1.3 + R() * 1.6), z: OZ - 1.6 - R() * 6.5, y: 0, ry: R() * TAU, s: 0.9 + R() * 0.5 }); }
  for (let i = 0; i < 14; i++) fl[i % 3].push({ x: OX - 4 + i * 0.6, z: OZ - 1.0 - (i % 2) * 0.25, y: 0, ry: R() * TAU, s: 0.8 + R() * 0.3 });
  fl.forEach((list, i) => { for (const im of inst('set.porch.flowers', fcs[i], vcMat('#ffffff'), list, { cell: 10 })) group.add(im); });
  const fenceM = mat(T(whiteWoodCanvas(469, '#f4f2ec')), { rough: 0.7 });
  const pickets = [];
  for (let x = -9.5; x <= 9.5; x += 0.22) { if (Math.abs(x) < 0.75) continue; pickets.push(boxG(0.09, 1.0, 0.04, OX + x, 0.5, OZ + PORCH.fenceZ)); pickets.push(boxG(0.064, 0.064, 0.04, OX + x, 1.02, OZ + PORCH.fenceZ, 0, 0, Math.PI / 4)); }
  for (const sd of [-1, 1]) for (const y of [0.3, 0.75]) pickets.push(boxG(8.8, 0.07, 0.04, OX + sd * 5.15, y, OZ + PORCH.fenceZ + 0.04));
  group.add(merged(pickets, fenceM, 'set.porch.fence'));
  const mb = box(group, 0.22, 0.24, 0.42, mat('#2a5aa8', { rough: 0.5 }), OX + 1.25, 1.1, OZ + PORCH.fenceZ - 0.25, 'mailbox');
  box(group, 0.06, 1.0, 0.06, fenceM, OX + 1.25, 0.5, OZ + PORCH.fenceZ - 0.25, 'mailboxPost');
  treesAround(group, 'set.porch', OX, OZ, [[-10, 4, 1.3], [-12.5, -3, 1.2], [10.5, 5, 1.35], [12.5, -2, 1.15], [-8, 14, 1.4], [8, 15, 1.4], [-18, 8, 1.5], [18, 9, 1.5], [-22, -6, 1.3], [22, -5, 1.3], [0, 20, 1.6]], 800);
  return {
    name: 'porch', group, props: { swing }, key,
    look: { background: null, fog: { color: '#f2b090', near: 45, far: 260 }, exposure: 1.05, shadowCenter: [OX, 1.2, OZ + 1], shadowRadius: 9 },
    defaults: () => ({ swing: null }),
    update(t, s, ctx) {
      sky.update(ctx.camera);
      swing.rotation.x = s.swing != null ? s.swing : 0.07 * Math.sin((t * 2 * Math.PI) / 3.4);
    },
  };
}
