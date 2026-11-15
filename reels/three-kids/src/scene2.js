import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ===========================================================================
// basics
// ===========================================================================
const W = 1080, H = 1920;
const SPEED = 1.3;
const VO_LEN = 49.55;
const PI = Math.PI;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (T, a, b) => clamp((T - a) / (b - a));
const eIO = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const eOut = k => 1 - Math.pow(1 - k, 3);
const eIn = k => k * k * k;
const eBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = (t, s = 0) => Math.sin(t * 13.1 + s) * .5 + Math.sin(t * 27.7 + s * 2.3) * .3 + Math.sin(t * 51.3 + s * 4.1) * .2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const ov = document.createElement('canvas'); ov.width = W; ov.height = H; document.body.appendChild(ov);
const ctx = ov.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.04, 120);

function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.78, metalness: o.m ?? 0, flatShading: o.flat ?? false,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null,
    transparent: o.t ?? false, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.dw ?? true,
  });
}
const BASIC = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: o.t ?? false, opacity: o.op ?? 1, map: o.map ?? null, side: o.side ?? THREE.FrontSide, depthWrite: o.dw ?? true });
function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
const RB = (w, h, d, r = 0.04, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.userData.canvas = c;
  return t;
}
function add(parent, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }

const heartShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-0.2, -0.65, -1.0, -0.2, -1.0, 0.3);
  s.bezierCurveTo(-1.0, 0.85, -0.35, 1.05, 0, 0.55);
  s.bezierCurveTo(0.35, 1.05, 1.0, 0.85, 1.0, 0.3);
  s.bezierCurveTo(1.0, -0.2, 0.2, -0.65, 0, -0.9);
  return s;
})();
const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 10 });
heartGeo.center();

// ===========================================================================
// lights
// ===========================================================================
const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xb48a64, 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(4, 4, 6); scene.add(fill);
const lampA = new THREE.PointLight(0xffb36b, 0, 6, 1.5); scene.add(lampA);
const lampB = new THREE.PointLight(0xffb36b, 0, 6, 1.5); scene.add(lampB);
const fxLight = new THREE.PointLight(0x9fdcff, 0, 3, 1.6); scene.add(fxLight);

function lighting(p) {
  const L = {
    day: { bg: 0xa9dcff, hc: 0xeaf4ff, hg: 0x9a8a64, hi: 1.35, si: 2.7, sc: 0xfff1dc, sp: [-6, 10, 6], fi: 0.5, ext: 12 },
    rest: { bg: 0x1a1020, hc: 0xffd9b0, hg: 0x4a2020, hi: 0.75, si: 0.9, sc: 0xffd2a0, sp: [-3, 6, 4], fi: 0.25, ext: 6 },
    night: { bg: 0x0e1630, hc: 0x7f95d9, hg: 0x1f2033, hi: 0.55, si: 0.5, sc: 0x9fb5ff, sp: [-6, 10, 6], fi: 0.15, ext: 12 },
    home: { bg: 0x101830, hc: 0xb0b8e8, hg: 0x40302a, hi: 0.6, si: 0.35, sc: 0x9fb5ff, sp: [-4, 7, 3], fi: 0.2, ext: 6 },
    bed: { bg: 0x101830, hc: 0xd8c8ff, hg: 0x4a3530, hi: 0.75, si: 0.4, sc: 0xb0c0ff, sp: [-3, 7, 3], fi: 0.3, ext: 6 },
    hall: { bg: 0x05070d, hc: 0x5a6ab0, hg: 0x15151f, hi: 0.32, si: 0.0, sc: 0x9fb5ff, sp: [-3, 7, 3], fi: 0.05, ext: 6 },
  }[p];
  scene.background.set(L.bg); hemi.color.set(L.hc); hemi.groundColor.set(L.hg); hemi.intensity = L.hi;
  sun.intensity = L.si; sun.color.set(L.sc); sun.position.set(...L.sp); sun.target.position.set(0, 0, -1);
  const e = L.ext; const sc = sun.shadow.camera;
  if (sc.right !== e) { sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 0.5; sc.far = 40; sc.updateProjectionMatrix(); }
  fill.intensity = L.fi;
  lampA.intensity = 0; lampB.intensity = 0; fxLight.intensity = 0;
}

// ===========================================================================
// textures
// ===========================================================================
const woodTex = (c1, c2, rep) => canvasTex(1024, 1024, (g, w, h) => {
  const n = 8;
  for (let i = 0; i < n; i++) for (let j = -1; j < 4; j++) {
    const v = hash(i, j) * 22 - 11; const off = (i % 2) * (h / 6);
    g.fillStyle = `rgb(${c1[0] + v},${c1[1] + v * .8},${c1[2] + v * .6})`; g.fillRect(i * w / n, j * h / 3 + off, w / n, h / 3);
  }
  g.strokeStyle = c2; g.lineWidth = 4;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); }
  for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { const y = j * h / 3 + (i % 2) * (h / 6); g.beginPath(); g.moveTo(i * w / n, y); g.lineTo((i + 1) * w / n, y); g.stroke(); }
}, rep);
const stripeTex = (a, b, n = 10) => canvasTex(128, 256, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * h / n, w, h / n); } });
const billTex = canvasTex(256, 112, (g, w, h) => {
  g.fillStyle = '#7fc27a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2f6b33'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#cfe9c4'; g.beginPath(); g.ellipse(w / 2, h / 2, 34, 38, 0, 0, 7); g.fill();
  g.fillStyle = '#2f6b33'; g.font = '900 56px Montserrat'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', w / 2, h / 2 + 3);
  g.font = '900 30px Montserrat'; g.fillText('100', 44, 34); g.fillText('100', w - 44, h - 30);
});
const dollarEyeTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#18a53a'; g.font = '900 96px Montserrat'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 64, 70);
});

// ===========================================================================
// characters
// ===========================================================================
const black = M(0x141414, { r: 0.45 });
const mouthMatDefault = M(0x5c1b22, { r: 0.6 });
const pinkMat = M(0xff6f8e, { r: 0.45 });
const tongueMat = M(0xff7a9a, { r: 0.5 });
const whiteMat = M(0xffffff, { r: 0.4 });
const heartRed = M(0xff2d55, { r: 0.35, e: 0xff2d55, ei: 0.25 });
const goldMat = M(0xffc83d, { r: 0.25, m: 0.85, e: 0x553300, ei: 0.3 });
const ghostMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0x9fd0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.5 });
const dollarMat = BASIC(0xffffff, { map: dollarEyeTex, t: true });

const ALLCHARS = [];
function makeChar(o) {
  const G = o.ghost;
  const skinMat = G ? ghostMat : new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.72, flatShading: true });
  const skinSmooth = G ? ghostMat : new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.72 });
  const shirtMat = G ? ghostMat : (o.shirtMap ? M(0xffffff, { map: o.shirtMap, r: 0.85 }) : M(o.shirt, { r: 0.85 }));
  const pantsMat = G ? ghostMat : (o.pantsMap ? M(0xffffff, { map: o.pantsMap, r: 0.85 }) : M(o.pants ?? 0x1f2a44, { r: 0.85 }));
  const shoeMat = G ? ghostMat : M(o.shoe ?? 0xf2f2f2, { r: 0.6 });
  const hairMat = G ? ghostMat : new THREE.MeshStandardMaterial({ color: o.hair ?? 0x333333, roughness: 0.85, flatShading: true });
  const browMat = G ? M(0x6a7a90) : M(o.brow ?? 0x141414, { r: 0.6 });
  const mouthMat = o.lips ? M(o.lips, { r: 0.45 }) : mouthMatDefault;
  const c = { o, skinMat, skinSmooth, shirtMat, hairMat, baseSkin: new THREE.Color(o.skin ?? 0xffffff) };
  const root = new THREE.Group(); c.root = root;
  const body = new THREE.Group(); root.add(body); c.body = body;
  if (o.scale) body.scale.setScalar(o.scale);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; body.add(pelvis); c.pelvis = pelvis;
  const hips = mesh(RB(0.46, 0.22, 0.27, 0.07), o.dress ? M(o.dress) : pantsMat); hips.position.y = 0.01; pelvis.add(hips); c.hipsMesh = hips;
  c.hip = {}; c.kn = {}; c.shoe = {}; c.shin = {};
  const legMat = o.dress ? skinSmooth : pantsMat;
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.115, -0.03, 0); pelvis.add(hip);
    const thigh = mesh(RB(o.dress ? 0.17 : 0.2, 0.48, o.dress ? 0.18 : 0.22, 0.07), legMat); thigh.position.y = -0.22; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    const shin = mesh(RB(o.dress ? 0.15 : 0.18, 0.42, o.dress ? 0.16 : 0.2, 0.06), legMat); shin.position.y = -0.19; knee.add(shin);
    const shoe = mesh(RB(o.dress ? 0.17 : 0.21, 0.11, o.dress ? 0.28 : 0.34, 0.05), shoeMat); shoe.position.set(0, -0.41, 0.05); knee.add(shoe);
    if (o.tornKnee && k === 'L') { const p = mesh(RB(0.12, 0.1, 0.03, 0.02), skinSmooth, false, false); p.position.set(0, 0.0, 0.1); knee.add(p); }
    c.hip[k] = hip; c.kn[k] = knee; c.shoe[k] = shoe; c.shin[k] = shin;
  }
  if (o.dress) { const sk = mesh(CYL(0.25, 0.37, 0.5, 18), M(o.dress, { r: 0.6 })); sk.position.y = -0.22; pelvis.add(sk); c.skirt = sk; }
  const spine = new THREE.Group(); spine.position.y = 0.08; pelvis.add(spine); c.spine = spine;
  const torso = mesh(RB(0.54, 0.64, 0.31, 0.1), o.dress ? M(o.dress, { r: 0.6 }) : shirtMat); torso.position.y = 0.31; spine.add(torso); c.torso = torso;
  if (o.hoodie) {
    const hood = mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 16), shirtMat); hood.position.set(0, 0.62, -0.08); hood.rotation.x = PI / 2 + 0.5; spine.add(hood);
    const pocket = mesh(RB(0.34, 0.14, 0.04, 0.02), M(new THREE.Color(o.shirt).multiplyScalar(0.8))); pocket.position.set(0, 0.12, 0.155); spine.add(pocket);
  }
  if (o.patches) {
    [[0.16, 0.42, 0x8b6b4a], [-0.14, 0.2, 0x5a6a8a]].forEach(([x, y, col]) => { const p = mesh(RB(0.11, 0.1, 0.02, 0.01), M(col), false, false); p.position.set(x, y, 0.158); p.rotation.z = 0.2; spine.add(p); });
  }
  if (o.suit) {
    const sh = mesh(RB(0.17, 0.32, 0.02, 0.01), whiteMat, false, false); sh.position.set(0, 0.47, 0.152); spine.add(sh);
    const tie = mesh(RB(0.06, 0.26, 0.02, 0.01), M(0xc0262b)), knot = mesh(RB(0.07, 0.05, 0.025, 0.01), M(0xc0262b));
    tie.position.set(0, 0.42, 0.163); knot.position.set(0, 0.58, 0.165); spine.add(tie, knot);
    for (const s of [-1, 1]) { const l = mesh(RB(0.07, 0.34, 0.02, 0.01), M(new THREE.Color(o.shirt).multiplyScalar(0.75)), false, false); l.position.set(s * 0.1, 0.47, 0.158); l.rotation.z = s * 0.28; spine.add(l); }
    const pocketSq = mesh(BOX(0.07, 0.03, 0.02), whiteMat, false, false); pocketSq.position.set(0.16, 0.5, 0.158); spine.add(pocketSq);
  }
  if (o.necklace) { const n = mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20), goldMat, false, false); n.position.set(0, 0.6, 0.04); n.rotation.x = PI / 2 - 0.35; spine.add(n); }
  const neck = mesh(CYL(0.075, 0.085, 0.14, 10), skinSmooth); neck.position.y = 0.67; spine.add(neck);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.7; spine.add(headPivot); c.headPivot = headPivot;
  const head = new THREE.Group(); head.position.y = 0.25; headPivot.add(head); c.head = head;
  const skull = mesh(new THREE.IcosahedronGeometry(0.25, 1), skinMat); skull.scale.set(0.98, 1.12, 0.96); head.add(skull); c.skull = skull;
  for (const s of [-1, 1]) { const e = mesh(new THREE.IcosahedronGeometry(0.05, 0), skinMat); e.scale.set(0.6, 1, 1); e.position.set(s * 0.245, 0.0, -0.01); head.add(e); }
  const nose = mesh(RB(0.05, o.old ? 0.09 : 0.075, o.old ? 0.08 : 0.07, 0.02, 2), skinMat); nose.position.set(0, -0.01, 0.235); head.add(nose);
  const face = new THREE.Group(); head.add(face); c.face = face;
  c.eye = {}; c.brow = {};
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const eg = new THREE.Group(); eg.position.set(side * 0.088, 0.045, 0.214); face.add(eg);
    const box = mesh(BOX(1, 1, 0.04), black, false, false); box.scale.set(0.058, 0.09, 1); eg.add(box);
    const xg = new THREE.Group(); eg.add(xg);
    for (const r of [0.785, -0.785]) { const b = mesh(BOX(0.085, 0.02, 0.04), black, false, false); b.rotation.z = r; xg.add(b); }
    const ht = mesh(heartGeo, heartRed, false, false); ht.scale.setScalar(0.055); eg.add(ht);
    const white = mesh(CYL(0.05, 0.05, 0.03, 16), whiteMat, false, false); white.rotation.x = PI / 2; white.position.z = -0.005; eg.add(white);
    const dol = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), dollarMat); dol.position.z = 0.025; eg.add(dol);
    let lash = null;
    if (o.female) { lash = mesh(BOX(0.035, 0.014, 0.035), black, false, false); lash.position.set(side * 0.036, 0.04, 0.005); lash.rotation.z = side * 0.6; eg.add(lash); }
    c.eye[k] = { g: eg, box, xg, ht, white, dol, lash, side };
    const brow = mesh(BOX(o.old ? 0.1 : 0.085, o.old ? 0.035 : 0.022, 0.04), browMat, false, false); brow.position.set(side * 0.088, 0.13, 0.208); face.add(brow);
    c.brow[k] = brow;
  }
  const m = {};
  m.line = mesh(BOX(0.09, o.lips ? 0.03 : 0.02, 0.03), mouthMat, false, false);
  m.open = mesh(CYL(0.05, 0.05, 0.03, 18), mouthMatDefault, false, false); m.open.rotation.x = PI / 2;
  m.teeth = mesh(BOX(0.075, 0.018, 0.03), whiteMat, false, false); m.teeth.position.set(0, 0.022, 0.006);
  m.tongue = mesh(RB(0.06, 0.09, 0.03, 0.014, 2), tongueMat, false, false); m.tongue.position.set(0, -0.055, 0.012);
  m.smile = mesh(new THREE.TorusGeometry(0.05, o.lips ? 0.015 : 0.012, 6, 14, PI), mouthMat, false, false); m.smile.rotation.z = PI;
  const mouth = new THREE.Group(); mouth.position.set(0, -0.095, 0.215); face.add(mouth); c.mouth = mouth;
  Object.values(m).forEach(x => mouth.add(x)); c.m = m;
  c.blush = {};
  for (const [k, s] of [['R', -1], ['L', 1]]) { const b = mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0xff7d9a, transparent: true, opacity: 0.0 }), false, false); b.position.set(s * 0.14, -0.035, 0.222); b.rotation.y = s * 0.35; face.add(b); c.blush[k] = b; }
  if (o.dirt) {
    [[0.12, -0.05, 0.215, 0.03], [-0.06, 0.16, 0.2, 0.025], [-0.15, -0.09, 0.19, 0.022]].forEach(([x, y, z, r]) => { const d = mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshBasicMaterial({ color: 0x5a4030, transparent: true, opacity: 0.35 }), false, false); d.position.set(x, y, z); d.rotation.y = x * 2; face.add(d); });
  }
  if (o.mustache) {
    const mm = M(o.hair, { r: 0.9, flat: true });
    for (const s of [-1, 1]) { const ms = mesh(RB(0.1, 0.045, 0.045, 0.018, 2), mm, false, false); ms.position.set(s * 0.045, -0.06, 0.24); ms.rotation.z = s * -0.25; face.add(ms); }
  }
  // hair
  const cap = new THREE.Group(); head.add(cap); c.cap = cap;
  const hs = o.hairStyle ?? 'fringe';
  if (hs === 'old') {
    for (const s of [-1, 1]) { const t = mesh(RB(0.08, 0.14, 0.24, 0.04, 2), hairMat); t.position.set(s * 0.23, 0.03, -0.05); cap.add(t); }
    const b = mesh(RB(0.38, 0.13, 0.08, 0.04, 2), hairMat); b.position.set(0, 0.02, -0.22); cap.add(b);
    const strand = mesh(BOX(0.2, 0.012, 0.02), hairMat); strand.position.set(0.02, 0.285, 0.0); strand.rotation.z = 0.15; cap.add(strand);
  } else {
    const g = mesh(new THREE.SphereGeometry(0.27, 9, 6, 0, PI * 2, 0, PI * 0.5), hairMat); g.rotation.x = -0.42; g.position.set(0, 0.06, -0.015); cap.add(g);
    if (hs === 'long' || hs === 'messy') {
      const b = mesh(RB(0.52, hs === 'messy' ? 0.5 : 0.6, 0.16, 0.07), hairMat); b.position.set(0, -0.13, -0.17); cap.add(b);
      for (const s of [-1, 1]) { const sd = mesh(RB(0.08, 0.42, 0.18, 0.04), hairMat); sd.position.set(s * 0.25, -0.08, -0.04); cap.add(sd); }
      const fr = mesh(RB(0.34, 0.08, 0.1, 0.03), hairMat); fr.position.set(-0.04, 0.21, 0.15); fr.rotation.set(0.5, 0, -0.18); cap.add(fr);
      if (hs === 'messy') for (let i = 0; i < 7; i++) { const sp = mesh(new THREE.ConeGeometry(0.05, 0.18, 4), hairMat); const a = i / 7 * PI * 2; sp.position.set(Math.cos(a) * 0.24, 0.12 + hash(i, 5) * 0.1, Math.sin(a) * 0.2 - 0.05); sp.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); cap.add(sp); }
    } else if (hs === 'pony') {
      const p = mesh(RB(0.14, 0.38, 0.12, 0.06), hairMat); p.position.set(0, -0.02, -0.3); p.rotation.x = 0.35; cap.add(p);
      const fr = mesh(RB(0.34, 0.08, 0.1, 0.03), hairMat); fr.position.set(0.02, 0.21, 0.15); fr.rotation.set(0.5, 0, 0.12); cap.add(fr);
    } else if (hs === 'pigtails') {
      for (const s of [-1, 1]) { const p = mesh(new THREE.IcosahedronGeometry(0.1, 1), hairMat); p.position.set(s * 0.29, 0.06, -0.06); cap.add(p); }
    } else if (hs === 'cap') {
      const hat = mesh(new THREE.SphereGeometry(0.275, 10, 6, 0, PI * 2, 0, PI * 0.5), M(o.hatColor ?? 0x2255cc)); hat.position.set(0, 0.07, 0); cap.add(hat);
      const brim = mesh(RB(0.3, 0.025, 0.22, 0.01), M(o.hatColor ?? 0x2255cc)); brim.position.set(0, 0.08, 0.24); cap.add(brim);
    } else {
      const f = mesh(RB(0.36, 0.08, 0.1, 0.03), hairMat); f.position.set(0.02, 0.21, 0.15); f.rotation.set(0.5, 0, 0.12); cap.add(f);
    }
  }
  if (o.glasses) {
    const gl = new THREE.Group();
    const lensMat = o.glasses === 'sun' ? M(0x111111, { r: 0.15, m: 0.4 }) : M(0xcfe8ff, { t: true, op: 0.25, r: 0.1 });
    const frameMat = o.glasses === 'sun' ? M(0x111111) : M(0x3a2a1a, { r: 0.4 });
    for (const s of [-1, 1]) {
      const l = mesh(RB(0.11, 0.08, 0.012, 0.02, 2), lensMat, false, false); l.position.set(s * 0.088, 0.045, 0.245); gl.add(l);
      if (o.glasses !== 'sun') { const t = mesh(BOX(0.12, 0.014, 0.02), frameMat, false, false); t.position.set(s * 0.088, 0.088, 0.246); gl.add(t); const b = mesh(BOX(0.12, 0.01, 0.02), frameMat, false, false); b.position.set(s * 0.088, 0.004, 0.246); gl.add(b); }
    }
    const br = mesh(BOX(0.07, 0.015, 0.02), frameMat, false, false); br.position.set(0, 0.06, 0.246); gl.add(br);
    head.add(gl); c.glasses = gl;
  }
  // arms
  c.sh = {}; c.el = {}; c.hand = {};
  const sleeveMat = o.dress ? skinSmooth : shirtMat;
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.33, 0.55, 0); spine.add(sh);
    const sleeve = mesh(RB(0.18, 0.26, 0.19, 0.07), o.dress ? M(o.dress, { r: 0.6 }) : sleeveMat); sleeve.position.y = -0.09; sh.add(sleeve);
    const upper = mesh(RB(0.13, 0.3, 0.13, 0.055), o.longSleeve ? sleeveMat : skinSmooth); upper.position.y = -0.17; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.31; sh.add(elbow);
    const fore = mesh(RB(0.12, 0.28, 0.12, 0.05), o.longSleeve ? sleeveMat : skinSmooth); fore.position.y = -0.13; elbow.add(fore);
    const hand = mesh(RB(0.13, 0.14, 0.09, 0.04), skinSmooth); hand.position.y = -0.32; elbow.add(hand);
    const thumb = mesh(RB(0.05, 0.11, 0.05, 0.02), skinSmooth); thumb.position.set(0, -0.22, 0.07); thumb.visible = false; elbow.add(thumb);
    const anchor = new THREE.Group(); anchor.position.y = -0.33; elbow.add(anchor);
    if (o.rolex && k === 'L') {
      const band = mesh(RB(0.145, 0.05, 0.145, 0.02), goldMat); band.position.y = -0.24; elbow.add(band);
      const face = mesh(CYL(0.045, 0.045, 0.02, 20), goldMat); face.rotation.z = PI / 2; face.position.set(0.075, -0.24, 0); elbow.add(face);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), BASIC(0x16324f)); dial.rotation.y = PI / 2; dial.position.set(0.087, -0.24, 0); elbow.add(dial);
      c.watch = face;
    }
    c.sh[k] = sh; c.el[k] = elbow; c.hand[k] = anchor; c['thumb' + k] = thumb;
  }
  if (G) root.traverse(x => { if (x.isMesh) { x.castShadow = false; } });
  scene.add(root);
  ALLCHARS.push(c);
  return c;
}

