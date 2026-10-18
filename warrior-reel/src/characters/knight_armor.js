// Plate harness of the knight, modelled per bone in bone-local space (see rig.js conventions).
// Joint pieces (pauldrons, couters, poleyns, tassets) hang on "follower" nodes that take a fraction of
// a bone's rotation, so plates slide over each other instead of snapping with one bone.
import * as THREE from 'three';
import { Kit, PAL, shellGeo, shellPoint, bandGeo, profile, tf, rivetAt } from './knight_geo.js';
import { DEG, smoothstep, clamp } from '../core/util.js';

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qI = new THREE.Quaternion();

// Object3D whose local rotation = slerp(identity, src.quaternion (or its inverse, or the average of two
// sources), f). Evaluated whenever the matrix updates, so it always matches the current pose.
export class Follower extends THREE.Object3D {
  constructor(src, f, { invert = false, src2 = null } = {}) {
    super();
    this.src = src; this.src2 = src2; this.f = f; this.invert = invert;
  }
  updateMatrix() {
    _qa.copy(this.src.quaternion);
    if (this.src2) _qa.slerp(this.src2.quaternion, 0.5);
    if (this.invert) _qa.invert();
    this.quaternion.copy(_qI).slerp(_qa, this.f);
    super.updateMatrix();
  }
}

const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Rectangular buckle frame (brass) facing +Z at the origin; w x h.
function buckleGeos(w = 0.034, h = 0.03, th = 0.0045) {
  const out = [];
  const bar = (sx, sy, x, y) => { const g = new THREE.BoxGeometry(sx, sy, th); g.translate(x, y, 0); out.push(g); };
  bar(w, th, 0, h / 2); bar(w, th, 0, -h / 2); bar(th, h, w / 2, 0); bar(th, h, -w / 2, 0);
  const prong = new THREE.BoxGeometry(0.0035, h * 0.95, th * 0.8); prong.translate(0, 0, th * 0.4); out.push(prong);
  return out;
}
// place a set of geometries using a matrix built from a surface point & normal (z-axis = normal, y = up hint)
function placeOn(geos, p, n, up = new THREE.Vector3(0, 1, 0), rollDeg = 0) {
  const z = n.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);
  if (rollDeg) m.multiply(new THREE.Matrix4().makeRotationZ(rollDeg * DEG));
  return geos.map((g) => g.applyMatrix4(m));
}

