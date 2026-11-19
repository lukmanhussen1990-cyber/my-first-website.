/**
 * Procedural engine geometry — extrusions, lathes and custom half-pipes.
 * The static housing is cut at the z = 0 plane (classic cutaway); moving
 * parts (piston, rod, crank, valves, cams, plug) are modelled whole.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAM_Y, ENGINE as E, camRadius } from './kinematics';

type P2 = [number, number];
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

// ── Paths ───────────────────────────────────────────────────────────────
export function samplePath(ctrl: P2[], n: number) {
  return new THREE.SplineCurve(ctrl.map(([x, y]) => V2(x, y))).getSpacedPoints(n);
}

export function leftNormals(pts: THREE.Vector2[]) {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    return V2(-t.y, t.x);
  });
}

/** Keep the part of a polyline on one side of x = limit, inserting the exact crossing. */
export function clipAtX(pts: THREE.Vector2[], limit: number, keepAbove: boolean) {
  const inside = (p: THREE.Vector2) => (keepAbove ? p.x >= limit : p.x <= limit);
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (inside(p)) {
      out.push(p.clone());
      continue;
    }
    if (i > 0 && inside(pts[i - 1])) {
      const a = pts[i - 1];
      const f = (limit - a.x) / (p.x - a.x);
      out.push(V2(limit, a.y + (p.y - a.y) * f));
    }
    break;
  }
  return out;
}

/** Index of the first sample whose |x| passes `limit` (to split ports from external pipes). */
export const splitIndex = (pts: THREE.Vector2[], limit: number) => {
  const i = pts.findIndex((p) => Math.abs(p.x) >= limit);
  return i < 0 ? pts.length - 1 : i;
};

// Port centrelines (side −1 = intake, +1 = exhaust). They start at the valve seat.
export const portCtrl = (s: number): P2[] => [
  [s * E.valveX, E.roofY],
  [s * E.valveX, 2.55],
  [s * 0.4, 2.7],
  [s * 0.56, 2.83],
  [s * 0.79, 2.9],
  [s * 1.05, 2.93],
  [s * 1.12, 2.935],
];

/** Intake: port → runner → up to the velocity-stack funnel. */
export const INTAKE_CTRL: P2[] = [
  ...portCtrl(-1).slice(0, 6),
  [-1.4, 2.98],
  [-1.68, 3.15],
  [-1.82, 3.45],
  [-1.86, 3.85],
  [-1.86, 4.05],
];
export const FUNNEL_BASE = V2(-1.86, 4.05);

/** Exhaust: port → header → long pipe running right (the camera follows it). */
export const EXHAUST_CTRL: P2[] = [
  ...portCtrl(1).slice(0, 6),
  [1.45, 2.95],
  [1.85, 2.78],
  [2.15, 2.38],
  [2.6, 2.02],
  [3.4, 1.9],
  [6.0, 1.9],
  [9.0, 1.9],
  [13.5, 1.9],
];

// ── Half pipe (back half of a tube, cut at z = 0) ──────────────────────
/**
 * Groups: 0 = inner surface, 1 = outer surface, 2 = cut rims / end caps.
 * Inner normals point toward the axis so FrontSide materials work everywhere.
 */
