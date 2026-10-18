// Jesus's body: skinned robe (body + sleeves + collar), skinned red sash (diagonal loop over the right
// shoulder to the left hip + hanging tail + knot), rigid hands (finger curl variants), feet with sandals,
// neck and lower legs. All geometry is modelled in the rig's REST pose (standing, arms hanging, facing +Z).
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise1, DEG } from '../core/util.js';
import { BI, makeTable, gridGeometry, setSkin, setAttr, setColor, merge, mirrorX, superEllipsoid, loftTube, rigidSkin } from './jesus_geo.js';

export const JESUS_DIMS = {
  spine: 0.16, chest: 0.29, neck: 0.105, shoulderW: 0.37, shoulderY: 0.26,
  upperArm: 0.30, foreArm: 0.265, hipW: 0.19, thigh: 0.46, shin: 0.44, ankle: 0.115,
};
export const ANKLE_H = 0.075; // ankle joint height above the ground when standing (rig.standHipY - 0.04 - thigh - shin)

const D = JESUS_DIMS;
const HIP_Y = D.thigh + D.shin + D.ankle;            // 1.015
const CHEST_Y = HIP_Y + 0.02 + D.spine;              // 1.195
const SHOULDER = { x: D.shoulderW / 2, y: CHEST_Y + D.shoulderY }; // (0.185, 1.455)
const HEM_Y = 0.118;
const COLLAR_Y = 1.532;

// ---------------------------------------------------------------------------------------------
// Robe surface (rest pose, root-local)
// ---------------------------------------------------------------------------------------------
const PROFILE = [ // y, half width, front, back, superellipse n
  [HEM_Y, 0.262, 0.200, 0.192, 2.0],
  [0.30, 0.245, 0.182, 0.176, 2.0],
  [0.52, 0.226, 0.160, 0.160, 2.0],
  [0.74, 0.207, 0.134, 0.153, 2.05],
  [0.90, 0.196, 0.120, 0.150, 2.1],
  [0.99, 0.183, 0.115, 0.139, 2.15],
  [1.06, 0.168, 0.114, 0.124, 2.2],
  [1.15, 0.162, 0.121, 0.116, 2.3],
  [1.27, 0.164, 0.132, 0.116, 2.5],
  [1.37, 0.170, 0.125, 0.113, 2.6],
  [1.44, 0.176, 0.108, 0.106, 2.6],
  [1.48, 0.160, 0.092, 0.094, 2.4],
  [1.505, 0.125, 0.080, 0.084, 2.2],
  [1.522, 0.090, 0.070, 0.075, 2.0],
  [COLLAR_Y, 0.068, 0.062, 0.067, 2.0],
];
const PA = makeTable(PROFILE.map((r) => [r[0], r[1]]));
const PF = makeTable(PROFILE.map((r) => [r[0], r[2]]));
const PB = makeTable(PROFILE.map((r) => [r[0], r[3]]));
const PN = makeTable(PROFILE.map((r) => [r[0], r[4]]));
const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function foldAmt(y) {
  return 0.052 * smoothstep(1.0, 0.18, y) + 0.006 * smoothstep(1.0, 1.25, y) * smoothstep(1.45, 1.3, y);
}
function folds(th, y) {
  const a = 0.55 * Math.sin(10 * th + 0.4 + 0.5 * Math.sin(y * 3.1)) + 0.3 * Math.sin(17 * th + 1.3 - y * 2) + 0.15 * Math.sin(27 * th + y * 4);
  // fewer folds straight down the front of the torso
  return a;
}

// Robe surface point at angle th (0 = front) and height y. folds: include cloth folds.
export function robeSurf(th, y, withFolds = true) {
  const s = Math.sin(th), c = Math.cos(th);
  const e = 2 / PN(y);
  let x = PA(y) * sp(s, e);
  let z = c >= 0 ? PF(y) * Math.pow(c, e) : -PB(y) * Math.pow(-c, e);
  if (withFolds) {
    const k = 1 + foldAmt(y) * folds(th, y);
    x *= k; z *= k;
  }
  return new THREE.Vector3(x, y, z);
}
function robeNormal(th, y) {
  const e = 1e-3;
  const a = robeSurf(th + e, y, false).sub(robeSurf(th - e, y, false));
  const b = robeSurf(th, Math.min(COLLAR_Y, y + e), false).sub(robeSurf(th, y - e, false));
  return new THREE.Vector3().crossVectors(a, b).normalize();
}

