// World layout for set.js: terrain height, paths, keep-out zones, deterministic placement of trees and plants.
// Everything derives from layout.js (single source of truth) and fixed seeds.
import { rng, clamp } from './lib.js';
import { HIDE_TREE, YOU_SPOT, HIDE_BUSH, LEAF_BUSH, TENT, CAMP_CLEARING, BEAR_PATH, BRANCH, TRAIL, COMPARE, MAP_BEAR, RIVER,
  BIRD_TREES, FORE_BRANCH, FOREST, CLEARINGS, SUN } from './layout.js';
import { fbm, vnoise, sstep, segDist, polyDist, smoothPath, hash2 } from './set_util.js';

const sl = Math.hypot(...SUN.dir);
export const SUN_DIR = SUN.dir.map((v) => v / sl);
const shl = Math.hypot(SUN.dir[0], SUN.dir[2]);
export const SUN_H = [SUN.dir[0] / shl, SUN.dir[2] / shl];         // horizontal direction toward the sun
export const SUN_TAN = SUN.dir[1] / shl;                            // tan(sun elevation)
export const WATER_Y = -0.38;

// ---------------------------------------------------------------- paths
// trail centre line: follows the bear's route, then fades out as a deer track into the deep forest
const B = BEAR_PATH;
export const TRAIL_PTS = smoothPath([TRAIL.from, B.near, B.stop, B.enter, B.branch, B.start, TRAIL.to, [-2.3, 33], [-3.4, 40], [-4.2, 46]], 6);
export const TRAIL_END_Z = TRAIL.to[1];
// half width of the open strip at arc length / z
export function trailHalfW(z) { return z < TRAIL_END_Z ? TRAIL.width / 2 : TRAIL.width / 2 * (1 - sstep(TRAIL_END_Z, 44, z) * 0.62); }
export function trailInfo(x, z) { const r = polyDist(x, z, TRAIL_PTS); return r; }
export function trailX(z) { // x of the centre line at z (the line is monotonic in z)
  for (let i = 0; i < TRAIL_PTS.length - 1; i++) {
    const [ax, az] = TRAIL_PTS[i], [bx, bz] = TRAIL_PTS[i + 1];
    if (z <= bz || i === TRAIL_PTS.length - 2) { const t = clamp((z - az) / (bz - az)); return ax + (bx - ax) * t; }
  }
  return TRAIL_PTS[0][0];
}
// the bear's walk (feet), with the run-away exit
export const BEAR_LINE = [B.start, B.branch, B.enter, B.stop, B.near, B.close];
export const EXIT_LINE = [B.close, B.exit, [B.exit[0] + (B.exit[0] - B.close[0]) * 0.45, B.exit[1] + (B.exit[1] - B.close[1]) * 0.45]];
// worn footpath from the camp to YOU's tree
export const CAMP_PATH = smoothPath([[0.0, -1.5], [-0.9, -3.4], [-2.0, -5.3], [-2.5, -6.6]], 6);
export const FIRE = { pos: [TENT.pos[0] + Math.sin(TENT.rotY) * 2.75, TENT.pos[1] + Math.cos(TENT.rotY) * 2.75], r: 0.55 };
export const RIVER_PTS = smoothPath([[-150, 47], ...RIVER, [150, 61]], 10);
export function riverDist(x, z) { if (z < 30 || z > 80) return 99; return polyDist(x, z, RIVER_PTS).d; }

// ---------------------------------------------------------------- terrain height
function boxDist(x, z, x0, x1, z0, z1) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return Math.hypot(dx, dz); }
export function flatness(x, z) {
  let f = sstep(9, 0, boxDist(x, z, -15, 15, -20, 34));
  f = Math.max(f, sstep(16, 8, Math.hypot(x - COMPARE.pos[0], z - COMPARE.pos[1])));
  f = Math.max(f, sstep(12, 5, Math.hypot(x - MAP_BEAR.pos[0], z - MAP_BEAR.pos[1])));
  return f;
}
export function groundY(x, z) {
  const f = flatness(x, z);
  let h = 0;
  if (f < 1) {
    const big = (fbm(x * 0.018, z * 0.018, 5, 3) - 0.42) * 16;
    const small = (fbm(x * 0.06, z * 0.06, 9, 2) - 0.5) * 2.2;
    const far = sstep(60, 160, Math.hypot(x, z - 40)) * (fbm(x * 0.008, z * 0.008, 13, 2) * 26 - 4);
    h = Math.max(big + small + far, -0.6) * (1 - f);
  }
  const rd = riverDist(x, z);
  if (rd < 22) {
    const valley = sstep(22, 7, rd);
    h = h * (1 - valley) + 0.05 * valley;
    h = h + (-1.15 - h) * sstep(3.7, 2.1, rd);
  }
  return h;
}

