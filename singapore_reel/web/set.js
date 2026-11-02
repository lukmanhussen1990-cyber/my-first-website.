// Singapore reel world: spotless street with mirror sidewalk, glass towers, trees, sign, cars, bus, the poop,
// props (oranges, bag, coffee, balloon, notebook, pen, printer, receipt), public toilet room, airport + plane, sky.
// API like the Thanksgiving set: { group, colliders, props, anchors, state, reset(t, ctx), commit(ctx) }.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mat, mesh, lowSphere, hash1, noise1, clamp, smooth, invLerp, lerp, rng, canvas, tex, paint, noise2, hexToRgb, chamferBox } from './lib.js';
import { STREET, SPOTS, TOILET, AIRPORT } from './layout.js';
import { mergeGeos } from './set_util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = STREET.curb;

// ------------------------------------------------------------------ textures (small canvases, nearest filter)
function tilesCanvas() {
  const S = 64, n = noise2(S, S, 4, 11), R = rng(5);
  return paint(S, S, (x, y) => {
    const g = (x % 32 === 0 || y % 32 === 0) ? -26 : 0;
    const base = ((Math.floor(x / 32) + Math.floor(y / 32)) & 1) ? [214, 210, 202] : [224, 220, 212];
    const d = (n[y * S + x] - 0.5) * 10 + (R() - 0.5) * 6 + g;
    return [base[0] + d, base[1] + d, base[2] + d];
  });
}
function asphaltCanvas() { const S = 64, n = noise2(S, S, 3, 21), R = rng(7); return paint(S, S, (x, y) => { const d = (n[y * S + x] - 0.5) * 18 + (R() - 0.5) * 12; return [70 + d, 72 + d, 76 + d]; }); }
function glassCanvas(base, frame, seed) {
  const W = 32, H = 64, b = hexToRgb(base), f = hexToRgb(frame), R = rng(seed), n = noise2(W, H, 8, seed);
  return paint(W, H, (x, y) => {
    if (x % 8 === 0 || y % 6 === 0) return f;
    const sky = 1 - y / H, refl = n[y * W + x] * 40 + sky * 30 + (((x + y * 0.4 + seed) % 23) < 3 ? 35 : 0);
    const lit = R() < 0.03 ? 40 : 0;
    return [b[0] + refl + lit, b[1] + refl + lit, b[2] + refl * 1.1 + lit];
  });
}
function shopsCanvas(seed) {
  const W = 64, H = 16, R = rng(seed), cols = ['#c9463a', '#2f7d6b', '#e0a43a', '#3a5ea8', '#8a4aa0', '#e07a2a'];
  const awn = []; for (let i = 0; i < 4; i++) awn.push(hexToRgb(cols[Math.floor(R() * cols.length)]));
  return paint(W, H, (x, y) => {
    const k = Math.floor(x / 16), awning = awn[k];
    if (y < 4) return ((x >> 1) & 1) ? awning : awning.map((v) => v * 0.8 + 40);
    if (x % 16 === 0 || x % 16 === 15) return [60, 62, 66];
    if (y > 13) return [90, 92, 96];
    const glow = 150 + (R() - 0.5) * 30;
    return [glow * 0.95, glow * 0.98, glow];
  });
}
function signCanvas() { // red no-littering sign: white disc, red ring + slash, black bin + falling paper
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  g.fillStyle = '#111'; g.fillRect(24, 30, 16, 20); g.fillRect(22, 28, 20, 3);            // bin
  g.fillRect(18, 12, 7, 8); g.save(); g.translate(30, 18); g.rotate(0.5); g.fillRect(0, 0, 6, 6); g.restore(); // paper
  g.strokeStyle = '#d4181f'; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(13, 13); g.lineTo(51, 51); g.stroke();
  return c;
}
function warnCanvas() { // red warning triangle with "!"
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#e01c22'; g.beginPath(); g.moveTo(32, 4); g.lineTo(62, 58); g.lineTo(2, 58); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 14); g.lineTo(53, 52); g.lineTo(11, 52); g.closePath(); g.fill();
  g.fillStyle = '#111'; g.fillRect(29, 24, 6, 16); g.fillRect(29, 44, 6, 5);
  return c;
}
function receiptCanvas() { // paper with faint grey print lines, repeats along the length (v)
  const W = 16, H = 32, R = rng(9);
  return paint(W, H, (x, y) => {
    const line = (y % 4 === 1) && x > 2 && x < 13 && R() < 0.85 ? -70 : 0;
    const d = (R() - 0.5) * 6;
    return [248 + line + d, 246 + line + d, 240 + line + d];
  });
}
function scribbleCanvas() {
  const W = 64, H = 80, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9ab8d8'; for (let y = 10; y < H; y += 7) g.fillRect(0, y, W, 1);
  return c;
}

// ------------------------------------------------------------------ builders
function poopGeo() { // low-poly soft-serve swirl like the reference
  const parts = [];
  const tiers = [[0.085, 0.034, 0], [0.068, 0.03, 0.032], [0.05, 0.026, 0.06], [0.032, 0.022, 0.084]];
  for (const [r, h, y] of tiers) { const g = new THREE.TorusGeometry(r * 0.72, h * 0.55, 6, 12); g.rotateX(Math.PI / 2); g.translate(0, y + h * 0.55, 0); parts.push(g); }
  const tip = new THREE.ConeGeometry(0.026, 0.06, 8); tip.translate(0.006, 0.122, 0); tip.rotateZ(-0.25); parts.push(tip);
  const base = new THREE.CylinderGeometry(0.075, 0.08, 0.02, 12); base.translate(0, 0.01, 0); parts.push(base);
  return mergeGeos(parts);
}

