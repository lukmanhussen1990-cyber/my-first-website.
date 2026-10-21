// Scene assembly + per-frame animation. Exposes window.APP for the frame renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import * as T from './timeline.js';
import { E, clamp, lerp, smooth, ramp, pop, snap, curve, noise1 } from './timeline.js';
import { makeSky, envCanvas, makeGround, makeGrass, makeFlowers, makeTree, makeBush, makeNeighborHouse, makeStreet, makeCity, NOISE_GLSL } from './world.js';
import { makeHouse, HOUSE } from './house.js';
import { makeWheel, makeStand, makeGenerator, makeGears, makeBelt, beltPath, ribbonGeo, makeBattery, makeCooling, makeRod, spinGhosts, WHEEL, GEN, BATT } from './machines.js';
import { makeJohn, poseJohn, setFace, makeNeighbor } from './characters.js';
import { Cable, DotSystem, Seam, polyCurve, makeRain, makeSplashes, Billboards, Chunks, boltGeometry, crackleGeos } from './fx.js';
import { glowSprite, puff, wood } from './textures.js';
import { rng, mergeStatic, trimTiny } from './util.js';

const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const USE_AO = params.get('ao') !== '0';
const TAU = Math.PI * 2;

let renderer, scene, camera, composer, bloom, grade, gtao;
const U = {
  uTime: { value: 0 }, uWind: { value: 0.1 }, uWet: { value: 0 }, uSmear: { value: 0 }, uNight: { value: 0 }, uWinBoost: { value: 1.6 }, uInterior: { value: 1 },
};
const A = {}; // actors

