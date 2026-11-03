// Pregnant-man reel: scene, cast, 55 shots synced to the voiceover, anchors for overlays.
import { THREE, PI, clamp, lerp, ease, easeOut, easeIn, V, RNG, M, mesh, box, cyl, ico, canvasTex, P, Mannequin,
  addBeard, addBeanie, addPatches, addBelly, setBelly, addCoat, makeClipboard, makeBaby, makePigeon } from './toon.js';
const ff = new FontFace('Bangers', 'url(Bangers.ttf)'); await ff.load(); document.fonts.add(ff);
const { ST, DK, EX, buildAlley, buildStreet, buildDesk, buildExam, drawScan, drawEcg } = await import('./sets.js');

const SC = parseFloat(new URLSearchParams(location.search).get('s') || '1');
const W0 = Math.round(1080 * SC), H0 = Math.round(1920 * SC);
const canvas = document.getElementById('c'); canvas.width = W0; canvas.height = H0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W0, H0, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.03, 260);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);

// ---------------------------------------------------------------- lights, skies, sets
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.2); sun.castShadow = true;
const SM = SC < 1 ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xeaf2ff, 0.5); scene.add(fill, fill.target);
const grad = (stops) => canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const SKY = { day: grad([[0, '#7cc4f2'], [0.6, '#c4e6f8'], [1, '#fdebd8']]), dawn: grad([[0, '#8fb3e8'], [0.45, '#f7b7c8'], [0.75, '#ffc98f'], [1, '#ffe7b0']]),
  rain: grad([[0, '#5d6b82'], [0.6, '#7f8ca3'], [1, '#a3adc0']]), room: new THREE.Color(0xf3f7f9) };
const SET = { alley: buildAlley(scene), street: buildStreet(scene), desk: buildDesk(scene), exam: buildExam(scene) };
const AL = SET.alley, STR = SET.street, DS = SET.desk, XR = SET.exam;
const LIGHT = {
  alley: { c: V(0, 0, -0.8), dir: V(0.45, 1, 0.8), R: 7, sky: 0xdcefff, gnd: 0xf0dcc4, hi: 1.3, si: 2.6, col: 0xfff3e2, bg: SKY.day },
  dawn: { c: V(0, 0, -0.8), dir: V(0.9, 0.55, -0.6), R: 7, sky: 0xffd9c9, gnd: 0xd9c4c8, hi: 1.1, si: 2.4, col: 0xffc08f, bg: SKY.dawn },
  rain: { c: V(0, 0, -0.8), dir: V(0.3, 1, 0.6), R: 7, sky: 0x9aa8c0, gnd: 0x5a6274, hi: 0.95, si: 0.5, col: 0xc8d4e8, bg: SKY.rain },
  street: { c: V(ST.x + 4, 0, 0), dir: V(0.4, 1, 0.8), R: 14, sky: 0xdcefff, gnd: 0xf0dcc4, hi: 1.3, si: 2.6, col: 0xfff3e2, bg: SKY.day },
  desk: { c: V(DK.x, 0, -0.6), dir: V(-0.3, 1, 0.8), R: 6, sky: 0xffffff, gnd: 0xe3eee9, hi: 1.5, si: 1.8, col: 0xfff6ec, bg: SKY.room },
  exam: { c: V(EX.x, 0, -0.4), dir: V(0.25, 1, 0.65), R: 3.8, sky: 0xf6fbff, gnd: 0xdce8ee, hi: 1.55, si: 1.7, col: 0xfff8f0, bg: SKY.room },
};
function useSet(name, mood = null) {
  const key = mood || name; const set = name === 'alley' ? 'alley' : name;
  for (const k in SET) SET[k].group.visible = k === set;
  const L = LIGHT[key];
  hemi.color.setHex(L.sky); hemi.groundColor.setHex(L.gnd); hemi.intensity = L.hi;
  sun.color.setHex(L.col); sun.intensity = L.si; sun.position.copy(L.c).addScaledVector(L.dir.clone().normalize(), 20); sun.target.position.copy(L.c);
  const sc = sun.shadow.camera; sc.left = -L.R; sc.right = L.R; sc.top = L.R; sc.bottom = -L.R; sc.near = 1; sc.far = 45; sc.updateProjectionMatrix();
  fill.position.copy(L.c).add(V(-6, 3, 8)); fill.target.position.copy(L.c);
  scene.background = L.bg;
}
const A = (x, y, z) => V(x, y, z), St = (x, y, z) => V(ST.x + x, y, ST.z + z), Dk = (x, y, z) => V(DK.x + x, y, DK.z + z), Ex = (x, y, z) => V(EX.x + x, y, EX.z + z);
const ORIG = { alley: V(0, 0, 0), street: ST, desk: DK, exam: EX };

// ---------------------------------------------------------------- cast
const YOU = new Mannequin({ skin: 0xd9a77e, top: 0x7d8a5a, sleeves: 'long', bottom: 0x6b5a48, legs: 'pants', shoes: 0x3a3330, hair: 0x3b2a1e, hairStyle: 'none' });
addBeard(YOU); addBeanie(YOU); addPatches(YOU); addBelly(YOU);
const NURSE = new Mannequin({ skin: P.skin2, top: 0x6db8de, sleeves: 'short', bottom: 0x6db8de, legs: 'pants', shoes: 0xffffff, hair: 0x2a1a10, hairStyle: 'bun', scale: 0.96 });
const DOCV = [
  { skin: P.skin, hair: 0x6b4a2a, hs: 'short', gl: true, pants: 0x4a5a78, sc: 1.0 }, { skin: P.skin3, hair: 0x1a1a1a, hs: 'curly', gl: false, pants: 0x5aa58a, sc: 1.02 },
  { skin: P.skin4, hair: 0xd9a86a, hs: 'ponytail', gl: true, pants: 0x6db8de, sc: 0.95 }, { skin: P.skin2, hair: 0x9a9a9a, hs: 'balding', gl: true, pants: 0x4a5a78, sc: 1.04 },
  { skin: P.skin, hair: 0x2a1a10, hs: 'bob', gl: false, pants: 0x7a6aa8, sc: 0.94 }, { skin: P.skin3, hair: 0x2a1a10, hs: 'short', gl: true, pants: 0x5aa58a, sc: 1.0 },
  { skin: P.skin4, hair: 0xb5562a, hs: 'bun', gl: false, pants: 0x6db8de, sc: 0.96 }, { skin: P.skin2, hair: 0x1a1a1a, hs: 'short', gl: false, pants: 0x4a5a78, sc: 1.05 },
  { skin: P.skin, hair: 0xe0c070, hs: 'curly', gl: true, pants: 0x7a6aa8, sc: 0.97 }, { skin: P.skin3, hair: 0x9a9a9a, hs: 'balding', gl: false, pants: 0x5aa58a, sc: 1.01 },
  { skin: P.skin4, hair: 0x3a2214, hs: 'bob', gl: true, pants: 0x6db8de, sc: 0.95 },
];
const DOCS = DOCV.map(v => { const m = new Mannequin({ skin: v.skin, top: 0xfafafa, dress: 0xfafafa, sleeves: 'long', bottom: v.pants, legs: 'pants', shoes: 0x2c2f36, hair: v.hair, hairStyle: v.hs, glasses: v.gl, scale: v.sc }); addCoat(m); return m; });
const DOC = DOCS[0];
const BABY = makeBaby();
const PIG = makePigeon(); scene.add(PIG.g);
const PEOPLE = [YOU, NURSE, ...DOCS, BABY];
for (const m of PEOPLE) scene.add(m.group);
for (const m of PEOPLE) m.arms.forEach(a => { a.home = { tp: a.thumb.position.clone(), tr: a.thumb.rotation.clone(), ts: a.thumb.scale.clone(), fp: a.fingers.position.clone(), fs: a.fingers.scale.clone() }; });
DOC.glassesHome = DOC.glasses.position.clone();

