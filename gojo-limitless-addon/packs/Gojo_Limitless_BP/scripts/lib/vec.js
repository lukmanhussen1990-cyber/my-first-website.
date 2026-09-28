// Small allocation-light vector helpers (Vector3 = {x, y, z}).

/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** @param {number} x @param {number} y @param {number} z @returns {Vector3} */
export function vec(x, y, z) {
  return { x, y, z };
}

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** @param {Vector3} a @param {number} s @returns {Vector3} */
export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/** a + b * s  @param {Vector3} a @param {Vector3} b @param {number} s @returns {Vector3} */
export function addScaled(a, b, s) {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

/** @param {Vector3} a @param {Vector3} b */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** @param {Vector3} a */
export function length(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

/** @param {Vector3} a @param {Vector3} b */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** @param {Vector3} a @param {Vector3} b */
export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** @param {Vector3} a @returns {Vector3} */
export function normalize(a) {
  const l = length(a);
  if (l < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

/** @param {Vector3} a @param {Vector3} b @param {number} t @returns {Vector3} */
export function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Horizontal (XZ) unit vector pointing from a to b. @param {Vector3} a @param {Vector3} b */
export function horizontalDir(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.sqrt(dx * dx + dz * dz);
  if (l < 1e-4) return { x: 0, z: 0, len: 0 };
  return { x: dx / l, z: dz / l, len: l };
}

/**
 * Right-hand vector for a view direction (horizontal, unit length).
 * @param {Vector3} dir
 * @returns {Vector3}
 */
export function rightOf(dir) {
  // Minecraft: forward (-sin(yaw), 0, cos(yaw)); right = forward x up rotated.
  const r = { x: -dir.z, y: 0, z: dir.x };
  const l = Math.sqrt(r.x * r.x + r.z * r.z);
  if (l < 1e-4) return { x: 1, y: 0, z: 0 };
  return { x: r.x / l, y: 0, z: r.z / l };
}

/** @param {Vector3} v @returns {Vector3} */
export function floorVec(v) {
  return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

/** @param {Vector3} v @returns {Vector3} */
export function copy(v) {
  return { x: v.x, y: v.y, z: v.z };
}

/** Random point offset within a cube of half-size r. @param {Vector3} v @param {number} r */
export function jitter(v, r) {
  return {
    x: v.x + (Math.random() * 2 - 1) * r,
    y: v.y + (Math.random() * 2 - 1) * r,
    z: v.z + (Math.random() * 2 - 1) * r,
  };
}
