// The 25 shots of the bed-shake (semi genius) reel, in the reference's dollhouse look: a cutaway apartment building
// (bedroom upstairs, the old neighbors downstairs, the basement), bright warm rooms, plain low-poly people.
// lt = seconds since the shot's start, W.dur = its length (the user's voice), W.cut = a camera cut on a word.
import * as THREE from 'three';
import { makeChar, helpers, crowdSpec } from './cast.js';
import * as HS from './house.js';
import { glowSprite } from './sets.js';
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
const F2 = 3, F1 = 0, FB = -3;                        // floor heights: bedroom, living room, basement
const BX = HS.BED.x, BZ = HS.BED.z;

// ------------------------------------------------------------------ shared setups
function house(W, o = {}) { HS.homeLights(W, { at: o.at ?? [0, 3, -2.5], size: o.size ?? 8 }); return HS.buildHouse(W); }
function couple(W, c) { c.him = person(W, 'him'); c.gf = person(W, 'gf'); return c; }
function couplePose(c, lt, y0 = F2, { shake = 1, bedX = BX, bedZ = BZ } = {}) {
  const b = shake * Math.abs(Math.sin(lt * 23)) * 0.035;
  standAt(c.gf, bedX - 0.78, bedZ + 0.12, -Math.PI / 2, y0 + 0.6 + b * 0.5); Object.assign(c.gf.p, { pitch: -Math.PI / 2 + 0.18 });
  standAt(c.him, bedX - 0.95, bedZ + 0.2, Math.PI / 2, y0 + 0.78 + b); Object.assign(c.him.p, { pitch: 1.3 + 0.04 * Math.sin(lt * 23) * shake });
  c.him.p.handL = [bedX + 0.62, y0 + 0.66, bedZ + 0.48]; c.him.p.handR = [bedX + 0.62, y0 + 0.66, bedZ - 0.22]; c.him.p.handPoseL = c.him.p.handPoseR = 'flat';
}
function inBed(c, lt, y0 = F2, { bedX = BX, bedZ = BZ, shake = 0 } = {}) {   // lying under the blanket, heads on the pillows (+x)
  const b = shake * Math.abs(Math.sin(lt * 23)) * 0.03;
  for (const [ch, dz] of [[c.him, -0.36], [c.gf, 0.34]]) { standAt(ch, bedX - 0.78, bedZ + dz, -Math.PI / 2, y0 + 0.6 + b); Object.assign(ch.p, { pitch: -Math.PI / 2 + 0.18 }); }
}
function neighborsSofa(c, y0 = F1) { sitAt(c.nana, 0.0, -3.62, 0, y0 + 0.0); sitAt(c.gp, 0.65, -3.62, 0, y0 + 0.0); }
function oldies(W, c) { c.nana = person(W, 'nana'); c.gp = person(W, 'grandpa'); return c; }
function dance(ch, t, seed = 0, k = 1) {
  const ph = t * 7.5 + seed;
  ch.p.walk = null; ch.p.bounce = 0.6 * k; ch.p.torsoYaw = Math.sin(ph * 0.5) * 0.35 * k; ch.p.leanSide = Math.sin(ph * 0.5) * 0.12 * k;
  ch.p.handL = rel(ch, 0.15, 0.35 + Math.sin(ph) * 0.1, 1.75 + Math.sin(ph) * 0.2); ch.p.handR = rel(ch, 0.15, -0.35 + Math.sin(ph + 1) * 0.1, 1.75 + Math.cos(ph) * 0.2);
  ch.p.handPoseL = ch.p.handPoseR = 'point';
}
function shakeGroup(g, t, k = 1, base = [0, 0, 0]) { g.position.set(base[0] + Math.sin(t * 53) * 0.03 * k, base[1] + Math.sin(t * 41) * 0.025 * k, base[2]); g.rotation.z = Math.sin(t * 37) * 0.006 * k; }
function dustAt(W, n = 20) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 1, 16, 16, 15);
  gr.addColorStop(0, 'rgba(240,230,210,1)'); gr.addColorStop(1, 'rgba(240,230,210,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false });
  const g = new THREE.Group(); W.scene.add(g); for (let i = 0; i < n; i++) g.add(new THREE.Sprite(m)); g.userData.mat = m; return g;
}
function dustFall(g, t, area = [-2.5, 2.5], y0 = 2.7, z = -2.5) { g.children.forEach((s, i) => { const k = (t * 0.7 + hash1(i * 3.3)) % 1; s.position.set(lerp(area[0], area[1], hash1(i * 1.7)), y0 - k * 2.4, z + (hash1(i * 5.1) - 0.5) * 3); s.scale.setScalar(0.06 + 0.06 * hash1(i)); }); }

