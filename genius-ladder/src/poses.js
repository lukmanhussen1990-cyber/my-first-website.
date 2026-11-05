// Pose library for the blocky puppets. Angles in degrees, hipY in metres.
// Conventions (character faces +Z):
//   sh?x  + = arm swings forward/up      sh?z + = arm out to the side   sh?y twist (+ = forearm turns outward)
//   el?   + = elbow bends forward         hip?x + = leg forward          hip?z + = leg out   knee? + = bend
//   spine + = bend forward   neckX + = look down   neckY + = look to own left   hipY = drop the pelvis
export const JOINTS = {
  hipY: 0, spine: 0, spineZ: 0, spineY: 0,
  neckX: 0, neckY: 0, neckZ: 0,
  shLx: 0, shLz: 6, shLy: 0, elL: 8,
  shRx: 0, shRz: 6, shRy: 0, elR: 8,
  hipLx: 0, hipLz: 2, kneeL: 0,
  hipRx: 0, hipRz: 2, kneeR: 0,
};

const P = (o) => ({ ...JOINTS, ...o });

export const POSES = {
  stand: P({}),
  lookUp: P({ neckX: -38, spine: -6, shLz: 8, shRz: 8 }),
  lookUpHand: P({ neckX: -38, spine: -6, shRx: 120, shRz: 40, shRy: -30, elR: 95 }), // hand shading eyes
  // holding a box over the head
  carryUp: P({ shLx: 150, shRx: 150, shLz: 14, shRz: 14, elL: 30, elR: 30, neckX: -15, spine: -6 }),
  placeDown: P({ shLx: 95, shRx: 95, shLz: 12, shRz: 12, elL: 10, elR: 10, spine: 12, neckX: 10 }),
  handsHips: P({ shLz: 38, shRz: 38, shLx: -12, shRx: -12, shLy: -90, shRy: -90, elL: 105, elR: 105 }),
  proud: P({ shLz: 38, shRz: 38, shLx: -12, shRx: -12, shLy: -90, shRy: -90, elL: 105, elR: 105, spine: -9, neckX: -12 }),
  reachUp: P({ shLx: 172, shRx: 168, shLz: 8, shRz: 10, elL: 4, elR: 4, neckX: -32, spine: -5 }),
  wobble: P({ shLx: 120, shRx: 70, shLz: 60, shRz: 70, elL: 20, elR: 30, neckX: -10, spineZ: 8 }),
  flail: P({ shLx: 150, shRx: 140, shLz: 55, shRz: 60, elL: 25, elR: 35, hipLx: 35, kneeL: 40, hipRx: -15, kneeR: 50, neckX: -18 }),
  // landing on the bum, legs out
  sitGround: P({ hipY: -0.66, hipLx: 84, hipRx: 80, hipLz: 10, hipRz: 12, kneeL: 8, kneeR: 14, shLx: -20, shRx: -20, shLz: 25, shRz: 25, elL: 0, elR: 0, spine: -6 }),
  sitSlump: P({ hipY: -0.66, hipLx: 84, hipRx: 80, hipLz: 14, hipRz: 16, kneeL: 10, kneeR: 16, shLx: 10, shRx: 10, shLz: 30, shRz: 30, spine: 18, neckX: 8 }),
  kneel: P({ hipY: -0.4, hipLx: 90, kneeL: 92, hipRx: -4, kneeR: 92, spine: 18, neckX: 20 }),
  kneelWork: P({ hipY: -0.4, hipLx: 90, kneeL: 92, hipRx: -4, kneeR: 92, spine: 30, neckX: 26, shLx: 60, elL: 20, shRx: 60, elR: 20 }),
  hammerUp: P({ hipY: -0.4, hipLx: 90, kneeL: 92, hipRx: -4, kneeR: 92, spine: 22, neckX: 26, shLx: 62, shLz: 10, elL: 25, shRx: 165, shRz: 12, elR: 70 }),
  hammerDown: P({ hipY: -0.4, hipLx: 90, kneeL: 92, hipRx: -4, kneeR: 92, spine: 34, neckX: 30, shLx: 62, shLz: 10, elL: 25, shRx: 70, shRz: 6, elR: 4 }),
  // ladder climbing (character faces the ladder)
  climbA: P({ hipLx: 62, kneeL: 92, hipRx: 6, kneeR: 8, shLx: 165, shLz: 4, elL: 18, shRx: 120, shRz: 4, elR: 30, spine: 6 }),
  climbB: P({ hipRx: 62, kneeR: 92, hipLx: 6, kneeL: 8, shRx: 165, shRz: 4, elR: 18, shLx: 120, shLz: 4, elL: 30, spine: 6 }),
  climbHold: P({ hipLx: 8, kneeL: 10, hipRx: 8, kneeR: 10, shLx: 125, shRx: 125, shLz: 6, shRz: 6, elL: 25, elR: 25, spine: 4 }),
  climbSmug: P({ hipLx: 8, kneeL: 10, hipRx: 40, kneeR: 60, shLx: 135, shLz: 6, elL: 20, shRx: 20, shRz: 45, elR: 10, neckY: 70, neckX: -6, spineY: 18 }),
  peek: P({ hipLx: 6, kneeL: 8, hipRx: 6, kneeR: 8, shLx: 95, shRx: 95, shLz: 18, shRz: 18, elL: 70, elR: 70, spine: 8, neckX: -4 }),
  // face down in the grass (combine with root rx: 90)
  faceplant: P({ shLx: 168, shRx: 172, shLz: 18, shRz: 14, elL: 0, elR: 0, hipLz: 8, hipRz: 6, neckY: 75, neckX: -10 }),
  splat: P({ shLx: 30, shRx: 25, shLz: 80, shRz: 85, hipLz: 14, hipRz: 12, kneeL: 30, kneeR: 10, neckY: 75, neckX: -10 }),
  thumbsUp: P({ shRx: 70, shRz: 18, shRy: 0, elR: 110, shLz: 8, neckX: -4, spine: -4 }),
  wiggle: P({ shRx: 75, shRz: 10, elR: 15, shLx: 75, shLz: 10, elL: 15, spine: 8 }),
  tada: P({ shLx: 40, shRx: 40, shLz: 70, shRz: 70, elL: 0, elR: 0, spine: -8, neckX: -10, hipLz: 8, hipRz: 8 }),
  shrug: P({ shLz: 40, shRz: 40, shLx: 20, shRx: 20, elL: 80, elR: 80, shLy: 60, shRy: 60, neckZ: 10 }),
  limp: P({ shLz: 3, shRz: 3, elL: 0, elR: 0, spine: 4, neckX: 6 }),
  shock: P({ shLx: 25, shRx: 25, shLz: 22, shRz: 22, elL: 50, elR: 50, spine: -10, neckX: -6 }),
  crossArms: P({ shLx: 28, shRx: 26, shLz: 12, shRz: 12, shLy: -80, shRy: -80, elL: 112, elR: 104, spine: -4, neckX: 2 }),
  // friend on the toilet
  sitPhone: P({ hipY: -0.36, hipLx: 88, hipRx: 88, hipLz: 6, hipRz: 6, kneeL: 88, kneeR: 88, spine: 20, neckX: 32, shLx: 38, shRx: 38, shLz: 8, shRz: 8, shLy: -25, shRy: -25, elL: 88, elR: 88 }),
  sitBino: P({ hipY: -0.36, hipLx: 88, hipRx: 88, hipLz: 6, hipRz: 6, kneeL: 88, kneeR: 88, spine: 4, neckX: -4, shLx: 70, shRx: 70, shLz: 24, shRz: 24, shLy: -55, shRy: -55, elL: 120, elR: 120 }),
};

export function poseValues(name) {
  const p = POSES[name];
  if (!p) throw new Error(`Unknown pose "${name}"`);
  return p;
}
