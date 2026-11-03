import * as THREE from 'three';
import { buildIcons } from './lib/gfx.js';
import { buildSets } from './lib/sets.js';
import { Person, makeController, makeCup, makeLaptop, makeMic, makePhone, LAYER_FX, LAYER_CENSOR } from './lib/chars.js';
import { FX } from './lib/fx.js';
import { Overlay } from './lib/overlay.js';
import { Director } from './director.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920;
const CHECK = q.get('check') === '1';

await Promise.all([document.fonts.load('900 40px "Montserrat"'), document.fonts.load('800 40px "Montserrat"'), document.fonts.load('40px "Bangers"')]);
buildIcons();
const timeline = await (await fetch(q.get('timeline') || '/build/timeline.json')).json();

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8daf2);
const camera = new THREE.PerspectiveCamera(45, W / H, 0.03, 400);
camera.layers.enable(LAYER_FX);
const tvCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 400);
tvCam.layers.enable(LAYER_FX);
const tvRT = new THREE.WebGLRenderTarget(640, 360, { colorSpace: THREE.SRGBColorSpace });

const world = buildSets(scene);

const C = (o) => new Person(o);
const cast = {
  you: C({ skin: 0xefc29d, shirt: 0x5fb36b, print: 0xffd23d, pants: 0x5a6b8c, shoes: 0xf2f2f2, longPants: false, hair: 'messy', hairColor: 0x3b2618, darkCircles: true, beard: true, censor: true, seed: 4 }),
  mom: C({ skin: 0xf0c7a6, shirt: 0xf3a6c4, pants: 0xf3a6c4, shoes: 0xb07a5a, apron: 0xfff3d6, hair: 'bun', hairColor: 0x8a6a52, longSleeves: true, seed: 8 }),
  recep: C({ skin: 0xd9a27c, shirt: 0xffffff, pants: 0x2d3a55, shoes: 0x222222, hair: 'bob', hairColor: 0x2a1c14, glasses: 0x222222, longSleeves: true, seed: 12 }),
  guard1: C({ skin: 0xc58c66, shirt: 0x15161a, pants: 0x15161a, shoes: 0x0a0a0a, hair: 'short', hairColor: 0x111111, sunglasses: true, tie: 0x15161a, lapels: 0x222327, longSleeves: true, scale: 1.12, wide: 1.25, seed: 20 }),
  guard2: C({ skin: 0x9a6a48, shirt: 0x15161a, pants: 0x15161a, shoes: 0x0a0a0a, hair: 'short', hairColor: 0x111111, sunglasses: true, tie: 0x15161a, lapels: 0x222327, longSleeves: true, scale: 1.14, wide: 1.28, seed: 21 }),
  w1: C({ skin: 0xf1c9a5, shirt: 0x8fc1ff, pants: 0x3d4a66, hair: 'short', hairColor: 0x8a5a2b, seed: 30 }),
  w2: C({ skin: 0xa86f48, shirt: 0xffb3c7, pants: 0x2f3442, hair: 'ponytail', hairColor: 0x111111, seed: 31 }),
  w3: C({ skin: 0xeab894, shirt: 0xb3f0c2, pants: 0x4a4a4a, hair: 'short', hairColor: 0xd8b45a, glasses: 0x333333, seed: 32 }),
  w4: C({ skin: 0xd39a74, shirt: 0xffe08a, pants: 0x30405e, hair: 'bob', hairColor: 0x5a3a2a, seed: 33 }),
  reporter: C({ skin: 0xe6b48f, shirt: 0x2f6bff, pants: 0x1d2433, shoes: 0x111111, hair: 'bob', hairColor: 0xc89a4a, lapels: 0x2559d6, longSleeves: true, seed: 40 }),
};
for (const k in cast) scene.add(cast[k].root);
const props = {
  controller: makeController(), phone: makePhone(), mic: makeMic(),
  cup: makeCup(), cups: [makeCup(0xffffff, 0x6ab0ff), makeCup(0xffffff, 0xff8aa6)],
  laptops: [makeLaptop(), makeLaptop(0xd9dde3)],
};
for (const k in props) (Array.isArray(props[k]) ? props[k] : [props[k]]).forEach(p => scene.add(p));
cast.props = props;

