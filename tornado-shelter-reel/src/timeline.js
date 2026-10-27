// Master timeline (seconds). Each voice line sits in a fixed slot, so a new
// recording of the same line (tools/voices.py, tools/split_voiceover.py, revoice.sh)
// drops into the same place without re-rendering the 3D. Animation beats are
// placed on the words of the current take (assets/vo/<id>.words.json; absolute
// times in the comments).

export const FPS = 30;
export const DURATION = 81.5;

// voice slots: line id (script.json) and where its file starts in the reel
export const VO = [
  { id: 'n1', at: 0.5 }, //   "tornado" 0.66, "ten" 2.64, "minutes" 2.98, "Here's" 3.98, "build" 4.5, "shelter" 4.84, "survive it" 5.54-6.13
  { id: 'n2', at: 7.5 }, //   "First" 7.57, "underground" 8.46, "Tornado winds" 9.65-9.98, "rip" 10.38, "surface" 11.4, "ground below" 12.56-12.8, "protects you" 13.16-13.96
  { id: 'n3', at: 15.0 }, //  "walls" 15.56, "break" 16.4, "pour" 17.48, "thick concrete" 17.7-18.02, "steel bars inside" 18.9-19.46
  { id: 'n4', at: 21.9 }, //  "tornado" 22.54, "flying debris" 24.2-24.5, "plank" 25.78, "hit" 26.7, "hundred and sixty" 27.46-27.9, "kilometers per hour" 28.22-29.48
  { id: 'n5', at: 30.6 }, //  "winds" 31.18, "lift things up" 32.22-32.74, "anchor" 33.82, "deep" 34.76, "ground" 35.54, "steel rods" 35.98-36.89
  { id: 'n6', at: 38.4 }, //  "door" 38.58, "weakest point" 39.28-39.56, "heavy steel door" 41.1-41.64, "three" 42.2, "locking bolts" 42.44-43.33
  { id: 'n7', at: 44.8 }, //  "inside" 45.22, "air" 46.6, "small vents" 47.92-48.34, "caps" 48.88, "keep debris out" 49.48-50.35
  { id: 'n8', at: 51.6 }, //  "hours" 52.86, "water" 54.4, "flashlight" 55.28, "first aid kit" 56.32-56.78, "radio" 57.48-57.98
  { id: 'n9', at: 64.4 }, //  "tornado hits" 64.82-65.16, "winds" 66.16, "three hundred" 66.72-67.08, "per hour" 67.84-68.2, "Above ground" 69.15, "safe" 71.02-71.5
  { id: 'n10', at: 75.0 }, // "underground" 75.2, "your family" 76.17-76.3, "is safe" 76.62-77.4
];

export const SCENES = [0.0, 7.2, 14.7, 21.6, 30.3, 38.1, 44.5, 51.3, 58.3, 72.5, DURATION];

export const T = {
  // 1 - a calm sunny backyard; far away a tornado is forming; "10 MIN"; the shovel
  funnel0: 0.6, // the funnel starts to lower from the cloud base ...
  funnel1: 3.6, // ... and touches down (a dust whirl at its foot)
  lookUp: 1.0, // the worker turns and looks up at it ("tornado")
  label10: 2.64, // "10 MIN" ("ten")
  grab: 4.55, // grabs the shovel stuck in the lawn ("build")
  shoulder: 5.3, // swings it up, ready
  // 2 - he digs fast; the pit goes down; wind over the ground, not into the pit
  dig0: 7.45, // first bite
  dig1: 12.6, // the pit is at full size
  labelUG: 8.46, // "UNDERGROUND = SAFEST" ("underground")
  wind0: 9.6, // white arrows: the wind flows over the ground ("Tornado winds")
  wind1: 12.0,
  // 3 - rebar cages snap in, the concrete comes up round them, the roof slab
  rebar0: 15.45, // cages, one after another ("walls")
  rebarGap: 0.22,
  pour0: 17.45, // the concrete rises in the walls ("pour")
  pour1: 18.3,
  slab: 18.55, // the roof slab snaps on
  label30: 18.0, // measuring line across the wall + "30 CM CONCRETE" ("thick concrete")
  barsGlow: 19.0, // the bars in the cut glow briefly ("steel bars inside")
  backfill0: 19.3, // the spare pit is backfilled, the lawn grows back over it
  backfill1: 20.6,
  // 4 - flying debris; the plank test
  debris0: 23.2, // small debris starts to blow past ("flying debris" 24.2)
  plank0: 27.05, // the plank comes flying (slow motion) ("wood can hit")
  label160: 27.4, // "160 KM/H" follows it ("hundred and sixty")
  hit: 28.95, // it smashes into the roof ("kilometers per hour")
  // 5 - lift; the anchors drill down; the wind tries to lift the shelter
  lift0: 31.3, // a garden chair lifts off and tumbles away ("lift things up")
  drill0: 33.75, // anchors spin down ("anchor"), one after another
  drillGap: 0.3,
  drill1: 35.9, // all at 2 m below the floor
  labelAnchor: 35.0, // "ANCHORED 2 M DEEP" + measuring line ("deep into the ground")
  uplift0: 36.95, // white arrows push up under the shelter; it doesn't move
  uplift1: 38.2,
  // 6 - the door
  weak0: 38.55, // the open stairwell pulses: the weakest point ("door ... weakest point")
  weak1: 40.1,
  door: 41.25, // the steel door drops into place ("steel door")
  doorShut: 41.55, // and lands with a heavy thud
  bolts: [42.42, 42.72, 43.02], // three bolts slide shut ("three locking bolts")
  // 7 - inside, dark and stuffy; the vents; air flows in
  stuffy0: 44.9, // the light drops, a warm haze ("inside")
  vent: [47.95, 48.2], // the two pipes pop up through the roof ("small vents")
  cap: [48.75, 48.95], // their caps snap on ("caps")
  bounce: 49.55, // debris bounces off the caps ("keep debris out")
  air0: 50.45, // white arrows: fresh air flows in; the haze clears
  air1: 51.9,
  // 8 - benches, shelves and supplies
  bench: 52.0, // benches snap in along the walls ("in there for hours")
  shelf: 53.85, // the shelves ("So")
  water: 54.4, // + "WATER"
  light: 55.28, // flashlight + "LIGHT"
  aid: 56.32, // first aid kit ("first aid kit")
  radio: 57.48, // battery radio + "RADIO"
  // 9 - the storm; everyone goes down; the door locks; the tornado passes over
  storm: 58.4, // the sky turns dark green-grey, the wind roars
  workerUp: 58.5, // the worker climbs the stairs ...
  hatchOpen: 59.4, // ... and swings the door open
  run0: 59.3, // woman, kid and dog run in from the gate
  down0: 61.95, // they go down: the dog, the kid, the woman, then the worker
  doorClose: 63.55, // the worker pulls the door shut
  lockAll: 63.9, // the bolts slam shut; the music drops, only the wind
  seated: 65.0, // everyone sits on the bench
  torch: 65.3, // the flashlight clicks on
  hitT: 64.6, // the tornado reaches the yard ("Then the tornado hits")
  label300: 66.75, // "300 KM/H WIND" ("three hundred")
  tiles0: 65.4, // roof tiles start lifting off the house
  passEnd: 71.6, // the funnel has moved on
  // 10 - silence; the sky clears; the door opens; the family climbs out
  calm0: 71.8, // the wind dies down ...
  clear0: 72.6, // ... the sky clears to soft sunlight
  clear1: 75.2,
  unbolt: 74.0, // the bolts slide back
  doorOpen: 74.35, // the door swings open ("But underground")
  out: [75.0, 75.6, 76.2, 76.75], // worker, woman, kid, dog step out
  shake: 77.9, // the dog shakes off the dust
  birds: 76.0, // birds again
  wide0: 77.5, // the camera pulls back to a calm wide shot
};

