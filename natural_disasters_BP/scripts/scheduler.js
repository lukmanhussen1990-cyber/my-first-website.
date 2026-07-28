/**
 * Natural Disasters - random disaster scheduler.
 *
 * Timeline of a random disaster:
 *
 *   plan  ─────────────► detector warning ───► public warning ───► it happens
 *   (a target and a disaster are chosen)      (title on screen)
 *
 * The Disaster Detector reads the pending event, which is why it can warn a
 * player long before anyone else notices anything.
 */

import { system } from "@minecraft/server";
import { TUNING, getSetting } from "./config.js";
import { getDefinition, getDisasterKeys, startDisaster } from "./registry.js";
import { SOUNDS } from "./sounds.js";
import {
  allPlayers,
  broadcast,
  distance,
  pickRandom,
  playSoundForPlayer,
  randFloat,
  randInt,
  showTitle,
  surfaceY,
  isHolding
} from "./util.js";

const WAND_ID = "nd:disaster_wand";
const DETECTOR_ID = "nd:disaster_detector";

/** The disaster that is being prepared, or undefined. */
let pending = undefined;
/** Tick at which the next random disaster should fire. */
let nextTick = 0;
let loopId = undefined;

export function initScheduler() {
  scheduleNext();
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      pump();
    } catch (error) {
      console.warn(`[NaturalDisasters] scheduler: ${error}`);
    }
  }, 10);
}

/** Picks a new random delay until the next disaster. */
export function scheduleNext(delayTicks) {
  const minMinutes = Math.max(1, getSetting("minMinutes"));
  const maxMinutes = Math.max(minMinutes, getSetting("maxMinutes"));
  const delay = delayTicks ?? randInt(minMinutes * 60 * 20, maxMinutes * 60 * 20);
  nextTick = system.currentTick + delay;
  pending = undefined;
}

/** Ticks remaining until the next random disaster (may be negative). */
export function ticksUntilNext() {
  return nextTick - system.currentTick;
}

/** The prepared-but-not-yet-started disaster, for the detector. */
export function getPending() {
  return pending;
}

/** Forces the next random disaster to be prepared right now. */
export function triggerSoon(seconds = 15) {
  nextTick = system.currentTick + seconds * 20;
  pending = undefined;
}

function pump() {
  if (!getSetting("randomDisasters")) {
    // Keep pushing the timer forward so nothing fires the moment it is re-enabled.
    nextTick = Math.max(nextTick, system.currentTick + 20 * 60);
    pending = undefined;
    return;
  }

  const players = allPlayers();
  if (players.length === 0) {
    nextTick = system.currentTick + 20 * 30;
    return;
  }

  const remaining = ticksUntilNext();
  const planLead = getSetting("detectorWarnSeconds") * 20;

  if (!pending && remaining <= planLead) {
    pending = planDisaster(players);
    if (!pending) {
      // Nowhere sensible to put it - try again shortly.
      nextTick = system.currentTick + 20 * 20;
      return;
    }
  }

  if (!pending) return;

  const publicLead = getSetting("publicWarnSeconds") * 20;
  if (!pending.publicWarned && remaining <= publicLead) {
    pending.publicWarned = true;
    announce(pending);
  }

  if (remaining <= 0) {
    const event = pending;
    pending = undefined;
    const result = startDisaster(event.key, event.dimension, event.location, {});
    if (!result.ok) console.warn(`[NaturalDisasters] random disaster skipped: ${result.reason}`);
    scheduleNext();
  }
}

/** Chooses what will happen, to whom, and where. */
function planDisaster(players) {
  const player = pickRandom(players);
  if (!player) return undefined;

  let origin;
  let dimension;
  try {
    origin = player.location;
    dimension = player.dimension;
  } catch {
    return undefined;
  }

  const key = pickRandom(getDisasterKeys());
  const angle = randFloat(0, Math.PI * 2);
  const dist = randFloat(TUNING.randomSpawnMinDistance, TUNING.randomSpawnMaxDistance);
  const x = origin.x + Math.cos(angle) * dist;
  const z = origin.z + Math.sin(angle) * dist;
  const y = surfaceY(dimension, Math.floor(x), Math.floor(z), origin.y + 30) ?? origin.y;

  return {
    key,
    dimension,
    location: { x, y, z },
    targetName: player.name,
    publicWarned: false,
    plannedAtTick: system.currentTick
  };
}

/** Big on screen warning for everyone, with an extra line for detector holders. */
function announce(event) {
  const definition = getDefinition(event.key);
  if (!definition) return;

  broadcast(`§4[!] §c${definition.warning}`);
  for (const player of allPlayers()) {
    let far = 999;
    try {
      far = player.dimension.id === event.dimension.id ? distance(player.location, event.location) : 999;
    } catch {
      far = 999;
    }
    if (far > 160) continue;

    showTitle(player, `§c${definition.color}${definition.name}!`, `§7${definition.warning}`, 5, 45, 15);
    playSoundForPlayer(player, SOUNDS.warning.custom, SOUNDS.warning.vanilla, { volume: 1, pitch: 0.8 });
  }
}

/** True when the player is currently holding a Disaster Detector. */
export function holdingDetector(player) {
  return isHolding(player, DETECTOR_ID);
}

/** True when the player is currently holding a Disaster Wand. */
export function holdingWand(player) {
  return isHolding(player, WAND_ID);
}

export const ITEM_IDS = { WAND_ID, DETECTOR_ID };
