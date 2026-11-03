// The HOUSE (American family): warm living room (sofa, tea + cookies, front door + doorbell, dining table, kitchen corner
// with the pressure cooker) + the small bathroom behind the door in the right wall. Place contract: see set.js.
// state: doorOpen 0..1 (swings into the bathroom), doorShake 0..1, tumble {x, z, rot} | null (indoor tumbleweed),
//        candles 0..1 (lit), clockMin (minute hand, rad), bathLight 0..1, heroGlow 0..1 (light from the bathroom)
import * as THREE from 'three';
import { mat, tex, paint, clamp, lerp, smooth, hash1, noise1, hexToRgb, chamferBox } from './lib.js';
import { HOUSE } from './layout.js';
import { plasterCanvas, doorCanvas, signCanvas, glowDiscCanvas, carpetCanvas } from './set_tex2.js';
import { planksCanvas, velvetCanvas } from './set_rest_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = HOUSE.room, B = HOUSE.bath, D = HOUSE.door;

function tileCanvas(base = '#7ab8e8', grout = '#d8e6f0', accent = '#3a7ac8', seed = 3) {
  return paint(32, 32, (x, y) => {
    if (x % 8 === 0 || y % 8 === 0) return hexToRgb(grout);
    const tx = Math.floor(x / 8), ty = Math.floor(y / 8);
    const c = (tx + ty * 3 + seed) % 7 === 0 ? hexToRgb(accent) : hexToRgb(base);
    const n = (hash1(tx * 13 + ty * 7 + seed) - 0.5) * 10 + ((x % 8 === 1 || y % 8 === 1) ? 10 : 0);
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}
function floorTileCanvas() {
  return paint(16, 16, (x, y) => {
    const k = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
    const c = k ? [232, 230, 222] : [70, 92, 112];
    const n = (hash1(x * 3 + y * 17) - 0.5) * 8;
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}
function stripeWallCanvas() {   // warm cream wallpaper with a small pixel diamond pattern
  return paint(32, 32, (x, y) => {
    let c = [232, 214, 178];
    if (x % 16 < 1) c = [218, 196, 156];
    if ((Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4)) === 3) c = [214, 188, 146];
    const n = (hash1(x * 7 + y * 31) - 0.5) * 6;
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}
function dotsCanvas(bg, dot) {   // party table cloth / gift wrap
  const b = hexToRgb(bg), d = hexToRgb(dot);
  return paint(16, 16, (x, y) => ((((x + 2) % 8) - 4) ** 2 + (((y + 2) % 8) - 4) ** 2 < 4.5 ? d : b));
}
function stripesCanvas(c1, c2) { const a = hexToRgb(c1), b = hexToRgb(c2); return paint(16, 16, (x, y) => ((x + y) % 8 < 4 ? a : b)); }
function windowViewCanvas() {    // bright day outside: blue sky, a tree, a hedge
  return paint(64, 64, (x, y) => {
    if (y > 44) return [70 + hash1(x * 3 + y) * 20, 140 + hash1(x + y * 5) * 30, 60];
    const tree = Math.hypot(x - 18, y - 22) < 15 - hash1(x * 7 + y * 3) * 3;
    if (tree) return [60 + hash1(x * 11 + y) * 30, 120 + hash1(x * 5 + y * 9) * 40, 50];
    const cl = Math.hypot((x - 46) * 0.6, y - 12) < 6;
    return cl ? [250, 250, 252] : [130 + y, 190 + y * 0.6, 245];
  });
}
function clockCanvas() {
  return paint(32, 32, (x, y) => {
    const d = Math.hypot(x - 15.5, y - 15.5);
    if (d > 15.5) return [0, 0, 0, 0];
    if (d > 13.5) return [200, 60, 60];
    const a = Math.atan2(y - 15.5, x - 15.5), tick = Math.abs(Math.sin(a * 6)) < 0.12 && d > 10.5;
    return tick ? [40, 40, 40] : [250, 248, 240];
  });
}

export function buildHouse(env) {
  const group = new THREE.Group(); group.name = 'set.house';
  const add = (m, name, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; if (name) m.name = `set.house.${name}`; group.add(m); return m; };
  const boxAt = (w, h, d, material, x, y, z, name, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return add(m, name, cast); };
  const plane = (w, h, material, pos, rotY = 0, rotX = 0, name) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(...pos); m.rotation.set(rotX, rotY, 0, 'YXZ'); return add(m, name, false); };
  const gloss = (c, r = 0.25) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, envMap: env, envMapIntensity: 0.7 }); return m; };

  // ---------------------------------------------------------------- living room shell (planes facing inward)
  const W = R.x1 - R.x0, Dp = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  const floorM = mat(tex(planksCanvas({ base: '#b88654', dark: '#7a5230', plank: 8 }), { repeat: [W / 1.6, Dp / 3.2] }), { rough: 0.55 });
  plane(W, Dp, floorM, [cx, 0, cz], 0, -Math.PI / 2, 'floor');
  const wallM = mat(tex(stripeWallCanvas(), { repeat: [W / 0.9, R.ceil / 0.9] }), { rough: 0.9 });
  const wallMz = mat(tex(stripeWallCanvas(), { repeat: [Dp / 0.9, R.ceil / 0.9] }), { rough: 0.9 });
  plane(W, R.ceil, wallM, [cx, R.ceil / 2, R.z1], Math.PI, 0, 'wallBack');
  plane(W, R.ceil, wallM, [cx, R.ceil / 2, R.z0], 0, 0, 'wallFront');
  { const zA = HOUSE.front.z + HOUSE.front.w / 2 + 0.5, len = R.z1 - zA;          // left wall behind the front-door section
    const wl = mat(tex(stripeWallCanvas(), { repeat: [len / 0.9, R.ceil / 0.9] }), { rough: 0.9 });
    plane(len, R.ceil, wl, [R.x0, R.ceil / 2, (zA + R.z1) / 2], Math.PI / 2, 0, 'wallLeft'); }
  const ceilM = mat(tex(plasterCanvas('#f6f2ea', 7, 6), { repeat: [4, 4] }), { rough: 0.95 });
  plane(W, Dp, ceilM, [cx, R.ceil, cz], 0, Math.PI / 2, 'ceiling');
  // right wall (x = 4.0) with the bathroom door opening: three boxes around the hole (seen from both rooms)
  const dz0 = D.z - D.w / 2, dz1 = D.z + D.w / 2;
  const wallR = mat(tex(stripeWallCanvas(), { repeat: [2, R.ceil / 0.9] }), { rough: 0.9 });
  boxAt(0.12, R.ceil, dz0 - R.z0, wallR, D.x, R.ceil / 2, (R.z0 + dz0) / 2, 'wallR1', false);
  boxAt(0.12, R.ceil, R.z1 - dz1, wallR, D.x, R.ceil / 2, (dz1 + R.z1) / 2, 'wallR2', false);
  boxAt(0.12, R.ceil - D.h, D.w, wallR, D.x, D.h + (R.ceil - D.h) / 2, D.z, 'wallR3', false);
  // baseboards + door trim (white)
  const white = mat('#f4f1ea', { rough: 0.6 });
  boxAt(W, 0.1, 0.02, white, cx, 0.05, R.z1 - 0.01, 'baseB', false);
  boxAt(0.02, 0.1, Dp, white, R.x0 + 0.01, 0.05, cz, 'baseL', false);
  boxAt(0.02, 0.1, dz0 - R.z0, white, D.x - 0.07, 0.05, (R.z0 + dz0) / 2, 'baseR1', false);
  boxAt(0.02, 0.1, R.z1 - dz1, white, D.x - 0.07, 0.05, (dz1 + R.z1) / 2, 'baseR2', false);
  for (const sx of [-0.07, 0.07]) {
    boxAt(0.03, D.h + 0.08, 0.08, white, D.x + sx, (D.h + 0.08) / 2, dz0 - 0.04, 'trim', false);
    boxAt(0.03, D.h + 0.08, 0.08, white, D.x + sx, (D.h + 0.08) / 2, dz1 + 0.04, 'trim', false);
    boxAt(0.03, 0.08, D.w + 0.16, white, D.x + sx, D.h + 0.04, D.z, 'trim', false);
  }
  // the bathroom door (hinge on its -Z edge, swings into the bathroom)
  const doorPivot = new THREE.Group(); doorPivot.position.set(D.x, 0, dz0); group.add(doorPivot);
  const doorM = mat(tex(doorCanvas({ base: '#f6f3ec', trim: '#d8d2c4', seed: 64 })), { rough: 0.6 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.045, D.h - 0.01, D.w - 0.02), doorM); door.position.set(0.03, (D.h - 0.01) / 2, D.w / 2);
  door.castShadow = true; door.receiveShadow = true; door.name = 'set.house.door'; doorPivot.add(door);
  const knobM = gloss('#d8b048', 0.2); knobM.metalness = 0.8;
  const handles = [];
  for (const sx of [-0.05, 0.11]) {         // lever handles (both sides) - they turn (state handleTurn); NO lock
    const hp = new THREE.Group(); hp.position.set(sx, 1.0, D.w - 0.1); doorPivot.add(hp);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12), knobM); rose.rotation.z = Math.PI / 2; hp.add(rose);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.12), knobM); lever.position.set(Math.sign(sx) * 0.025, 0, -0.055); hp.add(lever);
    handles.push(hp);
  }
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), mat('#1a1410')); hole.position.set(0.03, 0.9, D.w - 0.1); doorPivot.add(hole);   // where a lock should be: nothing
  // a sign on the door: a little toilet pictogram (no text)
  const signM = mat(tex(paint(16, 16, (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 7.5) return [0, 0, 0, 0]; if (d > 6.5) return [90, 140, 200]; const toi = (y > 3 && y < 7 && x > 4 && x < 9) || (y >= 7 && y < 10 && x > 3 && x < 12) || (y >= 10 && y < 13 && x > 5 && x < 10); return toi ? [60, 70, 90] : [236, 244, 250]; })), { rough: 0.5 });
  signM.transparent = true; signM.alphaTest = 0.5;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), signM); sign.position.set(-0.002, 1.58, D.w / 2); sign.rotation.y = -Math.PI / 2; doorPivot.add(sign);

  // window in the left wall (bright day view) + curtains
  const wz = HOUSE.window.z;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshBasicMaterial({ map: tex(windowViewCanvas()), toneMapped: true }));
  view.position.set(R.x0 + 0.02, 1.5, wz); view.rotation.y = Math.PI / 2; view.name = 'set.house.window'; group.add(view);
  const frameM = mat('#f6f4ee', { rough: 0.5 });
  boxAt(0.06, 0.06, 1.62, frameM, R.x0 + 0.04, 2.13, wz, 'wframe', false); boxAt(0.06, 0.06, 1.62, frameM, R.x0 + 0.04, 0.87, wz, 'wframe', false);
  boxAt(0.06, 1.3, 0.06, frameM, R.x0 + 0.04, 1.5, wz - 0.78, 'wframe', false); boxAt(0.06, 1.3, 0.06, frameM, R.x0 + 0.04, 1.5, wz + 0.78, 'wframe', false);
  boxAt(0.05, 1.26, 0.04, frameM, R.x0 + 0.04, 1.5, wz, 'wframe', false); boxAt(0.05, 0.04, 1.56, frameM, R.x0 + 0.04, 1.5, wz, 'wframe', false);
  boxAt(0.16, 0.04, 1.8, frameM, R.x0 + 0.08, 0.85, wz, 'sill', false);
  const curtM = mat(tex(stripesCanvas('#f3c64a', '#f7d978'), { repeat: [2, 4] }), { rough: 0.9, side: THREE.DoubleSide });
  for (const sz of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.5, 2.0, 8, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.03);
    g.computeVertexNormals();
    const c = new THREE.Mesh(g, curtM); c.position.set(R.x0 + 0.12, 1.42, wz + sz * 1.02); c.rotation.y = Math.PI / 2; add(c, 'curtain', false);
  }
  const sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ map: tex(glowDiscCanvas(64), { nearest: false }), color: '#fff0c8', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  sunPatch.rotation.x = -Math.PI / 2; sunPatch.position.set(R.x0 + 1.4, 0.012, wz + 0.2); group.add(sunPatch);

  // rug
  const rugM = mat(tex(carpetCanvas(29), { repeat: [2, 1.4] }), { rough: 1 });
  rugM.color.set('#ff9d9d');
  plane(3.2, 2.2, rugM, [-0.5, 0.008, 1.9], 0, -Math.PI / 2, 'rug');

  // ---------------------------------------------------------------- couch (back wall), armchair, coffee table
  const sofaM = mat(tex(velvetCanvas('#4a6aa8', 51), { repeat: [2, 1] }), { rough: 0.95 });
  const C0 = HOUSE.couch, [sx0, sz0] = C0.pos;
  boxAt(C0.w, 0.3, 0.88, sofaM, sx0, 0.2, sz0 + 0.08, 'sofaBase');
  for (const x of C0.seats) { const m = new THREE.Mesh(chamferBox(0.68, 0.14, 0.7, 0.04), sofaM); m.position.set(x, 0.41, sz0 - 0.02); add(m, 'cushion'); }
  boxAt(C0.w, 0.5, 0.22, sofaM, sx0, 0.6, sz0 + 0.46, 'sofaBack');
  for (const x of C0.seats) { const m = new THREE.Mesh(chamferBox(0.66, 0.42, 0.16, 0.05), sofaM); m.position.set(x, 0.7, sz0 + 0.3); m.rotation.x = -0.12; add(m, 'backCushion'); }
  for (const sd of [-1, 1]) boxAt(0.16, 0.62, 0.9, sofaM, sx0 + sd * (C0.w / 2 + 0.06), 0.31, sz0 + 0.08, 'sofaArm');
  const pillowM = mat(tex(dotsCanvas('#f6d04a', '#ffffff')), { rough: 0.9 });
  { const m = new THREE.Mesh(chamferBox(0.36, 0.34, 0.12, 0.05), pillowM); m.position.set(sx0 + 0.86, 0.66, sz0 + 0.2); m.rotation.set(-0.2, 0.3, 0.15); add(m, 'pillow'); }
  // armchair (floral-ish pink) for Grandma
  const AC = HOUSE.armchair, arm = new THREE.Group(); arm.position.set(AC.pos[0], 0, AC.pos[1]); arm.rotation.y = AC.rotY; group.add(arm);
  const chairM = mat(tex(dotsCanvas('#c86a8a', '#f0b8c8'), { repeat: [3, 3] }), { rough: 0.95 });
  const ab = (w, h, d, x, y, z, m = chairM) => { const q = new THREE.Mesh(chamferBox(w, h, d, 0.04), m); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; arm.add(q); return q; };
  ab(0.8, 0.32, 0.78, 0, 0.2, 0); ab(0.62, 0.12, 0.62, 0, 0.42, 0.02); ab(0.8, 0.62, 0.18, 0, 0.72, -0.34); ab(0.14, 0.36, 0.78, -0.38, 0.5, 0); ab(0.14, 0.36, 0.78, 0.38, 0.5, 0);
  { const blanket = ab(0.5, 0.04, 0.5, 0.2, 0.52, -0.15, mat(tex(stripesCanvas('#7a9ad0', '#e8e0c8')), { rough: 1 })); blanket.rotation.set(0.3, 0.4, -0.2); }
  // coffee table + a bowl of chips + cups
  const woodM = mat('#8a5a34', { rough: 0.55 });
  const [ctx0, ctz0] = HOUSE.coffee.pos;
  boxAt(1.1, 0.05, 0.56, woodM, ctx0, 0.42, ctz0, 'coffeeTop');
  for (const [lx, lz] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]]) boxAt(0.05, 0.4, 0.05, woodM, ctx0 + lx, 0.2, ctz0 + lz, 'coffeeLeg');
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gloss('#e85a3a')); bowl.position.set(ctx0 - 0.2, 0.58, ctz0); bowl.rotation.x = Math.PI; add(bowl, 'bowl');
  const chipM = mat('#f2c860', { rough: 0.7 });
  for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.035, 5), chipM); c.position.set(ctx0 - 0.2 + (hash1(i) - 0.5) * 0.15, 0.585 + hash1(i * 3) * 0.02, ctz0 + (hash1(i * 7) - 0.5) * 0.15); c.rotation.set(-Math.PI / 2 + (hash1(i * 5) - 0.5), 0, hash1(i * 9) * 6); c.material.side = THREE.DoubleSide; add(c, 'chip', false); }

  // ---------------------------------------------------------------- dining table (the will), tea + cookies, front door + bell, kitchen
  const T = HOUSE.table, [tx, tz] = T.pos;
  boxAt(T.w, 0.05, T.d, woodM, tx, T.h - 0.025, tz, 'tableTop');
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) boxAt(0.06, T.h - 0.05, 0.06, woodM, tx + lx * (T.w / 2 - 0.08), (T.h - 0.05) / 2, tz + lz * (T.d / 2 - 0.08), 'tableLeg');
  const dchairM = mat("#8a5a34", { rough: 0.6 });
  for (const [cx, cz, ry] of [[tx - 0.45, tz + 0.7, Math.PI], [tx + 0.45, tz + 0.7, Math.PI], [tx - 0.45, tz - 0.7, 0], [tx + 0.45, tz - 0.7, 0]]) {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; group.add(g);
    const cb = (w, h, d, x, y, z) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dchairM); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; g.add(q); };
    cb(0.44, 0.05, 0.42, 0, 0.46, 0); for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) cb(0.04, 0.46, 0.04, lx, 0.23, lz);
    cb(0.44, 0.5, 0.04, 0, 0.72, -0.2);
  }
  // tea cups + a plate of cookies on the coffee table
  const [cfx, cfz] = HOUSE.coffee.pos, cty = 0.45;
  const china = gloss('#fbf8f2', 0.25);
  for (const [px, pz] of [[cfx + 0.22, cfz - 0.05], [cfx + 0.38, cfz + 0.12]]) {
    const sau = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 16), china); sau.position.set(px, cty + 0.006, pz); add(sau, 'saucer');
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 14), china); cup.position.set(px, cty + 0.042, pz); add(cup, 'cup');
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), mat('#a8642a', { rough: 0.3 })); tea.rotation.x = -Math.PI / 2; tea.position.set(px, cty + 0.071, pz); add(tea, 'tea', false);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 5, 10), china); hd.position.set(px + 0.05, cty + 0.045, pz); add(hd, 'cupHandle', false);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.015, 18), china); plate.position.set(cfx - 0.22, cty + 0.008, cfz); add(plate, 'plate');
  const cookieM = mat('#c88a4a', { rough: 0.8 }), chipM2 = mat('#4a2a14');
  for (let i = 0; i < 7; i++) {
    const a2 = i * 0.9, r2 = i === 0 ? 0 : 0.085;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 10), cookieM); c.position.set(cfx - 0.22 + Math.cos(a2) * r2, cty + 0.024 + (i === 0 ? 0.014 : 0), cfz + Math.sin(a2) * r2); c.rotation.set(hash1(i) * 0.2, 0, hash1(i * 3) * 0.2); add(c, 'cookie');
    for (let k = 0; k < 3; k++) { const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.01), chipM2); d2.position.set(c.position.x + (hash1(i * 7 + k) - 0.5) * 0.05, c.position.y + 0.008, c.position.z + (hash1(i * 11 + k) - 0.5) * 0.05); add(d2, 'chip', false); }
  }
  // front door in the left wall (x0) at FD.z, swings in (+X); the wall around it is solid boxes so the porch side works too
  const FD = HOUSE.front, fz0 = FD.z - FD.w / 2, fz1 = FD.z + FD.w / 2;
  const frontPivot = new THREE.Group(); frontPivot.position.set(R.x0, 0, fz0); group.add(frontPivot);
  const frontM = mat(tex(doorCanvas({ base: '#8a4a2a', trim: '#6a3418', seed: 66 })), { rough: 0.6 });
  const fdoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, FD.h - 0.01, FD.w - 0.02), frontM); fdoor.position.set(0.0, (FD.h - 0.01) / 2, FD.w / 2); fdoor.castShadow = true; fdoor.name = 'set.house.frontDoor'; frontPivot.add(fdoor);
  for (const sx of [-0.05, 0.05]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), knobM); k.position.set(sx, 1.0, FD.w - 0.1); frontPivot.add(k); }
  const outWall = mat('#e8dcc4', { rough: 0.8 });
  boxAt(0.12, R.ceil, fz0 - (R.z0), [outWall, wallM, outWall, outWall, outWall, outWall], R.x0 - 0.06, R.ceil / 2, (R.z0 + fz0) / 2, 'frontWallA', false);
  boxAt(0.12, R.ceil - FD.h, FD.w, outWall, R.x0 - 0.06, FD.h + (R.ceil - FD.h) / 2, FD.z, 'frontWallTop', false);
  boxAt(0.12, R.ceil, 0.5, outWall, R.x0 - 0.06, R.ceil / 2, fz1 + 0.25, 'frontWallB', false);
  for (const zz of [fz0 - 0.04, fz1 + 0.04]) boxAt(0.16, FD.h + 0.08, 0.08, white, R.x0, (FD.h + 0.08) / 2, zz, 'frontTrim', false);
  boxAt(0.16, 0.08, FD.w + 0.16, white, R.x0, FD.h + 0.04, FD.z, 'frontTrim', false);
  // the doorbell (outside, next to the door) + the porch outside
  const bellPlate = boxAt(0.02, 0.14, 0.09, mat('#d8c8a8', { rough: 0.5 }), R.x0 - 0.13, 1.32, fz1 + 0.16, 'bellPlate', false);
  const bellBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), mat('#f2e8c8', { emissive: '#ffcc66', emissiveIntensity: 0.5, rough: 0.3 }));
  bellBtn.rotation.z = Math.PI / 2; bellBtn.position.set(R.x0 - 0.145, 1.33, fz1 + 0.16); add(bellBtn, 'bellButton', false); void bellPlate;
  const porch = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat('#a89a88', { rough: 0.9 })); porch.rotation.x = -Math.PI / 2; porch.position.set(R.x0 - 2.1, -0.005, FD.z); add(porch, 'porch', false);
  const daylight = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: '#fff4dc' })); daylight.position.set(R.x0 - 4.0, 2.0, FD.z); daylight.rotation.y = Math.PI / 2; add(daylight, 'outside', false);
  const doorLight = new THREE.PointLight('#fff0c8', 0, 6, 1.5); doorLight.position.set(R.x0 - 0.6, 1.6, FD.z); group.add(doorLight);
  // kitchen corner (back-left): counter, stove, the PRESSURE COOKER (whistle weight on top)
  const K = HOUSE.kitchen;
  boxAt(1.7, 0.9, 0.55, mat('#f2efe8', { rough: 0.6 }), K.x, 0.45, K.z, 'counter');
  boxAt(1.74, 0.04, 0.6, mat('#3a3f48', { rough: 0.3 }), K.x, 0.92, K.z, 'counterTop');
  const backsplash = mat(tex(tileCanvas('#f2f2ee', '#c8c8c0', '#e8c8a0', 5), { repeat: [4, 1.5] }), { rough: 0.4 });
  boxAt(1.7, 0.6, 0.02, backsplash, K.x, 1.24, R.z1 - 0.012, 'backsplash', false);
  boxAt(0.6, 0.03, 0.45, mat('#1a1a1e', { rough: 0.4 }), K.stoveX, 0.955, K.z, 'stove');
  for (const dx of [-0.14, 0.14]) { const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 14), mat('#444')); r2.rotation.x = Math.PI / 2; r2.position.set(K.stoveX + dx, 0.975, K.z); add(r2, 'burner', false); }
  const cooker = new THREE.Group(); cooker.position.set(K.stoveX - 0.14, 0.97, K.z); group.add(cooker);
  { const steel = gloss('#c8ccd2', 0.25, 0.85);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.2, 18), steel); pot.position.y = 0.1; cooker.add(pot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.03, 18), steel); lid.position.y = 0.21; cooker.add(lid);
    const hdl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04), mat('#1a1a1a')); hdl.position.set(0.24, 0.2, 0); cooker.add(hdl);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), steel); vent.position.y = 0.245; cooker.add(vent);
    cooker.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 10), mat('#1a1a1a', { rough: 0.4 })); whistle.position.set(0, 0.27, 0); cooker.add(whistle);
  const flameRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 14), new THREE.MeshBasicMaterial({ color: '#4a8aff' })); flameRing.rotation.x = Math.PI / 2; flameRing.position.set(K.stoveX - 0.14, 0.975, K.z); group.add(flameRing);
  // upper cabinets
  boxAt(1.7, 0.6, 0.35, mat('#e8e2d6', { rough: 0.6 }), K.x, 2.05, R.z1 - 0.18, 'cabinet');
  const balloons = [], flames = []; const candleLight = { intensity: 0 };
  // a wall clock (for "ten minutes later") above the bathroom door side, on the back wall right part
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), mat(tex(clockCanvas()), { rough: 0.6 })); clock.material.transparent = true; clock.material.alphaTest = 0.5;
  clock.position.set(3.0, 2.15, R.z1 - 0.02); clock.rotation.y = Math.PI; add(clock, 'clock', false);
  const handM = mat('#202020');
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.006), handM); minHand.geometry.translate(0, 0.06, 0); minHand.position.set(3.0, 2.15, R.z1 - 0.03); minHand.rotation.y = Math.PI; group.add(minHand);
  const hrHand = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.09, 0.006), handM); hrHand.geometry.translate(0, 0.04, 0); hrHand.position.set(3.0, 2.15, R.z1 - 0.032); hrHand.rotation.set(0, Math.PI, 2.2); group.add(hrHand);
  // family photos on the left wall + a floor lamp by the couch + a plant
  const photoCols = [['#f2c8a0', '#3a6ab0'], ['#ffd0d0', '#4a8a4a'], ['#e8e0b0', '#b04a4a']];
  photoCols.forEach(([a, b], i) => {
    const pm = mat(tex(paint(12, 14, (x, y) => (x === 0 || y === 0 || x === 11 || y === 13 ? [200, 160, 60] : Math.hypot(x - 6, y - 6) < 3 ? hexToRgb(a) : y > 9 ? hexToRgb(b) : [200, 220, 240]))), { rough: 0.6 });
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), pm); ph.position.set(R.x0 + 0.015, 1.7 + (i % 2) * 0.25, 2.1 + i * 0.45); ph.rotation.y = Math.PI / 2; add(ph, 'photo', false);
  });
  const lampM = mat('#d8b048', { rough: 0.3, metal: 0.6 });
  boxAt(0.04, 1.5, 0.04, lampM, sx0 - C0.w / 2 - 0.35, 0.75, sz0 + 0.3, 'lampPole');
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.28, 16, 1, true), mat('#fff4d8', { rough: 0.8, side: THREE.DoubleSide, emissive: '#ffd890', emissiveIntensity: 0.6 }));
  shade.position.set(sx0 - C0.w / 2 - 0.35, 1.6, sz0 + 0.3); add(shade, 'shade', false);
  const lampLight = new THREE.PointLight('#ffd8a0', 3, 5, 2); lampLight.position.set(sx0 - C0.w / 2 - 0.35, 1.55, sz0 + 0.3); group.add(lampLight);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 12), mat('#c8643a', { rough: 0.8 })); pot.position.set(3.55, 0.17, 3.4); add(pot, 'pot');
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), mat(i % 2 ? '#3f8a3a' : '#57a64a', { rough: 0.8 })); l.scale.set(0.6, 1.4, 0.4); l.position.set(3.55 + Math.cos(i * 2.4) * 0.12, 0.55 + hash1(i) * 0.4, 3.4 + Math.sin(i * 2.4) * 0.12); l.rotation.set(Math.cos(i) * 0.6, i, Math.sin(i * 2.4) * 0.6); add(l, 'leaf'); }

  // the indoor tumbleweed ("Mom isn't here")
  const tumble = new THREE.Group(); tumble.name = 'set.house.tumbleweed'; group.add(tumble);
  { const twigM = mat('#a8844a', { rough: 0.9 }), pts = [];
    for (let i = 0; i < 46; i++) {
      const a = V(hash1(i * 3.1) - 0.5, hash1(i * 5.7) - 0.5, hash1(i * 7.3) - 0.5).normalize().multiplyScalar(0.22);
      const b = V(hash1(i * 11.1) - 0.5, hash1(i * 13.7) - 0.5, hash1(i * 17.3) - 0.5).normalize().multiplyScalar(0.22);
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(0.25);
      const c = new THREE.QuadraticBezierCurve3(a, mid, b);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 6, 0.006, 3, false), twigM); m.castShadow = true; tumble.add(m);
    } }

  // ---------------------------------------------------------------- the bathroom (tiles, toilet, sink, mirror, towel, EMPTY roll)
  const bw = B.x1 - B.x0, bd = B.z1 - B.z0, bcx = (B.x0 + B.x1) / 2, bcz = (B.z0 + B.z1) / 2;
  const tileM = (rx, ry) => mat(tex(tileCanvas(), { repeat: [rx, ry] }), { rough: 0.35 });
  plane(bw, bd, mat(tex(floorTileCanvas(), { repeat: [bw / 0.5, bd / 0.5] }), { rough: 0.4 }), [bcx, 0.002, bcz], 0, -Math.PI / 2, 'bathFloor');
  plane(bw, B.ceil, tileM(bw / 0.6, B.ceil / 0.6), [bcx, B.ceil / 2, B.z1], Math.PI, 0, 'bathWallBack');
  plane(bw, B.ceil, tileM(bw / 0.6, B.ceil / 0.6), [bcx, B.ceil / 2, B.z0], 0, 0, 'bathWallFront');
  plane(bd, B.ceil, tileM(bd / 0.6, B.ceil / 0.6), [B.x1, B.ceil / 2, bcz], -Math.PI / 2, 0, 'bathWallRight');
  plane(bw, bd, ceilM, [bcx, B.ceil, bcz], 0, Math.PI / 2, 'bathCeil');
  // the bathroom side of the door wall (tiles) around the opening
  plane(dz0 - B.z0, B.ceil, tileM(1, 4), [B.x0 + 0.065, B.ceil / 2, (B.z0 + dz0) / 2], Math.PI / 2, 0, 'bathWallL1');
  plane(B.z1 - dz1, B.ceil, tileM(2, 4), [B.x0 + 0.065, B.ceil / 2, (dz1 + B.z1) / 2], Math.PI / 2, 0, 'bathWallL2');
  const porcelain = gloss('#fbfbf8', 0.18);
  const TL = HOUSE.toilet, toilet = new THREE.Group(); toilet.position.set(TL.pos[0], 0, TL.pos[1]); toilet.rotation.y = TL.rotY; group.add(toilet);
  { const prof = [V(0.0, 0), V(0.13, 0), V(0.11, 0.08), V(0.13, 0.25), V(0.2, 0.38), V(0.2, 0.42), V(0.0, 0.42)].map((p) => new THREE.Vector2(p.x, p.y));
    const bowlG = new THREE.LatheGeometry(prof, 18); bowlG.scale(1, 1, 1.25);
    const b = new THREE.Mesh(bowlG, porcelain); b.position.z = 0.04; toilet.add(b);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 20), porcelain); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.25, 1); seat.position.set(0, 0.43, 0.04); toilet.add(seat);
    const tank = new THREE.Mesh(chamferBox(0.44, 0.4, 0.2, 0.03), porcelain); tank.position.set(0, 0.62, -0.26); toilet.add(tank);
    const lid = new THREE.Mesh(chamferBox(0.46, 0.04, 0.22, 0.015), porcelain); lid.position.set(0, 0.84, -0.26); toilet.add(lid);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), knobM); handle.position.set(0.17, 0.76, -0.15); toilet.add(handle);
    toilet.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  // toilet paper holder on the wall next to the toilet: an EMPTY cardboard tube
  { const hx = TL.pos[0] - 0.05, hz = TL.pos[1] - 0.48;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), knobM); bar.rotation.x = Math.PI / 2; bar.position.set(hx, 0.72, B.z0 + 0.09); add(bar, 'tpBar', false);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.09), knobM); arm1.position.set(hx - 0.07, 0.72, B.z0 + 0.045); add(arm1, 'tpArm', false);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12, 1, true), mat('#b8915a', { rough: 0.9, side: THREE.DoubleSide })); tube.rotation.z = Math.PI / 2; tube.position.set(hx, 0.72, B.z0 + 0.09); add(tube, 'emptyRoll', false);
    void hz; }
  // sink + mirror + towel
  const SK = HOUSE.sink.pos;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.78, 12), porcelain); ped.position.set(SK[0], 0.39, SK[1]); add(ped, 'pedestal');
  const basin = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), porcelain); basin.scale.set(1, 0.45, 0.75); basin.position.set(SK[0], 0.86, SK[1] - 0.05); basin.rotation.x = Math.PI; add(basin, 'basin');
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), knobM); faucet.position.set(SK[0], 0.92, SK[1] + 0.15); add(faucet, 'faucet', false);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ color: '#cfe0e8', roughness: 0.05, metalness: 0.9, envMap: env, envMapIntensity: 1.1 }));
  mirror.position.set(SK[0], 1.55, B.z1 - 0.015); mirror.rotation.y = Math.PI; add(mirror, 'mirror', false);
  const mframe = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.83, 0.02), knobM); mframe.position.set(SK[0], 1.55, B.z1 - 0.008); add(mframe, 'mframe', false);
  const towelM = mat(tex(stripesCanvas('#ff8aa8', '#ffffff'), { repeat: [1, 3] }), { rough: 1 });
  const towel = new THREE.Mesh(chamferBox(0.42, 0.62, 0.05, 0.02), towelM); towel.position.set(B.x1 - 0.04, 1.15, 0.35); towel.rotation.y = Math.PI / 2; add(towel, 'towel');
  const duck = new THREE.Group(); duck.position.set(SK[0] + 0.24, 0.885, SK[1] + 0.12); group.add(duck);
  { const dm = gloss('#ffd23f', 0.3); const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), dm); b1.scale.set(1.2, 0.8, 1); duck.add(b1); const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), dm); h1.position.set(0.035, 0.045, 0); duck.add(h1); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), mat('#ff8a2a')); bk.rotation.z = -Math.PI / 2; bk.position.set(0.07, 0.04, 0); duck.add(bk); }
  // lights: bathroom ceiling light (cool white) + the warm "hero" glow that spills out of the door at the end
  const bathLight = new THREE.PointLight('#f4f8ff', 5, 6, 1.8); bathLight.position.set(bcx, B.ceil - 0.25, bcz); group.add(bathLight);
  const heroLight = new THREE.PointLight('#fff2c0', 0, 7, 1.5); heroLight.position.set(B.x0 + 0.6, 1.4, D.z); group.add(heroLight);

  // ---------------------------------------------------------------- living room lights: soft daylight key + warm fill
  const key = new THREE.DirectionalLight('#fff4e0', 1.5); key.name = 'set.house.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  key.userData.dir = V(-0.45, 1.0, -0.55).normalize();
  group.add(key, key.target);
  group.add(new THREE.HemisphereLight('#fffaf0', '#b08a6a', 1.35));
  const fill = new THREE.PointLight('#ffe4c0', 6, 9, 1.6); fill.position.set(0, 2.45, 0.8); group.add(fill);
  const fill2 = new THREE.PointLight('#fff0dc', 4, 8, 1.6); fill2.position.set(2.6, 2.4, 2.4); group.add(fill2);

  const props = { door, doorPivot, tumble, toilet, cooker, bellBtn, frontPivot };
  return {
    name: 'house', group, props, key,
    look: { background: '#cfe8f4', fog: null, exposure: 1.05, shadowCenter: [0.5, 0.8, 1.2], shadowRadius: 6 },
    defaults: () => ({ doorOpen: 0, doorShake: 0, tumble: null, clockMin: 0, bathLight: 1, heroGlow: 0, handleTurn: 0, frontOpen: 0, bellPress: 0, whistle: 0, doorLight: 0 }),
    update(t, s) {
      const shake = s.doorShake || 0;
      doorPivot.rotation.y = (s.doorOpen || 0) * 1.45 + shake * 0.03 * Math.sin(t * 47) - shake * 0.015 * Math.sin(t * 29 + 1);
      doorPivot.position.x = D.x + shake * 0.006 * Math.sin(t * 61);
      for (const h of handles) h.rotation.x = -(s.handleTurn || 0) * 0.8;
      frontPivot.rotation.y = (s.frontOpen || 0) * 1.5;
      bellBtn.position.x = R.x0 - 0.145 + (s.bellPress || 0) * 0.012;
      bellBtn.material.emissiveIntensity = 0.5 + (s.bellPress || 0) * 1.5;
      const w = s.whistle || 0;
      whistle.position.y = 0.27 + w * (0.02 + 0.015 * Math.sin(t * 60)); whistle.rotation.z = w * 0.25 * Math.sin(t * 47);
      doorLight.intensity = 10 * (s.doorLight || 0);
      minHand.rotation.set(0, Math.PI, -(s.clockMin || 0));
      bathLight.intensity = 5 * (s.bathLight ?? 1);
      heroLight.intensity = 14 * (s.heroGlow || 0);
      if (s.tumble) { tumble.visible = true; tumble.position.set(s.tumble.x, 0.24 + Math.abs(Math.sin((s.tumble.rot || 0) * 1.0)) * 0.06, s.tumble.z); tumble.rotation.set(0, 0, -(s.tumble.rot || 0)); }
      else tumble.visible = false;
    },
  };
}
