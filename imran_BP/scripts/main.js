/**
 * Imran Security House - entry point.
 *
 *   config.js  settings and tuning
 *   util.js    safe API wrappers
 *   sounds.js  custom + vanilla sound ids
 *   house.js   the deployable house, its name plate and its security system
 *   horde.js   the zombie disaster
 *   ui.js      the deployer menus
 *
 * Two things to remember:
 *   tap the House Deployer  -> the Imran security house goes up in front of you
 *   type "zombie disaster"  -> a thousand violent zombies come for you
 */

import { system, world } from "@minecraft/server";
import { DEPLOYER_ID, HORN_ID, SETTINGS_DEFAULTS, TUNING, ZOMBIE_ID, getSetting, loadSettings, setSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { buildHouse, houseCount, houseStatus, initHouses, insideAHouse, removeLastHouse } from "./house.js";
import { hordeStatus, initHorde, isActive, killAll, noteDeath, startHorde, stopHorde } from "./horde.js";
import { openDeployerMenu, openSettingsMenu } from "./ui.js";
import { actionBar, playSoundForPlayer, sendMessage } from "./util.js";

const VERSION = "1.0.0";
const lastUse = new Map();

function debounce(player, itemId, ticks = 10) {
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

  let sneaking = false;
  try {
    sneaking = player.isSneaking === true;
  } catch {
    sneaking = false;
  }

  if (itemId === DEPLOYER_ID) {
    if (!debounce(player, itemId)) return;
    if (sneaking) {
      system.run(() => openDeployerMenu(player));
      return;
    }
    system.run(() => {
      const result = buildHouse(player);
      if (!result.ok) sendMessage(player, `§c[Imran] ${result.reason}`);
      else playSoundForPlayer(player, SOUNDS.build.custom, SOUNDS.build.vanilla, { volume: 1, pitch: 1.2 });
    });
    return;
  }

  if (itemId === HORN_ID) {
    if (!debounce(player, itemId)) return;
    if (sneaking) {
      system.run(() => openDeployerMenu(player));
      return;
    }
    system.run(() => {
      if (isActive()) {
        const removed = stopHorde();
        sendMessage(player, `§b[Imran] §fCalled it off, ${removed} cleared.`);
      } else {
        startHorde();
      }
    });
  }
}

function registerEvents() {
  try {
    world.afterEvents.itemUse.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Imran] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Imran] could not subscribe to itemUse: ${error}`);
  }

  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Imran] itemUseOn: ${error}`);
      }
    });
  } catch {
    // touch devices without itemUseOn still fire itemUse
  }

  try {
    world.beforeEvents.itemUse.subscribe((event) => {
      const source = event.source;
      const typeId = event.itemStack?.typeId;
      system.run(() => {
        try {
          handleItemUse(source, typeId);
        } catch (error) {
          console.warn(`[Imran] beforeItemUse: ${error}`);
        }
      });
    });
  } catch {
    // beforeEvents.itemUse missing - the after events cover it.
  }

  // Typing the phrase in chat. This works without cheats, which is the whole
  // point: no commands needed to start a disaster.
  try {
    world.beforeEvents.chatSend.subscribe((event) => {
      try {
        if (!getSetting("chatTrigger")) return;
        const message = (event.message ?? "").trim().toLowerCase();
        if (!TUNING.chatPhrases.some((phrase) => message === phrase || message.startsWith(`${phrase} `))) {
          return;
        }
        event.cancel = true;

        // The count can be typed after the phrase: "zombie disaster 2000".
        const number = Number(message.split(/\s+/).pop());
        const count = Number.isFinite(number) && number > 0 ? Math.min(20000, number) : undefined;
        const sender = event.sender;
        system.run(() => {
          if (isActive()) {
            sendMessage(sender, "§e[Imran] A disaster is already running. Type again after it ends, or use the totem to stop it.");
            return;
          }
          startHorde(count);
        });
      } catch (error) {
        console.warn(`[Imran] chatSend: ${error}`);
      }
    });
  } catch {
    // chatSend unavailable: /scriptevent ih:horde still works
  }

  try {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const dead = event.deadEntity;
        if (!dead || dead.typeId !== ZOMBIE_ID) return;
        noteDeath(dead);
      } catch (error) {
        console.warn(`[Imran] entityDie: ${error}`);
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
          `§6[Imran Security House v${VERSION}] §fTap the §eHouse Deployer §fto build. Type §c"zombie disaster"§f in chat when you are ready to be hunted.`
        );
      }, 60);
    });
  } catch {
    // optional flavour
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["ih"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[Imran] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands:
 *
 *   /scriptevent ih:house              build the house in front of you
 *   /scriptevent ih:removehouse        clear the last house away
 *   /scriptevent ih:horde [count]      start a zombie disaster
 *   /scriptevent ih:stop               stop it and clear every zombie
 *   /scriptevent ih:status             houses and horde report
 *   /scriptevent ih:alive <number>     how many may live at once
 *   /scriptevent ih:give               deployer + horde totem
 *   /scriptevent ih:settings           open the settings screen
 *   /scriptevent ih:help               print this in chat
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
    case "ih:house": {
      if (!isPlayer) {
        reply("§c[Imran] A player has to run this one.");
        return;
      }
      const result = buildHouse(source);
      reply(result.ok ? "§6[Imran] §fBuilding..." : `§c[Imran] ${result.reason}`);
      return;
    }
    case "ih:removehouse": {
      const dimension = source?.dimension ?? world.getDimension("overworld");
      reply(
        removeLastHouse(dimension)
          ? "§b[Imran] §fThe last house has been cleared away."
          : "§c[Imran] There is no house to remove."
      );
      return;
    }
    case "ih:horde": {
      const count = Number(args[0]);
      const total = startHorde(Number.isFinite(count) && count > 0 ? count : undefined);
      reply(`§4[Imran] §f${total} zombies inbound.`);
      return;
    }
    case "ih:stop": {
      const removed = stopHorde(false);
      reply(`§b[Imran] §fStopped. Cleared ${removed} zombies.`);
      return;
    }
    case "ih:status": {
      reply(`§6[Imran]\n${hordeStatus()}\n\n§6Houses (${houseCount()}):\n${houseStatus()}`);
      return;
    }
    case "ih:alive": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 10 || value > 1000) {
        reply("§c[Imran] Use: /scriptevent ih:alive 150   (10 to 1000)");
        return;
      }
      setSetting("hordeMaxAlive", Math.floor(value));
      reply(
        `§b[Imran] §fUp to §e${Math.floor(value)}§f zombies alive at once.` +
          (value > 300 ? " §7That will hurt on a phone." : "")
      );
      return;
    }
    case "ih:give": {
      if (!isPlayer) {
        reply("§c[Imran] Only a player can be given items.");
        return;
      }
      try {
        source.runCommand(`give @s ${DEPLOYER_ID} 1`);
        source.runCommand(`give @s ${HORN_ID} 1`);
        reply("§6[Imran] §fHouse Deployer and Horde Totem granted.");
      } catch (error) {
        reply(`§c[Imran] ${error}`);
      }
      return;
    }
    case "ih:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Imran] The settings screen needs a player.");
      return;
    }
    case "ih:help":
    default: {
      reply(
        `§6[Imran Security House v${VERSION}]\n` +
          `§fType §c"zombie disaster"§f in chat to start the horde.\n` +
          `§f/scriptevent ih:house\n` +
          `§f/scriptevent ih:removehouse\n` +
          `§f/scriptevent ih:horde [count]\n` +
          `§f/scriptevent ih:stop\n` +
          `§f/scriptevent ih:status\n` +
          `§f/scriptevent ih:alive <number>\n` +
          `§f/scriptevent ih:give\n` +
          `§f/scriptevent ih:settings`
      );
    }
  }
}

/** Tells players when they are standing in a protected house. */
function initSafetyReadout() {
  system.runInterval(() => {
    try {
      if (houseCount() === 0) return;
      for (const player of world.getAllPlayers()) {
        if (isActive()) continue; // the horde readout owns the action bar
        try {
          if (insideAHouse(player.dimension, player.location)) {
            actionBar(player, "§a✔ Inside IMRAN §7- security system armed");
          }
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.warn(`[Imran] safety readout: ${error}`);
    }
  }, 20);
}

function boot() {
  loadSettings();
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));

  initHouses();
  initHorde();
  initSafetyReadout();
  registerEvents();

  console.warn(`[Imran] v${VERSION} loaded. Horde ${getSetting("hordeTotal")}, ${getSetting("hordeMaxAlive")} alive at once.`);
}

system.run(boot);

export { killAll };
