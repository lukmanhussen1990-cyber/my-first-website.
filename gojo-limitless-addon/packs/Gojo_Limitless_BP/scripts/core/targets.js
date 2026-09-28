import { GameMode } from "@minecraft/server";
import { worldSettings } from "./settings.js";
import { alive } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** Entities that are never damaged or moved by any technique. */
export const NEVER_TARGET = new Set([
  "minecraft:item",
  "minecraft:xp_orb",
  "minecraft:painting",
  "minecraft:leash_knot",
  "minecraft:armor_stand",
  "minecraft:ender_crystal",
  "minecraft:area_effect_cloud",
  "minecraft:lightning_bolt",
  "minecraft:evocation_fang",
  "minecraft:eye_of_ender_signal",
  "minecraft:falling_block",
  "minecraft:tnt",
  "minecraft:tnt_minecart",
  "minecraft:minecart",
  "minecraft:chest_minecart",
  "minecraft:hopper_minecart",
  "minecraft:command_block_minecart",
  "minecraft:boat",
  "minecraft:chest_boat",
  "minecraft:npc",
  "minecraft:agent",
  "minecraft:tripod_camera",
  "minecraft:ominous_item_spawner",
  "minecraft:fishing_hook",
]);

/** Projectiles that Infinity (and the domain) stop in mid-air. */
export const PROJECTILES = new Set([
  "minecraft:arrow",
  "minecraft:snowball",
  "minecraft:egg",
  "minecraft:small_fireball",
  "minecraft:fireball",
  "minecraft:dragon_fireball",
  "minecraft:wither_skull",
  "minecraft:wither_skull_dangerous",
  "minecraft:shulker_bullet",
  "minecraft:llama_spit",
  "minecraft:splash_potion",
  "minecraft:lingering_potion",
  "minecraft:thrown_trident",
  "minecraft:breeze_wind_charge_projectile",
  "minecraft:wind_charge_projectile",
  "minecraft:xp_bottle",
  "minecraft:ender_pearl",
  "minecraft:fireworks_rocket",
]);

/** Loose things Blue may drag along (never damaged). */
export const LOOSE = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:falling_block"]);

const FRIENDLY_TYPES = new Set([
  "minecraft:villager",
  "minecraft:villager_v2",
  "minecraft:wandering_trader",
  "minecraft:allay",
]);

/** Families that mark entities as "hostile" for Six Eyes markers. */
export const HOSTILE_FAMILIES = ["monster"];

/**
 * True for pets / villagers that the "spare friendly mobs" setting protects.
 * @param {Entity} entity
 */
export function isFriendly(entity) {
  try {
    if (FRIENDLY_TYPES.has(entity.typeId)) return true;
    return entity.hasComponent("minecraft:is_tamed");
  } catch {
    return false;
  }
}

/**
 * Can `entity` be hit by a technique cast by `caster`?
 * Never returns true for the caster itself (abilities can't hurt their user).
 * @param {Entity} entity
 * @param {Entity} caster
 */
export function isHostileTarget(entity, caster) {
  if (!alive(entity)) return false;
  if (entity.id === caster.id) return false;
  const type = entity.typeId;
  if (NEVER_TARGET.has(type) || PROJECTILES.has(type)) return false;
  try {
    if (entity.hasTag("gojo_immune")) return false;
    if (type === "minecraft:player") {
      if (!worldSettings().pvp) return false;
      if (entity.matches({ gameMode: GameMode.creative }) || entity.matches({ gameMode: GameMode.spectator })) return false;
      return true;
    }
    if (!entity.hasComponent("minecraft:health")) return false;
    if (worldSettings().spareFriendly && isFriendly(entity)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * All valid targets around a point, closest first.
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @param {number} radius
 * @param {Entity} caster
 * @returns {Entity[]}
 */
export function targetsNear(dimension, location, radius, caster) {
  let list;
  try {
    list = dimension.getEntities({
      location,
      maxDistance: radius,
      excludeFamilies: ["inanimate"],
      excludeGameModes: [GameMode.creative, GameMode.spectator],
      excludeTags: ["gojo_immune"],
    });
  } catch {
    return [];
  }
  return list.filter((e) => isHostileTarget(e, caster));
}

/**
 * Every entity around a point (used by Blue, which also drags items/projectiles).
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @param {number} radius
 * @returns {Entity[]}
 */
export function everythingNear(dimension, location, radius) {
  try {
    return dimension.getEntities({
      location,
      maxDistance: radius,
      excludeGameModes: [GameMode.creative, GameMode.spectator],
      excludeTags: ["gojo_immune"],
    });
  } catch {
    return [];
  }
}

/**
 * Centre of an entity's body (between feet and eyes).
 * @param {Entity} entity
 * @returns {Vector3}
 */
export function bodyCenter(entity) {
  try {
    const feet = entity.location;
    const head = entity.getHeadLocation();
    return { x: feet.x, y: (feet.y + head.y) / 2, z: feet.z };
  } catch {
    const l = entity.location;
    return { x: l.x, y: l.y + 0.9, z: l.z };
  }
}

/**
 * First valid target along the entity's view direction.
 * @param {import("@minecraft/server").Player} player
 * @param {number} maxDistance
 * @returns {Entity | undefined}
 */
export function lookTarget(player, maxDistance) {
  try {
    const hits = player.getEntitiesFromViewDirection({ maxDistance });
    for (const hit of hits) {
      if (isHostileTarget(hit.entity, player)) return hit.entity;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Nearest valid target inside a view cone (aim assist for touch screens).
 * @param {import("@minecraft/server").Player} player
 * @param {number} maxDistance
 * @param {number} minDot cos(half cone angle)
 * @returns {Entity | undefined}
 */
export function coneTarget(player, maxDistance, minDot) {
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  let best;
  let bestScore = Infinity;
  for (const e of targetsNear(player.dimension, eye, maxDistance, player)) {
    const c = bodyCenter(e);
    const dx = c.x - eye.x;
    const dy = c.y - eye.y;
    const dz = c.z - eye.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) continue;
    const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
    if (cos < minDot) continue;
    const score = d * (2 - cos);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}
