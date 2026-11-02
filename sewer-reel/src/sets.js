// World building: medieval timber town, underground cutaway, brick sewer
// tunnel, river + treatment plant. Each set is a Group that can be toggled.
import * as THREE from 'three';
import * as TX from './textures.js';
import { mat, mesh, grp, sphere, capsule, cyl, rbox, box, torus, cone, makeTree, makePoop, makeToilet, makePerson, makeBean, makeFish, makeShovel } from './toys.js';
import { rng } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge all static meshes under `root` into one mesh per material (huge draw-call saving).
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) return;
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g); victims.push(o);
  });
  for (const v of victims) v.parent.remove(v);
  for (const [m, list] of buckets) {
    const mm = new THREE.Mesh(mergeGeometries(list), m); mm.castShadow = mm.receiveShadow = true; root.add(mm);
  }
  return root;
}

const T = {};
export function initTextures() {
  T.cobble = TX.cobble(11); T.brick = TX.bricks(12); T.soil = TX.soil(13); T.roof = TX.roofTiles(14);
  T.roofDark = TX.roofTiles(15, '#8a5038'); T.grass = TX.grass(16); T.planks = TX.planks(17); T.ripple = TX.ripples(18);
  T.water = TX.ripples(19, '#2f8fd0', 'rgba(255,255,255,0.4)'); T.dirtyWater = TX.ripples(20, '#6f5a2c', 'rgba(255,230,170,0.3)');
  T.banner = TX.banner('@Grace In Motion'); T.newspaper = TX.newspaper();
  T.plaster = ['#f3e4c6', '#f6e8bb', '#f2d6c9', '#e9ece2', '#f7f0e2', '#f0dcb8'].map((c, i) => TX.plaster(30 + i, c));
  return T;
}
const texRep = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };

// ---------------- timber-frame house (facade faces +z) ----------------
const BEAM = '#4d3022';
export function makeHouse(o) {
  const { w = 7, d = 6, floors = 2, seed = 1, wallIdx = 0, roofDark = false } = o;
  const R = rng(seed);
  const g = new THREE.Group();
  const fh = 3.2, jet = 0.35;
  const wallM = mat('#ffffff', { map: T.plaster[wallIdx % T.plaster.length], rough: 0.85 });
  const beamM = mat(BEAM, { rough: 0.6 });
  const info = { windows: [], g, w, d, fh, jet };
  for (let f = 0; f < floors; f++) {
    const fd = d + (f > 0 ? jet : 0), zc = (f > 0 ? jet / 2 : 0);
    mesh(box(w, fh, fd), wallM, { parent: g, pos: [0, fh * f + fh / 2, zc] });
    const fz = zc + fd / 2 + 0.04;
    // horizontal beams
    mesh(box(w + 0.02, 0.24, 0.16), beamM, { parent: g, pos: [0, fh * f + 0.12, fz] });
    mesh(box(w + 0.02, 0.26, 0.18), beamM, { parent: g, pos: [0, fh * (f + 1) - 0.13, fz] });
    // posts
    const nPost = Math.max(2, Math.round(w / 1.9));
    const xs = []; for (let i = 0; i <= nPost; i++) xs.push(-w / 2 + 0.11 + (w - 0.22) * i / nPost);
    for (const x of xs) mesh(box(0.2, fh, 0.14), beamM, { parent: g, pos: [x, fh * f + fh / 2, fz] });
    // side corner posts
    for (const s of [-1, 1]) mesh(box(0.14, fh, 0.2), beamM, { parent: g, pos: [s * (w / 2 + 0.03), fh * f + fh / 2, zc + fd / 2 - 0.1] });
    // panels: window or brace
    for (let i = 0; i < nPost; i++) {
      const x0 = xs[i], x1 = xs[i + 1], cx = (x0 + x1) / 2, pw = x1 - x0;
      const isDoor = f === 0 && o.doorPanel === i;
      if (isDoor) {
        const dm = mat(o.doorColor || ['#c4452f', '#3f6e9c', '#5e8a3a', '#8a5a35'][Math.floor(R() * 4)], { rough: 0.45 });
        mesh(rbox(Math.min(1.25, pw - 0.35), 2.3, 0.14, 0.05), dm, { parent: g, pos: [cx, 1.15 + 0.12, fz] });
        mesh(sphere(0.07), mat('#d9b44a', { metal: 0.6, rough: 0.3 }), { parent: g, pos: [cx + 0.4, 1.3, fz + 0.1] });
        mesh(box(Math.min(1.25, pw - 0.35) + 0.25, 0.18, 0.18), beamM, { parent: g, pos: [cx, 2.5, fz] });
        continue;
      }
      const winY = fh * f + (f === 0 ? 1.75 : 1.75);
      const wantWin = (f > 0 || R() < 0.8) && pw > 1.2;
      if (wantWin) {
        const ww = Math.min(1.15, pw - 0.45), wh = 1.25;
        const win = grp(g, cx, winY, fz);
        const special = o.special && o.special.floor === f && o.special.panel === i;
        let fw = ww, fhh = wh, fy = 0;
        if (!special) {
          mesh(box(ww, wh, 0.06), mat('#7fa9c9', { rough: 0.12, metal: 0.1 }), { parent: win, pos: [0, 0, -0.02], cast: false });
          mesh(box(0.07, wh, 0.1), beamM, { parent: win });
          mesh(box(ww, 0.07, 0.1), beamM, { parent: win });
        } else {
          fw = ww + 0.25; fhh = wh + 0.8; fy = -0.12;
          mesh(box(fw, fhh, 0.05), mat('#2c2018', { rough: 1 }), { parent: win, pos: [0, fy, -0.03], cast: false });
          info.special = { win, ww: fw, wh: fhh, oy: fy, x: cx, y: winY + fy, z: fz };
        }
        for (const [px, py, sw, sh] of [[0, fy + fhh / 2 + 0.06, fw + 0.2, 0.12], [0, fy - fhh / 2 - 0.06, fw + 0.3, 0.14], [-fw / 2 - 0.06, fy, 0.12, fhh], [fw / 2 + 0.06, fy, 0.12, fhh]])
          mesh(box(sw, sh, 0.16), beamM, { parent: win, pos: [px, py, 0.02] });
        info.windows.push({ x: cx, y: winY, z: fz, ww, wh, floor: f });
      } else {
        // diagonal brace
        const len = Math.hypot(pw, fh - 0.4), a = Math.atan2(fh - 0.4, pw) * (R() < 0.5 ? 1 : -1);
        mesh(box(len, 0.16, 0.12), beamM, { parent: g, pos: [cx, fh * f + fh / 2, fz - 0.01], rot: [0, 0, a] });
      }
    }
  }
  // roof
  const top = fh * floors, rise = o.rise ?? 2.6, run = d / 2 + jet / 2 + 0.55;
  const slab = Math.hypot(run, rise) + 0.25, ang = Math.atan2(rise, run);
  const rt = roofDark ? T.roofDark : T.roof;
  const rm = mat('#ffffff', { map: texRep(rt.map, w / 3, slab / 2.2), bump: texRep(rt.bump, w / 3, slab / 2.2), bumpScale: 3, rough: 0.7, unique: true });
  for (const s of [-1, 1]) mesh(rbox(w + 0.7, 0.2, slab, 0.06), rm, { parent: g, pos: [0, top + rise / 2 + 0.05, jet / 2 + s * run / 2], rot: [s * ang, 0, 0] });
  mesh(cyl(0.16, 0.16, w + 0.7, 12), mat('#6b3f2a'), { parent: g, pos: [0, top + rise + 0.08, jet / 2], rot: [0, 0, Math.PI / 2] });
  const sh = new THREE.Shape(); sh.moveTo(-run + 0.5, 0); sh.lineTo(run - 0.5, 0); sh.lineTo(0, rise - 0.15); sh.closePath();
  const gab = new THREE.ExtrudeGeometry(sh, { depth: w - 0.04, bevelEnabled: false });
  mesh(gab, wallM, { parent: g, pos: [-w / 2 + 0.02, top, jet / 2], rot: [0, Math.PI / 2, 0] });
  if (R() < 0.75) {
    const cx = (R() - 0.5) * (w - 2.5);
    mesh(rbox(0.75, 2.4, 0.75, 0.06), mat('#a15c45', { rough: 0.8 }), { parent: g, pos: [cx, top + rise * 0.6, -0.6] });
    mesh(rbox(0.95, 0.2, 0.95, 0.05), mat('#6f4032'), { parent: g, pos: [cx, top + rise * 0.6 + 1.2, -0.6] });
  }
  g.userData.info = info;
  return g;
}

