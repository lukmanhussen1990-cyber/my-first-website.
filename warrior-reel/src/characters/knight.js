// The Knight — big armoured warrior (~1.93 m with helmet) in weathered silver plate, dark leather
// gauntlets, dark frayed cape, and a separate arming sword.
//
//   import { buildKnight, POSES, SWORD, GRIP_R, GRIP_R_REV, POMMEL_L, swordPose, swordLowerPose,
//            solveSwordHands, legTargetsSeated, plantFeet } from './characters/knight.js';
//
//   const knight = buildKnight();
//   scene.add(knight.root); scene.add(knight.sword);        // the sword is NOT parented to the hand
//   knight.root.position.set(-0.55, 0, -0.05);              // seated: root at the seat-rock centre (seat top y 0.48)
//   // every frame:
//   knight.rig.applyPose(Humanoid.compile(POSES.seated));   // (or a Humanoid.blend of POSES)
//   plantFeet(knight);                                      // seated: legIK to legTargetsSeated() + flat feet
//   const sp = swordPose(knight, 'sitGrip');                // 'sitGrip' | 'sitForward' | 'sitLower' | 'sitRest' | 'standDown'
//   solveSwordHands(knight, sp.position, sp.quaternion, { left: sp.left, grip: sp.grip, tremble: 0.6, t });
//   knight.rig.lookAt(target, w);                           // optional head look
//   knight.update(t, { grip: 0..1, seated: true, rock: { center: seatTopCentreWorld } });
//   // lowering beat: const p = swordLowerPose(knight, u) (u 0..1) -> solveSwordHands(knight, p.position,
//   //   p.quaternion, { grip: p.grip, left: p.left }); blend POSES.seated -> seatedRelaxed by p.relax.
//
// Call order within a frame is free: fingers are re-applied by both solveSwordHands and update, and the
// cape drape is computed lazily at render time (after all IK) from the state given to update().
// Extras on the returned object: sword (Group), hands {L,R} (finger rigs), cape, setHand(side, mode,
// {tension, open, mix}), setPose(nameOrPose), stats() -> { triangles, meshes }.
// Hand modes: 'grip' | 'fist' | 'relaxed' | 'open' | 'knee' | 'pommel'.
import * as THREE from 'three';
import { Humanoid, quatFromBasis } from '../core/rig.js';
import { clamp, smoothstep, DEG, noise1 } from '../core/util.js';
import { makeKnightMaterial, Kit, PAL } from './knight_geo.js';
import { buildArmor } from './knight_armor.js';
import { buildHand, applyHandMode, HAND_CHANNEL } from './knight_hand.js';
import { buildSword, SWORD } from './knight_sword.js';
import { buildCape } from './knight_cape.js';

export { SWORD };

export const KNIGHT_DIMS = {
  spine: 0.15, chest: 0.29, neck: 0.105, shoulderW: 0.46, shoulderY: 0.22,
  upperArm: 0.31, foreArm: 0.28, hipW: 0.22, thigh: 0.48, shin: 0.46, ankle: 0.08,
};

// ---------- grips ----------
// GRIP_R: the sword's transform in handR-local space, standard (hammer) grip: blade exits on the THUMB
// side (sword +Y -> hand +Z), cross-guard along the fist's fore-aft axis, flats facing the palm.
export const GRIP_R = {
  position: new THREE.Vector3(HAND_CHANNEL.x, HAND_CHANNEL.y, -0.025),
  quaternion: quatFromBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
};
// GRIP_R_REV: reversed grip for a point-down sword (blade exits on the PINKY side, thumb toward the pommel);
// the fist sits just under the pommel so the left hand can rest on top.
export const GRIP_R_REV = {
  position: new THREE.Vector3(HAND_CHANNEL.x, HAND_CHANNEL.y, -0.029),
  quaternion: quatFromBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)),
};
const inv = (g) => new THREE.Matrix4().compose(g.position, g.quaternion, new THREE.Vector3(1, 1, 1)).invert();
const GRIP_R_INV = inv(GRIP_R), GRIP_R_REV_INV = inv(GRIP_R_REV);

