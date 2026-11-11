// "Hey Daddy!" boxing reel — deterministic low-poly scene renderer. window.render(t) draws frame at time t.
const W = 1080, H = 1920;
const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const ss = (t, a, b) => sm(seg(t, a, b));
const eo = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const eoBack = (t) => { t = clamp(t, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const glc = document.getElementById('gl');
const ov = document.getElementById('ov');
const ctx = ov.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 200);

// ---------- helpers ----------
const matCache = {};
function M(c, opt) {
  const k = c + JSON.stringify(opt || {});
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }, opt || {}));
  return matCache[k];
}
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function box(w, h, d, c, x, y, z, parent, shadow = true) {
  return mesh(new THREE.BoxGeometry(w, h, d), (c && c.isMaterial) ? c : M(c), parent, x, y, z, shadow);
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function addBeam(parent, rTop, rBot, h, color, opacity) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 24, 1, true);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const b = new THREE.Mesh(g, m); parent.add(b); return b;
}

// ---------- characters ----------
function makeChar(o) {
  const c = { o };
  const root = grp(null); c.root = root;
  const legL = o.legL, tH = o.tH, tW = o.tW, tD = o.tD, hr = o.hr;
  const armW = o.armW || 0.1, up = o.up || 0.3, fo = o.fo || 0.28, legW = o.legW || 0.13;
  c.legL = legL;
  const hips = grp(root, 0, legL, 0); c.hips = hips;
  box(tW * 0.96, 0.18, tD * 0.96, o.pants, 0, 0.02, 0, hips);
  const torso = grp(hips, 0, 0.06, 0); c.torso = torso;
  c.shirtMat = M(o.shirt).clone();
  box(tW, tH, tD, c.shirtMat, 0, tH / 2, 0, torso);
  if (o.belly) {
    c.bellyMat = c.shirtMat;
    const b = mesh(new THREE.IcosahedronGeometry(1, 1), c.bellyMat, torso);
    b.scale.set(tW * 0.46, tH * 0.36, 0.2); b.position.set(0, tH * 0.3, tD * 0.4); c.belly = b;
  }
  if (o.bigChest) { // boxer pecs
    const p = mesh(new THREE.IcosahedronGeometry(1, 1), M(o.skin), torso);
    p.scale.set(tW * 0.5, tH * 0.2, 0.12); p.position.set(0, tH * 0.72, tD * 0.42);
    const ab = box(tW * 0.5, tH * 0.35, 0.06, o.skin, 0, tH * 0.32, tD * 0.5, torso);
  }
  // neck + head
  const neck = grp(torso, 0, tH, 0); c.neck = neck;
  box(0.12 * (o.neckW || 1), 0.09, 0.12 * (o.neckW || 1), o.skin, 0, 0.04, 0, neck);
  const head = grp(neck, 0, 0.07, 0); c.head = head;
  const hm = mesh(new THREE.IcosahedronGeometry(hr, 1), M(o.skin), head, 0, hr * 1.08, 0);
  hm.scale.set(1, 1.12, 0.98);
  const fz = hr * 0.93; // face plane
  c.hr = hr;
  // nose
  box(hr * 0.22, hr * 0.28, hr * 0.25, o.skin, 0, hr * 0.98, fz + hr * 0.06, head);
  // ears
  box(hr * 0.12, hr * 0.3, hr * 0.2, o.skin, hr * 0.98, hr * 1.05, 0, head);
  box(hr * 0.12, hr * 0.3, hr * 0.2, o.skin, -hr * 0.98, hr * 1.05, 0, head);
  // eyes
  c.eyes = [];
  for (const s of [1, -1]) {
    const e = grp(head, s * hr * 0.4, hr * 1.25, fz);
    if (o.bigEyes) {
      box(hr * 0.42, hr * 0.5, 0.03, '#ffffff', 0, 0, 0.0, e, false);
      const p = box(hr * 0.24, hr * 0.3, 0.03, '#141414', -s * hr * 0.02, -hr * 0.04, 0.02, e, false);
      box(hr * 0.08, hr * 0.09, 0.02, '#ffffff', hr * 0.05, hr * 0.06, 0.04, e, false);
      c.pupils = c.pupils || []; c.pupils.push(p);
    } else {
      box(hr * 0.17, hr * 0.26, 0.03, '#161616', 0, 0, 0, e, false);
      box(hr * 0.06, hr * 0.07, 0.02, '#ffffff', hr * 0.03, hr * 0.06, 0.02, e, false);
    }
    c.eyes.push(e);
    const br = box(hr * 0.42, hr * 0.09, 0.04, o.brow || o.hair || '#2a1a10', s * hr * 0.4, hr * 1.55, fz + 0.005, head, false);
    br.rotation.z = s * (o.angryBrow ? -0.35 : 0.12);
    (c.brows = c.brows || []).push(br);
  }
  // mouth
  const mz = o.mouthZ || fz + 0.01;
  c.mouth = box(hr * (o.bigEyes ? 0.32 : 0.5), hr * 0.1, 0.03, o.bigEyes ? '#8a1c2c' : '#5a1414', 0, hr * (o.bigEyes ? 0.62 : 0.68), mz, head, false);
  if (o.bigEyes) c.mouthMax = 1.6;
  c.mouthBase = hr * (o.bigEyes ? 0.62 : 0.68);
  if (o.hair) {
    const cap = mesh(new THREE.SphereGeometry(hr * 1.1, 9, 5, 0, PI * 2, 0, PI * 0.43), M(o.hair), head, 0, hr * 1.12, -hr * 0.04);
    cap.scale.set(1, 1.1, 1.02); cap.rotation.x = -0.3; c.hairCap = cap;
    if (o.fringe) {
      const f = box(hr * 1.5, hr * 0.32, hr * 0.5, o.hair, hr * 0.1, hr * 1.82, hr * 0.62, head);
      f.rotation.z = -0.15; f.rotation.x = 0.25; c.fringe = f;
    }
  }
  if (o.beard) {
    const b = mesh(new THREE.IcosahedronGeometry(hr, 1), M(o.beard), head, 0, hr * 0.62, hr * 0.12);
    b.scale.set(1.04, 0.62, 0.98);
    box(hr * 0.6, hr * 0.12, 0.05, o.beard, 0, hr * 0.84, fz + 0.06, head, false); // moustache
  }
  if (o.moustache) {
    const m = box(hr * 0.75, hr * 0.16, 0.05, o.moustache, 0, hr * 0.84, fz + 0.06, head, false);
    box(hr * 0.12, hr * 0.3, 0.05, o.moustache, hr * 0.36, hr * 0.72, fz + 0.04, head, false);
    box(hr * 0.12, hr * 0.3, 0.05, o.moustache, -hr * 0.36, hr * 0.72, fz + 0.04, head, false);
  }
  if (o.baldRing) {
    const r = mesh(new THREE.CylinderGeometry(hr * 1.02, hr * 1.02, hr * 0.35, 10, 1, true), M(o.baldRing, { side: THREE.DoubleSide }), head, 0, hr * 1.12, -hr * 0.1);
    r.scale.z = 0.95;
  }
  // sunglasses (hidden by default)
  const sg = grp(head, 0, hr * 1.25, fz + 0.04); c.glasses = sg; sg.visible = false;
  box(hr * 0.55, hr * 0.38, 0.04, '#0a0a0a', hr * 0.4, 0, 0, sg, false);
  box(hr * 0.55, hr * 0.38, 0.04, '#0a0a0a', -hr * 0.4, 0, 0, sg, false);
  box(hr * 1.6, hr * 0.08, 0.04, '#0a0a0a', 0, hr * 0.15, 0, sg, false);
  // arms
  const sleeve = o.sleeve || o.shirt;
  function arm(side) {
    const sh = grp(torso, side * (tW / 2 + armW / 2 + 0.01), tH - 0.07, 0);
    box(armW * 1.15, up * 0.45, armW * 1.15, o.noSleeve ? o.skin : sleeve, 0, -up * 0.2, 0, sh);
    box(armW, up, armW, o.armSkin ? o.skin : (o.longSleeve ? sleeve : o.skin), 0, -up / 2, 0, sh);
    const el = grp(sh, 0, -up, 0);
    box(armW * 0.92, fo, armW * 0.92, o.longSleeve ? sleeve : o.skin, 0, -fo / 2, 0, el);
    const hand = grp(el, 0, -fo, 0);
    if (o.gloves) box(armW * 2.1, armW * 2.2, armW * 2.2, o.gloves, 0, -armW * 0.9, armW * 0.2, hand);
    else box(armW * 1.05, 0.11, armW * 1.0, o.skin, 0, -0.05, 0, hand);
    return { sh, el, hand };
  }
  c.aL = arm(1); c.aR = arm(-1);
  // legs
  const th = (legL - 0.08) * 0.5;
  function leg(side) {
    const hp = grp(hips, side * tW * 0.24, 0, 0);
    box(legW, th, legW, o.pants, 0, -th / 2, 0, hp);
    const kn = grp(hp, 0, -th, 0);
    box(legW * 0.92, th, legW * 0.92, o.shin || o.pants, 0, -th / 2, 0, kn);
    const ft = grp(kn, 0, -th, 0);
    box(legW * 1.05, 0.08, 0.26, o.shoes, 0, -0.04, 0.06, ft);
    return { hp, kn, ft };
  }
  c.lL = leg(1); c.lR = leg(-1);
  c.th = th;
  root.traverse(m => { if (m.isMesh && o.scale) { } });
  if (o.scale) root.scale.setScalar(o.scale);
  return c;
}
const REST = { lsZ: 0.1, rsZ: -0.1, leX: -0.15, reX: -0.15 };
function pose(c, p) {
  const g = (k) => (p[k] !== undefined ? p[k] : (REST[k] || 0));
  c.hips.rotation.set(g('pX'), g('pY'), g('pZ'));
  c.hips.position.y = c.legL + g('hipY');
  c.torso.rotation.set(g('tX'), g('tY'), g('tZ'));
  c.head.rotation.set(g('hX'), g('hY'), g('hZ'));
  c.aL.sh.rotation.set(g('lsX'), g('lsY'), g('lsZ')); c.aL.el.rotation.set(g('leX'), 0, 0);
  c.aR.sh.rotation.set(g('rsX'), g('rsY'), g('rsZ')); c.aR.el.rotation.set(g('reX'), 0, 0);
  c.lL.hp.rotation.set(g('lhX'), 0, g('lhZ')); c.lL.kn.rotation.set(g('lkX'), 0, 0); c.lL.ft.rotation.set(g('lfX'), 0, 0);
  c.lR.hp.rotation.set(g('rhX'), 0, g('rhZ')); c.lR.kn.rotation.set(g('rkX'), 0, 0); c.lR.ft.rotation.set(g('rfX'), 0, 0);
}
function mix(a, b, t) {
  const r = {}; const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const va = a[k] !== undefined ? a[k] : (REST[k] || 0), vb = b[k] !== undefined ? b[k] : (REST[k] || 0); r[k] = lerp(va, vb, t); }
  return r;
}
function add(a, b) { const r = Object.assign({}, a); for (const k in b) r[k] = (r[k] !== undefined ? r[k] : (REST[k] || 0)) + b[k]; return r; }
const SIT = { lhX: -PI / 2, rhX: -PI / 2, lkX: PI / 2, rkX: PI / 2, lsX: -0.5, rsX: -0.5, leX: -0.9, reX: -0.9 };
function walkPose(ph, amp = 0.6) {
  const s = Math.sin(ph), s2 = Math.sin(ph + PI);
  return { lhX: s * amp, rhX: s2 * amp, lkX: Math.max(0, -Math.cos(ph)) * amp * 1.4, rkX: Math.max(0, Math.cos(ph)) * amp * 1.4, lsX: s2 * amp * 0.9, rsX: s * amp * 0.9, leX: -0.5, reX: -0.5 };
}
function setMouth(c, v) { const k = c.mouthMax || 2.6; c.mouth.scale.y = 1 + v * k; c.mouth.position.y = c.mouthBase - v * c.hr * 0.12; }

