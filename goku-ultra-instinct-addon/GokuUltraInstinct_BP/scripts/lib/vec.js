// Small helpers for plain {x, y, z} vectors.

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a) => Math.hypot(a.x, a.y, a.z);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const along = (origin, dir, d) => add(origin, scale(dir, d));
export const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });

export function normalize(a) {
  const l = length(a);
  return l < 1e-6 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
}

/** Look direction plus a horizontal forward/right basis around an entity. */
export function frame(entity) {
  const look = entity.getViewDirection();
  const h = Math.hypot(look.x, look.z);
  const forward = h < 1e-4 ? { x: 0, y: 0, z: 1 } : { x: look.x / h, y: 0, z: look.z / h };
  return { look, forward, right: { x: -forward.z, y: 0, z: forward.x } };
}

/** Distance from point p to the segment a-b. */
export function segmentDistance(p, a, b) {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return distance(p, along(a, ab, t));
}

/** Middle of an entity's body (feet location + 0.9). */
export const bodyCenter = (entity) => up(entity.location, 0.9);
