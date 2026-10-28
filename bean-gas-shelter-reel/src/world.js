// World layout (metres): x right, y up, z towards the camera. The cutaway face is
// the plane z = 0; the lawn is y = 0. Everything in front of z = 0 has been cut
// away, so the shelter and the soil are seen in section, like a slice of cake.
//
//   x  -1.6 ... -1.5   left wall (corrugated steel on a steel frame)
//      -1.5 ...  1.25  the room (2.75 m inside, 1.95 m high, back wall at z = -2.3)
//       1.25 ... 1.35  wall between the room and the stairs (a doorway at the bottom)
//       1.35 ... 3.65  the stairwell: steps down from the right to the left, open to
//                      the lawn above and closed by a heavy steel door with rubber seals
//       3.65 ... 3.75  right wall
// The room's corrugated roof is buried under 36 cm of soil and lawn; the floor is a
// concrete slab. A tall air pipe rises from the room through the lawn to 4 m.
import { T } from './timeline.js';
import { clamp, lerp, smooth, smoother, easeOutCubic, prog } from './util.js';

export const WALL = 0.1;
export const ROOM = { x0: -1.5, x1: 1.25, zb: -2.3 }; // inside
export const STAIR = { x0: 1.35, x1: 3.65, zb: -1.25 }; // inside
export const OUT = { x0: -1.6, x1: 3.75, zb: -2.4 }; // outside of the whole structure (the pit)
export const FLOOR = -2.45, FLOOR_B = -2.65, CEIL = -0.5, ROOF_T = -0.42, TOP = 0.12;
// the corrugated steel: 200 mm pitch, 70 mm deep waves (shown 12 mm thick so the cut
// reads); every sheet's wave is in phase with the world, so the soil in the cut can
// follow its outer face exactly
export const CORR = { pitch: 0.2, amp: 0.035, th: 0.012 };
export const corrOff = (u) => CORR.amp * Math.sin((2 * Math.PI * u) / CORR.pitch);
export const SHEET = { left: -1.555, right: 3.705, shared: 1.3, back: -2.345, stairBack: -1.3, roof: -0.465 }; // sheet centre planes
export const HATCH = { x0: STAIR.x0, x1: STAIR.x1, z0: STAIR.zb, z1: -0.02 }; // the opening over the stairs
export const DOORWAY = { y1: CEIL - 0.02 }; // in the shared wall, from the floor up to here
// steps: 8 steps from the lawn down to the floor
export const STEPS = { n: 8, rise: -FLOOR / 9, run: 0.25 };
export const stepTop = (i) => -(i + 1) * STEPS.rise; // i = 0 .. n-1
export const stepX = (i) => STAIR.x1 - (i + 1) * STEPS.run; // left edge of step i
// height of the stair surface (the step a foot stands on) at x
export function stairY(x) {
  if (x >= STAIR.x1) return 0;
  const i = Math.floor((STAIR.x1 - x) / STEPS.run);
  return i >= STEPS.n ? FLOOR : stepTop(i);
}
export const BENCH = { x0: -0.55, x1: 1.15, z0: -2.3, z1: -1.88, seat: FLOOR + 0.46 }; // along the back wall, right of the fan
export const SEAT_W = 0.62; // where the worker sits on it
export const PIPE = { x: -1.0, z: -1.92, r: 0.07, top: 4.0 }; // the air pipe; its open top is 4 m up
export const FILTER = { x: -1.0, y: CEIL - 0.3, z: -2.08, w: 0.6, h: 0.42, d: 0.36 }; // under the ceiling, on the pipe
export const FAN = { x: -1.0, y: CEIL - 0.83, z: -2.12, r: 0.2 }; // below the filter, blowing into the room
export const SWITCH = { x: -0.45, y: FLOOR + 1.25, z: -2.28 }; // the fan switch on the back wall
export const HOOK = { x: 1.06, y: FLOOR + 0.98, z: -2.27 }; // the gas mask hangs here
export const LAMP = { x: -0.3, y: CEIL - 0.02, z: -0.72 }; // clear of the worker's head

