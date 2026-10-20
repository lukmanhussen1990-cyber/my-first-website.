// World layout (metres): x right, y up, z towards the camera. The cutaway face is
// the plane z = 0; the lawn is y = 0. The yard runs left to right, the house stands
// at the back on the right, and the hole is just behind the cut face (z from
// -HOLE.W to 0), so the cut opens it from the side like a slice of cake.
//
// The hole is analytic: a slightly tapered shaft with a rounded bottom. Its state is
// two depths (metres below the lawn, positive down):
//   dugD(t)    the deepest it has been dug so far (below it: untouched soil)
//   fillTop(t) the top of the loose dirt (or mud) inside it (above it: open air)
// so it can be dug, filled, dug again, turned to mud and dried as pure functions
// of time. Everything (cut face, hole walls, lawn opening, dirt FX) reads these.
import { T } from './timeline.js';
import { clamp, lerp, smooth, easeOutCubic, easeInOutSine, easeInQuad, prog, popIn, wobble } from './util.js';

export const HOLE = {
  x: 0, // centre
  hw0: 0.33, // half width at the lawn
  hw1: 0.3, // half width at the bottom of the deep hole
  W: 0.62, // reaches back to z = -W
  SHALLOW: 0.42, // scene 1: the card goes in just under the grass
  DEEP: 2.5, // scene 2: way below where the dog can reach
  round: 0.07, // the bottom is this much deeper in the middle than at the walls
  PAW: 0.36, // how deep the dog digs (its reach)
};
export const holeHW = (d) => lerp(HOLE.hw0, HOLE.hw1, clamp(d / HOLE.DEEP));
// depth of the hole's bottom at x for a dug depth D (rounded: deepest in the middle)
export const holeBottom = (x, D) => D - HOLE.round * Math.min(1, D / 0.3) * Math.min(1, ((x - HOLE.x) / holeHW(D)) ** 2);

// where things stand on the lawn (z of the characters: the middle of the hole's depth)
export const LANE = -0.31;
export const KID_SPOT = { x: 0.68, z: LANE }; // right of the hole, digging leftwards
export const DOG_SPOT = { x: -0.66, z: LANE }; // left of the hole
export const DAD_SPOT = { x: 0.74, z: LANE };
export const KID_WATCH = { x: -1.2, z: -0.62 }; // scene 7: by the doghouse with the dog
export const KID_ROLL = 0.95; // the kid walks this far right of the roller's drum while pushing it
// the kid's stroll in scene 6, round the back of the flower bed to the dog
export const KID_STROLL = [[0.62, LANE], [0.5, -0.88], [-0.45, -0.98], [KID_WATCH.x, KID_WATCH.z]];
export const PILE = { x: 1.2, z: -0.5 }; // the kid's dirt pile, behind him
export const DAD_PILE = { x: -0.78, z: -0.55 }; // where Dad's dirt lands
export const DOGHOUSE = { x: -2.0, z: -1.6, w: 1.0, d: 1.05, h: 0.78, ridge: 1.18 }; // door faces the camera
export const HOUSE = {
  x0: 1.8, x1: 8.4, z: -6.0, // yard-facing (back) wall at z, the house goes back from there
  depth: 7.0, floor: 0.45, // ground floor level (a low plinth), two stories
  story: 2.9, eave: 6.25, ridge: 8.6,
};
export const BACKDOOR = { x: 3.15, w: 0.95, h: 2.1 }; // in the yard-facing wall, a small porch with two steps
export const DAD_PATH = [[3.15, -5.55], [2.6, -3.4], [1.55, -1.3], [DAD_SPOT.x, DAD_SPOT.z]];
// the metal detector's beeps: further apart at first, faster and faster over the
// flowers, then one steady squeal from beep1 until Dad starts digging
export const BEEPS = (() => {
  const out = [];
  let t = T.beep0;
  while (t < T.beep1) {
    out.push(+t.toFixed(3));
    const u = (t - T.beep0) / (T.beep1 - T.beep0);
    t += 0.55 + (0.075 - 0.55) * Math.pow(u, 0.7);
  }
  return out;
})();
// flowers on the patch (x, z, kind 0-3, size)
export const FLOWERS = [
  [-0.21, -0.48, 0, 1.0], [0.07, -0.53, 1, 0.9], [0.24, -0.38, 2, 1.05], [-0.04, -0.28, 3, 1.1],
  [-0.24, -0.16, 1, 0.95], [0.2, -0.13, 0, 1.0], [0.03, -0.07, 2, 0.85], [-0.13, -0.4, 3, 0.9],
];
export const flowerT = (i) => T.flowers0 + i * T.flowerGap;
export const CARD = { w: 0.3, h: 0.22, t: 0.006 };
export const BOX = { w: 0.36, h: 0.2, d: 0.24 }; // the metal box (front face flush with the cut when buried)

