// Hands swallowed items back a few stacks per tick so big hauls don't lag phones.
import { world } from "@minecraft/server";
import { TUNING } from "./config.js";

/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */

/** @type {{stacks: ItemStack[], playerId: string | undefined, dimension: Dimension, location: Vector3}[]} */
const queue = [];

/**
 * @param {ItemStack[]} stacks
 * @param {string | undefined} playerId who receives them; undefined spills them at `location`
 * @param {Dimension} dimension fallback dimension
 * @param {Vector3} location fallback location
 */
export function queueDelivery(stacks, playerId, dimension, location) {
  if (stacks.length > 0) queue.push({ stacks: [...stacks], playerId, dimension, location: { ...location } });
}

/** Puts an item in a player's inventory, dropping whatever does not fit at their feet. */
/** @param {Player} player @param {ItemStack} stack */
export function giveItem(player, stack) {
  const inventory = /** @type {EntityInventoryComponent | undefined} */ (player.getComponent("minecraft:inventory"));
  /** @type {ItemStack | undefined} */
  let leftover = stack;
  try {
    if (inventory?.container) leftover = inventory.container.addItem(stack);
  } catch {
    leftover = stack;
  }
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}

/** @param {Dimension} dimension @param {Vector3} location @param {ItemStack} stack */
function spill(dimension, location, stack) {
  const item = dimension.spawnItem(stack, location);
  try {
    const a = Math.random() * Math.PI * 2;
    const s = 0.2 + Math.random() * 0.3;
    item.applyImpulse({ x: Math.cos(a) * s, y: 0.25 + Math.random() * 0.25, z: Math.sin(a) * s });
  } catch {
    // impulse is cosmetic
  }
}

export function processDeliveries() {
  let budget = TUNING.deliverStacksPerTick;
  while (budget > 0 && queue.length > 0) {
    const job = queue[0];
    const player = job.playerId ? world.getAllPlayers().find((p) => p.id === job.playerId) : undefined;
    while (budget > 0 && job.stacks.length > 0) {
      const stack = /** @type {ItemStack} */ (job.stacks.shift());
      budget--;
      try {
        if (player && player.isValid()) giveItem(player, stack);
        else spill(job.dimension, job.location, stack);
      } catch (error) {
        console.warn(`[Black Hole] Could not deliver ${stack.typeId}: ${error}`);
      }
    }
    if (job.stacks.length === 0) queue.shift();
  }
}
