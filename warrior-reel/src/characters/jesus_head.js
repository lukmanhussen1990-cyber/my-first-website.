// Jesus's head: sculpted skin (loft of superelliptic slices + features), nose, eyes with lids,
// brows, full beard + moustache, long wavy hair with a centre part, and a talking mouth
// (jaw deformation on the CPU + dark mouth opening + teeth).
// Head-bone local space: origin = skull base / top of neck, +Y up, +Z = face direction.
// Surfaces of hair/beard are parametrised along their own boundaries (clean edges, no staircase).
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise1, DEG } from '../core/util.js';
import { makeTable, gridGeometry, setColor, merge, superEllipsoid, loftTube } from './jesus_geo.js';

export const HEAD = {
  zoff: 0.012,           // face geometry shifted forward of the neck axis
  eye: { x: 0.0325, y: 0.0685, r: 0.0120 },
  mouthY: -0.0045,       // mouth line (lips meet)
  jawPivot: new THREE.Vector3(0, 0.012, 0.004),
  jawMaxDeg: 8.5,
  top: 0.179, bottom: -0.068,
};
const ZO = HEAD.zoff;
const MY = HEAD.mouthY;

// ---------------------------------------------------------------------------------------------
// Skin surface
// ---------------------------------------------------------------------------------------------
const W = makeTable([[-0.068, 0.019], [-0.058, 0.033], [-0.045, 0.045], [-0.025, 0.0555], [0.0, 0.0625], [0.025, 0.067],
  [0.05, 0.0705], [0.075, 0.0725], [0.10, 0.0735], [0.125, 0.0712], [0.145, 0.0635], [0.16, 0.0515], [0.171, 0.0345],
  [0.1765, 0.017], [0.179, 0.0]]);
const ZF = makeTable([[-0.068, 0.052], [-0.058, 0.073], [-0.045, 0.0825], [-0.03, 0.0855], [-0.012, 0.0885], [0.0, 0.0925],
  [0.012, 0.0945], [0.025, 0.0915], [0.045, 0.0875], [0.065, 0.0848], [0.082, 0.0885], [0.095, 0.0905], [0.115, 0.0868],
  [0.135, 0.0772], [0.152, 0.0632], [0.165, 0.0455], [0.174, 0.0255], [0.179, 0.0]]);
const ZB = makeTable([[-0.068, 0.038], [-0.05, 0.054], [-0.02, 0.074], [0.02, 0.092], [0.06, 0.1015], [0.10, 0.0995],
  [0.13, 0.0875], [0.155, 0.0655], [0.17, 0.040], [0.179, 0.0]]);
const NF = makeTable([[-0.068, 1.75], [-0.045, 1.8], [-0.01, 2.15], [0.03, 2.55], [0.07, 2.75], [0.11, 2.45], [0.15, 2.1], [0.179, 2.0]]);

const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function slice(th, y) {
  const s = Math.sin(th), c = Math.cos(th);
  const e = 2 / (c > 0 ? NF(y) : 2.0);
  const x = W(y) * sp(s, e);
  const z = c > 0 ? ZF(y) * Math.pow(c, e) : -ZB(y) * Math.pow(-c, 1.0);
  return [x, y, z];
}

function sculpt(p) {
  let [x, y, z] = p;
  const ax = Math.abs(x), sx = Math.sign(x) || 1;
  const front = smoothstep(0.025, 0.06, z);
  const E = HEAD.eye;
  const gs = Math.exp(-(((ax - E.x) / 0.0175) ** 2 + ((y - E.y - 0.001) / 0.0118) ** 2));
  z -= 0.0098 * gs * front;                                                                    // eye sockets
  z += 0.0042 * Math.exp(-(((y - 0.0885) / 0.0075) ** 2)) * smoothstep(0.066, 0.026, ax) * front; // brow ridge
  z += 0.0045 * Math.exp(-((x / 0.011) ** 2 + ((y - 0.074) / 0.016) ** 2)) * front;           // glabella / nose root
  const gc = Math.exp(-(((ax - 0.05) / 0.016) ** 2 + ((y - 0.046) / 0.013) ** 2));
  z += 0.0032 * gc * front; x += sx * 0.0022 * gc;                                             // cheekbones
  z += 0.0042 * Math.exp(-((x / 0.028) ** 2 + ((y - 0.002) / 0.02) ** 2)) * front;            // muzzle
  z += 0.0035 * Math.exp(-((x / 0.02) ** 2 + ((y + 0.046) / 0.012) ** 2)) * front;            // chin
  x -= sx * 0.0022 * Math.exp(-(((y - 0.095) / 0.02) ** 2 + ((z - 0.045) / 0.025) ** 2));    // temples
  return [x, y, z + ZO];
}

