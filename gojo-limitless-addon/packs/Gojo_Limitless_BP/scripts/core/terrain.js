import { BlockPermutation } from "@minecraft/server";
import { worldSettings } from "./settings.js";
import { distanceSq } from "../lib/vec.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** Blocks that techniques never erase, even with terrain destruction on. */
const PROTECTED = new Set([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:jigsaw",
  "minecraft:end_portal_frame",
  "minecraft:reinforced_deepslate",
  "minecraft:light_block",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block",
  "minecraft:mob_spawner",
  "minecraft:trial_spawner",
  "minecraft:vault",
  "minecraft:respawn_anchor",
  "minecraft:beacon",
  "minecraft:conduit",
  "minecraft:enchanting_table",
  "minecraft:ender_chest",
  "minecraft:bed",
  "minecraft:frame",
  "minecraft:glow_frame",
]);

let AIR;
function air() {
  if (!AIR) AIR = BlockPermutation.resolve("minecraft:air");
  return AIR;
}

/**
 * Erase blocks inside a sphere (only when "Terrain destruction" is enabled).
 * Containers, portals, bedrock, command blocks etc. are always kept.
 * Blocks within `safeRadius` of `safeCenter` (the caster) are never touched,
 * so a technique can never dig the ground out from under its user.
 *
 * @param {Dimension} dimension
 * @param {Vector3} center
 * @param {number} radius
 * @param {{safeCenter?: Vector3, safeRadius?: number, budget?: number, visited?: Set<string>}} [opts]
 * @returns {number} blocks erased
 */
export function eraseSphere(dimension, center, radius, opts = {}) {
  if (!worldSettings().destruction) return 0;
  const budget = opts.budget ?? 48;
  const safeR2 = (opts.safeRadius ?? 4) ** 2;
  const r2 = radius * radius;
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const cz = Math.floor(center.z);
  const ri = Math.ceil(radius);
  let minY = -64;
  let maxY = 320;
  try {
    minY = dimension.heightRange.min;
    maxY = dimension.heightRange.max - 1;
  } catch {
    // keep defaults
  }
  let erased = 0;
  let checked = 0;
  for (let dy = -ri; dy <= ri; dy++) {
    const y = cy + dy;
    if (y < minY || y > maxY) continue;
    for (let dx = -ri; dx <= ri; dx++) {
      for (let dz = -ri; dz <= ri; dz++) {
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const pos = { x: cx + dx, y, z: cz + dz };
        if (opts.visited) {
          const key = pos.x + "," + pos.y + "," + pos.z;
          if (opts.visited.has(key)) continue;
          opts.visited.add(key);
        }
        if (opts.safeCenter && distanceSq({ x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 }, opts.safeCenter) < safeR2) continue;
        if (++checked > budget * 3) return erased;
        if (eraseBlock(dimension, pos)) {
          erased++;
          if (erased >= budget) return erased;
        }
      }
    }
  }
  return erased;
}

/**
 * @param {Dimension} dimension
 * @param {Vector3} pos
 */
function eraseBlock(dimension, pos) {
  try {
    const block = dimension.getBlock(pos);
    if (!block || block.isAir || block.isLiquid) return false;
    if (block.getComponent("minecraft:inventory")) return false;
    const item = block.getItemStack();
    if (!item) return false; // portals, fire, technical blocks
    if (PROTECTED.has(item.typeId) || item.typeId.endsWith("shulker_box")) return false;
    block.setPermutation(air());
    return true;
  } catch {
    return false; // unloaded chunk or out of bounds
  }
}
