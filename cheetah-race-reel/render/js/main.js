import * as THREE from 'three';
import { Post } from './post.js';
import { halton } from './util.js';

// Frame-by-frame offline renderer. A scene module exports build(ctx) and
// returns { scene, camera, update(time, sub), postParams(time), sun }.
// window.renderFrame(t) renders one output frame as the average of N
// jittered sub-frames spread over the shutter interval (motion blur, AA and
// soft shadows in one go) and posts the 8-bit RGBA pixels to the server.

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920);
const MODE = Q.get('mode') || 'film';

const canvas = document.createElement('canvas');
canvas.width = 16; canvas.height = 16;
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.setSize(16, 16, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.autoClear = true;

const post = new Post(renderer, W, H);
const ctx = { THREE, renderer, W, H, Q, post };
const mod = await import(`./scene_${MODE}.js`);
const S = await mod.build(ctx);

const _proj = new THREE.Matrix4();
const baseSunDir = new THREE.Vector3();

window.renderFrame = async (t, opt = {}) => {
  const N = opt.samples || S.samplesAt?.(t) || 8;
  const shutter = opt.shutter ?? 0.5; // fraction of a frame (180 degrees)
  const fps = opt.fps || 30;
  const t0 = performance.now();
  post.beginAccum();
  for (let k = 0; k < N; k++) {
    const u = N === 1 ? 0.5 : (k + 0.5) / N;
    const ts = t + (u - 0.5) * shutter / fps;
    S.update(ts, { k, N, t });
    // sub-pixel jitter (Halton 2,3), slightly wider than a pixel for a soft filter
    const jx = N === 1 ? 0 : (halton(k + 1, 2) - 0.5) * 1.15;
    const jy = N === 1 ? 0 : (halton(k + 1, 3) - 0.5) * 1.15;
    const cam = S.camera;
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] += (2 * jx) / W;
    cam.projectionMatrix.elements[9] += (2 * jy) / H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    // soft shadows: wobble the sun direction inside a small cone
    if (S.sun && N > 1) {
      if (!S.sun.userData.base) S.sun.userData.base = S.sun.position.clone().sub(S.sun.target.position);
      const b = S.sun.userData.base;
      const ang = halton(k + 1, 5) * Math.PI * 2, rad = Math.sqrt(halton(k + 1, 7)) * (S.sunSoftness || 0.012);
      const d = baseSunDir.copy(b).normalize();
      const t1 = new THREE.Vector3(0, 1, 0).cross(d).normalize(), t2 = d.clone().cross(t1);
      const dir = d.clone().addScaledVector(t1, Math.cos(ang) * rad).addScaledVector(t2, Math.sin(ang) * rad).normalize().multiplyScalar(b.length());
      S.sun.position.copy(S.sun.target.position).add(dir);
    }
    renderer.setRenderTarget(post.sceneRT);
    renderer.render(S.scene, cam);
    post.accumulate(1 / N);
  }
  S.update(t, { k: -1, N, t, final: true });
  const pp = { ...(S.postParams ? S.postParams(t) : {}), uSeed: (t * 30) % 64 };
  if (S.heatPass) pp.heatTex = S.heatPass(t);
  post.finish(pp);
  const px = post.read();
  const ms = performance.now() - t0;
  if (opt.send !== false) {
    const q = new URLSearchParams({ t: String(t), frame: String(opt.frame ?? -1), tag: opt.tag || '' });
    await fetch('/frame?' + q, { method: 'POST', body: new Blob([px]) });
  }
  return { ms: Math.round(ms), N };
};

window.sceneInfo = () => ({ W, H, MODE, duration: S.duration || 0 });
window.ready = true;
