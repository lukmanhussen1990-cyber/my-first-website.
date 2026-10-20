// Per-frame direction: cameras, performances, lights, TV, overlay state. Pure function of time t.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeInOut, easeOut, range, pulse, noise1, fbm1, hash1 } from './lib/util.js';
import { solveArm, setBlink, setMouth, setPupils } from './world/characters.js';
import { drawCartoon, tvFlicker } from './world/tv.js';
import { updateSteam, updateCurtains } from './world/fx.js';
import { drawLockScreen } from './ui.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, t);

const MOM_POS = V(0.6, 0, -3.55);
const YOU_POS = V(0.28, 0, 1.6);
const MOM3_POS = V(0.2, 0, 0.62);
const POT = V(0.78, 0.925, -3.97);
const DOOR_GLASS = V(3.17, 1.42, 3.95);
const CLOCK_START = 20 * 3600 + 12 * 60 + 40; // 8:12:40 PM at t = 0

export class Director {
  constructor(c) {
    this.c = c;
    this.tl = c.timeline;
    this.ev = c.timeline.events;
    this.S = Object.fromEntries(c.timeline.scenes.map((s) => [s.key, s]));
    this.gags = this.ev.laughs.map((l) => l.gag);
    this.tmp = new THREE.Vector3();
    // fear keyframes (absolute time)
    const S = this.S;
    this.fearKeys = [
      [0, 0], [S.phone.start + 3.5, 0.05], [S.phone.end, 0.3], [S.who.end, 0.55], [S.humming.end, 0.7],
      [S.shadow.start + 1.2, 0.85], [S.texting.end, 0.9], [S.doorbell.start, 1], [this.tl.duration, 1],
    ];
  }

