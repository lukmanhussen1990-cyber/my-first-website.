// Deterministic renderer entry. Exposes:
//   window.renderFrame(t)            -> renders 3D frame at time t, POSTs raw RGBA to /frame
//   window.renderOverlay(t, i)       -> draws the text layer, POSTs PNG to /overlay?i=
//   window.renderStill(t, name, ov)  -> 3D + text composited, POSTs PNG to /still?name=
import * as THREE from 'three';
import { makeTextures, makeEnv } from './textures.js';
import { Post } from './post.js';
import { Overlay, loadFonts } from './overlay.js';
import { buildWorld } from './world/index.js';
import { IMAGE_FILES } from './world/frozen.js';
import { setMainTarget } from './world/glacier.js';
import { Shots } from './shots.js';

const q = new URLSearchParams(location.search);
const SCALE = parseFloat(q.get('scale') || '1');
const LITE = q.get('lite') === '1';   // fast draft: no hidden crowd
const W = 2 * Math.round(540 * SCALE), H = 2 * Math.round(960 * SCALE);
const FPS = 30;

async function loadImages() {
  const loader = new THREE.TextureLoader();
  const out = {};
  for (const [k, f] of Object.entries(IMAGE_FILES)) {
    try {
      const t = await loader.loadAsync('/assets/gpt/' + f);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      out[k] = t;
    } catch (e) {
      out[k] = null;
    }
  }
  return out;
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', body });
  if (!r.ok) throw new Error('POST failed ' + url);
}

async function boot() {
  await loadFonts();
  const timeline = await (await fetch('/src/timeline.json', { cache: 'no-store' })).json();
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.transmissionResolutionScale = 0.5;
  document.body.appendChild(renderer.domElement);

  const tex = makeTextures(renderer);
  const env = makeEnv(renderer);
  const envDay = makeEnv(renderer, 'day');
  const images = await loadImages();
  const world = buildWorld(renderer, tex, env, images, envDay);
  const postFx = new Post(renderer, W, H);
  setMainTarget(postFx.rtScene);
  const overlay = new Overlay(W, H);
  const shots = new Shots(world, timeline, postFx, { W, H, SCALE, LITE });
  if (LITE) for (const c of world.frozen.crowd) c.root.removeFromParent();
  const pixels = new Uint8Array(W * H * 4);

  const render3D = (t) => {
    const frame = Math.round(t * FPS);
    const ov = shots.apply(t);
    postFx.render(world.scene, world.camera, frame);
    return ov;
  };

  window.TL = timeline;
  window.SIZE = { W, H };
  window.renderFrame = async (t) => {
    render3D(t);
    postFx.readPixels(pixels);
    await post('/frame', pixels);
    return true;
  };
  window.renderOverlay = async (t, i) => {
    const ov = shots.apply(t, { overlayOnly: true });
    overlay.draw(ov, t);
    const blob = await new Promise((res) => overlay.canvas.toBlob(res, 'image/png'));
    await post('/overlay?i=' + i, blob);
    return true;
  };
  window.renderStill = async (t, name, withOverlay = true) => {
    const ov = render3D(t);
    postFx.readPixels(pixels);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    g.putImageData(img, 0, 0);
    if (withOverlay) {
      overlay.draw(ov, t);
      g.drawImage(overlay.canvas, 0, 0);
    }
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    await post('/still?name=' + encodeURIComponent(name), blob);
    return true;
  };
  // 3D + text layer composited in-page, sent as raw top-down RGBA (fast previews / test clips)
  const compCanvas = document.createElement('canvas');
  compCanvas.width = W; compCanvas.height = H;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });
  const compImg = compCtx.createImageData(W, H);
  window.renderComposite = async (t) => {
    const ov = render3D(t);
    postFx.readPixels(pixels);
    const row = W * 4;
    for (let y = 0; y < H; y++) compImg.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    compCtx.putImageData(compImg, 0, 0);
    overlay.draw(ov, t);
    compCtx.drawImage(overlay.canvas, 0, 0);
    await post('/frame', compCtx.getImageData(0, 0, W, H).data);
    return true;
  };
  // debug: render the world at time t from an arbitrary camera
  window.debugStill = async (t, name, pos, target, fov = 35) => {
    shots.apply(t);
    const c = world.camera;
    c.position.set(...pos); c.lookAt(new THREE.Vector3(...target)); c.fov = fov; c.near = 0.5; c.far = 4000;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    postFx.p.maxBlur = 0;
    postFx.render(world.scene, c, 0);
    postFx.readPixels(pixels);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); const img = g.createImageData(W, H); const row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    g.putImageData(img, 0, 0);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    await post('/still?name=' + encodeURIComponent(name), blob);
    return true;
  };
  // warm up: compile the programs used by every scene once
  window.warmup = async () => {
    for (const sc of timeline.scenes) render3D((sc.start + sc.end) / 2);
    return true;
  };
  window.__ready = true;
}

boot().catch((e) => {
  console.error('BOOT FAILED', e && e.stack ? e.stack : e);
  window.__bootError = String(e && e.stack ? e.stack : e);
});
