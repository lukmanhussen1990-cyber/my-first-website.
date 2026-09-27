import { EquipmentSlot, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ITEM, PARTICLE, PROP, RUIN_TYPES, TUNING } from "./config.js";
import { allRuins, getRuin, nearestRuin } from "./registry.js";
import { cardinal, isCreativeLike, notify, particle, recentlyNotified, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./registry.js").Ruin} Ruin */

// Arrow index 0 = straight ahead, then clockwise (positive yaw = to the right).
const ARROWS = [
  ["↑", "ahead"], ["↗", "ahead right"], ["→", "right"], ["↘", "behind right"],
  ["↓", "behind"], ["↙", "behind left"], ["←", "left"], ["↖", "ahead left"],
];

/** @type {Map<string, number>} */
const lastUse = new Map();
/** @type {Map<string, number>} */
const lastMapOpen = new Map();
/** @type {Set<string>} */
const ringWorn = new Set();

/** @param {string} type */
function infoOf(type) {
  return RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
}

/** @param {Ruin} r */
function statusOf(r) {
  if (r.c) return "§aConquered";
  if (r.a) return "§cBoss awake";
  return "§4Unconquered";
}

/**
 * The ruin the compass points at: the tracked one, else the nearest
 * unconquered ruin, else the nearest ruin at all.
 * @param {Player} player
 */
export function compassTarget(player) {
  const dimId = player.dimension.id;
  const tracked = player.getDynamicProperty(PROP.track);
  if (typeof tracked === "number") {
    const r = getRuin(tracked);
    if (r && r.d === dimId) return r;
  }
  return nearestRuin(dimId, player.location, (r) => !r.c) ?? nearestRuin(dimId, player.location);
}

/**
 * Called every 10 ticks per player: held-item effects.
 * @param {Player} player
 */
export function itemTick(player) {
  const tick = system.currentTick;
  const eq = /** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */ (
    player.getComponent("minecraft:equippable"));
  if (!eq) return;
  const main = eq.getEquipment(EquipmentSlot.Mainhand)?.typeId;
  const off = eq.getEquipment(EquipmentSlot.Offhand)?.typeId;

  if (main === ITEM.ring || off === ITEM.ring) wearRing(player);
  else ringWorn.delete(player.id);

  if (main === ITEM.compass || off === ITEM.compass) showCompass(player);

  if (main === ITEM.map && player.isSneaking) {
    const t = lastMapOpen.get(player.id) ?? -1e9;
    if (tick - t > 40) {
      lastMapOpen.set(player.id, tick);
      openMap(player);
    }
  }
}

/** @param {Player} player */
function wearRing(player) {
  try {
    player.addEffect("speed", 40, { amplifier: TUNING.ringSpeedAmplifier, showParticles: false });
    const health = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
      player.getComponent("minecraft:health"));
    if (health && !isCreativeLike(player) && health.currentValue > TUNING.ringHealthCap) {
      health.setCurrentValue(TUNING.ringHealthCap);
    }
    if (!ringWorn.has(player.id)) {
      ringWorn.add(player.id);
      notify(player, "§5Cursed Ring: §a+Speed II §c-4 max hearts");
      player.playSound("mob.elderguardian.curse", { volume: 0.4, pitch: 1.4 });
    }
  } catch (e) {
    warn("ring", e);
  }
}

/** @param {Player} player */
function showCompass(player) {
  if (recentlyNotified(player)) return;
  const target = compassTarget(player);
  if (!target) {
    player.onScreenDisplay.setActionBar("§6Ruin Compass§7: the needle spins... explore jungles, deserts and oceans.");
    return;
  }
  const info = infoOf(target.t);
  const loc = player.location;
  const dx = target.x + 0.5 - loc.x;
  const dz = target.z + 0.5 - loc.z;
  const d = Math.hypot(dx, dz);
  if (d < 8) {
    player.onScreenDisplay.setActionBar(`§6You stand at the ${info.color}${info.name}§6 · ${statusOf(target)}`);
    return;
  }
  const targetYaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  let rel = targetYaw - player.getRotation().y;
  rel = ((rel % 360) + 540) % 360 - 180;
  const [arrow, words] = ARROWS[((Math.round(rel / 45) % 8) + 8) % 8];
  const dy = target.y - loc.y;
  const vertical = dy > 8 ? " §7(above)" : dy < -8 ? " §7(below)" : "";
  player.onScreenDisplay.setActionBar(
    `§e${arrow} ${info.color}${info.name} §f${Math.round(d)}m §7${words}${vertical}`);
}

/**
 * Tap/use the compass: a short particle trail toward the target.
 * @param {Player} player
 */