export const SHOTS = {
  // ================================================================ 1 "Your bed shakes" like the reference: the couple in bed, close, from the side
  1: {
    build(W) { const c = { H: house(W, { size: 5 }) }; c.him = person(W, 'him', { skin: '#f08a6c' }); c.gf = person(W, 'gf'); return c; },
    update(W, c, lt) { couplePose(c, lt); face(c.him, 'open', 'raised', 'tight', { lookAt: [BX + 0.5, F2 + 1.4, BZ + 2.6] }); face(c.gf, 'closed', 'neutral', 'neutral'); },
    after(W, c, lt) { c.H.bed.userData.shake(lt, 1); },
    cam: (W, c, lt) => {
      if (lt < W.cut) { const q = clamp(lt / Math.max(0.5, W.cut)); return camAt([BX - 0.2 + 0.2 * q, F2 + 1.75 - 0.15 * q, BZ + 3.6 - 0.6 * q], [BX + 0.3, F2 + 1.05, BZ], 44); }
      const k = clamp((lt - W.cut) / Math.max(0.3, W.dur - W.cut)); return camAt([BX + 0.45, F2 + 1.32, BZ + 1.75 - 0.08 * k], [BX + 0.72, F2 + 1.0, BZ], 44);
    },
    anchors: (W, c) => ({ forehead: c.him.headPos().add(V(0, 0.1, 0.05)), bed: V(BX - 0.2, F2 + 1.3, BZ) }),
  },
  // ================================================================ 2 "so fucking loud," the same shot, a little closer (his red, sweaty face)
  2: {
    build(W) { const c = { H: house(W, { size: 5 }) }; c.him = person(W, 'him', { skin: '#f08a6c' }); c.gf = person(W, 'gf'); return c; },
    update(W, c, lt) { couplePose(c, lt + 3.74); face(c.him, 'open', 'raised', 'tight', { lookAt: [BX + 0.5, F2 + 1.4, BZ + 2.6] }); face(c.gf, 'closed', 'neutral', 'neutral'); },
    after(W, c, lt) { c.H.bed.userData.shake(lt + 3.74, 1); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([BX + 0.5, F2 + 1.3, BZ + 1.5 - 0.1 * k], [BX + 0.74, F2 + 1.02, BZ], 44); },
    anchors: (W, c) => ({ forehead: c.him.headPos().add(V(0, 0.1, 0.05)) }),
  },
  // ================================================================ 3 "the neighbors run outside" the cutaway: they jump off the sofa and run
  3: {
    build(W) { const c = { H: house(W) }; c.him = person(W, 'him', { skin: '#f08a6c' }); c.gf = person(W, 'gf'); oldies(W, c); c.dust = dustAt(W, 20); return c; },
    update(W, c, lt) {
      couplePose(c, lt + 2.0); face(c.him, 'open', 'raised', 'tight'); face(c.gf, 'closed', 'neutral', 'neutral');
      for (const [ch, x0, d] of [[c.nana, 0.0, 0.0], [c.gp, 0.65, 0.06]]) {
        const q = clamp((lt - d) / 0.1);
        if (q < 1) { sitAt(ch, x0, -3.62, 0, 0); face(ch, 'wide', 'raised', 'yell'); }
        else { const m = clamp((lt - d - 0.1) / Math.max(0.3, W.dur - 0.1)); standAt(ch, lerp(x0, -2.8, m), lerp(-3.1, -1.6, m), -Math.PI / 2 + 0.3); ch.p.walk = lt * 16; face(ch, 'wide', 'raised', 'yell'); ch.p.handL = rel(ch, 0.25, 0.3, 1.75); ch.p.handR = rel(ch, 0.25, -0.3, 1.75); ch.p.handPoseL = ch.p.handPoseR = 'open'; }
      }
    },
    after(W, c, lt) { c.H.bed.userData.shake(lt + 2.0, 1); c.H.door.rotation.y = -1.2 * easeOut(clamp(lt / 0.3)); dustFall(c.dust, lt); c.H.chand.userData.arm.rotation.z = Math.sin(lt * 9) * 0.2; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.0, 3.0, 10.2 - 0.3 * k], [-0.2, 2.9, -2.5], 46); },
    anchors: (W, c) => ({ below: V(-0.6, 1.9, -2.6) }),
  },
  // ================================================================ 4 "in their pajamas." outside at night
  4: {
    build(W) { HS.homeLights(W, { at: [HS.PL.street, 1, 1.5], size: 7 }); W.lights.hemi.intensity = 0.8; W.lights.key.intensity = 0.7; const c = { S: HS.buildStreet(W) }; oldies(W, c); c.ted = HS.teddy(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.nana, HS.PL.street - 0.45, 1.8, 0.15); standAt(c.gp, HS.PL.street + 0.45, 1.75, -0.15);
      face(c.nana, 'squint', 'angry', 'frown', { lookAt: [HS.PL.street, 4.6, 0] }); face(c.gp, 'squint', 'angry', 'frown', { lookAt: [HS.PL.street, 4.6, 0] });
      c.ted.position.set(...rel(c.gp, 0.22, -0.2, 1.05)); c.gp.p.handR = rel(c.gp, 0.2, -0.22, 1.0); c.gp.p.handPoseR = 'grip';
      c.nana.p.handL = rel(c.nana, 0.12, 0.08, 1.12); c.nana.p.handR = rel(c.nana, 0.12, -0.08, 1.08); c.nana.p.handPoseL = c.nana.p.handPoseR = 'flat';
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([HS.PL.street + 0.9, 1.6, 7.6 - 0.6 * k], [HS.PL.street, 2.2, 1.2], 44); },
  },
  // ================================================================ 5 "Every single time." their annoyed faces (tally)
  5: {
    build(W) { HS.homeLights(W, { at: [HS.PL.street, 1, 1.5], size: 5 }); W.lights.hemi.intensity = 0.8; W.lights.key.intensity = 0.7; const c = { S: HS.buildStreet(W) }; oldies(W, c); return c; },
    update(W, c, lt) {
      standAt(c.nana, HS.PL.street - 0.33, 1.8, 0.1); standAt(c.gp, HS.PL.street + 0.33, 1.75, -0.1);
      face(c.nana, 'squint', 'angry', 'tight', { lookAt: [HS.PL.street, 1.5, 6] }); face(c.gp, 'squint', 'angry', 'tight', { lookAt: [HS.PL.street, 1.5, 6] });
      for (const ch of [c.nana, c.gp]) { ch.p.handL = rel(ch, 0.22, 0.1, 1.12); ch.p.handR = rel(ch, 0.22, -0.1, 1.08); ch.p.handPoseL = ch.p.handPoseR = 'fist'; }
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([HS.PL.street, 1.55, 4.2 - 0.3 * k], [HS.PL.street, 1.45, 1.75], 40); },
  },
  // ================================================================ 6 "So you, being a semi genius," him with a hammer; cut: smug face
  6: {
    build(W) { const c = { H: house(W, { size: 6 }) }; couple(W, c); c.ham = HS.hammer(W.scene); return c; },
    update(W, c, lt) {
      standAt(c.him, -0.9, -1.5, 0.25, F2); face(c.him, lt >= W.cut ? 'squint' : 'open', 'raised', 'grin', { headPitch: 0.18 });
      c.ham.position.set(...rel(c.him, 0.25, -0.32, F2 + 1.25)); c.ham.rotation.set(0, c.him.p.rotY, 0.4); c.him.p.gripR = c.ham;
      c.him.p.handL = rel(c.him, 0.1, 0.25, F2 + 0.95); c.him.p.handPoseL = 'fist';
      standAt(c.gf, 50, 50, 0); c.gf.p.visible = false;
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const h = c.him.headPos(), q = clamp((lt - W.cut) / 1.5); return camAt([h.x + 0.15, h.y - 0.06, h.z + 0.85 - 0.1 * q], [h.x, h.y - 0.05, h.z], 40); }
      return camAt([-0.3, F2 + 1.45, 2.6], [-0.7, F2 + 1.0, -1.5], 42);
    },
  },
  // ================================================================ 7 "nail the bed to the floor." BANG BANG into the bed legs
  7: {
    build(W) { const c = { H: house(W, { size: 5 }) }; c.him = person(W, 'him'); c.ham = HS.hammer(W.scene); c.nails = [HS.nail(W.scene, BX - 0.98, F2 + 0.2, BZ + 0.68, 1.4), HS.nail(W.scene, BX + 0.98, F2 + 0.2, BZ + 0.68, 1.4)]; return c; },
    update(W, c, lt) {
      standAt(c.him, BX - 1.62, BZ + 0.9, Math.PI / 2 + 0.25, F2); Object.assign(c.him.p, { kneel: 1, kneelOne: true, lean: 0.35 }); face(c.him, 'squint', 'angry', 'grimace', { headPitch: -0.4 });
      const hit = (lt * 3.2) % 1, up = hit < 0.6 ? easeOut(hit / 0.6) : 1 - easeIn((hit - 0.6) / 0.4);
      const tgt = V(BX - 0.98, F2 + 0.22, BZ + 0.68);
      c.ham.position.set(tgt.x + 0.08, tgt.y + 0.08 + up * 0.35, tgt.z + 0.22); c.ham.rotation.set(-0.3 - up * 0.9, 0, 1.4); c.him.p.gripR = c.ham;
    },
    after(W, c, lt) { const n = Math.floor(lt * 3.2); c.nails[0].position.y = F2 + 0.2 - Math.min(3, n) * 0.04; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([BX - 0.95, F2 + 0.75, BZ + 2.45 - 0.15 * k], [BX - 1.15, F2 + 0.42, BZ + 0.7], 44); },
    anchors: (W, c) => ({ leg: V(BX - 0.98, F2 + 0.3, BZ + 0.68) }),
  },
  // ================================================================ 8 "Now the whole floor shakes." the bedroom floor + bed, dust below
  8: {
    build(W) { const c = { H: house(W) }; couple(W, c); oldies(W, c); c.dust = dustAt(W, 30); return c; },
    update(W, c, lt) { inBed(c, lt, F2, { shake: 1 }); face(c.him, 'squint', 'raised', 'grin'); face(c.gf, 'closed', 'raised', 'smile'); neighborsSofa(c); Object.assign(c.nana.p, { bounce: 0.8 }); Object.assign(c.gp.p, { bounce: 0.8 }); face(c.nana, 'wide', 'raised', 'o'); face(c.gp, 'wide', 'angry', 'yell'); },
    after(W, c, lt) { c.H.bed.userData.shake(lt, 1); shakeGroup(c.H.f2, lt, 1.2, [0, F2, 0]); dustFall(c.dust, lt); c.H.chand.userData.arm.rotation.z = Math.sin(lt * 9) * 0.25; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.2, 3.1, 9.6 - 0.5 * k], [0, 2.8, -2.5], 44); },
  },
  // ================================================================ 9 "The chandelier downstairs" it starts swinging
  9: {
    build(W) { const c = { H: house(W, { at: [0, 1.5, -2.5], size: 5 }) }; oldies(W, c); return c; },
    update(W, c, lt) { neighborsSofa(c); face(c.nana, 'wide', 'raised', 'o', { lookAt: P3(c.H.chand.userData.body.getWorldPosition(V())) }); face(c.gp, 'wide', 'raised', 'o', { lookAt: P3(c.H.chand.userData.body.getWorldPosition(V())) }); },
    after(W, c, lt) { const a = c.H.chand.userData.arm; a.rotation.z = Math.sin(lt * 6) * 0.35 * Math.min(1, lt * 2); a.rotation.x = Math.sin(lt * 4) * 0.12; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.3, 1.0, 1.7 - 0.2 * k], [0.3, 2.1, -2.4], 46); },
  },
  // ================================================================ 10 "does the macarena." the chandelier dances; the neighbors stare
  10: {
    build(W) { const c = { H: house(W, { at: [0, 1.5, -2.5], size: 5 }) }; oldies(W, c); return c; },
    update(W, c, lt) { neighborsSofa(c); const b = c.H.chand.userData.body.getWorldPosition(V()); face(c.nana, 'wide', 'raised', 'smileOpen', { lookAt: P3(b) }); face(c.gp, 'stare', 'raised', 'o', { lookAt: P3(b) }); },
    after(W, c, lt) { const a = c.H.chand.userData.arm, beat = Math.floor(lt * 4.2); a.rotation.z = [0.4, -0.4, 0.4, -0.4, 0.25, -0.25, 0.5, -0.5][beat % 8] * smooth((lt * 4.2) % 1 * 2); a.rotation.x = ((beat % 4) < 2 ? 0.25 : -0.25); c.H.chand.userData.body.rotation.y = lt * 6; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.25, 1.35, 3.5 - 0.3 * k], [0.3, 1.6, -2.6], 46); },
    anchors: (W, c) => ({ chand: c.H.chand.userData.body.getWorldPosition(V()) }),
  },
  // ================================================================ 11 "So you bolt" a giant wrench, a huge bolt: CLANK
  11: {
    build(W) { const c = { H: house(W, { size: 5 }) }; c.him = person(W, 'him'); c.wr = HS.wrench(W.scene, 1.4); c.bolt = HS.bigBolt(W.scene, -1.2, F2 + 0.06, -1.0, 1.5); return c; },
    update(W, c, lt) {
      standAt(c.him, -1.2, -0.25, Math.PI, F2); Object.assign(c.him.p, { lean: 0.5 }); face(c.him, 'squint', 'angry', 'grimace', { headPitch: -0.5 });
      const a = lt * 5; c.wr.position.set(-1.2 + Math.cos(a) * 0.05, F2 + 0.22, -1.0 + Math.sin(a) * 0.05); c.wr.rotation.set(-Math.PI / 2, 0, a); c.him.p.gripR = c.wr;
      c.him.p.handL = P3(c.wr.localToWorld(V(0, 0.3, 0))); c.him.p.handPoseL = 'grip';
    },
    after(W, c, lt) { c.bolt.rotation.y = lt * 5; c.bolt.position.y = F2 + 0.06 - Math.min(0.08, lt * 0.12); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.05, F2 + 0.95, -0.55 - 0.05 * k], [-1.2, F2 + 0.35, -1.0], 46); },
    anchors: (W, c) => ({ bolt: V(-1.2, F2 + 0.4, -1.0) }),
  },
  // ================================================================ 12 "the floor to the building." giant bolts everywhere
  12: {
    build(W) {
      const c = { H: house(W) }; c.him = person(W, 'him'); c.wr = HS.wrench(W.scene, 1.4);
      c.bolts = [];
      for (const [x, y, z, ry, rx] of [[-2.6, F2 + 0.06, -1.2, 0, 0], [2.4, F2 + 0.06, -1.0, 0, 0], [-1.0, F2 + 0.06, -4.0, 0, 0], [-3.42, 1.5, -2.5, 0, Math.PI / 2], [3.42, 1.5, -2.5, 0, -Math.PI / 2], [-3.42, 4.5, -3.5, 0, Math.PI / 2], [3.42, 4.5, -1.5, 0, -Math.PI / 2], [0.0, 6.06, -2.0, 0, 0], [-1.8, -0.0 + 0.06, -3.0, 0, 0]]) {
        const b = HS.bigBolt(W.scene, x, y, z, 1.6, ry, 0); if (rx) { b.rotation.z = rx; } c.bolts.push(b);
      }
      return c;
    },
    update(W, c, lt) { standAt(c.him, -1.4, -1.8, 0.3, F2); face(c.him, 'happy', 'raised', 'grin'); c.wr.position.set(...rel(c.him, 0.25, -0.35, F2 + 1.0)); c.wr.rotation.set(0, c.him.p.rotY, 0.3); c.him.p.gripR = c.wr; },
    after(W, c, lt) { c.bolts.forEach((b, i) => { const k = clamp((lt - i * 0.08) / 0.25); b.visible = k > 0; b.scale.setScalar(easeOutBack(k)); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.0, 3.0, 11 + 0.5 * k], [0, 3.0, -2.5], 48); },
  },
  // ================================================================ 13 "Now the whole fucking building shakes." outside; cut closer
  13: {
    build(W) { HS.homeLights(W, { at: [HS.PL.street, 3, -1], size: 9 }); W.lights.hemi.intensity = 0.8; W.lights.key.intensity = 0.7; const c = { S: HS.buildStreet(W) }; oldies(W, c); c.bricks = Array.from({ length: 10 }, (_, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: '#b86a4a', flatShading: true })); W.scene.add(m); return m; }); return c; },
    update(W, c, lt) {
      standAt(c.nana, HS.PL.street - 0.3, 2.0, 0.2); standAt(c.gp, HS.PL.street + 0.3, 2.0, -0.2);
      face(c.nana, 'wide', 'raised', 'yell', { lookAt: [HS.PL.street, 6, 0] }); face(c.gp, 'wide', 'raised', 'yell', { lookAt: [HS.PL.street, 6, 0] });
      c.nana.p.handL = P3(c.gp.chestPos()); c.gp.p.handR = P3(c.nana.chestPos()); c.nana.p.handPoseL = c.gp.p.handPoseR = 'flat'; Object.assign(c.nana.p, { bounce: 0.5 }); Object.assign(c.gp.p, { bounce: 0.5 });
    },
    after(W, c, lt) {
      const b = c.S.building; b.position.x = Math.sin(lt * 31) * 0.08; b.rotation.z = Math.sin(lt * 17) * 0.015; b.position.y = Math.abs(Math.sin(lt * 23)) * 0.05;
      c.S.windows.forEach((w, i) => { w.material.emissiveIntensity = 0.9 + 0.3 * Math.sin(lt * 40 + i); });
      c.bricks.forEach((m, i) => { const t0 = (i * 0.21) % 1.6, f = Math.max(0, lt - t0); m.visible = lt > t0; m.position.set(HS.PL.street - 3.5 + (i % 5) * 1.8, Math.max(0.05, 8.5 - (i % 3) * 2.5 - 4.9 * f * f), 0.3 + (i % 2) * 0.4); m.rotation.set(f * 6, f * 3, 0); });
    },
    cam: (W, c, lt) => {
      if (lt >= W.cut) { const q = clamp((lt - W.cut) / 1.4); return camAt([HS.PL.street + 0.8, 3.2, 9.5 - 0.4 * q], [HS.PL.street, 4.3, 0], 46); }
      return camAt([HS.PL.street + 1.0, 2.2, 15], [HS.PL.street, 4.6, 0], 46);
    },
  },
  // ================================================================ 14 "The news calls it an earthquake." (header, ticker + seismograph are 2D)
  14: {
    build(W) {
      HS.homeLights(W, { at: [HS.PL.news, 1, 0], size: 4 }); const c = {};
      const g = new THREE.Group(); g.position.x = HS.PL.news; W.scene.add(g);
      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.8).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.5, flatShading: true })); desk.position.set(0, 0, 0.45); g.add(desk);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: '#e8ecf2' })); top.position.set(0, 0.82, 0.45); g.add(top);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ color: '#1a2448' })); screen.position.set(0, 1.9, -1.6); g.add(screen);
      // a little apartment building on the screen behind him (shaking)
      c.mini = new THREE.Group(); c.mini.position.set(0.9, 1.0, -1.5); g.add(c.mini);
      const bm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.05).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: '#d8a078' })); c.mini.add(bm);
      for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.2), new THREE.MeshStandardMaterial({ color: '#ffd890', emissive: '#ffb850', emissiveIntensity: 0.8 })); w.position.set(-0.22 + (i % 3) * 0.22, 0.4 + Math.floor(i / 3) * 0.6, 0.03); c.mini.add(w); }
      c.anchor = person(W, 'anchor'); return c;
    },
    update(W, c, lt) { sitAt(c.anchor, HS.PL.news, -0.35, 0, 0); helpers.talk(c.anchor, lt * 1.3, 1); face(c.anchor, 'wide', 'worried', c.anchor.p.talk > 0.4 ? 'talkOpen' : 'frownOpen'); c.anchor.p.handL = [HS.PL.news + 0.25, 1.0, 0.25]; c.anchor.p.handR = [HS.PL.news - 0.25, 1.0, 0.25]; c.anchor.p.handPoseL = c.anchor.p.handPoseR = 'flat'; },
    after(W, c, lt) { c.mini.rotation.z = Math.sin(lt * 25) * 0.05; c.mini.position.x = HS.PL.news + 0.9 - HS.PL.news + Math.sin(lt * 31) * 0.02; },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([HS.PL.news, 1.3, 2.1 - 0.1 * k], [HS.PL.news, 1.2, 0], 44); },
  },
  // ================================================================ 15 "So you move the bed" he hauls the bed on his back
  15: {
    build(W) { const c = { H: house(W, { size: 6 }) }; c.him = person(W, 'him'); c.mbed = HS.bed(W.scene, 0, 0); c.H.bed.visible = false; return c; },
    update(W, c, lt) {
      const k = clamp(lt / W.dur); standAt(c.him, lerp(1.0, -1.6, k), -1.4, -Math.PI / 2, F2); c.him.p.walk = lt * 9; Object.assign(c.him.p, { lean: 0.55 });
      face(c.him, 'squint', 'worried', 'grimace', { headPitch: -0.1 });
      const over = V(...rel(c.him, 0.0, 0, F2 + 1.92 + Math.sin(lt * 9) * 0.04));
      c.mbed.position.copy(over); c.mbed.rotation.set(0, 0, Math.sin(lt * 4.5) * 0.06);
      c.him.p.handL = rel(c.him, 0.05, 0.3, F2 + 1.95); c.him.p.handR = rel(c.him, 0.05, -0.3, F2 + 1.95); c.him.p.handPoseL = c.him.p.handPoseR = 'open'; c.him.p.lean = 0.1;
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([-0.3, F2 + 1.55, 4.6 - 0.2 * k], [-0.4, F2 + 1.45, -1.4], 46); },
  },
  // ================================================================ 16 "to the basement." the bed in the basement, back in it
  16: {
    build(W) { const c = { H: house(W, { at: [0, -1.5, -2.5], size: 5 }) }; couple(W, c); c.H.bed.position.y = FB - F2 + 0; c.H.f2.remove(c.H.bed); c.H.base.add(c.H.bed); c.H.bed.position.set(BX, 0, BZ); return c; },
    update(W, c, lt) { inBed(c, lt, FB, { shake: lt > 0.5 ? 1 : 0 }); face(c.him, 'happy', 'raised', 'grin'); face(c.gf, 'happy', 'raised', 'smile'); },
    after(W, c, lt) { if (lt > 0.5) c.H.bed.userData.shake(lt, 1); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.5, FB + 1.9, 4.2 - 0.3 * k], [0.3, FB + 1.0, BZ], 44); },
  },
  // ================================================================ 17 "Now the subway" the train in the tunnel
  17: {
    build(W) { HS.homeLights(W, { at: [HS.PL.subway, 1, 0], size: 10 }); W.lights.hemi.intensity = 0.5; W.lights.key.intensity = 0.3; W.scene.background = new THREE.Color('#14161c'); return { Sb: HS.buildSubway(W) }; },
    after(W, c, lt) { c.Sb.train.position.x = -12 + lt * 22; c.Sb.train.position.y = Math.sin(lt * 30) * 0.01; },
    cam: (W, c, lt) => camAt([HS.PL.subway + 10, 1.4, 2.6], [HS.PL.subway + 2, 1.4, 0], 50),
  },
  // ================================================================ 18 "stops running." it screeches to a halt and shakes
  18: {
    build(W) { HS.homeLights(W, { at: [HS.PL.subway, 1, 0], size: 10 }); W.lights.hemi.intensity = 0.5; W.lights.key.intensity = 0.3; W.scene.background = new THREE.Color('#14161c'); return { Sb: HS.buildSubway(W) }; },
    after(W, c, lt) { const k = easeOut(clamp(lt / 0.5)); c.Sb.train.position.x = 10 + k * 6; c.Sb.cars.forEach((car, i) => { car.rotation.x = (lt < 0.6 ? Math.sin(lt * 50 + i) * 0.03 : 0); car.rotation.z = lt < 0.5 ? -0.03 * (1 - k) : 0; }); },
    cam: (W, c, lt) => camAt([HS.PL.subway + 20, 1.5, 4.0], [HS.PL.subway + 14, 1.5, 0], 48),
    anchors: (W, c) => ({ front: V(HS.PL.subway + 20.5, 1.2, 0) }),
  },
  // ================================================================ 19 "Wait." he freezes; a light bulb pops on
  19: {
    build(W) { const c = { H: house(W, { at: [0, -1.5, -2.5], size: 4 }) }; c.him = person(W, 'him'); c.bulbIdea = HS.ideaBulb(W.scene); return c; },
    update(W, c, lt) { standAt(c.him, -0.8, -1.4, 0.2, FB); face(c.him, 'wide', 'raised', 'o', { headPitch: 0.15 }); c.him.p.handR = P3(hl(c.him, -0.18, 0.18, 0.12)); c.him.p.handPoseR = 'point'; },
    after(W, c, lt) { const h = c.him.headPos(); c.bulbIdea.position.set(h.x, h.y + 0.35, h.z); c.bulbIdea.scale.setScalar(easeOutBack(clamp(lt / 0.2)) * 1.4); },
    cam: (W, c, lt) => { const h = c.him.headPos(); return camAt([h.x + 0.15, h.y + 0.05, h.z + 1.25], [h.x, h.y + 0.12, h.z], 42); },
    anchors: (W, c) => ({ bulb: c.him.headPos().add(V(0, 0.45, 0)) }),
  },
  // ================================================================ 20 "Your bed is just a drum." he taps it: BOOM
  20: {
    build(W) { const c = { H: house(W, { at: [0, -1.5, -2.5], size: 5 }) }; c.him = person(W, 'him'); c.H.f2.remove(c.H.bed); c.H.base.add(c.H.bed); c.H.bed.position.set(BX, 0, BZ); c.st = [HS.drumstick(W.scene), HS.drumstick(W.scene)]; return c; },
    update(W, c, lt) {
      standAt(c.him, BX - 0.6, BZ + 1.25, Math.PI, FB); face(c.him, 'wide', 'raised', 'smileOpen', { headPitch: -0.3 });
      const hit = (lt * 2.0) % 1, up = hit < 0.25 ? 1 - hit / 0.25 : clamp((hit - 0.25) / 0.75);
      c.st.forEach((s, i) => { const sd = i ? 1 : -1; s.position.set(BX - 0.6 + sd * 0.22, FB + 0.82 + up * 0.25 * (i ? 1 : 0.4), BZ + 0.55); s.rotation.set(-1.2 + up * 0.6, 0, sd * 0.2); }); c.him.p.gripR = c.st[0]; c.him.p.gripL = c.st[1];
    },
    after(W, c, lt) { const hit = (lt * 2.0) % 1; c.H.bed.scale.set(1, hit < 0.15 ? 0.96 : 1, 1); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([BX - 0.75, FB + 1.65, BZ - 1.85 + 0.1 * k], [BX - 0.6, FB + 1.1, BZ + 1.0], 46); },
    anchors: (W, c) => ({ bed: V(BX - 0.2, FB + 1.2, BZ) }),
  },
  // ================================================================ 21 "So you find the beat." drumming the bed (BPM)
  21: {
    build(W) { const c = { H: house(W, { at: [0, -1.5, -2.5], size: 5 }) }; c.him = person(W, 'him'); c.H.f2.remove(c.H.bed); c.H.base.add(c.H.bed); c.H.bed.position.set(BX, 0, BZ); c.st = [HS.drumstick(W.scene), HS.drumstick(W.scene)]; return c; },
    update(W, c, lt) {
      standAt(c.him, BX - 0.6, BZ + 1.25, Math.PI, FB); face(c.him, 'squint', 'raised', 'grin', { headPitch: -0.2 + 0.1 * Math.sin(lt * 12.6) });
      c.st.forEach((s, i) => { const sd = i ? 1 : -1, ph = (lt * 4 + i * 0.5) % 1, up = ph < 0.3 ? 1 - ph / 0.3 : clamp((ph - 0.3) / 0.7); s.position.set(BX - 0.6 + sd * 0.25, FB + 0.82 + up * 0.22, BZ + 0.55); s.rotation.set(-1.2 + up * 0.6, 0, sd * 0.2); }); c.him.p.gripR = c.st[0]; c.him.p.gripL = c.st[1];
    },
    after(W, c, lt) { const ph = (lt * 4) % 1; c.H.bed.scale.set(1, ph < 0.12 ? 0.97 : 1, 1); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([BX + 1.2, FB + 1.5, BZ + 2.6 - 0.2 * k], [BX - 0.4, FB + 0.9, BZ + 0.6], 46); },
  },
  // ================================================================ 22 "Now the neighbors don't run outside." they stay on the sofa, bopping
  22: {
    build(W) { const c = { H: house(W, { at: [0, 1.5, -2.5], size: 5 }) }; oldies(W, c); return c; },
    update(W, c, lt) { neighborsSofa(c); face(c.nana, 'happy', 'raised', 'smile', { headRoll: Math.sin(lt * 12.6) * 0.15 }); face(c.gp, 'happy', 'raised', 'smile', { headPitch: Math.max(0, Math.sin(lt * 12.6)) * -0.2 }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.35, 1.3, 1.9 - 0.2 * k], [0.32, 1.0, -3.6], 44); },
  },
  // ================================================================ 23 "And they dance." disco ball, colours, notes
  23: {
    build(W) { const c = { H: house(W, { at: [0, 1.5, -2.5], size: 5 }) }; oldies(W, c); c.disco = HS.discoBall(W.scene, 0.3, 2.2, -2.4); c.H.chand.visible = false; c.lights = ['#ff4a8a', '#4ad8ff', '#ffd84a'].map((col, i) => { const l = new THREE.PointLight(col, 6, 6, 1.5); l.position.set(-1.5 + i * 1.5, 2.2, -1); W.scene.add(l); return l; }); return c; },
    update(W, c, lt) { standAt(c.nana, -0.35, -2.4, 0.3); standAt(c.gp, 0.75, -2.5, -0.3); dance(c.nana, lt, 0); dance(c.gp, lt, 1.6); face(c.nana, 'happy', 'raised', 'laugh'); face(c.gp, 'happy', 'raised', 'grin'); },
    after(W, c, lt) { c.disco.userData.ball.rotation.y = lt * 2; c.lights.forEach((l, i) => { l.intensity = 4 + 4 * Math.max(0, Math.sin(lt * 9 + i * 2)); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.25, 1.35, 3.6 - 0.3 * k], [0.2, 1.15, -2.45], 44); },
    anchors: (W, c) => ({ couple: V(0.2, 1.9, -2.45) }),
  },
  // ================================================================ 24 "Every single time." every floor dances
  24: {
    build(W) {
      const c = { H: house(W) }; oldies(W, c); c.him = person(W, 'him'); c.gf = person(W, 'gf');
      c.H.f2.remove(c.H.bed); c.H.base.add(c.H.bed); c.H.bed.position.set(BX, 0, BZ);
      c.party = [0, 1, 2, 3].map((i) => person(W, `crowd${i + 11}`));
      c.disco = HS.discoBall(W.scene, 0.3, 2.2, -2.4); c.H.chand.visible = false;
      c.lights = ['#ff4a8a', '#4ad8ff', '#ffd84a'].map((col, i) => { const l = new THREE.PointLight(col, 6, 8, 1.5); l.position.set(-1.5 + i * 1.5, 7.8, -1); W.scene.add(l); return l; });
      return c;
    },
    update(W, c, lt) {
      standAt(c.nana, -0.35, -2.4, 0.3); standAt(c.gp, 0.75, -2.5, -0.3); dance(c.nana, lt, 0); dance(c.gp, lt, 1.6); face(c.nana, 'happy', 'raised', 'laugh'); face(c.gp, 'happy', 'raised', 'grin');
      c.party.forEach((ch, i) => { standAt(ch, -2.2 + i * 1.4, -2.2 - (i % 2) * 0.8, (i - 1.5) * 0.2, 6); dance(ch, lt, i * 1.1); face(ch, 'happy', 'raised', 'laugh'); });
      standAt(c.him, BX - 0.6, BZ + 1.25, Math.PI, FB); dance(c.him, lt, 2.2, 0.6); face(c.him, 'happy', 'raised', 'grin');
      standAt(c.gf, BX + 0.6, BZ + 1.25, Math.PI, FB); dance(c.gf, lt, 3.1, 0.6); face(c.gf, 'happy', 'raised', 'laugh');
    },
    after(W, c, lt) { c.disco.userData.ball.rotation.y = lt * 2; c.lights.forEach((l, i) => { l.intensity = 4 + 4 * Math.max(0, Math.sin(lt * 9 + i * 2)); }); },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([0.0, 3.0, 13.5 + 0.5 * k], [0, 3.0, -2.5], 48); },
  },
  // ================================================================ 25 "Fucking genius." sitting back on the headboard, hands behind his head
  25: {
    build(W) { const c = { H: house(W, { at: [0, -1.5, -2.5], size: 4 }) }; couple(W, c); c.H.f2.remove(c.H.bed); c.H.base.add(c.H.bed); c.H.bed.position.set(BX, 0, BZ); return c; },
    update(W, c, lt) {
      sitAt(c.him, BX + 0.55, BZ - 0.3, -0.95, FB + 0.16); Object.assign(c.him.p, { lean: -0.25 });
      const h = c.him.headPos(); c.him.p.handL = [h.x + 0.1, h.y + 0.02, h.z - 0.13]; c.him.p.handR = [h.x + 0.1, h.y + 0.02, h.z + 0.13]; c.him.p.handPoseL = c.him.p.handPoseR = 'relaxed';
      face(c.him, 'happy', 'raised', 'grin', { headRoll: 0.06 * Math.sin(lt * 3), lookAt: [BX - 0.55, FB + 1.45, BZ + 1.7] });
      standAt(c.gf, BX - 0.78, BZ + 0.36, -Math.PI / 2, FB + 0.6); Object.assign(c.gf.p, { pitch: -Math.PI / 2 + 0.18 }); face(c.gf, 'happy', 'raised', 'smile', { lookAt: P3(c.him.headPos()) });
    },
    cam: (W, c, lt) => { const k = K(W, lt); return camAt([BX - 0.55, FB + 1.45, BZ + 1.7 - 0.12 * k], [BX + 0.55, FB + 1.1, BZ - 0.15], 42); },
    anchors: (W, c) => ({ him: c.him.headPos() }),
  },
};
