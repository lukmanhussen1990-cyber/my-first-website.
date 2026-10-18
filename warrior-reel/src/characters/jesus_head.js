// Jesus's head: sculpted skin (loft of superelliptic slices + features), nose, eyes with lids,
// brows, full beard + moustache (offset shell of the skin), long wavy hair with centre part,
// and a talking mouth (jaw deformation on the CPU + dark mouth opening + teeth).
// Head-bone local space: origin = skull base / top of neck, +Y up, +Z = face direction.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise1, DEG } from '../core/util.js';
import { makeTable, gridGeometry, setColor, merge, superEllipsoid, loftTube } from './jesus_geo.js';

export const HEAD = {
  zoff: 0.012,           // face geometry shifted forward of the neck axis
  eye: { x: 0.0325, y: 0.0685, r: 0.0122 },
  mouthY: -0.0045,       // mouth line (lips meet)
  jawPivot: new THREE.Vector3(0, 0.012, 0.004),
  jawMaxDeg: 9.5,
  top: 0.179, bottom: -0.068,
};
const ZO = HEAD.zoff;

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

// Base superelliptic slice point at angle th (0 = front +Z, +pi/2 = +X) and height y.
function slice(th, y) {
  const s = Math.sin(th), c = Math.cos(th);
  const e = 2 / (c > 0 ? NF(y) : 2.0);
  const x = W(y) * sp(s, e);
  const z = c > 0 ? ZF(y) * Math.pow(c, e) : -ZB(y) * Math.pow(-c, 2 / 2.0);
  return [x, y, z];
}

// Facial features as displacements of the base surface.
function sculpt(p) {
  let [x, y, z] = p;
  const ax = Math.abs(x), sx = Math.sign(x) || 1;
  const front = smoothstep(0.025, 0.06, z);
  const E = HEAD.eye;
  // eye sockets
  const gs = Math.exp(-(((ax - E.x) / 0.0175) ** 2 + ((y - E.y - 0.001) / 0.0118) ** 2));
  z -= 0.0098 * gs * front;
  // brow ridge
  z += 0.0036 * Math.exp(-(((y - 0.0895) / 0.0072) ** 2)) * smoothstep(0.066, 0.028, ax) * front;
  // nose root / glabella
  z += 0.0045 * Math.exp(-((x / 0.011) ** 2 + ((y - 0.074) / 0.016) ** 2)) * front;
  // cheekbones
  const gc = Math.exp(-(((ax - 0.05) / 0.016) ** 2 + ((y - 0.046) / 0.013) ** 2));
  z += 0.0032 * gc * front; x += sx * 0.0022 * gc;
  // muzzle (mouth area projects a little)
  z += 0.0042 * Math.exp(-((x / 0.028) ** 2 + ((y - 0.002) / 0.02) ** 2)) * front;
  // chin
  z += 0.0035 * Math.exp(-((x / 0.02) ** 2 + ((y + 0.046) / 0.012) ** 2)) * front;
  // temples
  x -= sx * 0.0022 * Math.exp(-(((y - 0.095) / 0.02) ** 2 + ((z - 0.045) / 0.025) ** 2));
  return [x, y, z + ZO];
}

const NU = 88;
// ring heights: degenerate bottom pole, linear to 0.13, then a dome to the crown.
const RING_Y = (() => {
  const ys = [HEAD.bottom - 0.0015];
  const nLin = 50, nTop = 13;
  for (let i = 0; i <= nLin; i++) ys.push(lerp(HEAD.bottom, 0.13, i / nLin));
  for (let i = 1; i <= nTop; i++) ys.push(0.13 + (HEAD.top - 0.13) * Math.sin((i / nTop) * Math.PI / 2));
  return ys;
})();
const NV = RING_Y.length - 1;

function headPoint(u, j) {
  const th = u * Math.PI * 2;
  const y = RING_Y[j];
  if (j === 0) return [0, y, ZF(HEAD.bottom) * 0.25 - ZB(HEAD.bottom) * 0.25 + ZO];
  return sculpt(slice(th, y));
}

// z of the (sculpted) front surface at (x, y), by bisection on the slice angle.
export function faceZ(x, y) {
  let a = 0, b = Math.PI / 2;
  const target = Math.abs(x);
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (Math.abs(sculpt(slice(m, y))[0]) < target) a = m; else b = m;
  }
  return sculpt(slice((a + b) / 2, y))[2];
}