// speech envelope
const ENV = DATA.env;
function speaking(who, t) {
  for (const l of DATA.lines) {
    if (l.who === who && t >= l.start && t < l.end) {
      const vt = l.a + (t - l.start); const i = Math.floor(vt * 100);
      const v = (ENV[i] || 0) * 0.6 + (ENV[i + 1] || 0) * 0.4;
      return clamp(v * 1.2, 0, 1);
    }
  }
  return 0;
}

const C = {
  skinSon: '#c98a5e', skinDad: '#b97a50', hair: '#4a2a17', dadHair: '#2e1d12',
};

// =============== KITCHEN =================
const K = { scene: new THREE.Scene() };
(function buildKitchen() {
  const s = K.scene;
  s.background = new THREE.Color('#bfe6ff');
  const hemi = new THREE.HemisphereLight('#ffffff', '#c9a982', 1.9); s.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e0', 2.4);
  sun.position.set(4, 7, 5); sun.target.position.set(0, 0, -1); s.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
  sun.shadow.radius = 4; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  s.add(sun);
  // floor & walls
  box(12, 0.1, 10, '#e2bd8f', 0, -0.05, 1, s);
  for (let i = -5; i <= 5; i++) box(0.02, 0.005, 10, '#d3ab7c', i * 0.9, 0.002, 1, s, false);
  box(12, 3.4, 0.2, '#dde7ef', 0, 1.7, -3.1, s);
  box(0.2, 3.4, 10, '#e9e1d2', -5.2, 1.7, 1, s);
  box(0.2, 3.4, 10, '#e9e1d2', 5.0, 1.7, 1, s);
  box(12, 0.12, 0.25, '#ffffff', 0, 0.06, -2.98, s); // skirting
  // window
  box(1.7, 1.3, 0.08, '#ffffff', -1.1, 2.0, -2.99, s);
  box(1.5, 1.1, 0.06, M('#9fd8ff', { emissive: '#6fbef0', emissiveIntensity: 0.5 }), -1.1, 2.0, -2.95, s, false);
  box(0.06, 1.1, 0.07, '#ffffff', -1.1, 2.0, -2.93, s, false);
  box(1.5, 0.06, 0.07, '#ffffff', -1.1, 2.0, -2.93, s, false);
  // door on back wall left
  box(1.05, 2.15, 0.06, '#c0392b', -3.6, 1.075, -2.98, s);
  box(1.2, 2.25, 0.04, '#ffffff', -3.6, 1.12, -3.0, s, false);
  box(0.08, 0.08, 0.06, '#e6c35c', -3.25, 1.05, -2.92, s, false);
  // counter + cabinets
  box(2.6, 0.9, 0.65, '#ffffff', 1.0, 0.45, -2.68, s);
  box(2.7, 0.06, 0.72, '#7d8a96', 1.0, 0.93, -2.66, s);
  for (let i = 0; i < 3; i++) { box(0.8, 0.7, 0.02, '#f1f1f1', 0.15 + i * 0.85, 0.45, -2.345, s, false); box(0.2, 0.03, 0.03, '#888', 0.15 + i * 0.85, 0.7, -2.33, s, false); }
  box(2.6, 0.75, 0.4, '#ffffff', 1.0, 2.35, -2.85, s);
  for (let i = 0; i < 3; i++) box(0.8, 0.68, 0.02, '#f4f4f4', 0.15 + i * 0.85, 2.35, -2.64, s, false);
  // kettle + plant on counter
  mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.25, 8), M('#e74c3c'), s, 0.3, 1.08, -2.7);
  mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.18, 7), M('#a0522d'), s, 2.0, 1.05, -2.75);
  mesh(new THREE.IcosahedronGeometry(0.2, 0), M('#3fae49'), s, 2.0, 1.3, -2.75);
  // fridge
  const fr = grp(s, 2.95, 0, -2.6); K.fridge = fr;
  box(1.0, 2.1, 0.8, '#f4f6f8', 0, 1.05, 0, fr);
  box(1.0, 0.02, 0.02, '#c8ced4', 0, 1.35, 0.41, fr, false);
  box(0.05, 0.5, 0.06, '#9aa3ab', -0.4, 1.7, 0.43, fr, false);
  box(0.05, 0.4, 0.06, '#9aa3ab', -0.4, 1.0, 0.43, fr, false);
  // magnets
  K.magnets = [];
  const mc = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
  const mp = [[-0.15, 1.95], [0.15, 1.8], [0.3, 2.0], [0.0, 1.62], [-0.2, 1.72]];
  mp.forEach((p, i) => {
    const m = i % 2 ? mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), M(mc[i]), s) : box(0.11, 0.08, 0.03, mc[i], 0, 0, 0, s);
    if (i % 2) m.rotation.x = PI / 2;
    m.userData.home = V(2.95 + p[0], p[1], -2.17);
    K.magnets.push(m);
  });
  // table + chair
  const tb = grp(s, -1.1, 0, -0.6); K.table = tb;
  box(1.5, 0.07, 0.95, '#a46a3f', 0, 0.76, 0, tb);
  for (const [x, z] of [[-0.65, -0.4], [0.65, -0.4], [-0.65, 0.4], [0.65, 0.4]]) box(0.07, 0.74, 0.07, '#8b5a33', x, 0.37, z, tb);
  const ch = grp(s, -1.1, 0, -1.45); K.chair = ch;
  box(0.55, 0.06, 0.5, '#7a4a2a', 0, 0.47, 0, ch);
  box(0.55, 0.6, 0.06, '#7a4a2a', 0, 0.8, -0.24, ch);
  for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) box(0.05, 0.47, 0.05, '#6a3e22', x, 0.235, z, ch);
  // plate
  mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.02, 10), M('#ffffff'), s, -0.95, 0.805, -0.45);
  // toaster
  const ts = grp(s, -1.6, 0.795, -0.75); K.toaster = ts;
  box(0.34, 0.22, 0.2, '#c9ced4', 0, 0.11, 0, ts, true);
  box(0.26, 0.02, 0.04, '#333', 0, 0.225, -0.04, ts, false);
  box(0.26, 0.02, 0.04, '#333', 0, 0.225, 0.04, ts, false);
  box(0.04, 0.03, 0.05, '#222', 0.19, 0.15, 0, ts, false);
  K.toast = [];
  for (let i = 0; i < 2; i++) {
    const tg = grp(s);
    box(0.2, 0.2, 0.025, '#c98b45', 0, 0, 0, tg);
    box(0.17, 0.17, 0.03, '#f0cf8a', 0, -0.005, 0, tg, false);
    K.toast.push(tg);
  }
  // chai cup
  const cup = grp(s); K.cup = cup;
  mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8), M('#ffffff'), cup, 0, 0.05, 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 8), M('#b07a4a'), cup, 0, 0.096, 0, false);
  box(0.015, 0.05, 0.03, '#ffffff', 0.06, 0.05, 0, cup, false);
  // characters
  K.son = makeChar({ legL: 0.8, tH: 0.52, tW: 0.36, tD: 0.2, hr: 0.18, armW: 0.085, up: 0.29, fo: 0.27, legW: 0.11, skin: C.skinSon, hair: C.hair, fringe: true, shirt: '#e23b3b', pants: '#2c4a7a', shoes: '#ffffff', bigEyes: true });
  s.add(K.son.root);
  K.dad = makeChar({ legL: 0.86, tH: 0.7, tW: 0.58, tD: 0.34, hr: 0.21, armW: 0.12, up: 0.33, fo: 0.31, legW: 0.15, skin: C.skinDad, hair: C.dadHair, beard: C.dadHair, belly: true, shirt: '#3b7fd9', pants: '#3a3a48', shoes: '#2a2a2a', mouthZ: 0.235, neckW: 1.3 });
  s.add(K.dad.root);
  // sunbeam
  K.beam = addBeam(s, 0.5, 0.95, 4.2, '#ffe9a0', 0.0);
  K.beam.position.set(-1.1, 3.0, -1.3);
  K.beamLight = new THREE.SpotLight('#ffe7a0', 0, 8, 0.35, 0.6, 1);
  K.beamLight.position.set(-0.6, 4.5, 1.0); K.beamLight.target.position.set(-1.1, 1.6, -1.3);
  s.add(K.beamLight); s.add(K.beamLight.target);
})();

