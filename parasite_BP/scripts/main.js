/**
 * Parasite - entry point.
 *
 *   config.js  settings and tuning
 *   util.js    safe wrappers around the Minecraft APIs
 *   sounds.js  custom + vanilla sound ids
 *   swarm.js   the feeding, growing and splitting engine
 *   ui.js      Parasite Sample menus
 *
 * A parasite starts eating the moment it exists, no matter how it got there:
 * spawn egg, /summon, natural cave spawn, the Parasite Sample or a split.
 */

import { system, world } from "@minecraft/server";
import { PARASITE_ID, SAMPLE_ID, SETTINGS_DEFAULTS, getSetting, loadSettings, setSetting } from "./config.js";
import {
  awardKill,
  forget,
  initSwarm,
  nearestParasite,
  population,
  purgeAll,
  purgeNear,
  register,
  statusText
} from "./swarm.js";
import { openSampleMenu, openSettingsMenu, releaseParasite } from "./ui.js";
import { actionBar, allPlayers, isValidEntity } from "./util.js";

const VERSION = "1.0.0";
const lastUse = new Map();

function debounce(player, ticks = 8) {
  const now = system.currentTick;
  let id;
  try {
    id = player.id;
  } catch {
    return false;
  }
  const previous = lastUse.get(id) ?? -999;
  if (now - previous < ticks) return false;
  lastUse.set(id, now);
  return true;
}

function handleItemUse(player, itemId) {
  if (!player || itemId !== SAMPLE_ID) return;
  if (!debounce(player)) return;

  let sneaking = false;
  try {
    sneaking = player.isSneaking === true;
  } catch {
    sneaking = false;
  }

  if (sneaking) system.run(() => openSampleMenu(player));
  else system.run(() => releaseParasite(player));
}

