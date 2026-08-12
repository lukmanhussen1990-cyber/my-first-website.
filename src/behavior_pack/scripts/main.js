/**
 * Luxury Tech Mansion + Mycelium-X Outbreak — behaviour pack entry point.
 *
 * Targets Minecraft Bedrock 1.21.0 with @minecraft/server 1.11.0 (stable).
 * No beta modules, no experimental toggles required.
 *
 * Scheduling policy: exactly one repeating interval exists in the whole pack,
 * running at 2 Hz, with heavier work divided down from it. Nothing scans the
 * world, nothing iterates entities without a bounded radius, and every bulk
 * command burst is paced through the mansion command queue.
 *
 *   every 10 ticks (0.5s) : automatic doors
 *   every 20 ticks (1s)   : infection, room systems, HUD, sneak-to-use
 *   every 40 ticks (2s)   : worn-equipment refresh
 *   every 100 ticks (5s)  : outbreak director, spawning, auto-lockdown
 */

import { system, world } from "@minecraft/server";

import {
  ensureObjectives,
  forgetPlayer,
  getGlobal,
  loadFromWorld,
  playerState,
  resetAllInfection,
  restorePlayer,
} from "./state.js";
import {
  addInfection,
  countInfectedNear,
  nestsNear,
  registerCombatHooks,
  tickInfection,
  currentSecond,
} from "./infection.js";
import {
  directorPeriod,
  plantNest,
  startOutbreak,
  stopOutbreak,
  tickDirector,
} from "./outbreak.js";
import {
  buildMansion,
  clearMansion,
  considerAutoLockdown,
  lockdown,
  tickDoors,
  tickRooms,
  unlock,
} from "./mansion.js";
import {
  cure,
  refreshProtection,
  registerItemHooks,
  runScan,
  tickSneakUse,
} from "./equipment.js";
import { actionBar, HELP_LINES, statusReadout } from "./ui.js";

const BASE_PERIOD = 10; // ticks
let cycle = 0;

// ------------------------------------------------------------------ HUD ---

function updateActionBars(players) {
  const outbreak = getGlobal("outbreak") === 1;
  const level = getGlobal("level");
  const lockdownOn = getGlobal("lockdown") === 1;

  for (const player of players) {
    try {
      const record = playerState(player);
      // Stay off the HUD entirely when there is nothing worth saying.
      if (record.infection < 10 && !outbreak && !lockdownOn) continue;
      player.onScreenDisplay.setActionBar(
        actionBar(record.infection, { outbreak, level, lockdown: lockdownOn })
      );
    } catch {
      /* player left */
    }
  }
}

// -------------------------------------------------------------- commands --

function resolvePlayer(event) {
  const source = event.sourceEntity;
  if (source && source.typeId === "minecraft:player") return source;
  return world.getAllPlayers()[0];
}

function reportStatus(player) {
  const dimension = player.dimension;
  player.sendMessage(
    statusReadout({
      outbreak: getGlobal("outbreak") === 1,
      day: getGlobal("day"),
      level: getGlobal("level"),
      lockdown: getGlobal("lockdown") === 1,
      built: getGlobal("built") === 1,
      infectedNearby: countInfectedNear(dimension, player.location, 48),
      totalNests: nestsNear(dimension, player.location, 64).length,
    })
  );
}

const COMMANDS = {
  "myc:build": (player) => buildMansion(player),
  "myc:build_now": (player) => buildMansion(player, { instant: true }),
  "myc:clear": (player) => clearMansion(player),
  "myc:outbreak_start": (player) => startOutbreak(player),
  "myc:outbreak_stop": () => {
    stopOutbreak();
    resetAllInfection();
  },
  "myc:outbreak_status": (player) => reportStatus(player),
  "myc:lockdown": (player) => lockdown(player),
  "myc:unlock": (player) => unlock(player),
  "myc:scan": (player) => runScan(player),
  "myc:cure": (player) => cure(player),
  "myc:infect": (player, message) => {
    const amount = Number.parseInt(message, 10);
    addInfection(player, Number.isFinite(amount) && amount !== 0 ? amount : 25, "internal");
    player.sendMessage(
      `§7Infection is now §f${Math.round(playerState(player).infection)}%§7.`
    );
  },
  "myc:nest": (player) => {
    plantNest(player.dimension, player.location);
    player.sendMessage("§d[MYCELIUM-X] §7A fungal nest has taken root here.");
  },
  "myc:help": (player) => player.sendMessage(HELP_LINES.join("\n")),
};

function registerCommandHooks() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      try {
        const handler = COMMANDS[event.id];
        if (!handler) return;
        const player = resolvePlayer(event);
        if (!player) return;
        handler(player, event.message);
      } catch (error) {
        console.warn(`[myc] command ${event.id} failed: ${error}`);
      }
    },
    { namespaces: ["myc"] }
  );
}

// ------------------------------------------------------------- lifecycle --

function registerPlayerHooks() {
  world.afterEvents.playerSpawn.subscribe((event) => {
    try {
      restorePlayer(event.player);
      if (event.initialSpawn) {
        event.player.sendMessage(
          "§b§lLuxury Tech Mansion §r§8+ §c§lMycelium-X§r §7loaded. " +
            "Type §e/function myc_help§7 for commands."
        );
      }
    } catch {
      /* ignore */
    }
  });

  try {
    world.afterEvents.playerLeave.subscribe((event) => {
      forgetPlayer(event.playerId);
    });
  } catch {
    // playerLeave is not present on every build; leaking a small map entry per
    // departed player is harmless.
  }
}

function mainLoop() {
  cycle++;
  const players = world.getAllPlayers();
  if (players.length === 0) return;

  tickDoors(players);

  if (cycle % 2 === 0) {
    tickInfection(players);
    tickSneakUse(players);
    updateActionBars(players);
    tickRooms(players, currentSecond());
  }

  if (cycle % 4 === 0) {
    refreshProtection(players);
  }

  if (cycle % (directorPeriod() / BASE_PERIOD) === 0) {
    tickDirector(players);
    if (getGlobal("built") === 1 && getGlobal("outbreak") === 1) {
      const anchor = players[0];
      considerAutoLockdown(
        players,
        countInfectedNear(anchor.dimension, anchor.location, 48)
      );
    }
  }
}

function boot() {
  ensureObjectives();
  // Objectives are created by command, so the read has to wait a tick for them.
  system.runTimeout(() => {
    loadFromWorld();
    for (const player of world.getAllPlayers()) {
      try {
        restorePlayer(player);
      } catch {
        /* ignore */
      }
    }
  }, 20);

  registerCombatHooks();
  registerItemHooks();
  registerCommandHooks();
  registerPlayerHooks();

  system.runInterval(() => {
    try {
      mainLoop();
    } catch (error) {
      console.warn(`[myc] main loop error: ${error}`);
    }
  }, BASE_PERIOD);

  console.warn("[myc] Luxury Tech Mansion + Mycelium-X ready");
}

boot();
