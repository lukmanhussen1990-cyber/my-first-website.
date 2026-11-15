import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// basics
// ---------------------------------------------------------------------------
const W = 1080, H = 1920;
const SPEED = 1.3;                 // voiceover speed-up factor
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

const ov = document.createElement('canvas');
ov.width = W; ov.height = H;
document.body.appendChild(ov);
const ctx = ov.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 80);

// ---------------------------------------------------------------------------
// materials / geometry helpers
// ---------------------------------------------------------------------------
function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.78, metalness: o.m ?? 0, flatShading: o.flat ?? false,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.t ?? false, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide,
  });
}
function mesh(geo, mat, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
}
const RB = (w, h, d, r = 0.04, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

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

// ---------------------------------------------------------------------------
// lights
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xb48a64, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-6, 8, 2.5);
sun.target.position.set(0, 0, -2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 25;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
fill.position.set(4, 4, 6);
scene.add(fill);
const fxLight = new THREE.PointLight(0x66ccff, 0, 4, 1.6);   // sparks / fire light
scene.add(fxLight);

// ---------------------------------------------------------------------------
// classroom
// ---------------------------------------------------------------------------
const room = new THREE.Group(); scene.add(room);
const BOARD_Z = -5.6;
{
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        const off = (i % 2) * (h / 6);
        const v = hash(i, j) * 22 - 11;
        g.fillStyle = `rgb(${206 + v},${160 + v * .8},${112 + v * .6})`;
        g.fillRect(i * w / n, j * h / 3 + off - h / 3, w / n, h / 3);
        g.fillRect(i * w / n, j * h / 3 + off + 2 * h / 3, w / n, h / 3);
      }
    }
    g.strokeStyle = 'rgba(110,70,40,0.45)'; g.lineWidth = 4;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); }
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
      const y = j * h / 3 + (i % 2) * (h / 6);
      g.beginPath(); g.moveTo(i * w / n, y); g.lineTo((i + 1) * w / n, y); g.stroke();
    }
    g.globalAlpha = 0.08;
    for (let k = 0; k < 400; k++) { g.fillStyle = hash(k, 9) > .5 ? '#5a3a1a' : '#fff'; g.fillRect(hash(k, 1) * w, hash(k, 2) * h, 2 + hash(k, 3) * 60, 2); }
  }, [5, 5]);
  const floor = mesh(new THREE.PlaneGeometry(14, 16), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }), false, true);
  floor.rotation.x = -PI / 2; floor.position.set(0, 0, 0.4);
  room.add(floor);

  const wallMat = M(0xf3ead8, { r: 0.95 });
  const wallMat2 = M(0xcfe6dc, { r: 0.95 });
  const back = mesh(new THREE.PlaneGeometry(14, 4), wallMat2, false, true); back.position.set(0, 2, BOARD_Z - 0.05); room.add(back);
  const left = mesh(new THREE.PlaneGeometry(16, 4), wallMat, false, true); left.rotation.y = PI / 2; left.position.set(-5.5, 2, 0.4); room.add(left);
  const right = mesh(new THREE.PlaneGeometry(16, 4), wallMat, false, true); right.rotation.y = -PI / 2; right.position.set(5.5, 2, 0.4); room.add(right);
  const backWall = mesh(new THREE.PlaneGeometry(14, 4), wallMat, false, true); backWall.rotation.y = PI; backWall.position.set(0, 2, 8.2); room.add(backWall);
  const ceil = mesh(new THREE.PlaneGeometry(14, 16), M(0xfafafa, { e: 0xe8e8e8, ei: 0.55 }), false, false); ceil.rotation.x = PI / 2; ceil.position.set(0, 3.6, 0.4); room.add(ceil);
  // baseboards
  const bbMat = M(0x8a6a4e);
  const bb1 = mesh(BOX(14, 0.14, 0.04), bbMat); bb1.position.set(0, 0.07, BOARD_Z); room.add(bb1);
  const bb2 = mesh(BOX(0.04, 0.14, 16), bbMat); bb2.position.set(-5.48, 0.07, 0.4); room.add(bb2);
  const bb3 = mesh(BOX(0.04, 0.14, 16), bbMat); bb3.position.set(5.48, 0.07, 0.4); room.add(bb3);
  // wainscot stripe
  const stripe = mesh(BOX(14, 0.06, 0.03), M(0x6fb59a)); stripe.position.set(0, 1.0, BOARD_Z + 0.01); room.add(stripe);

  // chalkboard
  const boardTex = canvasTex(1600, 700, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#2f5d48'); grd.addColorStop(1, '#244c3a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.07; for (let k = 0; k < 90; k++) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(hash(k, 4) * w, hash(k, 5) * h, 80 + hash(k, 6) * 200, 20 + hash(k, 7) * 40, hash(k, 8) * 3, 0, 7); g.fill(); }
    g.globalAlpha = 0.92; g.fillStyle = '#f4f4ea'; g.strokeStyle = '#f4f4ea';
    g.font = '130px "Luckiest Guy"'; g.textAlign = 'left'; g.fillText('CPR 101', 90, 190);
    g.lineWidth = 8; g.beginPath(); g.moveTo(90, 220); g.lineTo(640, 220); g.stroke();
    g.font = '800 62px Montserrat';
    g.fillText('1. CHECK BREATHING', 100, 330);
    g.fillText('2. CALL 911', 100, 425);
    g.fillText('3. DON\'T PANIC', 100, 520);
    g.fillStyle = '#ffd1dc'; g.fillText('TEST FRIDAY!!', 100, 625);
    // stick figure doodle
    g.strokeStyle = '#f4f4ea'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(1190, 300, 55, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(1190, 355); g.lineTo(1190, 520); g.moveTo(1190, 400); g.lineTo(1110, 470); g.moveTo(1190, 400); g.lineTo(1280, 450);
    g.moveTo(1190, 520); g.lineTo(1130, 620); g.moveTo(1190, 520); g.lineTo(1250, 620); g.stroke();
    g.fillStyle = '#ff8fa8'; g.font = '110px "Luckiest Guy"'; g.fillText('?', 1300, 280);
  });
  const board = mesh(new THREE.PlaneGeometry(4.6, 2.0), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), false, true);
  board.position.set(-0.3, 1.85, BOARD_Z + 0.04); room.add(board);
  const frameMat = M(0xa8784e, { r: 0.7 });
  [[0, 1.0, 4.8, 0.1], [0, -1.0, 4.8, 0.1]].forEach(([x, y, w, h]) => { const f = mesh(RB(w, h, 0.08, 0.02), frameMat); f.position.set(-0.3 + x, 1.85 + y, BOARD_Z + 0.06); room.add(f); });
  [[-2.35], [2.35]].forEach(([x]) => { const f = mesh(RB(0.1, 2.1, 0.08, 0.02), frameMat); f.position.set(-0.3 + x, 1.85, BOARD_Z + 0.06); room.add(f); });
  const tray = mesh(RB(4.6, 0.05, 0.14, 0.02), frameMat); tray.position.set(-0.3, 0.83, BOARD_Z + 0.1); room.add(tray);

  // clock
  const clockTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 12; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; g.lineWidth = 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * 95, 128 - Math.cos(a) * 95); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke(); }
    g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50, 128 - 30); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 10, 128 - 90); g.stroke();
  });
  const clock = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32), [M(0x333333), new THREE.MeshStandardMaterial({ map: clockTex }), M(0x333333)]);
  clock.rotation.x = PI / 2; clock.position.set(2.9, 2.95, BOARD_Z + 0.04); room.add(clock);

  // posters
  const poster = (txt1, txt2, bg, fg, x, y, z, ry, w = 0.9, h = 1.2) => {
    const tex = canvasTex(360, 480, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, 360, 480);
      g.fillStyle = fg; g.textAlign = 'center'; g.font = '70px "Luckiest Guy"'; g.fillText(txt1, 180, 170);
      g.font = '800 40px Montserrat'; g.fillText(txt2, 180, 260);
      g.beginPath(); g.arc(180, 370, 60, 0, 7); g.fill();
    });
    const p = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), false, true);
    p.position.set(x, y, z); p.rotation.y = ry; room.add(p);
  };
  poster('STAY', 'CALM :)', '#ffcf5a', '#3a2a10', 3.4, 1.9, BOARD_Z + 0.03, 0);
  poster('READ', 'MORE BOOKS', '#7ec8ff', '#123', 4.5, 1.9, BOARD_Z + 0.03, 0);
  poster('BE', 'KIND', '#ff9db5', '#401020', -5.47, 2.0, 5.2, PI / 2);

  // windows on left wall
  const skyTex = canvasTex(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#7cc4ff'); grd.addColorStop(0.7, '#cfeaff'); grd.addColorStop(1, '#bfe6a8');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    [[60, 70, 40], [100, 60, 30], [190, 100, 34], [220, 92, 26]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    g.fillStyle = '#6dbb5a'; g.beginPath(); g.arc(70, 260, 70, 0, 7); g.fill(); g.beginPath(); g.arc(200, 270, 80, 0, 7); g.fill();
  });
  const winMat = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false });
  for (const z of [-3.4, -0.4, 2.6, 5.6]) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), winMat);
    glass.rotation.y = PI / 2; glass.position.set(-5.47, 2.0, z); room.add(glass);
    const fm = M(0xffffff, { r: 0.5 });
    [[0, 0.83, 1.95, 0.08], [0, -0.83, 1.95, 0.1], [0, 0, 1.9, 0.05]].forEach(([dz, dy, w, h]) => { const f = mesh(BOX(0.08, h, w), fm); f.position.set(-5.44, 2.0 + dy, z + dz); room.add(f); });
    [[-0.93], [0.93], [0]].forEach(([dz]) => { const f = mesh(BOX(0.08, 1.7, 0.07), fm); f.position.set(-5.44, 2.0, z + dz); room.add(f); });
  }
  // ceiling lights
  for (const x of [-2.5, 2.5]) for (const z of [-3, 1, 5]) {
    const l = new THREE.Mesh(BOX(1.4, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.position.set(x, 3.57, z); room.add(l);
  }
}

// desks & chairs
const deskTopMat = M(0xd9a46b, { r: 0.55 });
const metalMat = M(0x7b8794, { r: 0.4, m: 0.6 });
const chairMat = M(0x4f8fd9, { r: 0.6 });
function makeDesk(x, z, ry = PI) {
  const g = new THREE.Group();
  const top = mesh(RB(1.05, 0.06, 0.62, 0.025), deskTopMat); top.position.y = 0.76; g.add(top);
  for (const [dx, dz] of [[-0.46, -0.25], [0.46, -0.25], [-0.46, 0.25], [0.46, 0.25]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8), metalMat); leg.position.set(dx, 0.37, dz); g.add(leg);
  }
  const book = mesh(RB(0.28, 0.04, 0.2, 0.01), M([0xe85d5d, 0x5da8e8, 0x8ed36b, 0xf2c14e][Math.floor(hash(x, z) * 4)])); book.position.set(0.2, 0.81, 0.05); book.rotation.y = hash(z, x) - .5; g.add(book);
  // chair (behind desk relative to facing)
  const ch = new THREE.Group();
  const seat = mesh(RB(0.48, 0.05, 0.44, 0.02), chairMat); seat.position.y = 0.46; ch.add(seat);
  const backr = mesh(RB(0.48, 0.34, 0.04, 0.02), chairMat); backr.position.set(0, 0.74, -0.22); ch.add(backr);
  for (const [dx, dz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 6), metalMat); leg.position.set(dx, 0.23, dz); ch.add(leg);
  }
  ch.position.z = -0.62; g.add(ch);
  g.position.set(x, 0, z); g.rotation.y = ry;
  room.add(g);
  return g;
}
const DESK_X = [-2.7, -0.9, 0.9, 2.7];
const DESK_Z = [-0.2, 1.7, 3.6, 5.5];
for (const z of DESK_Z) for (const x of DESK_X) makeDesk(x, z);
// teacher desk
{
  const g = new THREE.Group();
  const top = mesh(RB(1.8, 0.08, 0.85, 0.03), M(0x9c6a3f, { r: 0.5 })); top.position.y = 0.8; g.add(top);
  const body = mesh(RB(1.7, 0.74, 0.08, 0.02), M(0x8a5a33)); body.position.set(0, 0.4, 0.38); g.add(body);
  for (const dx of [-0.8, 0.8]) { const s = mesh(RB(0.08, 0.76, 0.8, 0.02), M(0x8a5a33)); s.position.set(dx, 0.4, 0); g.add(s); }
  const apple = mesh(new THREE.IcosahedronGeometry(0.07, 1), M(0xe03030, { flat: true, r: 0.4 })); apple.position.set(0.5, 0.91, 0); g.add(apple);
  const stack = mesh(RB(0.35, 0.12, 0.26, 0.01), M(0xf5f0e6)); stack.position.set(-0.4, 0.9, 0); g.add(stack);
  g.position.set(3.0, 0, -4.3); g.rotation.y = PI; room.add(g);
}