// ---------------------------------------------------------------------------------------------
// Region masks (on base skin points)
// ---------------------------------------------------------------------------------------------
const BEARD_TOP = makeTable([[0, 0.0215], [0.010, 0.0225], [0.019, 0.0195], [0.028, 0.0215], [0.04, 0.032], [0.052, 0.042],
  [0.062, 0.056], [0.069, 0.075], [0.076, 0.10]]);
const HAIRLINE = makeTable([[0, 0.143], [0.01, 0.139], [0.025, 0.131], [0.04, 0.122], [0.052, 0.111], [0.061, 0.097],
  [0.068, 0.078], [0.074, 0.05], [0.08, 0.0]]);

function lipHole(x, y) { // 1 inside the lip area (no beard), 0 outside
  const dx = x / 0.0215, dy = (y - (HEAD.mouthY - 0.0018)) / 0.0088;
  return smoothstep(1.15, 0.85, Math.sqrt(dx * dx + dy * dy));
}

function beardMask(x, y, z) {
  const ax = Math.abs(x);
  const top = BEARD_TOP(ax) + 0.0025 * noise1(ax * 900 + 3);
  let m = smoothstep(top + 0.002, top - 0.002, y);
  m *= smoothstep(-0.035, -0.005, z - ZO);       // front + sides only
  m *= 1 - lipHole(x, y);
  return m;
}

function hairMask(x, y, z) {
  const ax = Math.abs(x);
  const hl = HAIRLINE(ax) + 0.002 * noise1(ax * 700 + 9);
  const f = smoothstep(0.015, 0.045, z - ZO);
  const front = smoothstep(hl - 0.0025, hl + 0.0025, y);
  const back = smoothstep(-0.05, -0.035, y);
  return lerp(back, front * back, f);
}

