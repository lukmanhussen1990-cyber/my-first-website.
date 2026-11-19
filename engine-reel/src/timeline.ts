/**
 * ════════════════════════════════════════════════════════════════════════
 *  TIMELINE — the single source of truth for every beat in the reel.
 *
 *  • Every value here is in SECONDS of the voiceover (public/voiceover.mp3,
 *    41.17 s). Frames are derived automatically (30 fps).
 *  • Word timings were measured from the actual audio with Whisper
 *    (scripts/transcribe.py → scripts/whisper-words.raw.json) and then
 *    hand-refined against the waveform where Whisper merged words.
 *  • If you re-record the VO: re-run the transcription, then nudge the
 *    numbers below. Nothing else in the codebase hard-codes a time.
 * ════════════════════════════════════════════════════════════════════════
 */
import type { EaseName, V3 } from './lib/math';

// ── Output format ────────────────────────────────────────────────────────
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const VOICEOVER = {
  file: 'voiceover.mp3', // lives in /public
  durationSec: 41.17,
  volume: 1,
};

/** A short tail after the last word so the final beat can land. */
export const DURATION_SEC = 41.6;
export const DURATION_IN_FRAMES = Math.ceil(DURATION_SEC * FPS);
export const toFrame = (sec: number) => Math.round(sec * FPS);

// ── Measured word timings (reference) [word, start, end] ────────────────
export const WORDS: [string, number, number][] = [
  ['Every', 0.0, 0.34], ['time', 0.34, 0.5], ['you', 0.5, 0.66], ['turn', 0.66, 0.86],
  ['her', 0.86, 1.0], ['on,', 1.0, 1.34], ['she', 1.58, 1.7], ['goes', 1.7, 1.88],
  ['through', 1.88, 2.14], ['four', 2.14, 2.5], ['moves—', 2.5, 2.95], ['suck,', 3.3, 3.7],
  ['squeeze,', 3.95, 4.5], ['bang,', 4.65, 5.12], ['and', 5.25, 5.42], ['blow—', 5.45, 5.85],
  ['over', 6.05, 6.3], ['three', 6.3, 6.7], ['thousand', 6.7, 7.14], ['times', 7.14, 7.58],
  ['a', 7.58, 7.76], ['minute.', 7.76, 7.98], ['First,', 8.62, 8.98], ['the', 9.28, 9.4],
  ['piston', 9.4, 9.66], ['drops', 9.66, 9.98], ['down', 9.98, 10.32], ['and', 10.32, 10.58],
  ['sucks', 10.58, 10.82], ['a', 10.82, 11.08], ['fresh', 11.08, 11.34], ['mix', 11.34, 11.58],
  ['of', 11.58, 11.8], ['fuel', 11.8, 12.04], ['and', 12.04, 12.24], ['air', 12.24, 12.46],
  ['straight', 12.46, 12.92], ['into', 12.92, 13.18], ['the', 13.18, 13.34], ['chamber.', 13.34, 13.62],
  ['Except', 14.06, 14.38], ['that', 14.38, 14.74], ['mix', 14.74, 14.98], ["won't", 14.98, 15.2],
  ['do', 15.2, 15.44], ['much', 15.44, 15.62], ['on', 15.62, 15.78], ['its', 15.78, 15.92],
  ['own.', 15.92, 16.16], ['So', 16.54, 16.8], ['the', 16.92, 17.06], ['intake', 17.06, 17.42],
  ['valve', 17.42, 17.66], ['shuts,', 17.66, 18.02], ['and', 18.3, 18.42], ['the', 18.42, 18.54],
  ['piston', 18.54, 18.8], ['slams', 18.8, 19.28], ['upward', 19.28, 19.74], ['to', 19.74, 19.96],
  ['squeeze', 19.96, 20.3], ['it', 20.3, 20.5], ['tight', 20.5, 20.74], ['under', 20.74, 21.04],
  ['massive', 21.04, 21.5], ['pressure.', 21.5, 21.96], ['Then,', 22.42, 22.74], ['right', 22.8, 23.22],
  ['at', 23.22, 23.34], ['the', 23.34, 23.44], ['peak,', 23.44, 23.7], ['a', 24.02, 24.1],
  ['spark', 24.1, 24.38], ['plug', 24.38, 24.62], ['fires', 24.62, 25.06], ['and', 25.06, 25.36],
  ['triggers', 25.36, 25.6], ['a', 25.6, 25.86], ['tiny', 25.86, 26.24], ['bang,', 26.24, 26.68],
  ['blasting', 27.06, 27.34], ['the', 27.34, 27.6], ['piston', 27.6, 27.86], ['back', 27.86, 28.18],
  ['down', 28.18, 28.48], ['with', 28.48, 28.7], ['pure', 28.7, 29.04], ['force.', 29.04, 29.48],
  ['Finally,', 30.0, 30.44], ['the', 30.7, 30.78], ['exhaust', 30.78, 31.16], ['valve', 31.16, 31.42],
  ['opens,', 31.42, 31.84], ['and', 32.08, 32.18], ['the', 32.18, 32.28], ['piston', 32.28, 32.54],
  ['shoots', 32.54, 32.92], ['up', 32.92, 33.16], ['one', 33.16, 33.46], ['last', 33.46, 33.7],
  ['time', 33.7, 34.04], ['to', 34.04, 34.26], ['blow', 34.26, 34.46], ['all', 34.46, 34.78],
  ['the', 34.78, 34.92], ['leftover', 34.92, 35.22], ['fumes', 35.22, 35.58], ['out', 35.58, 35.86],
  ['the', 35.86, 36.0], ['tailpipe.', 36.0, 36.38], ['Without', 36.96, 37.14], ['a', 37.14, 37.3],
  ['good', 37.3, 37.44], ['suck,', 37.6, 37.8], ['squeeze,', 37.95, 38.5], ['bang,', 38.65, 39.0],
  ['and', 39.0, 39.12], ['blow,', 39.15, 39.5], ["you're", 39.78, 39.96], ['not', 39.96, 40.08],
  ['getting', 40.08, 40.32], ['anywhere.', 40.32, 40.82],
];