// ---------------------------------------------------------------------------
// characters
// ---------------------------------------------------------------------------
const black = M(0x141414, { r: 0.45 });
const mouthMat = M(0x5c1b22, { r: 0.6 });
const pinkMat = M(0xff6f8e, { r: 0.45 });
const tongueMat = M(0xff7a9a, { r: 0.5 });
const whiteMat = M(0xffffff, { r: 0.4 });
const heartRed = M(0xff2d55, { r: 0.35, e: 0xff2d55, ei: 0.25 });

function makeChar(o) {
  const skinMat = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.72, flatShading: true });
  const skinSmooth = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.72 });
  const shirtMat = M(o.shirt, { r: 0.85 });
  const sleeveMat = M(o.sleeve ?? o.shirt, { r: 0.85 });
  const pantsMat = M(o.pants ?? 0x1f2a44, { r: 0.85 });
  const shoeMat = M(o.shoe ?? 0xf2f2f2, { r: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.85, flatShading: true });
  const c = { o, skinMat, skinSmooth, shirtMat, sleeveMat, hairMat, baseSkin: new THREE.Color(o.skin), baseShirt: new THREE.Color(o.shirt), baseHair: new THREE.Color(o.hair) };
  const root = new THREE.Group(); c.root = root;
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; root.add(pelvis); c.pelvis = pelvis;
  const hips = mesh(RB(0.46, 0.22, 0.27, 0.07), pantsMat); hips.position.y = 0.01; pelvis.add(hips); c.hipsMesh = hips;
  c.hip = {}; c.kn = {}; c.shoe = {}; c.shin = {};
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.115, -0.03, 0); pelvis.add(hip);
    const thigh = mesh(RB(0.2, 0.48, 0.22, 0.07), pantsMat); thigh.position.y = -0.22; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    const shin = mesh(RB(0.18, 0.42, 0.2, 0.06), pantsMat); shin.position.y = -0.19; knee.add(shin);
    const shoe = mesh(RB(0.21, 0.11, 0.34, 0.05), shoeMat); shoe.position.set(0, -0.41, 0.05); knee.add(shoe);
    c.hip[k] = hip; c.kn[k] = knee; c.shoe[k] = shoe; c.shin[k] = shin;
  }
  const spine = new THREE.Group(); spine.position.y = 0.08; pelvis.add(spine); c.spine = spine;
  const torso = mesh(RB(0.54, 0.64, 0.31, 0.1), shirtMat); torso.position.y = 0.31; spine.add(torso); c.torso = torso;
  if (o.hoodie) {
    const hood = mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 16), shirtMat); hood.position.set(0, 0.62, -0.08); hood.rotation.x = PI / 2 + 0.5; spine.add(hood);
    const pocket = mesh(RB(0.34, 0.14, 0.04, 0.02), M(new THREE.Color(o.shirt).multiplyScalar(0.8))); pocket.position.set(0, 0.12, 0.155); spine.add(pocket);
    for (const s of [-1, 1]) { const st = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), whiteMat); st.position.set(s * 0.06, 0.48, 0.16); spine.add(st); }
  }
  if (o.stripe) { const s = mesh(RB(0.545, 0.09, 0.315, 0.03), M(o.stripe)); s.position.y = 0.36; spine.add(s); }
  const neck = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 10), skinSmooth); neck.position.y = 0.67; spine.add(neck);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.7; spine.add(headPivot); c.headPivot = headPivot;
  const head = new THREE.Group(); head.position.y = 0.25; headPivot.add(head); c.head = head;
  const skull = mesh(new THREE.IcosahedronGeometry(0.25, 1), skinMat); skull.scale.set(0.98, 1.12, 0.96); head.add(skull); c.skull = skull;
  // ears
  for (const s of [-1, 1]) { const e = mesh(new THREE.IcosahedronGeometry(0.05, 0), skinMat); e.scale.set(0.6, 1, 1); e.position.set(s * 0.245, 0.0, -0.01); head.add(e); }
  // nose
  const nose = mesh(RB(0.05, 0.075, 0.07, 0.02, 2), skinMat); nose.position.set(0, -0.01, 0.235); head.add(nose);
  // face
  const face = new THREE.Group(); head.add(face); c.face = face;
  c.eye = {}; c.brow = {};
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const eg = new THREE.Group(); eg.position.set(side * 0.088, 0.045, 0.214); face.add(eg);
    const box = mesh(BOX(1, 1, 0.04), black, false, false); box.scale.set(0.058, 0.09, 1); eg.add(box);
    const xg = new THREE.Group(); eg.add(xg);
    for (const r of [0.785, -0.785]) { const b = mesh(BOX(0.085, 0.02, 0.04), black, false, false); b.rotation.z = r; xg.add(b); }
    const ht = mesh(heartGeo, heartRed, false, false); ht.scale.setScalar(0.055); eg.add(ht);
    const white = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), whiteMat, false, false); white.rotation.x = PI / 2; white.position.z = -0.005; eg.add(white);
    c.eye[k] = { g: eg, box, xg, ht, white, side };
    const brow = mesh(BOX(0.085, 0.022, 0.04), black, false, false); brow.position.set(side * 0.088, 0.13, 0.208); face.add(brow);
    c.brow[k] = brow;
  }
  const m = {};
  m.line = mesh(BOX(0.09, 0.02, 0.03), mouthMat, false, false);
  m.open = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 18), mouthMat, false, false); m.open.rotation.x = PI / 2;
  m.teeth = mesh(BOX(0.075, 0.018, 0.03), whiteMat, false, false); m.teeth.position.set(0, 0.022, 0.006);
  m.tongue = mesh(RB(0.06, 0.09, 0.03, 0.014, 2), tongueMat, false, false); m.tongue.position.set(0, -0.055, 0.012);
  m.pucker = new THREE.Group();
  { const t = mesh(new THREE.TorusGeometry(0.03, 0.017, 8, 16), pinkMat, false, false); m.pucker.add(t); const d = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), mouthMat, false, false); d.rotation.x = PI / 2; m.pucker.add(d); }
  m.smile = mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, PI), mouthMat, false, false); m.smile.rotation.z = PI;
  const mouth = new THREE.Group(); mouth.position.set(0, -0.095, 0.215); face.add(mouth); c.mouth = mouth;
  Object.values(m).forEach(x => mouth.add(x)); c.m = m;
  // cheeks (puff)
  c.cheek = {};
  for (const [k, s] of [['R', -1], ['L', 1]]) { const ch = mesh(new THREE.IcosahedronGeometry(0.07, 1), skinMat, false, false); ch.position.set(s * 0.12, -0.07, 0.17); ch.scale.setScalar(0.01); head.add(ch); c.cheek[k] = ch; }
  // blush
  c.blush = {};
  for (const [k, s] of [['R', -1], ['L', 1]]) { const b = mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0xff7d9a, transparent: true, opacity: 0.0 }), false, false); b.position.set(s * 0.14, -0.035, 0.222); b.rotation.y = s * 0.35; face.add(b); c.blush[k] = b; }

  // hair
  c.hairs = {};
  const cap = new THREE.Group();
  { const g = mesh(new THREE.SphereGeometry(0.27, 9, 6, 0, PI * 2, 0, PI * 0.5), hairMat); g.scale.set(0.99, 1.0, 1.0); g.rotation.x = -0.42; g.position.set(0, 0.06, -0.015); cap.add(g); }
  if (o.hairStyle === 'quiff') {
    for (let i = 0; i < 4; i++) { const q = mesh(new THREE.ConeGeometry(0.09, 0.24, 5), hairMat); q.position.set(-0.11 + i * 0.075, 0.27, 0.07 - i * 0.02); q.rotation.set(0.75, 0, (i - 1.5) * -0.12); cap.add(q); }
  } else if (o.hairStyle === 'long') {
    const b = mesh(RB(0.5, 0.55, 0.16, 0.07), hairMat); b.position.set(0, -0.1, -0.17); cap.add(b);
  } else if (o.hairStyle === 'bun') {
    const b = mesh(new THREE.IcosahedronGeometry(0.11, 1), hairMat); b.position.set(0, 0.3, -0.14); cap.add(b);
  } else if (o.hairStyle === 'curly') {
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const b = mesh(new THREE.IcosahedronGeometry(0.09, 0), hairMat); b.position.set(Math.cos(a) * 0.2, 0.2 + hash(i) * 0.06, Math.sin(a) * 0.18 - 0.04); cap.add(b); }
  } else {
    // default: little fringe
    const f = mesh(RB(0.36, 0.08, 0.1, 0.03), hairMat); f.position.set(0.02, 0.21, 0.15); f.rotation.set(0.5, 0, 0.12); cap.add(f);
  }
  head.add(cap); c.hairs.cap = cap;
  const afro = new THREE.Group();
  {
    const afroMat = new THREE.MeshStandardMaterial({ color: 0x232020, roughness: 1, flatShading: true }); c.afroMat = afroMat;
    const a = mesh(new THREE.IcosahedronGeometry(0.34, 1), afroMat); a.position.set(0, 0.29, -0.09); a.scale.set(1.08, 0.8, 0.95); afro.add(a);
    for (let i = 0; i < 9; i++) { const b = mesh(new THREE.IcosahedronGeometry(0.11, 0), afroMat); const an = i / 9 * PI * 2; b.position.set(Math.cos(an) * 0.33, 0.3 + hash(i, 3) * 0.1, Math.sin(an) * 0.27 - 0.12); afro.add(b); }
  }
  afro.visible = false; head.add(afro); c.hairs.afro = afro;
  if (o.glasses) {
    const gl = new THREE.Group();
    for (const s of [-1, 1]) { const l = mesh(RB(0.11, 0.075, 0.02, 0.02, 2), M(0x111111, { r: 0.2, m: 0.3 }), false, false); l.position.set(s * 0.088, 0.045, 0.24); gl.add(l); }
    const br = mesh(BOX(0.07, 0.015, 0.02), black, false, false); br.position.set(0, 0.06, 0.24); gl.add(br);
    head.add(gl); c.glasses = gl;
  }

  // arms
  c.sh = {}; c.el = {}; c.hand = {};
  for (const [k, side] of [['R', -1], ['L', 1]]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.33, 0.55, 0); spine.add(sh);
    const sleeve = mesh(RB(0.18, 0.26, 0.19, 0.07), sleeveMat); sleeve.position.y = -0.09; sh.add(sleeve);
    const upper = mesh(RB(0.13, 0.3, 0.13, 0.055), o.longSleeve ? sleeveMat : skinSmooth); upper.position.y = -0.17; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.31; sh.add(elbow);
    const fore = mesh(RB(0.12, 0.28, 0.12, 0.05), o.longSleeve ? sleeveMat : skinSmooth); fore.position.y = -0.13; elbow.add(fore);
    const hand = mesh(RB(0.13, 0.14, 0.09, 0.04), skinSmooth); hand.position.y = -0.32; elbow.add(hand);
    const thumb = mesh(RB(0.05, 0.11, 0.05, 0.02), skinSmooth); thumb.position.set(-side * 0.0, -0.22, 0.07); thumb.visible = false; elbow.add(thumb);
    const anchor = new THREE.Group(); anchor.position.y = -0.33; elbow.add(anchor);
    c.sh[k] = sh; c.el[k] = elbow; c.hand[k] = anchor; c['thumb' + k] = thumb;
  }
  scene.add(root);
  return c;
}

const DEF_POSE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, spX: 0, spY: 0, spZ: 0, hdX: 0, hdY: 0, hdZ: 0, hdLift: 0,
  shRx: 0, shRy: 0, shRz: 0.07, shLx: 0, shLy: 0, shLz: 0.07, elR: 0.12, elL: 0.12,
  hipRx: 0, hipRz: 0.02, hipLx: 0, hipLz: 0.02, knR: 0, knL: 0, pelY: 0.92, pelX: 0 };