function hashf(n) { const s = Math.sin(n * 91.345 + 47.853) * 43758.5453; return s - Math.floor(s); }
function pivotize(obj, at, parent) {
  const p = new THREE.Group(); p.position.copy(at); (parent || scene).add(p);
  obj.position.sub(at); p.add(obj); return p;
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- init
async function init() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color('#d9a27a'), 0.0065);
  camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 1500);

  // environment maps
  const pm = new THREE.PMREMGenerator(renderer);
  const mkEnv = (k) => { const t = new THREE.CanvasTexture(envCanvas(k)); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return pm.fromEquirectangular(t).texture; };
  A.envGold = mkEnv('gold'); A.envStorm = mkEnv('storm');
  scene.environment = A.envGold; scene.environmentIntensity = 0.6;

  // sky
  A.sky = makeSky(); scene.add(A.sky.mesh);

  // lights
  A.key = new THREE.DirectionalLight(new THREE.Color('#ffb36b'), 3.2);
  A.key.castShadow = true; const SM = parseInt(params.get('shadow') || '4096'); A.key.shadow.mapSize.set(SM, SM);
  const sc = A.key.shadow.camera; sc.left = -7.5; sc.right = 7.5; sc.top = 6; sc.bottom = -4.5; sc.near = 0.5; sc.far = 40;
  A.key.shadow.bias = -0.0004; A.key.shadow.normalBias = 0.025;
  A.key.target.position.set(0.5, 0.5, -1.5); scene.add(A.key, A.key.target);
  A.fill = new THREE.DirectionalLight(new THREE.Color('#ffd9b8'), 0.9); A.fill.position.set(2, 3, 10); scene.add(A.fill);
  A.rim = new THREE.DirectionalLight(new THREE.Color('#9fb8ff'), 0.0); A.rim.position.set(6, 5, -8); scene.add(A.rim);
  A.hemi = new THREE.HemisphereLight(new THREE.Color('#9fbfff'), new THREE.Color('#5a4630'), 0.55); scene.add(A.hemi);
  A.rim.position.set(5, 10, -10); // rim light doubles as the lightning flash light
  const dummyLight = () => ({ position: new THREE.Vector3(), intensity: 0, color: new THREE.Color() });
  A.flash = dummyLight(); A.boom = dummyLight(); A.genLight = dummyLight(); A.hubLight = dummyLight();
  A.faceLight = new THREE.PointLight(new THREE.Color('#ffc890'), 0, 3.2, 2); scene.add(A.faceLight);

  // ground, grass
  const ground = makeGround(U); scene.add(ground.group); A.ground = ground;
  const excl = [[HOUSE.x0 - 0.05, HOUSE.x1 + 0.05, HOUSE.z0 - 0.05, 0.1], [-0.2, 1.1, -1.35, -0.62], [BATT.pos.x - 0.33, BATT.pos.x + 0.33, BATT.pos.z - 0.3, BATT.pos.z + 0.3]];
  const GF = parseFloat(params.get('grass') || '1');
  A.grass = makeGrass(U, { exclude: excl, countFront: Math.round(34000 * GF), countBack: Math.round(18000 * GF) }); scene.add(A.grass); A.grass.userData.noAO = true;
  scene.add(makeFlowers(excl.concat([[-3.2, 0.0, -2.3, 0.1]])));

  // fence (yard)
  A.fence = makeYardFence(-4.4, 5.4, -6.6, -0.35); scene.add(A.fence);
  // trees & bushes
  for (const [x, z, s, seed, col] of [[-3.7, -5.6, 1.15, 3, '#4f8a32'], [4.9, -5.9, 1.25, 5, '#5a9436'], [-7.8, -6.8, 1.1, 7, '#47822f'], [9.6, -6.5, 1.2, 9, '#4f8a32'], [-1.8, -14.8, 1.3, 11, '#4a8a3a'], [5.4, -15.0, 1.2, 13, '#558f35']]) {
    const t = makeTree(seed, s, col); t.position.set(x, 0, z); scene.add(t); (A.trees ??= []).push(t);
  }
  for (const [x, z, s] of [[HOUSE.x0 + 0.4, -3.1, 0.9], [HOUSE.x1 - 0.4, -3.05, 1.0], [5.0, -1.2, 0.8], [-3.9, -1.0, 0.8], [-3.5, -3.4, 0.9]]) { const b = makeBush(Math.floor(x * 10 + z * 3), s); b.position.set(x, 0, z); scene.add(b); }
  // street + neighbor houses
  A.street = makeStreet(U); scene.add(A.street);
  A.nh = [];
  const NH = [
    { p: [-6.9, -3.4], wall: [214, 196, 220], roof: [110, 68, 70], seed: 11, cols: 2 },
    { p: [8.3, -3.2], wall: [196, 222, 206], roof: [90, 80, 100], seed: 12, cols: 2 },
    { p: [-4.4, -12.6], wall: [236, 214, 196], roof: [120, 70, 56], seed: 13, cols: 3 },
    { p: [-0.4, -12.8], wall: [205, 220, 236], roof: [70, 76, 92], seed: 14, cols: 3 },
    { p: [3.6, -12.6], wall: [240, 230, 190], roof: [128, 84, 60], seed: 15, cols: 3 },
    { p: [7.6, -12.8], wall: [220, 200, 186], roof: [96, 72, 72], seed: 16, cols: 2 },
    { p: [-8.4, -12.4], wall: [200, 214, 196], roof: [100, 90, 80], seed: 17, cols: 2 },
    { p: [-2.6, -19.5], wall: [226, 210, 200], roof: [110, 76, 66], seed: 18, cols: 2 },
    { p: [2.4, -19.8], wall: [210, 216, 230], roof: [80, 80, 96], seed: 19, cols: 2 },
    { p: [6.8, -19.4], wall: [236, 222, 200], roof: [116, 80, 62], seed: 20, cols: 2 },
  ];
  NH.forEach((o, i) => { const h = makeNeighborHouse({ ...o, h: 2.5, w: o.cols === 3 ? 3.2 : 2.6 }); h.position.set(o.p[0], 0, o.p[1]); scene.add(h); A.nh.push({ g: h, order: Math.min(1, Math.hypot(o.p[0] - 1, o.p[1]) / 22) }); });
  scene.updateMatrixWorld(true);

  // city
  A.city = makeCity(U); scene.add(A.city.group); A.city.group.traverse((o) => (o.userData.noAO = true));

  // house
  A.house = makeHouse(U.uInterior); scene.add(A.house.group);
  A.dad = A.house.dad;

  // wheel + stand
  A.stand = makeStand(); A.standPivot = pivotize(A.stand.group, v3(WHEEL.pos.x, 0, WHEEL.pos.z - 0.56));
  A.wheel = makeWheel(U); A.wheelPivot = pivotize(A.wheel.group, v3(WHEEL.pos.x, 0, WHEEL.pos.z));
  // generator
  A.gen = makeGenerator(); scene.add(A.gen.group); scene.add(A.gen.pulley);
  A.pulleyGhosts = spinGhosts(A.gen.parts.pulleySpokes, 4);
  A.gears = makeGears(); scene.add(A.gears.bigG, A.gears.smallG, A.gears.stand);
  A.bigGhosts = spinGhosts(A.gears.big, 5); A.smallGhosts = spinGhosts(A.gears.small, 6);
  // belt
  const bp = beltPath(v3(WHEEL.pos.x, WHEEL.pos.y, 0), 1.168, v3(GEN.pos0.x, GEN.pos0.y, 0), 0.077);
  A.belt = makeBelt(GEN.beltZ); A.belt.mesh.geometry = ribbonGeo(bp.pts, 0.06, 0.014); scene.add(A.belt.mesh);
  A.beltLen = bp.len;
  // battery
  A.batt = makeBattery(); A.battPivot = pivotize(A.batt.group, v3(BATT.pos.x, 0, BATT.pos.z));
  // cooling
  A.cool = makeCooling(); scene.add(A.cool.group);
  for (const k of ['tank', 'pump', 'rad']) A.cool.parts[k].userData.base = A.cool.parts[k].position.clone();
  // rod
  A.rod = makeRod(); scene.add(A.rod.group);

  // John
  A.john = makeJohn(); scene.add(A.john.root);

  // neighbors in windows
  A.neighbors = [];
  const NB = [
    { h: 0, w: 0, skin: '#f2c9a8', hair: '#c8962e', shirt: '#7e57c2', style: 'long', seed: 2 },
    { h: 2, w: 3, skin: '#8d5a3b', hair: '#1c1410', shirt: '#26a69a', style: 'curly', seed: 3 },
    { h: 3, w: 0, skin: '#f0c4a0', hair: '#3a2a20', shirt: '#ef6c00', style: 'short', seed: 4 },
    { h: 3, w: 4, skin: '#c99a72', hair: '#2a2420', shirt: '#5c6bc0', style: 'bun', seed: 5 },
    { h: 4, w: 2, skin: '#5c3a26', hair: '#141010', shirt: '#e53935', style: 'bald', seed: 6 },
    { h: 1, w: 1, skin: '#e8b896', hair: '#7a4a2a', shirt: '#43a047', style: 'short', seed: 7 },
    { h: 5, w: 3, skin: '#f5d0b0', hair: '#d9d0c6', shirt: '#8d6e63', style: 'short', seed: 8 },
  ];
  NB.forEach((o, i) => {
    const house = A.nh[o.h].g; const win = house.userData.windows[Math.min(o.w, house.userData.windows.length - 1)];
    const n = makeNeighbor(o);
    const holder = new THREE.Group(); holder.position.copy(win.local).add(v3(0, -0.28, 0.07)); house.add(holder);
    n.root.scale.setScalar(0.5); holder.add(n.root);
    // dark interior backdrop + glass in front
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1, emissive: new THREE.Color('#ff9a40'), emissiveIntensity: 0 }));
    back.position.copy(win.local).add(v3(0, 0, 0.04)); house.add(back);
    win.glass.position.z += 0.16; win.mat.transparent = true; win.mat.opacity = 0.35; holder.userData.noMerge = true;
    n.J.candle.position.set(0.0, 0.14, 0.17);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: new THREE.Color(2.2, 1.1, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(0.5); n.J.candle.add(glow); glow.position.y = 0.17;
    A.neighbors.push({ ...n, holder, back, win, glow, i, o });
  });

  // ---------- cables ----------
  A.cables = {};
  const X0 = HOUSE.x0, BX = BATT.pos.x;
  A.cables.main = new Cable(polyCurve([[1.0, 0.05, -0.62], [0.86, 0.0, -0.4], [0.84, -0.02, -0.05], [0.86, -0.12, 0.03], [0.9, -0.42, 0.03], [1.1, -0.64, 0.03], [1.6, -0.66, 0.03], [X0 + 0.15, -0.6, 0.03], [X0 + 0.3, -0.36, 0.03], [X0 + 0.33, 0.0, 0.03], [X0 + 0.3, 0.14, -0.04], [X0 + 0.18, 0.17, -0.2], [X0 + 0.13, 0.3, -0.31], [X0 + 0.12, 0.5, -0.32]]), { dots: 30, name: 'main', radius: 0.055 });
  A.cables.batt = new Cable(polyCurve([[BX, 0.03, -0.1], [BX, -0.01, 0.0], [BX + 0.02, -0.1, 0.03], [BX + 0.04, -0.4, 0.03], [BX + 0.08, -0.64, 0.03]]), { dots: 10, name: 'batt', radius: 0.05 });
  const J0 = [BX + 0.08, -0.65, 0.03];
  A.cables.left = new Cable(polyCurve([J0, [BX - 0.4, -0.98, 0.03], [-0.5, -1.08, 0.03], [-3.0, -1.08, 0.03], [-5.6, -0.98, 0.03], [-6.4, -0.45, 0.03], [-6.55, -0.02, 0.03], [-6.6, 0.03, -0.3], [-6.7, 0.04, -2.1]]), { dots: 60, name: 'left', radius: 0.05 });
  A.cables.right = new Cable(polyCurve([J0, [BX + 0.5, -1.0, 0.03], [3.0, -1.12, 0.03], [6.0, -1.08, 0.03], [7.4, -0.92, 0.03], [7.9, -0.45, 0.03], [8.0, -0.02, 0.03], [8.0, 0.03, -0.3], [8.0, 0.04, -1.9]]), { dots: 60, name: 'right', radius: 0.05 });
  A.cables.deep = new Cable(polyCurve([J0, [BX + 0.2, -1.5, 0.03], [2.5, -2.0, 0.03], [6, -2.2, 0.03], [16, -2.3, 0.03]]), { dots: 40, name: 'deep', radius: 0.075 });
  A.cables.deep.dotR = 0.04;
  A.cables.lead = null;
  A.cableGroup = new THREE.Group(); scene.add(A.cableGroup);
  for (const c of Object.values(A.cables)) if (c) A.cableGroup.add(c.group);
  // seams on the lawn from the battery
  const sb = [BATT.pos.x - 0.1, 0, BATT.pos.z - 0.35];
  const seamPts = [
    [sb, [0.4, 0, -4.2], [-2.0, 0, -7.4], [-4.3, 0, -10.9]],
    [sb, [1.0, 0, -4.5], [-0.3, 0, -8.0], [-0.4, 0, -11.2]],
    [sb, [2.0, 0, -4.4], [3.3, 0, -8.0], [3.6, 0, -11.0]],
    [sb, [5.0, 0, -4.0], [7.0, 0, -8.0], [7.6, 0, -11.2]],
    [sb, [0.6, 0, -5.0], [-1.0, 0, -10.0], [-1.2, 0, -16.0], [0.5, 0, -30], [4.0, 0, -44]],
  ];
  A.seams = seamPts.map((pts, i) => { const s = new Seam(polyCurve(pts.map((p) => [p[0], p[1], p[2]]), 0.3), 's' + i); scene.add(s.group); return s; });
  A.seams.forEach((sm) => { sm.nDots = Math.max(10, Math.round(sm.len * 2.6)); }); A.seams[4].nDots = 90; A.seams[4].dotR = 0.045;
  A.dots = new DotSystem(2400); scene.add(A.dots.mesh);
  A.leadMesh = null;
  // junction box for generator lead
  const jb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), new THREE.MeshPhysicalMaterial({ color: '#f9a825', roughness: 0.35, clearcoat: 0.6 }));
  jb.position.set(1.0, 0.05, -0.68); jb.castShadow = true; scene.add(jb); A.junction = jb;

  // ---------- fx ----------
  A.rain = makeRain(9000); scene.add(A.rain.mesh);
  A.splash = makeSplashes(1600, [[-6, 6, -6, 0, 0.02], [HOUSE.x0, HOUSE.x1, HOUSE.z0, 0, HOUSE.up1 + 0.62], [-6, 6, -9.5, -6.8, 0.02]]); scene.add(A.splash.mesh);
  A.smoke = new Billboards(420, { texture: puff() }); scene.add(A.smoke.mesh); A.smoke.mesh.renderOrder = 6;
  A.sparks = new Billboards(500, { additive: true, texture: glowSprite() }); A.sparks.mat.uniforms.uStreak.value = 1; scene.add(A.sparks.mesh); A.sparks.mesh.renderOrder = 7;
  A.glows = new Billboards(200, { additive: true, texture: glowSprite() }); scene.add(A.glows.mesh); A.glows.mesh.renderOrder = 8;
  A.mist = new Billboards(500, { texture: puff() }); scene.add(A.mist.mesh); A.mist.mesh.renderOrder = 6;
  A.dirt = new Chunks(500, new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 1 })); scene.add(A.dirt.mesh);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.7, clearcoat: 1 });
  A.drops = new Chunks(200, waterMat, new THREE.SphereGeometry(1, 10, 8)); scene.add(A.drops.mesh);
  // lightning bolts
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.5, 8), fog: false });
  A.bolts = [];
  const st = A.city.station.clone().add(A.city.powerStation.userData.strikePoint);
  const mkBolt = (start, end, seed, w) => { const g = new THREE.Group(); for (const geo of boltGeometry(start, end, seed, w, 5)) g.add(new THREE.Mesh(geo, boltMat)); g.visible = false; scene.add(g); return g; };
  A.strikeBolts = [mkBolt(st.clone().add(v3(-14, 80, -10)), st, 4, 0.22), mkBolt(st.clone().add(v3(8, 80, -12)), st, 9, 0.2), mkBolt(st.clone().add(v3(-4, 80, -6)), st, 12, 0.24)];
  A.skyBolts = [mkBolt(v3(-40, 80, -170), v3(-30, 0, -160), 21, 0.28), mkBolt(v3(45, 80, -180), v3(34, 0, -170), 23, 0.28), mkBolt(v3(-8, 80, -190), v3(6, 0, -180), 25, 0.3), mkBolt(v3(24, 80, -150), v3(16, 0, -140), 27, 0.26)];
  // crackles at generator
  const crMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 5, 9) });
  A.crackles = crackleGeos(8, 3, 0.2).map((g) => { const m = new THREE.Mesh(g, crMat); m.visible = false; A.gen.group.add(m); m.position.z = 0.22; return m; });
  A.tipSpark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: new THREE.Color(6, 4, 1.2), blending: THREE.AdditiveBlending, depthWrite: false })); A.tipSpark.scale.setScalar(0.25); scene.add(A.tipSpark);

  // ---------- draw-call reduction: merge static meshes by material ----------
  {
    let made = 0;
    made += mergeStatic(A.house.group);
    A.nh.forEach((h) => (made += mergeStatic(h.g)));
    made += mergeStatic(A.street);
    made += mergeStatic(A.city.group, (o) => o.isInstancedMesh);
    made += mergeStatic(A.stand.group);
    made += mergeStatic(A.wheel.rot, (o) => o.material === A.wheel.slatMat || o.material === A.wheel.hotMat);
    for (const k of ['base', 'housing', 'coil']) made += mergeStatic(A.gen.parts[k]);
    for (const k of ['tank', 'pump', 'rad']) made += mergeStatic(A.cool.parts[k], (o) => o === A.cool.parts.pumpFan || o === A.cool.parts.radFan);
    made += mergeStatic(A.rod.parts.donut); made += mergeStatic(A.rod.parts.pole); made += mergeStatic(A.rod.parts.rod);
    made += mergeStatic(A.gears.stand);
    (A.trees || []).forEach((t) => (made += mergeStatic(t.userData.canopy)));
    made += mergeStatic(A.john.J.head, (o) => o.material !== A.john.mats.hair);
    made += mergeStatic(A.dad.J.head, (o) => !(o.material.color && o.parent === A.dad.J.head && o.material.roughness === 0.45) && o.parent !== A.dad.J.glasses);
    A.neighbors.forEach((n) => { setFace(n.face, { lid: 0.12, smile: 0.6, open: 0, brow: 0.12, look: [0, -0.05] }); n.J.candle.userData.noMerge = true; made += mergeStatic(n.J.head); n.frozen = true; });
    trimTiny(scene);
    let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
    console.log('merged groups', made, 'meshes now', meshes);
  }
  // ---------- post ----------
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: parseInt(params.get('msaa') || '4') });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  if (USE_AO) {
    gtao = new GTAOPass(scene, camera, W, H);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 10 });
    // AO at half resolution (blended over the full-res image), and only from solid scene geometry
    const AOS = parseFloat(params.get('aoscale') || '0.5');
    const setSize0 = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => setSize0(Math.round(w * AOS), Math.round(h * AOS));
    gtao._overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse((o) => {
        cache.set(o, o.visible);
        if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (o.material && (o.material.transparent || o.material.isShaderMaterial || o.material.isMeshBasicMaterial))) o.visible = false;
      });
    };
    composer.addPass(gtao);
  }
  bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.55, 0.9);
  if (params.get('bloom') !== '0') composer.addPass(bloom);
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uExposure: { value: 1 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uVig: { value: 0.32 }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uCA: { value: 0.0025 }, uFade: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uExposure, uSat, uContrast, uVig, uCA, uFade; uniform vec3 uLift, uGain; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5;
        float r2 = dot(c*vec2(0.5625,1.0), c*vec2(0.5625,1.0));
        vec2 off = c * uCA * r2 * 4.0;
        vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
        col *= uExposure;
        float l = dot(col, vec3(0.2126,0.7152,0.0722));
        col = mix(vec3(l), col, uSat);
        col = 0.18 * pow(max(col, 0.0) / 0.18, vec3(uContrast));
        col = col * uGain + uLift * (1.0 / (1.0 + l * 6.0));
        vec2 vc = c * vec2(1.0, 1.25);
        float v = smoothstep(0.78, 0.18, length(vc));
        col *= mix(1.0 - uVig, 1.0, v);
        col *= 1.0 - uFade;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  A.bloom = bloom;
  window.__ready = true;
}

