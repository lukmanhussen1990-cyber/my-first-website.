import { Direction } from "@minecraft/server";
import { add, addScaled, distance } from "../lib/vec.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * First solid block along the player's view (flowers/grass are ignored).
 * @param {Player} player
 * @param {number} maxDistance
 * @returns {{pos: Vector3, face: Direction, block: import("@minecraft/server").Block, dist: number} | undefined}
 */
export function blockRay(player, maxDistance) {
  try {
    const hit = player.getBlockFromViewDirection({
      maxDistance,
      includePassableBlocks: false,
      includeLiquidBlocks: false,
    });
    if (!hit) return undefined;
    const pos = add(hit.block.location, hit.faceLocation);
    return { pos, face: hit.face, block: hit.block, dist: distance(player.getHeadLocation(), pos) };
  } catch {
    return undefined;
  }
}

/**
 * Point in front of the player where a technique should appear: just before
 * the first block hit, or `fallback` blocks ahead in open air. Hitting the top
 * of a block lifts the point off the ground so it hovers at body height.
 * @param {Player} player
 * @param {number} maxDistance
 * @param {number} fallback
 * @param {number} [minDistance]
 * @returns {Vector3}
 */
export function aimPoint(player, maxDistance, fallback, minDistance = 2.5) {
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const hit = blockRay(player, maxDistance);
  let point;
  if (hit) {
    point = addScaled(hit.pos, dir, -0.9);
    if (hit.face === Direction.Up) point = { x: point.x, y: hit.pos.y + 1.1, z: point.z };
  } else {
    point = addScaled(eye, dir, fallback);
  }
  if (distance(point, eye) < minDistance) point = addScaled(eye, dir, minDistance);
  return point;
}