const fx = new FX(scene);
const overlay = new Overlay(W, H);
const director = new Director({ camera, world, cast, fx, timeline, W, H });

// ---------------------------------------------------------------- censor
// The proxy box (layer 1) is drawn after an all-black depth pass of the
// opaque scene, so only the part of the private zone that is really visible
// from this camera shows up. The mosaic covers that region (+ padding).
const MW = Math.round(W / 2), MH = Math.round(H / 2);
const maskRT = new THREE.WebGLRenderTarget(MW, MH);
const maskBuf = new Uint8Array(MW * MH * 4);
const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const maskMats = new Map();
function maskMaterialFor(m) {
  if (!m.alphaTest || !m.map) return blackMat;
  if (!maskMats.has(m)) maskMats.set(m, new THREE.MeshBasicMaterial({ color: 0x000000, map: m.map, alphaTest: m.alphaTest, side: m.side }));
  return maskMats.get(m);
}
function censorRegion() {
  const you = cast.you;
  if (!you.naked || !you.root.visible) return null;
  const swapped = [];
  scene.traverse(o => {
    if (o.isMesh && o.layers.isEnabled(0) && !o.layers.isEnabled(LAYER_CENSOR)) {
      swapped.push([o, o.material]);
      o.material = Array.isArray(o.material) ? o.material.map(maskMaterialFor) : maskMaterialFor(o.material);
    }
  });
  const bg = scene.background;
  scene.background = null;
  renderer.shadowMap.autoUpdate = false;
  const tm = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(maskRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, true);
  camera.layers.set(0);
  renderer.render(scene, camera);
  camera.layers.set(LAYER_CENSOR);
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true;
  renderer.setRenderTarget(null);
  camera.layers.set(0); camera.layers.enable(LAYER_FX);
  scene.background = bg;
  renderer.shadowMap.autoUpdate = true;
  renderer.toneMapping = tm;
  for (const [o, m] of swapped) o.material = m;
  renderer.readRenderTargetPixels(maskRT, 0, 0, MW, MH, maskBuf);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < MH; y++) {
    const row = y * MW * 4;
    for (let x = 0; x < MW; x++) {
      const i = row + x * 4;
      if (maskBuf[i] > 128 && maskBuf[i + 2] > 128 && maskBuf[i + 1] < 64) {
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        const yy = MH - 1 - y;
        if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
    }
  }
  if (!n) return { pixels: 0 };
  const sx = W / MW, sy = H / MH;
  let rx = x0 * sx, ry = y0 * sy, rw = (x1 - x0 + 1) * sx, rh = (y1 - y0 + 1) * sy;
  const pad = 6 * (W / 1080) + 0.06 * Math.max(rw, rh);
  rx -= pad; ry -= pad; rw += 2 * pad; rh += 2 * pad;
  return { pixels: n, rect: [rx, ry, rw, rh] };
}

// check mode: paint the actual private area magenta to prove the mosaic hides it
let checkBox = null;
if (CHECK) {
  const g = new THREE.BoxGeometry(0.37, 0.3, 0.23);
  g.translate(0, -0.07, 0);
  checkBox = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false }));
  cast.you.hips.add(checkBox);
}

// ---------------------------------------------------------------- compositing
const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
const fg = frame.getContext('2d', { willReadFrequently: CHECK });
const out = document.createElement('canvas'); out.width = W; out.height = H;
const g = out.getContext('2d', { willReadFrequently: CHECK });
document.body.appendChild(out);
let lastCensor = null, lastRects = [];