// Skin weights for robe-like cloth at a rest-pose point.
export function bodyWeights(x, y, z) {
  const w = {};
  const add = (b, v) => { if (v > 1e-4) w[BI[b]] = (w[BI[b]] || 0) + v; };
  const legW = smoothstep(0.985, 0.80, y);
  const up = 1 - legW;
  const sp1 = smoothstep(0.99, 1.10, y), ch = smoothstep(1.15, 1.30, y);
  let chestW = up * sp1 * ch;
  add('hips', up * (1 - sp1));
  add('spine', up * sp1 * (1 - ch));
  const shW = smoothstep(0.10, 0.17, Math.abs(x)) * smoothstep(1.36, 1.45, y) * 0.5;
  add(x > 0 ? 'shoulderL' : 'shoulderR', chestW * shW);
  add('chest', chestW * (1 - shW));
  if (legW > 0) {
    const l = smoothstep(-0.07, 0.07, x);
    const kn = smoothstep(0.60, 0.43, y);
    add('thighL', legW * (1 - kn) * l); add('thighR', legW * (1 - kn) * (1 - l));
    add('shinL', legW * kn * l); add('shinR', legW * kn * (1 - l));
  }
  return w;
}

function buildRobeBody() {
  const NU = 72;
  const ys = [];
  const NR = 74;
  for (let j = 0; j <= NR; j++) ys.push(lerp(HEM_Y, COLLAR_Y, j / NR));
  // rows: 0 = inner hem lip top, 1 = inner hem lip bottom, 2.. = outer surface from hem to collar
  const rows = [{ y: HEM_Y + 0.045, k: 0.955, inner: true }, { y: HEM_Y + 0.004, k: 0.978, inner: true }, ...ys.map((y) => ({ y, k: 1 }))];
  const g = gridGeometry(NU, rows.length - 1, (u, v, i, j) => {
    const th = u * Math.PI * 2;
    const r = rows[j];
    let y = r.y;
    const hemWob = 0.010 * Math.sin(th * 7 + 1.1) + 0.005 * Math.sin(th * 13 + 0.3);
    const atHem = j <= 2 ? 1 : smoothstep(HEM_Y + 0.06, HEM_Y, y);
    y += hemWob * atHem;
    const p = robeSurf(th, Math.max(HEM_Y, r.y), true);
    p.x *= r.k; p.z *= r.k; p.y = y;
    return [p.x, p.y, p.z];
  }, { uv: (u, v, p) => [u * 4, p[1] * 2.6] });
  setAttr(g, 'aHem', (x, y) => smoothstep(0.78, HEM_Y, y));
  return g;
}

