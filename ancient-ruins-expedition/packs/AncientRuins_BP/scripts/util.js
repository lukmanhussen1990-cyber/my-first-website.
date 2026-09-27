import { BlockPermutation, GameMode, MolangVariableMap, system } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").RGB} RGB */

/**
 * Block type id. @minecraft/server 1.10.0 has no Block.typeId, so read it
 * from the block's item form (custom blocks share their block identifier).
 * @param {Block | undefined} block
 * @returns {string | undefined}
 */
export function blockIdOf(block) {
  if (!block) return undefined;
  try {
    const item = block.permutation.getItemStack(1);
    return item ? item.typeId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Block | undefined} block
 * @param {string} id
 */
export function isBlock(block, id) {
  if (!block) return false;
  try {
    return block.permutation.matches(id);
  } catch {
    return false;
  }
}

/** @type {Map<string, BlockPermutation>} */
const permCache = new Map();

/** @param {string} id */
export function perm(id) {
  let p = permCache.get(id);
  if (!p) {
    p = BlockPermutation.resolve(id);
    permCache.set(id, p);
  }
  return p;
}

/**
 * @param {Block} block
 * @param {string} id
 */
export function setBlock(block, id) {
  block.setPermutation(perm(id));
}

/**
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @returns {Block | undefined}
 */
export function blockAt(dim, loc) {
  try {
    return dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
  } catch {
    return undefined; // outside the world / unloaded chunk
  }
}

/** @param {Vector3} v */
export function floorVec(v) {
  return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

/** @param {Vector3} v */
export function key(v) {
  return `${Math.floor(v.x)},${Math.floor(v.y)},${Math.floor(v.z)}`;
}

/**
 * @param {Vector3} a
 * @param {Vector3} b
 */
export function distH(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * @param {Vector3} a
 * @param {Vector3} b
 */
export function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** @param {Vector3} v */
export function center(v) {
  return { x: Math.floor(v.x) + 0.5, y: Math.floor(v.y) + 0.5, z: Math.floor(v.z) + 0.5 };
}

/**
 * Spawn a particle; optional tint passed as variable.color.
 * @param {Dimension} dim
 * @param {string} id
 * @param {Vector3} loc
 * @param {RGB} [rgb]
 */
export function particle(dim, id, loc, rgb) {
  try {
    if (rgb) {
      const vars = new MolangVariableMap();
      vars.setColorRGB("variable.color", rgb);
      dim.spawnParticle(id, loc, vars);
    } else {
      dim.spawnParticle(id, loc);
    }
  } catch {
    // Particle outside loaded chunks: ignore.
  }
}

/**
 * Play a positional sound for players near a location.
 * @param {Dimension} dim
 * @param {string} sound
 * @param {Vector3} loc
 * @param {number} [range]
 * @param {number} [volume]
 * @param {number} [pitch]
 */
export function playNear(dim, sound, loc, range = 24, volume = 1, pitch = 1) {
  for (const p of dim.getPlayers({ location: loc, maxDistance: range })) {
    try {
      p.playSound(sound, { location: loc, volume, pitch });
    } catch {
      // Player left mid-loop.
    }
  }
}

/**
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @param {number} range
 * @param {string} message
 */
export function tellNear(dim, loc, range, message) {
  for (const p of dim.getPlayers({ location: loc, maxDistance: range })) {
    try {
      p.sendMessage(message);
    } catch {
      // ignore
    }
  }
}

/** @param {Player} player */
export function isCreativeLike(player) {
  try {
    return player.matches({ gameMode: GameMode.creative }) || player.matches({ gameMode: GameMode.spectator });
  } catch {
    return false;
  }
}

/**
 * Compass-style direction words from a to b (north = -Z).
 * @param {Vector3} from
 * @param {Vector3} to
 */
export function cardinal(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const angle = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = north, 90 = east
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[((Math.round(angle / 45) % 8) + 8) % 8];
}

let lastWarn = 0;
/**
 * Rate-limited console warning so a broken edge case cannot spam the log.
 * @param {string} where
 * @param {unknown} err
 */
export function warn(where, err) {
  const now = Date.now();
  if (now - lastWarn < 5000) return;
  lastWarn = now;
  console.warn(`[Ancient Ruins] ${where}: ${err}`);
}

/** @type {Map<string, number>} */
const lastNotice = new Map();

/**
 * Action-bar notice that the compass readout will not overwrite for 2 s.
 * @param {Player} player
 * @param {string} text
 */
export function notify(player, text) {
  lastNotice.set(player.id, system.currentTick);
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left
  }
}

/** @param {Player} player */
export function recentlyNotified(player) {
  return system.currentTick - (lastNotice.get(player.id) ?? -1e9) < 40;
}

/** @param {string} playerId */
export function forgetNotices(playerId) {
  lastNotice.delete(playerId);
}
