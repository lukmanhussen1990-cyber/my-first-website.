// Every scene of the reel as a pure function of time. apply(t) resets the world to a
// neutral state, poses everything for scene-local time, sets camera + post, and returns
// the overlay (text layer) state.
import * as THREE from 'three';
import { clamp, lerp, ramp, ep, ease, smoothstep, keyframes, fbm1, noise1, shake, mulberry32 } from './util.js';
import { LEDGE_Y, wallX, crackCenter, snowTop } from './world/glacier.js';
import { POSES, blendPose, walkPose, applyPose } from './world/figures.js';
import { FROZEN_U } from './world/frozen.js';
import { setRope } from './world/props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LEDGE_X0 = wallX(-1, LEDGE_Y, -0.8);
export const SEAT = V(LEDGE_X0 + 0.32, LEDGE_Y + 0.025, -0.45);
const FM_Z = -0.45;
const EYE_Y = LEDGE_Y + 0.875;          // frozen man's eye line (about Max's eye height)
const rightWall = (y, z = FM_Z) => wallX(1, y, z);
const CAMP = V(-26, 0, -14);
const TRIPOD = V(0.15, 0.1, -1.6);

// GPT image calibration (source pixels): anchor pixel + metres-per-pixel
const IMG = {
  closed: { anchor: [567, 515], mpp: 0.063 / 225 },  // anchor = between the eyes, IPD 225px = 63mm
  open: { anchor: [632, 497], mpp: 0.063 / 225 },
  back: { anchor: [655, 225], mpp: 0.00072 },        // anchor = centre of the head
  hand: { anchor: [520, 800], mpp: 0.00021 },        // anchor = centre of the palm
  reach: { anchor: [560, 620], mpp: 0.00026 },
  claw: { anchor: [540, 640], mpp: 0.00026 },
};