const DEF_POSE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, spX: 0, spY: 0, spZ: 0, hdX: 0, hdY: 0, hdZ: 0, hdLift: 0,
  shRx: 0, shRy: 0, shRz: 0.07, shLx: 0, shLy: 0, shLz: 0.07, elR: 0.12, elL: 0.12,
  hipRx: 0, hipRz: 0.02, hipLx: 0, hipLz: 0.02, knR: 0, knL: 0, pelY: 0.92 };
const P = (o = {}) => Object.assign({}, DEF_POSE, o);
function applyPose(c, p) {
  c.root.visible = true;
  c.root.position.set(p.x, p.y, p.z);
  c.root.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
  c.pelvis.position.y = p.pelY;
  c.spine.rotation.set(p.spX, p.spY, p.spZ);
  c.headPivot.rotation.set(p.hdX, p.hdY, p.hdZ);
  c.headPivot.position.z = p.hdLift;
  c.sh.R.rotation.set(-p.shRx, p.shRy, -p.shRz); c.sh.L.rotation.set(-p.shLx, -p.shLy, p.shLz);
  c.el.R.rotation.x = -p.elR; c.el.L.rotation.x = -p.elL;
  c.hip.R.rotation.set(-p.hipRx, 0, -p.hipRz); c.hip.L.rotation.set(-p.hipLx, 0, p.hipLz);
  c.kn.R.rotation.x = p.knR; c.kn.L.rotation.x = p.knL;
  if (c.skirt) c.skirt.rotation.x = -(p.hipRx + p.hipLx) * 0.25;
}
const _box = new THREE.Box3();
function ground(c, floor = 0) {
  c.root.updateMatrixWorld(true);
  let mn = Infinity;
  for (const m of [c.shoe.R, c.shoe.L, c.shin.R, c.shin.L, c.hipsMesh]) { _box.setFromObject(m); mn = Math.min(mn, _box.min.y); }
  c.root.position.y -= mn - floor;
  c.root.updateMatrixWorld(true);
}
const DEF_FACE = { eyes: 'open', eyeR: null, eyeL: null, eyeScale: 1, look: 0, lookY: 0, brow: 0, browY: 0, browR: null, browL: null, mouth: 'line', mouthScale: 1, blush: 0, thumbR: false, thumbL: false };
function setFace(c, f) {
  f = Object.assign({}, DEF_FACE, f);
  for (const k of ['R', 'L']) {
    const e = c.eye[k]; const mode = (k === 'R' ? f.eyeR : f.eyeL) ?? f.eyes;
    e.box.visible = ['open', 'wide', 'half', 'closed', 'sly', 'tiny'].includes(mode);
    e.xg.visible = mode === 'x'; e.ht.visible = mode === 'heart'; e.white.visible = mode === 'wide' || mode === 'tiny'; e.dol.visible = mode === 'dollar';
    if (e.lash) e.lash.visible = ['open', 'wide', 'half', 'sly'].includes(mode);
    const s = f.eyeScale;
    if (mode === 'open') { e.box.scale.set(0.058, 0.09 * s, 1); e.box.position.set(f.look * 0.02, f.lookY * 0.02, 0); }
    if (mode === 'wide') { e.box.scale.set(0.05, 0.075, 1); e.box.position.set(f.look * 0.02, f.lookY * 0.015, 0.012); e.white.scale.set(1.15 * s, 1, 1.35 * s); }
    if (mode === 'tiny') { e.box.scale.set(0.022, 0.03, 1); e.box.position.set(f.look * 0.02, 0, 0.012); e.white.scale.set(1.1 * s, 1, 1.3 * s); }
    if (mode === 'half') { e.box.scale.set(0.064, 0.045, 1); e.box.position.set(f.look * 0.02, -0.018, 0); }
    if (mode === 'sly') { e.box.scale.set(0.066, 0.04, 1); e.box.position.set(f.look * 0.02 + e.side * 0.004, -0.012, 0); }
    if (mode === 'closed') { e.box.scale.set(0.075, 0.017, 1); e.box.position.set(0, -0.01, 0); }
    if (mode === 'heart') e.ht.scale.setScalar(0.06 * s);
    if (mode === 'dollar') e.dol.scale.setScalar(s);
    const bAng = (k === 'R' ? f.browR : f.browL) ?? f.brow;
    c.brow[k].rotation.z = (k === 'R' ? -1 : 1) * bAng;
    c.brow[k].position.y = 0.13 + f.browY * 0.03 + (mode === 'wide' ? 0.025 : 0);
  }
  for (const key in c.m) c.m[key].visible = false;
  c.mouth.scale.setScalar(f.mouthScale); c.mouth.rotation.z = 0; c.mouth.position.x = 0;
  switch (f.mouth) {
    case 'line': c.m.line.visible = true; break;
    case 'smirk': c.m.line.visible = true; c.mouth.rotation.z = 0.28; c.mouth.position.x = 0.02; break;
    case 'smile': c.m.smile.visible = true; break;
    case 'open': c.m.open.visible = true; c.m.open.scale.set(1, 1, 0.8); break;
    case 'o': c.m.open.visible = true; c.m.open.scale.set(0.6, 1, 0.75); break;
    case 'grin': c.m.open.visible = true; c.m.open.scale.set(1.25, 1, 0.55); c.m.teeth.visible = true; break;
    case 'chomp': c.m.open.visible = true; c.m.open.scale.set(1.1, 1, 1.1); c.m.teeth.visible = true; break;
    case 'scream': c.m.open.visible = true; c.m.open.scale.set(1.2, 1, 1.4); c.m.tongue.visible = true; c.m.tongue.position.y = -0.03; break;
    case 'tongue': c.m.open.visible = true; c.m.open.scale.set(0.9, 1, 0.6); c.m.tongue.visible = true; c.m.tongue.position.y = -0.055; break;
  }
  for (const k of ['R', 'L']) c.blush[k].material.opacity = f.blush;
  c.thumbR.visible = f.thumbR; c.thumbL.visible = f.thumbL;
}
function walk(p, ph, amp = 1) {
  const s = Math.sin(ph), c2 = Math.cos(ph);
  p.hipRx = s * 0.45 * amp; p.hipLx = -s * 0.45 * amp;
  p.knR = Math.max(0, -c2) * 0.6 * amp; p.knL = Math.max(0, c2) * 0.6 * amp;
  p.shRx = -s * 0.35 * amp; p.shLx = s * 0.35 * amp;
  p.elR = 0.25; p.elL = 0.25;
  p.y = Math.abs(Math.sin(ph)) * 0.025 * amp;
  return p;
}

// ---- cast
const OLD = { skin: 0xf1c9a5, shirt: 0x22335e, pants: 0x22335e, shoe: 0x1a1a1a, hair: 0xdcdcdc, brow: 0xcfcfcf, hairStyle: 'old', old: true, mustache: true, glasses: 'clear', suit: true, longSleeve: true, rolex: true };
const oldMan = makeChar(OLD);
const oldPJ = makeChar(Object.assign({}, OLD, { suit: false, rolex: false, shirtMap: stripeTex('#7fa8e8', '#e8f0ff', 9), pantsMap: stripeTex('#7fa8e8', '#e8f0ff', 9), shoe: 0x6a4a8a }));
const ghost = makeChar(Object.assign({}, OLD, { ghost: true, rolex: false, suit: false, glasses: false }));
const GIRL = { skin: 0xe8b48c, hair: 0x5a3622, female: true, lips: 0xd44a63 };
const girlHome = makeChar(Object.assign({}, GIRL, { shirt: 0x7a8a62, hoodie: true, longSleeve: true, patches: true, pants: 0x41618a, tornKnee: true, shoe: 0x8a8a8a, hairStyle: 'messy', dirt: true, lips: 0xb46060 }));
const girlGlam = makeChar(Object.assign({}, GIRL, { dress: 0xff4f9a, shoe: 0xd0122f, hairStyle: 'long', hair: 0x6b3e20, glasses: 'sun', necklace: true }));
const girlCasual = makeChar(Object.assign({}, GIRL, { shirt: 0xa98be0, longSleeve: true, pants: 0x3b3b4f, shoe: 0xf0f0f0, hairStyle: 'long', hair: 0x6b3e20 }));
const girlPJ = makeChar(Object.assign({}, GIRL, { shirtMap: stripeTex('#ff9cc0', '#fff0f6', 9), pantsMap: stripeTex('#ff9cc0', '#fff0f6', 9), longSleeve: true, shoe: 0xffc0d8, hairStyle: 'pony', hair: 0x6b3e20 }));
const kids = [
  makeChar({ skin: 0xeab890, shirt: 0xe84a3c, pants: 0x2a4a8a, hair: 0x5a3622, hairStyle: 'cap', hatColor: 0x2b6be0, scale: 0.58 }),
  makeChar({ skin: 0xeab890, shirt: 0xffd23f, pants: 0xffd23f, dress: 0xffd23f, shoe: 0xff6f9a, hair: 0x6b3e20, hairStyle: 'pigtails', female: true, scale: 0.52 }),
  makeChar({ skin: 0xeab890, shirt: 0x4ccf7a, pants: 0x333333, hair: 0x3a2412, hairStyle: 'fringe', glasses: 'clear', scale: 0.6 }),
];

