// Perfect Disguises - entry point (Minecraft Bedrock Script API).
// Targets @minecraft/server 1.10.0 and @minecraft/server-ui 1.1.0, which are
// stable in Bedrock 1.21.0 (including preview 1.21.0.26).
import { system, world } from "@minecraft/server";
import { BY_ID, BY_KEY, DISGUISES } from "./disguises.js";
import {
  WAND_ID,
  adoptDisguise,
  applyDisguise,
  cancelFuse,
  currentDisguise,
  dropState,
  getState,
  giveWand,
  mobSound,
  peekState,
  readVariant,
  refreshGameMode,
  removeDisguise,
  say,
  soundAt,
  tryRun,
  worldPlayers,
} from "./core.js";
import { onLightning, tickDisguise, useAbility } from "./abilities.js";
import { openMainMenu } from "./menu.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */

const PLAYER = "minecraft:player";

/**
 * Disguise of a player entity (undefined for other entities).
 * @param {Entity | undefined} entity
 */
function disguiseOf(entity) {
  if (!entity || entity.typeId !== PLAYER) return undefined;
  const state = peekState(entity.id);
  return state ? BY_ID.get(state.disguiseId) : undefined;
}

// ---------------------------------------------------------------------------
// Disguise Wand
// ---------------------------------------------------------------------------
/**
 * @param {Player} player
 * @param {import("@minecraft/server").ItemStack | undefined} itemStack
 */
function onWandUse(player, itemStack) {
  if (!player || !player.isValid()) return;
  const state = getState(player);
  const now = system.currentTick;
  if (now - state.lastWandUse < 10) return; // one tap can fire several events
  state.lastWandUse = now;
  tryRun(() => {
    const cooldown = /** @type {import("@minecraft/server").ItemCooldownComponent | undefined} */ (
      itemStack?.getComponent("minecraft:cooldown")
    );
    cooldown?.startCooldown(player);
  });

  const def = currentDisguise(player);
  if (def && def.ability && player.isSneaking) {
    useAbility(player, def);
    return;
  }
  system.run(() => {
    if (player.isValid()) openMainMenu(player).catch(() => {});
  });
}

world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId === WAND_ID) onWandUse(ev.source, ev.itemStack);
});

// Tapping a block with the wand (mobile players often do) also works.
world.afterEvents.itemUseOn.subscribe((ev) => {
  if (ev.itemStack?.typeId === WAND_ID) onWandUse(ev.source, ev.itemStack);
});

// ---------------------------------------------------------------------------
// Joining, dying, leaving
// ---------------------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  const player = ev.player;
  const initial = ev.initialSpawn;
  system.runTimeout(() => {
    if (!player.isValid()) return;
    const state = getState(player);
    if (initial) {
      refreshGameMode(player, state);
      adoptDisguise(player, readVariant(player));
      if (!player.hasTag("pd_wand_given")) {
        player.addTag("pd_wand_given");
        giveWand(player);
        say(player, "You got a §dDisguise Wand§r! Hold it and tap the screen (Use) to pick a mob disguise.");
      } else {
        const def = currentDisguise(player);
        if (def) say(player, `You are still disguised as a ${def.color}${def.name}§r.`);
      }
    } else if (state.died) {
      state.died = false;
      if (readVariant(player) !== 0 || state.disguiseId !== 0) {
        removeDisguise(player, { reason: "Your disguise fell apart when you died." });
      }
    }
  }, 5);
});

world.afterEvents.entityDie.subscribe(
  (ev) => {
    const player = /** @type {Player} */ (ev.deadEntity);
    const def = disguiseOf(player);
    if (!def) return;
    const state = getState(player);
    state.died = true;
    cancelFuse(player, state);
    mobSound(player, def, "death", 1);
  },
  { entityTypes: [PLAYER] }
);

world.beforeEvents.playerLeave.subscribe((ev) => {
  const id = ev.player.id;
  system.run(() => dropState(id));
});

