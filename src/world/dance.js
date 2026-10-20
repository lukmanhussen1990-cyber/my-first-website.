// Her dance: smooth procedural curves, but SAMPLED at 12 fps (each pose held for
// 2-3 frames of the 30 fps film) so she moves wrong compared to everything else.
import { noise1 } from './util.js';

export const DANCE_FPS = 12;
export const quantize = (t) => Math.floor(t * DANCE_FPS + 1e-6) / DANCE_FPS;

const LIFT = 0.25; // a foot is in the air for 3 of her frames before each landing

function stepInfo(steps, t) {
  let lo = 0;
  let hi = steps.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid].t <= t) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const next = steps[idx + 1];
  const lift = next && next.t - t < LIFT ? { foot: next.foot, u: 1 - (next.t - t) / LIFT } : null;
  return { lift, landed: idx + 1, sinceLand: idx >= 0 ? t - steps[idx].t : 1 };
}

// Returns { pose, rootX, sway: [x, z], tilt, lean, phase }
export function dancePose(t, steps, { amp = 1, armAmp = 1, mode = 'free' } = {}) {
  const s = Math.sin;
  const ph = 2 * Math.PI * 0.72 * t;
  const sw = s(ph);
  const arm = s(ph - 0.9);
  const jerk = noise1(t * 2.3, 3) * 0.5;
  const st = stepInfo(steps, t);
  const impact = Math.exp(-st.sinceLand * 9);
  // head twitch: a sharp snap every ~2.2 s that decays over a few of her frames
  const tw = (t * 0.45) % 1;
  const twitch = (Math.floor(t * 0.45) % 2 ? 1 : -1) * Math.max(0, 1 - tw * 7) * 0.2;

  const P = {};
  let hipsX = 0.07 * sw * amp;
  const lift = st.lift;
  if (lift) hipsX += (lift.foot === 'L' ? -1 : 1) * 0.03 * s(Math.PI * lift.u); // weight onto the stance foot
  P.hips = { p: [hipsX, -0.02 * Math.abs(Math.cos(ph)) * amp - 0.018 * impact, 0], r: [0.04 * amp, 0.22 * s(ph * 0.5 + 0.3) * amp, 0.15 * s(ph + 0.3) * amp] };
  P.spine = { r: [0.05 + 0.04 * s(2 * ph) * amp, 0, -0.1 * s(ph + 0.8) * amp] };
  P.chest = { r: [0.02, -0.16 * s(ph * 0.5 + 0.4) * amp, -0.09 * s(ph + 1.4) * amp + jerk * 0.1 * amp] };
  // shoulders roll forward/back alternately
  P.shoulderL = { r: [0.35 * s(ph) * amp, 0, 0.06 * s(ph + 1)], p: [0, 0.022 * s(ph + 1.57) * amp, 0] };
  P.shoulderR = { r: [0.35 * s(ph + Math.PI) * amp, 0, -0.06 * s(ph + 1)], p: [0, 0.022 * s(ph + 1.57 + Math.PI) * amp, 0] };
  // loose arms swinging side to side together like pendulums, forearms flopping
  const aa = armAmp * amp;
  P.upperArmL = { r: [-0.18 - 0.16 * s(2 * ph + 0.5) * aa, 0.35 * s(ph - 1.2) * aa, 0.14 + 0.5 * arm * aa] };
  P.upperArmR = { r: [-0.18 - 0.16 * s(2 * ph + 2.0) * aa, 0.35 * s(ph - 1.2) * aa, -0.14 + 0.5 * arm * aa] };
  P.elbowL = { r: [-0.3 - 0.35 * (0.5 + 0.5 * s(ph - 1.8)) * aa, 0, 0] };
  P.elbowR = { r: [-0.3 - 0.35 * (0.5 + 0.5 * s(ph - 1.8 + Math.PI)) * aa, 0, 0] };
  P.handL = { r: [0.25 * s(ph - 2.2) * aa, 0, 0.5 * s(ph - 2.4) * aa] };
  P.handR = { r: [0.25 * s(ph - 2.2) * aa, 0, 0.5 * s(ph - 2.4) * aa] };
  // head tilted at an odd angle, chin down so the wide eyes look up at you
  P.neck = { r: [0.06, 0, 0.1 * sw * amp] };
  P.head = { r: [0.12 + 0.05 * s(2 * ph), 0.08 * s(ph * 0.5), 0.46 + 0.07 * s(ph * 0.5) + twitch] };
  if (mode === 'glass') P.head = { r: [0.26 + 0.03 * s(2 * ph), 0.05 * s(ph * 0.5), 0.36 + 0.05 * s(ph * 0.5) + twitch * 0.5] };

  // legs: slightly bent stance, small jerky off-beat steps
  const dip = 0.1 + 0.05 * Math.abs(Math.cos(ph)) + 0.08 * impact;
  P.thighL = { r: [-0.05 - dip * 0.5, 0, 0.04] };
  P.thighR = { r: [-0.05 - dip * 0.5, 0, -0.04] };
  P.kneeL = { r: [dip, 0, 0] };
  P.kneeR = { r: [dip, 0, 0] };
  P.footL = { r: [-dip * 0.5, 0, 0] };
  P.footR = { r: [-dip * 0.5, 0, 0] };
  if (lift) {
    const k = s(Math.PI * lift.u);
    const f = lift.foot;
    P['thigh' + f].r[0] -= 0.42 * k;
    P['knee' + f].r[0] += 0.85 * k;
    P['foot' + f].r[0] -= 0.35 * k;
  }
  // root shuffles a few cm side to side with each landing
  const side = (n) => (n % 2 ? 0.045 : -0.045);
  let rootX = side(st.landed);
  if (lift) rootX += (side(st.landed + 1) - side(st.landed)) * lift.u;

  const tilt = P.head.r[2] + P.neck.r[2] + P.chest.r[2] + P.spine.r[2] + P.hips.r[2];
  const lean = P.head.r[0] + P.neck.r[0] + P.spine.r[0];
  return { pose: P, rootX, sway: [-0.9 * hipsX + 0.035 * arm * amp, 0.03 * s(ph * 0.5) * amp], tilt, lean, phase: ph };
}

// Ring taps on the glass: finger angle for the tapping finger (0 = touching).
export function tapAngle(taps, t, finger) {
  let last = null;
  let next = null;
  for (const tap of taps) {
    if (tap.finger !== finger) continue;
    if (tap.t <= t) last = tap;
    else {
      next = tap;
      break;
    }
  }
  if (last && t - last.t < 0.09) return 0;
  if (next && next.t - t < 0.17) return -0.75 * ((next.t - t) / 0.17);
  return -0.75;
}
