// @ts-check
// Small helpers shared by every module. Everything that touches the world is
// wrapped in try/catch: targets can sit in unloaded chunks, players can leave,
// and a failed particle should never stop an effect.
import { BlockPermutation, EntityDamageCause, system } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */

// ---------------------------------------------------------------- math
/** @param {number} a @param {number} b */
export const rand = (a, b) => a + Math.random() * (b - a);
/** @param {number} a @param {number} b */
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
/** @param {number} n @param {number} lo @param {number} hi */
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
/** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** @param {Vector3} a @param {number} k @returns {Vector3} */
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
/** @param {Vector3} a */
export const len = (a) => Math.hypot(a.x, a.y, a.z);
/** @param {Vector3} a @param {Vector3} b */
export const dist = (a, b) => len(sub(a, b));
/** @param {Vector3} a @returns {Vector3} */
export const norm = (a) => scale(a, 1 / (len(a) || 1));
/** @param {Vector3} a @param {Vector3} b @param {number} t @returns {Vector3} */
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
/** @param {Vector3} p */
export const fmt = (p) => `${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`;

/** Resolves after `ticks` game ticks. @param {number} ticks @returns {Promise<void>} */
export const wait = (ticks) => new Promise((resolve) => system.runTimeout(() => resolve(), ticks));

// ---------------------------------------------------------------- blocks
/** @type {Map<string, BlockPermutation>} */
const perms = new Map();
/** @param {string} id */
function perm(id) {
  let p = perms.get(id);
  if (!p) {
    p = BlockPermutation.resolve(id);
    perms.set(id, p);
  }
  return p;
}

// Blocks the mod never removes (world borders, command machinery, portals).
const PROTECTED = [
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:command_block",
  "minecraft:repeating_command_block",
  "minecraft:chain_command_block",
  "minecraft:structure_block",
  "minecraft:jigsaw",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:border_block",
  "minecraft:allow",
  "minecraft:deny",
];

/** @param {import("@minecraft/server").Block} block */
export function isProtected(block) {
  const p = block.permutation;
  for (const id of PROTECTED) if (p.matches(id)) return true;
  return false;
}

/**
 * Y range the mod is allowed to edit in a dimension. Keeps the bottom layer and
 * the Nether roof intact so nobody falls out of the world by accident.
 * @param {Dimension} dim
 */
export function yLimits(dim) {
  const r = dim.heightRange;
  let max = r.max - 1;
  if (dim.id === "minecraft:nether") max = Math.min(max, 122);
  return { min: r.min + 1, max };
}

/**
 * Turns one block into air. Returns true when something was removed.
 * @param {Dimension} dim @param {number} x @param {number} y @param {number} z
 * @param {{min: number, max: number}} lim
 */
