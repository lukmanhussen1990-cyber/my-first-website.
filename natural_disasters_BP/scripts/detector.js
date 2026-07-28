/**
 * Natural Disasters - the Disaster Detector.
 *
 * While a player holds the detector its readout is printed on the action bar
 * every half second:
 *
 *   - a disaster is running nearby  -> type, distance and compass direction
 *   - a disaster is being prepared  -> countdown with an accelerating beep
 *   - nothing going on              -> time until the next random event
 */

import { system } from "@minecraft/server";
import { getSetting } from "./config.js";
import { getActiveDisasters, disasterLocation, getDefinition } from "./registry.js";
import { getPending, ticksUntilNext, holdingDetector } from "./scheduler.js";
import { SOUNDS } from "./sounds.js";
import {
  actionBar,
  allPlayers,
  compassName,
  distance,
  formatTicks,
  playSoundForPlayer,
  showTitle
} from "./util.js";

/** Players that already got the "incoming" title for the current event. */
const warnedFor = new Map();
let loopId = undefined;

export function initDetector() {
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      updateAll();
    } catch (error) {
      console.warn(`[NaturalDisasters] detector: ${error}`);
    }
  }, 10);
}

function updateAll() {
  const pending = getPending();
  for (const player of allPlayers()) {
    if (!holdingDetector(player)) continue;
    try {
      update(player, pending);
    } catch {
      // Player left mid update.
    }
  }
  if (!pending) warnedFor.clear();
}

function update(player, pending) {
  const nearest = nearestActive(player);

  if (nearest) {
    const definition = getDefinition(nearest.entry.key);
    const dir = compassName(nearest.delta.x, nearest.delta.z);
    actionBar(
      player,
      `§c⚠ ${definition.color}${definition.name} §f${Math.round(nearest.dist)}m §7${dir}`
    );
    if (system.currentTick % 20 === 0) {
      playSoundForPlayer(player, SOUNDS.detectorAlarm.custom, SOUNDS.detectorAlarm.vanilla, {
        volume: 0.6,
        pitch: nearest.dist < 25 ? 1.6 : 1.1
      });
    }
    return;
  }

  if (pending) {
    const definition = getDefinition(pending.key);
    const remaining = Math.max(0, ticksUntilNext());
    let far = 999;
    try {
      far =
        player.dimension.id === pending.dimension.id
          ? distance(player.location, pending.location)
          : 999;
    } catch {
      far = 999;
    }

    if (far < 200) {
      const dx = pending.location.x - player.location.x;
      const dz = pending.location.z - player.location.z;
      actionBar(
        player,
        `§e⚠ Incoming: ${definition.color}${definition.name} §f${formatTicks(remaining)} §7${compassName(
          dx,
          dz
        )} §8(${Math.round(far)}m)`
      );

      // One time heads up title the first moment the detector picks it up.
      const key = `${player.id}:${pending.plannedAtTick}`;
      if (!warnedFor.has(key)) {
        warnedFor.set(key, true);
        showTitle(player, `§e⚠ Warning`, `§f${definition.name} in ${formatTicks(remaining)}`, 5, 40, 10);
      }

      // Beep faster the closer the event gets.
      const interval = remaining > 400 ? 40 : remaining > 200 ? 20 : remaining > 80 ? 10 : 5;
      if (system.currentTick % interval === 0) {
        playSoundForPlayer(player, SOUNDS.detectorTick.custom, SOUNDS.detectorTick.vanilla, {
          volume: 0.7,
          pitch: remaining > 200 ? 1 : remaining > 80 ? 1.4 : 1.9
        });
      }
      return;
    }
  }

  if (getSetting("randomDisasters")) {
    const remaining = Math.max(0, ticksUntilNext());
    actionBar(player, `§a✔ All clear §7· next event in ~${formatTicks(remaining)}`);
  } else {
    actionBar(player, "§a✔ All clear §7· random disasters are off");
  }
}

/** Closest running disaster in the player's dimension. */
function nearestActive(player) {
  let best = undefined;
  let playerLoc;
  let dimensionId;
  try {
    playerLoc = player.location;
    dimensionId = player.dimension.id;
  } catch {
    return undefined;
  }

  for (const entry of getActiveDisasters()) {
    if (entry.dimension.id !== dimensionId) continue;
    const loc = disasterLocation(entry);
    const dist = distance(playerLoc, loc);
    if (dist > 250) continue;
    if (!best || dist < best.dist) {
      best = {
        entry,
        dist,
        delta: { x: loc.x - playerLoc.x, y: loc.y - playerLoc.y, z: loc.z - playerLoc.z }
      };
    }
  }
  return best;
}
