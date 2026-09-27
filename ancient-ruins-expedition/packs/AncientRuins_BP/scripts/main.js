// Ancient Ruins Expedition - gameplay scripts (@minecraft/server 1.10.0).
// Mobile budget: one 5-tick loop, one getBlock per player per loop, event
// driven puzzles/traps, no per-entity tick logic in script.
import { system, world } from "@minecraft/server";
import { onBossDeath, onBossHurt, onBossSpecial, openVault } from "./bosses.js";
import { BLOCK, BOSS_IDS, CRUMBLING, FLOORS, MARKER, PROP, RUIN_TYPES, TUNING } from "./config.js";
import { forgetItems, itemTick, onItemUse } from "./items.js";
import { forgetPlayer, glyphOf, onGlyphPlate, onLeverOn } from "./puzzles.js";
import { allRuins, clearRegistry, isLoaded, loadRegistry, saveRegistry } from "./registry.js";
import { chartApprox, handleMarker, proximityTick, sweepMarkers } from "./ruins.js";
import { fireArrowTrap, leftGas, onMiasma, stepOnCrumbling } from "./traps.js";
import { blockAt, blockIdOf, forgetNotices, isBlock, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */

/** @type {Map<string, number>} last tick a player charted a ruin by walking on its floor */
const lastChart = new Map();

// --- Ruin discovery -------------------------------------------------------
world.afterEvents.entitySpawn.subscribe((ev) => {
  try {
    if (ev.entity.typeId === MARKER) system.run(() => handleMarker(ev.entity));
  } catch (e) {
    warn("entitySpawn", e);
  }
});

world.afterEvents.entityLoad.subscribe((ev) => {
  try {
    if (ev.entity.typeId === MARKER) system.run(() => handleMarker(ev.entity));
  } catch (e) {
    warn("entityLoad", e);
  }
});

// --- Puzzles and traps ----------------------------------------------------
world.afterEvents.leverAction.subscribe((ev) => {
  try {
    if (ev.isPowered && ev.player) onLeverOn(ev.player, ev.block);
  } catch (e) {
    warn("lever", e);
  }
});

world.afterEvents.pressurePlatePush.subscribe((ev) => {
  try {
    const src = ev.source;
    if (!src || src.typeId !== "minecraft:player") return;
    const player = /** @type {Player} */ (src);
    const below = ev.block.below();
    if (!below) return;
    if (isBlock(below, BLOCK.trap)) {
      fireArrowTrap(ev.dimension, ev.block, player);
      return;
    }
    const glyph = glyphOf(below);
    if (glyph) onGlyphPlate(player, ev.block, glyph);
  } catch (e) {
    warn("plate", e);
  }
});

// --- Relic items ------------------------------------------------------------
world.afterEvents.itemUse.subscribe((ev) => {
  try {
    onItemUse(ev.source, ev.itemStack.typeId);
  } catch (e) {
    warn("itemUse", e);
  }
});

const INTERACTIVE = ["minecraft:lever", "minecraft:chest", "minecraft:barrel", "minecraft:dispenser"];

world.afterEvents.itemUseOn.subscribe((ev) => {
  try {
    if (INTERACTIVE.some((id) => isBlock(ev.block, id))) return; // flipping a lever, opening a chest
    onItemUse(ev.source, ev.itemStack.typeId);
  } catch (e) {
    warn("itemUseOn", e);
  }
});

// --- Bosses -----------------------------------------------------------------
world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
  try {
    onBossSpecial(ev.entity);
  } catch (e) {
    warn("special", e);
  }
}, { entityTypes: BOSS_IDS, eventTypes: ["ancient_ruins:special_attack"] });

world.afterEvents.entityHurt.subscribe((ev) => onBossHurt(ev.hurtEntity), { entityTypes: BOSS_IDS });

world.afterEvents.entityDie.subscribe((ev) => {
  try {
    onBossDeath(ev.deadEntity);
  } catch (e) {
    warn("bossDeath", e);
  }
}, { entityTypes: BOSS_IDS });

// --- Players ----------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const player = ev.player;
  system.runTimeout(() => {
    try {
      if (!player.isValid() || player.getDynamicProperty(PROP.welcomed)) return;
      player.setDynamicProperty(PROP.welcomed, true);
      player.sendMessage("§6§lAncient Ruins Expedition§r§7 is active!");
      player.sendMessage("§7Find §2Jungle Temples§7, §6Desert Crypts§7 and §3Sunken Ships§7. Craft a §6Ruin Compass§7 (compass + 3 gold ingots + mossy cobblestone) and hold it to see the way to charted ruins.");
      player.sendMessage("§7Crouch while holding an §6Ancient Map§7 (or tap a block with it) to open the ruin list.");
    } catch (e) {
      warn("welcome", e);
    }
  }, 100);
});

world.afterEvents.playerLeave.subscribe((ev) => {
  forgetPlayer(ev.playerId);
  forgetItems(ev.playerId);
  leftGas(ev.playerId);
  lastChart.delete(ev.playerId);
  forgetNotices(ev.playerId);
});

// --- Debug helper: /scriptevent ancient_ruins:list  |  ancient_ruins:reset ---
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "ancient_ruins:list") {
    const lines = allRuins().map((r) =>
      `#${r.id} ${RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (r.t)]?.name ?? r.t} ${r.x} ${r.y} ${r.z}` +
      ` ${r.pr ? "exact" : "approx"}${r.a ? " boss-awake" : ""}${r.c ? " conquered" : ""}`);
    world.sendMessage(`§6[Ancient Ruins] ${lines.length} ruins charted`);
    for (const l of lines.slice(0, 20)) world.sendMessage(`§7${l}`);
  } else if (ev.id === "ancient_ruins:reset") {
    clearRegistry();
    world.sendMessage("§6[Ancient Ruins] ruin registry cleared");
  }
});

// --- Main loop (every 5 ticks) ----------------------------------------------
/**
 * Block under the player's feet drives the floor traps and ruin charting.
 * @param {Player} player
 * @param {number} tick
 */
function feetCheck(player, tick) {
  const dim = player.dimension;
  const loc = player.location;
  const below = blockAt(dim, { x: loc.x, y: loc.y - 0.2, z: loc.z });
  const id = blockIdOf(below);
  if (!below || !id || !id.startsWith("ancient_ruins:")) {
    leftGas(player.id);
    return;
  }
  if (id === BLOCK.miasma) {
    onMiasma(dim, player, tick);
    return;
  }
  leftGas(player.id);
  if (id in CRUMBLING) stepOnCrumbling(dim, below, player);
  const type = FLOORS[/** @type {keyof typeof FLOORS} */ (id)];
  if (type && tick - (lastChart.get(player.id) ?? -1e9) > 8) {
    lastChart.set(player.id, tick);
    chartApprox(type, player, below.location);
  }
}

let loop = 0;
system.runInterval(() => {
  loop++;
  if (!isLoaded()) loadRegistry();
  const players = world.getAllPlayers();
  for (const player of players) {
    try {
      feetCheck(player, loop);
      if (loop % 2 === 0) itemTick(player);
    } catch (e) {
      warn("player loop", e);
    }
  }
  try {
    if (loop % 8 === 0) proximityTick(players, openVault);
    if (loop % 40 === 7) sweepMarkers();
    if (loop % 8 === 4) saveRegistry();
  } catch (e) {
    warn("world loop", e);
  }
}, TUNING.loopTicks);
