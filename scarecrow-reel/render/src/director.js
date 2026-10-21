// The director: every animated value in the film as a pure function of time t (seconds).
// It also records the sound-effect cues so the audio is generated in sync (see getCues()).
import * as THREE from 'three';
import { mixPresets } from './lighting.js';
import { buildScarecrow, PZ } from './scarecrow.js';
import { buildKid } from './kid.js';
import { buildCrow, buildBaby } from './crow.js';
import { buildCutaway } from './cutaway.js';
import { FX } from './fx.js';
import { U } from './shaders.js';
import { ZC, FENCE_Z, FENCE_TOP, BUSHES } from './world.js';
import { M, V, lumpy } from './parts.js';
import { clamp, lerp, smooth, seg, easeInOut, easeOut, easeIn, snap, pop, pulse, window01, noise1, rng } from './util.js';

export const DURATION = 50.5;
export const FPS = 30;
export const DANCE_T0 = 45.62, BPM = 124, BEAT = 60 / BPM;

const TAU = Math.PI * 2;
const HOLE_R = 0.3;

export const SCENES = [
  { id: 1, t0: 0.0, t1: 7.0, name: 'plant the scarecrow' },
  { id: 2, t0: 7.0, t1: 14.2, name: 'motor' },
  { id: 3, t0: 14.2, t1: 21.2, name: 'random chip' },
  { id: 4, t0: 21.2, t1: 28.4, name: 'night: eyes + sensor' },
  { id: 5, t0: 28.4, t1: 35.4, name: 'day: hawk speaker' },
  { id: 6, t0: 35.4, t1: 41.2, name: 'admire + pull back' },
  { id: 7, t0: 41.2, t1: DURATION, name: 'nest twist' },
];

// spin pattern of scene 3 (spin 0.8 s, then a pause)
const PAT_SPIN = 0.8;
const PAT_STARTS = [13.8, 15.2, 16.6, 18.0];

