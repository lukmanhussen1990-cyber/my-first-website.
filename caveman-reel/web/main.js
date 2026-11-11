// Entry: builds the scene once, then renderFrame(f) draws any frame as a pure function of f.
import * as THREE from 'three';
import { makeTextures, makeMaterials, buildBackdrop, buildMainSet } from './world.js';

const Q = new URLSearchParams(location.search);
export const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920), FPS = 30;
const wrap = document.getElementById('wrap'); wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
const glc = document.getElementById('gl'), hud = document.getElementById('hud');
hud.width = W; hud.height = H;
export const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); glc.style.width = W + 'px'; glc.style.height = H + 'px';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9dcfb, 140, 760);
export const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 3000);

export const hemi = new THREE.HemisphereLight(0xd6e8ff, 0xb59a70, 1.55); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff1d6, 2.7); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun); scene.add(sun.target);
export const fill = new THREE.DirectionalLight(0xbfd6ff, 0.55); scene.add(fill); scene.add(fill.target);
export function aimSun(cx, cy, cz, size = 14) {
  sun.target.position.set(cx, cy, cz); sun.position.set(cx - 22, cy + 38, cz + 26);
  const c = sun.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 120; c.updateProjectionMatrix();
  fill.target.position.set(cx, cy, cz); fill.position.set(cx + 20, cy + 12, cz + 14);
}

makeTextures(); makeMaterials();
export const backdrop = buildBackdrop(); scene.add(backdrop);
export const mainSet = buildMainSet(); scene.add(mainSet);

import { makeCaveman, pose, mixPose, alive, face, FACE, STAND } from './character.js';
export const hero = makeCaveman({}); scene.add(hero.root);

// ---- debug views (frames >= 100000): character turntable / expression sheet ----
const DBG_FACES = ['neutral', 'smile', 'grin', 'smirk', 'nervous', 'shock', 'annoyed', 'think', 'idea', 'disgust', 'joy', 'awe', 'angry', 'shout', 'content', 'effort'];
function debugView(k) {
  const view = k % 100, variant = Math.floor(k / 100);
  let P = pose({ pos: [4.5, 0, 3.2], yaw: 0, face: face(variant ? DBG_FACES[variant % DBG_FACES.length] : 'smile') });
  hero.apply(P);
  const hp = hero.bones.head.getWorldPosition(new THREE.Vector3()); hp.y += 0.09;
  const V = [
    [[0, 0.95, 4.6], [0, 0.95, 0], 30],          // 0 full body front
    [[0, 0.03, 0.74], [0, 0.015, 0], 30, 1],     // 1 face front
    [[0.50, 0.04, 0.58], [0, 0.015, 0], 30, 1],  // 2 face 3/4 (his left)
    [[0.78, 0.02, 0.03], [0, 0.015, 0], 30, 1],   // 3 profile
    [[2.9, 1.2, 3.4], [0, 0.95, 0], 30],         // 4 body 3/4
    [[0.4, 1.3, -4.4], [0, 0.95, 0], 30],        // 5 back
    [[-0.40, -0.10, 0.52], [0, 0, 0], 30, 1],    // 6 face 3/4 low (his right)
    [[0, 1.25, 2.1], [0, 1.25, 0], 30],          // 7 torso front
    [[-0.25, 0.28, -0.6], [0, 0.02, 0], 30, 1],  // 8 head back 3/4
    [[0, 0.02, 0.36], [0, -0.01, 0], 30, 1],     // 9 extreme face
    [[0.75, 0.95, 0.75], [0.27, 0.86, 0.03], 24, 2],  // 10 left hand
    [[0.9, 0.35, 1.3], [0, 0.12, 0], 24, 2],       // 11 boots
    [[-1.5, 1.5, 2.6], [0, 1.25, 0], 30, 2],        // 12 torso 3/4 right
  ][view];
  const base = V[3] === 1 ? hp : new THREE.Vector3(4.5, 0, 3.2);
  camera.position.set(base.x + V[0][0], base.y + V[0][1], base.z + V[0][2]); camera.fov = V[2]; camera.updateProjectionMatrix();
  camera.lookAt(base.x + V[1][0], base.y + V[1][1], base.z + V[1][2]);
  aimSun(4.5, 1, 3.2, V[3] === 1 ? 2.2 : 5);
}
window.renderFrame = (f) => {
  if (f >= 100000) { debugView(f - 100000); renderer.render(scene, camera); return; }
  const t = f / FPS;
  const a = t * 0.6;
  camera.position.set(Math.sin(a) * 9, 1.7, Math.cos(a) * 11 + 2); camera.lookAt(0, 1.4, -1);
  camera.fov = 42; camera.updateProjectionMatrix();
  aimSun(0, 0, 0, 16);
  renderer.render(scene, camera);
};
await document.fonts.load('800 80px Cap');
window.READY = true;