// ===========================================================================
// props
// ===========================================================================
const props = {};
const PROPLIST = [];
function prop(name, g) { props[name] = g; PROPLIST.push(name); scene.add(g); return g; }
// bills
const bills = [];
const billGeo = new THREE.PlaneGeometry(0.17, 0.075);
const billMat = new THREE.MeshStandardMaterial({ map: billTex, side: THREE.DoubleSide, roughness: 0.8 });
for (let i = 0; i < 46; i++) { const b = mesh(billGeo, billMat, true, false); scene.add(b); bills.push(b); }
// cash wad
prop('wad', (() => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = mesh(billGeo, billMat); b.rotation.set(-PI / 2, 0, (i - 2) * 0.25); b.position.set(0, i * 0.004, 0); b.scale.setScalar(1.1); g.add(b); } return g; })());
// cane
prop('cane', (() => { const g = new THREE.Group(); const m = M(0x4a2a12, { r: 0.4 }); const s = mesh(CYL(0.018, 0.018, 0.9, 8), m); s.position.y = -0.45; g.add(s); const h = mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, PI), m); h.position.set(0.06, 0, 0); g.add(h); const tip = mesh(CYL(0.02, 0.02, 0.03, 8), goldMat); tip.position.y = -0.9; g.add(tip); return g; })());
// cup + sign + cardboard
prop('cup', (() => { const g = new THREE.Group(); const c = mesh(CYL(0.05, 0.04, 0.12, 14), M(0xf2f2f2)); c.position.y = 0.06; g.add(c); const band = mesh(CYL(0.051, 0.046, 0.04, 14), M(0x3a7bd5)); band.position.y = 0.06; g.add(band); const coin = mesh(CYL(0.02, 0.02, 0.005, 10), goldMat); coin.position.set(0, 0.11, 0); g.add(coin); return g; })());
const signTex = canvasTex(512, 360, (g, w, h) => {
  g.fillStyle = '#c99b62'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,60,30,0.25)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * 30, w, 3);
  g.fillStyle = '#1a1a1a'; g.font = '82px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('ANYTHING', w / 2, 140); g.fillText('HELPS :)', w / 2, 250);
});
prop('sign', (() => { const g = new THREE.Group(); const b = mesh(BOX(0.5, 0.35, 0.01), M(0xc99b62)); g.add(b); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), M(0xffffff, { map: signTex })); f.position.z = 0.006; g.add(f); return g; })());
prop('cardboard', (() => { const g = new THREE.Group(); const b = mesh(BOX(1.1, 0.02, 0.8), M(0xb98a52)); b.position.y = 0.01; g.add(b); return g; })());
// cars
function makeCar(type) {
  const g = new THREE.Group();
  const isL = type === 'lambo';
  const body = M(isL ? 0xffc21a : 0x111216, { r: isL ? 0.3 : 0.25, m: isL ? 0.3 : 0.6 });
  const glass = M(0x1b2633, { r: 0.1, m: 0.5 });
  const len = isL ? 4.2 : 6.2, wid = 1.9;
  const b = mesh(RB(wid, isL ? 0.5 : 0.7, len, 0.15), body); b.position.y = isL ? 0.45 : 0.6; g.add(b);
  if (isL) {
    const cab = mesh(RB(1.5, 0.45, 1.8, 0.2), glass); cab.position.set(0, 0.85, -0.2); cab.scale.set(1, 1, 1); g.add(cab);
    const hood = mesh(RB(1.8, 0.2, 1.4, 0.1), body); hood.position.set(0, 0.68, 1.3); hood.rotation.x = 0.12; g.add(hood);
    const spoiler = mesh(RB(1.8, 0.05, 0.35, 0.02), M(0x111111)); spoiler.position.set(0, 1.0, -1.95); g.add(spoiler);
    for (const s of [-0.7, 0.7]) { const st = mesh(BOX(0.06, 0.25, 0.06), M(0x111111)); st.position.set(s, 0.85, -1.95); g.add(st); }
  } else {
    const cab = mesh(RB(1.8, 0.55, 4.4, 0.15), glass); cab.position.set(0, 1.18, -0.2); g.add(cab);
    const roof = mesh(RB(1.82, 0.08, 4.3, 0.04), body); roof.position.set(0, 1.47, -0.2); g.add(roof);
  }
  for (const [x, z] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
    const w = mesh(CYL(0.36, 0.36, 0.28, 18), M(0x151515, { r: 0.8 })); w.rotation.z = PI / 2; w.position.set(x, 0.36, z); g.add(w);
    const rim = mesh(CYL(0.2, 0.2, 0.3, 12), M(0xcfd6dd, { r: 0.2, m: 0.9 })); rim.rotation.z = PI / 2; rim.position.set(x, 0.36, z); g.add(rim);
  }
  for (const s of [-0.65, 0.65]) { const hl = new THREE.Mesh(BOX(0.35, 0.1, 0.05), BASIC(0xfff6d8)); hl.position.set(s, isL ? 0.55 : 0.7, len / 2 + 0.01); g.add(hl); const tl = new THREE.Mesh(BOX(0.35, 0.08, 0.05), BASIC(0xff2020)); tl.position.set(s, isL ? 0.55 : 0.7, -len / 2 - 0.01); g.add(tl); }
  return g;
}
prop('limo', makeCar('limo'));
prop('lambo', makeCar('lambo'));
// purse with dog
prop('purse', (() => {
  const g = new THREE.Group();
  const b = mesh(RB(0.3, 0.22, 0.14, 0.05), M(0xff9fcf, { r: 0.4 })); b.position.y = -0.18; g.add(b);
  const st = mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16, PI), goldMat); st.position.y = -0.07; g.add(st);
  const dog = new THREE.Group(); dog.position.set(0, -0.03, 0.0); g.add(dog); g.userData.dog = dog;
  const fur = M(0xe8d2b0, { flat: true });
  const hd = mesh(new THREE.IcosahedronGeometry(0.075, 1), fur); hd.scale.set(1, 0.9, 0.95); dog.add(hd);
  for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.03, 0.08, 4), M(0xc9a57a, { flat: true })); ear.position.set(s * 0.05, 0.08, -0.01); ear.rotation.z = -s * 0.4; dog.add(ear); const eye = mesh(BOX(0.016, 0.022, 0.01), black, false, false); eye.position.set(s * 0.03, 0.015, 0.07); dog.add(eye); }
  const snout = mesh(RB(0.06, 0.04, 0.05, 0.015), fur); snout.position.set(0, -0.02, 0.07); dog.add(snout);
  const nose = mesh(BOX(0.022, 0.016, 0.012), black, false, false); nose.position.set(0, -0.006, 0.098); dog.add(nose);
  const jaw = mesh(BOX(0.04, 0.012, 0.03), mouthMatDefault, false, false); jaw.position.set(0, -0.045, 0.085); dog.add(jaw); g.userData.jaw = jaw;
  const bow = mesh(new THREE.IcosahedronGeometry(0.02, 0), M(0xff2d6b)); bow.position.set(0.04, 0.07, 0.03); dog.add(bow);
  return g;
})());
// menu
const menuTex = canvasTex(256, 360, (g, w, h) => { g.fillStyle = '#5a1020'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c060'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28); g.fillStyle = '#e8c060'; g.font = '60px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('MENU', w / 2, h / 2 + 20); });
prop('menu', (() => { const g = new THREE.Group(); const b = mesh(BOX(0.26, 0.36, 0.02), M(0x5a1020)); g.add(b); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), M(0xffffff, { map: menuTex })); f.position.z = 0.011; g.add(f); return g; })());
// halo
prop('halo', (() => { const h = mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd23f, emissiveIntensity: 1.2 }), false, false); h.rotation.x = PI / 2; const g = new THREE.Group(); g.add(h); return g; })());
// big heart (ba-dum)
prop('bigHeart', (() => { const g = new THREE.Group(); const h = mesh(heartGeo, M(0xff2d55, { r: 0.35, e: 0xff2d55, ei: 0.35 })); h.rotation.z = PI; g.add(h); return g; })());
// will + pen
const willTex = canvasTex(360, 480, (g, w, h) => {
  g.fillStyle = '#fbf7ec'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#222'; g.font = '46px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('LAST WILL', w / 2, 70);
  g.font = '800 20px Montserrat'; g.textAlign = 'left';
  ['I leave EVERYTHING', 'to my beautiful wife', '(the mansion, the', 'Lambo, the dog...)'].forEach((s, i) => g.fillText(s, 30, 130 + i * 34));
  g.fillStyle = '#bbb'; for (let i = 0; i < 4; i++) g.fillRect(30, 290 + i * 22, 300, 6);
  g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 430); g.lineTo(320, 430); g.stroke();
  g.font = '800 18px Montserrat'; g.fillText('SIGN HERE  X', 40, 455);
});
prop('will', (() => { const g = new THREE.Group(); const p = mesh(new THREE.PlaneGeometry(0.3, 0.4), M(0xffffff, { map: willTex, side: THREE.DoubleSide }), true, false); g.add(p); return g; })());
prop('pen', (() => { const g = new THREE.Group(); const p = mesh(CYL(0.008, 0.008, 0.15, 8), M(0x1a3a8a)); g.add(p); const t = mesh(new THREE.ConeGeometry(0.008, 0.02, 8), goldMat); t.position.y = -0.085; t.rotation.x = PI; g.add(t); return g; })());
// laptop with dynamic screen
const screenTex = canvasTex(1024, 680, () => {});
function drawScreen(typed, T) {
  const g = screenTex.userData.canvas.getContext('2d'); const w = 1024, h = 680;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f1f3f4'; g.fillRect(0, 0, w, 54); g.fillStyle = '#ddd'; g.fillRect(0, 54, w, 2);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(30 + i * 30, 27, 9, 0, 7); g.fill(); });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '110px "Luckiest Guy"';
  const word = 'SEARCH'; const cols = ['#4a7cf0', '#e8453c', '#f2b51f', '#4a7cf0', '#2fa857', '#e8453c'];
  let x = w / 2 - g.measureText(word).width / 2; g.textAlign = 'left';
  for (let i = 0; i < word.length; i++) { g.fillStyle = cols[i]; g.fillText(word[i], x, 175); x += g.measureText(word[i]).width; }
  // search bar
  const bx = 90, by = 260, bw = w - 180, bh = 84;
  g.fillStyle = '#fff'; g.strokeStyle = '#d0d0d0'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(bx, by, bw, bh, 42); g.fill(); g.stroke();
  g.strokeStyle = '#888'; g.lineWidth = 6; g.beginPath(); g.arc(bx + 50, by + 38, 15, 0, 7); g.stroke(); g.beginPath(); g.moveTo(bx + 61, by + 50); g.lineTo(bx + 74, by + 63); g.stroke();
  g.fillStyle = '#202124'; g.font = '800 40px Montserrat'; g.textAlign = 'left';
  g.fillText(typed, bx + 95, by + bh / 2 + 2);
  const tw = g.measureText(typed).width;
  if (Math.floor(T * 4) % 2 === 0) g.fillRect(bx + 100 + tw, by + 20, 4, 46);
  if (typed.length > 20) {
    const sugg = ['how long do old men live', 'how long do old men live after marriage', 'how to fake cry at a funeral', 'lambo insurance cost'];
    g.fillStyle = '#fff'; g.strokeStyle = '#e0e0e0'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(bx, by + bh + 6, bw, 4 * 62 + 20, 24); g.fill(); g.stroke();
    sugg.forEach((s, i) => { g.fillStyle = i === 2 ? '#c5221f' : '#3c4043'; g.font = `${i === 2 ? 800 : 800} 34px Montserrat`; g.fillText(s, bx + 95, by + bh + 50 + i * 62); g.strokeStyle = '#aaa'; g.lineWidth = 4; g.beginPath(); g.arc(bx + 50, by + bh + 46 + i * 62, 11, 0, 7); g.stroke(); });
  }
  screenTex.needsUpdate = true;
}
prop('laptop', (() => {
  const g = new THREE.Group();
  const al = M(0xc9ced6, { r: 0.3, m: 0.7 });
  const base = mesh(RB(0.36, 0.02, 0.25, 0.008), al); g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.01, -0.12); lid.rotation.x = -0.32; g.add(lid);
  const back = mesh(RB(0.36, 0.24, 0.012, 0.008), al); back.position.set(0, 0.12, 0); lid.add(back);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), BASIC(0xffffff, { map: screenTex })); scr.position.set(0, 0.12, 0.007); lid.add(scr);
  g.userData.scr = scr;
  return g;
})());
// food items
const foods = [];
function food(kind) {
  const g = new THREE.Group();
  const plate = mesh(CYL(0.16, 0.12, 0.02, 20), M(0xffffff, { r: 0.3 })); plate.position.y = 0.01; g.add(plate);
  let h = 0.02;
  if (kind === 'burger') { [[0.1, 0.035, 0xe0a050], [0.105, 0.02, 0x5bbf3a], [0.1, 0.035, 0x6b3a1e], [0.105, 0.012, 0xffc83d], [0.1, 0.045, 0xe0a050]].forEach(([r, hh, col]) => { const m = mesh(CYL(r, r, hh, 16), M(col)); m.position.y = h + hh / 2; g.add(m); h += hh; }); }
  if (kind === 'cake') { const c = mesh(CYL(0.11, 0.11, 0.12, 18), M(0xffd1e0)); c.position.y = h + 0.06; g.add(c); const t = mesh(CYL(0.112, 0.112, 0.03, 18), M(0xff6f9a)); t.position.y = h + 0.11; g.add(t); const ch = mesh(new THREE.IcosahedronGeometry(0.025, 1), M(0xd01030)); ch.position.y = h + 0.145; g.add(ch); h += 0.16; }
  if (kind === 'pizza') { const p = mesh(CYL(0.15, 0.15, 0.02, 20), M(0xf2b14a)); p.position.y = h + 0.01; g.add(p); for (let i = 0; i < 5; i++) { const s = mesh(CYL(0.025, 0.025, 0.01, 10), M(0xc0302a)); const a = i * 1.3; s.position.set(Math.cos(a) * 0.08, h + 0.025, Math.sin(a) * 0.08); g.add(s); } h += 0.03; }
  if (kind === 'lobster') { const b = mesh(new THREE.IcosahedronGeometry(0.07, 1), M(0xe8402a, { flat: true })); b.scale.set(0.8, 0.6, 1.6); b.position.y = h + 0.04; g.add(b); for (const s of [-1, 1]) { const cl = mesh(new THREE.IcosahedronGeometry(0.04, 0), M(0xe8402a, { flat: true })); cl.position.set(s * 0.08, h + 0.05, 0.1); g.add(cl); } h += 0.08; }
  if (kind === 'sundae') { const cup = mesh(CYL(0.06, 0.03, 0.08, 14), M(0xd8eef8, { t: true, op: 0.7 })); cup.position.y = h + 0.04; g.add(cup); [0xfff3d6, 0xff9fbf, 0x7a4a2a].forEach((c, i) => { const s = mesh(new THREE.IcosahedronGeometry(0.045, 1), M(c, { flat: true })); s.position.set((i - 1) * 0.03, h + 0.1 + (i === 1 ? 0.04 : 0), 0); g.add(s); }); h += 0.17; }
  if (kind === 'chicken') { const d = mesh(new THREE.IcosahedronGeometry(0.06, 1), M(0xc8782a, { flat: true })); d.scale.set(1, 0.8, 1.4); d.position.y = h + 0.05; g.add(d); const bone = mesh(CYL(0.012, 0.012, 0.08, 6), whiteMat); bone.rotation.x = PI / 2; bone.position.set(0, h + 0.05, 0.11); g.add(bone); h += 0.1; }
  if (kind === 'spaghetti') { const s = mesh(new THREE.IcosahedronGeometry(0.09, 1), M(0xf5d27a, { flat: true })); s.scale.set(1.2, 0.5, 1.2); s.position.y = h + 0.035; g.add(s); const sa = mesh(new THREE.IcosahedronGeometry(0.05, 1), M(0xc0302a, { flat: true })); sa.position.y = h + 0.07; g.add(sa); h += 0.09; }
  if (kind === 'turkey') { const t = mesh(new THREE.IcosahedronGeometry(0.11, 1), M(0xb8682a, { flat: true })); t.scale.set(1.1, 0.75, 1); t.position.y = h + 0.08; g.add(t); h += 0.16; }
  g.userData.h = h; scene.add(g); foods.push(g); return g;
}
['burger', 'pizza', 'lobster', 'cake', 'spaghetti', 'chicken', 'turkey', 'sundae', 'burger', 'cake'].forEach(food);
// particles
const hearts = [];
for (let i = 0; i < 9; i++) { const h = mesh(heartGeo, M(0xff4f7b, { r: 0.35, e: 0xff2d6b, ei: 0.35 }), false, false); h.scale.setScalar(0.06); scene.add(h); hearts.push(h); }
const puffs = [];
for (let i = 0; i < 14; i++) { const s = mesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false }), false, false); scene.add(s); puffs.push(s); }
const crumbs = [];
for (let i = 0; i < 16; i++) { const s = mesh(BOX(0.025, 0.025, 0.006), M(0x5a1020), false, false); scene.add(s); crumbs.push(s); }

// ===========================================================================
// sets (all share the origin; only one visible per shot)
// ===========================================================================
const sets = {};
function newSet(name) { const g = new THREE.Group(); g.visible = false; scene.add(g); sets[name] = g; return g; }

// ---------------- street
{
  const S = newSet('street');
  const SW = 0.12;
  const swTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c9c9c4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a5a5a0'; g.lineWidth = 6; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } g.globalAlpha = 0.08; for (let k = 0; k < 300; k++) { g.fillStyle = k % 2 ? '#000' : '#fff'; g.fillRect(hash(k) * w, hash(k, 2) * h, 6, 6); } }, [6, 2]);
  add(S, mesh(BOX(24, SW, 3.8), new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.9 }), false, true), 0, SW / 2, -0.3);
  add(S, mesh(BOX(24, 0.14, 0.18), M(0xb0b0aa)), 0, 0.07, 1.6);
  const road = add(S, mesh(new THREE.PlaneGeometry(40, 14), M(0x3a3d42, { r: 0.95 }), false, true), 0, 0.001, 8.6, -PI / 2);
  for (let i = -10; i < 10; i++) add(S, mesh(new THREE.PlaneGeometry(1.2, 0.12), M(0xf2c94c), false, true), i * 2.2, 0.004, 5.2, -PI / 2);
  const brick = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#7a3b2e'; g.fillRect(0, 0, w, h); const bw = 64, bh = 28; for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) { const v = hash(r, c) * 30 - 15; g.fillStyle = `rgb(${170 + v},${80 + v * .5},${60 + v * .4})`; g.fillRect(c * bw + (r % 2) * bw / 2 + 3, r * bh + 3, bw - 6, bh - 6); } }, [8, 3]);
  add(S, mesh(new THREE.PlaneGeometry(24, 7), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.95 }), false, true), 0, 3.5, -2.2);
  // bank front
  const bank = new THREE.Group(); bank.position.set(3.3, 0, -2.18); S.add(bank);
  add(bank, mesh(BOX(4.6, 3.2, 0.12), M(0xe9e2d0)), 0, 1.7, 0.02);
  for (const x of [-1.9, -0.65, 0.65, 1.9]) add(bank, mesh(CYL(0.13, 0.15, 2.6, 14), M(0xf6f1e4)), x, 1.42, 0.25);
  add(bank, mesh(BOX(4.8, 0.3, 0.6), M(0xf6f1e4)), 0, 2.85, 0.25);
  const bankSign = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1d2a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd25a'; g.font = '96px "Luckiest Guy"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BANK', w / 2, h / 2 + 6); });
  add(bank, new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), M(0xffffff, { map: bankSign, e: 0x332200, ei: 0.2 })), 0, 3.35, 0.1);
  add(bank, mesh(BOX(1.0, 2.0, 0.05), M(0x2a1c10)), 0, 1.12, 0.09);
  add(bank, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), M(0x9fd2ff, { r: 0.1, m: 0.4, e: 0x2a4a6a, ei: 0.3 })), -1.3, 1.5, 0.09);
  add(bank, new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), M(0x9fd2ff, { r: 0.1, m: 0.4, e: 0x2a4a6a, ei: 0.3 })), 1.3, 1.5, 0.09);
  // shop window left
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.5), M(0x8fb8d8, { r: 0.1, m: 0.3, e: 0x203040, ei: 0.3 })), -4.2, 1.6, -2.17);
  add(S, mesh(BOX(2.0, 0.12, 0.2), M(0x3a5a3a)), -4.2, 2.45, -2.1);
  // lamppost, hydrant, trash
  const lp = new THREE.Group(); lp.position.set(-3.4, SW, 1.25); S.add(lp);
  add(lp, mesh(CYL(0.06, 0.08, 4, 10), M(0x2a2f36, { m: 0.5, r: 0.4 })), 0, 2, 0);
  add(lp, mesh(RB(0.3, 0.35, 0.3, 0.05), M(0x2a2f36)), 0, 4.1, 0);
  add(lp, new THREE.Mesh(BOX(0.22, 0.2, 0.22), BASIC(0xfff2c4)), 0, 4.05, 0);
  const hy = new THREE.Group(); hy.position.set(1.5, SW, 1.2); S.add(hy);
  add(hy, mesh(CYL(0.11, 0.13, 0.5, 12), M(0xd8302a)), 0, 0.25, 0); add(hy, mesh(new THREE.SphereGeometry(0.11, 12, 6, 0, PI * 2, 0, PI / 2), M(0xd8302a)), 0, 0.5, 0);
  add(hy, mesh(CYL(0.05, 0.05, 0.36, 8), M(0xd8302a)), 0, 0.32, 0, 0, 0, PI / 2);
  const tr = new THREE.Group(); tr.position.set(-2.7, SW, -1.85); S.add(tr);
  add(tr, mesh(CYL(0.26, 0.22, 0.8, 14), M(0x3a6a4a, { m: 0.3, r: 0.5 })), 0, 0.4, 0); add(tr, mesh(CYL(0.28, 0.28, 0.06, 14), M(0x2e5a3c)), 0, 0.82, 0);
  // across-street buildings
  const winTex = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#d9c7a8'; g.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { g.fillStyle = hash(r, c) > 0.7 ? '#ffe9a8' : '#7fa8c8'; g.fillRect(16 + c * 60, 20 + r * 62, 40, 44); } }, [1, 1]);
  const cols = [0xd9c7a8, 0xc8d9e8, 0xe8c8c0, 0xd0e0c8];
  for (let i = -5; i <= 5; i++) { const hgt = 7 + hash(i, 3) * 8; const b = mesh(BOX(3.8, hgt, 3), [M(cols[(i + 10) % 4]), M(cols[(i + 10) % 4]), M(0x999999), M(0x999999), M(0xffffff, { map: winTex }), M(cols[(i + 10) % 4])]); b.position.set(i * 4, hgt / 2, 17); b.rotation.y = PI; S.add(b); }
  add(S, mesh(new THREE.PlaneGeometry(40, 5), M(0xc9c9c4), false, true), 0, SW, 13.5, -PI / 2);
}

