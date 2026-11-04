// Sets: the man's bedroom (also dressed as the "rich room"), the kids'
// bedroom for the cutaway, and a tiny jail cell sitting on a police desk.
import * as THREE from 'three';
import { bx, cyl, at, shade, pillowGeo, curtainGeo } from './build.js';
import { rng } from './util.js';

// Bedroom layout (metres, origin at floor centre):
//   back wall z=-3 (window x 1.2..2.1, y 1.0..2.1), side walls x=+-2.6,
//   bed centred x=-0.25 (z -2.96..-0.95), nightstand x=0.65, wardrobe x=-1.5.
export const BED = { x: -0.25, top: 0.72, pillow: new THREE.Vector3(-0.25, 0.83, -2.62) };
export const WINDOW = { x: 1.65, y: 1.55, w: 0.9, h: 1.1 };

export function buildBedroom(M) {
  const g = new THREE.Group();
  const S = {};
  const add = (m, name) => { g.add(m); if (name) S[name] = m; return m; };
  const WP = { uv: 'world', density: 1.6 }, WS = { uv: 'world', density: 1.0 };
  add(at(bx(5.2, 0.1, 5.6, M.floor, { uv: 'world', density: 0.5 }), 0, -0.05, -0.2));
  add(at(bx(5.2, 0.1, 5.6, M.ceiling), 0, 2.85, -0.2));
  // back wall with window opening
  add(at(bx(5.2, 0.95, 0.1, M.wainscot, WS), 0, 0.475, -3.05));
  add(at(bx(3.8, 1.85, 0.1, M.wallpaper, WP), -0.7, 1.875, -3.05));
  add(at(bx(0.5, 1.85, 0.1, M.wallpaper, WP), 2.35, 1.875, -3.05));
  add(at(bx(0.9, 0.7, 0.1, M.wallpaper, WP), 1.65, 2.45, -3.05));
  add(at(bx(0.9, 0.05, 0.1, M.wallpaper, WP), 1.65, 0.975, -3.05));
  add(at(bx(5.2, 0.05, 0.04, M.trim), 0, 0.95, -2.98));
  add(at(bx(5.2, 0.1, 0.03, M.trim), 0, 0.05, -2.985));
  // side + front walls
  for (const s of [-1, 1]) {
    add(at(bx(0.1, 0.95, 5.6, M.wainscot, WS), s * 2.65, 0.475, -0.2));
    add(at(bx(0.1, 1.85, 5.6, M.wallpaper, WP), s * 2.65, 1.875, -0.2));
    add(at(bx(0.04, 0.05, 5.6, M.trim), s * 2.58, 0.95, -0.2));
    add(at(bx(0.03, 0.1, 5.6, M.trim), s * 2.585, 0.05, -0.2));
  }
  add(at(bx(5.2, 0.95, 0.1, M.wainscot, WS), 0, 0.475, 2.65));
  add(at(bx(5.2, 1.85, 0.1, M.wallpaper, WP), 0, 1.875, 2.65));
  // window
  const wx = WINDOW.x;
  add(at(bx(1.06, 0.045, 0.2), wx, 1.0, -2.95)).material = M.trim;
  for (const s of [-1, 1]) add(at(bx(0.07, 1.16, 0.14, M.trim), wx + s * 0.485, 1.55, -3.0));
  add(at(bx(1.04, 0.07, 0.14, M.trim), wx, 2.13, -3.0));
  add(at(bx(0.035, 1.1, 0.05, M.trim), wx, 1.55, -3.04));
  add(at(bx(0.9, 0.035, 0.05, M.trim), wx, 1.55, -3.04));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), M.skyNight);
  sky.position.set(wx - 0.1, 1.5, -4.3);
  add(sky, 'sky');
  // curtains (rod 0.3 m in front of the wall so officers can hide behind)
  add(at(cyl(0.018, 0.018, 1.55, 6, M.rod), wx, 2.3, -2.7, 0, 0, Math.PI / 2));
  S.curtains = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(curtainGeo(0.72, 2.26), M.curtain);
    c.castShadow = true; c.receiveShadow = true;
    g.add(c);
    S.curtains.push({ mesh: c, s });
  }
  // bed
  const bedG = new THREE.Group(); add(bedG, 'bed');
  for (const [x, z] of [[-0.62, -2.9], [0.62, -2.9], [-0.62, -1.0], [0.62, -1.0]]) bedG.add(at(bx(0.08, 0.42, 0.08, M.bedWood), BED.x + x, 0.21, z));
  bedG.add(at(bx(1.36, 0.12, 2.0, M.bedWood), BED.x, 0.48, -1.95));
  bedG.add(at(bx(1.26, 0.18, 1.92, M.mattress), BED.x, 0.63, -1.97));
  bedG.add(at(bx(1.44, 1.04, 0.08, M.bedWood), BED.x, 0.79, -2.96));
  bedG.add(at(bx(1.52, 0.06, 0.12, M.bedWood), BED.x, 1.32, -2.96));
  for (const x of [-0.45, 0, 0.45]) bedG.add(at(bx(0.34, 0.5, 0.014, M.nightstand), BED.x + x, 0.98, -2.915));
  bedG.add(at(bx(1.44, 0.5, 0.08, M.bedWood), BED.x, 0.66, -0.95));
  const duvet = new THREE.Group(); bedG.add(duvet); S.duvet = duvet;
  duvet.add(at(bx(1.34, 0.08, 1.33, M.duvet, { uv: 'world', density: 1.5 }), BED.x, 0.76, -1.665));
  for (const s of [-1, 1]) duvet.add(at(bx(0.03, 0.3, 1.33, M.duvet, { uv: 'world', density: 1.5 }), BED.x + s * 0.685, 0.62, -1.665));
  duvet.add(at(bx(1.36, 0.1, 0.15, M.sheet), BED.x, 0.78, -2.32));
  const pillow = shade(new THREE.Mesh(pillowGeo(0.86, 0.22, 0.46), M.pillow));
  pillow.position.copy(BED.pillow);
  add(pillow, 'pillow');
  // duvet bump used when the man lies in bed
  const lump = shade(new THREE.Mesh(pillowGeo(1.3, 0.3, 1.25), M.duvet));
  lump.position.set(BED.x, 0.79, -1.6);
  add(lump, 'lump');
  // nightstand + lamp
  const stand = new THREE.Group(); add(stand, 'stand');
  stand.add(at(bx(0.42, 0.5, 0.4, M.nightstand), 0.65, 0.25, -2.78));
  stand.add(at(bx(0.46, 0.03, 0.44, M.nightstand), 0.65, 0.515, -2.78));
  stand.add(at(bx(0.36, 0.16, 0.012, M.trim), 0.65, 0.36, -2.574));
  stand.add(at(bx(0.04, 0.03, 0.03, M.knob), 0.65, 0.36, -2.56));
  stand.add(at(cyl(0.07, 0.08, 0.03, 10, M.trim), 0.65, 0.545, -2.82));
  stand.add(at(cyl(0.012, 0.012, 0.22, 6, M.rod), 0.65, 0.67, -2.82));
  stand.add(at(cyl(0.09, 0.15, 0.17, 8, M.shade, true), 0.65, 0.84, -2.82)); S.lampShade = stand.children[stand.children.length - 1];
  stand.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), M.bulb), 0.65, 0.8, -2.82));
  // wardrobe (hollow so officers fit inside)
  const wd = new THREE.Group(); add(wd, 'wardrobe');
  const inner = M.interior, W0 = M.wardrobe;
  wd.add(at(shade(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.95, 0.03), [W0, W0, W0, W0, inner, W0])), -1.5, 1.025, -2.985));
  wd.add(at(shade(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.55), [inner, W0, W0, W0, W0, W0])), -1.935, 1.025, -2.725));
  wd.add(at(shade(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.55), [W0, inner, W0, W0, W0, W0])), -1.065, 1.025, -2.725));
  wd.add(at(shade(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.55), [W0, W0, W0, inner, W0, W0])), -1.5, 1.985, -2.725));
  wd.add(at(shade(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.55), [W0, W0, inner, W0, W0, W0])), -1.5, 0.065, -2.725));
  wd.add(at(bx(0.98, 0.06, 0.6, M.wardrobeDark), -1.5, 2.02, -2.72));
  for (const [x, z] of [[-1.9, -2.96], [-1.1, -2.96], [-1.9, -2.5], [-1.1, -2.5]]) wd.add(at(bx(0.06, 0.06, 0.06, M.wardrobeDark), x, 0.03, z));
  S.doors = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s < 0 ? -1.95 : -1.05, 0.08, -2.44); wd.add(piv);
    const dir = s < 0 ? 1 : -1;
    piv.add(at(bx(0.45, 1.88, 0.03, M.wardrobe), dir * 0.225, 0.94, 0.015));
    piv.add(at(bx(0.33, 0.7, 0.012, M.wardrobeDark), dir * 0.225, 1.38, 0.034));
    piv.add(at(bx(0.33, 0.7, 0.012, M.wardrobeDark), dir * 0.225, 0.52, 0.034));
    piv.add(at(bx(0.025, 0.1, 0.03, M.knob), dir * 0.41, 0.95, 0.05));
    S.doors.push({ piv, dir });
  }
  // rug, frames, clock, ceiling lamp, door, plant
  const rug = shade(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.012, 1.4), [M.trim, M.trim, M.rug, M.trim, M.trim, M.trim]));
  rug.position.set(-0.1, 0.006, -0.25); add(rug, 'rug');
  const boat = new THREE.Group(); add(boat, 'boatPic');
  boat.add(at(bx(0.3, 0.38, 0.03, M.frame), 0.65, 1.55, -2.985));
  boat.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), M.picBoat), 0.65, 1.55, -2.968));
  add(at(bx(0.03, 0.44, 0.56, M.frame), -2.585, 1.62, -1.2));
  add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), M.picHills), -2.568, 1.62, -1.2, 0, Math.PI / 2, 0));
  const toothPic = new THREE.Group(); add(toothPic, 'toothPic');
  toothPic.add(at(bx(0.62, 0.76, 0.05, M.throneGold), -1.45, 1.62, -2.97));
  toothPic.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.64), M.picTooth), -1.45, 1.62, -2.94));
  const clock = new THREE.Group(); clock.position.set(-0.25, 1.86, -2.97); add(clock, 'clock');
  clock.add(at(cyl(0.17, 0.17, 0.04, 24, M.clockRim), 0, 0, 0, Math.PI / 2, 0, 0));
  clock.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), M.clockFace), 0, 0, 0.021));
  S.hourHand = new THREE.Group(); S.hourHand.position.z = 0.026; clock.add(S.hourHand);
  S.hourHand.add(at(bx(0.02, 0.085, 0.006, M.ink), 0, 0.035, 0));
  S.minHand = new THREE.Group(); S.minHand.position.z = 0.03; clock.add(S.minHand);
  S.minHand.add(at(bx(0.013, 0.125, 0.006, M.ink), 0, 0.055, 0));
  add(at(cyl(0.008, 0.008, 0.2, 5, M.ink), 0, 2.72, -1.2));
  add(at(shade(new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.shade)), 0, 2.58, -1.2), 'ceilLamp');
  add(at(bx(0.05, 2.02, 0.92, M.door), 2.575, 1.01, -0.8));
  for (const z of [-1.29, -0.31]) add(at(bx(0.06, 2.1, 0.07, M.trim), 2.57, 1.05, z));
  add(at(bx(0.06, 0.07, 1.05, M.trim), 2.57, 2.08, -0.8));
  add(at(bx(0.06, 0.05, 0.05, M.knob), 2.53, 1.0, -0.43));
  add(at(cyl(0.15, 0.11, 0.28, 8, M.plantPot), -2.25, 0.14, -2.65));
  const R = rng(7);
  for (let i = 0; i < 9; i++) {
    const leaf = bx(0.09, 0.5 + R() * 0.25, 0.02, M.leaf);
    const a = (i / 9) * Math.PI * 2;
    at(leaf, -2.25 + Math.cos(a) * 0.08, 0.5, -2.65 + Math.sin(a) * 0.08, Math.sin(a) * 0.45, -a, Math.cos(a) * 0.45);
    add(leaf);
  }
  S.root = g;
  return S;
}

