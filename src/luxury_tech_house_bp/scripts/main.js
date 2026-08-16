/*
 * Luxury Tech House - entry point.
 *
 * Target: Minecraft Bedrock 1.21.0 (Android friendly), @minecraft/server 1.11.0
 * and @minecraft/server-ui 1.2.0, both stable modules - no experimental toggles
 * are required to run this add-on.
 *
 * Responsibilities here are deliberately thin: resolve the block palette for
 * whatever the device actually supports, run the build when the Builder is
 * used, restore the smart-home systems for an estate that already exists, and
 * route block interactions to the estate.
 */

import { world, system } from "@minecraft/server";
import { STATE_KEY, TUNE, SFX, resolvePalette } from "./config.js";
import { CommandQueue, Builder } from "./builder.js";
import { describeEstate, tickingClaims } from "./plan.js";
import { emitBuild } from "./blueprint.js";
import { Estate, furnish } from "./systems.js";
import { mainPanel, printStatus } from "./ui.js";
import { blockExists, defer, safe, say, soundAt, titleNear } from "./util.js";

const ITEM_BUILDER = "lux:house_builder";
const ITEM_REMOTE = "lux:tech_remote";

/** @type {Estate | undefined} */
let estate;
let building = false;
const lastUse = new Map();
const recentActions = new Map();

/* ------------------------------------------------------------------ *
 * Palette resolution
 * ------------------------------------------------------------------ */

let paletteReady = false;

