// @ts-check
// Luxury Base subsystem (SPEC §6). Using `pas:luxury_base_spawner`:
//  * on a block (onUseOn): that block is the ground; the house's foundation goes on top of it;
//  * in the air (onUse): raycast up to 12 blocks along the view direction to find the ground.
// The house extends away from the player with its front door facing back at them.
// Placement rules, messages and the rotation calibration: placement.js, checks.js,
// rotation.js and docs/LUXURY_BASE.md.

import { ITEMS } from "../lib/ids.js";
import { registerItemHandler } from "../lib/items.js";
import { tell } from "../lib/util.js";
import { requestBuild, AIM_DISTANCE, MSG } from "./placement.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Block} Block */

let initialized = false;

/**
 * Spawner used in the air: find the ground the player is looking at.
 * @param {Player} player
 */
function onUse(player) {
  /** @type {import("@minecraft/server").BlockRaycastHit | undefined} */
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: AIM_DISTANCE, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    hit = undefined;
  }
  if (!hit) {
    tell(player, MSG.aim);
    return;
  }
  requestBuild(player, hit.block);
}

/**
 * Spawner used on a block: that block is the ground.
 * @param {Player} player
 * @param {Block} block
 */
function onUseOn(player, block) {
  requestBuild(player, block);
}

/** Subscribe the house subsystem's events (idempotent). */
export function initHouse() {
  if (initialized) return;
  initialized = true;
  registerItemHandler([ITEMS.BASE_SPAWNER], { onUse, onUseOn });
}
