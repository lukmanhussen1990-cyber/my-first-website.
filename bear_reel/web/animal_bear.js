// THE BEAR: rest-pose (on all fours) fur geometry deformed along a posed spine curve every frame, 2-bone IK legs with
// plantigrade paws, and a 3D face rig (lids, brows, jaw, cheeks, nostrils, tear pools). Used for the bear and the map bear.
// Spaces: root (feet on y=0, +Z forward, X = bear's left), body = root offset by (0, -drop, ZOFF) (rest spine at y=Y0).
import * as THREE from 'three';
import { clamp, lerp, smooth, hash1, noise1, ik3, v3, mat } from './lib.js';
import { V, basis, frameYZ, frameZY, merge, tint, loftZ, limbY, spike, ellipsoid, frontZ, clawGeo, polyline } from './animal_geo.js';
import { furTex, muzzleTex, skyEnv } from './animal_tex.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);

// ------------------------------------------------------------------ proportions (rest pose = on all fours)
export const BEAR = {
  Y0: 0.95,                                   // rest spine line height (body space)
  JZ: [-1.22, -0.70, -0.12, 0.42, 0.80, 0.98], // spine joints: tail, pelvis, mid back, shoulders, neck base, atlas
  ZOFF: 0.09,                                 // body z offset: root = midpoint between front and hind feet
  hip: [0.285, -0.04], shoulder: [0.30, -0.12],
  F: { L1: 0.46, L2: 0.42, wristH: 0.12, toeZ: 0.17, heelZ: 0.09, clawZ: 0.31, x: 0.31, z: 0.50 },
  H: { L1: 0.50, L2: 0.46, wristH: 0.12, toeZ: 0.27, heelZ: 0.13, clawZ: 0.36, x: 0.29, z: -0.68 },
  headOff: [0, 0.075, 0.15],                  // head centre from the atlas (head frame)
  re: 0.036,                                  // eye radius
};
const { Y0, JZ, ZOFF } = BEAR;
const NS = 72, SZ0 = -1.42, SZ1 = 1.16, SDZ = (SZ1 - SZ0) / (NS - 1);   // spine samples

// body rings [z, y, halfWidth, top, bottom] (rest, body space)
const BODY = [
  [-1.31, 0.94, 0.08, 0.07, 0.08],
  [-1.27, 0.94, 0.26, 0.24, 0.27],
  [-1.15, 0.93, 0.42, 0.37, 0.41],
  [-0.95, 0.92, 0.50, 0.42, 0.45],
  [-0.65, 0.91, 0.51, 0.42, 0.45],
  [-0.30, 0.93, 0.52, 0.45, 0.45],
  [0.02, 0.97, 0.545, 0.51, 0.45],
  [0.30, 1.01, 0.56, 0.57, 0.45],
  [0.52, 1.02, 0.52, 0.52, 0.44],
  [0.70, 1.03, 0.42, 0.42, 0.38],
  [0.84, 1.05, 0.31, 0.31, 0.30],
  [1.00, 1.07, 0.245, 0.245, 0.235],
];
const SE = 2.3, se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / SE);
function ringAt(z) {
  for (let i = 0; i < BODY.length - 1; i++) {
    const a = BODY[i], b = BODY[i + 1];
    if (z <= b[0] || i === BODY.length - 2) { const t = clamp((z - a[0]) / (b[0] - a[0])); return a.map((v, k) => lerp(v, b[k], t)); }
  }
  return BODY[BODY.length - 1];
}
function bodySurf(z, a) {
  const [, y, w, top, bot] = ringAt(z);
  const sx = Math.sin(a), sy = Math.cos(a), h = sy >= 0 ? top : bot;
  return { p: V(se(sx) * w, se(sy) * h + y, z), n: V(sx / w, sy / h, 0).normalize() };
}
const furShade = (a) => { const up = Math.cos(a); return up > 0 ? 1 - 0.36 * Math.pow(up, 1.4) : 1 - 0.1 * up * up; };
const shadeRGB = (k, warm = 0) => [k * (1 + warm * 0.06), k * 0.98, k * (0.95 - warm * 0.05)];

function bodyGeometry(seed = 3) {
  const rings = BODY.map(([z, y, w, top, bot]) => ({ z, y, w, top, bot }));
  const parts = [loftZ(rings, 16, { n: SE, jag: 0.055, seed, uv: [3, 2], color: (x, y, z, a) => shadeRGB(furShade(a)) })];
  let i = 0;
  const H = (k) => hash1(seed * 31.7 + i * 7.31 + k * 1.913);
  const region = (n, z0, z1, a0, a1, len0, len1, r0, r1, dirFn, tipK = 1.0, sym = true) => {
    for (let j = 0; j < n; j++, i++) {
      const z = lerp(z0, z1, (j + H(1)) / n), aa = lerp(a0, a1, H(2));
      for (const s of sym ? [1, -1] : [1]) {
        const a = aa * s, { p, n: nrm } = bodySurf(z, a);
        const len = lerp(len0, len1, H(3)), r = lerp(r0, r1, H(4));
        const d = dirFn(nrm, a, z);
        const k = furShade(a);
        parts.push(spike(p.clone().addScaledVector(nrm, -0.012).toArray(), d.toArray(), len, r, { rot: H(5) * 3, sink: 0.35, color: (u) => shadeRGB(lerp(k, k * tipK, u)) }));
      }
    }
  };
  const back = (nrm, out, bk, up = 0) => nrm.clone().multiplyScalar(out).add(V(0, up, -bk)).normalize();
  region(9, -0.08, 0.66, 0.0, 0.62, 0.14, 0.21, 0.06, 0.085, (n) => back(n, 0.85, 0.75, 0.15), 1.25);     // hump / withers
  region(7, 0.48, 0.96, 0.95, 1.95, 0.12, 0.18, 0.055, 0.075, (n) => back(n, 0.9, 0.55, -0.15), 1.1);     // mane on the shoulder sides
  region(8, -1.12, -0.12, 0.0, 0.7, 0.09, 0.13, 0.05, 0.07, (n) => back(n, 0.7, 0.8), 1.15);               // back + rump top
  region(4, -1.27, -1.12, 0.6, 2.4, 0.09, 0.12, 0.05, 0.065, (n) => back(n, 0.8, 0.8), 1.0);               // rump end
  region(9, -0.82, 0.58, 2.45, 3.0, 0.12, 0.19, 0.05, 0.075, (n) => back(n, 0.35, 0.55, -0.85), 0.8);     // shaggy belly fringe
  region(6, -0.9, 0.25, 1.25, 2.2, 0.08, 0.12, 0.045, 0.06, (n) => back(n, 0.8, 0.7, -0.1), 1.1);          // flanks
  region(6, 0.82, 1.02, 0.0, 2.6, 0.1, 0.15, 0.05, 0.07, (n) => back(n, 1.0, 0.6), 1.15);                  // neck ruff
  return merge(parts);
}

