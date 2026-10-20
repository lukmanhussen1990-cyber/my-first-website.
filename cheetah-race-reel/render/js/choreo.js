import * as THREE from 'three';
import { keys, clamp, lerp, smoothstep, spline } from './util.js';
import { BEAT, W, carState, cheetahState, sCar, sCheetah } from './timeline.js';
import { coursePos, groundHeight, COURSE } from './course.js';
import { defaultPose } from './cheetah.js';
import { defaultJohnPose } from './john.js';
import { gallop, crouch } from './poses.js';

// Choreography: turns the timeline into poses, world placements, camera
// moves and effect parameters.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = smoothstep;
const pulse = (t, a, b, ra = 0.2, rb = 0.2) => sm(a - ra, a, t) * (1 - sm(b, b + rb, t));

// ---------------------------------------------------------- world placement
// The corner slide follows an explicit world-space path: the car fails to
// turn, drifts sideways right up to the cliff edge of the slice, and the side
// thrusters shove it back onto the track.
const XC = COURSE.CORNER - 3.0;
const SLIDE = [
  [BEAT.carSlide - 0.05, XC + 2.5, -7.25], [BEAT.carSlide + 0.6, XC + 8.9, -5.0], [BEAT.carSlide + 1.1, XC + 13.8, -2.75],
  [BEAT.sideThr, XC + 17.9, -1.85], [BEAT.sideThr + 0.35, XC + 21.1, -2.4], [BEAT.sideThr + 0.85, XC + 25.6, -5.4],
  [BEAT.sideThrEnd, XC + 29.1, -8.0], [BEAT.sideThrEnd + 0.45, XC + 33.6, -8.45],
];
const slideW = (t) => smoothstep(BEAT.carSlide - 0.05, BEAT.carSlide + 0.35, t) * (1 - smoothstep(BEAT.sideThrEnd - 0.1, BEAT.sideThrEnd + 0.45, t));
function slidePos(t) {
  return { x: spline(SLIDE.map((k) => [k[0], k[1]]), t), z: spline(SLIDE.map((k) => [k[0], k[2]]), t) };
}
function carXZ(t) {
  const c = carState(t);
  const p = coursePos(c.s, c.d);
  const w = slideW(t);
  if (w <= 0) return { x: p.x, z: p.z };
  const sp = slidePos(t);
  return { x: lerp(p.x, sp.x, w), z: lerp(p.z, sp.z, w) };
}

export function carWorld(t) {
  const c = carState(t);
  const p = carXZ(t), p2 = carXZ(t + 0.02);
  // heading from the actual path (finite difference in time) + drift angle
  let heading = coursePos(c.s, c.d).heading;
  const dx = p2.x - p.x, dz = p2.z - p.z;
  if (Math.hypot(dx, dz) > 0.02) heading = Math.atan2(-dz, dx);
  // big sideways drift during the slide: the nose points into the bend
  const drift = 0.95 * smoothstep(BEAT.carSlide, BEAT.carSlide + 0.8, t) * (1 - smoothstep(BEAT.sideThr + 0.2, BEAT.sideThrEnd + 0.3, t));
  return { ...c, yaw: c.yaw * (1 - slideW(t)) + drift, x: p.x, z: p.z, heading };
}

export function cheetahWorld(t) {
  const c = cheetahState(t);
  const p = coursePos(c.s, c.d);
  const c2 = cheetahState(t + 0.03), p2 = coursePos(c2.s, c2.d);
  let heading = p.heading;
  const dx = p2.x - p.x, dz = p2.z - p.z;
  if (Math.hypot(dx, dz) > 0.01) heading = Math.atan2(-dz, dx);
  return { ...c, x: p.x, z: p.z, heading, turnRate: 0 };
}