// ── Scenes ───────────────────────────────────────────────────────────────
export const SCENES = {
  hook: { start: 0.0, end: 3.15 }, //        "Every time you turn her on… four moves—"
  reveal: { start: 3.15, end: 8.45 }, //     "suck, squeeze, bang, and blow—over 3000 times a minute."
  intake: { start: 8.45, end: 16.4 }, //     "First, the piston drops down and sucks…"
  compression: { start: 16.4, end: 22.25 }, // "So the intake valve shuts…"
  combustion: { start: 22.25, end: 29.75 }, // "Then, right at the peak, a spark plug fires…"
  exhaust: { start: 29.75, end: 36.7 }, //   "Finally, the exhaust valve opens…"
  ending: { start: 36.7, end: DURATION_SEC }, // "Without a good suck, squeeze, bang, and blow…"
} as const;

// ── One-off events (all in seconds) ─────────────────────────────────────
export const EVENTS = {
  lightSnap: 3.15, //            moody red → bright studio (right before "suck")
  // intake
  airStreamStart: 10.3, //       "and sucks a fresh mix…"
  airStreamEnd: 13.25,
  fuelSprayStart: 11.0, //       "…fresh mix of fuel…"
  fuelSprayEnd: 12.55,
  lazyStart: 14.95, //           "won't do much on its own" → particles go limp
  lazyFull: 15.7,
  // compression
  compressionHeatStart: 16.4,
  // combustion
  sparkFire: 24.7, //            "fires" — spark arc for SPARK_FRAMES frames
  sparkFrames: 5,
  bang: 26.24, //                "bang" — fireball + camera kick
  bottomImpact: 27.62, //        piston bottoms out
  smokeForm: 26.75, //           fireball cools into gray fumes
  // exhaust
  exhaustExitStart: 31.55, //    fumes start leaving through the exhaust port
  exhaustExitEnd: 34.5,
  pipeTravelSec: 2.7, //         time for one fume puff to travel the exhaust pipe
  whipStart: 34.95, //           whip-pan from the exhaust pipe to the car
  whipCut: 35.25,
  whipEnd: 35.6,
  tailpipePuff: 36.0, //         "tailpipe" — big smoke ring
  // ending
  carGo: 37.0, //                car launches
  vroom: 37.05,
};

