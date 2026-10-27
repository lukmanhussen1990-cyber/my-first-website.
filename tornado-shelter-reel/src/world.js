// World layout (metres): x right, y up, z towards the camera. The cutaway face is
// the plane z = 0; the lawn is y = 0. Everything in front of z = 0 has been cut
// away, so the shelter and the soil are seen in section, like a slice of cake.
//
//   x  -1.8 ... -1.5   left wall
//      -1.5 ...  1.3   the room (2.8 m inside, 2.15 m high, back wall at z = -2.3)
//       1.3 ...  1.6   wall between the room and the stairs (a doorway at the bottom)
//       1.6 ...  3.9   the stairwell: steep steps down from the right to the left
//       3.9 ...  4.2   right wall
// The roof slab is 30 cm thick and stands 15 cm proud of the lawn; the floor slab
// is 30 cm thick. A steel hatch door covers the top of the stairs.
import { T } from './timeline.js';
import { clamp, lerp, smooth, smoother, easeOutCubic, easeInOutSine, prog } from './util.js';

export const WALL = 0.3;
export const ROOM = { x0: -1.5, x1: 1.3, zb: -2.3 }; // inside
export const STAIR = { x0: 1.6, x1: 3.9, zb: -1.2 }; // inside
export const OUT = { x0: -1.8, x1: 4.2, zb: -2.6 }; // outside of the whole structure (the pit)
export const FLOOR = -2.3, FLOOR_B = -2.6, CEIL = -0.15, TOP = 0.15;
export const HATCH = { x0: 2.2, x1: 3.9, z0: -1.2, z1: 0 }; // the opening at the top of the stairs
export const DOORWAY = { y1: -0.5 }; // in the shared wall, from the floor up to here
// steps: 8 steps from the top down to the floor, rise and going
export const STEPS = { n: 8, rise: (TOP - FLOOR) / 9, run: 0.24 };
export const stepTop = (i) => TOP - (i + 1) * STEPS.rise; // i = 0 .. n-1
export const stepX = (i) => STAIR.x1 - (i + 1) * STEPS.run; // left edge of step i
// height of the stair surface (the step a foot stands on) at x
export function stairY(x) {
  if (x >= STAIR.x1) return 0;
  const i = Math.floor((STAIR.x1 - x) / STEPS.run);
  return i >= STEPS.n ? FLOOR : stepTop(i);
}
export const BENCH = { x0: -1.42, x1: 0.18, z0: -2.3, z1: -1.86, seat: FLOOR + 0.46 }; // along the back wall
export const SHELF = { x0: 0.32, x1: 1.24, z0: -2.3, z1: -1.92, h: 1.85 }; // steel shelving on the back wall
export const VENTS = [{ x: -0.85, z: -1.05 }, { x: 0.75, z: -1.05 }];
export const ANCHORS = [-1.25, -0.2, 0.85, 2.35, 3.6]; // x of the ground anchors under the floor slab
export const ANCHOR_D = 2.0; // how far below the floor slab they reach
export const LAMP = { x: -0.15, y: CEIL - 0.02, z: -1.15 };

// the yard
export const FENCE_Z = -9.0;
export const GATE = { x: 6.6, w: 1.1 }; // a gate in the back fence (the family comes through it)
export const HOUSE = { x0: -2.4, x1: 9.6, z: -16.0, depth: 9.0, floor: 0.35, story: 3.0, eave: 6.6, ridge: 9.4 };
export const TREE = { x: 5.4, z: -5.2 };
export const SHED = { x: -4.4, z: -6.6, w: 2.2, d: 1.8, h: 2.1 };
export const LANE = -0.62; // where people walk on the lawn (z)
export const ROOM_LANE = -1.25; // and inside the room
export const PILE = { x: 5.6, z: -2.7 }; // the dug-out soil