export function halfPipeGeometry(
  pts: THREE.Vector2[],
  o: { rIn: number; rOut?: number; radial?: number; outer?: boolean; rims?: boolean; capStart?: boolean; capEnd?: boolean },
) {
  const radial = o.radial ?? 20;
  const rIn = o.rIn;
  const rOut = o.rOut ?? rIn + 0.04;
  const ns = leftNormals(pts);
  const N = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const geo = new THREE.BufferGeometry();
  const dir = (k: number, j: number) => {
    const phi = (Math.PI * j) / radial;
    const c = Math.cos(phi);
    return [c * ns[k].x, c * ns[k].y, -Math.sin(phi)];
  };
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(u, v);
    return pos.length / 3 - 1;
  };

  const surface = (r: number, sign: 1 | -1) => {
    const base = pos.length / 3;
    for (let k = 0; k < N; k++) {
      for (let j = 0; j <= radial; j++) {
        const d = dir(k, j);
        push(pts[k].x + r * d[0], pts[k].y + r * d[1], r * d[2], sign * d[0], sign * d[1], sign * d[2], k / (N - 1), j / radial);
      }
    }
    for (let k = 0; k < N - 1; k++) {
      for (let j = 0; j < radial; j++) {
        const a = base + k * (radial + 1) + j;
        const b = a + radial + 1;
        const c = a + 1;
        const d = b + 1;
        if (sign > 0) idx.push(a, b, c, c, b, d);
        else idx.push(a, c, b, c, d, b);
      }
    }
  };

  let start = 0;
  surface(rIn, -1);
  geo.addGroup(start, idx.length - start, 0);
  start = idx.length;
  if (o.outer) {
    surface(rOut, 1);
    geo.addGroup(start, idx.length - start, 1);
    start = idx.length;
  }
  if (o.rims) {
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let k = 0; k < N; k++) {
        const n = ns[k];
        push(pts[k].x + side * rIn * n.x, pts[k].y + side * rIn * n.y, 0, 0, 0, 1, 0, 0);
        push(pts[k].x + side * rOut * n.x, pts[k].y + side * rOut * n.y, 0, 0, 0, 1, 1, 0);
      }
      for (let k = 0; k < N - 1; k++) {
        const a = base + k * 2;
        const b = a + 1;
        const a2 = a + 2;
        const b2 = a + 3;
        if (side > 0) idx.push(a, a2, b, b, a2, b2);
        else idx.push(a, b, a2, b, b2, a2);
      }
    }
    const cap = (k: number, facing: 1 | -1) => {
      const t = pts[Math.min(N - 1, k + 1)].clone().sub(pts[Math.max(0, k - 1)]).normalize();
      const base = pos.length / 3;
      for (let j = 0; j <= radial; j++) {
        const d = dir(k, j);
        push(pts[k].x + rIn * d[0], pts[k].y + rIn * d[1], rIn * d[2], facing * t.x, facing * t.y, 0, 0, 0);
        push(pts[k].x + rOut * d[0], pts[k].y + rOut * d[1], rOut * d[2], facing * t.x, facing * t.y, 0, 1, 0);
      }
      for (let j = 0; j < radial; j++) {
        const i0 = base + j * 2;
        const o0 = i0 + 1;
        const i1 = i0 + 2;
        const o1 = i0 + 3;
        if (facing < 0) idx.push(i0, o0, i1, i1, o0, o1);
        else idx.push(i0, i1, o0, i1, o1, o0);
      }
    };
    if (o.capStart) cap(0, -1);
    if (o.capEnd) cap(N - 1, 1);
    geo.addGroup(start, idx.length - start, 2);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ── Extrusion helper: front face lands exactly on z = 0 ────────────────
const BEVEL = 0.022;
export function extrudeBack(shape: THREE.Shape, depth: number, bevel = BEVEL, zFront = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 32,
  });
  g.translate(0, 0, zFront - depth - bevel);
  return g;
}
const shapeFrom = (pts: THREE.Vector2[]) => new THREE.Shape(pts);

