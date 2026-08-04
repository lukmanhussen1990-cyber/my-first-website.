// The Hollow Bride - static configuration.
// Every coordinate in this file is absolute. The manor is built once, at world
// creation, at a fixed origin so that .mcfunction files can be plain text.

export const NS = "ag";
export const DIM_ID = "overworld";

// Main loop period in ticks. Never lower this below 10 (mobile perf budget).
export const LOOP_TICKS = 10;
export const WORLD_LOOP_TICKS = 20;

// Manor anchor. Front gate sits on the z = 1010 line.
export const ORIGIN = { x: 1000, y: 64, z: 1000 };

// The single ticking area for the whole run.
export const TICKING_AREA = {
  name: "ag_manor",
  center: { x: 1015, y: 65, z: 1022 },
  chunkRadius: 4
};

// Staggered build order. One function per build tick.
export const BUILD_STEPS = [
  "ag_build/00_clear",
  "ag_build/01_moor",
  "ag_build/02_foyer",
  "ag_build/03_nursery",
  "ag_build/04_cellar",
  "ag_build/05_mirror_wing",
  "ag_build/06_gallery",
  "ag_build/07_attic",
  "ag_build/08_props"
];

export const RUIN_STEPS = ["ag_ruin/00_collapse_a", "ag_ruin/01_collapse_b"];

// Rooms, in match order. Boxes never overlap, so the first hit is the answer.
//   South tower  : exterior x1009-1022, z1011-1027. Interior x1010-1021, z1012-1026.
//                  Foyer y64-70, Gallery y71-76, Attic y77-85.
//   North wing   : exterior  x999-1032, z1027-1041. Interior x1000-1031, z1028-1040.
//                  Nursery x1000-1008, Hall x1010-1021, Mirror Wing x1023-1031.
//   Cellar       : under the hall, floor y49, water y50, air y51-56.
export const ROOMS = [
  {
    id: "approach",
    act: 0,
    name: "The Approach",
    min: { x: 995, y: 60, z: 993 },
    max: { x: 1035, y: 80, z: 1010 },
    spawn: { x: 1015, y: 65, z: 996 },
    fog: "ag:manor_fog"
  },
  {
    id: "cellar",
    act: 3,
    name: "The Cellar of Names",
    min: { x: 1010, y: 49, z: 1027 },
    max: { x: 1021, y: 57, z: 1041 },
    spawn: { x: 1015, y: 51, z: 1029 },
    fog: "ag:cellar_fog"
  },
  {
    id: "nursery",
    act: 2,
    name: "The Nursery",
    min: { x: 1000, y: 64, z: 1027 },
    max: { x: 1009, y: 70, z: 1041 },
    spawn: { x: 1005, y: 65, z: 1029 },
    fog: "ag:manor_fog"
  },
  {
    id: "mirror_wing",
    act: 4,
    name: "The Mirror Wing",
    min: { x: 1022, y: 64, z: 1027 },
    max: { x: 1032, y: 70, z: 1041 },
    spawn: { x: 1027, y: 65, z: 1029 },
    fog: "ag:manor_fog"
  },
  {
    id: "gallery",
    act: 5,
    name: "The Portrait Gallery",
    min: { x: 1010, y: 71, z: 1012 },
    max: { x: 1021, y: 76, z: 1026 },
    spawn: { x: 1015, y: 72, z: 1014 },
    fog: "ag:manor_fog"
  },
  {
    id: "attic",
    act: 6,
    name: "The Attic Heart",
    min: { x: 1010, y: 77, z: 1012 },
    max: { x: 1021, y: 85, z: 1026 },
    spawn: { x: 1015, y: 78, z: 1014 },
    fog: "ag:manor_fog"
  },
  {
    id: "foyer",
    act: 1,
    name: "The Foyer",
    min: { x: 1010, y: 64, z: 1012 },
    max: { x: 1021, y: 70, z: 1041 },
    spawn: { x: 1015, y: 65, z: 1014 },
    fog: "ag:manor_fog"
  }
];

// Centre line of the Mirror Wing, used to invert the Reflection's movement.
export const MIRROR_WING_CENTRE_X = 1027;

