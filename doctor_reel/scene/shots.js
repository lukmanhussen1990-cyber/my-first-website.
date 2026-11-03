// The 48 shots of the doctor reel as code-made low-poly 3D animations (one entry per shot; every shot is a clip).
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

// ------------------------------------------------------------------ shared helpers
const LX = S.LIV.x0, OX = S.OFF.x0, WX = S.WR.x0, CX = S.CLIN.x0;
const bellyPos = (ch) => ch.belly.getWorldPosition(V());
const handsOnBelly = (ch, squeeze = 0) => {
  const b = bellyPos(ch), F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x), R = ch.bellyR;
  ch.p.handL = [b.x + L.x * (R * 0.95 - squeeze) + F.x * 0.05, b.y + 0.02, b.z + L.z * (R * 0.95 - squeeze) + F.z * 0.05];
  ch.p.handR = [b.x - L.x * (R * 0.95 - squeeze) + F.x * 0.05, b.y + 0.02, b.z - L.z * (R * 0.95 - squeeze) + F.z * 0.05];
  ch.p.handPoseL = ch.p.handPoseR = 'flat';
  ch.p.handRotL = handRot([F.x, 0.3, F.z], [L.x, 0, L.z]); ch.p.handRotR = handRot([F.x, 0.3, F.z], [-L.x, 0, -L.z]);
};
const handsOnCheeks = (ch) => { const l = hl(ch, 0.09, -0.04, 0.04), r = hl(ch, -0.09, -0.04, 0.04); ch.p.handL = P3(l); ch.p.handR = P3(r); ch.p.handPoseL = ch.p.handPoseR = 'flat'; };
// the balloon belly: wobble (k = amount), rumble (fast shake), dent (a press, 0..1), size (1 = huge, 0.25 = flat)
const bellyFx = (ch, { wob = 0, t = 0, rumble = 0, dent = 0, size = 1 } = {}) => {
  const b = ch.belly, s = size;
  const w = wob * Math.sin(t * 11) * 0.06, r = rumble * 0.025;
  b.scale.set(s * (1 + w + r * Math.sin(t * 61)), s * (1 - w * 0.7 + r * Math.sin(t * 47 + 1)), s * (1 - dent * 0.32 + w * 0.5));
  b.position.x = r * 0.6 * Math.sin(t * 53);
  b.position.z = ch.spec.chestD * 0.4 + ch.bellyR * 0.62 * (0.25 + 0.75 * s) - dent * 0.04;
};
// reaction camera: in front of a person, turned toward where they look, so they face the lens
const lookCam = (ch, target, dist = 0.62, fov = 42, mixF = 1.0) => {
  const h = ch.headPos(), d = V(...target).sub(h); d.y = 0; d.normalize(); const F = fwd(ch.p.rotY);
  const dir = d.multiplyScalar(0.6).add(F.multiplyScalar(mixF)).normalize();
  return camAt(P3(h.clone().addScaledVector(dir, dist).add(V(0, -0.03, 0))), [h.x, h.y - 0.02, h.z], fov);
};
const bounceBack = (t) => (t < 0 ? 0 : Math.exp(-t * 6) * Math.cos(t * 26));   // spring after the press
function living(W) { S.lights(W, { sky: 0xfff0dc, ground: 0x9a7a5a, hemi: 0.75, key: 0xffd8a8, keyI: 0.9 }); S.keyAt(W, [LX, 1, 0], { from: [2, 5, 3], size: 4 }); W.scene.background = new THREE.Color('#2a2018'); return { L: S.buildLiving(W) }; }
function office(W) { S.lights(W, { sky: 0xfff6ea, ground: 0x9a9a8a, hemi: 0.8, key: 0xfff0dc, keyI: 0.9 }); S.keyAt(W, [OX, 1, 0], { from: [2, 5, 3], size: 4 }); W.scene.background = new THREE.Color('#2a2a2a'); return { O: S.buildOffice(W) }; }
function waiting(W, o = {}) { S.lights(W, { sky: 0xfff4e4, ground: 0x9a8a72, hemi: 0.8, key: 0xffe8c8, keyI: 0.9 }); S.keyAt(W, [WX, 1, 0.5], { from: [2, 6, 4], size: 6 }); W.scene.background = new THREE.Color('#2a2420'); return { R: S.buildWaiting(W, o) }; }
function clinicOut(W) { S.lights(W, { sky: 0xcfe4ff, ground: 0x8a8a7a, hemi: 0.85, key: 0xfff4e0, keyI: 1.9 }); S.keyAt(W, [CX, 1, 3], { from: [6, 10, 8], size: 10 }); S.skyDome(W, 'sunset', [CX, 0, 0]); return { C: S.buildClinic(W) }; }
// the waiting room crowd in their seats (row 1: old man, YOU, lady, kid), the receptionist at her desk
const seat = (row, i) => [WX + S.WR.rows[row][0] - 1.375 + i * 0.55, S.WR.rows[row][1] + 0.04];
function crowd(W, c, { you = true } = {}) {
  c.om = person(W, 'oldman'); c.la = person(W, 'lady'); c.ki = person(W, 'kid'); c.re = person(W, 'recep');
  if (you) c.you = person(W, 'you');
  c.mag = S.magazine(W.scene); c.cane = S.caneProp(W.scene);
  return c;
}
function seatCrowd(c, lt, { look = null, mag = 0 } = {}) {
  const sit = (ch, row, i) => { const [x, z] = seat(row, i); sitAt(ch, x, z, Math.PI); };
  sit(c.om, 0, 1); if (c.you) sit(c.you, 0, 2); sit(c.la, 0, 3); sit(c.ki, 0, 4);
  standAt(c.re, WX + 2.95, S.WR.recep[1], -Math.PI / 2);
  const tgt = look ? P3(look) : null;
  face(c.om, 'open', 'neutral', 'neutral', tgt ? { lookAt: tgt } : { headPitch: -0.1 });
  face(c.la, 'open', 'neutral', 'smile', tgt ? { lookAt: tgt } : { headPitch: -0.35 });
  face(c.ki, 'open', 'neutral', 'neutral', tgt ? { lookAt: tgt } : { headYaw: 0.3 });
  face(c.re, 'open', 'neutral', 'smile', tgt ? { lookAt: tgt } : { headPitch: -0.3 });
  const [lx, lz] = seat(0, 3), F = fwd(Math.PI);
  c.mag.position.set(lx + F.x * 0.3, 0.95 - mag * 0.25, lz + F.z * 0.3); c.mag.rotation.set(-0.3 + mag * 0.5, Math.PI, 0);
  c.la.p.gripL = { prop: c.mag, which: 'L' }; c.la.p.gripR = { prop: c.mag, which: 'R' };
  const [ox, oz] = seat(0, 1); c.cane.position.set(ox - 0.05, 0, oz - 0.32); c.cane.rotation.set(0.12, Math.PI, 0); c.om.p.gripR = c.cane;
  c.ki.p.handL = rel(c.ki, 0.18, 0.05, 0.72); c.ki.p.handPoseL = 'relaxed';
  c.re.p.handL = [WX + 2.55, 1.07, S.WR.recep[1] - 0.2]; c.re.p.handR = [WX + 2.55, 1.07, S.WR.recep[1] + 0.2]; c.re.p.handPoseL = c.re.p.handPoseR = 'flat';
}
// the toilet line: 10 people along the left wall facing the OCCUPIED door
function lineup(W, c, n = 10) { c.line = []; for (let i = 0; i < n; i++) c.line.push(person(W, `crowd${i + 40}`)); return c; }
function poseLine(c, lt, { look = null } = {}) {
  c.line.forEach((ch, i) => {
    standAt(ch, WX - 2.95 + (i % 2) * 0.08, -0.55 + i * 0.42, Math.PI); ch.p.legBounce = 0.4;
    face(ch, i % 3 ? 'squint' : 'open', 'worried', i % 2 ? 'tight' : 'frown', look ? { lookAt: P3(look) } : { headYaw: (hash1(i) - 0.5) * 0.4 });
    if (i % 3 === 0) { const F = fwd(ch.p.rotY), cp = ch.chestPos(); ch.p.handL = [cp.x + F.x * 0.18 + 0.06, cp.y - 0.25, cp.z + F.z * 0.18]; ch.p.handR = [cp.x + F.x * 0.18 - 0.06, cp.y - 0.25, cp.z + F.z * 0.18]; }
  });
}
// the toilet behind the door (when it opens): a small lit room
function toiletRoom(W, c) {
  c.R.inside.visible = false;
  const g = new THREE.Group(); g.position.set(WX - 4.05, 0, -1.2); W.scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color: '#cfe8e2', roughness: 0.6, side: THREE.BackSide, flatShading: true });
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const room = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.6, 1.4).translate(0, 1.3, 0), [m, hide, m, m, m, m]); g.add(room);
  S.toiletAt(g, -0.3, -0.1, { water: 0.2 }).group.rotation.y = Math.PI / 2;
  const l = new THREE.PointLight(0xfff0dc, 3, 3, 2); l.position.set(0, 2.2, 0); g.add(l);
  return g;
}

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 "You're staying at your friend's house." YOU on the friend's sofa, huge belly, sweaty
  1: {
    build(W) { const c = living(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { sitAt(c.you, LX, -0.82, 0); face(c.you, 'open', 'worried', 'tight', { headPitch: -0.05 }); handsOnBelly(c.you); },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.25, t: lt }); },
    cam: (W, c, lt) => camAt([LX + 1.5 - lt * 0.1, 1.35, 1.9], [LX - 0.1, 0.85, -0.75], 50),
    anchors: (W, c) => ({ forehead: forehead(c.you), belly: bellyPos(c.you) }),
  },
  // 02 "And you haven't pooped" the calendar: red X marks appear one by one
  2: {
    build(W) { const c = living(W); return c; },
    update(W, c, lt) { const n = 1 + Math.min(3, Math.floor(lt / 0.27)); c.L.cal.userData.cross(n, clamp((lt % 0.27) / 0.2)); },
    cam: (W, c, lt) => camAt([LX - 0.85 - lt * 0.08, 1.5, -0.05], [LX - 1.97, 1.55, -0.2], 46),
  },
  // 03 "in five days." ECU: the fifth big red X
  3: {
    build(W) { const c = living(W); return c; },
    update(W, c, lt) { c.L.cal.userData.cross(5, clamp((lt - 0.15) / 0.45)); },
    cam: (W, c, lt) => camAt([LX - 1.38 - lt * 0.05, 1.53, -0.17], [LX - 1.97, 1.53, -0.17], 40),
  },
  // 04 "Your stomach is" side view: YOU stands, a HUGE round belly, the t-shirt far too small
  4: {
    build(W) { const c = living(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, LX + 0.2, -0.1, Math.PI / 2); face(c.you, 'open', 'worried', 'frown', { headPitch: -0.3, lean: -0.08 }); c.you.p.handL = rel(c.you, -0.05, 0.3, 0.85); c.you.p.handR = rel(c.you, -0.05, -0.3, 0.85); },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.4, t: lt }); },
    cam: (W, c, lt) => camAt([LX + 0.35, 1.15, 1.85], [LX + 0.35, 1.0, -0.1], 46),
    anchors: (W, c) => ({ forehead: forehead(c.you), belly: bellyPos(c.you) }),
  },
  // 05 "a balloon." slow zoom on the huge belly, it wobbles
  5: {
    build(W) { const c = living(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, LX + 0.2, -0.1, 0.15); face(c.you, 'open', 'worried', 'frown'); c.you.p.handL = rel(c.you, -0.05, 0.32, 0.85); c.you.p.handR = rel(c.you, -0.05, -0.32, 0.85); },
    after(W, c, lt) { bellyFx(c.you, { wob: 1.0, t: lt }); },
    cam: (W, c, lt) => { const b = bellyPos(c.you), F = fwd(c.you.p.rotY); const d = 1.25 - lt * 0.32; return camAt([b.x + F.x * d + 0.1, b.y + 0.1, b.z + F.z * d], [b.x, b.y + 0.02, b.z], 44); },
    anchors: (W, c) => ({ belly: bellyPos(c.you) }),
  },
  // 06 "Your friend's mom thinks you're" the mom comes in from the kitchen
  6: {
    build(W) { const c = living(W); c.you = person(W, 'you'); c.mom = person(W, 'mom'); return c; },
    update(W, c, lt) {
      standAt(c.you, LX + 0.2, -0.1, 0.4); face(c.you, 'open', 'worried', 'tight');
      const k = clamp(lt / 1.0); standAt(c.mom, LX + lerp(1.9, 1.05, k), lerp(0.3, 0.25, k), -Math.PI / 2); c.mom.p.walk = lt * 7; face(c.mom, 'happy', 'raised', 'smile');
    },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.3, t: lt }); },
    cam: (W, c, lt) => camAt([LX + 0.95, 1.45, 2.75], [LX + 0.8, 1.1, 0.05], 56),
  },
  // 07 "pregnant." the mom gasps and touches the belly
  7: {
    build(W) { const c = living(W); c.you = person(W, 'you'); c.mom = person(W, 'mom'); return c; },
    update(W, c, lt) {
      standAt(c.you, LX + 0.2, -0.1, 0.4); face(c.you, 'open', 'worried', 'tight', { lookAt: P3(c.mom.headPos()) });
      standAt(c.mom, LX + 0.95, 0.35, -Math.PI / 2 - 0.3); face(c.mom, 'wide', 'raised', 'o', { lookAt: P3(bellyPos(c.you)) });
      c.mom.p.handL = P3(hl(c.mom, 0.09, -0.04, 0.05)); c.mom.p.handPoseL = 'flat';
      const b = bellyPos(c.you), F = fwd(c.you.p.rotY), k = smooth(clamp((lt - 0.3) / 0.35));
      c.mom.p.handR = [b.x + F.x * (c.you.bellyR + 0.02) + 0.05, b.y + 0.05, b.z + F.z * (c.you.bellyR + 0.02)].map((v, i) => lerp(P3(c.mom.chestPos())[i], v, k)); c.mom.p.handPoseR = 'flat';
    },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.5, t: lt }); },
    cam: (W, c, lt) => { const h = c.mom.headPos(), b = bellyPos(c.you); return camAt([h.x + 0.2, h.y - 0.25, h.z + 1.35], [(h.x + b.x) / 2, (h.y + b.y) / 2, (h.z + b.z) / 2], 46); },
  },
  // 08 "You go to the doctor." YOU waddles into the clinic
  8: {
    build(W) { const c = clinicOut(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { const z = 4.2 - lt * 1.1; standAt(c.you, CX + 0.1, z, Math.PI); c.you.p.walk = lt * 8; c.you.p.leanSide = 0.12 * Math.sin(lt * 8); c.you.p.lean = -0.08; face(c.you, 'open', 'worried', 'tight'); handsOnBelly(c.you); },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.6, t: lt }); },
    cam: (W, c, lt) => camAt([CX + 3.4, 1.8, 8.4 - lt * 0.3], [CX + 0.0, 2.3, 1.5], 58),
  },
  // 09 "He presses your stomach." the doctor pushes the belly; it dents and bounces back like a balloon
  9: {
    build(W) { const c = office(W); c.you = person(W, 'you'); c.dr = person(W, 'doctor'); return c; },
    update(W, c, lt) {
      standAt(c.you, OX - 0.35, 0.3, Math.PI / 2); face(c.you, lt > 0.5 ? 'wide' : 'open', 'worried', lt > 0.5 ? 'o' : 'tight', { lookAt: P3(c.dr.headPos()) });
      standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2); face(c.dr, 'squint', 'neutral', 'tight', { lookAt: P3(bellyPos(c.you)) });
      const b = bellyPos(c.you), push = smooth(clamp((lt - 0.2) / 0.3)) * (1 - smooth(clamp((lt - 0.62) / 0.12)));
      const fx_ = b.x + c.you.bellyR + 0.03 - push * 0.1;
      c.dr.p.handL = [fx_, b.y + 0.06, b.z + 0.1]; c.dr.p.handR = [fx_, b.y + 0.06, b.z - 0.1]; c.dr.p.handPoseL = c.dr.p.handPoseR = 'flat';
      c.dr.p.handRotL = handRot([-1, 0.2, 0], [0, 0, 1]); c.dr.p.handRotR = handRot([-1, 0.2, 0], [0, 0, -1]);
    },
    after(W, c, lt) { const push = smooth(clamp((lt - 0.2) / 0.3)) * (1 - smooth(clamp((lt - 0.62) / 0.12))); bellyFx(c.you, { dent: push - 0.6 * bounceBack(lt - 0.74), t: lt }); },
    cam: (W, c, lt) => camAt([OX + 0.15, 1.35, 2.7 - lt * 0.15], [OX + 0.1, 1.1, 0.3], 50),
    anchors: (W, c) => ({ belly: bellyPos(c.you) }),
  },
  // 10 "Hmm." the doctor, hand on his chin
  10: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); return c; },
    update(W, c, lt) { standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2 + 0.3); face(c.dr, 'squint', 'skeptic', 'tight', { headPitch: -0.1 }); const ch = hl(c.dr, 0.0, -0.11, 0.07); c.dr.p.handR = P3(ch); c.dr.p.handPoseR = 'relaxed'; c.dr.p.handL = rel(c.dr, 0.2, 0.1, 1.05); },
    cam: (W, c) => headCam(c.dr, 0.85, -0.08, 0.05, -0.05, 42),
  },
  // 11 "Very serious." ECU: the serious face, the glasses shine
  11: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); return c; },
    update(W, c, lt) { standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2 + 0.3); face(c.dr, 'open', 'angry', 'tight', { headPitch: -0.05 }); },
    cam: (W, c, lt) => headCam(c.dr, 0.5 - lt * 0.05, -0.02, 0.0, 0.0, 40),
    anchors: (W, c) => ({ glasses: c.dr.glassesPos(1) }),
  },
  // 12 "He gives you the strongest" the doctor takes a bottle from the medicine shelf
  12: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); c.mb = S.medBottle(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.dr, OX + 0.15, -0.9, Math.PI); face(c.dr, 'open', 'raised', 'tight', { headPitch: 0.3 });
      const k = smooth(clamp(lt / 0.5)); const p = lerp3([OX + 0.25, 1.38, -1.42], [OX + 0.22, 1.42, -1.1], k);
      c.mb.position.set(...p); c.dr.p.gripR = c.mb;
    },
    cam: (W, c) => camAt([OX + 1.3, 1.45, -0.35], [OX + 0.15, 1.3, -1.1], 50),
  },
  // 13 "medicine." the glowing bottle with the skull sticker, sparkles
  13: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); c.mb = S.medBottle(W.scene, 1.6); return c; },
    update(W, c, lt) {
      standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2); face(c.dr, 'squint', 'raised', 'tight');
      const p = rel(c.dr, 0.38, -0.05, 1.42 + 0.02 * Math.sin(lt * 3)); c.mb.position.set(...p); c.mb.rotation.y = -Math.PI / 2 + Math.sin(lt * 1.5) * 0.4; c.dr.p.gripR = c.mb;
    },
    cam: (W, c, lt) => { const b = c.mb.position; return camAt([b.x - 0.55 + lt * 0.08, b.y + 0.12, b.z + 0.1], [b.x, b.y + 0.12, b.z], 42); },
    anchors: (W, c) => ({ bottle: c.mb.localToWorld(V(0, 0.15, 0)) }),
  },
  // 14 "Take one." the doctor holds up one finger
  14: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); return c; },
    update(W, c, lt) {
      standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2 + 0.25); face(c.dr, 'open', 'raised', 'tight');
      const h = c.dr.headPos(), F = fwd(c.dr.p.rotY), L = V(F.z, 0, -F.x), up = smooth(clamp(lt / 0.25));
      c.dr.p.handR = [h.x + F.x * 0.28 - L.x * 0.16, h.y - 0.15 + 0.12 * up, h.z + F.z * 0.28 - L.z * 0.16]; c.dr.p.handPoseR = 'point'; c.dr.p.handRotR = handRot([0, 1, 0], [-F.x, 0, -F.z]);
    },
    cam: (W, c) => headCam(c.dr, 0.95, -0.1, 0.12, -0.05, 44),
  },
  // 15 "ONLY ONE." ECU: the finger, the stern face
  15: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); return c; },
    update(W, c, lt) {
      standAt(c.dr, OX + 0.55, 0.3, -Math.PI / 2 + 0.25); face(c.dr, 'squint', 'angry', 'tight', { headPitch: 0.05 });
      const h = c.dr.headPos(), F = fwd(c.dr.p.rotY), L = V(F.z, 0, -F.x), wag = 0.03 * Math.sin(lt * 14);
      c.dr.p.handR = [h.x + F.x * 0.3 - L.x * (0.05 + wag), h.y - 0.02, h.z + F.z * 0.3 - L.z * (0.05 + wag)]; c.dr.p.handPoseR = 'point'; c.dr.p.handRotR = handRot([0, 1, 0], [-F.x, 0, -F.z]);
    },
    cam: (W, c, lt) => { const f = V(...c.dr.p.handR), h = c.dr.headPos(), F = fwd(c.dr.p.rotY); const m = f.clone().lerp(h, 0.45); return camAt([m.x + F.x * (0.62 - lt * 0.06), m.y + 0.02, m.z + F.z * (0.62 - lt * 0.06)], P3(m), 44); },
  },
  // 16 "You take three." YOU throws three pills in his mouth; the doctor writes at his desk and doesn't see
  16: {
    build(W) { const c = office(W); c.you = person(W, 'you'); c.dr = person(W, 'doctor'); c.pills = [0, 1, 2].map(() => S.pill(W.scene)); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.44, 10).translate(0, 0.22, 0), new THREE.MeshStandardMaterial({ color: '#c8ccd0', flatShading: true })); st.position.set(OX - 0.35, 0, 0.62); W.scene.add(st); return c; },
    update(W, c, lt) {
      sitAt(c.you, OX - 0.35, 0.62, 0.35); face(c.you, lt > 0.2 ? 'squint' : 'open', 'raised', lt > 0.2 ? 'open' : 'smile', { headPitch: 0.25 });
      const m = c.you.mouthPos(), F = fwd(c.you.p.rotY);
      c.you.p.handR = [m.x + F.x * 0.15 - 0.03, m.y + 0.02, m.z + F.z * 0.15]; c.you.p.handPoseR = 'relaxed';
      c.pills.forEach((p, i) => { const q = clamp((lt - 0.15 - i * 0.28) / 0.22); p.visible = q < 1; p.position.set(m.x + F.x * 0.15 * (1 - q), m.y + 0.03 + Math.sin(q * Math.PI) * 0.12, m.z + F.z * 0.15 * (1 - q)); p.rotation.set(lt * 9, lt * 7, 0); });
      sitAt(c.dr, OX + 0.75, 0.35, Math.PI / 2); face(c.dr, 'squint', 'neutral', 'tight', { headPitch: -0.45 });
      c.dr.p.handR = [OX + 1.15, 0.8, 0.4 + 0.03 * Math.sin(lt * 12)]; c.dr.p.handPoseR = 'grip'; c.dr.p.handL = [OX + 1.12, 0.78, 0.15]; c.dr.p.handPoseL = 'flat';
    },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.2, t: lt }); },
    cam: (W, c) => headCam(c.you, 1.35, -0.12, 0.3, -0.18, 54),
  },
  // 17 "You sit in the waiting room." YOU between the old man, the lady with the magazine and the kid in a cast
  17: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, 'happy', 'raised', 'smile'); handsOnBelly(c.you); },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.15, t: lt }); },
    cam: (W, c, lt) => camAt([WX + 0.1 + lt * 0.1, 1.6, -2.4], [WX - 0.2, 0.85, 0.7], 60),
  },
  // 18 "Nothing." YOU smiles
  18: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, 'happy', 'raised', 'smile'); handsOnBelly(c.you); },
    cam: (W, c) => headCam(c.you, 0.8, -0.1, 0.05, -0.1, 44),
  },
  // 19 "One minute." the wall clock ticks
  19: {
    build(W) { const c = waiting(W); return c; },
    update(W, c, lt) { c.R.clock.userData.set(20 + Math.floor(lt * 1.0 + 0.6)); },
    cam: () => { const k = S.WR.clock; return camAt([WX + k[0] + 0.05, k[1] - 0.05, k[2] + 1.0], [WX + k[0], k[1], k[2]], 40); },
  },
  // 20 "Nothing." YOU smiles, thumbs up
  20: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, 'happy', 'raised', 'grin'); c.you.p.handR = rel(c.you, 0.32, -0.12, 1.12); c.you.p.handPoseR = 'thumb'; c.you.p.handRotR = handRot([0, 0, -1], [-1, 0, 0]); },
    cam: (W, c) => headCam(c.you, 0.95, -0.15, 0.1, -0.15, 46),
  },
  // 21 "Then…" ECU: the smile freezes, the eyes go wide
  21: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, lt > 0.3 ? 'wide' : 'happy', lt > 0.3 ? 'worried' : 'raised', 'grin'); },
    cam: (W, c, lt) => headCam(c.you, 0.45 - lt * 0.08, -0.02, 0, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 22 "Your stomach" ECU: the belly shakes and rumbles
  22: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, 'wide', 'worried', 'tight'); },
    after(W, c, lt) { bellyFx(c.you, { rumble: 1, wob: 0.4, t: lt }); },
    cam: (W, c) => { const b = bellyPos(c.you); return camAt([b.x + 0.1, b.y + 0.1, b.z - 0.95], [b.x, b.y, b.z], 46); },
    anchors: (W, c) => ({ belly: bellyPos(c.you) }),
  },
  // 23 "starts talking." YOU holds his belly, sweating
  23: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt); face(c.you, 'wide', 'worried', 'grimace', { shoulderUp: 0.6 }); handsOnBelly(c.you, 0.03); },
    after(W, c, lt) { bellyFx(c.you, { rumble: 0.8, wob: 0.3, t: lt }); },
    cam: (W, c) => headCam(c.you, 1.15, -0.32, 0.1, -0.3, 48),
    anchors: (W, c) => ({ forehead: forehead(c.you), belly: bellyPos(c.you) }),
  },
  // 24 "LOUD." the belly rumbles, screen shake
  24: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt, { look: c.you ? c.you.headPos() : null }); face(c.you, 'wide', 'worried', 'grimace', { shoulderUp: 1 }); handsOnBelly(c.you, 0.03); },
    after(W, c, lt) { bellyFx(c.you, { rumble: 2.2, wob: 0.8, t: lt }); },
    cam: (W, c, lt) => { const b = bellyPos(c.you); return camAt([b.x + 0.4, b.y + 0.35, b.z - 1.6], [b.x, b.y + 0.2, b.z], 54); },
    anchors: (W, c) => ({ belly: bellyPos(c.you) }),
  },
  // 25-28 "Everyone in the waiting room looks at you." quick reaction shots
  25: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt, { look: bellyPos(c.you) }); face(c.om, 'wide', 'raised', 'o', { lookAt: P3(c.om.headPos().add(fwd(Math.PI).multiplyScalar(0.6))) }); },
    cam: (W, c) => headCam(c.om, 0.62, -0.03, 0.0, -0.02, 42),
  },
  26: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt, { look: bellyPos(c.you), mag: smooth(clamp(lt / 0.25)) }); face(c.la, 'wide', 'raised', 'o', { lookAt: P3(c.la.headPos().add(fwd(Math.PI).multiplyScalar(0.6))) }); },
    cam: (W, c) => headCam(c.la, 0.75, -0.1, 0.0, -0.06, 46),
  },
  27: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt, { look: bellyPos(c.you) }); face(c.ki, 'wide', 'raised', 'grin', { lookAt: P3(c.ki.headPos().add(fwd(Math.PI).multiplyScalar(0.6))) }); },
    cam: (W, c) => headCam(c.ki, 0.62, -0.03, 0.0, -0.02, 46),
  },
  28: {
    build(W) { const c = crowd(W, waiting(W)); return c; },
    update(W, c, lt) { seatCrowd(c, lt, { look: c.you.headPos() }); face(c.re, 'wide', 'raised', 'o', { lookAt: P3(bellyPos(c.you)), lean: 0.15 }); },
    cam: (W, c) => headCam(c.re, 0.7, -0.05, 0.1, -0.03, 44),
  },
  // 29 "You run to the toilet." tiny fast steps, holding the belly
  29: {
    build(W) { const c = waiting(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { const x = WX + 1.2 - lt * 2.0; standAt(c.you, x, 2.6, -Math.PI / 2); c.you.p.walk = lt * 22; c.you.p.lean = 0.12; face(c.you, 'wide', 'worried', 'grimace'); handsOnBelly(c.you); },
    after(W, c, lt) { bellyFx(c.you, { wob: 0.8, rumble: 0.5, t: lt * 2 }); },
    cam: (W, c, lt) => { const x = WX + 1.2 - lt * 2.0; return camAt([x - 0.7, 1.3, 4.6], [x - 0.35, 1.0, 2.6], 56); },
    anchors: (W, c) => ({ belly: bellyPos(c.you), forehead: forehead(c.you) }),
  },
  // 30 "There's a line." a long line in front of the OCCUPIED door
  30: {
    build(W) { const c = lineup(W, waiting(W)); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { poseLine(c, lt); standAt(c.you, WX - 2.85, 3.85, Math.PI); face(c.you, 'wide', 'worried', 'o'); handsOnBelly(c.you); },
    cam: (W, c, lt) => camAt([WX - 1.2, 1.6, 4.3], [WX - 3.1, 1.2, -1.2], 50),
  },
  // 31 "Ten people." the camera passes along the line
  31: {
    build(W) { const c = lineup(W, waiting(W)); return c; },
    update(W, c, lt) { poseLine(c, lt); },
    cam: (W, c, lt) => { const z = 3.2 - lt * 2.6; return camAt([WX - 0.95, 1.5, z + 0.4], [WX - 2.95, 1.35, z - 0.3], 52); },
  },
  // 32 "You can't wait!" close-up, giant sweat drops
  32: {
    build(W) { const c = lineup(W, waiting(W)); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { poseLine(c, lt); standAt(c.you, WX - 2.85, 3.85, Math.PI); c.you.p.legBounce = 1; face(c.you, 'wide', 'worried', 'grimace', { shoulderUp: 1 }); handsOnBelly(c.you, 0.04); },
    after(W, c, lt) { bellyFx(c.you, { rumble: 1, t: lt }); },
    cam: (W, c) => headCam(c.you, 0.62, -0.06, -0.05, -0.04, 42),
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, 0.8) }),
  },
  // 33 "PLEASE!" YOU bangs on the toilet door
  33: {
    build(W) { const c = lineup(W, waiting(W)); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      poseLine(c, lt, { look: c.you.headPos() }); c.line[0].p.pos[1] += 0.55;
      standAt(c.you, WX - 2.95, -1.2, -Math.PI / 2); face(c.you, 'squint', 'worried', 'yell', { lean: 0.1 });
      const a = Math.sin(lt * 18) > 0, b = Math.sin(lt * 18 + Math.PI) > 0;
      c.you.p.handL = [WX - 3.3 + (a ? 0 : 0.08), 1.45, -1.05]; c.you.p.handR = [WX - 3.3 + (b ? 0 : 0.08), 1.5, -1.35]; c.you.p.handPoseL = c.you.p.handPoseR = 'fist';
    },
    after(W, c, lt) { bellyFx(c.you, { rumble: 1, t: lt }); c.R.door.rotation.z = 0.004 * Math.sin(lt * 36); },
    cam: (W, c, lt) => camAt([WX - 1.6, 1.4, 0.5], [WX - 3.1, 1.25, -1.2], 50),
  },
  // 34 "IT'S AN EMERGENCY!" close-up: the fists bang, the OCCUPIED sign shakes
  34: {
    build(W) { const c = waiting(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      standAt(c.you, WX - 2.95, -1.2, -Math.PI / 2); face(c.you, 'squint', 'worried', 'yell');
      const a = Math.sin(lt * 18) > 0, b = Math.sin(lt * 18 + Math.PI) > 0;
      c.you.p.handL = [WX - 3.3 + (a ? 0 : 0.08), 1.45, -1.05]; c.you.p.handR = [WX - 3.3 + (b ? 0 : 0.08), 1.5, -1.35]; c.you.p.handPoseL = c.you.p.handPoseR = 'fist';
    },
    after(W, c, lt) { c.R.sign.rotation.z = 0.1 * Math.sin(lt * 36); },
    cam: (W, c, lt) => camAt([WX - 2.6, 1.6, -0.35], [WX - 3.38, 1.5, -1.25], 46),
  },
  // 35 "The door opens." slowly, from YOU's side
  35: {
    build(W) { const c = waiting(W); c.you = person(W, 'you'); c.dr = person(W, 'doctor'); toiletRoom(W, c); return c; },
    update(W, c, lt) {
      standAt(c.you, WX - 2.75, -1.2, -Math.PI / 2); face(c.you, 'wide', 'worried', 'o'); handsOnBelly(c.you);
      standAt(c.dr, WX - 3.85, -1.2, Math.PI / 2); face(c.dr, 'open', 'neutral', 'neutral');
      c.R.door.rotation.y = -1.6 * smooth(clamp(lt / 1.2));
    },
    cam: (W, c, lt) => camAt([WX - 2.35, 1.55, -0.45], [WX - 3.5, 1.4, -1.25], 48),
  },
  // 36 "It's the doctor." low angle: the doctor standing in the doorway
  36: {
    build(W) { const c = waiting(W); c.dr = person(W, 'doctor'); toiletRoom(W, c); return c; },
    update(W, c, lt) { c.R.door.rotation.y = -1.6; standAt(c.dr, WX - 3.6, -1.2, Math.PI / 2); face(c.dr, 'wide', 'raised', 'o'); c.dr.p.handL = rel(c.dr, 0.2, 0.3, 1.0); c.dr.p.handPoseL = 'flat'; },
    cam: (W, c, lt) => { const h = c.dr.headPos(); return camAt([h.x + 1.3, 0.6, h.z + 0.3], [h.x, h.y - 0.4, h.z], 54); },
  },
  // 37 "Then…" ECU: YOU's eyes
  37: {
    build(W) { const c = waiting(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, WX - 2.75, -1.2, -Math.PI / 2); face(c.you, 'wide', 'worried', 'tight', { pupils: [0, -0.2] }); },
    cam: (W, c, lt) => { const e = hl(c.you, 0, 0.012, 0.09); const p = hl(c.you, 0, 0.012, 0.36 - lt * 0.06); return camAt(P3(p), P3(e), 36); },
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 38 "It happens." freeze frame: the giant green stink cloud bursts between them
  38: {
    build(W) { const c = waiting(W); c.you = person(W, 'you'); c.dr = person(W, 'doctor'); toiletRoom(W, c); return c; },
    update(W, c, lt) {
      c.R.door.rotation.y = -1.6;
      standAt(c.you, WX - 2.8, -1.2, Math.PI / 2 + 0.6); c.you.p.sit = 0.35; face(c.you, 'closed', 'raised', 'smile', { headPitch: 0.1 });
      standAt(c.dr, WX - 3.55, -1.2, Math.PI / 2); face(c.dr, 'wide', 'raised', 'o', { lean: -0.1 });
    },
    cam: (W, c, lt) => camAt([WX - 1.7, 1.35, 0.15], [WX - 3.2, 1.0, -1.2], 54),
    anchors: (W, c) => ({ cloud: c.you._w(V(0, 0.0, -0.25), c.you.pelvis) }),
  },
  // 39 "Right there." wide: the cloud spreads over the line; everyone's faces
  39: {
    build(W) { const c = lineup(W, waiting(W)); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      poseLine(c, lt, { look: c.you.headPos() }); c.line.forEach((ch) => { face(ch, 'wide', 'raised', 'yell'); handsOnCheeks(ch); });
      standAt(c.you, WX - 2.8, -1.2, Math.PI / 2 + 0.6); c.you.p.sit = 0.35; face(c.you, 'closed', 'raised', 'smile');
    },
    cam: (W, c, lt) => camAt([WX - 0.9, 1.7, 4.2], [WX - 2.9, 1.0, 0.0], 52),
    anchors: (W, c) => ({ cloud: c.you._w(V(0, 0.1, -0.2), c.you.pelvis) }),
  },
  // 40 "On the doctor's new shoes." slow tilt down to the shoes: not shiny any more
  40: {
    build(W) {
      const c = waiting(W); c.dr = person(W, 'doctor'); toiletRoom(W, c);
      c.dr.root.traverse((o) => { if (o.isMesh && /shoe[LR]$/.test(o.name)) o.material = c.dr.shoeDull; });
      c.sp = [S.splat(W.scene, 0.55, 3), S.splat(W.scene, 0.5, 5)];
      return c;
    },
    update(W, c, lt) { c.R.door.rotation.y = -1.6; standAt(c.dr, WX - 3.55, -1.2, Math.PI / 2); face(c.dr, 'open', 'neutral', 'neutral'); },
    after(W, c) { ['L', 'R'].forEach((s2, i) => { const p = c.dr.legs[s2].shoe.getWorldPosition(V()); c.sp[i].position.set(p.x + 0.12, p.y + 0.09, p.z); c.sp[i].rotation.set(0, i, 0.15); }); },
    cam: (W, c, lt) => { const k = easeInOut(clamp(lt / 1.8)); const h = c.dr.headPos(); return camAt([h.x + 1.25, lerp(h.y, 0.35, k), h.z + 0.25], [h.x, lerp(h.y - 0.05, 0.08, k), h.z], 44); },
    anchors: (W, c) => ({ shoes: c.dr.legs.L.shoe.getWorldPosition(V()).lerp(c.dr.legs.R.shoe.getWorldPosition(V()), 0.5).add(V(0.1, 0.1, 0)) }),
    still: 0.95,
  },
  // 41 "Silence." everyone frozen, green stink lines
  41: {
    build(W) { const c = crowd(W, lineup(W, waiting(W)), { you: true }); c.dr = person(W, 'doctor'); toiletRoom(W, c); return c; },
    update(W, c, lt) {
      c.R.door.rotation.y = -1.6;
      seatCrowd(c, 0, { look: [WX - 3, 1.2, -1.2] }); poseLine(c, 0, { look: [WX - 3, 1.2, -1.2] });
      standAt(c.you, WX - 2.8, -1.2, Math.PI / 2 + 0.6); face(c.you, 'happy', 'raised', 'smile');
      standAt(c.dr, WX - 3.55, -1.2, Math.PI / 2); face(c.dr, 'stare', 'neutral', 'neutral');
      [c.om, c.la, c.ki, c.re].forEach((ch) => face(ch, 'stare', 'neutral', 'neutral', { lookAt: [WX - 3, 1.2, -1.2] }));
    },
    cam: (W, c, lt) => camAt([WX + 2.6, 1.9, 3.7], [WX - 1.4, 0.9, -0.6], 56),
    anchors: (W, c) => ({ cloud: c.you._w(V(0, 0.2, -0.2), c.you.pelvis) }),
  },
  // 42 "The waiting room is empty" everyone runs out super fast: chairs spinning, the magazine flying
  42: {
    build(W) { const c = crowd(W, lineup(W, waiting(W)), { you: false }); return c; },
    update(W, c, lt) {
      const run = (ch, x0, z0, i) => { const x = x0 + lt * (6 + (i % 3)), z = z0 + lt * 1.5; standAt(ch, x, z, Math.PI / 2 + 0.25); ch.p.walk = lt * 28 + i; ch.p.lean = 0.3; face(ch, 'wide', 'raised', 'yell'); ch.p.handL = rel(ch, 0.1, 0.25, ch.headPos().y + 0.15); ch.p.handR = rel(ch, 0.1, -0.25, ch.headPos().y + 0.15); ch.p.handPoseL = ch.p.handPoseR = 'open'; };
      [c.om, c.la, c.ki, c.re].forEach((ch, i) => run(ch, WX - 1.2 + i * 0.6, 0.8 + i * 0.2, i));
      c.line.forEach((ch, i) => run(ch, WX - 2.8 + (i % 3) * 0.3, -0.5 + i * 0.42, i + 4));
      c.R.rows.forEach((r, j) => r.userData.chairs.forEach((ch, i) => { ch.rotation.y = lt * (14 + i * 3) * (j ? -1 : 1); }));
      c.mag.position.set(WX + 0.5 + lt * 1.2, 1.2 + lt * 1.6 - lt * lt * 1.5, 0.6); c.mag.rotation.set(lt * 9, lt * 6, lt * 4);
    },
    cam: (W, c, lt) => camAt([WX + 0.5, 1.6, -2.4], [WX - 0.4, 0.9, 1.0], 62),
  },
  // 43 "in three seconds." the empty room: a chair still spinning, the magazine floating down
  43: {
    build(W) { const c = waiting(W); c.mag = S.magazine(W.scene); return c; },
    update(W, c, lt) {
      c.R.rows.forEach((r, j) => r.userData.chairs.forEach((ch, i) => { ch.rotation.y = (i === 2 && j === 0) ? lt * 6 * Math.exp(-lt * 0.6) * 3 : (i * 0.7 + j); }));
      c.mag.position.set(WX + 0.3 + 0.3 * Math.sin(lt * 3), 2.2 - lt * 0.95, 0.9); c.mag.rotation.set(0.6 * Math.sin(lt * 4), lt * 1.5, 0.5 * Math.cos(lt * 3));
    },
    cam: (W, c, lt) => camAt([WX + 0.3, 1.6, -2.4 + lt * 0.1], [WX - 0.2, 0.9, 1.0], 58),
  },
  // 44 "Well…" the doctor, still, blank face
  44: {
    build(W) { const c = waiting(W); c.dr = person(W, 'doctor'); toiletRoom(W, c); c.dr.root.traverse((o) => { if (o.isMesh && /shoe[LR]$/.test(o.name)) o.material = c.dr.shoeDull; }); return c; },
    update(W, c) { c.R.door.rotation.y = -1.6; standAt(c.dr, WX - 3.55, -1.2, Math.PI / 2); face(c.dr, 'stare', 'neutral', 'neutral'); },
    cam: (W, c) => headCam(c.dr, 0.7, -0.05, 0.0, -0.02, 42),
  },
  // 45 "The medicine works!" the doctor standing still, blank, stink lines from his shoes
  45: {
    build(W) {
      const c = waiting(W); c.dr = person(W, 'doctor'); toiletRoom(W, c);
      c.dr.root.traverse((o) => { if (o.isMesh && /shoe[LR]$/.test(o.name)) o.material = c.dr.shoeDull; });
      c.sp = [S.splat(W.scene, 0.55, 3), S.splat(W.scene, 0.5, 5)]; return c;
    },
    update(W, c, lt) { c.R.door.rotation.y = -1.6; standAt(c.dr, WX - 3.55, -1.2, Math.PI / 2); face(c.dr, lt > 0.5 && lt < 0.62 ? 'closed' : 'stare', 'neutral', 'neutral'); },
    after(W, c) { ['L', 'R'].forEach((s2, i) => { const p = c.dr.legs[s2].shoe.getWorldPosition(V()); c.sp[i].position.set(p.x + 0.12, p.y + 0.09, p.z); c.sp[i].rotation.set(0, i, 0.15); }); },
    cam: (W, c, lt) => camAt([WX - 1.7, 1.15, -0.6], [WX - 3.55, 0.95, -1.2], 50),
    anchors: (W, c) => ({ shoes: c.dr.legs.L.shoe.getWorldPosition(V()).lerp(c.dr.legs.R.shoe.getWorldPosition(V()), 0.5).add(V(0.1, 0.1, 0)) }),
  },
  // 46 "Then he writes your bill." the doctor writes on the bill
  46: {
    build(W) { const c = office(W); c.dr = person(W, 'doctor'); c.bill = S.billPaper(W.scene); c.pen = S.pen(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.dr, OX + 0.7, 0.25, Math.PI / 2); face(c.dr, 'squint', 'neutral', 'tight', { headPitch: -0.55, lean: 0.25 });
      c.bill.position.set(OX + 1.1, 0.787, 0.2); c.bill.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); c.bill.userData.write(Math.min(2, lt / 0.7), 0);
      const k = (lt / 0.7) % 1, line = Math.min(1, Math.floor(lt / 0.7));
      c.pen.position.set(OX + 1.1 + 0.07 - line * 0.06, 0.805, 0.2 + 0.08 - k * 0.16); c.pen.rotation.set(0.3, 0, -0.5); c.dr.p.gripR = c.pen;
      c.dr.p.handL = [OX + 1.0, 0.78, 0.0]; c.dr.p.handPoseL = 'flat';
    },
    cam: (W, c, lt) => camAt([OX + 1.55, 1.35, 0.85], [OX + 1.1, 0.8, 0.2], 46),
  },
  // 47 "Treatment: $50." ECU: the bill
  47: {
    build(W) { const c = office(W); c.bill = S.billPaper(W.scene); return c; },
    update(W, c, lt) { c.bill.position.set(OX + 1.1, 0.787, 0.2); c.bill.rotation.set(-Math.PI / 2, 0, Math.PI / 2); c.bill.userData.write(1 + clamp(lt / 0.5) * 0, lt > 0.78 ? 1 : 0); },
    cam: (W, c, lt) => camAt([OX + 1.1 + 0.02, 1.39 - lt * 0.04, 0.2 + 0.001], [OX + 1.1, 0.787, 0.2], 44),
  },
  // 48 "New shoes: $500." YOU, belly now small and flat, smiling, holding up the bill with the big red $500
  48: {
    build(W) { const c = office(W); c.you = person(W, 'you'); c.bill = S.billPaper(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, OX - 0.2, 0.6, 0.35); face(c.you, 'happy', 'raised', 'grin');
      const p = rel(c.you, 0.36, -0.05, 1.08); c.bill.position.set(...p); c.bill.rotation.set(0, c.you.p.rotY, 0); c.bill.userData.write(2, lt > 1.0 ? 2 : 1);
      c.you.p.handL = rel(c.you, 0.34, 0.075, 1.06); c.you.p.handR = rel(c.you, 0.34, -0.175, 1.06); c.you.p.handPoseL = c.you.p.handPoseR = 'grip';
    },
    after(W, c, lt) { c.you.belly.visible = false; },
    cam: (W, c, lt) => { const h = c.you.headPos(), F = fwd(c.you.p.rotY); return camAt([h.x + F.x * 1.25 + 0.15, h.y - 0.25, h.z + F.z * 1.25], [h.x + F.x * 0.3, h.y - 0.3, h.z + F.z * 0.3], 48); },
  },
};
