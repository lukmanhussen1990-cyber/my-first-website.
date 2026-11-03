// Where everything is (metres, +Y up). Single source of truth for set.js, the place modules, cast.js and shots.
// Two places, far apart along +X (only the current shot's place is visible; each has its own lights + sky).
export const FPS = 30;
export const W = 1080, H = 1920;
export { DURATION } from './plan.js';

// ---------------------------------------------------------------- 1. HOUSE (origin): the nephew's 6th birthday party
// Living room x -4.2..4.0, z -3.6..3.8, ceiling 2.75. The couch is on the back wall (z 3.8, facing -Z), the
// bathroom door is in the right wall (x 4.0), the party table with the cake on the left, a window in the left wall.
// The camera usually looks toward +Z / +X from the front-left of the room.
export const HOUSE = {
  room: { x0: -4.2, x1: 4.0, z0: -3.6, z1: 3.8, ceil: 2.75 },
  // bathroom door: in the wall x = 4.0, centre z 0.9; hinge on its -Z edge, it swings into the bathroom (+X)
  door: { x: 4.0, z: 0.9, w: 0.86, h: 2.04 },
  bath: { x0: 4.0, x1: 6.6, z0: -0.6, z1: 2.4, ceil: 2.5 },
  toilet: { pos: [6.2, 0.9], rotY: -Math.PI / 2, seatY: 0.44 },   // faces the door (-X)
  sink: { pos: [5.05, 2.12] },
  couch: { pos: [-0.6, 3.22], w: 2.1, seatY: 0.46, seats: [-1.32, -0.6, 0.12] },  // seats = x of the 3 cushions
  armchair: { pos: [1.85, 2.95], rotY: Math.PI - 0.55, seatY: 0.46 },
  coffee: { pos: [-0.6, 2.05] },
  table: { pos: [-2.45, 0.55], w: 1.7, d: 0.9, h: 0.74 },          // party table (cake, plates, cups)
  momChair: { pos: [-2.45, 1.25], rotY: Math.PI },                // the empty chair with the "MOM" card (back side)
  window: { z: 0.9 },
  front: { z: -1.75, w: 0.95, h: 2.08 },                          // front door in the left wall
  kitchen: { x: -3.3, z: 3.5, stoveX: -3.3 },                     // counter along the back wall, back-left
  // where people stand
  kidAtTable: { pos: [-2.0, -0.05], rotY: 0 },
  kidAtDoor: { pos: [3.38, 1.02], rotY: Math.PI / 2 },             // in front of the bathroom door, facing it (+X)
  youPeek: { pos: [4.32, 1.18], rotY: -Math.PI / 2 },              // behind the door crack, head out toward the room
  youOut: { pos: [3.55, 0.9], rotY: -Math.PI / 2 },                // stepped out of the bathroom
  uncle: { pos: [0.95, 2.45], rotY: Math.PI + 0.75 },
};

// ---------------------------------------------------------------- 2. VOID: concept shots + the "what you don't know" fact
export const VOID = { origin: [300, 0], brain: [300, 1.6, 0], watch: [300, 1.6, 0], roll: [300, 1.55, 0] };

// legacy names some engine modules still import (unused here)
export const STREET = { sideY: 0, bush: { pos: [0, 0] }, limo: { parkedX: 0 }, ladyOut: { pos: [0, 0] }, guardOut: { pos: [0, 0] } };
export const RESTAURANT = { origin: [600, 0] }, PARIS = { origin: [900, 0] }, WEDDING = { origin: [1200, 0] }, PORCH = { origin: [1500, 0] }, INTERIOR = { origin: [1800, 0] };

export function locOf(n) { return n === 2 || n === 3 || n === 15 || n === 16 ? 'void' : 'house'; }
