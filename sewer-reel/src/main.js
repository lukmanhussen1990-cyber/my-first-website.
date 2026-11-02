// "How the sewer system was invented" — 60 s vertical toy-3D reel.
// Everything is a pure function of time t so frames can be rendered in any order.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, lerp, range, smooth, easeOut, easeIn, easeInOut, easeOutBack, easeOutBounce, pop, rng, noise1 } from './util.js';
import { mat, mesh, grp, sphere, capsule, cyl, rbox, box, torus, cone, makePerson, makeBean, makePoop, makeFly, makeCloud, makeBucket, makeShovel } from './toys.js';
import { initTextures, buildTown, buildCutaway, buildTunnel, buildRiver, STREET, RIVER } from './sets.js';
import { WORDS } from './words.js';

const W = 1080, H = 1920, FPS = 30;
const SC = +(new URLSearchParams(location.search).get('scale') || 1);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

await document.fonts.load('700 100px Fredoka');
await document.fonts.load('600 100px Fredoka');
const TEX = initTextures();

// ---------------- renderer / scene ----------------
const QP = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: QP.get('aa') !== '0', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(Math.round(W * SC), Math.round(H * SC), false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.width = '540px'; renderer.domElement.style.height = '960px';
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
if (QP.get('env') !== '0') { scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32; }
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);

// sky dome
const skyU = { top: { value: new THREE.Color('#529fe8') }, bot: { value: new THREE.Color('#cfe9ff') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.,1.); gl_FragColor = vec4(mix(bot, top, pow(h,0.8)),1.); }',
}));
sky.renderOrder = -1; scene.add(sky);
const clouds = grp(scene);
{
  const R = rng(5);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + R() * 0.2, r = 280 + R() * 140;
    const c = makeCloud(i, 4.2 + R() * 2.5); c.position.set(Math.cos(a) * r, 50 + R() * 80, Math.sin(a) * r); c.lookAt(0, c.position.y, 0); clouds.add(c);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + R() * 0.3, r = 120 + R() * 70;
    const c = makeCloud(i + 3, 2.6 + R() * 1.5); c.position.set(Math.cos(a) * r, 70 + R() * 40, Math.sin(a) * r); c.lookAt(0, c.position.y, 0); clouds.add(c);
  }
}
const cloudMat = clouds.children[0].children[0].material;
const hemi = new THREE.HemisphereLight('#d6ebff', '#7d6b4f', 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d6', 2.9); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const SUN_DIR = V3(0.55, 1, 0.42).normalize();
const fogDay = new THREE.Fog('#c4e2fb', 90, 420);
scene.fog = fogDay;

// ---------------- sets ----------------
const town = buildTown(scene);
const CUT_AT = [400, 0, 0], TUN_AT = [-400, 0, 0];
const cut = buildCutaway(scene, CUT_AT);
const tunnel = buildTunnel(scene, TUN_AT);
const river = buildRiver(scene);
river.userData.plant.position.x = 8;
const TU = town.userData, CU = cut.userData, RU = river.userData, NU = tunnel.userData;
scene.updateMatrixWorld(true);

// hero house / window
const hero = TU.hero, HI = hero.userData.info, SP = HI.special;
const HW = hero.localToWorld(V3(SP.x, SP.y, SP.z));       // window centre (world)
const SPOT = V3(HW.x + 1.55, 0, HW.z + 0.25);               // where the walker gets hit
// shutters
const shutters = [];
for (const s of [-1, 1]) {
  const hinge = grp(SP.win, s * SP.ww / 2, SP.oy, 0.06);
  mesh(rbox(SP.ww / 2, SP.wh, 0.08, 0.03), mat('#ffffff', { map: TEX.planks, rough: 0.7 }), { parent: hinge, pos: [-s * SP.ww / 4, 0, 0] });
  mesh(box(SP.ww / 2 - 0.1, 0.08, 0.1), mat('#5a3a22'), { parent: hinge, pos: [-s * SP.ww / 4, 0.3, 0.03] });
  mesh(box(SP.ww / 2 - 0.1, 0.08, 0.1), mat('#5a3a22'), { parent: hinge, pos: [-s * SP.ww / 4, -0.3, 0.03] });
  shutters.push({ hinge, s });
}
const setShutters = (k) => { for (const { hinge, s } of shutters) hinge.rotation.y = s * 2.55 * k; };

// ---------------- cast ----------------
const actors = [];
const reg = (o, parent = scene) => { parent.add(o); actors.push(o); o.visible = false; return o; };
const windowMan = reg(makePerson({ tunic: false, shirt: '#efe7d6', pants: '#d6cbb5', hair: '#8a5a35', hat: 'nightcap', mustache: true, skin: '#f5c39c' }), hero);
const bucket = makeBucket(); hero.add(bucket);
const bucketPoop = makePoop(false, 0.9); bucketPoop.position.set(0, 0.25, 0); bucket.add(bucketPoop);
const walker = reg(makePerson({ shirt: '#3f7fd0', pants: '#5a4632', hair: '#5b3a22', shoes: '#3b2a20' }));
const headPoop = makePoop(true, 1.05); headPoop.visible = false; walker.userData.head.add(headPoop); headPoop.position.set(0, 0.4, -0.02);
const lady = reg(makePerson({ shirt: '#e0628f', pants: '#b34a72', hairStyle: 'bun', hair: '#9a5a2a', hat: 'kerchief', hatColor: '#ffd1e0', tunic: true }));
const fanGuy = reg(makePerson({ shirt: '#5cb85c', pants: '#4a5a3a', hair: '#3b2a1a', hairStyle: 'spiky' }));
const diggers = [0, 1, 2].map(i => { const p = reg(makePerson({ shirt: ['#e3843a', '#d9c34a', '#c45a3a'][i], pants: '#5b4a3a', hat: 'cap', hatColor: ['#c4452f', '#8a5a35', '#3f6e9c'][i], apron: '#a0703f' })); const s = makeShovel(); p.add(s); p.userData.shovel = s; return p; });
const panickers = [0, 1].map(i => reg(makePerson({ shirt: ['#9b59b6', '#f0ad4e'][i], pants: '#3d4d70', hair: ['#2a1a10', '#c9772f'][i], hairStyle: i ? 'spiky' : 'cap' })));
const tubGuy = reg(makePerson({ shirt: '#e74c3c', pants: '#34495e', hair: '#5b3a22', hat: 'cap', hatColor: '#2c3e50' }));
const tub = reg(grp(null)); mesh(cyl(1.0, 0.8, 0.8, 28, true), mat('#ffffff', { side: THREE.DoubleSide, map: TEX.planks }), { parent: tub, pos: [0, 0.4, 0] }); mesh(cyl(0.8, 0.8, 0.05, 28), mat('#8a5a35'), { parent: tub, pos: [0, 0.03, 0] });
for (const y of [0.15, 0.65]) mesh(torus(0.82 + y * 0.22, 0.04, Math.PI * 2, 6, 28), mat('#555a60', { metal: 0.5 }), { parent: tub, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
const toiletGuy = reg(makePerson({ shirt: '#f5f0e0', pants: '#7a8aa0', hair: '#b06a2a', hat: 'nightcap', skin: '#f6c7a0' }), cut);
const paper = mesh(new THREE.PlaneGeometry(0.75, 0.95), new THREE.MeshStandardMaterial({ map: TEX.newspaper, side: THREE.DoubleSide, roughness: 0.9 }), { parent: toiletGuy.userData.torso, pos: [0, 0.75, 0.75], rot: [-0.25, 0, 0] });
const extras = [0, 1, 2, 3].map(i => reg(makePerson({ shirt: ['#16a085', '#e67e22', '#8e44ad', '#2980b9'][i], pants: ['#2c3e50', '#5b4a3a', '#3d4d70', '#6b4a2a'][i], hair: ['#2a1a10', '#c9772f', '#6b4426', '#3b2a1a'][i], hairStyle: ['cap', 'spiky', 'long', 'cap'][i], hat: [null, null, 'kerchief', 'hood'][i], hatColor: [null, null, '#ffe08a', '#7b8f3a'][i] })));
const beanCols = ['#e74c8c', '#3fa7d6', '#59cd90', '#fac05e', '#f79d84', '#9b5de5', '#00bbf9', '#f15bb5', '#fee440', '#00f5d4', '#ff6b6b', '#4ecdc4', '#ffa94d', '#748ffc', '#69db7c'];
const skins = ['#f6c7a0', '#e9b48a', '#f8d2b0', '#d9a07a', '#f3c19a'];
const beans = Array.from({ length: 46 }, (_, i) => reg(makeBean(beanCols[i % beanCols.length], skins[i % skins.length], i)));
const streetPoops = (() => { const R = rng(31); return Array.from({ length: 40 }, (_, i) => {
  const p = reg(makePoop(i % 7 === 0, 0.85 + R() * 0.4)); let x = (R() - 0.5) * 9.2; if (Math.abs(x) < 1.3) x = Math.sign(x || 1) * (1.3 + R() * 2);
  p.userData.home = V3(x, 0, 14 - R() * 38); p.userData.rot = R() * 6; p.userData.seed = R(); return p; }); })();
const flying = [0, 1, 2].map(() => reg(makePoop(false, 0.9)));
const bigPoop = reg(makePoop(true, 1.6));
const flies = Array.from({ length: 26 }, () => reg(makeFly()));
const fish = RU.fish;
for (const f of fish) actors.push(f);
actors.push(...CU.workers, CU.tunWorker);

// stink lines
const stinkMat = new THREE.MeshStandardMaterial({ color: '#9be36b', emissive: '#6fbf3a', emissiveIntensity: 0.4, transparent: true, opacity: 0.75, roughness: 0.5 });
const stinkGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => V3(Math.sin(i * 1.6) * 0.14, i * 0.11, 0))), 48, 0.032, 8);
const stinks = Array.from({ length: 9 }, () => reg(mesh(stinkGeo, stinkMat, { cast: false })));