// ---------------------------------------------------------------- keep-out zones
const CAMS = [ // cameras the set must stay out of (test views + planned shots): [x,y,z, radius]
  [2.0, 8.8, 5.6, 2.6],   // s28 canopy camera (only the FORE_BRANCH tree may be near it)
  [5.0, 6.0, 13.0, 3.4],  // s29 ending
  [26.0, 1.4, 6.0, 2.2],  // COMPARE front camera
  [3.5, 2.0, 7.5, 1.5],   // wide front
  [6.0, 30, -12, 0],
];
export function camDist(x, z) { let d = 99; for (const c of CAMS) if (c[3] > 0) d = Math.min(d, Math.hypot(x - c[0], z - c[2]) - c[3]); return d; }
export function clearingDist(x, z) { let d = 99; for (const c of CLEARINGS) d = Math.min(d, Math.hypot(x - c.pos[0], z - c.pos[1]) - c.r); return d; }
// distance outside the open trail strip (negative inside)
export function trailEdgeDist(x, z) {
  const r = trailInfo(x, z);
  if (z > 47) return 99;
  return r.d - trailHalfW(z);
}
export function bearPathDist(x, z) { return Math.min(polyDist(x, z, BEAR_LINE).d, polyDist(x, z, EXIT_LINE).d); }
export function campPathDist(x, z) { return polyDist(x, z, CAMP_PATH).d; }

// strict sun-lit spots (no crown shadows): YOU's spot, the lit part of the trail, the camp, COMPARE, the branch
function litDist(x, z) {
  let d = Math.hypot(x - 0.15, z - 0.05) - 1.7;
  d = Math.min(d, segDist(x, z, 0.15, 1.5, -0.75, 11.2).d - 1.6);
  d = Math.min(d, Math.hypot(x - TENT.pos[0], z - TENT.pos[1]) - 2.0);
  d = Math.min(d, Math.hypot(x - FIRE.pos[0], z - FIRE.pos[1]) - 1.2);
  d = Math.min(d, Math.hypot(x - COMPARE.pos[0], z - COMPARE.pos[1]) - 3.2);
  d = Math.min(d, Math.hypot(x - BRANCH.pos[0], z - BRANCH.pos[1]) - 0.55);
  return d;
}
// does a tree at (x,z) with this shape throw crown shadow (or trunk shadow on YOU) onto a lit spot?
function shadesLit(x, z, h, crownBase, crownR, trunkR) {
  const k0 = crownBase / SUN_TAN, k1 = Math.min(h / SUN_TAN, 58);
  for (let k = k0; k <= k1; k += 1.2) {
    const y = k * SUN_TAN, cr = crownR * clamp(1 - (y - crownBase) / Math.max(h - crownBase, 0.1)) * 0.75 + 0.2;
    if (litDist(x - SUN_H[0] * k, z - SUN_H[1] * k) < cr) return true;
  }
  for (let k = 0; k < Math.min(k0, 30); k += 0.5) { // trunk stripe across YOU or COMPARE
    const qx = x - SUN_H[0] * k, qz = z - SUN_H[1] * k;
    if (Math.hypot(qx - YOU_SPOT.pos[0], qz - YOU_SPOT.pos[1]) < trunkR + 0.55) return true;
    if (Math.hypot(qx - COMPARE.pos[0], qz - COMPARE.pos[1]) < trunkR + 2.6) return true;
  }
  return false;
}