function placeMagnets(t, headPos) {
  K.magnets.forEach((m, i) => {
    const h = m.userData.home;
    const t0 = 3.2 + i * 0.05, tHit = 3.42 + i * 0.05, tEnd = tHit + 0.38;
    if (t < t0) { m.position.copy(h); m.rotation.set(i % 2 ? PI / 2 : 0, 0, 0); return; }
    const hit = V(headPos.x + (i - 2) * 0.05, headPos.y + 0.2, headPos.z + 0.02 * i);
    if (t < tHit) {
      const u = seg(t, t0, tHit);
      m.position.set(lerp(h.x, hit.x, u), lerp(h.y, hit.y, u * u), lerp(h.z, hit.z, u));
      m.rotation.set((i % 2 ? PI / 2 : 0) + u * 2, u * 1.5, 0);
      return;
    }
    const u = seg(t, tHit, tEnd);
    const land = V(hit.x + (i - 2) * 0.25 + 0.1, 0.02, hit.z + 0.25 + (i % 3) * 0.12);
    m.position.set(lerp(hit.x, land.x, u), lerp(hit.y, land.y, u) + Math.sin(u * PI) * 0.25, lerp(hit.z, land.z, u));
    m.rotation.set((i % 2 ? 0 : PI / 2) * u + i, u * 6 * (1 - u * 0.7), 0);
  });
}

// son path in kitchen
function sonKitchen(t) {
  const s = K.son;
  const P0 = V(-4.2, 0, 1.0), P1 = V(-2.4, 0, 0.3), P2 = V(2.85, 0, -1.95);
  let p = {}, pos = V(), yaw = 0, rollX = 0;
  const dir = P2.clone().sub(P1); const travelYaw = Math.atan2(dir.x, dir.z);
  if (t < 0.3) {
    const u = seg(t, 0, 0.3); pos.lerpVectors(P0, P1, u); yaw = travelYaw;
    p = walkPose(t * 26, 0.9); p.tX = 0.3; p.hipY = -0.03 + Math.abs(Math.sin(t * 26)) * 0.05;
  } else if (t < 1.05) {
    const u = seg(t, 0.3, 1.05); const ue = u * (1.15 - 0.15 * u);
    pos.lerpVectors(P1, P2, ue); yaw = travelYaw + Math.sin(t * 9) * 0.06;
    p = { tX: -0.35, hX: 0.15, lhX: -0.55, rhX: 0.35, lkX: 0.15, rkX: 0.3, hipY: -0.06,
      lsX: -2.2 + Math.sin(t * 30) * 0.9, rsX: -1.6 + Math.cos(t * 30) * 0.9, lsZ: 0.6, rsZ: -0.6, leX: -0.3, reX: -0.3 };
  } else if (t < 1.3) {
    // splat against fridge
    const u = seg(t, 1.05, 1.3);
    pos.copy(P2); pos.z -= 0.0; yaw = travelYaw;
    p = { tX: 0.12, hX: -0.25, lsX: -2.6, rsX: -2.6, lsZ: 0.9, rsZ: -0.9, leX: 0, reX: 0, lhX: 0.1, rhX: 0.1, hipY: 0.02 };
    rollX = 0;
  } else if (t < 1.55) {
    const u = eo(seg(t, 1.3, 1.55));
    pos.lerpVectors(P2, V(2.8, 0, -1.6), u); yaw = lerp(travelYaw, travelYaw + PI * 0.8, u);
    p = mix({ tX: 0.12, hX: -0.25, lsX: -2.6, rsX: -2.6, lsZ: 0.9, rsZ: -0.9 }, { tX: -0.05, lsX: -0.4, rsX: -0.4 }, u);
    p.hipY = -0.05 * Math.sin(u * PI);
  } else {
    // facing dad / camera, excited
    pos.set(2.8, 0, -1.62);
    const wob = Math.sin(t * 9);
    yaw = travelYaw + PI * 0.8 + Math.sin(t * 2) * 0.05;
    const hop = Math.max(0, Math.sin(t * 11)) * 0.04;
    p = { tX: -0.05, hX: -0.08 + wob * 0.05, lsX: -0.6 + wob * 0.2, rsX: -0.6 - wob * 0.2, lsZ: 0.35, rsZ: -0.35, leX: -1.2, reX: -1.2 };
    const tom = ss(t, 2.8, 3.0) * (1 - ss(t, 3.35, 3.5));
    p = mix(p, { lsX: -0.3, rsX: -0.3, lsZ: 2.6, rsZ: -2.6, leX: -0.2, reX: -0.2, hX: -0.3, tX: -0.15 }, tom);
    pos.y = hop + tom * Math.max(0, Math.sin((t - 2.8) * 14)) * 0.12;
    const bonk = ss(t, 3.42, 3.5) * (1 - ss(t, 3.75, 4.1));
    p = mix(p, { hX: 0.45, tX: 0.25, lsX: -2.2, rsX: -2.2, lsZ: 0.6, rsZ: -0.6, leX: -2.0, reX: -2.0, hipY: -0.08, lkX: 0.25, rkX: 0.25, lhX: -0.2, rhX: -0.2 }, bonk);
    if (t > 4.1) { // rub head, hopeful
      p = mix(p, { rsX: -2.6, rsZ: -0.4, reX: -1.8, hX: -0.05 }, ss(t, 4.1, 4.4) * 0.6);
    }
  }
  s.root.position.copy(pos); s.root.rotation.set(rollX, yaw, 0);
  pose(s, p);
  setMouth(s, speaking('son', t));
  // eyes squeeze on bonk
  const sq = (t > 3.42 && t < 3.85) ? 0.25 : 1;
  s.eyes.forEach(e => e.scale.y = sq);
}

function dadKitchen(t) {
  const d = K.dad; const seatY = 0.48;
  d.root.rotation.set(0, 0, 0);
  const stand = ss(t, 4.25, 5.05);
  // seated root: hips at seat height
  const rootY = lerp(seatY - d.legL + 0.02, 0, stand);
  d.root.position.set(-1.1, rootY, lerp(-1.4, -1.25, stand));
  let p = mix(Object.assign({}, SIT, { lsX: -0.4, leX: -1.6, rsX: -0.2, reX: -1.2, tX: 0.05 }), { tX: 0, lhX: 0, rhX: 0, lkX: 0, rkX: 0 }, stand);
  // sipping chai before 3.95
  if (t < 3.95) {
    const sip = 0.5 + 0.5 * Math.sin(t * 2.2);
    p.rsX = -1.0 - sip * 0.3; p.reX = -1.9; p.rsZ = 0.25;
    if (t > 1.1) { p.hY = ss(t, 1.05, 1.25) * 0.7; } // looks at son crash
    p.hY = (p.hY || 0) * (1 - ss(t, 2.0, 2.4) * 0.3);
  } else if (t < 4.25) {
    const u = ss(t, 3.95, 4.2); p.rsX = lerp(-1.3, -0.7, u); p.reX = lerp(-1.9, -0.9, u);
  }
  // heroic pose
  const hero = ss(t, 5.0, 5.4) * (1 - ss(t, 6.2, 6.35));
  p = mix(p, { tX: -0.12, hX: -0.22, hY: 0.15, lsX: 0.15, rsX: 0.15, lsZ: 0.55, rsZ: -0.55, leX: -1.9, reX: -1.9, lhZ: 0.12, rhZ: -0.12 }, hero);
  // slow-mo shadow box 6.3 - 6.85
  if (t >= 6.2) {
    const guard = { tX: 0.12, tY: 0.25, hX: 0.05, lsX: -1.2, rsX: -1.1, lsZ: 0.1, rsZ: -0.2, leX: -2.0, reX: -2.1, lhX: -0.25, rhX: 0.25, lkX: 0.2, rkX: 0.2, hipY: -0.04 };
    let q = mix(p, guard, ss(t, 6.2, 6.35));
    const jab = ss(t, 6.33, 6.48) * (1 - ss(t, 6.5, 6.6));
    q = mix(q, { lsX: -1.55, leX: -0.1, tY: -0.15 }, jab);
    const hook = ss(t, 6.6, 6.78);
    q = mix(q, { rsX: -1.35, rsZ: 0.25, reX: -0.15, tY: 0.45, tX: 0.45, tZ: 0.1 }, hook);
    // freeze after hit with recoil wobble
    if (t > 6.78) { const w = Math.exp(-(t - 6.78) * 5) * Math.sin((t - 6.78) * 40) * 0.08; q.tX += w; q.rsX += w; }
    // flinch when toast lands
    const land = ss(t, 7.68, 7.75) * 1;
    q = mix(q, { hX: 0.25 }, land * 0.6);
    p = q;
  }
  pose(d, p);
  setMouth(d, speaking('dad', t));
  // squint after toast
  const sq = t > 7.7 ? 0.45 : 1; d.eyes.forEach(e => e.scale.y = sq);
  // cup
  if (t < 4.15) { d.aR.hand.getWorldPosition(K.cup.position); K.cup.position.y -= 0.1; K.cup.position.z += 0.06; }
  else K.cup.position.set(-0.75, 0.795, -0.5);
}

