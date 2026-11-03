// The 40 shots of the Gardyloo reel as code-made low-poly 3D scenes (one entry per shot; shot 20 is black).
// Each shot: build(W) -> ctx (set + cast, once), update(W, ctx, lt) (poses at shot-local time lt, every frame),
// after(W, ctx, lt) (props that follow a solved body), cam(W, ctx, lt) -> {pos, target, fov, roll},
// anchors(W, ctx, lt) -> named 3D points for the 2D effects (stink lines, sweat...), still (0..1: which moment
// is the picture), clip (true: also rendered as a 30 fps clip).
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './sets.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const sitAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY }); };
const standAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);   // head-local point
const forehead = (ch, side = 0) => hl(ch, side * 0.03, 0.065, 0.08);
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40, roll = 0) => ({ pos: [...pos], target: [...target], fov, roll });
const P3 = (v) => [v.x, v.y, v.z];
// camera in front of a character's head: dist along its facing, dy up, dx to its left; aim at the head (+ty)
const headCam = (ch, dist, dy = 0, dx = 0, ty = 0, fov = 40) => {
  const h = ch.headPos(), f = fwd(ch.p.rotY), l = V(f.z, 0, -f.x);
  const p = h.clone().add(f.multiplyScalar(dist)).add(V(0, dy, 0)).add(l.multiplyScalar(dx));
  return camAt(P3(p), [h.x, h.y + ty, h.z], fov);
};
// world point relative to a character: f metres forward, l to its left, y absolute height
const rel = (ch, f, l, y) => { const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); return [ch.p.pos[0] + F.x * f + L.x * l, y, ch.p.pos[1] + F.z * f + L.z * l]; };
// world hand orientation as the Euler [x, y, z] (YXZ) solve() expects: fingers along Y, back of the hand along Z
const handRot = (Y, Z) => {
  const y = V(...Y).normalize(), x = V().crossVectors(y, V(...Z)).normalize(), z = V().crossVectors(x, y);
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z), 'YXZ'); return [e.x, e.y, e.z];
};
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mix3 = (a, b, k) => P3(V(...a).lerp(V(...b), k));
const camLerp = (a, b, k) => ({ pos: lerp3(a.pos, b.pos, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k) });

