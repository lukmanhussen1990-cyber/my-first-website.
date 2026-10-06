// @ts-check
// Visual/audio feedback helpers of the outbreak. Every helper swallows errors
// (unloaded chunk, invalid entity, ...) and reports success as a boolean.

import { PARTICLES, SOUNDS } from "../lib/ids.js";
import { playSound, playSoundTo, spawnParticle, actionbar } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** Effect ids (valid in 1.21.0.26 mojang-effects.json, no namespace needed). */
export const EFFECTS = Object.freeze({ SLOWNESS: "slowness", NAUSEA: "nausea", HUNGER: "hunger" });

/**
 * Spores at the entity's feet (the particle itself rises ~0.9 blocks).
 * @param {Entity} e
 * @returns {boolean}
 */
export function spores(e) {
  try {
    return spawnParticle(e.dimension, PARTICLES.SPORES, e.location);
  } catch {
    return false;
  }
}

/**
 * @param {Dimension} dim
 * @param {Vector3} loc feet location
 * @returns {boolean}
 */
export function conversionBurst(dim, loc) {
  return spawnParticle(dim, PARTICLES.CONVERSION, { x: loc.x, y: loc.y + 0.5, z: loc.z });
}

/**
 * @param {Dimension} dim
 * @param {Vector3} loc feet location of the newborn
 * @returns {boolean}
 */
export function birthSplatter(dim, loc) {
  return spawnParticle(dim, PARTICLES.BIRTH, loc);
}

/**
 * Sound at an entity's location (audible for everyone nearby).
 * @param {Entity} e
 * @param {string} id
 * @param {import("@minecraft/server").WorldSoundOptions} [opts]
 * @returns {boolean}
 */
export function soundAt(e, id, opts) {
  try {
    return playSound(e.dimension, id, e.location, opts);
  } catch {
    return false;
  }
}

/**
 * Add (refresh) a status effect; never throws.
 * @param {Entity} e
 * @param {string} effectId
 * @param {number} durationTicks
 * @param {number} [amplifier]
 * @returns {boolean}
 */
export function addEffect(e, effectId, durationTicks, amplifier = 0) {
  try {
    e.addEffect(effectId, Math.max(1, Math.floor(durationTicks)), { amplifier, showParticles: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Entity} e
 * @param {string} effectId
 */
export function removeEffect(e, effectId) {
  try {
    e.removeEffect(effectId);
  } catch {
    // effect absent or entity invalid
  }
}

/**
 * Heartbeat for an infected player (only they hear it).
 * @param {Player} p
 * @param {number} [pitch]
 */
export function heartbeat(p, pitch = 1) {
  playSoundTo(p, SOUNDS.INFECTION_HEARTBEAT, { volume: 1, pitch });
}

/**
 * @param {Player} p
 * @param {string} text
 */
export function bar(p, text) {
  actionbar(p, text);
}
