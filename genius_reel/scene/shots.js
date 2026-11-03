// The 26 shots of the genius reel as code-made low-poly 3D animations (one entry per shot; every shot is a clip).
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
const BX = S.BED.x0, TX = S.TV.x0, SX = S.STAD.x0, NX = S.NEWS.x0, STX = S.STREET.x0, TFX = S.TRAF.x0;
const PAD = S.CITY.pad;
const butt = (ch) => ch._w(V(0, -0.02, -0.13), ch.pelvis);                 // pelvis-local point behind the hips
// he has no clothes (plain mannequin, no details): his hips are always covered by the pixel mosaic, front and back
const hips = (ch, r = 0.22) => [{ p: ch._w(V(0, -0.04, 0.0), ch.pelvis), r }];
const cheeks = (ch) => { const m = ch.mouthPos(); return m; };
// squat: hips down (no chair: the seat pose lowered), leaning forward, hands on the knees
const squat = (ch, x, z, rotY, k = 1) => {
  Object.assign(ch.p, { sit: k > 0.5 ? 1 : 0, pos: [x, z], rotY, lean: 0.3 * k });
  ch.p.y = k > 0.5 ? -0.16 : 0;
  if (k > 0.5) { ch.p.handL = rel(ch, 0.38, 0.13, 0.36); ch.p.handR = rel(ch, 0.38, -0.13, 0.36); ch.p.handPoseL = ch.p.handPoseR = 'flat'; }
};
const armsCrossed = (ch) => {
  const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x), c = ch.chestPos();
  const at = (f, l, dy) => [c.x + F.x * f + L.x * l, c.y + dy, c.z + F.z * f + L.z * l];
  ch.p.handR = at(0.16, 0.13, -0.1); ch.p.handL = at(0.2, -0.13, -0.06);
  ch.p.handPoseL = ch.p.handPoseR = 'flat';
  ch.p.handRotR = handRot([L.x, 0.1, L.z], [F.x, 0.3, F.z]); ch.p.handRotL = handRot([-L.x, 0.1, -L.z], [F.x, 0.3, F.z]);
};
const handsOnCheeks = (ch) => {
  const l = hl(ch, 0.09, -0.04, 0.04), r = hl(ch, -0.09, -0.04, 0.04);
  ch.p.handL = P3(l); ch.p.handR = P3(r); ch.p.handPoseL = ch.p.handPoseR = 'flat';
};
const armsUp = (ch, k = 1, wob = 0) => { const h = ch.headPos(); ch.p.handL = rel(ch, 0.1, 0.35, h.y + 0.25 + 0.05 * wob); ch.p.handR = rel(ch, 0.1, -0.35, h.y + 0.25 - 0.05 * wob); ch.p.handPoseL = ch.p.handPoseR = 'open'; };
function room(W, { sky = 0xf4f8ff, ground = 0x9a8a7a, hemi = 0.85, keyI = 1.0, bg = '#2a2a34' } = {}) {
  S.lights(W, { sky, ground, hemi, key: 0xfff4e8, keyI });
  W.scene.background = new THREE.Color(bg);
}
function bedroom(W) { room(W); S.keyAt(W, [BX, 1, 0], { from: [2, 5, 3], size: 4 }); return { B: S.buildBedroom(W) }; }
function studio(W) { room(W, { hemi: 0.9, keyI: 0.8 }); S.keyAt(W, [TX, 1, 0], { from: [2, 6, 5], size: 6 }); return { T: S.buildTVStudio(W) }; }
function stadium(W) {
  S.lights(W, { sky: 0xa8b8e0, ground: 0x3a4a3a, hemi: 0.85, key: 0xf4f4ff, keyI: 2.0 });
  S.keyAt(W, [SX, 0, 0], { from: [10, 30, 14], size: 30 });
  S.skyDome(W, 'night', [SX, 0, 0]);
  W.scene.fog = new THREE.Fog('#0a1024', 60, 140);
  return { St: S.buildStadium(W) };
}
function city(W, o = {}) {
  S.lights(W, { sky: 0xffd8b8, ground: 0x8a8a9a, hemi: 1.15, key: 0xffb878, keyI: 2.6 });
  S.keyAt(W, [0, 30, 0], { from: [60, 50, 80], size: 120 });
  S.skyDome(W, 'sunset', [0, 0, 0]); W.scene.children.filter((c) => c.geometry && c.geometry.type === 'SphereGeometry').forEach((s) => s.scale.setScalar(4));
  W.scene.fog = new THREE.Fog('#f0a888', 120, 380);
  return { C: S.buildCity(W, o) };
}
// the helicopter at a world spot; local helpers to place people in its cabin (nose = +z, the open door = +x)
function heli(W, pos, rotY = 0) { const H = S.helicopter(W.scene); H.position.set(...pos); H.rotation.y = rotY; H.updateMatrixWorld(true); return H; }
const hw = (H, x, y, z) => H.localToWorld(V(x, y, z));
const popKeys = (lt, a, b) => smooth(clamp((lt - a) / (b - a)));