// ---------------- particles ----------------
function instPool(geo, material, n) {
  const im = new THREE.InstancedMesh(geo, material, n); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = false; scene.add(im);
  return im;
}
const DUMMY = new THREE.Object3D();
const pools = {
  brown: instPool(sphere(1, 12, 8), mat('#7a4a28', { rough: 0.35 }), 600),
  dirt: instPool(rbox(1, 1, 1, 0.3, 2), mat('#8a5a36', { rough: 0.9 }), 600),
  dust: instPool(sphere(1, 12, 8), mat('#e9e2d4', { rough: 1, opacity: 0.85 }), 400),
  water: instPool(sphere(1, 10, 6), mat('#cfeeff', { rough: 0.1, opacity: 0.85 }), 900),
  bubble: instPool(sphere(1, 12, 8), mat('#f4fbff', { rough: 0.05, opacity: 0.8 }), 900),
  confetti: instPool(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 }), 900),
  spark: instPool(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#fff6b0' }), 200),
  rain: instPool(capsule(0.016, 0.7, 2, 4), new THREE.MeshBasicMaterial({ color: '#d8e8f5', transparent: true, opacity: 0.55, depthWrite: false }), 1800),
};
pools.dust.castShadow = false; pools.spark.castShadow = false; pools.rain.castShadow = false; pools.bubble.castShadow = false; pools.water.castShadow = false;
const confCols = ['#ff5a5a', '#ffd23f', '#3fa7ff', '#5fd35f', '#ff8ad1', '#ffffff', '#b07bff'].map(c => new THREE.Color(c));
const petalCols = ['#ff9ec7', '#ffffff', '#ffd1e6', '#ff7ab0'].map(c => new THREE.Color(c));
function put(pool, p, s, rot) {
  if (pool.count >= pool.instanceMatrix.count) return -1;
  DUMMY.position.copy(p); DUMMY.rotation.set(rot?.x || 0, rot?.y || 0, rot?.z || 0);
  typeof s === 'number' ? DUMMY.scale.setScalar(Math.max(1e-4, s)) : DUMMY.scale.copy(s);
  DUMMY.updateMatrix(); pool.setMatrixAt(pool.count, DUMMY.matrix); return pool.count++;
}
// ballistic burst: deterministic per (seed)
function burst(pool, t, t0, origin, o) {
  const life = o.life ?? 1.2; if (t < t0 || t > t0 + life) return;
  const R = rng(o.seed ?? Math.round(t0 * 1000)); const dt = t - t0, n = o.n ?? 16, g = o.g ?? -12;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, el = lerp(o.elMin ?? 0.3, o.elMax ?? 1.2, R()), sp = (o.speed ?? 4) * (0.5 + R() * 0.7);
    const dir = o.dir ? V3(...o.dir) : V3(0, 0, 0);
    const v = V3(Math.cos(a) * Math.cos(el) * sp + dir.x, Math.sin(el) * sp + dir.y, Math.sin(a) * Math.cos(el) * sp + dir.z);
    const p = origin.clone().addScaledVector(v, dt); p.y += 0.5 * g * dt * dt;
    if (o.floor !== undefined && p.y < o.floor) p.y = o.floor;
    const sz = (o.size ?? 0.1) * (0.6 + R() * 0.8) * (o.shrink ? 1 - dt / life : 1);
    put(pool, p, sz, { x: R() * 6 + dt * 5, y: R() * 6, z: dt * 3 });
  }
}
function puff(t, t0, origin, o = {}) {   // expanding dust cloud
  const life = o.life ?? 0.9; if (t < t0 || t > t0 + life) return;
  const R = rng(o.seed ?? Math.round(t0 * 777)); const k = (t - t0) / life, n = o.n ?? 10;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r = (o.r ?? 1) * easeOut(k) * (0.6 + R() * 0.6);
    const p = origin.clone().add(V3(Math.cos(a) * r, (o.up ?? 0.4) * easeOut(k) * (0.5 + R()), Math.sin(a) * r));
    put(pools.dust, p, (o.size ?? 0.35) * (0.6 + R() * 0.5) * Math.sin(Math.PI * Math.min(1, k * 1.15)));
  }
}
function sparkles(t, center, spread, n, seed, size = 0.12) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const per = 0.8 + R() * 0.6, ph = R() * per, k = ((t + ph) % per) / per;
    const p = center.clone().add(V3((R() - 0.5) * spread.x, (R() - 0.5) * spread.y + k * 0.4, (R() - 0.5) * spread.z));
    put(pools.spark, p, size * Math.sin(Math.PI * k), { x: 0, y: t * 3 + i, z: 0.3 });
  }
}
function confetti(t, t0, center, spread, n, seed, cols = confCols, size = 0.16) {
  if (t < t0) return; const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const delay = R() * 2.5, dt = t - t0 - delay; if (dt < 0) continue;
    const fall = 1.6 + R() * 1.2, y = center.y + spread.y - dt * fall;
    if (y < 0.05) continue;
    const p = V3(center.x + (R() - 0.5) * spread.x + Math.sin(dt * 2 + i) * 0.4, y, center.z + (R() - 0.5) * spread.z + Math.cos(dt * 1.7 + i) * 0.3);
    if (p.distanceTo(camState.p) < 3.0) continue;
    const idx = put(pools.confetti, p, size, { x: dt * (3 + R() * 4), y: dt * 2 + i, z: dt * 3 });
    if (idx >= 0) pools.confetti.setColorAt(idx, cols[i % cols.length]);
  }
}
function bubbles(t, center, rx, rz, n, seed, h = 0.6, size = 0.12) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const per = 0.5 + R() * 0.7, k = ((t + R() * per) % per) / per;
    const a = R() * Math.PI * 2, r = Math.sqrt(R());
    const p = center.clone().add(V3(Math.cos(a) * r * rx, k * h, Math.sin(a) * r * rz));
    put(pools.bubble, p, size * (0.5 + R()) * (k < 0.85 ? 1 : (1 - k) / 0.15 * 1.4));
  }
}
function rain(t, center) {
  const R = rng(99);
  for (let i = 0; i < 1600; i++) {
    const x = center.x + (R() - 0.5) * 34, z = center.z + (R() - 0.5) * 34, H = 16, off = R() * H;
    const y = center.y + H - ((t * 24 + off) % H);
    put(pools.rain, V3(x, y, z), 1, { x: 0.08, y: 0, z: 0.05 });
  }
}

// ---------------- world state (functions of absolute time) ----------------
const TL = { s1b: 1.85, s1c: 4.25, s1d: 5.45, s2a: 7.10, s2b: 9.0, s3a: 11.2, s3b: 13.9, s4a: 16.2, s4b: 18.4, s5: 21.3,
  s6a: 24.2, s6b: 26.0, s7: 27.9, s8a: 30.85, s8b: 33.6, s9a: 35.9, s9b: 38.6, s10a: 40.85, s10b: 43.55, s10c: 45.6,
  s11a: 47.65, s11b: 50.5, s11c: 51.55, s11d: 53.0, s12: 55.4, end: 60 };
const DIG0 = 11.35, DIG1 = 13.55;
const nSeg = TU.cover.length;
const segDigTime = (i) => lerp(DIG0, DIG1, i / (nSeg - 1));       // i=0 nearest (z=+38.5)
const SLAB0 = 21.5, SLAB1 = 23.3;
const slabTime = (s) => s.userData.z < -30 ? 21.0 : lerp(SLAB0, SLAB1, clamp((s.userData.z + 30) / 44));  // far -> near

function updateTown(t) {
  // ditch cover
  for (let i = 0; i < nSeg; i++) {
    const c = TU.cover[i], td = segDigTime(i);
    c.visible = t < td + 0.05;
    c.position.y = -0.15 - (t > td - 0.08 ? easeIn(range(t, td - 0.08, td + 0.05)) * 0.6 : 0);
  }
  // liquid level / flood
  let y = -0.6;
  if (t >= TL.s4a && t < TL.s5) y = lerp(-0.6, 0.06, easeInOut(range(t, 16.4, 18.0))) + easeOut(range(t, 18.0, 19.6)) * 0.3;
  TU.liquid.position.y = y + Math.sin(t * 3) * 0.01;
  TU.liquid.visible = t >= DIG0 && t < 60;
  TU.liquidMat.map.offset.y = t * 0.35;
  // slabs
  for (const s of TU.slabs) {
    const ts = slabTime(s);
    s.visible = t >= ts - 0.25 && t >= TL.s5;
    s.position.y = 0.11 + (t < ts ? easeIn(1 - range(t, ts - 0.25, ts)) * 6 : 0) + (t >= ts ? Math.sin(range(t, ts, ts + 0.18) * Math.PI) * 0.08 : 0);
    if (t >= TL.end || t >= 24.0) { s.visible = true; s.position.y = 0.11; }
  }
  TU.festive.visible = t >= TL.s11c; TU.bannerG.visible = t >= TL.s11c;
  setShutters(0);
}