function ensurePalette() {
  if (paletteReady) return;
  paletteReady = true;
  const swapped = resolvePalette(blockExists);
  if (swapped.length > 0) {
    console.warn(
      `[LuxuryTechHouse] substituted ${swapped.length} block id(s): ${swapped.join("; ")}`
    );
  }
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

function saveState() {
  if (!estate) return;
  safe(() => world.setDynamicProperty(STATE_KEY, JSON.stringify(estate.serialize())));
}

function loadState() {
  const raw = safe(() => world.getDynamicProperty(STATE_KEY), undefined);
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  return safe(() => JSON.parse(raw), undefined);
}

function restore() {
  if (estate) return true;
  const saved = loadState();
  if (!saved || !Array.isArray(saved.o)) return false;
  ensurePalette();
  const origin = { x: saved.o[0], y: saved.o[1], z: saved.o[2] };
  const dimensionId = saved.d ?? "minecraft:overworld";
  const spec = describeEstate(origin, dimensionId);
  estate = new Estate(spec, saved);
  estate.attach();
  return true;
}

/* ------------------------------------------------------------------ *
 * Building
 * ------------------------------------------------------------------ */

function tickingArea(dimension, name, from, to) {
  safe(() => dimension.runCommand(`tickingarea remove ${name}`));
  safe(() =>
    dimension.runCommand(
      `tickingarea add ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${name}`
    )
  );
}

function buildEstate(player) {
  if (building) {
    say(player, "§eThe estate is already under construction.");
    return;
  }
  ensurePalette();

  const dimension = player.dimension;
  const feet = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };

  if (feet.y < TUNE.MIN_ORIGIN_Y || feet.y > TUNE.MAX_ORIGIN_Y) {
    say(
      player,
      `§cStand between Y=${TUNE.MIN_ORIGIN_Y} and Y=${TUNE.MAX_ORIGIN_Y} first - the estate ` +
        "digs 20 blocks down for the garage and command centre, and rises 27 above you."
    );
    return;
  }

  // The player ends up on the driveway, looking at the entrance.
  const origin = { x: feet.x - 32, y: feet.y, z: feet.z - 4 };
  const spec = describeEstate(origin, dimension.id);

  /* Keep the whole lot and the escape tunnel loaded for the duration, or the
   * far corners quietly refuse to build on a device with a short sim distance. */
  for (const claim of tickingClaims(origin)) {
    tickingArea(dimension, claim.name, claim.from, claim.to);
  }
  safe(() => dimension.runCommand("gamerule sendcommandfeedback false"));

  const queue = new CommandQueue(dimension, TUNE.BUILD_RATE);
  const builder = new Builder(origin, queue);
  /* A throw in here used to be swallowed by the event handler's safe(), which
   * looked exactly like the Builder doing nothing at all. Say so instead. */
  try {
    emitBuild(spec, builder);
  } catch (error) {
    say(player, "§cThe blueprint could not be generated, so nothing was placed.");
    console.warn(`[LuxuryTechHouse] emitBuild failed: ${error}`);
    return;
  }

  building = true;
  const total = queue.commands.length;
  say(player, `§b§lLuxury Tech House §r§7- placing ${total} operations...`);

  let lastPercent = -1;
  queue.start(
    (done) => {
      const percent = Math.floor((done / total) * 20) * 5;
      if (percent === lastPercent) return;
      lastPercent = percent;
      safe(() =>
        player.onScreenDisplay.setActionBar(
          `§b▰ §fBuilding Luxury Tech House §7${percent}%`
        )
      );
    },
    () => {
      building = false;
      safe(() => dimension.runCommand("gamerule sendcommandfeedback true"));
      safe(() => dimension.runCommand("tickingarea remove lux_estate"));
      safe(() => dimension.runCommand("tickingarea remove lux_tunnel"));

      /* Nothing placed at all means the world is refusing commands outright -
       * almost always cheats being off. Without this the player just watched a
       * progress bar fill up over empty ground with no explanation. */
      if (queue.ok === 0) {
        say(player, "§c§lBuild failed §r§c- none of the block commands were allowed to run.");
        say(
          player,
          "§7This add-on builds the mansion with §f/fill§7, so the world needs " +
            "§fCheats§7 (Settings §8>§7 Game §8>§7 Activate Cheats) switched on. " +
            "Turn it on, then use the Builder again."
        );
        console.warn(
          `[LuxuryTechHouse] every command failed: ${queue.failures.join(" | ")}`
        );
        return;
      }

      if (estate) estate.detach();
      furnish(spec);
      estate = new Estate(spec);
      estate.attach();
      saveState();

      // Land on the validated driveway spot rather than a hand-guessed offset.
      const arrival = spec.teleports[0];
      safe(() =>
        player.teleport(
          { x: arrival.x + 0.5, y: arrival.y, z: arrival.z + 0.5 },
          { dimension }
        )
      );
      titleNear(
        dimension.id,
        spec.centre,
        "§b§lLUXURY TECH HOUSE",
        "§7Smart systems online - walk up to any door"
      );
      soundAt(dimension.id, spec.centre, SFX.BUILD_DONE, {
        volume: 1,
        pitch: 1,
        range: 90,
      });
      say(player, "§7Take a §bMansion Tech Remote§7 from the creative inventory to open the control panel.");
      if (queue.failed > 0) {
        say(
          player,
          `§e${queue.failed} of ${total} operations did not run - part of the estate may be missing. ` +
            "§7Usually that means the lot ran past the loaded area; try again on open, flat ground."
        );
        console.warn(
          `[LuxuryTechHouse] ${queue.failed} command(s) failed: ${queue.failures.join(" | ")}`
        );
      }
    }
  );
}

/* ------------------------------------------------------------------ *
 * Interaction routing
 * ------------------------------------------------------------------ */

/**
 * Buttons deliver both a buttonPush and an interact event, and some devices
 * only deliver one of them. Both paths are handled and de-duplicated on a
 * short window so a toggle never fires twice for one tap.
 */
function fireAction(action, player, key) {
  const now = system.currentTick;
  const previous = recentActions.get(key);
  if (previous !== undefined && now - previous < 8) return;
  recentActions.set(key, now);
  if (recentActions.size > 64) recentActions.clear();
  if (estate) {
    estate.dispatch(action, player);
    saveState();
  }
}

