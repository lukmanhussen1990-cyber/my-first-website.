// Where the guardian wants to be: anchor points around the owner and a cheap
// free-spot search so it never parks inside blocks. All positions here are EYE
// CENTRE positions; subtract MOVE.EYE_OFFSET to get the entity origin.

import { MOVE } from './config.js';
import { DEG_TO_RAD, isSpaceFree } from './util.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Dimension} Dimension */

/**
 * Horizontal forward/right unit vectors for a yaw in degrees
 * (yaw 0 faces +Z; facing +Z your right hand points to -X).
 * @param {number} yawDeg
 */
export function basis(yawDeg) {
  const yaw = yawDeg * DEG_TO_RAD;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { fx: -sin, fz: cos, rx: -cos, rz: -sin };
}

/**
 * Hover point over the owner's right shoulder with a slow, creepy bob and drift.
 * @param {Vector3} ownerLocation @param {number} yawDeg smoothed owner yaw @param {number} t time in ticks (phase-shifted)
 * @returns {Vector3}
 */
export function shoulderAnchor(ownerLocation, yawDeg, t) {
  const b = basis(yawDeg);
  const side = MOVE.SHOULDER_RIGHT + Math.sin(t * 0.031) * MOVE.ORBIT_AMPLITUDE;
  const back = MOVE.SHOULDER_BACK + Math.cos(t * 0.023) * 0.2;
  return {
    x: ownerLocation.x + b.rx * side - b.fx * back,
    y: ownerLocation.y + MOVE.SHOULDER_UP + Math.sin(t * 0.07) * MOVE.BOB_AMPLITUDE,
    z: ownerLocation.z + b.rz * side - b.fz * back,
  };
}

/**
 * Shield mode: a slow tight circle directly above the owner's head.
 * @param {Vector3} ownerLocation @param {number} t
 * @returns {Vector3}
 */
export function shieldAnchor(ownerLocation, t) {
  return {
    x: ownerLocation.x + Math.cos(t * 0.05) * MOVE.SHIELD_ORBIT,
    y: ownerLocation.y + MOVE.SHIELD_UP + Math.sin(t * 0.07) * MOVE.BOB_AMPLITUDE * 0.6,
    z: ownerLocation.z + Math.sin(t * 0.05) * MOVE.SHIELD_ORBIT,
  };
}

/**
 * Attack position: ~5 blocks from the target on the guardian's side, 2.5 up,
 * slowly strafing around it, never further than the leash from the owner.
 * @param {Vector3} current guardian eye centre @param {Vector3} targetPoint
 * @param {Vector3} ownerLocation @param {number} t
 * @returns {Vector3}
 */
export function engageAnchor(current, targetPoint, ownerLocation, t) {
  let hx = current.x - targetPoint.x;
  let hz = current.z - targetPoint.z;
  let h = Math.sqrt(hx * hx + hz * hz);
  if (h < 0.5) {
    hx = ownerLocation.x - targetPoint.x;
    hz = ownerLocation.z - targetPoint.z;
    h = Math.sqrt(hx * hx + hz * hz);
    if (h < 0.01) {
      hx = 1;
      hz = 0;
      h = 1;
    }
  }
  // Rotating the bearing a little every tick makes it circle the target back and forth.
  const turn = Math.sin(t * 0.02) * 0.04;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const dx = (hx * c - hz * s) / h;
  const dz = (hx * s + hz * c) / h;
  const anchor = {
    x: targetPoint.x + dx * MOVE.ATTACK_DISTANCE,
    y: targetPoint.y + MOVE.ATTACK_HEIGHT,
    z: targetPoint.z + dz * MOVE.ATTACK_DISTANCE,
  };
  const ownerChest = { x: ownerLocation.x, y: ownerLocation.y + 1.5, z: ownerLocation.z };
  const lx = anchor.x - ownerChest.x;
  const ly = anchor.y - ownerChest.y;
  const lz = anchor.z - ownerChest.z;
  const leash = Math.sqrt(lx * lx + ly * ly + lz * lz);
  if (leash > MOVE.LEASH) {
    const k = MOVE.LEASH / leash;
    return { x: ownerChest.x + lx * k, y: ownerChest.y + ly * k, z: ownerChest.z + lz * k };
  }
  return anchor;
}

/**
 * Finds a free eye-centre spot close to `preferred`: the spot itself, then up to
 * 3 blocks higher, then around the owner's head (above, sides, front/back).
 * Returns undefined if nothing nearby is free (e.g. chunk not loaded).
 * @param {Dimension} dimension @param {Vector3} preferred @param {Vector3} ownerHead @param {number} ownerYaw
 * @returns {Vector3 | undefined}
 */
export function findFreeSpot(dimension, preferred, ownerHead, ownerYaw) {
  if (isSpaceFree(dimension, preferred)) return preferred;
  for (let dy = 1; dy <= 3; dy++) {
    const raised = { x: preferred.x, y: preferred.y + dy, z: preferred.z };
    if (isSpaceFree(dimension, raised)) return raised;
  }
  const b = basis(ownerYaw);
  const candidates = [
    { x: ownerHead.x, y: ownerHead.y + 1.1, z: ownerHead.z },
    { x: ownerHead.x + b.rx * 1.0, y: ownerHead.y + 0.4, z: ownerHead.z + b.rz * 1.0 },
    { x: ownerHead.x - b.rx * 1.0, y: ownerHead.y + 0.4, z: ownerHead.z - b.rz * 1.0 },
    { x: ownerHead.x - b.fx * 1.2, y: ownerHead.y + 0.2, z: ownerHead.z - b.fz * 1.2 },
    { x: ownerHead.x + b.fx * 1.2, y: ownerHead.y + 0.2, z: ownerHead.z + b.fz * 1.2 },
  ];
  for (const spot of candidates) {
    if (isSpaceFree(dimension, spot)) return spot;
  }
  return undefined;
}

/**
 * A good place to put (spawn / teleport) the guardian next to its owner.
 * Falls back to just above the owner's head when everything is blocked.
 * @param {Player} owner @param {number} t
 * @returns {Vector3}
 */
export function spotNearOwner(owner, t) {
  const location = owner.location;
  let yaw = 0;
  let head = { x: location.x, y: location.y + 1.62, z: location.z };
  try {
    yaw = owner.getRotation().y;
    head = owner.getHeadLocation();
  } catch {
    // use defaults
  }
  const raw = shoulderAnchor(location, yaw, t);
  return findFreeSpot(owner.dimension, raw, head, yaw) ?? { x: head.x, y: head.y + 0.6, z: head.z };
}
