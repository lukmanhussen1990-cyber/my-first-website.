// @ts-check
// Outbreak state (SPEC §7) and the in-memory runtime of the subsystem.
//
// Persistent state lives in world property `pas:outbreak` (JSON via lib/store):
//   { v:1, active, paused, generation, ticksToNext, epoch, purges, stats }
// Everything else in this file (`rt`) is a cache/work queue that is rebuilt
// from world and entity data after a reload (see ensureLoaded()).
//
// The world must not be read at import time, so the state is loaded lazily by
// the first event handler / interval / API call (ensureLoaded()).

import { system } from "@minecraft/server";
import { PROPS } from "../lib/ids.js";
import { loadJSON, saveJSON } from "../lib/store.js";
import { loadConfig, resetConfigMemory } from "./config.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {"cleanup" | "cure"} PurgeKind */

/**
 * @typedef {object} OutbreakStats
 * @property {number} births offspring parasites produced by replication
 * @property {number} infections infections started (mobs and players)
 * @property {number} conversions mobs converted into infected creatures + infected humans from dead players
 * @property {number} deaths horde entities that died
 */

/**
 * @typedef {object} OutbreakState
 * @property {1} v
 * @property {boolean} active
 * @property {boolean} paused
 * @property {number} generation
 * @property {number} ticksToNext ticks until the next generation (frozen while paused)
 * @property {number} epoch incremented by every cleanup/cure
 * @property {Record<string, PurgeKind>} purges epoch -> what happened when that epoch began
 * @property {OutbreakStats} stats
 */

/** At most this many purge records are kept (older entities default to "cleanup"). */
export const MAX_PURGE_RECORDS = 64;

/** @returns {OutbreakStats} */
export function emptyStats() {
  return { births: 0, infections: 0, conversions: 0, deaths: 0 };
}

/** @returns {OutbreakState} */
export function defaultState() {
  return { v: 1, active: false, paused: false, generation: 0, ticksToNext: 0, epoch: 0, purges: {}, stats: emptyStats() };
}

/**
 * @param {unknown} v
 * @param {number} fallback
 * @returns {number}
 */
function int(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
}

/**
 * Build a valid state from untrusted data.
 * @param {unknown} raw
 * @returns {OutbreakState}
 */
export function sanitizeState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== "object") return s;
  const r = /** @type {Record<string, any>} */ (raw);
  s.active = r.active === true;
  s.paused = s.active && r.paused === true;
  s.generation = Math.max(0, int(r.generation, 0));
  s.ticksToNext = Math.max(0, int(r.ticksToNext, 0));
  s.epoch = Math.max(0, int(r.epoch, 0));
  if (r.purges && typeof r.purges === "object") {
    for (const [k, v] of Object.entries(r.purges)) {
      if (/^\d+$/.test(k) && (v === "cleanup" || v === "cure")) s.purges[k] = v;
    }
  }
  if (r.stats && typeof r.stats === "object") {
    for (const k of /** @type {(keyof OutbreakStats)[]} */ (["births", "infections", "conversions", "deaths"])) {
      s.stats[k] = Math.max(0, int(r.stats[k], 0));
    }
  }
  return s;
}

/**
 * @typedef {object} SpawnJob
 * @property {string} parentId
 * @property {string} dimId
 * @property {Vector3} loc parent location at snapshot time (fallback)
 */

/**
 * @typedef {object} PurgeJob
 * @property {Entity} entity
 * @property {PurgeKind} kind
 */

/**
 * @typedef {object} DeferredJob
 * @property {number} due tick
 * @property {string} label
 * @property {() => void} fn
 */

/** In-memory runtime (never persisted). */
export const rt = {
  loaded: false,
  /** @type {SpawnJob[]} pending offspring spawns (counted by hordeCount) */
  spawnQueue: [],
  /** @type {Map<string, Entity>} mobs whose incubation finished, waiting for a spawn slot */
  convertQueue: new Map(),
  /** @type {Entity[]} incubating entities collected by the current 1 Hz cycle */
  incBatch: [],
  incPos: 0,
  /** @type {PurgeJob[]} */
  purgeQueue: [],
  /** @type {Entity[]} horde entities to check by the 5 s sync sweep */
  sweepQueue: [],
  sweepPos: 0,
  /** @type {DeferredJob[]} */
  deferred: [],
  /** @type {Map<string, number>} horde entity id -> tick it died (still valid during the death animation) */
  dying: new Map(),
  /** @type {Set<string>} ids of mobs whose conversion is held because the horde is at the cap */
  held: new Set(),
  /** tick at which ticksToNext was last decremented */
  countdownTick: 0,
  /** tick + direction of the last mass dormancy change (never send dormant+active in one tick) */
  dormancyTick: -1,
  /** @type {boolean | undefined} */
  dormancyValue: undefined,
  /** 1 Hz cycle counter */
  slowCycle: 0,
  /** rotates the offspring placement */
  spawnSeq: 0,
};