function flowerBox(parent, x, y, z, w, seed) {
  const R = rng(seed);
  const fb = grp(parent, x, y, z);
  mesh(rbox(w, 0.28, 0.4, 0.05), mat('#7a4a2a'), { parent: fb });
  const cols = ['#ff5a6e', '#ffd23f', '#ff8ad1', '#ffffff', '#ff7b2e'];
  for (let i = 0; i < Math.round(w * 5); i++) {
    const fx = -w / 2 + 0.12 + (w - 0.24) * (i + R() * 0.5) / Math.round(w * 5);
    mesh(sphere(0.09 + R() * 0.04, 8, 6), mat(cols[Math.floor(R() * cols.length)], { rough: 0.5 }), { parent: fb, pos: [fx, 0.2 + R() * 0.1, (R() - 0.5) * 0.2] });
    mesh(sphere(0.1, 8, 5), mat('#4f9a2f'), { parent: fb, pos: [fx + 0.05, 0.14, (R() - 0.5) * 0.25], scale: [1, 0.6, 1] });
  }
  return fb;
}

// ---------------- TOWN ----------------
export const STREET = { x0: -5.2, x1: 5.2, z0: -50, z1: 40, ditchW: 0.95, ditchDepth: 1.0 };
export function buildTown(scene) {
  const town = grp(scene); town.name = 'town';
  const S = STREET;
  // grass ground (two pieces leave a gap for the river)
  const gm = mat('#ffffff', { map: texRep(T.grass, 60, 60), rough: 0.95 });
  const gpl = (x0, x1, z0, z1) => mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat('#ffffff', { map: texRep(T.grass, (x1 - x0) / 11, (z1 - z0) / 11), rough: 0.95, unique: true }),
    { parent: scene, pos: [(x0 + x1) / 2, -0.03, (z0 + z1) / 2], rot: [-Math.PI / 2, 0, 0], cast: false });
  gpl(-350, S.x0, -80, 300); gpl(S.x1, 350, -80, 300); gpl(S.x0, S.x1, S.z1, 300); gpl(S.x0, S.x1, -80, S.z0); gpl(-350, 350, -600, -96);
  // cobbled street strips (top = cobbles, sides = soil)
  const len = S.z1 - S.z0, zc = (S.z0 + S.z1) / 2, sw = S.x1 - S.ditchW;
  const top = mat('#ffffff', { map: texRep(T.cobble.map, sw / 2.6, len / 2.6), bump: texRep(T.cobble.bump, sw / 2.6, len / 2.6), bumpScale: 4, rough: 0.8, unique: true });
  const side = mat('#ffffff', { map: texRep(T.soil, 0.5, 0.5), rough: 0.95 });
  const mats = [side, side, top, side, side, side];
  for (const s of [-1, 1]) mesh(box(sw, S.ditchDepth + 0.4, len), mats, { parent: town, pos: [s * (S.ditchW + sw / 2), -(S.ditchDepth + 0.4) / 2, zc] });
  mesh(box(S.ditchW * 2, 0.3, len), side, { parent: town, pos: [0, -S.ditchDepth - 0.15, zc] });
  // center cover (removed when the ditch is dug)
  const segLen = 3, nSeg = Math.round(len / segLen);
  const ctop = mat('#ffffff', { map: texRep(T.cobble.map, (S.ditchW * 2) / 2.6, segLen / 2.6), bump: texRep(T.cobble.bump, (S.ditchW * 2) / 2.6, segLen / 2.6), bumpScale: 4, rough: 0.8, unique: true });
  const cover = [];
  for (let i = 0; i < nSeg; i++) {
    const z = S.z1 - segLen / 2 - i * segLen;
    cover.push(mesh(box(S.ditchW * 2, 0.3, segLen + 0.01), [side, side, ctop, side, side, side], { parent: town, pos: [0, -0.15, z] }));
  }
  // liquid plane (ditch water -> flood)
  const liquidMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.ripple, 3, 40), roughness: 0.18, metalness: 0.05 });
  const liquid = mesh(new THREE.PlaneGeometry(S.x1 - S.x0, len), liquidMat, { parent: town, pos: [0, -0.6, zc], rot: [-Math.PI / 2, 0, 0], cast: false });
  // slabs for the covered drain
  const slabM = mat('#a9a49a', { rough: 0.75 });
  const slabs = [];
  for (let i = 0; i < nSeg; i++) {
    const z = S.z1 - segLen / 2 - i * segLen;
    const s = mesh(rbox(S.ditchW * 2 + 0.5, 0.22, segLen - 0.08, 0.06), slabM, { parent: town, pos: [0, 0.11, z] });
    s.userData.z = z; s.visible = false; slabs.push(s);
  }
  // houses on both sides
  const houses = [];
  let hi = 0;
  const addHouse = (side, zc2, w, R, hero = false) => {
    const floors = hero ? 2 : (R() < 0.25 ? 3 : 2);
    const h = makeHouse({ w, d: 6, floors, seed: 500 + hi, wallIdx: hero ? 0 : Math.floor(R() * 6), roofDark: R() < 0.4,
      doorPanel: hero ? 0 : Math.floor(R() * 3), special: hero ? { floor: 1, panel: 1 } : null, doorColor: hero ? '#c4452f' : null });
    h.position.set(side * (S.x1 + 3), 0, zc2); h.rotation.y = -side * Math.PI / 2;
    town.add(h); houses.push({ g: h, side, z: zc2, w, hero }); hi++;
    if (!hero) bake(h);
    if (hero) town.userData.hero = h;
  };
  const run = (side, zStart, zEnd, R) => {
    let z = zStart;
    while (z - zEnd > 0.5) { let w = 6 + Math.round(R() * 2); if (z - w - zEnd < 4) w = z - zEnd; addHouse(side, z - w / 2, w, R); z -= w; }
  };
  const RL = rng(101), RR = rng(202);
  run(-1, S.z1 + 2, 3.6, RL); addHouse(-1, 0, 7.2, RL, true); run(-1, -3.6, S.z0 + 4, RL);
  run(1, S.z1 + 2, S.z0 + 4, RR);
  // town hall closing the street end
  const hall = makeHouse({ w: 16, d: 8, floors: 3, seed: 999, wallIdx: 4, doorPanel: 4, doorColor: '#7a3b25', rise: 3.2 });
  hall.position.set(0, 0, S.z0 - 4); town.add(hall); bake(hall);
  // festive dressing for the clean-town ending
  const festive = grp(town); festive.visible = false;
  for (const hh of houses) {
    for (const wdw of hh.g.userData.info.windows) {
      if (wdw.floor !== 1 || hh.hero && Math.abs(wdw.x) < 0.5) continue;
      const fb = flowerBox(null, wdw.x, wdw.y - 0.85, wdw.z + 0.25, wdw.ww + 0.3, Math.round(hh.z * 13 + wdw.x * 7));
      const holder = grp(festive); holder.position.copy(hh.g.position); holder.rotation.copy(hh.g.rotation); holder.add(fb);
    }
  }
  const flagCols = ['#ff5a5a', '#ffd23f', '#3fa7ff', '#5fd35f', '#ff8ad1', '#ffffff'];
  for (const z of [-30, -18, -6, 7, 19]) {
    const pts = []; for (let i = 0; i <= 20; i++) { const x = -5.0 + 10 * i / 20; pts.push(new THREE.Vector3(x, 6.4 - Math.sin(Math.PI * i / 20) * 0.9, z)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(new THREE.TubeGeometry(curve, 40, 0.025, 6), mat('#5a4030'), { parent: festive, cast: false });
    for (let i = 1; i < 20; i++) {
      const p = curve.getPoint(i / 20);
      const f = mesh(cone(0.28, 0.6, 3), mat(flagCols[(i + Math.round(z)) % 6], { rough: 0.6 }), { parent: festive, pos: [p.x, p.y - 0.3, p.z], rot: [Math.PI, 0, 0], scale: [1, 1, 0.12] });
    }
  }
  bake(festive);
  // creator banner on the hero house (upper jetty, facing the street)
  const hero = town.userData.hero; const hinfo = hero.userData.info;
  const bn = grp(null, 0, 3.78, hinfo.d / 2 + hinfo.jet + 0.12);
  mesh(rbox(3.25, 0.98, 0.06, 0.03), mat('#6b4423'), { parent: bn, pos: [0, 0, -0.02] });
  mesh(new THREE.PlaneGeometry(3.1, 0.86), new THREE.MeshStandardMaterial({ map: T.banner, roughness: 0.8 }), { parent: bn, pos: [0, 0, 0.02], cast: false });
  for (const s of [-1, 1]) mesh(sphere(0.06), mat('#d9b44a', { metal: 0.6 }), { parent: bn, pos: [1.5 * s, 0.38, 0.05] });
  hero.add(bn); town.userData.bannerG = bn;
  // trees & hills around
  const R = rng(77); const trees = grp(scene);
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1; const x = side * (17 + R() * 26), z = S.z1 + 30 - R() * 140;
    const t = makeTree(i, 1.5 + R() * 0.9); t.position.set(x, 0, z); t.rotation.y = R() * 6; trees.add(t);
  }
  bake(trees);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 230 + R() * 60;
    mesh(sphere(60 + R() * 30, 24, 12), mat(['#62ad3e', '#57a038', '#6bb646'][i % 3], { rough: 1 }), { parent: scene, pos: [Math.cos(a) * r, -38, Math.sin(a) * r], scale: [1.6, 0.6, 1.2], cast: false, receive: false });
  }
  Object.assign(town.userData, { cover, liquid, liquidMat, slabs, festive, houses, hall, segLen });
  return town;
}

