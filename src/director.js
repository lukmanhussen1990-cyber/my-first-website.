// The director: time (seconds) -> camera, actors, lights, passes and post settings.
// Everything is a pure function of t, so any frame can be rendered in any order.
import * as THREE from 'three';
import { applyPose, armIK } from './world/characters.js';
import { dancePose, quantize, tapAngle } from './world/dance.js';
import { LAYOUT, STREET } from './world/world.js';
import { lerp, easeInOut, easeOut, easeIn, range, noise1, hash1 } from './world/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, t) => a.clone().lerp(b, t);

// Fixed staging spots
const SPOT = {
  mop: V(0.35, 0, 1.35),
  window: V(-0.3, 0, 3.8),
  door: V(3.32, 0, 4.47),
  backOff: V(2.6, 0, 3.75),
  hide: V(-1.35, 0, -1.76),
  fridgeStand: V(-1.4, 0, -2.25),
  herLamp: STREET.spotUnderLamp.clone(),
  herRoad: V(-0.7, 0, 14.0),
  herGlass: V(0.95, 0.15, 5.3),
  herBehind: V(-1.14, 0, -1.84),
};
const GLASS_Z = LAYOUT.frontZ;

export class Director {
  constructor(world, timeline) {
    this.w = world;
    this.tl = timeline;
    this.cues = timeline.cues;
    this.scenes = timeline.scenes;
    this.cam = world.camera;
  }

  sceneAt(t) {
    for (const s of this.scenes) if (t < s.end) return s;
    return this.scenes[this.scenes.length - 1];
  }

  // ---------------- helpers ----------------
  setCam(pos, look, fov, roll = 0) {
    const c = this.cam;
    c.position.copy(pos);
    c.up.set(0, 1, 0);
    c.lookAt(look);
    if (roll) c.rotateZ(roll);
    c.fov = fov;
    c.updateProjectionMatrix();
  }

  // gentle handheld breathing for POV shots
  breathe(t, amt = 1) {
    const c = this.cam;
    c.rotateX(amt * (0.006 * Math.sin(t * 1.6) + 0.002 * noise1(t * 0.9, 11)));
    c.rotateY(amt * 0.004 * noise1(t * 0.7, 12));
    c.rotateZ(amt * 0.003 * Math.sin(t * 1.3 + 1.0));
    c.position.y += amt * 0.006 * Math.sin(t * 1.6 + 0.4);
  }

  // scare: violent shake decaying in ~0.7 s
  shake(t, t0, amp = 1) {
    if (t < t0) return 0;
    const k = Math.exp(-(t - t0) * 5.2) * amp;
    const c = this.cam;
    c.rotateX(k * 0.03 * noise1(t * 30, 21));
    c.rotateY(k * 0.03 * noise1(t * 27, 22));
    c.rotateZ(k * 0.022 * noise1(t * 23, 23));
    return k;
  }

  caAt(t, t0) {
    if (t < t0) return 0;
    return 0.014 * Math.exp(-(t - t0) * 4.0);
  }

  placeHer({ pos, rotY = Math.PI, t, mode = 'free', amp = 1, armAmp = 1, look = null, outside = true }) {
    const her = this.w.her;
    her.root.visible = true;
    const tq = quantize(t);
    const d = dancePose(tq, this.tl.danceSteps, { amp, armAmp, mode });
    if (mode === 'glass') {
      // leaning in until her face is on the glass
      d.pose.spine.r[0] += 0.2;
      d.pose.chest.r[0] += 0.1;
    }
    if (mode === 'ear') {
      // leaning over your right shoulder, towards your ear
      d.pose.spine.r[0] += 0.22;
      d.pose.chest.r[0] += 0.12;
      d.pose.spine.r[2] -= 0.12;
      d.pose.head.r[2] = 0.32 + 0.05 * Math.sin(d.phase * 0.5);
    }
    applyPose(her, d.pose);
    her.root.position.copy(pos);
    her.root.rotation.set(0, rotY, 0);
    her.root.translateX(d.rootX);
    her.sway.value.set(d.sway[0], d.sway[1]);
    her.settleHair(d.tilt, d.lean);
    this.w.setHerOutside(outside);
    her.root.updateMatrixWorld(true);
    if (look) her.lookAt(look);
    if (outside && look) {
      const head = her.head.localToWorld(V(0, 0, 0));
      const toCam = look.clone().sub(head).setY(0).normalize();
      this.w.herFill.position.copy(head).add(toCam.multiplyScalar(0.9)).add(V(0, 0.25, 0));
      this.w.herFill.intensity = 1.6;
    }
    return { d, tq };
  }

