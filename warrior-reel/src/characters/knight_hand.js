// Dark leather gauntlet with articulated fingers (one SkinnedMesh per hand, own mini-skeleton
// parented under the rig's hand bone). Hand-local frame (rig convention): wrist at origin, fingers
// along -Y, thumb side +Z, palm normal = +X for the RIGHT hand and -X for the LEFT hand.
import * as THREE from 'three';
import { PAL, paint, Kit } from './knight_geo.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DEG, clamp, lerp, noise1 } from '../core/util.js';

// finger layout (right-hand numbers; z is mirrored by nothing — thumb is +Z for both hands)
const FINGERS = [
  { z: 0.032, y: -0.094, L: [0.047, 0.029, 0.023], r: 0.0108, spread: 4 },   // index
  { z: 0.0105, y: -0.098, L: [0.051, 0.032, 0.024], r: 0.0113, spread: 0 },  // middle
  { z: -0.0115, y: -0.096, L: [0.048, 0.03, 0.023], r: 0.0108, spread: -3 }, // ring
  { z: -0.032, y: -0.089, L: [0.039, 0.024, 0.02], r: 0.0098, spread: -7 },  // pinky
];
const THUMB = { pos: [0.006, -0.02, 0.032], L: [0.04, 0.034, 0.028], r: [0.0145, 0.0118, 0.011] };

// Channel where a held grip's axis (along hand Z) sits, in (palm-axis, y) coordinates.
export const HAND_CHANNEL = { x: 0.0345, y: -0.083 };