function tree(M, x, z, h = 6, seed = 1) {
  const g = new THREE.Group(); const R = rng(seed);
  const trunk = mesh(new THREE.CylinderGeometry(0.11, 0.16, h * 0.8, 6), M.trunk); trunk.position.y = h * 0.4; g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const b = mesh(new THREE.IcosahedronGeometry(0.8 + R() * 0.5, 0), M.leaves[i % M.leaves.length]);
    const a = R() * 6.28, r = R() * 1.1; b.position.set(Math.cos(a) * r, h * 0.78 + R() * h * 0.2, Math.sin(a) * r); b.scale.set(1.3, 0.7, 1.3); g.add(b);
  }
  const planter = mesh(new THREE.CylinderGeometry(0.85, 0.8, 0.45, 10), M.planter); planter.position.y = 0.225; g.add(planter);
  const soil = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.02, 10), M.soil, { cast: false }); soil.position.y = 0.44; g.add(soil);
  g.position.set(x, C, z); return g;
}

function car(M, color, seed) {
  const g = new THREE.Group(), body = mat(color, { rough: 0.35, metal: 0.3 });
  const b = mesh(chamferBox(1.8, 0.65, 4.2, 0.12), body); b.position.y = 0.6; g.add(b);
  const cab = mesh(chamferBox(1.6, 0.55, 2.2, 0.15), M.carGlass); cab.position.set(0, 1.18, -0.2); g.add(cab);
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) { const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10), M.tire); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.82, 0.34, sz); g.add(w); }
  return g;
}

function bus(M) {
  const g = new THREE.Group();
  const lower = mesh(chamferBox(2.5, 2.1, 11, 0.15), mat('#7a2a8a', { rough: 0.4 })); lower.position.y = 1.35; g.add(lower);
  const upper = mesh(chamferBox(2.5, 1.9, 10.6, 0.2), mat('#7a2a8a', { rough: 0.4 })); upper.position.y = 3.35; g.add(upper);
  for (const y of [1.75, 3.55]) { const w = mesh(new THREE.BoxGeometry(2.56, 0.8, 9.8), M.carGlass); w.position.y = y; g.add(w); }
  for (const sz of [-3.6, 3.6]) for (const sx of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), M.tire); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.15, 0.5, sz); g.add(w); }
  return g;
}

function plane(M) {
  const g = new THREE.Group(), white = mat('#f4f5f7', { rough: 0.35 }), blue = mat('#2c5aa8', { rough: 0.4 }), grey = mat('#9aa0a8', { rough: 0.4, metal: 0.4 });
  const fus = mesh(new THREE.CapsuleGeometry(2.0, 30, 6, 12), white); fus.rotation.z = Math.PI / 2; fus.position.y = 4.2; g.add(fus);
  const stripe = mesh(new THREE.CylinderGeometry(2.02, 2.02, 26, 12, 1, true), blue); stripe.rotation.z = Math.PI / 2; stripe.position.y = 4.2; stripe.scale.set(1, 1, 1); g.add(stripe);
  const nose = mesh(new THREE.SphereGeometry(2.0, 12, 8), white); nose.position.set(16.2, 4.2, 0); nose.scale.set(1.6, 1, 1); g.add(nose);
  const wing = mesh(new THREE.BoxGeometry(6, 0.35, 34), white); wing.position.set(1, 3.0, 0); wing.rotation.y = 0.0; g.add(wing);
  for (const sz of [-1, 1]) { const e = mesh(new THREE.CylinderGeometry(1.0, 0.9, 4, 10), grey); e.rotation.z = Math.PI / 2; e.position.set(3, 2.0, sz * 6); g.add(e); }
  const tail = mesh(new THREE.BoxGeometry(5, 7, 0.4), blue); tail.position.set(-15.5, 8, 0); tail.rotation.z = 0.35; g.add(tail);
  const stab = mesh(new THREE.BoxGeometry(4, 0.3, 12), white); stab.position.set(-15.5, 4.8, 0); g.add(stab);
  for (let i = 0; i < 14; i++) { const w = mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), mat('#203048')); w.position.set(-11 + i * 1.7, 5.0, 2.0); g.add(w); const w2 = w.clone(); w2.position.z = -2.0; g.add(w2); }
  const gears = [];
  for (const [x, z] of [[12, 0], [0, 2.2], [0, -2.2]]) {
    const strut = mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2, 6), grey); strut.position.set(x, 1.9, z); g.add(strut);
    const w = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.45, 12), M.tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.75, z); g.add(w); gears.push(w);
  }
  g.userData.gears = gears;
  return g;
}