// ── Crankshaft choreography ─────────────────────────────────────────────
// Crank angle θ drives EVERYTHING mechanical (piston, rod, valves, cams).
// 0° = TDC at the start of intake. One 4-stroke cycle = 720°.
export const CRANK = {
  hookRevPerSec: 1.45, //   rhythmic pumping during the dark hook + early reveal
  spinUpStart: 5.7, //      "over three thousand times a minute" — accelerate…
  spinPeakAt: 6.6,
  peakRevPerSec: 4.6, //    on-screen max (higher just strobes at 30 fps)
  spinDownStart: 7.55, //   …then slow-mo into the first stroke
  stopAt: 8.55, //          parks exactly at TDC (auto-corrected)
  /**
   * Stroke keyframes after the park. `deg` is the angle within the 720° cycle.
   * `ease` shapes the motion INTO that key from the previous one.
   */
  strokes: [
    { t: 9.3, deg: 0 }, //                                 "First, the piston…"
    { t: 13.7, deg: 180, ease: 'inOutSine' }, //           INTAKE: drops down, sucks in mix
    { t: 17.5, deg: 180 }, //                              hold at BDC — "won't do much on its own"
    { t: 17.95, deg: 215, ease: 'outCubic' }, //           intake valve SNAPS shut ("shuts")
    { t: 18.72, deg: 215 },
    { t: 19.55, deg: 338, ease: 'inOutCubic' }, //         "slams upward"
    { t: 21.95, deg: 360, ease: 'outSine' }, //            "squeeze it tight under massive pressure"
    { t: 26.3, deg: 360 }, //                              parked at the peak for the spark
    { t: 27.62, deg: 540, ease: 'inCubic' }, //            POWER: blasted back down
    { t: 31.2, deg: 540 },
    { t: 31.65, deg: 575, ease: 'outCubic' }, //           exhaust valve pops open ("opens")
    { t: 32.4, deg: 575 },
    { t: 33.75, deg: 700, ease: 'inOutCubic' }, //         "shoots up one last time"
    { t: 34.8, deg: 720, ease: 'outSine' }, //             "…to blow all the leftover fumes"
  ] as { t: number; deg: number; ease?: EaseName }[],
};

// ── Camera ──────────────────────────────────────────────────────────────
// Orbit-style keys: the camera sits `dist` away from `target`, at azimuth
// `az` (0 = straight in front, + = to the right) and elevation `el` (deg).
// `ease` shapes the move INTO that key. Two keys with the same `t` = hard cut.
// `set: 'car'` → coordinates are relative to the car set; `follow: true`
// additionally rides along with the car.
export type CamKey = {
  t: number;
  target: V3;
  dist: number;
  az: number;
  el: number;
  fov: number;
  roll?: number;
  ease?: EaseName;
  set?: 'engine' | 'car';
  follow?: boolean;
};

export const CAMERA: CamKey[] = [
  // 1 · HOOK — tight, tilted, dark close-up on the "sleeve"
  { t: 0.0, target: [0, 0.92, 0.1], dist: 3.5, az: 52, el: -9, fov: 32, roll: -56 },
  { t: 3.15, target: [0, 0.95, 0.1], dist: 3.1, az: 44, el: -7, fov: 32, roll: -52, ease: 'inOutSine' },
  // 2 · REVEAL — whip back and orbit 35°
  { t: 4.35, target: [0, 1.6, 0], dist: 11.4, az: -6, el: 8, fov: 34, roll: 0, ease: 'outExpo' },
  { t: 8.3, target: [0, 1.65, 0], dist: 10.6, az: 5, el: 7, fov: 34, ease: 'inOutSine' },
  // 3 · INTAKE — cutaway front-and-center, slow push in
  { t: 9.25, target: [-0.5, 2.55, 0], dist: 6.6, az: -5, el: 5, fov: 34, ease: 'inOutCubic' },
  { t: 13.6, target: [-0.35, 2.3, 0], dist: 5.6, az: -2, el: 3, fov: 34, ease: 'inOutSine' },
  { t: 16.3, target: [-0.15, 2.1, 0], dist: 5.8, az: 3, el: 4, fov: 34, ease: 'inOutSine' },
  // 4 · COMPRESSION
  { t: 17.55, target: [-0.3, 2.45, 0], dist: 4.4, az: -5, el: 6, fov: 34, ease: 'inOutCubic' },
  { t: 18.7, target: [-0.28, 2.42, 0], dist: 4.3, az: -4, el: 6, fov: 34, ease: 'linear' },
  { t: 19.6, target: [0, 2.05, 0], dist: 5.6, az: 0, el: 3, fov: 34, ease: 'outCubic' },
  { t: 22.2, target: [0, 2.3, 0], dist: 3.7, az: 4, el: 4, fov: 34, ease: 'inOutSine' },
  // 5 · COMBUSTION — punch-in on the spark plug, blast pulls us back
  { t: 22.75, target: [0, 2.42, 0.05], dist: 2.05, az: 9, el: 6, fov: 30, ease: 'outExpo' },
  { t: 26.2, target: [0, 2.4, 0.05], dist: 1.8, az: 13, el: 5, fov: 30, ease: 'inOutSine' },
  { t: 26.95, target: [0, 1.85, 0], dist: 6.2, az: 0, el: 4, fov: 34, ease: 'outCubic' },
  { t: 29.7, target: [0.1, 1.75, 0], dist: 6.6, az: 6, el: 6, fov: 34, ease: 'inOutSine' },
  // 6 · EXHAUST — follow the fumes out along the pipe, then whip to the car
  { t: 30.9, target: [0.5, 2.4, 0], dist: 5.1, az: 6, el: 5, fov: 34, ease: 'inOutCubic' },
  { t: 33.3, target: [0.75, 2.45, 0], dist: 5.0, az: 4, el: 5, fov: 34, ease: 'inOutSine' },
  { t: 34.95, target: [5.2, 2.0, 0], dist: 4.2, az: 0, el: 3, fov: 34, ease: 'inOutCubic' },
  { t: 35.25, target: [9.8, 1.9, 0], dist: 4.2, az: 0, el: 3, fov: 34, ease: 'inQuad' },
  // ── hard cut (hidden by the whip blur) to the car set ──
  { t: 35.25, set: 'car', follow: true, target: [-2.6, 0.5, 2.2], dist: 2.8, az: 22, el: 7, fov: 32 },
  { t: 35.65, set: 'car', follow: true, target: [0.5, 0.42, 2.2], dist: 2.3, az: 26, el: 7, fov: 32, ease: 'outCubic' },
  { t: 36.9, set: 'car', follow: true, target: [0.45, 0.45, 2.15], dist: 2.05, az: 22, el: 8, fov: 32, ease: 'inOutSine' },
  // 7 · ENDING — pull back as the car takes off down the road
  { t: 38.5, set: 'car', follow: true, target: [0, 0.75, -0.5], dist: 9.5, az: 20, el: 13, fov: 34, ease: 'inOutCubic' },
  { t: DURATION_SEC, set: 'car', target: [0, 0.8, -28], dist: 36, az: 7, el: 10, fov: 34, ease: 'outSine' },
];