// ---------- poses (degrees, rig pose format) ----------
export const POSES = {
  // seated on a rock whose top is y = 0.48 (root at the rock centre): tense, hunched forward
  seated: {
    hipsPos: [0, 0.6, 0.075],
    spine: [9, 0, 0], chest: [10, 0, 0], neck: [6, 0, 0], head: [-9, 0, 0],
    upperArmL: [-28, 0, 14], foreArmL: [-62, 0, 0], handL: [0, 0, 0],
    upperArmR: [-32, 0, -16], foreArmR: [-70, 0, 0], handR: [0, 0, 0],
    thighL: [-84, 0, 9], shinL: [86, 0, 0], footL: [0, 0, 0],
    thighR: [-84, 0, -9], shinR: [86, 0, 0], footR: [0, 0, 0],
  },
  // at peace: spine more upright, shoulders dropped, head slightly bowed
  seatedRelaxed: {
    hipsPos: [0, 0.6, 0.07],
    spine: [4, 0, 0], chest: [3, 0, 0], neck: [9, 0, 0], head: [11, 0, 0],
    upperArmL: [-18, 0, 12], foreArmL: [-55, 0, 0],
    upperArmR: [-20, 0, -12], foreArmR: [-55, 0, 0],
    thighL: [-84, 0, 9], shinL: [86, 0, 0],
    thighR: [-84, 0, -9], shinR: [86, 0, 0],
  },
  // standing: heroic but calm — chest up, chin level, arms relaxed clear of the plates
  stand: {
    // NB: thigh joints sit 0.04 below the hips bone, so feet-on-ground needs standHipY + 0.04
    hipsPos: [0, KNIGHT_DIMS.thigh + KNIGHT_DIMS.shin + KNIGHT_DIMS.ankle + 0.04 + 0.008, 0],
    spine: [-2, 0, 0], chest: [-3, 0, 0], neck: [1, 0, 0], head: [3, 0, 0],
    upperArmL: [4, 0, 14], foreArmL: [-14, 0, 0], handL: [0, 0, 0],
    upperArmR: [4, 0, -14], foreArmR: [-14, 0, 0], handR: [0, 0, 0],
    thighL: [-1, 0, 3.5], shinL: [2, 0, 0], footL: [0, 4, -3.5],
    thighR: [-1, 0, -3.5], shinR: [2, 0, 0], footR: [0, -4, 3.5],
  },
};

// Feet planted in front of the rock (world space ankle targets for rig.legIK).
export function legTargetsSeated(knight) {
  const r = knight.rig;
  return {
    L: r.pointToWorld(new THREE.Vector3(0.185, r.d.ankle + 0.004, 0.6)),
    R: r.pointToWorld(new THREE.Vector3(-0.19, r.d.ankle + 0.004, 0.575)),
  };
}

// legIK both legs to targets (default legTargetsSeated) and set the feet flat, toes slightly out.
export function plantFeet(knight, targets = null, { toeOut = 9 } = {}) {
  const r = knight.rig;
  const T = targets || legTargetsSeated(knight);
  const rq = r.root.getWorldQuaternion(new THREE.Quaternion());
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    r.legIK(s, T[s], [0.16 * sx, 0.12, 1]);
    const q = rq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sx * toeOut * DEG));
    r.setWorldQuat(r.b['foot' + s], q);
  }
}

// ---------- sword placements (character space; converted to world for the current root) ----------
// P = grip centre, or tip = point where the blade tip rests; A = blade direction (toward the tip);
// F = desired forearm direction (wrist -> elbow) that sets the roll of the sword in the fist.
export const SWORD_POSES = {
  sitGrip: { grip: 'forward', left: 'knee', P: [-0.215, 0.74, 0.5], A: [-0.52, 1, 0.26], F: [-0.6, -0.42, -0.55] },
  sitForward: { grip: 'forward', left: 'knee', P: [-0.26, 0.76, 0.56], A: [-0.22, 0.3, 1], F: [-0.55, -0.55, -0.62] },
  sitLower: { grip: 'forward', left: 'knee', tip: [-0.2, 0.0, 1.05], A: [-0.08, -0.62, 0.78], F: [-0.35, 0.55, -0.75] },
  sitRest: { grip: 'reverse', left: 'pommel', tip: [-0.035, 0.0, 0.93], A: [0.02, -0.88, 0.5], F: [-0.6, -0.55, -0.58], FL: [0.6, -0.5, -0.62] },
  standDown: { grip: 'reverse', left: 'free', tip: [-0.36, 0.0, 0.47], A: [-0.05, -1, 0.33], F: [-0.15, 0.32, -1] },
};

