// @ts-check
// Infection of vanilla mobs and players and the 1 Hz incubation tick (SPEC §7).
//
// infect(): tag pas_incubating + pas:inc_ticks/pas:inc_total/pas:inc_epoch
// (players also pas:stage=1), spores at the feet, start sound, slowness on mobs,
// title/actionbar/heartbeat/nausea for players.
//
// Incubation cycle (every 20 ticks): every loaded entity tagged pas_incubating
// is collected and then processed at most INC_PER_TICK per tick (a huge
// number of incubating mobs is spread over the 20-tick window; if a cycle is
// not finished when the next one is due, the next one is skipped, which only
// slows incubation down). Per entity: purge check (inc_epoch < epoch -> clear),
// decrement by 20 ticks, feedback, and at <= 0 mobs are queued for conversion
// when the horde has room (otherwise they hold at 0 with "dormant" feedback)
// and players move to stage 2.

import { CONVERSIONS, ITEMS, PROPS, SOUNDS, TAGS } from "../lib/ids.js";
import { findHeld, isSurvivalLike, isValidEntity, runSafe, title, logError, playSoundTo } from "../lib/util.js";
import { getConfig } from "./config.js";
import { S, rt, markDirty, purgeKindAfter } from "./state.js";
import { isHorde, isPlayer, isAlive, hasTag, queryAll, HordeBudget } from "./horde.js";
import { spores, soundAt, addEffect, removeEffect, heartbeat, bar, EFFECTS } from "./fx.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */

/** Ticks removed from pas:inc_ticks per incubation step (1 Hz). */
export const INC_STEP = 20;
/** Max incubating entities processed per tick. */
export const INC_PER_TICK = 32;
/** Actionbar text of a stage-2 player (SPEC §7). */
export const INFECTED_BAR_TEXT = "☣ INFECTED — your attacks spread the parasite";

/**
 * @param {Entity} e
 * @param {string} id
 * @returns {number | undefined}
 */