// ---------------- restaurant
{
  const S = newSet('rest');
  const tile = canvasTex(512, 512, (g, w, h) => { const n = 8; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#2a1a14' : '#e9dcc4'; g.fillRect(i * w / n, j * h / n, w / n, h / n); } }, [6, 6]);
  add(S, mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.35, metalness: 0.1 }), false, true), 0, 0, 0, -PI / 2);
  const wall = M(0x6e1f2a, { r: 0.9 });
  add(S, mesh(new THREE.PlaneGeometry(10, 4.5), wall, false, true), 0, 2.25, -3);
  add(S, mesh(new THREE.PlaneGeometry(10, 4.5), wall, false, true), -4, 2.25, 0, 0, PI / 2);
  add(S, mesh(new THREE.PlaneGeometry(10, 4.5), wall, false, true), 4, 2.25, 0, 0, -PI / 2);
  add(S, mesh(BOX(10, 1.0, 0.05), M(0x3a1018)), 0, 0.5, -2.98);
  add(S, mesh(BOX(10, 0.06, 0.06), goldMat), 0, 1.02, -2.96);
  const city = canvasTex(512, 384, (g, w, h) => { const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#0b1030'); grd.addColorStop(1, '#2a2050'); g.fillStyle = grd; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { const bx = i * 44, bh = 120 + hash(i) * 200; g.fillStyle = '#141838'; g.fillRect(bx, h - bh, 40, bh); for (let r = 0; r < bh / 20; r++) for (let c = 0; c < 3; c++) if (hash(i * 7 + r, c) > 0.55) { g.fillStyle = '#ffd77a'; g.fillRect(bx + 5 + c * 12, h - bh + 8 + r * 20, 7, 10); } } g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(420, 70, 26, 0, 7); g.fill(); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.0), BASIC(0xffffff, { map: city })), -0.6, 2.1, -2.97);
  const fm = goldMat;
  [[0, 1.03, 2.9, 0.08], [0, -1.03, 2.9, 0.08]].forEach(([x, y, w, h]) => add(S, mesh(BOX(w, h, 0.06), fm), -0.6 + x, 2.1 + y, -2.95));
  [[-1.43], [1.43], [0]].forEach(([x]) => add(S, mesh(BOX(0.06, 2.1, 0.06), fm), -0.6 + x, 2.1, -2.95));
  // painting
  const art = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#f2e6c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8a03a'; g.beginPath(); g.arc(128, 130, 60, 0, 7); g.fill(); g.fillStyle = '#3a6a9a'; g.fillRect(0, 210, w, 110); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), M(0xffffff, { map: art })), 2.4, 2.0, -2.97);
  add(S, mesh(BOX(0.92, 1.12, 0.05), goldMat), 2.4, 2.0, -2.99);
  // table
  const T = new THREE.Group(); S.add(T);
  add(T, mesh(CYL(0.62, 0.62, 0.04, 32), M(0xffffff, { r: 0.7 })), 0, 0.76, 0);
  add(T, mesh(CYL(0.63, 0.66, 0.42, 32, 1, true), M(0xf6f6f6, { r: 0.8, side: THREE.DoubleSide })), 0, 0.56, 0);
  add(T, mesh(CYL(0.05, 0.05, 0.4, 8), M(0x222222)), 0, 0.2, 0);
  for (const s of [-1, 1]) {
    const ch = new THREE.Group(); ch.position.set(s * 0.95, 0, 0); ch.rotation.y = -s * PI / 2; S.add(ch);
    add(ch, mesh(RB(0.48, 0.06, 0.46, 0.02), M(0x7a2a1a)), 0, 0.46, 0);
    add(ch, mesh(RB(0.48, 0.6, 0.06, 0.03), M(0x7a2a1a)), 0, 0.8, -0.22);
    for (const [dx, dz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) add(ch, mesh(CYL(0.02, 0.02, 0.46, 6), M(0x3a1a10)), dx, 0.23, dz);
  }
  // candle
  add(S, mesh(CYL(0.035, 0.035, 0.18, 12), M(0xfff6e0)), 0.0, 0.87, 0.25);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), BASIC(0xffc040)); flame.position.set(0.0, 1.0, 0.25); S.add(flame); S.userData.flame = flame;
  for (const s of [-1, 1]) {
    add(S, mesh(CYL(0.15, 0.13, 0.02, 20), M(0xffffff, { r: 0.3 })), s * 0.38, 0.79, 0);
    const gl = new THREE.Group(); gl.position.set(s * 0.32, 0.78, 0.3); S.add(gl);
    add(gl, mesh(CYL(0.035, 0.02, 0.08, 12), M(0xdff0ff, { t: true, op: 0.35, r: 0.05 })), 0, 0.16, 0);
    add(gl, mesh(CYL(0.025, 0.025, 0.04, 12), M(0x8a1020)), 0, 0.15, 0);
    add(gl, mesh(CYL(0.006, 0.006, 0.1, 6), M(0xdff0ff, { t: true, op: 0.4 })), 0, 0.07, 0);
  }
  // pendant lamp
  add(S, mesh(CYL(0.01, 0.01, 1.3, 6), M(0x222222)), 0, 3.4, 0);
  add(S, mesh(new THREE.ConeGeometry(0.28, 0.25, 20, 1, true), M(0x1a1a1a, { side: THREE.DoubleSide })), 0, 2.65, 0);
  add(S, new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), BASIC(0xffe6b0)), 0, 2.56, 0);
  // plant
  const pl = new THREE.Group(); pl.position.set(-3.2, 0, -2.4); S.add(pl);
  add(pl, mesh(CYL(0.25, 0.2, 0.5, 14), M(0x8a5a3a)), 0, 0.25, 0);
  for (let i = 0; i < 7; i++) add(pl, mesh(new THREE.IcosahedronGeometry(0.25, 0), M(0x3f8f46, { flat: true })), Math.cos(i) * 0.2, 0.7 + hash(i) * 0.6, Math.sin(i) * 0.2);
}

// ---------------- mansion (day / night)
const mansionWinMats = [];
let mansionGroup;
{
  const S = newSet('mansion');
  const grass = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#6cc04a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 2500; k++) { g.fillStyle = hash(k, 1) > .5 ? '#5aad3c' : '#7fd25a'; g.fillRect(hash(k, 2) * w, hash(k, 3) * h, 3, 7); } }, [14, 14]);
  add(S, mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), false, true), 0, 0, 0, -PI / 2);
  add(S, mesh(new THREE.PlaneGeometry(2.2, 9), M(0xe6dccb), false, true), 0, 0.005, 0.2, -PI / 2);
  add(S, mesh(new THREE.PlaneGeometry(30, 4), M(0x45484e), false, true), 0, 0.006, 3.3, -PI / 2);
  const m = new THREE.Group(); m.position.set(0, 0, -7.6); S.add(m); mansionGroup = m;
  const white = M(0xf7f3ea, { r: 0.8 });
  add(m, mesh(BOX(11, 5, 5), white), 0, 2.5, 0);
  for (const s of [-1, 1]) add(m, mesh(BOX(3.2, 3.8, 4.2), white), s * 7, 1.9, 0.3);
  const roof = mesh(new THREE.ConeGeometry(7.6, 2.4, 4), M(0x3c4a5e, { r: 0.7, flat: true })); roof.rotation.y = PI / 4; roof.scale.set(1.06, 1, 0.5); add(m, roof, 0, 6.2, 0);
  for (const s of [-1, 1]) { const r2 = mesh(new THREE.ConeGeometry(2.6, 1.2, 4), M(0x3c4a5e, { flat: true })); r2.rotation.y = PI / 4; r2.scale.set(0.95, 1, 0.85); add(m, r2, s * 7, 4.4, 0.3); }
  for (const x of [-2.4, -0.8, 0.8, 2.4]) add(m, mesh(CYL(0.25, 0.28, 4.2, 16), white), x, 2.1, 3.0);
  add(m, mesh(BOX(6.0, 0.4, 1.4), white), 0, 4.4, 2.9);
  const ped = mesh(new THREE.ConeGeometry(3.4, 1.2, 3), white); ped.rotation.set(0, 0, 0); ped.scale.set(1, 1, 0.15); add(m, ped, 0, 5.0, 3.1, 0, PI / 2 + PI / 6);
  add(m, mesh(BOX(1.4, 2.6, 0.12), M(0x5a3420, { r: 0.6 })), 0, 1.3, 2.52);
  add(m, mesh(CYL(0.05, 0.05, 0.05, 10), goldMat), 0.45, 1.3, 2.6, PI / 2);
  for (let i = 0; i < 3; i++) add(m, mesh(BOX(4.6 - i * 0.3, 0.15, 0.9 - i * 0.25), M(0xe0dcd0)), 0, 0.075 + i * 0.15, 3.6 - i * 0.1);
  const winGeo = new THREE.PlaneGeometry(0.9, 1.3);
  for (const row of [1.6, 3.8]) for (const x of [-4.4, -3.0, 3.0, 4.4, -7.4, -6.6, 6.6, 7.4]) {
    if (row === 3.8 && Math.abs(x) > 6) continue;
    const wm = M(0x8fc4ee, { r: 0.15, m: 0.3, e: 0x000000 }); mansionWinMats.push(wm);
    add(m, new THREE.Mesh(winGeo, wm), x, row, Math.abs(x) > 6 ? 2.42 : 2.52);
    add(m, mesh(BOX(1.05, 0.08, 0.1), white), x, row + 0.7, Math.abs(x) > 6 ? 2.45 : 2.55);
  }
  // hedges, trees, fountain
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) add(S, mesh(RB(1.3, 0.8, 0.8, 0.3), M(0x2f8a3a, { r: 0.9 })), s * (2.0 + i * 1.4), 0.4, -4.0);
  const tree = (x, z, sc = 1) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc); S.add(g); add(g, mesh(CYL(0.15, 0.2, 1.6, 8), M(0x6b4a2a)), 0, 0.8, 0); add(g, mesh(new THREE.IcosahedronGeometry(1.1, 1), M(0x3e9a46, { flat: true })), 0, 2.3, 0); add(g, mesh(new THREE.IcosahedronGeometry(0.8, 1), M(0x4aae50, { flat: true })), 0.5, 2.9, 0.2); };
  tree(-6.5, -2.5, 1.2); tree(6.8, -2.0, 1.1); tree(-9, 1, 1.3); tree(9.5, 0.5, 1.2);
  // moon + stars (night)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), BASIC(0xfff6d6)); moon.position.set(-9, 13, -25); S.add(moon); S.userData.moon = moon;
  const starGeo = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 300; i++) sp.push((hash(i, 1) - 0.5) * 80, 6 + hash(i, 2) * 30, -28 - hash(i, 3) * 5);
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })); S.add(stars); S.userData.stars = stars;
  // distant hills
  for (let i = 0; i < 6; i++) add(S, mesh(new THREE.IcosahedronGeometry(8 + hash(i) * 5, 1), M(0x7fbf6a, { flat: true }), false, false), (i - 2.5) * 14, -4, -32);
}

// ---------------- living room (night)
{
  const S = newSet('living');
  add(S, mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: woodTex([170, 120, 80], 'rgba(80,50,30,0.5)', [4, 4]), roughness: 0.6 }), false, true), 0, 0, 0, -PI / 2);
  const wall = M(0xe9dcc6, { r: 0.95 });
  add(S, mesh(new THREE.PlaneGeometry(10, 4), wall, false, true), 0, 2, -2.6);
  add(S, mesh(new THREE.PlaneGeometry(10, 4), wall, false, true), -3.5, 2, 0, 0, PI / 2);
  add(S, mesh(new THREE.PlaneGeometry(10, 4), wall, false, true), 3.5, 2, 0, 0, -PI / 2);
  add(S, mesh(new THREE.PlaneGeometry(10, 4), wall, false, true), 0, 2, 4.5, 0, PI);
  const rug = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8a3a4a'; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill(); g.strokeStyle = '#e8c070'; g.lineWidth = 14; for (const r of [200, 140, 80]) { g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); } });
  const rm = new THREE.MeshStandardMaterial({ map: rug, transparent: true, roughness: 1 }); rug.colorSpace = THREE.SRGBColorSpace;
  add(S, new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), rm), 0, 0.006, 0.6, -PI / 2);
  // couch at z=-0.6 facing +z
  const C = new THREE.Group(); C.position.set(0, 0, -0.75); S.add(C);
  const cm = M(0x2f8f8a, { r: 0.9 });
  add(C, mesh(RB(2.2, 0.42, 0.9, 0.1), cm), 0, 0.24, 0);
  add(C, mesh(RB(2.2, 0.75, 0.25, 0.1), cm), 0, 0.72, -0.36);
  for (const s of [-1, 1]) { add(C, mesh(RB(0.25, 0.6, 0.9, 0.1), cm), s * 1.1, 0.42, 0); add(C, mesh(RB(0.95, 0.14, 0.75, 0.06), M(0x37a39d)), s * 0.5, 0.5, 0.05); }
  add(C, mesh(RB(0.36, 0.36, 0.12, 0.08), M(0xffc85a)), -0.75, 0.75, -0.18, 0.2, 0, 0.2);
  // coffee table, TV wall, lamp, window, frames
  add(S, mesh(RB(1.2, 0.06, 0.6, 0.02), M(0x6b4a2a)), 0, 0.42, 0.75);
  for (const [x, z] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, 1.0], [0.5, 1.0]]) add(S, mesh(CYL(0.025, 0.025, 0.4, 6), M(0x3a2a1a)), x, 0.2, z);
  const lampG = new THREE.Group(); lampG.position.set(1.6, 0, -1.6); S.add(lampG);
  add(lampG, mesh(CYL(0.15, 0.18, 0.04, 14), M(0x222222)), 0, 0.02, 0);
  add(lampG, mesh(CYL(0.02, 0.02, 1.5, 8), M(0x222222)), 0, 0.77, 0);
  add(lampG, mesh(CYL(0.22, 0.3, 0.35, 16, 1, true), M(0xfff0d0, { e: 0xffb060, ei: 0.8, side: THREE.DoubleSide })), 0, 1.6, 0);
  const night = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#16204a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(180, 70, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(hash(i) * w, hash(i, 2) * h * 0.7, 2, 2); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.5), BASIC(0xffffff, { map: night })), -1.3, 1.9, -2.58);
  [[0, 0.78, 1.55, 0.08], [0, -0.78, 1.55, 0.08], [0, 0, 1.5, 0.05]].forEach(([dx, dy, w, h]) => add(S, mesh(BOX(w, h, 0.06), M(0xffffff)), -1.3 + dx, 1.9 + dy, -2.56));
  [[-0.78], [0.78], [0]].forEach(([dx]) => add(S, mesh(BOX(0.06, 1.6, 0.06), M(0xffffff)), -1.3 + dx, 1.9, -2.56));
  const fam = canvasTex(256, 200, (g, w, h) => { g.fillStyle = '#ffe9c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#22335e'; g.fillRect(40, 70, 40, 90); g.fillStyle = '#ff4f9a'; g.fillRect(110, 70, 40, 90); g.fillStyle = '#e84a3c'; g.fillRect(170, 110, 22, 50); g.fillStyle = '#f1c9a5'; [[60, 50, 18], [130, 50, 18], [181, 95, 12]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), M(0xffffff, { map: fam })), 1.2, 1.9, -2.58);
  add(S, mesh(BOX(0.8, 0.65, 0.04), goldMat), 1.2, 1.9, -2.6);
  const pl = new THREE.Group(); pl.position.set(-2.6, 0, -1.9); S.add(pl);
  add(pl, mesh(CYL(0.22, 0.18, 0.45, 14), M(0xd8d0c0)), 0, 0.22, 0);
  for (let i = 0; i < 6; i++) add(pl, mesh(new THREE.IcosahedronGeometry(0.22, 0), M(0x3f8f46, { flat: true })), Math.cos(i) * 0.15, 0.65 + hash(i) * 0.5, Math.sin(i) * 0.15);
}