// --------------------------------------------------------------- cheetah
export function cheetahPose(t) {
  const P = defaultPose();
  const cs = cheetahState(t);
  const u = W(t);
  // start crouch -> launch
  const wCrouch = 1 - sm(BEAT.launch - 0.05, BEAT.launch + 0.25, t);
  const wRun = sm(BEAT.launch - 0.05, BEAT.launch + 0.3, t) * (1 - sm(BEAT.chStop - 0.6, BEAT.chStop, t)) + sm(BEAT.zip - 0.05, BEAT.zip + 0.15, t);
  if (wCrouch > 0) crouch(P, t, wCrouch);
  if (wRun > 0) gallop(P, cs.phase, Math.max(cs.v, 3), wRun);
  // launch spring: body extends forward
  P.spineFlex += -0.6 * pulse(t, BEAT.launch, BEAT.launch + 0.25, 0.05, 0.25);
  // expressions while racing: determined
  P.lidL = P.lidR = lerp(0.12, 0.22, wRun); P.lowL = P.lowR = lerp(0.3, 0.12, wRun);
  P.browL = P.browR = -0.4 * wCrouch;
  // corner: lean into the left turn, tail swings out like a rudder
  const turn = pulse(t, BEAT.chTurn - 0.35, BEAT.chTurn + 0.75, 0.25, 0.4);
  P.bodyRoll += -0.32 * turn;
  P.tailSide += 2.3 * turn * Math.sin(Math.min(1, (t - BEAT.chTurn + 0.35) / 1.1) * Math.PI) + 0.35 * turn;
  P.tailUp += 0.35 * turn; P.tailCurl -= 0.2 * turn; P.tailWave *= 1 - 0.8 * turn;
  P.headYaw += 0.45 * turn;
  P.gaze = V3(1, 0, -0.6 * turn).normalize();
  // leap over the river: fully stretched flight, tail streaming back
  if (cs.leap > 0) {
    const a = cs.leapA, e = Math.sin(Math.PI * a);
    P.spineFlex = lerp(P.spineFlex, -1.0, e);
    for (const kk of ['FL', 'FR']) { P.legs[kk].x = lerp(P.legs[kk].x, 0.62, e); P.legs[kk].y = lerp(P.legs[kk].y, 0.22 + 0.1 * (1 - a), e); P.legs[kk].foot = lerp(P.legs[kk].foot, -0.4, e); }
    for (const kk of ['HL', 'HR']) { P.legs[kk].x = lerp(P.legs[kk].x, -0.8, e); P.legs[kk].y = lerp(P.legs[kk].y, 0.3, e); P.legs[kk].foot = lerp(P.legs[kk].foot, 1.3, e); }
    P.tailUp = lerp(P.tailUp, 0.55, e); P.tailCurl = lerp(P.tailCurl, 0.05, e); P.tailWave = lerp(P.tailWave, 0.02, e);
    P.bodyPitch = lerp(P.bodyPitch, 0.18 - 0.36 * a, e);
    P.lidL = P.lidR = 0.0; P.earsBack = 0.9;
  }
  // tiring: from the slow-down on, panting with the tongue out
  const tired = sm(BEAT.chSlow + 0.6, BEAT.chSlow + 2.0, t) * (1 - sm(BEAT.sly - 0.15, BEAT.sly + 0.25, t));
  if (tired > 0) {
    P.mouthOpen = Math.max(P.mouthOpen, tired); P.tongue = tired;
    P.breath = 0.075 * tired * Math.sin(t * 10.5);
    P.lidL = P.lidR = lerp(P.lidL, 0.42, tired); P.lowL = P.lowR = lerp(P.lowL, 0.2, tired);
    P.earsBack = lerp(P.earsBack, 0.15, tired);
  }
  // standing still after the stop: head low, sides heaving
  const stand = sm(BEAT.chStop - 0.5, BEAT.chStop + 0.1, t) * (1 - sm(BEAT.zip - 0.05, BEAT.zip + 0.05, t));
  if (stand > 0) {
    P.neckLift = lerp(P.neckLift, -0.35, stand * (1 - sm(BEAT.sly - 0.3, BEAT.sly + 0.2, t)));
    P.headPitch = lerp(P.headPitch, -0.15 + 0.04 * Math.sin(t * 10.5), stand);
    P.bodyY += -0.01 * stand + 0.006 * Math.sin(t * 10.5) * tired;
    P.tailUp = lerp(P.tailUp, -0.1, stand); P.tailWave = lerp(P.tailWave, 0.05, stand); P.tailCurl = lerp(P.tailCurl, 0.45, stand);
  }
  // watches the car zoom past, then turns to us with a sly grin
  const watch = pulse(t, 33.0, 35.35, 0.3, 0.3);
  P.headYaw += 0.55 * watch * (1 - sm(33.3, 34.6, t)) + 0.15 * watch;
  P.gaze = P.gaze.clone().lerp(V3(1, 0.05, -0.5).normalize(), watch);
  const sly = pulse(t, BEAT.sly, BEAT.zip - 0.15, 0.3, 0.1);
  if (sly > 0) {
    P.headYaw = lerp(P.headYaw, -0.75, sly); P.headRoll = lerp(P.headRoll, -0.16, sly); P.headPitch = lerp(P.headPitch, 0.05, sly);
    P.neckLift = lerp(P.neckLift, 0.25, sly);
    P.lidL = lerp(P.lidL, 0.66, sly); P.lidR = lerp(P.lidR, 0.6, sly); P.lowL = P.lowR = lerp(P.lowL, 0.42, sly);
    P.browL = lerp(P.browL, 1.25, sly); P.browR = lerp(P.browR, -0.7, sly);
    P.grin = 1.25 * sly; P.grinSide = 0.85; P.mouthOpen = P.mouthOpen * (1 - sly); P.tongue *= 1 - sly;
    P.gaze = P.gaze.clone().lerp(V3(1, 0.0, 0.8).normalize(), sly);
    P.earsPerk = sly; P.tailWave = lerp(P.tailWave, 0.3, sly); P.tailSide = 0.4 * Math.sin(t * 5) * sly;
  }
  // zip: anticipation squash, then off it goes
  const antic = pulse(t, BEAT.zip - 0.22, BEAT.zip, 0.05, 0.03);
  if (antic > 0) { P.crouch = Math.max(P.crouch, 0.6 * antic); P.spineFlex = lerp(P.spineFlex, 0.6, antic); }
  // blink now and then
  const bt = (t * 0.37) % 1;
  P.blink = Math.max(P.blink, bt > 0.97 ? Math.sin((bt - 0.97) / 0.03 * Math.PI) : 0);
  return P;
}

