// Entry point loaded by render/index.html inside headless Chromium.
// Exposes window.R with init(), renderFrame(i) and renderTime(t) for the Node driver.
import * as THREE from 'three';
import { Post } from './post.js';
import { patchFog } from './sky.js';
import { World } from './world.js';
import { halton } from './util.js';

const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1080), H = +(qs.get('h') || 1920);

patchFog();

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false; // all clears are explicit (accumulation must not be wiped)
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.info.autoReset = true;

const post = new Post(renderer, W, H, { msaa: +(qs.get('msaa') ?? 0) });
if (qs.get('noshadow')) renderer.shadowMap.enabled = false;
let world = null, timeline = null, lastInfo = {};
const pixelBuf = new Uint8Array(W * H * 4);

async function init() {
  timeline = await (await fetch('../timeline.json')).json();
  world = new World(renderer, W, H, timeline);
  await world.build();
  if (qs.get('sm')) world.sun.shadow.mapSize.set(+qs.get('sm'), +qs.get('sm'));
  // warm up: compile all shaders once
  world.update(0.0);
  renderer.compile(world.scene, world.camera);
  return { W, H, fps: timeline.fps, duration: timeline.duration, frames: Math.round(timeline.duration * timeline.fps) };
}

// Render the image for time t (seconds) into post.finalRT.
function renderTime(t, opts = {}) {
  const fps = timeline.fps;
  const N = opts.samples ?? world.samplesAt(t);
  const shutter = opts.shutter ?? world.shutterAt(t); // fraction of frame duration
  post.beginAccum();
  for (let s = 0; s < N; s++) {
    const ts = N > 1 ? t + ((s + 0.5) / N - 0.5) * shutter / fps : t;
    world.update(ts);
    const cam = world.camera;
    if (N > 1) {
      const jx = halton(s + 1, 2) - 0.5, jy = halton(s + 1, 3) - 0.5;
      cam.projectionMatrix.elements[8] += (2 * jx) / W;
      cam.projectionMatrix.elements[9] += (2 * jy) / H;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
    renderer.setRenderTarget(post.sceneRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(world.scene, cam);
    lastInfo = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    post.accumulate(1 / N);
  }
  world.applyGrade(t, post.grade);
  post.finish();
  return N;
}

async function sendPixels(url) {
  renderer.readRenderTargetPixels(post.finalRT, 0, 0, W, H, pixelBuf);
  const r = await fetch(url, { method: 'POST', body: pixelBuf });
  if (!r.ok) throw new Error('upload failed ' + r.status);
}

async function renderFrames(start, end, url, opts = {}) {
  const fps = timeline.fps;
  const times = [];
  for (let i = start; i < end; i++) {
    const t0 = performance.now();
    const n = renderTime(i / fps, opts);
    await sendPixels(`${url}?i=${i}`);
    times.push([i, n, Math.round(performance.now() - t0)]);
  }
  return times;
}

async function renderStill(t, url, opts = {}) {
  const t0 = performance.now();
  world.camOverride = opts.cam || null;
  const n = renderTime(t, opts);
  await sendPixels(url);
  return { t, samples: n, ms: Math.round(performance.now() - t0), ...lastInfo };
}

window.R = { init, renderTime, renderFrames, renderStill, get world() { return world; } };
window.R_READY = true;