// ---------------------------------------------------------------- tree variants (shapes at scale 1)
export const VARIANTS = {
  A: { h: 17.0, trunkR: 0.30, crownBase: 7.0, crownR: 2.7, tiers: 7, sides: 7, seed: 11 },   // tall old pine, high crown
  B: { h: 12.5, trunkR: 0.24, crownBase: 2.4, crownR: 2.5, tiers: 6, sides: 7, seed: 23 },   // full pine
  C: { h: 6.0, trunkR: 0.12, crownBase: 0.45, crownR: 1.55, tiers: 5, sides: 6, seed: 37 },  // young spruce
  D: { h: 13.0, trunkR: 0.22, crownBase: 99, crownR: 0, tiers: 0, sides: 6, seed: 41 },     // dead snag
};
export const FORE_TREE = { pos: [FORE_BRANCH.pos[0] - 0.24 * 0.968, FORE_BRANCH.pos[2] - 0.24 * 0.242], h: 17.5, trunkR: 0.34, crownBase: 11.2 };
export const BIRD_TREE_SET = BIRD_TREES.map(([x, z], i) => ({ x, z, h: [16.5, 18.5, 17.2, 15.8, 18.0][i % 5] }));

// ---------------------------------------------------------------- tree placement
export function placeTrees() {
  const R = rng(4242);
  const trees = [];
  const occupied = []; // [x,z,r]
  const fixed = [[HIDE_TREE.pos[0], HIDE_TREE.pos[1], 1.6], [FORE_TREE.pos[0], FORE_TREE.pos[1], 1.4]];
  for (const t of BIRD_TREE_SET) fixed.push([t.x, t.z, 1.5]);
  occupied.push(...fixed);
  // bird trees: tall A pines with high crowns (fixed)
  for (const t of BIRD_TREE_SET) trees.push({ v: 'A', x: t.x, z: t.z, y: groundY(t.x, t.z) - 0.05, s: t.h / VARIANTS.A.h, ry: hash2(t.x * 10, t.z * 10, 3) * 6.28, bird: true });
  const cellSz = 2.15;
  const free = (x, z, r) => { for (const o of occupied) if ((o[0] - x) ** 2 + (o[1] - z) ** 2 < (o[2] + r) ** 2) return false; return true; };
  for (let gz = FOREST.minZ; gz < FOREST.maxZ; gz += cellSz) {
    for (let gx = FOREST.minX; gx < FOREST.maxX; gx += cellSz) {
      const x = gx + (R() * 0.9 + 0.05) * cellSz, z = gz + (R() * 0.9 + 0.05) * cellSz;
      const roll = R(), vroll = R(), sroll = R(), rot = R() * Math.PI * 2;
      const te = trailEdgeDist(x, z);
      // density
      let dens = 0.4 + (fbm(x * 0.05, z * 0.05, 77, 3) - 0.5) * 0.9;
      const tz = z;
      const nearTrail = te < 7 && tz > 11 && tz < 40;
      if (nearTrail) dens = Math.max(dens, 0.82 - Math.max(te, 0) * 0.02);  // the dark trees along the trail
      if (te < 12 && tz > -2 && tz < 11) dens = Math.min(dens, 0.42);
      if (roll > dens) continue;
      // keep-outs
      if (te < 0.45) continue;
      if (clearingDist(x, z) < 0.8) continue;
      if (Math.hypot(x - YOU_SPOT.pos[0], z - YOU_SPOT.pos[1]) < 3.4) continue;
      if (bearPathDist(x, z) < 2.3) continue;
      if (campPathDist(x, z) < 1.3) continue;
      if (riverDist(x, z) < 4.6) continue;
      if (camDist(x, z) < 0.6) continue;
      if (Math.hypot(x - FIRE.pos[0], z - FIRE.pos[1]) < 3) continue;
      // variant
      let v;
      if (nearTrail) v = vroll < 0.36 ? 'A' : vroll < 0.78 ? 'B' : 'C';
      else v = vroll < 0.5 ? 'A' : vroll < 0.82 ? 'B' : 'C';
      if (vroll > 0.985) v = 'D';
      const V = VARIANTS[v];
      let s = 0.82 + sroll * 0.36;
      if (v === 'C') s = 0.7 + sroll * 0.6;
      const h = V.h * s, cb = V.crownBase * s, cr = V.crownR * s, tr = V.trunkR * s;
      const minR = v === 'C' ? 1.2 : v === 'D' ? 0.9 : 1.7;
      if (!free(x, z, minR)) continue;
      if (v !== 'D' && shadesLit(x, z, h, cb, cr, tr)) {
        // swap for a tall high-crown pine if that one is fine, else skip
        const sA = 1.0 + sroll * 0.12, hA = VARIANTS.A.h * sA;
        if (!shadesLit(x, z, hA, VARIANTS.A.crownBase * sA, VARIANTS.A.crownR * sA, VARIANTS.A.trunkR * sA) && free(x, z, 1.7)) { v = 'A'; s = sA; }
        else continue;
      }
      // the camera keep-outs need the crown radius at camera height
      let ok = true;
      for (const c of CAMS) {
        if (c[3] <= 0) continue;
        const Vv = VARIANTS[v], hh = Vv.h * s, cbb = Vv.crownBase * s;
        const crAt = c[1] < cbb || c[1] > hh ? Vv.trunkR * s + 0.4 : Vv.crownR * s * (1 - (c[1] - cbb) / (hh - cbb)) + 0.5;
        if (Math.hypot(x - c[0], z - c[2]) < crAt + 0.3) { ok = false; break; }
      }
      if (!ok) continue;
      occupied.push([x, z, v === 'C' ? 0.9 : 1.3]);
      trees.push({ v, x, z, y: groundY(x, z) - 0.06, s, ry: rot, dark: nearTrail ? 1 : 0 });
    }
  }
  return trees;
}

