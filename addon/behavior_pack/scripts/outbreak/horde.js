// @ts-check
// Horde queries and the population count (SPEC §7).
//
// hordeCount() = loaded entities with family `pas_horde` in the overworld, the
// nether and the end (minus horde entities that already died and are only
// playing their death animation) + pending queued offspring spawns.
// Replication, conversion and infected-human spawns all use it (through
// HordeBudget when several spawns happen in one tick).

import { ENTITIES, FAMILIES, TAGS } from "../lib/ids.js";
import { allDimensions, isValidEntity } from "../lib/util.js";
import { getConfig } from "./config.js";
import { rt } from "./state.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").EntityHealthComponent} EntityHealthComponent */
/** @typedef {import("@minecraft/server").EntityTypeFamilyComponent} EntityTypeFamilyComponent */

/** Every entity type that belongs to the horde (all have family pas_horde). */
/** @type {ReadonlySet<string>} */
export const HORDE_TYPES = new Set(Object.values(ENTITIES));

/**
 * @param {string | undefined} typeId
 * @returns {boolean}
 */
export function isHordeType(typeId) {
  return typeId !== undefined && HORDE_TYPES.has(typeId);
}

/**
 * Whether `e` is a horde entity (by type, or by family for unknown pas:* types).
 * @param {Entity | undefined} e
 * @returns {boolean}
 */
export function isHorde(e) {
  if (!e) return false;
  try {
    const t = e.typeId;
    if (HORDE_TYPES.has(t)) return true;
    if (!t.startsWith("pas:")) return false;
    const tf = /** @type {EntityTypeFamilyComponent | undefined} */ (e.getComponent("minecraft:type_family"));
    return !!tf && tf.hasTypeFamily(FAMILIES.HORDE);
  } catch {
    return false;
  }
}

/** @param {Entity} e @returns {boolean} */
export function isPlayer(e) {
  try {
    return e.typeId === "minecraft:player";
  } catch {
    return false;
  }
}

/**
 * Current health, or 0 when unknown/invalid.
 * @param {Entity} e
 * @returns {number}
 */
export function healthOf(e) {
  try {
    const h = /** @type {EntityHealthComponent | undefined} */ (e.getComponent("minecraft:health"));
    return h ? h.currentValue : 1;
  } catch {
    return 0;
  }
}

/**
 * Valid, not dying and with health left.
 * @param {Entity | undefined} e
 * @returns {boolean}
 */
export function isAlive(e) {
  if (!e || !isValidEntity(e)) return false;
  if (rt.dying.has(e.id)) return false;
  return healthOf(e) > 0;
}

/**
 * @param {Entity} e
 * @param {string} tag
 * @returns {boolean}
 */
export function hasTag(e, tag) {
  try {
    return e.hasTag(tag);
  } catch {
    return false;
  }
}

/**
 * Loaded entities matching `query` in all three dimensions.
 * @param {import("@minecraft/server").EntityQueryOptions} query
 * @returns {Entity[]}
 */
export function queryAll(query) {
  /** @type {Entity[]} */
  const out = [];
  for (const dim of allDimensions()) {
    try {
      for (const e of dim.getEntities(query)) out.push(e);
    } catch {
      // a dimension that cannot be queried contributes nothing
    }
  }
  return out;
}

/** Loaded horde entities, including dying ones. @returns {Entity[]} */
export function loadedHorde() {
  return queryAll({ families: [FAMILIES.HORDE] });
}

/** Number of loaded, not-dying horde entities. @returns {number} */
export function loadedHordeCount() {
  let n = 0;
  for (const e of loadedHorde()) if (!rt.dying.has(e.id)) n++;
  return n;
}

/** Queued offspring spawns that are not in the world yet. @returns {number} */
export function pendingSpawns() {
  return rt.spawnQueue.length;
}

/**
 * SPEC §7 population: loaded horde in all dimensions + pending spawns.
 * @returns {number}
 */
export function hordeCount() {
  return loadedHordeCount() + pendingSpawns();
}

/** Loaded, living parasites (replication snapshot). @returns {Entity[]} */
export function listParasites() {
  return queryAll({ type: ENTITIES.PARASITE }).filter((e) => !rt.dying.has(e.id));
}

/**
 * Tracks free population slots across several spawns in one tick without
 * re-querying the world each time. Create a fresh one per tick/batch.
 */
export class HordeBudget {
  constructor() {
    /** @type {number | undefined} */
    this.count = undefined;
    this.cap = getConfig().populationCap;
  }
  /** @returns {number} */
  current() {
    if (this.count === undefined) this.count = hordeCount();
    return this.count;
  }
  /** @returns {boolean} whether one more horde entity fits under the cap */
  hasRoom() {
    return this.current() < this.cap;
  }
  /** A horde entity was added. */
  take() {
    this.count = this.current() + 1;
  }
  /** A pending spawn was dropped / a horde entity removed. */
  release() {
    this.count = Math.max(0, this.current() - 1);
  }
}

/**
 * @typedef {object} HordeStatus
 * @property {number} parasites
 * @property {number} infected infected creatures (incl. infected humans)
 * @property {number} incubating incubating mobs and players
 * @property {number} infectedPlayers stage-2 players
 * @property {number} pending queued offspring
 * @property {number} total hordeCount()
 * @property {number} held conversions waiting for a free slot
 */

/** Counts for the status UI/HUD. @returns {HordeStatus} */
export function hordeStatus() {
  let parasites = 0;
  let infected = 0;
  for (const e of loadedHorde()) {
    if (rt.dying.has(e.id)) continue;
    if (e.typeId === ENTITIES.PARASITE) parasites++;
    else infected++;
  }
  const incubating = queryAll({ tags: [TAGS.INCUBATING] }).length;
  const infectedPlayers = queryAll({ tags: [TAGS.INFECTED_PLAYER] }).length;
  const pending = pendingSpawns();
  return { parasites, infected, incubating, infectedPlayers, pending, total: parasites + infected + pending, held: rt.held.size };
}
