// Shared layout + cameras for the wheat-field world. Pure math (also used by the SVG overlays to
// project characters onto the 3D ground with exactly the same camera).
import * as THREE from 'three';
import {E, SC} from '../lib/timeline';
import {clamp, easeInOut, handheld, lerp, smooth} from '../lib/anim';

// Field: x ∈ [-FX, FX], z ∈ [-FZ, FZ]; corners are CS×CS squares that are never reaped.
export const FX = 10;
export const FZ = 15;
export const CS = 5;
export type Corner = {id: number; x0: number; x1: number; z0: number; z1: number; cx: number; cz: number};
export const CORNERS: Corner[] = [
  {id: 1, x0: -FX, x1: -FX + CS, z0: -FZ, z1: -FZ + CS}, // top-left (far-left)
  {id: 2, x0: -FX, x1: -FX + CS, z0: FZ - CS, z1: FZ}, // bottom-left
  {id: 3, x0: FX - CS, x1: FX, z0: -FZ, z1: -FZ + CS}, // top-right (far-right)
  {id: 4, x0: FX - CS, x1: FX, z0: FZ - CS, z1: FZ}, // bottom-right
].map((c) => ({...c, cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2}));

export const cornerOf = (x: number, z: number) => {
  for (const c of CORNERS) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return c.id;
  return 0;
};

export type Shot = 'S1' | 'S2' | 'S3' | 'S7' | 'S9' | 'LOOP' | 'COVER';
export const isTop = (s: Shot) => s === 'S1' || s === 'LOOP' || s === 'COVER';

// ---------------------------------------------------------------- harvest schedule (seconds; -1 never cut; -100 already cut)
export const SWEEP = {start: 0.0, end: 1.5, x0: -11, x1: 11};
export const sweepX = (t: number) => lerp(SWEEP.x0, SWEEP.x1, clamp((t - SWEEP.start) / (SWEEP.end - SWEEP.start)));
const S2_FRONT = {t0: SC.S2.start, t1: E.edgesGlow, x0: -2.5, x1: FX - CS};
export const s2FrontX = (t: number) => lerp(S2_FRONT.x0, S2_FRONT.x1, clamp((t - S2_FRONT.t0) / (S2_FRONT.t1 - S2_FRONT.t0)));

export const cutTime = (shot: Shot, x: number, z: number, jitter: number) => {
  if (cornerOf(x, z)) return -1;
  if (isTop(shot)) {
    // the reapers sweep left → right across the whole field in the opening seconds
    return SWEEP.start + ((x - SWEEP.x0) / (SWEEP.x1 - SWEEP.x0)) * (SWEEP.end - SWEEP.start) + jitter * 0.12;
  }
  if (shot === 'S2') {
    // the last strip along the far edge is being reaped toward the top-right corner
    if (x > FX - CS) return -100;
    if (z < -FZ + CS + 4 && x > -6) return S2_FRONT.t0 + ((x - S2_FRONT.x0) / (S2_FRONT.x1 - S2_FRONT.x0)) * (S2_FRONT.t1 - S2_FRONT.t0) + jitter * 0.3;
    return -100;
  }
  return -100; // later shots: harvest done, only the corners stand
};

// ---------------------------------------------------------------- corner glow (0..~1.6) per corner
export const cornerGlow = (shot: Shot, t: number): [number, number, number, number] => {
  const lit = (t0: number) => smooth(clamp((t - t0) / 0.35));
  if (isTop(shot)) {
    const l = E.cornerLit as number[];
    const pulse = 0.12 * Math.sin(t * 3.0);
    return [1, 0, 3, 2].map((i) => {
      const k = lit(l[i]);
      const flash = Math.max(0, 1 - Math.abs(t - l[i] - 0.25) / 0.4) * 0.7;
      return k * (1 + pulse) + flash;
    }) as [number, number, number, number];
  }
  const base = shot === 'S2' ? lit(E.edgesGlow) * (1 + 0.6 * Math.max(0, 1 - Math.abs(t - E.edgesGlow - 0.3) / 0.6)) : 0.85;
  const extra = shot === 'S3' ? 0.6 * Math.max(0, 1 - Math.abs(t - E.cornersWord - 0.3) / 0.8) : 0;
  const b = base + extra + 0.08 * Math.sin(t * 2.2);
  return [shot === 'S2' ? 0 : b * 0.5, shot === 'S2' ? 0 : b * 0.5, b, shot === 'S2' ? 0 : b * 0.5];
};

// ---------------------------------------------------------------- cameras
export type Cam = {pos: [number, number, number]; target: [number, number, number]; fov: number; roll?: number};
const v = (a: number[], b: number[], k: number) => a.map((x, i) => lerp(x, b[i], k)) as [number, number, number];

