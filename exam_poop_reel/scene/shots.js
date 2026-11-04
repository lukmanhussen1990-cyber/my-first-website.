// The 43 shots of the exam reel as code-made low-poly 3D animations (one entry per shot; every shot is a clip).
// The poop moment: YOU (a grown-up college student) half-stands behind his desk with his trousers down, seen only
// from behind / the side, and a BIG pixel mosaic (S.mosaic -> render.py) covers his hips; the little blob has its
// own mosaic. After that he is fully dressed. The bundle is a white wrapped package; the open box gets a mosaic too.
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './sets.js';
import * as SC from './school.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn, easeOutBack } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const sitAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY }); };
const standAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY, y }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);
const forehead = (ch, side = 0) => hl(ch, side * 0.03, 0.065, 0.08);
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40, roll = 0) => ({ pos: [...pos], target: [...target], fov, roll });
const P3 = (v) => [v.x, v.y, v.z];
const headCam = (ch, dist, dy = 0, dx = 0, ty = 0, fov = 40) => {
  const h = ch.headPos(), f = fwd(ch.p.rotY), l = V(f.z, 0, -f.x);
  const p = h.clone().add(f.multiplyScalar(dist)).add(V(0, dy, 0)).add(l.multiplyScalar(dx));
  return camAt(P3(p), [h.x, h.y + ty, h.z], fov);
};
const rel = (ch, f, l, y) => { const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); return [ch.p.pos[0] + F.x * f + L.x * l, y, ch.p.pos[1] + F.z * f + L.z * l]; };
const talkIn = (W, ch, lt, a, b, k = 1) => { const t = W.t0 + lt; if (t > a && t < b) helpers.talk(ch, t, k); };
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ------------------------------------------------------------------ the exam hall + the class
const H = SC.HALL, TOP = H.top;
const YC = H.you[0], YR = H.you[1];
const YD = SC.deskPos(YC, YR), YS = SC.seatPos(YC, YR);           // his desk (1.1, 0.2), his seat (1.1, 0.7)
const YBOX = [YD[0] + 0.2, TOP, YD[1] - 0.14];                   // his pencil box on the desk
const key = (c, r) => `${c},${r}`;
function hall(W, o = {}) {
  S.lights(W, { sky: 0xfff8ee, ground: 0xc8b090, hemi: o.dim ? 0.8 : 1.1, key: o.warm ? 0xffd8a8 : 0xfff4e4, keyI: 1.25, fillI: 0 });
  S.keyAt(W, [0, 1, -0.5], { from: o.keyFrom || [-6, 8, 3], size: 9 });
  W.scene.background = new THREE.Color('#e8ecd8');
  const c = { H: SC.buildHall(W, o) };
  c.H.youBox.userData.bundle.visible = !!o.bundle;
  return c;
}
// students at the given desks (all but his); seat index -> a fixed look
function students(W, c, list, o = {}) {
  c.st = [];
  for (const [col, row] of list) {
    if (col === YC && row === YR) continue;
    const back = col === H.back[0] && row === H.back[1];
    const ch = person(W, `crowd${(o.seed || 0) + col * 5 + row}`, back ? { female: false, hairStyle: 'messy', skirt: null, H: 1.8, torso: { style: 'hoodie', main: '#2a8ad8' }, sleeve: ['fleece', { color: '#2a8ad8', seed: 4 }], face: { lash: false, blush: undefined } } : {}); ch.seat = [col, row]; c.st.push(ch);
  }
  return c;
}
const ALL = []; H.cols.forEach((_, ci) => H.rows.forEach((__, ri) => ALL.push([ci, ri])));
function writeAll(c, lt, o = {}) {
  c.st.forEach((ch, i) => {
    const [x, z] = SC.seatPos(...ch.seat); sitAt(ch, x, z, Math.PI);
    if (o.look && ch.seat[0] === H.back[0] && ch.seat[1] === H.back[1]) return;
    face(ch, hash1(i) > 0.5 ? 'squint' : 'open', 'neutral', 'tight', { headPitch: -0.42, headYaw: (hash1(i + 3) - 0.5) * 0.2 });
    const d = SC.deskPos(...ch.seat), w = Math.sin(lt * (9 + i % 3) + i) * 0.02;
    ch.p.handR = [d[0] - 0.08 + w, TOP + 0.03, d[1] + 0.06 + Math.cos(lt * 7 + i) * 0.01]; ch.p.handPoseR = 'grip';
    ch.p.handL = [d[0] + 0.15, TOP + 0.02, d[1] + 0.1]; ch.p.handPoseL = 'flat';
  });
}
function youSit(c, o = {}) {
  sitAt(c.you, ...YS, Math.PI);
  c.you.p.handR = [YD[0] - 0.1, TOP + 0.03, YD[1] + 0.08]; c.you.p.handPoseR = 'grip';
  c.you.p.handL = [YD[0] + 0.14, TOP + 0.02, YD[1] + 0.12]; c.you.p.handPoseL = 'flat';
}
// the poop pose: half-standing over the chair, trousers down, hands on the desk
function youHover(c, lt, look = 0) {
  standAt(c.you, YS[0], YS[1] + 0.02, Math.PI); c.you.p.sit = 0.42; c.you.p.lean = 0.28;
  c.you.p.handL = [YD[0] + 0.22, TOP + 0.03, YD[1] + 0.22]; c.you.p.handR = [YD[0] - 0.22, TOP + 0.03, YD[1] + 0.22]; c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
  face(c.you, 'wide', 'worried', 'tight', { headYaw: look });
}
const hips = (ch) => [{ p: ch._w(V(0, -0.02, 0), ch.pelvis), r: 0.26 }, { p: ch._w(V(0, -0.04, -0.1), ch.pelvis), r: 0.22 }];
const boxTop = () => V(YBOX[0], TOP + 0.05, YBOX[2]);
// the teacher: sits at her desk / stands / walks the aisle
const TSEAT = [H.tdesk[0], H.tdesk[1] - 0.62];
function teacher(W, c, o = {}) { c.t = person(W, 'teacher'); if (o.clip) { c.clip = SC.clipboard(W.scene); } return c; }
function holdClip(c) { const t = c.t, p = rel(t, 0.22, 0.12, 1.05); c.clip.position.set(...p); c.clip.rotation.set(-0.5, t.p.rotY, 0); t.p.gripL = c.clip; }

