// @ts-check
// Cleanup and Cure with epochs (SPEC §7), lazy purging and the 5 s sync sweep.
//
// cleanup()/cure(): epoch++, purges[epoch] = kind, outbreak inactive. Every
// loaded horde entity, incubating mob and infected player is queued and purged
// at PURGE_PER_TICK per tick (the first batch immediately):
//   cleanup  horde removed, infections cleared
//   cure     parasites/infected humans removed, infected creatures reverted to
//            their pas:origin type (conversion.js), infections cleared
// Entities that were unloaded (or players that were offline) keep their old
// pas:epoch / pas:inc_epoch. When they load (entityLoad, playerSpawn, the
// incubation cycle or the sweep) the first purge recorded after their epoch is
// applied to them.

import { world, system } from "@minecraft/server";
import { CONVERSIONS, PROPS, TAGS } from "../lib/ids.js";
import { isValidEntity, runSafe } from "../lib/util.js";
import { S, rt, saveState, recordPurge, purgeKindAfter } from "./state.js";
import { hasTag, isHorde, isPlayer, loadedHorde, queryAll } from "./horde.js";
import { revertCreature } from "./conversion.js";
import { clearInfection, infectionIsStale, numProp, purgeInfectionHolder } from "./infection.js";
import { syncDormancy } from "./dormancy.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./state.js").PurgeKind} PurgeKind */

/** Max entities purged per tick. */
export const PURGE_PER_TICK = 32;
/** Max horde entities checked per tick by the sync sweep. */
export const SWEEP_PER_TICK = 48;
/** Dying-entity records older than this are dropped. */
const DYING_TTL = 200;

/**
 * Purge one entity.
 * @param {Entity} e
 * @param {PurgeKind} kind
 */
export function purgeOne(e, kind) {
  if (!isValidEntity(e)) return;
  if (isHorde(e)) {
    if (kind === "cure") revertCreature(e);
    else e.remove();
    return;
  }
  if (!hasTag(e, TAGS.INCUBATING) && !hasTag(e, TAGS.INFECTED_PLAYER)) return;
  clearInfection(e);
  if (isPlayer(e)) {
    try {
      /** @type {Player} */ (e).sendMessage(
        kind === "cure" ? "§a☣ Everyone has been cured. You are healthy again." : "§a☣ The outbreak was cleaned up. Your infection is gone.",
      );
    } catch {
      // ignore
    }
  }
}

/**
 * @param {PurgeKind} kind
 * @returns {number} entities queued
 */
function beginPurge(kind) {
  const st = S();
  st.epoch++;
  recordPurge(st.epoch, kind);
  st.active = false;
  st.paused = false;
  st.generation = 0;
  st.ticksToNext = 0;
  rt.spawnQueue.length = 0;
  rt.convertQueue.clear();
  rt.incBatch = [];
  rt.incPos = 0;
  rt.held.clear();
  rt.sweepQueue = [];
  rt.sweepPos = 0;
  rt.countdownTick = system.currentTick;
  saveState();
  /** @type {Set<string>} */
  const seen = new Set(rt.purgeQueue.map((j) => j.entity.id));
  /** @param {Entity} e */
  const add = (e) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    rt.purgeQueue.push({ entity: e, kind });
  };
  for (const e of loadedHorde()) add(e);
  for (const e of queryAll({ tags: [TAGS.INCUBATING] })) add(e);
  for (const e of queryAll({ tags: [TAGS.INFECTED_PLAYER] })) add(e);
  const n = rt.purgeQueue.length;
  processPurgeQueue(PURGE_PER_TICK);
  return n;
}

/**
 * Remove the whole horde and every infection; outbreak inactive.
 * @returns {number} loaded entities affected
 */
export function cleanup() {
  return beginPurge("cleanup");
}

/**
 * Revert infected creatures, remove parasites, cure everyone; outbreak inactive.
 * @returns {number} loaded entities affected
 */
export function cure() {
  return beginPurge("cure");
}

/**
 * @param {number} limit
 * @returns {number} processed
 */
export function processPurgeQueue(limit) {
  let n = 0;
  while (rt.purgeQueue.length > 0 && n < limit) {
    const job = /** @type {import("./state.js").PurgeJob} */ (rt.purgeQueue.shift());
    n++;
    runSafe(() => purgeOne(job.entity, job.kind), "outbreak.purge");
  }
  return n;
}

/**
 * Lazy handling of a horde entity (entityLoad / sweep): purge if its epoch is
 * stale, otherwise sync its dormancy with the pause state.
 * @param {Entity} e
 */
export function checkHordeEntity(e) {
  if (!isValidEntity(e)) return;
  const st = S();
  const epoch = numProp(e, PROPS.EPOCH);
  if (epoch !== undefined && epoch < st.epoch) {
    purgeOne(e, purgeKindAfter(epoch));
    return;
  }
  syncDormancy(e);
}

/**
 * entityLoad: lazy purge / dormancy sync for horde entities and stale
 * infections of vanilla mobs.
 * @param {Entity} e
 */
export function onEntityLoad(e) {
  if (isHorde(e)) {
    checkHordeEntity(e);
    return;
  }
  let typeId;
  try {
    typeId = e.typeId;
  } catch {
    return;
  }
  if (!(typeId in CONVERSIONS) || !hasTag(e, TAGS.INCUBATING)) return;
  if (infectionIsStale(e)) purgeInfectionHolder(e);
}

/**
 * Start a 5-second sync sweep over all loaded horde entities (skipped while
 * the previous sweep is still running).
 * @returns {boolean}
 */
export function startSweep() {
  const now = system.currentTick;
  for (const [id, t] of rt.dying) if (now - t > DYING_TTL) rt.dying.delete(id);
  if (rt.sweepPos < rt.sweepQueue.length) return false;
  rt.sweepQueue = loadedHorde();
  rt.sweepPos = 0;
  processSweepQueue(SWEEP_PER_TICK);
  return true;
}

/**
 * @param {number} limit
 * @returns {number} processed
 */
export function processSweepQueue(limit) {
  let n = 0;
  while (rt.sweepPos < rt.sweepQueue.length && n < limit) {
    const e = rt.sweepQueue[rt.sweepPos++];
    n++;
    runSafe(() => checkHordeEntity(e), "outbreak.sweep");
  }
  if (rt.sweepPos >= rt.sweepQueue.length) {
    rt.sweepQueue = [];
    rt.sweepPos = 0;
  }
  return n;
}

/** Online players (never throws). @returns {Player[]} */
export function allPlayers() {
  try {
    return world.getAllPlayers();
  } catch {
    return [];
  }
}
