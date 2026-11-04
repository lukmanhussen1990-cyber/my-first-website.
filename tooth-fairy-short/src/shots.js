// The 20 scenes. Each shot is a pure function of time:
//   shot(W, lt, t, dur)  lt = time since the cut, t = global time.
// Cue times come from the voiceover alignment (timeline.js).
import * as THREE from 'three';
import { CUE } from './timeline.js';
import { clamp, lerp, inv, eOut, eIn, eInOut, eOutBack, deg, kf, punch } from './util.js';
import { BED } from './sets.js';
import { KIDS_X, JAIL_X } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// camera on a sphere around a target; frameY shifts the target on screen (+ = higher)
function orbit(W, t, target, dist, yaw, pitch, fov, { hand = 1, roll = 0, frameY = 0 } = {}) {
  const y = deg(yaw), p = deg(pitch);
  const half = dist * Math.tan(deg(fov) / 2);
  const tg = [target[0], target[1] - frameY * 2 * half, target[2]];
  const pos = [tg[0] + dist * Math.sin(y) * Math.cos(p), tg[1] + dist * Math.sin(p), tg[2] + dist * Math.cos(y) * Math.cos(p)];
  W.cam({ pos, target: tg, fov, roll }, t, hand);
}
function put(o, parent, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  parent.add(o);
  o.position.set(...p);
  o.rotation.set(...r);
  o.scale.setScalar(s);
  o.visible = true;
  return o;
}
// place a prop at a hand grip, oriented in the character's own frame
function holdAt(W, obj, rig, side, off = [0, 0, 0], rot = [0, 0, 0], s = 1) {
  const g = wpos(rig.arms[side].hand.grip);
  const q = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const o = V(...off).applyQuaternion(q);
  put(obj, W.scene, [g.x + o.x, g.y + o.y, g.z + o.z], [0, 0, 0], s);
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
  return obj;
}
function wpos(o) { o.updateWorldMatrix(true, false); return o.getWorldPosition(new THREE.Vector3()); }
function bedroom(W, preset, o = {}) { W.show(W.bed.root); W.light(preset, o); }
const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

// common placements (bedroom)
const MAN_BED = [0.74, -2.16];          // standing at the pillow side of the bed
const MAN_ROOM = [0.78, -1.9];          // standing in the room, facing the camera side
const OFF_POS = [1.3, -1.95];
const MAN_NEXT = [0.72, -1.3];
const COIN_ON_PILLOW = V(-0.06, 0.955, -2.56);

function manStand(W, xz, yaw) {
  const m = W.man;
  m.root.visible = true;
  m.root.position.set(xz[0], 0, xz[1]);
  m.root.rotation.y = yaw;
  return m;
}
function officerStand(o, xz, yaw) {
  o.root.visible = true;
  o.root.position.set(xz[0], 0, xz[1]);
  o.root.rotation.y = yaw;
  return o;
}
// man lying on his back in bed, head on the pillow
function manInBed(W, t) {
  const m = W.man;
  m.root.visible = true;
  m.root.position.set(BED.x, 0.98, -1.33);
  m.root.rotation.set(-PI / 2, 0, 0);
  m.neck.rotation.x = 0.28;
  m.arm('R', [-0.95, 0, 0.35], -1.35, [0, 0, 0], 'relax');
  m.arm('L', [-0.95, 0, -0.35], -1.35, [0, 0, 0], 'relax');
  m.breathe(t, 1.5);
  W.bed.duvet.visible = false;
  W.bed.lump.visible = true;
  W.bed.lump.position.set(BED.x, 0.86, -1.62);
  W.bed.lump.scale.set(1.02, 1.1, 1.1);
  return m;
}
function manSitThrone(W, t) {
  const m = W.man;
  m.root.visible = true;
  m.root.position.set(-0.25, 0.3, -2.33);
  m.root.rotation.set(0, 0, 0);
  m.legs.R.rotation.x = -1.35; m.legs.L.rotation.x = -1.35;
  m.breathe(t);
  return m;
}
function richRoom(W, preset = 'gold', o = {}) {
  bedroom(W, preset, o);
  const b = W.bed;
  b.bed.visible = false; b.pillow.visible = false; b.stand.visible = false; b.wardrobe.visible = false;
  b.clock.visible = false; b.boatPic.visible = false; b.rug.visible = false;
  b.toothPic.visible = true;
  W.show(W.P.throne, W.P.coinPiles);
  W.P.throne.position.set(-0.25, 0, -2.4);
}
function coinSparkle(W, obj, t, seed, big = 0) {
  const p = wpos(obj);
  W.spark.twinkle(p.clone().add(V(0.025, 0.03, 0.03)), t, seed, 0.09, 2.4);
  if (big > 0) W.spark.add(p.clone().add(V(-0.02, 0.04, 0.04)), 0.2 * big, 4 * big, t);
}

// ---------------------------------------------------------------------------
// 1. "This man lost a tooth."  close-up, holding up the tiny tooth, gap-tooth grin
function s1(W, lt, t) {
  bedroom(W, 'evening', { focus: V(0.4, 0.9, -1.6) });
  W.setClock(20, 40);
  const m = manStand(W, [0.6, -1.65], 0.22);
  m.breathe(t);
  const up = eOutBack(clamp(inv(0, 0.42, lt)), 1.15);
  m.ik('R', m.local(lerp(-0.46, -0.34, up), lerp(0.62, 1.15, up), lerp(0.06, 0.27, up)), m.local(-1.0, 0.45, -0.25), 'pinch', [0, 0.4, 0]);
  m.arm('L', [-0.1, 0, 0.14], -0.45, [0, 0, 0], 'relax');
  const nod = Math.sin(clamp(inv(0.85, 1.25, lt)) * PI) * 0.08;
  m.head.rotation.set(0.04 + nod, 0.12, -0.08);
  m.face.set({ mouth: 'grin', teeth: 'gap', eyes: lt > 0.9 ? 'happy' : 'open', look: [-0.55, -0.15], brows: 'raised', blush: 0.6 });
  holdAt(W, W.P.tooth, m, 'R', [0.0, 0.03, 0.04], [0.15, 0.5, 0.1], 1.2);
  const tp = wpos(W.P.tooth);
  W.spark.twinkle(tp.clone().add(V(0.03, 0.05, 0.04)), t * 1.3, 1, 0.1, lt > 0.85 ? 3.2 : 1.2);
  if (lt > 0.85) W.spark.add(tp.clone().add(V(-0.03, -0.01, 0.05)), 0.16 * (1 - inv(0.9, 1.45, lt)), 4 * (1 - inv(0.9, 1.45, lt)), t);
  const fov = 40 - 6 * punch(t, CUE.tooth - 0.02, 0.12);
  orbit(W, t, [0.5, 1.2, -1.65], lerp(2.8, 2.5, eInOut(inv(0, 1.6, lt))), 12, 3, fov, { frameY: 0.1 });
  W.dustAmt = 0.35;
}