// Sword orientation (character space) for a placement definition.
function swordQuatChar(def) {
  const A = new THREE.Vector3(...def.A).normalize(), F = new THREE.Vector3(...def.F).normalize();
  const fwd = def.grip !== 'reverse';
  const Z = fwd ? A.clone() : A.clone().negate();
  const Y = F.clone().addScaledVector(Z, -F.dot(Z)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  return quatFromBasis(X, Y, Z).multiply((fwd ? GRIP_R : GRIP_R_REV).quaternion);
}

// POMMEL_L: the LEFT hand's transform in sword-local space, palm resting on top of the pommel (sword
// point-down). Its roll about the blade is chosen so that, in the sitRest placement, the left forearm
// comes from his left/back/below (mirroring the right arm) and the fingers drape over the pommel.
export const POMMEL_L = (() => {
  const def = SWORD_POSES.sitRest;
  const qs = swordQuatChar(def), qsi = qs.clone().invert();
  const X = new THREE.Vector3(0, -1, 0); // palm (-X) faces the pommel = sword +Y
  const Y = new THREE.Vector3(...def.FL).normalize().applyQuaternion(qsi);
  Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  const q = quatFromBasis(X, Y, Z);
  const palm = new THREE.Vector3(-0.0205, -0.05, 0.004).applyQuaternion(q);
  return { position: new THREE.Vector3(0, SWORD.pommelEnd + 0.001, 0).sub(palm), quaternion: q };
})();
const POMMEL_L_M = new THREE.Matrix4().compose(POMMEL_L.position, POMMEL_L.quaternion, new THREE.Vector3(1, 1, 1));

export function swordPose(knight, name) {
  const def = typeof name === 'string' ? SWORD_POSES[name] : name;
  const rig = knight.rig;
  rig.root.updateMatrixWorld(true);
  const rq = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const A = new THREE.Vector3(...def.A).normalize().applyQuaternion(rq);
  const F = new THREE.Vector3(...def.F).normalize().applyQuaternion(rq);
  const fwd = def.grip !== 'reverse';
  const Z = fwd ? A.clone() : A.clone().negate();
  const Y = F.clone().addScaledVector(Z, -F.dot(Z)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  const qH = quatFromBasis(X, Y, Z);
  const quaternion = qH.multiply((fwd ? GRIP_R : GRIP_R_REV).quaternion);
  let position;
  if (def.P) position = rig.pointToWorld(new THREE.Vector3(...def.P));
  else position = rig.pointToWorld(new THREE.Vector3(...def.tip)).addScaledVector(A, -SWORD.tipY);
  return { position, quaternion, grip: def.grip, left: def.left };
}

// ---------- hands on the sword ----------
const _S = new THREE.Matrix4(), _H = new THREE.Matrix4(), _H2 = new THREE.Matrix4();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _sc = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

// IK one arm so the wrist lands at wristPos and the hand takes handQuat (world). The elbow pole is chosen
// so the forearm lines up with the hand (straight wrist) blended with a natural pole (character space).
export function solveArmToHand(knight, side, wristPos, handQuat, naturalPole, straight = 0.7) {
  const rig = knight.rig, sx = side === 'L' ? 1 : -1;
  rig.root.updateMatrixWorld(true);
  const S = rig.worldPos('upperArm' + side);
  const handY = new THREE.Vector3(0, 1, 0).applyQuaternion(handQuat);
  const want = wristPos.clone().addScaledVector(handY, rig.d.foreArm).sub(S).normalize();
  const rq = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const wl = want.applyQuaternion(rq.clone().invert());
  const nat = new THREE.Vector3(...naturalPole).normalize();
  const pl = wl.multiplyScalar(straight).addScaledVector(nat, 1 - straight);
  if (pl.x * sx < 0.12) pl.x = 0.12 * sx; // elbows never tuck into the plates
  rig.armIK(side, wristPos, [pl.x, pl.y, pl.z]);
  rig.setWorldQuat(rig.b['hand' + side], handQuat);
}

// Place the sword at a world transform and make the hands hold it.
//   opts.left: 'pommel' (left palm on the pommel) | 'knee' (left hand on the left knee/thigh) | 'free'
//   opts.leftTarget: Vector3 world point for 'knee' (default: top of the left thigh near the knee)
//   opts.grip: 'forward' | 'reverse' | 'auto' (reverse when the blade points down) | number 0..1 =
//              re-grip blend forward->reverse (hand opens, lifts off and turns around the grip)
//   opts.rightPole / opts.leftPole: natural elbow pole in character space (optional overrides)
//   opts.tremble: 0..1 adds a fine tremor to fist + sword; pass opts.t (time) and optionally opts.tension
//                 (defaults: knight.t / knight.grip as last set by knight.update)
export function solveSwordHands(knight, swordPos, swordQuat, opts = {}) {
  const { left = 'free' } = opts;
  let grip = opts.grip ?? 'auto';
  const { rig, sword, hands } = knight;
  // optional tremor of the whole fist + sword (scaled by fist tension): opts.tremble 0..1
  if (opts.tremble > 0) {
    const a = opts.tremble * (0.35 + 0.65 * (opts.tension ?? knight.grip)), t = opts.t ?? knight.t;
    swordPos = swordPos.clone().add(new THREE.Vector3(noise1(t * 11 + 1), noise1(t * 13 + 7), noise1(t * 9 + 3)).multiplyScalar(0.0022 * a));
    swordQuat = swordQuat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(noise1(t * 10 + 5) * 0.012 * a, noise1(t * 8 + 2) * 0.006 * a, noise1(t * 12 + 9) * 0.012 * a)));
  }
  // 1) place the sword (works whatever the sword's parent is)
  if (sword.parent) {
    sword.parent.updateMatrixWorld(true);
    _S.compose(swordPos, swordQuat, ONE).premultiply(_H.copy(sword.parent.matrixWorld).invert());
    _S.decompose(sword.position, sword.quaternion, _sc);
  } else { sword.position.copy(swordPos); sword.quaternion.copy(swordQuat); }
  sword.updateMatrixWorld(true);
  _S.compose(swordPos, swordQuat, ONE);
  // 2) right hand
  let u;
  if (grip === 'forward') u = 0; else if (grip === 'reverse') u = 1;
  else if (typeof grip === 'number') u = clamp(grip, 0, 1);
  else u = new THREE.Vector3(0, 1, 0).applyQuaternion(swordQuat).y < -0.2 ? 1 : 0;
  const us = smoothstep(0, 1, u);
  _H.copy(_S).multiply(GRIP_R_INV).decompose(_p1, _q1, _sc);
  _H2.copy(_S).multiply(GRIP_R_REV_INV).decompose(_p2, _q2, _sc);
  const qR = _q1.clone().slerp(_q2, us), pR = _p1.clone().lerp(_p2, us);
  const open = Math.sin(Math.PI * us);
  if (open > 1e-3) pR.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(qR), -0.05 * open); // lift off the grip
  const poleR = opts.rightPole || (us > 0.5 ? [-0.7, -0.45, -0.55] : [-0.65, -0.45, -0.6]);
  solveArmToHand(knight, 'R', pR, qR, poleR, 0.72);
  knight.setHand('R', 'grip', { open });
  // 3) left hand: a mode name, or [fromMode, toMode, t] to blend between two holds
  const L = Array.isArray(left) ? left : [left, left, 0];
  const a = leftHold(knight, L[0], opts), b = L[2] > 0 ? leftHold(knight, L[1], opts) : null;
  if (a || b) {
    const k = b ? smoothstep(0, 1, L[2]) : 0;
    const A = a || b, Bh = b || a;
    const wrist = A.wrist.clone().lerp(Bh.wrist, k);
    const q = A.q.clone().slerp(Bh.q, k);
    const pole = A.pole.map((v, i) => v + (Bh.pole[i] - v) * k);
    if (k > 0 && k < 1) wrist.y += 0.05 * Math.sin(Math.PI * k); // lift the hand while moving between holds
    solveArmToHand(knight, 'L', wrist, q, pole, A.straight + (Bh.straight - A.straight) * k);
    knight.setHand('L', A.mode, { tension: A.tension, mix: b && k > 0 ? { mode: Bh.mode, t: k, tension: Bh.tension } : null });
  }
}

