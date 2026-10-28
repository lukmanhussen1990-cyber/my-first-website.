// Master timeline (seconds). Each voice line (or part of a line) sits in a fixed
// slot, so a new recording of the same line (tools/voices.py, tools/split_voiceover.py,
// revoice.sh) drops into the same place without re-rendering the 3D. Animation beats
// are placed on the words of the current take (assets/vo/<id>.words.json; absolute
// times in the comments).

import { monotone } from './util.js';

export const FPS = 30;
export const DURATION = 60.5;

// voice slots: line id (script.json), where it starts in the reel, and optionally a
// range of its words [first, end) when a line is split at a pause (the cut falls in
// the middle of the pause; `at` is where the cut-out part starts)
export const VO = [
  { id: 'n1', at: 0.5 }, //   "three cans" 1.74-2.4, "five minutes" 3.8-4.7, "survive" 5.52-6.04
  { id: 'n2', at: 7.0 }, //   "Dig a shelter, fast" 7.05-8.9, "the worst smelly gas" 10.52-11.62, "heavier" 11.86, "sinks right into holes" 13.42-14.67
  { id: 'n3', at: 15.2 }, //  "airtight" 16.08, "door" 16.58, "rubber seals" 17.4-18.0, "all around it" 18.0-18.9
  { id: 'n4', at: 19.8 }, //  "still need to breathe" 20.1-21.09, "tall pipe" 22.18-22.76, "clean air" 23.24-23.84, "above the cloud" 24.88-25.68
  { id: 'n5', at: 26.4 }, //  "carbon filter" 27.12-27.86, "gas masks" 29.22-30.07, "traps the smell" 30.66-31.56, "lets clean air through" 31.94-33.03
  { id: 'n6', at: 33.8 }, //  "fan" 34.12, "pushes clean air in" 34.4-35.81, "pressure" 36.3, "can't sneak through any gaps" 38.82-40.46
  { id: 'n7', at: 43.1, words: [0, 2] }, // "Time's up." 43.15-43.71
  { id: 'n7', at: 46.6, words: [2] }, //    "The cloud spreads" 46.84, "fifty meters" 47.6-48.4, "But underground" 49.99-50.76, "completely safe" 51.4-52.17
  { id: 'n8', at: 55.9 }, //  "Unless the danger is already inside." 55.95-57.96
];

export const SCENES = [0.0, 6.8, 15.0, 19.6, 26.3, 33.7, 43.0, 52.4, DURATION];