export function headSurf(th, y) { return sculpt(slice(th, y)); }
function headNormal(th, y) {
  const e = 0.0025;
  const a = new THREE.Vector3(...headSurf(th + e, y)).sub(new THREE.Vector3(...headSurf(th - e, y)));
  const yy = clamp(y, HEAD.bottom + e, HEAD.top - e);
  const b = new THREE.Vector3(...headSurf(th, yy + e)).sub(new THREE.Vector3(...headSurf(th, yy - e)));
  const n = new THREE.Vector3().crossVectors(a, b);
  if (n.lengthSq() < 1e-14) return new THREE.Vector3(0, y > 0.1 ? 1 : -1, 0);
  return n.normalize();
}
// slice angle where the (sculpted) front surface reaches |x| = ax at height y
function thetaAt(ax, y) {
  let a = 0, b = Math.PI / 2;
  for (let i = 0; i < 36; i++) {
    const m = (a + b) / 2;
    if (Math.abs(headSurf(m, y)[0]) < ax) a = m; else b = m;
  }
  return (a + b) / 2;
}
export function faceZ(x, y) { return headSurf(thetaAt(Math.abs(x), y), y)[2]; }
function faceAt(x, y) {
  const th = thetaAt(Math.abs(x), y) * (x < 0 ? -1 : 1);
  return { p: new THREE.Vector3(...headSurf(th, y)), n: headNormal(th, y), th };
}

const NU = 72;
const RING_Y = (() => {
  const ys = [HEAD.bottom - 0.0015];
  const nLin = 44, nTop = 11;
  for (let i = 0; i <= nLin; i++) ys.push(lerp(HEAD.bottom, 0.13, i / nLin));
  for (let i = 1; i <= nTop; i++) ys.push(0.13 + (HEAD.top - 0.13) * Math.sin((i / nTop) * Math.PI / 2));
  return ys;
})();
const NV = RING_Y.length - 1;
const BOTTOM_POLE = [0, HEAD.bottom - 0.0015, ZF(HEAD.bottom) * 0.25 - ZB(HEAD.bottom) * 0.25 + ZO];

function headPoint(u, j) {
  if (j === 0) return BOTTOM_POLE;
  return headSurf(u * Math.PI * 2, RING_Y[j]);
}

function jawWeight(x, y, z) {
  const ax = Math.abs(x);
  const side = smoothstep(0.016, 0.036, ax);
  const band = lerp(0.005, 0.022, side);
  const yl = MY + lerp(0.0008, 0.004, side);
  let w = smoothstep(yl, yl - band, y);
  w *= smoothstep(-0.045, -0.005, z - ZO);
  return w;
}
const setJaw = (g, fn) => {
  const p = g.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn(p.getX(i), p.getY(i), p.getZ(i), i);
  g.setAttribute('jw', new THREE.BufferAttribute(a, 1));
  return g;
};

// ---------------------------------------------------------------------------------------------
// Skin colour
// ---------------------------------------------------------------------------------------------
export const SKIN_HEX = '#c98463';
const SKIN_BASE = new THREE.Color(SKIN_HEX);
function skinColorAt(x, y, z) {
  const c = SKIN_BASE.clone();
  const ax = Math.abs(x);
  const cheek = Math.exp(-(((ax - 0.046) / 0.017) ** 2 + ((y - 0.042) / 0.015) ** 2));
  c.lerp(new THREE.Color('#d0785e'), 0.33 * cheek);
  const lid = Math.exp(-(((ax - HEAD.eye.x) / 0.019) ** 2 + ((y - HEAD.eye.y - 0.006) / 0.010) ** 2));
  c.lerp(new THREE.Color('#b45a52'), 0.30 * lid);
  // lid crease
  const crease = Math.exp(-(((ax - HEAD.eye.x) / 0.015) ** 2 + ((y - HEAD.eye.y - 0.0125) / 0.0022) ** 2));
  c.lerp(new THREE.Color('#8a4a3a'), 0.30 * crease);
  // sides of the face slightly darker for form
  c.multiplyScalar(1 - 0.10 * smoothstep(0.045, 0.07, ax) * smoothstep(-0.03, 0.03, z - ZO));
  c.lerp(new THREE.Color('#d39b76'), 0.22 * smoothstep(0.09, 0.13, y));
  return c;
}
function colorize(g, fn) {
  const p = g.attributes.position;
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i));
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function buildSkin() {
  const g = gridGeometry(NU, NV, (u, v, i, j) => headPoint(u, j), {
    poleNormals: [[0, [0, -1, 0]], [NV, [0, 1, 0]]],
    uv: (u, v, p) => [u * 6, p[1] * 25],
  });
  colorize(g, skinColorAt);
  return g;
}

