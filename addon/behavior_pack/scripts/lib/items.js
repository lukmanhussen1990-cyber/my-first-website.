// @ts-check
// Central item-use dispatcher with edge debounce (SPEC §4).
//
// Subscribes once to world.afterEvents.itemUse, world.afterEvents.itemUseOn
// and world.beforeEvents.itemUseOn. Before-event handlers only record data
// (the world is read-only there); all handler calls are deferred.
//
// Edge debounce: a use is accepted only if the same player had no item-use
// event of any of these kinds (for a registered item) in the previous
// DEBOUNCE_TICKS ticks. Every event, accepted or not, refreshes the
// timestamp. So holding the use button (a stream of events) yields exactly one
// action, and a single tap on a block that fires itemUseOn (before + after)
// and itemUse yields one action.
//
// The accepted event opens a short "gesture"; events of the same tap that
// arrive before it is dispatched (next tick) are merged into it. If any of
// them carried a block, the gesture dispatches onUseOn (when the handler has
// one), otherwise onUse.

import { world, system } from "@minecraft/server";
import { safe, logError } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Direction} Direction */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

export const DEBOUNCE_TICKS = 6;

/**
 * @typedef {object} UseContext
 * @property {"use" | "useOn"} kind which handler is being called
 * @property {number} tick tick of the accepted (first) event
 * @property {"Mainhand"} hand item uses always come from the main hand
 * @property {string[]} sources event kinds merged into this gesture, e.g. ["beforeItemUseOn","itemUseOn","itemUse"]
 * @property {Vector3 | undefined} faceLocation face hit location relative to the block (useOn only)
 */

/**
 * @typedef {object} ItemHandler
 * @property {(player: Player, stack: ItemStack, ctx: UseContext) => void} [onUse]
 * @property {(player: Player, block: Block, face: Direction, stack: ItemStack, ctx: UseContext) => void} [onUseOn]
 */

/**
 * @typedef {object} Gesture
 * @property {Player} player
 * @property {string} itemId
 * @property {ItemStack} stack
 * @property {number} tick
 * @property {string[]} sources
 * @property {Block | undefined} block
 * @property {Direction | undefined} face
 * @property {Vector3 | undefined} faceLocation
 * @property {ItemStack | undefined} blockStack stack seen with the block event
 */

/** @type {Map<string, ItemHandler>} */
const handlers = new Map();
/** Last item-use event tick per player id. @type {Map<string, number>} */
const lastEventTick = new Map();
/** Open gesture per player id (waiting for dispatch). @type {Map<string, Gesture>} */
const openGestures = new Map();

let subscribed = false;

/**
 * Register handlers for one or more item ids. A later registration for the
 * same id replaces the earlier one.
 * @param {string | readonly string[]} ids
 * @param {ItemHandler} handler
 */
export function registerItemHandler(ids, handler) {
  const list = typeof ids === "string" ? [ids] : ids;
  for (const id of list) {
    if (handlers.has(id) && handlers.get(id) !== handler) console.warn(`[pas] item handler for ${id} replaced`);
    handlers.set(id, handler);
  }
  ensureSubscribed();
}

/** @param {string} id @returns {boolean} */
export function hasItemHandler(id) {
  return handlers.has(id);
}

/**
 * Record an event for `player`; returns true when it is an accepted edge.
 * @param {Player} player
 * @returns {boolean}
 */
function touch(player) {
  const t = system.currentTick;
  const last = lastEventTick.get(player.id);
  lastEventTick.set(player.id, t);
  return last === undefined || t - last > DEBOUNCE_TICKS;
}

/**
 * @param {string} source
 * @param {Player} player
 * @param {ItemStack | undefined} stack
 * @param {{block: Block, face: Direction, faceLocation: Vector3} | undefined} hit
 */
function onEvent(source, player, stack, hit) {
  if (!stack || !handlers.has(stack.typeId)) return;
  const accepted = touch(player);
  const open = openGestures.get(player.id);
  if (open) {
    // part of the gesture being collected (same tap): merge block info
    if (!open.sources.includes(source)) open.sources.push(source);
    if (hit && !open.block && stack.typeId === open.itemId) {
      open.block = hit.block;
      open.face = hit.face;
      open.faceLocation = hit.faceLocation;
      open.blockStack = stack;
    }
    return;
  }
  if (!accepted) return;
  /** @type {Gesture} */
  const g = {
    player,
    itemId: stack.typeId,
    stack,
    tick: system.currentTick,
    sources: [source],
    block: hit?.block,
    face: hit?.face,
    faceLocation: hit?.faceLocation,
    blockStack: hit ? stack : undefined,
  };
  openGestures.set(player.id, g);
  system.run(() => dispatch(g));
}

/** @param {Gesture} g */
function dispatch(g) {
  openGestures.delete(g.player.id);
  const h = handlers.get(g.itemId);
  if (!h) return;
  try {
    if (!g.player.isValid()) return;
  } catch {
    return;
  }
  const stack = g.blockStack ?? g.stack;
  if (g.block && g.face && h.onUseOn) {
    /** @type {UseContext} */
    const ctx = { kind: "useOn", tick: g.tick, hand: "Mainhand", sources: g.sources, faceLocation: g.faceLocation };
    try {
      h.onUseOn(g.player, g.block, g.face, stack, ctx);
    } catch (e) {
      logError(`item.onUseOn(${g.itemId})`, e);
    }
    return;
  }
  if (h.onUse) {
    /** @type {UseContext} */
    const ctx = { kind: "use", tick: g.tick, hand: "Mainhand", sources: g.sources, faceLocation: undefined };
    try {
      h.onUse(g.player, stack, ctx);
    } catch (e) {
      logError(`item.onUse(${g.itemId})`, e);
    }
  }
}

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  world.afterEvents.itemUse.subscribe(
    safe((ev) => onEvent("itemUse", ev.source, ev.itemStack, undefined), "items.afterItemUse"),
  );
  world.afterEvents.itemUseOn.subscribe(
    safe(
      (ev) =>
        onEvent("itemUseOn", ev.source, ev.itemStack, {
          block: ev.block,
          face: ev.blockFace,
          faceLocation: ev.faceLocation,
        }),
      "items.afterItemUseOn",
    ),
  );
  // Before-event: read-only context. We only record; dispatch happens via system.run.
  world.beforeEvents.itemUseOn.subscribe(
    safe(
      (ev) =>
        onEvent("beforeItemUseOn", ev.source, ev.itemStack, {
          block: ev.block,
          face: ev.blockFace,
          faceLocation: ev.faceLocation,
        }),
      "items.beforeItemUseOn",
    ),
  );
  // Forget players that leave so the maps do not grow forever.
  world.afterEvents.playerLeave.subscribe(
    safe((ev) => {
      lastEventTick.delete(ev.playerId);
      openGestures.delete(ev.playerId);
    }, "items.playerLeave"),
  );
}

/** Make sure the dispatcher is subscribed even before any handler is registered. */
export function initItems() {
  ensureSubscribed();
}

/** Test/diagnostic access to internal state. */
export const __itemsInternals = Object.freeze({
  handlers,
  lastEventTick,
  openGestures,
  /** Forget all debounce state (handlers stay registered). */
  resetDebounce() {
    lastEventTick.clear();
    openGestures.clear();
  },
});