  hideHer() {
    this.w.her.root.visible = false;
  }

  placeBoy({ pos, rotY, pose = {}, face = {}, expr = 'neutral' }) {
    const b = this.w.boy;
    b.root.visible = true;
    b.root.position.copy(pos);
    b.root.rotation.set(0, rotY, 0);
    applyPose(b, pose);
    b.root.updateMatrixWorld(true);
    b.setExpression(expr);
    b.setFace(face);
    b.root.updateMatrixWorld(true);
  }

  boyEye() {
    const b = this.w.boy;
    b.head.updateMatrixWorld(true);
    return b.head.localToWorld(V(0, 0.022, 0.15));
  }

  blinkAt(t, seed = 0) {
    // natural blinks every ~3 s (the boy blinks, she never does)
    const period = 2.7 + hash1(Math.floor(t / 2.9) + seed) * 1.2;
    const ph = t % period;
    return ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
  }

  // mop: head on the floor at `head`, handle tilted by `tilt` towards `leanDir`
  placeMop(head, leanDir, tilt) {
    const m = this.w.mop.root;
    m.visible = true;
    m.position.copy(head);
    const axis = V(-leanDir.z, 0, leanDir.x).normalize();
    m.quaternion.setFromAxisAngle(axis, -tilt);
    m.updateMatrixWorld(true);
    return { top: m.localToWorld(V(0, 1.36, 0)), low: m.localToWorld(V(0, 0.98, 0)) };
  }

  lights(t, { interior = 1, flicker = 0, kitchen = 1, dining = 1 } = {}) {
    const R = this.w.R;
    const S = this.w.S;
    // fluorescent panels: one faulty tube near the window stutters now and then
    const faulty = (tt) => {
      const r = hash1(Math.floor(tt * 10) * 3.1);
      return r < 0.07 ? 0.15 : r < 0.12 ? 0.6 : 1;
    };
    const flick = (seed) => 1 - flicker * (hash1(Math.floor(t * 15) + seed) < 0.55 ? 0.93 : 0.05);
    for (const p of R.panels) {
      let k = interior * (p.kitchen ? kitchen : dining);
      if (p.x === 1.6 && p.z === 3.2) k *= faulty(t);
      k *= flick(p.x * 7 + p.z * 13);
      p.mat.color.copy(p.base).multiplyScalar(k);
    }
    const fk = flick(0);
    R.lights.key.intensity = R.lightBase.key * interior * fk;
    R.lights.fillDining.intensity = R.lightBase.fillDining * interior * dining * fk;
    R.lights.fillKitchen.intensity = R.lightBase.fillKitchen * interior * kitchen * fk;
    R.lights.menuGlow.intensity = R.lightBase.menuGlow;
    S.lights.spill.intensity = S.spillBase * interior * fk;
    // the one streetlight: sodium hum with random dropouts
    const r = hash1(Math.floor(t * 8) * 1.7 + 5);
    let lamp = r < 0.06 ? 0.08 : r < 0.13 ? 0.45 : 1;
    if (r >= 0.13) lamp *= 0.93 + 0.07 * Math.sin(t * 37);
    S.lights.sodium.intensity = S.sodiumBase * lamp;
    S.lampMat.color.copy(S.lampBase).multiplyScalar(0.15 + 0.85 * lamp);
    S.halo.material.opacity = 0.2 + 0.8 * lamp;
    S.lights.rim.intensity = 0;
  }

  setKeyLight(pos, target) {
    const k = this.w.R.lights.key;
    k.position.copy(pos);
    k.target.position.copy(target);
    k.target.updateMatrixWorld();
  }

  // ---------------- main ----------------
  update(t) {
    const sc = this.sceneAt(t);
    const lt = t - sc.start;
    const W = this.w;
    const st = {
      sceneId: sc.id,
      floorMirror: false,
      fridgeMirror: false,
      phone: false,
      cctv: false,
      povHideHead: false,
      menuFace: false,
      bubbleAnchor: null,
      post: { focus: 4, aperture: 0.0, maxBlur: 0, bloom: 0.55, bloomRadius: 0.45, bloomThreshold: 1.6, exposure: 0.9, ca: 0, vignette: 0.55, grain: 0.05 },
    };
    W.mop.root.visible = false;
    W.phone.root.visible = false;
    W.keys.root.visible = false;
    W.R.refs.breathFog.material.opacity = 0;
    for (const m of W.R.menu) if (m.mat.map !== m.tex) m.mat.map = m.tex;
    this.lights(t);
    this.setKeyLight(V(-0.5, 3.12, 1.4), V(-0.5, 0, 1.4));
    W.R.fridgeDoorMat.userData.refl.uReflBlur.value = 0.25;
    W.herFill.intensity = 0;
    this['shot' + sc.id](t, lt, sc, st);
    // the steel door only shows the planar mirror when that pass actually runs this frame
    // lights at zero intensity still cost shader time per pixel: take them out of the frame entirely
    W.S.lights.rim.visible = W.S.lights.rim.intensity > 0;
    W.herFill.visible = W.herFill.intensity > 0;
    // the sodium lamp cannot reach the kitchen: skip its light + shadow pass in interior-only shots
    W.S.lights.sodium.visible = ![8, 11, 12].includes(sc.id);
    const gate = (mat, on) => (mat.userData.refl.uReflStrength.value = on ? mat.userData.reflBase : 0);
    gate(W.R.fridgeDoorMat, st.fridgeMirror);
    for (const m of [W.R.floor, ...W.S.mirrorSurfaces]) gate(m.material, st.floorMirror);
    return st;
  }