function toastAnim(t, headPos) {
  const st = K.toaster.position;
  K.toast.forEach((tg, i) => {
    const home = V(st.x, st.y + 0.17, st.z + (i ? 0.04 : -0.04));
    if (t < 6.8) { tg.position.copy(home); tg.rotation.set(0, 0, 0); return; }
    if (i === 0) {
      const u = seg(t, 6.8, 7.7);
      const end = V(headPos.x, headPos.y + 0.24, headPos.z + 0.02);
      tg.position.set(lerp(home.x, end.x, u), lerp(home.y, end.y, u) + Math.sin(u * PI) * 1.6, lerp(home.z, end.z, u));
      tg.rotation.set(u * PI * 4.5 + (u >= 1 ? PI / 2 - PI * 4.5 : 0), u * 1.2, 0);
      if (u >= 1) tg.rotation.set(PI / 2, 0.3, 0);
    } else {
      const u = seg(t, 6.8, 7.9);
      const end = V(home.x + 0.9, 0.85, home.z + 1.0);
      tg.position.set(lerp(home.x, end.x, u), lerp(home.y, end.y, u) + Math.sin(u * PI) * 2.0, lerp(home.z, end.z, u));
      tg.rotation.set(u * 9, u * 5, u * 3);
      if (u >= 1) tg.rotation.set(PI / 2, 0.8, 0);
    }
  });
  // toaster jump
  const j = t > 6.8 ? Math.max(0, Math.sin(seg(t, 6.8, 7.05) * PI)) * 0.12 : 0;
  K.toaster.position.y = 0.795 + j; K.toaster.rotation.z = j * 1.5;
}

function animateKitchen(t) {
  sonKitchen(t);
  dadKitchen(t);
  const hp = V(); K.son.head.getWorldPosition(hp); hp.y += K.son.hr * 1.1;
  placeMagnets(t, hp);
  const dh = V(); K.dad.head.getWorldPosition(dh); dh.y += K.dad.hr * 1.1;
  toastAnim(t, dh);
  const b = ss(t, 4.45, 4.9) * (1 - ss(t, 6.7, 6.8));
  K.beam.material.opacity = 0.09 * b;
  K.beam.position.set(K.dad.root.position.x, 3.2, K.dad.root.position.z);
  K.beamLight.intensity = 9 * b;
}

