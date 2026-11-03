// Professor love reel: lecture hall, wedding dressing, heart eyes, 25 shots synced to the voiceover.
import { THREE, PI, clamp, lerp, ease, easeOut, easeIn, V, RNG, M, mesh, box, cyl, ico, canvasTex, P, Mannequin, heartGeo,
  addHeartEyes, setHeartEyes, addMessyHair, addHood, addEarPencil, addTie, addLenses, setFog, addBlushSweat, setBlushSweat } from './toon.js';
const ff = new FontFace('Bangers', 'url(Bangers.ttf)'); await ff.load(); document.fonts.add(ff);
const { DESKS, YOU_DESK, buildHall, drawBoard, makePaper, drawLetter, drawTest, drawVows, makeCalendar, setCalendar } = await import('./sets.js');

const SC = parseFloat(new URLSearchParams(location.search).get('s') || '1');
const W0 = Math.round(1080 * SC), H0 = Math.round(1920 * SC);
const canvas = document.getElementById('c'); canvas.width = W0; canvas.height = H0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W0, H0, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf6f1e8);
const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.02, 120);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);

// ---------------------------------------------------------------- light + set
const hemi = new THREE.HemisphereLight(0xfff8ee, 0xead9c4, 1.45); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.3); sun.castShadow = true;
const SM = SC < 1 ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
sun.position.set(-14, 11, 3); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
const fill = new THREE.DirectionalLight(0xeaf2ff, 0.5); fill.position.set(6, 4, 8); scene.add(fill);
const HALL = buildHall(scene);
const CAL = makeCalendar(scene); CAL.g.position.set(-4.6, 2.3, -4.48);

// ---------------------------------------------------------------- cast
const YOU = new Mannequin({ skin: P.skin, top: 0x9fb4d8, sleeves: 'long', bottom: 0x5a6b8a, legs: 'pants', shoes: 0xffffff, hair: 0x5a3a22, hairStyle: 'short' });
addMessyHair(YOU, 0x5a3a22); addHood(YOU, 0x9fb4d8); addEarPencil(YOU); addHeartEyes(YOU); addBlushSweat(YOU);
const PROF = new Mannequin({ skin: P.skin4, top: 0x8a6a4a, sleeves: 'long', bottom: 0x5a5048, legs: 'pants', shoes: 0x3a2a20, hair: 0x2a1f18, hairStyle: 'short', glasses: true, scale: 1.04 });
addTie(PROF); addLenses(PROF); addHeartEyes(PROF); addBlushSweat(PROF);
const SV = [[P.skin3, 0xffb3cf, 0x1a1a1a, 'curly'], [P.skin, 0x9ee0c8, 0xd9a86a, 'ponytail'], [P.skin2, 0xffe48f, 0x2a1a10, 'short'], [P.skin4, 0xc9b6ec, 0x7a3f1d, 'bob'],
  [P.skin, 0xff8f86, 0x3a2214, 'bun'], [P.skin3, 0xa9d6f2, 0x1a1a1a, 'short'], [P.skin2, 0x6cc7bd, 0xe0c070, 'curly'], [P.skin4, 0xffc9a8, 0x2a1a10, 'ponytail'],
  [P.skin, 0x9fc9ee, 0xb5562a, 'short'], [P.skin3, 0xffb3cf, 0x2a1a10, 'bob'], [P.skin2, 0xc9e3d6, 0x3a2214, 'short']];
const STU = SV.map(([skin, top, hair, hs], i) => new Mannequin({ skin, top, sleeves: i % 3 ? 'short' : 'long', bottom: [0x5a6b8a, 0x7a6aa8, 0x4a5a78][i % 3], legs: 'pants', shoes: 0xffffff, hair, hairStyle: hs, glasses: i % 4 === 1, scale: 0.94 + (i % 3) * 0.03 }));
const PEOPLE = [YOU, PROF, ...STU];
for (const m of PEOPLE) scene.add(m.group);
for (const m of PEOPLE) m.arms.forEach(a => { a.home = { tp: a.thumb.position.clone(), tr: a.thumb.rotation.clone(), ts: a.thumb.scale.clone(), fp: a.fingers.position.clone(), fs: a.fingers.scale.clone() }; });

// ---------------------------------------------------------------- props
const REDPEN = (() => { const g = new THREE.Group(); scene.add(g); cyl(0.012, 0.012, 0.15, 8, M(0xe8202a, { std: true, r: 0.35 }), g, 0, 0, 0);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), M(0xdfe6ec, { std: true, metal: 0.5 })); tip.position.y = -0.09; tip.rotation.x = PI; g.add(tip);
  box(0.006, 0.07, 0.01, M(0xdfe6ec, { std: true, metal: 0.6 }), g, 0, 0.04, 0.014); g.userData.btn = cyl(0.007, 0.007, 0.02, 8, M(0xffffff, { std: true }), g, 0, 0.085, 0); return g; })();
