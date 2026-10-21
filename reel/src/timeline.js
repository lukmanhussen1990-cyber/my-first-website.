// Master timeline shared by the 3D renderer (browser) and the audio generator (via tools/dump_timeline.mjs).
// Every visual event and every sound effect is derived from the numbers in this file, so they stay in sync.

export const FPS = 30;
export const DURATION = 66.0;
export const FRAMES = Math.round(DURATION * FPS);

export const SCENES = [
  { id: 1, start: 0.0, end: 6.6, name: 'Golden-hour backyard' },
  { id: 2, start: 6.6, end: 13.4, name: 'Generator' },
  { id: 3, start: 13.4, end: 20.2, name: 'Gears' },
  { id: 4, start: 20.2, end: 26.8, name: 'Battery' },
  { id: 5, start: 26.8, end: 33.4, name: 'Snack on a rod' },
  { id: 6, start: 33.4, end: 40.4, name: 'Storm and blackout' },
  { id: 7, start: 40.4, end: 46.4, name: 'Cables to every house' },
  { id: 8, start: 46.4, end: 53.0, name: 'Water cooling' },
  { id: 9, start: 53.0, end: 59.6, name: 'Slow-motion hero run' },
  { id: 10, start: 59.6, end: 66.0, name: 'The twist' },
];

// Named moments (seconds).
export const E = {
  // scene 1
  standPop: 0.3, wheelPop: 0.5, johnHop: 1.45, stretch: 2.05, sweatband: 2.95, runStart: 3.75,
  // scene 2
  genBase: 8.85, genHousing: 9.0, genCoil: 9.15, genMagnet: 9.3, genPulley: 9.45,
  beltWhip: 9.75, genSpin: 10.15, cableDigStart: 11.35, cableDigEnd: 12.55, dotsStart: 12.45,
  // scene 3
  dimBulb: 13.7, bigGear: 15.95, gearStand: 16.05, genSlide: 16.2, smallGear: 16.45, gearClick: 16.72,
  fastSpin: 16.85, dotsRush: 17.15, bulbBright: 17.6,
  // scene 4
  flickerStart: 20.3, batteryPop: 23.05, batteryLid: 23.2, batteryCable: 23.35, batteryFill: 23.7,
  batteryFull: 25.4, steady: 24.1,
  // scene 5
  tiredStart: 26.9, rodPole: 29.4, rodPop: 29.55, snackDrop: 29.72, eyesWide: 30.15, chase: 30.45,
  // scene 6
  stormStart: 33.4, thunder1: 33.95, windUp: 34.0, rainStart: 34.5, lightning: 36.0,
  blackoutStart: 36.4, blackoutEnd: 38.4, neighborsStart: 38.4,
  // scene 7
  faceStart: 40.4, digNeighbors: 43.15, digCity: 44.0, splitDots: 44.2,
  // scene 8
  smoke: 46.6, sparks: 47.3, coolTank: 49.15, coolPipes: 49.3, coolRadiator: 49.5, coolNozzle: 49.75,
  mist: 50.05, steam: 50.3, sparksEnd: 50.45,
  // scene 9
  slowIn: 52.9, flash1: 53.55, flash2: 54.85, flash3: 55.75, sweepBack: 55.6, relightStart: 56.2,
  relightEnd: 59.0, cheer: 57.9,
  // scene 10
  calm: 59.6, pushLiving: 61.6, remote: 62.55, tvOn: 62.72, drainStart: 63.0, drainEnd: 64.0,
  blackout2: 64.0, powerDown: 64.25, panToJohn: 64.2, stare: 65.0, end: 66.0,
};

// ---------- small math helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const ramp = (t, t0, t1) => smooth((t - t0) / (t1 - t0));
export const rampLin = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
export const easeOutCubic = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeInCubic = (t) => { t = clamp(t); return t * t * t; };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// Damped-spring "pop": 0 before t0, overshoots ~20% then settles to 1.
export function pop(t, t0, speed = 1) {
  const d = (t - t0) * speed;
  if (d <= 0) return 0;
  if (d > 1.2) return 1;
  return 1 - Math.exp(-d * 8.5) * Math.cos(d * 17.5);
}
// Smooth 0..1 that softly bounces when landing (for snapping into place).
export function snap(t, t0, dur = 0.35) {
  const u = (t - t0) / dur;
  if (u <= 0) return 0;
  if (u >= 1) {
    const d = (u - 1) * dur;
    return 1 + Math.exp(-d * 10) * Math.sin(d * 30) * 0.06;
  }
  return easeInCubic(u);
}

