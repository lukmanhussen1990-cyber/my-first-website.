// NIGHT OWL BURGERS: interior, glass facade, kitchen.
// Layout (metres): interior x -7..7, z -4..5 (front glass at z = 5), ceiling 3.2.
// Front counter z -1.6..-0.9 (top 1.05); kitchen line at z = -3.3; fridge centred x = -1.4.
import * as THREE from 'three';
import { mesh, group, rbox, glowMaterial, canvasTexture, mulberry32 } from './util.js';
export { canvasTexture };
import * as TX from './textures.js';
import { addReflection } from './reflect.js';

export const LAYOUT = {
  frontZ: 5.0,
  backZ: -4.0,
  ceiling: 3.2,
  counter: { z0: -1.6, z1: -0.9, x0: -5.6, x1: 1.8, top: 1.05 },
  fridge: { x: -1.4, w: 0.82, h: 2.02, frontZ: -3.3, depth: 0.78 },
  door: { x0: 2.25, x1: 3.25, lock: new THREE.Vector3(3.12, 1.02, 4.965) },
  windowSill: 0.5,
  windowTop: 2.7,
};

export function buildRestaurant(scene, { floorRefl, fridgeRefl, envInterior }) {
  const R = { lights: {}, menu: [], panels: [], glass: [], refs: {} };
  const root = group(scene, { name: 'restaurant' });
  const L = LAYOUT;

  // ---------- materials ----------
  const floorTx = TX.floorTextures();
  floorTx.map.repeat.set(14 / 2.4, 9 / 2.4);
  floorTx.roughness.repeat.copy(floorTx.map.repeat);
  floorTx.map.wrapS = floorTx.map.wrapT = floorTx.roughness.wrapS = floorTx.roughness.wrapT = THREE.RepeatWrapping;
  const floorMat = addReflection(
    new THREE.MeshStandardMaterial({ map: floorTx.map, roughnessMap: floorTx.roughness, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.5 }),
    floorRefl,
    { strength: 1.0, blur: 0.6, fresnel: 0.16, roughBlur: 4.5, distort: 0.0 }
  );
  const wallTx = TX.wallTileTextures();
  const wallTileMat = (w, h) => {
    const m = wallTx.map.clone();
    const r = wallTx.roughness.clone();
    for (const t of [m, r]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 0.8, h / 0.8);
      t.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({ map: m, roughnessMap: r, roughness: 1, envMapIntensity: 0.9 });
  };
  const paintTx = TX.paintTexture();
  paintTx.wrapS = paintTx.wrapT = THREE.RepeatWrapping;
  const paintMat = new THREE.MeshStandardMaterial({ map: paintTx, roughness: 0.85, envMapIntensity: 0.6 });
  const ceilTx = TX.ceilingTexture();
  ceilTx.wrapS = ceilTx.wrapT = THREE.RepeatWrapping;
  ceilTx.repeat.set(14 / 1.2, 9 / 1.2);
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTx, roughness: 0.95, envMapIntensity: 0.4 });
  const brushed = TX.brushedTexture();
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d1d6, metalness: 1.0, roughness: 0.32, roughnessMap: brushed, envMapIntensity: 1.0 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x8a949b, metalness: 1.0, roughness: 0.4, roughnessMap: brushed, envMapIntensity: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 1.0, roughness: 0.12, envMapIntensity: 1.2 });
  const vinyl = new THREE.MeshPhysicalMaterial({ color: 0x0f5a5e, roughness: 0.42, clearcoat: 1.0, clearcoatRoughness: 0.12, envMapIntensity: 1.0 });
  const vinylCream = new THREE.MeshPhysicalMaterial({ color: 0xe9dfc8, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const laminate = new THREE.MeshPhysicalMaterial({ color: 0xe8e4da, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const tealPaint = new THREE.MeshStandardMaterial({ color: 0x0e4a50, roughness: 0.55 });
  const navyPaint = new THREE.MeshStandardMaterial({ color: 0x0c1626, roughness: 0.6 });
  const amberPaint = new THREE.MeshStandardMaterial({ color: 0xe3912f, roughness: 0.5 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.45 });
  const frameMetal = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.8, roughness: 0.35 });
  R.mats = { steel, steelDark, chrome, vinyl, laminate, blackPlastic, frameMetal, tealPaint, navyPaint };

  // ---------- floor / ceiling / walls ----------
  const floor = mesh(new THREE.PlaneGeometry(14, 9), floorMat, { rx: -Math.PI / 2, z: 0.5, parent: root, cast: false });
  floor.name = 'floor';
  R.floor = floor;
  mesh(new THREE.PlaneGeometry(14, 9), ceilMat, { rx: Math.PI / 2, y: L.ceiling, z: 0.5, parent: root, cast: false });

  // side walls: tiles below 1.25, paint above
  for (const side of [-1, 1]) {
    const x = side * 7;
    mesh(new THREE.PlaneGeometry(9, 1.25), wallTileMat(9, 1.25), { x, y: 0.625, z: 0.5, ry: -side * Math.PI / 2, parent: root, cast: false });
    const up = mesh(new THREE.PlaneGeometry(9, L.ceiling - 1.25), paintMat, { x, y: 1.25 + (L.ceiling - 1.25) / 2, z: 0.5, ry: -side * Math.PI / 2, parent: root, cast: false });
    up.material = paintMat;
    mesh(rbox(0.04, 0.05, 9, 0.01), chrome, { x: x - side * 0.02, y: 1.25, z: 0.5, parent: root, cast: false });
  }
  // back wall (kitchen) - steel panels
  const backSteel = new THREE.MeshStandardMaterial({ color: 0xaab3ba, metalness: 1.0, roughness: 0.38, roughnessMap: brushed, envMapIntensity: 0.8 });
  mesh(new THREE.PlaneGeometry(14, L.ceiling), backSteel, { y: L.ceiling / 2, z: L.backZ, parent: root, cast: false });
  for (let i = -6; i <= 6; i += 1.2) mesh(new THREE.BoxGeometry(0.02, L.ceiling, 0.02), steelDark, { x: i, y: L.ceiling / 2, z: L.backZ + 0.01, parent: root, cast: false });
  // partition wall right of the kitchen passage
  mesh(new THREE.BoxGeometry(4.2, L.ceiling, 0.12), paintMat, { x: 4.9, y: L.ceiling / 2, z: -1.3, parent: root });
  mesh(new THREE.BoxGeometry(4.2, 1.25, 0.13), wallTileMat(4.2, 1.25), { x: 4.9, y: 0.625, z: -1.3, parent: root });

  // ---------- ceiling troffers (fluorescent) ----------
  const panelMat = glowMaterial(0xeaf4ff, 5.5);
  const louver = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.6, roughness: 0.3 });
  const troffers = [
    [-4.8, 3.2], [-1.6, 3.2], [1.6, 3.2], [4.8, 3.2],
    [-4.8, 0.6], [-1.6, 0.6], [1.6, 0.6], [4.8, 0.6],
    [-4.2, -2.5], [-1.4, -2.5], [1.2, -2.5],
  ];
  troffers.forEach(([x, z], i) => {
    const g = group(root, { x, y: L.ceiling - 0.005, z });
    const pm = panelMat.clone();
    mesh(new THREE.PlaneGeometry(1.15, 0.55), pm, { rx: Math.PI / 2, parent: g, cast: false, receive: false });
    mesh(new THREE.BoxGeometry(1.24, 0.03, 0.64), louver, { y: 0.01, parent: g, cast: false });
    for (let k = -2; k <= 2; k++) mesh(new THREE.BoxGeometry(0.01, 0.025, 0.55), louver, { x: k * 0.23, y: -0.01, parent: g, cast: false });
    R.panels.push({ mat: pm, base: pm.color.clone(), x, z, kitchen: z < -1 });
  });

  // ---------- front facade: sill, mullions, glass, door ----------
  const fz = L.frontZ;
  mesh(new THREE.BoxGeometry(14, L.windowSill, 0.25), wallTileMat(14, L.windowSill), { y: L.windowSill / 2, z: fz + 0.05, parent: root });
  mesh(new THREE.BoxGeometry(14, L.ceiling - L.windowTop, 0.3), paintMat, { y: (L.ceiling + L.windowTop) / 2, z: fz + 0.05, parent: root });
  mesh(rbox(14, 0.06, 0.32, 0.01), chrome, { y: L.windowSill, z: fz, parent: root });
  const mullX = [-7, -4.7, -2.4, -0.1, 2.2, 3.3, 5.15, 7];
  for (const x of mullX) mesh(new THREE.BoxGeometry(0.09, L.windowTop - L.windowSill, 0.14), frameMetal, { x, y: (L.windowTop + L.windowSill) / 2, z: fz, parent: root });
  mesh(new THREE.BoxGeometry(14, 0.08, 0.14), frameMetal, { y: L.windowTop, z: fz, parent: root });

  const smudge = TX.glassSmudgeTexture();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8d4d8, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.1,
    roughnessMap: null, alphaMap: null, envMapIntensity: 1.6, specularIntensity: 1.0, depthWrite: false,
  });
  const smudgeMat = new THREE.MeshBasicMaterial({ color: 0x9fb2b8, alphaMap: smudge, transparent: true, opacity: 0.16, depthWrite: false });
  const bays = [[-7, -4.7], [-4.7, -2.4], [-2.4, -0.1], [-0.1, 2.2], [3.3, 5.15], [5.15, 7]];
  for (const [a, b] of bays) {
    const w = b - a - 0.09;
    const h = L.windowTop - L.windowSill - 0.04;
    const g = mesh(new THREE.PlaneGeometry(w, h), glassMat, { x: (a + b) / 2, y: (L.windowTop + L.windowSill) / 2, z: fz, cast: false, receive: false, parent: root });
    g.renderOrder = 2;
    const s = mesh(new THREE.PlaneGeometry(w, h), smudgeMat, { x: (a + b) / 2, y: (L.windowTop + L.windowSill) / 2, z: fz - 0.002, cast: false, receive: false, parent: root });
    s.renderOrder = 3;
    R.glass.push(g, s);
  }
  // window decal: logo (reversed, we see it from inside) + open sign
  const logoDecal = new THREE.MeshBasicMaterial({ map: TX.logoTexture({ mirrored: true }), transparent: true, depthWrite: false, opacity: 0.92 });
  mesh(new THREE.PlaneGeometry(2.0, 1.0), logoDecal, { x: -3.55, y: 1.95, z: fz - 0.01, ry: Math.PI, cast: false, receive: false, parent: root }).renderOrder = 4;
  const openSign = new THREE.MeshBasicMaterial({ map: TX.openSignTexture(), transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false });
  mesh(new THREE.PlaneGeometry(0.9, 0.45), openSign, { x: 1.2, y: 2.25, z: fz - 0.06, ry: Math.PI, cast: false, receive: false, parent: root }).renderOrder = 4;

  // door
  const door = group(root, { x: L.door.x0, y: 0, z: fz, name: 'door' });
  const dw = L.door.x1 - L.door.x0;
  mesh(new THREE.BoxGeometry(dw, 0.12, 0.06), frameMetal, { x: dw / 2, y: 0.06, parent: door });
  mesh(new THREE.BoxGeometry(dw, 0.1, 0.06), frameMetal, { x: dw / 2, y: L.windowTop - 0.05, parent: door });
  mesh(new THREE.BoxGeometry(0.08, L.windowTop, 0.06), frameMetal, { x: 0.04, y: L.windowTop / 2, parent: door });
  mesh(new THREE.BoxGeometry(0.1, L.windowTop, 0.06), frameMetal, { x: dw - 0.05, y: L.windowTop / 2, parent: door });
  const dg = mesh(new THREE.PlaneGeometry(dw - 0.16, L.windowTop - 0.22), glassMat, { x: dw / 2, y: L.windowTop / 2, z: 0, cast: false, receive: false, parent: door });
  dg.renderOrder = 2;
  R.glass.push(dg);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, dw - 0.3, 12), chrome, { x: dw / 2, y: 1.0, z: -0.09, rz: Math.PI / 2, parent: door });
  for (const px of [0.17, dw - 0.17]) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), chrome, { x: px, y: 1.0, z: -0.055, rx: Math.PI / 2, parent: door });
  // lock: brass cylinder + escutcheon on the inside face (key goes in at LAYOUT.door.lock)
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 1.0, roughness: 0.25 });
  const lockG = group(door, { x: L.door.lock.x - L.door.x0, y: L.door.lock.y, z: -0.035 });
  mesh(rbox(0.05, 0.12, 0.012, 0.005), chrome, { parent: lockG });
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 20), brass, { z: -0.012, rx: Math.PI / 2, parent: lockG });
  mesh(new THREE.BoxGeometry(0.0035, 0.016, 0.022), blackPlastic, { z: -0.013, parent: lockG });
  R.refs.lock = lockG;
  // hours sticker
  const sticker = new THREE.MeshBasicMaterial({ map: TX.logoTexture({ mirrored: true }), transparent: true, opacity: 0.85, depthWrite: false });
  mesh(new THREE.PlaneGeometry(0.42, 0.21), sticker, { x: dw / 2, y: 1.55, z: -0.01, ry: Math.PI, cast: false, parent: door }).renderOrder = 4;

  // breath fog patch on the glass (scene 6) - positioned by the director
  const fog = mesh(new THREE.PlaneGeometry(0.42, 0.34), new THREE.MeshBasicMaterial({ map: TX.breathTexture(), transparent: true, opacity: 0, depthWrite: false, color: 0xdfe8ea }), { z: fz + 0.008, cast: false, receive: false, parent: root });
  fog.rotation.y = Math.PI;
  fog.renderOrder = 5;
  R.refs.breathFog = fog;

  // ---------- booths (left wall) ----------
  const booth = (z, side) => {
    const g = group(root, { x: side * 6.35, z });
    const bench = (dz, face) => {
      const b = group(g, { z: dz });
      mesh(rbox(1.25, 0.12, 0.48, 0.05), vinyl, { y: 0.46, parent: b });
      mesh(rbox(1.25, 0.68, 0.14, 0.06), vinyl, { y: 0.86, z: -face * 0.22, parent: b });
      mesh(rbox(1.25, 0.4, 0.42, 0.03), tealPaint, { y: 0.2, parent: b });
      for (let k = -2; k <= 2; k++) mesh(new THREE.BoxGeometry(0.012, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: 0x0a3a3e, roughness: 0.6 }), { x: k * 0.24, y: 0.88, z: -face * 0.145, parent: b, cast: false });
    };
    bench(-0.62, 1);
    bench(0.62, -1);
    mesh(rbox(1.1, 0.04, 0.72, 0.015), laminate, { y: 0.76, parent: g });
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.74, 12), chrome, { y: 0.38, parent: g });
    mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.03, 20), chrome, { y: 0.015, parent: g });
    // napkin box + shakers
    mesh(rbox(0.12, 0.12, 0.08, 0.01), chrome, { x: side * 0.4, y: 0.84, parent: g });
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), laminate, { x: side * 0.3, y: 0.82, z: 0.06, parent: g });
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), blackPlastic, { x: side * 0.3, y: 0.82, z: -0.06, parent: g });
  };
  booth(0.35, -1);
  booth(2.05, -1);
  booth(3.75, -1);
  booth(0.6, 1);
  booth(2.3, 1);

  // window bar with stools (left of the view lane)
  mesh(rbox(4.0, 0.05, 0.38, 0.015), laminate, { x: -4.9, y: 1.05, z: 4.72, parent: root });
  for (let k = 0; k < 4; k++) {
    const sx = -6.3 + k * 0.95;
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), vinylCream, { x: sx, y: 0.78, z: 4.2, parent: root });
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 10), chrome, { x: sx, y: 0.38, z: 4.2, parent: root });
    mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24), chrome, { x: sx, y: 0.3, z: 4.2, rx: Math.PI / 2, parent: root });
  }

  // wall clock (2:58) + posters
  const clock = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 40), new THREE.MeshStandardMaterial({ map: TX.clockTexture(2, 58), roughness: 0.4 }), { x: -6.96, y: 2.35, z: 2.0, rz: Math.PI / 2, parent: root });
  clock.rotation.set(0, 0, Math.PI / 2);
  clock.rotateY(-Math.PI / 2);
  R.refs.clock = clock;
  mesh(new THREE.PlaneGeometry(0.62, 0.87), new THREE.MeshStandardMaterial({ map: TX.posterTexture(0), roughness: 0.5 }), { x: -6.98, y: 2.05, z: 0.35, ry: Math.PI / 2, parent: root, cast: false });
  mesh(new THREE.PlaneGeometry(0.62, 0.87), new THREE.MeshStandardMaterial({ map: TX.posterTexture(1), roughness: 0.5 }), { x: -6.98, y: 2.05, z: 3.75, ry: Math.PI / 2, parent: root, cast: false });
  mesh(new THREE.PlaneGeometry(0.8, 1.12), new THREE.MeshStandardMaterial({ map: TX.posterTexture(1), roughness: 0.5 }), { x: 4.2, y: 1.9, z: -1.23, parent: root, cast: false });

  // ---------- front counter ----------
  const C = L.counter;
  const cg = group(root, { name: 'counter' });
  const cw = C.x1 - C.x0;
  const cx = (C.x0 + C.x1) / 2;
  const cz = (C.z0 + C.z1) / 2;
  mesh(rbox(cw, C.top - 0.05, C.z1 - C.z0 - 0.06, 0.02), tealPaint, { x: cx, y: (C.top - 0.05) / 2, z: cz, parent: cg });
  for (let x = C.x0 + 0.35; x < C.x1; x += 0.7) mesh(rbox(0.6, 0.78, 0.02, 0.01), vinylCream, { x, y: 0.5, z: C.z1 - 0.02, parent: cg });
  mesh(rbox(cw + 0.08, 0.05, C.z1 - C.z0 + 0.08, 0.015), steel, { x: cx, y: C.top - 0.02, z: cz, parent: cg });
  mesh(new THREE.BoxGeometry(cw, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }), { x: cx, y: 0.04, z: C.z1 - 0.005, parent: cg });
  // inner shelf (cashier side)
  mesh(new THREE.BoxGeometry(cw, 0.02, 0.4), steelDark, { x: cx, y: 0.55, z: C.z0 - 0.1, parent: cg });
  for (let k = 0; k < 9; k++) mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 14), laminate, { x: C.x0 + 0.5 + k * 0.2, y: 0.62, z: C.z0 - 0.12, parent: cg });

  // registers (screen faces the cashier, -z)
  const screenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.9, 1.0).multiplyScalar(1.1), toneMapped: false });
  const register = (x) => {
    const g = group(cg, { x, y: C.top, z: cz });
    mesh(rbox(0.42, 0.1, 0.36, 0.02), blackPlastic, { y: 0.05, parent: g });
    const s = group(g, { y: 0.24, z: -0.02, rx: 0.35 });
    mesh(rbox(0.36, 0.26, 0.04, 0.012), blackPlastic, { parent: s });
    mesh(new THREE.PlaneGeometry(0.32, 0.22), screenMat, { z: -0.021, ry: Math.PI, parent: s, cast: false });
    mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 10), blackPlastic, { y: 0.13, parent: g });
  };
  register(-2.9);
  register(-0.9);
  R.refs.registers = [-2.9, -0.9];

  // CCTV monitor near the register, angled to the cashier side
  const cctv = group(cg, { x: 0.65, y: C.top, z: cz - 0.05, ry: Math.PI + 0.35 });
  mesh(rbox(0.4, 0.32, 0.34, 0.03), new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5 }), { y: 0.17, parent: cctv });
  const cctvScreen = mesh(new THREE.PlaneGeometry(0.33, 0.25), new THREE.MeshBasicMaterial({ color: 0x111111 }), { y: 0.17, z: 0.172, parent: cctv, cast: false });
  R.cctv = { screen: cctvScreen };

  // tip jar, bell, cup stack
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), new THREE.MeshPhysicalMaterial({ color: 0xd8f0f0, transparent: true, opacity: 0.35, roughness: 0.05 }), { x: -1.6, y: C.top + 0.08, z: cz + 0.15, parent: cg });
  mesh(new THREE.SphereGeometry(0.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), chrome, { x: -0.4, y: C.top, z: cz + 0.2, parent: cg });
  for (let k = 0; k < 6; k++) mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 14), laminate, { x: 1.4, y: C.top + 0.055 + k * 0.03, z: cz, parent: cg });

  // ---------- menu boards (3 screens above the counter) ----------
  const menuX = [-3.4, -1.95, -0.5];
  const faceCanvas = TX.faceScreenCanvas();
  const faceTex = canvasTexture(faceCanvas, { mipmaps: true });
  menuX.forEach((x, i) => {
    const g = group(root, { x, y: 2.45, z: -1.32 });
    mesh(rbox(1.36, 0.8, 0.06, 0.015), blackPlastic, { parent: g });
    const tex = canvasTexture(TX.menuBoardCanvas(i));
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
    mesh(new THREE.PlaneGeometry(1.28, 0.74), mat, { z: 0.031, parent: g, cast: false });
    for (const sx of [-0.5, 0.5]) mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6), chrome, { x: sx, y: 0.6, parent: g, cast: false });
    R.menu.push({ mat, tex, faceTex, x });
  });
  // big lit logo sign on the kitchen back wall above the line
  const logoSign = new THREE.MeshBasicMaterial({ map: TX.logoTexture({ glow: true }), toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4), transparent: true });
  mesh(new THREE.PlaneGeometry(2.4, 1.2), logoSign, { x: 2.0, y: 2.55, z: L.backZ + 0.02, parent: root, cast: false });

  // ---------- kitchen line ----------
  const kz = L.fridge.frontZ;
  const line = group(root, { name: 'kitchen' });
  // fryers (2) with oil
  const oil = new THREE.MeshPhysicalMaterial({ color: 0x8a5a14, roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x2a1504, emissiveIntensity: 0.4 });
  R.oil = oil;
  for (const [i, x] of [-5.05, -4.35].entries()) {
    const g = group(line, { x, z: kz - 0.37 });
    mesh(rbox(0.66, 0.92, 0.72, 0.02), steel, { y: 0.46, parent: g });
    mesh(new THREE.BoxGeometry(0.5, 0.02, 0.5), oil, { y: 0.9, parent: g, cast: false });
    mesh(rbox(0.66, 0.5, 0.06, 0.01), steelDark, { y: 1.17, z: -0.33, parent: g });
    const basket = group(g, { y: 1.05, z: 0.0 });
    mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0xbfc5c9, metalness: 1, roughness: 0.4, wireframe: true }), { x: -0.11, parent: basket, cast: false });
    mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0xbfc5c9, metalness: 1, roughness: 0.4, wireframe: true }), { x: 0.11, parent: basket, cast: false });
    for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), blackPlastic, { x: -0.25 + k * 0.08, y: 0.84, z: 0.362, rx: Math.PI / 2, parent: g, cast: false });
    void i;
  }
  // flat-top grill + heat lamp shelf
  const grill = group(line, { x: -3.3, z: kz - 0.37 });
  mesh(rbox(1.1, 0.9, 0.72, 0.02), steel, { y: 0.45, parent: grill });
  mesh(new THREE.BoxGeometry(1.0, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, metalness: 0.8, roughness: 0.35 }), { y: 0.915, parent: grill });
  // soda station right of the fridge
  const soda = group(line, { x: -0.25, z: kz - 0.37 });
  mesh(rbox(1.0, 0.92, 0.72, 0.02), steel, { y: 0.46, parent: soda });
  mesh(rbox(0.9, 0.7, 0.5, 0.03), blackPlastic, { y: 1.27, z: -0.1, parent: soda });
  for (let k = 0; k < 4; k++) {
    mesh(new THREE.PlaneGeometry(0.16, 0.22), glowMaterial(k % 2 ? 0x5fb3ad : 0xf5a23b, 1.4), { x: -0.3 + k * 0.2, y: 1.38, z: 0.151, parent: soda, cast: false });
  }
  // pass shelf with heat lamps
  const pass = group(line, { x: 1.6, z: kz - 0.37 });
  mesh(rbox(2.0, 0.92, 0.72, 0.02), steel, { y: 0.46, parent: pass });
  mesh(new THREE.BoxGeometry(2.0, 0.03, 0.5), steel, { y: 1.55, z: -0.05, parent: pass });
  for (let k = 0; k < 3; k++) {
    const lamp = group(pass, { x: -0.65 + k * 0.65, y: 1.95 });
    mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.14, 20, 1, true), steelDark, { parent: lamp });
    mesh(new THREE.CircleGeometry(0.11, 20), glowMaterial(0xff8a3c, 2.2), { y: -0.06, rx: Math.PI / 2, parent: lamp, cast: false });
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 6), chrome, { y: 0.66, parent: lamp, cast: false });
  }
  // shelves on the back wall
  for (const y of [1.75, 2.15]) {
    mesh(new THREE.BoxGeometry(5.6, 0.03, 0.32), steel, { x: -3.0, y, z: L.backZ + 0.17, parent: line });
    const rng = mulberry32(Math.round(y * 100));
    for (let k = 0; k < 12; k++) {
      const box = rng() < 0.5;
      const x = -5.6 + k * 0.46 + rng() * 0.1;
      if (box) mesh(rbox(0.3, 0.22 + rng() * 0.1, 0.24, 0.01), new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? 0xb89a6e : 0xe6dfcf, roughness: 0.9 }), { x, y: y + 0.13, z: L.backZ + 0.17, parent: line });
      else mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), steelDark, { x, y: y + 0.115, z: L.backZ + 0.17, parent: line });
    }
  }

  // ---------- the fridge (brushed steel reach-in, mirror door) ----------
  const F = L.fridge;
  const fr = group(root, { x: F.x, z: F.frontZ - F.depth / 2, name: 'fridge' });
  mesh(rbox(F.w + 0.08, F.h + 0.1, F.depth, 0.02), steelDark, { y: (F.h + 0.1) / 2, parent: fr });
  // door with its own planar mirror
  const doorMat = addReflection(
    new THREE.MeshStandardMaterial({ color: 0x4a5056, metalness: 1.0, roughness: 0.3, roughnessMap: brushed, envMapIntensity: 0.12 }),
    fridgeRefl,
    { strength: 0.9, blur: 0.25, fresnel: 0.8, roughBlur: 0.8, distort: 0.0, stretch: 0.0, steel: 1.0 }
  );
  const fdoor = mesh(new THREE.PlaneGeometry(F.w - 0.04, F.h - 0.2), doorMat, { y: F.h / 2 + 0.06, z: F.depth / 2 + 0.006, parent: fr, cast: false });
  fdoor.name = 'fridgeDoor';
  R.fridgeDoor = fdoor;
  R.fridgeDoorMat = doorMat;
  mesh(rbox(F.w, F.h - 0.16, 0.02, 0.01), steel, { y: F.h / 2 + 0.06, z: F.depth / 2 - 0.005, parent: fr, cast: false });
  mesh(rbox(0.04, 0.7, 0.05, 0.015), chrome, { x: F.w / 2 - 0.08, y: 1.15, z: F.depth / 2 + 0.05, parent: fr });
  mesh(new THREE.PlaneGeometry(0.12, 0.05), glowMaterial(0x7fe0ff, 1.5), { x: -F.w / 2 + 0.13, y: F.h - 0.02, z: F.depth / 2 + 0.03, parent: fr, cast: false });
  // grille + feet
  mesh(new THREE.BoxGeometry(F.w, 0.08, 0.02), blackPlastic, { y: 0.06, z: F.depth / 2 + 0.01, parent: fr });

  // ---------- kitchen floor mat + mop bucket + wet floor sign ----------
  mesh(new THREE.PlaneGeometry(6.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.95 }), { rx: -Math.PI / 2, y: 0.004, x: -2.0, z: -2.3, parent: root, cast: false });
  const bucket = group(root, { x: 3.6, z: 0.4, name: 'bucket' });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xe6a51c, roughness: 0.4, clearcoat: 0.6 });
  mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.32, 24), yellow, { y: 0.22, parent: bucket });
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x5c6d60, roughness: 0.1 }), { y: 0.33, parent: bucket, cast: false });
  for (const s of [-1, 1]) for (const t of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 10, 8), blackPlastic, { x: s * 0.16, y: 0.03, z: t * 0.16, parent: bucket });
  R.refs.bucket = bucket;
  const sign = group(root, { x: -1.6, z: 2.6, ry: 0.5, name: 'wetSign' });
  const signMat = new THREE.MeshStandardMaterial({ map: TX.wetFloorSignTexture(), roughness: 0.45 });
  for (const s of [-1, 1]) {
    const leaf = group(sign, { y: 0, z: s * 0.0 });
    const p = mesh(rbox(0.3, 0.62, 0.012, 0.01), signMat, { y: 0.31, parent: leaf });
    p.rotation.x = s * 0.24;
    p.position.z = s * 0.075;
  }

  // ---------- lights ----------
  const key = new THREE.SpotLight(0xeaf3ff, 45, 14, 1.15, 0.85, 1.6);
  key.position.set(-0.5, 3.15, 1.5);
  key.target.position.set(-0.5, 0, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 12;
  scene.add(key, key.target);
  R.lights.key = key;
  const fillDining = new THREE.PointLight(0xe6f0ff, 9, 11, 1.4);
  fillDining.position.set(-2.4, 2.85, 2.4);
  const fillKitchen = new THREE.PointLight(0xe6f0ff, 9, 9, 1.4);
  fillKitchen.position.set(-1.2, 2.85, -2.5);
  const menuGlow = new THREE.PointLight(0xc8dcff, 2.2, 4.5, 1.6);
  menuGlow.position.set(-1.9, 2.1, -0.75);
  scene.add(fillDining, fillKitchen, menuGlow);
  Object.assign(R.lights, { fillDining, fillKitchen, menuGlow });
  R.lightBase = { key: key.intensity, fillDining: fillDining.intensity, fillKitchen: fillKitchen.intensity, menuGlow: menuGlow.intensity };

  void envInterior;
  return R;
}
