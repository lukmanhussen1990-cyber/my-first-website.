import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildSet } from './scene.js';
import { loadAssets, buildMan, buildGhost, buildTeddy } from './characters.js';
import { Blanket } from './blanket.js';
import { FX } from './fx.js';
import { applyTimeline, DURATION, CUTS, SHEET_TIMES, SHOT_NAMES } from './timeline.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 540), H = +(q.get('h') || 960);
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03050c);
scene.fog = new THREE.FogExp2(0x0b1a3a, 0.035);
const camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 60);
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.4, 0.6, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());

const set = await buildSet(scene);
const assets = await loadAssets();
const man = buildMan(assets); scene.add(man.root);
const ghost = buildGhost(assets); scene.add(ghost.root); scene.add(ghost.halo); scene.add(ghost.light);
const teddyHand = ghost.teddy; ghost.attach('RightHand', teddyHand);
const teddyWorld = buildTeddy(); scene.add(teddyWorld);
const blanket = new Blanket(scene);
const fx = new FX(scene);
const S = { man, ghost, set, blanket, fx, camera, teddyHand, teddyWorld, ghostSquash: 1 };
window.dbg = { THREE, scene, camera, set, renderer, S };
window.INFO = { DURATION, CUTS, SHEET_TIMES, SHOT_NAMES };
const grab = (fmt) => renderer.domElement.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', 0.93);
// render the reel at time t (seconds); optional free camera override [x,y,z, tx,ty,tz, fov] for debugging
window.renderAt = (t, c, fmt) => {
  applyTimeline(t, S);
  if (c && c.length >= 6) { camera.up.set(0, 1, 0); camera.position.set(c[0], c[1], c[2]); camera.fov = c[6] || 45; camera.updateProjectionMatrix(); camera.lookAt(c[3], c[4], c[5]); }
  composer.render(); return grab(fmt);
};
window.renderCam = (c) => window.renderAt(0, c);
window.READY = true;
