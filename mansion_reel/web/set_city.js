// The city street (shots 1-4): a row of old buildings with shops (cafe, pizza, mini mart) facing -Z, sidewalk,
// road, lamps, YOU's cardboard spot against a brick wall, "CUSTOMERS ONLY" signs.
import * as THREE from 'three';
import { mat, tex, clamp, rng, paint, hexToRgb, noise2 } from './lib.js';
import { STREET } from './layout.js';
import { brickCanvas, plasterCanvas, slabCanvas, asphaltCanvas, windowCanvas, awningCanvas, shutterCanvas, cardboardFlatCanvas, signCanvas, stoneCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];

function named(m, n) { m.name = `set.city.${n}`; return m; }
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return named(m, n); }
function boxAt(g, w, h, d, material, x, y, z, n, o = {}) { const m = msh(new THREE.BoxGeometry(w, h, d), material, n, o); m.position.set(x, y, z); g.add(m); return m; }
function quad(g, w, h, material, x, y, z, n, ry = Math.PI) { const m = msh(new THREE.PlaneGeometry(w, h), material, n, { cast: false }); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; }

// upper-floor facade: base wall + window grid painted in (one canvas per building)
function facadeCanvas(o) {
  const W = 64, H = Math.round(64 * o.h / o.w * 1.0 / 1) | 0;
  const HH = Math.max(32, Math.min(256, Math.round(64 * o.h / o.w)));
  const R = rng(o.seed), N = noise2(64, 64, 8, o.seed + 1);
  const brick = o.brick ? brickCanvas(o.base, '#b9a58c', o.seed).getContext('2d').getImageData(0, 0, 64, 64).data : null;
  const b = hexToRgb(o.base), frame = hexToRgb(o.frame || '#e8e0d0');
  const cols = o.cols, rows = o.rows;
  const lit = Array.from({ length: 64 }, () => R() < 0.3);
  return paint(W, HH, (x, y) => {
    let c;
    if (brick) { const i = ((y % 64) * 64 + (x % 64)) * 4; c = [brick[i], brick[i + 1], brick[i + 2]]; }
    else c = add(b, (N[(y % 64) * 64 + x] - 0.5) * 18 + (R() - 0.5) * 6);
    if (y < 4) return add(frame, -20 + (R() - 0.5) * 8);                       // cornice
    if (y < 7) return add(frame, 10);
    const cw = W / cols, rh = (HH - 10) / rows;
    const cx = x % cw, ry = (y - 9) % rh, ci = Math.floor(x / cw), ri = Math.floor((y - 9) / rh);
    if (y >= 9 && ri < rows) {
      const wx0 = cw * 0.24, wx1 = cw * 0.76, wy0 = rh * 0.16, wy1 = rh * 0.78;
      if (cx > wx0 - 1 && cx < wx1 + 1 && ry > wy0 - 1 && ry < wy1 + 2) {
        if (ry > wy1 && ry < wy1 + 2) return add(frame, -8);                      // sill
        if (cx < wx0 || cx > wx1 || ry < wy0) return frame;                        // frame
        const L = lit[(ci * 7 + ri * 3) % 64];
        let g = L ? [228, 176, 104] : [52, 62, 78];
        if (Math.abs(cx - (wx0 + wx1) / 2) < 0.6) return frame;                   // mullion
        if (!L && ((cx + ry) % 9) < 2) g = [120, 140, 160];                       // reflection
        if (L && ry < wy0 + 3) g = [180, 60, 50];                                 // curtain top
        return add(g, (R() - 0.5) * 8);
      }
    }
    return c;
  });
}

