// The 36 shots of the wedding reel as code-made low-poly 3D scenes (one module, one entry per shot).
// Each shot: build(W) -> ctx (set + cast, once), update(W, ctx, lt) (poses at shot-local time lt, every frame),
// cam(W, ctx, lt) -> {pos, target, fov}, anchors(W, ctx, lt) -> named 3D points for the 2D effects,
// still (0..1: which moment is the picture), clip (true: rendered as a 30 fps clip too).
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './hall.js';
import { clamp, smooth, lerp, hash1 } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const sitAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY }); };
const standAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);   // head-local point
const forehead = (ch) => hl(ch, 0, 0.07, 0.075);
const eyesOf = (ch) => [hl(ch, -0.031, 0.004, 0.09), hl(ch, 0.031, 0.004, 0.09)];
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40) => ({ pos, target, fov });
// world point in front of a character's head (dist metres along its facing, plus up)
const before = (ch, dist, up = 0, side = 0) => {
  const h = ch.headPos(), f = fwd(ch.p.rotY), r = V(f.z, 0, -f.x);
  return h.add(f.multiplyScalar(dist)).add(V(0, up, 0)).add(r.multiplyScalar(side));
};
const tiny = (t, k) => Math.sin(t * k) * 0.5 + 0.5;
// world hand orientation as the Euler [x, y, z] (YXZ) solve() expects: fingers along Y, back of the hand along Z
const handRot = (Y, Z) => {
  const y = V(...Y).normalize(), x = V().crossVectors(y, V(...Z)).normalize(), z = V().crossVectors(x, y);
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z), 'YXZ'); return [e.x, e.y, e.z];
};
// hands cupped around the mouth like a megaphone (character facing +z)
const megaphone = (ch, dy = -0.02) => {
  const m = ch.mouthPos();
  ch.p.handL = [m.x + 0.075, m.y + dy, m.z + 0.045]; ch.p.handR = [m.x - 0.075, m.y + dy, m.z + 0.045];
  ch.p.handPoseL = ch.p.handPoseR = 'relaxed';
  ch.p.handRotL = handRot([0.0, 1, 0.35], [1, 0, -0.3]); ch.p.handRotR = handRot([0.0, 1, 0.35], [-1, 0, -0.3]);
};
// camera in front of a character's head: dist along its facing, dy up, dx to its left; aim at the head (+ty)
const headCam = (ch, dist, dy = 0, dx = 0, ty = 0, fov = 40) => {
  const h = ch.headPos(), f = fwd(ch.p.rotY), l = V(f.z, 0, -f.x);
  const p = h.clone().add(f.multiplyScalar(dist)).add(V(0, dy, 0)).add(l.multiplyScalar(dx));
  return camAt([p.x, p.y, p.z], [h.x, h.y + ty, h.z], fov);
};

// ------------------------------------------------------------------ shared scenes
const BX = -60;                                          // bathroom x
function bathroom(W, o = {}) {
  S.lights(W, 'hall'); S.keyAt(W, [BX, 1, -0.8], { from: [1.5, 4, 3], size: 3 });
  W.lights.fill.position.set(BX + 0.3, 1.6, 0.6); W.lights.fill.intensity = 1.4;
  W.scene.background = new THREE.Color('#2a2420');
  const B = S.buildBathroom(W, { x0: BX, ...o });
  const you = person(W, 'you');
  return { B, you };
}
function youOnToilet(ctx) { sitAt(ctx.you, BX, -1.02, 0); }