// Curve deform: every rest vertex (x, y, z) -> P(z) + X(z) * x + Y(z) * (y - Y0), sampled spine frames.
class SpineDeformer {
  constructor(geo, breathFn) {
    const p = geo.attributes.position; this.geo = geo; this.n = p.count;
    this.rest = Float32Array.from(p.array);
    this.si = new Int16Array(this.n); this.sf = new Float32Array(this.n); this.bw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const z = this.rest[i * 3 + 2], u = clamp((z - SZ0) / SDZ, 0, NS - 1.0001);
      this.si[i] = Math.floor(u); this.sf[i] = u - Math.floor(u);
      this.bw[i] = breathFn ? breathFn(this.rest[i * 3], this.rest[i * 3 + 1], z) : 0;
    }
  }
  apply(S, breath, floorY) {
    const out = this.geo.attributes.position.array, r = this.rest, { P, X, Y } = S;
    for (let i = 0; i < this.n; i++) {
      const k = this.si[i] * 3, f = this.sf[i], g = 1 - f, b = 1 + breath * this.bw[i];
      const lx = r[i * 3] * b, ly = (r[i * 3 + 1] - Y0) * b;
      const k2 = k + 3;
      let x = (P[k] * g + P[k2] * f) + (X[k] * g + X[k2] * f) * lx + (Y[k] * g + Y[k2] * f) * ly;
      let y = (P[k + 1] * g + P[k2 + 1] * f) + (X[k + 1] * g + X[k2 + 1] * f) * lx + (Y[k + 1] * g + Y[k2 + 1] * f) * ly;
      let z = (P[k + 2] * g + P[k2 + 2] * f) + (X[k + 2] * g + X[k2 + 2] * f) * lx + (Y[k + 2] * g + Y[k2 + 2] * f) * ly;
      if (y < floorY) y = floorY;
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// ------------------------------------------------------------------ head pieces (head-local: origin = head centre)
const SKULL = { rx: 0.355, ry: 0.315, rz: 0.32 };
function skullGeometry(seed = 5) {
  const g = ellipsoid(1, 1, 1, 14, 11, (x, y, z) => {
    let X = x * SKULL.rx, Y = y * SKULL.ry, Z = z * SKULL.rz;
    if (y < 0.15) X *= 1 + 0.12 * clamp((0.15 - y) / 0.7) * (1 - clamp(-y - 0.75) * 2.5);  // fluffy cheeks
    if (y > 0.55) Y = SKULL.ry * (0.55 + (y - 0.55) * 0.8);                                // flatter crown
    if (z > 0.45) Z = SKULL.rz * (0.45 + (z - 0.45) * 0.72);                               // flatter face
    if (z < -0.3) Z *= 1.06;
    const hk = hash1(Math.round(x * 40) * 7.13 + Math.round(y * 40) * 3.71 + Math.round(z * 40) * 1.37 + seed);
    const j = 1 + (hk - 0.5) * 0.055;
    return [X * j, Y * j, Z * j];
  });
  tint(g, (x, y, z) => { let k = 1.0; if (y > 0.1) k -= 0.2 * clamp((y - 0.1) / 0.2); if (z > 0.22 && y < 0.12) k += 0.07; return shadeRGB(k); });
  const parts = [g];
  // cheek fur spikes + crown tufts
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const y = -0.03 - i * 0.055, zz = 0.06 - i * 0.04;
      parts.push(spike([s * 0.33, y, zz], [s * 1, -0.35 - i * 0.12, -0.45], 0.12 + 0.02 * (i % 2), 0.05, { rot: i, sink: 0.4, color: (u) => shadeRGB(lerp(1.05, 1.18, u)) }));
    }
    parts.push(spike([s * 0.25, -0.2, -0.12], [s * 0.6, -1, -0.5], 0.12, 0.05, { sink: 0.4, color: shadeRGB(1.0) }));
  }
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.07;
    parts.push(spike([x, 0.29, 0.02 - Math.abs(x) * 0.3], [x * 2, 1, -0.55], 0.1, 0.045, { rot: i * 1.3, sink: 0.45, color: (u) => shadeRGB(lerp(0.8, 0.95, u)) }));
  }
  return merge(parts);
}
const MUZ = [[0.06, -0.058, 0.205, 0.15, 0.117], [0.22, -0.072, 0.19, 0.145, 0.1], [0.36, -0.083, 0.172, 0.132, 0.088],
  [0.47, -0.09, 0.152, 0.118, 0.08], [0.54, -0.095, 0.124, 0.094, 0.07], [0.565, -0.096, 0.08, 0.056, 0.045]];
function muzzleGeometry() {
  return loftZ(MUZ.map(([z, y, w, top, bot]) => ({ z, y, w, top, bot })), 14, { n: 2.2, jag: 0.03, seed: 9, uv: [2, 3],
    color: (x, y, z, a, i, cap) => {
      const up = Math.cos(a);
      if (up < -0.72) return z < 0.47 ? [1.35, 0.62, 0.66] : [0.3, 0.24, 0.22];   // roof of the mouth (pink) / dark lips
      if (up < -0.45) return [0.45, 0.36, 0.32];
      return [1, 1, 1];
    } });
}
const JAW = [[-0.04, -0.03, 0.16, 0.06, 0.07], [0.12, -0.04, 0.152, 0.052, 0.074], [0.28, -0.05, 0.132, 0.042, 0.066],
  [0.4, -0.056, 0.106, 0.034, 0.052], [0.47, -0.058, 0.076, 0.026, 0.036], [0.495, -0.058, 0.04, 0.014, 0.02]];
function jawGeometry() {
  const g = loftZ(JAW.map(([z, y, w, top, bot]) => ({ z, y, w, top, bot })), 12, { n: 2.2, jag: 0.03, seed: 11, uv: [2, 3],
    color: (x, y, z, a) => { const up = Math.cos(a); if (up > 0.75) return [1.3, 0.62, 0.66]; if (up > 0.45) return [0.32, 0.25, 0.22]; return [0.95, 0.93, 0.9]; } });
  return g;
}
function noseGeometry() {
  return ellipsoid(1, 1, 1, 16, 12, (x, y, z) => {
    let X = x * 0.108, Y = y * 0.068, Z = z * 0.072;
    X *= 1 - 0.3 * clamp(-y);                                    // rounded inverted trapezoid
    if (y > 0.25) Y = 0.068 * (0.25 + (y - 0.25) * 0.72);         // flatter top
    const notch = Math.max(0, 1 - Math.abs(x) / 0.28) * clamp((-y - 0.45) * 2);
    Y += 0.02 * notch;                                            // philtrum notch
    if (z > 0) Z *= 1 + 0.12 * (1 - Math.abs(y));                  // fuller front
    return [X, Y, Z];
  });
}
function pawGeometry(kind) {
  const F = kind === 'F';
  const R = F
    ? [[-0.1, -0.055, 0.1, 0.055, 0.065], [-0.03, -0.058, 0.125, 0.07, 0.062], [0.07, -0.066, 0.14, 0.062, 0.054], [0.15, -0.074, 0.135, 0.05, 0.046], [0.2, -0.08, 0.11, 0.036, 0.04], [0.22, -0.082, 0.06, 0.02, 0.026]]
    : [[-0.14, -0.06, 0.09, 0.06, 0.06], [-0.05, -0.06, 0.115, 0.075, 0.06], [0.08, -0.065, 0.125, 0.065, 0.055], [0.2, -0.072, 0.125, 0.05, 0.048], [0.28, -0.078, 0.105, 0.038, 0.042], [0.31, -0.08, 0.06, 0.02, 0.028]];
  const g = loftZ(R.map(([z, y, w, top, bot]) => ({ z, y, w, top, bot })), 12, { n: 2.4, jag: 0.04, seed: F ? 13 : 14, uv: [2, 3],
    color: (x, y, z, a) => (Math.cos(a) < -0.55 ? [0.32, 0.3, 0.3] : shadeRGB(0.95)) });
  const parts = [g];
  const tz = F ? 0.17 : 0.255;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * (F ? 0.047 : 0.043);
    const t = ellipsoid(F ? 0.03 : 0.028, 0.032, 0.036, 6, 5); t.translate(x, -0.078, tz + 0.012 - Math.abs(i - 2) * 0.012); tint(t, shadeRGB(0.92)); parts.push(t);
  }
  // shaggy fur at the wrist / ankle
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    parts.push(spike([Math.sin(a) * 0.1, 0.0, Math.cos(a) * 0.09 - 0.01], [Math.sin(a), -0.7, Math.cos(a) - 0.3], 0.1, 0.045, { rot: i, sink: 0.4, color: (u) => shadeRGB(lerp(0.9, 1.05, u)) }));
  }
  return merge(parts);
}
function clawsGeometry(kind) {
  const F = kind === 'F', parts = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * (F ? 0.047 : 0.043);
    const c = clawGeo(F ? 0.12 + (i === 2 ? 0.012 : 0) : 0.075, F ? 0.0155 : 0.014, F ? 0.85 : 0.7, 4);
    c.rotateY((i - 2) * 0.06);
    c.translate(x, 0, -Math.abs(i - 2) * 0.012);
    parts.push(c);
  }
  return merge(parts);
}
// limb rings: {t, w, back, front}
const LIMBS = {
  upperF: [{ t: 0, w: 0.2, back: 0.2, front: 0.18 }, { t: 0.55, w: 0.165, back: 0.19, front: 0.15 }, { t: 1, w: 0.14, back: 0.155, front: 0.13 }],
  lowerF: [{ t: 0, w: 0.14, back: 0.15, front: 0.13 }, { t: 0.55, w: 0.122, back: 0.13, front: 0.115 }, { t: 1, w: 0.112, back: 0.11, front: 0.105 }],
  upperH: [{ t: 0, w: 0.25, back: 0.27, front: 0.24 }, { t: 0.5, w: 0.2, back: 0.22, front: 0.19 }, { t: 1, w: 0.15, back: 0.155, front: 0.14 }],
  lowerH: [{ t: 0, w: 0.15, back: 0.155, front: 0.14 }, { t: 0.6, w: 0.125, back: 0.13, front: 0.12 }, { t: 1, w: 0.11, back: 0.11, front: 0.105 }],
};
function limbGeometry(kind, len, seed) {
  const g = limbY(len, LIMBS[kind], 8, { n: 2.2, jag: 0.06, seed, uv: [2, 2], color: (x, y, z, a) => shadeRGB(0.92 + 0.06 * Math.cos(a)) });
  const parts = [g];
  const tuftN = kind === 'lowerF' ? 5 : kind === 'upperF' ? 3 : kind === 'upperH' ? 4 : 3;
  for (let i = 0; i < tuftN; i++) {
    const t = (i + 0.5) / tuftN, r = LIMBS[kind];
    const back = lerp(r[0].back, r[r.length - 1].back, t);
    for (const sx of [-0.5, 0.5]) {
      const x = sx * 0.12 * (1 + hash1(i * 3.1 + seed));
      parts.push(spike([x, t * len, -back * 0.85], [x * 2, -0.55, -1], 0.12 + 0.04 * hash1(i + seed), 0.05, { rot: i, sink: 0.35, color: (u) => shadeRGB(lerp(0.9, 1.05, u)) }));
    }
  }
  return merge(parts);
}

