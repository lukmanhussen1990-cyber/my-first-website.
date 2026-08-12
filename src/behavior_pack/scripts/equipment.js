/**
 * Protective equipment and the handheld devices.
 *
 * Item use is detected two ways on purpose. `itemUse` is the real event, but
 * tapping thin air is awkward on a touchscreen, so holding the device and
 * sneaking triggers the same action. Both paths share one debounce.
 */

import { system, world } from "@minecraft/server";
import { playerState, runCmd } from "./state.js";
import {
  addInfection,
  countInfectedNear,
  nestsNear,
  sampleContamination,
  setInfection,
  spawnSpores,
} from "./infection.js";
import { getGlobal } from "./state.js";
import { detectorReadout, scanReadout } from "./ui.js";

const USE_DEBOUNCE_TICKS = 8;

const COOLDOWNS = {
  "myc:scanner": 40,
  "myc:contamination_detector": 60,
  "myc:medkit": 200,
  "myc:suppressant": 200,
  "myc:biofilter": 100,
};

function onCooldown(record, id, currentTick) {
  const ready = record.cooldowns.get(id) ?? 0;
  if (currentTick < ready) return true;
  record.cooldowns.set(id, currentTick + (COOLDOWNS[id] ?? 20));
  return false;
}

// ------------------------------------------------------------ inventory ---

function heldSlot(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory?.container) return undefined;
    const slot = player.selectedSlot ?? 0;
    return { container: inventory.container, slot };
  } catch {
    return undefined;
  }
}

export function heldItem(player) {
  const held = heldSlot(player);
  if (!held) return undefined;
  try {
    return held.container.getItem(held.slot);
  } catch {
    return undefined;
  }
}

function consumeHeld(player) {
  const held = heldSlot(player);
  if (!held) return;
  try {
    const item = held.container.getItem(held.slot);
    if (!item) return;
    if (item.amount > 1) {
      item.amount -= 1;
      held.container.setItem(held.slot, item);
    } else {
      held.container.setItem(held.slot, undefined);
    }
  } catch {
    /* inventory changed under us */
  }
}

/** Best-effort wear on the handheld devices; not worth failing a scan over. */
function wearHeld(player, amount) {
  const held = heldSlot(player);
  if (!held) return;
  try {
    const item = held.container.getItem(held.slot);
    const durability = item?.getComponent("minecraft:durability");
    if (!durability) return;
    durability.damage = Math.min(durability.maxDurability, durability.damage + amount);
    held.container.setItem(held.slot, item);
  } catch {
    /* component shape differs; skip wear */
  }
}

// -------------------------------------------------------------- devices ---

function compassOf(dx, dz) {
  const dirs = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];
  const index = ((Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) % 8) + 8) % 8;
  return dirs[index];
}

export function runScan(player) {
  const record = playerState(player);
  const dimension = player.dimension;
  const { score } = sampleContamination(dimension, player.location, 6, 3);
  const infectedNearby = countInfectedNear(dimension, player.location, 24);
  const nests = nestsNear(dimension, player.location, 48);

  player.sendMessage(
    scanReadout({
      infection: record.infection,
      contamination: score,
      nearbyInfected: infectedNearby,
      nestCount: nests.length,
      outbreak: getGlobal("outbreak") === 1,
      level: getGlobal("level"),
      day: getGlobal("day"),
    })
  );

  const alarming = record.infection >= 40 || score >= 14 || infectedNearby >= 4;
  try {
    player.playSound(alarming ? "myc.scanner.alert" : "myc.scanner.ping", {
      volume: 0.8,
      pitch: alarming ? 0.8 : 1.2,
    });
  } catch {}
  spawnSpores(player, 3);
}

function runDetector(player) {
  const dimension = player.dimension;
  const { score, sampled } = sampleContamination(dimension, player.location, 12, 4);
  const nests = nestsNear(dimension, player.location, 64);

  let nearest;
  let best = Infinity;
  for (const nest of nests) {
    const dx = nest.location.x - player.location.x;
    const dz = nest.location.z - player.location.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < best) {
      best = distance;
      nearest = { distance: Math.round(distance), direction: compassOf(dx, dz) };
    }
  }

  player.sendMessage(
    detectorReadout({ contamination: score, nearest, nestCount: nests.length, blocksSampled: sampled })
  );
  try {
    player.playSound("myc.scanner.ping", { volume: 0.7, pitch: nearest ? 0.9 : 1.5 });
  } catch {}
}