// 2. "He put it under his pillow."  night, slides the tooth under the fluffy pillow
function s2(W, lt, t) {
  bedroom(W, 'night', { focus: V(0.2, 0.8, -2.3) });
  W.rig.lamp.intensity *= 0.45; W.M.shade.emissiveIntensity = 0.3; W.M.bulb.emissiveIntensity = 0.5;
  W.setClock(22, 5);
  const m = manStand(W, MAN_BED, -PI / 2 + 0.35);
  m.breathe(t);
  m.torso.rotation.x = 0.1;
  m.head.rotation.set(0.32, -0.12, 0);
  const rt = kf(lt, [[0, [0.45, 0.95, -2.3]], [0.4, [0.3, 1.02, -2.5]], [0.8, [0.03, 0.82, -2.58]], [1.0, [0.03, 0.82, -2.58]], [1.2, [0.34, 0.98, -2.45]], [1.42, [0.06, 1.0, -2.55]]], eInOut);
  m.ik('R', V(...rt), V(0.95, 0.55, -2.85), lt > 1.15 ? 'open' : 'pinch');
  const lift = Math.sin(clamp(inv(0.45, 1.05, lt)) * PI);
  m.ik('L', V(0.2, 0.9 + 0.05 * lift, -2.4), V(0.95, 0.5, -1.6), 'grip');
  W.bed.pillow.position.y = BED.pillow.y + lift * 0.045;
  W.bed.pillow.rotation.z = lift * 0.16;
  if (lt < 0.8) {
    holdAt(W, W.P.tooth, m, 'R', [0.0, 0.02, 0.03], [0.15, 0.5, 0.1], 1.2);
    W.spark.twinkle(wpos(W.P.tooth).add(V(0.02, 0.04, 0.03)), t * 1.3, 2, 0.08, 2.2);
  }
  m.face.set({ mouth: lt > 1.0 ? 'grin' : 'smile', teeth: 'gap', eyes: lt > 1.1 ? 'happy' : 'open', look: [0, 0.75], brows: 'raised' });
  orbit(W, t, [0.3, 0.93, -2.42], lerp(2.5, 2.3, eInOut(inv(0, 1.5, lt))), -50, 33, 44, { frameY: 0.02 });
  W.dustAmt = 0.18; W.dustCol = '#c9d4ff';
}

// 3. "In the morning, there was money."  morning light, lifts the pillow, shiny coin
function s3(W, lt, t) {
  bedroom(W, 'morning', { focus: V(0.0, 0.8, -2.3) });
  W.setClock(7, 0);
  const m = manStand(W, MAN_BED, -PI / 2 + 0.35);
  m.breathe(t);
  m.torso.rotation.x = 0.1;
  const reach = eInOut(inv(0.35, 0.75, lt));
  const lift = eOut(inv(0.78, 1.08, lt));
  const th = 0.78 * lift;
  const pl = W.bed.pillow;
  const piv = V(BED.pillow.x - 0.43, BED.top, BED.pillow.z);
  pl.position.copy(piv).add(V(0.43 * Math.cos(th) - 0.11 * Math.sin(th), 0.43 * Math.sin(th) + 0.11 * Math.cos(th), 0));
  pl.rotation.set(0, 0, th);
  pl.updateWorldMatrix(true, false);
  const cR = V(0.4, 0.0, -0.17).applyMatrix4(pl.matrixWorld), cL = V(0.4, 0.0, 0.17).applyMatrix4(pl.matrixWorld);
  m.ik('R', V(0.5, 0.72, -2.4).lerp(cR, reach), V(1.0, 0.5, -2.9), 'grip');
  m.ik('L', V(0.55, 0.72, -1.95).lerp(cL, reach), V(1.0, 0.5, -1.4), 'grip');
  m.head.rotation.set(0.38 - 0.18 * lift, -0.12, 0);
  put(W.P.coin, W.scene, [-0.13, 0.727, -2.6], [0, 0.4, 0], 1.1);
  const shine = inv(CUE.money1 - 0.12, CUE.money1 + 0.1, t);
  if (shine > 0) {
    const cp = wpos(W.P.coin).add(V(0, 0.03, 0));
    W.spark.add(cp.clone().add(V(0.02, 0.02, 0.03)), 0.22 * eOutBack(shine), 5 * (1 - 0.6 * inv(4.5, 5, t)), t * 0.8);
    W.spark.twinkle(cp.clone().add(V(-0.05, 0.01, 0.02)), t, 3, 0.1, 2.5);
    W.spark.twinkle(cp.clone().add(V(0.05, 0.0, -0.02)), t, 5, 0.08, 2.5);
  }
  const amazed = lt > 1.12;
  m.face.set({ mouth: amazed ? 'grin' : 'flat', teeth: 'gap', eyes: amazed ? 'wide' : lt < 0.45 ? 'closed' : 'open', look: [0, 0.8], brows: amazed ? 'raised' : 'neutral' });
  const p = eInOut(inv(0, 1.15, lt));
  const pz = punch(t, CUE.money1 - 0.05, 0.13);
  const tgt = [lerp(0.56, 0.3, p), lerp(1.12, 0.98, p), lerp(-2.32, -2.42, p)];
  orbit(W, t, tgt, lerp(2.95, 2.45, p), lerp(-56, -63, p), lerp(15, 20, p), 42 - 7 * pz, { frameY: 0.0 });
  W.dustAmt = 0.6; W.dustCol = '#fff1cf';
}

