// Golden-toilet reel runtime: deterministic renderAt(t) for frame-by-frame capture.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSets, OFFSETS, makeTPRoll, makeMug, phoneTex, makePhone, makeGift, makeFrame, calendarTex } from './sets.js';
import { makeYou, makeMom, makeCousin, makeGrandma, makeGuest, pose } from './chars.js';
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
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = Math.round(300 * K);
const cctx = capCanvas.getContext('2d');
const mosaic = document.createElement('canvas'); const mctx = mosaic.getContext('2d', { willReadFrequently: true });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 260);

const hemi = new THREE.HemisphereLight(0xffe2b8, 0x6a4128, 1.6); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd29e, 2.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 60 });
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
scene.add(key); scene.add(key.target);
const fill = new THREE.PointLight(0xffb060, 14, 14, 2); scene.add(fill);
const fill2 = new THREE.PointLight(0xffd6a0, 8, 12, 2); scene.add(fill2);

// warm, rich, golden lighting everywhere
const LIGHTS = {
  home: { sky: 0xffe0b0, ground: 0x7a4a2a, hemiI: 1.6, key: 0xffcf8a, keyI: 2.2, keyPos: [-3, 6, 4], keyT: [0, 0, -1.5], f1: 0xffa850, f1I: 12, f1Pos: [-1, 2.8, -1.2], f2: 0xffe0b0, f2I: 7, f2Pos: [2, 2.6, 1.5], exp: 1.0, bg: 0x2a1c14 },
  gate: { sky: 0xffc888, ground: 0x6a5a30, hemiI: 1.5, key: 0xffb860, keyI: 3.0, keyPos: [-8, 6, 6], keyT: [0, 0, -4], f1: 0xffd080, f1I: 0, f1Pos: [0, 3, 3], f2: 0xffd080, f2I: 0, f2Pos: [0, 3, 3], exp: 1.0, bg: 0xf4a860 },
  hall: { sky: 0xffe2b0, ground: 0x8a6a40, hemiI: 1.6, key: 0xffd090, keyI: 2.1, keyPos: [-4, 9, 5], keyT: [0, 0, -2], f1: 0xffc060, f1I: 26, f1Pos: [0, 4.6, -1.5], f2: 0xffe6b0, f2I: 10, f2Pos: [5, 3, 1.5], exp: 1.0, bg: 0x2a1c14 },
  bath: { sky: 0xfff0d0, ground: 0x9a7a40, hemiI: 1.6, key: 0xffe0a0, keyI: 1.8, keyPos: [2, 6, 4], keyT: [0, 0.5, -1.8], f1: 0xffc860, f1I: 14, f1Pos: [0, 3.2, -0.6], f2: 0xfff0d0, f2I: 6, f2Pos: [-1.5, 2.2, 1.5], exp: 1.0, bg: 0x2a1c14 },
  party: { sky: 0xffd8b0, ground: 0x7a3a2a, hemiI: 1.55, key: 0xffcf90, keyI: 2.0, keyPos: [-3, 6, 4], keyT: [0, 0, -1.6], f1: 0xffa850, f1I: 14, f1Pos: [-0.6, 2.4, -1.2], f2: 0xffe0b0, f2I: 9, f2Pos: [2.5, 2.6, 0.5], exp: 1.0, bg: 0x2a1c14 },
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

let S, cast, fx, shots, TL, world, shakes = [];
const SET_NAMES = ['home', 'gate', 'hall', 'bath', 'party'];
function showSet(name) { for (const n of SET_NAMES) S[n].group.visible = n === name; }

function resetWorld() {
  for (const c of Object.values(cast)) c.reset();
  fx.begin();
  for (const w of Object.values(world)) { w.visible = false; w.position.set(0, 0, 0); w.rotation.set(0, 0, 0); w.scale.set(1, 1, 1); }
}

window.setupReel = async function setupReel() {
  TL = await (await fetch('../build/timeline.json', { cache: 'no-store' })).json();
  S = buildSets(scene);
  cast = { you: makeYou(), mom: makeMom(), cousin: makeCousin(), grandma: makeGrandma(), ga: makeGuest('a'), gb: makeGuest('b'), gc: makeGuest('c'), gd: makeGuest('d') };
  for (const c of Object.values(cast)) scene.add(c.root);
  world = { roll: makeTPRoll(), mug: makeMug(), phone: makePhone(phoneTex()), gift: makeGift(), bag: cast.cousin.extras.bag, oldPhone: cast.grandma.extras.phone,
    glassA: cast.ga.extras.glass, glassB: cast.gb.extras.glass, glassC: cast.gc.extras.glass, glassD: cast.gd.extras.glass };
  const calTex = calendarTex();
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshLambertMaterial({ map: i === 0 ? calTex : calendarTex(), side: THREE.DoubleSide })); p.geometry.translate(0, -0.5, 0); const g = new THREE.Group(); g.add(p); world['page' + i] = g; g.userData.tex = p.material.map; }
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), world.gift.userData.wrap); m.material = world.gift.userData.wrap.clone(); m.material.side = THREE.DoubleSide; world['scrap' + i] = m; }
  for (const o of Object.values(world)) { o.visible = false; scene.add(o); }
  fx = new FX(scene, camera);
  // ---- the "photo": a real 3D snapshot of Mom walking into the bathroom with her mug ----
  const rt = new THREE.WebGLRenderTarget(640, 480, { samples: 4 });
  {
    resetWorld(); showSet('hall'); setLights('hall');
    const o = OFFSETS.hall, M = cast.mom;
    M.root.visible = true; M.root.position.set(o.x + 6.7, 0, o.z + 1.15); M.root.rotation.y = Math.PI / 2;
    pose.walk(M, 0.9, 0.8); M.setFace({ eyes: 'dot', tired: true, mouth: 'flat' });
    S.hall.bathHinge.rotation.y = 1.2;
    const mug = world.mug; mug.visible = true; M.root.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); M.arms.R.hand.getWorldPosition(hp); mug.position.copy(hp).add(new THREE.Vector3(0, 0.08, 0)); mug.scale.setScalar(1.3);
    const pc = new THREE.PerspectiveCamera(42, 640 / 480, 0.05, 100);
    pc.position.set(o.x + 3.6, 1.55, o.z + 3.6); pc.lookAt(o.x + 7.0, 1.3, o.z + 1.0);
    renderer.setRenderTarget(rt); renderer.render(scene, pc); renderer.setRenderTarget(null);
    S.hall.bathHinge.rotation.y = 0;
  }
  world.frame = makeFrame(rt.texture); world.frame.visible = false; scene.add(world.frame);
  shots = buildShots(TL, { S, cast, fx, world, camera, OFFSETS, setLights, W, H, scene });
  shakes = [];
  for (const c of TL.captions) if (c.loud) shakes.push({ t: c.s + 0.03, amp: 0.55, dur: 0.32 });
  for (const sh of shots) renderAt(sh.t + 0.01);
  renderAt(0);
  return { duration: TL.duration, frames: TL.frames, shots: shots.length };
};

