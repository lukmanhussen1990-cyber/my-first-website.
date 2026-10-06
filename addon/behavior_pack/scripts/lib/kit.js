// @ts-check
// Starting kit (SPEC §4): on a player's initial spawn, if they do not have the
// `pas:kit_v1` dynamic property, give one of each tool, then set it.

import { world, ItemStack } from "@minecraft/server";
import { ITEMS, PROPS } from "./ids.js";
import { safe, giveOrDrop, logError } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */

/** Items in the kit, in the order they are given. */
export const KIT_ITEMS = Object.freeze([ITEMS.TORCH_OFF, ITEMS.BASE_SPAWNER, ITEMS.OUTBREAK, ITEMS.CONTROL]);

let initialized = false;

/**
 * Give the kit to `player` unless they already received it.
 * @param {Player} player
 * @returns {boolean} true if the kit was given now
 */
export function giveKit(player) {
  try {
    if (!player.isValid()) return false;
    if (player.getDynamicProperty(PROPS.KIT) === true) return false;
    for (const id of KIT_ITEMS) {
      try {
        giveOrDrop(player, new ItemStack(id, 1));
      } catch (e) {
        logError(`kit.give(${id})`, e);
      }
    }
    player.setDynamicProperty(PROPS.KIT, true);
    return true;
  } catch (e) {
    logError("kit.giveKit", e);
    return false;
  }
}

/** Subscribe the kit handler (idempotent). */
export function initKit() {
  if (initialized) return;
  initialized = true;
  world.afterEvents.playerSpawn.subscribe(
    safe((ev) => {
      if (!ev.initialSpawn) return;
      giveKit(ev.player);
    }, "kit.playerSpawn"),
  );
}