// 4. "Someone paid him."  holds the coin, eyes dart around the room
function s4(W, lt, t) {
  bedroom(W, 'morning', { focus: V(0.6, 0.9, -1.9) });
  W.setClock(7, 2);
  const m = manStand(W, MAN_ROOM, 0.4);
  m.breathe(t);
  m.ik('R', m.local(-0.16, 1.02, 0.36), m.local(-0.9, 0.5, -0.2), 'pinch', [0, 0.5, 0]);
  m.arm('L', [0.25, 0, 0.75], -1.75, [0, 0, 0], 'fist');
  holdAt(W, W.P.coin, m, 'R', [0.0, 0.035, 0.035], [PI / 2, 0, 0], 1.15);
  const yaw = kf(lt, [[0, 0], [0.2, 0.5], [0.5, 0.5], [0.72, -0.45], [1.0, -0.45], [1.15, 0.1]], eInOut);
  m.head.rotation.set(0.02, yaw, 0);
  const lookX = clamp(kf(lt, [[0, 0], [0.12, 1], [0.5, 1], [0.6, -1], [1.0, -1], [1.12, 0.3]], eInOut), -1, 1);
  m.face.set({ eyes: 'squint', look: [lookX, 0], brows: 'angry', mouth: 'pursed', teeth: 'gap' });
  W.man.glintMat.opacity = 0.18 + 0.3 * Math.max(0, Math.sin(t * 3));
  coinSparkle(W, W.P.coin, t, 9);
  orbit(W, t, [0.74, 1.12, -1.9], lerp(2.85, 2.65, lt / 1.2), 22, 2, 40, { frameY: 0.1, hand: 1.3 });
  W.dustAmt = 0.45; W.dustCol = '#fff1cf';
}

// 5. "That was bribery."  BRIBERY card drops, he gasps
function s5(W, lt, t) {
  bedroom(W, 'morning', { focus: V(0.6, 0.9, -1.9) });
  W.setClock(7, 3);
  const m = manStand(W, MAN_ROOM, 0.4);
  const g = inv(CUE.bribery - 0.04, CUE.bribery + 0.1, t);
  const jolt = Math.sin(clamp(inv(CUE.bribery, CUE.bribery + 0.35, t)) * PI) * (1 - inv(CUE.bribery + 0.3, CUE.bribery + 0.7, t));
  m.breathe(t);
  m.hips.position.y = m.hipY + 0.03 * jolt;
  m.ik('R', m.local(-0.16, 1.02 + 0.08 * g, 0.36), m.local(-0.9, 0.5, -0.2), 'pinch', [0, 0.5, 0]);
  if (g > 0.2) m.ik('L', m.local(0.3, lerp(0.8, 1.14, eOut(g)), 0.3), m.local(1.0, 0.6, 0), 'open');
  else m.arm('L', [0.25, 0, 0.75], -1.75, [0, 0, 0], 'fist');
  holdAt(W, W.P.coin, m, 'R', [0.0, 0.035, 0.035], [PI / 2, 0, 0], 1.15);
  coinSparkle(W, W.P.coin, t, 10);
  m.head.rotation.set(-0.12 * g, 0.05, 0);
  W.man.glasses.position.y = 0.035 * jolt;
  m.face.set(g > 0.3
    ? { eyes: 'wide', mouth: 'gasp', open: 0.8, brows: 'gasp', look: [0, -0.1] }
    : { eyes: 'squint', look: [0.4, 0], brows: 'angry', mouth: 'pursed' });
  const pz = punch(t, CUE.bribery - 0.02, 0.12);
  orbit(W, t, [0.74, 1.24, -1.9], 2.6, 22, 4, 40 - 6 * pz, { frameY: 0.03, hand: 1.2 + 1.5 * jolt });
  W.dustAmt = 0.45; W.dustCol = '#fff1cf';
}

// 6. "So he called the police."  old blocky phone at his ear, serious face, talking
function s6(W, lt, t) {
  bedroom(W, 'morning', { focus: V(0.6, 0.9, -1.9) });
  W.setClock(7, 5);
  const m = manStand(W, MAN_ROOM, 0.4);
  m.breathe(t);
  m.head.rotation.set(0.04, -0.1, -0.1);
  const ph = put(W.P.phone, m.head, [-0.395, 0.24, 0.05], [-0.4, -PI / 2, 0], 1.0);
  ph.updateWorldMatrix(true, false);
  m.ik('R', V(0, -0.075, 0.0).applyMatrix4(ph.matrixWorld), m.local(-0.95, 0.65, 0.15), 'grip', [0, 0, 0]);
  m.arm('L', [0.25, 0, 0.75], -1.75, [0, 0, 0], 'fist');
  const o = W.talk(t);
  m.face.set({ eyes: 'open', look: [0.5, 0.1], brows: 'angry', mouth: 'talk', open: o, teeth: 'gap' });
  orbit(W, t, [0.66, 1.2, -1.85], lerp(2.6, 2.4, lt / 1.5), 2, 4, 40, { frameY: 0.08 });
  W.dustAmt = 0.4; W.dustCol = '#fff1cf';
}

// 7. "The officer looked at the money."  officer stares at the coin on the pillow
function s7(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.5, 1.0, -2.0) });
  W.setClock(9, 15);
  const o = officerStand(W.officer, OFF_POS, yawTo(OFF_POS, [COIN_ON_PILLOW.x, COIN_ON_PILLOW.z]));
  o.breathe(t);
  o.torso.rotation.x = 0.16;
  o.head.rotation.set(0.42, 0, 0);
  o.arm('R', [0.35, 0, -0.12], -0.4, [0, 0, 0], 'relax');
  o.arm('L', [0.35, 0, 0.12], -0.4, [0, 0, 0], 'relax');
  o.face.set({ eyes: 'bored', lid: 0.55, look: [0, 0.9], brows: 'flat', mouth: 'flat' });
  const m = manStand(W, MAN_NEXT, 0.35);
  m.breathe(t);
  m.face.set({ mouth: 'grin', teeth: 'gap', eyes: 'open', look: [0.5, -0.6], brows: 'raised' });
  m.head.rotation.set(-0.25, 0.4, 0);
  put(W.P.coin, W.scene, COIN_ON_PILLOW.toArray(), [0.1, 0.5, -0.06], 1.15);
  coinSparkle(W, W.P.coin, t, 11, t > CUE.money2 - 0.05 ? eOutBack(inv(CUE.money2 - 0.05, CUE.money2 + 0.15, t)) * (1 - inv(10.25, 10.5, t)) : 0);
  // low angle from behind the coin, looking up at the tall officer
  const p = eInOut(inv(0, 1.5, lt));
  W.cam({ pos: [-0.62, lerp(1.0, 1.03, p), -2.78], target: [lerp(0.55, 0.6, p), lerp(1.36, 1.4, p), -2.2], fov: lerp(52, 48, p) }, t, 1);
  W.dustAmt = 0.4;
}

