// @ts-check
// Shared helpers (SPEC §4). Only @minecraft/server 1.11.0 APIs are used.
//
// Conventions:
//  * safe(fn, label) RETURNS A WRAPPED FUNCTION; it does not call fn. Use
//      world.afterEvents.x.subscribe(safe((ev) => { ... }, "label"));
//      system.runInterval(safe(tick, "label"), 20);
//    To run something immediately and swallow errors use runSafe(fn, label).
//  * Every helper that touches the world catches its own errors and reports
//    failure through its return value instead of throwing.

import { world, system, GameMode, EquipmentSlot } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Container} Container */
/** @typedef {import("@minecraft/server").EntityEquippableComponent} EntityEquippableComponent */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */
/** @typedef {"Mainhand" | "Offhand"} Hand */
/** @typedef {"north" | "south" | "east" | "west"} Cardinal */

export const DIMENSION_IDS = Object.freeze(["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]);

// ---------------------------------------------------------------------------
// Error containment
// ---------------------------------------------------------------------------

/** How many times each label is logged before it goes quiet (avoids log spam from per-tick loops). */
const MAX_LOGS_PER_LABEL = 5;
/** @type {Map<string, number>} */
const errorCounts = new Map();

/**
 * Log an error once per label (up to MAX_LOGS_PER_LABEL times).
 * @param {string} label
 * @param {unknown} err
 */
export function logError(label, err) {
  const n = (errorCounts.get(label) ?? 0) + 1;
  errorCounts.set(label, n);
  if (n > MAX_LOGS_PER_LABEL) return;
  try {
    const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
    console.warn(`[pas] ${label} failed${n === MAX_LOGS_PER_LABEL ? " (further errors muted)" : ""}: ${msg}`);
  } catch {
    // logging must never throw
  }
}

/** @returns {Map<string, number>} error counts per label (diagnostics / tests). */
export function getErrorCounts() {
  return errorCounts;
}

/**
 * Wrap `fn` so that no exception (or rejected promise) can escape it.
 * Returns the wrapped function; it returns fn's result, or undefined on error.
 * @template {any[]} A
 * @template R
 * @param {(...args: A) => R} fn
 * @param {string} label
 * @returns {(...args: A) => (R | undefined)}
 */
export function safe(fn, label) {
  return (...args) => {
    try {
      const r = fn(...args);
      if (r && typeof r === "object" && typeof (/** @type {any} */ (r).then) === "function") {
        /** @type {Promise<unknown>} */ (/** @type {unknown} */ (r)).catch((e) => logError(label, e));
      }
      return r;
    } catch (e) {
      logError(label, e);
      return undefined;
    }
  };
}

/**
 * Call `fn` immediately; errors are logged and swallowed.
 * @template R
 * @param {() => R} fn
 * @param {string} label
 * @returns {R | undefined}
 */
export function runSafe(fn, label) {
  return safe(fn, label)();
}

// ---------------------------------------------------------------------------
// Vectors
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
/** @param {Vector3} a @param {Vector3} b @returns {number} */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
/** @param {Vector3} a @returns {number} */
export function len(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}
/** @param {Vector3} a @param {Vector3} b @returns {number} */
export function dist(a, b) {
  return len(sub(a, b));
}
/** Unit vector; the zero vector stays zero. @param {Vector3} a @returns {Vector3} */
export function normalize(a) {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
}
/** @param {Vector3} a @returns {Vector3} */
export function floorVec(a) {
  return { x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) };
}
/** Centre of the block containing `blockLoc`. @param {Vector3} blockLoc @returns {Vector3} */
export function center(blockLoc) {
  return { x: Math.floor(blockLoc.x) + 0.5, y: Math.floor(blockLoc.y) + 0.5, z: Math.floor(blockLoc.z) + 0.5 };
}
/** @param {Vector3} a @param {Vector3} b @returns {boolean} */
export function sameBlock(a, b) {
  return (
    Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y) && Math.floor(a.z) === Math.floor(b.z)
  );
}

/**
 * Stable key of a block cell: "minecraft:overworld|x|y|z" (coordinates floored).
 * @param {string} dimId
 * @param {Vector3} loc
 * @returns {string}
 */
export function blockKey(dimId, loc) {
  return `${dimId}|${Math.floor(loc.x)}|${Math.floor(loc.y)}|${Math.floor(loc.z)}`;
}

/**
 * Inverse of blockKey. Returns undefined for malformed keys.
 * @param {string} key
 * @returns {{dimId: string, x: number, y: number, z: number} | undefined}
 */
