// The house: living room (z 0..5.2) + open-plan kitchen (z -4.4..0). Units are metres, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from '../lib/textures.js';
import { mulberry32 } from '../lib/util.js';

export const ROOM = { x0: -3.2, x1: 3.2, zk: -4.4, zf: 5.2, h: 2.7 };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

function rbox(w, h, d, r = 0.03, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)); }

function add(parent, geo, material, x = 0, y = 0, z = 0, { cast = true, receive = true, ry = 0, rx = 0, rz = 0, name } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = receive;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export function buildHouse(scene) {
  const refs = {};
  const g = new THREE.Group();
  scene.add(g);

  // ---------- textures & materials ----------
  const wood = T.woodPlanks({ seed: 3 });
  wood.map.repeat.set(3, 3); wood.bump.repeat.set(3, 3);
  const M = {
    floor: std(0xffffff, { map: wood.map, bumpMap: wood.bump, bumpScale: 1.2, roughness: 0.55 }),
    kfloor: std(0xffffff, { map: T.floorTiles({}), roughness: 0.45 }),
    wallLiving: std(0xffffff, { map: T.plaster({ base: 0x7f9696, seed: 21 }), roughness: 0.92 }),
    wallKitchen: std(0xffffff, { map: T.plaster({ base: 0xd6c9b0, seed: 22, amt: 0.04 }), roughness: 0.9 }),
    ceiling: std(0x7d8486, { roughness: 1 }),
    trim: std(0xece6da, { roughness: 0.6 }),
    sofa: null,
    teak: std(0xffffff, { map: T.woodGrain({ base: 0x9c6b3e, seed: 31 }), roughness: 0.5 }),
    darkWood: std(0xffffff, { map: T.woodGrain({ base: 0x5e3b22, seed: 32 }), roughness: 0.55 }),
    butcher: std(0xffffff, { map: T.woodGrain({ base: 0xc49260, seed: 33, rings: 14 }), roughness: 0.5 }),
    cabinet: std(0xe4ded2, { roughness: 0.42 }),
    steel: null,
    blackGlass: std(0x101114, { roughness: 0.15, metalness: 0.2 }),
    brass: std(0xb08d57, { roughness: 0.35, metalness: 0.9 }),
    plasticDark: std(0x1b1c1f, { roughness: 0.5 }),
  };
  const fab = T.weave({ base: 0x8b8e93, seed: 41 });
  M.sofa = std(0xffffff, { map: fab.map, bumpMap: fab.bump, bumpScale: 0.6, roughness: 0.95 });
  const st = T.brushed({ seed: 51 });
  M.steel = std(0xffffff, { map: st.map, roughnessMap: st.rough, roughness: 1, metalness: 0.92 });
  refs.materials = M;

  // ---------- shell ----------
  const W = ROOM.x1 - ROOM.x0;
  const floorL = add(g, new THREE.PlaneGeometry(W, ROOM.zf), M.floor, 0, 0, ROOM.zf / 2, { rx: -Math.PI / 2, cast: false });
  floorL.material.map.repeat.set(2.2, 1.8);
  add(g, new THREE.PlaneGeometry(W, -ROOM.zk), M.kfloor, 0, 0.001, ROOM.zk / 2, { rx: -Math.PI / 2, cast: false });
  add(g, new THREE.PlaneGeometry(W, ROOM.zf - ROOM.zk), M.ceiling, 0, ROOM.h, (ROOM.zf + ROOM.zk) / 2, { rx: Math.PI / 2, cast: false });
  // walls (living part teal-grey, kitchen part cream)
  const wall = (w, h, mat, x, y, z, ry) => add(g, new THREE.PlaneGeometry(w, h), mat, x, y, z, { ry, cast: false });
  wall(W, ROOM.h, M.wallKitchen, 0, ROOM.h / 2, ROOM.zk, 0);
  wall(W, ROOM.h, M.wallLiving, 0, ROOM.h / 2, ROOM.zf, Math.PI);
  wall(ROOM.zf, ROOM.h, M.wallLiving, ROOM.x0, ROOM.h / 2, ROOM.zf / 2, Math.PI / 2);
  wall(ROOM.zf, ROOM.h, M.wallLiving, ROOM.x1, ROOM.h / 2, ROOM.zf / 2, -Math.PI / 2);
  wall(-ROOM.zk, ROOM.h, M.wallKitchen, ROOM.x0, ROOM.h / 2, ROOM.zk / 2, Math.PI / 2);
  wall(-ROOM.zk, ROOM.h, M.wallKitchen, ROOM.x1, ROOM.h / 2, ROOM.zk / 2, -Math.PI / 2);
  // baseboards
  const bb = (w, x, z, ry) => add(g, new THREE.BoxGeometry(w, 0.09, 0.015), M.trim, x, 0.045, z, { ry, cast: false });
  bb(W, 0, ROOM.zf - 0.008, 0); bb(ROOM.zf, ROOM.x0 + 0.008, ROOM.zf / 2, Math.PI / 2); bb(ROOM.zf, ROOM.x1 - 0.008, ROOM.zf / 2, Math.PI / 2);
  // soft beam marking the open-plan boundary
  add(g, new THREE.BoxGeometry(W, 0.16, 0.22), M.trim, 0, ROOM.h - 0.08, -0.05, { cast: false });

  buildLiving(g, M, refs);
  buildKitchen(g, M, refs);
  buildLights(scene, refs);
  return refs;
}

// ======================================================================= LIVING ROOM
function buildLiving(g, M, refs) {
  // rug
  add(g, new THREE.PlaneGeometry(2.7, 1.9), std(0xffffff, { map: T.rug({}), roughness: 1 }), 0, 0.006, 2.75, { rx: -Math.PI / 2, cast: false });

  // sofa (faces +z, towards the TV)
  const sofa = new THREE.Group();
  sofa.position.set(0, 0, 1.55);
  g.add(sofa);
  const S = M.sofa;
  add(sofa, rbox(2.3, 0.24, 0.95, 0.06), S, 0, 0.19, 0);
  add(sofa, rbox(2.3, 0.62, 0.22, 0.08), S, 0, 0.55, -0.37);
  for (const sx of [-1, 1]) {
    add(sofa, rbox(0.22, 0.6, 0.95, 0.09), S, sx * 1.04, 0.36, 0);
    add(sofa, rbox(0.98, 0.17, 0.78, 0.07), S, sx * 0.47, 0.385, 0.07);
    add(sofa, rbox(0.98, 0.5, 0.2, 0.09), S, sx * 0.47, 0.64, -0.24, { rx: -0.17 });
  }
  for (const [lx, lz] of [[-1.08, -0.4], [1.08, -0.4], [-1.08, 0.4], [1.08, 0.4]])
    add(sofa, new THREE.CylinderGeometry(0.025, 0.018, 0.08, 10), M.darkWood, lx, 0.04, lz);
  // throw pillows
  const pillow = (c, x, y, z, ry, rz) => add(sofa, rbox(0.44, 0.42, 0.14, 0.07, 4), std(c, { roughness: 0.95, map: T.weave({ base: 0xffffff, seed: 47, contrast: 0.2 }).map }), x, y, z, { ry, rz, rx: -0.25 });
  pillow(0x5f8f8c, -0.83, 0.68, -0.1, 0.35, 0.12);
  pillow(0xd9a441, 0.86, 0.66, -0.12, -0.4, -0.1);
  pillow(0xede3cf, -0.55, 0.64, -0.14, 0.12, -0.08);
  // knit blanket draped over the backrest
  const kn = T.knit({ base: 0xd7b98a, seed: 61 });
  const blanket = new THREE.Mesh(drapeGeometry(), std(0xffffff, { map: kn.map, bumpMap: kn.bump, bumpScale: 0.8, roughness: 1, side: THREE.DoubleSide }));
  blanket.position.set(0.55, 0.86, -0.37);
  blanket.castShadow = blanket.receiveShadow = true;
  sofa.add(blanket);
  refs.sofa = sofa;

  // phone on the seat (screen texture set by ui/phone module)
  const phone = new THREE.Group();
  phone.position.set(-0.46, 0.478, 1.66);
  phone.rotation.set(0, 0.35, 0);
  add(phone, rbox(0.078, 0.009, 0.16, 0.008), std(0x1d1f24, { roughness: 0.35, metalness: 0.5 }), 0, 0, 0);
  const screen = add(phone, new THREE.PlaneGeometry(0.07, 0.152), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }), 0, 0.0051, 0, { rx: -Math.PI / 2, cast: false });
  g.add(phone);
  refs.phone = phone; refs.phoneScreen = screen;

  // coffee table + popcorn
  const table = new THREE.Group();
  table.position.set(0, 0, 2.75);
  g.add(table);
  add(table, rbox(1.12, 0.055, 0.62, 0.02), M.teak, 0, 0.42, 0);
  add(table, rbox(1.0, 0.03, 0.5, 0.01), M.teak, 0, 0.12, 0);
  for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]])
    add(table, new THREE.CylinderGeometry(0.022, 0.016, 0.4, 10), M.darkWood, lx, 0.2, lz);
  const bowlPts = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; bowlPts.push(new THREE.Vector2(0.04 + Math.sin(a) * 0.13, 0.0 + (1 - Math.cos(a)) * 0.1)); }
  const bowl = add(table, new THREE.LatheGeometry(bowlPts, 32), std(0x4f8a86, { roughness: 0.35, side: THREE.DoubleSide }), 0.05, 0.448, -0.06);
  const pop = new THREE.Group();
  pop.position.copy(bowl.position);
  table.add(pop);
  const rnd = mulberry32(77);
  const popGeo = new THREE.IcosahedronGeometry(0.022, 1);
  const popMat = std(0xf3e2b0, { roughness: 0.8 });
  for (let i = 0; i < 70; i++) {
    const r = Math.sqrt(rnd()) * 0.13, a = rnd() * Math.PI * 2;
    const h = 0.07 + (1 - r / 0.13) * 0.045 + rnd() * 0.015;
    const p = add(pop, popGeo, popMat, Math.cos(a) * r, h, Math.sin(a) * r, { cast: false });
    p.scale.set(0.8 + rnd() * 0.6, 0.7 + rnd() * 0.5, 0.8 + rnd() * 0.6);
    p.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  }
  add(table, rbox(0.05, 0.02, 0.17, 0.008), M.plasticDark, -0.36, 0.457, 0.06, { ry: -0.4 });
  add(table, new THREE.CylinderGeometry(0.04, 0.036, 0.09, 20), std(0xe8dcc4, { roughness: 0.4 }), 0.42, 0.492, 0.12);

  // TV console + TV (screen faces -z)
  add(g, rbox(1.9, 0.48, 0.42, 0.02), M.darkWood, 0, 0.27, 4.96);
  for (const dx of [-0.48, 0.48]) add(g, rbox(0.9, 0.38, 0.01, 0.005), M.teak, dx, 0.28, 4.745, { cast: false });
  for (const [lx, lz] of [[-0.88, 4.8], [0.88, 4.8], [-0.88, 5.12], [0.88, 5.12]])
    add(g, new THREE.CylinderGeometry(0.02, 0.014, 0.06, 8), M.darkWood, lx, 0.03, lz);
  const tv = new THREE.Group();
  tv.position.set(0, 0.97, 4.98);
  g.add(tv);
  add(tv, rbox(1.38, 0.8, 0.05, 0.01), std(0x0c0c0e, { roughness: 0.3, metalness: 0.3 }), 0, 0, 0);
  add(tv, new THREE.BoxGeometry(0.06, 0.14, 0.12), std(0x0c0c0e, { roughness: 0.4 }), 0, -0.45, 0.02);
  add(tv, new THREE.BoxGeometry(0.4, 0.015, 0.2), std(0x0c0c0e, { roughness: 0.4 }), 0, -0.51, 0.0);
  refs.tvGroup = tv;
  refs.tvScreenSize = [1.34, 0.755];

  // floor lamp next to the sofa
  const lamp = new THREE.Group();
  lamp.position.set(-1.62, 0, 1.18);
  g.add(lamp);
  add(lamp, new THREE.CylinderGeometry(0.16, 0.17, 0.03, 32), M.brass, 0, 0.015, 0);
  add(lamp, new THREE.CylinderGeometry(0.012, 0.012, 1.42, 12), M.brass, 0, 0.72, 0);
  const shadePts = [new THREE.Vector2(0.24, 0), new THREE.Vector2(0.18, 0.3)];
  const shade = add(lamp, new THREE.LatheGeometry(shadePts, 40), std(0xf1e6cf, { side: THREE.DoubleSide, roughness: 0.9, emissive: new THREE.Color(0xffb468), emissiveIntensity: 0.0 }), 0, 1.36, 0, { cast: false });
  refs.lampShade = shade; refs.lampPos = new THREE.Vector3(-1.62, 1.45, 1.18);

  // left wall: window + curtains
  const win = new THREE.Group();
  win.position.set(-3.19, 1.5, 2.9);
  win.rotation.y = Math.PI / 2;
  g.add(win);
  add(win, new THREE.PlaneGeometry(1.3, 1.45), new THREE.MeshBasicMaterial({ map: T.nightYard({ seed: 14 }), color: 0x8090a8 }), 0, 0, 0.004, { cast: false, receive: false });
  const fr = M.trim;
  add(win, new THREE.BoxGeometry(1.42, 0.06, 0.06), fr, 0, 0.75, 0.02); add(win, new THREE.BoxGeometry(1.42, 0.08, 0.1), fr, 0, -0.75, 0.04);
  add(win, new THREE.BoxGeometry(0.06, 1.5, 0.06), fr, -0.68, 0, 0.02); add(win, new THREE.BoxGeometry(0.06, 1.5, 0.06), fr, 0.68, 0, 0.02);
  add(win, new THREE.BoxGeometry(0.03, 1.45, 0.03), fr, 0, 0, 0.02); add(win, new THREE.BoxGeometry(1.3, 0.03, 0.03), fr, 0, 0.1, 0.02);
  add(win, new THREE.CylinderGeometry(0.015, 0.015, 2.0, 10), M.brass, 0, 1.0, 0.16, { rz: Math.PI / 2 });
  refs.curtains = [];
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.62, 2.4, 24, 30);
    geo.userData.base = geo.attributes.position.array.slice();
    const mat = std(0x262c40, { side: THREE.DoubleSide, roughness: 0.85, map: T.weave({ base: 0xffffff, seed: 71, contrast: 0.25, scale: 2 }).map });
    const c = add(win, geo, mat, side * 0.66, -0.2, 0.16, { cast: false });
    c.userData.side = side;
    refs.curtains.push(c);
  }

  // right wall: front door with frosted glass
  const door = new THREE.Group();
  door.position.set(3.19, 0, 3.95);
  door.rotation.y = -Math.PI / 2;
  g.add(door);
  const doorMat = std(0xe6dccb, { roughness: 0.55 });
  add(door, new THREE.BoxGeometry(0.96, 2.1, 0.05), doorMat, 0, 1.05, 0.03);
  for (const [px, py, pw, ph] of [[-0.22, 0.45, 0.32, 0.6], [0.22, 0.45, 0.32, 0.6]])
    add(door, rbox(pw, ph, 0.03, 0.01), doorMat, px, py, 0.06);
  add(door, new THREE.BoxGeometry(1.1, 0.08, 0.06), M.trim, 0, 2.14, 0.03); add(door, new THREE.BoxGeometry(0.07, 2.18, 0.06), M.trim, -0.515, 1.09, 0.03); add(door, new THREE.BoxGeometry(0.07, 2.18, 0.06), M.trim, 0.515, 1.09, 0.03);
  const glassC = T.canvas(256, 320);
  const glassTex = T.tex(glassC);
  const glass = add(door, new THREE.PlaneGeometry(0.56, 0.7), new THREE.MeshBasicMaterial({ map: glassTex, toneMapped: true }), 0, 1.42, 0.062, { cast: false, receive: false });
  add(door, new THREE.BoxGeometry(0.62, 0.035, 0.03), M.trim, 0, 1.785, 0.065); add(door, new THREE.BoxGeometry(0.62, 0.035, 0.03), M.trim, 0, 1.055, 0.065);
  add(door, new THREE.BoxGeometry(0.035, 0.76, 0.03), M.trim, -0.295, 1.42, 0.065); add(door, new THREE.BoxGeometry(0.035, 0.76, 0.03), M.trim, 0.295, 1.42, 0.065);
  add(door, new THREE.SphereGeometry(0.03, 16, 12), M.brass, 0.38, 1.0, 0.09);
  add(door, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), M.brass, 0.38, 1.0, 0.065, { rx: Math.PI / 2 });
  add(door, new THREE.BoxGeometry(0.03, 0.06, 0.02), M.brass, 0.38, 1.13, 0.065);
  add(door, new THREE.PlaneGeometry(0.9, 0.55), std(0x6b5a45, { roughness: 1 }), 0, 0.007, 0.55, { rx: -Math.PI / 2, cast: false });
  refs.doorGlass = { canvas: glassC, tex: glassTex, mesh: glass };

  // TV wall: clock + family photo
  const clock = new THREE.Group();
  clock.position.set(0.98, 1.86, 5.17);
  clock.rotation.y = Math.PI;
  g.add(clock);
  add(clock, new THREE.TorusGeometry(0.175, 0.02, 12, 48), M.darkWood, 0, 0, 0);
  add(clock, new THREE.CircleGeometry(0.17, 48), std(0xffffff, { map: T.clockFace({}), roughness: 0.6 }), 0, 0, -0.005, { cast: false });
  const hand = (len, w, c, z) => {
    const h = new THREE.Group();
    h.position.z = z;
    add(h, new THREE.BoxGeometry(w, len, 0.004), std(c, { roughness: 0.4 }), 0, len / 2 - 0.02, 0, { cast: false });
    clock.add(h);
    return h;
  };
  refs.clock = { hour: hand(0.09, 0.012, 0x222222, 0.004), minute: hand(0.135, 0.008, 0x222222, 0.007), second: hand(0.15, 0.003, 0x8a6a3a, 0.01) };
  add(clock, new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), M.brass, 0, 0, 0.012, { rx: Math.PI / 2 });
  refs.clockGroup = clock;

  const photo = new THREE.Group();
  photo.position.set(-0.98, 1.66, 5.17);
  photo.rotation.y = Math.PI;
  g.add(photo);
  add(photo, rbox(0.36, 0.44, 0.03, 0.006), M.darkWood, 0, 0, 0);
  add(photo, new THREE.PlaneGeometry(0.3, 0.375), std(0xffffff, { map: T.familyPhoto({}), roughness: 0.3 }), 0, 0, 0.017, { cast: false });

  // plant in the corner
  const plant = new THREE.Group();
  plant.position.set(2.65, 0, 4.75);
  g.add(plant);
  add(plant, new THREE.CylinderGeometry(0.17, 0.13, 0.36, 24), std(0xd8cdb8, { roughness: 0.8 }), 0, 0.18, 0);
  const leafMat = std(0x3f6e4f, { roughness: 0.7 });
  const r2 = mulberry32(5);
  for (let i = 0; i < 16; i++) {
    const a = r2() * Math.PI * 2, h = 0.5 + r2() * 0.7, rr = 0.05 + r2() * 0.2;
    const l = add(plant, new THREE.SphereGeometry(0.1, 12, 8), leafMat, Math.cos(a) * rr, h, Math.sin(a) * rr);
    l.scale.set(0.6, 1.5, 0.25); l.rotation.set(r2() - 0.5, a, r2() - 0.5);
  }
}

