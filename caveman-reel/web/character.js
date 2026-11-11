// Procedural rigged caveman: skinned body lofts, one-shoulder spotted tunic, leather boots,
// articulated hands, two-bone IK for arms and legs, and a pose/expression layer.
import * as THREE from 'three';
import { V3, clamp, lerp, ss, rng, noise3, canvasTex, noiseFill, loft, tube, mesh, TAU, deg, wob } from './util.js';
import { buildHead, cutMaterial } from './head.js';

export const HERO = {
  seed: 1, skin: '#dfa57c', hair: '#3f2717', hairHi: '#86572f', hairLo: '#20120a', beard: '#3b2416', beardHi: '#66432a', beardLo: '#1c1008',
  eye: '#7b4b1f', hairStyle: 'wavy', beardStyle: 'neat', tunicA: '#a9672c', tunicB: '#4a2811', tunicHi: '#cf9450', boot: '#7d4b2a', bootDark: '#40241275',
  build: 1.0, belly: 0, headScale: 1.07, scale: 1, face: { jaw: 1.03, chin: 1.1, brow: 1.0 }, strap: 1,
};
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperArmL', 'foreArmL', 'handL', 'clavR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const REST = {
  hips: [0, 0.985, 0], spine: [0, 1.10, 0], chest: [0, 1.27, 0], neck: [0, 1.525, -0.008], head: [0, 1.615, 0],
  clavL: [0.04, 1.475, 0], upperArmL: [0.212, 1.468, -0.006], foreArmL: [0.212, 1.173, -0.006], handL: [0.212, 0.911, -0.006],
  thighL: [0.094, 0.955, 0], shinL: [0.094, 0.50, 0], footL: [0.094, 0.08, 0],
};
for (const k of ['clav', 'upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot']) { const p = REST[k + 'L']; REST[k + 'R'] = [-p[0], p[1], p[2]]; }
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', clavL: 'chest', upperArmL: 'clavL', foreArmL: 'upperArmL', handL: 'foreArmL', clavR: 'chest', upperArmR: 'clavR', foreArmR: 'upperArmR', handR: 'foreArmR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
export const UPPER = 0.295, FORE = 0.262, THIGH = 0.455, SHIN = 0.42, ANKLE = 0.08;

function tunicTex(P) {
  return canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, P.tunicA, P.tunicA, 4, 3, 40);
    const R = rng(41 + P.seed);
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.18 + 0.4 * R(); g.strokeStyle = R() < 0.5 ? P.tunicHi : P.tunicB; g.lineWidth = 1 + R() * 1.6; const x = R() * w, y = R() * h, l = 20 + R() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 6, y + l); g.stroke(); if (y + l > h) { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y + l - h); g.stroke(); } }
    g.globalAlpha = 1; g.fillStyle = P.tunicB;
    for (let i = 0; i < 15; i++) {            // irregular dark spots
      const cx = R() * w, cy = R() * h; const n = 3 + (R() * 4 | 0);
      for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) {
        const R2 = rng(i * 13 + 5);
        for (let k = 0; k < n; k++) { g.globalAlpha = 0.92; g.beginPath(); g.ellipse(cx + ox + (R2() - 0.5) * 46, cy + oy + (R2() - 0.5) * 50, 13 + R2() * 20, 10 + R2() * 17, R2() * 3, 0, TAU); g.fill(); }
      }
    }
    g.globalAlpha = 1;
  });
}

function skinByRing(geo, ringW, bi) {
  const ring = geo.attributes.ring; const n = ring.count; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { const rw = ringW[ring.getX(v) | 0]; let tot = 0; rw.forEach(([, w]) => tot += w); rw.forEach(([b, w], k) => { si[v * 4 + k] = bi[b]; sw[v * 4 + k] = w / tot; }); }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setAttribute('rest', new THREE.Float32BufferAttribute(geo.attributes.position.array.slice(), 3));
  return geo;
}
const FINGER_PRESET = {
  relax: { c: [0.22, 0.30, 0.36, 0.42], s: 0.04, t: 0.25, to: 0.1 },
  fist: { c: [1, 1, 1, 1], s: 0, t: 0.95, to: 0.75 },
  point: { c: [0.0, 1, 1, 1], s: 0, t: 0.85, to: 0.8 },
  open: { c: [0.04, 0.02, 0.04, 0.06], s: 0.28, t: 0.0, to: -0.35 },
  flat: { c: [0, 0, 0, 0], s: 0.02, t: 0.1, to: 0 },
  grip: { c: [0.80, 0.82, 0.84, 0.86], s: 0, t: 0.6, to: 0.6 },
  pinch: { c: [0.50, 0.62, 0.92, 0.95], s: 0, t: 0.50, to: 0.9 },
  phone: { c: [0.46, 0.5, 0.52, 0.55], s: 0.02, t: 0.18, to: 0.25 },
  thumb: { c: [1, 1, 1, 1], s: 0, t: -0.25, to: -0.7 },
  cup: { c: [0.42, 0.45, 0.48, 0.5], s: 0.06, t: 0.3, to: 0.4 },
};
export const fingers = (f) => typeof f === 'string' ? FINGER_PRESET[f] : (f || FINGER_PRESET.relax);

