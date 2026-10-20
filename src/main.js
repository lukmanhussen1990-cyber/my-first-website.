// Renderer entry. Exposes a deterministic API for the headless capture:
//   window.renderFrame(t, frame)   draw the frame at time t (seconds) into the composite canvas
//   window.sendFrame(frame)        render frame and POST raw RGBA to the capture server
//   window.stillPNG(t)             render and return a PNG data URL
import * as THREE from 'three';
import { WIDTH as W, HEIGHT as H, FPS } from './story.js';
import { buildHouse } from './world/house.js';
import { buildMom, buildYou, setLayer } from './world/characters.js';
import { buildTV } from './world/tv.js';
import { buildSteam, addContactShadows } from './world/fx.js';
import { buildPost } from './post.js';
import { Overlay } from './ui.js';
import { Director } from './director.js';

const params = new URLSearchParams(location.search);

async function loadFonts() {
  const fonts = [
    new FontFace('Anton', 'url(/assets/fonts/Anton-Regular.ttf)'),
    new FontFace('Inter', 'url(/assets/fonts/Inter-Variable.ttf)', { weight: '100 900' }),
    new FontFace('Nunito', 'url(/assets/fonts/Nunito-Variable.ttf)', { weight: '200 1000' }),
  ];
  for (const f of fonts) document.fonts.add(await f.load());
  await document.fonts.ready;
}

function envMap(renderer) {
  // dim room with a warm kitchen side and a cold TV side -> soft reflections on metal and glossy surfaces
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 12), new THREE.MeshBasicMaterial({ color: 0x1a1c20, side: THREE.BackSide }));
  s.add(room);
  const panel = (color, x, y, z, w, h, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; s.add(m);
  };
  panel(new THREE.Color(2.2, 1.4, 0.7), 0, 1.2, -5.9, 5, 1.2, 0);
  panel(new THREE.Color(0.6, 0.8, 1.4), 0, 0.2, 5.9, 2.5, 1.2, Math.PI);
  panel(new THREE.Color(0.25, 0.3, 0.45), -4.9, 0.8, 0, 2, 1.5, Math.PI / 2);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(s, 0.04).texture;
}

