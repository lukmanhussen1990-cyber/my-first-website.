// @ts-check
// Pause / resume (SPEC §7): dormant horde entities.
//
// Pausing sends `pas:become_dormant` and adds the `pas_dormant` tag to every
// loaded horde entity; resuming sends `pas:become_active` and removes the tag.
// Entities that load later are synced on entityLoad and by the 5-second sweep
// (purge.js). The sweep also compares against the real AI state
// (`minecraft:behavior.nearest_attackable_target` exists only in pas:hunting)
// so a missed event is repaired.
//
// Entity-event caveat (docs/ENTITIES.md): group changes apply on the entity's
// next tick and become_active is filtered on the AI component, so sending
// become_dormant and then become_active to one entity in the SAME tick leaves
// it dormant. A pause+resume within one tick is therefore deferred by a tick.

import { system } from "@minecraft/server";
import { EVENTS, TAGS } from "../lib/ids.js";
import { logError } from "../lib/util.js";
import { loadedHorde, hasTag } from "./horde.js";
import { S, rt, saveState, defer, advanceCountdown } from "./state.js";

/** @typedef {import("@minecraft/server").Entity} Entity */

/** Component that only exists while the pas:hunting group is active. */
export const AI_COMPONENT = "minecraft:behavior.nearest_attackable_target";

/**
 * Send the dormant/active event and set/clear the mirror tag.
 * @param {Entity} e
 * @param {boolean} dormant
 */
export function setDormant(e, dormant) {
  try {
    e.triggerEvent(dormant ? EVENTS.DORMANT : EVENTS.ACTIVE);
  } catch (err) {
    logError("outbreak.setDormant.event", err);
  }
  try {
    if (dormant) e.addTag(TAGS.DORMANT);
    else e.removeTag(TAGS.DORMANT);
  } catch {
    // invalid entity
  }
}

/** Whether horde entities should currently be dormant. @returns {boolean} */
export function wantDormant() {
  const st = S();
  return st.active && st.paused;
}

/**
 * Make a freshly spawned horde entity match the pause state (dormant if paused).
 * @param {Entity} e
 */
export function applySpawnDormancy(e) {
  if (wantDormant()) setDormant(e, true);
}

/**
 * Bring one loaded horde entity in line with the pause state.
 * @param {Entity} e
 * @returns {boolean} true if an event was sent
 */
export function syncDormancy(e) {
  const want = wantDormant();
  // a mass change in the opposite direction happened this tick: its deferred re-run handles e
  if (rt.dormancyTick === system.currentTick && rt.dormancyValue !== want) return false;
  const tagged = hasTag(e, TAGS.DORMANT);
  /** @type {boolean | undefined} */
  let hasAI;
  try {
    hasAI = e.hasComponent(AI_COMPONENT);
  } catch {
    hasAI = undefined;
  }
  if (want ? !tagged || hasAI === true : tagged || hasAI === false) {
    setDormant(e, want);
    return true;
  }
  return false;
}

/**
 * Apply `dormant` to every loaded horde entity (deferred one tick when the
 * opposite was applied in this same tick).
 * @param {boolean} dormant
 * @returns {number} entities updated now
 */
export function applyDormancyToAll(dormant) {
  const now = system.currentTick;
  if (rt.dormancyTick === now && rt.dormancyValue !== dormant) {
    rt.dormancyValue = dormant;
    defer(1, "outbreak.dormancy.deferred", () => {
      rt.dormancyTick = -1;
      applyDormancyToAll(wantDormant());
    });
    return 0;
  }
  rt.dormancyTick = now;
  rt.dormancyValue = dormant;
  let n = 0;
  for (const e of loadedHorde()) {
    setDormant(e, dormant);
    n++;
  }
  return n;
}

/**
 * Pause the outbreak: freeze timers and incubations, horde goes dormant.
 * @returns {boolean} false when inactive or already paused
 */
export function pause() {
  const st = S();
  if (!st.active || st.paused) return false;
  advanceCountdown();
  st.paused = true;
  // in-flight incubation work is dropped; the frozen values live on the entities
  rt.incBatch = [];
  rt.incPos = 0;
  rt.convertQueue.clear();
  saveState();
  applyDormancyToAll(true);
  return true;
}

/**
 * Resume a paused outbreak.
 * @returns {boolean} false when inactive or not paused
 */
export function resume() {
  const st = S();
  if (!st.active || !st.paused) return false;
  st.paused = false;
  rt.countdownTick = system.currentTick;
  saveState();
  applyDormancyToAll(false);
  return true;
}