export function setClock(S, h, m) {
  S.minHand.rotation.z = -(m / 60) * Math.PI * 2;
  S.hourHand.rotation.z = -((h % 12) / 12 + m / 720) * Math.PI * 2;
}

// curtain state: open (0..1), bulges (world x/y) for officers hiding behind
const curtainCache = new Map();
export function setCurtains(S, open, bulges = [], gap = 0) {
  S.curtains.forEach(({ mesh, s }) => {
    const full = 0.72 - gap / 2;
    const sc = (full / 0.72) * (1 - 0.62 * open);
    const edge = WINDOW.x + s * 0.71;
    const cx = edge - s * 0.36 * sc;
    const mine = bulges
      .filter((b) => (s < 0 ? b.x < WINDOW.x : b.x >= WINDOW.x))
      .map((b) => ({ ...b, x: (b.x - cx) / sc, y: b.y - 1.15 }));
    const k = JSON.stringify(mine);
    if (!curtainCache.has(k)) curtainCache.set(k, curtainGeo(0.72, 2.26, mine));
    mesh.geometry = curtainCache.get(k);
    mesh.scale.set(sc, 1, 1);
    mesh.position.set(cx, 1.15, -2.7);
  });
}

// ---------------------------------------------------------------------------
export function buildKidsRoom(M, X) {
  const g = new THREE.Group(); g.position.x = X;
  const S = { root: g };
  const add = (m) => (g.add(m), m);
  const WP = { uv: 'world', density: 1.5 };
  add(at(bx(4.2, 0.1, 4.2, M.floor, { uv: 'world', density: 0.5 }), 0, -0.05, -0.7));
  add(at(bx(4.2, 0.1, 4.2, M.ceiling), 0, 2.65, -0.7));
  // back wall with window x -0.4..0.4 y 1.0..1.9
  add(at(bx(4.2, 1.0, 0.1, M.kidWall, WP), 0, 0.5, -2.75));
  add(at(bx(1.7, 1.7, 0.1, M.kidWall, WP), -1.25, 1.85, -2.75));
  add(at(bx(1.7, 1.7, 0.1, M.kidWall, WP), 1.25, 1.85, -2.75));
  add(at(bx(0.8, 0.8, 0.1, M.kidWall, WP), 0, 2.3, -2.75));
  add(at(bx(4.2, 0.1, 0.03, M.trim), 0, 0.05, -2.69));
  for (const s of [-1, 1]) add(at(bx(0.1, 2.7, 4.2, M.kidWall, WP), s * 2.1, 1.35, -0.7));
  add(at(bx(0.9, 0.045, 0.18, M.trim), 0, 1.0, -2.66));
  for (const s of [-1, 1]) add(at(bx(0.06, 0.96, 0.14, M.trim), s * 0.42, 1.45, -2.72));
  add(at(bx(0.9, 0.06, 0.14, M.trim), 0, 1.92, -2.72));
  add(at(bx(0.03, 0.9, 0.05, M.trim), 0, 1.45, -2.76));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), M.skyNight); sky.position.set(0.1, 1.4, -3.8); add(sky);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(curtainGeo(0.4, 1.3), M.curtainPink); c.position.set(s * 0.62, 1.3, -2.6); c.castShadow = true; add(c);
  }
  // two small beds
  S.kidPos = [];
  for (const [i, x] of [[0, -0.75], [1, 0.75]]) {
    const frame = i ? M.kidBedB : M.kidBedA, blanket = i ? M.blanketB : M.blanketA;
    add(at(bx(0.86, 0.12, 1.5, frame), x, 0.3, -1.9));
    add(at(bx(0.8, 0.14, 1.44, M.mattress), x, 0.43, -1.9));
    add(at(bx(0.9, 0.7, 0.06, frame), x, 0.55, -2.65));
    for (const [dx, dz] of [[-0.38, -2.6], [0.38, -2.6], [-0.38, -1.2], [0.38, -1.2]]) add(at(bx(0.06, 0.26, 0.06, frame), x + dx, 0.13, dz));
    add(at(bx(0.84, 0.12, 1.0, blanket, { uv: 'world', density: 2 }), x, 0.55, -1.62));
    for (const s of [-1, 1]) add(at(bx(0.03, 0.25, 1.0, blanket, { uv: 'world', density: 2 }), x + s * 0.425, 0.45, -1.62));
    const p = shade(new THREE.Mesh(pillowGeo(0.6, 0.15, 0.34), M.pillow)); p.position.set(x, 0.56, -2.38); add(p);
    S.kidPos.push(new THREE.Vector3(x + X, 0.72, -2.3));
  }
  // nightstand + moon nightlight
  add(at(bx(0.36, 0.42, 0.34, M.nightstand), 0, 0.21, -2.45));
  const moon = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.035, 5, 10, Math.PI * 1.3), M.nightlight); at(moon, 0, 0.55, -2.45, 0, 0, 0.6); add(moon);
  // teddy bear
  const ted = new THREE.Group(); ted.position.set(1.45, 0, -1.2); add(ted);
  ted.add(at(bx(0.22, 0.24, 0.16, M.teddy), 0, 0.14, 0));
  ted.add(at(bx(0.18, 0.16, 0.15, M.teddy), 0, 0.33, 0.01));
  for (const s of [-1, 1]) { ted.add(at(bx(0.06, 0.06, 0.04, M.teddy), s * 0.08, 0.42, 0)); ted.add(at(bx(0.07, 0.07, 0.14, M.teddy), s * 0.08, 0.04, 0.06)); }
  ted.add(at(bx(0.06, 0.05, 0.04, M.trim), 0, 0.31, 0.09));
  ted.rotation.y = -0.6;
  return S;
}

