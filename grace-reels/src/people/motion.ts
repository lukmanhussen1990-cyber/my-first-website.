import { clamp, Vec3 } from "../lib/math";

// Walking along paths as pure functions of time.

export type Path = { pts: Vec3[]; lengths: number[]; total: number };

export function makePath(pts: Vec3[]): Path {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  return { pts, lengths, total: lengths[lengths.length - 1] };
}

/** Point and horizontal heading at distance d along the path (clamped). */
export function along(p: Path, d: number): { pos: Vec3; dir: Vec3 } {
  const dd = clamp(d, 0, p.total);
  let i = 1;
  while (i < p.lengths.length - 1 && p.lengths[i] < dd) i++;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  const seg = p.lengths[i] - p.lengths[i - 1] || 1;
  const k = (dd - p.lengths[i - 1]) / seg;
  const dir: Vec3 = [(b[0] - a[0]) / seg, 0, (b[2] - a[2]) / seg];
  return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], dir };
}

/** Distance walked by time t for a walker that eases in/out of walking. */
export function walkDistance(t: number, start: number, stop: number, speed: number, easeTime = 0.6) {
  // integral of a speed curve that ramps up over easeTime after start and down before stop
  const v = (x: number) => {
    if (x <= start || x >= stop) return 0;
    const up = clamp((x - start) / easeTime);
    const down = clamp((stop - x) / easeTime);
    return speed * Math.min(up, down);
  };
  const tt = clamp(t, start, stop);
  const n = Math.max(2, Math.ceil((tt - start) * 30));
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = start + ((tt - start) * i) / n;
    const x1 = start + ((tt - start) * (i + 1)) / n;
    sum += ((v(x0) + v(x1)) / 2) * (x1 - x0);
  }
  return sum;
}

/** Walking amount 0..1 at time t (for the swing amplitude). */
export function walkAmount(t: number, start: number, stop: number, easeTime = 0.6) {
  if (t <= start || t >= stop) return 0;
  return Math.min(clamp((t - start) / easeTime), clamp((stop - t) / easeTime));
}

/** Leg phase from distance: one full stride cycle per strideLength metres. */
export const phaseFromDistance = (d: number, stride = 1.15) => (d / stride) * Math.PI * 2;

/** +1 if moving towards screen-right for a camera at camPos looking at target, else -1. */
export function faceFor(dir: Vec3, camPos: Vec3, target: Vec3): 1 | -1 {
  const fx = target[0] - camPos[0];
  const fz = target[2] - camPos[2];
  // camera right vector on the ground plane = forward x up
  const rx = -fz;
  const rz = fx;
  return dir[0] * rx + dir[2] * rz >= 0 ? 1 : -1;
}