// cheetah sitting in the passenger seat (scene 7)
export function seatedCheetahPose(t) {
  const P = defaultPose();
  P.sit = 1; P.glasses = 1;
  P.mouthOpen = 1; P.tongue = 1; P.breath = 0.06 * Math.sin(t * 10);
  for (const kk of ['HL', 'HR']) { P.legs[kk].x = 0.22; P.legs[kk].y = 0.06; P.legs[kk].foot = 1.2; }
  for (const kk of ['FL', 'FR']) { P.legs[kk].x = 0.24; P.legs[kk].y = 0.3; P.legs[kk].foot = 0.8; }
  P.headPitch = 0.02 * Math.sin(t * 10);
  P.lidL = P.lidR = 0.15;
  // end beat: slides the shades down its nose, looks straight at us, smug
  // grin and a wink
  const end = sm(54.68, 55.0, t);
  // the camera sits off its left shoulder (front-left of the car)
  P.headYaw = 0.6 * end; P.headRoll = 0.1 * end; P.headPitch += 0.05 * end;
  P.glassesDrop = end;
  P.gaze = V3(1, 0.05, 0).lerp(V3(1, 0.1, -0.12), end).normalize();
  P.mouthOpen = 1 - end; P.tongue = 1 - end; P.grin = 1.15 * end; P.grinSide = 0.7;
  P.browL = 0.9 * end; P.browR = -0.3 * end;
  P.lidL = lerp(P.lidL, 0.35, end); P.lidR = lerp(P.lidR, 0.35, end);
  const wink = pulse(t, 55.12, 55.5, 0.08, 0.1);
  P.lidR = lerp(P.lidR, 0.8, wink); P.lowR = lerp(P.lowR, 0.55, wink);
  return P;
}