const CHALK = box(0.07, 0.016, 0.016, M(0xffffff, { std: true }), scene);
const PENCIL = (() => { const g = new THREE.Group(); scene.add(g); cyl(0.007, 0.007, 0.15, 6, M(0xffcf3a, { std: true }), g, 0, 0, 0); const t = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.024, 6), M(0xe8c99a, { std: true })); t.position.y = -0.087; t.rotation.x = PI; g.add(t); return g; })();
const LETTER = makePaper(scene), VOWS = makePaper(scene);
const TESTS = Array.from({ length: 5 }, () => makePaper(scene)); TESTS.forEach((p, i) => drawTest(p, i));
const STACK = new THREE.Group(); scene.add(STACK); for (let i = 0; i < 8; i++) box(0.3, 0.004, 0.42, M(0xffffff, { std: true }), STACK, (i % 3) * 0.004, i * 0.005, (i % 2) * 0.004);
const DROOL = (() => { const g = new THREE.Group(); scene.add(g); const m = M(0x9fe0ff, { std: true, r: 0.05, opacity: 0.85, emissive: 0x7fcfef, ei: 0.3 });
  cyl(0.006, 0.004, 0.06, 6, m, g, 0, -0.03, 0); ico(0.014, 1, m, g, 0, -0.065, 0); const pd = mesh(new THREE.CircleGeometry(0.05, 12), m, g, 0, -0.09, 0, false); pd.rotation.x = -PI / 2; return g; })();
const HG = heartGeo(); const HEARTS = Array.from({ length: 26 }, (_, i) => { const h = new THREE.Mesh(HG, M([0xff6fa5, 0xffa6c9, 0xff3d78][i % 3], { std: true, r: 0.35, emissive: 0xff7fa8, ei: 0.25 })); scene.add(h); h.visible = false; return h; });
const RNGH = Array.from({ length: 26 }, (_, i) => { const r = RNG(i + 3); return [r(), r(), r(), r()]; });
// floating pink hearts around a head (slot range a..b)
function floatHearts(T, head, t0, a = 0, b = 8, spread = 0.32, scale = 1) {
  for (let i = a; i < b; i++) {
    const [p, q, r, s] = RNGH[i]; const k = ((T - t0) * 0.7 + p) % 1; if (T < t0) continue;
    const h = HEARTS[i]; h.visible = true; const ang = q * PI * 2 + (T - t0) * 0.6;
    h.position.copy(head).add(V(Math.cos(ang) * spread * (0.7 + 0.5 * r), -0.05 + k * 0.6, Math.sin(ang) * spread * (0.7 + 0.5 * r)));
    const sc2 = 0.045 * scale * (0.7 + 0.6 * s) * Math.sin(PI * k); h.scale.setScalar(Math.max(0.001, sc2));
    h.lookAt(camera.position); h.rotateZ(0.3 * Math.sin((T + i) * 3));
  }
}

// ---------------------------------------------------------------- helpers
let WT = []; const w = i => WT[i].s;
let ANCH = {};
function put(m, x, y, z, ry = 0) {
  m.group.visible = true; m.reset(); m.group.quaternion.identity();
  m.arms.forEach(a => { a.thumb.position.copy(a.home.tp); a.thumb.rotation.copy(a.home.tr); a.thumb.scale.copy(a.home.ts); a.fingers.position.copy(a.home.fp); a.fingers.scale.copy(a.home.fs); });
  m.group.position.set(x, y, z); m.group.rotation.set(0, ry, 0); if (m.heartEyes) setHeartEyes(m, false); if (m.blush) setBlushSweat(m, false, false);
  if (m.lenses) setFog(m, 0);
  return m;
}
function cam(p, t, fov = 45, up = null, roll = 0) { camera.position.copy(p); camera.up.copy(up || V(0, 1, 0)); camera.lookAt(t); if (roll) camera.rotateZ(roll); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
const camPos = () => camera.position.clone();
function handPt(m, side, off = V(0, -0.07, 0)) { const a = side === 'L' ? m.armL : m.armR; return m.worldOf(a.hand, off); }
const faceOf = m => m.worldOf(m.head, V(0, 0.13, 0.11));
const headC = m => m.worldOf(m.head, V(0, 0.13, 0));
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
  m.group.updateMatrixWorld(true); const hp = headC(m);
  const inv = new THREE.Matrix4().copy(m.spine.matrixWorld).invert();
  const loc = target.clone().applyMatrix4(inv).sub(hp.clone().applyMatrix4(inv));
  m.head.rotation.set(clamp(-Math.atan2(loc.y, Math.hypot(loc.x, loc.z)), -0.8, 0.8) * k, clamp(Math.atan2(loc.x, loc.z), -lim, lim) * k, 0, 'YXZ');
}
function sitAt(m, k) { const [x, z] = DESKS[k]; put(m, x, 0, z + 0.1, PI); const s = m.cfg.scale; m.hips.position.y = 0.485 / s + 0.07; m.leg('L', 1.35, 0.06, 1.35); m.leg('R', 1.35, 0.06, 1.35); m.arm('L', 0.9, 0.15, 0, 0.75); m.arm('R', 0.9, 0.15, 0, 0.75); return m; }
const deskTop = k => { const [x, z] = DESKS[k]; return V(x, 0.775, z - 0.42); };
function tremble(m, T, a = 0.006) { m.group.position.x += a * Math.sin(T * 157); m.group.position.z += a * Math.cos(T * 131); m.head.rotation.z += 0.03 * Math.sin(T * 97); }
function students(T, o = {}) {   // the class at their desks (YOU's desk is skipped)
  let i = 0;
  DESKS.forEach((d, k) => { if (k === YOU_DESK) return; const m = STU[i++]; if (!m) return; sitAt(m, k);
    m.setFace(typeof o.face === 'function' ? o.face(m, k) : (o.face || { eyes: 'normal', mouth: 'flat' }));
    if (o.look) headLook(m, o.look, 1, 1.0); });
}
function guests(T, clap = true, face = { eyes: 'happy', brows: 'up', mouth: 'grin' }) {
  HALL.wchairs.forEach((c, k) => { const m = STU[k]; if (!m) return; const p = c.position; put(m, p.x, 0, p.z - 0.05, PI); const s = m.cfg.scale;
    m.hips.position.y = 0.485 / s + 0.07; m.leg('L', 1.35, 0.06, 1.35); m.leg('R', 1.35, 0.06, 1.35);
    const cl = clap ? Math.abs(Math.sin(T * 9 + k)) : 0; m.arm('L', 1.15, 0.25 + 0.25 * cl, 0, 1.3); m.arm('R', 1.15, 0.25 + 0.25 * cl, 0, 1.3); m.setFace(face); });
}
function hallMode(mode) {
  const wed = mode === 'wedding'; HALL.wedding.visible = wed; HALL.desks.forEach(d => d.visible = !wed); drawBoard(HALL, wed ? 'wedding' : 'class');
  HALL.minHand.rotation.z = -1.2; HALL.hourHand.rotation.z = -2.6;
}
// YOU at his desk, seated
const youSeat = () => sitAt(YOU, YOU_DESK);