function jawWeight(x, y, z) {
  const ax = Math.abs(x);
  const side = smoothstep(0.016, 0.036, ax);
  const band = lerp(0.005, 0.022, side);
  const yl = HEAD.mouthY + lerp(0.0008, 0.004, side);
  let w = smoothstep(yl, yl - band, y);
  w *= smoothstep(-0.045, -0.005, z - ZO);
  return w;
}
const setJaw = (g, fn) => {
  const p = g.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn(p.getX(i), p.getY(i), p.getZ(i));
  g.setAttribute('jw', new THREE.BufferAttribute(a, 1));
  return g;
};

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------
const SKIN_BASE = new THREE.Color('#cf9168');
function skinColorAt(x, y, z) {
  const c = SKIN_BASE.clone();
  const ax = Math.abs(x);
  // warm cheeks and nose tip, slightly darker under the brow / around the eyes
  const cheek = Math.exp(-(((ax - 0.045) / 0.018) ** 2 + ((y - 0.04) / 0.016) ** 2));
  c.lerp(new THREE.Color('#d47f63'), 0.35 * cheek);
  const lid = Math.exp(-(((ax - HEAD.eye.x) / 0.02) ** 2 + ((y - HEAD.eye.y - 0.006) / 0.012) ** 2));
  c.lerp(new THREE.Color('#a8684a'), 0.25 * lid);
  // forehead a touch lighter
  c.lerp(new THREE.Color('#dba07a'), 0.25 * smoothstep(0.09, 0.13, y));
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

// Nose: horizontal D-shaped slices from the root to the tip, then the underside.
function buildNose() {
  const R = [ // y, ridge z, half width, depth
    [0.081, 0.0905, 0.0074, 0.012],
    [0.074, 0.0925, 0.0068, 0.0125],
    [0.066, 0.0955, 0.0066, 0.014],
    [0.057, 0.0995, 0.0071, 0.0165],
    [0.048, 0.1045, 0.0080, 0.020],
    [0.040, 0.1100, 0.0093, 0.0245],
    [0.034, 0.1145, 0.0108, 0.0275],
    [0.0295, 0.1168, 0.0118, 0.0295],
    [0.0255, 0.1158, 0.0138, 0.0300],
    [0.0225, 0.1120, 0.0150, 0.0280],
    [0.0200, 0.1060, 0.0140, 0.0240],
    [0.0188, 0.0990, 0.0110, 0.0180],
  ];
  const seg = 20;
  const ring = (k, a) => {
    const [y, zr, hw, d] = R[k];
    const c = Math.cos(a), s = Math.sin(a);
    const back = (1 - c) / 2;
    const tipRound = smoothstep(4, 7, k); // rounder near the tip
    const x = hw * s * lerp(0.55 + 0.45 * back, 0.85 + 0.15 * back, tipRound);
    const z = zr - d * Math.pow(back, lerp(1.0, 0.75, tipRound));
    return [x, y, z + ZO];
  };
  // flip so normals face outward (u goes around clockwise from the front seen from above, v goes downward)
  const g = gridGeometry(seg, R.length - 1, (u, v, i, j) => ring(j, u * Math.PI * 2), { flip: true });
  // bottom cap
  const last = R.length - 1;
  const cy = R[last][0] - 0.0012, cz = R[last][1] - R[last][3] * 0.5 + ZO;
  const pos = [0, cy, cz], idx = [];
  for (let i = 0; i <= seg; i++) pos.push(...ring(last, (i / seg) * Math.PI * 2));
  for (let i = 0; i < seg; i++) idx.push(0, i + 2, i + 1);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  cap.setIndex(idx); cap.computeVertexNormals();
  const nose = merge([g, cap]);
  colorize(nose, (x, y, z) => {
    const c = SKIN_BASE.clone();
    c.lerp(new THREE.Color('#d8836a'), 0.3 * smoothstep(0.04, 0.028, y));
    // nostrils
    const n = Math.exp(-(((Math.abs(x) - 0.0068) / 0.0035) ** 2 + ((y - 0.0195) / 0.002) ** 2 + ((z - ZO - 0.103) / 0.006) ** 2));
    c.lerp(new THREE.Color('#3a1a12'), clamp(n * 1.4, 0, 0.9));
    return c;
  });
  return nose;
}

function buildLips() {
  const ym = HEAD.mouthY;
  const zc = faceZ(0, ym);
  const upper = superEllipsoid([0.0172, 0.0034, 0.0052], [0, ym + 0.0030, zc - 0.0012], { e1: 0.9, wSeg: 18, hSeg: 8 });
  const lower = superEllipsoid([0.0160, 0.0046, 0.0060], [0, ym - 0.0042, zc - 0.0022], { e1: 0.9, wSeg: 18, hSeg: 8 });
  // curve lips around the face
  for (const g of [upper, lower]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, p.getZ(i) - (zc - faceZ(x, ym)) * 0.9);
    }
    g.computeVertexNormals();
  }
  setColor(upper, '#a35f4c');
  setColor(lower, '#b06a55');
  setJaw(upper, () => 0);
  setJaw(lower, () => 1);
  return merge([upper, lower]);
}

// Offset shell of the skin grid (beard / hair cap). thick(x,y,z,mask) -> metres. Faces with low mask dropped.
function shell(skin, maskFn, thickFn, { minMask = 0.08, extra = null } = {}) {
  const P = skin.attributes.position, N = skin.attributes.normal;
  const masks = new Float32Array(P.count);
  const g = gridGeometry(NU, NV, (u, v, i, j) => {
    const k = j * (NU + 1) + i;
    const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
    const m = maskFn(x, y, z);
    masks[k] = m;
    const t = thickFn(x, y, z, m);
    let q = [x + N.getX(k) * t, y + N.getY(k) * t, z + N.getZ(k) * t];
    if (extra) q = extra(q, [x, y, z], m);
    return q;
  }, {
    keepFace: (i, j, quad) => quad.some((k) => masks[k] > minMask) && quad.filter((k) => masks[k] > 0.02).length >= 3,
    poleNormals: [[NV, [0, 1, 0]]],
    uv: (u, v, p) => [u * 7, p[1] * 9],
  });
  g.userData.masks = masks;
  return g;
}