export function numProp(e, id) {
  try {
    const v = e.getDynamicProperty(id);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Entity} e
 * @param {string} id
 * @param {string | number | boolean | undefined} v
 */
function setProp(e, id, v) {
  try {
    e.setDynamicProperty(id, v);
  } catch (err) {
    logError("outbreak.setProp", err);
  }
}

/**
 * 0 healthy, 1 incubating, 2 fully infected (from the tags, which mirror pas:stage).
 * @param {Entity} e
 * @returns {0 | 1 | 2}
 */
export function infectionStage(e) {
  if (hasTag(e, TAGS.INFECTED_PLAYER)) return 2;
  if (hasTag(e, TAGS.INCUBATING)) return 1;
  return 0;
}

/**
 * Whether damage dealt by `attacker` spreads the infection.
 * @param {Entity | undefined} attacker
 * @returns {boolean}
 */
export function canSpread(attacker) {
  if (!attacker) return false;
  if (isHorde(attacker)) return true;
  return isPlayer(attacker) && infectionStage(attacker) >= 1;
}

/**
 * Infectable: a CONVERSIONS source type, or a survival/adventure player when infectPlayers is on.
 * @param {Entity} e
 * @returns {boolean}
 */
export function isInfectable(e) {
  try {
    if (e.typeId in CONVERSIONS) return true;
    if (isPlayer(e)) return getConfig().infectPlayers && isSurvivalLike(/** @type {Player} */ (e));
  } catch {
    // invalid
  }
  return false;
}

/**
 * Healthy: not horde, not incubating, not a stage-2 player.
 * @param {Entity} e
 * @returns {boolean}
 */
export function isHealthy(e) {
  return !isHorde(e) && !hasTag(e, TAGS.INCUBATING) && !hasTag(e, TAGS.INFECTED_PLAYER);
}

/**
 * Whether the HUD (control item held + showHud) currently owns the player's actionbar.
 * @param {Player} p
 * @returns {boolean}
 */
export function hudOwnsActionbar(p) {
  return getConfig().showHud && findHeld(p, ITEMS.CONTROL) !== undefined;
}

/**
 * Start an infection (SPEC §7 "Infection start").
 * @param {Entity} target
 * @param {Entity} [_source] the entity that spread it (informational)
 * @returns {boolean} true if an infection started
 */
export function infect(target, _source) {
  const st = S();
  if (!st.active || st.paused) return false;
  if (!isAlive(target)) return false;
  if (!isInfectable(target) || !isHealthy(target)) return false;
  const cfg = getConfig();
  const player = isPlayer(target);
  const total = (player ? cfg.playerIncubationSeconds : cfg.incubationSeconds) * 20;
  try {
    target.addTag(TAGS.INCUBATING);
  } catch (err) {
    logError("outbreak.infect.tag", err);
    return false;
  }
  setProp(target, PROPS.INC_TICKS, total);
  setProp(target, PROPS.INC_TOTAL, total);
  setProp(target, PROPS.INC_EPOCH, st.epoch);
  spores(target);
  soundAt(target, SOUNDS.INFECTION_START);
  if (player) {
    const p = /** @type {Player} */ (target);
    setProp(p, PROPS.STAGE, 1);
    title(p, "§c☣ INFECTED ☣", `§eThe parasite incubates: ${Math.ceil(total / 20)}s`);
    bar(p, `§c☣ Infection incubating: §f${Math.ceil(total / 20)}s`);
    heartbeat(p);
    addEffect(p, EFFECTS.NAUSEA, 100);
  } else {
    addEffect(target, EFFECTS.SLOWNESS, 40, 1);
  }
  st.stats.infections++;
  markDirty();
  return true;
}

/**
 * Remove every trace of an infection (tags, props, effects, queues).
 * @param {Entity} e
 */
export function clearInfection(e) {
  try {
    e.removeTag(TAGS.INCUBATING);
    e.removeTag(TAGS.INFECTED_PLAYER);
  } catch {
    // invalid entity
  }
  for (const id of [PROPS.INC_TICKS, PROPS.INC_TOTAL, PROPS.INC_EPOCH]) {
    try {
      e.setDynamicProperty(id, undefined);
    } catch {
      // ignore
    }
  }
  if (isPlayer(e)) {
    try {
      e.setDynamicProperty(PROPS.STAGE, 0);
    } catch {
      // ignore
    }
    removeEffect(e, EFFECTS.NAUSEA);
    removeEffect(e, EFFECTS.HUNGER);
  }
  removeEffect(e, EFFECTS.SLOWNESS);
  try {
    rt.held.delete(e.id);
    rt.convertQueue.delete(e.id);
  } catch {
    // ignore
  }
}

/**
 * Clear an infection that belongs to a purged epoch (or to an outbreak that is
 * no longer active) and tell a player what happened.
 * @param {Entity} e
 */
export function purgeInfectionHolder(e) {
  const epoch = numProp(e, PROPS.INC_EPOCH) ?? -1;
  const kind = purgeKindAfter(epoch);
  clearInfection(e);
  if (isPlayer(e)) {
    const p = /** @type {Player} */ (e);
    try {
      p.sendMessage(kind === "cure" ? "§a☣ You have been cured of the parasite." : "§a☣ The outbreak was cleaned up - your infection is gone.");
    } catch {
      // ignore
    }
  }
}

/**
 * Whether an infection holder's epoch is stale (purged) or no outbreak is running.
 * @param {Entity} e
 * @returns {boolean}
 */
export function infectionIsStale(e) {
  const st = S();
  if (!st.active) return true;
  const epoch = numProp(e, PROPS.INC_EPOCH);
  return epoch !== undefined && epoch < st.epoch;
}

/**
 * Stage 1 -> stage 2 (SPEC §7).
 * @param {Player} p
 */
export function promoteToStage2(p) {
  try {
    p.removeTag(TAGS.INCUBATING);
    p.addTag(TAGS.INFECTED_PLAYER);
  } catch (err) {
    logError("outbreak.stage2.tags", err);
    return;
  }
  setProp(p, PROPS.STAGE, 2);
  setProp(p, PROPS.INC_TICKS, undefined);
  setProp(p, PROPS.INC_TOTAL, undefined);
  title(p, "§4☣ FULLY INFECTED ☣", "§cYour attacks spread the parasite");
  bar(p, `§c${INFECTED_BAR_TEXT}`);
  addEffect(p, EFFECTS.HUNGER, 200, 1);
  addEffect(p, EFFECTS.NAUSEA, 160);
  playSoundTo(p, SOUNDS.INFECTION_CONVERT);
}

/**
 * Feedback for a stage-1 player during incubation (every second).
 * @param {Player} p
 * @param {number} ticks remaining
 * @param {number} total
 */
function playerIncubationFeedback(p, ticks, total) {
  const secs = Math.max(0, Math.ceil(ticks / 20));
  if (!hudOwnsActionbar(p)) bar(p, `§c☣ Infection incubating: §f${secs}s`);
  const progress = total > 0 ? 1 - ticks / total : 1;
  heartbeat(p, 1 + Math.max(0, Math.min(1, progress)) * 0.5);
  if (secs > 0 && secs % 10 === 0) addEffect(p, EFFECTS.NAUSEA, 100);
  spores(p);
}

/**
 * Process one incubating entity (one incubation step).
 * @param {Entity} e
 * @param {HordeBudget} budget shared by the entities processed in the same tick
 */
export function processIncubating(e, budget) {
  if (!isValidEntity(e) || !hasTag(e, TAGS.INCUBATING)) return;
  if (infectionIsStale(e)) {
    purgeInfectionHolder(e);
    return;
  }
  if (!isAlive(e)) return; // dying: nothing to do
  const total = numProp(e, PROPS.INC_TOTAL) ?? INC_STEP;
  let ticks = numProp(e, PROPS.INC_TICKS) ?? total;
  if (ticks > 0) {
    ticks = Math.max(0, ticks - INC_STEP);
    setProp(e, PROPS.INC_TICKS, ticks);
  }
  if (isPlayer(e)) {
    const p = /** @type {Player} */ (e);
    if (ticks <= 0) promoteToStage2(p);
    else playerIncubationFeedback(p, ticks, total);
    return;
  }
  spores(e);
  if (ticks > 0) {
    addEffect(e, EFFECTS.SLOWNESS, 30, 1);
    return;
  }
  // incubation finished: convert when the horde has room, otherwise hold at 0
  if (rt.convertQueue.has(e.id)) return;
  const free = budget.cap - budget.current() - rt.convertQueue.size;
  if (free > 0) {
    rt.held.delete(e.id);
    rt.convertQueue.set(e.id, e);
  } else {
    rt.held.add(e.id);
    addEffect(e, EFFECTS.SLOWNESS, 30, 4); // "dormant": almost frozen
    if (rt.slowCycle % 3 === 0) soundAt(e, SOUNDS.INFECTION_HEARTBEAT, { pitch: 0.6, volume: 0.6 });
  }
}

/**
 * Process up to `limit` entities of the current incubation batch.
 * @param {number} limit
 * @returns {number} processed
 */
export function processIncBatch(limit) {
  if (rt.incPos >= rt.incBatch.length) return 0;
  const budget = new HordeBudget();
  let n = 0;
  while (rt.incPos < rt.incBatch.length && n < limit) {
    const e = rt.incBatch[rt.incPos++];
    n++;
    runSafe(() => processIncubating(e, budget), "outbreak.incubation");
  }
  if (rt.incPos >= rt.incBatch.length) {
    rt.incBatch = [];
    rt.incPos = 0;
  }
  return n;
}

/**
 * Start a new 1 Hz incubation cycle (skipped while the previous one is still
 * being processed) and process its first chunk right away.
 * @returns {boolean} whether a cycle started
 */
export function startIncubationCycle() {
  if (rt.incPos < rt.incBatch.length) return false;
  rt.incBatch = queryAll({ tags: [TAGS.INCUBATING] });
  rt.incPos = 0;
  processIncBatch(INC_PER_TICK);
  return true;
}

/** Remaining incubation seconds of a stage-1 entity (for UI). @param {Entity} e @returns {number} */
export function incubationSecondsLeft(e) {
  return Math.ceil((numProp(e, PROPS.INC_TICKS) ?? 0) / 20);
}
