// THE single source of truth for where things are. Units: meters. +Y up. Ground at y = 0 in the play area.
//
// Story geography (top view, +Z = "north" toward the bear, -Z = "south" toward the camp):
//
//      z=+92  MAP_BEAR (giant bear head poking out of the forest, only for the map shot s21)
//      z=+55  the river crosses the forest (east-west)
//      z=+24  BEAR_PATH.start (dark dense forest, the bear appears here)
//      z=+15  BRANCH (dry branch the bear steps on, s07)
//      z=+4..24  TRAIL: an open strip of moss/grass between dense pines, so the bear can be seen walking
//      z=0    YOU's hiding spot: HIDE_TREE (big pine) + HIDE_BUSH in front of YOU
//      z=-9.5 TENT in the camp clearing (behind YOU)
//
// YOU stands at YOU_SPOT facing +Z (toward the trail). The front camera (at +Z looking -Z) sees YOU's face,
// the big trunk on the left of the frame and the camp/tent in the far background.
// The SUN is low in the west (+X) and a bit north (+Z): warm side light, long shadows toward -X.
// Every module must respect these numbers. If something must move, change it HERE.

export const FPS = 30;
export const W = 1080, H = 1920;
export const DURATION = 1331 / FPS;          // 44.367 s = voiceover length (audio/vo_lines.json duration 44.38)

// ---- YOU's hiding place
export const HIDE_TREE = { pos: [-0.62, 0.0], trunkR: 0.42, height: 17 };  // big pine; YOU stands just behind/right of it
export const YOU_SPOT = { pos: [0.05, -0.28], rotY: 0 };                     // YOU's feet (x, z), faces +Z
export const HIDE_BUSH = { pos: [0.22, 0.62], r: 0.8, h: 1.08 };             // round bush in front of YOU: hides him from the waist down (top y 1.08)
export const LEAF_BUSH = { pos: [1.2, 0.0], r: 0.5, h: 0.85 };               // bush with the GIANT fuzzy leaves, on YOU's left (+X)
export const GIANT_LEAF = { stem: [0.95, 0.78, 0.18], len: 0.46, w: 0.30 };  // the leaf YOU grabs in s04 (stem point, blade points up/+Z/-X)

// ---- camp (behind YOU)
export const TENT = { pos: [-3.8, -9.5], rotY: 0.55, size: 2.2 };          // small orange dome tent
export const CAMP_CLEARING = { pos: [-3.6, -9.0], r: 4.4 };

// ---- the bear's route (feet positions, x z). The bear walks from start toward YOU (-Z direction).
export const BEAR_PATH = {
  start: [-1.6, 24.0],   // first seen far away as a silhouette (s09)
  branch: [-1.25, 15.6], // the dry branch it steps on (s07)
  enter: [-0.9, 12.5],   // walks out of the dark trees into the light (s10), stands up (s11)
  stop: [-0.55, 8.6],    // stops, sniffs the air (s12, s13)
  near: [0.15, 3.6],     // "gets closer" (s22)
  close: [0.22, 2.05],   // right in front of the bush (s23-s26): its face can lean over the bush
  exit: [8.0, 18.0],     // runs away crying toward the north-east (s27)
};
export const BRANCH = { pos: [-1.25, 15.6], len: 0.9 };                      // dry branch on the trail (snaps at 9.69 s)
export const TRAIL = { from: [0.2, 1.6], to: [-1.8, 27], width: 5.0 };     // open strip with no big trees

// ---- cutaway / special places
export const COMPARE = { pos: [26.0, 0.0], r: 5.0 };     // clearing for the bear + bloodhound comparison (s19-s20); both face +Z
export const MAP_BEAR = { pos: [-6.0, 92.0], scale: 6.5 }; // giant bear head sticking out of the trees (map shot s21 only)
export const RIVER = [[-60, 50], [-30, 57], [-8, 52], [12, 60], [35, 54], [60, 58]]; // river centre line (x, z), ~6 m wide
export const BIRD_TREES = [[5.5, 9.5], [8.0, 12.5], [3.0, 14.0], [10.5, 9.0], [6.5, 16.0]]; // treetops the flock bursts out of (s28)
export const FORE_BRANCH = { pos: [2.2, 8.6, 6.4], dir: [1, 0.05, 0.25] };  // a pine branch near the s28 camera; the squirrel runs on it

// ---- forest extent + clearings (no trees inside these circles)
export const FOREST = { minX: -55, maxX: 55, minZ: -45, maxZ: 120 };
export const CLEARINGS = [
  { pos: [0.4, 0.4], r: 2.6 },         // YOU's spot (the HIDE_TREE itself is placed by the set)
  { pos: CAMP_CLEARING.pos, r: CAMP_CLEARING.r },
  { pos: COMPARE.pos, r: COMPARE.r },
  { pos: MAP_BEAR.pos, r: 7.5 },
];

// ---- light
export const SUN = { dir: [1.0, 0.22, 0.42], color: '#ffb36e', intensity: 2.8 };  // direction TOWARD the sun (normalise it)
export const SKY = { horizon: '#ff9a52', mid: '#e9799a', zenith: '#4b4a8c', opposite: '#5b4a7a' };