function P(o = {}) { return Object.assign({}, DEF_POSE, o); }
function mix(a, b, k) { const r = {}; for (const key in a) r[key] = lerp(a[key], b[key] ?? a[key], k); return r; }
function applyPose(c, p) {
  c.root.position.set(p.x, p.y, p.z);
  c.root.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
  c.pelvis.position.y = p.pelY; c.pelvis.rotation.x = p.pelX;
  c.spine.rotation.set(p.spX, p.spY, p.spZ);
  c.headPivot.rotation.set(p.hdX, p.hdY, p.hdZ);
  c.headPivot.position.z = p.hdLift;
  c.sh.R.rotation.set(-p.shRx, p.shRy, -p.shRz); c.sh.L.rotation.set(-p.shLx, -p.shLy, p.shLz);
  c.el.R.rotation.x = -p.elR; c.el.L.rotation.x = -p.elL;
  c.hip.R.rotation.set(-p.hipRx, 0, -p.hipRz); c.hip.L.rotation.set(-p.hipLx, 0, p.hipLz);
  c.kn.R.rotation.x = p.knR; c.kn.L.rotation.x = p.knL;
}
const _box = new THREE.Box3();
function ground(c, extra = 0) {
  c.root.updateMatrixWorld(true);
  let mn = Infinity;
  for (const m of [c.shoe.R, c.shoe.L, c.shin.R, c.shin.L, c.hipsMesh]) { _box.setFromObject(m); mn = Math.min(mn, _box.min.y); }
  c.root.position.y -= mn - extra;
  c.root.updateMatrixWorld(true);
}
const DEF_FACE = { eyes: 'open', eyeR: null, eyeL: null, eyeScale: 1, look: 0, lookY: 0, brow: 0, browY: 0, browR: null, browL: null, mouth: 'line', mouthScale: 1, puff: 0, blush: 0, thumbR: false, thumbL: false };
function setFace(c, f) {
  f = Object.assign({}, DEF_FACE, f);
  for (const k of ['R', 'L']) {
    const e = c.eye[k]; const mode = (k === 'R' ? f.eyeR : f.eyeL) ?? f.eyes;
    e.box.visible = ['open', 'wide', 'half', 'closed', 'sly', 'tiny'].includes(mode);
    e.xg.visible = mode === 'x'; e.ht.visible = mode === 'heart'; e.white.visible = mode === 'wide' || mode === 'tiny';
    const s = f.eyeScale;
    if (mode === 'open') { e.box.scale.set(0.058, 0.09 * s, 1); e.box.position.set(f.look * 0.02, f.lookY * 0.02, 0); }
    if (mode === 'wide') { e.box.scale.set(0.05, 0.075, 1); e.box.position.set(f.look * 0.02, f.lookY * 0.015, 0.012); e.white.scale.set(1.15, 1, 1.35); }
    if (mode === 'tiny') { e.box.scale.set(0.022, 0.03, 1); e.box.position.set(f.look * 0.02, 0, 0.012); e.white.scale.set(1.1, 1, 1.3); }
    if (mode === 'half') { e.box.scale.set(0.064, 0.045, 1); e.box.position.set(f.look * 0.02, -0.018, 0); }
    if (mode === 'sly') { e.box.scale.set(0.066, 0.04, 1); e.box.position.set(f.look * 0.02 + e.side * 0.004, -0.012, 0); }
    if (mode === 'closed') { e.box.scale.set(0.075, 0.017, 1); e.box.position.set(0, -0.01, 0); }
    if (mode === 'heart') { const hs = 0.06 * s; e.ht.scale.setScalar(hs); }
    const bAng = (k === 'R' ? f.browR : f.browL) ?? f.brow;
    c.brow[k].rotation.z = (k === 'R' ? -1 : 1) * bAng;
    c.brow[k].position.y = 0.13 + f.browY * 0.03 + (mode === 'wide' ? 0.025 : 0);
  }
  for (const key in c.m) c.m[key].visible = false;
  c.mouth.scale.setScalar(f.mouthScale);
  c.mouth.rotation.z = 0; c.mouth.position.x = 0;
  switch (f.mouth) {
    case 'line': c.m.line.visible = true; break;
    case 'smirk': c.m.line.visible = true; c.mouth.rotation.z = 0.28; c.mouth.position.x = 0.02; break;
    case 'smile': c.m.smile.visible = true; break;
    case 'open': c.m.open.visible = true; c.m.open.scale.set(1, 1, 0.8); break;
    case 'o': c.m.open.visible = true; c.m.open.scale.set(0.6, 1, 0.75); break;
    case 'grin': c.m.open.visible = true; c.m.open.scale.set(1.25, 1, 0.55); c.m.teeth.visible = true; break;
    case 'scream': c.m.open.visible = true; c.m.open.scale.set(1.2, 1, 1.4); c.m.tongue.visible = true; c.m.tongue.position.y = -0.03; break;
    case 'tongue': c.m.open.visible = true; c.m.open.scale.set(0.9, 1, 0.6); c.m.tongue.visible = true; c.m.tongue.position.y = -0.055; break;
    case 'pucker': c.m.pucker.visible = true; c.m.pucker.position.z = 0.02; break;
  }
  const pf = f.puff;
  for (const k of ['R', 'L']) { c.cheek[k].scale.setScalar(0.01 + pf * 1.25); c.blush[k].material.opacity = f.blush; }
  c.skull.scale.set(0.98 + pf * 0.1, 1.12, 0.96);
  c.thumbR.visible = f.thumbR; c.thumbL.visible = f.thumbL;
}
function tint(c, purple = 0, soot = 0) {
  const s = c.baseSkin.clone().lerp(new THREE.Color(0x8a5bd6), purple).lerp(new THREE.Color(0x3b3330), soot * 0.75);
  c.skinMat.color.copy(s); c.skinSmooth.color.copy(s);
  c.shirtMat.color.copy(c.baseShirt.clone().lerp(new THREE.Color(0x2a2a2a), soot * 0.35));
  c.sleeveMat.color.copy(c.shirtMat.color);
}

// cast
const you = makeChar({ skin: 0xf0c49a, shirt: 0x3a8ee8, pants: 0x232d4b, hair: 0x6b3f22, hairStyle: 'fringe' });
const crush = makeChar({ skin: 0xc98d62, shirt: 0xe9473f, pants: 0x262626, hair: 0x1b1b1b, hairStyle: 'quiff', hoodie: true, longSleeve: true, shoe: 0x222222 });
const classmates = [];
const CM = [
  { skin: 0xf2c8a0, shirt: 0x7bd389, hair: 0xd9a441, hairStyle: 'long', pants: 0x34495e },
  { skin: 0x8d5a3b, shirt: 0xf2c14e, hair: 0x111111, hairStyle: 'curly', pants: 0x2c3e50 },
  { skin: 0xe8b88a, shirt: 0xb07cf2, hair: 0x3b2314, hairStyle: 'bun', pants: 0x1f2a44 },
  { skin: 0xf6d2b0, shirt: 0xff8a5c, hair: 0x9a4a1f, hairStyle: 'fringe', pants: 0x2b2b2b, glasses: true },
  { skin: 0xb5764e, shirt: 0x4ecdc4, hair: 0x1a1a1a, hairStyle: 'fringe', pants: 0x3d3d3d },
  { skin: 0xf0c49a, shirt: 0xff6fa5, hair: 0x241a12, hairStyle: 'long', pants: 0x283655 },
  { skin: 0x6e4630, shirt: 0xffffff, hair: 0x0f0f0f, hairStyle: 'bun', pants: 0x1f2a44, stripe: 0xe74c3c },
  { skin: 0xf2c8a0, shirt: 0x95a5a6, hair: 0xe0c070, hairStyle: 'curly', pants: 0x2c3e50, glasses: true },
  { skin: 0xd59b6f, shirt: 0x5b7cfa, hair: 0x2a1a10, hairStyle: 'fringe', pants: 0x222222 },
  { skin: 0xf6d2b0, shirt: 0xf7d046, hair: 0x5c3a1e, hairStyle: 'long', pants: 0x34495e },
];
const SEATS = [[-0.9, -0.2], [0.9, -0.2], [-0.9, 1.7], [0.9, 1.7], [-0.9, 3.6], [0.9, 3.6], [-2.7, -0.2], [2.7, -0.2], [-2.7, 1.7], [2.7, 1.7]];
CM.forEach((o, i) => {
  const c = makeChar(o); c.seat = SEATS[i]; c.phone = i !== 3 && i !== 7;
  const ph = new THREE.Group();
  const b = mesh(RB(0.08, 0.16, 0.014, 0.012, 2), M(0x15151a, { r: 0.3 })); ph.add(b);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.145), new THREE.MeshBasicMaterial({ color: 0x9fdcff, toneMapped: false })); scr.position.z = -0.008; scr.rotation.y = PI; ph.add(scr);
  ph.position.set(0, -0.02, 0.03); c.hand.R.add(ph); c.phoneMesh = ph;
  classmates.push(c);
});

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------
const props = {};
props.stick = (() => {
  const g = new THREE.Group();
  const m = M(0x7a4e2b, { r: 0.9, flat: true });
  const s = mesh(new THREE.CylinderGeometry(0.016, 0.026, 1.25, 6), m); s.rotation.x = PI / 2; s.position.z = 0.62; g.add(s);
  const tw = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 5), m); tw.position.set(0.05, 0.03, 0.75); tw.rotation.set(PI / 2, 0, -0.8); g.add(tw);
  const leaf = mesh(new THREE.IcosahedronGeometry(0.035, 0), M(0x5cbf4a, { flat: true })); leaf.scale.set(1, 0.3, 1.6); leaf.position.set(0.12, 0.07, 0.82); g.add(leaf);
  scene.add(g); return g;
})();
props.blower = (() => {
  const g = new THREE.Group();
  const orange = M(0xff7a1a, { r: 0.45 }), dark = M(0x2b2b2b, { r: 0.6 });
  const body = mesh(RB(0.26, 0.24, 0.36, 0.08), orange); body.position.set(0, 0.0, -0.05); g.add(body);
  const motor = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 16), dark); motor.rotation.z = PI / 2; motor.position.set(0.15, 0, -0.05); g.add(motor);
  const handle = mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 12, PI), dark); handle.position.set(0, 0.12, -0.05); handle.rotation.y = PI / 2; g.add(handle);
  const tube = mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 14), orange); tube.rotation.x = PI / 2; tube.position.set(0, -0.03, 0.55); g.add(tube);
  const tip = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), dark); tip.rotation.x = PI / 2; tip.position.set(0, -0.03, 0.98); g.add(tip);
  scene.add(g); return g;
})();
props.phone = (() => {
  const g = new THREE.Group();
  const b = mesh(RB(0.085, 0.17, 0.014, 0.012, 2), M(0x15151a, { r: 0.3 })); g.add(b);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.155), new THREE.MeshBasicMaterial({ color: 0x7fd3ff, toneMapped: false })); scr.position.z = 0.008; g.add(scr);
  g.userData.scr = scr;
  scene.add(g); return g;
})();
props.defib = (() => {
  const g = new THREE.Group();
  const box = mesh(RB(0.42, 0.26, 0.3, 0.05), M(0xffd21f, { r: 0.4 })); box.position.y = 0.13; g.add(box);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), new THREE.MeshBasicMaterial({ color: 0x40ff9a, toneMapped: false })); scr.position.set(-0.07, 0.17, 0.152); g.add(scr);
  const bolt = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xe02020 })); bolt.position.set(0.11, 0.17, 0.152); g.add(bolt);
  const hdl = mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 12, PI), M(0x222222)); hdl.position.y = 0.27; g.add(hdl);
  scene.add(g); return g;
})();
function makePaddle() {
  const g = new THREE.Group();
  const h = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), M(0x2a2a2a)); h.position.y = -0.04; g.add(h);
  const pl = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18), M(0xd8dde3, { r: 0.25, m: 0.8 })); pl.position.y = -0.13; g.add(pl);
  const red = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 10), M(0xe02020)); red.position.y = 0.045; g.add(red);
  return g;
}
props.padR = makePaddle(); props.padL = makePaddle();
crush.hand.R.add(props.padR); crush.hand.L.add(props.padL);
props.backpack = (() => {
  const g = new THREE.Group();
  const purple = M(0x6c4ad6, { r: 0.8 });
  const b = mesh(RB(0.42, 0.5, 0.26, 0.1), purple); b.position.y = 0.25; g.add(b);
  const p = mesh(RB(0.3, 0.2, 0.08, 0.05), M(0x5a3cc0)); p.position.set(0, 0.16, 0.15); g.add(p);
  const z = mesh(BOX(0.3, 0.015, 0.02), M(0xffd21f)); z.position.set(0, 0.48, 0.12); g.add(z);
  scene.add(g); return g;
})();
props.lily = (() => {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 5), M(0x3e9a3a)); stem.position.y = -0.1; g.add(stem);
  for (let i = 0; i < 5; i++) { const p = mesh(new THREE.ConeGeometry(0.035, 0.12, 5), M(0xffffff, { r: 0.5, e: 0xffffff, ei: 0.08 })); const a = i / 5 * PI * 2; p.position.set(Math.cos(a) * 0.035, 0.13, Math.sin(a) * 0.035); p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(p); }
  const c = mesh(new THREE.IcosahedronGeometry(0.02, 0), M(0xffd21f)); c.position.y = 0.11; g.add(c);
  scene.add(g); return g;
})();
// hearts
const hearts = [];
for (let i = 0; i < 8; i++) { const h = mesh(heartGeo, M(0xff4f7b, { r: 0.35, e: 0xff2d6b, ei: 0.35 }), false, false); h.scale.setScalar(0.06); scene.add(h); hearts.push(h); }
// flames
const flames = new THREE.Group(); scene.add(flames);
const flameParts = [];
for (let i = 0; i < 14; i++) {
  const inner = i % 2 === 1;
  const m = new THREE.MeshBasicMaterial({ color: inner ? 0xffe14d : (i % 3 === 0 ? 0xff3d1a : 0xff7a1a), transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false });
  const f = new THREE.Mesh(new THREE.ConeGeometry(inner ? 0.06 : 0.09, 1, 6), m);
  flames.add(f); flameParts.push({ f, inner, a: hash(i, 1) * PI * 2, r: (inner ? 0.05 : 0.11) + hash(i, 2) * 0.1, h: (inner ? 0.25 : 0.35) + hash(i, 3) * 0.25, ph: hash(i, 4) * 10 });
}
// smoke
const smoke = [];
for (let i = 0; i < 12; i++) { const s = mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false }), false, false); scene.add(s); smoke.push(s); }
// dust
const dust = [];
for (let i = 0; i < 14; i++) { const s = mesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 1, flatShading: true, transparent: true, opacity: 0.8, depthWrite: false }), false, false); scene.add(s); dust.push(s); }
// sparks
const sparks = [];
for (let i = 0; i < 40; i++) { const s = new THREE.Mesh(BOX(0.018, 0.018, 0.09), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xbfefff : 0xffffff, toneMapped: false })); scene.add(s); sparks.push(s); }
// papers
const papers = [];
for (let i = 0; i < 10; i++) { const p = mesh(new THREE.PlaneGeometry(0.21, 0.28), M(0xfdfdf7, { side: THREE.DoubleSide }), true, false); scene.add(p); papers.push(p); }

