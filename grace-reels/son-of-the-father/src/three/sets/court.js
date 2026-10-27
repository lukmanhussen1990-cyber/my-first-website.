// 'court' set: the stone pavement before the governor's palace in Jerusalem at Passover, the city around it, the
// temple far east in the haze, the hill outside the west wall. Shots S1-S5, S7-S10, S12-S14a, LOOP (cameras +
// blocking + the shared layout COURT in src/cams/court.js). Jesus (wrists bound with a rope), Barabbas (iron shackles
// + chain), Pilate on the judgment seat, chief priests, soldiers (spears upright, no violence), ~12 crowd rigs in the
// front rows + an instanced paper-card crowd of 380 behind them and on the roofs.
import * as THREE from 'three';
import { srgb, mixc, makeBevelBox, makeStone, scatterPots, scatterBaskets, makeMountains, makePathRibbon, makeBush, scatter, vcMat } from '../kit.js';
import { makePavement, makePalace, makeBema, makeGateWall, makeParapet, makePortico, makeCity, makeCityWall, makeTemple, makePalms, makeStraw,
  makeShackles, makeRope, makeBeamProp, makeCross, makeRocks, makeSmoke, makeBanner, makeStandard, makeBrazier, LIME } from '../jerusalem.js';
import { bakeCrowdAtlas, makeCrowd, crowdLayout } from '../crowd.js';
import { makeMotes, makeSprites, puffTex, makeBirds } from '../fx.js';
import { MOODS, merge, blend, resolve } from '../moods.js';
import { U } from '../materials.js';
import { Person, Poses, expr } from '../rig.js';
import '../poses3.js';
import { JESUS, BARABBAS, PILATE, PRIESTS, soldier, JERUSALEM_CROWD } from '../characters/cast.js';
import { clamp, smooth, invLerp, lerp, hash01, mulberry32, fbm, noise2, easeOut } from '../../lib/util.js';
import { COURT } from '../../cams/court.js';
import { cameraShot } from '../../lib/director.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- terrain
// courtyard + city east of it level at 0; west of the courtyard the lower city falls to -7.5 (a stair leads down);
// outside the walls a valley (-9), the hill rising out of it, far ridges around
export function heightAt(x, z) {
  if (x > -21 && x < 33 && z > -21.6 && z < 23) return 0;
  const inside = z > -125 && z < 380 && x < 100 && x > -130;
  let y;
  if (inside) y = -2.9 * smooth(invLerp(-21.6, -25.6, z)) - 4.6 * smooth(invLerp(-22, -110, z)) + 0.3 * fbm(x * 0.05, z * 0.05, 2, 3) * smooth(invLerp(-21, -30, z));
  else {
    y = -9 + 1.6 * fbm(x * 0.02, z * 0.02, 3, 7);
    const dh = Math.hypot(x - COURT.hill[0], z - COURT.hill[2]);
    y += 31 * Math.exp(-(dh * dh) / (2 * 23 * 23)) + 2.0 * fbm(x * 0.13, z * 0.13, 2, 9) * smooth(invLerp(55, 8, dh));
  }
  const r = Math.hypot(x - 20, z - 60);
  return y + 42 * smooth(invLerp(390, 680, r)) + 24 * smooth(invLerp(430, 580, z));
}

function terrainPatch({ x0, x1, z0, z1, nx, nz, height, color, drop = () => 0 }) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const y = height(x, z) - drop(x, z); p.setY(i, y); const col = color(x, z, y); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const g = geo.toNonIndexed(); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true;
  return m;
}
const groundColor = (x, z, y) => {
  const n = clamp(0.5 + fbm(x * 0.07, z * 0.07, 3, 5) * 1.2);
  const inside = z > -125 && z < 380 && x < 100 && x > -130;
  if (inside) return mixc(srgb('#b09a74'), srgb('#c4ae86'), n);
  const dh = Math.hypot(x - COURT.hill[0], z - COURT.hill[2]);
  const rock = smooth(invLerp(40, 8, dh)) * clamp(0.4 + fbm(x * 0.2, z * 0.2, 2, 11));
  let c = mixc(srgb('#9a9064'), srgb('#ab9e6e'), n);
  c = mixc(c, srgb('#8d8069'), rock);                  // the hill's rock a shade darker (it must read against a storm sky)
  return mixc(c, srgb('#9d9a86'), smooth(invLerp(150, 500, Math.hypot(x, z))) * 0.5);
};

// ---------------------------------------------------------------- city lots
function cityLots(seed = 17) {
  const R = mulberry32(seed), lots = [];
  const region = (x0, x1, z0, z1, { h = [3.5, 7.5], skip = () => false, cell = 10 } = {}) => {
    for (let x = x0; x < x1; x += cell) for (let z = z0; z < z1; z += cell) {
      if (R() < 0.07) continue;
      const w = 5.4 + R() * 3.2, d = 5.4 + R() * 3.2, cx = x + cell / 2 + (R() - 0.5) * 1.4, cz = z + cell / 2 + (R() - 0.5) * 1.4;
      if (skip(cx, cz, w, d)) continue;
      const y = heightAt(cx, cz) - 0.4;
      lots.push({ x: cx, z: cz, w, d, h: h[0] + R() * (h[1] - h[0]), y, rot: [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(R() * 4)] + (R() - 0.5) * 0.06,
        dome: R() < 0.06, booth: R() < 0.13, awning: R() < 0.1, color: LIME[Math.floor(R() * LIME.length)] });
    }
  };
  const street = (cx, w) => Math.abs(cx - 4.5) < w;
  region(-128, 98, 27, 205, { skip: (x, z) => street(x, 4.4) || Math.abs(z - 64) < 3.5 || Math.abs(z - 122) < 3.5 || (x > -70 && x < 70 && z > 180) });
  region(-128, 98, -122, -27, { h: [3.2, 6.2], skip: (x, z) => street(x, 4.6) || Math.abs(z - -60) < 3.5 || Math.abs(z - -94) < 3.5 });
  region(34, 98, -21, 26, { h: [4, 8] });
  region(-128, -24, -21, 26, { h: [4, 8] });
  return lots;
}

// ---------------------------------------------------------------- the people
const SOLDIER_KINDS = [0, 1, 2, 3].map((i) => soldier(i));
const soldierOf = (i) => ({ ...SOLDIER_KINDS[i % 4], name: `Soldier ${i + 1}` });

