// The 43 shots of the ghost-girlfriend reel (low-poly, moonlit night). Every shot is a clip; lt = seconds since the
// shot's start, W.dur = its length (from the user's voice), W.cut = a camera cut inside it (on a word), if any.
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as GW from './ghostworld.js';
import { glowSprite, fork } from './sets.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn, easeOutBack, rng, noise1 } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const standAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY, y }); };
const sitAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY, y }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40, o = {}) => ({ pos: [...pos], target: [...target], fov, ...o });
const P3 = (v) => [v.x, v.y, v.z];
const rel = (ch, f, l, y) => { const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); return [ch.p.pos[0] + F.x * f + L.x * l, y, ch.p.pos[1] + F.z * f + L.z * l]; };
const K = (W, lt) => clamp(lt / W.dur);
const headCam = (ch, dist, dy = 0, dx = 0, fov = 40, ty = 0) => { const h = ch.headPos(), f = fwd(ch.p.rotY), l = V(f.z, 0, -f.x); return camAt(P3(h.clone().addScaledVector(f, dist).add(V(0, dy, 0)).addScaledVector(l, dx)), [h.x, h.y + ty, h.z], fov); };
const P = GW.PL;
const ZC = 26;                                           // where the car dies on the road
const SY = 0.16;                                         // seat height offset in the convertible
const STARE = [[-0.62, ZC - 3.75], [0.0, ZC - 3.9], [0.62, ZC - 3.75]];   // the friends' spots behind the car (they never move again)

// ------------------------------------------------------------------ shared setups
function roadSet(W, o = {}) { GW.night(W, { at: [0, 0, o.at ?? ZC], size: o.size ?? 9, fog: o.fog ?? [16, 95] }); return GW.buildRoad(W, { grown: o.grown ?? 0 }); }
function crew(W, c) { c.you = person(W, 'you'); c.f1 = person(W, 'f1'); c.f2 = person(W, 'f2'); c.f3 = person(W, 'f3'); return c; }
function seatAll(c, carZ, lt, { bounce = 0, x = 0 } = {}) {
  const b = (i) => bounce * Math.abs(Math.sin(lt * 9.5 + i * 0.7)) * 0.05;
  sitAt(c.you, x + GW.SEATS.driver[0], carZ + GW.SEATS.driver[1], 0, SY + b(0));
  sitAt(c.f1, x + GW.SEATS.front[0], carZ + GW.SEATS.front[1], 0, SY + b(1));
  sitAt(c.f2, x + 0.4, carZ - 0.95, 0, SY + b(2));
  sitAt(c.f3, x - 0.4, carZ - 0.95, 0, SY + b(3));
  c.you.p.handL = [x + 0.32, 1.02, carZ + 0.52]; c.you.p.handR = [x + 0.52, 1.02, carZ + 0.52]; c.you.p.handPoseL = c.you.p.handPoseR = 'grip';
}
function sing(ch, t, k = 1, hands = false, seed = 0) {
  face(ch, (t + seed) % 1.4 < 0.7 ? 'closed' : 'happy', 'raised', (t * 3 + seed) % 1 < 0.6 ? 'laugh' : 'smileOpen', { headPitch: 0.24 + 0.12 * Math.sin(t * 9.5 + seed), headRoll: 0.12 * Math.sin(t * 4.7 + seed) * k });
  if (hands) { const s = Math.sin(t * 9.5 + seed) * 0.1; ch.p.handL = rel(ch, 0.1, 0.3 + s, 1.9 + s); ch.p.handR = rel(ch, 0.1, -0.3 + s, 1.9 - s); ch.p.handPoseL = ch.p.handPoseR = 'open'; }
}
function scream(ch, t, seed = 0, hands = 'cheeks') {
  face(ch, 'wide', 'raised', 'yell', { headPitch: 0.12, bounce: 0.6 });
  if (hands === 'cheeks') { ch.p.handL = P3(hl(ch, 0.1, -0.05, 0.06)); ch.p.handR = P3(hl(ch, -0.1, -0.05, 0.06)); ch.p.handPoseL = ch.p.handPoseR = 'flat'; }
  else { const s = Math.sin(t * 30 + seed) * 0.05; ch.p.handL = rel(ch, 0.15, 0.35, 1.95 + s); ch.p.handR = rel(ch, 0.15, -0.35, 1.95 - s); ch.p.handPoseL = ch.p.handPoseR = 'open'; }
}
function stare(ch, t, seed = 0, blink = true) {
  face(ch, 'stare', 'neutral', 'tight', { headPitch: 0.02 });
  if (blink && ((t + seed) % 2.3) > 2.16) ch.p.eyes = 'closed';
}
function friendsStare(c, t, { rot = 0 } = {}) { [c.f1, c.f2, c.f3].forEach((ch, i) => { standAt(ch, STARE[i][0], STARE[i][1], rot); stare(ch, t, i * 0.7); }); }
function ghost(W, c, o = {}) { c.gh = person(W, 'ghost'); GW.ghostify(c.gh, o); return c.gh; }
function glowLight(W, pos, i = 4) { const l = new THREE.PointLight(0xb8d8ff, i, 7, 1.5); l.position.set(...pos); W.scene.add(l); return l; }
function ghostAt(c, x, z, rotY, t, y = 0.32) { standAt(c.gh, x, z, rotY, y + 0.04 * Math.sin(t * 2.2)); }
function ghostFx(c, t) { if (c.gh?.ghostGlow) { c.gh.ghostGlow.position.copy(c.gh.chestPos()); c.gh.ghostGlow.material.opacity = 0.3 + 0.06 * Math.sin(t * 3); } }
// a held prop placed on the hand each frame (after solve): pos along the forearm
function holdIron(ch, iron, side = 'R', tilt = 0) {
  const a = ch.arms[side], H = a.H; ch.root.updateMatrixWorld(true);
  const p = ch.handPos(side), q = H.grp.getWorldQuaternion(new THREE.Quaternion());
  iron.position.copy(p); iron.quaternion.copy(q); iron.rotateX(tilt); iron.translateY(0.12);
}