async function init() {
  await loadFonts();
  const timeline = await (await fetch('/build/timeline.json')).json();

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.FogExp2(0x0b0e14, 0.028);
  // reflections only where they matter (metal + glass): a scene-wide env map costs ~1.5 s/frame on SwiftShader
  const env = envMap(renderer);

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 40);

  const refs = buildHouse(scene);
  for (const m of [refs.materials.steel, refs.materials.blackGlass, refs.materials.brass]) { m.envMap = env; m.envMapIntensity = 0.5; m.needsUpdate = true; }
  const mom = buildMom();
  const momShadow = buildMom({ shadowOnly: true });
  const mom3 = buildMom();
  const you = buildYou();
  scene.add(mom.root, momShadow.root, mom3.root, you.root);
  setLayer(mom3.root, 2);
  mom3.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  const tv = buildTV(refs, scene);
  const steam = buildSteam(scene, refs.steamOrigin);
  addContactShadows(scene, [
    [0, 1.5, 2.9, 1.5, 0.55], [0, 2.75, 1.5, 1.0, 0.45], [0, 4.96, 2.3, 0.8, 0.5], [-1.62, 1.18, 0.6, 0.6, 0.5],
    [0.6, -3.55, 0.7, 0.55, 0.55, 0.009], [-1.25, -2.0, 1.9, 1.2, 0.5, 0.009], [2.35, -2.25, 1.4, 1.4, 0.45, 0.009],
    [-2.75, -4.03, 1.1, 0.95, 0.5, 0.009], [2.65, 4.75, 0.6, 0.6, 0.5],
  ]);

  // phone screen texture + a soft screen light
  const pc = document.createElement('canvas');
  pc.width = 360; pc.height = 780;
  const phoneTex = new THREE.CanvasTexture(pc);
  phoneTex.colorSpace = THREE.SRGBColorSpace;
  refs.phoneScreen.material.map = phoneTex;
  refs.phoneScreen.material.color.set(0xffffff);
  refs.phoneScreen.material.needsUpdate = true;

  const post = buildPost(renderer, scene, camera, W, H, { msaa: Number(params.get('msaa') ?? 4) });
  const overlay = new Overlay(W, H);
  const ctx = { renderer, scene, camera, refs, mom, momShadow, mom3, you, tv, steam, post, overlay, timeline, phoneScreen: { canvas: pc, ctx: pc.getContext('2d'), tex: phoneTex } };
  const director = new Director(ctx);

  function renderFrame(t, frame = Math.round(t * FPS)) {
    const ui = director.update(t, frame);
    // live feed for the final twist (TV shows black while its own feed is rendered -> no feedback loop)
    // the IR light only exists during the twist (keeps per-pixel light loops short everywhere else)
    const twist = t >= timeline.events.feedOn - 0.2;
    if (twist && !tv.ir.parent) scene.add(tv.ir);
    if (!twist && tv.ir.parent) scene.remove(tv.ir);
    if (twist) {
      const m = tv.mat.uniforms.uOff.value;
      tv.mat.uniforms.uOff.value = 1;
      tv.ir.intensity = 1.5;
      renderer.setRenderTarget(tv.feedRT);
      renderer.render(scene, tv.feedCam);
      renderer.setRenderTarget(null);
      tv.ir.intensity = 0;
      tv.mat.uniforms.uOff.value = m;
    }
    post.composer.render();
    return overlay.compose(renderer.domElement, ui);
  }

  window.renderFrame = renderFrame;
  window.__renderer = renderer; window.__scene = scene; window.__post = post;
  // profiling helper: average ms per frame (forces GPU completion with a 1-pixel readback)
  window.profile = (t, n = 3, opts = {}) => {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    post.dof.enabled = !opts.noDOF;
    post.bloom.enabled = !opts.noBloom;
    renderer.shadowMap.enabled = !opts.noShadows;
    renderFrame(t);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { renderFrame(t + i / 30); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    const ms = (performance.now() - t0) / n;
    post.dof.enabled = true; post.bloom.enabled = true; renderer.shadowMap.enabled = true;
    return ms;
  };
  window.timeline = timeline;
  window.stillPNG = (t) => renderFrame(t).toDataURL('image/png');
  window.sendFrame = async (frame) => {
    const cv = renderFrame(frame / FPS, frame);
    const data = overlay.g.getImageData(0, 0, W, H).data;
    const res = await fetch(`/frame/${frame}`, { method: 'POST', body: data });
    if (!res.ok) throw new Error(`frame ${frame} upload failed`);
    return cv.width;
  };
  window.ready = true;
  if (params.has('preview')) startPreview(renderFrame, overlay, renderer, timeline);
}

// Real-time preview in a normal browser (not used by the deterministic capture).
function startPreview(renderFrame, overlay, renderer, timeline) {
  renderer.domElement.style.display = 'none';
  const cv = overlay.canvas;
  cv.style.cssText = 'height:100vh;display:block;margin:0 auto;cursor:pointer';
  document.body.appendChild(cv);
  const audio = new Audio('/audio/mix/master.wav');
  let haveAudio = true, playing = false, t = Number(params.get('t') || 0), last = performance.now();
  audio.addEventListener('error', () => { haveAudio = false; });
  const toggle = () => { playing = !playing; if (haveAudio) { audio.currentTime = t; playing ? audio.play().catch(() => { haveAudio = false; }) : audio.pause(); } };
  cv.addEventListener('click', toggle);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') toggle();
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { t = Math.max(0, t + (e.code === 'ArrowRight' ? 1 : -1)); if (haveAudio) audio.currentTime = t; }
  });
  const loop = (now) => {
    if (playing) t = haveAudio && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
    if (t >= timeline.duration) { t = 0; if (haveAudio) audio.currentTime = 0; }
    last = now;
    renderFrame(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

init().catch((e) => { console.error('INIT FAILED', e && e.stack ? e.stack : e); window.initError = String(e && e.stack ? e.stack : e); });
