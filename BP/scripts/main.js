// The Hollow Bride - entry point.
// One main loop at 10 ticks processing a single player per pass (round robin),
// one world loop at 20 ticks for the clock. Every handler is wrapped in safe().

import { world, system } from "@minecraft/server";
import { LOOP_TICKS, WORLD_LOOP_TICKS, PROPS, NOISE, ROOMS } from "./config.js";
import {
  safe,
  subscribeIfPresent,
  players,
  log,
  dist,
  distFlat,
  hint,
  sound,
  worldSound,
  titleCard,
  runCmd,
  entitiesOfType
} from "./util.js";
import {
  ensurePlayer,
  pget,
  pset,
  pnum,
  pbool,
  pstr,
  keyCount,
  getCheckpoint,
  setCheckpoint
} from "./state.js";
import { ensureBuilt, buildRuin } from "./build.js";
import {
  updateRoom,
  roomAt,
  tickCandle,
  tickNoise,
  addNoise,
  tickSanity,
  applySanityEffects,
  cullHallucinations,
  tickHiding,
  enterHiding,
  exitHiding,
  tickQuiet,
  sendToCheckpoint,
  heldItem,
  litWallCandleNear
} from "./systems.js";
import { tickAct, tickClock, onBlockTap, onItemUse, startDawn, onBrideDown, finishRun } from "./acts.js";
import { showSettings, confirmStay } from "./ui.js";

let loopCount = 0;
let rrIndex = 0;

// ---- Per player pass --------------------------------------------------------

function tickPlayer(player) {
  ensurePlayer(player);

  if (!pbool(player, "configured", false) && !pbool(player, "asking", false)) {
    pset(player, "asking", true);
    system.run(() => {
      showSettings(player)
        .catch(() => {})
        .then(() => {
          pset(player, "asking", false);
        });
    });
    return;
  }

  const room = updateRoom(player) || roomAt(player.location);

  if (tickHiding(player, loopCount)) {
    tickQuiet(player);
    tickAct(player, room, loopCount);
    return;
  }

  tickCandle(player, room);
  tickNoise(player);
  const s = tickSanity(player, room);
  applySanityEffects(player, s, room);
  cullHallucinations(player);
  tickQuiet(player);

  if (s <= 0 && pstr(player, "ending", "") === "") {
    sendToCheckpoint(player, "She found you the moment you broke.");
    return;
  }

  tickAct(player, room, loopCount);

  // Five keys in the attic opens the last act.
  if (keyCount(player) >= 5 && !pbool(player, "dawn_started", false)) {
    startDawn(player, buildRuin);
  }

  // The locked bedroom: the second ending.
  if (
    pnum(player, "act", 0) >= 7 &&
    pstr(player, "ending", "") === "" &&
    !pbool(player, "asking", false) &&
    dist(player.location, PROPS.stayRoom) < 2.0
  ) {
    pset(player, "asking", true);
    system.run(() => {
      confirmStay(player)
        .then((yes) => {
          pset(player, "asking", false);
          if (yes) finishRun(player, "stay");
        })
        .catch(() => {
          pset(player, "asking", false);
        });
    });
  }
}

// ---- Loops ------------------------------------------------------------------

function mainLoop() {
  loopCount++;
  const list = players();
  if (list.length === 0) return;
  // Round robin: exactly one player is processed per pass.
  rrIndex = (rrIndex + 1) % list.length;
  const p = list[rrIndex];
  if (!p) return;
  try {
    tickPlayer(p);
  } catch (e) {
    log("tickPlayer failed: " + (e && e.message ? e.message : e));
  }
}

function worldLoop() {
  tickClock(loopCount);
}

// ---- Events -----------------------------------------------------------------