function makeHand(side, skinMat) {
  const g = new THREE.Group(); const w = new THREE.Group(); w.scale.x = side; g.add(w);     // built as a left hand, mirrored for the right
  const palm = mesh(loft([
    { c: [0, 0.010, 0], rx: 0.0215, rz: 0.0295, pw: 2.2 }, { c: [0, -0.024, 0.002], rx: 0.0170, rz: 0.0385, pw: 2.8 },
    { c: [0, -0.062, 0.001], rx: 0.0140, rz: 0.0430, pw: 3.2 }, { c: [0, -0.088, 0], rx: 0.0115, rz: 0.0410, pw: 3.2 }].reverse(), 14), skinMat);
  w.add(palm);
  const fdef = [[0.0300, -0.088, 0.070, 0.0094], [0.0100, -0.092, 0.078, 0.0097], [-0.0100, -0.089, 0.072, 0.0092], [-0.0288, -0.081, 0.056, 0.0082]];
  const fj = [];
  fdef.forEach(([z, y, len, r], i) => {
    const j = []; let parent = w; const seg = [0.46, 0.30, 0.24];
    for (let k = 0; k < 3; k++) {
      const jt = new THREE.Group(); jt.position.set(k === 0 ? -0.001 : 0, k === 0 ? y : -len * seg[k - 1], k === 0 ? z : 0);
      const L = len * seg[k]; const rr = r * (1 - k * 0.07);
      const m = mesh(new THREE.CapsuleGeometry(rr, L, 4, 10), skinMat, { pos: [0, -L / 2, 0] }); jt.add(m);
      parent.add(jt); parent = jt; j.push(jt);
    }
    fj.push(j);
  });
  const tb = new THREE.Group(); tb.position.set(-0.004, -0.030, 0.034); w.add(tb);
  const t1 = new THREE.Group(); tb.add(t1); t1.add(mesh(new THREE.CapsuleGeometry(0.0118, 0.036, 4, 10), skinMat, { pos: [0, -0.018, 0] }));
  const t2 = new THREE.Group(); t2.position.set(0, -0.040, 0); t1.add(t2); t2.add(mesh(new THREE.CapsuleGeometry(0.0102, 0.027, 4, 10), skinMat, { pos: [0, -0.0135, 0] }));
  const set = (f) => {
    f = fingers(f);
    for (let i = 0; i < 4; i++) {
      const c = Array.isArray(f.c) ? f.c[i] : f.c; const j = fj[i];
      j[0].rotation.set((1.5 - i) * (f.s ?? 0) * 0.42, 0, -c * 1.42); j[1].rotation.z = -c * 1.72; j[2].rotation.z = -c * 1.05;
    }
    const t = f.t ?? 0.2, to = f.to ?? 0;
    tb.rotation.set(-0.95 + to * 0.35, 0.0 + to * 0.9, -0.30 - Math.max(0, to) * 0.55, 'YXZ'); t1.rotation.z = -t * 0.45; t2.rotation.z = -t * 1.1;
  };
  set('relax');
  return { g, set };
}