// Nose: horizontal D-shaped slices from the root to the tip, then the underside; plus alae.
function buildNose() {
  const R = [ // y, ridge z, half width, depth
    [0.081, 0.0905, 0.0074, 0.012],
    [0.074, 0.0925, 0.0068, 0.0125],
    [0.066, 0.0955, 0.0066, 0.014],
    [0.057, 0.0995, 0.0072, 0.0165],
    [0.048, 0.1043, 0.0082, 0.020],
    [0.040, 0.1095, 0.0098, 0.0245],
    [0.034, 0.1138, 0.0115, 0.0275],
    [0.0295, 0.1158, 0.0125, 0.0295],
    [0.0255, 0.1148, 0.0138, 0.0300],
    [0.0225, 0.1112, 0.0142, 0.0280],
    [0.0200, 0.1055, 0.0132, 0.0240],
    [0.0188, 0.0990, 0.0105, 0.0180],
  ];
  const seg = 20;
  const ring = (k, a) => {
    const [y, zr, hw, d] = R[k];
    const c = Math.cos(a), s = Math.sin(a);
    const back = (1 - c) / 2;
    const tipRound = smoothstep(4, 7, k);
    const x = hw * s * lerp(0.55 + 0.45 * back, 0.88 + 0.12 * back, tipRound);
    const z = zr - d * Math.pow(back, lerp(1.0, 0.7, tipRound));
    return [x, y, z + ZO];
  };
  const g = gridGeometry(seg, R.length - 1, (u, v, i, j) => ring(j, u * Math.PI * 2), { flip: true });
  const last = R.length - 1;
  const cy = R[last][0] - 0.0012, cz = R[last][1] - R[last][3] * 0.5 + ZO;
  const pos = [0, cy, cz], idx = [];
  for (let i = 0; i <= seg; i++) pos.push(...ring(last, (i / seg) * Math.PI * 2));
  for (let i = 0; i < seg; i++) idx.push(0, i + 2, i + 1);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  cap.setIndex(idx); cap.computeVertexNormals();
  // alae (nostril wings)
  const alae = [1, -1].map((s) => superEllipsoid([0.0046, 0.0046, 0.0070], [s * 0.0106, 0.0242, 0.0975 + ZO], { wSeg: 12, hSeg: 8 }));
  const nose = merge([g, cap, ...alae]);
  colorize(nose, (x, y, z) => {
    const c = SKIN_BASE.clone();
    c.lerp(new THREE.Color('#cf7a62'), 0.32 * smoothstep(0.042, 0.028, y));
    const n = Math.exp(-(((Math.abs(x) - 0.0062) / 0.0036) ** 2 + ((y - 0.0196) / 0.0022) ** 2 + ((z - ZO - 0.1035) / 0.0065) ** 2));
    c.lerp(new THREE.Color('#2e130c'), clamp(n * 1.5, 0, 0.92));
    return c;
  });
  return nose;
}

function buildLips() {
  const zc = faceZ(0, MY);
  const upper = superEllipsoid([0.0160, 0.0028, 0.0038], [0, MY + 0.0026, zc - 0.0012], { e1: 0.9, wSeg: 18, hSeg: 8 });
  const lower = superEllipsoid([0.0142, 0.0038, 0.0042], [0, MY - 0.0037, zc - 0.0024], { e1: 0.9, wSeg: 18, hSeg: 8 });
  for (const g of [upper, lower]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, p.getZ(i) - (zc - faceZ(x, MY)) * 0.95);
    }
    g.computeVertexNormals();
  }
  setColor(upper, '#9a5f4c');
  setColor(lower, '#a8664f');
  setJaw(upper, () => 0);
  setJaw(lower, () => 1);
  return merge([upper, lower]);
}

