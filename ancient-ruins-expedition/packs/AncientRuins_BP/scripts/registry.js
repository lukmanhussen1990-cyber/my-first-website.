import { world } from "@minecraft/server";
import { TUNING } from "./config.js";
import { warn } from "./util.js";

/**
 * A charted ruin. Short keys keep the saved JSON small.
 * @typedef {object} Ruin
 * @property {number} id
 * @property {string} t   ruin type (jungle_temple | desert_crypt | sunken_ship)
 * @property {string} d   dimension id
 * @property {number} x   vault hatch centre (precise) or approximate position
 * @property {number} y
 * @property {number} z
 * @property {number} pr  1 = exact position from the ruin core, 0 = approximate
 * @property {number} p   1 = guardians already awakened
 * @property {number} a   1 = boss awakened
 * @property {number} c   1 = boss defeated (conquered)
 * @property {number} v   1 = vault opened
 * @property {string} b   boss entity id ("" if none)
 */

const SHARD_KEY = "ancient_ruins:ruins_";
const COUNT_KEY = "ancient_ruins:ruin_shards";
const PER_SHARD = 80; // ~80 * 110 chars stays far below the 32k string limit
const MAX_RUINS = 800;

/** @type {Ruin[]} */
let ruins = [];
let nextId = 1;
let dirty = false;
let loaded = false;

export function loadRegistry() {
  ruins = [];
  try {
    const shards = Number(world.getDynamicProperty(COUNT_KEY) ?? 0);
    for (let i = 0; i < shards; i++) {
      const raw = world.getDynamicProperty(SHARD_KEY + i);
      if (typeof raw !== "string") continue;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) ruins.push(...list);
    }
  } catch (e) {
    warn("loadRegistry", e);
  }
  nextId = ruins.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  loaded = true;
}

export function saveRegistry(force = false) {
  if (!loaded || (!dirty && !force)) return;
  try {
    const oldShards = Number(world.getDynamicProperty(COUNT_KEY) ?? 0);
    let shard = 0;
    for (let i = 0; i < ruins.length; i += PER_SHARD, shard++) {
      world.setDynamicProperty(SHARD_KEY + shard, JSON.stringify(ruins.slice(i, i + PER_SHARD)));
    }
    for (let i = shard; i < oldShards; i++) world.setDynamicProperty(SHARD_KEY + i, undefined);
    world.setDynamicProperty(COUNT_KEY, shard);
    dirty = false;
  } catch (e) {
    warn("saveRegistry", e);
  }
}

function ensureLoaded() {
  if (!loaded) loadRegistry();
}

export function markDirty() {
  dirty = true;
}

export function isLoaded() {
  return loaded;
}

/** @returns {Ruin[]} */
export function allRuins() {
  ensureLoaded();
  return ruins;
}

/** @param {number} id */
export function getRuin(id) {
  ensureLoaded();
  return ruins.find((r) => r.id === id);
}

/** @param {string} bossId */
export function ruinByBoss(bossId) {
  ensureLoaded();
  return ruins.find((r) => r.b === bossId);
}

/**
 * Nearest ruin (horizontal distance) matching a filter.
 * @param {string} dimId
 * @param {import("@minecraft/server").Vector3} loc
 * @param {(r: Ruin) => boolean} [filter]
 * @param {number} [maxDist]
 */
export function nearestRuin(dimId, loc, filter, maxDist = Infinity) {
  ensureLoaded();
  let best;
  let bestD = maxDist;
  for (const r of ruins) {
    if (r.d !== dimId || (filter && !filter(r))) continue;
    const d = Math.hypot(r.x - loc.x, r.z - loc.z);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/**
 * Add a ruin or merge with an existing one of the same type nearby.
 * @param {string} type
 * @param {string} dimId
 * @param {import("@minecraft/server").Vector3} loc
 * @param {boolean} precise
 * @returns {{ ruin: Ruin, isNew: boolean }}
 */
export function registerRuin(type, dimId, loc, precise) {
  ensureLoaded();
  const x = Math.floor(loc.x);
  const y = Math.floor(loc.y);
  const z = Math.floor(loc.z);
  const existing = nearestRuin(dimId, { x, y, z }, (r) => r.t === type, TUNING.dedupeRadius);
  if (existing) {
    if (precise && !existing.pr) {
      existing.x = x;
      existing.y = y;
      existing.z = z;
      existing.pr = 1;
      dirty = true;
    }
    return { ruin: existing, isNew: false };
  }
  if (ruins.length >= MAX_RUINS) {
    // Forget the oldest fully looted ruin to stay within storage limits.
    const idx = ruins.findIndex((r) => r.c && r.v);
    ruins.splice(idx >= 0 ? idx : 0, 1);
  }
  /** @type {Ruin} */
  const ruin = { id: nextId++, t: type, d: dimId, x, y, z, pr: precise ? 1 : 0, p: 0, a: 0, c: 0, v: 0, b: "" };
  ruins.push(ruin);
  dirty = true;
  return { ruin, isNew: true };
}

export function clearRegistry() {
  ruins = [];
  nextId = 1;
  dirty = true;
  saveRegistry(true);
}
