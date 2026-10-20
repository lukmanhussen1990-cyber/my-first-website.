// Master timeline (seconds). Each voice line sits in a fixed slot, so a new
// recording of the same line (tools/voices.py, revoice.sh) drops into the same
// place without re-rendering the 3D. Animation beats are placed on the words of
// the current takes (assets/vo/<id>.words.json, absolute times in the comments).

export const FPS = 30;
export const DURATION = 49.5;

// voice slots: line id (script.json) and where its file starts in the reel
export const VO = [
  { id: 'n1', at: 1.0 }, //  "dig a hole" 1.28-1.62, "bury" 2.14, "report card" 2.9-3.28, "nobody" 4.04, "find it" 4.88, "Sort of." 5.86
  { id: 'n2', at: 7.2 }, //  "dog" 7.44, "digs" 7.74, "right back up" 8.2-8.74, "dig deeper" 9.78-9.98, "way below" 10.78, "reach" 12.1
  { id: 'n3', at: 14.3 }, // "rain" 14.44, "hole to mud" 15.24-15.64, "card floats up" 16.28-16.84, "seal" 17.94, "metal box" 18.7-18.94
  { id: 'n4', at: 21.6 }, // "fresh dirt" 21.86-22.1, "suspicious" 22.7, "plant flowers" 24.04-24.28, "on top" 24.74-25.02
  { id: 'n5', at: 26.4 }, // "box" 26.62, "lump" 27.36, "lawn" 27.82, "roll" 28.9, "ground" 29.36, "perfectly flat" 29.7-30.22
  { id: 'n6', at: 32.0 }, // "Congratulations" 32.03, "hid" 33.56, "report card" 33.88-34.2, "forever" 34.58
  { id: 'dad', at: 46.0 }, // "Hmm..." 46.04, "a C" 46.31-46.41, "science?" 46.72-47.3
];

export const SCENES = [0.0, 6.8, 13.9, 21.2, 26.1, 31.4, 36.4, DURATION];

export const T = {
  // 1 - the report card, the shovel, a small hole, buried just under the grass
  gulp: 0.45, // the kid stares at the big red C and gulps
  shovelIn: 1.05, // a shovel pops into the right hand, on "dig"
  dig1: [1.4, 1.8, 2.2], // three scoops: the hole opens (each = when the blade comes up)
  cardDrop: 2.55, // flicks the card in on "bury"; it flutters down and lands by "card"
  cardLand: 3.05,
  fill1: [3.5, 3.95], // two scoops back from the pile
  pat: [4.45, 4.75], // pats the dirt flat with the back of the shovel
  proud1: 5.0, // looks around, satisfied ("nobody will ever find it")
  dogPeek: 5.75, // "Sort of.": the dog's head pops out of the doghouse, ears up, sniffs
  // 2 - the dog digs it back up; the kid digs deep (inside the hole), climbs out, refills
  dogGo: 6.4, // trots from the doghouse to the patch
  dogArrive: 7.25,
  sniff: [7.35, 7.55],
  dogDig0: 7.65, // paws fly, dirt sprays back ("digs" 7.74)
  dogDig1: 8.4,
  dogGrab: 8.45, // head down, card in the mouth, lifts it on "right back up"
  bark: 8.95, // proud muffled happy bark, tail going
  snatch: 9.3, // the kid grabs the card back ("So you")
  deep0: 9.6, // jumps in and digs down fast, dirt flying up and out ("dig deeper")
  deep1: 11.85, // at the bottom (2.5 m)
  pawLine: 10.75, // a glowing dashed line + paw marks the dog's reach, on "way below"
  cardDown: 12.0, // places the card at the bottom
  ladderIn: 12.15, // a ladder pops in, he climbs out
  climb0: 12.25,
  climb1: 12.85,
  ladderOut: 12.95,
  refill0: 13.05, // pushes the whole pile back in, the hole fills to the top
  refill1: 13.8,
  // 3 - storm, rain, water soaks down (glowing dots), mud, the card floats up, the metal box
  storm0: 13.7, // dark clouds roll in
  storm1: 14.5,
  rain0: 14.35, // rain starts on "rain"
  soak0: 14.6, // water front starts down through the soil
  soak1: 15.9,
  mud0: 15.1, // the filled hole turns to mud ("hole to mud" 15.24-15.64)
  mud1: 15.7,
  float0: 15.95, // the card floats up through the mud ("card floats up" 16.28-16.84)
  float1: 16.85,
  fish: 17.1, // the kid fishes it out and shakes the mud off
  box0: 17.6, // the box snaps together piece by piece ("seal" 17.94)
  boxGap: 0.12,
  boxLid: 18.3, // lid pops on, open, hinged
  cardIn: 18.45, // the card goes inside
  click: 18.92, // lid clicks shut on "box"
  sink0: 19.15, // the box sinks into the mud and down deep
  sink1: 20.45,
  rain1: 20.3, // rain stops
  storm2: 20.4, // clouds clear, golden light back
  storm3: 21.6,
  dry0: 20.8, // the mud dries into fresh dirt
  dry1: 21.9,
  // 4 - the fresh dirt patch looks suspicious; flowers pop up one by one
  sus: 22.7, // a glowing outline pulses round the patch on "suspicious"
  flowers0: 24.0, // first flower ("plant flowers" 24.04)
  flowerGap: 0.13, // then one every flowerGap (8 flowers, done by "top")
  // 5 - the lump; the garden roller flattens it; the flowers spring back up
  lump0: 26.75, // the patch bulges up ("lump" 27.36)
  lump1: 27.45,
  rollIn: 28.35, // the kid pushes the roller in from the right
  roll0: 28.85, // over the lump ("roll" 28.9) ...
  roll1: 30.0, // ... to the left side of it ("flat" 30.22)
  rollOut: 30.55, // the roller pops away
  sparkle: 30.75, // a little twinkle on the perfectly flat lawn
  // 6 - proud kid, pull back to the whole backyard at sunset
  dust0: 31.55, // dusts off the hands (three claps, little puffs)
  proud2: 32.4, // hands on hips, big proud smile
  wide0: 32.6, // camera pulls back...
  wide1: 35.2, // ...to the whole backyard
  kidWalk0: 33.4, // the kid strolls over to the dog by the doghouse
  kidWalk1: 35.4,
  // 7 - Dad, the metal detector, the dig, the box, the card, one eyebrow
  door: 35.35, // the back door opens
  dadOut: 35.6, // Dad steps out, humming (little glowing notes)
  dadArrive: 39.5, // reaches the flower bed, sweeping the detector over the lawn
  beep0: 38.9, // first beep; faster and faster ...
  beep1: 41.25, // ... to a steady squeal over the flowers
  dadDig0: 41.45, // detector away, shovel in, a cartoon flurry in a dust cloud
  dadDig1: 43.0,
  boxUp: 43.15, // the dust clears: Dad holds the box
  creak0: 43.55, // the lid creaks open
  creak1: 44.15,
  cardOut: 44.35, // pulls out the card, holds it up, reads
  read: 44.75,
  brow: 45.45, // one eyebrow up
  musicStop: 45.75, // the music stops dead
  // dad line 46.0-47.35
  gulp2: 48.25, // the kid gulps (after the subtitle clears)
};

