import { EntityDamageCause, system } from "@minecraft/server";
import { peekState } from "./state.js";
import { alive } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * Entities hit by a cursed technique this tick. Infinity lets these hits
 * through (technique vs technique), so Gojo players can still fight each other.
 * @type {Map<string, number>}
 */
const techniqueHits = new Map();

/** @param {string} entityId */
export function wasTechniqueHit(entityId) {
  const t = techniqueHits.get(entityId);
  return t !== undefined && system.currentTick - t <= 1;
}

export function pruneTechniqueHits() {
  const now = system.currentTick;
  for (const [id, t] of techniqueHits) if (now - t > 2) techniqueHits.delete(id);
}

/**
 * Damage multiplier for the caster (Six Eyes precision).
 * @param {Entity} caster
 */
export function damageMultiplier(caster) {
  const st = peekState(caster.id);
  return st && st.sixEyes ? 1.25 : 1;
}

/**
 * Apply technique damage. The caster can never damage itself.
 * @param {Entity} target
 * @param {number} amount
 * @param {Entity} caster
 * @param {EntityDamageCause} [cause]
 * @returns {boolean}
 */
export function hurt(target, amount, caster, cause = EntityDamageCause.entityAttack) {
  if (!alive(target) || target.id === caster.id || amount <= 0) return false;
  techniqueHits.set(target.id, system.currentTick);
  const dmg = Math.round(amount * damageMultiplier(caster) * 10) / 10;
  try {
    if (alive(caster)) return target.applyDamage(dmg, { cause, damagingEntity: caster });
    return target.applyDamage(dmg, { cause });
  } catch {
    try {
      return target.applyDamage(dmg);
    } catch {
      return false;
    }
  }
}

/**
 * Horizontal knockback that works for players and mobs alike.
 * @param {Entity} target
 * @param {number} dirX
 * @param {number} dirZ
 * @param {number} horizontal
 * @param {number} vertical
 */
export function knock(target, dirX, dirZ, horizontal, vertical) {
  try {
    target.applyKnockback(dirX, dirZ, horizontal, vertical);
  } catch {
    // some entities (e.g. ender dragon parts) reject knockback
  }
}

/**
 * Set an entity's velocity towards `velocity`. Mobs/items/projectiles use
 * impulses; players (which reject impulses) get the closest knockback.
 * @param {Entity} target
 * @param {Vector3} velocity
 */
export function setVelocity(target, velocity) {
  try {
    if (target.typeId === "minecraft:player") {
      const h = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      if (h > 1e-3) target.applyKnockback(velocity.x / h, velocity.z / h, h, velocity.y);
      else target.applyKnockback(0, 0, 0, velocity.y);
      return;
    }
    target.clearVelocity();
    target.applyImpulse(velocity);
  } catch {
    // entity cannot be moved (e.g. riding, invulnerable parts)
  }
}

/**
 * Add an effect without ever throwing.
 * @param {Entity} target
 * @param {string} effect
 * @param {number} ticks
 * @param {number} amplifier
 */
export function effect(target, effect, ticks, amplifier) {
  try {
    target.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // entity may be immune (e.g. undead to regeneration) or invalid
  }
}