// ---------------- bedroom + hallway (night)
const door = new THREE.Group();
const hallFrame = new THREE.Group();
{
  const S = newSet('bed');
  const fl = new THREE.MeshStandardMaterial({ map: woodTex([150, 100, 70], 'rgba(60,40,25,0.5)', [4, 4]), roughness: 0.6 });
  add(S, mesh(new THREE.PlaneGeometry(14, 14), fl, false, true), 0, 0, 2, -PI / 2);
  const wall = M(0xd9c8ea, { r: 0.95 }), hw = M(0xbfb3a0, { r: 0.95 });
  add(S, mesh(BOX(7, 3.2, 0.1), wall), 0, 1.6, -2.55);
  add(S, mesh(BOX(0.1, 3.2, 5.2), wall), -3.0, 1.6, 0);
  add(S, mesh(BOX(0.1, 3.2, 5.2), wall), 3.0, 1.6, 0);
  // front wall z=2.55 with a door opening at x=0.9 (w 0.95, h 2.1)
  add(S, mesh(BOX(3.43, 3.2, 0.1), [wall, wall, wall, wall, hw, wall]), -1.29, 1.6, 2.55);
  add(S, mesh(BOX(1.62, 3.2, 0.1), [wall, wall, wall, wall, hw, wall]), 2.19, 1.6, 2.55);
  add(S, mesh(BOX(0.95, 1.1, 0.1), [wall, wall, wall, wall, hw, wall]), 0.9, 2.65, 2.55);
  // door (hinge at x=0.425)
  door.position.set(0.425, 0, 2.55); S.add(door);
  add(door, mesh(RB(0.92, 2.06, 0.05, 0.015), M(0xf4efe6, { r: 0.6 })), 0.47, 1.06, 0);
  add(door, mesh(new THREE.SphereGeometry(0.035, 10, 8), goldMat), 0.85, 1.0, 0.04);
  add(door, mesh(new THREE.SphereGeometry(0.035, 10, 8), goldMat), 0.85, 1.0, -0.04);
  for (const y of [0.55, 1.55]) add(door, mesh(RB(0.65, 0.7, 0.02, 0.01), M(0xece6da)), 0.47, y, 0.03);
  const under = new THREE.Mesh(BOX(0.9, 0.02, 0.02), BASIC(0xffc070)); under.position.set(0.9, 0.012, 2.61); S.add(under); S.userData.under = under;
  // hallway
  add(S, mesh(BOX(0.1, 3.2, 5.0), hw), -0.45, 1.6, 5.1);
  add(S, mesh(BOX(0.1, 3.2, 5.0), hw), 2.25, 1.6, 5.1);
  hallFrame.position.set(2.19, 1.65, 3.9); hallFrame.rotation.y = -PI / 2; S.add(hallFrame);
  const ft = canvasTex(256, 200, (g, w, h) => { g.fillStyle = '#ffe9c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4f9a'; g.font = '120px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('♥', w / 2, 150); });
  add(hallFrame, mesh(BOX(0.62, 0.5, 0.04), goldMat), 0, 0, -0.01);
  add(hallFrame, new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.4), M(0xffffff, { map: ft })), 0, 0, 0.012);
  // bed (head at z=-2.45)
  const B = new THREE.Group(); B.position.set(0, 0, -1.3); S.add(B);
  const wood = M(0x6b3e22, { r: 0.6 });
  add(B, mesh(RB(1.8, 0.32, 2.3, 0.05), wood), 0, 0.2, 0);
  add(B, mesh(RB(1.7, 0.26, 2.2, 0.08), M(0xffffff, { r: 0.9 })), 0, 0.48, 0);
  add(B, mesh(RB(1.9, 1.2, 0.12, 0.05), wood), 0, 0.85, -1.17);
  for (const s of [-1, 1]) add(B, mesh(RB(0.62, 0.16, 0.38, 0.08), M(0xfafafa)), s * 0.42, 0.68, -0.88);
  const blanket = mesh(RB(1.76, 0.07, 1.2, 0.03), M(0x8a2a4a, { r: 0.9 })); blanket.position.set(0, 0.63, 0.52); B.add(blanket); S.userData.blanket = blanket;
  // nightstands + lamps
  for (const s of [-1, 1]) {
    const N = new THREE.Group(); N.position.set(s * 1.35, 0, -2.15); S.add(N);
    add(N, mesh(RB(0.55, 0.6, 0.45, 0.03), wood), 0, 0.3, 0);
    add(N, mesh(CYL(0.07, 0.09, 0.3, 12), M(0xe8d8c0)), 0, 0.75, 0);
    add(N, mesh(CYL(0.14, 0.2, 0.25, 16, 1, true), M(0xfff0d0, { e: 0xffb060, ei: 0.9, side: THREE.DoubleSide })), 0, 1.0, 0);
  }
  const night = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#16204a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(80, 80, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(hash(i, 4) * w, hash(i, 5) * h * 0.7, 2, 2); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), BASIC(0xffffff, { map: night })), -2.94, 1.8, -0.4, 0, PI / 2);
  add(S, mesh(BOX(0.06, 1.55, 1.35), M(0xffffff)), -2.93, 1.8, -0.4);
  const heartArt = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff4f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4f7b'; g.font = '170px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('♥', w / 2, 190); });
  add(S, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), M(0xffffff, { map: heartArt })), 0, 2.15, -2.49);
  add(S, mesh(BOX(0.7, 0.7, 0.04), goldMat), 0, 2.15, -2.5);
}

// ===========================================================================
// timeline data & captions
// ===========================================================================
let WORDS = [], CHUNKS = [];
function buildChunks() {
  const ws = [];
  for (const w of WORDS) { let t = w.w; if (t.startsWith('-') && ws.length) { ws[ws.length - 1].w += t; ws[ws.length - 1].e = w.e; continue; } ws.push({ w: t, s: w.s, e: w.e }); }
  ws.forEach(w => { w.end = /[.,?!]$/.test(w.w); w.w = w.w.replace(/[.,]/g, '').toUpperCase(); });
  const chunks = []; let cur = [];
  ws.forEach((w, i) => {
    cur.push(w);
    const txt = cur.map(x => x.w).join(' '); const next = ws[i + 1];
    if (w.end || cur.length >= 3 || txt.length > 13 || (next && next.s - w.e > 0.45) || (next && (txt + ' ' + next.w).length > 17)) { chunks.push(cur); cur = []; }
  });
  if (cur.length) chunks.push(cur);
  chunks.forEach((c, i) => { c.s = c[0].s - 0.04; const nx = chunks[i + 1]; c.e = nx && nx[0].s - c[c.length - 1].e < 0.7 ? nx[0].s - 0.04 : c[c.length - 1].e + 0.3; });
  CHUNKS = chunks;
}

const SFX = [
  { s: '$$$', T: 0.3, d: 1.2, x: 0.5, y: 0.15, rot: -0.08, size: 170, fill: '#5BE36B' },
  { s: 'BA-DUM!', T: 6.38, d: 0.42, x: 0.36, y: 0.17, rot: -0.12, size: 150, fill: '#FF3B5C', stroke: '#FFFFFF' },
  { s: 'BA-DUM!', T: 6.82, d: 0.55, x: 0.64, y: 0.25, rot: 0.1, size: 175, fill: '#FF3B5C', stroke: '#FFFFFF' },
  { s: 'TING!', T: 9.05, d: 0.8, x: 0.68, y: 0.2, rot: 0.1, size: 130, fill: '#FFE14D' },
  { s: 'KA-CHING!', T: 12.2, d: 1.1, x: 0.5, y: 0.16, rot: -0.07, size: 160, fill: '#5BE36B', shake: 0.5 },
  { s: 'CHOMP!', T: 18.05, d: 0.4, x: 0.32, y: 0.17, rot: -0.15, size: 135, fill: '#FFFFFF' },
  { s: 'CHOMP!', T: 18.45, d: 0.4, x: 0.68, y: 0.22, rot: 0.13, size: 145, fill: '#FFFFFF' },
  { s: 'CHOMP!', T: 18.85, d: 0.6, x: 0.5, y: 0.14, rot: -0.05, size: 165, fill: '#FFD21F' },
  { s: 'TA-DA!', T: 20.15, d: 0.75, x: 0.5, y: 0.13, rot: -0.06, size: 160, fill: '#FFD21F' },
  { s: 'VROOM!', T: 20.9, d: 0.8, x: 0.5, y: 0.16, rot: 0.07, size: 170, fill: '#FFB21A', shake: 1 },
  { s: 'YIP!', T: 22.55, d: 0.6, x: 0.68, y: 0.2, rot: 0.15, size: 150, fill: '#FF8FC8' },
  { s: 'POP!', T: 24.24, d: 0.4, x: 0.25, y: 0.2, rot: -0.15, size: 120, fill: '#FFFFFF' },
  { s: 'POP!', T: 24.38, d: 0.4, x: 0.5, y: 0.15, rot: 0.05, size: 130, fill: '#FFFFFF' },
  { s: 'POP!', T: 24.52, d: 0.5, x: 0.75, y: 0.2, rot: 0.15, size: 140, fill: '#FFFFFF' },
  { s: 'GASP!', T: 31.05, d: 0.9, x: 0.5, y: 0.14, rot: -0.06, size: 210, fill: '#FFD21F', slam: 1 },
  { s: 'SQUEAK', T: 37.55, d: 0.45, x: 0.3, y: 0.15, rot: -0.15, size: 120, fill: '#FFFFFF' },
  { s: 'SQUEAK', T: 38.05, d: 0.45, x: 0.7, y: 0.22, rot: 0.15, size: 120, fill: '#FFFFFF' },
  { s: 'SQUEAK', T: 38.55, d: 0.4, x: 0.35, y: 0.27, rot: -0.1, size: 120, fill: '#FFFFFF' },
  { s: 'SCRRRATCH!', T: 41.55, d: 1.0, x: 0.5, y: 0.17, rot: -0.08, size: 140, fill: '#FF3B30', stroke: '#FFFFFF', shake: 0.6 },
  { s: 'PUMP!', T: 43.3, d: 0.4, x: 0.3, y: 0.18, rot: -0.12, size: 125, fill: '#FFFFFF' },
  { s: 'PUMP!', T: 43.85, d: 0.4, x: 0.7, y: 0.22, rot: 0.12, size: 125, fill: '#FFFFFF' },
  { s: 'PUMP!', T: 44.4, d: 0.45, x: 0.5, y: 0.14, rot: -0.04, size: 140, fill: '#FFFFFF' },
];

// ===========================================================================
// helpers
// ===========================================================================
function headWorld(c, off = V(0, 0, 0)) { c.root.updateMatrixWorld(true); return c.head.localToWorld(off.clone()); }
const partWorld = (obj, off = V(0, 0, 0)) => { obj.updateMatrixWorld(true); return obj.localToWorld(off.clone()); };
const _tv = new THREE.Vector3();
function project(v) { _tv.copy(v).project(camera); return { x: (_tv.x + 1) / 2 * W, y: (1 - _tv.y) / 2 * H, z: _tv.z }; }
function camLook(pos, target, fov = 40, roll = 0) { camera.up.set(0, 1, 0); camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(target); if (roll) camera.rotateZ(roll); }
function bodyDir(c) { return V(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y)); }
function faceCam(c, dist, yawOff = 0, up = 0, tdy = -0.12, fov = 40, roll = 0) {
  const hw = headWorld(c); const d = bodyDir(c).applyAxisAngle(V(0, 1, 0), yawOff);
  camLook(hw.clone().addScaledVector(d, dist).add(V(0, up, 0)), hw.clone().add(V(0, tdy, 0)), fov, roll);
}
let SHAKE = 0;
let O = {};   // per-frame overlay info

function hideAll() {
  for (const k in sets) sets[k].visible = false;
  for (const c of ALLCHARS) { c.root.visible = false; setFace(c, {}); c.root.scale.setScalar(1); }
  for (const k of PROPLIST) { props[k].visible = false; props[k].scale.setScalar(1); }
  bills.forEach(b => b.visible = false); hearts.forEach(h => h.visible = false); puffs.forEach(p => p.visible = false); crumbs.forEach(c => c.visible = false); foods.forEach(f => f.visible = false);
  oldMan.cap.visible = true;
  if (oldMan.glasses) oldMan.glasses.position.y = 0;
  mansionGroup.scale.set(1, 1, 1); mansionGroup.position.x = 0;
  door.rotation.y = 0; door.position.x = 0.425; hallFrame.rotation.z = 0;
}

function placeHearts(T, from, spread = 0.3, n = 6, rise = 0.7, hs = 0.07) {
  for (let i = 0; i < n; i++) {
    const h = hearts[i]; const ph = (T * 0.9 + i / n) % 1; h.visible = true;
    const a = hash(i, 7) * PI * 2;
    h.position.set(from.x + Math.cos(a) * spread * (0.3 + ph), from.y + 0.15 + ph * rise, from.z + Math.sin(a) * spread * (0.3 + ph));
    h.scale.setScalar(Math.max(0.001, Math.sin(ph * PI) * hs));
    h.lookAt(camera.position); h.rotateZ(Math.sin(T * 5 + i) * 0.3);
  }
}
function moneyRain(T, center, area = 2.2, n = 40, h = 3.2) {
  for (let i = 0; i < n; i++) {
    const b = bills[i]; b.visible = true;
    const ph = (T * 0.32 + hash(i, 3)) % 1;
    b.position.set(center.x + (hash(i, 1) - 0.5) * area + Math.sin(T * 2 + i) * 0.15, center.y + h * (1 - ph), center.z + (hash(i, 2) - 0.5) * area * 0.6);
    b.rotation.set(T * (1 + hash(i, 4) * 2) + i, T * 1.3 + i * 2, Math.sin(T * 3 + i) * 0.8);
  }
}
function billSpray(T, from, to, t0, n = 30) {
  for (let i = 0; i < n; i++) {
    const b = bills[i];
    const life = 0.55; const st = t0 + hash(i, 9) * 1.2; const ph = (T - st) / life;
    if (ph < 0 || ph > 1) { b.visible = false; continue; }
    b.visible = true;
    const tgt = to[i % to.length];
    const p = from.clone().lerp(tgt, ph); p.y += Math.sin(ph * PI) * 0.6 + (hash(i, 5) - 0.5) * 0.2; p.x += (hash(i, 6) - 0.5) * 0.25;
    b.position.copy(p); b.rotation.set(T * 9 + i, T * 7, i);
  }
}
function puffAt(T, origin, t0, dur = 0.8, n = 10, size = 1, col = 0xdddddd) {
  const k = prog(T, t0, t0 + dur); if (k <= 0 || k >= 1) return;
  for (let i = 0; i < n; i++) { const p = puffs[i]; p.visible = true; p.material.color.set(col); const a = i / n * PI * 2; p.position.set(origin.x + Math.cos(a) * (0.2 + k * 0.8) * size, origin.y + k * 0.4 * size * hash(i), origin.z + Math.sin(a) * (0.2 + k * 0.6) * size); p.scale.setScalar((0.6 + k * 1.4) * size); p.material.opacity = 0.6 * (1 - k); }
}
const SIT_CHAIR = { hipRx: PI / 2, hipLx: PI / 2, knR: PI / 2 - 0.05, knL: PI / 2 - 0.05, pelY: 0.55 };
const LIE = { rx: -PI / 2, hdLift: 0.075, shRz: 0.12, shLz: 0.12, hipRz: 0.06, hipLz: 0.06 };

// ===========================================================================
// shots (T = original voiceover seconds)
// ===========================================================================
const SW = 0.12;
const GIRL_ST = V(-1.65, SW, -1.75);    // girl sitting spot on the street
function girlSitting(c, T, o = {}) {
  applyPose(c, P(Object.assign({ x: GIRL_ST.x, z: GIRL_ST.z, ry: 0.25, hipRx: 1.35, hipLx: 1.25, knR: 2.3, knL: 2.2, hipRz: 0.15, hipLz: 0.12, spX: 0.15, shRx: 0.8, shLx: 0.75, elR: 0.9, elL: 0.95, shRz: -0.05, shLz: -0.05, hdX: -0.15 }, o)));
  ground(c, SW + 0.02);
}
function streetProps() {
  sets.street.visible = true;
  props.cardboard.visible = true; props.cardboard.position.set(GIRL_ST.x, SW, GIRL_ST.z + 0.1); props.cardboard.rotation.y = 0.1;
  props.cup.visible = true; props.cup.position.set(GIRL_ST.x + 0.45, SW + 0.02, GIRL_ST.z + 0.55);
  props.sign.visible = true; props.sign.position.set(GIRL_ST.x - 0.55, SW + 0.2, GIRL_ST.z + 0.35); props.sign.rotation.set(-0.25, 0.35, 0);
}