// ---------------------------------------------------------------- shots
const SH = {};
SH['00'] = (t, d, T, u) => {   // opening hook: both trembling next to the chalkboard, then pull back to the class watching
  hallMode('class'); students(T, { face: { eyes: 'wide', brows: 'up', mouth: 'o' }, look: V(-0.6, 1.6, -3.7) });
  const y = put(YOU, -0.74, 0, -3.65, PI / 2 - 0.3), p = put(PROF, -0.36, 0, -3.65, -PI / 2 + 0.3);
  for (const m of [y, p]) { tremble(m, T); setBlushSweat(m, true, true, T); m.arm('L', 0.3, 0.15, 0, 1.2); m.arm('R', 0.3, 0.15, 0, 1.2); }
  y.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' }); p.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' });
  REDPEN.visible = true; REDPEN.position.copy(handPt(p, 'R', V(0, -0.1, 0.02))); REDPEN.rotation.set(0.3, 0, 0.2);
  const k = ease(sstep(0.42, 1.0, u)); const mid = V(-0.55, 1.74, -3.65);
  cam(lerpV(V(-0.55, 1.78, -2.12), V(-0.2, 2.6, 4.2), k), lerpV(mid, V(-0.4, 1.25, -2.2), k), lerp(40, 58, k));
};
SH['01'] = (t, d, T, u) => {   // asleep on the desk, drooling
  hallMode('class'); students(T); const m = youSeat();
  m.spine.rotation.x = 1.0; m.head.rotation.set(-0.4, 0.2, 1.2, 'YXZ'); m.arm('L', 1.5, 0.5, 0, 1.6); m.arm('R', 1.5, 0.5, 0, 1.6);
  m.setFace({ eyes: 'closed', brows: 'normal', mouth: 'o' }); m.group.position.y += 0.01 * Math.sin(T * 3);
  DROOL.visible = true; DROOL.position.copy(m.worldOf(m.head, V(0.02, 0.06, 0.12))); DROOL.scale.set(1, 1 + 0.25 * Math.sin(T * 3), 1);
  const f = faceOf(m); cam(f.clone().add(V(-0.55, 0.18, -0.35)), f.clone().add(V(0, -0.05, 0)), 40); ANCH.you = f;
};
SH['02'] = (t, d, T, u) => {   // stack of tests with big red F's
  hallMode('class'); students(T); const m = youSeat(); m.spine.rotation.x = 1.0; m.head.rotation.set(-0.4, 0.2, 1.2, 'YXZ'); m.setFace({ eyes: 'closed', mouth: 'o' });
  const c = deskTop(YOU_DESK).add(V(0.85, 0.01, -0.05));
  TESTS.forEach((p, i) => { p.g.visible = true; p.g.position.copy(c).add(V((i - 2) * 0.05, 0.002 * i, (i % 2) * 0.03)); p.g.rotation.set(-PI / 2, 0, (i - 2) * 0.22 + 0.05 * Math.sin(T + i)); });
  cam(c.clone().add(V(0.0, lerp(0.75, 0.6, ease(u)), 0.05)), c, 46, V(0, 0, -1));
};
SH['03'] = (t, d, T, u) => {   // the door opens in slow motion, sunlight behind him
  hallMode('class'); students(T, { look: V(6, 1.4, -3.2) }); youSeat(); YOU.setFace({ eyes: 'half', mouth: 'flat' }); headLook(YOU, V(6, 1.4, -3.2), 1);
  HALL.door.rotation.y = -1.7 * ease(u); HALL.doorLight.material.color.setHex(0xfff6d6);
  const p = put(PROF, 6.55, 0, -3.15, -PI / 2); p.setFace({ eyes: 'normal', brows: 'normal', mouth: 'smile' });
  cam(V(3.3, 1.35, -1.2), V(6.1, 1.45, -3.25), 44); ANCH.door = V(6.1, 1.6, -3.2);
};
SH['04'] = (t, d, T, u) => {   // he walks in (slow motion), backlit
  hallMode('class'); students(T, { face: { eyes: 'wide', brows: 'up', mouth: 'o' } }); youSeat(); YOU.setFace({ eyes: 'normal', mouth: 'o' });
  HALL.door.rotation.y = -1.7; const x = lerp(6.0, 4.7, ease(u)); const p = put(PROF, x, 0, -3.15, -PI / 2 - 0.15);
  const s = Math.sin(T * 4.5); p.leg('L', 0.35 * s, 0.05, 0.2 * Math.max(0, s)); p.leg('R', -0.35 * s, 0.05, 0.2 * Math.max(0, -s)); p.arm('L', -0.2 * s, 0.1, 0, 0.3);
  p.arm('R', 0.6, 0.1, 0, 1.2); CHALK.visible = true; CHALK.position.copy(handPt(p, 'R', V(0, -0.09, 0.02)));
  p.setFace({ eyes: 'normal', brows: 'normal', mouth: 'smile' }); headLook(p, V(0, 1.4, 0.5), 0.6);
  for (const m of STU) headLook(m, faceOf(p), 1, 1.1);
  cam(V(lerp(3.5, 3.7, u), 0.7, -2.0), faceOf(p).add(V(0, -0.15, 0)), 50); ANCH.prof = faceOf(p);
};
function heartPop(T, t0) { return T - t0; }
SH['05'] = (t, d, T, u) => {   // his eyes POP into hearts
  hallMode('class'); students(T); const m = youSeat(); m.spine.rotation.x = 0.1; headLook(m, V(4.5, 1.6, -3.0), 0.7);
  const k = T - w(16); if (k > 0) { m.setFace({ eyes: 'none', brows: 'up', mouth: 'o' }); setHeartEyes(m, true, k); setBlushSweat(m, true, false); } else m.setFace({ eyes: T > w(15) - 0.2 ? 'wide' : 'half', brows: 'up', mouth: 'o' });
  const f = faceOf(m); const fw = V(-Math.sin(m.group.rotation.y), 0, -Math.cos(m.group.rotation.y));
  cam(f.clone().add(V(0.12, 0.02, -lerp(0.62, 0.5, ease(u)))).add(V(0.3, 0, 0)), f, 34); ANCH.you = f;
  if (k > 0) floatHearts(T, headC(m), w(16), 0, 10, 0.25);
};
SH['06'] = (t, d, T, u) => {
  hallMode('class'); students(T); const m = youSeat(); m.spine.rotation.x = 0.05; headLook(m, V(4.5, 1.6, -3.0), 0.6);
  m.setFace({ eyes: 'none', brows: 'up', mouth: 'smile' }); setHeartEyes(m, true, T - w(16)); setBlushSweat(m, true, false);
  m.arm('L', 0.9, 0.15, 0, 1.4); m.arm('R', 0.9, 0.15, 0, 1.4); m.group.position.y += 0.012 * Math.abs(Math.sin(T * PI * 1.6));
  const f = faceOf(m); cam(f.clone().add(V(0.35, -0.12, -lerp(1.15, 1.0, u))), f.clone().add(V(0, -0.12, 0)), 44); ANCH.you = f;
  floatHearts(T, headC(m), w(16), 0, 14, 0.3);
};
SH['07'] = (t, d, T, u) => {   // exam day: he hands out the papers
  hallMode('class'); students(T, { face: { eyes: 'half', mouth: 'flat' } }); youSeat(); YOU.setFace({ eyes: 'none', mouth: 'smile' }); setHeartEyes(YOU, true, T - w(16));
  const z = lerp(-2.0, -0.2, ease(u)); const p = put(PROF, 2.4, 0, z, 0.15 * PI); const s = Math.sin(T * 7); p.leg('L', 0.3 * s, 0.05, 0.15); p.leg('R', -0.3 * s, 0.05, 0.15);
  p.arm('L', 0.9, 0.2, 0, 1.2); STACK.visible = true; STACK.position.copy(handPt(p, 'L', V(0, -0.06, 0.08))); STACK.quaternion.copy(p.group.quaternion);
  p.arm('R', 1.2, 0.6 + 0.2 * Math.sin(T * 6), 0, 0.3); p.setFace({ eyes: 'normal', brows: 'normal', mouth: 'smile' });
  [0, 1, 2, 3, 4, 6, 7].forEach((k, i) => { const tp = TESTS[i % 5]; if (!tp) return; });
  cam(V(2.0, 1.65, 2.2), V(2.4, 1.15, -1.0), 50);
};
function writing(m, T, sp = 1) {
  ikArm(m, 'R', deskTop(YOU_DESK).add(V(0.16 + 0.04 * Math.sin(T * 30 * sp), 0.04, 0.27 + 0.02 * Math.sin(T * 17 * sp))), [1.0, 0.1, 0, 1.0]);
  PENCIL.visible = true; PENCIL.position.copy(handPt(m, 'R', V(0, -0.1, 0.02))); PENCIL.rotation.set(0.6, 0, -0.3);
}
SH['08'] = (t, d, T, u) => {
  hallMode('class'); students(T, { face: { eyes: 'half', brows: 'worried', mouth: 'flat' } }); const m = youSeat(); m.spine.rotation.x = 0.3;
  m.setFace({ eyes: 'none', brows: 'up', mouth: 'grin' }); setHeartEyes(m, true, T - w(16)); setBlushSweat(m, true, false); writing(m, T, 1.4);
  const pp = deskTop(YOU_DESK).add(V(0.05, 0.002, 0.1)); LETTER.g.visible = true; LETTER.g.position.copy(pp); LETTER.g.rotation.set(-PI / 2, 0, 0.15); drawLetter(LETTER, 0.1 + 0.2 * u);
  const f = faceOf(m); cam(f.clone().add(V(-0.75, 0.05, -0.6)), f.clone().add(V(0.05, -0.25, 0)), 46); ANCH.you = f;
  floatHearts(T, headC(m), w(16), 0, 8, 0.28);
};
SH['09'] = (t, d, T, u) => {
  hallMode('class'); students(T); const m = youSeat(); m.spine.rotation.x = 0.35;
  m.setFace({ eyes: 'none', brows: 'up', mouth: 'grin' }); setHeartEyes(m, true, T - w(16)); setBlushSweat(m, true, false); writing(m, T, 1.8);
  const pp = deskTop(YOU_DESK).add(V(0.05, 0.002, 0.1)); LETTER.g.visible = true; LETTER.g.position.copy(pp); LETTER.g.rotation.set(-PI / 2, 0, 0.15); drawLetter(LETTER, 0.3 + 0.2 * u);
  const f = faceOf(m); cam(f.clone().add(V(0.08, -0.06, -0.42)), f.clone().add(V(0, -0.04, 0)), 40); ANCH.you = f;
  floatHearts(T, headC(m), w(16), 0, 8, 0.22);
};
SH['10'] = (t, d, T, u) => {   // the love letter
  hallMode('class'); students(T); const m = youSeat(); m.spine.rotation.x = 0.35; m.setFace({ eyes: 'none', mouth: 'grin' }); setHeartEyes(m, true, T - w(16)); writing(m, T, 0.8);
  const pp = deskTop(YOU_DESK).add(V(0.05, 0.002, 0.1)); LETTER.g.visible = true; LETTER.g.position.copy(pp); LETTER.g.rotation.set(-PI / 2, 0, 0.15); drawLetter(LETTER, lerp(0.5, 1.0, sstep(0, 0.85, u)));
  cam(pp.clone().add(V(0.02, lerp(0.5, 0.42, ease(u)), 0.1)), pp, 46, V(0, 0, -1).applyAxisAngle(V(0, 1, 0), 0.15)); ANCH.letter = pp;
};
SH['11'] = (t, d, T, u) => {   // hands it in: drops it on his desk
  hallMode('class'); students(T, { look: V(2.2, 1.0, -3.0) }); const pd = V(2.2, 0.82, -3.2);
  const y = put(YOU, 2.15, 0, -2.55, PI); y.setFace({ eyes: 'none', brows: 'worried', mouth: 'wavy' }); setHeartEyes(y, true, T - w(16)); setBlushSweat(y, true, true, T); tremble(y, T, 0.004);
  const k = sstep(w(36), w(38), T); ikArm(y, 'R', pd.clone().add(V(0.05, 0.12 + 0.25 * (1 - k), 0.25 * (1 - k))), [1.2, 0.1, 0, 0.6]);
  LETTER.g.visible = true; drawLetter(LETTER, 1); LETTER.g.position.copy(k < 1 ? handPt(y, 'R', V(0, -0.1, 0.03)) : pd.clone().add(V(0.05, 0.005, 0.0))); LETTER.g.rotation.set(-PI / 2 + 0.8 * (1 - k), 0, 0.3);
  const p = put(PROF, 2.2, 0, -3.85, 0); p.setFace({ eyes: 'normal', brows: 'up', mouth: 'flat' }); headLook(p, faceOf(y), 0.8);
  cam(V(3.3, 1.55, -1.45), V(2.15, 1.15, -3.0), 48);
};
SH['12'] = (t, d, T, u) => {   // you run
  hallMode('class'); students(T, { face: { eyes: 'wide', brows: 'up', mouth: 'o' }, look: V(4.5, 1.2, -2.5) }); HALL.door.rotation.y = -1.7;
  const x = lerp(2.6, 6.3, easeIn(u)); const y = put(YOU, x, 0, -2.6, PI / 2 + 0.1); const s = Math.sin(T * 16);
  y.leg('L', 0.8 * s, 0.05, 0.6 * Math.max(0, s) + 0.2); y.leg('R', -0.8 * s, 0.05, 0.6 * Math.max(0, -s) + 0.2); y.arm('L', -0.8 * s, 0.15, 0, 1.3); y.arm('R', 0.8 * s, 0.15, 0, 1.3); y.spine.rotation.x = 0.35;
  y.setFace({ eyes: 'none', brows: 'worried', mouth: 'wavy' }); setHeartEyes(y, true, T - w(16)); setBlushSweat(y, true, true, T);
  const p = put(PROF, 2.2, 0, -3.85, 0); p.setFace({ eyes: 'normal', brows: 'up', mouth: 'o' }); headLook(p, faceOf(y), 0.9);
  cam(V(0.9, 1.55, -2.1), V(5.0, 1.1, -2.75), 54);
};
SH['13'] = (t, d, T, u) => {   // next day: he walks to your desk with the letter
  hallMode('class'); students(T, { look: V(-1.2, 1.3, -0.4) }); const m = youSeat(); m.setFace({ eyes: 'half', brows: 'worried', mouth: 'tight' }); setBlushSweat(m, true, true, T);
  const z = lerp(-2.6, -0.95, ease(u)); const p = put(PROF, -1.25 + 0.4 * (1 - u), 0, z, 0); const s = Math.sin(T * 6); p.leg('L', 0.3 * s * (1 - u), 0.05, 0.15); p.leg('R', -0.3 * s * (1 - u), 0.05, 0.15);
  p.arm('R', 0.9, 0.15, 0, 1.1); LETTER.g.visible = true; drawLetter(LETTER, 1); LETTER.g.position.copy(handPt(p, 'R', V(0, -0.12, 0.05))); LETTER.g.rotation.set(-0.4, PI, 0);
  p.setFace({ eyes: 'normal', brows: 'normal', mouth: 'flat' }); headLook(m, faceOf(p), 1);
  cam(V(-0.95, 1.55, 1.75), V(-1.15, 1.3, -1.2), 50);
};
SH['14'] = (t, d, T, u) => {   // red pen writes on it
  hallMode('class'); students(T); youSeat(); const pp = deskTop(YOU_DESK).add(V(0.05, 0.002, 0.1));
  LETTER.g.visible = true; LETTER.g.position.copy(pp); LETTER.g.rotation.set(-PI / 2, 0, 0.0); const g = sstep(0.12, 0.98, u); drawLetter(LETTER, 1, g * 0.999);
  const p = put(PROF, -1.15, 0, -0.95, 0); const tip = LETTER.g.localToWorld(V(-0.03 + 0.08 * Math.sin(g * 9), 0.02 * Math.cos(g * 7), 0.03));
  ikArm(p, 'R', tip.clone().add(V(0, 0.09, 0)), [1.2, 0.1, 0, 0.9]); REDPEN.visible = true; REDPEN.position.copy(tip.clone().add(V(0, 0.08, 0))); REDPEN.rotation.set(0.3, 0, 0.3);
  cam(pp.clone().add(V(0.06, 0.48, 0.12)), pp, 50, V(0, 0, -1)); ANCH.letter = pp;
};
SH['15'] = (t, d, T, u) => {   // giant red A+
  hallMode('class'); students(T); youSeat(); const pp = deskTop(YOU_DESK).add(V(0.05, 0.002, 0.1));
  LETTER.g.visible = true; LETTER.g.position.copy(pp); LETTER.g.rotation.set(-PI / 2, 0, 0.0); drawLetter(LETTER, 1, 1);
  const ap = LETTER.g.localToWorld(V(0.025, 0.016, 0)); cam(ap.clone().add(V(0, lerp(0.5, 0.42, ease(u)), 0.001)), ap, 48, V(0, 0, -1)); ANCH.aplus = ap;
};
SH['16'] = (t, d, T, u) => {   // you look up
  hallMode('class'); students(T, { look: V(-1.2, 1.3, -0.4) }); const m = youSeat(); const p = put(PROF, -1.15, 0, -0.95, 0);
  const k = sstep(w(52) - 0.1, w(53), T); m.spine.rotation.x = 0.35 * (1 - k); headLook(m, faceOf(p), k); m.setFace({ eyes: k > 0.5 ? 'wide' : 'half', brows: 'up', mouth: 'o' }); setBlushSweat(m, true, false);
  const f = faceOf(m); cam(f.clone().add(V(0.05, 0.2, -lerp(0.75, 0.55, ease(u)))), f, 36); ANCH.you = f;
};
SH['17'] = (t, d, T, u) => {   // he looks at you
  hallMode('class'); students(T, { look: V(-1.2, 1.3, -0.4) }); const m = youSeat(); headLook(m, V(-1.15, 1.85, -0.95), 1); const p = put(PROF, -1.15, 0, -0.95, 0);
  p.spine.rotation.x = 0.2; headLook(p, faceOf(m), 1); p.setFace({ eyes: 'normal', brows: 'up', mouth: 'flat' });
  const f = faceOf(p); cam(f.clone().add(V(-0.05, -0.08, lerp(0.75, 0.55, ease(u)))), f, 36);
};
SH['18'] = (t, d, T, u) => {   // his glasses fog up, then his eyes POP into hearts
  hallMode('class'); students(T, { look: V(-1.2, 1.3, -0.4) }); const m = youSeat(); headLook(m, V(-1.15, 1.85, -0.95), 1); const p = put(PROF, -1.15, 0, -0.95, 0);
  p.spine.rotation.x = 0.2; headLook(p, faceOf(m), 1);
  const fog = T < w(62) - 0.1 ? sstep(w(58), w(61), T) : 1 - sstep(w(62) - 0.1, w(62) + 0.15, T); setFog(p, fog);
  const k = T - (w(62) - 0.02);
  if (k > 0) { p.setFace({ eyes: 'none', brows: 'up', mouth: 'smile' }); setHeartEyes(p, true, k); setBlushSweat(p, true, false); floatHearts(T, headC(p), w(62), 0, 12, 0.28); } else p.setFace({ eyes: 'normal', brows: 'up', mouth: 'flat' });
  const f = faceOf(p); cam(f.clone().add(V(0.0, -0.05, lerp(0.62, 0.5, ease(u)))), f, 34); ANCH.prof = f;
};
SH['19'] = (t, d, T, u) => {   // six months later: calendar pages flip
  hallMode('class'); setCalendar(CAL, Math.min(6, u * 7.2)); const c = CAL.g.position.clone();
  cam(c.clone().add(V(0.05, -0.02, lerp(1.25, 1.05, u))), c, 40);
};
SH['20'] = (t, d, T, u) => {   // the wedding
  hallMode('wedding'); guests(T, true); const y = put(YOU, -0.85, 0, -3.35, PI / 2 - 0.2), p = put(PROF, -0.15, 0, -3.35, -PI / 2 + 0.2);
  y.setFace({ eyes: 'happy', brows: 'up', mouth: 'grin' }); p.setFace({ eyes: 'happy', brows: 'up', mouth: 'smile' }); setBlushSweat(y, true, false); setBlushSweat(p, true, false);
  ikArm(y, 'L', handPt(p, 'R').lerp(handPt(y, 'L'), 0.5).add(V(0, 0.05, 0)), [0.6, 0.2, 0, 0.6]);
  cam(V(lerp(-0.2, -0.5, u), lerp(2.3, 2.1, u), lerp(5.4, 4.6, ease(u))), V(-0.5, 1.2, -2.6), 58);
};
SH['21'] = (t, d, T, u) => {   // you read your vows, nervous
  hallMode('wedding'); guests(T, false, { eyes: 'normal', mouth: 'smile' }); const y = put(YOU, -0.85, 0, -3.35, PI / 2 - 0.2), p = put(PROF, -0.15, 0, -3.35, -PI / 2 + 0.2);
  y.setFace({ eyes: 'wide', brows: 'worried', mouth: 'wavy' }); setBlushSweat(y, true, true, T); tremble(y, T, 0.004);
  y.arm('L', 1.2, 0.15, 0, 0.9); y.arm('R', 1.2, 0.15, 0, 0.9); const c = handPt(y, 'L').add(handPt(y, 'R')).multiplyScalar(0.5);
  VOWS.g.visible = true; drawVows(VOWS, 0); VOWS.g.position.copy(c.add(V(0, 0.12, 0))); VOWS.g.quaternion.copy(y.group.quaternion); VOWS.g.rotateX(-0.35); VOWS.g.rotation.z += 0.02 * Math.sin(T * 90);
  p.setFace({ eyes: 'normal', brows: 'up', mouth: 'smile' }); headLook(p, VOWS.g.position, 0.8);
  const f = faceOf(y); cam(f.clone().add(V(0.8, -0.12, 0.42)), f.clone().lerp(VOWS.g.position, 0.4), 46); ANCH.you = f;
};
SH['22'] = (t, d, T, u) => {   // he takes out his red pen: click!
  hallMode('wedding'); guests(T, false, { eyes: 'normal', mouth: 'smile' }); const y = put(YOU, -0.85, 0, -3.35, PI / 2 - 0.2), p = put(PROF, -0.15, 0, -3.35, -PI / 2 + 0.2);
  p.setFace({ eyes: 'half', brows: 'cocky', mouth: 'smirk' }); const k = sstep(w(74), w(76), T);
  ikArm(p, 'R', headPt(p, -0.05, -0.36 + 0.1 * k, 0.32), [1.3, 0.2, 0, 1.6]);
  REDPEN.visible = true; REDPEN.position.copy(handPt(p, 'R', V(0, -0.05, 0.03))); REDPEN.rotation.set(0, 0, 0.25);
  const clk = T > w(78) && T < w(78) + 0.12; REDPEN.userData.btn.position.y = clk ? 0.075 : 0.085;
  const fw = V(Math.sin(p.group.rotation.y), 0, Math.cos(p.group.rotation.y)); cam(REDPEN.position.clone().addScaledVector(fw, 0.36).add(V(0.0, 0.05, 0.0)), REDPEN.position.clone().add(V(0, 0.03, 0)), 38); ANCH.pen = REDPEN.position.clone().add(V(0, 0.09, 0));
  y.setFace({ eyes: 'wide', mouth: 'o' });
};
SH['23'] = (t, d, T, u) => {   // and corrects your spelling
  hallMode('wedding'); guests(T, false); const y = put(YOU, -0.85, 0, -3.35, PI / 2 - 0.2), p = put(PROF, -0.15, 0, -3.35, -PI / 2 + 0.2);
  y.arm('L', 1.2, 0.15, 0, 0.9); y.arm('R', 1.2, 0.15, 0, 0.9); const c = handPt(y, 'L').add(handPt(y, 'R')).multiplyScalar(0.5);
  VOWS.g.visible = true; VOWS.g.position.copy(c.add(V(0, 0.12, 0))); VOWS.g.quaternion.copy(y.group.quaternion); VOWS.g.rotateX(-0.35);
  const k = sstep(0.0, 1.0, (T - w(79)) / (w(82) + 0.35 - w(79))); drawVows(VOWS, k);
  const tip = VOWS.g.localToWorld(V(-0.05 + 0.1 * Math.sin(k * 12), 0.1 - 0.25 * k, 0.03)); ikArm(p, 'R', tip, [1.2, 0.2, 0, 1.0]);
  REDPEN.visible = true; REDPEN.position.copy(tip.clone().add(V(0.0, 0.06, 0.04))); REDPEN.rotation.set(0.5, 0, 0.6);
  const v = VOWS.g.position.clone(); const n = VOWS.g.localToWorld(V(0, 0, 1)).sub(v).normalize();
  cam(v.clone().addScaledVector(n, 0.5).add(V(0, 0.03, 0)), v, 44); ANCH.vows = v;
};
SH['24'] = (t, d, T, u) => {   // everyone laughs, both with heart eyes, hearts everywhere
  hallMode('wedding'); guests(T, true, { eyes: 'happy', brows: 'up', mouth: 'grin' }); STU.forEach((m, i) => { m.group.position.y += 0.02 * Math.abs(Math.sin(T * 12 + i)); m.spine.rotation.x = -0.15 * Math.abs(Math.sin(T * 12 + i)); });
  const y = put(YOU, -0.85, 0, -3.35, PI / 2 - 0.2), p = put(PROF, -0.15, 0, -3.35, -PI / 2 + 0.2);
  for (const m of [y, p]) { m.setFace({ eyes: 'none', brows: 'up', mouth: 'grin' }); setHeartEyes(m, true, T - w(81) + 0.3); setBlushSweat(m, true, false); }
  y.arm('L', 1.2, 0.15, 0, 0.9); y.arm('R', 1.2, 0.15, 0, 0.9); const c = handPt(y, 'L').add(handPt(y, 'R')).multiplyScalar(0.5);
  VOWS.g.visible = true; drawVows(VOWS, 1); VOWS.g.position.copy(c.add(V(0, 0.12, 0))); VOWS.g.quaternion.copy(y.group.quaternion); VOWS.g.rotateX(-0.35);
  cam(V(-0.5, lerp(1.8, 1.95, u), lerp(-1.75, -1.2, ease(u))), V(-0.5, 1.62, -3.35), 54);
  floatHearts(T, headC(y), w(81) - 0.3, 0, 13, 0.4, 1.4); floatHearts(T, headC(p), w(81) - 0.3, 13, 26, 0.4, 1.4); ANCH.couple = V(-0.5, 1.8, -3.35);
};

// ---------------------------------------------------------------- frame
function resetWorld() {
  for (const m of PEOPLE) m.group.visible = false;
  [REDPEN, CHALK, PENCIL, LETTER.g, VOWS.g, STACK, DROOL, ...TESTS.map(p => p.g)].forEach(o => o.visible = false);
  HEARTS.forEach(h => h.visible = false); REDPEN.userData.btn.position.y = 0.085; HALL.door.rotation.y = 0; ANCH = {};
}
function project(p) { const c = p.clone().applyMatrix4(camera.matrixWorldInverse); if (c.z > -camera.near) return null; const n = p.clone().project(camera); return [+((n.x + 1) / 2).toFixed(4), +((1 - n.y) / 2).toFixed(4)]; }
let META = null;
window.init = (data) => { WT = data.words; };
window.renderShot = (id, t, d, T) => {
  resetWorld(); SH[id](t, d, T, clamp(t / d));
  for (const h of HEARTS) if (h.visible) { h.lookAt(camera.position); }
  renderer.render(scene, camera);
  const anchors = {}; for (const k in ANCH) anchors[k] = project(ANCH[k]);
  META = { id, T: +T.toFixed(3), anchors };
};
window.frameMeta = () => META;
window.ready = true;
