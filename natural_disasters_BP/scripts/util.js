/**
 * Natural Disasters - small helpers shared by every disaster.
 *
 * Every world touching call here is wrapped in try/catch: chunks unload, players
 * leave and blocks fall outside the world all the time on a phone, and a single
 * uncaught error would kill the whole tick loop.
 */

import { world, system, BlockPermutation } from "@minecraft/server";
import { TUNING } from "./config.js";

/* ------------------------------------------------------------------ math -- */

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v) {
  const len = length(v);
  return len < 0.00001 ? { x: 0, y: 0, z: 0 } : scale(v, 1 / len);
}

export function distance(a, b) {
  return length(sub(a, b));
}

export function distance2d(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function floorLoc(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

/** Turns a direction into one of the 8 compass names, for the detector readout. */
export function compassName(dx, dz) {
  const names = ["South", "South-West", "West", "North-West", "North", "North-East", "East", "South-East"];
  const angle = Math.atan2(-dx, dz) * (180 / Math.PI);
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return names[index];
}

/* ----------------------------------------------------------------- world -- */

/** Height limits of a dimension, with hard coded fallbacks for old runtimes. */
export function heightRange(dimension) {
  try {
    const range = dimension.heightRange;
    if (range && typeof range.min === "number" && typeof range.max === "number") {
      return { min: range.min, max: range.max };
    }
  } catch {
    // fall through
  }
  if (dimension.id === "minecraft:nether") return { min: 0, max: 128 };
  if (dimension.id === "minecraft:the_end") return { min: 0, max: 256 };
  return { min: -64, max: 320 };
}

/** Block at a location, or undefined when the chunk is not loaded. */
export function getBlockSafe(dimension, loc) {
  try {
    return dimension.getBlock(floorLoc(loc));
  } catch {
    return undefined;
  }
}

export function isAirId(typeId) {
  return typeId === "minecraft:air" || typeId === "minecraft:void_air" || typeId === "minecraft:cave_air";
}

export function isLiquidId(typeId) {
  return (
    typeId === "minecraft:water" ||
    typeId === "minecraft:flowing_water" ||
    typeId === "minecraft:lava" ||
    typeId === "minecraft:flowing_lava"
  );
}

/** Plants, torches, snow layers... anything a wave or a fire may simply erase. */
export function isReplaceableId(typeId) {
  if (isAirId(typeId) || isLiquidId(typeId)) return true;
  const soft = [
    "grass", "fern", "flower", "sapling", "vine", "seagrass", "kelp", "coral",
    "torch", "snow_layer", "deadbush", "bush", "leaves", "mushroom", "sugar_cane",
    "wheat", "carrots", "potatoes", "beetroot", "melon_stem", "pumpkin_stem",
    "double_plant", "tallgrass", "web", "fire", "lily_pad", "pitcher", "azalea",
    "moss_carpet", "carpet", "cobweb", "hanging_roots", "glow_lichen", "sculk_vein",
    "big_dripleaf", "small_dripleaf", "nether_sprouts", "roots", "button", "lever",
    "rail", "pressure_plate", "banner", "sign", "candle", "amethyst_cluster", "bud"
  ];
  return soft.some((word) => typeId.includes(word));
}

/** Blocks the addon must never modify (see TUNING.protectedBlocks). */
export function isProtectedId(typeId) {
  if (TUNING.protectedBlocks.includes(typeId)) return true;
  return (
    typeId.includes("shulker_box") ||
    typeId.includes("command_block") ||
    typeId.includes("portal") ||
    typeId.includes("spawner") ||
    typeId.includes("bed")
  );
}

/**
 * Replaces a block, honouring the protected list.
 * @returns {boolean} true when the block was actually changed.
 */
export function setBlockSafe(dimension, loc, typeId, states) {
  const block = getBlockSafe(dimension, loc);
  if (!block) return false;
  let currentId;
  try {
    currentId = block.typeId;
  } catch {
    return false;
  }
  if (isProtectedId(currentId)) return false;
  if (currentId === typeId) return false;
  try {
    block.setPermutation(
      states ? BlockPermutation.resolve(typeId, states) : BlockPermutation.resolve(typeId)
    );
    return true;
  } catch {
    return false;
  }
}

/** Type id of the block at a location ("minecraft:air" when unknown). */
export function blockIdAt(dimension, loc) {
  const block = getBlockSafe(dimension, loc);
  if (!block) return undefined;
  try {
    return block.typeId;
  } catch {
    return undefined;
  }
}

/**
 * Highest solid block at x/z, scanning down from `fromY`.
 * @returns {number|undefined} the Y of the surface block, not the air above it.
 */
export function groundY(dimension, x, z, fromY, span = 64) {
  const range = heightRange(dimension);
  let y = clamp(Math.floor(fromY), range.min, range.max - 1);
  const stop = Math.max(range.min, y - span);
  for (; y >= stop; y--) {
    const id = blockIdAt(dimension, { x, y, z });
    if (id === undefined) return undefined; // unloaded chunk
    if (!isAirId(id) && !isReplaceableId(id)) return y;
  }
  return undefined;
}

/** First free (air) Y above the surface at x/z. */
export function surfaceY(dimension, x, z, fromY) {
  const ground = groundY(dimension, x, z, fromY);
  return ground === undefined ? undefined : ground + 1;
}

/* --------------------------------------------------------------- entities -- */

/** Pushes an entity. Uses impulses for mobs and knockback for players. */
export function pushEntity(entity, vector) {
  try {
    if (entity.typeId === "minecraft:player") {
      // 1.x signature: applyKnockback(dirX, dirZ, horizontal, vertical)
      entity.applyKnockback(vector.x, vector.z, Math.hypot(vector.x, vector.z) * 3, vector.y);
      return true;
    }
    entity.applyImpulse(vector);
    return true;
  } catch {
    // Newer runtimes changed applyKnockback's signature - try the object form.
    try {
      entity.applyKnockback({ x: vector.x, z: vector.z }, vector.y);
      return true;
    } catch {
      // Last resort: nudge by teleporting.
      try {
        const loc = entity.location;
        entity.teleport(
          { x: loc.x + vector.x * 0.6, y: loc.y + Math.max(0, vector.y) * 0.6, z: loc.z + vector.z * 0.6 },
          { dimension: entity.dimension }
        );
        return true;
      } catch {
        return false;
      }
    }
  }
}

export function damageEntity(entity, amount, cause = "entityAttack") {
  try {
    entity.applyDamage(amount, { cause });
    return true;
  } catch {
    return false;
  }
}

export function igniteEntity(entity, seconds) {
  try {
    entity.setOnFire(seconds, true);
    return true;
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
    return world.getAllPlayers().filter((p) => {
      try {
        return p.dimension.id === dimension.id && distance(p.location, location) <= radius;
      } catch {
        return false;
      }
    });
  }
}

export function allPlayers() {
  try {
    return world.getAllPlayers();
  } catch {
    return [];
  }
}

export function spawnEntitySafe(dimension, identifier, location) {
  try {
    return dimension.spawnEntity(identifier, location);
  } catch {
    return undefined;
  }
}

export function removeEntitySafe(entity) {
  try {
    if (entity && entity.isValid && entity.isValid()) entity.remove();
    else if (entity) entity.remove();
  } catch {
    // already gone
  }
}

export function isValidEntity(entity) {
  if (!entity) return false;
  try {
    return typeof entity.isValid === "function" ? entity.isValid() : entity.isValid !== false;
  } catch {
    return false;
  }
}

export function teleportSafe(entity, location) {
  try {
    entity.teleport(location);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------- effects and text -- */

export function spawnParticleSafe(dimension, id, location, molangVariables) {
  try {
    if (molangVariables) dimension.spawnParticle(id, location, molangVariables);
    else dimension.spawnParticle(id, location);
    return true;
  } catch {
    return false;
  }
}

/**
 * Plays one of our own sound ids plus a vanilla one, so there is always audio
 * even if a device has not loaded the custom .ogg files yet.
 */
export function playSoundAt(dimension, location, customId, vanillaId, options = {}) {
  const opts = { location, volume: options.volume ?? 1, pitch: options.pitch ?? 1 };
  const play = (id) => {
    try {
      world.playSound(id, location, { volume: opts.volume, pitch: opts.pitch });
      return true;
    } catch {
      return false;
    }
  };
  let ok = false;
  if (customId) ok = play(customId) || ok;
  if (vanillaId) ok = play(vanillaId) || ok;
  if (!ok) {
    // Old runtimes only expose Player.playSound.
    for (const player of playersNear(dimension, location, 48)) {
      try {
        player.playSound(vanillaId || customId, { location, volume: opts.volume, pitch: opts.pitch });
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

export function showTitle(player, title, subtitle, fadeIn = 5, stay = 40, fadeOut = 10) {
  try {
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: fadeIn,
      stayDuration: stay,
      fadeOutDuration: fadeOut
    });
  } catch {
    try {
      player.onScreenDisplay.setTitle(title);
    } catch {
      // ignore
    }
  }
}

export function titleAll(title, subtitle) {
  for (const player of allPlayers()) showTitle(player, title, subtitle);
}

/** Runs a slash command on a dimension, tolerating both old and new APIs. */
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

/** Screen shake for everyone close to `location`. */
export function cameraShake(dimension, location, intensity, seconds, radius) {
  for (const player of playersNear(dimension, location, radius)) {
    try {
      player.runCommand(
        `camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`
      );
    } catch {
      runCommand(
        dimension,
        `camerashake add @a[r=${Math.floor(radius)},x=${Math.floor(location.x)},y=${Math.floor(
          location.y
        )},z=${Math.floor(location.z)}] ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`
      );
      return;
    }
  }
}

/** Item currently held in the main hand, or undefined. */
export function heldItem(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (equippable) return equippable.getEquipment("Mainhand");
  } catch {
    // fall through to the inventory lookup
  }
  try {
    const inventory = player.getComponent("minecraft:inventory");
    const slot = player.selectedSlotIndex ?? player.selectedSlot ?? 0;
    return inventory?.container?.getItem(slot);
  } catch {
    return undefined;
  }
}

export function isHolding(player, itemId) {
  const item = heldItem(player);
  try {
    return !!item && item.typeId === itemId;
  } catch {
    return false;
  }
}

/** Formats a tick count as "1m 20s". */
export function formatTicks(ticks) {
  const totalSeconds = Math.max(0, Math.round(ticks / 20));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Runs `fn` on the next tick and swallows anything it throws. */
export function runSafe(fn) {
  system.run(() => {
    try {
      fn();
    } catch (error) {
      console.warn(`[NaturalDisasters] ${error}`);
    }
  });
}
