// The whole reel as a pure function of time: applyTimeline(t, S) poses both characters, the blanket, door, lights
// and camera for second `t`. Every cut sits on a voiceover word onset (faster-whisper timestamps, assets/words.json).
import * as THREE from 'three';
import { P, mixPose, tweak, seqPose, seqNum, ramp, rotQ, noise, clamp01, ease } from './rig.js';
import { BED, ROOM, HWIN } from './scene.js';
import { bumpsFor } from './blanket.js';

export const DURATION = 21.0;
// cut times (s)            1     2     3     4     5a    5b    6a    6b    7     8      9a     9b     10     11     12
export const CUTS = [0.0, 0.86, 2.30, 3.62, 5.45, 6.55, 7.82, 8.50, 9.45, 11.50, 13.50, 14.50, 15.70, 16.95, 18.60, DURATION];
export const SHOT_NAMES = ['1 see a ghost', '2 trying to sleep', '3 what should you do', '4 blanket over head', '5a float closer', '5b rip it off', '6a run', '6b lock door', '7 window', '8 instead of scared', '9a scoot over', '9b invite him', '10 climb in', '11 tuck blanket', '12 cuddling'];
// one representative frame per storyboard shot (for the contact sheet)
export const SHEET_TIMES = [0.45, 1.7, 3.0, 4.9, 7.45, 9.0, 10.95, 12.6, 14.25, 16.3, 17.9, 19.9];

const MT = BED.top, SIT = MT + 0.12, HIP = 0.567, TAU = Math.PI * 2;
const osc = (t, hz, ph = 0) => Math.sin(t * TAU * hz + ph);