// ---------------- helpers for posing ----------------
const show = (...a) => a.forEach(o => { o.visible = true; });
function place(p, x, y, z, ry = 0) { p.position.set(x, y, z); p.rotation.set(0, ry, 0); }
function toTorso(p, world) { p.updateMatrixWorld(true); return p.userData.torso.worldToLocal(world.clone()).toArray(); }
function beanWalk(b, x, z, ry, t, speed = 1) {
  b.visible = true; b.position.set(x, 0, z); b.rotation.set(0, ry, 0); b.userData.idle(t);
  const bb = b.userData.b; bb.position.y = Math.abs(Math.sin(t * 7 * speed + b.userData.seed)) * 0.12; bb.rotation.z = Math.sin(t * 7 * speed + b.userData.seed) * 0.08;
}
function pinchNose(p, s = 1) { p.userData.reach(s, [0.02 * s, 1.36, 0.66], [s, -1.2, 0.2]); }
function armsUp(p, t, k = 1) { for (const s of [-1, 1]) p.userData.reach(s, [0.55 * s + Math.sin(t * 12 + s) * 0.1, 1.95 * k, 0.15], [s, 0, -1]); }
function shovelPose(p, ph) {   // digging motion, shovel in both hands
  const ud = p.userData; const k = (Math.sin(ph) + 1) / 2;
  ud.torso.rotation.x = 0.2 + (1 - k) * 0.4; ud.torso.rotation.y = -0.2 + k * 0.4;
  ud.reach(1, [0.3, 0.35 + k * 0.45, 0.6], [1, -0.5, -1]); ud.reach(-1, [0.05, 0.8 + k * 0.55, 0.4], [-1, -0.5, -1]);
  p.updateMatrixWorld(true);
  const hR = ud.arms[1].hand.getWorldPosition(V3()), hL = ud.arms[-1].hand.getWorldPosition(V3());
  p.worldToLocal(hR); p.worldToLocal(hL);
  const d = hL.clone().sub(hR).normalize(), sh = ud.shovel;
  sh.quaternion.setFromUnitVectors(V3(0, 1, 0), d); sh.position.copy(hR).addScaledVector(d, -0.5);
  return k;
}
function sit(p) {
  const ud = p.userData;
  for (const s of [-1, 1]) { ud.legs[s].leg.rotation.x = -Math.PI / 2; ud.legs[s].knee.rotation.x = Math.PI / 2; }
  ud.body.position.y = -0.5;
}

// ---------------- camera helpers ----------------
const camState = { p: V3(), l: V3(), fov: 45, roll: 0 };
function camLerp(lt, a, b, ease = easeInOut) {
  const k = ease(lt);
  camState.p.set(...a.p.map((v, i) => lerp(v, b.p[i], k)));
  camState.l.set(...a.l.map((v, i) => lerp(v, b.l[i], k)));
  camState.fov = lerp(a.fov ?? 45, b.fov ?? a.fov ?? 45, k); camState.roll = 0;
}
function shake(t, amp, seed = 1) {
  camState.p.x += noise1(t * 18, seed) * amp; camState.p.y += noise1(t * 18, seed + 7) * amp; camState.l.x += noise1(t * 15, seed + 3) * amp * 0.6;
}
function handheld(t, amp = 0.03) { shake(t * 0.25, amp, 4); }
function shadowAt(x, y, z, size) {
  sun.target.position.set(x, y, z); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 80);
  const c = sun.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = 1; c.far = 200; c.updateProjectionMatrix();
}

// ---------------- environment presets ----------------
function envDay() {
  skyU.top.value.set('#529fe8'); skyU.bot.value.set('#cfe9ff'); hemi.color.set('#d6ebff'); hemi.groundColor.set('#7d6b4f');
  hemi.intensity = 1.35; sun.intensity = 2.9; sun.color.set('#fff0d6'); scene.fog = fogDay; cloudMat.color.set('#ffffff'); cloudMat.emissive.set('#ffffff');
  sky.visible = clouds.visible = true; renderer.toneMappingExposure = 1.08;
}
function envRain(t) {
  envDay(); const k = smooth(range(t, TL.s4a, TL.s4a + 0.4));
  skyU.top.value.lerp(new THREE.Color('#4a5568'), k); skyU.bot.value.lerp(new THREE.Color('#8c97a6'), k);
  hemi.intensity = lerp(1.35, 0.95, k); sun.intensity = lerp(2.9, 0.9, k); cloudMat.color.lerp(new THREE.Color('#7d8794'), k); cloudMat.emissive.lerp(new THREE.Color('#5d6774'), k);
  const flash = Math.max(0, 1 - Math.abs(t - 16.42) / 0.06) + Math.max(0, 1 - Math.abs(t - 19.3) / 0.05) * 0.7;
  hemi.intensity += flash * 3; skyU.top.value.lerp(new THREE.Color('#e8f0ff'), flash * 0.7);
  scene.fog = new THREE.Fog('#9aa6b4', 25, 160);
}
function envTunnel() {
  sky.visible = clouds.visible = false; hemi.intensity = 0.12; hemi.color.set('#a08060'); hemi.groundColor.set('#201008'); sun.intensity = 0;
  scene.fog = new THREE.Fog('#120a05', 6, 38); renderer.toneMappingExposure = 0.95;
}

// ---------------- SHOTS ----------------
// each shot: [t0, t1, fn(t, lt, T0, T1)]; lt = local 0..1
const shots = [];
const shot = (t0, t1, fn) => shots.push({ t0, t1, fn });

// --- 1a establishing street
shot(0, TL.s1b, (t, lt) => {
  camLerp(lt, { p: [3.0, 2.6, 19.5], l: [-1.4, 3.4, -4], fov: 50 }, { p: [2.3, 2.9, 15.5], l: [-1.6, 3.6, -4], fov: 50 });
  shadowAt(0, 0, 4, 22);
  walkerWalk(t);
  pedestrians(t, 0);
  for (let i = 0; i < 7; i++) { const p = streetPoops[i]; show(p); p.position.copy(p.userData.home); p.rotation.y = p.userData.rot; }
  windowManState(t);
});
function walkerWalk(t) {
  show(walker); const ud = walker.userData; ud.reset();
  const z = lerp(9.5, SPOT.z, clamp(t / 5.1));
  place(walker, SPOT.x, 0, z, Math.PI);
  if (t < 5.1) ud.walk(t * 7.5, 1); else ud.walk(0, 0);
  ud.face.set('smile');
}
function pedestrians(t, mode) {
  const R = rng(3);
  for (let i = 0; i < 8; i++) {
    const b = beans[i]; const dir = i % 2 ? 1 : -1, x = (i % 4 - 1.5) * 1.9 + 0.3, z0 = 6 - R() * 30;
    const z = z0 + dir * t * 1.3;
    beanWalk(b, x, z, dir > 0 ? 0 : Math.PI, t);
  }
}
function windowManState(t, mode = 'throw') {
  const ud = windowMan.userData; show(windowMan); ud.reset();
  windowMan.position.set(SP.x, 3.2, SP.z - 0.92); windowMan.rotation.set(0, 0, 0);
  bucket.visible = mode === 'throw';
  if (mode === 'throw') {
    const open = easeOutBack(range(t, 2.0, 2.3), 2.2);
    setShutters(open);
    const lean = lerp(0, 0.48, easeOutBack(range(t, 2.15, 2.55))) + (t > 4.3 && t < 5.1 ? Math.sin(range(t, 4.3, 5.1) * Math.PI) * 0.12 : 0);
    ud.body.rotation.x = lean;
    const tip = easeInOut(range(t, 4.72, 4.98)) * 1.9;
    bucket.position.set(SP.x, 4.27 + Math.sin(tip / 1.9 * Math.PI) * 0.25, SP.z + 0.88 + tip * 0.15);
    bucket.rotation.set(tip, 0, 0);
    bucket.visible = t > 2.15;
    bucketPoop.visible = t < 4.86;
    windowMan.updateMatrixWorld(true); bucket.updateMatrixWorld(true);
    for (const s of [-1, 1]) {
      const rim = bucket.localToWorld(V3(0.38 * s, 0.42, 0));
      ud.reach(s, toTorso(windowMan, rim), [s, -1, -0.5]);
    }
    const f = t < 4.3 ? (t > 2.6 && t < 3.6 ? 'happy' : 'smile') : t < 5.15 ? 'shout' : 'happy';
    ud.face.set(f, 1 + Math.sin(t * 30) * 0.08);
    ud.face.look(t < 4.3 ? Math.sin(t * 2.5) * 0.6 : 0.3, t < 4.3 ? 0 : -0.6);
    ud.head.rotation.y = t < 4.3 ? Math.sin(t * 2.2) * 0.25 : 0.25;
    ud.head.rotation.x = t > 4.4 ? 0.3 : 0;
  }
}
// --- 1b window close-up
shot(TL.s1b, TL.s1c, (t, lt) => {
  const c = HW;
  camLerp(lt, { p: [c.x + 5.0, c.y + 0.1, c.z + 2.4], l: [c.x + 0.5, c.y - 0.15, c.z], fov: 44 }, { p: [c.x + 4.3, c.y + 0.05, c.z + 1.9], l: [c.x + 0.5, c.y - 0.15, c.z], fov: 44 });
  shadowAt(c.x, c.y, c.z, 8);
  windowManState(t);
});
// --- 1c look-up: "Look out below!"
shot(TL.s1c, TL.s1d, (t, lt) => {
  const c = HW;
  camLerp(lt, { p: [c.x + 4.6, 1.6, c.z - 2.6], l: [c.x + 0.6, c.y + 0.2, c.z + 0.1], fov: 50 }, { p: [c.x + 4.3, 1.5, c.z - 2.3], l: [c.x + 0.7, c.y, c.z + 0.1], fov: 48 });
  if (t > 4.7) shake(t, 0.03);
  shadowAt(c.x, 2, c.z, 10);
  windowManState(t); throwPoops(t);
});
function throwPoops(t) {
  const start = bucket.parent.localToWorld(V3(SP.x, 4.75, SP.z + 1.1));
  const head = V3(SPOT.x, 3.35, SPOT.z);
  const targets = [head, V3(SPOT.x + 0.9, 0, SPOT.z + 0.7), V3(SPOT.x - 0.4, 0, SPOT.z - 1.0)];
  const t0s = [4.86, 4.9, 4.94], t1s = [5.62, 5.72, 5.8];
  flying.forEach((p, i) => {
    const t0 = t0s[i], t1 = t1s[i];
    if (t < t0) return;
    show(p);
    if (t < t1) {
      const u = range(t, t0, t1), q = start.clone().lerp(targets[i], u); q.y += Math.sin(u * Math.PI) * 0.8 + (i ? 0 : 0);
      p.position.copy(q); p.rotation.set(u * 5 + i, u * 3, u * 4); p.scale.setScalar(0.9);
      if (i === 0 && t > 5.6) p.visible = false;
    } else {
      if (i === 0) { p.visible = false; return; }
      p.position.copy(targets[i]); p.rotation.set(0, i, 0);
      const sq = range(t, t1, t1 + 0.25); p.scale.set(0.9 * (1 + Math.sin(sq * Math.PI) * 0.3), 0.9 * (1 - Math.sin(sq * Math.PI) * 0.35), 0.9 * (1 + Math.sin(sq * Math.PI) * 0.3));
    }
  });
  burst(pools.brown, t, 5.62, head.clone().add(V3(0, 0.3, 0)), { n: 18, speed: 3.2, size: 0.05, life: 1.3, g: -11, floor: 0.03, seed: 7 });
  burst(pools.brown, t, 5.72, targets[1], { n: 10, speed: 2.2, size: 0.05, life: 0.9, floor: 0.03, seed: 8 });
  burst(pools.brown, t, 5.8, targets[2], { n: 10, speed: 2.2, size: 0.05, life: 0.9, floor: 0.03, seed: 9 });
}
// --- 1d splash on walker
shot(TL.s1d, TL.s2a, (t, lt) => {
  const h = V3(SPOT.x, 3.0, SPOT.z);
  const k = easeOut(range(t, 5.62, 5.85));
  camState.p.set(lerp(h.x + 2.4, h.x + 1.6, k), lerp(3.3, 3.25, k), lerp(h.z - 6.0, h.z - 4.4, k));
  camState.l.set(h.x - 0.1, lerp(3.2, 3.0, k), h.z); camState.fov = 45;
  if (t > 5.62) shake(t, 0.07 * (1 - range(t, 5.62, 6.3)));
  shadowAt(h.x, 1, h.z, 8);
  windowManState(t); throwPoops(t);
  const ud = walker.userData; show(walker); ud.reset(); place(walker, SPOT.x, 0, SPOT.z, Math.PI);
  const hit = t >= 5.62;
  headPoop.visible = hit;
  if (hit) { const sq = range(t, 5.62, 5.9); headPoop.scale.set(1.05 * (1 + Math.sin(sq * Math.PI) * 0.35), 1.05 * (1 - Math.sin(sq * Math.PI) * 0.4), 1.05); }
  if (!hit) { ud.head.rotation.x = -0.55; ud.face.set('shock'); ud.face.look(0, 1); }
  else {
    const k2 = easeOutBack(range(t, 5.62, 5.85));
    ud.head.rotation.x = lerp(-0.25, 0.05, k2); ud.hips.position.y = 1.155 - Math.sin(range(t, 5.62, 5.8) * Math.PI) * 0.12;
    if (t < 6.15) { ud.face.set('shock'); ud.face.look(0, 0); }
    else ud.face.set('squint', 1.1);
    for (const s of [-1, 1]) ud.reach(s, [0.85 * s, 0.75 + Math.sin(t * 20 + s) * 0.05, 0.25], [s, -1, -1]);
    ud.body.rotation.z = t > 6.15 ? Math.sin(t * 22) * 0.03 : 0;
  }
});

