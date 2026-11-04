// The 21 shots of the salt reel as code-made low-poly 3D animations (one entry per shot; every shot is a clip).
// On screen YOU is ONLY shaking a salt shaker over his fries (the "jerking off the salt" line is just a joke in
// the words). Each shot: build(W) -> ctx, update(W, ctx, lt) (poses), after(W, ctx, lt) (props), cam(W, ctx, lt),
// anchors(W, ctx, lt) -> named 3D points for the 2D effects (labels with arrows, salt, sweat...).
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './sets.js';
import * as KT from './kitchen.js';
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

// ------------------------------------------------------------------ the kitchen + YOU at the table
const K = KT.K;
const SEAT = [0, -0.6];
const BLOWER_YAW = -2.0;                                  // the blower's tube points at the plate on the table
function kitchen(W, o = {}) {
  S.lights(W, { sky: 0xfffaf2, ground: 0xe8dccc, hemi: 1.15, key: 0xfff4e4, keyI: 1.35, fillI: 0 });
  S.keyAt(W, [0.4, 1, -0.8], { from: [2.5, 6, 4.5], size: 4 });
  W.scene.background = new THREE.Color('#f4efe6');
  const c = { K: KT.buildKitchen(W) };
  if (o.blower) { c.bl = KT.leafBlower(c.K.g); c.bl.position.set(...K.blower); c.bl.rotation.y = BLOWER_YAW; c.bl.scale.setScalar(0.9); }
  if (o.mount) c.K.plate.userData.mount.scale.setScalar(o.mount);
  return c;
}
function seated(W, c, name = 'you') { c.you = person(W, name); return c; }
const sit = (c) => { sitAt(c.you, ...SEAT, 0); c.you.p.handL = rel(c.you, 0.42, 0.2, K.top + 0.02); c.you.p.handPoseL = 'flat'; };
// the shaker held upside down over the fries; shake = 0..1 (how hard)
const PLATE = K.plate;
function shakerOver(c, lt, shake = 1, hz = 7, h = 1.1) {
  const s = c.sh, k = Math.sin(lt * hz * Math.PI * 2);
  s.position.set(PLATE[0] + 0.04 + k * 0.012 * shake, h + k * 0.07 * shake, PLATE[2] + 0.02);
  s.rotation.set(Math.PI + k * 0.25 * shake, 0, 0.12 * k * shake);
  c.you.p.gripR = s;
}
const frus = (ch, lt, o = {}) => face(ch, 'squint', 'angry', Math.sin(lt * 9) > 0 ? 'grimace' : 'tight', o);
const saltCat = (c) => c.K.cat.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.width < 0.02) o.material = new THREE.MeshStandardMaterial({ color: '#141414' }); });
const tapedShaker = (c) => { const n = c.bl.localToWorld(c.bl.userData.nozzle.clone().add(V(0.12, 0, 0))); c.sh.position.copy(n); c.sh.rotation.set(0, BLOWER_YAW, -Math.PI / 2); };

