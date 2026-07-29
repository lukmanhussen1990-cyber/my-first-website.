/**
 * Imran Security House - safe wrappers around the Minecraft APIs.
 *
 * Nothing in here is allowed to throw: chunks unload and players disconnect
 * mid-loop all the time, and one uncaught error would stop the build queue or
 * the horde for everybody.
 */

import { world, BlockPermutation } from "@minecraft/server";

/* ------------------------------------------------------------------- math -- */

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
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

/* ------------------------------------------------------------------ world -- */

export function getBlockSafe(dimension, loc) {
  try {
    return dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
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

export function isPassableId(typeId) {
  if (typeId === undefined) return false;
  if (
    typeId === "minecraft:air" ||
    typeId === "minecraft:cave_air" ||
    typeId === "minecraft:void_air" ||
    typeId === "minecraft:water" ||
    typeId === "minecraft:flowing_water"
  ) {
    return true;
  }
  const soft = ["grass", "fern", "flower", "torch", "vine", "seagrass", "kelp", "sapling", "carpet", "snow_layer"];
  return soft.some((word) => typeId.includes(word));
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

/** Highest solid block at x/z scanning down from `fromY`. */
export function groundY(dimension, x, z, fromY, span = 32) {
  const range = heightRange(dimension);
  let y = Math.min(Math.max(Math.floor(fromY), range.min), range.max - 1);
  const stop = Math.max(range.min, y - span);
  for (; y >= stop; y--) {
    const id = blockIdAt(dimension, { x, y, z });
    if (id === undefined) return undefined;
    if (!isPassableId(id)) return y;
  }
  return undefined;
}

/* --------------------------------------------------------------- entities -- */

export function entitiesNear(dimension, location, radius, options = {}) {
  try {
    const query = { location, maxDistance: radius };
    if (options.excludeFamilies) query.excludeFamilies = options.excludeFamilies;
    if (options.type) query.type = options.type;
    return dimension.getEntities(query);
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

export function isValidEntity(entity) {
  if (!entity) return false;
  try {
    return typeof entity.isValid === "function" ? entity.isValid() : entity.isValid !== false;
  } catch {
    return false;
  }
}

export function damageEntity(entity, amount, source) {
  try {
    entity.applyDamage(Math.max(1, Math.round(amount)), {
      cause: source?.cause ?? "entityAttack",
      damagingEntity: source?.by
    });
    return true;
  } catch {
    try {
      entity.applyDamage(Math.max(1, Math.round(amount)));
      return true;
    } catch {
      return false;
    }
  }
}

export function pushEntity(entity, vector) {
  try {
    if (entity.typeId === "minecraft:player") {
      entity.applyKnockback(vector.x, vector.z, Math.hypot(vector.x, vector.z) * 3, vector.y);
      return true;
    }
    entity.applyImpulse(vector);
    return true;
  } catch {
    try {
      entity.applyKnockback({ x: vector.x, z: vector.z }, vector.y);
      return true;
    } catch {
      return false;
    }
  }
}

export function addEffectSafe(entity, effect, seconds, amplifier = 0, showParticles = true) {
  try {
    entity.addEffect(effect, Math.max(1, Math.round(seconds * 20)), { amplifier, showParticles });
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

export function healEntity(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return false;
    const max = health.effectiveMax ?? health.defaultValue ?? 20;
    health.setCurrentValue(Math.min(max, health.currentValue + amount));
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

export function teleportSafe(entity, location) {
  try {
    entity.teleport(location);
    return true;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------- items & gear -- */

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


/* --------------------------------------------------------- effects & text -- */

export function spawnParticleSafe(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
    return true;
  } catch {
    return false;
  }
}

/** Draws a line of particles between two points. */
export function particleLine(dimension, from, to, particleId, spacing = 0.5) {
  const delta = sub(to, from);
  const steps = Math.max(1, Math.floor(length(delta) / spacing));
  const step = scale(delta, 1 / steps);
  let point = { ...from };
  for (let i = 0; i < steps; i++) {
    point = add(point, step);
    spawnParticleSafe(dimension, particleId, point);
  }
}

/** Draws a ring of particles around a point. */
export function particleRing(dimension, center, radius, particleId, count = 24, yOffset = 0.2) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    spawnParticleSafe(dimension, particleId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + yOffset,
      z: center.z + Math.sin(angle) * radius
    });
  }
}

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
    for (const player of playersNear(dimension, location, 40)) {
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

export function actionBar(player, message) {
  try {
    player.onScreenDisplay.setActionBar(message);
  } catch {
    // ignore
  }
}

export function sendMessage(player, message) {
  try {
    player.sendMessage(message);
  } catch {
    // ignore
  }
}

export function cameraShake(dimension, location, intensity, seconds, radius) {
  for (const player of playersNear(dimension, location, radius)) {
    try {
      player.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`);
    } catch {
      // ignore
    }
  }
}

/* ------------------------------------------------------------ block edits -- */

export function isAirId(typeId) {
  return typeId === "minecraft:air" || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}

/** Places a block. Snow and ice only ever replace air or water, never builds. */
export function setBlockSafe(dimension, loc, typeId, states) {
  const block = getBlockSafe(dimension, loc);
  if (!block) return false;
  try {
    if (block.typeId === typeId) return false;
    block.setPermutation(
      states ? BlockPermutation.resolve(typeId, states) : BlockPermutation.resolve(typeId)
    );
    return true;
  } catch {
    return false;
  }
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

export function showTitle(player, title, subtitle) {
  try {
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: 5,
      stayDuration: 45,
      fadeOutDuration: 15
    });
  } catch {
    try {
      player.onScreenDisplay.setTitle(title);
    } catch {
      // ignore
    }
  }
}

/**
 * Places a block that needs states, falling back to /setblock when the
 * permutation cannot be resolved (doors are the fussy case).
 */
export function setBlockWithStates(dimension, loc, typeId, states) {
  if (setBlockSafe(dimension, loc, typeId, states)) return true;
  const pairs = Object.entries(states ?? {})
    .map(([key, value]) => `"${key}"=${typeof value === "string" ? `"${value}"` : value}`)
    .join(",");
  const suffix = pairs ? `[${pairs}]` : "";
  return runCommand(
    dimension,
    `setblock ${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)} ${typeId}${suffix}`
  );
}
