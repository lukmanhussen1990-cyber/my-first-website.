// The super fancy RESTAURANT (first date) and the INTERIOR wall with the framed, never-washed handkerchief.
// Place contract: see set.js. Textures from set_rest_tex.js.
import * as THREE from 'three';
import { mat, tex, clamp, hash1, rng } from './lib.js';
import { RESTAURANT, INTERIOR } from './layout.js';
import { glowDiscCanvas } from './set_tex2.js';
import { damaskCanvas, parquetCanvas, velvetCanvas, cofferCanvas, nightWindowCanvas, clothCanvas, steakCanvas, steakSideCanvas,
  keysCanvas, frondCanvas, trunkCanvas, floralCanvas, hankyCanvas, backingCanvas, planksCanvas, glareCanvas } from './set_rest_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const msh = (geo, m, name, cast = true) => { const o = new THREE.Mesh(geo, m); o.name = name; o.castShadow = cast; o.receiveShadow = true; return o; };
const box = (g, w, h, d, m, x, y, z, name, cast = true) => { const o = msh(new THREE.BoxGeometry(w, h, d), m, name, cast); o.position.set(x, y, z); g.add(o); return o; };
const T = (c, r = [1, 1], o = {}) => tex(c, { repeat: r, ...o });

function golds(env) {
  const gold = new THREE.MeshStandardMaterial({ color: '#e8b84a', roughness: 0.25, metalness: 1.0, envMap: env, envMapIntensity: 1.8, emissive: '#3a2406', emissiveIntensity: 0.3 });
  const silver = new THREE.MeshStandardMaterial({ color: '#e4e6ea', roughness: 0.18, metalness: 1.0, envMap: env, envMapIntensity: 1.6 });
  const crystal = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0.1, envMap: env, envMapIntensity: 2.5, emissive: '#fff2d8', emissiveIntensity: 0.6, flatShading: true });
  const glassM = new THREE.MeshStandardMaterial({ color: '#f4f8ff', transparent: true, opacity: 0.35, roughness: 0.04, metalness: 0.1, envMap: env, envMapIntensity: 1.5, depthWrite: false });
  return { gold, silver, crystal, glassM };
}

function chandelier(g, M, x, y, z, glowTex, scale = 1) {
  const c = new THREE.Group(); c.position.set(x, y, z); c.scale.setScalar(scale); g.add(c);
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffd890', emissiveIntensity: 2.6, roughness: 0.3 });
  const ring = msh(new THREE.TorusGeometry(0.62, 0.035, 5, 18), M.gold, 'chandRing', false); ring.rotation.x = Math.PI / 2; c.add(ring);
  const ring2 = msh(new THREE.TorusGeometry(0.36, 0.03, 5, 14), M.gold, 'chandRing2', false); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.35; c.add(ring2);
  box(c, 0.05, 1.4, 0.05, M.gold, 0, 0.95, 0, 'chandRod', false);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.36 : 0.62, yy = i % 2 ? 0.35 : 0;
    const b = msh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), bulbM, 'chandBulb', false); b.position.set(Math.cos(a) * r, yy + 0.1, Math.sin(a) * r); c.add(b);
    for (let k = 0; k < 3; k++) { const d = msh(new THREE.OctahedronGeometry(0.035 - k * 0.006, 0), M.crystal, 'crystal', false); d.scale.y = 1.8; d.position.set(Math.cos(a + 0.3) * r, yy - 0.1 - k * 0.09, Math.sin(a + 0.3) * r); c.add(d); }
  }
  const drop = msh(new THREE.OctahedronGeometry(0.09, 0), M.crystal, 'crystalDrop', false); drop.scale.y = 1.7; drop.position.y = -0.35; c.add(drop);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffcf80', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(2.6 * scale, 2.0 * scale, 1); sp.position.set(x, y + 0.1 * scale, z); sp.userData.noAudit = true; g.add(sp);
  const l = new THREE.PointLight('#ffcf8a', 26 * scale, 12, 1.6); l.position.set(x, y - 0.2, z); g.add(l);
  return c;
}

