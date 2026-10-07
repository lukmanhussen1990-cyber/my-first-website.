// @ts-check
/**
 * Block magic: how each gun changes or destroys the world.
 *
 * Blocks are broken with `setblock ... destroy`, which gives the real break
 * particles, sound and loot.  Craters only drop part of their blocks so big
 * blasts don't flood a phone with item entities.  Unbreakable / technical /
 * blast-proof blocks are never touched.
 *
 * Toggle for a world (cheats on):  /scriptevent magic_guns:blocks off   (or on)
 */
import { world, system } from "@minecraft/server";
import { fx, sound } from "./fx.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").RGB} RGB */

const PROTECTED = new Set(
  [
    "bedrock", "barrier", "command_block", "chain_command_block", "repeating_command_block",
    "structure_block", "structure_void", "jigsaw", "light_block", "allow", "deny", "border_block",
    "end_portal", "end_portal_frame", "end_gateway", "portal", "reinforced_deepslate",
    "obsidian", "crying_obsidian", "respawn_anchor", "ancient_debris", "netherite_block",
    "enchanting_table", "ender_chest", "anvil", "chipped_anvil", "damaged_anvil",
    "beacon", "conduit", "spawner", "trial_spawner", "vault", "mob_spawner",
  ].map((n) => "minecraft:" + n),
);

const PROPERTY = "magic_guns:block_magic";

/** Is block magic switched on for this world (default: on)? */
export function enabled() {
  try {
    return world.getDynamicProperty(PROPERTY) !== false;
  } catch {
    return true;
  }
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "magic_guns:blocks") return;
  const on = !/^(off|false|0|no)$/i.test(ev.message.trim());
  world.setDynamicProperty(PROPERTY, on);
  world.sendMessage(`§d✦ Magic Guns§r block magic is now ${on ? "§aON" : "§cOFF"}§r.`);
});

/** @param {Block | undefined} b @returns {b is Block} */
export function breakable(b) {
  return !!b && !b.isAir && !b.isLiquid && !PROTECTED.has(b.typeId);
}

/** @param {Block} b */
const cmdPos = (b) => `${b.location.x} ${b.location.y} ${b.location.z}`;

/**
 * Break one block magically.
 * @param {Dimension} dim @param {Block} b
 * @param {{ drop?: boolean, particle?: string, color?: RGB }} [opt]
 */
export function shatter(dim, b, opt = {}) {
  if (!enabled() || !breakable(b)) return false;
  const centre = { x: b.location.x + 0.5, y: b.location.y + 0.5, z: b.location.z + 0.5 };
  try {
    dim.runCommand(`setblock ${cmdPos(b)} air ${opt.drop === false ? "replace" : "destroy"}`);
  } catch {
    return false;
  }
  if (opt.particle) fx(dim, opt.particle, centre, opt.color);
  return true;
}

/**
 * Turn a block into another one (no drops).
 * @param {Dimension} dim @param {Block | undefined} b @param {string} type
 */
export function transmute(dim, b, type) {
  if (!enabled() || !breakable(b)) return false;
  try {
    dim.runCommand(`setblock ${cmdPos(b)} ${type} replace`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spherical crater.  Returns how many blocks were removed.
 * @param {Dimension} dim @param {Vector3} at @param {number} radius
 * @param {{ dropChance?: number, fireChance?: number, particle?: string, color?: RGB, max?: number }} [opt]
 */
export function crater(dim, at, radius, opt = {}) {
  if (!enabled()) return 0;
  const { dropChance = 0.3, fireChance = 0, particle, color, max = 90 } = opt;
  const r = Math.ceil(radius);
  /** @type {{ b: Block, d: number }[]} */
  const hits = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        // slightly ragged edge looks more natural than a perfect ball
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + Math.random() * 0.6;
        if (d > radius) continue;
        let b;
        try {
          b = dim.getBlock({ x: Math.floor(at.x) + dx, y: Math.floor(at.y) + dy, z: Math.floor(at.z) + dz });
        } catch {
          continue;
        }
        if (breakable(b)) hits.push({ b, d });
      }
    }
  }
  hits.sort((a, b) => a.d - b.d);
  let n = 0;
  for (const { b } of hits.slice(0, max)) {
    if (shatter(dim, b, { drop: Math.random() < dropChance })) n++;
  }
  if (particle) {
    for (let i = 0; i < 6; i++) {
      fx(dim, particle, {
        x: at.x + (Math.random() * 2 - 1) * radius * 0.7,
        y: at.y + (Math.random() * 2 - 1) * radius * 0.5,
        z: at.z + (Math.random() * 2 - 1) * radius * 0.7,
      }, color);
    }
  }
  if (fireChance > 0) ignite(dim, at, radius, fireChance);
  return n;
}