function makeYardFence(x0, x1, zb, zf) {
  const g = new THREE.Group();
  const w = wood(21, [240, 236, 228]);
  const mat = new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normalMap, roughness: 0.65, color: '#ffffff' });
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, 0); shape.lineTo(0.045, 0); shape.lineTo(0.045, 0.6); shape.lineTo(0, 0.68); shape.lineTo(-0.045, 0.6); shape.closePath();
  const pg = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  const xs = [];
  for (let x = x0; x <= x1; x += 0.15) xs.push([x, zb, 0]);
  for (let z = zb + 0.15; z <= zf; z += 0.15) { xs.push([x0, z, 1]); xs.push([x1, z, 1]); }
  const inst = new THREE.InstancedMesh(pg, mat, xs.length);
  const d = new THREE.Object3D();
  xs.forEach(([x, z, side], i) => { d.position.set(x, 0, z); d.rotation.set(0, side ? Math.PI / 2 : 0, 0); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
  inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
  const rail = (a, b) => { const len = a.distanceTo(b); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, len), mat); m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.castShadow = true; g.add(m); };
  for (const y of [0.17, 0.48]) {
    rail(v3(x0, y, zb - 0.03), v3(x1, y, zb - 0.03));
    rail(v3(x0 - 0.03, y, zb), v3(x0 - 0.03, y, zf)); rail(v3(x1 + 0.03, y, zb), v3(x1 + 0.03, y, zf));
  }
  return g;
}

