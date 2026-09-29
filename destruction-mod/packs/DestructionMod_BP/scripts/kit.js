// @ts-check
// Puts every mod item into a player's inventory (skipping ones they have).
import { ItemStack } from "@minecraft/server";
import { MARKER_ID, TABLET_ID, WEAPONS } from "./config.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */

export const KIT = [TABLET_ID, MARKER_ID, ...WEAPONS.map((w) => w.id)];

/**
 * @param {Player} player
 * @returns {{added: number, dropped: number}} dropped = didn't fit, spawned at their feet
 */
export function giveKit(player) {
  const inv = /** @type {EntityInventoryComponent | undefined} */ (player.getComponent("minecraft:inventory"));
  const box = inv?.container;
  const owned = new Set();
  if (box) {
    for (let i = 0; i < box.size; i++) {
      const it = box.getItem(i);
      if (it) owned.add(it.typeId);
    }
  }
  let added = 0;
  let dropped = 0;
  for (const id of KIT) {
    if (owned.has(id)) continue;
    const stack = new ItemStack(id, 1);
    const left = box ? box.addItem(stack) : stack;
    if (left) {
      player.dimension.spawnItem(left, player.location);
      dropped++;
    }
    added++;
  }
  return { added, dropped };
}