/** @type {OutbreakState} */
let state = defaultState();
let dirty = false;

/**
 * Load config + state from the world once (idempotent). Called at the start of
 * every entry point because the world may not be readable at import time.
 */
export function ensureLoaded() {
  if (rt.loaded) return;
  rt.loaded = true;
  loadConfig();
  state = sanitizeState(loadJSON(PROPS.OUTBREAK, undefined));
  rt.countdownTick = system.currentTick;
}

/** The live state object (mutate only from outbreak modules, then save). @returns {OutbreakState} */
export function S() {
  ensureLoaded();
  return state;
}

/** Persist the state now. */
export function saveState() {
  dirty = false;
  saveJSON(PROPS.OUTBREAK, state);
}

/** Remember that the state changed; the 1 Hz loop saves it. */
export function markDirty() {
  dirty = true;
}

/** Save if markDirty() was called since the last save. */
export function saveIfDirty() {
  if (dirty) saveState();
}

/**
 * Record a purge for `epoch`, dropping the oldest records beyond MAX_PURGE_RECORDS.
 * @param {number} epoch
 * @param {PurgeKind} kind
 */
export function recordPurge(epoch, kind) {
  state.purges[String(epoch)] = kind;
  const keys = Object.keys(state.purges)
    .map(Number)
    .sort((a, b) => a - b);
  while (keys.length > MAX_PURGE_RECORDS) delete state.purges[String(keys.shift())];
}

/**
 * Which purge an entity created in `entityEpoch` was subject to: the first purge
 * recorded after it. Records that were pruned default to "cleanup".
 * @param {number} entityEpoch
 * @returns {PurgeKind}
 */
export function purgeKindAfter(entityEpoch) {
  let best = Infinity;
  /** @type {PurgeKind} */
  let kind = "cleanup";
  for (const [k, v] of Object.entries(state.purges)) {
    const e = Number(k);
    if (e > entityEpoch && e < best) {
      best = e;
      kind = v;
    }
  }
  return kind;
}

/**
 * Apply the ticks elapsed since the last call to `ticksToNext` (only while
 * active and not paused). The countdown is tick-exact: the pump calls this
 * every tick, pause() calls it before freezing.
 * @returns {number} the remaining ticks (may be <= 0: a generation is due)
 */
export function advanceCountdown() {
  const now = system.currentTick;
  const dt = now - rt.countdownTick;
  rt.countdownTick = now;
  if (dt > 0 && state.active && !state.paused) state.ticksToNext -= dt;
  return state.ticksToNext;
}

/** Drop every in-memory queue/cache (keeps nothing about the world). */
export function resetRuntime() {
  rt.spawnQueue.length = 0;
  rt.convertQueue.clear();
  rt.incBatch = [];
  rt.incPos = 0;
  rt.purgeQueue.length = 0;
  rt.sweepQueue = [];
  rt.sweepPos = 0;
  rt.deferred.length = 0;
  rt.dying.clear();
  rt.held.clear();
  rt.dormancyTick = -1;
  rt.dormancyValue = undefined;
}

/** Forget everything in memory; the next entry point reloads from the world (tests). */
export function resetMemory() {
  resetRuntime();
  resetConfigMemory();
  state = defaultState();
  dirty = false;
  rt.loaded = false;
  rt.slowCycle = 0;
  rt.spawnSeq = 0;
}

/**
 * Run `fn` at tick `currentTick + delay` from the outbreak pump (bounded, error-contained).
 * @param {number} delay
 * @param {string} label
 * @param {() => void} fn
 */
export function defer(delay, label, fn) {
  rt.deferred.push({ due: system.currentTick + Math.max(1, Math.floor(delay)), label, fn });
}