// ---------------------------------------------------------------------------
// the hole over time
// ---------------------------------------------------------------------------
// step i of n spread over [t0, t1], each scoop eased over dur
function steps(t, list, dur = 0.24) {
  let k = 0;
  for (const s of list) k += easeOutCubic(prog(t, s, dur));
  return k / list.length;
}
// the deep dig: scoops every 0.25 s from deep0 to deep1
export const DEEP_T = (() => {
  const out = [];
  const n = 9;
  for (let i = 0; i < n; i++) out.push(T.deep0 + 0.12 + (i * (T.deep1 - T.deep0 - 0.3)) / (n - 1));
  return out;
})();
export const PAW_T = [0, 1, 2, 3, 4, 5].map((i) => T.dogDig0 + 0.05 + i * 0.12);
export const DAD_T = (() => {
  const out = [];
  for (let i = 0; i < 8; i++) out.push(T.dadDig0 + 0.2 + i * 0.16);
  return out;
})();
export const BOX_TOP = HOLE.DEEP - BOX.h - 0.02; // Dad digs down to the box

export function dugD(t) {
  const shallow = HOLE.SHALLOW * steps(t, T.dig1.map((s) => s - 0.12));
  const deep = lerp(HOLE.PAW, HOLE.DEEP, steps(t, DEEP_T, 0.2));
  return t < T.deep0 ? shallow : Math.max(HOLE.SHALLOW, deep);
}
export function fillTop(t) {
  if (t < T.cardLand + 0.2) return dugD(t);
  if (t < T.dogDig0) return HOLE.SHALLOW * (1 - steps(t, T.fill1.map((s) => s + 0.1), 0.3));
  if (t < T.deep0) return HOLE.PAW * steps(t, PAW_T, 0.14);
  if (t < T.refill0) return Math.max(HOLE.PAW, dugD(t));
  if (t < T.dadDig0) {
    // the pile pours back in, in three big pushes; a shallow puddle while it is mud
    const k = steps(t, [T.refill0, T.refill0 + 0.25, T.refill0 + 0.5], 0.3);
    return HOLE.DEEP * (1 - k) + 0.035 * mudK(t);
  }
  return BOX_TOP * steps(t, DAD_T, 0.18);
}
// the loose dirt in the hole turns to mud in the rain and dries back to fresh dirt
export const mudK = (t) => smooth(prog(t, T.mud0, T.mud1 - T.mud0)) * (1 - smooth(prog(t, T.dry0, T.dry1 - T.dry0)));
// the soil around darkens as the water front soaks down, then slowly dries
export const wetD = (t) => 3.2 * easeInOutSine(prog(t, T.soak0, T.soak1 - T.soak0));
export const wetK = (t) => (t < T.soak0 ? 0 : 1 - 0.85 * smooth(prog(t, T.dry0, 5.0)));
export const storm = (t) => smooth(prog(t, T.storm0, T.storm1 - T.storm0)) * (1 - smooth(prog(t, T.storm2, T.storm3 - T.storm2)));
export const rainK = (t) => smooth(prog(t, T.rain0, 0.35)) * (1 - smooth(prog(t, T.rain1, 0.6)));
// is the patch on the lawn bare fresh dirt (after the first dig, before the flowers hide it)?
export const patchK = (t) => smooth(prog(t, T.dig1[0] - 0.2, 0.3));

