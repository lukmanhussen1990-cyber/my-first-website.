// Gojo Satoru - Limitless Addon
// Script API: @minecraft/server 1.10.0 + @minecraft/server-ui 1.1.0
// (the stable modules of Minecraft Bedrock 1.21.0.26 - no experiments needed)

import { system, world } from "@minecraft/server";
import { ITEM_BY_ID } from "./data/abilities.js";
import { tryCast } from "./core/cast.js";
import { getState, peekState, dropState, flash } from "./core/state.js";
import { runTasks, cancelTasks, hasTask } from "./core/tasks.js";
import { refreshBuffs } from "./core/buffs.js";
import { drawHud } from "./core/hud.js";
import { heldItem, normalizeHeld } from "./core/items.js";
import { pruneTechniqueHits } from "./core/combat.js";
import { openMainMenu } from "./core/menu.js";
import { alive, logError } from "./lib/util.js";

// Techniques register themselves with the cast dispatcher on import.
import { infinityTick, onPlayerHurt, onPlayerHealthChanged } from "./abilities/infinity.js";
import "./abilities/blue.js";
import "./abilities/red.js";
import "./abilities/purple.js";
import { clearVoidFog } from "./abilities/domain.js";
import { sixEyesTick } from "./abilities/sixeyes.js";
import "./abilities/teleport.js";
import "./abilities/rct.js";
import "./abilities/blackflash.js";
import { auraTick, transform, release } from "./abilities/transform.js";

/** @typedef {import("@minecraft/server").Player} Player */

const INTRO_KEY = "gojo:intro_shown";

/** @param {import("@minecraft/server").ItemStack | undefined} item */
function castableKey(item) {
  if (!item) return undefined;
  const def = ITEM_BY_ID[item.typeId];
  if (!def || def.kind === "wearable") return undefined;
  return def.key;
}

// Tap / right-click in the air.
world.afterEvents.itemUse.subscribe((ev) => {
  const key = castableKey(ev.itemStack);
  if (key) tryCast(ev.source, key, { trigger: "use" });
});

// Tap / right-click on a block (very common on touch screens).
world.afterEvents.itemUseOn.subscribe((ev) => {
  const key = castableKey(ev.itemStack);
  if (key) tryCast(ev.source, key, { trigger: "useOn", block: ev.block });
});

// Tapping a mob on a touch screen is an attack: cast the held technique at it.
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const attacker = ev.damagingEntity;
  if (attacker.typeId !== "minecraft:player") return;
  const player = /** @type {Player} */ (attacker);
  const held = heldItem(player);
  const def = held ? ITEM_BY_ID[held.typeId] : undefined;
  if (!def || def.kind !== "ability") return;
  tryCast(player, def.key, { trigger: "hit", target: ev.hitEntity });
});

// Infinity: nullify hits that reached the player anyway.
world.afterEvents.entityHurt.subscribe(onPlayerHurt, { entityTypes: ["minecraft:player"] });
world.afterEvents.entityHealthChanged.subscribe(onPlayerHealthChanged, { entityTypes: ["minecraft:player"] });

world.afterEvents.entityDie.subscribe(
  (ev) => {
    const dead = ev.deadEntity;
    cancelTasks(dead.id, "death");
    const st = peekState(dead.id);
    if (!st) return;
    st.busy = "";
    st.flowStacks = 0;
    st.frozen.clear();
    st.appliedEffects.clear();
  },
  { entityTypes: ["minecraft:player"] }
);

world.afterEvents.playerSpawn.subscribe((ev) => {
  const player = ev.player;
  const st = getState(player);
  st.busy = "";
  clearVoidFog(player);
  system.runTimeout(() => {
    if (!alive(player)) return;
    refreshBuffs(player, st, true);
    if (ev.initialSpawn) intro(player, st);
  }, 20);
});

world.afterEvents.playerLeave.subscribe((ev) => {
  cancelTasks(ev.playerId, "left");
  dropState(ev.playerId);
});

// /scriptevent gojo:menu | gojo:transform | gojo:release  (handy for commands & NPCs)
system.afterEvents.scriptEventReceive.subscribe(
  (ev) => {
    const src = ev.sourceEntity;
    if (!src || src.typeId !== "minecraft:player") return;
    const player = /** @type {Player} */ (src);
    const st = getState(player);
    if (ev.id === "gojo:menu") openMainMenu(player);
    else if (ev.id === "gojo:transform" && !st.transformed) transform(player, st);
    else if (ev.id === "gojo:release" && st.transformed) release(player, st);
  },
  { namespaces: ["gojo"] }
);

/**
 * One-time welcome message so players know where to find the items.
 * @param {Player} player
 * @param {import("./core/state.js").PlayerState} st
 */
function intro(player, st) {
  try {
    if (st.transformed) flash(st, "§bLimitless §8» §fWelcome back, the Strongest.", 60);
    if (player.getDynamicProperty(INTRO_KEY) === true) return;
    player.setDynamicProperty(INTRO_KEY, true);
    player.sendMessage(
      "§b§lGojo Satoru – Limitless Addon§r§7 is active! Get the §fGojo Satoru: Transformation§7 item from the " +
        "Creative inventory (§fEquipment§7 tab, or search §fGojo§7), or craft it: amethyst shard on top, " +
        "lapis + eye of ender + redstone in the middle, diamond below."
    );
  } catch (e) {
    logError("intro", e);
  }
}

/**
 * @param {Player} player
 * @param {number} tick
 */
function perPlayer(player, tick) {
  const st = getState(player);
  if (st.infinity && tick % 2 === 0) infinityTick(player, st, tick);
  if (st.sixEyes && tick % 5 === 0) sixEyesTick(player, st, tick);
  if (tick % 4 === 0) {
    const held = heldItem(player);
    drawHud(player, st, held?.typeId, tick);
    if (tick % 20 === 0 && held && ITEM_BY_ID[held.typeId]) normalizeHeld(player);
  }
  if (st.transformed && tick % 10 === 0) auraTick(player);
  if (tick % 40 === 0) {
    refreshBuffs(player, st);
    // Safety net: a channel can never stay "busy" without its task.
    if (st.busy && !hasTask(player.id, "purple") && !hasTask(player.id, "domain")) st.busy = "";
  }
}

system.runInterval(() => {
  const tick = system.currentTick;
  runTasks(tick);
  let players;
  try {
    players = world.getAllPlayers();
  } catch (e) {
    logError("loop.players", e);
    return;
  }
  for (const player of players) {
    try {
      perPlayer(player, tick);
    } catch (e) {
      logError("loop.player", e);
    }
  }
  if (tick % 20 === 0) pruneTechniqueHits();
}, 1);