// the yard
export const FENCE_Z = -8.6;
export const FENCE_H = 1.05;
export const GATE = { x: 1.25, w: 1.5 }; // the opening in the fence at the porch steps
export const HOUSE = { x0: -3.4, x1: 8.6, z: -10.6, depth: 9.0, floor: 0.55, story: 3.0, eave: 6.8, ridge: 9.6 };
export const PORCH = { x0: -0.6, x1: 3.1, z0: -10.6, z1: -9.0, y: 0.55, sx0: 0.65, sx1: 1.85 }; // a wooden deck at the back door, steps down the middle
export const KID = { x: 1.25, z: -9.35 }; // the little brother at the top of the porch steps, in the gap in the fence
export const TREE = { x: 6.2, z: -5.4 };
export const SHED = { x: -4.6, z: -6.6, w: 2.2, d: 1.8, h: 2.1 };
export const PILE = { x: 5.4, z: -2.6 }; // the dug-out soil
export const DOG_HOME = { x: 5.25, z: -5.0, yaw: -0.75 }; // where the dog naps, in the shade of the tree

// ---------------------------------------------------------------------------
// the pit (scene 2) and the backfill over the roof
// ---------------------------------------------------------------------------
// the digging goes in fast bites; DIG_T are the moments the blade comes up
export const DIG_T = (() => {
  const out = [];
  const n = 12;
  for (let i = 0; i < n; i++) out.push(T.dig0 + 0.08 + (T.dig1 - T.dig0 - 0.2) * Math.pow(i / (n - 1), 0.95));
  return out;
})();
// dig progress 0..1 in bites
export function digK(t) {
  let k = 0;
  for (const s of DIG_T) k += easeOutCubic(prog(t, s - 0.09, 0.16));
  return k / DIG_T.length;
}
// the open pit: x range and depth (it starts by the worker on the right and spreads left)
export function pit(t) {
  const k = digK(t);
  return {
    x0: lerp(2.7, OUT.x0, smooth(clamp(k * 1.15))),
    x1: lerp(3.5, OUT.x1, smooth(clamp(k * 2.2))),
    d: -FLOOR_B * Math.pow(k, 0.85),
    k,
  };
}
// where the worker stands in the pit while digging: at the face as it advances left
export const digX = (t) => clamp(pit(t).x0 + 0.55, -1.05, 3.15);
export const pileK = (t) => digK(t) * (1 - smooth(prog(t, T.backfill0, T.backfill1 - T.backfill0)));
export const backfillK = (t) => smooth(prog(t, T.backfill0, T.backfill1 - T.backfill0));

// ---------------------------------------------------------------------------
// weather: a calm sunny day, a light breeze
// ---------------------------------------------------------------------------
export const storm = () => 0;
export const clearK = () => 0;
export const wind = (t) => 0.07 + 0.03 * Math.sin(t * 0.37);

