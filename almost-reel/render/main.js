// Almost-home reel: street, front porch, hallway; 26 shots synced to the voiceover.
import { THREE, PI, clamp, lerp, ease, easeOut, easeIn, V, RNG, M, mesh, box, cyl, ico, canvasTex, P, Mannequin, addBlushSweat, setBlushSweat } from './toon.js';
const ff = new FontFace('Bangers', 'url(Bangers.ttf)'); await ff.load(); document.fonts.add(ff);
const { PO, HA, buildStreet, buildPorch, buildHall, makeBackpack, makeDog, makeBike, makeSnail, makeKeys } = await import('./sets.js');

const SC = parseFloat(new URLSearchParams(location.search).get('s') || '1');
const W0 = Math.round(1080 * SC), H0 = Math.round(1920 * SC);
const canvas = document.getElementById('c'); canvas.width = W0; canvas.height = H0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W0, H0, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.02, 400);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);

// ---------------------------------------------------------------- lights & sets
const hemi = new THREE.HemisphereLight(0xdcefff, 0xf0dcc4, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6); sun.castShadow = true;
const SM = SC < 1 ? 1024 : 2048; sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; scene.add(sun, sun.target);
const sky = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7cc4f2'); g.addColorStop(0.6, '#c4e6f8'); g.addColorStop(1, '#fdebd8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
const STR = buildStreet(scene), POR = buildPorch(scene), HAL = buildHall(scene);
function useSet(name, focus) {
  STR.group.visible = name === 'street'; POR.group.visible = name === 'porch'; HAL.group.visible = name === 'hall';
  const R = name === 'street' ? 10 : 5; sun.target.position.copy(focus); sun.position.copy(focus).add(V(6, 14, 8));
  const sc = sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 50; sc.updateProjectionMatrix();
  scene.background = name === 'hall' ? new THREE.Color(0xf3efe8) : sky;
  hemi.intensity = name === 'hall' ? 1.5 : 1.3; sun.intensity = name === 'hall' ? 1.8 : 2.6;
}

// ---------------------------------------------------------------- cast
const YOU = new Mannequin({ skin: 0xf1c39e, top: 0xffd36b, sleeves: 'short', bottom: 0x5a6b8a, legs: 'pants', shoes: 0xffffff, hair: 0x4a3020, hairStyle: 'short' });
makeBackpack(YOU); addBlushSweat(YOU);
const SKIN = YOU.skinMat, SKIN0 = SKIN.color.clone();
const cheeks = []; for (const s of [1, -1]) { const c = ico(0.055, 1, SKIN, YOU.head, 0.07 * s, 0.13 - 0.06, 0.07); c.visible = false; cheeks.push(c); }
const LINING = (() => { const g = new THREE.Group(); scene.add(g); box(0.12, 0.14, 0.02, M(0xffffff, { std: true, r: 0.9 }), g, 0, -0.07, 0); return g; })();
const LINING2 = (() => { const g = new THREE.Group(); scene.add(g); box(0.12, 0.14, 0.02, M(0xffffff, { std: true, r: 0.9 }), g, 0, -0.07, 0); return g; })();
const JOG = new Mannequin({ skin: P.skin3, top: 0x6cc7bd, sleeves: 'none', bottom: 0x2c3a5a, legs: 'shorts', shoes: 0xff8f86, hair: 0x1a1a1a, hairStyle: 'short' });
box(0.26, 0.03, 0.26, M(0xff8f86), JOG.head, 0, 0.21, 0);
const LADY = new Mannequin({ skin: P.skin2, top: 0xc9b6ec, dress: 0xc9b6ec, sleeves: 'short', legs: 'bare', shoes: 0xffffff, hair: 0xd9a86a, hairStyle: 'bun', scale: 0.96 });
const KID = new Mannequin({ skin: P.skin, top: 0x9ee0c8, sleeves: 'short', bottom: 0x5a6b8a, legs: 'shorts', shoes: 0xffffff, hair: 0x7a3f1d, hairStyle: 'curly', scale: 0.62 });
const helmet = mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, PI * 2, 0, PI / 2), M(0xff6f6f, { std: true }), KID.head, 0, 0.17, 0); helmet.scale.set(1, 0.9, 1.05);
const PEOPLE = [YOU, JOG, LADY, KID];
for (const m of PEOPLE) scene.add(m.group);
for (const m of PEOPLE) m.arms.forEach(a => { a.home = { tp: a.thumb.position.clone(), tr: a.thumb.rotation.clone(), ts: a.thumb.scale.clone(), fp: a.fingers.position.clone(), fs: a.fingers.scale.clone() }; });
const DOG = makeDog(scene), BIKE = makeBike(scene), SNAIL = makeSnail(scene), KEYS = makeKeys(scene);
const LEASH = cyl(0.004, 0.004, 1, 4, M(0xe8463a), scene);
const STUFF = [[0xffe14f, 'banana'], [0xffffff, 'paper'], [0x9fc9ee, 'sock'], [0x7cc48a, 'book'], [0xff8f86, 'can']].map(([c, k]) => {
  let m; if (k === 'banana') { m = cyl(0.025, 0.02, 0.16, 6, M(c, { std: true }), scene); m.rotation.z = 0.6; } else if (k === 'paper') m = box(0.16, 0.005, 0.22, M(c, { std: true }), scene);
  else if (k === 'sock') m = box(0.06, 0.16, 0.05, M(c, { std: true }), scene); else if (k === 'book') m = box(0.14, 0.03, 0.2, M(c, { std: true }), scene); else m = cyl(0.03, 0.03, 0.1, 8, M(c, { std: true, metal: 0.3 }), scene);
  return m; });