// ------------------------------------------------------------------ the set
export function buildSet(world) {
  const { scene } = world;
  const group = new THREE.Group(); group.name = 'set'; scene.add(group);
  const colliders = [];
  const T = (c, o) => tex(c, o);
  const M = {
    tiles: mat(T(tilesCanvas(), { repeat: [1, 1] }), { rough: 0.25 }),
    tilesOver: mat(T(tilesCanvas(), { repeat: [1, 1] }), { rough: 0.2, transparent: true, opacity: 0.58, polygonOffset: 2 }),
    asphalt: mat(T(asphaltCanvas()), { rough: 0.8 }),
    curb: mat('#c9c6c0', { rough: 0.6 }),
    lane: mat('#f2f2ee', { rough: 0.6, polygonOffset: 2 }),
    trunk: mat('#6a4a32', { rough: 0.9 }),
    leaves: ['#3f8a3a', '#4f9a3f', '#367a33'].map((c) => mat(c, { rough: 0.8 })),
    planter: mat('#b9b4aa', { rough: 0.7 }), soil: mat('#4a3424', { rough: 1 }),
    carGlass: mat('#2a3a4a', { rough: 0.15, metal: 0.6 }), tire: mat('#1a1a1c', { rough: 0.8 }),
    glass: [['#4a7a9a', '#c8d4dc', 3], ['#3a6a8a', '#dfe5ea', 4], ['#5a8aa0', '#f0f0f0', 5], ['#6a8090', '#30353a', 6], ['#2f5f7f', '#9aa8b0', 7], ['#7a8a9a', '#e0e4e8', 8]]
      .map(([b, f, s]) => mat(T(glassCanvas(b, f, s)), { rough: 0.18, metal: 0.35 })),
    shops: [1, 2, 3, 4].map((s) => mat(T(shopsCanvas(s)), { rough: 0.6, emissive: '#ffffff', emissiveIntensity: 0.06 })),
    paper: mat(T(receiptCanvas(), { repeat: [1, 1] }), { rough: 0.9, side: THREE.DoubleSide, polygonOffset: 3 }),
    white: mat('#ffffff', { rough: 0.3 }), tileWhite: mat(T(paint(32, 32, (x, y) => (x % 16 === 0 || y % 16 === 0) ? [200, 205, 210] : [242, 244, 246])), { rough: 0.25 }),
    chrome: mat('#d8dde2', { rough: 0.15, metal: 0.9 }),
  };
  const add = (o) => { group.add(o); return o; };

  // ---- ground: road, sidewalks, mirror patch where the story happens
  const roadLen = STREET.maxZ - STREET.minZ, zc = (STREET.maxZ + STREET.minZ) / 2;
  const road = mesh(new THREE.PlaneGeometry(STREET.roadMaxX - STREET.roadMinX, roadLen), M.asphalt, { cast: false });
  road.rotation.x = -Math.PI / 2; road.position.set((STREET.roadMinX + STREET.roadMaxX) / 2, 0, zc); M.asphalt.map.repeat.set(4, roadLen / 2); add(road);
  for (let z = STREET.minZ + 2; z < STREET.maxZ; z += 6) { const d = mesh(new THREE.PlaneGeometry(0.15, 3), M.lane, { cast: false }); d.rotation.x = -Math.PI / 2; d.position.set(4.6, 0.003, z); add(d); }
  const mirror = { x0: -7.0, x1: 0.5, z0: -14, z1: 12 };
  const walk = (x0, x1, z0, z1, top) => { const b = mesh(new THREE.BoxGeometry(x1 - x0, top, z1 - z0), M.tiles); b.position.set((x0 + x1) / 2, top / 2, (z0 + z1) / 2); M.tiles.map.repeat.set(1, 1); return add(b); };
  const tileMatFor = (w, d) => { const m = M.tiles.clone(); m.map = M.tiles.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(w / 1.2, d / 1.2); return m; };
  for (const [x0, x1, z0, z1] of [[STREET.walkMinX, STREET.walkMaxX, STREET.minZ, mirror.z0], [STREET.walkMinX, STREET.walkMaxX, mirror.z1, STREET.maxZ], [STREET.walk2MinX, STREET.walk2MaxX, STREET.minZ, STREET.maxZ]]) {
    const b = walk(x0, x1, z0, z1, C); b.material = tileMatFor(x1 - x0, z1 - z0);
  }
  // mirror patch: base box slightly lower, Reflector at the curb height, tiles overlay on top
  { const b = walk(STREET.walkMinX, STREET.walkMaxX, mirror.z0, mirror.z1, C - 0.006); b.material = M.curb; }
  const refl = new Reflector(new THREE.PlaneGeometry(STREET.walkMaxX - STREET.walkMinX, mirror.z1 - mirror.z0), { textureWidth: 1024, textureHeight: 1024, color: 0x9aa0a6, clipBias: 0.002 });
  refl.rotation.x = -Math.PI / 2; refl.position.set((STREET.walkMinX + STREET.walkMaxX) / 2, C, (mirror.z0 + mirror.z1) / 2); refl.userData.noAudit = true; add(refl);
  const over = mesh(new THREE.PlaneGeometry(STREET.walkMaxX - STREET.walkMinX, mirror.z1 - mirror.z0), M.tilesOver, { cast: false });
  M.tilesOver.map.repeat.set((STREET.walkMaxX - STREET.walkMinX) / 1.2, (mirror.z1 - mirror.z0) / 1.2);
  over.rotation.x = -Math.PI / 2; over.position.copy(refl.position).add(V(0, 0.0015, 0)); over.receiveShadow = true; add(over);
  // curb edges
  for (const x of [STREET.walkMaxX, STREET.walk2MinX]) { const cb = mesh(new THREE.BoxGeometry(0.16, C + 0.01, roadLen), M.curb); cb.position.set(x + (x === STREET.walkMaxX ? 0.08 : -0.08), (C + 0.01) / 2, zc); add(cb); }
  // grass + water far away (aerial shot), runway area
  const grass = mesh(new THREE.PlaneGeometry(1400, 1400), mat('#5d8a46', { rough: 1 }), { cast: false }); grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.05, -200); add(grass);
  const water = mesh(new THREE.PlaneGeometry(800, 1400), mat('#2f6e9a', { rough: 0.12, metal: 0.2 }), { cast: false }); water.rotation.x = -Math.PI / 2; water.position.set(-520, -0.02, -200); add(water);

  // ---- buildings (both sides + a skyline cluster)
  const R = rng(31);
  const building = (x, z, w, d, h, k) => {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(w, h, d), M.glass[k % M.glass.length]);
    const m = body.material.clone(); m.map = body.material.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 4))); body.material = m;
    body.position.y = h / 2; g.add(body);
    if (R() < 0.5) { const top = mesh(new THREE.BoxGeometry(w * 0.7, h * 0.12, d * 0.7), M.glass[(k + 2) % M.glass.length]); top.position.y = h + h * 0.06; g.add(top); }
    g.position.set(x, 0, z); add(g);
    colliders.push({ name: 'building', box: new THREE.Box3(V(x - w / 2, 0, z - d / 2), V(x + w / 2, h, z + d / 2)) });
    return g;
  };
  const shopBand = (x, z, w, d, k) => { const s = mesh(new THREE.BoxGeometry(w + 0.1, 4.2, d + 0.1), M.shops[k % 4]); s.material = s.material.clone(); s.material.map = M.shops[k % 4].map.clone(); s.material.map.needsUpdate = true; s.material.map.repeat.set(Math.max(1, Math.round(w / 6)), 1); s.position.set(x, 2.1, z); add(s); };
  let k = 0;
  for (const side of [-1, 1]) {
    let z = STREET.maxZ;
    while (z > STREET.minZ + 10) {
      const d = 14 + R() * 12, w = 16 + R() * 14, h = 28 + R() * 110;
      const x = side < 0 ? STREET.walkMinX - 0.6 - w / 2 : STREET.walk2MaxX + 0.6 + w / 2;
      building(x, z - d / 2, w, d, h, k); shopBand(x, z - d / 2, w, d, k); k++;
      z -= d + 3 + R() * 4;
    }
  }
  for (let i = 0; i < 90; i++) { // skyline behind
    const x = (R() < 0.5 ? -1 : 1) * (45 + R() * 170), z = 40 - R() * 380, w = 18 + R() * 20, d = 18 + R() * 20, h = 40 + R() * 190;
    building(x, z, w, d, h, k++);
  }
  // ---- trees, sign, bins, lamps, parked cars, bus
  for (let z = 26; z > -120; z -= 9) { add(tree(M, -6.2, z + (hash1(z) - 0.5), 6 + hash1(z * 3) * 2, Math.round(z + 200))); add(tree(M, 12.0, z + 4, 6.5, Math.round(z + 400))); }
  colliders.push({ name: 'treeNear', box: new THREE.Box3(V(-7.1, 0, -1.4), V(-5.3, 2.5, 0.4)) });
  const sign = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), mat('#8a8f96', { rough: 0.4, metal: 0.6 })); pole.position.y = 1.15; sign.add(pole);
  const face = mesh(new THREE.CircleGeometry(0.32, 20), mat(T(signCanvas(), { nearest: true }), { rough: 0.5 })); face.position.set(0, 2.05, 0.05); sign.add(face);
  const back = mesh(new THREE.CircleGeometry(0.32, 20), mat('#bfc4c8')); back.position.set(0, 2.05, 0.045); back.rotation.y = Math.PI; sign.add(back);
  sign.position.set(SPOTS.sign.pos[0], C, SPOTS.sign.pos[1]); sign.rotation.y = 0.5; add(sign);
  for (let z = 22; z > -60; z -= 14) { const l = mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), mat('#3a3f46', { metal: 0.5, rough: 0.4 })); l.position.set(0.2, C + 3, z); add(l); const hd = mesh(new THREE.BoxGeometry(0.8, 0.12, 0.3), mat('#3a3f46')); hd.position.set(0.55, C + 6, z); add(hd); }
  const carCols = ['#c8202a', '#f2f2f2', '#1f3f8a', '#2a2a2a', '#d8c040', '#9aa0a8'];
  for (let i = 0; i < 14; i++) { const c = car(M, carCols[i % carCols.length], i); c.position.set(i % 2 ? 2.2 : 7.0, 0, -12 - i * 16 - R() * 6); c.rotation.y = i % 2 ? Math.PI : 0; add(c); }
  const theBus = bus(M); theBus.position.set(6.6, 0, -58); theBus.rotation.y = Math.PI; add(theBus);

  // ---- the poop
  const poop = mesh(poopGeo(), mat('#6b3a1c', { rough: 0.45 }), { name: 'poop' }); poop.position.set(SPOTS.poop.pos[0], C, SPOTS.poop.pos[1]); poop.rotation.y = 0.4; add(poop);

  // ---- cleaning robot
  const robot = new THREE.Group();
  { const b = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 14), M.white); b.position.y = 0.08; robot.add(b);
    const tp = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 14), mat('#d8dde4', { rough: 0.3 })); tp.position.y = 0.165; robot.add(tp);
    const led = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#3ac0ff', { emissive: '#3ac0ff', emissiveIntensity: 2 })); led.position.set(0, 0.2, 0.08); robot.add(led);
    const eyesM = mat('#111'); for (const s of [-1, 1]) { const e = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.01), eyesM); e.position.set(s * 0.06, 0.1, 0.235); robot.add(e); }
    const brush = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), mat('#4a6aa0')); brush.position.set(0.17, 0.012, 0.12); robot.add(brush); robot.userData.brush = brush; }
  add(robot);

  // ---- props
  const oranges = []; const orangeM = mat('#f08a1a', { rough: 0.5 });
  for (let i = 0; i < 8; i++) { const o = mesh(new THREE.IcosahedronGeometry(0.045, 1), orangeM, { name: 'orange' }); add(o); oranges.push(o); }
  const bag = new THREE.Group();
  { const b = mesh(new THREE.BoxGeometry(0.3, 0.34, 0.16), mat('#b8865a', { rough: 0.9 })); b.position.y = 0.17; bag.add(b);
    for (let i = 0; i < 4; i++) { const o = mesh(new THREE.IcosahedronGeometry(0.045, 1), orangeM); o.position.set(-0.08 + i * 0.055, 0.35, (i % 2) * 0.03 - 0.015); bag.add(o); }
    const handle = mesh(new THREE.TorusGeometry(0.07, 0.008, 4, 10, Math.PI), mat('#8a6040')); handle.position.y = 0.34; bag.add(handle);
    bag.userData.grip = { pos: [0, 0.4, 0], axis: [1, 0, 0], up: [0, 0, 1] }; }
  add(bag);
  const coffee = new THREE.Group();
  { const cup = mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.13, 10), mat('#f4efe6', { rough: 0.6 })); cup.position.y = 0.065; coffee.add(cup);
    const sleeve = mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.05, 10), mat('#9a6a3a')); sleeve.position.y = 0.06; coffee.add(sleeve);
    const lid = mesh(new THREE.CylinderGeometry(0.048, 0.046, 0.015, 10), mat('#ffffff')); lid.position.y = 0.137; coffee.add(lid);
    coffee.userData.grip = { pos: [0, 0.065, 0], axis: [0, 1, 0], up: [0, 0, 1] }; }
  add(coffee);
  const splash = []; for (let i = 0; i < 9; i++) { const d = mesh(new THREE.SphereGeometry(0.012 + hash1(i) * 0.01, 6, 4), mat('#6a3a18', { rough: 0.2 })); add(d); splash.push(d); }
  const balloon = new THREE.Group();
  { const b = mesh(new THREE.SphereGeometry(0.16, 12, 10), mat('#e8202a', { rough: 0.25 })); b.scale.y = 1.15; balloon.add(b);
    const knot = mesh(new THREE.ConeGeometry(0.025, 0.04, 6), mat('#c81820')); knot.position.y = -0.19; balloon.add(knot); }
  add(balloon);
  const stringGeo = new THREE.BufferGeometry().setFromPoints([V(), V(0, 1, 0)]);
  const balloonString = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: '#eeeeee' })); balloonString.userData.noAudit = true; add(balloonString);
  const notebook = new THREE.Group();
  const pageTex = T(scribbleCanvas(), { nearest: true });
  const pageCanvas = pageTex.image, pageCtx = pageCanvas.getContext('2d');
  { const cover = mesh(new THREE.BoxGeometry(0.1, 0.006, 0.14), mat('#1e1e22', { rough: 0.6 })); notebook.add(cover);
    const page = mesh(new THREE.PlaneGeometry(0.094, 0.134), mat(pageTex, { rough: 0.9, polygonOffset: 2 })); page.rotation.x = -Math.PI / 2; page.position.y = 0.0035; notebook.add(page);
    notebook.userData.grip = { pos: [-0.05, 0, 0], axis: [0, 0, 1], up: [0, -1, 0] }; }
  add(notebook);
  const pen = new THREE.Group();
  { const p = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6), mat('#2a4aa0')); p.rotation.x = Math.PI / 2; pen.add(p);
    const tip = mesh(new THREE.ConeGeometry(0.006, 0.015, 6), mat('#c0c4c8', { metal: 0.6 })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.072; pen.add(tip);
    pen.userData.grip = { pos: [0, 0, 0.02], axis: [0, 0, 1], up: [0, 1, 0] }; pen.userData.tip = [0, 0, 0.08]; }
  add(pen);
  const printer = new THREE.Group();
  { const b = mesh(chamferBox(0.09, 0.14, 0.045, 0.008), mat('#f2c230', { rough: 0.45 })); b.position.y = 0.07; printer.add(b);
    const scr = mesh(new THREE.PlaneGeometry(0.06, 0.04), mat('#5ad0ff', { emissive: '#3ab0e0', emissiveIntensity: 1.2 })); scr.position.set(0, 0.06, 0.0232); printer.add(scr);
    const slot = mesh(new THREE.BoxGeometry(0.07, 0.006, 0.012), mat('#111')); slot.position.set(0, 0.141, 0); printer.add(slot);
    printer.userData.grip = { pos: [0, 0.012, -0.01], axis: [1, 0, 0], up: [0, -1, 0] }; printer.userData.slot = [0, 0.145, 0]; }
  printer.scale.setScalar(1.45); add(printer);
  // receipt ribbon (dynamic strip)
  const MAXP = 2400;
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 2 * 3), 3));
  rGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAXP * 2 * 3), 3));
  rGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAXP * 2 * 2), 2));
  { const idx = []; for (let i = 0; i < MAXP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } rGeo.setIndex(idx); }
  const receipt = new THREE.Mesh(rGeo, M.paper); receipt.frustumCulled = false; receipt.castShadow = true; receipt.receiveShadow = true; receipt.name = 'receipt'; receipt.userData.noAudit = true; add(receipt);
  // giant ribbon for the skyline ending
  const giant = new THREE.Mesh(new THREE.BufferGeometry(), mat('#fbfaf6', { rough: 0.8, side: THREE.DoubleSide, emissive: '#ffd8b0', emissiveIntensity: 0.25 }));
  { const pts = []; const N = 160; for (let i = 0; i <= N; i++) { const u = i / N; pts.push(V(4 + Math.sin(u * 9) * 22, 10 + Math.sin(u * Math.PI) * 300 + Math.sin(u * 20) * 10, lerp(10, AIRPORT.z, u))); }
    const curve = new THREE.CatmullRomCurve3(pts); const pos = [], idx = [];
    for (let i = 0; i <= 300; i++) { const p = curve.getPointAt(i / 300), tg = curve.getTangentAt(i / 300), side = V(0, 1, 0).cross(tg).normalize().multiplyScalar(5.5); pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z); if (i < 300) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    giant.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); giant.geometry.setIndex(idx); giant.geometry.computeVertexNormals(); }
  giant.visible = false; giant.userData.noAudit = true; add(giant);

  // ---- public toilet room (far away)
  const toilet = new THREE.Group(); toilet.position.set(TOILET.x, 0, TOILET.z); add(toilet);
  { const tw = M.tileWhite; tw.map.repeat.set(4, 4);
    const fl = mesh(new THREE.BoxGeometry(3, 0.1, 3), tw); fl.position.y = -0.05; toilet.add(fl);
    const wallB = mesh(new THREE.BoxGeometry(3, 2.8, 0.1), tw); wallB.position.set(0, 1.4, -1.05); toilet.add(wallB);
    for (const sx of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.1, 2.8, 3), tw); w.position.set(sx * 0.95, 1.4, 0.2); toilet.add(w); }
    const ceil = mesh(new THREE.BoxGeometry(3, 0.1, 3), mat('#f4f6f8')); ceil.position.y = 2.85; toilet.add(ceil);
    const bowl = mesh(new THREE.LatheGeometry([[0.0, 0], [0.16, 0], [0.19, 0.2], [0.21, 0.38], [0.2, 0.4], [0, 0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 14), M.white); bowl.scale.set(1, 1, 1.25); bowl.position.set(0, 0, -0.6); toilet.add(bowl);
    const seat = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), M.white); seat.scale.z = 1.25; seat.position.set(0, 0.415, -0.6); toilet.add(seat);
    const tank = mesh(chamferBox(0.44, 0.38, 0.18, 0.03), M.white); tank.position.set(0, 0.62, -0.92); toilet.add(tank);
    const panel = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), M.chrome); panel.position.set(0.0, 1.1, -0.995); toilet.add(panel);
    const button = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14), mat('#e6eaee', { metal: 0.8, rough: 0.2 })); button.rotation.x = Math.PI / 2; button.position.set(0, 1.1, -0.98); toilet.add(button);
    const warn = mesh(new THREE.PlaneGeometry(0.3, 0.3), mat(T(warnCanvas(), { nearest: true }), { rough: 0.6, emissive: '#ff3030', emissiveIntensity: 0.0 })); warn.position.set(0.0, 1.5, -0.995); toilet.add(warn);
    toilet.userData.warn = warn; toilet.userData.button = button;
    const siren = mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff2020', { emissive: '#ff1010', emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })); siren.position.set(0, 2.8, -0.6); siren.rotation.x = Math.PI; toilet.add(siren);
    const beam = mesh(new THREE.ConeGeometry(0.35, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.userData.noAudit = true; beam.castShadow = false;
    beam.geometry.translate(0, -0.8, 0); beam.rotation.z = Math.PI / 2; const beamPivot = new THREE.Group(); beamPivot.position.set(0, 2.75, -0.6); beamPivot.add(beam); toilet.add(beamPivot);
    toilet.userData.siren = siren; toilet.userData.beamPivot = beamPivot;
    const roomLight = new THREE.PointLight(0xffffff, 6, 8, 2); roomLight.position.set(0, 2.5, 0.3); toilet.add(roomLight);
    const red = new THREE.PointLight(0xff2010, 0, 6, 2); red.position.set(0, 2.1, -0.2); toilet.add(red); toilet.userData.red = red;
    toilet.userData.roomLight = roomLight; }

  // ---- airport runway + plane
  const airport = new THREE.Group(); add(airport);
  { const rw = mesh(new THREE.PlaneGeometry(600, 60), mat('#55585e', { rough: 0.9 }), { cast: false }); rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.01, AIRPORT.z); airport.add(rw);
    for (let x = -280; x < 280; x += 14) { const m = mesh(new THREE.PlaneGeometry(8, 0.8), M.lane, { cast: false }); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, AIRPORT.z); airport.add(m); }
    const term = mesh(new THREE.BoxGeometry(140, 18, 30), M.glass[2]); term.position.set(-60, 9, AIRPORT.z - 80); airport.add(term); }
  const jet = plane(M); jet.position.set(AIRPORT.planeX, 0, AIRPORT.z); jet.rotation.y = Math.PI; add(jet);

  // ---- sky + lights
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunset: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform float sunset;
      void main(){ float h = clamp(vP.y, 0.0, 1.0);
        vec3 dayTop = vec3(0.32,0.58,0.92), dayHor = vec3(0.82,0.9,0.98);
        vec3 sunTop = vec3(0.32,0.2,0.48), sunHor = vec3(1.0,0.55,0.25);
        vec3 c = mix(mix(dayHor, dayTop, pow(h,0.6)), mix(sunHor, sunTop, pow(h,0.5)), sunset);
        vec3 sd = normalize(vec3(-0.2, 0.08, -1.0)); float s = max(dot(normalize(vP), sd), 0.0);
        c += sunset * (pow(s, 400.0) * vec3(1.0,0.85,0.5) * 2.0 + pow(s, 8.0) * vec3(0.5,0.25,0.1));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 16), skyMat); sky.userData.noAudit = true; sky.frustumCulled = false; scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe0ee, 260, 2000);
  const lights = {};
  lights.hemi = new THREE.HemisphereLight(0xe6f2ff, 0xa89a88, 1.1); add(lights.hemi);
  lights.sun = new THREE.DirectionalLight(0xfff1dc, 3.0); lights.sun.castShadow = true; lights.sun.shadow.mapSize.set(2048, 2048);
  lights.sun.shadow.bias = -0.0003; lights.sun.shadow.normalBias = 0.03; lights.sun.shadow.radius = 3;
  add(lights.sun); add(lights.sun.target);
  const baseI = { hemi: 1.1, sun: 3.0 };

  const props = { poop, robot, oranges, bag, coffee, splash, balloon, balloonString, notebook, pen, printer, receipt, giant, toilet, jet, sign, bus: theBus };
  const anchors = { poop: V(SPOTS.poop.pos[0], C, SPOTS.poop.pos[1]), curb: C };
  const state = {};
  const homes = new Map();
  for (const o of [poop, robot, bag, coffee, balloon, notebook, pen, printer, jet, ...oranges, ...splash]) homes.set(o, { p: o.position.clone(), q: o.quaternion.clone(), v: o.visible });

  function reset(t) {
    for (const [o, h] of homes) { o.position.copy(h.p); o.quaternion.copy(h.q); o.visible = h.v; o.scale.set(1, 1, 1); }
    Object.assign(state, {
      focus: [-1.6, C, 0.6], shadowSize: 9, sunset: 0, location: 'street', sparkle: 0, alarm: 0, siren: 0,
      receiptLen: receiptLength(t), receiptStart: null, pageInk: smooth(invLerp(32.8, 35.1, t)), giant: false, planeT: 0,
      orangesLanded: t >= 12.25, robot: t,
    });
    // props off-stage by default (shots place them)
    for (const o of [bag, coffee, notebook, pen, printer, balloon, ...splash]) o.visible = false;
    for (const o of oranges) o.visible = false;
    balloonString.visible = false;
  }

  // receipt length (m) over the story: starts 35.3, to the knees, to the ground, down the street, to the airport
  function receiptLength(t) {
    if (t < 35.3) return 0;
    if (t < 36.65) return lerp(0.0, 0.32, smooth((t - 35.3) / 1.35));
    if (t < 38.15) return lerp(0.32, 1.05, (t - 36.65) / 1.5);
    if (t < 39.55) return lerp(1.05, 4.5, (t - 38.15) / 1.4);
    if (t < 41.1) return lerp(4.5, 300, Math.pow((t - 39.55) / 1.55, 1.5));
    return lerp(300, 457.5, 1 - Math.pow(1 - clamp((t - 41.1) / 1.4), 2.5)); // path is 456.1 m: the end bumps the nose tyre at ~42.25
  }

  // receipt path: from the printer slot, hanging down, loops on the ground, to the road, down the street, to the runway
  let pathCache = null;
  function buildPath(start, dir) {
    const key = start.toArray().concat(dir.toArray()).map((v) => v.toFixed(3)).join(',');
    if (pathCache && pathCache.key === key) return pathCache;
    const pts = [];
    const push = (p) => pts.push(p.clone());
    const g = C + 0.003;
    // out of the slot: up a little, curl forward over the front, then hang down to the ground
    const fw = V(dir.x, 0, dir.z).normalize();
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 0.85; push(start.clone().addScaledVector(fw, 0.025 * (1 - Math.cos(a))).add(V(0, 0.02 * Math.sin(a), 0))); }
    const top = pts[pts.length - 1].clone();
    const hang = 24; for (let i = 1; i <= hang; i++) { const u = i / hang; push(V(top.x + fw.x * 0.01 * u + Math.sin(u * 3) * 0.006, lerp(top.y, g, u), top.z + fw.z * 0.01 * u)); }
    // loops on the ground in front of the feet
    const c0 = V(top.x + fw.x * 0.15, g, top.z + fw.z * 0.15);
    for (let i = 1; i <= 120; i++) { const u = i / 120, a = u * Math.PI * 2 * 3, r = 0.12 + u * 0.22; push(V(c0.x + Math.cos(a) * r, g + u * 0.012, c0.z + Math.sin(a) * r)); }
    // across the sidewalk to the curb and down onto the road
    const last = pts[pts.length - 1].clone();
    const toCurb = V(STREET.walkMaxX - 0.05, g, last.z + 1.2);
    const wideFrom = pts.length;            // from here on the paper gets wider (cartoon: it must read in the far shots)
    for (let i = 1; i <= 30; i++) push(last.clone().lerp(toCurb, i / 30));
    push(V(STREET.walkMaxX + 0.12, C * 0.5, toCurb.z)); push(V(STREET.walkMaxX + 0.3, 0.004, toCurb.z - 0.3));
    // down the road (gentle wiggle) to the runway
    const z0 = toCurb.z - 0.3;
    for (let z = z0 - 1; z > AIRPORT.z + 17; z -= 1.6) push(V(4.0 + Math.sin(z * 0.08) * 0.6, z < AIRPORT.z + 31 ? 0.022 : 0.006, z));
    // last bit: swing over to the plane's nose (x planeX-12), then run straight in and stop right at the nose tyre
    { const a = pts[pts.length - 1].clone(), nx = AIRPORT.planeX - 12;
      for (let i = 1; i <= 24; i++) { const u = i / 24; push(V(lerp(a.x, nx, smooth(u)), 0.022, lerp(a.z, AIRPORT.z + 9, u))); }
      for (let i = 1; i <= 12; i++) push(V(nx, 0.022, lerp(AIRPORT.z + 9, AIRPORT.z + 0.45, i / 12))); }
    // arc lengths
    const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const hw = pts.map((p, i) => lerp(0.029, 0.1, smooth(clamp((i - wideFrom) / 32))) * lerp(1, 2.0, smooth(clamp((-p.z - 300) / 120))));
    pathCache = { key, pts, s, hw };
    return pathCache;
  }
  function updateReceipt(len, start, dir) {
    if (!(len > 0.002) || !start) { receipt.visible = false; return; }
    const P = buildPath(start, dir);
    const pos = rGeo.attributes.position, nor = rGeo.attributes.normal, uv = rGeo.attributes.uv;
    let n = 0;
    // take path points up to length len (the paper comes out of the slot: the far end is the oldest part)
    let i = 0;
    const N = Math.min(MAXP, P.pts.length);
    for (; i < N && P.s[i] <= len; i++) {
      const p = P.pts[i], q = P.pts[Math.min(i + 1, P.pts.length - 1)], pp = P.pts[Math.max(i - 1, 0)];
      const tg = q.clone().sub(pp).normalize();
      let side = V(0, 1, 0).cross(tg); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
      if (Math.abs(tg.y) > 0.7) side.set(1, 0, 0);
      const nrm = tg.clone().cross(side).normalize(), half = P.hw[i];
      pos.setXYZ(n * 2, p.x - side.x * half, p.y - side.y * half, p.z - side.z * half);
      pos.setXYZ(n * 2 + 1, p.x + side.x * half, p.y + side.y * half, p.z + side.z * half);
      nor.setXYZ(n * 2, nrm.x, nrm.y, nrm.z); nor.setXYZ(n * 2 + 1, nrm.x, nrm.y, nrm.z);
      uv.setXY(n * 2, 0, P.s[i] / 0.12); uv.setXY(n * 2 + 1, 1, P.s[i] / 0.12);
      n++;
    }
    pos.needsUpdate = nor.needsUpdate = uv.needsUpdate = true;
    rGeo.setDrawRange(0, Math.max(0, (n - 1) * 6));
    receipt.visible = n > 1;
  }

  function commit(ctx) {
    const t = ctx.t, st = state;
    // sun + shadow camera follow the focus point of the shot
    const f = V(...st.focus), ss = st.shadowSize;
    const sunDir = st.sunset > 0.5 ? V(-20, 10, -60).normalize() : V(30, 55, 25).normalize();
    lights.sun.position.copy(f).addScaledVector(sunDir, 60); lights.sun.target.position.copy(f);
    Object.assign(lights.sun.shadow.camera, { left: -ss, right: ss, top: ss, bottom: -ss, near: 1, far: 160 }); lights.sun.shadow.camera.updateProjectionMatrix();
    lights.sun.color.set(st.sunset > 0.5 ? 0xffa060 : 0xfff1dc); lights.sun.intensity = st.location === 'toilet' ? 0 : baseI.sun * (st.sunset > 0.5 ? 0.8 : 1);
    lights.hemi.color.set(st.sunset > 0.5 ? 0xb08acf : 0xe6f2ff); lights.hemi.intensity = st.location === 'toilet' ? 0.25 : baseI.hemi;
    skyMat.uniforms.sunset.value = st.sunset;
    scene.fog.color.set(st.sunset > 0.5 ? 0xd89a7a : 0xcfe0ee);
    sky.position.copy(ctx.camera.position);
    // robot slowly polishing in circles
    const a = st.robot * 0.6; robot.position.set(SPOTS.robot.pos[0] + Math.cos(a) * 0.5, C, SPOTS.robot.pos[1] + Math.sin(a) * 0.35); robot.rotation.y = -a + Math.PI / 2; robot.userData.brush.rotation.y = st.robot * 20;
    // receipt
    updateReceipt(st.receiptLen, st.receiptStart ? V(...st.receiptStart) : null, V(...(st.receiptDir || [0, 0, 1])));
    giant.visible = !!st.giant;
    jet.scale.setScalar(st.giant ? 2.4 : 1);
    // toilet alarm
    const tl = toilet.userData;
    tl.warn.material.emissiveIntensity = st.alarm * (0.6 + 0.4 * Math.sin(t * 14));
    tl.red.intensity = st.siren * 2.6 * (0.45 + 0.55 * Math.max(0, Math.sin(t * 12)));
    tl.roomLight.intensity = 6 * (1 - 0.85 * st.siren);
    tl.siren.material.emissiveIntensity = 0.5 + st.siren * 2.5;
    tl.beamPivot.rotation.y = t * 7; tl.beamPivot.visible = st.siren > 0.05;
    // notebook ink grows while he writes
    if (st.pageInk !== pageCtx._ink) {
      pageCtx._ink = st.pageInk;
      pageCtx.fillStyle = '#f6f2e6'; pageCtx.fillRect(0, 0, 64, 80); pageCtx.fillStyle = '#9ab8d8'; for (let y = 10; y < 80; y += 7) pageCtx.fillRect(0, y, 64, 1);
      pageCtx.strokeStyle = '#1a2a6a'; pageCtx.lineWidth = 1.4; const Rr = rng(4); const rows = Math.floor(st.pageInk * 10);
      for (let r = 0; r < rows; r++) { pageCtx.beginPath(); let x = 4; pageCtx.moveTo(x, 8 + r * 7); while (x < 58) { x += 2 + Rr() * 3; pageCtx.lineTo(x, 8 + r * 7 - Rr() * 4); } pageCtx.stroke(); }
      pageTex.needsUpdate = true;
    }
    // plane take-off (s29)
    if (st.planeT > 0) { const u = st.planeT; jet.position.set(AIRPORT.planeX - u * 120, Math.max(0, (u - 0.15)) * 300, AIRPORT.z - 40); jet.rotation.z = -Math.min(0.3, Math.max(0, u - 0.15) * 0.8); }
  }

  return { group, colliders, props, anchors, state, lights, materials: M, reset, commit, receiptLength, receiptPathLength: () => (pathCache ? pathCache.s[pathCache.s.length - 1] : 0) };
}
