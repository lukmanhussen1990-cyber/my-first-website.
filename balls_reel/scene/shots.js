// The 31 shots of the "what if your balls doubled" reel (look of the user's reference: bright daylight low-poly
// city, plain faceted people, tan spheres; a new shot every ~1-1.5 s, the camera further back as they get bigger).
// Every shot is a clip; lt = seconds since the shot's start, W.dur = the shot's length (from the voice timing).
import * as THREE from 'three';
import { makeChar, helpers, CHAIR } from './cast.js';
import * as WD from './world.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn, easeOutBack, rng, noise1 } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const standAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY, y }); };
const sitAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY, y }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40, o = {}) => ({ pos: [...pos], target: [...target], fov, ...o });
const P3 = (v) => [v.x, v.y, v.z];
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const rel = (ch, f, l, y) => { const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); return [ch.p.pos[0] + F.x * f + L.x * l, y, ch.p.pos[1] + F.z * f + L.z * l]; };
const K = (W, lt) => clamp(lt / W.dur);
const X = WD.PLACES;

// ------------------------------------------------------------------ shared setups
function street(W, o = {}) { WD.day(W, { at: [o.x0 ?? 0, 0, 0], size: o.size ?? 7 }); return WD.buildStreet(W, o); }
function plaza(W, x0, { size = 30, city = 140, seed = 7, fog = [120, 700], far = 900 } = {}) {
  WD.day(W, { at: [x0, 0, 0], size, fog, far, from: [-8, 13, 10] });
  const g = new THREE.Group(); g.position.x = x0; W.scene.add(g);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 1, flatShading: true }));
  gm.receiveShadow = true; g.add(gm);
  WD.farCity(g, 0, -40, { radius: city, n: 46, seed, minR: 45 });
  return g;
}
// HIM holding his phone low in front (right hand), screen up
function holdPhone(c, ch, lt, { y = 1.02, f = 0.3 } = {}) {
  const p = rel(ch, f, -0.06, y); c.ph.position.set(...p); c.ph.rotation.set(-0.55, ch.p.rotY, 0, 'YXZ');
  ch.p.gripR = c.ph;
}
function blink(ch, t, every = 2.6) { const ph = (t % every) / every; if (ph > 0.94) ch.p.eyes = 'closed'; }
function worriedBob(ch, t) { ch.p.headRoll = Math.sin(t * 2.2) * 0.03; }
// the label anchor on a bulge (between the two balls, front)
const bulgeAt = (ch) => { const a = ch.bulgeBalls[0].getWorldPosition(V()), b = ch.bulgeBalls[1].getWorldPosition(V()); return a.add(b).multiplyScalar(0.5); };
// soldiers holding rifles (right hand on the grip, left hand under the barrel), aiming at a target point
function aimRifle(ch, rf, target, raise = 1) {
  const sh = ch.chestPos(), f = target ? V(...target).sub(sh).setY(0).normalize() : fwd(ch.p.rotY);
  const r = V(f.z, 0, -f.x).multiplyScalar(-1);
  const pos = sh.clone().addScaledVector(f, 0.22).addScaledVector(r, -0.08).add(V(0, lerp(-0.25, 0.02, raise), 0));
  rf.position.copy(pos); rf.lookAt(pos.clone().add(f.clone().add(V(0, lerp(-0.6, 0, raise), 0))));
  ch.p.handR = P3(pos.clone().addScaledVector(f, -0.05).add(V(0, -0.07, 0))); ch.p.handL = P3(pos.clone().addScaledVector(f, 0.28).add(V(0, -0.03, 0)));
  ch.p.handPoseR = ch.p.handPoseL = 'grip';
}

function bigCity(W) {
  plaza(W, X.big, { size: 70, city: 260, fog: [250, 1400], far: 2200 }); const c = {};
  c.sp = WD.tanSpheres(W.scene, 18.5, { x: X.big + 1.2, z: 0 });
  c.tower = WD.building(W.scene, X.big - 13, 26, 14, 34, 14, { seed: 7, bay: 3, floor: 3.1 });
  for (const [x, z, w, h] of [[-48, -30, 12, 22], [52, -40, 14, 26], [-70, 10, 12, 16], [70, 18, 12, 14], [30, 40, 10, 12]]) WD.building(W.scene, X.big + x, z, w, h, 12, { seed: 20 + x });
  c.him = person(W, 'him'); return c;
}
// sizes of the balls (radius of EACH, metres) at each step of the story
const R_MELON = 0.1, R_40KG = 0.17, R_CAR = 0.55, R_ARMY = 1.7, R_BUILD = 18.5;