function registerEvents() {
  // Anything that spawns a parasite ends up here.
  try {
    world.afterEvents.entitySpawn.subscribe((event) => {
      try {
        const entity = event.entity;
        if (!entity || entity.typeId !== PARASITE_ID) return;
        register(entity);
      } catch (error) {
        console.warn(`[Parasite] entitySpawn: ${error}`);
      }
    });
  } catch {
    // Older runtimes: the swarm resync picks parasites up within a few seconds.
  }

  try {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const dead = event.deadEntity;
        if (dead && dead.typeId === PARASITE_ID) {
          forget(dead.id);
          return;
        }
        const killer = event.damageSource?.damagingEntity;
        if (killer && killer.typeId === PARASITE_ID && isValidEntity(killer)) {
          awardKill(killer.id, dead?.typeId ?? "");
        }
      } catch (error) {
        console.warn(`[Parasite] entityDie: ${error}`);
      }
    });
  } catch {
    // entityDie missing: biomass from kills is simply not awarded.
  }

  try {
    world.afterEvents.entityRemove.subscribe((event) => {
      try {
        if (event.removedEntityId) forget(event.removedEntityId);
      } catch {
        // ignore
      }
    });
  } catch {
    // optional event
  }

  try {
    world.afterEvents.itemUse.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Parasite] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Parasite] could not subscribe to itemUse: ${error}`);
  }

  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Parasite] itemUseOn: ${error}`);
      }
    });
  } catch {
    // touch devices without itemUseOn still fire itemUse
  }

  // Belt and braces for touch controls: some interactions only produce the
  // "before" version of the use event. The debounce stops a single tap from
  // being handled twice when both fire.
  try {
    world.beforeEvents.itemUse.subscribe((event) => {
      const source = event.source;
      const typeId = event.itemStack?.typeId;
      system.run(() => {
        try {
          handleItemUse(source, typeId);
        } catch (error) {
          console.warn(`[Parasite] beforeItemUse: ${error}`);
        }
      });
    });
  } catch {
    // beforeEvents.itemUse missing on this runtime - the after events cover it.
  }

  try {
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        try {
          event.player.sendMessage(
            `§c[Parasite v${VERSION}] §fCraft a §eParasite Sample §fto release one. Sneak + tap for the menu.`
          );
        } catch {
          // ignore
        }
      }, 60);
    });
  } catch {
    // optional flavour
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["pm"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[Parasite] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands:
 *
 *   /scriptevent pm:spawn [count]     release parasites in front of you
 *   /scriptevent pm:purge             kill every parasite in the world
 *   /scriptevent pm:purge near        kill the ones within 32 blocks
 *   /scriptevent pm:status            population report
 *   /scriptevent pm:cap <number>      set the population cap
 *   /scriptevent pm:eat on|off        block eating on or off
 *   /scriptevent pm:breed on|off      growing and splitting on or off
 *   /scriptevent pm:give              give yourself a Parasite Sample
 *   /scriptevent pm:settings          open the settings screen
 *   /scriptevent pm:help              print this in chat
 */
function handleScriptEvent(event) {
  const id = event.id.toLowerCase();
  const args = (event.message ?? "").trim().split(/\s+/).filter(Boolean);
  const source = event.sourceEntity;
  const isPlayer = source && source.typeId === "minecraft:player";

  const reply = (message) => {
    try {
      if (isPlayer) source.sendMessage(message);
      else console.warn(message.replace(/§./g, ""));
    } catch {
      // ignore
    }
  };

  switch (id) {
    case "pm:spawn": {
      if (!isPlayer) {
        reply("§c[Parasite] A player has to run this one.");
        return;
      }
      const count = Math.max(1, Math.min(20, Number(args[0]) || 1));
      let released = 0;
      for (let i = 0; i < count; i++) if (releaseParasite(source, count > 1 ? 2.5 : 0)) released++;
      reply(`§c[Parasite] §fReleased ${released}. Population: ${population()}.`);
      return;
    }
    case "pm:purge": {
      if ((args[0] ?? "").toLowerCase() === "near" && isPlayer) {
        const removed = purgeNear(source.dimension, source.location, 32);
        reply(`§b[Parasite] §fPurged ${removed} nearby.`);
        return;
      }
      const removed = purgeAll();
      reply(`§b[Parasite] §fPurged ${removed} parasite${removed === 1 ? "" : "s"}.`);
      return;
    }
    case "pm:status": {
      reply(`§c[Parasite]\n${statusText()}`);
      return;
    }
    case "pm:cap": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 1) {
        reply("§c[Parasite] Use: /scriptevent pm:cap 25");
        return;
      }
      setSetting("maxPopulation", Math.floor(value));
      reply(`§b[Parasite] §fPopulation cap is now §e${Math.floor(value)}§f.`);
      return;
    }
    case "pm:eat":
    case "pm:breed": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply(`§c[Parasite] Use: /scriptevent ${id} on  (or off)`);
        return;
      }
      const key = id === "pm:eat" ? "eatBlocks" : "breeding";
      setSetting(key, value === "on");
      reply(`§b[Parasite] §f${key === "eatBlocks" ? "Block eating" : "Breeding"} is now §e${value}§f.`);
      return;
    }
    case "pm:give": {
      if (!isPlayer) {
        reply("§c[Parasite] Only a player can be given items.");
        return;
      }
      try {
        source.runCommand(`give @s ${SAMPLE_ID} 1`);
      } catch (error) {
        reply(`§c[Parasite] ${error}`);
      }
      return;
    }
    case "pm:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Parasite] The settings screen needs a player.");
      return;
    }
    case "pm:help":
    default: {
      reply(
        `§c[Parasite v${VERSION}]\n` +
          `§f/scriptevent pm:spawn [count]\n` +
          `§f/scriptevent pm:purge [near]\n` +
          `§f/scriptevent pm:status\n` +
          `§f/scriptevent pm:cap <number>\n` +
          `§f/scriptevent pm:eat on|off\n` +
          `§f/scriptevent pm:breed on|off\n` +
          `§f/scriptevent pm:give\n` +
          `§f/scriptevent pm:settings`
      );
    }
  }
}

/** Warns players when something is feeding close by. */
function initProximityWarning() {
  system.runInterval(() => {
    try {
      if (population() === 0) return;
      for (const player of allPlayers()) {
        let nearest;
        try {
          nearest = nearestParasite(player.dimension, player.location);
        } catch {
          continue;
        }
        if (!nearest || nearest.dist > 18) continue;
        const stage = nearest.entry.stage;
        const label = stage === "apex" ? "§4APEX PARASITE" : stage === "large" ? "§cParasite" : "§6Parasite";
        actionBar(player, `${label} §f${Math.round(nearest.dist)}m §7· it is feeding`);
      }
    } catch (error) {
      console.warn(`[Parasite] warning loop: ${error}`);
    }
  }, 20);
}

function boot() {
  loadSettings();
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));

  initSwarm();
  initProximityWarning();
  registerEvents();

  console.warn(`[Parasite] v${VERSION} loaded. Population cap ${getSetting("maxPopulation")}.`);
}

system.run(boot);
