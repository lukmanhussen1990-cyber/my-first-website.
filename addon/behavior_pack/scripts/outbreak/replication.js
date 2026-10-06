// @ts-check
// Outbreak start and parasite replication (SPEC §7).
//
// Timer: state.ticksToNext counts down every tick while the outbreak is active
// and not paused (tick-exact; frozen while paused; persisted by the 1 Hz loop).
// At <= 0 a generation runs: snapshot of the loaded living parasites, budget =
// populationCap - hordeCount(); the first min(snapshot, budget) parasites get
// one offspring each. Offspring are queued (counted as pending by hordeCount)
// and spawned next to their parent at <= MAX_SPAWNS_PER_TICK per tick.
// With no deaths and no cap the population doubles: 1 -> 2 -> 4 -> 8.

import { world, system } from "@minecraft/server";
import { ENTITIES, EVENTS, PROPS, SOUNDS } from "../lib/ids.js";
import { getDimension, isLoaded, isValidEntity, logError, playSound, playSoundTo, runSafe, safeGetBlock, tell, title } from "../lib/util.js";
import { getConfig } from "./config.js";
import { S, rt, saveState, markDirty, emptyStats, advanceCountdown } from "./state.js";
import { hordeCount, listParasites } from "./horde.js";
import { applySpawnDormancy } from "./dormancy.js";
import { birthSplatter } from "./fx.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Block} Block */

/** Max entity spawns (offspring + conversions) per tick. */
export const MAX_SPAWNS_PER_TICK = 8;

/** Neighbour cells tried for an offspring (rotated per spawn). */
const OFFSETS = Object.freeze([
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: -1, z: 1 },
]);

/** Blocks a mob can stand in (no collision). */
const OPEN_RE =
  /^minecraft:(air|light_block|short_grass|tall_grass|grass|fern|large_fern|deadbush|snow_layer|vine|.*_flower|poppy|dandelion|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|.*sapling|.*_carpet|.*torch|.*_button|.*pressure_plate|rail|.*_rail|redstone_wire|wheat|carrots|potatoes|beetroot|sweet_berry_bush|brown_mushroom|red_mushroom|crimson_roots|warped_roots|nether_sprouts|pink_petals|glow_lichen|.*_sign|.*_banner)$/;

/**
 * Whether a mob can occupy the block cell.
 * @param {Block} b
 * @returns {boolean}
 */
export function isOpenBlock(b) {
  try {
    return b.isAir || b.isLiquid || OPEN_RE.test(b.typeId);
  } catch {
    return false;
  }
}

/**
 * A loaded free cell next to `base` (prefers cells with ground below), else
 * any loaded free neighbour, else `base` itself when loaded.
 * @param {Dimension} dim
 * @param {Vector3} base
 * @param {number} seq rotates the first neighbour tried
 * @returns {Vector3 | undefined}
 */
export function findSpawnSpot(dim, base, seq) {
  /** @type {Vector3 | undefined} */
  let fallback;
  for (let k = 0; k < OFFSETS.length; k++) {
    const o = OFFSETS[(seq + k) % OFFSETS.length];
    const p = { x: base.x + o.x, y: base.y, z: base.z + o.z };
    const b = safeGetBlock(dim, p);
    if (!b || !isOpenBlock(b)) continue;
    const below = safeGetBlock(dim, { x: p.x, y: p.y - 1, z: p.z });
    if (below && !isOpenBlock(below)) return p;
    if (!fallback) fallback = p;
  }
  if (fallback) return fallback;
  return isLoaded(dim, base) ? { x: base.x, y: base.y, z: base.z } : undefined;
}

/**
 * Release a parasite at `loc` (SPEC §7 "Start"). Activates the outbreak when
 * it is inactive; otherwise adds one more parasite.
 * @param {Dimension} dim
 * @param {Vector3} loc feet location of the new parasite
 * @param {Player} [player] who released it (gets messages)
 * @returns {Entity | undefined} the parasite, or undefined (cap reached / cannot spawn)
 */