// =============== ARENA =================
const A = { scene: new THREE.Scene() };
(function buildArena() {
  const s = A.scene;
  s.background = new THREE.Color('#0d0a1c');
  s.fog = new THREE.Fog('#0d0a1c', 14, 30);
  A.hemi = new THREE.HemisphereLight('#9a9fd0', '#8a7484', 1.3); s.add(A.hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(2, 10, 6); key.target.position.set(0, 0, 1); s.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  key.shadow.radius = 4; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  s.add(key);
  const ringSpot = new THREE.SpotLight('#fff6e0', 160, 20, 0.5, 0.5, 1.2);
  ringSpot.position.set(0, 10, 0); ringSpot.target.position.set(0, 1, 0); s.add(ringSpot); s.add(ringSpot.target);
  A.ringSpot = ringSpot;
  const fill = new THREE.DirectionalLight('#ffe8d0', 0.9); fill.position.set(-3, 4, 8); s.add(fill);
  // floor
  box(40, 0.1, 40, '#1d1a2e', 0, -0.05, 0, s);
  // ring
  box(6.6, 1.0, 6.6, '#1f3b73', 0, 0.5, 0, s);
  box(6.7, 0.12, 6.7, '#ffffff', 0, 0.96, 0, s);
  box(6.3, 0.07, 6.3, '#d7dde6', 0, 1.03, 0, s);
  // ring logo
  const logo = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#d7dde6'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c0392b'; x.lineWidth = 24; x.beginPath(); x.arc(w / 2, h / 2, 190, 0, PI * 2); x.stroke(); x.fillStyle = '#c0392b'; x.font = '900 120px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FIGHT', w / 2, h / 2); });
  const lg = mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.9 }), s, 0, 1.068, 0, false); lg.rotation.x = -PI / 2;
  const postC = ['#d62828', '#1d4ed8', '#ffffff', '#ffffff'];
  A.near = [];
  [[-3, -3], [3, -3], [3, 3], [-3, 3]].forEach(([x, z], i) => {
    const a = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), M('#cfcfcf', { metalness: 0.3 }), s, x, 1.8, z);
    const b = box(0.24, 1.2, 0.24, postC[[0, 1, 1, 0][i]] , x, 1.85, z, s);
    if (z > 0) A.near.push(a, b);
  });
  const ropeC = ['#d62828', '#ffffff', '#1d4ed8'];
  [1.45, 1.85, 2.25].forEach((y, k) => {
    box(6.0, 0.05, 0.05, ropeC[k], 0, y, -3, s); A.near.push(box(6.0, 0.05, 0.05, ropeC[k], 0, y, 3, s));
    box(0.05, 0.05, 6.0, ropeC[k], -3, y, 0, s); box(0.05, 0.05, 6.0, ropeC[k], 3, y, 0, s);
  });
  // big hanging lights + beams
  A.beams = [];
  [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
    const b = addBeam(s, 0.15, 1.1, 8, '#fff2cc', 0.07); b.position.set(x * 0.6, 6, z * 0.6); b.rotation.set(z * 0.05, 0, -x * 0.05); A.beams.push(b);
  });
  const rig = box(7, 0.3, 7, '#22222c', 0, 10.2, 0, s);
  // chairs front rows (z=+5 side), seats for dad and other dad
  A.chairs = [];
  function chair(x, z, rotY) {
    const g = grp(s, x, 0, z); g.rotation.y = rotY;
    box(0.5, 0.05, 0.46, '#2b2b33', 0, 0.47, 0, g);
    box(0.5, 0.5, 0.05, '#2b2b33', 0, 0.75, -0.22, g);
    for (const [a, b] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) box(0.04, 0.47, 0.04, '#777', a, 0.235, b, g);
    return g;
  }
  A.dadChair = chair(0, 5.0, PI);
  A.odChair = chair(0.8, 5.0, PI);
  for (let i = -6; i <= 6; i++) if (i !== 0 && i !== 1) chair(i * 0.8, 5.0, PI);
  // crowd (instanced)
  const people = [];
  const pal = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#34495e', '#ff6b9a'];
  const skins = ['#f0c8a0', '#c98a5e', '#8d5a3b', '#e0b48a', '#a86f48', '#5c3a24'];
  let n = 0;
  // front row seated neighbours
  for (let i = -6; i <= 6; i++) { if (i === 0 || i === 1) continue; people.push({ x: i * 0.8, y: 0.45, z: 5.0, s: 0.95, sit: true }); }
  // tiers on 4 sides
  for (let side = 0; side < 4; side++) {
    for (let row = 0; row < 5; row++) {
      const d = 6.2 + row * 0.85, y = 0.35 + row * 0.42;
      for (let k = -10; k <= 10; k++) {
        const a = k * 0.72 + (row % 2) * 0.36;
        if (Math.abs(a) > 7.5) continue;
        let x, z;
        if (side === 0) { x = a; z = d; } else if (side === 1) { x = a; z = -d; } else if (side === 2) { x = d; z = a; } else { x = -d; z = a; }
        people.push({ x, y, z, s: 0.9 + hash(n++) * 0.25 });
      }
    }
  }
  const N = people.length;
  const bodyG = new THREE.BoxGeometry(0.44, 0.6, 0.28); bodyG.translate(0, 0.3, 0);
  const headG = new THREE.IcosahedronGeometry(0.16, 0); headG.translate(0, 0.0, 0);
  const armG = new THREE.BoxGeometry(0.09, 0.42, 0.09); armG.translate(0, 0.21, 0);
  const bodies = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), N);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), N);
  const arms = new THREE.InstancedMesh(armG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), N * 2);
  people.forEach((p, i) => {
    p.ph = hash(i * 3.1) * 10; p.cheer = hash(i * 7.7) > 0.45;
    const sc = new THREE.Color(skins[Math.floor(hash(i * 1.7) * skins.length)]);
    const bc = new THREE.Color(pal[Math.floor(hash(i * 5.3) * pal.length)]);
    bodies.setColorAt(i, bc); heads.setColorAt(i, sc); arms.setColorAt(i * 2, sc); arms.setColorAt(i * 2 + 1, sc);
  });
  bodies.castShadow = false; bodies.receiveShadow = true; heads.receiveShadow = true;
  s.add(bodies); s.add(heads); s.add(arms);
  A.crowd = { people, bodies, heads, arms };
  // characters
  const shirtTex = canvasTex(512, 300, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(w / 2, h / 2); x.rotate(-0.05);
    x.fillStyle = '#d61f1f'; x.font = '900 104px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('MY SON', 0, -62); x.fillStyle = '#111'; x.fillText('= CHAMP', 0, 62); x.restore();
  });
  A.dad = makeChar({ legL: 0.86, tH: 0.7, tW: 0.58, tD: 0.34, hr: 0.21, armW: 0.12, up: 0.33, fo: 0.31, legW: 0.15, skin: C.skinDad, hair: C.dadHair, beard: C.dadHair, belly: true, shirt: '#f7f7f7', pants: '#3a3a48', shoes: '#2a2a2a', mouthZ: 0.235, neckW: 1.3 });
  const tp = mesh(new THREE.PlaneGeometry(0.56, 0.33), new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.9 }), A.dad.torso, 0, 0.5, 0.171, false);
  // flap that covers the text when he hikes his shirt up
  const flapG = grp(A.dad.torso, 0, 0.3, 0.19); A.flap = flapG;
  const fl = box(0.6, 0.38, 0.02, '#e9e9e9', 0, 0.19, 0, flapG, false);
  A.dad.bellyMat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', flatShading: true, roughness: 0.85 });
  A.dad.belly.material = A.dad.bellyMat;
  A.dadSeat = grp(s, 0, 0, 5.0); A.dadSeat.rotation.y = PI; A.dadSeat.add(A.dad.root);
  A.od = makeChar({ legL: 0.84, tH: 0.62, tW: 0.52, tD: 0.3, hr: 0.205, armW: 0.11, up: 0.32, fo: 0.3, legW: 0.14, skin: '#e2b48a', moustache: '#2b1a10', baldRing: '#5a3a22', brow: '#3a2414', shirt: '#2f9e5b', pants: '#4b4b58', shoes: '#222', belly: true, neckW: 1.2 });
  A.odSeat = grp(s, 0.8, 0, 5.0); A.odSeat.rotation.y = PI; A.odSeat.add(A.od.root);
  // foam finger on other dad's right hand
  const ff = grp(A.od.aR.hand, 0, -0.12, 0); A.foam = ff;
  box(0.2, 0.2, 0.1, '#ffd400', 0, -0.05, 0, ff);
  box(0.07, 0.3, 0.07, '#ffd400', 0.0, -0.3, 0, ff);
  // son with tutu
  A.son = makeChar({ legL: 0.8, tH: 0.52, tW: 0.36, tD: 0.2, hr: 0.18, armW: 0.085, up: 0.29, fo: 0.27, legW: 0.11, skin: C.skinSon, hair: C.hair, fringe: true, shirt: '#e23b3b', pants: '#ff9ccc', shin: '#ff9ccc', shoes: '#ff5fa8', bigEyes: true });
  s.add(A.son.root);
  for (let i = 0; i < 3; i++) {
    const tu = mesh(new THREE.CylinderGeometry(0.2, 0.46 - i * 0.04, 0.12, 14, 1, true), M(['#ff7eb6', '#ff9cc8', '#ffb8d8'][i], { side: THREE.DoubleSide }), A.son.hips, 0, -0.02 + i * 0.05, 0);
    tu.rotation.y = i * 0.3;
  }
  const cardTex = canvasTex(512, 320, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff4fa0'; x.lineWidth = 18; x.strokeRect(9, 9, w - 18, h - 18);
    x.fillStyle = '#111'; x.font = '900 92px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ROUND', w / 2, h * 0.33); x.fillStyle = '#ff2d86'; x.font = '900 150px Inter'; x.fillText('1', w / 2, h * 0.7);
  });
  const card = grp(A.son.torso, 0, 1.08, 0.05); A.card = card;
  const cm = new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.8, side: THREE.DoubleSide });
  mesh(new THREE.PlaneGeometry(0.62, 0.39), cm, card, 0, 0, 0.012, false);
  box(0.64, 0.41, 0.02, '#ff4fa0', 0, 0, 0, card);
  // boxers
  A.big = makeChar({ legL: 0.85, tH: 0.66, tW: 0.66, tD: 0.32, hr: 0.19, armW: 0.15, up: 0.33, fo: 0.31, legW: 0.17, skin: '#9c6644', hair: '#141414', shirt: '#9c6644', pants: '#c81d25', shin: '#9c6644', shoes: '#f1f1f1', armSkin: true, noSleeve: true, gloves: '#d62828', bigChest: true, angryBrow: true, scale: 1.55, neckW: 1.8 });
  A.big.root.position.set(2.25, 1.065, -2.25); s.add(A.big.root);
  A.small = makeChar({ legL: 0.85, tH: 0.64, tW: 0.6, tD: 0.3, hr: 0.19, armW: 0.14, up: 0.33, fo: 0.31, legW: 0.16, skin: '#e8bb90', hair: '#c9a05a', shirt: '#e8bb90', pants: '#1d4ed8', shin: '#e8bb90', shoes: '#111', armSkin: true, noSleeve: true, gloves: '#1d4ed8', bigChest: true, angryBrow: true, scale: 1.35, neckW: 1.6 });
  A.small.root.position.set(-2.25, 1.065, -2.25); s.add(A.small.root);
  // dad spotlight
  A.dadSpot = new THREE.SpotLight('#fff8d8', 0, 20, 0.22, 0.4, 1);
  A.dadSpot.position.set(0, 9, 0); s.add(A.dadSpot); s.add(A.dadSpot.target);
  A.dadBeam = addBeam(s, 0.12, 0.85, 1, '#fff6d0', 0);
  // sparkle stars
  A.sparks = [];
  const starG = new THREE.OctahedronGeometry(0.06, 0);
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(starG, new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff7a8' : '#ffffff' })); m.visible = false; s.add(m); A.sparks.push(m); }
})();

const DADPOS = V(0, 1.2, 5.0);
function crowdAnim(t) {
  const { people, bodies, heads, arms } = A.crowd;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
  const cheer = t < 12.95 ? 1 : 0.0;
  const turnSon = ss(t, 13.05, 13.4) * (1 - ss(t, 15.0, 15.25));
  const turnDad = ss(t, 15.0, 15.35);
  const sonP = A.son.root.position;
  people.forEach((p, i) => {
    const bob = cheer * Math.max(0, Math.sin(t * 9 + p.ph)) * 0.08;
    const yawRing = Math.atan2(-p.x, -p.z);
    const yawSon = Math.atan2(sonP.x - p.x, sonP.z - p.z);
    const yawDad = Math.atan2(DADPOS.x - p.x, DADPOS.z - p.z) + (p.z > 5.5 && Math.abs(p.x) < 3 ? 0 : 0);
    let yaw = yawRing;
    yaw = lerp(yaw, yawSon, turnSon * 0.8);
    // shortest-angle lerp to dad
    let dyaw = yawDad - yaw; while (dyaw > PI) dyaw -= 2 * PI; while (dyaw < -PI) dyaw += 2 * PI;
    yaw += dyaw * turnDad * (0.85 + hash(i) * 0.15);
    const lean = turnDad * 0.15;
    const s0 = p.s * (p.sit ? 0.9 : 1);
    pos.set(p.x, p.y + bob, p.z);
    e.set(0, yaw, 0); q.setFromEuler(e); sc.set(s0, s0, s0);
    m4.compose(pos, q, sc); bodies.setMatrixAt(i, m4);
    const hpos = V(0, 0.75 * s0, 0).applyQuaternion(q).add(pos);
    e.set(lean, yaw, 0); q.setFromEuler(e); sc.set(s0, s0 * 1.1, s0);
    m4.compose(hpos, q, sc); heads.setMatrixAt(i, m4);
    // arms: cheering ones raise arms
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      const up = p.cheer ? cheer * (0.6 + 0.4 * Math.sin(t * 7 + p.ph + k)) : 0;
      const ang = side * (0.2 + up * 2.6);
      e.set(0, yaw, 0); const qy = new THREE.Quaternion().setFromEuler(e);
      const ap = V(side * 0.27 * s0, 0.55 * s0, 0).applyQuaternion(qy).add(pos);
      const qz = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang + PI));
      const qq = qy.clone().multiply(qz);
      m4.compose(ap, qq, sc.set(s0, s0, s0)); arms.setMatrixAt(i * 2 + k, m4);
    }
  });
  bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; arms.instanceMatrix.needsUpdate = true;
}