function buildBeard(skin) {
  return shell(skin, beardMask, (x, y, z, m) => {
    const ax = Math.abs(x);
    let t = 0.0075 + 0.006 * smoothstep(0.0, -0.05, y) + 0.003 * smoothstep(0.03, 0.06, ax);
    const must = smoothstep(0.024, 0.006, y) * smoothstep(0.03, 0.0, ax) * smoothstep(-0.003, 0.004, y - HEAD.mouthY);
    t = lerp(t, 0.0055, must);
    t += 0.0018 * noise1(x * 400 + y * 300);
    return Math.max(0.0012, t * smoothstep(0.0, 0.5, m));
  }, {
    extra: (q, base, m) => {
      const [x, y, z] = base;
      const ax = Math.abs(x);
      // fuller beard below the chin: grow downward and a little forward
      const below = smoothstep(-0.035, -0.068, y) * smoothstep(-0.03, 0.03, z - ZO) * (1 - (ax / 0.07) ** 2);
      q[1] -= 0.024 * below * m;
      q[2] += 0.006 * below * m;
      // moustache droops over the mouth corners
      const corner = Math.exp(-(((ax - 0.021) / 0.008) ** 2 + ((y - HEAD.mouthY - 0.003) / 0.006) ** 2));
      q[1] -= 0.0035 * corner * m;
      q[2] += 0.0015 * corner * m;
      return q;
    },
  });
}

function buildHairCap(skin) {
  return shell(skin, hairMask, (x, y, z, m) => {
    const ax = Math.abs(x);
    let t = 0.011 + 0.010 * smoothstep(0.0, 0.15, y);
    // centre part groove (front-top)
    if (z - ZO > -0.04) t *= lerp(0.4, 1, smoothstep(0.0, 0.016, ax) + smoothstep(0.11, 0.06, y));
    t += 0.0018 * Math.sin(Math.atan2(x, z) * 16 + y * 50);
    return Math.max(0.0015, t * smoothstep(0.0, 0.45, m));
  }, { minMask: 0.1 });
}

// Long hair: falls from the sides/back of the head to the shoulders.
function buildHairCurtain() {
  const PHI = 112 * DEG;
  const nu = 56, nv = 26;
  const yTop = 0.10;
  const g = gridGeometry(nu, nv, (u, v) => {
    const s = u;
    const th = Math.PI + (s - 0.5) * 2 * PHI;
    const as = Math.abs(Math.sin(th));
    const yBot = lerp(-0.168, -0.083, smoothstep(0.35, 0.95, as)) + 0.010 * Math.sin(s * 41) + 0.006 * Math.sin(s * 97);
    const y = lerp(yTop, yBot, Math.pow(v, 0.95));
    const yc = Math.max(y, 0.035);
    const b = sculpt(slice(th, yc));
    let x = b[0], z = b[2] - ZO;
    const r0 = Math.hypot(x, z);
    const dirx = x / r0, dirz = z / r0;
    const below = Math.max(0, 0.035 - y);
    let r = r0 + 0.021 + 0.004 * smoothstep(0.1, 0.0, y) + below * lerp(0.07, 0.24, as);
    // locks & waves (stronger toward the tips)
    const tip = smoothstep(0.05, -0.12, y);
    r += 0.0045 * Math.sin(s * Math.PI * 2 * 9 + 0.6) * (0.3 + tip) + 0.003 * Math.sin(y * 75 + s * 13) * tip;
    x = dirx * r; z = dirz * r;
    // waves sideways
    x += 0.004 * Math.sin(y * 60 + s * 5) * tip;
    // front edges: bring forward a little to frame the face
    const edge = smoothstep(0.75, 0.98, Math.abs(s - 0.5) * 2);
    z += 0.012 * edge * smoothstep(0.06, -0.05, y);
    return [x, y, z + ZO];
  }, { flip: true, wrapU: false, uv: (u, v) => [u * 7, v * 1.6] });
  return g;
}

function buildBrow(side) {
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = side * lerp(0.0115, 0.0575, t);
    const y = 0.0868 + 0.0072 * Math.sin(Math.PI * Math.pow(t, 0.8)) - 0.002 * t;
    const z = faceZ(x, y) + 0.0012;
    pts.push({ p: new THREE.Vector3(x, y, z), rx: lerp(0.0042, 0.0022, t * t), rz: 0.0022, side: new THREE.Vector3(0, 1, 0), t });
  }
  return pts;
}