function chair(g, m, legM, x, z, rotY, name = 'chair') {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rotY; c.name = name; g.add(c);
  box(c, 0.5, 0.1, 0.48, m, 0, RESTAURANT.seatY - 0.05, 0, 'chairSeat');
  const back = box(c, 0.5, 0.72, 0.09, m, 0, RESTAURANT.seatY + 0.36, -0.22, 'chairBack'); back.rotation.x = -0.08;
  box(c, 0.54, 0.05, 0.12, legM, 0, RESTAURANT.seatY + 0.74, -0.25, 'chairTop', false);
  for (const [lx, lz] of [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]]) box(c, 0.05, RESTAURANT.seatY - 0.1, 0.05, legM, lx, (RESTAURANT.seatY - 0.1) / 2, lz, 'chairLeg', false);
  return c;
}

function roundTable(g, M, clothM, x, z, r = 0.55, h = 0.76, glowTex, candle = true) {
  const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
  const top = msh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.04, 20), clothM, 'tableTop'); top.position.y = h; t.add(top);
  const skirt = msh(new THREE.CylinderGeometry(r + 0.04, r + 0.16, h - 0.02, 20, 1, true), clothM, 'tableSkirt'); skirt.position.y = (h - 0.02) / 2; t.add(skirt);
  skirt.material = clothM.clone(); skirt.material.side = THREE.DoubleSide;
  if (candle) {
    box(t, 0.06, 0.02, 0.06, M.gold, 0, h + 0.03, 0, 'candleBase', false);
    const cd = msh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), mat('#fbf6ea', { rough: 0.6 }), 'candle'); cd.position.y = h + 0.13; t.add(cd);
    const fl = msh(new THREE.ConeGeometry(0.014, 0.05, 6), new THREE.MeshBasicMaterial({ color: '#ffcf60' }), 'flame', false); fl.position.y = h + 0.26; t.add(fl);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb050', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(0.45, 0.45, 1); sp.position.set(x, h + 0.26, z); sp.userData.noAudit = true; g.add(sp);
    t.userData.flame = fl;
  }
  return t;
}

function steakProp(name) {
  const g = new THREE.Group(); g.name = name;
  const top = mat(T(steakCanvas(81)), { rough: 0.55 }), side = mat(T(steakSideCanvas(83), [4, 1]), { rough: 0.6 });
  const geo = new THREE.CylinderGeometry(0.11, 0.115, 0.035, 12); geo.scale(1.35, 1, 1);
  const s = msh(geo, [side, top, side], 'steak'); g.add(s);
  const bone = msh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 5), mat('#efe6d0', { rough: 0.7 }), 'steakBone'); bone.rotation.z = Math.PI / 2; bone.position.set(0.17, 0.0, 0.02); g.add(bone);
  g.userData.grips = { L: { pos: [0.14, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] }, R: { pos: [-0.14, 0, 0], axis: [0, 0, 1], up: [0, 1, 0] } };
  g.userData.grip = g.userData.grips.R;
  return g;
}