  // 1. Wide: you mop the empty restaurant. Fluorescent buzz.
  shot1(t, lt, sc, st) {
    const u = easeInOut(lt / (sc.end - sc.start));
    this.setCam(vlerp(V(5.7, 2.8, 4.55), V(4.5, 2.25, 3.7), u), vlerp(V(-0.9, 0.55, -0.5), V(-0.5, 0.75, -0.2), u), 44);
    this.breathe(t, 0.4);
    // boy mopping in figure-eight strokes
    const pos = SPOT.mop;
    const face = 0.95;
    const fwd = V(Math.sin(face), 0, Math.cos(face));
    const right = V(Math.cos(face), 0, -Math.sin(face));
    const stroke = Math.sin(t * 2.4);
    const head = pos.clone().add(fwd.clone().multiplyScalar(0.62 + 0.08 * Math.sin(t * 4.8))).add(right.clone().multiplyScalar(0.36 * stroke));
    const grips = this.placeMop(head, fwd.clone().negate().add(right.clone().multiplyScalar(-0.3 * stroke)).normalize(), 0.5);
    const pose = {
      hips: { r: [0, 0.18 * stroke, 0], p: [0, -0.03, 0] },
      spine: { r: [0.2, 0.1 * stroke, 0] },
      chest: { r: [0.06, 0.08 * stroke, 0] },
      head: { r: [0.38, -0.1 * stroke, 0] },
      thighL: { r: [-0.25, 0, 0.05] },
      kneeL: { r: [0.3, 0, 0] },
      thighR: { r: [0.12, 0, -0.05] },
      kneeR: { r: [0.15, 0, 0] },
    };
    this.placeBoy({ pos, rotY: face, pose, face: { blink: this.blinkAt(t), lookAt: head }, expr: 'neutral' });
    const boy = this.w.boy;
    armIK(boy, 'R', grips.top, boy.root.localToWorld(V(-0.6, 0.6, -0.4)));
    armIK(boy, 'L', grips.low, boy.root.localToWorld(V(0.6, 0.4, -0.2)));
    this.placeHer({ pos: SPOT.herLamp, t, look: this.cam.position });
    st.floorMirror = true;
    st.post = { ...st.post, focus: 5.6, aperture: 0.035, maxBlur: 9, bloom: 0.56, exposure: 0.85 };
  }

  // 2. Over your shoulder, through the windows: someone dancing under the streetlight.
  shot2(t, lt, sc, st) {
    const u = easeInOut(lt / (sc.end - sc.start));
    this.setCam(vlerp(V(-0.6, 1.7, 2.05), V(-0.64, 1.67, 2.45), u), vlerp(V(-1.05, 1.4, 15), V(-1.12, 1.32, 15), u), lerp(36, 31, u));
    this.breathe(t, 0.6);
    const pos = SPOT.window;
    const grips = this.placeMop(pos.clone().add(V(0.3, 0, 0.2)), V(-0.3, 0, -1).normalize(), 0.12);
    this.placeBoy({ pos, rotY: -0.05, pose: { head: { r: [0.02, 0.06, 0] }, spine: { r: [0.02, 0, 0] } }, face: { blink: this.blinkAt(t, 3) }, expr: 'tense' });
    const boy = this.w.boy;
    armIK(boy, 'L', grips.top.clone().add(V(0, -0.2, 0)), boy.root.localToWorld(V(0.5, 0, -0.5)));
    this.placeHer({ pos: SPOT.herLamp, t, look: this.boyEye() });
    st.floorMirror = true;
    st.post = { ...st.post, focus: 16.5, aperture: 0.05, maxBlur: 12, bloom: 0.6, exposure: 0.9 };
  }

