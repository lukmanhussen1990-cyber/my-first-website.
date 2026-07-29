/**
 * Extreme Blizzard - entry point.
 *
 *   config.js    settings and tuning
 *   util.js      safe API wrappers
 *   sounds.js    custom + vanilla sound ids
 *   shelter.js   the sealed-and-heated room test
 *   blizzard.js  the storm cycle, freezing and snow
 *   ui.js        Weather Stone menus
 *
 * One rule: during a blizzard, the only safe place is a sealed room with a fire
 * in it. Everything else outside dies within a few seconds.
 */

import { system, world } from "@minecraft/server";
import {
  COCOA_ID,
  SETTINGS_DEFAULTS,
  STONE_ID,
  WARMER_ID,
  getSetting,
  loadSettings,
  setSetting
} from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  forgetPlayer,
  initBlizzard,
  isStorming,
  setStorm,
  statusText,
  temperatureOf,
  ticksLeftInPhase,
  warmPlayer
} from "./blizzard.js";
import { openSettingsMenu, openStoneMenu, shelterReport } from "./ui.js";
import { playSoundForPlayer, sendMessage, showTitle } from "./util.js";

const VERSION = "1.0.0";
const lastUse = new Map();
const warmerCooldown = new Map();

function debounce(player, itemId, ticks = 8) {
  let id;
  try {
    id = player.id;
  } catch {
    return false;
  }
  const now = system.currentTick;
  const key = `${id}:${itemId}`;
  const previous = lastUse.get(key) ?? -999;
  if (now - previous < ticks) return false;
  lastUse.set(key, now);
  return true;
}

function handleItemUse(player, itemId) {
  if (!player || !itemId) return;

  if (itemId === STONE_ID) {
    if (!debounce(player, itemId)) return;
    let sneaking = false;
    try {
      sneaking = player.isSneaking === true;
    } catch {
      sneaking = false;
    }
    if (sneaking) {
      system.run(() => openStoneMenu(player));
    } else {
      system.run(() => {
        setStorm(!isStorming());
        playSoundForPlayer(player, SOUNDS.stone.custom, SOUNDS.stone.vanilla, { volume: 1, pitch: 0.9 });
        sendMessage(
          player,
          isStorming() ? "§b[Blizzard] §fThe storm rolls in." : "§b[Blizzard] §fThe storm dies down."
        );
      });
    }
    return;
  }

  if (itemId === WARMER_ID) {
    if (!debounce(player, itemId)) return;
    system.run(() => useHandWarmer(player));
    return;
  }

  if (itemId === COCOA_ID) {
    // Drinking finishes in itemCompleteUse; this is the fallback for runtimes
    // that do not deliver that event.
    if (!debounce(player, itemId, 30)) return;
    system.run(() => drinkCocoa(player, false));
  }
}

function useHandWarmer(player) {
  let id;
  try {
    id = player.id;
  } catch {
    return;
  }
  const ready = warmerCooldown.get(id) ?? 0;
  if (system.currentTick < ready) {
    sendMessage(player, `§7[Blizzard] The hand warmer is still cooling: ${Math.ceil((ready - system.currentTick) / 20)}s.`);
    return;
  }
  warmerCooldown.set(id, system.currentTick + 20 * 25);
  warmPlayer(player, 35);
  playSoundForPlayer(player, SOUNDS.warmer.custom, SOUNDS.warmer.vanilla, { volume: 1, pitch: 1.1 });
  sendMessage(player, "§6[Blizzard] §fThe hand warmer glows. Body heat up.");
}

function drinkCocoa(player, consumed) {
  warmPlayer(player, 60);
  playSoundForPlayer(player, SOUNDS.cocoa.custom, SOUNDS.cocoa.vanilla, { volume: 1, pitch: 1 });
  sendMessage(player, "§6[Blizzard] §fThat is better. Body heat way up.");
  if (!consumed) {
    // The food component eats the item itself when itemCompleteUse fires; when
    // we get here from the fallback path, take one by hand.
    try {
      player.runCommand(`clear @s ${COCOA_ID} 0 1`);
    } catch {
      // ignore
    }
  }
}

