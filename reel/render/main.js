// Entry point for the headless renderer. Every frame is a pure function of
// its frame number, so any frame can be rendered on its own, in any order.
import * as THREE from 'three';
import { makeEnvMaps } from './lib/envs.js';
import { createPost } from './post.js';
import { buildCar } from './car.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);
const MODE = params.get('mode') || 'film';

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the grade pass writes sRGB itself
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();

let frameFn = null;

async function setupLab() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15171a);
  const envs = makeEnvMaps(renderer);
  scene.environment = envs[params.get('env') || 'studio'];
  scene.environmentIntensity = 1.0;
  // Cyclorama floor + wall.
  const cyc = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.85 }));
  cyc.rotation.x = -Math.PI / 2; cyc.receiveShadow = true; scene.add(cyc);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 7, -4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
  key.shadow.radius = 4; key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.2); rim.position.set(-6, 3, 5); scene.add(rim);
  const fill = new THREE.HemisphereLight(0xbfc8d6, 0x202020, 0.6); scene.add(fill);
  const car = buildCar();
  scene.add(car.root);
  const subject = params.get('subject');
  if (subject) {
    const { buildJohn, buildTourist } = await import('./characters.js');
    car.root.visible = false;
    const ch = subject === 'john' ? buildJohn() : buildTourist();
    scene.add(ch.root);
    ch.root.position.set(0, subject === 'john' ? 0.5 : 0, 0);
    ch.root.rotation.y = -0.5;
    ch.pose(JSON.parse(params.get('pose') || '{}'));
    window.__char = ch;
  }
  if (params.get('debug') === 'glass') {
    const solid = (c) => new THREE.MeshBasicMaterial({ color: c });
    car.root.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) {
      o.material = o.material.map((m, i) => (i === 2 ? solid(0x00ff00) : i === 6 ? solid(0xff00ff) : m)); } });
  }
  const views = {
    side: { pos: [0.1, 1.0, -10.5], look: [0.1, 0.62, 0], fov: 19 },
    ref3: { pos: [2.6, 1.55, -8.6], look: [0.0, 0.58, 0], fov: 24 },
    ref2: { pos: [5.3, 0.95, -3.4], look: [0.0, 0.62, 0.2], fov: 34 },
    front34: { pos: [6.2, 1.45, -4.3], look: [0.1, 0.55, 0], fov: 28 },
    front34r: { pos: [5.0, 1.7, 5.6], look: [0.0, 0.55, 0], fov: 28 },
    rear34: { pos: [-6.0, 1.7, -4.4], look: [0.0, 0.6, 0], fov: 28 },
    top: { pos: [0.0, 12, -0.01], look: [0, 0, 0], fov: 25 },
    front: { pos: [9, 0.8, 0], look: [0, 0.6, 0], fov: 16 },
    johnFace: { pos: [1.25, 1.0, 0.35], look: [0.0, 0.93, 0], fov: 30 },
    tourist: { pos: [3.0, 1.35, 1.9], look: [0.0, 0.8, 0], fov: 32 },
  };
  const v = views[params.get('view') || 'side'];
  const camera = new THREE.PerspectiveCamera(v.fov, W / H, 0.1, 200);
  camera.position.set(...v.pos); camera.lookAt(...v.look);
  const post = createPost(renderer, scene, camera, W, H);
  post.bloom.strength = 0.25;
  post.grade.uniforms.uExposure.value = 1.15;
  if (params.get('door')) car.setDoorOpen(+params.get('door'));
  frameFn = (f) => { car.setWheelSpin(f * 0.1); post.render(); };
}

async function setupFilm() {
  const { createFilm } = await import('./film.js');
  frameFn = await createFilm({ renderer, W, H, params });
}

window.renderFrame = (f) => { frameFn(f); const p = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return true; };
const pixels = new Uint8Array(W * H * 4);
window.sendFrame = async (id) => {
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const r = await fetch(`/__frame/${id}`, { method: 'POST', body: pixels });
  return r.status;
};

(MODE === 'lab' ? setupLab() : setupFilm()).then(() => { window.ready = true; })
  .catch((e) => { console.error('setup failed', e.stack || e); window.setupError = String(e.stack || e); });