// --- 2a top-down: street full of poop
shot(TL.s2a, TL.s2b, (t, lt) => {
  camLerp(lt, { p: [0.4, 15.5, 4.5], l: [0, 0, -3.4], fov: 44 }, { p: [0.2, 14.2, 3.4], l: [0, 0, -3.8], fov: 44 });
  shadowAt(0, 0, -3, 14);
  streetPoopsOn(t);
  tiptoe(t);
  fliesAround(t, 18);
});
function streetPoopsOn(t) { for (const p of streetPoops) { show(p); p.position.copy(p.userData.home); p.rotation.set(0, p.userData.rot, 0); p.scale.setScalar(p.userData.s0 ?? (p.userData.s0 = p.scale.x)); } }
function tiptoe(t) {
  const people = [[lady, -2.2, -1.5, 0.6], [fanGuy, 1.6, -6.5, -0.4], [extras[0], 2.4, 1.2, 2.6], [extras[1], -1.6, -9, 0.2]];
  people.forEach(([p, x, z, ry], i) => {
    show(p); const ud = p.userData; ud.reset();
    const prog = Math.sin(t * 1.4 + i) * 0.6;
    place(p, x + Math.sin(ry) * prog, Math.abs(Math.sin(t * 6 + i)) * 0.25, z + Math.cos(ry) * prog, ry);
    ud.walk(t * 6 + i, 1.2); pinchNose(p, i % 2 ? 1 : -1);
    ud.reach(i % 2 ? -1 : 1, [(i % 2 ? -1 : 1) * 0.9, 1.2, 0.2], [0, -1, -1]);
    ud.face.set('disgust');
  });
  for (let i = 0; i < 5; i++) { const b = beans[10 + i]; const x = [-3.6, 3.3, -0.2, 3.8, -3.0][i], z = [-12, -2, 4, -14, 6][i]; beanWalk(b, x, z + Math.sin(t + i) * 0.5, i * 1.3, t, 1.6); b.userData.panic(t * 0.3); }
}
function fliesAround(t, n, anchors) {
  for (let i = 0; i < n; i++) {
    const f = flies[i]; show(f);
    const a = anchors ? anchors[i % anchors.length] : streetPoops[(i * 3) % streetPoops.length].position;
    const ph = t * (3 + (i % 4)) + i * 1.7, r = 0.5 + (i % 3) * 0.25;
    f.position.set(a.x + Math.cos(ph) * r + noise1(t * 3, i) * 0.2, a.y + 0.9 + Math.sin(ph * 1.7) * 0.3 + (i % 2) * 0.4, a.z + Math.sin(ph) * r);
    f.rotation.y = -ph; f.userData.flap(t + i); f.scale.setScalar(1.3);
  }
}
// --- 2b stinky close-up
shot(TL.s2b, TL.s3a, (t, lt) => {
  const L = V3(1.4, 0, -12);
  camLerp(lt, { p: [L.x + 0.2, 2.9, L.z + 6.2], l: [L.x + 0.3, 2.0, L.z], fov: 48 }, { p: [L.x + 0.25, 2.85, L.z + 5.4], l: [L.x + 0.3, 2.05, L.z], fov: 48 });
  shadowAt(L.x, 0, L.z, 9);
  streetPoopsOn(t);
  show(lady); const ud = lady.userData; ud.reset(); place(lady, L.x, 0, L.z, 0.1);
  pinchNose(lady, 1); ud.reach(-1, [-0.75 + Math.sin(t * 14) * 0.15, 1.3, 0.45], [-1, -1, -0.3]);
  ud.face.set('disgust'); ud.body.rotation.z = Math.sin(t * 9) * 0.04; ud.head.rotation.z = Math.sin(t * 7) * 0.08;
  show(fanGuy); const fu = fanGuy.userData; fu.reset(); place(fanGuy, L.x - 2.6, 0, L.z - 3.2, 0.5);
  fu.reach(1, [0.35 + Math.sin(t * 16) * 0.25, 1.5, 0.65], [1, -1, -0.5]); fu.reach(-1, [-0.02, 1.36, 0.66], [-1, -1.2, 0.2]); fu.face.set('squint');
  show(bigPoop); bigPoop.position.set(L.x + 0.95, 0, L.z + 1.7); bigPoop.rotation.y = -0.35;
  const base = bigPoop.position;
  stinks.forEach((s, i) => {
    const per = 1.4, k = ((t + i * per / 9) % per) / per;
    show(s); s.position.set(base.x + (i % 3 - 1) * 0.35, base.y + 0.8 + k * 1.6, base.z + (Math.floor(i / 3) - 1) * 0.25);
    s.scale.setScalar(Math.sin(k * Math.PI) * 1.1); s.rotation.y = i;
  });
  fliesAround(t, 9, [V3(L.x, 2.2, L.z), base]);
});

