// @ts-check
// Parasite outbreak subsystem (SPEC §7) - wiring.
//
// initOutbreak() registers the two items, subscribes the world events and
// starts two intervals:
//   pump      every tick: replication countdown, queued offspring/conversions
//             (<= MAX_SPAWNS_PER_TICK spawns), incubation batch
//             (<= INC_PER_TICK), purge queue, sync sweep, deferred jobs.
//             Idle cost: a few comparisons.
//   slowLoop  every 20 ticks: new incubation cycle, stage-2 pulses, HUD, the
//             5-second sync sweep, state save.
// Nothing reads the world at import time; state is loaded lazily (state.js).

import { world, system } from "@minecraft/server";
import { ITEMS } from "../lib/ids.js";
import { registerItemHandler } from "../lib/items.js";
import { runSafe, safe } from "../lib/util.js";
import { S, rt, ensureLoaded, saveState, saveIfDirty, markDirty } from "./state.js";
import { isHordeType, isPlayer } from "./horde.js";
import { tickCountdown, processSpawnQueue, MAX_SPAWNS_PER_TICK } from "./replication.js";
import { canSpread, infect, processIncBatch, startIncubationCycle, INC_PER_TICK } from "./infection.js";
import { processConvertQueue } from "./conversion.js";
import { infectedPlayersTick, onPlayerDeath, onPlayerSpawn } from "./players.js";
import { onEntityLoad, processPurgeQueue, processSweepQueue, startSweep, PURGE_PER_TICK, SWEEP_PER_TICK } from "./purge.js";
import { updateHud } from "./hud.js";
import { openControlMenu, guard } from "./ui.js";
import { initCommands } from "./commands.js";
import { releaseFromAir, releaseOnBlock } from "./release.js";

/** @typedef {import("@minecraft/server").Player} Player */

/** Sync sweep period in 1 Hz cycles (5 s). */
export const SWEEP_EVERY_CYCLES = 5;

let initialized = false;

/** Run the deferred jobs that are due. */
function runDeferred() {
  if (rt.deferred.length === 0) return;
  const now = system.currentTick;
  for (let i = 0; i < rt.deferred.length; ) {
    const job = rt.deferred[i];
    if (job.due <= now) {
      rt.deferred.splice(i, 1);
      runSafe(job.fn, job.label);
    } else i++;
  }
}

/** Every tick. */
export function pump() {
  ensureLoaded();
  runSafe(tickCountdown, "outbreak.countdown");
  const spawned = processSpawnQueue(MAX_SPAWNS_PER_TICK);
  if (!S().paused) {
    processConvertQueue(MAX_SPAWNS_PER_TICK - spawned);
    processIncBatch(INC_PER_TICK);
  }
  processPurgeQueue(PURGE_PER_TICK);
  processSweepQueue(SWEEP_PER_TICK);
  runDeferred();
}

/** Every 20 ticks. */
export function slowLoop() {
  ensureLoaded();
  rt.slowCycle++;
  const st = S();
  if (!st.paused) {
    runSafe(startIncubationCycle, "outbreak.incubationCycle");
    runSafe(infectedPlayersTick, "outbreak.stage2Tick");
  }
  runSafe(updateHud, "outbreak.hud");
  if (rt.slowCycle % SWEEP_EVERY_CYCLES === 0) runSafe(startSweep, "outbreak.sweep");
  if (st.active) saveState();
  else saveIfDirty();
}

/** Subscribe the outbreak subsystem's events (idempotent). */
export function initOutbreak() {
  if (initialized) return;
  initialized = true;

  registerItemHandler(ITEMS.OUTBREAK, {
    onUseOn: (player, block, face) => {
      ensureLoaded();
      releaseOnBlock(player, block, face);
    },
    onUse: (player) => {
      ensureLoaded();
      releaseFromAir(player);
    },
  });
  /** @param {Player} player */
  const menu = (player) => {
    ensureLoaded();
    guard(openControlMenu(player), "outbreak.ui.menu");
  };
  registerItemHandler(ITEMS.CONTROL, { onUse: menu, onUseOn: menu });

  world.afterEvents.entityHurt.subscribe(
    safe((ev) => {
      if (!(ev.damage > 0)) return;
      const st = S();
      if (!st.active || st.paused) return;
      const attacker = ev.damageSource.damagingEntity;
      if (!attacker || !canSpread(attacker)) return;
      infect(ev.hurtEntity, attacker);
    }, "outbreak.entityHurt"),
  );

  world.afterEvents.entityDie.subscribe(
    safe((ev) => {
      const e = ev.deadEntity;
      const typeId = e.typeId;
      if (isHordeType(typeId)) {
        rt.dying.set(e.id, system.currentTick);
        rt.held.clear(); // a slot may have freed: held conversions are re-evaluated
        S().stats.deaths++;
        markDirty();
        return;
      }
      if (isPlayer(e)) onPlayerDeath(/** @type {Player} */ (e), ev.damageSource);
    }, "outbreak.entityDie"),
  );

  world.afterEvents.entityRemove.subscribe(
    safe((ev) => {
      rt.dying.delete(ev.removedEntityId);
      rt.held.delete(ev.removedEntityId);
    }, "outbreak.entityRemove"),
  );

  world.afterEvents.entityLoad.subscribe(
    safe((ev) => {
      ensureLoaded();
      onEntityLoad(ev.entity);
    }, "outbreak.entityLoad"),
  );

  world.afterEvents.playerSpawn.subscribe(
    safe((ev) => {
      ensureLoaded();
      onPlayerSpawn(ev.player, ev.initialSpawn);
    }, "outbreak.playerSpawn"),
  );

  initCommands();

  system.runInterval(safe(pump, "outbreak.pump"), 1);
  system.runInterval(safe(slowLoop, "outbreak.loop"), 20);
  // Startup reconcile: load state and check every loaded horde entity once
  // (purges that happened while it was unloaded, dormancy after a reload).
  system.run(
    safe(() => {
      ensureLoaded();
      startSweep();
    }, "outbreak.startup"),
  );
}