// Sleeve: tube along the hanging arm from a dome over the shoulder to a bell cuff. side: 1 = left (+X).
function buildSleeve(side) {
  const L = [ // d (down from shoulder joint), rx, rz
    [-0.046, 0.0, 0.0], [-0.044, 0.022, 0.021], [-0.038, 0.040, 0.038], [-0.028, 0.054, 0.051], [-0.014, 0.063, 0.060],
    [0.0, 0.067, 0.064], [0.06, 0.066, 0.062], [0.14, 0.063, 0.059], [0.22, 0.060, 0.057], [0.28, 0.058, 0.056],
    [0.33, 0.058, 0.056], [0.40, 0.059, 0.058], [0.46, 0.061, 0.060], [0.51, 0.065, 0.064], [0.55, 0.072, 0.071],
    [0.58, 0.080, 0.078], [0.598, 0.085, 0.083],
    // lip turned inside
    [0.594, 0.078, 0.076, true], [0.565, 0.070, 0.068, true],
  ];
  const nu = 28;
  const g = gridGeometry(nu, L.length - 1, (u, v, i, j) => {
    const a = u * Math.PI * 2;
    const [d, rx, rz] = L[j];
    const fold = 1 + (0.06 * smoothstep(0.42, 0.598, d) * Math.sin(a * 6 + 0.7) + 0.035 * Math.exp(-(((d - 0.30) / 0.05) ** 2)) * Math.sin(a * 5 + 2));
    const x = side * SHOULDER.x + Math.sin(a) * rx * fold;
    const z = Math.cos(a) * rz * fold + 0.004;
    const wob = d > 0.56 ? 0.008 * Math.sin(a * 5 + 0.5) : 0;
    return [x, SHOULDER.y - d - wob, z];
  }, { flip: false, uv: (u, v) => [u * 1.6, v * 1.7], poleNormals: [[0, [0, 1, 0]]] });
  // winding: u goes from +Z toward +X (outward for left side); rows go downward -> flip for consistency
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.computeVertexNormals();
  const s = side > 0 ? 'L' : 'R';
  setSkin(g, (x, y) => {
    const d = SHOULDER.y - y;
    const w = {};
    const dome = smoothstep(0.03, -0.02, d);
    const fa = smoothstep(0.25, 0.36, d);
    w[BI['upperArm' + s]] = (1 - fa) * (1 - dome * 0.45);
    w[BI['shoulder' + s]] = dome * 0.3;
    w[BI.chest] = dome * 0.15;
    w[BI['foreArm' + s]] = fa;
    return w;
  });
  setAttr(g, 'aHem', () => 0);
  return g;
}

function buildCollar() {
  const g = new THREE.TorusGeometry(1, 0.12, 6, 44);
  g.rotateX(Math.PI / 2);
  g.scale(0.069, 0.065, 0.066);
  g.translate(0, COLLAR_Y - 0.002, 0.0);
  setSkin(g, () => ({ [BI.chest]: 1 }));
  setAttr(g, 'aHem', () => 0);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Sash: a band on the robe along the plane y = 1.34 - 1.9 x (right shoulder -> left hip), plus tail + knot.
// ---------------------------------------------------------------------------------------------
const SASH_W = 0.112;
function loopY(th) {
  let a = 0.9, b = COLLAR_Y;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    const x = robeSurf(th, m, false).x;
    if (m - 1.34 + 1.9 * x < 0) a = m; else b = m;
  }
  return (a + b) / 2;
}

function buildSash() {
  const nu = 160, nt = 6;
  const OFF = 0.0095;
  const yc = [], P = [];
  for (let i = 0; i <= nu; i++) {
    const th = (i / nu) * Math.PI * 2;
    yc.push(loopY(th));
    P.push(robeSurf(th, yc[i], false));
  }
  // half-extent in y for each th so the band has ~constant perpendicular width
  const ext = [];
  for (let i = 0; i <= nu; i++) {
    const a = P[(i + nu - 1) % nu], b = P[(i + 1) % nu];
    const horiz = Math.hypot(b.x - a.x, b.z - a.z), dy = b.y - a.y;
    const slope = Math.abs(dy) / Math.max(1e-6, horiz);
    const target = (SASH_W / 2) * Math.sqrt(1 + slope * slope);
    const th = (i / nu) * Math.PI * 2;
    const find = (dir) => {
      let y = yc[i], dist = 0;
      const p0 = P[i];
      while (dist < target) {
        const ny = y + dir * 0.0015;
        if (ny > COLLAR_Y - 0.003 || ny < 0.5) break;
        y = ny;
        dist = robeSurf(th, y, false).distanceTo(p0);
      }
      return y;
    };
    ext.push([find(-1), find(1)]);
  }
  const g = gridGeometry(nu, nt, (u, v, i, j) => {
    const th = u * Math.PI * 2;
    const [lo, hi] = ext[i];
    const y = lerp(lo, hi, v);
    const p = robeSurf(th, y, false);
    const n = robeNormal(th, y);
    // soft cloth: edges lift a little, small diagonal wrinkles
    const edge = Math.abs(v - 0.5) * 2;
    const wr = 0.0022 * Math.sin(u * Math.PI * 2 * 22 + v * 3);
    p.addScaledVector(n, OFF + 0.002 * edge * edge + wr);
    return [p.x, p.y, p.z];
  }, { uv: (u, v) => [v, u * 18] });
  return g;
}