// Target for the left hand on the sword's pommel or on the left knee (world); null for 'free'.
function leftHold(knight, mode, opts) {
  const rig = knight.rig;
  if (mode === 'pommel') {
    _H.copy(_S).multiply(POMMEL_L_M).decompose(_p1, _q1, _sc);
    return { wrist: _p1.clone(), q: _q1.clone(), pole: opts.leftPole || [0.7, -0.45, -0.55], straight: 0.65, mode: 'pommel', tension: 0.15 * knight.grip };
  }
  if (mode === 'knee') {
    rig.root.updateMatrixWorld(true);
    const th = rig.b.thighL;
    const T = opts.leftTarget ? opts.leftTarget.clone() : new THREE.Vector3(0.004, -0.33, 0.1).applyMatrix4(th.matrixWorld);
    const tq = th.getWorldQuaternion(new THREE.Quaternion());
    const X = new THREE.Vector3(0, 0, 1).applyQuaternion(tq);
    const Yt = new THREE.Vector3(0, 1, 0).applyQuaternion(tq);
    Yt.applyAxisAngle(X, 14 * DEG); // fingers point down the thigh, a little to the outside of the knee
    const Y = Yt.addScaledVector(X, -Yt.dot(X)).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
    const q = quatFromBasis(X, Y, Z);
    const wrist = T.sub(new THREE.Vector3(-0.026, -0.054, 0.0).applyQuaternion(q));
    return { wrist, q, pole: opts.leftPole || [0.75, -0.25, -0.6], straight: 0.55, mode: 'knee', tension: 0.35 * knight.grip };
  }
  return null;
}

