import { Direction } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { blockRay } from "../core/aim.js";
import { effect } from "../core/combat.js";
import { isHostileTarget, lookTarget, bodyCenter } from "../core/targets.js";
import { particle, sound, pose } from "../lib/fx.js";
import { addScaled, distance } from "../lib/vec.js";

const RANGE = 32;

registerAbility("teleport", (player, st, ctx) => {
  const dim = player.dimension;
  const from = player.location;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const target = ctx.target && isHostileTarget(ctx.target, player) ? ctx.target : lookTarget(player, RANGE);

  /** @type {import("@minecraft/server").Vector3[]} */
  const candidates = [];
  /** @type {import("@minecraft/server").Vector3 | undefined} */
  let facing;
  if (target) {
    // Appear behind the enemy, facing it.
    const t = target.location;
    let back;
    try {
      back = target.getViewDirection();
    } catch {
      back = dir;
    }
    const bl = Math.sqrt(back.x * back.x + back.z * back.z) || 1;
    const bx = back.x / bl;
    const bz = back.z / bl;
    candidates.push({ x: t.x - bx * 1.7, y: t.y, z: t.z - bz * 1.7 });
    candidates.push({ x: t.x - bz * 1.7, y: t.y, z: t.z + bx * 1.7 });
    candidates.push({ x: t.x + bz * 1.7, y: t.y, z: t.z - bx * 1.7 });
    candidates.push({ x: t.x + bx * 1.7, y: t.y, z: t.z + bz * 1.7 });
    facing = bodyCenter(target);
  } else {
    const hit = blockRay(player, RANGE);
    if (hit) {
      if (hit.face === Direction.Up) {
        candidates.push({ x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 });
      }
      // Step back along the ray until there is room to stand.
      for (let back = 0.7; back < hit.dist; back += 0.8) {
        const p = addScaled(hit.pos, dir, -back);
        candidates.push({ x: p.x, y: p.y - 1.0, z: p.z });
        candidates.push({ x: p.x, y: Math.floor(p.y - 0.6), z: p.z });
        if (candidates.length > 24) break;
      }
    } else {
      for (let d = RANGE; d > 2; d -= 2) {
        const p = addScaled(eye, dir, d);
        candidates.push({ x: p.x, y: p.y - 1.62, z: p.z });
        if (candidates.length > 20) break;
      }
    }
  }

  let minY = -64;
  try {
    minY = dim.heightRange.min;
  } catch {
    // keep default
  }
  const rotation = player.getRotation();
  let arrived;
  for (const c of candidates) {
    if (c.y < minY + 1) continue;
    if (distance(c, from) < 1.5) continue;
    if (isHazard(dim, c)) continue;
    let ok = false;
    try {
      ok = player.tryTeleport(c, facing ? { checkForBlocks: true, facingLocation: facing, keepVelocity: false } : { checkForBlocks: true, rotation, keepVelocity: false });
    } catch {
      ok = false;
    }
    if (ok) {
      arrived = c;
      break;
    }
  }
  if (!arrived) {
    flash(st, "§bTeleport §8» §7no safe spot there", 30);
    return false;
  }
  particle(dim, "gojo:teleport_burst", { x: from.x, y: from.y + 1, z: from.z });
  sound(dim, "gojo.teleport", from, { radius: 24 });
  particle(dim, "gojo:teleport_burst", { x: arrived.x, y: arrived.y + 1, z: arrived.z });
  sound(dim, "gojo.teleport", arrived, { radius: 24, pitch: 1.2 });
  pose(player, "animation.gojo.teleport");
  // Arriving in mid-air? Drift down gently instead of taking fall damage.
  if (!standing(dim, arrived)) effect(player, "slow_falling", 50, 0);
  flash(st, target ? "§bTeleport §8» §fbehind the enemy" : "§bTeleport", 25);
  return true;
});

/**
 * Lava or fire at the feet/head of a destination.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} p
 */
function isHazard(dim, p) {
  for (const dy of [0, 1]) {
    try {
      const b = dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y) + dy, z: Math.floor(p.z) });
      if (!b) return true; // unloaded
      const perm = b.permutation;
      if (perm.matches("minecraft:lava") || perm.matches("minecraft:flowing_lava") || perm.matches("minecraft:fire") || perm.matches("minecraft:soul_fire")) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Is there something solid within 2 blocks below?
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} p
 */
function standing(dim, p) {
  for (const dy of [1, 2]) {
    try {
      const b = dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y) - dy, z: Math.floor(p.z) });
      if (b && !b.isAir) return true;
    } catch {
      return true;
    }
  }
  return false;
}