function seatedDad(t) {
  const d = A.dad;
  d.root.position.set(0, 0.48 - d.legL + 0.02, 0.05);
  d.root.rotation.set(0, 0, 0);
  let p = Object.assign({}, SIT, { lsX: -0.6, rsX: -0.6, leX: -0.8, reX: -0.8, lsZ: 0.25, rsZ: -0.25 });
  // clapping / cheering in S3 wide
  if (t < 9.95) { const c = Math.sin(t * 16); p.lsX = -1.2; p.rsX = -1.2; p.lsZ = 0.15 + c * 0.12; p.rsZ = -0.15 - c * 0.12; p.leX = -0.9; p.reX = -0.9; }
  // listening to other dad: turn head
  p.hY = -ss(t, 10.0, 10.3) * 0.35 * (1 - ss(t, 11.0, 11.2));
  // proud chest puff 11.0-12.5
  const proud = ss(t, 11.0, 11.35) * (1 - ss(t, 12.9, 13.1));
  p = mix(p, { tX: -0.28, hX: -0.3, hY: -0.15, lsX: 0.2, rsX: 0.2, lsZ: 0.6, rsZ: -0.6, leX: -2.0, reX: -2.0 }, proud);
  if (d.belly) d.belly.scale.z = 0.2 + proud * 0.06;
  // smile fades / freeze on reveal
  const shock = ss(t, 14.15, 14.35);
  p = mix(p, { tX: 0.05, hX: 0.0, lsX: -0.5, rsX: -0.5, lsZ: 0.2, rsZ: -0.2, leX: -1.0, reX: -1.0 }, shock);
  // 16.45-17.2 pull shirt up over the text
  const pull = ss(t, 16.45, 17.15);
  if (t > 16.3) p = mix(p, { lsX: -0.9, rsX: -0.9, lsZ: 0.0, rsZ: 0.0, leX: -1.25 + pull * -0.5, reX: -1.25 + pull * -0.5, hX: 0.15 }, ss(t, 16.3, 16.5) * (1 - ss(t, 17.5, 17.7)));
  A.flap.scale.y = Math.max(0.001, pull);
  A.flap.visible = pull > 0.01;
  A.dad.bellyMat.color.set(pull > 0.35 ? C.skinDad : '#f7f7f7');
  // whisper + pointing 17.6 - 19.5; nods 19.5-21
  const wh = ss(t, 17.6, 17.8) * (1 - ss(t, 23.8, 24.0));
  p = mix(p, { tZ: 0.22, tX: 0.1, hY: -0.35, hZ: 0.1, lsX: -2.3, lsZ: -0.3, leX: -1.9, rsX: -1.55, rsZ: 0.55, reX: -0.05 }, wh);
  if (t > 19.4) { const nod = Math.sin((t - 19.4) * 12) * 0.12 * (1 - ss(t, 21.0, 21.3)); p.hX = (p.hX || 0) + nod; }
  const thumbs = ss(t, 20.1, 20.3) * (1 - ss(t, 21.0, 21.3));
  p = mix(p, { rsX: -1.4, rsZ: 0.0, reX: -1.5 }, thumbs);
  // sunglasses 23.9-24.2
  const gl = ss(t, 23.85, 24.1) * (1 - ss(t, 24.15, 24.35));
  p = mix(p, { lsX: -2.4, lsZ: -0.2, leX: -2.1, rsX: -0.6, rsZ: -0.2 }, gl);
  d.glasses.visible = t > 24.1;
  // sink 24.2-24.6
  const sink = ss(t, 24.2, 24.6);
  p = mix(p, { tX: -0.75, hX: 0.3, hipY: -0.15, lsX: -0.2, rsX: -0.2, lsZ: 0.5, rsZ: -0.5, lhX: -1.2, rhX: -1.2, lkX: 0.6, rkX: 0.6 }, sink);
  d.root.position.z = 0.05 + sink * 0.25;
  d.root.position.y += -sink * 0.12;
  // ragdoll under the chair 24.6 - 25.3
  if (t > 24.55) {
    const u = eo(seg(t, 24.55, 25.05));
    d.root.rotation.x = lerp(0, -PI / 2, u);
    d.root.position.y = lerp(0.48 - d.legL - 0.12, 0.17, u) + Math.sin(u * PI) * 0.12;
    d.root.position.z = lerp(0.3, 0.55 + d.legL, u);
    const fl = Math.exp(-(t - 24.55) * 3.2);
    const fn = (k) => Math.sin((t - 24.55) * 22 + k) * fl;
    p = { tX: 0.2 + fn(1) * 0.4, hX: -0.3 + fn(2) * 0.5, hY: fn(3) * 0.6,
      lsX: -1.5 + fn(4) * 1.6, rsX: -1.8 + fn(5) * 1.6, lsZ: 1.3 + fn(6), rsZ: -1.3 + fn(7), leX: -0.5 + fn(8), reX: -0.3 + fn(9),
      lhX: -1.4 + fn(10) * 0.9, rhX: -0.9 + fn(11) * 0.9, lkX: 1.4 + fn(12) * 0.7, rkX: 0.9 + fn(13) * 0.7, lhZ: 0.3, rhZ: -0.3 };
    if (t > 25.6) { const tw = Math.max(0, Math.sin((t - 25.6) * 30)) * Math.exp(-(t - 25.6) * 6); p.rkX += tw * 0.8; }
  }
  pose(d, p);
  setMouth(d, speaking('dad', t) * (t > 17.6 && t < 21 ? 0.55 : 1));
  // eye twitch 15.8-16.4
  const tw = (t > 15.85 && t < 16.45) ? (Math.sin(t * 70) > 0.2 ? 0.3 : 1) : 1;
  const wide = (t > 14.2 && t < 17.6) ? 1.25 : 1;
  d.eyes[1].scale.y = tw * wide; d.eyes[0].scale.y = wide;
  d.brows.forEach((b, i) => { b.position.y = d.hr * (1.55 + (wide > 1 ? 0.12 : 0) + (i === 1 && tw < 1 ? -0.08 : 0)); });
}

function otherDad(t) {
  const d = A.od;
  d.root.position.set(0, 0.48 - d.legL + 0.02, 0.05);
  let p = Object.assign({}, SIT, { lsX: -0.6, leX: -0.8, lsZ: 0.25 });
  // foam finger waving
  const wave = Math.sin(t * 8);
  p.rsX = -2.7 + wave * 0.25; p.rsZ = -0.2; p.reX = -0.2;
  // lean in & ask 9.95-11
  const lean = ss(t, 9.85, 10.1) * (1 - ss(t, 12.4, 12.7));
  p = mix(p, { tZ: -0.28, hY: 0.45, hZ: -0.1, rsX: -1.0, reX: -1.4 }, lean);
  // reveal: shocked looks at son, then at dad
  const look = ss(t, 14.2, 14.4) * (1 - ss(t, 23.8, 24.2));
  p = mix(p, { hY: 0.0, tZ: 0.0, rsX: -0.4, reX: -1.2 }, ss(t, 13.0, 13.3) * (1 - ss(t, 15.0, 15.2)));
  const atDad = ss(t, 15.1, 15.4) * (1 - ss(t, 25.4, 25.8));
  p = mix(p, { tZ: -0.3, hY: 0.55, hX: 0.1, rsX: -0.3, rsZ: -0.1, reX: -0.6 }, atDad);
  if (t > 24.3) p = mix(p, { hX: 0.55, hY: 0.4, tZ: -0.2, tX: 0.3 }, ss(t, 24.6, 25.0)); // looks down at dad on floor
  pose(d, p);
  setMouth(d, speaking('od', t));
  A.foam.rotation.z = 0;
}

function sonArena(t) {
  const s = A.son;
  let pos = V(-4.5, 1.065, 0.8), yaw = PI / 2;
  let p = { lsX: -3.0, rsX: -3.0, lsZ: -0.15, rsZ: 0.15, leX: -0.25, reX: -0.25 };
  if (t < 13.0) { s.root.visible = false; } else s.root.visible = true;
  if (t >= 13.0 && t < 14.0) {
    const u = seg(t, 13.0, 14.0);
    pos.set(lerp(-2.6, -0.2, u), 1.065, lerp(0.6, 0.9, u));
    const ph = (t - 13) * 10.5;
    const w = walkPose(ph, 0.55);
    yaw = PI / 2 - 0.5 + Math.sin(ph) * 0.15;
    p = Object.assign(w, { lsX: -3.0, rsX: -3.0, lsZ: -0.15, rsZ: 0.15, leX: -0.25, reX: -0.25, tZ: Math.sin(ph) * 0.12, tY: Math.sin(ph) * 0.15, pZ: -Math.sin(ph) * 0.15, lhZ: 0.15, rhZ: -0.15 });
    pos.y += Math.abs(Math.sin(ph)) * 0.03;
    // hair flip 13.5-13.75
    const hf = Math.sin(seg(t, 13.5, 13.78) * PI);
    p.hY = hf * 0.9; p.hX = -hf * 0.4; p.hZ = hf * 0.3;
  } else if (t >= 14.0) {
    pos.set(-0.2, 1.065, 0.9);
    yaw = lerp(PI / 2 - 0.5, 0.05, ss(t, 14.0, 14.15));
    const wv = Math.sin(t * 16);
    p = { lsX: -3.0, lsZ: -0.15, leX: -0.25, rsX: -0.3, rsZ: -2.5 + wv * 0.35, reX: -0.2 + wv * 0.4, hX: -0.2, tX: -0.1, lhZ: 0.1, rhZ: -0.1 };
    pos.y += Math.max(0, Math.sin(t * 12)) * 0.05;
    if (t > 15.2) { const wv2 = Math.sin(t * 9); p.rsZ = -2.3 + wv2 * 0.3; p.hX = -0.05; }
    // twirl 22.25 - 23.9
    if (t >= 22.2) {
      const u = seg(t, 22.25, 23.5);
      yaw = 0.05 + eo(u) * PI * 4;
      p = { lsX: -3.05, rsX: -3.05, lsZ: -0.1, rsZ: 0.1, leX: -0.2, reX: -0.2, rhX: -0.9 * ss(t, 22.25, 22.4) * (1 - ss(t, 23.4, 23.6)), rkX: 1.8 * ss(t, 22.25, 22.4) * (1 - ss(t, 23.4, 23.6)), rhZ: -0.4, hX: -0.15 };
      pos.y += Math.sin(u * PI) * 0.06;
      if (t > 23.5) { p = mix(p, { lsX: -3.0, rsX: -0.4, rsZ: -2.2, reX: -0.3, hX: -0.2, tX: -0.1 }, ss(t, 23.5, 23.7)); }
    }
  }
  s.root.position.copy(pos); s.root.rotation.set(0, yaw, 0);
  pose(s, p);
  setMouth(s, speaking('son', t));
  // card spin during twirl
  A.card.rotation.y = t > 22.25 && t < 23.6 ? (t - 22.25) * 14 : 0;
  // sparkles around son
  const sparkOn = (t > 13.5 && t < 14.3) || (t > 22.3 && t < 23.9);
  const hp = V(); s.head.getWorldPosition(hp);
  A.sparks.forEach((m, i) => {
    m.visible = sparkOn;
    if (!sparkOn) return;
    const a = i / A.sparks.length * PI * 2 + t * 3, r = 0.45 + 0.15 * Math.sin(t * 5 + i);
    m.position.set(hp.x + Math.cos(a) * r, hp.y + 0.2 + Math.sin(t * 4 + i * 1.3) * 0.35, hp.z + Math.sin(a) * r);
    const sc = 0.6 + 0.8 * Math.abs(Math.sin(t * 9 + i)); m.scale.set(sc, sc * 1.6, sc); m.rotation.y = t * 4;
  });
}

