// The city street at blue hour, just after rain (static part): wet sidewalks + road, a row of old buildings with
// lit shops facing -Z (boutique, cafe, pizza, mini mart), the row across the road (z -14.2, facing +Z), roofs for
// the aerial shot, lamp posts, parked cars. NO TEXT: shop boards are pixel pictograms.
import * as THREE from 'three';
import { mat, tex, rng } from './lib.js';
import { STREET } from './layout.js';
import { bakeGroup } from './set_util.js';
import { brickCanvas, plasterCanvas, awningCanvas, shutterCanvas, goldCanvas } from './set_tex2.js';
import { wetSlabCanvas, wetRoughCanvas, wetAsphaltCanvas, curbCanvas, roofCanvas, manholeCanvas, facadeNight, shopWindowCanvas, iconBoardCanvas, dataTex, blobCanvas } from './set_street_tex.js';
import { lampPostGeometry, LAMP } from './set_street_props.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; m.name = `set.city.${n}`; return m; }
function boxAt(g, w, h, d, material, x, y, z, n, o = {}) { const m = msh(new THREE.BoxGeometry(w, h, d), material, n, o); m.position.set(x, y, z); g.add(m); return m; }
function quad(g, w, h, material, x, y, z, n, ry = Math.PI, o = { cast: false }) { const m = msh(new THREE.PlaneGeometry(w, h), material, n, o); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; }
function flat(g, w, d, material, x, y, z, n, rz = 0) { const m = msh(new THREE.PlaneGeometry(w, d), material, n, { cast: false }); m.rotation.set(-Math.PI / 2, 0, rz); m.position.set(x, y, z); g.add(m); return m; }

// shared night street materials (also used by the props / puddles): built once per env
export function streetMaterials(env) {
  const wet = (m, envI, rough) => { m.envMap = env; m.envMapIntensity = envI; if (rough) { m.roughnessMap = rough; m.roughness = 1; } m.flatShading = false; return m; };
  const span = STREET.x1 - STREET.x0, roadW = STREET.curbZ - STREET.roadZ1;
  return {
    span, roadW,
    walk: wet(mat(tex(wetSlabCanvas('#6e6a64', 9), { repeat: [span / 1.6, -STREET.curbZ / 1.6] }), {}), 0.9, dataTex(wetRoughCanvas(5, { wet: 0.38, lo: 0.12, hi: 0.55 }), [span / 9, 0.45])),
    farWalk: wet(mat(tex(wetSlabCanvas('#6a6660', 15), { repeat: [span / 1.6, 3.4 / 1.6] }), {}), 0.9, dataTex(wetRoughCanvas(6, { wet: 0.38, lo: 0.12, hi: 0.55 }), [span / 9, 0.5])),
    road: wet(mat(tex(wetAsphaltCanvas(11), { repeat: [span / 4, roadW / 4] }), {}), 1.1, dataTex(wetRoughCanvas(7, { wet: 0.5, lo: 0.06, hi: 0.42, cell: 7 }), [span / 10, roadW / 10])),
    curb: wet(mat(tex(curbCanvas(), { repeat: [span / 1.0, 1] }), { rough: 0.35 }), 0.8),
    gutter: wet(mat('#25272c', { rough: 0.06 }), 1.3),
    paint: wet(mat('#cfcab8', { rough: 0.3, polygonOffset: 1 }), 0.8),
    iron: wet(mat('#1a1f22', { rough: 0.38, metal: 0.65 }), 1.0),
    blobTex: tex(blobCanvas(64, 1.4), { nearest: false }),
  };
}