// ---------------------------------------------------------------- camera
// keys: [t, pos, target, fov, shift]; shift moves the image down so the subject (target) sits below the subtitle band
const CAM = [
  [0.0, [0.75, 3.1, 13.0], [0.45, 1.15, -2.0], 45, 0.12],
  [1.6, [0.0, 1.75, 5.8], [-1.75, 0.95, -0.85], 38, 0.2],
  [3.3, [0.6, 0.62, 2.7], [-1.35, 1.3, -0.9], 36, 0.22],
  [4.9, [1.1, 1.15, 5.0], [-0.7, 0.95, -1.0], 40, 0.2],
  [6.6, [2.8, 1.45, 6.4], [2.55, 0.95, -1.2], 40, 0.2],
  [8.3, [1.5, 1.45, 5.8], [-0.3, 0.85, -1.0], 38, 0.2],
  [9.7, [1.25, 1.15, 3.0], [0.25, 0.5, -0.9], 34, 0.22],
  [11.1, [0.78, 0.82, 1.6], [0.2, 0.42, -0.95], 32, 0.22],
  [12.4, [1.9, 0.4, 5.1], [1.5, -0.2, -0.3], 40, 0.18],
  [13.4, [2.2, 0.55, 4.9], [2.0, 0.0, -0.5], 40, 0.18],
  [14.9, [3.2, 1.05, 4.6], [3.05, 1.0, -1.2], 38, 0.1],
  [16.2, [1.45, 0.95, 2.6], [0.55, 0.45, -0.85], 34, 0.22],
  [17.7, [1.6, 0.72, 2.15], [0.65, 0.42, -0.8], 32, 0.22],
  [19.0, [2.45, 0.32, 4.4], [2.05, 0.0, -0.4], 38, 0.18],
  [20.2, [2.9, 0.95, 4.9], [2.7, 0.55, -1.0], 40, 0.2],
  [22.3, [1.4, 1.95, 9.2], [1.25, 0.85, -1.2], 42, 0.16],
  [23.6, [2.0, 0.95, 3.7], [1.45, 0.45, -0.5], 36, 0.22],
  [25.4, [2.6, 1.15, 4.6], [2.2, 0.6, -0.8], 38, 0.22],
  [26.8, [0.7, 1.35, 4.3], [-1.1, 1.1, -0.9], 36, 0.2],
  [28.6, [0.55, 1.22, 1.75], [-1.25, 1.32, -0.85], 30, 0.18],
  [30.0, [0.5, 1.5, 3.1], [-1.1, 1.38, -0.85], 34, 0.18],
  [31.6, [0.6, 1.18, 2.0], [-1.12, 1.38, -0.85], 30, 0.18],
  [33.4, [0.7, 1.5, 3.8], [-0.9, 1.25, -0.9], 34, 0.18],
  [35.4, [1.2, 3.0, 12.5], [0.3, 2.1, -6.0], 46, 0.06],
  [36.8, [1.25, 3.05, 12.2], [0.3, 2.15, -6.0], 46, 0.06],
  [38.6, [1.3, 2.3, 9.0], [0.9, 1.35, -4.0], 42, 0.1],
  [40.4, [0.45, 1.4, 3.7], [-1.1, 1.35, -0.85], 34, 0.18],
  [42.9, [0.3, 1.25, 1.05], [-1.2, 1.36, -0.85], 30, 0.24],
  [43.5, [0.32, 1.25, 1.1], [-1.18, 1.35, -0.85], 30.5, 0.24],
  [45.1, [1.5, 3.9, 10.8], [0.9, 0.2, -3.5], 46, 0.04],
  [46.4, [0.6, 2.8, 8.2], [-0.4, 0.8, -2.0], 42, 0.12],
  [48.0, [-3.4, 2.0, 2.8], [-1.4, 1.35, -1.2], 36, 0.2],
  [49.6, [-3.7, 1.6, 3.0], [-1.95, 0.8, -1.6], 38, 0.2],
  [51.4, [-3.0, 1.9, 3.5], [-1.4, 1.4, -1.1], 38, 0.2],
  [53.0, [0.35, 0.62, 2.0], [-1.25, 1.3, -0.85], 32, 0.2],
  [55.6, [0.42, 0.66, 1.75], [-1.25, 1.33, -0.85], 30, 0.2],
  [59.6, [4.0, 7.0, 18.0], [1.5, 2.2, -40.0], 46, 0.0],
  [61.4, [1.7, 2.5, 10.2], [1.2, 1.15, -3.0], 42, 0.14],
  [62.5, [3.2, 1.2, 3.9], [3.05, 1.0, -1.3], 38, 0.24],
  [63.1, [3.1, 1.2, 3.9], [2.9, 1.0, -1.3], 38, 0.24],
  [63.45, [1.6, 0.85, 3.2], [1.25, 0.5, -0.4], 34, 0.06],
  [64.15, [1.55, 0.86, 3.15], [1.22, 0.5, -0.4], 34, 0.06],
  [65.0, [0.55, 1.3, 2.7], [-1.2, 1.32, -0.85], 30, 0.2],
  [66.0, [0.35, 1.33, 2.3], [-1.22, 1.32, -0.85], 29, 0.2],
];
function hermite(p0, p1, m0, m1, s) {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
}
// Monotone (Fritsch-Carlson) tangents per component: smooth, C1, and never overshoots a key.
const CAM_TAN = (() => {
  const n = CAM.length; const out = [];
  for (let i = 0; i < n; i++) out.push({ pos: [0, 0, 0], tgt: [0, 0, 0] });
  for (const [key, idx] of [['pos', 1], ['tgt', 2]]) for (let c = 0; c < 3; c++) {
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((CAM[i + 1][idx][c] - CAM[i][idx][c]) / (CAM[i + 1][0] - CAM[i][0]));
    for (let i = 0; i < n; i++) {
      let m;
      if (i === 0 || i === n - 1) m = 0;
      else if (d[i - 1] * d[i] <= 0) m = 0;
      else { const h0 = CAM[i][0] - CAM[i - 1][0], h1 = CAM[i + 1][0] - CAM[i][0]; const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      out[i][key][c] = m;
    }
  }
  return out;
})();
function camAt(t) {
  const K = CAM;
  let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const k0 = K[i], k1 = K[i + 1];
  const dt = k1[0] - k0[0];
  const s = clamp((t - k0[0]) / dt);
  const res = { pos: [0, 0, 0], tgt: [0, 0, 0], fov: 0 };
  for (const [key, idx] of [['pos', 1], ['tgt', 2]]) {
    for (let c = 0; c < 3; c++) res[key][c] = hermite(k0[idx][c], k1[idx][c], CAM_TAN[i][key][c] * dt, CAM_TAN[i + 1][key][c] * dt, s);
  }
  res.fov = lerp(k0[3], k1[3], smooth(s));
  res.shift = lerp(k0[4] ?? 0.2, k1[4] ?? 0.2, smooth(s));
  return res;
}

// ---------------------------------------------------------------- per-frame update
const tmpV = new THREE.Vector3();
function update(t) {
  const at = T.animTime(t);
  U.uTime.value = at;
  const storm = T.storm(t), night = T.night(t), wind = T.wind(t), rainA = T.rain(t), wet = T.wetness(t);
  const fl = T.flash(t);
  U.uWind.value = wind; U.uWet.value = wet * 0.85; U.uNight.value = night;

  // ---------- camera ----------
  const c = camAt(t);
  const shakeA = 0.012 * storm + 0.006 * fl;
  const sx = noise1(t * 0.9 + 11) * shakeA, sy = noise1(t * 0.8 + 37) * shakeA;
  camera.position.set(c.pos[0] + sx, c.pos[1] + sy, c.pos[2]);
  camera.fov = c.fov; camera.updateProjectionMatrix();
  // lens shift (like a shift lens): keeps verticals straight, moves the subject below frame centre
  camera.projectionMatrix.elements[9] = c.shift;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.lookAt(c.tgt[0] + sx * 0.5, c.tgt[1] + sy * 0.5, c.tgt[2]);
  // handheld micro drift
  camera.rotateZ(noise1(t * 0.35 + 5) * 0.004);
  camera.updateMatrixWorld();

  // ---------- sky / lights / fog ----------
  const sk = A.sky.uniforms;
  sk.uTime.value = t; sk.uStorm.value = storm; sk.uNight.value = night; sk.uFlash.value = fl;
  const goldK = 1 - night;
  // key: warm low sun -> cool moon
  const sunDir = v3(-0.62, 0.3, 0.72).normalize();
  const moonDir = v3(0.35, 0.75, 0.55).normalize();
  const kd = sunDir.clone().lerp(moonDir, night).normalize();
  A.key.position.copy(A.key.target.position).addScaledVector(kd, 18);
  A.key.color.copy(new THREE.Color('#ffae62')).lerp(new THREE.Color('#8fa6d8'), night);
  A.key.intensity = lerp(3.4, 0.55 + 0.25 * (1 - storm), night);
  A.fill.color.copy(new THREE.Color('#ffd2ad')).lerp(new THREE.Color('#7f93c8'), night);
  A.fill.intensity = lerp(0.85, 0.42, night);
  A.rim.intensity = lerp(0.0, 1.1, night) + fl * 2.2;
  A.rim.color.copy(new THREE.Color('#9fb8ff')).lerp(new THREE.Color('#dfe8ff'), Math.min(1, fl * 2));
  A.hemi.color.copy(new THREE.Color('#a8c4ff')).lerp(new THREE.Color('#4a5a80'), night);
  A.hemi.groundColor.copy(new THREE.Color('#6a5032')).lerp(new THREE.Color('#1c1a1a'), night);
  A.hemi.intensity = lerp(0.6, 0.6, night) + fl * 0.5;
  scene.environment = night > 0.5 ? A.envStorm : A.envGold;
  scene.environmentIntensity = night > 0.5 ? lerp(0.0, 0.55, smooth((night - 0.5) * 2)) + fl * 0.25 : lerp(0.6, 0.0, smooth(night * 2));
  scene.fog.color.copy(new THREE.Color('#d6a07a')).lerp(new THREE.Color('#1a2030'), night).lerp(new THREE.Color('#5a6680'), fl * 0.12);
  scene.fog.density = lerp(0.0062, 0.011, storm) * (1 - 0.15 * (1 - storm) * night);
  U.uWinBoost.value = lerp(1.0, 1.25, night);

  // ---------- grading ----------
  const gu = grade.uniforms;
  gu.uExposure.value = lerp(1.0, 1.3, night) * (1 + fl * 0.08);
  gu.uSat.value = lerp(1.12, 1.0, storm);
  gu.uContrast.value = lerp(1.05, 1.1, storm);
  gu.uVig.value = lerp(0.3, 0.42, storm);
  gu.uGain.value.set(lerp(1.03, 0.94, night), 1.0, lerp(0.95, 1.08, night));
  gu.uLift.value.set(0.0, lerp(0.0, 0.004, night), lerp(0.0, 0.01, night));
  gu.uFade.value = clamp((t - 65.75) / 0.25) * 0.0;
  bloom.strength = lerp(0.42, 0.55, night);
  bloom.threshold = lerp(1.0, 0.95, night);
  bloom.radius = 0.45;

  // ---------- wheel + stand ----------
  A.standPivot.scale.setScalar(Math.max(1e-3, pop(t, E.standPop)));
  const wp = pop(t, E.wheelPop);
  A.wheelPivot.scale.setScalar(Math.max(1e-3, wp));
  A.wheelPivot.rotation.z = (1 - wp) * 0.6 * Math.sin(t * 9);
  const wAng = T.wheelAngle(t);
  A.wheel.rot.rotation.z = -wAng;
  const omega = T.runSpeed(t) * 1.6 * T.timeRate(t);
  U.uSmear.value = Math.min(0.06, omega / 60);
  const heat = ramp(t, E.smoke - 0.2, E.sparks + 0.6) * (1 - ramp(t, E.steam, E.steam + 1.6));
  A.wheel.hotMat.color.setRGB(heat * 4.5, heat * 1.2, heat * 0.15);
  A.hubLight.position.set(WHEEL.pos.x, WHEEL.pos.y, WHEEL.pos.z - 0.45);
  A.hubLight.intensity = heat * 2.5 + (t > E.sparks && t < E.sparksEnd ? 1.5 * hashf(Math.floor(t * 30)) * heat : 0);

  // ---------- generator ----------
  const gparts = A.gen.parts;
  const gSlide = smooth((t - E.genSlide) / 0.4) * GEN.slide;
  A.gen.group.position.set(GEN.pos0.x + gSlide, GEN.pos0.y, GEN.pos0.z);
  const gp = [['base', E.genBase], ['housing', E.genHousing], ['coil', E.genCoil], ['rotor', E.genMagnet]];
  for (const [k, te] of gp) { const s = Math.max(1e-3, pop(t, te)); gparts[k].scale.setScalar(s); gparts[k].visible = t > te - 0.01; }
  A.gen.pulley.scale.setScalar(Math.max(1e-3, pop(t, E.genPulley)));
  A.gen.pulley.visible = t > E.genPulley - 0.01;
  A.junction.scale.setScalar(Math.max(1e-3, pop(t, E.genPulley + 0.1)));
  const gAng = T.genAngle(t);
  const jAng = gAng / T.genRatio(t) * 2.2; // jackshaft angle (belt-driven)
  const jOmega = omega * 2.2 * ramp(t, E.genSpin - 0.1, E.genSpin + 0.4);
  const gOmega = omega * T.genRatio(t) * ramp(t, E.genSpin - 0.1, E.genSpin + 0.4);
  A.pulleyGhosts.update(-jAng, Math.min(0.9, jOmega / 60));
  A.gen.parts.magnetGhosts.update(-gAng, Math.min(1.2, gOmega / 55));
  // gears
  A.gears.bigG.scale.setScalar(Math.max(1e-3, pop(t, E.bigGear))); A.gears.bigG.visible = t > E.bigGear - 0.01;
  A.gears.stand.scale.setScalar(Math.max(1e-3, pop(t, E.gearStand))); A.gears.stand.visible = t > E.gearStand - 0.01;
  A.gears.smallG.position.set(GEN.pos0.x + gSlide, GEN.pos0.y, GEN.beltZ + 0.075);
  A.gears.smallG.scale.setScalar(Math.max(1e-3, pop(t, E.smallGear))); A.gears.smallG.visible = t > E.smallGear - 0.01;
  A.bigGhosts.update(-jAng, Math.min(0.5, jOmega / 60));
  A.smallGhosts.update(jAng * 3.0 + 0.16, Math.min(0.9, jOmega * 3 / 60));
  // belt
  const beltP = clamp((t - E.beltWhip) / 0.4);
  const bg = A.belt.mesh.geometry; bg.setDrawRange(0, Math.floor(bg.index.count * easeOut(beltP) / 6) * 6);
  A.belt.mesh.visible = beltP > 0;
  A.belt.tex.offset.y = -wAng * 1.168 * 3;
  // generator lead (junction <- generator terminal)
  updateLead(t);
  // crackles
  const crackOn = (t > E.genSpin + 0.2 && t < E.cableDigEnd + 0.4) || (t > E.fastSpin && t < E.fastSpin + 1.2);
  A.crackles.forEach((m, i) => { const h = hashf(Math.floor(t * 30) * 13 + i); m.visible = crackOn && h > 0.72; m.rotation.z = h * TAU; });
  A.genLight.position.copy(A.gen.group.position).add(v3(0, 0.1, 0.45));
  A.genLight.intensity = crackOn ? 0.35 * hashf(Math.floor(t * 30) * 7) : 0;

  // ---------- power / lights ----------
  let hl = T.houseLight(t);
  const bOn = T.batteryOn(t);
  const flickAmt = (ramp(t, 13.6, 13.9) * (1 - ramp(t, 17.3, 17.7)) * 0.35 + ramp(t, E.flickerStart, E.flickerStart + 0.1) * (1 - bOn)) * (t < E.batteryCable + 0.5 ? 1 : 0);
  const fn = 0.5 + 0.5 * noise1(t * 17.0) * 0.6 + 0.5 * noise1(t * 41.0 + 3) * 0.4;
  hl = clamp(hl * (1 - flickAmt * 0.85 * (1 - fn)));
  if (t > E.drainEnd) hl = 0;
  A.hl = hl;
  const L = A.house.lights;
  L.bLight.intensity = hl * lerp(1.0, 0.6, night); L.fLight.intensity = hl * lerp(1.7, 1.1, night); L.tLight.intensity = hl * lerp(0.9, 0.6, night);
  A.house.bulbMat.emissiveIntensity = hl * lerp(2.4, 1.3, night) + (hl > 0 ? 0.12 : 0);
  A.house.shadeMat.emissiveIntensity = hl * 1.0;
  A.house.windowGlass.forEach((m) => { m.emissiveIntensity = hl * lerp(1.1, 0.75, night); });
  U.uInterior.value = lerp(0.24, 1.0, hl);
  A.house.ledMat.color.setRGB(hl > 0.05 ? 0.2 : 2.5, hl > 0.05 ? 3.0 : 0.15, 0.1);
  A.house.backWindow.color.copy(new THREE.Color('#ffb070')).lerp(new THREE.Color('#0d1424'), night).multiplyScalar(1 + fl * 3);
  // TV
  const tvOn = t > E.tvOn && t < E.drainEnd ? 1 : 0;
  A.house.tvScreenMat.emissiveIntensity = tvOn * (1.4 + 0.2 * noise1(t * 6));
  A.house.tvLight.intensity = tvOn * 1.4;
  // city & neighbors & street lamps
  A.city.setPower((o) => T.cityPower(t, o));
  A.city.powerStation.userData.lights.forEach((l, i) => { const on = t < E.lightning + 0.08 ? 1 : (t > E.relightStart - 0.2 && t < E.blackout2 ? 1 : 0); l.visible = on > 0; });
  A.street.userData.lamps.forEach((lp, i) => { lp.mat.emissiveIntensity = T.cityPower(t, 0.05 + i * 0.02) * lerp(0.3, 3.0, night); });
  A.nh.forEach((h, i) => {
    const p = T.neighborPower(t, h.order);
    const wm = h.g.userData.windows[0].mat; wm.emissiveIntensity = p * lerp(0.15, 1.6, night) * (0.7 + 0.3 * hashf(i * 7));
  });
  // neighbors with candles
  A.neighbors.forEach((n, i) => {
    const t0 = E.neighborsStart + i * 0.17;
    const s = pop(t, t0);
    n.holder.visible = t > t0 - 0.01 && t < 66;
    n.holder.scale.setScalar(Math.max(1e-3, s));
    const cheer = ramp(t, E.cheer + i * 0.08, E.cheer + i * 0.08 + 0.3);
    const J = n.J;
    const bounce = cheer * Math.abs(Math.sin((t - E.cheer) * 9 + i)) * 0.06;
    n.root.position.y = bounce;
    J.shoulderL.rotation.set(lerp(-0.9, -2.7, cheer), 0, lerp(-0.2, 0.4, cheer));
    J.shoulderR.rotation.set(lerp(-0.9, -0.9, cheer), 0, lerp(0.2, -0.2, cheer));
    J.elbowL.rotation.set(lerp(-1.2, -0.3, cheer), 0, 0); J.elbowR.rotation.set(-1.2, 0, 0);
    // candle held in front with both hands (attached to root)
    n.J.candle.position.set(0.0, 0.08 + bounce * 0.2, 0.2);
    if (!n.frozen) setFace(n.face, { lid: 0.15, blink: blinkAt(t, i * 1.7), smile: lerp(0.35, 1.0, cheer), open: cheer * (0.5 + 0.3 * Math.sin(t * 7 + i)), brow: lerp(0.15, -0.05, cheer), look: [0, -0.05] });
    n.J.neck.rotation.set(0, Math.sin(t * 0.7 + i) * 0.15, 0);
    const flick = 0.85 + 0.15 * noise1(t * 8 + i * 3);
    n.glow.material.color.setRGB(2.2 * flick, 1.1 * flick, 0.35);
    n.back.material.emissiveIntensity = 0.5 * s * (1 - T.neighborPower(t, 0.5) * 0) ;
    J.candle.userData.flame.scale.set(0.8, 1.9 * flick, 0.8);
  });

  // ---------- cables & dots ----------
  const flow = T.flowPos(t);
  const digP = easeInOut2((t - E.cableDigStart) / (E.cableDigEnd - E.cableDigStart));
  const cm = A.cables.main; cm.glow = 0.0; cm.setReveal(digP); cm.density = T.dotDensity(t); cm.flow = flow * 3.0; cm.speed = 1;
  cm.coreMat.emissiveIntensity = 0.12 + 0.25 * cm.density;
  cm.dotStretch = T.flowSpeed(t) * 6;
  const cbP = easeInOut2((t - E.batteryCable) / 0.35);
  const cb = A.cables.batt; cb.setReveal(cbP); cb.density = t < E.drainStart ? T.dotDensity(t) * ramp(t, E.batteryFill - 0.2, E.batteryFill) : T.dotDensity(t);
  cb.flow = flow * 3.0; cb.dir = t < E.drainStart ? -1 : 1; cb.speed = t < E.drainStart ? 1 : 1 + ramp(t, E.drainStart, E.drainStart + 0.2) * 3;
  if (t > E.drainStart) cb.flow = flow * 3 + (t - E.drainStart) * 8;
  cb.dotStretch = cm.dotStretch;
  const cityDig = [['left', E.digNeighbors], ['right', E.digNeighbors + 0.15], ['deep', E.digCity]];
  for (const [k, t0] of cityDig) {
    const cc = A.cables[k]; cc.setReveal(easeInOut2((t - t0) / 1.25)); cc.density = ramp(t, E.splitDots, E.splitDots + 0.5) * T.dotDensity(t); cc.flow = flow * 3.2; cc.dotStretch = cm.dotStretch;
    cc.coreMat.emissiveIntensity = 0.12 + 0.3 * cc.density;
  }
  A.seams.forEach((s, i) => {
    const t0 = E.digNeighbors + 0.25 + i * 0.22 + (i === 4 ? 0.6 : 0);
    const p = easeInOut2((t - t0) / (i === 4 ? 1.6 : 1.1));
    const glow = ramp(t, E.splitDots + 0.2 + i * 0.1, E.splitDots + 0.8 + i * 0.1) * (t < E.blackout2 ? 1 : 1 - ramp(t, E.blackout2, E.blackout2 + 0.3));
    s.setReveal(p, glow); s.density = glow * T.dotDensity(t); s.flow = flow * 3.0;
    s.dotStretch = cm.dotStretch;
  });
  A.dots.update([cm, cb, A.cables.left, A.cables.right, A.cables.deep, ...A.seams], 1);
  A.dots.mat.color.setRGB(2.8, 1.9, 0.42);

  // tip sparks while digging
  A.tipSpark.visible = false;
  A.dirt.begin();
  const digTips = [];
  if (digP > 0 && digP < 1) digTips.push([cm, digP, E.cableDigStart]);
  if (cbP > 0 && cbP < 1) digTips.push([cb, cbP, E.batteryCable]);
  for (const [k, t0] of cityDig) { const cc = A.cables[k]; if (cc.reveal > 0 && cc.reveal < 1) digTips.push([cc, cc.reveal, t0]); }
  A.seams.forEach((s, i) => { if (s.reveal > 0 && s.reveal < 1) digTips.push([s, s.reveal, 0]); });
  digTips.forEach(([cab, p, t0], j) => {
    const tip = cab.pointAt(p);
    if (j === 0) { A.tipSpark.visible = true; A.tipSpark.position.copy(tip).add(v3(0, 0, 0.05)); A.tipSpark.scale.setScalar(0.22 + 0.06 * Math.sin(t * 40)); }
    for (let k = 0; k < 14; k++) {
      const age = ((t * 3 + k / 14 + j * 0.37) % 1) * 0.33;
      const born = t - age;
      const bp = cab.pointAt(Math.max(0, p - age * 0.25));
      const h1 = hashf(k * 3.1 + j * 17 + Math.floor((t * 3 + k / 14 + j * 0.37)) * 0.71), h2 = hashf(k * 5.7 + j), h3 = hashf(k * 9.2 + j * 3);
      const vel = v3((h1 - 0.5) * 2.2, 1.6 + h2 * 1.6, 0.6 + h3 * 1.4);
      const pos = bp.clone().addScaledVector(vel, age); pos.y -= 4.9 * age * age;
      A.dirt.push(pos, 0.014 + 0.012 * h3, age * 20 + k);
    }
  });

  // ---------- battery ----------
  const bpop = pop(t, E.batteryPop);
  A.battPivot.scale.setScalar(Math.max(1e-3, bpop)); A.battPivot.visible = t > E.batteryPop - 0.01;
  A.batt.parts.top.scale.setScalar(Math.max(1e-3, pop(t, E.batteryLid)));
  const charge = T.battery(t);
  const ch = A.batt.energy; ch.scale.y = Math.max(0.001, charge); ch.position.y = -0.26 + 0.26 * charge;
  A.batt.surf.position.y = -0.26 + 0.52 * charge; A.batt.surf.visible = charge > 0.01;
  const charging = t > E.batteryFill && t < E.batteryFull + 0.3;
  const eCol = new THREE.Color(0.15, 1.3, 0.9);
  A.batt.energyMat.color.copy(eCol).multiplyScalar(0.8 + 0.2 * Math.sin(t * 6) * (charging ? 1 : 0.3));
  const nb = Math.round(charge * 5 + 0.0001);
  A.batt.bars.forEach((m, i) => { const on = charge * 5 > i + 0.02; const col = i === 0 ? [3, 0.5, 0.2] : i < 2 ? [3, 2.2, 0.3] : [0.4, 3, 0.8]; m.color.setRGB(on ? col[0] : 0.04, on ? col[1] : 0.04, on ? col[2] : 0.05); });
  A.batt.glowLight.intensity = charge * 0.5;
  A.batt.bolt.material.color.setScalar(t > E.batteryLid ? (1 + 2 * charge) : 1);

  // ---------- cooling ----------
  const cp = A.cool.parts;
  for (const [k, te] of [['tank', E.coolTank], ['pump', E.coolTank + 0.1], ['rad', E.coolRadiator]]) { const s = Math.max(1e-3, pop(t, te)); cp[k].scale.setScalar(s); cp[k].visible = t > te - 0.01; }
  cp.pipes.forEach((pp, i) => { const p = clamp((t - E.coolPipes - i * 0.1) / 0.3); pp.mesh.geometry.setDrawRange(0, Math.floor(pp.count * easeOut(p) / 6) * 6); pp.mesh.visible = p > 0; });
  cp.jacket.scale.setScalar(Math.max(1e-3, pop(t, E.coolPipes + 0.35))); cp.jacket.visible = t > E.coolPipes + 0.34;
  cp.nozzles.forEach((n, i) => { n.scale.setScalar(Math.max(1e-3, pop(t, E.coolNozzle + i * 0.08))); n.visible = t > E.coolNozzle - 0.01; });
  cp.pumpFan.rotation.z = t > E.coolTank ? at * 30 : 0;
  cp.radFan.rotation.z = t > E.coolRadiator ? at * 22 : 0;

  // ---------- rod + snack ----------
  const rp = A.rod.parts;
  rp.pole.scale.setScalar(Math.max(1e-3, pop(t, E.rodPole))); rp.pole.visible = t > E.rodPole - 0.01;
  rp.rod.scale.setScalar(Math.max(1e-3, pop(t, E.rodPop))); rp.rod.visible = t > E.rodPop - 0.01;
  // rod pivot about the pole: scale from clamp point
  const drop = snap(t, E.snackDrop, 0.25);
  rp.dangle.visible = t > E.snackDrop;
  rp.line.scale.y = Math.max(0.001, drop); rp.line.position.y = -rp.lineLen * drop / 2;
  rp.donut.position.y = -rp.lineLen * drop - 0.07;
  const swing = Math.exp(-(t - E.snackDrop) * 0.6) * 0.18 * Math.sin((t - E.snackDrop) * 3.2) + 0.03 * Math.sin(at * 2.1);
  rp.dangle.rotation.set(swing * 0.4, 0, swing);
  rp.donut.rotation.y = at * 0.8;
  // pop the rod group: hide fully before
  A.rod.group.visible = t > E.rodPole - 0.01 && t < 34.35;
  const gone = 1 - smooth((t - 34.0) / 0.3);
  if (t > 34.0) { rp.pole.scale.setScalar(Math.max(1e-3, gone)); rp.rod.scale.setScalar(Math.max(1e-3, gone)); rp.dangle.scale.setScalar(Math.max(1e-3, gone)); }

  // ---------- John ----------
  updateJohn(t, at);
  {
    const hw = A.john.J.head.getWorldPosition(new THREE.Vector3());
    A.faceLight.position.copy(hw).add(v3(0.9, 0.35, 1.0));
    A.faceLight.intensity = lerp(0.0, 0.9, ramp(t, 33.6, 35.0)) * (t > 64.0 ? lerp(1, 0.35, ramp(t, 64.0, 64.2)) : 1);
    A.faceLight.color.copy(new THREE.Color('#ffc890')).lerp(new THREE.Color('#a8c4ff'), ramp(t, 64.0, 64.2));
  }
  // ---------- Dad ----------
  updateDad(t, at);

  // ---------- weather fx ----------
  const ru = A.rain.uniforms;
  ru.uTime.value = at; ru.uAmount.value = rainA; ru.uWind.value = wind * 0.8;
  ru.uCam.value.copy(camera.position);
  ru.uCenter.value.copy(camera.position).add(camera.getWorldDirection(tmpV).multiplyScalar(5));
  ru.uLen.value = lerp(0.07, 0.34, T.timeRate(t) ** 1.2);
  ru.uBright.value = 0.7 + fl * 2.5;
  A.rain.mesh.visible = rainA > 0.001;
  A.splash.uniforms.uTime.value = at; A.splash.uniforms.uAmount.value = rainA; A.splash.uniforms.uBright.value = 0.8 + fl * 2;
  A.splash.mesh.visible = rainA > 0.001;
  // trees sway
  (A.trees || []).forEach((tr, i) => { const c2 = tr.userData.canopy; c2.rotation.z = Math.sin(at * (0.8 + wind * 2.5) + i) * (0.02 + wind * 0.08) - wind * 0.06; c2.rotation.x = Math.cos(at * 0.9 + i * 2) * (0.015 + wind * 0.04); });
  // wet materials
  for (const m of [A.wheel.rimMat, A.wheel.slatMat]) { m.clearcoat = lerp(0.3, 1.0, wet); m.clearcoatRoughness = lerp(0.35, 0.05, wet); }
  const jm = A.john.mats;
  jm.hoodie.color.setScalar(lerp(1, 0.72, wet)); jm.hoodieDark.color.setScalar(lerp(1, 0.72, wet)); jm.pants.color.setScalar(lerp(1, 0.75, wet));
  jm.skin.clearcoat = lerp(0.08, 0.7, wet); jm.skin.clearcoatRoughness = lerp(0.6, 0.15, wet);
  jm.hair.clearcoat = lerp(0.2, 1.0, wet);

  // lightning bolts
  A.strikeBolts.forEach((b, i) => { const ft = [36.0, 36.09, 36.17][i]; b.visible = t >= ft && t < ft + 0.06; });
  const skyF = [[35.25, 0], [39.3, 1], [42.1, 2], [45.4, 3], [48.2, 0], [53.55, 1], [54.85, 2], [55.75, 3], [58.3, 0]];
  A.skyBolts.forEach((b) => (b.visible = false));
  for (const [ft, bi] of skyF) if (t >= ft && t < ft + 0.07 * (t > 53 && t < 57 ? 3.5 : 1)) A.skyBolts[bi].visible = true;
  // power station explosion
  const st = A.city.station.clone().add(A.city.powerStation.userData.strikePoint);
  const boomT = t - (E.lightning + 0.03);
  A.boom.position.copy(st).add(v3(0, 2, 6));
  A.boom.intensity = boomT > 0 && boomT < 1.2 ? 4000 * Math.exp(-boomT * 5) : 0;

  // ---------- particles ----------
  A.smoke.begin(); A.sparks.begin(); A.glows.begin(); A.mist.begin(); A.drops.begin();
  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  // explosion glow + plume at power station
  if (boomT > 0 && boomT < 0.9) A.glows.push(st, [6, 5, 7], Math.exp(-boomT * 4), 18 + boomT * 20);
  if (boomT > 0) {
    for (let i = 0; i < 40; i++) {
      const age = ((boomT * 0.5 + i / 40) % 1) * 4.0; if (age > boomT) continue;
      const h = hashf(i * 3.3);
      const p = st.clone().add(v3((h - 0.5) * 3 + age * 2.0, age * 3.5, (hashf(i) - 0.5) * 2));
      A.smoke.push(p, [0.12 + fl * 0.5, 0.12 + fl * 0.5, 0.14 + fl * 0.6], 0.55 * (1 - age / 4), 4 + age * 4, h * 6);
    }
    if (boomT < 1.5) for (let i = 0; i < 60; i++) {
      const age = boomT; const h1 = hashf(i), h2 = hashf(i + 50), h3 = hashf(i + 99);
      const vel = v3((h1 - 0.5) * 30, 10 + h2 * 20, (h3 - 0.5) * 20);
      const p = st.clone().addScaledVector(vel, age); p.y -= 4.9 * age * age;
      A.sparks.push(p, [6, 3.5, 1.2], Math.max(0, 1 - age / 1.5), 0.25, 0, vel, 0.04);
    }
  }
  // axle smoke -> steam
  const hub = v3(WHEEL.pos.x, WHEEL.pos.y, WHEEL.pos.z - 0.45);
  const smokeOn = ramp(t, E.smoke, E.smoke + 0.6) * (1 - ramp(t, 52.4, 53.3));
  const steamK = ramp(t, E.steam, E.steam + 1.0);
  if (smokeOn > 0) {
    const N = 90;
    for (let i = 0; i < N; i++) {
      const life = 2.6;
      const age = ((at * 0.55 + i / N) % 1) * life;
      const h1 = hashf(i * 1.7), h2 = hashf(i * 2.9), h3 = hashf(i * 4.1);
      const p = hub.clone().add(v3((h1 - 0.5) * 0.3 + age * (0.35 + wind * 0.5), age * (0.55 + h2 * 0.3) + age * age * 0.05, (h3 - 0.5) * 0.3 + age * 0.15));
      const sz = 0.18 + age * 0.33 * (1 + steamK * 0.4);
      const a = smokeOn * (1 - age / life) * Math.min(1, age * 5) * lerp(0.55, 0.5, steamK);
      const lit = 0.35 + fl * 1.5 + heat * 0.4;
      const cc = [lerp(0.22, 0.95, steamK) * lit, lerp(0.21, 0.97, steamK) * lit, lerp(0.22, 1.0, steamK) * lit];
      A.smoke.push(p, cc, a, sz, h1 * 6 + age * 0.4);
    }
  }
  // extra steam bursts after cooling
  if (steamK > 0) {
    for (let i = 0; i < 60; i++) {
      const life = 1.8; const age = ((at * 0.7 + i / 60) % 1) * life;
      const h1 = hashf(i * 7.7), h2 = hashf(i * 3.1);
      const ang = h1 * TAU;
      const p = hub.clone().add(v3(Math.cos(ang) * (0.2 + age * 0.6), 0.1 + age * 0.7 + Math.sin(ang) * 0.3 * age, 0.25 + h2 * 0.3 + age * 0.3));
      const lit = 0.6 + fl * 1.5;
      A.smoke.push(p, [0.95 * lit, 0.97 * lit, 1.0 * lit], steamK * 0.4 * (1 - age / life) * Math.min(1, age * 6) * (1 - ramp(t, 52.4, 53.3)), 0.2 + age * 0.45, h1 * 5);
    }
  }
  // sparks from axle
  const sparkOn = ramp(t, E.sparks, E.sparks + 0.2) * (1 - ramp(t, E.sparksEnd - 0.1, E.sparksEnd + 0.2));
  if (sparkOn > 0) {
    for (let i = 0; i < 110; i++) {
      const life = 0.55; const age = ((at * 2.2 + i / 110) % 1) * life;
      const cyc = Math.floor(at * 2.2 + i / 110);
      const h1 = hashf(i * 1.3 + cyc * 7.1), h2 = hashf(i * 2.1 + cyc), h3 = hashf(i * 5.3 + cyc * 3);
      const ang = h1 * TAU;
      const vel = v3(Math.cos(ang) * (2.0 + h2 * 2.5), Math.sin(ang) * (2.0 + h2 * 2.5) + 1.0, 1.2 + h3 * 2.0);
      const p = hub.clone().add(v3(Math.cos(ang) * 0.17, Math.sin(ang) * 0.17, 0.05)).addScaledVector(vel, age); p.y -= 4.9 * age * age;
      const fade = 1 - age / life;
      A.sparks.push(p, [6 * fade + 2, 3 * fade + 0.6, 0.6], sparkOn * fade, 0.022, 0, v3(vel.x, vel.y - 9.8 * age, vel.z), 0.035);
    }
    A.glows.push(hub.clone().add(v3(0, 0, 0.1)), [4, 1.6, 0.4], sparkOn * (0.6 + 0.4 * hashf(Math.floor(t * 30))), 0.9);
  }
  // mist from nozzles
  const mistOn = ramp(t, E.mist, E.mist + 0.3) * (1 - ramp(t, 52.6, 53.3));
  if (mistOn > 0) {
    cp.nozzles.forEach((nz, j) => {
      const np = nz.getWorldPosition(new THREE.Vector3());
      for (let i = 0; i < 70; i++) {
        const life = 0.5; const age = ((at * 3 + i / 70 + j * 0.5) % 1) * life;
        const cyc = Math.floor(at * 3 + i / 70 + j * 0.5);
        const h1 = hashf(i * 3.7 + cyc + j * 11), h2 = hashf(i * 1.9 + cyc * 2 + j), h3 = hashf(i * 6.1 + cyc * 5);
        const dir = hub.clone().sub(np).normalize().add(v3((h1 - 0.5) * 0.7, (h2 - 0.5) * 0.7, (h3 - 0.2) * 0.6)).normalize();
        const p = np.clone().addScaledVector(dir, age * 2.2);
        const lit = 0.7 + fl;
        A.mist.push(p, [0.8 * lit, 0.9 * lit, 1.0 * lit], mistOn * 0.35 * (1 - age / life), 0.05 + age * 0.35, h1 * 6);
      }
    });
  }
  // sweat drops (scene 5) and rain drips from the sweatband (scene 7)
  const J = A.john.J;
  const headW = J.sweatAnchor.getWorldPosition(new THREE.Vector3());
  const sweatOn = ramp(t, 27.2, 27.6) * (1 - ramp(t, 31.0, 31.6));
  if (sweatOn > 0) for (let i = 0; i < 10; i++) {
    const life = 0.7; const age = ((at * 1.4 + i / 10) % 1) * life;
    const h1 = hashf(i * 2.3 + Math.floor(at * 1.4 + i / 10)), h2 = hashf(i * 4.4);
    const vel = v3(-1.2 - h1 * 0.6, 1.0 + h2 * 0.8, (h1 - 0.5) * 1.6);
    const p = headW.clone().add(v3(-0.05, 0.08, (h2 - 0.5) * 0.2)).addScaledVector(vel, age); p.y -= 4.9 * age * age;
    A.drops.push(p, 0.016 * sweatOn, 0, 1.4);
  }
  const dripOn = ramp(t, 40.2, 40.6) * (1 - ramp(t, 59.6, 60.5)) + ramp(t, 64.2, 64.6);
  if (dripOn > 0) for (let i = 0; i < 6; i++) {
    const life = 0.55; const ph = (at * 1.1 + i / 6) % 1; const age = ph * life;
    const h1 = hashf(i * 3.1);
    const base = J.band.getWorldPosition(new THREE.Vector3()).add(v3(0.12 + (h1 - 0.5) * 0.12, -0.05, (h1 - 0.5) * 0.3));
    const p = base.clone(); p.y -= 2.5 * age * age; p.x -= age * 0.3;
    A.drops.push(p, 0.012 * Math.min(1, dripOn), 0, 1.6);
  }
  // candle glows already sprites; dirt done
  A.smoke.end(camera); A.sparks.end(camera, false); A.glows.end(camera, false); A.mist.end(camera); A.drops.end(); A.dirt.end();
}

function easeOut(x) { x = clamp(x); return 1 - (1 - x) * (1 - x); }
function easeInOut2(x) { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
function blinkAt(t, off = 0) {
  const period = 3.1 + (off % 1.3);
  const ph = ((t + off) % period) / period;
  const d = Math.abs(ph - 0.5) * period; // seconds from blink center
  return d < 0.09 ? 1 - d / 0.09 : 0;
}

function updateLead(t) {
  const gpos = A.gen.group.position;
  const key = gpos.x.toFixed(4) + (t > E.genPulley + 0.1 ? 'a' : 'b');
  if (A.leadKey === key) return;
  A.leadKey = key;
  if (A.leadMesh) { A.leadMesh.geometry.dispose(); scene.remove(A.leadMesh); }
  const tp = A.gen.parts.terminal.clone().add(gpos);
  const jp = A.junction.position;
  const curve = new THREE.CatmullRomCurve3([tp, tp.clone().add(v3(0.1, -0.1, 0.05)), v3((tp.x + jp.x) / 2 + 0.05, 0.06, (tp.z + jp.z) / 2), jp.clone().add(v3(0, 0, -0.06))]);
  A.leadMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.022, 8, false), new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.5 }));
  A.leadMesh.castShadow = true;
  A.leadMesh.visible = t > E.genPulley + 0.1;
  scene.add(A.leadMesh);
}