function useMedkit(player) {
  const record = playerState(player);
  if (record.infection <= 0) {
    player.sendMessage("§7You are not infected. The kit stays sealed.");
    record.cooldowns.delete("myc:medkit");
    return;
  }
  addInfection(player, -25);
  player.addEffect("regeneration", 120, { amplifier: 1, showParticles: true });
  try {
    player.removeEffect("wither");
  } catch {}
  consumeHeld(player);
  player.sendMessage(
    `§a[MEDKIT] §7Antifungal course administered. Infection now §f${Math.round(record.infection)}%§7.`
  );
  try {
    player.playSound("myc.cure", { volume: 0.9, pitch: 1.0 });
  } catch {}
}

function useSuppressant(player) {
  const record = playerState(player);
  addInfection(player, -40);
  record.immuneUntil = system.currentTick + 1200; // 60s of total immunity
  player.addEffect("resistance", 600, { amplifier: 0, showParticles: false });
  consumeHeld(player);
  player.sendMessage(
    `§b[SUPPRESSANT] §7Mycelium-X suppressed for 60s. Infection now §f${Math.round(
      record.infection
    )}%§7.`
  );
  try {
    player.playSound("myc.cure", { volume: 0.9, pitch: 1.3 });
  } catch {}
}

function useBiofilter(player) {
  const record = playerState(player);
  if (!record.masked) {
    player.sendMessage("§7Fit a §fSpore Mask§7 before changing its filter.");
    record.cooldowns.delete("myc:biofilter");
    return;
  }
  record.filterUntil = system.currentTick + 2400; // 120s of near-total airborne filtering
  consumeHeld(player);
  player.sendMessage("§a[BIOFILTER] §7Fresh cartridge fitted — airborne protection at maximum.");
  try {
    player.playSound("myc.scanner.ping", { volume: 0.6, pitch: 0.7 });
  } catch {}
}

// --------------------------------------------------------------- routing --

const HANDLERS = {
  "myc:scanner": (player) => {
    runScan(player);
    wearHeld(player, 1);
  },
  "myc:contamination_detector": (player) => {
    runDetector(player);
    wearHeld(player, 1);
  },
  "myc:medkit": useMedkit,
  "myc:suppressant": useSuppressant,
  "myc:biofilter": useBiofilter,
};

function dispatch(player, typeId, currentTick) {
  const handler = HANDLERS[typeId];
  if (!handler) return;
  const record = playerState(player);
  if (currentTick - record.lastUse < USE_DEBOUNCE_TICKS) return;
  record.lastUse = currentTick;
  if (onCooldown(record, typeId, currentTick)) {
    player.onScreenDisplay.setActionBar("§8Device recharging...");
    return;
  }
  handler(player);
}

export function registerItemHooks() {
  world.afterEvents.itemUse.subscribe((event) => {
    try {
      const player = event.source;
      if (!player || player.typeId !== "minecraft:player") return;
      dispatch(player, event.itemStack?.typeId, system.currentTick);
    } catch {
      /* ignore */
    }
  });
}

/** Sneak-to-use fallback, polled with the one-second loop. */
export function tickSneakUse(players) {
  for (const player of players) {
    try {
      if (!player.isSneaking) continue;
      const item = heldItem(player);
      if (!item) continue;
      if (item.typeId !== "myc:scanner" && item.typeId !== "myc:contamination_detector") continue;
      dispatch(player, item.typeId, system.currentTick);
    } catch {
      /* player left */
    }
  }
}

/**
 * Worn-armour detection.
 *
 * `hasitem` in a selector is the version-proof way to ask what a player is
 * wearing — the equippable script component has changed shape across releases,
 * this has not. Two commands per refresh, every two seconds.
 */
export function refreshProtection(players) {
  runCmd("tag @a remove myc_masked");
  runCmd("tag @a[hasitem={item=myc:spore_mask,location=slot.armor.head}] add myc_masked");
  runCmd("tag @a remove myc_suited");
  runCmd("tag @a[hasitem={item=myc:protective_suit,location=slot.armor.chest}] add myc_suited");

  for (const player of players) {
    try {
      const record = playerState(player);
      record.masked = player.hasTag("myc_masked");
      record.suited = player.hasTag("myc_suited");
    } catch {
      /* player left */
    }
  }
}

export function cure(player) {
  setInfection(player, 0);
  try {
    player.removeEffect("wither");
  } catch {}
  player.sendMessage("§a[MYCELIUM-X] §7Infection cleared.");
}