// The whole "lowering the sword" beat as one helper: u = 0 (sitGrip, blade up) -> 0.22 (blade swung
// forward over the knee) -> 0.45 (tip touches the ground in front) -> 0.45..0.8 re-grip while the blade
// pivots on its tip to stand upright, left hand moves knee -> pommel -> 1 (sitRest, hands stacked).
// Returns { position, quaternion, grip, left, relax } — pass to solveSwordHands(knight, position, quaternion,
// { grip, left }); `relax` (0..1) is a suggested blend weight seated -> seatedRelaxed.
export function swordLowerPose(knight, u) {
  u = clamp(u, 0, 1);
  const P0 = swordPose(knight, 'sitGrip'), P1 = swordPose(knight, 'sitForward'), P2 = swordPose(knight, 'sitLower'), P3 = swordPose(knight, 'sitRest');
  let position, quaternion, grip = 0, left = 'knee';
  if (u < 0.22) {
    const k = smoothstep(0, 0.22, u);
    position = P0.position.clone().lerp(P1.position, k); quaternion = P0.quaternion.clone().slerp(P1.quaternion, k);
  } else if (u < 0.45) {
    const k = smoothstep(0.22, 0.45, u);
    position = P1.position.clone().lerp(P2.position, k); quaternion = P1.quaternion.clone().slerp(P2.quaternion, k);
  } else {
    // pivot about the planted tip
    const k = smoothstep(0.45, 0.85, u);
    quaternion = P2.quaternion.clone().slerp(P3.quaternion, k);
    const tipA = P2.position.clone().add(new THREE.Vector3(0, SWORD.tipY, 0).applyQuaternion(P2.quaternion));
    const tipB = P3.position.clone().add(new THREE.Vector3(0, SWORD.tipY, 0).applyQuaternion(P3.quaternion));
    const tip = tipA.lerp(tipB, k);
    position = tip.sub(new THREE.Vector3(0, SWORD.tipY, 0).applyQuaternion(quaternion));
    grip = smoothstep(0.5, 0.78, u);
    const lt = smoothstep(0.62, 0.86, u);
    left = lt <= 0 ? 'knee' : lt >= 1 ? 'pommel' : ['knee', 'pommel', lt];
  }
  return { position, quaternion, grip, left, relax: smoothstep(0.3, 1.0, u) };
}