// ── Cylinder block + head (cut face pieces) ─────────────────────────────
export function buildHousing() {
  const R = E.boreR;
  const W = E.halfW;
  const pieces: THREE.BufferGeometry[] = [];

  for (const s of [-1, 1]) {
    const c = samplePath(portCtrl(s), 80);
    const ns = leftNormals(c);
    const bA = c.map((p, i) => p.clone().addScaledVector(ns[i], E.portR));
    const bB = c.map((p, i) => p.clone().addScaledVector(ns[i], -E.portR));
    const keepAbove = s < 0; // intake side keeps x ≥ −W
    const A = clipAtX(bA, s * W, keepAbove);
    const B = clipAtX(bB, s * W, keepAbove);
    // the boundary that starts nearer the bore wall is the "lower" one
    const lower = Math.abs(A[0].x) > Math.abs(B[0].x) ? A : B;
    const upper = lower === A ? B : A;

    // lower wall piece: block side → bore wall → roof ledge → under the port
    pieces.push(
      extrudeBack(
        shapeFrom([
          V2(s * W, E.linerBottom),
          V2(s * R, E.linerBottom),
          V2(s * R, E.roofY),
          ...lower,
        ]),
        E.depth,
      ),
    );
    // upper head piece: over the port → block side → head top → plug well
    pieces.push(
      extrudeBack(
        shapeFrom([
          ...upper,
          V2(s * W, E.headTop),
          V2(s * E.plugWellR, E.headTop),
          V2(s * E.plugWellR, E.plugWellY),
          V2(s * E.plugHoleR, E.plugWellY),
          V2(s * E.plugHoleR, E.roofY),
        ]),
        E.depth,
      ),
    );
  }

  // crankcase (U-shape around the crank)
  const cc = new THREE.Shape();
  cc.moveTo(-1.25, E.floorY);
  cc.lineTo(1.25, E.floorY);
  cc.lineTo(1.25, E.linerBottom);
  cc.lineTo(0.95, E.linerBottom);
  cc.lineTo(0.95, -0.4);
  cc.absellipse(0, -0.4, 0.95, 0.42, 0, Math.PI, true, 0);
  cc.lineTo(-0.95, E.linerBottom);
  cc.lineTo(-1.25, E.linerBottom);
  cc.closePath();
  pieces.push(extrudeBack(cc, E.depth));

  // crankcase back wall
  const cav = new THREE.Shape();
  cav.moveTo(0.95, E.linerBottom);
  cav.lineTo(0.95, -0.4);
  cav.absellipse(0, -0.4, 0.95, 0.42, 0, Math.PI, true, 0);
  cav.lineTo(-0.95, E.linerBottom);
  cav.closePath();
  pieces.push(extrudeBack(cav, 0.28, BEVEL, -0.6));

  // cam cover (U-shape) + its back wall
  const cv = new THREE.Shape();
  const cw = 0.85;
  const ci = 0.77;
  const top = E.coverTop;
  cv.moveTo(-cw, E.headTop);
  cv.lineTo(-ci, E.headTop);
  cv.lineTo(-ci, top - 0.08);
  cv.lineTo(ci, top - 0.08);
  cv.lineTo(ci, E.headTop);
  cv.lineTo(cw, E.headTop);
  cv.lineTo(cw, top - 0.12);
  cv.quadraticCurveTo(cw, top, cw - 0.12, top);
  cv.lineTo(-cw + 0.12, top);
  cv.quadraticCurveTo(-cw, top, -cw, top - 0.12);
  cv.closePath();
  pieces.push(extrudeBack(cv, E.depth));
  const cvb = new THREE.Shape([V2(-ci, E.headTop), V2(ci, E.headTop), V2(ci, top - 0.08), V2(-ci, top - 0.08)]);
  pieces.push(extrudeBack(cvb, 0.1, 0.01, -0.78));

  return pieces;
}

/** Bore + plug-hole interior surfaces (inner half-cylinders). */
export function buildBore() {
  const line = (x: number, y0: number, y1: number) => [V2(x, y0), V2(x, (y0 + y1) / 2), V2(x, y1)];
  return {
    bore: halfPipeGeometry(line(0, E.linerBottom, E.roofY), { rIn: E.boreR, radial: 48 }),
    plugHole: halfPipeGeometry(line(0, E.roofY, E.plugWellY), { rIn: E.plugHoleR, radial: 16 }),
    plugWell: halfPipeGeometry(line(0, E.plugWellY, E.headTop), { rIn: E.plugWellR, radial: 20 }),
  };
}

/** Port interiors (inside the head only). */
export function buildPortInterior(s: number) {
  const c = samplePath(portCtrl(s), 80);
  const cut = splitIndex(c, E.halfW);
  return halfPipeGeometry(c.slice(0, cut + 1), { rIn: E.portR, radial: 18 });
}