// ------------------------------------------------------------------ shared scenes
const BX = S.BATH.x0;                       // bathroom x
const BOWL = [BX + S.BATH.bowl[0], S.BATH.bowl[1]];
const BTN = [BOWL[0], 0.83, BOWL[1] - 0.3];  // chrome flush button (top)
const WIN = [BX + 1.2, 1.7, -0.25];          // bathroom window centre (right wall)
function bathroom(W, o = {}) {
  S.lights(W, { sky: 0xeef8f4, ground: 0x8a9a90, hemi: 0.75, key: 0xfff0dc, keyI: 0.9 });
  S.keyAt(W, [BX, 1, -0.3], { from: [1.5, 4, 2.5], size: 2.5 });
  W.lights.fill.position.set(BX - 0.2, 1.6, 0.9); W.lights.fill.intensity = 1.6;
  W.scene.background = new THREE.Color('#2a3430');
  const B = S.buildBathroom(W, o);
  const you = person(W, 'you');
  return { B, you };
}
const onToilet = (ch) => sitAt(ch, BOWL[0], BOWL[1] + 0.02, 0);
const DX = S.DIN.x0;
function dining(W) {
  S.lights(W, { sky: 0xffe2c0, ground: 0x6a4a30, hemi: 0.5, key: 0xffd8a8, keyI: 0.5, fill: 0xffc890, fillI: 1.2 });
  S.keyAt(W, [DX, 0.8, -0.5], { from: [1.5, 5, 2.5], size: 3 });
  W.lights.fill.position.set(DX - 1.2, 1.6, 1.8);
  W.scene.background = new THREE.Color('#1a120c');
  const D = S.buildDining(W);
  const dad = person(W, 'dadwet'), you = person(W, 'you'), gf = person(W, 'gf'), mom = person(W, 'mom'), bro = person(W, 'bro');
  const fk = S.fork(W.scene); const spoon = S.fork(W.scene, { spaghetti: true }); const bfork = S.fork(W.scene, { spaghetti: true });
  return { D, dad, you, gf, mom, bro, fk, spoon, bfork };
}
// the family at dinner (frozen: the freeze pose of shot 39)
function poseDinner(c, lt, { freeze = false } = {}) {
  const { dad, you, gf, mom, bro } = c, T = S.DIN.top;
  sitAt(dad, DX + S.DIN.dad[0], S.DIN.dad[1], 0); sitAt(you, DX + S.DIN.you[0], S.DIN.you[1], Math.PI / 2);
  sitAt(gf, DX + S.DIN.gf[0], S.DIN.gf[1], Math.PI / 2); sitAt(bro, DX + S.DIN.bro[0], S.DIN.bro[1], -Math.PI / 2);
  standAt(mom, DX + S.DIN.mom[0], S.DIN.mom[1], -Math.PI / 2 - 0.25);
  const youHead = you.headPos(), dadHead = dad.headPos();
  face(dad, 'open', 'angry', 'neutral', { lookAt: P3(youHead) });
  face(you, 'open', 'raised', 'tight', { lookAt: P3(dadHead), chestPuff: 0.3 });
  you.p.handL = [DX - 0.6, T + 0.02, S.DIN.you[1] + 0.12]; you.p.handR = [DX - 0.6, T + 0.02, S.DIN.you[1] - 0.18]; you.p.handPoseL = you.p.handPoseR = 'flat';
  face(gf, 'happy', 'raised', 'smile', { lookAt: P3(dadHead) });
  face(mom, 'happy', 'raised', 'smile');
  face(bro, 'open', 'raised', 'grin');
  // dad holds his fork with spaghetti frozen in the air
  c.fk.position.set(DX + 0.14, T + 0.42, S.DIN.dad[1] + 0.3); c.fk.rotation.set(0.3, 0, -0.15); dad.p.gripR = c.fk;
  dad.p.handL = [DX - 0.2, T + 0.02, S.DIN.dad[1] + 0.35]; dad.p.handPoseL = 'flat';
  // mom serves with the big spoon, the brother holds his fork in his fist
  c.spoon.position.set(DX + 0.35, T + 0.38, -0.05); c.spoon.rotation.set(0.0, 0, 0.6); mom.p.gripR = c.spoon;
  mom.p.handL = [DX + 0.62, 1.0, -0.6];
  c.bfork.position.set(DX + 0.5, T + 0.2, 0.55); c.bfork.rotation.set(0, 0, -0.1); bro.p.gripR = c.bfork; bro.p.handPoseL = 'flat';
  bro.p.handL = [DX + 0.5, T + 0.02, 0.3];
  if (freeze) {
    face(gf, 'open', 'worried', 'o', { lookAt: P3(youHead) });
    face(mom, 'wide', 'raised', 'o', { lookAt: P3(youHead) });
    c.spoon.position.set(DX + 0.5, T + 0.62, -0.25);
    face(bro, 'wide', 'raised', 'open', { lookAt: P3(youHead) });
    face(you, 'open', 'worried', 'tight', { lookAt: P3(dadHead), shoulderUp: 1, chestPuff: 0 });
  }
}
// outside: lights for the golden evening / the night
function outside(W, { night = false, ...o } = {}) {
  if (night) S.lights(W, { sky: 0x3a4a7a, ground: 0x1a2030, hemi: 0.35, key: 0x9ab0e0, keyI: 0.45, fill: 0xffd080, fillI: 0 });
  else S.lights(W, { sky: 0xffd8b0, ground: 0x6a7a4a, hemi: 0.75, key: 0xffc890, keyI: 2.2, fill: 0xffd6a8, fillI: 0 });
  S.keyAt(W, [1, 1, 4], { from: night ? [-6, 12, 10] : [9, 6, 12], size: 9 });
  S.skyDome(W, night ? 'night' : 'sunset');
  W.scene.fog = new THREE.Fog(night ? '#0a1024' : '#e8a888', 30, 90);
  return S.buildHouse(W, { night, ...o });
}
// YOU in the upstairs bathroom window, seen from outside (body inside the house box, head + shoulders out)
const inWindow = (you, lean = 0.42) => { standAt(you, 3.0, 2.72, 0); you.p.y = 3.0; you.p.lean = lean; };
// dad by his car in the driveway (the bundle lands on his left shoulder)
const DAD = [2.1, 5.3];
function dadOutside(W, c) {
  c.dad = person(W, 'dad');
  c.case = S.briefcase(W.scene);
  c.bundle = S.bundle(W.scene);
  c.smudge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0).scale(1.3, 0.35, 1.0), new THREE.MeshStandardMaterial({ color: '#6a3e1e', roughness: 0.9, flatShading: true }));
  W.scene.add(c.smudge);
  const ps = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 3), new THREE.MeshStandardMaterial({ color: '#e86a8a', flatShading: true }));
  c.dad.chest.add(ps); ps.position.set(-0.12, c.dad.torsoH * 0.72, c.dad.spec.chestD + 0.02); ps.rotation.x = Math.PI;
  return c;
}
function poseDadOutside(c, lt, { rotY = 0, at = DAD } = {}) {
  standAt(c.dad, at[0], at[1], rotY);
  face(c.dad, 'stare', 'angry', 'tight');
  c.dad.p.gripR = c.case; c.dad.p.handPoseL = 'fist';
  const F = fwd(rotY), L = V(F.z, 0, -F.x);
  c.case.position.set(at[0] - L.x * 0.27, 0.78, at[1] - L.z * 0.27); c.case.rotation.set(0, rotY + Math.PI / 2, 0);
  c.dad.p.handL = rel(c.dad, 0.06, 0.3, 0.86);
}
// bundle + smudge on the dad's left shoulder (after the solve)
function onShoulder(c) {
  const ch = c.dad, sw = ch.shoulderW, T = ch.torsoH;
  c.bundle.position.copy(ch._w(V(sw * 0.62, T * 1.0 + 0.07, -0.005), ch.chest));
  c.bundle.quaternion.copy(ch.chest.getWorldQuaternion(new THREE.Quaternion()));
  c.bundle.rotateY(0.5);
  c.smudge.position.copy(ch._w(V(sw * 0.9, T * 0.93, 0.05), ch.chest));
  c.smudge.quaternion.copy(ch.chest.getWorldQuaternion(new THREE.Quaternion())); c.smudge.rotateZ(-0.6);
}
const ED = S.OLD.x0;
function oldTown(W, { people = 8 } = {}) {
  S.lights(W, { sky: 0xfff0dc, ground: 0x8a7a60, hemi: 0.9, key: 0xfff0d0, keyI: 1.8 });
  S.keyAt(W, [ED, 2, -6], { from: [6, 12, 6], size: 14 });
  S.skyDome(W, 'sepia', [ED, 0, -20]);
  W.scene.fog = new THREE.Fog('#d8d0c0', 20, 70);
  const O = S.buildOldStreet(W);
  const crowd = [];
  for (let i = 0; i < people; i++) crowd.push(person(W, `old${i}`));
  return { O, crowd };
}
const flap = (ch, lt, k = 1) => { // arms up in panic, holding the hat
  const h = ch.headPos();
  ch.p.handL = rel(ch, 0.05, 0.12, h.y + 0.14 + 0.03 * Math.sin(lt * 20 * k)); ch.p.handPoseL = 'open';
  ch.p.handR = rel(ch, 0.25, -0.35, h.y - 0.1 + 0.15 * Math.sin(lt * 14 + k)); ch.p.handPoseR = 'open';
};

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 "You're at your girlfriend's house." porch, flowers, GF waving from the open door
  1: {
    build(W) { const H = outside(W, { doorOpen: 1, carDoor: 0 }); const you = person(W, 'you'), gf = person(W, 'gf'); const bq = S.bouquet(W.scene); return { H, you, gf, bq }; },
    update(W, c, lt) {
      standAt(c.you, -1.3, 4.3, Math.PI - 0.75); face(c.you, 'open', 'raised', 'smile', { chestPuff: 0.3, lookAt: [-1.3, 1.7, 3.2] });
      c.bq.position.set(-1.12, 1.12, 4.12); c.bq.rotation.set(-0.3, 0, 0.2);
      c.you.p.gripR = { prop: c.bq, which: 'R' }; c.you.p.gripL = { prop: c.bq, which: 'L' };
      standAt(c.gf, -1.25, 3.18, 0.15); face(c.gf, 'happy', 'raised', 'grin', { lean: 0.15 });
      c.gf.p.handR = [-1.75, 1.75 + 0.06 * Math.sin(lt * 9), 3.45]; c.gf.p.handPoseR = 'open';
    },
    cam: (W, c, lt) => camAt([0.1, 1.5, 9.4 - lt * 0.15], [-1.25, 2.05, 3.8], 44),
    anchors: (W, c) => ({ flowers: c.bq.localToWorld(V(0, 0.2, 0)) }),
    still: 0.55,
  },
  // 02 "For the first time." close-up: nervous stiff smile, flowers up near his chin
  2: {
    build(W) { const H = outside(W, { doorOpen: 1, carDoor: 0 }); const you = person(W, 'you'); const bq = S.bouquet(W.scene); const l = new THREE.PointLight(0xffc880, 4, 3, 2); l.position.set(-1.4, 1.7, 3.3); W.scene.add(l); return { H, you, bq }; },
    update(W, c) {
      standAt(c.you, -1.35, 4.3, Math.PI); face(c.you, 'open', 'raised', 'grimace', { chestPuff: 0.5, shoulderUp: 0.6 });
      c.bq.position.set(-1.33, 1.32, 4.0); c.bq.rotation.set(-0.15, 0, 0);
      c.you.p.gripR = { prop: c.bq, which: 'R' }; c.you.p.gripL = { prop: c.bq, which: 'L' };
    },
    cam: (W, c) => headCam(c.you, 0.95, -0.12, 0.08, -0.12, 38),
    anchors: (W, c) => ({ forehead: forehead(c.you, 0.6) }),
  },
  // 03 "You go to the bathroom." hallway: GF points at the bathroom door, YOU walks there with a thumbs-up
  3: {
    build(W) {
      S.lights(W, { hemi: 0.7, keyI: 0.6 }); S.keyAt(W, [60, 1, -2], { from: [1, 5, 2], size: 4 });
      W.scene.background = new THREE.Color('#2a2018');
      const H = S.buildHallway(W); const you = person(W, 'you'), gf = person(W, 'gf'); const bq = S.bouquet(W.scene); return { H, you, gf, bq };
    },
    update(W, c, lt) {
      const z = -1.2 - lt * 0.38;
      standAt(c.you, 59.92, z, Math.PI); c.you.p.walk = lt * 7.5; face(c.you, 'open', 'raised', 'smile');
      c.bq.position.set(59.92 + 0.12, 1.1, z - 0.3); c.bq.rotation.set(0.3, 0, 0.2); c.you.p.gripL = { prop: c.bq, which: 'L' };
      c.you.p.handR = rel(c.you, 0.32, -0.22, 1.32); c.you.p.handPoseR = 'thumb'; c.you.p.handRotR = handRot([0, 0, -1], [-1, 0, 0]);
      standAt(c.gf, 60.42, -4.25, Math.PI - 0.35); face(c.gf, 'happy', 'raised', 'grin');
      c.gf.p.handR = [60.82, 1.3, -3.55]; c.gf.p.handPoseR = 'point';
    },
    cam: () => camAt([59.86, 1.5, -6.6], [60.0, 1.12, -1.0], 50),
    still: 0.4, clip: true,
  },
  // 04 "You poop." on the toilet (fully dressed, chest up), eyes closed, relieved; dad's photo on the wall behind
  4: {
    build: (W) => bathroom(W),
    update(W, c) { onToilet(c.you); face(c.you, 'closed', 'raised', 'smile', { headPitch: 0.12, headRoll: 0.06 }); c.you.p.handL = [BOWL[0] + 0.15, 0.62, BOWL[1] + 0.28]; c.you.p.handR = [BOWL[0] - 0.15, 0.62, BOWL[1] + 0.28]; },
    cam: (W, c) => camAt([BOWL[0] + 0.05, 1.28, 0.42], [BOWL[0], 1.38, -1.0], 40),
    anchors: () => ({ bottom: V(BOWL[0], 0.5, BOWL[1] + 0.2) }),
  },
  // 05 "You flush." ECU: a finger pressing the chrome flush button
  5: {
    build: (W) => bathroom(W),
    update(W, c) {
      standAt(c.you, BOWL[0] + 0.42, BOWL[1] - 0.12, -Math.PI / 2 - 0.25); face(c.you, 'open', 'neutral', 'neutral', { lean: 0.6 });
      c.you.p.handR = [BTN[0] + 0.0, BTN[1] + 0.07, BTN[2] + 0.02]; c.you.p.handPoseR = 'point'; c.you.p.handRotR = handRot([-0.2, -1, -0.35], [0.3, 0, -1]);
    },
    cam: () => camAt([BTN[0] - 0.2, BTN[1] + 0.14, BTN[2] + 0.24], [BTN[0] + 0.02, BTN[1] + 0.03, BTN[2]], 42),
  },
  // 06 "Nothing." looking down into the clean bowl, the water perfectly still
  6: {
    build: (W) => bathroom(W),
    update(W, c) { standAt(c.you, BOWL[0] + 0.4, BOWL[1] + 0.8, 0); },
    cam: () => camAt([BOWL[0], 1.12, BOWL[1] + 0.32], [BOWL[0], 0.2, BOWL[1] - 0.02], 42),
  },
  // 07 "You flush again." the thumb presses the button hard, the tank shakes
  7: {
    build: (W) => bathroom(W),
    update(W, c, lt) {
      standAt(c.you, BOWL[0] - 0.4, BOWL[1] - 0.1, Math.PI / 2 + 0.25); face(c.you, 'squint', 'angry', 'grimace', { lean: 0.6 });
      c.you.p.handR = [BTN[0] + 0.01, BTN[1] + 0.04, BTN[2] + 0.05]; c.you.p.handPoseR = 'thumb'; c.you.p.handRotR = handRot([0.4, 0.1, -1], [0, 1, 0]);
      c.B.toilet.rotation.z = 0.01 * Math.sin(lt * 60);
    },
    cam: () => camAt([BTN[0] + 0.24, BTN[1] + 0.1, BTN[2] + 0.26], [BTN[0], BTN[1] + 0.03, BTN[2]], 42),
  },
  // 08 "Nothing." blank deadpan face looking down, seen from the toilet
  8: {
    build(W) { const c = bathroom(W); const l = new THREE.PointLight(0xfff0dc, 2.5, 2.5, 2); l.position.set(BOWL[0], 0.7, BOWL[1] + 0.2); W.scene.add(l); return c; },
    update(W, c) { standAt(c.you, BOWL[0], BOWL[1] + 0.62, Math.PI); face(c.you, 'squint', 'neutral', 'neutral', { headPitch: -0.45 }); },
    cam: (W, c) => { const h = c.you.headPos(); return camAt([h.x + 0.05, h.y - 0.55, h.z - 0.45], [h.x, h.y + 0.02, h.z], 48); },
    anchors: (W, c) => ({ temple: hl(c.you, 0.06, 0.04, 0.06) }),
  },
  // 09 KEY "The water is rising." side view of the bowl, the water climbing to the rim with bubbles
  9: {
    build(W) { const c = bathroom(W, { water: 0.2 }); c.bub = []; for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.004 + hash1(i) * 0.005, 6, 4), new THREE.MeshStandardMaterial({ color: '#e8f8ff', roughness: 0.1 })); W.scene.add(b); c.bub.push(b); } return c; },
    update(W, c, lt) {
      standAt(c.you, BOWL[0] + 0.8, BOWL[1] + 1.2, 0); const k = 0.15 + 0.8 * easeInOut(lt / 1.45);
      S.setWater(c.B, k);
      c.bub.forEach((b, i) => { const a = hash1(i * 3) * 6.28, r = 0.04 + hash1(i * 7) * 0.09; b.position.set(BOWL[0] + Math.cos(a) * r, c.B.water.position.y + 0.004 + 0.004 * Math.sin(lt * 12 + i), BOWL[1] + 0.02 + Math.sin(a) * r * 1.2); });
    },
    cam: (W, c, lt) => camAt([BOWL[0] + 0.32 - lt * 0.03, 0.62 - lt * 0.02, BOWL[1] + 0.38 - lt * 0.03], [BOWL[0], 0.36, BOWL[1]], 44),
    still: 0.75, clip: true,
  },
  // 10 "You panic." ECU: eyes wide, grimace, eyes darting
  10: {
    build: (W) => bathroom(W, { water: 0.95 }),
    update(W, c, lt) { standAt(c.you, BOWL[0] + 0.1, BOWL[1] + 0.75, Math.PI + 0.15); face(c.you, 'wide', 'worried', 'grimace', { pupils: [Math.sin(lt * 9) > 0 ? 0.9 : -0.9, -0.2], shoulderUp: 1 }); },
    cam: (W, c) => headCam(c.you, 0.42, 0.0, 0.0, -0.02, 38),
    anchors: (W, c) => ({ forehead: forehead(c.you, -0.7), forehead2: forehead(c.you, 0.7) }),
    still: 0.3,
  },
  // 11 "Then you see it." he slowly looks up, awe, a beam of golden light across his face
  11: {
    build(W) { const c = bathroom(W, { water: 0.95, golden: 1 }); const l = new THREE.PointLight(0xffc860, 5, 1.6, 2); l.position.set(BX + 0.75, 1.95, 0.1); W.scene.add(l); return c; },
    update(W, c, lt) { standAt(c.you, BX + 0.25, 0.1, Math.PI / 2 + 0.35); face(c.you, 'wide', 'raised', 'o', { lookAt: [WIN[0], WIN[1] + 0.25 * smooth(lt / 1.6), WIN[2]], headPitch: 0.1 }); },
    cam: (W, c) => { const h = c.you.headPos(); return camAt([h.x + 0.62, h.y - 0.12, h.z + 0.55], [h.x, h.y + 0.04, h.z], 42); },
    anchors: () => ({ light: V(...WIN) }),
    still: 0.7,
  },
  // 12 KEY "A window." the little window glowing with holy golden light, god-rays, the curtain floating
  12: {
    build: (W) => bathroom(W, { water: 0.95, golden: 0.45 }),
    update(W, c, lt) {
      standAt(c.you, BX - 0.9, 0.9, 0);
      if (c.B.curtain) { c.B.curtain.rotation.z = 0.12 * Math.sin(lt * 2.2); c.B.curtain.position.x = BX + 1.12 - 0.05 - 0.05 * Math.sin(lt * 2.2); }
      if (c.B.dust) c.B.dust.rotation.y = lt * 0.05;
    },
    cam: (W, c, lt) => camLerp(camAt([BX - 0.55, 1.25, 0.95], [WIN[0], WIN[1] + 0.02, WIN[2]], 44), camAt([BX - 0.15, 1.38, 0.72], [WIN[0], WIN[1] + 0.02, WIN[2]], 42), easeInOut(lt / 1.3)),
    anchors: () => ({ window: V(...WIN) }),
    still: 0.5, clip: true,
  },
  // 13 "You wrap it in toilet paper." ECU: two hands wrap a small bundle in white paper on the sink counter
  13: {
    build(W) { const c = bathroom(W, { water: 0.95 }); c.bn = S.bundle(W.scene, { bow: false }); c.roll = S.rollProp(W.scene); const pm = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.95, flatShading: true, side: THREE.DoubleSide }); c.strip = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.3), pm); W.scene.add(c.strip); return c; },
    update(W, c, lt) {
      const P = [BX + 0.62, 0.95, -0.72];
      standAt(c.you, BX + 0.62, -0.28, Math.PI); face(c.you, 'open', 'worried', 'tight');
      c.bn.position.set(...P); c.bn.rotation.set(0, lt * 1.5, 0.1 * Math.sin(lt * 6));
      c.roll.position.set(P[0] - 0.22, 0.94, P[2] - 0.05); c.roll.rotation.set(0, 0, Math.PI / 2 + lt * 2);
      c.strip.position.set(P[0] - 0.11, 0.955 + 0.02 * Math.sin(lt * 4), P[2]); c.strip.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + 0.2);
      c.you.p.handL = [P[0] - 0.08, P[1] + 0.06 + 0.02 * Math.sin(lt * 7), P[2] + 0.04]; c.you.p.handPoseL = 'relaxed'; c.you.p.handRotL = handRot([0.3, -0.5, -1], [-1, 0.6, 0.2]);
      c.you.p.handR = [P[0] + 0.08, P[1] + 0.06 + 0.02 * Math.sin(lt * 7 + 2), P[2] + 0.04]; c.you.p.handPoseR = 'relaxed'; c.you.p.handRotR = handRot([-0.3, -0.5, -1], [1, 0.6, 0.2]);
    },
    cam: () => camAt([BX + 0.6, 1.32, -0.42], [BX + 0.6, 0.95, -0.75], 42),
    still: 0.4,
  },
  // 14 "Like a little gift." YOU holds the bundle up in both palms like a precious gift
  14: {
    build(W) { const c = bathroom(W, { water: 0.95 }); c.bn = S.bundle(W.scene, { bow: false }); c.bn.userData.ball.material.emissive = new THREE.Color('#fff2c0'); c.bn.userData.ball.material.emissiveIntensity = 0.35; return c; },
    update(W, c, lt) {
      standAt(c.you, BX - 0.1, 0.3, 0.15); face(c.you, 'happy', 'raised', 'smile', { headPitch: -0.3 });
      const P = rel(c.you, 0.34, 0, 1.3 + 0.01 * Math.sin(lt * 3));
      c.bn.position.set(P[0], P[1] + 0.05, P[2]);
      c.you.p.handL = rel(c.you, 0.33, 0.05, P[1] - 0.02); c.you.p.handR = rel(c.you, 0.33, -0.05, P[1] - 0.02);
      c.you.p.handPoseL = c.you.p.handPoseR = 'open';
      const F = fwd(c.you.p.rotY);
      c.you.p.handRotL = handRot([F.x, 0.15, F.z], [0.15, -1, 0]); c.you.p.handRotR = handRot([F.x, 0.15, F.z], [-0.15, -1, 0]);
    },
    cam: (W, c) => headCam(c.you, 0.95, -0.3, 0.0, -0.22, 42),
    anchors: (W, c) => ({ bundle: c.bn.getWorldPosition(V()) }),
  },
  // 15 "You even add a bow." ECU: fingers tie a tiny pink bow on top, pinky up
  15: {
    build(W) { const c = bathroom(W, { water: 0.95 }); c.bn = S.bundle(W.scene, { bow: true }); return c; },
    update(W, c, lt) {
      const P = [BX + 0.62, 0.95, -0.72];
      standAt(c.you, BX + 0.62, -0.28, Math.PI); c.bn.position.set(...P); c.bn.rotation.set(0, 0.3, 0);
      const top = [P[0], P[1] + 0.06, P[2]];
      c.you.p.handL = [top[0] - 0.05, top[1] + 0.05, top[2] + 0.02]; c.you.p.handPoseL = 'pinky'; c.you.p.handRotL = handRot([0.6, -0.4, -0.5], [-0.3, 0.8, 0.3]);
      c.you.p.handR = [top[0] + 0.05, top[1] + 0.05 + 0.01 * Math.sin(lt * 9), top[2] + 0.02]; c.you.p.handPoseR = 'pinky'; c.you.p.handRotR = handRot([-0.6, -0.4, -0.5], [0.3, 0.8, 0.3]);
    },
    cam: () => camAt([BX + 0.8, 1.3, -0.28], [BX + 0.62, 0.98, -0.72], 40),
    anchors: (W, c) => ({ bundle: c.bn.getWorldPosition(V()) }),
  },
  // 16 "You open the window." from outside: YOU in the little window, bundle with the bow in one hand
  16: {
    build(W) { const H = outside(W, { bathOpen: 1 }); const you = person(W, 'you'); const bn = S.bundle(W.scene); return { H, you, bn }; },
    update(W, c, lt) {
      inWindow(c.you, 0.32); face(c.you, 'open', 'raised', 'smile', { headPitch: -0.05 });
      c.bn.position.set(3.18, 4.42, 3.42); c.you.p.handR = [3.18, 4.38, 3.36]; c.you.p.handPoseR = 'open'; c.you.p.handRotR = handRot([0, 0.2, 1], [0, -1, 0.2]);
      c.you.p.handL = [2.6, 4.3, 3.05]; c.you.p.handPoseL = 'flat';
      c.H.sash.rotation.y = -1.6 * smooth(0.6 + lt);
    },
    cam: () => camAt([3.5, 4.3, 5.0], [3.0, 4.5, 3.0], 36),
  },
  // 17 KEY "And you throw it." inside: the pitcher wind-up next to the open window... and the throw
  17: {
    build(W) { const c = bathroom(W, { water: 0.95, open: 1 }); c.bn = S.bundle(W.scene); return c; },
    update(W, c, lt) {
      const k = clamp(lt / 1.11), throwK = easeIn(clamp((k - 0.62) / 0.3));
      standAt(c.you, BX + 0.45, -0.2, Math.PI / 2); face(c.you, 'squint', 'angry', 'open', { lean: lerp(-0.25, 0.35, throwK), leanSide: lerp(0.15, -0.1, throwK), torsoYaw: lerp(0.9, -0.5, throwK) });
      const back = rel(c.you, -0.45, -0.25, 1.75), front = rel(c.you, 0.65, -0.05, 1.55);
      const hand = mix3(back, front, throwK);
      c.you.p.handR = hand; c.you.p.handPoseR = throwK > 0.85 ? 'open' : 'grip';
      c.you.p.handL = mix3(rel(c.you, 0.5, 0.25, 1.45), rel(c.you, -0.1, 0.35, 1.0), throwK); c.you.p.handPoseL = 'open';
      if (throwK < 0.85) c.bn.position.set(hand[0], hand[1] + 0.05, hand[2]);
      else { const q = (throwK - 0.85) / 0.15; c.bn.position.set(lerp(hand[0], WIN[0] + 0.6, q), hand[1] + 0.1 + q * 0.3, lerp(hand[2], WIN[2], q)); }
      c.bn.rotation.set(lt * 3, lt * 5, 0);
    },
    cam: (W, c, lt) => camAt([BX + 0.45, 1.3, 1.05 - lt * 0.08], [BX + 0.8, 1.45, -0.3], 52),
    still: 0.35, clip: true,
  },
  // 18 KEY "As far as you can." wide: the bundle flies in a big arc across the sunset sky
  18: {
    build(W) { const H = outside(W, { bathOpen: 1 }); const bn = S.bundle(W.scene, { s: 6 }); return { H, bn }; },
    update(W, c, lt) {
      const k = clamp(lt / 1.82);
      const p0 = V(3.0, 4.7, 3.3), p1 = V(8.5, 4, 9.0);
      const x = lerp(p0.x, p1.x, k), z = lerp(p0.z, p1.z, k), y = p0.y + k * 14 - k * k * 10;
      c.bn.position.set(x, y, z); c.bn.rotation.set(lt * 7, lt * 9, lt * 4);
    },
    cam: (W, c, lt) => camAt([9.0, 2.0, 14.5], [5.0, 8.0 + lt * 0.3, 5.0], 58),
    still: 0.6, clip: true,
  },
  // 19 "Then you hear it." YOU leans out of the window shading his eyes like a sailor, proud little smile
  19: {
    build(W) { const H = outside(W, { bathOpen: 1 }); const you = person(W, 'you'); return { H, you }; },
    update(W, c) {
      inWindow(c.you, 0.36); face(c.you, 'squint', 'raised', 'smile', { headPitch: 0.12, headYaw: 0.25 }); c.H.sash.rotation.y = -2.75;
      const h = c.you.headPos(); c.you.p.handL = [h.x + 0.1, h.y + 0.11, h.z + 0.13]; c.you.p.handPoseL = 'flat'; c.you.p.handRotL = handRot([-1, 0.05, 0.1], [0, 1, 0.2]);
      c.you.p.handR = [2.75, 4.22, 3.1]; c.you.p.handPoseR = 'flat';
    },
    cam: (W, c) => { const h = c.you.headPos(); return camAt([h.x - 0.5, h.y - 0.1, h.z + 1.2], [h.x, h.y - 0.04, h.z], 38); },
  },
  // 21 "You look down." POV straight down from the window: the dad far below, frozen next to his car
  21: {
    build(W) { const H = outside(W, { bathOpen: 1, carDoor: 1 }); return dadOutside(W, { H }); },
    update(W, c) { poseDadOutside(c, 0, { rotY: 0.2 }); c.dad.p.headYaw = 0.75; c.dad.p.headPitch = -0.35; },
    after: (W, c) => onShoulder(c),
    cam: () => camAt([3.0, 4.72, 2.92], [2.3, 0.0, 5.6], 52),
    anchors: (W, c) => ({ dad: c.dad.headPos() }),
  },
  // 22 "It's her dad." full body: frozen like a statue, briefcase, keys, the bundle with the bow on his shoulder
  22: {
    build(W) { const H = outside(W, { bathOpen: 1, carDoor: 1 }); return dadOutside(W, { H }); },
    update(W, c) { poseDadOutside(c, 0, { rotY: 0.05 }); },
    after: (W, c) => onShoulder(c),
    cam: () => camAt([0.9, 1.05, 8.6], [DAD[0] - 0.05, 1.02, DAD[1]], 40),
    anchors: (W, c) => ({ shoulder: c.bundle.getWorldPosition(V()) }),
  },
  // 23 "It's on his shoulder. His best suit." ECU of the pinstripe shoulder: the bundle + one small cartoon smudge
  23: {
    build(W) { const H = outside(W, { bathOpen: 1, carDoor: 1 }); return dadOutside(W, { H }); },
    update(W, c) { poseDadOutside(c, 0, { rotY: 0.05 }); },
    after: (W, c) => onShoulder(c),
    cam: (W, c) => { const p = c.bundle.getWorldPosition(V()); return camAt([p.x + 0.34, p.y + 0.06, p.z + 0.34], [p.x - 0.01, p.y - 0.05, p.z + 0.02], 40); },
    anchors: (W, c) => ({ smudge: c.smudge.getWorldPosition(V()) }),
  },
  // 24 KEY "He slowly looks up." low angle from the wall: the dad lifts his head and stares straight up at YOU
  24: {
    build(W) { const H = outside(W, { bathOpen: 1, carDoor: 1 }); const l = new THREE.PointLight(0xffd0a0, 6, 3, 2); l.position.set(2.6, 1.6, 3.7); W.scene.add(l); return dadOutside(W, { H }); },
    update(W, c, lt) {
      poseDadOutside(c, lt, { rotY: Math.PI - 0.12, at: [2.4, 4.75] });
      const k = easeInOut(clamp((lt - 0.1) / 1.2));
      c.dad.p.headPitch = lerp(-0.25, 0.55, k); c.dad.p.lean = lerp(0, -0.12, k);
      face(c.dad, k > 0.6 ? 'stare' : 'open', k > 0.5 ? 'skeptic' : 'angry', 'tight');
    },
    after: (W, c) => onShoulder(c),
    cam: (W, c, lt) => { const h = c.dad.headPos(); return camAt([h.x + 0.15, 1.3, h.z - 0.8], [h.x, h.y + 0.02, h.z], 46); },
    anchors: (W, c) => ({ shoulder: c.bundle.getWorldPosition(V()) }),
    still: 0.85, clip: true,
  },
  // 25 "You duck." YOU on the floor under the window, back flat to the wall, eyes huge, hands over his mouth
  25: {
    build: (W) => bathroom(W, { water: 0.95, open: 1 }),
    update(W, c) {
      sitAt(c.you, BX + 1.0, -0.22, -Math.PI / 2); c.you.p.y = -0.36; face(c.you, 'wide', 'worried', 'neutral', { shoulderUp: 1 });
      const m = c.you.mouthPos();
      c.you.p.handL = [m.x - 0.05, m.y - 0.02, m.z + 0.035]; c.you.p.handR = [m.x - 0.065, m.y - 0.01, m.z - 0.035];
      c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
      c.you.p.handRotL = handRot([0, 0.25, -1], [-1, 0, 0]); c.you.p.handRotR = handRot([0, 0.25, 1], [-1, 0, 0]);
    },
    cam: () => camAt([BX - 0.45, 0.95, 0.5], [BX + 0.9, 1.05, -0.25], 50),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 26 "What you don't know: hundreds of years ago in Edinburgh," old film: the steep street, the castle on top
  26: {
    build: (W) => oldTown(W, { people: 9 }),
    update(W, c, lt) {
      c.crowd.forEach((ch, i) => {
        const z = 1.5 - i * 1.6 - hash1(i * 3) * 0.8, x = ED + (hash1(i * 5) - 0.5) * 2.6, dir = hash1(i * 9) > 0.5 ? Math.PI : 0;
        standAt(ch, x, z + (dir ? -1 : 1) * lt * 0.4, dir); ch.p.y = S.streetY(z); ch.p.walk = lt * 6 + i; face(ch, 'open', 'neutral', hash1(i) > 0.5 ? 'smile' : 'neutral');
      });
    },
    cam: () => camAt([ED + 0.4, 1.7, 5.5], [ED - 0.1, 6.5, -30], 50),
  },
  // 27 "people threw their poop out the window" the bonnet woman tips her wooden bucket out of the window
  27: {
    build(W) { const c = oldTown(W, { people: 4 }); c.w = person(W, 'bonnet'); c.bk = S.bucket(W.scene); return c; },
    update(W, c, lt) {
      const [wx, wy, wz] = S.OLD.win;
      standAt(c.w, ED + wx - 0.42, wz, Math.PI / 2); c.w.p.y = wy - 0.45 - 1.02; c.w.p.lean = 0.35; face(c.w, 'happy', 'raised', 'smile');
      const tip = smooth(clamp(lt / 1.2));
      c.bk.position.set(ED + wx + 0.38, wy + 0.08, wz); c.bk.rotation.set(0, 0, -0.4 - tip * 1.4);
      c.w.p.gripL = { prop: c.bk, which: 'L' }; c.w.p.gripR = { prop: c.bk, which: 'R' };
      c.crowd.forEach((ch, i) => { standAt(ch, ED + 0.8 - i * 0.5, -1.5 - i * 1.7, Math.PI); ch.p.y = S.streetY(-1.5 - i * 1.7); ch.p.walk = lt * 6 + i; });
    },
    cam: () => camAt([ED - 0.25, 3.95, -1.55], [ED - 2.3, 4.3, -3.0], 46),
    still: 0.5,
  },
  // 28 "and shouted "Gardyloo!"" close-up: the woman cups a hand beside her mouth and shouts
  28: {
    build(W) { const c = oldTown(W, { people: 2 }); c.w = person(W, 'bonnet'); c.bk = S.bucket(W.scene); return c; },
    update(W, c) {
      const [wx, wy, wz] = S.OLD.win;
      standAt(c.w, ED + wx - 0.42, wz, Math.PI / 2 + 0.2); c.w.p.y = wy - 0.45 - 1.02; c.w.p.lean = 0.3; face(c.w, 'squint', 'raised', 'yell', { headPitch: 0.05 });
      const m = c.w.mouthPos(); c.w.p.handL = [m.x + 0.03, m.y + 0.01, m.z - 0.085]; c.w.p.handPoseL = 'relaxed'; c.w.p.handRotL = handRot([0, 1, -0.3], [-0.2, 0, -1]);
      c.bk.position.set(ED - 5, -5, 0); c.w.p.handR = [ED + wx + 0.1, wy - 0.4, wz + 0.3]; c.w.p.handPoseR = 'flat';
      c.crowd.forEach((ch, i) => { standAt(ch, ED + 1 - i, -6 - i * 2, Math.PI); ch.p.y = S.streetY(-6 - i * 2); });
    },
    cam: (W, c) => { const h = c.w.headPos(); return camAt([h.x + 0.95, h.y - 0.28, h.z + 0.32], [h.x, h.y - 0.03, h.z], 40); },
  },
  // 29 "to warn the people below." the street below: everyone runs in all directions, holding their hats; a chicken
  29: {
    build(W) { const c = oldTown(W, { people: 9 }); c.ck = S.chicken(W.scene, ED + 0.6, 0, -1.4, 0.6); return c; },
    update(W, c, lt) {
      c.crowd.forEach((ch, i) => {
        const a = hash1(i * 11) * Math.PI * 2, sp = 1.6 + hash1(i * 4) * 1.2;
        const x0 = ED + (hash1(i * 5) - 0.5) * 3.0, z0 = -0.5 - hash1(i * 7) * 5.5;
        const x = clamp(x0 + Math.sin(a) * sp * lt, ED - 2.1, ED + 2.1), z = z0 + Math.cos(a) * sp * lt;
        standAt(ch, x, z, a); ch.p.y = S.streetY(z) + (i === 3 ? 0.35 * Math.max(0, Math.sin(lt * 4.5)) : 0);
        ch.p.walk = lt * 15 + i; ch.p.lean = 0.25; face(ch, 'wide', 'worried', 'yell'); flap(ch, lt, i);
      });
      c.ck.position.y = S.streetY(-1.4) + 0.15 * Math.abs(Math.sin(lt * 9)); c.ck.position.x = ED + 0.6 + lt * 0.5;
      c.ck.userData.wings.forEach((w, k) => { w.rotation.z = (k ? 1 : -1) * (0.3 + 0.9 * Math.abs(Math.sin(lt * 22))); });
    },
    cam: (W, c, lt) => camAt([ED + 0.4, 2.7, 2.4], [ED, 0.6, -3.0], 56),
    still: 0.35, clip: true,
  },
  // 30 "You didn't shout anything." YOU on the bathroom floor, guilty: eyes sliding to the side, lips pressed
  30: {
    build: (W) => bathroom(W, { water: 0.95, open: 1 }),
    update(W, c) { sitAt(c.you, BX + 1.0, -0.22, -Math.PI / 2); c.you.p.y = -0.36; face(c.you, 'open', 'raised', 'tight', { pupils: [0.9, 0.1], headYaw: -0.15, shoulderUp: 0.6 }); },
    cam: (W, c) => headCam(c.you, 0.62, -0.05, 0.12, -0.03, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you, 0.5) }),
  },
  // 31 "Dinner time. Her dad sits across from you." wide: the whole family at the table, the dad staring
  31: {
    build: (W) => dining(W),
    update(W, c, lt) { poseDinner(c, lt); helpers.talk(c.mom, lt, 0.5); },
    cam: () => camAt([DX + 0.4, 1.65, 3.05], [DX - 0.22, 0.95, -1.2], 54),
  },
  // 32 "His hair is still wet." close-up: soaking-wet messy hair, a big drop falling, towel round his neck
  32: {
    build(W) { const c = dining(W); c.drop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5).scale(1, 1.4, 1), new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, metalness: 0.2 })); W.scene.add(c.drop); return c; },
    update(W, c) { poseDinner(c, 0); c.dad.p.lookAt = null; c.dad.p.headYaw = 0; face(c.dad, 'open', 'angry', 'neutral'); },
    after(W, c, lt) { const p = hl(c.dad, 0.035, 0.07, 0.09); c.drop.position.set(p.x, p.y - Math.min(0.12, 0.5 * Math.pow(Math.max(0, lt - 0.45), 2) * 4), p.z + 0.01); },
    cam: (W, c) => headCam(c.dad, 0.62, 0.02, 0.0, 0.03, 40),
    anchors: (W, c) => ({ drip: hl(c.dad, 0.035, 0.07, 0.09) }),
  },
  // 33 KEY "He says: "Strange thing happened today."" slow push-in on the dad, one eyebrow climbing up
  33: {
    build: (W) => dining(W),
    update(W, c, lt) { poseDinner(c, lt); c.dad.p.lookAt = null; c.dad.p.headYaw = -0.25; face(c.dad, 'open', lt > 1.1 ? 'skeptic' : 'angry', 'neutral'); if (lt > 0.95 && lt < 2.6) helpers.talk(c.dad, lt, 0.6); },
    cam: (W, c, lt) => { const h = c.dad.headPos(); const a = camAt([DX - 0.7, 1.28, -0.35], [h.x, h.y - 0.08, h.z], 42), b = camAt([DX - 0.4, 1.36, -0.9], [h.x, h.y - 0.02, h.z], 40); return camLerp(a, b, lt / 3.1); },
    still: 0.6, clip: true,
  },
  // 34 "He stares at you." ECU: the dad's eyes, one eyebrow up, drops in his wet eyebrows
  34: {
    build(W) { const c = dining(W); c.drops = []; for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 5, 4), new THREE.MeshStandardMaterial({ color: '#d8f0ff', roughness: 0.05 })); W.scene.add(d); c.drops.push(d); } return c; },
    update(W, c) { poseDinner(c, 0); c.dad.p.lookAt = null; c.dad.p.headYaw = 0; face(c.dad, 'open', 'skeptic', 'neutral', { pupils: [0, 0] }); },
    after(W, c) { c.drops.forEach((d, i) => d.position.copy(hl(c.dad, -0.045 + i * 0.03, 0.03 + (i % 2) * 0.004, 0.092))); },
    cam: (W, c) => { const e = hl(c.dad, 0, 0.012, 0.09); const p = hl(c.dad, 0, 0.012, 0.33); return camAt(P3(p), P3(e), 34); },
  },
  // 35 "You stare back." ECU: YOU's eyes, wide and nervous, trying to look brave
  35: {
    build: (W) => dining(W),
    update(W, c) { poseDinner(c, 0); face(c.you, 'stare', 'worried', 'tight'); },
    cam: (W, c) => { const e = hl(c.you, 0, 0.012, 0.09); const p = hl(c.you, 0, 0.012, 0.33); return camAt(P3(p), P3(e), 34); },
    anchors: (W, c) => ({ forehead: forehead(c.you, 0.5) }),
  },
  // 36 ECU: one eye and the thick mustache, a fly sitting on it, the dad does not move
  36: {
    build(W) { const c = dining(W); c.fly = S.fly3d(W.scene); c.fly.scale.setScalar(1.6); return c; },
    update(W, c) { poseDinner(c, 0); c.dad.p.lookAt = null; c.dad.p.headYaw = 0; face(c.dad, 'open', 'angry', 'neutral'); },
    after(W, c) { c.fly.position.copy(hl(c.dad, 0.022, -0.026, 0.115)); c.fly.rotation.set(0, 0.6, 0.15); },
    cam: (W, c) => { const e = hl(c.dad, 0.012, -0.012, 0.09); const p = hl(c.dad, 0.06, -0.01, 0.3); return camAt(P3(p), P3(e), 36); },
    anchors: (W, c) => ({ fly: hl(c.dad, 0.022, -0.026, 0.115) }),
  },
  // 37 the round wall clock, the red second hand ticking in the awkward pause
  37: {
    build: (W) => dining(W),
    update(W, c, lt) { poseDinner(c, 0); c.D.clock.userData.set(17 + (lt >= 0.08 ? 1 : 0) + (lt >= 0.72 ? 1 : 0)); },
    cam: () => { const k = S.DIN.clock; return camAt([DX + k[0] + 0.05, k[1] - 0.04, k[2] + 0.95], [DX + k[0], k[1], k[2]], 40); },
    still: 0.5, clip: true,
  },
  // 38 "…Gardyloo?" ECU: YOU leans in, lips pursed to whisper, eyes up at the dad
  38: {
    build: (W) => dining(W),
    update(W, c, lt) { poseDinner(c, 0); c.you.p.lean = 0.2; face(c.you, 'open', 'worried', 'o', { pupils: [0.4, 0.8] }); },
    cam: (W, c) => { const m = c.you.mouthPos(), p = hl(c.you, 0.05, -0.1, 0.4); return camAt(P3(p), [m.x, m.y + 0.03, m.z], 38); },
    anchors: (W, c) => ({ lip: hl(c.you, -0.03, -0.04, 0.09) }),
  },
  // 39 the whole family frozen: mom's spoon in the air, spaghetti hanging from the brother's mouth, all eyes on YOU
  39: {
    build(W) { const c = dining(W); const sm = new THREE.MeshStandardMaterial({ color: '#f0cc6a', roughness: 0.7, flatShading: true }); c.noodles = []; for (let i = 0; i < 3; i++) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 4).translate(0, -0.08, 0), sm); W.scene.add(n); c.noodles.push(n); } return c; },
    update(W, c) { poseDinner(c, 0, { freeze: true }); },
    after(W, c) { const m = c.bro.mouthPos(); c.noodles.forEach((n, i) => { n.position.set(m.x - 0.01, m.y + 0.005, m.z + (i - 1) * 0.008); n.rotation.set(0, 0, 0.1 * (i - 1)); }); },
    cam: () => camAt([DX + 2.15, 1.72, 2.55], [DX - 0.15, 0.95, -0.6], 52),
    anchors: (W, c) => ({ you: forehead(c.you) }),
  },
  // 40 the house at night, everything dark except the little bathroom window glowing warm yellow
  40: {
    build: (W) => outside(W, { night: true, bathGlow: true, carDoor: 0 }),
    update() {},
    cam: () => camAt([1.0, 1.75, 21.0], [1.4, 4.0, 2.0], 50),
    anchors: () => ({ window: V(3.0, 4.95, 3.0) }),
  },
};
