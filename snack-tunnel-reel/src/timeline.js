// Master timeline (seconds). Each voice line sits in a fixed slot, so a new
// recording of the same line (tools/voices.py, revoice.sh) drops into the same
// place without re-rendering the 3D. Animation beats are placed on the words of
// the current takes (assets/vo/<id>.words.json, shown here as comments).

export const FPS = 30;
export const DURATION = 56.0;

// voice slots: line id (script.json) and where its file starts in the reel
export const VO = [
  { id: 'n1', at: 0.5 }, //  "midnight" 3.22, "snacks" 3.62, "Sort of." 4.63
  { id: 'n2', at: 7.9 }, //  "caving in" 8.92, "wooden frames" 10.58, "gold mine" 12.12
  { id: 'n3', at: 15.2 }, // "shovel" 15.44, "loud" 16.16, "wakes up the dog" 16.8, "spoon" 18.98, "three weeks" 20.03
  { id: 'n4', at: 23.0 }, // "pop up" 23.24, "doghouse" 23.88, "measure" 25.7, "twelve steps" 26.4
  { id: 'n5', at: 31.0 }, // "solid tile" 32.12, "cut one tile" 33.84, "trapdoor" 35.92
  { id: 'n6', at: 38.4 }, // "top shelf" 39.54, "tiny pulley" 41.32, "lowers them" 42.3, "tunnel" 43.68
  { id: 'n7', at: 45.9 }, // "Congratulations" 45.93 .. "tunnel" 48.4
  { id: 'mom', at: 52.75 }, // "Looking for these?" 52.79-53.86
];

export const SCENES = [0.0, 7.6, 15.0, 22.5, 30.6, 38.0, 45.2, DURATION];

export const T = {
  // 1 - night yard: shaft, sideways tunnel, dirt pile, the snack dream
  shaft0: 0.6,
  shaftSteps: 6,
  shaftStep: 0.27,
  tunA0: 2.45, // sideways from the shaft...
  tunA1: 7.2, // ...to here (x -2.1)
  dream: 3.3, // thought bubble with a snack, on "midnight snacks"
  dreamPop: 4.66, // deflates and pops on "Sort of."
  // 2 - roof caves in, mine frames, lantern
  cave0: 8.35,
  cave1: 9.7,
  frames0: 10.5, // frames snap in one by one from here
  frameGap: 0.36,
  lantern: 12.25, // hangs from a beam, on "gold mine"
  tunA2: 14.6, // the dig creeps on to x -1.85 during scene 2
  // 3 - clang, sound rings, the dog wakes, spoon, calendar
  clang: 15.8,
  dogEyes: 16.85, // "wakes"
  dogEars: 17.02, // "up"
  spoonSwap: 18.9, // the shovel poofs, a spoon pops in, on "spoon"
  spoon0: 19.05,
  spoon1: 22.2, // spoon digging creeps to x -0.7
  cal0: 19.8, // calendar pages flip, "for three weeks"
  cal1: 21.7,
  // 4 - up into the doghouse, the stare, measuring, turn to the house
  dogUp0: 22.45,
  dogUp1: 23.2,
  popUp: 23.26, // floor patch lifts, head pops up face to face with the dog, on "pop"
  sink0: 24.45,
  sink1: 25.25,
  tape0: 25.6, // "measure"
  steps0: 26.35, // twelve footprints from the back door, "twelve steps"
  stepGap: 0.115,
  tape1: 27.85,
  tunB0: 27.9,
  tunB1: 30.4, // dig on under the house to x 3.75
  // 5 - solid tile, glowing cut, hinges, trapdoor
  kitUp0: 30.4,
  kitUp1: 31.0,
  tap1: 32.15, // "solid"
  tap2: 32.56, // "tile"
  cut0: 33.85, // "cut one tile"
  cut1: 34.75,
  hinge1: 35.02,
  hinge2: 35.28,
  trapOpen: 35.92, // "trapdoor"
  // 6 - top shelf, pulley, snacks lowered into the tunnel
  shelfGlow: 39.5, // "top shelf"
  pulley0: 40.95, // "build": parts snap together from here
  pulleyGap: 0.2,
  hopChips: 42.15, // "lowers them"
  hopJar: 42.38,
  lower0: 42.55,
  lower1: 43.95,
  munch: 44.3,
  basketUp0: 44.75,
  basketUp1: 45.6,
  trapClose0: 45.62, // the kid pulls the trapdoor shut behind the basket
  trapClose1: 46.0,
  // 7 - finale
  wide0: 45.0,
  wide1: 46.6,
  momIn: 45.3, // Mom is already sitting in the dark kitchen by now (unseen until the fridge light)
  dogSleep2: 26.6, // the dog lies back down after the stare
  basket2_0: 48.3, // comes down again... empty, and lands on the closed trapdoor
  basket2_1: 49.45,
  push0: 48.8,
  push1: 50.7,
  confused: 49.6,
  peek0: 50.25, // pushes the trapdoor open
  peek1: 50.85,
  fridgeOpen: 51.18,
  fridgeOn: 51.35, // the fridge light clicks on
  crunch1: 51.72,
  crunch2: 52.06,
  brow: 52.3, // one eyebrow up
  musicStop: 52.52,
  these: 53.27, // she lifts the bag on "these"
  nervous: 54.0,
  close0: 54.45,
  close1: 55.3,
  crunch3: 55.55,
};

// camera keys: t, frame centre x, ground row (pixel row of y = 0 at the cut face),
// scale (pixels per metre at the cut face) and camera height (perspective only).
// Between keys the camera eases (C1-smooth), so pans and push-ins never jerk.
export const CAM = [
  { t: 0.0, cx: -2.55, row: 1010, s: 190, cy: 3.2 },
  { t: 7.6, cx: -2.45, row: 1005, s: 194, cy: 3.2 },
  { t: 14.6, cx: -2.05, row: 1000, s: 212, cy: 3.0 },
  { t: 16.0, cx: -1.55, row: 990, s: 232, cy: 2.8 },
  { t: 22.3, cx: -1.4, row: 1000, s: 240, cy: 2.8 },
  { t: 23.15, cx: -1.0, row: 1230, s: 420, cy: 1.4 },
  { t: 24.7, cx: -1.0, row: 1235, s: 440, cy: 1.4 },
  { t: 25.6, cx: -0.15, row: 975, s: 205, cy: 2.6 },
  { t: 27.9, cx: 1.45, row: 965, s: 205, cy: 2.6 },
  { t: 30.4, cx: 3.0, row: 1090, s: 260, cy: 2.2 },
  { t: 31.3, cx: 3.4, row: 1150, s: 300, cy: 2.0 },
  { t: 37.6, cx: 3.45, row: 1160, s: 310, cy: 2.0 },
  { t: 39.0, cx: 3.45, row: 1250, s: 262, cy: 2.4 },
  { t: 44.4, cx: 3.4, row: 1240, s: 262, cy: 2.4 },
  { t: 46.6, cx: 0.35, row: 960, s: 98, cy: 6.0 },
  { t: 48.8, cx: 0.45, row: 965, s: 102, cy: 6.0 },
  { t: 50.7, cx: 3.95, row: 1420, s: 420, cy: 1.5 },
  { t: 52.2, cx: 3.95, row: 1420, s: 422, cy: 1.5 },
  { t: 53.9, cx: 4.05, row: 1440, s: 465, cy: 1.5 },
  { t: 56.0, cx: 4.0, row: 1430, s: 455, cy: 1.5 },
];