  fear(t) {
    const k = this.fearKeys;
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], smooth(k[i - 1][0], k[i][0], t));
    return 1;
  }

  sceneAt(t) {
    const sc = this.tl.scenes;
    for (const s of sc) if (t < s.end) return s;
    return sc[sc.length - 1];
  }

  // ------------------------------------------------------------------ camera shots
  shot(s, u, t) {
    const d = s.duration, k = easeInOut(u / d);
    const ev = this.ev;
    switch (s.key) {
      case 'normal': return { pos: lerpV(V(0.5, 1.58, 4.6), V(0.4, 1.47, 4.2), k), tgt: lerpV(V(0.16, 0.84, 1.0), V(0.2, 0.88, 1.0), k), fov: 50, focus: null, focusObj: 'you', ap: 0.9 };
      case 'dinner': return { pos: lerpV(V(0.12, 1.0, 2.02), V(0.16, 1.04, 1.9), k), tgt: lerpV(V(0.66, 1.1, -3.55), V(0.68, 1.14, -3.55), k), fov: lerp(31, 28, k), focusObj: 'mom', ap: 1.3 };
      case 'phone': {
        const cut = ev.phoneCard - s.start - 0.45;
        if (u < cut) { const kk = easeInOut(u / cut); return { pos: lerpV(V(-0.18, 1.05, 2.3), V(-0.26, 0.98, 2.18), kk), tgt: V(-0.42, 0.47, 1.62), fov: 40, focus: null, focusObj: 'phone', ap: 1.2 }; }
        const kk = easeInOut((u - cut) / (d - cut));
        return { pos: lerpV(V(-0.4, 1.02, 2.12), V(-0.43, 0.94, 2.02), kk), tgt: lerpV(V(-0.46, 0.58, 1.66), V(-0.46, 0.56, 1.66), kk), fov: 36, focusObj: 'phone', ap: 0.7 };
      }
      case 'who': return { pos: lerpV(V(0.12, 1.15, 1.95), V(0.34, 1.26, 0.45), easeInOut(u / d)), tgt: V(0.62, 1.32, -3.55), fov: lerp(30, 26, k), focusObj: 'mom', ap: 1.2 };
      case 'humming': {
        const ci = this.ev.clockInsert[0] - s.start;
        if (u < ci) { const kk = easeInOut(u / ci); return { pos: lerpV(V(-0.3, 1.56, -1.45), V(-0.22, 1.53, -1.7), kk), tgt: lerpV(V(1.02, 1.36, -4.1), V(1.05, 1.36, -4.1), kk), fov: 44, focusObj: 'mom', ap: 0.8 }; }
        const kk = easeInOut((u - ci) / (d - ci));
        return { pos: lerpV(V(0.98, 1.8, 4.05), V(0.98, 1.82, 4.25), kk), tgt: V(0.98, 1.76, 5.17), fov: 46, focus: lerp(1.1, 0.92, kk), ap: 0.6 };
      }
      case 'shadow': return { pos: lerpV(V(0.12, 1.62, -1.15), V(0.2, 1.6, -1.5), k), tgt: lerpV(V(0.92, 1.52, -4.4), V(0.95, 1.54, -4.4), k), fov: 46, focus: lerp(3.35, 3.0, k), ap: 1.2 };
      case 'texting': return { pos: lerpV(V(0.16, 1.14, 1.78), V(0.2, 1.16, 1.66), k), tgt: V(0.62, 1.38, -3.55), fov: lerp(21, 19, k), focusObj: 'mom', ap: 1.1 };
      case 'doorbell': return { pos: lerpV(V(1.12, 1.55, 2.5), V(1.32, 1.52, 2.72), k), tgt: V(3.2, 1.3, 3.95), fov: lerp(44, 40, k), focus: null, focusObj: 'door', ap: 0.9 };
      case 'turn': return { pos: lerpV(V(0.78, 1.42, -2.05), V(0.72, 1.45, -2.3), k), tgt: lerpV(V(0.57, 1.5, -3.6), V(0.58, 1.52, -3.6), k), fov: lerp(38, 35, k), focusObj: 'mom', ap: 1.0 };
      case 'choice':
      case 'twist': {
        const a = this.S.choice.start, b = this.S.twist.end;
        const kk = easeInOut((t - a) / (b - a));
        // high over-the-shoulder angle from right behind You (where the third Mom stands): TV above the card
        return { pos: lerpV(V(0.27, 2.14, 0.3), V(0.27, 2.06, 0.62), kk), tgt: V(0.0, 0.2, 4.9), fov: 56, focusObj: 'tv', ap: 0.6 };
      }
    }
    return { pos: V(0, 1.5, 4), tgt: V(0, 1, 0), fov: 45, ap: 0 };
  }

  applyCamera(cam, sh, t) {
    // handheld drift + scare shake
    const scares = this.ev.scares;
    let shake = 0;
    for (const sT of scares) shake += pulse(t, sT, 0.38);
    const hand = 0.006;
    const off = V(fbm1(t * 0.35, 11) * hand, fbm1(t * 0.3, 12) * hand, fbm1(t * 0.33, 13) * hand * 0.5);
    off.add(V(noise1(t * 22, 21), noise1(t * 24, 22), noise1(t * 20, 23)).multiplyScalar(0.03 * shake));
    cam.position.copy(sh.pos).add(off);
    cam.fov = sh.fov;
    cam.updateProjectionMatrix();
    const tgt = sh.tgt.clone().add(V(noise1(t * 0.4, 31) * 0.01, noise1(t * 0.37, 32) * 0.01, 0));
    cam.up.set(Math.sin(noise1(t * 18, 41) * 0.03 * shake), 1, 0).normalize();
    cam.lookAt(tgt);
    cam.updateMatrixWorld(); // the overlay projects bubble anchors with this frame's camera, not the last one
    return shake;
  }

  // ------------------------------------------------------------------ main update
  update(t, frame) {
    const c = this.c;
    const s = this.sceneAt(t);
    const u = t - s.start;
    const f = this.fear(t);
    const ev = this.ev;

    // ---------- performances
    this.poseMom(c.mom, t, s, false);
    this.poseMom(c.momShadow, Math.min(t, ev.stirStop + 0.9), s, true);
    const doubleOn = t >= this.S.shadow.start;
    c.momShadow.root.visible = doubleOn;
    c.mom.root.traverse((o) => { if (o.isMesh) o.castShadow = !doubleOn; });
    this.poseYou(c.you, t, s);
    this.poseMom3(c.mom3, t);

    // ---------- camera
    const sh = window.debugShot ? { pos: V(...window.debugShot.pos), tgt: V(...window.debugShot.tgt), fov: window.debugShot.fov, focusObj: null, focus: 2, ap: 0 } : this.shot(s, u, t);
    const shake = this.applyCamera(c.camera, sh, t);
    const pov = ['dinner', 'who', 'texting'].includes(s.key);
    c.you.root.visible = !pov;
    let focus = sh.focus;
    if (!focus && sh.focusObj) {
      const p = { you: () => c.you.head.getWorldPosition(this.tmp), mom: () => c.mom.head.getWorldPosition(this.tmp), phone: () => c.refs.phone.getWorldPosition(this.tmp), door: () => DOOR_GLASS.clone(), tv: () => V(0, 0.97, 4.95) }[sh.focusObj]();
      focus = p.distanceTo(c.camera.position);
    }
    const dof = c.post.dof.material.uniforms;
    dof.uFocus.value = focus || 3; dof.uAperture.value = sh.ap; dof.uMaxBlur.value = 9;

    // ---------- lights & mood
    const L = c.refs.lights;
    const warm = new THREE.Color(0xffc27a), pale = new THREE.Color(0xd9dde6);
    L.key.color.copy(warm).lerp(pale, f * 0.75);
    L.key.intensity = 10 * (1 - 0.3 * f);
    L.hood.color.copy(new THREE.Color(0xffb45c)).lerp(pale, f * 0.6); L.hood.intensity = 3.2 * (1 - 0.45 * f);
    L.kfill.color.copy(new THREE.Color(0xffd6a0)).lerp(pale, f * 0.7); L.kfill.intensity = 1.3 * (1 - 0.55 * f);
    L.hemi.intensity = 0.4 - 0.12 * f;
    c.refs.pendantBulb.material.color.setRGB(5, 3.2, 1.6).lerp(new THREE.Color(3.4, 3.4, 3.6), f * 0.75).multiplyScalar(1 - 0.25 * f);
    c.refs.hoodBulbMat.color.setRGB(4.0, 2.6, 1.3).lerp(new THREE.Color(3, 3, 3.2), f * 0.6).multiplyScalar(1 - 0.35 * f);
    for (const fl of c.refs.flames) fl.material.color.setRGB(0.25, 0.45, 1.6).multiplyScalar(0.8 + noise1(t * 14, 51) * 0.25);
    // the floor-lamp light doubles as the porch glow spilling through the front door glass in scene 8
    if (s.key === 'doorbell') { L.lamp.position.set(2.95, 1.5, 3.95); L.lamp.color.setHex(0xffb070); L.lamp.intensity = 1.1; }
    else { L.lamp.position.copy(c.refs.lampPos); L.lamp.color.setHex(0xffb468); L.lamp.intensity = 1.5 * (1 - 0.65 * f); }
    c.refs.lampShade.material.emissiveIntensity = 0.55 * (1 - 0.65 * f);

    // ---------- TV picture + glow
    const tv = c.tv;
    const frozen = t >= ev.freeze;
    const cartT = frozen ? ev.freeze : t;
    const avg = drawCartoon(tv, cartT, this.gags);
    const flick = frozen ? 1 : tvFlicker(t, f);
    const staticAmt = t >= ev.staticFlash && t < ev.feedOn ? 1 : 0;
    const feed = t >= ev.feedOn ? 1 : 0;
    tv.mat.uniforms.uMode.value = feed;
    tv.mat.uniforms.uStatic.value = staticAmt;
    tv.mat.uniforms.uFrame.value = frame;
    tv.mat.uniforms.uBright.value = 2.1 * flick * (feed ? 0.75 : 1);
    const cold = new THREE.Color(0.55, 0.72, 1.0);
    const pic = new THREE.Color(avg[0], avg[1], avg[2]);
    const tvCol = cold.clone().lerp(pic, 0.45);
    if (feed) tvCol.setRGB(0.62, 0.72, 0.66);
    L.tvSpot.color.copy(tvCol);
    const tvLevel = flick * (0.75 + 0.5 * (avg[0] + avg[1] + avg[2]) / 3) * (feed ? 0.7 : 1) * (staticAmt ? 1.3 : 1);
    L.tvSpot.intensity = 26 * tvLevel * (1 + 0.25 * f);
    L.tvSpill.color.copy(tvCol); L.tvSpill.intensity = 1.1 * tvLevel;

    // ---------- props
    updateSteam(c.steam, t, 1);
    updateCurtains(c.refs.curtains, t, s.key === 'doorbell' ? 1.5 : 0);
    this.clock(t);
    this.phone(t, s);
    this.doorGlass(t, s);

    // ---------- post
    const film = c.post.film.material.uniforms;
    const scareCA = ['shadow', 'doorbell', 'turn'].includes(s.key) ? shake : 0;
    film.uCA.value = 0.0025 + scareCA * 0.03;
    film.uGrain.value = 0.03 + 0.015 * f;
    film.uVig.value = 0.32 + 0.33 * f;
    film.uFrame.value = frame;
    film.uTint.value.set(1 - 0.03 * f, 1 - 0.01 * f, 1 + 0.03 * f);
    c.renderer.toneMappingExposure = 1.0 - 0.12 * f;
    c.post.bloom.strength = 0.5 + 0.15 * f;

    // ---------- overlay state
    return this.overlayState(t, s);
  }

  // ------------------------------------------------------------------ Mom
  poseMom(m, t, s, isShadow) {
    const ev = this.ev;
    const root = m.root;
    root.position.copy(MOM_POS);
    // turn (scene 9): body from facing the stove (pi) to facing the room (2pi); head leads
    const turnK = isShadow ? 0 : easeInOut(range(t, ev.turn[0] + 0.15, ev.turn[1]));
    const headLead = isShadow ? 0 : easeInOut(range(t, ev.turn[0], ev.turn[1] - 0.3)) - turnK;
    root.rotation.set(0, Math.PI + turnK * Math.PI, 0);

    const humming = t >= ev.humStart - 1 && t < ev.humStop;
    const humK = humming ? 1 : 1 - clamp((t - ev.humStop) / 0.35);
    // stirring with deceleration
    const P = ev.stirPeriod;
    const stopT = ev.stirStop;
    const decel = 0.6;
    let phase;
    if (t < stopT) phase = t / P;
    else { const dt = Math.min(t - stopT, decel); phase = stopT / P + (dt - (dt * dt) / (2 * decel)) / P; }
    const stirAmt = t < stopT ? 1 : 1 - clamp((t - stopT) / decel);
    const th = phase * Math.PI * 2;

    // body idle
    m.hips.rotation.z = 0.02 * Math.sin(th) * stirAmt;
    m.spine.rotation.x = 0.05 + 0.015 * Math.sin(th * 2) * stirAmt;
    m.chest.rotation.y = 0.03 * Math.sin(th) * stirAmt;
    // head: humming bob, later the creepy tilt
    const tilt = isShadow ? 0 : smooth(this.S.shadow.start + 0.4, this.S.shadow.start + 2.6, t) * 0.3 - smooth(this.S.texting.start + 1, this.S.texting.end, t) * 0.12;
    m.neck.rotation.set(0.12 + 0.035 * Math.sin(t * Math.PI * 2 / 1.25) * humK, 0, 0);
    m.head.rotation.set(-0.08 + 0.02 * Math.sin(t * Math.PI * 2 / 2.5) * humK, headLead * Math.PI * 0.5, 0.06 * Math.sin(t * Math.PI * 2 / 2.5) * humK + tilt);
    m.pony.rotation.x = 0.55 + 0.06 * Math.sin(th + 0.6) * stirAmt + 0.04 * Math.sin(t * 2.5) * humK + headLead * 0.2;
    m.pony.rotation.z = 0.08 * Math.sin(th) * stirAmt - (m.head.rotation.z) * 0.8;
    m.pony2.rotation.x = -0.5 + 0.08 * Math.sin(th + 1.2) * stirAmt;

    // arms (IK). Targets in Mom's local space -> world.
    root.updateMatrixWorld(true);
    const toW = (x, y, z) => root.localToWorld(V(x, y, z));
    const potLocal = root.worldToLocal(POT.clone());
    const stirC = V(potLocal.x, 1.19, potLocal.z - 0.05);
    const r = 0.05;
    const stirHand = V(stirC.x + Math.cos(th) * r * stirAmt, stirC.y + Math.sin(th * 2) * 0.006, stirC.z + Math.sin(th) * r * stirAmt);
    let handR = stirHand.clone();
    let lh = V(0.22, 0.95, 0.25); // left hand resting on the counter edge
    if (!isShadow) {
      // scene 9: spoon lifted out of the pot and held up in front of her chest while she turns
      const hold = easeInOut(range(t, ev.turn[0] - 0.2, ev.turn[1]));
      handR = lerpV(handR, V(-0.14, 1.22, 0.24), hold);
      // scene 6: she slowly raises her LEFT arm high (the frozen shadow keeps both arms down),
      // scene 7: lowers it to her side
      const lift = easeInOut(range(t, ev.armLift[0], ev.armLift[1]));
      const lower = easeInOut(range(t, this.S.texting.start + 0.4, this.S.texting.end - 0.4));
      // lowering path curves in front of her body (quadratic bezier) instead of swinging out sideways
      const raised = lerpV(lh, V(0.36, 1.86, 0.1), lift);
      const ctrl = V(0.16, 1.32, 0.34), hang = V(0.25, 0.86, 0.02);
      const q = lower;
      lh = raised.clone().multiplyScalar((1 - q) * (1 - q)).add(ctrl.clone().multiplyScalar(2 * q * (1 - q))).add(hang.clone().multiplyScalar(q * q));
    }
    solveArm(m.arms.R, toW(handR.x, handR.y, handR.z), V(-0.7, -0.3, -0.6));
    solveArm(m.arms.L, toW(lh.x, lh.y, lh.z), V(0.8, -0.2, -0.5));
    // spoon orientation: into the pot while stirring, follows the forearm when lifted / held
    m.arms.R.hand.updateWorldMatrix(true, false);
    const handW = m.arms.R.hand.getWorldPosition(V(0, 0, 0));
    const intoPot = POT.clone().add(V(0, 0.04, 0.03)).sub(handW).normalize();
    const up = isShadow ? 0 : range(t, ev.turn[0] - 0.2, ev.turn[1]);
    const dir = intoPot.clone().lerp(V(0.15, 1, 0.1), up).normalize();
    const want = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), dir);
    const hq = m.arms.R.hand.getWorldQuaternion(new THREE.Quaternion());
    m.spoon.quaternion.copy(hq.invert().multiply(want));

    // face: never blinks; warm smile; pupils shrink a little when she turns
    setBlink(m.face, 0);
    setMouth(m.face, 0);
    setPupils(m.face, 1 - 0.3 * turnK);
  }

  poseMom3(m, t) {
    const root = m.root;
    // standing right behind the sofa, staring straight into the security camera, smiling
    root.position.copy(MOM3_POS);
    root.rotation.set(0, -2.23, 0);
    m.spine.rotation.x = 0.02;
    m.neck.rotation.set(-0.12, 0, 0);
    m.head.rotation.set(-0.18, 0.05, 0.16);
    root.updateMatrixWorld(true);
    solveArm(m.arms.R, root.localToWorld(V(-0.25, 0.86, 0.06)), V(-0.7, -0.3, -0.6));
    solveArm(m.arms.L, root.localToWorld(V(0.25, 0.86, 0.06)), V(0.7, -0.3, -0.6));
    m.spoon.visible = false;
    setBlink(m.face, 0); setMouth(m.face, 0); setPupils(m.face, 0.7);
  }

  // ------------------------------------------------------------------ You
  poseYou(y, t, s) {
    const ev = this.ev;
    y.root.position.copy(YOU_POS);
    y.root.rotation.set(0, 0, 0);
    // laughing only while life is still normal (scenes 1-2)
    let laugh = 0;
    if (t < this.S.phone.start) for (const l of ev.laughs) laugh = Math.max(laugh, range(t, l.start, l.start + 0.2) * (1 - range(t, l.start + l.duration - 0.8, l.start + l.duration)));
    const shakeY = Math.sin(t * Math.PI * 2 * 6.5) * 0.012 * laugh;
    const scared = smooth(this.S.phone.start, this.S.who.end, t);
    y.hips.position.y = 0.55;
    y.spine.position.y = 0.06 + shakeY;
    y.spine.rotation.x = -0.14 + laugh * -0.08 + scared * 0.1;
    y.chest.rotation.x = Math.sin(t * Math.PI * 2 * 6.5 + 1) * 0.02 * laugh;
    y.neck.rotation.set(-0.05 - laugh * 0.12 + scared * 0.05, 0, 0);
    // final scenes: head slowly turns toward the kitchen/door, very still
    const look = smooth(this.S.choice.start, this.S.choice.start + 2, t);
    y.head.rotation.set(laugh * -0.06, look * 0.35, laugh * 0.05);
    setMouth(y.face, laugh > 0.1 ? 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 2 * 3.2)) * laugh : 0);
    // blink every ~3.3s
    const bt = (t + 0.7) % 3.3;
    setBlink(y.face, bt < 0.12 ? Math.sin((bt / 0.12) * Math.PI) : 0);
    setPupils(y.face, 1 - 0.25 * scared);
    // arms: hand of popcorn to mouth at popcorn times
    y.root.updateMatrixWorld(true);
    const toW = (a) => y.root.localToWorld(a.clone());
    let eat = 0;
    for (const p of ev.popcorn) eat = Math.max(eat, easeInOut(range(t, p - 0.5, p)) * (1 - easeInOut(range(t, p + 0.35, p + 0.85))));
    const lap = V(-0.1, 0.62, 0.26), mouth = V(-0.03, 1.08, 0.2);
    solveArm(y.arms.R, toW(lerpV(lap, mouth, eat)), V(-0.8, -0.2, -0.4));
    solveArm(y.arms.L, toW(V(0.14, 0.6, 0.24)), V(0.8, -0.2, -0.4));
    y.handful.visible = t < this.S.phone.start;
  }

  // ------------------------------------------------------------------ props
  clock(t) {
    const cl = this.c.refs.clock;
    const secs = CLOCK_START + t;
    const whole = Math.floor(secs);
    const frac = secs - whole;
    const tick = whole + (frac < 0.08 ? easeOut(frac / 0.08) * 1.05 - 0.05 + 0.05 * (frac / 0.08) : 1) - 1;
    const sAng = ((tick % 60) / 60) * Math.PI * 2;
    const mAng = (((secs / 60) % 60) / 60) * Math.PI * 2;
    const hAng = (((secs / 3600) % 12) / 12) * Math.PI * 2;
    cl.second.rotation.z = -sAng; cl.minute.rotation.z = -mAng; cl.hour.rotation.z = -hAng;
  }

  phone(t, s) {
    const c = this.c, ev = this.ev;
    const ph = c.refs.phone;
    const on = t >= ev.phoneBuzz[0];
    let buzz = 0;
    for (const b of ev.phoneBuzz) for (const k of [0, 0.62]) if (t >= b + k && t < b + k + 0.42) buzz = 1;
    ph.position.set(-0.46 + (buzz ? Math.sin(t * 380) * 0.0018 : 0), 0.478, 1.66 + (buzz ? Math.cos(t * 410) * 0.0015 : 0));
    ph.rotation.y = 0.35 + (buzz ? Math.sin(t * 300) * 0.02 : 0);
    const notif = clamp((t - ev.phoneBuzz[0] - 0.1) / 0.3);
    const key = on ? Math.round(notif * 10) : -1;
    if (key !== this._phoneKey) {
      this._phoneKey = key;
      const sc = c.phoneScreen;
      if (on) drawLockScreen(sc.ctx, sc.canvas.width, sc.canvas.height, notif);
      else { sc.ctx.fillStyle = '#000'; sc.ctx.fillRect(0, 0, sc.canvas.width, sc.canvas.height); }
      sc.tex.needsUpdate = true;
    }
    c.refs.phoneScreen.material.color.setScalar(on ? 1.25 : 1);
  }

  doorGlass(t, s) {
    const dg = this.c.refs.doorGlass;
    const active = s.key === 'doorbell';
    const key = active ? Math.floor(t * 30) : (t >= this.S.doorbell.start ? -2 : -1);
    if (key === this._doorKey) return;
    this._doorKey = key;
    const g = dg.canvas.getContext('2d');
    const w = dg.canvas.width, h = dg.canvas.height;
    const glow = g.createRadialGradient(w * 0.5, h * 0.25, 10, w * 0.5, h * 0.4, h * 0.75);
    glow.addColorStop(0, '#ffd9a0'); glow.addColorStop(0.5, '#d9965a'); glow.addColorStop(1, '#5a3a26');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    if (t >= this.S.doorbell.start) {
      // door-Mom silhouette behind frosted glass (same ponytail)
      const sway = Math.sin(t * 1.3) * 4;
      g.save();
      g.filter = 'blur(7px)';
      g.fillStyle = 'rgba(28,18,14,0.85)';
      g.beginPath(); g.ellipse(w * 0.5 + sway, h * 0.42, 46, 54, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(w * 0.5 + sway + 44, h * 0.36, 16, 30, 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(w * 0.5 + sway, h * 0.92, 120, 110, 0, Math.PI, 0); g.fill();
      g.fillRect(w * 0.5 + sway - 120, h * 0.92, 240, h);
      g.restore();
    }
    // frosted texture
    g.globalAlpha = 0.18;
    for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(hash1(i * 1.7) * w, hash1(i * 3.1) * h, 2, 2); }
    g.globalAlpha = 1;
    dg.tex.needsUpdate = true;
    dg.mesh.material.color.setScalar(1.1);
  }

  // ------------------------------------------------------------------ overlay
  project(p) {
    const v = p.clone().project(this.c.camera);
    return { x: (v.x * 0.5 + 0.5) * this.tl.width, y: (-v.y * 0.5 + 0.5) * this.tl.height };
  }

  overlayState(t, s) {
    const st = { t };
    if (s.caption && t >= s.caption.start) st.caption = { ...s.caption };
    if (s.bubble && t >= s.bubble.start && t < s.bubble.end) {
      let anchor, side = 'right';
      if (s.bubble.speaker === 'door') { anchor = this.project(DOOR_GLASS.clone().add(V(0, 0.32, 0))); side = 'left'; }
      else { anchor = this.project(this.c.mom.head.getWorldPosition(V(0, 0, 0)).add(V(0, 0.2, 0))); }
      st.bubble = { ...s.bubble, anchor, side };
    }
    if (s.key === 'phone' && t >= this.ev.phoneCard) st.phoneCard = { p: t - this.ev.phoneCard, y: 560 };
    if (s.key === 'choice' || s.key === 'twist') {
      const L10 = this.S.choice.lines[0];
      const w = L10.words;
      const a0 = w[0].start, a1 = w[3].start, b1 = w[Math.min(10, w.length - 1)].start;
      const hiA = range(t, a0, a0 + 0.2) * (1 - range(t, a1, a1 + 0.2));
      const hiB = range(t, a1, a1 + 0.2) * (1 - range(t, b1, b1 + 0.2));
      const both = range(t, b1, b1 + 0.2) * (0.55 + 0.45 * Math.abs(Math.sin((t - b1) * 3.2)));
      st.choice = { start: this.S.choice.start, hiA: Math.max(hiA, both), hiB: Math.max(hiB, both) };
    }
    return st;
  }
}