// ---------------------------------------------------------------- props
const CLIP = makeClipboard(scene), CLIP2 = makeClipboard(scene);
const PEN = cyl(0.006, 0.006, 0.14, 6, M(0x2c4fa8, { std: true }), scene);
const PROBE = new THREE.Group(); scene.add(PROBE); box(0.05, 0.12, 0.04, M(0xf2f4f7, { std: true }), PROBE, 0, 0.06, 0); box(0.06, 0.02, 0.05, M(0x9fd0e8, { std: true }), PROBE, 0, 0, 0);
const SLICE = (() => { const g = new THREE.Group(); scene.add(g); const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2, 0.065); s.lineTo(0.2, -0.065); s.lineTo(0, 0);
  const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), M(0xffc85a, { std: true }), g); m.position.z = -0.01;
  box(0.035, 0.14, 0.035, M(0xd99a4a, { std: true }), g, 0.2, 0, 0); for (const [x, y] of [[0.08, 0.01], [0.13, -0.02]]) cyl(0.017, 0.017, 0.008, 8, M(0xd9452f, { std: true }), g, x, y, 0.014).rotation.x = PI / 2; return g; })();
const SIGN = (() => { const g = new THREE.Group(); scene.add(g); const t = canvasTex(256, 160, (x, w, h) => { x.fillStyle = '#c9a271'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2018'; x.font = '44px "Bangers", sans-serif'; x.textAlign = 'center'; x.fillText('WILL WORK', w / 2, 62); x.fillText('FOR PIZZA', w / 2, 118); });
  mesh(new THREE.BoxGeometry(0.42, 0.27, 0.012), [M(0xc9a271), M(0xc9a271), M(0xc9a271), M(0xc9a271), M(0xffffff, { std: true, map: t }), M(0xc9a271)], g); return g; })();
const BOOKS = Array.from({ length: 4 }, (_, i) => { const g = new THREE.Group(); scene.add(g); const c = M([0xe8463a, 0x5a8fd8, 0x7cc48a, 0xffc85a][i], { std: true });
  for (const s of [1, -1]) { const p = box(0.16, 0.22, 0.012, c, g, 0.08 * s, 0, 0); p.rotation.y = -0.25 * s; box(0.15, 0.2, 0.01, M(0xfffaf0), g, 0.075 * s, 0, 0.012).rotation.y = -0.25 * s; } return g; });
const SWEAT = (() => { const g = new THREE.Group(); scene.add(g); const d = ico(0.03, 1, M(0x8fd3ff, { std: true, r: 0.1, emissive: 0x6fbfef, ei: 0.3 }), g); d.scale.set(0.8, 1.2, 0.8);
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.04, 6), d.material); t.position.y = 0.035; g.add(t); return g; })();
const TEARS = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.009, 0), M(0x8fd3ff, { std: true, r: 0.1, emissive: 0x6fbfef, ei: 0.4 }), 40); TEARS.frustumCulled = false; scene.add(TEARS);
const RAIN = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.42, 0.014), M(0xeef4ff, { std: true, opacity: 0.7, emissive: 0xc8d8f0, ei: 0.6 }), 420); RAIN.frustumCulled = false; scene.add(RAIN);
const rainSeed = Array.from({ length: 420 }, (_, i) => { const r = RNG(i + 5); return [r(), r(), r(), r()]; });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
function rain(T, center, size, on = true) {
  RAIN.visible = on; if (!on) return;
  for (let i = 0; i < 420; i++) { const [a, b, c, d] = rainSeed[i]; const y = center.y - size.y / 2 + size.y * (1 - ((T * (2.2 + d) + c) % 1));
    _m.compose(V(center.x + (a - 0.5) * size.x, y, center.z + (b - 0.5) * size.z), _q.identity(), V(1, 1, 1)); RAIN.setMatrixAt(i, _m); }
  RAIN.instanceMatrix.needsUpdate = true;
}
function tears(T, m) {
  TEARS.visible = true;
  for (let i = 0; i < 40; i++) { const s = i % 2 ? 1 : -1, k = ((T * 1.6 + i * 0.137) % 1); const p = m.worldOf(m.head, V(0.05 * s + 0.01 * Math.sin(i), 0.12 - k * 0.18, 0.12 - k * 0.02));
    if (k > 0.75) p.y -= (k - 0.75) * 1.4; _m.compose(p, _q.identity(), V(1, 1.4, 1)); TEARS.setMatrixAt(i, _m); }
  TEARS.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- helpers
let WT = []; const w = i => WT[i].s;
let ANCH = {};
function put(m, set, x, y, z, ry = 0) {
  m.group.visible = true; m.reset(); m.group.quaternion.identity();
  m.arms.forEach(a => { a.thumb.position.copy(a.home.tp); a.thumb.rotation.copy(a.home.tr); a.thumb.scale.copy(a.home.ts); a.fingers.position.copy(a.home.fp); a.fingers.scale.copy(a.home.fs); });
  if (m.skirt) m.skirt.position.set(0, 0.1, 0);
  m.group.position.copy(ORIG[set]).add(V(x, y, z)); m.group.rotation.set(0, ry, 0);
  return m;
}
function cam(p, t, fov = 45, up = null, roll = 0) { camera.position.copy(p); camera.up.copy(up || V(0, 1, 0)); camera.lookAt(t); if (roll) camera.rotateZ(roll); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
const camPos = () => camera.position.clone();
function handPt(m, side, off = V(0, -0.07, 0)) { const a = side === 'L' ? m.armL : m.armR; return m.worldOf(a.hand, off); }
const faceOf = m => m.worldOf(m.head, V(0, 0.13, 0.11));
const headPt = (m, x, y, z) => m.worldOf(m.head, V(x, 0.13 + y, z));
function ikArm(m, side, target, init = [0.3, 0.5, 0, 1.0]) {
  const a = side === 'L' ? m.armL : m.armR, p = init.slice(); const lo = [-1.2, -0.3, -1.7, 0], hi = [2.9, 2.9, 1.7, 2.7];
  const err = () => { m.arm(side, p[0], p[1], p[2], p[3]); a.hand.updateWorldMatrix(true, false); return a.hand.localToWorld(V(0, -0.08, 0)).distanceTo(target); };
  let best = err(), step = 0.4;
  for (let it = 0; it < 70 && step > 0.004; it++) { let imp = false;
    for (let k = 0; k < 4; k++) for (const dir of [1, -1]) { const old = p[k]; p[k] = clamp(old + dir * step, lo[k], hi[k]); const e = err(); if (e < best - 1e-6) { best = e; imp = true; } else p[k] = old; }
    if (!imp) step *= 0.5; }
  m.arm(side, p[0], p[1], p[2], p[3]); return best;
}
function headLook(m, target, k = 1, lim = 1.3) {
  m.group.updateMatrixWorld(true); const hp = m.worldOf(m.head, V(0, 0.13, 0));
  const inv = new THREE.Matrix4().copy(m.spine.matrixWorld).invert();
  const loc = target.clone().applyMatrix4(inv).sub(hp.clone().applyMatrix4(inv));
  m.head.rotation.set(clamp(-Math.atan2(loc.y, Math.hypot(loc.x, loc.z)), -0.8, 0.8) * k, clamp(Math.atan2(loc.x, loc.z), -lim, lim) * k, 0, 'YXZ');
}
function sitGround(m) { m.hips.position.y = 0.13; m.leg('L', 1.25, 0.25, 1.1); m.leg('R', 1.25, 0.25, 1.1); }
function waddle(m, T, sp = 1) { const s = Math.sin(T * 7 * sp); m.leg('L', 0.35 * s, 0.12, 0.25 * Math.max(0, s)); m.leg('R', -0.35 * s, 0.12, 0.25 * Math.max(0, -s)); m.hips.rotation.z = 0.08 * s; m.hips.position.y = 0.95 - 0.02 * Math.abs(s); m.spine.rotation.x = -0.12; }
function run(m, T, sp = 1) { const s = Math.sin(T * 13 * sp); m.leg('L', 0.7 * s, 0.05, 0.6 * Math.max(0, s) + 0.2); m.leg('R', -0.7 * s, 0.05, 0.6 * Math.max(0, -s) + 0.2); m.arm('L', -0.6 * s, 0.15, 0, 1.2); m.arm('R', 0.6 * s, 0.15, 0, 1.2); m.spine.rotation.x = 0.2; m.hips.position.y = 0.92 + 0.03 * Math.abs(Math.cos(T * 13 * sp)); }
const LIE_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0)));
function lieOnBed(m) { m.group.visible = true; m.reset(); m.group.position.copy(Ex(1.0, 0.905, -0.5)); m.group.quaternion.copy(LIE_Q); m.arm('L', 0, 0.12); m.arm('R', 0, 0.12); return m; }
const bellyTop = () => YOU.worldOf(YOU.belly, V(0, 0, 0.13 + 0.3));
const bellyC = () => YOU.worldOf(YOU.belly, V(0, 0, 0.13));
function youStand(set, x, z, ry = 0, belly = 1, y = 0) { const m = put(YOU, set, x, y, z, ry); setBelly(m, belly); m.spine.rotation.x = belly > 0.5 ? -0.08 : 0; return m; }
// doctors in the exam room: spots around the bed, facing the belly
const SPOTS = [[-0.2, -1.22], [0.55, 0.3], [-0.75, 0.3], [1.2, 0.1], [1.35, -0.55], [0.45, -1.2], [-0.1, 0.24], [-0.85, -1.2], [-1.35, -0.6], [-1.3, 0.25], [0.15, 0.85]];
const DOOR = [-2.1, 0.05];
function arrival(k) { return k === 0 ? -1 : k === 1 ? w(109) - 0.05 : w(111) - 0.15 + (k - 2) * 0.15; }
function doctors(T, o = {}) {
  const tgt = o.look || bellyC();
  DOCS.forEach((m, k) => {
    const ta = arrival(k), dt = T - ta;
    if (!o.all && dt < 0) { m.group.visible = false; return; }
    const [sx, sz] = SPOTS[k]; let x = sx, z = sz, running = false;
    if (!o.all && dt < 0.5) { const u = easeOut(dt / 0.5); x = lerp(DOOR[0], sx, u); z = lerp(DOOR[1], sz, u); running = true; }
    const ry = Math.atan2(EX.x + -0.14 - (EX.x + x), -0.5 - z);
    put(m, 'exam', x, 0, z, running ? Math.atan2(sx - DOOR[0], sz - DOOR[1]) : ry);
    if (running) run(m, T + k); else { m.spine.rotation.x = o.lean ?? 0.18; m.arm('L', 0.15, 0.1, 0, 0.3); m.arm('R', 0.15, 0.1, 0, 0.3); }
    m.setFace(o.face ? (typeof o.face === 'function' ? o.face(m, k) : o.face) : { eyes: 'wide', brows: 'up', mouth: 'o' });
    if (!running && o.lookAt !== false) headLook(m, tgt, 1, 1.0);
  });
}

