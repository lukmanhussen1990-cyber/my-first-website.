// @ts-check
// Light-block ownership, placement, removal and crash-safe persistence (SPEC §5).
//
// * `cells`: global map cellKey -> OwnedCell { owners: Map<playerId, wanted level> }.
//   The set of owners is `owners.keys()`; the block shows the highest wanted level.
// * `playerCells`: per-player map cellKey -> level.
// * `pending`: cells that must be cleared but sit in unloaded chunks (startup leftovers or
//   releases while the chunk is unloaded). Retried every maintenance pass.
// * Every owned and pending cell is persisted under PROPS.TORCH_CELLS as
//   [[dimId, x, y, z], ...] so a crash or reload never leaves light blocks behind.
//
// Invariants: only `minecraft:air` is ever replaced by a light block; a cell is turned back
// to air only when its last owner released it AND it still holds a light block.

import { BlockPermutation } from "@minecraft/server";
import { PROPS } from "../lib/ids.js";
import { safeGetBlock, getDimension, blockKey, logError } from "../lib/util.js";
import { loadJSON, scheduleSave } from "../lib/store.js";
import {
  AIR,
  LIGHT_BLOCK,
  LIGHT_LEVEL_STATE,
  PENDING_PER_PASS,
  MAX_STORED_CELLS,
  isLightBlockId,
} from "./constants.js";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("./beam.js").Anchor} Anchor */

/**
 * What a cell currently holds.
 * @typedef {{kind: "air", block: Block} | {kind: "light", level: number, block: Block} | {kind: "other", typeId: string}} CellState
 */

/**
 * @typedef {object} OwnedCell
 * @property {string} dimId
 * @property {Vector3} loc
 * @property {Map<string, number>} owners playerId -> wanted level
 * @property {number} level level the block was last set to
 */

/** @type {Map<string, OwnedCell>} */
const cells = new Map();
/** @type {Map<string, Map<string, number>>} */
const playerCells = new Map();
/** @type {Map<string, {dimId: string, loc: Vector3}>} */
const pending = new Map();

/** Persisting is held back until the stored list was read at startup (never overwrite it unread). */
let storedLoaded = false;
let persistRequested = false;

/** Counters for diagnostics and tests. */
export const lightStats = { placed: 0, removed: 0, relevelled: 0, pendingCleared: 0 };

// ---------------------------------------------------------------------------
// Permutations
// ---------------------------------------------------------------------------

/** level -> permutation (null = could not be resolved). */
/** @type {Map<number, BlockPermutation | null>} */
const permCache = new Map();
/** Which form works in this build; decided by the first successful resolve. */
/** @type {"state" | "id" | undefined} */
let permMode;
/** @type {BlockPermutation | undefined} */
let airPerm;

/**
 * Light block permutation for a level 0-15:
 * BlockPermutation.resolve("minecraft:light_block", {block_light_level: N}) (1.21.0.26),
 * falling back to "minecraft:light_block_<N>" (split ids of newer builds). Cached.
 * @param {number} level
 * @returns {BlockPermutation | undefined}
 */
export function lightPermutation(level) {
  const n = Math.max(0, Math.min(15, Math.round(level)));
  const cached = permCache.get(n);
  if (cached !== undefined) return cached ?? undefined;
  /** @type {BlockPermutation | undefined} */
  let perm;
  const tryState = () => BlockPermutation.resolve(LIGHT_BLOCK, { [LIGHT_LEVEL_STATE]: n });
  const tryId = () => BlockPermutation.resolve(`${LIGHT_BLOCK}_${n}`);
  for (const [mode, fn] of /** @type {const} */ ([
    ["state", tryState],
    ["id", tryId],
  ])) {
    if (permMode !== undefined && permMode !== mode) continue;
    try {
      perm = fn();
      permMode = mode;
      break;
    } catch {
      // try the other form
    }
  }
  if (!perm && permMode !== undefined) {
    // the cached mode failed for this level: try the other one once
    try {
      perm = permMode === "state" ? tryId() : tryState();
    } catch {
      perm = undefined;
    }
  }
  if (!perm) logError("torch.lightPermutation", new Error(`no light block permutation for level ${n}`));
  permCache.set(n, perm ?? null);
  return perm;
}

