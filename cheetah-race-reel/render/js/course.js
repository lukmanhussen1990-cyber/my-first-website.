import * as THREE from 'three';
import { clamp, smoothstep, fbm } from './util.js';
import { STATION } from './timeline.js';

// The race course on the savanna slice. World frame: +x is the race
// direction (left to right on screen), +y up, +z toward the camera. The slice
// is cut open along z = 0 (soil layers face the camera) and runs back to
// z = -BACK.
export const COURSE = {
  X0: -70, X1: 560, BACK: 130, DEPTH: 6.5,
  START: 0, CORNER: STATION.corner, RIVER: 0, RIVER_W: 9.0, FINISH: STATION.finish,
  WATER_Y: -0.62, RIVER_BED: -1.45,
  TRACK_HALF: 4.3,
};

// track centerline through control points, with an S-bend into depth around
// a rock outcrop: a sharp left corner, then a long sweep back to the front.
const XC = STATION.corner - 3.0; // the bend starts just before the cheetah's turn
const CTRL = [
  [-80, -5.6], [-20, -5.6], [40, -5.6], [XC - 30, -5.6], [XC - 5, -5.6], [XC + 2, -5.9], [XC + 5.5, -7.0], [XC + 8.5, -9.0], [XC + 12, -10.6],
  [XC + 17, -11.3], [XC + 24, -10.8], [XC + 31, -9.2], [XC + 38, -7.3], [XC + 46, -5.95], [XC + 56, -5.6], [XC + 120, -5.6], [640, -5.6],
];

const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
const N = 6000;
const table = []; // arc-length table: s -> point, tangent
{
  let s = 0, prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N);
    if (i) s += p.distanceTo(prev);
    table.push({ s, x: p.x, z: p.z });
    prev = p;
  }
}
export const TRACK_LEN = table[table.length - 1].s;
// s of the start line (x = 0 on the first straight)
const sAtX0 = -CTRL[0][0];

function lookup(s) {
  // s measured from x = 0 on the start straight
  const ss = clamp(s + sAtX0, 0, TRACK_LEN);
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m].s < ss) lo = m; else hi = m; }
  const a = table[lo], b = table[hi];
  const u = (ss - a.s) / Math.max(1e-9, b.s - a.s);
  const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
  const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
  return { x, z, tx: tx / l, tz: tz / l };
}

// position on the course: s along the centerline, d lateral offset
// (positive = to the right of the direction of travel, i.e. toward the camera
// on the straights). Returns world x, z and heading (radians, 0 = +x,
// positive = turning left / toward -z).
export function coursePos(s, d = 0) {
  const p = lookup(s);
  // right-hand normal of (tx, tz) in the xz plane: (-tz, tx) points to +z when heading +x
  const nx = -p.tz, nz = p.tx;
  return { x: p.x + nx * d, z: p.z + nz * d, heading: Math.atan2(-p.tz, p.tx), tx: p.tx, tz: p.tz };
}

// signed distance from the track centerline at a world point (approximate,
// searched near the given x) and the matching s.
const coarse = [];
for (let s = -sAtX0; s <= TRACK_LEN - sAtX0; s += 0.5) { const p = lookup(s); coarse.push([s, p.x, p.z]); }
export function trackDist(x, z) {
  let best = Infinity, bs = 0;
  // the course never doubles back in x, so search a window around x
  let lo = 0, hi = coarse.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (coarse[m][1] < x) lo = m; else hi = m; }
  for (let i = Math.max(0, lo - 80); i < Math.min(coarse.length, lo + 80); i++) {
    const dx = coarse[i][1] - x, dz = coarse[i][2] - z, d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bs = coarse[i][0]; }
  }
  return { d: Math.sqrt(best), s: bs };
}

// ground height (river channel, gentle undulation off the track)
export function groundHeight(x, z) {
  const { d } = trackDist(x, z);
  const off = smoothstep(COURSE.TRACK_HALF - 0.3, COURSE.TRACK_HALF + 2.5, d);
  let h = off * (0.06 + 0.16 * (fbm(x * 0.045, z * 0.05, 3) + 0.4) + 0.05 * fbm(x * 0.4, z * 0.4, 2));
  // gentle lip along the front edge so the slice reads as a cake layer
  h += 0.04 * smoothstep(-1.5, 0, z);
  // river channel running along z (gently meandering)
  const dx = Math.abs(x - RIVER_X(z));
  const half = COURSE.RIVER_W / 2;
  if (dx < half + 3.2) {
    const t = clamp((dx - (half - 1.6)) / 4.8, 0, 1); // 0 in the bed, 1 above the bank top
    const bank = smoothstep(0, 1, t);
    h = h * bank + COURSE.RIVER_BED * (1 - bank);
    h -= 0.25 * (1 - bank) * (1 - bank) * (0.5 + 0.5 * Math.cos(dx * 0.7));
  }
  return h;
}

export function RIVER_X(z) { return COURSE.RIVER + 2.2 * Math.sin((z + 5.6) * 0.055) + (z + 5.6) * 0.025; }
// the river crosses the track exactly where the choreography needs it
COURSE.RIVER = coursePos(STATION.river, 0).x;
