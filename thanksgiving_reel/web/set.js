// The Thanksgiving dining room: room shell (set_room.js), table, chairs, place settings, food, holdable props,
// lights, story continuity (reset) and per-frame state (commit). API: see CONTRACTS.md.
import * as THREE from 'three';
import { mat, mesh, lowSphere, noise1, clamp, smooth, invLerp, rng, loftGeometry, chamferBox } from './lib.js';
import { TABLE, SEATS, PLACE, DISHES, CHAIR, GRANDMA_CHAIR_PULLED, FURNITURE } from './layout.js';
import { Batch, glowCanvas, V, leafGeo, polarDisc } from './set_util.js';
import { makeMaterials } from './set_tex.js';
import { buildRoom, animateLeaves } from './set_room.js';
import * as F from './set_food.js';

const H = F.H;
const DS = THREE.DoubleSide;

function extraMaterials(M) {
  M.steelDS = mat('#d8dadc', { rough: 0.25, metal: 0.85, side: DS });
  M.glassDS = mat('#dff0ff', { rough: 0.05, transparent: true, opacity: 0.2, side: DS });
  M.porcelainDS = mat('#f6f2e8', { rough: 0.25, side: DS });
  M.platter = mat('#f3eee2', { rough: 0.3 });
  M.platterGreen = mat('#9fb08a', { rough: 0.3 });
  M.charger = mat('#b8913e', { rough: 0.35, metal: 0.55 });
  M.bowlCream = mat('#efe6d3', { rough: 0.3 });
  M.bowlBlue = mat('#4f6f9a', { rough: 0.3 });
  M.butterMelt = mat('#f9e27a', { rough: 0.2 });
  M.chairWood = M.walnut;
  M.crustDS = M.crust.clone(); M.crustDS.side = DS;
  M.pieFillDS = M.pieFill.clone(); M.pieFillDS.side = DS;
  M.turkeySkin = mat('#a85a1e', { rough: 0.4 });
  M.whip = mat('#fffaf0', { rough: 0.7 });
  M.wick = mat('#222222', { rough: 1 });
  M.gravyPool = mat('#6e3b17', { rough: 0.18, polygonOffset: 2 });
  M.gravyStream = mat('#7a4219', { rough: 0.15 });
  M.water.depthWrite = false; M.waterTop.depthWrite = false;
}

