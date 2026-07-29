/**
 * Kaiju Rampage - entry point.
 *
 *   config.js    settings and tuning
 *   util.js      safe API wrappers, raycast and block breaking helpers
 *   sounds.js    custom + vanilla sound ids
 *   rampage.js   the destruction engine: stomps, tail, atomic breath, roar
 *   ui.js        Kaiju Horn menus
 *
 * A kaiju starts wrecking the world the moment it exists, however it got there:
 * spawn egg, /summon, the Kaiju Horn or /scriptevent kj:summon.
 */

import { system, world } from "@minecraft/server";
import { HORN_ID, KAIJU_ID, SETTINGS_DEFAULTS, getSetting, loadSettings, setSetting } from "./config.js";
import {
  deathThroes,
  forget,
  initRampage,
  killAll,
  nearestKaiju,
  population,
  register,
  statusText
} from "./rampage.js";
import { openHornMenu, openSettingsMenu, summonKaiju } from "./ui.js";
import { actionBar, allPlayers, sendMessage } from "./util.js";

const VERSION = "1.0.0";
const lastUse = new Map();

function debounce(player, ticks = 8) {
  let id;
  try {
    id = player.id;
  } catch {
    return false;
  }
  const now = system.currentTick;
  const previous = lastUse.get(id) ?? -999;
  if (now - previous < ticks) return false;
  lastUse.set(id, now);
  return true;
}

function handleItemUse(player, itemId) {
  if (!player || itemId !== HORN_ID) return;
  if (!debounce(player)) return;

  let sneaking = false;
  try {
    sneaking = player.isSneaking === true;
  } catch {
    sneaking = false;
  }

  if (sneaking) system.run(() => openHornMenu(player));
  else system.run(() => summonKaiju(player));
}

