import * as THREE from 'three';
import {B, BEAT, SHOTS, shotAt, FLASHES, SWITCH_FLASH, ShotId} from './timeline';
import {clamp, lerp, lerp3, easeInOut, easeOut, easeIn, easeOutBack, smooth, noise1, prog, V3} from './lib/math';
import type {PersonPose} from './three/Person';
import type {SkyLook} from './three/Sky';

/** Pure function: frame -> everything the 3D stage and overlays need. */

export type Env = {
  sky: SkyLook;
  sunDir: THREE.Vector3; // direction towards the sun
  sunColor: string;
  sunInt: number;
  hemiSky: string;
  hemiGround: string;
  hemiInt: number;
  fillColor: string;
  fillInt: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  bloom: number;
  bloomThreshold: number;
  night: number;
  rim: string;
  rimStrength: number;
  vignette: number;
  exposure: number;
};

const sunV = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

const DAY: Env = {
  sky: {top: '#3f86e0', horizon: '#ffd9a6', bottom: '#c9b28f', sunDir: sunV(-0.3, 0.3, 0.9), sunColor: '#ffe7bf', sunSize: 1.4, stars: 0, clouds: 1, cloudTint: '#fff4e6'},
  sunDir: sunV(-0.3, 0.42, 0.86),
  sunColor: '#ffdfae',
  sunInt: 4.6,
  hemiSky: '#cfe0ff',
  hemiGround: '#9a7d5c',
  hemiInt: 1.35,
  fillColor: '#ffe9cf',
  fillInt: 0.9,
  fogColor: '#f3d7b2',
  fogNear: 45,
  fogFar: 260,
  bloom: 0.55,
  bloomThreshold: 0.92,
  night: 0,
  rim: '#ffd59a',
  rimStrength: 0.95,
  vignette: 0.45,
  exposure: 1,
};

const GOLDEN: Env = {
  ...DAY,
  sky: {top: '#3e5f9e', horizon: '#ffb066', bottom: '#b9875a', sunDir: sunV(-0.12, 0.16, 0.98), sunColor: '#ffb35a', sunSize: 2.2, stars: 0, clouds: 1, cloudTint: '#ffc48a'},
  sunDir: sunV(-0.12, 0.2, 0.98),
  sunColor: '#ffb257',
  sunInt: 4.2,
  hemiSky: '#ffcf9e',
  hemiGround: '#7a5134',
  hemiInt: 0.85,
  fillColor: '#ffb98a',
  fillInt: 0.45,
  fogColor: '#f0a96c',
  fogNear: 18,
  fogFar: 110,
  bloom: 1.05,
  bloomThreshold: 0.8,
  rim: '#ffbe5c',
  rimStrength: 1.9,
  vignette: 0.6,
};

const NIGHT: Env = {
  ...DAY,
  sky: {top: '#05041a', horizon: '#2b1850', bottom: '#07060e', sunDir: sunV(0.2, 0.45, -0.85), sunColor: '#6b5cff', sunSize: 0.6, stars: 1, clouds: 0.25, cloudTint: '#2a2148'},
  sunDir: sunV(0.35, 0.6, 0.7),
  sunColor: '#7b74ff',
  sunInt: 0.55,
  hemiSky: '#3b3a7a',
  hemiGround: '#120e1c',
  hemiInt: 0.55,
  fillColor: '#8e7dff',
  fillInt: 0.35,
  fogColor: '#130c28',
  fogNear: 12,
  fogFar: 95,
  bloom: 1.3,
  bloomThreshold: 0.55,
  night: 1,
  rim: '#a98bff',
  rimStrength: 1.3,
  vignette: 0.75,
};

const VIOLET: Env = {
  ...NIGHT,
  sky: {top: '#07021a', horizon: '#4a1a7d', bottom: '#0a0614', sunDir: sunV(0, 0.3, -1), sunColor: '#9b4dff', sunSize: 0.6, stars: 1, clouds: 0.35, cloudTint: '#3a1d63'},
  hemiSky: '#4b2a8a',
  hemiInt: 0.6,
  fogColor: '#1b0d38',
  fogNear: 10,
  fogFar: 80,
  bloom: 1.55,
  bloomThreshold: 0.5,
  rim: '#b77dff',
  rimStrength: 1.6,
};