export function buildSet(world) {
  const { scene } = world;
  const group = new THREE.Group(); group.name = 'set'; scene.add(group);
  const M = makeMaterials(); extraMaterials(M);
  const colliders = [];
  const B = (a, b) => new THREE.Box3(V(...a), V(...b));
  const batch = new Batch();
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas(64)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
  const S = {
    M, batch, colliders, B, group, lib: { loftGeometry }, plateBandMat: F.plateMaterials()[0],
    pumpkin(add, x, y, z, r, material, seed) {
      const [body, stem] = F.pumpkinMeshes(M, r, material, seed);
      body.position.add(V(x, y, z)); stem.position.add(V(x, y, z));
      add(body); add(stem);
    },
  };
  const dyn = buildRoom(S);

  // ------------------------------------------------------------------ table (wood under a cream cloth)
  const T = TABLE, add = (o) => batch.add(o);
  {
    const wood = M.walnut;
    const top = new THREE.Mesh(chamferBox(T.maxX - T.minX - 0.04, T.thick, T.maxZ - T.minZ - 0.04, 0.006), wood);
    top.position.set(0, T.topY - 0.006 - T.thick / 2, 0); add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(F.beam([sx * (T.maxX - T.legInset), 0, sz * (T.maxZ - T.legInset)], [sx * (T.maxX - T.legInset), T.topY - 0.05, sz * (T.maxZ - T.legInset)], T.legSize, T.legSize, wood));
    }
    for (const sz of [-1, 1]) { const a = mesh(new THREE.BoxGeometry(T.maxX * 2 - 0.3, 0.07, 0.025), wood); a.position.set(0, T.topY - 0.085, sz * (T.maxZ - 0.09)); add(a); }
    // cloth: top sheet + 4 skirts (open underneath), skirt bottom edge gently wavy
    const ct = 0.004, x0 = T.minX, x1 = T.maxX, z0 = T.minZ, z1 = T.maxZ, yb = T.topY - T.clothDrop;
    const sheet = mesh(new THREE.BoxGeometry(x1 - x0, ct, z1 - z0), M.cloth); sheet.position.set(0, T.topY - ct / 2, 0); add(sheet);
    const skirt = (len, along) => {
      const g = new THREE.BoxGeometry(along === 'x' ? len : ct, T.clothDrop, along === 'x' ? ct : len, along === 'x' ? 40 : 1, 1, along === 'x' ? 1 : 18);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const u = along === 'x' ? p.getX(i) : p.getZ(i); p.setY(i, p.getY(i) + 0.003 * Math.sin(u * 22)); }
      g.computeVertexNormals();
      return g;
    };
    const yc = yb + T.clothDrop / 2 - 0.0005;
    const sf = mesh(skirt(x1 - x0 + 2 * ct, 'x'), M.cloth); sf.position.set(0, yc, z1 + ct / 2); add(sf);
    const sb = mesh(skirt(x1 - x0 + 2 * ct, 'x'), M.cloth); sb.position.set(0, yc, z0 - ct / 2); add(sb);
    const sl = mesh(skirt(z1 - z0, 'z'), M.cloth); sl.position.set(x0 - ct / 2, yc, 0); add(sl);
    const sr = mesh(skirt(z1 - z0, 'z'), M.cloth); sr.position.set(x1 + ct / 2, yc, 0); add(sr);
    const rn = mesh(new THREE.BoxGeometry(2.3, H.runner, 0.3), M.runner, { cast: false }); rn.position.set(0, T.topY + H.runner / 2 + 0.0004, 0); add(rn);
    colliders.push({ name: 'table', box: B([x0 - ct, yb, z0 - ct], [x1 + ct, T.topY + 0.004, z1 + ct]) });
  }
  const onRunner = T.topY + H.runner + 0.0008;

  // ------------------------------------------------------------------ chairs
  const chairs = {};
  const chairColliders = [];
  for (const [name, s] of Object.entries(SEATS)) {
    const c = F.chairGroup(M, CHAIR);
    c.traverse((m) => { if (m.isMesh) m.name = `chair.${name}`; });
    c.position.set(s.pos[0], 0, s.pos[1]); c.rotation.y = s.rotY;
    group.add(c); chairs[name] = c;
    chairColliders.push({ name: `chairSeat_${name}`, box: new THREE.Box3(), chair: c, local: c.userData.seatBox });
    chairColliders.push({ name: `chairBack_${name}`, box: new THREE.Box3(), chair: c, local: c.userData.backBox });
  }
  colliders.push(...chairColliders);
  const updateChairColliders = () => { for (const c of chairColliders) { c.chair.updateMatrixWorld(true); c.box.copy(c.local).applyMatrix4(c.chair.matrixWorld); } };
  updateChairColliders();

  // ------------------------------------------------------------------ place settings
  const [plateMatA, plateMatB] = F.plateMaterials();
  const places = {};
  const fwd = (ry) => V(Math.sin(ry), 0, Math.cos(ry));
  const right = (ry) => V(-Math.cos(ry), 0, Math.sin(ry));
  for (const [name, s] of Object.entries(SEATS)) {
    const P = V(s.plate[0], 0, s.plate[1]), f = fwd(s.rotY), r = right(s.rotY);
    const at = (dx, dz) => P.clone().addScaledVector(r, dx).addScaledVector(f, dz);
    const charger = F.chargerMesh(M); charger.position.set(P.x, T.topY + 0.0005, P.z); group.add(charger);
    const plate = new THREE.Group(); plate.name = `plate.${name}`;
    plate.add(mesh(F.plateGeo(), name === 'you' ? plateMatB : plateMatA, { name: `plate.${name}` }));
    plate.position.set(P.x, H.plateY, P.z); plate.rotation.y = s.rotY; group.add(plate);
    const np = at(PLACE.napkin[0], PLACE.napkin[1]);
    const napkin = F.napkinMesh(name === 'you' || name === 'uncle' ? M.napkin : M.napkinGold); napkin.position.set(np.x, T.topY + 0.0006, np.z); napkin.rotation.y = s.rotY; group.add(napkin);
    const fp = at(PLACE.fork[0], PLACE.fork[1]);
    const fork = F.forkGroup(M); fork.position.set(fp.x, T.topY + 0.0106, fp.z); fork.rotation.y = s.rotY; group.add(fork);
    fork.traverse((m) => { if (m.isMesh) m.name = `fork.${name}`; });
    const kp = at(PLACE.knife[0], PLACE.knife[1]);
    const knife = F.knifeGroup(M); knife.position.set(kp.x, T.topY + 0.0006, kp.z); knife.rotation.y = s.rotY; group.add(knife);
    const gp = at(PLACE.glass[0], PLACE.glass[1]);
    const glass = F.glassGroup(M); glass.position.set(gp.x, T.topY + 0.0006, gp.z); group.add(glass);
    places[name] = { plate, charger, napkin, fork, knife, glass };
  }

  // ------------------------------------------------------------------ serving dishes
  const D = DISHES;
  const place = (obj, d, y = onRunner, ry = 0) => { obj.position.set(d.x, y, d.z); obj.rotation.y = ry; group.add(obj); return obj; };
  const platter = place(F.platterGroup(M, 0.23, 0.155), D.turkey);
  const turkey = F.buildTurkey(M); turkey.position.set(D.turkey.x, onRunner + 0.006, D.turkey.z); turkey.rotation.y = 0.15; group.add(turkey);
  F.garnish(M, platter, 0.19, 0.122, 0.006, 5, 14, (x, z) => (x / 0.15) ** 2 + (z / 0.105) ** 2 < 1);
  const potatoesBowl = place(F.potatoBowlGroup(M), D.potatoes);
  const saucer = mesh(F.saucerGeo(), M.porcelain, { name: 'gravySaucer' }); saucer.position.set(D.gravy.x, onRunner, D.gravy.z); group.add(saucer);
  const gravyBoat = F.gravyBoatGroup(M); gravyBoat.name = 'gravyBoat'; gravyBoat.position.set(D.gravy.x, onRunner + 0.005, D.gravy.z); group.add(gravyBoat);
  const beans = place(F.beansGroup(M), D.beans);
  const corn = place(F.cornGroup(M), D.corn, onRunner, 0.2);
  const cranberry = place(F.cranberryGroup(M), D.cranberry);
  const rolls = place(F.rollsGroup(M), D.rolls);
  const pie = place(F.pieGroup(M), D.pie, onRunner, 0.4);
  const candles = D.candles.map((c, i) => { const g = F.candleGroup(M, M.flame, glowMat, i === 0 ? 0.2 : 0.17, M.candleRed); g.position.set(c.x, onRunner, c.z); group.add(g); return g; });
  for (const [name, o] of Object.entries({ platter, turkey, potatoesBowl, saucer, beans, corn, cranberry, rolls, pie })) {
    o.updateMatrixWorld(true);
    colliders.push({ name: `dish_${name}`, box: new THREE.Box3().setFromObject(o), allow: ['grandma'] });
  }
  for (const [i, c] of candles.entries()) { c.updateMatrixWorld(true); colliders.push({ name: `candle${i}`, box: new THREE.Box3().setFromObject(c) }); }

  // side candles on the sideboard: flames only (wax pillars are built by the room)
  const sideFlames = (dyn.sideCandles || []).map(({ pos }) => {
    const g = F.candleGroup(M, M.flame, glowMat, 0.0001, M.candle);
    g.children.forEach((m) => { if (m !== g.userData.flame) m.visible = false; });
    g.position.set(pos[0], pos[1] - g.userData.top - 0.004, pos[2]); g.scale.setScalar(1.5); group.add(g); return g;
  });

  // ------------------------------------------------------------------ table decor: leaves + mini pumpkins on free spots
  {
    const R = rng(77);
    const blockers = [];
    for (const d of [D.rolls, D.corn, D.cranberry, D.potatoes, D.gravy, D.beans, D.pie]) blockers.push([d.x, d.z, 0.13]);
    blockers.push([D.turkey.x, D.turkey.z, 0.26]);
    for (const c of D.candles) blockers.push([c.x, c.z, 0.07]);
    for (const s of Object.values(SEATS)) blockers.push([s.plate[0], s.plate[1], 0.33]);
    blockers.push([-0.43, -0.215, 0.17], [0.43, 0.215, 0.17]); // serving utensils
    const free = (x, z, r) => blockers.every(([bx, bz, br]) => Math.hypot(x - bx, z - bz) > br + r);
    const leafMats = [M.leafRed, M.leafOrange, M.leafYellow, M.leafBrown];
    const lg = [leafGeo(0.06, 0.22, 0), leafGeo(0.055, 0.2, 1)];
    let n = 0;
    for (let k = 0; k < 600 && n < 26; k++) {
      const x = -1.2 + R() * 2.4, z = -0.15 + R() * 0.3;
      if (!free(x, z, 0.03)) continue;
      const m = mesh(lg[n % 2], leafMats[n % 4], { cast: false }); m.position.set(x, onRunner + 0.0015 + (n % 3) * 0.0012, z); m.rotation.y = R() * 6.28;
      add(m); blockers.push([x, z, 0.035]); n++;
    }
    let p = 0;
    for (let k = 0; k < 600 && p < 4; k++) {
      const x = -1.2 + R() * 2.4, z = -0.13 + R() * 0.26, r = 0.03 + R() * 0.015;
      if (!free(x, z, r + 0.01)) continue;
      S.pumpkin(add, x, onRunner, z, r, p % 2 ? M.pumpkinWhite : M.pumpkin, 60 + p);
      blockers.push([x, z, r + 0.02]); p++;
    }
  }

  // ------------------------------------------------------------------ YOU's plate food + holdable props
  const yourPlace = places.you;
  const plateC = V(SEATS.you.plate[0], H.foodY, SEATS.you.plate[1]);
  const turkeySlice = F.turkeySliceGroup(M, 3); turkeySlice.name = 'turkeySlice'; group.add(turkeySlice);
  const potatoMound = mesh(F.moundGeo(0.048, 0.042, 21, 12, 6, 0.16, 0.25), M.potato, { name: 'yourPotatoes' });
  potatoMound.position.set(plateC.x + 0.035, H.foodY, plateC.z + 0.015); group.add(potatoMound);
  const gravyCap = mesh(F.moundGeo(0.04, 0.03, 22, 12, 5, 0.1, 0.1), M.gravy, { name: 'yourGravyCap' });
  gravyCap.position.copy(potatoMound.position).add(V(0, 0.016, 0)); group.add(gravyCap);
  const gravyPool = mesh(polarDisc(1, 3, 16), M.gravyPool, { name: 'yourGravyPool', cast: false });
  gravyPool.position.set(potatoMound.position.x, H.foodY + 0.0012, potatoMound.position.z); group.add(gravyPool);
  const servingFork = F.servingForkGroup(M); servingFork.name = 'servingFork'; group.add(servingFork);
  const bigSpoon = F.bigSpoonGroup(M); bigSpoon.name = 'bigSpoon'; group.add(bigSpoon);
  const spoonPotato = mesh(F.moundGeo(0.03, 0.026, 23, 10, 5, 0.18, 0.2), M.potato, { name: 'spoonPotato' });
  spoonPotato.position.set(0, 0.012, 0.055); bigSpoon.add(spoonPotato);
  const yourFork = yourPlace.fork; yourFork.name = 'yourFork';
  const forkTurkey = mesh(new THREE.BoxGeometry(0.026, 0.014, 0.022), M.meat, { name: 'forkTurkey' }); forkTurkey.position.set(0, 0.014, 0.075); yourFork.add(forkTurkey);
  const forkPotato = mesh(F.moundGeo(0.016, 0.018, 24, 8, 4, 0.2, 0.2), M.potato, { name: 'forkPotato' }); forkPotato.position.set(0, 0.008, 0.074); yourFork.add(forkPotato);
  const forkGravy = mesh(lowSphere(0.011, 0.004, 0.011, 6, 3), M.gravy); forkGravy.position.set(0, 0.016, 0); forkPotato.add(forkGravy);
  const streamGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 6, true); streamGeo.translate(0, 0.5, 0);
  const gravyStream = mesh(streamGeo, M.gravyStream, { name: 'gravyStream', cast: false }); gravyStream.visible = false; group.add(gravyStream);
  const thirdPlate = new THREE.Group(); thirdPlate.name = 'thirdPlate';
  {
    const tp = thirdPlate, y0 = H.plateWell;
    tp.add(mesh(F.plateGeo(), plateMatA, { name: 'thirdPlate.plate' }));
    const pm = mesh(F.moundGeo(0.07, 0.085, 31, 14, 7, 0.16, 0.3), M.potato, { name: 'thirdPlate.potatoes' }); pm.position.set(0, y0, 0); tp.add(pm);
    const gc = mesh(F.moundGeo(0.055, 0.05, 32, 12, 5, 0.14, 0.15), M.gravy); gc.position.set(0, y0 + 0.042, 0); tp.add(gc);
    const pool = mesh(polarDisc(0.1, 3, 16), M.gravyPool, { cast: false }); pool.position.y = y0 + 0.0012; tp.add(pool);
    for (const [x, z, ry, s] of [[-0.06, 0.04, 0.5, 6], [-0.045, -0.05, -0.4, 7]]) { const sl = F.turkeySliceGroup(M, s); sl.position.set(x, y0 + 0.004, z); sl.rotation.set(0.25, ry, 0.15); tp.add(sl); }
    const cob = mesh(F.cobGeo(0.13, 0.019), M.corn); cob.position.set(0.04, y0 + 0.028, 0.075); cob.rotation.set(0.3, 0.3, 0.2); tp.add(cob);
    const R = rng(91);
    for (let i = 0; i < 16; i++) { const b = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4), M.bean); b.position.set(0.07 + (R() - 0.5) * 0.04, y0 + 0.012 + R() * 0.02, -0.04 + (R() - 0.5) * 0.05); b.rotation.set(Math.PI / 2 + (R() - 0.5), R() * 3, (R() - 0.5) * 0.6); tp.add(b); }
    const cr = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 12), M.cranberry); cr.position.set(-0.08, y0 + 0.012, 0); cr.rotation.set(0.7, 0, 0.3); tp.add(cr);
    const roll = mesh(lowSphere(0.033, 0.026, 0.04, 8, 5), M.roll); roll.position.set(0.02, y0 + 0.095, 0.01); roll.rotation.set(0.2, 0.7, 0.1); tp.add(roll);
    const wedge = F.pieWedge(M, 0, Math.PI / 4, { withDish: false }); wedge.position.set(0.075, y0 + 0.004, 0.035); wedge.rotation.set(0.15, 2.6, 0); wedge.scale.setScalar(0.9); tp.add(wedge);
    tp.userData.grips = {
      L: { pos: [-0.128, 0.012, 0], axis: [0, 0, 1], up: [0, 1, 0] },
      R: { pos: [0.128, 0.012, 0], axis: [0, 0, -1], up: [0, 1, 0] },
    };
    tp.userData.grip = tp.userData.grips.R;
    tp.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.add(tp);
  }

  // ------------------------------------------------------------------ lights
  const lights = {};
  lights.hemi = new THREE.HemisphereLight(0xfff0dc, 0xb89a80, 0.8); group.add(lights.hemi);
  lights.key = new THREE.DirectionalLight(0xffe0b4, 2.2);
  lights.key.position.set(1.0, 3.3, 2.2); lights.key.target.position.set(0, 0.7, -0.3);
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(2048, 2048);
  Object.assign(lights.key.shadow.camera, { left: -2.6, right: 2.6, top: 2.4, bottom: -2.4, near: 0.5, far: 8 });
  lights.key.shadow.bias = -0.0004; lights.key.shadow.normalBias = 0.02; lights.key.shadow.radius = 4;
  group.add(lights.key, lights.key.target);
  lights.window = new THREE.DirectionalLight(0xd8e4ff, 1.0); lights.window.position.set(-0.6, 2.2, -4.0); lights.window.target.position.set(0, 1.0, 0.8);
  group.add(lights.window, lights.window.target);
  lights.chandelier = new THREE.PointLight(0xffc888, 2.4, 5, 2); lights.chandelier.position.set(FURNITURE.chandelier.x, FURNITURE.chandelier.bottomY + 0.1, FURNITURE.chandelier.z); group.add(lights.chandelier);
  lights.frontFill = new THREE.PointLight(0xffd6a8, 1.6, 6, 2); lights.frontFill.position.set(0.3, 1.6, 1.9); group.add(lights.frontFill);
  const baseI = Object.fromEntries(Object.entries(lights).map(([k, l]) => [k, l.intensity]));

  batch.build(group, 'static');

  // ------------------------------------------------------------------ default (home) transforms, restored every frame
  servingFork.position.set(-0.43, T.topY + 0.0006, -0.215); servingFork.rotation.set(0, Math.PI / 2, 0);
  bigSpoon.position.set(0.43, T.topY + 0.0006, 0.215); bigSpoon.rotation.set(0, -Math.PI / 2 + 0.2, 0);
  turkeySlice.position.set(plateC.x - 0.035, H.foodY, plateC.z - 0.012); turkeySlice.rotation.set(0, 0.35, 0);
  thirdPlate.position.set(plateC.x, H.plateY + 0.0185, plateC.z); thirdPlate.rotation.y = 0.3;
  const homes = new Map();
  const setHome = (o) => homes.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), v: o.visible });
  for (const o of [servingFork, bigSpoon, gravyBoat, turkeySlice, thirdPlate, potatoMound, gravyCap, gravyPool, turkey, platter, potatoesBowl, ...candles]) setHome(o);
  for (const c of Object.values(chairs)) setHome(c);
  for (const p of Object.values(places)) for (const o of Object.values(p)) setHome(o);
  const turkeySliceHome = homes.get(turkeySlice).p.clone();

  const state = {};
  const props = {
    chairs, places, yourPlate: yourPlace.plate, yourFork, yourGlass: yourPlace.glass, turkey, platter, turkeySlice, servingFork,
    potatoesBowl, bigSpoon, spoonPotato, gravyBoat, gravyStream, candles, thirdPlate, pie, rolls, beans, corn, cranberry, saucer,
    potatoMound, gravyCap, gravyPool,
  };
  const anchors = {
    yourPlate: plateC.clone(), yourPotatoTop: potatoMound.position.clone().add(V(0, 0.045, 0)),
    turkeyTop: V(D.turkey.x, onRunner + 0.2, D.turkey.z), potatoesTop: V(D.potatoes.x, onRunner + 0.1, D.potatoes.z),
    candleFlames: candles.map((c) => V(c.position.x, onRunner + c.userData.top + 0.02, c.position.z)),
    onRunner,
  };

  function reset(t) {
    for (const [o, h] of homes) { o.position.copy(h.p); o.quaternion.copy(h.q); o.scale.copy(h.s); o.visible = h.v; }
    Object.assign(state, {
      plate: { turkey: t >= 11.9, potatoes: t >= 24.15, gravy: smooth(invLerp(25.05, 25.85, t)) },
      forkFood: null, spoonPotato: false, gravyPour: 0, glassRipple: 0, rattle: 0, candleFlicker: 0,
      chairOffset: {}, thirdPlate: t >= 45.8 ? 'placed' : 'hidden', lightDim: 0,
    });
    if (t >= 9.72) state.chairOffset.grandma = [GRANDMA_CHAIR_PULLED[0] - SEATS.grandma.pos[0], GRANDMA_CHAIR_PULLED[1] - SEATS.grandma.pos[1]];
  }

  const tmpV = V();
  function commit(ctx) {
    const t = ctx.t, st = state;
    for (const [name, c] of Object.entries(chairs)) {
      const o = st.chairOffset[name];
      if (o) { const h = homes.get(c).p; c.position.set(h.x + o[0], 0, h.z + o[1]); }
    }
    updateChairColliders();
    // the slice shows when it is on the plate, or when a shot has moved it (on the serving fork)
    const sliceMoved = turkeySlice.position.distanceTo(turkeySliceHome) > 1e-4;
    turkeySlice.visible = turkeySlice.visible && (st.plate.turkey || sliceMoved);
    potatoMound.visible = st.plate.potatoes;
    const g = clamp(st.plate.gravy);
    gravyCap.visible = st.plate.potatoes && g > 0.02; gravyCap.scale.set(0.6 + 0.45 * g, 0.4 + 0.75 * g, 0.6 + 0.45 * g);
    gravyPool.visible = st.plate.potatoes && g > 0.15; gravyPool.scale.set(0.035 + 0.05 * g, 1, 0.03 + 0.045 * g);
    thirdPlate.visible = st.thirdPlate !== 'hidden';
    if (st.thirdPlate === 'placed') { turkeySlice.visible = false; potatoMound.visible = gravyCap.visible = gravyPool.visible = false; }
    forkTurkey.visible = st.forkFood === 'turkey'; forkPotato.visible = st.forkFood === 'potato';
    spoonPotato.visible = !!st.spoonPotato;
    if (st.gravyPour > 0.01) {
      gravyBoat.updateMatrixWorld(true);
      const tip = V(...gravyBoat.userData.tip).applyMatrix4(gravyBoat.matrixWorld);
      const end = potatoMound.position.clone().add(V(0.004, 0.03, 0));
      const d = tmpV.subVectors(end, tip); const len = d.length();
      gravyStream.visible = true; gravyStream.position.copy(tip);
      gravyStream.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
      const w = 0.0045 * clamp(st.gravyPour * 1.5) * (1 + 0.15 * Math.sin(t * 40));
      gravyStream.scale.set(w, len, w);
    } else gravyStream.visible = false;
    if (st.rattle > 0) {
      const a = st.rattle;
      const jig = (o, seed, amp = 0.0025, rot = 0.03) => {
        o.position.x += noise1(t * 38, seed) * amp * a; o.position.z += noise1(t * 41, seed + 3) * amp * a;
        o.position.y += Math.max(0, noise1(t * 47, seed + 5)) * amp * 0.8 * a;
        o.rotation.y += noise1(t * 33, seed + 7) * rot * a;
      };
      jig(yourPlace.glass, 1); jig(yourPlace.plate, 2, 0.0015, 0.02); jig(yourPlace.knife, 4, 0.003, 0.06);
      if (!yourFork.userData.held) jig(yourFork, 3, 0.003, 0.06);
      jig(places.grandma.glass, 5, 0.0015); jig(places.cousinA.glass, 6, 0.0015); jig(potatoesBowl, 7, 0.001, 0.01);
      for (const [i, c] of candles.entries()) jig(c, 9 + i, 0.0012, 0.0);
    }
    for (const [name, p] of Object.entries(places)) {
      const amp = name === 'you' ? 0.0004 + st.glassRipple * 0.0045 + st.rattle * 0.002 : 0.0002;
      F.rippleSurface(p.glass.userData.surface, t, amp, name.length);
    }
    for (const [i, c] of candles.entries()) {
      const fl = c.userData.flame, k = 1 + st.candleFlicker * 2.5;
      fl.scale.set(1 + noise1(t * 7, i * 5) * 0.08 * k, 1 + noise1(t * 9, i * 5 + 1) * 0.15 * k, 1);
      fl.rotation.z = noise1(t * 6, i * 5 + 2) * 0.12 * k; fl.rotation.x = noise1(t * 5, i * 5 + 3) * 0.08 * k;
      c.userData.glow.material.opacity = 0.5 + noise1(t * 11, i) * 0.06;
    }
    for (const [i, c] of sideFlames.entries()) c.userData.flame.scale.set(1, 1 + noise1(t * 8, 20 + i) * 0.15, 1);
    if (dyn.fallingLeaves) animateLeaves(dyn, t);
    const dim = 1 - clamp(st.lightDim) * 0.55;
    for (const [k, l] of Object.entries(lights)) l.intensity = baseI[k] * dim * (k === 'chandelier' ? 1 + noise1(t * 3, 9) * 0.03 : 1);
  }

  return { group, colliders, props, anchors, state, lights, materials: M, reset, commit };
}