export const T = {
  // 1 - the little brother on the porch, three empty cans, patting his belly; "3 CANS";
  //     the countdown appears at 5:00; the worker looks at him in fear, grabs the shovel
  pat0: 0.2, // the kid pats his belly
  rumble: 1.0, // his belly rumbles (it wobbles)
  label3: 1.75, // "3 CANS" ("three cans")
  timer0: 3.8, // the countdown appears at 5:00 ("five minutes")
  fear: 4.3, // the worker turns to him and flinches
  grab: 5.4, // grabs the shovel ("survive")
  // 2 - he digs super fast; the corrugated steel shelter appears in the pit; a test
  //     puff of gas drifts over the yard and sinks into the open stairwell
  dig0: 6.95,
  dig1: 9.1,
  climbOut: 9.05, // climbs up the back wall of the pit onto the lawn behind it
  shell0: 9.6, // floor, frame, wall panels, roof, stairs snap in (to ~10.9)
  backfill0: 10.95, // soil over the roof; the lawn grows back (not over the stairwell)
  backfill1: 11.55,
  puff0: 10.5, // the test puff drifts in from the left ("the worst smelly gas")
  labelHeavy: 11.85, // "HEAVIER THAN AIR" ("heavier")
  sink0: 12.6, // it sinks into the open stairwell ("sinks right into holes")
  sink1: 14.2,
  puffGone: 14.9, // and thins away
  walkIn0: 13.75, // the worker runs to the stairwell and down into the room; the dog races ahead
  // 3 - the airtight door with rubber seals snaps on; he pulls it shut; the gas presses
  door: 15.5, // the door snaps onto the entrance, standing open
  labelAir: 16.05, // "AIRTIGHT" ("airtight")
  doorClose: 16.4, // pulled shut ("door")
  doorShut: 16.75, // ... lands on its seals
  seals: 17.4, // the seals light up all round ("rubber seals all around it")
  press0: 17.5, // a low layer of gas rolls in and presses on the door
  press1: 19.6,
  // 4 - inside it gets stuffy; the tall pipe rises; clean air from 4 m up
  stuffy0: 19.6, // haze; he wipes his brow, fans himself ("still need to breathe")
  pipe0: 22.1, // the pipe rises out of the lawn ("tall pipe")
  pipe1: 22.95,
  label4m: 23.25, // measuring line and "CLEAN AIR: 4 M UP" ("clean air")
  lowGas: 23.8, // green arrows: the gas stays low
  air0: 24.5, // white arrows: clean air from high up, down the pipe ("above the cloud")
  air1: 26.3,
  // 5 - the carbon filter
  filter: 26.75, // the black filter box snaps onto the pipe ("add a carbon filter")
  labelCarbon: 27.1, // "CARBON FILTER"
  cutOpen: 28.0, // its front cuts away: black carbon grains inside
  dots0: 30.5, // green gas dots come down the pipe and stick in the grains ("traps the smell")
  clean0: 31.85, // white air passes through ("lets clean air through")
  clean1: 33.4,
  // 6 - the fan; higher pressure inside
  fanOn: 34.1, // he flips the switch: the fan clicks on and spins up ("fan")
  push0: 34.5, // white arrows: clean air pushed into the room ("pushes clean air in")
  push1: 36.1,
  labelPress: 36.3, // "+ PRESSURE" ("pressure")
  leak0: 37.5, // white arrows out through every gap, green arrows turned back ("can't sneak through any gaps")
  leak1: 40.5,
  gasOut: 40.6, // the low gas layer clears away before the real thing
  toBench: 40.6, // he sits down on the bench next to the dog
  final0: 40.6, // the last ten seconds of the countdown
  zero: 43.0, // 0:00
  // 7 - time's up: the giant cloud blasts out and rolls over the whole yard
  kid0: 43.5, // the camera finds the little brother on the porch ("Time's up")
  brace: 44.0, // he braces...
  blast: 44.5, // ...the giant cloud blasts out behind him
  bird: 45.0, // the bird flaps away
  droop: 45.6, // the flowers droop
  curl: 46.1, // the tree's leaves curl
  labelRadius: 47.5, // "SMELL RADIUS: 50 M" ("fifty meters")
  safe0: 49.9, // underground the worker sits calmly on the bench with the dog ("But underground")
  // 8 - the twist
  thumb: 52.5, // a thumbs-up to the camera
  guilty: 53.35, // the dog looks guilty
  musicCut: 54.15, // the music stops
  pfft: 54.45, // the tiny pfft: a small green puff behind the dog
  freeze: 54.75, // the worker freezes; he turns to the dog
  mask0: 56.6, // he slowly pulls on a gas mask ("Unless the danger is already inside")
  mask1: 58.6,
};

// the countdown: 5:00 at timer0, down in steps of ~2 s four times a second, then the
// last ten seconds one by one, 0:00 at T.zero
export function countdown(t) {
  if (t < T.timer0) return null;
  const step = 0.25;
  const n = Math.floor((T.final0 - T.timer0) / step);
  if (t < T.final0) return 300 - Math.round((290 * Math.floor((t - T.timer0) / step)) / n);
  if (t < T.zero) return 10 - Math.floor(((t - T.final0) / (T.zero - T.final0)) * 10);
  return 0;
}

