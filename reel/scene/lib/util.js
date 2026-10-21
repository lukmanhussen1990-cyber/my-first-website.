// Shared helpers: seeded randomness, noise, easing, keyframes, simple 2-bone IK.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic hash -> [0,1)
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// 2D value noise + fbm (used for canvas textures)
export function makeNoise2D(seed = 1) {
  const rnd = mulberry32(seed);
  const P = 256, perm = new Uint8Array(P * 2), val = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; val[i] = rnd(); }
  for (let i = P - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[i + P] = perm[i];
  const lat = (x, y) => val[perm[(perm[x & 255] + y) & 511] & 255];
  const s = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * noise(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
    return sum / norm;
  }
  return { noise, fbm };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
// Springy pop: 0 -> overshoot -> settle to 1
export const popIn = (t) => {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return 1 - Math.exp(-6.5 * t) * Math.cos(t * 11.0) * (1 - t * 0.2);
};
// normalized progress of t inside [a,b]
export const prog = (t, a, b) => clamp((t - a) / (b - a));
// bump 0->1->0 inside [a,b]
export const bump = (t, a, b) => { const p = prog(t, a, b); return Math.sin(p * Math.PI); };
export const window01 = (t, a, b, fadeIn = 0.2, fadeOut = 0.2) => smoothstep(a, a + fadeIn, t) * (1 - smoothstep(b - fadeOut, b, t));

// Keyframe track of numbers or arrays; keys: [[time, value, ease?], ...]
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1, ez] = keys[i + 1];
      if (t <= t1) {
        const p = (ez || easeInOut)((t - t0) / Math.max(1e-6, t1 - t0));
        if (Array.isArray(v0)) return v0.map((a, k) => a + (v1[k] - a) * p);
        return v0 + (v1 - v0) * p;
      }
    }
    return keys[keys.length - 1][1];
  };
}

// Catmull-Rom style smooth vector track (for camera)
export function smoothTrack(keys) {
  // keys: [[t, [x,y,z,...]], ...]; eased hold segments using smoother between keys
  return track(keys.map((k, i) => (i === 0 ? k : [k[0], k[1], k[2] || easeInOut])));
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Two-bone IK. upper/lower are Object3D groups whose limb extends along local -Y.
 * root = upper's parent. target and pole in world space. a,b = segment lengths.
 */
export function solveIK(upper, lower, a, b, targetW, poleW) {
  const parent = upper.parent;
  parent.updateWorldMatrix(true, false);
  const inv = _m.copy(parent.matrixWorld).invert();
  const S = _v1.copy(upper.position);                 // shoulder in parent space
  const T = _v2.copy(targetW).applyMatrix4(inv);      // target in parent space
  const P = _v3.copy(poleW).applyMatrix4(inv);        // pole in parent space
  const d = T.clone().sub(S);
  let L = d.length();
  const maxL = (a + b) * 0.999, minL = Math.abs(a - b) + 1e-3;
  L = clamp(L, minL, maxL);
  d.normalize();
  const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1);
  const alpha = Math.acos(cosA);
  // bend direction: component of (pole - S) orthogonal to d
  const pv = P.clone().sub(S);
  const bendDir = pv.sub(d.clone().multiplyScalar(pv.dot(d)));
  if (bendDir.lengthSq() < 1e-8) bendDir.set(0, 0, 1);
  bendDir.normalize();
  const upperDir = d.clone().multiplyScalar(Math.cos(alpha)).add(bendDir.clone().multiplyScalar(Math.sin(alpha)));
  // upper rotation: map -Y to upperDir, keep twist so local +Z faces the bend direction
  setLimbQuat(upper.quaternion, upperDir, bendDir);
  // elbow position in parent space
  const E = S.clone().add(upperDir.clone().multiplyScalar(a));
  const lowerDirP = T.clone().sub(E).normalize();
  if (L >= maxL - 1e-4) lowerDirP.copy(d);
  // convert lowerDir into upper's local frame
  const qInv = upper.quaternion.clone().invert();
  const lowerLocal = lowerDirP.clone().applyQuaternion(qInv);
  const bendLocal = bendDir.clone().applyQuaternion(qInv);
  setLimbQuat(lower.quaternion, lowerLocal, bendLocal);
}

function setLimbQuat(q, dir, side) {
  // Build basis: y' = -dir, z' = side orthogonalized, x' = y' x z'
  const y = dir.clone().negate().normalize();
  const z = side.clone().sub(y.clone().multiplyScalar(side.dot(y)));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  _m.makeBasis(x, y, z);
  q.setFromRotationMatrix(_m);
}

export function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
