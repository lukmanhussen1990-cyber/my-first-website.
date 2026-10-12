// The per-tick "brain" of a guardian. The entity has no AI goals at all: this
// module steers it with velocity (clearVelocity + applyImpulse), turns it with
// setRotation, picks targets (every few ticks) and triggers the laser.

import { MODE, MODE_SCAN_RANGE, MOVE, RAGE, TIMING } from './config.js';
import { getData } from './store.js';
import { scheduleRespawn, teleportGuardianToOwner } from './registry.js';
import { aimPoint, clearTarget, endRage, isValidTarget, scanForHostile, setTarget, tryFire } from './combat.js';
import { tickAbilities } from './abilities.js';
import { engageAnchor, findFreeSpot, shieldAnchor, shoulderAnchor } from './placement.js';
import { add, clamp, distance, isSpaceFree, isValid, lerpAngle, sub, yawPitch } from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('./registry.js').GuardianState} GuardianState */
/** @typedef {import('./store.js').GuardianData} GuardianData */

const ZERO = { x: 0, y: 0, z: 0 };

/**
 * Re-evaluates the target (called every SCAN_INTERVAL ticks).
 * Priority: revenge > commanded/assist > nearest visible hostile in range.
 * @param {GuardianState} state @param {GuardianData} data @param {number} tick
 */
export function updateTarget(state, data, tick) {
  if (data.mode === MODE.PASSIVE) {
    state.revenge = undefined;
    state.command = undefined;
    clearTarget(state);
    return;
  }
  const ownerLocation = state.owner.location;

  if (state.revenge) {
    const r = state.revenge;
    if (tick < state.revengeUntil && isValidTarget(r, state, true) && withinDistance(r, ownerLocation, TIMING.REVENGE_MAX_DISTANCE)) {
      setTarget(state, r, 'revenge');
      return;
    }
    state.revenge = undefined;
  }

  if (state.command) {
    const c = state.command;
    if (tick < state.commandUntil && isValidTarget(c, state, true) && withinDistance(c, ownerLocation, TIMING.REVENGE_MAX_DISTANCE + 8)) {
      setTarget(state, c, 'command');
      return;
    }
    state.command = undefined;
  }

  const range = MODE_SCAN_RANGE[data.mode];
  if (range <= 0) {
    clearTarget(state);
    return;
  }
  // Keep a still-valid automatic target instead of rescanning (cheaper, no flicker).
  const current = state.target;
  if (current && state.targetKind === 'auto' && isValidTarget(current, state, false) && withinDistance(current, ownerLocation, range + 2)) {
    return;
  }
  const found = scanForHostile(state, range);
  if (found) setTarget(state, found, 'auto');
  else clearTarget(state);
}

/** @param {Entity} entity @param {Vector3} point @param {number} max */
function withinDistance(entity, point, max) {
  try {
    return distance(entity.location, point) <= max;
  } catch {
    return false;
  }
}

/**
 * Desired eye-centre position this tick (before obstacle correction).
 * @param {GuardianState} state @param {GuardianData} data @param {Vector3} center @param {number} tick
 * @returns {Vector3}
 */
function rawAnchor(state, data, center, tick) {
  const owner = state.owner;
  const ownerLocation = owner.location;
  const t = tick + state.phase * 13;
  const target = state.target;
  const engaging =
    !!target && (state.targetKind === 'revenge' || state.targetKind === 'command' || data.mode === MODE.ATTACK);
  if (engaging && target && isValid(target)) {
    try {
      return engageAnchor(center, aimPoint(target), ownerLocation, t);
    } catch {
      // fall back to the normal anchor
    }
  }
  if (data.mode === MODE.SHIELD) return shieldAnchor(ownerLocation, t);
  let yaw = state.smoothYaw;
  try {
    yaw = owner.getRotation().y;
  } catch {
    // keep
  }
  state.smoothYaw = lerpAngle(state.smoothYaw, yaw, MOVE.YAW_FOLLOW);
  return shoulderAnchor(ownerLocation, state.smoothYaw, t);
}

/**
 * Raw anchor + cached obstacle correction (re-checked every other tick).
 * @param {GuardianState} state @param {GuardianData} data @param {Vector3} center @param {number} tick
 * @returns {Vector3}
 */
function resolveAnchor(state, data, center, tick) {
  const raw = rawAnchor(state, data, center, tick);
  if (tick >= state.anchorCheckTick) {
    state.anchorCheckTick = tick + MOVE.ANCHOR_CHECK_INTERVAL;
    const owner = state.owner;
    const dimension = owner.dimension;
    if (isSpaceFree(dimension, raw)) {
      state.anchorShift = undefined;
    } else {
      let head;
      let yaw = 0;
      try {
        head = owner.getHeadLocation();
        yaw = owner.getRotation().y;
      } catch {
        const l = owner.location;
        head = { x: l.x, y: l.y + 1.62, z: l.z };
      }
      const spot = findFreeSpot(dimension, raw, head, yaw);
      state.anchorShift = spot ? sub(spot, raw) : undefined;
    }
  }
  return state.anchorShift ? add(raw, state.anchorShift) : raw;
}