// --- 3a DITCH: digging
shot(TL.s3a, TL.s3b, (t, lt) => {
  camLerp(lt, { p: [3.3, 2.7, 26.5], l: [0.2, 0.4, 14], fov: 50 }, { p: [3.0, 3.1, 25], l: [0.1, 0.3, 10], fov: 50 });
  shadowAt(0, 0, 8, 20);
  for (const p of streetPoops) { if (p.userData.home.z > -20) { show(p); p.position.copy(p.userData.home); p.rotation.y = p.userData.rot; } }
  const spots = [[17.5, 0], [2.0, 1], [-14, 2]];
  spots.forEach(([z, i]) => {
    const d = diggers[i]; show(d); const ud = d.userData; ud.reset();
    const segI = Math.round((STREET.z1 - 1.5 - z) / 3), td = segDigTime(segI);
    const inDitch = t > td;
    place(d, 0, inDitch ? -0.95 : 0, z, Math.PI / 2 * (i % 2 ? -1 : 1));
    const k = shovelPose(d, t * 9 + i);
    ud.face.set(k > 0.7 ? 'squint' : 'smile');
    for (let j = 0; j < 4; j++) {
      const t0 = Math.floor(t * 4.5) / 4.5 - j / 4.5;
      if (t0 < TL.s3a) continue;
      burst(pools.dirt, t, t0, V3(0, 0.3, z), { n: 3, speed: 3.6, dir: [(i % 2 ? 1 : -1) * 2.2, 2, 0], size: 0.14, life: 0.8, floor: 0.05, seed: Math.round(t0 * 100) + i });
    }
  });
  for (let i = 0; i < nSeg; i++) { const td = segDigTime(i); puff(t, td, V3(0, 0.1, STREET.z1 - 1.5 - i * 3), { r: 1.0, size: 0.35, n: 6, life: 0.6 }); }
});
// --- 3b poop flows away
const flowStart = (p) => 13.95 + (p.userData.seed) * 0.9;
shot(TL.s3b, TL.s4a, (t, lt) => {
  camLerp(lt, { p: [2.6, 8.4, 7.0], l: [0, -0.5, -5.5], fov: 46 }, { p: [2.3, 7.4, 5.2], l: [0, -0.5, -7], fov: 46 });
  shadowAt(0, 0, -4, 14);
  poopFlow(t);
  for (let i = 0; i < 4; i++) { const b = beans[20 + i]; beanWalk(b, [-3.3, 3.4, -3.8, 3.0][i], [-2, -6, -11, 1][i] + Math.sin(t + i), i % 2 ? Math.PI * 0.5 : -Math.PI * 0.5, t); }
});
function poopFlow(t) {
  for (const p of streetPoops) {
    show(p); const h = p.userData.home, ts = flowStart(p);
    if (t < ts) { p.position.copy(h); p.rotation.set(0, p.userData.rot, 0); continue; }
    const u = range(t, ts, ts + 0.45);
    if (u < 1) {
      p.position.set(lerp(h.x, 0, easeIn(u)), u < 0.75 ? 0 : lerp(0, -0.85, range(u, 0.75, 1)), h.z);
      p.rotation.set(0, p.userData.rot + u * 3, Math.sign(h.x) * -u * 0.6);
    } else {
      const dt = t - ts - 0.45;
      p.position.set(Math.sin(dt * 3 + h.z) * 0.18, -0.82 + Math.sin(dt * 5 + h.x) * 0.04, h.z - dt * 3.2);
      p.rotation.set(Math.sin(dt * 4) * 0.15, p.userData.rot + dt * 1.5, Math.cos(dt * 3) * 0.15);
    }
  }
}
// --- 4a rain + rising water
shot(TL.s4a, TL.s4b, (t, lt) => {
  envRain(t);
  camLerp(lt, { p: [1.9, 1.15, 5.0], l: [-0.2, -0.3, -6], fov: 50 }, { p: [2.1, 1.35, 4.0], l: [-0.2, -0.2, -6], fov: 50 });
  shadowAt(0, 0, -2, 12);
  rain(t, V3(0, 0, -2));
  const lv = TU.liquid.position.y;
  streetPoops.slice(0, 14).forEach((p, i) => { show(p); p.position.set(Math.sin(t * 2 + i) * 0.25, lv - 0.05 + Math.sin(t * 4 + i) * 0.05, 3 - i * 2.2 - (t - TL.s4a) * 0.4); p.rotation.set(Math.sin(t * 3 + i) * 0.2, i, Math.cos(t * 2 + i) * 0.2); });
  for (let i = 0; i < 3; i++) { const b = beans[24 + i]; b.visible = true; b.position.set([-2.6, 2.8, -3.2][i], 0, [-4, -8, -12][i]); b.rotation.y = [0.5, -0.6, 0.2][i]; b.userData.idle(t); if (t > 17.6) b.userData.panic(t); }
  for (let i = 0; i < 40; i++) { const R = rng(i + 3); const x = (R() - 0.5) * 9, z = 2 - R() * 16; const tt = (t * 2 + R() * 3) % 1; if (tt < 0.35) put(pools.water, V3(x, Math.max(0.02, lv) + tt * 0.3, z), 0.05 * (1 - tt / 0.35) + 0.02); }
});
// --- 4b flood panic
shot(TL.s4b, TL.s5, (t, lt) => {
  envRain(t);
  camLerp(lt, { p: [4.6, 4.4, 10.5], l: [0, 0.8, -2], fov: 50 }, { p: [4.2, 3.9, 9.0], l: [0, 0.9, -2.5], fov: 50 });
  shake(t, 0.05, 3);
  shadowAt(0, 0, 0, 14);
  rain(t, V3(0, 0, 0));
  const lv = TU.liquid.position.y;
  streetPoops.slice(0, 22).forEach((p, i) => { show(p); const R = rng(i * 7 + 1); p.position.set((R() - 0.5) * 9 + Math.sin(t + i) * 0.4, lv - 0.12 + Math.sin(t * 4 + i) * 0.06, 6 - R() * 18 + (t - TL.s4b) * 0.7); p.rotation.set(Math.sin(t * 3 + i) * 0.25, i + t * 0.5, Math.cos(t * 2 + i) * 0.25); });
  panickers.forEach((p, i) => {
    show(p); const ud = p.userData; ud.reset();
    const ph = t * 1.6 + i * 2.2; place(p, [-2.0, 2.4][i] + Math.sin(ph) * 1.6, lv - 0.1, [-2.5, 1.0][i] + Math.cos(ph * 0.7) * 1.2, Math.cos(ph) > 0 ? Math.PI / 2 : -Math.PI / 2);
    ud.walk(t * 16 + i, 1.2); armsUp(p, t + i); ud.face.set('squint', 1.2);
    ud.head.rotation.z = Math.sin(t * 12 + i) * 0.15;
  });
  for (let i = 0; i < 6; i++) { const b = beans[24 + i]; b.visible = true; const ph = t * 2 + i; b.position.set([-3.6, 3.5, -1.2, 1.6, -3.1, 3.2][i] + Math.sin(ph) * 0.8, lv - 0.2, [-6, -7, -10, -4, -12, -12][i]); b.rotation.y = Math.sin(ph) * 1.5; b.userData.panic(t); }
  // tub guy drifting past
  const tz = lerp(-7, 5.5, range(t, TL.s4b, TL.s5)), tx = 0.6 + Math.sin(t * 1.5) * 0.4;
  show(tub, tubGuy); tub.position.set(tx, lv - 0.3 + Math.sin(t * 3) * 0.06, tz); tub.rotation.set(Math.sin(t * 2.4) * 0.1, t * 0.8, Math.cos(t * 2) * 0.1);
  const tu = tubGuy.userData; tu.reset(); tubGuy.position.copy(tub.position).add(V3(0, -0.15, 0)); tubGuy.rotation.copy(tub.rotation); sit(tubGuy);
  tu.face.set(Math.floor(t * 2) % 2 ? 'shout' : 'squint'); armsUp(tubGuy, t * 0.6);
  for (let i = 0; i < 30; i++) { const R = rng(i + 50); const x = (R() - 0.5) * 9, z = 4 - R() * 14; const tt = (t * 2 + R() * 3) % 1; if (tt < 0.35) put(pools.water, V3(x, lv + tt * 0.3, z), 0.05 * (1 - tt / 0.35) + 0.02); }
});
// --- 5 covered drain: slabs drop
shot(TL.s5, TL.s6a, (t, lt) => {
  camLerp(lt, { p: [2.2, 1.45, 14.5], l: [0, 0.3, -12], fov: 48 }, { p: [2.4, 1.6, 15.5], l: [0, 0.4, -12], fov: 48 });
  shadowAt(0, 0, 0, 22);
  for (const s of TU.slabs) { const ts = slabTime(s); puff(t, ts, V3(0, 0.15, s.userData.z), { r: 1.6, size: 0.4, n: 10, life: 0.7, up: 0.3 }); }
  const lastNear = slabTime(TU.slabs.find(s => s.userData.z > 11) || TU.slabs[0]);
  if (t > 23.0) shake(t, 0.025 * (1 - range(t, 23.0, 23.6)));
  // happy walker hops on the slabs
  show(walker); const ud = walker.userData; ud.reset();
  const k = range(t, 22.9, 24.2);
  place(walker, -0.1, 0.22 + Math.abs(Math.sin(t * 8)) * 0.15 * (k > 0 ? 1 : 0), lerp(-2.0, 3.8, k), 0);
  if (k > 0) ud.walk(t * 8, 1); ud.face.set('happy'); headPoop.visible = false;
  if (k > 0) { ud.reach(1, [0.6, 1.9, 0.2], [1, 0, -1]); }
  for (let i = 0; i < 4; i++) { const b = beans[30 + i]; beanWalk(b, [-3.4, 3.2, -2.8, 3.6][i], [-6, -10, 2, -16][i] + Math.sin(t + i) * 0.3, [0.4, -0.8, 0.2, 0][i], t); }
});