export const SHOTS = {
  // 01 "You've been jerking off the salt" the joke shot: his strained face above the table, and under the table only
  // his hand, furiously shaking the SALT SHAKER (the next shot shows it's just salt over his fries)
  1: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, ...SEAT, 0); c.you.p.handL = rel(c.you, 0.42, 0.2, K.top + 0.02); c.you.p.handPoseL = 'flat';
      frus(c.you, lt, { headPitch: 0.05, lean: 0.06, headRoll: Math.sin(lt * 7.5 * Math.PI * 2) * 0.03 });
      const k = Math.sin(lt * 7.5 * Math.PI * 2), sh = c.sh;
      sh.position.set(0.06, 0.5 + k * 0.05, -0.18); sh.rotation.set(0.1 + k * 0.15, 0, 0.1); c.you.p.gripR = sh;
    },
    cam: (W, c, lt) => camAt([0.04, 0.8, 1.35 - lt * 0.12], [0.0, 0.82, -0.45], 50),
    anchors: (W, c) => ({ forehead: forehead(c.you), shaker: c.sh.position.clone().add(V(0, 0.12, 0)) }),
  },
  // 02 "for two minutes." wide: the kitchen, the cat watches from the counter
  2: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) { sit(c); frus(c.you, lt, { headPitch: -0.25, lean: 0.12 }); shakerOver(c, lt, 1, 7.5); },
    after(W, c, lt) { c.K.cat.userData.head.rotation.x = Math.sin(lt * 7.5 * Math.PI * 2) * 0.15; c.K.cat.userData.head.rotation.y = 0.4; },
    cam: (W, c, lt) => camAt([-0.5 + lt * 0.08, 1.75, 1.9], [0.7, 0.98, -1.35], 52),
    anchors: (W, c) => ({ forehead: forehead(c.you), cat: [K.cat[0], K.cat[1] + 0.5, K.cat[2]] }),
  },
  // 03 "And nothing's coming out." ECU from the plate: the holes, nothing comes out
  3: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) { sit(c); frus(c.you, lt, { headPitch: -0.3 }); shakerOver(c, lt, 0.5, 5, 1.16); },
    cam: (W, c, lt) => { const t = c.sh.userData.top(); return camAt([t.x + 0.1, 0.84, t.z + 0.2], [t.x, t.y, t.z], 40); },
    anchors: (W, c) => ({ holes: c.sh.userData.top() }),
  },
  // 04 "So you slap its ass." the shaker upside down, the other hand comes down: SLAP!
  4: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) {
      sit(c); const ts = 0.37, hit = lt > ts && lt < ts + 0.12;
      face(c.you, lt > ts ? 'squint' : 'open', 'angry', lt > ts ? 'yell' : 'tight', { headPitch: -0.1 });
      const s = c.sh; s.position.set(PLATE[0] + 0.02, 1.08 - (hit ? 0.04 : 0), PLATE[2] + 0.04); s.rotation.set(Math.PI, 0, 0); c.you.p.gripR = s;
      const up = lt < ts ? lerp(1.2, 1.42, smooth(lt / 0.22)) - Math.max(0, (lt - 0.25) / 0.12) * 0.26 : 1.17 + Math.min(0.15, (lt - ts) * 0.5);
      c.you.p.handL = [PLATE[0] + 0.02, up, PLATE[2] + 0.04]; c.you.p.handPoseL = 'flat';
    },
    cam: (W, c, lt) => camAt([-0.42, 1.28, 0.72], [0.02, 1.12, -0.12], 46),
    anchors: () => ({ slap: [PLATE[0] + 0.02, 1.18, PLATE[2] + 0.04] }),
  },
  // 05 "Nothing." the fries: not one grain of salt
  5: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) { sit(c); face(c.you, 'open', 'sad', 'frown'); shakerOver(c, lt, 0.15, 3, 1.1); },
    cam: (W, c, lt) => camAt([0.02, 1.02, 0.36 - lt * 0.05], [0, 0.8, -0.08], 40),
    anchors: () => ({ fries: [PLATE[0], PLATE[1] + 0.06, PLATE[2]] }),
  },
  // 06 "Then all of it" one more shake: the lid pops off and falls
  6: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); return c; },
    update(W, c, lt) { sit(c); frus(c.you, lt); shakerOver(c, Math.min(lt, 0.6), lt < 0.6 ? 1 : 0, 6, 1.1); },
    after(W, c, lt) { const L = c.sh.userData.lid, k = clamp((lt - 0.62) / 0.35); L.position.y = 0.085 + easeIn(k) * 0.13; L.rotation.set(k * 3.2, 0, k * 1.6); },
    cam: (W, c, lt) => camAt([0.46, 1.06, 0.42], [0.03, 0.96, -0.08], 42),
    anchors: (W, c) => ({ shaker: c.sh.userData.top() }),
  },
  // 07 "at once." a mountain of salt dumps onto the fries
  7: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); c.sh.userData.lid.visible = false; return c; },
    update(W, c, lt) { sit(c); face(c.you, 'wide', 'raised', 'o', { headPitch: -0.3 }); shakerOver(c, 0, 0, 1, 1.1); },
    after(W, c, lt) { c.K.plate.userData.mount.scale.setScalar(Math.max(0.001, easeOut(clamp((lt - 0.05) / 0.3)))); },
    cam: (W, c, lt) => camAt([0.05, 1.28, 1.15 - lt * 0.15], [0, 0.88, -0.12], 46),
    anchors: (W, c) => ({ mouth: c.sh.userData.top(), mount: [PLATE[0], PLATE[1] + 0.12, PLATE[2]] }),
  },
  // 08 "Fuck." YOU's angry face
  8: {
    build(W) { const c = seated(W, kitchen(W, { mount: 1 })); c.sh = KT.saltShaker(W.scene); c.sh.userData.lid.visible = false; return c; },
    update(W, c, lt) { sit(c); face(c.you, 'squint', 'angry', lt > 0.12 && lt < 0.75 ? 'yell' : 'grimace', { headPitch: 0.05 }); shakerOver(c, 0, 0, 1, 1.1); },
    cam: (W, c, lt) => headCam(c.you, 0.62 - lt * 0.12, -0.02, 0, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.you), forehead2: forehead(c.you, -1) }),
  },
  // 09 "So next time, you poke" he pokes the holes with a needle (label HOLES)
  9: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); c.nd = KT.needle(W.scene); return c; },
    update(W, c, lt) {
      sit(c); face(c.you, 'squint', 'neutral', 'tight', { headPitch: -0.2, lookAt: P3(c.sh.userData.top()) });
      c.sh.position.set(-0.03, K.top, -0.18); c.sh.rotation.set(0, 0, 0); c.you.p.handL = [-0.115, K.top + 0.07, -0.18]; c.you.p.handPoseL = 'flat'; c.you.p.gripR = c.nd;
      const t = c.sh.userData.top(), poke = Math.max(0, Math.sin(lt * 4 * Math.PI * 2)), hole = Math.floor(lt * 4) % 5;
      const off = [[0, 0], [-0.012, -0.012], [0.012, -0.012], [-0.012, 0.012], [0.012, 0.012]][hole];
      c.nd.scale.setScalar(1.6); c.nd.position.set(t.x + off[0] + 0.004, t.y + 0.122 + poke * 0.05, t.z + off[1]); c.nd.rotation.set(0, 0, 0.1);
    },
    cam: (W, c, lt) => camAt([0.3, 1.25, 0.6], [-0.02, 0.98, -0.22], 44),
    anchors: (W, c) => ({ holes: c.sh.userData.top(), forehead: forehead(c.you) }),
  },
  // 10 "every hole with a needle." close: the needle goes into one hole, then the next
  10: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); c.nd = KT.needle(W.scene); return c; },
    update(W, c, lt) {
      sit(c); face(c.you, 'squint', 'neutral', 'tight', { headPitch: -0.2 });
      c.sh.position.set(-0.03, K.top, -0.18); c.sh.rotation.set(0, 0, 0); c.you.p.handL = [-0.115, K.top + 0.07, -0.18]; c.you.p.handPoseL = 'flat'; c.you.p.gripR = c.nd;
      const t = c.sh.userData.top(), poke = Math.max(0, Math.sin(lt * 2.2 * Math.PI * 2)), hole = Math.floor(lt * 2.2) % 5;
      const off = [[0, 0], [-0.012, -0.012], [0.012, -0.012], [-0.012, 0.012], [0.012, 0.012]][hole];
      c.nd.scale.setScalar(1.6); c.nd.position.set(t.x + off[0] + 0.002, t.y + 0.122 + poke * 0.04, t.z + off[1]); c.nd.rotation.set(0, 0, 0.08);
    },
    cam: (W, c, lt) => { const t = c.sh.userData.top(); return camAt([t.x + 0.07, t.y + 0.06, t.z + 0.2], [t.x, t.y + 0.04, t.z], 40); },
    anchors: (W, c) => ({ holes: c.sh.userData.top() }),
  },
  // 11 "One hole at a time." super slow ECU: the needle creeps into one hole
  11: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); c.nd = KT.needle(W.scene); return c; },
    update(W, c, lt) {
      sit(c); face(c.you, 'squint', 'raised', 'tight', { headPitch: -0.25 });
      c.sh.position.set(-0.03, K.top, -0.18); c.sh.rotation.set(0, 0, 0); c.you.p.handL = [-0.115, K.top + 0.07, -0.18]; c.you.p.handPoseL = 'flat'; c.you.p.gripR = c.nd;
      const t = c.sh.userData.top(); c.nd.scale.setScalar(1.6); c.nd.position.set(t.x + 0.002, t.y + 0.122 + (1 - smooth(lt / 1.86)) * 0.03, t.z); c.nd.rotation.set(0, 0, 0.06);
    },
    cam: (W, c, lt) => { const t = c.sh.userData.top(); return camAt([t.x + 0.045, t.y + 0.03, t.z + 0.11 - lt * 0.015], [t.x, t.y + 0.008, t.z], 36); },
    anchors: (W, c) => ({ holes: c.sh.userData.top() }),
  },
  // 12 "Forty minutes." the wall clock spins (label 40 MIN)
  12: {
    build(W) { const c = kitchen(W); return c; },
    update() {},
    after(W, c, lt) { c.K.clock.userData.min.rotation.z = -lt * 26; c.K.clock.userData.hour.rotation.z = -(7.5 / 12) * Math.PI * 2 - lt * 2.2; c.K.clock.userData.sec.rotation.z = -lt * 60; },
    cam: (W, c, lt) => camAt([K.clock[0] + 0.15, K.clock[1] - 0.12, K.clock[2] + 1.2 - lt * 0.25], [...K.clock], 40),
    anchors: () => ({ clock: [K.clock[0], K.clock[1], K.clock[2] + 0.05] }),
  },
  // 13 "Your fries are" the fries: cold (a little ice cube)
  13: {
    build(W) { const c = seated(W, kitchen(W)); c.sh = KT.saltShaker(W.scene); c.K.plate.userData.fries.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#ece8c8'); } }); return c; },
    update(W, c, lt) { sit(c); face(c.you, 'open', 'sad', 'frown'); c.sh.position.set(0.3, K.top, 0.1); c.sh.rotation.set(0, 0, 0); },
    cam: (W, c, lt) => camAt([0.03, 1.0, 0.34 - lt * 0.06], [0, 0.8, -0.08], 40),
    anchors: () => ({ fries: [PLATE[0] + 0.02, PLATE[1] + 0.07, PLATE[2]] }),
  },
  // 14 "fucking cold!" YOU holds up a cold fry, shivering
  14: {
    build(W) { const c = seated(W, kitchen(W)); c.fry = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.09), new THREE.MeshStandardMaterial({ color: '#ece8c8', flatShading: true })); W.scene.add(c.fry); c.fry.userData.grip = { pos: [0, 0, -0.03], axis: [0, 0, 1], up: [0, 1, 0] }; return c; },
    update(W, c, lt) {
      sit(c); face(c.you, 'squint', 'sad', Math.sin(lt * 30) > 0 ? 'grimace' : 'tight', { headRoll: Math.sin(lt * 40) * 0.03 });
      const h = c.you.headPos(); c.fry.position.set(h.x + 0.1 + Math.sin(lt * 40) * 0.004, h.y - 0.12, h.z + 0.28); c.fry.rotation.set(-0.9, 0.3, 0); c.you.p.gripR = c.fry;
    },
    cam: (W, c, lt) => headCam(c.you, 0.85, -0.12, -0.06, -0.06, 42),
    anchors: (W, c) => ({ fry: c.fry.position.clone().add(V(0, 0.06, 0)), forehead: forehead(c.you) }),
  },
  // 15 "So you hook the shaker up" at the counter: he tapes the shaker to the leaf blower
  15: {
    build(W) { const c = kitchen(W, { blower: true }); c.you = person(W, 'you'); c.tp = KT.tapeRoll(W.scene); c.sh = KT.saltShaker(W.scene, 1.6); return c; },
    update(W, c, lt) {
      const n = c.bl.localToWorld(c.bl.userData.nozzle.clone());
      standAt(c.you, n.x - 0.15, n.z + 0.55, Math.PI + 0.25); face(c.you, 'squint', 'raised', 'grin', { lookAt: P3(n), lean: 0.12 });
      const a = lt * 9; c.tp.position.set(n.x + Math.cos(a) * 0.1, n.y + Math.sin(a) * 0.1, n.z + 0.02); c.you.p.gripR = c.tp;
      c.you.p.handL = [n.x - 0.06, n.y + 0.07, n.z + 0.06]; c.you.p.handPoseL = 'grip';
    },
    after(W, c) { tapedShaker(c); },
    cam: (W, c, lt) => { const n = c.bl.localToWorld(c.bl.userData.nozzle.clone()); return camAt([n.x + 0.75, n.y + 0.35, n.z + 0.85], [n.x - 0.05, n.y + 0.05, n.z], 44); },
    anchors: (W, c) => ({ nozzle: c.bl.localToWorld(c.bl.userData.nozzle.clone()) }),
  },
  // 16 "to a leaf blower." wide: the big leaf blower with the shaker taped on, YOU proud, the cat worried
  16: {
    build(W) { const c = kitchen(W, { blower: true }); c.you = person(W, 'you'); c.sh = KT.saltShaker(W.scene, 1.6); return c; },
    update(W, c, lt) {
      standAt(c.you, 0.15, -1.35, 0.35); face(c.you, 'happy', 'raised', 'grin');
      c.you.p.handL = rel(c.you, 0.05, 0.22, 0.98); c.you.p.handR = rel(c.you, 0.05, -0.22, 0.98); c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
    },
    after(W, c) { tapedShaker(c); c.K.cat.userData.head.rotation.y = 0.6; },
    cam: (W, c, lt) => camAt([0.65, 1.45, 1.6 - lt * 0.15], [0.75, 1.1, -1.6], 52),
    anchors: (W, c) => ({ blower: c.bl.localToWorld(V(0, 0.4, 0)) }),
  },
  // 17 "You turn it all the way up." ECU: the dial goes to MAX
  17: {
    build(W) { const c = kitchen(W, { blower: true }); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      const d = c.bl.userData.face.getWorldPosition(V());
      standAt(c.you, d.x - 0.05, d.z + 0.55, Math.PI + 0.35); face(c.you, 'squint', 'raised', 'grin');
      c.you.p.handR = [d.x + 0.02, d.y + 0.01, d.z + 0.05]; c.you.p.handPoseR = 'pinky';
    },
    after(W, c, lt) { const k = clamp((lt - 0.3) / 1.1); c.bl.userData.dial.rotation.z = Math.PI * 0.75 - Math.PI * 1.5 * (Math.floor(k * 10) / 10); },
    cam: (W, c, lt) => { const f = c.bl.userData.face, d = f.getWorldPosition(V()), nrm = V(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion())); return camAt(P3(d.clone().addScaledVector(nrm, 0.3 - lt * 0.04).add(V(0, 0.03, 0))), P3(d), 40); },
    anchors: (W, c) => ({ dial: c.bl.userData.face.getWorldPosition(V()) }),
  },
  // 18 "VRRRRR!" the leaf blower shakes violently; YOU at the table looks back, worried
  18: {
    build(W) { const c = seated(W, kitchen(W, { blower: true })); c.sh = KT.saltShaker(W.scene, 1.6); return c; },
    update(W, c, lt) { sit(c); face(c.you, 'wide', 'worried', 'o', { headYaw: -0.9, headPitch: 0.05 }); c.you.p.handR = rel(c.you, 0.42, -0.2, K.top + 0.02); c.you.p.handPoseR = 'flat'; },
    after(W, c, lt) {
      const j = (a) => Math.sin(lt * a) * 0.02 * (0.5 + lt);
      c.bl.position.set(K.blower[0] + j(97), K.blower[1] + Math.abs(j(83)), K.blower[2] + j(71)); c.bl.rotation.set(j(61) * 2, BLOWER_YAW + j(53) * 3, j(89) * 2);
      tapedShaker(c);
    },
    cam: (W, c, lt) => camAt([-0.55, 1.4, 1.25], [0.5, 1.1, -1.4], 50),
    anchors: (W, c) => ({ blower: c.bl.localToWorld(V(0, 0.25, 0)), shaker: c.sh.position.clone() }),
  },
  // 19 "BOOM!" salt explodes everywhere: the whole kitchen turns white
  19: {
    build(W) { const c = seated(W, kitchen(W, { blower: true })); c.white = person(W, 'youSalt'); c.sh = KT.saltShaker(W.scene, 1.6); return c; },
    update(W, c, lt) {
      const b = lt >= 0.15;
      for (const ch of [c.you, c.white]) { sitAt(ch, ...SEAT, 0); ch.p.handL = rel(ch, 0.42, 0.2, K.top + 0.02); ch.p.handR = rel(ch, 0.42, -0.2, K.top + 0.02); ch.p.handPoseL = ch.p.handPoseR = 'flat'; }
      face(c.you, 'wide', 'worried', 'o', { headYaw: -0.9 }); face(c.white, 'wide', 'raised', 'o', { lean: -0.15 });
      c.you.p.visible = !b; c.white.p.visible = b;
      if (b && !c.done) { KT.whiten(W.scene, { skip: ['youSalt'] }); saltCat(c); c.done = true; }
    },
    after(W, c, lt) { tapedShaker(c); c.sh.visible = lt < 0.15; },
    cam: (W, c, lt) => camAt([0.4, 1.6, 2.8], [0.45, 1.0, -0.9], 52),
    anchors: (W, c) => ({ blast: c.bl.localToWorld(c.bl.userData.nozzle.clone().add(V(0.12, 0, 0))), you: c.white.chestPos() }),
  },
  // 20 "All over you." YOU completely white like a snowman; the cat white too
  20: {
    build(W) { const c = kitchen(W, { blower: true }); c.you = person(W, 'youSalt'); KT.whiten(W.scene, { skip: ['youSalt'] }); saltCat(c); return c; },
    update(W, c, lt) { sit(c); face(c.you, lt > 0.6 && lt < 0.72 ? 'closed' : 'wide', 'raised', 'o', { lean: -0.1 }); },
    after(W, c, lt) { c.K.cat.userData.head.rotation.y = 0.5; },
    cam: (W, c, lt) => camAt([1.35, 1.45, 1.55 - lt * 0.1], [0.85, 1.0, -1.25], 50),
    anchors: (W, c) => ({ you: c.you.headPos(), cat: [K.cat[0], K.cat[1] + 0.45, K.cat[2]] }),
  },
  // 21 "You're a fucking genius!" close: the white face blinking; a single fry falls. Fade out.
  21: {
    build(W) { const c = kitchen(W, { blower: true }); c.you = person(W, 'youSalt'); KT.whiten(W.scene, { skip: ['youSalt'] }); c.fry = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.08), new THREE.MeshStandardMaterial({ color: '#f6c650', flatShading: true })); W.scene.add(c.fry); return c; },
    update(W, c, lt) { sit(c); const bl = (lt > 0.55 && lt < 0.68) || (lt > 1.35 && lt < 1.48); face(c.you, bl ? 'closed' : 'open', 'neutral', 'neutral'); },
    after(W, c, lt) { const h = c.you.headPos(), k = clamp((lt - 0.8) / 0.7); c.fry.position.set(h.x + 0.07, h.y + 0.25 - easeIn(k) * 0.6, h.z + 0.09); c.fry.rotation.set(lt * 3, 0.4, lt * 5); c.fry.visible = lt > 0.75 && k < 1; },
    cam: (W, c, lt) => headCam(c.you, 0.62 - lt * 0.1, -0.01, 0, -0.01, 40),
    anchors: (W, c) => ({ head: c.you.headPos().add(V(0, 0.15, 0)) }),
  },
};