// ---------------- John animation ----------------
function updateJohn(t, at) {
  const { root, J, face } = A.john;
  const run = ramp(t, E.runStart, E.runStart + 0.5) * (1 - ramp(t, 64.15, 64.9));
  const speed = T.runSpeed(t);
  const phase = T.wheelAngle(t) * T.RUN_PHASE_PER_RAD;
  const inside = v3(WHEEL.pos.x + 0.06 + 0.1 * clamp(speed - 0.5, 0, 1.5), 0, -0.85);
  const rIn = WHEEL.slatR - 0.0225;
  inside.y = WHEEL.pos.y - Math.sqrt(rIn * rIn - (inside.x - WHEEL.pos.x) ** 2);
  const start = v3(-2.25, 0, -0.05);
  let pos = start.clone(), rotY = Math.PI / 2, rotZ = 0;
  const p = { phase, run, intensity: clamp(0.55 + 0.35 * speed, 0.4, 1.35), stand: {}, headYaw: 0, headPitch: 0 };
  const f = { lid: 0.14, blink: blinkAt(t, 0.3), smile: 0.7, open: 0, brow: 0, look: [0, 0] };
  const st = p.stand;
  // ---- scene 1 choreography ----
  if (t < E.johnHop) {
    // idle, look at wheel as it pops
    const lookW = ramp(t, E.wheelPop - 0.1, E.wheelPop + 0.25);
    p.headYaw = lerp(-0.45, 0.75, lookW); p.headPitch = lerp(0.0, -0.32, lookW);
    f.look = [lerp(-0.2, 0.25, lookW), lerp(0, 0.2, lookW)];
    const surprise = ramp(t, E.wheelPop, E.wheelPop + 0.15) * (1 - ramp(t, 1.0, 1.2));
    f.brow = 0.3 * surprise; f.browY = 0.012 * surprise; f.lid = lerp(0.14, -0.08, surprise); f.open = 0.35 * surprise; f.smile = lerp(0.7, 0.2, surprise);
    st.shLz = 0.2 + 0.15 * surprise; st.shRz = -0.2 - 0.15 * surprise;
    // anticipation crouch
    const cr = ramp(t, 1.0, 1.4);
    st.hipL = -0.55 * cr; st.hipR = -0.55 * cr; st.kneeL = 1.0 * cr; st.kneeR = 1.0 * cr; st.ankleL = -0.45 * cr; st.ankleR = -0.45 * cr;
    st.lean = 0.35 * cr; st.shLx = 0.7 * cr; st.shRx = 0.7 * cr;
    p.lift = -0.09 * cr;
    if (cr > 0) { p.headYaw = lerp(p.headYaw, 0.2, cr); p.headPitch = lerp(p.headPitch, -0.15, cr); f.smile = 0.9; f.brow = -0.1 * cr; }
    pos.y += 0.008 * Math.sin(t * 2.5);
  } else if (t < E.stretch) {
    const u = clamp((t - E.johnHop) / (E.stretch - 0.1 - E.johnHop));
    pos = start.clone().lerp(inside, smooth(u)); pos.y += Math.sin(u * Math.PI) * 0.5;
    st.hipL = -1.0; st.hipR = -0.7; st.kneeL = 1.5; st.kneeR = 1.2; st.shLx = -2.2; st.shRx = -2.0; st.shLz = 0.4; st.shRz = -0.4; st.elLx = -0.3; st.elRx = -0.3;
    st.lean = 0.1; f.open = 0.5; f.smile = 1; f.brow = 0.15;
    const land = ramp(t, E.stretch - 0.12, E.stretch);
    p.lift = -0.06 * land;
  } else if (t < E.runStart) {
    pos = inside.clone();
    // stretch arms overhead
    const s = ramp(t, E.stretch, E.stretch + 0.25) * (1 - ramp(t, E.sweatband - 0.15, E.sweatband + 0.05));
    const sway = Math.sin((t - E.stretch) * 6.0) * s;
    st.shLx = lerp(0.05, -2.95, s); st.shRx = lerp(0.05, -2.95, s); st.shLz = lerp(0.13, 0.25, s); st.shRz = lerp(-0.13, -0.25, s);
    st.elLx = lerp(-0.12, -0.15, s); st.elRx = lerp(-0.12, -0.15, s);
    st.sideBend = 0.22 * sway; st.lean = -0.08 * s;
    f.lid = lerp(0.14, 0.85, s); f.smile = lerp(0.7, 1.0, s); f.open = 0.25 * s;
    p.headPitch = -0.15 * s; p.lift = 0.02 * s;
    // sweatband tighten
    const b = ramp(t, E.sweatband, E.sweatband + 0.2) * (1 - ramp(t, E.runStart - 0.2, E.runStart));
    if (b > 0) {
      st.shLx = lerp(st.shLx, -1.6, b); st.shRx = lerp(st.shRx, -1.6, b); st.shLz = lerp(st.shLz, 0.95, b); st.shRz = lerp(st.shRz, -0.95, b);
      st.shLy = lerp(0, -0.5, b); st.shRy = lerp(0, 0.5, b);
      st.elLx = lerp(st.elLx, -2.3, b); st.elRx = lerp(st.elRx, -2.3, b);
      const pull = Math.max(0, Math.sin(clamp((t - E.sweatband - 0.25) / 0.3) * Math.PI));
      J.band.scale.set(1.04 + 0.05 * pull, 1.0 + 0.05 * pull, 1.0);
      f.lid = lerp(f.lid, 0.3, b); f.brow = lerp(f.brow, -0.35, b); f.smile = lerp(f.smile, 0.35, b); f.open = 0;
      p.headPitch = lerp(p.headPitch, 0.08 + 0.06 * pull, b);
    }
    const ready = ramp(t, E.runStart - 0.25, E.runStart);
    st.lean = lerp(st.lean, 0.25, ready); st.kneeL = 0.3 * ready; st.kneeR = 0.3 * ready; st.hipL = -0.25 * ready; st.hipR = -0.15 * ready;
    p.headYaw = lerp(0, -0.35, ramp(t, E.stretch + 0.3, E.stretch + 0.6) * (1 - ramp(t, E.sweatband, E.sweatband + 0.3)));
  } else {
    pos = inside.clone();
    const slope = Math.asin(clamp((inside.x - WHEEL.pos.x) / rIn, -0.5, 0.5));
    rotZ = slope * 0.8;
    rotY = Math.PI / 2 - 0.3 * ramp(t, E.runStart - 0.3, E.runStart + 0.3);
  }
  if (t < E.sweatband || t > E.runStart) J.band.scale.set(1.04, 1, 1);
  // ---- faces by story section ----
  if (t >= E.runStart) {
    f.smile = 0.85; f.lid = 0.16; f.brow = -0.05; p.headYaw = 0.0;
    // scene 1 end / scene 2: focused & happy
    if (t > 20.3 && t < 23.4) { // flicker: speed changes
      const slow = clamp((1.0 - speed) / 0.5);
      f.brow = 0.25 * slow - 0.2 * (1 - slow); f.open = 0.4 * slow; f.smile = lerp(0.7, 0.2, slow); f.lid = lerp(0.16, 0.35, slow);
    }
    // scene 3 – look at house briefly when bulb glows
    if (t > 13.8 && t < 15.2) { p.headYaw = -0.6 * ramp(t, 13.8, 14.1) * (1 - ramp(t, 14.9, 15.2)); }
    // tired (scene 5)
    const tired = ramp(t, E.tiredStart + 0.3, 28.6) * (1 - ramp(t, E.eyesWide, E.eyesWide + 0.15));
    if (tired > 0) {
      const pant = at * 9.0;
      f.lid = lerp(f.lid, 0.5, tired); f.brow = lerp(f.brow, 0.32, tired); f.open = lerp(f.open, 0.45 + 0.25 * Math.sin(pant), tired); f.smile = lerp(f.smile, 0.1, tired);
      p.headPitch = 0.18 * tired + 0.05 * Math.sin(pant) * tired; p.pant = pant * tired; p.extraLean = 0.1 * tired;
      p.intensity *= lerp(1, 0.7, tired);
      f.look = [0, 0.15 * tired];
    }
    const wide = ramp(t, E.eyesWide, E.eyesWide + 0.12) * (1 - ramp(t, 33.6, 34.2));
    if (wide > 0) {
      f.lid = lerp(f.lid, -0.18, wide); f.brow = lerp(f.brow, 0.35, wide); f.browY = 0.015 * wide; f.open = lerp(f.open, 0.55, wide); f.smile = lerp(f.smile, 1.0, wide);
      // look at donut (up-front, toward camera side)
      p.headYaw = lerp(p.headYaw, -0.45, wide); p.headPitch = lerp(p.headPitch, -0.12, wide);
      f.look = [lerp(0, -0.35, wide), lerp(0, 0.12, wide)];
      const chase = ramp(t, E.chase, E.chase + 0.4);
      p.extraLean = 0.12 * chase;
      // reach for snack with one arm occasionally
      if (chase > 0) { const reach = Math.max(0, Math.sin((t - E.chase) * 2.2)) * chase; J.__reach = reach; }
    }
    // storm: determined
    const det = ramp(t, 33.8, 34.6) * (1 - ramp(t, 59.6, 60.2));
    if (det > 0) {
      f.brow = lerp(f.brow, -0.38, det); f.lid = lerp(f.lid, 0.17, det); f.smile = lerp(f.smile, 0.25, det); f.open = lerp(f.open, 0.0, det);
      p.headYaw = lerp(p.headYaw, 0.0, det); f.look = [0, 0];
    }
    // face push-in: look slightly toward camera
    const fc = ramp(t, 40.6, 41.4) * (1 - ramp(t, 43.3, 43.8));
    if (fc > 0) { p.headYaw = lerp(p.headYaw, -0.38, fc); f.look = [-0.22 * fc, 0.05 * fc]; f.brow = -0.45 * fc + f.brow * (1 - fc); }
    // straining in scene 8
    const strain = ramp(t, 46.8, 47.4) * (1 - ramp(t, 52.8, 53.2));
    if (strain > 0) { f.open = lerp(f.open, 0.22, strain); f.smile = lerp(f.smile, 0.0, strain); }
    // slow-mo yell
    const yell = ramp(t, 53.2, 53.8) * (1 - ramp(t, 58.5, 59.3));
    if (yell > 0) { f.open = lerp(f.open, 0.78, yell); f.brow = lerp(f.brow, -0.45, yell); f.lid = lerp(f.lid, 0.22, yell); p.headPitch = lerp(p.headPitch ?? 0, -0.12, yell); }
    // proud scene 10
    const proud = ramp(t, 59.8, 60.4) * (1 - ramp(t, 64.0, 64.2));
    if (proud > 0) { f.smile = lerp(f.smile, 1.0, proud); f.lid = lerp(f.lid, 0.25, proud); f.brow = lerp(f.brow, 0.05, proud); f.open = lerp(f.open, 0.15, proud); }
    // stare after blackout
    const stare = ramp(t, 64.3, 64.9);
    if (stare > 0) {
      f.smile = lerp(f.smile, 0.0, stare); f.open = lerp(f.open, 0.22, stare); f.lid = lerp(f.lid, -0.02, stare); f.brow = lerp(f.brow, 0.22, stare); f.browY = 0.008 * stare;
      p.headYaw = lerp(p.headYaw, -0.95, ramp(t, 64.6, 65.2)); p.headPitch = lerp(0, 0.05, stare);
      f.look = [lerp(0, -0.25, stare), 0.0];
      f.blink = t > 65.45 && t < 65.62 ? Math.sin((t - 65.45) / 0.17 * Math.PI) : 0;
      st.shLx = 0.05; st.shRx = 0.05; st.shLz = 0.1; st.shRz = -0.1; st.elLx = -0.1; st.elRx = -0.1; st.lean = 0.0;
      p.lift = -0.02 * stare;
    }
  }
  poseJohn(J, p);
  // snack reach overrides right arm
  if (J.__reach) { const r = J.__reach; J.shoulderR.rotation.x = lerp(J.shoulderR.rotation.x, -1.75, r); J.elbowR.rotation.x = lerp(J.elbowR.rotation.x, -0.3, r); J.__reach = 0; }
  setFace(face, f);
  root.position.copy(pos);
  root.rotation.set(0, rotY, 0);
  root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), rotZ);
}