function buildSashTail() {
  const nu = 6, nv = 22;
  const g = gridGeometry(nu, nv, (u, v) => {
    const y = lerp(1.02, 0.47, v) + (v > 0.97 ? 0.012 * Math.abs(u - 0.5) * 2 : 0);
    const thc = lerp(0.92, 1.02, v);
    const halfW = lerp(0.048, 0.064, v) / Math.max(0.12, Math.hypot(robeSurf(thc, y, false).x, robeSurf(thc, y, false).z));
    const th = thc + (u - 0.5) * 2 * halfW;
    const p = robeSurf(th, y, true);
    const n = robeNormal(th, y);
    const hang = 0.012 + 0.02 * v + 0.004 * Math.sin(u * Math.PI * 3 + v * 9);
    p.addScaledVector(n, hang);
    return [p.x, p.y, p.z];
  }, { wrapU: false, uv: (u, v) => [u, v * 4] });
  return g;
}

function buildSashKnot() {
  const th = 0.98, y = 1.0;
  const p = robeSurf(th, y, false), n = robeNormal(th, y);
  const g = superEllipsoid([0.034, 0.038, 0.022], [0, 0, 0], { e1: 0.85, e2: 0.9, wSeg: 16, hSeg: 10 });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.12 * Math.sin(Math.atan2(x, yy) * 5 + z * 40);
    pos.setXYZ(i, x * k, yy * k, z);
  }
  g.computeVertexNormals();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  g.applyQuaternion(q);
  g.translate(p.x + n.x * 0.016, p.y + n.y * 0.016, p.z + n.z * 0.016);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Hands (left-hand model; right is mirrored). Hand-bone space: wrist at origin, fingers along -Y,
// palm faces +Z (anatomical position), thumb on +X for the left hand.
// ---------------------------------------------------------------------------------------------
const FINGERS = [ // x, base y, lengths, radius, spread deg, curl scale
  { x: 0.0262, y: -0.096, L: [0.040, 0.025, 0.021], r: 0.0088, spread: 5, k: 0.85 },
  { x: 0.0088, y: -0.100, L: [0.044, 0.028, 0.022], r: 0.0091, spread: 1, k: 0.95 },
  { x: -0.0088, y: -0.098, L: [0.041, 0.026, 0.021], r: 0.0086, spread: -3, k: 1.05 },
  { x: -0.0255, y: -0.091, L: [0.032, 0.021, 0.018], r: 0.0076, spread: -8, k: 1.2 },
];
const SKIN_COL = '#cf9168';
const NAIL_COL = '#e2b39a';

function capsuleSeg(r0, r1, L) {
  // tapered capsule from y=0 to y=-L
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ p: new THREE.Vector3(0, -L * t, 0), rx: lerp(r0, r1, t), rz: lerp(r0, r1, t) * 0.92 });
  }
  const g = loftTube(pts, 10, { capStart: false, capEnd: false });
  const s0 = new THREE.SphereGeometry(r0, 10, 6); const s1 = new THREE.SphereGeometry(r1, 10, 6);
  s0.scale(1, 1, 0.92); s1.scale(1, 1, 0.92); s1.translate(0, -L, 0);
  return merge([g, s0, s1]);
}

