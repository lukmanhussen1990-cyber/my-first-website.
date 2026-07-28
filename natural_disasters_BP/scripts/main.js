/**
 * Natural Disasters - entry point.
 *
 * Wires the items, the random scheduler, the detector and the /scriptevent
 * commands together. Everything else lives in its own module:
 *
 *   config.js     settings and tuning values
 *   util.js       safe wrappers around the Minecraft APIs
 *   registry.js   master tick loop for running disasters
 *   scheduler.js  random disasters + warnings
 *   detector.js   Disaster Detector readout
 *   ui.js         Disaster Wand menus
 *   disasters/    one file per disaster
 */

import { system, world } from "@minecraft/server";
import { loadSettings, getSetting, setSetting, SETTINGS_DEFAULTS } from "./config.js";
import { initRegistry, startDisaster, stopAllDisasters, getDisasterKeys, getDefinition } from "./registry.js";
import { initScheduler, scheduleNext, ticksUntilNext, triggerSoon, ITEM_IDS } from "./scheduler.js";
import { initDetector } from "./detector.js";
import { openWandMenu, openInfoScreen, castDisaster, openSettingsMenu, statusText } from "./ui.js";
import { formatTicks, surfaceY } from "./util.js";

const VERSION = "1.0.0";

/** Stops one tap from being handled twice (itemUse + itemUseOn). */
const lastUse = new Map();

function debounce(player, ticks = 8) {
  const now = system.currentTick;
  const previous = lastUse.get(player.id) ?? -999;
  if (now - previous < ticks) return false;
  lastUse.set(player.id, now);
  return true;
}

function handleItemUse(player, itemId) {
  if (!player || !itemId) return;
  if (itemId === ITEM_IDS.WAND_ID) {
    if (!debounce(player)) return;
    system.run(() => openWandMenu(player));
  } else if (itemId === ITEM_IDS.DETECTOR_ID) {
    if (!debounce(player)) return;
    const remaining = getSetting("randomDisasters")
      ? `§7Next random event in about §f${formatTicks(Math.max(0, ticksUntilNext()))}§7.`
      : "§7Random disasters are turned off.";
    system.run(() => openInfoScreen(player, `${statusText()}\n\n${remaining}`));
  }
}