// 8. "Then at him."  slow head turn from the coin to the man
function s8(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.8, 1.0, -1.6) });
  W.setClock(9, 15);
  const o = officerStand(W.officer, OFF_POS, yawTo(OFF_POS, [COIN_ON_PILLOW.x, COIN_ON_PILLOW.z]));
  o.breathe(t);
  const turn = eInOut(inv(0.12, 0.72, lt));
  o.torso.rotation.set(0.16 - 0.1 * turn, 0.3 * turn, 0);
  o.head.rotation.set(lerp(0.42, 0.34, turn), lerp(0, 1.2, turn), 0);
  o.arm('R', [0.35, 0, -0.12], -0.4, [0, 0, 0], 'relax');
  o.arm('L', [0.35, 0, 0.12], -0.4, [0, 0, 0], 'relax');
  o.face.set({ eyes: 'bored', lid: 0.58, look: [lerp(0, 0.4, turn), lerp(0.9, 0.55, turn)], brows: 'flat', mouth: 'flat' });
  const m = manStand(W, MAN_NEXT, 0.35);
  m.breathe(t);
  const nerv = turn > 0.9 ? 1 : 0;
  m.head.rotation.set(-0.28, 0.42, 0);
  m.face.set({ mouth: 'grin', teeth: 'gap', eyes: 'open', look: [0.5, -0.7], brows: nerv ? 'worried' : 'raised', sweat: nerv && lt > 0.95 ? 1 : 0 });
  W.cam({ pos: [0.42, 1.55, 0.72], target: [1.0, 1.55, -1.66], fov: lerp(46, 44, lt / 1.3) }, t, 0.8);
  W.dustAmt = 0.35;
}

// 9. "Are you serious?"  snap zoom on the officer's tired face (man's POV)
function s9(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.8, 1.2, -1.6) });
  const o = officerStand(W.officer, OFF_POS, yawTo(OFF_POS, MAN_NEXT));
  o.breathe(t);
  o.head.rotation.set(0.32, 0, 0);
  o.torso.rotation.x = 0.05;
  o.arm('R', [0.2, 0, -0.5], -2.2, [0, 0, 0], 'fist');
  o.arm('L', [0.2, 0, 0.5], -2.2, [0, 0, 0], 'fist');
  const op = W.talk(t);
  o.talk(op);
  o.face.set({ eyes: 'bored', lid: 0.6, look: [0, 0.35], brows: 'skeptic', mouth: 'talk', open: op });
  const z1 = eOutBack(clamp(inv(0, 0.16, lt)), 1.6);
  const z2 = punch(t, CUE.serious, 0.12);
  const head = wpos(o.head).add(V(0, 0.38, 0));
  const fov = lerp(58, 47, z1) - 3 * z2;
  W.cam({ pos: [MAN_NEXT[0] + 0.02, 1.28, MAN_NEXT[1] + 0.05], target: [head.x, head.y, head.z], fov, roll: deg(-4) }, t, 1.2);
  W.dustAmt = 0.3;
}

// 10. "That's the Tooth Fairy."  points at a drawing of the fairy on a notepad
function s10(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.8, 1.2, -1.6) });
  const o = officerStand(W.officer, OFF_POS, yawTo(OFF_POS, MAN_NEXT) + 0.1);
  o.breathe(t);
  o.head.rotation.set(0.2, -0.05, 0.04);
  const raise = eOutBack(clamp(inv(0, 0.22, lt)), 1.3);
  const np = put(W.P.notepad, o.root, [0.1, lerp(1.1, 1.5, raise), 0.36], [-0.12, -0.08, 0], 1.25);
  np.updateWorldMatrix(true, false);
  o.ik('L', V(0.16, -0.02, 0.01).applyMatrix4(np.matrixWorld), o.local(0.9, 1.0, 0), 'grip', [0, 0, 0]);
  const pt = eOut(inv(CUE.toothFairy - 0.3, CUE.toothFairy - 0.05, t));
  const tap = Math.sin(clamp(inv(CUE.toothFairy, CUE.toothFairy + 0.45, t)) * PI * 2) * 0.02;
  if (pt > 0) o.ik('R', o.local(lerp(-0.3, 0.02, pt), lerp(1.1, 1.5, pt), lerp(0.2, 0.47 - tap, pt)), o.local(-0.9, 1.0, 0.1), pt > 0.3 ? 'point' : 'relax');
  else o.arm('R', [0.2, 0, -0.12], -0.4, [0, 0, 0], 'relax');
  const op = W.talk(t);
  o.talk(op);
  o.face.set({ eyes: 'bored', lid: 0.6, look: [0, 0.2], brows: 'flat', mouth: 'talk', open: op });
  const yawCam = (yawTo(OFF_POS, MAN_NEXT) * 180) / PI;
  orbit(W, t, [OFF_POS[0], 1.62, OFF_POS[1]], lerp(2.45, 2.3, lt / 1.4), yawCam + 8, 2, 44, { frameY: 0.04 });
  W.dustAmt = 0.3;
}