// ------------------------------------------------------------------ John
export function johnPose(t) {
  const P = defaultJohnPose();
  const yoke = (sx) => V3(0.36, 0.33 + 0.01 * Math.sin(t * 3), 0.14 * sx);
  P.handL = yoke(-1); P.handR = yoke(1);
  P.smile = 0.5; P.gaze = V3(1, 0, 0);
  // launch: pushed back, thrilled
  const g1 = pulse(t, BEAT.launch, BEAT.bog, 0.05, 0.3);
  P.headBack += 0.22 * pulse(t, BEAT.launch, BEAT.launch + 0.5, 0.05, 0.4); P.lean -= 0.1 * g1;
  P.open = Math.max(P.open, 0.8 * g1); P.teeth = g1 > 0.3 ? 1 : 0; P.smile = lerp(P.smile, 1, g1);
  P.hairBounce = 0.7 * g1;
  // tyres spinning: frustrated
  const fr = pulse(t, BEAT.sortOf, BEAT.fanOn - 0.2, 0.25, 0.3);
  P.browIn = Math.max(P.browIn, 0.9 * fr); P.smile = lerp(P.smile, -0.5, fr);
  P.lidL = P.lidR = lerp(P.lidL, 0.3, fr); P.headPitch += -0.1 * fr;
  P.handL.y += 0.02 * Math.sin(t * 22) * fr; P.handR.y += 0.02 * Math.sin(t * 22 + 1) * fr;
  // fan on: a knowing smile; grip: rocket launch grin
  const fanUp = pulse(t, BEAT.fanOn - 0.1, BEAT.grip, 0.3, 0.1);
  P.smile = lerp(P.smile, 0.9, fanUp); P.browL = lerp(P.browL, 0.6, fanUp); P.browR = lerp(P.browR, 0.2, fanUp);
  const g2 = pulse(t, BEAT.grip, 16.4, 0.05, 0.5);
  P.headBack += 0.25 * pulse(t, BEAT.grip, BEAT.grip + 0.8, 0.05, 0.5); P.open = Math.max(P.open, 0.9 * g2); P.teeth = g2 > 0.3 ? 1 : P.teeth; P.smile = lerp(P.smile, 1, g2);
  P.hairBounce += 0.9 * g2;
  // corner slide: alarm, then determination when the thrusters fire
  const slide = pulse(t, BEAT.carSlide + 0.2, BEAT.sideThr, 0.2, 0.15);
  P.oShape = Math.max(P.oShape, slide); P.browL = lerp(P.browL, 1, slide); P.browR = lerp(P.browR, 1, slide); P.lidL = P.lidR = lerp(P.lidL, -0.1, slide);
  P.lean += 0.12 * slide; P.twist += 0.1 * slide;
  P.handL.z -= 0.08 * slide; P.handR.z -= 0.08 * slide;
  const det = pulse(t, BEAT.sideThr, BEAT.sideThrEnd + 0.4, 0.1, 0.3);
  P.browIn = Math.max(P.browIn, det); P.smile = lerp(P.smile, 0.7, det); P.teeth = det > 0.4 ? 1 : P.teeth; P.open = Math.max(P.open, 0.35 * det);
  // river: brakes ("uh oh"), thrusters, WHOA in the flip
  const uhoh = pulse(t, BEAT.carBrake + 0.3, BEAT.backThr, 0.2, 0.1);
  P.oShape = Math.max(P.oShape, 0.7 * uhoh); P.gaze = P.gaze.clone().lerp(V3(1, -0.4, 0), uhoh); P.browL = lerp(P.browL, 0.8, uhoh); P.browR = lerp(P.browR, 0.8, uhoh);
  const whoa = pulse(t, BEAT.carLaunch, BEAT.land, 0.15, 0.2);
  P.open = Math.max(P.open, whoa); P.teeth = whoa > 0.3 ? 1 : P.teeth; P.smile = lerp(P.smile, 1, whoa);
  P.lidL = P.lidR = lerp(P.lidL, -0.1, whoa); P.browL = lerp(P.browL, 1, whoa); P.browR = lerp(P.browR, 1, whoa);
  P.hairBounce += 1.4 * whoa * Math.sin(t * 2.5);
  P.handR = P.handR.clone().lerp(V3(0.15, 0.62, 0.3), whoa * sm(26.5, 27.3, t));  // one fist up: woo!
  P.fistR = whoa;
  // finish: realises he can't stop -> braces
  const panic = pulse(t, 39.6, BEAT.frontThr + 0.1, 0.3, 0.1);
  P.open = Math.max(P.open, 0.9 * panic); P.oShape = 0; P.browL = lerp(P.browL, 1, panic); P.browR = lerp(P.browR, 1, panic); P.lidL = P.lidR = lerp(P.lidL, -0.12, panic); P.teeth = panic > 0.3 ? 1 : P.teeth;
  const brace = pulse(t, BEAT.frontThr, BEAT.carStop, 0.1, 0.3);
  P.blink = Math.max(P.blink, 0.95 * brace); P.teeth = brace > 0.3 ? 1 : P.teeth; P.open = Math.max(P.open, 0.4 * brace); P.smile = lerp(P.smile, -0.3, brace); P.lean -= 0.12 * brace;
  P.headBack -= 0.15 * brace;
  // scene 7: cheering with both fists
  const cheer = pulse(t, BEAT.cheer, BEAT.click, 0.4, 0.05) + (sm(BEAT.click, BEAT.click + 0.02, t) * (1 - sm(50.9, 52.0, t)));
  const bounce = Math.abs(Math.sin((t - BEAT.cheer) * 6.5)) * pulse(t, BEAT.cheer, BEAT.click, 0.3, 0.02);
  P.handL = P.handL.clone().lerp(V3(0.08, 0.6 + 0.07 * bounce, -0.3), cheer);
  P.handR = P.handR.clone().lerp(V3(0.08, 0.6 + 0.07 * bounce, 0.28), cheer);
  P.fistL = Math.max(P.fistL, cheer); P.fistR = Math.max(P.fistR, cheer);
  const happy = pulse(t, BEAT.cheer, BEAT.click, 0.4, 0.05);
  P.open = lerp(P.open, 1, happy); P.teeth = happy > 0.3 ? 1 : P.teeth; P.smile = lerp(P.smile, 1, happy);
  P.lidL = P.lidR = lerp(P.lidL, 0.45, happy); P.lowL = P.lowR = lerp(P.lowL, 0.35, happy); P.browL = lerp(P.browL, 0.8, happy); P.browR = lerp(P.browR, 0.8, happy);
  P.headBack += -0.1 * happy + 0.05 * bounce; P.hairBounce += 0.5 * bounce;
  // click: freeze. Then the slow head turn and the stare
  const frozen = sm(BEAT.click, BEAT.click + 0.08, t);
  if (frozen > 0) {
    P.open = lerp(P.open, 0, frozen); P.teeth = 0; P.smile = lerp(P.smile, 0.0, frozen);
    P.lidL = P.lidR = lerp(P.lidL, -0.12, frozen); P.lowL = P.lowR = lerp(P.lowL, 0.0, frozen);
    P.browL = lerp(P.browL, 0.35, frozen); P.browR = lerp(P.browR, 0.35, frozen);
    const turn = sm(BEAT.turn, BEAT.turn + 1.3, t);
    P.headYaw = 1.05 * turn; P.gaze = V3(1, -0.05, -1.3 * turn).normalize(); P.twist = 0.15 * turn;
    P.headPitch = -0.04 * turn;
  }
  // "Wait... who let you in?": mouth follows the line, brows knit
  const L = (a, b) => pulse(t, a, b, 0.04, 0.06);
  const talk = Math.max(L(52.6, 52.98) * (0.6 + 0.4 * Math.abs(Math.sin((t - 52.6) * 18))), L(53.66, 54.75) * (0.35 + 0.65 * Math.abs(Math.sin((t - 53.66) * 15))));
  P.open = Math.max(P.open, talk * 0.75); P.oShape = Math.max(P.oShape, 0.5 * L(53.66, 53.85));
  const confused = sm(52.4, 52.9, t);
  P.browIn = lerp(P.browIn, 0.7, confused); P.browL = lerp(P.browL, 0.9, confused); P.browR = lerp(P.browR, -0.3, confused); P.headRoll = 0.12 * confused;
  P.lidL = lerp(P.lidL, 0.2, confused);
  // blinks
  const bt = (t * 0.29 + 0.3) % 1;
  if (bt > 0.975 && !(t > BEAT.click && t < 52.4)) P.blink = Math.max(P.blink, Math.sin((bt - 0.975) / 0.025 * Math.PI));
  return P;
}

