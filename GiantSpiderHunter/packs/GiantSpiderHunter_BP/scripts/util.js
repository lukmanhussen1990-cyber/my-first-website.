// Pure helpers (no engine imports): vectors, angles, random numbers.
//
// Bedrock yaw convention: yaw 0 faces +Z (south), yaw 90 faces -X (west).
// forward(yaw) = (-sin yaw, cos yaw), left(yaw) = (cos yaw, sin yaw).

export const TPS = 20;
export const DEG = Math.PI / 180;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(lo, hi, rng = Math.random) {
  return lo + (hi - lo) * rng();
}

export function vec(x, y, z) {
  return { x, y, z };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function length(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function normalize(a) {
  const l = length(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function hdist(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Wrap an angle in degrees to (-180, 180]. */
export function wrapDeg(a) {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

/** Bedrock yaw (degrees) that faces from `from` toward `to` (horizontal). */
export function yawTo(from, to) {
  return Math.atan2(-(to.x - from.x), to.z - from.z) / DEG;
}

/** Bedrock yaw of a horizontal direction vector. */
export function yawOfDir(dx, dz) {
  return Math.atan2(-dx, dz) / DEG;
}

/** Unit forward vector for a Bedrock yaw. */
export function forwardOf(yawDeg) {
  const r = yawDeg * DEG;
  return { x: -Math.sin(r), y: 0, z: Math.cos(r) };
}

/** Rotate `current` toward `target` by at most `maxStep` degrees. */
export function stepYaw(current, target, maxStep) {
  const d = wrapDeg(target - current);
  if (Math.abs(d) <= maxStep) return wrapDeg(target);
  return wrapDeg(current + Math.sign(d) * maxStep);
}

/** Angle in degrees between two 3D vectors (0..180). */
export function angleBetween(a, b) {
  const la = length(a);
  const lb = length(b);
  if (la < 1e-9 || lb < 1e-9) return 180;
  return Math.acos(clamp(dot(a, b) / (la * lb), -1, 1)) / DEG;
}

/** Horizontal angle between the yaw's forward vector and the direction (dx, dz), degrees 0..180. */
export function angleFromForward(yawDeg, dx, dz) {
  const h = Math.sqrt(dx * dx + dz * dz);
  if (h < 1e-9) return 0;
  const f = forwardOf(yawDeg);
  return Math.acos(clamp((f.x * dx + f.z * dz) / h, -1, 1)) / DEG;
}

export function fmt(n, d = 1) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : String(n);
}

export function fmtVec(v) {
  return v ? `${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)}` : '-';
}