// 11. "She buys teeth."  cutaway: the fairy secretly collecting a tooth from a sleeping kid
function s11(W, lt, t) {
  W.show(W.kids.root);
  W.light('kids', { focus: V(KIDS_X + 0.3, 0.6, -2.0), lampPos: [KIDS_X, 0.62, -2.4] });
  const [pa, pb] = W.kids.kidPos;
  W.kidA.root.visible = W.kidB.root.visible = true;
  W.kidA.root.position.set(pa.x, 0.73, -2.34); W.kidA.root.rotation.set(-1.0, 0.45, 0.05);
  W.kidB.root.position.set(pb.x - 0.05, 0.72, -2.36); W.kidB.root.rotation.set(-0.95, 0.55, 0.1);
  const f = W.fairy;
  f.root.visible = true;
  const bob = Math.sin(t * 5) * 0.01;
  const drift = eInOut(inv(0, 1.53, lt));
  f.root.position.set(KIDS_X + 1.08 + 0.06 * drift, 0.74 + bob + 0.03 * drift, -2.18);
  f.root.rotation.y = -0.55;
  f.flap(t, 1);
  f.legs.R.rotation.x = 0.35; f.legs.L.rotation.x = 0.15;
  f.wand.visible = false;
  const drop = eInOut(inv(CUE.teeth - 0.18, CUE.teeth, t));
  f.ik('L', f.local(0.14, 0.42, 0.2), f.local(0.5, 0.3, -0.2), 'grip');
  const bagP = wpos(f.bag);
  const upHand = f.local(-0.16, 0.72, 0.22);
  f.ik('R', upHand.clone().lerp(bagP.clone().add(V(0, 0.035, 0)), drop), f.local(-0.5, 0.4, -0.3), 'grip');
  if (drop < 0.95) holdAt(W, W.P.tooth, f, 'R', [0, 0.012, 0.008], [0, 0, 0], 0.55);
  const yawn = clamp(inv(CUE.teeth + 0.1, CUE.teeth + 0.35, t)) * (1 - inv(15.9, 16.03, t));
  f.face.set(yawn > 0.05
    ? { eyes: 'closed', brows: 'flat', mouth: 'yawn', open: yawn }
    : { eyes: 'tired', lid: 0.55, look: [-0.6, 0.3], brows: 'grumpy', mouth: 'grumpy' });
  if (t > CUE.teeth - 0.03) W.spark.add(bagP.clone().add(V(0, 0.04, 0.02)), 0.07 * (1 - inv(CUE.teeth, CUE.teeth + 0.4, t)), 3, t, '#fff0b0');
  const tp = wpos(W.P.tooth);
  if (drop < 0.95) W.spark.twinkle(tp.clone().add(V(0.01, 0.02, 0.02)), t, 25, 0.04, 2.0, '#ffffff');
  for (let i = 0; i < 3; i++) W.spark.twinkle(wpos(f.root).add(V(0.1 + i * 0.07, 0.24 + Math.sin(i * 2.1) * 0.05, 0.03 * i)), t * 1.4, 20 + i, 0.035, 1.6, '#ffd9f0');
  orbit(W, t, [KIDS_X + 0.95, 0.82, -2.26], lerp(1.4, 1.25, lt / 1.5), 28, 12, 44, { frameY: 0.04 });
  W.dustAmt = 0.25; W.dustCol = '#c9d4ff';
}

// 12. "That was smuggling."  SMUGGLING card drops, officer's eyes go wide
function s12(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.8, 1.2, -1.6) });
  const o = officerStand(W.officer, OFF_POS, yawTo(OFF_POS, MAN_NEXT) + 0.15);
  const w = inv(CUE.smuggling - 0.02, CUE.smuggling + 0.08, t);
  const jolt = Math.sin(clamp(inv(CUE.smuggling, CUE.smuggling + 0.3, t)) * PI);
  o.breathe(t);
  o.head.rotation.set(0.12 - 0.1 * w, 0, 0);
  o.cap.position.y = o.dims.HH + 0.07 * jolt;
  o.cap.rotation.z = 0.06 * jolt;
  o.arm('R', [0.2, 0, -0.5], -2.2, [0, 0, 0], 'fist');
  o.arm('L', [0.2, 0, 0.5], -2.2, [0, 0, 0], 'fist');
  o.face.set(w > 0.4 ? { eyes: 'wide', look: [0, 0.1], brows: 'raised', mouth: 'o' } : { eyes: 'bored', lid: 0.6, brows: 'flat', mouth: 'flat', look: [0, 0.2] });
  const pz = punch(t, CUE.smuggling - 0.02, 0.12);
  const head = wpos(o.head).add(V(0, 0.32, 0));
  const yawCam = (yawTo(OFF_POS, MAN_NEXT) * 180) / PI;
  orbit(W, t, [head.x, head.y, head.z], 2.25, yawCam + 6, -3, 40 - 6 * pz, { frameY: -0.02, hand: 1 + jolt * 2 });
  W.dustAmt = 0.3;
}

// officers hiding for the trap
function hideOfficers(W, t, burst = 0) {
  const E = W.extras;
  // under the bed: eyes peeking out below the duvet drape
  const e0 = E[0];
  e0.root.visible = true;
  e0.root.position.set(0.2 + 0.35 * burst, -1.66 + 0.2 * burst, -1.75);
  e0.root.rotation.y = PI / 2;
  e0.face.set({ eyes: 'bored', lid: 0.45, look: [0.4, 0], brows: 'flat', mouth: 'flat' });
  // two in the wardrobe, peeking through the door gap
  const e1 = E[1], e2 = E[2];
  for (const [e, x, y, look] of [[e1, -1.58, -0.36, -0.2], [e2, -1.42, -0.98, 0.3]]) {
    e.root.visible = true;
    e.root.position.set(x, y, -2.6 + 0.4 * burst);
    e.root.rotation.y = 0.25;
    e.face.set({ eyes: burst > 0 ? 'wide' : 'bored', lid: 0.5, look: [look, 0.1], brows: 'flat', mouth: burst > 0 ? 'o' : 'flat' });
  }
  W.bed.doors[0].piv.rotation.y = -0.55 - 1.0 * burst;
  W.bed.doors[1].piv.rotation.y = 0.45 + 1.0 * burst;
  // two behind the curtains: shoes poke out, bodies bulge the fabric
  const e3 = E[3], e4 = E[4];
  // both behind the left curtain: caps poke out above, shoes poke out below
  for (const [e, x] of [[e3, 1.3], [e4, 2.0]]) {
    e.root.visible = true; e.root.position.set(x + 0.25 * burst, 0, -2.88 + 0.65 * burst); e.root.rotation.y = 0;
    e.arm('R', [0.2, 0, 0.0], -0.2, [0, 0, 0], 'relax');
    e.arm('L', [0.2, 0, 0.0], -0.2, [0, 0, 0], 'relax');
    e.face.set({ eyes: burst > 0 ? 'wide' : 'bored', lid: 0.5, brows: 'flat', mouth: burst > 0 ? 'o' : 'flat' });
  }
  W.setCurtains(0, [
    { x: 1.3, y: 1.25, rx: 0.3, ry: 0.5, z: 0.12 },
    { x: 2.0, y: 1.25, rx: 0.3, ry: 0.5, z: 0.12 },
    { x: 1.3, y: 1.95, rx: 0.27, ry: 0.36, z: 0.22 },
    { x: 2.0, y: 1.95, rx: 0.27, ry: 0.36, z: 0.22 },
  ]);
}

