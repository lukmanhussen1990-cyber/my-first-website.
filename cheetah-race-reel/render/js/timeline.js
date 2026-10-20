import { keys, spline, Integrated, clamp, smoothstep, lerp } from './util.js';

// Master timeline. Video time t (seconds, 30 fps) drives everything; world
// time tau runs slower during the river jump (slow motion). All event times
// below are VIDEO times taken from the voice-over word timings, converted to
// world time with W(t) where needed.

export const FPS = 30;
export const DURATION = 55.5;

// ---- time warp (dtau/dt): slow motion for the river jump
const kSlow = (t) => keys([[0, 1], [25.45, 1], [25.95, 0.26, 'inOut'], [28.95, 0.26], [29.6, 1, 'inOut']], t);
const warp = new Integrated(kSlow, 0, 70, 1 / 1200, 0);
export const W = (t) => warp.at(t);
export const slowFactor = kSlow;

// ---- key beats (video time)
export const BEAT = {
  flagDrop: 4.45, launch: 4.75, bog: 6.7, sortOf: 7.0,
  fanOn: 11.65, press: 12.7, grip: 13.95,
  chTurn: 17.25, carSlide: 17.9, sideThr: 19.45, sideThrEnd: 20.7,
  chLeap: 22.95, carBrake: 23.4, backThr: 24.85, carLaunch: 25.3, land: 29.62,
  chSlow: 31.4, chStop: 35.0, sly: 35.6, zip: 36.85,
  swish: 37.55, finishCross: 40.5, frontThr: 41.75, carStop: 44.0,
  cheer: 46.0, click: 49.85, turn: 50.15, musicStop: 52.0, johnLine: 52.45, end: 55.5,
};
const Wb = (k) => W(BEAT[k]);

// ---- cheetah speed along the course (world time)
const chV = (u) => keys([
  [0, 0], [4.75, 0], [5.55, 11.5, 'out'], [8.4, 11.5], [9.2, 7.2], [14.0, 7.2], [15.2, 11.5],
  [Wb('chTurn') - 0.25, 11.5], [Wb('chTurn') + 0.2, 9.6], [Wb('chTurn') + 0.9, 11.2], [22.5, 11.6], [23.6, 12.5], [24.3, 11.5],
  [W(31.4), 11.5], [W(33.6), 3.6, 'inOut'], [W(35.0), 0, 'inOut'],
  [W(36.85), 0], [W(37.05), 26, 'in'], [W(38.5), 26],
], u);
export const sCheetah = new Integrated(chV, 0, 70, 1 / 600, -0.75);
export const vCheetah = chV;

// ---- car speed along the course (world time)
const carV = (u) => keys([
  [0, 0], [4.75, 0], [5.3, 13, 'out'], [6.55, 13], [7.35, 3.3, 'inOut'], [13.95, 3.3], [14.75, 28.5, 'in'], [15.95, 28.5],
  [16.75, 11.6, 'out'], [Wb('carSlide') - 0.1, 11.8], [Wb('carSlide') + 1.0, 9.0], [Wb('sideThr') + 0.6, 9.5], [Wb('sideThrEnd') + 0.4, 12.0],
  [Wb('carBrake'), 11.5], [Wb('carBrake') + 0.62, 0.4, 'out'], [Wb('backThr') + 0.05, 0.4], [Wb('carLaunch'), 11.0, 'in'],
  [W(BEAT.land), 11.0], [W(31.2), 15.0], [W(33.4), 22.0], [W(36.0), 29.0, 'in'], [W(40.5), 30.0],
  [W(41.85), 28.0], [W(44.0), 0.0, 'out'],
], u);
export const sCar = new Integrated(carV, 0, 70, 1 / 600, -2.3);
export const vCar = carV;

// stations derived from the choreography (course features are placed here)
export const STATION = {
  start: 0,
  // the bend begins where the cheetah starts its turn
  corner: sCheetah.at(Wb('chTurn')),
  // river: the cheetah takes off 5.5 m before the river centre
  river: sCheetah.at(Wb('chLeap')) + 5.5,
  finish: sCar.at(Wb('finishCross')),
  carStop: sCar.at(Wb('carStop')),
};

export function describe() {
  const out = [];
  for (const [k, t] of Object.entries(BEAT)) {
    const u = W(t);
    out.push(`${k.padEnd(12)} t=${t.toFixed(2)} tau=${u.toFixed(2)} cheetah s=${sCheetah.at(u).toFixed(1)} v=${chV(u).toFixed(1)}  car s=${sCar.at(u).toFixed(1)} v=${carV(u).toFixed(1)}`);
  }
  out.push(JSON.stringify(STATION));
  return out.join('\n');
}

// ======================================================================
// Per-frame states. Everything below is a pure function of video time t.
// ======================================================================
const k = (list, t) => keys(list, t);
const sm = smoothstep;
const pulse = (t, a, b, ra = 0.2, rb = 0.2) => sm(a - ra, a, t) * (1 - sm(b, b + rb, t));

// wheel angle: integrate the wheel spin rate (rad/s) over world time
const wheelOmega = (u) => {
  const roll = carV(u) / 0.365;
  const spin = k([[0, 0], [6.6, 0], [7.2, 1, 'out'], [13.95, 1], [14.5, 0]], u); // sand: wheels spin hard
  return lerp(roll, Math.max(roll, 34), spin);
};
const wheelAngle = new Integrated(wheelOmega, 0, 70, 1 / 600, 0);
// gait phase of the cheetah (strides): frequency rises with speed
const strideF = (u) => { const v = chV(u); return v < 0.2 ? 0 : 1.15 + 0.12 * v; };
const chPhase = new Integrated(strideF, 0, 70, 1 / 600, 0);
// fan rotor angle
const fanW = (u) => (u > Wb('fanOn') ? 60 * sm(Wb('fanOn'), Wb('fanOn') + 0.8, u) : 0);
const fanAngle = new Integrated(fanW, 0, 70, 1 / 600, 0);