/** External pipe part of a path (outside the block), thick-walled. */
export function buildExternalPipe(ctrl: P2[], samples: number, rIn: number, rOut: number) {
  const c = samplePath(ctrl, samples);
  const cut = Math.max(1, splitIndex(c, E.halfW));
  // start exactly on the block's side face so there is no gap and no z-fighting
  const a = c[cut - 1];
  const b = c[cut];
  const sx = Math.sign(b.x) * E.halfW;
  const f = (sx - a.x) / (b.x - a.x);
  const start = V2(sx, a.y + (b.y - a.y) * f);
  const pts = [start, ...c.slice(cut).filter((p) => p.distanceTo(start) > 0.01)];
  return halfPipeGeometry(pts, { rIn, rOut, outer: true, rims: true, radial: 18, capEnd: true });
}

/** Chamber roof (half disk with semicircular cut-outs for valve seats + plug). */
export function buildRoof() {
  const R = E.boreR;
  const pts: THREE.Vector2[] = [];
  const semi = (cx: number, r: number) => {
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (Math.PI * i) / 16;
      pts.push(V2(cx + r * Math.cos(a), r * Math.sin(a)));
    }
  };
  pts.push(V2(-R, 0));
  semi(-E.valveX, E.portR);
  semi(0, E.plugHoleR);
  semi(E.valveX, E.portR);
  pts.push(V2(R, 0));
  for (let i = 1; i < 48; i++) {
    const a = -(Math.PI * i) / 48;
    pts.push(V2(R * Math.cos(a), R * Math.sin(a)));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.rotateX(Math.PI / 2);
  g.translate(0, E.roofY, 0);
  return g;
}

// ── Moving parts ────────────────────────────────────────────────────────
export function buildPiston() {
  const top = E.pinToCrown;
  const bot = -E.pinToSkirt;
  const R = E.pistonR;
  const g = (y: number) => [V2(R, y + 0.013), V2(R - 0.02, y + 0.01), V2(R - 0.02, y - 0.01), V2(R, y - 0.013)];
  const prof = [
    V2(0.0001, top - 0.012),
    V2(0.4, top),
    V2(R - 0.025, top),
    V2(R, top - 0.025),
    ...g(0.222),
    ...g(0.162),
    ...g(0.1),
    V2(R, bot + 0.02),
    V2(R - 0.016, bot),
    V2(R - 0.06, bot),
    V2(R - 0.06, top - 0.12),
    V2(0.0001, top - 0.12),
  ];
  return new THREE.LatheGeometry(prof, 72);
}

export function buildRod() {
  const L = E.rodL;
  const s = new THREE.Shape();
  const a60 = Math.PI / 3;
  s.moveTo(0.21 * Math.cos(a60), 0.21 * Math.sin(a60));
  s.absarc(0, 0, 0.21, a60, Math.PI - a60, true);
  s.lineTo(-0.065, L - 0.09);
  s.absarc(0, L, 0.11, Math.atan2(-0.09, -0.065), Math.atan2(-0.09, 0.065), true);
  s.closePath();
  const h1 = new THREE.Path();
  h1.absarc(0, 0, 0.125, 0, Math.PI * 2, false);
  const h2 = new THREE.Path();
  h2.absarc(0, L, 0.06, 0, Math.PI * 2, false);
  s.holes.push(h1, h2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: -0.02,
    bevelSegments: 2,
    curveSegments: 40,
  });
  geo.translate(0, 0, -0.07);
  return geo;
}

export function buildCrankWeb() {
  const s = new THREE.Shape();
  const r = E.crankR;
  const pr = 0.2;
  s.moveTo(pr, r);
  s.absarc(0, r, pr, 0, Math.PI, false);
  s.lineTo(-0.27, 0.02);
  s.absarc(0, 0, 0.7, Math.PI + 0.38, Math.PI * 2 - 0.38, false);
  s.lineTo(0.27, 0.02);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelOffset: -0.018,
    bevelSegments: 2,
    curveSegments: 40,
  });
  g.translate(0, 0, -0.05);
  return g;
}