function buildHandGeo(curl, side) {
  const parts = [];
  const palm = superEllipsoid([0.0405, 0.050, 0.0142], [0, -0.052, 0.0005], { e1: 0.5, e2: 0.62, wSeg: 18, hSeg: 12 });
  // thicker at the wrist, thinner toward the knuckles
  const pp = palm.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const y = pp.getY(i);
    const t = smoothstep(-0.005, -0.1, y);
    pp.setZ(i, pp.getZ(i) * lerp(1.1, 0.85, t));
    pp.setX(i, pp.getX(i) * lerp(0.82, 1.0, smoothstep(0.0, -0.05, y)));
  }
  palm.computeVertexNormals();
  parts.push(setColor(palm, SKIN_COL));
  const thenar = superEllipsoid([0.017, 0.027, 0.012], [0.022, -0.038, 0.008], { wSeg: 12, hSeg: 8 });
  parts.push(setColor(thenar, SKIN_COL));
  const wrist = loftTube([{ p: new THREE.Vector3(0, 0.03, 0), rx: 0.030, rz: 0.021 }, { p: new THREE.Vector3(0, -0.02, 0), rx: 0.034, rz: 0.019 }], 12, { capStart: true, capEnd: false });
  parts.push(setColor(wrist, SKIN_COL));
  const relaxed = [32, 30, 20];
  for (const f of FINGERS) {
    let m = new THREE.Matrix4().makeTranslation(f.x, f.y, 0.0);
    m.multiply(new THREE.Matrix4().makeRotationZ(f.spread * DEG * (1 - curl * 0.5)));
    let r = f.r;
    for (let s = 0; s < 3; s++) {
      const ang = -relaxed[s] * curl * f.k * (s === 0 ? 1.15 : 1) * DEG * (s === 0 ? 1 : 1.25);
      m.multiply(new THREE.Matrix4().makeRotationX(ang));
      const r1 = r * 0.9;
      const seg = setColor(capsuleSeg(r, r1, f.L[s]), SKIN_COL);
      seg.applyMatrix4(m);
      parts.push(seg);
      if (s === 2) {
        const nail = superEllipsoid([r1 * 0.75, f.L[2] * 0.35, r1 * 0.35], [0, -f.L[2] * 0.62, -r1 * 0.72], { wSeg: 8, hSeg: 6 });
        setColor(nail, NAIL_COL);
        nail.applyMatrix4(m);
        parts.push(nail);
      }
      m.multiply(new THREE.Matrix4().makeTranslation(0, -f.L[s], 0));
      r = r1;
    }
  }
  // thumb
  {
    let m = new THREE.Matrix4().makeTranslation(0.031, -0.024, 0.010);
    m.multiply(new THREE.Matrix4().makeRotationZ(40 * DEG));
    m.multiply(new THREE.Matrix4().makeRotationY(-35 * DEG));
    m.multiply(new THREE.Matrix4().makeRotationX(-18 * DEG));
    const Ls = [0.034, 0.030, 0.026];
    let r = 0.0112;
    for (let s = 0; s < 3; s++) {
      const ang = s === 0 ? 0 : -(14 + 20 * curl) * DEG;
      m.multiply(new THREE.Matrix4().makeRotationX(ang));
      if (s === 1) m.multiply(new THREE.Matrix4().makeRotationZ(-(8 + 18 * curl) * DEG));
      const r1 = r * 0.9;
      const seg = setColor(capsuleSeg(r, r1, Ls[s]), SKIN_COL);
      seg.applyMatrix4(m);
      parts.push(seg);
      if (s === 2) {
        const nail = superEllipsoid([r1 * 0.75, Ls[2] * 0.33, r1 * 0.35], [0, -Ls[2] * 0.62, -r1 * 0.72], { wSeg: 8, hSeg: 6 });
        setColor(nail, NAIL_COL);
        nail.applyMatrix4(m);
        parts.push(nail);
      }
      m.multiply(new THREE.Matrix4().makeTranslation(0, -Ls[s], 0));
      r = r1;
    }
  }
  let g = merge(parts);
  if (side < 0) g = mirrorX(g);
  return g;
}

const handCache = new Map();
export function handGeometry(curl, side) {
  const q = Math.round(clamp(curl, 0, 1) * 20) / 20;
  const key = `${side}:${q}`;
  if (!handCache.has(key)) handCache.set(key, buildHandGeo(q, side));
  return handCache.get(key);
}