  // 3. Closer on her. Silence. Stiff, jerky, never blinking.
  shot3(t, lt, sc, st) {
    const u = easeInOut(lt / (sc.end - sc.start));
    const camPos = V(-0.86, 1.42, 4.6);
    this.placeHer({ pos: SPOT.herLamp, t, look: camPos });
    this.setCam(camPos, V(-1.2, 1.08 + 0.14 * u, SPOT.herLamp.z), lerp(11.0, 8.0, u));
    this.breathe(t, 0.25);
    this.w.boy.root.visible = false;
    st.floorMirror = true;
    st.post = { ...st.post, focus: 15.35, aperture: 0.09, maxBlur: 10, bloom: 0.62, exposure: 0.98, vignette: 0.7 };
  }

  // 4. You look down at your phone to record her... she's closer.
  shot4(t, lt, sc, st) {
    const c = this.cues;
    const pos = SPOT.window;
    this.placeBoy({ pos, rotY: 0.0, pose: { head: { r: [0.25, 0, 0] } }, expr: 'tense' });
    const eye = V(pos.x, 1.53, pos.z + 0.12);
    const down = easeInOut(range(t, c.s4_lookDown, c.s4_phoneFull));
    const up = range(t, c.s4_lookUp, c.s4_lookUp + 0.38);
    // phone: held at the chest -> raised 29 cm in front of your eyes (fills the frame) -> dropped
    const phoneLow = V(pos.x + 0.04, 1.08, pos.z + 0.4);
    const phoneHigh = eye.clone().add(V(0.0, -0.05, 0.29));
    let phonePos = vlerp(phoneLow, phoneHigh, down);
    phonePos = vlerp(phonePos, V(pos.x + 0.1, 0.95, pos.z + 0.36), easeIn(up));
    const P = this.w.phone.root;
    P.visible = up < 1;
    P.position.copy(phonePos);
    P.lookAt(eye);
    P.rotateZ(0.03);
    P.updateMatrixWorld(true);
    const boy = this.w.boy;
    armIK(boy, 'R', P.localToWorld(V(-0.05, -0.085, -0.03)), boy.root.localToWorld(V(-0.5, -0.4, -0.2)));
    armIK(boy, 'L', P.localToWorld(V(0.05, -0.09, -0.03)), boy.root.localToWorld(V(0.5, -0.4, -0.2)));
    // camera at your eyes: her -> the phone screen -> back up to the street
    const herLook = V(-1.15, 1.25, 16);
    const roadLook = V(-0.72, 1.0, 13.0);
    let look = vlerp(herLook, P.localToWorld(V(0, 0, 0)), down);
    look = vlerp(look, roadLook, easeOut(up));
    this.setCam(eye, look, lerp(lerp(40, 30, down), 38, easeOut(up)));
    this.breathe(t, 1);
    const k = this.shake(t, c.s4_reveal, 1);
    st.post.ca = this.caAt(t, c.s4_reveal);
    st.povHideHead = true;
    st.phone = P.visible;
    st.phoneTime = Math.max(0, t - c.s4_lookDown);
    st.floorMirror = true;
    // she only moves while you look at the screen
    this.placeHer({ pos: t < c.s4_lookUp ? SPOT.herLamp : SPOT.herRoad, t, look: eye });
    const onPhone = down > 0.5 && up < 0.5;
    st.post = { ...st.post, focus: onPhone ? 0.3 : lerp(15, 13.2, up), aperture: 0.05, maxBlur: 10, bloom: 0.6, exposure: 0.92 + k * 0.1 };
  }

