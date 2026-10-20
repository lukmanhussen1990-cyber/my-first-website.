// Master timeline (seconds). The voiceover is cut into sentences and each
// sentence is placed so the action lands on its words; animation events and
// sound cues are all derived from this one file (see tools/export_timeline.mjs).

export const FPS = 24;
export const DURATION = 56.6;

// VO sentences: src = [in, out] inside the take, at = start in the reel
export const VO = [
  { id: 'A1', file: 'take1', src: [0.0, 4.495], at: 0.25, text: "If you dig a tunnel under the wall, you have a shortcut to your best friend's house." },
  { id: 'A2', file: 'take1', src: [4.495, 5.78], at: 5.45, text: 'Sort of.' },
  { id: 'B1', file: 'take1', src: [5.78, 8.82], at: 7.15, text: "But the wall's concrete foundation is in the way." },
  { id: 'B2', file: 'take1', src: [8.82, 11.535], at: 10.35, text: 'So you dig deeper and go under it.' },
  { id: 'C1', file: 'take1', src: [11.535, 13.895], at: 14.75, text: 'But dirt keeps falling on your head.' },
  { id: 'C2', file: 'take1', src: [13.895, 17.83], at: 17.2, text: 'So you build a brick arch that pushes the weight out to the sides.' },
  { id: 'D1', file: 'take1', src: [17.83, 21.46], at: 22.9, text: 'But the air down there goes stale, and your candle goes out.' },
  { id: 'D2', file: 'take1', src: [21.46, 25.86], at: 26.75, text: 'So you add an air pipe up to the lawn, and fresh air flows in.' },
  { id: 'E1', file: 'take1', src: [25.86, 27.46], at: 32.45, text: "But it's pitch dark." },
  { id: 'E2', file: 'take1', src: [27.46, 30.705], at: 34.05, text: 'So you run a wire along the roof and hang bulbs.' },
  { id: 'F1', file: 'take1', src: [30.705, 33.455], at: 39.1, text: 'But crawling on your knees takes forever.' },
  { id: 'F2', file: 'take1', src: [33.455, 36.74], at: 41.85, text: 'So you lay tiny rails and ride a mine cart.' },
  { id: 'G', file: 'take1', src: [36.74, 41.12], at: 46.5, text: "Congratulations, you built a secret tunnel to your best friend's house." },
  { id: 'H', file: 'boy', src: [0.0, 1.68], at: 53.3, text: 'Hi, Aunty...', voice: 'boy' },
];

export const SCENES = [0.0, 6.6, 14.5, 22.6, 32.2, 38.8, 46.3, DURATION];

export const T = {
  // 1 — shaft, sideways tunnel, dirt pile
  digStart: 0.45,
  shaftSteps: 6,
  shaftStep: 0.3,
  pileLand: 0.8,
  tunnelStart: 2.35,
  tunnelEnd: 6.35, // dig face reaches the concrete footing
  // 2 — clunk, knock knock, dip under
  clunk: 6.35,
  knock1: 8.12,
  knock2: 8.58,
  dipStart: 10.95,
  dipUnder: 11.9, // dig face reaches the bottom under the footing
  dipUp: 12.75, // back up to the original level on the right
  exitShaft: 13.2, // turns up under the friend's lawn
  breakThrough: 13.95,
  lidLand: 14.2,
  potLand: 14.45,
  pileAway: 14.55,
  // 3 — dirt falls, brick arches, orange load dots
  crumbleStart: 14.9,
  crumbleEnd: 16.9,
  clumpsAway: 17.45,
  bricksStart: 17.75,
  bricksEnd: 19.55,
  loadStart: 19.3,
  loadEnd: 22.1,
  // 4 — stale air, candle out, air pipe, fresh air
  candleIn: 22.55,
  staleStart: 23.3,
  staleFull: 25.2,
  flicker: 24.7,
  candleOut: 25.99,
  pipeStart: 27.55,
  pipeTop: 28.35,
  capPop: 28.45,
  freshStart: 29.2,
  staleOut: 29.55,
  airClear: 31.9,
  // 5 — pitch dark, wire, bulbs
  darkStart: 32.25,
  wireStart: 34.75,
  wireEnd: 35.95,
  bulbsHang: 36.15,
  bulbsOn: 36.75,
  bulbGap: 0.27,
  // 6 — snail, rails, mine cart
  snailIn: 38.95,
  railsStart: 42.45,
  railsEnd: 43.45,
  cartDrop: 43.55,
  cartLand: 43.95,
  cartGo: 44.15,
  cartArrive: 46.0,
  // 7 — finale
  momIn: 47.45,
  boyIn: 49.7,
  pushIn: 49.25, // on "...to your best friend's house"
  pushInEnd: 51.45,
  lidOpen: 51.55,
  headOut: 51.78,
  lookUp: 52.55,
  nervous: 53.0,
  musicStop: 53.15,
  wave: 53.45,
  sink: 54.95,
  sinkBottom: 55.95,
  lidClose: 56.0,
  // finale character beats
  boyCrouch: 51.3, // tucks in before shoving the lid open
  girlUp: 51.92, // girl rises behind the window sill
  girlAway: 52.24, // glances away...
  girlTake: 52.42, // ...double-take back to the hole
  girlShock: 52.55, // eyes pop, mouth drops, hands to her cheeks
  girlCover: 53.42, // hands over her mouth on "Hi, Aunty..."
};