// Fixed prop positions the script needs to reason about.
export const PROPS = {
  mailbox: { x: 1015, y: 65, z: 1000 },
  gate: { x: 1015, y: 65, z: 1010 },
  threshold: [
    { x: 1015, y: 65, z: 1010 },
    { x: 1015, y: 66, z: 1010 }
  ],
  clock: { x: 1011, y: 65, z: 1013 },
  frontDoor: { x: 1015, y: 65, z: 1011 },
  bedroomDoor: { x: 1015, y: 78, z: 1026 },
  wardrobes: [
    { x: 1002, y: 65, z: 1031 },
    { x: 1007, y: 65, z: 1036 }
  ],
  underBeds: [{ x: 1004, y: 65, z: 1029 }],
  toyBlocks: [
    { x: 1003, y: 65, z: 1033 },
    { x: 1004, y: 65, z: 1033 },
    { x: 1005, y: 65, z: 1033 },
    { x: 1006, y: 65, z: 1033 },
    { x: 1007, y: 65, z: 1033 }
  ],
  plaques: [
    { x: 1011, y: 51, z: 1039 },
    { x: 1012, y: 51, z: 1039 },
    { x: 1013, y: 51, z: 1039 },
    { x: 1014, y: 51, z: 1039 },
    { x: 1015, y: 51, z: 1039 },
    { x: 1016, y: 51, z: 1039 }
  ],
  mirrors: [
    { x: 1023, y: 65, z: 1039 },
    { x: 1024, y: 65, z: 1039 },
    { x: 1026, y: 65, z: 1039 },
    { x: 1028, y: 65, z: 1039 },
    { x: 1030, y: 65, z: 1039 }
  ],
  portraits: [
    { x: 1011, y: 73, z: 1012 },
    { x: 1013, y: 73, z: 1012 },
    { x: 1015, y: 73, z: 1012 },
    { x: 1017, y: 73, z: 1012 },
    { x: 1019, y: 73, z: 1012 }
  ],
  wallCandles: [
    { x: 1011, y: 78, z: 1014 },
    { x: 1020, y: 78, z: 1014 },
    { x: 1011, y: 78, z: 1024 },
    { x: 1020, y: 78, z: 1024 }
  ],
  pedestals: [
    { key: 1, at: { x: 1004, y: 65, z: 1039 } },
    { key: 2, at: { x: 1015, y: 51, z: 1031 } },
    { key: 3, at: { x: 1027, y: 65, z: 1031 } },
    { key: 4, at: { x: 1015, y: 72, z: 1024 } },
    { key: 5, at: { x: 1015, y: 78, z: 1021 } }
  ],
  brideSpawn: { x: 1015, y: 78, z: 1024 },
  watcherSpawn: { x: 1019, y: 72, z: 1025 },
  nannySpawn: { x: 1007, y: 65, z: 1039 },
  ghostSpawn: { x: 1018, y: 65, z: 1016 },
  escapeExit: { x: 1015, y: 65, z: 1009 },
  stayRoom: { x: 1011, y: 78, z: 1026 }
};

// Story pages: 12 hidden torn pages.
export const PAGES = [
  { id: 1, at: { x: 1010, y: 65, z: 1025 }, title: "Page I - The Engagement" },
  { id: 2, at: { x: 1021, y: 65, z: 1013 }, title: "Page II - The Dowry" },
  { id: 3, at: { x: 1000, y: 65, z: 1040 }, title: "Page III - The Nanny's Wage" },
  { id: 4, at: { x: 1008, y: 65, z: 1028 }, title: "Page IV - A Child's Sum" },
  { id: 5, at: { x: 1011, y: 51, z: 1029 }, title: "Page V - The Flood" },
  { id: 6, at: { x: 1020, y: 51, z: 1040 }, title: "Page VI - Six Names" },
  { id: 7, at: { x: 1023, y: 65, z: 1028 }, title: "Page VII - The Glazier" },
  { id: 8, at: { x: 1031, y: 65, z: 1040 }, title: "Page VIII - Left-Handed" },
  { id: 9, at: { x: 1010, y: 72, z: 1026 }, title: "Page IX - Sitting for Oil" },
  { id: 10, at: { x: 1021, y: 72, z: 1013 }, title: "Page X - The Order of Death" },
  { id: 11, at: { x: 1010, y: 78, z: 1026 }, title: "Page XI - The Veil" },
  { id: 12, at: { x: 1020, y: 78, z: 1013 }, title: "Page XII - What She Kept" }
];

export const PAGE_TEXT = {
  1: "He proposed in the rain. She said yes before he finished.",
  2: "Her father paid in bone-white silver. It never tarnished.",
  3: "The nanny was deaf in one ear. She listened with the floor.",
  4: "Five children. The sums in the ledger only ever reach four.",
  5: "The cellar took the water in one night and never gave it back.",
  6: "Six plaques. Only five of them were ever alive.",
  7: "The glazier hung the mirrors facing each other. On purpose.",
  8: "She parted her hair on the left. Every reflection parts right.",
  9: "Oil dries slow. Long enough for a sitter to change their mind.",
  10: "They died in order of height. Shortest first. Ask the frames.",
  11: "A veil is not for hiding. It is for keeping something in.",
  12: "She kept the room. She kept the night. She kept the last chair warm."
};

// The five names on the cellar plaques. Index 3 is the correct answer.
export const CELLAR_NAMES = [
  "Mercy Vane",
  "Alder Vane",
  "Josiah Vane",
  "Elowen Vane",
  "Tabitha Vane",
  "No Name At All"
];
export const CELLAR_ANSWER = 3;

// Music box melody the nursery toys must match: state value per block, left to right.
export const MELODY = [2, 0, 3, 1, 4];

// Order the portraits died, by portrait index.
export const PORTRAIT_ORDER = [3, 0, 4, 1, 2];

export const SANITY = {
  max: 100,
  darkDrain: 1.4,
  entityDrain: 2.2,
  candleRestore: 1.6,
  saltRestore: 3.0,
  tierWhisper: 50,
  tierHallucination: 25,
  tierFog: 10
};

export const CANDLE = {
  maxFuel: 1200,
  drainNormal: 2,
  drainDamp: 5,
  drainWindy: 4,
  refuel: 600
};

export const NOISE = {
  max: 100,
  sprint: 9,
  breakBlock: 22,
  door: 12,
  decay: 6,
  alertAt: 30,
  frenzyAt: 65
};

export const INTENSITY = {
  mild: { scareEvery: 1800, damageScale: 0.5, hallucinations: 1 },
  normal: { scareEvery: 1200, damageScale: 1.0, hallucinations: 2 },
  hard: { scareEvery: 900, damageScale: 1.4, hallucinations: 3 }
};

// Minimum quiet time, in ticks, before any major scare is allowed to fire.
export const SILENCE_TICKS = 1200;
// Telegraph window, in ticks, between the tell and the scare.
export const TELL_TICKS = 40;