// ---------------------------------------------------------------------------
// Combat hooks
// ---------------------------------------------------------------------------
world.afterEvents.entityHurt.subscribe(
  (ev) => {
    const player = /** @type {Player} */ (ev.hurtEntity);
    const def = disguiseOf(player);
    if (!def) return;
    if (ev.damageSource.cause === "lightning") onLightning(player, def);
    mobSound(player, def, "hurt", 1);
  },
  { entityTypes: [PLAYER] }
);

// Bee sting: melee hits poison the target.
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const def = disguiseOf(ev.damagingEntity);
  if (!def || !def.stings) return;
  const target = ev.hitEntity;
  if (!target || !target.isValid()) return;
  tryRun(() => target.addEffect("poison", 100, { amplifier: 0 }));
  soundAt(target.dimension, "mob.bee.sting", target.location, 0.8);
});

// Skeleton: arrows slow down whatever they hit (like a stray).
world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const def = disguiseOf(ev.source);
  if (!def || !def.slowArrows) return;
  if (tryRun(() => ev.projectile.typeId) !== "minecraft:arrow") return;
  const target = tryRun(() => ev.getEntityHit()?.entity);
  if (target && target.isValid()) tryRun(() => target.addEffect("slowness", 60, { amplifier: 0 }));
});

// Undead disguises shrug off poison (and zombies ignore hunger).
world.beforeEvents.effectAdd.subscribe((ev) => {
  const def = disguiseOf(ev.entity);
  if (!def || !def.immuneTo) return;
  const id = ev.effectType.replace("minecraft:", "");
  if (def.immuneTo.includes(id)) ev.cancel = true;
});

// ---------------------------------------------------------------------------
// Commands:  /scriptevent pd:disguise <mob>   pd:remove   pd:menu   pd:ability   pd:give_wand
// (also wrapped by the functions in functions/pd/)
// ---------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe(
  (ev) => {
    const source = ev.sourceEntity;
    if (!source || source.typeId !== PLAYER) return;
    const player = /** @type {Player} */ (source);
    switch (ev.id) {
      case "pd:disguise": {
        const def = BY_KEY.get(ev.message.trim().toLowerCase());
        if (def) applyDisguise(player, def);
        else say(player, "Unknown mob. Use one of: " + DISGUISES.map((d) => d.key).join(", "));
        break;
      }
      case "pd:remove":
        removeDisguise(player);
        break;
      case "pd:menu":
        openMainMenu(player).catch(() => {});
        break;
      case "pd:ability":
        useAbility(player, currentDisguise(player));
        break;
      case "pd:give_wand":
        giveWand(player);
        break;
    }
  },
  { namespaces: ["pd"] }
);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let errorsReported = 0;

/**
 * @param {Player} player
 * @param {number} tick
 */
function tickPlayer(player, tick) {
  const state = getState(player);
  if (!state.synced) {
    refreshGameMode(player, state);
    adoptDisguise(player, readVariant(player));
  }

  if ((tick + state.phase) % 20 === 0) {
    refreshGameMode(player, state);
    if (!state.verifyAt) {
      const variant = readVariant(player);
      if (variant !== state.disguiseId) adoptDisguise(player, variant);
    }
  }

  if (state.verifyAt && tick >= state.verifyAt) {
    state.verifyAt = 0;
    const variant = readVariant(player);
    if (variant !== state.disguiseId) {
      // Unchanged saved data means our player.json is not the one in use.
      if (variant === state.verifyFrom && !state.warnedConflict) {
        state.warnedConflict = true;
        say(
          player,
          "§cThe disguise could not be applied.§r Another add-on is probably changing the player too. " +
            "Move §dPerfect Disguises§r to the TOP of both your Behavior Pack and Resource Pack lists."
        );
      }
      adoptDisguise(player, variant);
    }
  }

  const def = BY_ID.get(state.disguiseId);
  if (def) tickDisguise(player, def, state, tick);
}

system.runInterval(() => {
  const tick = system.currentTick;
  for (const player of worldPlayers()) {
    try {
      tickPlayer(player, tick);
    } catch (error) {
      if (errorsReported++ < 5) console.warn("[Perfect Disguises] " + error);
    }
  }
}, 1);