// camera keys (src/main.js eases between them, C1-smooth, so pushes and pulls never jerk):
//   diorama views: t, frame centre x, row (pixel row of the lawn edge at the cut face),
//     s (pixels per metre at the cut face), cy (camera height);
//   close-ups: t, cx, cy, cz (distance in front of the cut), f (focal length, px), look
//     (a point) and arow (its pixel row).
// The subtitles sit on rows ~790-890 and the countdown on rows ~90-270: every shot
// keeps its action (the people, the door, the pipe, the filter) out of those bands.
// Inside the shelter the camera is at eye level, so the top of the back wall (the
// filter, the fan) shows under the buried roof.
const KID_LOOK = { cx: 1.25, cy: 1.15, f: 4500, look: [1.25, 1.2, -9.35] };
const BENCH_LOOK = { cx: 0.45, cy: -1.2, f: 3000, look: [0.45, -1.6, -2.0], arow: 1250 };
export const CAM = [
  { t: 0.0, cx: 2.0, row: 1220, s: 128, cy: 2.3 }, // the yard, the porch, the worker
  { t: 1.2, cx: 2.1, row: 1260, s: 150, cy: 2.2 },
  { t: 2.3, ...KID_LOOK, cz: 0.65, arow: 1290 }, // push in on the little brother: "three cans of beans"
  { t: 3.4, ...KID_LOOK, cz: 0.6, arow: 1295 },
  { t: 4.6, cx: 2.8, row: 1380, s: 205, cy: 1.8 }, // pull back: the worker's fear, the countdown
  { t: 6.2, cx: 2.6, row: 1300, s: 190, cy: 1.8 },
  { t: 7.6, cx: 1.3, row: 1010, s: 168, cy: 1.7 }, // the dig
  { t: 9.2, cx: 1.3, row: 1000, s: 172, cy: 1.7 },
  { t: 10.6, cx: 1.35, row: 1080, s: 158, cy: 1.8 }, // the shelter; the puff drifts in from the left
  { t: 12.4, cx: 1.5, row: 1060, s: 165, cy: 1.8 },
  { t: 13.6, cx: 2.4, row: 1020, s: 235, cy: 1.5 }, // it sinks into the stairwell
  { t: 15.0, cx: 2.6, row: 770, s: 285, cy: 1.0 }, // the door above the subtitles, the stairwell below
  { t: 17.0, cx: 2.7, row: 770, s: 310, cy: 0.9 },
  { t: 19.2, cx: 2.6, row: 765, s: 290, cy: 1.0 },
  { t: 20.4, cx: 0.2, row: 740, s: 300, cy: -0.9 }, // inside: stuffy
  { t: 21.6, cx: 0.25, row: 750, s: 320, cy: -0.9 },
  { t: 23.0, cx: 0.9, row: 1240, s: 140, cy: 1.9 }, // pull back: the pipe 4 m up, the gas low
  { t: 26.0, cx: 0.9, row: 1250, s: 142, cy: 1.9 },
  { t: 27.4, cx: -0.5, row: 760, s: 330, cy: -0.9 }, // the filter goes on
  { t: 28.9, cx: -1.0, cy: -1.15, cz: 2.45, f: 5000, look: [-1.0, -0.8, -2.08], arow: 1250 }, // push in on its cutaway
  { t: 32.8, cx: -1.0, cy: -1.15, cz: 2.3, f: 5000, look: [-1.0, -0.8, -2.08], arow: 1255 },
  { t: 34.6, cx: -0.1, row: 750, s: 300, cy: -0.9 }, // the switch, the fan, the room
  { t: 36.4, cx: 1.1, row: 960, s: 190, cy: -0.6 }, // the whole shelter: pressure out through the gaps
  { t: 40.4, cx: 1.1, row: 965, s: 186, cy: -0.6 },
  { t: 42.6, cx: 1.6, row: 1150, s: 150, cy: 1.9 }, // the last seconds: the yard, the porch
  { t: 43.6, ...KID_LOOK, cz: 0.65, arow: 1290 }, // the little brother...
  { t: 44.45, ...KID_LOOK, cz: 0.6, arow: 1295 },
  { t: 45.6, cx: 1.6, row: 1240, s: 125, cy: 2.4 }, // ...pull back: the cloud rolls over the whole yard
  { t: 49.3, cx: 1.5, row: 1230, s: 128, cy: 2.4 },
  { t: 51.0, cx: 0.35, row: 740, s: 320, cy: -0.95 }, // underground: calm on the bench
  { t: 52.4, cx: 0.4, row: 745, s: 350, cy: -1.0 },
  { t: 54.3, ...BENCH_LOOK, cz: 4.6 }, // the twist
  { t: 57.0, ...BENCH_LOOK, cz: 4.35 },
  { t: DURATION, ...BENCH_LOOK, cz: 4.15 },
];

// Camera keys come in two forms: diorama views (row = pixel row of the lawn edge at the
// cut, s = pixels per metre at the cut) and close-ups that look at a point (camera x,
// height and distance, the point's pixel row). Both are turned into the camera's real
// parameters (x, height, distance, focal length, lens shift), which are what is eased
// between keys, so a big dolly (in to the porch, onto the filter) stays smooth and keeps
// its subject on screen. Focal length 2600 px unless a key zooms in (f).
const F0 = 2600;
const camKeys = CAM.map((c) => {
  const f = c.f ?? F0;
  let cz, vs;
  if (c.look) {
    cz = c.cz;
    vs = c.arow - 960 + (f * (c.look[1] - c.cy)) / (cz - c.look[2]);
  } else {
    cz = f / c.s;
    vs = c.row - 960 - (f * c.cy) / cz;
  }
  return { t: c.t, cx: c.cx, cy: c.cy, lcz: Math.log(cz), lf: Math.log(f), vs };
});
const camTrack = {};
for (const k of ['cx', 'cy', 'lcz', 'lf', 'vs']) camTrack[k] = monotone(camKeys.map((c) => [c.t, c[k]]));
// the camera at time t: position (cx, cy, cz), focal length f (px), lens shift vs (px)
export function camAt(t) {
  return { cx: camTrack.cx(t), cy: camTrack.cy(t), cz: Math.exp(camTrack.lcz(t)), f: Math.exp(camTrack.lf(t)), vs: camTrack.vs(t) };
}