export const SHOTS = {
  // ================================================================ 1 "You and your friends" 2 AM: the convertible on the dark road
  1: {
    build(W) { const c = { R: roadSet(W, { at: 8, size: 14 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); return c; },
    update(W, c, lt) { const z = -8 + lt * 11; c.car.g.position.z = z; seatAll(c, z, lt, { bounce: 0.6 }); [c.you, c.f1, c.f2, c.f3].forEach((ch, i) => sing(ch, lt, 0.6, i >= 2, i)); },
    after(W, c, lt) { c.car.wheels.forEach((w) => { w.rotation.x = lt * 30; }); },
    cam: (W, c, lt) => { const z = -8 + lt * 11; return camAt([3.0, 1.0, z + 11], [0.2, 0.9, z], 42); },
  },
  // ================================================================ 2 "are driving home at 2 AM." front view of the car, everyone in it
  2: {
    build(W) { const c = { R: roadSet(W, { at: 14, size: 10 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); return c; },
    update(W, c, lt) { const z = 2 + lt * 10; c.car.g.position.z = z; seatAll(c, z, lt, { bounce: 0.6 }); [c.you, c.f1, c.f2, c.f3].forEach((ch, i) => sing(ch, lt, 0.5, false, i)); face(c.you, 'happy', 'neutral', 'smile'); },
    after(W, c, lt) { c.car.wheels.forEach((w) => { w.rotation.x = lt * 28; }); },
    cam: (W, c, lt) => { const z = 2 + lt * 10, k = K(W, lt); return camAt([0.3, 1.75, z + 5.2 - 0.5 * k], [0, 1.05, z - 0.3], 40); },
  },
  // ================================================================ 3 "Music loud as fuck." the car bounces, arms up in the back
  3: {
    build(W) { const c = { R: roadSet(W, { at: 20, size: 8 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); return c; },
    update(W, c, lt) {
      const z = 12 + lt * 9; c.car.g.position.z = z; seatAll(c, z, lt, { bounce: 1 });
      sing(c.you, lt, 1, false, 0); sing(c.f1, lt, 1, true, 1); sing(c.f2, lt, 1, true, 2); sing(c.f3, lt, 1, true, 3);
      c.you.p.handL = [0.32, 1.02, z + 0.52]; c.you.p.handR = [0.52, 1.02, z + 0.52];
    },
    after(W, c, lt) { const z = 12 + lt * 9; c.car.g.position.y = Math.abs(Math.sin(lt * 9.5)) * 0.05; c.car.wheels.forEach((w) => { w.rotation.x = lt * 26; }); },
    cam: (W, c, lt) => { const z = 12 + lt * 9, k = K(W, lt); return camAt([2.1, 2.0, z + 1.2 - 0.2 * k], [0, 1.35, z - 0.6], 46); },
    anchors: (W, c) => ({ car: V(0, 1.5, c.car.g.position.z - 0.3) }),
  },
  // ================================================================ 4 "Everyone's singing." the front seats: eyes shut, mouths wide
  4: {
    build(W) { const c = { R: roadSet(W, { at: 22, size: 8 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); return c; },
    update(W, c, lt) { const z = 16 + lt * 9; c.car.g.position.z = z; seatAll(c, z, lt, { bounce: 0.8 }); [c.you, c.f1, c.f2, c.f3].forEach((ch, i) => sing(ch, lt, 1.2, i >= 2, i * 0.37)); c.you.p.handL = [0.32, 1.02, z + 0.52]; c.you.p.handR = [0.52, 1.02, z + 0.52]; },
    after(W, c, lt) { c.car.wheels.forEach((w) => { w.rotation.x = lt * 26; }); },
    cam: (W, c, lt) => { const z = 16 + lt * 9, k = K(W, lt); return camAt([-0.15, 1.55, z + 2.2 - 0.2 * k], [0, 1.3, z - 0.2], 44); },
  },
  // ================================================================ 5 "Then the car" the engine sputters: smoke from the hood
  5: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 8 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); c.sm = WD_smoke(W); return c; },
    update(W, c, lt) { const z = ZC - 3 + lt * 3.5; c.car.g.position.z = z; seatAll(c, z, lt, { bounce: 0.2 }); [c.you, c.f1, c.f2, c.f3].forEach((ch, i) => face(ch, 'open', 'raised', 'o', { headPitch: 0.1 })); c.you.p.handL = [0.32, 1.02, z + 0.52]; c.you.p.handR = [0.52, 1.02, z + 0.52]; },
    after(W, c, lt) { const z = ZC - 3 + lt * 3.5; c.car.g.rotation.x = Math.sin(lt * 25) * 0.012 * (lt > 0.2 ? 1 : 0); smokeAt(c.sm, [0, 0.9, z + 1.4], lt, 0.9); c.car.wheels.forEach((w) => { w.rotation.x = lt * 10; }); },
    cam: (W, c, lt) => { const z = ZC - 3 + lt * 3.5; return camAt([2.6, 1.9, z + 4.2], [0, 1.05, z + 0.3], 44); },
  },
  // ================================================================ 6 "just fucking dies." the car rolls to a stop; dead silence
  6: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 10 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, 0, 0); c.sm = WD_smoke(W); return c; },
    update(W, c, lt) { const z = ZC - 0.6 * (1 - easeOut(clamp(lt / 0.8))); c.car.g.position.z = z; seatAll(c, z, lt); [c.you, c.f1, c.f2, c.f3].forEach((ch, i) => face(ch, 'open', 'neutral', 'tight', { headYaw: i === 1 ? -0.5 : i === 0 ? 0.3 : 0 })); c.you.p.handL = [0.32, 1.02, z + 0.52]; c.you.p.handR = [0.52, 1.02, z + 0.52]; },
    after(W, c, lt) { smokeAt(c.sm, [0, 0.9, ZC + 1.4], lt + 0.7, 0.6); c.car.dash.material.emissiveIntensity = lt > 0.5 ? 0 : 1.4; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([6.5, 3.6 + 0.4 * k, ZC + 6.5 + 0.5 * k], [0, 0.9, ZC], 44); },
  },
  // ================================================================ 7 "The headlights flicker." close on the front of the car
  7: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 6 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); return c; },
    update(W, c, lt) { seatAll(c, ZC, lt); [c.you, c.f1, c.f2, c.f3].forEach((ch) => face(ch, 'open', 'worried', 'tight')); },
    after(W, c, lt) { const on = [0, 0.12, 0.2, 0.38, 0.44, 0.62, 0.66, 0.9, 1.0, 1.2].findIndex((x) => lt < x) % 2 === 1 ? 0.15 : 1; c.car.setLights(on * (0.85 + 0.15 * Math.sin(lt * 80))); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.35, 1.0, ZC + 4.6 - 0.3 * k], [0, 0.68, ZC + 2.1], 40); },
  },
  // ================================================================ 8 "And there's a ghost." over the driver's shoulder: a ghost in the beams
  8: {
    build(W) { const c = { R: roadSet(W, { at: ZC + 6, size: 10 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); ghost(W, c); return c; },
    update(W, c, lt) { seatAll(c, ZC, lt); [c.you, c.f1, c.f2, c.f3].forEach((ch) => face(ch, 'open', 'worried', 'tight')); ghostAt(c, 0.1, ZC + 13, Math.PI, lt); face(c.gh, 'closed', 'neutral', 'neutral', { headPitch: -0.35 }); c.gh.hairCurtain(0); },
    after(W, c, lt) { ghostFx(c, lt); c.car.setLights(lt < 0.1 ? 0.2 : 1); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.62, 1.62, ZC - 0.75 + 0.15 * k], [0.05, 1.25, ZC + 13], 34); },
  },
  // ================================================================ 9 "Right in front of the fucking car." low side view; cut: closer on her
  9: {
    build(W) { const c = { R: roadSet(W, { at: ZC + 2, size: 8 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); ghost(W, c); return c; },
    update(W, c, lt) { seatAll(c, ZC, lt); [c.you, c.f1, c.f2, c.f3].forEach((ch) => face(ch, 'wide', 'raised', 'o')); ghostAt(c, 0, ZC + 3.3, Math.PI, lt); face(c.gh, 'closed', 'neutral', 'neutral', { headPitch: -0.35 }); c.gh.hairCurtain(0); },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const h = c.gh.headPos(), q = clamp((lt - W.cut) / 1.2); return camAt([h.x - 0.45, h.y - 0.25, h.z - 1.6 + 0.2 * q], [h.x, h.y - 0.15, h.z], 40); }
      const k = clamp(lt / Math.max(0.4, W.cut)); return camAt([4.4 - 0.3 * k, 0.6, ZC + 1.6], [0, 1.0, ZC + 2.5], 46);
    },
  },
  // ================================================================ 10 "Your friends scream like little bitches." cut: closer on the back seat
  10: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 6 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); return c; },
    update(W, c, lt) { seatAll(c, ZC, lt); scream(c.f1, lt, 1, 'cheeks'); scream(c.f2, lt, 2, 'cheeks'); scream(c.f3, lt, 3, 'cheeks'); face(c.you, 'wide', 'raised', 'o'); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = clamp((lt - W.cut) / 1.2); return camAt([0.05, 1.85, ZC + 0.45 - 0.1 * q], [0, 1.4, ZC - 0.95], 46); }
      return camAt([0.1, 1.55, ZC + 1.95], [0, 1.38, ZC - 0.5], 44);
    },
  },
  // ================================================================ 11 "Everyone gets the fuck out of the car." they jump out and run behind it
  11: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 9 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); return c; },
    update(W, c, lt) {
      const out = (ch, seat, dest, delay, i) => {
        const k = clamp((lt - delay) / 0.45), k2 = clamp((lt - delay - 0.45) / 0.9);
        if (k <= 0) { sitAt(ch, seat[0], seat[1], 0, SY); }
        else if (k < 1) { const x = lerp(seat[0], seat[0] * 2.6, k), y = SY + Math.sin(k * Math.PI) * 0.7; standAt(ch, x, seat[1], seat[0] > 0 ? Math.PI / 2 : -Math.PI / 2, y + 0.1 * (1 - k)); }
        else { const x = lerp(seat[0] * 2.6, dest[0], k2), z = lerp(seat[1], dest[1], k2); standAt(ch, x, z, Math.atan2(dest[0] - seat[0] * 2.6, dest[1] - seat[1])); ch.p.walk = k2 < 1 ? lt * 16 + i : null; }
        scream(ch, lt, i, 'up');
      };
      out(c.f1, [-0.42, ZC + 0.12], [-1.4, ZC - 3.4], 0.05, 1); out(c.f2, [0.42, ZC - 0.95], [0.6, ZC - 3.8], 0.12, 2); out(c.f3, [-0.42, ZC - 0.95], [-0.3, ZC - 4.2], 0.2, 3);
      const k = clamp((lt - 0.25) / 0.5); if (k < 1) { sitAt(c.you, 0.42 + 0.6 * k, ZC + 0.12, 0, SY + Math.sin(k * Math.PI) * 0.5); } else standAt(c.you, 1.6, ZC + 0.4, 0.4);
      face(c.you, 'open', 'angry', 'tight');
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([-6.2, 3.2, ZC + 5.5 + 0.5 * k], [0, 0.9, ZC - 1.0], 46); },
  },
  // ================================================================ 12 "You grab a tire iron." the trunk opens, his hand grabs it
  12: {
    build(W) { const c = { R: roadSet(W, { at: ZC, size: 6 }) }; c.you = person(W, 'you'); c.car = GW.convertible(W.scene, 0, ZC, 0); c.iron = GW.tireIron(W.scene); return c; },
    update(W, c, lt) {
      c.car.trunk.rotation.x = -1.25 * easeOut(clamp(lt / 0.35));
      standAt(c.you, 0.55, ZC - 2.75, 0.15); face(c.you, 'squint', 'angry', 'tight', { headPitch: -0.45 });
      const k = clamp((lt - 0.35) / 0.4), up = clamp((lt - 0.8) / 0.45);
      c.iron.position.set(0.25 + 0.1 * up, lerp(0.92, 1.35, easeOut(up)), ZC - 1.9 - 0.35 * up); c.iron.rotation.set(Math.PI / 2 - up * 1.1, 0, 0.3);
      c.you.p.handR = k < 1 ? [lerp(0.6, 0.27, k), lerp(1.0, 0.95, k), lerp(ZC - 2.4, ZC - 1.95, k)] : P3(c.iron.position.clone().add(V(0, 0, 0)));
      c.you.p.handPoseR = k >= 1 ? 'grip' : 'open';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([2.0, 1.75, ZC - 4.1 + 0.2 * k], [0.25, 1.0, ZC - 1.8], 42); },
  },
  // ================================================================ 13 "You're gonna hit this bitch." he walks at the ghost, iron raised
  13: {
    build(W) { glowLight(W, [0, 1.6, ZC + 3.9]); const c = { R: roadSet(W, { at: ZC + 2, size: 8 }) }; c.you = person(W, 'you'); c.car = GW.convertible(W.scene, 0, ZC, 0); c.iron = GW.tireIron(W.scene); ghost(W, c); return c; },
    update(W, c, lt) {
      const k = clamp(lt / W.dur); standAt(c.you, lerp(1.4, 0.35, k), lerp(ZC + 0.6, ZC + 2.4, k), -0.25); c.you.p.walk = lt * 9;
      face(c.you, 'squint', 'angry', 'grimace', { lookAt: P3(c.gh.headPos()) });
      c.you.p.handR = rel(c.you, -0.05, -0.26, 1.85); c.you.p.handPoseR = 'grip';
      ghostAt(c, 0, ZC + 4.1, Math.PI, lt); face(c.gh, 'closed', 'neutral', 'neutral', { headPitch: -0.35 }); c.gh.hairCurtain(0);
    },
    after(W, c, lt) { ghostFx(c, lt); holdIron(c.you, c.iron, 'R', 0.2); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([2.6, 1.55, ZC + 0.2 + 0.3 * k], [0.2, 1.35, ZC + 3.2], 44); },
  },
  // ================================================================ 14 "You swing..." low angle, slow motion wind-up
  14: {
    build(W) { glowLight(W, [0, 1.6, ZC + 3.9]); const c = { R: roadSet(W, { at: ZC + 3, size: 6 }) }; c.you = person(W, 'you'); c.car = GW.convertible(W.scene, 0, ZC, 0); c.iron = GW.tireIron(W.scene); ghost(W, c); return c; },
    update(W, c, lt) {
      const k = easeInOut(clamp(lt / W.dur)); standAt(c.you, 0.35, ZC + 2.7, -0.15);
      face(c.you, 'squint', 'angry', 'yell', { lookAt: P3(c.gh.headPos()) });
      const a = lerp(-0.4, 1.3, k), sh = V(0.35 - 0.18, 1.45, ZC + 2.7);
      c.you.p.handR = [sh.x + Math.sin(a) * 0.05 - 0.15, sh.y + Math.cos(a) * 0.45, sh.z + Math.sin(a) * 0.45]; c.you.p.handL = c.you.p.handR.map((v, i) => v + [0.06, -0.06, 0][i]);
      c.you.p.handPoseR = c.you.p.handPoseL = 'grip'; c.you.p.torsoYaw = lerp(0.5, -0.4, k); c.you.p.lean = lerp(-0.1, 0.25, k);
      ghostAt(c, 0, ZC + 4.1, Math.PI, lt); face(c.gh, 'closed', 'neutral', 'neutral', { headPitch: -0.35 }); c.gh.hairCurtain(0);
    },
    after(W, c, lt) { ghostFx(c, lt); holdIron(c.you, c.iron, 'R', 0.3); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([1.6, 0.45, ZC + 4.9 - 0.2 * k], [0.25, 1.5, ZC + 2.8], 50); },
  },
  // ================================================================ 15 "And then you see her face." the hair parts: a pretty glowing face
  15: {
    build(W) { const c = { R: roadSet(W, { at: ZC + 4, size: 5 }) }; ghost(W, c); return c; },
    update(W, c, lt) { ghostAt(c, 0, ZC + 4.1, Math.PI, lt); const k = smooth((lt - 0.2) / 0.7); face(c.gh, k > 0.6 ? 'open' : 'closed', k > 0.6 ? 'raised' : 'neutral', k > 0.8 ? 'smile' : 'neutral', { headPitch: lerp(-0.4, 0.0, k), lookAt: k > 0.8 ? [0.1, 1.6, ZC + 2.6] : null }); c.gh.hairCurtain(k); },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => { const h = c.gh.headPos(), k = K(W, lt); return camAt([h.x + 0.08, h.y - 0.02, h.z - 0.62 + 0.08 * k], [h.x, h.y - 0.02, h.z], 40); },
    anchors: (W, c) => ({ face: c.gh.headPos() }),
  },
  // ================================================================ 16 "Oh fuck." his face; the tire iron drops
  16: {
    build(W) { glowLight(W, [0, 1.6, ZC + 3.9]); const c = { R: roadSet(W, { at: ZC + 3, size: 5 }) }; c.you = person(W, 'you'); c.iron = GW.tireIron(W.scene); return c; },
    update(W, c, lt) { standAt(c.you, 0.35, ZC + 2.7, 0); face(c.you, 'wide', 'raised', lt > 0.25 ? 'o' : 'open', { headPitch: -0.05 }); c.you.p.handR = rel(c.you, 0.25, -0.2, lt < 0.35 ? 1.75 : 1.2); c.you.p.handPoseR = lt < 0.35 ? 'grip' : 'open'; },
    after(W, c, lt) { if (lt < 0.35) holdIron(c.you, c.iron, 'R', 0.3); else { const f = lt - 0.35; c.iron.position.set(0.35 + 0.1, Math.max(0.03, 1.4 - 4.9 * f * f * 2), ZC + 2.95); c.iron.rotation.set(0.4 + f * 5, 0, 1.2); } },
    cam: (W, c, lt) => { const h = c.you.headPos(), k = K(W, lt); return camAt([h.x - 0.05, h.y - 0.08, h.z + 0.72 - 0.1 * k], [h.x, h.y - 0.05, h.z], 40); },
  },
  // ================================================================ 17 "Your heart goes" heart eyes
  17: {
    build(W) { glowLight(W, [0, 1.6, ZC + 3.9]); const c = { R: roadSet(W, { at: ZC + 3, size: 5 }) }; c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, 0.35, ZC + 2.7, 0); face(c.you, 'heart', 'raised', 'smile', { headRoll: 0.1 * Math.sin(lt * 3) }); },
    cam: (W, c, lt) => { const h = c.you.headPos(), k = K(W, lt); return camAt([h.x, h.y - 0.05, h.z + 0.6 - 0.06 * k], [h.x, h.y - 0.03, h.z], 40); },
    anchors: (W, c) => ({ eyes: c.you.headPos() }),
  },
  // ================================================================ 18 "BA-DUM." the big heart pulses on his chest
  18: {
    build(W) { glowLight(W, [0, 1.6, ZC + 3.9]); const c = { R: roadSet(W, { at: ZC + 3, size: 5 }) }; c.you = person(W, 'you'); return c; },
    update(W, c, lt) { standAt(c.you, 0.35, ZC + 2.7, 0); face(c.you, 'heart', 'raised', 'smileOpen', { chestPuff: Math.max(0, Math.sin(lt * 7)) * 0.4 }); },
    cam: (W, c, lt) => { const h = c.you.headPos(); return camAt([h.x, h.y - 0.25, h.z + 1.3], [h.x, h.y - 0.3, h.z], 42); },
    anchors: (W, c) => ({ chest: c.you.chestPos() }),
  },
  // ================================================================ 19 "Your friends just stare." behind the car, deadpan
  19: {
    build(W) { const c = { R: roadSet(W, { at: ZC - 3, size: 6 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); return c; },
    update(W, c, lt) { friendsStare(c, lt); c.you.p.visible = false; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.1, 1.6, ZC + 0.6 - 0.3 * k], [0, 1.3, ZC - 3.8], 42); },
  },
  // ================================================================ 20 "Week one." the graveyard at night
  20: {
    build(W) { GW.night(W, { at: [P.grave, 0, -4], size: 12, moon: [6, 20, -30] }); const c = { G: GW.buildGraveyard(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) { standAt(c.you, P.grave - 0.35, -9 + lt * 0.4, 0); c.you.p.walk = lt * 5.5; face(c.you, 'happy', 'raised', 'smile'); ghostAt(c, P.grave + 0.35, -9 + lt * 0.4, 0, lt); face(c.gh, 'open', 'raised', 'smile'); c.gh.hairCurtain(1); },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.grave + 2.6, 2.4 - 0.2 * k, 7.5 - 0.5 * k], [P.grave, 1.2, -6], 44); },
  },
  // ================================================================ 21 "First date in a graveyard." walking between the tombstones, a rose
  21: {
    build(W) { GW.night(W, { at: [P.grave, 0, -4], size: 8, moon: [6, 20, -30] }); const c = { G: GW.buildGraveyard(W) }; c.you = person(W, 'you'); ghost(W, c); c.rose = GW.rose(W.scene); return c; },
    update(W, c, lt) {
      const z = -5 + lt * 0.75; standAt(c.you, P.grave - 0.32, z, 0); c.you.p.walk = lt * 5.5; face(c.you, 'happy', 'raised', 'smile', { lookAt: P3(c.gh.headPos()) });
      ghostAt(c, P.grave + 0.34, z + 0.1, 0, lt); face(c.gh, 'open', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); c.gh.hairCurtain(1);
      c.rose.position.set(...rel(c.you, 0.3, -0.12, 1.1)); c.rose.rotation.set(-0.4, 0, 0.3); c.you.p.gripR = c.rose;
    },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => { const z = -5 + lt * 0.75; return camAt([P.grave + 0.3, 1.45, z + 3.3], [P.grave, 1.2, z], 42); },
  },
  // ================================================================ 22 "She floats." up and twirling
  22: {
    build(W) { GW.night(W, { at: [P.grave, 0, -2], size: 8, moon: [6, 20, -30] }); const c = { G: GW.buildGraveyard(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) {
      standAt(c.you, P.grave - 0.6, -1.5, 0.5); face(c.you, 'happy', 'raised', 'smileOpen', { lookAt: P3(c.gh.headPos()) });
      const k = easeOut(clamp(lt / 0.8)); standAt(c.gh, P.grave + 0.4, -1.6, lt * 6, lerp(0.32, 1.35, k)); face(c.gh, 'happy', 'raised', 'laugh'); c.gh.hairCurtain(1);
      c.gh.p.handL = rel(c.gh, 0.0, 0.55, 1.6 + c.gh.p.y); c.gh.p.handR = rel(c.gh, 0.0, -0.55, 1.6 + c.gh.p.y); c.gh.p.handPoseL = c.gh.p.handPoseR = 'open';
    },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.grave + 1.4, 0.75, 1.8 - 0.2 * k], [P.grave, 1.75, -1.5], 50); },
    anchors: (W, c) => ({ ghost: c.gh.chestPos() }),
  },
  // ================================================================ 23 "You don't give a fuck." smiling, shrugging, heart eyes
  23: {
    build(W) { glowLight(W, [P.grave + 0.9, 2.0, -2.0], 3); GW.night(W, { at: [P.grave, 0, -2], size: 6, moon: [6, 20, -30] }); const c = { G: GW.buildGraveyard(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) {
      standAt(c.you, P.grave - 0.3, -1.2, 0.15); const sh = Math.max(0, Math.sin(clamp((lt - 0.2) / 0.7) * Math.PI));
      face(c.you, 'heart', 'raised', 'grin', { shoulderUp: sh, headRoll: 0.12 * sh });
      c.you.p.handL = rel(c.you, 0.2, 0.42, 1.1 + 0.15 * sh); c.you.p.handR = rel(c.you, 0.2, -0.42, 1.1 + 0.15 * sh); c.you.p.handPoseL = c.you.p.handPoseR = 'open';
      ghostAt(c, P.grave + 0.9, -2.6, -0.4, lt, 1.0); face(c.gh, 'happy', 'raised', 'smile'); c.gh.hairCurtain(1);
    },
    after(W, c, lt) { ghostFx(c, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.grave - 0.05, 1.55, 1.25 - 0.15 * k], [P.grave + 0.05, 1.45, -1.5], 42); },
  },
  // ================================================================ 24 "Month one." candles on the table
  24: {
    build(W) { dinnerLights(W); const c = { D: GW.buildDinner(W) }; return c; },
    after(W, c, lt) { c.D.candles.forEach((cd, i) => cd.userData.flicker(lt, i * 3)); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.dinner + 0.12, 1.08, 0.62 - 0.08 * k], [P.dinner, 0.95, 0], 40); },
  },
  // ================================================================ 25 "Candlelight dinner." the two of them at the table
  25: {
    build(W) { dinnerLights(W); const c = { D: GW.buildDinner(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) { sitAt(c.you, P.dinner - 0.95, 0, Math.PI / 2, 0); face(c.you, 'happy', 'raised', 'smile', { lookAt: P3(c.gh.headPos()) }); sitAt(c.gh, P.dinner + 0.95, 0, -Math.PI / 2, 0.05); face(c.gh, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); c.gh.hairCurtain(1); },
    after(W, c, lt) { c.D.candles.forEach((cd, i) => cd.userData.flicker(lt, i * 3)); ghostFx(c, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.dinner - 2.4 + 0.15 * k, 1.6, 0.9], [P.dinner, 1.0, -0.2], 44); },
  },
  // ================================================================ 26 "She can't eat." the spaghetti falls right through her
  26: {
    build(W) { dinnerLights(W); const c = { D: GW.buildDinner(W) }; ghost(W, c); c.fk = fork(W.scene, { spaghetti: true }); c.blob = new THREE.Mesh(new THREE.TorusKnotGeometry(0.035, 0.011, 24, 4), new THREE.MeshStandardMaterial({ color: '#f0cc6a', flatShading: true })); W.scene.add(c.blob); return c; },
    update(W, c, lt) {
      sitAt(c.gh, P.dinner + 0.95, 0, -Math.PI / 2, 0.05); c.gh.hairCurtain(1);
      const up = easeInOut(clamp(lt / 0.35)); const m = c.gh.mouthPos ? c.gh.mouthPos() : c.gh.headPos();
      const tip = V(P.dinner + 0.38, 0.8, 0).lerp(m.clone().add(V(-0.06, 0, 0)), up);
      c.fk.position.copy(tip); c.fk.rotation.set(0, 0, 0.9); c.gh.p.gripR = c.fk;
      face(c.gh, lt > 0.45 ? 'open' : 'happy', lt > 0.45 ? 'sad' : 'raised', lt > 0.45 ? 'o' : 'open', { headPitch: lt > 0.5 ? -0.35 : 0 });
    },
    after(W, c, lt) { ghostFx(c, lt); const f = Math.max(0, lt - 0.38); const m = c.gh.headPos(); c.blob.position.set(m.x - 0.05, Math.max(0.47, m.y - 0.08 - 4.9 * f * f), m.z); c.blob.visible = lt > 0.35; c.blob.rotation.set(f * 9, f * 5, 0); c.D.candles.forEach((cd, i) => cd.userData.flicker(lt, i * 3)); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.dinner + 0.25, 1.22, 1.25 - 0.1 * k], [P.dinner + 0.9, 0.95, 0], 42); },
  },
  // ================================================================ 27 "You eat for both of you." stuffing his face from both plates
  27: {
    build(W) { dinnerLights(W); const c = { D: GW.buildDinner(W) }; c.you = person(W, 'you'); ghost(W, c); c.fk = fork(W.scene, { spaghetti: true }); c.D.plates[1].position.set(-0.3, 0.745, 0.24); return c; },
    update(W, c, lt) {
      sitAt(c.you, P.dinner - 0.95, 0, Math.PI / 2, 0); c.you.p.eat = { fork: c.fk, from: [P.dinner - 0.38 + (Math.floor(lt / 0.42) % 2) * 0.08, 0.8, (Math.floor(lt / 0.42) % 2) * 0.24], phase: (lt / 0.42) % 1 };
      face(c.you, 'happy', 'raised', 'chew', { chewPh: lt * 14, bellyWobble: 0.3 });
      sitAt(c.gh, P.dinner + 0.95, 0, -Math.PI / 2, 0.05); face(c.gh, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); c.gh.hairCurtain(1);
    },
    after(W, c, lt) { ghostFx(c, lt); c.D.candles.forEach((cd, i) => cd.userData.flicker(lt, i * 3)); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.dinner - 0.3, 1.25, 1.2 - 0.1 * k], [P.dinner - 0.9, 1.05, 0], 42); },
  },
  // ================================================================ 28 "Your friends are still fucking staring." the same road; cut closer
  28: {
    build(W) { const c = { R: roadSet(W, { at: ZC - 3, size: 6 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0); return c; },
    update(W, c, lt) { friendsStare(c, lt + 1.1); c.you.p.visible = false; },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = clamp((lt - W.cut) / 1.6); return camAt([0.05, 1.62, ZC - 1.5 - 0.15 * q], [0, 1.55, ZC - 3.8], 42); }
      return camAt([2.0, 1.75, ZC + 0.7], [0, 1.25, ZC - 3.8], 44);
    },
  },
  // ================================================================ 29 "Month six." the park bench under the lamp
  29: {
    build(W) { GW.night(W, { at: [P.park, 0, 0], size: 7, moon: [10, 20, -25] }); const c = { Pk: GW.buildPark(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) { sitAt(c.you, P.park - 0.35, 0.02, 0, 0.0); face(c.you, 'happy', 'raised', 'smile', { lookAt: P3(c.gh.headPos()) }); sitAt(c.gh, P.park + 0.38, 0.02, 0, 0.04); face(c.gh, 'happy', 'raised', 'smile', { lookAt: P3(c.you.headPos()) }); c.gh.hairCurtain(1); c.gh.p.handR = [P.park + 0.12, 0.6, 0.12]; c.gh.p.handPoseR = 'flat'; },
    after(W, c, lt) { ghostFx(c, lt); fireflies(c.Pk, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.park + 0.4, 1.4, 4.3 - 0.3 * k], [P.park, 0.95, 0], 42); },
  },
  // ================================================================ 30 "You try to hold her hand." his hand reaches for hers
  30: {
    build(W) { GW.night(W, { at: [P.park, 0, 0], size: 5, moon: [10, 20, -25] }); const c = { Pk: GW.buildPark(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) {
      sitAt(c.you, P.park - 0.35, 0.02, 0, 0.0); sitAt(c.gh, P.park + 0.38, 0.02, 0, 0.04); c.gh.hairCurtain(1);
      face(c.you, 'open', 'raised', 'smile', { lookAt: [P.park + 0.1, 0.6, 0.15] }); face(c.gh, 'happy', 'raised', 'smile', { lookAt: [P.park, 0.6, 0.15] });
      const k = easeInOut(clamp(lt / W.dur)); c.you.p.handL = [lerp(P.park - 0.2, P.park + 0.08, k), 0.62, 0.14]; c.you.p.handPoseL = 'open';
      c.gh.p.handR = [P.park + 0.12, 0.6, 0.14]; c.gh.p.handPoseR = 'flat';
    },
    after(W, c, lt) { ghostFx(c, lt); fireflies(c.Pk, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.park - 0.05, 0.98, 0.95 - 0.08 * k], [P.park - 0.02, 0.66, 0.1], 42); },
  },
  // ================================================================ 31 "It goes right through." his hand passes through hers
  31: {
    build(W) { GW.night(W, { at: [P.park, 0, 0], size: 5, moon: [10, 20, -25] }); const c = { Pk: GW.buildPark(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) {
      sitAt(c.you, P.park - 0.35, 0.02, 0, 0.0); sitAt(c.gh, P.park + 0.38, 0.02, 0, 0.04); c.gh.hairCurtain(1);
      const k = easeIn(clamp(lt / 0.55)); c.you.p.handL = [P.park + 0.08 + 0.06 * k, lerp(0.62, 0.5, k), 0.14]; c.you.p.handPoseL = 'grip';
      c.gh.p.handR = [P.park + 0.12, 0.6, 0.14]; c.gh.p.handPoseR = 'flat';
      face(c.you, lt > 0.6 ? 'wide' : 'open', 'raised', lt > 0.9 ? 'grin' : 'o', { lookAt: [P.park + 0.12, 0.55, 0.14] }); face(c.gh, 'happy', 'sad', 'smile', { lookAt: [P.park + 0.1, 0.55, 0.14] });
    },
    after(W, c, lt) { ghostFx(c, lt); fireflies(c.Pk, lt); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.park + 0.02, 1.0, 0.95 - 0.06 * k], [P.park + 0.04, 0.66, 0.1], 42); },
    anchors: (W, c) => ({ hands: V(P.park + 0.12, 0.6, 0.14) }),
  },
  // ================================================================ 32 "One year." the hill with fairy lights over the city
  32: {
    build(W) { GW.night(W, { at: [P.hill, 0, 0], size: 7, moon: [-8, 20, -30] }); const c = { H: GW.buildHill(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) { standAt(c.you, P.hill - 0.45, -0.9, -0.5); face(c.you, 'happy', 'raised', 'smile'); ghostAt(c, P.hill + 0.45, -0.9, 0.5, lt); face(c.gh, 'happy', 'raised', 'smile'); c.gh.hairCurtain(1); },
    after(W, c, lt) { ghostFx(c, lt); c.H.bulbs.forEach((b, i) => { b.material.opacity = 0.55 + 0.25 * Math.sin(lt * 3 + i); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hill + 0.3, 1.5, 5.2 - 0.3 * k], [P.hill, 1.4, -2], 44); },
  },
  // ================================================================ 33 "She proposes." down on one knee, a glowing ring
  33: {
    build(W) { GW.night(W, { at: [P.hill, 0, 0], size: 6, moon: [-8, 20, -30] }); const c = { H: GW.buildHill(W) }; c.you = person(W, 'you'); ghost(W, c); c.box = GW.ringBox(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, P.hill - 0.4, -0.6, Math.PI / 2 - 0.2); face(c.you, 'wide', 'raised', 'o', { lookAt: P3(c.gh.headPos()) });
      c.you.p.handL = P3(hl(c.you, 0.1, -0.06, 0.07)); c.you.p.handR = P3(hl(c.you, -0.1, -0.06, 0.07)); c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
      const k = easeOut(clamp(lt / 0.5)); ghostAt(c, P.hill + 0.45, -0.6, -Math.PI / 2 + 0.2, lt, lerp(0.32, -0.28, k)); c.gh.p.lean = 0.25 * k;
      face(c.gh, 'happy', 'raised', 'smileOpen', { lookAt: P3(c.you.headPos()) }); c.gh.hairCurtain(1);
      c.box.position.set(...rel(c.gh, 0.32, 0, 0.95 + c.gh.p.y * 0.5)); c.box.rotation.set(0, -Math.PI / 2 + 0.2, 0); c.gh.p.gripR = c.box;
    },
    after(W, c, lt) { ghostFx(c, lt); c.H.bulbs.forEach((b, i) => { b.material.opacity = 0.55 + 0.25 * Math.sin(lt * 3 + i); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hill + 0.15, 1.15, 2.2 - 0.2 * k], [P.hill, 1.0, -0.6], 44); },
    anchors: (W, c) => ({ ring: c.box.position.clone().add(V(0, 0.06, 0)) }),
  },
  // ================================================================ 34 "The ring keeps" it falls through his finger
  34: { ...ringShot(0.15) },
  // ================================================================ 35 "falling through your finger." again (and again): clink
  35: { ...ringShot(0.05, true) },
  // ================================================================ 36 "You say yes anyway." nodding, heart eyes; she floats up happy
  36: {
    build(W) { GW.night(W, { at: [P.hill, 0, 0], size: 6, moon: [-8, 20, -30] }); const c = { H: GW.buildHill(W) }; c.you = person(W, 'you'); ghost(W, c); return c; },
    update(W, c, lt) {
      standAt(c.you, P.hill - 0.4, -0.6, Math.PI / 2 - 0.3); face(c.you, 'heart', 'raised', 'grin', { headPitch: -0.25 * Math.max(0, Math.sin(lt * 11)) });
      c.you.p.handL = rel(c.you, 0.2, 0.3, 1.25); c.you.p.handR = rel(c.you, 0.2, -0.3, 1.25); c.you.p.handPoseL = c.you.p.handPoseR = 'fist';
      ghostAt(c, P.hill + 0.45, -0.6, -Math.PI / 2 + 0.3, lt, 0.32 + 0.5 * easeOut(clamp(lt / 0.8))); face(c.gh, 'happy', 'raised', 'laugh'); c.gh.hairCurtain(1);
      c.gh.p.handL = rel(c.gh, 0.1, 0.4, 1.75 + c.gh.p.y); c.gh.p.handR = rel(c.gh, 0.1, -0.4, 1.75 + c.gh.p.y); c.gh.p.handPoseL = c.gh.p.handPoseR = 'open';
    },
    after(W, c, lt) { ghostFx(c, lt); c.H.bulbs.forEach((b, i) => { b.material.opacity = 0.55 + 0.25 * Math.sin(lt * 3 + i); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hill + 0.1, 1.45, 2.4 - 0.2 * k], [P.hill, 1.35, -0.6], 44); },
    anchors: (W, c) => ({ couple: V(P.hill, 1.6, -0.6) }),
  },
  // ================================================================ 37 "Wedding day." the haunted castle, bats, the moon
  37: {
    build(W) { GW.night(W, { at: [P.castle, 0, -30], size: 40, moon: [12, 14, -30], fog: [40, 200], far: 260 }); return { C: GW.buildCastle(W) }; },
    after(W, c, lt) { c.C.flyBats(lt + 3); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.castle + 4, 3 + 0.8 * k, 34 - 2 * k], [P.castle, 14, -40], 46, { far: 600 }); },
  },
  // ================================================================ 38 "At 3 AM." the castle clock
  38: {
    build(W) { GW.night(W, { at: [P.castle, 0, -30], size: 40, moon: [12, 14, -30], fog: [40, 200], far: 260 }); return { C: GW.buildCastle(W) }; },
    after(W, c, lt) { c.C.flyBats(lt + 6); },
    cam: (W, c, lt) => { const k = K(W, lt), a = c.C.clockAt; return camAt([a.x + 0.2, a.y - 0.3, a.z + 6.2 - 0.6 * k], [a.x, a.y, a.z], 40, { far: 600 }); },
  },
  // ================================================================ 39 "In a haunted ass castle." the aisle, candles, cobwebs, the altar
  39: {
    build(W) { hallLights(W); const c = { H: GW.buildHall(W) }; c.you = person(W, 'youTux'); ghost(W, c); c.pr = person(W, 'priest'); c.veil = veil(W.scene); return c; },
    update(W, c, lt) { standAt(c.you, P.hall - 0.45, -5.3, Math.PI); face(c.you, 'happy', 'raised', 'smile'); ghostAt(c, P.hall + 0.45, -5.3, Math.PI, lt, 0.25); face(c.gh, 'happy', 'raised', 'smile'); c.gh.hairCurtain(1); standAt(c.pr, P.hall, -7.3, 0); face(c.pr, 'open', 'neutral', 'neutral'); c.pr.p.handL = [P.hall - 0.15, 1.15, -6.95]; c.pr.p.handR = [P.hall + 0.15, 1.15, -6.95]; c.pr.p.handPoseL = c.pr.p.handPoseR = 'flat'; },
    after(W, c, lt) { ghostFx(c, lt); placeVeil(c.veil, c.gh); c.H.candelabras.forEach((cb, i) => cb.userData.candles.forEach((cd, j) => cd.userData.flicker(lt, i * 3 + j))); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hall + 0.3, 2.0, 4.5 - 0.8 * k], [P.hall, 1.5, -6], 46); },
  },
  // ================================================================ 40 "The priest faints." he sees her and falls back
  40: {
    build(W) { hallLights(W); const c = { H: GW.buildHall(W) }; c.you = person(W, 'youTux'); ghost(W, c); c.pr = person(W, 'priest'); c.veil = veil(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.you, P.hall - 0.45, -5.3, Math.PI); face(c.you, 'happy', 'raised', 'smile'); ghostAt(c, P.hall + 0.45, -5.3, Math.PI, lt, 0.25); face(c.gh, 'happy', 'raised', 'smile', { lookAt: P3(c.pr.headPos()) }); c.gh.hairCurtain(1);
      const k = easeIn(clamp((lt - 0.45) / 0.5));
      standAt(c.pr, P.hall, -7.3, 0); Object.assign(c.pr.p, { pitch: -1.45 * k }); face(c.pr, k > 0 ? 'closed' : 'wide', 'raised', k > 0 ? 'o' : 'o', { lookAt: k ? null : P3(c.gh.headPos()) });
      c.pr.p.handL = rel(c.pr, 0.2, 0.3, 1.1 - 0.3 * k); c.pr.p.handR = rel(c.pr, 0.2, -0.3, 1.1 - 0.3 * k); c.pr.p.handPoseL = c.pr.p.handPoseR = 'open';
    },
    after(W, c, lt) { ghostFx(c, lt); placeVeil(c.veil, c.gh); c.H.candelabras.forEach((cb, i) => cb.userData.candles.forEach((cd, j) => cd.userData.flicker(lt, i * 3 + j))); },
    cam: (W, c, lt) => camAt([P.hall + 0.8, 2.0, -2.4], [P.hall + 0.05, 1.4, -7.0], 44),
  },
  // ================================================================ 41 "And your friends?" three empty chairs with cobwebs
  41: {
    build(W) { hallLights(W); const c = { H: GW.buildHall(W) }; const ch = c.H.chairs; [0, 1, 2].forEach((i) => { const p = ch[i].position; GW.web(c.H.g, p.x, 0.95, p.z - 0.2, 0.6, 0, 0.3 * i); }); return c; },
    after(W, c, lt) { c.H.candelabras.forEach((cb, i) => cb.userData.candles.forEach((cd, j) => cd.userData.flicker(lt, i * 3 + j))); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hall - 3.2, 1.2, -1.2 - 0.2 * k], [P.hall - 2.2, 0.75, -2.8], 46); },
  },
  // ================================================================ 42 "Still standing on that same fucking road." cobwebs, grass, a rusty car; cut wider
  42: {
    build(W) { const c = { R: roadSet(W, { at: ZC - 3, size: 9, grown: 1 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0, '#2a8a9a', { rust: true }); oldFriends(W, c); return c; },
    update(W, c, lt) { friendsStare(c, lt + 0.4); c.you.p.visible = false; },
    after(W, c, lt) { c.car.setLights(0); nestAt(c); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = clamp((lt - W.cut) / Math.max(0.5, W.dur - W.cut)); return camAt([3.5 + 2 * q, 3.2 + 3 * q, ZC - 10 - 3 * q], [0, 1.0, ZC - 2], 46); }
      return camAt([0.1, 1.55, ZC + 0.4], [0, 1.25, ZC - 3.8], 44);
    },
  },
  // ================================================================ 43 "Staring." their faces, still staring
  43: {
    build(W) { const c = { R: roadSet(W, { at: ZC - 3, size: 6, grown: 1 }) }; crew(W, c); c.car = GW.convertible(W.scene, 0, ZC, 0, '#2a8a9a', { rust: true }); oldFriends(W, c); return c; },
    update(W, c, lt) { friendsStare(c, lt, { }); [c.f1, c.f2, c.f3].forEach((ch) => { ch.p.eyes = 'stare'; }); c.you.p.visible = false; },
    after(W, c, lt) { c.car.setLights(0); nestAt(c); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.0, 1.62, ZC - 1.55 - 0.1 * k], [0, 1.58, ZC - 3.8], 46); },
  },
};

