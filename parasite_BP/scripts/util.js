/**
 * Parasite - safe wrappers around the Minecraft APIs.
 *
 * Same rule as everywhere else in this pack: nothing that touches the world is
 * allowed to throw, because a single uncaught error stops the whole tick loop.
 */

import { world, BlockPermutation } from "@minecraft/server";
import { TUNING, getSetting } from "./config.js";

/* ------------------------------------------------------------------- math -- */

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function floorLoc(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

/* ------------------------------------------------------------------ world -- */

export function getBlockSafe(dimension, loc) {
  try {
    return dimension.getBlock(floorLoc(loc));
  } catch {
    return undefined;
  }
}

export function blockIdAt(dimension, loc) {
  const block = getBlockSafe(dimension, loc);
  if (!block) return undefined;
  try {
    return block.typeId;
  } catch {
    return undefined;
  }
}

export function isAirId(typeId) {
  return typeId === "minecraft:air" || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}

/** True when the parasite is allowed to eat this block. */
export function isEdibleId(typeId) {
  if (!typeId || isAirId(typeId)) return false;
  if (TUNING.protectedBlocks.includes(typeId)) return false;
  if (typeId.includes("command_block") || typeId.includes("portal") || typeId.includes("spawner")) return false;
  if (TUNING.containerBlocks.includes(typeId) || typeId.includes("shulker_box")) {
    return getSetting("eatContainers") === true;
  }
  return true;
}

export function setBlockSafe(dimension, loc, typeId, states) {
  const block = getBlockSafe(dimension, loc);
  if (!block) return false;
  try {
    block.setPermutation(
      states ? BlockPermutation.resolve(typeId, states) : BlockPermutation.resolve(typeId)
    );
    return true;
  } catch {
    return false;
  }
}

export function heightRange(dimension) {
  try {
    const range = dimension.heightRange;
    if (range && typeof range.min === "number") return { min: range.min, max: range.max };
  } catch {
    // fall through
  }
  if (dimension.id === "minecraft:nether") return { min: 0, max: 128 };
  if (dimension.id === "minecraft:the_end") return { min: 0, max: 256 };
  return { min: -64, max: 320 };
}

/** Highest solid block at x/z, scanning down from `fromY`. */
export function groundY(dimension, x, z, fromY, span = 24) {
  const range = heightRange(dimension);
  let y = Math.min(Math.max(Math.floor(fromY), range.min), range.max - 1);
  const stop = Math.max(range.min, y - span);
  for (; y >= stop; y--) {
    const id = blockIdAt(dimension, { x, y, z });
    if (id === undefined) return undefined;
    if (!isAirId(id)) return y;
  }
  return undefined;
}

/* --------------------------------------------------------------- entities -- */

export function isValidEntity(entity) {
  if (!entity) return false;
  try {
    return typeof entity.isValid === "function" ? entity.isValid() : entity.isValid !== false;
  } catch {
    return false;
  }
}

export function entitiesNear(dimension, location, radius, options = {}) {
  try {
    return dimension.getEntities({ location, maxDistance: radius, ...options });
  } catch {
    return [];
  }
}

export function playersNear(dimension, location, radius) {
  try {
    return dimension.getPlayers({ location, maxDistance: radius });
  } catch {
    return [];
  }
}

export function allPlayers() {
  try {
    return world.getAllPlayers();
  } catch {
    return [];
  }
}

export function removeEntitySafe(entity) {
  try {
    entity.remove();
    return true;
  } catch {
    return false;
  }
}

export function damageEntity(entity, amount, cause = "entityAttack", damagingEntity) {
  try {
    entity.applyDamage(amount, damagingEntity ? { cause, damagingEntity } : { cause });
    return true;
  } catch {
    return false;
  }
}

export function healEntity(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return false;
    const current = health.currentValue;
    const max = health.effectiveMax ?? health.defaultValue ?? current;
    health.setCurrentValue(Math.min(max, current + amount));
    return true;
  } catch {
    return false;
  }
}

export function triggerEvent(entity, eventName) {
  try {
    entity.triggerEvent(eventName);
    return true;
  } catch {
    return false;
  }
}

export function spawnEntitySafe(dimension, identifier, location) {
  try {
    return dimension.spawnEntity(identifier, location);
  } catch {
    return undefined;
  }
}

/** Entity dynamic property with an in-memory fallback for old runtimes. */
const memory = new Map();

export function getEntityProp(entity, key, fallback) {
  try {
    const value = entity.getDynamicProperty(key);
    if (value !== undefined) return value;
  } catch {
    // fall through
  }
  const stored = memory.get(`${safeId(entity)}:${key}`);
  return stored === undefined ? fallback : stored;
}

export function setEntityProp(entity, key, value) {
  try {
    entity.setDynamicProperty(key, value);
  } catch {
    // fall through
  }
  memory.set(`${safeId(entity)}:${key}`, value);
}

function safeId(entity) {
  try {
    return entity.id;
  } catch {
    return "unknown";
  }
}

/* --------------------------------------------------------- effects & text -- */

export function spawnParticleSafe(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
    return true;
  } catch {
    return false;
  }
}

/** Plays a custom sound id plus a vanilla one so there is always audio. */
export function playSoundAt(dimension, location, customId, vanillaId, options = {}) {
  const volume = options.volume ?? 1;
  const pitch = options.pitch ?? 1;
  const play = (id) => {
    try {
      world.playSound(id, location, { volume, pitch });
      return true;
    } catch {
      return false;
    }
  };
  let ok = false;
  if (customId) ok = play(customId) || ok;
  if (vanillaId) ok = play(vanillaId) || ok;
  if (!ok) {
    for (const player of playersNear(dimension, location, 32)) {
      try {
        player.playSound(vanillaId || customId, { location, volume, pitch });
      } catch {
        // ignore
      }
    }
  }
}

export function playSoundForPlayer(player, customId, vanillaId, options = {}) {
  const opts = { volume: options.volume ?? 1, pitch: options.pitch ?? 1 };
  try {
    player.playSound(customId, opts);
  } catch {
    // ignore
  }
  if (vanillaId) {
    try {
      player.playSound(vanillaId, opts);
    } catch {
      // ignore
    }
  }
}

export function broadcast(message) {
  try {
    world.sendMessage(message);
  } catch {
    for (const player of allPlayers()) {
      try {
        player.sendMessage(message);
      } catch {
        // ignore
      }
    }
  }
}

export function actionBar(player, message) {
  try {
    player.onScreenDisplay.setActionBar(message);
  } catch {
    // ignore
  }
}

export function showTitle(player, title, subtitle) {
  try {
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 10
    });
  } catch {
    // ignore
  }
}

export function heldItem(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (equippable) return equippable.getEquipment("Mainhand");
  } catch {
    // fall through
  }
  try {
    const inventory = player.getComponent("minecraft:inventory");
    const slot = player.selectedSlotIndex ?? player.selectedSlot ?? 0;
    return inventory?.container?.getItem(slot);
  } catch {
    return undefined;
  }
}

export function runCommand(dimension, command) {
  try {
    dimension.runCommand(command);
    return true;
  } catch {
    try {
      dimension.runCommandAsync(command);
      return true;
    } catch {
      return false;
    }
  }
}
