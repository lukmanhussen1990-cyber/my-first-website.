import { EntityDamageCause, system } from "@minecraft/server";
import { BLOCK, CRUMBLING, PARTICLE, TUNING } from "./config.js";
import { blockAt, blockIdOf, isBlock, isCreativeLike, key, notify, particle, perm, playNear, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

// facing_direction -> unit vector (0 down, 1 up, 2 north, 3 south, 4 west, 5 east)
const FACING = [
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: -1, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
];

/** @type {Map<string, number>} */
const trapCooldown = new Map();
/** @type {Map<string, Vector3[]>} */
const dispenserCache = new Map();

/**
 * Arrow trap: a pressure plate on a Trap Mechanism powers every dispenser
 * near it for a moment (two volleys). No redstone wiring needed.
 * @param {Dimension} dim
 * @param {Block} plate
 * @param {Player} player
 */
export function fireArrowTrap(dim, plate, player) {
  const k = `${dim.id}|${key(plate.location)}`;
  const now = system.currentTick;
  if (now - (trapCooldown.get(k) ?? -1e9) < TUNING.trapCooldown) return;
  trapCooldown.set(k, now);
  let dispensers = dispenserCache.get(k);
  if (!dispensers) {
    dispensers = findDispensers(dim, plate.location);
    dispenserCache.set(k, dispensers);
  }
  playNear(dim, "random.click", plate.location, 16, 1, 0.6);
  if (!isCreativeLike(player)) notify(player, "§c*click* ...a trap!");
  pulse(dim, dispensers);
  system.runTimeout(() => pulse(dim, dispensers), 12);
}

/**
 * One-time scan (cached) for dispensers around a trap plate.
 * @param {Dimension} dim
 * @param {Vector3} p
 */
function findDispensers(dim, p) {
  /** @type {Vector3[]} */
  const found = [];
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let dy = -1; dy <= 2; dy++) {
        const loc = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
        const b = blockAt(dim, loc);
        if (b && isBlock(b, BLOCK.dispenser)) found.push(loc);
      }
    }
  }
  return found;
}

/**
 * Briefly place a redstone block behind each dispenser, then restore it.
 * @param {Dimension} dim
 * @param {Vector3[]} dispensers
 */
function pulse(dim, dispensers) {
  for (const loc of dispensers) {
    try {
      const d = blockAt(dim, loc);
      if (!d || !isBlock(d, BLOCK.dispenser)) continue;
      const facing = Number(d.permutation.getState("facing_direction") ?? 3);
      const v = FACING[facing] ?? FACING[3];
      const behindLoc = { x: loc.x - v.x, y: loc.y - v.y, z: loc.z - v.z };
      const behind = blockAt(dim, behindLoc);
      if (!behind || behind.getComponent("minecraft:inventory") || isBlock(behind, BLOCK.redstone)) continue;
      const saved = behind.permutation;
      behind.setPermutation(perm(BLOCK.redstone));
      system.runTimeout(() => {
        const b = blockAt(dim, behindLoc);
        if (b && isBlock(b, BLOCK.redstone)) b.setPermutation(saved);
      }, 6);
    } catch (e) {
      warn("arrow trap", e);
    }
  }
}

/** @type {Set<string>} */
const cracking = new Set();

/**
 * A player stepped on a crumbling floor tile: crack, then collapse the whole
 * connected patch. Temple/crypt tiles become falling sand, rotten planks break.
 * @param {Dimension} dim
 * @param {Block} block
 * @param {Player} player
 */
export function stepOnCrumbling(dim, block, player) {
  const k = `${dim.id}|${key(block.location)}`;
  if (cracking.has(k) || isCreativeLike(player)) return;
  cracking.add(k);
  const start = block.location;
  playNear(dim, "dig.gravel", start, 16, 1, 0.6);
  particle(dim, PARTICLE.dust, { x: start.x + 0.5, y: start.y + 1, z: start.z + 0.5 }, { red: 0.85, green: 0.75, blue: 0.5 });
  notify(player, "§6The floor is cracking beneath you!");
  system.runTimeout(() => {
    try {
      collapse(dim, start);
    } catch (e) {
      warn("collapse", e);
    }
    cracking.delete(k);
  }, TUNING.collapseDelay);
}

/**
 * @param {Dimension} dim
 * @param {Vector3} start
 */
function collapse(dim, start) {
  const queue = [start];
  const seen = new Set();
  /** @type {{ block: Block, mode: string }[]} */
  const tiles = [];
  while (queue.length && tiles.length < 48) {
    const p = /** @type {Vector3} */ (queue.pop());
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    const b = blockAt(dim, p);
    const id = blockIdOf(b);
    if (!b || !id || !(id in CRUMBLING)) continue;
    tiles.push({ block: b, mode: CRUMBLING[/** @type {keyof typeof CRUMBLING} */ (id)] });
    queue.push({ x: p.x + 1, y: p.y, z: p.z }, { x: p.x - 1, y: p.y, z: p.z },
      { x: p.x, y: p.y, z: p.z + 1 }, { x: p.x, y: p.y, z: p.z - 1 });
  }
  if (!tiles.length) return;
  let i = 0;
  for (const { block, mode } of tiles) {
    const loc = block.location;
    if (mode === "sand") {
      block.setPermutation(perm("minecraft:sand"));
    } else {
      const above = block.above();
      block.setPermutation(perm(above && above.isLiquid ? "minecraft:water" : "minecraft:air"));
    }
    if (i++ % 3 === 0) particle(dim, PARTICLE.dust, { x: loc.x + 0.5, y: loc.y + 0.8, z: loc.z + 0.5 }, { red: 0.85, green: 0.75, blue: 0.5 });
  }
  playNear(dim, tiles[0].mode === "sand" ? "dig.sand" : "random.break", start, 24, 1, 0.7);
  for (const p of dim.getPlayers({ location: { x: start.x + 0.5, y: start.y + 1, z: start.z + 0.5 }, maxDistance: 4 })) {
    if (isCreativeLike(p)) continue;
    try {
      p.applyDamage(2, { cause: EntityDamageCause.fallingBlock });
      notify(p, "§6The floor collapses!");
    } catch {
      // ignore
    }
  }
}

/** @type {Set<string>} */
const inGas = new Set();

/**
 * Standing on a Miasma Vent: poison + a few gas particles (mobile light).
 * @param {Dimension} dim
 * @param {Player} player
 * @param {number} tick
 */
export function onMiasma(dim, player, tick) {
  if (isCreativeLike(player)) return;
  try {
    const poison = player.getEffect("poison");
    if (!poison || poison.duration < 20) player.addEffect("poison", 80, { amplifier: 0, showParticles: false });
    if (tick % 2 === 0) {
      const l = player.location;
      particle(dim, PARTICLE.gas, { x: l.x, y: l.y, z: l.z });
    }
    if (!inGas.has(player.id)) {
      inGas.add(player.id);
      notify(player, "§2Poison gas! Cross the vents quickly!");
      playNear(dim, "random.fizz", player.location, 12, 0.6, 0.5);
    }
  } catch (e) {
    warn("gas", e);
  }
}

/** @param {string} playerId */
export function leftGas(playerId) {
  inGas.delete(playerId);
}