export function carState(t) {
  const u = W(t);
  const s = sCar.at(u), v = carV(u);
  // lateral offset (positive = toward the camera / outside of the left bend)
  const d = k([[0, -1.6], [BEAT.sideThrEnd, -1.6], [BEAT.sideThrEnd + 0.8, 0.6, 'inOut'], [BEAT.chLeap, -1.2], [BEAT.carBrake, -0.6], [BEAT.carLaunch, -0.5], [BEAT.land + 1, -1.0], [33, -0.3], [36, -0.6]], t);
  // drift angle: the rear swings out in the corner, then thrusters pull it straight
  let yaw = k([[0, 0], [BEAT.carSlide, 0], [BEAT.carSlide + 0.7, 0.55, 'out'], [BEAT.sideThr, 0.42], [BEAT.sideThrEnd, -0.12, 'inOut'], [BEAT.sideThrEnd + 0.7, 0, 'inOut']], t);
  // fishtail while the tyres spin in the sand
  yaw += 0.07 * Math.sin(u * 5.1) * pulse(t, 7.2, 13.8, 0.5, 0.3);
  // skid at the finish: the thrusters bite, the tail steps out and the car
  // spins a full half turn, stopping backwards in its own sand cloud
  yaw += k([[0, 0], [BEAT.frontThr, 0], [BEAT.frontThr + 0.6, -0.22, 'out'], [42.75, -0.75, 'in'], [BEAT.carStop, -Math.PI, 'out']], t);
  // body motion: squat on launch, dive on braking, roll in the bend, fan press
  const acc = (carV(u + 0.05) - carV(u - 0.05)) / 0.1;
  let pitch = clamp(-acc * 0.004, -0.06, 0.06) * (1 - pulse(t, BEAT.carLaunch - 0.1, BEAT.land, 0.05, 0.1));
  const roll = 0.08 * pulse(t, BEAT.carSlide + 0.2, BEAT.sideThrEnd - 0.2, 0.4, 0.4) - 0.04 * pulse(t, BEAT.sideThr, BEAT.sideThrEnd, 0.15, 0.3);
  const press = k([[0, 0], [BEAT.press - 0.1, 0], [BEAT.press + 0.35, 1, 'out'], [BEAT.end, 1]], t);
  let heave = -0.045 * press + 0.012 * Math.sin(u * 23) * pulse(t, 7.2, 13.9, 0.3, 0.3);
  // river jump: parabola + full backflip, all in world time
  const uL = Wb('carLaunch'), uG = W(BEAT.land);
  let y = 0, flip = 0;
  if (u > uL - 0.01 && u < uG + 0.4) {
    const a = clamp((u - uL) / (uG - uL), 0, 1);
    y = 3.1 * 4 * a * (1 - a) + 0.25 * Math.sin(Math.PI * a);
    const e = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
    flip = e * Math.PI * 2;
    // landing bounce
    if (u > uG) heave += -0.07 * Math.sin(Math.min(1, (u - uG) / 0.4) * Math.PI);
  }
  const steer = clamp(-yaw * 0.9, -0.5, 0.5) + 0.25 * pulse(t, BEAT.carSlide - 0.3, BEAT.carSlide + 0.4, 0.2, 0.2);
  return {
    s, v, d, yaw, pitch: pitch, roll, heave, y, flip, steer,
    wheel: wheelAngle.at(u), fan: sm(BEAT.fanOn - 0.2, BEAT.fanOn + 0.4, t), fanAngle: fanAngle.at(u),
    spin: pulse(t, 6.75, 13.95, 0.3, 0.25), // tyres spinning in sand
    thrBack: pulse(t, BEAT.backThr, BEAT.carLaunch + 1.9, 0.12, 0.9),
    thrSide: pulse(t, BEAT.sideThr, BEAT.sideThrEnd, 0.1, 0.35),
    thrFront: pulse(t, BEAT.frontThr, 42.8, 0.1, 0.45),
    brake: pulse(t, BEAT.carBrake, BEAT.backThr, 0.05, 0.1) + pulse(t, BEAT.frontThr, BEAT.carStop + 0.5, 0.05, 0.4),
  };
}

export function cheetahState(t) {
  const u = W(t);
  const s = sCheetah.at(u), v = chV(u);
  const d = k([[0, 1.9], [BEAT.chTurn - 0.6, 1.9], [BEAT.chTurn + 0.3, -0.6, 'inOut'], [BEAT.chTurn + 1.4, 0.8, 'inOut'], [BEAT.chTurn + 3.0, 1.9, 'inOut'],
    [BEAT.chLeap, 1.6], [31, 1.9], [BEAT.chStop, 2.6, 'inOut'], [BEAT.zip, 2.6]], t);
  // leap over the river (world time)
  const uL = Wb('chLeap'), dur = 0.78;
  let y = 0, leap = 0;
  if (u > uL && u < uL + dur) { const a = (u - uL) / dur; y = 1.45 * 4 * a * (1 - a); leap = Math.sin(Math.PI * a); }
  return {
    s, v, d, y, leap, phase: chPhase.at(u) % 1, leapA: clamp((u - uL) / dur, 0, 1),
    visible: t < BEAT.zip + 0.6,
  };
}