function drapeGeometry() {
  // A knit blanket folded over the backrest: hangs to the front and to the back with soft folds.
  const W = 0.95, nu = 30, nv = 40;
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5; // 0..1
    const s = (v - 0.5) * 1.1; // arc length, 0 = top of backrest
    let y, z;
    const R = 0.12;
    if (Math.abs(s) < (Math.PI / 2) * R) { const a = s / R; y = Math.cos(a) * R; z = Math.sin(a) * R; }
    else { const sgn = Math.sign(s); const rest = Math.abs(s) - (Math.PI / 2) * R; y = -rest * (sgn > 0 ? 0.95 : 1.0); z = sgn * (R + rest * 0.12); }
    const fold = Math.sin(u * Math.PI * 5 + v * 2) * 0.012 * Math.min(1, Math.abs(s) * 4);
    p.setXYZ(i, (u - 0.5) * W, y - 0.02, z + fold);
  }
  geo.computeVertexNormals();
  return geo;
}

// ======================================================================= KITCHEN
function buildKitchen(g, M, refs) {
  const zw = -4.4;
  // base cabinets along the back wall: x -2.3 .. 2.2
  const runX0 = -2.3, runX1 = 2.2, depth = 0.6;
  const zc = zw + depth / 2;
  add(g, new THREE.BoxGeometry(runX1 - runX0, 0.1, depth - 0.06), std(0x2a2723), (runX0 + runX1) / 2, 0.05, zc - 0.03);
  const doorW = 0.5;
  for (let x = runX0; x < runX1 - 0.01; x += doorW) {
    const w = Math.min(doorW, runX1 - x);
    if (x > 0.2 && x < 0.95) continue; // oven goes here
    add(g, rbox(w - 0.012, 0.74, 0.04, 0.012), M.cabinet, x + w / 2, 0.47, zw + depth - 0.02);
    add(g, new THREE.BoxGeometry(0.012, 0.16, 0.018), M.steel, x + w - 0.07, 0.74, zw + depth + 0.012);
  }
  add(g, new THREE.BoxGeometry(runX1 - runX0, 0.78, depth - 0.05), M.cabinet, (runX0 + runX1) / 2, 0.49, zc - 0.03, { cast: false });
  // oven front (x 0.25..0.95)
  add(g, rbox(0.7, 0.74, 0.04, 0.01), M.steel, 0.6, 0.47, zw + depth - 0.02);
  add(g, new THREE.PlaneGeometry(0.5, 0.3), M.blackGlass, 0.6, 0.45, zw + depth + 0.002, { cast: false });
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.5, 8), M.steel, 0.6, 0.68, zw + depth + 0.03, { rz: Math.PI / 2 });
  for (let i = 0; i < 4; i++) add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14), M.plasticDark, 0.36 + i * 0.16, 0.8, zw + depth + 0.01, { rx: Math.PI / 2 });
  // countertop (butcher block)
  add(g, rbox(runX1 - runX0 + 0.04, 0.05, depth + 0.04, 0.01), M.butcher, (runX0 + runX1) / 2, 0.885, zc);
  // cooktop: black glass + burners with faint flame glow
  add(g, new THREE.BoxGeometry(0.66, 0.012, 0.5), M.blackGlass, 0.6, 0.915, zc + 0.02, { cast: false });
  refs.flames = [];
  for (const [bx, bz] of [[0.42, zc - 0.08], [0.78, zc + 0.13]]) {
    const ring = add(g, new THREE.TorusGeometry(0.06, 0.006, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.45, 1.6) }), bx, 0.925, bz, { rx: Math.PI / 2, cast: false, receive: false });
    refs.flames.push(ring);
  }
  // pot (right, stirred) with soup
  const potPts = [new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.125, 0.0), new THREE.Vector2(0.13, 0.01), new THREE.Vector2(0.13, 0.16), new THREE.Vector2(0.137, 0.165), new THREE.Vector2(0.123, 0.165), new THREE.Vector2(0.12, 0.02)];
  const pot = new THREE.Group();
  pot.position.set(0.78, 0.925, zc + 0.13);
  g.add(pot);
  add(pot, new THREE.LatheGeometry(potPts, 40), M.steel, 0, 0, 0);
  for (const s of [-1, 1]) add(pot, new THREE.TorusGeometry(0.03, 0.007, 8, 16, Math.PI), M.steel, s * 0.15, 0.13, 0, { ry: Math.PI / 2 * s, rz: 0 });
  add(pot, new THREE.CircleGeometry(0.12, 32), std(0xb5481f, { roughness: 0.25, emissive: new THREE.Color(0x3a1004), emissiveIntensity: 0.4 }), 0, 0.13, 0, { rx: -Math.PI / 2, cast: false });
  refs.pot = pot;
  refs.steamOrigin = new THREE.Vector3(0.78, 1.07, zc + 0.13);
  // pan (left) with sizzling bits
  const pan = new THREE.Group();
  pan.position.set(0.42, 0.925, zc - 0.08);
  g.add(pan);
  const panPts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.13, 0), new THREE.Vector2(0.15, 0.045), new THREE.Vector2(0.142, 0.047), new THREE.Vector2(0.124, 0.008)];
  add(pan, new THREE.LatheGeometry(panPts, 40), std(0x222326, { roughness: 0.35, metalness: 0.3 }), 0, 0, 0);
  add(pan, new THREE.CylinderGeometry(0.012, 0.014, 0.26, 10), M.steel, -0.25, 0.04, 0.06, { rz: Math.PI / 2 - 0.12, ry: -0.35 });
  const rb = mulberry32(19);
  for (let i = 0; i < 18; i++) {
    const a = rb() * Math.PI * 2, r = Math.sqrt(rb()) * 0.1;
    add(pan, new THREE.SphereGeometry(0.014 + rb() * 0.01, 8, 6), std([0x8c4a1f, 0x5f7f33, 0xd9852c][i % 3], { roughness: 0.4 }), Math.cos(a) * r, 0.012, Math.sin(a) * r, { cast: false });
  }
  // backsplash tiles
  const tl = T.subwayTiles({ seed: 12 });
  tl.map.repeat.set(4.5, 1.0); tl.bump.repeat.set(4.5, 1.0);
  add(g, new THREE.PlaneGeometry(runX1 - runX0, 0.64), std(0xffffff, { map: tl.map, bumpMap: tl.bump, bumpScale: 1.5, roughness: 0.32 }), (runX0 + runX1) / 2, 0.91 + 0.32, zw + 0.004, { cast: false });
  // range hood (steel) + light
  const hood = new THREE.Group();
  hood.position.set(0.6, 0, zw);
  g.add(hood);
  add(hood, trapezoidGeometry(0.72, 0.26, 0.48, 0.24, 0.2), M.steel, 0, 1.64, 0.24, { cast: false });
  add(hood, new THREE.BoxGeometry(0.26, 0.86, 0.24), M.steel, 0, 2.27, 0.12, { cast: false });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.6, 1.3) });
  refs.hoodBulbs = [add(hood, new THREE.CircleGeometry(0.025, 16), bulbMat, -0.18, 1.618, 0.32, { rx: Math.PI / 2, cast: false }), add(hood, new THREE.CircleGeometry(0.025, 16), bulbMat, 0.18, 1.618, 0.32, { rx: Math.PI / 2, cast: false })];
  refs.hoodBulbMat = bulbMat;
  // upper cabinet above the fridge only: the wall right of the hood stays clean for Mom's shadow
  add(g, rbox(0.88, 0.5, 0.4, 0.012), M.cabinet, -2.75, 2.25, zw + 0.2);
  // open shelf with jars on the far right (above the shadow zone)
  add(g, rbox(0.7, 0.035, 0.24, 0.006), M.butcher, 1.95, 2.15, zw + 0.12);
  for (const [jx, jc] of [[1.72, 0xe8b04a], [1.86, 0xd9cbb0], [2.0, 0x8fae7a], [2.16, 0xc9744a]])
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.13, 16), std(jc, { roughness: 0.35 }), jx, 2.235, zw + 0.12);
  // window over the sink
  const kw = new THREE.Group();
  kw.position.set(-1.5, 1.58, zw + 0.003);
  g.add(kw);
  add(kw, new THREE.PlaneGeometry(1.0, 0.82), new THREE.MeshBasicMaterial({ map: T.nightYard({ seed: 15 }), color: 0x7f8fa8 }), 0, 0, 0, { cast: false, receive: false });
  for (const [x, y, w, h] of [[0, 0.43, 1.1, 0.06], [0, -0.43, 1.14, 0.06], [-0.52, 0, 0.06, 0.9], [0.52, 0, 0.06, 0.9], [0, 0, 0.03, 0.82]])
    add(kw, new THREE.BoxGeometry(w, h, 0.05), M.trim, x, y, 0.02);
  // sink + faucet
  add(g, new THREE.BoxGeometry(0.62, 0.02, 0.42), std(0x3b3d41, { metalness: 0.7, roughness: 0.35 }), -1.5, 0.902, zc, { cast: false });
  const fau = new THREE.Group();
  fau.position.set(-1.5, 0.91, zw + 0.1);
  g.add(fau);
  add(fau, new THREE.CylinderGeometry(0.016, 0.02, 0.3, 12), M.steel, 0, 0.15, 0);
  add(fau, new THREE.TorusGeometry(0.08, 0.014, 10, 20, Math.PI), M.steel, 0, 0.3, 0.08, { ry: Math.PI / 2 });
  // fridge (steel, back-left corner)
  const fr = new THREE.Group();
  fr.position.set(-2.75, 0, zw + 0.37);
  g.add(fr);
  add(fr, rbox(0.86, 1.86, 0.72, 0.03), M.steel, 0, 0.93, 0);
  add(fr, new THREE.BoxGeometry(0.86, 0.01, 0.01), std(0x333333), 0, 1.3, 0.362);
  add(fr, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10), M.steel, 0.36, 1.05, 0.4);
  add(fr, new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), M.steel, 0.36, 1.52, 0.4);
  // kid drawing on the fridge
  const dc = T.canvas(256, 200);
  const dg = dc.getContext('2d');
  dg.fillStyle = '#fbf8f0'; dg.fillRect(0, 0, 256, 200);
  dg.lineWidth = 6; dg.strokeStyle = '#d9822b'; dg.beginPath(); dg.arc(70, 70, 26, 0, 6.3); dg.stroke();
  dg.strokeStyle = '#2b6cb0'; dg.beginPath(); dg.moveTo(70, 96); dg.lineTo(70, 150); dg.moveTo(40, 120); dg.lineTo(100, 120); dg.stroke();
  dg.strokeStyle = '#2f855a'; dg.beginPath(); dg.arc(170, 90, 18, 0, 6.3); dg.moveTo(170, 108); dg.lineTo(170, 150); dg.stroke();
  dg.fillStyle = '#f6ad55'; dg.beginPath(); dg.arc(225, 30, 18, 0, 6.3); dg.fill();
  add(fr, new THREE.PlaneGeometry(0.22, 0.17), std(0xffffff, { map: T.tex(dc) }), -0.12, 1.12, 0.364, { rz: 0.06, cast: false });

  // island (left) with cutting board
  const isl = new THREE.Group();
  isl.position.set(-1.25, 0, -2.0);
  g.add(isl);
  add(isl, rbox(1.5, 0.84, 0.78, 0.02), M.cabinet, 0, 0.44, 0);
  add(isl, rbox(1.6, 0.05, 0.88, 0.012), M.butcher, 0, 0.885, 0);
  add(isl, rbox(0.42, 0.025, 0.28, 0.01), M.teak, 0.18, 0.922, 0.05, { ry: 0.2 });
  const carrot = std(0xe8822c, { roughness: 0.5 });
  const rc = mulberry32(23);
  for (let i = 0; i < 9; i++) add(isl, new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14), carrot, 0.08 + rc() * 0.18, 0.939, 0.0 + rc() * 0.12, { cast: false });
  add(isl, new THREE.BoxGeometry(0.2, 0.004, 0.035), M.steel, 0.3, 0.938, 0.14, { ry: -0.5 });
  add(isl, new THREE.BoxGeometry(0.1, 0.018, 0.025), M.plasticDark, 0.42, 0.94, 0.2, { ry: -0.5 });
  // fruit bowl
  add(isl, new THREE.SphereGeometry(0.045, 14, 10), std(0xe0903a, { roughness: 0.4 }), -0.45, 0.955, -0.05);
  add(isl, new THREE.SphereGeometry(0.045, 14, 10), std(0xe8b04a, { roughness: 0.4 }), -0.38, 0.955, 0.03);
  add(isl, new THREE.SphereGeometry(0.045, 14, 10), std(0x7aa33f, { roughness: 0.4 }), -0.5, 0.955, 0.05);

  // small dining table + pendant (the kitchen key light hangs here)
  const tb = new THREE.Group();
  tb.position.set(2.35, 0, -2.25);
  g.add(tb);
  add(tb, new THREE.CylinderGeometry(0.46, 0.46, 0.04, 40), M.teak, 0, 0.74, 0);
  add(tb, new THREE.CylinderGeometry(0.04, 0.05, 0.72, 12), M.darkWood, 0, 0.37, 0);
  add(tb, new THREE.CylinderGeometry(0.22, 0.24, 0.025, 24), M.darkWood, 0, 0.0125, 0);
  for (const [cx, cz, ry] of [[-0.62, 0.1, Math.PI / 2], [0.1, 0.62, 0]]) {
    const ch = new THREE.Group();
    ch.position.set(cx, 0, cz);
    ch.rotation.y = ry;
    tb.add(ch);
    add(ch, rbox(0.42, 0.04, 0.42, 0.01), M.teak, 0, 0.45, 0);
    add(ch, rbox(0.42, 0.42, 0.03, 0.01), M.teak, 0, 0.7, 0.2);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) add(ch, new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8), M.darkWood, lx, 0.225, lz);
  }
  add(tb, new THREE.CylinderGeometry(0.004, 0.004, 1.0, 6), M.plasticDark, 0, 2.2, 0, { cast: false });
  const pendShadePts = [new THREE.Vector2(0.02, 0.2), new THREE.Vector2(0.06, 0.17), new THREE.Vector2(0.17, 0.02), new THREE.Vector2(0.18, 0)];
  add(tb, new THREE.LatheGeometry(pendShadePts, 32), std(0x2f4b48, { side: THREE.DoubleSide, roughness: 0.5 }), 0, 1.5, 0, { cast: false });
  refs.diningBulb = add(tb, new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1) }), 0, 1.53, 0, { cast: false, receive: false });
  // island pendant: the kitchen key light hangs here (casts Mom's shadow onto the right-hand wall)
  const ip = new THREE.Group();
  ip.position.set(-0.6, 0, -1.95);
  g.add(ip);
  add(ip, new THREE.CylinderGeometry(0.004, 0.004, 1.05, 6), M.plasticDark, 0, 2.18, 0, { cast: false });
  add(ip, new THREE.LatheGeometry(pendShadePts, 32), std(0x2f4b48, { side: THREE.DoubleSide, roughness: 0.5 }), 0, 1.48, 0, { cast: false });
  refs.pendantBulb = add(ip, new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.6) }), 0, 1.51, 0, { cast: false, receive: false });
}