  // 5. Drop the mop, run, lock the door. Keys jingle, lock clicks.
  shot5(t, lt, sc, st) {
    const c = this.cues;
    this.hideHer();
    if (t < c.s5_cutToLock) {
      // POV run towards the door, the mop clatters down
      const u = range(t, sc.start, c.s5_cutToLock);
      const e = easeIn(u * 0.6 + 0.4 * u * u);
      const p = vlerp(V(-0.3, 1.53, 3.92), V(2.7, 1.47, 4.25), e);
      p.y += 0.035 * Math.abs(Math.sin(t * 11));
      this.setCam(p, vlerp(V(1.5, 1.2, 6), V(3.15, 1.1, 5.2), e), 48, -0.04 * Math.sin(t * 11));
      const fall = easeIn(range(t, c.s5_drop, c.s5_drop + 0.45));
      this.placeMop(V(0.0, 0, 4.0), V(-0.3, 0, -1).normalize(), 0.12 + fall * 1.38);
      this.w.boy.root.visible = false;
      st.floorMirror = true;
      st.post = { ...st.post, focus: 3, aperture: 0.02, maxBlur: 8, exposure: 0.9 };
      return;
    }
    // close-up on the lock, from the left of the door
    const lock = LAYOUT.door.lock;
    const u = range(t, c.s5_cutToLock, sc.end);
    this.setCam(vlerp(V(2.8, 1.18, 4.58), V(2.86, 1.13, 4.66), easeOut(u)), V(3.1, 1.03, 4.95), 32);
    this.breathe(t, 0.8);
    this.placeBoy({ pos: SPOT.door, rotY: -0.1, pose: { head: { r: [0.45, 0.2, 0] }, spine: { r: [0.15, 0, 0] } }, expr: 'scared' });
    const K = this.w.keys.root;
    K.visible = true;
    const reach = easeOut(range(t, c.s5_cutToLock, c.s5_keyIn));
    const turn = easeInOut(range(t, c.s5_keyTurn, c.s5_keyTurn + 0.22));
    const seat = V(lock.x, lock.y, lock.z - 0.03);
    const start = V(lock.x + 0.15, lock.y - 0.14, lock.z - 0.34);
    K.position.copy(vlerp(start, seat, reach));
    K.rotation.set(0, Math.PI, 0);
    K.rotateZ((turn * Math.PI) / 2 - (1 - reach) * 0.6);
    this.w.keys.dangle.rotation.z = 0.25 * Math.sin(t * 9) * (1 - turn * 0.6) + 0.3 * Math.sin(t * 5.3) * (1 - reach);
    K.updateMatrixWorld(true);
    const boy = this.w.boy;
    armIK(boy, 'R', K.localToWorld(V(0.0, -0.01, 0.035)), boy.root.localToWorld(V(-0.4, -0.5, -0.3)));
    armIK(boy, 'L', V(3.42, 1.18, 4.9), boy.root.localToWorld(V(0.5, -0.4, -0.2)));
    st.post = { ...st.post, focus: 0.36, aperture: 0.06, maxBlur: 14, exposure: 0.94 };
  }

  // 6. You turn back to the window: she is right against the glass.
  shot6(t, lt, sc, st) {
    const c = this.cues;
    const eye = V(SPOT.backOff.x, 1.52, SPOT.backOff.z + 0.1);
    const herInfo = this.pressHer(t, eye);
    const face = herInfo.face;
    const pan = easeInOut(range(t, c.s6_turn, c.s6_reveal + 0.05));
    const push = easeOut(range(t, c.s6_reveal, sc.end));
    const look = vlerp(V(3.12, 1.0, 4.96), face.clone().add(V(0.0, -0.04, 0)), pan);
    const camPos = vlerp(eye, eye.clone().lerp(face, 0.2), push);
    this.setCam(camPos, look, lerp(44, 38, push));
    this.breathe(t, 1);
    const k = this.shake(t, c.s6_reveal, 1.1);
    st.post.ca = this.caAt(t, c.s6_reveal);
    this.w.boy.root.visible = false;
    st.floorMirror = true;
    st.post = { ...st.post, focus: lerp(1.5, camPos.distanceTo(face), pan), aperture: 0.07, maxBlur: 12, bloom: 0.6, exposure: 0.9 + k * 0.12 };
  }

