import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from './util.js';

// Gait and expression generators for the cheetah. Each returns a full pose.
const fract = (x) => x - Math.floor(x);

// rotary-ish gallop: phase in [0,1), speed in m/s
export function gallop(P, phase, speed, amt = 1) {
  const f = Math.cos(TAU * (phase - 0.38));            // +1 gathered, -1 extended
  P.spineFlex = lerp(P.spineFlex, f * 0.9, amt);
  P.bodyY = lerp(P.bodyY, 0.03 * Math.cos(TAU * 2 * (phase - 0.4)) + 0.02, amt);
  P.bodyPitch = lerp(P.bodyPitch, 0.07 * Math.sin(TAU * (phase - 0.15)), amt);
  const strideF = 2.2 + 0.06 * speed;
  const reach = clamp(speed * 0.3 / strideF, 0.15, 0.8);
  const legs = { HL: [0.0, -0.31, 0.3], HR: [0.07, -0.31, 0.3], FL: [0.5, 0.3, 0.3], FR: [0.57, 0.3, 0.3] };
  for (const [k, [off, x0, beta]] of Object.entries(legs)) {
    const psi = fract(phase - off);
    const L = P.legs[k];
    const front = k[0] === 'F';
    let x, y, foot;
    if (psi < beta) {
      const s = psi / beta;
      x = x0 + reach * (0.5 - s);
      y = 0;
      foot = front ? lerp(-0.25, 0.55, s) : lerp(0.15, 0.85, s);
    } else {
      const s = (psi - beta) / (1 - beta);
      const e = s * s * (3 - 2 * s);
      x = x0 + reach * (-0.5 + e * 1.15) + (front ? 0.12 : 0.18) * Math.sin(Math.PI * s);
      y = (front ? 0.2 : 0.17) * Math.sin(Math.PI * Math.min(1, s * 1.15)) * (0.6 + 0.4 * clamp(speed / 10, 0, 1));
      foot = front ? lerp(1.4, -0.3, e) : lerp(1.2, 0.2, e);
    }
    L.x = lerp(L.x, x, amt); L.y = lerp(L.y, y, amt); L.foot = lerp(L.foot, foot, amt);
  }
  P.tailUp = lerp(P.tailUp, 0.25 + 0.12 * Math.sin(TAU * phase), amt);
  P.tailWave = lerp(P.tailWave, 0.1, amt);
  P.tailCurl = lerp(P.tailCurl, 0.3, amt);
  P.headPitch = lerp(P.headPitch, -0.05, amt);
  P.earsBack = lerp(P.earsBack, 0.5, amt);
  return P;
}

export function crouch(P, t, amt = 1) {
  P.crouch = lerp(P.crouch, 1, amt);
  P.spineFlex = lerp(P.spineFlex, 0.25, amt);
  P.legs.FL.x = lerp(P.legs.FL.x, 0.42, amt); P.legs.FR.x = lerp(P.legs.FR.x, 0.44, amt);
  P.legs.HL.x = lerp(P.legs.HL.x, -0.2, amt); P.legs.HR.x = lerp(P.legs.HR.x, -0.18, amt);
  P.legs.HL.foot = lerp(P.legs.HL.foot, 1.0, amt); P.legs.HR.foot = lerp(P.legs.HR.foot, 1.0, amt);
  P.neckLift = lerp(P.neckLift, -0.6, amt); P.neckFwd = lerp(P.neckFwd, 0.6, amt);
  P.headPitch = lerp(P.headPitch, 0.1, amt);
  P.tailUp = lerp(P.tailUp, 0.45, amt); P.tailCurl = lerp(P.tailCurl, 0.15, amt);
  // the little butt wiggle before the pounce
  P.bodyRoll = lerp(P.bodyRoll, 0.04 * Math.sin(t * 14), amt);
  P.tailSide = lerp(P.tailSide, 0.25 * Math.sin(t * 3.3), amt);
  P.lowL = P.lowR = lerp(P.lowL, 0.3, amt);
  P.earsPerk = lerp(P.earsPerk, 1, amt);
  return P;
}

export function poseFor(name, t, P) {
  if (name === 'stand') return P;
  if (name === 'crouch') return crouch(P, t);
  if (name.startsWith('gallop')) { const ph = +(name.split('_')[1] || 0); return gallop(P, ph, 10); }
  if (name === 'pant') {
    P.mouthOpen = 1; P.tongue = 1; P.breath = 0.06 * Math.sin(t * 9);
    P.lidL = P.lidR = 0.3; P.headPitch = -0.12; P.neckLift = -0.2; P.earsBack = 0.3;
    return P;
  }
  if (name === 'sly') {
    P.lidL = P.lidR = 0.55; P.lowL = P.lowR = 0.35; P.browL = 0.9; P.browR = -0.4; P.grin = 1; P.grinSide = 0.6;
    P.headYaw = 0.35; P.headRoll = 0.12; P.gaze = new THREE.Vector3(1, 0.05, 0.5); P.earsPerk = 1;
    return P;
  }
  if (name === 'sit') {
    P.sit = 1; P.glasses = 1; P.mouthOpen = 1; P.tongue = 1;
    for (const k of ['HL', 'HR']) { P.legs[k].x = 0.25; P.legs[k].y = 0.05; P.legs[k].foot = 1.2; }
    for (const k of ['FL', 'FR']) { P.legs[k].x = 0.25; P.legs[k].y = 0.3; P.legs[k].foot = 0.8; }
    return P;
  }
  return P;
}