function shot(T) {
  hideAll(); SHAKE = 0; O = {};
  let flash = 0;
  // ------------------------------------------------ S1 rich old man (money rain)
  if (T < 3.5) {
    lighting('day'); streetProps();
    const k = prog(T, 0, 3.5);
    const fan = Math.sin(T * 9) * 0.25;
    applyPose(oldMan, P({ x: 0.8, z: 0.75, ry: PI + 0.1, spX: 0.06, hdX: -0.1, hdZ: 0.05, shRx: 1.25, shRz: 0.35 + fan * 0.3, elR: 1.6 + fan, shRy: 0.5, shLx: 0.3, shLz: 0.15, elL: 0.6 }));
    ground(oldMan, SW);
    setFace(oldMan, { eyes: 'half', mouth: 'smirk', brow: -0.2, browY: 0.3 });
    props.wad.visible = true; props.wad.position.copy(partWorld(oldMan.hand.R, V(0, -0.04, 0.04))); props.wad.rotation.set(0.2, 0, 0.3 + fan);
    props.limo.visible = true; props.limo.position.set(1.4, 0, 3.4); props.limo.rotation.y = PI / 2;
    girlSitting(girlHome, T);
    const hw = headWorld(oldMan);
    moneyRain(T, V(0.8, SW, 0.75), 2.4, 44, 3.0);
    camLook(V(lerp(0.3, 0.4, k), 1.45, lerp(-2.05, -1.8, eIO(k))), V(0.85, lerp(1.4, 1.48, k), 0.8), 46, 0.02);
  }
  // ------------------------------------------------ S2a walking past the girl
  else if (T < 5.08) {
    lighting('day'); streetProps();
    const k = prog(T, 3.5, 5.08);
    const x = lerp(2.4, 0.35, eOut(clamp(k * 1.15)));
    const p = walk(P({ x, z: -0.35, ry: -PI / 2, spX: 0.08 }), T * 9, 1 - eIn(clamp((k - 0.6) / 0.4)));
    p.hdY = -lerp(0, 0.9, prog(T, 4.2, 4.7)); p.shRx = 0.25; p.elR = 0.4;
    applyPose(oldMan, p); ground(oldMan, SW); oldMan.root.position.y += p.y;
    setFace(oldMan, { eyes: 'open', mouth: 'line', brow: 0 });
    props.cane.visible = true; props.cane.position.copy(partWorld(oldMan.hand.R, V(0, 0.02, 0.02))); props.cane.rotation.set(0, PI / 2, 0.15 + Math.sin(T * 9) * 0.2);
    girlSitting(girlHome, T, { hdX: -0.05 });
    setFace(girlHome, { eyes: hash(Math.floor(T * 3)) > 0.9 ? 'closed' : 'half', mouth: 'line', brow: -0.2 });
    camLook(V(lerp(0.4, 0.0, k), 1.35, 3.6), V(lerp(0.0, -0.5, k), 0.85, -1.0), 42);
  }
  // ------------------------------------------------ S2b old man face: heart eyes
  else if (T < 6.32) {
    lighting('day'); streetProps();
    const k = prog(T, 5.08, 6.32);
    applyPose(oldMan, P({ x: 0.35, z: -0.35, ry: -2.25, spX: 0.05, hdX: 0.18, shRx: 0.25, elR: 0.4 }));
    ground(oldMan, SW);
    const pop = T > 5.45;
    setFace(oldMan, { eyes: pop ? 'heart' : 'wide', eyeScale: pop ? 1.1 + Math.sin(T * 14) * 0.2 : 1, mouth: pop ? 'smile' : 'o', mouthScale: 0.8, brow: -0.3, browY: 0.6, blush: pop ? 0.8 : 0 });
    if (oldMan.glasses) oldMan.glasses.position.y = pop ? 0.05 + Math.abs(Math.sin(T * 14)) * 0.03 : 0;
    props.cane.visible = true; props.cane.position.copy(partWorld(oldMan.hand.R, V(0, 0.02, 0.02))); props.cane.rotation.set(0, 0, 0.1);
    girlSitting(girlHome, T);
    faceCam(oldMan, lerp(1.35, 1.1, eIO(k)), 0.15, 0.0, -0.12, 40, 0.03);
    if (pop) placeHearts(T, headWorld(oldMan).add(V(0, 0.15, 0)), 0.3, 6, 0.6, 0.06);
  }
  // ------------------------------------------------ S3 BA-DUM heart
  else if (T < 7.38) {
    lighting('day'); streetProps();
    const k = prog(T, 6.32, 7.38);
    applyPose(oldMan, P({ x: 0.35, z: -0.35, ry: -2.25, spX: -0.1, hdX: -0.15, shRx: 0.9, shRz: -0.25, elR: 1.5, shLx: 0.3, shLz: 0.25 }));
    ground(oldMan, SW);
    setFace(oldMan, { eyes: 'heart', eyeScale: 1.25, mouth: 'open', brow: -0.3, browY: 0.8, blush: 1 });
    const beat = Math.max(Math.exp(-Math.pow((T - 6.42) / 0.06, 2)), Math.exp(-Math.pow((T - 6.86) / 0.07, 2)));
    const chest = partWorld(oldMan.spine, V(0.08, 0.42, 0.18));
    const fwd = bodyDir(oldMan);
    props.bigHeart.visible = true;
    props.bigHeart.position.copy(chest).addScaledVector(fwd, 0.08 + beat * 0.18);
    props.bigHeart.lookAt(props.bigHeart.position.clone().add(fwd));
    props.bigHeart.scale.setScalar(0.1 + beat * 0.08);
    girlSitting(girlHome, T);
    faceCam(oldMan, lerp(2.1, 1.9, k), 0.15, -0.1, -0.3, 44, 0);
    SHAKE = beat * 0.03;
    O.impact = { at: props.bigHeart.position.clone(), a: beat };
  }
  // ------------------------------------------------ S4 she's 24
  else if (T < 8.9) {
    lighting('day'); streetProps();
    const k = prog(T, 7.38, 8.9);
    girlSitting(girlHome, T, { hdX: -0.32, hdZ: 0.12, ry: 0.55 });
    setFace(girlHome, { eyes: T > 8.3 && T < 8.42 ? 'closed' : 'open', eyeScale: 1.1, mouth: 'smile', brow: -0.3, browY: 0.5, blush: 0.4 });
    faceCam(girlHome, lerp(1.25, 1.0, eIO(k)), 0.1, 0.25, -0.05, 40, -0.03);
    O.sparkle = [{ at: headWorld(girlHome, V(0.2, 0.2, 0.2)), T0: 7.6 }, { at: headWorld(girlHome, V(-0.22, 0.05, 0.2)), T0: 8.0 }];
  }
  // ------------------------------------------------ S5a the Rolex
  else if (T < 9.95) {
    lighting('day'); streetProps();
    const k = prog(T, 8.9, 9.95);
    applyPose(oldMan, P({ x: 0.35, z: -0.35, ry: -2.25, shLx: 1.3, shLz: -0.45, elL: 1.2, shLy: 0.2, hdX: 0.25 }));
    ground(oldMan, SW);
    setFace(oldMan, { eyes: 'half', mouth: 'smirk' });
    girlSitting(girlHome, T);
    const wp = partWorld(oldMan.watch, V(0.01, 0, 0));
    const dz = lerp(0.55, 0.42, eOut(k));
    camLook(wp.clone().add(V(0.3 * dz, 0.18 * dz, dz)), wp.clone().add(V(0, -0.02, 0)), 34, 0.08);
    O.sparkle = [{ at: wp.clone().add(V(0.02, 0.03, 0.06)), T0: 9.0, big: 1 }, { at: wp.clone().add(V(-0.04, 0.05, 0.05)), T0: 9.4 }];
  }
  // ------------------------------------------------ S5b/S6 dollar eyes + grandpa's rich
  else if (T < 13.72) {
    lighting('day'); streetProps();
    const k = prog(T, 9.95, 13.72);
    const rub = T > 11.0 ? Math.sin(T * 22) * 0.12 : 0;
    const dollar = T > 10.12;
    girlSitting(girlHome, T, { ry: 0.55, hdX: -0.25, shRx: 1.15, shLx: 1.15, shRy: 0.9, shLy: 0.9, elR: 1.25 + rub, elL: 1.25 - rub, shRz: 0.1, shLz: 0.1, spX: 0.05 });
    const ping = dollar ? eBack(prog(T, 10.12, 10.3)) : 1;
    setFace(girlHome, { eyes: dollar ? 'dollar' : 'open', eyeScale: dollar ? (0.9 + ping * 0.3 + Math.max(0, Math.sin(T * 10)) * 0.08) : 1, mouth: T > 11.0 ? (T > 11.55 && T < 12.1 ? 'open' : 'grin') : 'o', mouthScale: 0.9, brow: dollar ? 0.45 : -0.2, browY: dollar ? -0.3 : 0.5 });
    faceCam(girlHome, lerp(1.25, 0.95, eIO(k)), 0.1, 0.22, -0.08, 40, 0.03);
    if (T > 12.15) { SHAKE = 0.01 * (1 - prog(T, 12.15, 12.6)); O.coins = { T0: 12.2, at: headWorld(girlHome) }; }
  }
  // ------------------------------------------------ S7 date: orders everything
  else if (T < 17.1) {
    lighting('rest'); sets.rest.visible = true;
    const k = prog(T, 13.72, 17.1);
    applyPose(oldMan, P(Object.assign({ x: 1.05, z: 0, ry: -PI / 2, spX: 0.05, shRx: 0.6, shLx: 0.6, elR: 0.9, elL: 0.9, shRz: 0.1, shLz: 0.1 }, SIT_CHAIR)));
    applyPose(girlHome, P(Object.assign({ x: -1.05, z: 0, ry: PI / 2, spX: 0.05, shRx: 1.2 + Math.sin(T * 8) * 0.15, shLx: 1.2, elR: 1.2, elL: 1.2, shRz: 0.2, shLz: 0.2, hdZ: Math.sin(T * 4) * 0.1 }, SIT_CHAIR)));
    const shock = prog(T, 15.6, 15.9);
    setFace(oldMan, { eyes: shock > 0.5 ? 'wide' : 'open', mouth: shock > 0.5 ? 'o' : 'smile', mouthScale: 0.8, brow: -0.2, browY: 0.5 * shock });
    if (oldMan.glasses) oldMan.glasses.position.y = shock * 0.03;
    setFace(girlHome, { eyes: 'open', mouth: 'grin', brow: -0.2, browY: 0.5 });
    const stackX = -0.12; let h = 0.79;
    const times = [15.3, 15.48, 15.66, 15.84, 16.02, 16.2, 16.38, 16.56, 16.74, 16.92];
    foods.forEach((f, i) => {
      if (T < times[i]) return;
      const pop = eBack(prog(T, times[i], times[i] + 0.12));
      f.visible = true; f.scale.setScalar(Math.max(0.01, pop));
      const wob = Math.sin(T * 6 + i * 0.4) * 0.012 * i;
      f.position.set(stackX + wob, h, (i % 2 ? 0.04 : -0.04)); f.rotation.y = i * 0.7;
      h += f.userData.h * pop;
    });
    const flame = sets.rest.userData.flame; flame.scale.set(1, 1 + noise1(T * 2) * 0.15, 1);
    lampA.position.set(0, 1.05, 0.25); lampA.intensity = 1.6 + noise1(T * 3) * 0.2; lampA.distance = 4;
    lampB.position.set(0, 2.4, 0); lampB.intensity = 3.0; lampB.distance = 5; lampB.color.set(0xffd9a0);
    camLook(V(lerp(1.5, 1.35, k), lerp(1.45, 1.6, k), lerp(2.6, 2.3, k)), V(-0.15, lerp(1.0, 1.25, eIO(prog(T, 15.3, 17.0))), -0.1), 44, 0.02);
  }
  // ------------------------------------------------ S8 eats the menu
  else if (T < 19.42) {
    lighting('rest'); sets.rest.visible = true;
    const k = prog(T, 17.1, 19.42);
    const bites = [18.05, 18.45, 18.85];
    let nb = 0, chew = 0; for (const b of bites) { if (T > b) nb++; chew = Math.max(chew, Math.exp(-Math.pow((T - b) / 0.06, 2))); }
    applyPose(girlHome, P(Object.assign({ x: -1.05, z: 0, ry: PI / 2, spX: 0.1, shRx: 1.45, shLx: 1.45, elR: 1.65, elL: 1.65, shRy: 0.55, shLy: 0.55, shRz: 0.05, shLz: 0.05, hdX: 0.05 - chew * 0.12 }, SIT_CHAIR)));
    setFace(girlHome, { eyes: chew > 0.3 ? 'closed' : 'open', mouth: chew > 0.3 ? 'chomp' : 'grin', mouthScale: 1.1, brow: 0.2 });
    applyPose(oldMan, P(Object.assign({ x: 1.05, z: 0, ry: -PI / 2, shRx: 0.6, shLx: 0.6, elR: 0.9, elL: 0.9 }, SIT_CHAIR)));
    setFace(oldMan, { eyes: 'wide', mouth: 'o' });
    foods.forEach((f, i) => { f.visible = true; });
    let h = 0.79; foods.forEach((f, i) => { f.position.set(-0.12, h, i % 2 ? 0.04 : -0.04); f.scale.setScalar(1); h += f.userData.h; });
    const mouth = headWorld(girlHome, V(0, -0.1, 0.33));
    props.menu.visible = true;
    props.menu.position.copy(mouth).add(V(0.02, -0.06, 0)); props.menu.rotation.set(0, PI / 2 + 0.15, 0.1);
    props.menu.scale.set(1, Math.max(0.25, 1 - nb * 0.22), 1);
    props.menu.position.y -= nb * 0.04;
    crumbs.forEach((c, i) => {
      const b = bites[Math.min(2, Math.floor(i / 5.4))]; const ph = (T - b) / 0.6;
      if (ph < 0 || ph > 1) return; c.visible = true;
      c.position.copy(mouth).add(V(0.12 + ph * 0.3 * hash(i), 0.05 + ph * 0.25 - ph * ph * 0.6, (hash(i, 2) - 0.5) * 0.4 * ph)); c.rotation.set(T * 10 + i, T * 7, 0);
    });
    lampA.position.set(0, 1.05, 0.25); lampA.intensity = 1.6; lampA.distance = 4;
    lampB.position.set(0, 2.4, 0); lampB.intensity = 3.0; lampB.distance = 5;
    faceCam(girlHome, lerp(1.15, 0.95, eIO(k)), -0.35, 0.05, -0.12, 42, -0.03);
    SHAKE = chew * 0.012;
  }
  // ------------------------------------------------ S9 mansion pops up
  else if (T < 20.86) {
    lighting('day'); sets.mansion.visible = true;
    const k = prog(T, 19.42, 20.86);
    const pop = eBack(prog(T, 20.1, 20.45));
    mansionGroup.scale.set(1, Math.max(0.001, pop), 1);
    applyPose(oldMan, P({ x: 0.5, z: 1.0, ry: PI - 0.25, shLx: 1.5, shLz: 0.4, elL: 0.2, hdY: 0.2 }));
    ground(oldMan);
    applyPose(girlGlam, P({ x: -0.45, z: 1.1, ry: PI + 0.25, shRx: 2.6 * prog(T, 20.3, 20.45), shRz: 0.4, shLx: 2.6 * prog(T, 20.3, 20.45), shLz: 0.4, elR: 0.3, elL: 0.3, hdX: -0.25 }));
    ground(girlGlam);
    setFace(girlGlam, { eyes: 'open', mouth: T > 20.3 ? 'scream' : 'o', mouthScale: 0.8 });
    setFace(oldMan, { eyes: 'open', mouth: 'smile' });
    camLook(V(0, lerp(1.2, 1.35, k), lerp(6.5, 6.0, k)), V(0, lerp(2.5, 2.8, k), -4.0), 50);
    puffAt(T, V(0, 0.3, -4.6), 20.12, 0.7, 14, 2.5, 0xeeeeee);
    SHAKE = T > 20.1 && T < 20.5 ? 0.03 : 0;
  }
  // ------------------------------------------------ S10 Lambo slides in
  else if (T < 21.72) {
    lighting('day'); sets.mansion.visible = true;
    const k = prog(T, 20.86, 21.72);
    const sk = eOut(prog(T, 20.9, 21.4));
    props.lambo.visible = true;
    props.lambo.position.set(lerp(9, 0.4, sk), 0, 3.2);
    props.lambo.rotation.y = PI / 2 + lerp(0, -0.55, Math.sin(sk * PI)) ;
    applyPose(girlGlam, P({ x: -1.6, z: 1.2, ry: 0.6, shRx: 2.5, shLx: 2.5, shRz: 0.4, shLz: 0.4, elR: 0.3, elL: 0.3 }));
    ground(girlGlam);
    setFace(girlGlam, { eyes: 'open', mouth: 'scream', mouthScale: 0.8 });
    applyPose(oldMan, P({ x: -0.9, z: 0.9, ry: 0.5, shRx: 0.9, elR: 1.6, shRz: 0.2 }));
    ground(oldMan); setFace(oldMan, { eyes: 'half', mouth: 'smirk', thumbR: true });
    for (let i = 0; i < 10; i++) { const p = puffs[i]; if (sk >= 1 || T < 20.95) break; p.visible = true; p.material.color.set(0xcfcfcf); const ph = (T * 3 + i / 10) % 1; p.position.set(props.lambo.position.x + 1.8 + ph * 1.5, 0.3 + ph * 0.5, 3.2 + (hash(i) - 0.5) * 1.6); p.scale.setScalar(1 + ph * 2); p.material.opacity = 0.55 * (1 - ph); }
    camLook(V(lerp(2.6, 2.2, k), 0.85, 7.6), V(lerp(1.5, 0.3, sk), 0.75, 2.6), 46, -0.04);
    SHAKE = T > 20.9 && T < 21.45 ? 0.012 : 0;
  }
  // ------------------------------------------------ S11 tiny dog in a purse
  else if (T < 23.5) {
    lighting('day'); sets.mansion.visible = true;
    const k = prog(T, 21.72, 23.5);
    props.lambo.visible = true; props.lambo.position.set(0.4, 0, 3.2); props.lambo.rotation.y = PI / 2;
    applyPose(girlGlam, P({ x: -0.3, z: 1.2, ry: 0.35, shLx: 0.35, shLz: 0.2, elL: 1.55, shLy: -0.2, shRx: 0.3, shRz: 0.5, elR: 1.2, hdZ: 0.12, spZ: -0.05, hipRz: 0.1 }));
    ground(girlGlam);
    setFace(girlGlam, { eyes: 'open', mouth: 'smile', brow: -0.15, browY: 0.4 });
    girlGlam.root.updateMatrixWorld(true);
    props.purse.visible = true;
    props.purse.position.copy(partWorld(girlGlam.el.L, V(0, -0.17, 0)));
    props.purse.rotation.set(0, 0.35, 0);
    const yip = T > 22.5 && T < 22.95 && Math.sin((T - 22.5) * 40) > 0;
    props.purse.userData.jaw.position.y = yip ? -0.06 : -0.045;
    props.purse.userData.dog.position.y = -0.03 + (yip ? 0.02 : 0) + Math.sin(T * 6) * 0.005;
    props.purse.userData.dog.rotation.z = Math.sin(T * 5) * 0.15;
    camLook(headWorld(girlGlam).add(V(lerp(0.75, 0.6, k), lerp(-0.35, -0.4, k), lerp(1.45, 1.2, eIO(k)))), headWorld(girlGlam).add(V(0.1, -0.42, 0)), 42, 0.03);
  }
  // ------------------------------------------------ S12 three kids
  else if (T < 26.0) {
    lighting('day'); sets.mansion.visible = true;
    const k = prog(T, 23.5, 26.0);
    applyPose(oldMan, P({ x: 0.5, z: 0.4, ry: -0.15, shLx: 0.4, shLz: -0.2, elL: 0.6, spX: 0.05 }));
    ground(oldMan); setFace(oldMan, { eyes: 'open', mouth: 'smile' });
    applyPose(girlGlam, P({ x: -0.45, z: 0.35, ry: 0.15, shRx: 0.4, shRz: -0.2, elR: 0.6, hdZ: 0.1 }));
    ground(girlGlam); setFace(girlGlam, { eyes: 'half', mouth: 'smile' });
    const tt = [24.26, 24.4, 24.54];
    kids.forEach((c, i) => {
      if (T < tt[i]) return;
      const pop = eBack(prog(T, tt[i], tt[i] + 0.14));
      applyPose(c, P({ x: (i - 1) * 0.55, z: 1.3, ry: (1 - i) * 0.15, shRz: 0.3 + Math.sin(T * 8 + i) * 0.2, shLz: 0.3, hdZ: Math.sin(T * 5 + i) * 0.12 }));
      c.root.scale.setScalar(Math.max(0.01, pop)); ground(c);
      setFace(c, { eyes: 'open', mouth: 'grin', mouthScale: 0.9 });
      puffAt(T, V((i - 1) * 0.55, 0.3, 1.3), tt[i], 0.4, 6, 0.6, 0xffffff);
    });
    camLook(V(0, lerp(1.25, 1.2, k), lerp(4.6, 4.1, eIO(k))), V(0, 0.95, 0.6), 44);
  }
  // ------------------------------------------------ S13 call you the ATM
  else if (T < 27.65) {
    lighting('day'); sets.mansion.visible = true;
    const k = prog(T, 26.0, 27.65);
    applyPose(oldMan, P({ x: 0.5, z: 0.4, ry: -0.35, shRz: 0.5, shLz: 0.5, elR: 0.3, elL: 0.3, spX: 0.05, hdX: 0.15 }));
    ground(oldMan); setFace(oldMan, { eyes: 'half', mouth: 'line', brow: -0.45, browY: 0.2 });
    const tgts = [];
    kids.forEach((c, i) => {
      const x = -0.55 + i * 0.42, z = 1.25 + Math.abs(i - 1) * 0.15;
      const dx = 0.5 - x, dz = 0.4 - z; const ry = Math.atan2(dx, dz);
      const grab = Math.sin(T * 10 + i * 2) * 0.2;
      applyPose(c, P({ x, z, ry, shRx: 1.5 + grab, shLx: 1.5 - grab, elR: 0.2, elL: 0.2, hdX: -0.35 }));
      ground(c); setFace(c, { eyes: 'dollar', eyeScale: 1.1, mouth: 'grin' });
      tgts.push(partWorld(c.hand.R));
    });
    applyPose(girlGlam, P({ x: -1.1, z: 0.2, ry: 0.5, shRx: 0.5, elR: 1.6, shRz: 0.3 }));
    ground(girlGlam); setFace(girlGlam, { eyes: 'half', mouth: 'smirk' });
    billSpray(T, partWorld(oldMan.spine, V(0, 0.3, 0.2)), tgts, 26.35, 30);
    camLook(V(lerp(-0.6, -0.4, k), 1.15, lerp(3.4, 3.0, k)), V(0.15, 1.15, 0.6), 46, -0.03);
    O.atm = { at: headWorld(oldMan, V(0, 0.42, 0)), T0: 26.32 };
  }
  // ------------------------------------------------ S14a night: she's on the laptop, you peek
  else if (T < 29.3) {
    lighting('home'); sets.living.visible = true;
    const k = prog(T, 27.65, 29.3);
    applyPose(girlCasual, P(Object.assign({ x: -0.3, z: -0.62, ry: 0, spX: 0.12, hdX: 0.35, shRx: 0.75, shLx: 0.75, elR: 0.8, elL: 0.8, shRz: 0.12, shLz: 0.12 }, SIT_CHAIR)));
    setFace(girlCasual, { eyes: 'half', mouth: 'line', brow: 0.2 });
    girlCasual.root.updateMatrixWorld(true);
    const lap = partWorld(girlCasual.pelvis, V(0, 0.12, 0.35));
    props.laptop.visible = true; props.laptop.position.copy(lap); props.laptop.rotation.set(0, PI, 0);
    const peek = eOut(prog(T, 28.0, 28.5));
    applyPose(oldMan, P({ x: 0.05, z: -1.55, ry: 0, spX: 0.55 * peek, hdX: 0.25, shRx: 0.6, shLx: 0.6, elR: 0.5, elL: 0.5, y: lerp(-0.6, 0, peek) }));
    setFace(oldMan, { eyes: 'open', look: -0.5, mouth: 'line', brow: -0.1 });
    drawScreen('', T);
    lampA.position.set(1.6, 1.6, -1.6); lampA.intensity = 4; lampA.distance = 6;
    lampB.color.set(0xbfe0ff); lampB.position.copy(lap).add(V(0, 0.3, -0.25)); lampB.intensity = 1.6; lampB.distance = 1.6;
    camLook(V(lerp(1.15, 1.0, k), 1.25, lerp(1.35, 1.15, k)), V(-0.15, 1.15, -0.85), 44, 0.02);
  }
  // ------------------------------------------------ S14b the search screen
  else if (T < 31.0) {
    lighting('home'); sets.living.visible = true;
    const k = prog(T, 29.3, 31.0);
    applyPose(girlCasual, P(Object.assign({ x: -0.3, z: -0.62, ry: 0, spX: 0.12, hdX: 0.35, shRx: 0.75, shLx: 0.75, elR: 0.8, elL: 0.8 }, SIT_CHAIR)));
    girlCasual.root.updateMatrixWorld(true);
    const lap = partWorld(girlCasual.pelvis, V(0, 0.12, 0.35));
    props.laptop.visible = true; props.laptop.position.copy(lap); props.laptop.rotation.set(0, PI, 0);
    const full = 'how long do old men live?';
    const n = Math.round(full.length * prog(T, 29.36, 30.95));
    drawScreen(full.slice(0, n), T);
    props.laptop.updateMatrixWorld(true);
    const scr = props.laptop.userData.scr;
    const c0 = partWorld(scr, V(0, 0, 0)), nrm = partWorld(scr, V(0, 0, 1)).sub(c0).normalize();
    camLook(c0.clone().addScaledVector(nrm, lerp(0.62, 0.5, eIO(k))), c0.clone().add(V(0, -0.012, 0)), 40, 0);
    lampA.position.set(1.6, 1.6, -1.6); lampA.intensity = 4; lampA.distance = 6;
  }
  // ------------------------------------------------ S15 GASP
  else if (T < 32.0) {
    lighting('home'); sets.living.visible = true;
    const k = prog(T, 31.0, 32.0);
    applyPose(girlCasual, P(Object.assign({ x: -0.3, z: -0.62, ry: 0, spX: 0.12, hdX: 0.35, shRx: 0.75, shLx: 0.75, elR: 0.8, elL: 0.8 }, SIT_CHAIR)));
    applyPose(oldMan, P({ x: 0.05, z: -1.55, ry: 0, spX: 0.45, hdX: -0.1, shRx: 1.2, shLx: 0.6, elR: 1.9, elL: 0.5, shRz: -0.2 }));
    const g = eOut(prog(T, 31.02, 31.12));
    setFace(oldMan, { eyes: 'wide', eyeScale: 1 + g * 0.35, mouth: 'scream', mouthScale: 0.7 + g * 0.5, brow: -0.4, browY: 1.2 * g });
    if (oldMan.glasses) oldMan.glasses.position.y = g * 0.07;
    lampA.position.set(1.6, 1.6, -1.6); lampA.intensity = 4; lampA.distance = 6;
    faceCam(oldMan, lerp(1.35, 0.95, g), 0.2, -0.05, -0.1, 40, 0.04 * g);
    SHAKE = 0.025 * (1 - prog(T, 31.05, 31.6)) * (T > 31.05 ? 1 : 0);
    flash = T > 31.02 && T < 31.08 ? 0.35 : 0;
  }
  // ------------------------------------------------ S16a she looks back innocently (halo)
  else if (T < 33.3) {
    lighting('home'); sets.living.visible = true;
    const k = prog(T, 32.0, 33.3);
    const turn = eOut(prog(T, 32.0, 32.35));
    applyPose(girlCasual, P(Object.assign({ x: -0.3, z: -0.62, ry: 0, spY: 0.5 * turn, hdY: 0.6 * turn, hdX: -0.25 * turn, hdZ: 0.15 * turn, shRx: 0.75, shLx: 0.75, elR: 0.8, elL: 0.8 }, SIT_CHAIR)));
    setFace(girlCasual, { eyes: T > 32.75 && T < 32.85 ? 'closed' : 'open', eyeScale: 1.15, mouth: 'smile', brow: -0.3, browY: 0.7, blush: 0.6 });
    girlCasual.root.updateMatrixWorld(true);
    props.halo.visible = true; props.halo.position.copy(headWorld(girlCasual, V(0, 0.38 + Math.sin(T * 4) * 0.015, 0))); props.halo.quaternion.copy(girlCasual.head.getWorldQuaternion(new THREE.Quaternion()));
    props.halo.scale.setScalar(Math.max(0.01, eBack(prog(T, 32.35, 32.6))));
    props.laptop.visible = true; props.laptop.position.copy(partWorld(girlCasual.pelvis, V(0, 0.12, 0.35))); props.laptop.rotation.set(0, PI, 0);
    lampA.position.set(1.6, 1.6, -1.6); lampA.intensity = 4; lampA.distance = 6;
    fxLight.color.set(0xffe9a0); fxLight.position.copy(props.halo.position).add(V(0, 0.1, 0.3)); fxLight.intensity = 1.5 * props.halo.scale.x; fxLight.distance = 1.5;
    const hw = headWorld(girlCasual);
    const fd = V(0, 0, 1).applyQuaternion(girlCasual.head.getWorldQuaternion(new THREE.Quaternion())); fd.y = 0; fd.normalize();
    camLook(hw.clone().addScaledVector(fd, lerp(1.25, 1.05, k)).add(V(0, 0.12, 0)), hw.clone().add(V(0, 0.0, 0)), 42, -0.03);
    O.sparkle = [{ at: hw.clone().add(V(0.15, 0.25, 0.1)), T0: 32.5 }, { at: hw.clone().add(V(-0.2, 0.1, 0.1)), T0: 32.8 }];
  }
  // ------------------------------------------------ S16b you still love her
  else if (T < 36.05) {
    lighting('home'); sets.living.visible = true;
    const k = prog(T, 33.3, 36.05);
    applyPose(girlCasual, P(Object.assign({ x: -0.3, z: -0.62, ry: 0, spY: 0.5, hdY: 0.6, hdX: -0.25, shRx: 0.75, shLx: 0.75, elR: 0.8, elL: 0.8 }, SIT_CHAIR)));
    setFace(girlCasual, { eyes: 'open', mouth: 'smile' });
    const melt = Math.sin(T * 3) * 0.08;
    applyPose(oldMan, P({ x: 0.05, z: -1.55, ry: -0.35, spX: 0.1, hdX: 0.05, hdZ: 0.2 + melt, shRx: 1.0, shLx: 1.0, elR: 1.9, elL: 1.9, shRy: 0.9, shLy: 0.9 }));
    setFace(oldMan, { eyes: 'heart', eyeScale: 1.1 + Math.sin(T * 12) * 0.15, mouth: 'smile', brow: -0.3, browY: 0.7, blush: 0.9 });
    lampA.position.set(1.6, 1.6, -1.6); lampA.intensity = 4; lampA.distance = 6;
    hemi.color.set(0xffc0d8); hemi.intensity = 0.9;
    faceCam(oldMan, lerp(1.5, 1.25, eIO(k)), 0.45, 0.05, -0.12, 40, 0.03);
    placeHearts(T, headWorld(oldMan).add(V(0, 0.1, 0)), 0.32, 8, 0.7, 0.065);
  }
  // ------------------------------------------------ S17 mansion at night, squeaks
  else if (T < 38.92) {
    lighting('night'); sets.mansion.visible = true;
    const k = prog(T, 36.05, 38.92);
    const sq = T > 37.4 ? Math.max(0, Math.sin((T - 37.4) * 13)) : 0;
    mansionWinMats.forEach((m, i) => { const lit = i === 9 || i === 10; m.emissive.set(lit ? 0xffc46a : 0x000000); m.emissiveIntensity = lit ? 1.4 : 0; m.color.set(lit ? 0xffe0a0 : 0x2a3550); });
    mansionGroup.position.x = sq * 0.02;
    props.lambo.visible = true; props.lambo.position.set(0.4, 0, 3.2); props.lambo.rotation.y = PI / 2;
    camLook(V(0, lerp(1.6, 1.9, k), lerp(9.5, 8.6, k)), V(0, lerp(3.2, 3.4, k), -5), 48);
    SHAKE = sq * 0.004;
  }
  // ------------------------------------------------ S18 hallway door: COME ON
  else if (T < 41.5) {
    lighting('hall'); sets.bed.visible = true;
    const k = prog(T, 38.92, 41.5);
    const rh = Math.max(0, Math.sin(T * 13));
    door.rotation.y = rh * 0.012; door.position.x = 0.425 + rh * 0.004;
    hallFrame.rotation.z = Math.sin(T * 13) * 0.06 + 0.08;
    lampA.color.set(0xffb060); lampA.position.set(0.9, 0.1, 2.85); lampA.intensity = 1.8 + rh; lampA.distance = 2.2;
    lampB.color.set(0x8090c0); lampB.position.set(0.9, 2.6, 5.0); lampB.intensity = 0.6; lampB.distance = 5;
    camLook(V(lerp(0.75, 0.85, k), 1.45, lerp(6.2, 5.3, eIO(k))), V(0.9, 1.05, 2.55), 46);
    SHAKE = rh * 0.004;
    O.doorBubble = { at: V(0.9, 1.8, 2.6), T0: 40.6 };
  }
  // ------------------------------------------------ S19 record scratch: door flies open
  else if (T < 42.62) {
    lighting('hall'); sets.bed.visible = true;
    const op = eOut(prog(T, 41.52, 41.7));
    door.rotation.y = -op * 1.9;
    lampA.color.set(0xffc070); lampA.position.set(0.9, 1.0, 2.2); lampA.intensity = 2 + op * 10; lampA.distance = 6;
    applyPose(oldPJ, P(Object.assign({ x: 0, z: -0.35, y: 0.62 + 0.165 }, LIE)));
    setFace(oldPJ, { eyes: 'x', mouth: 'tongue' });
    applyPose(girlPJ, P({ x: -0.62, z: -1.4, ry: PI / 2, hipRx: 0.1, hipLx: 0.1, knR: 1.6, knL: 1.6, spX: 0.6, shRx: 1.25, shLx: 1.25, shRz: -0.12, shLz: -0.12, elR: 0, elL: 0 }));
    ground(girlPJ, 0.6);
    setFace(girlPJ, { eyes: 'wide', mouth: 'o' });
    const z = eOut(prog(T, 41.55, 41.75));
    camLook(V(0.9, 1.45, lerp(5.3, 4.6, z)), V(0.7, 1.0, 1.0), 46);
    flash = T > 41.52 && T < 41.62 ? 0.4 : 0;
    O.freeze = T > 41.72 ? 1 : 0;
  }
  // ------------------------------------------------ S20 she's giving you CPR
  else if (T < 44.92) {
    lighting('bed'); sets.bed.visible = true;
    sets.bed.userData.blanket.visible = true;
    const k = prog(T, 42.62, 44.92);
    const pump = Math.max(0, Math.sin((T - 42.62) * PI * 2 * 1.8));
    applyPose(oldPJ, P(Object.assign({ x: 0, z: -0.35, y: 0.62 + 0.165 - pump * 0.03 }, LIE)));
    setFace(oldPJ, { eyes: 'x', mouth: 'tongue' });
    applyPose(girlPJ, P({ x: -0.62, z: -1.4, ry: PI / 2, hipRx: 0.1, hipLx: 0.1, knR: 1.6, knL: 1.6, spX: 0.55 + pump * 0.15, shRx: 1.3 + pump * 0.1, shLx: 1.3 + pump * 0.1, shRz: -0.15, shLz: -0.15, shRy: 0.15, shLy: 0.15, elR: 0, elL: 0, hdX: -0.1 }));
    ground(girlPJ, 0.6); girlPJ.root.position.y -= pump * 0.03;
    setFace(girlPJ, { eyes: pump > 0.5 ? 'closed' : 'open', mouth: 'open', mouthScale: 0.9, brow: 0.5, browY: -0.2 });
    lampA.position.set(-1.35, 1.1, -2.15); lampA.intensity = 3; lampA.distance = 5;
    lampB.position.set(1.35, 1.1, -2.15); lampB.intensity = 3; lampB.distance = 5; lampB.color.set(0xffb36b);
    camLook(V(lerp(1.75, 1.55, k), lerp(1.95, 1.85, k), lerp(0.9, 0.6, k)), V(-0.2, 0.85, -1.45), 46, 0.02);
    SHAKE = pump * 0.004;
  }
  // ------------------------------------------------ S21a heart stopped (flatline)
  else if (T < 45.6) {
    lighting('bed'); sets.bed.visible = true;
    applyPose(oldPJ, P(Object.assign({ x: 0, z: -0.35, y: 0.62 + 0.165 }, LIE)));
    setFace(oldPJ, { eyes: 'x', mouth: 'tongue' });
    applyPose(girlPJ, P({ x: -0.62, z: -1.4, ry: PI / 2, hipRx: 0.1, hipLx: 0.1, knR: 1.6, knL: 1.6, spX: 0.4, shRx: 1.0, shLx: 1.0, elR: 0.3, elL: 0.3 }));
    ground(girlPJ, 0.6); setFace(girlPJ, { eyes: 'wide', mouth: 'o' });
    lampA.position.set(-1.35, 1.1, -2.15); lampA.intensity = 3; lampA.distance = 5;
    lampB.position.set(1.35, 1.1, -2.15); lampB.intensity = 3; lampB.distance = 5;
    const hw = headWorld(oldPJ);
    camera.up.set(0, 0, -1); camera.position.set(hw.x, hw.y + 1.25, hw.z + 0.25); camera.fov = 42; camera.updateProjectionMatrix(); camera.lookAt(hw.x, hw.y, hw.z + 0.25);
    O.ecg = { T0: 44.9, flat: 45.15 };
  }
  // ------------------------------------------------ S21b haven't signed the will
  else if (T < 47.95) {
    lighting('bed'); sets.bed.visible = true;
    const k = prog(T, 45.6, 47.95);
    const shake = Math.sin(T * 18) * 0.08;
    applyPose(oldPJ, P(Object.assign({ x: 0, z: -0.35, y: 0.62 + 0.165, shRx: 0.9 + shake, shRz: 0.3, elR: 0.1 }, LIE)));
    setFace(oldPJ, { eyes: 'x', mouth: 'tongue' });
    applyPose(girlPJ, P({ x: -0.62, z: -1.4, ry: PI / 2 + 0.2, hipRx: 0.1, hipLx: 0.1, knR: 1.6, knL: 1.6, spX: 0.25, shLx: 1.35, shLz: -0.1, elL: 0.5, shRx: 1.1 + shake, shRz: -0.2, elR: 0.6, hdX: 0.1 }));
    ground(girlPJ, 0.6);
    setFace(girlPJ, { eyes: 'wide', mouth: T > 46.0 ? 'scream' : 'open', mouthScale: 0.85, brow: 0.55, browY: -0.2 });
    girlPJ.root.updateMatrixWorld(true);
    props.will.visible = true; props.will.position.copy(partWorld(girlPJ.hand.L, V(0, -0.05, 0.12))); props.will.lookAt(camera.position);
    props.pen.visible = true; props.pen.position.copy(partWorld(girlPJ.hand.R, V(0, -0.02, 0.03))); props.pen.rotation.set(0.6, 0, 0.4);
    lampA.position.set(-1.35, 1.1, -2.15); lampA.intensity = 3; lampA.distance = 5;
    lampB.position.set(1.35, 1.1, -2.15); lampB.intensity = 3; lampB.distance = 5;
    const hw = headWorld(girlPJ);
    camLook(hw.clone().add(V(lerp(1.15, 0.95, eIO(k)), -0.12, lerp(0.75, 0.62, eIO(k)))), hw.clone().add(V(0.25, -0.2, 0.05)), 44, -0.03);
    props.will.lookAt(camera.position);
    O.signBubble = { at: hw.clone().add(V(0.1, 0.25, 0.1)), T0: 46.1 };
  }
  // ------------------------------------------------ S22 ghost floats up — fucking romance
  else {
    lighting('bed'); sets.bed.visible = true;
    const k = prog(T, 47.95, 49.6);
    const pump = Math.max(0, Math.sin((T - 47.95) * PI * 2 * 1.8));
    applyPose(oldPJ, P(Object.assign({ x: 0, z: -0.35, y: 0.62 + 0.165 - pump * 0.03 }, LIE)));
    setFace(oldPJ, { eyes: 'x', mouth: 'tongue' });
    applyPose(girlPJ, P({ x: -0.62, z: -1.4, ry: PI / 2, hipRx: 0.1, hipLx: 0.1, knR: 1.6, knL: 1.6, spX: 0.55 + pump * 0.15, shRx: 1.3, shRz: -0.15, shRy: 0.15, elR: 0, shLx: 2.6, shLz: 0.3, elL: 0.2 }));
    ground(girlPJ, 0.6); girlPJ.root.position.y -= pump * 0.03;
    setFace(girlPJ, { eyes: 'closed', mouth: 'open', brow: 0.5 });
    girlPJ.root.updateMatrixWorld(true);
    props.will.visible = true; props.will.position.copy(partWorld(girlPJ.hand.L, V(0, -0.12, 0))); props.will.rotation.set(0, PI / 2, Math.sin(T * 12) * 0.2);
    const up = eIO(prog(T, 48.0, 49.4));
    const gp = P(Object.assign({ x: 0, z: lerp(-0.35, -1.0, up), y: lerp(0.785, 0.95, up) + Math.sin(T * 3) * 0.03 * up }, LIE));
    gp.rx = lerp(-PI / 2, 0, up); gp.shRx = up * 2.6; gp.shRz = 0.3 + Math.sin(T * 12) * 0.25 * up; gp.elR = 0.3; gp.hipRx = up * 0.3; gp.knR = up * 0.5; gp.knL = up * 0.3;
    applyPose(ghost, gp);
    setFace(ghost, { eyes: up > 0.5 ? 'closed' : 'x', mouth: up > 0.5 ? 'smile' : 'line' });
    ghost.root.updateMatrixWorld(true);
    props.halo.visible = true; props.halo.position.copy(headWorld(ghost, V(0, 0.4, 0))); props.halo.quaternion.copy(ghost.head.getWorldQuaternion(new THREE.Quaternion())); props.halo.scale.setScalar(Math.max(0.01, up));
    lampA.position.set(-1.35, 1.1, -2.15); lampA.intensity = 3; lampA.distance = 5;
    lampB.position.set(1.35, 1.1, -2.15); lampB.intensity = 3; lampB.distance = 5;
    fxLight.color.set(0xcfe8ff); fxLight.position.copy(headWorld(ghost)).add(V(0, 0, 0.4)); fxLight.intensity = 2 * up; fxLight.distance = 2.5;
    camLook(V(lerp(0.9, 0.75, k), lerp(1.75, 1.9, k), lerp(2.1, 2.0, k)), V(-0.15, lerp(1.1, 1.9, eIO(k)), -1.1), 50, 0.02);
  }
  return flash;
}