// Piecewise curve with smoothstep interpolation between keys ([t, v] pairs, sorted).
export function curve(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

// deterministic hash noise
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) { const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u) * 2 - 1; }

// ---------- curves ----------
// John's running speed (1 = normal jog). Real-time speed; slow motion is applied separately.
const RUN_KEYS = [
  [0, 0], [3.75, 0], [4.7, 1.0], [6.6, 1.0], [13.4, 0.95],
  // scene 4: speed changes -> flicker
  [20.3, 0.95], [20.75, 0.45], [21.25, 1.25], [21.7, 0.5], [22.15, 1.1], [22.6, 0.55], [23.0, 0.95],
  [26.8, 1.0],
  // scene 5: tired, then chase
  [27.4, 0.85], [29.0, 0.38], [30.4, 0.36], [31.2, 1.35], [33.4, 1.3],
  [36.0, 1.2], [40.4, 1.35], [46.4, 1.45],
  // scene 8: so fast it smokes
  [47.2, 1.9], [53.0, 2.0],
  [59.6, 1.6], [63.6, 1.4], [64.05, 1.25], [64.9, 0.0], [66, 0],
];
export const runSpeed = (t) => curve(RUN_KEYS, t);

// slow-motion rate (animation time per real second)
const RATE_KEYS = [[0, 1], [52.9, 1], [53.35, 0.26], [56.0, 0.26], [57.6, 1], [66, 1]];
export const timeRate = (t) => curve(RATE_KEYS, t);

// generator gear ratio (rotor turns per wheel turn, visual)
export const genRatio = (t) => lerp(2.2, 9.0, ramp(t, E.fastSpin, E.fastSpin + 0.5));

// storm amount 0..1, night amount 0..1
export const storm = (t) => curve([[0, 0], [33.4, 0], [35.3, 1], [59.6, 1], [61.0, 0.0], [66, 0]], t);
export const night = (t) => curve([[0, 0], [33.4, 0], [35.6, 1], [66, 1]], t);
export const wind = (t) => curve([[0, 0.12], [33.6, 0.15], [35.2, 1.0], [52.0, 1.0], [56, 0.85], [59.6, 0.8], [60.8, 0.1], [66, 0.08]], t);
export const rain = (t) => curve([[0, 0], [34.5, 0], [35.6, 1], [59.7, 1], [60.7, 0], [66, 0]], t);
export const wetness = (t) => curve([[0, 0], [34.6, 0], [37, 1], [66, 1]], t);

// Lightning flashes: [time, strength, isStrike]
export const FLASHES = [
  [35.25, 0.35, false], [36.0, 1.0, true], [36.09, 0.7, true], [36.17, 0.85, true], [37.6, 0.3, false],
  [39.3, 0.4, false], [42.1, 0.45, false], [45.4, 0.35, false], [48.2, 0.4, false],
  [53.55, 0.8, false], [54.85, 1.0, false], [55.75, 0.7, false], [58.3, 0.35, false],
];
export function flash(t) {
  let f = 0;
  for (const [ft, s] of FLASHES) {
    const d = t - ft;
    if (d >= 0 && d < 0.6) f = Math.max(f, s * Math.exp(-d * 9) * (0.75 + 0.25 * Math.cos(d * 70)));
  }
  return f;
}

// ---------- integrated quantities (precomputed) ----------
const STEP = 1 / 600;
const N = Math.ceil((DURATION + 1) / STEP);
const animT = new Float64Array(N);
const wheelA = new Float64Array(N);
const genA = new Float64Array(N);
const flowA = new Float64Array(N);
const WHEEL_W = 1.6; // rad/s at speed 1
(function integrate() {
  let at = 0, wa = 0, ga = 0, fa = 0;
  for (let i = 0; i < N; i++) {
    const t = i * STEP;
    animT[i] = at; wheelA[i] = wa; genA[i] = ga; flowA[i] = fa;
    const r = timeRate(t);
    const w = runSpeed(t) * WHEEL_W * r;
    at += r * STEP;
    wa += w * STEP;
    const genOn = ramp(t, E.genSpin - 0.1, E.genSpin + 0.4);
    ga += w * genRatio(t) * genOn * STEP;
    fa += flowSpeed(t) * r * STEP;
  }
})();
function sample(arr, t) {
  const x = clamp(t, 0, DURATION + 0.9) / STEP;
  const i = Math.floor(x); const f = x - i;
  return arr[i] + (arr[Math.min(i + 1, N - 1)] - arr[i]) * f;
}
export const animTime = (t) => sample(animT, t);
export const wheelAngle = (t) => sample(wheelA, t);
export const genAngle = (t) => sample(genA, t);
export const flowPos = (t) => sample(flowA, t);