// camera keys: t, frame centre x, ground row (pixel row of y = 0 at the cut face),
// scale (pixels per metre at the cut face) and camera height. Between keys the
// camera eases (C1-smooth), so pans and push-ins never jerk.
// The subtitles sit on rows ~770-900: in most shots the ground row is ~900-1000,
// so they cover the far lawn and the fence, never the shelter.
export const CAM = [
  { t: 0.0, cx: 0.9, row: 1170, s: 128, cy: 2.2 }, // the backyard, the sky, far away the tornado
  { t: 2.6, cx: 0.95, row: 1140, s: 134, cy: 2.1 },
  { t: 6.9, cx: 1.3, row: 990, s: 168, cy: 1.7 }, // closer: the yard and the soil
  { t: 12.4, cx: 1.2, row: 975, s: 172, cy: 1.7 }, // the pit
  { t: 15.0, cx: 1.2, row: 975, s: 172, cy: 1.7 },
  { t: 17.6, cx: 0.4, row: 940, s: 205, cy: 1.6 },
  { t: 18.7, cx: -0.8, row: 930, s: 300, cy: 1.4 }, // the wall in section, "30 CM"
  { t: 20.4, cx: -0.75, row: 935, s: 305, cy: 1.4 },
  { t: 22.2, cx: 0.4, row: 1060, s: 182, cy: 1.8 }, // sky, debris, the roof
  { t: 25.6, cx: 0.1, row: 1050, s: 190, cy: 1.8 },
  { t: 27.0, cx: -1.45, row: 1005, s: 212, cy: 1.6 }, // the plank comes in from the left
  { t: 28.6, cx: -1.35, row: 995, s: 240, cy: 1.5 },
  { t: 29.5, cx: -1.1, row: 990, s: 285, cy: 1.5 }, // impact
  { t: 30.3, cx: -0.5, row: 985, s: 280, cy: 1.5 },
  { t: 32.8, cx: 1.0, row: 860, s: 150, cy: 1.8 }, // the whole shelter and the soil below it
  { t: 37.4, cx: 1.05, row: 850, s: 152, cy: 1.8 },
  { t: 39.6, cx: 2.7, row: 990, s: 270, cy: 1.4 }, // the stairwell
  { t: 41.0, cx: 3.0, row: 1010, s: 380, cy: 1.1 }, // the door
  { t: 43.4, cx: 3.05, row: 1015, s: 410, cy: 1.0 },
  { t: 45.6, cx: 0.2, row: 880, s: 255, cy: 1.5 }, // inside, the roof and the vents
  { t: 51.0, cx: 0.15, row: 870, s: 262, cy: 1.5 },
  { t: 52.4, cx: 0.0, row: 905, s: 300, cy: 1.4 }, // benches, shelves, supplies
  { t: 57.9, cx: 0.05, row: 905, s: 305, cy: 1.4 },
  { t: 59.4, cx: 2.0, row: 1010, s: 150, cy: 2.0 }, // the yard: the family runs in
  { t: 62.4, cx: 2.0, row: 1000, s: 152, cy: 2.0 },
  { t: 64.6, cx: 1.1, row: 930, s: 165, cy: 1.8 }, // the tornado passes over; inside, calm
  { t: 71.8, cx: 1.1, row: 925, s: 168, cy: 1.8 },
  { t: 74.3, cx: 2.3, row: 985, s: 215, cy: 1.6 }, // the door opens, they climb out
  { t: 77.4, cx: 2.4, row: 1000, s: 205, cy: 1.6 },
  { t: 81.5, cx: 1.2, row: 1130, s: 132, cy: 2.2 }, // calm wide shot
];