export function buildHand(side, material) {
  const ps = side === 'R' ? 1 : -1; // palm sign: palm normal = ps * X
  const root = new THREE.Bone(); root.name = 'glove' + side;
  const bones = [root];
  const fingerBones = [];
  const geos = [];
  const addPart = (geo, spec, boneIndex, matrix) => {
    if (matrix) geo.applyMatrix4(matrix);
    const g = paint(geo, spec);
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = boneIndex; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geos.push(g);
  };
  // ---- palm, back of hand, cuff (bone 0) ----
  const palm = new RoundedBoxGeometry(0.037, 0.104, 0.09, 3, 0.013);
  palm.translate(0.001 * ps, -0.047, 0.0);
  addPart(palm, PAL.glove, 0);
  // knuckle ridge / back-of-hand padding
  const back = new RoundedBoxGeometry(0.012, 0.07, 0.078, 2, 0.005);
  back.translate(-ps * 0.0175, -0.055, -0.001);
  addPart(back, PAL.gloveD, 0);
  // thenar pad
  const thenar = new THREE.SphereGeometry(1, 10, 8);
  thenar.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(ps * 0.008, -0.04, 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0)), new THREE.Vector3(0.016, 0.03, 0.017)));
  addPart(thenar, PAL.glove, 0);
  // flared leather cuff over the vambrace end
  const cuffPts = [[0.041, -0.012], [0.043, 0.0], [0.047, 0.03], [0.054, 0.062], [0.057, 0.07]].map(([r, y]) => new THREE.Vector2(r, y));
  const cuff = new THREE.LatheGeometry(cuffPts, 18);
  cuff.applyMatrix4(new THREE.Matrix4().makeScale(0.86, 1, 1.08));
  addPart(cuff, PAL.gloveD, 0);
  const cuffIn = new THREE.LatheGeometry([[0.054, 0.068], [0.044, 0.064], [0.04, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
  cuffIn.applyMatrix4(new THREE.Matrix4().makeScale(0.86, 1, 1.08));
  addPart(cuffIn, PAL.pad, 0);
  // stitched strap across the back of the hand
  const strap = new THREE.TorusGeometry(0.047, 0.0035, 4, 18);
  strap.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, -0.002, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(0.82, 1.05, 1)));
  addPart(strap, PAL.strap, 0);

  // ---- fingers ----
  FINGERS.forEach((f, fi) => {
    const chain = [];
    let parent = root, pos = new THREE.Vector3(0.0, f.y, f.z);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Bone(); b.name = `f${fi}_${k}`; b.position.copy(pos);
      parent.add(b); bones.push(b); chain.push(b);
      parent = b; pos = new THREE.Vector3(0, -f.L[k], 0);
    }
    fingerBones.push(chain);
  });
  // thumb
  const thumb = [];
  {
    let parent = root, pos = new THREE.Vector3(ps * THUMB.pos[0], THUMB.pos[1], THUMB.pos[2]);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Bone(); b.name = `t_${k}`; b.position.copy(pos);
      parent.add(b); bones.push(b); thumb.push(b);
      parent = b; pos = new THREE.Vector3(0, -THUMB.L[k], 0);
    }
  }
  // rest orientation of the thumb base (needed so its geometry is bound sensibly)
  thumb[0].quaternion.setFromEuler(new THREE.Euler(-35 * DEG, 0, ps * 25 * DEG));
  root.updateMatrixWorld(true);
  const segGeo = (L, r, rTip) => {
    const g = new THREE.CapsuleGeometry(r, L, 3, 8);
    g.translate(0, -L / 2, 0);
    if (rTip && rTip !== r) { // taper toward the tip
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = clamp(-p.getY(i) / L, 0, 1), s = lerp(1, rTip / r, t); p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
      g.computeVertexNormals();
    }
    // flatten slightly (fingers are wider than thick)
    g.scale(0.92, 1, 1.04);
    return g;
  };
  const boneIndex = (b) => bones.indexOf(b);
  const toRoot = (b) => { const m = b.matrixWorld.clone(); return m; };
  FINGERS.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const r0 = f.r * (1 - 0.06 * k), r1 = f.r * (1 - 0.06 * (k + 1)) * (k === 2 ? 0.92 : 1);
      addPart(segGeo(f.L[k], r0, r1), k === 0 ? PAL.glove : PAL.glove, boneIndex(fingerBones[fi][k]), toRoot(fingerBones[fi][k]));
    }
    // knuckle stud on the back of the proximal segment (small, dark)
    const stud = new THREE.SphereGeometry(0.0075, 6, 4);
    stud.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-ps * 0.006, -0.004, 0), new THREE.Quaternion(), new THREE.Vector3(0.8, 1, 1)));
    addPart(stud, PAL.gloveD, boneIndex(fingerBones[fi][0]), toRoot(fingerBones[fi][0]));
  });
  for (let k = 0; k < 3; k++) addPart(segGeo(THUMB.L[k], THUMB.r[k], k === 2 ? THUMB.r[k] * 0.85 : THUMB.r[k]), PAL.glove, boneIndex(thumb[k]), toRoot(thumb[k]));

  const geo = mergeGeometries(geos, false);
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = 'gauntlet' + side;
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  root.add(mesh);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton, mesh.matrixWorld);

  const restThumbQ = thumb[0].quaternion.clone();
  const hand = {
    root, mesh, side, ps, fingerBones, thumb, tris: geo.attributes.position.count / 3,
    mode: 'relaxed', tension: 0, channel: null, open: 0,
    // Set finger angles directly. curls: 4 x [mcp, pip, dip] degrees (curl toward palm), thumb: {base:[x,y,z] deg, flex:[a,b]}
    setAngles(curls, thumbPose, spreadMul = 1) {
      FINGERS.forEach((f, fi) => {
        for (let k = 0; k < 3; k++) {
          const b = fingerBones[fi][k];
          const sp = k === 0 ? f.spread * spreadMul * DEG : 0;
          b.quaternion.setFromEuler(new THREE.Euler(sp * -1 * 0 + 0, 0, ps * curls[fi][k] * DEG, 'XYZ'));
          if (k === 0 && sp) b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -sp));
        }
      });
      const tb = thumbPose.base;
      thumb[0].quaternion.setFromEuler(new THREE.Euler(tb[0] * DEG, tb[1] * DEG, ps * tb[2] * DEG, 'XYZ'));
      thumb[1].quaternion.setFromEuler(new THREE.Euler(0, 0, ps * thumbPose.flex[0] * DEG));
      thumb[2].quaternion.setFromEuler(new THREE.Euler(0, 0, ps * thumbPose.flex[1] * DEG));
    },
  };
  hand.restThumbQ = restThumbQ;
  return hand;
}

// ---------- grip wrap solver ----------
// Planar chain (hand XY plane, x measured along the palm normal) closing around a circle until contact.
function wrapChain(start, phi0, lengths, C, R, maxCurls, minCurls, dir = 1) {
  const angles = [];
  let px = start[0], py = start[1], phi = phi0;
  for (let k = 0; k < lengths.length; k++) {
    const L = lengths[k];
    let best = minCurls[k];
    for (let a = minCurls[k]; a <= maxCurls[k]; a += 1.5) {
      const ph = phi + dir * a * DEG;
      const ex = px + Math.sin(ph) * L, ey = py - Math.cos(ph) * L;
      // distance from C to segment
      const vx = ex - px, vy = ey - py, wx = C[0] - px, wy = C[1] - py;
      const tt = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
      const dx = px + vx * tt - C[0], dy = py + vy * tt - C[1];
      if (Math.hypot(dx, dy) < R) break;
      best = a;
    }
    angles.push(best);
    phi += dir * best * DEG;
    px += Math.sin(phi) * L; py -= Math.cos(phi) * L;
  }
  return angles;
}

