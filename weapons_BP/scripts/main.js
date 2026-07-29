/**
 * Legendary Weapons - entry point.
 *
 *   config.js     the weapon table + settings
 *   util.js       safe wrappers, including a hand written raycast
 *   sounds.js     custom + vanilla sound ids
 *   abilities.js  every active ability and passive
 *   ui.js         codex and settings screens
 *
 * Tap with a weapon to use its ability, sneak + tap to open the codex.
 */

import { system, world } from "@minecraft/server";
import {
  CORE_ID,
  SETTINGS_DEFAULTS,
  WEAPONS,
  WEAPON_KEYS,
  getSetting,
  itemId,
  loadSettings,
  setSetting,
  weaponFromItemId
} from "./config.js";
import { onHit, useAbility } from "./abilities.js";
import { SOUNDS } from "./sounds.js";
import { openCodex, openSettingsMenu, openWeaponPage } from "./ui.js";
import {
  actionBar,
  damageHeldItem,
  heldItem,
  playSoundForPlayer,
  sendMessage,
  startItemCooldown
} from "./util.js";

const VERSION = "1.0.0";

/** Stops one tap on one item being handled twice (itemUse + itemUseOn). */
const lastUse = new Map();

function debounce(player, itemId, ticks = 6) {
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

function cooldownCategory(weapon) {
  return `wm_${weapon.key}`;
}

/**
 * Cooldowns are tracked here rather than read back with getItemCooldown().
 *
 * The item's own `minecraft:cooldown` component starts the moment the item is
 * used - before this script ever sees the event - so asking the game "is this
 * on cooldown?" always answered yes and every ability was refused. The map
 * below is written only by this script, so it can never be poisoned that way.
 */
const castAt = new Map();

function cooldownKey(player, weapon) {
  try {
    return `${player.id}:${weapon.key}`;
  } catch {
    return `?:${weapon.key}`;
  }
}

/** Ticks left on a weapon's ability, 0 when it is ready. */
function ticksUntilReady(player, weapon) {
  const last = castAt.get(cooldownKey(player, weapon));
  if (last === undefined) return 0;
  const elapsed = system.currentTick - last;
  const total = weapon.cooldownSeconds * 20;
  return elapsed >= total ? 0 : total - elapsed;
}

function handleItemUse(player, id) {
  const weapon = weaponFromItemId(id);
  if (!weapon || !player) return;
  if (!debounce(player, id)) return;

  let sneaking = false;
  try {
    sneaking = player.isSneaking === true;
  } catch {
    sneaking = false;
  }
  if (sneaking) {
    system.run(() => openCodex(player, weapon.key));
    return;
  }

  const remaining = ticksUntilReady(player, weapon);
  if (remaining > 0) {
    actionBar(player, `§8${weapon.name} ready in §f${(remaining / 20).toFixed(1)}s`);
    playSoundForPlayer(player, SOUNDS.denied.custom, SOUNDS.denied.vanilla, { volume: 0.5, pitch: 0.8 });
    return;
  }

  // Claim the cooldown now so two taps in the same tick cannot both fire.
  castAt.set(cooldownKey(player, weapon), system.currentTick);

  system.run(() => {
    try {
      const fired = useAbility(player, weapon);
      if (!fired) {
        castAt.delete(cooldownKey(player, weapon));
        return;
      }
      startItemCooldown(player, cooldownCategory(weapon), weapon.cooldownSeconds);
      if (getSetting("abilityDurability")) damageHeldItem(player, 3);
    } catch (error) {
      castAt.delete(cooldownKey(player, weapon));
      console.warn(`[Weapons] ability ${weapon.key}: ${error}`);
    }
  });
}

function registerEvents() {
  try {
    world.afterEvents.itemUse.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Weapons] itemUse: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Weapons] could not subscribe to itemUse: ${error}`);
  }

  // Touch screens fire itemUseOn when the tap lands on a block.
  try {
    world.afterEvents.itemUseOn.subscribe((event) => {
      try {
        handleItemUse(event.source, event.itemStack?.typeId);
      } catch (error) {
        console.warn(`[Weapons] itemUseOn: ${error}`);
      }
    });
  } catch {
    // optional
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
          console.warn(`[Weapons] beforeItemUse: ${error}`);
        }
      });
    });
  } catch {
    // beforeEvents.itemUse missing on this runtime - the after events cover it.
  }

  // Melee passives.
  try {
    world.afterEvents.entityHurt.subscribe((event) => {
      try {
        const attacker = event.damageSource?.damagingEntity;
        if (!attacker || attacker.typeId !== "minecraft:player") return;
        if (event.damageSource.cause !== "entityAttack") return;
        const stack = heldItem(attacker);
        const weapon = weaponFromItemId(stack?.typeId);
        if (!weapon) return;
        onHit(attacker, weapon, event.hurtEntity, event.damage ?? weapon.melee);
      } catch (error) {
        console.warn(`[Weapons] entityHurt: ${error}`);
      }
    });
  } catch {
    // Without entityHurt the weapons still work, just without passives.
  }

  try {
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        sendMessage(
          event.player,
          `§6[Legendary Weapons v${VERSION}] §fCraft a §eWeapon Core §ffirst. Tap to use an ability, sneak + tap for the codex.`
        );
      }, 60);
    });
  } catch {
    // optional flavour
  }

  try {
    system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["wm"] });
  } catch {
    try {
      system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);
    } catch (error) {
      console.warn(`[Weapons] scriptevent unavailable: ${error}`);
    }
  }
}

/**
 * Admin commands:
 *
 *   /scriptevent wm:give [weapon|all]   give yourself weapons
 *   /scriptevent wm:use <weapon>        fire an ability without tapping
 *   /scriptevent wm:codex               open the codex
 *   /scriptevent wm:settings            open the settings screen
 *   /scriptevent wm:power <percent>     ability damage multiplier
 *   /scriptevent wm:blocks on|off       let abilities break blocks
 *   /scriptevent wm:pvp on|off          let abilities hit other players
 *   /scriptevent wm:list                list the weapon ids
 *   /scriptevent wm:help                print this in chat
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
    case "wm:give": {
      if (!isPlayer) {
        reply("§c[Weapons] Only a player can be given items.");
        return;
      }
      const which = (args[0] ?? "all").toLowerCase();
      try {
        if (which === "all") {
          for (const key of WEAPON_KEYS) source.runCommand(`give @s ${itemId(key)} 1`);
          source.runCommand(`give @s ${CORE_ID} 4`);
          reply("§6[Weapons] §fAll six legendary weapons are yours.");
          return;
        }
        if (which === "core") {
          source.runCommand(`give @s ${CORE_ID} 4`);
          reply("§6[Weapons] §fHave some weapon cores.");
          return;
        }
        if (!WEAPONS[which]) {
          reply(`§c[Weapons] Unknown weapon. Try: ${WEAPON_KEYS.join(", ")}, core, all`);
          return;
        }
        source.runCommand(`give @s ${itemId(which)} 1`);
        reply(`§6[Weapons] §f${WEAPONS[which].name} granted.`);
      } catch (error) {
        reply(`§c[Weapons] ${error}`);
      }
      return;
    }
    case "wm:use": {
      // Fires an ability without tapping. Handy on a phone for checking that a
      // weapon works when the touch controls are being awkward.
      if (!isPlayer) {
        reply("§c[Weapons] A player has to run this one.");
        return;
      }
      const key = (args[0] ?? "").toLowerCase();
      const weapon = WEAPONS[key];
      if (!weapon) {
        reply(`§c[Weapons] Unknown weapon. Try: ${WEAPON_KEYS.join(", ")}`);
        return;
      }
      system.run(() => {
        try {
          const fired = useAbility(source, weapon);
          reply(fired ? `§6[Weapons] §f${weapon.ability} fired.` : "§c[Weapons] That ability did nothing here.");
        } catch (error) {
          reply(`§c[Weapons] ${error}`);
        }
      });
      return;
    }
    case "wm:codex": {
      if (!isPlayer) {
        reply("§c[Weapons] The codex needs a player.");
        return;
      }
      const key = (args[0] ?? "").toLowerCase();
      if (WEAPONS[key]) system.run(() => openWeaponPage(source, key));
      else system.run(() => openCodex(source));
      return;
    }
    case "wm:settings": {
      if (isPlayer) system.run(() => openSettingsMenu(source));
      else reply("§c[Weapons] The settings screen needs a player.");
      return;
    }
    case "wm:power": {
      const value = Number(args[0]);
      if (!Number.isFinite(value) || value < 10 || value > 500) {
        reply("§c[Weapons] Use: /scriptevent wm:power 150   (10 to 500)");
        return;
      }
      setSetting("powerPercent", Math.round(value));
      reply(`§6[Weapons] §fAbility power is now §e${Math.round(value)}%§f.`);
      return;
    }
    case "wm:blocks":
    case "wm:pvp": {
      const value = (args[0] ?? "").toLowerCase();
      if (value !== "on" && value !== "off") {
        reply(`§c[Weapons] Use: /scriptevent ${id} on  (or off)`);
        return;
      }
      const key = id === "wm:blocks" ? "blockDamage" : "hurtPlayers";
      setSetting(key, value === "on");
      reply(
        `§6[Weapons] §f${key === "blockDamage" ? "Block damage" : "PvP"} is now §e${value}§f.`
      );
      return;
    }
    case "wm:list": {
      reply(
        `§6[Weapons]\n` +
          WEAPON_KEYS.map((key) => `§7- §f${key} §8(${WEAPONS[key].name}, ${WEAPONS[key].ability})`).join("\n")
      );
      return;
    }
    case "wm:help":
    default: {
      reply(
        `§6[Legendary Weapons v${VERSION}]\n` +
          `§f/scriptevent wm:give [weapon|core|all]\n` +
          `§f/scriptevent wm:use <weapon>\n` +
          `§f/scriptevent wm:codex [weapon]\n` +
          `§f/scriptevent wm:settings\n` +
          `§f/scriptevent wm:power <percent>\n` +
          `§f/scriptevent wm:blocks on|off\n` +
          `§f/scriptevent wm:pvp on|off\n` +
          `§f/scriptevent wm:list`
      );
    }
  }
}

function boot() {
  loadSettings();
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, getSetting(key));
  registerEvents();
  console.warn(`[Weapons] v${VERSION} loaded with ${WEAPON_KEYS.length} weapons.`);
}

system.run(boot);
