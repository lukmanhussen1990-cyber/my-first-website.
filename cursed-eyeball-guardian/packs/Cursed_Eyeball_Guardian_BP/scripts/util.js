// Small shared helpers: vector maths, defensive engine wrappers, effects.
// Engine calls on entities/blocks can throw at any time (entity unloaded, chunk
// not loaded, position outside the world), so every wrapper here swallows those
// errors and returns a safe default instead.

import { world, system, MolangVariableMap } from '@minecraft/server';
import { PLAYER_TYPE_ID, SKINS } from './config.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').EntityHealthComponent} EntityHealthComponent */

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Vector maths (plain {x,y,z} objects; never mutate inputs)
// ---------------------------------------------------------------------------

/** @param {number} x @param {number} y @param {number} z @returns {Vector3} */
export function vec(x, y, z) {
  return { x, y, z };
}

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** @param {Vector3} a @param {number} s @returns {Vector3} */
export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/** @param {Vector3} a */
export function length(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

/** @param {Vector3} a @param {Vector3} b */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** @param {Vector3} a @returns {Vector3} unit vector (or zero vector) */
export function normalize(a) {
  const len = length(a);
  return len > 1e-6 ? { x: a.x / len, y: a.y / len, z: a.z / len } : { x: 0, y: 0, z: 0 };
}

/** @param {Vector3} a @param {Vector3} b @param {number} t @returns {Vector3} */
export function lerpVec(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Wraps an angle in degrees into [-180, 180). @param {number} deg */
export function wrapDegrees(deg) {
  let d = (deg + 180) % 360;
  if (d < 0) d += 360;
  return d - 180;
}

/** Interpolates between two angles (degrees) along the shortest arc. @param {number} from @param {number} to @param {number} t */
export function lerpAngle(from, to, t) {
  return wrapDegrees(from + wrapDegrees(to - from) * t);
}

/**
 * Minecraft yaw/pitch (degrees) that look from `from` towards `to`.
 * yaw 0 = +Z (south), 90 = -X (west); positive pitch looks down.
 * @param {Vector3} from @param {Vector3} to
 */
export function yawPitch(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const horizontal = Math.sqrt(dx * dx + dz * dz);
  return {
    yaw: Math.atan2(-dx, dz) * RAD_TO_DEG,
    pitch: clamp(-Math.atan2(dy, horizontal) * RAD_TO_DEG, -89, 89),
  };
}

/** Unit view vector for a Minecraft yaw/pitch pair (degrees). @param {number} yaw @param {number} pitch @returns {Vector3} */
export function directionFromYawPitch(yaw, pitch) {
  const y = yaw * DEG_TO_RAD;
  const p = pitch * DEG_TO_RAD;
  const c = Math.cos(p);
  return { x: -Math.sin(y) * c, y: -Math.sin(p), z: Math.cos(y) * c };
}

// ---------------------------------------------------------------------------
// Defensive entity helpers
// ---------------------------------------------------------------------------

/**
 * Entity.isValid() is a method in @minecraft/server 1.10.0 and handles can go
 * stale at any moment (unload, death, removal).
 * @param {Entity | undefined} entity
 * @returns {entity is Entity}
 */
export function isValid(entity) {
  if (!entity) return false;
  try {
    return entity.isValid();
  } catch {
    return false;
  }
}

/** @param {Entity} entity @returns {EntityHealthComponent | undefined} */
export function getHealth(entity) {
  try {
    return /** @type {EntityHealthComponent | undefined} */ (entity.getComponent('minecraft:health'));
  } catch {
    return undefined;
  }
}

/**
 * Valid and not dead. Entities without a health component count as alive.
 * @param {Entity | undefined} entity
 * @returns {entity is Entity}
 */
export function isAlive(entity) {
  if (!isValid(entity)) return false;
  const health = getHealth(entity);
  if (!health) return true;
  try {
    return health.currentValue > 0;
  } catch {
    return false;
  }
}

/** Tamed mobs carry the minecraft:is_tamed component. @param {Entity} entity */
export function isTamed(entity) {
  try {
    return entity.hasComponent('minecraft:is_tamed');
  } catch {
    return false;
  }
}

/** @param {Entity | undefined} entity */
export function isPlayerEntity(entity) {
  try {
    return !!entity && entity.typeId === PLAYER_TYPE_ID;
  } catch {
    return false;
  }
}

/**
 * Narrows an entity to Player by type id (works without relying on instanceof).
 * @param {Entity | undefined} entity
 * @returns {Player | undefined}
 */
export function asPlayer(entity) {
  return isPlayerEntity(entity) ? /** @type {Player} */ (entity) : undefined;
}

/** @param {string} playerId @returns {Player | undefined} */
export function findOnlinePlayer(playerId) {
  try {
    for (const player of world.getAllPlayers()) {
      if (player.id === playerId) return player;
    }
  } catch {
    // world not ready
  }
  return undefined;
}

/**
 * Readable name for chat/action bar ("minecraft:cave_spider" -> "Cave Spider").
 * @param {Entity} entity
 */
export function displayName(entity) {
  try {
    if (entity.nameTag) return entity.nameTag;
    const raw = entity.typeId.split(':').pop() ?? entity.typeId;
    return raw
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  } catch {
    return 'target';
  }
}

// ---------------------------------------------------------------------------
// Logging (rate limited - no console spam on phones)
// ---------------------------------------------------------------------------

/** @type {Map<string, number>} */
const lastWarnTick = new Map();

/**
 * console.warn at most once every 600 ticks per key.
 * @param {string} key
 * @param {unknown} error
 */
export function warnOnce(key, error) {
  const now = system.currentTick;
  const last = lastWarnTick.get(key);
  if (last !== undefined && now - last < 600) return;
  lastWarnTick.set(key, now);
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.warn(`[Cursed Eyeball Guardian] ${key}: ${text}`);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** @param {Player} player @param {string} text */
export function tell(player, text) {
  try {
    player.sendMessage(text);
  } catch {
    // player left
  }
}

/** @param {Player} player @param {string} text */
export function actionBar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left
  }
}

// ---------------------------------------------------------------------------
// Particles & sounds
// ---------------------------------------------------------------------------

/** One cached colour map per skin; spawnParticle copies the variables. @type {Array<MolangVariableMap | undefined>} */
const colorMaps = [];

/**
 * MolangVariableMap with variable.color = the skin's primary colour.
 * Created lazily (never at module load time).
 * @param {number} skin
 */
export function colorMap(skin) {
  const index = clamp(Math.floor(skin) || 0, 0, SKINS.length - 1);
  let map = colorMaps[index];
  if (!map) {
    map = new MolangVariableMap();
    map.setColorRGB('variable.color', SKINS[index].primary);
    colorMaps[index] = map;
  }
  return map;
}

/**
 * Spawns a script particle tinted with the skin colour; silently ignores
 * unloaded chunks / out-of-world positions.
 * @param {Dimension} dimension @param {string} id @param {Vector3} location @param {number} skin
 */
export function spawnFx(dimension, id, location, skin) {
  try {
    dimension.spawnParticle(id, location, colorMap(skin));
  } catch {
    // chunk not loaded / outside world
  }
}

/**
 * World sound at a position (Dimension has no playSound in 1.10.0).
 * @param {string} id @param {Vector3} location @param {number} [volume] @param {number} [pitch]
 */
export function playSoundAt(id, location, volume = 1, pitch = 1) {
  try {
    world.playSound(id, location, { volume, pitch });
  } catch {
    // ignore
  }
}

/** Sound only the given player hears. @param {Player} player @param {string} id @param {number} [volume] @param {number} [pitch] */
export function playerSound(player, id, volume = 1, pitch = 1) {
  try {
    player.playSound(id, { volume, pitch });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Block space queries
// ---------------------------------------------------------------------------

/** @type {Map<string, {min: number, max: number}>} */
const heightRanges = new Map();

/** @param {Dimension} dimension */
function heightRangeOf(dimension) {
  let range = heightRanges.get(dimension.id);
  if (!range) {
    const r = dimension.heightRange;
    range = { min: r.min, max: r.max };
    heightRanges.set(dimension.id, range);
  }
  return range;
}

/**
 * True when the block containing the point is air or liquid. Unloaded chunks and
 * positions below the world count as blocked; above the build limit is open.
 * Non-air passable blocks (grass, flowers) are treated as blocked on purpose:
 * Block has no typeId/isSolid in 1.10.0 and the guardian flies at head height.
 * @param {Dimension} dimension @param {number} x @param {number} y @param {number} z
 */
export function isOpenBlock(dimension, x, y, z) {
  try {
    const range = heightRangeOf(dimension);
    const by = Math.floor(y);
    if (by < range.min) return false;
    if (by >= range.max) return true;
    const block = dimension.getBlock({ x: Math.floor(x), y: by, z: Math.floor(z) });
    if (!block) return false;
    return block.isAir || block.isLiquid;
  } catch {
    return false;
  }
}

/**
 * Can the guardian's eye centre sit here (checks the bottom and top of its 1-block-tall box)?
 * @param {Dimension} dimension @param {Vector3} center
 */
export function isSpaceFree(dimension, center) {
  const low = center.y - 0.45;
  const high = center.y + 0.45;
  if (!isOpenBlock(dimension, center.x, low, center.z)) return false;
  if (Math.floor(low) === Math.floor(high)) return true;
  return isOpenBlock(dimension, center.x, high, center.z);
}

/**
 * Block-only line of sight (passable blocks and liquids do not block).
 * @param {Dimension} dimension @param {Vector3} from @param {Vector3} to
 */
export function hasLineOfSight(dimension, from, to) {
  const delta = sub(to, from);
  const len = length(delta);
  if (len < 0.6) return true;
  try {
    const hit = dimension.getBlockFromRay(from, scale(delta, 1 / len), {
      maxDistance: len - 0.3,
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
    return !hit;
  } catch {
    return false;
  }
}
