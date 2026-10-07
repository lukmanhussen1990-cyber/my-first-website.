// @ts-check
/**
 * Small helpers shared by the weapons: particles, sounds, damage, healing,
 * target queries and safe teleports.  Everything that can throw because a
 * chunk unloaded or an entity died is wrapped so one bad shot never breaks
 * the tick loop.
 */
import { GameMode, MolangVariableMap } from "@minecraft/server";
import * as V from "./vec.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").RGB} RGB */
/** @typedef {import("@minecraft/server").EntityHealthComponent} EntityHealthComponent */

/** Entities a bullet should fly straight through. */
export const IGNORED_TYPES = [
  "minecraft:item",
  "minecraft:xp_orb",
  "minecraft:arrow",
  "minecraft:thrown_trident",
  "minecraft:snowball",
  "minecraft:egg",
  "minecraft:ender_pearl",
  "minecraft:fireworks_rocket",
  "minecraft:lightning_bolt",
  "minecraft:area_effect_cloud",
  "minecraft:leash_knot",
  "minecraft:painting",
  "minecraft:tnt",
  "minecraft:falling_block",
  "minecraft:fishing_hook",
];

export const TARGET_FILTER = {
  excludeTypes: IGNORED_TYPES,
  excludeFamilies: ["inanimate"],
  excludeGameModes: [GameMode.creative, GameMode.spectator],
};

/**
 * Spawn a particle; `color` is exposed to the effect as variable.color.
 * @param {Dimension} dim @param {string} id @param {Vector3} at @param {RGB} [color]
 * @param {Vector3} [direction]
 */
export function fx(dim, id, at, color, direction) {
  try {
    if (color || direction) {
      const vars = new MolangVariableMap();
      if (color) vars.setColorRGB("variable.color", color);
      if (direction) vars.setVector3("variable.direction", direction);
      dim.spawnParticle(id, at, vars);
    } else {
      dim.spawnParticle(id, at);
    }
  } catch {}
}

/** @param {Dimension} dim @param {string} id @param {Vector3} at @param {number} [pitch] @param {number} [volume] */
export function sound(dim, id, at, pitch = 1, volume = 1) {
  try {
    dim.playSound(id, at, { pitch, volume });
  } catch {}
}

/** @param {Entity} e @returns {EntityHealthComponent | undefined} */
export function health(e) {
  try {
    return /** @type {EntityHealthComponent | undefined} */ (e.getComponent("minecraft:health"));
  } catch {
    return undefined;
  }
}

/**
 * Queue damage on the shot's volley.  Damage from every pellet / blast of
 * one trigger pull is summed and applied once at the end of the tick, so
 * shotgun pellets are not eaten by the target's hurt cooldown.
 * @param {{ volley: { hits: Map<string, { entity: Entity, damage: number }> }, mods: { damage: number } }} shot
 * @param {Entity} e @param {number} amount
 */
export function hurt(shot, e, amount) {
  amount *= shot.mods.damage;
  const prev = shot.volley.hits.get(e.id);
  if (prev) prev.damage += amount;
  else shot.volley.hits.set(e.id, { entity: e, damage: amount });
}

/** @param {Entity} e @param {number} amount */
export function heal(e, amount) {
  const h = health(e);
  if (!h) return;
  try {
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch {}
}

/**
 * Living entities around a point, never the shooter.
 * @param {Dimension} dim @param {Vector3} at @param {number} radius @param {string} ownerId
 */
export function nearbyTargets(dim, at, radius, ownerId) {
  /** @type {Entity[]} */
  let list = [];
  try {
    list = dim.getEntities({ location: at, maxDistance: radius, ...TARGET_FILTER });
  } catch {}
  return list.filter((e) => e.id !== ownerId && e.isValid() && health(e) !== undefined);
}

/** @param {Entity} e @param {Vector3} dest */
export function safeTeleport(e, dest) {
  try {
    return e.tryTeleport(dest, { checkForBlocks: true, keepVelocity: false });
  } catch {
    return false;
  }
}

/** @param {Entity} e */
export function isUndead(e) {
  try {
    return e.matches({ families: ["undead"] });
  } catch {
    return false;
  }
}

/** Unit vector from the shooter's eyes along the crosshair. @param {Entity} e */
export function aim(e) {
  return V.norm(e.getViewDirection());
}