// --- 6a cutaway: workers dig
const C = (x, y, z) => V3(x + CUT_AT[0], y + CUT_AT[1], z + CUT_AT[2]);
const digX = (t) => lerp(-9, 13, range(t, 24.25, 25.95)) + (t > 25.95 ? 100 : 0);
function cutState(t) {
  for (const f of CU.fill) f.visible = f.userData.x > digX(t) && t < 26.0;
  // pipes pop in left -> right
  for (const p of CU.pipes) {
    const tp = 26.05 + clamp((p.userData.x + 14) / 22, 0, 1.2) * 1.15;
    const k = t >= tp ? easeOutBack(range(t, tp, tp + 0.22), 2) : 0;
    p.visible = t >= tp; p.scale.setScalar(Math.max(0.001, k)); p.position.y = CU.PY + (1 - range(t, tp, tp + 0.15)) * 1.0;
  }
  CU.homes.forEach((h, i) => {
    const tc = 28.35 + i * 0.17; const k = easeOutBack(range(t, tc, tc + 0.3), 1.4);
    h.conn.scale.y = Math.max(0.001, k * h.conn.userData.len); h.conn.visible = t >= tc;
  });
  CU.tunLiquid.map.offset.y = -t * 0.4; CU.flow.visible = t > 28.5; CU.flowMat.map.offset.x = -t * 1.2;
  // tunnel worker in cross-section
  const tw = CU.tunWorker, tu = tw.userData; tu.reset(); tw.position.z = lerp(-11, -3, range(t, 30.85, 33.6)); tu.walk(t * 7, 1); tw.rotation.y = 0;
  tu.reach(1, [0.45, 0.6, 0.5]);
  // flow blobs (only once toilets are connected)
  CU.blobs.forEach((b, j) => {
    const h = CU.homes[(j * 3) % CU.homes.length]; const ts = 28.5 + j * 0.36;
    b.visible = t > ts && t < ts + 8; if (!b.visible) return;
    const dt = t - ts; const down = 0.45;
    if (dt < down) b.position.set(h.x + 1.3, lerp(0.0, CU.PY - 0.2, dt / down), CU.PZ + 0.05);
    else { const x = h.x + 1.3 + (dt - down) * 7.5; b.position.set(x, CU.PY - 0.2 + Math.sin(dt * 9) * 0.04, CU.PZ + 0.05); if (x > CU.TC.x - 2) b.position.y = lerp(CU.PY - 0.2, CU.TC.y - 2.8, clamp((x - (CU.TC.x - 2)) / 2.5)); if (x > CU.TC.x + 3) b.visible = false; }
    b.rotation.set(0, dt * 2, Math.sin(dt * 5) * 0.3);
  });
}
shot(TL.s6a, TL.s6b, (t, lt) => {
  const x = clamp(digX(t), -9, 13) - 1.5;
  camState.p.copy(C(x + 0.5, -2.3, 12.5)); camState.l.copy(C(x + 0.5, -2.6, 0)); camState.fov = 45;
  shadowAt(...C(x, -2, 0).toArray(), 14);
  cutState(t);
  CU.workers.forEach((w, i) => {
    show(w); const ud = w.userData; ud.reset();
    w.position.copy(V3(clamp(digX(t), -9, 13) - 1.3 - i * 2.4, -4.6, -0.75)); w.rotation.set(0, Math.PI / 2, 0);
    const k = shovelPose(w, t * 10 + i * 1.3); ud.face.set(k > 0.6 ? 'squint' : 'happy');
  });
  for (let j = 0; j < 5; j++) {
    const t0 = Math.floor(t * 6) / 6 - j / 6; if (t0 < TL.s6a) continue;
    burst(pools.dirt, t, t0, C(clamp(digX(t0), -9, 13), -3.6, -0.6), { n: 4, speed: 3.5, dir: [-2.5, 1.5, 0.4], size: 0.16, life: 0.9, floor: -4.55, seed: Math.round(t0 * 100) });
  }
});
// --- 6b pipes laid
shot(TL.s6b, TL.s7, (t, lt) => {
  camLerp(lt, { p: [-3.0, -2.2, 15.5], l: [-3.0, -3.3, 0], fov: 45 }, { p: [-2.2, -2.1, 14.5], l: [-2.4, -3.3, 0], fov: 45 });
  camState.p.add(V3(...CUT_AT)); camState.l.add(V3(...CUT_AT));
  shadowAt(...C(0, -2, 0).toArray(), 26);
  cutState(t);
  CU.workers.forEach((w, i) => {
    show(w); const ud = w.userData; ud.reset(); w.position.set(-9.5 + i * 13.5, -4.6, 0.2 - i * 0.3); w.rotation.set(0, i ? -0.4 : 0.4, 0);
    ud.face.set('happy'); ud.reach(i ? -1 : 1, [(i ? -1 : 1) * 0.55, 1.95, 0.3], [i ? -1 : 1, 0, -1]); w.userData.shovel.visible = false;
  });
  for (const p of CU.pipes) { const tp = 26.05 + clamp((p.userData.x + 14) / 22, 0, 1.2) * 1.15; puff(t, tp + 0.12, C(p.userData.x, CU.PY - 0.4, CU.PZ + 0.3), { r: 0.9, size: 0.3, n: 6, life: 0.5, up: 0.2 }); }
});
// --- 7 toilets connect
shot(TL.s7, TL.s8a, (t, lt) => {
  const h = CU.homes[3];
  const k = easeInOut(range(t, 28.85, 30.6));
  camState.p.copy(C(lerp(h.x + 1.3, h.x + 2.5, k), lerp(2.3, -0.8, k), lerp(7.6, 27, k)));
  camState.l.copy(C(lerp(h.x + 1.3, h.x + 2.0, k), lerp(1.7, -1.6, k), lerp(-2.2, -1, k))); camState.fov = 45;
  shadowAt(...C(h.x, -1, 0).toArray(), 26);
  cutState(t);
  for (const w of CU.workers) { w.visible = false; }
  show(toiletGuy); const ud = toiletGuy.userData; ud.reset();
  toiletGuy.position.set(h.x + 1.3, 0.2, -2.15); toiletGuy.rotation.set(0, 0, 0); sit(toiletGuy);
  const pull = range(t, 28.15, 28.5) - range(t, 28.6, 28.9);
  paper.visible = true;
  ud.reach(-1, [-0.32, 0.72, 0.6], [-1, -1, -0.5]);
  if (pull > 0) {
    toiletGuy.updateMatrixWorld(true);
    const ch = h.toilet.userData.chain.localToWorld(V3(0, -0.85, 0));
    ud.reach(1, toTorso(toiletGuy, ch), [1, -1, 0]);
    h.toilet.userData.chain.position.y = 1.9 - pull * 0.25;
  } else { ud.reach(1, [0.32, 0.72, 0.6], [1, -1, -0.5]); h.toilet.userData.chain.position.y = 1.9; }
  ud.face.set(t < 28.15 ? 'smile' : t < 28.9 ? 'happy' : 'joy');
  ud.head.rotation.x = t < 28.1 ? 0.25 : 0; ud.face.look(0, t < 28.1 ? -0.8 : 0);
  // flush swirl
  if (t > 28.4 && t < 29.3) bubbles(t, C(h.x + 1.3, 0.65, -2.1), 0.2, 0.25, 14, 3, 0.15, 0.06);
});
// --- 8a sewer tunnel cross-section
shot(TL.s8a, TL.s8b, (t, lt) => {
  camLerp(lt, { p: [6, -2.8, 18], l: [6, -3.6, 0], fov: 45 }, { p: [24.5, -5.6, 20.5], l: [26, -6.6, 0], fov: 45 }, easeInOut);
  camState.p.add(V3(...CUT_AT)); camState.l.add(V3(...CUT_AT));
  shadowAt(...C(15, -4, 0).toArray(), 26);
  cutState(t);
  show(CU.tunWorker);
});
// --- 8b inside the tunnel
shot(TL.s8b, TL.s9a, (t, lt) => {
  envTunnel();
  const TP = V3(...TUN_AT);
  const wz = lerp(-21, -13.2, range(t, TL.s8b, TL.s9a));
  camState.p.copy(TP.clone().add(V3(0.4, 3.0, wz + 7.0))); camState.l.copy(TP.clone().add(V3(2.1, 2.2, wz))); camState.fov = 46;
  handheld(t, 0.04);
  const w = NU.worker, ud = w.userData; ud.reset();
  w.position.set(2.45, 1.0, wz); w.rotation.set(0, 0, 0);
  ud.walk(t * 7.5, 1); ud.reach(-1, [-0.45, 0.62, 0.55], [-1, -1, -0.5]);
  ud.face.set(t < 34.55 ? 'disgust' : 'happy'); ud.head.rotation.y = t > 34.55 ? -0.25 : 0;
  w.updateMatrixWorld(true);
  const hp = ud.arms[-1].hand.getWorldPosition(V3()); NU.lanternG.position.copy(tunnel.worldToLocal(hp)).add(V3(0, -0.28, 0)); NU.lanternG.rotation.z = Math.sin(t * 7.5) * 0.15;
  NU.liq.map.offset.y = t * 0.5;
  bubbles(t, TP.clone().add(V3(0, 0.36, wz - 4)), 1.2, 6, 30, 11, 0.05, 0.07);
});

