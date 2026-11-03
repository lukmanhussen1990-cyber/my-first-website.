// The 70 shots of the mansion reel as code-made low-poly 3D animations (one entry per shot; every shot is a clip).
// Each shot: build(W) -> ctx (set + cast, once), update(W, ctx, lt) (poses at shot-local time lt, every frame),
// after(W, ctx, lt) (props that follow a solved body), cam(W, ctx, lt) -> {pos, target, fov, roll},
// anchors(W, ctx, lt) -> named 3D points for the 2D effects (hearts, sweat, sparkles...). W.t0 = the shot's start
// on the voiceover, so mouths move exactly while a line is said.
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './sets.js';
import * as MS from './mansion.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn, easeOutBack } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const sitAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY }); };
const standAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY, y }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);   // head-local point
const forehead = (ch, side = 0) => hl(ch, side * 0.03, 0.065, 0.08);
const headTop = (ch) => hl(ch, 0, 0.16, 0);
const cheek = (ch, side = 1) => hl(ch, side * 0.06, -0.03, 0.07);
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
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const camLerp = (a, b, k) => ({ pos: lerp3(a.pos, b.pos, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k) });
const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);          // rotY that faces point `to` (x, z)
// reaction camera: in front of a person, turned toward where they look, so they face the lens
const lookCam = (ch, target, dist = 0.62, fov = 42, mixF = 1.0, dy = -0.03) => {
  const h = ch.headPos(), d = V(...target).sub(h); d.y = 0; d.normalize(); const F = fwd(ch.p.rotY);
  const dir = d.multiplyScalar(0.6).add(F.multiplyScalar(mixF)).normalize();
  return camAt(P3(h.clone().addScaledVector(dir, dist).add(V(0, dy, 0))), [h.x, h.y - 0.02, h.z], fov);
};
// the voiceover clock: talk only while the line is said (absolute seconds)
const talkIn = (W, ch, lt, a, b, k = 1) => { const t = W.t0 + lt; if (t > a && t < b) helpers.talk(ch, t, k); };
// heart eyes: the black rectangles POP into big red pixel hearts at t0, then pulse (heartBig / heart)
const heartEyes = (ch, lt, t0 = 0, hz = 2.2) => { if (lt < t0) return; const k = lt - t0; ch.p.eyes = k < 0.14 || Math.sin(k * Math.PI * 2 * hz) > -0.1 ? 'heartBig' : 'heart'; };
const handsUp = (ch, k = 1) => { ch.p.handL = rel(ch, 0.12, 0.32, lerp(1.0, 2.05, k) * ch.s); ch.p.handR = rel(ch, 0.12, -0.32, lerp(1.0, 2.05, k) * ch.s); ch.p.handPoseL = ch.p.handPoseR = 'open'; };
const holdTummy = (ch, k = 0) => { const c = ch.bellyPos(); const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); ch.p.handL = P3(c.clone().addScaledVector(L, 0.1).addScaledVector(F, 0.07).add(V(0, 0.02 + k * Math.sin(k * 40) * 0.01, 0))); ch.p.handR = P3(c.clone().addScaledVector(L, -0.1).addScaledVector(F, 0.07)); ch.p.handPoseL = ch.p.handPoseR = 'flat'; };
const handsOnCheeks = (ch) => { const l = hl(ch, 0.09, -0.04, 0.04), r = hl(ch, -0.09, -0.04, 0.04); ch.p.handL = P3(l); ch.p.handR = P3(r); ch.p.handPoseL = ch.p.handPoseR = 'flat'; };
const pray = (ch, h = 1.25) => { const p = rel(ch, 0.26, 0, h * ch.s); ch.p.handL = [p[0], p[1], p[2]]; ch.p.handR = [p[0], p[1] - 0.01, p[2]]; ch.p.handPoseL = ch.p.handPoseR = 'flat'; };
const knockAt = (ch, door, lt, rate = 9, k = 1) => { const a = Math.max(0, Math.sin(lt * rate * Math.PI * 2)), F = fwd(ch.p.rotY), d = 0.04 + 0.14 * a * k; ch.p.handR = [door[0] - F.x * d, door[1], door[2] - F.z * d]; ch.p.handPoseR = 'fist'; };   // the fist hits the door when sin <= 0

// ------------------------------------------------------------------ places (light + set)
const SX = MS.ST.x0, MX = MS.MO.x0, HX = MS.HA.x0, DX = MS.DI.x0, BX = MS.BA.x0, PX = MS.PA.x0, GX = MS.GA.x0;
function street(W) {
  S.lights(W, { sky: 0x9ab4f0, ground: 0x4a5a4a, hemi: 1.15, key: 0xd0dcff, keyI: 1.0, fillI: 0 }); S.keyAt(W, [SX + 4, 1, -1], { from: [-6, 12, 8], size: 12 });
  MS.sky(W, 'night', [SX, 0, 0]); return { St: MS.buildStreet(W) };
}
function outside(W, o = {}) {
  const night = o.night !== false;
  S.lights(W, night ? { sky: 0xa8bcf0, ground: 0x4a5a4a, hemi: 1.15, key: 0xd8e0ff, keyI: 1.0, fillI: 0 } : { sky: 0xd8ecff, ground: 0x9ab88a, hemi: 1.1, key: 0xfff4e0, keyI: 2.0, fillI: 0 });
  S.keyAt(W, [MX, 2, 4], { from: night ? [-8, 14, 10] : [8, 16, 12], size: 18 });
  MS.sky(W, night ? 'night' : 'day', [MX, 0, 5]); return { O: MS.buildMansionOut(W, o) };
}
function hall(W, o = {}) {
  S.lights(W, { sky: 0xfff8f0, ground: 0xd8c8b0, hemi: o.night ? 0.55 : 1.1, key: 0xfff2e0, keyI: o.night ? 0.45 : 1.25, fillI: 0 });
  S.keyAt(W, [HX - 1, 1, 1], { from: [4, 9, 7], size: 9 }); W.scene.background = new THREE.Color('#f4ece0'); return { H: MS.buildHall(W, o) };
}
function dining(W) { S.lights(W, { sky: 0xffe0c0, ground: 0x8a6a5a, hemi: 0.75, key: 0xffd8b0, keyI: 0.7, fillI: 0 }); S.keyAt(W, [DX, 1, 0], { from: [2, 7, 5], size: 5 }); W.scene.background = new THREE.Color('#2a1e1a'); return { D: MS.buildDining(W) }; }
function bath(W) { S.lights(W, { sky: 0xfffaf2, ground: 0xd8ccc0, hemi: 1.1, key: 0xfff4e4, keyI: 1.0, fillI: 0 }); S.keyAt(W, [BX, 1, -1], { from: [2, 7, 6], size: 5 }); W.scene.background = new THREE.Color('#f8f4ee'); return { B: MS.buildBath(W) }; }
function paris(W) { S.lights(W, { sky: 0xffd8c0, ground: 0x9a8a7a, hemi: 1.0, key: 0xffc090, keyI: 1.6, fillI: 0 }); S.keyAt(W, [PX, 1, 2], { from: [7, 6, 9], size: 8 }); MS.sky(W, 'sunset', [PX, 0, -10]); return { P: MS.buildParis(W) }; }
function garden(W) { S.lights(W, { sky: 0xdcefff, ground: 0x9ac88a, hemi: 1.15, key: 0xfff4e0, keyI: 1.9, fillI: 0 }); S.keyAt(W, [GX, 1, 2], { from: [6, 14, 10], size: 10 }); MS.sky(W, 'day', [GX, 0, -10]); return { G: MS.buildGarden(W) }; }

