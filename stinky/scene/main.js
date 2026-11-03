// Stinky Date reel runtime: deterministic renderAt(t) for frame-by-frame capture.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSets, OFFSETS, phoneScreenTex, makePhone, makeToothbrush, makeMintPack, makeBottle, makeSprayCan, makeMint } from './sets.js';
import { makeYou, makeCrush, makeWaiter, makePatron } from './chars.js';
import { FX } from './fx.js';
import { buildShots } from './shots.js';
import { clamp, lerp, noise1, easeOutBack } from './lib.js';
import { drawCentered, measure } from './font.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const K = W / 1080;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const overlay = document.getElementById('overlay'); overlay.width = W; overlay.height = H;
const octx = overlay.getContext('2d'); octx.imageSmoothingEnabled = false;
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = Math.round(220 * K);
const cctx = capCanvas.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 220);

const hemi = new THREE.HemisphereLight(0xffe2b8, 0x6a4128, 1.6); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd29e, 2.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 50 });
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
scene.add(key); scene.add(key.target);
const fill = new THREE.PointLight(0xffa25a, 14, 12, 2); scene.add(fill);
const fill2 = new THREE.PointLight(0xffd6a0, 8, 10, 2); scene.add(fill2);

// warm, soft indoor lighting (and a bright sunny street)
const LIGHTS = {
  bedroom: { sky: 0xfff0d8, ground: 0x7a5a3a, hemiI: 1.7, key: 0xffd9a8, keyI: 2.2, keyPos: [-4, 6, 3], keyT: [0, 0, -1.5], f1: 0xffb070, f1I: 12, f1Pos: [-2, 2.4, -1.8], f2: 0xfff0d0, f2I: 8, f2Pos: [1.5, 2.6, 1.5], exp: 1.0, bg: 0x2a2018 },
  bathroom: { sky: 0xffffff, ground: 0x8aa0b0, hemiI: 1.8, key: 0xfff0dd, keyI: 1.8, keyPos: [2, 6, 4], keyT: [0, 1, -2], f1: 0xffe0b0, f1I: 12, f1Pos: [0, 3.0, -1.0], f2: 0xd8f0ff, f2I: 6, f2Pos: [-1.5, 2.2, 1.5], exp: 1.0, bg: 0x1a2228 },
  street: { sky: 0x9fd4ff, ground: 0xb89a70, hemiI: 1.6, key: 0xfff0c8, keyI: 3.4, keyPos: [-6, 10, 8], keyT: [0, 0, 0], f1: 0xfff0d0, f1I: 0, f1Pos: [0, 3, 3], f2: 0xfff0d0, f2I: 0, f2Pos: [0, 3, 3], exp: 1.0, bg: 0x8fd0ff },
  cafe: { sky: 0xffe6c0, ground: 0x6a4a30, hemiI: 1.55, key: 0xffd8a0, keyI: 2.0, keyPos: [-3, 6, 4], keyT: [0, 0, -1.6], f1: 0xffb060, f1I: 14, f1Pos: [0, 3.0, -1.6], f2: 0xffe6b0, f2I: 9, f2Pos: [-2.6, 2.6, -0.6], exp: 1.0, bg: 0x2a1c14 },
};
function setLights(name, setName = name) {
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

let S, cast, fx, shots, TL, world;
const SET_NAMES = ['bedroom', 'bathroom', 'street', 'cafe'];
function showSet(name) { for (const n of SET_NAMES) S[n].group.visible = n === name; }

window.setupReel = async function setupReel() {
  TL = await (await fetch('../build/timeline.json', { cache: 'no-store' })).json();
  S = buildSets(scene);
  cast = { you: makeYou(), crush: makeCrush(), waiter: makeWaiter(), pa: makePatron('a'), pb: makePatron('b'), pc: makePatron('c') };
  for (const c of Object.values(cast)) scene.add(c.root);
  const phoneTex = phoneScreenTex();
  world = { phone: makePhone(phoneTex), brush: makeToothbrush(), mints: makeMintPack(), bottle: makeBottle(), spray: makeSprayCan() };
  world.phone.userData.tex = phoneTex;
  for (let i = 0; i < 14; i++) world['mint' + i] = makeMint();
  for (const o of Object.values(world)) { o.visible = false; scene.add(o); }
  fx = new FX(scene, camera);
  shots = buildShots(TL, { S, cast, fx, world, camera, OFFSETS, setLights, W, H, scene });
  for (const sh of shots) renderAt(sh.t + 0.01);
  renderAt(0);
  return { duration: TL.duration, frames: TL.frames, shots: shots.length };
};

function drawCaption(t) {
  let cur = null;
  for (const c of TL.captions) if (t >= c.s && t < c.e) { cur = c; break; }
  if (!cur) return;
  // white pixel font, black outline, centred; quick pop-in
  const s = Math.max(2, Math.round(8 * K * (measure(cur.text) > 86 ? 0.85 : 1)));
  cctx.clearRect(0, 0, capCanvas.width, capCanvas.height);
  drawCentered(cctx, cur.text, capCanvas.width / 2, capCanvas.height / 2, s, { color: '#ffffff', outline: Math.max(2, Math.round(s * 0.5)), outlineColor: '#000000', shadow: Math.round(s * 0.4) });
  const k = easeOutBack(clamp((t - cur.s) / 0.14));
  const sc = lerp(0.7, 1, k);
  const dw = capCanvas.width * sc, dh = capCanvas.height * sc;
  octx.drawImage(capCanvas, (W - dw) / 2, H * 0.5 - dh / 2, dw, dh);
}

function shakeOffset(t, list) {
  let amp = 0;
  for (const s of list) if (t >= s.t && t < s.t + s.dur) amp += s.amp * Math.pow(1 - (t - s.t) / s.dur, 1.5);
  return amp;
}

window.renderAt = function renderAt(t) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const sh = shots[i];
  const st = sh.t, et = i + 1 < shots.length ? shots[i + 1].t : TL.duration;
  for (const c of Object.values(cast)) c.reset();
  fx.begin();
  for (const w of Object.values(world)) { w.visible = false; w.position.set(0, 0, 0); w.rotation.set(0, 0, 0); w.scale.set(1, 1, 1); }
  scene.fog = null;
  octx.clearRect(0, 0, W, H);
  const ctx = { t, st, et, lt: t - st, u: clamp((t - st) / Math.max(1e-6, et - st)), dur: et - st,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), fov: 40, roll: 0, shake: [], overlays: [], showSet };
  sh.fn(ctx);
  camera.fov = ctx.fov; camera.updateProjectionMatrix();
  camera.position.copy(ctx.camPos); camera.lookAt(ctx.camLook);
  const amp = shakeOffset(t, ctx.shake);
  if (amp > 0) {
    camera.position.x += noise1(t * 38, 1) * amp * 0.06; camera.position.y += noise1(t * 41, 2) * amp * 0.06;
    camera.rotateZ(noise1(t * 33, 3) * amp * 0.03);
  }
  if (ctx.roll) camera.rotateZ(ctx.roll);
  camera.updateMatrixWorld();
  fx.orient();
  renderer.render(scene, camera);
  for (const o of ctx.overlays) o(octx);
  drawCaption(t);
  return sh.name;
};
window.__shotTimes = () => shots.map((s, i) => { const et = i + 1 < shots.length ? shots[i + 1].t : TL.duration; return +(s.t + (et - s.t) * 0.6).toFixed(3); });