export class Director {
  constructor(ctx) {
    Object.assign(this, ctx);
    const sc = this.scene;
    this.S = buildScarecrow(sc);
    this.K = buildKid(sc);
    this.cut = buildCutaway(sc);
    this.fx = new FX(sc, this.camera);
    this.crows = [0, 1, 2, 3, 4].map((v) => buildCrow(sc, v));
    this.babies = [0, 1, 2].map((k) => buildBaby(this.S.nest, k));
    const pileG = lumpy(1, 9, 0.22, 3); pileG.scale(1, 0.45, 0.8);
    this.pile = new THREE.Mesh(pileG, M.soilLoose); this.pile.castShadow = true; this.pile.receiveShadow = true; this.pile.position.set(0.5, -0.02, 0.0); sc.add(this.pile);
    this.stolen = this.crows.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xd8321f, roughness: 0.28, clearcoat: 0.6 })); m.castShadow = true; m.visible = false; sc.add(m); return m; });
    this.cues = [];
    this.sfx = (t, name, gain = 1, pan = 0) => this.cues.push({ t: +t.toFixed(3), name, gain, pan });
    this.lastPos = this.crows.map(() => V(0, 0, 0));
    this.planKid();
    this.planCrows();
    this.planFX();
    this.planSound();
    window.getCues = () => ({ duration: DURATION, fps: FPS, scenes: SCENES, danceStart: DANCE_T0, bpm: BPM, musicStop: 45.35, cues: this.cues.slice().sort((a, b) => a.t - b.t) });
    this.ready = Promise.resolve();
  }

  // Evaluate fn with the scarecrow posed at time tt (cached; restores the current pose).
  evalAt(tt, key, fn) {
    if (this.curT !== undefined && Math.abs(tt - this.curT) < 1e-6) return fn();
    const k = key + '@' + tt.toFixed(4); this.evalCache ||= new Map();
    if (this.evalCache.has(k)) return this.evalCache.get(k);
    const S = this.S; S.setPose(this.scarecrowPose(tt)); S.root.updateMatrixWorld(true);
    const r = fn(); r.p = r.p.clone();
    if (this.curSP) { S.setPose(this.curSP); S.root.updateMatrixWorld(true); }
    this.evalCache.set(k, r); return r;
  }

  // ================================================================= scarecrow motion
  spinAngle(t) {
    let a = 0;
    if (t > 12.45) a += TAU * 2 * (0.35 * easeIn(seg(t, 12.45, 13.0)) + 0.65 * easeOut(seg(t, 12.85, 13.5)));
    for (const s of PAT_STARTS) if (t > s) a += TAU * easeInOut(seg(t, s, s + PAT_SPIN));
    for (const [s, d, amt] of [[19.22, 0.22, 1.25], [19.88, 0.3, -2.05], [20.5, 0.55, 0.8 + TAU]]) if (t > s) a += amt * easeInOut(seg(t, s, s + d));
    if (t > 25.66) a += Math.sin(seg(t, 25.66, 26.5) * TAU * 2) * 0.35 * (1 - seg(t, 25.66, 26.5));
    for (const s of [29.35, 30.15]) if (t > s) a += Math.sin(seg(t, s, s + 0.5) * TAU) * 0.3 * (1 - seg(t, s, s + 0.5));
    if (t > 36.0) a += TAU * easeInOut(seg(t, 36.0, 37.3));
    if (t > DANCE_T0) a += (t - DANCE_T0) * 1.1 * smooth(seg(t, DANCE_T0, DANCE_T0 + 0.6));
    return a;
  }
  spinSpeed(t) { return (this.spinAngle(t + 0.01) - this.spinAngle(t - 0.01)) / 0.02; }

  armsAt(t) {
    let L = -0.06, R = -0.06;
    const flap = (s, d, amt, side) => { const v = Math.sin(Math.PI * seg(t, s, s + d)) * amt; if (side !== 1) L += v; if (side !== 0) R += v; };
    const sp = Math.abs(this.spinSpeed(t)); L += clamp(sp / 12) * 0.25; R += clamp(sp / 12) * 0.25;
    [[19.02, 0.32, 1.1, 0], [19.4, 0.3, 1.0, 1], [19.62, 0.4, 1.0, 2], [20.12, 0.3, 1.1, 0], [20.32, 0.28, 0.9, 1], [20.72, 0.4, 1.0, 2]].forEach(([s, d, a, sd]) => flap(s, d, a, sd));
    if (t > 25.66 && t < 26.6) { const v = Math.sin((t - 25.66) * 22) * 0.75 * (1 - seg(t, 26.2, 26.6)); L += Math.abs(v); R += Math.abs(v); }
    for (const s of [29.35, 30.15]) if (t > s && t < s + 0.6) { const v = Math.abs(Math.sin((t - s) * 20)) * 0.6 * (1 - seg(t, s + 0.3, s + 0.6)); L += v; R += v; }
    flap(37.45, 0.5, 0.9, 2); flap(37.95, 0.5, 0.9, 2);
    if (t > DANCE_T0 + 0.2) {
      const b = (t - DANCE_T0) / BEAT; const k = smooth(seg(t, DANCE_T0 + 0.2, DANCE_T0 + 0.8));
      L += (0.5 + 0.5 * Math.cos(b * TAU)) * 0.55 * k; R += (0.5 + 0.5 * Math.cos(b * TAU + Math.PI)) * 0.55 * k;
    }
    return [L, R];
  }

  scarecrowPose(t) {
    const p = { time: t };
    p.pop = t < 2.25 ? 0 : pop(t, 2.25, 0.35);
    const drop = 0.55 * (1 - easeIn(seg(t, 2.62, 2.78)));
    p.lift = t < 2.25 ? 0.55 : drop - (t > 2.78 ? Math.exp(-(t - 2.78) * 9) * Math.sin((t - 2.78) * 30) * 0.03 : 0);
    p.tilt = t < 2.78 ? Math.sin(t * 5) * 0.03 * seg(t, 2.25, 2.4) : Math.exp(-(t - 2.78) * 5) * Math.sin((t - 2.78) * 16) * 0.05;
    p.squash = t > 2.78 ? Math.exp(-(t - 2.78) * 8) * Math.sin((t - 2.78) * 22) * 0.08 : 0;
    p.spin = this.spinAngle(t);
    [p.armL, p.armR] = this.armsAt(t);
    p.headTilt = 0.04 * Math.sin(t * 0.9) + [9.35, 9.6].reduce((a, s) => a + pulse(t, s, 0.03, 0.15) * 0.05, 0);
    p.motor = snap(t, 11.28, 0.35); p.battery = snap(t, 11.48, 0.35); p.wires = easeInOut(seg(t, 11.6, 11.95));
    p.motorOn = t > 12.4 ? 1 : 0;
    p.randomBox = snap(t, 18.12, 0.35); p.chipWire = easeInOut(seg(t, 18.25, 18.5));
    p.chipGlow = t < 18.55 ? 0 : 0.75 + 0.25 * Math.sin(t * 9) + [18.55, 18.7, 18.85, 19.02, 19.4, 19.62, 19.88, 20.12, 20.32, 20.5, 20.72].reduce((a, s) => a + pulse(t, s, 0.02, 0.12) * 1.2, 0);
    p.chipHue = 0.5 + 0.5 * Math.sin(t * 3);
    p.leds = snap(t, 24.38, 0.3);
    const alarm = window01(t, 25.62, 26.6, 0.08);
    const s5 = [29.35, 30.15].reduce((a, s) => a + window01(t, s, s + 0.45, 0.06), 0);
    p.eyeGlow = (t > 24.4 ? 0.45 + 0.08 * Math.sin(t * 4) : 0) * (t > 28.3 && t < 35.3 ? 0.35 : t > 40 ? 0.3 + 0.25 * (t > DANCE_T0 ? Math.pow(0.5 + 0.5 * Math.cos(((t - DANCE_T0) / BEAT) * TAU), 2) : 0) : 1) + alarm * (0.9 + 0.6 * Math.abs(Math.sin(t * 25))) + s5 * 0.8;
    p.sensor = snap(t, 24.82, 0.3); p.sensorLed = t > 24.9 ? 0.6 + 0.4 * Math.sin(t * 6) : 0;
    p.cone = (t > 24.98 ? smooth(seg(t, 24.98, 25.25)) * 0.75 : 0) * (t > 35.3 ? 1 - smooth(seg(t, 35.3, 36.0)) * 0.7 : 1) + alarm * 0.6 + s5 * 0.4;
    if (t > 28.2 && t < 35.4) p.cone *= 0.8;
    p.coneAlarm = Math.min(1, Math.max(alarm, s5));
    p.speaker = t >= this.throws.speaker.t1 ? snap(t, 31.95, 0.3) : 0;
    const scr = window01(t, 32.6, 33.75, 0.05);
    p.speakerLed = scr + (t > DANCE_T0 ? 0.6 + 0.4 * Math.sin(t * 13) : 0) + (t > 31.98 ? 0.2 : 0);
    p.speakerThump = scr * Math.abs(Math.sin(t * 40)) + (t > DANCE_T0 ? Math.pow(0.5 + 0.5 * Math.cos(((t - DANCE_T0) / BEAT) * TAU), 4) : 0);
    p.speakerBtnPress = pulse(t, 45.47, 0.03, 0.12);
    p.speakerBtnGlow = pulse(t, 45.47, 0.03, 0.4);
    p.nest = snap(t, 41.9, 0.4);
    return p;
  }

  // ================================================================= kid
  planKid() {
    this.throws = { eyeL: { t0: 24.02, t1: 24.38 }, eyeR: { t0: 24.06, t1: 24.4 }, sensor: { t0: 24.5, t1: 24.82 }, speaker: { t0: 31.6, t1: 31.95 } };
    const th = this.throws;
    const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.visible = false; this.scene.add(m); return m; };
    const red = new THREE.MeshStandardMaterial({ color: 0x5a0a06, emissive: 0xff2a1a, emissiveIntensity: 2.5 });
    th.eyeL.mesh = mk(new THREE.SphereGeometry(0.036, 14, 10), red);
    th.eyeR.mesh = mk(new THREE.SphereGeometry(0.036, 14, 10), red);
    th.sensor.mesh = mk(new THREE.BoxGeometry(0.1, 0.085, 0.04), M.plasticWhite);
    th.speaker.mesh = mk(new THREE.BoxGeometry(0.156, 0.12, 0.1), M.plasticDark);
  }

  kidPose(t) {
    const K = this.K, S = this.S;
    const p = { mouth: 'smile', gaze: [0, 0], blink: this.blinkAt(t, 3.1) };
    const base = (x, z, yaw) => { p.x = x; p.z = z; p.yaw = yaw; };
    const stand = () => { p.bob = Math.sin(t * 2.1) * 0.004; p.legs = [[0, 0], [0, 0]]; p.arms = [[0.05, -0.1, 0, -0.25], [0.05, 0.1, 0, -0.25]]; };
    const local = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.yaw).add(V(p.x, 0, p.z));
    const dirL = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), p.yaw);
    const handsHips = () => { p.reachL = local(-0.19, 0.58, 0.0); p.reachR = local(0.19, 0.58, 0.0); p.poleL = dirL(-1, 0.2, -0.3); p.poleR = dirL(1, 0.2, -0.3); };
    const lookAt = (pt, k = 1) => {
      const hd = V(p.x, 1.1, p.z); const d = pt.clone().sub(hd); let yy = Math.atan2(d.x, d.z) - p.yaw;
      yy = Math.atan2(Math.sin(yy), Math.cos(yy)); const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      p.headY = clamp(yy * 0.7, -0.9, 0.9) * k; p.headX = clamp(-pitch * 0.6, -0.5, 0.4) * k; p.gaze = [clamp(yy * 1.2, -1, 1), clamp(pitch * 1.5, -1, 1)];
    };
    const grip = () => { p.reachR = K.shovelPoint(V(0, 0.98, 0)); p.reachL = K.shovelPoint(V(0, 0.62, 0)); p.poleL = dirL(-0.6, -0.4, -0.7); p.poleR = dirL(0.4, -0.2, -1); };
    const digStance = () => { p.lean = 0.28; p.twist = -0.15; p.legs = [[-0.25, 0.4], [0.2, 0.15]]; p.bob = -0.02; };
    const scareHead = () => S.worldOf(S.head);
    const KX = -0.56, KZ = 0.07;
    const tip0 = V(-0.02, 0.0, ZC - 0.1);
    const pileAt = V(0.5, 0.06, 0.02);

    // ---------------- scene 1: dig, plant, step back, fill, celebrate
    const FAR = -1.06, fF = (Math.abs(FAR) - 0.1) / 0.46;
    if (t < 7.0) {
      const back = smooth(seg(t, 2.85, 3.05));
      base(lerp(KX, FAR, back), lerp(KZ, 0.1, back), 1.05); stand();
      if (t > 2.85 && t < 3.05) this.walkLegs(p, t);
      let sh = this.restShovel(local); let gripping = false;
      for (const d of [0.3, 0.92, 1.54]) if (t >= d && t < d + 0.62) { sh = this.digShovel(t - d, tip0, pileAt); gripping = true; }
      if (t >= 0.2 && t < 0.3) { sh = this.digShovel(0, tip0, pileAt); gripping = true; }
      if (t >= 2.16 && t < 3.05) sh = { tip: V(0.5, 0.07, 0.02), up: V(-0.15, 1, 0.1), face: V(0, 0, 1) };
      for (const d of [3.05, 3.5]) if (t >= d && t < d + 0.5) { sh = this.fillShovel(t - d, pileAt, tip0, fF); gripping = true; }
      for (const d of [4.0, 4.26]) if (t >= d && t < d + 0.26) { sh = this.patShovel(t - d, V(-0.02, 0.04, ZC - 0.08), fF); gripping = true; }
      p.shovel = sh;
      if (gripping) { K.setPose(p); grip(); digStance(); lookAt(V(0, 0, ZC)); }
      if (t >= 2.16 && t < 2.85) {
        const hy = 1.0 + S.lift.position.y * 0.9;
        p.reachR = V(-0.07, hy, PZ + 0.04); p.reachL = V(-0.08, hy - 0.2, PZ + 0.03); p.poleL = V(-0.4, -0.6, -0.5); p.poleR = V(-0.3, -0.2, -0.8);
        p.lean = 0.1 + seg(t, 2.6, 2.78) * 0.15; p.mouth = t < 2.6 ? 'flat' : 'grin'; p.squint = t > 2.55 && t < 2.8 ? 0.5 : 0; lookAt(V(0, 1.2, PZ));
        p.legs = [[-0.2, 0.3], [0.15, 0.1]];
      }
      if (t >= 3.9 && t < 4.52) p.mouth = 'grin';
      if (t >= 4.52) {
        p.yaw = lerp(1.05, 0.45, smooth(seg(t, 4.52, 4.9)));
        p.shovel = this.restShovel(local);
        lookAt(t < 5.0 ? V(0, 1.1, FENCE_Z) : V(-1, 2.8, -3), 0.9);
        p.mouth = t < 4.95 ? 'o' : 'grin'; p.wide = t > 4.6 && t < 5.1 ? 0.6 : 0;
        if (t > 5.15 && t < 6.2) {
          const u = seg(t, 5.15, 6.2); const h = Math.abs(Math.sin(u * Math.PI * 3));
          p.reachR = local(0.14, 1.32 + h * 0.12, 0.12); p.poleR = dirL(1, -0.3, 0); p.bob = h * 0.035; p.brow = 0.4;
        }
        if (t >= 6.2) { handsHips(); p.mouth = 'smile'; }
      }
      return p;
    }
    // ---------------- scene 2: watch crows, dig, motor
    if (t < 14.2) {
      base(FAR, 0.1, lerp(0.5, 1.05, smooth(seg(t, 10.5, 10.75)) - smooth(seg(t, 12.05, 12.4)) * 0.6)); stand();
      p.shovel = this.restShovel(local);
      lookAt(t < 10.4 ? this.crowHead(0) : V(0, 0, ZC), 0.9);
      if (t > 9.3 && t < 10.45) { p.mouth = 'flat'; p.brow = -0.5; p.squint = 0.3; }
      if (t >= 10.75 && t < 12.05) {
        const sh = t < 11.42 ? this.digShovel(t - 10.8, tip0, pileAt, fF) : this.fillShovel(clamp((t - 11.42) / 0.6) * 0.5, pileAt, tip0, fF);
        p.shovel = sh; K.setPose(p); grip(); digStance(); lookAt(V(0, -0.2, ZC));
      }
      if (t >= 12.4) { lookAt(scareHead(), 0.8); p.mouth = t > 12.7 ? 'grin' : 'o'; if (t > 12.8) handsHips(); }
      return p;
    }
    // ---------------- scene 3: crows ride the pattern; random chip
    if (t < 21.2) {
      const kneel = window01(t, 17.75, 18.85, 0.25);
      base(lerp(FAR, -0.86, smooth(seg(t, 17.45, 17.75)) - smooth(seg(t, 18.85, 19.15))), 0.1, lerp(0.5, 0.85, kneel)); stand();
      if ((t > 17.45 && t < 17.75) || (t > 18.85 && t < 19.15)) this.walkLegs(p, t);
      p.shovel = this.restShovel(local);
      lookAt(t < 17.6 ? this.crowHead(1) : t < 18.9 ? V(-0.66, -0.4, ZC) : scareHead(), 0.85);
      if (t < 16.7) handsHips();
      if (t > 16.7 && t < 17.45) { p.reachR = local(0.03, 1.12, 0.17); p.poleR = dirL(1, -0.5, 0); p.headX = 0.25; p.mouth = 'flat'; p.blink = 0.85; }
      if (kneel > 0) {
        p.shovel = null;
        p.bob = -0.17 * kneel; p.legs = [[-1.1 * kneel, 1.9 * kneel], [-0.2 * kneel, 1.7 * kneel]]; p.lean = 0.35 * kneel;
        p.reachR = V(-0.68, lerp(0.6, 0.06, kneel), ZC - 0.04); p.poleR = dirL(0.5, 0.2, -1);
        if (t > 17.85 && t < 18.1) p.reachR.y += Math.abs(Math.sin((t - 17.85) * 30)) * 0.05;
        p.mouth = t > 18.55 ? 'grin' : 'smile';
      }
      if (t > 19.0 && t < 20.3) { p.mouth = 'grin'; p.brow = 0.3; }
      if (t > 20.3 && t < 20.95) { const u = seg(t, 20.3, 20.6); p.reachR = local(0.2, 1.0 + 0.2 * u, 0.2); p.poleR = dirL(1, -0.4, 0); p.mouth = 'grin'; p.handRot = [[0, 0, 0], [0, 0, 1.6]]; }
      if (t >= 20.95) handsHips();
      return p;
    }
    // ---------------- scene 4: night, throw eyes + sensor
    if (t < 28.4) {
      base(1.0, 0.12, -0.5); stand(); handsHips();
      lookAt(t < 23.9 ? this.crowHead(0) : t < 25.5 ? scareHead() : this.crowHead(0), 0.9);
      p.mouth = t < 23.6 ? 'flat' : 'smile'; p.squint = t < 23.6 ? 0.3 : 0; p.brow = t < 23.6 ? -0.5 : 0;
      for (const k of ['eyeL', 'sensor']) { const th = this.throws[k]; const w = window01(t, th.t0 - 0.28, th.t0 + 0.15, 0.08); if (w > 0) { p.reachR = local(0.2, lerp(0.7, 1.38, w), lerp(-0.05, 0.25, seg(t, th.t0 - 0.28, th.t0 + 0.05))); p.poleR = dirL(1, -0.5, 0); } }
      if (t > 25.6 && t < 26.6) { p.mouth = 'grin'; p.wide = 0.3; }
      if (t > 26.5 && t < 27.4) { const u = seg(t, 26.5, 27.3); const h = Math.abs(Math.sin(u * TAU * 1.5)); p.reachR = local(0.14, 1.3 + h * 0.1, 0.1); p.poleR = dirL(1, -0.3, 0); p.mouth = 'grin'; p.bob = h * 0.03; }
      return p;
    }
    // ---------------- scene 5: unbothered crows, speaker, screech
    if (t < 35.4) {
      base(1.0, 0.12, -0.5); stand(); handsHips();
      lookAt(t < 31.3 ? this.crowHead(1) : t < 32.55 ? scareHead() : t < 33.4 ? this.crowHead(0) : V(-1.2, 0.5, -2.3), 0.9);
      p.mouth = t < 30.4 ? 'o' : t < 31.3 ? 'flat' : 'smile';
      if (t > 30.45 && t < 31.25) { p.reachL = local(-0.02, 1.12, 0.17); p.poleL = dirL(-1, -0.5, 0); p.headX = 0.25; p.blink = 0.85; p.mouth = 'flat'; }
      const th = this.throws.speaker; const w = window01(t, th.t0 - 0.28, th.t0 + 0.15, 0.08);
      if (w > 0) { p.reachR = local(0.2, lerp(0.7, 1.4, w), lerp(-0.05, 0.25, seg(t, th.t0 - 0.28, th.t0 + 0.05))); p.poleR = dirL(1, -0.5, 0); }
      if (t > 32.6 && t < 33.5) { p.wide = 0.7; p.mouth = 'o'; p.squint = 0.4; p.reachL = local(-0.15, 1.1, 0.05); p.reachR = local(0.15, 1.1, 0.05); p.poleL = dirL(-1, -0.3, 0); p.poleR = dirL(1, -0.3, 0); }
      if (t > 33.5) p.mouth = 'grin';
      return p;
    }
    // ---------------- scene 6: admire
    if (t < 41.2) {
      const w = smooth(seg(t, 35.4, 35.95));
      base(lerp(1.0, -1.06, w), 0.12, lerp(-0.5, 0.55, w)); stand();
      if (t < 35.95) this.walkLegs(p, t, 1.4);
      handsHips(); lookAt(scareHead(), 0.9); p.mouth = 'grin'; p.brow = 0.25;
      p.headZ = Math.sin(t * 2.4) * 0.05; p.headX = (p.headX ?? 0) + Math.max(0, Math.sin((t - 36) * 5)) * 0.12 * window01(t, 36.2, 38.0, 0.2);
      return p;
    }
    // ---------------- scene 7: stare, shrug
    base(-1.06, 0.12, 0.55); stand(); p.mouth = 'flat'; p.arms = [[0.05, -0.08, 0, -0.15], [0.05, 0.08, 0, -0.15]];
    lookAt(S.hatTop(), 0.95); p.blink = Math.max(this.blinkAt(t, 1.8), t > 47.9 && t < 48.05 ? 1 : 0);
    if (t > 46.0 && t < 48.2) { p.squint = 0.25; p.brow = -0.2; }
    const sh = window01(t, 48.25, 49.6, 0.2);
    if (sh > 0) {
      p.shrug = sh; p.headZ = 0.15 * sh; p.mouth = 'smirk'; p.brow = 0.5 * sh; p.browTilt = 0.4 * sh;
      p.reachL = local(-0.25, 0.8 + 0.06 * sh, 0.13); p.reachR = local(0.25, 0.8 + 0.06 * sh, 0.13);
      p.poleL = dirL(-0.35, -1, -0.15); p.poleR = dirL(0.35, -1, -0.15); p.handRot = [[-1.2 * sh, 0, 0.5 * sh], [-1.2 * sh, 0, -0.5 * sh]];
      lookAt(this.camera.position, 0.5 * sh + 0.4);
    }
    const talk = (t > 48.36 && t < 48.82) || (t > 48.92 && t < 49.55);
    if (talk) { p.mouth = Math.sin(t * 24) > -0.3 ? 'o' : 'smirk'; p.mouthScale = 0.75 + 0.25 * Math.abs(Math.sin(t * 24)); }
    if (t >= 49.55) p.mouth = 'smile';
    return p;
  }

  blinkAt(t, every) { const ph = (t % every) / every; return ph < 0.05 ? Math.sin((ph / 0.05) * Math.PI) : 0; }
  walkLegs(p, t, speed = 1) { const ph = t * 10 * speed; p.legs = [[Math.sin(ph) * 0.45, Math.max(0, -Math.sin(ph)) * 0.6], [Math.sin(ph + Math.PI) * 0.45, Math.max(0, Math.sin(ph)) * 0.6]]; p.bob = Math.abs(Math.sin(ph)) * 0.02; }

  // shovel motions (u = seconds into the action)
  digShovel(u, tip0, pileAt, f = 1) {
    const k = clamp(u / 0.62); const tipUp = V(-0.08 * f, 0.28, ZC - 0.06); const X = (v) => { v.x *= f; return v; }; const low = tip0.clone().add(V(0, -0.14, 0)); const lifted = V(0.05, 0.34, ZC - 0.1); const over = pileAt.clone().add(V(0, 0.28, 0));
    let tip, up, dirt = 0;
    if (k < 0.3) { const a = easeIn(k / 0.3); tip = tipUp.clone().lerp(low, a); up = V(-0.55, 1, 0.08); }
    else if (k < 0.55) { const a = easeOut((k - 0.3) / 0.25); tip = low.clone().lerp(lifted, a); up = V(-0.55, 1, 0.08).lerp(V(-0.9, 0.6, 0.05), a); dirt = 1; }
    else if (k < 0.8) { const a = easeInOut((k - 0.55) / 0.25); tip = lifted.clone().lerp(over, a); up = V(-0.9, 0.6, 0.05).lerp(V(-1, 0.25, 0.1), a); dirt = 1 - smooth((k - 0.66) / 0.1); }
    else { const a = easeInOut((k - 0.8) / 0.2); tip = over.clone().lerp(tipUp, a); up = V(-1, 0.25, 0.1).lerp(V(-0.55, 1, 0.08), a); }
    X(up); return { tip, up, face: V(0.3, 0.2, 1), dirt };
  }
  fillShovel(u, pileAt, holeAt, f = 1) {
    const k = clamp(u / 0.5); const a0 = V(-0.02 - 0.08 * (f - 1), 0.3, ZC - 0.06), a1 = pileAt.clone().add(V(-0.06, 0.02, 0)), a2 = holeAt.clone().add(V(0.02, 0.22, 0));
    let tip, up, dirt = 0;
    if (k < 0.35) { const a = easeInOut(k / 0.35); tip = a0.clone().lerp(a1, a); up = V(-1, 0.45, 0.1); }
    else if (k < 0.75) { const a = easeInOut((k - 0.35) / 0.4); tip = a1.clone().lerp(a2, a); up = V(-1, 0.45, 0.1).lerp(V(-0.8, 0.8, 0.1), a); dirt = 1 - smooth((k - 0.6) / 0.15); }
    else { const a = easeInOut((k - 0.75) / 0.25); tip = a2.clone().lerp(a0, a); up = V(-0.8, 0.8, 0.1).lerp(V(-0.55, 1, 0.08), a); }
    up.x *= f; return { tip, up, face: V(0.3, 0.6, 1), dirt };
  }
  patShovel(u, at, f = 1) { const k = clamp(u / 0.26); return { tip: at.clone().add(V(0, Math.abs(Math.cos(k * Math.PI)) * 0.2, 0)), up: V(-0.55 * f, 1, 0.1), face: V(0, 1, 0.3) }; }
  restShovel(local) { return { tip: local(0.26, 0.0, 0.08), up: V(0.04, 1, 0.02), face: V(0, 0, 1) }; }

  // ================================================================= crows
  crowHead(i) { const c = this.crows[i]; c.head.updateWorldMatrix(true, false); return c.head.getWorldPosition(new THREE.Vector3()); }

  planCrows() {
    const S = this.S;
    const fence = (i) => () => ({ p: V([-1.2, -0.75, 0.62, 1.03, 1.44][i], FENCE_TOP, FENCE_Z + 0.03), yaw: 0 });
    const ground = (x, z, yaw = 0) => () => ({ p: V(x, 0.045, z), yaw });
    const arm = (side, u) => (tt) => this.evalAt(tt, `arm${side},${u}`, () => ({ p: S.armPoint(side, u), yaw: S.spin.rotation.y }));
    const hat = (a, r = 0.26, y = -0.012) => (tt) => this.evalAt(tt, `hat${a},${r},${y}`, () => ({ p: S.worldOf(S.hat, V(Math.cos(a) * r, y, Math.sin(a) * r)), yaw: S.spin.rotation.y }));
    const crown = () => (tt) => this.evalAt(tt, 'crown', () => ({ p: S.worldOf(S.hat, V(0, 0.15, 0)), yaw: S.spin.rotation.y }));
    const off = (x, y, z) => () => ({ p: V(x, y, z), yaw: Math.atan2(x, z) });
    const bush = (b, dx = 0) => () => ({ p: V(BUSHES[b].x + dx, BUSHES[b].r * 0.95, BUSHES[b].z + 0.05), yaw: Math.PI });
    const SCF = () => S.worldOf(S.head);
    const cam = () => this.camera.position.clone();
    const P = this.plans = [[], [], [], [], []];
    const add = (i, s) => P[i].push(s);

    for (let i = 0; i < 5; i++) {
      const L = i < 2; const st = i * 0.07;
      // ---- scene 1: land on the fence, see the scarecrow, panic
      add(i, { type: 'hide', t0: -1, t1: 3.75 + st });
      add(i, { type: 'fly', t0: 3.75 + st, t1: 4.22 + st, from: off(L ? -3.2 : 3.2, 3.0, -2.6), to: fence(i), h: 0.4 });
      add(i, { type: 'perch', t0: 4.22 + st, t1: 4.98 + st * 0.6, at: fence(i), look: SCF, mood: (t) => (t < 4.62 ? { lid: 0.35 } : { lid: -0.2, wide: 1, browUp: 1, beakOpen: pulse(t, 4.66 + st * 0.3, 0.03, 0.25) * 0.9, squash: -pulse(t, 4.62, 0.03, 0.2) * 0.12 }) });
      add(i, { type: 'fly', t0: 4.98 + st * 0.6, t1: 6.1 + st, from: fence(i), to: off(L ? -4.2 : 4.2, 4.2, -4), h: 0.6, panic: true });
      add(i, { type: 'hide', t0: 6.1 + st, t1: 8.0 + st });
      // ---- scene 2: return, stare, poke, perch on arms, munch tomatoes, get flung
      const gx = [-0.36, -0.62, 0.42, 0.68, 0.95][i], gz = [-0.08, -0.26, -0.12, -0.28, -0.08][i];
      const faceSC = Math.atan2(-gx, PZ - gz);
      add(i, { type: 'fly', t0: 8.0 + st, t1: 8.55 + st, from: off(L ? -3.4 : 3.4, 3.2, -3), to: ground(gx, gz, faceSC), h: 0.4 });
      const armSpot = [[0, 0.45], [0, 0.9], [1, 0.42], [1, 0.88], null][i];
      const at2 = armSpot ? arm(...armSpot) : crown();
      if (i === 0) {
        add(i, { type: 'perch', t0: 8.55, t1: 9.08, at: ground(gx, gz, faceSC), look: SCF, mood: { lid: 0.62, brow: 0.8 } });
        add(i, { type: 'hop', t0: 9.08, t1: 9.28, from: ground(gx, gz, faceSC), to: ground(-0.14, 0.13, 1.25), h: 0.12 });
        add(i, { type: 'perch', t0: 9.28, t1: 9.98, at: ground(-0.14, 0.13, 1.25), look: (t) => (t < 9.75 ? V(0, 0.4, PZ) : cam()), mood: (t) => ({ lid: 0.45, pecks: [9.35, 9.6], browR: t > 9.75 ? 0.95 : 0.3, browL: t > 9.75 ? -0.2 : 0.3 }) });
        add(i, { type: 'hop', t0: 9.98, t1: 10.36, from: ground(-0.14, 0.13, 1.25), to: at2, h: 0.5 });
      } else {
        add(i, { type: 'perch', t0: 8.55 + st, t1: 9.98 + st, at: ground(gx, gz, faceSC), look: (t) => (t < 9.3 ? SCF() : this.crowHead(0)), mood: (t) => ({ lid: t > 9.75 ? 0.4 : 0.62, brow: 0.7, browR: t > 9.75 ? 0.9 : undefined, headRoll: Math.sin(i * 2) * 0.25 }) });
        add(i, { type: 'hop', t0: 9.98 + st, t1: 10.36 + st, from: ground(gx, gz, faceSC), to: at2, h: armSpot ? 0.55 : 0.8 });
      }
      const flungT = 12.6 + [0.05, 0.12, 0.0, 0.08, 0.16][i];
      add(i, { type: 'perch', t0: 10.36 + st, t1: flungT, at: at2, look: cam, mood: (t) => ({ lid: t > 12.45 ? -0.2 : 0.5, brow: 0.3, munch: i !== 4 ? [10.55 + i * 0.07, flungT] : null, wide: t > 12.45 ? 1 : 0 }) });
      add(i, { type: 'flung', t0: flungT, t1: flungT + 1.3, from: at2, to: off(i % 2 ? 4.0 : -4.0, 2.6 + i * 0.2, -3.5), seed: i });
      add(i, { type: 'hide', t0: flungT + 1.3, t1: 13.7 + st });
      // ---- scene 3: watch + nod with the pattern, land between spins, hop during a spin, random -> confused
      add(i, { type: 'fly', t0: 13.7 + st, t1: 14.3 + st, from: off(L ? -3.2 : 3.2, 3.0, -3), to: fence(i), h: 0.4 });
      add(i, { type: 'perch', t0: 14.3 + st, t1: 16.6 + st * 0.2, at: fence(i), look: SCF, mood: (t) => ({ lid: 0.55, brow: 0.6, nods: PAT_STARTS, browR: t > 15.4 ? 0.95 : 0.4 }) });
      const spot3 = [[0, 0.32], [0, 0.8], [1, 0.3], [1, 0.66], [1, 1.0]][i];
      const land3 = PAT_STARTS[2] + PAT_SPIN + 0.01;
      add(i, { type: 'fly', t0: 16.6 + st * 0.2, t1: land3, from: fence(i), to: arm(...spot3), h: 0.25 });
      add(i, { type: 'perch', t0: land3, t1: 17.94, at: arm(...spot3), look: cam, mood: { lid: 0.6, brow: 0.9, browR: 1 } });
      add(i, { type: 'hover', t0: 17.94, t1: 18.82, at: arm(...spot3), h: 0.2 });
      const t3 = 19.05 + (i % 3) * 0.12;
      add(i, { type: 'perch', t0: 18.82, t1: t3, at: arm(...spot3), look: cam, mood: { lid: 0.55, brow: 1 } });
      add(i, { type: 'flung', t0: t3, t1: t3 + 0.5, from: arm(...spot3), seed: 10 + i, short: true });
      add(i, { type: 'confused', t0: t3 + 0.5, t1: 20.6 + st, center: V([-0.9, -0.45, 0.4, 0.9, 0.05][i], 1.65 + (i % 2) * 0.25, -0.4) });
      add(i, { type: 'fly', t0: 20.6 + st, t1: 21.4 + st, from: (tt) => { const q = this.crowPose(i, tt - 0.001); return { p: V(q.x, q.y, q.z), yaw: q.yaw }; }, to: off(i % 2 ? 4.2 : -4.2, 3.6, -4), h: 0.4, panic: true });
      add(i, { type: 'hide', t0: 21.4 + st, t1: 22.05 + i * 0.25 });
      // ---- scene 4: sneak in on tiptoe from the left, step into the cone, flee
      const sneakEnd = [-0.5, -0.74, -0.96, -1.16, -1.34][i], sneakZ = [-0.52, -0.66, -0.48, -0.64, -0.5][i];
      add(i, { type: 'walk', t0: 22.0 + i * 0.22, t1: 25.55, from: V(-1.75 - i * 0.2, 0.0, sneakZ - 0.12), to: V(sneakEnd, 0.0, sneakZ), tiptoe: true });
      add(i, { type: 'perch', t0: 25.55, t1: 25.86 + st * 0.5, at: ground(sneakEnd, sneakZ, 1.4), look: SCF, mood: (t) => ({ lid: t > 25.64 ? -0.3 : 0.2, wide: t > 25.64 ? 1 : 0, beakOpen: t > 25.68 ? 0.8 : 0, squash: -pulse(t, 25.64, 0.03, 0.2) * 0.15 }) });
      add(i, { type: 'fly', t0: 25.86 + st * 0.5, t1: 27.1 + st, from: ground(sneakEnd, sneakZ, 1.4), to: off(-4.4, 3.8, -3.5), h: 0.7, panic: true });
      add(i, { type: 'hide', t0: 27.1 + st, t1: 28.75 + st });
      // ---- scene 5: back and bored; one waves at the eyes; screech; dive into the bushes
      const bx = [-0.62, -0.95, -1.28, -1.6, -0.3][i], bz = [-0.42, -0.2, -0.46, -0.24, -0.6][i];
      if (i === 1) {
        add(i, { type: 'fly', t0: 28.75 + st, t1: 29.45, from: off(-3.4, 3.0, -2.5), to: ground(bx, bz, 1.2), h: 0.4 });
        add(i, { type: 'perch', t0: 29.45, t1: 29.9, at: ground(bx, bz, 1.2), look: SCF, mood: { lid: 0.7, brow: 0.2 } });
        add(i, { type: 'hop', t0: 29.9, t1: 30.25, from: ground(bx, bz, 1.2), to: arm(0, 0.3), h: 0.45 });
        add(i, { type: 'perch', t0: 30.25, t1: 32.68, at: arm(0, 0.3), look: (t) => (t < 31.2 ? SCF() : cam()), mood: (t) => ({ lid: t > 32.62 ? -0.3 : 0.55, brow: 0.5, browR: 0.9, waveR: window01(t, 30.35, 31.0, 0.1), wide: t > 32.62 ? 1 : 0 }) });
        add(i, { type: 'fly', t0: 32.68, t1: 33.08, from: arm(0, 0.3), to: bush(1, -0.1), h: 0.5, panic: true, dive: true });
      } else {
        add(i, { type: 'fly', t0: 28.75 + st, t1: 29.4 + st, from: off(i < 3 ? -3.4 : 3.4, 3.0, -2.5), to: ground(bx, bz, 1.3), h: 0.4 });
        add(i, { type: 'perch', t0: 29.4 + st, t1: 32.68 + st * 0.3, at: ground(bx, bz, 1.3), look: (t) => (t < 31.6 ? SCF() : V(1.0, 1.2, 0.12)), mood: (t) => ({ lid: t > 32.62 ? -0.3 : 0.78, brow: 0.1, yawn: i === 2 ? [30.6, 31.3] : null, wide: t > 32.62 ? 1 : 0, beakOpen: t > 32.64 ? 0.9 : 0 }) });
        add(i, { type: 'fly', t0: 32.68 + st * 0.3, t1: 33.1 + st * 0.3, from: ground(bx, bz, 1.3), to: bush(i % 2 === 0 ? 0 : 1, (i - 2) * 0.08), h: 0.45, panic: true, dive: true });
      }
      if (i === 3) {
        add(i, { type: 'hide', t0: 33.1 + st * 0.3, t1: 34.15 });
        add(i, { type: 'peek', t0: 34.15, t1: 35.3, at: () => ({ p: V(BUSHES[0].x + 0.18, BUSHES[0].r * 1.45, BUSHES[0].z + 0.22), yaw: 0.3 }) });
        add(i, { type: 'hide', t0: 35.3, t1: 41.6 });
      } else add(i, { type: 'hide', t0: 33.1 + st * 0.3, t1: 41.6 });
      // ---- scene 7: the family on the hat, peck the speaker button, dance
      const spot7 = [arm(0, 0.3), arm(0, 0.85), arm(1, 0.5), hat(-0.15, 0.27), arm(1, 0.95)][i];
      add(i, { type: 'perch', t0: 41.6, t1: 99, at: spot7, appear: 41.95, look: (t) => (i === 3 && t > 45.0 && t < 45.6 ? S.buttonPos() : t < DANCE_T0 ? S.nestPoint(0, 0, 0.06) : cam()), mood: (t) => ({ lid: 0.3, brow: 0.2, dance: t > DANCE_T0 + 0.1, pecks: i === 3 ? [45.47] : null, mama: i < 2 }) });
    }
  }

  crowPose(i, t) {
    const plan = this.plans[i]; const C = this.crows[i];
    const s = plan.find((x) => t >= x.t0 && t < x.t1) || plan[plan.length - 1];
    const q = { time: t, visible: true, spread: 0, flap: 0, tuck: 0, lid: C.restLid };
    const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
    const flapAt = (f = 7) => Math.sin(t * TAU * f + i);
    switch (s.type) {
      case 'hide': q.visible = false; q.y = -5; break;
      case 'perch': {
        if (s.appear && t < s.appear) { q.visible = false; q.y = -5; break; }
        const a = s.at(t); q.x = a.p.x; q.y = a.p.y; q.z = a.p.z;
        const look = s.look ? s.look(t) : null;
        q.yaw = look ? yawTo(a.p, look) : a.yaw;
        const m = typeof s.mood === 'function' ? s.mood(t) : (s.mood || {});
        for (const k of ['lid', 'brow', 'browL', 'browR', 'wide', 'headRoll', 'beakOpen', 'squash', 'waveR', 'browUp']) if (m[k] !== undefined && m[k] !== null) q[k] = m[k];
        q.bob = Math.sin(t * 2.3 + i * 1.7) * 0.004;
        if (look) {
          const d = look.clone().sub(a.p.clone().add(V(0, 0.3, 0))); let hy = Math.atan2(d.x, d.z) - q.yaw; hy = Math.atan2(Math.sin(hy), Math.cos(hy));
          q.headYaw = clamp(hy, -1, 1); q.headPitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.6, -0.5, 0.5); q.gaze = [clamp(hy * 1.4, -1, 1), clamp(-q.headPitch, -1, 1)];
        }
        q.headYaw = (q.headYaw ?? 0) + noise1(t * 0.7, i * 13) * 0.25; q.headRoll = (q.headRoll ?? 0) + noise1(t * 0.5, i * 7) * 0.12;
        if (m.pecks) for (const pk of m.pecks) { const v = pulse(t, pk, 0.06, 0.12); q.headPitch = (q.headPitch ?? 0) + v * 0.9; q.pitch = (q.pitch ?? 0) + v * 0.35; q.neckOut = v; }
        if (m.nods) for (const ns of m.nods) { const v = pulse(t, ns, 0.08, 0.18) + pulse(t, ns + PAT_SPIN, 0.08, 0.18) * 0.6; q.headPitch = (q.headPitch ?? 0) + v * 0.45; }
        if (m.munch && t > m.munch[0] && t < m.munch[1]) { const v = Math.max(0, Math.sin((t - m.munch[0]) * 14)); q.headPitch = (q.headPitch ?? 0) + v * 0.35; q.beakOpen = 0.3 + v * 0.4; }
        if (m.yawn) { const v = window01(t, m.yawn[0], m.yawn[1], 0.2); q.beakOpen = Math.max(q.beakOpen ?? 0, v); q.lid = lerp(q.lid, 0.95, v); q.headPitch = (q.headPitch ?? 0) - v * 0.4; }
        if (m.dance) { const b = (t - DANCE_T0) / BEAT; const v = Math.abs(Math.sin(b * Math.PI)); q.bob = v * 0.04; q.headPitch = (q.headPitch ?? 0) + Math.sin(b * TAU) * 0.35; q.headRoll = Math.sin(b * Math.PI) * 0.3; q.spread = 0.25 + 0.2 * v; q.flap = 0.4 * Math.sin(b * TAU); q.lid = 0.25; q.tailFan = v; q.bodyRoll = Math.sin(b * Math.PI) * 0.12; }
        if (m.mama && t < DANCE_T0) q.headRoll = (q.headRoll ?? 0) + 0.2;
        const since = t - s.t0; // landing settle
        if (since < 0.2 && !s.appear) { const k = 1 - since / 0.2; q.spread = Math.max(q.spread, k * 0.8); q.flap = Math.sin(t * 40) * 0.4 * k; q.squash = (q.squash ?? 0) + k * 0.1 * Math.sin(since * 30); }
        if (s.appear) q.scale = pop(t, s.appear, 0.35);
        break;
      }
      case 'fly': case 'hop': {
        const u = seg(t, s.t0, s.t1); const A = s.from(s.t0); const B = s.to(Math.min(t + 0.05, s.t1));
        const e = s.type === 'hop' ? easeInOut(u) : smooth(u);
        const dist = A.p.distanceTo(B.p);
        const p = A.p.clone().lerp(B.p, e); p.y += Math.sin(Math.PI * u) * (s.h ?? 0.4) * (dist > 1 ? 1 : 0.6 + 0.4 * dist);
        q.x = p.x; q.y = p.y; q.z = p.z;
        const ahead = A.p.clone().lerp(B.p, Math.min(1, e + 0.05)); const dir = ahead.sub(p); dir.y = 0;
        q.yaw = dir.lengthSq() > 1e-6 ? Math.atan2(dir.x, dir.z) : B.yaw;
        if (u > 0.85) q.yaw = lerp(q.yaw, B.yaw, smooth((u - 0.85) / 0.15));
        q.spread = s.type === 'hop' ? Math.sin(Math.PI * u) : smooth(Math.min(u / 0.12, 1)) * (1 - smooth((u - 0.92) / 0.08));
        q.flap = flapAt(s.type === 'hop' ? 4 : s.panic ? 9 : 7) * 0.9;
        q.tuck = s.type === 'hop' ? Math.sin(Math.PI * u) * 0.5 : Math.sin(Math.PI * clamp(u * 1.2));
        q.pitch = s.type === 'hop' ? -0.1 : 0.5 * Math.sin(Math.PI * u) - (u > 0.8 ? (u - 0.8) * 2 : 0);
        if (s.panic) { q.wide = 1; q.lid = -0.3; q.beakOpen = 0.6 + 0.4 * Math.sin(t * 17 + i); q.browUp = 1; }
        if (s.dive && u > 0.75) q.scale = 1 - smooth((u - 0.8) / 0.2);
        break;
      }
      case 'flung': {
        const A = s.from(s.t0); const u = t - s.t0; const r = rng(100 + s.seed);
        const v = V((A.p.x > 0 ? 1 : -1) * (1.6 + r()), 1.6 + r() * 0.8, 0.6 + r() * 0.6);
        if (s.short) v.multiplyScalar(0.55);
        const p = A.p.clone().addScaledVector(v, u); p.y -= 0.5 * 4.5 * u * u;
        if (!s.short) { const fly = smooth(seg(u, 0.35, 1.3)); p.lerp(s.to(t).p, fly * fly); }
        p.y = Math.max(p.y, 0.05);
        q.x = p.x; q.y = p.y; q.z = p.z; q.yaw = u * 9 * (s.seed % 2 ? 1 : -1); q.roll = Math.sin(u * 11) * 0.8 * (1 - seg(u, 0.3, 0.8));
        q.spread = 1; q.flap = flapAt(10) * 0.9; q.wide = 1; q.lid = -0.3; q.beakOpen = 0.8; q.tuck = 0.7; q.browUp = 1;
        break;
      }
      case 'hover': {
        const A = s.at(s.t0 - 0.06); const u = seg(t, s.t0, s.t1);
        q.x = A.p.x; q.z = A.p.z; q.y = A.p.y + Math.sin(Math.PI * u) * s.h + Math.sin(t * 20) * 0.006;
        q.yaw = yawTo(A.p, this.camera.position); q.spread = 1; q.flap = flapAt(6) * 0.8; q.tuck = 0.3; q.lid = 0.55; q.browR = 1; q.brow = 0.8; q.headYaw = 0.2;
        break;
      }
      case 'confused': {
        const u = t - s.t0; const c = s.center; const r = 0.22;
        q.x = c.x + Math.cos(u * 4 + i) * r; q.z = c.z + Math.sin(u * 4 + i) * r * 0.6; q.y = c.y + Math.sin(u * 7 + i) * 0.08;
        q.yaw = u * 4 + i + Math.PI / 2; q.spread = 1; q.flap = flapAt(7); q.tuck = 0.8; q.lid = 0.1; q.headRoll = Math.sin(u * 6) * 0.4; q.wide = 0.4; q.browL = -0.6; q.browR = 0.9;
        break;
      }
      case 'walk': {
        const u = seg(t, s.t0, s.t1); const p = s.from.clone().lerp(s.to, u);
        q.x = p.x; q.y = p.y + (s.tiptoe ? Math.abs(Math.sin(u * 40)) * 0.02 : 0); q.z = p.z;
        q.yaw = yawTo(s.from, s.to) + Math.sin(u * 20) * 0.05; q.step = u * 40; q.lid = 0.15; q.lowLid = 0; q.wide = 0.3;
        q.spread = s.tiptoe ? 0.15 : 0; q.pitch = 0.18; q.headYaw = Math.sin(t * 2.4 + i) * 0.5; q.brow = 0.8; q.bob = 0.02;
        break;
      }
      case 'peek': {
        const a = s.at(t); const up = window01(t, s.t0, s.t1, 0.2);
        q.x = a.p.x; q.z = a.p.z; q.y = a.p.y - 0.25 + up * 0.2; q.yaw = a.yaw; q.lid = 0.2; q.wide = 0.6; q.headYaw = Math.sin(t * 3) * 0.6;
        break;
      }
    }
    if (q.visible) this.lastPos[i].set(q.x ?? 0, q.y ?? 0, q.z ?? 0);
    return q;
  }

  // ================================================================= FX plan
  planFX() {
    const F = this.fx, S = this.S;
    const holeTop = V(0, 0.05, ZC - 0.1); const pileTop = V(0.5, 0.12, 0.0);
    const lp = (i, dy = 0) => (tt) => { const q = this.crowPose(i, tt); return V(q.x ?? 0, (q.y ?? 0) + dy, q.z ?? 0); };
    [0.3, 0.92, 1.54].forEach((d, k) => {
      F.dirtBurst(d + 0.18, holeTop, holeTop.clone().add(V(0, 0.12, 0)), { n: 6, dur: 0.18, arc: 0.06, seed: 10 + k, size: 0.028 });
      F.dirtBurst(d + 0.42, V(0.1, 0.36, ZC - 0.1), pileTop, { n: 14, dur: 0.26, arc: 0.12, seed: 20 + k, size: 0.034 });
      F.puff(d + 0.2, holeTop, { n: 4, size: 0.22, seed: 30 + k });
    });
    F.puff(2.78, V(0, 0.05, ZC), { n: 8, size: 0.35, seed: 40 });
    F.sparkle(2.38, V(0, 1.5, PZ + 0.25), { n: 8, size: 0.16, seed: 41 });
    [3.05, 3.5].forEach((d, k) => F.dirtBurst(d + 0.3, V(0.2, 0.25, ZC - 0.1), V(0, -0.05, ZC - 0.1), { n: 16, dur: 0.22, arc: 0.05, seed: 50 + k, size: 0.03, spread: 0.08 }));
    [4.0, 4.26].forEach((d, k) => F.puff(d + 0.13, V(0, 0.03, ZC - 0.05), { n: 5, size: 0.2, seed: 60 + k }));
    for (let i = 0; i < 5; i++) { F.glyph(4.62 + i * 0.03, 5.12, '!', lp(i, 0.45), { size: 0.17 }); F.featherBurst(5.0 + i * 0.06, lp(i, 0.2), { n: 3, seed: 70 + i }); }
    F.glyph(9.72, 10.0, '?', lp(0, 0.45), { size: 0.12 });
    F.dirtBurst(10.98, V(0.05, 0.35, ZC - 0.1), pileTop, { n: 18, dur: 0.26, arc: 0.14, seed: 80, size: 0.036 });
    F.dirtBurst(11.2, V(-0.15, 0.36, ZC - 0.1), V(-0.6, 0.02, -0.2), { n: 12, dur: 0.3, arc: 0.2, seed: 81, size: 0.03 });
    F.puff(10.95, holeTop, { n: 7, size: 0.3, seed: 82 });
    F.sparkle(11.33, V(0.1, -0.5, ZC + 0.15), { n: 8, size: 0.14, seed: 83 }); F.sparkle(11.53, V(0.95, -0.42, ZC + 0.15), { n: 7, size: 0.12, seed: 84 });
    F.dirtBurst(11.75, V(0.2, 0.25, ZC - 0.1), V(0, -0.05, ZC - 0.1), { n: 18, dur: 0.22, arc: 0.05, seed: 85, size: 0.032 });
    F.puff(12.02, V(0, 0.03, ZC - 0.05), { n: 6, size: 0.24, seed: 86 });
    for (let i = 0; i < 5; i++) F.featherBurst(12.65 + i * 0.05, lp(i, 0.15), { n: 4, seed: 90 + i });
    F.puff(17.95, V(-0.62, 0.04, ZC - 0.05), { n: 5, size: 0.22, seed: 100 }); F.sparkle(18.18, V(-0.66, -0.45, ZC + 0.15), { n: 8, size: 0.13, seed: 101 });
    for (let i = 0; i < 5; i++) { const t3 = 19.05 + (i % 3) * 0.12; F.glyph(t3 + 0.35, 20.7, '?', lp(i, 0.45), { size: 0.12 }); F.featherBurst(t3, lp(i, 0.15), { n: 3, seed: 110 + i }); }
    F.sparkle(24.39, () => S.eyePos(0), { n: 6, size: 0.1, seed: 120 }); F.sparkle(24.41, () => S.eyePos(1), { n: 6, size: 0.1, seed: 121 });
    F.sparkle(24.83, () => S.sensorPos(), { n: 7, size: 0.12, seed: 122 });
    for (let i = 0; i < 5; i++) { F.glyph(25.64, 26.2, '!', lp(i, 0.48), { size: 0.13 }); F.featherBurst(25.9 + i * 0.05, lp(i, 0.2), { n: 3, seed: 130 + i }); }
    F.ring(25.64, () => S.sensorPos(), { dur: 0.5, r0: 0.05, r1: 0.5, color: 0xff3020, intensity: 1.4 });
    F.sparkle(31.96, () => S.speakerPos(), { n: 8, size: 0.13, seed: 140 });
    for (let k = 0; k < 7; k++) F.ring(32.6 + k * 0.15, () => S.speakerPos(), { dur: 0.95, r0: 0.08, r1: 1.4, color: 0xffa040, intensity: 1.05 - k * 0.08 });
    for (let i = 0; i < 5; i++) F.glyph(32.62 + i * 0.02, 33.05, '!', lp(i, 0.48), { size: 0.14 });
    for (const b of [0, 1]) { F.leafBurst(33.0 + b * 0.08, V(BUSHES[b].x, BUSHES[b].r * 1.2, BUSHES[b].z + 0.2), { n: 18, seed: 150 + b }); F.featherBurst(33.02 + b * 0.08, V(BUSHES[b].x, BUSHES[b].r * 1.3, BUSHES[b].z + 0.3), { n: 4, seed: 152 + b }); }
    for (let k = 0; k < 10; k++) F.ring(DANCE_T0 + k * BEAT, () => S.speakerPos(), { dur: 0.6, r0: 0.05, r1: 0.5, color: [0xff5ad8, 0x5af0ff, 0xffe14d][k % 3], intensity: 1.3 });
    for (let k = 0; k < 8; k++) { const tb = DANCE_T0 + 0.15 + k * 0.6; F.glyph(tb, tb + 1.4, ['n1', 'n2', 'n3'][k % 3], ((kk) => () => S.speakerPos().add(V(0.08 + (kk % 2) * 0.05, 0.08, 0.1)))(k), { size: 0.09 }); }
    F.sparkle(41.95, () => S.nestPoint(0, 0, 0.06), { n: 10, size: 0.14, seed: 170 });
  }

  planSound() {
    const s = this.sfx;
    [0.3, 0.92, 1.54].forEach((d) => { s(d + 0.17, 'dig', 1); s(d + 0.44, 'dirt_toss', 0.8); s(d + 0.72, 'dirt_land', 0.6); });
    s(2.25, 'pop', 0.9); s(2.78, 'thud', 1.0); s(3.35, 'dirt_pour', 0.8); s(3.8, 'dirt_pour', 0.8); s(4.13, 'pat', 0.9); s(4.39, 'pat', 0.9); s(2.9, 'step', 0.5); s(3.0, 'step', 0.5);
    for (let i = 0; i < 5; i++) { s(3.75 + i * 0.07, 'flap', 0.5, i < 2 ? -0.6 : 0.6); s(4.22 + i * 0.07, 'land', 0.4); }
    s(4.45, 'caw', 0.7, -0.3); s(4.62, 'sting', 0.8); s(4.68, 'caw_panic', 1.0, -0.2); s(4.75, 'caw_panic', 0.9, 0.3); s(5.0, 'flap_big', 1.0); s(5.1, 'caw_panic', 0.8, 0.5);
    s(7.05, 'pop_soft', 0.6); s(7.45, 'page_flip', 0.9); s(7.75, 'page_flip', 0.9); s(8.05, 'page_flip', 0.9);
    s(8.0, 'flap', 0.6); s(8.55, 'land', 0.5); s(8.75, 'caw', 0.6, 0.3); s(9.35, 'peck', 1.0); s(9.6, 'peck', 1.0); s(9.8, 'caw_smug', 0.7);
    s(10.0, 'flap', 0.7); s(10.3, 'land', 0.5); for (let k = 0; k < 6; k++) s(10.6 + k * 0.3, 'munch', 0.55, k % 2 ? 0.4 : -0.4);
    s(10.97, 'dig', 1); s(11.0, 'dirt_toss', 0.9); s(11.28, 'clank', 1.0); s(11.48, 'clank_small', 0.8); s(11.6, 'zip', 0.7); s(11.78, 'dirt_pour', 0.8); s(12.03, 'pat', 0.8);
    s(12.42, 'motor_start', 1.0); s(12.62, 'caw_panic', 1.0, -0.4); s(12.7, 'caw_panic', 0.9, 0.4); s(12.68, 'flap_big', 0.9); s(12.8, 'whoosh', 0.8);
    s(13.75, 'flap', 0.5); for (const ps of PAT_STARTS) { s(ps, 'motor_burst', 0.75); s(ps + 0.05, 'whoosh', 0.45); }
    s(15.5, 'caw_smug', 0.5, -0.4); s(16.62, 'flap', 0.6); s(17.42, 'land', 0.6); s(17.94, 'flap', 0.6); s(18.82, 'land', 0.5); s(17.0, 'facepalm', 0.7);
    s(17.95, 'dig_small', 0.8); s(18.15, 'pop', 0.8); s(18.27, 'zip', 0.5); s(18.55, 'beep', 0.8); s(18.7, 'beep', 0.8); s(18.85, 'beep_hi', 0.8);
    [19.02, 19.4, 19.62, 20.12, 20.32, 20.72].forEach((x) => { s(x, 'boing', 0.6); s(x, 'beep', 0.4); });
    [19.22, 19.88, 20.5].forEach((x) => s(x, 'motor_burst', 0.8));
    s(19.1, 'bonk', 0.8); s(19.25, 'caw_confused', 0.8, -0.3); s(19.45, 'caw_confused', 0.7, 0.3); s(20.0, 'caw_confused', 0.6); s(20.6, 'flap_big', 0.7);
    s(21.0, 'night_whoosh', 0.6);
    for (let k = 0; k < 9; k++) s(22.3 + k * 0.36, 'tiptoe', 0.5, -0.5 + k * 0.05);
    s(23.95, 'whoosh_small', 0.6); s(24.38, 'snap', 0.9); s(24.4, 'snap', 0.6); s(24.45, 'glow_on', 0.7); s(24.5, 'whoosh_small', 0.6); s(24.82, 'snap', 0.9); s(25.0, 'scan_hum', 0.6);
    s(25.6, 'sensor_click', 1.0); s(25.62, 'alarm_buzz', 0.8); s(25.7, 'boing', 0.5); s(25.72, 'caw_panic', 1.0, -0.4); s(25.82, 'caw_panic', 0.9, -0.2); s(25.9, 'flap_big', 1.0); s(26.1, 'caw_panic', 0.8, -0.5);
    s(28.75, 'flap', 0.6); s(29.4, 'land', 0.4);
    s(29.35, 'sensor_click', 0.8); s(29.37, 'alarm_buzz', 0.5); s(30.15, 'sensor_click', 0.8); s(30.17, 'alarm_buzz', 0.5);
    s(29.9, 'flap', 0.5); s(30.5, 'caw_smug', 0.7, -0.3); s(30.9, 'yawn_caw', 0.6, -0.2); s(30.6, 'facepalm', 0.6);
    s(31.6, 'whoosh_small', 0.7); s(31.95, 'snap', 0.9); s(32.2, 'speaker_on', 0.6);
    s(32.6, 'hawk', 1.0); s(32.68, 'caw_panic', 0.9, -0.3); s(32.72, 'flap_big', 1.0); s(33.0, 'bush', 1.0, -0.5); s(33.08, 'bush', 1.0, 0.5); s(34.2, 'bush_small', 0.6, -0.4);
    s(36.0, 'motor_burst', 0.6); s(37.45, 'boing', 0.4); s(37.95, 'boing', 0.4);
    s(41.3, 'pop_soft', 0.6); s(41.55, 'page_flip', 0.9); s(41.85, 'page_flip', 0.9); s(42.15, 'page_flip', 0.9);
    for (let k = 0; k < 11; k++) s(43.5 + k * 0.17 + (k % 3) * 0.05, 'chirp', 0.6, k % 2 ? 0.2 : -0.2);
    s(45.47, 'peck', 1.0); s(45.5, 'button_click', 0.9);
  }

  // ================================================================= update
  update(t) {
    const S = this.S, K = this.K;
    const night = smooth(seg(t, 20.9, 21.9)) * (1 - smooth(seg(t, 28.05, 28.85)));
    const day = smooth(seg(t, 28.05, 28.85)) * (1 - smooth(seg(t, 34.8, 36.2)));
    const sunset = smooth(seg(t, 34.8, 36.2)) * (1 - smooth(seg(t, 41.4, 42.4)));
    const golden = Math.max(0, 1 - night - day - sunset);
    const st = mixPresets([{ p: 'golden', w: golden }, { p: 'night', w: night }, { p: 'day', w: day }, { p: 'sunset', w: sunset }]);
    const lapse = window01(t, 7.2, 8.3, 0.2) + window01(t, 41.4, 42.5, 0.2);
    st.sunPos = st.sunPos.map((v, k) => v + (k === 0 ? Math.sin(t * 9) * 1.2 * lapse : 0));
    this.light.apply(st);

    const cam = this.cameraAt(t);
    this.camera.position.set(...cam.pos);
    const shake = pulse(t, 32.6, 0.02, 0.35) * 0.012 + pulse(t, 2.78, 0.02, 0.15) * 0.006;
    this.camera.position.x += Math.sin(t * 61) * shake; this.camera.position.y += Math.sin(t * 53 + 1) * shake;
    this.camera.lookAt(...cam.tgt); this.camera.fov = cam.fov; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);

    // hole state
    let open = 0;
    for (const d of [0.3, 0.92, 1.54]) open += clamp((t - d - 0.1) / 0.12) * 0.434;
    open = Math.min(open, 1.3); let dist = open;
    if (t > 2.95) open = 1.3 - clamp((t - 3.35) / 0.2) * 0.65 - clamp((t - 3.8) / 0.2) * 0.65;
    if (t > 2.95) dist = 1.3;
    if (t > 10.8) open = Math.max(open, clamp((t - 10.95) / 0.12) * 0.78);
    if (t > 11.7) open = 0.78 * (1 - clamp((t - 11.72) / 0.25));
    open = Math.max(0, open);
    U.uHoleOpen.value = open; U.uHoleDisturbed.value = t > 0.3 ? Math.max(dist, open) : 0; U.uHoleR.value = HOLE_R; U.uHoleX.value = 0; U.uHoleZ.value = ZC;
    const cv = this.world.cavity; const o = Math.max(0.0001, open);
    cv.cav.scale.set(HOLE_R * 1.08, o, HOLE_R * 1.08); cv.cav.visible = open > 0.01;
    cv.cavBottom.position.set(0, -o, ZC); cv.cavBottom.scale.setScalar(HOLE_R * 0.92); cv.cavBottom.visible = open > 0.01;
    const pileAmt = clamp(open * 0.9 + (t > 0.5 ? 0.15 : 0), 0, 1.3);
    this.pile.scale.set(0.24 * (0.4 + pileAmt), 0.22 * (0.15 + pileAmt), 0.22 * (0.4 + pileAmt)); this.pile.visible = t > 0.35;

    const sp = this.scarecrowPose(t);
    this.curT = t; this.curSP = sp;
    S.setPose(sp); S.root.updateMatrixWorld(true);
    S.setConeDir(V(-0.62, -0.4, 0.66).applyAxisAngle(V(0, 1, 0), -sp.spin));

    this.crows.forEach((c, i) => c.setPose(this.crowPose(i, t)));
    K.setPose(this.kidPose(t));
    for (const [key, th] of Object.entries(this.throws)) {
      const m = th.mesh; const fly = t >= th.t0 && t < th.t1; m.visible = fly; if (!fly) continue;
      const u = seg(t, th.t0, th.t1); const from = K.handWorld(1);
      const to = key === 'eyeL' ? S.eyePos(0) : key === 'eyeR' ? S.eyePos(1) : key === 'sensor' ? S.sensorPos() : S.worldOf(S.speaker, V(0, 0.05, 0));
      m.position.copy(from).lerp(to, u); m.position.y += Math.sin(Math.PI * u) * 0.45; m.rotation.set(u * 9, u * 7, 0);
    }

    this.stolen.forEach((m, i) => {
      const show = i !== 4 && t > 10.5 && t < 12.6 + i * 0.05; m.visible = show; if (!show) return;
      const c = this.crows[i]; c.beak.updateWorldMatrix(true, false);
      m.position.copy(V(0, -0.025, 0.13).applyMatrix4(c.beak.matrixWorld));
      m.scale.setScalar((1 - clamp((t - 10.6) / 2.0) * 0.6) * pop(t, 10.5, 0.25) * c.scaleG.scale.x);
    });
    const chirps = [43.5, 43.67, 43.89, 44.06, 44.23, 44.45, 44.62, 44.79, 45.01, 45.18, 45.35];
    this.babies.forEach((b, k) => {
      const a = (k - 1) * 1.0; const chirp = chirps.reduce((acc, tc, j) => acc + (j % 3 === k ? pulse(t, tc, 0.03, 0.12) : 0), 0);
      const dance = t > DANCE_T0 ? Math.abs(Math.sin(((t - DANCE_T0) / BEAT) * Math.PI + k)) : 0;
      b.setPose({ x: Math.sin(a) * 0.045, y: 0.085 + dance * 0.025 + chirp * 0.01, z: Math.cos(a) * 0.045 - 0.01, yaw: a * 0.4, open: Math.max(clamp(chirp * 1.4), dance * 0.6), roll: dance * 0.25 * (k - 1), pitch: -chirp * 0.2, scale: snap(t, 42.0 + k * 0.08, 0.3) });
    });

    this.cut.update(t, 1.35, -0.26);
    this.world.bushes.forEach((B, k) => {
      const v = [33.0, 33.08].reduce((a, s, j) => a + (j === k ? pulse(t, s, 0.02, 0.5) : 0), 0) + (k === 0 ? pulse(t, 34.2, 0.05, 0.3) * 0.4 : 0);
      B.grp.rotation.z = Math.sin(t * 40) * 0.06 * v; B.grp.scale.set(1 + v * 0.05, 1 - v * 0.04, 1 + v * 0.05);
    });
    const cal = t < 25 ? { t0: 7.05, t1: 8.35, flips: [7.45, 7.75, 8.05], first: 0 } : { t0: 41.3, t1: 42.5, flips: [41.55, 41.85, 42.15], first: 3 };
    this.fx.update(t, { spinSpeed: this.spinSpeed(t), spinAngle: sp.spin, scarecrowPos: V(0, 0, PZ), night, calendar: cal });
    if (this.post) { this.post.bloom.strength = 0.5 + night * 0.35; this.post.grade.uniforms.uVig.value = 0.3 + night * 0.12; }
  }

  cameraAt(t) {
    const MAIN = { pos: [0, 1.38, 5.3], tgt: [0, 0.45, 0], fov: 50 };
    const C = (pos, tgt, fov = 50) => ({ pos, tgt, fov });
    const poke = C([-0.12, 1.15, 4.2], [-0.08, 0.42, 0]), fenceC = C([0.0, 1.34, 3.3], [0.0, 1.05, -2.7]), ride = C([0, 1.46, 4.4], [0, 0.85, 0]);
    const coneC = C([-0.4, 1.28, 4.4], [-0.45, 0.55, 0]), waveC = C([-0.12, 1.5, 3.8], [-0.15, 1.1, 0]), wide = C([0, 3.3, 13.0], [0, 0.62, -2.4]);
    const keys = [
      [0.0, C([0, 1.5, 5.95], [0, 0.45, 0])], [3.9, MAIN],
      [4.4, MAIN], [4.95, fenceC], [5.6, fenceC], [6.5, MAIN],
      [9.05, MAIN], [9.45, poke], [9.95, poke], [10.6, MAIN],
      [16.35, MAIN], [16.95, ride], [18.6, ride], [19.3, MAIN],
      [25.35, MAIN], [25.8, coneC], [26.4, coneC], [27.2, MAIN],
      [29.8, MAIN], [30.3, waveC], [31.0, waveC], [31.6, MAIN],
      [35.4, MAIN], [37.5, C([-0.15, 1.4, 4.8], [-0.12, 0.62, 0])],
      [41.0, wide], [42.4, wide],
      [44.6, C([0.06, 2.1, 2.85], [0.03, 1.58, 0], 46)], [45.55, C([0.04, 2.1, 2.75], [0.03, 1.58, 0], 46)], [46.4, C([0, 1.62, 3.5], [0, 1.25, 0])], [47.35, C([0, 1.62, 3.4], [0, 1.25, 0])],
      [48.25, C([-0.38, 1.25, 4.2], [-0.34, 0.51, 0])], [DURATION, C([-0.38, 1.25, 4.05], [-0.34, 0.51, 0])],
    ];
    let a = keys[0], b = keys[keys.length - 1];
    for (let k = 0; k < keys.length - 1; k++) if (t >= keys[k][0] && t <= keys[k + 1][0]) { a = keys[k]; b = keys[k + 1]; break; }
    const u = easeInOut(seg(t, a[0], b[0]));
    const L = (x, y) => x.map((v, k) => lerp(v, y[k], u));
    const drift = [Math.sin(t * 0.31) * 0.02, Math.sin(t * 0.23 + 1) * 0.012, 0];
    return { pos: L(a[1].pos, b[1].pos).map((v, k) => v + drift[k]), tgt: L(a[1].tgt, b[1].tgt), fov: lerp(a[1].fov, b[1].fov, u) };
  }
}
