// Where everything is (metres, +Y up). Single source of truth for set.js, set_bus.js, cast.js and the shots.
// One place: the BUS on a long tree-lined street. The bus drives toward -Z; its group sits at world z = busZ(t)
// (no rotation), so everything inside is given in BUS-LOCAL coordinates (x across, y up from the floor, z along
// the bus) and moved by busZ(t) (see B() in shotlib.js). The street is static in the world.
export const FPS = 30;
export const W = 1080, H = 1920;
export { DURATION } from './plan.js';

export const BUS = {
  len: 12.0, z0: -6.0, z1: 6.0,               // front (windshield) at z0, back at z1
  halfW: 1.27, inner: 1.2, ceil: 2.25, roof: 2.48,
  roadY: -0.42, curbY: -0.27, curbX: 1.95,    // road surface, sidewalk height, right curb (bus side)
  win: { y0: 0.95, ySlide: 1.32, y1: 1.95 },  // side windows: fixed lower pane, upper pane slides open
  bays: [-3.825, -2.55, -1.275, 0.0, 1.275, 2.55, 3.825, 5.1],   // window bay centres (width 1.2)
  rows: [-3.4, -2.55, -1.7, -0.85, 0.0, 0.85, 1.7, 2.55, 3.4, 4.25, 5.1],
  seatX: { win: 0.93, aisle: 0.5 }, seatY: 0.46,
  frontDoor: { z0: -5.55, z1: -4.6 },          // right side
  midDoor: { z0: 1.3, z1: 2.25 },              // right side (no right-side seats in front of it)
  me: { row: 0.0 },                            // ME on the right side, AISLE seat; the window seat next to him is empty
  driver: { pos: [-0.72, -5.0] },
  mirror: { pos: [-0.28, 2.0, -5.8], w: 0.56, h: 0.2, eye: [-0.72, 1.42, -4.93], cam: [-0.5, 1.52, -4.72] },
  poles: [-3.0, -1.275, 0.42, 3.0, 4.7],       // vertical aisle poles (both sides, x = +-0.3)
};

// ---------------------------------------------------------------- the bus's motion (pure function of t)
// speed (m/s): cruise -> slow into the stop (the crush gets on) -> go -> HARD BRAKE -> stand -> drive away
export const SPEED_KEYS = { cruise: 8.5, stop0: 5.4, stop1: 7.0, go0: 9.9, go1: 12.2, brake0: 26.968, brake1: 27.42, away0: 30.72 };
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function busSpeed(t) {
  const K = SPEED_KEYS, v = K.cruise;
  if (t < K.stop0) return v;
  if (t < K.stop1) return v * (1 - sm((t - K.stop0) / (K.stop1 - K.stop0)));
  if (t < K.go0) return 0;
  if (t < K.go1) return v * sm((t - K.go0) / (K.go1 - K.go0));
  if (t < K.brake0) return v;
  if (t < K.brake1) return v * Math.pow(1 - (t - K.brake0) / (K.brake1 - K.brake0), 1.4);
  if (t < K.away0) return 0;
  return Math.min(v * 1.4, 6.5 * (t - K.away0));
}
const DT = 1 / 120;
let _bt = null, _bz = 0;
export function busZ(t) {       // world z of the bus origin (starts at 0, drives toward -Z)
  if (t === _bt) return _bz;
  let z = 0, u = 0;
  while (u < t) { const d = Math.min(DT, t - u); z -= busSpeed(u + d / 2) * d; u += d; }
  _bt = t; _bz = z;
  return z;
}
// seats taken by the rigged characters (bus-local [x, row z]); everything else gets a crowd extra
export const RESERVED = [[0.5, 0.0], [0.93, 0.0], [0.5, -0.85], [0.93, -0.85], [0.5, 0.85], [0.93, 0.85], [-0.5, 0.0]];
export const STOP_Z = busZ(SPEED_KEYS.stop1);     // where the crush gets on (bus stop on the right sidewalk)
export const BRAKE_Z = busZ(SPEED_KEYS.brake1);   // where everyone gets off

export function locOf() { return 'bus'; }
// legacy names other engine modules import (unused here)
export const HOUSE = { door: { x: 0, z: 0 } }, VOID = { origin: [300, 0], brain: [300, 1.6, 0], watch: [300, 1.6, 0] };
export const STREET = { sideY: 0, bush: { pos: [0, 0] }, limo: { parkedX: 0 }, ladyOut: { pos: [0, 0] }, guardOut: { pos: [0, 0] } };
