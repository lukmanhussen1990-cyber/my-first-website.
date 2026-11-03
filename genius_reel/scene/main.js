// Renders ONE shot of the genius reel (index.html?shot=N&w=..&h=..). A shot module builds its set + cast once,
// then every frame is a pure function of the shot-local time lt (seconds): pose -> solve -> camera -> render.
import * as THREE from 'three';
import { SHOTS } from './shots.js';
import { solve } from './cast.js';

window.addEventListener('error', (e) => { window.APP_ERROR = String(e.message || e); });
window.addEventListener('unhandledrejection', (e) => { window.APP_ERROR = String(e.reason?.stack || e.reason); });
const params = new URLSearchParams(location.search);
const id = Number(params.get('shot') || 1);
const WIDTH = Number(params.get('w') || 1080), HEIGHT = Number(params.get('h') || 1920);
const plan = await (await fetch('../shots.json')).json();
const SP = plan.shots.find((s) => s.id === id);
const DUR = SP.t1 - SP.t0;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1210');
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.03, 150);
scene.add(camera);
const W = { THREE, scene, camera, renderer, cast: [], chars: {}, id, dur: DUR };
const S = SHOTS[id];
if (!S) throw new Error(`no shot ${id}`);
const ctx = S.build(W) || {};

function frame(lt) {
  // three passes: targets that depend on body positions (mouth, head, chest) are read from the previous solve
  // (the first pass can lean the body toward a wrong target; the later ones settle)
  for (let pass = 0; pass < 3; pass++) {
    for (const ch of W.cast) ch.p = ch.defaults();
    S.update(W, ctx, lt);
    for (const ch of W.cast) solve(ch, lt);
  }
  if (S.after) S.after(W, ctx, lt);
  const c = params.get('cam') ? JSON.parse(params.get('cam')) : S.cam(W, ctx, lt);
  camera.position.set(...c.pos); camera.up.set(0, 1, 0); camera.lookAt(...c.target);
  if (c.roll) camera.rotateZ(c.roll);
  camera.fov = c.fov ?? 40; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
const toV = (p) => (p.isVector3 ? p : new THREE.Vector3(...p));
// pixel-mosaic censor spots: S.mosaic(W, ctx, lt) -> [{ p: world point, r: half-size in metres }] projected to
// [u, v, ru, rv] (centre and half-size as fractions of the frame width / height); off-screen spots are dropped
function mosaicUV(lt) {
  if (!S.mosaic) return [];
  const out = [], right = new THREE.Vector3(), up = new THREE.Vector3();
  camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
  for (const m of S.mosaic(W, ctx, lt) || []) {
    const p = toV(m.p), c = p.clone().project(camera);
    if (c.z > 1 || c.z < -1) continue;
    const px = p.clone().addScaledVector(right, m.r).project(camera), py = p.clone().addScaledVector(up, m.r * (m.k ?? 1)).project(camera);
    const u = c.x * 0.5 + 0.5, v = 0.5 - c.y * 0.5, ru = Math.abs(px.x - c.x) * 0.5, rv = Math.abs(py.y - c.y) * 0.5;
    if (u + ru < 0 || u - ru > 1 || v + rv < 0 || v - rv > 1) continue;
    out.push([+u.toFixed(4), +v.toFixed(4), +ru.toFixed(4), +rv.toFixed(4)]);
  }
  return out;
}
window.APP = {
  info: () => ({ id, dur: DUR, still: S.still ?? 0.5, clip: S.clip !== false }),
  renderM(lt, type = 'image/jpeg', q = 0.94) { frame(lt); renderer.render(scene, camera); return { url: renderer.domElement.toDataURL(type, q), mosaic: mosaicUV(lt) }; },
  render(lt, type = 'image/jpeg', q = 0.94) { frame(lt); renderer.render(scene, camera); return renderer.domElement.toDataURL(type, q); },
  anchors(lt) {
    frame(lt);
    const A = S.anchors ? S.anchors(W, ctx, lt) : {}, out = {};
    for (const [k, v] of Object.entries(A)) {
      const pts = Array.isArray(v) && v.length && (v[0].isVector3 || Array.isArray(v[0])) ? v : [v];
      const uv = pts.map((p) => { const q = toV(p).clone().project(camera); return [+(q.x * 0.5 + 0.5).toFixed(4), +(0.5 - q.y * 0.5).toFixed(4)]; });
      out[k] = uv.length === 1 ? uv[0] : uv;
    }
    return out;
  },
};
window.APP_READY = true;