/**
 * Velocity steering towards the anchor: (anchor - pos) * gain, clamped, blended
 * with the current velocity for smooth, floaty motion.
 * @param {GuardianState} state @param {Entity} guardian @param {Vector3} center @param {Vector3} anchor
 */
function steer(state, guardian, center, anchor) {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const dz = anchor.z - center.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  let vx = 0;
  let vy = 0;
  let vz = 0;
  if (dist > MOVE.ARRIVE_EPSILON) {
    const maxSpeed = MOVE.MAX_SPEED * (state.raging ? RAGE.SPEED_MULT : 1);
    vx = dx * MOVE.GAIN;
    vy = dy * MOVE.GAIN;
    vz = dz * MOVE.GAIN;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > maxSpeed) {
      const k = maxSpeed / speed;
      vx *= k;
      vy *= k;
      vz *= k;
    }
  }
  let current = ZERO;
  try {
    current = guardian.getVelocity();
  } catch {
    // keep zero
  }
  const a = MOVE.SMOOTHING;
  const nx = current.x + (vx - current.x) * a;
  const ny = current.y + (vy - current.y) * a;
  const nz = current.z + (vz - current.z) * a;
  try {
    guardian.clearVelocity();
    if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) > 1e-4) guardian.applyImpulse({ x: nx, y: ny, z: nz });
  } catch {
    // entity unloaded mid-tick
  }
}

/**
 * Teleports to a free spot when it has been pushing against a wall for ~1.5 s.
 * @param {GuardianState} state @param {Vector3} center @param {Vector3} anchor @param {number} tick
 */
function watchStuck(state, center, anchor, tick) {
  const last = state.lastCenter;
  state.lastCenter = center;
  if (!last) return;
  const moved = distance(center, last);
  const away = distance(center, anchor);
  if (away > MOVE.STUCK_DISTANCE && moved < MOVE.STUCK_MOVE_EPSILON) state.stuckTicks++;
  else if (state.stuckTicks > 0) state.stuckTicks--;
  if (state.stuckTicks >= MOVE.STUCK_TICKS) {
    state.stuckTicks = 0;
    if (!teleportGuardianToOwner(state, tick, true)) scheduleRespawn(state, tick, 1);
  }
}

/**
 * Turns the eye: towards the target, otherwise where the owner is looking
 * (with an occasional creepy glance at the owner's face).
 * @param {GuardianState} state @param {Entity} guardian @param {Vector3} center @param {number} tick
 */
function face(state, guardian, center, tick) {
  /** @type {Vector3} */
  let look;
  const target = state.target;
  try {
    if (target && isValid(target)) {
      look = aimPoint(target);
    } else {
      const head = state.owner.getHeadLocation();
      if ((tick + state.phase * 7) % 200 < 30) {
        look = head;
      } else {
        const view = state.owner.getViewDirection();
        look = {
          x: head.x + view.x * MOVE.LOOK_AHEAD,
          y: head.y + view.y * MOVE.LOOK_AHEAD,
          z: head.z + view.z * MOVE.LOOK_AHEAD,
        };
      }
    }
  } catch {
    return;
  }
  const desired = yawPitch(center, look);
  const k = target ? 0.5 : 0.22;
  state.yaw = lerpAngle(state.yaw, desired.yaw, k);
  state.pitch = clamp(state.pitch + (desired.pitch - state.pitch) * k, -89, 89);
  try {
    guardian.setRotation({ x: state.pitch, y: state.yaw });
  } catch {
    // ignore
  }
}

/**
 * One tick of guardian behaviour. Assumes registry.maintainState() returned true.
 * @param {GuardianState} state @param {number} tick
 */
export function tickGuardian(state, tick) {
  const guardian = state.entity;
  const owner = state.owner;
  if (!guardian || !owner) return;

  let location;
  let ownerLocation;
  try {
    if (guardian.dimension.id !== owner.dimension.id) {
      scheduleRespawn(state, tick, TIMING.DIMENSION_RESPAWN_DELAY);
      return;
    }
    location = guardian.location;
    ownerLocation = owner.location;
  } catch {
    return;
  }
  const data = getData(owner);
  const center = { x: location.x, y: location.y + MOVE.EYE_OFFSET, z: location.z };

  // Too far away (owner sprinted/flew/teleported): blink back next to them.
  const ownerChest = { x: ownerLocation.x, y: ownerLocation.y + 1.2, z: ownerLocation.z };
  if (distance(center, ownerChest) > MOVE.TELEPORT_DISTANCE) {
    if (!teleportGuardianToOwner(state, tick, true)) scheduleRespawn(state, tick, 1);
    return;
  }

  if (state.raging && tick >= state.rageUntil) endRage(state);

  if ((tick + state.phase) % TIMING.SCAN_INTERVAL === 0) updateTarget(state, data, tick);
  else if (state.target && !isValid(state.target)) clearTarget(state);

  const anchor = resolveAnchor(state, data, center, tick);
  steer(state, guardian, center, anchor);
  watchStuck(state, center, anchor, tick);
  face(state, guardian, center, tick);

  if (state.target && tick >= state.cooldownUntil) tryFire(state, tick);

  tickAbilities(state, data, tick);
}