// ---------------- UNDERGROUND CUTAWAY (local coords, camera looks -z) ----------------
export function buildCutaway(scene, at) {
  const cw = grp(scene, ...at); cw.name = 'cutaway';
  const soilT = texRep(T.soil, 0.14, 0.14);
  const soilM = mat('#ffffff', { map: soilT, rough: 0.95, unique: true });
  const darkSoilM = mat('#7d5d45', { map: soilT, rough: 1, unique: true });
  const GX0 = -34, GX1 = 23, GY0 = -4.6, GY1 = -0.3, TC = new THREE.Vector2(27, -7.6), TR = 4.9;
  const shp = new THREE.Shape(); shp.moveTo(-60, -18); shp.lineTo(60, -18); shp.lineTo(60, 0); shp.lineTo(-60, 0); shp.closePath();
  const hole = new THREE.Path(); hole.moveTo(GX0, GY0); hole.lineTo(GX0, GY1); hole.lineTo(GX1, GY1); hole.lineTo(GX1, GY0); hole.closePath();
  const th = new THREE.Path(); th.absarc(TC.x, TC.y, TR, 0, Math.PI * 2, true);
  shp.holes.push(hole, th);
  const sg = new THREE.ExtrudeGeometry(shp, { depth: 14, bevelEnabled: false, curveSegments: 48 });
  mesh(sg, soilM, { parent: cw, pos: [0, 0, -14] });
  // ground top surface + grass beyond
  mesh(box(120, 0.12, 14), mat('#ffffff', { map: texRep(T.cobble.map, 40, 5), rough: 0.85, unique: true }), { parent: cw, pos: [0, 0.0, -7] });
  mesh(new THREE.PlaneGeometry(400, 300), mat('#ffffff', { map: texRep(T.grass, 40, 30), rough: 1 }), { parent: cw, pos: [0, 0.0, -164], rot: [-Math.PI / 2, 0, 0], cast: false });
  // gallery back wall & crust edge
  mesh(box(GX1 - GX0, GY1 - GY0, 0.2), darkSoilM, { parent: cw, pos: [(GX0 + GX1) / 2, (GY0 + GY1) / 2, -1.7] });
  mesh(box(120, 0.3, 0.3), mat('#8d8578'), { parent: cw, pos: [0, -0.15, 0.0] });
  // undug fill blocks
  const fill = [];
  for (let x = GX0; x < GX1 - 0.01; x += 2.5) {
    const w = Math.min(2.5, GX1 - x);
    fill.push(mesh(box(w + 0.02, GY1 - GY0, 1.7), soilM, { parent: cw, pos: [x + w / 2, (GY0 + GY1) / 2, -0.85] }));
    fill[fill.length - 1].userData.x = x + w / 2;
  }
  // main clay pipe segments
  const clay = mat('#d9733f', { rough: 0.5, side: THREE.DoubleSide }), clayIn = mat('#8a4a2a', { rough: 1, side: THREE.DoubleSide });
  const halfPipe = (r, h) => new THREE.CylinderGeometry(r, r, h, 28, 1, true, 1.745, 4.19);   // open toward the camera (cutaway)
  const vPipe = (r, h) => new THREE.CylinderGeometry(r, r, h, 24, 1, true, 0.87, 4.54);
  const pipes = [];
  const PY = -3.85, PZ = -0.8, PR = 0.72;
  for (let x = GX0; x < 25.4; x += 2.4) {
    const pg = grp(cw, x + 1.2, PY, PZ);
    const inner = grp(pg); inner.rotation.z = Math.PI / 2;
    mesh(halfPipe(PR, 2.36), clay, { parent: inner });
    mesh(halfPipe(PR - 0.09, 2.36), clayIn, { parent: inner, cast: false });
    mesh(halfPipe(PR + 0.1, 0.35), clay, { parent: inner, pos: [0, 1.0, 0] });
    mesh(halfPipe(PR - 0.01, 0.36), clayIn, { parent: inner, pos: [0, 1.0, 0], cast: false });
    pg.userData.x = x + 1.2; pipes.push(pg);
  }
  const flowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.ripple, 30, 1), roughness: 0.2 });
  const flow = mesh(new THREE.PlaneGeometry(GX1 - GX0 + 2.5, 1.0), flowMat, { parent: cw, pos: [(GX0 + GX1) / 2 + 1.2, PY - 0.12, PZ - 0.05], rot: [-Math.PI / 2, 0, 0], cast: false });
  // dollhouse homes on top with toilets
  const homes = [];
  const wallCols = ['#f3e4c6', '#f2d6c9', '#e9ece2', '#f6e8bb', '#f0dcb8', '#f7f0e2'];
  const paper = ['#cfe3f5', '#f7d9e3', '#e3f2d0', '#fbefc8', '#e8dcf5', '#d9f0ef'];
  for (let i = 0; i < 7; i++) {
    const hx = -27 + i * 7.6, hg = grp(cw, hx, 0.06, -4.2);
    const wm = mat(wallCols[i % 6], { rough: 0.85 }), pm = mat(paper[i % 6], { rough: 0.9 }), bm = mat(BEAM, { rough: 0.6 });
    mesh(box(7.2, 6.4, 0.3), pm, { parent: hg, pos: [0, 3.2, -3.1] });
    for (const s of [-1, 1]) mesh(box(0.3, 6.4, 6.4), wm, { parent: hg, pos: [s * 3.6, 3.2, 0] });
    mesh(box(7.2, 0.25, 6.4), mat('#a7774e', { map: texRep(T.planks, 3, 3), rough: 0.7, unique: true }), { parent: hg, pos: [0, 0.0, 0] });
    mesh(box(7.2, 0.3, 6.4), wm, { parent: hg, pos: [0, 3.25, 0] });
    for (const s of [-1, 1]) mesh(box(0.25, 6.6, 0.25), bm, { parent: hg, pos: [s * 3.62, 3.25, 3.15] });
    mesh(box(7.5, 0.26, 0.26), bm, { parent: hg, pos: [0, 3.25, 3.15] });
    mesh(box(7.5, 0.26, 0.26), bm, { parent: hg, pos: [0, 6.45, 3.15] });
    const rise = 2.6, run = 3.8, slab = Math.hypot(run, rise) + 0.2, ang = Math.atan2(rise, run);
    const rm = mat('#ffffff', { map: texRep(T.roof.map, 2.5, 2), rough: 0.7, unique: true });
    for (const s of [-1, 1]) mesh(rbox(7.8, 0.22, slab, 0.06), rm, { parent: hg, pos: [0, 6.4 + rise / 2, s * run / 2], rot: [s * ang, 0, 0] });
    const sh = new THREE.Shape(); sh.moveTo(-3.2, 0); sh.lineTo(3.2, 0); sh.lineTo(0, 2.3); sh.closePath();
    mesh(new THREE.ExtrudeGeometry(sh, { depth: 7.1, bevelEnabled: false }), wm, { parent: hg, pos: [-3.55, 6.4, 0], rot: [0, Math.PI / 2, 0] });
    // picture frame & window on back wall
    mesh(box(1.4, 1.2, 0.08), mat('#7fa9c9', { rough: 0.15 }), { parent: hg, pos: [-1.6, 4.8, -2.92] });
    mesh(box(0.9, 0.7, 0.08), mat('#d9b44a'), { parent: hg, pos: [-1.4, 1.9, -2.92] });
    mesh(box(0.75, 0.55, 0.1), mat(['#ff9a9a', '#9ad1ff', '#b6f09a'][i % 3]), { parent: hg, pos: [-1.4, 1.9, -2.88] });
    bake(hg);
    const toilet = makeToilet(); toilet.position.set(1.3, 0.12, 2.1); hg.add(toilet);
    // connection pipe: toilet -> main pipe (grows down)
    const conn = grp(cw, hx + 1.3, 0.1, PZ);
    const cin = grp(conn); mesh(vPipe(0.3, 1), clay, { parent: cin, pos: [0, -0.5, 0] }); mesh(vPipe(0.24, 1), clayIn, { parent: cin, pos: [0, -0.5, 0], cast: false });
    conn.userData.len = 0.1 - PY; conn.scale.y = 0.001;
    homes.push({ hg, toilet, conn, x: hx });
  }
  // brick sewer tunnel (cross-section)
  const brickM = mat('#ffffff', { map: texRep(T.brick.map, 8, 3), bump: texRep(T.brick.bump, 8, 3), bumpScale: 3, rough: 0.8, unique: true, side: THREE.BackSide });
  const tun = grp(cw, TC.x, TC.y, 0);
  mesh(new THREE.CylinderGeometry(TR - 0.7, TR - 0.7, 14, 48, 1, true), brickM, { parent: tun, pos: [0, 0, -7], rot: [Math.PI / 2, 0, 0], cast: false });
  mesh(new THREE.RingGeometry(TR - 0.7, TR + 0.02, 64), mat('#ffffff', { map: texRep(T.brick.map, 6, 1), rough: 0.8, unique: true }), { parent: tun, pos: [0, 0, 0.01], cast: false });
  mesh(new THREE.CircleGeometry(TR, 32), mat('#140d08', { rough: 1 }), { parent: tun, pos: [0, 0, -13.9], cast: false });
  const tunLiquid = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.ripple, 2, 6), roughness: 0.2 });
  mesh(new THREE.PlaneGeometry(6.4, 14), tunLiquid, { parent: tun, pos: [0, -2.9, -7], rot: [-Math.PI / 2, 0, 0], cast: false });
  for (const s of [-1, 1]) mesh(box(1.2, 0.3, 14), mat('#8d8578'), { parent: tun, pos: [s * 3.0, -2.45, -7] });
  const tlight = new THREE.PointLight('#ffb84d', 25, 14, 1.6); tlight.position.set(-2.6, -0.6, -3); tun.add(tlight);
  const tw = makePerson({ shirt: '#6d7f8f', pants: '#3b3f48', hat: 'cap', hatColor: '#3a3a3a' }); tw.scale.setScalar(0.55); tw.position.set(-3.0, -2.3, -4); tun.add(tw);
  // main-pipe "flow" blobs
  const blobs = [];
  for (let i = 0; i < 10; i++) { const b = makePoop(false, 0.6); b.visible = false; cw.add(b); blobs.push(b); }
  // workers
  const workers = [];
  for (let i = 0; i < 2; i++) {
    const w = makePerson({ shirt: i ? '#e3843a' : '#d9c34a', pants: '#5b4a3a', hat: 'cap', hatColor: i ? '#8a5a35' : '#c4452f', apron: '#a0703f' });
    const sh = makeShovel(); w.userData.shovel = sh; w.add(sh); cw.add(w); workers.push(w);
  }
  Object.assign(cw.userData, { flow, flowMat, fill, pipes, homes, blobs, workers, PY, PZ, TC, TR, tunWorker: tw, tunLiquid, GX0, GX1 });
  return cw;
}