// the lump (scene 5): a dome over the patch that the roller presses flat
export const MOUND = { x: 0, z: LANE, rx: 0.33, rz: 0.33, h: 0.13 };
export function rollerX(t) {
  if (t < T.roll0) return lerp(1.45, 0.45, smooth(prog(t, T.rollIn, T.roll0 - T.rollIn)));
  return lerp(0.45, -0.52, easeInOutSine(prog(t, T.roll0, T.roll1 - T.roll0)));
}
export const ROLLER = { r: 0.15, w: 0.52, grip: { dx: 0.72, y: 0.6 } }; // drum radius, width (along z); the handle's grip is dx right of the drum axle, y up
export const LADDER = { x: -0.08, z: -0.46, y0: -HOLE.DEEP, y1: 0.55, lean: 0.12 }; // in the deep hole, leaning back on the back wall
export function lumpH(t) {
  if (t < T.lump0) return 0;
  return MOUND.h * (popIn(t, T.lump0, 0.45, 2.6) + 0.12 * wobble(t, T.lump0 + 0.4, 3.2, 5));
}
// height of the ground on top of the patch at (x, z): the dome, flattened wherever
// the roller has passed (it rolls from right to left)
export function groundY(x, z, t) {
  const h = lumpH(t);
  if (h <= 0) return 0;
  const u = (x - MOUND.x) / MOUND.rx, v = (z - MOUND.z) / MOUND.rz;
  const r2 = u * u + v * v;
  if (r2 >= 1) return 0;
  let k = 1;
  if (t >= T.rollIn) {
    const rx = rollerX(t);
    k = 1 - smooth(clamp((x - (rx - 0.1)) / 0.22)); // flat to the right of the roller
    if (t > T.roll1) k = 0;
  }
  return h * k * (1 - r2) * (1 - r2);
}

// the metal box: snaps together over the hole, the card goes in, it sinks deep
export const BOX_REST = { x: HOLE.x, y: -HOLE.DEEP + BOX.h / 2 + 0.02, z: 0.003 - BOX.d / 2 };
export function boxPos(t) {
  const air = { x: HOLE.x + 0.02, y: 0.52, z: LANE };
  if (t < T.sink0) return air;
  if (t < T.boxUp) {
    // falls in, slows down in the mud, settles at the bottom
    const u = prog(t, T.sink0, T.sink1 - T.sink0);
    const k = u < 0.18 ? 0.12 * easeInQuad(u / 0.18) : 0.12 + 0.88 * smooth((u - 0.18) / 0.82);
    return { x: air.x + (BOX_REST.x - air.x) * k, y: lerp(air.y, BOX_REST.y, k), z: lerp(air.z, BOX_REST.z, smooth(clamp(k * 4))) };
  }
  return null; // in Dad's hands (characters.js / props.js)
}

// dad walks the path from the back door to the flower bed
export function dadWalk(t) {
  const u = smooth(prog(t, T.dadOut, T.dadArrive - T.dadOut));
  const P = DAD_PATH;
  // even speed along the polyline
  const L = [];
  let tot = 0;
  for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(l); tot += l; }
  let d = u * tot;
  for (let i = 0; i < L.length; i++) {
    if (d <= L[i] || i === L.length - 1) {
      const k = clamp(d / L[i]);
      const a = P[i], b = P[i + 1];
      return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), dir: Math.atan2(b[0] - a[0], b[1] - a[1]), moving: u > 0 && u < 1 };
    }
    d -= L[i];
  }
  return { x: P[P.length - 1][0], z: P[P.length - 1][1], dir: 0, moving: false };
}

// shovelfuls: when and where each scoop of dirt flies (kind decides the arc)
//   out:  from the hole over the kid's shoulder onto the pile
//   in:   from the pile into the hole
//   paw:  the dog's paws spray it back to the left
//   deep: from the bottom of the deep hole up and out onto the pile
//   dad:  Dad's flurry, everywhere
export const SCOOPS = [
  ...T.dig1.map((t) => ({ t, kind: 'out' })),
  ...T.fill1.map((t) => ({ t, kind: 'in' })),
  ...PAW_T.map((t) => ({ t, kind: 'paw' })),
  ...DEEP_T.map((t) => ({ t, kind: 'deep' })),
  ...[0, 0.25, 0.5].map((k) => ({ t: T.refill0 + k, kind: 'pour' })),
  ...DAD_T.map((t) => ({ t, kind: 'dad' })),
];
// how big the kid's dirt pile is (0..1): grows with what is dug out, shrinks as it goes back in
export function pileK(t) {
  if (t < T.fill1[0]) return 0.35 * steps(t, T.dig1, 0.5);
  if (t < T.deep0) return 0.35 * (1 - steps(t, T.fill1.map((s) => s + 0.05), 0.4));
  if (t < T.refill0) return 0.12 + 0.88 * steps(t, DEEP_T.map((s) => s + 0.3), 0.4);
  return 1 - steps(t, [T.refill0, T.refill0 + 0.25, T.refill0 + 0.5], 0.3);
}
// Dad's pile (scene 7)
export const dadPileK = (t) => steps(t, DAD_T.map((s) => s + 0.3), 0.4);