// ------------------------------------------------------------------ helpers used above
function WD_smoke(W) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(200,200,205,1)'); gr.addColorStop(1, 'rgba(200,200,205,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.7, depthWrite: false }); const g = new THREE.Group(); W.scene.add(g);
  for (let i = 0; i < 12; i++) g.add(new THREE.Sprite(m)); g.userData.mat = m; return g;
}
function smokeAt(g, p, t, amount = 1) {
  g.children.forEach((s, i) => { const k = ((t * 0.9 + i / 12) % 1); s.position.set(p[0] + Math.sin(i * 2.1) * 0.3 * k, p[1] + k * 1.6, p[2] + Math.cos(i * 1.3) * 0.25 * k); s.scale.setScalar((0.3 + k * 1.2) * amount); });
  g.userData.mat.opacity = 0.55 * amount;
}
function dinnerLights(W) {
  const L = {}; L.hemi = new THREE.HemisphereLight(0x8a7a90, 0x2a1810, 0.75); W.scene.add(L.hemi);
  L.key = new THREE.PointLight(0xffb070, 6, 6, 1.6); L.key.position.set(P.dinner, 1.6, 0.6); W.scene.add(L.key);
  L.moon = new THREE.DirectionalLight(0x8aa0ff, 0.35); L.moon.position.set(P.dinner + 1, 4, -6); L.moon.target.position.set(P.dinner, 0, 0); W.scene.add(L.moon); W.scene.add(L.moon.target);
  W.scene.background = new THREE.Color('#120a0c'); W.lights = L;
}
function hallLights(W) {
  const L = {}; L.hemi = new THREE.HemisphereLight(0x7080b0, 0x201818, 0.85); W.scene.add(L.hemi);
  L.key = new THREE.PointLight(0xffb070, 10, 12, 1.4); L.key.position.set(P.hall, 3.2, -3.5); W.scene.add(L.key);
  L.fill = new THREE.PointLight(0xffa060, 5, 10, 1.6); L.fill.position.set(P.hall, 2.5, 1.5); W.scene.add(L.fill);
  W.scene.background = new THREE.Color('#0c0c14'); W.scene.fog = new THREE.Fog('#141420', 10, 30); W.lights = L;
}
function fireflies(Pk, t) { Pk.flies.forEach((f, i) => { const a = f.a + t * 1.3; f.s.position.x += Math.cos(a) * 0.004; f.s.position.y += Math.sin(a * 1.7) * 0.003; f.s.material.opacity = 0.5 + 0.45 * Math.sin(t * 4 + i * 1.7); }); }
function veil(scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1, 1, 6).translate(0, -0.55, 0), new THREE.MeshStandardMaterial({ color: '#f8fbff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, emissive: '#a8d0ff', emissiveIntensity: 0.4 }));
  scene.add(m); return m;
}
function placeVeil(v, gh) { const p = gh.head.getWorldPosition(new THREE.Vector3()); v.position.copy(p).add(new THREE.Vector3(0, 0.12, 0)); v.quaternion.copy(gh.head.getWorldQuaternion(new THREE.Quaternion())); v.translateZ(-0.11); v.rotateX(0.12); }
function oldFriends(W, c) {
  // cobwebs between them, a cobweb on a cap, a little bird nest on a head
  GW.webBetween(W.scene, [STARE[0][0], 1.2, STARE[0][1]], [STARE[1][0], 1.5, STARE[1][1]], 0.9);
  GW.webBetween(W.scene, [STARE[1][0], 1.3, STARE[1][1]], [STARE[2][0], 1.1, STARE[2][1]], 0.9);
  c.nest = new THREE.Group(); W.scene.add(c.nest);
  const nm = new THREE.MeshStandardMaterial({ color: '#7a5a34', flatShading: true });
  c.nest.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 5, 10).rotateX(Math.PI / 2), nm));
  for (let i = 0; i < 3; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5).scale(1, 1.25, 1), new THREE.MeshStandardMaterial({ color: '#c8e0f0' })); e.position.set(-0.025 + i * 0.025, 0.015, (i % 2) * 0.02); c.nest.add(e); }
}
function nestAt(c) { if (!c.nest) return; const h = c.f3.headPos(); c.nest.position.set(h.x, h.y + 0.13, h.z); }
function ringShot(fallAt, again = false) {
  return {
    build(W) { GW.night(W, { at: [P.hill, 0, 0], size: 4, moon: [-8, 20, -30] }); const c = { H: GW.buildHill(W) }; c.you = person(W, 'you'); ghost(W, c); c.rings = [0, 1, 2].map(() => GW.ring(W.scene)); return c; },
    update(W, c, lt) {
      standAt(c.you, P.hill - 0.4, -0.6, Math.PI / 2 - 0.2); face(c.you, 'open', 'raised', again ? 'grin' : 'o');
      c.you.p.handL = [P.hill - 0.08, 1.12, -0.48]; c.you.p.handPoseL = 'point';
      ghostAt(c, P.hill + 0.45, -0.6, -Math.PI / 2 + 0.2, lt, -0.2); face(c.gh, 'happy', 'raised', 'smile'); c.gh.hairCurtain(1);
      c.gh.p.handR = [P.hill + 0.02, 1.12, -0.45]; c.gh.p.handPoseR = 'grip';
    },
    after(W, c, lt) {
      ghostFx(c, lt);
      const tip = c.you.handPos('L');
      c.rings.forEach((r, i) => {
        const t0 = fallAt + i * 0.42 - (again ? 0.1 : 0), f = lt - t0;
        if (f < 0) { r.position.copy(tip).add(new THREE.Vector3(0.05, 0, 0)); r.rotation.set(0, 0, Math.PI / 2); r.visible = i === 0 || f > -0.42; return; }
        r.visible = true; const y = Math.max(0.05, tip.y - 4.9 * f * f * 1.6); r.position.set(tip.x + 0.04 + f * 0.05, y, tip.z + f * 0.03); r.rotation.set(f * 9, 0, Math.PI / 2 + f * 6);
      });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([P.hill + 0.15, 1.25, 0.25 - 0.05 * k], [P.hill - 0.05, 1.0, -0.5], 46); },
    anchors: (W, c) => ({ finger: c.you.handPos('L') }),
  };
}