function pingCompass(player) {
  const target = compassTarget(player);
  const dim = player.dimension;
  if (!target) {
    player.playSound("random.fizz", { volume: 0.6, pitch: 1.2 });
    player.sendMessage("§7No ruins charted yet. Ruins chart themselves when you come within about 60 blocks.");
    return;
  }
  const head = player.getHeadLocation();
  const dx = target.x + 0.5 - head.x;
  const dz = target.z + 0.5 - head.z;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  for (let i = 1; i <= 6; i++) {
    particle(dim, PARTICLE.trail, { x: head.x + (dx / len) * i * 1.2, y: head.y - 0.3, z: head.z + (dz / len) * i * 1.2 });
  }
  player.playSound("note.chime", { volume: 0.8, pitch: 1.2 });
  const info = infoOf(target.t);
  player.sendMessage(`§6Ruin Compass§7 → ${info.color}${info.name}§7 at §fX ${target.x}, Z ${target.z}§7 (${Math.round(len)}m ${cardinal(head, target)}) ${statusOf(target)}`);
}

/**
 * Item used in the air, or on a block (mobile tap).
 * @param {Player} player
 * @param {string} itemId
 */
export function onItemUse(player, itemId) {
  if (itemId !== ITEM.compass && itemId !== ITEM.map) return;
  const now = system.currentTick;
  const t = lastUse.get(player.id) ?? -1e9;
  if (now - t < 15) return;
  lastUse.set(player.id, now);
  if (itemId === ITEM.compass) pingCompass(player);
  else openMap(player);
}

/**
 * Ancient Map: lists charted ruins and picks one for the compass to track.
 * @param {Player} player
 */
export function openMap(player) {
  const loc = player.location;
  const dimId = player.dimension.id;
  const all = allRuins().filter((r) => r.d === dimId);
  const list = all
    .map((r) => ({ r, d: Math.hypot(r.x - loc.x, r.z - loc.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  const tracked = player.getDynamicProperty(PROP.track);
  const trackedRuin = typeof tracked === "number" ? getRuin(tracked) : undefined;
  const conquered = all.filter((r) => r.c).length;
  let body = `§7Charted ruins: §f${all.length}§7 (conquered §a${conquered}§7)\n`;
  body += trackedRuin
    ? `§7Compass tracks: ${infoOf(trackedRuin.t).color}${infoOf(trackedRuin.t).name}§7 at X ${trackedRuin.x}, Z ${trackedRuin.z}\n`
    : "§7Compass tracks: §fnearest unconquered ruin\n";
  body += list.length ? "§7Choose a ruin to track:" : "§7No ruins charted yet. Explore jungles, deserts and oceans - ruins are charted when you get close.";
  const form = new ActionFormData().title("§l§6Ancient Map").body(body);
  for (const { r, d } of list) {
    const info = infoOf(r.t);
    form.button(`${info.color}${info.name}§r §8${Math.round(d)}m ${cardinal(loc, r)}\n${statusOf(r)} §8X ${r.x} Z ${r.z}`);
  }
  form.button("§8Track nearest ruin");
  form.button("§1Ruin lore & hints");
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    const i = res.selection;
    if (i < list.length) {
      const r = list[i].r;
      player.setDynamicProperty(PROP.track, r.id);
      player.playSound("item.book.page_turn");
      player.sendMessage(`§6Ruin Compass§7 now tracks the ${infoOf(r.t).color}${infoOf(r.t).name}§7 at §fX ${r.x}, Y ${r.y}, Z ${r.z}`);
    } else if (i === list.length) {
      player.setDynamicProperty(PROP.track, undefined);
      player.sendMessage("§6Ruin Compass§7 now points to the nearest unconquered ruin.");
    } else {
      showLore(player);
    }
  }).catch((e) => warn("map form", e));
}

/** @param {Player} player */
function showLore(player) {
  const text = [
    "§6Glyph puzzles§r: every ruin's mural shows four glyphs from left to right. Pull the levers (temple, ship) or step on the pressure plates (crypt) beside the matching glyph stones in that order to wake the altar.",
    "",
    "§cTraps§r: pressure plates on trap mechanisms fire arrow dispensers, cracked tiles collapse into pits, and green-glowing vents fill the room with poison gas.",
    "",
    "§5Guardians§r: Temple Guardians, Crypt Mummies and Drowned Captains protect the ruins.",
    "",
    "§4Bosses§r: the Jade Idol slams the ground, the Sand Pharaoh raises mummies in a sandstorm and the Abyssal Admiral drags you in with his undertow. They grow enraged at half health. Defeat one to open the vault beneath its altar.",
    "",
    "§dRelics§r: the Ruin Compass points to ruins, this Ancient Map charts them, and the Cursed Ring grants speed at the cost of four hearts (hold it in either hand).",
  ].join("\n");
  new ActionFormData().title("§l§6Ruin Lore").body(text).button("§8Back").show(player).then((res) => {
    if (!res.canceled) openMap(player);
  }).catch((e) => warn("lore form", e));
}

/** @param {string} playerId */
export function forgetItems(playerId) {
  lastUse.delete(playerId);
  lastMapOpen.delete(playerId);
  ringWorn.delete(playerId);
}