// ---------------------------------------------------------------------------
// the gas (src/gas.js renders it): a test puff, a low layer, the giant cloud and
// the dog's little puff. Positions in metres, densities 0..1.
// ---------------------------------------------------------------------------
const keyLerp = (keys, t) => {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      const u = smooth((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, k) => lerp(v, b[k + 1], u));
    }
  }
  return keys[keys.length - 1].slice(1);
};
// scene 2: drifts in from the left over the lawn, sinks into the open stairwell, thins away
export function puffTest(t) {
  if (t < T.puff0 - 0.1 || t > T.puffGone + 0.3) return null;
  const [x, y, z, r] = keyLerp([
    [T.puff0, -4.8, 0.78, -0.85, 0.45],
    [T.puff0 + 1.2, -2.2, 0.64, -0.75, 0.55],
    [T.sink0, 2.45, 0.56, -0.62, 0.6],
    [T.sink0 + 0.8, 2.3, -0.6, -0.62, 0.64],
    [T.sink1, 2.0, -1.75, -0.62, 0.72],
    [T.puffGone, 1.9, -2.0, -0.62, 0.85],
  ], t);
  const d = smooth(prog(t, T.puff0 - 0.1, 0.5)) * (1 - smooth(prog(t, T.sink1, T.puffGone - T.sink1)));
  return { x, y, z, r, d };
}
// scenes 3-6: a low sheet of gas rolls in over the yard from the left, presses on the
// shut door, stays low (well below the pipe's top), and clears before the finale
export function layer(t) {
  const d = smooth(prog(t, T.press0 - 0.7, 0.7)) * (1 - smooth(prog(t, T.gasOut, 1.4)));
  if (d <= 0) return null;
  const front = lerp(-10, 14, smooth(prog(t, T.press0 - 0.7, 2.0)));
  // over the door it piles up and pushes down while the door is being tested
  const press = smooth(prog(t, T.press0 + 0.1, 0.6)) * (1 - smooth(prog(t, T.press1, 1.0)));
  return { front, h: 0.62, d, press };
}
// scene 7: the giant cloud bursts out behind the little brother: it balloons up and out
// behind him first (he stands silhouetted against it for a moment), then its front and
// the ground-hugging layer roll out over him and the whole yard and beyond
export const CLOUD_SRC = { x: KID.x, y: PORCH.y + 0.55, z: KID.z - 0.25 };
export function bigCloud(t) {
  if (t < T.blast) return null;
  const u = t - T.blast;
  return {
    x: CLOUD_SRC.x, z: CLOUD_SRC.z,
    burst: 0.4 + 3.4 * easeOutCubic(clamp(u / 1.0)), // the first ballooning puff
    burstY: CLOUD_SRC.y + 0.25 + 1.6 * easeOutCubic(clamp(u / 1.4)),
    burstZ: KID.z - 1.1, // centred behind him, in front of the house wall
    front: 0.2 + 0.8 * smooth(clamp((u - 0.15) / 1.15)), // how far it has come towards us
    R: 0.3 + 19 * (1 - Math.exp(-Math.max(0, u - 0.35) / 1.5)), // the ground-hugging front
    H: 1.5 + 0.9 * smooth(clamp(u / 2.5)), // its height
    d: smooth(clamp(u / 0.2)),
  };
}
// scene 8: a little puff behind the dog on the bench, drifting towards the worker
export const DOG_SEAT = { x: -0.05, z: -2.02 };
export function dogPuff(t) {
  if (t < T.pfft) return null;
  const u = t - T.pfft;
  const [x, y, z, r] = keyLerp([
    [T.pfft, DOG_SEAT.x + 0.02, BENCH.seat + 0.1, DOG_SEAT.z - 0.12, 0.04],
    [T.pfft + 0.45, DOG_SEAT.x + 0.08, BENCH.seat + 0.16, DOG_SEAT.z - 0.02, 0.13],
    [T.pfft + 2.4, DOG_SEAT.x + 0.32, BENCH.seat + 0.36, DOG_SEAT.z + 0.14, 0.22],
    [T.pfft + 6.0, DOG_SEAT.x + 0.68, BENCH.seat + 0.62, DOG_SEAT.z + 0.3, 0.32],
  ], t);
  // a small puff: it thins as it spreads
  return { x, y, z, r, d: smooth(clamp(u / 0.12)) * (0.9 - 0.45 * smooth(clamp((u - 0.6) / 4.0))) };
}
// how far the cloud has rolled over a point of the yard (0..1): for the flowers and the leaves
export function cloudAt(t, x, z) {
  const c = bigCloud(t);
  if (!c) return 0;
  const r = Math.hypot(x - c.x, (z - c.z) * 0.95);
  return smoother(clamp((c.R - r) / 2.0));
}