// ---------- poses ----------
const sitLegs = { LLeg: [86, 7, 0], RLeg: [86, 7, 0], LKnee: 4, RKnee: 4 };
const M = {
  sitIdle: P({ ...sitLegs, Spine: [-6, 0, 0], LArm: [28, 68, 0], RArm: [28, 68, 0], LElbow: 40, RElbow: 40 }),
  sitScared: P({ ...sitLegs, Spine: [-12, 0, 0], Spine2: [-6, 0, 0], Head: [-8, 0, 0], LArm: [58, 46, 0], RArm: [58, 46, 0], LElbow: 120, RElbow: 120, LFist: 0, RFist: 0, LShoulder: [0, 0, 12], RShoulder: [0, 0, -12] }),
  sitShrug: P({ ...sitLegs, Spine: [-4, 0, 0], Head: [2, -4, 14], LArm: [22, 52, 0], RArm: [22, 52, 0], LElbow: [100, -70], RElbow: [100, 70], LFist: 0, RFist: 0, LShoulder: [0, 0, 16], RShoulder: [0, 0, -16] }),
  pullUp: P({ ...sitLegs, Spine: [-18, 0, 0], Head: [-10, 0, 0], LArm: [150, 72, 0], RArm: [150, 72, 0], LElbow: 55, RElbow: 55, LFist: 1, RFist: 1 }),
  ball: P({ Spine: [28, 0, 0], Spine1: [20, 0, 0], Spine2: [16, 0, 0], Neck: [18, 0, 0], Head: [14, 0, 0], LLeg: [112, 10, 0], RLeg: [112, 10, 0], LKnee: 118, RKnee: 118, LArm: [72, 62, 0], RArm: [72, 62, 0], LElbow: 75, RElbow: 75 }),
  ballUp: P({ Spine: [14, 0, 0], Spine1: [6, 0, 0], Spine2: [0, 0, 0], Neck: [-12, 0, 0], Head: [-22, 0, 0], LLeg: [112, 10, 0], RLeg: [112, 10, 0], LKnee: 118, RKnee: 118, LArm: [62, 50, 0], RArm: [62, 50, 0], LElbow: 120, RElbow: 120, LFist: 0, RFist: 0 }),
  lean: P({ Spine: [-8, 0, 0], Head: [-12, 0, 0], LArm: [-26, 48, 0], RArm: [-26, 48, 0], LElbow: 20, RElbow: 20, LLeg: [24, 9, 0], RLeg: [14, 9, 0], LKnee: 42, RKnee: 28, LFist: 0, RFist: 0 }),
  leanLook: P({ Spine: [-4, 0, 0], Head: [-4, -10, 0], LArm: [-20, 50, 0], RArm: [-20, 50, 0], LElbow: 30, RElbow: 30, LLeg: [24, 9, 0], RLeg: [14, 9, 0], LKnee: 42, RKnee: 28, LFist: 0, RFist: 0, LShoulder: [0, 0, 14], RShoulder: [0, 0, -14] }),
  holdFace: P({ Spine2: [6, 0, 0], Head: [8, 0, 0], LArm: [66, 62, 0], RArm: [66, 62, 0], LElbow: 148, RElbow: 148, LFist: 0, RFist: 0 }),
  think: P({ Spine: [0, 6, 0], Head: [-6, 14, 6], RArm: [48, 78, 0], RElbow: 146, RFist: 0.6, LArm: [30, 86, 40], LElbow: 100, LFist: 0.4 }),
  idea: P({ Head: [-10, 0, 0], RArm: [70, 60, 0], RElbow: 120, RFist: 0.8, LArm: [10, 70, 0], LElbow: 30 }),
  sitPat: P({ ...sitLegs, Spine: [0, 12, -6], Head: [0, 30, 0], LArm: [8, 70, 0], LElbow: 6, LFist: 0, RArm: [28, 66, 0], RElbow: 45 }),
  sitPatUp: P({ ...sitLegs, Spine: [0, 12, -4], Head: [0, 30, 0], LArm: [14, 50, 0], LElbow: 30, LFist: 0, RArm: [28, 66, 0], RElbow: 45 }),
  lie: P({ LLeg: [-16, 6, 0], RLeg: [-16, 6, 0], Head: [12, 0, 0], LArm: [5, 68, 0], RArm: [5, 68, 0], LElbow: 20, RElbow: 20 }),
  lieWatch: P({ LLeg: [-16, 6, 0], RLeg: [-16, 6, 0], Head: [6, 38, 0], LArm: [30, 62, 0], RArm: [30, 62, 0], LElbow: 95, RElbow: 95, LFist: 0.8, RFist: 0.8 }),
  spoon: P({ Head: [6, -12, 0], LLeg: [18, 4, 0], LKnee: 30, RLeg: [0, 4, 0], RKnee: 12, LArm: [42, 66, 0], LElbow: 105, RArm: [36, 70, 0], RElbow: 100 }),
};
const gLegs = { LLeg: [10, 9, 0], RLeg: [-6, 9, 0], LKnee: 22, RKnee: 34, LFoot: 28, RFoot: 28 };
const G = {
  base: P({ ...gLegs, LArm: [0, 46, 0], RArm: [0, 46, 0], LElbow: 22, RElbow: 22 }),
  wave: P({ ...gLegs, Spine: [0, 0, 6], Head: [-4, 0, -8], LArm: [0, 44, 0], LElbow: 25, LFist: 0, RArm: [0, -52, 0], RElbow: 22, RFist: 1 }),
  reach: P({ Spine: [16, 0, 0], Head: [-14, 0, 0], LArm: [84, 76, 0], RArm: [70, 70, 0], LElbow: 14, RElbow: 30, LFist: 0, LLeg: [-18, 9, 0], RLeg: [-30, 9, 0], LKnee: 36, RKnee: 50, LFoot: 40, RFoot: 40 }),
  grab: P({ Spine: [34, 0, 0], Head: [-20, 0, 0], LArm: [70, 80, 0], RArm: [40, 62, 0], LElbow: 8, RElbow: 60, LFist: 1, LLeg: [-30, 9, 0], RLeg: [-40, 9, 0], LKnee: 40, RKnee: 55, LFoot: 40, RFoot: 40 }),
  yank: P({ Spine: [-14, 0, 0], Head: [-6, 0, 0], LArm: [165, 62, 0], RArm: [30, 50, 0], LElbow: 20, RElbow: 50, LFist: 1, LLeg: [20, 9, 0], RLeg: [5, 9, 0], LKnee: 30, RKnee: 40, LFoot: 30, RFoot: 30 }),
  hero: P({ Spine: [-10, 0, 0], Spine2: [-8, 0, 0], Head: [-12, 0, 0], LArm: [-12, 46, -70], LElbow: 104, LFist: 1, RArm: [172, 78, 0], RElbow: 10, RFist: 1, LLeg: [6, 12, 0], LKnee: 8, RLeg: [-28, 6, 0], RKnee: 62, LFoot: 30, RFoot: 40 }),
  superman: P({ Neck: [-22, 0, 0], Head: [-50, 0, 0], LArm: [172, 76, 0], RArm: [172, 76, 0], LElbow: 6, RElbow: 6, LFist: 0, LLeg: [-6, 8, 0], RLeg: [-6, 8, 0], LKnee: 6, RKnee: 6, LFoot: 50, RFoot: 50 }),
  stuck: P({ Neck: [-20, 0, 0], Head: [-48, 0, 0], LArm: [118, 34, 0], RArm: [118, 34, 0], LElbow: 62, RElbow: 62, LFist: 0, RFist: 0, LLeg: [-10, 12, 0], RLeg: [-10, 12, 0], LKnee: 20, RKnee: 20, LFoot: 40, RFoot: 40 }),
  tada: P({ Spine: [-8, 0, 0], Head: [-8, 0, 0], LArm: [0, -42, 0], RArm: [0, -42, 0], LElbow: 12, RElbow: 12, LFist: 0, RFist: 1, LLeg: [55, 16, 0], LKnee: 85, RLeg: [0, 6, 0], RKnee: 8, LFoot: 40, RFoot: 40 }),
  hopeful: P({ ...gLegs, Head: [4, 0, 10], Spine: [4, 0, 0], LArm: [56, 72, 0], RArm: [56, 72, 0], LElbow: 112, RElbow: 112, RFist: 1 }),
  gasp: P({ ...gLegs, Spine: [-10, 0, 0], Head: [-6, 0, 0], LArm: [66, 62, 0], RArm: [66, 62, 0], LElbow: 148, RElbow: 148, LFist: 0, RFist: 1, LShoulder: [0, 0, 14], RShoulder: [0, 0, -14] }),
  hug: P({ Spine: [6, 0, 0], Head: [8, 0, 12], LArm: [58, 76, 0], RArm: [58, 76, 0], LElbow: 122, RElbow: 122, RFist: 1, LLeg: [28, 10, 0], RLeg: [28, 10, 0], LKnee: 72, RKnee: 72, LFoot: 30, RFoot: 30 }),
  crawlA: P({ Neck: [-16, 0, 0], Head: [-52, 0, 0], LArm: [128, 80, 0], RArm: [96, 80, 0], LElbow: 30, RElbow: 60, LFist: 0, RFist: 0, LLeg: [70, 12, 0], RLeg: [98, 12, 0], LKnee: 95, RKnee: 105, LFoot: 40, RFoot: 40 }),
  crawlB: P({ Neck: [-16, 0, 0], Head: [-52, 0, 0], LArm: [96, 80, 0], RArm: [128, 80, 0], LElbow: 60, RElbow: 30, LFist: 0, RFist: 0, LLeg: [98, 12, 0], RLeg: [70, 12, 0], LKnee: 105, RKnee: 95, LFoot: 40, RFoot: 40 }),
  flop: P({ Head: [-30, 0, 0], LArm: [150, 50, 0], RArm: [150, 50, 0], LElbow: 30, RElbow: 30, LFist: 0, RFist: 0, LLeg: [0, 16, 0], RLeg: [0, 16, 0], LKnee: 20, RKnee: 20, LFoot: 50, RFoot: 50 }),
  lie: P({ LLeg: [-14, 10, 0], RLeg: [-14, 10, 0], Head: [10, 0, 0], LArm: [8, 58, 0], RArm: [8, 58, 0], LElbow: 20, RElbow: 20 }),
  sitReach: P({ Spine: [22, 0, 0], Spine2: [10, 0, 0], Head: [-6, 0, 0], LArm: [82, 78, 0], RArm: [82, 78, 0], LElbow: 8, RElbow: 8, LFist: 1, RFist: 1, LLeg: [60, 10, 0], RLeg: [60, 10, 0], LKnee: 10, RKnee: 10 }),
  pulled: P({ LLeg: [-14, 10, 0], RLeg: [-14, 10, 0], Head: [12, 0, 0], LArm: [52, 70, 0], RArm: [52, 70, 0], LElbow: 120, RElbow: 120, LFist: 1, RFist: 1 }),
  patUp: P({ LLeg: [-14, 10, 0], RLeg: [-14, 10, 0], Head: [10, -32, 0], LArm: [30, 66, 0], LElbow: 100, RArm: [62, 22, 0], RElbow: 30, RFist: 0 }),
  patDown: P({ LLeg: [-14, 10, 0], RLeg: [-14, 10, 0], Head: [10, -32, 0], LArm: [30, 66, 0], LElbow: 100, RArm: [30, 16, 0], RElbow: 18, RFist: 0 }),
  spoon: P({ Head: [8, -8, 0], Spine: [8, 0, 0], LArm: [78, 58, 0], LElbow: 42, LFist: 0, RArm: [40, 78, 0], RElbow: 115, LLeg: [38, 6, 0], LKnee: 55, RLeg: [18, 6, 0], RKnee: 30 }),
};
const face = {
  shock: { eye: 1.55, brow: [1.2, 12, 1.2, 12], mouth: 1, mouthW: 1.15 },
  scared: { eye: 1.4, brow: [1, 16, 1, 16], mouth: 0.55, mouthW: 1.3 },
  confused: { eye: 1, look: [0, 0], brow: [1.1, -6, -0.3, 10], mouth: 0, smile: -0.5, mouthW: 0.8 },
  worried: { eye: 1, brow: [0.6, 18, 0.6, 18], mouth: 0, smile: -0.6 },
  pant: { eye: 0.7, brow: [0.5, 16, 0.5, 16], mouth: 0.7, mouthW: 1.1 },
  stressed: { eye: 0.12, brow: [0.2, 20, 0.2, 20], mouth: 0.25, mouthW: 1.4 },
  think: { eye: 1, look: [0.8, -0.7], brow: [1.1, -4, 0.1, 6], mouth: 0, smile: -0.15, mouthW: 0.7 },
  idea: { eye: 1.25, look: [0, -0.2], brow: [1.2, 0, 1.2, 0], mouth: 0.35, mouthW: 1.1 },
  friendly: { eye: 1, look: [0.7, 0], brow: [0.6, 4, 0.6, 4], mouth: 0, smile: 0.9, mouthW: 1.1 },
  nervous: { eye: 1.3, look: [0.9, 0], brow: [0.9, 14, 0.9, 14], mouth: 0, smile: 0.25, mouthW: 1.2 },
  wideSide: { eye: 1.5, look: [0.95, 0], brow: [1.1, 10, 1.1, 10], mouth: 0, smile: -0.2, mouthW: 0.7 },
  content: { eye: 0.1, brow: [0.3, 0, 0.3, 0], mouth: 0, smile: 1, mouthW: 1.15, blush: 1 },
  gHappy: { eye: 1, brow: [0.9, 4, 0.9, 4], mouth: 0.5, mouthW: 1.25, blush: 0.6 },
  gSly: { eye: 1, brow: [0.4, -10, 1.0, 6], mouth: 0, smile: 1, mouthW: 1.2 },
  gEffort: { eye: 0.12, brow: [0.1, -18, 0.1, -18], mouth: 0.3, mouthW: 1.5 },
  gProud: { eye: 0.12, brow: [0.9, 0, 0.9, 0], mouth: 0, smile: 1, mouthW: 1.2 },
  gGasp: { eye: 1.6, brow: [1.3, 10, 1.3, 10], mouth: 1, mouthW: 1, blush: 0.5 },
  gJoy: { eye: 0.1, brow: [1, 6, 1, 6], mouth: 0.75, mouthW: 1.4, blush: 1 },
  gSleep: { eye: 0.1, brow: [0.4, 0, 0.4, 0], mouth: 0.2, mouthW: 0.9, blush: 0.8 },
};
const mixFace = (a, b, k) => {
  const o = {}; const A = { eye: 1, look: [0, 0], brow: [0, 0, 0, 0], mouth: 0, mouthW: 1, smile: 0.35, blush: 0, ...a }, B = { eye: 1, look: [0, 0], brow: [0, 0, 0, 0], mouth: 0, mouthW: 1, smile: 0.35, blush: 0, ...b };
  for (const n in A) o[n] = Array.isArray(A[n]) ? A[n].map((v, i) => v + (B[n][i] - v) * k) : A[n] + (B[n] - A[n]) * k;
  return o;
};
const blink = (f, t, at) => (t > at && t < at + 0.12 ? { ...f, eye: Math.min(f.eye ?? 1, 0.1) } : f);