export const fieldCam = (shot: Shot, t: number): Cam => {
  if (shot === 'COVER') {
    // cover: higher, field framed low under the title
    return {pos: [-1.4, 100, -7 + 15], target: [0, 0, -7], fov: 38};
  }
  if (isTop(shot)) {
    // high top-down drone shot, slowly descending (LOOP = the very start of S1)
    const tt = shot === 'LOOP' ? 0 : t;
    const k = easeInOut(clamp(tt / 3.6));
    const h = lerp(80, 68, k);
    const yaw = lerp(-9, -3, k) * (Math.PI / 180);
    const tgt: [number, number, number] = [0, 0, -0.6];
    const d = h * 0.2;
    const hh = handheld(11, tt, 0.25);
    return {pos: [tgt[0] + Math.sin(yaw) * d + hh.x * 0.1, h, tgt[2] + Math.cos(yaw) * d + hh.y * 0.1], target: [tgt[0], 0, tgt[2]], fov: 38};
  }
  // Ground shots keep the horizon low (y ≈ 1000–1060): sky above for captions + cards, people in the lower band.
  if (shot === 'S2') {
    // ground-level tracking shot alongside the reapers
    const fx = s2FrontX(t);
    const reveal = smooth(clamp((t - E.edgesGlow + 0.2) / 0.9));
    const crane = easeInOut(clamp((t - SC.S2.start) / 2.6)); // crane down from above the field into the tracking shot
    const hh = handheld(21, t, 0.04);
    return {
      pos: [fx - 2.4 + reveal * 0.8 + hh.x, lerp(8.0, 1.55, crane) + hh.y, lerp(6.5, 2.4, crane)],
      target: [fx + 1.2 + reveal * 3.2, lerp(-0.8, 1.9, crane), -12],
      fov: 44,
    };
  }
  if (shot === 'S3') {
    // facing the glowing corner; slow push in
    const k = easeInOut(clamp((t - SC.S3.start) / (SC.S3.end - SC.S3.start)));
    const hh = handheld(31, t, 0.035);
    const p = v([0.6, 1.5, 1.6], [1.5, 1.48, 0.6], k);
    return {pos: [p[0] + hh.x, p[1] + hh.y, p[2]], target: v([6.6, 1.9, -12.5], [7.0, 1.85, -12.8], k), fov: 42};
  }
  if (shot === 'S7') {
    // low shot at Ruth's hands as she gathers leftover grain at the corner
    const k = easeInOut(clamp((t - SC.S7.start) / (SC.S7.end - SC.S7.start)));
    const hh = handheld(71, t, 0.02);
    const p = v([3.4, 0.72, -4.4], [3.75, 0.66, -4.85], k);
    return {pos: [p[0] + hh.x, p[1] + hh.y, p[2]], target: v([7.2, 0.95, -10.6], [7.2, 0.9, -10.7], k), fov: 40};
  }
  // S9: on Boaz, then a whip pan to the workers dropping grain near Ruth
  const wp = E.whipPan;
  const k = easeInOut(clamp((t - wp.start) / (wp.end - wp.start)));
  const hh = handheld(91, t, 0.03);
  const p = v([0.6, 1.55, 1.5], [3.4, 1.45, -3.0], k);
  return {pos: [p[0] + hh.x, p[1] + hh.y, p[2]], target: v([-3.2, 1.75, -9.0], [6.7, 1.25, -10.6], k), fov: 42};
};

const _cam = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 1000);
const _v = new THREE.Vector3();
/** Apply a Cam to a THREE camera. */
export const applyCam = (cam: THREE.PerspectiveCamera, c: Cam) => {
  cam.fov = c.fov;
  cam.aspect = 1080 / 1920;
  cam.near = 0.1;
  cam.far = 900;
  cam.position.set(...c.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(...c.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
};
/** Project a world point to screen px (1080×1920) + pixels-per-metre at that depth. */
export const project = (c: Cam, p: [number, number, number]) => {
  applyCam(_cam, c);
  _v.set(...p);
  const viewZ = -_v.clone().applyMatrix4(_cam.matrixWorldInverse).z;
  _v.project(_cam);
  const pxPerM = 1920 / (2 * Math.tan(((c.fov / 2) * Math.PI) / 180) * Math.max(0.01, viewZ));
  return {x: (_v.x * 0.5 + 0.5) * 1080, y: (-_v.y * 0.5 + 0.5) * 1920, depth: viewZ, pxPerM};
};
/** SVG Person scale for a person of `heightM` metres standing at that depth (figure ≈ 575 units). */
export const personScale = (pxPerM: number, heightM = 1.65) => (heightM * pxPerM) / 575;