/** Decaying camera-shake impulses. amp in world units, freq in Hz. */
export const SHAKES = [
  { t: 3.15, amp: 0.05, decay: 7, freq: 18 }, //  light snap
  { t: 17.88, amp: 0.025, decay: 9, freq: 20 }, // valve snaps shut
  { t: 19.45, amp: 0.06, decay: 7, freq: 16 }, //  piston slams up
  { t: 26.24, amp: 0.2, decay: 4.5, freq: 21 }, // BANG
  { t: 27.62, amp: 0.08, decay: 7, freq: 17 }, //  piston bottoms out
  { t: 37.0, amp: 0.05, decay: 5, freq: 14 }, //   car launch
];

/** Continuous "pressure rumble" during the squeeze. */
export const PRESSURE_RUMBLE = { start: 19.9, end: 22.4, amp: 0.012 };

// ── Captions (2–4 words, pop-in) ────────────────────────────────────────
export const CAPTIONS: { text: string; start: number; end: number }[] = [
  { text: 'Every time you', start: 0.0, end: 0.66 },
  { text: 'turn her on,', start: 0.66, end: 1.55 },
  { text: 'she goes through', start: 1.58, end: 2.14 },
  { text: 'four moves—', start: 2.14, end: 3.25 },
  { text: 'suck, squeeze,', start: 3.3, end: 4.62 },
  { text: 'bang, and blow—', start: 4.65, end: 6.02 },
  { text: 'over three thousand', start: 6.05, end: 7.12 },
  { text: 'times a minute.', start: 7.14, end: 8.4 },
  { text: 'First, the piston', start: 8.62, end: 9.66 },
  { text: 'drops down', start: 9.66, end: 10.32 },
  { text: 'and sucks', start: 10.32, end: 10.82 },
  { text: 'a fresh mix', start: 10.82, end: 11.58 },
  { text: 'of fuel and air', start: 11.58, end: 12.46 },
  { text: 'straight into', start: 12.46, end: 13.18 },
  { text: 'the chamber.', start: 13.18, end: 13.95 },
  { text: 'Except that mix', start: 14.06, end: 14.98 },
  { text: "won't do much", start: 14.98, end: 15.62 },
  { text: 'on its own.', start: 15.62, end: 16.45 },
  { text: 'So the intake', start: 16.54, end: 17.42 },
  { text: 'valve shuts,', start: 17.42, end: 18.25 },
  { text: 'and the piston', start: 18.3, end: 18.8 },
  { text: 'slams upward', start: 18.8, end: 19.74 },
  { text: 'to squeeze it', start: 19.74, end: 20.5 },
  { text: 'tight under', start: 20.5, end: 21.04 },
  { text: 'massive pressure.', start: 21.04, end: 22.3 },
  { text: 'Then, right', start: 22.42, end: 23.22 },
  { text: 'at the peak,', start: 23.22, end: 23.98 },
  { text: 'a spark plug', start: 24.02, end: 24.62 },
  { text: 'fires and triggers', start: 24.62, end: 25.6 },
  { text: 'a tiny bang,', start: 25.6, end: 27.0 },
  { text: 'blasting the piston', start: 27.06, end: 27.86 },
  { text: 'back down', start: 27.86, end: 28.48 },
  { text: 'with pure force.', start: 28.48, end: 29.9 },
  { text: 'Finally, the exhaust', start: 30.0, end: 31.16 },
  { text: 'valve opens,', start: 31.16, end: 32.04 },
  { text: 'and the piston', start: 32.08, end: 32.54 },
  { text: 'shoots up', start: 32.54, end: 33.16 },
  { text: 'one last time', start: 33.16, end: 34.04 },
  { text: 'to blow all', start: 34.04, end: 34.78 },
  { text: 'the leftover fumes', start: 34.78, end: 35.58 },
  { text: 'out the tailpipe.', start: 35.58, end: 36.85 },
  { text: 'Without a good', start: 36.96, end: 37.58 },
  { text: 'suck, squeeze,', start: 37.6, end: 38.62 },
  { text: 'bang, and blow,', start: 38.65, end: 39.74 },
  { text: "you're not getting", start: 39.78, end: 40.32 },
  { text: 'anywhere.', start: 40.32, end: DURATION_SEC },
];