export function startOutbreak(dim, loc, player) {
  const st = S();
  const cfg = getConfig();
  if (hordeCount() >= cfg.populationCap) {
    if (player) tell(player, `§c☣ The horde is at its population cap (${cfg.populationCap}). No parasite released.`);
    return undefined;
  }
  /** @type {Entity} */
  let e;
  try {
    e = dim.spawnEntity(ENTITIES.PARASITE, loc);
  } catch (err) {
    logError("outbreak.start.spawn", err);
    if (player) tell(player, "§c☣ The parasite cannot be released here.");
    return undefined;
  }
  const wasActive = st.active;
  if (!wasActive) {
    st.active = true;
    st.paused = false;
    st.generation = 0;
    st.ticksToNext = cfg.replicationSeconds * 20;
    st.stats = emptyStats();
    rt.countdownTick = system.currentTick;
  }
  try {
    e.setDynamicProperty(PROPS.EPOCH, st.epoch);
  } catch (err) {
    logError("outbreak.start.epoch", err);
  }
  applySpawnDormancy(e);
  birthSplatter(dim, loc);
  playSound(dim, SOUNDS.OUTBREAK_START, loc);
  if (!wasActive) {
    for (const p of world.getAllPlayers()) {
      title(p, "§4☣ PARASITE OUTBREAK ☣", "§cThe parasite has been released");
      playSoundTo(p, SOUNDS.OUTBREAK_START);
    }
  } else if (player) {
    tell(player, "§c☣ Another parasite joins the outbreak.");
  }
  saveState();
  return e;
}

/**
 * Run one generation now: queue one offspring for each of the first
 * min(snapshot, cap - hordeCount()) parasites, then generation++ and reset the timer.
 * @returns {number} offspring queued
 */
export function runGeneration() {
  const st = S();
  const cfg = getConfig();
  const snapshot = listParasites();
  const budget = cfg.populationCap - hordeCount();
  const n = Math.max(0, Math.min(snapshot.length, budget));
  for (let i = 0; i < n; i++) {
    const parent = snapshot[i];
    try {
      rt.spawnQueue.push({ parentId: parent.id, dimId: parent.dimension.id, loc: parent.location });
    } catch {
      // parent became invalid during the snapshot
    }
  }
  st.generation++;
  st.ticksToNext = cfg.replicationSeconds * 20;
  rt.countdownTick = system.currentTick;
  saveState();
  return n;
}

/**
 * Per-tick replication timer.
 * @returns {boolean} whether a generation ran
 */
export function tickCountdown() {
  const st = S();
  if (!st.active || st.paused) {
    rt.countdownTick = system.currentTick;
    return false;
  }
  if (advanceCountdown() > 0) return false;
  runGeneration();
  return true;
}

/**
 * Spawn one queued offspring (the job is already dequeued, so a failure never
 * leaks a pending count).
 * @param {import("./state.js").SpawnJob} job
 * @returns {boolean}
 */
function spawnOffspring(job) {
  /** @type {Entity | undefined} */
  let parent;
  try {
    parent = world.getEntity(job.parentId);
  } catch {
    parent = undefined;
  }
  /** @type {Dimension | undefined} */
  let dim;
  /** @type {Vector3} */
  let base = job.loc;
  if (parent && isValidEntity(parent)) {
    dim = parent.dimension;
    base = parent.location;
  } else {
    dim = getDimension(job.dimId);
  }
  if (!dim) return false;
  const spot = findSpawnSpot(dim, base, rt.spawnSeq++);
  if (!spot) return false;
  /** @type {Entity} */
  let child;
  try {
    child = dim.spawnEntity(ENTITIES.PARASITE, spot);
  } catch (err) {
    logError("outbreak.offspring.spawn", err);
    return false;
  }
  try {
    child.setDynamicProperty(PROPS.EPOCH, S().epoch);
  } catch (err) {
    logError("outbreak.offspring.epoch", err);
  }
  applySpawnDormancy(child);
  try {
    child.triggerEvent(EVENTS.BORN); // optional birth flourish (visual only)
  } catch {
    // older entity definition without pas:born
  }
  birthSplatter(dim, spot);
  playSound(dim, SOUNDS.PARASITE_BIRTH, spot);
  S().stats.births++;
  markDirty();
  return true;
}

/**
 * Spawn up to `limit` queued offspring.
 * @param {number} limit
 * @returns {number} jobs consumed (spawned or dropped)
 */
export function processSpawnQueue(limit) {
  let n = 0;
  while (rt.spawnQueue.length > 0 && n < limit) {
    const job = /** @type {import("./state.js").SpawnJob} */ (rt.spawnQueue.shift());
    n++;
    runSafe(() => spawnOffspring(job), "outbreak.offspring");
  }
  return n;
}