export function buildRestaurant(env) {
  const g = new THREE.Group(); g.name = 'set.restaurant';
  const M = golds(env);
  const glowTex = tex(glowDiscCanvas(64), { nearest: false });
  const { x0, x1, z0, z1, ceil } = RESTAURANT.room, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // floor, ceiling, walls
  const floor = msh(new THREE.PlaneGeometry(W, D), mat(T(parquetCanvas({ seed: 31 }), [W / 1.6, D / 1.6]), { rough: 0.35 }), 'floor', false);
  floor.material.envMap = env; floor.material.envMapIntensity = 0.5;
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); g.add(floor);
  const ceilM = mat(T(cofferCanvas(61), [W / 2.5, D / 2.5]), { rough: 0.7 });
  const cl = msh(new THREE.PlaneGeometry(W, D), ceilM, 'ceiling', false); cl.rotation.x = Math.PI / 2; cl.position.set(cx, ceil, cz); g.add(cl);
  const damask = (w, h) => mat(T(damaskCanvas({ seed: 5 }), [w / 1.4, h / 2.1]), { rough: 0.6, metal: 0.15 });
  const wood = (w) => mat(T(planksCanvas({ seed: 151, base: '#5a3418', dark: '#3a200e' }), [w / 1.2, 1]), { rough: 0.5 });
  const wall = (len, x, z, ry, name) => {
    const w = msh(new THREE.PlaneGeometry(len, ceil - 1.1), damask(len, ceil - 1.1), name, false); w.position.set(x, 1.1 + (ceil - 1.1) / 2, z); w.rotation.y = ry; g.add(w);
    const wa = msh(new THREE.PlaneGeometry(len, 1.1), wood(len), name + 'Wainscot', false); wa.position.set(x, 0.55, z); wa.rotation.y = ry; g.add(wa);
    const rail = msh(new THREE.BoxGeometry(len, 0.06, 0.06), M.gold, name + 'Rail', false); rail.position.set(x, 1.1, z); rail.rotation.y = ry; g.add(rail);
    const crown = msh(new THREE.BoxGeometry(len, 0.18, 0.18), M.gold, name + 'Crown', false); crown.position.set(x, ceil - 0.09, z); crown.rotation.y = ry; g.add(crown);
  };
  wall(W, cx, z1, Math.PI, 'wallBack'); wall(W, cx, z0, 0, 'wallFront'); wall(D, x0, cz, Math.PI / 2, 'wallLeft'); wall(D, x1, cz, -Math.PI / 2, 'wallRight');
  // tall night windows with red velvet drapes on the back wall + side walls
  const winM = mat(T(nightWindowCanvas({ seed: 41 })), { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.65 }); winM.emissiveMap = winM.map;
  const velvetM = mat(T(velvetCanvas('#9a1426', 47), [1, 3]), { rough: 0.85 });
  const drape = (x, z, ry) => {
    const wg = new THREE.Group(); wg.position.set(x, 0, z); wg.rotation.y = ry; g.add(wg);
    box(wg, 1.3, 3.2, 0.04, winM, 0, 2.5, 0.0, 'window', false);
    for (const sd of [-1, 1]) { const d = box(wg, 0.45, 3.9, 0.12, velvetM, sd * 0.8, 2.35, 0.08, 'drape'); d.scale.x = 1; }
    box(wg, 1.9, 0.16, 0.16, M.gold, 0, 4.25, 0.1, 'drapeRod', false);
  };
  for (const x of [595.5, 600, 604.5]) drape(x, z1 - 0.03, Math.PI);
  for (const z of [-2, 4]) { drape(x0 + 0.03, z, Math.PI / 2); drape(x1 - 0.03, z, -Math.PI / 2); }
  // chandeliers
  chandelier(g, M, 600, 4.25, 2.0, glowTex, 1.1);
  chandelier(g, M, 595.5, 4.35, 6.2, glowTex, 0.9);
  chandelier(g, M, 604.5, 4.35, 6.2, glowTex, 0.9);
  chandelier(g, M, 596, 4.35, -2.0, glowTex, 0.8);
  chandelier(g, M, 604, 4.35, -2.0, glowTex, 0.8);
  // tables + chairs
  const clothM = mat(T(clothCanvas(71), [2, 2]), { rough: 0.8 });
  const chairM = mat(T(velvetCanvas('#a3182c', 47), [1, 1]), { rough: 0.85 });
  const main = roundTable(g, M, clothM, RESTAURANT.table.pos[0], RESTAURANT.table.pos[1], RESTAURANT.table.r, RESTAURANT.table.h, glowTex);
  chair(g, chairM, M.gold, RESTAURANT.youSeat.pos[0] - 0.12, RESTAURANT.youSeat.pos[1], RESTAURANT.youSeat.rotY, 'chairYou');
  chair(g, chairM, M.gold, RESTAURANT.ladySeat.pos[0] + 0.12, RESTAURANT.ladySeat.pos[1], RESTAURANT.ladySeat.rotY, 'chairLady');
  const extra = [[597.0, 5.6], [603.6, 3.6], [596.2, 0.4], [604.6, 0.2], [600.2, 6.4]];
  const flames = [main.userData.flame];
  for (const [tx, tz] of extra) {
    const t = roundTable(g, M, clothM, tx, tz, 0.5, 0.76, glowTex); flames.push(t.userData.flame);
    chair(g, chairM, M.gold, tx - 0.72, tz, Math.PI / 2, 'chairX'); chair(g, chairM, M.gold, tx + 0.72, tz, -Math.PI / 2, 'chairX');
  }
  // place settings on the couple's table: plates, steaks (props), silver, wine glasses
  const plateM = mat('#fbfbf8', { rough: 0.25 });
  const [tx, tz] = RESTAURANT.table.pos, th = RESTAURANT.table.h;
  const plateAt = (dx) => { const p = msh(new THREE.CylinderGeometry(0.15, 0.12, 0.02, 18), plateM, 'plate'); p.position.set(tx + dx, th + 0.03, tz); g.add(p); };
  plateAt(-0.3); plateAt(0.3);
  const steakYou = steakProp('steakYou'), steakLady = steakProp('steakLady');
  const rest = { you: [tx - 0.3, th + 0.06, tz], lady: [tx + 0.3, th + 0.06, tz] };
  g.add(steakYou, steakLady);
  for (const sd of [-1, 1]) {
    const kn = box(g, 0.02, 0.006, 0.2, M.silver, tx + sd * 0.3, th + 0.025, tz + 0.2, 'knife', false); kn.rotation.y = 0.05;
    const fk = box(g, 0.02, 0.006, 0.18, M.silver, tx + sd * 0.3, th + 0.025, tz - 0.2, 'fork', false); fk.rotation.y = -0.05;
    const wg = new THREE.Group(); wg.position.set(tx + sd * 0.18, th + 0.02, tz + 0.28); g.add(wg);
    const bowl = msh(new THREE.CylinderGeometry(0.038, 0.022, 0.07, 10), M.glassM, 'wineGlass', false); bowl.position.y = 0.18; wg.add(bowl);
    const wine = msh(new THREE.CylinderGeometry(0.03, 0.022, 0.035, 10), mat('#6a0a1a', { rough: 0.2 }), 'wine', false); wine.position.y = 0.165; wg.add(wine);
    const stem = msh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), M.glassM, 'stem', false); stem.position.y = 0.08; wg.add(stem);
  }
  // grand piano (keyboard faces -Z, the pianist sits on the -Z side)
  const pianoM = new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.12, metalness: 0.3, envMap: env, envMapIntensity: 1.4 });
  const pg = new THREE.Group(); pg.position.set(RESTAURANT.piano.pos[0], 0, RESTAURANT.piano.pos[1]); g.add(pg);
  const ps = new THREE.Shape(); ps.moveTo(-0.75, -0.5); ps.lineTo(0.75, -0.5); ps.lineTo(0.75, 0.3); ps.quadraticCurveTo(0.7, 1.4, 0.05, 1.5); ps.quadraticCurveTo(-0.75, 1.3, -0.75, 0.6); ps.lineTo(-0.75, -0.5);
  const body = new THREE.ExtrudeGeometry(ps, { depth: 0.32, bevelEnabled: false }); body.rotateX(-Math.PI / 2); body.translate(0, 0.62, 0);
  pg.add(msh(body, pianoM, 'pianoBody'));
  const lid = new THREE.ExtrudeGeometry(ps, { depth: 0.02, bevelEnabled: false }); lid.rotateX(-Math.PI / 2);
  const lidM = msh(lid, pianoM, 'pianoLid'); lidM.position.set(0.75, 0.96, 0); lidM.rotation.z = 0.7; lidM.geometry.translate(-0.75, 0, 0); pg.add(lidM);
  box(pg, 0.02, 0.9, 0.02, M.gold, 0.6, 1.3, 0.5, 'lidStick', false);
  const keys = box(pg, 1.4, 0.04, 0.2, mat(T(keysCanvas()), { rough: 0.4 }), 0, 0.74, -0.6, 'pianoKeys', false);
  box(pg, 1.5, 0.12, 0.24, pianoM, 0, 0.66, -0.6, 'pianoKeybed');
  for (const [lx, lz] of [[-0.62, -0.4], [0.62, -0.4], [0.0, 1.2]]) box(pg, 0.09, 0.62, 0.09, pianoM, lx, 0.31, lz, 'pianoLeg');
  box(pg, 0.7, 0.08, 0.36, pianoM, -0.2, 0.47, -1.05, 'pianoBench');
  for (const [lx, lz] of [[-0.5, -0.9], [0.1, -0.9], [-0.5, -1.2], [0.1, -1.2]]) box(pg, 0.05, 0.45, 0.05, pianoM, lx, 0.22, lz, 'benchLeg');
  // palms in gold pots
  const frondM = mat(T(frondCanvas(101)), { rough: 0.7, side: THREE.DoubleSide }); frondM.alphaTest = 0.5;
  const trunkM = mat(T(trunkCanvas(103), [1, 3]), { rough: 0.9 });
  for (const [px, pz] of [[593.2, 8.8], [606.8, 8.8], [593.2, -4.6], [606.8, -4.6]]) {
    const pot = msh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 10), M.gold, 'palmPot'); pot.position.set(px, 0.3, pz); g.add(pot);
    const tr = msh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6), trunkM, 'palmTrunk'); tr.position.set(px, 1.4, pz); g.add(tr);
    for (let i = 0; i < 8; i++) {
      const f = msh(new THREE.PlaneGeometry(0.5, 1.4), frondM, 'frond'); const a = (i / 8) * Math.PI * 2;
      f.geometry.translate(0, 0.7, 0); f.position.set(px, 2.2, pz); f.rotation.set(1.0, a, 0, 'YXZ'); g.add(f);
    }
  }
  // the waiter's silver tray with plates + glasses; flyers: separate plates/glasses that fly up when he faints
  const tray = new THREE.Group(); tray.name = 'tray'; g.add(tray);
  const tm = msh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 18), M.silver, 'trayDisc'); tray.add(tm);
  const trayPlate = msh(new THREE.CylinderGeometry(0.11, 0.09, 0.018, 14), plateM, 'trayPlate'); trayPlate.position.set(-0.08, 0.017, 0.03); tray.add(trayPlate);
  const trayGlass = msh(new THREE.CylinderGeometry(0.035, 0.02, 0.12, 8), M.glassM, 'trayGlass', false); trayGlass.position.set(0.12, 0.07, -0.05); tray.add(trayGlass);
  tray.userData.grip = { pos: [0, -0.02, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  tray.visible = false;
  const flyers = [];
  for (let i = 0; i < 7; i++) {
    let o;
    if (i % 3 === 0) o = msh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 14), plateM, 'flyPlate');
    else if (i % 3 === 1) { o = new THREE.Group(); const b = msh(new THREE.CylinderGeometry(0.035, 0.022, 0.07, 8), M.glassM, 'flyGlass', false); b.position.y = 0.06; o.add(b); const st = msh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4), M.glassM, 'flyStem', false); o.add(st); }
    else o = box(new THREE.Group(), 0.02, 0.006, 0.18, M.silver, 0, 0, 0, 'flyFork', false);
    o.name = 'flyer'; o.visible = false; g.add(o); flyers.push(o);
  }
  // lights: warm key from above (chandelier), soft warm hemisphere
  const key = new THREE.DirectionalLight('#ffe2b8', 1.6); key.name = 'set.restaurant.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  key.userData.dir = V(0.25, 1.0, -0.35).normalize(); g.add(key, key.target);
  g.add(new THREE.HemisphereLight('#ffe0b0', '#5a3018', 1.1));
  const props = { steakYou, steakLady, tray, flyers, anchors: { steakRest: rest } };
  return {
    name: 'restaurant', group: g, props, key,
    look: { background: '#1a0c06', fog: { color: '#2a1608', near: 14, far: 40 }, exposure: 1.05, shadowCenter: [600, 1, 2.5], shadowRadius: 6 },
    defaults: () => ({}),
    // before the shot: everything back in its place (the shots then move the steaks / tray / flyers)
    reset() {
      steakYou.position.set(...rest.you); steakYou.rotation.set(0, 0.3, 0); steakYou.visible = true;
      steakLady.position.set(...rest.lady); steakLady.rotation.set(0, -0.2, 0); steakLady.visible = true;
      tray.visible = false; for (const f of flyers) f.visible = false;
    },
    update(t) { for (const [i, f] of flames.entries()) if (f) f.scale.set(1, 1 + 0.15 * Math.sin(t * 13 + i * 2), 1); },
  };
}