const R = {
  front: rotQ([]), back: rotQ([['y', 180]]), faceXneg: rotQ([['y', -90]]), faceXpos: rotQ([['y', 90]]),
  lie: rotQ([['x', -72]]), fly: rotQ([['x', 78], ['y', -90]]), crawl: rotQ([['x', 80], ['y', -90]]),
  manSpoon: rotQ([['x', -74], ['z', 30]]), ghostSpoon: rotQ([['x', -74], ['z', 58]]),
};
const slerp = (a, b, k) => a.clone().slerp(b, clamp01(k));
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// camera move: [pos, target, fov] -> [pos, target, fov]
function cam(S, a, b, k, shake = 1, t = 0, up = null, roll = 0) {
  const p = lerp3(a[0], b[0], k), tg = lerp3(a[1], b[1], k), fov = a[2] + (b[2] - a[2]) * k;
  const s = 0.012 * shake;
  S.camera.position.set(p[0] + noise(t * 1.3, 1) * s, p[1] + noise(t * 1.1, 2) * s, p[2] + noise(t * 1.2, 3) * s);
  S.camera.up.set(...(up || [0, 1, 0]));
  S.camera.fov = fov; S.camera.updateProjectionMatrix();
  S.camera.lookAt(tg[0] + noise(t * 0.9, 4) * s * 1.6, tg[1] + noise(t * 1.0, 5) * s * 1.6, tg[2] + noise(t * 0.8, 6) * s * 1.6);
  if (roll) S.camera.rotateZ(roll);
}
// short decaying camera kick (door slam, boing)
const kick = (t, at, amp = 0.05, dur = 0.35) => (t < at || t > at + dur ? 0 : amp * (1 - (t - at) / dur) * Math.sin((t - at) * 70));