// ---------- builder ----------
export function buildKnight(opts = {}) {
  const rig = new Humanoid(KNIGHT_DIMS);
  rig.root.name = 'knightRoot';
  const material = makeKnightMaterial();
  const cape = buildCape(rig, { length: opts.capeLength ?? 1.24 });
  const armor = buildArmor(rig, material);
  // cape collar (rolled cloth along the anchor line) + brass clasps, merged on the chest
  {
    const kit = new Kit(material);
    const pts = cape.anchors.map((p) => p.clone().add(new THREE.Vector3(0, 0.008, -0.012)));
    kit.add(rig.b.chest, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.012, 6, false), PAL.cloth);
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const g = new THREE.CylinderGeometry(0.021, 0.021, 0.008, 12);
      g.rotateX(Math.PI / 2); g.translate(p.x, p.y + 0.004, p.z + 0.014);
      kit.add(rig.b.chest, g, PAL.brass);
    }
    armor.meshes.push(...kit.build({ name: 'knightCollar' }));
    armor.tris += kit.tris;
  }
  const hands = { L: buildHand('L', material), R: buildHand('R', material) };
  rig.b.handL.add(hands.L.root);
  rig.b.handR.add(hands.R.root);
  // the sword gets its own instance of the armour material (same shader program) with softer environment
  // reflections, so a mirror-like blade doesn't turn grass-green in the meadow
  const swordMat = material.clone();
  swordMat.onBeforeCompile = material.onBeforeCompile;
  swordMat.customProgramCacheKey = material.customProgramCacheKey;
  swordMat.envMapIntensity = 0.6;
  const sword = buildSword(swordMat);
  rig.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const knight = {
    rig, root: rig.root, sword, hands, cape, material, swordMaterial: swordMat, armor,
    grip: 0, seated: false, t: 0,
    setHand(side, mode, { tension = 0, open = 0, mix = null } = {}) {
      const h = hands[side];
      h.mode = mode; h.baseTension = tension; h.open = open; h.mixState = mix;
      applyHandMode(h, mode, { tension: mode === 'grip' ? knight.grip : tension, open, t: knight.t, rg: SWORD.gripR, mix });
    },
    setPose(p) { rig.applyPose(Humanoid.compile(typeof p === 'string' ? POSES[p] : p)); },
    update(t = 0, state = {}) {
      knight.t = t;
      if (state.grip !== undefined) knight.grip = clamp(+state.grip, 0, 1);
      if (state.seated !== undefined) knight.seated = !!state.seated;
      for (const s of ['L', 'R']) {
        const h = hands[s];
        const ten = h.mode === 'grip' ? knight.grip : (h.baseTension || 0);
        applyHandMode(h, h.mode, { tension: ten, open: h.open || 0, t, rg: SWORD.gripR, mix: h.mixState || null });
      }
      cape.update(t, { seated: knight.seated, rock: state.rock || null, wind: state.wind ?? 0.3, ground: state.ground ?? 0 });
    },
    stats() {
      let tris = 0, meshes = 0;
      const count = (o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } };
      rig.root.traverse(count); sword.traverse(count);
      return { triangles: Math.round(tris), meshes };
    },
  };
  knight.setHand('L', 'relaxed');
  knight.setHand('R', 'relaxed');
  rig.applyPose(Humanoid.compile(POSES.stand));
  return knight;
}