// guests seated around the hall tables; skip: {tableIdx: [seat indices]} kept empty
function seatGuests(W, H, { per = 6, skip = {}, start = 0, only = null } = {}) {
  const list = [];
  let n = start;
  H.tables.forEach((T, ti) => {
    if (only && !only.includes(ti)) return;
    T.seats.forEach((s, si) => {
      if ((skip[ti] || []).includes(si) || si >= per + (ti % 2)) return;
      const ch = person(W, `guest${n}`); list.push({ ch, s, i: n }); n++;
    });
  });
  return list;
}
function poseSeated(list, lt, mode = 'chat') {
  for (const { ch, s, i } of list) {
    sitAt(ch, s.x, s.z, s.rotY);
    if (mode === 'chat') {
      ch.p.headYaw = (hash1(i * 3.3) - 0.5) * 1.2; ch.p.mouth = hash1(i * 5.1) > 0.4 ? 'smile' : 'neutral';
      helpers.talk(ch, lt + i, hash1(i) > 0.6 ? 0.8 : 0);
      if (hash1(i * 7.7) > 0.7) { ch.p.mouth = 'laugh'; ch.p.eyes = 'happy'; }
    }
  }
}
function hall(W, o = {}) {
  S.lights(W, o.dark ? 'dark' : 'hall');
  W.scene.background = new THREE.Color('#2a1c14');
  W.scene.fog = new THREE.Fog(o.dark ? '#0c0806' : '#3a2a20', o.fogNear ?? 14, o.fogFar ?? 34);
  const H = S.buildHall(W, o);
  return H;
}

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 "You're thirty-two years old." YOU in the stall, proudly fixing his tie
  1: {
    build: (W) => bathroom(W),
    update(W, c, lt) {
      youOnToilet(c); face(c.you, 'open', 'neutral', 'smile', { headPitch: 0.12 });
      c.you.p.handR = [BX - 0.01, 1.05 + 0.01 * Math.sin(lt * 3), -0.86]; c.you.p.handPoseR = 'grip';
    },
    cam: (W, c) => headCam(c.you, 0.78, 0.0, -0.1, -0.1, 40),
    anchors: (W, c) => ({ watch: c.you.arms.L.H.grp.getWorldPosition(V()) }),
    still: 0.5,
  },
  // 02 "You just pooped" low angle: the closed stall door, his shoes under it
  2: {
    build: (W) => bathroom(W),
    update(W, c) { youOnToilet(c); face(c.you, 'open', 'neutral', 'smile'); },
    cam: () => camAt([BX + 0.05, 0.3, 2.6], [BX, 0.95, -0.1], 50),
    anchors: () => ({ door_top: V(BX, 2.02, -0.1) }),
  },
  // 03 "at your cousin's wedding" wide hall, the couple dancing
  3: {
    build(W) {
      const H = hall(W);
      S.keyAt(W, [0, 0, -2], { from: [4, 9, 6], size: 10 });
      W.lights.fill.position.set(3, 3, 4); W.lights.fill.intensity = 2;
      const g = seatGuests(W, H, { per: 5, skip: { 6: [0, 1, 7], 7: [0, 1, 7] } });
      const groom = person(W, 'groom'), bride = person(W, 'bride'), dj = person(W, 'dj');
      return { H, g, groom, bride, dj };
    },
    update(W, c, lt) {
      poseSeated(c.g, lt);
      standAt(c.groom, 0.28, -2.2, -Math.PI / 2 + 0.2); standAt(c.bride, -0.28, -2.15, Math.PI / 2 + 0.2);
      face(c.groom, 'happy', 'raised', 'grin'); face(c.bride, 'happy', 'raised', 'grin');
      c.groom.p.handR = [0.0, 1.25, -2.42]; c.bride.p.handL = [0.0, 1.25, -2.42];
      c.groom.p.handL = [-0.05, 1.05, -1.98]; c.bride.p.handR = [0.05, 1.08, -1.98];
      standAt(c.dj, 0, -9.85, 0); face(c.dj, 'happy', 'raised', 'grin'); c.dj.p.handL = [-0.5, 1.07, -9.3]; c.dj.p.handPoseL = 'flat';
      c.dj.p.handR = [0.35, 1.9, -9.6];
    },
    cam: () => camAt([6.8, 3.4, 7.6], [-0.4, 0.9, -3.4], 56),
  },
  // 04 "And from the toilet, you yell:" cupping his hands, huge breath
  4: {
    build: (W) => bathroom(W),
    update(W, c, lt) {
      youOnToilet(c); face(c.you, 'open', 'raised', 'o', { lean: -0.08, shoulderUp: 1, chestPuff: 0.5 * smooth(lt / 1.2), headPitch: 0.1 });
      megaphone(c.you);
    },
    cam: (W, c) => headCam(c.you, 0.85, -0.02, 0.08, -0.12, 42),
    anchors: (W, c) => ({ mouth: c.you.mouthPos() }),
  },
  // 05 "MOM!" extreme close-up yell (clip: head shaking with the force)
  5: {
    build: (W) => bathroom(W),
    update(W, c, lt) {
      youOnToilet(c);
      face(c.you, 'closed', 'angry', 'yell', { headPitch: 0.22 + 0.04 * Math.sin(lt * 31), headYaw: 0.05 * Math.sin(lt * 23), headRoll: 0.04 * Math.sin(lt * 27), lean: -0.1, shoulderUp: 1, chestPuff: 0.6 });
      megaphone(c.you, -0.03);
    },
    cam: (W, c) => headCam(c.you, 0.55, -0.12, 0.03, -0.03, 46),
    anchors: (W, c) => ({ mouth: c.you.mouthPos() }),
    still: 0.4, clip: true,
  },
  // 06 "I'M DONE!" champagne glasses shaking on a table, one tipping
  6: {
    build(W) {
      const H = hall(W, { tables: [[0, 0, 3], [-3.5, -3, 4], [3.2, -3.5, 5]], chairs: false, plates: 0 });
      S.keyAt(W, [0, 0.8, 0], { from: [2, 5, 3], size: 2 });
      W.lights.fill.position.set(0.5, 1.4, 1.6); W.lights.fill.intensity = 2;
      const T = H.tables[0].group, fl = [];
      for (let i = 0; i < 5; i++) fl.push(S.flute(T, -0.32 + i * 0.16, 0.765, 0.58 - Math.abs(i - 2) * 0.04, { fill: 0.75 }));
      return { H, fl };
    },
    update(W, c, lt) {
      c.fl.forEach((f, i) => { f.rotation.z = (i === 3 ? -0.55 : 0) + 0.05 * Math.sin(lt * 40 + i); f.position.y = 0.765 + Math.abs(Math.sin(lt * 37 + i * 2)) * 0.006 + (i === 3 ? 0.012 : 0); });
    },
    cam: () => camAt([0.08, 1.06, 1.75], [0, 0.9, 0.48], 38),
  },
  // 07 "The DJ stops the music." hand slammed on the record, frozen
  7: {
    build(W) {
      const H = hall(W, { tables: [[-5, -6, 1], [5, -6, 2]] });
      S.keyAt(W, [0, 1, -9.5], { from: [2, 5, 5], size: 3 });
      W.lights.fill.position.set(0.4, 1.8, -7.8); W.lights.fill.intensity = 2.2;
      return { H, dj: person(W, 'dj') };
    },
    update(W, c) {
      standAt(c.dj, 0, -9.88, 0); face(c.dj, 'wide', 'raised', 'o', { lean: 0.12 });
      c.dj.p.handL = [-0.5, 1.07, -9.32]; c.dj.p.handPoseL = 'flat';
      c.dj.p.handR = [0.25, 1.15, -9.55]; c.dj.p.handPoseR = 'open';
    },
    cam: () => camAt([0.25, 1.62, -8.25], [-0.05, 1.42, -9.75], 42),
  },
  // 08 "Two hundred guests turn around." (clip: everyone turns at the same time)
  8: {
    build(W) {
      const H = hall(W, { fogNear: 10, fogFar: 26 });
      S.keyAt(W, [2, 0, 0], { from: [3, 9, 6], size: 10 });
      W.lights.fill.position.set(7, 2.2, 2.5); W.lights.fill.intensity = 3;
      const g = seatGuests(W, H, { per: 7 });
      let n = 80;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6 - (r === 0 ? 1 : 0); k++) {
        const x = 4.6 - r * 1.25 + (hash1(n) - 0.5) * 0.3, z = -0.2 - k * 0.8 + (r % 2) * 0.4;
        g.push({ ch: person(W, `guest${n}`), s: { x, z, rotY: -Math.PI / 2 + (hash1(n + 1) - 0.5) * 0.6 }, i: n, stand: true }); n++;
      }
      return { H, g };
    },
    update(W, c, lt) {
      const k = smooth((lt - 0.25) / 0.45);                 // the turn: all together
      const cam = V(8.4, 1.62, 2.5);
      for (const { ch, s, i, stand } of c.g) {
        if (stand) standAt(ch, s.x, s.z, s.rotY); else sitAt(ch, s.x, s.z, s.rotY);
        const to = Math.atan2(8.4 - s.x, 1.0 - s.z);
        let d = to - s.rotY; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ch.p.torsoYaw = clamp(d * 0.55, -1.1, 1.1) * k;
        ch.p.headYaw = clamp(d - ch.p.torsoYaw * 0.7, -1.2, 1.2) * k + (1 - k) * (hash1(i) - 0.5) * 0.8;
        ch.p.mouth = k > 0.5 ? 'neutral' : (hash1(i * 5.1) > 0.4 ? 'smile' : 'neutral');
        ch.p.eyes = k > 0.5 ? 'open' : (hash1(i * 7.7) > 0.7 ? 'happy' : 'open');
        if (k < 0.5) helpers.talk(ch, lt + i, hash1(i) > 0.6 ? 0.7 : 0);
      }
    },
    cam: (W, c, lt) => camAt([8.4, 1.75, 1.0], [0, 1.15, -2.0], 52),
    still: 0.85, clip: true,
  },
  // 09 "Then you remember." frozen realization, sweat
  9: {
    build: (W) => bathroom(W),
    update(W, c) { youOnToilet(c); face(c.you, 'wide', 'raised', 'tight', { headPitch: 0.04 }); },
    cam: (W, c) => headCam(c.you, 0.6, 0.0, -0.05, -0.04, 38),
    anchors: (W, c) => ({ forehead: forehead(c.you) }),
  },
  // 10 "Mom left an hour ago." empty gold chair with the "Reserved: Mom" card
  10: {
    build(W) {
      const H = hall(W, { tables: [[0, 0, 2], [-3.2, -3, 3], [3, -3.4, 4]] });
      S.keyAt(W, [0, 0.5, 1], { from: [2, 5, 4], size: 2.5 });
      W.lights.fill.position.set(0.5, 1.5, 2.6); W.lights.fill.intensity = 2;
      const T = H.tables[0], s0 = T.seats[0];                     // seat facing -z at (0, 1.27)
      S.placeCard(W.scene, s0.x, 0.475, s0.z + 0.02, 'Reserved: Mom', Math.PI);
      const g = seatGuests(W, H, { per: 8, skip: { 0: [0] } });
      return { H, g, s0 };
    },
    update(W, c, lt) { poseSeated(c.g, lt, 'still'); for (const { ch } of c.g) face(ch, 'open', 'neutral', 'neutral'); },
    cam: (W, c) => camAt([c.s0.x, 1.2, c.s0.z - 0.85], [c.s0.x, 0.52, c.s0.z + 0.02], 42),
  },
  // 11 "Silence." backs of the guests, all staring down the hallway at the bathroom door
  11: {
    build(W) {
      S.lights(W, 'hall'); W.scene.background = new THREE.Color('#1a120e');
      const HW = S.buildHallway(W, { x0: 60 });
      S.keyAt(W, [60, 0, -2], { from: [1, 6, 4], size: 4 });
      W.lights.fill.position.set(60, 2, 2.5); W.lights.fill.intensity = 1.5; W.lights.hemi.intensity = 0.5;
      const g = [];
      [[-0.75, 0.9], [0.0, 1.1], [0.72, 0.85], [-0.35, 1.9], [0.4, 2.0]].forEach(([x, z], i) => g.push({ ch: person(W, `guest${i + 3}`), x: 60 + x, z }));
      return { HW, g };
    },
    update(W, c) { for (const { ch, x, z } of c.g) { standAt(ch, x, z, Math.PI); face(ch, 'open', 'neutral', 'neutral'); } },
    cam: () => camAt([60.1, 1.62, 3.4], [60, 1.25, -12], 46),
    anchors: (W, c) => ({ door: V(...c.HW.doorBottom) }),
  },
  // 12 "The uncles look at each other." three mustaches, eyes darting sideways
  12: {
    build(W) {
      const H = hall(W, { tables: [[0, 0, 4], [-3.5, -4, 5], [3.5, -4.2, 6]], chairs: false, centre: false, plates: 0 });
      S.keyAt(W, [0, 1, -1], { from: [2, 5, 4], size: 2.5 });
      W.lights.fill.position.set(0, 1.6, 1.6); W.lights.fill.intensity = 2.2;
      const u = ['uncle1', 'uncle2', 'uncle3'].map((n) => person(W, n));
      [-0.46, 0, 0.46].forEach((x) => S.goldChair(W.scene, x, -1.12 - Math.abs(x) * 0.1, 0));
      return { H, u };
    },
    update(W, c, lt) {
      const look = lt < 0.7 ? 1 : -1;
      c.u.forEach((ch, i) => {
        const x = [-0.46, 0, 0.46][i];
        sitAt(ch, x, -1.12 - Math.abs(x) * 0.1, 0);
        face(ch, 'open', 'neutral', 'tight', { pupils: [i === 0 ? 1 : i === 2 ? -1 : look, 0] });
      });
    },
    cam: () => camAt([0, 1.42, 1.55], [0, 1.2, -1.15], 44),
  },
  // 13 "Nobody moves." a frozen waiter pouring champagne, the glass overflowing
  13: {
    build(W) {
      const H = hall(W, { tables: [[0, 0, 5], [-3.4, -3.2, 6], [3.3, -3.6, 7]], chairs: true });
      S.keyAt(W, [0.6, 1, 0.8], { from: [2, 5, 4], size: 2.5 });
      W.lights.fill.position.set(1.2, 1.7, 2.6); W.lights.fill.intensity = 2.2;
      const waiter = person(W, 'waiter');
      const bt = S.bottle(W.scene);
      const gl = S.flute(H.tables[0].group, 0.42, 0.765, 0.55, { fill: 1.0 });
      const spill = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12).rotateX(-Math.PI / 2), S && new THREE.MeshStandardMaterial({ color: '#f0cf6a', roughness: 0.15, transparent: true, opacity: 0.75 }));
      spill.position.set(0.44, 0.769, 0.56); spill.scale.set(1.3, 1, 0.9); H.tables[0].group.add(spill);
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.2, 6), new THREE.MeshStandardMaterial({ color: '#f0cf6a', roughness: 0.2, transparent: true, opacity: 0.85 }));
      W.scene.add(stream);
      const foam = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), new THREE.MeshStandardMaterial({ color: '#fff8e0', roughness: 0.6 }));
      foam.position.set(0.42, 0.765 + 0.255, 0.55); foam.scale.set(1, 0.6, 1); H.tables[0].group.add(foam);
      return { H, waiter, bt, stream };
    },
    update(W, c) {
      standAt(c.waiter, 0.62, 1.12, Math.PI + 0.35); face(c.waiter, 'stare', 'neutral', 'neutral');
      c.waiter.p.lookAt = [0.15, 1.5, -0.45];
      c.bt.position.set(0.5, 1.12, 0.62); c.bt.rotation.set(0, 0, 2.1);
      c.waiter.p.gripR = c.bt;
      c.waiter.p.handL = [0.8, 0.95, 0.95];
      c.stream.position.set(0.43, 0.97, 0.55);
    },
    cam: () => camAt([0.15, 1.5, -0.45], [0.6, 1.3, 1.05], 46),
  },
  // 14 "The bride stops smiling." frozen smile, staring eyes
  14: {
    build(W) {
      const H = hall(W, { tables: [[-2.5, -1, 2], [2.5, -1.5, 3]] });
      S.keyAt(W, [0, 1.5, 1], { from: [1.5, 4, 4], size: 2 });
      W.lights.fill.position.set(0.3, 1.7, 2.2); W.lights.fill.intensity = 2;
      return { H, bride: person(W, 'bride') };
    },
    update(W, c) { standAt(c.bride, 0, 1, 0); face(c.bride, 'stare', 'worried', 'grin', { headRoll: 0.03 }); },
    cam: () => camAt([0.02, 1.58, 1.62], [0, 1.53, 1.0], 38),
  },
  // 15 "The groom pretends" phone up to his face
  15: {
    build(W) {
      const H = hall(W, { tables: [[-2.5, -1, 2], [2.5, -1.5, 3]] });
      S.keyAt(W, [0, 1.5, 1], { from: [1.5, 4, 4], size: 2 });
      W.lights.fill.position.set(0.3, 1.7, 2.4); W.lights.fill.intensity = 2;
      const groom = person(W, 'groom'), ph = S.phone(W.scene);
      return { H, groom, ph };
    },
    update(W, c) {
      standAt(c.groom, 0, 1, 0.15); face(c.groom, 'open', 'worried', 'tight', { headPitch: -0.12 });
      const p = before(c.groom, 0.27, -0.12, -0.03);
      c.ph.position.copy(p); c.ph.rotation.set(-0.35, 0.15 + Math.PI, 0); c.ph.rotation.y = 0.15; c.ph.rotateY(Math.PI);
      c.groom.p.gripR = c.ph; c.groom.p.lookAt = [p.x, p.y, p.z];
    },
    cam: () => camAt([0.42, 1.55, 1.95], [0.02, 1.5, 1.05], 40),
    anchors: (W, c) => ({ forehead: forehead(c.groom) }),
  },
  // 16 "to check his phone." over the shoulder: just the home screen
  16: {
    build(W) {
      const H = hall(W, { tables: [[-2.5, -1, 2], [2.5, -1.5, 3]] });
      S.keyAt(W, [0, 1.5, 1], { from: [1.5, 4, 4], size: 2 });
      const groom = person(W, 'groom'), ph = S.phone(W.scene);
      return { H, groom, ph };
    },
    update: (W, c) => SHOTS[15].update(W, c),
    cam: (W, c) => { const p = c.ph.getWorldPosition(V()); const h = c.groom.headPos(); const f = fwd(c.groom.p.rotY), r = V(-f.z, 0, f.x);
      const q = h.clone().add(r.multiplyScalar(0.2)).add(f.multiplyScalar(-0.12)).add(V(0, 0.06, 0)); return camAt([q.x, q.y, q.z], [p.x, p.y, p.z], 28); },
  },
  // 17 "Grandpa pretends to be asleep." fake snore, one eye peeking (clip)
  17: {
    build(W) {
      const H = hall(W, { tables: [[0, 0, 6], [-3.4, -3.2, 2], [3.3, -3.6, 3]], chairs: false });
      S.keyAt(W, [0, 1, 1], { from: [2, 5, 4], size: 2.5 });
      W.lights.fill.position.set(0.3, 1.5, 2.4); W.lights.fill.intensity = 2.2;
      S.goldChair(W.scene, 0, 1.25, Math.PI);
      const gp = person(W, 'grandpa'), st = S.walkingStick(W.scene);
      return { H, gp, st };
    },
    update(W, c, lt) {
      sitAt(c.gp, 0, 1.25, Math.PI);
      const snore = 0.5 + 0.5 * Math.sin(lt * 4.2);
      const peek = (lt > 0.75 && lt < 1.25);
      face(c.gp, peek ? 'peek' : 'closed', 'neutral', 'open', { headPitch: 0.42, headRoll: 0.12, talk: snore * 0.8, pupils: [-1, 0], bellyWobble: 0 });
      c.gp.p.chestPuff = snore * 0.25;
      c.st.position.set(0.02, 0, 0.82); c.st.rotation.set(-0.12, Math.PI / 2, 0);
      c.gp.p.gripR = c.st; c.gp.p.handL = [0.06, 0.82, 0.86]; c.gp.p.handPoseL = 'grip';
    },
    cam: (W, c) => headCam(c.gp, 0.95, 0.05, 0.1, -0.18, 42),
    anchors: (W, c) => ({ mouth: c.gp.mouthPos() }),
    still: 0.45, clip: true,
  },
  // 18 "You yell again. Louder." an ENORMOUS breath
  18: {
    build: (W) => bathroom(W),
    update(W, c, lt) {
      youOnToilet(c); const k = smooth(lt / 1.6);
      face(c.you, 'closed', 'raised', 'tight', { chestPuff: 0.4 + 0.6 * k, shoulderUp: k, lean: -0.12 * k, headPitch: 0.15 * k });
    },
    cam: (W, c) => headCam(c.you, 0.8, 0.0, 0.06, -0.14, 44),
    still: 0.7,
  },
  // 19 "MOM!" low angle, yelling even harder
  19: {
    build: (W) => bathroom(W),
    update(W, c) {
      youOnToilet(c);
      face(c.you, 'closed', 'angry', 'yell', { headPitch: 0.24, lean: -0.12, shoulderUp: 1, chestPuff: 0.9 });
      megaphone(c.you, -0.03);
    },
    cam: (W, c) => headCam(c.you, 0.62, -0.2, 0.04, -0.02, 48),
    anchors: (W, c) => ({ mouth: c.you.mouthPos() }),
  },
  // 20 "I'M DOOONE!" the chandelier swings, guests duck (clip)
  20: {
    build(W) {
      const H = hall(W, { chandeliers: [[0, -2], [-5, -6], [5, -6]], tables: [[-1.6, -0.6, 1], [1.8, -3.6, 2]], chairs: false, chandelierI: 9 });
      S.keyAt(W, [0, 0, -2], { from: [3, 9, 5], size: 6 });
      W.lights.fill.position.set(0, 1.5, 1); W.lights.fill.intensity = 2.5;
      const g = [];
      [[-0.9, -1.0], [0.7, -1.4], [-0.3, -3.0], [1.2, -2.5], [-1.4, -2.4]].forEach(([x, z], i) => g.push({ ch: person(W, `guest${10 + i}`), x, z }));
      return { H, g, ch: H.chandeliers[0] };
    },
    update(W, c, lt) {
      c.ch.userData.swing.rotation.z = 0.34 * Math.sin(lt * 2 * Math.PI * 0.85) * (1 - 0.15 * lt);
      c.ch.userData.swing.rotation.x = 0.12 * Math.sin(lt * 2 * Math.PI * 0.85 + 1.2);
      for (const { ch, x, z } of c.g) {
        standAt(ch, x, z, Math.atan2(-x, -2 - z) + Math.PI); face(ch, 'wide', 'raised', 'o', { lean: 0.35, headPitch: -0.2 });
        const h = ch.headPos();
        ch.p.handL = [h.x + 0.07, h.y + 0.12, h.z]; ch.p.handR = [h.x - 0.07, h.y + 0.12, h.z];
        ch.p.handPoseL = ch.p.handPoseR = 'flat';
      }
    },
    cam: () => camAt([0.6, 0.95, 1.6], [0, 3.6, -2.0], 62),
    still: 0.3, clip: true,
  },
  // 21 "A baby starts crying." baby in a tiny tuxedo in a high chair
  21: {
    build(W) {
      const H = hall(W, { tables: [[0, -1, 3], [-3.4, -3.2, 4]], chairs: false });
      S.keyAt(W, [0, 1, 0.5], { from: [2, 5, 4], size: 2 });
      W.lights.fill.position.set(0.3, 1.4, 1.8); W.lights.fill.intensity = 2;
      S.highChair(W.scene, 0, 0.35, Math.PI);
      return { H, baby: person(W, 'baby') };
    },
    update(W, c, lt) {
      sitAt(c.baby, 0, 0.36, Math.PI); c.baby.p.y = 0.33;
      face(c.baby, 'closed', 'sad', 'yell', { headPitch: 0.18 + 0.03 * Math.sin(lt * 9), headRoll: 0.06 * Math.sin(lt * 7) });
      c.baby.p.handL = [0.16, 1.08, 0.12]; c.baby.p.handR = [-0.16, 1.1, 0.12]; c.baby.p.handPoseL = c.baby.p.handPoseR = 'open';
    },
    cam: () => camAt([0.03, 1.12, -0.38], [0, 1.08, 0.4], 40),
    anchors: (W, c) => ({ eyes: eyesOf(c.baby) }),
  },
  // 22 "What you don't know:" calm, empty hallway, the bathroom door at the end
  22: {
    build(W) {
      S.lights(W, 'hall'); W.scene.background = new THREE.Color('#1a120e');
      const HW = S.buildHallway(W, { x0: 60 });
      S.keyAt(W, [60, 0, -5], { from: [1, 6, 3], size: 6 });
      W.lights.fill.position.set(60, 1.8, 1); W.lights.fill.intensity = 1.2; W.lights.hemi.intensity = 0.55;
      return { HW };
    },
    update() {},
    cam: () => camAt([60, 1.45, 1.2], [60, 1.25, -12], 44),
    anchors: (W, c) => ({ door: V(...c.HW.doorBottom) }),
  },
  // 23 "most kids learn to wipe on their own" a proud 5-year-old with a toilet roll trophy
  23: {
    build(W) {
      S.lights(W, 'kids'); W.scene.background = new THREE.Color('#9ccbe8');
      const K = S.buildKidsBath(W, { x0: 120 });
      S.keyAt(W, [120, 0.6, 0], { from: [1, 4, 3], size: 2 });
      W.lights.fill.position.set(120.3, 1.3, 1.6); W.lights.fill.intensity = 2;
      const kid = person(W, 'kid1'), roll = S.toiletRoll(W.scene);
      return { K, kid, roll };
    },
    update(W, c, lt) {
      standAt(c.kid, 120, 0, 0); face(c.kid, 'happy', 'raised', 'grin', { headPitch: 0.25, bounce: 0 });
      const h = c.kid.headPos();
      c.roll.position.set(h.x, h.y + 0.34 + 0.02 * Math.sin(lt * 9), h.z + 0.04); c.roll.rotation.set(0, 0, 0);
      c.kid.p.gripL = { prop: c.roll, which: 'L' }; c.kid.p.gripR = { prop: c.roll, which: 'R' };
    },
    cam: () => camAt([120.05, 0.98, 1.25], [120, 1.02, 0], 44),
    anchors: (W, c) => ({ roll: c.roll.getWorldPosition(V()) }),
  },
  // 24 "by age five or six." two kids on a winners' podium, medals, rolls up
  24: {
    build(W) {
      S.lights(W, 'kids'); W.scene.background = new THREE.Color('#9ccbe8');
      const K = S.buildKidsBath(W, { x0: 120 });
      S.keyAt(W, [120, 0.6, -0.4], { from: [1, 4, 3], size: 2.5 });
      W.lights.fill.position.set(120.2, 1.6, 1.8); W.lights.fill.intensity = 2;
      S.podium(W.scene, 120, -0.6);
      const k1 = person(W, 'kid1'), k2 = person(W, 'kid2');
      const r1 = S.toiletRoll(W.scene), r2 = S.toiletRoll(W.scene), m1 = S.medal(W.scene), m2 = S.medal(W.scene);
      return { K, k1, k2, r1, r2, m1, m2 };
    },
    update(W, c) {
      standAt(c.k1, 120, -0.6, 0); c.k1.p.y = 0.5; standAt(c.k2, 119.38, -0.6, 0.15); c.k2.p.y = 0.32;
      face(c.k1, 'happy', 'raised', 'grin', { headPitch: 0.1 }); face(c.k2, 'happy', 'raised', 'laugh', { headPitch: 0.1 });
      for (const [k, r] of [[c.k1, c.r1], [c.k2, c.r2]]) {
        const h = k.headPos(); r.position.set(h.x - 0.2, h.y + 0.28, h.z + 0.05); r.rotation.set(0, 0, 0.2);
        k.p.gripR = { prop: r, which: 'L' };
      }
    },
    after(W, c) {
      for (const [k, m] of [[c.k1, c.m1], [c.k2, c.m2]]) { const p = k.chestPos(); m.position.set(p.x, p.y - 0.02, p.z + 0.02); }
    },
    cam: () => camAt([119.75, 1.25, 2.0], [119.72, 1.0, -0.6], 42),
  },
  // 25 "You're thirty-two." back to the stall door and the shoes
  25: {
    build: (W) => bathroom(W),
    update(W, c) { youOnToilet(c); },
    cam: () => camAt([BX - 0.1, 0.32, 2.4], [BX, 0.95, -0.1], 50),
    anchors: () => ({ door_top: V(BX, 2.02, -0.1) }),
  },
};

