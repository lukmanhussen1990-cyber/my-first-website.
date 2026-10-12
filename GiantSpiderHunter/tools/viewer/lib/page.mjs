// Browser side of the viewer (runs inside headless Chromium). Loaded as an ES module from
// the virtual origin http://viewer.local/ (served by lib/renderer.mjs).
import * as THREE from './three.module.js';

const state = {};

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelTexture(size, painter, seed) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [R, G, B] = painter(x, y, r);
      const i = (y * size + x) * 4;
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function grassTexture(grid) {
  return pixelTexture(16, (x, y, r) => {
    const n = r();
    let c = [92 + n * 40, 140 + n * 45, 58 + n * 25];
    if (grid && (x === 0 || y === 0)) c = c.map((v) => v * 0.82);
    return c;
  }, 7);
}
function barkTexture() {
  return pixelTexture(16, (x, y, r) => {
    const stripe = (x % 4 === 0) ? 0.75 : 1;
    const n = r() * 0.25 + 0.8;
    return [104 * n * stripe, 80 * n * stripe, 50 * n * stripe];
  }, 11);
}
function leavesTexture() {
  return pixelTexture(16, (x, y, r) => {
    const n = r();
    const k = n < 0.18 ? 0.55 : 0.85 + n * 0.25;
    return [48 * k, 104 * k, 34 * k];
  }, 13);
}
function loadTexture(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

window.viewerSetup = async (cfg) => {
  const canvas = document.getElementById('c');
  canvas.width = cfg.width; canvas.height = cfg.height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(cfg.width, cfg.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = cfg.shadows !== false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const sky = new THREE.Color(cfg.background || '#a9c8e8');
  scene.background = sky;
  if (cfg.fog) scene.fog = new THREE.Fog(sky, cfg.fog[0], cfg.fog[1]);

  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a5a3a, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // ground
  if (cfg.ground) {
    const size = cfg.ground.size;
    const gtex = grassTexture(cfg.ground.grid !== false);
    gtex.repeat.set(size, size);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: gtex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cfg.ground.center[0], 0, cfg.ground.center[1]);
    ground.receiveShadow = true;
    scene.add(ground);
  }
  // trees
  if (cfg.trees && cfg.trees.length) {
    const bark = new THREE.MeshLambertMaterial({ map: barkTexture() });
    const leaves = new THREE.MeshLambertMaterial({ map: leavesTexture() });
    const mk = (w, h, d, mat, x, y, z, ux, uy) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4); // px nx py ny pz nz
        const fw = face < 2 ? d : w;
        const fh = face === 2 || face === 3 ? d : h;
        uv.setXY(i, uv.getX(i) * fw, uv.getY(i) * fh);
      }
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    for (const t of cfg.trees) {
      const [x, z, h] = t;
      const trunkH = h - 1;
      scene.add(mk(1, trunkH, 1, bark, x, trunkH / 2, z));
      scene.add(mk(5, 2, 5, leaves, x, h - 3 + 1, z));
      scene.add(mk(3, 1, 3, leaves, x, h - 1 + 0.5, z));
    }
  }
  // entity
  const tex = await loadTexture(cfg.texture);
  let emissive = null;
  if (cfg.emissive) emissive = await loadTexture(cfg.emissive);
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    alphaTest: cfg.alphaTest ? 0.5 : 0,
    transparent: false,
    side: THREE.FrontSide,
  });
  if (emissive) { mat.emissiveMap = emissive; mat.emissive = new THREE.Color(0xffffff); }
  const bones = {};
  for (const [key, b] of Object.entries(cfg.bones)) {
    if (!b.positions.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
    const m = new THREE.Mesh(g, b.color ? new THREE.MeshLambertMaterial({ color: b.color }) : mat);
    m.matrixAutoUpdate = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    bones[key] = m;
  }
  const markerGeo = new THREE.SphereGeometry(1, 10, 8);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false });
  const markers = [];
  const camera = new THREE.PerspectiveCamera(cfg.fov || 50, cfg.width / cfg.height, 0.05, 2000);
  Object.assign(state, { renderer, scene, camera, sun, bones, markers, markerGeo, markerMat, cfg });
  return true;
};

window.viewerRender = (f) => {
  const { renderer, scene, camera, sun, bones, cfg } = state;
  for (const [key, m] of Object.entries(bones)) {
    const arr = f.bones[key];
    if (!arr) { m.visible = false; continue; }
    m.visible = true;
    m.matrix.fromArray(arr);
    m.matrixWorldNeedsUpdate = true;
  }
  // locator markers
  const locs = f.markers || [];
  while (state.markers.length < locs.length) {
    const mk = new THREE.Mesh(state.markerGeo, state.markerMat);
    mk.renderOrder = 999;
    scene.add(mk);
    state.markers.push(mk);
  }
  state.markers.forEach((mk, i) => {
    if (i < locs.length) { mk.visible = true; mk.position.fromArray(locs[i]); mk.scale.setScalar(f.markerSize || 0.15); } else mk.visible = false;
  });
  camera.position.fromArray(f.camera.position);
  camera.up.fromArray(f.camera.up || [0, 1, 0]);
  camera.fov = f.camera.fov || cfg.fov || 50;
  camera.near = f.camera.near || 0.05;
  camera.far = f.camera.far || 2000;
  camera.updateProjectionMatrix();
  camera.lookAt(new THREE.Vector3().fromArray(f.camera.target));
  // sun follows the subject so its shadow camera covers it
  const c = new THREE.Vector3().fromArray(f.light.center);
  const R = f.light.radius;
  const dir = new THREE.Vector3().fromArray(f.light.dir).normalize();
  sun.position.copy(c).addScaledVector(dir, R * 3);
  sun.target.position.copy(c);
  sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera;
  sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 0.1; sc.far = R * 6;
  sc.updateProjectionMatrix();
  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = cfg.width; out.height = cfg.height;
  const g = out.getContext('2d');
  g.drawImage(renderer.domElement, 0, 0);
  if (f.label) {
    const lines = Array.isArray(f.label) ? f.label : [f.label];
    const fs = Math.max(12, Math.round(cfg.height / 30));
    g.font = `bold ${fs}px "DejaVu Sans", sans-serif`;
    let y = fs + 6;
    for (const line of lines) {
      const w = g.measureText(line).width;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(4, y - fs - 2, w + 12, fs + 8);
      g.fillStyle = '#ffffff';
      g.fillText(line, 10, y);
      y += fs + 10;
    }
  }
  return out.toDataURL('image/png');
};

window.viewerSheet = async (sheet) => {
  const imgs = await Promise.all(sheet.tiles.map((src) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
  })));
  const tw = imgs[0].width; const th = imgs[0].height;
  const cols = sheet.cols;
  const rows = Math.ceil(imgs.length / cols);
  const pad = 4;
  const header = sheet.title ? Math.max(28, Math.round(th / 12)) : 0;
  const c = document.createElement('canvas');
  c.width = cols * tw + (cols + 1) * pad;
  c.height = rows * th + (rows + 1) * pad + header;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1d22';
  g.fillRect(0, 0, c.width, c.height);
  if (sheet.title) {
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.round(header * 0.6)}px "DejaVu Sans", sans-serif`;
    g.fillText(sheet.title, pad + 4, Math.round(header * 0.75));
  }
  imgs.forEach((im, i) => {
    const x = pad + (i % cols) * (tw + pad);
    const y = header + pad + Math.floor(i / cols) * (th + pad);
    g.drawImage(im, x, y);
  });
  return c.toDataURL('image/png');
};
