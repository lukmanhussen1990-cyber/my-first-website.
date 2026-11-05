// The 20 shots of the balloon (semi genius) reel, SEMIGENIUS style: a clean beige room, plain low-poly people.
// The opening is framed from behind (a misdirect) until "soft"; then it is clearly just a pink balloon.
// lt = seconds since the shot's start, W.dur = its length (the user's voice), W.cut = a camera cut on a word.
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as RM from './room.js';
import * as GW from './ghostworld.js';
import { building as cityBlock } from './storm.js';
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
const cutK = (W, lt) => clamp((lt - W.cut) / Math.max(0.3, W.dur - W.cut));

// the set-up: the cowboy stands (legs wide) at z = -0.62 facing +z; the kid kneels in front of him facing -z; the
// balloon's knot sits at the kid's mouth and the balloon points at the cowboy's belly
const CB = [0, -0.62], KD = [0, 0.04];
const B0 = V(0, 1.05, -0.24), BDIR = V(0, 0.32, -1).normalize();
function room(W, o = {}) { RM.roomLights(W, { at: o.at ?? [0, 1, -0.3], size: o.size ?? 4 }); return RM.buildRoom(W); }
function duo(W, c, o = {}) { c.cb = person(W, 'cowboy'); c.kid = person(W, 'kid'); c.bl = RM.balloon(W.scene); return c; }
function balloonAt(c, st, lt) {
  c.bl.position.copy(B0); c.bl.quaternion.setFromUnitVectors(V(0, 1, 0), BDIR); c.bl.userData.set(st, lt);
  return B0.clone().addScaledVector(BDIR, (st.r ?? 0.3) * 1.1);                                    // the balloon's centre
}
function cowboy(c, lt, { hold = null, mood = 'bored', hips = false } = {}) {
  standAt(c.cb, CB[0], CB[1], 0); c.cb.p.straddle = 0.95;
  if (mood === 'bored') face(c.cb, 'squint', 'skeptic', 'tight', { lookAt: [0, 1.1, 0.0] });
  else if (mood === 'shock') face(c.cb, 'wide', 'raised', 'o');
  else if (mood === 'proud') face(c.cb, 'happy', 'raised', 'grin');
  if (hold) { const [ctr, r] = hold; c.cb.p.handL = [ctr.x + r + 0.04, ctr.y, ctr.z]; c.cb.p.handR = [ctr.x - r - 0.04, ctr.y, ctr.z]; c.cb.p.handPoseL = c.cb.p.handPoseR = 'flat'; }
  else if (hips) { c.cb.p.handL = rel(c.cb, 0.02, 0.24, 1.0); c.cb.p.handR = rel(c.cb, 0.02, -0.24, 1.0); c.cb.p.handPoseL = c.cb.p.handPoseR = 'fist'; }
}
function kidBlow(c, lt, { tired = 1, blow = true } = {}) {
  standAt(c.kid, KD[0], KD[1], Math.PI); c.kid.p.kneel = 1;
  const puff = blow ? Math.max(0, Math.sin(lt * 7)) : 0;
  Object.assign(c.kid.p, { lean: 0.42 + 0.05 * puff, headPitch: -0.12 });
  face(c.kid, tired > 0.5 ? 'squint' : 'open', 'worried', puff > 0.3 ? 'o' : 'tight', { lookAt: null });
  c.kid.p.handR = P3(B0.clone().addScaledVector(BDIR, 0.03).add(V(-0.05, -0.03, 0))); c.kid.p.handPoseR = 'grip';
  c.kid.p.handL = rel(c.kid, 0.25, 0.18, 0.62); c.kid.p.handPoseL = 'flat';
}
function bigArm(ch, k = 1) { const a = ch.arms.R; for (const m of [a.up, a.lo]) { m.scale.x *= 1 + 1.7 * k; m.scale.z *= 1 + 1.7 * k; } a.H.grp.scale.setScalar(1 + 0.9 * k); }
function puffs(W, n = 8, color = 'rgba(235,235,235,1)', op = 0.7) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/,1\)$/, ',0)')); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: op, depthWrite: false });
  const g = new THREE.Group(); W.scene.add(g); for (let i = 0; i < n; i++) g.add(new THREE.Sprite(m)); g.userData.mat = m; return g;
}
function rise(g, at, t, { spread = 0.12, h = 0.5, s0 = 0.06, s1 = 0.22 } = {}) { g.children.forEach((s, i) => { const k = (t * 1.2 + i / g.children.length) % 1; s.position.set(at.x + (hash1(i * 3.3) - 0.5) * spread, at.y + k * h, at.z + (hash1(i * 5.1) - 0.5) * spread); s.scale.setScalar(lerp(s0, s1, k)); }); }

