// @ts-check
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/** @param {Vector3} a @param {number} s @returns {Vector3} */
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });

/** @param {Vector3} a @param {Vector3} b */
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** @param {Vector3} a */
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/** @param {Vector3} a @param {Vector3} b */
export const dist = (a, b) => len(sub(a, b));

/** @param {Vector3} a @returns {Vector3} */
export function norm(a) {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 1 } : scale(a, 1 / l);
}

/** @param {Vector3} a @param {Vector3} b @param {number} t @returns {Vector3} */
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

const UP = { x: 0, y: 1, z: 0 };

/**
 * Right / up vectors of a view direction (screen space basis).
 * @param {Vector3} dir
 */
export function basis(dir) {
  let right = cross(dir, UP);
  if (len(right) < 1e-4) right = { x: 1, y: 0, z: 0 };
  right = norm(right);
  const up = norm(cross(right, dir));
  return { right, up };
}

/**
 * Random direction inside a cone of `degrees` around `dir`.
 * @param {Vector3} dir @param {number} degrees
 */
export function spread(dir, degrees) {
  if (degrees <= 0) return dir;
  const { right, up } = basis(dir);
  const r = Math.tan((degrees * Math.PI) / 180) * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return norm(add(dir, add(scale(right, Math.cos(a) * r), scale(up, Math.sin(a) * r))));
}

/** Centre of an entity's body (feet + ~half height). @param {import("@minecraft/server").Entity} e */
export function bodyCenter(e) {
  const h = e.getHeadLocation();
  const f = e.location;
  return { x: f.x, y: (f.y + h.y) / 2, z: f.z };
}