function norm(w) { return w.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export class Shots {
  constructor(world, tl, post, cfg) {
    this.w = world;
    this.tl = tl;
    this.post = post;
    this.cfg = cfg;
    this.scenes = tl.scenes.map((s) => ({
      ...s,
      T: s.end - s.start,
      L: s.lines.map((l) => ({ ...l, s: l.start - s.start, e: l.end - s.start, words: l.words.map((w) => ({ w: norm(w.w), s: w.s - s.start, e: w.e - s.start })) })),
    }));
    for (const s of this.scenes) s.hit = s.lines.find((l) => l.hit !== undefined)?.hit - s.start;
    for (const u of [world.particles.snow.u, world.particles.snow2.u, world.particles.sprites.u, world.maxLamp.dustU, world.erikLamp.dustU, world.props.flashLamp.dustU]) u.uPx.value = cfg.SCALE;
  }

  word(sc, w, nth = 0) {
    const target = norm(w);
    let k = 0;
    for (const l of sc.L) for (const x of l.words) if (x.w === target) { if (k === nth) return x.s; k++; }
    return null;
  }

  sceneAt(t) {
    for (const s of this.scenes) if (t < s.end - 1e-6) return s;
    return this.scenes[this.scenes.length - 1];
  }

  // ------------------------------------------------------------ reset
  reset(t) {
    const w = this.w;
    Object.assign(this.post.p, {
      bloom: 0.5, threshold: 1.0, knee: 0.6, exposure: 1, vignette: 0.55, grain: 0.03, ca: 0, fade: 0, flash: 0,
      flashColor: [1, 1, 1], focus: 5, focusRange: 3, maxBlur: 0, nearBlur: 1, sat: 1, contrast: 1.05, lift: [0, 0, 0], shadowTint: [0, 0.25, 0.6],
    });
    w.sky.setPreset('night');
    w.sky.uniforms.uTime.value = t;
    w.sky.uniforms.uBright.value = 1;
    w.sky.uniforms.uMoonDir.value.set(0.22, 0.2, -0.95).normalize();
    w.sky.mesh.visible = true;
    w.mountains.visible = true;
    const mu = w.mountains.userData.uniforms;
    mu.uLight.value.set(0.42, 0.52, 0.78); mu.uSnow.value.set(0.26, 0.33, 0.48); mu.uRock.value.set(0.02, 0.028, 0.045);
    mu.uFog.value.set(0.025, 0.055, 0.1); mu.uAmb.value = 0.1; mu.uWarm.value.set(0, 0, 0); mu.uBright.value = 1;
    mu.uMoonDir.value.set(0.6, 0.5, 0.3).normalize();
    w.mountains.userData.fogMat.uniforms.uTime.value = t;
    w.mountains.userData.fogMat.uniforms.uAlpha.value = 0.7;
    w.hemi.color.set(0x3b5f8f); w.hemi.groundColor.set(0x050a14); w.hemi.intensity = 0.3;
    w.moon.color.set(0x9db8ff); w.moon.intensity = 0.7; w.moon.position.set(30, 40, 60);
    w.fill.intensity = 0; w.fill.color.set(0x4a90d0); w.fill.distance = 6;
    w.bounce.intensity = 0;
    const G = w.glacier.userData;
    const iu = G.wallIce.userData.u;
    iu.uWarmCol.value.set(0, 0, 0); iu.uWarmPos.value.set(0, -1000, 0);
    for (const m of [G.ice, G.wallIce]) { const u = m.userData.u; u.uHandCrack.value = 0; u.uGlow.value = 0.25; u.uCrackAmt.value = 1; u.uFrostAmt.value = 1; u.uDeep.value = 1; }
    G.ice.roughness = 0.3; G.wallIce.roughness = 0.36; G.wallIce.thickness = 0.9; G.ice.thickness = 0.9; G.wallIce.specularIntensity = 1;
    G.deep.userData.u.uGlowAmt.value = 1;
    G.deep.userData.u.uExtraCol.value.set(0, 0, 0);
    G.snow.userData.u.uSparkle.value = 1;
    w.glacier.visible = true;
    w.cap.visible = w.capBack.visible = false;
    w.fullframe.mesh.visible = false;
    for (const f of [w.max, w.erik, w.friendBlue, w.friendGreen, w.rescuerA, w.rescuerB]) { f.root.visible = false; f.root.rotation.set(0, 0, 0); f.root.position.set(0, 0, 0); }
    w.maxLamp.set(0, t); w.erikLamp.set(0, t);
    w.max.M.lens.color.setRGB(0.2, 0.15, 0.1);
    w.erik.M.lens.color.setRGB(0.2, 0.2, 0.2);
    const F = w.frozen;
    F.man.root.visible = false;
    for (const k in F.planes) { F.planes[k].visible = false; F.planes[k].material.emissive.setScalar(0); }
    for (const c of F.crowd) c.root.visible = !this.cfg.LITE;
    if (F.glowCard) F.glowCard.visible = false;
    const GU = G.wallIce.userData.u; GU.uFrostVis.value = 0.12; G.ice.userData.u.uFrostVis.value = 0.12;
    FROZEN_U.uVis.value = 0.16;
    FROZEN_U.uFadeCol.value.set(0.015, 0.07, 0.14);
    for (const p of w.props.all) p.visible = false;
    w.props.flashLamp.set(0, t);
    for (const l of w.props.lanterns) l.userData.light.intensity = 0;
    w.props.searchLight.intensity = 0;
    w.props.maxRadio.userData.ledLight.intensity = 0;
    const PS = w.particles;
    PS.snow.points.visible = false; PS.snow.u.uAlpha.value = 0; PS.snow.u.uTime.value = t; PS.snow.u.uTurb.value = 0.4;
    PS.snow2.points.visible = false; PS.snow2.u.uAlpha.value = 0; PS.snow2.u.uTime.value = t;
    PS.sprites.begin(); PS.chunks.begin(); PS.chips.begin();
    w.camera.up.set(0, 1, 0);
  }

  cam(pos, target, fov = 35, roll = 0, near = 0.05) {
    const c = this.w.camera;
    c.position.copy(pos);
    c.lookAt(target);
    if (roll) c.rotateZ(roll);
    c.fov = fov;
    c.near = near;
    c.far = near < 0.2 ? 400 : 4000;
    c.aspect = this.cfg.W / this.cfg.H;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
  }

  drift(t, amp = 0.02) {
    return V(fbm1(t * 0.23, 3) * amp, fbm1(t * 0.19, 8) * amp, fbm1(t * 0.17, 13) * amp * 0.5);
  }

  shakeVec(t, t0, dur, amp) {
    const k = t < t0 ? 0 : Math.max(0, 1 - (t - t0) / dur);
    if (k <= 0) return V(0, 0, 0);
    const s = shake(t, amp * k * k, 22, Math.floor(t0 * 10));
    return V(s[0], s[1], s[2]);
  }

  project(v) {
    const p = v.clone().project(this.w.camera);
    return { x: (p.x * 0.5 + 0.5) * 1080, y: (-p.y * 0.5 + 0.5) * 1920, behind: p.z > 1 };
  }

  headWorld(fig, up = 0.12) {
    fig.J.head.updateMatrixWorld(true);
    return new THREE.Vector3(0, up, 0).applyMatrix4(fig.J.head.matrixWorld);
  }

  tag(text, fig, t, t0, dur = 2.6, lift = 0.38) {
    const a = ramp(t, t0, t0 + 0.3) * (1 - ramp(t, t0 + dur - 0.4, t0 + dur));
    if (a <= 0) return null;
    const p = this.project(this.headWorld(fig).add(V(0, lift, 0)));
    if (p.behind) return null;
    return { text, x: p.x, y: p.y, size: 36, alpha: a };
  }

  // daytime look: the sky keeps its colour, the ice stays deep blue instead of neon cyan
  dayLook(kind) {
    const w = this.w, P = this.post.p, du = w.glacier.userData.deep.userData.u;
    const cfg = {
      sunset: { glow: 0.55, sky: 0.75, exp: 0.9, top: [0.07, 0.16, 0.3] },
      dawn: { glow: 0.5, sky: 0.62, exp: 0.88, top: [0.06, 0.15, 0.3] },
      sunrise: { glow: 0.5, sky: 0.6, exp: 0.86, top: [0.06, 0.15, 0.3] },
    }[kind];
    du.uGlowAmt.value = cfg.glow;
    du.uTopCol.value.set(...cfg.top);
    w.sky.uniforms.uBright.value = cfg.sky;
    P.exposure = cfg.exp;
    P.sat = 1.05;
    w.glacier.userData.snow.userData.u.uSparkle.value = 0.5;
  }

  // ------------------------------------------------------------ crack helpers
  envCrackNight(glow = 0.25) {
    const w = this.w;
    w.sky.mesh.visible = false;          // never visible 40 m down; skipping them saves a full-screen pass
    w.mountains.visible = false;
    w.moon.intensity = 0.0;
    w.hemi.intensity = 0.05;
    w.hemi.color.set(0x2a4a7a);
    w.glacier.userData.deep.userData.u.uGlowAmt.value = glow;
    this.post.p.exposure = 1.3;
  }

  maxOnLedge(pose, lamp = 0, t = 0, headTurn = [0, 0, 0], beam = 1, aim = null, aimK = 1) {
    const m = this.w.max;
    m.root.visible = true;
    m.root.position.copy(SEAT);
    m.root.rotation.set(0, Math.PI / 2, 0);
    const p = { ...pose };
    p.neck = [(pose.neck?.[0] ?? 0) + headTurn[0] * 0.5, (pose.neck?.[1] ?? 0) + headTurn[1] * 0.5, (pose.neck?.[2] ?? 0) + headTurn[2] * 0.5];
    p.head = [(pose.head?.[0] ?? 0) + headTurn[0] * 0.5, (pose.head?.[1] ?? 0) + headTurn[1] * 0.5, (pose.head?.[2] ?? 0) + headTurn[2] * 0.5];
    applyPose(m, p);
    m.J.chest.rotation.z += Math.sin(t * 31) * 0.006;
    m.J.neck.rotation.x += Math.sin(t * 27 + 1) * 0.004;
    m.root.updateMatrixWorld(true);
    if (aim) this.aimHead(aim, aimK);
    this.lamp(lamp, t, beam);
  }

  // Max's headlamp: spotlight + beam + warm scattering in the ice + bounce light back onto Max
  lamp(k, t, beam = 1, dust = Math.max(beam, 0.6)) {
    const w = this.w;
    w.maxLamp.set(k, t, beam, dust);
    w.max.M.lens.color.setRGB(0.25 + k * 3.5, 0.18 + k * 2.4, 0.1 + k * 1.3);
    if (k <= 0.001) return;
    const lampObj = w.max.J.lamp;
    lampObj.updateMatrixWorld(true);
    const o = new THREE.Vector3().setFromMatrixPosition(lampObj.matrixWorld);
    const d = new THREE.Vector3(0, 0, 1).transformDirection(lampObj.matrixWorld);
    let hit = null;
    for (let s = 0.05; s < 4; s += 0.02) {
      const p = o.clone().addScaledVector(d, s);
      if (p.x >= wallX(1, p.y, p.z) || p.x <= wallX(-1, p.y, p.z) || p.y < LEDGE_Y - 0.05) { hit = p; break; }
    }
    if (hit) {
      const u = w.glacier.userData.wallIce.userData.u;
      u.uWarmPos.value.copy(hit);
      u.uWarmCol.value.set(1.0, 0.55, 0.22).multiplyScalar(k * 0.6);
      u.uWarmRad.value = 0.32;
      w.bounce.position.copy(hit).lerp(o, 0.3);
      w.bounce.intensity = 0.9 * k;
    }
  }

  breath(t, period = 3.2, strength = 1, offset = 0) {
    const m = this.w.max;
    m.J.head.updateMatrixWorld(true);
    const mouth = new THREE.Vector3(0, 0.07, 0.13).applyMatrix4(m.J.head.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(m.J.head.matrixWorld);
    const PS = this.w.particles.sprites;
    for (let k = 0; k < 3; k++) {
      const age = (t + offset + k * period) % (period * 3);
      if (age > 2.2) continue;
      const a = Math.sin(Math.PI * clamp(age / 2.2)) * 0.12 * strength;
      for (let j = 0; j < 4; j++) {
        const sp = age * (0.1 + j * 0.03);
        PS.add(mouth.x + fwd.x * sp + Math.sin(j * 2.1 + age) * 0.02, mouth.y + age * 0.05 + j * 0.008, mouth.z + fwd.z * sp + Math.cos(j * 1.7) * 0.02,
          0.03 + age * 0.04, a * (1 - j * 0.18), 0.75, 0.78, 0.82);
      }
    }
  }

  frozenMan(pose, depth = 0.2, faceMax = true, yOff = 0) {
    const F = this.w.frozen;
    const r = F.man.root;
    r.visible = true;
    const xw = rightWall(EYE_Y + yOff);
    r.position.set(xw + depth + 0.1, LEDGE_Y - 0.84 + yOff, FM_Z);
    r.rotation.set(0, faceMax ? -Math.PI / 2 : Math.PI / 2, 0);
    applyPose(F.man, pose);
    r.updateMatrixWorld(true);
    return r;
  }

  // place a GPT image plane inside the right wall so its anchor pixel lands on `anchor` (y,z),
  // `depth` metres behind the wall surface; size from the calibration (x `scale`)
  img(key, depth, anchorY, anchorZ = FM_Z, o = {}) {
    const pl = this.w.frozen.planes[key];
    if (!pl) return null;
    const c = IMG[key];
    const im = pl.material.map.image;
    const mpp = c.mpp * (o.scale ?? 1);
    const Wm = im.width * mpp, Hm = im.height * mpp;
    pl.visible = true;
    pl.scale.set(Wm / pl.geometry.parameters.width, Hm / pl.geometry.parameters.height, 1);
    const dx = (c.anchor[0] - im.width / 2) * mpp;   // +u -> world +z
    const dy = (im.height / 2 - c.anchor[1]) * mpp;
    pl.position.set(o.x ?? rightWall(anchorY, anchorZ) + depth, anchorY - dy, anchorZ - dx);
    pl.rotation.set(0, -Math.PI / 2, o.roll ?? 0);
    pl.material.color.setScalar(0.42 * (o.bright ?? 1));
    pl.material.emissive.setScalar(o.glow ?? 0.035);
    return pl;
  }

  // turn Max's head so his headlamp points at `target` (exact, 2 iterations), blended by k
  aimHead(target, k = 1) {
    if (k <= 0) return;
    const m = this.w.max, head = m.J.head, lamp = m.J.lamp;
    for (let i = 0; i < 2; i++) {
      m.root.updateMatrixWorld(true);
      const o = new THREE.Vector3().setFromMatrixPosition(lamp.matrixWorld);
      const cur = new THREE.Vector3(0, 0, 1).transformDirection(lamp.matrixWorld);
      const want = target.clone().sub(o).normalize();
      const qd = new THREE.Quaternion().setFromUnitVectors(cur, want);
      const qd2 = new THREE.Quaternion().slerp(qd, k);
      const hw = head.getWorldQuaternion(new THREE.Quaternion());
      const pw = head.parent.getWorldQuaternion(new THREE.Quaternion());
      head.quaternion.copy(pw.invert().multiply(qd2.multiply(hw)));
    }
    m.root.updateMatrixWorld(true);
  }

  // soft light scattering in the deep ice behind the frozen man, so he reads as a dark shape from the front
  glowBehind(k, y = EYE_Y - 0.45) {
    const u = this.w.glacier.userData.deep.userData.u;
    u.uExtraPos.value.set(rightWall(y) + 0.4, y, -7.5);
    u.uExtraCol.value.set(0.55, 0.36, 0.2).multiplyScalar(k);
    u.uExtraRad.value = 1.0;
  }

  // over-the-shoulder -> point of view. p=0: above/behind the helmet (helmet blurred at the bottom
  // of the frame); p=1: in front of Max's face, close on the wall. The path arcs over his head.
  ots(t, target, p, o = {}) {
    const head = this.headWorld(this.w.max, 0.12);            // helmet centre
    const dir = target.clone().sub(head); dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const fwd = lerp(-(o.back ?? 0.78), o.front ?? 0.5, p);
    const up = (o.up ?? 0.26) * (1 - smoothstep(0.7, 0.95, p)) - 0.04;   // stays above the helmet until past it
    const side = (o.side ?? 0.08) * (1 - p);
    const pos = head.clone().addScaledVector(dir, fwd).addScaledVector(right, side).add(V(0, up, 0));
    pos.add(this.drift(t, 0.005));
    if (o.shake) pos.add(o.shake);
    this.cam(pos, target, o.fov ?? lerp(36, 30, p), o.roll ?? 0, 0.02);
    const P = this.post.p;
    const surf = V(rightWall(target.y, target.z), target.y, target.z);   // depth buffer sees the ice surface
    P.maxBlur = 0.9;
    P.focus = pos.distanceTo(surf);
    P.focusRange = o.focusRange ?? Math.max(0.15, P.focus * 0.35);
    P.nearBlur = 1.6;
    this.w.glacier.userData.wallIce.specularIntensity = 0.25;
    this.w.glacier.userData.wallIce.userData.u.uDeep.value = 0.45;     // paler tint, less green on warm images
    this.w.maxLamp.light.intensity *= 0.45;                               // no blown-out hotspot on the face
    if (p > 0.55) this.w.glacier.userData.wallIce.userData.u.uWarmCol.value.multiplyScalar(0.15);
    this.w.bounce.intensity *= 0.6;
    this.w.cap.visible = this.w.capBack.visible = true;
    return pos;
  }

  sideLedge(t, o = {}) {
    // side view of the ledge through the cut face
    const pos = V(o.x ?? 0.08, o.y ?? -39.0, o.z ?? 5.2).add(this.drift(t, o.drift ?? 0.012));
    const tgt = V(o.tx ?? 0.05, o.ty ?? -39.3, -0.45);
    this.cam(pos, tgt, o.fov ?? 38, 0, 0.05);
    const P = this.post.p;
    P.maxBlur = 0.45; P.focus = pos.distanceTo(V(tgt.x, tgt.y, -0.45)); P.focusRange = 1.4;
  }

  // ------------------------------------------------------------ main entry
  apply(t, opt = {}) {
    const sc = this.sceneAt(t);
    const lt = t - sc.start;
    this.reset(t);
    const ov = { day: null, caption: null, labels: [], lines: [] };
    this['s' + sc.id](sc, lt, t, ov);
    for (const c of sc.captions) if (t >= c.start && t < c.end) ov.caption = c;
    if (ov.hideCaption) ov.caption = null;
    if (sc.label && !ov.noDay) {
      ov.day = { text: sc.label, t0: sc.start + 0.06, battery: sc.battery, blink: sc.battery !== null && sc.battery > 0.1 && sc.battery < 0.3, alpha: ov.dayAlpha ?? 1 };
    }
    ov.labels = ov.labels.filter(Boolean);
    if (this.w.fullframe.mesh.visible) this.w.fullframe.fit(this.w.camera);
    // only pay for lights that are on (three.js caches one program per light combination)
    const W0 = this.w;
    for (const l of [W0.moon, W0.fill, W0.bounce, W0.maxLamp.light, W0.erikLamp.light, W0.props.flashLamp.light, W0.props.searchLight,
      ...W0.props.lanterns.map((x) => x.userData.light), W0.props.maxRadio.userData.ledLight]) l.visible = l.intensity > 1e-4;
    this.w.particles.sprites.end();
    this.w.particles.chunks.end();
    this.w.particles.chips.end();
    return ov;
  }

  // ============================================================ SCENE 1 — HOOK (DAY 4)
  s1(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const hit = sc.hit; // "moved"
    if (lt >= hit) {
      if (lt < hit + 0.4) { this.handFlash(t, lt - hit); return; }
      P.fade = 1; ov.hideCaption = true; ov.noDay = true; return;
    }
    w.glacier.userData.deep.userData.u.uGlowAmt.value = 1.0;
    FROZEN_U.uVis.value = 0.17;
    this.maxOnLedge(POSES.slumped, 0.3, t, [0.1, 0, 0], 1, V(rightWall(EYE_Y) + 0.12, EYE_Y - 0.03, FM_Z), 0.85);
    this.breath(t, 3.4, 0.8);
    this.frozenMan({ ...POSES.frozen, shR: [-1.55, 0, -0.35], elR: [-0.75, 0, 0] }, 0.1);
    this.glowBehind(0.6 * smoothstep(5.0, 8.0, lt));
    const k1 = ep(lt, 0.0, 5.4, ease.inOutSine);
    const k2 = ep(lt, 4.6, 8.6, ease.inOutCubic);
    const k3 = ep(lt, 8.4, hit, ease.inOutSine);
    // wide (sky, peaks, moon, cut-open glacier) -> push down the crack -> side view of the ledge -> push toward the frozen shape
    const pA = V(0, 3, 96), tA = V(0, 4, 0);
    const pB = V(0.25, -24, 30), tB = V(-0.05, -37.5, 0);
    const pC = V(0.08, -39.0, 5.6), tC = V(0.05, -39.25, -0.45);
    const pD = V(0.22, -39.08, 3.0), tD = V(0.28, -39.2, -0.45);
    const pos = pA.clone().lerp(pB, k1).lerp(pC, k2).lerp(pD, k3);
    const tgt = tA.clone().lerp(tB, k1).lerp(tC, k2).lerp(tD, k3);
    pos.add(this.drift(t, 0.03 + (1 - k2) * 0.25));
    const deep = smoothstep(3.0, 7.5, lt);
    w.moon.intensity = lerp(0.7, 0.0, deep);
    w.hemi.intensity = lerp(0.3, 0.05, deep);
    w.glacier.userData.deep.userData.u.uGlowAmt.value = lerp(1.0, 0.3, deep);
    P.exposure = lerp(1.05, 1.35, deep);
    this.cam(pos, tgt, lerp(30, 36, k2), 0, lerp(1.0, 0.05, k2));
    P.maxBlur = 0.45 * k2; P.focus = pos.distanceTo(V(0.2, -39.1, -0.45)); P.focusRange = 1.6;
    ov.labels.push(this.tag('MAX', w.max, t, sc.start + 6.4, 2.6, 0.42));
    if (lt > 6.8 && lt < 9.6) {
      const p = this.project(this.headWorld(w.frozen.man).add(V(0, 0.42, 0)));
      ov.labels.push({ text: '???', x: p.x, y: p.y, size: 36, alpha: ramp(lt, 6.8, 7.1) * (1 - ramp(lt, 9.2, 9.6)) });
    }
  }

  handFlash(t, a) {
    const P = this.post.p;
    this.envCrackNight(0.3);
    this.maxOnLedge(POSES.eyesShut, 0.7, t, [0, 0.2, 0], 0.15, V(rightWall(EYE_Y) , EYE_Y, FM_Z + 0.2));
    this.handShot(t, 0.42, 0.97, true);
    P.ca = 0.014 * (1 - a / 0.4) + 0.004;
    P.exposure = 1.7 - a;
    P.flash = Math.max(0, 0.3 - a * 1.4);
    P.flashColor = [0.75, 0.9, 1.0];
    const s = this.shakeVec(t, t - a, 0.4, 0.03);
    const c = this.w.camera;
    c.position.add(s);
    c.rotateZ(s.z * 0.4);
    c.updateMatrixWorld(true);
  }

  // the frozen hand pressed flat against the inside of the ice, next to Max's face (day 4)
  handShot(t, crack = 0.3, p = 0.4, flash = false) {
    const w = this.w;
    const handY = EYE_Y + 0.02, handZ = FM_Z + 0.2;
    const xw = rightWall(handY, handZ);
    this.frozenMan({ ...POSES.frozen, shR: [-1.6, 0, -0.42], elR: [-0.9, 0, 0], neck: [0.0, 0, 0], head: [0.05, 0, 0] }, 0.05);
    w.frozen.man.sculpt.userData.setEyes(true);
    const hand = this.img('hand', 0.015, handY, handZ, { glow: flash ? 0.35 : 0.18 });
    const face = this.img('open', 0.16, EYE_Y - 0.02, FM_Z - 0.12, { bright: 0.75, glow: 0.06 });
    if (hand) w.frozen.man.root.visible = false;
    const G = w.glacier.userData;
    G.wallIce.userData.u.uHandPos.value.set(xw, handY + 0.1, handZ);
    G.wallIce.userData.u.uHandCrack.value = crack;
    G.wallIce.roughness = 0.17;
    G.wallIce.thickness = 0.5;
    G.wallIce.userData.u.uFrostVis.value = 0.32;
    const target = V(xw, handY + 0.0, handZ - 0.05);
    this.ots(t, target, p, { fov: lerp(38, 30, p) });
    w.fill.intensity = flash ? 2.2 : 0.25;
    w.fill.color.set(flash ? 0xbfe4ff : 0x3a78c0);
    w.fill.position.set(xw - 0.35, handY + 0.25, handZ + 0.15);
  }

  // ============================================================ SCENE 2 — THE FALL
  s2(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const tBroke = (this.word(sc, 'broke') ?? 5.4) - 0.05;
    const tLedge = this.word(sc, 'ledge') ?? 8.3;
    const tRadio = (this.word(sc, 'radio') ?? 11.0) - 0.15;
    const fallStart = tBroke + 0.12;
    const fallDur = Math.max(1.6, tLedge - fallStart);
    w.sky.setPreset('sunset');
    w.moon.color.set(0xffb27a); w.moon.intensity = 1.3; w.moon.position.set(-60, 14, 40);
    w.hemi.color.set(0xffc2b0); w.hemi.groundColor.set(0x3a4a70); w.hemi.intensity = 1.1;
    const mu = w.mountains.userData.uniforms;
    mu.uLight.value.set(1.0, 0.55, 0.35); mu.uFog.value.set(0.4, 0.22, 0.22); mu.uSnow.value.set(0.8, 0.62, 0.6); mu.uWarm.value.set(0.4, 0.15, 0.05);
    mu.uMoonDir.value.set(-0.8, 0.3, 0.4).normalize();
    this.dayLook('sunset');
    FROZEN_U.uVis.value = 0.14;
    P.shadowTint = [0.1, 0.15, 0.4];
    const m = w.max;
    m.root.visible = true;
    const bridgeX = crackCenter(0);
    const PS = w.particles;
    if (lt < fallStart) {
      const x = lerp(-9.5, bridgeX - 0.05, ramp(lt, 0, tBroke));
      m.root.position.set(x, snowTop(x), -1.2);
      m.root.rotation.set(0, Math.PI / 2, 0);
      const phase = lt * 7.2;
      let pose = walkPose(phase, lt < tBroke - 0.15 ? 1 : 0.3);
      pose = { ...pose, shR: [-0.4 + Math.sin(phase) * 0.3, 0, -0.2], elR: [-0.9, 0, 0] };
      if (lt > tBroke - 0.2) pose = blendPose(pose, POSES.fall, ramp(lt, tBroke - 0.2, fallStart) * 0.6);
      applyPose(m, pose);
      w.props.bridge.visible = true;
      for (const pc of w.props.bridge.userData.pieces) { pc.visible = true; pc.position.copy(pc.userData.home); pc.position.x += bridgeX; pc.position.z -= 0.6; pc.rotation.set(0, 0, 0); }
      m.root.updateMatrixWorld(true);
      const axe = w.props.axe;
      axe.visible = true;
      axe.position.copy(new THREE.Vector3(0, -0.06, 0.02).applyMatrix4(m.J.wrR.matrixWorld));
      axe.quaternion.setFromRotationMatrix(m.J.wrR.matrixWorld).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0)));
      const cx = x + 0.9;   // keep Max a little left of centre, walking into the frame
      const pos = V(cx, 1.1, 9.5).add(this.drift(t, 0.04));
      const tgt = V(cx + 0.25, 1.0, -1.2);
      if (lt > tBroke - 0.4) pos.add(this.shakeVec(t, sc.start + tBroke, 0.6, 0.06));
      this.cam(pos, tgt, 36, 0, 0.5);
      P.maxBlur = 0.2; P.focus = 14; P.focusRange = 8;
      ov.labels.push(this.tag('MAX', m, t, sc.start + 1.4, 2.6, 0.4));
      ov.dayAlpha = 1 - ramp(lt, 1.0, 1.4);
    } else if (lt < tLedge + 0.9) {
      const ft = lt - fallStart;
      const k = clamp(ft / fallDur);
      const y = lerp(0.0, LEDGE_Y + 0.25, k * k);
      const landed = lt >= tLedge;
      if (!landed) {
        m.root.position.set(bridgeX + 0.1 + Math.sin(ft * 2) * 0.05, y - 0.9, -1.2 + k * 0.6);
        m.root.rotation.set(0, Math.PI / 2, 0);
        applyPose(m, { ...POSES.fall, shL: [-0.3 + Math.sin(ft * 9) * 0.4, 0, 2.4], shR: [-0.5 + Math.cos(ft * 8) * 0.4, 0, -2.2], hipsRot: [Math.sin(ft * 3) * 0.3, 0, ft * 0.8] });
      } else {
        m.root.position.set(SEAT.x + 0.05, SEAT.y, -0.75);
        m.root.rotation.set(0, Math.PI / 2, 0);
        applyPose(m, POSES.lieBroken);
      }
      m.root.updateMatrixWorld(true);
      w.props.bridge.visible = true;
      for (const pc of w.props.bridge.userData.pieces) {
        const d = Math.max(0, ft - pc.userData.delay);
        pc.position.copy(pc.userData.home);
        pc.position.x += bridgeX;
        pc.position.z -= 0.6;
        pc.position.y -= 0.5 * 9.8 * d * d * 0.92;
        pc.rotation.set(pc.userData.spin.x * d, pc.userData.spin.y * d, pc.userData.spin.z * d);
        pc.visible = pc.position.y > LEDGE_Y + 0.2;
      }
      const rnd = mulberry32(42);
      for (let i = 0; i < 80; i++) {
        const d0 = rnd() * 0.5, sp = 0.85 + rnd() * 0.3;
        const d = Math.max(0, ft - d0);
        const cy = -0.2 - 0.5 * 9.8 * d * d * sp;
        if (cy < LEDGE_Y + 0.1) continue;
        PS.chunks.add(bridgeX + (rnd() - 0.5) * 1.1, cy, -0.4 - rnd() * 2.0, d * rnd() * 9, d * rnd() * 7, d * rnd() * 5, 0.15 + rnd() * 0.5);
      }
      const camY = landed ? LEDGE_Y + 0.9 : lerp(-1.0, LEDGE_Y + 1.1, Math.pow(k, 1.8));
      const pos = V(bridgeX + 0.4, camY + 0.6, 7.0);
      const tgt = V(bridgeX + 0.25, camY - 0.6, -0.6);
      if (landed) pos.add(this.shakeVec(t, sc.start + tLedge, 0.7, 0.16));
      this.cam(pos, tgt, 44, Math.sin(ft * 1.3) * 0.02 * (landed ? 0 : 1), 0.2);
      P.maxBlur = 0.3; P.focus = 7.3; P.focusRange = 4;
      const depthK = clamp(-camY / 40);
      w.moon.intensity = lerp(1.3, 0.1, depthK);
      w.hemi.intensity = lerp(0.5, 0.1, depthK);
      w.glacier.userData.deep.userData.u.uGlowAmt.value = lerp(0.55, 0.35, depthK);
      w.fill.intensity = 0.7 * depthK; w.fill.color.set(0x4a7ab0); w.fill.position.set(SEAT.x + 0.4, LEDGE_Y + 1.2, 0.8);
      P.exposure = lerp(1.0, 1.3, depthK);
      if (landed) {
        const a = lt - tLedge;
        for (let i = 0; i < 26; i++) {
          const ang = i * 2.399, r = 0.15 + a * (0.6 + (i % 5) * 0.12);
          PS.sprites.add(SEAT.x + 0.15 + Math.cos(ang) * r, LEDGE_Y + 0.1 + a * 0.25 + (i % 3) * 0.05, -0.75 + Math.sin(ang) * r * 0.6,
            0.12 + a * 0.25, 0.45 * (1 - ramp(a, 0.1, 0.9)), 0.9, 0.95, 1.0);
        }
      }
      // dotted "40 METERS" measuring line beside the fall
      const lx = bridgeX + 1.15;
      const topP = this.project(V(lx, 0.0, 0.05));
      const botP = this.project(V(lx, landed ? LEDGE_Y + 0.05 : y, 0.05));
      const y1 = Math.max(topP.y, -50), y2 = botP.y;
      const la = ramp(ft, 0.1, 0.4) * (1 - ramp(lt, tLedge + 0.6, tLedge + 0.9));
      ov.lines.push({ x: botP.x, y1, y2, progress: 1, alpha: la });
      ov.labels.push({ text: '40 METERS', x: botP.x - 150, y: clamp((Math.max(y1, 300) + y2) / 2, 420, 1180), size: 44, alpha: la });
      ov.dayAlpha = 0;
    } else {
      // close-ups: the broken leg, then the radio blinking out
      w.moon.intensity = 0.08; w.hemi.intensity = 0.1;
      w.glacier.userData.deep.userData.u.uGlowAmt.value = 0.45;
      m.root.position.set(SEAT.x + 0.05, SEAT.y, -0.75);
      m.root.rotation.set(0, Math.PI / 2, 0);
      applyPose(m, { ...POSES.lieBroken, head: [0.2 + Math.sin(lt * 3) * 0.05, 0.4, 0] });
      m.root.updateMatrixWorld(true);
      const radio = w.props.maxRadio;
      radio.visible = true;
      radio.position.set(SEAT.x + 0.45, LEDGE_Y + 0.05, -0.22);
      radio.rotation.set(-Math.PI / 2 + 0.25, 0.3, 0.9);
      const ledT = lt - tRadio;
      const blink = ledT < 0 ? Math.floor(lt * 2.5) % 2 : ledT < 1.2 ? Math.floor(ledT * (6 - ledT * 3)) % 2 : 0;
      const fadeLed = 1 - ramp(ledT, 0.6, 1.3);
      radio.userData.ledMat.color.setRGB(blink ? 2.5 * fadeLed + 0.05 : 0.05, 0.15 * blink * fadeLed, 0.05 * blink * fadeLed);
      radio.userData.ledLight.intensity = blink ? 0.6 * fadeLed : 0;
      w.fill.intensity = 1.0; w.fill.color.set(0x5a86c0); w.fill.position.set(SEAT.x + 0.5, LEDGE_Y + 0.9, 0.6);
      m.J.knR.updateMatrixWorld(true);
      const knee = new THREE.Vector3().setFromMatrixPosition(m.J.knR.matrixWorld);
      if (lt < tRadio) {
        // medium side shot: Max crumpled on the ledge, his right leg bent the wrong way
        const k = ep(lt, tLedge + 0.9, tRadio, ease.inOutSine);
        const pos = V(knee.x - 0.15, knee.y + 0.75 - k * 0.15, 3.2 - k * 0.9).add(this.drift(t, 0.01));
        this.cam(pos, knee.clone().add(V(-0.25, -0.05, 0)), 36, -0.02, 0.05);
        P.maxBlur = 0.4; P.focus = pos.distanceTo(knee); P.focusRange = 1.2;
        w.fill.intensity = 3.0; w.fill.color.set(0x8ab0e0); w.fill.position.set(knee.x + 0.2, knee.y + 1.2, knee.z + 1.4); w.fill.distance = 5;
        P.exposure = 1.45;
      } else if (w.fullframe.setImage(w.frozen.images.radio)) {
        // GPT insert: the smashed radio, its red light blinking and dying
        const ff = w.fullframe;
        const k = ep(lt, tRadio, sc.T, ease.inOutSine);
        w.glacier.visible = false; w.sky.mesh.visible = false; w.mountains.visible = false; m.root.visible = false;
        for (const c of w.frozen.crowd) c.root.visible = false;
        ff.mesh.visible = true;
        ff.u.uZoom.value = 1.0 + 0.1 * k;
        ff.u.uWarp.value = 0.02 * k;
        ff.u.uCenter.value.set(0.44, 0.46);
        ff.u.uPan.value.set(0, 0);
        ff.u.uBright.value = 0.95;
        for (const pl of ff.u.uPools.value) pl.w = 0;
        ff.u.uLed.value.set(412 / 941, 1 - 921 / 1672, 0.006, blink ? 1.2 * fadeLed : 0);
        ff.u.uLedKill.value = blink ? 0 : 1;
        this.cam(V(0, 0, 0), V(0, 0, -1), 40, 0, 0.05);
        P.maxBlur = 0; P.vignette = 0.6;
      } else {
        const rp = radio.position;
        const k = ramp(lt, tRadio, sc.T);
        const pos = V(rp.x - 0.12, rp.y + 0.32 - k * 0.04, rp.z + 0.42 - k * 0.08).add(this.drift(t, 0.006));
        this.cam(pos, rp.clone().add(V(0, 0.01, 0)), 34, 0.04, 0.03);
        P.maxBlur = 0.8; P.focus = pos.distanceTo(rp); P.focusRange = 0.22;
      }
      if (lt >= tRadio) P.exposure = 1.3;
      ov.dayAlpha = 0;
    }
    PS.snow.points.visible = true;
    PS.snow.u.uCenter.value.copy(w.camera.position);
    PS.snow.u.uBox.value.set(14, 14, 14);
    PS.snow.u.uVel.value.set(0.4, -0.5, 0);
    PS.snow.u.uSize.value = 30;
    PS.snow.u.uAlpha.value = 0.45;
    PS.snow.u.uColor.value.set(1.0, 0.85, 0.75);
  }

  // ============================================================ SCENE 3 — THE STORM
  s3(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const T = sc.T;
    const storm = ep(lt, 1.6, 4.4, ease.inOutSine);
    w.sky.setPreset('sunset', 'storm', 0.55 + storm * 0.45);
    w.moon.color.set(0x8aa0c0); w.moon.intensity = lerp(0.5, 0.25, storm); w.moon.position.set(-30, 40, 30);
    w.hemi.color.set(0x56657a); w.hemi.groundColor.set(0x0a0f18); w.hemi.intensity = lerp(0.35, 0.22, storm);
    const mu = w.mountains.userData.uniforms;
    mu.uFog.value.set(0.08, 0.09, 0.11); mu.uLight.value.set(0.4, 0.42, 0.5); mu.uBright.value = lerp(1, 0.6, storm);
    w.mountains.userData.fogMat.uniforms.uAlpha.value = 0.75 + storm * 0.25;
    w.glacier.userData.deep.userData.u.uGlowAmt.value = 0.6;
    FROZEN_U.uVis.value = 0.14;
    const [tA, tB] = w.props.tents;
    tA.visible = tB.visible = true;
    tA.position.set(CAMP.x - 1.2, snowTop(CAMP.x - 1.2), CAMP.z - 1.5);
    tA.rotation.y = 0.25;
    tB.position.set(CAMP.x + 2.0, snowTop(CAMP.x + 2), CAMP.z - 2.4);
    tB.rotation.y = -0.35;
    for (const tn of [tA, tB]) {
      const ud = tn.userData, p = ud.geo.attributes.position, b = ud.base;
      const amp = 0.02 + storm * 0.07;
      for (let i = 0; i < p.count; i++) {
        const f = Math.max(0, b[i * 3 + 1]);
        p.setX(i, b[i * 3] + Math.sin(t * 13 + b[i * 3 + 2] * 3) * amp * f);
        p.setZ(i, b[i * 3 + 2] + Math.sin(t * 17 + b[i * 3] * 2) * amp * f * 0.6);
      }
      p.needsUpdate = true;
      ud.mat.emissive.setRGB(0.25, 0.08, 0.02).multiplyScalar(0.6 + 0.4 * Math.sin(t * 9) * storm);
    }
    const [l1, l2] = w.props.lanterns;
    l1.visible = l2.visible = true;
    const flick = 0.85 + 0.15 * noise1(t * 8, 3) - storm * 0.2 * Math.max(0, noise1(t * 5, 9));
    l1.userData.light.intensity = 3.2 * flick;
    l2.position.set(tA.position.x + 0.9, 0.12, tA.position.z + 1.3);
    l2.userData.light.intensity = 2.2 * flick;
    const fb = w.friendBlue, fg = w.friendGreen;
    fb.root.visible = fg.root.visible = true;
    fb.root.position.set(CAMP.x + 0.9, snowTop(CAMP.x + 0.9), CAMP.z + 0.4);
    fb.root.rotation.set(0, Math.PI / 2 + 0.25, 0);
    applyPose(fb, { ...POSES.flashlight, shR: [-0.9, 0.5, -0.3], elR: [-2.1, 0, 0], neck: [0.05, 0.1, 0], spine: [0.05 + storm * 0.1, 0, 0] });
    fg.root.position.set(CAMP.x - 0.4, snowTop(CAMP.x - 0.4), CAMP.z + 0.2);
    fg.root.rotation.set(0, Math.PI / 2 - 0.1, 0);
    applyPose(fg, { ...POSES.lantern, spine: [0.1 + storm * 0.12, 0, 0], neck: [0.1, 0, 0] });
    fb.root.updateMatrixWorld(true);
    fg.root.updateMatrixWorld(true);
    l1.position.copy(new THREE.Vector3(0, -0.2, 0).applyMatrix4(fg.J.wrR.matrixWorld));
    const rad = w.props.friendRadio;
    rad.visible = true;
    rad.position.copy(new THREE.Vector3(0, -0.08, 0.02).applyMatrix4(fb.J.wrR.matrixWorld));
    rad.quaternion.setFromRotationMatrix(fb.J.wrR.matrixWorld);
    const fl = w.props.flash;
    fl.visible = true;
    fl.position.copy(new THREE.Vector3(0, -0.07, 0.05).applyMatrix4(fb.J.wrL.matrixWorld));
    fl.lookAt(V(0, -0.5, -1.0));
    w.props.flashLamp.set(0.9 * (1 - storm * 0.35), t, 1.0);
    const PS = w.particles;
    PS.snow.points.visible = true;
    PS.snow.u.uCenter.value.copy(w.camera.position).add(V(0, 0, -12));
    PS.snow.u.uBox.value.set(40, 26, 30);
    PS.snow.u.uVel.value.set(lerp(1, 16, storm), lerp(-1, -3, storm), 0.5);
    PS.snow.u.uTurb.value = 0.8;
    PS.snow.u.uSize.value = 46;
    PS.snow.u.uAlpha.value = lerp(0.35, 0.9, storm);
    PS.snow.u.uColor.value.set(0.8, 0.85, 0.95);
    PS.snow2.points.visible = true;
    PS.snow2.u.uCenter.value.copy(w.camera.position).add(V(0, 0, -5));
    PS.snow2.u.uBox.value.set(14, 10, 10);
    PS.snow2.u.uVel.value.set(lerp(1, 22, storm), -2.5, 0);
    PS.snow2.u.uSize.value = 70;
    PS.snow2.u.uAlpha.value = storm * 0.7;
    PS.snow2.u.uColor.value.set(0.85, 0.9, 1.0);
    const k = ep(lt, 2.3, T, ease.inOutCubic);
    const pA = V(CAMP.x + 1.8, 1.9, CAMP.z + 7.2), tAc = V(CAMP.x + 0.4, 1.0, CAMP.z);
    const pB = V(-6, 6, 95), tBc = V(-4, -17, 0);
    const pos = pA.clone().lerp(pB, k).add(this.drift(t, 0.05 + storm * 0.05)).add(this.shakeVec(t, 0, 99, 0.012 * storm));
    const tgt = tAc.clone().lerp(tBc, k);
    this.cam(pos, tgt, lerp(38, 32, k), 0, lerp(0.2, 0.8, k));
    P.maxBlur = lerp(0.4, 0, k); P.focus = 7.5; P.focusRange = 4;
    P.exposure = lerp(1.15, 1.0, k);
    // Max is still down there in the dark, no light
    this.maxOnLedge(POSES.sitHug, 0, t);
  }

  // ============================================================ SCENE 4 — DAY 1
  s4(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const tClick = this.word(sc, 'on') ?? 1.4;
    const tMan = this.word(sc, 'man') ?? 5.9;
    this.envCrackNight(0.22);
    const dt = lt - tClick;
    const on = dt < 0 ? 0 : dt < 0.25 ? (Math.floor(dt * 40) % 3 === 0 ? 0.35 : 1) : 1;
    const xw = rightWall(EYE_Y);
    const aim = V(...keyframes(lt, [[tClick, [xw, EYE_Y - 0.75, FM_Z + 0.7]], [tClick + 1.3, [xw, EYE_Y - 0.2, FM_Z + 0.85]], [tMan - 1.0, [xw, EYE_Y + 0.15, FM_Z - 0.45]], [tMan, [xw, EYE_Y - 0.05, FM_Z]]], ease.inOutSine));
    const pose = lt < tClick + 0.3 ? POSES.sitHug : blendPose(POSES.sitHug, POSES.sitLedge, ramp(lt, tClick + 0.3, tClick + 1.2));
    const otsShot = lt >= tClick + 1.2;
    this.maxOnLedge(pose, on, t, [0, 0, 0], otsShot ? 0.2 : 1, aim, ramp(lt, tClick - 0.2, tClick + 0.6));
    this.glowBehind(on * 0.5);
    this.breath(t, 3.0, 0.9);
    this.frozenMan(POSES.frozen, 0.22, false);
    const back = this.img('back', 0.24, EYE_Y + 0.02, FM_Z, { glow: 0.1 * on });
    if (back) w.frozen.man.root.visible = false;
    FROZEN_U.uVis.value = 0.18;
    w.glacier.userData.wallIce.roughness = 0.24;
    if (!otsShot) {
      this.sideLedge(t, { z: 4.6, fov: 38 });
      w.fill.intensity = 0.1; w.fill.position.set(0, -38.6, 1.0);
    } else {
      const pp = keyframes(lt, [[tClick + 1.2, 0.0], [tMan, 0.3], [sc.T, 0.92]], ease.inOutSine);
      const target = V(rightWall(EYE_Y) + 0.2, EYE_Y - 0.1, FM_Z);
      w.glacier.userData.wallIce.userData.u.uFrostVis.value = 0.3;
      this.ots(t, target, pp, { fov: lerp(38, 32, pp) });
      w.fill.intensity = 0.15; w.fill.position.set(0.2, -38.6, 0.2);
    }
  }

  // ============================================================ SCENE 5 — DAY 2
  s5(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const L1 = sc.L[1].s;
    this.envCrackNight(0.22);
    const wake = ramp(lt, 0.3, 1.4);
    const recoil = ramp(lt, L1 - 0.55, L1 - 0.2);
    let pose = blendPose(POSES.slumped, POSES.sitLedge, wake);
    pose = blendPose(pose, POSES.recoil, recoil);
    const otsShot = lt >= L1 - 0.1;
    this.maxOnLedge(pose, 0.72 * (0.85 + 0.15 * ramp(lt, 0.2, 0.8)), t, [lerp(0.4, 0.0, wake), 0, 0], otsShot ? 0.0 : 1, V(rightWall(EYE_Y), EYE_Y - 0.18, FM_Z), wake);
    if (otsShot) w.glacier.userData.wallIce.userData.u.uWarmCol.value.multiplyScalar(0.35);
    this.glowBehind(0.5);
    this.breath(t, lt > L1 - 0.5 ? 1.4 : 2.8, 1.0);
    this.frozenMan(POSES.frozen, 0.18, true);
    w.frozen.man.sculpt.userData.setEyes(false);
    const face = this.img('closed', 0.17, EYE_Y, FM_Z, { glow: 0.12 });
    if (face) w.frozen.man.root.visible = false;
    FROZEN_U.uVis.value = 0.18;
    w.glacier.userData.wallIce.roughness = 0.2;
    if (!otsShot) {
      this.sideLedge(t, { z: 4.0, fov: 38 });
      w.camera.position.add(this.shakeVec(t, sc.start + L1 - 0.5, 0.4, 0.02));
      w.camera.updateMatrixWorld(true);
      w.fill.intensity = 0.1; w.fill.position.set(0, -38.6, 1.0);
    } else {
      const k = ep(lt, L1 - 0.1, sc.T, ease.inOutSine);
      const target = V(rightWall(EYE_Y) + 0.17, EYE_Y - 0.03, FM_Z);
      w.glacier.userData.wallIce.userData.u.uFrostVis.value = 0.3;
      this.ots(t, target, lerp(0.35, 1.0, k), { fov: lerp(36, 30, k) });
      w.fill.intensity = 0.12; w.fill.position.set(0.2, -38.6, 0.2);
    }
  }

  // ============================================================ SCENE 6 — DAY 3 (eyes open)
  s6(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const hit = sc.hit; // "open"
    const tFlick = this.word(sc, 'flicker') ?? 1.9;
    this.envCrackNight(0.14);
    // uneven flicker: [start, length, brightness, faceDepth]
    const flashes = [
      [0.0, tFlick - 0.05, 0.62, 0.17], [tFlick + 0.05, 0.12, 0.5, 0.17], [tFlick + 0.32, 0.08, 0.6, 0.15],
      [sc.L[1].s + 0.2, 0.55, 0.65, 0.13], [sc.L[1].s + 1.05, 0.22, 0.55, 0.1], [sc.L[1].s + 1.45, 0.1, 0.6, 0.09],
      [sc.L[2].s - 0.05, 0.42, 0.65, 0.07], [sc.L[2].s + 0.62, 0.18, 0.5, 0.055], [sc.L[2].s + 0.98, 0.08, 0.55, 0.05],
      [hit - 0.02, 99, 1.0, 0.035],
    ];
    let on = 0.03, depth = 0.17, openEyes = false;
    for (const [s0, len, br, d] of flashes) {
      if (lt >= s0 && lt < s0 + len) { on = br * (0.85 + 0.15 * noise1(t * 40, 2)); depth = d; if (s0 >= hit - 0.03) openEyes = true; }
      else if (lt >= s0 + len) depth = d;
    }
    if (openEyes) on = 1.0 - 0.25 * ramp(lt, hit + 0.6, sc.T) - (lt > sc.T - 0.3 ? 0.8 : 0);
    this.maxOnLedge(POSES.sitLedge, Math.max(0.0, on), t, [0.02, 0, 0], 0.0, V(rightWall(EYE_Y), EYE_Y - 0.42, FM_Z), 1);   // light from below
    w.glacier.userData.wallIce.userData.u.uWarmCol.value.multiplyScalar(0.35);
    this.breath(t, 1.8, 0.9);
    this.frozenMan(POSES.frozen, depth, true);
    w.frozen.man.sculpt.userData.setEyes(openEyes);
    const pl = this.img(openEyes ? 'open' : 'closed', depth, EYE_Y, FM_Z, { glow: (openEyes ? 0.3 : 0.16) * Math.max(on, 0.08) });
    if (pl) w.frozen.man.root.visible = false;
    const close = clamp((0.17 - depth) / 0.135);
    w.glacier.userData.wallIce.roughness = lerp(0.22, 0.12, close);
    w.glacier.userData.wallIce.thickness = lerp(1.0, 0.7, close);
    P.sat = 0.85;
    FROZEN_U.uVis.value = 0.18;
    const k = ep(lt, 0, hit, ease.inOutSine);
    const kh = ep(lt, hit, hit + 0.5, ease.outCubic);
    const target = V(rightWall(EYE_Y) + depth, EYE_Y - 0.02, FM_Z);
    w.glacier.userData.wallIce.userData.u.uFrostVis.value = lerp(0.32, 0.15, close);
    this.ots(t, target, lerp(0.62, 0.93, k) + kh * 0.07, { fov: lerp(34, 30, k) - kh * 4, shake: this.shakeVec(t, sc.start + hit, 0.6, 0.02) });
    if (lt >= hit) { P.ca = 0.018 * (1 - ramp(lt, hit, hit + 0.7)) + 0.002; P.flash = 0.22 * (1 - ramp(lt, hit, hit + 0.12)); P.flashColor = [0.8, 0.9, 1]; }
    w.fill.intensity = 0.06; w.fill.position.set(0.2, -38.6, 0.2);
  }

  // ============================================================ SCENE 7 — DAY 4 (the hand) + voice from above
  s7(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const L = sc.L;
    const tInside = this.word(sc, 'inside') ?? L[2].s;
    const tShut = L[2].e + 0.05;
    const tLight = L[3].s - 0.45;
    this.envCrackNight(0.14);
    const dim = 0.17 + 0.03 * noise1(t * 6, 4);
    if (lt < L[1].s - 0.05) {
      this.maxOnLedge(POSES.slumped, dim, t, [0.05, 0, 0], 1, V(rightWall(EYE_Y), EYE_Y, FM_Z + 0.2), 0.8);
      this.glowBehind(0.35);
      this.breath(t, 3.6, 0.7);
      this.frozenMan({ ...POSES.frozen, shR: [-1.6, 0, -0.42], elR: [-0.9, 0, 0] }, 0.06);
      const k = ep(lt, 0, L[1].s, ease.inOutSine);
      this.sideLedge(t, { x: 0.1 - k * 0.12, z: 4.6 - k * 1.0, fov: 38 });
      w.fill.intensity = 0.08; w.fill.position.set(0, -38.6, 1.0);
      P.exposure = 1.45;
    } else if (lt < tShut) {
      this.maxOnLedge(POSES.sitLedge, dim + 0.05, t, [0, 0, 0], 0.15, V(rightWall(EYE_Y), EYE_Y, FM_Z + 0.2));
      const crack = lerp(0.03, 0.4, ep(lt, L[1].s + 0.4, tInside + 0.6, ease.inOutSine));
      const push = ep(lt, tInside - 0.3, tInside + 0.4, ease.outCubic) * 0.25;
      this.handShot(t, crack, lerp(0.35, 0.7, ep(lt, L[1].s, tShut, ease.inOutSine)) + push);
      P.exposure = 1.5;
      if (lt > tInside) P.ca = 0.004 * (1 - ramp(lt, tInside, tInside + 0.6));
    } else if (lt < tLight) {
      // Max turns away from the wall and shuts his eyes (side view, no face close-up)
      this.maxOnLedge(POSES.eyesShut, dim * 0.8, t);
      this.breath(t, 1.6, 0.8);
      this.frozenMan({ ...POSES.frozen, shR: [-1.6, 0, -0.42], elR: [-0.9, 0, 0] }, 0.05);
      this.glowBehind(0.3);
      const k = ep(lt, tShut, tLight, ease.inOutSine);
      this.sideLedge(t, { x: -0.05, y: -39.1, z: 2.7 - k * 0.3, tx: -0.1, ty: -39.25, fov: 36 });
      P.exposure = 1.5;
      w.fill.intensity = 0.15; w.fill.position.set(-0.2, -38.8, 0.6);
    } else {
      const k = ep(lt, tLight, tLight + 1.4, ease.inOutSine);
      const look = ep(lt, L[3].s + 0.3, L[3].s + 1.3, ease.inOutCubic);
      this.maxOnLedge(blendPose(POSES.eyesShut, { ...POSES.sitLedge, neck: [-0.55, 0, 0], head: [-0.4, 0, 0] }, look), dim * 0.8, t);
      this.frozenMan({ ...POSES.frozen, shR: [-1.6, 0, -0.42], elR: [-0.9, 0, 0] }, 0.05);
      w.sky.mesh.visible = true;
      const sl = w.props.searchLight;
      sl.position.set(crackCenter(-2), 2.0, -1.0);
      w.props.searchTarget.position.set(crackCenter(-40), LEDGE_Y, -0.6);
      sl.intensity = 22 * k;
      w.hemi.intensity = 0.05 + 0.08 * k;
      w.glacier.userData.deep.userData.u.uGlowAmt.value = 0.14 + 0.4 * k;
      const pos = V(SEAT.x + 0.55, LEDGE_Y + 0.55, SEAT.z + 0.55).add(this.drift(t, 0.01));
      const tgt = V(crackCenter(-20) + 0.1, -18, -0.9);
      this.cam(pos, tgt, 52, 0.04, 0.05);
      P.exposure = 1.25;
      P.bloom = 0.85;
      P.maxBlur = 0.2; P.focus = 6; P.focusRange = 10;
      const PS = w.particles;
      PS.snow.points.visible = true;
      PS.snow.u.uCenter.value.set(crackCenter(-25), -24, -0.8);
      PS.snow.u.uBox.value.set(1.6, 34, 2.2);
      PS.snow.u.uVel.value.set(0.05, -1.6, 0);
      PS.snow.u.uTurb.value = 0.12;
      PS.snow.u.uSize.value = 26;
      PS.snow.u.uAlpha.value = 0.9 * k;
      PS.snow.u.uColor.value.set(1.4, 1.5, 1.7);
    }
  }

  // ============================================================ SCENE 8 — THE RESCUE
  s8(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const T = sc.T;
    const tDown = sc.L[1].s - 0.1;
    const tClip = this.word(sc, 'clipped') ?? 3.4;
    const tRise = this.word(sc, 'rise') ?? 5.6;
    w.sky.setPreset('dawn');
    w.moon.color.set(0xffc2c8); w.moon.intensity = 1.0; w.moon.position.set(-50, 25, 40);
    w.hemi.color.set(0xa8b8e0); w.hemi.groundColor.set(0x30304a); w.hemi.intensity = 0.55;
    const mu = w.mountains.userData.uniforms;
    mu.uLight.value.set(1.0, 0.7, 0.75); mu.uFog.value.set(0.55, 0.45, 0.6); mu.uSnow.value.set(0.85, 0.8, 0.9); mu.uWarm.value.set(0.3, 0.12, 0.15);
    mu.uMoonDir.value.set(-0.7, 0.4, 0.5).normalize();
    this.dayLook('dawn');
    w.hemi.intensity = 0.4;
    FROZEN_U.uVis.value = 0.14;
    const tri = w.props.tripod;
    tri.visible = true;
    tri.position.copy(TRIPOD);
    const pulley = V(TRIPOD.x, TRIPOD.y + tri.userData.pulleyY, TRIPOD.z);
    tri.userData.drum.rotation.x = lt * 4;
    const ra = w.rescuerA, rb = w.rescuerB;
    ra.root.visible = rb.root.visible = true;
    ra.root.position.set(TRIPOD.x - 2.3, snowTop(TRIPOD.x - 2.3), TRIPOD.z + 0.6);
    ra.root.rotation.set(0, Math.PI / 2, 0);
    applyPose(ra, { ...POSES.stand, shL: [-0.9, 0, 0.1], elL: [-0.8, 0, 0], shR: [-0.8, 0, -0.1], elR: [-0.9, 0, 0], spine: [0.2, 0, 0] });
    rb.root.position.set(TRIPOD.x + 2.4, snowTop(TRIPOD.x + 2.4), TRIPOD.z - 0.4);
    rb.root.rotation.set(0, -Math.PI / 2 - 0.3, 0);
    applyPose(rb, { ...POSES.stand, neck: [0.4, 0, 0], spine: [0.15, 0, 0] });
    const e = w.erik;
    e.root.visible = true;
    const dk = ep(lt, tDown, tClip - 0.35, ease.inOutQuad);
    const rk = ep(lt, tRise - 0.3, T + 0.5, ease.inQuad);
    const ey = lerp(-0.3, LEDGE_Y + 0.3, dk) + rk * 2.0;
    e.root.position.set(crackCenter(ey) + 0.12, ey - 0.95, TRIPOD.z + 0.25);
    e.root.rotation.set(0, -Math.PI / 2 + 0.25, 0);
    applyPose(e, lt < tClip - 0.35 ? { ...POSES.rappel, hipsRot: [0.15, 0, 0] } : { ...POSES.rappel, shR: [-1.2, 0, -0.3], elR: [-1.0, 0, 0], hipsRot: [0.05, 0, 0] });
    e.root.updateMatrixWorld(true);
    const elampK = lt > tDown ? 1 : 0;
    w.erikLamp.set(elampK, t, 0.35, 0.5);
    e.M.lens.color.setRGB(3, 3, 2.8).multiplyScalar(elampK + 0.1);
    if (lt < tRise - 0.3) {
      this.maxOnLedge(lt < tClip ? { ...POSES.sitLedge, neck: [-0.5, 0, 0], head: [-0.3, 0, 0] } : POSES.sitLedge, 0.0, t);
    } else {
      const m = w.max;
      m.root.visible = true;
      m.root.position.set(e.root.position.x - 0.22, e.root.position.y - 0.25, e.root.position.z + 0.28);
      m.root.rotation.set(0, Math.PI / 2 - 0.2, 0);
      applyPose(m, POSES.hang);
      m.root.updateMatrixWorld(true);
    }
    e.J.clip.updateMatrixWorld(true);
    setRope(w.props.rope, pulley, new THREE.Vector3().setFromMatrixPosition(e.J.clip.matrixWorld));
    if (lt < tDown + 0.3) {
      const pos = V(TRIPOD.x + 3.5, 3.0, TRIPOD.z + 11).add(this.drift(t, 0.04));
      this.cam(pos, V(TRIPOD.x, 0.8, TRIPOD.z), 38, 0, 0.3);
      P.maxBlur = 0.2; P.focus = 11; P.focusRange = 6;
      ov.labels.push(this.tag('ERIK', e, t, sc.start + 0.25, 2.6, 0.4));
    } else {
      const cy = Math.max(ey, LEDGE_Y + 0.7);
      const pos = V(crackCenter(cy) + 0.1, cy + 0.7, 5.2 - ramp(lt, tClip - 0.6, tClip) * 1.6).add(this.drift(t, 0.02));
      this.cam(pos, V(crackCenter(cy) + 0.05, cy - 0.35, -0.5), 42, 0, 0.1);
      P.maxBlur = 0.35; P.focus = 5.5; P.focusRange = 3;
      ov.labels.push(this.tag('ERIK', e, t, sc.start + tDown + 0.3, 2.0, 0.4));
      const depthK = clamp(-cy / 40);
      w.moon.intensity = lerp(1.0, 0.12, depthK);
      w.hemi.intensity = lerp(0.55, 0.15, depthK);
      w.glacier.userData.deep.userData.u.uGlowAmt.value = lerp(0.5, 0.35, depthK);
      P.exposure = lerp(0.88, 1.25, depthK);
    }
  }

  // ============================================================ SCENE 9 — THE REVEAL
  s9(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const L = sc.L;
    const tCut = L[1].s - 0.05;                // cut to the reveal on "There were..."
    const tDozens = this.word(sc, 'dozens') ?? L[1].s + 0.6;
    const tUp = this.word(sc, 'up') ?? L[2].s + 2.5;
    this.envCrackNight(0.3);
    const ff = w.fullframe;
    if (lt < tCut || !ff.u.tImg.value) {
      // rising on the rope; Max looks down; their lamps point down into the crack
      w.hemi.intensity = 0.08;
      const ey = LEDGE_Y + 2.3 + lt * 0.55;
      const e = w.erik, m = w.max;
      e.root.visible = m.root.visible = true;
      e.root.position.set(crackCenter(ey) + 0.12, ey - 0.95, TRIPOD.z + 0.25);
      e.root.rotation.set(0, -Math.PI / 2 + 0.25, 0);
      applyPose(e, { ...POSES.hang, neck: [0.7, 0, 0], head: [0.5, 0, 0] });
      m.root.position.set(e.root.position.x - 0.22, e.root.position.y - 0.25, e.root.position.z + 0.28);
      m.root.rotation.set(0, Math.PI / 2 - 0.2, 0);
      const lookDown = ep(lt, 0.3, 1.6, ease.inOutCubic);
      applyPose(m, { ...POSES.hang, neck: [0.2 + 0.6 * lookDown, 0, 0], head: [0.1 + 0.55 * lookDown, 0, 0] });
      m.root.updateMatrixWorld(true);
      e.root.updateMatrixWorld(true);
      w.maxLamp.set(0.9, t);
      w.max.M.lens.color.setRGB(3.4, 2.4, 1.3);
      w.erikLamp.set(1.0, t, 0.35, 0.5);
      e.M.lens.color.setRGB(3, 3, 2.8);
      const pulley = V(TRIPOD.x, TRIPOD.y + 2.45, TRIPOD.z);
      e.J.clip.updateMatrixWorld(true);
      setRope(w.props.rope, pulley, new THREE.Vector3().setFromMatrixPosition(e.J.clip.matrixWorld));
      // warm light sweeping over the walls below the ledge; the crowd starts to show
      const k = ep(lt, 0.6, tCut, ease.inOutCubic);
      FROZEN_U.uVis.value = lerp(0.2, 0.55, k);
      w.glacier.userData.wallIce.roughness = lerp(0.36, 0.26, k);
      w.glacier.userData.deep.userData.u.uExtraPos.value.set(crackCenter(-52), -52 - lt * 1.5, -1.0);
      w.glacier.userData.deep.userData.u.uExtraCol.value.set(0.7, 0.42, 0.2).multiplyScalar(k);
      w.fill.intensity = 2.5 * k; w.fill.distance = 25; w.fill.color.set(0xffb070);
      w.fill.position.set(crackCenter(-50), -48 - lt * 1.5, -1.2);
      // camera: side view of the two on the rope, then tilting down with the beams
      const camY = ey + 0.2;
      const pos = V(crackCenter(camY) + 0.2, camY + 0.3 - k * 1.0, 3.2 - k * 2.4).add(this.drift(t, 0.01));
      const tgtA = V(crackCenter(ey) + 0.05, ey - 0.6, -0.4);
      const tgtB = V(crackCenter(-60), -62, -1.4);
      this.cam(pos, tgtA.clone().lerp(tgtB, k), lerp(40, 46, k), 0.02 * k, 0.05);
      P.maxBlur = 0.35 * (1 - k); P.focus = 3.4; P.focusRange = 2;
      P.exposure = 1.35;
      return;
    }
    // the reveal: full-frame image, slow scary push-in with depth warp, beams sweeping, ice dust
    w.glacier.visible = false;
    w.sky.mesh.visible = false;
    w.mountains.visible = false;
    for (const c of w.frozen.crowd) c.root.visible = false;
    const a = lt - tCut;
    const kp = ep(lt, tCut, sc.T, ease.inOutSine);
    const ku = ep(lt, tUp - 0.2, tUp + 0.5, ease.outCubic);
    ff.mesh.visible = true;
    ff.u.uZoom.value = 1.0 + 0.16 * kp + 0.05 * ku;
    ff.u.uWarp.value = 0.1 * kp + 0.04 * ku;
    ff.u.uCenter.value.set(0.5, 0.6);
    ff.u.uPan.value.set(fbm1(t * 0.3, 4) * 0.004, -0.02 * kp);
    const reveal = ease.outCubic(ramp(a, 0, 0.55));
    const flick = 0.92 + 0.08 * noise1(t * 11, 6);
    ff.u.uBright.value = (0.25 + 0.55 * reveal) * flick;
    const P0 = ff.u.uPools.value;
    P0[0].set(0.5 + 0.22 * Math.sin(lt * 0.9), 0.18 + 0.05 * Math.cos(lt * 0.7), 0.3, 0.9 * reveal);
    P0[1].set(0.45 + 0.25 * Math.sin(lt * 0.6 + 2.0), 0.5 + 0.12 * Math.sin(lt * 0.5), 0.22, 0.55 * reveal);
    P0[2].set(0.55 + 0.2 * Math.cos(lt * 0.8 + 1.0), 0.78, 0.18, 0.35 * reveal);
    this.cam(V(0, 0, 0), V(0, 0, -1), 40, 0, 0.05);
    // floating ice dust in front of the image
    const rnd = mulberry32(99);
    const PS = w.particles.sprites;
    for (let i = 0; i < 70; i++) {
      const x = (rnd() - 0.5) * 1.2 + Math.sin(t * 0.3 + i) * 0.03, y = (rnd() - 0.5) * 1.9 + ((t * 0.05 + rnd()) % 1) * 0.2 - 0.1;
      const z = -0.6 - rnd() * 0.6;
      PS.add(x, y, z, 0.003 + rnd() * 0.006, (0.15 + 0.35 * rnd()) * reveal, 0.85, 0.92, 1.0);
    }
    P.exposure = 1.25;
    P.vignette = 0.6;
    P.maxBlur = 0;
    if (lt >= tDozens) P.ca = 0.012 * (1 - ramp(lt, tDozens, tDozens + 0.8));
    if (lt >= tUp) P.ca = Math.max(P.ca, 0.009 * (1 - ramp(lt, tUp, tUp + 0.7)));
    const s = this.shakeVec(t, sc.start + tDozens, 0.5, 0.012).add(this.shakeVec(t, sc.start + tUp, 0.5, 0.01));
    w.camera.position.add(s);
    w.camera.updateMatrixWorld(true);
  }

  // ============================================================ SCENE 10 — SAFE
  s10(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const L = sc.L;
    const t1950 = this.word(sc, '1950') ?? L[2].s + 0.3;
    const t32 = this.word(sc, '32') ?? L[4].s + 1.4;
    w.sky.setPreset('sunrise');
    w.sky.uniforms.uSunDir.value.set(-0.6, 0.06, -0.8).normalize();
    w.moon.color.set(0xffd2a0); w.moon.intensity = 1.6; w.moon.position.set(-60, 14, 25);
    w.hemi.color.set(0xb8c8f0); w.hemi.groundColor.set(0x404058); w.hemi.intensity = 0.65;
    const mu = w.mountains.userData.uniforms;
    mu.uLight.value.set(1.3, 0.85, 0.6); mu.uFog.value.set(0.7, 0.55, 0.55); mu.uSnow.value.set(0.95, 0.88, 0.85); mu.uWarm.value.set(0.5, 0.25, 0.1);
    mu.uMoonDir.value.set(-0.8, 0.35, 0.45).normalize();
    this.dayLook('sunrise');
    w.hemi.intensity = 0.45;
    FROZEN_U.uVis.value = 0.16;
    P.shadowTint = [0.05, 0.12, 0.35];
    const tri = w.props.tripod;
    tri.visible = true;
    tri.position.copy(TRIPOD);
    const m = w.max, e = w.erik, ra = w.rescuerA, rb = w.rescuerB;
    m.root.visible = e.root.visible = ra.root.visible = rb.root.visible = true;
    const sitPos = V(TRIPOD.x - 2.1, snowTop(TRIPOD.x - 2.1) + 0.02, TRIPOD.z + 1.6);
    if (lt < L[1].s) {
      const k = ep(lt, 0, L[1].s, ease.outCubic);
      m.root.position.set(lerp(crackCenter(0) - 0.4, sitPos.x, k), lerp(-1.4, sitPos.y, Math.min(1, k * 1.6)), lerp(TRIPOD.z + 0.5, sitPos.z, k));
      m.root.rotation.set(0, Math.PI / 2, 0);
      applyPose(m, blendPose(POSES.carried, POSES.wrapped, k));
    } else {
      m.root.position.copy(sitPos);
      m.root.rotation.set(0, lt >= L[4].s ? Math.atan2(-0.6, -0.8) : Math.PI / 2 + 0.35, 0);
      applyPose(m, POSES.wrapped);
    }
    m.root.updateMatrixWorld(true);
    const bl = w.props.blanket;
    bl.visible = lt > 0.6;
    bl.position.copy(new THREE.Vector3(0, -0.12, 0.0).applyMatrix4(m.J.spine.matrixWorld));
    bl.quaternion.setFromRotationMatrix(m.root.matrixWorld);
    bl.scale.setScalar(ramp(lt, 0.6, 1.2) * 0.25 + 0.75);
    e.root.position.set(TRIPOD.x - 0.9, snowTop(TRIPOD.x - 0.9), TRIPOD.z - 1.4);
    e.root.rotation.set(0, Math.PI * 0.15, 0);
    applyPose(e, { ...POSES.stand, neck: [0.35, 0, 0], spine: [0.1, 0, 0] });
    ra.root.position.set(sitPos.x - 1.6, snowTop(sitPos.x - 1.6), sitPos.z - 1.0);
    ra.root.rotation.set(0, Math.PI / 2 + 0.5, 0);
    applyPose(ra, POSES.kneelBook);
    rb.root.position.set(TRIPOD.x + 2.4, snowTop(TRIPOD.x + 2.4), TRIPOD.z - 0.4);
    rb.root.rotation.set(0, -Math.PI / 2 - 0.3, 0);
    applyPose(rb, POSES.stand);
    ra.root.updateMatrixWorld(true);
    const book = w.props.book;
    book.visible = true;
    const bookPos = new THREE.Vector3(0, -0.02, 0.32).applyMatrix4(ra.J.chest.matrixWorld);
    book.position.copy(bookPos);
    book.quaternion.setFromRotationMatrix(ra.root.matrixWorld).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0)));
    const open = ep(lt, L[1].s + 0.5, L[1].s + 1.6, ease.inOutCubic);
    book.userData.left.rotation.z = lerp(Math.PI - 0.05, 0.06, open);
    book.userData.right.rotation.z = -0.06;
    if (lt < L[1].s) {
      const pos = V(sitPos.x + 2.2, 1.4, sitPos.z + 6.5).add(this.drift(t, 0.03));
      this.cam(pos, V(sitPos.x + 0.6, 0.4, sitPos.z - 0.5), 36, 0, 0.2);
      P.maxBlur = 0.25; P.focus = 7; P.focusRange = 4;
    } else if (lt < L[3].s) {
      const k = ep(lt, L[1].s, L[3].s, ease.inOutSine);
      const a = ramp(lt, t1950 - 0.2, t1950 + 0.15) * (1 - ramp(lt, L[3].s - 0.35, L[3].s));
      ov.labels.push({ text: '31 MISSING SINCE 1950', x: 520, y: 520, size: 52, alpha: a, scale: 0.9 + 0.1 * ease.outBack(ramp(lt, t1950 - 0.2, t1950 + 0.2)) });
      if (w.fullframe.setImage(w.frozen.images.logbook)) {
        const ff = w.fullframe;
        w.glacier.visible = false; w.sky.mesh.visible = false; w.mountains.visible = false;
        for (const f of [m, e, ra, rb]) f.root.visible = false;
        for (const p of w.props.all) p.visible = false;
        for (const c of w.frozen.crowd) c.root.visible = false;
        ff.mesh.visible = true;
        ff.u.uZoom.value = 1.0 + 0.14 * k;
        ff.u.uWarp.value = 0.02;
        ff.u.uCenter.value.set(0.42, 0.42);
        ff.u.uPan.value.set(0, 0);
        ff.u.uBright.value = 0.9;
        for (const pl of ff.u.uPools.value) pl.w = 0;
        ff.u.uLed.value.set(0, 0, 0.01, 0); ff.u.uLedKill.value = 0;
        this.cam(V(0, 0, 0), V(0, 0, -1), 40, 0, 0.05);
        P.maxBlur = 0; P.vignette = 0.55;
      } else {
        const pos = bookPos.clone().add(V(0.55 - k * 0.12, 0.55 - k * 0.08, 0.45 - k * 0.1)).add(this.drift(t, 0.006));
        this.cam(pos, bookPos.clone().add(V(0, -0.02, 0)), 34, 0, 0.03);
        P.maxBlur = 0.8; P.focus = pos.distanceTo(bookPos); P.focusRange = 0.25;
      }
    } else if (lt < L[4].s) {
      const k = ep(lt, L[3].s, L[4].s, ease.inOutSine);
      FROZEN_U.uVis.value = 0.24;
      const pos = V(-1 + k * 2, 3 - k * 2, 70 - k * 10).add(this.drift(t, 0.05));
      this.cam(pos, V(0, -14, 0), 32, 0, 0.5);
    } else {
      // from behind (no face close-up): Max wrapped in foil, looking into the sunrise
      const k = ep(lt, L[4].s, sc.T, ease.inOutSine);
      const hp = this.headWorld(m);
      const fwd = V(-0.6, 0, -0.8);
      const pos = hp.clone().addScaledVector(fwd, -(2.6 - k * 0.5)).add(V(0.35, 0.45 - k * 0.1, 0)).add(this.drift(t, 0.01));
      this.cam(pos, hp.clone().addScaledVector(fwd, 3.0).add(V(0.6, 0.0, 0)), 34, 0, 0.1);
      P.maxBlur = 0.35; P.focus = pos.distanceTo(hp); P.focusRange = 1.6;
      ra.root.visible = false; w.props.book.visible = false;
      w.sky.uniforms.uBright.value = 0.42; P.bloom = 0.35; P.exposure = 0.82;
      const tt = lt - t32;
      let a = 0;
      if (tt >= 0) {
        a = 1;
        if ((tt > 0.35 && tt < 0.42) || (tt > 0.6 && tt < 0.7)) a = 0.08;
        a *= 1 - ramp(tt, 1.2, 1.9);
      }
      const p = this.project(hp.clone().add(V(0, 0.45, 0)));
      ov.labels.push({ text: 'No. 32', x: p.x, y: p.y, size: 56, alpha: a });
    }
  }

  // ============================================================ SCENE 11 — THE LAST SHOT
  s11(sc, lt, t, ov) {
    const w = this.w, P = this.post.p;
    const tCrack = 1.4;
    const tCut = 3.3;
    this.envCrackNight(0.24);
    w.hemi.intensity = 0.05;
    FROZEN_U.uVis.value = 0.15;
    if (lt >= tCut) { P.fade = 1; return; }
    const y = EYE_Y + 0.03;
    const z = FM_Z + 0.05;
    const xw = rightWall(y, z);
    const a = lt - tCrack;
    w.cap.visible = w.capBack.visible = true;
    if (a >= 0) {
      const out = ease.outExpo(clamp(a / 0.18));
      const curl = ep(a, 0.45, 1.5, ease.inOutSine);
      const x = xw + 0.04 - out * 0.34;
      const reach = this.img('reach', 0, y, z, { x, glow: 0.12 });
      if (reach) {
        const claw = this.img('claw', 0, y, z, { x: x - 0.002, glow: 0.12 });
        if (claw) { reach.visible = curl < 0.5; claw.visible = curl >= 0.5; }
      } else {
        this.frozenMan({ ...POSES.frozen, shR: [-1.5, 0, -0.3], elR: [-0.2 - curl * 0.3, 0, 0], wrR: [curl * 0.8, 0, 0] }, 0.05 - out * 0.3);
      }
      const rnd = mulberry32(11);
      for (let i = 0; i < 400; i++) {
        const sp = 1.2 + rnd() * 3.2;
        const ang = rnd() * Math.PI * 2, el = (rnd() - 0.5) * 2.2;
        const d = a * sp;
        w.particles.chips.add(xw - d * (0.6 + rnd() * 0.5), y + Math.sin(ang) * d * 0.6 * el - 4.9 * a * a * 0.3, z + Math.cos(ang) * d * 0.6,
          a * 13 * rnd(), a * 9 * rnd(), a * 7 * rnd(), 0.4 + rnd() * 1.6);
      }
      for (let i = 0; i < 40; i++) {
        const r = 0.05 + a * (0.6 + (i % 7) * 0.1);
        const ang = i * 2.399;
        w.particles.sprites.add(xw - 0.05 - a * 0.3, y + Math.sin(ang) * r * 0.5, z + Math.cos(ang) * r * 0.5, 0.06 + a * 0.2, 0.4 * (1 - ramp(a, 0.05, 1.0)), 0.8, 0.9, 1.0);
      }
      const G = w.glacier.userData;
      G.wallIce.userData.u.uHandPos.value.set(xw, y, z);
      G.wallIce.userData.u.uHandCrack.value = 0.15 + ease.outExpo(clamp(a / 0.2)) * 0.6;
      w.fill.intensity = 1.6 * (1 - ramp(a, 0, 0.5)) + 0.3;
      w.fill.color.set(0xa8d8ff);
      w.fill.position.set(xw - 0.4, y + 0.3, z + 0.3);
      P.ca = 0.02 * (1 - ramp(a, 0, 0.9)) + 0.003;
      P.flash = 0.3 * (1 - ramp(a, 0, 0.1));
      P.flashColor = [0.85, 0.95, 1];
    } else {
      w.fill.intensity = 0.18; w.fill.color.set(0x3a6aa0); w.fill.position.set(xw - 0.4, y + 0.3, z + 0.3);
    }
    // empty ledge: the camera sits where Max sat, looking at the wall
    const pos = V(SEAT.x - 0.05, y + 0.04, z + 0.14).add(this.drift(t, 0.004)).add(this.shakeVec(t, sc.start + tCrack, 1.0, 0.045));
    this.cam(pos, V(xw, y - 0.02, z - 0.02), 40, 0, 0.02);
    P.exposure = 1.5;
    P.maxBlur = 0.5; P.focus = pos.distanceTo(V(xw, y, z)) - 0.25; P.focusRange = 0.35; P.nearBlur = 0.6;
  }
}