// ---------------------------------------------------------------------------
// timeline data
// ---------------------------------------------------------------------------
let WORDS = [];
let CHUNKS = [];
function buildChunks() {
  const ws = [];
  for (const w of WORDS) {
    let t = w.w;
    if (t.startsWith('-') && ws.length) { ws[ws.length - 1].w += t; ws[ws.length - 1].e = w.e; continue; }
    ws.push({ w: t, s: w.s, e: w.e });
  }
  ws.forEach(w => { w.end = /[.,?!]$/.test(w.w); w.w = w.w.replace(/[.,]/g, '').toUpperCase(); });
  const chunks = []; let cur = [];
  ws.forEach((w, i) => {
    cur.push(w);
    const len = cur.map(x => x.w).join(' ').length;
    const next = ws[i + 1];
    if (w.end || cur.length >= 3 || len > 13 || (next && next.s - w.e > 0.45) || (next && (cur.map(x => x.w).join(' ') + ' ' + next.w).length > 17)) { chunks.push(cur); cur = []; }
  });
  if (cur.length) chunks.push(cur);
  chunks.forEach((c, i) => {
    c.s = c[0].s - 0.04;
    const nx = chunks[i + 1];
    c.e = nx && nx[0].s - c[c.length - 1].e < 0.7 ? nx[0].s - 0.04 : c[c.length - 1].e + 0.3;
  });
  CHUNKS = chunks;
}

// SFX words (times in ORIGINAL voiceover seconds)
const SFX = [
  { s: 'THUD!', T: 4.42, d: 0.8, x: 0.5, y: 0.2, rot: -0.12, size: 190, fill: '#FFD21F' },
  { s: 'POKE!', T: 7.42, d: 0.55, x: 0.3, y: 0.2, rot: -0.15, size: 130, fill: '#FFFFFF' },
  { s: 'POKE!', T: 8.12, d: 0.7, x: 0.7, y: 0.26, rot: 0.14, size: 150, fill: '#FFFFFF' },
  { s: 'MWAH?', T: 9.2, d: 0.9, x: 0.5, y: 0.17, rot: -0.08, size: 150, fill: '#FF7AA2' },
  { s: 'VRRRRM', T: 10.75, d: 1.3, x: 0.5, y: 0.17, rot: 0.06, size: 150, fill: '#FF8A1F', shake: 1 },
  { s: 'WHOOOSH!', T: 12.7, d: 1.4, x: 0.5, y: 0.17, rot: -0.07, size: 160, fill: '#E9F7FF', shake: 0.6 },
  { s: 'ROUND 2', T: 14.25, d: 0.9, x: 0.5, y: 0.18, rot: -0.04, size: 185, fill: '#FFD21F' },
  { s: 'BEEP BOOP', T: 16.3, d: 0.75, x: 0.5, y: 0.13, rot: 0.06, size: 120, fill: '#FFFFFF' },
  { s: 'CLICK!', T: 18.25, d: 0.5, x: 0.27, y: 0.24, rot: -0.15, size: 105, fill: '#FFFFFF' },
  { s: 'CLICK!', T: 18.85, d: 0.5, x: 0.72, y: 0.2, rot: 0.12, size: 105, fill: '#FFFFFF' },
  { s: 'CLICK!', T: 19.35, d: 0.6, x: 0.45, y: 0.14, rot: -0.05, size: 115, fill: '#FFFFFF' },
  { s: 'R.I.P.', T: 20.4, d: 1.0, x: 0.5, y: 0.16, rot: 0, size: 150, fill: '#D9D9D9' },
  { s: 'CLEAR!', T: 22.75, d: 0.75, x: 0.5, y: 0.17, rot: -0.1, size: 190, fill: '#FF3B30', stroke: '#FFFFFF', shake: 0.4 },
  { s: 'ZAP!', T: 23.45, d: 0.55, x: 0.5, y: 0.2, rot: 0.08, size: 260, fill: '#FFF04A', shake: 1.5 },
  { s: 'SIZZLE', T: 24.3, d: 1.0, x: 0.5, y: 0.16, rot: -0.06, size: 120, fill: '#FF9A3D' },
  { s: 'BRO.', T: 27.08, d: 0.7, x: 0.5, y: 0.12, rot: -0.05, size: 300, fill: '#FF3B30', stroke: '#FFFFFF', slam: 1 },
];

// ---------------------------------------------------------------------------
// staging helpers
// ---------------------------------------------------------------------------
const YOU_X = 0, YOU_Z = -2.4;      // where you stand / your feet when lying
const LIE = P({ x: YOU_X, y: 0.165, z: YOU_Z, rx: -PI / 2, hdLift: 0.075, shRz: 0.12, shLz: 0.12, hipRz: 0.06, hipLz: 0.06 });
function headWorld(c, off = V(0, 0, 0)) { c.root.updateMatrixWorld(true); return c.head.localToWorld(off.clone()); }
function partWorld(obj, off = V(0, 0, 0)) { return obj.localToWorld(off.clone()); }

const _tmpV = new THREE.Vector3();
function project(v) { _tmpV.copy(v).project(camera); return { x: (_tmpV.x + 1) / 2 * W, y: (1 - _tmpV.y) / 2 * H, z: _tmpV.z }; }

let SHAKE = 0;
function camLook(pos, target, fov = 40, roll = 0) {
  camera.up.set(0, 1, 0);
  camera.position.copy(pos);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.lookAt(target);
  if (roll) camera.rotateZ(roll);
}
const _q = new THREE.Quaternion();
function faceDir(c) { c.root.updateMatrixWorld(true); const d = V(0, 0, 1).applyQuaternion(c.head.getWorldQuaternion(_q)); d.y = 0; return d.normalize(); }
function faceCam(c, dist, yawOff = 0, up = 0, tdy = -0.12, fov = 40, roll = 0) {
  const hw = headWorld(c); const d = faceDir(c).applyAxisAngle(V(0, 1, 0), yawOff);
  camLook(hw.clone().addScaledVector(d, dist).add(V(0, up, 0)), hw.clone().add(V(0, tdy, 0)), fov, roll);
}
function camTop(target, dist, shiftZ = 0, fov = 40, roll = 0) {
  camera.up.set(0, 0, -1);
  camera.position.set(target.x, target.y + dist, target.z + shiftZ);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.lookAt(target.x, target.y, target.z + shiftZ);
  if (roll) camera.rotateZ(roll);
}

function hideAll() {
  for (const k of ['stick', 'blower', 'phone', 'defib', 'padR', 'padL', 'backpack', 'lily']) props[k].visible = false;
  props.phone.scale.setScalar(1);
  hearts.forEach(h => h.visible = false);
  flames.visible = false; smoke.forEach(s => s.visible = false); dust.forEach(s => s.visible = false);
  sparks.forEach(s => s.visible = false); papers.forEach(p => p.visible = false);
  fxLight.intensity = 0;
  you.hairs.cap.visible = true; you.hairs.afro.visible = false;
  you.hairs.cap.rotation.set(0, 0, 0); you.hairs.cap.position.set(0, 0, 0);
  setFace(you, {}); setFace(crush, {});
  tint(you, 0, 0);
  you.hairMat.color.copy(you.baseHair);
  hemi.intensity = 1.35; sun.intensity = 2.6; fill.intensity = 0.55;
  hemi.color.set(0xeaf4ff); sun.color.set(0xfff1dc);
  scene.background.set(0xbfe3ff);
}

function seatClassmates(T, focus, mode) {
  classmates.forEach((c, i) => {
    const [sx, sz] = c.seat;
    const p = P({ x: sx, z: sz + 0.6, ry: PI, hipRx: PI / 2, hipLx: PI / 2, knR: PI / 2 - 0.05, knL: PI / 2 - 0.05, pelY: 0.55, spX: 0.05,
      shRx: 0.5, shLx: 0.5, elR: 0.9, elL: 0.9, shRz: 0.1, shLz: 0.1 });
    let face = { eyes: 'open' };
    c.phoneMesh.visible = false;
    if (focus) {
      const hp = V(sx, 1.2, sz + 0.6);
      const d = focus.clone().sub(hp);
      let yaw = Math.atan2(d.x, d.z) - PI; while (yaw < -PI) yaw += 2 * PI; while (yaw > PI) yaw -= 2 * PI;
      const turn = clamp(yaw, -1.3, 1.3);
      p.hdY = turn * 0.6; p.spY = turn * 0.35; p.hdX = 0.15;
      if (mode === 'film' && c.phone) { p.shRx = 1.45; p.elR = 1.0; p.shRz = -0.1; p.hdX = 0.05; c.phoneMesh.visible = true; }
      face = { eyes: (i % 3 === 0) ? 'wide' : 'open', mouth: (i % 2 === 0) ? 'o' : 'open', mouthScale: 0.8, brow: -0.2, browY: 0.5 };
    } else {
      const bob = Math.sin(T * 2 + i) * 0.05;
      p.hdX = 0.25 + bob; p.hdY = Math.sin(T * 0.7 + i * 2) * 0.2;
      face = { eyes: hash(Math.floor(T * 3), i) > 0.93 ? 'closed' : 'open' };
    }
    applyPose(c, p); setFace(c, face);
  });
}

function placeHearts(T, from, spread = 0.35, n = 6, t0 = 0, rise = 0.7, hs = 0.075) {
  for (let i = 0; i < n; i++) {
    const h = hearts[i];
    const ph = ((T - t0) * 0.9 + i / n) % 1;
    h.visible = true;
    const a = hash(i, 7) * PI * 2;
    h.position.set(from.x + Math.cos(a) * spread * (0.3 + ph), from.y + 0.15 + ph * rise, from.z + Math.sin(a) * spread * (0.3 + ph));
    const s = Math.sin(ph * PI) * hs; h.scale.setScalar(Math.max(0.001, s));
    h.rotation.set(0, Math.sin(T * 3 + i) * 0.5, Math.sin(T * 4 + i) * 0.3);
    h.lookAt(camera.position); h.rotateZ(Math.sin(T * 5 + i) * 0.3);
  }
}