export function buildCity() {
  const g = new THREE.Group(); g.name = 'set.city';
  const sy = STREET.sideY;
  const T = (c, r = [1, 1]) => tex(c, { repeat: r });
  // ---------------------------------------------------------------- ground: sidewalk, curb, road, far sidewalk
  const span = STREET.x1 - STREET.x0, cx = (STREET.x0 + STREET.x1) / 2;
  const walk = boxAt(g, span, sy, -STREET.curbZ, mat(T(slabCanvas('#a9a59c'), [span / 1.6, -STREET.curbZ / 1.6]), { rough: 0.95 }), cx, sy / 2, STREET.curbZ / 2, 'sidewalk', { cast: false });
  boxAt(g, span, sy + 0.02, 0.24, mat(T(stoneCanvas('#9a968e'), [span / 2, 1])), cx, (sy + 0.02) / 2, STREET.curbZ + 0.12, 'curb', { cast: false });
  const roadW = STREET.curbZ - STREET.roadZ1;
  const road = msh(new THREE.PlaneGeometry(span, roadW), mat(T(asphaltCanvas(), [span / 4, roadW / 4]), { rough: 0.95 }), 'road', { cast: false });
  road.rotation.x = -Math.PI / 2; road.position.set(cx, 0, (STREET.curbZ + STREET.roadZ1) / 2); g.add(road);
  const lineM = mat('#e8e2c8', { rough: 0.8 });
  for (let x = STREET.x0 + 1; x < STREET.x1; x += 4.5) { const l = msh(new THREE.PlaneGeometry(2.2, 0.14), lineM, 'laneLine', { cast: false }); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.006, (STREET.curbZ + STREET.roadZ1) / 2); g.add(l); }
  boxAt(g, span, sy, 3.4, mat(T(slabCanvas('#a3a097', 15), [span / 1.6, 2])), cx, sy / 2, STREET.roadZ1 - 1.7, 'farSidewalk', { cast: false });

  // ---------------------------------------------------------------- building row (facades face -Z)
  const BUILDINGS = [
    { x0: -34, x1: -24, h: 12, base: '#b6a58a', rows: 3, cols: 4, seed: 1 },
    { x0: -24, x1: -14.5, h: 15, base: '#8e4430', brick: true, rows: 4, cols: 4, seed: 2 },
    { x0: -14.5, x1: -6, h: 11, base: '#7d8a96', rows: 3, cols: 3, seed: 3 },
    { x0: -6, x1: 1.6, h: 13.5, base: '#9a4a34', brick: true, rows: 3, cols: 3, seed: 4, ground: 'brick' },  // YOU's wall
    { x0: 1.6, x1: 7.6, h: 12, base: '#d8c39a', rows: 3, cols: 3, seed: 5, shop: 0 },
    { x0: 7.6, x1: 14.2, h: 14.5, base: '#a95a3c', brick: true, rows: 4, cols: 3, seed: 6, shop: 1 },
    { x0: 14.2, x1: 20.8, h: 11.5, base: '#9fb0a0', rows: 3, cols: 3, seed: 7, shop: 2 },
    { x0: 20.8, x1: 30, h: 16, base: '#c9b48c', rows: 4, cols: 4, seed: 8 },
    { x0: 30, x1: 40, h: 12.5, base: '#8a4a3a', brick: true, rows: 3, cols: 4, seed: 9 },
  ];
  const GF = 3.5;      // ground floor height
  for (const b of BUILDINGS) {
    const w = b.x1 - b.x0, xc = (b.x0 + b.x1) / 2, D = 10;
    // body (sides + roof), front upper facade as a textured box face
    const body = boxAt(g, w, b.h - GF, D, mat(T(b.brick ? brickCanvas(b.base, '#b9a58c', b.seed) : plasterCanvas(b.base, b.seed), [w / 2.5, (b.h - GF) / 2.5])), xc, GF + (b.h - GF) / 2, D / 2 + 0.02, `body${b.seed}`);
    const front = quad(g, w, b.h - GF, mat(tex(facadeCanvas({ ...b, w, h: b.h - GF })), { rough: 0.9 }), xc, GF + (b.h - GF) / 2, -0.005, `facade${b.seed}`);
    front.receiveShadow = true;
    boxAt(g, w + 0.1, 0.35, 0.35, mat('#d9d0bc'), xc, b.h + 0.1, -0.05, `cornice${b.seed}`);
    boxAt(g, w, 0.22, 0.25, mat('#cfc6b0'), xc, GF + 0.05, -0.08, `beltCourse${b.seed}`);
    // ground floor block (behind the shopfronts)
    boxAt(g, w, GF, D, mat(T(b.brick ? brickCanvas(b.base, '#b9a58c', b.seed + 20) : plasterCanvas(b.base, b.seed + 20), [w / 2.5, GF / 2.5])), xc, GF / 2, D / 2 + 0.3, `ground${b.seed}`);
    if (b.shop == null) {
      // plain ground floor: pilasters + a closed shutter or an apartment door
      const brickM = mat(T(b.brick ? brickCanvas(b.base, '#b9a58c', b.seed + 30) : plasterCanvas(b.base, b.seed + 30), [w / 2.5, GF / 2.5]));
      quad(g, w, GF, brickM, xc, GF / 2, 0.28, `gfWall${b.seed}`);
      if (b.ground !== 'brick') {
        boxAt(g, w * 0.5, 2.6, 0.08, mat(T(shutterCanvas(b.seed), [1, 3])), xc - w * 0.12, 1.3 + sy, 0.24, `shutter${b.seed}`, { cast: false });
      }
    }
  }
  // YOU's wall: brick ground floor with a closed shutter shop to the left, drain pipe, a little poster-free wall
  const youX = STREET.sit.pos[0];
  boxAt(g, 3.2, 2.7, 0.08, mat(T(shutterCanvas(31), [1, 3])), -4.45, sy + 1.35, 0.25, 'shutterYou', { cast: false });
  boxAt(g, 3.4, 0.25, 0.3, mat('#5a5048'), -4.45, sy + 2.85, 0.15, 'shutterBox');
  const pipeM = mat('#4a5a5a', { rough: 0.6, metal: 0.3 });
  const pipe = msh(new THREE.CylinderGeometry(0.06, 0.06, 13, 8), pipeM, 'drainPipe'); pipe.position.set(youX + 1.25, 6.5, 0.2); g.add(pipe);
  boxAt(g, 0.18, 0.12, 0.3, pipeM, youX + 1.25, 0.2, 0.05, 'pipeShoe');
  // cardboard + tin cup + a plastic bag
  const card = msh(new THREE.BoxGeometry(1.15, 0.015, 0.95), mat(tex(cardboardFlatCanvas())), 'cardboard'); card.position.set(youX + 0.05, sy + 0.008, -0.62); card.rotation.y = 0.06; g.add(card);
  const cardUp = msh(new THREE.BoxGeometry(0.9, 0.7, 0.012), mat(tex(cardboardFlatCanvas(8))), 'cardboardBack'); cardUp.position.set(youX - 0.05, sy + 0.35, 0.22); cardUp.rotation.set(-0.1, 0.05, 0); g.add(cardUp);
  const cupM = mat('#9aa0a4', { rough: 0.35, metal: 0.7 });
  const cup = msh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10, 1, true), cupM, 'tinCup'); cup.position.set(youX + 0.62, sy + 0.05, -0.95); g.add(cup);
  const bag = msh(new THREE.IcosahedronGeometry(0.17, 1), mat('#cfd2c8', { rough: 0.5 }), 'bag'); bag.scale.set(1, 0.7, 0.8); bag.position.set(youX - 0.75, sy + 0.12, -0.25); g.add(bag);
  // trash can + hydrant + lamps + bench-less sidewalk props
  const canM = mat('#3d5a46', { rough: 0.6, metal: 0.3 });
  const can = msh(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 10), canM, 'trashCan'); can.position.set(youX - 2.2, sy + 0.45, -0.55); g.add(can);
  const lid = msh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), canM, 'trashLid'); lid.position.set(youX - 2.2, sy + 0.93, -0.55); g.add(lid);
  const hyM = mat('#c8281e', { rough: 0.5, metal: 0.2 });
  const hy = msh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), hyM, 'hydrant'); hy.position.set(1.0, sy + 0.3, -2.6); g.add(hy);
  const hyT = msh(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), hyM, 'hydrantTop'); hyT.position.set(1.0, sy + 0.6, -2.6); g.add(hyT);
  const lampM = mat('#2c3330', { rough: 0.5, metal: 0.4 });
  const glassM = mat('#fff0c8', { emissive: '#ffd890', emissiveIntensity: 0.6 });
  for (const x of [-27, -14, -9.5, 23, 34]) {
    const pole = msh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8), lampM, 'lampPole'); pole.position.set(x, sy + 2.3, -2.8); g.add(pole);
    const arm = boxAt(g, 0.08, 0.08, 0.7, lampM, x, sy + 4.55, -2.5, 'lampArm');
    const head = msh(new THREE.CylinderGeometry(0.12, 0.26, 0.28, 8), lampM, 'lampHead'); head.position.set(x, sy + 4.5, -2.15); g.add(head);
    const bulb = msh(new THREE.SphereGeometry(0.11, 8, 5), glassM, 'lampBulb', { cast: false }); bulb.position.set(x, sy + 4.36, -2.15); g.add(bulb);
  }
  // parked cars (simple low-poly)
  const car = (x, z, col, ry) => {
    const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; g.add(cg);
    const bodyM = mat(col, { rough: 0.35, metal: 0.25 });
    boxAt(cg, 1.8, 0.62, 4.3, bodyM, 0, 0.62, 0, 'carBody');
    const cab = msh(new THREE.BoxGeometry(1.6, 0.55, 2.2), bodyM, 'carCab'); cab.position.set(0, 1.18, -0.2); g.add(cab); cg.add(cab);
    const winM = mat('#2a3644', { rough: 0.15, metal: 0.4 });
    for (const sd of [-1, 1]) { const wq = msh(new THREE.PlaneGeometry(2.0, 0.42), winM, 'carWin', { cast: false }); wq.position.set(sd * 0.805, 1.2, -0.2); wq.rotation.y = sd * Math.PI / 2; cg.add(wq); }
    const ws = msh(new THREE.PlaneGeometry(1.5, 0.5), winM, 'carWindshield', { cast: false }); ws.position.set(0, 1.2, 0.905); cg.add(ws);
    const tireM = mat('#1a1a1c', { rough: 0.9 });
    for (const [tx, tz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) { const w2 = msh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), tireM, 'tire'); w2.rotation.z = Math.PI / 2; w2.position.set(tx, 0.34, tz); cg.add(w2); }
  };
  car(-15, -4.6, '#3b6aa8', Math.PI / 2);
  car(27, -4.6, '#c94a2a', Math.PI / 2);
  car(-2, -9.2, '#e3c24a', -Math.PI / 2);
  // far side buildings (facing +Z)
  for (let i = 0; i < 9; i++) {
    const x0 = STREET.x0 + i * 8.4, w = 8.2, h = 10 + ((i * 7) % 5) * 1.6, xc = x0 + w / 2;
    const base = ['#b39b80', '#8a5a44', '#9aa6b0', '#c4b08a', '#7e4a3a'][i % 5];
    boxAt(g, w, h, 8, mat(T(plasterCanvas(base, 70 + i), [w / 2.5, h / 2.5])), xc, h / 2, STREET.farZ - 4, `farBody${i}`);
    const f = quad(g, w, h - 3.5, mat(tex(facadeCanvas({ base, w, h: h - 3.5, rows: 3, cols: 4, seed: 80 + i }))), xc, 3.5 + (h - 3.5) / 2, STREET.farZ + 0.005, `farFacade${i}`, 0);
    quad(g, w, 3.5, mat(tex(windowCanvas({ seed: 90 + i, inside: '#4a3a30', mullion: true }), { repeat: [2, 1] })), xc, 1.75, STREET.farZ + 0.005, `farShop${i}`, 0);
  }

  // ---------------------------------------------------------------- the three shops
  const shops = [];
  const KIND = {
    cafe: { name: 'CAFE', col: '#2f5e3e', awn: ['#f2ede0', '#2f6a44'], inside: '#6a4528', board: '#2f5e3e', text: '#f6e8c8' },
    pizza: { name: 'PIZZA', col: '#8a2a22', awn: ['#f2ede0', '#c0301e'], inside: '#7a3a1e', board: '#1f6a34', text: '#ffffff' },
    store: { name: 'MINI MART', col: '#244e8a', awn: ['#f2ede0', '#2a5ea8'], inside: '#c8d8e0', board: '#2a5ea8', text: '#ffe060' },
  };
  STREET.shops.forEach((sh, i) => {
    const K = KIND[sh.kind], x = sh.x, frameM = mat(K.col, { rough: 0.6 });
    const sg = new THREE.Group(); sg.name = `set.city.shop.${sh.kind}`; g.add(sg);
    // shopfront frame: pilasters + lintel
    boxAt(sg, 0.35, GF, 0.3, frameM, x - 2.95, GF / 2, -0.05, 'pilasterL');
    boxAt(sg, 0.35, GF, 0.3, frameM, x + 2.95, GF / 2, -0.05, 'pilasterR');
    boxAt(sg, 6.2, 0.55, 0.3, frameM, x, GF - 0.27, -0.05, 'lintel');
    // sign board with the shop name
    const board = msh(new THREE.BoxGeometry(4.2, 0.6, 0.12), [frameM, frameM, frameM, frameM, mat(tex(signCanvas([K.name], { w: 256, h: 40, bg: K.board, color: K.text, scale: 0.9 })), { emissive: '#ffffff', emissiveIntensity: 0.12 }), frameM], 'nameBoard');
    board.position.set(x, GF + 0.35, -0.12); board.rotation.y = Math.PI; sg.add(board);
    // big window (left of the door) + small window right of the door
    const win = quad(sg, 3.0, 2.3, mat(tex(windowCanvas({ seed: 40 + i, inside: K.inside, shelves: sh.kind === 'store', mullion: sh.kind !== 'store' })), { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.08 }), x - 1.25, 1.55, 0.06, 'window');
    boxAt(sg, 3.1, 0.35, 0.35, frameM, x - 1.25, 0.25, -0.04, 'sill');
    quad(sg, 0.85, 2.3, mat(tex(windowCanvas({ seed: 50 + i, inside: K.inside })), { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.08 }), x + 1.85, 1.55, 0.06, 'window2');
    // door opening: dark warm interior box behind, door leaf swung open inward
    const dw = STREET.doorW, dh = STREET.doorH;
    const inner = msh(new THREE.BoxGeometry(dw, dh, 1.2), mat(K.inside, { rough: 0.9, side: THREE.BackSide }), 'doorInside', { cast: false });
    inner.position.set(x + 0.7, sy + dh / 2, 0.62); sg.add(inner);
    const leaf = msh(new THREE.BoxGeometry(dw, dh, 0.05), [frameM, frameM, frameM, frameM, frameM, frameM], 'doorLeaf');
    leaf.geometry.translate(dw / 2, 0, 0);
    leaf.position.set(x + 0.7 - dw / 2, sy + dh / 2, 0.05); leaf.rotation.y = -1.9; sg.add(leaf);
    boxAt(sg, 0.12, dh + 0.12, 0.3, frameM, x + 0.7 - dw / 2 - 0.06, sy + dh / 2, -0.04, 'doorFrameL');
    boxAt(sg, 0.12, dh + 0.12, 0.3, frameM, x + 0.7 + dw / 2 + 0.06, sy + dh / 2, -0.04, 'doorFrameR');
    boxAt(sg, dw + 0.24, 0.14, 0.3, frameM, x + 0.7, sy + dh + 0.07, -0.04, 'doorFrameTop');
    // awning (sloped, striped) with a valance
    const aw = msh(new THREE.PlaneGeometry(6.2, 1.5), mat(tex(awningCanvas(K.awn[0], K.awn[1], i), { repeat: [6, 1] }), { side: THREE.DoubleSide }), 'awning');
    aw.position.set(x, GF - 0.85, -0.65); aw.rotation.set(-Math.PI / 2 + 0.55, Math.PI, 0); sg.add(aw);
    const val = quad(sg, 6.2, 0.28, mat(tex(awningCanvas(K.awn[0], K.awn[1], i + 5), { repeat: [6, 1] }), { side: THREE.DoubleSide }), x, GF - 1.45, -1.28, 'valance');
    // the "CUSTOMERS ONLY" sign in the small window, at eye level
    const sign = msh(new THREE.BoxGeometry(0.62, 0.42, 0.015), [mat('#ddd'), mat('#ddd'), mat('#ddd'), mat('#ddd'),
      mat(tex(signCanvas(['CUSTOMERS', 'ONLY'], { w: 160, h: 108, bg: '#fbf8ee', color: '#c4161c', border: '#c4161c', borderW: 6, scale: 0.78 }), { nearest: true }), { emissive: '#ffffff', emissiveIntensity: 0.15 }), mat('#ddd')], 'signCustomersOnly', { cast: false });
    sign.position.set(x + 1.85, 1.62, 0.03); sign.rotation.y = Math.PI; sg.add(sign);
    shops.push({ ...sh, group: sg, sign, signPos: V(x + 1.85, 1.62, 0.02), doorX: x + 0.7 });
  });
  // a small pizza slice sign + cafe chalkboard (life)
  const chalk = msh(new THREE.BoxGeometry(0.6, 0.85, 0.05), mat('#22302a', { rough: 0.9 }), 'chalkboard'); chalk.position.set(STREET.shops[0].x - 2.3, sy + 0.5, -1.0); chalk.rotation.set(-0.18, Math.PI + 0.3, 0); g.add(chalk);
  const pot = (x, z) => { const p = msh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 8), mat('#9a5a3a'), 'planter'); p.position.set(x, sy + 0.21, z); g.add(p);
    const b = msh(new THREE.IcosahedronGeometry(0.3, 1), mat('#3e7a36', { rough: 0.9 }), 'planterBush'); b.position.set(x, sy + 0.62, z); g.add(b); };
  pot(STREET.shops[0].x + 2.6, -0.5); pot(STREET.shops[1].x - 2.6, -0.5);

  return { group: g, shops };
}