// ---------------------------------------------------------------------------------------------
// Feet + sandals (left foot; right mirrored). Foot-bone space: ankle joint at origin, sole at y = -ANKLE_H.
// ---------------------------------------------------------------------------------------------
function buildFootGeo() {
  const zs = [-0.066, -0.06, -0.045, -0.02, 0.01, 0.045, 0.08, 0.11, 0.132, 0.146, 0.152];
  const Wt = makeTable([[-0.066, 0.012], [-0.06, 0.022], [-0.045, 0.029], [-0.02, 0.032], [0.01, 0.034], [0.045, 0.038], [0.08, 0.042], [0.11, 0.045], [0.132, 0.043], [0.146, 0.036], [0.152, 0.02]]);
  const Yt = makeTable([[-0.066, -0.044], [-0.06, -0.034], [-0.045, -0.018], [-0.02, -0.004], [0.01, -0.006], [0.045, -0.022], [0.08, -0.034], [0.11, -0.043], [0.132, -0.049], [0.146, -0.053], [0.152, -0.056]]);
  const yb = -0.0628;
  const nu = 18;
  const body = gridGeometry(nu, zs.length - 1, (u, v, i, j) => {
    const z = zs[j];
    const a = u * Math.PI * 2;
    const w = Wt(z), yt = Yt(z);
    const mid = (yt + yb) / 2, h = (yt - yb) / 2;
    const c = Math.cos(a), s = Math.sin(a);
    const x = w * sp(s, 0.8) * (c < 0 ? 1.0 : 0.92);
    const y = mid + h * sp(c, c > 0 ? 0.9 : 0.4);
    // big-toe side (inner, -X for the left foot) is a little fuller toward the front
    return [x - 0.004 * smoothstep(0.05, 0.13, z), y, z];
  }, { flip: true });
  // caps at both ends: approximate with spheres
  const heel = superEllipsoid([0.022, 0.02, 0.018], [0, -0.048, -0.055], { wSeg: 12, hSeg: 8 });
  const ankle = superEllipsoid([0.032, 0.035, 0.034], [0, -0.012, -0.012], { wSeg: 14, hSeg: 10 });
  const parts = [body, heel, ankle];
  // toes (big toe at -X for the left foot)
  const toes = [[-0.026, 0.142, 0.0118, 0.030], [-0.009, 0.146, 0.0088, 0.024], [0.0065, 0.142, 0.0082, 0.021], [0.020, 0.135, 0.0076, 0.018], [0.0325, 0.125, 0.007, 0.015]];
  for (const [x, z, r, L] of toes) {
    const t = capsuleSeg(r, r * 0.92, L);
    t.rotateX(-Math.PI / 2 + 0.12);
    t.translate(x, -0.0628 + r * 0.95, z - 0.012);
    parts.push(t);
  }
  const skinG = merge(parts.map((p) => setColor(p, SKIN_COL)));
  // sandal
  const sole = superEllipsoid([0.051, 0.0062, 0.118], [-0.003, -0.0688, 0.046], { e1: 0.25, e2: 0.5, wSeg: 24, hSeg: 6 });
  const sp2 = sole.attributes.position;
  for (let i = 0; i < sp2.count; i++) {
    const z = sp2.getZ(i);
    sp2.setX(i, sp2.getX(i) * lerp(0.78, 1.0, smoothstep(-0.07, 0.06, z)) - 0.004 * smoothstep(0.06, 0.15, z));
  }
  sole.computeVertexNormals();
  const strap = (z, halfW, top, width, tilt = 0) => {
    const t = new THREE.TorusGeometry(1, 0.09, 5, 18, Math.PI);
    t.scale(halfW, top, width / 0.18);
    t.rotateX(tilt);
    t.translate(0, -0.064, z);
    return t;
  };
  const straps = [
    strap(0.112, 0.047, 0.025, 0.013, 0.15),
    strap(0.045, 0.040, 0.046, 0.012, -0.5),
    strap(0.06, 0.042, 0.040, 0.010, 0.55),
  ];
  // ankle strap (horizontal ring)
  const ring = new THREE.TorusGeometry(1, 0.10, 5, 22);
  ring.rotateX(Math.PI / 2);
  ring.scale(0.0345, 0.065, 0.036);
  ring.translate(0, -0.004, -0.012);
  // heel strap from sole to ankle ring
  const heelStrap = loftTube([
    { p: new THREE.Vector3(0, -0.062, -0.068), rx: 0.006, rz: 0.002, side: new THREE.Vector3(1, 0, 0) },
    { p: new THREE.Vector3(0, -0.035, -0.052), rx: 0.006, rz: 0.002, side: new THREE.Vector3(1, 0, 0) },
    { p: new THREE.Vector3(0, -0.006, -0.046), rx: 0.006, rz: 0.002, side: new THREE.Vector3(1, 0, 0) },
  ], 6);
  const leatherG = merge([sole, ...straps, ring, heelStrap].map((p) => setColor(p, '#ffffff')));
  return { skinG, leatherG };
}

