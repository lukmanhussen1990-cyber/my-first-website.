// The 38 shots of the plumber reel as code-made low-poly 3D scenes (one entry per shot).
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
const BX = S.PB.x0;                                   // bathroom x
const TL = [BX + S.PB.toilet[0], S.PB.toilet[1]];     // toilet (bowl centre x, z)
const BOWL = [TL[0], 0.36, TL[1] + 0.02];             // inside the bowl (censor block anchor)
const BTN = [TL[0], 0.83, TL[1] - 0.3];               // chrome flush button
function bath(W, o = {}) {
  S.lights(W, { sky: 0xfff6e0, ground: 0x9a8a70, hemi: 0.7, key: 0xfff0dc, keyI: 0.8 });
  S.keyAt(W, [BX, 1, -0.3], { from: [1.5, 4, 2.5], size: 2.5 });
  W.lights.fill.position.set(BX + 0.2, 1.6, 1.0); W.lights.fill.intensity = 1.5;
  W.scene.background = new THREE.Color('#2a2620');
  const B = S.buildPlumberBath(W, o);
  return { B };
}
const HX = 60;                                         // hallway x
function hall(W, o = {}) {
  S.lights(W, { sky: 0xfff0dc, ground: 0x8a6a4a, hemi: 0.7, key: 0xffe0b8, keyI: 0.6 });
  S.keyAt(W, [HX, 1, -2], { from: [1, 5, 3], size: 5 });
  W.lights.fill.position.set(HX, 1.6, 0); W.lights.fill.intensity = 1.2;
  W.scene.background = new THREE.Color('#2a2018');
  return { H: S.buildPlumberHall(W, o) };
}
function outside(W, o = {}) {
  S.lights(W, { sky: 0xffd8b0, ground: 0x6a7a4a, hemi: 0.75, key: 0xffc890, keyI: 2.2, fill: 0xffd6a8, fillI: 0 });
  S.keyAt(W, [1, 1, 8], { from: [9, 6, 12], size: 12 });
  S.skyDome(W, 'sunset');
  W.scene.fog = new THREE.Fog('#e8a888', 30, 90);
  return { H: S.buildHouse(W, { wall: '#a8c8e8', doorCol: '#2f8a4a', vehicle: 'van', carDoor: 0, ...o }) };
}
const MX = S.MUS.x0, CASE = S.MUS.case;
function museum(W) {
  S.lights(W, { sky: 0xfff0dc, ground: 0x9a8a74, hemi: 0.45, key: 0xfff0d8, keyI: 0.5 });
  S.keyAt(W, [MX, 1, -4], { from: [3, 8, 6], size: 8 });
  W.scene.background = new THREE.Color('#2a2420');
  return { Mu: S.buildMuseum(W) };
}
const KX = S.KIT.x0;
function kitchen(W) {
  S.lights(W, { sky: 0xfff6e8, ground: 0x9a7a60, hemi: 0.8, key: 0xfff0dc, keyI: 1.0 });
  S.keyAt(W, [KX, 1, -0.5], { from: [2, 5, 3], size: 3 });
  W.scene.background = new THREE.Color('#2a2420');
  return { K: S.buildKitchen(W) };
}
// arms crossed over the chest
const armsCrossed = (ch) => {
  const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x), c = ch.chestPos();
  const at = (f, l, dy) => [c.x + F.x * f + L.x * l, c.y + dy, c.z + F.z * f + L.z * l];
  ch.p.handR = at(0.16, 0.13, -0.1); ch.p.handL = at(0.2, -0.13, -0.06);
  ch.p.handPoseL = ch.p.handPoseR = 'flat';
  ch.p.handRotR = handRot([L.x, 0.1, L.z], [F.x, 0.3, F.z]); ch.p.handRotL = handRot([-L.x, 0.1, -L.z], [F.x, 0.3, F.z]);
};
// clapping: hands meet in front of the chest every 1/rate s
const clap = (ch, lt, rate = 2, ph = 0) => {
  const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x), c = ch.chestPos();
  const k = Math.pow(Math.abs(Math.cos(Math.PI * (lt * rate + ph))), 3), w = 0.02 + 0.1 * (1 - k);
  ch.p.handL = [c.x + F.x * 0.28 + L.x * w, c.y + 0.02, c.z + F.z * 0.28 + L.z * w];
  ch.p.handR = [c.x + F.x * 0.28 - L.x * w, c.y + 0.02, c.z + F.z * 0.28 - L.z * w];
  ch.p.handPoseL = ch.p.handPoseR = 'flat';
  ch.p.handRotL = handRot([F.x, 0.6, F.z], [L.x, 0, L.z]); ch.p.handRotR = handRot([F.x, 0.6, F.z], [-L.x, 0, -L.z]);
};
const youSitting = (you) => { onToilet(you); };
const onToilet = (ch) => sitAt(ch, TL[0], TL[1] + 0.02, 0);
const bowlAnchor = () => ({ bowl: V(BOWL[0], 0.62, BOWL[2]) });

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 KEY "You just shit so hard" ECU: straining on the toilet, red face, eyes squeezed, the light flickers
  1: {
    build(W) { const c = bath(W, { poo: false }); c.you = person(W, 'you', { skin: '#d8604c' }); return c; },
    update(W, c, lt) {
      onToilet(c.you); face(c.you, 'closed', 'angry', 'grimace', { chestPuff: 0.6, shoulderUp: 1, lean: 0.12, headPitch: -0.05 });
      c.you.p.handL = [TL[0] + 0.2, 0.62, TL[1] + 0.3]; c.you.p.handR = [TL[0] - 0.2, 0.62, TL[1] + 0.3]; c.you.p.handPoseL = c.you.p.handPoseR = 'fist';
      const fl = [0.3, 0.42, 0.9, 1.35, 1.42].some((e) => lt >= e && lt < e + 0.07);
      c.B.setLamp(fl ? 0.15 : 1);
    },
    cam: (W, c) => headCam(c.you, 0.5, -0.04, 0.02, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
    still: 0.6, clip: true,
  },
  // 02 "at your friend's house…" the duck picture shakes and falls off the wall
  2: {
    build: (W) => bath(W, { poo: false }),
    update(W, c, lt) {
      const P = c.B.picture, fall = clamp((lt - 0.55) / 0.5);
      P.rotation.set(0, Math.PI / 2, 0.06 * Math.sin(lt * 40) * (1 - fall) + fall * 1.2);
      P.position.set(-1.27 + fall * 0.12, 1.6 - easeIn(fall) * 1.38, 0.35 + fall * 0.05);
    },
    cam: () => camAt([BX - 0.15, 1.25, 0.55], [BX - 1.27, 1.15, 0.35], 52),
    still: 0.6, clip: true,
  },
  // 03 "it doesn't fit." straight down into the bowl (the censor block goes on top)
  3: {
    build: (W) => bath(W),
    update() {},
    cam: () => camAt([TL[0] + 0.02, 1.22, TL[1] + 0.85], [TL[0], 0.4, TL[1] + 0.02], 44),
    anchors: bowlAnchor,
  },
  // 04 "You flush." ECU: a finger presses the chrome flush button
  4: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c) {
      standAt(c.you, TL[0] + 0.42, TL[1] - 0.12, -Math.PI / 2 - 0.25); face(c.you, 'open', 'neutral', 'neutral', { lean: 0.6 });
      c.you.p.handR = [BTN[0], BTN[1] + 0.07, BTN[2] + 0.02]; c.you.p.handPoseR = 'point'; c.you.p.handRotR = handRot([-0.2, -1, -0.35], [0.3, 0, -1]);
    },
    cam: () => camAt([BTN[0] - 0.2, BTN[1] + 0.14, BTN[2] + 0.24], [BTN[0] + 0.02, BTN[1] + 0.03, BTN[2]], 42),
  },
  // 05 "Nothing." the water swirls round and round (the censor block does not move)
  5: {
    build: (W) => bath(W, { water: 0.3 }),
    update(W, c, lt) { c.B.toilet.water.rotation.y = -lt * 7 * Math.max(0.15, 1 - lt / 1.2); },
    cam: () => camAt([TL[0] + 0.32, 1.1, TL[1] + 0.85], [TL[0], 0.4, TL[1]], 46),
    anchors: bowlAnchor,
    still: 0.3, clip: true,
  },
  // 06 "You flush again." the thumb presses the button hard
  6: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      standAt(c.you, TL[0] - 0.4, TL[1] - 0.1, Math.PI / 2 + 0.25); face(c.you, 'squint', 'angry', 'grimace', { lean: 0.6 });
      c.you.p.handR = [BTN[0] + 0.01, BTN[1] + 0.04, BTN[2] + 0.05]; c.you.p.handPoseR = 'thumb'; c.you.p.handRotR = handRot([0.4, 0.1, -1], [0, 1, 0]);
      c.B.toilet.group.rotation.z = 0.01 * Math.sin(lt * 60);
    },
    cam: () => camAt([BTN[0] + 0.24, BTN[1] + 0.1, BTN[2] + 0.26], [BTN[0], BTN[1] + 0.03, BTN[2]], 42),
  },
  // 07 "It doesn't even move." the bowl again, lower angle, a few sad bubbles
  7: {
    build(W) { const c = bath(W, { water: 0.3 }); c.bub = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.006 + hash1(i) * 0.005, 6, 4), new THREE.MeshStandardMaterial({ color: '#e8f8ff', roughness: 0.1 })); W.scene.add(b); c.bub.push(b); } return c; },
    update(W, c, lt) { c.bub.forEach((b, i) => { const a = hash1(i * 3) * 6.28, r = 0.03 + hash1(i * 7) * 0.08; b.position.set(TL[0] + Math.cos(a) * r, 0.26 + 0.004 * Math.sin(lt * 9 + i), TL[1] + 0.02 + Math.sin(a) * r * 1.2); }); },
    cam: () => camAt([TL[0] - 0.35, 0.95, TL[1] + 0.95], [TL[0], 0.42, TL[1]], 46),
    anchors: bowlAnchor,
  },
  // 08 "It's just… sitting there." YOU stares down at the toilet, totally blank
  8: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c) { standAt(c.you, TL[0] + 0.1, TL[1] + 0.78, Math.PI); face(c.you, 'squint', 'neutral', 'neutral', { headPitch: -0.5 }); },
    cam: (W, c) => { const h = c.you.headPos(); return camAt([TL[0] + 0.6, 1.3, TL[1] - 0.1], [h.x - 0.02, h.y - 0.2, h.z], 52); },
    anchors: (W, c) => ({ forehead: forehead(c.you), bowl: V(...BOWL) }),
  },
  // 09 "Looking at you." from the bowl, looking up at YOU's face far above
  9: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c) { standAt(c.you, TL[0] + 0.9, TL[1] + 1.6, Math.PI); },
    cam: () => camAt([TL[0] + 0.03, 0.66, TL[1] + 0.62], [TL[0], 0.56, TL[1] + 0.02], 48),
    after(W, c, lt) { c.B.poop.userData.blink(lt > 0.3 && lt < 0.42 ? 1 : 0); },
    anchors: () => ({ bowl: V(TL[0], 0.62, TL[1] + 0.08) }),
    still: 0.2, clip: true,
  },
  // 10 (on "you") ECU: YOU horrified, silent scream
  10: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c) { standAt(c.you, TL[0] + 0.1, TL[1] + 0.8, Math.PI + 0.1); face(c.you, 'wide', 'raised', 'yell', { shoulderUp: 1, headPitch: -0.15 }); },
    cam: (W, c) => headCam(c.you, 0.42, -0.06, 0, -0.02, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 11 "You grab the plunger." holding it up like a sword
  11: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); c.pl = S.plunger(W.scene); c.B.plunger.visible = false; return c; },
    update(W, c) {
      standAt(c.you, BX + 0.55, -0.35, Math.PI - 0.5); face(c.you, 'open', 'angry', 'tight', { chestPuff: 0.6 });
      const p = rel(c.you, 0.32, 0.0, 0.8); c.pl.position.set(...p); c.pl.rotation.set(0.15, 0, 0);
      c.you.p.gripR = { prop: c.pl, which: 'R' }; c.you.p.gripL = { prop: c.pl, which: 'L' };
    },
    cam: (W, c) => headCam(c.you, 1.45, -0.3, 0.15, -0.3, 48),
  },
  // 12 KEY "The plunger breaks." he pumps with all his strength, the handle bends... and SNAPS
  12: {
    build(W) { const c = bath(W); c.you = person(W, 'you', { skin: '#d8745a' }); c.pl = S.plunger(W.scene); c.st = S.stick(W.scene); c.B.plunger.visible = false; return c; },
    update(W, c, lt) {
      const snap = lt >= 0.52, pump = Math.max(0, Math.sin(lt * 18)) * 0.05;
      standAt(c.you, TL[0], TL[1] + 0.68, Math.PI); face(c.you, 'closed', 'angry', 'grimace', { lean: 0.5, shoulderUp: 1 });
      c.pl.position.set(TL[0], 0.62 - (snap ? 0 : pump), TL[1] + 0.06);
      const bend = snap ? 0 : Math.min(0.5, lt * 0.9);
      c.pl.userData.upper.rotation.x = bend; c.pl.userData.upper.visible = !snap;
      if (!snap) {
        c.st.visible = false;
        c.you.p.gripR = { prop: c.pl, which: 'R' }; c.you.p.gripL = { prop: c.pl, which: 'L' };
      } else {
        const k = clamp((lt - 0.52) / 0.12);
        c.st.visible = true; c.st.position.set(TL[0], 1.05 + 0.2 * k, TL[1] + 0.3 + 0.1 * k); c.st.rotation.set(-0.3 - 0.6 * k, 0, 0.2 * k);
        c.you.p.gripR = c.st; face(c.you, 'wide', 'raised', 'o', { lean: 0.2 });
        c.you.p.handL = rel(c.you, 0.3, 0.2, 1.0); c.you.p.handPoseL = 'open';
      }
    },
    cam: () => camAt([TL[0] + 1.25, 1.3, TL[1] + 0.95], [TL[0] + 0.0, 0.95, TL[1] + 0.45], 52),
    anchors: bowlAnchor,
    still: 0.4, clip: true,
  },
  // 13 he holds up the broken stick in disbelief
  13: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); c.st = S.stick(W.scene); c.B.plunger.visible = false; return c; },
    update(W, c) {
      standAt(c.you, BX + 0.25, -0.1, Math.PI - 0.3); face(c.you, 'stare', 'worried', 'tight', { pupils: [0, -0.4] });
      const p = rel(c.you, 0.32, 0.06, 1.42); c.st.position.set(...p); c.st.rotation.set(0, 0, 0.5);
      c.you.p.gripR = c.st; c.you.p.handL = rel(c.you, 0.3, 0.12, 1.35); c.you.p.handPoseL = 'open';
    },
    cam: (W, c) => headCam(c.you, 0.95, -0.12, -0.08, -0.08, 42),
  },
  // 14 "Your friend knocks." ECU: knuckles on the bathroom door
  14: {
    build(W) { const c = hall(W); c.fr = person(W, 'friend'); return c; },
    update(W, c) {
      standAt(c.fr, HX + 0.2, -4.5, Math.PI); face(c.fr, 'open', 'worried', 'tight');
      c.fr.p.handR = [HX + 0.1, 1.35, -4.93]; c.fr.p.handPoseR = 'fist'; c.fr.p.handRotR = handRot([0, 1, 0], [0, 0, 1]);
    },
    cam: () => camAt([HX + 0.6, 1.42, -4.45], [HX + 0.08, 1.33, -4.98], 44),
  },
  // 15 ""Bro, you good?"" his face pressed flat against the door, listening
  15: {
    build(W) { const c = hall(W); c.fr = person(W, 'friend'); return c; },
    update(W, c) {
      standAt(c.fr, HX - 0.05, -4.68, Math.PI / 2); face(c.fr, 'wide', 'worried', 'tight', { leanSide: -0.25, headRoll: -0.35, pupils: [0.6, 0] });
      c.fr.p.handL = [HX + 0.12, 1.45, -4.97]; c.fr.p.handPoseL = 'flat'; c.fr.p.handRotL = handRot([0, 1, 0], [0, 0, 1]);
    },
    cam: (W, c) => { const h = c.fr.headPos(); return camAt([h.x + 0.55, h.y - 0.02, h.z + 0.25], [h.x, h.y, h.z - 0.05], 42); },
  },
  // 16 "You say: "Yeah."" YOU on the floor against the door, fake calm smile, thumbs up, sweating
  16: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); c.st = S.stick(W.scene); c.B.plunger.visible = false; return c; },
    update(W, c) {
      sitAt(c.you, BX + 0.88, 1.12, Math.PI); c.you.p.y = -0.36; face(c.you, 'happy', 'raised', 'grin', { shoulderUp: 0.8 });
      c.you.p.handR = rel(c.you, 0.32, -0.12, 0.85); c.you.p.handPoseR = 'thumb'; c.you.p.handRotR = handRot([0, 0, -1], [-1, 0, 0]);
      c.st.position.set(BX + 0.55, 0.015, 0.95); c.st.rotation.set(0, 0, Math.PI / 2);
    },
    cam: () => camAt([BX + 0.75, 1.05, -0.45], [BX + 0.86, 0.7, 1.1], 46),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 17 "You are not good." ECU: his panicked eyes
  17: {
    build(W) { const c = bath(W); c.you = person(W, 'you'); return c; },
    update(W, c) { sitAt(c.you, BX + 0.88, 1.12, Math.PI); c.you.p.y = -0.36; face(c.you, 'wide', 'worried', 'tight'); },
    cam: (W, c) => { const e = hl(c.you, 0, 0.012, 0.09); const p = hl(c.you, 0, 0.012, 0.33); return camAt(P3(p), P3(e), 34); },
    anchors: (W, c) => ({ forehead: forehead(c.you, 0.4) }),
  },
  // 18 "His mom calls a plumber." mom on the phone, hand on her cheek
  18: {
    build(W) { const c = hall(W); c.mom = person(W, 'mom'); c.ph = S.phoneProp(W.scene); return c; },
    update(W, c) {
      standAt(c.mom, HX - 0.2, -2.8, Math.PI + 0.2); face(c.mom, 'open', 'worried', 'frown', { headRoll: 0.1 });
      const ear = hl(c.mom, -0.1, -0.02, 0.01); c.ph.position.copy(ear); c.ph.rotation.set(0, c.mom.p.rotY - Math.PI / 2, -0.25); c.mom.p.gripR = c.ph;
      const ck = hl(c.mom, 0.07, -0.04, 0.05); c.mom.p.handL = [ck.x, ck.y, ck.z]; c.mom.p.handPoseL = 'flat';
      helpers.talk(c.mom, 0.3, 0.6);
    },
    cam: (W, c) => headCam(c.mom, 0.9, -0.15, 0.05, -0.15, 44),
  },
  // 19 "The whole family waits outside the door." the row of faces staring at the bathroom door
  19: {
    build(W) { const c = hall(W); for (const n of ['friend', 'mom', 'dad', 'sis']) c[n] = person(W, n); c.ph = S.phoneProp(W.scene); c.td = S.teddy(W.scene); return c; },
    update(W, c) {
      const door = [HX, 1.3, -5.0];
      standAt(c.friend, HX + 0.42, -3.05, Math.PI - 0.15); standAt(c.mom, HX - 0.38, -3.25, Math.PI + 0.15);
      standAt(c.dad, HX + 0.02, -2.6, Math.PI); standAt(c.sis, HX + 0.08, -3.75, Math.PI);
      for (const n of ['friend', 'mom', 'dad', 'sis']) face(c[n], 'open', n === 'dad' ? 'angry' : 'worried', n === 'dad' ? 'tight' : 'neutral', { lookAt: door });
      armsCrossed(c.dad);
      const ear = hl(c.mom, -0.1, -0.02, 0.01); c.ph.position.copy(ear); c.ph.rotation.set(0, c.mom.p.rotY - Math.PI / 2, -0.25); c.mom.p.gripR = c.ph;
      const tp = rel(c.sis, 0.15, 0, 0.62); c.td.position.set(...tp); c.td.rotation.y = c.sis.p.rotY;
      c.sis.p.handL = rel(c.sis, 0.13, 0.08, 0.62); c.sis.p.handR = rel(c.sis, 0.13, -0.08, 0.62);
    },
    cam: () => camAt([HX + 0.0, 1.3, -4.85], [HX + 0.02, 1.15, -2.6], 62),
  },
  // 20 "Even grandma." in her wheelchair, calmly sipping tea, staring at the door
  20: {
    build(W) { const c = hall(W); c.gm = person(W, 'grandma'); c.wc = S.wheelchair(W.scene); c.cup = S.teacup(W.scene); return c; },
    update(W, c, lt) {
      c.wc.position.set(HX + 0.55, 0, -2.9); c.wc.rotation.y = Math.PI - 0.25;
      sitAt(c.gm, HX + 0.55, -2.92, Math.PI - 0.25); face(c.gm, 'open', 'neutral', 'neutral', { lookAt: [HX, 1.2, -5] });
      const m = c.gm.mouthPos(), F = fwd(c.gm.p.rotY);
      const sip = smooth(clamp((lt - 0.7) / 0.4));
      c.cup.position.set(m.x + F.x * lerp(0.16, 0.06, sip), m.y - lerp(0.12, 0.03, sip), m.z + F.z * lerp(0.16, 0.06, sip)); c.cup.rotation.set(0, c.gm.p.rotY, 0);
      c.gm.p.gripR = c.cup; c.gm.p.handL = rel(c.gm, 0.25, 0.08, 0.6);
    },
    cam: (W, c) => headCam(c.gm, 1.15, -0.35, -0.1, -0.3, 44),
    still: 0.3,
  },
  // 21 "The plumber arrives." the white van screeches to a stop in front of the house
  21: {
    build(W) { const c = outside(W, { vanX: 2.0 }); c.dust = []; const dm = new THREE.MeshStandardMaterial({ color: '#c8b8a0', transparent: true, opacity: 0.6, flatShading: true }); for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + hash1(i) * 0.3, 0), dm); W.scene.add(d); c.dust.push(d); } return c; },
    update(W, c, lt) {
      const k = clamp(lt / 1.0), x = lerp(-14, 2.0, 1 - Math.pow(1 - k, 2.4));
      c.H.van.position.x = x; c.H.van.rotation.z = lt > 0.9 && lt < 1.2 ? -0.04 * Math.sin((lt - 0.9) / 0.3 * Math.PI) : 0;
      c.dust.forEach((d, i) => { const a = clamp((lt - 0.4) / 0.9); d.position.set(x - 2.4 - hash1(i * 3) * 1.5 * (1 + a), 0.25 + hash1(i * 7) * 0.6 * (0.5 + a), 16.4 + (hash1(i * 5) - 0.5) * 1.6); d.scale.setScalar(0.5 + a); d.visible = lt > 0.3; });
    },
    cam: () => camAt([10.5, 1.3, 20.6], [0.5, 2.0, 12.0], 52),
    still: 0.9, clip: true,
  },
  // 22 KEY "He walks in." the plumber walks down the hallway like a movie hero, the family against the walls
  22: {
    build(W) { const c = hall(W); for (const n of ['plumber', 'friend', 'mom', 'dad', 'sis']) c[n] = person(W, n); c.tb = S.toolbox(W.scene); c.td = S.teddy(W.scene); return c; },
    update(W, c, lt) {
      const z = 0.6 - lt * 0.75;
      standAt(c.plumber, HX + 0.02, z, Math.PI); c.plumber.p.walk = lt * 4.2; face(c.plumber, 'squint', 'angry', 'tight', { chestPuff: 0.6 });
      const h = rel(c.plumber, 0.05, -0.3, 0.62 + 0.03 * Math.sin(lt * 4.2)); c.tb.position.set(...h); c.tb.rotation.set(0.15 * Math.sin(lt * 4.2), c.plumber.p.rotY + Math.PI / 2, 0); c.plumber.p.gripR = c.tb;
      const pl = P3(c.plumber.headPos());
      standAt(c.friend, HX - 0.95, -2.2, Math.PI / 2 - 0.4); standAt(c.mom, HX - 0.97, -1.3, Math.PI / 2 - 0.3);
      standAt(c.dad, HX + 0.92, -1.9, -Math.PI / 2 + 0.3); standAt(c.sis, HX + 0.95, -2.8, -Math.PI / 2 + 0.4);
      for (const n of ['friend', 'mom', 'dad', 'sis']) face(c[n], 'wide', 'raised', n === 'sis' ? 'o' : 'neutral', { lookAt: pl });
      armsCrossed(c.dad);
      const tp = rel(c.sis, 0.15, 0, 0.62); c.td.position.set(...tp); c.td.rotation.y = c.sis.p.rotY;
      c.sis.p.handL = rel(c.sis, 0.13, 0.08, 0.62); c.sis.p.handR = rel(c.sis, 0.13, -0.08, 0.62);
    },
    cam: (W, c, lt) => camAt([HX - 0.1, 0.45, -4.4], [HX, 1.35 - lt * 0.05, 0.0], 58),
    still: 0.6, clip: true,
  },
  // 23 "He looks down." from the toilet: the plumber's face going pale
  23: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber', { skin: '#e2d2c2' }); return c; },
    update(W, c) { standAt(c.pl, TL[0] + 0.05, TL[1] + 0.68, Math.PI); face(c.pl, 'wide', 'raised', 'o', { headPitch: -0.5, lean: 0.45 }); },
    cam: (W, c) => { const h = c.pl.headPos(); return camAt([h.x + 0.02, h.y - 0.62, h.z - 0.2], [h.x, h.y, h.z], 50); },
    anchors: () => ({ bowl: V(TL[0], 0.62, TL[1] + 0.08) }),
  },
  // 24 KEY "He takes off his cap." slowly, and holds it to his chest like at a funeral
  24: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber'); c.cap = c.pl.hat.clone(); W.scene.add(c.cap); return c; },
    update(W, c, lt) {
      standAt(c.pl, TL[0] + 0.15, TL[1] + 0.75, Math.PI - 0.15);
      const k = smooth(clamp((lt - 0.15) / 0.55)), k2 = smooth(clamp((lt - 0.7) / 0.6));
      face(c.pl, k2 > 0.3 ? 'closed' : 'open', 'sad', 'frown', { headPitch: -0.1 - 0.25 * k2 });
      const top = hl(c.pl, 0.0, 0.13, 0.03), chest = c.pl.chestPos(), F = fwd(c.pl.p.rotY);
      const up = [top.x + F.x * 0.05, top.y + 0.04 * Math.sin(Math.PI * k), top.z + F.z * 0.05];
      const ch = [chest.x + F.x * 0.12, chest.y + 0.02, chest.z + F.z * 0.12];
      c.handAt = lt < 0.15 ? [top.x + F.x * 0.12, top.y - 0.05, top.z + F.z * 0.12] : mix3(up, ch, k2);
      c.pl.p.handR = c.handAt; c.pl.p.handPoseR = 'grip';
      c.pl.p.handL = k2 > 0.5 ? [ch[0] - F.z * 0.05, ch[1] - 0.04, ch[2] + F.x * 0.05] : null; c.pl.p.handPoseL = 'flat';
    },
    after(W, c, lt) {
      const lifted = lt > 0.3;
      c.pl.hat.visible = !lifted; c.cap.visible = lifted;
      if (lifted) {
        const hp = c.pl.arms.R.H.grp.getWorldPosition(V()), F = fwd(c.pl.p.rotY);
        c.cap.position.set(hp.x + F.x * 0.02, hp.y - 0.05, hp.z + F.z * 0.02);
        const k2 = smooth(clamp((lt - 0.7) / 0.6));
        c.cap.rotation.set(-Math.PI / 2 * k2, c.pl.p.rotY, 0); c.cap.scale.setScalar(1);
        c.cap.position.y -= 0.11 * (1 - k2);
      }
    },
    cam: (W, c, lt) => headCam(c.pl, 1.0, -0.22, 0.05, -0.2, 42),
    still: 0.85, clip: true,
  },
  // 25 "He's been a plumber..." flashback: the young plumber fixing pipes under a sink, proud
  25: {
    build(W) { const c = kitchen(W); c.pl = person(W, 'plumberYoung'); c.wr = S.wrench(W.scene); return c; },
    update(W, c) {
      sitAt(c.pl, KX + 0.5, -0.6, Math.PI / 2 + 0.35); c.pl.p.y = -0.38; face(c.pl, 'happy', 'raised', 'grin', { lean: 0.1, lookAt: [KX + 1.5, 0.95, -0.1] });
      c.wr.position.set(...c.K.pipe); c.wr.position.y -= 0.06; c.wr.rotation.set(0, 0.4, 1.2); c.pl.p.gripL = c.wr;
      c.pl.p.handR = rel(c.pl, 0.25, -0.2, 0.55); c.pl.p.handPoseR = 'thumb'; c.pl.p.handRotR = handRot([0, 0, 1], [0, 1, 0]);
    },
    cam: () => camAt([KX + 1.55, 0.95, 0.05], [KX + 0.45, 0.62, -0.75], 48),
  },
  // 26 "...for thirty years." flashback: a burst pipe spraying everywhere, he holds it, soaked but calm
  26: {
    build(W) { const c = kitchen(W); c.pl = person(W, 'plumberYoung'); c.K.spray.visible = true; c.pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.6, roughness: 0.3, flatShading: true })); W.scene.add(c.pipe); return c; },
    update(W, c, lt) {
      const P = [KX + 0.1, 1.25, -1.1];
      c.pipe.position.set(P[0], P[1], P[2] - 0.05);
      standAt(c.pl, KX + 0.1, -0.35, Math.PI); face(c.pl, 'squint', 'neutral', 'neutral', { lean: 0.05 });
      c.pl.p.handL = [P[0] + 0.07, P[1], P[2] + 0.25]; c.pl.p.handR = [P[0] - 0.07, P[1], P[2] + 0.25]; c.pl.p.handPoseL = c.pl.p.handPoseR = 'grip';
      c.K.spray.position.set(0.1, 1.25, -0.82);
      c.K.spray.children.forEach((d) => { const q = ((lt * 2.2 + d.userData.ph) % 1); const v = d.userData.v; d.position.set(v[0] * q, v[1] * q - 2.5 * q * q, v[2] * q * 0.8); d.scale.setScalar(1 + q); });
    },
    cam: () => camAt([KX + 0.95, 1.45, 0.5], [KX + 0.1, 1.3, -0.7], 52),
    still: 0.4,
  },
  // 27 "He's never seen this." ECU: back in colour, the plumber's shocked face
  27: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber', { skin: '#e2cbb5' }); return c; },
    update(W, c) { standAt(c.pl, TL[0] + 0.05, TL[1] + 0.7, Math.PI); face(c.pl, 'wide', 'raised', 'o', { headPitch: -0.05 }); },
    cam: (W, c) => headCam(c.pl, 0.45, -0.06, 0.02, -0.02, 40),
    anchors: (W, c) => ({ forehead: forehead(c.pl) }),
  },
  // 28 "What you don't know:" the grand museum hall, one glass case in the spotlight
  28: {
    build: (W) => museum(W),
    update() {},
    cam: (W, c, lt) => camAt([MX + 0.3, 1.7, 5.5], [MX, 1.4, -4.2], 52),
  },
  // 29 "the biggest fossil human poop ever found" the glass case: a little brown stone-like fossil, a label
  29: {
    build: (W) => museum(W),
    update() {},
    cam: () => camAt([MX + CASE[0] + 0.45, CASE[1] + 0.45, CASE[2] + 0.95], [MX + CASE[0], CASE[1] + 0.06, CASE[2]], 40),
    anchors: () => ({ fossil: V(MX + CASE[0], CASE[1] + 0.07, CASE[2]) }),
  },
  // 30 "is about twenty centimetres long." ECU: a little ruler measuring the fossil
  30: {
    build: (W) => museum(W),
    update() {},
    cam: () => camAt([MX + CASE[0] + 0.02, CASE[1] + 0.2, CASE[2] + 0.42], [MX + CASE[0] - 0.01, CASE[1] + 0.05, CASE[2] + 0.04], 40),
  },
  // 31 "It's over a thousand years old." three visitors lean toward the case, very serious
  31: {
    build(W) { const c = museum(W); c.om = person(W, 'oldman'); c.la = person(W, 'lady'); c.ki = person(W, 'kid'); c.cane = S.caneProp(W.scene); return c; },
    update(W, c) {
      const C = [MX + CASE[0], CASE[1] + 0.1, CASE[2]];
      standAt(c.om, MX - 0.42, -2.45, Math.PI + 0.2); standAt(c.la, MX + 0.18, -2.15, Math.PI); standAt(c.ki, MX + 0.05, -2.75, Math.PI - 0.1);
      for (const k of ['om', 'la', 'ki']) face(c[k], 'open', 'raised', k === 'ki' ? 'o' : 'tight', { lookAt: C, lean: 0.25 });
      c.cane.position.set(MX - 0.35, 0, -2.18); c.om.p.gripR = c.cane;
      c.la.p.handL = rel(c.la, -0.15, 0.08, 0.95); c.la.p.handR = rel(c.la, -0.15, -0.08, 0.95);
      c.ki.p.handL = rel(c.ki, 0.25, 0.12, 0.85); c.ki.p.handPoseL = 'flat';
    },
    cam: () => camAt([MX + 0.05, 1.4, -5.05], [MX - 0.05, 1.25, -2.4], 56),
  },
  // 32 "And it's kept in a museum." high wide shot: the case in the spotlight, the guard, rope barriers
  32: {
    build(W) { const c = museum(W); c.gd = person(W, 'guard'); return c; },
    update(W, c) { standAt(c.gd, MX + 1.6, -3.6, -Math.PI / 2 + 0.6); face(c.gd, 'open', 'angry', 'tight'); c.gd.p.handL = rel(c.gd, -0.1, 0.12, 0.85); c.gd.p.handR = rel(c.gd, -0.1, -0.12, 0.85); },
    cam: (W, c, lt) => camAt([MX + 3.4, 5.6, 3.4], [MX, 0.9, -4.0], 50),
  },
  // 33 "The plumber pulls out a ruler." kneeling next to the toilet with a tiny school ruler
  33: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber'); c.ru = S.rulerProp(W.scene, { len: 0.15 }); return c; },
    update(W, c) {
      sitAt(c.pl, TL[0] + 0.52, TL[1] + 0.25, -Math.PI / 2 - 0.3); c.pl.p.y = -0.22; face(c.pl, 'squint', 'raised', 'tight', { lean: 0.25, lookAt: [BOWL[0], 0.5, BOWL[2]] });
      const h = rel(c.pl, 0.32, -0.1, 0.78); c.ru.position.set(...h); c.ru.rotation.set(0, c.pl.p.rotY - Math.PI / 2, 0.3); c.pl.p.gripR = c.ru;
      c.pl.p.handL = rel(c.pl, 0.2, 0.18, 0.55); c.pl.p.handPoseL = 'flat';
    },
    cam: () => camAt([TL[0] - 0.3, 0.8, TL[1] + 1.05], [TL[0] + 0.4, 0.7, TL[1] + 0.25], 50),
    anchors: bowlAnchor,
  },
  // 34 KEY "Then a bigger ruler." a builder's measuring tape that keeps extending; zoom out
  34: {
    build(W) { const c = bath(W, { doorOpen: 1 }); c.pl = person(W, 'plumber'); c.tm = S.tapeMeasure(W.scene); return c; },
    update(W, c, lt) {
      const k = easeOut(clamp(lt / 1.4));
      const z = TL[1] + 0.55 + k * 1.6;
      standAt(c.pl, TL[0] + 0.25 + k * 0.6, z, Math.PI + 0.2); c.pl.p.walk = lt * 9; face(c.pl, 'squint', 'raised', 'tight', { lookAt: P3(V(...BOWL)) });
      const hp = rel(c.pl, 0.25, -0.15, 0.95), tgt = V(BOWL[0], 0.66, BOWL[2]);
      c.tm.position.set(...hp);
      const d = tgt.clone().sub(V(...hp)), L = d.length();
      c.tm.rotation.set(0, -Math.atan2(d.z, d.x), Math.atan2(d.y, Math.hypot(d.x, d.z)), 'YXZ');
      c.tm.userData.setLen(L - 0.05);
      c.pl.p.gripR = c.tm; c.pl.p.handL = rel(c.pl, 0.25, 0.1, 1.0); c.pl.p.handPoseL = 'open';
    },
    cam: (W, c, lt) => { const k = easeOut(clamp(lt / 1.4)); return camAt([TL[0] + 0.55 + k * 0.95, 1.0 + k * 0.9, TL[1] + 0.05 - k * 0.12], [TL[0] + 0.45 + k * 0.1, 0.85, TL[1] + 0.9 + k * 0.6], 50 + k * 22); },
    anchors: bowlAnchor,
    still: 0.6, clip: true,
  },
  // 35 "Then he takes a photo." the plumber photographs the toilet with his phone, very serious
  35: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber'); c.ph = S.phoneProp(W.scene); return c; },
    update(W, c) {
      standAt(c.pl, TL[0] + 0.1, TL[1] + 0.75, Math.PI); face(c.pl, 'squint', 'raised', 'tight', { headPitch: -0.3, lean: 0.25 });
      const p = rel(c.pl, 0.36, 0, 1.28); c.ph.position.set(...p); c.ph.rotation.set(-0.9, c.pl.p.rotY + Math.PI, 0);
      c.pl.p.gripR = c.ph; c.pl.p.handL = rel(c.pl, 0.34, 0.06, 1.22); c.pl.p.handPoseL = 'flat';
    },
    cam: () => camAt([TL[0] - 0.55, 1.2, TL[1] + 0.05], [TL[0] + 0.1, 1.35, TL[1] + 0.72], 52),
    anchors: bowlAnchor,
  },
  // 36 ""Kid…"" hand on YOU's shoulder: the plumber, proud and emotional, one single tear
  36: {
    build(W) { const c = bath(W); c.pl = person(W, 'plumber'); c.you = person(W, 'you'); c.cap = c.pl.hat; return c; },
    update(W, c) {
      standAt(c.you, BX + 0.35, 0.35, -Math.PI / 2 - 0.3); face(c.you, 'open', 'worried', 'tight', { shoulderUp: 0.8, headPitch: 0.1 });
      standAt(c.pl, BX - 0.15, 0.2, Math.PI / 2 - 0.1); face(c.pl, 'happy', 'sad', 'smile', { lookAt: P3(c.you.headPos()) });
      const sh = c.you._w(c.you.shoulderLocal.R.clone().add(V(0, 0.04, 0)), c.you.chest);
      c.pl.p.handL = [sh.x, sh.y + 0.03, sh.z]; c.pl.p.handPoseL = 'flat';
      c.you.p.lookAt = P3(c.pl.headPos());
    },
    cam: (W, c) => { const h = c.pl.headPos(); return camAt([h.x + 0.8, h.y - 0.08, h.z + 0.7], [h.x + 0.08, h.y - 0.1, h.z], 42); },
    anchors: (W, c) => ({ eye: hl(c.pl, 0.031, 0.0, 0.09) }),
  },
  // 37 KEY "I think you broke the record." the family crowds the doorway and starts clapping slowly
  37: {
    build(W) { const c = bath(W, { doorOpen: 1 }); for (const n of ['plumber', 'you', 'friend', 'mom', 'dad', 'sis']) c[n] = person(W, n); c.td = S.teddy(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, BX - 0.12, 0.55, -Math.PI / 2 + 0.7); face(c.you, 'open', 'raised', 'smile', { shoulderUp: 0.5 });
      standAt(c.plumber, BX - 0.62, 0.3, Math.PI / 2 + 0.6); face(c.plumber, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) });
      const sh = c.you._w(c.you.shoulderLocal.R.clone().add(V(0, 0.04, 0)), c.you.chest);
      c.plumber.p.handL = [sh.x, sh.y + 0.03, sh.z]; c.plumber.p.handPoseL = 'flat';
      const rate = 1.4 + lt * 0.9;
      standAt(c.friend, BX + 0.62, 1.75, Math.PI - 0.25); standAt(c.mom, BX + 1.05, 1.95, Math.PI - 0.1);
      standAt(c.dad, BX + 0.85, 2.45, Math.PI); standAt(c.sis, BX + 0.72, 1.55, Math.PI - 0.3);
      for (const [n, ph] of [['friend', 0.0], ['mom', 0.3], ['dad', 0.15]]) { face(c[n], 'happy', 'raised', 'grin'); clap(c[n], lt, rate, ph); }
      c.dad.p.headPitch = 0.08 * Math.sin(lt * 5);
      face(c.sis, 'happy', 'raised', 'grin');
      const tp = rel(c.sis, 0.12, 0, 1.15 + 0.05 * Math.sin(lt * 6)); c.td.position.set(...tp); c.td.rotation.y = c.sis.p.rotY;
      c.sis.p.handL = [tp[0] + 0.07, tp[1] - 0.05, tp[2]]; c.sis.p.handR = [tp[0] - 0.07, tp[1] - 0.05, tp[2]];
    },
    cam: (W, c, lt) => camAt([BX + 0.95, 1.45, -0.95 + lt * 0.08], [BX + 0.55, 1.25, 1.6], 62),
    still: 0.7, clip: true,
  },
  // 38 the house at sunset, the plumber's van out front, stink lines from the bathroom window
  38: {
    build: (W) => outside(W, { vanX: -1.2, bathGlow: false }),
    update() {},
    cam: () => camAt([5.5, 1.8, 27.0], [1.2, 3.7, 2.0], 46),
    anchors: () => ({ window: V(3.0, 4.95, 3.0) }),
  },
};