// ---------------------------------------------------------------- shots
const SH = {};
function alleyDay(T, mood = 'alley') {
  useSet('alley', mood); AL.sun.visible = mood === 'dawn';
  AL.bulbs.forEach((b, i) => b.material = M(((Math.floor(T * 4) + i) % 3) ? 0xfff1b0 : 0xff9f6a, { basic: true }));
  AL.flaps.forEach((f, i) => { f.rotation.y = (-1.9 + 0.04 * Math.sin(T * 2 + i)) * (i ? -1 : 1); });
  PIG.g.visible = true; PIG.g.position.set(3.15, 1.12, -1.95); PIG.g.rotation.set(0, 0.6, 0); PIG.head.rotation.set(0.2 * Math.sin(T * 3), 0.5 * Math.sin(T * 1.3), 0); PIG.legs.forEach(l => l.rotation.set(0, 0, 0));
}
SH['01'] = (t, d, T, u) => {
  alleyDay(T); const m = put(YOU, 'alley', -0.15, 0, -0.35, 0.1); setBelly(m, 0); sitGround(m);
  m.arm('L', 0.7, 0.25, 0, 0.9); m.arm('R', 0.7, 0.25, 0, 0.9);
  SIGN.visible = true; SIGN.position.copy(handPt(m, 'L').add(handPt(m, 'R')).multiplyScalar(0.5).add(V(0, 0.08, 0.06))); SIGN.rotation.set(-0.15, 0.1, 0);
  m.setFace({ eyes: 'normal', brows: 'normal', mouth: 'smile' }); headLook(m, camPos().add(V(0, 0, 0)), 0);
  cam(A(lerp(0.9, 0.6, u), lerp(1.05, 0.95, u), lerp(2.7, 2.3, ease(u))), A(-0.2, 0.62, -0.55), 52);
  headLook(m, camPos(), 0.8); ANCH.you = faceOf(m);
};
SH['02'] = (t, d, T, u) => {
  alleyDay(T); const m = put(YOU, 'alley', -0.2, 0, -1.25, 0); setBelly(m, 0);
  m.hips.position.y = 0.22; m.hips.rotation.x = 1.45; m.leg('L', 0.1, 0.05, 0.2); m.leg('R', 0.1, 0.05, 0.2);   // lying on his front inside the box, head out
  m.head.rotation.x = -1.2; m.arm('L', 1.5, 0.2, 0, 0.3); m.arm('R', 1.4 + 0.25 * Math.sin(T * 9), 0.9, 0, 0.6);
  m.setFace({ eyes: 'happy', brows: 'up', mouth: 'grin' });
  cam(A(lerp(1.75, 1.55, u), 0.75, lerp(1.15, 0.95, u)), A(-0.2, 0.42, -1.0), 48);
  ANCH.home = A(0.5, 0.6, -1.4);
};
SH['03'] = (t, d, T, u) => {
  alleyDay(T); const m = put(YOU, 'alley', -0.15, 0, -0.35, 0.1); setBelly(m, 0); sitGround(m); m.arm('L', 0.4, 0.2, 0, 0.6); m.arm('R', 0.4, 0.2, 0, 0.6); m.setFace({ eyes: 'happy', mouth: 'smile' });
  const k = ease(u); cam(lerpV(A(0.3, 1.0, 2.3), A(0.5, 1.5, 6.3), k), lerpV(A(-0.2, 0.7, -1.0), A(-0.3, 2.3, -2.5), k), lerp(50, 56, k));
  ANCH.sign = A(-0.3, 3.45, -2.5);
};
SH['04'] = (t, d, T, u) => {
  alleyDay(T); const m = put(YOU, 'alley', -0.15, 0, -0.35, 0.1); setBelly(m, 0); sitGround(m);
  const bite = Math.max(0, Math.sin(T * 6)); m.arm('L', 0.4, 0.2, 0, 0.7);
  ikArm(m, 'R', headPt(m, -0.03, -0.08 - 0.05 * (1 - bite), 0.2 + 0.05 * (1 - bite)), [1.2, 0.3, 0.2, 2.0]);
  m.setFace({ eyes: 'happy', brows: 'up', mouth: bite > 0.5 ? 'chew' : 'grin', blush: true });
  const f = faceOf(m); cam(f.clone().add(V(0.42, -0.02, lerp(1.15, 1.0, u))), f.clone().add(V(0.05, -0.12, 0)), 42);
  SLICE.visible = true; SLICE.position.copy(handPt(m, 'R', V(0, -0.08, 0.04))); SLICE.lookAt(camPos()); SLICE.rotateZ(2.5); SLICE.translateX(-0.2);
};
SH['05'] = (t, d, T, u) => {
  alleyDay(T, 'dawn'); AL.sun.position.set(32, lerp(2.0, 8.5, ease(u)), -8);
  const m = put(YOU, 'alley', -0.2, 0, -1.3, PI); setBelly(m, 0); m.hips.position.y = 0.15; m.hips.rotation.x = -1.4; m.setFace({ eyes: 'closed', mouth: 'o' });  // asleep inside
  cam(A(-1.4, 0.55, 1.9), A(8, 1.9, -1.5), 54); AL.sun.lookAt(camPos());
};
SH['06'] = (t, d, T, u) => {
  alleyDay(T, 'dawn'); AL.sun.position.set(32, 8.8, -8); AL.sun.lookAt(A(0.35, 0.5, 1.2));
  const k = ease(u); const m = put(YOU, 'alley', -0.2, 0, lerp(-1.35, -0.55, k), 0); setBelly(m, 0);
  m.hips.position.y = 0.5; m.hips.rotation.x = 1.3; m.leg('L', 1.3 + 0.25 * Math.sin(T * 8), 0.1, 1.6); m.leg('R', 1.3 - 0.25 * Math.sin(T * 8), 0.1, 1.6);
  m.arm('L', 1.3 - 0.25 * Math.sin(T * 8), 0.15, 0, 0.1); m.arm('R', 1.3 + 0.25 * Math.sin(T * 8), 0.15, 0, 0.1); m.head.rotation.x = -1.15;
  m.setFace(T > w(22) - 0.1 ? { eyes: 'squint', brows: 'normal', mouth: 'open' } : { eyes: 'half', mouth: 'o' });
  cam(A(0.4, 0.55, lerp(1.3, 1.15, u)), A(-0.2, 0.5, -0.6), 54);
};
SH['07'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', -0.2, -0.3, 0, 0);
  const k = T - w(25); const s = k < 0 ? 0 : k < 0.12 ? 1.25 * easeOut(k / 0.12) : 1 + 0.25 * Math.exp(-(k - 0.12) * 8) * Math.cos((k - 0.12) * 30);
  setBelly(m, Math.max(0.01, s)); m.spine.rotation.x = -0.1 * clamp(s);
  m.arm('L', 0.1, lerp(2.6, 0.5, clamp(k / 0.2)), 0, 0.3); m.arm('R', 0.1, lerp(2.6, 0.5, clamp(k / 0.2)), 0, 0.3);
  m.setFace(k < 0 ? { eyes: 'closed', mouth: 'open', brows: 'up' } : { eyes: 'wide', mouth: 'drop', brows: 'up' });
  cam(A(0.35, 1.35, 2.5), A(-0.2, 1.15, -0.3), 50); ANCH.belly = bellyC();
};
SH['08'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', -0.2, -0.3, 0, 1); headLook(m, bellyC().add(V(0, 0, 0.2)), 1);
  m.arm('L', 0.3, 0.6, 0, 0.4); m.arm('R', 0.3, 0.6, 0, 0.4); m.setFace({ eyes: 'wide', brows: 'up', mouth: 'drop' });
  const b = bellyC(); cam(b.clone().add(V(0.12, lerp(-0.15, -0.3, u), lerp(0.75, 1.65, ease(u)))), b.clone().add(V(0, lerp(0, 0.25, u), 0)), 60); ANCH.belly = b;
};
SH['09'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', 0.15, -0.55, 0.5, 1); headLook(m, A(0.95, 0.05, -0.15), 1);
  ikArm(m, 'R', headPt(m, 0.0, -0.17, 0.14), [1.0, 0.2, 0.2, 2.2]); m.setFace({ eyes: 'squint', brows: 'worried', mouth: 'wavy' });
  cam(A(1.85, 1.25, 1.45), A(0.55, 0.7, -0.3), 52); ANCH.pbox = A(0.95, 0.08, -0.15);
};
SH['10'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', 0.15, -0.55, 0.5, 1); m.setFace({ eyes: 'squint', mouth: 'flat' });
  cam(A(1.35, lerp(0.75, 0.68, u), lerp(0.55, 0.45, u)), A(0.95, 0.05, -0.15), 46); ANCH.pbox = A(0.95, 0.08, -0.15);
};
SH['11'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', -0.2, -0.3, 0, 1); const g = T > w(38) - 0.08;
  m.setFace(g ? { eyes: 'wide', brows: 'up', mouth: 'drop' } : { eyes: 'normal', brows: 'normal', mouth: 'flat' });
  if (g) { m.arm('L', 0.6, 0.6, 0, 2.2); m.arm('R', 0.6, 0.6, 0, 2.2); }
  const f = faceOf(m); cam(f.clone().add(V(0.05, 0.0, lerp(0.75, 0.6, ease(u)) - (g ? 0.1 : 0))), f, 38);
};
SH['12'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', -0.2, -0.3, 0.6, 1); m.setFace({ eyes: 'blank', brows: 'up', mouth: 'o' }); headLook(m, bellyC().add(V(0, 0, 0.3)), 0.7);
  m.arm('L', 0.5, 0.4, 0, 0.9); m.arm('R', 0.5, 0.4, 0, 0.9);
  const b = bellyC(); cam(b.clone().add(V(lerp(1.5, 1.3, u), 0.35, lerp(0.6, 0.5, u))), b.clone().add(V(0, 0.15, 0)), 50); ANCH.belly = b;
};
SH['13'] = (t, d, T, u) => {
  alleyDay(T); const m = youStand('alley', -0.2, -0.3, 0.2, 1); const sc = 0.02 * Math.sin(T * 30);
  ikArm(m, 'R', headPt(m, -0.13, 0.12 + sc, 0.0), [1.2, 1.2, 0.3, 2.3]); m.head.rotation.z = 0.12;
  m.setFace({ eyes: 'half', brows: 'worried', mouth: 'wavy' });
  const f = faceOf(m); cam(f.clone().add(V(0.25, -0.1, 1.1)), f.clone().add(V(0, -0.15, 0)), 44);
};
SH['14'] = (t, d, T, u) => {
  alleyDay(T); const s = Math.sin(T * 26);
  PIG.legs[0].rotation.set(-2.5, 0, -0.55 + 0.15 * s); PIG.legs[0].position.set(0.08, 0.17, 0.07); PIG.head.rotation.set(0.15, 0.4, -0.35 + 0.05 * s);
  const p = PIG.g.position.clone().add(V(0, 0.28, 0));
  cam(p.clone().add(V(0.62, 0.04, lerp(0.15, 0.05, u))), p.clone().add(V(0, -0.04, 0)), 42);
  ANCH.pigeon = p;
};
SH['15'] = (t, d, T, u) => {
  useSet('street'); const x = lerp(-2.0, -0.4, u); const m = youStand('street', x, 0.45, PI / 2, 1, 0.15); waddle(m, T);
  STR.cart.position.set(x + 0.95, 0.15, 0.45); STR.cart.rotation.set(0, PI / 2, 0);
  ikArm(m, 'L', STR.cart.localToWorld(V(-0.22, 1.03, -0.6)), [1.2, 0.2, 0, 0.8]); ikArm(m, 'R', STR.cart.localToWorld(V(0.22, 1.03, -0.6)), [1.2, 0.2, 0, 0.8]);
  m.setFace({ eyes: 'determined', brows: 'angry', mouth: 'tight' });
  cam(St(x + 0.6, 1.15, 4.3), St(x + 0.4, 0.95, 0.4), 50);
};
SH['16'] = (t, d, T, u) => {
  useSet('street'); const x = lerp(-0.2, 1.4, u); const m = youStand('street', x, 0.45, PI / 2, 1, 0.15); waddle(m, T);
  STR.cart.position.set(x + 0.95, 0.15, 0.45); STR.cart.rotation.set(0, PI / 2, 0);
  ikArm(m, 'L', STR.cart.localToWorld(V(-0.22, 1.03, -0.6)), [1.2, 0.2, 0, 0.8]); ikArm(m, 'R', STR.cart.localToWorld(V(0.22, 1.03, -0.6)), [1.2, 0.2, 0, 0.8]);
  m.setFace({ eyes: 'determined', brows: 'angry', mouth: 'tight' });
  cam(St(x - 1.7, 1.15, 1.25), St(10, 3.6, -1.0), 50); ANCH.hospital = St(10, 6.2, -0.9);
};
function deskBase(T, belly = 1) {
  useSet('desk'); const n = put(NURSE, 'desk', 0, 0, -1.45, 0); n.arm('L', 0.4, 0.15, 0, 1.4); n.arm('R', 0.4, 0.15, 0, 1.4);
  CLIP.visible = true; CLIP.position.copy(handPt(n, 'L').add(handPt(n, 'R')).multiplyScalar(0.5).add(V(0, 0.08, 0.03))); CLIP.rotation.set(-0.5, 0, 0);
  const m = youStand('desk', 0.0, 0.55, PI, belly); return [n, m];
}
SH['17'] = (t, d, T, u) => {
  const [n, m] = deskBase(T); m.setFace({ eyes: 'normal', mouth: 'smile' });
  if (T < w(62) - 0.05) { n.setFace({ eyes: 'normal', mouth: 'flat' }); n.head.rotation.x = 0.25; cam(Dk(1.3, 1.75, 2.7), Dk(-0.1, 1.15, -0.5), 56); }
  else { n.setFace({ eyes: 'normal', brows: 'normal', mouth: 'flat', look: [0, 0.008] }); const f = faceOf(n); cam(f.clone().add(V(0, 0.03, 0.62)), f.clone().add(V(0, 0.03, 0)), 28); }
};
SH['18'] = (t, d, T, u) => { const [n] = deskBase(T); n.setFace({ eyes: 'normal', brows: 'up', mouth: 'flat', look: [0, -0.014 * sstep(0, 0.15, u)] }); const f = faceOf(n); cam(f.clone().add(V(0.0, 0.03, 0.6)), f.clone().add(V(0, 0.03, 0)), 28); };
SH['19'] = (t, d, T, u) => { const [n] = deskBase(T); n.setFace({ eyes: 'half', brows: 'angry', mouth: 'flat', look: [0, 0.01 * sstep(0, 0.15, u)] }); const f = faceOf(n); cam(f.clone().add(V(0.0, 0.03, lerp(0.62, 0.55, u))), f.clone().add(V(0, 0.03, 0)), 28); };
SH['20'] = (t, d, T, u) => { const [n] = deskBase(T); n.setFace({ eyes: 'half', brows: 'cocky', mouth: 'flat' }); n.head.rotation.z = 0.12; const f = faceOf(n); cam(f.clone().add(V(0.06, 0.0, lerp(0.75, 0.65, u))), f, 34); };
SH['21'] = (t, d, T, u) => {
  const [n, m] = deskBase(T); n.setFace({ eyes: 'half', brows: 'cocky', mouth: T > w(76) ? 'o' : 'flat' }); n.head.rotation.z = 0.15;
  CLIP.position.copy(handPt(n, 'L').add(handPt(n, 'R')).multiplyScalar(0.5).add(V(0, 0.12, 0.06))); CLIP.rotation.set(-0.2, 0, 0);
  cam(Dk(0.55, 1.62, 0.35), Dk(0.0, 1.45, -1.45), 44); ANCH.clip = CLIP.position.clone();
};
SH['22'] = (t, d, T, u) => { const [n, m] = deskBase(T); m.setFace({ eyes: 'determined', brows: 'angry', mouth: 'flat' }); const f = faceOf(m); cam(f.clone().add(V(-0.08, 0.02, -0.62)), f, 36); };
SH['23'] = (t, d, T, u) => {
  const [n, m] = deskBase(T); m.spine.rotation.x = -0.22; m.setFace({ eyes: 'happy', brows: 'cocky', mouth: 'grin' });
  const b = bellyTop(); ikArm(m, 'R', b.clone().add(V(0.1, 0.05, -0.1)), [1.0, 0.3, 0, 0.4]); ikArm(m, 'L', b.clone().add(V(-0.1, 0.05, -0.1)), [1.0, 0.3, 0, 0.4]);
  cam(Dk(0.25, 1.4, -0.6), Dk(0.0, 1.3, 0.55), 52); ANCH.belly = bellyC();
};
function examBase(T, o = {}) {
  useSet('exam'); drawScan(XR, T, o.scan !== false, o.wave ?? 1); drawEcg(XR, T);
  XR.ceiling.visible = !o.cutTop; XR.door.rotation.y = o.door ?? 0;
  XR.windowPane.material.color.setHex(o.rain ? 0x5d6b82 : 0xbfe3f7);
  const m = lieOnBed(YOU); setBelly(m, o.belly ?? 1); m.setFace(o.youFace || { eyes: 'normal', mouth: 'flat' });
  return m;
}
SH['24'] = (t, d, T, u) => {
  const m = examBase(T); m.setFace({ eyes: 'normal', brows: 'up', mouth: 'smile' });
  put(DOC, 'exam', -0.2, 0, -1.22, 0); DOC.spine.rotation.x = 0.25; DOC.setFace({ eyes: 'normal', mouth: 'flat' }); headLook(DOC, bellyTop(), 1);
  const a = T * 3; const p = bellyTop().add(V(0.12 * Math.cos(a), -0.03, 0.1 * Math.sin(a)));
  ikArm(DOC, 'R', p, [1.0, 0.2, 0, 0.6]); PROBE.visible = true; PROBE.position.copy(handPt(DOC, 'R', V(0, -0.1, 0))); PROBE.rotation.set(0, 0, 0);
  cam(Ex(lerp(0.75, 0.55, u), 1.85, lerp(1.6, 1.4, u)), Ex(-0.2, 1.1, -0.6), 52);
};
SH['25'] = (t, d, T, u) => {
  examBase(T, { wave: 1 }); put(DOC, 'exam', -0.2, 0, -1.22, 0);
  const sg = XR.screenGroup; sg.updateWorldMatrix(true, false); const c = sg.localToWorld(V(0, 0, 0)), n = sg.localToWorld(V(0, 0, 1)).sub(c).normalize();
  cam(c.clone().addScaledVector(n, lerp(0.95, 0.8, ease(u))).add(V(0, 0.02, 0)), c, 40); ANCH.screen = c;
};
SH['26'] = (t, d, T, u) => {
  examBase(T); put(DOC, 'exam', -0.2, 0, -1.22, 0.3); DOC.setFace({ eyes: 'blank', brows: 'normal', mouth: 'flat' }); headLook(DOC, XR.screenGroup.localToWorld(V(0, 0, 0)), 0.6);
  ikArm(DOC, 'R', bellyTop().add(V(0, -0.02, 0.1)), [1.0, 0.2, 0, 0.6]); PROBE.visible = true; PROBE.position.copy(handPt(DOC, 'R', V(0, -0.1, 0)));
  const f = faceOf(DOC); cam(f.clone().add(V(0.12, 0.02, lerp(0.75, 0.6, u))), f, 36);
};
function glassesPose(T, k) { // k: 0 on the face, 1 off in the hand
  DOC.glasses.position.set(DOC.glassesHome.x, DOC.glassesHome.y - 0.22 * k, DOC.glassesHome.z + 0.12 * k); DOC.glasses.rotation.set(0.6 * k, 0, 0.2 * k);
  DOC.glasses.updateWorldMatrix(true, false); const gp = DOC.glasses.localToWorld(V(0.06, 0.02, 0.0));
  ikArm(DOC, 'R', gp, [1.2, 0.3, 0, 1.8]);
}
SH['27'] = (t, d, T, u) => {
  examBase(T); put(DOC, 'exam', -0.2, 0, -1.22, 0.3); DOC.setFace({ eyes: 'blank', brows: 'normal', mouth: 'flat' });
  glassesPose(T, ease(sstep(w(96), w(99) + 0.1, T))); const f = faceOf(DOC); cam(f.clone().add(V(0.15, -0.04, 0.55)), f.clone().add(V(0, -0.06, 0)), 38);
};
SH['28'] = (t, d, T, u) => {
  examBase(T); put(DOC, 'exam', -0.2, 0, -1.22, 0.3);
  const k = 1 - ease(sstep(w(101) - 0.05, w(103), T)); glassesPose(T, k);
  const bl = T > w(104) && T < w(104) + 0.15; DOC.setFace({ eyes: bl ? 'closed' : 'blank', brows: 'up', mouth: 'flat' });
  const f = faceOf(DOC); cam(f.clone().add(V(0.14, -0.03, 0.5)), f.clone().add(V(0, -0.04, 0)), 36);
};
SH['29'] = (t, d, T, u) => {
  examBase(T, { door: T > w(109) - 0.25 ? -1.4 * easeOut((T - w(109) + 0.25) / 0.2) : 0 }); doctors(T, { face: (m, k) => k === 0 ? { eyes: 'squint', brows: 'up', mouth: 'open' } : { eyes: 'wide', brows: 'up', mouth: 'o' } });
  put(DOC, 'exam', -0.6, 0, 0.35, -PI / 2 - 0.3); DOC.setFace({ eyes: 'squint', brows: 'up', mouth: 'open' });
  ikArm(DOC, 'R', headPt(DOC, -0.1, -0.08, 0.13), [1.6, 0.5, 0, 2.2]); ikArm(DOC, 'L', headPt(DOC, 0.1, -0.08, 0.13), [1.6, 0.5, 0, 2.2]);
  cam(Ex(-1.0, 1.6, 1.75), Ex(-1.05, 1.3, -0.15), 56);
};
SH['30'] = (t, d, T, u) => {
  examBase(T, { door: -1.4 }); doctors(T);
  cam(Ex(lerp(0.2, 0.0, u), 1.5, 1.55), Ex(-1.45, 1.05, -0.05), 60); ANCH.door = Ex(-1.7, 1.2, 0.0);
};
SH['31'] = (t, d, T, u) => { examBase(T, { cutTop: true }); doctors(T, { all: true }); cam(Ex(lerp(0.95, 0.75, u), lerp(2.95, 3.05, u), 1.55), Ex(-0.1, 0.8, -0.45), 64); };
SH['32'] = (t, d, T, u) => {
  examBase(T); doctors(T, { all: true });
  const cl = [DOCS[1], DOCS[0], DOCS[2], DOCS[9]];
  cl.forEach((m, i) => { put(m, 'exam', -0.42 + i * 0.27, 0, 1.05 + (i % 2) * 0.03, 0); m.root.scale.set(m.cfg.scale * 0.88, m.cfg.scale, m.cfg.scale); m.head.rotation.z = (i - 1.5) * 0.12; m.setFace({ eyes: 'wide', brows: 'up', mouth: i % 2 ? 'o' : 'tight' }); m.arm('L', 0.1, 0.02); m.arm('R', 0.1, 0.02); });
  cam(Ex(-0.02, 1.72, lerp(2.35, 2.2, u)), Ex(-0.02, 1.66, 1.0), 46);
};
SH['33'] = (t, d, T, u) => {
  examBase(T); YOU.group.visible = false; const c = Ex(-0.14, 0, -0.5);
  DOCS.forEach((m, k) => { if (k > 8) { m.group.visible = false; return; } const a = k / 9 * PI * 2; put(m, 'exam', -0.14 + Math.sin(a) * 0.62, 0, -0.5 + Math.cos(a) * 0.62, a + PI);
    m.spine.rotation.x = 0.55; m.setFace({ eyes: 'blank', brows: 'normal', mouth: k % 3 ? 'flat' : 'o' }); m.head.rotation.x = 0.5; m.arm('L', 0.4, 0.1, 0, 0.3); m.arm('R', 0.4, 0.1, 0, 0.3); });
  cam(Ex(-0.14, 1.12, -0.5), Ex(-0.14, 3, -0.5), lerp(100, 92, u), V(-1, 0, 0), 0.5 * u);
};
SH['34'] = (t, d, T, u) => {
  examBase(T); doctors(T, { all: true }); [1, 6, 4].forEach(k => DOCS[k].group.visible = false); const m = DOCS[3]; m.setFace({ eyes: 'squint', brows: 'angry', mouth: 'tight' });
  m.arm('L', 0.9, 0.2, 0, 1.3); CLIP2.visible = true; CLIP2.position.copy(handPt(m, 'L', V(0, -0.1, 0.05))); CLIP2.quaternion.copy(m.group.quaternion); CLIP2.rotateX(-0.9);
  const pp = CLIP2.localToWorld(V(0.03 * Math.sin(T * 20), 0.02 * Math.sin(T * 7), 0.04)); ikArm(m, 'R', pp, [1.0, 0.1, 0, 1.5]);
  PEN.visible = true; PEN.position.copy(pp.add(V(0, 0.05, 0))); PEN.rotation.set(0.3, 0, 0.4);
  headLook(m, CLIP2.position, 1); const f = faceOf(m); const fw = V(Math.sin(m.group.rotation.y), 0, Math.cos(m.group.rotation.y)); const sd = V(0, 1, 0).cross(fw); cam(f.clone().addScaledVector(fw, 0.62).addScaledVector(sd, 0.32).add(V(0, 0.16, 0)), f.clone().lerp(CLIP2.position, 0.4), 44); ANCH.clip = CLIP2.position.clone();
};
SH['35'] = (t, d, T, u) => {
  examBase(T); doctors(T, { all: true }); const m = DOCS[5]; m.setFace({ eyes: 'closed', brows: 'worried', mouth: 'wavy' });
  m.arm('L', 1.1, 0.2, 0, 2.0); m.head.rotation.x = -0.1; tears(T, m);
  const f = faceOf(m); cam(f.clone().add(V(-0.2, 0.0, 0.62)), f, 36);
};
SH['36'] = (t, d, T, u) => {
  examBase(T); doctors(T, { all: true, face: { eyes: 'half', brows: 'worried', mouth: 'wavy' } });
  [1, 2, 6, 10].forEach(k => DOCS[k].group.visible = false);
  [DOCS[7], DOCS[0], DOCS[5], DOCS[8]].forEach((m, i) => {
    m.arm('L', 1.1, 0.3, 0, 1.2); m.arm('R', 1.1, 0.3, 0, 1.2); const c = handPt(m, 'L').add(handPt(m, 'R')).multiplyScalar(0.5);
    const b = BOOKS[i]; b.visible = true; b.position.copy(c.add(V(0, 0.08, 0))); b.quaternion.copy(m.group.quaternion);
    b.rotateZ(PI * ease(sstep(w(139) + i * 0.18, w(139) + i * 0.18 + 0.35, T))); b.rotateX(-0.3); headLook(m, b.position, 1);
  });
  cam(Ex(-0.25, 1.95, 1.2), Ex(-0.35, 1.5, -1.2), 52);
};
SH['37'] = (t, d, T, u) => { examBase(T); doctors(T, { all: true, face: { eyes: 'wide', brows: 'up', mouth: 'o' } }); YOU.group.visible = false; cam(Ex(-0.15, 1.6, -0.55), Ex(0.0, 1.62, 0.35), 62); };
SH['38'] = (t, d, T, u) => {
  const m = examBase(T, { youFace: { eyes: 'wide', brows: 'up', mouth: 'o' } }); const sh = 0.06 * Math.sin(T * 38) * sstep(w(146) - 0.2, w(146), T);
  setBelly(m, 1 + sh); m.belly.position.y = 0.07 + 0.03 * Math.sin(T * 31); m.belly.position.x = 0.03 * Math.sin(T * 27);
  doctors(T, { all: true, lean: -0.15, face: { eyes: 'wide', brows: 'up', mouth: 'drop' } });
  cam(Ex(0.35, 2.35, 0.15), bellyC(), 56); ANCH.belly = bellyC();
};
SH['39'] = (t, d, T, u) => {
  const m = examBase(T, { youFace: { eyes: 'wide', brows: 'worried', mouth: 'wavy' } }); doctors(T, { all: true });
  m.head.rotation.x = 0.2; SWEAT.visible = true; SWEAT.position.copy(headPt(m, 0.11, 0.06 - 0.06 * u, 0.06)); SWEAT.quaternion.copy(m.group.quaternion);
  const f = faceOf(m); cam(f.clone().add(V(0.25, 0.48, 0.12)), f, 38, V(-1, 0, 0));
};
function babyHeld(T, m, look = null) { // DOC holds the baby in front of his chest
  m.arm('L', 1.0, 0.25, 0, 1.5); m.arm('R', 1.0, 0.25, 0, 1.5); const c = handPt(m, 'L').add(handPt(m, 'R')).multiplyScalar(0.5);
  const b = BABY; b.group.visible = true; b.reset(); b.group.quaternion.copy(m.group.quaternion); b.group.position.copy(c.add(V(0, -0.15, 0))).add(V(0, 0, 0).applyQuaternion(m.group.quaternion));
  b.group.rotateX(-0.25); if (look) headLook(b, look, 1, 1.2);
}
SH['40'] = (t, d, T, u) => {
  const m = examBase(T, { belly: T < w(150) + 0.15 ? 1 : 0, youFace: { eyes: 'closed', brows: 'up', mouth: 'drop' } });
  doctors(T, { all: true, lean: -0.25, face: { eyes: 'wide', brows: 'up', mouth: 'drop' } });
  if (T > w(150) + 0.15) { const k = easeOut((T - w(150) - 0.15) / 0.3); put(DOC, 'exam', -0.2, 0, -1.22, 0); DOC.arm('L', lerp(1.0, 2.8, k), 0.2, 0, 0.2); DOC.arm('R', lerp(1.0, 2.8, k), 0.2, 0, 0.2);
    DOC.setFace({ eyes: 'wide', brows: 'up', mouth: 'drop' }); const c = handPt(DOC, 'L').add(handPt(DOC, 'R')).multiplyScalar(0.5); BABY.group.visible = true; BABY.reset(); BABY.group.position.copy(c.add(V(0, 0.02, 0))); BABY.group.rotation.set(0, 0, 0); BABY.setFace({ eyes: 'half', brows: 'normal', mouth: 'flat' }); }
  DOCS[10].group.visible = false; cam(Ex(0.25, 1.95, 1.75), Ex(-0.2, 1.75, -1.0), 56);
};
SH['41'] = (t, d, T, u) => {
  examBase(T, { belly: 0, youFace: { eyes: 'blank', mouth: 'o' } }); doctors(T, { all: true, face: { eyes: 'wide', brows: 'up', mouth: 'o' } });
  put(DOC, 'exam', -0.2, 0, -1.22, 0.15); DOC.setFace({ eyes: 'blank', brows: 'up', mouth: 'o' }); babyHeld(T, DOC, camPos()); BABY.setFace({ eyes: 'half', brows: 'normal', mouth: 'flat' });
  const b = faceOf(BABY); cam(b.clone().add(V(0.2, 0.15, 0.95)), b.clone().add(V(0, 0.05, 0)), 44); headLook(BABY, camPos(), 1); ANCH.baby = faceOf(BABY);
};
function babyClose(T, face, look, dist = 0.42, side = 0.0) {
  examBase(T, { belly: 0 }); doctors(T, { all: true, face: { eyes: 'wide', brows: 'up', mouth: 'o' }, look: faceOf(DOC) });
  put(DOC, 'exam', -0.2, 0, -1.22, 0.15); DOC.setFace({ eyes: 'blank', brows: 'up', mouth: 'o' }); babyHeld(T, DOC, null); BABY.setFace(face);
  const b = faceOf(BABY); const dir = V(0.25 + side, 0.12, 1).normalize(); cam(b.clone().addScaledVector(dir, dist), b.clone().add(V(0, 0.01, 0)), 36);
  if (look) headLook(BABY, look, 1, 1.3); ANCH.baby = faceOf(BABY);
}
SH['42'] = (t, d, T, u) => { babyClose(T, { eyes: 'half', brows: 'normal', mouth: 'flat' }, null, lerp(0.5, 0.42, u)); headLook(BABY, camPos(), 1); };
SH['43'] = (t, d, T, u) => { babyClose(T, { eyes: 'half', brows: 'normal', mouth: 'flat' }, null, 0.5); BABY.head.rotation.set(0, 1.0 * Math.sin((T - w(157)) * 3.2), 0, 'YXZ'); };
SH['44'] = (t, d, T, u) => {
  examBase(T, { belly: 0 }); put(DOC, 'exam', -0.2, 0, -1.22, 0.15); babyHeld(T, DOC, null); const bf = faceOf(BABY);
  doctors(T, { all: true, face: { eyes: 'wide', brows: 'up', mouth: 'o' }, look: bf }); BABY.group.visible = false;
  cam(bf.clone(), Ex(0.9, 1.45, -0.6), 74);
};
SH['45'] = (t, d, T, u) => {
  examBase(T, { belly: 0 }); doctors(T, { all: true, look: Ex(-0.1, 1.2, 0.3) });
  cam(Ex(-0.45, 1.6, lerp(-0.25, -0.35, u)), Ex(-1.35, 1.55, -1.3), 46); XR.ecgLight.visible = Math.floor(T * 3) % 2 === 0; ANCH.machine = Ex(-1.35, 1.55, -1.3);
};
SH['46'] = (t, d, T, u) => { babyClose(T, { eyes: 'blank', brows: 'normal', mouth: 'flat' }, null, lerp(0.4, 0.34, u), 0.1); headLook(BABY, camPos(), 1); };
SH['47'] = (t, d, T, u) => {
  const m = examBase(T, { belly: 0, youFace: { eyes: 'normal', brows: 'up', mouth: 'flat' } }); doctors(T, { all: true, look: faceOf(YOU) });
  const b = m.worldOf(m.head, V(0, 0.0, 0.1)); cam(b.clone().add(V(0.18, lerp(0.42, 0.34, ease(u)), 0.15)), b, 40, V(-1, 0, 0)); ANCH.beard = m.worldOf(m.head, V(0, -0.02, 0.12));
};
SH['48'] = (t, d, T, u) => {
  const m = examBase(T, { belly: 0, youFace: { eyes: 'normal', brows: 'up', mouth: 'flat', look: [0, 0.012] } }); doctors(T, { all: true, look: faceOf(YOU) });
  const b = m.worldOf(m.head, V(0, 0.24, 0.02)); cam(b.clone().add(V(0.32, 0.38, 0.2)), b, 40, V(-1, 0, 0)); ANCH.beanie = m.worldOf(m.head, V(0, 0.27, 0.05));
};
SH['49'] = (t, d, T, u) => { babyClose(T, { eyes: 'half', brows: 'up', mouth: 'flat' }, null, lerp(0.48, 0.4, u)); headLook(BABY, camPos(), 1); };
const talk = (T, words) => { for (const [a, b] of words) if (T >= a && T < b) return Math.sin((T - a) * 28) > -0.2 ? 'open' : 'o'; return 'flat'; };
SH['50'] = (t, d, T, u) => { babyClose(T, { eyes: 'half', brows: 'normal', mouth: talk(T, [[w(180), w(180) + 0.3]]) }, null, 0.4, -0.05); headLook(BABY, camPos(), 1); };
SH['51'] = (t, d, T, u) => { babyClose(T, { eyes: 'half', eyeL: 'normal', brows: 'cocky', mouth: talk(T, [[w(181), w(181) + 0.26], [w(182), w(182) + 0.18], [w(183), w(183) + 0.36]]) }, null, lerp(0.42, 0.36, u), 0.05); headLook(BABY, camPos(), 1); };
SH['52'] = (t, d, T, u) => {
  const m = examBase(T, { belly: 0, rain: true, youFace: { eyes: 'normal', brows: 'up', mouth: 'smile' } }); doctors(T, { all: true, look: Ex(0, 1.5, -1.8) });
  rain(T, Ex(0, 2, -3.5), V(4, 4, 2)); ikArm(m, 'R', Ex(-0.5, 1.6, -1.5), [1.5, 0.3, 0, 0.1]); [0, 5, 7, 1, 6, 10, 3, 4].forEach(k => DOCS[k].group.visible = false);
  cam(Ex(1.35, 1.95, 0.35), Ex(-0.45, 1.3, -1.3), 54); ANCH.window = Ex(0, 1.55, -1.8);
};
SH['53'] = (t, d, T, u) => {
  useSet('alley', 'rain'); AL.sun.visible = false; PIG.g.visible = false; rain(T, A(0, 2.5, -0.5), V(9, 5, 7));
  AL.flaps.forEach((f, i) => f.rotation.y = (-1.2) * (i ? -1 : 1)); AL.bulbs.forEach(b => b.material = M(0x9a8f70, { basic: true }));
  cam(A(lerp(0.9, 0.7, u), 0.85, lerp(2.2, 1.9, ease(u))), A(-0.2, 0.55, -1.5), 50); ANCH.box = A(-0.2, 0.6, -1.4);
};
SH['54'] = (t, d, T, u) => {
  examBase(T, { belly: 0, rain: true }); doctors(T, { all: true, look: Ex(0, 1.5, -1.8), face: { eyes: 'wide', brows: 'up', mouth: 'drop' } });
  put(DOC, 'exam', -0.2, 0, -1.22, 0.15); babyHeld(T, DOC, null); DOC.setFace({ eyes: 'wide', brows: 'up', mouth: 'drop' });
  YOU.group.visible = false; const a = faceOf(DOCS[1]), b = faceOf(DOCS[6]); const mid = a.clone().lerp(b, 0.5); cam(Ex(0.2, 1.62, -0.55), mid, 50);
};
SH['55'] = (t, d, T, u) => {
  examBase(T, { belly: 0, rain: true, cutTop: true }); const k = easeIn(sstep(w(194) - 0.35, w(194) + 0.02, T));
  doctors(T, { all: true, look: Ex(0, 1.5, -1.8), face: k > 0.3 ? { eyes: 'closed', brows: 'up', mouth: 'drop' } : { eyes: 'wide', brows: 'up', mouth: 'drop' } });
  put(DOC, 'exam', -0.2, 0, -1.22, 0.15); DOC.setFace(k > 0.3 ? { eyes: 'closed', brows: 'up', mouth: 'drop' } : { eyes: 'wide', brows: 'up', mouth: 'drop' }); babyHeld(T, DOC, camPos());
  BABY.setFace({ eyes: 'half', brows: 'normal', mouth: 'flat' });
  DOCS.forEach((m, i) => { if (i === 0) return; const back = V(Math.sin(m.group.rotation.y), 0, Math.cos(m.group.rotation.y)).negate(); const axis = V(0, 1, 0).cross(back).normalize();
    m.group.rotateOnWorldAxis(axis, k * (PI / 2 - 0.15)); m.arm('L', 0.3, 1.2 * k, 0, 0.2); m.arm('R', 0.3, 1.2 * k, 0, 0.2); });
  cam(Ex(lerp(1.0, 1.1, u), lerp(2.6, 2.75, u), 1.75), Ex(-0.1, 0.6, -0.4), 62);
};