function placeFlames(T, base, scale = 1) {
  flames.visible = true;
  flames.position.copy(base);
  flameParts.forEach((p, i) => {
    const fl = 0.75 + 0.45 * Math.abs(noise1(T * 1.7, p.ph));
    const h = p.h * fl * scale;
    p.f.scale.set(scale * (0.9 + 0.2 * noise1(T * 2, i)), h, scale * (0.9 + 0.2 * noise1(T * 2.3, i + 3)));
    p.f.position.set(Math.cos(p.a) * p.r * scale, h / 2, Math.sin(p.a) * p.r * scale);
    p.f.rotation.set(noise1(T, i) * 0.25, 0, noise1(T, i + 7) * 0.25);
  });
  fxLight.color.set(0xff8a2a); fxLight.position.copy(base).add(V(0, 0.3, 0.2));
  fxLight.intensity = 2.5 + Math.abs(noise1(T * 2, 3)) * 2; fxLight.distance = 3;
}
function placeSmoke(T, base, amt = 1, dark = 0x666666) {
  smoke.forEach((s, i) => {
    const ph = (T * 0.55 + i / smoke.length) % 1;
    s.visible = true;
    s.material.color.set(dark);
    s.position.set(base.x + Math.sin(i * 2.1 + T) * 0.12 * (1 + ph), base.y + ph * 1.1, base.z + Math.cos(i * 1.7) * 0.1);
    s.scale.setScalar((0.5 + ph * 1.6) * amt);
    s.material.opacity = 0.55 * (1 - ph) * Math.min(1, ph * 6);
  });
}
function placeSparks(T, origin, spread = 1, n = 40, seed = 0) {
  sparks.forEach((s, i) => {
    if (i >= n) return;
    const life = 0.35;
    const ph = ((T * 2.2 + hash(i, seed)) % 1);
    const a = hash(i, seed + 1) * PI * 2, el = hash(i, seed + 2) * 1.2 + 0.1, sp = (0.6 + hash(i, seed + 3)) * spread;
    const tt = ph * life * 2;
    const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    s.visible = ph < 0.8;
    s.position.copy(origin).addScaledVector(dir, sp * tt * 1.6); s.position.y -= 2.5 * tt * tt;
    s.lookAt(s.position.clone().add(dir));
  });
}

// ---------------------------------------------------------------------------
// shots (T = original voiceover time)
// ---------------------------------------------------------------------------
const STAND_YOU = P({ x: YOU_X, z: YOU_Z });
const CROSS = { shRx: 0.25, shLx: 0.4, shRy: 1.5, shLy: 1.5, shRz: 0.08, shLz: 0.08, elR: 1.6, elL: 1.55 };
const CRUSH_STAND = P({ x: YOU_X - 1.05, z: YOU_Z - 0.15, ry: PI / 2 });