function makeBoot(P, mats) {
  const g = new THREE.Group();
  const upper = mesh(loft([
    { c: [0, -0.066, 0.044], rx: 0.050, rzf: 0.128, rzb: 0.070, pw: 2.5 },
    { c: [0, -0.040, 0.044], rx: 0.054, rzf: 0.134, rzb: 0.074, pw: 2.5 },
    { c: [0, -0.012, 0.040], rx: 0.052, rzf: 0.118, rzb: 0.070, pw: 2.4 },
    { c: [0, 0.016, 0.022], rx: 0.049, rzf: 0.082, rzb: 0.062, pw: 2.2 },
    { c: [0, 0.045, 0.006], rx: 0.050, rzf: 0.062, rzb: 0.058, pw: 2.1 },
    { c: [0, 0.085, 0.0], rx: 0.055, rzf: 0.062, rzb: 0.060, pw: 2.0 },
    { c: [0, 0.128, -0.002], rx: 0.059, rzf: 0.065, rzb: 0.063, pw: 2.0 },
  ], 20), mats.boot);
  g.add(upper);
  const sole = mesh(loft([
    { c: [0, -0.080, 0.044], rx: 0.053, rzf: 0.133, rzb: 0.074, pw: 2.5 },
    { c: [0, -0.062, 0.044], rx: 0.056, rzf: 0.137, rzb: 0.077, pw: 2.5 }], 20), mats.bootDark);
  g.add(sole);
  const cuff = mesh(loft([{ c: [0, 0.088, 0.0], rx: 0.0615, rzf: 0.0690, rzb: 0.0665, pw: 2.0 }, { c: [0, 0.100, 0.0], rx: 0.0660, rzf: 0.0735, rzb: 0.0710, pw: 2.0 }, { c: [0, 0.126, -0.001], rx: 0.0665, rzf: 0.0735, rzb: 0.0715, pw: 2.0 }, { c: [0, 0.136, -0.002], rx: 0.0620, rzf: 0.0685, rzb: 0.0665, pw: 2.0 }], 20), mats.bootCuff);
  g.add(cuff);
  return g;
}

