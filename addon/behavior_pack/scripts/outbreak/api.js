// @ts-check
// Public API of the outbreak subsystem (SPEC §7) for the UI, commands and tests.
//
//   getState, getConfig, setConfig, startOutbreak(dim, loc, player?), pause,
//   resume, cleanup, cure, hordeCount, infect(entity, sourceEntity)
// plus a few read-only helpers (getStatus, curePlayer, convertNow, runGeneration).

import { getConfig as cfgGet, setConfig as cfgSet } from "./config.js";
import { S, rt, saveState } from "./state.js";
import { hordeCount as countHorde, hordeStatus } from "./horde.js";
import { startOutbreak as start, runGeneration as generation } from "./replication.js";
import { pause as doPause, resume as doResume } from "./dormancy.js";
import { cleanup as doCleanup, cure as doCure } from "./purge.js";
import { infect as doInfect, infectionStage } from "./infection.js";
import { curePlayer as doCurePlayer } from "./players.js";
import { convertMob } from "./conversion.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("./state.js").OutbreakState} OutbreakState */
/** @typedef {import("./config.js").OutbreakConfig} OutbreakConfig */
/** @typedef {import("./horde.js").HordeStatus} HordeStatus */

/** A deep copy of the persistent state (ticksToNext is live). @returns {OutbreakState} */
export function getState() {
  return JSON.parse(JSON.stringify(S()));
}

/** A copy of the config. @returns {OutbreakConfig} */
export function getConfig() {
  S();
  return { ...cfgGet() };
}

/**
 * Change settings (clamped to their ranges, persisted immediately). A shorter
 * replication interval also shortens the running countdown.
 * @param {Partial<OutbreakConfig>} partial
 * @returns {OutbreakConfig}
 */
export function setConfig(partial) {
  const st = S();
  const cfg = cfgSet(partial);
  if (st.active && st.ticksToNext > cfg.replicationSeconds * 20) {
    st.ticksToNext = cfg.replicationSeconds * 20;
    saveState();
  }
  return { ...cfg };
}

/**
 * Release a parasite (activates the outbreak if it is inactive).
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @param {Player} [player]
 * @returns {Entity | undefined}
 */
export function startOutbreak(dim, loc, player) {
  return start(dim, loc, player);
}

/** @returns {boolean} */
export function pause() {
  return doPause();
}

/** @returns {boolean} */
export function resume() {
  return doResume();
}

/** @returns {number} loaded entities affected */
export function cleanup() {
  return doCleanup();
}

/** @returns {number} loaded entities affected */
export function cure() {
  return doCure();
}

/** Loaded horde in all dimensions + pending spawns. @returns {number} */
export function hordeCount() {
  S();
  return countHorde();
}

/**
 * Start an infection on `entity` (same rules as a horde hit).
 * @param {Entity} entity
 * @param {Entity} [sourceEntity]
 * @returns {boolean}
 */
export function infect(entity, sourceEntity) {
  return doInfect(entity, sourceEntity);
}

/** Counts for status displays. @returns {HordeStatus} */
export function getStatus() {
  S();
  return hordeStatus();
}

/**
 * Infection stage of an entity: 0 healthy, 1 incubating, 2 fully infected.
 * @param {Entity} entity
 * @returns {0 | 1 | 2}
 */
export function stageOf(entity) {
  return infectionStage(entity);
}

/**
 * Clear one player's infection ("Cure me").
 * @param {Player} player
 * @returns {boolean}
 */
export function curePlayer(player) {
  S();
  return doCurePlayer(player);
}

/**
 * Convert an incubating/vanilla mob immediately (respects the cap).
 * @param {Entity} entity
 * @returns {import("./conversion.js").ConvertResult}
 */
export function convertNow(entity) {
  S();
  return convertMob(entity);
}

/** Force a generation now (debug). @returns {number} offspring queued */
export function runGeneration() {
  S();
  return generation();
}

/** Diagnostics for tests: queue sizes. */
export function runtimeInfo() {
  return {
    pendingSpawns: rt.spawnQueue.length,
    convertQueue: rt.convertQueue.size,
    held: rt.held.size,
    incBatch: rt.incBatch.length - rt.incPos,
    purgeQueue: rt.purgeQueue.length,
    sweepQueue: rt.sweepQueue.length - rt.sweepPos,
    deferred: rt.deferred.length,
    dying: rt.dying.size,
  };
}