function boxers(t) {
  const big = A.big, sm2 = A.small;
  const bob = (k) => Math.abs(Math.sin(t * 6 + k)) * 0.05;
  const guard = (k) => ({ lsX: -1.15 + Math.sin(t * 6 + k) * 0.1, rsX: -1.0 - Math.sin(t * 6 + k) * 0.1, lsZ: 0.25, rsZ: -0.25, leX: -2.1, reX: -2.1, lkX: 0.25, rkX: 0.25, lhX: -0.2, rhX: -0.2, hipY: -0.04 - bob(k) });
  // facing
  const toCenter = Math.atan2(-2.25, 2.25);
  let yawBig = Math.atan2(-big.root.position.x, -big.root.position.z);
  const toDad = Math.atan2(DADPOS.x - 2.25, DADPOS.z + 2.25);
  let pb = guard(0);
  // look at son during reveal
  const lookSon = ss(t, 13.2, 13.6) * (1 - ss(t, 17.5, 17.9));
  pb.hY = lookSon * -0.6;
  // flex 18.1 - 19.6
  const flex = ss(t, 18.1, 18.35) * (1 - ss(t, 19.6, 19.9));
  pb = mix(pb, { lsX: 0, rsX: 0, lsZ: 1.55, rsZ: -1.55, leX: -2.2, reX: -2.2, tX: -0.1, hX: -0.15, hipY: 0 }, flex);
  // turn to dad & shrug 21.0-22.2
  const turn = ss(t, 20.95, 21.2);
  yawBig = lerp(yawBig, toDad, turn * (1 - ss(t, 25.5, 25.9)));
  const shrug = ss(t, 21.2, 21.45) * (1 - ss(t, 22.3, 22.6));
  pb = mix(pb, { lsX: -0.6, rsX: -0.6, lsZ: 0.7, rsZ: -0.7, leX: -1.4, reX: -1.4, hZ: 0.3, hX: 0.1, tX: 0, hipY: 0, lkX: 0, rkX: 0, lhX: 0, rhX: 0 }, shrug);
  big.root.position.y = 1.065;
  big.root.rotation.set(0, yawBig, 0);
  pose(big, pb);
  setMouth(big, speaking('box', t));
  if (shrug > 0.5) big.brows.forEach((b, i) => b.rotation.z = (i ? -1 : 1) * 0.2); else big.brows.forEach((b, i) => b.rotation.z = (i ? 1 : -1) * 0.35);
  let ps = guard(2);
  ps.hY = ss(t, 13.2, 13.6) * 0.5;
  sm2.root.rotation.set(0, Math.atan2(2.25, 2.25), 0);
  pose(sm2, ps);
}

function lights(t) {
  // dad spotlight swings 15.0 -> 15.35 from son to dad
  const on = ss(t, 14.95, 15.05);
  const u = eoBack(seg(t, 15.0, 15.35));
  const from = A.son.root.position.clone(); from.y = 1.1;
  const tgt = from.clone().lerp(V(0.1, 0.9, 5.0), u);
  A.dadSpot.target.position.copy(tgt);
  A.dadSpot.intensity = (t < 15.7 ? 120 : 45) * on;
  const top = V(0, 9, 1.5);
  const dir = tgt.clone().sub(top); const len = dir.length();
  A.dadBeam.scale.set(1, len, 1);
  A.dadBeam.position.copy(top).addScaledVector(dir, 0.5);
  A.dadBeam.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize().negate());
  A.dadBeam.material.opacity = 0.12 * on;
  A.ringSpot.intensity = 160 * (1 - on * 0.75);
  A.hemi.intensity = 1.25 * (1 - on * 0.55);
}

function animateArena(t) {
  sonArena(t);
  seatedDad(t);
  otherDad(t);
  boxers(t);
  crowdAnim(t);
  lights(t);
}

// =============== SHOTS =================
function faceCam(c, dist, side = 0, dy = 0) {
  const h = headOf(c); const q = new THREE.Quaternion(); c.root.getWorldQuaternion(q);
  const f = V(0, 0, 1).applyQuaternion(q); f.y = 0; f.normalize();
  const r = V(f.z, 0, -f.x);
  return { p: h.clone().addScaledVector(f, dist).addScaledVector(r, side).add(V(0, dy, 0)), h };
}
function headOf(c) { const v = V(); c.head.getWorldPosition(v); v.y += c.hr * 1.1 * (c.o.scale || 1); return v; }
const SHOTS = [
  // scene 1 kitchen
  { a: 0.0, b: 1.05, sc: 'K', cam: (t) => { const sp = K.son.root.position; return { p: V(sp.x - 0.4, 1.35, sp.z + 3.4), l: V(sp.x + 0.5, 0.95, sp.z - 0.3), fov: 62 }; } },
  { a: 1.05, b: 2.55, sc: 'K', cam: (t) => ({ p: V(0.85 - (t - 1.05) * 0.1, 1.85, 4.3 - (t - 1.05) * 0.25), l: V(0.9, 0.95, -1.4), fov: 66 }) },
  { a: 2.55, b: 3.25, sc: 'K', cam: (t) => { const z = eo(seg(t, 2.55, 2.75)); const f = faceCam(K.son, lerp(1.5, 0.8, z), 0.15, 0.02); return { p: f.p, l: f.h.clone().add(V(0, -0.05, 0)), fov: 42 }; } },
  { a: 3.25, b: 3.95, sc: 'K', cam: (t) => ({ p: V(2.2, 1.7, 0.7), l: V(2.85, 1.25, -1.8), fov: 55 }) },
  // scene 2 kitchen
  { a: 3.95, b: 6.25, sc: 'K', cam: (t) => { const u = seg(t, 3.95, 6.25), st = ss(t, 4.25, 5.05); return { p: V(-0.8, lerp(0.95, 1.05, st), lerp(1.2, 1.45, st) - u * 0.25), l: V(-1.1, lerp(1.3, 1.75, st), -1.3), fov: 55 }; } },
  { a: 6.25, b: 7.0, sc: 'K', cam: (t) => ({ p: V(-0.35, 1.45, 1.6), l: V(-1.35, 1.05, -0.9), fov: 52 }) },
  { a: 7.0, b: 9.4, sc: 'K', cam: (t) => { const u = seg(t, 7.0, 9.4); return { p: V(0.85, 1.9, lerp(6.3, 5.6, u)), l: V(0.85, 1.0, -1.3), fov: 62 }; } },
  // scene 3 arena
  { a: 9.4, b: 9.95, sc: 'A', cam: (t) => { const u = seg(t, 9.4, 9.95); return { p: V(1.5, 4.6 - u * 0.4, 11.5 - u * 0.8), l: V(0, 1.6, 0), fov: 58 }; } },
  { a: 9.95, b: 12.5, sc: 'A', hideNear: true, cam: (t) => { const u = seg(t, 9.95, 12.5); return { p: V(0.4, 1.66, lerp(2.5, 2.75, u)), l: V(0.4, 1.12, 5.0), fov: 58 }; } },
  // scene 4 reveal
  { a: 12.5, b: 13.0, sc: 'A', cam: (t) => { const z = t > 12.95 ? (t - 12.95) * 2 : 0; return { p: V(0.3, 2.55, 7.4 - z), l: V(0, 1.9, 0), fov: 55 }; } },
  { a: 13.0, b: 14.0, sc: 'A', cam: (t) => { const sp = A.son.root.position; return { p: V(sp.x + 0.7, 2.6, 4.9), l: V(sp.x + 0.2, 2.35, 0.8), fov: 50 }; } },
  { a: 14.0, b: 15.0, sc: 'A', cam: (t) => { const z = eo(seg(t, 14.0, 14.15)); const f = faceCam(A.son, lerp(3.0, 1.5, z), 0.1, 0.05); return { p: f.p, l: f.h.clone().add(V(0, -0.25, 0)), fov: 50 }; } },
  { a: 15.0, b: 15.7, sc: 'A', hideNear: true, cam: (t) => ({ p: V(0.3, 2.6, 1.0), l: V(0.3, 1.2, 6.2), fov: 60 }) },
  // scene 5 panic
  { a: 15.7, b: 16.4, sc: 'A', cam: (t) => { const z = eo(seg(t, 15.7, 15.85)); const f = faceCam(A.dad, lerp(2.0, 1.05, z), 0, 0.02); return { p: f.p, l: f.h.clone().add(V(0, 0.0, 0)), fov: 44 }; } },
  { a: 16.4, b: 17.6, sc: 'A', hideNear: true, cam: (t) => ({ p: V(0.4, 1.66, 2.6), l: V(0.4, 1.05, 5.0), fov: 58 }) },
  { a: 17.6, b: 18.1, sc: 'A', hideNear: true, cam: (t) => ({ p: V(-0.2, 1.62, 2.7), l: V(0.3, 1.1, 5.0), fov: 54 }) },
  { a: 18.1, b: 19.5, sc: 'A', cam: (t) => { const u = seg(t, 18.1, 19.5); return { p: V(lerp(0.9, 1.05, u), 2.2, lerp(0.7, 0.4, u)), l: V(2.25, 2.85, -2.25), fov: 55 }; } },
  { a: 19.5, b: 21.0, sc: 'A', hideNear: true, cam: (t) => ({ p: V(-0.1, 1.62, 2.8), l: V(0.3, 1.1, 5.0), fov: 50 }) },
  // scene 6 punchline
  { a: 21.0, b: 22.2, sc: 'A', cam: (t) => { const f = faceCam(A.big, 1.9, -0.5, -0.35); return { p: f.p, l: f.h.clone().add(V(0, -0.2, 0)), fov: 46 }; } },
  { a: 22.2, b: 23.9, sc: 'A', cam: (t) => ({ p: V(0.0, 2.55, 4.3), l: V(-0.2, 2.3, 0.9), fov: 52 }) },
  { a: 23.9, b: 26.25, sc: 'A', cam: (t) => { const d = ss(t, 24.25, 24.9), u = seg(t, 24.9, 26.25); return { p: V(lerp(-1.55, -2.1, d), lerp(1.35, 1.15, d), 3.6 + u * 0.1), l: V(0.05, lerp(0.95, 0.3, d), lerp(5.0, 4.8, d)), fov: lerp(54, 58, d) }; } },
  { a: 26.25, b: 99, sc: 'BLACK' },
];
const IMPACTS = [[1.05, 0.12, 6], [3.45, 0.05, 8], [6.8, 0.1, 6], [12.55, 0.04, 6], [12.95, 0.05, 8], [14.12, 0.06, 6], [15.05, 0.07, 6], [24.6, 0.06, 6], [25.0, 0.05, 7]];
function shake(t) {
  let x = 0, y = 0;
  for (const [t0, amp, k] of IMPACTS) {
    if (t < t0 || t > t0 + 0.8) continue;
    const e = amp * Math.exp(-(t - t0) * k);
    x += noise((t - t0) * 40) * e; y += noise((t - t0) * 40 + 50) * e;
  }
  return [x, y];
}