// --- RIVER
function riverState(t) {
  // sewage pollution grows from 35.9, clean water restores from 48
  const dirty = smooth(range(t, 36.3, 38.8)) * (1 - smooth(range(t, 48.0, 50.3)));
  RU.waterMat.color.set('#ffffff').lerp(new THREE.Color('#9a7444'), dirty);
  RU.waterMat.map.offset.x = t * 0.05;
  RU.plume.visible = t >= TL.s9a && t < 50.5;
  const ps = easeOut(range(t, 36.0, 39.0)) * 11 * (1 - smooth(range(t, 48.2, 50.3)));
  RU.plume.scale.set(Math.max(0.01, ps), Math.max(0.01, ps * 0.5), 1);
  RU.stream.visible = t >= TL.s9a && t < 42.8; RU.streamMat.map.offset.y = -t * 1.4;
  RU.plant.visible = t >= TL.s10a;
  const order = [0, 1, 2, 5, 6, 3, 4];
  RU.parts.forEach((p, i) => { const tp = 41.0 + order[i] * 0.28; const k = easeOutBack(range(t, tp, tp + 0.35), 2.2); p.scale.set(Math.max(0.001, k), Math.max(0.001, k), Math.max(0.001, k)); p.visible = t >= tp; });
  // tank water colour
  const c1 = new THREE.Color('#7a5a30'), cB = new THREE.Color('#3f9fd8'), cM = new THREE.Color('#7f8a52');
  RU.tanks[0].wmat.color.copy(c1).lerp(cM, smooth(range(t, 44.5, 47.5)) * 0.6);
  RU.aerW.color.copy(c1).lerp(cB, smooth(range(t, 45.5, 47.4)));
  RU.tanks[1].wmat.color.copy(cM).lerp(cB, smooth(range(t, 44.0, 46.5)));
  RU.tanks.forEach((tk, i) => { tk.arm.rotation.y = t * (0.9 + i * 0.3); });
  RU.cleanStream.visible = t >= 47.6; RU.cleanMat.map.offset.y = -t * 1.6;
}
// --- 9a sewage into river
shot(TL.s9a, TL.s9b, (t, lt) => {
  camLerp(lt, { p: [-6.0, 3.0, -92.5], l: [-9.8, -0.4, -82.2], fov: 50 }, { p: [-6.4, 2.7, -91.2], l: [-9.9, -0.4, -82.2], fov: 50 });
  shadowAt(-9, 0, -84, 14);
  riverState(t);
  burst(pools.brown, t, Math.floor(t * 8) / 8, V3(-10, RIVER.y + 0.1, -83.6), { n: 6, speed: 2.4, size: 0.1, life: 0.5, seed: Math.floor(t * 8) });
  for (let j = 1; j < 4; j++) burst(pools.brown, t, Math.floor(t * 8) / 8 - j / 8, V3(-10, RIVER.y + 0.1, -83.6), { n: 6, speed: 2.4, size: 0.1, life: 0.5, seed: Math.floor(t * 8) - j });
});
// --- 9b sick fish
shot(TL.s9b, TL.s10a, (t, lt) => {
  camLerp(lt, { p: [-9.6, 1.05, -94.4], l: [-9.6, 0.15, -86.6], fov: 46 }, { p: [-9.6, 0.95, -93.4], l: [-9.6, 0.15, -86.6], fov: 46 });
  shadowAt(-9.5, 0, -87, 8);
  riverState(t);
  const pos = [[-10.95, -86.9], [-9.6, -86.4], [-8.25, -87.0]];
  fish.slice(0, 3).forEach((f, i) => {
    show(f); const u = f.userData;
    const up = easeOutBack(range(t, 38.62 + i * 0.12, 38.95 + i * 0.12), 2);
    f.position.set(pos[i][0], RIVER.y - 1.6 + up * 1.15 + Math.sin(t * 3 + i) * 0.05, pos[i][1]);
    f.rotation.set(0, Math.PI + (i - 1) * 0.25, Math.sin(t * 4 + i) * 0.08);
    const sick = smooth(range(t, 38.9, 39.5));
    u.bodyM.color.copy(u.base).lerp(new THREE.Color('#9acd32'), sick * 0.75);
    u.face.set(i === 1 ? 'sick' : 'disgust');
    if (i === 2 && t > 39.7) { f.rotation.z = -easeOutBounce(range(t, 39.7, 40.4)) * 1.35; f.position.y -= range(t, 39.7, 40.4) * 0.35; u.face.set('squint'); }
    if (i === 0) u.b.rotation.z = Math.sin(t * 10) * 0.12;
  });
});
// --- 10a plant builds itself
shot(TL.s10a, TL.s10b, (t, lt) => {
  camLerp(lt, { p: [36, 14.5, -50], l: [16.5, 0, -71], fov: 48 }, { p: [33, 13, -48.5], l: [16.5, 0.2, -71], fov: 48 });
  shadowAt(17, 0, -70, 20);
  riverState(t);
  RU.parts.forEach((p, i) => { const order = [0, 1, 2, 5, 6, 3, 4]; const tp = 41.0 + order[i] * 0.28; const wp = p.getWorldPosition(V3()); puff(t, tp + 0.15, V3(wp.x, 0.2, wp.z), { r: 3, size: 0.8, n: 12, life: 0.8 }); });
  if (t > 41.0 && t < 43.2) shake(t, 0.03);
});
// --- 10b top-down spinning clarifier
shot(TL.s10b, TL.s10c, (t, lt) => {
  camLerp(lt, { p: [12.3, 13.5, -62.6], l: [12, 0, -66.2], fov: 44 }, { p: [12.2, 11.8, -63.0], l: [12, 0, -66.2], fov: 44 });
  shadowAt(12, 0, -66, 8);
  riverState(t);
  bubbles(t, V3(12, 1.45, -66), 3.0, 3.0, 120, 21, 0.25, 0.1);
});
// --- 10c aeration tank bubbling clean
shot(TL.s10c, TL.s11a, (t, lt) => {
  camLerp(lt, { p: [17.5, 4.6, -66.4], l: [17.5, 0.9, -74.5], fov: 50 }, { p: [16.5, 4.2, -67.5], l: [17.5, 1.0, -74.5], fov: 50 });
  shadowAt(17.5, 0, -73, 10);
  riverState(t);
  bubbles(t, V3(17.5, 1.42, -74.5), 6.6, 2.5, 260, 23, 0.35, 0.075);
  sparkles(t, V3(17.5, 2.0, -74.5), V3(12, 1.2, 4), Math.round(30 * smooth(range(t, 46.3, 47.4))), 7, 0.13);
});
// --- 11a clean water back into river
shot(TL.s11a, TL.s11b, (t, lt) => {
  camLerp(lt, { p: [22.2, 2.6, -89.8], l: [19.0, -0.4, -81.6], fov: 50 }, { p: [21.8, 2.4, -88.8], l: [19.0, -0.4, -81.6], fov: 50 });
  shadowAt(19, 0, -84, 14);
  riverState(t);
  for (let j = 0; j < 4; j++) burst(pools.water, t, Math.floor(t * 8) / 8 - j / 8, V3(19, RIVER.y + 0.1, -83.6), { n: 8, speed: 2.6, size: 0.08, life: 0.5, seed: 300 + Math.floor(t * 8) - j });
  sparkles(t, V3(19, 0.4, -86), V3(10, 1, 6), 26, 5, 0.14);
});
// --- 11b happy fish jumping
shot(TL.s11b, TL.s11c, (t, lt) => {
  camLerp(lt, { p: [18.6, 0.55, -91.2], l: [19, 0.9, -86.0], fov: 48 }, { p: [18.6, 0.6, -90.6], l: [19, 1.0, -86.0], fov: 48 });
  shadowAt(19, 0, -86, 8);
  riverState(t);
  fish.forEach((f, i) => {
    show(f); const u = f.userData; u.bodyM.color.copy(u.base); u.face.set('joy');
    const t0 = 50.45 + i * 0.16, k = range(t, t0, t0 + 0.75);
    const x = 16.6 + i * 1.2, z = -86.2 - (i % 2) * 1.0;
    f.position.set(x + k * 0.6, RIVER.y - 1.3 + Math.sin(k * Math.PI) * 2.6 + (k >= 1 ? -5 : 0), z);
    f.rotation.set(0, Math.PI, -0.4 + k * 0.8 - (k > 0 ? Math.sin(k * Math.PI * 2) * 0.3 : 0));
    burst(pools.water, t, t0 + 0.05, V3(x, RIVER.y + 0.05, z), { n: 12, speed: 2.8, size: 0.07, life: 0.6, seed: 400 + i });
  });
  sparkles(t, V3(19, 1.6, -86.5), V3(6, 2, 2), 24, 9, 0.12);
});
// --- 11c clean fresh town
shot(TL.s11c, TL.s11d, (t, lt) => {
  camLerp(lt, { p: [-2.0, 3.4, 25], l: [-0.6, 3.3, 0], fov: 50 }, { p: [-1.7, 3.6, 20.5], l: [-0.6, 3.4, 0], fov: 50 });
  shadowAt(0, 0, 8, 22);
  for (let i = 0; i < 10; i++) { const b = beans[i]; const dir = i % 2 ? 1 : -1; beanWalk(b, (i % 4 - 1.5) * 1.8 + 0.3, 12 - i * 2.4 + dir * (t - TL.s11c) * 1.2, dir > 0 ? 0 : Math.PI, t); }
  [extras[0], extras[2]].forEach((p, i) => { show(p); const ud = p.userData; ud.reset(); place(p, i ? 2.4 : -2.6, 0, 9 - (t - TL.s11c) * 1.3 - i * 3, Math.PI); ud.walk(t * 7 + i, 1); ud.face.set('happy'); });
  sparkles(t, V3(0, 3.5, 12), V3(9, 5, 14), 40, 13, 0.13);
  windowManState(t, 'none'); windowMan.visible = false;
});
// --- 11d nobody gets splashed (callback gag)
shot(TL.s11d, TL.s12, (t, lt) => {
  camLerp(lt, { p: [HW.x + 5.0, 2.7, HW.z - 5.6], l: [HW.x + 1.1, 3.4, HW.z + 0.4], fov: 54 }, { p: [HW.x + 4.7, 2.75, HW.z - 5.0], l: [HW.x + 1.1, 3.45, HW.z + 0.4], fov: 54 });
  shadowAt(HW.x, 2, HW.z, 10);
  const ud = windowMan.userData; show(windowMan); ud.reset(); bucket.visible = false;
  windowMan.position.set(SP.x, 3.2, SP.z - 0.92);
  setShutters(easeOutBack(range(t, 53.35, 53.65), 2.2));
  ud.body.rotation.x = lerp(0, 0.48, easeOutBack(range(t, 53.5, 53.85)));
  ud.reach(1, [0.6, 1.95, 0.55 + Math.sin(t * 10) * 0.2], [1, 0, -1]); ud.reach(-1, [-0.5, 1.2 + Math.sin(t * 6) * 0.2, 0.75], [-1, -1, 0]);
  ud.face.set('joy');
  const wu = walker.userData; show(walker); wu.reset(); headPoop.visible = false;
  const camP = camState.p;
  const zz = lerp(SPOT.z - 3.2, SPOT.z, range(t, 53.0, 53.45));
  const face = Math.atan2(camP.x - SPOT.x, camP.z - zz);
  place(walker, SPOT.x, 0, zz, t < 53.45 ? 0 : face);
  if (t < 53.45) { wu.walk(t * 8, 1); wu.face.set('smile'); }
  else if (t < 54.25) { // flinch!
    wu.hips.position.y = 1.0; for (const s of [-1, 1]) wu.reach(s, [0.18 * s, 1.95, 0.25], [s, 0.3, -1]); wu.face.set('squint', 1.2); wu.body.rotation.z = Math.sin(t * 30) * 0.04;
  } else { wu.head.rotation.x = -0.2; wu.face.set('joy'); for (const s of [-1, 1]) wu.reach(s, [0.75 * s, 1.75, 0.45], [s, -0.5, -1]); wu.body.position.y = Math.abs(Math.sin(t * 9)) * 0.12; }
  confetti(t, 53.85, V3(HW.x + 1.3, 3.2, HW.z), V3(2.2, 1.6, 2.2), 70, 77, petalCols, 0.13);
});
// --- 12 finale
shot(TL.s12, TL.end + 1, (t, lt) => {
  const k = easeInOut(range(t, TL.s12, 58.3));
  camState.p.set(lerp(3.2, 4.35, k), lerp(11.5, 4.7, k), lerp(27, 6.3, k));
  camState.l.set(lerp(-1.0, -4.4, k), lerp(2.2, 3.4, k), lerp(-5, -0.4, k)); camState.fov = lerp(50, 47, k);
  camState.p.x += Math.sin(t * 0.6) * 0.1;
  shadowAt(0, 0, 2, 22);
  // crowd
  const R = rng(1234);
  beans.forEach((b, i) => {
    b.visible = true; let x = (R() - 0.5) * 8.8, z = 10 - R() * 26;
    if (x < -3.0 && z > -2.6 && z < 2.8) x += 1.6;
    b.position.set(x, 0, z); b.rotation.set(0, Math.atan2(5 - x, 18 - z) * 0.6 + (R() - 0.5) * 0.6, 0); b.userData.cheer(t, 1);
  });
  [extras[0], extras[1], extras[2], extras[3], lady, fanGuy].forEach((p, i) => {
    show(p); const ud = p.userData; ud.reset(); const x = [-1.2, 1.8, 0.6, -2.4, 2.8, -0.2][i], z = [4.5, 2.0, -1.5, -4.5, 6, 8][i];
    place(p, x, Math.abs(Math.sin(t * 8 + i)) * 0.35, z, Math.atan2(6 - x, 9 - z)); armsUp(p, t + i); ud.face.set('joy');
  });
  // hero characters
  const wm = windowMan.userData; show(windowMan); wm.reset(); bucket.visible = false; setShutters(1);
  windowMan.position.set(SP.x, 3.2, SP.z - 0.92); wm.body.rotation.x = 0.48; wm.face.set('joy');
  for (const s of [-1, 1]) wm.reach(s, [0.6 * s, 1.95, 0.5 + Math.sin(t * 9 + s) * 0.2], [s, 0, -1]);
  const wu = walker.userData; show(walker); wu.reset(); headPoop.visible = false;
  place(walker, SPOT.x + 0.4, Math.abs(Math.sin(t * 8)) * 0.3, SPOT.z + 1.6, 1.2); armsUp(walker, t); wu.face.set('joy');
  diggers.forEach((d, i) => { show(d); const ud = d.userData; ud.reset(); place(d, [-0.8, 1.6, 3.0][i], Math.abs(Math.sin(t * 8 + i * 2)) * 0.3, [0.2, -3.0, 3.5][i], 1.0); armsUp(d, t + i); ud.face.set('joy'); d.userData.shovel.visible = false; });
  confetti(t, TL.s12 + 0.1, V3(-0.5, 5, 1), V3(10, 3.5, 16), 520, 999);
});