// 13. "So the police set a trap."  night, five officers hidden, tooth as bait
function s13(W, lt, t) {
  bedroom(W, 'trap', { focus: V(0.0, 0.9, -2.0) });
  W.setClock(23, 50);
  hideOfficers(W, t);
  put(W.P.baitTooth, W.scene, [BED.x, 0.97, -2.6], [0, 0.5, 0], 1.2);
  const bt = wpos(W.P.baitTooth);
  W.spark.twinkle(bt.clone().add(V(0.02, 0.05, 0.04)), t, 17, 0.08, 1.8, '#dfe6ff');
  const gl = inv(CUE.trap - 0.05, CUE.trap + 0.1, t);
  if (gl > 0) W.spark.add(bt.clone().add(V(0.0, 0.05, 0.05)), 0.22 * eOutBack(gl) * (1 - inv(18.8, 19.06, t)), 3.5, t, '#e8eeff');
  // slow pan: wardrobe faces -> under the bed -> pillow bait, curtain feet at frame right
  // beat 1: wardrobe faces, beat 2: eyes under the bed, beat 3: bait + curtain feet/peeking face
  const tgt = kf(lt, [[0, [-1.5, 1.3, -2.45]], [0.38, [-1.45, 1.25, -2.45]], [0.66, [0.3, 0.32, -1.75]], [0.92, [0.32, 0.34, -1.75]], [1.28, [0.85, 1.08, -2.5]], [1.83, [0.85, 1.05, -2.5]]], eInOut);
  const pos = kf(lt, [[0, [-0.6, 1.5, -0.4]], [0.38, [-0.6, 1.5, -0.45]], [0.66, [1.45, 0.62, -0.7]], [0.92, [1.4, 0.6, -0.75]], [1.28, [0.85, 1.6, 1.95]], [1.83, [0.85, 1.56, 1.7]]], eInOut);
  W.cam({ pos, target: tgt, fov: lt > 1.0 ? lerp(50, 56, eInOut(inv(1.0, 1.28, lt))) : 50 }, t, 0.9);
  W.dustAmt = 0.15; W.dustCol = '#b9c8ff';
}

// 14. "They caught her at midnight."  the fairy flies in, net drops, red/blue lights flash
function s14(W, lt, t) {
  bedroom(W, 'trap', { focus: V(-0.2, 1.0, -2.3), post: { bloomK: 0.7 } });
  W.setClock(0, 0);
  hideOfficers(W, t, eOut(inv(19.55, 19.85, t)));
  put(W.P.baitTooth, W.scene, [BED.x, 0.97, -2.6], [0, 0.5, 0], 1.2);
  const f = W.fairy;
  f.root.visible = true;
  const fly = eOut(inv(0, 0.3, lt));
  const T0 = CUE.caught + 0.07; // net lands
  const caught = t > T0;
  const fp = V(lerp(0.5, -0.12, fly), lerp(1.3, 0.98, fly) + (caught ? -0.02 : Math.sin(t * 6) * 0.015), lerp(-2.25, -2.5, fly));
  f.root.position.copy(fp);
  f.root.rotation.y = lerp(-1.2, -0.3, fly);
  f.flap(t, caught ? 0.15 : 1, caught ? 0.4 : 0, caught ? 3 : 9);
  f.arm('R', [-1.1, 0, -0.3], -0.3, [0, 0, 0], 'grip');
  f.arm('L', caught ? [-2.6, 0, 0.5] : [-0.5, 0, 0.4], caught ? -0.4 : -0.6, [0, 0, 0], caught ? 'open' : 'grip');
  f.legs.R.rotation.x = 0.4; f.legs.L.rotation.x = 0.2;
  f.face.set(caught ? { eyes: 'wide', look: [0, -0.4], brows: 'shock', mouth: 'shock' } : { eyes: 'tired', lid: 0.5, look: [-0.4, 0.8], brows: 'grumpy', mouth: 'grumpy' });
  // the net: falls from the ceiling, lands at T0, drapes over her
  W.P.netRoot.visible = true;
  const fallP = eIn(inv(T0 - 0.16, T0, t));
  const settle = eOut(inv(T0, T0 + 0.3, t));
  W.P.netRoot.position.set(fp.x + 0.02, lerp(2.75, 0.9, fallP), fp.z);
  W.P.net.shape(fallP, settle, 0.42, 0.42, t);
  // police lights
  const L = inv(T0 + 0.12, T0 + 0.2, t);
  if (L > 0) {
    const ph = Math.floor((t - T0) * 8) % 2;
    const s = 0.55 + 0.45 * Math.abs(Math.sin((t - T0) * 8 * PI));
    W.rig.red.position.set(1.6, 1.8, -1.0); W.rig.blue.position.set(-1.4, 1.8, -1.0);
    W.rig.red.intensity = L * (ph ? 22 : 3) * s;
    W.rig.blue.intensity = L * (ph ? 3 : 26) * s;
    W.post.flash = L * 0.06 * s;
    W.post.flashCol = ph ? [1, 0.1, 0.15] : [0.1, 0.25, 1];
  }
  const impact = Math.sin(clamp(inv(T0, T0 + 0.25, t)) * PI);
  const fc = wpos(f.root).add(V(0, 0.12, 0));
  if (!caught) W.spark.twinkle(wpos(f.wandStar), t, 21, 0.06, 2, '#fff2c0');
  if (caught) for (let i = 0; i < 6; i++) { const a = i * 1.05 + t; W.spark.add(fc.clone().add(V(Math.cos(a) * 0.22, 0.05 + Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.1)), 0.07 * (1 - inv(T0, T0 + 0.5, t)), 2.5, t, '#ffe9a8'); }
  W.cam({ pos: [-0.16, 1.03, -0.38], target: [-0.2, 1.02, -2.6], fov: 50 - 4 * punch(t, T0, 0.1) }, t, 1 + impact * 4);
  W.dustAmt = 0.15; W.dustCol = '#b9c8ff';
}