function shot(T) {
  hideAll();
  SHAKE = 0;
  let flash = 0;
  // defaults for crush/you; each shot overrides
  // -------------------------------------------------------------- S1 two-shot (crush on phone, you lovestruck)
  if (T < 1.55) {
    const k = prog(T, 0, 1.55);
    const sway = Math.sin(T * 4) * 0.08;
    applyPose(you, P({ x: YOU_X, z: YOU_Z, ry: -0.45, spZ: sway * 0.6, hdZ: 0.18 + sway, hdX: -0.05, shRx: 0.9, shLx: 0.9, shRz: -0.25, shLz: -0.25, elR: 1.5, elL: 1.5, shRy: 0.3, shLy: 0.3 }));
    setFace(you, { eyes: 'heart', eyeScale: 1 + Math.sin(T * 10) * 0.18, mouth: 'smile', blush: 0.75, brow: -0.25, browY: 0.6 });
    applyPose(crush, P({ x: YOU_X - 0.9, z: YOU_Z - 0.1, ry: PI / 2 - 0.3, hdX: 0.42, spX: 0.05, shRx: 0.95, elR: 1.25, shRz: -0.15, shLx: 0.85, elL: 1.35, shLz: -0.2, hipRz: 0.06, hipLz: -0.05, knL: 0.1 }));
    setFace(crush, { eyes: 'half', look: 0.0, mouth: 'line' });
    ground(you); ground(crush);
    props.phone.visible = true;
    crush.root.updateMatrixWorld(true);
    props.phone.position.copy(partWorld(crush.hand.R, V(0.04, 0.02, 0.03)));
    props.phone.lookAt(headWorld(crush)); props.phone.rotateX(-0.2);
    seatClassmates(T);
    const hw = headWorld(you);
    camLook(V(lerp(1.05, 0.85, eIO(k)), 1.62, lerp(-0.3, -0.7, eIO(k))), V(-0.42, 1.42, YOU_Z - 0.1), 46);
    placeHearts(T, hw.clone().add(V(0, 0.15, 0)), 0.28, 6);
  }
  // -------------------------------------------------------------- S2 sly close-up
  else if (T < 4.0) {
    const k = prog(T, 1.55, 4.0);
    const wig = (T > 2.9 && T < 3.6) ? Math.max(0, Math.sin((T - 2.9) * 18)) : 0;
    applyPose(you, P({ x: YOU_X, z: YOU_Z, ry: -PI / 2 + 0.9, hdY: 0.15, hdZ: -0.08, hdX: 0.04, shRx: 0.4, shRz: 0.15, elR: 2.2, shLx: 0.2 }));
    setFace(you, { eyes: 'sly', look: -0.6, mouth: T > 2.4 ? 'smirk' : 'line', brow: -0.35, browY: 0.3 + wig * 1.4, browR: -0.1 });
    applyPose(crush, P({ x: YOU_X - 0.9, z: YOU_Z - 0.1, ry: PI / 2 - 0.3, hdX: 0.42, shRx: 0.95, elR: 1.25, shRz: -0.15, shLx: 0.85, elL: 1.35, shLz: -0.2 }));
    ground(you); ground(crush);
    props.phone.visible = true; props.phone.position.copy(partWorld(crush.hand.R, V(0.04, 0.02, 0.03))); props.phone.lookAt(headWorld(crush));
    seatClassmates(T);
    const hw = headWorld(you);
    faceCam(you, lerp(1.5, 1.2, eIO(k)), 0.3, 0.02, -0.14, 40, 0.04);
  }
  // -------------------------------------------------------------- S3 the drop
  else if (T < 5.0) {
    const fk = eIn(prog(T, 4.12, 4.45));
    const bounce = T > 4.45 ? Math.sin(prog(T, 4.45, 4.7) * PI) * 0.12 * (1 - prog(T, 4.45, 4.7)) : 0;
    const stand = P({ x: YOU_X, z: YOU_Z, ry: 0, shRx: 2.5, shRz: 0.5, elR: 2.0, hdX: -0.25, spX: -0.12, shLz: 0.3 });
    const fallen = mix(stand, LIE, 1);
    const p = mix(stand, LIE, fk);
    p.rx = lerp(0, -PI / 2, fk) + bounce;
    p.y = lerp(0, LIE.y, fk) + bounce * 0.4;
    p.shRx = lerp(2.5, 0.2, prog(T, 4.3, 4.6)); p.elR = lerp(2.0, 0.3, prog(T, 4.3, 4.6));
    p.shLz = lerp(0.3, 0.9, fk); p.shRz = lerp(0.5, 0.9, fk);
    applyPose(you, p);
    setFace(you, { eyes: T < 4.12 ? 'half' : 'closed', mouth: T < 4.3 ? 'o' : 'open', mouthScale: 0.8, brow: -0.4, browY: 0.6 });
    const react = prog(T, 4.5, 4.62);
    applyPose(crush, P({ x: YOU_X - 1.2, z: YOU_Z + 0.55, ry: PI / 2 - 0.1 + react * 0.6, hdX: lerp(0.42, -0.05, react), hdY: react * 0.3, shRx: 0.95, elR: 1.25, shRz: -0.15, shLx: 0.85, elL: 1.35, shLz: -0.2 }));
    setFace(crush, { eyes: react > 0.5 ? 'wide' : 'half', mouth: react > 0.5 ? 'o' : 'line', mouthScale: 0.6 });
    ground(crush);
    props.phone.visible = true; props.phone.position.copy(partWorld(crush.hand.R, V(0.04, 0.02, 0.03))); props.phone.lookAt(headWorld(crush));
    seatClassmates(T);
    camLook(V(2.35, 1.45, YOU_Z + 1.55), V(-0.35, 0.6, YOU_Z - 0.95), 44);
    if (T > 4.45) {
      SHAKE = 0.06 * (1 - prog(T, 4.45, 4.9));
      const dk = prog(T, 4.45, 5.0);
      dust.forEach((d, i) => {
        const a = i / dust.length * PI * 2;
        d.visible = true;
        d.position.set(YOU_X + Math.cos(a) * (0.35 + dk * 0.9), 0.08 + dk * 0.25 * hash(i), YOU_Z - 1.0 + Math.sin(a) * (0.6 + dk * 0.9));
        d.scale.set(0.8 + dk * 1.8, 0.5 + dk * 0.9, 0.8 + dk * 1.8); d.material.opacity = 0.6 * (1 - dk);
      });
    }
  }
  // -------------------------------------------------------------- S4 semi-genius peek (top down)
  else if (T < 6.75) {
    applyPose(you, LIE);
    const peek = T > 5.35 && T < 6.35;
    const look = peek ? Math.sin((T - 5.35) * 5) : 0;
    setFace(you, { eyes: 'closed', eyeR: peek ? 'open' : 'closed', look: look * 0.9, brow: 0, browR: peek ? -0.3 : 0, browY: peek ? 0.2 : 0, mouth: peek ? 'smirk' : 'line' });
    placeCrushNearby(T, 'stand');
    seatClassmates(T);
    const hw = headWorld(you);
    const k = prog(T, 5.0, 6.75);
    camTop(hw, lerp(1.65, 1.4, eIO(k)), 0.27, 40, 0.06);
  }
  // -------------------------------------------------------------- S5 poke with a stick
  else if (T < 9.0) {
    const pokes = [7.3, 7.62, 8.0, 8.22];
    let poke = 0; for (const pt of pokes) poke = Math.max(poke, Math.max(0, 1 - Math.abs(T - pt) / 0.11));
    const jig = poke * 0.04;
    const p = Object.assign({}, LIE); p.y += jig;
    applyPose(you, p);
    setFace(you, { eyes: 'closed', mouth: poke > 0.3 ? 'o' : 'line', mouthScale: 0.6, brow: poke * 0.4 });
    const cx = YOU_X - 0.72, cz = YOU_Z - 1.45;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2 + 0.25, hipRx: 1.95, hipLx: 1.7, knR: 2.35, knL: 2.2, hipRz: 0.25, hipLz: 0.2, spX: 0.45, hdX: 0.1, hdY: -0.2,
      shRx: 0.9 + poke * 0.35, elR: 0.5 - poke * 0.3, shRz: -0.2, shLx: 0.5, elL: 1.4, shLz: 0.1 }));
    ground(crush);
    setFace(crush, { eyes: 'half', mouth: 'line', brow: 0.2 });
    crush.root.updateMatrixWorld(true);
    const hand = partWorld(crush.hand.R, V(0, 0.02, 0));
    const target = headWorld(you, V(0.13, -0.05, 0.12));
    const dir = target.clone().sub(hand).normalize();
    props.stick.visible = true;
    props.stick.position.copy(hand).addScaledVector(dir, -0.05 + poke * 0.08 - 0.12);
    props.stick.lookAt(target);
    seatClassmates(T);
    const k = prog(T, 6.75, 9.0);
    camLook(V(lerp(1.75, 1.55, k), 1.35, YOU_Z - 0.35), V(YOU_X - 0.4, 0.45, YOU_Z - 1.6), 44);
    SHAKE = poke * 0.012;
  }
  // -------------------------------------------------------------- S6 pucker up (top down)
  else if (T < 10.1) {
    const p = Object.assign({}, LIE); p.hdX = -0.05;
    applyPose(you, p);
    const k = prog(T, 9.0, 10.1);
    setFace(you, { eyes: 'closed', mouth: T > 9.15 ? 'pucker' : 'line', mouthScale: 1 + 0.25 * Math.max(0, Math.sin(T * 14)), brow: -0.3, browY: 0.8, blush: 0.8 });
    placeCrushNearby(T, 'stand');
    seatClassmates(T);
    const hw = headWorld(you);
    camTop(hw, lerp(1.55, 1.3, eOut(k)), 0.25, 40, -0.05);
    placeHearts(T, hw.clone().add(V(0, -0.05, 0)), 0.3, 7, 0, 0.35, 0.045);
  }
  // -------------------------------------------------------------- S7 grabs a leaf blower
  else if (T < 12.6) {
    applyPose(you, LIE);
    setFace(you, { eyes: 'closed', mouth: 'pucker' });
    const k = prog(T, 10.1, 12.6);
    const pop = eBack(prog(T, 10.25, 10.6));
    const rev = T > 10.7 ? noise1(T * 3, 1) * 0.04 : 0;
    const cx = YOU_X - 0.75, cz = YOU_Z - 1.85;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2 + 0.15, spX: 0.15, hdX: 0.15, shRx: 0.6 + rev, shRz: -0.05, elR: 0.6, shLx: 1.0 + rev, shLz: -0.35, elL: 0.9, hipRz: 0.12, hipLz: 0.12 }));
    ground(crush);
    setFace(crush, { eyes: 'open', brow: 0.45, browY: -0.2, mouth: T > 10.7 ? 'grin' : 'line' });
    crush.root.updateMatrixWorld(true);
    const hand = partWorld(crush.hand.R, V(0, 0.0, 0));
    const aim = headWorld(you, V(0, 0, 0));
    props.blower.visible = true;
    props.blower.position.copy(hand).add(V(0, rev, 0));
    props.blower.lookAt(aim);
    props.blower.scale.setScalar(Math.max(0.001, pop));
    seatClassmates(T);
    camLook(V(lerp(2.35, 2.15, k), 1.15, YOU_Z - 0.15), V(cx + 0.05, lerp(1.1, 1.2, k), cz - 0.05), 46, -0.04);
    SHAKE = T > 10.7 ? 0.008 : 0;
  }
  // -------------------------------------------------------------- S8 right in your face
  else if (T < 14.2) {
    const k = prog(T, 12.6, 14.2);
    const blow = prog(T, 12.6, 12.8);
    const p = Object.assign({}, LIE);
    p.hdY = noise1(T * 4, 2) * 0.1 * blow;
    applyPose(you, p);
    const flap = Math.sin(T * 70) * blow;
    setFace(you, { eyes: 'closed', mouth: 'scream', mouthScale: 1 + flap * 0.15, brow: -0.3 + flap * 0.2, browY: 0.5, puff: 0.5 + flap * 0.4 });
    you.skull.scale.x += flap * 0.04; you.skull.scale.y += -flap * 0.03;
    you.hairs.cap.rotation.x = -0.25 * blow + flap * 0.08; you.hairs.cap.position.y = 0.02 * blow;
    placeCrushNearby(T, 'blower');
    seatClassmates(T);
    const hw = headWorld(you);
    camTop(hw, 1.5, 0.24, 42, 0.04);
    SHAKE = 0.01 * blow;
    papers.forEach((pp, i) => {
      const ph = ((T - 12.6) * 0.9 + hash(i, 5)) % 1;
      pp.visible = T > 12.65;
      pp.position.set(hw.x - 0.6 + ph * 1.6 + Math.sin(i) * 0.1, hw.y + 0.2 + Math.sin(ph * 6 + i) * 0.15 + hash(i, 6) * 0.3, hw.z - 0.5 + hash(i, 7) * 1.0);
      pp.rotation.set(T * 6 + i, T * 4 + i * 2, T * 5);
    });
  }
  // -------------------------------------------------------------- S9 ROUND 2
  else if (T < 15.1) {
    applyPose(you, LIE);
    setFace(you, { eyes: 'closed', mouth: 'line', brow: 0.3 });
    placeCrushNearby(T, 'blowerDown');
    seatClassmates(T);
    const k = prog(T, 14.2, 15.1);
    camLook(V(2.05, lerp(2.4, 2.2, k), YOU_Z + 0.35), V(YOU_X - 0.45, 0.55, YOU_Z - 1.45), 46, lerp(0.08, 0.02, eOut(k)));
  }
  // -------------------------------------------------------------- S10 stop breathing
  else if (T < 16.1) {
    const k = prog(T, 15.1, 16.1);
    applyPose(you, LIE);
    const strain = noise1(T * 3, 5) * 0.03 * k;
    setFace(you, { eyes: 'closed', mouth: 'line', mouthScale: 0.7, brow: 0.5, puff: eOut(prog(T, 15.2, 15.6)) * 0.9 });
    you.skull.scale.x += strain;
    tint(you, eIO(prog(T, 15.25, 16.0)), 0);
    placeCrushNearby(T, 'blowerDown');
    seatClassmates(T);
    const hw = headWorld(you);
    camTop(hw, lerp(1.55, 1.3, k), 0.25, 40, 0.03 + strain);
    SHAKE = 0.004 * k;
  }
  // -------------------------------------------------------------- S11 calls 911 on speaker
  else if (T < 17.8) {
    const k = prog(T, 16.1, 17.8);
    applyPose(you, LIE); tint(you, 1, 0);
    setFace(you, { eyes: 'closed', puff: 0.9, brow: 0.5 });
    const cx = YOU_X - 0.85, cz = YOU_Z - 1.6;
    const talk = Math.sin(T * 22) > 0;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2 + 0.5, shRx: 1.9, shRz: 0.15, elR: 0.6, shLx: 0.15, shLz: 0.35, elL: 0.3, hdX: -0.12, spX: -0.05, hdZ: 0.06 }));
    ground(crush);
    setFace(crush, { eyes: 'wide', mouth: talk ? 'open' : 'o', mouthScale: 0.9, brow: -0.2, browY: 0.4 });
    crush.root.updateMatrixWorld(true);
    props.phone.visible = true;
    props.phone.position.copy(partWorld(crush.hand.R, V(0, -0.02, 0.07)));
    props.phone.scale.setScalar(1.5);
    seatClassmates(T);
    const hw = headWorld(crush);
    const pp = props.phone.position.clone();
    const dir = faceDir(crush).applyAxisAngle(V(0, 1, 0), -0.35);
    const cp = hw.clone().addScaledVector(dir, lerp(1.85, 1.6, k)).add(V(0, -0.2, 0));
    props.phone.lookAt(cp);
    camLook(cp, hw.clone().lerp(pp, 0.4).add(V(0, -0.25, 0)), 44, 0.03);
  }
  // -------------------------------------------------------------- S12 the whole class
  else if (T < 20.0) {
    const k = prog(T, 17.8, 20.0);
    applyPose(you, LIE); tint(you, 1, 0);
    setFace(you, { eyes: 'closed', puff: 0.9, brow: 0.5 });
    const cx = YOU_X - 0.85, cz = YOU_Z - 1.6;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2 + 1.2, shRx: 1.9, shRz: 0.15, elR: 0.6, hdX: -0.12 }));
    ground(crush);
    setFace(crush, { eyes: 'open', mouth: Math.sin(T * 22) > 0 ? 'open' : 'o', mouthScale: 0.9 });
    crush.root.updateMatrixWorld(true);
    props.phone.visible = true; props.phone.position.copy(partWorld(crush.hand.R, V(0, -0.05, 0.02))); props.phone.lookAt(headWorld(crush, V(0, 0, 0.3)));
    seatClassmates(T, V(YOU_X, 0.2, YOU_Z - 1.0), 'film');
    classmates.forEach(c => { if (c.phone) { c.root.updateMatrixWorld(true); } });
    camLook(V(lerp(0.12, 0.0, eIO(k)), lerp(1.35, 1.55, eIO(k)), lerp(-3.0, -3.5, eIO(k))), V(0.0, 0.85, 2.2), 52);
  }
  // -------------------------------------------------------------- S13 full corpse
  else if (T < 21.4) {
    const k = prog(T, 20.0, 21.4);
    const p = Object.assign({}, LIE, CROSS);
    applyPose(you, p); tint(you, 0.35, 0);
    setFace(you, { eyes: 'x', mouth: 'tongue', mouthScale: 1.1 });
    you.root.updateMatrixWorld(true);
    props.lily.visible = true;
    props.lily.position.copy(partWorld(you.spine, V(0, 0.42, 0.22)));
    props.lily.rotation.set(-PI / 2 + 0.2, 0, 0.5);
    placeCrushNearby(T, 'kneel');
    seatClassmates(T, V(YOU_X, 0.2, YOU_Z - 1.0));
    hemi.intensity = 0.55; sun.intensity = 0.9; fill.intensity = 0.25; hemi.color.set(0xa9b8ff);
    scene.background.set(0x223044);
    const hw = headWorld(you);
    camTop(hw, lerp(2.1, 1.85, k), 0.5, 42, 0.0);
    fxLight.color.set(0xd8e4ff); fxLight.intensity = 3.5; fxLight.distance = 3.5; fxLight.position.copy(hw).add(V(0, 1.2, 0.3));
  }
  // -------------------------------------------------------------- S14 pulls out a defibrillator
  else if (T < 23.45) {
    const k = prog(T, 21.4, 23.45);
    const p = Object.assign({}, LIE, CROSS);
    applyPose(you, p); tint(you, 0.35, 0);
    setFace(you, { eyes: 'x', mouth: 'tongue' });
    const cx = YOU_X - 0.78, cz = YOU_Z - 1.05;
    const up = eOut(prog(T, 21.95, 22.35));
    const rub = T > 22.3 && T < 22.75 ? Math.sin((T - 22.3) * 40) * 0.12 : 0;
    const raise = eBack(prog(T, 22.7, 22.95));
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2, hipRx: 1.6, knR: 1.65, hipLx: 0.1, knL: 1.7, hipRz: 0.15, hipLz: 0.1, spX: lerp(0.4, 0.05, up), hdX: lerp(0.4, 0.0, up),
      shRx: lerp(0.9, 1.3, up) + raise * 1.3, shLx: lerp(0.9, 1.3, up) + raise * 1.3, shRz: lerp(0, -0.35, up) + rub - raise * -0.4, shLz: lerp(0, -0.35, up) - rub - raise * -0.4,
      elR: lerp(0.6, 1.2, up) - raise * 0.9, elL: lerp(0.6, 1.2, up) - raise * 0.9 }));
    ground(crush);
    setFace(crush, { eyes: 'open', brow: 0.55, browY: -0.3, mouth: 'grin', mouthScale: 1.1 });
    crush.root.updateMatrixWorld(true);
    props.backpack.visible = true; props.backpack.position.set(cx - 0.15, 0, cz + 0.65); props.backpack.rotation.y = 0.6;
    props.defib.visible = true;
    const db = prog(T, 21.5, 21.9);
    props.defib.position.set(cx + 0.25 - 0.2 * (1 - eOut(db)), 0.0 + Math.sin(db * PI) * 0.25, cz + 0.55);
    props.defib.rotation.set(0, -0.4 + db * 0.4, 0);
    props.padR.visible = props.padL.visible = T > 21.95;
    props.padR.rotation.set(0, 0, 0); props.padL.rotation.set(0, 0, 0);
    seatClassmates(T, V(YOU_X, 0.2, YOU_Z - 1.0));
    hemi.intensity = 0.6; sun.intensity = 1.0; fill.intensity = 0.3; hemi.color.set(0xa9b8ff); scene.background.set(0x223044);
    faceCam(crush, lerp(2.4, 2.1, k), -0.45, -0.25, -0.22, 46, -0.05);
    if (T > 22.3) {
      const a = partWorld(props.padR, V(0, -0.14, 0)), b = partWorld(props.padL, V(0, -0.14, 0));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      placeSparks(T, mid, 0.6, 24, 3);
      fxLight.color.set(0x7fd8ff); fxLight.position.copy(mid); fxLight.intensity = 3 + hash(Math.floor(T * 30)) * 4; fxLight.distance = 3;
      ARC = [a, b];
    }
    SHAKE = T > 22.7 ? 0.01 : 0;
  }
  // -------------------------------------------------------------- S15 ZAP
  else if (T < 23.95) {
    const k = prog(T, 23.45, 23.95);
    const jump = Math.sin(prog(T, 23.5, 23.85) * PI) * 0.35;
    const conv = hash(Math.floor(T * 40));
    const p = Object.assign({}, LIE, { y: LIE.y + jump, shRx: 1.5 + conv * 0.8, shLx: 1.5 + (1 - conv) * 0.8, shRz: 0.6 + conv * 0.5, shLz: 0.6 + conv * 0.4, elR: 0.2, elL: 0.2, hipRz: 0.35, hipLz: 0.35, hdLift: 0.075 });
    applyPose(you, p); tint(you, 0, conv);
    setFace(you, { eyes: 'wide', mouth: 'scream', mouthScale: 1.1, brow: -0.4, browY: 1 });
    you.hairs.cap.position.y = conv * 0.06;
    const cx = YOU_X - 0.6, cz = YOU_Z - 1.05;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2, hipRx: 1.6, knR: 1.65, hipLx: 0.1, knL: 1.7, spX: 0.6, hdX: 0.2, shRx: 1.15, shLx: 1.15, shRz: -0.25, shLz: -0.25, elR: 0.4, elL: 0.4 }));
    ground(crush);
    setFace(crush, { eyes: 'closed', mouth: 'grin', brow: 0.5 });
    props.padR.visible = props.padL.visible = true;
    props.backpack.visible = true; props.backpack.position.set(cx - 0.15, 0, cz + 0.65);
    props.defib.visible = true; props.defib.position.set(cx + 0.25, 0, cz + 0.55);
    seatClassmates(T, V(YOU_X, 0.2, YOU_Z - 1.0));
    const fl = Math.floor(T * 24) % 2;
    hemi.intensity = fl ? 2.5 : 0.7; scene.background.set(fl ? 0xffffff : 0x223044); hemi.color.set(0xd8f0ff);
    you.root.updateMatrixWorld(true);
    const chest = partWorld(you.spine, V(0, 0.35, 0.2));
    placeSparks(T, chest, 1.4, 40, 9);
    fxLight.color.set(0x9fe6ff); fxLight.position.copy(chest).add(V(0, 0.5, 0)); fxLight.intensity = 6 + conv * 6; fxLight.distance = 4;
    camLook(V(1.35, 1.75, YOU_Z - 0.2), V(YOU_X - 0.15, 0.35, YOU_Z - 1.15), 50, (conv - 0.5) * 0.06);
    SHAKE = 0.05;
    flash = T < 23.56 ? 0.6 : (fl ? 0.14 : 0);
    ZAPPOS = chest;
  }
  // -------------------------------------------------------------- S16 hair on fire (sit up)
  else if (T < 25.2) {
    const k = prog(T, 23.95, 25.2);
    const twitch = hash(Math.floor(T * 12)) > 0.75 ? 0.06 : 0;
    applyPose(you, P({ x: YOU_X, z: YOU_Z - 0.4, ry: 0, hipRx: PI / 2, hipLx: PI / 2, knR: 0.25, knL: 0.4, hipRz: 0.12, hipLz: 0.08, spX: -0.1, hdX: 0.05 + twitch, hdZ: twitch,
      shRx: -0.5, shLx: -0.5, shRz: 0.3, shLz: 0.3, elR: 0.1, elL: 0.1 }));
    ground(you);
    tint(you, 0, 1);
    setFace(you, { eyes: 'tiny', mouth: 'o', mouthScale: 0.7, brow: -0.1, browY: 0.6 });
    you.hairs.cap.visible = true;
    you.hairMat.color.set(0x2b1a10);
    placeCrushNearby(T, 'standPaddles');
    seatClassmates(T, V(YOU_X, 0.6, YOU_Z - 0.4));
    const hw = headWorld(you);
    placeFlames(T, hw.clone().add(V(0, 0.2, -0.02)), 1.0);
    placeSmoke(T, hw.clone().add(V(0, 0.55, 0)), 1, 0x555555);
    camLook(hw.clone().add(V(0.2, -0.1, lerp(1.35, 1.05, eIO(k)))), hw.clone().add(V(0, 0.08, 0)), 42, 0.03);
  }
  // -------------------------------------------------------------- S17 you good, bro?
  else if (T < 27.0) {
    const k = prog(T, 25.2, 27.0);
    const cx = YOU_X - 0.95, cz = YOU_Z - 0.55;
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2 - 0.15, shLx: 1.2, shLz: 0.15, elL: 1.6, shLy: -0.3, shRz: 0.1, hdZ: -0.12, hdX: 0.08, spZ: 0.04 }));
    ground(crush);
    const talk = T > 25.9 && T < 26.7 && Math.sin(T * 24) > 0;
    setFace(crush, { eyes: 'open', mouth: talk ? 'open' : 'smile', mouthScale: 0.9, brow: -0.15, browY: 0.5, thumbL: true });
    applyPose(you, P({ x: YOU_X, z: YOU_Z - 0.4, ry: 0, hipRx: PI / 2, hipLx: PI / 2, knR: 0.25, knL: 0.4, spX: -0.1, shRx: -0.5, shLx: -0.5, shRz: 0.3, shLz: 0.3, elR: 0.1, elL: 0.1 }));
    ground(you); tint(you, 0, 1);
    you.hairMat.color.set(0x2b1a10);
    seatClassmates(T, V(YOU_X, 0.6, YOU_Z - 0.4));
    const yh = headWorld(you);
    placeFlames(T, yh.clone().add(V(0, 0.2, -0.02)), 0.75);
    placeSmoke(T, yh.clone().add(V(0, 0.5, 0)), 0.8, 0x555555);
    const hw = headWorld(crush);
    faceCam(crush, lerp(2.0, 1.75, k), 0.75, -0.1, -0.36, 44, -0.03);
    BUBBLE = { text: 'YOU GOOD, BRO?', at: hw.clone().add(V(0.05, 0.28, 0.1)), T0: 25.85 };
  }
  // -------------------------------------------------------------- S18 BRO.
  else if (T < 27.7) {
    const k = prog(T, 27.0, 27.7);
    applyPose(you, P({ x: YOU_X, z: YOU_Z - 0.4, ry: 0, hipRx: PI / 2, hipLx: PI / 2, knR: 0.25, knL: 0.4, spX: -0.1, shRx: -0.5, shLx: -0.5, shRz: 0.3, shLz: 0.3, elR: 0.1, elL: 0.1, hdZ: 0.05 }));
    ground(you); tint(you, 0, 1);
    you.hairMat.color.set(0x2b1a10);
    const tw = hash(Math.floor(T * 20)) > 0.5 ? 1 : 0;
    setFace(you, { eyes: 'tiny', eyeR: tw ? 'half' : 'tiny', mouth: 'line', mouthScale: 0.8, brow: 0.15, browR: tw ? 0.4 : 0.15 });
    placeCrushNearby(T, 'standPaddles');
    seatClassmates(T, V(YOU_X, 0.6, YOU_Z - 0.4));
    const hw = headWorld(you);
    placeFlames(T, hw.clone().add(V(0, 0.2, -0.02)), 0.5);
    placeSmoke(T, hw.clone().add(V(0, 0.45, 0)), 0.8, 0x555555);
    const z = T < 27.14 ? 0 : eOut(prog(T, 27.14, 27.24));
    faceCam(you, lerp(1.5, 1.08, z), 0, 0, -0.15, 40, (T > 27.14 ? 0.03 : 0));
    SHAKE = T > 27.14 ? 0.02 * (1 - prog(T, 27.14, 27.5)) : 0;
  }
  // -------------------------------------------------------------- S19 friend-zoned and electrocuted
  else if (T < 30.5) {
    const k = prog(T, 27.7, 30.5);
    const zz = hash(Math.floor(T * 9)) > 0.8 ? 1 : 0;
    applyPose(you, P({ x: YOU_X + 0.05, z: YOU_Z - 0.6, ry: -0.15, spX: 0.12, hdX: 0.12, hdZ: zz * 0.12, shRx: 0.05, shLx: 0.05, shRz: 0.03 + zz * 0.3, shLz: 0.03, elR: 0.05, elL: 0.05, knR: 0.08, knL: 0.08 }));
    ground(you); tint(you, 0, 1);
    setFace(you, { eyes: 'half', mouth: 'line', brow: -0.45, browY: 0.2 });
    you.hairs.cap.visible = false; you.hairs.afro.visible = true;
    const pat = Math.max(0, Math.sin(T * 9)) * 0.25;
    applyPose(crush, P({ x: YOU_X - 0.62, z: YOU_Z - 0.75, ry: 0.35, shLx: 1.25 + pat, shLz: 0.45, elL: 0.6 + pat, shLy: 0.3, hdZ: 0.1, hdY: 0.35 }));
    ground(crush);
    setFace(crush, { eyes: 'closed', mouth: 'smile', brow: -0.3, browY: 0.4 });
    seatClassmates(T, V(YOU_X, 1.0, YOU_Z - 0.6));
    const hw = headWorld(you);
    placeSmoke(T, hw.clone().add(V(0, 0.45, 0)), 0.9, 0x666666);
    if (zz) { you.root.updateMatrixWorld(true); placeSparks(T, partWorld(you.spine, V(0, 0.3, 0.2)), 0.5, 14, 17); }
    camLook(V(lerp(-0.2, -0.3, k), 1.62, YOU_Z + lerp(1.95, 1.7, eIO(k))), V(-0.28, 1.5, YOU_Z - 0.7), 55, 0.02);
    HEARTBREAK = hw.clone().add(V(0, 0.52, 0));
  }
  // -------------------------------------------------------------- S20 genius
  else {
    const k = prog(T, 30.5, 32.6);
    const zz = hash(Math.floor(T * 10)) > 0.85 ? 1 : 0;
    applyPose(you, P({ x: YOU_X + 0.05, z: YOU_Z - 0.6, ry: 0, spX: 0.05, hdX: 0.05, hdZ: zz * 0.08, shRx: 1.35, shRz: -0.1, elR: 1.45, shRy: 0.3, shLz: 0.05 }));
    ground(you); tint(you, 0, 1);
    const blink = (T > 31.3 && T < 31.42);
    setFace(you, { eyes: blink ? 'closed' : 'half', mouth: 'smirk', brow: -0.1, browY: 0.1, thumbR: true });
    you.hairs.cap.visible = false; you.hairs.afro.visible = true;
    applyPose(crush, P({ x: YOU_X - 0.7, z: YOU_Z - 1.1, ry: 0.3 }));
    ground(crush);
    seatClassmates(T, V(YOU_X, 1.0, YOU_Z - 0.6));
    const hw = headWorld(you);
    placeSmoke(T, hw.clone().add(V(0, 0.42, 0)), 0.8, 0x666666);
    if (zz) { you.root.updateMatrixWorld(true); placeSparks(T, partWorld(you.head, V(0.2, 0.25, 0)), 0.3, 10, 23); }
    faceCam(you, lerp(1.95, 1.65, eOut(k)), 0.15, 0.0, -0.3, 42, -0.02);
  }
  return flash;
}