export function buildArmor(rig, material) {
  const kit = new Kit(material);
  kit.rimScale = 0.85;
  const B = rig.b, d = rig.d;
  const fol = {};

  // ======================= TORSO =======================
  // --- breastplate + backplate (chest bone) ---
  const breast = {
    nU: 36, nV: 12, aoTop: 0.08,
    prof: profile([
      { t: 0.0, y: -0.075, rx: 0.150, rzF: 0.116, rzB: 0.11, cz: 0.0, sq: 2.25 },
      { t: 0.2, y: -0.01, rx: 0.162, rzF: 0.13, rzB: 0.116, cz: 0.004, sq: 2.25 },
      { t: 0.45, y: 0.07, rx: 0.177, rzF: 0.145, rzB: 0.121, cz: 0.006, sq: 2.3 },
      { t: 0.68, y: 0.15, rx: 0.181, rzF: 0.137, rzB: 0.123, cz: 0.004, sq: 2.3 },
      { t: 0.85, y: 0.205, rx: 0.163, rzF: 0.118, rzB: 0.116, cz: 0.0, sq: 2.2 },
      { t: 1.0, y: 0.255, rx: 0.105, rzF: 0.085, rzB: 0.09, cz: -0.01, sq: 2.0 },
    ]),
    // medial ridge (keel) on the front, fading at top/bottom; faint ridge on the backplate spine
    disp: (th, t) => 0.011 * gauss(th, 0.15) * smoothstep(0.0, 0.25, t) * (1 - smoothstep(0.75, 1.0, t))
      + 0.004 * gauss(wrapPi(th - Math.PI), 0.12) * smoothstep(0.1, 0.4, t) * (1 - smoothstep(0.7, 0.95, t)),
  };
  kit.shell(B.chest, breast, PAL.steel, { rim: 0.0065 });
  // plackart-like upper ridge line: subtle lighter bevel band around the waist of the breastplate
  kit.add(B.chest, bandGeo(breast, 0.075, 0.105, -Math.PI, Math.PI, 0.003, 36), PAL.steelD);
  // side straps with buckles holding breast & back plates (under the arms)
  for (const sx of [1, -1]) {
    const thc = sx * Math.PI / 2;
    kit.add(B.chest, bandGeo(breast, 0.30, 0.37, thc - 0.32, thc + 0.32, 0.0035, 6), PAL.strap);
    const { p, n } = shellPoint(breast, thc + sx * 0.12, 0.335);
    for (const g of placeOn(buckleGeos(0.026, 0.024, 0.004), p.addScaledVector(n, 0.005), n)) kit.add(B.chest, g, PAL.brass);
  }
  // rivets along the bottom edge (front)
  for (const th of [-0.9, -0.45, 0.45, 0.9]) { const { p, n } = shellPoint(breast, th, 0.035); kit.add(B.chest, rivetAt(p, n, 0.0055), PAL.rivet); }

  // --- gorget (chest + neck) ---
  const gor1 = {
    nU: 28, nV: 3, aoTop: 0.0, aoBot: 0.0,
    prof: profile([
      { t: 0, y: 0.188, rx: 0.18, rzF: 0.136, rzB: 0.13, cz: 0.0 },
      { t: 1, y: 0.248, rx: 0.13, rzF: 0.104, rzB: 0.106, cz: -0.008 },
    ]),
  };
  kit.shell(B.chest, gor1, PAL.steel, { rim: 0.005 });
  const gor2 = {
    nU: 28, nV: 3, aoTop: 0.0, aoBot: 0.2,
    prof: profile([
      { t: 0, y: 0.232, rx: 0.134, rzF: 0.108, rzB: 0.11, cz: -0.006 },
      { t: 1, y: 0.292, rx: 0.1, rzF: 0.09, rzB: 0.092, cz: -0.012 },
    ]),
  };
  kit.shell(B.chest, gor2, PAL.steel, { rim: 0.0045 });
  const gor3 = {
    nU: 24, nV: 3, aoBot: 0.25, aoTop: 0,
    prof: profile([
      { t: 0, y: -0.02, rx: 0.103, rzF: 0.094, rzB: 0.096, cz: -0.008 },
      { t: 1, y: 0.055, rx: 0.09, rzF: 0.086, rzB: 0.088, cz: -0.004 },
    ]),
  };
  kit.shell(B.neck, gor3, PAL.steel, { rim: 0.0045 });
  // mail collar under the gorget
  { const g = new THREE.CylinderGeometry(0.078, 0.085, 0.14, 14, 1, true); g.translate(0, 0.03, -0.005); kit.add(B.neck, g, PAL.mail); }

  // --- waist lame (spine bone) ---
  const waist = {
    nU: 32, nV: 3, aoTop: 0.35, aoW: 0.5,
    prof: profile([
      { t: 0, y: 0.005, rx: 0.153, rzF: 0.119, rzB: 0.112, cz: 0.003, sq: 2.2 },
      { t: 1, y: 0.1, rx: 0.144, rzF: 0.109, rzB: 0.104, cz: 0.002, sq: 2.2 },
    ]),
    disp: (th, t) => 0.006 * gauss(th, 0.14),
  };
  kit.shell(B.spine, waist, PAL.steelD, { rim: 0.005 });
  // dark padded body under everything (fills any gap at waist / armpits)
  { const g = new THREE.SphereGeometry(1, 16, 12); g.applyMatrix4(tf([0, 0.07, 0], [0, 0, 0], [0.145, 0.15, 0.108])); kit.add(B.spine, g, PAL.pad); }
  { const g = new THREE.SphereGeometry(1, 18, 12); g.applyMatrix4(tf([0, 0.1, 0.0], [0, 0, 0], [0.15, 0.19, 0.1])); kit.add(B.chest, g, PAL.pad); }

  // ======================= HIPS =======================
  const hipsY = 0; // hips-local
  // belt
  const belt = {
    nU: 32, nV: 2, aoTop: 0, aoBot: 0,
    prof: profile([
      { t: 0, y: 0.018, rx: 0.164, rzF: 0.128, rzB: 0.122, cz: 0.004, sq: 2.2 },
      { t: 1, y: 0.064, rx: 0.16, rzF: 0.125, rzB: 0.119, cz: 0.004, sq: 2.2 },
    ]),
  };
  kit.shell(B.hips, belt, PAL.strap, { rim: 0.0028, rimSpec: { ...PAL.strap, color: 0x4a2d18 } });
  { // brass buckle front (slightly off-centre, as worn) + belt tip
    const { p, n } = shellPoint(belt, 0.06, 0.5);
    for (const g of placeOn(buckleGeos(0.058, 0.05, 0.0065), p.clone().addScaledVector(n, 0.004), n)) kit.add(B.hips, g, PAL.brass);
    const tip = new THREE.BoxGeometry(0.05, 0.034, 0.005);
    placeOn([tip], shellPoint(belt, 0.32, 0.5).p.addScaledVector(n, 0.002), shellPoint(belt, 0.32, 0.5).n);
    kit.add(B.hips, tip, PAL.strap, { bright: 0.85 });
  }
  // padded breeches / hip volume + mail skirt (sides & back)
  { const g = new THREE.SphereGeometry(1, 16, 12); g.applyMatrix4(tf([0, -0.05, -0.005], [0, 0, 0], [0.158, 0.125, 0.118])); kit.add(B.hips, g, PAL.pad); }
  const skirt = {
    nU: 24, nV: 3, th0: 55 * DEG, th1: 305 * DEG, aoTop: 0.3,
    prof: profile([{ t: 0, y: -0.15, rx: 0.188, rzB: 0.15, rzF: 0.15, cz: -0.005 }, { t: 1, y: 0.02, rx: 0.162, rzB: 0.12, rzF: 0.12, cz: 0.0 }]),
  };
  kit.shell(B.hips, skirt, PAL.mail, { rim: 0 });
  // faulds (sides and back; the front is carried by the tassets which ride on the thighs)
  for (let k = 0; k < 2; k++) {
    const y0 = 0.022 - k * 0.05, y1 = y0 - 0.062;
    const f = {
      nU: 24, nV: 3, th0: (82 + k * 4) * DEG, th1: (278 - k * 4) * DEG, aoTop: 0.25,
      prof: profile([
        { t: 0, y: y1, rx: 0.192 + k * 0.012, rzB: 0.15 + k * 0.01, rzF: 0.15, cz: -0.004 },
        { t: 1, y: y0, rx: 0.172 + k * 0.012, rzB: 0.132 + k * 0.01, rzF: 0.13, cz: -0.002 },
      ]),
    };
    kit.shell(B.hips, f, PAL.steel, { rim: 0.0045 });
  }
  // front mail flap between the tassets (follows the average of both thighs)
  fol.flap = new Follower(B.thighL, 0.62, { src2: B.thighR });
  fol.flap.position.set(0, -0.04, 0); B.hips.add(fol.flap);
  {
    const g = shellGeo({ nU: 8, nV: 3, th0: -0.42, th1: 0.42, aoTop: 0.4, aoW: 0.6, prof: profile([{ t: 0, y: -0.115, rx: 0.13, rz: 0.118 }, { t: 1, y: 0.07, rx: 0.125, rz: 0.114 }]) });
    kit.add(fol.flap, g, { ...PAL.mail, color: 0x45423e });
  }

  // ======================= LEGS =======================
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const thigh = B['thigh' + s], shin = B['shin' + s], foot = B['foot' + s];
    // --- tassets on a follower that takes 90% of the thigh rotation ---
    const ft = new Follower(thigh, 0.9); ft.position.copy(thigh.position); B.hips.add(ft); fol['tasset' + s] = ft;
    const tasTh0 = sx > 0 ? -60 * DEG : -108 * DEG, tasTh1 = sx > 0 ? 108 * DEG : 60 * DEG;
    const tasR = [0.122, 0.112, 0.103];
    for (let k = 0; k < 3; k++) {
      const top = 0.062 - k * 0.07, bot = top - 0.084;
      const o = {
        nU: 18, nV: 3, th0: tasTh0, th1: tasTh1, aoTop: k === 0 ? 0.1 : 0.3,
        prof: profile([
          { t: 0, y: bot, rx: tasR[k] - 0.004, rzF: tasR[k] + 0.006, rzB: tasR[k] - 0.006, cx: sx * 0.012, cz: 0.014 },
          { t: 1, y: top, rx: tasR[k], rzF: tasR[k] + 0.002, rzB: tasR[k] - 0.004, cx: sx * 0.014, cz: 0.01 },
        ]),
        disp: (th, t) => 0.004 * gauss(th - sx * 0.25, 0.25),
      };
      kit.shell(ft, o, PAL.steel, { rim: 0.0045 });
      if (k === 0) for (const th of [sx * 0.2, sx * 1.4]) { const { p, n } = shellPoint(o, th, 0.82); kit.add(ft, rivetAt(p, n, 0.0055), PAL.rivet); }
    }
    // leather strap hanging the tasset from the belt
    {
      const o = { prof: profile([{ t: 0, y: 0.0, rx: 0.124, rzF: 0.126, rzB: 0.12, cx: sx * 0.014, cz: 0.012 }, { t: 1, y: 0.07, rx: 0.123, rzF: 0.125, rzB: 0.12, cx: sx * 0.014, cz: 0.012 }]) };
      kit.add(ft, bandGeo(o, 0, 1, sx * 0.55 - 0.1, sx * 0.55 + 0.1, 0.004, 3), PAL.strap);
    }
    // --- under-layer (mail) ---
    { const g = new THREE.CylinderGeometry(0.086, 0.062, 0.47, 12, 1, true); g.translate(0, -0.235, -0.004); kit.add(thigh, g, PAL.mail); }
    { const g = new THREE.SphereGeometry(0.066, 12, 8); g.translate(0, 0, -0.004); kit.add(shin, g, PAL.mail); }
    { const g = new THREE.CylinderGeometry(0.06, 0.042, 0.45, 12, 1, true); g.translate(0, -0.225, -0.006); kit.add(shin, g, PAL.mail); }
    // --- cuisse (open at the back) ---
    const cuisse = {
      nU: 22, nV: 6, th0: -145 * DEG, th1: 145 * DEG, aoTop: 0.25,
      prof: profile([
        { t: 0, y: -0.405, rx: 0.077, rzF: 0.083, rzB: 0.074, cz: 0.006 },
        { t: 0.5, y: -0.27, rx: 0.09, rzF: 0.094, rzB: 0.085, cz: 0.006 },
        { t: 1, y: -0.13, rx: 0.097, rzF: 0.1, rzB: 0.09, cz: 0.004 },
      ]),
      disp: (th, t) => 0.006 * gauss(th, 0.22),
    };
    kit.shell(thigh, cuisse, PAL.steel, { rim: 0.005 });
    // leather strap round the back of the thigh
    for (const tt of [0.3, 0.75]) {
      const o = { prof: (t) => { const p = cuisse.prof(tt + (t - 0.5) * 0.08); return { ...p, rx: p.rx - 0.008, rzB: p.rzB - 0.004, rzF: p.rzF - 0.008 }; } };
      kit.add(thigh, bandGeo(o, 0, 1, 130 * DEG, 230 * DEG, 0.002, 8), PAL.strap);
    }
    // lame above the knee (front half)
    const kneeTop = {
      nU: 16, nV: 2, th0: -105 * DEG, th1: 105 * DEG, aoTop: 0.3,
      prof: profile([{ t: 0, y: -0.452, rx: 0.078, rzF: 0.086, cz: 0.008 }, { t: 1, y: -0.395, rx: 0.079, rzF: 0.084, cz: 0.008 }]),
    };
    kit.shell(thigh, kneeTop, PAL.steel, { rim: 0.0042 });
    // --- poleyn on a half-angle follower at the knee ---
    const fk = new Follower(shin, 0.5, { invert: true }); shin.add(fk); fol['knee' + s] = fk;
    const cap = {
      nU: 20, nV: 6, aoTop: 0, aoBot: 0,
      prof: profile([
        { t: 0, y: 0.0, rx: 0.07, rz: 0.074 },
        { t: 0.5, y: 0.028, rx: 0.056, rz: 0.06 },
        { t: 0.85, y: 0.043, rx: 0.03, rz: 0.032 },
        { t: 1, y: 0.047, rx: 0.0, rz: 0.0 },
      ]),
      // vertical medial ridge on the knee cop (the dome's θ = ±90° maps to up/down after rotation? no: θ=0 -> -Y)
      disp: (th, t) => 0.007 * (gauss(wrapPi(th), 0.22) + gauss(wrapPi(th - Math.PI), 0.22)) * smoothstep(0.1, 0.7, t) * (1 - 0.6 * t),
    };
    // dome axis (local Y) -> +Z (front of the knee)
    kit.shell(fk, cap, PAL.steel, { rim: 0.005, edges: ['bottom'], matrix: tf([0, -0.005, 0.03], [90, 0, 0]) });
    const wing = {
      nU: 16, nV: 3, aoTop: 0, aoBot: 0,
      prof: profile([{ t: 0, y: 0, rx: 0.052, rz: 0.06 }, { t: 0.7, y: 0.012, rx: 0.03, rz: 0.035 }, { t: 1, y: 0.015, rx: 0, rz: 0 }]),
    };
    kit.shell(fk, wing, PAL.steel, { rim: 0.0045, edges: ['bottom'], matrix: tf([sx * 0.07, -0.004, 0.0], [0, 0, -sx * 90]) });
    { const { p, n } = { p: new THREE.Vector3(sx * 0.087, -0.004, 0.0), n: new THREE.Vector3(sx, 0, 0) }; kit.add(fk, rivetAt(p, n, 0.008), PAL.rivet); }
    // lame below the knee (on the shin)
    const kneeBot = {
      nU: 16, nV: 2, th0: -105 * DEG, th1: 105 * DEG, aoTop: 0.0, aoBot: 0.2,
      prof: profile([{ t: 0, y: -0.085, rx: 0.075, rzF: 0.079, cz: 0.006 }, { t: 1, y: -0.035, rx: 0.078, rzF: 0.083, cz: 0.008 }]),
    };
    kit.shell(shin, kneeBot, PAL.steel, { rim: 0.0042 });
    // --- greave ---
    const greave = {
      nU: 24, nV: 7, aoTop: 0.2,
      prof: profile([
        { t: 0, y: -0.405, rx: 0.054, rzF: 0.055, rzB: 0.057, cz: 0.0 },
        { t: 0.25, y: -0.33, rx: 0.058, rzF: 0.06, rzB: 0.065, cz: 0.0 },
        { t: 0.6, y: -0.2, rx: 0.067, rzF: 0.066, rzB: 0.083, cz: 0.0 },
        { t: 0.85, y: -0.12, rx: 0.071, rzF: 0.071, rzB: 0.078, cz: 0.002 },
        { t: 1, y: -0.07, rx: 0.073, rzF: 0.074, rzB: 0.073, cz: 0.003 },
      ]),
      disp: (th, t) => 0.007 * gauss(th, 0.2),
    };
    kit.shell(shin, greave, PAL.steel, { rim: 0.005 });
    // --- sabaton (foot bone; sole at y = -ankle) ---
    const soleY = -d.ankle;
    // shell axis Y -> foot +Z, shell front (θ=0) -> +Y (up): matrix maps (x,y,z) -> (-x, z, y)
    const sabM = new THREE.Matrix4().set(-1, 0, 0, 0, 0, 0, 1, soleY, 0, 1, 0, 0, 0, 0, 0, 1);
    const sab = {
      nU: 18, nV: 9, th0: -112 * DEG, th1: 112 * DEG, aoTop: 0, aoBot: 0,
      prof: profile([
        { t: 0, y: -0.09, rx: 0.046, rzF: 0.084, rzB: 0.01, sq: 2.6 },
        { t: 0.14, y: -0.062, rx: 0.053, rzF: 0.118, rzB: 0.01, sq: 2.6 },
        { t: 0.38, y: 0.03, rx: 0.057, rzF: 0.096, rzB: 0.01, sq: 2.7 },
        { t: 0.62, y: 0.115, rx: 0.055, rzF: 0.066, rzB: 0.01, sq: 2.6 },
        { t: 0.84, y: 0.19, rx: 0.046, rzF: 0.046, rzB: 0.008, sq: 2.4 },
        { t: 1, y: 0.24, rx: 0.016, rzF: 0.024, rzB: 0.005, sq: 2.2 },
      ]),
    };
    kit.shell(foot, sab, PAL.steel, { rim: 0.0045, edges: ['bottom', 'left', 'right'], matrix: sabM });
    for (const tt of [0.4, 0.52, 0.64, 0.76]) {
      const g = bandGeo(sab, tt, tt + 0.03, -100 * DEG, 100 * DEG, 0.003, 14);
      g.applyMatrix4(sabM); kit.add(foot, g, PAL.steelD);
    }
    { // leather sole following the sabaton outline (heel to toe)
      const sh = new THREE.Shape();
      const outline = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, pr = sab.prof(t); outline.push([pr.rx * 0.98, pr.y]); }
      sh.moveTo(-outline[0][0], outline[0][1]);
      for (const [w, z] of outline) sh.lineTo(-w, z);
      for (let i = outline.length - 1; i >= 0; i--) sh.lineTo(outline[i][0], outline[i][1]);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false });
      g.rotateX(Math.PI / 2); // shape (x, y=z_foot) -> foot XZ plane, extruded downward
      g.translate(0, soleY + 0.014, 0);
      kit.add(foot, g, PAL.pad);
    }
    // mail at the ankle
    { const g = new THREE.SphereGeometry(0.058, 10, 8); g.translate(0, 0.0, -0.005); kit.add(foot, g, PAL.mail); }
  }

  // ======================= ARMS =======================
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = B['shoulder' + s], ua = B['upperArm' + s], fa = B['foreArm' + s];
    // under-layer: leather arming sleeve (upper arm), padded forearm
    { const g = new THREE.CylinderGeometry(0.066, 0.054, 0.3, 12, 1, true); g.translate(0, -0.13, 0); kit.add(ua, g, PAL.leather); }
    { const g = new THREE.SphereGeometry(0.068, 12, 9); kit.add(ua, g, PAL.leather); }
    { const g = new THREE.SphereGeometry(0.05, 10, 8); g.translate(0, -0.31, 0); kit.add(ua, g, PAL.pad); }
    { const g = new THREE.CylinderGeometry(0.05, 0.031, 0.25, 12, 1, true); g.translate(0, -0.13, 0); kit.add(fa, g, PAL.pad); }
    // --- pauldron dome on a follower (60% of the upper-arm rotation) ---
    const fp = new Follower(ua, 0.6); sh.add(fp); fol['pauldron' + s] = fp;
    const dome = {
      nU: 30, nV: 8, aoTop: 0, aoBot: 0,
      prof: profile([
        { t: 0, y: -0.07, rx: 0.114, rzF: 0.11, rzB: 0.114, cx: sx * 0.026 },
        { t: 0.35, y: -0.005, rx: 0.121, rzF: 0.117, rzB: 0.12, cx: sx * 0.02 },
        { t: 0.7, y: 0.052, rx: 0.098, rzF: 0.093, rzB: 0.096, cx: sx * 0.01 },
        { t: 0.9, y: 0.08, rx: 0.056, rzF: 0.052, rzB: 0.054, cx: sx * 0.003 },
        { t: 1, y: 0.089, rx: 0.0, rzF: 0.0, rzB: 0.0, cx: 0 },
      ]),
      warp: (p, th, t) => { // droop the outer edge, lift the inner edge
        const o = Math.sin(th) * sx;
        p.y += (1 - t) * (o > 0 ? -0.03 * o : 0.035 * -o);
      },
      disp: (th, t) => 0.006 * gauss(wrapPi(th - sx * Math.PI / 2), 0.25) * smoothstep(0.2, 0.8, t),
    };
    kit.shell(fp, dome, PAL.steel, { rim: 0.0062 });
    // strap running down the outside of the pauldron, with a buckle
    kit.add(fp, bandGeo(dome, 0.12, 0.88, sx * Math.PI / 2 - 0.12, sx * Math.PI / 2 + 0.12, 0.0035, 2), PAL.strap);
    { const { p, n } = shellPoint(dome, sx * Math.PI / 2, 0.42); for (const g of placeOn(buckleGeos(0.028, 0.024, 0.0042), p.addScaledVector(n, 0.006), n)) kit.add(fp, g, PAL.brass); }
    for (const th of [0.35, 2.8]) { const { p, n } = shellPoint(dome, sx * th, 0.3); kit.add(fp, rivetAt(p, n, 0.006), PAL.rivet); }
    // --- lames under the dome (follow the upper arm fully) ---
    const lTh0 = sx > 0 ? -48 * DEG : -228 * DEG, lTh1 = sx > 0 ? 228 * DEG : 48 * DEG;
    for (let k = 0; k < 3; k++) {
      const top = -0.05 - k * 0.04, bot = top - 0.052, r = 0.105 - k * 0.008;
      const o = {
        nU: 22, nV: 3, th0: lTh0, th1: lTh1, aoTop: 0.35,
        prof: profile([
          { t: 0, y: bot, rx: r + 0.004, rzF: r + 0.002, rzB: r + 0.004, cx: sx * (0.018 - k * 0.004) },
          { t: 1, y: top, rx: r - 0.004, rzF: r - 0.006, rzB: r - 0.004, cx: sx * (0.018 - k * 0.004) },
        ]),
        warp: (p, th, t) => { const o2 = Math.sin(th) * sx; p.y += o2 > 0 ? -0.012 * o2 : 0.0; },
      };
      kit.shell(ua, o, PAL.steel, { rim: 0.0048 });
    }
    // --- rerebrace + strap ---
    const rere = {
      nU: 20, nV: 3, aoTop: 0.2,
      prof: profile([{ t: 0, y: -0.268, rx: 0.065, rzF: 0.067, rzB: 0.069 }, { t: 1, y: -0.165, rx: 0.069, rzF: 0.071, rzB: 0.073 }]),
    };
    kit.shell(ua, rere, PAL.steel, { rim: 0.0045 });
    kit.add(ua, bandGeo(rere, 0.68, 0.86, -Math.PI, Math.PI, 0.003, 20), PAL.strap);
    { const { p, n } = shellPoint(rere, sx * 0.35, 0.77); for (const g of placeOn(buckleGeos(0.022, 0.02, 0.0038), p.addScaledVector(n, 0.004), n)) kit.add(ua, g, PAL.brass); }
    // lame over the elbow joint (upper arm side)
    kit.shell(ua, {
      nU: 18, nV: 2, aoTop: 0.3,
      prof: profile([{ t: 0, y: -0.315, rx: 0.064, rz: 0.068, cz: -0.004 }, { t: 1, y: -0.262, rx: 0.066, rz: 0.07, cz: -0.002 }]),
    }, PAL.steel, { rim: 0.004 });
    // --- couter on a half-angle follower ---
    const fe = new Follower(fa, 0.5, { invert: true }); fa.add(fe); fol['elbow' + s] = fe;
    const cup = {
      nU: 18, nV: 5, aoTop: 0, aoBot: 0,
      prof: profile([{ t: 0, y: 0.0, rx: 0.062, rz: 0.066 }, { t: 0.55, y: 0.036, rx: 0.046, rz: 0.05 }, { t: 0.9, y: 0.052, rx: 0.018, rz: 0.02 }, { t: 1, y: 0.055, rx: 0, rz: 0 }]),
    };
    // dome axis -> -Z (point of the elbow)
    kit.shell(fe, cup, PAL.steel, { rim: 0.0045, edges: ['bottom'], matrix: tf([0, 0.0, -0.022], [-90, 0, 0]) });
    kit.shell(fe, {
      nU: 14, nV: 3, aoTop: 0, aoBot: 0,
      prof: profile([{ t: 0, y: 0, rx: 0.044, rz: 0.052 }, { t: 0.7, y: 0.011, rx: 0.026, rz: 0.03 }, { t: 1, y: 0.014, rx: 0, rz: 0 }]),
    }, PAL.steel, { rim: 0.004, edges: ['bottom'], matrix: tf([sx * 0.056, 0.0, -0.012], [0, 0, -sx * 90]) });
    kit.add(fe, rivetAt(new THREE.Vector3(sx * 0.071, 0, -0.012), new THREE.Vector3(sx, 0, 0), 0.0065), PAL.rivet);
    // lame below the elbow (forearm side)
    kit.shell(fa, {
      nU: 18, nV: 2, aoBot: 0.25, aoTop: 0,
      prof: profile([{ t: 0, y: -0.06, rx: 0.06, rz: 0.064 }, { t: 1, y: -0.012, rx: 0.063, rz: 0.067, cz: -0.002 }]),
    }, PAL.steel, { rim: 0.004 });
    // --- vambrace ---
    const vamb = {
      nU: 22, nV: 5, aoTop: 0.25,
      prof: profile([
        { t: 0, y: -0.255, rx: 0.037, rzF: 0.044, rzB: 0.045 },
        { t: 0.45, y: -0.16, rx: 0.049, rzF: 0.055, rzB: 0.058 },
        { t: 1, y: -0.05, rx: 0.057, rzF: 0.061, rzB: 0.064 },
      ]),
      disp: (th, t) => 0.004 * gauss(wrapPi(th - sx * Math.PI / 2), 0.25),
    };
    kit.shell(fa, vamb, PAL.steel, { rim: 0.0045 });
  }

  // ======================= HEAD (armet / great-helm) =======================
  const H = B.head;
  const skull = {
    nU: 40, nV: 10, aoTop: 0, aoBot: 0,
    prof: profile([
      { t: 0, y: 0.116, rx: 0.128, rzF: 0.142, rzB: 0.136, cz: 0.012 },
      { t: 0.3, y: 0.19, rx: 0.131, rzF: 0.141, rzB: 0.138, cz: 0.012 },
      { t: 0.62, y: 0.255, rx: 0.111, rzF: 0.118, rzB: 0.118, cz: 0.008 },
      { t: 0.86, y: 0.284, rx: 0.068, rzF: 0.072, rzB: 0.074, cz: 0.004 },
      { t: 1, y: 0.296, rx: 0, rzF: 0, rzB: 0, cz: 0.0 },
    ]),
  };
  kit.shell(H, skull, PAL.steel, { rim: 0.0045, edges: ['bottom'] });
  // brow reinforce band
  kit.add(H, bandGeo(skull, 0.0, 0.1, -Math.PI, Math.PI, 0.0025, 40), PAL.steelD);
  // back and cheek plates (sides + back, below the skull)
  const nape = {
    nU: 30, nV: 5, th0: 58 * DEG, th1: 302 * DEG, aoTop: 0.35,
    prof: profile([
      { t: 0, y: -0.06, rx: 0.115, rzB: 0.128, rzF: 0.12, cz: 0.004 },
      { t: 0.35, y: 0.0, rx: 0.122, rzB: 0.13, rzF: 0.13, cz: 0.008 },
      { t: 1, y: 0.13, rx: 0.126, rzB: 0.134, rzF: 0.138, cz: 0.012 },
    ]),
    warp: (p, th, t) => { const b = Math.max(0, -Math.cos(th)); p.z -= 0.012 * b * (1 - t) * (1 - t); },
  };
  kit.shell(H, nape, PAL.steel, { rim: 0.0045, edges: ['bottom', 'left', 'right'] });
  // visor: pointed "sparrow-beak", central ridge
  const beak = (th, t) => {
    const prof = t < 0.42 ? 0.3 + 0.7 * smoothstep(0, 0.42, t) : 1 - 0.78 * smoothstep(0.42, 1, t);
    return 0.06 * Math.exp(-Math.abs(th) / 0.32) * prof + 0.011 * gauss(th, 0.055) * smoothstep(0.0, 0.25, t);
  };
  const visor = {
    nU: 36, nV: 9, th0: -100 * DEG, th1: 100 * DEG, aoTop: 0, aoBot: 0,
    prof: profile([
      { t: 0, y: -0.072, rx: 0.108, rzF: 0.1, cz: 0.012 },
      { t: 0.3, y: -0.022, rx: 0.127, rzF: 0.13, cz: 0.012 },
      { t: 0.62, y: 0.04, rx: 0.134, rzF: 0.143, cz: 0.014 },
      { t: 1, y: 0.098, rx: 0.134, rzF: 0.146, cz: 0.014 },
    ]),
    disp: beak,
  };
  kit.shell(H, visor, PAL.steel, { rim: 0.0045 });
  // dark helmet interior seen through the sight and breaths
  { const g = new THREE.SphereGeometry(1, 16, 12); g.applyMatrix4(tf([0, 0.1, 0.01], [0, 0, 0], [0.118, 0.15, 0.128])); kit.add(H, g, PAL.void); }
  // breaths: rows of dark slots on both cheeks of the visor
  for (const sgn of [1, -1]) for (let k = 0; k < 4; k++) {
    const th = sgn * (0.42 + k * 0.17), tt = 0.36;
    const { p, n } = shellPoint(visor, th, tt);
    const slot = new THREE.BoxGeometry(0.0072, 0.034, 0.01);
    placeOn([slot], p.addScaledVector(n, -0.0042), n);
    kit.add(H, slot, PAL.void);
  }
  // sight divider ridge (a vertical bar in the middle of the eye slit)
  { const { p, n } = shellPoint(visor, 0, 1); const g = new THREE.BoxGeometry(0.012, 0.03, 0.012); placeOn([g], p.add(new THREE.Vector3(0, 0.009, 0.004)), n); kit.add(H, g, PAL.steel); }
  // comb / crest: a rounded ridge along the sagittal line, highest over the crown
  {
    const N = 26, pts = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N;
      const th = a < 0.5 ? 0 : Math.PI;
      const t = a < 0.5 ? 0.06 + (a / 0.5) * 0.94 : 1 - ((a - 0.5) / 0.5) * 0.9;
      const { p, n } = shellPoint(skull, th, Math.min(t, 0.999));
      const h = 0.0035 + 0.0075 * Math.pow(Math.sin(Math.PI * a), 0.8);
      pts.push(p.addScaledVector(n, h));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 40, 0.0075, 6, false);
    g.scale(0.85, 1, 1);
    kit.add(H, g, PAL.steel, { bright: 1.05 });
  }
  // visor pivots
  for (const sgn of [1, -1]) {
    const g = new THREE.SphereGeometry(0.018, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sgn * 0.131, 0.104, -0.004), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sgn, 0, 0)), new THREE.Vector3(1, 0.42, 1)));
    kit.add(H, g, PAL.steel, { bright: 1.05 });
    kit.add(H, rivetAt(new THREE.Vector3(sgn * 0.138, 0.104, -0.004), new THREE.Vector3(sgn, 0, 0), 0.006), PAL.rivet);
  }
  // rivets along the brow and the nape
  for (let k = -3; k <= 3; k++) { if (k === 0) continue; const { p, n } = shellPoint(skull, k * 0.42, 0.05); kit.add(H, rivetAt(p, n, 0.0045), PAL.rivet); }

  const meshes = kit.build({ name: 'knight' });
  return { meshes, followers: fol, tris: kit.tris };
}