/** Build a caveman. Returns { root, bones, apply(pose), head, ... } */
export function makeCaveman(opts = {}) {
  const P = { ...HERO, ...opts, face: { ...HERO.face, ...(opts.face || {}) } };
  const B = P.build, belly = P.belly;
  const root = new THREE.Group(); root.name = 'caveman';
  const bones = {}; const bi = {};
  BONES.forEach((n, i) => { const b = new THREE.Bone(); b.name = n; bones[n] = b; bi[n] = i; });
  BONES.forEach((n) => { const par = PARENT[n]; const p = REST[n]; if (par) { const q = REST[par]; bones[n].position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]); bones[par].add(bones[n]); } else { bones[n].position.set(...p); root.add(bones[n]); } });
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(BONES.map(n => bones[n]));
  const skinC = new THREE.Color(P.skin);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.62, emissive: 0x3a160c, emissiveIntensity: 0.16 }),
    boot: new THREE.MeshStandardMaterial({ color: P.boot, roughness: 0.78 }),
    bootDark: new THREE.MeshStandardMaterial({ color: new THREE.Color(P.boot).multiplyScalar(0.45), roughness: 0.9 }),
    bootCuff: new THREE.MeshStandardMaterial({ color: new THREE.Color(P.boot).multiplyScalar(1.28), roughness: 0.85 }),
  };
  const ttex = tunicTex(P);
  const tun = (rx, ry) => { const t = ttex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide }); };
  const addSkinned = (geo, mat, cast = true) => { const m = new THREE.SkinnedMesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; root.add(m); m.bind(skel); return m; };

  // ---- torso ----
  const TR = [
    [0.845, 0.050, 0.050, 0.055, 2.0, 0], [0.875, 0.120, 0.088, 0.100, 2.2, 0], [0.925, 0.164, 0.104, 0.118, 2.3, 0], [0.985, 0.165, 0.102, 0.113, 2.3, 0],
    [1.05, 0.150, 0.094 + belly, 0.098, 2.3, 0.002], [1.11, 0.139, 0.090 + belly * 1.25, 0.092, 2.3, 0.004], [1.18, 0.146, 0.095 + belly, 0.094, 2.35, 0.006],
    [1.25, 0.160, 0.105 + belly * 0.5, 0.100, 2.4, 0.008], [1.32, 0.174, 0.114, 0.106, 2.45, 0.009], [1.385, 0.183, 0.116, 0.108, 2.45, 0.008],
    [1.435, 0.186, 0.108, 0.104, 2.4, 0.004], [1.475, 0.174, 0.092, 0.096, 2.3, 0.0], [1.503, 0.128, 0.074, 0.082, 2.2, -0.004],
    [1.525, 0.080, 0.063, 0.068, 2.1, -0.006], [1.548, 0.066, 0.062, 0.064, 2.0, -0.005], [1.60, 0.062, 0.060, 0.062, 2.0, -0.002], [1.665, 0.058, 0.056, 0.058, 2.0, 0.002],
  ];
  const wTorso = (y) => {
    const h = 1 - ss(0.99, 1.10, y), s = ss(0.99, 1.10, y) * (1 - ss(1.15, 1.30, y)), c = ss(1.15, 1.30, y) * (1 - ss(1.505, 1.555, y)), n = ss(1.505, 1.555, y) * (1 - ss(1.585, 1.64, y)), hd = ss(1.585, 1.64, y);
    return [['hips', h], ['spine', s], ['chest', c], ['neck', n], ['head', hd]].filter(e => e[1] > 0.001).sort((a, b2) => b2[1] - a[1]).slice(0, 4);
  };
  const torsoRings = (grow, yMax = 9) => TR.filter(r => r[0] <= yMax).map(([y, rx, rzf, rzb, pw, cz]) => ({ c: [0, y, cz], rx: (rx * (y < 1.5 ? B : 1)) + grow, rzf: rzf * (y < 1.5 ? (0.5 + 0.5 * B) : 1) + grow, rzb: rzb * (y < 1.5 ? (0.5 + 0.5 * B) : 1) + grow, pw }));
  { // skin torso with pecs / collarbone
    const rings = torsoRings(0); const geo = loft(rings, 40);
    const p = geo.attributes.position; const gsf = (v, s) => Math.exp(-(v / s) * (v / s));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (z <= 0) continue; const ax = Math.abs(x);
      let d = 0.013 * gsf(ax - 0.088, 0.062) * gsf(y - 1.368, 0.050) * B;        // pecs
      d -= 0.004 * gsf(x, 0.014) * gsf(y - 1.37, 0.07);                           // sternum
      d += 0.004 * gsf(y - 1.487, 0.010) * ss(0.02, 0.06, ax) * (1 - ss(0.13, 0.17, ax));   // collarbones
      p.setZ(i, z + d * ss(0, 0.04, z));
    }
    geo.computeVertexNormals();
    skinByRing(geo, rings.map(r => wTorso(r.c[1])), bi); addSkinned(geo, mats.skin);
  }
  { // tunic body (one shoulder), cut diagonally in the shader
    const rings = torsoRings(0.0125, 1.53); const geo = loft(rings, 40, { capTop: false });
    skinByRing(geo, rings.map(r => wTorso(r.c[1])), bi);
    const s = P.strap;
    const m = cutMaterial(tun(3, 2), `bool cutAway(vec3 r){
      float x = r.x * ${s.toFixed(1)};
      float line = 1.325 + (x + 0.18) * 0.86;
      line = min(line, 1.552);
      float rag = 0.005*sin(r.x*95.0 + r.z*40.0) + 0.004*sin(r.z*140.0);
      if (x > 0.105) { line = 1.56; }
      return r.y > line + rag; }`, 'tunic' + s);
    addSkinned(geo, m, false);
  }
  // ---- arms ----
  const AR = [[0.064, 0.020], [0.053, 0.046], [0.031, 0.062], [0.0, 0.068], [-0.04, 0.0665], [-0.09, 0.061], [-0.14, 0.058], [-0.19, 0.0535], [-0.24, 0.0465], [-0.275, 0.0425], [-0.295, 0.0418], [-0.315, 0.0440], [-0.36, 0.0468], [-0.42, 0.0420], [-0.49, 0.0340], [-0.535, 0.0295], [-0.560, 0.0280]];
  const wArm = (dy, s) => { const u = 1 - ss(-0.325, -0.265, dy); const U = 'upperArm' + s, F = 'foreArm' + s; return u < 0.001 ? [[U, 1]] : u > 0.999 ? [[F, 1]] : [[U, 1 - u], [F, u]]; };
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = REST['upperArm' + s];
    const rings = AR.map(([dy, r]) => { const k = dy > -0.3 ? (0.55 + 0.45 * B) : (0.7 + 0.3 * B); const wrist = ss(-0.44, -0.55, dy); return { c: [sh[0], sh[1] + dy, sh[2]], rx: r * k * (1 - 0.14 * wrist), rz: r * k * (1.04 + 0.10 * wrist), pw: 2.1 }; }).reverse();
    const geo = loft(rings, 20); skinByRing(geo, rings.map(r => wArm(r.c[1] - sh[1], s)), bi); addSkinned(geo, mats.skin);
    if (sx === P.strap) {  // cap sleeve on the strap shoulder
      const sr = AR.filter(([dy]) => dy <= 0.064 && dy >= -0.10).map(([dy, r]) => ({ c: [sh[0], sh[1] + dy, sh[2]], rx: r * (0.55 + 0.45 * B) + 0.0125, rz: r * (0.55 + 0.45 * B) * 1.04 + 0.0125, pw: 2.1 })).reverse();
      const sg = loft(sr, 20, { capBottom: false });
      skinByRing(sg, sr.map(r => { const dy = r.c[1] - sh[1]; const c = ss(0.0, 0.06, dy) * 0.5; return [['upperArm' + s, 1 - c], ['chest', c]].filter(e => e[1] > 0.001); }), bi);
      addSkinned(sg, cutMaterial(tun(1.5, 0.5), `bool cutAway(vec3 r){ float a = atan(r.z + 0.006, r.x - ${(sh[0]).toFixed(3)}); float zz = abs(fract(a*5.0/6.2832)-0.5)*2.0; return r.y < ${(sh[1] - 0.088).toFixed(3)} + zz*0.024; }`, 'sleeve' + sx), false);
    }
  }
  // ---- legs + shorts ----
  const LR = [[0.05, 0.066], [0.0, 0.084], [-0.06, 0.088], [-0.14, 0.083], [-0.24, 0.072], [-0.34, 0.061], [-0.42, 0.0545], [-0.455, 0.0535], [-0.49, 0.0525], [-0.55, 0.0555], [-0.62, 0.0565], [-0.70, 0.050], [-0.78, 0.040], [-0.84, 0.036], [-0.878, 0.036]];
  const wLeg = (dy, s) => { const T = 'thigh' + s, S = 'shin' + s; const k = 1 - ss(-0.495, -0.415, dy); const hp = ss(-0.07, 0.05, dy) * 0.55; if (hp > 0.001) return [[T, 1 - hp], ['hips', hp]]; return k < 0.001 ? [[T, 1]] : k > 0.999 ? [[S, 1]] : [[T, 1 - k], [S, k]]; };
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const hp = REST['thigh' + s]; const kb = (0.6 + 0.4 * B) * 1.10;
    const rings = LR.map(([dy, r]) => ({ c: [hp[0], hp[1] + dy, hp[2] + (dy < -0.5 && dy > -0.74 ? -0.008 : 0)], rx: r * kb, rz: r * kb * 1.04, pw: 2.1 })).reverse();
    const geo = loft(rings, 20); skinByRing(geo, rings.map(r => wLeg(r.c[1] - hp[1], s)), bi); addSkinned(geo, mats.skin);
    const sr = LR.filter(([dy]) => dy >= -0.35).map(([dy, r]) => ({ c: [hp[0], hp[1] + dy, hp[2]], rx: r * kb + 0.015, rz: r * kb * 1.04 + 0.015, pw: 2.1 })).reverse();
    const sg = loft(sr, 22, { capBottom: false }); skinByRing(sg, sr.map(r => wLeg(r.c[1] - hp[1], s)), bi);
    addSkinned(sg, cutMaterial(tun(1.5, 0.8), `bool cutAway(vec3 r){ float a = atan(r.z, r.x - ${(hp[0]).toFixed(3)}); float zz = abs(fract(a*6.0/6.2832 + 0.13)-0.5)*2.0; return r.y < ${(hp[1] - 0.262).toFixed(3)} + zz*0.036; }`, 'shorts' + sx), false);
  }
  // ---- boots, hands, head ----
  for (const s of ['L', 'R']) { const b = makeBoot(P, mats); bones['foot' + s].add(b); }
  const hands = { L: makeHand(1, mats.skin), R: makeHand(-1, mats.skin) };
  bones.handL.add(hands.L.g); bones.handR.add(hands.R.g);
  const head = buildHead(P);
  head.group.scale.setScalar(P.headScale); head.group.position.set(0, 0.079 * P.headScale, 0.014); bones.head.add(head.group);
  root.scale.setScalar(P.scale);

  // ---------- posing ----------
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
  const wq = (b) => b.getWorldQuaternion(new THREE.Quaternion());
  const wp = (b) => b.getWorldPosition(V3());
  function limb(Spos, W, pole, l1, l2, leg) {
    const d = W.clone().sub(Spos); let L = d.length(); const maxL = (l1 + l2) * 0.9985; if (L > maxL) { d.multiplyScalar(maxL / L); L = maxL; }
    const minL = Math.abs(l1 - l2) + 0.02; if (L < minL) { d.normalize().multiplyScalar(minL); L = minL; }
    const a = d.clone().normalize(); let p = pole.clone().addScaledVector(a, -pole.dot(a)); if (p.lengthSq() < 1e-8) p.set(0.3, 0, 1).addScaledVector(a, -a.z); p.normalize();
    const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const E = Spos.clone().addScaledVector(a, x).addScaledVector(p, h); const Wc = Spos.clone().add(d);
    const hinge = (leg ? p.clone().cross(a) : a.clone().cross(p)).normalize();
    const basis = (from, to) => { const y = from.clone().sub(to).normalize(); const z = hinge.clone().cross(y).normalize(); const xx = y.clone().cross(z); return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(xx, y, z)); };
    return { qU: basis(Spos, E), qL: basis(E, Wc), E, W: Wc };
  }
  function resolve(spec, sx = 1) {
    if (spec.mix) { const [a, b, w] = spec.mix; return resolve(a, sx).lerp(resolve(b, sx), w); }
    const p = V3(...spec.p); const sp = spec.space || 'chest';
    if (sp === 'world') return p;
    p.x *= sx;
    if (sp === 'root') return root.localToWorld(p);
    const b = bones[sp]; const r = REST[sp]; return b.localToWorld(p.sub(V3(...r)));
  }
  const rs = P.scale;
  function apply(Pz) {
    root.position.set(...Pz.pos); root.rotation.set(0, Pz.yaw || 0, 0); if (Pz.tilt) root.rotation.set(Pz.tilt[0], Pz.yaw || 0, Pz.tilt[1], 'YXZ');
    const h = Pz.hips; bones.hips.position.set(h.x || 0, REST.hips[1] + (h.y || 0), h.z || 0); bones.hips.rotation.set(h.pitch || 0, h.yaw || 0, h.roll || 0, 'YXZ');
    const s = Pz.spine; bones.spine.rotation.set(s.pitch * 0.45, s.yaw * 0.4, s.roll * 0.45, 'YXZ'); bones.chest.rotation.set(s.pitch * 0.55 + (Pz.breath || 0) * -0.02, s.yaw * 0.6, s.roll * 0.55, 'YXZ');
    const hd = Pz.head; bones.neck.rotation.set(hd.pitch * 0.35, hd.yaw * 0.32, hd.roll * 0.3, 'YXZ'); bones.head.rotation.set(hd.pitch * 0.65, hd.yaw * 0.68, hd.roll * 0.7, 'YXZ');
    bones.clavL.rotation.set(0, 0, 0); bones.clavR.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);
    for (const [sd, sx] of [['L', 1], ['R', -1]]) {
      const A = Pz['arm' + sd]; const W = resolve(A, sx);
      const cl = bones['clav' + sd]; const S0 = wp(bones['upperArm' + sd]);
      const up = clamp((W.y - S0.y) / (0.45 * rs), -0.2, 1); cl.rotation.z = sx * (up * 0.32 + (A.shrug || 0) * 0.3);
      cl.updateMatrixWorld(true);
      const Sp = wp(bones['upperArm' + sd]); const cq = wq(bones.chest);
      const pv = A.pole || [0.55, -0.55, -0.75]; const pole = V3(pv[0] * sx, pv[1], pv[2]).applyQuaternion(cq);
      const r = limb(Sp, W, pole, UPPER * rs, FORE * rs, false);
      const ua = bones['upperArm' + sd], fa = bones['foreArm' + sd], hb = bones['hand' + sd];
      ua.quaternion.copy(wq(cl).invert().multiply(r.qU)); fa.quaternion.copy(r.qU.clone().invert().multiply(r.qL));
      hb.rotation.set((A.dev || 0), (A.twist || 0) * sx, -(A.flex || 0) * sx, 'YZX');
      hands[sd].set(A.fingers);
    }
    for (const [sd, sx] of [['L', 1], ['R', -1]]) {
      const F = Pz['foot' + sd]; const th = bones['thigh' + sd], sn = bones['shin' + sd], ft = bones['foot' + sd];
      const fq = new THREE.Quaternion().setFromEuler(_e.set(F.pitch || 0, (F.yaw || 0) * sx, (F.roll || 0) * sx, 'YXZ'));
      const rq = wq(root); const fw = rq.clone().multiply(fq);
      const tgt = root.localToWorld(V3(F.p[0] * sx, F.p[1] + ANKLE, F.p[2]));
      const kp = F.knee || [0.18, 0, 1]; const pole = V3(kp[0] * sx, kp[1], kp[2]).applyQuaternion(rq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), (F.yaw || 0) * sx * 0.6)));
      const r = limb(wp(th), tgt, pole, THIGH * rs, SHIN * rs, true);
      th.quaternion.copy(wq(bones.hips).invert().multiply(r.qU)); sn.quaternion.copy(r.qU.clone().invert().multiply(r.qL));
      ft.quaternion.copy(r.qL.clone().invert().multiply(fw));
    }
    if (Pz.face) head.setFace(Pz.face);
    root.updateMatrixWorld(true);
  }
  return { root, bones, apply, head, hands, P, mats, REST, resolve };
}