// =============== OVERLAY =================
const SFXTXT = [
  { a: 1.05, b: 1.6, txt: 'CRASH!', x: 560, y: 640, rot: -0.12, fill: '#ff3b2f', size: 150 },
  { a: 3.45, b: 3.95, txt: 'BONK!', x: 600, y: 600, rot: 0.1, fill: '#ffffff', size: 130 },
  { a: 6.8, b: 7.35, txt: 'POP!', x: 360, y: 640, rot: -0.1, fill: '#ffd21f', size: 170 },
  { a: 12.55, b: 12.95, txt: 'DING!', x: 540, y: 560, rot: 0.06, fill: '#ffffff', size: 150 },
  { a: 12.95, b: 13.35, txt: 'SCRRRTCH', x: 540, y: 700, rot: -0.08, fill: '#ff3b2f', size: 120 },
  { a: 13.5, b: 14.0, txt: '✨', x: 760, y: 520, rot: 0.2, fill: '#ffffff', size: 120 },
  { a: 15.05, b: 15.6, txt: '👀', x: 540, y: 560, rot: 0, fill: '#ffffff', size: 150 },
  { a: 26.4, b: 28.6, txt: 'wah wah wahhh…', x: 540, y: 960, rot: -0.04, fill: '#ffffff', size: 90 },
];
function outlinedText(txt, x, y, size, fill, stroke = '#000', lw = 0.16, weight = 900) {
  ctx.font = `${weight} ${size}px Inter, "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.lineWidth = size * lw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function drawSfx(t) {
  for (const s of SFXTXT) {
    if (t < s.a || t >= s.b) continue;
    const u = seg(t, s.a, s.a + 0.14);
    const sc = s.txt.startsWith('wah') ? 1 : eoBack(u) * (1 + 0.04 * Math.sin(t * 30));
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot + (s.txt.startsWith('wah') ? Math.sin(t * 3) * 0.03 : 0)); ctx.scale(sc, sc);
    if (s.fill === '#ff3b2f' || s.fill === '#ffd21f') { outlinedText(s.txt, 0, 0, s.size, '#ffffff', '#000', 0.3); }
    outlinedText(s.txt, 0, 0, s.size, s.fill, '#000', s.fill === '#ff3b2f' ? 0.12 : 0.16);
    ctx.restore();
  }
}
// captions: chunks of up to 3 words (break after punctuation)
const CHUNKS = [];
for (const l of DATA.lines) {
  let cur = [];
  l.words.forEach((w, i) => {
    cur.push(w);
    const brk = /[.!?…,]$/.test(w.w) || cur.length >= 3 || i === l.words.length - 1;
    const nextIsEmoji = l.words[i + 1] && /^\p{Extended_Pictographic}/u.test(l.words[i + 1].w);
    if (brk && !nextIsEmoji) { CHUNKS.push({ words: cur, line: l }); cur = []; }
  });
}
CHUNKS.forEach((c, i) => {
  c.a = c.words[0].t;
  const nx = CHUNKS[i + 1];
  c.b = Math.min(nx && nx.line === c.line ? nx.words[0].t : c.line.end + 0.25, c.line.end + 0.25);
  if (nx && nx.line !== c.line) c.b = Math.min(c.b, nx.words[0].t);
});
function drawCaptions(t) {
  const c = CHUNKS.find(c => t >= c.a && t < c.b);
  if (!c) return;
  const size = 92, y0 = 1270;
  ctx.font = `900 ${size}px Inter, "Noto Color Emoji", sans-serif`;
  const shown = c.words.filter(w => t >= w.t);
  const all = c.words.map(w => w.w);
  const spaceW = size * 0.3;
  const widths = all.map(w => ctx.measureText(w).width);
  // wrap to max 900px
  const rows = [[]]; let rw = 0;
  all.forEach((w, i) => { if (rw + widths[i] > 900 && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(i); rw += widths[i] + spaceW; });
  rows.forEach((r, ri) => {
    const tw = r.reduce((s, i) => s + widths[i], 0) + spaceW * (r.length - 1);
    let x = 540 - tw / 2;
    r.forEach(i => {
      const w = c.words[i];
      if (t >= w.t) {
        const u = seg(t, w.t, w.t + 0.12);
        const sc = eoBack(u);
        ctx.save(); ctx.translate(x + widths[i] / 2, y0 + ri * size * 1.12); ctx.scale(sc, sc);
        outlinedText(w.w, 0, 0, size, '#ffe11a', '#000', 0.2);
        ctx.restore();
      }
      x += widths[i] + spaceW;
    });
  });
}
function drawTopBar() {
  const h = 250;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1c0838'); g.addColorStop(0.6, '#3a1466'); g.addColorStop(1, '#4b1c7e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  const g2 = ctx.createLinearGradient(0, h, 0, h + 26); g2.addColorStop(0, 'rgba(40,10,70,0.55)'); g2.addColorStop(1, 'rgba(40,10,70,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, h, W, 26);
  ctx.font = '600 72px Inter, "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8;
  ctx.fillText('son ✌️😭🥀', W / 2, 160);
  ctx.shadowBlur = 0;
}
function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// =============== RENDER =================
window.render = function (t) {
  const shot = SHOTS.find(s => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];
  ctx.clearRect(0, 0, W, H);
  if (shot.sc === 'BLACK') {
    renderer.setClearColor('#000000', 1); renderer.clear();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  } else {
    const S = shot.sc === 'K' ? K : A;
    if (shot.sc === 'K') animateKitchen(t); else animateArena(t);
    S.scene.updateMatrixWorld(true);
    const c = shot.cam(t);
    const [sx, sy] = shake(t);
    cam.fov = c.fov; cam.setViewOffset(W, H, 0, -110, W, H); cam.updateProjectionMatrix();
    cam.position.copy(c.p); cam.position.x += sx; cam.position.y += sy;
    const l = c.l.clone(); l.x += sx * 0.5; l.y += sy * 0.5;
    cam.lookAt(l);
    if (shot.sc === 'A' && t >= 12.95 && t < 13.0) { cam.fov *= 0.96; cam.updateProjectionMatrix(); }
    if (A.near) A.near.forEach(m => m.visible = !shot.hideNear);
    renderer.render(S.scene, cam);
    drawVignette();
  }
  drawSfx(t);
  drawCaptions(t);
  drawTopBar();
  return true;
};
window.READY = true;
