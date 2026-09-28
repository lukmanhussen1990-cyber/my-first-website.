import { logError } from "../lib/util.js";

/** @typedef {import("./state.js").PlayerState} PlayerState */
/** @typedef {import("@minecraft/server").Player} Player */

/** Effects this addon manages on players. */
const MANAGED = ["speed", "strength", "resistance", "jump_boost", "haste", "night_vision"];

/** Longer than 10 s so night vision never flickers. */
const DURATION = 400;
const REFRESH_BELOW = 260;

/**
 * Desired effect amplifiers for the player's active states.
 * @param {PlayerState} st
 * @returns {Map<string, number>}
 */
function desired(st) {
  /** @type {Map<string, number>} */
  const want = new Map();
  const put = (/** @type {string} */ id, /** @type {number} */ amp) => {
    const cur = want.get(id);
    if (cur === undefined || amp > cur) want.set(id, amp);
  };
  if (st.transformed) {
    put("speed", 1);
    put("strength", 1);
    put("resistance", 0);
    put("jump_boost", 0);
    put("haste", 0);
  }
  if (st.infinity) put("resistance", 3); // 80% reduction; attacks are fully nullified by Infinity
  if (st.sixEyes) put("night_vision", 0);
  if (st.domain) {
    put("strength", 2);
    put("speed", 1);
    put("resistance", 1);
    put("night_vision", 0);
  }
  return want;
}

/**
 * Apply / refresh / remove managed effects. Never downgrades a stronger effect
 * from potions or beacons, and only removes effects that this addon applied.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {boolean} [force] refresh even if not about to expire
 */
export function refreshBuffs(player, st, force = false) {
  const want = desired(st);
  for (const id of MANAGED) {
    const amp = want.get(id);
    let current;
    try {
      current = player.getEffect(id);
    } catch {
      current = undefined;
    }
    if (amp === undefined) {
      const ours = st.appliedEffects.get(id);
      if (ours !== undefined) {
        st.appliedEffects.delete(id);
        try {
          if (current && current.amplifier === ours && current.duration <= DURATION) player.removeEffect(id);
        } catch (e) {
          logError("buffs.remove", e);
        }
      }
      continue;
    }
    // A stronger level that *we* applied (domain, Infinity) must drop back down
    // as soon as its source ends; stronger potions/beacons are left alone.
    const oursStronger = !!current && current.amplifier > amp && st.appliedEffects.get(id) === current.amplifier;
    const needs =
      !current ||
      oursStronger ||
      current.amplifier < amp ||
      (current.amplifier === amp && (force || current.duration < REFRESH_BELOW));
    if (!needs) continue;
    try {
      if (oursStronger) player.removeEffect(id);
      player.addEffect(id, DURATION, { amplifier: amp, showParticles: false });
      st.appliedEffects.set(id, amp);
    } catch (e) {
      logError("buffs.add", e);
    }
  }
}