// crush placements reused by several top-down shots
function placeCrushNearby(T, mode) {
  const cx = YOU_X - 0.8, cz = YOU_Z - 1.6;
  if (mode === 'stand') {
    applyPose(crush, P({ x: cx, z: cz, ry: PI / 2, spX: 0.25, hdX: 0.4, shRz: 0.1, shLz: 0.1 }));
    setFace(crush, { eyes: 'open', mouth: 'line' });
  } else if (mode === 'blower' || mode === 'blowerDown') {
    applyPose(crush, P({ x: cx, z: YOU_Z - 1.85, ry: PI / 2 + 0.15, spX: 0.15, hdX: 0.15, shRx: mode === 'blower' ? 0.6 : 0.2, elR: 0.6, shLx: 1.0, shLz: -0.35, elL: 0.9 }));
    setFace(crush, { eyes: 'open', brow: 0.4, mouth: 'grin' });
    ground(crush);
    crush.root.updateMatrixWorld(true);
    props.blower.visible = true; props.blower.scale.setScalar(1);
    props.blower.position.copy(partWorld(crush.hand.R));
    props.blower.lookAt(mode === 'blower' ? headWorld(you) : headWorld(you).add(V(0, -0.2, 0.6)));
    return;
  } else if (mode === 'kneel') {
    applyPose(crush, P({ x: YOU_X - 0.85, z: YOU_Z - 1.05, ry: PI / 2, hipRx: 1.6, knR: 1.65, hipLx: 0.1, knL: 1.7, spX: 0.3, hdX: 0.4, shRx: 0.35, shLx: 0.35, elR: 0.3, elL: 0.3 }));
    setFace(crush, { eyes: 'closed', mouth: 'line', brow: -0.4 });
  } else if (mode === 'standPaddles') {
    applyPose(crush, P({ x: YOU_X - 0.95, z: YOU_Z - 0.55, ry: PI / 2 - 0.15, shRx: 0.5, shLx: 0.5, elR: 0.9, elL: 0.9, shRz: 0.2, shLz: 0.2 }));
    setFace(crush, { eyes: 'open', mouth: 'smile' });
    props.padR.visible = props.padL.visible = true;
  }
  ground(crush);
}