// ---------------------------------------------------------------------------
// the pit (scene 2) and the backfill (scene 3)
// ---------------------------------------------------------------------------
// the digging goes in bites; DIG_T are the moments the blade comes up
export const DIG_T = (() => {
  const out = [];
  const n = 17;
  for (let i = 0; i < n; i++) out.push(T.dig0 + 0.1 + (T.dig1 - T.dig0 - 0.25) * Math.pow(i / (n - 1), 0.92));
  return out;
})();
// dig progress 0..1 in bites
export function digK(t) {
  let k = 0;
  for (const s of DIG_T) k += easeOutCubic(prog(t, s - 0.12, 0.22));
  return k / DIG_T.length;
}
// the open pit: x range and depth (it starts by the worker on the right and spreads left)
export function pit(t) {
  const k = digK(t);
  return {
    x0: lerp(2.55, OUT.x0, smooth(clamp(k * 1.15))),
    x1: lerp(3.45, OUT.x1, smooth(clamp(k * 2.2))),
    d: -FLOOR_B * Math.pow(k, 0.85),
    k,
  };
}
export const pileK = (t) => digK(t) * (1 - smooth(prog(t, T.backfill0, T.backfill1 - T.backfill0)));
export const backfillK = (t) => smooth(prog(t, T.backfill0, T.backfill1 - T.backfill0));

// ---------------------------------------------------------------------------
// weather: the storm darkens the sky step by step; wind; the tornado's path
// ---------------------------------------------------------------------------
// 0 = calm and sunny, 1 = dark green-grey; clears again after the tornado
export function storm(t) {
  const build = 0.08 + 0.62 * smooth(prog(t, 4.0, 52.0)) + 0.3 * smooth(prog(t, T.storm - 1.0, 1.6));
  return clamp(build) * (1 - smoother(prog(t, T.clear0, T.clear1 - T.clear0)));
}
// after the tornado: soft warm sunlight
export const clearK = (t) => smoother(prog(t, T.clear0, T.clear1 - T.clear0));
// wind strength 0..1 (grass, leaves, the tree, dust)
export function wind(t) {
  const w = 0.06 + 0.16 * smooth(prog(t, 20.0, 6.0)) + 0.22 * smooth(prog(t, 30.0, 25.0)) + 0.26 * smooth(prog(t, T.storm - 0.5, 1.5))
    + 0.3 * smooth(prog(t, T.hitT - 0.8, 1.2));
  return clamp(w) * (1 - 0.94 * smooth(prog(t, T.passEnd - 0.4, 1.4)));
}
// the tornado's centre on the ground, its size and how close it is
// far away on the left, coming in (keeping its bearing), over the yard, then off to the right
// far away it keeps its bearing (left of the house) and grows; ~1.5 km out when the
// family runs in, then it closes the last stretch fast behind its own dust
const FAR = 6200, MID = 1500;
export function tornado(t) {
  let d, x, z;
  if (t < 58.5) {
    d = FAR * Math.pow(MID / FAR, clamp(t / 58.5));
    x = -0.118 * d - 6;
    z = -d;
  } else if (t < T.hitT) {
    const u1 = smooth(prog(t, 58.5, 4.3)), u2 = prog(t, 62.8, T.hitT - 62.8);
    d = t < 62.8 ? lerp(MID, 800, u1) : lerp(800, 60, u2 * u2 * (3 - 2 * u2));
    x = -0.118 * d - 6;
    z = -d;
  } else {
    // over the yard from the left-back to the front-right
    const u = prog(t, T.hitT, T.passEnd + 2.0 - T.hitT);
    x = lerp(-8 + 4, 160, Math.pow(u, 1.35));
    z = lerp(-60, 110, u);
    d = Math.hypot(x, z);
  }
  // funnel: forming (rope lowering from the cloud base, scene 1), then mature
  const form = smooth(prog(t, T.funnel0, T.funnel1 - T.funnel0));
  return { x, z, d, form, base: 75, top: 360, height: 1250 };
}
// how much of the yard is inside the debris cloud (0..1)
export const engulf = (t) => smooth(prog(t, T.hitT - 0.9, 1.6)) * (1 - smooth(prog(t, T.passEnd - 1.2, 2.2)));