// ---------------- Dad animation ----------------
function updateDad(t, at) {
  const { J, face } = A.dad;
  const breathe = Math.sin(at * 1.6) * 0.012;
  J.spine.rotation.set(-0.08 + breathe, 0, 0);
  let yaw = 0.35, pitch = 0.0;
  const f = { lid: 0.2, blink: blinkAt(t, 1.1), smile: 0.45, open: 0, brow: 0.0, look: [0.15, 0] };
  // dim bulb: look up at it
  const lookBulb = ramp(t, 13.9, 14.3) * (1 - ramp(t, 17.0, 17.6));
  yaw = lerp(yaw, 0.15, lookBulb); pitch = lerp(pitch, -0.45, lookBulb); f.brow = 0.2 * lookBulb; f.look = [0, 0.25 * lookBulb];
  // flicker: squint
  const sq = ramp(t, 20.4, 20.7) * (1 - ramp(t, 24.0, 24.4));
  f.lid = lerp(f.lid, 0.5, sq); f.brow = lerp(f.brow, -0.2, sq); f.smile = lerp(f.smile, 0.15, sq);
  // steady: smile + nod
  const happy = ramp(t, 24.4, 24.8) * (1 - ramp(t, 33.6, 34.0));
  f.smile = lerp(f.smile, 0.95, happy);
  // storm: look out the window, worried
  const worry = ramp(t, 34.0, 34.5) * (1 - ramp(t, 40.0, 40.5));
  yaw = lerp(yaw, -0.6, worry); f.brow = lerp(f.brow, 0.3, worry); f.smile = lerp(f.smile, 0.2, worry);
  // remote: lift arm and press
  const lift = ramp(t, E.remote - 0.45, E.remote - 0.05);
  J.shoulderR.rotation.set(lerp(-0.45, -1.15, lift), 0, -0.15);
  J.elbowR.rotation.set(lerp(-0.95, -0.55, lift), 0, 0);
  const press = t > E.remote && t < E.remote + 0.15 ? 1 : 0;
  A.dad.J.remoteBtn.scale.setScalar(press ? 0.6 : 1);
  // watching TV happily
  const tv = ramp(t, E.tvOn, E.tvOn + 0.3) * (1 - ramp(t, 64.0, 64.1));
  yaw = lerp(yaw, 0.5, tv); f.smile = lerp(f.smile, 1.0, tv); f.lid = lerp(f.lid, 0.15, tv); f.brow = lerp(f.brow, 0.1, tv);
  // blackout shock
  const shock = ramp(t, 64.05, 64.25);
  f.lid = lerp(f.lid, -0.12, shock); f.brow = lerp(f.brow, 0.35, shock); f.open = lerp(f.open, 0.3, shock); f.smile = lerp(f.smile, 0.0, shock);
  J.neck.rotation.set(pitch, yaw, 0);
  setFace(face, f);
}