export function breakBlock(dim, x, y, z, lim) {
  if (y < lim.min || y > lim.max) return false;
  try {
    const block = dim.getBlock({ x, y, z });
    if (!block || block.isAir || isProtected(block)) return false;
    block.setPermutation(perm("minecraft:air"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Places a block (by default only into air).
 * @param {Dimension} dim @param {number} x @param {number} y @param {number} z
 * @param {string} typeId @param {boolean} [onlyIntoAir]
 */
export function placeBlock(dim, x, y, z, typeId, onlyIntoAir = true) {
  try {
    const block = dim.getBlock({ x, y, z });
    if (!block || (onlyIntoAir && !block.isAir) || isProtected(block)) return false;
    block.setPermutation(perm(typeId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Y of the first solid (or liquid) block below `fromY` at column x/z.
 * @param {Dimension} dim @param {number} x @param {number} z @param {number} fromY
 * @param {number} [depth] @returns {number | undefined}
 */
export function groundY(dim, x, z, fromY, depth = 48) {
  const lim = yLimits(dim);
  const start = Math.min(Math.floor(fromY), lim.max);
  try {
    const hit = dim.getBlockFromRay(
      { x: Math.floor(x) + 0.5, y: start + 0.5, z: Math.floor(z) + 0.5 },
      { x: 0, y: -1, z: 0 },
      { maxDistance: depth, includeLiquidBlocks: true, includePassableBlocks: false },
    );
    if (hit) return hit.block.y;
  } catch {
    // unloaded or outside the world
  }
  return undefined;
}

/** @param {Dimension} dim @param {Vector3} pos */
export function isLoaded(dim, pos) {
  try {
    return dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }) !== undefined;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- fx
/** @param {Dimension} dim @param {string} id @param {Vector3} pos */
export function particle(dim, id, pos) {
  try {
    dim.spawnParticle(id, pos);
  } catch {
    // chunk not loaded
  }
}

/**
 * Plays a sound for everyone near `pos`. Far listeners hear it from a point
 * between them and the blast, so big explosions still carry.
 * @param {Dimension} dim @param {string} id @param {Vector3} pos
 * @param {number} [volume] @param {number} [pitch] @param {number} [range]
 */
export function sound(dim, id, pos, volume = 1, pitch = 1, range = 128) {
  let players = [];
  try {
    players = dim.getPlayers({ location: pos, maxDistance: range });
  } catch {
    return;
  }
  for (const p of players) {
    try {
      const d = dist(p.location, pos);
      const near = d <= 24;
      const at = near ? pos : lerp(p.location, pos, 24 / d);
      const vol = near ? volume : volume * clamp(1 - d / range, 0.25, 1);
      p.playSound(id, { location: at, volume: vol, pitch });
    } catch {
      // player left
    }
  }
}

/**
 * Camera shake for players near `pos`.
 * @param {Dimension} dim @param {Vector3} pos @param {number} radius
 * @param {number} intensity 0..4 @param {number} seconds
 */
export function shake(dim, pos, radius, intensity, seconds) {
  let players = [];
  try {
    players = dim.getPlayers({ location: pos, maxDistance: radius });
  } catch {
    return;
  }
  for (const p of players) {
    const falloff = clamp(1 - dist(p.location, pos) / radius, 0.2, 1);
    const i = clamp(intensity * falloff, 0.05, 1.5).toFixed(2);
    try {
      p.runCommand(`camerashake add @s ${i} ${seconds.toFixed(1)} positional`);
    } catch {
      // not important
    }
  }
}

// ---------------------------------------------------------------- entities
const SKIP_TYPES = [
  "minecraft:lightning_bolt",
  "minecraft:area_effect_cloud",
  "minecraft:painting",
  "minecraft:leash_knot",
  "minecraft:npc",
  "minecraft:agent",
  "minecraft:tripod_camera",
  "minecraft:evocation_fang",
];

/**
 * Entities within `radius` of `pos`, minus the owner when "Protect me" is on.
 * @param {{dim: Dimension, protect: boolean, ownerId: string}} ctx
 * @param {Vector3} pos @param {number} radius @returns {Entity[]}
 */
export function entitiesNear(ctx, pos, radius) {
  let list = [];
  try {
    list = ctx.dim.getEntities({ location: pos, maxDistance: radius, excludeTypes: SKIP_TYPES });
  } catch {
    return [];
  }
  return ctx.protect ? list.filter((e) => e.id !== ctx.ownerId) : list;
}

/**
 * Pushes an entity. Players can't take impulses, so they get knockback instead.
 * @param {Entity} e @param {Vector3} v
 */
export function push(e, v) {
  try {
    if (e.typeId === "minecraft:player") {
      const h = Math.hypot(v.x, v.z);
      e.applyKnockback(h ? v.x / h : 0, h ? v.z / h : 0, h, v.y);
    } else {
      e.applyImpulse(v);
    }
  } catch {
    // some entities can't be moved
  }
}

/** @param {Entity} e @param {number} amount */
export function hurt(e, amount) {
  try {
    e.applyDamage(amount, { cause: EntityDamageCause.entityExplosion });
  } catch {
    // invulnerable or gone
  }
}

/** Resistance V + Fire Resistance: the owner survives their own chaos. @param {Player} p @param {number} ticks */
export function protect(p, ticks) {
  try {
    p.addEffect("resistance", ticks, { amplifier: 4, showParticles: false });
    p.addEffect("fire_resistance", ticks, { amplifier: 0, showParticles: false });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------- messages
/** Tick until which the aim read-out in the action bar stays quiet, per player. */
export const quietUntil = new Map();

/** @param {Player} p @param {string} msg */
export function tell(p, msg) {
  try {
    p.sendMessage(msg);
  } catch {
    // left
  }
}

/** Shows an action-bar message and pauses the aim read-out for a moment. @param {Player} p @param {string} msg */
export function notify(p, msg, ticks = 50) {
  quietUntil.set(p.id, system.currentTick + ticks);
  try {
    p.onScreenDisplay.setActionBar(msg);
  } catch {
    // left
  }
}

/** @param {Player} p @param {string} text @param {string} [subtitle] */
export function title(p, text, subtitle) {
  try {
    p.onScreenDisplay.setTitle(text, { subtitle, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  } catch {
    // left
  }
}