// ---------------------------------------------------------------------------------------------
// Hair cap: rows run from the hairline (edge tucked into the skin) to the crown.
// ---------------------------------------------------------------------------------------------
const HAIRLINE = makeTable([[0, 0.129], [0.2, 0.125], [0.42, 0.113], [0.62, 0.097], [0.8, 0.078], [0.95, 0.058], [1.08, 0.036],
  [1.25, 0.010], [1.5, -0.03], [1.85, -0.046], [Math.PI, -0.05]]);
function hairThick(th, y, v) {
  const ath = Math.abs(th);
  let t = 0.010 + 0.011 * smoothstep(-0.02, 0.15, y) + 0.004 * smoothstep(0.9, 1.3, ath) * smoothstep(0.1, 0.0, y);
  const frontTop = smoothstep(1.4, 1.0, ath) * smoothstep(0.08, 0.12, y);
  t *= lerp(1, lerp(0.3, 1, smoothstep(0.0, 0.16, ath)), frontTop);          // centre part
  t += 0.0016 * Math.sin(th * 44 + y * 25) + 0.001 * Math.sin(th * 97);
  return t * lerp(0.18, 1, smoothstep(0, 0.14, v));
}
function buildHairCap() {
  const nu = 96, nv = 25;
  const base = [];
  const g = gridGeometry(nu, nv + 1, (u, vv, i, j) => {
    const th = (u - 0.5) * Math.PI * 2; // seam at the back
    const hl = HAIRLINE(Math.abs(th)) + 0.0018 * noise1(th * 40 + 3);
    if (j === 0) { // tuck row inside the skin
      const y = hl - 0.0025;
      const p = new THREE.Vector3(...headSurf(th, y)).addScaledVector(headNormal(th, y), -0.0012);
      return [p.x, p.y, p.z];
    }
    const v = (j - 1) / nv;
    const y = j === nv + 1 ? HEAD.top : lerp(hl, HEAD.top, 1 - Math.pow(1 - v, 1.15));
    if (j === nv + 1) return [0, HEAD.top + hairThick(0, HEAD.top, 1) * 0.9, -0.004 + ZO];
    const p = new THREE.Vector3(...headSurf(th, y)).addScaledVector(headNormal(th, y), hairThick(th, y, v));
    return [p.x, p.y, p.z];
  }, { uv: (u, v, p) => [u * 9, p[1] * 9], poleNormals: [[nv + 1, [0, 1, 0]]] });
  // edge rows: use the scalp normal so the tucked rim is lit like the hair, not like a downward wall
  const N = g.attributes.normal;
  for (let j = 0; j <= 3; j++) for (let i = 0; i <= nu; i++) {
    const th = (i / nu - 0.5) * Math.PI * 2;
    const k = j * (nu + 1) + i;
    const hn = headNormal(th, HAIRLINE(Math.abs(th)) + 0.004);
    const cur = new THREE.Vector3(N.getX(k), N.getY(k), N.getZ(k));
    const w = j <= 1 ? 1 : j === 2 ? 0.6 : 0.3;
    cur.lerp(hn, w).normalize();
    N.setXYZ(k, cur.x, cur.y, cur.z);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Beard (cheeks, jaw, chin, under the chin) and moustache.
// ---------------------------------------------------------------------------------------------
const BEARD_TOP = makeTable([[0, MY - 0.0098], [0.0140, MY - 0.0094], [0.0175, MY - 0.0068], [0.0210, MY - 0.0018], [0.0240, MY + 0.0025], [0.029, 0.0085],
  [0.036, 0.0195], [0.045, 0.031], [0.054, 0.0435], [0.0605, 0.057], [0.0655, 0.073], [0.0705, 0.092]]);
const TH_B = 1.95;
function beardTopAt(th) {
  // fixed point: y = BEARD_TOP(|x(th, y)|)
  let y = 0.02;
  for (let i = 0; i < 8; i++) y = BEARD_TOP(Math.abs(headSurf(th, y)[0]));
  if (Math.abs(th) > Math.PI / 2) y = lerp(y, 0.06, smoothstep(Math.PI / 2, TH_B, Math.abs(th)));
  return y + 0.0018 * noise1(th * 55 + 7);
}
function beardThick(x, y, z, edgeV, edgeTh) {
  const ax = Math.abs(x);
  let t = 0.0072 + 0.0058 * smoothstep(0.0, -0.055, y) + 0.003 * smoothstep(0.03, 0.06, ax);
  t += 0.0015 * noise1(x * 420 + y * 310) + 0.001 * Math.sin(Math.atan2(x, z - ZO) * 40);
  return t * lerp(0.2, 1, smoothstep(0, 0.16, edgeV)) * edgeTh;
}
function buildBeard() {
  const nu = 72, nvFace = 25, nvUnder = 7;
  const nv = nvFace + nvUnder + 1; // +1 tuck row
  const baseP = [];
  const g = gridGeometry(nu, nv, (u, vv, i, j) => {
    const th = (u - 0.5) * 2 * TH_B;
    const edgeTh = smoothstep(TH_B, TH_B - 0.35, Math.abs(th));
    const yTop = beardTopAt(th);
    let p, n, base;
    if (j === 0) { // tucked edge
      const y = yTop + 0.002;
      base = new THREE.Vector3(...headSurf(th, y));
      p = base.clone().addScaledVector(headNormal(th, y), -0.001);
    } else if (j <= nvFace) {
      const v = (j - 1) / nvFace;
      const y = lerp(yTop, HEAD.bottom, Math.pow(v, 0.92));
      base = new THREE.Vector3(...headSurf(th, y));
      n = headNormal(th, y);
      p = base.clone().addScaledVector(n, Math.max(0.0012, beardThick(base.x, y, base.z, v, edgeTh)));
    } else {
      // across the bottom cap toward the under-chin centre
      const k = (j - nvFace) / (nvUnder + 1) * 0.92;
      const ring = new THREE.Vector3(...headSurf(th, HEAD.bottom));
      base = ring.clone().lerp(new THREE.Vector3(...BOTTOM_POLE), k);
      n = new THREE.Vector3(0, -1, 0).lerp(headNormal(th, HEAD.bottom), 1 - k).normalize();
      p = base.clone().addScaledVector(n, Math.max(0.0012, beardThick(base.x, HEAD.bottom, base.z, 1, edgeTh)));
    }
    // fuller beard below the chin: grow downward (rounded, slightly pointed)
    const ax = Math.abs(p.x);
    const below = smoothstep(-0.03, -0.068, base.y) * smoothstep(-0.05, 0.02, base.z - ZO) * Math.max(0, 1 - (ax / 0.075) ** 2);
    p.y -= 0.026 * below * edgeTh;
    p.z += 0.007 * below * smoothstep(0.0, 0.06, base.z - ZO + 0.02);
    baseP.push(base);
    return [p.x, p.y, p.z];
  }, { wrapU: false, flip: true, uv: (u, v, p) => [u * 7, p[1] * 10] });
  setJaw(g, (x, y, z, i) => jawWeight(baseP[i].x, baseP[i].y, baseP[i].z));
  return g;
}

function buildMoustache() {
  const nu = 26, nv = 7;
  const HW = 0.0272;
  const g = gridGeometry(nu, nv, (u, vv, i, j) => {
    const x = lerp(HW, -HW, u);
    const ax = Math.abs(x) / HW;
    const yT = 0.0202 - 0.0045 * ax * ax;
    const yB = MY + 0.0056 - 0.0145 * Math.pow(ax, 2.3);
    let y, off;
    if (j === 0) { y = yT + 0.0015; off = -0.0008; }          // tucked under the nose
    else if (j === nv) { y = yB + 0.0022; off = 0.0028; }     // bottom edge folds back toward the lip
    else {
      const v = (j - 1) / (nv - 2);
      y = lerp(yT, yB, v);
      off = 0.0030 + 0.0038 * Math.sin(Math.PI * (0.2 + 0.8 * v)) + 0.0016 * v;
    }
    const f = faceAt(x, y);
    const p = f.p.addScaledVector(f.n, off + 0.0007 * Math.sin(u * 60));
    // droop forward over the upper lip
    if (j >= nv - 2) p.z += 0.0012;
    return [p.x, p.y, p.z];
  }, { wrapU: false, uv: (u, v) => [u * 3, v * 0.6] });
  setJaw(g, () => 0);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Long hair: falls from the sides/back of the head to the shoulders.
// ---------------------------------------------------------------------------------------------
function buildHairCurtain() {
  const PHI = 112 * DEG;
  const nu = 64, nv = 28;
  const yTop = 0.118;
  const g = gridGeometry(nu, nv, (u, v) => {
    const s = u;
    const th = Math.PI + (s - 0.5) * 2 * PHI;
    const as = Math.abs(Math.sin(th));
    const lock = Math.sin(s * Math.PI * 2 * 7.5 + 0.6);
    const yBot = lerp(-0.172, -0.086, smoothstep(0.35, 0.95, as)) + 0.011 * lock + 0.006 * Math.sin(s * 97);
    const y = lerp(yTop, yBot, Math.pow(v, 0.95));
    // soft-max so the hair does not follow the narrowing jaw (no crease)
    const yc = 0.035 + 0.02 * Math.log(1 + Math.exp((y - 0.035) / 0.02));
    const b = headSurf(th, yc);
    let x = b[0], z = b[2] - ZO;
    const r0 = Math.hypot(x, z);
    const dirx = x / r0, dirz = z / r0;
    const below = 0.02 * Math.log(1 + Math.exp((0.035 - y) / 0.02));
    const capT = 0.010 + 0.011 * smoothstep(-0.02, 0.15, y);
    let r = r0 + lerp(capT - 0.003, capT + 0.006, smoothstep(0.10, 0.04, y)) + below * lerp(0.07, 0.25, as);
    const tip = smoothstep(0.07, -0.12, y);
    const wave = Math.sin(y * 62 + s * 9 + lock * 0.8);
    r += 0.0065 * lock * (0.25 + tip) + 0.0045 * wave * tip + 0.002 * Math.sin(s * 140);
    x = dirx * r; z = dirz * r;
    x += 0.0065 * Math.sin(y * 48 + s * 5) * tip;
    const edge = smoothstep(0.75, 0.98, Math.abs(s - 0.5) * 2);
    z += 0.012 * edge * smoothstep(0.06, -0.05, y);
    return [x, y, z + ZO];
  }, { flip: true, wrapU: false, uv: (u, v) => [u * 8, v * 1.6] });
  return g;
}

// ---------------------------------------------------------------------------------------------
// Brows, lids
// ---------------------------------------------------------------------------------------------
function buildBrow(side) {
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = side * lerp(0.0105, 0.0565, t);
    const y = 0.0838 + 0.0058 * Math.sin(Math.PI * Math.pow(t, 0.7)) - 0.0026 * t;
    const taper = smoothstep(0, 0.12, t) * 0.45 + 0.55;
    pts.push({ x, y, rx: lerp(0.0044, 0.0016, Math.pow(t, 1.2)) * taper, rz: 0.0019, t });
  }
  return pts;
}
function browGeometry(pts, raiseInner, raiseOuter) {
  const q = pts.map((P) => {
    const y = P.y + lerp(raiseInner, raiseOuter, P.t);
    const f = faceAt(P.x, y);
    return { p: f.p.addScaledVector(f.n, 0.0012), rx: P.rx, rz: P.rz, side: new THREE.Vector3(0, 1, 0), t: P.t };
  });
  return loftTube(q, 6);
}

function lidGeometry(r, lenDeg, lower) {
  const g = new THREE.SphereGeometry(r, 20, 11, 0, Math.PI * 2, 0, lenDeg * DEG);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const skin = SKIN_BASE.clone().lerp(new THREE.Color('#b0644e'), lower ? 0.15 : 0.28);
  const lash = new THREE.Color('#1e0f08');
  for (let i = 0; i < p.count; i++) {
    const polar = Math.acos(clamp(p.getY(i) / r, -1, 1)) / DEG;
    const c = skin.clone().lerp(lash, smoothstep(lenDeg - 12, lenDeg - 2, polar) * (lower ? 0.55 : 0.95));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (lower) g.rotateZ(Math.PI);
  return g;
}

// ---------------------------------------------------------------------------------------------
export function buildHead(T) {
  const group = new THREE.Group();
  group.name = 'jesusHead';

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: T.skin, roughness: 0.6, metalness: 0 });
  skinMat.emissive = new THREE.Color('#4a1608'); skinMat.emissiveIntensity = 0.16;
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.hair, roughness: 0.62, side: THREE.DoubleSide });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.beard, roughness: 0.75, side: THREE.DoubleSide });
  const browMat = new THREE.MeshStandardMaterial({ color: '#9c8474', map: T.beard, roughness: 0.85 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#240a08', roughness: 0.9 });
  const teethMat = new THREE.MeshStandardMaterial({ color: '#c9bfac', roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ map: T.eye, emissive: 0xffffff, emissiveMap: T.eyeEmissive, emissiveIntensity: 1.4, roughness: 0.2 });

  const headSkin = buildSkin();
  setJaw(headSkin, jawWeight);
  const skinGeo = merge([headSkin, setJaw(buildNose(), () => 0), buildLips()]);
  const skin = new THREE.Mesh(skinGeo, skinMat);
  skin.name = 'headSkin';
  group.add(skin);

  const beardGeo = merge([buildBeard(), buildMoustache()]);
  const beard = new THREE.Mesh(beardGeo, beardMat);
  beard.name = 'beard';
  group.add(beard);

  const hairCap = new THREE.Mesh(buildHairCap(), hairMat);
  hairCap.name = 'hairCap';
  group.add(hairCap);

  const hairPivot = new THREE.Group();
  hairPivot.position.set(0, 0.10, -0.01);
  group.add(hairPivot);
  const curtain = new THREE.Mesh(buildHairCurtain().translate(0, -0.10, 0.01), hairMat);
  curtain.name = 'hairCurtain';
  hairPivot.add(curtain);

  // --- eyes ---
  const E = HEAD.eye;
  const eyeZ = faceZ(E.x, E.y) - E.r + 0.0068;
  const eyeGroups = [];
  const eyeGeo = new THREE.SphereGeometry(E.r, 24, 16).rotateX(Math.PI / 2);
  for (const sx of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * E.x, E.y, eyeZ);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.castShadow = false;
    pivot.add(eye);
    group.add(pivot);
    eyeGroups.push(pivot);
  }
  const lidR = E.r * 1.07;
  const mkLid = (len, lower) => {
    const a = lidGeometry(lidR, len, lower).translate(E.x, 0, 0);
    const b = lidGeometry(lidR, len, lower).translate(-E.x, 0, 0);
    const m = new THREE.Mesh(merge([a, b]), skinMat);
    m.position.set(0, E.y, eyeZ);
    m.castShadow = false;
    group.add(m);
    return m;
  };
  const upperLid = mkLid(100, false);
  const lowerLid = mkLid(100, true);

  // --- brows ---
  const browPts = [buildBrow(1), buildBrow(-1)];
  const brows = new THREE.Mesh(merge([browGeometry(browPts[0], 0, 0), browGeometry(browPts[1], 0, 0)]), browMat);
  brows.castShadow = false;
  group.add(brows);

  // --- mouth opening + teeth (dynamic small grids) ---
  const MC = 12;
  const mouthGeo = new THREE.BufferGeometry();
  mouthGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MC + 1) * 2 * 3), 3));
  const midx = [];
  for (let i = 0; i < MC; i++) { const a = i, b = i + 1, c = MC + 1 + i, d = c + 1; midx.push(a, c, d, a, d, b); }
  mouthGeo.setIndex(midx);
  const teethGeo = mouthGeo.clone();
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  const teeth = new THREE.Mesh(teethGeo, teethMat);
  mouth.castShadow = teeth.castShadow = false;
  mouth.frustumCulled = teeth.frustumCulled = false;
  group.add(mouth, teeth);
  const MHW = 0.0165, THW = 0.0112;
  const mouthRest = [], teethRest = [];
  for (let i = 0; i <= MC; i++) {
    const x = lerp(-MHW, MHW, i / MC);
    mouthRest.push({ x, z: faceZ(x, MY) });
    const tx = x * (THW / MHW);
    teethRest.push({ x: tx, z: faceZ(tx, MY) });
  }

  // --- jaw deformation data ---
  const deformables = [skinGeo, beardGeo].map((g) => {
    const P = g.attributes.position, N = g.attributes.normal, J = g.attributes.jw;
    const ids = [], w = [];
    if (J) for (let i = 0; i < P.count; i++) if (J.getX(i) > 1e-3) { ids.push(i); w.push(J.getX(i)); }
    return { g, ids, w, p0: Float32Array.from(P.array), n0: Float32Array.from(N.array) };
  });

  const jawQ = new THREE.Quaternion();
  const tmp = new THREE.Vector3(), tmpN = new THREE.Vector3(), rn = new THREE.Vector3();
  const piv = HEAD.jawPivot.clone(); piv.z += ZO;
  const jawPoint = (x, y, z, w, out) => {
    tmp.set(x, y, z).sub(piv).applyQuaternion(jawQ).add(piv);
    return out.set(x + (tmp.x - x) * w, y + (tmp.y - y) * w, z + (tmp.z - z) * w);
  };

  let curOpen = -1;
  const v3 = new THREE.Vector3();
  function setMouth(open) {
    open = clamp(open || 0, 0, 1);
    if (Math.abs(open - curOpen) < 0.004) return;
    curOpen = open;
    jawQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), open * HEAD.jawMaxDeg * DEG);
    for (const d of deformables) {
      const P = d.g.attributes.position, N = d.g.attributes.normal;
      for (let n = 0; n < d.ids.length; n++) {
        const i = d.ids[n], w = d.w[n];
        jawPoint(d.p0[i * 3], d.p0[i * 3 + 1], d.p0[i * 3 + 2], w, v3);
        P.setXYZ(i, v3.x, v3.y, v3.z);
        tmpN.set(d.n0[i * 3], d.n0[i * 3 + 1], d.n0[i * 3 + 2]);
        rn.copy(tmpN).applyQuaternion(jawQ);
        tmpN.lerp(rn, w).normalize();
        N.setXYZ(i, tmpN.x, tmpN.y, tmpN.z);
      }
      P.needsUpdate = true; N.needsUpdate = true;
    }
    const mp = mouthGeo.attributes.position, tp = teethGeo.attributes.position;
    const teethH = 0.0034 * smoothstep(0.55, 0.95, open);
    for (let i = 0; i <= MC; i++) {
      const { x, z } = mouthRest[i];
      const lens = Math.pow(Math.max(0, 1 - (x / MHW) ** 2), 0.55);
      const top = MY + 0.0012 * lens;
      const bot = jawPoint(x, MY - 0.0012 * lens - 0.0002, z, 1, v3);
      const zf = z + 0.0010;
      mp.setXYZ(i, x, top, zf);
      mp.setXYZ(MC + 1 + i, x, lerp(top, bot.y, lens), lerp(zf, bot.z + 0.001, lens));
      const t = teethRest[i];
      const te = Math.pow(Math.max(0, 1 - (t.x / THW) ** 2), 0.35);
      tp.setXYZ(i, t.x, MY + 0.0012, t.z + 0.0016);
      tp.setXYZ(MC + 1 + i, t.x, MY + 0.0012 - teethH * te, t.z + 0.0011);
    }
    mp.needsUpdate = true; tp.needsUpdate = true;
    mouthGeo.computeVertexNormals(); teethGeo.computeVertexNormals();
    mouthGeo.computeBoundingSphere(); teethGeo.computeBoundingSphere();
    teeth.visible = teethH > 0.0003;
  }

  const lid = { blink: 0, smile: 0.25 };
  function applyLids() {
    const b = clamp(lid.blink, 0, 1), s = clamp(lid.smile, 0, 1);
    upperLid.rotation.x = (lerp(-18.5, 17, b) + 2.5 * s) * DEG;
    lowerLid.rotation.x = (lerp(29.5, 25, b) - 7 * s) * DEG;
  }
  function setBlink(v) { lid.blink = v; applyLids(); }
  function setEyes(yawDeg = 0, pitchDeg = 0) {
    for (const g of eyeGroups) g.rotation.set(clamp(-pitchDeg, -25, 25) * DEG, clamp(yawDeg, -35, 35) * DEG, 0);
  }
  let browState = [0, 0];
  function setExpression({ smile = 0.25, brow = 0.25 } = {}) {
    lid.smile = smile; applyLids();
    const inner = 0.0026 * brow, outer = -0.0005 * brow + 0.0005 * smile;
    if (Math.abs(inner - browState[0]) + Math.abs(outer - browState[1]) > 1e-5) {
      browState = [inner, outer];
      brows.geometry.dispose();
      brows.geometry = merge([browGeometry(browPts[0], inner, outer), browGeometry(browPts[1], inner, outer)]);
    }
  }

  setMouth(0); setBlink(0); setEyes(0, 0); setExpression({});

  for (const m of [skin, beard, hairCap, curtain]) { m.castShadow = true; m.receiveShadow = true; }
  for (const m of [brows, mouth, teeth, upperLid, lowerLid]) m.receiveShadow = true;

  return {
    group, hairPivot, setMouth, setBlink, setEyes, setExpression,
    materials: { skinMat, hairMat, beardMat },
    meshes: { skin, beard, hairCap, curtain, brows, mouth, teeth, upperLid, lowerLid },
  };
}