// 15. "The Tooth Fairy went to jail."  tiny jail cell, holding the bars, wings drooping
function s15(W, lt, t) {
  W.show(W.jail.root);
  W.light('jail', { focus: V(JAIL_X, 1.0, -0.4), lampPos: [JAIL_X - 0.62, 1.25, -0.62], dir: [-0.42, -0.48, -0.77] });
  const f = W.fairy;
  f.root.visible = true;
  f.root.position.set(JAIL_X - 0.02, 0.86, -0.262);
  f.hips.position.y = 0.06;
  f.legs.R.rotation.set(-1.45, 0, 0.1); f.legs.L.rotation.set(-1.45, 0, -0.1);
  f.wand.visible = false; f.bag.visible = false;
  f.flap(t, 0.04, 1.0, 1.5);
  f.head.rotation.set(0.12 + 0.03 * Math.sin(t * 1.3), 0.05, 0.06);
  const sigh = Math.sin(clamp(inv(CUE.jail - 0.1, CUE.jail + 0.5, t)) * PI);
  f.torso.rotation.x = 0.08 + 0.06 * sigh;
  f.ik('R', V(JAIL_X - 0.062, 0.985, -0.2), f.local(-0.6, 0.2, 0), 'grip');
  f.ik('L', V(JAIL_X + 0.058, 0.985, -0.2), f.local(0.6, 0.2, 0), 'grip');
  f.face.set({ eyes: 'tired', lid: 0.62 + 0.1 * sigh, look: [0, 0.2], brows: 'sad', mouth: 'sad' });
  f.tutu.forEach((tt) => (tt.rotation.x = -0.08));
  orbit(W, t, [JAIL_X - 0.02, 0.985, -0.26], lerp(0.95, 0.74, eInOut(inv(0, 1.67, lt))), 8, 9, 38, { frameY: 0.02, hand: 0.7 });
  W.dustAmt = 0.25; W.dustCol = '#ffe7c4';
}

// 16. "But the man learned something."  lying in bed, staring at the ceiling, thinking
function s16(W, lt, t) {
  bedroom(W, 'night', { focus: V(-0.25, 0.9, -2.0), post: { exposure: 1.0 }, camFill: ['#ffd7ad', 1.6, [0.2, 0.5, -0.1]] });
  W.setClock(1, 30);
  const m = manInBed(W, t);
  const idea = inv(CUE.something - 0.05, CUE.something + 0.1, t);
  const lx = Math.sin(t * 1.4) * 0.6 * (1 - idea);
  m.face.set(idea > 0.3
    ? { eyes: 'wide', look: [0, 0], brows: 'raised', mouth: 'pursed', teeth: 'gap' }
    : { eyes: 'open', look: [lx, -0.2], brows: 'think', mouth: 'pursed', teeth: 'gap' });
  W.man.glintMat.opacity = 0.12 + 0.6 * Math.sin(clamp(inv(CUE.something, CUE.something + 0.4, t)) * PI);
  const head = W.man.facePoint(0.5, 0.5);
  const d = lerp(1.3, 1.1, eInOut(inv(0, 1.5, lt))) - 0.1 * punch(t, CUE.something, 0.15);
  W.cam({ pos: [head.x + 0.04, head.y + d, head.z + 0.3 * d], target: [head.x, head.y, head.z - 0.06], fov: 46, roll: deg(2) }, t, 0.7);
  W.dustAmt = 0.15; W.dustCol = '#c9d4ff';
}

// 17. "Teeth are money."  close-up of his eyes; imaginary coins float around his head
function s17(W, lt, t) {
  bedroom(W, 'eyes', { focus: V(-0.25, 0.9, -2.0) });
  W.setClock(1, 31);
  const m = manInBed(W, t);
  const coinEyes = t > CUE.money3 - 0.02;
  m.face.set({ eyes: coinEyes ? 'coin' : 'wide', look: [0, 0], brows: 'raised', mouth: coinEyes ? 'grin' : 'pursed', teeth: 'gap' });
  const eyesW = W.man.facePoint(0.5, 0.43);
  const appear = eOutBack(clamp(inv(0, 0.3, lt)));
  W.P.floatCoins.forEach((c, i) => {
    if (i >= 8) return;
    const a = t * 1.5 + (i / 8) * PI * 2;
    const p = eyesW.clone().add(V(Math.cos(a) * 0.27 * appear, 0.13 + Math.sin(a * 2 + i) * 0.02, Math.sin(a) * 0.36 * appear));
    put(c, W.scene, p.toArray(), [t * 3 + i, t * 2 + i * 0.7, 0.3], 0.95 * appear);
    if (i % 2 === 0) W.spark.twinkle(p.clone().add(V(0.02, 0.03, 0.02)), t, 30 + i, 0.06, 2.2, '#fff0b8', false);
  });
  W.rig.fill.position.copy(eyesW).add(V(0, 0.6, 0.3));
  W.man.glintMat.opacity = 0.25 + 0.25 * Math.sin(t * 5);
  const pz = punch(t, CUE.money3 - 0.03, 0.12);
  const d = lerp(1.15, 1.0, eInOut(inv(0, 1.4, lt))) - 0.15 * pz;
  W.cam({ pos: [eyesW.x, eyesW.y + d, eyesW.z + 0.32 * d], target: [eyesW.x, eyesW.y, eyesW.z - 0.02], fov: 42 }, t, 0.8);
  W.dustAmt = 0.25; W.dustCol = '#ffe2a0';
}