function wireEvents() {
  subscribeIfPresent(
    world.afterEvents,
    "playerSpawn",
    (ev) => {
      const player = ev.player;
      if (!player) return;
      ensurePlayer(player);
      if (ev.initialSpawn) {
        runCmd(player, "fog @s remove ag_room");
        runCmd(player, "fog @s push ag:manor_fog ag_room");
        // A fresh world drops you at the vanilla spawn, nowhere near the manor.
        // If the build already finished, put them on the road to the gate.
        try {
          if (dist(player.location, PROPS.gate) > 200) {
            system.runTimeout(() => {
              try {
                player.teleport(getCheckpoint(player));
              } catch (e) {
                // ignore
              }
            }, 40);
          }
        } catch (e) {
          // ignore
        }
        if (!pbool(player, "configured", false)) {
          system.runTimeout(() => {
            if (pbool(player, "asking", false)) return;
            pset(player, "asking", true);
            showSettings(player)
              .catch(() => {})
              .then(() => pset(player, "asking", false));
          }, 60);
        }
        // Everyone always carries the escape hatch.
        runCmd(player, "give @s ag:manor_key 1");
        titleCard(player, "Vane Manor", "Tap the mailbox by the gate");
      } else {
        // Death respawn: straight back to the room checkpoint, inventory intact.
        const cp = getCheckpoint(player);
        system.runTimeout(() => {
          try {
            player.teleport(cp);
            pset(player, "sanity", 45);
            pset(player, "hiding", false);
            titleCard(player, "You wake at the door", "Nothing was taken");
          } catch (e) {
            // ignore
          }
        }, 10);
      }
    },
    "playerSpawn"
  );

  subscribeIfPresent(
    world.afterEvents,
    "itemUse",
    (ev) => {
      const player = ev.source;
      if (!player || !player.typeId || player.typeId !== "minecraft:player") return;
      onItemUse(player, ev.itemStack);
    },
    "itemUse"
  );

  subscribeIfPresent(
    world.afterEvents,
    "itemUseOn",
    (ev) => {
      const player = ev.source;
      if (!player || player.typeId !== "minecraft:player") return;
      handleTap(player, ev.block, ev.itemStack ? ev.itemStack.typeId : "");
    },
    "itemUseOn"
  );

  // Empty-hand taps. Present on newer runtimes only; harmless if absent.
  subscribeIfPresent(
    world.afterEvents,
    "playerInteractWithBlock",
    (ev) => {
      const player = ev.player;
      if (!player) return;
      if (ev.itemStack) return; // already handled by itemUseOn
      handleTap(player, ev.block, "");
    },
    "playerInteractWithBlock"
  );

  subscribeIfPresent(
    world.afterEvents,
    "playerBreakBlock",
    (ev) => {
      const player = ev.player;
      if (!player) return;
      addNoise(player, NOISE.breakBlock);
      sound(player, "ag.floor_creak", 0.8, 0.6);
    },
    "playerBreakBlock"
  );

  subscribeIfPresent(
    world.afterEvents,
    "entityHurt",
    (ev) => {
      const victim = ev.hurtEntity;
      if (!victim) return;
      if (victim.typeId !== "ag:hollow_bride") return;
      // Damage window: only while a candle burns beside her.
      if (litWallCandleNear(victim.location, 6)) return;
      try {
        const hp = victim.getComponent("minecraft:health");
        if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + ev.damage));
        worldSound("ag.candle_out", victim.location, 0.7, 0.8);
      } catch (e) {
        // ignore
      }
    },
    "entityHurt"
  );

  subscribeIfPresent(
    world.afterEvents,
    "entityDie",
    (ev) => {
      const dead = ev.deadEntity;
      if (!dead) return;
      if (dead.typeId === "ag:hollow_child") {
        for (const p of players()) {
          pset(p, "children_killed", pnum(p, "children_killed", 0) + 1);
        }
        worldSound("ag.child_giggle", dead.location, 0.7, 0.7);
        return;
      }
      if (dead.typeId === "ag:hollow_bride") {
        const list = players();
        if (list.length > 0) onBrideDown(list[0]);
        return;
      }
    },
    "entityDie"
  );

  subscribeIfPresent(
    world.afterEvents,
    "playerPlaceBlock",
    (ev) => {
      const player = ev.player;
      const block = ev.block;
      if (!player || !block) return;
      if (block.typeId !== "ag:salt_line") return;
      const left = pnum(player, "salt_left", 12);
      pset(player, "salt_left", Math.max(0, left - 1));
      sound(player, "ag.salt_place", 1.2, 0.8);
      hint(player, "Salt left: " + Math.max(0, left - 1));
    },
    "playerPlaceBlock"
  );
}

function handleTap(player, block, heldTypeId) {
  if (!block) return;
  try {
    const result = onBlockTap(player, block, heldTypeId);
    if (result === "exit_hide") {
      exitHiding(player);
      return;
    }
    if (result && typeof result === "object" && result.hide) {
      enterHiding(player, result.hide);
      return;
    }
    if (block.typeId && block.typeId.indexOf("door") !== -1) {
      addNoise(player, NOISE.door);
    }
  } catch (e) {
    log("tap failed: " + (e && e.message ? e.message : e));
  }
}

// ---- Boot -------------------------------------------------------------------

function boot() {
  log("booting");
  wireEvents();
  try {
    ensureBuilt();
  } catch (e) {
    log("build failed: " + (e && e.message ? e.message : e));
  }
  try {
    system.runInterval(safe(mainLoop, "mainLoop"), LOOP_TICKS);
    system.runInterval(safe(worldLoop, "worldLoop"), WORLD_LOOP_TICKS);
  } catch (e) {
    log("could not start loops: " + (e && e.message ? e.message : e));
  }
  log("ready");
}

system.run(safe(boot, "boot"));