// view + facing for a paper figure from the camera and the way the person faces (world yaw)
function orient(p, cam, yaw, { pref = 1, force = null } = {}) {
  const P = p.root.getWorldPosition(_w);
  const tx = cam.position.x - P.x, tz = cam.position.z - P.z, l = Math.hypot(tx, tz) || 1;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const front = (fx * tx + fz * tz) / l, side = (fx * tz - fz * tx) / l;
  let view = force || (front > 0.42 ? 'threeQuarter' : front < -0.42 ? 'back' : 'side');
  const f = Math.abs(side) < 0.12 ? pref : side >= 0 ? 1 : -1;
  p.setView(view); p.setFacing(f);
  return { view, facing: f, front, side };
}
const _w = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c3 = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const Bk = ctx.B.court;
  const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const g = new THREE.Group();
  const H = heightAt;
  const { J, B } = COURT;

  // ---- ground
  const near = { x0: -140, x1: 160, z0: -290, z1: 420 };
  g.add(terrainPatch({ ...near, nx: 90, nz: 210, height: H, color: groundColor }));
  const inNear = (x, z) => x > near.x0 + 2 && x < near.x1 - 2 && z > near.z0 + 2 && z < near.z1 - 2;
  g.add(terrainPatch({ x0: -800, x1: 800, z0: -800, z1: 900, nx: 110, nz: 120, height: H, color: groundColor, drop: (x, z) => (inNear(x, z) ? 3 : 0) }));
  g.add(makeMountains({ seed: 4, n: 18, r0: 620, r1: 760, h0: 30, h1: 75, color: '#a0957a' }));

  // ---- the courtyard: pavement, palace + judgment seat (north side, facing south), portico (south), gate wall (east),
  // parapet + stair (west)
  const C = COURT.court;
  g.add(makePavement({ x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1, seed: 11 }));
  const pal = new THREE.Group(); pal.rotation.y = -Math.PI / 2; g.add(pal);   // local (x, z) -> world (-z, x)
  const palace = makePalace({ x0: -20, x1: 20, z0: -17.0, z1: -10.9, wallZ: -14.7, colH: 7.2, top: 15.5 }); pal.add(palace.group);
  const bema = makeBema({ x: COURT.dais.z, z0: -10.9, z1: -8.1, h: COURT.dais.h, seat: [0, COURT.dais.h, -COURT.seat[0]] }); pal.add(bema.group);
  const banners = [];
  for (const lx of [-3.89, 3.89]) { const bn = makeBanner(1.7, 4.1, { colors: ['#8e1c1c', '#d0a84e'], seed: 3 + lx }); bn.position.set(lx, 8.35, -11.62); pal.add(bn); banners.push(bn); }
  for (const lx of [-11.66, 11.66]) { const bn = makeBanner(1.5, 3.4, { colors: ['#6e1a1a', '#c9a24a'], seed: 9 + lx }); bn.position.set(lx, 8.35, -11.62); pal.add(bn); }
  for (const lx of [-4.4, 4.4]) { const st = makeStandard(3.6, 5 + lx); st.position.set(lx, 1.2, -11.6); pal.add(st); }
  const braziers = [-1.9, 1.9].map((lx, i) => { const b = makeBrazier(7 + i, 0.9); b.group.position.set(lx, COURT.dais.h, -8.45); pal.add(b.group); return b; });
  g.add(makePortico({ x: -16.0, back: -20.4, z0: -19.6, z1: 19.6, colH: 6, n: 11 }));
  const gw = new THREE.Group(); gw.position.x = COURT.gate[0]; g.add(gw);
  gw.add(makeGateWall({ x0: C.x0 - COURT.gate[0] - 4, x1: C.x1 - COURT.gate[0] + 0.2, z: C.z1 + 0.05, open: 1.2 }));
  for (const sx of [-1, 1]) { const bn = makeBanner(1.3, 3.2, { colors: ['#8e1c1c', '#d0a84e'], seed: 21 + sx }); bn.position.set(sx * 5.8, 11.6, C.z1 - 2.75); bn.rotation.y = Math.PI; gw.add(bn); }
  const wp = new THREE.Group(); wp.rotation.y = Math.PI / 2; g.add(wp);       // local (x, z) -> world (z, -x)
  wp.add(makeParapet({ x: -C.z0, z0: C.x0, z1: C.x1, gap: [COURT.westStair.x0, COURT.westStair.x1], h: 1.1, down: COURT.westStair.down }));
  // courtyard dressing: amphorae + baskets by the portico, palms in planters, straw on the stone, a water basin
  g.add(scatterPots(26, { points: Array.from({ length: 26 }, (_, i) => [-15.0 + 0.6 * hash01(i, 3), -18 + i * 1.42 + 0.4 * hash01(i, 4)]), height: () => 0, scale: [0.9, 1.4] }));
  g.add(scatterBaskets(8, { points: [[-14.6, -6], [-14.4, 7], [-14.7, 12.5], [8.5, -17], [8.8, 17.5], [-14.6, 16], [9.2, -14.5], [-14.5, -13]], height: () => 0 }));
  const courtPalms = makePalms([[9.4, -19.4], [9.4, 19.4], [-15.2, -20.2], [-15.2, 20.6], [7.6, -20.6], [-3, -20.8]], { seed: 31 }); g.add(courtPalms);
  for (const [x, z] of [[9.4, -19.4], [9.4, 19.4], [-15.2, -20.2], [-15.2, 20.6], [7.6, -20.6], [-3, -20.8]]) { const pl = makeBevelBox(1.2, 0.7, 1.2, '#b89a72', { bevel: 0.06, seed: 40 + x }); pl.position.set(x, 0.35, z); g.add(pl); }
  g.add(makeStraw(520, { area: [C.x0 + 1, C.z0 + 1, C.x1 - 1, C.z1 - 1], seed: 8 }));
  const basin = makeBevelBox(2.2, 0.6, 1.4, '#cdbb96', { bevel: 0.08, seed: 51 }); basin.position.set(7.4, 0.3, -15.5); g.add(basin);

  // ---- the city around, its walls, the temple, the hill
  const lots = cityLots(17);
  g.add(makeCity(lots, { seed: 5 }));
  g.add(makeCityWall([[-130, -125], [1.6, -125]], { heightAt: H, seed: 3 }));
  g.add(makeCityWall([[7.4, -125], [100, -125], [100, 212]], { heightAt: H, seed: 4 }));
  g.add(makeCityWall([[-130, 212], [-130, -125]], { heightAt: H, seed: 5 }));
  const temple = makeTemple({ c: COURT.temple, baseY: -3, top: 7 }); g.add(temple.group);
  g.add(makePalms(Array.from({ length: 40 }, (_, i) => { const L = lots[(i * 37) % lots.length]; return [L.x + L.w * 0.6, L.z + L.d * 0.62]; }).filter(([x, z]) => Math.abs(x - 4.5) > 6), { seed: 33, height: H }));
  const path = [[4.5, -128], [6.5, -146], [3.5, -163], [8, -179], [12.5, -193], [11.2, -204], [14, -213]];
  g.add(makePathRibbon(path, { width: 2.2, height: H, color: '#c8b48c', edge: '#b3a37f', lift: 0.12, seg: 6 }));
  const rocks = []; { const R = mulberry32(71); for (let i = 0; i < 160; i++) { const a = R() * TAU, r = 6 + 40 * Math.sqrt(R()); const x = COURT.hill[0] + Math.cos(a) * r, z = COURT.hill[2] + Math.sin(a) * r; rocks.push([x, z]); } }
  g.add(makeRocks(rocks, { seed: 13 }));
  const bushGeo = makeBush(1.0, { seed: 5, colors: ['#6f7a3a', '#7d8642', '#646f34'] }).geometry;
  g.add(scatter(bushGeo, vcMat(), 0, { points: rocks.slice(0, 60).map(([x, z], i) => [x + 2.5 * hash01(i, 2), z + 2.5 * hash01(i, 3)]), height: H, scale: [0.7, 1.6], tilt: 0.05, colors: ['#ffffff'], seed: 7 }));
  const cross = makeCross(4.8, 2.3); cross.position.set(COURT.hill[0], H(COURT.hill[0], COURT.hill[2]) - 0.3, COURT.hill[2]); cross.rotation.y = 0.2; g.add(cross);

  // ---- the crowd: rigs in the front rows, paper cards behind (and on the roofs, in the streets)
  const renderer = ctx.world.gl;
  const atlas = bakeCrowdAtlas(renderer, JERUSALEM_CROWD, { tileW: 192, tileH: 384 });
  const heroSpots = [];
  { const R = mulberry32(91); for (const [x, z] of [[1.1, -6.6], [0.9, -4.9], [1.25, -3.3], [0.62, -1.95], [1.3, 1.4], [0.8, 4.2], [1.15, 5.9], [0.5, 7.6], [-0.3, -7.6], [-0.45, -5.6], [-0.55, 2.6], [-0.2, 6.6]]) heroSpots.push([x + (R() - 0.5) * 0.2, z + (R() - 0.5) * 0.2]); }
  const priestSpots = [[1.0, -2.6], [0.75, 3.0], [-0.35, 0.5]];
  const heroCrowd = heroSpots.map(([x, z], i) => {
    const o = { ...JERUSALEM_CROWD[(i * 5 + 3) % JERUSALEM_CROWD.length], quality: i < 4 ? 'main' : 'crowd' };
    const p = new Person(o); p.root.position.set(x, 0, z); g.add(p.root); return { p, x, z, seed: 300 + i * 11, i };
  });
  const people = crowdLayout({ box: [COURT.crowd.x0, COURT.crowd.z0, 1.5, COURT.crowd.z1], density: 0.62, seed: 7, lookAt: [COURT.seat[0], COURT.seat[2]], variants: atlas.nV,
    skip: (x, z) => (x > -1.4 && Math.abs(z) < 9.2) || (x > -16 && x < -15) });
  const crowd = makeCrowd(atlas, people); g.add(crowd.group);
  // pilgrims on the roofs nearest the courtyard and in the street outside the gate (for the crane-up)
  const R2 = mulberry32(93), roofPeople = [];
  for (const L of lots) {
    if (Math.hypot(L.x - 0, L.z - 10) > 95 || R2() > 0.45) continue;
    const n = 1 + Math.floor(R2() * 3);
    for (let k = 0; k < n; k++) roofPeople.push({ x: L.x + (R2() - 0.5) * L.w * 0.6, z: L.z + (R2() - 0.5) * L.d * 0.6, y: L.y + L.h + 0.07, face: Math.atan2(0 - L.x, 0 - L.z) + (R2() - 0.5), v: Math.floor(R2() * atlas.nV), s: 0.95 + 0.1 * R2(), seed: R2() });
  }
  for (let i = 0; i < 70; i++) roofPeople.push({ x: 4.5 + (R2() - 0.5) * 7, z: 26 + R2() * 90, y: 0, face: R2() * TAU, v: Math.floor(R2() * atlas.nV), s: 0.95 + 0.1 * R2(), seed: R2() });
  const city = makeCrowd(atlas, roofPeople); g.add(city.group);

  // ---- the cast
  const jesus = new Person({ ...JESUS }), barabbas = new Person({ ...BARABBAS }), pilate = new Person({ ...PILATE });
  const priests = PRIESTS.map((o) => new Person({ ...o }));
  const guards = [0, 1].map((i) => new Person({ ...soldierOf(i) }));                       // beside the two men
  const daisS = [2, 3].map((i) => new Person({ ...soldierOf(i) }));                        // flanking the seat
  const line = [4, 5, 6, 7].map((i) => new Person({ ...soldierOf(i) }));                   // holding the crowd back
  const leaders = [8, 9].map((i) => new Person({ ...soldierOf(i) }));                      // lead Jesus away (S10)
  const jesusFar = new Person({ ...JESUS, noShadow: true }), farS = [1, 2].map((i) => new Person({ ...soldierOf(i), noShadow: true }));
  const all = [jesus, barabbas, pilate, ...priests, ...guards, ...daisS, ...line, ...leaders, jesusFar, ...farS];
  for (const p of all) g.add(p.root);
  priests.forEach((p, i) => p.root.position.set(priestSpots[i][0], 0, priestSpots[i][1]));
  // props: rope on Jesus' wrists, shackles on Barabbas, the beam far away
  const rope = makeRope(); g.add(rope);
  const shackles = makeShackles({ links: 22, sag: 0.34 }); g.add(shackles.group);
  const beam = makeBeamProp(2.0); jesusFar.attach(beam, 'torso');
  // invisible shadow caster (S4: Barabbas walks in hard shadow)
  const caster = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 2.6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  caster.castShadow = true; caster.position.set(-1.6, 4.5, -0.75); caster.scale.set(1, 1, 0.38); g.add(caster);

  // ---- fx: dust motes in the sunbeams, crowd dust, the temple smoke, doves over the city
  const motes = makeMotes(220, 41); g.add(motes.group);
  const dust = makeSprites(70, { tex: puffTex(), order: 4 }); g.add(dust.group);
  const smoke = makeSmoke(36, 3); g.add(smoke.group);
  const birds = makeBirds(14, 5, '#efe8da'); g.add(birds.group);
  const _o = new THREE.Vector3();

  // per-shot helpers
  const isS1 = (id) => id === 'S1' || id === 'LOOP';
  const lift = (t) => smooth(invLerp(E.eyesLift - 0.1, E.eyesLift + 1.0, t));
  const tintAll = (k) => { for (const p of all) { p.uni.uTint.value.setScalar(k); p.uni.uLit.value = 1; } for (const h of heroCrowd) h.p.uni.uTint.value.setScalar(k); };
  const tw = (t, id) => Bk.worldTime(t, id);
  // the shackles' release: wrist positions frozen at the moment they fall
  const rel = { a: new THREE.Vector3(), b: new THREE.Vector3(), set: false };

  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), fa1 = new THREE.Vector3(), fa2 = new THREE.Vector3();
  function placeWrists(p, cam, out1, out2, push = 0.035) {
    p.root.updateMatrixWorld(true);
    p.jointWorld('armF.hand', out1); p.jointWorld('armB.hand', out2);
    p.jointWorld('armF.el', _e1); p.jointWorld('armB.el', _e2);
    fa1.copy(out1).sub(_e1).normalize(); fa2.copy(out2).sub(_e2).normalize();     // forearm directions (elbow -> wrist)
    out1.addScaledVector(fa1, -0.035); out2.addScaledVector(fa2, -0.035);          // the cuff sits just above the hand
    _d.set(cam.position.x - out1.x, 0, cam.position.z - out1.z).normalize();
    out1.addScaledVector(_d, push); out2.addScaledVector(_d, push);
    return _d;
  }
  // where Barabbas's wrists are at the moment the shackles fall (a pure function: his mark, the S10 camera at ev.shacklesFall)
  const relCam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 2000);
  function releaseWrists() {
    const c0 = cameraShot(plan, S.S10, E.shacklesFall);
    const o = new THREE.Vector3(); g.getWorldPosition(o);
    relCam.position.set(...c0.pos); relCam.lookAt(...c0.look); relCam.updateMatrixWorld();
    const keep = barabbas.root.position.clone();
    barabbas.root.position.set(B[0], 0, B[2]);
    orient(barabbas, relCam, 0, { pref: -1 });
    barabbas.pose(Poses.shackled(E.shacklesFall, 15, 0.6)); barabbas.billboard(relCam, 0.3);
    placeWrists(barabbas, relCam, rel.a, rel.b, 0.035); rel.da = fa1.clone(); rel.db = fa2.clone();
    barabbas.root.position.copy(keep); rel.set = true;
  }

  return {
    group: g, persons: all, heightAt: H,
    update(t, cam, shot, c) {
      const id = shot.id, T = tw(t, id), k = Bk.crowdK(t, id);
      U.uTime.value = T;
      const s9 = id === 'S9', far = ['S3', 'S10', 'S12', 'S13'].includes(id);
      // what is on stage
      cross.visible = id === 'S13';
      courtPalms.visible = id !== 'S12';                   // S12: their fronds stood right over the far hill
      jesusFar.root.visible = farS[0].root.visible = farS[1].root.visible = id === 'S12';
      caster.visible = id === 'S4';
      temple.group.visible = !['S12', 'S13', 'S14a'].includes(id);
      city.group.visible = far || id === 'S1' || id === 'LOOP';
      tintAll(1);
      // ---- Jesus
      const jp = Bk.jesusAt(t, id);
      jesus.root.position.set(jp[0], 0, jp[2]);
      jesus.root.visible = !['S12', 'S13', 'S14a'].includes(id);
      if (jesus.root.visible) {
        const o = orient(jesus, cam, jp[3], { pref: id === 'S8' ? -1 : 1, force: id === 'S5' ? 'back' : null });
        let fn;
        if (id === 'S4' || (id === 'S10' && jp[4])) fn = (tt) => { const P = Poses.walk(tt, 33, id === 'S10' ? 0.55 : 0.8, 0.7); P.aF = [0.235, 1.0, 0.1]; P.aB = [-0.53, 1.48, 0.06]; P.handF = P.handB = 'open'; expr(P, 'peace', 1); P.brow = 0; return P; };
        else if (isS1(id)) fn = (tt) => Poses.bound(tt, 33, lift(t));
        else if (id === 'S8') fn = (tt) => { const P = Poses.bound(tt, 33, 0.35); P.breath *= 0.5; return P; };
        else if (s9) fn = (tt) => Poses.bound(E.freeze + (t - E.freeze) * 0.3, 33, 0.25 + 0.35 * smooth(invLerp(E.goldName - 0.4, E.goldName + 1.2, t)));
        else fn = (tt) => Poses.bound(tt, 33, 0.4);
        jesus.act(fn, s9 ? E.freeze : T, { wind: isS1(id) ? 0.95 : 0.5, vx: jp[4] ? 0.6 * (o.facing) : 0 });
        jesus.billboard(cam, 0.3); jesus.autoOutline(cam);
        // rope on the wrists (midpoint of the two hands, pushed toward the camera)
        placeWrists(jesus, cam, _a, _b, 0.03);
        rope.position.copy(_a).lerp(_b, 0.5);
        rope.userData.coils.quaternion.setFromUnitVectors(UP, _c3.copy(fa1).add(fa2).normalize());
        rope.userData.end.position.set(0, -0.02, 0); rope.userData.end.rotation.set(0.12 * Math.sin(T * 1.7), 0, 0.15 * Math.sin(T * 1.3 + 1));
        rope.visible = o.view !== 'back';
      } else rope.visible = false;
      // ---- Barabbas
      const bp = Bk.barabbasAt(t, id);
      barabbas.root.position.set(bp[0], 0, bp[2]);
      barabbas.root.visible = !['S13', 'S5'].includes(id);
      const freed = (id === 'S10' && t >= E.shacklesFall) || ['S12', 'S14a'].includes(id);
      if (barabbas.root.visible) {
        const o = orient(barabbas, cam, bp[3], { pref: -1, force: id === 'S12' && t >= E.turnBack ? null : null });
        const soft = id === 'S12' ? smooth(invLerp(E.soften - 0.3, E.soften + 1.6, t)) : id === 'S14a' ? 1 : 0;
        let fn;
        if (bp[4] && (id === 'S4')) fn = (tt) => { const P = Poses.walk(tt, 15, 0.8, 0.75); P.aF = [0.2, 1.02, 0.08]; P.aB = [0.16, 1.12, 0.05]; P.handF = P.handB = 'grip'; expr(P, 'angry', 0.5); return P; };
        else if (bp[4]) fn = (tt) => { const P = Poses.walk(tt, 15, id === 'S10' ? 0.5 : 0.75, 0.8); P.aF = [-0.12, 0.3]; P.aB = [0.1, 0.3]; P.handF = P.handB = 'open'; return P; };
        else if (freed) fn = (tt) => Poses.freed(tt, 15, soft);
        else if (id === 'S10') fn = (tt) => { const P = Poses.shackled(tt, 15, 0.6); P.lookY = -0.5; P.headTilt = -0.12; return P; };
        else fn = (tt) => { const P = Poses.shackled(tt, 15, 1); const jerk = Math.exp(-(((t - E.chainClank) / 0.12) ** 2)); P.aF[0] += 0.35 * jerk; P.aB[0] += 0.2 * jerk; return P; };
        // S12: he stops and turns back toward the hill (paper flip to the side view, then the back), face softening
        if (id === 'S12' && t >= E.turnBack) {
          barabbas.viewAt(t, [[E.turnBack, 'threeQuarter', 1], [E.turnBack + 0.25, 'side', 1]], 3);   // he looks back toward the hill (screen right)
          fn = (tt) => { const P = Poses.freed(tt, 15, soft); P.look = 0.4; P.lookY = 0.12; P.headTilt = 0.06; return P; };
        }
        if (id === 'S14a') { barabbas.setView('threeQuarter'); barabbas.setFacing(-1); fn = (tt) => { const P = Poses.freed(tt, 15, 1); P.lookY = -0.25; P.headTilt = -0.1; expr(P, 'sadness', 0.4); P.mouth = 'none'; return P; }; }
        barabbas.act(fn, s9 ? E.freeze + (t - E.freeze) * 0.3 : T, { wind: 0.5, vx: bp[4] ? 0.6 : 0 });
        barabbas.billboard(cam, 0.3); barabbas.autoOutline(cam);
        // the shackles: on the wrists until they fall in S10, then on the stone
        shackles.group.visible = !['S12', 'S14a'].includes(id) && o.view !== 'back';
        if (id === 'S10' && t >= E.shacklesFall) {
          if (!rel.set) { releaseWrists(); barabbas.act(fn, T, { wind: 0.5, vx: bp[4] ? 0.6 : 0 }); barabbas.billboard(cam, 0.3); }
          shackles.group.visible = true;
          const low = Math.min(rel.a.y, rel.b.y) - 0.3, g0 = 2 * Math.max(0.05, low - 0.02) / (E.shacklesLand - E.shacklesFall) ** 2;   // lands on the clank
          shackles.fall(t - E.shacklesFall, rel.a, rel.b, { groundY: 0.02, g0, toCam: _d.set(cam.position.x - rel.a.x, 0, cam.position.z - rel.a.z).normalize(), dirA: rel.da, dirB: rel.db });
        } else if (shackles.group.visible) {
          const dir = placeWrists(barabbas, cam, _a, _b, 0.04);
          shackles.set(_a, _b, 0.01 * Math.sin(T * 2.3), dir, fa1, fa2);
        }
      } else shackles.group.visible = false;
      // ---- Pilate: seated, uneasy; stands to present them (S7)
      pilate.root.visible = !['S12', 'S13', 'S14a'].includes(id);
      if (id === 'S7') {
        pilate.root.position.set(COURT.seat[0] - 0.25, COURT.seat[1], COURT.seat[2]);
        orient(pilate, cam, -Math.PI / 2, { pref: 1 });
        const k7 = smooth(invLerp(S.S7.t0 + 0.1, S.S7.t0 + 0.7, t));
        pilate.act((tt) => { const P = Poses.present(tt, 26, k7); P.mouth = 'talk'; P.mo = 0.3 + 0.5 * Math.abs(Math.sin(tt * 9)); return P; }, T, { wind: 0.4 });
      } else {
        pilate.root.position.set(COURT.seat[0], COURT.seat[1], COURT.seat[2]);
        orient(pilate, cam, -Math.PI / 2, { pref: 1 });
        pilate.act((tt) => Poses.seatedUneasy(tt, 26, 0.5), s9 ? E.freeze : T, { wind: 0.3 });
      }
      pilate.billboard(cam, 0.25); pilate.autoOutline(cam);
      if (s9) pilate.root.visible = false;
      if (bema.chair) bema.chair.visible = !s9;
      // ---- soldiers
      const sol = (p, x, z, yaw, seed, fn = null) => { p.root.position.set(x, 0, z); p.root.visible = true; orient(p, cam, yaw, { pref: 1 }); p.setProp('spear'); p.act(fn || ((tt) => { const P = Poses.idle(tt, seed); P.aF = [0.32, 0.55, 0.1]; return P; }), s9 ? E.freeze : T, { wind: 0.3 }); p.billboard(cam, 0.3); p.autoOutline(cam); };
      if (id === 'S10' && t < E.barabbasWalks + 1.5) {
        // the guard unlocks the shackles (turns the key), then steps back
        const back = t >= Bk.s10cut ? 1 : smooth(invLerp(E.shacklesLand, E.shacklesLand + 0.9, t));
        guards[1].setProp(null); guards[1].root.position.set(B[0] + 0.04 + 1.16 * back, 0, B[2] + 0.75 - 0.2 * back); guards[1].root.visible = true;
        orient(guards[1], cam, back > 0.5 ? -Math.PI / 2 : Math.PI, { pref: 1 });
        guards[1].act((tt) => { if (back >= 0.5) return Poses.idle(tt, 801); const P = Poses.unlock(tt, 801); P.lean = 0.05; return P; }, T, { wind: 0.3 }); guards[1].billboard(cam, 0.3); guards[1].autoOutline(cam);
      } else sol(guards[1], 4.0, B[2] - 1.65, -Math.PI / 2, 801);
      sol(guards[0], 4.0, J[2] + 1.65, -Math.PI / 2, 802);
      if (id === 'S7b' || id === 'S8') for (const p of guards) p.root.visible = false;
      if (id === 'S10') guards[0].root.visible = false;
      for (const [p, z, i] of [[daisS[0], -2.9, 0], [daisS[1], 2.9, 1]]) { sol(p, 11.3, z, -Math.PI / 2, 810 + i); p.root.position.y = COURT.palace.h; p.root.visible = !s9; }
      line.forEach((p, i) => sol(p, 2.55, [-11.5, -6.6, 6.6, 11.5][i], -Math.PI / 2, 820 + i));
      for (const [i, p] of leaders.entries()) {
        p.root.visible = id === 'S10' && t >= Bk.s10cut;
        if (!p.root.visible) continue;
        const led = t >= E.jesusLed;
        const pt = led ? Bk.jLed(t) : null, J10 = Bk.J10;
        const x = led ? pt[0] + (i ? 0.25 : -0.2) : J10[0] + (i ? 0.45 : 0.6), z = led ? pt[2] + (i ? 1.35 : -1.25) : J10[2] + (i ? 0.85 : -0.75);
        p.root.position.set(x, 0, z); orient(p, cam, led ? Math.PI : -Math.PI / 2, { pref: 1 }); p.setProp('spear');
        p.act(led ? (tt) => { const P = Poses.walk(tt, 830 + i, 0.55, 0.7); P.aF = [0.32, 0.55, 0.1]; return P; } : (tt) => Poses.idle(tt, 830 + i), T, { wind: 0.3 });
        p.billboard(cam, 0.3); p.autoOutline(cam);
      }
      // far figures on the hill path (S12): carrying the beam, slow heavy steps, two soldiers
      if (id === 'S12') {
        const u = clamp((t - S.S12.t0) / (S.S12.t1 - S.S12.t0));
        const along = (d) => { let acc = 0; for (let i = 4; i < path.length - 1; i++) { const a = path[i], b2 = path[i + 1], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]); if (d <= acc + L) { const kk = (d - acc) / L; return [lerp(a[0], b2[0], kk), lerp(a[1], b2[1], kk), Math.atan2(b2[0] - a[0], b2[1] - a[1])]; } acc += L; } const z = path[path.length - 1]; return [z[0], z[1], 0]; };
        const d0 = 2 + 3.2 * u;
        [[jesusFar, d0, 34], [farS[0], d0 + 2.2, 841], [farS[1], d0 - 2.3, 842]].forEach(([p, d, sd], i) => {
          const [x, z, hd] = along(Math.max(0, d)); p.root.position.set(x, H(x, z), z); orient(p, cam, hd, { pref: 1 });
          if (i === 0) p.act((tt) => Poses.carryBeam(tt, 34), T, { wind: 0.4 }); else { p.setProp('spear'); p.act((tt) => { const P = Poses.walk(tt, sd, 0.45, 0.6); P.aF = [0.32, 0.55, 0.1]; return P; }, T, { wind: 0.3 }); }
          p.billboard(cam, 0.2); p.autoOutline(cam, 1920, 2.2);
        });
        beam.position.set(0.02, 0.48, 0.05); beam.rotation.set(0, 0, 0.18);
      }
      // ---- priests: in the front rows; in S7b they lean and whisper
      priests.forEach((p, i) => {
        p.root.visible = true;
        orient(p, cam, Math.atan2(COURT.seat[0] - priestSpots[i][0], COURT.seat[2] - priestSpots[i][1]), { pref: i % 2 ? 1 : -1 });
        const wk = id === 'S7b' ? smooth(invLerp(E.whisper + i * 0.45, E.whisper + i * 0.45 + 0.4, t)) * (1 - smooth(invLerp(E.whisper + i * 0.45 + 1.8, E.whisper + i * 0.45 + 2.2, t))) : 0;
        p.act((tt) => (wk > 0.01 ? Poses.whisper(tt, 700 + i, wk) : Poses.chant(tt, 700 + i, Math.min(k, 0.35))), s9 ? E.freeze : T, { wind: 0.4 });
        p.billboard(cam, 0.3); p.autoOutline(cam);
      });
      // ---- hero crowd rigs
      heroCrowd.forEach((h) => {
        h.p.root.visible = true;
        orient(h.p, cam, Math.atan2(COURT.seat[0] - h.x, COURT.seat[2] - h.z) + (hash01(h.i, 4) - 0.5) * 0.5, { pref: h.i % 2 ? 1 : -1 });
        const near = id === 'S7b' && (h.i === 2 || h.i === 4) && (t - E.whisper) > 0.6 + h.i * 0.2;
        h.p.act((tt) => (near ? Poses.whisper(tt, h.seed, 0.7) : Poses.chant(tt, h.seed, k * (0.85 + 0.3 * hash01(h.i, 9)))), s9 ? E.freeze : T, { wind: 0.4 });
        h.p.billboard(cam, 0.3); h.p.autoOutline(cam);
      });
      // ---- the card crowd: pose frame from the crowd energy (pumping fists), bob
      crowd.set(T, (i, P, tt) => {
        const ph = P.seed * TAU, f = 1.4 + 0.8 * P.seed;
        const pump = 0.5 + 0.5 * Math.sin(TAU * tt * f + ph);
        const kk = clamp(k * (0.75 + 0.5 * hash01(i, 3)));
        let pose = kk < 0.15 ? 0 : kk < 0.55 ? (pump > 0.5 ? 1 : 0) + (kk > 0.4 && pump > 0.75 ? 1 : 0) : kk < 0.85 ? (pump > 0.45 ? 2 : 1) : (pump > 0.4 ? 3 : 2);
        return { pose, y: kk > 0.5 ? 0.035 * kk * Math.max(0, Math.sin(TAU * tt * f * 2 + ph)) : 0 };
      });
      city.set(T, (i, P, tt) => ({ pose: (hash01(i, 5) < 0.3 && Math.sin(tt * 2 + i) > 0.6) ? 1 : 0, y: P.y }));
      // ---- fx
      braziers.forEach((b) => b.set(T, cam, s9 ? 0.15 : 1));
      g.getWorldPosition(_o);
      const moteK = isS1(id) || id === 'S2' ? 2.2 : id === 'S8' ? 2.4 : id === 'S5' ? 1.2 : 0.5;
      motes.set(s9 ? E.freeze : T, [_o.x + J[0] - 0.5, _o.y + 0.25, _o.z + J[2] - 0.5], [7, 3.2, 6], moteK, [1.0, 0.86, 0.6], 0.05);
      // a strong gold rim on the backlit figures (dawn shots)
      U.uRimPx.value = isS1(id) || id === 'S2' || id === 'S8' || id === 'S7' ? 6 : 2.6; U.uRimK.value = isS1(id) || id === 'S2' || id === 'S8' ? 2.4 : 1;
      // crowd dust: kicked up by the chanting feet, bursts on the shout (frozen in S9)
      dust.begin();
      const dk = isS1(id) || id === 'S2' ? 0.5 : id === 'S8' || s9 ? 0.4 + 0.9 * smooth(invLerp(E.shout - 0.1, E.shout + 0.4, Math.min(t, E.freeze))) : 0.18;
      const DT = s9 ? E.freeze : T;
      for (let i = 0; i < 70; i++) {
        const life = 3.2 + 1.4 * hash01(i, 61), uu = ((DT + hash01(i, 62) * life) % life) / life;
        const x = -1.2 - 9 * hash01(i, 63) + 1.2 * uu, z = (hash01(i, 64) - 0.5) * 30 + 1.5 * noise2(uu * 2, i, 3);
        dust.add(_o.x + x, _o.y + 0.25 + uu * 2.2, _o.z + z, 1.3 + uu * 3.2, 0.86, 0.72, 0.52, 0.16 * dk * Math.sin(Math.PI * uu), i);
      }
      dust.end();
      smoke.set(T, [_o.x + temple.altarTop[0], _o.y + temple.altarTop[1], _o.z + temple.altarTop[2]], { k: id === 'S3' ? 1 : 0.6, wind: [2.2, 0, 1.4], rise: 3.4 });
      birds.group.visible = id === 'S3';
      if (id === 'S3') birds.set(T, (i, tt) => { const a = tt * 0.32 + i * 0.45, r = 22 + 6 * hash01(i, 2); return [_o.x - 6 + Math.cos(a) * r, _o.y + 17 + 3 * Math.sin(tt * 0.8 + i) + 2 * hash01(i, 3), _o.z + 32 + Math.sin(a) * r * 0.6, -a]; }, 1.0, 10);
      // ---- spotlights in the freeze (S9): the world dark, Barabbas lit; the gold falls on Jesus at "...the father"
      if (s9) {
        const dk2 = smooth(invLerp(E.freeze, E.freeze + 0.7, t));
        const gold = smooth(invLerp(E.goldName - 0.3, E.goldName + 0.9, t));
        for (const p of all) p.uni.uTint.value.setScalar(lerp(1, 0.07, dk2));
        for (const h of heroCrowd) h.p.uni.uTint.value.setScalar(lerp(1, 0.07, dk2));
        barabbas.uni.uTint.value.setRGB(lerp(1, 1.35, dk2), lerp(1, 1.35, dk2), lerp(1, 1.45, dk2));
        jesus.uni.uTint.value.setRGB(lerp(lerp(1, 0.22, dk2), 1.5, gold), lerp(lerp(1, 0.22, dk2), 1.22, gold), lerp(lerp(1, 0.24, dk2), 0.78, gold));
        crowd.uni.uFogK.value = 1;
        crowd.mesh.material.color.setScalar(lerp(1, 0.08, dk2));
      } else crowd.mesh.material.color.setScalar(1);
      // S4: Barabbas walks in the hard shadow of the gate tower; Jesus in the warm light
      barabbas.uni.uLit.value = id === 'S4' ? 0.08 : 1;
      if (id === 'S4') barabbas.uni.uTint.value.setScalar(0.8);
    },

    mood(t, shot) {
      const id = shot.id;
      // the low sun in the south (behind the crowd as seen from the seat): gold rim + cool shadows
      const SUN = [-0.95, 0.28, -0.07];
      const dawn = merge(MOODS.morningGold, {
        sky: { top: '#7f9cc0', horizon: '#f2c88e', bottom: '#c7a67a', band: '#3a2412', sunGlow: '#ffbf6e', sunDisk: '#fff2d2', clouds: 0.35, cloudLit: '#ffe2b8', cloudShade: '#b9a6a0', cloudAlt: 95 },
        sunDir: SUN, sun: { color: '#ffcf8c', intensity: 2.7 },
        hemi: { sky: '#a8badb', ground: '#b08c60', intensity: 0.72 },
        fog: { color: '#e9c79a', near: 90, far: 900, density: 0.0028, height: 8, sun: 0.45 },
        char: '#fff1de', ao: 0.2, wind: 1.1,
        post: { exposure: 0.9, bloom: 0.8, bloomThreshold: 0.86, haze: 0.06, hazeColor: '#f0d2a0', vignette: 0.45, grain: 0.026, sat: 1.08, contrast: 1.1,
          split: 0.22, splitShadow: '#5b6a92', splitHigh: '#ffcf7a', ao: 0.55, aoRadius: 0.5, tilt: 0, tonemap: 'agx', agxLook: 0.55,
          godrays: { pos: [J[0] - 380, 160, J[2] + 80], color: '#ffd9a0', strength: 0.55, radius: 0.16, decay: 0.968, density: 0.92, streaks: 0.65 } },
      });
      if (id === 'S1' || id === 'LOOP') return merge(dawn, { hemi: { intensity: 0.95 }, char: '#fff4e4', fog: { density: 0.001, color: '#d2a878' },
        point: { pos: [J[0] + 1.6, 2.0, J[2] - 0.9], color: '#ffd8a8', intensity: 3, distance: 6, charColor: '#ffdcb0', charK: 0.55, charRange: 4.5 },
        sky: { horizon: '#d9ad7c', sunGlow: '#e8a65c' },
        post: { exposure: 0.98, bloom: 0.5, bloomThreshold: 0.92, haze: 0.0, dof: 0.55, focusRange: 1.0, vignette: 0.42, contrast: 1.16, godrays: { strength: 0.35 } } });
      if (id === 'S2') return merge(dawn, { char: '#f2e2cc', post: { dof: 0.75, focusRange: 0.8, vignette: 0.58, sat: 0.98, contrast: 1.14, godrays: { strength: 0.5 } } });
      if (id === 'S3') return merge(dawn, {
        sky: { top: '#86a8cc', horizon: '#f0dcb8', clouds: 0.5 }, sunDir: [-0.7, 0.62, 0.36], sun: { color: '#ffe6c2', intensity: 2.6 }, hemi: { intensity: 0.85 },
        fog: { color: '#e6d3b0', density: 0.0028, height: 14, near: 120, far: 900 },
        post: { exposure: 0.94, tilt: 0.45, tiltTop: 0.72, tiltBottom: 0.18, haze: 0.08, hazeTop: 0.6, hazeColor: '#eedcb8', bloom: 0.45, contrast: 1.16, sat: 1.12, godrays: { strength: 0 }, split: 0.15 },
      });
      if (id === 'S4') return merge(dawn, {
        sky: { top: '#8ea6c6', horizon: '#e9d6be' }, sun: { color: '#ffe0b4', intensity: 2.5 }, hemi: { sky: '#9db4d8', ground: '#a08a6e', intensity: 0.8 }, char: '#f4ece2',
        post: { exposure: 0.95, sat: 0.92, split: 0.32, splitShadow: '#4d6a98', splitHigh: '#ffe0b0', dof: 0.4, focusRange: 3, godrays: { strength: 0 }, vignette: 0.5 },
      });
      if (id === 'S5') return merge(dawn, { char: '#fff4e6', post: { exposure: 1.0, bloom: 0.95, haze: 0.2, dof: 0.9, focusRange: 1.4, vignette: 0.4 } });
      if (id === 'S7') return merge(dawn, { post: { dof: 0.45, focusRange: 2.5, vignette: 0.5, sat: 0.95, godrays: { strength: 0.45 } } });
      if (id === 'S7b') return merge(dawn, { sun: { intensity: 2.3 }, char: '#efe2d0', post: { dof: 0.8, focusRange: 1.0, sat: 0.88, contrast: 1.08, vignette: 0.55, godrays: { strength: 0.3 } } });
      if (id === 'S8') {
        const sh = smooth(invLerp(E.shout - 0.08, E.shout + 0.25, t));
        return merge(dawn, { sun: { intensity: 3.0 }, fog: { density: 0.01 + 0.012 * sh, color: '#e2b680' }, char: '#fff0dc',
          post: { exposure: 0.95, contrast: 1.12 + 0.06 * sh, sat: 1.0, flash: 0.25 * Math.exp(-6 * Math.max(0, t - E.shout)) * sh, dof: 0.55, focusRange: 2.2, vignette: 0.55, haze: 0.16 + 0.1 * sh,
            godrays: { strength: 0.6 + 0.25 * sh } } });
      }
      if (id === 'S9') {
        const dk = smooth(invLerp(E.freeze, E.freeze + 0.7, t)), gold = smooth(invLerp(E.goldName - 0.3, E.goldName + 0.9, t));
        const A = resolve(merge(dawn, { post: { dof: 0.4, focusRange: 3 } }));
        const D = resolve(merge(MOODS.mathDark, {
          sky: { top: '#050404', horizon: '#0d0a08', bottom: '#050404', stars: 0 }, sunDir: SUN, sun: { color: '#ffd8a0', intensity: 0.05 }, hemi: { sky: '#2a2420', ground: '#0a0806', intensity: 0.12 },
          fog: { color: '#060505', near: 6, far: 60, density: 0.03, height: 6 }, char: '#d8d2e2',
          spot: { pos: [B[0] + 1.2, 9, B[2] - 0.3], target: [B[0], 0, B[2]], color: '#e8eeff', intensity: 70, angle: 0.2, penumbra: 0.55, decay: 2, distance: 22, shadow: true },
          point: { pos: [J[0] + 0.3, 2.6, J[2] + 0.2], color: '#ffc46a', intensity: 6 * gold, distance: 6, charColor: '#ffcf8a', charK: 0.0, charRange: 2 },
          post: { exposure: 1.05, bloom: 0.9, bloomThreshold: 0.8, sat: 0.45, contrast: 1.12, vignette: 0.75, grain: 0.035, dof: 0.35, focusRange: 3, godrays: { strength: 0 }, tilt: 0, ao: 0.5, tonemap: 'agx' },
        }));
        return blend(A, D, dk);
      }
      if (id === 'S10') {
        const st = smooth(invLerp(E.jesusLed - 1.5, E.jesusLed + 3.5, t));
        return merge(dawn, {
          sky: { storm: 0.85 * st, stormDark: '#3a3a42', stormLit: '#8a8078', stormAlt: 85, clouds: 0.35 * (1 - st), horizon: '#e8c79a' },
          sun: { intensity: 2.6 }, char: '#fff0dc',
          fog: { color: st > 0.5 ? '#bfae98' : '#e9c79a', density: 0.0025 + 0.0015 * st },
          post: { dof: 0.45, focusRange: 3.0, vignette: 0.5, haze: 0.02, contrast: 1.14, godrays: { strength: 0.2 }, split: 0.28, splitShadow: '#4a5670' },
        });
      }
      if (id === 'S12') {
        const ages = [t - E.thunder1, t - E.thunder2].filter((a) => a > 0);
        // the depth of field is |z - focus| in metres, so the in-focus band grows with the rack (0.6 m on his face,
        // ~120 m on the far hill: the city wall, the path and the tiny figures all come sharp)
        const rk = smooth(invLerp(E.rackFocus - 0.2, E.rackFocus + 1.1, t));
        const age = ages.length ? Math.min(...ages) : null;
        return merge(dawn, {
          sky: { storm: 0.9, stormDark: '#2e2f38', stormLit: '#6a6670', stormAlt: 80, clouds: 0, top: '#5a6274', horizon: '#c9b393', crack: age != null ? { age, pos: [COURT.hill[0] + 30, 120, COURT.hill[2] - 150], size: 220, hold: false, hole: 0, glowK: 0.6 } : null },
          sun: { intensity: 2.5 }, hemi: { sky: '#8c96ac', intensity: 0.7 }, char: '#ffeedd',
          fog: { color: '#a89f94', density: 0.0009, height: 18, near: 60, far: 800 },
          post: { dof: 1.2, focusRange: 0.6 * Math.pow(200, rk), vignette: 0.55, haze: 0.015, contrast: 1.14, godrays: { strength: 0 }, sat: 0.92, split: 0.3, splitShadow: '#3e4a66', splitHigh: '#ffd6a0' },
        });
      }
      if (id === 'S13') {
        const lb = smooth(invLerp(E.lightBreaks - 0.4, E.lightBreaks + 2.6, t));
        const hp = [COURT.hill[0] - 3, COURT.hillTop + 30, COURT.hill[2] - 30];   // between the card and the cross
        return merge(MOODS.storm, {
          sky: { storm: 1, stormDark: '#2a2b33', stormLit: '#77706a', top: '#3a3f4c', horizon: '#8d8378', crack: { age: lb > 0 ? 0.5 + lb * 3 : -1, pos: hp, size: 120, hold: true, color: '#000000', hole: 1.2 * lb, glowColor: '#ffd9a0', glowK: 1.3 * lb, cloudK: 0.9 } },
          sunDir: [-0.2, 0.55, -0.8], sun: { color: '#ffd8a8', intensity: 0.8 + 1.6 * lb }, hemi: { sky: '#7d8496', ground: '#3a352c', intensity: 0.65 + 0.3 * lb },
          fog: { color: '#6e6a66', density: 0.0045, height: 20, near: 40, far: 700 }, char: '#d8d0c4', wind: 1.6,
          post: { exposure: 0.84 + 0.1 * lb, bloom: 0.55 + 0.3 * lb, contrast: 1.18, haze: 0.02, sat: 0.78 + 0.3 * lb, vignette: 0.62, tilt: 0.2, dof: 0, split: 0.35, splitShadow: '#2c3a54', splitHigh: '#ffcf8a',
            godrays: { pos: hp, color: '#ffdca8', strength: 0.95 * lb, radius: 0.2, decay: 0.97, density: 0.95, streaks: 0.85 } },
        });
      }
      if (id === 'S14a') return merge(dawn, { sky: { storm: 0.6, stormDark: '#3a3a42', stormLit: '#a08a78' }, char: '#fff2e0', post: { dof: 1.0, focusRange: 0.5, vignette: 0.55, bloom: 0.9, godrays: { strength: 0.3 } } });
      return dawn;
    },
  };
}