// ---------------- SEWER TUNNEL INTERIOR (local; tunnel along z) ----------------
export function buildTunnel(scene, at) {
  const tg = grp(scene, ...at); tg.name = 'tunnel';
  const L = 90, R = 4.6, CY = 4.1;
  const bm = mat('#ffffff', { map: texRep(T.brick.map, 10, 24), bump: texRep(T.brick.bump, 10, 24), bumpScale: 4, rough: 0.85, unique: true, side: THREE.BackSide });
  mesh(new THREE.CylinderGeometry(R, R, L, 56, 1, true), bm, { parent: tg, pos: [0, CY, -L / 2 + 10], rot: [Math.PI / 2, 0, 0], cast: false });
  for (let z = 8; z > -L + 10; z -= 7) mesh(torus(R - 0.05, 0.22, Math.PI * 2, 10, 48), mat('#8f5a40', { rough: 0.8 }), { parent: tg, pos: [0, CY, z], cast: false });
  for (const s of [-1, 1]) {
    mesh(box(2.2, 0.5, L), mat('#9a948a', { rough: 0.85 }), { parent: tg, pos: [s * 2.55, 0.75, -L / 2 + 10] });
  }
  const liq = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.ripple, 2, 30), roughness: 0.15 });
  mesh(new THREE.PlaneGeometry(3.2, L), liq, { parent: tg, pos: [0, 0.35, -L / 2 + 10], rot: [-Math.PI / 2, 0, 0], cast: false });
  // grate light shafts
  const shaftM = new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const z of [-14, -34, -54]) {
    mesh(cyl(0.6, 1.8, 7.5, 20, true), shaftM, { parent: tg, pos: [0, 4.6, z], cast: false, receive: false });
    const sp = new THREE.SpotLight('#fff1cc', 30, 14, 0.45, 0.6, 1.5); sp.position.set(0, 8.4, z); sp.target.position.set(0, 0, z); tg.add(sp, sp.target);
    mesh(rbox(1.3, 0.1, 1.3, 0.03), mat('#3a3a3a', { emissive: '#fff1cc', ei: 0.4 }), { parent: tg, pos: [0, 8.65, z], cast: false });
  }
  const worker = makePerson({ shirt: '#6d7f8f', pants: '#3b3f48', hat: 'cap', hatColor: '#3a3a3a', shoes: '#2d2d2d' });
  tg.add(worker);
  // clothespin on nose
  const pin = grp(worker.userData.head, 0, -0.05, 0.62);
  for (const s of [-1, 1]) mesh(rbox(0.07, 0.07, 0.34, 0.02), mat('#e0b878'), { parent: pin, pos: [0.05 * s, 0, 0.1] });
  mesh(torus(0.05, 0.015, Math.PI * 2, 6, 12), mat('#9aa3ad', { metal: 0.6 }), { parent: pin, pos: [0, 0, 0.12], rot: [0, Math.PI / 2, 0] });
  const lg = grp(null);
  const lan = makeLanternLocal(); lg.add(lan);
  const plight = new THREE.PointLight('#ffb547', 10, 18, 1.5); lg.add(plight);
  tg.add(lg);
  Object.assign(tg.userData, { worker, lanternG: lg, liq, L, CY });
  return tg;
}
function makeLanternLocal() {
  const g = new THREE.Group();
  mesh(rbox(0.3, 0.38, 0.3, 0.05), mat('#ffd36a', { emissive: '#ffb733', ei: 3 }), { parent: g, cast: false });
  mesh(rbox(0.36, 0.07, 0.36, 0.02), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, 0.22, 0] });
  mesh(rbox(0.36, 0.06, 0.36, 0.02), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, -0.21, 0] });
  mesh(torus(0.12, 0.018, Math.PI, 6, 14), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, 0.26, 0] });
  return g;
}