/** @returns {BlockPermutation | undefined} */
function airPermutation() {
  if (!airPerm) {
    try {
      airPerm = BlockPermutation.resolve(AIR);
    } catch (e) {
      logError("torch.airPermutation", e);
    }
  }
  return airPerm;
}

/**
 * Light level shown by a light block (state or `_N` suffix).
 * @param {Block} block
 * @param {string} typeId
 * @returns {number}
 */
function lightLevelOf(block, typeId) {
  if (typeId !== LIGHT_BLOCK) {
    const m = /_(\d+)$/.exec(typeId);
    return m ? Number(m[1]) : -1;
  }
  try {
    const v = block.permutation.getState(LIGHT_LEVEL_STATE);
    return typeof v === "number" ? v : -1;
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Reading and writing cells
// ---------------------------------------------------------------------------

/**
 * What the cell holds; undefined when it is unavailable (unloaded chunk, outside the height
 * range, invalid). Handles both getBlock behaviours (undefined / LocationInUnloadedChunkError).
 * @param {Dimension} dim
 * @param {Vector3} loc
 * @returns {CellState | undefined}
 */
export function readCell(dim, loc) {
  const block = safeGetBlock(dim, loc);
  if (!block) return undefined;
  try {
    const typeId = block.typeId;
    if (typeId === AIR) return { kind: "air", block };
    if (isLightBlockId(typeId)) return { kind: "light", level: lightLevelOf(block, typeId), block };
    return { kind: "other", typeId };
  } catch {
    return undefined;
  }
}

/**
 * A per-update reader that reads each cell at most once.
 * @param {Dimension} dim
 * @returns {(loc: Vector3) => CellState | undefined}
 */
export function makeReader(dim) {
  /** @type {Map<string, CellState | null>} */
  const cache = new Map();
  return (loc) => {
    const k = `${loc.x},${loc.y},${loc.z}`;
    let s = cache.get(k);
    if (s === undefined) {
      s = readCell(dim, loc) ?? null;
      cache.set(k, s);
    }
    return s ?? undefined;
  };
}

/**
 * A cell may hold an anchor if it is exactly air, or one of OUR light blocks (shared or
 * re-levelled). Foreign light blocks and everything else are never touched.
 * @param {string} dimId
 * @param {Vector3} loc
 * @param {(loc: Vector3) => CellState | undefined} read
 * @returns {boolean}
 */
export function isFreeCell(dimId, loc, read) {
  const s = read(loc);
  if (!s) return false;
  if (s.kind === "air") return true;
  return s.kind === "light" && cells.has(blockKey(dimId, loc));
}

/**
 * @param {Block} block
 * @param {number} level
 * @returns {boolean}
 */
function writeLight(block, level) {
  const perm = lightPermutation(level);
  if (!perm) return false;
  try {
    block.setPermutation(perm);
    return true;
  } catch (e) {
    logError("torch.placeLight", e);
    return false;
  }
}

/**
 * @param {Block} block
 * @returns {boolean}
 */
function writeAir(block) {
  const perm = airPermutation();
  try {
    if (perm) block.setPermutation(perm);
    else block.setType(AIR);
    return true;
  } catch (e) {
    logError("torch.removeLight", e);
    return false;
  }
}

/** @param {OwnedCell} oc @returns {number} */
function wantedLevel(oc) {
  let m = 0;
  for (const l of oc.owners.values()) if (l > m) m = l;
  return m;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/**
 * Make `playerId` own exactly the `desired` cells in `dim`: place/re-level the new ones
 * first, then release the stale ones (no flicker). Returns the number of block writes.
 * @param {string} playerId
 * @param {Dimension} dim
 * @param {Map<string, Anchor>} desired cell key (blockKey) -> anchor
 * @param {(loc: Vector3) => CellState | undefined} read per-update reader (same dimension)
 * @returns {number}
 */
export function syncPlayerCells(playerId, dim, desired, read) {
  const dimId = dim.id;
  let mine = playerCells.get(playerId);
  if (!mine) {
    mine = new Map();
    playerCells.set(playerId, mine);
  }
  let writes = 0;
  let changed = false;
  for (const [key, a] of desired) {
    const st = read(a.cell);
    if (!st) continue;
    const oc = cells.get(key);
    if (oc) {
      if (st.kind === "other") {
        // somebody replaced our light block: nobody owns anything there any more
        oc.owners.delete(playerId);
        if (oc.owners.size === 0) cells.delete(key);
        mine.delete(key);
        changed = true;
        continue;
      }
      oc.owners.set(playerId, a.level);
      const want = wantedLevel(oc);
      if (st.kind === "air" || st.level !== want) {
        // re-level (only while it is still a light block) or restore a vanished light (air)
        if (writeLight(st.block, want)) {
          writes++;
          if (st.kind === "air") lightStats.placed++;
          else lightStats.relevelled++;
        }
      }
      oc.level = want;
      mine.set(key, a.level);
      continue;
    }
    if (st.kind !== "air") continue; // never replace anything but air
    if (!writeLight(st.block, a.level)) continue;
    writes++;
    lightStats.placed++;
    cells.set(key, { dimId, loc: { ...a.cell }, owners: new Map([[playerId, a.level]]), level: a.level });
    mine.set(key, a.level);
    changed = true;
  }
  for (const key of [...mine.keys()]) {
    if (desired.has(key)) continue;
    mine.delete(key);
    writes += releaseCell(key, playerId);
    changed = true;
  }
  if (mine.size === 0) playerCells.delete(playerId);
  if (changed) persist();
  return writes;
}

/**
 * Drop `playerId`'s claim on one cell. The block goes back to air only if nobody else owns it
 * and it is still a light block; if its chunk is unloaded it is queued as pending.
 * @param {string} key
 * @param {string} playerId
 * @returns {number} block writes
 */
function releaseCell(key, playerId) {
  const oc = cells.get(key);
  if (!oc) return 0;
  oc.owners.delete(playerId);
  const dim = getDimension(oc.dimId);
  if (oc.owners.size > 0) {
    const want = wantedLevel(oc);
    if (want === oc.level || !dim) return 0;
    const st = readCell(dim, oc.loc);
    if (st && st.kind === "light" && writeLight(st.block, want)) {
      oc.level = want;
      lightStats.relevelled++;
      return 1;
    }
    return 0;
  }
  cells.delete(key);
  if (!dim) return 0;
  const st = readCell(dim, oc.loc);
  if (!st) {
    pending.set(key, { dimId: oc.dimId, loc: oc.loc });
    return 0;
  }
  if (st.kind !== "light") return 0; // replaced by a player (e.g. stone): leave it alone
  if (writeAir(st.block)) {
    lightStats.removed++;
    return 1;
  }
  pending.set(key, { dimId: oc.dimId, loc: oc.loc });
  return 0;
}

/**
 * Release every cell of a player (optionally only those in one dimension).
 * @param {string} playerId
 * @param {string} [onlyDimId]
 * @returns {number} number of cells released
 */
export function releasePlayerCells(playerId, onlyDimId) {
  const mine = playerCells.get(playerId);
  if (!mine) return 0;
  let n = 0;
  for (const key of [...mine.keys()]) {
    const oc = cells.get(key);
    if (onlyDimId !== undefined && oc && oc.dimId !== onlyDimId) continue;
    mine.delete(key);
    try {
      releaseCell(key, playerId);
    } catch (e) {
      logError("torch.releaseCell", e);
    }
    n++;
  }
  if (mine.size === 0) playerCells.delete(playerId);
  if (n > 0) persist();
  return n;
}

/**
 * @param {string} playerId
 * @returns {Map<string, number>} cell key -> level (copy)
 */
export function cellsOf(playerId) {
  return new Map(playerCells.get(playerId) ?? []);
}

/**
 * @param {string} playerId
 * @returns {boolean} whether the player owns any cell (no allocation)
 */
export function hasCells(playerId) {
  return playerCells.has(playerId);
}

/** @returns {string[]} ids of players that own cells */
export function playersWithCells() {
  return [...playerCells.keys()];
}

// ---------------------------------------------------------------------------
// Persistence, startup and pending cleanup
// ---------------------------------------------------------------------------

/** @returns {[string, number, number, number][]} every owned and pending cell */
export function serializeCells() {
  /** @type {[string, number, number, number][]} */
  const out = [];
  for (const oc of cells.values()) out.push([oc.dimId, oc.loc.x, oc.loc.y, oc.loc.z]);
  for (const [key, p] of pending) if (!cells.has(key)) out.push([p.dimId, p.loc.x, p.loc.y, p.loc.z]);
  return out;
}

/** Schedule a (throttled) save of the cell list. */
export function persist() {
  if (!storedLoaded) {
    persistRequested = true;
    return;
  }
  scheduleSave(PROPS.TORCH_CELLS, serializeCells);
}

/**
 * Validate one stored entry.
 * @param {unknown} e
 * @returns {{dimId: string, loc: Vector3} | undefined}
 */
function parseEntry(e) {
  if (!Array.isArray(e) || e.length !== 4) return undefined;
  const [dimId, x, y, z] = e;
  if (typeof dimId !== "string" || ![x, y, z].every((v) => Number.isInteger(v))) return undefined;
  const dim = getDimension(dimId);
  if (!dim) return undefined;
  try {
    const r = dim.heightRange;
    if (y < r.min || y >= r.max) return undefined;
  } catch {
    // keep it; reading the block will tell
  }
  return { dimId: dim.id, loc: { x, y, z } };
}

/**
 * Startup: every cell recorded by a previous session (crash, reload) is queued for cleanup
 * and the loaded ones are cleared right away. Returns the number of recorded cells.
 * @returns {number}
 */
export function startupCleanup() {
  /** @type {unknown} */
  const stored = loadJSON(PROPS.TORCH_CELLS, []);
  storedLoaded = true;
  let n = 0;
  if (Array.isArray(stored)) {
    for (const e of stored.slice(0, MAX_STORED_CELLS)) {
      const p = parseEntry(e);
      if (!p) continue;
      const key = blockKey(p.dimId, p.loc);
      if (cells.has(key)) continue; // already re-owned in this session (it was air when taken)
      pending.set(key, p);
      n++;
    }
  }
  processPending(MAX_STORED_CELLS);
  persistRequested = false;
  persist(); // rewrite the list: whatever is still pending (unloaded) stays recorded
  return n;
}

/**
 * Try to clear pending cells (bounded). A cell that is still a light block and not owned by
 * anybody now becomes air; unloaded cells stay pending (and persisted).
 * @param {number} [max]
 * @returns {number} cells resolved (cleared or dropped)
 */
export function processPending(max = PENDING_PER_PASS) {
  if (pending.size === 0) return 0;
  let tried = 0;
  let resolved = 0;
  for (const [key, p] of [...pending]) {
    if (tried++ >= max) break;
    if (cells.has(key)) {
      // re-owned since: it was air when it was taken, so the old light is gone
      pending.delete(key);
      resolved++;
      continue;
    }
    const dim = getDimension(p.dimId);
    if (!dim) {
      pending.delete(key);
      resolved++;
      continue;
    }
    const st = readCell(dim, p.loc);
    if (!st) continue; // still unloaded: retry later
    if (st.kind === "light") {
      if (!writeAir(st.block)) continue;
      lightStats.pendingCleared++;
    }
    pending.delete(key);
    resolved++;
  }
  if (resolved > 0) persist();
  return resolved;
}

/** @returns {number} */
export function pendingCount() {
  return pending.size;
}

/** Test/diagnostic access. */
export const __lightsInternals = Object.freeze({
  cells,
  playerCells,
  pending,
  permCache,
  /** Forget all in-memory state (does not touch the world). */
  reset() {
    cells.clear();
    playerCells.clear();
    pending.clear();
    for (const k of Object.keys(lightStats)) lightStats[/** @type {keyof typeof lightStats} */ (k)] = 0;
  },
  /** Forget cached permutations (to exercise the resolve fallback). */
  resetPermCache() {
    permCache.clear();
    permMode = undefined;
    airPerm = undefined;
  },
  isStoredLoaded() {
    return storedLoaded;
  },
});