// ===========================================================================
// 2D overlay
// ===========================================================================
function outlined(s, x, y, o = {}) {
  const size = o.size ?? 100;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y); ctx.rotate(o.rot ?? 0); ctx.scale(o.scale ?? 1, o.scale ?? 1);
  ctx.font = o.font ?? `${size}px "Luckiest Guy"`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const sw = size * (o.sw ?? 0.2);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = sw; ctx.strokeText(s, size * 0.04, size * 0.07); ctx.fillText(s, size * 0.04, size * 0.07); }
  ctx.lineWidth = sw; ctx.strokeStyle = o.stroke ?? '#111'; ctx.strokeText(s, 0, 0);
  ctx.fillStyle = o.fill ?? '#FFD21F'; ctx.fillText(s, 0, 0);
  ctx.restore();
}
function drawCaption(T) {
  const c = CHUNKS.find(ch => T >= ch.s && T < ch.e); if (!c) return;
  const size = 82; ctx.font = `900 ${size}px Montserrat`;
  const words = c.map(w => w.w); const space = size * 0.28;
  const lines = [[]]; let lw = 0;
  words.forEach((w, i) => { const ww = ctx.measureText(w).width; if (lines[lines.length - 1].length && lw + space + ww > 900) { lines.push([]); lw = 0; } lines[lines.length - 1].push(i); lw += (lw ? space : 0) + ww; });
  const pop = eBack(prog(T, c.s, c.s + 0.12)); const sc = 0.82 + 0.18 * pop;
  const baseY = H * 0.655, lh = size * 1.08;
  lines.forEach((ln, li) => {
    const widths = ln.map(i => ctx.measureText(words[i]).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (ln.length - 1);
    let x = W / 2 - total / 2 * sc; const y = baseY + (li - (lines.length - 1) / 2) * lh * sc;
    ln.forEach((i, j) => {
      const w = c[i]; const spoken = T >= w.s - 0.02; const active = spoken && T < w.e + 0.05;
      outlined(words[i], x + widths[j] * sc / 2, y, { font: `900 ${size}px Montserrat`, size, sw: 0.24, scale: sc * (active ? 1.06 : 1), fill: spoken ? '#FFD21F' : '#FFFFFF', stroke: '#0d0d0d' });
      x += (widths[j] + space) * sc;
    });
  });
}
function drawSFX(T) {
  for (const f of SFX) {
    if (T < f.T || T > f.T + f.d) continue;
    const k = T - f.T;
    let sc = f.slam ? lerp(2.4, 1, eOut(clamp(k / 0.12))) : 0.25 + 0.75 * eBack(clamp(k / 0.16));
    const out = clamp((f.T + f.d - T) / 0.12); sc *= 0.7 + 0.3 * out;
    const sh = (f.shake ?? 0) * 8;
    outlined(f.s, f.x * W + noise1(T * 6, 1) * sh, f.y * H + noise1(T * 6, 2) * sh, { size: f.size, rot: f.rot + Math.sin(k * 9) * 0.03, scale: sc, fill: f.fill, stroke: f.stroke ?? '#111', alpha: out, sw: 0.18 });
  }
}
function star(x, y, r, rot = 0, col = '#fff', alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = r * 0.8;
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const rr = i % 2 ? r * 0.22 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function bubble(text, ax, ay, T0, T, o = {}) {
  const k = eBack(prog(T, T0, T0 + 0.15)); if (k <= 0) return;
  const size = o.size ?? 70;
  ctx.save(); ctx.font = `900 ${size}px Montserrat`;
  const tw = ctx.measureText(text).width; const bw = tw + 90, bh = size + 70;
  const bx = clamp(ax - bw * 0.5 + (o.dx ?? 0), 30, W - bw - 30), by = clamp(o.by ?? (ay - bh - 140), 120, H - bh - 40);
  const sh = (o.shake ?? 0) * 6; ctx.translate(noise1(T * 5, 3) * sh, noise1(T * 5, 4) * sh);
  ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(k, k); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(bx + 10, by + 14, bw, bh, 50); ctx.fill();
  ctx.fillStyle = o.bg ?? '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 10;
  const tx = clamp(ax, bx + 60, bx + bw - 60);
  ctx.beginPath(); ctx.moveTo(tx - 40, by + bh - 5); ctx.lineTo(ax, ay); ctx.lineTo(tx + 30, by + bh - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  roundRect(bx, by, bw, bh, 50); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx - 34, by + bh - 6); ctx.lineTo(tx + 24, by + bh - 6); ctx.lineWidth = 14; ctx.strokeStyle = o.bg ?? '#fff'; ctx.stroke();
  ctx.fillStyle = o.fg ?? '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + bw / 2, by + bh / 2 + 4);
  ctx.restore();
}
function draw2D(T, flash) {
  ctx.clearRect(0, 0, W, H);
  if (O.freeze) { ctx.fillStyle = 'rgba(40,40,40,0.35)'; ctx.fillRect(0, 0, W, H); }
  if (O.impact && O.impact.a > 0.05) {
    const s = project(O.impact.at); ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${O.impact.a})`; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * 200, s.y + Math.sin(a) * 200); ctx.lineTo(s.x + Math.cos(a) * (260 + O.impact.a * 120), s.y + Math.sin(a) * (260 + O.impact.a * 120)); ctx.stroke(); }
    ctx.restore();
  }
  if (O.sparkle) O.sparkle.forEach(sp => { const a = Math.sin(prog(T, sp.T0, sp.T0 + 0.4) * PI); if (a > 0) { const s = project(sp.at); star(s.x, s.y, (sp.big ? 110 : 60) * a, T * 4, '#fffbe0', a); } });
  if (O.coins) { const k = prog(T, O.coins.T0, O.coins.T0 + 1.0); const s = project(O.coins.at); for (let i = 0; i < 10; i++) { const a = -PI / 2 + (hash(i) - 0.5) * 2.2; const r = k * (300 + hash(i, 2) * 300); const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r + k * k * 600; if (k > 0 && k < 1) { ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a07000'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y, 34, 34 * Math.abs(Math.cos(T * 10 + i)), 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); } } }
  if (O.atm) {
    const s = project(O.atm.at); const k = eBack(prog(T, O.atm.T0, O.atm.T0 + 0.18));
    if (k > 0) {
      ctx.save(); ctx.translate(s.x, s.y - 60); ctx.scale(k, k);
      const fl = Math.floor(T * 8) % 5 !== 0;
      ctx.fillStyle = '#0e2a18'; ctx.strokeStyle = fl ? '#3dff7a' : '#1a6a34'; ctx.lineWidth = 14; ctx.shadowColor = '#3dff7a'; ctx.shadowBlur = fl ? 40 : 0;
      roundRect(-200, -90, 400, 180, 30); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fl ? '#7dffa8' : '#2a8a4a'; ctx.font = '130px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ATM', 0, 10);
      ctx.restore();
    }
  }
  if (O.doorBubble) {
    const s = project(O.doorBubble.at);
    if (T > O.doorBubble.T0) bubble(T > 41.15 ? 'COME ON! COME ON!' : 'COME ON!', s.x, s.y, O.doorBubble.T0, T, { size: 66, shake: 1, by: H * 0.2 });
  }
  if (O.signBubble) { const s = project(O.signBubble.at); bubble('SIGN IT!!', s.x, s.y, O.signBubble.T0, T, { size: 80, shake: 1.2, bg: '#ffe0e0', by: H * 0.17 }); }
  if (O.ecg) {
    ctx.save(); const y0 = H * 0.47, x0 = 70, w = W - 140;
    ctx.fillStyle = 'rgba(0,20,10,0.75)'; roundRect(x0 - 20, y0 - 130, w + 40, 260, 24); ctx.fill();
    ctx.strokeStyle = '#3dff7a'; ctx.lineWidth = 10; ctx.shadowColor = '#3dff7a'; ctx.shadowBlur = 18; ctx.beginPath();
    const head = (T - O.ecg.T0) / 0.7;
    for (let i = 0; i <= 200; i++) {
      const u = i / 200; const tt = O.ecg.T0 + u * 0.7; if (u > head) break;
      let y = 0; if (tt < O.ecg.flat) { const ph = ((tt - O.ecg.T0) * 2.2) % 1; y = ph > 0.4 && ph < 0.45 ? -90 : ph > 0.45 && ph < 0.5 ? 60 : 0; }
      const x = x0 + u * w; i ? ctx.lineTo(x, y0 + y) : ctx.moveTo(x, y0 + y);
    }
    ctx.stroke(); ctx.restore();
  }
  drawSFX(T);
  drawCaption(T);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,240,${flash})`; ctx.fillRect(0, 0, W, H); }
}

// ===========================================================================
function renderAt(t) {
  const T = t * SPEED;
  const flash = shot(T);
  scene.updateMatrixWorld(true);
  if (SHAKE > 0) { camera.position.x += noise1(T * 3, 11) * SHAKE; camera.position.y += noise1(T * 3, 23) * SHAKE; camera.rotateZ(noise1(T * 3, 37) * SHAKE * 0.8); }
  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
  draw2D(T, flash);
  return true;
}
(async () => {
  WORDS = await (await fetch('words.json')).json();
  buildChunks();
  await document.fonts.ready;
  window.renderAt = renderAt;
  window.DURATION = VO_LEN / SPEED + 0.5;
  window.READY = true;
})();
