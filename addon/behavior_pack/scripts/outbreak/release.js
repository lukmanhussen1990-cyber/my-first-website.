// @ts-check
// The pas:parasite_outbreak item (SPEC §7 "Start").
//   onUseOn: release a parasite on top of the clicked block (or in front of the
//            clicked face when the cell above is blocked; inside a clicked
//            plant/snow layer);
//   onUse:   (air) raycast up to RELEASE_RAY_DISTANCE blocks along the view
//            direction, else ask the player to aim at the ground.
// startOutbreak() does the cap check; the item is consumed in survival/adventure
// only and only when a parasite was actually released.

import { ITEMS } from "../lib/ids.js";
import { consumeHeld, findHeld, logError, safeGetBlock, tell } from "../lib/util.js";
import { startOutbreak, isOpenBlock } from "./replication.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Direction} Direction */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** Max distance of the in-air raycast. */
export const RELEASE_RAY_DISTANCE = 10;

/** @type {Record<string, Vector3>} */
const FACE_OFFSET = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

/**
 * Feet location for a parasite released on `block`: the cell on top of it,
 * or the cell in front of the clicked face when the top is blocked. A clicked
 * plant/snow layer standing on solid ground is used itself.
 * @param {Block} block
 * @param {Direction | string} face
 * @returns {Vector3 | undefined}
 */
export function releaseSpot(block, face) {
  const dim = block.dimension;
  // clicked a plant / snow layer on the ground: release inside that cell
  if (isOpenBlock(block) && !block.isAir && !block.isLiquid) {
    const below = safeGetBlock(dim, { x: block.x, y: block.y - 1, z: block.z });
    if (below && !isOpenBlock(below)) return { x: block.x + 0.5, y: block.y, z: block.z + 0.5 };
  }
  const cells = [{ x: block.x, y: block.y + 1, z: block.z }];
  const o = FACE_OFFSET[String(face)];
  if (o && String(face) !== "Up") cells.push({ x: block.x + o.x, y: block.y + o.y, z: block.z + o.z });
  for (const c of cells) {
    const b = safeGetBlock(dim, c);
    if (b && isOpenBlock(b)) return { x: c.x + 0.5, y: c.y, z: c.z + 0.5 };
  }
  return undefined;
}

/**
 * Release a parasite on `block`; consumes one item on success (survival only).
 * @param {Player} player
 * @param {Block} block
 * @param {Direction | string} face
 * @returns {boolean}
 */
export function releaseOnBlock(player, block, face) {
  const spot = releaseSpot(block, face);
  if (!spot) {
    tell(player, "§c☣ There is no room to release the parasite here.");
    return false;
  }
  const e = startOutbreak(block.dimension, spot, player);
  if (!e) return false;
  const held = findHeld(player, ITEMS.OUTBREAK);
  if (held) consumeHeld(player, held.hand);
  return true;
}

/**
 * Item use in the air: raycast to the ground.
 * @param {Player} player
 * @returns {boolean}
 */
export function releaseFromAir(player) {
  /** @type {import("@minecraft/server").BlockRaycastHit | undefined} */
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: RELEASE_RAY_DISTANCE });
  } catch (err) {
    logError("outbreak.release.ray", err);
    hit = undefined;
  }
  if (!hit) {
    tell(player, `§e☣ Aim at the ground (within ${RELEASE_RAY_DISTANCE} blocks) to release the parasite.`);
    return false;
  }
  return releaseOnBlock(player, hit.block, hit.face);
}