// ---------------------------------------------------------------- frame
function resetWorld() {
  for (const m of PEOPLE) m.group.visible = false;
  [CLIP, CLIP2, PEN, PROBE, SLICE, SIGN, SWEAT, ...BOOKS].forEach(o => o.visible = false);
  TEARS.visible = false; RAIN.visible = false; PIG.g.visible = false;
  DOCS.forEach(m => m.root.scale.setScalar(m.cfg.scale)); DOC.glasses.position.copy(DOC.glassesHome); DOC.glasses.rotation.set(0, 0, 0);
  XR.ecgLight.visible = true; ANCH = {}; YOU.belly.position.set(0, 0.07, 0.04);
}
function project(p) { const c = p.clone().applyMatrix4(camera.matrixWorldInverse); if (c.z > -camera.near) return null; const n = p.clone().project(camera); return [+((n.x + 1) / 2).toFixed(4), +((1 - n.y) / 2).toFixed(4)]; }
let META = null;
window.init = (data) => { WT = data.words; };
window.renderShot = (id, t, d, T) => {
  resetWorld();
  SH[id](t, d, T, clamp(t / d));
  renderer.render(scene, camera);
  const anchors = {}; for (const k in ANCH) anchors[k] = project(ANCH[k]);
  META = { id, T: +T.toFixed(3), anchors };
};
window.frameMeta = () => META;
window.ready = true;