// ---------------------------------------------------------------- API
window.APP = {
  init,
  render(frame) {
    const t = frame / T.FPS;
    update(t);
    composer.render();
    return true;
  },
  renderTime(t) { update(t); composer.render(); return true; },
  bench(t, n = 3) {
    const gl = renderer.getContext(); const px = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    update(t); composer.render(); sync();
    renderer.info.autoReset = false; renderer.info.reset();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { update(t + i / 30); composer.render(); sync(); }
    const t1 = performance.now();
    const calls = renderer.info.render.calls / n, tris = renderer.info.render.triangles / n;
    renderer.info.autoReset = true;
    // main pass only (no post)
    const t2 = performance.now();
    for (let i = 0; i < n; i++) { renderer.setRenderTarget(null); renderer.render(scene, camera); sync(); }
    const t3 = performance.now();
    // shadow only cost estimate: render with shadows disabled
    renderer.shadowMap.autoUpdate = false;
    const t4 = performance.now();
    for (let i = 0; i < n; i++) { renderer.setRenderTarget(null); renderer.render(scene, camera); sync(); }
    const t5 = performance.now();
    renderer.shadowMap.autoUpdate = true;
    return { frame: (t1 - t0) / n, calls, tris, mainPass: (t3 - t2) / n, mainNoShadow: (t5 - t4) / n };
  },
  stats() {
    const rows = [];
    for (const [k, v] of Object.entries(A)) {
      const o = v && (v.isObject3D ? v : v.group || v.root || v.mesh);
      if (!o || !o.isObject3D) continue;
      let tris = 0, calls = 0, cast = 0;
      o.traverse((m) => { if (m.isMesh) { const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; const ic = m.isInstancedMesh ? m.count : (g.isInstancedBufferGeometry ? g.instanceCount : 1); tris += n * ic; calls++; if (m.castShadow) cast++; } });
      rows.push([k, Math.round(tris), calls, cast]);
    }
    let tot = 0, calls = 0; scene.traverse((m) => { if (m.isMesh) { calls++; } });
    rows.sort((a, b) => b[1] - a[1]);
    return { rows: rows.slice(0, 25), meshes: calls };
  },
  async pixels() {
    const gl = renderer.getContext();
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const blob = new Blob([buf]);
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.slice(r.result.indexOf(',') + 1)); r.readAsDataURL(blob); });
  },
  async png() {
    return renderer.domElement.toDataURL('image/png').split(',')[1];
  },
};
