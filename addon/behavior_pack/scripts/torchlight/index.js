// @ts-check
// Tactical Torchlight (SPEC §5).
//
// * Toggle: using pas:tactical_torchlight / pas:tactical_torchlight_on (in the air or on a
//   block) swaps the stack in the same hand to the other variant (nameTag, lore and other
//   item data kept), plays pas.torch.on/off and shows "Torchlight ON/OFF".
// * Real light: every 2 ticks, for each living player holding the lit torch in either hand,
//   a ray from the eyes along the view direction (24 blocks) yields up to three invisible
//   light blocks (spot 15 / mid 13 / near 11) - see beam.js. Ownership, placement and
//   crash-safe cleanup live in lights.js.
// * Cleanup: switching item / turning off, death, leaving (before + after event), dimension
//   change (event + per-update check), offline sweep, and stored cells at startup.

import { world, system, ItemStack } from "@minecraft/server";
import { ITEMS, SOUNDS } from "../lib/ids.js";
import { registerItemHandler } from "../lib/items.js";
import {
  safe,
  logError,
  findHeld,
  getHand,
  setHeld,
  actionbar,
  playSound,
  normalize,
  len,
  blockKey,
} from "../lib/util.js";
import { castBeam, rawAnchors, resolveAnchors, anchorSignature } from "./beam.js";
import {
  makeReader,
  isFreeCell,
  syncPlayerCells,
  releasePlayerCells,
  cellsOf,
  playersWithCells,
  startupCleanup,
  processPending,
  pendingCount,
  serializeCells,
  lightStats,
  __lightsInternals,
} from "./lights.js";
import { UPDATE_INTERVAL_TICKS, MAINTENANCE_INTERVAL_TICKS, REFRESH_TICKS } from "./constants.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("../lib/util.js").Hand} Hand */

/**
 * Per-player beam state (only for players currently lighting).
 * @typedef {object} BeamState
 * @property {string} dimId dimension the player's cells are in
 * @property {string} sig raw anchor signature of the last full update
 * @property {number} lastFull tick of the last full update
 */

/** @type {Map<string, BeamState>} */
const beams = new Map();
/** Players that died and have not respawned yet. @type {Set<string>} */
const deadPlayers = new Set();
/** Recent releases (diagnostics/tests), newest last, capped. */
/** @type {{tick: number, playerId: string, reason: string, cells: number}[]} */
const releaseLog = [];
const RELEASE_LOG_MAX = 32;

/** Runtime switches (tests). */
const options = { sweepOffline: true };

let initialized = false;

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

/**
 * Copy of `old` as item `newId`, keeping nameTag, lore, keepOnDeath, lockMode,
 * can-destroy/can-place-on lists and item dynamic properties.
 * @param {ItemStack} old
 * @param {string} newId
 * @returns {ItemStack}
 */
export function convertStack(old, newId) {
  const s = new ItemStack(newId, 1);
  /**
   * @param {() => void} fn
   * @param {string} what
   */
  const copy = (fn, what) => {
    try {
      fn();
    } catch (e) {
      logError(`torch.copy(${what})`, e);
    }
  };
  copy(() => {
    if (old.nameTag) s.nameTag = old.nameTag;
  }, "nameTag");
  copy(() => {
    const lore = old.getLore();
    if (lore.length > 0) s.setLore(lore);
  }, "lore");
  copy(() => {
    if (old.keepOnDeath) s.keepOnDeath = true;
  }, "keepOnDeath");
  copy(() => {
    if (old.lockMode !== s.lockMode) s.lockMode = old.lockMode;
  }, "lockMode");
  copy(() => {
    const d = old.getCanDestroy();
    if (d.length > 0) s.setCanDestroy(d);
    const p = old.getCanPlaceOn();
    if (p.length > 0) s.setCanPlaceOn(p);
  }, "canDestroy/canPlaceOn");
  copy(() => {
    for (const id of old.getDynamicPropertyIds()) s.setDynamicProperty(id, old.getDynamicProperty(id));
  }, "dynamicProperties");
  return s;
}

/**
 * Hand holding the torch that was used: the hand holding the used item type, else any torch.
 * @param {Player} player
 * @param {string | undefined} usedId
 * @returns {{stack: ItemStack, hand: Hand} | undefined}
 */
function torchHand(player, usedId) {
  if (usedId) {
    for (const hand of /** @type {Hand[]} */ (["Mainhand", "Offhand"])) {
      const s = getHand(player, hand);
      if (s && s.typeId === usedId) return { stack: s, hand };
    }
  }
  return findHeld(player, [ITEMS.TORCH_OFF, ITEMS.TORCH_ON]);
}

/**
 * Switch the torch the player used on or off.
 * @param {Player} player
 * @param {ItemStack | undefined} used stack from the use event
 * @returns {boolean | undefined} the new state (true = on), undefined if nothing was toggled
 */
export function toggleTorch(player, used) {
  const held = torchHand(player, used?.typeId);
  if (!held) return undefined;
  const turnOn = held.stack.typeId === ITEMS.TORCH_OFF;
  const next = convertStack(held.stack, turnOn ? ITEMS.TORCH_ON : ITEMS.TORCH_OFF);
  if (!setHeld(player, held.hand, next)) return undefined;
  try {
    playSound(player.dimension, turnOn ? SOUNDS.TORCH_ON : SOUNDS.TORCH_OFF, player.getHeadLocation());
  } catch (e) {
    logError("torch.sound", e);
  }
  actionbar(player, turnOn ? "Torchlight ON" : "Torchlight OFF");
  try {
    // immediate feedback instead of waiting for the next update
    if (turnOn) updatePlayer(player, true);
    else if (!findHeld(player, ITEMS.TORCH_ON)) release(player.id, "turned-off");
  } catch (e) {
    logError("torch.toggleUpdate", e);
  }
  return turnOn;
}