/** Light fires on exposed floors around a point. @param {Dimension} dim @param {Vector3} at @param {number} radius @param {number} chance */
export function ignite(dim, at, radius, chance) {
  if (!enabled()) return;
  const r = Math.ceil(radius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (Math.random() >= chance) continue;
      for (let dy = r; dy >= -r; dy--) {
        try {
          const b = dim.getBlock({ x: Math.floor(at.x) + dx, y: Math.floor(at.y) + dy, z: Math.floor(at.z) + dz });
          const below = b?.below();
          if (b && b.isAir && below && !below.isAir && !below.isLiquid) {
            dim.runCommand(`setblock ${cmdPos(b)} fire keep`);
            break;
          }
        } catch {}
      }
    }
  }
}

// --------------------------------------------------- block groups by type id

const FRAGILE = /glass|ice|leaves|flower|tulip|orchid|allium|bluet|daisy|poppy|dandelion|cornflower|lily|grass$|short_grass|tall_grass|fern|vine|sapling|mushroom|torch|lantern|bamboo|sugar_cane|cactus|cobweb|snow_layer|sea_pickle|kelp|azalea|dead_bush|sweet_berry|carpet|candle|pumpkin|melon|hay_block|wool|sponge/;

/** Glass, leaves, plants... things a bullet should simply smash. @param {Block} b */
export const isFragile = (b) => FRAGILE.test(b.typeId);

/** Water -> frosted ice, lava -> obsidian / cobblestone, fire -> out, snow on top. @param {Dimension} dim @param {Block} b @param {number} radius */
export function freeze(dim, b, radius) {
  if (!enabled()) return;
  const r = Math.ceil(radius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const n = b.offset({ x: dx, y: dy, z: dz });
        if (!n) continue;
        const t = n.typeId;
        try {
          if (t === "minecraft:water" || t === "minecraft:flowing_water") {
            if (n.above()?.isAir) dim.runCommand(`setblock ${cmdPos(n)} frosted_ice replace`);
          } else if (t === "minecraft:lava") {
            dim.runCommand(`setblock ${cmdPos(n)} obsidian replace`);
          } else if (t === "minecraft:flowing_lava") {
            dim.runCommand(`setblock ${cmdPos(n)} cobblestone replace`);
          } else if (t === "minecraft:fire" || t === "minecraft:soul_fire") {
            dim.runCommand(`setblock ${cmdPos(n)} air replace`);
          } else if (!n.isAir && !n.isLiquid && n.above()?.isAir && Math.random() < 0.6) {
            const top = n.above();
            if (top) dim.runCommand(`setblock ${cmdPos(top)} snow_layer keep`);
          }
        } catch {}
      }
    }
  }
}

/** Soul corruption: living ground turns to soul soil / soul sand, flowers wither. @param {Dimension} dim @param {Block} b @param {number} radius */
export function corrupt(dim, b, radius) {
  if (!enabled()) return;
  const r = Math.ceil(radius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius || Math.random() < 0.25) continue;
        const n = b.offset({ x: dx, y: dy, z: dz });
        if (!n) continue;
        const t = n.typeId.replace("minecraft:", "");
        if (/^(grass_block|dirt|coarse_dirt|podzol|mycelium|rooted_dirt|moss_block|farmland|dirt_path)$/.test(t)) {
          transmute(dim, n, "soul_soil");
        } else if (t === "sand" || t === "red_sand" || t === "gravel") {
          transmute(dim, n, "soul_sand");
        } else if (/flower|tulip|orchid|allium|bluet|daisy|poppy|dandelion|cornflower|lily_of/.test(t)) {
          transmute(dim, n, "wither_rose");
        } else if (/leaves|short_grass|tall_grass|fern/.test(t)) {
          shatter(dim, n, { drop: false });
        }
      }
    }
  }
  sound(dim, "magic_guns.soul.hit", b.location, 0.7, 0.6);
}