/** Timing gear on the nose of the crank — makes the rotation readable. */
export function buildGear(teeth: number, rRoot: number, rTip: number, depth: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const pts = [
      [rRoot, a0],
      [rTip, a0 + step * 0.18],
      [rTip, a0 + step * 0.48],
      [rRoot, a0 + step * 0.66],
    ];
    pts.forEach(([r, a], j) => (i === 0 && j === 0 ? s.moveTo(r * Math.cos(a), r * Math.sin(a)) : s.lineTo(r * Math.cos(a), r * Math.sin(a))));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelOffset: -0.01, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function buildValve() {
  const prof = [V2(0.0001, 0), V2(E.valveHeadR, 0), V2(E.valveHeadR, 0.02), V2(0.12, 0.05), V2(0.07, 0.09), V2(0.045, 0.14), V2(0.035, 0.2), V2(0.0001, 0.2)];
  const head = new THREE.LatheGeometry(prof, 40);
  const stemLen = E.stemTopClosed - E.roofY - 0.2;
  const stem = new THREE.CylinderGeometry(0.035, 0.035, stemLen, 16);
  stem.translate(0, 0.2 + stemLen / 2, 0);
  const bucket = new THREE.CylinderGeometry(0.09, 0.09, E.bucketH, 28);
  bucket.translate(0, E.stemTopClosed - E.roofY + E.bucketH / 2, 0);
  const retainer = new THREE.CylinderGeometry(0.11, 0.1, 0.025, 28);
  retainer.translate(0, E.stemTopClosed - E.roofY - 0.035, 0);
  for (const g of [head]) g.deleteAttribute('uv');
  [stem, bucket, retainer].forEach((g) => g.deleteAttribute('uv'));
  return mergeGeometries([head, stem, bucket, retainer], false);
}

/** Unit-height helix spring (scaled in Y as the valve compresses it). */
export function buildSpring() {
  class Helix extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(u: number, target = new THREE.Vector3()) {
      const turns = 6;
      const a = u * turns * Math.PI * 2;
      return target.set(Math.cos(a) * 0.088, u, Math.sin(a) * 0.088);
    }
  }
  return new THREE.TubeGeometry(new Helix(), 240, 0.014, 8, false);
}

export function buildCamLobe(kind: 'intake' | 'exhaust') {
  const s = new THREE.Shape();
  const N = 180;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = camRadius(a, kind);
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelOffset: -0.012, bevelSegments: 2 });
  g.translate(0, 0, -0.07);
  return g;
}
export { CAM_Y };

// ── Spark plug (local y = 0 at the chamber roof) ────────────────────────
export function buildPlugParts() {
  const thread: THREE.Vector2[] = [V2(0.0001, 0.0)];
  const n = 12;
  for (let i = 0; i <= n; i++) thread.push(V2(i % 2 === 0 ? 0.066 : 0.08, (i / n) * 0.36));
  thread.push(V2(0.0001, 0.36));
  const insul: THREE.Vector2[] = [V2(0.0001, 0.53), V2(0.072, 0.53)];
  for (let i = 0; i < 5; i++) {
    const y = 0.6 + i * 0.07;
    insul.push(V2(0.074, y), V2(0.06, y + 0.035));
  }
  insul.push(V2(0.05, 0.98), V2(0.042, 1.06), V2(0.0001, 1.06));
  const nose = [V2(0.0001, -0.035), V2(0.03, -0.03), V2(0.045, 0.0), V2(0.0001, 0.0)];
  return {
    thread: new THREE.LatheGeometry(thread, 28),
    insulator: new THREE.LatheGeometry(insul, 32),
    nose: new THREE.LatheGeometry(nose, 20),
  };
}

/** Velocity-stack funnel on the intake (back half). */
export function buildFunnel() {
  const prof = [V2(0.15, 0), V2(0.152, 0.06), V2(0.17, 0.15), V2(0.22, 0.25), V2(0.3, 0.32), V2(0.38, 0.36), V2(0.425, 0.352), V2(0.435, 0.33), V2(0.41, 0.325)];
  return new THREE.LatheGeometry(prof, 40, Math.PI / 2, Math.PI);
}