function registerEvents() {
  try {
    world.afterEvents.itemUse.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Blizzard] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Blizzard] could not subscribe to itemUse: ${error}`);
  }

  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Blizzard] itemUseOn: ${error}`);
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
          console.warn(`[Blizzard] beforeItemUse: ${error}`);
        }
      });
    });
  } catch {
    // beforeEvents.itemUse missing - the after events cover it.
  }

  // Finishing a drink of hot cocoa.
  try {
    world.afterEvents.itemCompleteUse.subscribe((event) => {
      try {
        if (event.itemStack?.typeId !== COCOA_ID) return;
        drinkCocoa(event.source, true);
      } catch (error) {
        console.warn(`[Blizzard] itemCompleteUse: ${error}`);
      }
    });
  } catch {
    // optional: the itemUse fallback covers it
  }

  try {
    world.afterEvents.playerLeave.subscribe((event) => {
      try {
        if (event.playerId) forgetPlayer(event.playerId);
      } catch {
        // ignore
      }
    });
  } catch {
    // optional
  }

  try {
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        sendMessage(
          event.player,
          `§b[Extreme Blizzard v${VERSION}] §fWhen the storm hits, get into a §fsealed room with a fire in it§f. Nothing else will save you.`
        );
        if (isStorming()) showTitle(event.player, "§b§lBLIZZARD", "§fGet inside. Now.");
      }, 60);
    });
  } catch {
    // optional flavour
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["sw"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[Blizzard] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands:
 *
 *   /scriptevent sw:storm on|off        start or stop the blizzard now
 *   /scriptevent sw:status              storm state and everyone's body heat
 *   /scriptevent sw:check               is the room you are in safe?
 *   /scriptevent sw:harsh <percent>     how fast you freeze, 25 to 200
 *   /scriptevent sw:endless on|off      never ending winter
 *   /scriptevent sw:lethal on|off       whether the cold can kill
 *   /scriptevent sw:warm                fill your body heat back up
 *   /scriptevent sw:give                heater, weather stone, warmer, cocoa
 *   /scriptevent sw:settings            open the settings screen
 *   /scriptevent sw:help                print this in chat
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
    case "sw:storm": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply("§c[Blizzard] Use: /scriptevent sw:storm on  (or off)");
        return;
      }
      setStorm(value === "on");
      reply(`§b[Blizzard] §fThe blizzard is now §e${value}§f.`);
      return;
    }
    case "sw:status": {
      reply(`§b[Blizzard]\n${statusText()}`);
      return;
    }
    case "sw:check": {
      if (!isPlayer) {
        reply("§c[Blizzard] A player has to run this one.");
        return;
      }
      reply(`§b[Blizzard]\n${shelterReport(source)}`);
      return;
    }
    case "sw:harsh": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 10 || value > 400) {
        reply("§c[Blizzard] Use: /scriptevent sw:harsh 150   (10 to 400)");
        return;
      }
      setSetting("harshnessPercent", Math.round(value));
      reply(`§b[Blizzard] §fHarshness is now §e${Math.round(value)}%§f.`);
      return;
    }
    case "sw:endless":
    case "sw:lethal": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply(`§c[Blizzard] Use: /scriptevent ${id} on  (or off)`);
        return;
      }
      const key = id === "sw:endless" ? "alwaysOn" : "deadlyOutside";
      setSetting(key, value === "on");
      if (key === "alwaysOn" && value === "on") setStorm(true);
      reply(`§b[Blizzard] §f${key === "alwaysOn" ? "Endless winter" : "Lethal cold"} is now §e${value}§f.`);
      return;
    }
    case "sw:warm": {
      if (!isPlayer) {
        reply("§c[Blizzard] A player has to run this one.");
        return;
      }
      warmPlayer(source, 100);
      reply("§6[Blizzard] §fBody heat restored.");
      return;
    }
    case "sw:give": {
      if (!isPlayer) {
        reply("§c[Blizzard] Only a player can be given items.");
        return;
      }
      try {
        source.runCommand(`give @s ${STONE_ID} 1`);
        source.runCommand("give @s sw:heater 4");
        source.runCommand(`give @s ${WARMER_ID} 1`);
        source.runCommand(`give @s ${COCOA_ID} 4`);
        reply("§b[Blizzard] §fWeather Stone, 4 Heaters, a Hand Warmer and some Hot Cocoa.");
      } catch (error) {
        reply(`§c[Blizzard] ${error}`);
      }
      return;
    }
    case "sw:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Blizzard] The settings screen needs a player.");
      return;
    }
    case "sw:help":
    default: {
      reply(
        `§b[Extreme Blizzard v${VERSION}]\n` +
          `§f/scriptevent sw:storm on|off\n` +
          `§f/scriptevent sw:status\n` +
          `§f/scriptevent sw:check  §7- is this room safe?\n` +
          `§f/scriptevent sw:harsh <percent>\n` +
          `§f/scriptevent sw:endless on|off\n` +
          `§f/scriptevent sw:lethal on|off\n` +
          `§f/scriptevent sw:warm\n` +
          `§f/scriptevent sw:give\n` +
          `§f/scriptevent sw:settings`
      );
    }
  }
}

/** Warns players a minute before the storm arrives. */
function initForecast() {
  let warned = false;
  system.runInterval(() => {
    try {
      if (isStorming()) {
        warned = false;
        return;
      }
      const remaining = ticksLeftInPhase();
      if (remaining > 20 * 60 || warned) return;
      warned = true;
      for (const player of world.getAllPlayers()) {
        showTitle(player, "§b§lSTORM INCOMING", "§fOne minute. Get inside and light a fire.");
        playSoundForPlayer(player, SOUNDS.stormStart.custom, SOUNDS.stormStart.vanilla, {
          volume: 0.8,
          pitch: 1.2
        });
      }
    } catch (error) {
      console.warn(`[Blizzard] forecast: ${error}`);
    }
  }, 40);
}

function boot() {
  loadSettings();
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));

  initBlizzard();
  initForecast();
  registerEvents();

  console.warn(
    `[Blizzard] v${VERSION} loaded. Cycle ${getSetting("calmMinutes")}m calm / ${getSetting("stormMinutes")}m storm.`
  );
}

system.run(boot);

/** Exported for the tests. */
export { temperatureOf };