// ------------------------------------------------------------------ the shots
export const SHOTS = {
  // 01 "Being a genius content creator," the bedroom: desk, ring light, phone on its tripod, a blank notebook.
  //    A tumbleweed rolls across the floor.
  1: {
    build(W) { const c = bedroom(W); c.you = person(W, 'you'); c.tw = S.tumbleweed(W.scene, 1.2); return c; },
    update(W, c, lt) {
      sitAt(c.you, BX + S.BED.seat[0], S.BED.seat[1], 0); face(c.you, 'open', 'neutral', 'neutral', { headPitch: -0.45 });
      c.you.p.handL = [BX + 0.18, 0.79, 0.05]; c.you.p.handR = [BX - 0.18, 0.79, 0.05]; c.you.p.handPoseL = c.you.p.handPoseR = 'flat';
      const x = lerp(-2.6, 2.6, lt / 1.9); c.tw.position.set(BX + x, 0.17 + 0.05 * Math.abs(Math.sin(lt * 6)), 0.95); c.tw.rotation.set(0, 0, -x / 0.17);
    },
    cam: (W, c, lt) => camAt([BX + 1.55, 1.35, 2.6 - lt * 0.1], [BX - 0.05, 0.85, 0.1], 50),
    mosaic: (W, c) => hips(c.you),
    still: 0.5,
  },
  // 02 "you run out of ideas." he scratches his head; the idea bulb above him flickers and goes out
  2: {
    build(W) { const c = bedroom(W); c.you = person(W, 'you'); c.bulb = S.ideaBulb(W.scene); return c; },
    update(W, c, lt) {
      sitAt(c.you, BX + S.BED.seat[0], S.BED.seat[1], 0); face(c.you, 'open', 'worried', 'tight', { headPitch: 0.05, headRoll: 0.08 });
      const h = c.you.headPos(); c.you.p.handR = [h.x - 0.06, h.y + 0.12 + 0.02 * Math.sin(lt * 26), h.z + 0.02]; c.you.p.handPoseR = 'relaxed';
      const on = lt < 0.55 || (lt > 0.62 && lt < 0.7) || (lt > 0.78 && lt < 0.84);
      c.bulb.userData.set(on);
    },
    after(W, c) { const h = c.you.headPos(); c.bulb.position.set(h.x, h.y + 0.42, h.z); },
    cam: (W, c) => headCam(c.you, 1.05, 0.05, 0.05, 0.16, 44),
    mosaic: (W, c) => hips(c.you),
    still: 0.3,
  },
  // 03 "So you go live…" the phone screen turns into a red LIVE badge
  3: {
    build: (W) => bedroom(W),
    update(W, c, lt) { c.B.tripod.userData.draw(0, lt > 0.45); },
    cam: (W, c, lt) => camAt([BX + 0.05, 1.47, S.BED.phone[1] - 0.32 + lt * 0.04], [BX + 0.05, 1.47, S.BED.phone[1]], 34),
    still: 0.7,
  },
  // 04 "and just poop." he turns his back to the phone and squats: PLOP (mosaic on him and on the blob)
  4: {
    build(W) { const c = bedroom(W); c.you = person(W, 'you'); c.bl = S.blob(W.scene); return c; },
    update(W, c, lt) {
      const turn = smooth(clamp(lt / 0.35)), sq = smooth(clamp((lt - 0.35) / 0.25));
      const x = BX + 0.85, z = 0.55;
      if (sq < 0.5) { standAt(c.you, x, z, Math.PI * turn); c.you.p.handL = null; c.you.p.handR = null; }
      else squat(c.you, x, z, Math.PI, 1);
      face(c.you, 'open', 'raised', 'smile');
      const drop = clamp((lt - 0.85) / 0.25);
      c.bl.visible = lt > 0.85; c.bl.position.set(x, lerp(0.32, 0.06, easeIn(drop)), z + 0.12);
    },
    cam: () => camAt([BX + 0.95, 1.2, 2.35], [BX + 0.85, 0.72, 0.5], 50),
    mosaic: (W, c, lt) => [...hips(c.you), ...(lt > 0.4 ? [{ p: butt(c.you), r: 0.22 }] : []), ...(c.bl.visible ? [{ p: c.bl.position, r: 0.09 }] : [])],
    still: 0.85,
  },
  // 05 "A thousand views." the phone: the counter ticks up to 1,000
  5: {
    build: (W) => bedroom(W),
    update(W, c, lt) { c.B.tripod.userData.draw(null, true, lt); },
    cam: (W, c, lt) => camAt([BX + 0.05, 1.47, S.BED.phone[1] - 0.3], [BX + 0.05, 1.47, S.BED.phone[1]], 34),
    still: 0.9,
  },
  // 06 "Not bad. But not enough." he looks at the phone, nods... then shrugs
  6: {
    build(W) { const c = bedroom(W); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      standAt(c.you, BX + 0.6, 0.35, 0.25);
      const shrug = smooth(clamp((lt - 1.45) / 0.25));
      face(c.you, 'open', shrug > 0.5 ? 'raised' : 'neutral', shrug > 0.5 ? 'frown' : 'smile', { headPitch: shrug > 0.5 ? 0 : 0.08 * Math.sin(lt * 9), shoulderUp: shrug });
      if (shrug > 0.05) { c.you.p.handL = rel(c.you, 0.25, 0.42, 1.0 + 0.1 * shrug); c.you.p.handR = rel(c.you, 0.25, -0.42, 1.0 + 0.1 * shrug); c.you.p.handPoseL = c.you.p.handPoseR = 'open'; }
    },
    cam: (W, c) => headCam(c.you, 1.6, -0.25, -0.15, -0.3, 46),
    mosaic: (W, c) => hips(c.you),
    still: 0.85,
  },
  // 07 "So you poop live on a" bright TV studio: the presenter smiles on the sofa; YOU squats next to the sofa
  7: {
    build(W) { const c = studio(W); c.pr = person(W, 'presenter'); c.you = person(W, 'you'); return c; },
    update(W, c, lt) {
      sitAt(c.pr, TX - 0.45, -0.55, 0.15); face(c.pr, 'happy', 'raised', 'grin'); helpers.talk(c.pr, lt, 0.7);
      c.pr.p.handR = rel(c.pr, 0.3, -0.25, 0.7 + 0.08 * Math.sin(lt * 5)); c.pr.p.handPoseR = 'open';
      squat(c.you, TX + 1.55, -0.65, -Math.PI / 2 + 0.25); face(c.you, 'open', 'raised', 'smile', { lookAt: [TX + 4, 1.4, 3] });
    },
    cam: (W, c, lt) => camAt([TX + 2.6 - lt * 0.15, 1.5, 3.4], [TX + 0.35, 0.85, -0.6], 50),
    mosaic: (W, c) => [...hips(c.you), { p: butt(c.you), r: 0.24 }],
    still: 0.6,
  },
  // 08 "TV show." the presenter's smile drops
  8: {
    build(W) { const c = studio(W); c.pr = person(W, 'presenter'); return c; },
    update(W, c, lt) {
      sitAt(c.pr, TX - 0.45, -0.55, 0.15);
      const d = smooth(clamp((lt - 0.2) / 0.3));
      face(c.pr, d > 0.5 ? 'wide' : 'happy', d > 0.5 ? 'worried' : 'raised', d > 0.5 ? 'frown' : 'grin', { pupils: [d > 0.5 ? -0.9 : 0, 0], headYaw: -0.25 * d });
    },
    cam: (W, c) => headCam(c.pr, 0.7, -0.05, 0.05, -0.02, 40),
    still: 0.8,
  },
  // 09 "A million views." the studio audience gasps
  9: {
    build(W) { const c = studio(W); c.au = []; for (let i = 0; i < 14; i++) c.au.push(person(W, `crowd${i}`)); return c; },
    update(W, c, lt) {
      c.au.forEach((ch, i) => {
        const row = Math.floor(i / 5), col = i % 5;
        sitAt(ch, TX - 2.2 + col * 1.1 + (row % 2) * 0.5, 4.0 + row * 0.8, Math.PI); ch.p.y = 0.45 * row;
        const g = smooth(clamp((lt - 0.1 - (i % 3) * 0.06) / 0.2));
        face(ch, g > 0.5 ? 'wide' : 'open', g > 0.5 ? 'raised' : 'neutral', g > 0.5 ? 'o' : 'smile', { lean: -0.15 * g });
        if (g > 0.3) handsOnCheeks(ch);
      });
    },
    cam: (W, c, lt) => camAt([TX + 0.2, 1.25, 1.3 - lt * 0.2], [TX, 1.15, 4.8], 54),
    still: 0.7,
  },
  // 10 "Then on the stadium" a giant stadium at night: his blurred squat on the huge big screen
  10: {
    build(W) {
      const c = stadium(W); c.St.setHeads(0.2);
      // the clip on the big screen: a little set far away, rendered into the screen's texture
      c.sub = new THREE.Scene(); c.sub.background = new THREE.Color('#9ab8e8');
      c.sub.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.4)); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(2, 4, 3); c.sub.add(dl);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c89a62' })); c.sub.add(fl);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({ color: '#9ab8e8' })); wall.position.set(0, 2.5, -2); c.sub.add(wall);
      c.you = person(W, 'you'); c.sub.add(c.you.root);
      c.subCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 50); c.subCam.position.set(0.3, 1.0, 2.2); c.subCam.lookAt(0, 0.65, 0);
      return c;
    },
    update(W, c, lt) { squat(c.you, 0, 0, Math.PI); face(c.you, 'open', 'raised', 'smile'); c.St.setHeads(0.2 + lt * 0.3, lt); },
    // (the squat on the big screen is seen from behind: the sub camera is on his back side)
    after(W, c) { c.subCam.updateMatrixWorld(true); W.renderer.setRenderTarget(c.St.rt); W.renderer.render(c.sub, c.subCam); W.renderer.setRenderTarget(null); },
    cam: (W, c, lt) => camAt([SX + 2.5, 1.6, 9.5 - lt * 0.8], [SX, 9.5, -24], 52),
    mosaic: (W, c) => {
      const b = butt(c.you).lerp(c.you._w(V(0, -0.04, 0), c.you.pelvis), 0.4), q = b.clone().project(c.subCam), r = b.clone().add(V(0.3, 0, 0)).project(c.subCam);
      const p = c.St.screen.localToWorld(V(q.x * S.STAD.screenW / 2, q.y * S.STAD.screenH / 2, 0.05));
      return [{ p, r: Math.abs(r.x - q.x) * S.STAD.screenW / 2 }];
    },
    still: 0.6,
  },
  // 11 "big screen." a football player stops mid-kick and stares up at the screen
  11: {
    build(W) { const c = stadium(W); c.pl = person(W, 'player'); c.St.setHeads(0.5); const l = new THREE.PointLight(0xfff0e0, 12, 6, 1.6); l.position.set(SX + 1.8, 1.6, 0.2); W.scene.add(l); return c; },
    update(W, c, lt) {
      standAt(c.pl, SX + 1.5, 2.0, Math.PI - 0.15); c.pl.p.walk = 1.3; face(c.pl, 'wide', 'raised', 'o', { headPitch: 0.45, lean: -0.15 });
      c.pl.p.handL = rel(c.pl, 0.1, 0.55, 1.15); c.pl.p.handR = rel(c.pl, 0.1, -0.55, 1.2); c.pl.p.handPoseL = c.pl.p.handPoseR = 'open';
      c.St.ball.position.set(SX + 1.5 + 0.1, 0.11, 2.0 - 0.45);
    },
    cam: (W, c) => { const h = c.pl.headPos(); return camAt([h.x + 0.6, 0.9, h.z - 2.4], [h.x, h.y - 0.35, h.z], 46); },
    still: 0.6,
  },
  // 12 "Fifty million." the stands: thousands of fans turn their heads to the big screen
  12: {
    build: (W) => stadium(W),
    update(W, c, lt) { c.St.setHeads(clamp(lt / 0.8), lt); },
    cam: (W, c, lt) => camAt([SX - 4 + lt * 0.6, 3.5, 6], [SX + 4, 7.5, 18], 56),
    still: 0.9,
  },
  // 13 "Still not enough." YOU on the pitch, arms crossed, determined (low angle)
  13: {
    build(W) { const c = stadium(W); c.you = person(W, 'you'); c.St.setHeads(1); const l = new THREE.PointLight(0xfff0e0, 14, 6, 1.6); l.position.set(SX - 0.6, 1.4, 1.2); W.scene.add(l); return c; },
    update(W, c) { standAt(c.you, SX, 3, Math.PI - 0.2); face(c.you, 'squint', 'angry', 'tight', { chestPuff: 0.6, headPitch: 0.1 }); armsCrossed(c.you); },
    cam: (W, c, lt) => { const h = c.you.headPos(); return camAt([h.x - 0.35, 0.35, h.z - 1.55 + lt * 0.1], [h.x, h.y - 0.1, h.z], 52); },
    mosaic: (W, c) => hips(c.you, 0.24),
    still: 0.6,
  },
  // 14 "So you rent" the rooftop helipad: YOU climbs into the helicopter
  14: {
    build(W) { const c = city(W); c.H = heli(W, PAD, Math.PI / 2); c.you = person(W, 'you'); c.pi = person(W, 'pilot'); return c; },
    update(W, c, lt) {
      c.H.userData.spin(lt * 0.35);
      const d = hw(c.H, 1.25, 0, 0.1); standAt(c.you, d.x, d.z, Math.PI / 2 + Math.PI / 2 + Math.PI); c.you.p.y = PAD[1] + 0.1;
      c.you.p.rotY = Math.PI / 2 - Math.PI / 2 - Math.PI / 2; face(c.you, 'happy', 'raised', 'grin');
      const hd = hw(c.H, 0.85, 1.6, 0.4); c.you.p.handL = P3(hd); c.you.p.handPoseL = 'grip';
      const s = hw(c.H, 0.4, 0, 0.55); sitAt(c.pi, s.x, s.z, Math.PI / 2); c.pi.p.y = PAD[1] + 0.12; face(c.pi, 'open', 'worried', 'frown', { lookAt: P3(c.you.headPos()) });
    },
    cam: (W, c) => { const p = hw(c.H, 4.2, 1.7, 3.2), t = hw(c.H, 0.6, 1.15, 0.3); return camAt(P3(p), P3(t), 52); },
    mosaic: (W, c) => hips(c.you),
    still: 0.6,
  },
  // 15 "a helicopter." the pilot (headset, sunglasses) looks at him with dread
  15: {
    build(W) { const c = city(W); c.H = heli(W, PAD, Math.PI / 2); c.pi = person(W, 'pilot'); return c; },
    update(W, c, lt) {
      c.H.userData.spin(lt * 0.35);
      const s = hw(c.H, 0.4, 0, 0.55); sitAt(c.pi, s.x, s.z, Math.PI / 2); c.pi.p.y = PAD[1] + 0.12;
      face(c.pi, 'open', 'worried', lt > 0.35 && lt < 0.5 ? 'tight' : 'frown', { headYaw: 0.9, shoulderUp: lt > 0.35 ? 0.6 : 0 });
    },
    cam: (W, c) => { const h = c.pi.headPos(); const p = hw(c.H, 1.25, 1.45, 0.45); return camAt(P3(p), [h.x, h.y - 0.03, h.z], 40); },
    still: 0.6,
  },
  // 16 "Fly over the whole city." FWOOSH: the helicopter flies past over the skyline at sunset
  16: {
    build(W) { const c = city(W); c.H = heli(W, [0, 70, 0]); c.pi = person(W, 'pilot'); return c; },
    update(W, c, lt) {
      c.H.position.set(lerp(-16, 16, lt / 1.75), 68 + 1.5 * Math.sin(lt * 1.5), 22); c.H.rotation.set(0.08, Math.PI / 2, -0.12); c.H.updateMatrixWorld(true); c.H.userData.spin(lt);
      const s = hw(c.H, 0.4, 0, 0.55); sitAt(c.pi, s.x, s.z, Math.PI); c.pi.p.y = c.H.position.y + 0.12;
    },
    cam: (W, c, lt) => camAt([-1, 66.5, 36], [c.H.position.x * 0.7, 68.3, 22], 60),
    still: 0.5,
  },
  // 17 "And do the world's first" from behind: YOU squats at the open door, high over the city (mosaic)
  17: {
    build(W) { const c = city(W); c.H = heli(W, [0, 90, 0]); c.you = person(W, 'you'); const l = new THREE.PointLight(0xfff0e0, 8, 4, 1.5); l.position.copy(hw(c.H, -0.3, 1.8, -0.3)); W.scene.add(l); return c; },
    update(W, c, lt) {
      c.H.userData.spin(lt);
      const d = hw(c.H, 0.5, 0, 0.0); squat(c.you, d.x, d.z, Math.PI / 2); c.you.p.y = 90 + 0.58 - 0.16;
      face(c.you, 'happy', 'raised', 'grin');
    },
    cam: (W, c, lt) => { const p = hw(c.H, -0.6, 1.75, -0.4 + lt * 0.05), t = hw(c.H, 3.5, -0.2, 0.15); return camAt(P3(p), P3(t), 62); },
    mosaic: (W, c) => [...hips(c.you), { p: butt(c.you), r: 0.26 }],
    still: 0.5,
  },
  // 18 "poop drop." slow motion: the small brown blob falls toward the city (mosaic)
  18: {
    build(W) { const c = city(W); c.bl = S.blob(W.scene, 3); return c; },
    update(W, c, lt) { c.bl.position.set(6, 85 - lt * 6, 4); c.bl.rotation.set(lt * 1.5, lt * 2, 0); },
    cam: (W, c, lt) => { const b = c.bl.position; return camAt([b.x + 2.2, b.y + 1.2, b.z + 3.2], [b.x, b.y - 0.8, b.z], 55); },
    mosaic: (W, c) => [{ p: c.bl.position, r: 0.32 }],
    still: 0.5,
  },
  // 19 "People open umbrellas." a busy street: everyone opens an umbrella at once; blobs bounce off. SPLAT!
  19: {
    build(W) {
      room(W, { sky: 0xffd8b8, keyI: 1.6, bg: '#e8a888' }); S.keyAt(W, [STX + 4, 0, -4], { from: [10, 18, 10], size: 14 });
      S.skyDome(W, 'sunset', [STX, 0, 0]);
      const c = { Sx: S.buildStreet(W), ppl: [], um: [], bl: [], sp: [] };
      const cols = ['#e8402a', '#2a8ad8', '#f2d030', '#3ab04a', '#e84a9a', '#8a4ad8', '#f2a01e', '#20b0b0', '#ffffff', '#f26a4a'];
      for (let i = 0; i < 10; i++) { c.ppl.push(person(W, `crowd${i + 20}`)); c.um.push(S.umbrella(W.scene, cols[i])); }
      for (let i = 0; i < 3; i++) c.bl.push(S.blob(W.scene, 1.6));
      return c;
    },
    update(W, c, lt) {
      const open = smooth(clamp((lt - 0.15) / 0.25));
      c.ppl.forEach((ch, i) => {
        const x = STX + 3.6 + (i % 3) * 0.9 + (Math.floor(i / 3) % 2) * 0.4, z = 2 - Math.floor(i / 3) * 1.6 - (i % 3) * 0.25;
        standAt(ch, x, z, Math.PI / 2 + Math.PI + (hash1(i) - 0.5) * 0.8); ch.p.y = 0.15; face(ch, open > 0.5 ? 'wide' : 'open', 'raised', open > 0.5 ? 'o' : 'smile', { headPitch: 0.35 * open });
        const hp = rel(ch, 0.25, -0.05, 1.25); c.um[i].position.set(...hp); c.um[i].rotation.set(0, 0, 0); c.um[i].userData.open(open); ch.p.gripR = c.um[i];
      });
      c.bl.forEach((b, k) => {
        const tgt = c.um[[1, 4, 7][k]].userData.top(), t0 = 0.45 + k * 0.22, q = lt - t0;
        b.visible = q > -0.5;
        if (q < 0) b.position.set(tgt.x, tgt.y + 0.35 - q * 6, tgt.z);
        else { b.position.set(tgt.x + q * 1.2, tgt.y + 0.35 + 3.2 * q - 9 * q * q, tgt.z + q * 0.6); }
      });
    },
    cam: (W, c, lt) => camAt([STX + 1.3, 1.65, 4.6 - lt * 0.2], [STX + 4.3, 1.55, -0.6], 56),
    mosaic: (W, c) => c.bl.filter((b) => b.visible).map((b) => ({ p: b.position, r: 0.16 })),
    still: 0.62,
  },
  // 20 "Cars turn on their wipers." a traffic jam: every car's wipers swish at once. THWAP! THWAP!
  20: {
    build(W) {
      room(W, { sky: 0xffd8b8, keyI: 1.8, bg: '#e8a888' }); S.keyAt(W, [TFX, 0, -10], { from: [10, 18, 10], size: 22 });
      S.skyDome(W, 'sunset', [TFX, 0, -20]);
      const c = { T: S.buildTraffic(W), sp: [] };
      for (const k of [0, 4, 10, 13, 19]) { const car = c.T.cars[k]; const s = S.splat(car, 1.3, k); s.position.set(0.0, 1.12, 1.0); s.rotation.x = -0.9 + Math.PI; c.sp.push(s); }
      return c;
    },
    update(W, c, lt) { c.T.cars.forEach((car, i) => car.userData.wipers.forEach((wp, k) => { wp.rotation.z = (k ? 1 : 1) * (0.2 + 1.1 * Math.abs(Math.sin(lt * 5.2 + i * 0.05))) * (k ? 1 : 1); })); },
    cam: (W, c, lt) => camAt([TFX - 1.2, 1.55, 9.0 - lt * 0.4], [TFX + 0.2, 1.0, -6], 52),
    mosaic: (W, c) => c.sp.map((s) => ({ p: s.getWorldPosition(V()), r: 0.3 })),
    still: 0.5,
  },
  // 21 "A news anchor gets hit" the calm anchor reads the news; a blob flies in through the window behind her
  21: {
    build(W) { room(W, { hemi: 0.8, keyI: 0.7 }); S.keyAt(W, [NX, 1, -0.5], { from: [2, 5, 4], size: 4 }); const c = { N: S.buildNews(W) }; c.an = person(W, 'anchor'); c.bl = S.blob(W.scene, 1.2); return c; },
    update(W, c, lt) {
      sitAt(c.an, NX + S.NEWS.seat[0], S.NEWS.seat[1], 0); face(c.an, 'open', 'neutral', 'neutral', { headPitch: -0.05 }); helpers.talk(c.an, lt, 0.7);
      c.an.p.handL = [NX + 0.12, 0.8, 0.08]; c.an.p.handR = [NX - 0.12, 0.8, 0.08]; c.an.p.handPoseL = c.an.p.handPoseR = 'flat';
      const k = clamp((lt - 0.35) / 0.65); c.bl.visible = lt > 0.35;
      c.bl.position.set(NX + lerp(0.5, 0.2, k), lerp(2.2, 1.5, k) + Math.sin(k * Math.PI) * 0.3, lerp(-3.5, -0.55, k));
    },
    cam: (W, c, lt) => camAt([NX + 0.25, 1.35, 1.9 - lt * 0.2], [NX, 1.35, -0.8], 50),
    mosaic: (W, c) => (c.bl.visible ? [{ p: c.bl.position, r: 0.12 }] : []),
    still: 0.75,
  },
  // 22 "live on air." SPLAT! right on her shoulder (mosaic)
  22: {
    build(W) { room(W, { hemi: 0.8, keyI: 0.7 }); S.keyAt(W, [NX, 1, -0.5], { from: [2, 5, 4], size: 4 }); const c = { N: S.buildNews(W) }; c.an = person(W, 'anchor'); c.sp = S.splat(W.scene, 0.45, 3); return c; },
    update(W, c, lt) { sitAt(c.an, NX, S.NEWS.seat[1], 0); face(c.an, lt > 0.08 ? 'squint' : 'open', 'neutral', 'neutral', { headRoll: lt > 0.08 && lt < 0.25 ? 0.12 : 0 }); helpers.talk(c.an, lt, 0.7); c.an.p.handL = [NX + 0.12, 0.8, 0.08]; c.an.p.handR = [NX - 0.12, 0.8, 0.08]; c.an.p.handPoseL = c.an.p.handPoseR = 'flat'; },
    after(W, c, lt) { const p = c.an._w(V(c.an.shoulderW * 0.95, c.an.torsoH * 0.9, 0.0), c.an.chest); c.sp.position.copy(p); c.sp.visible = lt > 0.08; c.sp.scale.setScalar(lt > 0.08 ? Math.min(1, 0.4 + (lt - 0.08) * 8) : 0.01); },
    cam: (W, c) => headCam(c.an, 1.1, -0.2, 0.05, -0.18, 42),
    mosaic: (W, c) => (c.sp.visible ? [{ p: c.sp.position, r: 0.065 }] : []),
    still: 0.6,
  },
  // 23 "She doesn't stop reading the news." totally calm, the mosaic splat on her shoulder
  23: {
    build(W) { room(W, { hemi: 0.8, keyI: 0.7 }); S.keyAt(W, [NX, 1, -0.5], { from: [2, 5, 4], size: 4 }); const c = { N: S.buildNews(W) }; c.an = person(W, 'anchor'); c.sp = S.splat(W.scene, 0.45, 3); return c; },
    update(W, c, lt) { sitAt(c.an, NX, S.NEWS.seat[1], 0); face(c.an, 'open', 'neutral', 'neutral'); helpers.talk(c.an, lt, 0.8); helpers.blink(c.an, lt); c.an.p.handL = [NX + 0.12, 0.8, 0.08]; c.an.p.handR = [NX - 0.12, 0.8, 0.08]; c.an.p.handPoseL = c.an.p.handPoseR = 'flat'; },
    after(W, c) { c.sp.position.copy(c.an._w(V(c.an.shoulderW * 0.95, c.an.torsoH * 0.9, 0.0), c.an.chest)); },
    cam: (W, c, lt) => { const a = headCam(c.an, 1.25, -0.3, -0.25, -0.22, 42), b = headCam(c.an, 0.95, -0.22, -0.2, -0.16, 42); return camLerp(a, b, lt / 2.2); },
    mosaic: (W, c) => [{ p: c.sp.position, r: 0.065 }],
    still: 0.5,
  },
  // 24 "Professional." ECU: one slow blink
  24: {
    build(W) { room(W, { hemi: 0.8, keyI: 0.7 }); S.keyAt(W, [NX, 1, -0.5], { from: [2, 5, 4], size: 4 }); const c = { N: S.buildNews(W) }; c.an = person(W, 'anchor'); return c; },
    update(W, c, lt) { sitAt(c.an, NX, S.NEWS.seat[1], 0); face(c.an, lt > 0.35 && lt < 0.75 ? 'closed' : 'open', 'neutral', 'neutral'); },
    cam: (W, c) => { const e = hl(c.an, 0, 0.0, 0.09); const p = hl(c.an, 0, -0.01, 0.42); return camAt(P3(p), P3(e), 36); },
    still: 0.2,
  },
  // 25 "One billion views." in the helicopter: YOU stares at his phone, jaw drops... grin
  25: {
    build(W) { const c = city(W); c.H = heli(W, [0, 90, 0]); c.you = person(W, 'you'); c.ph = S.phoneProp(W.scene); return c; },
    update(W, c, lt) {
      c.H.userData.spin(lt);
      const s = hw(c.H, 0, 0, -0.8); sitAt(c.you, s.x, s.z, 0); c.you.p.y = 90 + 0.13;
      const k = lt > 0.5; face(c.you, 'wide', 'raised', k ? 'grin' : 'yell', { headPitch: -0.25 });
      const p = rel(c.you, 0.3, 0, 90 + 1.05); c.ph.position.set(...p); c.ph.rotation.set(-0.5, Math.PI, 0); c.you.p.gripR = c.ph;
      c.you.p.handL = rel(c.you, 0.28, 0.08, 90 + 1.0); c.you.p.handPoseL = 'flat';
    },
    cam: (W, c) => headCam(c.you, 0.75, -0.1, 0.12, -0.12, 46),
    mosaic: (W, c) => hips(c.you),
    still: 0.7,
  },
  // 26 "You're a fucking genius." YOU in the open door, arms up like a hero, over the city covered in mosaic splats
  26: {
    build(W) { const c = city(W, { splats: 70 }); c.H = heli(W, [0, 80, 0], 0.2); c.you = person(W, 'you'); c.pi = person(W, 'pilot'); return c; },
    update(W, c, lt) {
      c.H.position.y = 80 + 0.4 * Math.sin(lt * 1.6); c.H.updateMatrixWorld(true); c.H.userData.spin(lt);
      const d = hw(c.H, 0.62, 0, 0.05); standAt(c.you, d.x, d.z, Math.PI / 2 + 0.2); c.you.p.y = c.H.position.y + 0.58;
      face(c.you, 'happy', 'raised', 'grin', { chestPuff: 0.8, headPitch: 0.15 }); armsUp(c.you, 1, Math.sin(lt * 3));
      const s = hw(c.H, 0.4, 0, 0.55); sitAt(c.pi, s.x, s.z, 0.2); c.pi.p.y = c.H.position.y + 0.12; face(c.pi, 'open', 'worried', 'frown');
    },
    cam: (W, c, lt) => { const k = lt / 2.9; const p = hw(c.H, 5.5 + k * 3, 0.3 + k * 2.5, 2.2 + k * 2), t = hw(c.H, 0.4, 0.9 - k * 0.6, 0.0); return camAt(P3(p), P3(t), 50 + k * 8); },
    mosaic: (W, c) => hips(c.you, 0.26),
    still: 0.5,
  },
};
