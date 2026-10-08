// Magical Black Hole - entry point.
//  * Use the item            -> a black hole forms in front of you and swallows everything nearby
//  * Use it again            -> the black hole collapses and gives you everything it swallowed
//  * Sneak + use the item    -> settings menu
import { world, system, ItemStack } from "@minecraft/server";
import { ITEM_ID, ENTITY_ID, PLAYER_ACTIVE_KEY, GIFT_TAG, TUNING } from "./config.js";
import { Hole, holes, configFromSettings, findHoleOf, scanForHoles } from "./blackhole.js";
import { processDeliveries, giveItem } from "./delivery.js";
import { getSettings, openSettings } from "./settings.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** player id -> tick of their last use event (used to ignore held-button repeats) */
const lastUse = new Map();

/** Where a new black hole should appear: in front of the player, before any wall. @param {Player} player */
function spawnLocation(player) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  let distance = 6;
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
    if (hit) {
      const b = hit.block.location;
      const point = { x: b.x + hit.faceLocation.x, y: b.y + hit.faceLocation.y, z: b.z + hit.faceLocation.z };
      const dx = point.x - head.x;
      const dy = point.y - head.y;
      const dz = point.z - head.z;
      distance = Math.max(2.5, Math.sqrt(dx * dx + dy * dy + dz * dz) - 1.5);
    }
  } catch {
    // keep default distance
  }
  return { x: head.x + dir.x * distance, y: head.y + dir.y * distance, z: head.z + dir.z * distance };
}

/** @param {Player} player */
function createHole(player) {
  const settings = getSettings(player);
  const location = spawnLocation(player);
  let entity;
  try {
    entity = player.dimension.spawnEntity(ENTITY_ID, location);
  } catch (error) {
    player.sendMessage("§5[Black Hole]§r §cThe black hole can't form here.");
    console.warn(`[Black Hole] Spawn failed: ${error}`);
    return;
  }
  const hole = new Hole(entity);
  hole.ownerId = player.id;
  hole.ownerName = player.name;
  hole.config = configFromSettings(settings);
  hole.center = location;
  hole.setVisualSize(0);
  hole.save();
  holes.set(entity.id, hole);
  player.setDynamicProperty(PLAYER_ACTIVE_KEY, entity.id);

  hole.burst();
  hole.sound("mob.breeze.inhale", 1.5, 0.6);
  hole.sound("mob.warden.sonic_charge", 1.2, 0.8);
  hole.sound("beacon.activate", 1.5, 0.6);
  player.onScreenDisplay.setActionBar("§dA black hole has formed! §7Use again to recall it.");
}

/** @param {Player} player */
function onUse(player) {
  const now = system.currentTick;
  const previous = lastUse.get(player.id) ?? -1000;
  lastUse.set(player.id, now);
  // Holding the button (or tapping a block) fires several events: only react to a fresh press
  if (now - previous < TUNING.useDebounceTicks) return;

  if (player.isSneaking) {
    system.run(() => openSettings(player));
    return;
  }

  const hole = findHoleOf(player);
  if (hole) {
    if (!hole.collapse) {
      hole.beginCollapse("recalled", player.id);
      player.onScreenDisplay.setActionBar("§dYour black hole is collapsing...");
    }
    return;
  }

  try {
    const oldId = player.getDynamicProperty(PLAYER_ACTIVE_KEY);
    if (typeof oldId === "string" && oldId.length > 0) {
      player.sendMessage(
        "§5[Black Hole]§r §7Your last black hole is too far away to recall. It will return its contents when it evaporates near you."
      );
    }
  } catch {
    // ignore
  }
  createHole(player);
}

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== ITEM_ID) return;
  onUse(event.source);
});

// Tapping a block: cancel it (so chests and doors don't open) and handle it like a normal use.
// Before-events are read-only, so the real work runs on the next tick.
world.beforeEvents.itemUseOn.subscribe((event) => {
  if (event.itemStack?.typeId !== ITEM_ID) return;
  event.cancel = true;
  const player = event.source;
  system.run(() => {
    if (player.isValid()) onUse(player);
  });
});

// Every new player gets a free black hole the first time they join.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  const player = event.player;
  if (player.hasTag(GIFT_TAG)) return;
  system.runTimeout(() => {
    if (!player.isValid() || player.hasTag(GIFT_TAG)) return;
    giveItem(player, new ItemStack(ITEM_ID, 1));
    player.addTag(GIFT_TAG);
    player.sendMessage(
      "§5[Black Hole]§r §dYou received a Magical Black Hole!§r\n" +
        "§7- Use it to create a black hole that swallows everything nearby.\n" +
        "§7- Use it again to recall it and get everything it swallowed.\n" +
        "§7- Sneak + use it to open the settings."
    );
  }, 60);
});

system.runInterval(() => {
  for (const hole of [...holes.values()]) {
    try {
      hole.tick();
    } catch (error) {
      console.warn(`[Black Hole] Tick error: ${error}`);
    }
  }
  processDeliveries();
  if (system.currentTick % TUNING.rescanEntitiesEvery === 0) scanForHoles();
}, 1);
