// Deterministic renderer entry. The headless capture script drives it:
//   await window.renderFrame(t)   -> renders the film at time t (seconds), fixed steps of 1/30 s
//   await window.sendFrame(i)     -> reads the pixels and POSTs them to the local encoder
// There is no real-time clock anywhere: every frame depends only on t.
import * as THREE from 'three';
import { World } from './world/world.js';
import { Director } from './director.js';
import { Post } from './post.js';
import { Overlay } from './overlay.js';

const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const [timeline] = await Promise.all([fetch('/src/timeline.json').then((r) => r.json())]);
const W = Math.round(timeline.width * SCALE);
const H = Math.round(timeline.height * SCALE);

await Promise.all(['100px Anton', '500 60px Oswald', '700 60px Oswald'].map((f) => document.fonts.load(f)));

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);

const world = new World(renderer, { W, H });
const director = new Director(world, timeline);
const post = new Post(renderer, W, H);
const overlay = new Overlay(W, H, SCALE, timeline);

world.captureEnvironment();

// Warm-up: compile every program once so the first real frame is not special.
director.update(0);
renderer.compile(world.scene, world.camera);

const pixels = new Uint8Array(W * H * 4);
let frameIndex = 0;

window.renderFrame = async (t) => {
  frameIndex = Math.round(t * timeline.fps);
  const state = director.update(t);
  if (window.debugCamera) {
    // debugging aid: look at the set from anywhere without touching the director
    const { pos, look, fov } = window.debugCamera;
    world.camera.position.set(...pos);
    world.camera.lookAt(...look);
    world.camera.fov = fov;
    world.camera.updateProjectionMatrix();
    if (window.debugCamera.showHead) state.povHideHead = false;
  }
  world.renderPasses(state, t);
  overlay.draw(t, state);
  post.render(world.scene, world.camera, state.post, overlay, frameIndex);
  if (window.debugShowRT) {
    // debugging aid: show a mirror's render target full screen
    const { FullScreenQuad } = await import('three/addons/postprocessing/Pass.js');
    const rt = window.debugShowRT === 'fridge' ? world.fridgeRefl.rt : world.floorRefl.rt;
    const q = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: rt.texture }));
    renderer.setRenderTarget(null);
    q.render(renderer);
  }
  return state.sceneId;
};

window.sendFrame = async (i, url = '/frame') => {
  const gl = renderer.getContext();
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const res = await fetch(`${url}?i=${i}`, { method: 'POST', body: pixels });
  if (!res.ok) throw new Error('frame upload failed: ' + res.status);
};

window.timeline = timeline;
window.ready = true;
