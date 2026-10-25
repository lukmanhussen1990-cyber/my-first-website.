import * as THREE from "three";
import { ease, EaseName, invLerp, lerp, Vec3 } from "./math";
import { noise1 } from "./random";

// One pure camera description used by BOTH the 3D render and the 2D overlay (label projection),
// so labels stay glued to their 3D points during every camera move.

export type CamPose = { pos: Vec3; target: Vec3; fov: number; roll?: number };
export type CamKey = { t: number; pos: Vec3; target: Vec3; fov?: number; roll?: number; e?: EaseName };

const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** Eased piecewise camera track (each key eases from the previous one). Extrapolates by holding. */
export function track(keys: CamKey[], t: number): CamPose {
  const fovOf = (k: CamKey) => k.fov ?? 26;
  if (t <= keys[0].t) return { pos: keys[0].pos, target: keys[0].target, fov: fovOf(keys[0]), roll: keys[0].roll ?? 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const k = ease[b.e ?? "inOutCubic"](invLerp(a.t, b.t, t));
      return {
        pos: lerp3(a.pos, b.pos, k),
        target: lerp3(a.target, b.target, k),
        fov: lerp(fovOf(a), fovOf(b), k),
        roll: lerp(a.roll ?? 0, b.roll ?? 0, k),
      };
    }
  }
  const z = keys[keys.length - 1];
  return { pos: z.pos, target: z.target, fov: fovOf(z), roll: z.roll ?? 0 };
}

/** Tiny seeded "breathing" drift so no shot is ever perfectly still. */
export function withDrift(p: CamPose, t: number, seed: number, amount = 0.06): CamPose {
  const d = (s: number) => noise1(t * 0.23 + s * 17.3, seed + s) * amount;
  return {
    ...p,
    pos: [p.pos[0] + d(1), p.pos[1] + d(2) * 0.6, p.pos[2] + d(3)],
    target: [p.target[0] + d(4) * 0.5, p.target[1] + d(5) * 0.3, p.target[2] + d(6) * 0.5],
    roll: (p.roll ?? 0) + noise1(t * 0.17, seed + 9) * 0.004,
  };
}

/** Orbit helper: position around a target at radius / azimuth / elevation (degrees). */
export function orbit(target: Vec3, radius: number, azDeg: number, elDeg: number): Vec3 {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return [target[0] + radius * Math.cos(el) * Math.sin(az), target[1] + radius * Math.sin(el), target[2] + radius * Math.cos(el) * Math.cos(az)];
}

export function applyPose(cam: THREE.PerspectiveCamera, p: CamPose, aspect: number) {
  cam.fov = p.fov;
  cam.aspect = aspect;
  cam.near = 0.3;
  cam.far = 900;
  cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
  cam.up.set(Math.sin(p.roll ?? 0), Math.cos(p.roll ?? 0), 0);
  cam.lookAt(p.target[0], p.target[1], p.target[2]);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

const scratchCam = new THREE.PerspectiveCamera();
const scratchV = new THREE.Vector3();

/** Project a world point to screen pixels for a given pose. */
export function projectPoint(p: CamPose, point: Vec3, width: number, height: number) {
  applyPose(scratchCam, p, width / height);
  scratchV.set(point[0], point[1], point[2]);
  const camSpace = scratchV.clone().applyMatrix4(scratchCam.matrixWorldInverse);
  scratchV.project(scratchCam);
  return {
    x: (scratchV.x * 0.5 + 0.5) * width,
    y: (-scratchV.y * 0.5 + 0.5) * height,
    inFront: camSpace.z < 0,
    depth: -camSpace.z,
  };
}