// fixed spots
const BENCH = [SX - 1.0, -0.52], PT_DOOR = [SX + 4.2, -2.05], CAFE_DOOR = [SX + 13.6, -1.75];
const DOOR_Z = 0.32, STEP_Y = 0.6;                       // the mansion doorway (butler / owner stand here), the top step
const COUCH = MS.HA.couch;                               // [-4.2, 1.6] (local), faces -x
const couchSeat = (i) => [HX + COUCH[0] - 0.05, COUCH[1] + (i - 1.5) * 0.62];   // 4 seats along z, sitting faces -x

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 "You're homeless." night park: YOU alone on the bench under a street lamp
  1: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, ...BENCH, 0); face(c.you, 'open', 'sad', 'frown', { headPitch: -0.22, lean: 0.12 }); },
    cam: (W, c, lt) => camAt([SX - 0.3 - lt * 0.05, 1.35, 3.4 - lt * 0.35], [SX - 1.0, 0.95, -0.6], 44),
    anchors: (W, c) => ({ head: headTop(c.you) }),
  },
  // 02 "And you need to poop." the stomach rumbles, he grabs it
  2: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...BENCH, 0); const k = smooth(clamp((lt - 0.35) / 0.25));
      face(c.you, k > 0.5 ? 'wide' : 'open', 'worried', k > 0.5 ? 'o' : 'frown', { lean: 0.12 + k * 0.15, headPitch: -0.1 - k * 0.15 });
      holdTummy(c.you, k); c.you.p.bellyWobble = k * 2;
    },
    cam: (W, c, lt) => { const h = c.you.headPos(); return camAt([h.x + 0.35, h.y - 0.15, h.z + 1.45 - lt * 0.15], [h.x, h.y - 0.3, h.z], 44); },
    anchors: (W, c) => ({ belly: c.you.bellyPos(), forehead: forehead(c.you) }),
  },
  // 03 "Bad." ECU: the sweaty face, EMERGENCY
  3: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, ...BENCH, 0); face(c.you, lt > 0.15 ? 'squint' : 'wide', 'worried', 'grimace', { lean: 0.25, headPitch: -0.05 }); holdTummy(c.you, 1); },
    cam: (W, c, lt) => headCam(c.you, 0.5 - lt * 0.05, -0.01, 0.02, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, -1) }),
  },
  // 04 "The park toilet" YOU waddle-runs to the little park toilet building
  4: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      const k = lt / 0.8, x = lerp(SX + 0.4, SX + 2.6, k), z = lerp(-0.6, -1.5, k);
      standAt(c.you, x, z, yawTo([x, z], PT_DOOR)); c.you.p.walk = lt * 17; c.you.p.lean = 0.15; face(c.you, 'wide', 'worried', 'grimace'); holdTummy(c.you, 1);
    },
    cam: (W, c, lt) => camAt([SX - 0.6 + lt * 0.5, 1.7, 3.0], [SX + 3.2, 1.2, -2.6], 52),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 05 "is closed." the green door: a red CLOSED sign + a chain; YOU yanks the handle
  5: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      standAt(c.you, PT_DOOR[0] - 0.05, PT_DOOR[1] + 0.62, Math.PI); face(c.you, 'wide', 'worried', 'grimace', { lean: -0.06 });
      const y = Math.sin(lt * 34) * 0.015 * (lt > 0.15 ? 1 : 0);
      c.you.p.handR = [PT_DOOR[0] + 0.32, 1.0 + y, PT_DOOR[1] + 0.1]; c.you.p.handPoseR = 'grip';
      holdTummy(c.you, 1); c.you.p.handR = [PT_DOOR[0] + 0.32, 1.0 + y, PT_DOOR[1] + 0.1];
    },
    after(W, c, lt) { c.St.door.rotation.y = Math.sin(lt * 34) * 0.006 * (lt > 0.15 ? 1 : 0); },
    cam: (W, c, lt) => camAt([PT_DOOR[0] + 0.95, 1.6, PT_DOOR[1] + 1.65 - lt * 0.12], [PT_DOOR[0] + 0.05, 1.3, PT_DOOR[1]], 42),
    anchors: (W, c) => ({ sign: [PT_DOOR[0], 1.45, PT_DOOR[1] + 0.05], forehead: forehead(c.you) }),
  },
  // 06 "The café says" the café at night: the owner in the door, YOU in front
  6: {
    build(W) { const c = street(W); c.you = person(W, 'you'); c.cf = person(W, 'cafe'); return c; },
    update(W, c, lt) {
      standAt(c.cf, CAFE_DOOR[0], CAFE_DOOR[1] + 0.35, 0); face(c.cf, 'open', 'skeptic', 'frown');
      const cp = c.cf.chestPos(); c.cf.p.handL = [cp.x - 0.1, cp.y - 0.12, cp.z + 0.12]; c.cf.p.handR = [cp.x + 0.1, cp.y - 0.1, cp.z + 0.12]; c.cf.p.handPoseL = c.cf.p.handPoseR = 'flat';
      standAt(c.you, CAFE_DOOR[0] - 1.25, CAFE_DOOR[1] + 1.5, yawTo([CAFE_DOOR[0] - 1.25, CAFE_DOOR[1] + 1.5], [CAFE_DOOR[0], CAFE_DOOR[1]]));
      face(c.you, 'open', 'worried', 'smile'); holdTummy(c.you, 1); c.you.p.legBounce = 1;
    },
    cam: (W, c, lt) => camAt([CAFE_DOOR[0] - 0.9 + lt * 0.2, 1.3, CAFE_DOOR[1] + 5.6], [CAFE_DOOR[0] - 0.75, 1.85, CAFE_DOOR[1]], 50),
  },
  // 07 "customers only." the café owner shakes his head + wags a finger
  7: {
    build(W) { const c = street(W); c.cf = person(W, 'cafe'); return c; },
    update(W, c, lt) {
      standAt(c.cf, CAFE_DOOR[0], CAFE_DOOR[1] + 0.35, 0.25); face(c.cf, 'squint', 'angry', 'tight', { headYaw: Math.sin(lt * 14) * 0.35 });
      const h = c.cf.headPos(); c.cf.p.handR = [h.x - 0.2 + Math.sin(lt * 16) * 0.06, h.y + 0.02, h.z + 0.22]; c.cf.p.handPoseR = 'point';
    },
    cam: (W, c, lt) => headCam(c.cf, 0.95 - lt * 0.08, -0.05, -0.18, -0.08, 42),
    anchors: (W, c) => ({ head: headTop(c.cf) }),
  },
  // 08 "Then you see" YOU turns and looks up, eyes wide
  8: {
    build(W) { const c = street(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      standAt(c.you, SX + 7.0, 1.2, -0.2); const k = smooth(clamp((lt - 0.15) / 0.3));
      face(c.you, k > 0.5 ? 'wide' : 'open', 'raised', k > 0.5 ? 'o' : 'frown', { headYaw: lerp(0.9, -0.1, k), headPitch: lerp(-0.1, 0.35, k) }); holdTummy(c.you, 1);
    },
    cam: (W, c, lt) => headCam(c.you, 0.75, -0.12, 0.1, 0.0, 42),
  },
  // 09 "a mansion." slow pan up the giant mansion: golden gate, fountain, sparkles; tiny YOU in front
  9: {
    build(W) { const c = outside(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, MX + 0.5, 19.2, Math.PI); face(c.you, 'wide', 'raised', 'o', { headPitch: 0.3 }); },
    cam: (W, c, lt) => { const k = easeInOut(lt / 1.08); return camAt([MX + 1.0, 1.2 + k * 1.5, 23.5], [MX, lerp(2.5, 6.5, k), lerp(14, 0, k)], 52); },
    anchors: (W, c) => ({ mansion: [MX, 7.5, 0], gate: [MX, 2.4, 15.5], fountain: [MX, 2.4, 8.5] }),
  },
  // 10 "You knock." tiny YOU at the HUGE door: KNOCK KNOCK!
  10: {
    build(W) { const c = outside(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, MX - 0.25, 0.95, Math.PI, STEP_Y); face(c.you, 'open', 'worried', 'tight', { headPitch: 0.25 }); holdTummy(c.you, 1); if (lt > 0.12 && lt < 0.85) knockAt(c.you, [MX - 0.32, 2.1, 0.22], lt, 3.5); },
    cam: (W, c, lt) => camAt([MX - 1.0 + lt * 0.15, 1.5, 4.6], [MX - 0.1, 2.3, 0.3], 50),
    anchors: (W, c) => ({ knock: [MX - 0.32, 2.15, 0.22] }),
  },
  // 11 "The butler opens." the doors open: the very serious BUTLER
  11: {
    build(W) { const c = outside(W); c.you = person(W, 'you'); c.bu = person(W, 'butler'); return c; },
    update(W, c, lt) {
      standAt(c.you, MX - 0.4, 1.5, Math.PI - 0.2, STEP_Y); face(c.you, 'open', 'raised', 'smile'); holdTummy(c.you, 1);
      standAt(c.bu, MX + 0.05, DOOR_Z, 0, STEP_Y); face(c.bu, 'open', 'neutral', 'tight', { lookAt: P3(c.you.headPos()) });
    },
    after(W, c, lt) { const k = easeOut(clamp(lt / 0.5)); c.O.leafL.rotation.y = k * 1.35; c.O.leafR.rotation.y = -k * 1.35; c.O.glow.material.opacity = 0.4 * k; },
    cam: (W, c, lt) => camAt([MX + 1.2, 1.7, 3.4 - lt * 0.15], [MX - 0.05, 1.85, 0.3], 46),
  },
  // 12 "He looks at you." ECU: the butler looks down at YOU, one eyebrow up
  12: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.bu = person(W, 'butler'); c.O.glow.material.opacity = 0.35; return c; },
    update(W, c, lt) { standAt(c.bu, MX, DOOR_Z, 0, STEP_Y); face(c.bu, 'open', 'skeptic', 'tight', { headPitch: -0.28, pupils: [0, -0.6] }); },
    cam: (W, c, lt) => headCam(c.bu, 0.62 - lt * 0.06, -0.16, 0.03, -0.01, 40),
  },
  // 13 "He closes the door." SLAM! in YOU's face
  13: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.you = person(W, 'you'); c.bu = person(W, 'butler'); return c; },
    update(W, c, lt) {
      standAt(c.you, MX + 0.05, 1.45, Math.PI + 0.15, STEP_Y); face(c.you, lt > 0.62 ? 'wide' : 'open', lt > 0.62 ? 'sad' : 'raised', lt > 0.62 ? 'o' : 'smile'); holdTummy(c.you, 1);
      standAt(c.bu, MX, DOOR_Z - 0.2 * clamp(lt / 0.4), 0, STEP_Y); face(c.bu, 'squint', 'neutral', 'tight');
    },
    after(W, c, lt) { const k = 1 - easeIn(clamp((lt - 0.15) / 0.45)); c.O.leafL.rotation.y = k * 1.35; c.O.leafR.rotation.y = -k * 1.35; c.O.glow.material.opacity = 0.35 * k; c.bu.root.visible = k > 0.12; },
    cam: (W, c, lt) => camAt([MX - 1.2, 1.65, 3.4], [MX + 0.15, 1.75, 0.5], 46),
    anchors: (W, c) => ({ door: [MX, 2.2, 0.3], head: headTop(c.you) }),
  },
  // 14 "You knock again." close: the fist pounds the door, annoyed face, BIG KNOCK KNOCK!
  14: {
    build(W) { const c = outside(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, MX - 0.3, 0.88, Math.PI, STEP_Y); face(c.you, 'squint', 'angry', 'grimace', { lean: 0.08 }); holdTummy(c.you, 1); if (lt > 0.1) knockAt(c.you, [MX - 0.42, 2.0, 0.22], lt, 6.0, 1.3); },
    cam: (W, c, lt) => camAt([MX + 1.2, 1.95, 1.05], [MX - 0.3, 1.9, 0.62], 46),
    anchors: (W, c) => ({ knock: [MX - 0.42, 2.0, 0.22], forehead: forehead(c.you) }),
  },
  // 15 "This time," the doors swing open: warm light pours out
  15: {
    build(W) { const c = outside(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, MX + 0.1, 1.5, Math.PI, STEP_Y); face(c.you, 'wide', 'raised', 'o'); holdTummy(c.you, 1); },
    after(W, c, lt) { const k = easeOut(clamp((lt - 0.05) / 0.55)); c.O.leafL.rotation.y = k * 1.35; c.O.leafR.rotation.y = -k * 1.35; c.O.glow.material.opacity = 0.95 * k; c.O.doorLight.intensity = 12 * k; },
    cam: (W, c, lt) => camAt([MX + 0.2, 1.4, 4.6 - lt * 0.3], [MX, 2.2, 0.3], 46),
    anchors: (W, c) => ({ door: [MX, 2.5, 0.3] }),
  },
  // 16 "the owner opens." low angle: the OWNER in his silk robe, light glowing behind him
  16: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.ow = person(W, 'owner'); c.O.glow.material.opacity = 0.7; c.O.doorLight.intensity = 4; return c; },
    update(W, c, lt) {
      standAt(c.ow, MX, DOOR_Z, 0, STEP_Y); face(c.ow, 'open', 'raised', 'neutral', { headPitch: -0.2 });
      c.ow.p.handL = rel(c.ow, 0.05, 0.24, 1.0 * c.ow.s + STEP_Y); c.ow.p.handPoseL = 'flat';
      c.ow.p.handR = rel(c.ow, 0.06, -0.24, 0.98 * c.ow.s + STEP_Y); c.ow.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => camAt([MX + 0.3, 1.1, 2.0 - lt * 0.3], [MX, 2.05, 0.3], 46),
    anchors: (W, c) => ({ owner: c.ow.chestPos(), head: headTop(c.ow) }),
  },
  // 17 "Please." YOU drops to his knees
  17: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.you = person(W, 'you'); c.ow = person(W, 'owner'); c.O.glow.material.opacity = 0.6; c.O.doorLight.intensity = 4; return c; },
    update(W, c, lt) {
      standAt(c.you, MX + 0.05, 1.3, Math.PI, STEP_Y); c.you.p.kneel = easeOut(clamp(lt / 0.3)); face(c.you, 'wide', 'worried', 'frown', { headPitch: 0.35 }); pray(c.you, 0.95 * c.you.p.kneel + 1.25 * (1 - c.you.p.kneel)); c.you.p.handL[1] += STEP_Y; c.you.p.handR[1] += STEP_Y;
      talkIn(W, c.you, lt, 19.69, 20.16);
      standAt(c.ow, MX, DOOR_Z, 0, STEP_Y); face(c.ow, 'open', 'raised', 'o', { lookAt: P3(c.you.headPos()) });
    },
    cam: (W, c, lt) => camAt([MX + 2.4, 1.6, 1.0], [MX, 1.55, 0.85], 48),
  },
  // 18 "I need to poop." close: YOU on his knees, hands together, sweating, looking up
  18: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.you = person(W, 'you'); c.O.glow.material.opacity = 0.6; c.O.doorLight.intensity = 4; return c; },
    update(W, c, lt) { standAt(c.you, MX + 0.05, 1.3, Math.PI, STEP_Y); c.you.p.kneel = 1; face(c.you, 'wide', 'worried', 'frown', { headPitch: 0.42 }); pray(c.you, 0.95); c.you.p.handL[1] += STEP_Y + Math.sin(lt * 9) * 0.015; c.you.p.handR[1] += STEP_Y + Math.sin(lt * 9) * 0.015; talkIn(W, c.you, lt, 20.16, 21.6); },
    cam: (W, c, lt) => { const h = c.you.headPos(); return camAt([h.x + 0.12, h.y + 0.55, h.z - 0.62 + lt * 0.05], [h.x, h.y - 0.05, h.z], 42); },
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, -1) }),
  },
  // 19 "He looks at you." the OWNER looks down (from YOU's low point of view)
  19: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.ow = person(W, 'owner'); c.O.glow.material.opacity = 0.6; c.O.doorLight.intensity = 4; return c; },
    update(W, c, lt) { standAt(c.ow, MX, DOOR_Z, 0, STEP_Y); face(c.ow, 'open', 'neutral', 'neutral', { headPitch: -0.38, pupils: [0, -0.5] }); },
    cam: (W, c, lt) => headCam(c.ow, 0.85, -0.45, 0.05, -0.02, 40),
  },
  // 20 "Then he smiles." slow zoom on his face: the smile
  20: {
    build(W) { const c = outside(W, { doorOpen: 1 }); c.ow = person(W, 'owner'); c.O.glow.material.opacity = 0.6; c.O.doorLight.intensity = 4; return c; },
    update(W, c, lt) { standAt(c.ow, MX, DOOR_Z, 0, STEP_Y); const k = lt > 0.55; face(c.ow, k ? 'happy' : 'open', k ? 'raised' : 'neutral', k ? 'smile' : 'neutral', { headPitch: -0.32, headRoll: k ? 0.08 : 0 }); },
    cam: (W, c, lt) => headCam(c.ow, lerp(0.95, 0.5, easeInOut(lt / 1.63)), -0.3, 0.02, -0.01, 40),
    anchors: (W, c) => ({ smile: hl(c.ow, 0.03, -0.05, 0.09) }),
  },
  // 21 "Bathroom's upstairs." inside the marble hall: the OWNER points up the golden stairs
  21: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.ow = person(W, 'owner'); return c; },
    update(W, c, lt) {
      standAt(c.ow, HX + 1.0, 1.4, yawTo([HX + 1.0, 1.4], [HX - 0.3, 2.9])); face(c.ow, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); talkIn(W, c.ow, lt, 24.91, 26.1);
      c.ow.p.handR = [HX + 1.35, 2.45, 1.0]; c.ow.p.handPoseR = 'point';
      standAt(c.you, HX - 0.3, 2.9, yawTo([HX - 0.3, 2.9], [HX + 1.0, 1.4])); face(c.you, 'wide', 'raised', 'o', { lookAt: [HX, 3.5, -4] }); holdTummy(c.you, 1);
    },
    cam: (W, c, lt) => camAt([HX - 0.9, 1.6, 4.9], [HX + 0.6, 1.85, 0.8], 48),
  },
  // 22 (upstairs) the golden stairs, glowing
  22: {
    build(W) { const c = hall(W); return c; },
    update() {},
    cam: (W, c, lt) => camAt([HX + 0.4, 0.55, 2.6 - lt * 0.4], [HX, 3.6, -6.5], 52),
    anchors: () => ({ top: [HX, 4.0, -6.5], stairs: [HX, 1.6, -3.0] }),
  },
  // 23 "You're so happy," YOU: huge grin, arms up, a happy jump
  23: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, HX + 0.3, 2.4, 0.5); c.you.p.y = Math.abs(Math.sin(lt * 7)) * 0.08; face(c.you, 'happy', 'raised', 'laugh'); handsUp(c.you, 1); },
    cam: (W, c, lt) => headCam(c.you, 1.3, -0.15, 0.0, -0.12, 46),
    anchors: (W, c) => ({ head: headTop(c.you) }),
  },
  // 24 "you kiss him." MWAH! on the cheek; the OWNER's eyes go wide
  24: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.ow = person(W, 'owner'); return c; },
    update(W, c, lt) {
      standAt(c.ow, HX + 0.8, 2.2, -Math.PI / 2 + 0.25); face(c.ow, lt > 0.35 ? 'wide' : 'open', 'raised', lt > 0.35 ? 'o' : 'smile');
      const k = smooth(clamp((lt - 0.05) / 0.25));
      standAt(c.you, HX + 0.8 - lerp(0.62, 0.4, k), 2.2 - lerp(0.0, 0.08, k), Math.PI / 2 - 0.1); face(c.you, k > 0.6 ? 'closed' : 'happy', 'raised', 'o', { lean: k * 0.22, lookAt: P3(cheek(c.ow, -1)) });
      c.you.p.handL = P3(c.ow.chestPos().add(V(-0.06, 0.12, -0.12))); c.you.p.handPoseL = 'flat';
    },
    cam: (W, c, lt) => camAt([HX + 0.6, 1.62, 3.55 - lt * 0.12], [HX + 0.58, 1.6, 2.2], 34),
    anchors: (W, c) => ({ cheek: cheek(c.ow, -1), head: headTop(c.ow) }),
  },
  // 25 "Then you" the OWNER's eyes POP into hearts: BA-DUM!
  25: {
    build(W) { const c = hall(W); c.ow = person(W, 'owner'); return c; },
    update(W, c, lt) { standAt(c.ow, HX + 0.8, 2.2, 0.3); face(c.ow, 'open', 'raised', 'smile', { headRoll: 0.1 }); heartEyes(c.ow, lt, 0.1); },
    cam: (W, c, lt) => headCam(c.ow, 0.62 - lt * 0.1, -0.02, 0, 0, 40),
    anchors: (W, c) => ({ head: headTop(c.ow), eyes: c.ow.eyePos() }),
  },
  // 26 "run." YOU sprints up the golden stairs: speed lines
  26: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      const p = MS.stairPoint(lerp(0.05, 0.9, lt / 0.94)); standAt(c.you, p[0] - 0.2, p[2] + 0.1, Math.PI, p[1]);
      c.you.p.walk = lt * 24; c.you.p.lean = 0.25; face(c.you, 'wide', 'worried', 'grimace'); holdTummy(c.you, 1);
    },
    cam: (W, c, lt) => camAt([HX + 3.6, 1.7 + lt * 1.0, 0.6 - lt * 1.4], [HX - 0.1, 1.3 + lt * 1.8, -1.5 - lt * 2.0], 52),
    anchors: (W, c) => ({ you: c.you.chestPos() }),
  },
  // 27 "Golden toilet." the shiny GOLDEN toilet glowing under a chandelier; YOU amazed in the door
  27: {
    build(W) { const c = bath(W); return c; },
    update() {},
    cam: (W, c, lt) => camAt([BX - 0.35, 1.3, 1.5 - lt * 0.3], [BX + 0.02, 0.72, -1.9], 46),
    anchors: () => ({ toilet: MS.bathToilet() }),
  },
  // 28 "You poop." the camera looks away: the closed bathroom door upstairs. PLOP!
  28: {
    build(W) { const c = hall(W); return c; },
    update() {},
    after(W, c, lt) { c.H.bdoor.rotation.z = lt > 0.35 && lt < 0.55 ? Math.sin(lt * 80) * 0.006 : 0; },
    cam: (W, c, lt) => camAt([HX + 0.9, MS.HA.top + 1.55, -5.4], [HX, MS.HA.top + 1.25, -7.9], 46),
    anchors: () => ({ door: [HX, MS.HA.top + 1.4, -7.9] }),
  },
  // 29 "The chandelier" the big chandelier shakes
  29: {
    build(W) { const c = hall(W); return c; },
    update() {},
    after(W, c, lt) { const k = Math.exp(-lt * 0.6); c.H.chand.rotation.z = Math.sin(lt * 11) * 0.12 * k; c.H.chand.rotation.x = Math.sin(lt * 8 + 1) * 0.08 * k; },
    cam: (W, c, lt) => camAt([HX + 1.6, 6.0, 3.6], [HX, 7.5, 0.6], 42),
    anchors: () => ({ chand: [HX, 7.4, 0.6] }),
  },
  // 30 "shakes." wide: the chandelier swinging, the butler looks up
  30: {
    build(W) { const c = hall(W); c.bu = person(W, 'butler'); return c; },
    update(W, c, lt) { standAt(c.bu, HX + 2.4, 2.6, -2.6); face(c.bu, 'wide', 'raised', 'o', { lookAt: [HX, 7.4, 0.6] }); },
    after(W, c, lt) { c.H.chand.rotation.z = Math.sin(lt * 10 + 2) * 0.1; c.H.chand.rotation.x = Math.sin(lt * 7 + 3) * 0.06; },
    cam: (W, c, lt) => camAt([HX + 5.6, 1.9, 6.2], [HX + 0.5, 3.9, -0.6], 56),
    anchors: () => ({ chand: [HX, 7.4, 0.6] }),
  },
  // 31 "You come downstairs." relieved, happy steps down the golden stairs
  31: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { const p = MS.stairPoint(lerp(0.75, 0.3, lt / 1.43)); standAt(c.you, p[0] + 0.2, p[2] + 0.18, 0, p[1]); c.you.p.walk = lt * 9; face(c.you, 'happy', 'raised', 'smile'); },
    cam: (W, c, lt) => { const h = c.you.headPos(); return camAt([HX + 1.3, 1.5, 3.4], [h.x, h.y - 0.4, h.z], 44); },
    anchors: (W, c) => ({ head: headTop(c.you) }),
  },
  // 32 "He's still smiling." the OWNER at the bottom of the stairs, heart eyes, hearts
  32: {
    build(W) { const c = hall(W); c.ow = person(W, 'owner'); return c; },
    update(W, c, lt) { standAt(c.ow, HX + 0.5, 0.6, Math.PI); face(c.ow, 'open', 'raised', 'smile', { headPitch: 0.25, headRoll: 0.08 }); heartEyes(c.ow, lt, 0.0); },
    cam: (W, c, lt) => { const h = c.ow.headPos(); return camAt([h.x - 0.1, h.y + 0.35, h.z - 1.05 + lt * 0.15], [h.x, h.y - 0.08, h.z], 42); },
    anchors: (W, c) => ({ head: headTop(c.ow), eyes: c.ow.eyePos() }),
  },
  // 33 "Day two." the candle-light dinner table
  33: {
    build(W) { const c = dining(W); return c; },
    update() {},
    cam: (W, c, lt) => camAt([DX + 2.4 - lt * 0.3, 1.75, 3.4], [DX, 0.95, 0], 46),
    anchors: () => ({ candles: [DX, 1.35, 0] }),
  },
  // 34 "He invites you" the OWNER pulls out a chair for YOU
  34: {
    build(W) { const c = dining(W); c.you = person(W, 'you'); c.ow = person(W, 'owner'); return c; },
    update(W, c, lt) {
      const k = smooth(clamp(lt / 0.5));
      standAt(c.ow, DX + 2.15, -0.75, -0.6); face(c.ow, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) });
      c.ow.p.handL = [DX + 2.1 + k * 0.15, 1.05, -0.2]; c.ow.p.handR = [DX + 2.1 + k * 0.15, 1.05, 0.2]; c.ow.p.handPoseL = c.ow.p.handPoseR = 'grip';
      standAt(c.you, DX + 1.35, 1.25, yawTo([DX + 1.35, 1.25], [DX + 2.0, 0])); face(c.you, 'wide', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) });
    },
    after(W, c, lt) { const k = smooth(clamp(lt / 0.5)); c.D.chairs[1].position.x = DX + 1.75 + k * 0.25; },
    cam: (W, c, lt) => camAt([DX + 0.1, 1.5, 3.3], [DX + 1.75, 1.1, 0.2], 50),
  },
  // 35 "for dinner." both at the table: YOU eats fast, the OWNER watches, smiling
  35: {
    build(W) { const c = dining(W); c.you = person(W, 'you'); c.ow = person(W, 'owner'); c.fork = S.fork(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, DX + 1.75, 0, -Math.PI / 2); const ch = Math.sin(lt * 18) > 0;
      face(c.you, 'happy', 'raised', ch ? 'chew' : 'grin', { chewPh: ch ? 1 : 0, lean: 0.25 });
      const m = c.you.mouthPos(), F = fwd(c.you.p.rotY), a = Math.max(0, Math.sin(lt * 12));
      c.fork.position.set(m.x + F.x * (0.1 + 0.25 * (1 - a)), m.y - 0.25 * (1 - a), m.z); c.fork.rotation.set(0, 0, Math.PI / 2 + 0.3); c.you.p.gripR = c.fork;
      sitAt(c.ow, DX - 1.75, 0, Math.PI / 2); face(c.ow, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()), headRoll: 0.12 });
      const h = c.ow.headPos(); c.ow.p.handL = [h.x + 0.08, h.y - 0.15, h.z - 0.05]; c.ow.p.handPoseL = 'flat';
    },
    cam: (W, c, lt) => camAt([DX - 2.55, 1.5, 0.62], [DX + 1.5, 1.08, -0.08], 42),
  },
  // 36 "Day thirty." the front door opens: YOU strolls in, a towel on his shoulder
  36: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.tw = MS.towel(W.scene); return c; },
    update(W, c, lt) { standAt(c.you, HX + 0.1, lerp(6.3, 4.6, lt / 1.2), Math.PI); c.you.p.walk = lt * 8; face(c.you, 'happy', 'raised', 'smile', { headRoll: 0.08 }); },
    after(W, c, lt) { const k = easeOut(clamp(lt / 0.4)); c.H.frontL.rotation.y = k * 1.3; c.H.frontR.rotation.y = -k * 1.3; const p = hl(c.you, -0.13, -0.17, -0.02); c.tw.position.copy(p); c.tw.rotation.set(0, c.you.p.rotY, 0.15); },
    cam: (W, c, lt) => camAt([HX - 1.1, 1.55, 1.2], [HX + 0.1, 1.45, 5.6], 50),
  },
  // 37 "You use his bathroom" YOU strolls past the BUTLER with his towel
  37: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.bu = person(W, 'butler'); c.tw = MS.towel(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, HX + lerp(0.9, 0.2, lt / 1.13), lerp(4.0, 2.6, lt / 1.13), Math.PI + 0.45); c.you.p.walk = lt * 8; face(c.you, 'happy', 'raised', 'smile');
      standAt(c.bu, HX - 0.5, 3.3, 1.2); face(c.bu, 'squint', 'angry', 'tight', { lookAt: P3(c.you.headPos()) });
    },
    after(W, c, lt) { const p = hl(c.you, -0.13, -0.17, -0.02); c.tw.position.copy(p); c.tw.rotation.set(0, c.you.p.rotY, 0.15); },
    cam: (W, c, lt) => camAt([HX - 0.2, 1.6, 6.2], [HX + 0.0, 1.35, 3.0], 46),
  },
  // 38 "every day." the BUTLER rolls his eyes
  38: {
    build(W) { const c = hall(W); c.bu = person(W, 'butler'); return c; },
    update(W, c, lt) { standAt(c.bu, HX - 0.8, 3.4, 0.9); const a = lt * 5.5; face(c.bu, 'stare', 'skeptic', 'tight', { pupils: lt > 0.15 ? [Math.sin(a), Math.cos(a) * 0.6 + 0.4] : [0, 0], headPitch: 0.12, headRoll: -0.08 }); },
    cam: (W, c, lt) => headCam(c.bu, 0.58, -0.01, 0.02, -0.01, 40),
  },
  // 39 "Day sixty." the big cosy couch in the evening: YOU alone, watching TV
  39: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, ...couchSeat(1.5), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, 'open', 'neutral', 'smile', { lean: -0.12 }); },
    cam: (W, c, lt) => camAt([HX - 7.7, 1.55, 4.0 - lt * 0.2], [HX - 4.4, 0.95, 1.6], 48),
  },
  // 40 "You fall asleep" a big yawn, the eyes close
  40: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, ...couchSeat(1.5), -Math.PI / 2); c.you.p.y = 0.14; const y = lt < 0.45; face(c.you, y ? 'squint' : 'closed', 'raised', y ? 'yell' : 'o', { lean: -0.2, headRoll: lerp(0, 0.35, smooth(clamp((lt - 0.4) / 0.35))), headPitch: y ? 0.2 : -0.1 }); },
    cam: (W, c, lt) => headCam(c.you, 0.95, -0.12, 0.05, -0.05, 42),
  },
  // 41 "on his couch." asleep on the big couch: Zzz
  41: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, ...couchSeat(1.5), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, 'closed', 'neutral', 'o', { lean: -0.25, headRoll: 0.4, headPitch: -0.12, leanSide: 0.15 }); },
    cam: (W, c, lt) => camAt([HX - 7.5 + lt * 0.25, 1.5, 0.2], [HX - 4.4, 0.95, 1.6], 48),
    anchors: (W, c) => ({ head: headTop(c.you) }),
  },
  // 42 "You wake up" ECU: the eyes open
  42: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, lt > 0.25 ? 'open' : 'closed', 'raised', 'o', { headRoll: 0.42, leanSide: 0.25 });
      sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14; face(c.ow, 'closed', 'neutral', 'smile', { headRoll: -0.1 });
    },
    cam: (W, c, lt) => headCam(c.you, 0.42, 0.0, 0.0, 0.0, 40),
  },
  // 43 "cuddling him." both cuddled up on the couch under a blanket
  43: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); c.ow = person(W, 'ownerHome'); c.bl = MS.blanket(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, 'wide', 'raised', 'o', { headRoll: 0.42, leanSide: 0.25 });
      sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14; face(c.ow, 'closed', 'neutral', 'smile', { headRoll: -0.12, leanSide: -0.08 });
      const sh = c.you.chestPos(); c.ow.p.handR = [sh.x + 0.05, sh.y + 0.08, sh.z - 0.15]; c.ow.p.handPoseR = 'flat';
    },
    after(W, c) { c.bl.position.set(HX + COUCH[0] - 0.42, 0.8, COUCH[1] + 0.1); c.bl.rotation.set(0, Math.PI / 2, 0); c.bl.scale.set(0.75, 1, 0.55); },
    cam: (W, c, lt) => camAt([HX - 6.2 + lt * 0.15, 3.0, 1.6], [HX - 4.5, 0.85, 1.6], 46),
  },
  // 44 "Neither of you" YOU's eyes POP into hearts
  44: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, 'open', 'raised', 'smile', { headRoll: 0.42, leanSide: 0.25 }); heartEyes(c.you, lt, 0.12);
      sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14; face(c.ow, 'closed', 'neutral', 'smile');
    },
    cam: (W, c, lt) => headCam(c.you, 0.5, 0.0, 0.0, 0.0, 40),
    anchors: (W, c) => ({ head: headTop(c.you), eyes: c.you.eyePos() }),
  },
  // 45 "moves." both with heart eyes, not moving, hearts floating
  45: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'you'); c.ow = person(W, 'ownerHome'); c.bl = MS.blanket(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; face(c.you, 'open', 'raised', 'smile', { headRoll: 0.42, leanSide: 0.25 }); heartEyes(c.you, lt, 0);
      sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14; face(c.ow, 'open', 'raised', 'smile', { headRoll: -0.12 }); heartEyes(c.ow, lt, 0.05);
    },
    after(W, c) { c.bl.position.set(HX + COUCH[0] - 0.42, 0.8, COUCH[1] + 0.1); c.bl.rotation.set(0, Math.PI / 2, 0); c.bl.scale.set(0.75, 1, 0.55); },
    cam: (W, c, lt) => { const m = c.you.headPos().lerp(c.ow.headPos(), 0.5); return camAt([m.x - 1.75 + lt * 0.12, m.y - 0.08, m.z], [m.x, m.y - 0.1, m.z], 40); },
    anchors: (W, c) => ({ head: headTop(c.you), head2: headTop(c.ow) }),
  },
  // 46 "Day one hundred." YOU, clean and shaved, at the door with ONE tiny bag; the OWNER opens his arms
  46: {
    build(W) { const c = outside(W, { night: false, doorOpen: 1 }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); c.bag = MS.tinyBag(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, MX - 0.1, 1.5, Math.PI - 0.15, STEP_Y); face(c.you, 'happy', 'raised', 'grin');
      const hp = rel(c.you, 0.12, -0.28, 0.72 + STEP_Y); c.bag.position.set(hp[0], hp[1] - 0.2, hp[2]); c.you.p.gripR = c.bag;
      standAt(c.ow, MX + 0.1, DOOR_Z, 0, STEP_Y); face(c.ow, 'happy', 'raised', 'grin'); handsUp(c.ow, 0.55); c.ow.p.handL[1] += STEP_Y; c.ow.p.handR[1] += STEP_Y;
    },
    cam: (W, c, lt) => camAt([MX + 1.1, 1.5, 4.6 - lt * 0.2], [MX, 1.7, 0.8], 46),
    anchors: (W, c) => ({ bag: c.bag.position.clone() }),
  },
  // 47 "You move in." the huge hall, and YOU unpacks his tiny bag: one sock, one toothbrush
  47: {
    build(W) { const c = hall(W); c.you = person(W, 'youClean'); c.bag = MS.tinyBag(W.scene); c.sock = MS.sock(W.scene); c.tb = MS.toothbrush(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, HX + 0.6, 2.4, 0); face(c.you, 'happy', 'raised', 'grin');
      const k = smooth(clamp(lt / 0.5)); c.you.p.handL = rel(c.you, 0.3, 0.25, lerp(0.9, 1.55, k)); c.you.p.handR = rel(c.you, 0.3, -0.25, lerp(0.9, 1.55, k)); c.you.p.handPoseL = c.you.p.handPoseR = 'grip';
    },
    after(W, c, lt) {
      c.bag.position.set(HX + 0.6, 0, 2.85);
      const L = c.you.handPos('L'), R = c.you.handPos('R'); c.sock.position.set(L.x, L.y - 0.02, L.z + 0.02); c.tb.position.set(R.x, R.y - 0.05, R.z + 0.02); c.tb.rotation.z = 0.3;
    },
    cam: (W, c, lt) => camAt([HX + 0.6, 1.4, 5.3 - lt * 0.3], [HX + 0.6, 1.1, 2.4], 48),
  },
  // 48 "Day two hundred." Paris: the Eiffel Tower at sunset
  48: {
    build(W) { const c = paris(W); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) { standAt(c.you, PX - 0.3, 2.0, Math.PI); standAt(c.ow, PX + 0.3, 2.0, Math.PI); face(c.you, 'open', 'raised', 'smile', { headPitch: 0.4 }); face(c.ow, 'open', 'raised', 'smile', { headPitch: 0.4 }); },
    cam: (W, c, lt) => camAt([PX + 0.6, 1.0 + lt * 0.3, 7.5], [PX, 9 + lt * 2.0, -42], 56),
    anchors: () => ({ tower: [PX, 22, -42] }),
  },
  // 49 "A trip to Paris." both in front of the Eiffel Tower, arm in arm
  49: {
    build(W) { const c = paris(W); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      standAt(c.you, PX - 0.32, 2.0, 0.15); standAt(c.ow, PX + 0.32, 2.0, -0.15);
      face(c.you, 'happy', 'raised', 'grin', { headRoll: 0.12 }); face(c.ow, 'happy', 'raised', 'grin', { headRoll: -0.1 });
      const e = c.ow.chestPos(); c.you.p.handR = [e.x - 0.1, e.y - 0.18, e.z + 0.05]; c.you.p.handPoseR = 'flat';
      c.ow.p.handL = P3(c.you.chestPos().add(V(0.05, 0.12, -0.05))); c.ow.p.handPoseL = 'flat';
      c.you.p.handL = rel(c.you, 0.25, 0.32, 1.95); c.you.p.handPoseL = 'scissors';
    },
    cam: (W, c, lt) => camAt([PX + 0.2, 1.25, 5.4 - lt * 0.25], [PX, 2.6, 0], 52),
  },
  // 50 "You:" YOU turns to him
  50: {
    build(W) { const c = paris(W); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) { standAt(c.you, PX - 0.3, 2.0, 0.5); standAt(c.ow, PX + 0.3, 2.0, -0.5); face(c.you, 'happy', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) }); face(c.ow, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); },
    cam: (W, c, lt) => lookCam(c.you, P3(c.ow.headPos()), 0.62, 40, 1.2),
  },
  // 51 "I love you." YOU says it: big pulsing hearts
  51: {
    build(W) { const c = paris(W); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) { standAt(c.you, PX - 0.3, 2.0, 0.5); standAt(c.ow, PX + 0.3, 2.0, -0.5); face(c.you, 'open', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) }); heartEyes(c.you, lt, 0.05); talkIn(W, c.you, lt, 56.77, 57.6); face(c.ow, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); },
    cam: (W, c, lt) => lookCam(c.you, P3(c.ow.headPos()), 0.55, 40, 1.2),
    anchors: (W, c) => ({ head: headTop(c.you), eyes: c.you.eyePos() }),
  },
  // 52 "I love you more." both faces, giant pulsing hearts
  52: {
    build(W) { const c = paris(W); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      standAt(c.you, PX - 0.21, 2.0, Math.PI / 2 - 0.25); standAt(c.ow, PX + 0.21, 2.0, -Math.PI / 2 + 0.25);
      face(c.you, 'open', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) }); face(c.ow, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) });
      heartEyes(c.you, lt, 0); heartEyes(c.ow, lt, 0.06); talkIn(W, c.ow, lt, 57.92, 58.95);
    },
    cam: (W, c, lt) => { const a = c.you.headPos(), b = c.ow.headPos(); const m = a.clone().lerp(b, 0.5); return camAt([m.x, m.y - 0.03, m.z + 1.3 - lt * 0.12], [m.x, m.y - 0.03, m.z], 40); },
    anchors: (W, c) => ({ mid: c.you.headPos().lerp(c.ow.headPos(), 0.5).add(V(0, 0.12, 0)), head: headTop(c.you), head2: headTop(c.ow) }),
  },
  // 53 "Day three hundred" the hall at night: candles + rose petals
  53: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.you = person(W, 'youClean'); return c; },
    update(W, c, lt) { standAt(c.you, HX - 0.2, 2.2, 0.2); face(c.you, 'wide', 'raised', 'o'); },
    cam: (W, c, lt) => camAt([HX + 2.6, 2.4, 6.2 - lt * 0.3], [HX - 0.2, 0.8, 2.2], 50),
  },
  // 54 "sixty-five." the OWNER (black suit) walks up, a hand behind his back
  54: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerWed'); return c; },
    update(W, c, lt) {
      standAt(c.you, HX - 0.2, 2.2, 0.6); face(c.you, 'open', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) });
      const k = lt / 1.34; standAt(c.ow, HX + lerp(1.6, 0.55, k), lerp(3.6, 2.9, k), -2.2); c.ow.p.walk = lt * 7; face(c.ow, 'open', 'worried', 'smile', { lookAt: P3(c.you.headPos()) });
      c.ow.p.handR = rel(c.ow, -0.18, -0.05, 1.0); c.ow.p.handPoseR = 'fist';
    },
    cam: (W, c, lt) => camAt([HX + 0.15, 1.5, 6.3], [HX + 0.4, 1.3, 2.6], 48),
  },
  // 55 "He gets down" he goes down on one knee
  55: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerWed'); return c; },
    update(W, c, lt) {
      standAt(c.you, HX - 0.2, 2.2, 0.75); face(c.you, 'wide', 'raised', 'o', { lookAt: P3(c.ow.headPos()) });
      standAt(c.ow, HX + 0.55, 2.75, -2.3); c.ow.p.kneel = easeOut(clamp(lt / 0.45)); c.ow.p.kneelOne = true; face(c.ow, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) });
      c.ow.p.handR = rel(c.ow, -0.18, -0.05, lerp(1.0, 0.6, c.ow.p.kneel)); c.ow.p.handPoseR = 'fist';
    },
    cam: (W, c, lt) => camAt([HX + 2.4, 1.3, 4.6], [HX + 0.2, 1.0, 2.4], 50),
  },
  // 56 "on one knee." YOU gasps, hands on his cheeks
  56: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.you = person(W, 'youClean'); return c; },
    update(W, c, lt) { standAt(c.you, HX - 0.2, 2.2, 0.75); face(c.you, 'wide', 'raised', 'o', { headPitch: -0.3 }); handsOnCheeks(c.you); },
    cam: (W, c, lt) => headCam(c.you, 0.75, -0.25, 0, -0.02, 42),
    anchors: (W, c) => ({ head: headTop(c.you) }),
  },
  // 57 "The ring is made" he opens the little box (seen from above, YOU's view)
  57: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.ow = person(W, 'ownerWed'); c.box = MS.ringBox(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.ow, HX + 0.55, 2.75, -2.3); c.ow.p.kneel = 1; c.ow.p.kneelOne = true; face(c.ow, 'open', 'raised', 'grin', { headPitch: 0.4 });
      const p = rel(c.ow, 0.42, 0.0, 1.05); c.box.position.set(...p); c.box.rotation.y = c.ow.p.rotY; c.ow.p.gripR = c.box; c.ow.p.handL = [p[0], p[1] - 0.04, p[2]]; c.ow.p.handPoseL = 'flat';
    },
    after(W, c, lt) { c.box.userData.lid.rotation.x = -easeOutBack(clamp((lt - 0.1) / 0.35)) * 1.9; },
    cam: (W, c, lt) => { const b = c.box.position; return camAt([b.x - 0.55, b.y + 0.75, b.z - 0.6], [b.x, b.y - 0.25, b.z], 46); },
    anchors: (W, c) => ({ ring: c.box.userData.ring.getWorldPosition(V()).add(V(0, 0.04, 0)) }),
  },
  // 58 "of toilet paper." ECU: the ring is a toilet-paper ring
  58: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.ow = person(W, 'ownerWed'); c.box = MS.ringBox(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.ow, HX + 0.55, 2.75, -2.3); c.ow.p.kneel = 1; c.ow.p.kneelOne = true; face(c.ow, 'open', 'raised', 'grin', { headPitch: 0.4 });
      const p = rel(c.ow, 0.42, 0.0, 1.05); c.box.position.set(...p); c.box.rotation.y = c.ow.p.rotY; c.ow.p.gripR = c.box; c.ow.p.handL = [p[0], p[1] - 0.04, p[2]]; c.ow.p.handPoseL = 'flat';
    },
    after(W, c) { c.box.userData.lid.rotation.x = -1.9; },
    cam: (W, c, lt) => { const r = c.box.userData.ring.getWorldPosition(V()); const F = fwd(c.ow.p.rotY); return camAt([r.x + F.x * 0.24 + 0.02, r.y + 0.1, r.z + F.z * 0.24], [r.x, r.y + 0.025, r.z], 36 - lt * 4); },
    anchors: (W, c) => ({ ring: c.box.userData.ring.getWorldPosition(V()).add(V(0, 0.03, 0)) }),
  },
  // 59 "With a diamond on top." ECU: the sparkling diamond
  59: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.ow = person(W, 'ownerWed'); c.box = MS.ringBox(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.ow, HX + 0.55, 2.75, -2.3); c.ow.p.kneel = 1; c.ow.p.kneelOne = true; face(c.ow, 'open', 'raised', 'grin', { headPitch: 0.4 });
      const p = rel(c.ow, 0.42, 0.0, 1.05); c.box.position.set(...p); c.box.rotation.y = c.ow.p.rotY; c.ow.p.gripR = c.box; c.ow.p.handL = [p[0], p[1] - 0.04, p[2]]; c.ow.p.handPoseL = 'flat';
    },
    after(W, c, lt) { c.box.userData.lid.rotation.x = -1.9; c.box.userData.diamond.rotation.y = lt * 2.5; },
    cam: (W, c, lt) => { const d = c.box.userData.diamond.getWorldPosition(V()); const F = fwd(c.ow.p.rotY); return camAt([d.x + F.x * (0.16 - lt * 0.03), d.y + 0.03, d.z + F.z * (0.16 - lt * 0.03)], [d.x, d.y, d.z], 34); },
    anchors: (W, c) => ({ diamond: c.box.userData.diamond.getWorldPosition(V()) }),
  },
  // 60 "You say yes." YOU cries happy tears, nods, hearts everywhere
  60: {
    build(W) { const c = hall(W, { night: true, candles: true, petals: true }); c.you = person(W, 'youClean'); return c; },
    update(W, c, lt) { standAt(c.you, HX - 0.2, 2.2, 0.75); face(c.you, 'happy', 'sad', 'grin', { headPitch: -0.2 + Math.max(0, Math.sin(lt * 9)) * 0.25 }); if (lt > 0.6) heartEyes(c.you, lt, 0.6); handsOnCheeks(c.you); },
    cam: (W, c, lt) => headCam(c.you, 0.7, -0.15, 0, -0.02, 42),
    anchors: (W, c) => ({ eyeL: hl(c.you, 0.031, -0.005, 0.085), eyeR: hl(c.you, -0.031, -0.005, 0.085), head: headTop(c.you) }),
  },
  // 61 "The wedding." the garden: both in suits under the flower arch, string lights, guests clapping, the BUTLER cries
  61: {
    build(W) {
      const c = garden(W); c.you = person(W, 'youWed'); c.ow = person(W, 'ownerWed'); c.bu = person(W, 'butler');
      c.g = []; for (let i = 0; i < 10; i++) c.g.push(person(W, `guest${i}`)); return c;
    },
    update(W, c, lt) {
      standAt(c.you, GX - 0.45, -1.0, Math.PI / 2 - 0.4); standAt(c.ow, GX + 0.45, -1.0, -Math.PI / 2 + 0.4);
      face(c.you, 'happy', 'raised', 'grin', { lookAt: P3(c.ow.headPos()) }); face(c.ow, 'happy', 'raised', 'grin', { lookAt: P3(c.you.headPos()) });
      const hm = c.you.chestPos().lerp(c.ow.chestPos(), 0.5); c.you.p.handL = [hm.x, hm.y - 0.2, hm.z + 0.12]; c.ow.p.handR = [hm.x, hm.y - 0.2, hm.z + 0.12];
      const seats = [];
      for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) seats.push([GX + sx * (1.1 + k * 0.6), 1.6 + r * 1.0]);
      standAt(c.bu, GX + 1.35, -0.55, -0.35); face(c.bu, 'squint', 'sad', 'frown', { headPitch: -0.08 });
      c.bu.p.handL = P3(hl(c.bu, 0.07, -0.03, 0.09)); c.bu.p.handPoseL = 'grip';
      c.g.forEach((ch, i) => {
        const s2 = seats[[0, 1, 2, 3, 4, 5, 6, 7, 8, 9][i]]; sitAt(ch, ...s2, Math.PI); face(ch, 'happy', 'raised', 'grin');
        const cp = ch.chestPos(), a = Math.abs(Math.sin(lt * 14 + i)) * 0.07; ch.p.handL = [cp.x + a, cp.y + 0.05, cp.z - 0.22]; ch.p.handR = [cp.x - a, cp.y + 0.05, cp.z - 0.22]; ch.p.handPoseL = ch.p.handPoseR = 'flat';
      });
    },
    cam: (W, c, lt) => camAt([GX + 0.9, 1.75, 6.6 - lt * 0.4], [GX, 1.25, -1.0], 46),
    anchors: (W, c) => ({ eyeL: hl(c.bu, 0.031, -0.005, 0.085), eyeR: hl(c.bu, -0.031, -0.005, 0.085), couple: [GX, 2.2, -1.0] }),
  },
  // 62 "Five years later." the mansion on a sunny day; two kids run round the fountain
  62: {
    build(W) { const c = outside(W, { night: false }); c.boy = person(W, 'boy'); c.girl = person(W, 'girl'); return c; },
    update(W, c, lt) {
      const run = (ch, ph) => { const a = lt * 2.2 + ph, r = 3.0; standAt(ch, MX + Math.cos(a) * r, 8.5 + Math.sin(a) * r, Math.atan2(-Math.sin(a), Math.cos(a))); ch.p.walk = lt * 20; face(ch, 'happy', 'raised', 'laugh'); };
      run(c.boy, 0.4); run(c.girl, 1.4);
    },
    cam: (W, c, lt) => camAt([MX + 0.8 - lt * 0.3, 2.8, 26], [MX, 4.2, 3], 50),
  },
  // 63 "Two kids." the boy and the girl run round the marble hall, laughing
  63: {
    build(W) { const c = hall(W); c.boy = person(W, 'boy'); c.girl = person(W, 'girl'); return c; },
    update(W, c, lt) {
      const run = (ch, ph, r) => { const a = lt * 3.0 + ph; standAt(ch, HX + 0.4 + Math.cos(a) * r, 2.3 + Math.sin(a) * r * 0.7, Math.atan2(-Math.sin(a), Math.cos(a) * 0.7)); ch.p.walk = lt * 22; face(ch, 'happy', 'raised', 'laugh'); ch.p.handL = rel(ch, 0.15, 0.25, 1.15 * ch.s); ch.p.handR = rel(ch, 0.15, -0.25, 1.15 * ch.s); ch.p.handPoseL = ch.p.handPoseR = 'open'; };
      run(c.boy, 0.2, 1.1); run(c.girl, 2.6, 1.0);
    },
    cam: (W, c, lt) => camAt([HX + 2.4, 1.2, 5.6], [HX + 0.4, 0.75, 2.2], 50),
  },
  // 64 "One golden toilet." still sparkling (+ a tiny golden potty next to it)
  64: {
    build(W) { const c = bath(W); const pt = MS.goldToilet(c.B.g, 0.75, -1.95, -0.2, 0.55); return c; },
    update() {},
    cam: (W, c, lt) => camAt([BX + 0.6, 1.0, 0.9 - lt * 0.25], [BX + 0.2, 0.62, -1.95], 46),
    anchors: () => ({ toilet: MS.bathToilet(), potty: [BX + 0.75, 0.32, -1.95] }),
  },
  // 65 "And every night," the mansion at night, warm windows
  65: {
    build(W) { const c = outside(W, { night: true }); return c; },
    update() {},
    cam: (W, c, lt) => camAt([MX - 0.9 + lt * 0.5, 2.6, 26], [MX, 5.0, 0], 50),
    anchors: () => ({ mansion: [MX, 7.5, 0] }),
  },
  // 66 "you cuddle on the same couch." the whole family on the couch, watching TV (pull back)
  66: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); c.boy = person(W, 'boy'); c.girl = person(W, 'girl'); c.bl = MS.blanket(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(0.6), -Math.PI / 2); c.you.p.y = 0.14; sitAt(c.ow, ...couchSeat(2.4), -Math.PI / 2); c.ow.p.y = 0.14;
      sitAt(c.boy, ...couchSeat(1.2), -Math.PI / 2); c.boy.p.y = 0.14; sitAt(c.girl, ...couchSeat(1.8), -Math.PI / 2); c.girl.p.y = 0.14;
      face(c.you, 'happy', 'raised', 'smile', { headRoll: 0.15 }); face(c.ow, 'happy', 'raised', 'smile', { headRoll: -0.15 });
      face(c.boy, 'open', 'raised', 'o'); face(c.girl, 'open', 'raised', 'smile');
      c.you.p.handR = P3(c.boy.headPos().add(V(0, 0.08, -0.05))); c.you.p.handPoseR = 'flat';
      c.ow.p.handL = P3(c.girl.headPos().add(V(0, 0.08, 0.05))); c.ow.p.handPoseL = 'flat';
    },
    after(W, c) { c.bl.position.set(HX + COUCH[0] - 0.42, 0.78, COUCH[1]); c.bl.rotation.set(0, Math.PI / 2, 0); c.bl.scale.set(1.2, 1, 0.55); },
    cam: (W, c, lt) => camAt([HX - 6.3 - lt * 0.9, 1.35 + lt * 0.2, 1.6], [HX - 4.3, 1.05, 1.6], 50),
  },
  // 67 "You still love him." YOU with heart eyes, looking at him
  67: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14;
      face(c.you, 'open', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) }); heartEyes(c.you, lt, 0.15); face(c.ow, 'open', 'raised', 'smile', { headYaw: -0.2 });
    },
    cam: (W, c, lt) => lookCam(c.you, P3(c.ow.headPos()), 0.6, 40, 1.4),
    anchors: (W, c) => ({ head: headTop(c.you), eyes: c.you.eyePos() }),
  },
  // 68 "He still loves you." both with heart eyes, smiling at each other
  68: {
    build(W) { const c = hall(W, { night: true }); c.you = person(W, 'youClean'); c.ow = person(W, 'ownerHome'); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...couchSeat(1.15), -Math.PI / 2); c.you.p.y = 0.14; sitAt(c.ow, ...couchSeat(1.85), -Math.PI / 2); c.ow.p.y = 0.14;
      face(c.you, 'open', 'raised', 'smile', { lookAt: P3(c.ow.headPos()) }); face(c.ow, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) });
      heartEyes(c.you, lt, 0); heartEyes(c.ow, lt, 0.1);
    },
    cam: (W, c, lt) => { const m = c.you.headPos().lerp(c.ow.headPos(), 0.5); return camAt([m.x - 1.05 + lt * 0.12, m.y - 0.05, m.z], [m.x, m.y - 0.06, m.z], 40); },
    anchors: (W, c) => ({ head: headTop(c.you), head2: headTop(c.ow), mid: c.you.headPos().lerp(c.ow.headPos(), 0.5).add(V(0, 0.15, 0)) }),
  },
  // 69 "And it all started…" the golden toilet, sparkles
  69: {
    build(W) { const c = bath(W); return c; },
    update() {},
    cam: (W, c, lt) => camAt([BX + 0.25, 1.05, -0.55 - lt * 0.12], [BX, 0.62, -1.95], 44),
    anchors: () => ({ toilet: MS.bathToilet() }),
  },
  // 70 "With one poop." slow zoom out from the golden toilet: sparkles; fade out
  70: {
    build(W) { const c = bath(W); return c; },
    update() {},
    cam: (W, c, lt) => { const k = easeOut(lt / 1.31); return camAt([BX + 0.1 * k, lerp(1.0, 1.75, k), lerp(-0.85, 3.2, k)], [BX, lerp(0.62, 0.9, k), -1.95], lerp(40, 52, k)); },
    anchors: () => ({ toilet: MS.bathToilet() }),
  },
};