function registerEvents() {
  // Anything that spawns a kaiju ends up here.
  try {
    world.afterEvents.entitySpawn.subscribe((event) => {
      try {
        const entity = event.entity;
        if (!entity || entity.typeId !== KAIJU_ID) return;
        register(entity);
      } catch (error) {
        console.warn(`[Kaiju] entitySpawn: ${error}`);
      }
    });
  } catch {
    // Older runtimes: the rampage resync picks kaiju up within a few seconds.
  }

  try {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const dead = event.deadEntity;
        if (!dead || dead.typeId !== KAIJU_ID) return;
        deathThroes(dead);
        forget(dead.id);
      } catch (error) {
        console.warn(`[Kaiju] entityDie: ${error}`);
      }
    });
  } catch {
    // optional
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
        console.warn(`[Kaiju] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Kaiju] could not subscribe to itemUse: ${error}`);
  }

  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Kaiju] itemUseOn: ${error}`);
      }
    });
  } catch {
    // touch devices without itemUseOn still fire itemUse
  }

  // Touch controls sometimes only produce the "before" version of the event.
  try {
    world.beforeEvents.itemUse.subscribe((event) => {
      const source = event.source;
      const typeId = event.itemStack?.typeId;
      system.run(() => {
        try {
          handleItemUse(source, typeId);
        } catch (error) {
          console.warn(`[Kaiju] beforeItemUse: ${error}`);
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
        sendMessage(
          event.player,
          `§4[Kaiju Rampage v${VERSION}] §fCraft a §eKaiju Horn §fand tap it to wake one. Sneak + tap for the menu.`
        );
      }, 60);
    });
  } catch {
    // optional flavour
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["kj"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[Kaiju] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands:
 *
 *   /scriptevent kj:summon             wake a kaiju in front of you
 *   /scriptevent kj:kill               remove every kaiju
 *   /scriptevent kj:status             what is awake and how hurt it is
 *   /scriptevent kj:destroy on|off     block smashing on or off
 *   /scriptevent kj:hunt on|off        whether it targets players
 *   /scriptevent kj:power <percent>    destruction scale, 25 to 200
 *   /scriptevent kj:cap <number>       how many kaiju may exist
 *   /scriptevent kj:give               give yourself a Kaiju Horn
 *   /scriptevent kj:settings           open the settings screen
 *   /scriptevent kj:help               print this in chat
 */
function handleScriptEvent(event) {
  const id = event.id.toLowerCase();
  const args = (event.message ?? "").trim().split(/\s+/).filter(Boolean);
  const source = event.sourceEntity;
  const isPlayer = source && source.typeId === "minecraft:player";

  const reply = (message) => {
    if (isPlayer) sendMessage(source, message);
    else console.warn(message.replace(/§./g, ""));
  };

  switch (id) {
    case "kj:summon": {
      if (!isPlayer) {
        reply("§c[Kaiju] A player has to run this one.");
        return;
      }
      const count = Math.max(1, Math.min(5, Number(args[0]) || 1));
      let woken = 0;
      for (let i = 0; i < count; i++) if (summonKaiju(source)) woken++;
      reply(`§4[Kaiju] §fWoke ${woken}. Awake: ${population()}.`);
      return;
    }
    case "kj:kill": {
      const removed = killAll();
      reply(`§b[Kaiju] §fBanished ${removed} kaiju.`);
      return;
    }
    case "kj:status": {
      reply(`§4[Kaiju]\n${statusText()}`);
      return;
    }
    case "kj:destroy":
    case "kj:hunt": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply(`§c[Kaiju] Use: /scriptevent ${id} on  (or off)`);
        return;
      }
      const key = id === "kj:destroy" ? "destroyBlocks" : "huntPlayers";
      setSetting(key, value === "on");
      reply(`§b[Kaiju] §f${key === "destroyBlocks" ? "Block smashing" : "Hunting players"} is now §e${value}§f.`);
      return;
    }
    case "kj:power": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 10 || value > 400) {
        reply("§c[Kaiju] Use: /scriptevent kj:power 150   (10 to 400)");
        return;
      }
      setSetting("destructionPercent", Math.round(value));
      reply(`§b[Kaiju] §fDestruction scale is now §e${Math.round(value)}%§f.`);
      return;
    }
    case "kj:cap": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 1) {
        reply("§c[Kaiju] Use: /scriptevent kj:cap 2");
        return;
      }
      setSetting("maxKaiju", Math.floor(value));
      reply(`§b[Kaiju] §fAt most §e${Math.floor(value)}§f kaiju may exist.`);
      return;
    }
    case "kj:give": {
      if (!isPlayer) {
        reply("§c[Kaiju] Only a player can be given items.");
        return;
      }
      try {
        source.runCommand(`give @s ${HORN_ID} 1`);
      } catch (error) {
        reply(`§c[Kaiju] ${error}`);
      }
      return;
    }
    case "kj:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Kaiju] The settings screen needs a player.");
      return;
    }
    case "kj:help":
    default: {
      reply(
        `§4[Kaiju Rampage v${VERSION}]\n` +
          `§f/scriptevent kj:summon [count]\n` +
          `§f/scriptevent kj:kill\n` +
          `§f/scriptevent kj:status\n` +
          `§f/scriptevent kj:destroy on|off\n` +
          `§f/scriptevent kj:hunt on|off\n` +
          `§f/scriptevent kj:power <percent>\n` +
          `§f/scriptevent kj:cap <number>\n` +
          `§f/scriptevent kj:give\n` +
          `§f/scriptevent kj:settings`
      );
    }
  }
}

/** Tells players how close the thing is, and what it is doing. */
function initProximityWarning() {
  system.runInterval(() => {
    try {
      if (population() === 0) return;
      for (const player of allPlayers()) {
        let nearest;
        try {
          nearest = nearestKaiju(player.dimension, player.location);
        } catch {
          continue;
        }
        if (!nearest || nearest.dist > 90) continue;
        const state =
          nearest.entry.phase === "charging" || nearest.entry.phase === "beaming"
            ? "§b charging its breath"
            : nearest.entry.enraged
              ? "§4 ENRAGED"
              : "§c rampaging";
        actionBar(player, `§4☢ KAIJU §f${Math.round(nearest.dist)}m§7 ·${state}`);
      }
    } catch (error) {
      console.warn(`[Kaiju] warning loop: ${error}`);
    }
  }, 20);
}

function boot() {
  loadSettings();
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));

  initRampage();
  initProximityWarning();
  registerEvents();

  console.warn(`[Kaiju] v${VERSION} loaded. Cap ${getSetting("maxKaiju")}, destruction ${getSetting("destroyBlocks")}.`);
}

system.run(boot);