function trapezoidGeometry(wBottom, wTop, dBottom, dTop, h) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const top = y > 0;
    p.setX(i, p.getX(i) * (top ? wTop : wBottom));
    p.setZ(i, p.getZ(i) * (top ? dTop : dBottom) - (top ? (dBottom - dTop) / 2 : 0));
    p.setY(i, y * h);
  }
  geo.computeVertexNormals();
  return geo;
}

// ======================================================================= LIGHTS
function buildLights(scene, refs) {
  const L = {};
  L.hemi = new THREE.HemisphereLight(0x405580, 0x1c1610, 0.4);
  scene.add(L.hemi);

  // Kitchen key: warm pendant over the dining table. Casts Mom's (frozen) shadow onto the tiled wall.
  L.key = new THREE.SpotLight(0xffc27a, 10, 9, 0.95, 0.55, 2);
  L.key.position.set(-0.6, 1.43, -1.95);
  L.key.target.position.set(1.15, 1.2, -4.4);
  L.key.castShadow = true;
  L.key.shadow.mapSize.set(2048, 2048);
  L.key.shadow.bias = -0.0004;
  L.key.shadow.normalBias = 0.02;
  L.key.shadow.camera.near = 0.2; L.key.shadow.camera.far = 8;
  scene.add(L.key, L.key.target);

  // Hood light down onto the stove
  L.hood = new THREE.SpotLight(0xffb45c, 3.2, 3, 0.9, 0.8, 2);
  L.hood.position.set(0.6, 1.6, -4.1);
  L.hood.target.position.set(0.6, 0.9, -4.0);
  scene.add(L.hood, L.hood.target);

  // Kitchen ceiling fill
  L.kfill = new THREE.PointLight(0xffd6a0, 1.3, 6, 2);
  L.kfill.position.set(0.5, 1.75, -2.2);
  scene.add(L.kfill);

  // TV glow: a wide, fully soft spot (cold blue-white, flickers with the picture)
  L.tvSpot = new THREE.SpotLight(0xa9c8ff, 14, 10, 1.2, 1.0, 2);
  L.tvSpot.position.set(0, 1.0, 4.85);
  L.tvSpot.target.position.set(0, 0.8, 1.0);
  L.tvSpot.castShadow = false; // one shadow pass (the kitchen key) keeps SwiftShader renders affordable
  scene.add(L.tvSpot, L.tvSpot.target);

  // TV spill: the glow that washes the wall around the screen (clock + family photo flicker with the picture)
  L.tvSpill = new THREE.PointLight(0xa9c8ff, 1, 2.6, 2);
  L.tvSpill.position.set(0, 1.45, 4.85);
  scene.add(L.tvSpill);

  // Floor lamp (dim warm accent)
  L.lamp = new THREE.PointLight(0xffb468, 1.5, 3.5, 2);
  L.lamp.position.copy(refs.lampPos);
  scene.add(L.lamp);


  refs.lights = L;
}
