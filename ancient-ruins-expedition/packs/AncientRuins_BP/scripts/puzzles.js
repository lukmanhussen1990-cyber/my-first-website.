import { EntityDamageCause, system } from "@minecraft/server";
import { BLOCK, PARTICLE, RUIN_TYPES, THEME_TO_TYPE } from "./config.js";
import { awakenBoss } from "./bosses.js";
import { chartApprox } from "./ruins.js";
import { blockAt, blockIdOf, center, isBlock, isCreativeLike, notify, particle, playNear, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {{ theme: string, n: number, block: Block }} Glyph */
/** @typedef {{ theme: string, next: number, triggers: Vector3[], dim: string, tick: number }} Attempt */

const GLYPH_RE = /^ancient_ruins:(temple|crypt|ship)_glyph_([1-4])$/;
const ATTEMPT_TIMEOUT = 20 * 300; // 5 minutes

/** @type {Map<string, Attempt>} player id -> current sequence attempt */
const attempts = new Map();

/**
 * @param {Block | undefined} block
 * @returns {Glyph | undefined}
 */
export function glyphOf(block) {
  if (!block) return undefined;
  const id = blockIdOf(block);
  if (!id) return undefined;
  const m = GLYPH_RE.exec(id);
  return m ? { theme: m[1], n: Number(m[2]), block } : undefined;
}

/** @param {Block} block */
function adjacentGlyph(block) {
  let around = [];
  try {
    around = [block.north(), block.south(), block.east(), block.west(), block.below(), block.above()];
  } catch {
    return undefined;
  }
  for (const nb of around) {
    const g = glyphOf(nb);
    if (g) return g;
  }
  return undefined;
}

/**
 * A lever was switched on. Levers attached to glyph stones form the puzzle.
 * @param {Player} player
 * @param {Block} lever
 */
export function onLeverOn(player, lever) {
  const g = adjacentGlyph(lever);
  if (g) step(player, g, lever, true);
}

/**
 * A player stepped on a pressure plate that sits on a glyph pedestal.
 * @param {Player} player
 * @param {Block} plate
 * @param {Glyph} glyph
 */
export function onGlyphPlate(player, plate, glyph) {
  step(player, glyph, plate, false);
}

/** @param {string} playerId */
export function forgetPlayer(playerId) {
  attempts.delete(playerId);
}

/**
 * @param {Player} player
 * @param {Glyph} g
 * @param {Block} trigger
 * @param {boolean} isLever
 */
function step(player, g, trigger, isLever) {
  const now = system.currentTick;
  const dim = player.dimension;
  const loc = trigger.location;
  const type = THEME_TO_TYPE[/** @type {keyof typeof THEME_TO_TYPE} */ (g.theme)];
  const info = RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
  let a = attempts.get(player.id);
  if (!a || a.theme !== g.theme || a.dim !== dim.id || now - a.tick > ATTEMPT_TIMEOUT) {
    a = { theme: g.theme, next: 1, triggers: [], dim: dim.id, tick: now };
    attempts.set(player.id, a);
  }
  if (a.triggers.some((t) => t.x === loc.x && t.y === loc.y && t.z === loc.z)) return;
  a.tick = now;
  chartApprox(type, player, loc);

  if (g.n === a.next) {
    a.triggers.push({ x: loc.x, y: loc.y, z: loc.z });
    a.next++;
    particle(dim, PARTICLE.spark, center(g.block.location), info.rgb);
    playNear(dim, "note.chime", loc, 16, 1, 0.6 + g.n * 0.2);
    notify(player, `${info.color}Glyph ${g.n}/4 awakens...`);
    if (a.next > 4) {
      attempts.delete(player.id);
      solve(player, g.theme, a.triggers);
    }
    return;
  }

  // Wrong glyph: reset the sequence.
  const toReset = a.triggers.slice();
  attempts.delete(player.id);
  playNear(dim, "random.fizz", loc, 16, 1, 0.7);
  if (g.n === 1) {
    resetLevers(dim, toReset);
    attempts.set(player.id, { theme: g.theme, next: 2, triggers: [{ x: loc.x, y: loc.y, z: loc.z }], dim: dim.id, tick: now });
    particle(dim, PARTICLE.spark, center(g.block.location), info.rgb);
    notify(player, `${info.color}The sequence begins anew... Glyph 1/4`);
    return;
  }
  if (isLever) toReset.push({ x: loc.x, y: loc.y, z: loc.z });
  resetLevers(dim, toReset);
  notify(player, "§cThe glyphs fade... that is not the ancient order! Study the mural.");
  if (!isCreativeLike(player)) {
    try {
      player.applyDamage(2, { cause: EntityDamageCause.magic });
      player.addEffect("slowness", 40, { amplifier: 1, showParticles: false });
    } catch {
      // ignore
    }
  }
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {Vector3[]} locs
 */
function resetLevers(dim, locs) {
  if (!locs.length) return;
  system.runTimeout(() => {
    for (const l of locs) {
      const b = blockAt(dim, l);
      if (!b || !isBlock(b, "minecraft:lever")) continue;
      try {
        b.setPermutation(b.permutation.withState("open_bit", false));
      } catch (e) {
        warn("resetLever", e);
      }
    }
  }, 10);
}

/**
 * All four glyphs in order: the altar between them awakens its boss.
 * @param {Player} player
 * @param {string} theme
 * @param {Vector3[]} triggers
 */
function solve(player, theme, triggers) {
  const dim = player.dimension;
  const c = {
    x: triggers.reduce((s, t) => s + t.x, 0) / triggers.length,
    y: triggers.reduce((s, t) => s + t.y, 0) / triggers.length,
    z: triggers.reduce((s, t) => s + t.z, 0) / triggers.length,
  };
  const type = THEME_TO_TYPE[/** @type {keyof typeof THEME_TO_TYPE} */ (theme)];
  const info = RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
  let altar;
  let dormant = false;
  let best = Infinity;
  const cx = Math.round(c.x);
  const cy = Math.round(c.y);
  const cz = Math.round(c.z);
  for (let dy = -3; dy <= 1; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const b = blockAt(dim, { x: cx + dx, y: cy + dy, z: cz + dz });
        if (!b) continue;
        const d = dx * dx + dz * dz + dy * dy;
        if (d >= best) continue;
        if (isBlock(b, info.altar)) {
          altar = b;
          best = d;
        } else if (!altar && isBlock(b, BLOCK.dormantAltar)) {
          dormant = true;
        }
      }
    }
  }
  if (altar) {
    playNear(dim, "beacon.activate", altar.location, 24, 1, 0.8);
    awakenBoss(altar, theme, player);
  } else if (dormant) {
    notify(player, "§7The altar is silent. Its guardian has already awakened.");
  } else {
    notify(player, "§7The glyphs glow... but no altar answers.");
  }
}