// ------------------------------------------------------------------ rock-paper-scissors circle (26-32)
const CIRCLE = ['groom', 'uncle1', 'grandpa', 'bride', 'uncle2', 'uncle3', 'guest21', 'guest22'];
const CX = 0, CZ = -2, CR = 0.78;
function circle(W, o = {}) {
  const H = hall(W, { dark: true, chandelierI: 0.6, fogNear: 6, fogFar: 18, ...o });
  W.lights.hemi.intensity = 0.18;
  S.spot(W, [CX, 5.0, CZ + 0.4], [CX, 0, CZ], { intensity: 140, angle: 0.36, coneOpacity: 0.05 });
  if (o.under) { const u = new THREE.PointLight(0xffd8a0, 2.5, 2.5, 2); u.position.set(CX, 0.9, CZ); W.scene.add(u); }
  const ppl = CIRCLE.map((n) => person(W, n));
  return { H, ppl };
}
function poseCircle(c, lt, { fist = 'fist', scissorsAt = Infinity, shake = true, lookGroom = 0 } = {}) {
  c.ppl.forEach((ch, i) => {
    const a = (i / CIRCLE.length) * Math.PI * 2;
    const x = CX + Math.sin(a) * CR, z = CZ + Math.cos(a) * CR;
    standAt(ch, x, z, a + Math.PI);
    face(ch, 'squint', 'angry', 'tight', { lean: 0.1 });
    const bob = shake ? Math.abs(Math.sin(lt * 7.5)) * 0.06 : 0;
    const hx = CX + Math.sin(a) * 0.19, hz = CZ + Math.cos(a) * 0.19;
    ch.p.handR = [hx + Math.cos(a) * 0.04, 1.02 + bob, hz - Math.sin(a) * 0.04];
    ch.p.handPoseR = ch.name === 'groom' && lt >= scissorsAt ? 'scissors' : fist;
    const Yv = V(-Math.sin(a), -0.15, -Math.cos(a)).normalize(), Zv = V(0, 1, 0), Xv = V().crossVectors(Yv, Zv).normalize();
    Zv.crossVectors(Xv, Yv).normalize();
    const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xv, Yv, Zv), 'YXZ');
    ch.p.handRotR = [e.x, e.y, e.z];
    if (lookGroom) {
      const g = c.ppl[0];
      if (ch !== g) { ch.p.lookAt = [Math.sin(0) * CR + CX, 1.6, Math.cos(0) * CR + CZ]; face(ch, 'open', 'neutral', 'tight'); }
    }
  });
}
Object.assign(SHOTS, {
  // 26 "The family makes a circle." high angle, one spotlight
  26: {
    build: (W) => circle(W),
    update: (W, c, lt) => poseCircle(c, lt, { shake: false }),
    cam: () => camAt([2.0, 3.9, 1.4], [0, 0.85, -2.1], 46),
  },
  // 27 "Rock." fists in the middle
  27: {
    build: (W) => circle(W),
    update: (W, c, lt) => poseCircle(c, lt),
    cam: () => camAt([CX + 0.03, 1.82, CZ + 0.14], [CX, 1.02, CZ], 42),
    still: 0.3,
  },
  // 28 "Paper. Scissors." intense faces (uncle + grandpa) in the spotlight
  28: {
    build(W) { const c = circle(W, { under: true }); return c; },
    update: (W, c, lt) => poseCircle(c, lt),
    cam: (W, c) => headCam(c.ppl[1], 0.52, -0.08, 0.1, -0.03, 44),
  },
  // 29 "Everyone throws rock." top-down on the fists
  29: {
    build: (W) => circle(W),
    update: (W, c, lt) => poseCircle(c, lt, { shake: false }),
    cam: () => camAt([CX + 0.02, 2.45, CZ + 0.08], [CX, 1.0, CZ], 40),
  },
  // 30 "Except the groom." the groom slowly realising, sweat
  30: {
    build: (W) => circle(W),
    update(W, c, lt) { poseCircle(c, lt, { shake: false }); face(c.ppl[0], 'wide', 'worried', 'o', { headPitch: 0.12, lean: 0 }); },
    cam: (W, c) => headCam(c.ppl[0], 0.6, -0.06, 0.06, -0.06, 40),
    anchors: (W, c) => ({ forehead: forehead(c.ppl[0]) }),
  },
  // 31 "He throws scissors." slow motion: his hand opens into scissors among the fists (clip)
  31: {
    update(W, c, lt) { poseCircle(c, lt, { shake: false, scissorsAt: 0.55 }); },
    build: (W) => circle(W, { under: true }),
    cam: (W, c, lt) => { const g = c.ppl[0]; const h = V(...g.p.handR); return camAt([CX + 0.01, 1.62 - lt * 0.06, CZ + 0.12], [CX, 1.02, CZ + 0.08], 46); },
    still: 0.8, clip: true,
  },
  // 32 "On his own wedding day." everyone turns to stare at the groom
  32: {
    build: (W) => circle(W),
    update(W, c, lt) {
      poseCircle(c, lt, { shake: false, scissorsAt: 0, lookGroom: 1 });
      const b = c.ppl[3]; face(b, 'squint', 'angry', 'frown');
      const ch = b.chestPos(); b.p.handL = [ch.x - 0.12, ch.y, ch.z + 0.08]; b.p.handR = [ch.x + 0.12, ch.y + 0.02, ch.z + 0.08];
      face(c.ppl[0], 'wide', 'worried', 'tight');
    },
    cam: (W, c) => { const g = c.ppl[0].headPos(); return camAt([g.x + 0.5, g.y + 0.28, g.z + 0.55], [CX - 0.1, 1.42, CZ - 0.5], 54); },
  },
});

