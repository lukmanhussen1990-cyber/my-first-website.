import { CamPose, orbit, withDrift } from "../../../lib/camera";
import { lerp, prog, Vec3 } from "../../../lib/math";
import { sunDirection } from "../../../world/environment";
import { Mood } from "../../../lib/moods";
import { along, faceFor, Path, phaseFromDistance, walkAmount, walkDistance } from "../../../people/motion";
import { Pose } from "../../../people/Paper";

// Helpers shared by the scenes of this episode.

export const sunOf = (m: Mood) => sunDirection(m);

/** Camera that orbits a moving target; az/el in degrees; eased between a start and end framing. */
export function orbitCam(
  t: number,
  t0: number,
  t1: number,
  target0: Vec3,
  target1: Vec3,
  from: { r: number; az: number; el: number; fov?: number },
  to: { r: number; az: number; el: number; fov?: number },
  seed: number,
  e: "inOutSine" | "inOutCubic" | "outCubic" | "linear" = "inOutSine",
  drift = 0.05,
): CamPose {
  const k = prog(t, t0, t1, e);
  const target: Vec3 = [lerp(target0[0], target1[0], k), lerp(target0[1], target1[1], k), lerp(target0[2], target1[2], k)];
  const pos = orbit(target, lerp(from.r, to.r, k), lerp(from.az, to.az, k), lerp(from.el, to.el, k));
  return withDrift({ pos, target, fov: lerp(from.fov ?? 26, to.fov ?? 26, k) }, t, seed, drift);
}

/** A walker on a path: pose at time t. */
export function walker(
  path: Path,
  t: number,
  opts: { s0: number; start: number; stop: number; speed: number; cam: CamPose; seed: number; ground: (x: number, z: number) => number; stride?: number },
): { pose: Pose; dist: number } {
  const d = opts.s0 + walkDistance(t, opts.start, opts.stop, opts.speed);
  const { pos, dir } = along(path, d);
  const y = opts.ground(pos[0], pos[2]);
  const amt = walkAmount(t, opts.start, opts.stop);
  return {
    dist: d,
    pose: {
      pos: [pos[0], y, pos[2]],
      face: faceFor(dir, opts.cam.pos, opts.cam.target),
      walk: phaseFromDistance(d, opts.stride ?? 1.1),
      walkAmt: amt,
      t,
      seed: opts.seed,
    },
  };
}

/** Pick a mood tint for paper figures so they sit in the light of the scene. */
export function figureTint(m: Mood, k = 0.22, bright = 1) {
  const sun = m.sun;
  const n = parseInt(sun.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mix = (c: number) => Math.round(255 * Math.min(1, (1 - k + k * c) * bright));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