// ---------------------------------------------------------------------------
// Light updates
// ---------------------------------------------------------------------------

/**
 * Release all of a player's light cells.
 * @param {string} playerId
 * @param {string} reason
 * @param {string} [onlyDimId] release only cells in this dimension
 */
function release(playerId, reason, onlyDimId) {
  const had = isTracked(playerId);
  beams.delete(playerId);
  const n = releasePlayerCells(playerId, onlyDimId);
  if (!had) return;
  releaseLog.push({ tick: system.currentTick, playerId, reason, cells: n });
  if (releaseLog.length > RELEASE_LOG_MAX) releaseLog.splice(0, releaseLog.length - RELEASE_LOG_MAX);
}

/** @param {string} playerId @returns {boolean} */
function isTracked(playerId) {
  return beams.has(playerId) || cellsOf(playerId).size > 0;
}

/**
 * Update one player's light. Does nothing (beyond reading the two hand slots) for players
 * who do not hold the lit torch; releases their cells if they had any.
 * @param {Player} player
 * @param {boolean} [force] skip the "anchors unchanged" shortcut
 */
export function updatePlayer(player, force = false) {
  const id = player.id;
  const dead = deadPlayers.has(id);
  if (dead || !findHeld(player, ITEMS.TORCH_ON)) {
    if (isTracked(id)) release(id, dead ? "dead" : "not-held");
    return;
  }
  const dim = player.dimension;
  const dimId = dim.id;
  let bs = beams.get(id);
  if (bs && bs.dimId !== dimId) {
    release(id, "dimension-mismatch");
    bs = undefined;
  }
  const head = player.getHeadLocation();
  const dir = normalize(player.getViewDirection());
  if (len(dir) < 0.5 || ![head.x, head.y, head.z].every(Number.isFinite)) return;
  const beam = castBeam(dim, head, dir);
  const raw = rawAnchors(head, dir, beam);
  const sig = anchorSignature(dimId, raw);
  const now = system.currentTick;
  if (!force && bs && bs.sig === sig && now - bs.lastFull < REFRESH_TICKS) return;
  const read = makeReader(dim);
  const desired = resolveAnchors(
    head,
    dir,
    raw,
    (c) => isFreeCell(dimId, c, read),
    (c) => blockKey(dimId, c),
  );
  syncPlayerCells(id, dim, desired, read);
  beams.set(id, { dimId, sig, lastFull: now });
}

/** Interval body: update every online player (errors are contained per player). */
function updateAll() {
  for (const player of world.getAllPlayers()) {
    try {
      updatePlayer(player);
    } catch (e) {
      logError("torch.updatePlayer", e);
    }
  }
}

/** Maintenance: retry pending cleanups and release players that are gone. */
function maintenance() {
  processPending();
  if (!options.sweepOffline) return;
  const tracked = new Set([...beams.keys(), ...playersWithCells()]);
  if (tracked.size === 0) return;
  const online = new Set(world.getAllPlayers().map((p) => p.id));
  for (const id of tracked) if (!online.has(id)) release(id, "offline");
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/** Subscribe the torchlight subsystem's events (idempotent). */
export function initTorchlight() {
  if (initialized) return;
  initialized = true;

  registerItemHandler([ITEMS.TORCH_OFF, ITEMS.TORCH_ON], {
    onUse: (player, stack) => {
      toggleTorch(player, stack);
    },
    onUseOn: (player, _block, _face, stack) => {
      toggleTorch(player, stack);
    },
  });

  system.runInterval(safe(updateAll, "torch.update"), UPDATE_INTERVAL_TICKS);
  system.runInterval(safe(maintenance, "torch.maintenance"), MAINTENANCE_INTERVAL_TICKS);
  // Startup cleanup of cells recorded by a previous session (crash / reload). Deferred to the
  // first tick: world data and chunks are available there, and it runs before the first update.
  system.run(safe(startupCleanup, "torch.startup"));

  world.afterEvents.entityDie.subscribe(
    safe((ev) => {
      const id = ev.deadEntity.id;
      deadPlayers.add(id);
      release(id, "death");
    }, "torch.entityDie"),
    { entityTypes: ["minecraft:player"] },
  );
  world.afterEvents.playerSpawn.subscribe(
    safe((ev) => {
      deadPlayers.delete(ev.player.id);
    }, "torch.playerSpawn"),
  );
  // Before-event: read-only, so only capture the id and defer the world edits.
  world.beforeEvents.playerLeave.subscribe(
    safe((ev) => {
      const id = ev.player.id;
      system.run(
        safe(() => {
          deadPlayers.delete(id);
          release(id, "leave-before");
        }, "torch.playerLeave.deferred"),
      );
    }, "torch.beforePlayerLeave"),
  );
  world.afterEvents.playerLeave.subscribe(
    safe((ev) => {
      deadPlayers.delete(ev.playerId);
      release(ev.playerId, "leave-after");
    }, "torch.playerLeave"),
  );
  world.afterEvents.playerDimensionChange.subscribe(
    safe((ev) => {
      release(ev.player.id, "dimension-change", ev.fromDimension.id);
    }, "torch.dimensionChange"),
  );
}

/** Test/diagnostic access to internal state. */
export const __torchInternals = Object.freeze({
  beams,
  deadPlayers,
  releaseLog,
  options,
  lightStats,
  lights: __lightsInternals,
  updateAll,
  maintenance,
  cellsOf,
  serializeCells,
  pendingCount,
  /** Forget all in-memory state (does not touch the world). */
  reset() {
    beams.clear();
    deadPlayers.clear();
    releaseLog.length = 0;
    options.sweepOffline = true;
    __lightsInternals.reset();
  },
});