// balloon states through the story
const SOFT = { r: 0.12, soft: 1 }, DRY = (k) => ({ r: lerp(0.12, 0.2, k), soft: lerp(1, 0.4, k) });

export const SHOTS = {
  // ================================================================ 1 "You've been blowing" from behind him (a misdirect)
  1: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) { const ctr = balloonAt(c, SOFT, lt); c.bl.visible = false; cowboy(c, lt, { hold: [ctr, 0.12] }); kidBlow(c, lt); },
    cam: (W, c, lt) => {
      if (lt < W.cut) { const q = clamp(lt / Math.max(0.5, W.cut)); return camAt([0.12, 1.3, 2.6 - 0.7 * q], [0, 1.25, -0.6], 46); }
      const k = cutK(W, lt); return camAt([0.18, 1.18, 1.55 - 0.1 * k], [0, 1.25, -0.6], 46);
    },
    anchors: (W, c) => ({ kid: c.kid.headPos() }),
  },
  // ================================================================ 2 "it for ten minutes" the cowboy's bored face from below (10:00)
  2: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) { const ctr = balloonAt(c, SOFT, lt + 4.3); c.bl.visible = false; cowboy(c, lt, { hold: [ctr, 0.12] }); kidBlow(c, lt + 0.7); face(c.cb, 'squint', 'skeptic', 'frown', { lookAt: [0, 1.0, 0.0] }); },
    cam: (W, c, lt) => { const h = c.cb.headPos(), k = K(W, lt); return camAt([0.35, 1.32, 0.45 - 0.05 * k], [h.x, h.y - 0.05, h.z], 44); },
  },
  // ================================================================ 3 "and it's still soft." behind him; cut on "soft": the side view: a pink balloon
  3: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) { const ctr = balloonAt(c, SOFT, lt + 1.9); c.bl.visible = lt >= W.cut; cowboy(c, lt, { hold: [ctr, 0.12] }); kidBlow(c, lt + 1.9); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = cutK(W, lt); return camAt([1.85 - 0.15 * q, 1.12, -0.12], [0, 1.02, -0.3], 44); }
      return camAt([-0.15, 1.05, 1.3], [0, 1.2, -0.6], 46);
    },
    anchors: (W, c) => ({ balloon: c.bl.localToWorld(V(0, 0.15, 0)) }),
  },
  // ================================================================ 4 "So, you being a semi genius," the cowboy hands him a pink hairdryer; cut: the kid takes it
  4: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.hd = RM.hairdryer(W.scene); return c; },
    update(W, c, lt) {
      const ctr = balloonAt(c, SOFT, lt); kidBlow(c, lt, { blow: false }); face(c.kid, lt >= W.cut ? 'wide' : 'squint', 'raised', lt >= W.cut ? 'smileOpen' : 'tight', { lookAt: P3(c.hd.position) });
      cowboy(c, lt, { mood: 'bored' }); c.cb.p.handL = [ctr.x + 0.16, ctr.y, ctr.z]; c.cb.p.handPoseL = 'flat';
      const k = easeOut(clamp(lt / 0.8)); c.hd.position.set(...rel(c.cb, lerp(0.15, 0.45, k), -0.28, lerp(1.0, 1.25, k))); c.hd.rotation.set(0, Math.PI / 2, 0); c.cb.p.gripR = c.hd;
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const h = c.kid.headPos(), q = cutK(W, lt); return camAt([h.x + 0.55, h.y + 0.08, h.z - 0.55 + 0.05 * q], [h.x, h.y, h.z - 0.15], 42); }
      return camAt([1.6, 1.4, 1.1], [0, 1.15, -0.35], 44);
    },
  },
  // ================================================================ 5 "give it a blow dry." VRRRR
  5: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.hd = RM.hairdryer(W.scene); c.air = RM.airStreaks(W.scene, 10, '#fff4d8', 0.45); return c; },
    update(W, c, lt) {
      const k = clamp(lt / W.dur), st = DRY(k * 0.4), ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] });
      standAt(c.kid, KD[0] + 0.1, KD[1] + 0.05, Math.PI - 0.2); c.kid.p.kneel = 1; c.kid.p.lean = 0.25; face(c.kid, 'happy', 'raised', 'grin', { lookAt: P3(ctr) });
      c.hd.position.set(ctr.x + 0.32, ctr.y - 0.18, ctr.z + 0.26); c.hd.rotation.set(0, Math.PI * 0.75, 0.25); c.kid.p.gripR = c.hd;
    },
    after(W, c, lt) { const n = c.hd.localToWorld(c.hd.userData.nozzle.clone()), d = c.bl.localToWorld(V(0, 0.15, 0)).sub(n); c.air.userData.blow(n, d, lt, d.length(), 0.08); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([1.5, 1.35, 0.95 - 0.1 * k], [0.05, 1.1, -0.35], 44); },
    anchors: (W, c) => ({ dryer: c.hd.position.clone() }),
  },
  // ================================================================ 6 "It gets hot." glowing red, steam
  6: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.hd = RM.hairdryer(W.scene); c.st = puffs(W, 10); return c; },
    update(W, c, lt) {
      const st = { ...DRY(0.6), hot: smooth(lt / 0.5) }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r], mood: 'shock' });
      standAt(c.kid, KD[0] + 0.1, KD[1] + 0.05, Math.PI - 0.2); c.kid.p.kneel = 1; c.kid.p.lean = 0.25; face(c.kid, 'wide', 'raised', 'o', { lookAt: P3(ctr) });
      c.hd.position.set(ctr.x + 0.32, ctr.y - 0.18, ctr.z + 0.26); c.hd.rotation.set(0, Math.PI * 0.75, 0.25); c.kid.p.gripR = c.hd;
    },
    after(W, c, lt) { rise(c.st, c.bl.localToWorld(V(0, 0.3, 0)), lt, { spread: 0.2, h: 0.5 }); },
    cam: (W, c, lt) => { const k = K(W, lt), b = c.bl.localToWorld(V(0, 0.18, 0)); return camAt([b.x + 0.55, b.y + 0.08, b.z + 0.62 - 0.06 * k], [b.x, b.y, b.z], 40); },
    anchors: (W, c) => ({ balloon: c.bl.localToWorld(V(0, 0.2, 0)) }),
  },
  // ================================================================ 7 "It gets hard as fuck," it swells big and tight; cut: closer (BOING!)
  7: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.hd = RM.hairdryer(W.scene); return c; },
    update(W, c, lt) {
      const k = easeOutBack(clamp(lt / 0.5), 2.2), st = { r: lerp(0.2, 0.42, k), soft: 0, hot: 0.6 }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r], mood: 'shock' });
      standAt(c.kid, KD[0] + 0.1, KD[1] + 0.12, Math.PI - 0.2); c.kid.p.kneel = 1; c.kid.p.lean = 0.1; face(c.kid, 'wide', 'raised', 'o', { lookAt: P3(ctr) });
      c.hd.position.set(...rel(c.kid, 0.25, -0.3, 0.9)); c.hd.rotation.set(0, 0, 0.3); c.kid.p.gripR = c.hd;
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = cutK(W, lt); return camAt([0.95, 1.25, 0.55 - 0.08 * q], [0, 1.15, -0.45], 42); }
      return camAt([1.9, 1.45, 1.7], [0, 1.1, -0.4], 44);
    },
  },
  // ================================================================ 8 "then it melts a hole" smoke
  8: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.sm = puffs(W, 10, 'rgba(90,90,96,1)', 0.6); return c; },
    update(W, c, lt) { const st = { r: 0.42, soft: 0, hot: 1, hole: smooth(lt / 0.7) }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r], mood: 'shock' }); standAt(c.kid, KD[0] + 0.1, KD[1] + 0.12, Math.PI - 0.2); c.kid.p.kneel = 1; face(c.kid, 'wide', 'raised', 'o'); },
    after(W, c, lt) { rise(c.sm, c.bl.userData.hole.getWorldPosition(V()), lt, { spread: 0.08, h: 0.45, s0: 0.05, s1: 0.2 }); },
    cam: (W, c, lt) => { const h = c.bl.userData.hole.getWorldPosition(V()), k = K(W, lt); return camAt([h.x + 0.3, h.y + 0.1, h.z + 0.62 - 0.06 * k], [h.x, h.y, h.z], 40); },
    anchors: (W, c) => ({ hole: c.bl.userData.hole.getWorldPosition(V()) }),
  },
  // ================================================================ 9 "and farts in your fucking face." PFFFFFT; cut: his blasted face
  9: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.air = RM.airStreaks(W.scene, 14, '#ffffff', 0.55); c.beanie = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a5ad8', flatShading: true })); W.scene.add(c.beanie); return c; },
    update(W, c, lt) {
      const st = { r: lerp(0.42, 0.3, clamp(lt / 1.5)), soft: 0.2, hole: 1 }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r], mood: 'shock' });
      standAt(c.kid, KD[0], KD[1] + 0.08, Math.PI); c.kid.p.kneel = 1; c.kid.p.lean = -0.15; face(c.kid, 'squint', 'raised', 'yell', { bounce: 1, headPitch: 0.2 });
    },
    after(W, c, lt) {
      const h = c.bl.userData.hole.getWorldPosition(V()), f = c.kid.headPos(); c.air.userData.blow(h, f.clone().sub(h), lt * 1.6, h.distanceTo(f) + 0.15, 0.14);
      if (c.kid.hat) c.kid.hat.visible = false; const k = clamp(lt / 0.8); c.beanie.position.set(f.x + 0.1 * k, f.y + 0.12 + k * 0.6 - k * k * 0.3, f.z + 0.5 * k); c.beanie.rotation.set(k * 6, k * 3, 0);
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const f = c.kid.headPos(), q = cutK(W, lt); return camAt([f.x + 0.55, f.y + 0.06, f.z - 0.2 - 0.03 * q], [f.x, f.y, f.z], 40); }
      return camAt([1.55, 1.25, 0.85], [0, 1.1, -0.3], 44);
    },
    anchors: (W, c) => ({ face: c.kid.headPos() }),
  },
  // ================================================================ 10 "So, you tape it up" RIIIP
  10: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) {
      const tp = lt > 0.45, st = { r: 0.3, soft: 0.3, hole: 1, tape: tp }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] });
      standAt(c.kid, KD[0], KD[1] + 0.05, Math.PI); c.kid.p.kneel = 1; c.kid.p.lean = 0.2; face(c.kid, 'squint', 'angry', 'tight', { lookAt: P3(c.bl.userData.hole.getWorldPosition(V())) });
      const hp = c.bl.userData.hole.getWorldPosition(V()); c.kid.p.handR = [hp.x - 0.05, hp.y, hp.z + 0.06]; c.kid.p.handL = [hp.x + 0.05, hp.y + 0.02, hp.z + 0.06]; c.kid.p.handPoseL = c.kid.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => { const h = c.bl.userData.hole.getWorldPosition(V()), k = K(W, lt); return camAt([h.x + 0.35, h.y + 0.18, h.z + 0.7 - 0.06 * k], [h.x, h.y - 0.02, h.z], 40); },
    anchors: (W, c) => ({ hole: c.bl.userData.hole.getWorldPosition(V()) }),
  },
  // ================================================================ 11 "and keep going." blowing again, exhausted (3:47:00)
  11: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) { const st = { r: 0.16, soft: 0.9, tape: true }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] }); face(c.cb, 'closed', 'neutral', 'tight', { headPitch: -0.2 }); kidBlow(c, lt, { tired: 1 }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([1.5, 1.2, 0.85 - 0.08 * k], [0, 1.1, -0.35], 44); },
  },
  // ================================================================ 12 "By the end," pumping with one arm, fast
  12: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.pump = RM.handPump(W.scene); c.pump.position.set(0.12, 0, 0.62); return c; },
    update(W, c, lt) {
      const st = { r: 0.16, soft: 0.9, tape: true }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] }); face(c.cb, 'squint', 'skeptic', 'tight');
      standAt(c.kid, 0.42, 0.55, 0.45); c.kid.p.kneel = 1; c.kid.p.lean = 0.2; face(c.kid, 'squint', 'angry', 'grimace', { bounce: 0.4 });
      const k = 0.5 + 0.5 * Math.sin(lt * 18); c.pump.userData.handle(k); c.kid.p.handR = [0.12, 0.55 + 0.3 * (1 - k) * 0.85 + 0.05, 0.62]; c.kid.p.handPoseR = 'fist';
    },
    after(W, c, lt) { bigArm(c.kid, clamp(lt / W.dur) * 0.4); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.55, 1.15, 2.6 - 0.15 * k], [0.3, 0.8, 0.45], 44); },
  },
  // ================================================================ 13 "your arm is bigger than your fucking leg," ARM vs LEG; cut: closer
  13: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.pump = RM.handPump(W.scene); c.pump.position.set(0.12, 0, 0.62); return c; },
    update(W, c, lt) {
      const st = { r: 0.16, soft: 0.9, tape: true }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] }); face(c.cb, 'wide', 'raised', 'o', { lookAt: P3(c.kid.chestPos()) });
      standAt(c.kid, 0.42, 0.55, 0.45); c.kid.p.kneel = 1; c.kid.p.lean = 0.1; face(c.kid, 'happy', 'raised', 'grin');
      const k = 0.5 + 0.5 * Math.sin(lt * 6); c.pump.userData.handle(k); c.kid.p.handR = [0.12, 0.55 + 0.3 * (1 - k) * 0.85 + 0.05, 0.62]; c.kid.p.handPoseR = 'fist';
    },
    after(W, c, lt) { bigArm(c.kid, 1); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = cutK(W, lt); return camAt([0.45, 0.85, 1.75 - 0.05 * q], [0.3, 0.68, 0.5], 42); }
      return camAt([0.6, 1.2, 2.7], [0.25, 0.85, 0.3], 44);
    },
    anchors: (W, c) => ({ arm: c.kid.arms.R.lo.getWorldPosition(V()).lerp(c.kid.handPos('R'), 0.3), leg: c.kid.legs.L.th.getWorldPosition(V()).add(V(0, 0, 0.12)) }),
  },
  // ================================================================ 14 "and it's still soft as baby shit." the balloon hangs limp; cut: close (SQUISH)
  14: {
    build(W) { const c = { R: room(W) }; duo(W, c); return c; },
    update(W, c, lt) {
      standAt(c.cb, CB[0], CB[1], 0); c.cb.p.straddle = 0.95; face(c.cb, 'squint', 'neutral', 'frown', { lookAt: [-0.32, 0.95, -0.25] });
      c.cb.p.handR = [-0.32, 1.14, -0.3]; c.cb.p.handPoseR = 'grip'; c.cb.p.handL = rel(c.cb, 0.02, 0.24, 1.0); c.cb.p.handPoseL = 'fist';
      standAt(c.kid, KD[0], KD[1] + 0.05, Math.PI); c.kid.p.kneel = 1; c.kid.p.lean = 0.15; face(c.kid, 'squint', 'sad', 'frown', { lookAt: [-0.32, 0.95, -0.25] });
    },
    after(W, c, lt) {
      bigArm(c.kid, 1);
      c.bl.position.set(-0.32, 1.1, -0.28); c.bl.quaternion.setFromUnitVectors(V(0, 1, 0), V(Math.sin(lt * 3) * 0.12, -1, 0.1).normalize());
      c.bl.userData.set({ r: 0.13, soft: 1, tape: true, holeDir: [0, 0.2, 1] }, lt * 1.6);
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const b = c.bl.localToWorld(V(0, 0.13, 0)), q = cutK(W, lt); return camAt([b.x - 0.38, b.y + 0.08, b.z + 0.45 - 0.05 * q], [b.x, b.y - 0.02, b.z], 42); }
      return camAt([-1.15, 1.2, 1.15], [-0.25, 0.95, -0.3], 44);
    },
    anchors: (W, c) => ({ balloon: c.bl.localToWorld(V(0, 0.12, 0)) }),
  },
  // ================================================================ 15 "So, you grab a leaf blower." VRRROOOM; cut: the nozzle at the balloon
  15: {
    build(W) { const c = { R: room(W) }; duo(W, c); c.lb = RM.leafBlower(W.scene); return c; },
    update(W, c, lt) {
      const st = { r: 0.17, soft: 1, tape: true }, ctr = balloonAt(c, st, lt); cowboy(c, lt, { hold: [ctr, st.r] }); face(c.cb, 'wide', 'raised', 'o', { lookAt: P3(c.lb.position) });
      standAt(c.kid, 0.75, 0.55, -Math.PI / 2 - 0.5); c.kid.p.straddle = 0.4; face(c.kid, 'happy', 'angry', 'grin', { lookAt: P3(ctr) });
      const k = easeOut(clamp(lt / 0.6)); c.lb.position.set(...rel(c.kid, 0.2, -0.22, lerp(0.6, 1.05, k))); c.lb.rotation.set(0, c.kid.p.rotY - Math.PI / 2, 0); c.kid.p.gripR = c.lb;
      c.kid.p.handL = P3(c.lb.localToWorld(V(0.45, -0.05, 0))); c.kid.p.handPoseL = 'grip';
    },
    after(W, c, lt) { bigArm(c.kid, 1); c.lb.position.y += Math.sin(lt * 60) * 0.004; },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const n = c.lb.localToWorld(V(1.0, 0, 0)), q = cutK(W, lt); return camAt([n.x + 0.3, n.y + 0.3, n.z + 0.9 - 0.1 * q], [n.x - 0.2, n.y + 0.05, n.z - 0.3], 44); }
      return camAt([1.0, 1.45, 2.4], [0.4, 1.15, 0.1], 44);
    },
    anchors: (W, c) => ({ blower: c.lb.position.clone() }),
  },
  // ================================================================ 16 "Rock hard in one second." the balloon fills the room; cut: 0:01, the cowboy blown back
  16: {
    build(W) { const c = { R: room(W, { size: 5 }) }; duo(W, c); c.lb = RM.leafBlower(W.scene); c.air = RM.airStreaks(W.scene, 14, '#ffffff', 0.5); return c; },
    update(W, c, lt) {
      const k = easeOutBack(clamp((lt - 0.15) / 0.4), 1.6), st = { r: lerp(0.17, 1.15, k), soft: 0, tape: true }, ctr = balloonAt(c, st, lt);
      standAt(c.cb, CB[0], CB[1] - 0.6 * k, 0); Object.assign(c.cb.p, { pitch: -0.5 * k }); face(c.cb, 'wide', 'raised', 'yell'); c.cb.p.handL = rel(c.cb, 0.3, 0.4, 1.9); c.cb.p.handR = rel(c.cb, 0.3, -0.4, 1.9); c.cb.p.handPoseL = c.cb.p.handPoseR = 'open';
      standAt(c.kid, 0.75, 0.55, -Math.PI / 2 - 0.5); c.kid.p.straddle = 0.4; face(c.kid, 'wide', 'raised', 'grin');
      c.lb.position.set(...rel(c.kid, 0.2, -0.22, 1.05)); c.lb.rotation.set(0, c.kid.p.rotY - Math.PI / 2, 0); c.kid.p.gripR = c.lb; c.kid.p.handL = P3(c.lb.localToWorld(V(0.45, -0.05, 0))); c.kid.p.handPoseL = 'grip';
    },
    after(W, c, lt) { bigArm(c.kid, 1); const n = c.lb.localToWorld(c.lb.userData.nozzle.clone()); c.air.userData.blow(n, B0.clone().sub(n), lt * 2, n.distanceTo(B0), 0.15); },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = cutK(W, lt); return camAt([2.4, 1.6, 3.0 + 0.3 * q], [0, 1.4, -0.8], 50); }
      return camAt([1.9, 1.5, 2.4], [0.1, 1.2, -0.3], 48);
    },
  },
  // ================================================================ 17 "Then the dumb cat jumps on and" the cat on the sofa; cut: it leaps on
  17: {
    build(W) { const c = { R: room(W, { size: 5 }) }; duo(W, c); c.cat = RM.cat(W.scene); return c; },
    update(W, c, lt) {
      const st = { r: 1.15, soft: 0, tape: true }; balloonAt(c, st, lt);
      standAt(c.cb, -0.9, 0.9, 0.6); c.cb.p.straddle = 0.6; face(c.cb, 'wide', 'raised', 'o', { lookAt: P3(c.cat.position) });
      standAt(c.kid, 0.95, 0.8, -0.6); face(c.kid, 'wide', 'raised', 'o', { lookAt: P3(c.cat.position) });
    },
    after(W, c, lt) {
      const top = c.bl.localToWorld(V(0, 1.15 * 2.05, 0));
      if (lt < W.cut) { c.cat.position.set(-2.2, 0.48, -2.3); c.cat.rotation.y = 0.5; c.cat.userData.head.rotation.y = Math.sin(lt * 2) * 0.3; }
      else { const q = clamp((lt - W.cut) / 0.55), a = V(-2.2, 0.48, -2.3), p = a.clone().lerp(top, q); p.y += Math.sin(q * Math.PI) * 0.9; c.cat.position.copy(p); c.cat.rotation.y = 0.8; c.cat.userData.walk(lt, 1.5); }
    },
    cam: (W, c, lt) => { if (lt < W.cut) return camAt([-1.6, 0.95, -1.3], [-2.15, 0.6, -2.3], 42); return camAt([1.9, 1.8, 3.1], [-0.6, 1.6, -1.1], 52); },
    anchors: (W, c) => ({ cat: c.cat.position.clone().add(V(0, 0.4, 0)) }),
  },
  // ================================================================ 18 "rides it around" the balloon flies around the room, the cat on top
  18: {
    build(W) { const c = { R: room(W, { size: 5 }) }; duo(W, c); c.cat = RM.cat(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.cb, -1.2, 1.4, 0.4); face(c.cb, 'wide', 'raised', 'o'); standAt(c.kid, 1.3, 1.3, -0.4); face(c.kid, 'wide', 'raised', 'laugh');
      c.cb.p.handL = rel(c.cb, 0.2, 0.3, 1.9); c.cb.p.handR = rel(c.cb, 0.2, -0.3, 1.9); c.cb.p.handPoseL = c.cb.p.handPoseR = 'open';
    },
    after(W, c, lt) {
      const a = lt * 3.2, p = V(Math.sin(a) * 1.4, 0.6 + Math.abs(Math.sin(a * 2)) * 0.4, -0.9 + Math.cos(a) * 0.6);
      c.bl.position.copy(p); c.bl.rotation.set(Math.sin(a) * 0.3, a, Math.cos(a) * 0.2); c.bl.userData.set({ r: 0.95, soft: 0, tape: true }, lt);
      const top = c.bl.localToWorld(V(0, 0.95 * 2.0, 0)); c.cat.position.copy(top); c.cat.rotation.set(0, -a + Math.PI / 2, 0); c.cat.userData.walk(lt, 0.3);
      if (c.R.vase) { c.R.vase.rotation.z = Math.min(1.6, lt * 3); c.R.vase.position.y = 0.5 - Math.min(0.5, lt * lt * 3); }
    },
    cam: (W, c, lt) => camAt([0.2, 1.8, 3.8], [0, 1.2, -0.9], 52),
    anchors: (W, c) => ({ cat: c.cat.position.clone() }),
  },
  // ================================================================ 19 "like he's Aladdin." over the night city on the balloon, sparkles
  19: {
    build(W) {
      GW.night(W, { at: [0, 30, -40], size: 30, moon: [-10, 18, -30], fog: [60, 260], far: 300 });
      const g = new THREE.Group(); W.scene.add(g);
      for (let i = 0; i < 40; i++) { const x = -70 + (i % 10) * 15 + (hash1(i) - 0.5) * 6, z = -30 - Math.floor(i / 10) * 18; cityBlock(g, x, z, 8, 10 + hash1(i * 3) * 30, 8, { color: '#1e2638', seed: 40 + i, lit: 0.5 }); }
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#141a28' })); g.add(gr);
      const c = { bl: RM.balloon(W.scene), cat: RM.cat(W.scene) }; c.bl.scale.setScalar(3); c.lamp = new THREE.PointLight(0xffe0f0, 30, 25, 1.4); W.scene.add(c.lamp); W.lights.hemi.intensity = 1.6; return c;
    },
    after(W, c, lt) {
      const p = V(-6 + lt * 5, 28 + Math.sin(lt * 2) * 0.8, -18); c.bl.position.copy(p); c.bl.rotation.set(0, 0, -0.15 + Math.sin(lt * 2) * 0.08); c.bl.userData.set({ r: 1.0, soft: 0, tape: true }, lt);
      const top = c.bl.localToWorld(V(0, 2.0, 0)); c.cat.position.copy(top); c.cat.scale.setScalar(3); c.cat.rotation.set(0, Math.PI / 2, 0); c.cat.userData.walk(lt, 0.2); c.lamp.position.copy(p).add(V(3, 4, 6));
    },
    cam: (W, c, lt) => { const k = K(W, lt), x = -6 + lt * 5; return camAt([x + 2.5, 33, -1], [x + 0.5, 31.5, -18], 46, { far: 600 }); },
    anchors: (W, c) => ({ ride: c.cat.position.clone() }),
  },
  // ================================================================ 20 "Fucking genius." both proud; the cat flies past the window
  20: {
    build(W) { const c = { R: room(W) }; c.cb = person(W, 'cowboy'); c.kid = person(W, 'kid'); c.mini = RM.balloon(W.scene); c.cat = RM.cat(W.scene); c.mini.scale.setScalar(0.25); c.cat.scale.setScalar(0.25); return c; },
    update(W, c, lt) {
      standAt(c.cb, -0.45, -0.4, 0.2); c.cb.p.straddle = 0.95; face(c.cb, 'happy', 'raised', 'grin'); c.cb.p.handL = rel(c.cb, 0.02, 0.24, 1.02); c.cb.p.handR = rel(c.cb, 0.02, -0.24, 1.02); c.cb.p.handPoseL = c.cb.p.handPoseR = 'fist';
      standAt(c.kid, 0.45, -0.3, -0.2); face(c.kid, 'happy', 'raised', 'grin'); c.kid.p.handR = rel(c.kid, 0.3, -0.25, 1.35); c.kid.p.handPoseR = 'thumb';
    },
    after(W, c, lt) { bigArm(c.kid, 1); const x = 0.7 + lt * 1.2; c.mini.position.set(x, 1.7, -3.2); c.mini.userData.set({ r: 1.0, soft: 0, tape: true }, lt); c.cat.position.copy(c.mini.localToWorld(V(0, 2.0, 0))); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.1, 1.45, 2.7 - 0.2 * k], [0.1, 1.35, -0.6], 44); },
    anchors: (W, c) => ({ duo: V(0, 2.1, -0.4) }),
  },
};