// far ring of simple cone trees outside FOREST (fills the horizon for aerial shots)
export function placeFarTrees() {
  const R = rng(9191), out = [];
  const step = 4.6;
  for (let z = -170; z < 300; z += step) for (let x = -230; x < 230; x += step) {
    const px = x + R() * step * 0.9, pz = z + R() * step * 0.9, r1 = R(), r2 = R();
    const inside = px > FOREST.minX - 2 && px < FOREST.maxX + 2 && pz > FOREST.minZ - 2 && pz < FOREST.maxZ + 2;
    if (inside) continue;
    if (riverDist(px, pz) < 5) continue;
    const d = Math.hypot(px, pz - 40);
    if (r1 > 0.78 - d / 1400) continue;
    out.push({ x: px, z: pz, y: groundY(px, pz) - 0.1, s: 0.85 + r2 * 0.5, ry: R() * 6.28 });
  }
  return out;
}

// ---------------------------------------------------------------- small plants / rocks
const PLAY = (x, z) => x > -30 && x < 34 && z > -24 && z < 40;
function plantOK(x, z, { path = 0.8, bear = 1.2, you = 0.9, extra = null } = {}) {
  if (Math.hypot(x - YOU_SPOT.pos[0], z - YOU_SPOT.pos[1]) < you) return false;
  if (Math.hypot(x - HIDE_TREE.pos[0], z - HIDE_TREE.pos[1]) < HIDE_TREE.trunkR + 0.35) return false;
  if (Math.hypot(x - HIDE_BUSH.pos[0], z - HIDE_BUSH.pos[1]) < HIDE_BUSH.r + 0.05) return false;
  if (Math.hypot(x - LEAF_BUSH.pos[0], z - LEAF_BUSH.pos[1]) < LEAF_BUSH.r + 0.15) return false;
  if (bearPathDist(x, z) < bear) return false;
  if (campPathDist(x, z) < path) return false;
  if (Math.hypot(x - TENT.pos[0], z - TENT.pos[1]) < TENT.size * 0.95) return false;
  if (Math.hypot(x - FIRE.pos[0], z - FIRE.pos[1]) < 1.6) return false;
  if (riverDist(x, z) < 3.3) return false;
  if (Math.hypot(x - COMPARE.pos[0], z - COMPARE.pos[1]) < 3.6) return false;
  if (Math.hypot(x - BRANCH.pos[0], z - BRANCH.pos[1]) < 0.75) return false;
  if (Math.hypot(x - (-0.6), z - 9.0) < 0.9) return false;      // low camera at the bear's entrance
  if (extra && !extra(x, z)) return false;
  return true;
}
export function placePlants(trees) {
  const R = rng(5150);
  const grass = [], ferns = [], bushes = [], rocks = [], cones = [], shrooms = [], flowers = [];
  const nearTrunk = (x, z, r) => trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < r * r);
  // grass tufts: the open trail strip (thick), clearing edges, river banks, sparse in the forest
  for (let i = 0; i < 9000 && grass.length < 3400; i++) {
    const x = -26 + R() * 56, z = -20 + R() * 62, k = R(), s = R(), ry = R() * 6.28;
    const te = trailEdgeDist(x, z), cd = clearingDist(x, z);
    let p = 0.08;
    if (te < 0.5) p = 0.75; else if (te < 2.5) p = 0.4;
    if (cd < 0.5) p = Math.max(p, 0.45);
    if (Math.hypot(x - COMPARE.pos[0], z - COMPARE.pos[1]) < 9) p = Math.max(p, 0.5);
    if (k > p) continue;
    if (!plantOK(x, z, { path: 0.55, bear: 0.62, you: 0.55 })) continue;
    if (nearTrunk(x, z, 0.45)) continue;
    grass.push({ x, z, y: groundY(x, z) - 0.01, s: 0.65 + s * 0.75, ry });
  }
  for (let i = 0; i < 700; i++) { // COMPARE + river banks
    const a = R() * 6.28, rr = 3.6 + R() * 6, x = COMPARE.pos[0] + Math.cos(a) * rr, z = COMPARE.pos[1] + Math.sin(a) * rr;
    if (Math.hypot(x - 26, z - 6) < 1.2) continue;
    if (!nearTrunk(x, z, 0.5)) grass.push({ x, z, y: groundY(x, z) - 0.01, s: 0.6 + R() * 0.7, ry: R() * 6.28 });
  }
  for (let i = 0; i < 1600; i++) {
    const t = R(), p = Math.floor(t * (RIVER_PTS.length - 1)), [ax, az] = RIVER_PTS[p], side = R() < 0.5 ? -1 : 1, off = 3.4 + R() * 3;
    const [bx, bz] = RIVER_PTS[p + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    const x = ax + nx * off * side, z = az + nz * off * side;
    if (x < -70 || x > 70) continue;
    if (riverDist(x, z) < 3.3) continue;
    grass.push({ x, z, y: groundY(x, z) - 0.01, s: 0.7 + R() * 0.8, ry: R() * 6.28 });
  }
  // ferns: forest floor near the play area + trail edges
  for (let i = 0; i < 4000 && ferns.length < 260; i++) {
    const x = -24 + R() * 50, z = -20 + R() * 56, k = R();
    const te = trailEdgeDist(x, z);
    let p = 0.12;
    if (te > 0.2 && te < 3.5) p = 0.55;
    if (nearTrunk(x, z, 2.2)) p += 0.2;
    if (k > p) continue;
    if (te < 0.1 || clearingDist(x, z) < -0.4) continue;
    if (!plantOK(x, z, { path: 1.0, bear: 1.6, you: 1.6 })) continue;
    if (nearTrunk(x, z, 0.55) || camDist(x, z) < 0.5) continue;
    ferns.push({ x, z, y: groundY(x, z) - 0.02, s: 0.65 + R() * 0.6, ry: R() * 6.28 });
  }
  // hand-placed ferns that frame YOU's tree (away from YOU's side)
  for (const [x, z, s] of [[-1.55, 0.55, 1.05], [-1.25, -0.85, 0.9], [-1.9, -0.2, 0.8], [1.95, -0.75, 0.75], [-2.2, 1.6, 0.85]]) ferns.push({ x, z, y: groundY(x, z) - 0.02, s, ry: hash2(x * 9, z * 9, 2) * 6.28 });
  // small round bushes: trail edges, clearing edges
  for (let i = 0; i < 3000 && bushes.length < 170; i++) {
    const x = -28 + R() * 58, z = -22 + R() * 64, k = R();
    const te = trailEdgeDist(x, z), cd = clearingDist(x, z);
    let p = 0.06;
    if (te > 0.3 && te < 4) p = 0.3;
    if (cd > 0.2 && cd < 3) p = Math.max(p, 0.3);
    if (k > p) continue;
    if (te < 0.25 || cd < 0.1) continue;
    if (!plantOK(x, z, { path: 1.2, bear: 2.0, you: 2.4 })) continue;
    if (nearTrunk(x, z, 0.9) || camDist(x, z) < 1.0) continue;
    if (bushes.some((b) => (b.x - x) ** 2 + (b.z - z) ** 2 < 1.4)) continue;
    bushes.push({ x, z, y: groundY(x, z) - 0.05, s: 0.55 + R() * 0.6, ry: R() * 6.28 });
  }
  // rocks
  for (let i = 0; i < 3000 && rocks.length < 90; i++) {
    const x = -34 + R() * 70, z = -26 + R() * 76, k = R();
    const te = trailEdgeDist(x, z);
    let p = 0.05;
    if (te > 0.2 && te < 3) p = 0.18;
    if (k > p) continue;
    if (!plantOK(x, z, { path: 1.2, bear: 2.2, you: 2.6 })) continue;
    if (nearTrunk(x, z, 1.0) || camDist(x, z) < 1.2 || clearingDist(x, z) < 0.3) continue;
    const s = 0.22 + Math.pow(R(), 2.2) * 0.8;
    rocks.push({ x, z, y: groundY(x, z) - s * 0.25, s, ry: R() * 6.28, seed: i });
  }
  // pine cones, mushrooms, flowers near the play area
  for (let i = 0; i < 2000 && cones.length < 140; i++) {
    const x = -10 + R() * 18, z = -12 + R() * 34;
    if (!nearTrunk(x, z, 3.5) && Math.hypot(x - HIDE_TREE.pos[0], z - HIDE_TREE.pos[1]) > 2.2) continue;
    if (!plantOK(x, z, { path: 0.5, bear: 0.9, you: 0.5 })) continue;
    cones.push({ x, z, y: groundY(x, z) + 0.012, s: 0.8 + R() * 0.5, ry: R() * 6.28, rx: 1.45 + (R() - 0.5) * 0.4 });
  }
  for (let i = 0; i < 400 && shrooms.length < 14; i++) {
    const t = trees[Math.floor(R() * trees.length)];
    if (!t || !PLAY(t.x, t.z) || Math.abs(t.x) > 16) continue;
    const a = R() * 6.28, x = t.x + Math.cos(a) * 0.55, z = t.z + Math.sin(a) * 0.55;
    if (!plantOK(x, z, { path: 0.7, bear: 1.2, you: 1.5 })) continue;
    shrooms.push({ x, z, y: groundY(x, z), s: 0.7 + R() * 0.6, ry: R() * 6.28 });
  }
  for (let i = 0; i < 2600 && flowers.length < 260; i++) {
    const x = -14 + R() * 50, z = -16 + R() * 40;
    const te = trailEdgeDist(x, z), cd = clearingDist(x, z);
    if (!(te < 1.5 || cd < 1.5)) continue;
    if (!plantOK(x, z, { path: 0.6, bear: 0.8, you: 1.0 })) continue;
    if (nearTrunk(x, z, 0.6)) continue;
    flowers.push({ x, z, y: groundY(x, z), s: 0.7 + R() * 0.6, ry: R() * 6.28, c: Math.floor(R() * 3) });
  }
  return { grass, ferns, bushes, rocks, cones, shrooms, flowers };
}

// macro ground colour + tree-density helpers for the ground texture
export function treeDensityGrid(trees, x0, z0, w, h, cell) {
  const g = new Float32Array(w * h);
  for (const t of trees) {
    const r = (t.v === 'C' ? 1.6 : 2.6) * t.s, gx = (t.x - x0) / cell, gz = (t.z - z0) / cell, rc = r / cell;
    for (let j = Math.max(0, Math.floor(gz - rc)); j <= Math.min(h - 1, Math.ceil(gz + rc)); j++)
      for (let i = Math.max(0, Math.floor(gx - rc)); i <= Math.min(w - 1, Math.ceil(gx + rc)); i++) {
        const d = Math.hypot(i - gx, j - gz) / rc;
        if (d < 1) g[j * w + i] += (1 - d * d) * (t.v === 'C' ? 0.5 : 1);
      }
  }
  return g;
}
export { vnoise, fbm };
