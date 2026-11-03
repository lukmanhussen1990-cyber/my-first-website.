// Shower burrito reel: scene, cast, 71 shots, per-frame mosaic box + mask check.
import { THREE, PI, clamp, lerp, ease, easeOut, easeIn, V, RNG, M, mesh, box, cyl, ico, canvasTex, P, Mannequin } from './toon.js';
import { LR, HW, BA, buildHouse, waterWaves, buildLiving, buildHall, buildBath } from './sets.js';
import { Curtain, TapeStrips, Spray, Steam, Burst, Burrito, makePlate, makeFork, makeNoodle, makeTapeRoll, makeHearts } from './props.js';

const SC = parseFloat(new URLSearchParams(location.search).get('s') || '1');
const W0 = Math.round(1080 * SC), H0 = Math.round(1920 * SC);
const canvas = document.getElementById('c'); canvas.width = W0; canvas.height = H0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W0, H0, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.04, 220);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);
const osc = (T, f, a = 1, ph = 0) => a * Math.sin(T * PI * 2 * f + ph);

// ---------------------------------------------------------------- lights + sets
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.2); sun.castShadow = true;
const SM = SC < 1 ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xeaf2ff, 0.55); scene.add(fill, fill.target);
const SET = { house: buildHouse(scene), living: buildLiving(scene), hall: buildHall(scene), bath: buildBath(scene) };
const BS = SET.bath, LS = SET.living, HS = SET.hall, XS = SET.house;
const skyTex = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#79c2f2'); g.addColorStop(0.55, '#bfe4f8'); g.addColorStop(1, '#fde9d6'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const LIGHT = {
  house: { c: V(0, 0, -1), dir: V(0.55, 1, 0.75), R: 15, sky: 0xdcefff, gnd: 0xf0dcc4, hi: 1.25, si: 2.8, bg: skyTex },
  living: { c: V(LR.x, 0, -0.6), dir: V(-0.45, 1, 0.85), R: 6.5, sky: 0xfff7f0, gnd: 0xeadfd2, hi: 1.45, si: 2.1, bg: new THREE.Color(0xf5efe6) },
  hall: { c: V(HW.x, 0, 0), dir: V(0.3, 1, 0.45), R: 7.5, sky: 0xfff6ec, gnd: 0xe9dccc, hi: 1.5, si: 1.7, bg: new THREE.Color(0xf5efe6) },
  bath: { c: V(BA.x + 0.3, 0, 0.0), dir: V(0.3, 1, 0.75), R: 4.2, sky: 0xf2fbff, gnd: 0xe3eef3, hi: 1.55, si: 1.9, bg: new THREE.Color(0xeef6f8) },
};
function useSet(name) {
  for (const k in SET) SET[k].group.visible = k === name;
  const L = LIGHT[name];
  hemi.color.setHex(L.sky); hemi.groundColor.setHex(L.gnd); hemi.intensity = L.hi;
  sun.intensity = L.si; sun.position.copy(L.c).addScaledVector(L.dir.clone().normalize(), 20); sun.target.position.copy(L.c);
  const sc = sun.shadow.camera; sc.left = -L.R; sc.right = L.R; sc.top = L.R; sc.bottom = -L.R; sc.near = 1; sc.far = 45; sc.updateProjectionMatrix();
  fill.position.copy(L.c).add(V(-6, 3, 8)); fill.target.position.copy(L.c);
  scene.background = L.bg;
}
const ORIG = { house: V(0, 0, 0), living: LR, hall: HW, bath: BA };
const B = (x, y, z) => V(BA.x + x, y, BA.z + z);
const Lr = (x, y, z) => V(LR.x + x, y, LR.z + z);
const Hw = (x, y, z) => V(HW.x + x, y, HW.z + z);

// ---------------------------------------------------------------- cast
const flowerTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#fff4f0'; x.fillRect(0, 0, w, h); const r = RNG(9);
  for (let i = 0; i < 46; i++) {
    const cx = r() * w, cy = r() * h, col = ['#ff7f9e', '#ffab5e', '#b98ae8', '#6fbde6'][i % 4];
    x.fillStyle = '#7cc48a'; x.beginPath(); x.ellipse(cx + 9, cy + 6, 7, 3, 0.6, 0, PI * 2); x.fill();
    x.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 0, PI * 2); x.fill(); }
    x.fillStyle = '#ffe14f'; x.beginPath(); x.arc(cx, cy, 4, 0, PI * 2); x.fill();
  }
}, false, [2, 2]);
const YOU = new Mannequin({ skin: P.skin, legs: 'bare', sleeves: 'none', shoes: P.skin, hair: 0x2b1a10, hairStyle: 'wet', wet: true });
const YOUD = new Mannequin({ skin: P.skin, top: P.baby, bottom: P.coral, legs: 'shorts', sleeves: 'short', shoes: 0xffffff, hair: 0x2b1a10, hairStyle: 'short' });
const YOUH = new Mannequin({ skin: P.skin, legs: 'bare', sleeves: 'none', shoes: P.skin, hair: 0x2b1a10, hairStyle: 'wet', wet: true });
const CRUSH = new Mannequin({ skin: P.skin4, dress: P.butter, top: P.butter, sleeves: 'none', straps: true, legs: 'bare', shoes: P.coral, hair: 0x7a3f1d, hairStyle: 'ponytail', scale: 0.95 });
const MOM = new Mannequin({ skin: P.skin2, dress: 0xffffff, top: 0xffffff, dressMap: flowerTex, sleeves: 'short', legs: 'bare', shoes: P.lavender, hair: 0x3a2214, hairStyle: 'bun', scale: 0.97 });
const DAD = new Mannequin({ skin: P.skin, top: P.teal, collar: true, sleeves: 'short', bottom: 0xd9c7a0, legs: 'shorts', shoes: 0x8a6a4a, hair: 0x9a9a9a, hairStyle: 'balding', glasses: true, scale: 1.02 });
const G1 = new Mannequin({ skin: P.skin3, top: P.butter, sleeves: 'short', bottom: P.teal, legs: 'shorts', shoes: 0xffffff, hair: 0x1a1a1a, hairStyle: 'curly' });
const G2 = new Mannequin({ skin: P.skin, top: P.pink, sleeves: 'none', straps: true, bottom: P.pink, legs: 'bare', shoes: P.mint, hair: 0xd9a86a, hairStyle: 'bob', scale: 0.95 });
const G3 = new Mannequin({ skin: P.skin2, top: P.mint, sleeves: 'short', bottom: P.lavender, legs: 'shorts', shoes: 0xffffff, hair: 0x2a1a10, hairStyle: 'short' });
const PEOPLE = [YOU, YOUD, CRUSH, MOM, DAD, G1, G2, G3];
for (const m of PEOPLE) scene.add(m.group);
for (const m of [...PEOPLE, YOUH]) m.arms.forEach(a => { a.home = { tp: a.thumb.position.clone(), tr: a.thumb.rotation.clone(), ts: a.thumb.scale.clone(), fp: a.fingers.position.clone(), fs: a.fingers.scale.clone() }; });

// ---------------------------------------------------------------- props
const CUR = new Curtain(BS); CUR.viewer = camera.position;
const TAPE = new TapeStrips(BS, CUR);
const SPRAY = new Spray(BS.group);
const STEAM = new Steam(BS.group);
const BUR = new Burrito(scene, YOUH);
const HEARTS = makeHearts(BS.group, 8);
const ROLL = makeTapeRoll(scene);
const PLATE = makePlate(scene);
const FORK = makeFork(scene);
const NOODLES = [makeNoodle(scene, P.coral), makeNoodle(scene, P.mint), makeNoodle(scene, P.butter)];
NOODLES.forEach(n => { n.rotation.set(0, 0, 0); });
const SPLASH = new Burst(scene, 120, new THREE.IcosahedronGeometry(0.035, 0), M(0xe9f8ff, { std: true, r: 0.1, opacity: 0.85 }));
const DROPS = new Burst(scene, 60, new THREE.IcosahedronGeometry(0.014, 0), M(0xd2f0ff, { std: true, r: 0.1, opacity: 0.85, emissive: 0x9fd8f0, ei: 0.3 }));
const MEATBALL_FALL = { on: false };

