// Where everything is (metres, +Y up). Single source of truth for set.js, the location modules, cast.js and shots.
// Seven places, far apart along +X (only the current shot's place is visible; each has its own lights + sky).
export const FPS = 30;
export const W = 1080, H = 1920;
export { DURATION } from './plan.js';

// ---------------------------------------------------------------- 1. STREET (origin): rainy evening, blue hour
// Shop / building fronts along x at z = 0 (facing -Z); sidewalk z -3.2..0 (top y 0.12); road z -10.8..-3.2 (y 0).
// The camera usually looks toward +Z (at the shops) from the road side.
export const STREET = {
  wallZ: 0, curbZ: -3.2, roadZ1: -10.8, farZ: -14.2, sideY: 0.12, x0: -34, x1: 40,
  // the small round bush YOU hides in: a dense ring of leaves around a hollow centre (he crouches in the middle,
  // only his head + shoulders show above it from ANY side). Centre on the sidewalk, in a square of dirt.
  bush: { pos: [2.0, -2.2], r: 0.66, h: 0.98 },
  lamp: { pos: [4.45, -2.85] },                  // street lamp next to the bush
  cart: { pos: [0.55, -1.15], rotY: 0.5 },        // YOU's shopping cart (everything he owns)
  // the black stretch limousine parks at the curb, nose toward +X; its rear passenger door (curb side, +Z) opens
  // right next to the bush, the front passenger door (curb side) is where the bodyguard jumps out.
  // (parked at limoX = -0.75: rear door ~3.3 m left of the bush, front door right next to it; the original numbers
  //  below are for limoX = 2.3, shots park it at PARKED_X)
  limo: { pos: [2.3, -4.3], len: 7.2, wid: 2.0, hgt: 1.45, rearDoorX: 1.75, frontDoorX: 4.55, arriveFromX: 26, parkedX: -0.75 },
  // where the people stand (for the parked limo at -0.75)
  ladyOut: { pos: [-1.3, -3.05] },                // her first step out of the limo (curb)
  ladyAtBush: { pos: [2.0, -3.0] },               // in front of the bush (road side), facing +Z
  guardOut: { pos: [1.5, -3.0] },
  // (from the mansion reel's street, still used by set_city.js: shop doors along the row)
  sit: { pos: [-2.2, -0.62], rotY: Math.PI },
  shops: [{ x: 4.5, kind: 'cafe', keeper: 'cafe' }, { x: 11.0, kind: 'pizza', keeper: 'chef' }, { x: 17.5, kind: 'store', keeper: 'clerk' }],
  doorW: 1.3, doorH: 2.4,
};

// ---------------------------------------------------------------- 2. VOID: the "what you don't know" fact
export const VOID = { origin: [300, 0], brain: [300, 1.6, 0], watch: [300, 1.6, 0] };

// ---------------------------------------------------------------- 3. RESTAURANT: super fancy, gold + chandeliers
// Room x 592..608, z -6..10, floor y 0, ceiling 5.2. Couple's round table at (600, 2.0); YOU sits on its -X side
// facing +X, the lady on the +X side facing -X (a side camera from -Z sees both in profile, the room behind).
export const RESTAURANT = {
  origin: [600, 0], room: { x0: 592, x1: 608, z0: -6, z1: 10, ceil: 5.2 },
  table: { pos: [600, 2.0], r: 0.55, h: 0.76 },
  youSeat: { pos: [599.25, 2.0], rotY: Math.PI / 2 }, ladySeat: { pos: [600.75, 2.0], rotY: -Math.PI / 2 },
  seatY: 0.47,
  waiter: { pos: [601.35, 3.15], rotY: -2.4 },      // standing by the table with his tray
  piano: { pos: [603.5, 7.6] },
};

// ---------------------------------------------------------------- 4. PARIS: park with the Eiffel Tower behind
export const PARIS = {
  origin: [900, 0], bush: { pos: [900, 0], r: 0.66, h: 0.98 },   // same kind of hollow round bush
  lady: { pos: [900.95, -0.35], rotY: -1.2 },
  tower: { pos: [906, 78], h: 62 },             // big in the background when the camera looks +Z
};

// ---------------------------------------------------------------- 5. WEDDING: garden, flower arch, white chairs
// Arch at z 5 (couple under it, facing each other along x); chairs face +Z in rows z 0..3 on both sides of the
// aisle (x = 1200); the bodyguard sits in the front row (z 3.0) on the right (+X) side.
export const WEDDING = {
  origin: [1200, 0], arch: { pos: [1200, 5.0] },
  you: { pos: [1199.55, 5.0], rotY: Math.PI / 2 }, bride: { pos: [1200.45, 5.0], rotY: -Math.PI / 2 },
  rows: [0.0, 1.0, 2.0, 3.0], seatY: 0.45, aisle: 0.8, seatsPerSide: 4, seatGap: 0.62,
  guard: { pos: [1201.25, 3.0], rotY: 0 },
};

// ---------------------------------------------------------------- 6. PORCH: cosy wooden house at sunset
// House front at z = 2.2 (facing -Z); porch deck z 0..2.2 at y 0.45; porch swing (seat y 0.95) at (1500, 1.2);
// garden in front (z -1..-9) with round bushes + flowers, white picket fence at z -9.
export const PORCH = {
  origin: [1500, 0], deckY: 0.45, houseZ: 2.2,
  swing: { pos: [1500, 1.25], seatY: 0.95, w: 1.5 },
  you: { pos: [1499.62, 1.25] }, lady: { pos: [1500.38, 1.25] },
  fenceZ: -9,
};

// ---------------------------------------------------------------- 7. INTERIOR: the framed handkerchief
// A living-room wall at z = 0 (facing -Z), floral wallpaper; the golden frame hangs at (1800, 1.75).
export const INTERIOR = { origin: [1800, 0], frame: { pos: [1800, 1.75, -0.04], w: 0.62, h: 0.52 } };

// which place each shot is in (1-based shot number)
export function locOf(n) {
  if (n <= 22) return 'street';
  if (n <= 24) return 'void';
  if (n <= 26) return 'street';
  if (n <= 30) return 'restaurant';
  if (n <= 33) return 'paris';
  if (n <= 35) return 'wedding';
  if (n === 40) return 'interior';
  return 'porch';
}