// electricity dot speed along cables (units of cable length fraction per second)
export function flowSpeed(t) {
  const base = curve([[0, 0], [E.dotsStart, 0], [E.dotsStart + 0.4, 0.07], [E.dotsRush, 0.07], [E.dotsRush + 0.6, 0.42], [66, 0.42]], t);
  const run = runSpeed(t);
  return base * (0.35 + 0.65 * clamp(run / 1.0, 0, 1.6));
}
// number density of dots (0..1)
export const dotDensity = (t) => curve([[0, 0], [E.dotsStart, 0], [E.dotsStart + 0.6, 0.18], [E.dotsRush, 0.18], [E.dotsRush + 0.6, 1.0], [64.0, 1.0], [64.35, 0], [66, 0]], t);

// generator electrical output 0..1 (what the house would see without battery)
export function genPower(t) {
  const conn = ramp(t, E.cableDigEnd - 0.1, E.cableDigEnd + 0.3);
  const speedTerm = clamp(runSpeed(t) / 1.0, 0, 1.4);
  const gearTerm = lerp(0.12, 1.0, ramp(t, E.fastSpin, E.fastSpin + 0.6));
  return conn * clamp(speedTerm * speedTerm * gearTerm, 0, 1.2);
}
export const battery = (t) => curve([[0, 0], [E.batteryFill, 0], [E.batteryFull, 1], [E.drainStart, 1], [E.drainEnd, 0], [66, 0]], t);
export const batteryOn = (t) => ramp(t, E.batteryCable + 0.1, E.batteryCable + 0.45);

// House light level (0..1), with flicker driven by power before the battery exists
export function houseLight(t) {
  if (t >= E.blackout2) return 0;
  const raw = genPower(t);
  // flicker: lights follow generator power closely with little smoothing
  let lvl = clamp(raw, 0, 1);
  const bOn = batteryOn(t);
  lvl = lerp(lvl, 1.0, bOn);
  return lvl;
}

// City: per-block power. Blocks are indexed by an "order" value 0..1 (distance from power station).
export function cityPower(t, order) {
  const off1 = E.blackoutStart + order * (E.blackoutEnd - E.blackoutStart);
  const on1 = E.relightStart + order * (E.relightEnd - E.relightStart);
  const off2 = E.blackout2 + 0.05 + order * 0.45;
  if (t < off1) return 1;
  if (t < on1) return 1 - smooth((t - off1) / 0.18);
  if (t < off2) return smooth((t - on1) / 0.25);
  return 1 - smooth((t - off2) / 0.08);
}
// neighbors' houses (on the street) – they lose power with the city, then get John's power
export function neighborPower(t, order) {
  const off1 = E.blackoutStart + 0.6 + order * 0.8;
  const on1 = E.splitDots + 0.6 + order * 1.2;
  if (t < off1) return 1;
  if (t < on1) return 1 - smooth((t - off1) / 0.15);
  if (t < E.blackout2 + 0.02) return smooth((t - on1) / 0.25);
  return 0;
}

// ---------- discrete events for audio ----------
export function footstepTimes() {
  // a footstep each half run cycle; run phase = wheelAngle * k
  const out = [];
  const k = RUN_PHASE_PER_RAD;
  let prev = Math.floor(wheelAngle(0) * k * 2);
  for (let i = 1; i <= DURATION * 240; i++) {
    const t = i / 240;
    const cur = Math.floor(wheelAngle(t) * k * 2);
    if (cur !== prev && runSpeed(t) > 0.05) out.push([+t.toFixed(4), +clamp(runSpeed(t), 0, 2).toFixed(3), +timeRate(t).toFixed(3)]);
    prev = cur;
  }
  return out;
}
export const RUN_PHASE_PER_RAD = 0.87; // run cycles per radian of wheel rotation