function drawCaption(t) {
  let cur = null;
  for (const c of TL.captions) if (t >= c.s && t < c.e) { cur = c; break; }
  if (!cur) return;
  const base = cur.loud ? 11.5 : 8;                         // loud lines: BIG CAPS
  const s = Math.max(2, Math.round(base * K * (measure(cur.text) * base > 1000 / 1 ? 0.8 : 1)));
  cctx.clearRect(0, 0, capCanvas.width, capCanvas.height);
  drawCentered(cctx, cur.text, capCanvas.width / 2, capCanvas.height / 2, s, { color: '#ffffff', outline: Math.max(2, Math.round(s * 0.5)), outlineColor: '#000000', shadow: Math.round(s * 0.45) });
  const k = easeOutBack(clamp((t - cur.s) / 0.14));
  const sc = lerp(cur.loud ? 0.55 : 0.7, 1, k);
  const dw = capCanvas.width * sc, dh = capCanvas.height * sc;
  const jx = cur.loud ? noise1(t * 40, 7) * 6 * K * Math.max(0, 1 - (t - cur.s) / 0.35) : 0;
  octx.drawImage(capCanvas, (W - dw) / 2 + jx, H * 0.5 - dh / 2, dw, dh);
}

// comedic censor: pixelate a screen rectangle around a world-space box
const _v = new THREE.Vector3();
function censor(list) {
  for (const c of list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const dx of [-c.w / 2, c.w / 2]) for (const dy of [-c.h / 2, c.h / 2]) for (const dz of [-c.d / 2, c.d / 2]) {
      _v.set(c.pos.x + dx, c.pos.y + dy, c.pos.z + dz).project(camera);
      const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    const w = x1 - x0, h = y1 - y0;
    if (w < 4 || h < 4) continue;
    const cell = Math.max(6, Math.round(w / 7));
    mosaic.width = Math.max(1, Math.round(w / cell)); mosaic.height = Math.max(1, Math.round(h / cell));
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(renderer.domElement, x0, y0, w, h, 0, 0, mosaic.width, mosaic.height);
    // vary each block a little so the censor reads clearly even over plain skin
    const img = mctx.getImageData(0, 0, mosaic.width, mosaic.height), d = img.data;
    for (let q = 0; q < d.length; q += 4) { const k = 0.86 + 0.28 * (((q / 4) * 7919 % 97) / 97); d[q] = Math.min(255, d[q] * k); d[q + 1] = Math.min(255, d[q + 1] * k); d[q + 2] = Math.min(255, d[q + 2] * k); }
    mctx.putImageData(img, 0, 0);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(mosaic, 0, 0, mosaic.width, mosaic.height, x0, y0, w, h);
  }
}

window.renderAt = function renderAt(t) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const sh = shots[i];
  const st = sh.t, et = i + 1 < shots.length ? shots[i + 1].t : TL.duration;
  resetWorld();
  scene.fog = null;
  octx.clearRect(0, 0, W, H);
  const ctx = { t, st, et, lt: t - st, u: clamp((t - st) / Math.max(1e-6, et - st)), dur: et - st,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), fov: 40, roll: 0, shake: [], overlays: [], censor: [], showSet };
  sh.fn(ctx);
  camera.fov = ctx.fov; camera.updateProjectionMatrix();
  camera.position.copy(ctx.camPos); camera.lookAt(ctx.camLook);
  let amp = 0;
  for (const s of shakes.concat(ctx.shake)) if (t >= s.t && t < s.t + s.dur) amp += s.amp * Math.pow(1 - (t - s.t) / s.dur, 1.5);
  if (amp > 0) { camera.position.x += noise1(t * 38, 1) * amp * 0.06; camera.position.y += noise1(t * 41, 2) * amp * 0.06; camera.rotateZ(noise1(t * 33, 3) * amp * 0.03); }
  if (ctx.roll) camera.rotateZ(ctx.roll);
  camera.updateMatrixWorld();
  fx.orient();
  renderer.render(scene, camera);
  censor(ctx.censor);
  for (const o of ctx.overlays) o(octx);
  drawCaption(t);
  return sh.name;
};
window.__shotTimes = () => shots.map((s, i) => { const et = i + 1 < shots.length ? shots[i + 1].t : TL.duration; return +(s.t + (et - s.t) * 0.6).toFixed(3); });