/** Caption look. Keywords get the accent colour (set to '#FFFFFF' for all-white). */
export const CAPTION_STYLE = {
  topPercent: 64,
  fontSize: 92,
  color: '#FFFFFF',
  keywordColor: '#FFD43B',
  keywords: ['suck', 'sucks', 'squeeze', 'bang', 'blow'],
  strokePx: 8,
  popFrom: 0.92,
  leadSec: 0.03, // show each chunk a hair before the word for perceived sync
};

// ── Floating label pills during the reveal ("SUCK / SQUEEZE / BANG / BLOW")
export const LABEL_PILLS = [
  { text: 'SUCK', t: 3.3, x: 24, y: 23, color: '#2F9BFF', tilt: -6 },
  { text: 'SQUEEZE', t: 3.95, x: 73, y: 17, color: '#FF9F1C', tilt: 5 },
  { text: 'BANG', t: 4.65, x: 27, y: 42, color: '#FF3B30', tilt: 4 },
  { text: 'BLOW', t: 5.45, x: 76, y: 38, color: '#6C7A89', tilt: -5 },
];
export const LABEL_PILLS_OUT = 8.15;

// ── Stroke badge (top of frame) during the four stroke scenes ───────────
export const STROKE_BADGES = [
  { n: 1, word: 'SUCK', name: 'INTAKE STROKE', start: 8.62, end: 16.45, color: '#2F9BFF' },
  { n: 2, word: 'SQUEEZE', name: 'COMPRESSION STROKE', start: 16.54, end: 22.35, color: '#FF9F1C' },
  { n: 3, word: 'BANG', name: 'POWER STROKE', start: 22.42, end: 29.9, color: '#FF3B30' },
  { n: 4, word: 'BLOW', name: 'EXHAUST STROKE', start: 30.0, end: 35.25, color: '#6C7A89' },
];

// ── Comic stickers (reference-style onomatopoeia) ───────────────────────
export const STICKERS = [
  { text: '*CLICK*', t: 3.15, dur: 0.75, x: 50, y: 30, color: '#FFFFFF', ink: '#1B1B1F', size: 64, tilt: -8 },
  { text: 'BANG!', t: 26.24, dur: 1.35, x: 52, y: 25, color: '#FFD43B', ink: '#E8361F', size: 190, tilt: -9 },
  { text: 'PFFFT!', t: 34.3, dur: 0.9, x: 64, y: 27, color: '#E9EEF2', ink: '#5B6672', size: 120, tilt: 7 },
  { text: 'VROOM!', t: 37.05, dur: 1.6, x: 50, y: 24, color: '#4FC3F7', ink: '#0B4F8A', size: 150, tilt: -7 },
];

/** "×3,000/min" counter during "over three thousand times a minute". */
export const RPM_COUNTER = { in: 6.05, countFrom: 6.3, countTo: 7.2, out: 8.2, value: 3000, x: 50, y: 12 };

// ── The car (ending) ────────────────────────────────────────────────────
export const CAR = {
  setOrigin: [400, 0, 0] as V3, // the road set lives far away from the workshop
  launchAt: 37.0,
  accel: 9.5, //                 units / s²
  jerk: 2.2, //                  extra kick so it really takes off
};