export function applyTimeline(t, S) {
  const { man, ghost, set, blanket, fx } = S;
  const bob = 0.05 * osc(t, 0.45), bobS = 0.02 * osc(t, 0.45);
  let shot = 0; while (shot < CUTS.length - 2 && t >= CUTS[shot + 1]) shot++;
  const t0 = CUTS[shot], t1 = CUTS[shot + 1], u = clamp01((t - t0) / (t1 - t0)), lt = t - t0;

  // defaults
  let mp = M.sitIdle, mat = [-0.15, SIT, -1.25], mr = R.front, mf = {};
  let gp = G.base, gat = [0.25, 1.1 + bob, 0.75], gr = R.back, gf = face.gHappy;
  let bl = { top: -1.12 }, door = 0, moon = 'bed', hideDoorWall = false, bumpOpt = {}, ghostBumps = false, manVisible = true;
  let teddy = { pos: [-0.1, -0.15, 0.03], rot: [0, 0, 0] }, teddyWorld = null, stache = 0, fxT = -1, kickX = 0;
  const tremble = (p, amp, hz = 13) => tweak(p, { Spine: [osc(t, hz) * amp, 0, osc(t, hz * 1.13, 1) * amp], LeftArm: [osc(t, hz * 0.9, 2) * amp * 2, 0, 0], RightArm: [osc(t, hz * 1.07, 3) * amp * 2, 0, 0], Head: [0, osc(t, hz * 0.8, 4) * amp, 0] });

  switch (shot) {
    case 0: { // 1. "If you see a ghost" – close-up, shock
      mp = tremble(seqPose(lt, [[0, M.sitIdle], [0.16, M.sitScared, 'back']]), 1.6);
      mf = mixFace({ eye: 1 }, face.shock, ramp(lt, 0.02, 0.14, 'out'));
      cam(S, [[0.1, 1.42, 0.25], [-0.15, 1.36, -1.25], 34], [[0.02, 1.4, -0.12], [-0.15, 1.38, -1.25], 34], ease.out(u), 1.6, t);
      break;
    }
    case 1: { // 2. "while you're trying to sleep" – over the shoulder, ghost waves teddy at the foot of the bed
      mp = tremble(M.sitScared, 1.0); mf = face.shock;
      gp = tweak(G.wave, { RightArm: [0, 0, osc(t, 2.4) * 16], RightForeArm: [0, osc(t, 2.4, 0.6) * 14, 0], Spine: [0, 0, osc(t, 2.4, 0.3) * 4] });
      gat = [0.3, 1.12 + bob, 0.55]; gf = face.gHappy;
      teddy = { pos: [-0.1, -0.02, 0.0], rot: [0, 0, 150] };
      cam(S, [[-0.62, 1.86, -2.08], [0.3, 1.12, 0.55], 54], [[-0.56, 1.82, -1.98], [0.3, 1.15, 0.55], 51], ease.io(u), 1.3, t);
      break;
    }
    case 2: { // 3. "what should you do?" – looks at camera, confused head tilt + shrug
      mp = seqPose(lt, [[0, M.sitScared], [0.28, M.sitShrug, 'back'], [1.4, tweak(M.sitShrug, { Head: [0, 0, 4] })]]);
      mf = blink(mixFace(face.shock, face.confused, ramp(lt, 0.05, 0.25)), lt, 0.75);
      cam(S, [[-0.02, 1.32, 0.35], [-0.15, 1.2, -1.25], 40], [[-0.05, 1.32, 0.12], [-0.15, 1.22, -1.25], 40], ease.io(u), 1, t);
      break;
    }
    case 3: { // 4. "If you pull your blanket over your head" – blanket up, shaking lump
      mp = seqPose(lt, [[0, M.sitShrug], [0.22, M.pullUp, 'out'], [0.62, M.ball]]);
      mf = face.scared;
      const shake = ramp(lt, 0.7, 0.9);
      mat = [-0.15 + osc(t, 15) * 0.012 * shake, SIT + Math.abs(osc(t, 7.5)) * 0.012 * shake, -1.25 + osc(t, 13, 1) * 0.008 * shake];
      mp = tremble(mp, 2.2 * shake, 15);
      bl = { top: seqNum(lt, [[0.1, -1.12], [0.55, -1.98, 'out']]) };
      manVisible = lt < 0.5;
      cam(S, [[1.55, 1.75, 0.75], [-0.15, 0.72, -1.2], 44], [[1.3, 1.6, 0.4], [-0.15, 0.74, -1.2], 44], ease.io(u), 1, t);
      break;
    }
    case 4: { // 5a. "he'll float closer" – ghost glides in over the foot of the bed, reaching
      mp = tremble(M.ball, 2.2, 15); mat = [-0.15 + osc(t, 15) * 0.012, SIT, -1.25]; manVisible = false; bl = { top: -1.98 };
      gp = seqPose(lt, [[0, G.base], [0.35, G.reach], [0.95, G.grab]]);
      gat = lerp3([0.0, 1.22, 1.35], [-0.05, 1.12, -0.05], ease.io(u)); gat[1] += bob * 0.6; gf = face.gSly;
      teddy = { pos: [-0.1, -0.15, 0.03], rot: [0, 0, 20] };
      cam(S, [[-1.85, 0.95, -0.15], [-0.1, 0.92, -0.45], 50], [[-1.75, 0.95, -0.3], [-0.1, 0.95, -0.6], 48], ease.io(u), 1.2, t);
      break;
    }
    case 5: { // 5b. "rip it off" – yank, swing it on like a cape, hero pose
      const k = ramp(lt, 0.03, 0.5, 'io');
      mp = seqPose(lt, [[0, M.ball], [0.3, M.ballUp, 'back']]); mp = tremble(mp, 1.4, 13); mf = face.shock; manVisible = lt > 0.06;
      gp = seqPose(lt, [[0, G.grab], [0.22, G.yank, 'out'], [0.62, G.hero, 'back']]);
      gat = lerp3([-0.05, 1.12, -0.05], [0.0, 1.22, 0.2], ramp(lt, 0.05, 0.6)); gat[1] += bob * 0.6;
      gf = lt < 0.3 ? face.gEffort : face.gProud;
      teddy = { pos: [-0.1, -0.02, 0.0], rot: [0, 0, 160] };
      bl = { top: -1.98, cape: { k, t } };
      cam(S, [[-0.95, 0.72, -1.95], [0.0, 1.2, 0.1], 56], [[-0.8, 0.7, -1.75], [0.0, 1.3, 0.2], 50], ease.io(u), 1.4, t);
      break;
    }
    case 6: { // 6a. "But if you run" – sprint to the open door
      mp = man.clip('run', lt * 1.25 + 0.1); mf = face.scared;
      const a = [0.95, HIP, -0.15], b = [2.5, HIP, 1.22];
      mat = lerp3(a, b, u); mat[1] += mp.hip.y * 0; mr = rotQ([['y', Math.atan2(b[0] - a[0], b[2] - a[2]) * 180 / Math.PI]]);
      door = 1.5; bl = { top: -0.55 };
      gat = [0.0, 1.22 + bob, 0.2]; gp = G.hero; gf = face.gProud;
      cam(S, [[-0.1, 1.35, -1.15], [1.6, 0.95, 0.7], 46], [[0.2, 1.3, -0.8], [2.2, 0.95, 1.15], 46], ease.io(u), 2.2, t);
      break;
    }
    case 7: { // 6b. "and lock your door" – slam it, lean on it panting
      moon = 'hall';
      door = seqNum(lt, [[0, 0.75], [0.07, 0, 'in']]);
      const pant = osc(lt, 3.2);
      mp = tweak(M.lean, { Spine2: [pant * 4, 0, 0], Head: [pant * -3, 0, 0], LeftShoulder: [0, 0, 5 + pant * 5], RightShoulder: [0, 0, -5 - pant * 5] });
      mat = [2.57 + ramp(lt, 0, 0.07) * 0.0, HIP - 0.05 + pant * 0.006, 1.15]; mr = R.faceXpos;
      mf = { ...face.pant, mouth: 0.55 + 0.3 * pant };
      gat = [6.5, 1.2, 1.15];
      kickX = kick(t, t0 + 0.07, 0.05);
      cam(S, [[4.0, 1.25, 2.45], [2.55, 0.98, 1.15], 46], [[3.75, 1.22, 2.25], [2.55, 1.02, 1.15], 44], ease.out(u), 1, t);
      break;
    }
    case 8: { // 7. "he'll just float in through the window" – belly gets stuck, wiggle, boing, dramatic pose
      moon = 'hall'; hideDoorWall = true;
      const pant = osc(lt, 3.2);
      mp = seqPose(lt, [[0, M.lean], [0.35, M.leanLook, 'back']]);
      mp = tweak(mp, { Spine2: [pant * 2, 0, 0] }); mat = [2.57, HIP - 0.05, 1.15]; mr = R.faceXpos; mf = lt < 0.3 ? face.pant : face.shock;
      // ghost: fly in head-first (0–0.45), stuck + wiggle (0.45–1.22), pop (1.22–1.5), ta-da (1.5+)
      const pop = 1.24, wx = HWIN.z;
      const stuckK = clamp01((lt - 0.45) / (pop - 0.45));
      const wig = lt > 0.45 && lt < pop ? osc(lt, 5.5) * (0.6 + 0.4 * stuckK) : 0;
      const x = seqNum(lt, [[0, 5.75], [0.45, 4.82, 'out'], [pop, 4.7], [pop + 0.22, 3.45, 'out'], [pop + 0.5, 3.6]]);
      const y = seqNum(lt, [[0, 1.5], [pop, 1.47], [pop + 0.24, 1.3, 'out'], [pop + 0.55, 1.18]]);
      gat = [x, y + (lt > pop + 0.5 ? bob : 0) + Math.abs(wig) * 0.02, wx + wig * 0.03];
      const upK = ramp(lt, pop + 0.02, pop + 0.4, 'back');
      gr = slerp(rotQ([['z', wig * 12], ['x', 78], ['y', -90]]), R.faceXneg, upK);
      gp = seqPose(lt, [[0, G.superman], [0.45, G.superman], [0.6, G.stuck], [pop, G.stuck], [pop + 0.36, G.tada, 'back']]);
      if (lt > 0.45 && lt < pop) gp = tweak(gp, { LeftUpLeg: [osc(lt, 6) * 28, 0, 0], RightUpLeg: [-osc(lt, 6) * 28, 0, 0], LeftArm: [osc(lt, 7) * 10, 0, 0], RightArm: [-osc(lt, 7) * 10, 0, 0] });
      gf = lt < 0.45 ? face.gHappy : lt < pop ? face.gEffort : face.gHappy;
      // squash & stretch on the pop
      S.ghostSquash = lt > pop && lt < pop + 0.5 ? 1 + 0.22 * Math.sin((lt - pop) * 22) * Math.exp(-(lt - pop) * 7) : 1;
      teddy = { pos: [-0.1, -0.02, 0.0], rot: [0, 0, 170] };
      kickX = kick(t, t0 + pop, 0.035, 0.3);
      cam(S, [[1.15, 2.0, 0.72], [4.4, 1.38, 1.3], 50], [[1.45, 1.95, 0.8], [4.3, 1.34, 1.28], 47], ease.io(u), 1.3, t);
      break;
    }
    case 9: { // 8. "So instead of being scared" – close-up, holds his face, thinking
      mat = [-0.3, HIP, 0.95]; mr = R.front;
      mp = seqPose(lt, [[0, M.holdFace], [0.75, M.holdFace], [1.1, M.think], [1.62, M.think], [1.8, M.idea, 'back']]);
      mp = tweak(mp, { Head: [osc(lt, 1.6) * (lt < 0.8 ? 3 : 0.6), osc(lt, 2.3) * (lt < 0.8 ? 4 : 0), 0] });
      mf = lt < 0.85 ? face.stressed : lt < 1.68 ? blink(face.think, lt, 1.3) : face.idea;
      gat = [0.85, 1.2 + bob, -0.55]; gr = R.front; gp = tweak(G.hopeful, { Spine: [0, 0, osc(t, 0.9) * 5] }); gf = face.gHappy;
      teddy = { pos: [-0.04, -0.06, 0.1], rot: [0, 30, 100] };
      bl = { top: -0.55 };
      cam(S, [[-0.16, 1.4, 2.5], [-0.28, 1.34, 0.95], 31], [[-0.2, 1.4, 2.15], [-0.28, 1.36, 0.95], 31], ease.io(u), 1, t);
      break;
    }
    case 10: { // 9a. "scoot over and" – man scoots over in bed and pats the empty spot
      const sc = ramp(lt, 0.04, 0.3, 'io');
      mat = [-0.12 - 0.4 * sc, SIT + Math.sin(sc * Math.PI) * 0.06, -1.25];
      const pat = lt > 0.36 ? Math.max(0, osc(lt - 0.36, 3.6)) : 0;
      mp = seqPose(lt, [[0, M.sitIdle], [0.36, M.sitPatUp]]); if (lt > 0.36) mp = mixPose(M.sitPatUp, M.sitPat, 1 - pat);
      mf = face.friendly;
      gat = [1.55, 1.12 + bob, -0.95]; gr = R.faceXneg; gp = G.base; gf = { ...face.gHappy, mouth: 0 };
      bl = { top: -0.55 };
      cam(S, [[-1.55, 1.7, 0.55], [-0.1, 0.85, -1.1], 46], [[-1.4, 1.62, 0.4], [-0.1, 0.88, -1.1], 46], ease.io(u), 1, t);
      break;
    }
    case 11: { // 9b. "invite him into your bed" – ghost gasps, hugs his teddy, super happy
      mat = [-0.52, SIT, -1.25]; mp = M.sitPat; mf = face.friendly; bl = { top: -0.55 };
      const joy = ramp(lt, 0.42, 0.62);
      gp = seqPose(lt, [[0, G.base], [0.14, G.gasp, 'back'], [0.42, G.gasp], [0.64, G.hug, 'back']]);
      const wiggle = joy * osc(lt, 4.2);
      gp = tweak(gp, { Spine: [0, wiggle * 10, wiggle * 5], LeftUpLeg: [joy * osc(lt, 8.4) * 14, 0, 0], RightUpLeg: [-joy * osc(lt, 8.4) * 14, 0, 0] });
      gat = [1.5, 1.14 + bob * 0.5 + joy * Math.abs(osc(lt, 4.2)) * 0.07, -0.95]; gr = rotQ([['z', wiggle * 5], ['y', -90]]);
      gf = lt < 0.5 ? mixFace(face.gHappy, face.gGasp, ramp(lt, 0.02, 0.14)) : face.gJoy;
      teddy = lt < 0.5 ? { pos: [-0.1, -0.15, 0.03], rot: [0, 0, 20] } : { pos: [-0.02, -0.07, 0.1], rot: [0, 30, 100] };
      cam(S, [[0.1, 1.3, -0.5], [1.5, 1.34, -0.95], 44], [[0.4, 1.32, -0.6], [1.5, 1.38, -0.95], 42], ease.io(u), 1, t);
      break;
    }
    case 12: { // 10. "He'll climb in next to you" – ghost crawls onto the bed, slow and clumsy
      mat = [-0.52, MT + 0.13, -0.75]; mr = R.lie; mp = M.lieWatch; mf = blink(face.nervous, lt, 0.6); bl = { top: -0.55 };
      const step = (lt * 2.6) % 2, k = step < 1 ? ease.io(step) : 1 - ease.io(step - 1);
      const flop = ramp(lt, 0.98, 1.2, 'in');
      gp = mixPose(mixPose(G.crawlA, G.crawlB, k), G.flop, flop);
      const prog = ease.io(clamp01(lt / 1.0));
      gat = [1.5 - 1.02 * prog, 0.86 + 0.03 * Math.abs(osc(lt, 2.6)) - 0.14 * flop + bobS, -0.82];
      gr = rotQ([['z', osc(lt, 2.6) * 9 * (1 - flop)], ['x', 80 + 8 * flop], ['y', -90]]);
      gf = flop > 0.5 ? face.gJoy : face.gEffort;
      teddyWorld = { pos: [-0.02, MT + 0.1, -1.38], rot: [-70, 0, 20] };
      cam(S, [[0.55, 1.95, 1.55], [0.05, 0.62, -0.9], 42], [[0.4, 1.85, 1.35], [0.0, 0.62, -0.9], 42], ease.io(u), 1, t);
      break;
    }
    case 13: { // 11. "tuck the blanket around you both" – ghost pulls the blanket up over both and pats it down
      mat = [-0.52, MT + 0.13, -0.75]; mr = R.lie; mp = M.lieWatch; mf = blink(face.nervous, lt, 0.9);
      const pull = ramp(lt, 0.12, 0.6, 'io');
      bl = { top: -0.55 + (-1.38 + 0.55) * pull }; ghostBumps = true;
      const pat = lt > 0.85 ? Math.max(0, osc(lt - 0.85, 3.2)) : 0;
      gp = seqPose(lt, [[0, G.lie], [0.14, G.sitReach], [0.6, G.pulled], [0.85, G.patUp]]);
      if (lt > 0.85) gp = mixPose(G.patUp, G.patDown, pat);
      gr = slerp(R.lie, rotQ([['x', -38]]), seqNum(lt, [[0, 0], [0.14, 1], [0.3, 1], [0.6, 0]]));
      gat = [0.42, MT + 0.26 + bobS, -0.75]; gf = lt < 0.6 ? face.gEffort : face.gProud;
      bumpOpt = { exclude: /Arm|Hand/ };
      teddyWorld = { pos: [-0.02, MT + 0.1, -1.38], rot: [-70, 0, 20] };
      cam(S, [[1.7, 1.7, 0.55], [0.0, 0.62, -1.0], 44], [[1.5, 1.6, 0.35], [-0.05, 0.64, -1.0], 44], ease.io(u), 1, t);
      break;
    }
    default: { // 12. "and you'll fall asleep cuddling" – top-down, big spoon, snoring, hearts + Zzz, zoom out
      mat = [-0.44, MT + 0.14, -0.72]; mr = R.manSpoon; mp = M.spoon;
      const calm = ramp(lt, 0.75, 1.15);
      mf = mixFace(face.wideSide, face.content, calm);
      gat = [0.24, MT + 0.3 + bobS, -0.74]; gr = R.ghostSpoon;
      const sn = osc(lt, 0.85, -1.2);                       // snore cycle
      gp = tweak(G.spoon, { Spine2: [sn * 3, 0, 0] });
      gf = { ...face.gSleep, mouth: 0.25 + 0.5 * Math.max(0, sn), mouthW: 0.9 + 0.3 * Math.max(0, sn) };
      stache = Math.max(0, sn) * (0.6 + 0.4 * osc(lt, 11));
      bl = { top: -1.3 }; ghostBumps = true; bumpOpt = { exclude: /LeftArm|LeftForeArm|LeftHand/ };
      teddyWorld = { pos: [-0.5, MT + 0.5, -1.2], rot: [-80, 0, 35] };
      fxT = lt;
      const z = ease.io(u);
      cam(S, [[-0.1, 3.05, -1.02], [-0.1, 0.5, -1.05], 40], [[-0.1, 4.1, -0.92], [-0.1, 0.5, -0.95], 40], z, 0.6, t, [0, 0, -1], 0.04 * (1 - z));
    }
  }
  if (shot !== 8) S.ghostSquash = 1;

  // ---- apply ----
  set.setMoon(moon); set.doorWall.visible = !hideDoorWall; set.doorHinge.rotation.y = door;
  man.root.visible = manVisible;
  man.apply(mp, mat, mr); man.setFace(mf);
  ghost.apply(gp, gat, gr); ghost.setFace(gf);
  const sq = S.ghostSquash; ghost.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); ghost.root.updateMatrixWorld(true);
  ghost.stache.forEach((g, i) => { g.rotation.z = (i === 0 ? 1 : -1) * stache * 0.5; g.rotation.x = -stache * 0.25; });
  // teddy: in the ghost's right hand, or lying in the bed
  S.teddyHand.visible = !teddyWorld; S.teddyWorld.visible = !!teddyWorld;
  if (teddyWorld) { S.teddyWorld.position.set(...teddyWorld.pos); S.teddyWorld.rotation.set(...teddyWorld.rot.map((d) => d * Math.PI / 180)); }
  else { S.teddyHand.position.set(...teddy.pos); S.teddyHand.rotation.set(...teddy.rot.map((d) => d * Math.PI / 180)); }
  // ghost glow follows him
  ghost.worldPos('Spine2', ghost.halo.position); ghost.worldPos('Spine', ghost.light.position);
  // blanket
  const bumps = bumpsFor(man, bl.top, shot === 3 || shot === 4 ? { extra: 1.25 } : {});
  if (ghostBumps) { bumps.push(...bumpsFor(ghost, bl.top, { extra: 1.25, ...bumpOpt })); const b = ghost.worldPos('Spine'); if (b.z > bl.top) bumps.push({ x: b.x, y: b.y + 0.05, z: b.z, r: 0.3 }); }
  if (bl.cape) { bl.cape.origin = ghost.worldPos('Neck').clone(); bl.cape.quat = ghost.root.quaternion.clone(); }
  blanket.update({ ...bl, bumps });
  // hearts + Zzz
  if (fxT >= 0) fx.update(fxT, man.worldPos('Head').clone().add(v3([0.3, 0.1, 0.1])), ghost.worldPos('Head').clone().add(v3([0.1, 0.25, -0.2]))); else fx.hide();
  if (kickX) { S.camera.position.x += kickX; S.camera.position.y += kickX * 0.6; }
  return { shot, name: SHOT_NAMES[shot] };
}