function browGeometry(pts, raiseInner, raiseOuter) {
  const q = pts.map((P) => {
    const dy = lerp(raiseInner, raiseOuter, P.t);
    const p = P.p.clone();
    p.y += dy;
    p.z = faceZ(p.x, p.y) + 0.0013;
    return { ...P, p };
  });
  return loftTube(q, 6);
}

// Eyelid cap shell around the eye centre: cap around +Y with given polar length; colour skin, lash line dark.
function lidGeometry(r, lenDeg, lower) {
  const g = new THREE.SphereGeometry(r, 22, 9, 0, Math.PI * 2, 0, lenDeg * DEG);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const skin = SKIN_BASE.clone().lerp(new THREE.Color('#b87556'), 0.35);
  const lash = new THREE.Color('#2a160d');
  for (let i = 0; i < p.count; i++) {
    const polar = Math.acos(clamp(p.getY(i) / r, -1, 1)) / DEG;
    const c = skin.clone().lerp(lash, smoothstep(lenDeg - 14, lenDeg - 3, polar) * (lower ? 0.55 : 0.92));
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

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: T.skin, roughness: 0.62, metalness: 0 });
  skinMat.emissive = new THREE.Color('#3a1206'); skinMat.emissiveIntensity = 0.18; // warm "subsurface" lift
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.hair, roughness: 0.68, side: THREE.DoubleSide });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.beard, roughness: 0.78 });
  const browMat = new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.85 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#2a0d0a', roughness: 0.9 });
  const teethMat = new THREE.MeshStandardMaterial({ color: '#e6ddcc', roughness: 0.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ map: T.eye, emissive: 0xffffff, emissiveMap: T.eyeEmissive, emissiveIntensity: 1.6, roughness: 0.22 });

  // --- skin (head + nose + lips merged) ---
  const headSkin = buildSkin();
  const beardGeo = buildBeard(headSkin);
  const capGeo = buildHairCap(headSkin);
  setJaw(headSkin, jawWeight);
  const skinGeo = merge([headSkin, setJaw(buildNose(), () => 0), buildLips()]);
  const skin = new THREE.Mesh(skinGeo, skinMat);
  skin.name = 'headSkin';
  group.add(skin);

  const beard = new THREE.Mesh(beardGeo, beardMat);
  beard.name = 'beard';
  group.add(beard);

  const hairCap = new THREE.Mesh(capGeo, hairMat);
  hairCap.name = 'hairCap';
  group.add(hairCap);

  // hair curtain on a pivot so it can sway
  const hairPivot = new THREE.Group();
  hairPivot.position.set(0, 0.10, -0.01);
  group.add(hairPivot);
  const curtain = new THREE.Mesh(buildHairCurtain().translate(0, -0.10, 0.01), hairMat);
  curtain.name = 'hairCurtain';
  hairPivot.add(curtain);

  // --- eyes ---
  const E = HEAD.eye;
  const eyeZ = faceZ(E.x, E.y) - E.r + 0.0072;
  const eyeGroups = [];
  const eyeGeo = new THREE.SphereGeometry(E.r, 26, 18).rotateX(Math.PI / 2);
  for (const sx of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * E.x, E.y, eyeZ);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.castShadow = false;
    pivot.add(eye);
    group.add(pivot);
    eyeGroups.push(pivot);
  }
  // lids: upper (cap around +Y) and lower (cap around -Y), both eyes merged per lid; rotate around the shared X axis.
  const lidR = E.r * 1.06;
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
  const MHW = 0.0172, THW = 0.0118;
  const mouthRest = [];
  for (let i = 0; i <= MC; i++) {
    const x = lerp(-MHW, MHW, i / MC);
    mouthRest.push({ x, z: faceZ(x, HEAD.mouthY) });
  }

  // --- jaw deformation data ---
  const deformables = [skinGeo, beardGeo].map((g) => {
    const P = g.attributes.position, N = g.attributes.normal, J = g.attributes.jw;
    const ids = [], w = [];
    if (J) for (let i = 0; i < P.count; i++) if (J.getX(i) > 1e-3) { ids.push(i); w.push(J.getX(i)); }
    return { g, ids, w, p0: Float32Array.from(P.array), n0: Float32Array.from(N.array) };
  });
  // beard weights should come from the underlying skin point: recompute with beard-specific lookup
  {
    const d = deformables[1];
    const masks = beardGeo.userData.masks;
    const Ps = headSkin.attributes.position;
    d.ids = []; d.w = [];
    for (let k = 0; k < beardGeo.attributes.position.count; k++) {
      if (k >= Ps.count || masks[k] <= 0) continue;
      const jw = jawWeight(Ps.getX(k), Ps.getY(k), Ps.getZ(k));
      if (jw > 1e-3) { d.ids.push(k); d.w.push(jw); }
    }
  }

  const jawQ = new THREE.Quaternion();
  const tmp = new THREE.Vector3(), tmpN = new THREE.Vector3();
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
        const rn = tmpN.clone().applyQuaternion(jawQ);
        tmpN.lerp(rn, w).normalize();
        N.setXYZ(i, tmpN.x, tmpN.y, tmpN.z);
      }
      P.needsUpdate = true; N.needsUpdate = true;
    }
    // mouth opening: lens between the upper lip line and the (rotated) lower lip line
    const mp = mouthGeo.attributes.position, tp = teethGeo.attributes.position;
    const ym = HEAD.mouthY;
    const teethH = 0.0052 * smoothstep(0.42, 0.85, open);
    for (let i = 0; i <= MC; i++) {
      const { x, z } = mouthRest[i];
      const e = 1 - (x / MHW) ** 2;
      const lens = Math.pow(Math.max(0, e), 0.55);
      const top = ym + 0.0010 * lens;
      const bot = jawPoint(x, ym - 0.0011 * lens - 0.0002, z, 1, v3);
      const zf = z + 0.0010;
      mp.setXYZ(i, x, top, zf);
      // lower edge: follow the jaw but keep the corners closed
      mp.setXYZ(MC + 1 + i, x, lerp(top, bot.y, lens), lerp(zf, bot.z + 0.001, lens));
      // teeth (upper incisors): narrower strip under the upper lip
      const tx = x * (THW / MHW);
      const te = Math.pow(Math.max(0, 1 - (tx / THW) ** 2), 0.35);
      const tz = faceZ(tx, ym) + 0.0016;
      tp.setXYZ(i, tx, ym + 0.0008, tz);
      tp.setXYZ(MC + 1 + i, tx, ym + 0.0008 - teethH * te, tz - 0.0006);
    }
    mp.needsUpdate = true; tp.needsUpdate = true;
    mouthGeo.computeVertexNormals(); teethGeo.computeVertexNormals();
    teeth.visible = teethH > 0.0003;
  }

  // lids
  const lid = { blink: 0, smile: 0 };
  function applyLids() {
    const b = clamp(lid.blink, 0, 1), s = clamp(lid.smile, 0, 1);
    upperLid.rotation.x = (lerp(-26, 14, b) + 3 * s) * DEG;
    lowerLid.rotation.x = (lerp(32, 27, b) - 6 * s) * DEG;
  }
  function setBlink(v) { lid.blink = v; applyLids(); }
  function setEyes(yawDeg = 0, pitchDeg = 0) {
    for (const g of eyeGroups) g.rotation.set(clamp(-pitchDeg, -25, 25) * DEG, clamp(yawDeg, -35, 35) * DEG, 0);
  }
  let browState = [0, 0];
  function setExpression({ smile = 0, brow = 0 } = {}) {
    lid.smile = smile; applyLids();
    const inner = 0.0028 * brow, outer = -0.0006 * brow + 0.0006 * smile;
    if (Math.abs(inner - browState[0]) + Math.abs(outer - browState[1]) > 1e-5) {
      browState = [inner, outer];
      brows.geometry.dispose();
      brows.geometry = merge([browGeometry(browPts[0], inner, outer), browGeometry(browPts[1], inner, outer)]);
    }
  }

  setMouth(0); setBlink(0); setEyes(0, 0);

  for (const m of [skin, beard, hairCap, curtain]) { m.castShadow = true; m.receiveShadow = true; }
  for (const m of [brows, mouth, teeth, upperLid, lowerLid]) m.receiveShadow = true;
  eyeGroups.forEach((g) => g.children[0].receiveShadow = false);

  return {
    group, hairPivot, setMouth, setBlink, setEyes, setExpression,
    materials: { skinMat, hairMat, beardMat },
    meshes: { skin, beard, hairCap, curtain, brows, mouth, teeth, upperLid, lowerLid },
  };
}