// ------------------------------------------------------------------ expression tables
const BROWS = { neutral: [0.0, 0.0], sad: [0.5, 0.006], worried: [0.4, 0.02], angry: [-0.5, -0.018], raised: [0.1, 0.038] };
const JAW_OPEN = { closed: 0, open: 0.3, growl: 0.26, wail: 0.62, tremble: 0.07, pressed: -0.025 };
const GAITS = {
  walk: { D: 1.7, beta: 0.63, td: { LH: 0.0, LF: 0.25, RH: 0.5, RF: 0.75 }, liftF: 0.2, liftH: 0.15, flipF: 1.05, flipH: 0.55 },
  run: { D: 3.2, beta: 0.36, td: { LH: 0.0, RH: 0.12, LF: 0.48, RF: 0.6 }, liftF: 0.34, liftH: 0.28, flipF: 1.3, flipH: 0.9 },
  biped_run: { D: 2.6, beta: 0.4, td: { LH: 0.0, RH: 0.5 }, liftH: 0.4, flipH: 0.7 },
};
export const BEAR_GAITS = GAITS;

// ------------------------------------------------------------------ materials (shared by the bear and the map bear)
export function bearMaterials() {
  const env = skyEnv();
  const M = {};
  const fur = (hex, seed, rep, o = {}) => { const m = mat(furTex(hex, { seed, ...o }, rep), { rough: 0.95 }); m.vertexColors = true; return m; };
  M.body = fur('#6f4526', 21, [1, 1]);
  M.leg = fur('#5e3a20', 22, [1, 1]);
  M.head = fur('#76492a', 23, [3, 2]);
  M.headFace = M.head;
  M.muzzle = mat(muzzleTex('#c9a074', 4), { rough: 0.9 }); M.muzzle.vertexColors = true;
  M.paw = fur('#563520', 24, [1, 1]);
  M.claw = mat('#2c2622', { rough: 0.38 }); M.claw.envMap = env; M.claw.envMapIntensity = 0.5;
  M.nose = new THREE.MeshStandardMaterial({ color: '#191416', roughness: 0.16, metalness: 0.0, flatShading: false, envMap: env, envMapIntensity: 1.15 });
  M.nostril = mat('#050404', { rough: 1 });
  M.eye = new THREE.MeshStandardMaterial({ color: '#0b0908', roughness: 0.1, metalness: 0, flatShading: false, envMap: env, envMapIntensity: 0.9 });
  M.white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  M.sclera = mat('#f4efe6', { rough: 0.5 });
  M.line = mat('#1c120c', { rough: 0.9 });
  M.brow = fur('#2c1a0f', 25, [1, 1], { amount: 22 });
  M.earIn = mat('#b98e6c', { rough: 0.95 });
  M.mouth = mat('#4e1216', { rough: 0.9 });
  M.tongue = mat('#cf5f6a', { rough: 0.55 });
  M.teeth = mat('#f2ece0', { rough: 0.45 });
  M.drop = new THREE.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.03, metalness: 0, envMap: env, envMapIntensity: 1.4, transparent: true, opacity: 0.85 });
  M.tear = new THREE.MeshStandardMaterial({ color: '#9fd8ff', roughness: 0.04, metalness: 0, envMap: env, envMapIntensity: 1.3, transparent: true, opacity: 0.78, emissive: new THREE.Color('#2a5a86'), emissiveIntensity: 0.35, depthWrite: false });
  M.whisker = mat('#2a1d14', { rough: 0.9 });
  return M;
}
// separate face materials (tinted green per bear)
function faceMaterials(M) {
  return { head: M.head.clone(), muzzle: M.muzzle.clone(), earIn: M.earIn.clone(), brow: M.brow };
}

// ------------------------------------------------------------------ the bear
export class Bear {
  constructor(world, M, { name = 'bear', parent = null } = {}) {
    this.name = name; this.world = world; this.M = M;
    this.FM = faceMaterials(M);
    this.root = new THREE.Group(); this.root.name = name;
    (parent || world.scene).add(this.root);
    this.body = new THREE.Group(); this.body.name = `${name}.bodyGroup`; this.root.add(this.body);
    this.legs = new THREE.Group(); this.legs.name = `${name}.legGroup`; this.root.add(this.legs);
    this.S = { P: new Float32Array(NS * 3), X: new Float32Array(NS * 3), Y: new Float32Array(NS * 3) };
    this.headRadius = 0.33;
    this.build();
    this.p = this.defaults();
  }