// ---------------------------------------------------------------------------
// 2D overlay
// ---------------------------------------------------------------------------
let ARC = null, ZAPPOS = null, BUBBLE = null, HEARTBREAK = null;
function outlined(s, x, y, o = {}) {
  const size = o.size ?? 100;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y); ctx.rotate(o.rot ?? 0); ctx.scale(o.scale ?? 1, o.scale ?? 1);
  ctx.font = o.font ?? `${size}px "Luckiest Guy"`;
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const sw = size * (o.sw ?? 0.2);
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = sw;
    ctx.strokeText(s, size * 0.04, size * 0.07); ctx.fillText(s, size * 0.04, size * 0.07);
  }
  ctx.lineWidth = sw; ctx.strokeStyle = o.stroke ?? '#111';
  ctx.strokeText(s, 0, 0);
  ctx.fillStyle = o.fill ?? '#FFD21F';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function drawCaption(T) {
  const c = CHUNKS.find(ch => T >= ch.s && T < ch.e);
  if (!c) return;
  const size = 82;
  ctx.font = `900 ${size}px Montserrat`;
  const words = c.map(w => w.w);
  const space = size * 0.28;
  // wrap into lines (max width 900)
  const lines = [[]]; let lw = 0;
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width;
    if (lines[lines.length - 1].length && lw + space + ww > 900) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push(i); lw += (lw ? space : 0) + ww;
  });
  const pop = eBack(prog(T, c.s, c.s + 0.12));
  const sc = 0.82 + 0.18 * pop;
  const baseY = H * 0.655;
  const lh = size * 1.08;
  lines.forEach((ln, li) => {
    const widths = ln.map(i => ctx.measureText(words[i]).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (ln.length - 1);
    let x = W / 2 - total / 2 * sc;
    const y = baseY + (li - (lines.length - 1) / 2) * lh * sc;
    ln.forEach((i, j) => {
      const w = c[i];
      const spoken = T >= w.s - 0.02;
      const active = spoken && T < w.e + 0.05;
      const wsc = sc * (active ? 1.06 : 1);
      outlined(words[i], x + widths[j] * sc / 2, y, { font: `900 ${size}px Montserrat`, size, sw: 0.24, scale: wsc, fill: spoken ? '#FFD21F' : '#FFFFFF', stroke: '#0d0d0d' });
      x += (widths[j] + space) * sc;
    });
  });
}

function drawSFX(T) {
  for (const f of SFX) {
    if (T < f.T || T > f.T + f.d) continue;
    const k = (T - f.T);
    let sc = f.slam ? lerp(2.4, 1, eOut(clamp(k / 0.12))) : 0.25 + 0.75 * eBack(clamp(k / 0.16));
    const out = clamp((f.T + f.d - T) / 0.12);
    sc *= 0.7 + 0.3 * out;
    const sh = (f.shake ?? 0) * 8;
    const x = f.x * W + noise1(T * 6, 1) * sh, y = f.y * H + noise1(T * 6, 2) * sh;
    outlined(f.s, x, y, { size: f.size, rot: f.rot + Math.sin(k * 9) * 0.03, scale: sc, fill: f.fill, stroke: f.stroke ?? '#111', alpha: out, sw: 0.18 });
  }
}

function bolt(x1, y1, x2, y2, seed, wdt = 10, col = '#bff3ff') {
  const pts = [[x1, y1]];
  const n = 9; const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy); const nx = -dy / len, ny = dx / len;
  for (let i = 1; i < n; i++) { const t = i / n; const off = (hash(i, seed) - 0.5) * len * 0.28; pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]); }
  pts.push([x2, y2]);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = col; ctx.shadowBlur = 30;
  ctx.strokeStyle = col; ctx.lineWidth = wdt * 2.2; ctx.globalAlpha = 0.6;
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = wdt * 0.7; ctx.shadowBlur = 10;
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  ctx.restore();
}
function star(x, y, r, rot = 0, col = '#fff', alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col;
  ctx.shadowColor = col; ctx.shadowBlur = r * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const rr = i % 2 ? r * 0.22 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function heart2D(x, y, s, col, rot = 0, half = 0, split = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const path = () => { ctx.beginPath(); ctx.moveTo(0, 0.9); ctx.bezierCurveTo(-0.2, 0.65, -1, 0.2, -1, -0.3); ctx.bezierCurveTo(-1, -0.85, -0.35, -1.05, 0, -0.55); ctx.bezierCurveTo(0.35, -1.05, 1, -0.85, 1, -0.3); ctx.bezierCurveTo(1, 0.2, 0.2, 0.65, 0, 0.9); ctx.closePath(); };
  const crack = [[0, -0.55], [-0.15, -0.25], [0.12, 0.0], [-0.1, 0.3], [0.05, 0.55], [0, 0.9]];
  for (const side of split ? [-1, 1] : [0]) {
    ctx.save();
    if (side) {
      ctx.translate(side * split * 0.5, split * 0.3); ctx.rotate(side * split * 0.5);
      ctx.beginPath();
      ctx.moveTo(side * 2, -2); crack.forEach(([cx, cy]) => ctx.lineTo(cx, cy)); ctx.lineTo(side * 2, 2); ctx.closePath(); ctx.clip();
    }
    path(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 0.14; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function bubble(text, ax, ay, T0, T) {
  const k = eBack(prog(T, T0, T0 + 0.15));
  if (k <= 0) return;
  const size = 70;
  ctx.save();
  ctx.font = `900 ${size}px Montserrat`;
  const tw = ctx.measureText(text).width;
  const bw = tw + 90, bh = size + 70;
  const bx = clamp(ax - bw * 0.35, 30, W - bw - 30), by = Math.max(140, ay - bh - 140);
  ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(k, k); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(bx + 10, by + 14, bw, bh, 50); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(bx + bw * 0.3, by + bh - 5); ctx.lineTo(ax, ay); ctx.lineTo(bx + bw * 0.5, by + bh - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  roundRect(bx, by, bw, bh, 50); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw * 0.3 + 6, by + bh - 6); ctx.lineTo(bx + bw * 0.5 - 6, by + bh - 6); ctx.lineWidth = 14; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw / 2, by + bh / 2 + 4);
  ctx.restore();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function draw2D(T, flash) {
  ctx.clearRect(0, 0, W, H);
  // shot-specific 2D fx
  if (T >= 5.35 && T < 6.35) { const s = project(headWorld(you, V(-0.09, 0.05, 0.25))); const a = Math.sin(prog(T, 5.4, 5.75) * PI); if (a > 0) star(s.x - 70, s.y - 60, 55 * a, T * 3, '#fff7b0', a); }
  if (T >= 1.55 && T < 4.0) { const a = Math.sin(prog(T, 3.0, 3.35) * PI); if (a > 0) { const s = project(headWorld(you, V(0.09, 0.08, 0.25))); star(s.x + 60, s.y - 50, 60 * a, T * 4, '#ffffff', a); } }
  if (T >= 12.6 && T < 14.2) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const y = hash(i, 3) * H; const ph = ((T * 2.4 + hash(i, 4)) % 1);
      const x = -400 + ph * (W + 800); const len = 160 + hash(i, 5) * 320;
      ctx.lineWidth = 4 + hash(i, 6) * 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + len * 0.05); ctx.stroke();
    }
    ctx.restore();
  }
  if (T >= 17.8 && T < 20.0) {
    classmates.forEach((c, i) => {
      if (!c.phone) return;
      const pattern = [18.2, 18.8, 19.3, 18.5, 19.0, 19.6][i % 6] + (i > 5 ? 0.15 : 0);
      for (const off of [0, 0.75]) {
        const f = 1 - clamp(Math.abs(T - pattern - off) / 0.07);
        if (f > 0) { c.root.updateMatrixWorld(true); const s = project(partWorld(c.hand.R, V(0, 0.05, 0.05))); star(s.x, s.y, 110 * f, 0.3, '#ffffff', f); ctx.save(); ctx.globalAlpha = f * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, 90 * f, 0, 7); ctx.fill(); ctx.restore(); }
      }
    });
  }
  if (T >= 16.1 && T < 17.8) {
    // speaker waves from phone
    const s = project(partWorld(props.phone, V(0, 0, 0.02)));
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const ph = ((T * 2 + i / 3) % 1); ctx.globalAlpha = 1 - ph; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(s.x, s.y, 50 + ph * 140, -PI * 0.85, -PI * 0.15); ctx.stroke(); }
    ctx.restore();
    bubble('911?!', s.x, s.y - 40, 17.0, T);
  }
  if (ARC && T >= 22.3 && T < 23.45) {
    const a = project(ARC[0]), b = project(ARC[1]);
    for (let i = 0; i < 2; i++) bolt(a.x, a.y, b.x, b.y, Math.floor(T * 30) + i * 7, 7);
  }
  if (T >= 23.45 && T < 23.95 && ZAPPOS) {
    const c = project(ZAPPOS);
    for (let i = 0; i < 6; i++) { const a = hash(i, Math.floor(T * 30)) * PI * 2; const r = 380 + hash(i + 3, Math.floor(T * 30)) * 400; bolt(c.x, c.y, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, Math.floor(T * 30) * 3 + i, 9, '#9fe8ff'); }
  }
  if (BUBBLE && T >= 25.2 && T < 27.0) { const s = project(BUBBLE.at); bubble(BUBBLE.text, s.x, s.y, BUBBLE.T0, T); }
  if (HEARTBREAK && T >= 27.7 && T < 30.5) {
    const s = project(HEARTBREAK);
    const pop = eBack(prog(T, 27.75, 27.95));
    const split = eOut(prog(T, 28.25, 28.6)) * 0.55;
    const fall = prog(T, 28.6, 30.5);
    if (pop > 0) heart2D(s.x, s.y + fall * 120, 95 * pop, '#ff2d55', Math.sin(T * 3) * 0.05, 0, split);
    // stamp
    const sk = prog(T, 28.3, 28.42);
    if (T >= 28.3) {
      const sc = lerp(2.6, 1, eOut(sk));
      ctx.save(); ctx.globalAlpha = clamp(sk * 2); ctx.translate(W / 2, H * 0.47); ctx.rotate(-0.16); ctx.scale(sc, sc);
      ctx.font = '150px "Luckiest Guy"'; const tw = ctx.measureText('FRIENDZONED').width;
      ctx.strokeStyle = '#e8262b'; ctx.lineWidth = 16; roundRect(-tw / 2 - 40, -105, tw + 80, 190, 24); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.0)';
      outlined('FRIENDZONED', 0, 0, { size: 150, fill: '#ff2d2d', stroke: '#ffffff', sw: 0.12, shadow: true });
      ctx.restore();
    }
  }
  drawSFX(T);
  drawCaption(T);
  // vignette
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,240,${flash})`; ctx.fillRect(0, 0, W, H); }
  // cut flash (short white blink on hard cuts)
}

// ---------------------------------------------------------------------------
// render entry
// ---------------------------------------------------------------------------
function renderAt(t) {
  const T = t * SPEED;
  ARC = null; ZAPPOS = null; BUBBLE = null; HEARTBREAK = null;
  const flash = shot(T);
  scene.updateMatrixWorld(true);
  if (SHAKE > 0) {
    camera.position.x += noise1(T * 3, 11) * SHAKE;
    camera.position.y += noise1(T * 3, 23) * SHAKE;
    camera.rotateZ(noise1(T * 3, 37) * SHAKE * 0.8);
  }
  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
  draw2D(T, flash);
  return true;
}

(async () => {
  WORDS = await (await fetch('words.json')).json();
  buildChunks();
  await document.fonts.load('100px "Luckiest Guy"');
  await document.fonts.load('900 100px Montserrat');
  await document.fonts.load('800 100px Montserrat');
  await document.fonts.ready;
  window.renderAt = renderAt;
  window.DURATION = 31.95 / SPEED + 0.55;
  window.CHUNKS = CHUNKS;
  window.READY = true;
})();
