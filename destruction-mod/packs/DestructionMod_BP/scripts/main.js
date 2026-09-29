// @ts-check
// Destruction Mod - entry point. Wires item use, first-join kit, script events
// and the "where will it hit" read-out shown while holding a weapon.
import { EquipmentSlot, Player, system, world } from "@minecraft/server";
import { KIT_TAG, MARKER_ID, TABLET_ID, WEAPON_BY_ID, modeLabel } from "./config.js";
import { giveKit } from "./kit.js";
import { stopAll } from "./scheduler.js";
import { loadSettings, weaponPrefs } from "./settings.js";
import { isReady, launchStrike } from "./strike.js";
import { aimTarget, clearMarker, getMarker, resolveTarget } from "./targeting.js";
import { markHere, openTablet, weaponSettings } from "./ui.js";
import { dist, fmt, notify, particle, quietUntil, tell, title } from "./util.js";

/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").EntityEquippableComponent} EntityEquippableComponent */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("./config.js").Weapon} Weapon */

/** @param {Promise<unknown>} promise */
function background(promise) {
  promise.catch((e) => console.warn(`[Destruction Mod] ${e}`));
}

// ---------------------------------------------------------------- item use
/** @param {Player} player @param {Weapon} w @param {ItemStack} item */
async function fireWeapon(player, w, item) {
  if (!isReady(player, w)) return;
  const s = loadSettings(player);
  const { mode, power } = weaponPrefs(s, w.id);
  const target = await resolveTarget(player, mode, s.range);
  if (!target || !player.isValid() || !isReady(player, w, false)) return;
  launchStrike(player, w, target, power, s, item);
}

/** @param {Player} player */
function useMarker(player) {
  if (player.isSneaking) {
    clearMarker(player);
    notify(player, "§7Marker cleared");
    return;
  }
  background(markHere(player, loadSettings(player).range, false));
}

/** player id -> tick of their last use event (one tap can fire both use events) */
const lastUse = new Map();

/** @param {Player} player @param {ItemStack | undefined} item */
function onUse(player, item) {
  if (!item || !item.typeId.startsWith("destruct:")) return;
  const now = system.currentTick;
  const prev = lastUse.get(player.id) ?? -100;
  lastUse.set(player.id, now);
  if (now - prev < 6) return;

  if (item.typeId === TABLET_ID) return background(openTablet(player));
  if (item.typeId === MARKER_ID) return useMarker(player);
  const w = WEAPON_BY_ID.get(item.typeId);
  if (!w) return;
  if (player.isSneaking) background(weaponSettings(player, w));
  else background(fireWeapon(player, w, item));
}

world.afterEvents.itemUse.subscribe((ev) => onUse(ev.source, ev.itemStack));
world.afterEvents.itemUseOn.subscribe((ev) => onUse(ev.source, ev.itemStack));

// Depending on the item and the game version, only the "before" variant of a
// use event may fire. Before-events are read-only, so handle them next tick;
// the 6-tick guard in onUse makes one tap count exactly once either way.
/** @param {{source: Player, itemStack: ItemStack}} ev */
function onUseBefore(ev) {
  const { source, itemStack } = ev;
  if (itemStack.typeId.startsWith("destruct:")) system.run(() => onUse(source, itemStack));
}
world.beforeEvents.itemUse.subscribe(onUseBefore);
world.beforeEvents.itemUseOn.subscribe(onUseBefore);

// ---------------------------------------------------------------- first join
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const player = ev.player;
  system.runTimeout(() => {
    if (!player.isValid()) return;
    if (player.hasTag(KIT_TAG)) {
      tell(player, "§c[Destruction Mod]§7 ready - tap the §aDestruction Tablet§7 for the menu.");
      return;
    }
    giveKit(player);
    player.addTag(KIT_TAG);
    title(player, "§l§cDESTRUCTION MOD", "§fYour weapons are in your inventory!");
    tell(player, "§l§c[Destruction Mod]§r §fYou got the §aDestruction Tablet§f, the §2Target Marker§f and §e10 weapons§f.");
    tell(player, "§7- §fTap§7 a weapon: it hits where you look.");
    tell(player, "§7- §fSneak + tap§7 a weapon: choose §fWHERE§7 it hits and the power.");
    tell(player, "§7- §fTap the tablet§7: full menu, settings and STOP ALL.");
  }, 60);
});

// ---------------------------------------------------------------- /scriptevent
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const player = ev.sourceEntity instanceof Player ? ev.sourceEntity : undefined;
  switch (ev.id) {
    case "destruct:kit":
      for (const p of player ? [player] : world.getAllPlayers()) giveKit(p);
      break;
    case "destruct:stop":
      world.sendMessage(`§c[Destruction Mod]§7 stopped ${stopAll()} running effect(s).`);
      break;
    case "destruct:menu":
      if (player) background(openTablet(player));
      break;
  }
});

// ---------------------------------------------------------------- aim read-out
/** @param {Player} player @returns {ItemStack | undefined} */
function heldItem(player) {
  try {
    const eq = /** @type {EntityEquippableComponent | undefined} */ (player.getComponent("minecraft:equippable"));
    return eq?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

/** @param {Player} player @param {{dim: Dimension, pos: Vector3} | undefined} m */
function showMarker(player, m) {
  if (!m || m.dim.id !== player.dimension.id || dist(player.location, m.pos) > 128) return;
  for (let h = 0; h < 4; h++) particle(m.dim, "minecraft:endrod", { x: m.pos.x, y: m.pos.y + h * 0.8, z: m.pos.z });
}

/** @param {Player} player @param {string} text */
function bar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // left
  }
}

let pulse = 0;
system.runInterval(() => {
  pulse++;
  for (const player of world.getAllPlayers()) {
    const item = heldItem(player);
    if (!item) continue;
    const w = WEAPON_BY_ID.get(item.typeId);
    if (!w && item.typeId !== MARKER_ID) continue;
    if ((quietUntil.get(player.id) ?? 0) > system.currentTick) continue;
    const s = loadSettings(player);

    if (!w) {
      const t = aimTarget(player, s.range, false);
      if (t) particle(t.dim, "minecraft:villager_happy", { x: t.pos.x, y: t.pos.y + 0.3, z: t.pos.z });
      if (pulse % 3 === 0) showMarker(player, getMarker(player));
      bar(player, `§2Target Marker §8| §7tap: mark ${t ? `§f${t.label}` : "§c(nothing in range)"} §8| §7sneak+tap: clear`);
      continue;
    }

    const { mode, power } = weaponPrefs(s, w.id);
    let where;
    if (mode === "look") {
      const t = aimTarget(player, s.range, false);
      if (t) {
        particle(t.dim, "minecraft:villager_happy", { x: t.pos.x, y: t.pos.y + 0.3, z: t.pos.z });
        where = `§f${t.label} §7(${Math.round(dist(player.location, t.pos))}m)`;
      } else {
        where = "§cnothing in range";
      }
    } else if (mode === "marker") {
      const m = getMarker(player);
      if (pulse % 3 === 0) showMarker(player, m);
      where = m ? `§fmarker ${fmt(m.pos)}` : "§cno marker set";
    } else {
      where = `§f${modeLabel(mode)}`;
    }
    bar(player, `${w.color}${w.name} §8| §7hits: ${where} §8| §7power §f${power} §8| §7sneak+tap: change`);
  }
}, 4);
