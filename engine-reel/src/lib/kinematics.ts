/**
 * Real slider-crank kinematics + valve timing.
 *
 *   pistonPinY(θ) = r·cos θ + √(L² − (r·sin θ)²)
 *
 * θ is the crank angle (0 = Top Dead Centre). One 4-stroke cycle = 720°:
 *   0–180  intake (SUCK) · 180–360 compression (SQUEEZE)
 *   360–540 power (BANG) · 540–720 exhaust (BLOW)
 */
import { CRANK } from '../timeline';
import { DEG, EASE, lerp, mod, smoothstep } from './math';

/** All engine dimensions (world units). Crank centre is the origin. */
export const ENGINE = {
  crankR: 0.45, //      r — crank throw
  rodL: 1.35, //        L — connecting-rod length (pin to pin)
  pinToCrown: 0.3, //   wrist pin → piston crown
  pinToSkirt: 0.42, //  wrist pin → bottom of skirt
  pistonR: 0.565,
  boreR: 0.58,
  linerBottom: 0.95, // bottom of the cylinder bore
  roofY: 2.42, //       combustion-chamber roof (cylinder head face)
  headTop: 3.3,
  halfW: 1.05, //       half width of block / head
  depth: 0.9, //        block depth behind the cut plane
  valveX: 0.34, //      intake at −x, exhaust at +x
  valveHeadR: 0.17,
  portR: 0.15,
  maxLift: 0.15,
  stemTopClosed: 3.62,
  bucketH: 0.08,
  camBaseR: 0.1,
  plugHoleR: 0.09,
  plugWellR: 0.16,
  plugWellY: 2.78,
  coverTop: 4.2,
  floorY: -0.95,
};
export const CAM_Y = ENGINE.stemTopClosed + ENGINE.bucketH + ENGINE.camBaseR;

export const crownAtTDC = ENGINE.crankR + ENGINE.rodL + ENGINE.pinToCrown;
export const crownAtBDC = ENGINE.rodL - ENGINE.crankR + ENGINE.pinToCrown;

/** Height of the wrist pin above the crank centre. θ in radians. */
export function pistonPinY(theta: number) {
  const { crankR: r, rodL: L } = ENGINE;
  const s = r * Math.sin(theta);
  return r * Math.cos(theta) + Math.sqrt(L * L - s * s);
}
export const crownY = (theta: number) => pistonPinY(theta) + ENGINE.pinToCrown;

/** Crank-pin centre (world XY). Crank turns clockwise seen from the front. */
export const crankPin = (theta: number): [number, number] => [
  ENGINE.crankR * Math.sin(theta),
  ENGINE.crankR * Math.cos(theta),
];

/** Rod tilt about Z so that its local +Y points from crank pin to wrist pin. */
export function rodAngle(theta: number) {
  const [px, py] = crankPin(theta);
  return Math.atan2(px, pistonPinY(theta) - py);
}

// ── Crank angle over time ───────────────────────────────────────────────
const DT = 1 / 600;
let spinTable: Float64Array | null = null;

function omegaRaw(t: number) {
  const w0 = CRANK.hookRevPerSec * 360;
  const wp = CRANK.peakRevPerSec * 360;
  if (t < CRANK.spinUpStart) return w0;
  if (t < CRANK.spinPeakAt) return lerp(w0, wp, smoothstep(CRANK.spinUpStart, CRANK.spinPeakAt, t));
  if (t < CRANK.spinDownStart) return wp;
  if (t < CRANK.stopAt) return wp * (1 - smoothstep(CRANK.spinDownStart, CRANK.stopAt, t));
  return 0;
}

/** Integrate ω(t) and rescale the fast section so the crank parks exactly on a TDC (multiple of 720°). */
function buildSpinTable() {
  const n = Math.ceil(CRANK.stopAt / DT) + 1;
  const raw = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const t0 = (i - 1) * DT;
    const t1 = i * DT;
    raw[i] = raw[i - 1] + 0.5 * (omegaRaw(t0) + omegaRaw(t1)) * DT;
  }
  const iA = Math.floor(CRANK.spinUpStart / DT);
  const thA = raw[iA];
  const total = raw[n - 1];
  const target = Math.ceil(total / 720) * 720;
  const s = (target - thA) / (total - thA);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = i <= iA ? raw[i] : thA + (raw[i] - thA) * s;
  out[n - 1] = target;
  return out;
}

/** Absolute crank angle in DEGREES at time t (seconds). */
export function crankDeg(t: number): number {
  if (!spinTable) spinTable = buildSpinTable();
  const table = spinTable;
  if (t <= 0) return 0;
  if (t < CRANK.stopAt) {
    const f = t / DT;
    const i = Math.min(table.length - 2, Math.floor(f));
    return lerp(table[i], table[i + 1], f - i);
  }
  const base = table[table.length - 1];
  const keys = CRANK.strokes;
  if (t <= keys[0].t) return base + keys[0].deg;
  for (let k = 1; k < keys.length; k++) {
    const b = keys[k];
    if (t < b.t) {
      const a = keys[k - 1];
      const p = (t - a.t) / (b.t - a.t);
      return base + lerp(a.deg, b.deg, EASE[b.ease ?? 'linear'](p));
    }
  }
  return base + keys[keys.length - 1].deg;
}

export const crankRad = (t: number) => crankDeg(t) * DEG;
/** Angle within the 4-stroke cycle, 0–720°. */
export const cycleDeg = (t: number) => mod(crankDeg(t), 720);
/** Crank speed in revs/sec (for speed-dependent effects). */
export const crankRevPerSec = (t: number) => Math.abs(crankDeg(t + 1 / 120) - crankDeg(t - 1 / 120)) * 60 / 360;

// ── Valve timing (driven by θ, so cams/valves/piston always agree) ──────
export function intakeLift(cyc: number) {
  const x = cyc >= 700 ? cyc - 720 : cyc; // wrap so opening near TDC is continuous
  return ENGINE.maxLift * (smoothstep(-2, 42, x) - smoothstep(168, 214, x));
}
export function exhaustLift(cyc: number) {
  return ENGINE.maxLift * (smoothstep(538, 578, cyc) - smoothstep(684, 719.5, cyc));
}

/** Cam rotation (rad about Z): camshafts turn at half crank speed, same direction. */
export const camRotation = (thetaRad: number) => -thetaRad / 2;
/**
 * Cam lobe radius at local polar angle α (rad), derived from the lift curve so the
 * lobe that touches the bucket is EXACTLY the current valve lift (contact at −90°).
 */
export function camRadius(alpha: number, kind: 'intake' | 'exhaust') {
  const cyc = mod((2 * alpha + Math.PI) / DEG, 720);
  const lift = kind === 'intake' ? intakeLift(cyc) : exhaustLift(cyc);
  return ENGINE.camBaseR + lift;
}

/** Gap between piston crown and chamber roof. */
export const chamberGap = (thetaRad: number) => ENGINE.roofY - crownY(thetaRad);
export const GAP_MAX = ENGINE.roofY - crownAtBDC;
export const GAP_MIN = ENGINE.roofY - crownAtTDC;
