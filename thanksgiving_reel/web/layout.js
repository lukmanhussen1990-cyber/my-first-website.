// THE single source of truth for where things are. Units: meters. +Y up.
// Table is centred on the origin with its long axis along X.
// "Back" side = -Z (window wall). "Front" side = +Z (photo wall).
// YOU sit on the back side in the middle, facing +Z, so the camera looking -Z sees YOU's face
// with the window + autumn tree behind. Uncle sits opposite YOU, facing -Z.
//
// Every module must respect these numbers so nothing intersects. If a module needs to move
// something, change it HERE (and say so) rather than hard-coding a different value elsewhere.

export const ROOM = {
  minX: -3.0, maxX: 3.0,        // side walls (inner faces)
  minZ: -2.4, maxZ: 2.6,        // back wall (window) / front wall (photos)
  height: 2.7,                  // ceiling (inner face)
  wallThick: 0.12,
  baseboardH: 0.1,
};

export const WINDOW = { // on the back wall (z = ROOM.minZ)
  cx: -0.55, bottom: 0.85, width: 1.5, height: 1.4,   // opening x in [cx-w/2, cx+w/2], y in [bottom, bottom+height]
};

export const TABLE = {
  minX: -1.3, maxX: 1.3, minZ: -0.55, maxZ: 0.55,
  topY: 0.76,                   // top surface of the tablecloth (things sit at this height)
  thick: 0.04,                  // table top thickness (under the cloth)
  clothDrop: 0.10,              // cloth hangs 10 cm down at the edges -> bottom at 0.66 (thighs pass under it)
  legInset: 0.1, legSize: 0.08, // legs at the 4 corners only
};
export const TABLE_UNDER_Y = TABLE.topY - TABLE.clothDrop; // 0.66: nothing (knees, thighs) may be above this under the table edge

export const CHAIR = {
  seatY: 0.46, seatW: 0.44, seatD: 0.42, backTopY: 1.02, backThick: 0.05,
  // chair "pos" below is the centre of the seat; chair faces the table (rotY as in SEATS)
};

// Seats. pos = seat centre on the chair (x, z) ; rotY = direction the person faces
// (rotY=0 faces +Z, Math.PI faces -Z, -PI/2 faces -X).
// plate = plate centre on the table top (x, z).
export const SEATS = {
  grandma: { pos: [-0.85, -0.86], rotY: 0,            plate: [-0.85, -0.33] },
  you:     { pos: [0.0, -0.86],   rotY: 0,            plate: [0.0, -0.33] },
  cousinA: { pos: [0.85, -0.86],  rotY: 0,            plate: [0.85, -0.33] },   // girl, ~12
  mom:     { pos: [-0.85, 0.86],  rotY: Math.PI,      plate: [-0.85, 0.33] },
  uncle:   { pos: [0.0, 0.9],    rotY: Math.PI,      plate: [0.0, 0.33] },      // big belly -> chair 3 cm further back
  dad:     { pos: [0.85, 0.86],   rotY: Math.PI,      plate: [0.85, 0.33] },
  cousinB: { pos: [1.63, 0.0],    rotY: -Math.PI / 2, plate: [1.08, 0.0] },      // boy, ~9, head of table (+X end)
};

// Place setting around each plate (offsets in the diner's local frame: +x = diner's right, +z = toward table centre)
export const PLACE = {
  plateR: 0.13, plateH: 0.018,
  fork: [-0.19, 0.0],      // left of plate
  knife: [0.19, 0.0],      // right of plate
  glass: [0.17, 0.17],     // upper right
  napkin: [-0.19, 0.0],    // under fork
};

// Serving dishes on the centre strip (z in [-0.18, 0.18]). x,z = centre on the table top.
export const DISHES = {
  rolls:      { x: -1.06, z: 0.02 },   // basket of dinner rolls
  corn:       { x: -0.74, z: 0.04 },   // corn on the cob on an oval dish
  turkey:     { x: -0.32, z: 0.00 },   // roast turkey on a big oval platter (platter ~0.46 x 0.32)
  cranberry:  { x: 0.02,  z: 0.12 },   // cranberry sauce (can-shaped jelly with ridges) on a small dish
  candles:    [{ x: 0.15, z: -0.12 }, { x: -0.62, z: -0.13 }],  // tall candles in holders (kept off the YOU-uncle sight line x=0)
  potatoes:   { x: 0.26,  z: 0.03 },   // bowl of mashed potatoes with a butter pat
  gravy:      { x: 0.47,  z: -0.12 },  // gravy boat (spout points -X)
  beans:      { x: 0.66,  z: 0.08 },   // bowl of green beans
  pie:        { x: 0.93,  z: -0.06 },  // pumpkin pie on a pie dish, one slice missing
};

// Grandma's standing serving spot (her chair is slid back to CHAIR_PULLED when she stands)
export const GRANDMA_STAND = { pos: [-0.46, -0.76], rotY: Math.PI * 0.16 }; // beside YOU, turned toward his plate
export const GRANDMA_CHAIR_PULLED = [-0.95, -1.22];

// Furniture along the walls (keep cameras out of these volumes)
export const FURNITURE = {
  sideboard: { x: 0.0, z: 2.6 - 0.25, w: 1.8, d: 0.45, h: 0.9 },     // front wall, under the photos
  hutch:     { x: 3.0 - 0.25, z: -0.2, w: 0.45, d: 1.4, h: 2.0 },     // china cabinet on the +X wall
  plant:     { x: -2.6, z: -2.0 },                                    // corner plant / pumpkin stack
  chandelier:{ x: 0.0, z: 0.0, bottomY: 1.95 },                       // hangs over the table (keep cameras below 1.9 near it)
};

// Heights to aim cameras at
export const EYE = { seated: 1.18, seatedKid: 1.02, standing: 1.55 };

// Video
export const FPS = 30;
export const DURATION = 50.0;  // seconds (1500 frames)
export const W = 1080, H = 1920;