// ---------------- frame update ----------------
function update(t) {
  for (const a of actors) a.visible = false;
  for (const p of Object.values(pools)) p.count = 0;
  for (const d of diggers) d.userData.shovel.visible = true;
  for (const w of CU.workers) w.userData.shovel.visible = true;
  headPoop.visible = false; paper.visible = false; bucket.visible = false;
  envDay(); updateTown(t);
  riverState(t);
  CU.homes.forEach(h => { h.conn.visible = false; });
  const s = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  const lt = clamp((t - s.t0) / (s.t1 - s.t0));
  s.fn(t, lt, s.t0, s.t1);
  // camera
  camera.position.copy(camState.p); camera.up.set(0, 1, 0); camera.lookAt(camState.l);
  camera.fov = camState.fov; camera.updateProjectionMatrix();
  clouds.position.set(camera.position.x * 0.9, 0, camera.position.z * 0.9); sky.position.copy(camera.position);
  for (const p of Object.values(pools)) { p.instanceMatrix.needsUpdate = true; if (p.instanceColor) p.instanceColor.needsUpdate = true; }
  // visibility of far-away sets (perf)
  const near = (g, at) => camera.position.distanceTo(V3(...at)) < 150;
  cut.visible = near(cut, CUT_AT); tunnel.visible = near(tunnel, TUN_AT);
  town.visible = river.visible = !cut.visible && !tunnel.visible;
}

// ---------------- overlay: captions + yellow labels ----------------
const LABELS = [['DITCH', 'Ditch', 0], ['COVERED DRAIN', 'Covered', 0], ['PIPES', 'Pipes', 0], ['TOILETS', 'Toilet', 0], ['SEWER TUNNEL', 'Tunnel', 0],
  ['RIVER', 'River', 0], ['TREATMENT PLANT', 'Treatment', 0], ['CLEAN WATER', 'Clean', 0]].map(([text, word, n]) => {
  const w = WORDS.find(w => w.w === word && w.s > 10); return { text, t0: w.s - 0.05, t1: w.s + 2.1 };
});
const out = document.createElement('canvas'); out.width = Math.round(W * SC); out.height = Math.round(H * SC); const ctx = out.getContext('2d');
function outlinedText(text, x, y, size, fill, strokeW, strokeCol, scale = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.font = `700 ${size}px Fredoka`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = strokeW;
  ctx.strokeText(text, 0, size * 0.06); ctx.fillText(text, 0, size * 0.06);
  ctx.strokeStyle = strokeCol; ctx.lineWidth = strokeW; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill; ctx.fillText(text, 0, 0); ctx.restore();
}
function drawOverlay(t) {
  // caption: one word at a time, synced to the voiceover
  let cur = null;
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i], next = WORDS[i + 1];
    const end = Math.min(next ? next.s : w.e + 1.0, w.e + 0.9);
    if (t >= w.s && t < end) { cur = w; break; }
  }
  if (cur) {
    const k = range(t, cur.s, cur.s + 0.09);
    let size = 104; ctx.font = `700 ${size}px Fredoka`; const mw = ctx.measureText(cur.w).width; if (mw > 900) size *= 900 / mw;
    outlinedText(cur.w, W / 2, H * 0.5, size, '#ffffff', 20, '#1c1c22', lerp(1.18, 1, easeOut(k)));
  }
  // yellow item label at the top
  for (const L of LABELS) {
    if (t < L.t0 || t > L.t1) continue;
    const kin = range(t, L.t0, L.t0 + 0.32), kout = range(t, L.t1 - 0.2, L.t1);
    let size = 128; ctx.font = `700 ${size}px Fredoka`; const mw = ctx.measureText(L.text).width; if (mw > 960) size *= 960 / mw;
    const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
    g.addColorStop(0, '#fff27a'); g.addColorStop(0.5, '#ffd21f'); g.addColorStop(1, '#ffad0f');
    ctx.save(); ctx.translate(0, 0);
    outlinedText(L.text, W / 2, H * 0.135, size, g, 18, '#4a2a00', easeOutBack(kin, 2.6) * (1 + kout * 0.15), 1 - kout);
    ctx.restore();
  }
}

window.renderFrame = (f, type = 'image/jpeg') => {
  const t = f / FPS;
  update(t);
  renderer.render(scene, camera);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, out.width, out.height); ctx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
  ctx.setTransform(SC, 0, 0, SC, 0, 0); drawOverlay(t);
  return out.toDataURL(type, 0.93);
};
const q = new URLSearchParams(location.search);
if (q.has('t')) { window.renderFrame(Math.round(+q.get('t') * FPS)); document.body.appendChild(out); out.style.width = '540px'; }
window.dbg = { windowMan, hero, THREE, HW, update, renderer, scene, camera, out, sun };
window.READY = true;