// facade of a building, both rows
const GF = 3.5;      // ground floor height
const NEAR = [
  { x0: -34, x1: -24, h: 12, base: '#b6a58a', rows: 3, cols: 4, seed: 1, gf: 'closed' },
  { x0: -24, x1: -14.5, h: 15, base: '#8e4430', brick: true, rows: 4, cols: 4, seed: 2, gf: 'apart' },
  { x0: -14.5, x1: -6, h: 11, base: '#7d8a96', rows: 3, cols: 3, seed: 3, gf: 'shutter' },
  { x0: -6, x1: 1.6, h: 13.5, base: '#9a4a34', brick: true, rows: 3, cols: 3, seed: 4, gf: 'shop' },
  { x0: 1.6, x1: 7.6, h: 12, base: '#d8c39a', rows: 3, cols: 3, seed: 5, gf: 'shop' },
  { x0: 7.6, x1: 14.2, h: 14.5, base: '#a95a3c', brick: true, rows: 4, cols: 3, seed: 6, gf: 'shop' },
  { x0: 14.2, x1: 20.8, h: 11.5, base: '#9fb0a0', rows: 3, cols: 3, seed: 7, gf: 'shop' },
  { x0: 20.8, x1: 30, h: 16, base: '#c9b48c', rows: 4, cols: 4, seed: 8, gf: 'apart' },
  { x0: 30, x1: 40, h: 12.5, base: '#8a4a3a', brick: true, rows: 3, cols: 4, seed: 9, gf: 'closed' },
];
// shops on the near row (x = centre). win = [centre, width] of the big window, door = door centre, win2 = small window
const SHOPS = [
  { kind: 'boutique', x: -2.2, col: '#18141a', board: '#141016', win: [-0.1, 2.9], door: -2.35, win2: [-4.0, 1.7], awn: null },
  { kind: 'cafe', x: STREET.shops[0].x, col: '#2f5e3e', board: '#2f5e3e', win: [3.25, 3.0], door: 5.2, win2: [6.35, 0.85], awn: ['#f2ede0', '#2f6a44'] },
  { kind: 'pizza', x: STREET.shops[1].x, col: '#8a2a22', board: '#1f5a30', win: [9.75, 3.0], door: 11.7, win2: [12.85, 0.85], awn: ['#f2ede0', '#c0301e'] },
  { kind: 'store', x: STREET.shops[2].x, col: '#244e8a', board: '#2a5ea8', win: [16.25, 3.0], door: 18.2, win2: [19.35, 0.85], awn: ['#f2ede0', '#2a5ea8'] },
];