const PRESETS = {
  open: { curls: [[4, 6, 4], [4, 6, 4], [5, 7, 4], [6, 8, 5]], thumb: { base: [-30, 0, 18], flex: [5, 5] }, spread: 1.4 },
  relaxed: { curls: [[16, 26, 14], [20, 30, 16], [24, 34, 18], [28, 38, 20]], thumb: { base: [-38, 4, 26], flex: [14, 12] }, spread: 1 },
  fist: { curls: [[88, 100, 62], [90, 102, 64], [92, 100, 62], [94, 98, 60]], thumb: { base: [-8, 0, 62], flex: [42, 38] }, spread: 0 },
  knee: { curls: [[14, 28, 18], [16, 32, 20], [20, 34, 22], [24, 38, 24]], thumb: { base: [-42, 6, 24], flex: [10, 12] }, spread: 1.1 },
  pommel: { curls: [[32, 44, 26], [36, 48, 28], [40, 50, 28], [44, 52, 30]], thumb: { base: [-36, 4, 34], flex: [18, 20] }, spread: 0.6 },
};

// Apply a hand mode. mode: 'grip' (around HAND_CHANNEL with grip radius rg), 'fist', 'relaxed', 'open', 'knee', 'pommel'.
// tension 0..1 (squeeze), open 0..1 blends toward an open hand (used during re-grips), t = time for tremble.
export function applyHandMode(hand, mode, { tension = 0, open = 0, rg = 0.0165, t = 0 } = {}) {
  let curls, thumbPose, spread;
  const trem = tension > 0.55 ? (tension - 0.55) * 2.2 : 0;
  if (mode === 'grip') {
    const C = [HAND_CHANNEL.x - 0.0012 * tension, HAND_CHANNEL.y];
    curls = FINGERS.map((f, fi) => {
      const R = (rg + f.r * 0.92) * (1 - 0.06 * tension) + 0.0005;
      const a = wrapChain([0, f.y], 0, f.L, C, R, [100, 110, 85], [20, 25, 15], 1);
      const j = trem * 1.2 * noise1(t * 9 + fi * 3.1);
      return [a[0] + j, a[1] + j * 0.6, a[2]];
    });
    const Rt = rg + 0.021 + 0.011 - 0.0025 * tension;
    // thumb runs over the top (wrist side) of the grip and down its far side, over the index finger
    const ta = wrapChain([THUMB.pos[0], THUMB.pos[1]], 90 * DEG - 12 * DEG, THUMB.L, C, Rt, [70, 80, 70], [-30, 0, 0], -1);
    // convert: base angle is measured from -Y; dir -1 means decreasing phi.
    thumbPose = { base: [0, 0, 90 - 12 - ta[0]], flex: [-ta[1], -ta[2]] };
    // we encoded thumb curl as negative flex (curling the other way round the grip)
    spread = 0;
  } else {
    const P = PRESETS[mode] || PRESETS.relaxed;
    curls = P.curls.map((c) => c.slice());
    thumbPose = { base: P.thumb.base.slice(), flex: P.thumb.flex.slice() };
    spread = P.spread;
    if (tension > 0 && mode !== 'fist') { // squeeze toward a fist
      const F = PRESETS.fist;
      curls = curls.map((c, i) => c.map((v, k) => lerp(v, F.curls[i][k], tension)));
      thumbPose.base = thumbPose.base.map((v, k) => lerp(v, F.thumb.base[k], tension));
      thumbPose.flex = thumbPose.flex.map((v, k) => lerp(v, F.thumb.flex[k], tension));
    }
  }
  if (open > 0) {
    const O = PRESETS.open;
    curls = curls.map((c, i) => c.map((v, k) => lerp(v, O.curls[i][k], open)));
    thumbPose.base = thumbPose.base.map((v, k) => lerp(v, O.thumb.base[k], open));
    thumbPose.flex = thumbPose.flex.map((v, k) => lerp(v, O.thumb.flex[k], open));
    spread = lerp(spread, O.spread, open);
  }
  hand.setAngles(curls, thumbPose, spread);
  hand.mode = mode; hand.tension = tension;
}