// ---------------------------------------------------------------------------
export function buildJail(M, X) {
  const g = new THREE.Group(); g.position.x = X;
  const S = { root: g };
  const add = (m) => (g.add(m), m);
  // station room
  add(at(bx(6, 0.1, 5, M.floorDark, { uv: 'world', density: 0.6 }), 0, -0.05, 0));
  add(at(bx(6, 3, 0.1, M.stationWall, { uv: 'world', density: 1 }), 0, 1.5, -1.7));
  add(at(bx(1.0, 0.7, 0.03, M.cork), 0.55, 1.65, -1.64));
  const R = rng(5);
  for (let i = 0; i < 5; i++) add(at(bx(0.16 + R() * 0.08, 0.2 + R() * 0.06, 0.006, M.paperWhite), 0.2 + i * 0.17, 1.6 + (R() - 0.5) * 0.3, -1.62, 0, 0, (R() - 0.5) * 0.2));
  add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), M.notepad), 0.95, 1.7, -1.615, 0, 0, 0.06));
  // desk
  add(at(bx(2.4, 0.06, 1.4, M.desk, { uv: 'world', density: 0.8 }), 0, 0.8, -0.3));
  add(at(bx(2.3, 0.75, 1.3, M.table), 0, 0.39, -0.3));
  // tiny cell
  const cell = new THREE.Group(); cell.position.set(0, 0.83, -0.4); add(cell); S.cell = cell;
  const BR = { uv: 'world', density: 3.2 };
  cell.add(at(bx(0.58, 0.03, 0.44, M.stone), 0, 0.015, 0));
  cell.add(at(bx(0.58, 0.46, 0.03, M.bricks, BR), 0, 0.26, -0.205));
  for (const s of [-1, 1]) cell.add(at(bx(0.03, 0.46, 0.44, M.bricks, BR), s * 0.275, 0.26, 0));
  cell.add(at(bx(0.62, 0.035, 0.48, M.stone), 0, 0.505, 0));
  // little barred window on the back wall
  cell.add(at(bx(0.11, 0.08, 0.035, M.interior), -0.12, 0.36, -0.19));
  for (let i = 0; i < 3; i++) cell.add(at(cyl(0.004, 0.004, 0.08, 5, M.iron), -0.15 + i * 0.03, 0.36, -0.17));
  // bars
  for (let i = 0; i < 9; i++) cell.add(at(cyl(0.006, 0.006, 0.46, 6, M.iron), -0.24 + i * 0.06, 0.26, 0.205));
  for (const y of [0.04, 0.2, 0.48]) cell.add(at(bx(0.56, 0.014, 0.014, M.iron), 0, y, 0.205));
  cell.add(at(bx(0.03, 0.03, 0.02, M.iron), 0.215, 0.24, 0.215));
  // bench
  cell.add(at(bx(0.18, 0.02, 0.09, M.bedWood), 0.16, 0.09, -0.12));
  for (const s of [-1, 1]) cell.add(at(bx(0.015, 0.06, 0.08, M.bedWood), 0.16 + s * 0.07, 0.05, -0.12));
  // mug, donut, pencil for scale
  const mug = new THREE.Group(); mug.position.set(0.55, 0.83, -0.35); add(mug);
  mug.add(at(cyl(0.1, 0.095, 0.22, 14, M.mug), 0, 0.11, 0));
  mug.add(at(cyl(0.088, 0.088, 0.01, 14, M.mugIn), 0, 0.205, 0));
  mug.add(at(shade(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 10), M.mug)), 0.11, 0.11, 0, 0, 0, Math.PI / 2));
  const dn = new THREE.Group(); dn.position.set(-0.5, 0.835, -0.15); add(dn);
  dn.add(at(bx(0.3, 0.004, 0.3, M.paperWhite), 0, 0.002, 0, 0, 0.3, 0));
  dn.add(at(shade(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.035, 6, 12), M.donut)), 0, 0.035, 0, Math.PI / 2, 0, 0));
  dn.add(at(shade(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.036, 6, 12, Math.PI * 2), M.icing)), 0, 0.045, 0, Math.PI / 2, 0, 0)).scale.set(1, 1, 0.55);
  const pen = new THREE.Group(); pen.position.set(0.25, 0.845, 0.1); pen.rotation.y = 0.4; add(pen);
  pen.add(at(cyl(0.013, 0.013, 0.36, 6, M.pencil), 0, 0, 0, 0, 0, Math.PI / 2));
  pen.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.04, 6), M.bedWood), 0.2, 0, 0, 0, 0, -Math.PI / 2));
  pen.add(at(cyl(0.014, 0.014, 0.03, 6, M.eraser), -0.195, 0, 0, 0, 0, Math.PI / 2));
  // desk lamp
  const lamp = new THREE.Group(); lamp.position.set(-0.75, 0.83, -0.75); add(lamp);
  lamp.add(at(cyl(0.1, 0.12, 0.03, 10, M.iron), 0, 0.015, 0));
  lamp.add(at(cyl(0.012, 0.012, 0.45, 6, M.iron), 0, 0.24, 0, 0, 0, 0.35));
  lamp.add(at(cyl(0.06, 0.14, 0.14, 8, M.std('#2f6b4f'), true), 0.12, 0.45, 0.08, 0.5, 0, -0.6));
  return S;
}