export function buildInterior(env) {
  const g = new THREE.Group(); g.name = 'set.interior';
  const M = golds(env);
  const [ox, oz] = INTERIOR.origin;
  const F = INTERIOR.frame;
  // wall (floral wallpaper), wainscot, skirting, floor
  const wallM = mat(T(floralCanvas(121), [3, 2]), { rough: 0.85 });
  const w = msh(new THREE.PlaneGeometry(8, 3.4), wallM, 'wall', false); w.position.set(ox, 1.7 + 0.9 / 2 + 0.0, oz + 0.0); w.scale.y = 1; w.position.y = 2.15; w.rotation.y = Math.PI; g.add(w);
  const wa = msh(new THREE.PlaneGeometry(8, 0.9), mat(T(planksCanvas({ seed: 153, base: '#6a4428', dark: '#4a2c18' }), [6, 1]), { rough: 0.6 }), 'wainscot', false); wa.position.set(ox, 0.45, oz - 0.01); wa.rotation.y = Math.PI; g.add(wa);
  box(g, 8, 0.05, 0.05, mat('#4a2c18', { rough: 0.5 }), ox, 0.92, oz - 0.02, 'chairRail', false);
  const fl = msh(new THREE.PlaneGeometry(8, 6), mat(T(planksCanvas({ seed: 155, base: '#7a5032', dark: '#5a3820' }), [6, 4]), { rough: 0.5 }), 'floor', false);
  fl.rotation.x = -Math.PI / 2; fl.position.set(ox, 0, oz - 3); g.add(fl);
  // the golden frame: a thick ornate molding, dark backing, the old crusty pink handkerchief behind glass
  const fg = new THREE.Group(); fg.position.set(F.pos[0], F.pos[1], F.pos[2]); g.add(fg);
  const fw = F.w, fh = F.h, b = 0.07;
  for (const [x, y, ww, hh] of [[0, fh / 2, fw + 2 * b, b], [0, -fh / 2, fw + 2 * b, b], [-fw / 2, 0, b, fh], [fw / 2, 0, b, fh]]) {
    const m = box(fg, ww, hh, 0.06, M.gold, x, y, 0, 'frameMold'); m.geometry.translate(0, 0, -0.01);
    for (let k = 0; k < 5; k++) { const orn = msh(new THREE.SphereGeometry(0.014, 5, 4), M.gold, 'frameOrn', false); const u = (k + 0.5) / 5;
      orn.position.set(ww > hh ? x - ww / 2 + u * ww : x, ww > hh ? y : y - hh / 2 + u * hh, -0.045); fg.add(orn); }
  }
  for (const [x, y] of [[-fw / 2, fh / 2], [fw / 2, fh / 2], [-fw / 2, -fh / 2], [fw / 2, -fh / 2]]) { const c = msh(new THREE.IcosahedronGeometry(0.05, 0), M.gold, 'frameCorner'); c.position.set(x, y, -0.03); fg.add(c); }
  box(fg, fw, fh, 0.01, mat(T(backingCanvas('#1e4a44', 141)), { rough: 0.9 }), 0, 0, 0.012, 'backing', false);
  const hk = new THREE.PlaneGeometry(fw * 0.72, fh * 0.72, 8, 8);
  { const p = hk.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 4.7) - 0.5) * 0.012); hk.computeVertexNormals(); }
  const hanky = msh(hk, mat(T(hankyCanvas(131)), { rough: 0.95, side: THREE.DoubleSide }), 'crustyHanky', false);
  hanky.position.set(0, 0, 0.0); hanky.rotation.set(0, Math.PI, 0.04); fg.add(hanky);
  const glass = msh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: T(glareCanvas()), color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }), 'frameGlass', false);
  glass.position.z = -0.022; glass.rotation.y = Math.PI; fg.add(glass);
  for (const [x, y] of [[-fw * 0.3, fh * 0.3], [fw * 0.3, fh * 0.3], [-fw * 0.3, -fh * 0.3], [fw * 0.3, -fh * 0.3]]) { const pin = msh(new THREE.SphereGeometry(0.008, 5, 4), M.gold, 'pin', false); pin.position.set(x, y, -0.004); fg.add(pin); }
  // brass picture lamp above it (lights the frame from above)
  box(g, 0.05, 0.05, 0.16, M.gold, F.pos[0], F.pos[1] + fh / 2 + 0.17, F.pos[2] - 0.08, 'lampArm', false);
  const shade = msh(new THREE.CylinderGeometry(0.05, 0.06, 0.34, 10), M.gold, 'lampShade'); shade.rotation.z = Math.PI / 2; shade.position.set(F.pos[0], F.pos[1] + fh / 2 + 0.17, F.pos[2] - 0.18); g.add(shade);
  const sl = new THREE.SpotLight('#ffd8a0', 10, 3, 0.9, 0.6, 1.5); sl.position.set(F.pos[0], F.pos[1] + fh / 2 + 0.12, F.pos[2] - 0.2); sl.target.position.set(F.pos[0], F.pos[1] - 0.1, F.pos[2]); g.add(sl, sl.target);
  // side table with a little plant + a lamp, warm room light
  box(g, 0.6, 0.06, 0.4, mat('#5a3820', { rough: 0.5 }), ox + 0.95, 0.72, oz - 0.3, 'sideTable');
  for (const [lx, lz] of [[-0.25, -0.15], [0.25, -0.15], [-0.25, 0.15], [0.25, 0.15]]) box(g, 0.04, 0.7, 0.04, mat('#4a2c18'), ox + 0.95 + lx, 0.35, oz - 0.3 + lz, 'sideLeg', false);
  const vase = msh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10), mat('#3a6aa8', { rough: 0.3 }), 'vase'); vase.position.set(ox + 0.95, 0.85, oz - 0.3); g.add(vase);
  const flower = msh(new THREE.IcosahedronGeometry(0.1, 1), mat('#e07a98', { rough: 0.7 }), 'flowers'); flower.position.set(ox + 0.95, 1.02, oz - 0.3); g.add(flower);
  const key = new THREE.DirectionalLight('#ffe6c8', 1.4); key.name = 'set.interior.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.userData.dir = V(-0.5, 0.7, -1.0).normalize(); g.add(key, key.target);
  g.add(new THREE.HemisphereLight('#ffe8d0', '#6a4a30', 1.15));
  return {
    name: 'interior', group: g, props: { frame: fg }, key,
    look: { background: '#2a1c14', fog: null, exposure: 1.1, shadowCenter: [F.pos[0], F.pos[1], 0], shadowRadius: 2.5 },
    defaults: () => ({}), update() {},
  };
}