// ---------------------------------------------------------------- helpers
let WT = [];
const w = i => WT[i].s, we = i => WT[i].e;
let ANCH = {}, F = {};
function put(m, set, x, y, z, ry = 0) {
  m.group.visible = true; m.reset();
  m.arms.forEach(a => { a.thumb.position.copy(a.home.tp); a.thumb.rotation.copy(a.home.tr); a.thumb.scale.copy(a.home.ts); a.fingers.position.copy(a.home.fp); a.fingers.scale.copy(a.home.fs); });
  if (m.skirt) m.skirt.position.set(0, 0.1, 0);
  m.group.position.copy(ORIG[set]).add(V(x, y, z)); m.group.rotation.set(0, ry, 0);
  return m;
}
function sit(m, seat) {
  const s = m.cfg.scale; m.hips.position.y = seat / s + 0.07;
  m.leg('L', 1.35, 0.06, 1.35); m.leg('R', 1.35, 0.06, 1.35);
  if (m.skirt) { m.skirt.rotation.x = -1.2; m.skirt.scale.set(1.02, 0.86, 0.62); m.skirt.position.z = 0.03; }
}
const lap = m => { m.arm('L', 0.3, 0.12, 0, 0.9); m.arm('R', 0.3, 0.12, 0, 0.9); };
function thumbsUp(m, side) {
  const a = side === 'L' ? m.armL : m.armR;
  a.fingers.position.y = -0.075; a.fingers.scale.set(1, 0.75, 1.25);
  a.thumb.position.set(-0.03 * a.s, -0.05, 0.045); a.thumb.rotation.set(PI / 2, 0, 0); a.thumb.scale.set(1.25, 1.35, 1.25);
}
function headLook(m, target, k = 1, lim = 1.3) { // turn the head toward a world point
  m.group.updateMatrixWorld(true);
  const hp = m.worldOf(m.head, V(0, 0.13, 0));
  const inv = new THREE.Matrix4().copy(m.spine.matrixWorld).invert();
  const loc = target.clone().applyMatrix4(inv).sub(hp.clone().applyMatrix4(inv));
  const yaw = clamp(Math.atan2(loc.x, loc.z), -lim, lim), pitch = clamp(-Math.atan2(loc.y, Math.hypot(loc.x, loc.z)), -0.7, 0.7);
  m.head.rotation.set(pitch * k, yaw * k, 0, 'YXZ');
}
function cam(p, t, fov = 45, up = null, roll = 0) {
  camera.position.copy(p); camera.up.copy(up || V(0, 1, 0)); camera.lookAt(t);
  if (roll) camera.rotateZ(roll);
  camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
function handPt(m, side, off = V(0, -0.07, 0)) { const a = side === 'L' ? m.armL : m.armR; return m.worldOf(a.hand, off); }
const faceOf = m => m.worldOf(m.head, V(0, 0.13, 0.11));
function ikArm(m, side, target, init = [0.3, 0.5, 0, 1.0]) {
  const a = side === 'L' ? m.armL : m.armR, p = init.slice();
  const lo = [-1.0, -0.3, -1.7, 0], hi = [2.8, 2.8, 1.7, 2.7];
  const err = () => { m.arm(side, p[0], p[1], p[2], p[3]); a.hand.updateWorldMatrix(true, false); return a.hand.localToWorld(V(0, -0.08, 0)).distanceTo(target); };
  let best = err(), step = 0.4;
  for (let it = 0; it < 80 && step > 0.004; it++) {
    let imp = false;
    for (let k = 0; k < 4; k++) for (const dir of [1, -1]) {
      const old = p[k]; p[k] = clamp(old + dir * step, lo[k], hi[k]);
      const e = err(); if (e < best - 1e-6) { best = e; imp = true; } else p[k] = old;
    }
    if (!imp) step *= 0.5;
  }
  m.arm(side, p[0], p[1], p[2], p[3]); return best;
}
const headPt = (m, x, y, z) => m.worldOf(m.head, V(x, 0.13 + y, z));

// stable world setup that every frame starts from
function resetWorld() {
  for (const m of PEOPLE) m.group.visible = false;
  BUR.outer.visible = false; ROLL.visible = false; PLATE.g.visible = false; FORK.g.visible = false;
  PLATE.shards.forEach(s => s.visible = false); NOODLES.forEach(n => n.visible = false); HEARTS.forEach(h => h.visible = false);
  SPLASH.update([]); DROPS.update([]);
  ANCH = {};
  F = { spray: 0, sprayDir: V(0, -1, 0.5), reach: 0.26, steam: 0, tape: 0, rip: 1e9, curtain: true, drops: false };
  CUR.st = CUR.defaults(); CUR.mesh.visible = true; CUR.rings.forEach(r => r.visible = true);
  BS.backWall.visible = BS.leftWall.visible = BS.rightWall.visible = BS.alcoveWall.visible = BS.ceiling.visible = BS.front.visible = true;
  BS.shelf.visible = BS.pipe.visible = BS.railL.visible = BS.railR.visible = true; BS.head.rotation.set(0.7, 0, 0);
  BS.pipe.children.forEach(c => c.visible = true);
  LS.ceiling.visible = true; LS.puddle.visible = false; HS.ceiling.visible = true;
  HS.photos.forEach(p => { p.g.rotation.z = 0; p.g.position.y = p.y0 ?? (p.y0 = p.g.position.y); });
  PLATE.snacks.forEach(s => s.position.copy(s.userData.home)); PLATE.plate.rotation.set(0, 0, 0);
  FORK.food.position.set(0, 0.085, 0.005); FORK.food.visible = true;
}
function bathBase(T, o = {}) {
  useSet('bath');
  if (o.cutBack) { BS.backWall.visible = false; BS.shelf.visible = false; BS.pipe.children.forEach(c => { if (c !== BS.head && c !== BS.pipeArm) c.visible = false; }); }
  if (o.cutLeft) BS.leftWall.visible = false;
  if (o.cutTop) { BS.ceiling.visible = false; BS.pipe.visible = false; }
  if (o.cutFront) BS.front.visible = false;
  CUR.st.open = o.open ?? 0;
  F.spray = o.spray ?? 0; F.steam = o.steam ?? 0;
  if (o.sprayDir) F.sprayDir = o.sprayDir; if (o.reach) F.reach = o.reach;
}
// YOU in the shower (bath-local), default facing the shower head (-z)
const YX = 0.0, YZ = -0.56;
function you(x = YX, z = YZ, ry = PI, y = 0.1) { return put(YOU, 'bath', x, y, z, ry); }
function hugAt(h, r = 0.31, top = 1.72) { Object.assign(CUR.st, { hug: h, hx: YOU.group.position.x - BA.x, hz: YOU.group.position.z - BA.z, hr: r, htop: top }); }
function clingAt(c, T, rub = 0) {
  const px = YOU.group.position.x - BA.x, pz = YOU.group.position.z - BA.z;
  Object.assign(CUR.st, { cling: c, cx: px + rub * 0.14 * Math.sin(T * PI * 2 * 1.9), cy: 1.0, cz: pz + 0.085 + rub * 0.03 * Math.sin(T * PI * 2 * 3.8), crx: 0.34, cry: 0.5 });
}
// family on the sofa / chairs (living-room local)
const SEATS = [[G1, -2.15, 0.49, -2.15], [G2, -1.3, 0.49, -2.15], [MOM, -0.45, 0.53, -2.22], [CRUSH, 0.35, 0.53, -2.22], [DAD, 1.15, 0.53, -2.22], [G3, 2.05, 0.49, -2.15]];
function family(T, face = { eyes: 'blank', mouth: 'flat' }, look = null, opt = {}) {
  useSet('living');
  for (const [m, x, h, z] of SEATS) {
    put(m, 'living', x, 0, z, 0); sit(m, h); lap(m);
    m.setFace(typeof face === 'function' ? face(m) : face);
    if (look) headLook(m, look, 1, 0.9);
  }
  // mom holds a plate of snacks, dad a fork with food
  MOM.arm('L', 0.42, 0.22, 0, 1.05); MOM.arm('R', 0.42, 0.22, 0, 1.05);
  DAD.arm('R', 0.95, 0.12, 0, 2.15);
  if (!opt.noPlate) {
    const a = handPt(MOM, 'L'), b = handPt(MOM, 'R');
    PLATE.g.visible = true; PLATE.g.position.copy(a).add(b).multiplyScalar(0.5).add(V(0, 0.03, 0.03)); PLATE.g.rotation.set(0, 0, 0);
  }
  placeFork();
}
function placeFork() {
  const h = handPt(DAD, 'R', V(0, -0.09, 0.03));
  FORK.g.visible = true; FORK.g.position.copy(h);
  const mouth = DAD.worldOf(DAD.head, V(0, 0.06, 0.13));
  FORK.g.quaternion.setFromUnitVectors(V(0, 1, 0), mouth.clone().sub(h).normalize());
}
function noodle(n, m, target) { // pool noodle held like a rifle, aimed at the target
  const a = handPt(m, 'L'), b = handPt(m, 'R'); const c = a.add(b).multiplyScalar(0.5);
  const d = target.clone().sub(c).normalize();
  n.visible = true; n.position.copy(c).addScaledVector(d, 0.45); n.quaternion.setFromUnitVectors(V(0, 1, 0), d);
}
function houseCommon(T, pool = true) {
  useSet('house');
  waterWaves(XS, T);
  XS.balloons.forEach((b, i) => { b.rotation.z = 0.12 * Math.sin(T * 1.6 + i * 1.7); b.rotation.x = 0.08 * Math.sin(T * 1.3 + i); });
  XS.ball.position.set(-1.0 + 0.3 * Math.sin(T * 0.7), 0.06 + 0.04 * Math.sin(T * 3), 2.6 + 0.2 * Math.cos(T * 0.6)); XS.ball.rotation.set(T * 0.8, T * 0.5, 0);
  XS.donut.position.y = -0.1 + 0.02 * Math.sin(T * 2.4); XS.donut.rotation.z = T * 0.2;
  if (pool) { poolGuy(G1, -1.9, 2.1, 0.5, T, 0); poolGuy(G2, 0.7, 3.2, -2.5, T, 1.3); }
}
function poolGuy(m, x, z, ry, T, ph) {
  put(m, 'house', x, -1.06 + 0.03 * Math.sin(T * 2.2 + ph), z, ry);
  const k = Math.sin(T * 8 + ph);
  m.arm('L', 1.0 + 0.6 * k, 0.6, 0, 0.3); m.arm('R', 1.0 - 0.6 * k, 0.6, 0, 0.3);
  m.setFace({ eyes: 'happy', mouth: 'grin', brows: 'up' });
}
function burSet(o) { BUR.set(Object.assign({ T: 0 }, o)); BUR.outer.updateMatrixWorld(true); }
const burPt = (x, y, z) => BUR.body.localToWorld(V(x, y, z));
const burFace = () => YOUH.worldOf(YOUH.head, V(0, 0.13, 0.12));
function burInTub(T, o = {}) {
  bathBase(T, o); CUR.mesh.visible = false; CUR.rings.forEach(r => r.visible = false); BS.railL.visible = BS.railR.visible = false;
  burSet(Object.assign({ pos: B(-0.03, 0.36, -0.66), yaw: 0, tilt: 0.06, T }, o.bur || {}));
}
function livingBurrito(T, o = {}) { // him lying on the floor in front of the sofa, head towards the sofa
  burSet(Object.assign({ pos: Lr(0.35, 0.245, -0.42), yaw: PI / 2, tilt: 0, roll: 0, T }, o));
  LS.puddle.visible = true; LS.puddle.position.set(0.35, 0.012, -0.5); LS.puddle.scale.set(0.95, 1.5, 1);
}

// ---------------------------------------------------------------- shots
const SH = {};
// 01-03 house + pool party
SH['01'] = (t, d, T, u) => { houseCommon(T); cam(V(lerp(5.2, 4.6, u), lerp(4.4, 4.0, u), lerp(9.6, 8.6, ease(u))), V(-0.6, 1.7, -3.5), 58); };
SH['02'] = (t, d, T, u) => {
  houseCommon(T);
  const m = put(YOUD, 'house', 4.5, 0, 3.6, PI + 0.35);
  const k = sstep(w(6) - 0.3, w(6) + 0.05, T);
  m.spine.rotation.y = -0.55 * k; m.head.rotation.set(lerp(-0.3, -0.05, k), -1.25 * k, 0, 'YXZ');
  m.arm('L', 0.1, 0.12); m.arm('R', 1.2 * k, 0.5 * k, 0, 1.4 * k); if (k > 0.5) thumbsUp(m, 'R');
  m.setFace(k < 0.5 ? { eyes: 'normal', brows: 'up', mouth: 'o' } : { eyes: 'half', brows: 'cocky', mouth: 'grin' });
  cam(V(5.35, 1.05 + 0.1 * u, 5.7), V(2.2, 2.5, -4.5), 50);
  ANCH.you = faceOf(m);
};
SH['03'] = (t, d, T, u) => {
  houseCommon(T);
  const tj = T - (w(7) + 0.02); const k = clamp(tj / 0.62);
  const m = put(G3, 'house', lerp(4.0, 2.3, k), lerp(0, -0.95, k) + Math.sin(PI * k) * 1.25, 3.0, -PI / 2);
  m.leg('L', 1.7 * Math.min(1, k * 3), 0.1, 2.3 * Math.min(1, k * 3)); m.leg('R', 1.7 * Math.min(1, k * 3), 0.1, 2.3 * Math.min(1, k * 3));
  m.arm('L', 1.2, 0.2, 0, 1.6); m.arm('R', 1.2, 0.2, 0, 1.6); m.setFace({ eyes: 'happy', mouth: 'grin', brows: 'up' });
  if (tj > 0.62) m.group.visible = false;
  const em = [{ o: V(-1.6, -0.08, 2.4), t: (T % 0.45), up: 2.2, out: 0.9, life: 0.45, size: 0.8 }, { o: V(0.4, -0.08, 3.0), t: ((T + 0.22) % 0.45), up: 2.2, out: 0.9, life: 0.45, size: 0.8 }];
  if (tj > 0.55) em.push({ o: V(2.3, -0.1, 3.0), t: tj - 0.55, up: 4.5, out: 1.8, life: 1.3, size: 1.5, stagger: 0.15 });
  SPLASH.update(em);
  cam(V(-2.0 + 0.45 * u, 0.62, 5.45), V(0.9, 0.35, 2.4), 54);
};
// 04-07 the firing squad
const camLR = () => camera.position.clone();
SH['04'] = (t, d, T, u) => { cam(Lr(0, lerp(1.75, 1.6, u), lerp(3.4, 2.85, ease(u))), Lr(0, 0.95, -2.2), 62); family(T, { eyes: 'blank', mouth: 'flat' }, camLR()); };
SH['05'] = (t, d, T, u) => { const x = lerp(-2.3, 1.1, ease(u)); cam(Lr(x, 1.2, -0.55), Lr(x + 0.25, 1.15, -2.2), 44); family(T, { eyes: 'blank', mouth: 'flat' }, camLR()); };
SH['06'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', mouth: 'flat' });
  const f = faceOf(DAD); cam(f.clone().add(V(0.05, 0.0, lerp(0.85, 0.62, ease(u)))), f.clone().add(V(0, -0.02, 0)), 36);
  headLook(DAD, camLR(), 1); for (const m of [MOM, CRUSH, G3]) headLook(m, camLR(), 1, 0.9);
};
SH['07'] = (t, d, T, u) => {
  cam(Lr(0.35, lerp(1.15, 1.1, u), lerp(0.55, 0.35, ease(u))), Lr(0.35, 1.05, -2.2), 64);
  const c = camLR().add(V(0.0, -0.1, 0));
  family(T, { eyes: 'blank', mouth: 'flat', brows: 'angry' }, c);
  const k = sstep(w(23) - 0.25, w(23) + 0.05, T);
  for (const [n, m] of [[NOODLES[0], G1], [NOODLES[1], G2], [NOODLES[2], G3]]) { m.arm('L', lerp(0.3, 1.25, k), 0.25, 0, lerp(0.9, 0.35, k)); m.arm('R', lerp(0.3, 1.35, k), 0.05, 0, lerp(0.9, 0.5, k)); noodle(n, m, c); }
  DAD.arm('R', lerp(0.95, 1.45, k), 0.1, 0, lerp(2.15, 0.2, k)); placeFork(); if (k > 0.2) FORK.g.quaternion.setFromUnitVectors(V(0, 1, 0), c.clone().sub(FORK.g.position).normalize());
  MOM.arm('L', lerp(0.42, 1.4, k), 0.22, 0, lerp(1.05, 0.4, k)); MOM.arm('R', lerp(0.42, 1.4, k), 0.22, 0, lerp(1.05, 0.4, k));
  const a = handPt(MOM, 'L'), b = handPt(MOM, 'R'); PLATE.g.position.copy(a).add(b).multiplyScalar(0.5).add(V(0, 0.03, 0.03));
};
// 08-16 the shower
SH['08'] = (t, d, T, u) => {
  bathBase(T, { open: 1 });
  const k = clamp((T - (w(27) - 0.22)) / 0.62); const kk = ease(k);
  const m = you(lerp(0.75, 0.05, kk), lerp(1.0, YZ, kk), lerp(PI * 0.75, PI * 0.62, kk), 0.1 + Math.sin(PI * k) * 0.42 - 0.12 * (1 - k));
  const c = k <= 0 ? 0.6 : Math.sin(PI * k);
  m.leg('L', 1.5 * c, 0.15, 2.1 * c); m.leg('R', 1.3 * c, 0.15, 1.9 * c);
  m.arm('L', 0.2, lerp(0.3, 2.2, Math.min(1, k * 2)), 0, 0.3); m.arm('R', 0.2, lerp(0.3, 2.2, Math.min(1, k * 2)), 0, 0.3);
  m.setFace({ eyes: 'happy', mouth: 'grin', brows: 'up' });
  cam(B(1.75, 1.25, 2.45), B(0.15, 1.1, -0.35), 56);
};
SH['09'] = (t, d, T, u) => {
  const tc = sstep(w(30) - 0.1, w(31) + 0.25, T);
  bathBase(T, { open: 1 - tc, spray: sstep(w(29), w(29) + 0.25, T), steam: 0.15, cutBack: true });
  const m = you(); const ls = Math.exp(-t * 7);
  m.hips.position.y = 0.95 - 0.18 * ls; m.leg('L', 0.5 * ls, 0.08, 1.0 * ls); m.leg('R', 0.5 * ls, 0.08, 1.0 * ls);
  m.arm('L', 0.3, lerp(0.3, 2.3, sstep(0.2, 0.6, u)), 0, 0.5); m.arm('R', 0.3, lerp(0.3, 2.3, sstep(0.2, 0.6, u)), 0, 0.5);
  m.head.rotation.x = -0.25 * sstep(0.3, 0.7, u);
  m.setFace(u < 0.3 ? { eyes: 'wide', mouth: 'grin', brows: 'up' } : { eyes: 'happy', mouth: 'grin', brows: 'up' });
  cam(B(0.22, 1.4, -2.25), B(0.0, 1.35, -0.35), 52);
};
SH['10'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.3 + 0.25 * u, cutBack: true });
  const m = you(); m.head.rotation.x = -0.32; m.setFace({ eyes: 'closed', mouth: 'smile', brows: 'up' });
  m.arm('L', 0.4, 1.9, 0, 2.2); m.arm('R', 0.4, 1.9, 0, 2.2);
  const k = ease(sstep(0.15, 0.7, u));
  cam(B(0.3, lerp(1.62, 1.72, k), -1.5), lerpV(B(0, 2.18, -0.78), B(0.03, 1.86, -0.62), k), 44);
};
SH['11'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: lerp(0.55, 1.0, u), cutLeft: true });
  const m = you(YX, YZ, PI + 0.7); const k = Math.sin(T * 9);
  m.arm('L', 0.5, 1.7 + 0.15 * k, 0, 2.5); m.arm('R', 0.5, 1.7 - 0.15 * k, 0, 2.5); m.head.rotation.x = -0.15;
  m.setFace({ eyes: 'closed', mouth: 'smile' });
  cam(B(-1.55, 1.6, lerp(-0.2, -0.45, u)), B(0, 1.45, -0.56), 48);
};
SH['12'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.6, cutBack: true });
  const m = you(); const p = 0.15 * Math.max(0, Math.sin(T * 7));
  m.arm('L', 0.0, 1.45, PI / 2, 1.9 + p); m.arm('R', 0.0, 1.45, PI / 2, 1.9 + p);
  m.spine.rotation.y = 0.12 * Math.sin(T * 3.5); m.setFace({ eyes: 'half', brows: 'cocky', mouth: 'smirk' });
  cam(B(0.0, lerp(1.45, 1.55, u), lerp(-2.95, -2.45, ease(u))), B(0, 1.55, -0.56), 50);
};
SH['13'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.65, cutBack: true });
  const m = you(); const k = T > w(42) - 0.03;
  clingAt(sstep(w(41), w(42) + 0.1, T) * 0.85, T);
  m.setFace(k ? { eyes: 'wide', brows: 'up', mouth: 'o' } : { eyes: 'closed', brows: 'normal', mouth: 'smile' });
  if (k) m.head.rotation.x = 0.05;
  cam(B(0.03, 1.85, lerp(-1.55, -1.42, ease(u)) + (k ? 0.12 * easeOut((T - w(42)) / 0.15) : 0)), B(0.03, 1.85, -0.6), 30);
};
SH['14'] = (t, d, T, u) => {
  bathBase(T, { spray: 0.45, steam: 0.65, cutBack: true });
  const m = you(); clingAt(1, T, 0.2);
  m.setFace({ eyes: 'wide', brows: 'up', mouth: 'o', look: [0.006 * Math.sin(T * 40), 0] });
  cam(B(0.03, 1.87, lerp(-1.12, -1.06, u)), B(0.03, 1.865, -0.6), lerp(30, 25, ease(u)));
};
SH['15'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.55, cutBack: true });
  const m = you(); clingAt(1, T, 1);
  const sw = Math.sin(T * PI * 2 * 1.9); m.hips.position.x = 0.025 * sw; m.hips.rotation.z = 0.04 * sw; m.spine.rotation.z = -0.05 * sw;
  m.arm('L', 0.6, 0.7, 0, 1.2); m.arm('R', 0.6, 0.7, 0, 1.2);
  m.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
  cam(B(0.0, 1.3, lerp(-2.6, -2.35, u)), B(0, 1.2, -0.4), 50);
};
SH['16'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.5, cutLeft: true });
  const m = you(); clingAt(1, T, 1);
  const sw = Math.sin(T * PI * 2 * 1.9); m.hips.position.z = 0.02 * sw; m.spine.rotation.x = 0.06 * sw;
  m.arm('L', 0.3, 0.3, 0, 0.6); m.arm('R', 0.3, 0.3, 0, 0.6);
  m.setFace({ eyes: 'squint', brows: 'worried', mouth: 'tight' });
  cam(B(-2.15, 1.25, -0.25), B(0, 1.1, -0.42), 44);
  ANCH.rent = B(CUR.st.cx, 1.25, CUR.st.cz + 0.25);
};
// 17-24 the curtain falls in love
SH['17'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.5, cutBack: true, cutLeft: true });
  const m = you(); const h = lerp(0.3, 0.72, sstep(w(57), w(61), T));
  clingAt(0.7 * (1 - h), T); hugAt(h);
  if (T > w(61) - 0.05) Object.assign(CUR.st, { face: 'angry', faceU: 0.35, faceV: 0.2, faceScale: easeOut((T - w(61) + 0.05) / 0.18) });
  m.setFace({ eyes: 'half', brows: 'angry', mouth: 'flat' });
  if (T > w(61)) m.head.rotation.y = 0.5 * sstep(w(61), w(61) + 0.25, T);
  cam(lerpV(B(-0.85, 1.95, -1.6), B(-1.65, 2.35, -2.55), ease(u)), B(0.0, 1.45, -0.42), 50);
};
function curtainFaceWorld() { CUR.update(F.T); return CUR.face.getWorldPosition(V(0, 0, 0)); }
SH['18'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.45, cutBack: true });
  const m = you(); hugAt(0.75); Object.assign(CUR.st, { face: 'angry', faceU: 0.35, faceV: 0.2 });
  m.setFace({ eyes: 'squint', brows: 'angry', mouth: 'frown' }); m.head.rotation.y = 0.45;
  Object.assign(CUR.st, { faceScale: 1.3 }); const cf = curtainFaceWorld();
  cam(cf.clone().add(V(lerp(-0.2, -0.16, u), 0.03, lerp(-0.62, -0.5, ease(u)))), cf.clone().add(V(0.04, 0, 0)), 36);
  ANCH.cface = cf;
};
SH['19'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.45, cutBack: true, cutLeft: true });
  const m = you(); hugAt(0.78); Object.assign(CUR.st, { face: 'angry', faceU: 0.35, faceV: 0.2 });
  m.setFace({ eyes: 'squint', brows: 'angry', mouth: 'frown' }); m.head.rotation.y = 0.55; m.head.rotation.x = 0.08;
  m.arm('L', 0.3, 0.35, 0, 1.4); m.arm('R', 0.3, 0.35, 0, 1.4);
  CUR.st.faceScale = 1.2; const cf = curtainFaceWorld(); const yf = faceOf(m);
  cam(yf.clone().add(V(-0.12, 0.02, -0.75)), yf.clone().lerp(cf, 0.45), 42);
  ANCH.cface = cf;
};
SH['20'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutLeft: true });
  const turn = sstep(w(67) - 0.08, w(68) - 0.04, T), s = T - w(68);
  const m = you(YX, YZ, lerp(PI, 2 * PI, turn));
  if (s < 0) { hugAt(0.75 * (1 - 0.6 * turn)); m.arm('L', 0.6 * turn, 0.2, 0, 2.0 * turn); m.arm('R', 0.6 * turn, 0.2, 0, 2.0 * turn); }
  else { m.arm('L', 1.45, 0.18, 0, 0.1); m.arm('R', 1.45, 0.18, 0, 0.1); m.spine.rotation.x = 0.15; }
  CUR.st.push = s < 0 ? 0 : (s < 0.16 ? easeOut(s / 0.16) : 1 + 0.12 * Math.sin((s - 0.16) * 9) * Math.exp(-(s - 0.16) * 2.5));
  m.setFace(s < 0 ? { eyes: 'squint', brows: 'angry', mouth: 'frown' } : { eyes: 'determined', brows: 'angry', mouth: 'grin' });
  cam(B(-2.3, 1.35, 0.1), B(0, 1.25, -0.25), 54);
  ANCH.whap = B(0, 1.35, 0.1);
};
SH['21'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const back = sstep(w(73) - 0.1, w(73) + 0.25, T);
  const m = you(YX, YZ, lerp(2 * PI, 3 * PI, back));
  const ts = w(78) - 0.12; // slap
  CUR.st.push = T < ts ? 1 - easeIn(sstep(w(74) - 0.1, ts, T)) : 0;
  if (T >= ts) { const k = sstep(ts, ts + 0.18, T); hugAt(0.88 * k); clingAt(1 - k, T); }
  const slapped = T >= ts;
  m.setFace(slapped ? { eyes: 'wide', brows: 'up', mouth: 'o' } : { eyes: 'happy', brows: 'normal', mouth: 'smile' });
  if (slapped) { m.arm('L', 0.4, 0.9, 0, 0.6); m.arm('R', 0.4, 0.9, 0, 0.6); }
  cam(B(0.0, 1.45, lerp(-2.5, -2.3, u)), B(0, 1.35, -0.42), 50);
};
SH['22'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true, cutLeft: true });
  const m = you(); hugAt(0.88);
  Object.assign(CUR.st, { face: 'love', faceU: 0.35, faceV: 0.2 });
  m.setFace({ eyes: 'half', brows: 'normal', mouth: 'flat' });
  cam(B(lerp(-0.7, -0.6, u), 1.8, lerp(-1.95, -1.8, u)), B(0.0, 1.6, -0.5), 46);
  HEARTS.forEach((h, i) => {
    const k = T - (w(81) - 0.15 + i * 0.12); if (k < 0) return;
    const ph = [-2.2, 2.3, -2.6, 2.0, -1.9, 2.6, -2.4, 2.2][i];
    h.visible = true; h.position.set(Math.sin(ph) * 0.36 + 0.05 * Math.sin(k * 6 + i), 1.5 + 0.06 * i + 0.4 * k, YZ + Math.cos(ph) * 0.36);
    const s = 0.1 * (k < 0.18 ? easeOut(k / 0.18) * 1.25 : 1 + 0.25 * Math.exp(-(k - 0.18) * 8) * Math.cos((k - 0.18) * 30));
    h.scale.setScalar(s); h.lookAt(camera.position.clone().sub(BA)); h.rotateZ(0.2 * Math.sin(k * 5 + i));
  });
};
SH['23'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const m = you(); hugAt(lerp(0.88, 0.98, u), lerp(0.31, 0.25, ease(u)));
  m.arm('L', 0, 0.02); m.arm('R', 0, 0.02);
  m.setFace({ eyes: 'half', brows: 'angry', mouth: 'tight' });
  cam(B(0.12, 1.82, lerp(-1.55, -1.4, u)), B(0.02, 1.8, -0.56), 36);
};
SH['24'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const sq = Math.exp(-Math.max(0, T - w(94)) * 6) * (T > w(94) ? 1 : 0);
  const m = you(); hugAt(0.98, 0.25 - 0.035 * sq); m.arm('L', 0, 0.02); m.arm('R', 0, 0.02);
  Object.assign(CUR.st, { face: 'smug', faceU: 0.35, faceV: 0.2 });
  m.setFace({ eyes: 'half', brows: 'angry', mouth: T > w(93) ? 'frown' : 'tight' });
  if (T < w(93) - 0.05) cam(B(-0.35, 1.75, -1.8), B(0.05, 1.7, -0.56), 42);
  else { const f = faceOf(m); cam(f.clone().add(V(0.12, 0.03, -0.62)), f.clone().add(V(-0.12, 0, 0)), 34); }
};
// 25-30 genius plan
SH['25'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const m = you(); hugAt(lerp(0.7, 0.45, u), 0.3);
  const tap = Math.max(0, Math.sin(T * 14)) * sstep(w(98) - 0.2, w(98), T);
  ikArm(m, 'R', headPt(m, -0.135, 0.06 + 0.012 * tap, 0.04), [0.9, 0.9, 0.3, 2.2]); m.head.rotation.z = 0.06;
  m.setFace({ eyes: 'squint', brows: 'cocky', mouth: 'smirk' });
  cam(B(0.0, 1.82, lerp(-1.95, -1.45, ease(u))), B(0.0, 1.8, -0.56), 38);
  ANCH.temple = handPt(m, 'R', V(0, -0.12, 0));
};
SH['26'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const m = you(); hugAt(lerp(0.45, 0.25, u), 0.32); clingAt(0.3, T);
  const k = sstep(w(101) - 0.05, w(101) + 0.2, T);
  if (k > 0) ikArm(m, 'R', headPt(m, -0.23, -0.02 + 0.03 * Math.sin(T * 6), 0.16).lerp(handPt(m, 'R'), 1 - k), [1.0, 0.6, 0.2, 2.0]);
  m.setFace(k > 0.5 ? { eyes: 'happy', brows: 'cocky', mouth: 'grin' } : { eyes: 'squint', brows: 'cocky', mouth: 'smirk' });
  if (k > 0) { ROLL.visible = true; ROLL.position.copy(handPt(m, 'R', V(0, -0.13, 0.05))); ROLL.rotation.set(0.1, 0.4 * Math.sin(T * 2), 0.3); ROLL.scale.setScalar(easeOut(k)); }
  cam(B(0.1, 1.72, lerp(-2.0, -1.85, u)), B(0, 1.7, -0.56), 42);
  ANCH.tape = ROLL.position.clone();
};
function taping(m, T, speed = 1) {
  m.arm('L', 1.3 + 0.45 * Math.sin(T * 15 * speed), 0.35 + 0.3 * Math.sin(T * 9 * speed), 0, 0.5);
  m.arm('R', 1.3 + 0.45 * Math.cos(T * 15 * speed), 0.35 + 0.3 * Math.cos(T * 11 * speed), 0, 0.5);
  ROLL.visible = true; ROLL.scale.setScalar(1); ROLL.position.copy(handPt(m, 'R', V(0, -0.12, 0.06))); ROLL.rotation.set(T * 9, 0.3, 0.2);
}
SH['27'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  const m = you(YX - 0.08, YZ - 0.06, 0); CUR.st.taped = sstep(w(105) - 0.15, w(105) + 0.2, T);
  F.tape = Math.max(0, (T - (w(105) + 0.02)) / 0.22);
  taping(m, T);
  m.setFace({ eyes: 'determined', brows: 'angry', mouth: 'tight' });
  cam(B(-0.6, 1.55, -2.25), B(0.2, 1.35, -0.3), 50);
};
SH['28'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  CUR.st.taped = 1; F.tape = Math.min(14, Math.max(0, (T - (w(105) + 0.02)) / 0.17));
  const B2 = T > w(115) - 0.08;
  const m = B2 ? you(YX - 0.3, YZ - 0.22, PI * 0.15) : you(YX - 0.08, YZ - 0.06, 0);
  if (!B2) taping(m, T, 1.4);
  else { m.arm('L', 0.1, 0.3, 0, 0.3); m.arm('R', 1.1, 0.3, 0, 0.6); ROLL.visible = true; ROLL.position.copy(handPt(m, 'R', V(0, -0.12, 0.06))); m.setFace({ eyes: 'half', brows: 'cocky', mouth: 'smirk' }); headLook(m, B(0.3, 1.4, -0.3), 1); }
  if (!B2) m.setFace({ eyes: 'determined', brows: 'angry', mouth: 'grin' });
  if (!B2) cam(B(0.65, 1.6, -2.05), B(-0.1, 1.4, -0.3), 48); else cam(B(0.15, 1.45, lerp(-2.65, -2.55, u)), B(0.05, 1.35, -0.3), 56);
};
SH['29'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  CUR.st.taped = 1; F.tape = 14;
  const m = you(YX - 0.05, YZ - 0.12, PI); ikArm(m, 'R', headPt(m, -0.27, -0.06, 0.18), [1.0, 0.6, 0.2, 2.0]); thumbsUp(m, 'R');
  m.setFace({ eyes: 'happy', brows: 'up', mouth: 'grin' });
  cam(B(0.05, 1.62, lerp(-2.2, -2.05, u)), B(0, 1.55, -0.6), 46);
  ANCH.thumb = handPt(m, 'R', V(0, 0, 0.06)); ANCH.you = faceOf(m);
};
SH['30'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true });
  CUR.st.taped = 1; F.tape = 14;
  const m = you(YX - 0.05, YZ - 0.12, PI); ikArm(m, 'R', headPt(m, -0.27, -0.06, 0.18), [1.0, 0.6, 0.2, 2.0]); ikArm(m, 'L', headPt(m, 0.27, -0.06, 0.18), [1.0, 0.6, 0.2, 2.0]); thumbsUp(m, 'R'); thumbsUp(m, 'L');
  const wig = T > w(119) && T < w(119) + 0.5 ? 0.012 * Math.sin((T - w(119)) * 40) : 0;
  m.setFace({ eyes: 'squint', brows: 'cocky', mouth: 'smirk', look: [0, wig] });
  const f = faceOf(m); cam(f.clone().add(V(0.12, 0.02, lerp(-0.95, -0.72, ease(u)))), f.clone().add(V(0, -0.06, 0)), 38);
  ANCH.you = f;
};
// 31-36 water, weight, rip, rail
SH['31'] = (t, d, T, u) => {
  const k = sstep(w(121), w(124), T);
  bathBase(T, { spray: 1, steam: 0.45, cutLeft: true, cutBack: true, sprayDir: V(0, lerp(-1, -0.55, k), lerp(0.3, 1.0, k)), reach: lerp(0.42, 0.66, k) });
  BS.head.rotation.x = lerp(0.7, 1.25, k);
  CUR.st.taped = 1; F.tape = 14; CUR.st.wet = sstep(w(124), w(126), T);
  const m = you(-0.5, -0.78, PI * 0.1); m.setFace({ eyes: 'half', brows: 'cocky', mouth: 'smirk' }); headLook(m, B(0.2, 1.4, -0.3), 1);
  if (T > w(124)) F.drops = true, DROPS.update([{ o: B(0, 1.75, -0.32), t: (T * 1.7) % 0.5, up: 1.2, out: 0.9, life: 0.5, size: 1 }, { o: B(0.1, 1.6, -0.32), t: (T * 1.7 + 0.25) % 0.5, up: 1.0, out: 0.8, life: 0.5, size: 1 }]);
  cam(B(0.75, 1.55, lerp(-2.35, -2.25, u)), B(0.12, 1.45, -0.3), 50);
};
function wetCurtain(T) { BS.head.rotation.x = 1.25; F.sprayDir = V(0, -0.55, 1); F.reach = 0.66; CUR.st.taped = 1; F.tape = 14; CUR.st.wet = 1; }
SH['32'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.45, cutBack: true }); wetCurtain(T);
  const sg = lerp(0, 0.5, sstep(w(127), w(130) + 0.3, T)); CUR.st.sag = sg; CUR.st.aL = -0.04 * sg; CUR.st.aR = 0.04 * sg;
  const m = you(-0.55, -0.8, PI / 2 + 0.35); m.setFace({ eyes: 'wide', brows: 'worried', mouth: 'o' }); headLook(m, B(0.1, 1.2, -0.35), 1);
  BS.leftWall.visible = false; cam(B(-2.15, 1.35, lerp(0.15, 0.25, u)), B(0.0, 1.2, -0.2), 52);
  ANCH.belly = B(0.0, 0.95, 0.05);
};
SH['33'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.45, cutBack: true }); wetCurtain(T);
  const sg = lerp(0.5, 0.95, sstep(w(131) - 0.1, w(131) + 0.45, T)); CUR.st.sag = sg; CUR.st.aL = -0.08 * sg; CUR.st.aR = 0.08 * sg;
  const m = you(-0.55, -0.8, PI / 2 + 0.35); m.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' }); headLook(m, B(0.1, 1.4, -0.35), 1);
  BS.leftWall.visible = false; cam(B(-1.75 + 0.01 * Math.sin(T * 50), lerp(0.75, 0.7, u), 0.75), B(0.0, 1.25, -0.1), 56, null, 0.12);
  ANCH.belly = B(0.0, 0.95, 0.12);
};
SH['34'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.45, cutBack: true }); wetCurtain(T);
  const r = T - w(132);
  CUR.st.taped = r < 0 ? 1 : 1 - sstep(0, 0.25, r); CUR.st.sag = 0.95; F.rip = w(132) - 0.02;
  CUR.st.aL = -lerp(0.08, 0.2, sstep(0, 0.4, r)); CUR.st.aR = -CUR.st.aL;
  CUR.st.push = r > 0 ? 0.15 * Math.sin(r * 12) * Math.exp(-r * 3) : 0;
  const m = you(-0.55, -0.8, PI / 2 + 0.35); m.setFace({ eyes: 'wide', brows: 'up', mouth: 'drop' }); headLook(m, B(0.2, 1.6, -0.3), 1);
  cam(B(0.55, 1.65, -1.75), B(0.35, 1.45, -0.32), 46);
};
SH['35'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutBack: true }); wetCurtain(T); F.rip = -1e9; CUR.st.taped = 0; F.tape = 14;
  CUR.st.sag = 0.95; const b = sstep(w(133), w(137), T); CUR.st.aL = -lerp(0.2, 0.42, b); CUR.st.aR = -CUR.st.aL;
  CUR.st.ringFly = [{ k: 5, t: w(134), vx: 0.7, vy: 1.7, vz: -0.7, spin: 14 }, { k: 7, t: w(136) - 0.15, vx: -0.6, vy: 1.9, vz: -0.6, spin: -12 }, { k: 3, t: w(137) + 0.05, vx: 0.5, vy: 1.5, vz: -0.8, spin: 10 }];
  const m = you(-0.2, -0.62, PI); m.head.rotation.x = -0.45; m.setFace({ eyes: 'wide', brows: 'up', mouth: 'o', look: [0, 0.01] });
  BS.pipe.visible = false; F.spray = 0; BS.backWall.visible = false; cam(B(0.45, 1.3, -1.55), B(-0.05, 2.15, -0.24), 58);
};
SH['36'] = (t, d, T, u) => {
  bathBase(T, { spray: 1, steam: 0.4, cutLeft: true }); wetCurtain(T); F.rip = -1e9; CUR.st.taped = 0; F.tape = 14;
  const f = easeIn(sstep(w(137), w(138) + 0.05, T));
  const m = you(-0.2, -0.62, PI);
  Object.assign(CUR.st, { sag: 0.95 * (1 - f), aL: -0.42 - 0.2 * f, aR: 0.42 + 0.2 * f, dropL: 0.25 * f, dropR: 0.25 * f, slide: 0.1 * f });
  CUR.st.ringFly = [{ k: 5, t: w(134), vx: 0.7, vy: 1.7, vz: -0.7, spin: 14 }, { k: 7, t: w(136) - 0.15, vx: -0.6, vy: 1.9, vz: -0.6, spin: -12 }, { k: 3, t: w(137) + 0.05, vx: 0.5, vy: 1.5, vz: -0.8, spin: 10 }];
  if (f > 0) { hugAt(f, 0.28, lerp(1.72, 1.66, f)); }
  m.head.rotation.x = -0.3 * (1 - f); m.setFace({ eyes: 'wide', brows: 'up', mouth: f > 0.5 ? 'drop' : 'o' });
  m.arm('L', 0.3, lerp(0.9, 0.05, f), 0, 0.5); m.arm('R', 0.3, lerp(0.9, 0.05, f), 0, 0.5);
  cam(B(-2.3, 1.45, -0.3), B(0.0, 1.3, -0.5), 52);
};
// 37-47 the human burrito in the tub
SH['37'] = (t, d, T, u) => {
  burInTub(T, { cutTop: true, spray: 0, steam: 0.25 });
  YOUH.setFace({ eyes: 'half', brows: 'normal', mouth: 'flat' });
  cam(B(0.0, lerp(3.25, 2.9, ease(u)), -0.62), B(0.02, 0.4, -0.66), 48, V(1, 0, 0), 0.05 * Math.sin(T));
};
SH['38'] = (t, d, T, u) => {
  burInTub(T, { spray: 0.6, steam: 0.3, cutTop: T > w(147) - 0.05 });
  YOUH.setFace({ eyes: 'half', brows: 'worried', mouth: 'frown' });
  if (T < w(147) - 0.05) { const f = burFace(); cam(f.clone().add(V(-0.1, lerp(0.6, 0.5, u), 0.5)), f, 40, V(1, 0, 0)); }
  else cam(B(-0.3, 2.5, 0.75), B(0.1, 0.45, -0.66), 50);
};
SH['39'] = (t, d, T, u) => { burInTub(T, { spray: 0.5, steam: 0.3 }); YOUH.setFace({ eyes: 'half', mouth: 'frown' }); const p = burPt(-0.35, 0.27, 0.05); cam(p.clone().add(V(0.12, 0.5, lerp(0.62, 0.55, u))), p, 40); ANCH.lab = p; };
SH['40'] = (t, d, T, u) => { burInTub(T, { spray: 0.5, steam: 0.3 }); YOUH.setFace({ eyes: 'half', mouth: 'frown' }); const p = burPt(0.1, 0.24, 0.12); cam(p.clone().add(V(-0.2, 0.42, lerp(0.55, 0.5, u))), p, 38); ANCH.lab = p; };
SH['41'] = (t, d, T, u) => {
  burInTub(T, { spray: 0.5, steam: 0.3, bur: { bar: 0.3 } }); YOUH.setFace({ eyes: 'half', mouth: 'frown' });
  const p = BUR.barB.localToWorld(V(0, 0.3, 0)); cam(p.clone().add(V(0.15, 0.25, lerp(0.85, 0.75, u))), p.clone().add(V(-0.05, -0.15, 0)), 44); ANCH.lab = p;
};
SH['42'] = (t, d, T, u) => { burInTub(T, { spray: 0.5, steam: 0.3 }); YOUH.setFace({ eyes: 'half', brows: 'worried', mouth: 'frown' }); const f = burFace(); cam(f.clone().add(V(0.05, 0.5, lerp(0.45, 0.38, u))), f, 34, V(1, 0, 0)); ANCH.lab = f; };
SH['43'] = (t, d, T, u) => { burInTub(T, { spray: 0.5, steam: 0.3, cutTop: true }); YOUH.setFace({ eyes: 'closed', mouth: 'frown' }); cam(B(0.15, lerp(2.75, 2.95, u), 0.75), B(0.02, 0.4, -0.66), 54); ANCH.lab = B(0.02, 0.45, -0.66); };
function standTilt(a, T, o = {}) { // pivot at the feet end
  const piv = B(-0.9, 0.36, -0.66);
  burInTub(T, Object.assign({ spray: 0.4, steam: 0.3 }, o, { bur: Object.assign({ pos: piv.clone().add(V(0.86 * Math.cos(a), 0.86 * Math.sin(a), 0)), tilt: a, T }, o.bur || {}) }));
}
SH['44'] = (t, d, T, u) => {
  const a = 0.1 + 0.85 * ease(sstep(w(160), w(164) + 0.3, T)) + 0.05 * Math.sin(T * 13) * sstep(w(161), w(164), T);
  standTilt(a, T, { bur: { wobble: 1 } }); YOUH.setFace({ eyes: 'squint', brows: 'angry', mouth: 'tight' });
  cam(B(0.0, lerp(1.2, 1.3, u), 2.3), B(-0.1, 0.95, -0.66), 55);
};
SH['45'] = (t, d, T, u) => {
  const k = sstep(w(166) - 0.12, w(166) + 0.06, T), b = T > w(166) + 0.06 ? 0.07 * Math.abs(Math.sin((T - w(166) - 0.06) * 18)) * Math.exp(-(T - w(166)) * 7) : 0;
  standTilt(lerp(0.95, 0.1, easeIn(k)) + b, T); YOUH.setFace(k < 0.9 ? { eyes: 'wide', brows: 'up', mouth: 'o' } : { eyes: 'closed', brows: 'worried', mouth: 'wavy' });
  cam(B(0.9, 1.15, 1.1), B(0.0, 0.6, -0.66), 52);
  ANCH.thud = B(0.5, 0.55, -0.66);
};
SH['46'] = (t, d, T, u) => {
  burInTub(T, { spray: 0.4, steam: 0.3, bur: { feet: 1 } }); YOUH.setFace({ eyes: 'closed', brows: 'worried', mouth: 'frown' });
  const p = burPt(-0.97, 0.08, 0); cam(p.clone().add(V(0.38, 0.7, lerp(0.45, 0.38, u))), p, 42);
  ANCH.feet = p;
};
SH['47'] = (t, d, T, u) => {
  bathBase(T, { spray: 0.3, steam: 0.25 }); CUR.mesh.visible = false; CUR.rings.forEach(r => r.visible = false); BS.railL.visible = BS.railR.visible = false;
  const k = sstep(w(175) - 0.05, w(175) + 0.45, T);
  const rock = (1 - k) * 0.3 * Math.sin((T - 60.9) * 9) * sstep(60.9, 61.3, T);
  const z = lerp(-0.66, 0.35, k), y = k < 0.45 ? lerp(0.36, 0.86, Math.sin(PI * k / 0.9)) : lerp(0.86, 0.245, easeIn((k - 0.45) / 0.55));
  burSet({ pos: B(0.3, y, z), yaw: 0, tilt: 0.06 * (1 - k), roll: rock + 2 * PI * k, T });
  YOUH.setFace(k > 0.05 ? { eyes: 'determined', brows: 'angry', mouth: 'tight' } : { eyes: 'squint', brows: 'angry', mouth: 'tight' });
  cam(B(0.6, 1.55, 2.35), B(0.2, 0.5, -0.3), 52);
};
// 48-55 rolling out, hallway, into the living room
SH['48'] = (t, d, T, u) => {
  bathBase(T, { spray: 0.3, steam: 0.2 }); CUR.mesh.visible = false; CUR.rings.forEach(r => r.visible = false); BS.railL.visible = BS.railR.visible = false;
  const z = lerp(0.35, 3.9, sstep(w(176) - 0.1, w(179) + 0.2, T));
  burSet({ pos: B(0.55, 0.245, z), yaw: 0, roll: 2 * PI + (z - 0.35) / 0.243, T });
  YOUH.setFace({ eyes: 'determined', brows: 'angry', mouth: 'tight' });
  cam(B(0.55, 0.62, 4.6), B(0.55, 0.42, 1.2), 56);
};
function hallBur(T, x, z, o = {}) {
  useSet('hall');
  burSet(Object.assign({ pos: Hw(x, 0.245, z), yaw: PI / 2, roll: (x + 5) / 0.243, T }, o));
  YOUH.setFace(o.face || { eyes: 'determined', brows: 'angry', mouth: 'tight' });
}
function photosJump(T, t0, side) {
  if (T < t0) return; const k = T - t0;
  HS.photos.forEach((p, i) => { if (p.s !== side) return; p.g.rotation.z = 0.25 * Math.sin(k * 22 + i) * Math.exp(-k * 4) + (i % 3 === 0 ? -0.2 : 0.1) * sstep(0, 0.1, k); p.g.position.y = p.y0 + 0.04 * Math.abs(Math.sin(k * 25)) * Math.exp(-k * 6); });
}
SH['49'] = (t, d, T, u) => { const x = lerp(-4.6, 0.9, ease(u)); hallBur(T, x, 0); cam(Hw(5.4, 0.5, 0.15), Hw(-1.5, 0.45, 0), 52); };
SH['50'] = (t, d, T, u) => {
  const k = T - w(184); const z = k < 0 ? lerp(0, -0.45, sstep(-0.1, 0, k)) : -0.45 + 0.2 * easeOut(Math.min(1, k / 0.3));
  const x = lerp(1.2, 1.9, u); hallBur(T, x, z, { face: k > 0 && k < 0.35 ? { eyes: 'closed', brows: 'angry', mouth: 'wavy' } : null });
  photosJump(T, w(184), -1);
  cam(Hw(x + 0.6, 1.35, 1.0), Hw(x, 0.55, -0.9), 50); ANCH.thump = Hw(x, 0.6, -1.25);
};
SH['51'] = (t, d, T, u) => {
  HS.ceiling.visible = false;
  const k = T - w(185); const z = k < 0 ? lerp(-0.25, 0.4, sstep(-0.15, 0, k)) : 0.4 - 0.25 * easeOut(Math.min(1, k / 0.3));
  const x = lerp(2.0, 2.6, u); hallBur(T, x, z); photosJump(T, w(184), -1); photosJump(T, w(185), 1);
  HS.ceiling.visible = false;
  cam(Hw(x, 3.4, 0.0), Hw(x, 0.3, 0.0), 58, V(1, 0, 0)); ANCH.thump = Hw(x, 0.4, 1.25);
};
SH['52'] = (t, d, T, u) => {
  const k = T - w(186); const z = k < 0 ? lerp(0.15, -0.45, sstep(-0.12, 0, k)) : -0.45 + 0.2 * easeOut(Math.min(1, k / 0.3));
  const x = lerp(2.7, 3.2, u); hallBur(T, x, z, { face: k > 0 ? { eyes: 'closed', brows: 'angry', mouth: 'wavy' } : null });
  photosJump(T, w(184), -1); photosJump(T, w(186), -1);
  const f = burFace(); cam(f.clone().add(V(0.7, 0.3, 0.55)), f.clone().add(V(0, -0.05, -0.05)), 44); ANCH.thump = f.clone().add(V(0, 0, -0.1));
};
SH['53'] = (t, d, T, u) => {
  useSet('hall'); const x = 3.4 + 0.25 * u;
  burSet({ pos: Hw(x, 0.245, 0), yaw: PI / 2, roll: 5.4 + 0.9 * u, T });
  YOUH.setFace({ eyes: 'determined', brows: 'angry', mouth: 'tight' });
  const f = burFace(); const n = YOUH.head.getWorldDirection(V(0, 0, 0)); // face normal (+z of the head)
  const up = YOUH.worldOf(YOUH.head, V(0, 1, 0)).sub(YOUH.worldOf(YOUH.head, V(0, 0, 0))).normalize();
  cam(f.clone().addScaledVector(n, lerp(0.62, 0.5, u)).addScaledVector(up, 0.04), f, 34, up);
};
SH['54'] = (t, d, T, u) => { const x = lerp(1.6, 3.4, u); hallBur(T, x, 0); cam(Hw(4.6, 0.16, 0.35), Hw(2.6, 0.62, 0.0), 62); };
SH['55'] = (t, d, T, u) => {
  family(T, m => ({ eyes: 'wide', mouth: 'flat', brows: 'up' }));
  const k = sstep(w(195) - 0.1, w(199) + 0.1, T); const x = lerp(5.3, 0.35, easeOut(k));
  const settle = T > w(199) + 0.1 ? 0.12 * Math.sin((T - w(199) - 0.1) * 12) * Math.exp(-(T - w(199)) * 5) : 0;
  livingBurrito(T, { pos: Lr(x, 0.245, -0.42), roll: -6 * PI * easeOut(k) + settle });
  LS.puddle.visible = k > 0.95;
  for (const [m] of SEATS) headLook(m, Lr(x, 0.4, -0.4), 1, 1.0);
  cam(Lr(-2.4, 2.3, 3.4), Lr(0.9, 0.5, -0.8), 54);
};
// 56-61 family reactions
const reactFace = { eyes: 'wide', brows: 'up', mouth: 'drop' };
SH['56'] = (t, d, T, u) => {
  family(T, m => (m === MOM ? reactFace : { eyes: 'wide', mouth: 'flat' })); livingBurrito(T);
  const f = faceOf(MOM); headLook(MOM, Lr(0.35, 0.3, -0.6), 0.6);
  cam(f.clone().add(V(0.12, -0.02, lerp(0.85, 0.7, ease(u)))), f, 36);
};
SH['57'] = (t, d, T, u) => {
  family(T, m => (m === MOM ? reactFace : { eyes: 'wide', mouth: 'o' })); livingBurrito(T);
  headLook(MOM, Lr(0.35, 0.3, -0.6), 0.6);
  const p0 = PLATE.g.position.clone(); const k = T - w(204); const tc = w(207) - 0.08;
  if (k > 0) {
    const fy = Math.min(1, k / (tc - w(204))); PLATE.g.position.set(p0.x + 0.05 * fy, lerp(p0.y, 0.03, fy * fy), p0.z + 0.12 * fy);
    PLATE.plate.rotation.set(0.6 * fy, 0, 0.3 * fy);
    PLATE.snacks.forEach((s, i) => { const lift = 0.12 * fy * (0.5 + (i % 3) * 0.3); s.position.copy(s.userData.home).add(V(0, lift, 0)); s.rotation.set(fy * 2 * i, fy * i, 0); });
  }
  if (T > tc) {
    const e = T - tc; PLATE.plate.visible = false;
    PLATE.shards.forEach((s, i) => { s.visible = true; const v = s.userData.v; s.position.copy(PLATE.g.position).add(V(v.x * e, Math.max(0.01, v.y * e - 4.9 * e * e), v.z * e)); s.rotation.set(s.userData.spin.x * e, s.userData.spin.y * e, s.userData.spin.z * e); });
    PLATE.snacks.forEach(s => { const v = s.userData.v; s.position.copy(s.userData.home).add(V(v.x * e * 0.7, Math.max(-0.02, 0.12 + v.y * e * 0.7 - 4.9 * e * e), v.z * e * 0.7)); });
  } else PLATE.plate.visible = true;
  cam(Lr(-0.12, 0.34, -0.45), Lr(-0.45, 0.42, -1.6), 52);
  ANCH.crash = V(PLATE.g.position.x, 0.1, PLATE.g.position.z);
};
SH['58'] = (t, d, T, u) => {
  const fr = T > w(211) - 0.05;
  family(T, m => (m === DAD ? { eyes: fr ? 'blank' : 'normal', brows: fr ? 'up' : 'normal', mouth: fr ? 'chew' : (Math.sin(T * 16) > 0 ? 'chew' : 'flat') } : { eyes: 'wide', mouth: 'o' }), null, { noPlate: true });
  livingBurrito(T); headLook(DAD, Lr(0.35, 0.3, -0.6), 0.5);
  if (!fr) DAD.head.rotation.x += 0.03 * Math.sin(T * 16);
  const f = faceOf(DAD);
  if (!fr) cam(f.clone().add(V(0.2, 0.0, 0.85)), f.clone().add(V(0, -0.05, 0)), 36);
  else cam(f.clone().add(V(0.12, 0.02, 0.55)), f.clone().add(V(0, -0.02, 0)), 32);
};
SH['59'] = (t, d, T, u) => {
  family(T, m => (m === DAD ? { eyes: 'blank', brows: 'up', mouth: 'chew' } : { eyes: 'wide', mouth: 'o' }), null, { noPlate: true });
  livingBurrito(T); headLook(DAD, Lr(0.35, 0.3, -0.6), 0.5);
  DAD.arm('R', 0.95, 0.12, 0, lerp(2.15, 1.85, sstep(w(215), w(215) + 0.4, T))); placeFork();
  const k = T - (w(214) + 0.1);
  if (k > 0) { FORK.food.position.set(0, 0.085 - 0.5 * 0.9 * k * k, 0.005 + 0.06 * k); FORK.food.rotation.set(k * 3, 0, k * 2); }
  const p = FORK.g.localToWorld(V(0, 0.06, 0));
  cam(p.clone().add(V(0.4, 0.0, 0.3)), p.clone().add(V(0, -0.08, 0)), 40);
  ANCH.fork = p;
};
SH['60'] = (t, d, T, u) => {
  family(T, m => (m === CRUSH ? { eyes: 'blank', brows: 'normal', mouth: 'flat' } : { eyes: 'wide', mouth: 'o' }), null, { noPlate: true }); livingBurrito(T);
  headLook(CRUSH, Lr(0.35, 0.3, -0.7), 0.7);
  const f = faceOf(CRUSH); cam(f.clone().add(V(0.0, 0.04, lerp(0.85, 0.72, ease(u)))), f, 34);
};
SH['61'] = (t, d, T, u) => {
  const bl = T > w(224) - 0.05 && T < w(224) + 0.45 ? (T < w(224) + 0.05 || T > w(224) + 0.35 ? 'half' : 'closed') : 'blank';
  family(T, m => (m === CRUSH ? { eyes: bl, brows: 'normal', mouth: 'flat' } : { eyes: 'wide', mouth: 'o' }), null, { noPlate: true }); livingBurrito(T);
  headLook(CRUSH, Lr(0.35, 0.3, -0.7), 0.7);
  const f = faceOf(CRUSH); cam(f.clone().add(V(0.0, 0.02, lerp(0.62, 0.5, ease(u)))), f, 32);
};
// 62-71 lying there, the antenna, the wink
const lieFace = (o) => YOUH.setFace(o);
function lieCam(T, dz, dy, fov) { const f = burFace(); cam(f.clone().add(V(0.0, dy, dz)), f, fov, V(0, 0, -1)); return f; }
SH['62'] = (t, d, T, u) => {
  family(T, { eyes: 'wide', mouth: 'o' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T); lieFace({ eyes: 'half', mouth: 'flat' });
  cam(Lr(0.35, lerp(2.7, 2.55, u), -0.45), Lr(0.35, 0.25, -0.5), 50, V(0, 0, -1));
};
SH['63'] = (t, d, T, u) => {
  family(T, { eyes: 'wide', mouth: 'o' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T); lieFace({ eyes: 'half', brows: 'worried', mouth: 'frown' });
  const f = lieCam(T, 0.12, lerp(0.62, 0.55, u), 38);
  F.drops = true; DROPS.update([{ o: f.clone().add(V(0.05, 0.05, -0.12)), t: (T * 1.3) % 0.6, up: 0.6, out: 0.4, life: 0.6, size: 0.6 }, { o: f.clone().add(V(-0.08, 0.04, -0.05)), t: (T * 1.3 + 0.3) % 0.6, up: 0.5, out: 0.4, life: 0.6, size: 0.6 }]);
  ANCH.you = f;
};
SH['64'] = (t, d, T, u) => {
  family(T, { eyes: 'wide', mouth: 'o' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T); lieFace({ eyes: 'half', brows: 'worried', mouth: 'flat' });
  cam(lerpV(Lr(0.35, 1.35, 0.25), Lr(0.35, 3.05, 2.9), easeOut(u)), Lr(0.35, 0.4, -1.25), 56);
};
SH['65'] = (t, d, T, u) => {
  family(T, { eyes: 'wide', mouth: 'o' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T, { bar: 1 }); lieFace({ eyes: 'half', mouth: 'flat' });
  const p = BUR.barB.localToWorld(V(0, 0.2, 0)); cam(p.clone().add(V(0.6, 0.12, 0.45)), p.clone().add(V(0, -0.1, 0)), 42); ANCH.bar = p;
};
SH['66'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', mouth: 'flat' }, Lr(0.35, 0.3, -0.5), { noPlate: true });
  livingBurrito(T, { bar: 1 - 0.6 * sstep(w(245), w(247), T) }); lieFace({ eyes: 'half', mouth: 'flat' });
  BUR.barB.rotation.z += 0.5 * sstep(w(245), w(246), T);
  cam(Lr(1.15, 0.22, 0.45), Lr(0.55, 0.85, -1.4), 56);
};
SH['67'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', mouth: 'flat' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T);
  lieFace(T > w(249) ? { eyes: 'happy', brows: 'up', mouth: 'grin' } : { eyes: 'half', mouth: 'flat' });
  ANCH.you = lieCam(T, 0.1, lerp(0.6, 0.5, ease(u)), 38);
};
SH['68'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', mouth: 'flat' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T);
  if (T < w(253)) { lieFace({ eyes: 'happy', brows: 'up', mouth: 'grin', look: [0, 0.016 * sstep(w(251), w(251) + 0.2, T)] }); lieCam(T, 0.1, 0.5, 38); }
  else { lieFace({ eyes: 'normal', brows: 'up', mouth: 'grin', look: [0, 0.02] }); const f = burFace(); BUR.outer.visible = false; cam(f.clone().add(V(0, 0.12, 0.05)), Lr(0.35, 1.3, -2.3), 78); }
};
SH['69'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', mouth: 'flat' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T);
  const wk = T > w(257) - 0.05;
  lieFace(wk ? { eyes: 'normal', eyeL: 'closed', brows: 'cocky', mouth: 'grin' } : { eyes: 'normal', brows: 'up', mouth: 'grin' });
  ANCH.you = lieCam(T, 0.08, lerp(0.5, 0.42, ease(u)), 36);
};
SH['70'] = (t, d, T, u) => {
  const drop = T > w(258) - 0.08;
  family(T, drop ? { eyes: 'wide', brows: 'up', mouth: 'drop' } : { eyes: 'blank', mouth: 'flat' }, Lr(0.35, 0.3, -0.5), { noPlate: true });
  livingBurrito(T); lieFace({ eyes: 'normal', eyeL: 'closed', brows: 'cocky', mouth: 'grin' });
  cam(Lr(0.35, lerp(0.95, 0.9, u), 0.35), Lr(0.35, 1.05, -2.2), 64);
};
SH['71'] = (t, d, T, u) => {
  family(T, { eyes: 'blank', brows: 'up', mouth: 'o' }, Lr(0.35, 0.3, -0.5), { noPlate: true }); livingBurrito(T); lieFace({ eyes: 'happy', brows: 'up', mouth: 'grin' });
  LS.ceiling.visible = false;
  cam(Lr(0.35, lerp(3.15, 3.35, u), -0.95), Lr(0.35, 0, -1.0), 76, V(0, 0, -1));
};

// ---------------------------------------------------------------- per-frame finish: props, render, meta
function finish(T) {
  CUR.update(T);
  BS.railL.position.set(BS.railXL, BS.railY - CUR.st.dropL, BS.railZ + CUR.st.slide); BS.railL.rotation.z = CUR.st.aL;
  BS.railR.position.set(BS.railXR, BS.railY - CUR.st.dropR, BS.railZ + CUR.st.slide); BS.railR.rotation.z = CUR.st.aR;
  TAPE.update(T, F.tape, F.rip, 0.025);
  SPRAY.update(T, F.spray, BS.headPos, F.sprayDir, F.reach, 0.3);
  STEAM.update(T, F.steam, [-0.95, 0.95, 0.4, 2.7, -1.0, 0.7]);
  if (!F.drops && F.spray >= 0.5 && isShown(YOU.group) && Math.abs(YOU.group.position.x - BA.x) < 0.2 && Math.abs(YOU.group.position.z - BA.z - YZ) < 0.2) {
    const h = YOU.worldOf(YOU.head, V(0, 0.27, -0.03));
    DROPS.update([{ o: h, t: (T * 2.4) % 0.38, up: 1.1, out: 0.7, life: 0.38, size: 0.7 }, { o: h, t: (T * 2.4 + 0.19) % 0.38, up: 1.0, out: 0.7, life: 0.38, size: 0.7 }]);
  }
}
const isShown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const _v = new THREE.Vector3();
function privRect() {
  if (!isShown(YOU.group)) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0, front = 0;
  for (const m of YOU.private) {
    if (!isShown(m)) continue; m.updateWorldMatrix(true, false);
    const pa = m.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      _v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if (_v.z > -camera.near) { behind++; continue; }
      front++; _v.applyMatrix4(camera.projectionMatrix);
      const sx = (_v.x + 1) / 2, sy = (1 - _v.y) / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  }
  if (!front) return null;
  if (behind) return [0, 0, 1, 1];
  const mx = 0.022 + 0.06 * (x1 - x0), my = 0.022 * 1080 / 1920 + 0.04 * (y1 - y0);
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  if (x1 <= 0 || y1 <= 0 || x0 >= 1 || y0 >= 1) return null;
  return [clamp(x0), clamp(y0), clamp(x1), clamp(y1)].map(v => +v.toFixed(5));
}
const MW = 270, MH = 480;
const maskRT = new THREE.WebGLRenderTarget(MW, MH);
const blackM = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const magM = new THREE.MeshBasicMaterial({ color: 0xff00ff, depthFunc: THREE.LessEqualDepth });
const mbuf = new Uint8Array(MW * MH * 4);
function maskCheck(rect) {
  const priv = YOU.private.filter(isShown);
  if (!priv.length) return { vis: 0, out: 0 };
  const hidden = [];
  scene.traverseVisible(o => { if ((o.isMesh || o.isSprite) && o.material && o.material.transparent) hidden.push(o); });
  hidden.forEach(o => o.visible = false);
  const bg = scene.background; scene.background = null; const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(maskRT); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
  scene.overrideMaterial = blackM; renderer.render(scene, camera);
  priv.forEach(m => m.layers.enable(1)); camera.layers.set(1); scene.overrideMaterial = magM; renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true; camera.layers.set(0); priv.forEach(m => m.layers.disable(1));
  scene.overrideMaterial = null; scene.background = bg; renderer.shadowMap.autoUpdate = au; hidden.forEach(o => o.visible = true);
  renderer.readRenderTargetPixels(maskRT, 0, 0, MW, MH, mbuf); renderer.setRenderTarget(null);
  const [x0, y0, x1, y1] = rect || [2, 2, -1, -1]; let vis = 0, out = 0; const tx = 1.5 / MW, ty = 1.5 / MH;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = (y * MW + x) * 4;
    if (mbuf[i] > 128 && mbuf[i + 1] < 80 && mbuf[i + 2] > 128) {
      vis++; const nx = (x + 0.5) / MW, ny = 1 - (y + 0.5) / MH;
      if (nx < x0 - tx || nx > x1 + tx || ny < y0 - ty || ny > y1 + ty) out++;
    }
  }
  return { vis, out };
}
function project(p) {
  const c = p.clone().applyMatrix4(camera.matrixWorldInverse); if (c.z > -camera.near) return null;
  const n = p.clone().project(camera); return [+((n.x + 1) / 2).toFixed(4), +((1 - n.y) / 2).toFixed(4)];
}
let META = null;
window.init = (data) => { WT = data.words; };
window.renderShot = (id, t, d, T) => {
  resetWorld(); F.T = T;
  SH[id](t, d, T, clamp(t / d));
  finish(T);
  renderer.setRenderTarget(null); renderer.render(scene, camera);
  const rect = privRect(); const chk = maskCheck(rect);
  const anchors = {}; for (const k in ANCH) anchors[k] = project(ANCH[k]);
  if (isShown(YOU.group)) anchors.you = anchors.you || project(faceOf(YOU));
  if (BUR.outer.visible) anchors.bface = project(burFace());
  META = { id, T: +T.toFixed(3), rect, vis: chk.vis, out: chk.out, naked: isShown(YOU.group), wrapped: BUR.outer.visible, anchors };
};
window.frameMeta = () => META;
window.ready = true;
// debug: what is under a screen point?
window.pick = (nx, ny) => {
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(nx * 2 - 1, 1 - ny * 2), camera);
  return rc.intersectObjects(scene.children, true).filter(h => isShown(h.object)).slice(0, 4).map(h => {
    const o = h.object; const chain = []; for (let p = o; p; p = p.parent) chain.push(p.type + (p === YOU.group ? '(YOU)' : p === BUR.outer ? '(BUR)' : p === BS.group ? '(BATH)' : ''));
    return { d: +h.distance.toFixed(3), geo: o.geometry.type, params: JSON.stringify(o.geometry.parameters || {}).slice(0, 80), color: o.material.color && o.material.color.getHexString(), chain: chain.join('<'), pos: o.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)) };
  });
};