const mixEnv = (a: Env, b: Env, t: number): Env => {
  const c = (x: string, y: string) => '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
  return {
    sky: {
      top: c(a.sky.top, b.sky.top),
      horizon: c(a.sky.horizon, b.sky.horizon),
      bottom: c(a.sky.bottom, b.sky.bottom),
      sunDir: a.sky.sunDir.clone().lerp(b.sky.sunDir, t).normalize(),
      sunColor: c(a.sky.sunColor, b.sky.sunColor),
      sunSize: lerp(a.sky.sunSize, b.sky.sunSize, t),
      stars: lerp(a.sky.stars, b.sky.stars, t),
      clouds: lerp(a.sky.clouds, b.sky.clouds, t),
      cloudTint: c(a.sky.cloudTint, b.sky.cloudTint),
    },
    sunDir: a.sunDir.clone().lerp(b.sunDir, t).normalize(),
    sunColor: c(a.sunColor, b.sunColor),
    sunInt: lerp(a.sunInt, b.sunInt, t),
    hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround),
    hemiInt: lerp(a.hemiInt, b.hemiInt, t),
    fillColor: c(a.fillColor, b.fillColor),
    fillInt: lerp(a.fillInt, b.fillInt, t),
    fogColor: c(a.fogColor, b.fogColor),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    bloom: lerp(a.bloom, b.bloom, t),
    bloomThreshold: lerp(a.bloomThreshold, b.bloomThreshold, t),
    night: lerp(a.night, b.night, t),
    rim: c(a.rim, b.rim),
    rimStrength: lerp(a.rimStrength, b.rimStrength, t),
    vignette: lerp(a.vignette, b.vignette, t),
    exposure: lerp(a.exposure, b.exposure, t),
  };
};

export type Cam = {pos: V3; target: V3; fov: number; roll?: number};
export type Actor<P = {}> = {pos: V3; rotY: number} & P;

export type State = {
  id: ShotId;
  f: number;
  local: number;
  len: number;
  set: 'town' | 'studio' | 'space';
  env: Env;
  cam: Cam;
  dof: {target: V3; range: number; bokeh: number};
  chroma: number;
  hero?: Actor<{pose: PersonPose; rim?: string; rimStrength?: number; catchPose?: number; clip?: {clip: string; time: number}; bones?: Record<string, [number, number, number]>}>;
  heroShadow?: Actor<{pose: PersonPose; scale: number; eyes: number}>;
  dog?: Actor<{phase: number; trot: number; sunglasses: boolean; headYaw: number}>;
  bully?: Actor<{pose: PersonPose; roll: number; pedal: number}>;
  cap?: {pos: V3; rot: V3};
  npcs: Actor<{look: string; pose: PersonPose}>[];
  bus?: Actor<{door: number; roll: number}>;
  ball?: {pos: V3; spin: number};
  ballInHand?: boolean;
  loki?: Actor<{fire: number; armsUp: number; headPitch: number; eyeGlow: number; scale: number}>;
  fox?: Actor<{scale: number}>;
  crow?: Actor<{scale: number}>;
  snapHand?: {pos: V3; rot: V3; snap: number};
  bursts: {center: V3; start: number; color: string; color2: string; radius: number}[];
  cracks?: {center: V3; grow: number};
  debris?: {center: V3; lift: number};
  leaves?: {center: V3};
  dust?: {center: V3; color: string; opacity: number; speed: number};
  embers?: {center: V3; color: string; color2: string; radius: number; height: number};
  sign: {flip: number; glow: number};
  bell: {swing: number; ring: number};
  planetBeam?: number;
  heroGlow?: number;
  timeScale: number;
};

// ---------- helpers ----------
const STEP = Math.PI / BEAT; // walk phase per frame: one step per beat
const SPEED = 0.0376; // metres per frame

const walk = (local: number, z0: number, x = 5.2, k = 1): {pos: V3; ph: number} => ({
  pos: [x, 0.16, z0 - local * SPEED * k],
  ph: local * STEP * k,
});

const shakeAt = (f: number) => {
  let amp = 0;
  for (const e of FLASHES) if (f >= e) amp += 0.32 * Math.exp(-(f - e) / 7);
  if (f >= SWITCH_FLASH) amp += 0.25 * Math.exp(-(f - SWITCH_FLASH) / 5);
  const catchF = B[30];
  if (f >= catchF) amp += 0.05 * Math.exp(-(f - catchF) / 4);
  const snapF = B[79];
  if (f >= snapF) amp += 0.12 * Math.exp(-(f - snapF) / 5);
  const flipF = B[81];
  if (f >= flipF) amp += 0.1 * Math.exp(-(f - flipF) / 6);
  if (f >= B[62] && f < B[67]) amp += 0.035;
  return amp;
};

const applyShake = (cam: Cam, f: number): Cam => {
  const a = shakeAt(f);
  if (a < 0.001) return cam;
  const n = (s: number) => noise1(f * 0.9, s);
  return {
    ...cam,
    pos: [cam.pos[0] + n(1) * a, cam.pos[1] + n(2) * a, cam.pos[2] + n(3) * a * 0.5],
    target: [cam.target[0] + n(4) * a * 0.6, cam.target[1] + n(5) * a * 0.6, cam.target[2]],
    roll: (cam.roll ?? 0) + n(6) * a * 0.15,
  };
};

const base = (id: ShotId, f: number, local: number, len: number): State => ({
  id,
  f,
  local,
  len,
  set: 'town',
  env: DAY,
  cam: {pos: [0, 2, 10], target: [0, 1, 0], fov: 40},
  dof: {target: [0, 1, 0], range: 6, bokeh: 2},
  chroma: 0,
  npcs: [],
  bursts: [],
  sign: {flip: 0, glow: 0},
  bell: {swing: 0, ring: 0},
  timeScale: 1,
});

const heroLook = (pos: V3, dy = 1.35): V3 => [pos[0], pos[1] + dy, pos[2]];

