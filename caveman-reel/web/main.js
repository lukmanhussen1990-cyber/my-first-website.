// Entry: builds the scene once, then renderFrame(f) draws any frame as a pure function of f.
import * as THREE from 'three';
import { makeTextures, makeMaterials, buildBackdrop, buildMainSet } from './world.js';
import { initProps } from './props.js';
import { buildStory } from './story.js';
import { pose, face, alive } from './character.js';
import { backOut, clamp } from './util.js';

const Q = new URLSearchParams(location.search);
export const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920), FPS = 30;
const wrap = document.getElementById('wrap'); wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
const glc = document.getElementById('gl'), hud = document.getElementById('hud');
hud.width = W; hud.height = H; const hctx = hud.getContext('2d');
export const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: Q.get('aa') !== '0', preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); glc.style.width = W + 'px'; glc.style.height = H + 'px';
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = Q.get('sh') === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9dcfb, 140, 760);
export const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 3000);
export const hemi = new THREE.HemisphereLight(0xd6e8ff, 0xb59a70, 1.55); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff1d6, 2.7); sun.castShadow = true;
{ const sm = +(Q.get('sm') || 4096); sun.shadow.mapSize.set(sm, sm); } sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun); scene.add(sun.target);
export const fill = new THREE.DirectionalLight(0xbfd6ff, 0.55); scene.add(fill); scene.add(fill.target);
export function aimSun(cx, cy, cz, size = 14) {
  sun.target.position.set(cx, cy, cz); sun.position.set(cx - 22, cy + 38, cz + 26);
  const c = sun.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 120; c.updateProjectionMatrix();
  fill.target.position.set(cx, cy, cz); fill.position.set(cx + 20, cy + 12, cz + 14);
}

makeTextures(); makeMaterials(); initProps(renderer);
export const backdrop = buildBackdrop(); scene.add(backdrop);
export const mainSet = buildMainSet(); scene.add(mainSet);
const story = buildStory({ scene, camera, aimSun, backdrop, mainSet, sun, hemi, fill, renderer });
const CAP = await (await fetch('/work/words.json')).json();
const noCap = Q.get('nocap') === '1';

// ---- captions: one word at a time, bold white with black outline, centred ----
function drawHud(T) {
  hctx.clearRect(0, 0, W, H);
  if (noCap) return;
  const ws = CAP.words; let wi = -1;
  for (let i = 0; i < ws.length; i++) { if (T >= ws[i].s - 0.02) wi = i; else break; }
  if (wi < 0) return;
  const w = ws[wi], nx = ws[wi + 1]; const end = Math.min(nx ? nx.s - 0.02 : w.e + 0.5, w.e + 0.42);
  if (T >= end) return;
  const k = W / 1080; let size = 104 * k; const pop = 0.80 + 0.20 * backOut(clamp((T - (w.s - 0.02)) / 0.10), 2.2);
  hctx.font = `800 ${size}px Cap, sans-serif`; let tw = hctx.measureText(w.w).width; const maxW = W * 0.86;
  if (tw > maxW) { size *= maxW / tw; hctx.font = `800 ${size}px Cap, sans-serif`; }
  hctx.save(); hctx.translate(W / 2, H * 0.545); hctx.scale(pop, pop);
  hctx.textAlign = 'center'; hctx.textBaseline = 'middle'; hctx.lineJoin = 'round'; hctx.miterLimit = 2;
  hctx.shadowColor = 'rgba(0,0,0,0.45)'; hctx.shadowBlur = 10 * k; hctx.shadowOffsetY = 6 * k;
  hctx.strokeStyle = '#000'; hctx.lineWidth = size * 0.20; hctx.strokeText(w.w, 0, 0);
  hctx.shadowColor = 'transparent'; hctx.fillStyle = '#fff'; hctx.fillText(w.w, 0, 0);
  hctx.restore();
}

// ---- debug views: 100000+ hero turntable / expressions, 200000+ pose sheet, 300000+ cast ----
const DBG_FACES = ['neutral', 'smile', 'grin', 'smirk', 'nervous', 'shock', 'annoyed', 'think', 'idea', 'disgust', 'joy', 'awe', 'angry', 'shout', 'content', 'effort'];
const VIEWS = [
  [[0, 0.95, 4.6], [0, 0.95, 0], 30], [[0, 0.03, 0.74], [0, 0.015, 0], 30, 1], [[0.50, 0.04, 0.58], [0, 0.015, 0], 30, 1], [[0.78, 0.02, 0.03], [0, 0.015, 0], 30, 1],
  [[2.9, 1.2, 3.4], [0, 0.95, 0], 30], [[0.4, 1.3, -4.4], [0, 0.95, 0], 30], [[-0.40, -0.10, 0.52], [0, 0, 0], 30, 1], [[0, 1.25, 2.1], [0, 1.25, 0], 30],
  [[-0.25, 0.28, -0.6], [0, 0.02, 0], 30, 1], [[0, 0.02, 0.36], [0, -0.01, 0], 30, 1], [[0.75, 0.95, 0.75], [0.27, 0.86, 0.03], 24], [[0.9, 0.35, 1.3], [0, 0.12, 0], 24], [[-1.5, 1.5, 2.6], [0, 1.25, 0], 30],
];
function debugView(f) {
  story.update(0); [story.hero, ...story.cast].forEach(c => { c.root.visible = false; });
  const O = new THREE.Vector3(4.5, 0, 3.2);
  let c = story.hero, P = pose({ face: face('smile') }), V = VIEWS[0];
  if (f >= 300000) { const k = f - 300000; c = [story.hero, ...story.cast][k % 6]; V = VIEWS[[0, 2, 5][Math.floor(k / 6) % 3]]; P = pose({ face: face(['smile', 'angry', 'grin', 'bored', 'idea', 'smile'][k % 6]) }); }
  else if (f >= 200000) { const k = f - 200000; const names = Object.keys(story.P); P = { ...story.P[names[k % names.length]], face: face('smile') }; V = Math.floor(k / names.length) % 2 ? [[3.2, 1.3, 0.6], [0, 1.0, 0], 30] : [[1.2, 1.25, 4.2], [0, 1.0, 0], 30]; }
  else { const k = f - 100000; V = VIEWS[k % 100]; P = pose({ face: face(Math.floor(k / 100) ? DBG_FACES[Math.floor(k / 100) % DBG_FACES.length] : 'smile') }); }
  c.root.visible = true; c.apply({ ...P, pos: [O.x, 0, O.z], yaw: 0 });
  const base = V[3] === 1 ? c.bones.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.09, 0)) : O;
  camera.up.set(0, 1, 0); camera.position.set(base.x + V[0][0], base.y + V[0][1], base.z + V[0][2]); camera.fov = V[2]; camera.updateProjectionMatrix();
  camera.lookAt(base.x + V[1][0], base.y + V[1][1], base.z + V[1][2]); aimSun(O.x, 1, O.z, V[3] === 1 ? 2.2 : 5);
}
window.renderFrame = (f) => {
  if (f >= 100000) { debugView(f); renderer.render(scene, camera); hctx.clearRect(0, 0, W, H); return 'dbg'; }
  const T = (f + 0.5) / FPS;
  const id = story.update(T);
  renderer.render(scene, camera);
  drawHud(T);
  return id;
};
window.SHOTS = story.shots.map(s => [s.id, s.t0, s.t1]);
await document.fonts.load('800 80px Cap');
window.READY = true;