export function parseBlockKey(key) {
  if (typeof key !== "string") return undefined;
  const parts = key.split("|");
  if (parts.length !== 4) return undefined;
  const [dimId, xs, ys, zs] = parts;
  const x = Number(xs);
  const y = Number(ys);
  const z = Number(zs);
  if (!dimId || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return undefined;
  return { dimId, x, y, z };
}

// ---------------------------------------------------------------------------
// Dimensions and blocks
// ---------------------------------------------------------------------------

/**
 * @param {string} id e.g. "minecraft:overworld" or "overworld"
 * @returns {Dimension | undefined}
 */
export function getDimension(id) {
  try {
    return world.getDimension(id);
  } catch {
    return undefined;
  }
}

/** @returns {Dimension[]} overworld, nether and the end (those that resolve). */
export function allDimensions() {
  /** @type {Dimension[]} */
  const out = [];
  for (const id of DIMENSION_IDS) {
    const d = getDimension(id);
    if (d) out.push(d);
  }
  return out;
}

/**
 * Block at `loc`, or undefined when the chunk is not loaded, the location is
 * outside the dimension's height range, or anything else goes wrong.
 * (In 1.11.0 Dimension.getBlock returns undefined for unloaded chunks and may
 * throw LocationInUnloadedChunkError / LocationOutOfWorldBoundariesError.)
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @returns {Block | undefined}
 */
export function safeGetBlock(dim, loc) {
  try {
    const p = floorVec(loc);
    const range = dim.heightRange;
    if (p.y < range.min || p.y >= range.max) return undefined;
    const b = dim.getBlock(p);
    if (!b || !b.isValid()) return undefined;
    return b;
  } catch {
    return undefined;
  }
}

/**
 * Whether the block at `loc` is in a loaded chunk and inside the height range.
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @returns {boolean}
 */
export function isLoaded(dim, loc) {
  return safeGetBlock(dim, loc) !== undefined;
}

/**
 * typeId of the block at loc, or undefined if unavailable.
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @returns {string | undefined}
 */
export function blockTypeAt(dim, loc) {
  const b = safeGetBlock(dim, loc);
  if (!b) return undefined;
  try {
    return b.typeId;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Feedback (messages, sounds, particles)
// ---------------------------------------------------------------------------

/** @param {Player} player @param {string} msg @returns {boolean} */
export function tell(player, msg) {
  try {
    player.sendMessage(msg);
    return true;
  } catch {
    return false;
  }
}

/** @param {Player} player @param {string} msg @returns {boolean} */
export function actionbar(player, msg) {
  try {
    player.onScreenDisplay.setActionBar(msg);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Player} player
 * @param {string} titleText
 * @param {string} [subtitle]
 * @returns {boolean}
 */
export function title(player, titleText, subtitle) {
  try {
    /** @type {import("@minecraft/server").TitleDisplayOptions} */
    const opts = { fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 };
    if (subtitle !== undefined) opts.subtitle = subtitle;
    player.onScreenDisplay.setTitle(titleText, opts);
    return true;
  } catch {
    return false;
  }
}

/**
 * Play a sound in the world at a location (everyone nearby hears it).
 * @param {Dimension} dim
 * @param {string} id
 * @param {Vector3} loc
 * @param {import("@minecraft/server").WorldSoundOptions} [opts]
 * @returns {boolean}
 */
export function playSound(dim, id, loc, opts) {
  try {
    dim.playSound(id, loc, opts);
    return true;
  } catch {
    return false;
  }
}

/**
 * Play a sound only for one player.
 * @param {Player} player
 * @param {string} id
 * @param {import("@minecraft/server").PlayerSoundOptions} [opts]
 * @returns {boolean}
 */
export function playSoundTo(player, id, opts) {
  try {
    player.playSound(id, opts);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Dimension} dim
 * @param {string} id particle identifier, e.g. "pas:infection_spores"
 * @param {Vector3} loc
 * @returns {boolean} false when it could not be spawned (e.g. unloaded chunk)
 */
export function spawnParticle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Players and held items
// ---------------------------------------------------------------------------

/**
 * @param {Entity} entity
 * @returns {EntityEquippableComponent | undefined}
 */
export function getEquippable(entity) {
  try {
    return /** @type {EntityEquippableComponent | undefined} */ (entity.getComponent("minecraft:equippable"));
  } catch {
    return undefined;
  }
}

/**
 * @param {Entity} entity
 * @returns {Container | undefined}
 */
export function getInventory(entity) {
  try {
    const inv = /** @type {EntityInventoryComponent | undefined} */ (entity.getComponent("minecraft:inventory"));
    return inv?.container;
  } catch {
    return undefined;
  }
}

/**
 * @param {Player} player
 * @param {Hand} hand
 * @returns {ItemStack | undefined}
 */
export function getHand(player, hand) {
  try {
    const eq = getEquippable(player);
    if (eq) return eq.getEquipment(hand === "Offhand" ? EquipmentSlot.Offhand : EquipmentSlot.Mainhand);
    if (hand === "Mainhand") return getInventory(player)?.getItem(player.selectedSlotIndex);
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * The item the player is holding: main hand first, then off hand.
 * @param {Player} player
 * @returns {{stack: ItemStack, hand: Hand} | undefined}
 */
export function getHeld(player) {
  const main = getHand(player, "Mainhand");
  if (main) return { stack: main, hand: "Mainhand" };
  const off = getHand(player, "Offhand");
  if (off) return { stack: off, hand: "Offhand" };
  return undefined;
}

/**
 * First hand (main hand first) holding an item whose typeId is in `ids`.
 * @param {Player} player
 * @param {string | readonly string[]} ids
 * @returns {{stack: ItemStack, hand: Hand} | undefined}
 */
export function findHeld(player, ids) {
  const list = typeof ids === "string" ? [ids] : ids;
  for (const hand of /** @type {Hand[]} */ (["Mainhand", "Offhand"])) {
    const s = getHand(player, hand);
    if (s && list.includes(s.typeId)) return { stack: s, hand };
  }
  return undefined;
}

/**
 * Put `stack` (or nothing) into the given hand.
 * @param {Player} player
 * @param {Hand} hand
 * @param {ItemStack | undefined} stack
 * @returns {boolean}
 */
export function setHeld(player, hand, stack) {
  try {
    const eq = getEquippable(player);
    if (eq) {
      eq.setEquipment(hand === "Offhand" ? EquipmentSlot.Offhand : EquipmentSlot.Mainhand, stack);
      return true;
    }
    if (hand === "Mainhand") {
      const inv = getInventory(player);
      if (!inv) return false;
      inv.setItem(player.selectedSlotIndex, stack);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

/**
 * Survival or adventure (the modes where items are consumed).
 * @param {Player} player
 * @returns {boolean}
 */
export function isSurvivalLike(player) {
  try {
    const gm = player.getGameMode();
    return gm === GameMode.survival || gm === GameMode.adventure;
  } catch {
    return false;
  }
}

/**
 * Remove one item from the stack in `hand`. No-op (returns false) in creative/spectator.
 * @param {Player} player
 * @param {Hand} hand
 * @returns {boolean} true if an item was consumed
 */
export function consumeHeld(player, hand) {
  if (!isSurvivalLike(player)) return false;
  const stack = getHand(player, hand);
  if (!stack) return false;
  try {
    if (stack.amount > 1) {
      stack.amount = stack.amount - 1;
      return setHeld(player, hand, stack);
    }
    return setHeld(player, hand, undefined);
  } catch {
    return false;
  }
}

/**
 * Put `stack` into the player's inventory; whatever does not fit is dropped at their feet.
 * @param {Player} player
 * @param {ItemStack} stack
 * @returns {boolean} true if everything went into the inventory
 */
export function giveOrDrop(player, stack) {
  /** @type {ItemStack | undefined} */
  let rest = stack;
  try {
    const inv = getInventory(player);
    if (inv) rest = inv.addItem(stack);
  } catch {
    rest = stack;
  }
  if (!rest) return true;
  try {
    player.dimension.spawnItem(rest, player.location);
  } catch {
    // nothing else we can do
  }
  return false;
}

/**
 * Horizontal facing for a yaw in degrees (Bedrock: 0 = south/+z, 90 = west/-x,
 * 180 = north/-z, -90 = east/+x).
 * @param {number} yaw
 * @returns {Cardinal}
 */
export function cardinalFromYaw(yaw) {
  const y = (((yaw % 360) + 540) % 360) - 180; // [-180, 180)
  if (y >= -45 && y < 45) return "south";
  if (y >= 45 && y < 135) return "west";
  if (y >= -135 && y < -45) return "east";
  return "north";
}

/** Unit offset for a cardinal direction. @param {Cardinal} c @returns {Vector3} */
export function cardinalOffset(c) {
  switch (c) {
    case "north":
      return { x: 0, y: 0, z: -1 };
    case "south":
      return { x: 0, y: 0, z: 1 };
    case "east":
      return { x: 1, y: 0, z: 0 };
    default:
      return { x: -1, y: 0, z: 0 };
  }
}

/** @param {Cardinal} c @returns {Cardinal} */
export function oppositeCardinal(c) {
  return c === "north" ? "south" : c === "south" ? "north" : c === "east" ? "west" : "east";
}

/** Current game tick (system.currentTick). @returns {number} */
export function now() {
  return system.currentTick;
}

/**
 * Entity validity check that never throws.
 * @param {Entity | undefined} e
 * @returns {boolean}
 */
export function isValidEntity(e) {
  try {
    return !!e && e.isValid();
  } catch {
    return false;
  }
}