export const SHOTS = {
  // ================================================================ 1 "What if your balls..." close-up, calm, phone
  1: {
    build(W) { const c = { S: street(W) }; c.him = person(W, 'him'); c.ph = WD.phone(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.him, 0, 0, 0.15); holdPhone(c, c.him, lt);
      face(c.him, 'open', 'neutral', 'neutral', { headPitch: -0.12, headYaw: 0.12 }); blink(c.him, lt + 1.4);
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.62 - 0.06 * k, 1.62, 1.55 - 0.12 * k], [0.05, 1.38, 0], 42); },
  },
  // ================================================================ 2 "...doubled in size every minute?" him + friend, she looks down
  2: {
    build(W) { const c = { S: street(W) }; c.him = person(W, 'him'); c.fr = person(W, 'friend'); c.ph = WD.phone(W.scene); return c; },
    update(W, c, lt) {
      const k = K(W, lt);
      standAt(c.him, 0.4, 0, -0.12); holdPhone(c, c.him, lt);
      face(c.him, 'open', 'neutral', 'neutral', { headPitch: -0.2 }); blink(c.him, lt + 0.3);
      standAt(c.fr, -0.42, 0.12, 0.35);
      const look = smooth((lt - 0.25) / 0.4);
      face(c.fr, look > 0.5 ? 'wide' : 'open', look > 0.5 ? 'raised' : 'neutral', look > 0.5 ? 'o' : 'neutral', { lookAt: [lerp(0.6, 0.42, look), lerp(1.55, 0.78, look), lerp(3, 0.2, look)] });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.15, 1.35, 4.1 - 0.3 * k], [0.0, 1.0, 0], 38); },
  },
  // ================================================================ 3 "Right now, the pair weighs..." kitchen scale, two small balls drop
  3: {
    build(W) { WD.day(W, { at: [X.kitchen, 1, 0], size: 3, from: [-4, 9, 6], fog: null, sky: false }); W.scene.background = new THREE.Color('#dfe9e8'); return { K: WD.buildKitchen(W) }; },
    after(W, c, lt) {
      const drop = 0.25, k = clamp((lt - drop) / 0.22);
      c.K.balls.forEach((b, i) => { const y0 = 0.0745; b.position.y = lt < drop ? 0.4 : y0 + (1 - easeIn(k)) * 0.33 + (k >= 1 ? Math.abs(Math.sin((lt - drop - 0.22) * 18)) * 0.012 * Math.exp(-(lt - drop - 0.22) * 8) : 0); b.visible = lt > drop - 0.05; });
      const shown = lt < drop + 0.22 ? 0 : Math.min(40, Math.round(((lt - drop - 0.22) / 0.35) * 40));
      c.K.screen.draw(`${shown} g`);
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.kitchen + 0.02, 1.13 - 0.02 * k, 0.32 - 0.05 * k], [X.kitchen, 0.95, -0.15], 36); },
  },
  // ================================================================ 4 "...about forty grams." the screen: 40 g
  4: {
    build(W) { WD.day(W, { at: [X.kitchen, 1, 0], size: 3, from: [-4, 9, 6], fog: null, sky: false }); W.scene.background = new THREE.Color('#dfe9e8'); const c = { K: WD.buildKitchen(W) }; c.K.screen.draw('40 g'); return c; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.kitchen + 0.01, 1.0 - 0.01 * k, 0.12 - 0.035 * k], [X.kitchen, 0.935, -0.12], 40); },
  },
  // ================================================================ 5 "Five minutes in:" FRIEND, shocked, looking down
  5: {
    build(W) { const c = { S: street(W) }; c.fr = person(W, 'friend'); c.him = person(W, 'him'); return c; },
    update(W, c, lt) {
      standAt(c.fr, -0.42, 0.12, 0.85); standAt(c.him, 0.4, 0, -0.12); c.him.p.bulge = R_MELON * 0.8; c.him.p.straddle = 0.3;
      const up = smooth((lt - 0.5) / 0.3);
      face(c.fr, 'wide', 'raised', up > 0.5 ? 'open' : 'o', { lookAt: [0.42, lerp(0.8, 0.95, up), 0.3] });
    },
    cam: (W, c, lt) => { const h = c.fr.headPos(), d = V(0.42, 0.95, 0.3).sub(h).normalize(), k = K(W, lt); const p = h.clone().addScaledVector(d, 0.78 - 0.08 * k); return camAt(P3(p), [h.x, h.y - 0.02, h.z], 40); },
  },
  // ================================================================ 6 "...they're the size of melons." walking funny, label MELON SIZE
  6: {
    build(W) { const c = { S: street(W) }; c.him = person(W, 'him'); return c; },
    update(W, c, lt) {
      const z = -1.4 + lt * 0.55, w = lt * 7.5;
      standAt(c.him, 0, z, 0); Object.assign(c.him.p, { walk: w, straddle: 0.75, bulge: R_MELON, roll: Math.sin(w) * 0.1, lean: 0.06 });
      face(c.him, 'open', 'worried', 'tight', { headRoll: -Math.sin(w) * 0.08 });
      c.him.p.handL = rel(c.him, 0.05, 0.36, 0.95); c.him.p.handR = rel(c.him, 0.05, -0.36, 0.95); c.him.p.handPoseL = c.him.p.handPoseR = 'open';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([1.15, 1.0, 1.9 + 0.5 * k], [0.0, 0.85, -1.0 + 0.6 * k], 42); },
    anchors: (W, c) => ({ bulge: bulgeAt(c.him) }),
  },
  // ================================================================ 7 "Ten minutes: forty kilos." onto the platform scale: 41 kg
  7: {
    build(W) { const c = { S: street(W, { x0: X.scale }) }; c.him = person(W, 'him'); c.sc = WD.platformScale(W.scene, X.scale, -0.2); c.bag = WD.cementBag(W.scene, X.scale - 1.25, 0.1, 0.3); return c; },
    update(W, c, lt) {
      const k = easeInOut(clamp((lt - 0.05) / 0.55));
      standAt(c.him, X.scale + lerp(1.3, 0.0, k), -0.2 + lerp(0.5, 0, k), lerp(-1.3, 0, k), k > 0.5 ? 0.12 : 0.12 * smooth((k - 0.3) / 0.2));
      Object.assign(c.him.p, { walk: k < 1 ? lt * 8 : null, straddle: 0.85, bulge: R_40KG, lean: 0.12 });
      face(c.him, 'open', 'worried', k >= 1 ? 'grimace' : 'tight');
      c.him.p.handL = rel(c.him, 0.08, 0.42, 0.9); c.him.p.handR = rel(c.him, 0.08, -0.42, 0.9); c.him.p.handPoseL = c.him.p.handPoseR = 'open';
    },
    after(W, c, lt) { const s = clamp((lt - 0.5) / 0.6); const n = s >= 1 ? 41 : Math.round(easeOut(s) * 41 + (s > 0 && s < 1 ? Math.sin(lt * 60) * 3 : 0)); c.sc.userData.screen.draw(s > 0 ? `${Math.max(0, n)} kg` : '0 kg'); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.scale - 0.6, 1.45, 3.1 - 0.3 * k], [X.scale + 0.15, 1.0, -0.2], 42); },
  },
  // ================================================================ 8 "Like a bag of cement." on the scale next to a cement bag, 41 kg
  8: {
    build(W) { const c = { S: street(W, { x0: X.scale }) }; c.him = person(W, 'him'); c.sc = WD.platformScale(W.scene, X.scale, -0.2); c.sc.userData.screen.draw('41 kg'); c.bag = WD.cementBag(W.scene, X.scale - 1.1, 0.15, 0.25); return c; },
    update(W, c, lt) {
      standAt(c.him, X.scale, -0.2, 0, 0.12); Object.assign(c.him.p, { straddle: 0.85, bulge: R_40KG, lean: 0.14, legBounce: 0.25 });
      face(c.him, 'open', 'worried', 'grimace', { lookAt: [X.scale - 1.1, 0.2, 0.2] });
      c.him.p.handL = rel(c.him, 0.1, 0.42, 0.88); c.him.p.handR = rel(c.him, 0.1, -0.42, 0.88); c.him.p.handPoseL = c.him.p.handPoseR = 'open';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.scale - 0.4, 1.25, 4.3 + 0.35 * k], [X.scale - 0.35, 0.85, -0.1], 40); },
  },
  // ================================================================ 9 "You try to stand up." straining
  9: {
    build(W) { const c = { S: street(W, { x0: X.scale }) }; c.him = person(W, 'him'); c.sc = WD.platformScale(W.scene, X.scale + 1.8, -0.9); c.sc.userData.screen.draw('41 kg'); return c; },
    update(W, c, lt) {
      const push = 0.5 + 0.5 * Math.sin(lt * 5.5);
      standAt(c.him, X.scale, 0, 0.2); Object.assign(c.him.p, { straddle: 1.0, bulge: R_40KG * 1.15, lean: lerp(0.62, 0.42, push), legBounce: 0.6, bounce: 0.25 });
      face(c.him, 'squint', 'worried', 'grimace', { headPitch: 0.25 });
      c.him.p.handL = rel(c.him, 0.32, 0.22, 0.62); c.him.p.handR = rel(c.him, 0.32, -0.22, 0.62); c.him.p.handPoseL = c.him.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.scale + 1.6, 1.0, 2.2 - 0.2 * k], [X.scale + 0.05, 0.75, 0], 42); },
    anchors: (W, c) => ({ head: c.him.headPos() }),
  },
  // ================================================================ 10 "You can't." falls forward onto them: the floor cracks
  10: {
    build(W) {
      const c = { S: street(W, { x0: X.scale }) }; c.him = person(W, 'him');
      c.crack = WD.crackDecal(W.scene, X.scale, 0.75, 2.6, 7); c.deb = WD.debris(W.scene, [X.scale, 0.05, 0.75], { n: 16, size: 0.06 });
      c.dust = WD.puffs(W.scene, 10, 'rgba(210,206,198,1)', 0.7);
      return c;
    },
    update(W, c, lt) {
      const hit = 0.32, k = easeIn(clamp(lt / hit)), b = lt > hit ? Math.exp(-(lt - hit) * 9) * Math.sin((lt - hit) * 30) * 0.05 : 0;
      standAt(c.him, X.scale, 0, 0); Object.assign(c.him.p, { straddle: 1.0, bulge: R_40KG * 1.2, pitch: lerp(0.25, 1.08, k) + b, lean: lerp(0.3, 0.1, k) });
      face(c.him, 'wide', 'raised', 'o', { headPitch: lerp(0.0, -0.75, k) });
      c.him.p.handL = rel(c.him, lerp(0.4, 1.1, k), 0.35, lerp(0.7, 0.12, k)); c.him.p.handR = rel(c.him, lerp(0.4, 1.1, k), -0.35, lerp(0.7, 0.12, k)); c.him.p.handPoseL = c.him.p.handPoseR = 'open';
    },
    after(W, c, lt) {
      const hit = 0.32; c.crack.userData.draw(clamp((lt - hit) / 0.18)); c.deb.update(Math.max(0, lt - hit));
      c.dust.children.forEach((s, i) => { const kk = clamp((lt - hit) / 0.9); const a = i / 10 * Math.PI * 2; s.visible = lt > hit; s.position.set(X.scale + Math.cos(a) * (0.3 + kk * 1.1), 0.12 + kk * 0.35, 0.75 + Math.sin(a) * (0.3 + kk * 0.9)); s.scale.setScalar(0.3 + kk * 0.6); });
      c.dust.userData.mat.opacity = 0.7 * (1 - clamp((lt - hit - 0.4) / 0.6));
    },
    cam: (W, c, lt) => camAt([X.scale + 1.7, 1.25, 3.3], [X.scale + 0.05, 0.6, 0.65], 44),
  },
  // ================================================================ 11 "Fifteen minutes:" sitting on top of two giant tan spheres
  11: {
    build(W) { const c = { S: street(W, { shelter: true }) }; c.him = person(W, 'him'); c.sp = WD.tanSpheres(W.scene, R_CAR, { x: 0, z: -0.3 }); return c; },
    update(W, c, lt) {
      sitAt(c.him, 0, -0.08, 0, 0.42); Object.assign(c.him.p, { straddle: 0.8 });
      face(c.him, 'open', 'worried', 'frown', { lookAt: [0.3, 1.2, 4] }); worriedBob(c.him, lt); blink(c.him, lt + 0.8);
      c.him.p.handL = rel(c.him, 0.05, 0.32, 0.98); c.him.p.handR = rel(c.him, 0.05, -0.32, 0.98); c.him.p.handPoseL = c.him.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.5, 1.25, 3.2 + 0.2 * k], [0.0, 1.05, -0.2], 40); },
  },
  // ================================================================ 12 "...as heavy as a small car." next to a car, label 1.3 TONS
  12: {
    build(W) { const c = { S: street(W, { shelter: true }) }; c.him = person(W, 'him'); c.sp = WD.tanSpheres(W.scene, R_CAR, { x: 0, z: -0.3 }); c.car = WD.boxCar(W.scene, 2.35, -0.5, { color: '#3fae5a', ry: 0.25 }); return c; },
    update(W, c, lt) {
      sitAt(c.him, 0, -0.08, 0, 0.42); Object.assign(c.him.p, { straddle: 0.8 });
      face(c.him, 'open', 'worried', 'frown', { lookAt: [2.35, 0.8, -0.5] });
      c.him.p.handL = rel(c.him, 0.05, 0.32, 0.98); c.him.p.handR = rel(c.him, 0.05, -0.32, 0.98); c.him.p.handPoseL = c.him.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([1.15, 2.7, 11.2 + 0.9 * k], [1.15, 0.9, -0.3], 40); },
    anchors: (W, c) => ({ spheres: V(0, R_CAR * 2.05, -0.3) }),
  },
  // ================================================================ 13 "Twenty minutes:" tanks roll in around the spheres
  13: {
    build(W) {
      const g = plaza(W, X.army, { size: 22 }); const c = { g };
      c.sp = WD.tanSpheres(W.scene, R_ARMY, { x: X.army, z: 0 });
      c.tanks = [[-8, 6, 0.7], [8, 5, -0.8], [-9, -4, 2.1], [9, -5, -2.2]].map(([x, z, ry]) => ({ t: WD.tank(W.scene, X.army + x, z, ry), x, z, ry }));
      c.dust = WD.puffs(W.scene, 16); return c;
    },
    after(W, c, lt) {
      c.tanks.forEach((T, i) => { const k = 1 - easeOut(clamp((lt + 0.25 + i * 0.05) / (W.dur * 0.85))); const d = 6 * k; const f = fwd(T.ry); T.t.position.set(X.army + T.x - f.x * d, 0, T.z - f.z * d); T.t.userData.spin(lt * 6 * (k > 0.02 ? 1 : 0)); });
      c.dust.children.forEach((s, i) => { const T = c.tanks[i % 4].t, f = fwd(c.tanks[i % 4].ry); const back = 3 + (i >> 2) * 0.9; s.position.set(T.position.x - f.x * back, 0.4 + (i >> 2) * 0.25, T.position.z - f.z * back); s.scale.setScalar(1.4 + (i >> 2) * 0.5); });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.army + 3, 11 + k * 0.8, 25 + 2 * k], [X.army, 0.8, 0], 50); },
  },
  // ================================================================ 14 "...the army arrives." soldiers surround the spheres
  14: {
    build(W) {
      plaza(W, X.army, { size: 18 }); const c = {};
      c.sp = WD.tanSpheres(W.scene, R_ARMY, { x: X.army, z: 0 });
      c.tanks = [[-8, 6, 0.7], [8, 5, -0.8], [-9, -4, 2.1]].map(([x, z, ry]) => WD.tank(W.scene, X.army + x, z, ry));
      c.sol = [0, 1, 2, 3, 4, 5].map((i) => { const ch = person(W, i ? `soldier#${i}` : 'soldier', { face: { seed: 13 + i * 7 } }); ch.rf = WD.rifle(W.scene); return ch; });
      return c;
    },
    update(W, c, lt) {
      c.sol.forEach((ch, i) => {
        const a = -0.9 + i * 0.36, R1 = 5.2 + (i % 2) * 0.8, R0 = R1 + 6, k = easeOut(clamp((lt - i * 0.06) / (W.dur * 0.75)));
        const r = lerp(R0, R1, k), x = X.army + Math.sin(a) * r, z = Math.cos(a) * r;
        standAt(ch, x, z, a + Math.PI); ch.p.walk = k < 0.98 ? lt * 13 + i : null;
        face(ch, 'open', 'angry', 'tight');
        aimRifle(ch, ch.rf, [X.army, 1.5, 0], smooth((k - 0.7) / 0.3));
      });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.army + 2.5, 2.3, 13.5 - 0.6 * k], [X.army, 1.7, 0], 46); },
  },
  // ================================================================ 15 "They try to move them." tanks pull with chains: nothing moves
  15: {
    build(W) {
      plaza(W, X.army, { size: 20 }); const c = {};
      c.sp = WD.tanSpheres(W.scene, R_ARMY, { x: X.army, z: 0 });
      c.tanks = [-1, 1].map((sd) => WD.tank(W.scene, X.army + sd * 2.2, 8.2, sd * 0.12));
      c.chains = c.tanks.map((t, i) => { const hook = t.localToWorld(t.userData.hook.clone()); const sd = i ? 1 : -1; return WD.chain(W.scene, P3(hook), [X.army + sd * 1.72, 1.2, R_ARMY * 0.95], { sag: 0.05 }); });
      c.dust = WD.puffs(W.scene, 14); return c;
    },
    after(W, c, lt) {
      c.tanks.forEach((t, i) => {
        const sd = i ? 1 : -1, j = Math.sin(lt * 47 + i) * 0.03;
        t.position.z = 8.2 + j; t.rotation.z = Math.sin(lt * 31 + i) * 0.012; t.userData.spin(lt * 30);
        const hook = t.localToWorld(t.userData.hook.clone()); c.chains[i].userData.set(hook, V(X.army + sd * 1.72, 1.2, R_ARMY * 0.95), 0.02, 0.01 * Math.sin(lt * 40));
      });
      c.dust.children.forEach((s, i) => { const t = c.tanks[i % 2], kk = ((lt * 1.6 + i * 0.13) % 1); s.position.set(t.position.x + (hash1(i) - 0.5) * 3, 0.3 + kk * 1.0, t.position.z + 2.8 + kk * 2.5); s.scale.setScalar(0.8 + kk * 2.0); });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.army + 5.5, 4.2, 19 + k], [X.army + 0.3, 1.4, 3], 46); },
  },
  // ================================================================ 16 "Damage: zero percent." the sphere close: not a scratch
  16: {
    build(W) {
      plaza(W, X.army, { size: 12 }); const c = {};
      c.sp = WD.tanSpheres(W.scene, R_ARMY, { x: X.army, z: 0 });
      c.sol = [0, 1].map((i) => { const ch = person(W, i ? 'soldier#3' : 'soldier#4', { face: { seed: 40 + i * 9 } }); ch.rf = WD.rifle(W.scene); return ch; });
      c.puff = WD.puffs(W.scene, 6, 'rgba(120,120,120,1)', 0.55); return c;
    },
    update(W, c, lt) {
      c.sol.forEach((ch, i) => { standAt(ch, X.army + 0.9 + i * 1.3, 3.1 + i * 0.6, Math.PI + 0.25); face(ch, 'wide', 'raised', 'o', { lookAt: [X.army + 0.5, 3.2, 0] }); aimRifle(ch, ch.rf, [X.army + 0.5, 3.4, 0], 0.4); });
    },
    after(W, c, lt) { c.puff.children.forEach((s, i) => { const kk = clamp((lt - i * 0.08) / 1.2); s.position.set(X.army + 1.0 + i * 0.25, 2.2 + kk * 1.4 + i * 0.1, 1.2 + i * 0.05); s.scale.setScalar(0.25 + kk * 0.6); }); c.puff.userData.mat.opacity = 0.5 * (1 - clamp((lt - 0.6) / 0.8)); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.army + 3.4, 1.6, 5.4 - 0.4 * k], [X.army + 1.2, 2.3, 0.6], 46); },
  },
  // ================================================================ 17 "Thirty minutes:" next to a tall (11-story) building
  17: {
    build(W) { return bigCity(W); },
    update(W, c, lt) { standAt(c.him, X.big + 20.1, 0, 0.3, R_BUILD * 2 - 0.02); face(c.him, 'open', 'worried', 'frown'); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.big + 14, 2.5, 92 + 8 * k], [X.big + 4, 21, 0], 44, { far: 3000 }); },
  },
  // ================================================================ 18 "...taller than an eleven-story building." HIM tiny on top
  18: {
    build(W) { return bigCity(W); },
    update(W, c, lt) { standAt(c.him, X.big + 20.1, 0, 0.3, R_BUILD * 2 - 0.02); face(c.him, 'open', 'worried', 'frown'); c.him.p.handR = rel(c.him, 0.1, -0.3, 2.1 + R_BUILD * 2 + Math.sin(lt * 9) * 0.1); c.him.p.handPoseR = 'open'; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.big + 20, 26 + 6 * k, 120 + 40 * k], [X.big + 2, 22, 0], 44, { far: 3000 }); },
    anchors: (W, c) => ({ him: c.him.headPos().add(V(0, 0.5, 0)) }),
  },
  // ================================================================ 19 "The world panics." the news: BALL-POCALYPSE (header + ticker are 2D)
  19: {
    build(W) {
      WD.day(W, { at: [X.news, 1, 0], size: 4, from: [2, 8, 9], fog: [200, 900], far: 1200, sky: true });
      const c = {}; const g = new THREE.Group(); g.position.x = X.news; W.scene.add(g);
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.8).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.5, flatShading: true })); desk.position.set(0, 0, 0.45); g.add(desk);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: '#e8ecf2', roughness: 0.3 })); top.position.set(0, 0.82, 0.45); g.add(top);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(5, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1e2a44', roughness: 0.4 })); fl.position.z = 0.5; g.add(fl);
      // the city outside (a big window): buildings + the two giant spheres far away
      const out = new THREE.Group(); out.position.set(0, -3, -70); g.add(out);
      const og = new THREE.Mesh(new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 1 })); og.position.set(0, 0, -40); out.add(og);
      WD.tanSpheres(out, 13, { x: 4, z: -40 });
      for (let i = 0; i < 18; i++) WD.building(out, -52 + i * 6.2, -6 + (i % 3) * 5, 5, 8 + (i * 7 % 9) * 2.2, 5, { seed: 3 + i });
      c.anchor = person(W, 'anchor'); c.papers = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.3), new THREE.MeshStandardMaterial({ color: '#fbfaf4' })); c.papers.position.set(X.news + 0.15, 0.85, 0.35); W.scene.add(c.papers);
      return c;
    },
    update(W, c, lt) {
      sitAt(c.anchor, X.news, -0.35, 0, 0.0); helpers.talk(c.anchor, lt * 1.3, 1);
      face(c.anchor, 'wide', 'worried', c.anchor.p.talk > 0.4 ? 'talkOpen' : 'frownOpen', { headRoll: Math.sin(lt * 3) * 0.04 });
      const g = Math.sin(lt * 6) * 0.05;
      c.anchor.p.handL = [X.news + 0.25, 1.05 + g, 0.25]; c.anchor.p.handR = [X.news - 0.25, 1.0 - g, 0.25]; c.anchor.p.handPoseL = c.anchor.p.handPoseR = 'open';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.news, 1.3, 1.85 - 0.1 * k], [X.news, 1.12, 0], 44, { far: 1500 }); },
  },
  // ================================================================ 20 "Your mom is stuck in traffic" the highway jam to the spheres
  20: {
    build(W) {
      WD.day(W, { at: [X.hwy, 0, -60], size: 80, from: [-6, 12, 8], fog: [200, 1200], far: 1800, shadow: 4096 });
      const c = { H: WD.buildHighway(W) };
      WD.tanSpheres(W.scene, 42, { x: X.hwy + 6, z: -620 }); WD.farCity(W.scene, X.hwy, -600, { radius: 190, n: 50, seed: 11, minR: 70 });
      return c;
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.hwy + 1, 22 - 2 * k, 30 - 6 * k], [X.hwy, 2, -160], 46, { far: 2200 }); },
  },
  // ================================================================ 21 "...because of you." one car honking: MOM
  21: {
    build(W) {
      WD.day(W, { at: [X.hwy, 0, -10], size: 25, from: [-6, 12, 8], fog: [150, 1100], far: 1600 });
      const c = { H: WD.buildHighway(W, { skip: [[-1.8, -9.5, 3.2]] }) };
      WD.tanSpheres(W.scene, 42, { x: X.hwy + 6, z: -620 }); WD.farCity(W.scene, X.hwy, -600, { radius: 190, n: 50, seed: 11, minR: 70 });
      c.mom = WD.boxCar(W.scene, X.hwy - 1.8, -9.5, { color: '#e86a9a', ry: Math.PI }); return c;
    },
    after(W, c, lt) { const h = (lt % 0.45) < 0.22; c.mom.position.y = h ? 0.02 : 0; c.mom.rotation.z = h ? 0.01 : 0; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.hwy + 3.5, 3.4, 4.5 + 0.8 * k], [X.hwy - 1.2, 0.9, -14], 42, { far: 2000 }); },
    anchors: (W, c) => ({ mom: c.mom.localToWorld(V(0, 1.6, 0)) }),
  },
  // ================================================================ 22 "One hour:" on a crushed mountain range
  22: {
    build(W) {
      WD.day(W, { at: [X.mtn, 0, 0], size: 4000, from: [-6, 9, 8], fog: [6000, 40000], far: 60000, shadow: 4096 });
      const g = new THREE.Group(); g.position.x = X.mtn; W.scene.add(g);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a9a6e', roughness: 1 })); gm.receiveShadow = true; g.add(gm);
      WD.mountainRange(g, 0, 0, { n: 16, spread: 16000, hMin: 1600, hMax: 3600, crushAt: [0, 0], crushR: 3000, seed: 3 });
      WD.mountainRange(g, 0, -7000, { n: 12, spread: 22000, hMin: 2200, hMax: 4200, seed: 8 });
      const c = { sp: WD.tanSpheres(g, 1500, { x: 0, z: 0, y: 1100 }) };
      c.dust = WD.puffs(g, 14, 'rgba(200,190,170,1)', 0.6); return c;
    },
    after(W, c, lt) { c.dust.children.forEach((s, i) => { const a = (i / 14) * Math.PI * 2, kk = clamp(lt / 2); s.position.set(Math.cos(a) * (3200 + kk * 600), 300 + (i % 3) * 200, Math.sin(a) * 1800); s.scale.setScalar(1400 + kk * 500); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.mtn + 2500, 1200 + 300 * k, 11500 + 1500 * k], [X.mtn, 1500, 0], 46, { near: 10, far: 90000 }); },
  },
  // ================================================================ 23 "...heavier than every mountain on Earth." further back
  23: {
    build(W) {
      WD.day(W, { at: [X.mtn, 0, 0], size: 6000, from: [-6, 9, 8], fog: [9000, 60000], far: 90000, shadow: 4096 });
      const g = new THREE.Group(); g.position.x = X.mtn; W.scene.add(g);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(300000, 300000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a9a6e', roughness: 1 })); gm.receiveShadow = true; g.add(gm);
      WD.mountainRange(g, 0, 0, { n: 16, spread: 16000, hMin: 1600, hMax: 3600, crushAt: [0, 0], crushR: 3000, seed: 3 });
      WD.mountainRange(g, 0, -7000, { n: 12, spread: 22000, hMin: 2200, hMax: 4200, seed: 8 });
      WD.mountainRange(g, -14000, 6000, { n: 8, spread: 12000, seed: 12 }); WD.mountainRange(g, 15000, 5000, { n: 8, spread: 12000, seed: 14 });
      return { sp: WD.tanSpheres(g, 1500, { x: 0, z: 0, y: 1100 }) };
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.mtn - 4000, 6000 + 1500 * k, 26000 + 5000 * k], [X.mtn, 1200, 0], 44, { near: 20, far: 160000 }); },
  },
  // ================================================================ 24 "Eighty-seven minutes:" the balance: 8 BILLION PEOPLE vs the spheres
  24: {
    build(W) {
      WD.day(W, { at: [X.bal, 2, 0], size: 12, from: [-6, 12, 9] });
      const g = new THREE.Group(); g.position.x = X.bal; W.scene.add(g);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: WD.grassTex(300), roughness: 1 })); gm.receiveShadow = true; g.add(gm);
      const c = { B: WD.balanceScale(g, 0, 0) };
      c.people = WD.peopleHeap(c.B.userData.pans[0].pan, 520, 1.45, 0.9, 5); c.people.position.y = 0;
      c.sp = WD.tanSpheres(c.B.userData.pans[1].pan, 0.7, { x: 0, z: 0, y: 0.7 }); return c;
    },
    after(W, c, lt) { c.B.userData.tilt(-0.12 + Math.sin(lt * 5) * 0.02 * (1 - K(W, lt))); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.bal + 0.5, 5.0, 23 + 1.2 * k], [X.bal, 3.4, 0], 46); },
    anchors: (W, c) => ({ people: c.B.userData.pans[0].pan.localToWorld(V(0, 1.3, 0)) }),
  },
  // ================================================================ 25 "...heavier than the Earth itself." the spheres' side slams down
  25: {
    build(W) {
      WD.day(W, { at: [X.bal, 2, 0], size: 12, from: [-6, 12, 9] });
      const g = new THREE.Group(); g.position.x = X.bal; W.scene.add(g);
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: WD.grassTex(300), roughness: 1 })); gm.receiveShadow = true; g.add(gm);
      const c = { B: WD.balanceScale(g, 0, 0) };
      c.people = WD.peopleHeap(c.B.userData.pans[0].pan, 520, 1.45, 0.9, 5);
      c.sp = WD.tanSpheres(c.B.userData.pans[1].pan, 0.7, { x: 0, z: 0, y: 0.7 }); return c;
    },
    after(W, c, lt) {
      const k = clamp((lt - 0.1) / 0.28), a = lerp(-0.12, 0.42, easeIn(k)) + (k >= 1 ? Math.exp(-(lt - 0.38) * 7) * Math.sin((lt - 0.38) * 26) * 0.04 : 0);
      c.B.userData.tilt(a);
      c.people.position.y = k >= 1 ? Math.max(0, Math.sin(clamp((lt - 0.38) / 0.5) * Math.PI) * 1.4) : 0;
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.bal + 0.5, 5.2, 24.5 + 1.5 * k], [X.bal, 3.4, 0], 46); },
    anchors: (W, c) => ({ people: c.B.userData.pans[0].pan.localToWorld(V(0, 1.3, 0)) }),
  },
  // ================================================================ 26 "Now the Earth orbits YOU." space: labels EARTH, HIM (SOMEWHERE)
  26: {
    build(W) { WD.spaceBg(W, [X.space, 0, 0]); const c = { sp: WD.tanSpheres(W.scene, 1.4, { x: X.space, z: 0, y: 0, seg: 22 }) }; c.earth = WD.earth(W.scene, 0.85); return c; },
    after(W, c, lt) {
      const a = 1.9 - lt * 1.25; c.earth.position.set(X.space + Math.cos(a) * 3.1, Math.sin(a) * 4.6, Math.sin(a) * 2.2); c.earth.rotation.y = lt * 1.5;
      c.sp.rotation.y = lt * 0.15;
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.space + 0.3, 0.8, 19 - 1.2 * k], [X.space, 0.3, 0], 42, { far: 3000 }); },
    anchors: (W, c) => ({ earth: c.earth.position.clone().add(V(0, 0.9, 0)), him: V(X.space, 1.25, 0.4) }),
  },
  // ================================================================ 27 "Two hours: gravity wins." everything pulled in
  27: {
    build(W) {
      WD.spaceBg(W, [X.space, 0, 0]); const c = { sp: WD.tanSpheres(W.scene, 1.4, { x: X.space, z: 0, y: 0, seg: 22 }) }; c.earth = WD.earth(W.scene, 0.85);
      const R = rng(4); c.rocks = [];
      for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + R() * 0.12, 0), new THREE.MeshStandardMaterial({ color: ['#8a8478', '#a09a8e', '#6a6660'][i % 3], flatShading: true })); W.scene.add(m); c.rocks.push({ m, a: R() * Math.PI * 2, r: 4 + R() * 7, y: (R() - 0.5) * 3, s: 0.6 + R() * 0.8 }); }
      c.glow = WD.puffs(W.scene, 1, 'rgba(255,220,180,1)', 0.0); return c;
    },
    after(W, c, lt) {
      const k = K(W, lt), pull = easeIn(k);
      const a = 0.4 - lt * (1.8 + pull * 3), r = lerp(4.2, 2.3, pull);
      c.earth.position.set(X.space + Math.cos(a) * r * 0.7, Math.sin(a) * r, Math.sin(a) * r * 0.4); c.earth.scale.set(1 + pull * 0.35, 1 - pull * 0.15, 1 - pull * 0.15);
      c.earth.lookAt(X.space, 0, 0);
      c.rocks.forEach((o) => { const rr = Math.max(1.7, o.r * (1 - pull * 0.85) - lt * o.s); const aa = o.a + lt * (2.5 / rr); o.m.position.set(X.space + Math.cos(aa) * rr, o.y * (rr / o.r), Math.sin(aa) * rr * 0.6); });
      c.sp.userData.balls.forEach((b, i) => { b.position.x = (i ? 1 : -1) * 1.4 * lerp(1.02, 0.78, pull); });
      const gl = c.glow.children[0]; gl.position.set(X.space, 0, 0.5); gl.scale.setScalar(6 + 4 * pull); c.glow.userData.mat.opacity = 0.15 + 0.5 * pull; c.glow.userData.mat.blending = THREE.AdditiveBlending;
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([X.space, 1.6, 14.5 - 2.5 * k], [X.space, 0, 0], 42, { far: 3000 }); },
  },
  // ================================================================ 28 "You become..." they collapse: white flash (2D)
  28: {
    build(W) { WD.spaceBg(W, [X.space, 0, 0]); const c = { sp: WD.tanSpheres(W.scene, 1.4, { x: X.space, z: 0, y: 0, seg: 22 }) }; c.glow = WD.puffs(W.scene, 1, 'rgba(255,240,220,1)', 0.0); c.glow.userData.mat.blending = THREE.AdditiveBlending; return c; },
    after(W, c, lt) {
      const k = easeIn(clamp(lt / (W.dur * 0.8)));
      c.sp.userData.balls.forEach((b, i) => { b.position.x = (i ? 1 : -1) * 1.4 * lerp(0.78, 0.15, k); b.scale.setScalar(lerp(1, 0.55, k)); });
      const gl = c.glow.children[0]; gl.position.set(X.space, 0, 1); gl.scale.setScalar(lerp(8, 18, k)); c.glow.userData.mat.opacity = lerp(0.5, 1, k);
    },
    cam: (W, c, lt) => camAt([X.space, 1.2, 11.5], [X.space, 0, 0], 42, { far: 3000 }),
  },
  // ================================================================ 29 "...a black hole." swirling in space
  29: {
    build(W) { WD.spaceBg(W, [X.space, 0, 0]); const c = { bh: WD.blackHole(W.scene, { r: 1 }) }; c.bh.position.set(X.space, 0, 0); return c; },
    after(W, c, lt) { const d = c.bh.userData; d.disk.rotation.z = -lt * 1.4; d.ringGlow.material.opacity = 0.75 + 0.25 * Math.sin(lt * 9); d.jets.forEach((j) => { j.material.opacity = 0.6 + 0.3 * Math.sin(lt * 13); }); },
    cam: (W, c, lt) => { const k = K(W, lt); const a = 0.25 - k * 0.2; return camAt([X.space + Math.sin(a) * 14, 2.0 - k * 0.5, Math.cos(a) * 14], [X.space, 0, 0], 40, { far: 3000 }); },
  },
  // ================================================================ 30 "Which is why..." a quiet empty street
  30: {
    build(W) { return { S: street(W, { size: 12 }) }; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([6.5 - 0.4 * k, 1.7, 3.5], [-6, 2.6, -7], 50); },
  },
  // ================================================================ 31 "...you should never ask 'what if'." HIM, phone, staring at us
  31: {
    build(W) { const c = { S: street(W) }; c.him = person(W, 'him'); c.ph = WD.phone(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.him, 0, 0, 0.1); holdPhone(c, c.him, lt);
      const cam = SHOTS[31].cam(W, c, lt).pos;
      face(c.him, 'open', 'neutral', 'neutral', { lookAt: cam }); if (lt > 1.6 && lt < 1.75) c.him.p.eyes = 'closed';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.32 - 0.06 * k, 1.6, 1.6 - 0.25 * k], [0.03, 1.36, 0], 42); },
  },
};