// ------------------------------------------------------------------ the walk (33-34), the DJ (35), the ending (36)
const AISLE_Z = 2.5;
function aisle(W) {
  const H = hall(W, { dark: true, chandelierI: 1.2, tables: [[-5, -6, 1], [5, -6, 2], [-5.5, -1.5, 3], [-5, 4, 5]], fogNear: 8, fogFar: 22 });
  W.lights.hemi.intensity = 0.3;
  const rows = [];
  let n = 30;
  for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
    const nm = i === 1 && side === 1 ? 'uncle1' : i === 2 && side === 1 ? 'uncle2' : i === 3 && side === 1 ? 'grandpa' : i === 2 && side === -1 ? 'uncle3' : `guest${n++}`;
    rows.push({ ch: person(W, nm), x: 1.6 + i * 1.3, z: AISLE_Z + side * 0.95, side });
  }
  const petals = [];
  const pm = new THREE.MeshStandardMaterial({ color: '#b8182c', roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03, 5), pm); m.scale.set(1, 0.6, 1);
    m.position.set(hash1(i) * 8, 0.006, AISLE_Z + (hash1(i + 9) - 0.5) * 1.2); m.rotation.set(-Math.PI / 2, 0, hash1(i + 3) * 6); W.scene.add(m); petals.push(m);
  }
  return { H, rows };
}
function poseRows(c, lt, salute = true) {
  for (const { ch, x, z, side } of c.rows) {
    standAt(ch, x, z, side > 0 ? Math.PI : 0);
    face(ch, 'squint', 'sad', 'tight', { headPitch: 0.1 });
    if (salute) {
      const h = ch.headPos(), f = fwd(ch.p.rotY), r = V(f.z, 0, -f.x);
      const t = h.clone().add(f.clone().multiplyScalar(0.07)).add(r.clone().multiplyScalar(-0.07)).add(V(0, 0.05, 0));
      ch.p.handR = [t.x, t.y, t.z]; ch.p.handPoseR = 'open';
    }
  }
}
Object.assign(SHOTS, {
  // 33 "He walks to the toilet." slow motion walk down the aisle, single spotlight (clip)
  33: {
    build(W) {
      const c = aisle(W); c.groom = person(W, 'groom');
      c.spot = S.spot(W, [2.5, 5.2, AISLE_Z], [2.5, 0, AISLE_Z], { intensity: 120, angle: 0.22, coneOpacity: 0.06 });
      return c;
    },
    update(W, c, lt) {
      poseRows(c, lt, true);
      const x = 0.6 + lt * 0.42;
      standAt(c.groom, x, AISLE_Z, Math.PI / 2); c.groom.p.walk = lt * 3.2; face(c.groom, 'open', 'sad', 'tight');
      c.spot.position.set(x + 0.2, 5.2, AISLE_Z); c.spot.target.position.set(x + 0.2, 0, AISLE_Z);
    },
    cam: (W, c, lt) => camAt([-1.6 + lt * 0.2, 1.75, AISLE_Z + 0.05], [5, 1.25, AISLE_Z], 46),
    still: 0.5, clip: true,
  },
  // 34 "Slowly." the uncles and grandpa saluting like soldiers
  34: {
    build(W) { const c = aisle(W); S.spot(W, [5.0, 5.2, AISLE_Z], [5.0, 0, AISLE_Z], { intensity: 90, angle: 0.3, coneOpacity: 0.04 }); W.lights.fill.position.set(4, 2, 1.2); W.lights.fill.intensity = 3; return c; },
    update: (W, c, lt) => poseRows(c, lt, true),
    cam: () => camAt([3.0, 1.6, AISLE_Z - 0.1], [5.6, 1.45, AISLE_Z + 1.0], 44),
  },
  // 35 "The DJ plays a sad song." crying, hand on heart, blue light
  35: {
    build(W) {
      const H = hall(W, { dark: true, tables: [[-5, -6, 1], [5, -6, 2]], chandelierI: 0.5 });
      W.lights.hemi.intensity = 0.3; W.lights.hemi.color = new THREE.Color('#9ab8ff');
      const bl = new THREE.PointLight(0x6a9aff, 7, 6, 2); bl.position.set(0.3, 2.0, -8.3); W.scene.add(bl);
      H.dj.lights.forEach((l) => { l.color = new THREE.Color('#3a6aff'); });
      return { H, dj: person(W, 'dj') };
    },
    update(W, c) {
      standAt(c.dj, 0, -9.88, 0); face(c.dj, 'closed', 'sad', 'frown', { headPitch: -0.08, headRoll: 0.08 });
      const ch = c.dj.chestPos(); c.dj.p.handL = [ch.x + 0.08, ch.y + 0.02, ch.z + 0.05]; c.dj.p.handPoseL = 'flat';
      c.dj.p.handR = [0.05, 1.03, -9.25]; c.dj.p.handPoseR = 'point';
    },
    cam: () => camAt([-0.2, 1.62, -8.2], [0, 1.45, -9.8], 42),
    anchors: (W, c) => ({ eyes: eyesOf(c.dj) }),
  },
  // 36 "Congratulations to the happy couple." the bride alone with the cake, "Just Married", the bathroom door
  36: {
    build(W) {
      const H = hall(W, { tables: [[-5, -6, 1], [5, -6, 2], [-5.5, -1.5, 3], [5.5, -1.5, 4]], chandelierI: 5, dj: true, arch: false });
      S.keyAt(W, [0, 0, -6], { from: [2, 8, 5], size: 6 });
      W.lights.fill.position.set(0, 2, -3); W.lights.fill.intensity = 2.5;
      // bathroom door on the back wall, right of the banner
      const door = new THREE.Group(); door.position.set(3.0, 0, H.Z0 + 0.05); W.scene.add(door);
      const dm = new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.6, flatShading: true });
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.15, 0.08).translate(0, 1.075, 0), dm); d.castShadow = d.receiveShadow = true; door.add(d);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.05).translate(0, 1.15, -0.02), new THREE.MeshStandardMaterial({ color: '#2a1a10', flatShading: true })); door.add(fr);
      const sg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.02), new THREE.MeshStandardMaterial({ color: '#d4a640', metalness: 0.7, roughness: 0.3 })); sg.position.set(0, 1.65, 0.06); door.add(sg);
      const bride = person(W, 'bride'), ck = S.cake(W.scene);
      const pm = new THREE.MeshStandardMaterial({ color: '#b8182c', roughness: 0.7, side: THREE.DoubleSide });
      for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.03, 5), pm); m.position.set((hash1(i) - 0.5) * 5, 0.008, -5 + (hash1(i + 4) - 0.5) * 4); m.rotation.set(-Math.PI / 2, 0, hash1(i) * 6); W.scene.add(m); }
      return { H, bride, ck, doorX: 3.0, doorZ: H.Z0 + 0.1 };
    },
    update(W, c) {
      standAt(c.bride, 0, -5.6, 0); face(c.bride, 'open', 'sad', 'frown', { headPitch: -0.05 });
      const ch = c.bride.chestPos(); c.ck.position.set(ch.x, ch.y - 0.33, ch.z + 0.32); c.ck.rotation.set(0, 0, 0);
      c.bride.p.gripL = { prop: c.ck, which: 'L' }; c.bride.p.gripR = { prop: c.ck, which: 'R' };
    },
    cam: () => camAt([0.9, 1.75, 1.6], [0.9, 2.0, -8.0], 50),
    anchors: (W, c) => ({ door: V(c.doorX, 0.3, c.doorZ) }),
    still: 0.5,
  },
});