// ---------------- RIVER + TREATMENT PLANT ----------------
export const RIVER = { z0: -96, z1: -80, y: -0.55 };
export function buildRiver(scene) {
  const rv = grp(scene); rv.name = 'river';
  const { z0, z1 } = RIVER, zc = (z0 + z1) / 2, wid = z1 - z0;
  mesh(box(700, 0.4, wid), mat('#b59a6a', { rough: 1 }), { parent: rv, pos: [0, -1.9, zc] });
  for (const s of [-1, 1]) {
    mesh(box(700, 2.0, 1.2), mat('#ffffff', { map: texRep(T.soil, 60, 0.3), rough: 1 }), { parent: rv, pos: [0, -1.0, (s < 0 ? z0 : z1) - s * 0.0] });
    mesh(rbox(700, 0.35, 1.0, 0.1), mat('#9a948a', { rough: 0.9 }), { parent: rv, pos: [0, 0.0, (s < 0 ? z0 - 0.3 : z1 + 0.3)] });
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.water, 60, 3), roughness: 0.6, metalness: 0.0, envMapIntensity: 0.0 });
  const water = mesh(new THREE.PlaneGeometry(700, wid - 0.2), waterMat, { parent: rv, pos: [0, RIVER.y, zc], rot: [-Math.PI / 2, 0, 0], cast: false });
  // brown plume spreading from the outfall
  const plumeC = document.createElement('canvas'); plumeC.width = plumeC.height = 256; const pc = plumeC.getContext('2d');
  const gr = pc.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(120,80,35,1)'); gr.addColorStop(0.6, 'rgba(120,80,35,0.85)'); gr.addColorStop(1, 'rgba(120,80,35,0)');
  pc.fillStyle = gr; pc.fillRect(0, 0, 256, 256);
  const plumeT = new THREE.CanvasTexture(plumeC); plumeT.colorSpace = THREE.SRGBColorSpace;
  const plume = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ map: plumeT, transparent: true, depthWrite: false, roughness: 0.2 }), { parent: rv, pos: [-10, RIVER.y + 0.02, z1 - 0.5], rot: [-Math.PI / 2, 0, 0], cast: false });
  plume.scale.set(0.01, 0.01, 1);
  // sewer outfall headwall
  const brickM = mat('#ffffff', { map: texRep(T.brick.map, 2, 1.2), bump: texRep(T.brick.bump, 2, 1.2), bumpScale: 3, rough: 0.8, unique: true });
  const out = grp(rv, -10, 0, z1 + 0.6);
  mesh(rbox(5.6, 3.6, 1.4, 0.1), brickM, { parent: out, pos: [0, -0.4, 0] });
  mesh(cyl(1.05, 1.05, 1.6, 32, true), mat('#6b4a3a', { side: THREE.DoubleSide }), { parent: out, pos: [0, -0.4, -0.5], rot: [Math.PI / 2, 0, 0] });
  mesh(new THREE.CircleGeometry(1.0, 32), mat('#120c08'), { parent: out, pos: [0, -0.4, -0.3], rot: [Math.PI, 0, 0], cast: false });
  mesh(torus(1.1, 0.16, Math.PI * 2, 10, 32), mat('#8f5a40'), { parent: out, pos: [0, -0.4, -1.3] });
  // falling stream (brown -> clean later from plant outlet)
  const streamMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.ripple, 1, 4), roughness: 0.2 });
  const sCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.4, -1.3), new THREE.Vector3(0, -0.3, -2.6), new THREE.Vector3(0, -1.0, -3.4));
  const stream = mesh(new THREE.TubeGeometry(sCurve, 20, 0.62, 16), streamMat, { parent: out, cast: false, scale: [1, 1, 1] });
  // plant (north bank, beside the town hall)
  const plant = grp(rv); plant.name = 'plant';
  const concrete = mat('#cfcbc2', { rough: 0.8 });
  const parts = [];
  const tanks = [];
  for (const [x, z] of [[4, -66], [15, -66]]) {
    const tg = grp(plant, x, 0, z);
    mesh(cyl(3.3, 3.3, 1.8, 48, true), mat('#cfcbc2', { rough: 0.8, side: THREE.DoubleSide }), { parent: tg, pos: [0, 0.9, 0] });
    mesh(torus(3.3, 0.14, Math.PI * 2, 8, 48), concrete, { parent: tg, pos: [0, 1.8, 0], rot: [Math.PI / 2, 0, 0] });
    const wmat = new THREE.MeshStandardMaterial({ color: '#7a5a30', roughness: 0.15 });
    mesh(new THREE.CircleGeometry(3.2, 48), wmat, { parent: tg, pos: [0, 1.45, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
    mesh(cyl(0.4, 0.4, 1.4, 16), concrete, { parent: tg, pos: [0, 1.7, 0] });
    const arm = grp(tg, 0, 2.15, 0);
    mesh(rbox(6.6, 0.25, 0.7, 0.06), mat('#3f8fd6', { rough: 0.4 }), { parent: arm });
    for (const s of [-1, 1]) mesh(box(0.08, 0.5, 0.7), mat('#ffd23f'), { parent: arm, pos: [s * 3.0, 0.35, 0] });
    mesh(box(6.6, 0.06, 0.06), mat('#ffd23f'), { parent: arm, pos: [0, 0.6, 0.33] });
    mesh(box(6.6, 0.06, 0.06), mat('#ffd23f'), { parent: arm, pos: [0, 0.6, -0.33] });
    tanks.push({ g: tg, wmat, arm }); parts.push(tg);
  }
  const aer = grp(plant, 9.5, 0, -74.5);
  for (const [w, d, x, z] of [[14, 0.4, 0, 2.8], [14, 0.4, 0, -2.8], [0.4, 6, 7, 0], [0.4, 6, -7, 0], [0.3, 6, 0, 0]])
    mesh(box(w, 1.8, d), concrete, { parent: aer, pos: [x, 0.9, z] });
  const aerW = new THREE.MeshStandardMaterial({ color: '#7a5a30', roughness: 0.15 });
  mesh(new THREE.PlaneGeometry(13.8, 5.4), aerW, { parent: aer, pos: [0, 1.45, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
  parts.push(aer);
  // little control house
  const ch = grp(plant, 21.5, 0, -73);
  mesh(rbox(3.6, 3, 3.2, 0.1), mat('#f3e4c6', { rough: 0.85 }), { parent: ch, pos: [0, 1.5, 0] });
  mesh(cone(3.0, 1.8, 4), mat('#3f8fd6'), { parent: ch, pos: [0, 3.9, 0], rot: [0, Math.PI / 4, 0] });
  mesh(rbox(1.0, 1.9, 0.1, 0.03), mat('#3f6e9c'), { parent: ch, pos: [0, 0.95, 1.62] });
  parts.push(ch);
  // pipes linking
  const pipeM = mat('#9aa3ad', { metal: 0.4, rough: 0.4 });
  const link1 = grp(plant, 9.5, 1.2, -66); mesh(cyl(0.35, 0.35, 6.8, 16), pipeM, { parent: link1, rot: [0, 0, Math.PI / 2] }); parts.push(link1);
  const link2 = grp(plant, 15, 1.0, -70.5); mesh(cyl(0.35, 0.35, 5.2, 16), pipeM, { parent: link2, rot: [Math.PI / 2, 0, 0] }); parts.push(link2);
  // clean outlet into river
  const cout = grp(plant, 11, 0, z1 + 0.6);
  mesh(rbox(3.6, 2.6, 1.2, 0.1), concrete, { parent: cout, pos: [0, -0.4, 0] });
  mesh(cyl(0.7, 0.7, 1.3, 28, true), pipeM, { parent: cout, pos: [0, -0.2, -0.5], rot: [Math.PI / 2, 0, 0] });
  mesh(new THREE.CircleGeometry(0.65, 28), mat('#0d1a24'), { parent: cout, pos: [0, -0.2, -0.3], rot: [Math.PI, 0, 0], cast: false });
  parts.push(cout);
  const cleanMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texRep(T.water, 1, 4), roughness: 0.1, transparent: true, opacity: 0.92 });
  const cCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.2, -1.15), new THREE.Vector3(0, -0.1, -2.2), new THREE.Vector3(0, -0.9, -3.0));
  const cleanStream = mesh(new THREE.TubeGeometry(cCurve, 20, 0.42, 16), cleanMat, { parent: cout, cast: false });
  const fish = [];
  const cols = ['#ff9a3c', '#4fb3ff', '#ffd23f', '#ff7aa8', '#7be07b'];
  for (let i = 0; i < 5; i++) { const f = makeFish(cols[i]); rv.add(f); fish.push(f); }
  Object.assign(rv.userData, { water, waterMat, plume, stream, streamMat, plant, parts, tanks, aerW, aer, cleanStream, cleanMat, fish, out, cout });
  return rv;
}