// ---------- shots ----------
type Builder = (s: State) => State;

const SHOT_FNS: Record<ShotId, Builder> = {
  title: (s) => {
    const {local: l, len} = s;
    const w = walk(l, 31);
    const p = easeInOut(l / len);
    s.hero = {pos: w.pos, rotY: Math.PI, pose: {walkPhase: w.ph, walk: 0.8, lid: 0.55, headPitch: 0.12, time: s.f}};
    s.dog = undefined;
    s.npcs = [
      {look: 'npc2', pos: [-5.4, 0.16, 40 - l * SPEED], rotY: Math.PI, pose: {walkPhase: l * STEP + 1, walk: 1, time: s.f}},
      {look: 'npc3', pos: [-5.8, 0.16, 18 + l * SPEED], rotY: 0, pose: {walkPhase: l * STEP + 2, walk: 1, time: s.f}},
    ];
    s.cam = {pos: lerp3([3.0, 2.6, 23.0], [3.4, 1.6, 24.6], p), target: lerp3([4.6, 3.6, 32], [4.8, 3.0, 32], p), fov: 50};
    s.dof = {target: heroLook(w.pos, 1), range: 8, bokeh: 1.4};
    s.dust = {center: [4, 0.2, 26], color: '#ffe3b0', opacity: 0.7, speed: 1};
    return s;
  },
  m0a: (s) => {
    const {local: l, len} = s;
    const w = walk(l, 24, 5.2, 0.85);
    const yawn = smooth(prog(l, 14, 26)) * (1 - smooth(prog(l, 38, 50)));
    s.hero = {
      pos: w.pos,
      rotY: Math.PI,
      pose: {walkPhase: w.ph, walk: 0.85, lid: 0.62 - yawn * 0.3, yawn, headPitch: 0.16 - yawn * 0.35, smile: -0.3, brow: -0.2, time: s.f, bounce: 0.7},
    };
    const p = easeInOut(l / len);
    const hz = w.pos[2];
    s.cam = {pos: [lerp(4.75, 4.9, p), lerp(0.55, 0.62, p), hz - lerp(3.4, 3.0, p)], target: [5.5, 0.98, hz], fov: 42, roll: -0.03};
    s.dof = {target: heroLook(w.pos, 1.2), range: 2.5, bokeh: 3.2};
    s.dust = {center: [5, 0.2, hz], color: '#ffe3b0', opacity: 0.7, speed: 1};
    s.npcs = [{look: 'npc3', pos: [-5.6, 0.16, hz + 9 + l * SPEED], rotY: 0, pose: {walkPhase: l * STEP, walk: 1, time: s.f}}];
    return s;
  },
  m0b: (s) => {
    const {local: l, len} = s;
    const w = walk(l, 21.6, 5.2, 0.6);
    // yawn on beat 8, look at the watch on beat 9-10
    const yawn = smooth(prog(l, 0, 6)) * (1 - smooth(prog(l, 14, 22)));
    const watch = smooth(prog(l, 16, 24)) * (1 - smooth(prog(l, 44, 54)));
    const shock = smooth(prog(l, 22, 28));
    s.hero = {
      pos: w.pos,
      rotY: Math.PI,
      pose: {
        walkPhase: w.ph,
        walk: 0.6 * (1 - watch * 0.6),
        lid: lerp(0.6 - yawn * 0.35, 0.0, shock),
        yawn: Math.max(yawn, shock * 0.45),
        headPitch: 0.1 - yawn * 0.35 + watch * 0.32,
        brow: lerp(-0.2, 1, shock),
        armL: [lerp(0.1, -1.35, watch), lerp(-0.08, 0.35, watch), lerp(-0.3, -1.6, watch)],
        time: s.f,
        bounce: 0.6,
      },
    };
    const p = easeInOut(l / len);
    const hz = w.pos[2];
    s.cam = {pos: [lerp(4.7, 4.8, p), lerp(1.05, 1.1, p), hz - lerp(2.6, 2.3, p)], target: [5.4, 1.05, hz], fov: 40, roll: 0.02};
    s.dof = {target: heroLook(w.pos, 1.4), range: 1.4, bokeh: 4};
    s.dust = {center: [5, 0.6, hz], color: '#ffe3b0', opacity: 0.8, speed: 1};
    return s;
  },
  m1a: (s) => {
    const {local: l, len} = s;
    const w = walk(l, 14);
    const hz = w.pos[2];
    s.hero = {pos: w.pos, rotY: Math.PI, pose: {walkPhase: w.ph, walk: 1, lid: 0.15, wind: 1, time: s.f * 1.4, smile: 0.25, headPitch: -0.05, brow: 0.2}};
    s.leaves = {center: [w.pos[0], 0.16, hz]};
    s.npcs = [{look: 'npc0', pos: [6.25, 0.16, hz - 3.2 + l * SPEED * 2.1], rotY: 0, pose: {walkPhase: l * STEP + 1.5, walk: 1, time: s.f, headYaw: smooth(prog(l, 18, 30)) * 0.9}}];
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(4.35, 4.2, p), lerp(0.45, 0.5, p), hz - lerp(3.6, 3.2, p)], target: [5.55, 1.0, hz], fov: 46, roll: -0.04};
    s.dof = {target: heroLook(w.pos, 1.2), range: 3, bokeh: 2.6};
    s.dust = {center: [5, 0.2, hz], color: '#ffe3b0', opacity: 0.6, speed: 1};
    return s;
  },
  m1b: (s) => {
    const {local: l, len} = s;
    const w = walk(l, 11.8);
    const hz = w.pos[2];
    s.hero = {pos: w.pos, rotY: Math.PI, pose: {walkPhase: w.ph, walk: 1, wind: 1, time: s.f * 1.4, smile: 0.3}};
    s.leaves = {center: [w.pos[0], 0.16, hz]};
    const catchUp = easeOut(l / len);
    s.dog = {pos: [5.85, 0.16, hz + lerp(2.6, 0.7, catchUp)], rotY: Math.PI + 0.08, phase: l * 0.42, trot: 1, sunglasses: false, headYaw: Math.sin(l * 0.1) * 0.15};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(3.55, 3.7, p), 0.55, hz - lerp(2.7, 2.4, p)], target: [5.8, 0.55, hz + 1.0], fov: 44, roll: 0.03};
    s.dof = {target: [5.85, 0.6, hz + lerp(2.6, 0.7, catchUp)], range: 2.5, bokeh: 2.6};
    s.dust = {center: [5, 0.2, hz], color: '#ffe3b0', opacity: 0.6, speed: 1};
    return s;
  },
  m2a: (s) => {
    const {local: l} = s;
    const w = walk(l, 5.5);
    const hz = w.pos[2];
    s.hero = {pos: w.pos, rotY: Math.PI, pose: {walkPhase: w.ph, walk: 1, time: s.f, smile: 0.35, brow: 0.1}};
    s.dog = {pos: [5.9, 0.16, hz + 0.75], rotY: Math.PI, phase: l * 0.42, trot: 1, sunglasses: false, headYaw: 0};
    const bz = 5.5 - 4.0 + l * 0.077;
    const gust = B[22] - B[20] + 4;
    const looked = smooth(prog(l, gust + 6, gust + 18));
    s.bully = {
      pos: [2.4, 0.0, bz],
      rotY: 0,
      roll: l * 0.26,
      pedal: l * 0.32,
      pose: {seated: 1, pedal: l * 0.32, capOn: l < gust, headYaw: looked * 1.5, brow: lerp(-0.6, 1, looked), yawn: looked * 0.5, armL: [-1.1, -0.25, -0.35], armR: [-1.1, 0.25, -0.35], lean: 0.25, time: s.f},
    };
    if (l >= gust) {
      const k = l - gust;
      s.cap = {
        pos: [2.4 + k * 0.03, 1.95 + k * 0.075 - k * k * 0.0016, bz - 0.15 * (k > 0 ? 1 : 0) - k * 0.15 + (0.15 * k) * 0.0],
        rot: [k * 0.35, k * 0.21, k * 0.12],
      };
      s.cap.pos[2] = bz - k * 0.17 - 0.0;
    }
    s.leaves = {center: [2.6, 0.0, bz + 0.2]};
    const p = easeInOut(l / s.len);
    s.cam = {pos: [lerp(4.2, 4.0, p), lerp(1.0, 1.1, p), hz - 6.6], target: [3.55, 1.2, hz + 0.5], fov: 48, roll: 0.02};
    s.dof = {target: [4.3, 1.3, hz], range: 6, bokeh: 1.6};
    s.dust = {center: [4, 0.2, hz], color: '#ffe3b0', opacity: 0.5, speed: 1};
    return s;
  },
  m2b: (s) => {
    const {local: l} = s;
    const bz = 5.5 - 4.0 + (B[24] - B[20] + l) * 0.077;
    s.bully = {
      pos: [2.4, 0, bz],
      rotY: 0,
      roll: (l + 59) * 0.26,
      pedal: (l + 59) * 0.32,
      pose: {seated: 1, pedal: (l + 59) * 0.32, capOn: false, headYaw: 1.75 + Math.sin(l * 0.2) * 0.05, headPitch: -0.05, brow: 1, yawn: 0.55 + Math.sin(l * 0.5) * 0.15, armL: [-1.1, -0.25, -0.35], armR: [-1.1, 0.25, -0.35], lean: 0.2, time: s.f},
    };
    const hz = 5.5 - (B[24] - B[20] + l) * SPEED;
    s.hero = {pos: [5.2, 0.16, hz], rotY: Math.PI, pose: {walkPhase: (B[24] - B[20] + l) * STEP, walk: 1, time: s.f}};
    s.dog = {pos: [5.9, 0.16, hz + 0.75], rotY: Math.PI, phase: l * 0.42, trot: 1, sunglasses: false, headYaw: 0};
    s.cam = {pos: [3.75, 1.75, bz - 0.6], target: [2.65, 1.45, bz + 0.1], fov: 44, roll: -0.05};
    s.dof = {target: [2.4, 1.75, bz], range: 1.4, bokeh: 3};
    s.dust = {center: [2.4, 0.4, bz], color: '#ffe3b0', opacity: 0.5, speed: 1};
    return s;
  },
  m3a: (s) => {
    const {local: l, len} = s;
    const w = walk(l, -8);
    const hz = w.pos[2];
    const catchL = B[30] - B[28];
    const raise = smooth(prog(l, catchL - 9, catchL - 1));
    const hold = l >= catchL;
    s.hero = {
      pos: w.pos,
      rotY: Math.PI,
      pose: {walkPhase: w.ph, walk: 1, time: s.f, smile: 0.6, brow: 0.35, headYaw: 0, armR: [lerp(-0.2, -2.75, raise), lerp(0.08, 0.5, raise), lerp(-0.3, -1.1, raise)]},
      rim: '#ffe0a8',
      rimStrength: 1.4,
      catchPose: raise,
    };
    s.ballInHand = hold;
    if (!hold) {
      const bp = prog(l, 6, catchL);
      const handW: V3 = [5.2 - 0.42, 1.85, hz - 0.12];
      const start: V3 = [-1.5, 1.4, hz - 3.5];
      const p = lerp3(start, handW, bp);
      p[1] += Math.sin(bp * Math.PI) * 0.8;
      if (l >= 6) s.ball = {pos: p, spin: l * 0.4};
    }
    s.npcs = [
      {look: 'npc1', pos: [6.7, 0.16, hz + 3.2], rotY: Math.PI + 0.9, pose: {time: s.f, yawn: hold ? 0.6 : 0, brow: hold ? 1 : 0, armL: [-0.2, -0.1, -0.4]}},
      {look: 'npc2', pos: [-5.0, 0.16, hz + 7.5], rotY: 1.9, pose: {time: s.f, yawn: hold ? 0.5 : 0, brow: hold ? 1 : 0}},
    ];
    s.dog = {pos: [5.95, 0.16, hz + 0.8], rotY: Math.PI, phase: l * 0.42, trot: 1, sunglasses: true, headYaw: 0};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(4.55, 4.7, p), lerp(0.85, 0.95, p), hz - lerp(3.6, 3.1, p)], target: [5.45, 1.12, hz], fov: 42};
    s.dof = {target: heroLook(w.pos, 1.4), range: 2.2, bokeh: 3};
    s.dust = {center: [5, 0.2, hz], color: '#ffe3b0', opacity: 0.7, speed: 1};
    return s;
  },
  m3b: (s) => {
    const {local: l, len} = s;
    const hz = -8 - (B[32] - B[28] + l) * SPEED;
    s.hero = {pos: [5.2, 0.16, hz], rotY: Math.PI, pose: {walkPhase: (B[32] - B[28] + l) * STEP, walk: 1, time: s.f, armR: [-0.6, 0.15, -1.2]}, rim: '#ffe0a8', rimStrength: 1.4};
    s.ballInHand = true;
    s.dog = {pos: [5.95, 0.16, hz + 0.55], rotY: Math.PI, phase: l * 0.42, trot: 1, sunglasses: true, headYaw: Math.sin(l * 0.12) * 0.1};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(6.05, 6.15, p), 0.5, hz - lerp(0.75, 0.55, p)], target: [5.9, 0.62, hz + 0.6], fov: 44, roll: 0.05};
    s.dof = {target: [5.95, 0.64, hz + 0.85], range: 0.9, bokeh: 3.4};
    s.dust = {center: [5.5, 0.1, hz], color: '#ffe3b0', opacity: 0.8, speed: 1};
    return s;
  },
  m4a: (s) => {
    const {local: l, len} = s;
    s.env = GOLDEN;
    s.timeScale = 0.35;
    const w = walk(l, -28, 5.2, 0.35);
    const hz = w.pos[2];
    s.hero = {pos: w.pos, rotY: Math.PI, pose: {walkPhase: w.ph, walk: 1, time: s.f * 0.35, smile: 0.5, brow: 0.2, headPitch: -0.06, wind: 0.5}};
    s.dog = {pos: [5.95, 0.16, hz + 0.9], rotY: Math.PI, phase: l * 0.42 * 0.35, trot: 1, sunglasses: true, headYaw: 0};
    const p = easeInOut(l / len);
    s.cam = {pos: [5.2 + lerp(-0.3, 0.05, p), lerp(0.55, 0.7, p), hz - lerp(6.2, 5.2, p)], target: [5.2, 1.35, hz], fov: 36, roll: lerp(-0.04, 0.0, p)};
    s.dof = {target: heroLook(w.pos, 1.2), range: 2.2, bokeh: 3.4};
    s.dust = {center: [5, 0.2, hz], color: '#ffd08a', opacity: 1, speed: 0.35};
    s.heroGlow = 0.6;
    return s;
  },
  m4b: (s) => {
    const {local: l, len} = s;
    s.env = GOLDEN;
    s.timeScale = 0.5;
    const hz = -36.2;
    const look = smooth(prog(l, 20, 34));
    s.hero = {pos: [4.55, 0.16, hz], rotY: Math.PI - look * 1.1, pose: {time: s.f * 0.5, smile: 0.5, headYaw: look * 0.4, brow: 0.3}};
    s.dog = {pos: [5.3, 0.16, hz + 0.6], rotY: Math.PI - 0.6, phase: 0, trot: 0, sunglasses: true, headYaw: 0.4};
    // bus decelerates to a stop with its door at the hero (on beat 42)
    const stopL = B[42] - B[40];
    const k = clamp(l / stopL);
    const dist = 16 * (1 - easeOut(k));
    const busZ = hz - 3.15 + dist; // door is 3.15m forward of bus centre
    s.bus = {pos: [2.25, 0, busZ], rotY: Math.PI, door: smooth(prog(l, stopL + 4, stopL + 16)), roll: -dist * 1.8};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(6.3, 6.5, p), lerp(1.25, 1.4, p), hz + lerp(4.6, 5.3, p)], target: [3.9, 1.5, hz - 1.6], fov: 46, roll: 0.02};
    s.dof = {target: heroLook([4.55, 0.16, hz], 1.3), range: 5, bokeh: 1.6};
    s.dust = {center: [4, 0.2, hz], color: '#ffd08a', opacity: 1, speed: 0.5};
    s.heroGlow = 0.6;
    return s;
  },
  m5a: (s) => {
    const {local: l, len} = s;
    s.set = 'studio';
    s.env = {...DAY, bloom: 0.8, bloomThreshold: 0.8, vignette: 0.35, fogNear: 30, fogFar: 200, fogColor: '#0d1a3a', hemiSky: '#bcd0ff', hemiGround: '#20283a', hemiInt: 0.8, sunInt: 1.8, sunDir: sunV(0.3, 0.8, 1), rim: '#8fb8ff', rimStrength: 1.0};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.25, 0.0, p), 1.62, lerp(2.4, 2.0, p)], target: [0, 1.38, -0.45], fov: 40};
    s.dof = {target: [0, 1.5, -0.45], range: 2.2, bokeh: 2};
    return s;
  },
  m5b: (s) => {
    const {local: l, len} = s;
    s.set = 'space';
    s.env = {...NIGHT, fogNear: 500, fogFar: 1000, bloom: 1.6, bloomThreshold: 0.5, sunInt: 2.2, sunDir: sunV(-1, 0.4, 0.2), sunColor: '#bcd4ff', hemiInt: 0.15, vignette: 0.7};
    s.planetBeam = easeOut(prog(l, 0, 14));
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(30, 26, p), lerp(-2, 2, p), lerp(78, 70, p)], target: [lerp(22, 22.5, p), lerp(20, 24, p), 26], fov: 56, roll: lerp(0.05, 0.02, p)};
    s.dof = {target: [10, 0, 18], range: 200, bokeh: 0};
    return s;
  },
  m6a: (s) => {
    const {local: l, len} = s;
    const dark = easeInOut(prog(l, 2, len - 4));
    s.env = mixEnv(mixEnv(GOLDEN, DAY, 0.3), NIGHT, dark);
    s.env.sunInt = lerp(3.5, 0.5, dark);
    const w = walk(l, -78, 0.5, 0.9);
    s.hero = {pos: [0.5, 0, w.pos[2]], rotY: Math.PI, pose: {walkPhase: w.ph, walk: 1, time: s.f}};
    s.dog = {pos: [1.2, 0, w.pos[2] + 0.8], rotY: Math.PI, phase: l * 0.42, trot: 1, sunglasses: true, headYaw: 0};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(2.4, 1.9, p), lerp(1.3, 1.9, p), w.pos[2] + lerp(6.8, 6.0, p)], target: [0.4, lerp(4.8, 6.2, p), -96], fov: 52};
    s.dof = {target: [0.5, 1.3, w.pos[2]], range: 30, bokeh: 1};
    return s;
  },
  m6b: (s) => {
    const {local: l, len} = s;
    s.env = NIGHT;
    const pos: V3 = [0.3, 0, -84.4];
    s.hero = {pos, rotY: Math.PI, pose: {time: s.f, headPitch: -0.15, armL: [0.05, -0.18, -0.2], armR: [0.05, 0.18, -0.2]}, rim: '#c4a6ff', rimStrength: 1.6};
    const grow = easeOut(prog(l, 0, 30));
    s.heroShadow = {
      pos: [0.3, 0, -99.2],
      rotY: Math.PI,
      scale: lerp(4, 11, grow),
      eyes: smooth(prog(l, 18, 30)),
      pose: {time: s.f, headPitch: -0.15, armL: [0.05, -0.35, -0.2], armR: [0.05, 0.35, -0.2]},
    };
    s.dog = {pos: [1.0, 0, -83.6], rotY: Math.PI - 0.3, phase: 0, trot: 0, sunglasses: true, headYaw: 0.3};
    const ringL = l - 3;
    s.bell = {swing: ringL > 0 ? Math.sin(ringL * 0.32) * 0.55 * Math.exp(-ringL / 60) + 0.0 : 0, ring: ringL > 0 ? (ringL / 18) % 1 : 0};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(1.2, 1.6, p), lerp(0.5, 0.75, p), lerp(-78.6, -79.4, p)], target: [0.2, lerp(7.5, 9.5, p), -100], fov: 58, roll: -0.04};
    s.dof = {target: [0.2, 6, -100], range: 30, bokeh: 1};
    return s;
  },
  m7a: (s) => {
    const {local: l, len} = s;
    s.env = mixEnv(NIGHT, VIOLET, 0.4);
    const pos: V3 = [0.3, 0, -84.2];
    const k = easeOut(l / len);
    s.hero = {
      pos,
      rotY: 0,
      pose: {time: s.f, lean: 0.25 * k, headPitch: 0.35 * k, brow: -0.8, yawn: 0.2, armL: [-0.15, -0.35 * k, -0.6], armR: [-0.15, 0.35 * k, -0.6], legL: [-0.35 * k, 0.6 * k], legR: [-0.1 * k, 0.4 * k], crack: 0.25 * k, eyeGlow: 0},
      rim: '#b77dff',
      rimStrength: 1.6,
    };
    s.cracks = {center: [0.3, 0.01, -84.2], grow: easeOut(prog(l, 0, len)) * 0.7};
    s.debris = {center: [0.3, 0, -84.2], lift: easeOut(l / len) * 0.4};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 3, height: 4};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(1.4, 1.15, p), lerp(0.45, 0.55, p), lerp(-78.7, -79.6, p)], target: [0.3, 1.0, -84.2], fov: 50, roll: 0.04};
    s.dof = {target: [0.3, 1.0, -84.2], range: 4, bokeh: 2};
    s.heroGlow = 1;
    return s;
  },
  m7b: (s) => {
    const {local: l, len} = s;
    s.env = mixEnv(NIGHT, VIOLET, 0.7);
    const pos: V3 = [0.3, 0, -84.2];
    const k = easeIn(l / len);
    const jitter = noise1(s.f * 1.3, 4) * 0.06;
    s.hero = {
      pos,
      rotY: 0,
      pose: {
        time: s.f,
        lean: 0.18,
        headPitch: -0.05 + Math.sin(l * 0.15) * 0.06,
        headRoll: jitter + 0.08,
        brow: -1,
        yawn: 0.55 + Math.sin(l * 0.4) * 0.15,
        lid: 0.25,
        armL: [-0.6, -0.5, -1.6],
        armR: [-0.6, 0.5, -1.6],
        crack: lerp(0.35, 1, k),
        eyeGlow: k,
      },
      rim: '#b77dff',
      rimStrength: 2.0,
    };
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 0.7 + 0.3 * k};
    s.debris = {center: [0.3, 0, -84.2], lift: 0.4 + 0.6 * k};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 2, height: 3.5};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.62, 0.5, p), lerp(1.3, 1.34, p), lerp(-82.2, -82.6, p)], target: [0.3, 1.28, -84.2], fov: lerp(44, 38, p), roll: lerp(0.03, -0.05, p)};
    s.dof = {target: [0.3, 1.5, -84.05], range: 0.9, bokeh: 4};
    s.chroma = 0.002 + k * 0.006;
    s.heroGlow = 1;
    return s;
  },
  m7c: (s) => {
    s = SHOT_FNS.m7b({...s, local: s.local + (B[67] - B[62]), len: B[67] - B[62] + 1});
    s.id = 'm7c';
    if (s.hero) {
      s.hero.pose.crack = 1;
      s.hero.pose.eyeGlow = 1.5;
    }
    s.chroma = 0.012;
    return s;
  },
  m8a: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const pos: V3 = [0.3, 0, -84.4];
    const k = easeOut(l / len);
    s.loki = {pos, rotY: 0, fire: smooth(prog(l, 4, 20)), armsUp: lerp(0.15, 0.9, easeOutBack(prog(l, 4, 30))), headPitch: lerp(0.25, -0.05, k), eyeGlow: smooth(prog(l, 0, 12)), scale: 1};
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 1};
    s.debris = {center: [0.3, 0, -84.2], lift: 1};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 4, height: 6};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.85, 0.55, p), lerp(0.4, 0.55, p), lerp(-79.2, -80.2, p)], target: [0.3, lerp(1.55, 1.8, p), -84.6], fov: 48, roll: lerp(-0.05, 0.0, p)};
    s.dof = {target: [0.3, 1.8, -84.4], range: 6, bokeh: 1.8};
    s.chroma = 0.0025;
    return s;
  },
  m8b: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const pop = easeOutBack(prog(l, 0, 9));
    s.fox = {pos: [0.3, 0, -84.3], rotY: -0.2, scale: pop * 1.25};
    s.bursts = [{center: [0.3, 0.6, -84.3], start: s.f - l, color: '#e9d5ff', color2: '#6d28d9', radius: 1.6}];
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 1};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 3, height: 4};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.8, 0.65, p), 0.55, lerp(-82.0, -82.4, p)], target: [0.3, 0.42, -84.3], fov: 44, roll: 0.05};
    s.dof = {target: [0.3, 0.6, -84.0], range: 1.4, bokeh: 3};
    s.chroma = 0.003;
    return s;
  },
  m8c: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const pop = easeOutBack(prog(l, 0, 9));
    s.crow = {pos: [0.3, 1.55 + Math.sin(l * 0.4) * 0.08, -84.3], rotY: 0.15, scale: pop * 1.5};
    s.bursts = [{center: [0.3, 1.4, -84.3], start: s.f - l, color: '#e9d5ff', color2: '#6d28d9', radius: 1.6}];
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 1};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 3, height: 4};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(-0.1, 0.05, p), lerp(1.4, 1.45, p), lerp(-82.4, -82.7, p)], target: [0.3, 1.45, -84.3], fov: 44, roll: -0.06};
    s.dof = {target: [0.3, 1.6, -84.1], range: 1.5, bokeh: 3};
    s.chroma = 0.003;
    return s;
  },
  m8d: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const pop = easeOutBack(prog(l, 0, 8));
    s.loki = {pos: [0.3, 0, -84.4], rotY: 0, fire: 1, armsUp: 0.5, headPitch: -0.02, eyeGlow: 1 + smooth(prog(l, 8, 16)) * 0.8, scale: lerp(0.85, 1, pop)};
    s.bursts = [{center: [0.3, 1.8, -84.3], start: s.f - l, color: '#e9d5ff', color2: '#6d28d9', radius: 1.8}];
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 3, height: 4};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.55, 0.45, p), lerp(1.85, 1.9, p), lerp(-82.2, -82.5, p)], target: [0.3, 1.82, -84.3], fov: 38, roll: 0.02};
    s.dof = {target: [0.3, 1.98, -84.2], range: 0.8, bokeh: 3.5};
    s.chroma = 0.003;
    return s;
  },
  m8e: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const snapL = B[79] - B[78];
    const snap = smooth(prog(l, snapL - 2, snapL + 1));
    s.loki = {pos: [0.3, 0, -84.4], rotY: 0, fire: 0.6, armsUp: 0.3, headPitch: 0, eyeGlow: 1.6, scale: 1};
    s.snapHand = {pos: [0.55, 1.72, -83.6], rot: [0.1, -0.5, -0.15], snap};
    if (l >= snapL) s.bursts = [{center: [0.52, 2.02, -83.55], start: s.f - (l - snapL), color: '#ffffff', color2: '#a855f7', radius: 0.9}];
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(1.0, 0.92, p), lerp(1.9, 1.92, p), lerp(-82.2, -82.4, p)], target: [0.4, 1.86, -84.0], fov: 42, roll: -0.05};
    s.dof = {target: [0.55, 1.85, -83.6], range: 0.9, bokeh: 2.5};
    s.chroma = 0.003;
    return s;
  },
  m8f: (s) => {
    const {local: l, len} = s;
    s.env = VIOLET;
    const flipL = B[81] - B[80];
    const flip = easeOutBack(prog(l, flipL, flipL + 12));
    s.sign = {flip, glow: smooth(prog(l, flipL + 4, flipL + 14)) * 2.2};
    s.loki = {pos: [0.3, 0, -84.4], rotY: 0, fire: 1, armsUp: 0.75, headPitch: -0.1, eyeGlow: 1.4, scale: 1};
    if (l >= flipL) s.bursts = [{center: [0, 5.9, -89.4], start: s.f - (l - flipL), color: '#ffffff', color2: '#a855f7', radius: 3.5}];
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 1};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 4, height: 6};
    const pull = easeInOut(prog(l, flipL + 10, len));
    s.cam = {pos: lerp3([0.0, 4.3, -80.8], [1.25, 1.1, -76.0], pull), target: lerp3([0, 5.8, -89.6], [0.2, 3.4, -88], pull), fov: lerp(48, 50, pull), roll: lerp(0.0, -0.03, pull)};
    s.dof = {target: lerp3([0, 5.9, -89.6], [0.3, 2.0, -84.4], pull), range: lerp(3, 8, pull), bokeh: 2};
    s.chroma = 0.002;
    return s;
  },
  end: (s) => {
    const {local: l, len} = s;
    s.env = {...VIOLET, vignette: 0.9};
    s.sign = {flip: 1, glow: 2.2};
    s.loki = {pos: [0.3, 0, -84.4], rotY: Math.PI, fire: 0.9, armsUp: 0.55, headPitch: -0.15, eyeGlow: 1.2, scale: 1};
    s.cracks = {center: [0.3, 0.01, -84.2], grow: 1};
    s.embers = {center: [0.3, 0, -84.2], color: '#e8d4ff', color2: '#7c3aed', radius: 5, height: 8};
    const p = easeInOut(l / len);
    s.cam = {pos: [lerp(0.9, 0.6, p), lerp(1.4, 1.9, p), lerp(-79.0, -77.4, p)], target: [0.2, lerp(3.8, 4.4, p), -89], fov: 46};
    s.dof = {target: [0, 5.9, -89.6], range: 10, bokeh: 1.2};
    return s;
  },
};

export const stateAt = (f: number): State => {
  const shot = shotAt(f);
  const local = f - shot.from;
  let s = base(shot.id, f, local, shot.to - shot.from);
  s = SHOT_FNS[shot.id](s);
  s.cam = applyShake(s.cam, f);
  return s;
};

export const shotIds = SHOTS.map((s) => s.id);
