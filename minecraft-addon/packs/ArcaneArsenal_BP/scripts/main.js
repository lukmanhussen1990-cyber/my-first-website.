// Arcane Arsenal - entry point. Wires game events to the weapon and light systems.
import { ItemStack, system, world } from "@minecraft/server";
import { alive, blockItemId, inventory, logError, mainhand } from "./util.js";
import { ITEMS, forgetPlayer, onHit, soulHarvest, tickPlayer, useItem } from "./weapons.js";
import { clearAllLights, forgetLightPlayer, tickLights } from "./lights.js";
import { DEFAULTS, setSetting, setting } from "./config.js";

/** @typedef {import("@minecraft/server").Player} Player */

// Using an item on these opens / toggles them, so it must not cast a spell.
const INTERACTABLE = [
  "chest", "door", "gate", "button", "lever", "barrel", "crafting_table", "furnace", "smoker", "anvil", "bed",
  "shulker_box", "hopper", "dispenser", "dropper", "loom", "grindstone", "stonecutter", "lectern", "beacon",
  "brewing_stand", "cauldron", "composter", "jukebox", "noteblock", "repeater", "comparator", "daylight_detector",
  "cake", "sign", "bell", "respawn_anchor", "lodestone", "crafter", "enchanting_table", "cartography_table",
  "smithing_table", "fletching_table", "frame", "flower_pot", "campfire", "bookshelf", "decorated_pot", "vault",
  "command_block", "structure_block", "jigsaw", "trial_spawner",
];

world.afterEvents.itemUse.subscribe((ev) => {
  try {
    useItem(ev.source, ev.itemStack);
  } catch (e) {
    logError(e);
  }
});

// Tapping a block (very common on touch screens) should cast too.
world.beforeEvents.itemUseOn.subscribe((ev) => {
  const item = ev.itemStack;
  if (!item || !ITEMS[item.typeId]) return;
  const player = ev.source;
  const block = ev.block;
  system.run(() => {
    try {
      const blockId = blockItemId(block) || "";
      if (INTERACTABLE.some((w) => blockId.includes(w))) return;
      useItem(player, mainhand(player));
    } catch (e) {
      logError(e);
    }
  });
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const p = ev.damagingEntity;
  if (!p || p.typeId !== "minecraft:player") return;
  onHit(/** @type {Player} */ (p), ev.hitEntity);
});

world.afterEvents.entityDie.subscribe((ev) => {
  try {
    const killer = ev.damageSource.damagingEntity;
    if (!killer || killer.typeId !== "minecraft:player" || !alive(killer)) return;
    const item = mainhand(killer);
    if (item && item.typeId === "arcane:shadow_reaper") soulHarvest(/** @type {Player} */ (killer), ev.deadEntity);
  } catch (e) {
    logError(e);
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  forgetPlayer(ev.playerId);
  forgetLightPlayer(ev.playerId);
});

// ------------------------------------------------------------------ help & settings
const HELP = [
  "§6§l[Arcane Arsenal]§r §fMagic weapons + realistic torch light are on!",
  "§7- Weapons: §fCreative > Equipment tab§7, or craft them (Tier II needs Tier I).",
  "§7- Cast a spell: §ftap/use§7 with the weapon, or press its on-screen button.",
  "§7- Hold any torch, lantern or glowstone to light up the area around you.",
  "§7- Radiant Torch: works in your off-hand, tap to toggle its flashlight beam.",
  "§7- Commands (cheats on): §f/function arcane/give_all§7, §f/function arcane/help",
  "§7- Settings: §f/function arcane/<lights|flicker|particles|hud>_<on|off>",
];

/** @param {Player} player */
function sendHelp(player) {
  for (const line of HELP) player.sendMessage(line);
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    try {
      if (!alive(player) || player.hasTag("arcane_welcomed")) return;
      player.addTag("arcane_welcomed");
      sendHelp(player);
    } catch (e) {
      logError(e);
    }
  }, 100);
});

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const src = ev.sourceEntity;
  const player = src && src.typeId === "minecraft:player" ? /** @type {Player} */ (src) : undefined;
  /** @param {string} msg */
  const reply = (msg) => (player ? player.sendMessage(msg) : world.sendMessage(msg));
  try {
    if (ev.id === "arcane:help") {
      if (player) sendHelp(player);
    } else if (ev.id === "arcane:config") {
      const [key, value] = ev.message.trim().toLowerCase().split(/\s+/);
      if (!(key in DEFAULTS) || (value !== "on" && value !== "off")) {
        reply(`§6[Arcane Arsenal] §7Usage: /scriptevent arcane:config <${Object.keys(DEFAULTS).join("|")}> <on|off>`);
        return;
      }
      setSetting(key, value === "on");
      if (key === "lights" && value === "off") clearAllLights();
      reply(`§6[Arcane Arsenal] §f${key} §7is now ${setting(key) ? "§aON" : "§cOFF"}`);
    } else if (ev.id === "arcane:give" && player) {
      const inv = inventory(player);
      for (const id of Object.keys(ITEMS)) inv?.addItem(new ItemStack(id, 1));
    }
  } catch (e) {
    logError(e);
  }
});

// ------------------------------------------------------------------ main loop
let tick = 0;
system.runInterval(() => {
  tick++;
  let players;
  try {
    players = world.getAllPlayers();
  } catch {
    return;
  }
  for (let i = 0; i < players.length; i++) {
    try {
      tickPlayer(players[i], tick, i);
    } catch (e) {
      logError(e);
    }
  }
  try {
    tickLights(players, tick);
  } catch (e) {
    logError(e);
  }
}, 1);