// live positions reported by the scene (e.g. the cheetah's head after posing)
export const probe = { cheetahHead: null };

// ------------------------------------------------------------------ camera
// Shots are functions of t returning {pos, look, fov}; consecutive shots are
// cross-faded with smooth weights. All positions are world space.
function vec(a) { return V3(a[0], a[1], a[2]); }

function sideTrack(t, focusX, focusZ, dist, height, lookY = 0.55, lead = 0) {
  // camera on the +z side looking at the action, slightly from above
  return { pos: V3(focusX + lead, height, focusZ + dist), look: V3(focusX + lead, lookY, focusZ) };
}

function smoothFocus(fn, t, span = 0.35, n = 7) {
  // temporal smoothing of a focus point to remove jitter
  const acc = V3(0, 0, 0);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const o = (i / (n - 1) - 0.5) * 2 * span;
    const w = Math.exp(-((o / span) ** 2) * 2);
    acc.addScaledVector(fn(t + o), w); wsum += w;
  }
  return acc.multiplyScalar(1 / wsum);
}

const carP = (t) => { const c = carWorld(t); return V3(c.x, 0.6 + c.y, c.z); };
const chP = (t) => { const c = cheetahWorld(t); return V3(c.x, 0.5 + c.y, c.z); };

// Side-tracking geometry for the vertical frame: camera ~18 m from the far
// lane and 3.2 m up, so the car fills ~2/3 of the width, the cut-open soil
// shows in the bottom quarter and the subtitle band (~40%) stays over the
// background.
const TRACK = { dist: 16.4, h: 3.2, lookY: 1.38, fov: 38 };
function track(fx, fz = -5.6, o = {}) {
  const g = { ...TRACK, ...o };
  return { pos: V3(fx + (g.lead || 0), g.h, fz + g.dist), look: V3(fx + (g.lead || 0), g.lookY, fz), fov: g.fov };
}
const mixShot = (a, b, w) => ({ pos: a.pos.clone().lerp(b.pos, w), look: a.look.clone().lerp(b.look, w), fov: lerp(a.fov, b.fov, w) });