export function buildCity(env, M) {
  const g = new THREE.Group(); g.name = 'set.city';
  const dyn = new THREE.Group(); dyn.name = 'set.city.glows';      // sprites (not baked)
  const sy = STREET.sideY;
  const T = (c, r = [1, 1]) => tex(c, { repeat: r });
  const cache = new Map();
  const cm = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const glowTex = M.glowTex;
  const glows = [];
  const glow = (x, y, z, s, color, opacity = 0.8) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); sp.name = 'set.city.glow'; sp.userData.noAudit = true; dyn.add(sp); glows.push(sp); return sp;
  };

  // ---------------------------------------------------------------- ground
  const span = M.span, cx = (STREET.x0 + STREET.x1) / 2, roadW = M.roadW;
  boxAt(g, span, sy, -STREET.curbZ - 0.24, M.walk, cx, sy / 2, (STREET.curbZ + 0.24) / 2, 'sidewalk', { cast: false });
  boxAt(g, span, sy, 0.24, M.curb, cx, sy / 2, STREET.curbZ + 0.12, 'curb', { cast: false });
  const road = flat(g, span, roadW, M.road, cx, 0, (STREET.curbZ + STREET.roadZ1) / 2, 'road'); road.receiveShadow = true;
  flat(g, span, 0.26, M.gutter, cx, 0.002, STREET.curbZ - 0.13, 'gutter');
  flat(g, span, 0.26, M.gutter, cx, 0.002, STREET.roadZ1 + 0.13, 'gutterFar');
  // markings: dashed centre line, solid edge lines, a zebra crossing
  const zc = (STREET.curbZ + STREET.roadZ1) / 2;
  for (let x = STREET.x0 + 1; x < STREET.x1; x += 4.5) flat(g, 2.2, 0.13, M.paint, x, 0.004, zc, 'laneDash');
  flat(g, span, 0.1, M.paint, cx, 0.004, STREET.curbZ - 0.42, 'edgeLine');
  flat(g, span, 0.1, M.paint, cx, 0.004, STREET.roadZ1 + 0.42, 'edgeLineFar');
  for (let i = 0; i < 6; i++) flat(g, 0.45, roadW - 1.2, M.paint, 9.0 + i * 0.85, 0.005, zc, 'zebra');
  // far curb + far sidewalk
  boxAt(g, span, sy, 0.24, M.curb, cx, sy / 2, STREET.roadZ1 - 0.12, 'farCurb', { cast: false });
  boxAt(g, span, sy, 3.4 - 0.24, M.farWalk, cx, sy / 2, STREET.roadZ1 - 0.24 - (3.4 - 0.24) / 2, 'farSidewalk', { cast: false });
  // manhole + storm drains
  const mh = msh(new THREE.CircleGeometry(0.36, 12), M.iron.clone(), 'manhole', { cast: false });
  mh.material.map = T(manholeCanvas()); mh.material.polygonOffset = true; mh.material.polygonOffsetFactor = -2; mh.material.polygonOffsetUnits = -4;
  mh.rotation.x = -Math.PI / 2; mh.position.set(STREET.manhole?.[0] ?? 7.2, 0.006, STREET.manhole?.[1] ?? -7.6); g.add(mh);
  for (const dx of [-6.5, 8.0, 22]) boxAt(g, 0.75, 0.02, 0.3, M.iron, dx, 0.008, STREET.curbZ - 0.16, 'drain', { cast: false });

  // ---------------------------------------------------------------- buildings
  const roofM = cm('roof', () => mat(T(roofCanvas(41), [4, 4]), { rough: 0.9 }));
  const parapetM = (b) => cm('par' + b.base, () => mat(T(b.brick ? brickCanvas(b.base, '#a8957e', b.seed + 50) : plasterCanvas(b.base, b.seed + 50), [3, 0.3]), { rough: 0.9 }));
  const corniceM = cm('cornice', () => mat('#cfc6b2', { rough: 0.8 }));
  const darkM = cm('dark', () => mat('#2a2a2e', { rough: 0.7 }));
  const acM = cm('ac', () => mat('#9a9c9e', { rough: 0.5, metal: 0.4 }));
  const tankM = cm('tank', () => mat(T(plasterCanvas('#6e5440', 77, 20), [2, 2]), { rough: 0.9 }));
  const R = rng(4242);
  const roofStuff = (x0, x1, h, zA, zB, seed) => {
    const Rr = rng(seed), w = x1 - x0, xc = (x0 + x1) / 2, zc2 = (zA + zB) / 2, d = Math.abs(zB - zA);
    const par = parapetM({ base: '#8a7a6a', seed });
    boxAt(g, w, 0.55, 0.25, par, xc, h + 0.27, zA, 'parapet', { cast: false });
    boxAt(g, w, 0.55, 0.25, par, xc, h + 0.27, zB, 'parapet', { cast: false });
    boxAt(g, 0.25, 0.55, d, par, x0 + 0.12, h + 0.27, zc2, 'parapet', { cast: false });
    boxAt(g, 0.25, 0.55, d, par, x1 - 0.12, h + 0.27, zc2, 'parapet', { cast: false });
    const n = 1 + Math.floor(Rr() * 3);
    for (let i = 0; i < n; i++) boxAt(g, 0.9, 0.6, 0.7, acM, x0 + 1 + Rr() * (w - 2), h + 0.3, zc2 + (Rr() - 0.5) * d * 0.6, 'acUnit', { cast: false });
    if (Rr() < 0.55) {                                                     // water tank on legs
      const tx = x0 + 1.5 + Rr() * (w - 3), tz = zc2 + (Rr() - 0.5) * d * 0.4;
      const tank = msh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 8), tankM, 'waterTank', { cast: false }); tank.position.set(tx, h + 1.9, tz); g.add(tank);
      const cap = msh(new THREE.ConeGeometry(0.78, 0.5, 8), tankM, 'tankCap', { cast: false }); cap.position.set(tx, h + 2.85, tz); g.add(cap);
      for (const [lx, lz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) boxAt(g, 0.08, 1.2, 0.08, darkM, tx + lx, h + 0.6, tz + lz, 'tankLeg', { cast: false });
    }
    if (Rr() < 0.7) boxAt(g, 0.5, 1.2, 0.5, parapetM({ base: '#7a4a3a', brick: true, seed: seed + 3 }), x0 + 0.8 + Rr() * (w - 1.6), h + 0.6, zc2 + (Rr() - 0.5) * d * 0.7, 'chimney', { cast: false });
    if (Rr() < 0.5) { const sk = boxAt(g, 1.4, 0.35, 1.0, cm('sky', () => mat('#3a4a66', { rough: 0.1, emissive: '#ffcf8a', emissiveIntensity: 0.25 })), x0 + 1.2 + Rr() * (w - 2.4), h + 0.17, zc2 + (Rr() - 0.5) * d * 0.5, 'skylight', { cast: false }); }
  };

  const facadeOf = (b, w, hh, lit) => { const [map, emi] = facadeNight({ ...b, w, h: hh, lit }); const m = mat(T(map), { rough: 0.85, emissive: '#ffffff', emissiveIntensity: 1.0 }); m.emissiveMap = T(emi); return m; };
  const wallM = (b, w, hh, seed) => mat(T(b.brick ? brickCanvas(b.base, '#a8957e', seed) : plasterCanvas(b.base, seed), [w / 2.5, hh / 2.5]), { rough: 0.9 });
  const D = 10;
  for (const b of NEAR) {
    const w = b.x1 - b.x0, xc = (b.x0 + b.x1) / 2;
    const side = wallM(b, D, b.h, b.seed);
    boxAt(g, w, b.h, D, [side, side, roofM, darkM, side, side], xc, b.h / 2, D / 2 + 0.02, `body${b.seed}`, { cast: false });
    quad(g, w, b.h - GF, facadeOf(b, w, b.h - GF, 0.45), xc, GF + (b.h - GF) / 2, -0.005, `facade${b.seed}`).receiveShadow = true;
    boxAt(g, w + 0.1, 0.35, 0.35, corniceM, xc, b.h + 0.1, -0.05, `cornice${b.seed}`, { cast: false });
    boxAt(g, w, 0.22, 0.25, corniceM, xc, GF + 0.05, -0.08, `beltCourse${b.seed}`, { cast: false });
    roofStuff(b.x0, b.x1, b.h, 0.25, D - 0.1, 100 + b.seed);
    // ground floor wall
    quad(g, w, GF, wallM(b, w, GF, b.seed + 30), xc, GF / 2, 0.28, `gfWall${b.seed}`).receiveShadow = true;
    if (b.gf === 'closed' || b.gf === 'shutter') {
      const n = b.gf === 'shutter' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sx = xc + (n === 1 ? -w * 0.15 : (i - 0.5) * w * 0.45);
        boxAt(g, Math.min(3.2, w * 0.38), 2.6, 0.08, cm('shut', () => mat(T(shutterCanvas(31), [1, 3]), { rough: 0.5, metal: 0.3 })), sx, 1.3 + sy, 0.22, 'shutter', { cast: false });
        boxAt(g, Math.min(3.4, w * 0.4), 0.25, 0.3, darkM, sx, sy + 2.75, 0.15, 'shutterBox', { cast: false });
      }
    }
    if (b.gf === 'apart' || b.gf === 'closed') {          // apartment entrance: lit glass door + transom + wall lamp
      const dx = xc + w * 0.28;
      boxAt(g, 1.5, 2.7, 0.2, darkM, dx, sy + 1.35, 0.2, 'aptDoorFrame', { cast: false });
      quad(g, 1.1, 2.3, cm('aptGlass', () => { const m = mat(T(shopWindowCanvas('apart', 9)), { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.9 }); m.emissiveMap = m.map; return m; }), dx, sy + 1.2, 0.08, 'aptDoorGlass');
      boxAt(g, 0.16, 0.24, 0.12, cm('sconce', () => mat('#fff0c8', { emissive: '#ffcf80', emissiveIntensity: 2.2 })), dx + 0.95, sy + 2.3, 0.1, 'sconce', { cast: false });
      glow(dx + 0.95, sy + 2.3, -0.05, 0.9, '#ffbf70', 0.55);
      for (const wx of [xc - w * 0.3, xc]) quad(g, 1.4, 1.5, cm('aptWin', () => { const m = mat(T(shopWindowCanvas('apart', 13)), { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.7 }); m.emissiveMap = m.map; return m; }), wx, 1.9, 0.2, 'aptWindow');
    }
  }

  // ---------------------------------------------------------------- the shops on the near row
  const goldM = cm('gold', () => { const m = mat(T(goldCanvas({ base: '#f0c050', seed: 23 })), { rough: 0.25, metal: 1.0, emissive: '#3a2406', emissiveIntensity: 0.6 }); m.envMap = env; m.envMapIntensity = 1.6; return m; });
  const shops = [];
  for (const [i, S] of SHOPS.entries()) {
    const x = S.x, frameM = cm('frame' + S.kind, () => mat(S.col, { rough: 0.55 }));
    const sg = new THREE.Group(); sg.name = `set.city.shop.${S.kind}`; g.add(sg);
    boxAt(sg, 0.35, GF, 0.3, frameM, x - 2.95, GF / 2, -0.05, 'pilasterL');
    boxAt(sg, 0.35, GF, 0.3, frameM, x + 2.95, GF / 2, -0.05, 'pilasterR');
    boxAt(sg, 6.25, 0.55, 0.3, frameM, x, GF - 0.27, -0.05, 'lintel');
    if (S.kind === 'boutique') {           // gold trim lines on the black frame
      boxAt(sg, 6.3, 0.05, 0.32, goldM, x, GF - 0.02, -0.06, 'goldTrim', { cast: false });
      boxAt(sg, 6.3, 0.05, 0.32, goldM, x, GF - 0.53, -0.06, 'goldTrim', { cast: false });
      for (const px of [x - 2.95, x + 2.95]) boxAt(sg, 0.05, GF - 0.6, 0.32, goldM, px, (GF - 0.6) / 2, -0.06, 'goldTrimV', { cast: false });
    }
    // lightbox board with a pictogram
    const boardM = cm('board' + S.kind, () => { const m = mat(T(iconBoardCanvas(S.kind, S.board)), { rough: 0.5, emissive: '#ffffff', emissiveIntensity: 0.7 }); m.emissiveMap = m.map; return m; });
    const board = msh(new THREE.BoxGeometry(3.6, 0.9, 0.14), [frameM, frameM, frameM, frameM, frameM, boardM], 'iconBoard', { cast: false });
    board.position.set(x, GF + 0.42, -0.14); board.rotation.y = Math.PI; sg.add(board);
    // windows (emissive interiors)
    const winM = cm('win' + S.kind, () => { const m = mat(T(shopWindowCanvas(S.kind, 40 + i)), { rough: 0.12, emissive: '#ffffff', emissiveIntensity: 1.05 }); m.emissiveMap = m.map; m.envMap = env; m.envMapIntensity = 0.5; return m; });
    const win2M = cm('win2' + S.kind, () => { const m = mat(T(shopWindowCanvas(S.kind, 50 + i)), { rough: 0.12, emissive: '#ffffff', emissiveIntensity: 1.0 }); m.emissiveMap = m.map; m.envMap = env; m.envMapIntensity = 0.5; return m; });
    quad(sg, S.win[1], 2.3, winM, S.win[0], 1.6, 0.06, 'window');
    boxAt(sg, S.win[1] + 0.1, 0.4, 0.35, frameM, S.win[0], 0.27, -0.04, 'sill');
    for (const ex of [S.win[0] - S.win[1] / 2 - 0.04, S.win[0] + S.win[1] / 2 + 0.04]) boxAt(sg, 0.1, 2.4, 0.2, frameM, ex, 1.6, -0.0, 'winFrame', { cast: false });
    quad(sg, S.win2[1], 2.3, win2M, S.win2[0], 1.6, 0.06, 'window2');
    // glass door, lit from inside, with a gold push bar
    const dw = STREET.doorW, dh = STREET.doorH;
    const doorGlassM = cm('doorGlass' + S.kind, () => { const m = mat(T(shopWindowCanvas(S.kind, 60 + i), [0.5, 1]), { rough: 0.12, emissive: '#ffffff', emissiveIntensity: 0.95 }); m.emissiveMap = m.map; return m; });
    quad(sg, dw - 0.2, dh - 0.2, doorGlassM, S.door, sy + dh / 2, 0.05, 'doorGlass');
    boxAt(sg, 0.12, dh + 0.12, 0.3, frameM, S.door - dw / 2 - 0.06, sy + dh / 2, -0.04, 'doorFrameL');
    boxAt(sg, 0.12, dh + 0.12, 0.3, frameM, S.door + dw / 2 + 0.06, sy + dh / 2, -0.04, 'doorFrameR');
    boxAt(sg, dw + 0.24, 0.14, 0.3, frameM, S.door, sy + dh + 0.07, -0.04, 'doorFrameTop');
    boxAt(sg, dw - 0.3, 0.05, 0.06, goldM, S.door, sy + 1.05, -0.0, 'pushBar', { cast: false });
    // awning (sloped, striped) or a slim black canopy for the boutique
    if (S.awn) {
      const aw = msh(new THREE.PlaneGeometry(6.2, 1.5), cm('awn' + S.kind, () => mat(T(awningCanvas(S.awn[0], S.awn[1], i), [6, 1]), { side: THREE.DoubleSide, rough: 0.5 })), 'awning');
      aw.position.set(x, GF - 0.85, -0.65); aw.rotation.set(-Math.PI / 2 + 0.55, Math.PI, 0); sg.add(aw);
      quad(sg, 6.2, 0.28, cm('val' + S.kind, () => mat(T(awningCanvas(S.awn[0], S.awn[1], i + 5), [6, 1]), { side: THREE.DoubleSide, rough: 0.5 })), x, GF - 1.45, -1.28, 'valance');
    } else {
      boxAt(sg, 5.6, 0.12, 1.1, frameM, x, GF - 0.62, -0.55, 'canopy');
      boxAt(sg, 5.6, 0.04, 0.04, goldM, x, GF - 0.56, -1.1, 'canopyGold', { cast: false });
      // little downlights under the canopy
      for (const lx of [-2, 0, 2]) { boxAt(sg, 0.14, 0.03, 0.14, cm('down', () => mat('#fff4dc', { emissive: '#ffe2b0', emissiveIntensity: 2.5 })), x + lx, GF - 0.69, -0.6, 'downlight', { cast: false }); glow(x + lx, GF - 0.75, -0.62, 0.55, '#ffd9a0', 0.5); }
    }
    // a warm glow in front of every window (cheap bloom)
    glow(S.win[0], 1.7, -0.25, 2.6, '#ffc480', 0.13);
    shops.push({ ...S, group: sg, doorX: S.door });
  }
  // planters with little shrubs by the pizza place + a trash can + a hydrant
  const potM = cm('pot', () => mat('#5a4a40', { rough: 0.8 })), shrubM = cm('shrub', () => mat('#2f5a2a', { rough: 0.9 }));
  for (const px of [STREET.shops[1].x - 2.6, STREET.shops[1].x + 2.6, STREET.shops[2].x + 2.6]) {
    const p = msh(new THREE.CylinderGeometry(0.24, 0.19, 0.46, 8), potM, 'planter'); p.position.set(px, sy + 0.23, -0.45); g.add(p);
    const b = msh(new THREE.IcosahedronGeometry(0.32, 1), shrubM, 'planterBush'); b.position.set(px, sy + 0.66, -0.45); g.add(b);
  }
  const canM = cm('can', () => { const m = mat('#2f4a3a', { rough: 0.4, metal: 0.4 }); m.envMap = env; m.envMapIntensity = 0.8; return m; });
  const can = msh(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 10), canM, 'trashCan'); can.position.set(-6.4, sy + 0.45, -0.6); g.add(can);
  boxAt(g, 0.7, 0.06, 0.7, canM, -6.4, sy + 0.93, -0.6, 'trashLid');
  const hyM = cm('hy', () => { const m = mat('#c8281e', { rough: 0.35, metal: 0.2 }); m.envMap = env; m.envMapIntensity = 0.8; return m; });
  const hy = msh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), hyM, 'hydrant'); hy.position.set(6.6, sy + 0.3, -2.75); g.add(hy);
  const hyT = msh(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), hyM, 'hydrantTop'); hyT.position.set(6.6, sy + 0.6, -2.75); g.add(hyT);
  boxAt(g, 0.36, 0.08, 0.08, hyM, 6.6, sy + 0.38, -2.75, 'hydrantArms');

  // ---------------------------------------------------------------- far row (facing +Z)
  const FAR = [];
  const fR = rng(77);
  let fx = STREET.x0;
  for (let i = 0; fx < STREET.x1; i++) {
    const w = 6.5 + fR() * 3.5, h = 10 + fR() * 7.5, base = ['#b39b80', '#8a5a44', '#9aa6b0', '#c4b08a', '#7e4a3a', '#a08ab0', '#8a9a7e'][i % 7];
    FAR.push({ x0: fx, x1: Math.min(STREET.x1 + 4, fx + w), h, base, brick: i % 3 === 1, rows: h > 14 ? 4 : 3, cols: w > 8.5 ? 4 : 3, seed: 80 + i, kind: ['cafe', 'store', 'apart', 'pizza', 'boutique', 'apart', 'store'][i % 7], awn: i % 2 === 0 });
    fx += w;
  }
  const FZ = STREET.farZ;
  for (const b of FAR) {
    const w = b.x1 - b.x0, xc = (b.x0 + b.x1) / 2;
    const side = wallM(b, 8, b.h, b.seed);
    boxAt(g, w, b.h, 8, [side, side, roofM, darkM, side, side], xc, b.h / 2, FZ - 4 - 0.02, `farBody${b.seed}`, { cast: false });
    quad(g, w, b.h - GF, facadeOf(b, w, b.h - GF, 0.5), xc, GF + (b.h - GF) / 2, FZ + 0.005, `farFacade${b.seed}`, 0);
    boxAt(g, w + 0.1, 0.35, 0.35, corniceM, xc, b.h + 0.1, FZ + 0.05, `farCornice${b.seed}`, { cast: false });
    boxAt(g, w, 0.2, 0.22, corniceM, xc, GF + 0.05, FZ + 0.08, `farBelt${b.seed}`, { cast: false });
    roofStuff(b.x0, b.x1, b.h, FZ - 0.25, FZ - 7.9, 200 + b.seed);
    quad(g, w, GF, wallM(b, w, GF, b.seed + 30), xc, GF / 2, FZ + 0.004, `farGf${b.seed}`, 0);
    const ww = Math.min(4.2, w * 0.5), wx = xc - w * 0.12;
    const fwM = cm('fw' + b.kind + (b.seed % 3), () => { const m = mat(T(shopWindowCanvas(b.kind, b.seed)), { rough: 0.15, emissive: '#ffffff', emissiveIntensity: 1.0 }); m.emissiveMap = m.map; return m; });
    quad(g, ww, 2.2, fwM, wx, 1.55, FZ + 0.03, 'farShopWin', 0);
    boxAt(g, ww + 0.2, 0.3, 0.25, darkM, wx, 0.3, FZ + 0.1, 'farSill', { cast: false });
    const dx = xc + w * 0.3;
    quad(g, 1.1, 2.2, fwM, dx, sy + 1.1, FZ + 0.03, 'farDoor', 0);
    boxAt(g, 1.3, 0.12, 0.2, darkM, dx, sy + 2.28, FZ + 0.1, 'farDoorTop', { cast: false });
    if (b.awn) {
      const aw = msh(new THREE.PlaneGeometry(ww + 0.6, 1.3), cm('fawn' + b.seed % 4, () => mat(T(awningCanvas('#efe8da', ['#2f6a44', '#c0301e', '#2a5ea8', '#7a3a8a'][b.seed % 4], b.seed), [5, 1]), { side: THREE.DoubleSide, rough: 0.5 })), 'farAwning');
      aw.position.set(wx, GF - 0.8, FZ + 0.55); aw.rotation.set(-Math.PI / 2 + 0.55, 0, 0); g.add(aw);
    }
    glow(wx, 1.6, FZ + 0.4, 3.0, '#ffc480', 0.12);
  }

  // ---------------------------------------------------------------- lamp posts (the hero lamp by the bush is built in set_street_props)
  const lampGeo = lampPostGeometry();
  const lampSpots = [];
  for (const x of [-21, -9.5, 15, 27, 37]) lampSpots.push([x, STREET.curbZ + 0.4]);
  for (const x of [-27, -15, -3, 9, 21, 33]) lampSpots.push([x, STREET.roadZ1 - 0.4]);
  for (const [lx, lz] of lampSpots) {
    for (const part of lampGeo) { const m = msh(part.geo, part.mat === 'glass' ? M.lampGlass : M.iron, 'lampPost', { cast: false }); m.position.set(lx, sy, lz); g.add(m); }
    glow(lx, sy + LAMP.lanternY, lz, 2.4, '#ffb868', 0.5);
    glow(lx, sy + LAMP.lanternY, lz, 0.8, '#fff0d0', 0.9);
    // warm pool of light on the wet ground under the lamp
    const pool = msh(new THREE.PlaneGeometry(4.2, 4.2), M.poolMat, 'lampPool', { cast: false, receive: false }); pool.rotation.x = -Math.PI / 2; pool.position.set(lx, sy + 0.012, lz); pool.renderOrder = 1; pool.userData.noAudit = true; dyn.add(pool);
  }

  // ---------------------------------------------------------------- parked cars
  const cars = [];
  const car = (x, z, col, ry, taxi = false) => {
    const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; g.add(cg);
    const bodyM = cm('car' + col, () => { const m = mat(col, { rough: 0.18, metal: 0.3 }); m.envMap = env; m.envMapIntensity = 1.2; return m; });
    const winM = cm('carWin', () => { const m = mat('#10161e', { rough: 0.05 }); m.envMap = env; m.envMapIntensity = 1.6; return m; });
    boxAt(cg, 1.8, 0.62, 4.3, bodyM, 0, 0.6, 0, 'carBody');
    boxAt(cg, 1.6, 0.52, 2.2, bodyM, 0, 1.16, -0.2, 'carCab');
    for (const sd of [-1, 1]) quad(cg, 1.9, 0.38, winM, sd * 0.805, 1.17, -0.2, 'carWin', sd * Math.PI / 2);
    const ws = quad(cg, 1.5, 0.48, winM, 0, 1.17, 0.905, 'carWindshield', 0); ws.rotation.x = -0.3;
    const rw = quad(cg, 1.5, 0.48, winM, 0, 1.17, -1.305, 'carRear', Math.PI); rw.rotation.x = 0.3;
    const tireM = cm('tire', () => mat('#18181a', { rough: 0.7 }));
    for (const [tx, tz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) { const w2 = msh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10), tireM, 'tire'); w2.rotation.z = Math.PI / 2; w2.position.set(tx, 0.33, tz); cg.add(w2); }
    const tailM = cm('tail', () => mat('#5a0a0a', { emissive: '#ff2a1a', emissiveIntensity: 0.6 }));
    for (const sd of [-1, 1]) { boxAt(cg, 0.36, 0.14, 0.06, tailM, sd * 0.65, 0.74, -2.16, 'carTail', { cast: false }); boxAt(cg, 0.36, 0.14, 0.06, cm('head', () => mat('#d8d8cc', { rough: 0.2 })), sd * 0.62, 0.72, 2.16, 'carHead', { cast: false }); }
    if (taxi) boxAt(cg, 0.5, 0.16, 0.22, cm('taxiLight', () => mat('#fff4c0', { emissive: '#ffe080', emissiveIntensity: 1.2 })), 0, 1.5, -0.2, 'taxiLight', { cast: false });
    const sh = msh(new THREE.PlaneGeometry(2.4, 5.0), M.shadowMat, 'carShadow', { cast: false, receive: false }); sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.008, 0); sh.renderOrder = 1; sh.userData.noAudit = true; cg.add(sh);
    cars.push(cg);
  };
  car(-33, -4.35, '#3b6aa8', Math.PI / 2);
  car(34.5, -4.35, '#c94a2a', Math.PI / 2);
  car(8.6, -9.75, '#e8c23a', -Math.PI / 2, true);
  car(-9.5, -9.75, '#5a6a5a', -Math.PI / 2);
  car(25, -9.75, '#e8e4dc', -Math.PI / 2);

  // ---------------------------------------------------------------- bake the static meshes (one mesh per material)
  const baked = new THREE.Group(); baked.name = 'set.city.baked';
  for (const m of bakeGroup(g, 'set.city.static')) baked.add(m);
  const out = new THREE.Group(); out.name = 'set.city'; out.add(baked, dyn);
  return { group: out, shops, glows, lampSpots, cars };
}