export const SHOTS = {
  // 01 "It's your final exam." wide: a quiet exam hall, ceiling fans, a big wall clock, everyone writing
  1: {
    build(W) { const c = students(W, hall(W), ALL); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { writeAll(c, lt); youSit(c); face(c.you, 'open', 'worried', 'tight', { headPitch: -0.3 }); },
    after(W, c, lt) { c.H.fans.forEach((f, i) => { f.userData.rot.rotation.y = lt * 5 + i; }); c.H.clock.userData.set(lt + 12); },
    cam: (W, c, lt) => camAt([4.6, 2.9, 7.2 - lt * 0.3], [-0.4, 1.0, -2.6], 56),
    anchors: () => ({ clock: [...H.clock] }),
  },
  // 02 "You can't" close: his face, sweating
  2: {
    build(W) { const c = students(W, hall(W), [[1, 2], [3, 2], [2, 1]]); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { writeAll(c, lt); youSit(c); face(c.you, 'wide', 'worried', 'grimace', { headPitch: -0.05 }); },
    cam: (W, c, lt) => headCam(c.you, 0.62 - lt * 0.12, -0.02, 0.05, -0.02, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, -1) }),
  },
  // 03 "hold it anymore" under the desk: his leg shaking. RRRUMBLE
  3: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { youSit(c); c.you.p.legBounce = 1.6; face(c.you, 'squint', 'worried', 'grimace'); },
    cam: (W, c, lt) => camAt([YS[0] + 0.25, 0.42, YD[1] - 0.95], [YS[0], 0.42, YS[1] - 0.2], 50),
    anchors: (W, c) => ({ belly: c.you.bellyPos() }),
  },
  // 04 "And the teacher said" flashback: the strict teacher at the front points at the sign
  4: {
    build(W) { const c = teacher(W, students(W, hall(W), [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]])); return c; },
    update(W, c, lt) {
      writeAll(c, 0); c.st.forEach((ch) => { ch.p.headPitch = 0.1; ch.p.eyes = 'open'; });
      standAt(c.t, 2.55, -5.85, -0.25); face(c.t, 'squint', 'angry', 'tight', { lookAt: [1.0, 1.3, -2.0] });
      c.t.p.handL = [3.05, 1.85, -6.55]; c.t.p.handPoseL = 'point';
    },
    cam: (W, c, lt) => camAt([1.6, 1.5, -3.3 + lt * 0.1], [2.75, 1.55, -6.2], 46),
    anchors: (W, c) => ({ head: c.t.headPos() }),
  },
  // 05 "no toilet breaks." the sign: a toilet icon with a red cross (no text)
  5: {
    build(W) { const c = hall(W); return c; },
    update() {},
    cam: (W, c, lt) => camAt([H.sign[0] - 0.05, H.sign[1] - 0.02, H.sign[2] + 1.75 - lt * 0.3], [...H.sign], 40),
    anchors: () => ({ sign: [...H.sign] }),
  },
  // 06 "So you poop." from behind: half-standing behind his desk, trousers down: BIG mosaic. He looks left and right
  6: {
    build(W) { const c = students(W, hall(W), [[1, 2], [3, 2], [1, 1], [2, 1], [3, 1]]); c.you = person(W, 'youDown'); return c; },
    update(W, c, lt) { writeAll(c, lt); youHover(c, lt, Math.sin(lt * 5.5) * 0.7); },
    cam: (W, c, lt) => camAt([YS[0] + 0.15, 1.25, YS[1] + 2.0 - lt * 0.2], [YS[0], 0.95, YS[1] - 0.2], 46),
    mosaic: (W, c) => hips(c.you),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 07 "Right there." from the side: he looks left and right, nervous (mosaic)
  7: {
    build(W) { const c = students(W, hall(W), [[3, 2], [3, 1], [2, 1], [3, 3]]); c.you = person(W, 'youDown'); return c; },
    update(W, c, lt) { writeAll(c, lt); youHover(c, lt, Math.sin(lt * 6 + 1) * 0.8); },
    cam: (W, c, lt) => camAt([YS[0] + 1.9, 1.15, YS[1] + 0.15], [YS[0], 0.95, YS[1] - 0.05], 44),
    mosaic: (W, c) => hips(c.you),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 08 "At your desk." wide from behind: everyone keeps writing, nobody looks up; him half-squatting (mosaic)
  8: {
    build(W) { const c = students(W, hall(W), ALL.filter(([cc, r]) => r <= 3)); c.you = person(W, 'youDown'); return c; },
    update(W, c, lt) { writeAll(c, lt); youHover(c, lt, Math.sin(lt * 4) * 0.5); },
    after(W, c, lt) { c.H.fans.forEach((f, i) => { f.userData.rot.rotation.y = lt * 5 + i; }); },
    cam: (W, c, lt) => camAt([1.7, 1.9, 4.6 - lt * 0.2], [0.5, 0.9, -1.0], 52),
    mosaic: (W, c) => hips(c.you),
  },
  // 09 "Into toilet paper." low, from the side: the toilet paper on his chair; a small blob drops (own mosaic): PLOP
  9: {
    build(W) { const c = hall(W); c.you = person(W, 'youDown'); c.tp = SC.tpSheet(W.scene, 0.3, 0.34); c.bl = SC.blob(W.scene); return c; },
    update(W, c, lt) { youHover(c, lt, 0); face(c.you, 'squint', 'worried', 'grimace'); },
    after(W, c, lt) {
      c.tp.position.set(YS[0], 0.49, YS[1] + 0.02);
      const b = c.you._w(V(0, -0.07, -0.06), c.you.pelvis), k = easeIn(clamp((lt - 0.55) / 0.3));
      c.bl.position.set(b.x, lerp(b.y, 0.52, k), b.z); c.bl.visible = lt > 0.5; c.bl.scale.set(1, 1 - 0.3 * (k >= 1 ? 1 : 0), 1);
    },
    cam: (W, c, lt) => camAt([YS[0] + 1.55, 1.0, YS[1] + 0.95], [YS[0], 0.56, YS[1] + 0.02], 46),
    mosaic: (W, c, lt) => [...hips(c.you), ...(c.bl.visible ? [{ p: c.bl.position.clone(), r: 0.07 }] : [])],
  },
  // 10 "Nobody saw." slow pan across the class: everyone writing. He sits again, fully dressed
  10: {
    build(W) { const c = students(W, hall(W), ALL); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { writeAll(c, lt); youSit(c); face(c.you, 'open', 'raised', 'smile', { headPitch: -0.35 }); },
    after(W, c, lt) { c.H.fans.forEach((f, i) => { f.userData.rot.rotation.y = lt * 5 + i; }); },
    cam: (W, c, lt) => { const k = easeInOut(lt / 1.18); return camAt([lerp(-4.2, 3.6, k), 1.7, -4.6], [lerp(-3.2, 2.6, k), 0.95, 0.4], 52); },
  },
  // 11 "You think." one guy in the back row slowly turns his head
  11: {
    build(W) { const c = students(W, hall(W), [[0, 4], [1, 4], [2, 4], [1, 3], [0, 3]]); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      writeAll(c, lt, { look: true }); youSit(c);
      const g = c.st.find((ch) => ch.seat[0] === H.back[0] && ch.seat[1] === H.back[1]);
      const k = smooth(clamp((lt - 0.1) / 0.8)); face(g, 'open', 'raised', 'tight', { headYaw: lerp(0, -0.85, k), headPitch: lerp(-0.42, -0.1, k) });
    },
    cam: (W, c, lt) => { const g = c.st.find((ch) => ch.seat[0] === H.back[0] && ch.seat[1] === H.back[1]); const h = g.headPos(); return camAt([h.x + 0.7, h.y + 0.05, h.z - 1.25], [h.x, h.y - 0.08, h.z], 40); },
  },
  // 12 "You wrap it up." close: his hands wrap the bundle in toilet paper, layer after layer: CRINKLE
  12: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.b = SC.tpBundle(W.scene, 1.0); c.sh = SC.tpSheet(W.scene, 0.16, 0.24); c.roll = SC.tpRoll(W.scene); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'squint', 'worried', 'tight', { headPitch: -0.55 });
      const a = lt * 9, p = [YD[0] - 0.02, TOP + 0.06, YD[1] + 0.1];
      c.you.p.handL = [p[0] + 0.1 + Math.cos(a) * 0.03, p[1] + 0.03 + Math.sin(a) * 0.03, p[2]]; c.you.p.handR = [p[0] - 0.1 - Math.cos(a) * 0.03, p[1] + 0.03 - Math.sin(a) * 0.03, p[2]];
      c.you.p.handPoseL = c.you.p.handPoseR = 'grip';
    },
    after(W, c, lt) {
      const p = [YD[0] - 0.02, TOP + 0.0, YD[1] + 0.1]; c.b.position.set(...p); c.b.rotation.y = lt * 2; c.b.scale.setScalar(0.85 + lt * 0.1); c.b.userData.bow.visible = false;
      c.sh.position.set(p[0], p[1] + 0.05, p[2]); c.sh.rotation.set(-Math.PI / 2 + Math.sin(lt * 9) * 0.6, lt * 9, 0);
      c.roll.position.set(YD[0] + 0.25, TOP + 0.05, YD[1] - 0.1); c.roll.rotation.set(0, 0, Math.PI / 2);
    },
    cam: (W, c, lt) => camAt([YD[0] + 0.1, TOP + 0.38, YD[1] - 0.42], [YD[0] - 0.02, TOP + 0.05, YD[1] + 0.1], 42),
    anchors: () => ({ bundle: [YD[0] - 0.02, TOP + 0.08, YD[1] + 0.1] }),
  },
  // 13 "Tight." he squeezes it tight
  13: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.b = SC.tpBundle(W.scene, 1.0); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'squint', 'angry', 'grimace', { headPitch: -0.5 });
      const sq = Math.min(1, lt / 0.25) * 0.025, p = [YD[0] - 0.02, TOP + 0.06, YD[1] + 0.1];
      c.you.p.handL = [p[0] + 0.1 - sq, p[1] + 0.02, p[2]]; c.you.p.handR = [p[0] - 0.1 + sq, p[1] + 0.02, p[2]]; c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
    },
    after(W, c, lt) { const sq = Math.min(1, lt / 0.25); c.b.position.set(YD[0] - 0.02, TOP, YD[1] + 0.1); c.b.scale.set(1.0 - sq * 0.22, 1.0 + sq * 0.12, 1.0); c.b.userData.bow.visible = false; c.b.rotation.y = 0.3; },
    cam: (W, c, lt) => camAt([YD[0] + 0.05, TOP + 0.24, YD[1] - 0.3], [YD[0] - 0.02, TOP + 0.05, YD[1] + 0.1], 40),
    anchors: () => ({ bundle: [YD[0] - 0.02, TOP + 0.08, YD[1] + 0.1] }),
  },
  // 14 "Like a little present." he ties a little bow on top, like a tiny gift
  14: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); c.b = SC.tpBundle(W.scene, 1.0); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'happy', 'raised', 'smile', { headPitch: -0.5 });
      const p = [YD[0] - 0.02, TOP + 0.12, YD[1] + 0.1], k = Math.sin(lt * 12) * 0.015;
      c.you.p.handL = [p[0] + 0.035 + k, p[1] + 0.03, p[2]]; c.you.p.handR = [p[0] - 0.035 - k, p[1] + 0.03, p[2]]; c.you.p.handPoseL = c.you.p.handPoseR = 'pinky';
    },
    after(W, c, lt) { c.b.position.set(YD[0] - 0.02, TOP, YD[1] + 0.1); c.b.scale.set(0.82, 1.1, 1.0); c.b.rotation.y = 0.3; c.b.userData.bow.scale.setScalar(Math.max(0.01, easeOutBack(clamp((lt - 0.5) / 0.35)))); },
    cam: (W, c, lt) => camAt([YD[0] + 0.08, TOP + 0.26, YD[1] - 0.32 + lt * 0.04], [YD[0] - 0.02, TOP + 0.07, YD[1] + 0.1], 40),
    anchors: () => ({ bundle: [YD[0] - 0.02, TOP + 0.12, YD[1] + 0.1] }),
  },
  // 15 "You hide it" he opens his pencil box and pushes the pencils aside
  15: {
    build(W) { const c = hall(W, { bundle: true }); c.you = person(W, 'you'); c.b = SC.tpBundle(W.scene, 0.6); c.b.userData.bow.scale.setScalar(1); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'squint', 'raised', 'tight', { headPitch: -0.5 });
      c.you.p.handL = [YD[0] - 0.25, TOP + 0.02, YD[1] + 0.15]; c.you.p.handPoseL = 'flat';
      c.you.p.handR = [YBOX[0] - 0.08 + clamp(lt / 0.5) * 0.08, TOP + 0.07, YBOX[2] + 0.05]; c.you.p.handPoseR = 'point';
    },
    after(W, c, lt) {
      const box = c.H.youBox; box.userData.lid.rotation.x = -easeOut(clamp(lt / 0.25)) * 1.7; box.userData.bundle.visible = false;
      box.userData.pens.forEach((p, i) => { p.position.z = -0.025 + i * 0.016 - clamp((lt - 0.3) / 0.3) * 0.02; });
      c.b.position.set(YD[0] - 0.08, TOP, YD[1] + 0.12);
    },
    cam: (W, c, lt) => camAt([YBOX[0] - 0.02, TOP + 0.46, YBOX[2] + 0.34], [YBOX[0], TOP + 0.02, YBOX[2] - 0.04], 44),
  },
  // 16 "in your pencil box." he stuffs the bundle in: CLICK, shut
  16: {
    build(W) { const c = hall(W, { bundle: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'squint', 'raised', 'tight', { headPitch: -0.5 });
      const k = clamp(lt / 0.6), b = c.H.youBox.userData.bundle.getWorldPosition(V());
      c.you.p.handR = [b.x + 0.075, b.y + 0.035, b.z + 0.035]; c.you.p.handPoseR = 'flat';
      c.you.p.handL = [YD[0] - 0.25, TOP + 0.02, YD[1] + 0.15]; c.you.p.handPoseL = 'flat';
    },
    after(W, c, lt) {
      const box = c.H.youBox, k = easeIn(clamp(lt / 0.6)); box.userData.bundle.visible = true;
      box.userData.bundle.position.set(lerp(-0.25, 0, k), lerp(0.08, 0.0, k), 0);
      box.userData.lid.rotation.x = lt < 0.8 ? -1.7 : -1.7 * (1 - easeIn(clamp((lt - 0.8) / 0.12)));
      box.userData.pens.forEach((p, i) => { p.position.z = -0.045 + i * 0.016; });
    },
    cam: (W, c, lt) => camAt([YBOX[0] - 0.02, TOP + 0.46, YBOX[2] + 0.34], [YBOX[0], TOP + 0.02, YBOX[2] - 0.04], 44),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 17 "Perfect." a tiny proud nod
  17: {
    build(W) { const c = students(W, hall(W), [[1, 2], [3, 2], [2, 1]]); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { writeAll(c, lt); youSit(c); face(c.you, 'happy', 'raised', 'smile', { headPitch: -0.05 + Math.max(0, Math.sin((lt - 0.3) * 9)) * 0.18 * (lt > 0.3 && lt < 0.65 ? 1 : 0) }); },
    cam: (W, c, lt) => headCam(c.you, 0.62, -0.04, 0.05, -0.03, 40),
    anchors: (W, c) => ({ head: c.you.headPos().add(V(0, 0.15, 0)) }),
  },
  // 18 "Then the teacher" low angle: she rises slowly from her chair
  18: {
    build(W) { const c = teacher(W, hall(W)); return c; },
    update(W, c, lt) { const k = smooth(clamp(lt / 0.77)); Object.assign(c.t.p, { pos: [...TSEAT], rotY: 0, sit: 1 - k }); face(c.t, 'squint', 'angry', 'tight', { headPitch: -0.1 }); c.t.p.handL = [TSEAT[0] + 0.25, 0.8, TSEAT[1] + 0.45]; c.t.p.handR = [TSEAT[0] - 0.25, 0.8, TSEAT[1] + 0.45]; c.t.p.handPoseL = c.t.p.handPoseR = 'flat'; },
    cam: (W, c, lt) => camAt([0.5, 0.55, -3.4], [0.0, 1.4, -6.0], 50),
  },
  // 19 "stands up." her glasses glint: dramatic sting
  19: {
    build(W) { const c = teacher(W, hall(W)); return c; },
    update(W, c, lt) { standAt(c.t, ...TSEAT, 0); face(c.t, 'squint', 'angry', 'tight', { headPitch: -0.12 }); },
    cam: (W, c, lt) => headCam(c.t, 0.75 - lt * 0.15, -0.12, 0.05, 0.0, 40),
    anchors: (W, c) => ({ glasses: c.t.glassesPos(1), glasses2: c.t.glassesPos(-1) }),
  },
  // 20 "Everyone," she speaks to the class
  20: {
    build(W) { const c = teacher(W, hall(W)); return c; },
    update(W, c, lt) { standAt(c.t, 0, -4.9, 0); face(c.t, 'open', 'angry', 'tight', { headPitch: -0.05 }); talkIn(W, c.t, lt, 22.17, 22.95); c.t.p.handR = rel(c.t, 0.35, -0.2, 1.3); c.t.p.handPoseR = 'point'; },
    cam: (W, c, lt) => headCam(c.t, 1.2, -0.25, 0.1, -0.15, 42),
  },
  // 21 "open your pencil boxes." wide: every student opens their pencil box at once
  21: {
    build(W) { const c = students(W, hall(W), ALL.filter(([cc, r]) => r <= 3)); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      const k = clamp((lt - 0.35) / 0.25);
      c.st.forEach((ch, i) => { const [x, z] = SC.seatPos(...ch.seat); sitAt(ch, x, z, Math.PI); face(ch, 'open', 'raised', 'tight', { headPitch: -0.3 }); const b = c.H.boxes[key(...ch.seat)]; const bp = b.position; ch.p.handR = [bp.x, TOP + 0.05 + (1 - k) * 0.02 + k * 0.08, bp.z + 0.02 - k * 0.04]; ch.p.handPoseR = 'flat'; });
      youSit(c); face(c.you, 'wide', 'worried', 'o', { headPitch: -0.25 });
    },
    after(W, c, lt) { const k = easeOut(clamp((lt - 0.35) / 0.25)); for (const [kk, b] of Object.entries(c.H.boxes)) { if (b !== c.H.youBox && +kk.split(',')[1] <= 3) b.userData.lid.rotation.x = -k * 1.7; } },
    cam: (W, c, lt) => camAt([0.2, 2.5, -5.3], [0.4, 0.75, 0.6], 54),
  },
  // 22 "I'm checking for cheat chits." clipboard, glasses
  22: {
    build(W) { const c = teacher(W, hall(W), { clip: true }); return c; },
    update(W, c, lt) { standAt(c.t, 0, -4.4, 0); face(c.t, 'squint', 'angry', 'tight'); talkIn(W, c.t, lt, 24.54, 26.0); holdClip(c); },
    cam: (W, c, lt) => headCam(c.t, 1.35 - lt * 0.12, -0.3, -0.15, -0.2, 44),
    anchors: (W, c) => ({ glasses: c.t.glassesPos(1) }),
  },
  // 23 "She walks down the row." low angle in the aisle: her heels STOMP
  23: {
    build(W) { const c = teacher(W, students(W, hall(W), [[1, 0], [2, 0], [1, 1], [2, 1], [1, 2]]), { clip: true }); return c; },
    update(W, c, lt) { writeAll(c, lt); c.st.forEach((ch) => { ch.p.headPitch = -0.2; }); standAt(c.t, 0, lerp(-4.4, -2.6, lt / 1.65), 0); c.t.p.walk = lt * 5.5; face(c.t, 'squint', 'angry', 'tight'); holdClip(c); },
    cam: (W, c, lt) => camAt([0.15, 0.22, -0.9], [0.0, 0.7, -3.4], 52),
    anchors: (W, c) => ({ heels: [0, 0.1, lerp(-4.4, -2.6, 0.5)] }),
  },
  // 24 "Box by" she bends over a student's open pencil box
  24: {
    build(W) { const c = teacher(W, students(W, hall(W), [[1, 1], [2, 1], [1, 0]]), { clip: true }); return c; },
    update(W, c, lt) {
      c.st.forEach((ch) => { const [x, z] = SC.seatPos(...ch.seat); sitAt(ch, x, z, Math.PI); face(ch, 'wide', 'worried', 'tight', { lookAt: P3(c.t.headPos()) }); });
      standAt(c.t, -0.4, -1.45, -Math.PI / 2 + 0.3); c.t.p.lean = 0.45; face(c.t, 'squint', 'angry', 'tight', { headPitch: -0.4 }); holdClip(c);
    },
    after(W, c, lt) { c.H.boxes[key(1, 1)].userData.lid.rotation.x = -1.7; c.H.boxes[key(1, 0)].userData.lid.rotation.x = -1.7; },
    cam: (W, c, lt) => camAt([0.9, 1.5, -0.2], [-0.7, 1.0, -1.55], 46),
  },
  // 25 "box." his face: sweating more
  25: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { youSit(c); face(c.you, 'wide', 'worried', 'grimace', { headPitch: -0.05, headYaw: -0.3 }); },
    cam: (W, c, lt) => headCam(c.you, 0.52, -0.01, 0.05, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, -1) }),
  },
  // 26 "Getting closer." over his desk: his pencil box with faint stink lines; she comes closer behind
  26: {
    build(W) { const c = teacher(W, students(W, hall(W), [[1, 1], [2, 1], [1, 2]]), { clip: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      writeAll(c, lt); c.st.forEach((ch) => { ch.p.headPitch = -0.15; });
      youSit(c); face(c.you, 'wide', 'worried', 'grimace');
      standAt(c.t, 0, lerp(-1.9, -0.9, lt / 1.98), 0); c.t.p.walk = lt * 5.5; face(c.t, 'squint', 'angry', 'tight', { lookAt: [-1.1, 0.8, -1.4] }); holdClip(c);
    },
    cam: (W, c, lt) => camAt([YBOX[0] + 0.45, TOP + 0.5, YBOX[2] + 0.75], [YBOX[0] - 0.6, TOP + 0.55, YBOX[2] - 1.5], 46),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 27 "What you don't know:" a slow push in on his pencil box
  27: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { youSit(c); face(c.you, 'wide', 'worried', 'tight'); },
    cam: (W, c, lt) => camAt([YBOX[0] - 0.08, TOP + 0.3 - lt * 0.05, YBOX[2] + 0.55 - lt * 0.18], [YBOX[0], TOP + 0.04, YBOX[2]], 40),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // ---------------------------------------------------------------- old England (sepia, old film)
  28: { build(W) { return england(W, 4); }, update(W, c, lt) { miners(c, lt, 'walk'); }, cam: (W, c, lt) => camAt([EX + 4.5 - lt * 0.6, 2.2, 7.5], [EX, 1.2, -2.0], 50), anchors: () => ({ hill: [EX, 2.5, -9] }) },
  29: { build(W) { return england(W, 3); }, update(W, c, lt) { miners(c, lt, 'dig'); }, cam: (W, c, lt) => camAt([EX + 2.6, 1.6, 2.6], [EX, 0.9, -1.4], 48) },
  30: { build(W) { return england(W, 1); }, update(W, c, lt) { miners(c, lt, 'dig'); }, cam: (W, c, lt) => { const h = c.m[0].headPos(), f = fwd(c.m[0].p.rotY); return camAt([h.x + f.x * 1.3 + 0.5, h.y - 0.1, h.z + f.z * 1.3], [h.x, h.y - 0.3, h.z], 46); }, anchors: (W, c) => ({ forehead: forehead(c.m[0]) }) },
  31: {
    build(W) { return england(W, 1); },
    update(W, c, lt) { miners(c, Math.min(lt, 0.42), 'dig'); if (lt > 0.42) face(c.m[0], 'wide', 'raised', 'o'); },
    cam: (W, c, lt) => camAt([EX + 1.7, 0.75, 0.7], [EX + 0.2, 0.6, -1.2], 46),
    anchors: () => ({ hit: [EX, 0.7, -1.2] }),
  },
  32: {
    build(W) { return england(W, 3); },
    update(W, c, lt) { miners(c, lt, 'gasp'); },
    cam: (W, c, lt) => camAt([EX + 0.4, 1.1, 2.3 - lt * 0.3], [EX, 0.7, -1.6], 46),
    anchors: () => ({ lump: [EX, 0.65, -1.6] }),
  },
  33: { build(W) { return england(W, 4); }, update(W, c, lt) { miners(c, lt, 'gasp'); }, cam: (W, c, lt) => camAt([EX - 3.5 + lt * 0.4, 3.6, 7.0 + lt * 0.5], [EX, 0.6, -1.6], 50), anchors: () => ({ lump: [EX, 0.7, -1.6] }) },
  // ---------------------------------------------------------------- back in the hall
  // 34 "Your pencil box" a small green glow comes out of his pencil box
  34: {
    build(W) { const c = hall(W, { bundle: true }); c.you = person(W, 'you'); const l = new THREE.PointLight(0x6aff6a, 1.5, 1.2, 2); l.position.set(YBOX[0], TOP + 0.12, YBOX[2]); W.scene.add(l); return c; },
    update(W, c, lt) { youSit(c); face(c.you, 'wide', 'worried', 'tight'); },
    after(W, c, lt) { c.H.youBox.userData.lid.rotation.x = -0.06 - Math.max(0, Math.sin(lt * 8)) * 0.04; },
    cam: (W, c, lt) => camAt([YBOX[0] + 0.05, TOP + 0.2, YBOX[2] - 0.38 + lt * 0.06], [YBOX[0], TOP + 0.05, YBOX[2]], 40),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 35 "has a giant lump too." his deadpan face, lit green
  35: {
    build(W) { const c = hall(W); c.you = person(W, 'you'); const l = new THREE.PointLight(0x6aff6a, 3, 1.6, 2); l.position.set(YBOX[0] - 0.1, TOP + 0.15, YBOX[2] + 0.1); W.scene.add(l); return c; },
    update(W, c, lt) { youSit(c); face(c.you, 'open', 'neutral', 'neutral', { headPitch: -0.1 }); },
    cam: (W, c, lt) => headCam(c.you, 0.6 - lt * 0.06, -0.04, 0.0, -0.02, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 36 "She reaches your desk." low: she stops right next to him; her huge shadow falls over his desk
  36: {
    build(W) { const c = teacher(W, hall(W, { keyFrom: [-3.5, 4.0, -2.5] }), { clip: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      youSit(c); face(c.you, 'wide', 'worried', 'tight', { lookAt: P3(c.t.headPos()) });
      const k = easeOut(clamp(lt / 0.7)); standAt(c.t, lerp(0.2, 0.45, k), lerp(-0.6, 0.1, k), Math.PI / 2 - 0.2); c.t.p.walk = k < 1 ? lt * 5 : null; face(c.t, 'squint', 'angry', 'tight', { lookAt: [YBOX[0], TOP, YBOX[2]] }); holdClip(c);
    },
    cam: (W, c, lt) => camAt([YD[0] + 0.55, 0.95, YD[1] + 0.25], [YD[0] - 0.4, 1.45, YD[1] - 0.1], 52),
  },
  // 37 "She opens it." CREAK: her face as she lifts the lid, green glow on her face (mosaic over the box inside)
  37: {
    build(W) { const c = teacher(W, hall(W, { bundle: true })); const l = new THREE.PointLight(0x6aff6a, 0, 2.2, 2); l.position.set(YBOX[0], TOP + 0.2, YBOX[2]); W.scene.add(l); c.gl = l; return c; },
    update(W, c, lt) {
      standAt(c.t, 0.45, 0.05, Math.PI / 2 - 0.15); c.t.p.lean = 0.35; face(c.t, lt > 0.5 ? 'wide' : 'squint', 'raised', lt > 0.5 ? 'o' : 'tight', { lookAt: [YBOX[0], TOP, YBOX[2]] });
      c.t.p.handR = [YBOX[0] - 0.02, TOP + 0.04 + easeOut(clamp((lt - 0.2) / 0.5)) * 0.1, YBOX[2] + 0.04]; c.t.p.handPoseR = 'pinky';
    },
    after(W, c, lt) { const k = easeOut(clamp((lt - 0.2) / 0.5)); c.H.youBox.userData.lid.rotation.x = -k * 1.6; c.gl.intensity = 4 * k; },
    cam: (W, c, lt) => { const h = c.t.headPos(); return camAt([h.x + 0.55, h.y - 0.25, h.z + 0.45], [h.x + 0.1, h.y - 0.2, h.z + 0.02], 44); },
    mosaic: (W, c, lt) => (c.H.youBox.userData.lid.rotation.x < -0.2 ? [{ p: V(YBOX[0], TOP + 0.04, YBOX[2]), r: 0.07 }] : []),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 38 "She stares." ECU: her eyes; one eye twitches
  38: {
    build(W) { const c = teacher(W, hall(W)); const l = new THREE.PointLight(0x6aff6a, 3, 1.5, 2); l.position.set(0.9, 1.0, 0.1); W.scene.add(l); return c; },
    update(W, c, lt) { standAt(c.t, 0.45, 0.05, Math.PI / 2 - 0.15); c.t.p.lean = 0.35; const tw = lt > 0.4 && Math.floor(lt * 18) % 3 === 0; face(c.t, tw ? 'peek' : 'stare', 'neutral', 'tight', { headPitch: -0.3 }); },
    cam: (W, c, lt) => { const e = c.t.eyePos(), f = fwd(c.t.p.rotY); return camAt([e.x + f.x * (0.32 - lt * 0.04), e.y - 0.01, e.z + f.z * (0.32 - lt * 0.04)], P3(e), 34); },
    anchors: (W, c) => ({ eye: c.t.eyePos() }),
  },
  // 39 "She closes it." SNAP
  39: {
    build(W) { const c = teacher(W, hall(W, { bundle: true })); return c; },
    update(W, c, lt) {
      standAt(c.t, 0.45, 0.05, Math.PI / 2 - 0.15); c.t.p.lean = 0.35; face(c.t, 'stare', 'neutral', 'tight');
      const k = easeIn(clamp((lt - 0.25) / 0.15)); c.t.p.handR = [YBOX[0] - 0.02, TOP + 0.14 - k * 0.1, YBOX[2] + 0.04]; c.t.p.handPoseR = 'flat';
    },
    after(W, c, lt) { const k = easeIn(clamp((lt - 0.25) / 0.15)); c.H.youBox.userData.lid.rotation.x = -1.6 * (1 - k); c.H.youBox.position.y = TOP + (k >= 1 && lt < 0.55 ? 0.01 : 0); },
    cam: (W, c, lt) => camAt([YBOX[0] - 0.35, TOP + 0.35, YBOX[2] + 0.45], [YBOX[0], TOP + 0.05, YBOX[2]], 42),
    mosaic: (W, c) => (c.H.youBox.userData.lid.rotation.x < -0.25 ? [{ p: V(YBOX[0], TOP + 0.04, YBOX[2]), r: 0.07 }] : []),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 40 "She walks away." she turns and walks back to the front, very calm and stiff, never looking back
  40: {
    build(W) { const c = teacher(W, students(W, hall(W), [[1, 2], [1, 1], [2, 1], [1, 0], [2, 0]]), { clip: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      writeAll(c, lt); youSit(c); face(c.you, 'open', 'raised', 'tight', { lookAt: P3(c.t.headPos()) });
      const k = clamp(lt / 1.65); standAt(c.t, lerp(0.3, 0, k), lerp(-0.1, -2.8, k), Math.PI); c.t.p.walk = lt * 4.5; face(c.t, 'stare', 'neutral', 'tight'); holdClip(c);
    },
    cam: (W, c, lt) => camAt([YS[0] + 0.5, 1.5, YS[1] + 1.9], [-0.2, 1.1, -2.0], 48),
  },
  // 41 "She never checks" days later: she walks past students' pencil boxes, avoiding them
  41: {
    build(W) { const c = teacher(W, students(W, hall(W, { day2: true, warm: true }), [[1, 0], [2, 0], [1, 1], [2, 1]], { seed: 100 }), { clip: true }); return c; },
    update(W, c, lt) {
      writeAll(c, lt); const z = lerp(-3.6, -0.8, lt / 0.93); standAt(c.t, 0, z, 0); c.t.p.walk = lt * 5; c.t.p.leanSide = 0.0;
      face(c.t, 'squint', 'worried', 'tight', { headYaw: Math.sin(lt * 9) * 0.4 }); holdClip(c);
    },
    after(W, c, lt) { for (const kk of ['1,0', '2,0', '1,1', '2,1']) c.H.boxes[kk].userData.lid.rotation.x = -1.6; },
    cam: (W, c, lt) => camAt([0.25, 1.45, 1.8], [0, 1.2, -2.6], 48),
  },
  // 42 "pencil boxes again." from the top: she takes the long way round his desk
  42: {
    build(W) { const c = teacher(W, students(W, hall(W, { day2: true, warm: true }), [[1, 2], [3, 2], [2, 1], [2, 3], [1, 1], [3, 1]], { seed: 100 }), { clip: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      writeAll(c, lt); youSit(c); face(c.you, 'happy', 'raised', 'smile', { headPitch: -0.3 });
      const a = lerp(-Math.PI * 0.9, Math.PI * 0.2, easeInOut(lt / 1.67)), R = 1.25;
      const x = YD[0] + Math.cos(a) * R * 1.3, z = YD[1] + 0.3 + Math.sin(a) * R;
      standAt(c.t, x, z, Math.atan2(-Math.sin(a) * R, Math.cos(a) * R * 1.3) + Math.PI / 2 * 0 + Math.atan2(Math.cos(a) * 1.3, -Math.sin(a)) * 0); c.t.p.rotY = Math.atan2(-Math.sin(a) * 1.3, Math.cos(a)); c.t.p.walk = lt * 5;
      face(c.t, 'squint', 'worried', 'tight', { lookAt: [YBOX[0], TOP, YBOX[2]] }); holdClip(c);
    },
    cam: (W, c, lt) => camAt([YD[0] + 0.1, 6.2, YD[1] + 1.4], [YD[0], 0.4, YD[1] + 0.25], 48),
    anchors: () => ({ box: P3(boxTop()) }),
  },
  // 43 the ending: the school at sunset, green stink lines rising out of one window, slow zoom out
  43: {
    build(W) {
      S.lights(W, { sky: 0xffc8a0, ground: 0x8a7a6a, hemi: 1.0, key: 0xffb070, keyI: 1.6, fillI: 0 }); S.keyAt(W, [SX, 3, 0], { from: [-10, 7, 12], size: 16 });
      S.skyDome(W, 'sunset', [SX, 0, 0]); return { Sc: SC.buildSchool(W) };
    },
    update() {},
    cam: (W, c, lt) => { const k = easeOut(lt / 2.41); return camAt([SX + 1.0, lerp(4.0, 3.4, k), lerp(11, 26, k)], [SX, lerp(4.3, 4.0, k), 0], 50); },
    anchors: () => ({ window: [SX + SC.SCH.window[0], SC.SCH.window[1] + 0.2, SC.SCH.window[2]] }),
  },
};

// ------------------------------------------------------------------ old England helpers
const EX = SC.ENG.x0, SX = SC.SCH.x0;
function england(W, n) {
  S.lights(W, { sky: 0xe8f0ff, ground: 0x8a9a6a, hemi: 1.1, key: 0xfff0d8, keyI: 1.8, fillI: 0 }); S.keyAt(W, [EX, 1, -1.5], { from: [5, 9, 6], size: 10 });
  S.skyDome(W, 'sunset', [EX, 0, 0]);
  const c = { E: SC.buildEngland(W), m: [], picks: [] };
  for (let i = 0; i < n; i++) {
    const ch = person(W, `old${i * 3 + 1}`, { female: false, skirt: null, hairStyle: 'short', hat: 'cap', hatColor: '#4a3a2a', torso: { style: 'overalls', main: '#5a4a3a', inner: '#d8c8a8' },
      sleeve: ['cotton', { color: '#d8c8a8', seed: 31 }], pants: ['cotton', { color: '#5a4a3a', seed: 32 }], face: { lash: false } });
    c.m.push(ch);
    const pk = new THREE.Group(); W.scene.add(pk);
    pk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#8a6a4a', flatShading: true })));
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#6a6a70', metalness: 0.6, flatShading: true })); hd.position.y = 0.45; pk.add(hd);
    pk.userData.grip = { pos: [0, -0.2, 0], axis: [0, 1, 0], up: [0, 0, 1] };
    c.picks.push(pk);
  }
  return c;
}
const MSPOT = [[0.0, -0.45], [-1.15, -1.0], [1.15, -1.1], [-0.6, 0.6]];
function miners(c, lt, mode) {
  c.m.forEach((ch, i) => {
    const [x, z] = MSPOT[i];
    const rot = Math.atan2(-x, -1.6 - z);
    if (mode === 'walk') { standAt(ch, EX + x - 2 + lt * 1.2, z + 4 - lt * 1.4, Math.PI - 0.3); ch.p.walk = lt * 6 + i; face(ch, 'open', 'neutral', 'smile'); }
    else standAt(ch, EX + x, z, rot);
    const pk = c.picks[i];
    if (mode === 'gasp') { face(ch, 'wide', 'raised', 'o', { lookAt: [EX, 0.6, -1.6] }); const l = ch.headPos(); ch.p.handL = [l.x + 0.09, l.y - 0.05, l.z]; ch.p.handR = [l.x - 0.09, l.y - 0.05, l.z]; ch.p.handPoseL = ch.p.handPoseR = 'flat'; pk.position.set(EX + x + 0.3, 0.05, z); pk.rotation.set(0, 0, 1.4); return; }
    if (mode === 'dig') {
      face(ch, 'squint', 'angry', 'grimace');
      const sw = Math.sin(lt * 7 + i * 1.3), a = 0.6 - sw * 1.1;            // the swing angle
      const F = fwd(ch.p.rotY), sh = ch.chestPos();
      pk.position.set(sh.x + F.x * 0.25, sh.y + 0.1 + Math.max(0, sw) * 0.25, sh.z + F.z * 0.25);
      pk.rotation.set(0, ch.p.rotY, 0); pk.rotateX(a);
      ch.p.gripR = pk; ch.p.handL = P3(pk.localToWorld(V(0, -0.35, 0))); ch.p.handPoseL = 'grip';
    } else { pk.position.set(0, -10, 0); }
  });
}
