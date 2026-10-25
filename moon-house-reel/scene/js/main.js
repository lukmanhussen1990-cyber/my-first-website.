// Entry point: builds the world and exposes window.renderAt(t) for the frame renderer.
import * as THREE from 'three';
import { createRenderer, createComposer, createEnvironment } from './world.js';
import { buildStory } from './story.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const MSAA = +(params.get('msaa') ?? 4);

const t0 = performance.now();
const renderer = createRenderer(W, H);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.environment = createEnvironment(renderer);
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 3000);
const story = buildStory(scene, camera, renderer);
const { composer, bloom, vignette } = createComposer(renderer, scene, camera, W, H, MSAA);
story.post = { bloom, vignette };

window.renderAt = (t, skipUpdate) => {
  if (!skipUpdate) story.update(t);
  composer.render();
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // sync
  return true;
};
window.__story = story;
window.grab = (type = 'image/png', q = 0.95) => renderer.domElement.toDataURL(type, q);
// warm up: compile all shaders once
story.update(0); renderer.compile(scene, camera);
window.buildMs = performance.now() - t0;
window.ready = true;