/**
 * One debounce for every route into the tools below. A single tap can arrive
 * as an itemUse, an itemUseOn and a playerInteractWithBlock all at once, and
 * which of those a device sends depends on whether the tap landed on a block,
 * so all of them are wired up and the duplicates are dropped here.
 */
function once(player, kind) {
  const key = `${player.id}:${kind}`;
  const now = system.currentTick;
  if (now - (lastUse.get(key) ?? -100) < 10) return false;
  lastUse.set(key, now);
  if (lastUse.size > 64) lastUse.clear();
  return true;
}

function tryBuild(player) {
  if (!once(player, "build")) return;
  buildEstate(player);
}

function openRemote(player) {
  if (!once(player, "remote")) return;
  if (!restore()) {
    say(
      player,
      "§eNo estate yet. Hold the §bLuxury Tech House Builder§e and tap the ground on an open, flat area."
    );
    return;
  }
  defer(() => {
    try {
      mainPanel(player, estate);
    } catch {
      printStatus(player, estate);
    }
  });
}

/** Route a held tool to its handler. Returns true when the item was ours. */
function routeTool(id, player) {
  if (id === ITEM_BUILDER) {
    tryBuild(player);
    return true;
  }
  if (id === ITEM_REMOTE) {
    openRemote(player);
    return true;
  }
  return false;
}

/* Used in mid-air: the long-press that desktop calls "right click". */
safe(() =>
  world.afterEvents.itemUse.subscribe((event) => {
    safe(() => routeTool(event.itemStack?.typeId, event.source));
  })
);

/* Used on a block. This is what a tap on the ground actually delivers on a
 * touchscreen, and it was the missing route: holding the Builder and tapping
 * the floor - the obvious thing to do on a phone - reached nothing at all. */
safe(() =>
  world.afterEvents.itemUseOn.subscribe((event) => {
    safe(() => routeTool(event.itemStack?.typeId, event.source));
  })
);

/* Last-resort manual trigger: /scriptevent lux:build */
safe(() =>
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    safe(() => {
      if (event.id !== "lux:build") return;
      const player = event.sourceEntity;
      if (player?.typeId !== "minecraft:player") return;
      tryBuild(player);
    });
  })
);

safe(() =>
  world.afterEvents.buttonPush.subscribe((event) => {
    safe(() => {
      if (!estate) return;
      const l = event.block.location;
      const action = estate.actionAt(l.x, l.y, l.z);
      if (!action) return;
      fireAction(action, event.source, `${l.x},${l.y},${l.z}`);
    });
  })
);

safe(() =>
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    /* Tools win over estate triggers, and over whatever the block itself would
     * normally do, so tapping any surface with a tool in hand always works. */
    const held = event.itemStack?.typeId;
    if (held === ITEM_BUILDER || held === ITEM_REMOTE) {
      event.cancel = true;
      const holder = event.player;
      defer(() => routeTool(held, holder));
      return;
    }
    if (!estate) return;
    const l = event.block.location;
    const action = estate.actionAt(l.x, l.y, l.z);
    if (!action) return;
    // Hidden triggers are ordinary blocks; swallow their normal behaviour so a
    // lectern or flower pot opens the wall instead of opening its own screen.
    const isButton = event.block.typeId.endsWith("_button");
    if (!isButton) event.cancel = true;
    const player = event.player;
    defer(() => fireAction(action, player, `${l.x},${l.y},${l.z}`));
  })
);

safe(() =>
  world.afterEvents.playerSpawn.subscribe((event) => {
    safe(() => {
      ensurePalette();
      restore();
      if (!event.initialSpawn) return;
      say(
        event.player,
        "§b§lLuxury Tech House §r§7loaded. Grab the §bLuxury Tech House Builder§7 " +
          "from the creative inventory (Construction tab) and tap the ground with it " +
          "on a flat, open area."
      );
    });
  })
);

system.run(() => {
  safe(() => {
    ensurePalette();
    restore();
  });
});