// camera keys: t, frame centre x, ground row (pixel row of y = 0 at the cut face),
// scale (pixels per metre at the cut face) and camera height (perspective only).
// Between keys the camera eases (C1-smooth), so pans and push-ins never jerk.
// The subtitle band is rows ~790-930: in the medium shots (row 690, 200-215 px/m)
// it covers the soil from ~0.5 to ~1.2 m deep, so nothing important happens there.
export const CAM = [
  { t: 0.0, cx: 0.66, row: 1060, s: 470, cy: 1.1 }, // close on the kid and the card
  { t: 0.75, cx: 0.64, row: 1060, s: 488, cy: 1.1 },
  { t: 1.75, cx: 0.22, row: 690, s: 236, cy: 2.4 }, // the yard and the cutaway
  { t: 5.3, cx: 0.12, row: 690, s: 238, cy: 2.4 },
  { t: 7.0, cx: -0.55, row: 690, s: 228, cy: 2.4 }, // the dog trots in from the left
  { t: 8.85, cx: -0.35, row: 735, s: 278, cy: 2.0 }, // push in: the dog, proud, card in mouth
  { t: 9.5, cx: -0.3, row: 735, s: 278, cy: 2.0 },
  { t: 10.7, cx: 0.05, row: 690, s: 222, cy: 2.4 }, // the deep hole
  { t: 13.9, cx: 0.05, row: 690, s: 222, cy: 2.4 },
  { t: 17.2, cx: 0.15, row: 700, s: 233, cy: 2.4 },
  { t: 18.9, cx: 0.15, row: 720, s: 278, cy: 2.2 }, // the box
  { t: 20.6, cx: 0.1, row: 690, s: 228, cy: 2.4 },
  { t: 21.6, cx: 0.05, row: 700, s: 239, cy: 2.3 },
  { t: 23.1, cx: 0.0, row: 735, s: 294, cy: 2.0 }, // push in on the suspicious patch
  { t: 25.6, cx: 0.0, row: 740, s: 300, cy: 2.0 },
  { t: 27.0, cx: 0.15, row: 715, s: 262, cy: 2.2 }, // the lump and the roller
  { t: 31.0, cx: 0.2, row: 715, s: 262, cy: 2.2 },
  { t: 32.6, cx: 0.35, row: 735, s: 283, cy: 2.0 }, // the proud kid
  { t: 35.2, cx: 1.6, row: 800, s: 95, cy: 5.0 }, // the whole backyard at sunset
  { t: 37.3, cx: 1.55, row: 800, s: 97, cy: 5.0 },
  { t: 39.6, cx: 0.1, row: 700, s: 235, cy: 2.4 }, // Dad at the flower bed
  { t: 41.3, cx: 0.15, row: 720, s: 253, cy: 2.3 },
  { t: 43.2, cx: 0.1, row: 760, s: 266, cy: 2.2 },
  { t: 44.6, cx: -0.1, row: 880, s: 285, cy: 1.8 }, // push in on Dad reading
  { t: 46.4, cx: -0.15, row: 935, s: 300, cy: 1.7 },
  { t: 49.5, cx: -0.15, row: 940, s: 305, cy: 1.7 },
];