const HALO = mesh(new THREE.CircleGeometry(1.4, 24), M(0xffe27a, { basic: true, opacity: 0.8 }), scene, 0, 0, 0, false);

// ---------------------------------------------------------------- helpers
let WT = []; const w = i => WT[i].s; let ANCH = {};
function put(m, x, y, z, ry = 0) {
  m.group.visible = true; m.reset(); m.group.quaternion.identity();
  m.arms.forEach(a => { a.thumb.position.copy(a.home.tp); a.thumb.rotation.copy(a.home.tr); a.thumb.scale.copy(a.home.ts); a.fingers.position.copy(a.home.fp); a.fingers.scale.copy(a.home.fs); });
  m.group.position.set(x, y, z); m.group.rotation.set(0, ry, 0); if (m.blush) setBlushSweat(m, false, false); return m;
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
function walk(m, T, f = 4.5, amp = 0.38, arms = 0.4) { const s = Math.sin(T * f); m.leg('L', amp * s, 0.04, 0.3 * Math.max(0, s) * amp / 0.38); m.leg('R', -amp * s, 0.04, 0.3 * Math.max(0, -s) * amp / 0.38); m.arm('L', -arms * s, 0.1, 0, 0.3); m.arm('R', arms * s, 0.1, 0, 0.3); m.hips.position.y = 0.95 - 0.02 * Math.abs(Math.cos(T * f)); }
function clench(m, T) { m.leg('L', 0.05, -0.08, 0.15); m.leg('R', 0.05, -0.08, 0.15); m.hips.rotation.z = 0.03 * Math.sin(T * 30); }
let desperation = 0;   // 0..1 face/body getting more desperate over time
function youFace(T, o = {}) {
  const d = desperation; const m = YOU;
  m.setFace(Object.assign({ eyes: d < 0.3 ? 'normal' : d < 0.6 ? 'wide' : 'squint', brows: d < 0.2 ? 'normal' : 'worried', mouth: d < 0.3 ? 'flat' : d < 0.7 ? 'wavy' : 'tight' }, o));
  setBlushSweat(m, false, d > 0.25, T);
}
// street: YOU walks towards -z on the sidewalk at x = 2.2
const SX = 2.2;
function street(T, z, o = {}) {
  useSet('street', V(SX, 0, z)); STR.stretch.scale.set(1, 1, 1); STR.house.position.set(0.5, 0, -48);
  const m = put(YOU, SX, 0.14, z, PI); return m;
}

// ---------------------------------------------------------------- shots
const SH = {};
SH['01'] = (t, d, T, u) => {   // you need to poop: walking, stomach rumbles
  desperation = 0.1; const z = -T * 1.1; const m = street(T, z); walk(m, T);
  const r = T - w(3); if (r > -0.05) { const k = Math.exp(-Math.max(0, r) * 2.5); m.group.position.x += 0.015 * Math.sin(T * 60) * k; m.spine.rotation.z = 0.04 * Math.sin(T * 47) * k;
    ikArm(m, 'L', m.worldOf(m.spine, V(0.05, 0.12, 0.2)), [0.6, 0.1, 0, 1.2]); ikArm(m, 'R', m.worldOf(m.spine, V(-0.05, 0.1, 0.2)), [0.6, 0.1, 0, 1.2]); }
  youFace(T, r > 0 ? { eyes: 'wide', brows: 'up', mouth: 'wavy' } : { mouth: 'smile' });
  cam(V(SX + 0.35, 1.5, z - 1.9), V(SX, 1.2, z), 46); ANCH.belly = m.worldOf(m.spine, V(0, 0.12, 0.15));
};
SH['02'] = (t, d, T, u) => {   // five minutes from home: wide shot of the long road
  desperation = 0.15; const z = -1.8 - u * 0.5; const m = street(T, z); walk(m, T, 4.5, 0.3);
  youFace(T, { eyes: 'normal', brows: 'worried', mouth: 'flat' });
  cam(V(SX + 0.6, lerp(1.9, 2.1, u), z + 2.6), V(0.5, 1.6, -40), 48); ANCH.house = V(0.5, 3.0, -48);
};
SH['03'] = (t, d, T, u) => {   // walk faster
  desperation = 0.3; const z = -4.5 - u * 3.0; const m = street(T, z); walk(m, T, 13, 0.6, 1.1); m.spine.rotation.x = 0.12; youFace(T, { eyes: 'determined', brows: 'angry', mouth: 'tight' });
  const jz = z - 6 + u * 9; const j = put(JOG, 0.6, 0.14, jz, 0); walk(j, T, 11, 0.7, 1.0); j.setFace({ eyes: 'normal', mouth: 'smile' });
  cam(V(SX - 2.4, 1.05, z - 0.7), V(SX, 1.05, z - 0.2), 54);
};
SH['04'] = (t, d, T, u) => {   // too fast: close-up, sweating
  desperation = 0.5; const z = -8.0 - u * 0.4; const m = street(T, z); walk(m, T, 6, 0.2); clench(m, T); m.spine.rotation.x = 0.15;
  youFace(T, { eyes: 'wide', brows: 'worried', mouth: 'wavy' }); m.head.rotation.z = 0.04 * Math.sin(T * 40);
  const f = faceOf(m); cam(f.clone().add(V(0.15, 0.0, -lerp(0.75, 0.6, u))), f, 36); ANCH.you = f;
};
SH['05'] = (t, d, T, u) => {   // DANGER: frozen mid-step, clenching
  desperation = 0.7; const z = -8.5; const m = street(T, z); clench(m, T); m.leg('L', 0.25, -0.1, 0.4); m.spine.rotation.x = 0.25;
  ikArm(m, 'L', m.worldOf(m.spine, V(0.05, 0.12, 0.2)), [0.6, 0.1, 0, 1.2]); ikArm(m, 'R', m.worldOf(m.spine, V(-0.12, 0.0, -0.15)), [0.2, 0.3, 0, 0.8]);
  youFace(T, { eyes: 'squint', brows: 'worried', mouth: 'tight' }); m.group.position.x += 0.006 * Math.sin(T * 70);
  cam(V(SX + 0.9, 1.25, z - 1.9), V(SX, 1.05, z), 48);
};
SH['06'] = (t, d, T, u) => {   // walk slower: tiny steps
  desperation = 0.6; const z = -8.6 - u * 0.25; const m = street(T, z); clench(m, T); const s = Math.sin(T * 9);
  m.leg('L', 0.08 * s, -0.08, 0.1); m.leg('R', -0.08 * s, -0.08, 0.1); m.arm('L', 0.1, 0.3, 0, 0.5); m.arm('R', 0.1, 0.3, 0, 0.5); m.spine.rotation.x = 0.1;
  youFace(T, { eyes: 'squint', brows: 'worried', mouth: 'tight' });
  cam(V(SX - 1.0, 0.35, z - 0.7), V(SX, 0.4, z), 50);
};
SH['07'] = (t, d, T, u) => {   // taking forever: a snail passes you
  desperation = 0.65; const z = -8.9 - u * 0.15; const m = street(T, z); clench(m, T); const s = Math.sin(T * 9); m.leg('L', 0.06 * s, -0.08, 0.1); m.leg('R', -0.06 * s, -0.08, 0.1);
  youFace(T, { eyes: 'half', brows: 'worried', mouth: 'tight' });
  SNAIL.visible = true; SNAIL.scale.setScalar(2.2); SNAIL.position.set(SX - 0.45, 0.14, z + 0.55 - u * 1.3); SNAIL.rotation.y = PI / 2;
  const l = put(LADY, 0.3, 0.14, z - 3 + u * 2.4, 0); walk(l, T, 4, 0.3); l.setFace({ eyes: 'happy', mouth: 'smile' });
  DOG.g.visible = true; DOG.g.position.set(0.9, 0.14, z - 2.2 + u * 2.4); DOG.g.rotation.y = -PI / 2; DOG.legs.forEach((g, i) => g.rotation.z = 0.5 * Math.sin(T * 10 + i * PI)); DOG.tail.rotation.x = 0.5 * Math.sin(T * 14);
  const hp = handPt(l, 'R'); LEASH.visible = true; const dp = DOG.head.getWorldPosition(V(0, 0, 0)); LEASH.position.copy(hp).lerp(dp, 0.5); LEASH.quaternion.setFromUnitVectors(V(0, 1, 0), dp.clone().sub(hp).normalize()); LEASH.scale.y = hp.distanceTo(dp);
  cam(V(SX - 1.25, 0.32, z - 0.25), V(SX - 0.35, 0.3, z + 0.1), 52); ANCH.snail = SNAIL.position.clone().add(V(0, 0.3, 0));
};
SH['08'] = (t, d, T, u) => {   // you stop breathing: cheeks puffed, face red
  desperation = 0.8; const z = -9.1; const m = street(T, z); clench(m, T);
  const k = sstep(0, 0.6, u); SKIN.color.copy(SKIN0).lerp(new THREE.Color(0xff6a5a), 0.6 * k); cheeks.forEach(c => { c.visible = true; c.scale.setScalar(0.6 + 0.5 * k); });
  youFace(T, { eyes: 'squint', brows: 'worried', mouth: 'none' }); m.group.position.x += 0.004 * Math.sin(T * 60);
  const f = faceOf(m); cam(f.clone().add(V(0.05, 0.02, -lerp(0.6, 0.5, u))), f, 36); ANCH.you = f;
};
SH['09'] = (t, d, T, u) => {   // deals with God: looking up, hands together
  desperation = 0.8; const z = -9.2; const m = street(T, z); clench(m, T);
  m.head.rotation.x = -0.42; m.spine.rotation.x = -0.08; const c = m.worldOf(m.spine, V(0, 0.42, 0.3));
  ikArm(m, 'L', c.clone().add(V(0.0, 0, 0)), [1.3, 0.1, 0, 1.6]); ikArm(m, 'R', c.clone().add(V(0.0, 0, 0)), [1.3, 0.1, 0, 1.6]);
  youFace(T, { eyes: 'closed', brows: 'worried', mouth: T > w(29) ? 'open' : 'wavy' });
  cam(V(SX + 0.55, 1.55, z - 1.0), headPt(m, 0, 0.0, 0).add(V(0, 0.05, 0)), 46); HALO.visible = true; HALO.position.copy(headPt(m, 0, 1.8, 0)); HALO.lookAt(camPos());
};
SH['10'] = (t, d, T, u) => {   // every step: heavy slow steps, feet close-up
  desperation = 0.85; const z = -9.4 - u * 0.4; const m = street(T, z); const s = Math.sin(T * 2.5); m.leg('L', 0.3 * s, -0.04, 0.2 * Math.max(0, s)); m.leg('R', -0.3 * s, -0.04, 0.2 * Math.max(0, -s));
  youFace(T); cam(V(SX - 0.9, 0.3, z - 0.35), V(SX, 0.25, z), 46);
};
SH['11'] = (t, d, T, u) => {   // feels like a mile: the road stretches longer and longer
  desperation = 0.9; const z = -10; const m = street(T, z); const s = Math.sin(T * 3); m.leg('L', 0.25 * s, -0.04, 0.1); m.leg('R', -0.25 * s, -0.04, 0.1); youFace(T);
  const k = ease(u); STR.stretch.scale.set(1, 1, 1 + 2.5 * k); STR.stretch.position.z = z * -2.5 * k; STR.house.position.set(0.5, 0, lerp(-48, -150, k));
  cam(V(SX + 0.5, 1.9, z + 2.4), V(0.5, 1.6, lerp(-40, -120, k)), lerp(48, 30, k)); ANCH.house = STR.house.position.clone().add(V(0, 3, 0));
};
function porch(T, o = {}) { useSet('porch', PO.clone()); POR.door.rotation.y = 0; POR.mat.rotation.x = 0; POR.glow.material.color.setHex(0xfff1b8); const m = put(YOU, PO.x + (o.x ?? 0.1), 0.16, o.z ?? 1.05, PI); return m; }
SH['12'] = (t, d, T, u) => {   // you finally reach the door: golden light
  desperation = 0.75; const m = porch(T, { z: lerp(2.6, 1.15, ease(u)) }); walk(m, T, 6, 0.3); youFace(T, { eyes: 'happy', brows: 'up', mouth: 'open' });
  HALO.visible = true; HALO.position.set(PO.x, 1.4, 0.12); HALO.scale.setScalar(1.15 + 0.08 * Math.sin(T * 3)); HALO.lookAt(V(PO.x, 1.4, 5)); POR.glow.material.color.setHex(0xffe08a);
  cam(V(PO.x + 0.6, 1.45, lerp(4.4, 3.6, u)), V(PO.x, 1.35, 0), 50); ANCH.door = V(PO.x, 1.6, 0.1);
};
SH['13'] = (t, d, T, u) => {   // reach for your keys: hand into the pocket
  desperation = 0.8; const m = porch(T); youFace(T, { eyes: 'normal', brows: 'up', mouth: 'smile' }); clench(m, T);
  const k = sstep(w(44), w(47), T); const pk = m.worldOf(m.legs[1].th, V(-0.06, -0.06, 0.06));
  ikArm(m, 'R', pk.clone().add(V(0, 0.12 * (1 - k), 0.06 * (1 - k))), [0.2, 0.2, 0, 0.3]);
  cam(pk.clone().add(V(-0.55, 0.25, -0.45)), pk, 40);
};
SH['14'] = (t, d, T, u) => {   // they're not there: empty pocket, NOOO!
  desperation = 0.95; const m = porch(T); m.group.rotation.y = 0; clench(m, T); const pk = m.worldOf(m.legs[1].th, V(-0.06, -0.06, 0.06));
  LINING.visible = true; LINING.position.copy(pk.clone().add(V(0, 0.0, 0.03))); LINING.rotation.set(0.3, PI, 0);
  ikArm(m, 'R', pk.clone().add(V(-0.05, 0.05, 0.12)), [0.4, 0.2, 0, 0.6]); m.arm('L', 0.3, 0.5, 0, 0.4);
  youFace(T, T > w(49) - 0.05 ? { eyes: 'wide', brows: 'up', mouth: 'drop' } : { eyes: 'normal', brows: 'up', mouth: 'o' }); m.head.rotation.x = 0.35;
  const f = faceOf(m); cam(f.clone().add(V(0.25, -0.3, 1.1)), f.clone().lerp(pk, 0.5), 50); ANCH.pocket = pk;
};
SH['15'] = (t, d, T, u) => {   // other pocket
  desperation = 1; const m = porch(T); m.group.rotation.y = 0; clench(m, T); const pk = m.worldOf(m.legs[0].th, V(0.06, -0.06, 0.06));
  LINING.visible = true; LINING.position.copy(m.worldOf(m.legs[1].th, V(-0.06, -0.06, 0.09))); LINING.rotation.set(0.3, PI, 0);
  LINING2.visible = u > 0.4; LINING2.position.copy(pk.clone().add(V(0, 0, 0.03))); LINING2.rotation.set(0.3, PI, 0);
  ikArm(m, 'L', pk.clone().add(V(0.05, 0.05 + 0.04 * Math.sin(T * 30), 0.1)), [0.4, 0.2, 0, 0.6]); youFace(T, { eyes: 'wide', brows: 'worried', mouth: 'wavy' });
  cam(pk.clone().add(V(0.45, 0.45, 0.75)), pk.clone().add(V(-0.05, 0.25, 0)), 48);
};
SH['16'] = (t, d, T, u) => {   // backpack: rummaging, stuff flies out
  desperation = 1; const m = porch(T); m.group.rotation.y = 0; clench(m, T); m.backpack.position.set(0, 0.0, 0.45); m.backpack.rotation.set(-0.6, 0, 0);
  const bp = m.worldOf(m.backpack, V(0, 0.15, 0)); ikArm(m, 'R', bp.clone().add(V(0.02 * Math.sin(T * 25), 0.05, 0)), [1.0, 0.2, 0, 1.0]); ikArm(m, 'L', m.worldOf(m.backpack, V(0.15, 0.0, 0)), [0.9, 0.2, 0, 1.0]);
  STUFF.forEach((s, i) => { const k = (T - w(53) - i * 0.12); if (k < 0) return; s.visible = true; s.position.copy(bp).add(V((i - 2) * 0.35 * k, 2.6 * k - 4.9 * k * k, 0.4 * k)); s.rotation.set(k * 8 + i, k * 6, k * 5); });
  youFace(T, { eyes: 'wide', brows: 'worried', mouth: 'open' });
  const f = faceOf(m); cam(f.clone().add(V(0.35, 0.05, 1.35)), f.clone().add(V(0, -0.35, 0)), 52);
};
SH['17'] = (t, d, T, u) => {   // under the doormat
  desperation = 1; const m = porch(T, { z: 1.45 }); m.spine.rotation.x = 1.0; m.leg('L', 0.6, 0.1, 0.9); m.leg('R', 0.6, 0.1, 0.9); m.hips.position.y = 0.75;
  const k = sstep(w(55), w(56) + 0.1, T); POR.mat.rotation.x = -1.1 * k; ikArm(m, 'R', POR.mat.localToWorld(V(0.3, 0.02, 0.6)), [1.5, 0.2, 0, 0.3]); ikArm(m, 'L', POR.mat.localToWorld(V(-0.3, 0.02, 0.6)), [1.5, 0.2, 0, 0.3]);
  youFace(T, { eyes: 'wide', brows: 'worried', mouth: 'o' }); cam(V(PO.x + 1.2, 0.95, 1.55), V(PO.x, 0.3, 0.7), 50);
};
SH['18'] = (t, d, T, u) => {   // then... he looks down at his shoe
  desperation = 1; const m = porch(T); clench(m, T); m.head.rotation.x = 0.7; youFace(T, { eyes: 'normal', brows: 'up', mouth: 'o' });
  const sh = m.worldOf(m.legs[1].foot, V(0, 0.04, 0)); cam(sh.clone().add(V(-0.35, 0.25, -0.45)), sh, 40); ANCH.shoe = sh;
};
SH['19'] = (t, d, T, u) => {   // JINGLE: keys out of the shoe
  desperation = 0.6; const m = porch(T); m.group.rotation.y = 0; m.leg('R', 1.3, -0.05, 1.6); m.head.rotation.x = 0.5;
  const sh = m.worldOf(m.legs[1].foot, V(0, 0.05, 0.02)); const k = easeOut(sstep(w(58) - 0.05, w(58) + 0.3, T));
  KEYS.visible = true; KEYS.scale.setScalar(2.2); KEYS.position.copy(sh).add(V(0, 0.32 * k, 0.05)); KEYS.rotation.set(0, T * 3, 0.4 * Math.sin(T * 20));
  ikArm(m, 'R', KEYS.position.clone().add(V(0, 0.05, 0)), [1.0, 0.2, 0, 1.2]); youFace(T, { eyes: 'happy', brows: 'up', mouth: 'grin' });
  cam(KEYS.position.clone().add(V(0.25, 0.12, 0.7)), KEYS.position.clone().add(V(0, 0.0, 0)), 44); ANCH.keys = KEYS.position.clone();
};
SH['20'] = (t, d, T, u) => {   // you open the door: key in the lock
  desperation = 0.7; const m = porch(T, { x: 0.45, z: 0.6 }); const lp = POR.lockPos.clone();
  ikArm(m, 'R', lp.clone().add(V(0, -0.02, 0.12)), [1.4, 0.1, 0, 0.3]); KEYS.visible = true; KEYS.scale.setScalar(1.4); KEYS.position.copy(lp).add(V(0, -0.02, 0.06)); KEYS.rotation.set(PI / 2, 0, -1.2 * sstep(0.4, 0.9, u));
  youFace(T, { eyes: 'determined', brows: 'angry', mouth: 'tight' }); cam(lp.clone().add(V(0.35, 0.12, 0.42)), lp, 40); ANCH.lock = lp;
};
SH['21'] = (t, d, T, u) => {   // CLICK: the door swings open
  desperation = 0.7; const m = porch(T, { x: 0.15, z: 0.85 }); const k = easeOut(sstep(w(63) - 0.05, w(63) + 0.35, T)); POR.door.rotation.y = -1.6 * k;
  POR.glow.material.color.setHex(0xffffff); youFace(T, { eyes: 'wide', brows: 'up', mouth: 'grin' }); m.arm('R', 1.3, 0.2, 0, 0.2);
  cam(V(PO.x + 0.3, 1.5, 3.4), V(PO.x, 1.3, 0), 50);
};
function hall(T) { useSet('hall', HA.clone().add(V(0, 0, -1))); HAL.bdoor.rotation.y = 0; }
SH['22'] = (t, d, T, u) => {   // you run to the bathroom
  desperation = 0.9; hall(T); const z = lerp(3.8, -2.6, u); const m = put(YOU, HA.x, 0, z, PI); const s = Math.sin(T * 17);
  m.leg('L', 0.85 * s, 0.05, 0.6 * Math.max(0, s) + 0.2); m.leg('R', -0.85 * s, 0.05, 0.6 * Math.max(0, -s) + 0.2); m.arm('L', -0.9 * s, 0.15, 0, 1.3); m.arm('R', 0.9 * s, 0.15, 0, 1.3); m.spine.rotation.x = 0.35;
  youFace(T, { eyes: 'determined', brows: 'angry', mouth: 'grin' }); cam(V(HA.x + 0.35, 1.3, -4.1), V(HA.x, 1.15, z), lerp(40, 58, u));
};
SH['23'] = (t, d, T, u) => {   // it's locked: THUD into the door
  desperation = 1; hall(T); const k = T - (w(69) + 0.05); const z = k < 0 ? lerp(-2.4, -4.1, sstep(-0.3, 0, k)) : -4.05 + 0.05 * Math.exp(-k * 6);
  const m = put(YOU, HA.x, 0, z, PI); m.spine.rotation.x = k < 0 ? 0.3 : 0.05; if (k > 0) { m.root.scale.set(1.03, 0.98, 0.9); m.arm('L', 0.9, 0.6, 0, 0.6); m.arm('R', 0.9, 0.6, 0, 0.6); }
  youFace(T, k > 0 ? { eyes: 'closed', brows: 'worried', mouth: 'wavy' } : { eyes: 'determined', mouth: 'grin' });
  cam(V(HA.x + 0.95, 1.55, -2.7), V(HA.x, 1.3, -4.1), 50);
};
SH['24'] = (t, d, T, u) => {   // and from inside you hear...: slow zoom on the door
  desperation = 1; hall(T); const m = put(YOU, HA.x - 0.7, 0, -3.7, PI + 0.4); youFace(T, { eyes: 'wide', brows: 'worried', mouth: 'o' }); m.head.rotation.y = 0.3;
  cam(V(HA.x + 0.1, lerp(1.05, 0.75, u), lerp(-2.4, -3.3, ease(u))), V(HA.x, lerp(1.0, 0.5, u), -4.45), 46); ANCH.gap = HAL.gapPos.clone();
};
SH['25'] = (t, d, T, u) => {   // "just five more minutes, sweetie!": the speech bubble from under the door
  desperation = 1; hall(T); HAL.gap.material.color.setHex(0xfff6d0);
  cam(V(HA.x + 0.05, 0.42, lerp(-3.2, -3.35, u)), V(HA.x, 0.25, -4.45), 52); ANCH.gap = HAL.gapPos.clone();
};
SH['26'] = (t, d, T, u) => {   // his frozen face + "5 MORE MIN"
  desperation = 1; hall(T); const m = put(YOU, HA.x - 0.1, 0, -3.55, PI);
  SKIN.color.copy(SKIN0).lerp(new THREE.Color(0xd8dde6), 0.35); youFace(T, { eyes: 'blank', brows: 'worried', mouth: 'drop' });
  const f = faceOf(m); cam(f.clone().add(V(0.0, 0.03, -lerp(0.7, 0.55, ease(u)))), f, 36); ANCH.you = f;
};

// ---------------------------------------------------------------- frame
function resetWorld() {
  for (const m of PEOPLE) m.group.visible = false;
  [DOG.g, BIKE.g, SNAIL, KEYS, LEASH, LINING, LINING2, HALO, ...STUFF].forEach(o => o.visible = false);
  SKIN.color.copy(SKIN0); cheeks.forEach(c => c.visible = false); YOU.root.scale.setScalar(1); KEYS.scale.setScalar(1); SNAIL.scale.setScalar(1);
  YOU.backpack.position.set(0, 0.22, -0.17); YOU.backpack.rotation.set(0, 0, 0); HALO.scale.setScalar(1);
  STR.stretch.scale.set(1, 1, 1); STR.stretch.position.set(0, 0, 0); ANCH = {};
}
function project(p) { const c = p.clone().applyMatrix4(camera.matrixWorldInverse); if (c.z > -camera.near) return null; const n = p.clone().project(camera); return [+((n.x + 1) / 2).toFixed(4), +((1 - n.y) / 2).toFixed(4)]; }
let META = null;
window.init = (data) => { WT = data.words; };
window.renderShot = (id, t, d, T) => {
  resetWorld(); SH[id](t, d, T, clamp(t / d));
  renderer.render(scene, camera);
  const anchors = {}; for (const k in ANCH) anchors[k] = project(ANCH[k]);
  META = { id, T: +T.toFixed(3), anchors };
};
window.frameMeta = () => META;
window.ready = true;