function registerEvents() {
  try {
    world.afterEvents.itemUse.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[NaturalDisasters] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[NaturalDisasters] could not subscribe to itemUse: ${error}`);
  }

  // Tapping a block on a touch screen fires itemUseOn instead of itemUse.
  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[NaturalDisasters] itemUseOn: ${error}`);
      }
    });
  } catch {
    // Older runtimes without itemUseOn: itemUse alone is enough.
  }

  try {
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        try {
          event.player.sendMessage(
            `§b[Natural Disasters v${VERSION}] §fCraft a §eDisaster Wand §fto start one, or a §eDisaster Detector §fto see them coming.`
          );
        } catch {
          // player already gone
        }
      }, 60);
    });
  } catch {
    // playerSpawn is optional flavour.
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["nd"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[NaturalDisasters] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands, usable from a command block or chat:
 *
 *   /scriptevent nd:start tornado         start where the sender is looking
 *   /scriptevent nd:start meteor 120 64 -40
 *   /scriptevent nd:stop                  stop and clean up everything
 *   /scriptevent nd:status                what is running
 *   /scriptevent nd:next                  time until the next random event
 *   /scriptevent nd:soon                  bring the next event forward
 *   /scriptevent nd:random on|off         toggle random disasters
 *   /scriptevent nd:give                  give yourself both items
 *   /scriptevent nd:settings              open the settings screen
 *   /scriptevent nd:help                  list all of this in chat
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
    case "nd:start": {
      const key = (args[0] ?? "").toLowerCase();
      if (!getDisasterKeys().includes(key)) {
        reply(`§c[Natural Disasters] Unknown disaster. Try: ${getDisasterKeys().join(", ")}`);
        return;
      }
      if (args.length >= 4) {
        const x = Number(args[1]);
        const y = Number(args[2]);
        const z = Number(args[3]);
        const dimension = source?.dimension ?? world.getDimension("overworld");
        if ([x, y, z].some((n) => Number.isNaN(n))) {
          reply("§c[Natural Disasters] Coordinates must be numbers.");
          return;
        }
        const ground = surfaceY(dimension, Math.floor(x), Math.floor(z), y + 24) ?? y;
        const result = startDisaster(key, dimension, { x, y: ground, z }, {});
        reply(result.ok ? `§b[Natural Disasters] §f${key} started.` : `§c${result.reason}`);
        return;
      }
      if (isPlayer) {
        castDisaster(source, key);
      } else {
        reply("§c[Natural Disasters] Add x y z when running this from a command block.");
      }
      return;
    }
    case "nd:stop": {
      const stopped = stopAllDisasters(false);
      reply(`§b[Natural Disasters] §fStopped ${stopped} disaster${stopped === 1 ? "" : "s"}.`);
      return;
    }
    case "nd:status": {
      reply(`§b[Natural Disasters]\n${statusText()}`);
      return;
    }
    case "nd:next": {
      reply(
        getSetting("randomDisasters")
          ? `§b[Natural Disasters] §fNext random event in about §e${formatTicks(Math.max(0, ticksUntilNext()))}§f.`
          : "§b[Natural Disasters] §fRandom disasters are off."
      );
      return;
    }
    case "nd:soon": {
      const seconds = Number(args[0]);
      triggerSoon(Number.isFinite(seconds) && seconds > 0 ? seconds : 15);
      reply("§b[Natural Disasters] §fThe next event has been moved forward.");
      return;
    }
    case "nd:random": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply("§c[Natural Disasters] Use: /scriptevent nd:random on  (or off)");
        return;
      }
      setSetting("randomDisasters", value === "on");
      scheduleNext();
      reply(`§b[Natural Disasters] §fRandom disasters are now §e${value}§f.`);
      return;
    }
    case "nd:give": {
      if (!isPlayer) {
        reply("§c[Natural Disasters] Only a player can be given items.");
        return;
      }
      try {
        source.runCommand(`give @s ${ITEM_IDS.WAND_ID} 1`);
        source.runCommand(`give @s ${ITEM_IDS.DETECTOR_ID} 1`);
      } catch (error) {
        reply(`§c[Natural Disasters] ${error}`);
      }
      return;
    }
    case "nd:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Natural Disasters] The settings screen needs a player.");
      return;
    }
    case "nd:reload": {
      loadSettings();
      reply("§b[Natural Disasters] §fSettings reloaded.");
      return;
    }
    case "nd:help":
    default: {
      const list = getDisasterKeys()
        .map((key) => `§7- §f${key} §8(${getDefinition(key).name})`)
        .join("\n");
      reply(
        `§b[Natural Disasters v${VERSION}]\n` +
          `§f/scriptevent nd:start <disaster> [x y z]\n` +
          `§f/scriptevent nd:stop  §7stop everything\n` +
          `§f/scriptevent nd:status  §7what is running\n` +
          `§f/scriptevent nd:next  §7time to the next event\n` +
          `§f/scriptevent nd:soon [seconds]\n` +
          `§f/scriptevent nd:random on|off\n` +
          `§f/scriptevent nd:give  §7wand + detector\n` +
          `§f/scriptevent nd:settings\n` +
          `§7Disasters:\n${list}`
      );
    }
  }
}

function boot() {
  loadSettings();
  // Make sure every setting exists in the world file from the very first run.
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));

  initRegistry();
  initDetector();
  initScheduler();
  registerEvents();

  console.warn(`[NaturalDisasters] v${VERSION} loaded with ${getDisasterKeys().length} disasters.`);
}

system.run(boot);