  mk(geo, material, part, parent, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, material); m.name = `${this.name}.${part}`; m.castShadow = cast; m.receiveShadow = receive;
    (parent || this.root).add(m); return m;
  }

  build() {
    const M = this.M, FM = this.FM;
    // ---- torso (deformed every frame)
    const bg = bodyGeometry(3);
    this.bodyMesh = this.mk(bg, M.body, 'body', this.body);
    this.bodyMesh.frustumCulled = true;
    this.deformer = new SpineDeformer(bg, (x, y, z) => clamp(1 - Math.abs(z + 0.05) / 0.75) * (y > 0.6 ? 1 : 0.6));
    // ---- tail
    const tg = merge([loftZ([{ z: -0.02, w: 0.07, top: 0.07, bot: 0.07 }, { z: 0.06, w: 0.085, top: 0.08, bot: 0.08 }, { z: 0.15, w: 0.06, top: 0.05, bot: 0.055 }, { z: 0.19, w: 0.02, top: 0.02, bot: 0.02 }], 7, { jag: 0.1, seed: 4, color: () => shadeRGB(0.8) }),
      spike([0, 0.02, 0.12], [0, 0.3, 1], 0.1, 0.05, { color: shadeRGB(0.85) }), spike([0.03, -0.02, 0.1], [0.4, -0.3, 1], 0.09, 0.04, { color: shadeRGB(0.85) })]);
    this.tail = new THREE.Group(); this.body.add(this.tail);
    this.mk(tg, M.body, 'tail', this.tail);
    // ---- head
    this.headPivot = new THREE.Group(); this.headPivot.name = `${this.name}.headPivot`; this.body.add(this.headPivot);
    this.head = new THREE.Group(); this.head.name = `${this.name}.head`; this.head.position.set(...BEAR.headOff); this.headPivot.add(this.head);
    this.buildHead();
    // ---- legs
    const F = BEAR.F, Hh = BEAR.H;
    this.legSet = {};
    for (const leg of ['LF', 'RF', 'LH', 'RH']) {
      const front = leg[1] === 'F', sx = leg[0] === 'L' ? 1 : -1;
      const L = front ? F : Hh;
      const up = this.mk(limbGeometry(front ? 'upperF' : 'upperH', L.L1, front ? 31 : 33), M.leg, `${leg}.upper`, this.legs);
      const lo = this.mk(limbGeometry(front ? 'lowerF' : 'lowerH', L.L2, front ? 32 : 34), M.leg, `${leg}.lower`, this.legs);
      const paw = new THREE.Group(); paw.name = `${this.name}.${leg}.pawGroup`; this.legs.add(paw);
      this.mk(pawGeometry(front ? 'F' : 'H'), M.paw, `${leg}.paw`, paw);
      const clawPivot = new THREE.Group(); clawPivot.position.set(0, -0.07, front ? 0.19 : 0.28); paw.add(clawPivot);
      this.mk(clawsGeometry(front ? 'F' : 'H'), M.claw, `${leg}.claws`, clawPivot, { cast: false });
      this.legSet[leg] = { up, lo, paw, clawPivot, front, sx, L };
    }
  }

  buildHead() {
    const M = this.M, FM = this.FM, h = this.head, re = BEAR.re;
    const skull = skullGeometry(5);
    this.skullGeo = skull;
    this.mk(skull, FM.head, 'skull', h);
    const muz = muzzleGeometry();
    this.muzzle = this.mk(muz, FM.muzzle, 'muzzle', h);
    // nose group (twitches with sniff)
    this.noseGrp = new THREE.Group(); this.noseGrp.position.set(0, -0.032, 0.565); h.add(this.noseGrp);
    const ng = noseGeometry();
    this.noseMesh = this.mk(ng, M.nose, 'nose', this.noseGrp);
    const nz = (x, y) => frontZ(ng, x, y);
    this.nostrils = [];
    for (const s of [1, -1]) {
      const nGeo = ellipsoid(0.027, 0.0135, 0.014, 10, 6);
      const nm = this.mk(nGeo, M.nostril, `nostril${s > 0 ? 'L' : 'R'}`, this.noseGrp, { cast: false });
      const x = s * 0.047, y = -0.016;
      nm.position.set(x, y, nz(x, y) - 0.006);
      nm.rotation.set(-0.35, s * 0.42, -s * 0.5);
      nm.userData.base = nm.position.clone();
      this.nostrils.push(nm);
    }
    // wet highlights + droplets
    const hl = merge([ellipsoid(0.024, 0.0095, 0.004, 8, 4).translate(-0.032, 0.046, nz(-0.032, 0.046) - 0.001), ellipsoid(0.008, 0.006, 0.003, 6, 4).translate(-0.066, 0.025, nz(-0.066, 0.025) - 0.0005),
      ellipsoid(0.012, 0.005, 0.003, 6, 4).translate(0.05, 0.04, nz(0.05, 0.04) - 0.0005)]);
    const hlm = this.mk(hl, M.white, 'noseShine', this.noseGrp, { cast: false, receive: false });
    hlm.rotation.x = -0.18; hlm.userData.noAudit = true;
    const dps = [];
    for (const [x, y, r] of [[0.018, 0.055, 0.0075], [-0.06, 0.04, 0.006], [0.072, 0.02, 0.0055], [0.0, 0.03, 0.0045], [-0.012, 0.062, 0.005]]) {
      const z = nz(x, y); if (!Number.isFinite(z)) continue;   // droplet outside the nose outline: skip
      dps.push(ellipsoid(r, r * 0.8, r * 0.7, 6, 4).translate(x, y, z - r * 0.2));
    }
    const dm = this.mk(merge(dps), M.drop, 'noseDrops', this.noseGrp, { cast: false, receive: false }); dm.userData.noAudit = true;
    this.noseTip = new THREE.Object3D(); this.noseTip.position.set(0, -0.005, nz(0, -0.005)); this.noseGrp.add(this.noseTip);
    // philtrum + whiskers
    const mz = (x, y) => frontZ(muz, x, y);
    const ph = this.mk(new THREE.BoxGeometry(0.013, 0.07, 0.012), M.line, 'philtrum', h, { cast: false });
    ph.position.set(0, -0.135, mz(0, -0.135) - 0.002);
    const wk = [];
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const y = -0.1 - i * 0.022, x = s * 0.105;
      const z = frontZ(muz, x, y);
      const b = new THREE.BoxGeometry(0.11 - i * 0.015, 0.0045, 0.0045); b.translate((0.11 - i * 0.015) / 2, 0, 0);
      b.rotateZ(s > 0 ? -0.12 + i * 0.12 : Math.PI + 0.12 - i * 0.12); b.rotateY(-s * 0.35);
      b.translate(x, y, z - 0.01); wk.push(b);
    }
    this.mk(merge(wk), M.whisker, 'whiskers', h, { cast: false });
    // dots (whisker pores) are painted in the muzzle texture
    // ---- jaw + mouth inside
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.145, 0.06); h.add(this.jaw);
    this.mk(jawGeometry(), FM.muzzle, 'jaw', this.jaw);
    const tongue = ellipsoid(0.085, 0.024, 0.165, 10, 6); tongue.translate(0, 0.012, 0.22);
    this.mk(tongue, M.tongue, 'tongue', this.jaw, { cast: false });
    const lt = [];
    for (const s of [1, -1]) { const c = new THREE.ConeGeometry(0.014, 0.05, 5); c.translate(0, 0.025, 0); c.translate(s * 0.068, 0.018, 0.39); lt.push(c); }
    for (let i = 0; i < 4; i++) { const b = new THREE.BoxGeometry(0.016, 0.022, 0.012); b.translate((i - 1.5) * 0.02, 0.022, 0.452 - Math.abs(i - 1.5) * 0.008); lt.push(b); }
    this.mk(merge(lt), M.teeth, 'teethLow', this.jaw, { cast: false });
    for (let i = 0; i < 3; i++) this.mk(spike([(i - 1) * 0.05, -0.1, 0.3 - i * 0.02 - Math.abs(i - 1) * 0.04], [(i - 1) * 0.3, -1, -0.6], 0.1, 0.045, { color: shadeRGB(1.0) }), FM.head, `chinTuft${i}`, this.jaw);
    const ut = [];
    for (const s of [1, -1]) { const c = new THREE.ConeGeometry(0.016, 0.06, 5); c.rotateX(Math.PI); c.translate(0, -0.03, 0); c.translate(s * 0.086, -0.162, 0.45); ut.push(c); }
    for (let i = 0; i < 4; i++) { const b = new THREE.BoxGeometry(0.016, 0.024, 0.012); b.translate((i - 1.5) * 0.021, -0.17, 0.528 - Math.abs(i - 1.5) * 0.01); ut.push(b); }
    this.mk(merge(ut), M.teeth, 'teethUp', h, { cast: false });
    this.mouthIn = new THREE.Group(); this.mouthIn.position.copy(this.jaw.position); h.add(this.mouthIn);
    const cav = ellipsoid(0.125, 0.055, 0.2, 10, 6); cav.translate(0, -0.012, 0.19);
    this.cavity = this.mk(cav, M.mouth, 'mouthInside', this.mouthIn, { cast: false });
    // ---- cheeks
    this.cheeks = [];
    for (const s of [1, -1]) {
      const c = ellipsoid(0.135, 0.11, 0.13, 9, 7); tint(c, shadeRGB(1.06));
      const cm = this.mk(c, FM.head, `cheek${s > 0 ? 'L' : 'R'}`, h);
      cm.position.set(s * 0.2, -0.1, 0.16); cm.userData.base = cm.position.clone(); this.cheeks.push(cm);
    }
    // ---- ears
    this.ears = [];
    for (const s of [1, -1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.245, 0.225, -0.05); h.add(eg);
      const outer = new THREE.CylinderGeometry(0.115, 0.12, 0.075, 10, 1); outer.rotateX(Math.PI / 2); outer.scale(1, 0.95, 1); outer.translate(0, 0.07, 0);
      const parts = [tint(outer.toNonIndexed(), shadeRGB(0.78))];
      for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.9; parts.push(spike([Math.sin(a) * 0.1, 0.07 + Math.cos(a) * 0.1, -0.01], [Math.sin(a), Math.cos(a), -0.4], 0.07, 0.035, { color: shadeRGB(0.8) })); }
      this.mk(merge(parts), FM.head, `ear${s > 0 ? 'L' : 'R'}`, eg);
      const inner = new THREE.CylinderGeometry(0.068, 0.075, 0.02, 9, 1); inner.rotateX(Math.PI / 2); inner.translate(0, 0.06, 0.035);
      this.mk(inner, FM.earIn, `earIn${s > 0 ? 'L' : 'R'}`, eg, { cast: false });
      eg.rotation.set(0, s * 0.18, -s * 0.38);
      eg.userData.s = s; this.ears.push(eg);
    }
    // ---- eyes
    this.eyes = {};
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const ex = s * 0.148, ey = 0.068;
      const ez = frontZ(skull, ex, ey);
      const n = V(s * 0.32, 0.12, 1).normalize();
      const g = new THREE.Group(); g.position.set(ex, ey, ez - 0.004); g.quaternion.copy(frameZY(n, AY)); h.add(g);
      const ball = this.mk(new THREE.SphereGeometry(re, 12, 9), M.eye, `eye${side}`, g, { cast: false }); ball.position.z = -0.012;
      const hlg = new THREE.SphereGeometry(re * 0.28, 6, 4);
      const hl = this.mk(hlg, M.white, `eyeShine${side}`, g, { cast: false, receive: false });
      hl.position.copy(V(-0.38, 0.42, 0.82).normalize().multiplyScalar(re)).add(V(0, 0, -0.011)); hl.userData.noAudit = true;
      const sc = ellipsoid(re * 1.62, re * 1.55, re * 0.62, 12, 8); sc.translate(0, 0, -0.012);
      const sclera = this.mk(sc, M.sclera, `eyeWhite${side}`, g, { cast: false });
      const lid = ellipsoid(re * 1.42, re * 1.2, re * 0.6, 10, 7); tint(lid, shadeRGB(1.0));
      const lidM = this.mk(lid, FM.head, `lid${side}`, g, { cast: false }); lidM.position.z = -0.006;
      const lz = re * 0.6 - 0.006 + 0.004;
      const W = re * 1.25;
      const closed = this.mk(polyline([[-W, 0.006], [-W * 0.5, -0.008], [0, -0.012], [W * 0.5, -0.008], [W, 0.006]], 0.011, 0.01, lz), M.line, `lidLineClosed${side}`, g, { cast: false });
      const happy = this.mk(polyline([[-W, -0.012], [-W * 0.5, 0.008], [0, 0.014], [W * 0.5, 0.008], [W, -0.012]], 0.012, 0.01, lz), M.line, `lidLineHappy${side}`, g, { cast: false });
      const ap = -s; // chevron apex points toward the nose (head -X for the left eye)
      const squeeze = this.mk(polyline([[-ap * W, 0.022], [ap * W * 0.75, 0], [-ap * W, -0.022]], 0.012, 0.01, lz + 0.002), M.line, `lidLineSqueeze${side}`, g, { cast: false });
      const pool = ellipsoid(re * 1.55, re * 1.3, re * 0.8, 12, 8);
      const tearM = this.mk(pool, M.tear, `tearPool${side}`, g, { cast: false, receive: false }); tearM.userData.noAudit = true; tearM.renderOrder = 2;
      const tearHl = this.mk(merge([ellipsoid(re * 0.3, re * 0.22, re * 0.08, 6, 4).translate(-re * 0.55, re * 0.45, re * 0.78), ellipsoid(re * 0.14, re * 0.12, re * 0.06, 6, 4).translate(re * 0.5, -re * 0.35, re * 0.8)]), M.white, `tearShine${side}`, g, { cast: false, receive: false });
      tearHl.userData.noAudit = true; tearHl.renderOrder = 3;
      this.eyes[side] = { g, ball, hl, sclera, lid: lidM, closed, happy, squeeze, pool: tearM, poolHl: tearHl, s, surf: V(ex, ey, ez + 0.02) };
    }
    // ---- brows (dark fur blocks)
    this.brows = [];
    for (const s of [1, -1]) {
      const bx = s * 0.145, by = 0.158, bz = frontZ(skull, bx, by);
      const bg = merge([new THREE.BoxGeometry(0.15, 0.042, 0.06, 2, 1, 1), spike([s * 0.07, 0.01, 0], [s, 0.35, -0.2], 0.05, 0.022, { color: shadeRGB(1) })]);
      const pivot = new THREE.Group(); pivot.position.set(bx, by, bz - 0.012); pivot.quaternion.copy(frameZY(V(s * 0.38, 0.32, 1).normalize(), AY)); h.add(pivot);
      const bm = this.mk(bg, FM.brow, `brow${s > 0 ? 'L' : 'R'}`, pivot, { cast: false });
      this.brows.push({ pivot, bm, s, base: pivot.position.clone() });
    }
    this.mouthLocal = V(0, -0.185, 0.5);
  }

  defaults() {
    return {
      pos: [0, 0], y: 0, rotY: Math.PI, visible: true, scale: 1,
      gait: 'idle', phase: 0, stance: 0, sit: 0, pawLift: null, lean: 0, turn: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null, neck: 0,
      eyes: 'open', brows: 'neutral', mouth: 'closed', ears: 0.5, sniff: 0, cheeksIn: 0, cheeksPuff: 0, tears: 0, green: 0,
      pawL: null, pawR: null, pinch: 0, flail: 0, tailWag: 0, breath: 1, blink: true,
    };
  }

  // ---------------------------------------------------------------- API (world space, valid after commit)
  _w(local, obj) { obj.updateMatrixWorld(true); return local.clone().applyMatrix4(obj.matrixWorld); }
  headPos() { return this._w(V(), this.head); }
  nosePos() { return this._w(V(), this.noseTip); }
  eyeLocal(side = 'L') { const e = this.eyes[side] || this.eyes.L; return e.surf.clone(); }
  eyePos(side = 'L') { return this._w(this.eyeLocal(side), this.head); }
  mouthPos() { return this._w(this.mouthLocal, this.head); }
  pawPos(leg = 'FR') { const k = leg.length === 2 && (leg[0] === 'F' || leg[0] === 'B') ? (leg[1] + (leg[0] === 'F' ? 'F' : 'H')) : leg; const L = this.legSet[k] || this.legSet.RF; return this._w(V(0, -0.07, 0.06), L.paw); }

  // ---------------------------------------------------------------- spine
  // post: { pel: V (body space), pitch[5], yaw[5], roll[5], stretch[5] }
  solveSpine(post) {
    const q = [], L = [];
    for (let k = 0; k < 5; k++) {
      q.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(-post.pitch[k], post.yaw[k], post.roll[k], 'YXZ')));
      L.push((JZ[k + 1] - JZ[k]) * post.stretch[k]);
    }
    const P = new Array(6), Qj = new Array(6), Zd = (qq) => AZ.clone().applyQuaternion(qq);
    P[1] = post.pel.clone();
    P[0] = P[1].clone().addScaledVector(Zd(q[0]), -L[0]);
    for (let k = 1; k < 5; k++) P[k + 1] = P[k].clone().addScaledVector(Zd(q[k]), L[k]);
    Qj[0] = q[0].clone(); Qj[5] = q[4].clone();
    for (let k = 1; k < 5; k++) Qj[k] = q[k - 1].clone().slerp(q[k], 0.5);
    this.J = { P, Qj, L, q };
    const S = this.S, tq = new THREE.Quaternion(), tp = V(), tx = V(), ty = V();
    for (let j = 0; j < NS; j++) {
      const z = SZ0 + j * SDZ;
      this.frameAtInto(z, tp, tq);
      tx.copy(AX).applyQuaternion(tq); ty.copy(AY).applyQuaternion(tq);
      S.P[j * 3] = tp.x; S.P[j * 3 + 1] = tp.y; S.P[j * 3 + 2] = tp.z;
      S.X[j * 3] = tx.x; S.X[j * 3 + 1] = tx.y; S.X[j * 3 + 2] = tx.z;
      S.Y[j * 3] = ty.x; S.Y[j * 3 + 1] = ty.y; S.Y[j * 3 + 2] = ty.z;
    }
  }
  frameAtInto(z, outP, outQ) {
    const { P, Qj, L } = this.J;
    if (z <= JZ[0]) { outQ.copy(Qj[0]); outP.copy(P[0]).addScaledVector(AZ.clone().applyQuaternion(Qj[0]), (z - JZ[0]) * L[0] / (JZ[1] - JZ[0])); return; }
    if (z >= JZ[5]) { outQ.copy(Qj[5]); outP.copy(P[5]).addScaledVector(AZ.clone().applyQuaternion(Qj[5]), (z - JZ[5]) * L[4] / (JZ[5] - JZ[4])); return; }
    let k = 0; while (k < 4 && z > JZ[k + 1]) k++;
    const t = (z - JZ[k]) / (JZ[k + 1] - JZ[k]);
    const m0 = AZ.clone().applyQuaternion(Qj[k]).multiplyScalar(L[k]), m1 = AZ.clone().applyQuaternion(Qj[k + 1]).multiplyScalar(L[k]);
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    outP.copy(P[k]).multiplyScalar(h00).addScaledVector(m0, h10).addScaledVector(P[k + 1], h01).addScaledVector(m1, h11);
    outQ.copy(Qj[k]).slerp(Qj[k + 1], t);
  }
  frameAt(z) { const p = V(), q = new THREE.Quaternion(); this.frameAtInto(z, p, q); return { p, q }; }

  // ---------------------------------------------------------------- solve: write p into the meshes
  solve(t) {
    const p = this.p;
    this.root.visible = !!p.visible;
    if (!p.visible) return;
    const sc = p.scale ?? 1;
    this.root.position.set(p.pos[0], p.y ?? 0, p.pos[1]);
    this.root.rotation.set(0, p.rotY ?? 0, 0);
    this.root.scale.setScalar(sc);
    const gait = p.gait || 'idle', G = GAITS[gait];
    const biped = gait === 'biped_run' ? 1 : 0;
    const st = biped ? 0 : smooth(clamp(p.stance)), si = biped ? 0 : smooth(clamp(p.sit));
    const ph = p.phase || 0, w = TAU * ph;
    const walkAmt = gait === 'walk' ? 1 : gait === 'run' ? 1.6 : 0;
    const quad = (1 - st) * (1 - si) * (1 - biped);       // how much "on all fours"

    // ---- posture blend
    const PO = {
      all4: { pel: [Y0, JZ[1]], pitch: [0, 0, 0, 0, 0], head: -0.1 },
      stand: { pel: [1.0, -0.6], pitch: [1.0, 1.3, 1.42, 1.38, 1.1], head: 0.02 },
      sit: { pel: [0.5, -0.44], pitch: [0.2, 1.06, 1.24, 1.12, 0.85], head: -0.08 },
      biped: { pel: [1.0, -0.58], pitch: [0.85, 1.02, 1.12, 1.05, 0.78], head: 0.12 },
    };
    const mixPost = (a, b, k) => ({ pel: [lerp(a.pel[0], b.pel[0], k), lerp(a.pel[1], b.pel[1], k)], pitch: a.pitch.map((v, i) => lerp(v, b.pitch[i], k)), head: lerp(a.head, b.head, k) });
    let post = mixPost(PO.all4, PO.stand, st);
    post = mixPost(post, PO.sit, si);
    if (biped) post = PO.biped;
    const pitch = post.pitch.slice(), yaw = [0, 0, 0, 0, 0], roll = [0, 0, 0, 0, 0];
    const stretch = [1, 1 + 0.06 * (st + biped), 1 + 0.06 * (st + biped), 1, 1];
    let pelY = post.pel[0], pelZ = post.pel[1], headPitchW = post.head, headYawW = 0, headRollW = 0;
    // forward lean (extra), body turn
    for (let k = 1; k < 4; k++) pitch[k] -= (p.lean || 0) * 0.35;
    for (let k = 0; k < 5; k++) yaw[k] += (p.turn || 0) * (k / 4);

    // ---- gait body motion
    if (gait === 'walk' || gait === 'run') {
      const a = walkAmt * quad;
      const bobH = 0.022 * Math.cos(2 * w + 0.5), bobF = 0.026 * Math.cos(2 * w - 1.3);
      pelY += bobH * a;
      const dF = bobF - bobH;
      pitch[1] += Math.atan2(dF, 1.1) * a; pitch[2] += Math.atan2(dF, 1.1) * a;
      for (let k = 0; k < 5; k++) { roll[k] += 0.035 * Math.sin(w + 0.6 + k * 0.4) * a; yaw[k] += 0.04 * Math.sin(w + k * 1.1) * a * (k < 3 ? 1 : 0.6); }
      headPitchW += -0.04 * Math.cos(2 * w - 1.7) * a;
      headYawW += -0.04 * Math.sin(w + 2.2) * a;
      if (gait === 'run') { const fl = Math.sin(TAU * (ph - 0.1)); pitch[1] += 0.14 * fl * quad; pitch[2] -= 0.12 * fl * quad; pelY += 0.05 * Math.abs(Math.sin(TAU * ph)) * quad; }
    }
    if (biped) {
      const bb = -0.05 * Math.cos(TAU * 2 * (ph - 0.2));
      pelY += bb;
      yaw[0] += 0.14 * Math.sin(w); yaw[1] += 0.1 * Math.sin(w); yaw[2] -= 0.05 * Math.sin(w); yaw[3] -= 0.1 * Math.sin(w); yaw[4] -= 0.05 * Math.sin(w);
      roll[2] += 0.06 * Math.sin(w); roll[3] += 0.05 * Math.sin(w + 0.5);
      headPitchW += 0.03 * Math.cos(2 * w);
    }
    // idle life: breathing + slow weight shifts
    const br = (p.breath ?? 1) * (0.6 + 0.4 * (1 - walkAmt));
    const breath = 0.018 * br * Math.sin(TAU * t / 3.1);
    pitch[2] += 0.01 * br * Math.sin(TAU * t / 3.1 + 0.4);
    headPitchW += 0.012 * Math.sin(TAU * t / 3.1 - 0.6) * (1 - walkAmt * 0.5) + 0.01 * noise1(t * 0.4, 3);
    headYawW += 0.02 * noise1(t * 0.3, 5) * (1 - walkAmt);
    // pawLift weight shift
    const pl = p.pawLift && p.pawLift.amount ? clamp(p.pawLift.amount) : 0, plS = p.pawLift && p.pawLift.leg && p.pawLift.leg.includes('R') ? -1 : 1;
    if (pl > 0) { for (let k = 2; k < 5; k++) roll[k] += -plS * 0.05 * pl; headPitchW += 0.05 * pl; }
    // neck stretch forward/down (lean over a bush)
    const nk = clamp(p.neck || 0);
    if (nk > 0) {
      pitch[3] -= 0.55 * nk; pitch[4] -= 0.35 * nk; pitch[2] -= 0.12 * nk;
      stretch[3] = 1 + 0.6 * nk; stretch[4] = 1 + 0.9 * nk;
      headPitchW -= 0.35 * nk;
    }
    // look direction
    headPitchW += p.headPitch || 0; headYawW += p.headYaw || 0; headRollW += p.headRoll || 0;
    let lookYaw = 0, lookPitch = 0;
    const pre = { pel: V(0, pelY, pelZ), pitch, yaw, roll, stretch };
    if (p.lookAt) {
      this.solveSpine(pre);
      this.root.updateMatrixWorld(true);
      const tgt = v3(p.lookAt).applyMatrix4(new THREE.Matrix4().copy(this.root.matrixWorld).invert()).sub(V(0, 0, ZOFF));
      const hp = this.J.P[5].clone().add(V(...BEAR.headOff).applyAxisAngle(AX, -headPitchW));
      const d = tgt.sub(hp);
      lookYaw = clamp(Math.atan2(d.x, d.z), -1.4, 1.4);
      lookPitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1.0, 0.9);
      headPitchW += lookPitch - post.head * 0.5;
      headYawW += lookYaw;
    }
    // part of the head yaw bends the neck
    const ny = clamp(headYawW, -1.6, 1.6);
    yaw[3] += ny * 0.22; yaw[4] += ny * 0.3;
    this.solveSpine(pre);
    // ---- legs: targets in root space
    const bodyOff = V(0, 0, ZOFF);
    const J = this.J;
    const hipW = (s) => J.P[1].clone().add(V(s * BEAR.hip[0], BEAR.hip[1], 0).applyQuaternion(J.Qj[1])).add(bodyOff);
    const shW = (s) => { const f = this.frameAt(JZ[3]); return f.p.add(V(s * BEAR.shoulder[0], BEAR.shoulder[1], 0).applyQuaternion(f.q)).add(bodyOff); };
    const legs = {};
    for (const leg of ['LF', 'RF', 'LH', 'RH']) legs[leg] = this.legTarget(leg, t, { gait, G, ph, st, si, biped, quad, pl, plLeg: p.pawLift && p.pawLift.leg, hipW, shW });
    // keep grounded feet reachable: lower the whole body if needed
    let drop = 0;
    for (const leg of ['LF', 'RF', 'LH', 'RH']) {
      const T = legs[leg]; if (!T.ground) continue;
      const L = this.legSet[leg], root = L.front ? shW(L.sx) : hipW(L.sx);
      const maxR = (L.L.L1 + L.L.L2) * 0.985;
      const dh = Math.hypot(T.wrist.x - root.x, T.wrist.z - root.z), dy = root.y - T.wrist.y;
      if (dh < maxR) { const need = dy - Math.sqrt(maxR * maxR - dh * dh); if (need > drop) drop = need; }
    }
    drop = Math.min(drop, 0.25);
    this.drop = drop;
    this.body.position.set(0, -drop, ZOFF);
    // ---- deform torso
    this.deformer.apply(this.S, breath, drop + 0.012);
    // ---- tail
    const tf = this.frameAt(-1.27);
    this.tail.position.copy(tf.p).add(V(0, 0.0, 0).applyQuaternion(tf.q));
    this.tail.quaternion.copy(tf.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(2.6 - 0.4 * st, Math.PI + 0.4 * (p.tailWag || 0) * Math.sin(t * 9), 0)));
    // ---- head
    this.headPivot.position.copy(J.P[5]);
    this.headPivot.quaternion.setFromEuler(new THREE.Euler(-headPitchW, headYawW, headRollW, 'YXZ'));
    this.face(t);
    // ---- pinch / explicit paw targets need the head transform
    this.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const side of ['L', 'R']) {
      const leg = side + 'F', T = legs[leg], s = side === 'L' ? 1 : -1;
      const explicit = side === 'L' ? p.pawL : p.pawR;
      const pin = side === 'R' ? clamp(p.pinch || 0) : 0;
      if (pin > 0 || explicit) {
        const sh = shW(s); sh.y -= drop;
        let target, q;
        if (pin > 0 && !explicit) {
          // paw sole on the front of the nose, claws curled over the top
          const hq = new THREE.Quaternion(); this.head.getWorldQuaternion(hq);
          const rq = new THREE.Quaternion(); this.root.getWorldQuaternion(rq);
          const hqr = rq.clone().invert().multiply(hq);
          const nose = this.nosePos().applyMatrix4(toRoot);
          const hz = AZ.clone().applyQuaternion(hqr), hy = AY.clone().applyQuaternion(hqr), hx = AX.clone().applyQuaternion(hqr);
          const Y = hz.clone().multiplyScalar(1).addScaledVector(hx, s * 0.25).normalize();  // back of the paw faces away from the face
          q = frameYZ(Y, hy.clone().addScaledVector(hx, -s * 0.15));
          const sole = V(0, -BEAR.F.wristH, 0.07).applyQuaternion(q);
          target = nose.clone().addScaledVector(hz, 0.035).sub(sole);
        } else {
          const tw = v3(explicit).applyMatrix4(toRoot);
          const dir = tw.clone().sub(sh).normalize();
          q = frameYZ(dir.clone().negate(), AY.clone().addScaledVector(dir, 0.3));
          target = tw.clone().sub(V(0, -BEAR.F.wristH * 0.5, 0.06).applyQuaternion(q));
        }
        const k = explicit ? 1 : smooth(pin);
        T.wrist.lerp(target, k); T.q.slerp(q, k); T.ground = false; T.curl = Math.max(T.curl || 0, pin);
        T.pole = sh.clone().add(V(s * 0.9, -0.7, -0.1));
      }
    }
    // ---- IK + place legs
    for (const leg of ['LF', 'RF', 'LH', 'RH']) {
      const L = this.legSet[leg], T = legs[leg];
      const A = L.front ? shW(L.sx) : hipW(L.sx); A.y -= drop;
      const { J: Jn, E } = ik3(A, T.wrist, L.L.L1, L.L.L2, T.pole);
      const fwd = AZ.clone();
      L.up.position.copy(A); L.up.quaternion.copy(frameYZ(Jn.clone().sub(A), L.front ? fwd : fwd));
      L.lo.position.copy(Jn); L.lo.quaternion.copy(frameYZ(E.clone().sub(Jn), L.front ? fwd.clone().addScaledVector(AY, 0.3) : fwd.clone().negate()));
      L.paw.position.copy(E); L.paw.quaternion.copy(T.q);
      L.clawPivot.rotation.set(0.9 * clamp(T.curl || 0), 0, 0);
    }
    this.root.updateMatrixWorld(true);
  }

  // target for one leg: { wrist (root space), q (paw orientation, root space), pole, ground, curl }
  legTarget(leg, t, c) {
    const L = this.legSet[leg], front = L.front, s = L.sx, D = front ? BEAR.F : BEAR.H;
    const nx = s * D.x, nz = D.z + ZOFF;
    const res = { wrist: V(nx, D.wristH, nz), q: new THREE.Quaternion(), pole: V(), ground: true, curl: 0 };
    const yawIn = front ? -s * 0.12 : -s * 0.05;
    const flatQ = (pitchA) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchA, yawIn, 0, 'YXZ'));
    // ---- on all fours (gait)
    let gw = V(nx, D.wristH, nz), gq = flatQ(0), ground = true;
    if ((c.gait === 'walk' || c.gait === 'run') && GAITS[c.gait].td[leg] !== undefined) {
      const G = c.G, u = frac(c.ph - G.td[leg]), S = G.D * G.beta;
      const lift = front ? G.liftF : G.liftH, flip = front ? G.flipF : G.flipH;
      if (u < G.beta) {
        const sp = u / G.beta, dz = S / 2 - S * sp;
        const th = (front ? 0.75 : 0.55) * smooth((sp - 0.72) / 0.28);
        const toe = V(nx, 0, nz + dz + D.toeZ);
        const rel = V(0, D.wristH, -D.toeZ).applyAxisAngle(AX, th);
        gw = toe.add(rel); gq = flatQ(th);
      } else {
        const sw = (u - G.beta) / (1 - G.beta);
        const dz = -S / 2 + S * (1 - Math.cos(Math.PI * sw)) / 2;
        const th = lerp(front ? 0.75 : 0.55, -0.08, smooth(sw)) + flip * Math.sin(Math.PI * Math.pow(sw, 0.85)) * 0.6;
        const y = D.wristH + lift * Math.sin(Math.PI * Math.pow(sw, 0.8));
        gw = V(nx, y, nz + dz); gq = flatQ(th);
        ground = false;
      }
    } else if (c.gait === 'idle' || !GAITS[c.gait]) {
      // subtle weight shifts
      gw.z += 0.015 * noise1(t * 0.2, s * 7 + (front ? 1 : 3));
    }
    // mid-step freeze (one front paw lifted)
    if (front && c.pl > 0 && c.plLeg && c.plLeg[1] === leg[0]) {
      const k = smooth(c.pl);
      gw.lerp(V(nx * 0.95, D.wristH + 0.36, nz + 0.16), k); gq.slerp(flatQ(1.15), k); if (k > 0.05) ground = false;
    }
    const lim = (v) => { // keep the paw above the ground
      const pts = [V(0, -D.wristH, -D.heelZ), V(0, -D.wristH, D.toeZ), V(0, -D.wristH + 0.02, D.clawZ)];
      let low = Infinity; for (const q of pts) low = Math.min(low, q.applyQuaternion(res.q).y);
      if (v.y + low < 0.002) v.y = 0.002 - low;
    };
    res.wrist.copy(gw); res.q.copy(gq); res.ground = ground;
    res.pole = front ? c.hipW(0).clone() : V(0, 0, 0);
    const sh = front ? c.shW(s) : c.hipW(s);
    if (front) res.pole = sh.clone().add(V(0, -0.4, -1.2)); else res.pole = sh.clone().add(V(0, -0.3, 1.2));
    // ---- front legs off the ground: standing / sitting / biped poses
    if (front) {
      const up = clamp(c.st + c.biped), sitk = c.si;
      if (up > 0 || sitk > 0) {
        // raised paws (standing tall): in front of the chest, a bit above the shoulders, claws up, pads forward
        const rw = sh.clone().add(V(s * 0.16, 0.24 + 0.04 * Math.sin(t * 1.7 + s), 0.52));
        const rq = frameYZ(V(0, -0.35, -1), V(s * 0.1, 1, 0.25));
        // sitting rest: paws resting on the belly / thighs
        const sw = V(s * 0.27, 0.66, c.hipW(s).z + 0.62);
        const sq = frameYZ(V(0, 1, 0.15), V(-s * 0.15, 0.1, 1));
        let w = gw.clone(), q = gq.clone();
        if (up > 0) { const k = smooth(clamp(up * 1.4)); w.lerp(rw, k); q.slerp(rq, k); }
        if (sitk > 0) { const k = smooth(clamp(sitk * 1.3)); w.lerp(sw, k); q.slerp(sq, k); }
        if (c.biped) {
          // biped run: arms pump at the chest, or flail high above the head
          const fl = clamp(this.p.flail || 0);
          const ph2 = TAU * (c.ph * 2) + (s > 0 ? 0 : Math.PI);
          const pump = sh.clone().add(V(s * 0.12, 0.05 + 0.12 * Math.sin(TAU * c.ph + (s > 0 ? 0 : Math.PI)), 0.45));
          const tf = t * 7.5 + (s > 0 ? 0 : 2.1);
          const flail = sh.clone().add(V(s * (0.5 + 0.18 * Math.sin(tf)), 0.72 + 0.1 * Math.cos(tf * 1.3), 0.12 + 0.22 * Math.sin(ph2)));
          w = pump.lerp(flail, fl);
          q = frameYZ(V(-s * 0.2 * fl, -0.4 + fl * 0.3, -1 + fl * 0.6), V(s * 0.3 * fl, 1, 0.3));
        }
        res.wrist.copy(w); res.q.copy(q); res.ground = false;
        res.pole = sh.clone().add(V(s * 0.6, -0.8, -0.35));
      }
    } else {
      // hind legs: standing / biped run / sitting
      const hip = sh;
      if (c.biped) {
        const G = GAITS.biped_run, u = frac(c.ph - G.td[leg]), S = G.D * G.beta;
        const bx = s * 0.24, bz = hip.z + 0.06;
        if (u < G.beta) {
          const sp = u / G.beta, dz = S / 2 - S * sp, th = 0.6 * smooth((sp - 0.7) / 0.3);
          const toe = V(bx, 0, bz + dz + D.toeZ);
          res.wrist.copy(toe.add(V(0, D.wristH, -D.toeZ).applyAxisAngle(AX, th))); res.q.copy(flatQ(th)); res.ground = true;
        } else {
          const sw = (u - G.beta) / (1 - G.beta);
          const dz = -S / 2 + S * (1 - Math.cos(Math.PI * sw)) / 2 - 0.25 * Math.sin(Math.PI * sw) * (1 - sw);
          res.wrist.set(bx, D.wristH + G.liftH * Math.sin(Math.PI * Math.pow(sw, 0.75)), bz + dz); res.q.copy(flatQ(lerp(0.6, -0.1, sw) + 0.5 * Math.sin(Math.PI * sw)));
          res.ground = false;
        }
        res.pole = hip.clone().add(V(s * 0.1, -0.2, 1.2));
      } else {
        // standing: feet under the hips (keep them planted near the rest spot)
        if (c.st > 0) { const k = c.st; res.wrist.lerp(V(s * 0.27, D.wristH, lerp(nz, hip.z + 0.1, 0.6)), k); res.pole = hip.clone().add(V(s * 0.1, -0.1, 1.2)); }
        if (c.si > 0) {
          const k = c.si;
          const sw = V(s * 0.4, D.wristH + 0.02, hip.z + 0.72);
          res.wrist.lerp(sw, k); res.q.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, s * 0.35, 0, 'YXZ')), k);
          res.pole = hip.clone().add(V(s * 0.8, 0.9, 1.0));
        }
      }
    }
    if (res.ground || c.si > 0 || c.st > 0) lim(res.wrist);
    return res;
  }

  // ---------------------------------------------------------------- face
  face(t) {
    const p = this.p, re = BEAR.re;
    let eyes = p.eyes || 'open';
    if (eyes === 'open' && p.blink !== false) { const per = 3.7, b = ((t + 1.3) % per) / per; if (b > 0.972) eyes = 'closed'; }
    for (const side of ['L', 'R']) {
      const E = this.eyes[side];
      const open = eyes === 'open' || eyes === 'wide';
      E.ball.visible = open; E.hl.visible = open;
      E.ball.scale.setScalar(eyes === 'wide' ? 1.18 : 1);
      E.hl.position.copy(V(-0.38, 0.42, 0.82).normalize().multiplyScalar(re * (eyes === 'wide' ? 1.18 : 1))).add(V(0, 0, -0.011));
      E.sclera.visible = eyes === 'wide';
      E.lid.visible = !open;
      E.lid.scale.set(1, eyes === 'squeeze' ? 0.82 : 1, eyes === 'squeeze' ? 0.85 : 1);
      E.closed.visible = eyes === 'closed'; E.happy.visible = eyes === 'happy'; E.squeeze.visible = eyes === 'squeeze';
      const tk = clamp(p.tears || 0);
      E.pool.visible = tk > 0.01; E.poolHl.visible = tk > 0.35;
      if (tk > 0.01) {
        const k = smooth(tk);
        E.pool.scale.set(0.55 + 0.45 * k, 0.12 + 0.88 * k, 0.5 + 0.5 * k);
        E.pool.position.set(0, -re * 1.05 * (1 - k), -0.008 + 0.006 * k);
        E.poolHl.scale.setScalar(k);
      }
    }
    // brows
    const B = BROWS[p.brows] || BROWS.neutral;
    for (const b of this.brows) {
      b.pivot.position.copy(b.base).add(V(0, B[1], 0));
      b.bm.rotation.set(0, 0, -b.s * B[0]);
      b.bm.position.set(-b.s * 0.0, eyes === 'squeeze' ? -0.012 : 0, 0);
    }
    // jaw
    let ja = JAW_OPEN[p.mouth] ?? 0;
    if (p.mouth === 'tremble') ja += 0.03 * Math.sin(t * 47) + 0.015 * Math.sin(t * 29);
    if (p.mouth === 'wail') ja += 0.04 * Math.sin(t * 13);
    this.jaw.rotation.set(ja, 0, p.mouth === 'tremble' ? 0.02 * Math.sin(t * 37) : 0);
    this.mouthIn.rotation.set(ja * 0.5, 0, 0);
    this.cavity.scale.set(1, 1 + Math.max(0, ja) * 2.4, 1);
    // nose sniff: flare + twitch up
    const sn = clamp(p.sniff || 0);
    this.noseGrp.position.set(0, -0.032 + 0.012 * sn, 0.565 + 0.004 * sn);
    this.noseGrp.rotation.set(-0.12 * sn, 0, 0);
    this.noseGrp.scale.set(1 + 0.06 * sn - 0.25 * clamp(p.pinch || 0), 1 + 0.04 * sn, 1);
    for (const [i, n] of this.nostrils.entries()) {
      const s = i === 0 ? 1 : -1;
      n.scale.set(1 + 0.6 * sn, 1 + 1.05 * sn, 1 + 0.3 * sn);
      n.position.copy(n.userData.base).add(V(s * 0.006 * sn, 0.002 * sn, 0));
    }
    // cheeks: puffed / sucked in
    const pu = clamp(p.cheeksPuff || 0), ci = clamp(p.cheeksIn || 0);
    for (const [i, c] of this.cheeks.entries()) {
      const s = i === 0 ? 1 : -1;
      c.scale.set(1 + 0.55 * pu - 0.45 * ci, 1 + 0.35 * pu - 0.15 * ci, 1 + 0.3 * pu - 0.2 * ci);
      c.position.copy(c.userData.base).add(V(s * (0.045 * pu - 0.05 * ci), -0.01 * pu, 0.01 * pu - 0.03 * ci));
    }
    this.muzzle.scale.set(1 - 0.1 * ci + 0.04 * pu, 1, 1);
    // ears: perked (1) .. pinned back (0), small twitches
    const ek = clamp(p.ears ?? 0.5);
    for (const e of this.ears) {
      const s = e.userData.s;
      e.rotation.set(lerp(0.55, -0.22, ek) + 0.05 * noise1(t * 1.3, s * 3 + 1), s * lerp(0.45, 0.12, ek), -s * lerp(0.62, 0.3, ek) + 0.04 * noise1(t * 0.9, s * 5));
    }
    // sick green tint on the face
    const gk = clamp(p.green || 0);
    const FM = this.FM;
    FM.head.color.setRGB(lerp(1, 0.62, gk), lerp(1, 1.12, gk), lerp(1, 0.42, gk));
    FM.muzzle.color.setRGB(lerp(1, 0.6, gk), lerp(1, 1.1, gk), lerp(1, 0.38, gk));
    FM.earIn.color.setRGB(lerp(1, 0.6, gk), lerp(1, 1.1, gk), lerp(1, 0.4, gk));
    FM.head.emissive.setRGB(0.02 * gk, 0.07 * gk, 0.0); FM.muzzle.emissive.setRGB(0.03 * gk, 0.09 * gk, 0.0);
  }
}
