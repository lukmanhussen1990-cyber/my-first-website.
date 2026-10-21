// Geography of the diorama. X runs along the Great Wall (west -> east), Y is up, the cake-slice
// cut is the plane z = 0 and the land lies behind it (z < 0). Everything else is built from these.
import * as THREE from 'three';
import { makeCurve, fbm2, smoothstep, lerp, clamp } from '../lib/util.js';

export const X_MIN = -220, X_MAX = 720;
export const PORTAL_X = 13.2;        // tunnel entrance face
export const ROCK_X = 22.0;          // where the solid grey rock starts
export const JUNCTION_X = 45.0;      // where the steep first attempt leaves the main tunnel
export const STEEP_END = 99.0;
export const STATION_X0 = 397, STATION_X1 = 427, STATION_STOP = 412.5; // end station
export const WALL_X0 = -42, WALL_X1 = 448;

export const TUBE_Z = -1.1;          // tunnel axis sits a little behind the cut
export const R_RAW = 2.7;            // raw bored radius
export const R_RING_IN = 2.4, R_RING_OUT = 2.78;
export const BED_DROP = 1.75;        // track bed top = tunnel centre - BED_DROP
export const OPEN_H = Math.sqrt(R_RAW * R_RAW - TUBE_Z * TUBE_Z); // half height of the opening at the cut

// ridge height along the wall
const ridge = makeCurve([
  [-220, 3], [-120, 4], [-70, 1.5], [-40, 0.4], [0, 0], [8.5, 0.2], [10.5, 4.5], [12.5, 8.6], [16, 11.5], [24, 14.2], [34, 18.5],
  [44, 13], [52, 10.5], [60, 20], [75, 33], [86, 23], [97, 13], [112, 27], [128, 15], [155, 34], [175, 17], [192, 26],
  [210, 15], [228, 30], [247, 16], [265, 24], [283, 14], [300, 31], [320, 16], [338, 27], [355, 15], [372, 28],
  [388, 13], [400, 7.5], [425, 6.5], [446, 8], [470, 15], [520, 26], [600, 20], [720, 24],
]);
export const ridgeH = (x) => ridge(x);

// the wall winds a little behind the cut
export const wallZ = (x) => -7.2 + 2.4 * Math.sin(x * 0.043 + 0.6) + 1.3 * Math.sin(x * 0.117 + 2.0);

function profile(d) {
  if (d >= 0) return 1 - 0.30 * smoothstep(0, 10, d);
  return 1 - 0.55 * smoothstep(0, 45, -d);
}

// raw (undug) ground height
export function groundH(x, z) {
  const wz = wallZ(x);
  const d = z - wz;
  const R = ridge(x);
  let h = R * profile(d);
  const rough = smoothstep(1.5, 9, R) * smoothstep(2.5, 9, Math.abs(d));
  h += (fbm2(x * 0.045 + 3.1, z * 0.05 - 1.7, 4) - 0.5) * 6.0 * rough;
  h += (fbm2(x * 0.16, z * 0.16, 3) - 0.5) * 0.9 * rough;
  // hills rising again far behind the wall
  const back = smoothstep(-45, -120, z);
  h += back * (14 + 26 * fbm2(x * 0.011 + 7, z * 0.011, 4));
  // keep the valley at the entrance flat and tidy
  if (x < 9) h = lerp(h, 0, smoothstep(9, 4, x) * smoothstep(-34, -14, z));
  return h;
}

// ground height including the excavated approach cut in front of the portal
export function terrainH(x, z) {
  const h = groundH(x, z);
  if (x < PORTAL_X + 0.15 && x > 6.0 && z > -5.0) {
    const k = smoothstep(6.0, 9.5, x) * smoothstep(-5.0, -4.6, z);
    return lerp(h, Math.min(h, 0.0), k);
  }
  return h;
}

export const surfaceCut = (x) => terrainH(x, 0); // top edge of the cut face

// main tunnel centre line (final gentle path, deep under the peaks)
const mainY = makeCurve([
  [-220, 1.95], [PORTAL_X, 1.95], [24, 1.8], [34, 0.7], [45, -1.5], [60, -4.3], [78, -7.0], [100, -9.0], [130, -10.1],
  [170, -10.7], [220, -10.5], [280, -10.8], [330, -10.2], [368, -8.9], [392, -7.2], [STATION_X0, -6.8], [450, -6.8], [720, -6.8],
]);
export const tunnelY = (x) => mainY(x);
export const bedY = (x) => mainY(x) - BED_DROP;

// first attempt: hugs the mountain like the wall does (far too steep)
export function steepY(x) {
  const follow = surfaceCut(x) - 6.6;
  const k = smoothstep(JUNCTION_X, 55, x) * (1 - smoothstep(92, STEEP_END, x));
  return lerp(mainY(x), Math.max(follow, mainY(x)), k);
}

// absolute height where solid granite begins (very deep except under the first hill)
export function rockTop(x) {
  const k = smoothstep(ROCK_X - 1.8, ROCK_X + 0.8, x) * (1 - smoothstep(47, 53, x));
  const deep = -26 + 5 * Math.sin(x * 0.021);
  return lerp(deep, surfaceCut(x) - 1.2, k);
}

// 1D profile texture for shaders: R = surface at cut, G = rock top, B = main tunnel y, A = steep tunnel y
export function makeProfileTexture(n = 4096) {
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = X_MIN + (X_MAX - X_MIN) * (i / (n - 1));
    data[i * 4] = surfaceCut(x); data[i * 4 + 1] = rockTop(x); data[i * 4 + 2] = mainY(x); data[i * 4 + 3] = steepY(x);
  }
  const half = new Uint16Array(n * 4);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const t = new THREE.DataTexture(half, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// sample a path given y(x) as [x, y, angle] arrays with arc-length
export function samplePath(yFn, x0, x1, step) {
  const pts = [];
  let s = 0, prev = null;
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const y = yFn(x);
    const dy = (yFn(x + 0.05) - yFn(x - 0.05)) / 0.1;
    if (prev) s += Math.hypot(x - prev[0], y - prev[1]);
    pts.push({ x, y, ang: Math.atan(dy), s });
    prev = [x, y];
  }
  return pts;
}

// x position reached after travelling arc length s along y(x) from x0 (for trains on slopes)
export function xAtArc(yFn, x0, s, dir = 1) {
  let x = x0, acc = 0; const h = 0.05 * dir;
  const n = Math.ceil(Math.abs(s) / 0.05) + 2;
  for (let i = 0; i < n * 4 && acc < Math.abs(s); i++) {
    const dx = h, dy = yFn(x + dx) - yFn(x);
    acc += Math.hypot(dx, dy); x += dx;
  }
  return x;
}

export const slopeAngle = (yFn, x) => Math.atan((yFn(x + 0.1) - yFn(x - 0.1)) / 0.2);
export { clamp };