export function footGeometries(side) {
  const { skinG, leatherG } = buildFootGeo();
  if (side > 0) return { skinG, leatherG };
  return { skinG: mirrorX(skinG), leatherG: mirrorX(leatherG) };
}

// Lower leg (visible as the ankle under the hem): shin-bone space, ankle at y = -shin.
export function shinGeometry() {
  const L = D.shin;
  const pts = [
    { p: new THREE.Vector3(0, -L + 0.005, -0.008), rx: 0.031, rz: 0.030 },
    { p: new THREE.Vector3(0, -L + 0.06, -0.006), rx: 0.034, rz: 0.034 },
    { p: new THREE.Vector3(0, -L + 0.2, 0), rx: 0.042, rz: 0.044 },
    { p: new THREE.Vector3(0, -0.04, 0), rx: 0.05, rz: 0.05 },
  ];
  return setColor(loftTube(pts, 14), SKIN_COL);
}

export function neckGeometry() {
  const pts = [
    { p: new THREE.Vector3(0, -0.05, -0.004), rx: 0.054, rz: 0.050 },
    { p: new THREE.Vector3(0, 0.02, 0.0), rx: 0.050, rz: 0.048 },
    { p: new THREE.Vector3(0, 0.08, 0.004), rx: 0.049, rz: 0.048 },
    { p: new THREE.Vector3(0, 0.13, 0.006), rx: 0.046, rz: 0.044 },
  ];
  return setColor(loftTube(pts, 18), SKIN_COL);
}

// ---------------------------------------------------------------------------------------------
export function buildRobe(T) {
  const robeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.robe, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const sway = { value: new THREE.Vector3() }, ripple = { value: new THREE.Vector2() };
  robeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSway = sway; sh.uniforms.uRipple = ripple;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHem;\nuniform vec3 uSway;\nuniform vec2 uRipple;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hw = aHem * aHem;
        transformed += uSway * hw;
        float ang = atan(transformed.x, transformed.z);
        vec2 rd = normalize(transformed.xz + vec2(1e-5));
        transformed.xz += rd * sin(ang * 5.0 + uRipple.x) * uRipple.y * hw;`);
  };
  robeMat.customProgramCacheKey = () => 'jesusRobe';

  const body = buildRobeBody();
  setSkin(body, bodyWeights);
  const geo = merge([body, buildSleeve(1), buildSleeve(-1), buildCollar()]);
  const robe = new THREE.SkinnedMesh(geo, robeMat);
  robe.name = 'robe';

  const sashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.sash, roughness: 0.8, side: THREE.DoubleSide });
  const sashParts = [buildSash(), buildSashTail(), buildSashKnot()];
  for (const g of sashParts) { setSkin(g, bodyWeights); }
  const sash = new THREE.SkinnedMesh(merge(sashParts), sashMat);
  sash.name = 'sash';
  return { robe, sash, robeMat, sashMat, sway, ripple };
}
