// Reel runtime: deterministic renderAt(t) for frame-by-frame capture.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSets, OFFSETS, makeFoodPlate, makeIron, makeComb, makePerfume, makePen, makeDivorcePaper, makePlateStack, makeSweetsBox, makeTaco } from './sets.js';
import { makeHusband, makeWife, makeDad, makeMom, makeDog } from './chars.js';
import { FX } from './fx.js';
import { buildShots } from './shots.js';
import { clamp, lerp, noise1, easeOutBack } from './lib.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const K = W / 1080; // UI scale

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const overlay = document.getElementById('overlay');
overlay.width = W; overlay.height = H;
const octx = overlay.getContext('2d');
const capEl = document.getElementById('caption');
capEl.style.fontSize = `${Math.round(78 * K)}px`;
capEl.style.setProperty('--stroke', `${Math.max(3, Math.round(15 * K))}px`);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 200);

// ---- lights (shared, re-configured per set) ----
const hemi = new THREE.HemisphereLight(0xffe2b8, 0x6a4128, 1.6); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd29e, 2.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
scene.add(key); scene.add(key.target);
const fill = new THREE.PointLight(0xffa25a, 18, 12, 2); scene.add(fill);
const fill2 = new THREE.PointLight(0xffd6a0, 10, 10, 2); scene.add(fill2);

const LIGHTS = {
  bedroom: { sky: 0xffe6c4, ground: 0x7a4a2a, hemiI: 1.7, key: 0xffd9a8, keyI: 2.3, keyPos: [3, 7, 5], keyT: [0, 0, -1.5], f1: 0xffa25a, f1I: 14, f1Pos: [-3.2, 2.6, -1.5], f2: 0xfff0d0, f2I: 8, f2Pos: [1.5, 2.6, 1.5], exp: 1.0, bg: 0x2a1c14 },
  door: { sky: 0xffe0b0, ground: 0x6d5a48, hemiI: 1.5, key: 0xffc98a, keyI: 2.6, keyPos: [-4, 6, 6], keyT: [0, 1, 0], f1: 0xffb060, f1I: 16, f1Pos: [0, 2.2, -2.2], f2: 0xffe8c0, f2I: 6, f2Pos: [1.6, 2.5, 1.0], exp: 1.0, bg: 0x2a1c14 },
  night: { sky: 0x6a7fc0, ground: 0x3a3040, hemiI: 1.6, key: 0x9fb2ee, keyI: 1.1, keyPos: [-4, 6, 6], keyT: [0, 1, 0], f1: 0xffb35a, f1I: 14, f1Pos: [1.5, 2.45, 0.9], f2: 0x9fb6ff, f2I: 6, f2Pos: [-1.5, 2.5, 2.5], exp: 1.3, bg: 0x0d1020 },
  nightFace: { sky: 0x6a7fc0, ground: 0x3a3040, hemiI: 1.6, key: 0x9fb2ee, keyI: 1.1, keyPos: [-4, 6, 6], keyT: [0, 1, 0], f1: 0xffb35a, f1I: 14, f1Pos: [1.5, 2.45, 0.9], f2: 0xffd7a0, f2I: 7, f2Pos: [0.5, 2.1, -0.05], exp: 1.3, bg: 0x0d1020 },
  living: { sky: 0xffe2b8, ground: 0x6a4128, hemiI: 1.6, key: 0xffd29e, keyI: 2.2, keyPos: [3.5, 7, 5], keyT: [0, 0, -2], f1: 0xffa25a, f1I: 16, f1Pos: [-2.0, 1.9, -3.6], f2: 0xffe0b0, f2I: 10, f2Pos: [2.5, 3.2, 0.5], exp: 1.0, bg: 0x2a1c14 },
};
function setLights(name, setName) {
  const L = LIGHTS[name], o = OFFSETS[setName];
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI;
  key.color.set(L.key); key.intensity = L.keyI;
  key.position.set(o.x + L.keyPos[0], L.keyPos[1], o.z + L.keyPos[2]);
  key.target.position.set(o.x + L.keyT[0], L.keyT[1], o.z + L.keyT[2]); key.target.updateMatrixWorld();
  fill.color.set(L.f1); fill.intensity = L.f1I; fill.position.set(o.x + L.f1Pos[0], L.f1Pos[1], o.z + L.f1Pos[2]);
  fill2.color.set(L.f2); fill2.intensity = L.f2I; fill2.position.set(o.x + L.f2Pos[0], L.f2Pos[1], o.z + L.f2Pos[2]);
  renderer.toneMappingExposure = L.exp;
  scene.background.set(L.bg);
}

let S, cast, fx, shots, TL, world, shakes = [];