  // Her pressed to the glass, turned towards you: grin on the glass, breath fogging it, rings tapping.
  pressHer(t, look) {
    const W = this.w;
    const her = W.her;
    const dir = V(look.x - SPOT.herGlass.x, 0, look.z - SPOT.herGlass.z);
    const rotY = Math.atan2(dir.x, dir.z);
    const { tq } = this.placeHer({ pos: SPOT.herGlass, rotY, t, mode: 'glass', amp: 0.45, armAmp: 0, look });
    // slide her so the tip of her face just touches the glass
    let tip = her.head.localToWorld(V(0, -0.03, 0.125));
    her.root.position.z += GLASS_Z + 0.012 - tip.z;
    her.root.updateMatrixWorld(true);
    // hands flat on the glass either side of her face (IK), fingers tapping per the timeline
    const side = V(Math.cos(rotY), 0, -Math.sin(rotY));
    const head = her.head.localToWorld(V(0, 0, 0));
    const gz = GLASS_Z + 0.04;
    const hl = head.clone().add(side.clone().multiplyScalar(0.3));
    const hr = head.clone().add(side.clone().multiplyScalar(-0.28));
    armIK(her, 'L', V(hl.x, 1.66, gz), her.root.localToWorld(V(0.4, 0.3, -0.25)));
    armIK(her, 'R', V(hr.x, 1.48, gz), her.root.localToWorld(V(-0.4, 0.1, -0.25)));
    her.j.handL.rotation.set(-1.3, 0, 0.25);
    her.j.handR.rotation.set(-1.35, 0, -0.3);
    her.fingers.L.forEach((f) => {
      f.base.rotation.set(0.15, 0, 0);
      f.tip.rotation.set(0.1, 0, 0);
    });
    her.fingers.R.forEach((f, i) => {
      const tapF = i === 1 ? 0 : i === 2 ? 1 : -1;
      const a = tapF >= 0 ? tapAngle(this.tl.glassTaps, tq, tapF) : -0.3;
      f.base.rotation.set(0.2 + a, 0, 0);
      f.tip.rotation.set(0.15, 0, 0);
    });
    her.root.updateMatrixWorld(true);
    tip = her.head.localToWorld(V(0, -0.03, 0.125));
    // breath fog on the glass around her mouth, pulsing with her breathing
    const mouth = her.head.localToWorld(V(0, -0.06, 0.11));
    const fog = W.R.refs.breathFog;
    fog.position.set(mouth.x, mouth.y - 0.02, GLASS_Z + 0.008);
    fog.material.opacity = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4.2));
    W.S.lights.rim.position.set(head.x - 0.6 * dir.x, 2.6, 6.8);
    W.S.lights.rim.intensity = 14;
    return { face: her.head.localToWorld(V(0, 0, 0.08)) };
  }

  // 7. Lights flicker. You hide behind the counter, hand over your mouth.
  shot7(t, lt, sc, st) {
    const c = this.cues;
    const u = easeInOut(lt / (sc.end - sc.start));
    this.lights(t, { flicker: t < c.s7_flicker + 1.25 ? 1 : 0 });
    this.setKeyLight(V(-1.25, 3.1, -2.5), V(-1.35, 0, -1.9));
    const duck = easeOut(range(t, c.s7_duck, c.s7_duck + 0.35));
    const hand = easeOut(range(t, c.s7_hand, c.s7_hand + 0.3));
    this.placeBoy({ pos: SPOT.hide, rotY: Math.PI, pose: this.crouchPose(duck, 0), expr: 'scared' });
    const headPos = this.w.boy.head.localToWorld(V(0, 0, 0));
    this.setCam(vlerp(V(-0.85, 0.95, -3.3), V(-1.0, 0.9, -3.0), u), headPos.clone().add(V(0, -0.18, 0)), 36);
    this.breathe(t, 0.5);
    this.placeBoy({
      pos: SPOT.hide,
      rotY: Math.PI,
      pose: this.crouchPose(duck, 0),
      face: { wide: 0.8 * duck, raise: 0.6 * duck, worry: 0.8, blink: hand > 0 ? 0 : this.blinkAt(t, 7), lookAt: this.cam.position.clone().add(V(0.5 * Math.sin(t * 2.2), 0.3, 0)) },
      expr: hand > 0.5 ? 'tense' : 'scared',
    });
    const boy = this.w.boy;
    if (hand > 0) {
      const mouth = boy.head.localToWorld(V(0, -0.07, 0.17));
      const wrist = mouth.clone().add(V(0, -0.085, -0.03));
      const rest = boy.root.localToWorld(V(-0.18, 0.35, 0.25));
      armIK(boy, 'R', vlerp(rest, wrist, hand), boy.root.localToWorld(V(-0.6, -0.2, 0.1)));
      // hand points up, palm flat against the mouth
      const qWorld = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(-1, 0, 0), V(0, -1, 0), V(0, 0, 1)));
      const qParent = new THREE.Quaternion();
      boy.j.elbowR.getWorldQuaternion(qParent);
      boy.j.handR.quaternion.copy(qParent.invert().multiply(qWorld)).slerp(new THREE.Quaternion(), 1 - hand);
    }
    // she is still out at the glass (out of view), tapping
    this.pressHer(t, V(-1.35, 0.8, -1.8));
    st.floorMirror = true;
    st.post = { ...st.post, focus: this.cam.position.distanceTo(headPos), aperture: 0.06, maxBlur: 12, bloom: 0.56, exposure: 0.95 };
  }

  crouchPose(duck, lean) {
    const k = duck;
    return {
      hips: { p: [0, lerp(0, -0.7, k), lerp(0, 0.05, k)], r: [lerp(0, -0.1, k), 0, 0] },
      spine: { r: [lerp(0, -0.12 + lean, k), 0, 0] },
      chest: { r: [lerp(0, 0.18, k), 0, 0] },
      head: { r: [lerp(0, 0.05, k), 0, 0] },
      thighL: { r: [lerp(0, -1.45, k), 0, 0.22 * k] },
      thighR: { r: [lerp(0, -1.45, k), 0, -0.22 * k] },
      kneeL: { r: [lerp(0, 2.3, k), 0, 0] },
      kneeR: { r: [lerp(0, 2.3, k), 0, 0] },
      footL: { r: [lerp(0, -0.85, k), 0, 0] },
      footR: { r: [lerp(0, -0.85, k), 0, 0] },
      upperArmL: { r: [lerp(0, -0.9, k), 0, 0.25] },
      elbowL: { r: [lerp(0, -1.2, k), 0, 0] },
      upperArmR: { r: [lerp(0, -0.9, k), 0, -0.25] },
      elbowR: { r: [lerp(0, -1.2, k), 0, 0] },
    };
  }

  // 8. Silence. The tapping stops. Close on your face: you realize.
  shot8(t, lt, sc, st) {
    const c = this.cues;
    const u = easeInOut(lt / (sc.end - sc.start));
    this.lights(t, { kitchen: 0.9 });
    this.setKeyLight(V(-1.0, 3.1, -2.6), V(-1.35, 0.7, -1.9));
    this.placeBoy({ pos: SPOT.hide, rotY: Math.PI, pose: this.crouchPose(1, 0.02), expr: 'tense' });
    const face = this.w.boy.head.localToWorld(V(0, -0.01, 0.06));
    const camPos = face.clone().add(V(0.08, 0.06, lerp(-1.05, -0.8, u)));
    this.setCam(camPos, face, 30);
    this.breathe(t, 0.6);
    // eyes dart left/right, then the realization: wide eyes, raised brows, gasp
    const real = easeOut(range(t, c.s8_realize - 0.1, c.s8_realize + 0.35));
    const dart = real > 0.3 ? 0 : Math.sign(Math.sin(lt * 2.6)) * 0.45;
    const lookAt = this.cam.position.clone().add(V(dart, 0.05, 0));
    this.placeBoy({
      pos: SPOT.hide,
      rotY: Math.PI,
      pose: { ...this.crouchPose(1, 0.02), head: { r: [0.05 - 0.08 * real, 0, 0] } },
      face: { wide: real, raise: real, worry: 0.6 - 0.4 * real, blink: real > 0 ? 0 : this.blinkAt(t, 9), lookAt },
      expr: real > 0.4 ? 'gasp' : 'tense',
    });
    this.hideHer();
    st.post = { ...st.post, focus: camPos.distanceTo(face), aperture: 0.06, maxBlur: 14, bloom: 0.5, exposure: 0.98, vignette: 0.75 };
  }

  // 9. You slowly stand up: the window is empty. Only the streetlight flickers.
  shot9(t, lt, sc, st) {
    const c = this.cues;
    const rise = easeInOut(range(t, c.s9_rise, c.s9_risen + 0.4));
    const p = vlerp(V(-1.38, 0.82, -1.98), V(-1.36, 1.55, -2.02), rise);
    const look = vlerp(V(-1.3, 0.95, 0.0), V(-0.55, 1.35, 5.0), easeInOut(range(t, c.s9_rise + 0.3, c.s9_risen + 0.6)));
    this.setCam(p, look, lerp(44, 38, rise));
    this.breathe(t, 1.1);
    this.w.boy.root.visible = false;
    this.hideHer();
    st.floorMirror = true;
    st.post = { ...st.post, focus: lerp(0.6, 7.5, rise), aperture: 0.05, maxBlur: 10, bloom: 0.6, exposure: 0.92 };
  }

  // 10. Slow push-in on the steel fridge door: in the reflection she dances right behind you.
  shot10(t, lt, sc, st) {
    const c = this.cues;
    const pos = SPOT.fridgeStand;
    const tremble = 0.02 * noise1(t * 6, 31);
    this.placeBoy({
      pos,
      rotY: Math.PI,
      pose: { head: { r: [0.08, tremble, 0] }, spine: { r: [0.04, 0, 0] }, upperArmL: { r: [0.05, 0, 0.12] }, upperArmR: { r: [0.05, 0, -0.12] }, elbowL: { r: [-0.25, 0, 0] }, elbowR: { r: [-0.25, 0, 0] } },
      face: { wide: 1, raise: 0.9, worry: 1, lookAt: V(pos.x, 1.5, -3.6) },
      expr: 'scared',
    });
    const eye = this.boyEye();
    const pushU = easeInOut(range(t, sc.start, c.s10_reveal + 0.3));
    const late = easeInOut(range(t, c.s10_reveal + 0.3, sc.end));
    const camPos = eye.clone().add(V(0.02, 0.0, -0.03 - 0.3 * pushU - 0.06 * late));
    // open on the turn towards the fridge (door edge + handle sweep through frame), then settle
    // slightly down (-3 deg) and right (+4 deg): both faces mid-frame, clear of the caption
    const turn = easeInOut(range(t, sc.start, sc.start + 1.5));
    const yaw = lerp(0.62, 0.07, turn);
    const pitch = lerp(-0.12, -0.052, turn);
    this.setCam(camPos, camPos.clone().add(V(Math.sin(yaw), pitch, -Math.cos(yaw))), lerp(44, 36, pushU) - 3 * late);
    this.breathe(t, 0.8);
    const k = this.shake(t, c.s10_reveal, 1.0);
    st.post.ca = this.caAt(t, c.s10_reveal);
    // her: right behind you, looking at you THROUGH the mirror
    const mirrorZ = LAYOUT.fridge.frontZ + 0.006;
    const camMirror = this.cam.position.clone();
    camMirror.z = 2 * mirrorZ - camMirror.z;
    // nobody behind you... until the reveal frame: she moved while you looked away
    if (t >= c.s10_reveal) this.placeHer({ pos: SPOT.herBehind, t, mode: 'ear', amp: 0.7, armAmp: 0.5, look: camMirror, outside: false });
    else this.hideHer();
    // the focus pull lands just before the reveal, so you clearly see the empty kitchen behind you
    const focus = easeInOut(range(t, sc.start + 0.4, c.s10_reveal - 0.2));
    this.w.R.fridgeDoorMat.userData.refl.uReflBlur.value = lerp(3.6, 0.45, focus);
    st.fridgeMirror = true;
    st.povHideHead = true;
    this.setKeyLight(V(-1.25, 3.12, -2.25), V(-1.3, 0.8, -2.4));
    // bubble anchor: her face as seen in the mirror
    this.w.her.root.updateMatrixWorld(true);
    const head = this.w.her.head.localToWorld(V(0, 0.02, 0.1));
    head.z = 2 * mirrorZ - head.z;
    this.cam.updateMatrixWorld(true);
    const ndc = head.project(this.cam);
    st.bubbleAnchor = { x: (ndc.x * 0.5 + 0.5) * 1080, y: (1 - (ndc.y * 0.5 + 0.5)) * 1920 };
    st.post = { ...st.post, focus: 0.5, aperture: 0.0, maxBlur: 0, bloom: 0.56, exposure: 0.95 + 0.1 * k, vignette: 0.8 };
  }

  // 11 + 12. Wide shot behind the choice card; the menu screens flash her face for 3 frames.
  shot11(t, lt, sc, st) {
    const s11 = this.scenes.find((s) => s.id === 11);
    const s12 = this.scenes.find((s) => s.id === 12);
    const u = easeInOut((t - s11.start) / (s12.end - s11.start));
    this.setCam(vlerp(V(-0.25, 1.22, 3.5), V(-0.45, 1.28, 2.75), u), vlerp(V(-1.5, 0.95, -1.8), V(-1.55, 1.0, -1.8), u), 52);
    this.breathe(t, 0.35);
    const pos = SPOT.fridgeStand;
    this.placeBoy({ pos, rotY: Math.PI, pose: { head: { r: [0.08, 0, 0] }, upperArmL: { r: [0.05, 0, 0.12] }, upperArmR: { r: [0.05, 0, -0.12] }, elbowL: { r: [-0.25, 0, 0] }, elbowR: { r: [-0.25, 0, 0] } }, face: { wide: 1, raise: 0.9, worry: 1 }, expr: 'scared' });
    const mirrorZ = LAYOUT.fridge.frontZ + 0.006;
    const camMirror = this.boyEye();
    camMirror.z = 2 * mirrorZ - camMirror.z;
    this.placeHer({ pos: SPOT.herBehind, t, mode: 'ear', amp: 0.7, armAmp: 0.5, look: camMirror, outside: false });
    this.setKeyLight(V(-1.25, 3.12, -2.25), V(-1.3, 0.8, -2.4));
    // the hidden twist: 3 frames of her face on every menu screen
    const tw = this.cues.s12_twist;
    if (t >= tw - 1e-6 && t < tw + this.cues.s12_twistFrames / this.tl.fps - 1e-6) {
      st.menuFace = true;
      for (const m of this.w.R.menu) m.mat.map = m.faceTex;
    }
    st.floorMirror = true;
    st.post = { ...st.post, focus: 4.6, aperture: 0.03, maxBlur: 7, bloom: 0.56, exposure: 0.85, vignette: 0.7 };
  }

  shot12(t, lt, sc, st) {
    return this.shot11(t, lt, sc, st);
  }
}
