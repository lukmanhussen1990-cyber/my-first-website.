import { ItemStack, system } from "@minecraft/server";
import { ITEMS } from "../data/abilities.js";
import { getState, flash } from "./state.js";
import { logError, secondsText } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./state.js").PlayerState} PlayerState */

/**
 * How a technique was triggered. On touch screens a tap on air is "use",
 * a tap on a block is "useOn" and a tap on a mob is "hit" - every technique
 * accepts all three so it always fires on mobile.
 * @typedef {{
 *   trigger: "use" | "useOn" | "hit" | "menu",
 *   target?: import("@minecraft/server").Entity,
 *   block?: import("@minecraft/server").Block,
 * }} CastContext
 */

/** @typedef {(player: Player, st: PlayerState, ctx: CastContext) => boolean | void} CastHandler */

/** @type {Map<string, CastHandler>} */
const handlers = new Map();

/**
 * @param {string} key ability key from data/abilities.js
 * @param {CastHandler} handler returns false if nothing was cast (no cooldown)
 */
export function registerAbility(key, handler) {
  handlers.set(key, handler);
}

/** @param {PlayerState} st @param {string} key */
export function cooldownLeft(st, key) {
  const until = st.cooldownUntil.get(key);
  return until === undefined ? 0 : Math.max(0, until - system.currentTick);
}

/**
 * Start both the script cooldown and the hotbar cooldown sweep overlay.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {string} key
 */
export function startCooldown(player, st, key) {
  const def = ITEMS[key];
  if (!def || !def.cooldown) return;
  st.cooldownUntil.set(key, system.currentTick + Math.round(def.cooldown * 20));
  try {
    const cd = /** @type {import("@minecraft/server").ItemCooldownComponent | undefined} */ (
      new ItemStack(def.id, 1).getComponent("minecraft:cooldown")
    );
    cd?.startCooldown(player);
  } catch (e) {
    logError("cooldown.visual", e);
  }
}

/**
 * Try to cast a technique. Handles debounce (a single tap can fire both the
 * "use" and "useOn" events), cooldowns and the busy (channelling) state.
 * @param {Player} player
 * @param {string} key
 * @param {CastContext} ctx
 * @returns {boolean} true if the technique fired
 */
export function tryCast(player, key, ctx) {
  const handler = handlers.get(key);
  const def = ITEMS[key];
  if (!handler || !def) return false;
  const st = getState(player);
  const now = system.currentTick;
  const debounce = def.kind === "toggle" || def.kind === "transformation" ? 8 : 4;
  const last = st.lastAttempt.get(key);
  if (last !== undefined && now - last < debounce) return false;
  st.lastAttempt.set(key, now);

  const left = cooldownLeft(st, key);
  if (left > 0) {
    deny(player, st, key, `${def.color}${def.short} §8» §cRecharging ${secondsText(left)}`);
    return false;
  }
  if (st.busy && def.kind === "ability") {
    deny(player, st, key, `§7Channelling §f${st.busy}§7...`);
    return false;
  }
  let fired = false;
  try {
    fired = handler(player, st, ctx) !== false;
  } catch (e) {
    logError(`cast:${key}`, e);
    fired = false;
  }
  if (fired) startCooldown(player, st, key);
  return fired;
}

/**
 * @param {Player} player
 * @param {PlayerState} st
 * @param {string} key
 * @param {string} text
 */
function deny(player, st, key, text) {
  const now = system.currentTick;
  const last = st.lastDenied.get(key);
  if (last !== undefined && now - last < 10) return;
  st.lastDenied.set(key, now);
  flash(st, text, 30);
  try {
    player.playSound("gojo.ui.denied", { volume: 0.6, pitch: 1 });
  } catch {
    // ignore
  }
}