window.setupReel = async function setupReel() {
  await document.fonts.load('700 40px "Pixelify Sans"');
  await document.fonts.load('600 20px "Pixelify Sans"');
  await document.fonts.load('500 20px "Pixelify Sans"');
  TL = await (await fetch('../build/timeline.json', { cache: 'no-store' })).json();
  S = buildSets(scene);
  cast = { husband: makeHusband(), wife: makeWife(), dad: makeDad(), mom: makeMom(), dog: makeDog() };
  for (const c of Object.values(cast)) scene.add(c.root);
  // props live in world space; shots position them and IK the hands onto them
  world = {
    paper: makeDivorcePaper(), stack: makePlateStack(), myPlate: makeFoodPlate(true), momPlate: makeFoodPlate(true),
    iron: makeIron(), comb: makeComb(), perfume: makePerfume(), pen: makePen(), sweets: makeSweetsBox(), taco: makeTaco(),
  };
  { const cu = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.56, 0.18), S.living.white); m.castShadow = true; cu.add(m); world.cushion = cu; }
  for (const o of Object.values(world)) { o.visible = false; scene.add(o); }
  fx = new FX(scene, camera);
  shots = buildShots(TL, { S, cast, fx, world, camera, OFFSETS, setLights, overlay: octx, W, H, scene, renderer });
  shakes = shots.shakes || [];
  // warm up every shot once so shaders / textures are compiled before capture
  for (const sh of shots) renderAt(sh.t + 0.01);
  renderAt(0);
  return { duration: TL.duration, frames: TL.frames, shots: shots.length };
};

const SET_NAMES = ['bedroom', 'door', 'living'];
function showSet(name) { for (const n of SET_NAMES) S[n].group.visible = n === name; }

function shakeOffset(t, extra) {
  let amp = 0;
  for (const s of shakes.concat(extra || [])) {
    if (t >= s.t && t < s.t + s.dur) amp += s.amp * Math.pow(1 - (t - s.t) / s.dur, 1.5);
  }
  return amp;
}

function drawCaption(t) {
  const caps = TL.captions;
  let cur = null;
  for (const c of caps) if (t >= c.s && t < c.e) { cur = c; break; }
  if (!cur) { capEl.style.display = 'none'; return; }
  capEl.style.display = 'block';
  if (capEl.textContent !== cur.text) capEl.textContent = cur.text;
  const k = easeOutBack(clamp((t - cur.s) / 0.14));
  capEl.style.transform = `translate(-50%, -50%) scale(${lerp(0.72, 1, k).toFixed(3)})`;
}

window.renderAt = function renderAt(t) {
  // which shot?
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const sh = shots[i];
  const st = sh.t, et = i + 1 < shots.length ? shots[i + 1].t : TL.duration;
  // reset world
  for (const c of Object.values(cast)) c.reset();
  fx.begin();
  for (const w of Object.values(world)) { w.visible = false; w.position.set(0, 0, 0); w.rotation.set(0, 0, 0); w.scale.set(1, 1, 1); }
  scene.fog = null;
  S.living.backCushions[1].visible = true;
  S.living.coffeeTable.visible = true;
  octx.clearRect(0, 0, W, H);
  const ctx = {
    t, st, et, lt: t - st, u: clamp((t - st) / Math.max(1e-6, et - st)), dur: et - st,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), fov: 40, roll: 0, shake: [], post: [],
    showSet, setName: null,
  };
  sh.fn(ctx);
  // camera + shake
  camera.fov = ctx.fov; camera.updateProjectionMatrix();
  camera.position.copy(ctx.camPos);
  camera.lookAt(ctx.camLook);
  const amp = shakeOffset(t, ctx.shake);
  if (amp > 0) {
    camera.position.x += noise1(t * 38, 1) * amp * 0.06;
    camera.position.y += noise1(t * 41, 2) * amp * 0.06;
    camera.rotateZ(noise1(t * 33, 3) * amp * 0.03);
  }
  if (ctx.roll) camera.rotateZ(ctx.roll);
  camera.updateMatrixWorld();
  // late effects that need the final camera (billboards are oriented inside fx; refresh them)
  fx.orient();
  for (const f of ctx.post) f();
  renderer.render(scene, camera);
  if (sh.overlay) sh.overlay(ctx, octx);
  for (const o of (ctx.overlays || [])) o(octx);
  drawCaption(t);
  return sh.name;
};
window.__setShakes = (s) => { shakes = s; };
export { scene, camera, renderer };
window.__shotTimes = () => shots.map((s, i) => { const et = i + 1 < shots.length ? shots[i + 1].t : TL.duration; return +(s.t + (et - s.t) * 0.6).toFixed(3); });
window.__dbg = () => { const v = new THREE.Vector3(); cast.dad.headMesh.getWorldPosition(v); return { cam: camera.position.toArray().map((x) => +x.toFixed(2)), fov: camera.fov, dadHead: v.toArray().map((x) => +x.toFixed(2)), dadRoot: cast.dad.root.position.toArray() }; };