// aim: a look-at point that puts world point S at normalised screen position
// (sx, sy) - (0,0) is the top-left corner - for a camera at pos. Used to keep
// the action below the subtitle band (~36-44% of the height).
const ASPECT = 9 / 16, UP = V3(0, 1, 0);
// debug overrides for framing tests (browser only)
const DBG = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
function aim(pos, S, sx, sy, fov) {
  const ty = Math.tan(THREE.MathUtils.degToRad(fov) / 2), tx = ty * ASPECT;
  const ax = (sx - 0.5) * 2 * tx, ay = (0.5 - sy) * 2 * ty;
  const d = S.clone().sub(pos).normalize();
  let f = d.clone();
  for (let i = 0; i < 5; i++) {
    const r = f.clone().cross(UP).normalize(), u = r.clone().cross(f);
    const k = d.dot(f);
    f = d.clone().addScaledVector(r, -ax * k).addScaledVector(u, -ay * k).normalize();
  }
  return pos.clone().add(f.multiplyScalar(S.distanceTo(pos)));
}
const framed = (pos, S, sx, sy, fov) => ({ pos, look: aim(pos, S, sx, sy, fov), fov });
// hard cuts sit half-way between two frames so no frame's shutter straddles one
const cutT = (x) => (Math.round(x * 30) + 0.5) / 30;