// ---------- pose library ----------
const FACE0 = { browL: [0, 0], browR: [0, 0], lid: 1, squint: 0, lidTilt: 0, eye: [0, 0], blink: 0, sparkle: 1, mouth: { smile: 0.18, open: 0, o: 0, smirk: 0, wide: 1, teeth: 1 } };
export const FACE = {
  neutral: {},
  smile: { browL: [0.25, -0.05], browR: [0.25, -0.05], squint: 0.4, lid: 0.95, mouth: { smile: 0.95, open: 0.10 } },
  grin: { browL: [0.4, -0.05], browR: [0.4, -0.05], squint: 0.6, lid: 0.9, mouth: { smile: 1, open: 0.32 } },
  smirk: { browL: [0.75, -0.15], browR: [-0.15, 0.15], lid: 0.86, squint: 0.2, mouth: { smile: 0.5, smirk: 1 } },
  nervous: { browL: [0.55, -0.95], browR: [0.55, -0.95], lid: 1.16, mouth: { smile: -0.5, open: 0.12, wide: 0.92 } },
  shock: { browL: [1.1, -0.35], browR: [1.1, -0.35], lid: 1.3, mouth: { smile: -0.25, open: 0.95, o: 0.7 } },
  annoyed: { browL: [-0.55, 0.9], browR: [-0.55, 0.9], lid: 0.60, lidTilt: 0.7, mouth: { smile: -0.6, wide: 0.9 } },
  think: { browL: [0.7, -0.1], browR: [-0.3, 0.55], lid: 0.92, eye: [0.45, 0.55], mouth: { smile: -0.1, wide: 0.85, smirk: 0.7 } },
  idea: { browL: [1, 0], browR: [1, 0], lid: 1.24, mouth: { smile: 0.85, open: 0.5 } },
  disgust: { browL: [-0.45, 0.75], browR: [-0.2, 0.45], lid: 0.5, squint: 0.9, mouth: { smile: -0.85, open: 0.16, wide: 0.95 } },
  joy: { browL: [0.8, -0.1], browR: [0.8, -0.1], lid: 0.72, squint: 1, mouth: { smile: 1, open: 0.8 } },
  awe: { browL: [0.95, -0.45], browR: [0.95, -0.45], lid: 1.26, sparkle: 1.7, mouth: { smile: 0.55, open: 0.42, o: 0.25 } },
  angry: { browL: [-0.5, 1.2], browR: [-0.5, 1.2], lid: 0.92, lidTilt: 1, mouth: { smile: -0.75, open: 0.18, wide: 1.05 } },
  shout: { browL: [-0.45, 1.25], browR: [-0.45, 1.25], lid: 1.0, lidTilt: 1, mouth: { smile: -0.45, open: 1.15, wide: 1.12 } },
  content: { browL: [0.15, 0], browR: [0.15, 0], lid: 0.56, squint: 0.45, eye: [0, -0.5], mouth: { smile: 0.62 } },
  effort: { browL: [-0.5, 0.7], browR: [-0.5, 0.7], lid: 0.8, squint: 0.5, mouth: { smile: -0.2, open: 0.3, wide: 1.05 } },
  bored: { browL: [-0.1, 0], browR: [-0.1, 0], lid: 0.55, mouth: { smile: -0.35 } },
};
export function deepMix(a, b, w) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, w);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => deepMix(v, b[i] ?? v, w));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = k in a ? (k in b ? deepMix(a[k], b[k], w) : a[k]) : b[k]; return o; }
  return w < 0.5 ? a : b;
}
export const face = (name, over) => { const f = deepMerge(deepMerge(FACE0, typeof name === 'string' ? FACE[name] : name), over || {}); return f; };
export function deepMerge(a, b) {
  if (!b) return a; const o = Array.isArray(a) ? a.slice() : { ...a };
  for (const k of Object.keys(b)) { const v = b[k]; o[k] = (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], v) : v; }
  return o;
}
const armRest = (sx) => ({ p: [0.265, 0.925, 0.035], space: 'chest', pole: [0.6, -0.4, -0.75], twist: 0, flex: 0.08, dev: 0, fingers: 'relax', shrug: 0 });
export const STAND = {
  pos: [0, 0, 0], yaw: 0, breath: 0,
  hips: { x: 0, y: -0.012, z: 0, pitch: 0, yaw: 0, roll: 0 }, spine: { pitch: 0, yaw: 0, roll: 0 }, head: { pitch: 0, yaw: 0, roll: 0 },
  armL: armRest(1), armR: armRest(-1),
  footL: { p: [0.105, 0, 0], yaw: 0.2, pitch: 0, roll: 0, knee: [0.2, 0, 1] }, footR: { p: [0.105, 0, 0], yaw: 0.2, pitch: 0, roll: 0, knee: [0.2, 0, 1] },
  face: FACE0,
};
function normPose(p) {
  const o = deepMerge(STAND, p);
  for (const k of ['armL', 'armR']) { const A = o[k]; A.fingers = fingers(A.fingers); if (A.p.length === 3) A.p = A.p.slice(); }
  return o;
}
export const pose = (over) => normPose(over || {});
/** blend two (normalised) poses; arm targets in different spaces are blended in world space at apply time */
export function mixPose(a, b, w) {
  if (w <= 0) return a; if (w >= 1) return b;
  const o = deepMix(a, b, w);
  for (const k of ['armL', 'armR']) {
    const A = a[k], Bq = b[k];
    if (A.mix || Bq.mix || (A.space || 'chest') !== (Bq.space || 'chest')) { o[k] = { ...deepMix({ ...A, p: [0, 0, 0], mix: 0, space: 0 }, { ...Bq, p: [0, 0, 0], mix: 0, space: 0 }, w), mix: [A, Bq, w] }; delete o[k].p; delete o[k].space; o[k].fingers = deepMix(fingers(A.fingers), fingers(Bq.fingers), w); }
  }
  return o;
}
/** subtle life: breathing, weight shift, micro head motion, blinks, eye darts. Deterministic in t. */
export function alive(p, t, seed = 1, amt = 1) {
  const o = deepMerge(p, {}); const br = Math.sin(t * 1.9 + seed);
  o.breath = br * amt;
  o.hips = { ...o.hips, x: o.hips.x + 0.006 * amt * wob(t, seed, 0.35), y: o.hips.y + 0.003 * amt * br, roll: o.hips.roll + 0.012 * amt * wob(t, seed + 1, 0.3) };
  o.spine = { ...o.spine, pitch: o.spine.pitch + 0.012 * amt * br, yaw: o.spine.yaw + 0.02 * amt * wob(t, seed + 2, 0.4), roll: o.spine.roll + 0.012 * amt * wob(t, seed + 3, 0.33) };
  o.head = { ...o.head, pitch: o.head.pitch + 0.025 * amt * wob(t, seed + 4, 0.6) - 0.008 * br * amt, yaw: o.head.yaw + 0.035 * amt * wob(t, seed + 5, 0.5), roll: o.head.roll + 0.02 * amt * wob(t, seed + 6, 0.45) };
  for (const k of ['armL', 'armR']) { const A = o[k]; if (!A.mix && A.p) o[k] = { ...A, p: [A.p[0] + 0.006 * amt * wob(t, seed + 7 + (k === 'armL' ? 0 : 3), 0.6), A.p[1] + 0.004 * amt * br, A.p[2] + 0.008 * amt * wob(t, seed + 9, 0.5)] }; }
  // blink
  const period = 2.9 + (seed % 5) * 0.31; const ph = ((t + seed * 0.77) % period) / period; const bl = ph < 0.045 ? Math.sin(ph / 0.045 * Math.PI) : 0;
  const f = o.face || FACE0;
  o.face = { ...f, blink: Math.max(f.blink || 0, bl), eye: [(f.eye?.[0] || 0) + 0.06 * wob(Math.floor(t * 1.3), seed + 11, 1), (f.eye?.[1] || 0) + 0.04 * wob(Math.floor(t * 1.3), seed + 12, 1)] };
  return o;
}
