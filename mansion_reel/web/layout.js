// Where everything is (metres, +Y up). Single source of truth for set.js, cast.js, animals.js and the shots.
// Facades face -Z (the camera usually looks toward +Z); the low sunset sun is behind the camera, to its left (+X).
export const FPS = 30;
export const W = 1080, H = 1920;
export { DURATION } from './plan.js';

// sun: direction FROM the scene TOWARD the sun (normalised in set.js)
export const SUN = { dir: [0.62, 0.36, -0.7], color: '#ffc58a', intensity: 2.6 };
export const SKY = { top: '#5c88c8', mid: '#f0b98a', horizon: '#ffd7a0', glow: '#ff9a52' };

// ---------------------------------------------------------------- 1. city street (origin)
// Shop / building fronts along x at z = 0 (facing -Z); sidewalk z -3.2..0 (top y 0.12); road z -10.8..-3.2.
export const STREET = {
  wallZ: 0, curbZ: -3.2, roadZ1: -10.8, farZ: -14.2, sideY: 0.12, x0: -34, x1: 40,
  sit: { pos: [-2.2, -0.62], rotY: Math.PI },              // YOU on flattened cardboard against the brick wall
  shops: [                                                  // door centre x, shop kind, shopkeeper
    { x: 4.5, kind: 'cafe', keeper: 'cafe' },
    { x: 11.0, kind: 'pizza', keeper: 'chef' },
    { x: 17.5, kind: 'store', keeper: 'clerk' },
  ],
  doorW: 1.3, doorH: 2.4,
};

// ---------------------------------------------------------------- 2. the mansion (front door at z = 100, facing -Z)
export const MANSION = {
  z: 100, floorY: 1.2, width: 52, height: 17.5,
  door: { x: 0, w: 4.4, h: 6.6 },                           // giant golden double door (2 leaves)
  porch: { z0: 95.0, z1: 100, steps: 6 },                   // marble steps up to the porch (y 0 -> floorY)
  fountain: [0, 76], drive: { r: 14 },
};
export const PORCH_SPOT = { pos: [0.15, 98.75], rotY: 0 };   // YOU knocking (facing the door, +Z)
export const DOORWAY_SPOT = { pos: [0, 101.0], rotY: Math.PI }; // the rich guy in the open doorway (facing -Z)

// ---------------------------------------------------------------- 3. the gold hallway (inside, from the door to +Z)
export const HALL = { z0: 100.3, z1: 182, x0: -2.6, x1: 2.6, floorY: 1.2, ceilY: 6.4, bay: 4.0 };
export const YOUR_DOOR = { x: 2.6, z: 112, w: 1.25, h: 2.7 }; // on the right wall (+X) - "your own bathroom"

// ---------------------------------------------------------------- 4. the big bathroom at the end of the hallway
export const BATH = { z0: 182, z1: 195, x0: -6.5, x1: 6.5, floorY: 1.2, ceilY: 6.4, door: { x: 0, w: 1.6, h: 3.0 } };
export const THRONE = { pos: [0, 190.4], rotY: Math.PI, platform: 0.36, seatH: 0.5 };  // golden toilet, facing the door (-Z)
// the control panel sits on the toilet's right armrest (YOU's right when seated = world -X when facing -Z)

// ---------------------------------------------------------------- 5. your own bathroom (behind YOUR_DOOR)
export const MYBATH = { x0: 2.6, x1: 8.8, z0: 108.4, z1: 115.6, floorY: 1.2, ceilY: 4.2 };
export const MYTHRONE = { pos: [7.6, 112], rotY: -Math.PI / 2 };     // one-button toilet, facing the door (-X)

// ---------------------------------------------------------------- 6. the zoo (New York) - far away on +X
export const ZOO = { x: 600, z: 0, pool: { x: 601.6, z: 4.4, r: 2.4 }, rocks: { x: 599.2, z: 0.4 }, skylineZ: [115, 265] };
export const PENGUINS = { roy: [598.75, 0.2], silo: [599.55, 0.25], nest: [599.15, 0.55] };