function composite(t, st, cen) {
  const k = W / 1080;
  fg.drawImage(renderer.domElement, 0, 0);
  lastRects = [];
  if (cen && cen.rect) {
    const [x, y, w, h] = cen.rect;
    const block = Math.max(9 * k, Math.min(34 * k, Math.max(w, h) / 7));
    overlay.mosaic(fg, x, y, w, h, block);
    lastRects.push([x, y, w, h]);
  }
  const sx = st.shake[0] * k, sy = st.shake[1] * k;
  const z = st.shakeAmt > 0 ? 1.04 : 1;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.drawImage(frame, (W - W * z) / 2 + sx, (H - H * z) / 2 + sy, W * z, H * z);
  g.restore();
  // map the censor rects through the same shake transform (for the check)
  lastRects = lastRects.map(([x, y, w, h]) => [(W - W * z) / 2 + sx + x * z, (H - H * z) / 2 + sy + y * z, w * z, h * z]);
  overlay.vignette(g, st.vignette);
  if (st.speed > 0) overlay.speedLines(g, t, st.speed);
  if (st.whoosh) overlay.whoosh(g, t, st.whoosh.dir, st.whoosh.y);
  if (st.bubble) overlay.bubble(g, st.bubble, t);
  for (const l of st.labels) {
    if (l.world) { const p = l.world.clone().project(camera); l.tx = (p.x * 0.5 + 0.5) * W + sx; l.ty = (-p.y * 0.5 + 0.5) * H + sy; }
    overlay.label(g, l, t);
  }
  for (const s of st.stamps) overlay.stamp(g, s, t);
  if (st.banner) overlay.newsBanner(g, st.banner.t, st.banner.text, st.banner.sub);
  for (const w of director.comicWords(t)) overlay.comic(g, w, t);
  const cap = timeline.captions.find(c => t >= c.s && t < c.hide);
  if (cap) overlay.caption(g, cap, t, [sx * 0.6, sy * 0.6]);
  overlay.fill(g, '#ffffff', st.flash);
  overlay.fill(g, '#000000', st.fade);
}

function checkFrame() {
  // count magenta pixels of the private area that are NOT under a mosaic
  const img = g.getImageData(0, 0, W, H).data;
  let bad = 0, total = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (img[i] > 200 && img[i + 1] < 70 && img[i + 2] > 200) {
      total++;
      const inside = lastRects.some(([rx, ry, rw, rh]) => x >= rx - 1 && x <= rx + rw + 1 && y >= ry - 1 && y <= ry + rh + 1);
      if (!inside) bad++;
    }
  }
  return { magenta: total, uncovered: bad };
}

window.renderFrame = (t, quality = 0.92) => {
  const st = director.update(t);
  if (checkBox) checkBox.visible = cast.you.naked && cast.you.root.visible;
  if (st.tvView) {
    tvCam.position.copy(st.tvView.pos); tvCam.lookAt(st.tvView.look); tvCam.fov = st.tvView.fov || 40; tvCam.updateProjectionMatrix();
    renderer.setRenderTarget(tvRT); renderer.render(scene, tvCam); renderer.setRenderTarget(null);
    world.tvScreen.material.map = tvRT.texture;
  }
  renderer.render(scene, camera);
  const cen = censorRegion();
  lastCensor = { naked: cast.you.naked && cast.you.root.visible, pixels: cen ? cen.pixels : 0, rect: cen && cen.rect ? cen.rect.map(v => Math.round(v)) : null };
  composite(t, st, cen);
  if (CHECK) lastCensor.check = checkFrame();
  return quality ? out.toDataURL('image/jpeg', quality) : null;
};
window.censorInfo = () => lastCensor;
window.renderDebug = (t, pos, look, fov = 40) => {
  director.update(t);
  director.forceCam = { pos, look, fov };
  const r = window.renderFrame(t, 0.9);
  director.forceCam = null;
  return r;
};
window.sceneInfo = (t) => { const c = director.ctxFor(t); return { id: c.id, shot: director.schedule(director.defs[c.id], c) }; };
window.sfxEvents = () => director.events.map(e => ({ t: e.t, type: e.type, gain: e.gain || 0.5, dur: e.dur || 0 }));
window.TIMELINE = timeline;
window.READY = true;
