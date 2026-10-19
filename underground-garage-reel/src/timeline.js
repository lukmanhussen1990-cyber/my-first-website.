// Master timeline (seconds). The voiceover is cut into sentences and each
// sentence is placed so the action lands on its words; animation events and
// sound cues are all derived from this one file (see tools/export_timeline.mjs).

export const FPS = 24;
export const DURATION = 56.5;

// VO sentences: src = [in, out] inside assets/vo/take1.mp3, at = start in the reel
export const VO = [
  { id: 'A1', src: [0.0, 2.86], at: 0.35, text: 'If you dig a big hole in your yard and drive your car into it,' },
  { id: 'A2', src: [2.86, 4.06], at: 4.45, text: 'you have a garage.' },
  { id: 'A3', src: [4.06, 4.75], at: 5.8, text: 'Sort of.' },
  { id: 'B1', src: [4.75, 7.0], at: 7.2, text: 'But the dirt walls cave in and bury your car.' },
  { id: 'B2', src: [7.0, 9.55], at: 10.7, text: 'So you pour thick concrete walls and a floor.' },
  { id: 'C1', src: [9.55, 12.2], at: 14.9, text: 'But the first big rain turns it into a swimming pool.' },
  { id: 'C2', src: [12.2, 16.17], at: 18.2, text: 'So you add gravel, a drain, and a pump that pushes the water back out.' },
  { id: 'D1', src: [16.17, 18.36], at: 24.0, text: 'But now your car is stuck at the bottom of a hole.' },
  { id: 'D2', src: [18.36, 21.36], at: 26.4, text: 'So you build a hydraulic lift that raises it up to the lawn.' },
  { id: 'E1', src: [21.36, 23.27], at: 32.4, text: 'But car fumes get trapped down there.' },
  { id: 'E2', src: [23.27, 26.3], at: 34.9, text: 'So you add a vent pipe with a fan that pulls fresh air in.' },
  { id: 'F1', src: [26.3, 28.44], at: 39.8, text: "But a big hole in your lawn isn't very secret." },
  { id: 'F2', src: [28.44, 32.48], at: 42.5, text: "So you grow grass on the lift's roof, and the lawn closes over your car." },
  { id: 'G', src: [32.48, 35.3], at: 51.9, text: 'Congratulations, you built a secret underground garage.' },
];

export const SCENES = [0.0, 7.0, 14.6, 23.6, 31.8, 39.4, 47.6, DURATION];

export const T = {
  // 1 — dig + car tips in
  digStart: 0.45,
  digSteps: 6,
  digStep: 0.36,
  pileLand: 0.95,
  carEnter: 1.0,
  carEdge: 3.05, // front wheels reach the pit edge
  carTipEnd: 3.45, // centre of mass passes the edge
  carNoseHit: 3.82,
  carFlat: 4.15, // rear slams down
  carSettle: 5.05,
  sortOf: 5.9,
  // 2 — crumble, then concrete
  crumble: 7.55,
  slideIn: 7.85,
  buried: 9.0,
  dirtPop: 9.8,
  backWall: 11.35,
  leftWall: 11.7,
  rightWall: 12.02,
  floor: 12.72,
  // 3 — rain, pool, drainage
  cloudIn: 14.75,
  rainStart: 15.25,
  rainEnd: 18.0,
  waterRise: 15.55,
  waterFull: 17.7,
  cloudOut: 18.2,
  gravel: 18.72,
  grate: 19.52,
  drainPipe: 19.7,
  sump: 20.05,
  pump: 20.4,
  dischargePipe: 20.6,
  outlet: 21.0,
  flowStart: 20.9,
  drainStart: 21.2,
  drainEnd: 23.0,
  flowEnd: 23.5,
  // 4 — stuck, then the lift
  spinStart: 23.85,
  bump1: 24.55,
  bump2: 25.45,
  spinEnd: 26.15,
  casing: 26.85,
  rod: 27.12,
  platform: 27.4,
  liftUp: 27.95,
  liftTop: 29.4,
  liftDown: 30.2,
  liftBottom: 31.6,
  // 5 — fumes, then the vent
  engineOn: 31.95,
  puffsStart: 32.1,
  puffsEnd: 34.7,
  ventStub: 35.3,
  ventPipe: 35.5,
  fanHousing: 36.15,
  fanSpin: 36.3,
  airStart: 36.8,
  smokeOut: 37.0,
  roomClear: 39.2,
  engineOff: 39.0,
  // 6 — grass roof
  lift2Up: 40.35,
  lift2Top: 42.0,
  posts: 42.15,
  roofDrop: 42.75,
  grassStart: 43.05,
  grassEnd: 44.3,
  lift2Down: 44.6,
  lift2Bottom: 46.3,
  // 7 — finale
  pushIn: 47.6,
  pushInEnd: 50.9,
  split: 49.35,
  rise: 49.6,
  riseTop: 51.6,
  flash1: 51.85,
  flash2: 52.3,
  sink: 53.45,
  sinkBottom: 55.0,
  pullBack: 53.4,
  pullBackEnd: 56.0,
};