const SHOTS = [
  // 0: opening - wide establishing push-in at the start line, then a closer two-shot
  { a: -1, b: 4.35, fn: (t) => {
    const e = sm(0, 2.6, t);
    const wide = { pos: V3(lerp(-1.4, -1.5, e), lerp(5.6, 3.4, e), lerp(19.5, 13.0, e)), look: V3(-1.5, lerp(1.25, 1.15, e), -5.5), fov: lerp(40, 38, e) };
    const two = { pos: V3(-1.75, 1.55, 3.6), look: V3(-1.7, 0.92, -5.4), fov: 32 };
    return mixShot(wide, two, sm(2.2, 3.3, t));
  } },
  // 1: launch & side-by-side race: track the pair
  { a: 4.35, b: 7.6, fn: (t) => {
    const f = smoothFocus((x) => carP(x).lerp(chP(x), 0.35), t, 0.3);
    return track(f.x, -5.6, { lead: 0.6 });
  } },
  // 2: tyres spin (show the rooster tails behind the car), then rise for the fan arrows
  { a: 7.6, b: 14.0, fn: (t) => {
    const f = smoothFocus(carP, t, 0.45);
    const up = sm(11.3, 12.3, t);
    return track(f.x, -5.6, { lead: lerp(-0.9, -0.2, up), h: lerp(3.2, 4.0, up), lookY: lerp(1.38, 1.9, up), dist: lerp(16.4, 15.6, up) });
  } },
  // 3: grip - the car rockets after the cheetah; the camera hands over to the
  //    cheetah as the narration turns to its cornering trick
  { a: 14.0, b: 16.6, fn: (t) => {
    const f = smoothFocus((x) => carP(x).lerp(chP(x), sm(14.9, 16.1, x)), t, 0.3);
    return track(f.x, -5.6, { lead: lerp(0.4, -0.6, sm(15.4, 16.4, t)) });
  } },
  // 4: the corner - push in high and in front of the cheetah so the tail
  //    rudder reads, whip back to the car sliding wide to the cliff edge, hold
  //    while the side thrusters shove it back onto the track
  { a: 16.6, b: 21.6, fn: (t) => {
    const ch = smoothFocus(chP, t, 0.22), cr = smoothFocus(carP, t, 0.35);
    const entry = track(ch.x, -5.6, { lead: -0.6 });
    const A = framed(ch.clone().add(V3(1.4, 3.9, 5.8)), ch, 0.5, 0.63, 36);
    const B = framed(V3(cr.x + 5.6, 5.4, 9.6), cr, 0.45, 0.64, 40);
    return mixShot(mixShot(entry, A, sm(16.6, 17.15, t)), B, sm(17.75, 18.4, t));
  } },
  // 5: river - track the cheetah through its leap (it stays sharp, the
  //    water's cut face shows below), pan back to the car braking at the bank,
  //    then crane with the car through the slow-motion flip
  { a: 21.6, b: cutT(30.6), fn: (t) => {
    const ch = smoothFocus(chP, Math.min(t, 24.3), 0.25);
    const A = framed(V3(ch.x + 0.4, 0.62 + 0.35 * Math.max(0, ch.y - 0.5), ch.z + 10.8), ch, 0.55, 0.58, 36);
    const cr = smoothFocus(carP, t, 0.45);
    const D = framed(V3(cr.x + 0.6, 2.2 + 0.85 * Math.max(0, cr.y - 0.6), cr.z + 16.2), cr, 0.5, 0.64, 38);
    return mixShot(A, D, sm(23.85, 24.4, t));
  } },
  // 6: (cut) the cheetah slows, the car zooms past, sly-grin close-up, zip
  { a: cutT(30.6), b: cutT(37.45), cut: true, fn: (t) => {
    const f = smoothFocus(chP, t, 0.5);
    const wide = track(f.x, -5.6, { lead: 0.9, dist: 15.5 });
    const cw = cheetahWorld(Math.min(t, BEAT.zip - 0.05));
    const hd = probe.cheetahHead && t < BEAT.zip ? probe.cheetahHead : V3(cw.x + 0.5, 0.9, cw.z);
    const back = sm(36.9, 37.3, t);
    const close = framed(V3(hd.x + lerp(0.45, 1.2, back), hd.y + lerp(0.42, 1.0, back), hd.z + lerp(2.35, 5.2, back)), hd.clone().add(V3(0, -0.25 * back, 0)), 0.5, 0.63, lerp(30, 36, back));
    return mixShot(wide, close, sm(35.25, 35.95, t));
  } },
  // 7: (cut) finish - low angle on the banner, kept below the subtitle band;
  //    pan with the car as it bursts through, then a chase framing that leaves
  //    room for the forward thruster blast
  { a: cutT(37.45), b: 45.6, cut: true, fn: (t) => {
    const fx = COURSE.FINISH;
    const banner = V3(fx, 3.05, -5.6);
    const cr = smoothFocus(carP, t, 0.3);
    const pan = sm(40.2, 40.8, t);
    const pW = V3(fx + 12.5, 2.3, 6.4);
    const wait = { pos: pW, look: aim(pW, banner.clone().lerp(cr, pan), lerp(0.5, 0.45, pan), lerp(0.58, 0.62, pan), lerp(42, 38, pan)), fov: lerp(42, 38, pan) };
    const chase = framed(V3(cr.x + 1.4, 3.1, cr.z + 15.5), cr, 0.4, 0.62, 38);
    return mixShot(wait, chase, sm(40.7, 41.6, t));
  } },
  // 8: the car has spun round and stopped backwards, passenger side to us.
  //    Dust clears; John cheers (seen across the empty passenger seat); the
  //    stowaway sits up into the foreground - click - John turns and stares
  { a: 45.6, b: 60, fn: (t) => {
    const cw = carWorld(45.6);
    const h = cw.heading + cw.yaw;
    const fwd = V3(Math.cos(h), 0, -Math.sin(h)), right = V3(Math.sin(h), 0, Math.cos(h));
    const L = (x, y, z) => V3(cw.x, 0, cw.z).addScaledVector(fwd, x).addScaledVector(right, z).add(V3(0, y, 0));
    const wide = { pos: L(-0.6, 2.6, -13.5), look: L(-0.4, 0.75, 0), fov: 38 };
    const johnH = L(-0.4, 0.89, 0.42), chH = L(-0.3, 0.95, -0.42);
    const push = sm(46.0, 49.8, t);
    const cheer = framed(L(lerp(1.75, 1.55, push), 1.52, lerp(-2.3, -2.12, push)), johnH, 0.44, 0.6, 35);
    const mid = johnH.clone().lerp(chH, 0.5);
    const push2 = sm(49.9, 55.5, t);
    let rv = [lerp(1.55, 1.42, push2), lerp(1.5, 1.47, push2), lerp(-2.12, -2.0, push2)], rvs = [0.5, 0.6, 35];
    if (DBG && DBG.get('rv')) rv = DBG.get('rv').split(',').map(Number);
    if (DBG && DBG.get('rvs')) rvs = DBG.get('rvs').split(',').map(Number);
    const reveal = framed(L(...rv), mid, rvs[0], rvs[1], rvs[2]);
    const s1 = mixShot(wide, cheer, sm(46.0, 47.4, t));
    return mixShot(s1, reveal, sm(49.55, 50.4, t));
  } },
];

