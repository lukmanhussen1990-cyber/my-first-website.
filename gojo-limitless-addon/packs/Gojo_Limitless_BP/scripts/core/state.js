import { system } from "@minecraft/server";
import { logError } from "../lib/util.js";

const KEY_TRANSFORMED = "gojo:transformed";
const KEY_INFINITY = "gojo:infinity";
const KEY_SIX_EYES = "gojo:six_eyes";
const KEY_BLINDFOLD = "gojo:gave_blindfold";

/**
 * Runtime state for one player. Toggles are persisted with dynamic properties
 * so Infinity / Six Eyes / the transformation survive re-logging.
 */
export class PlayerState {
  /** @param {import("@minecraft/server").Player} player */
  constructor(player) {
    this.id = player.id;
    /** ability key -> tick when the ability is ready again */
    this.cooldownUntil = new Map();
    /** ability key -> tick of the last activation attempt (debounce) */
    this.lastAttempt = new Map();
    /** ability key -> tick of the last "still on cooldown" message */
    this.lastDenied = new Map();
    this.transformed = readBool(player, KEY_TRANSFORMED);
    this.infinity = readBool(player, KEY_INFINITY);
    this.sixEyes = readBool(player, KEY_SIX_EYES);
    this.gaveBlindfold = readBool(player, KEY_BLINDFOLD);
    /** Black Flash chain ("the Zone"). */
    this.flowStacks = 0;
    this.lastBlackFlashTick = -100000;
    /** Name of a channelled cast in progress (blocks other casts), or "". */
    this.busy = "";
    /** Tick the current busy cast started. */
    this.busySince = 0;
    /** Active domain handle (set by the domain ability). */
    /** @type {null | {center: import("@minecraft/server").Vector3, radius: number, endTick: number}} */
    this.domain = null;
    /** Transient HUD message. */
    this.message = "";
    this.messageUntil = 0;
    this.lastHudText = "";
    this.lastHudTick = -1000;
    /** Six Eyes focus (target analysis) text. */
    this.focusText = "";
    /** Effects applied by the buff manager: effect id -> amplifier */
    /** @type {Map<string, number>} */
    this.appliedEffects = new Map();
    /** Frozen projectiles held by Infinity: entity id -> data */
    /** @type {Map<string, {pos: import("@minecraft/server").Vector3, since: number}>} */
    this.frozen = new Map();
    this.lastRippleTick = 0;
    this.infinityBlocked = 0;
    /** Tick of a hit that Infinity should nullify (see abilities/infinity.js). */
    this.infinityPendingTick = -1;
  }
}

/** @type {Map<string, PlayerState>} */
const states = new Map();

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} key
 */
function readBool(player, key) {
  try {
    return player.getDynamicProperty(key) === true;
  } catch {
    return false;
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {PlayerState}
 */
export function getState(player) {
  let st = states.get(player.id);
  if (!st) {
    st = new PlayerState(player);
    states.set(player.id, st);
  }
  return st;
}

/** @param {string} playerId */
export function peekState(playerId) {
  return states.get(playerId);
}

/** @param {string} playerId */
export function dropState(playerId) {
  states.delete(playerId);
}

/** @returns {IterableIterator<PlayerState>} */
export function allStates() {
  return states.values();
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {PlayerState} st
 */
export function saveToggles(player, st) {
  try {
    player.setDynamicProperty(KEY_TRANSFORMED, st.transformed);
    player.setDynamicProperty(KEY_INFINITY, st.infinity);
    player.setDynamicProperty(KEY_SIX_EYES, st.sixEyes);
    player.setDynamicProperty(KEY_BLINDFOLD, st.gaveBlindfold);
  } catch (e) {
    logError("state.save", e);
  }
}

/**
 * Show a short message in this player's action bar HUD.
 * @param {PlayerState} st
 * @param {string} text
 * @param {number} [ticks]
 */
export function flash(st, text, ticks = 40) {
  st.message = text;
  st.messageUntil = system.currentTick + ticks;
  st.lastHudText = ""; // force a redraw on the next HUD pass
}