// 18. "He sold all of them."  quick montage: pliers (cartoon, no blood) -> sack of teeth
function s18(W, lt, t) {
  bedroom(W, 'day', { focus: V(0.6, 1.0, -1.9) });
  W.setClock(10, 0);
  const sub = t < 25.5 ? 0 : t < 25.93 ? 1 : 2;
  const m = W.man;
  if (sub < 2) {
    manStand(W, MAN_ROOM, 0.4);
    const t0 = sub === 0 ? 25.2 : 25.66;
    const yank = eOut(inv(t0, t0 + 0.08, t));
    m.head.rotation.set(-0.05 - 0.08 * yank, 0, (sub ? 0.06 : -0.06) * yank);
    m.arm('L', [-0.2, 0, 0.6], -0.6, [0, 0, 0], 'fist');
    m.face.set({ mouth: 'wide', teeth: sub === 0 ? 'gap' : 'few', eyes: 'squeeze', brows: 'worried' });
    // pliers come in from his right side, grip a tooth, then yank away (no blood: a pop + stars)
    const pl = put(W.P.pliers, m.head, [-0.14 - 0.22 * yank, 0.13 - 0.02 * yank, 0.36 + 0.18 * yank], [0, PI / 2 - 0.25 - 0.4 * yank, 0.1 + 0.5 * yank], 1.3);
    pl.userData.open(yank > 0 ? 0 : 0.5);
    pl.updateWorldMatrix(true, false);
    m.ik('R', V(0, 0, -0.17).applyMatrix4(pl.matrixWorld), m.local(-0.9, 0.6, 0.2), 'grip');
    put(W.P.pliersTooth, pl.userData.tip, [0, 0, 0.005], [0.4, 0.2, 0.3], 1.0);
    W.P.pliersTooth.visible = yank > 0;
    const mouthW = m.facePoint(0.5, 0.75);
    const pop = inv(t0, t0 + 0.25, t);
    if (pop > 0 && pop < 1) for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + 0.3;
      W.spark.add(mouthW.clone().add(V(Math.cos(a) * 0.2 * eOut(pop), Math.sin(a) * 0.2 * eOut(pop), 0.06)), 0.07 * (1 - pop), 4, a, i % 2 ? '#fff4b0' : '#ffffff', false);
    }
    orbit(W, t, mouthW.toArray(), 1.55, sub === 0 ? 25 : -20, sub === 0 ? 4 : 10, 40, { frameY: -0.05, hand: 1.5, roll: sub ? deg(5) : deg(-3) });
  } else {
    // teeth tumble into a burlap sack
    put(W.P.sack, W.scene, [0.3, 0, -1.0], [0, 0.4, 0], 1.0);
    W.P.looseTeeth.forEach((tt, i) => {
      const t0 = 25.93 + i * 0.022;
      const u = clamp((t - t0) / 0.25);
      const x0 = 0.3 + Math.sin(i * 2.3) * 0.05, z0 = -1.0 + Math.cos(i * 1.7) * 0.05;
      const y = lerp(1.25 + (i % 3) * 0.05, 0.27 + (i % 4) * 0.012, u * u);
      put(tt, W.scene, [x0 + Math.sin(i) * 0.03 * (1 - u), y, z0], [t * 9 + i, t * 7 + i * 2, i], 0.75);
      tt.visible = t > t0 - 0.12 && u < 1;
    });
    W.cam({ pos: [0.62, 1.25, -0.3], target: [0.3, 0.4, -1.0], fov: 44 }, t, 1.2);
  }
  W.dustAmt = 0.35;
}

// 19. "Now he's rich."  golden throne surrounded by piles of coins, toothless grin
function s19(W, lt, t) {
  richRoom(W, 'gold', { focus: V(-0.25, 1.0, -2.0) });
  const m = manSitThrone(W, t);
  m.arm('L', [-0.25, 0, 0.45], -0.55, [0, 0, 0], 'relax');
  const rich = inv(CUE.rich - 0.05, CUE.rich + 0.12, t);
  m.head.rotation.set(-0.05 * rich, 0, 0.04 * Math.sin(t * 3));
  m.face.set({ mouth: 'gums', eyes: 'happy', brows: 'raised', blush: 0.6 });
  if (rich > 0) {
    m.ik('R', m.local(-0.42, lerp(0.95, 1.6, eOutBack(rich)), 0.2), m.local(-1.0, 0.8, -0.2), 'fist');
    holdAt(W, W.P.coin, m, 'R', [0, 0.04, 0.03], [PI / 2, 0, 0.3], 1.15);
  } else m.arm('R', [-0.25, 0, -0.45], -0.55, [0, 0, 0], 'relax');
  const R = (i) => Math.sin(i * 12.9898) * 0.5 + 0.5;
  for (let i = 0; i < 22; i++) {
    const p = V(-2 + R(i) * 4, 0.1 + R(i + 50) * 0.6, -2.7 + R(i + 99) * 1.9);
    W.spark.twinkle(p, t * 1.2, i, 0.07, 2.4, '#fff1c0');
  }
  if (rich > 0) {
    const c = wpos(m.arms.R.hand.grip);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; W.spark.add(c.clone().add(V(Math.cos(a) * 0.18 * rich, Math.sin(a) * 0.18 * rich, 0.05)), 0.08 * (1 - inv(CUE.rich + 0.2, CUE.rich + 0.6, t)), 3, a, '#fff3c0'); }
  }
  const pz = punch(t, CUE.rich - 0.02, 0.13);
  orbit(W, t, [-0.25, lerp(1.15, 1.45, pz), -2.3], lerp(3.7, 3.3, eInOut(inv(0, 1.2, lt))), -5, 6, 46 - 16 * pz, { frameY: lerp(0.06, 0.02, pz) });
  W.dustAmt = 0.55; W.dustCol = '#ffe9b0';
}

// 20. "He can't eat."  big plate of food, gumming a chapati, sad stare; hold 1 s
function s20(W, lt, t) {
  richRoom(W, 'gold', { focus: V(-0.25, 1.0, -1.9) });
  const m = manSitThrone(W, t);
  W.show(W.P.dinner);
  W.P.dinner.position.set(-0.25, 0.2, -1.68);
  const tryEat = t < CUE.eat + 0.15;
  const give = eInOut(inv(CUE.eat + 0.05, CUE.eat + 0.45, t));
  const chew = tryEat ? Math.max(0, Math.sin((t - 27.53) * 16)) : 0;
  m.head.rotation.set(lerp(-0.02, 0.3, give), 0, 0);
  const ch = put(W.P.chapatiMesh, m.head, [0.0, lerp(0.065, -0.1, give), lerp(0.43, 0.5, give)], [lerp(-1.25, -1.45, give), 0, 0], 1.0);
  W.P.chapati.bend(lerp(0.6 + 0.3 * chew, 1.5, give), tryEat ? 0.7 + 0.5 * chew : 0.4, t * 3);
  ch.updateWorldMatrix(true, false);
  m.ik('R', V(-0.14, -0.02, 0).applyMatrix4(ch.matrixWorld), m.local(-0.9, 0.7, 0.1), 'grip');
  m.ik('L', V(0.14, -0.02, 0).applyMatrix4(ch.matrixWorld), m.local(0.9, 0.7, 0.1), 'grip');
  m.face.set(tryEat
    ? { mouth: 'gumsTalk', open: 0.35 + 0.65 * chew, eyes: chew > 0.5 ? 'squeeze' : 'open', brows: 'worried', look: [0, 0.2] }
    : { mouth: 'sadGums', eyes: 'sad', brows: 'sad', look: [0, 0.9] });
  const d = lerp(2.45, 2.2, eInOut(inv(0, 1.9, lt)));
  orbit(W, t, [-0.25, 1.22, -1.95], d, 0, 3, 44, { frameY: 0.13, hand: 0.8 });
  W.dustAmt = 0.4; W.dustCol = '#ffe9b0';
}

export const SHOTS = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20];