export function cameraAt(t) {
  // weights: each shot fades in/out over 0.6 s around its bounds
  const FADE = 0.55;
  let pos = V3(0, 0, 0), look = V3(0, 0, 0), fov = 0, wsum = 0;
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i], nx = SHOTS[i + 1];
    const win = s.cut ? (t >= s.a ? 1 : 0) : sm(s.a - FADE, s.a, t);
    const wout = nx && nx.cut ? (t < s.b ? 1 : 0) : 1 - sm(s.b, s.b + FADE, t);
    const w = win * wout;
    if (w <= 1e-4) continue;
    const c = s.fn(t);
    pos.addScaledVector(c.pos, w); look.addScaledVector(c.look, w); fov += c.fov * w; wsum += w;
  }
  pos.multiplyScalar(1 / wsum); look.multiplyScalar(1 / wsum); fov /= wsum;
  // subtle handheld drift + rumble when thrusters fire
  const cs = carState(t);
  const rumble = 0.03 * (cs.thrBack + cs.thrFront + cs.thrSide) + 0.012 * cs.spin;
  pos.x += 0.02 * Math.sin(t * 0.7) + rumble * Math.sin(t * 61);
  pos.y += 0.015 * Math.sin(t * 0.9 + 1) + rumble * Math.sin(t * 53 + 2);
  return { pos, look, fov };
}
