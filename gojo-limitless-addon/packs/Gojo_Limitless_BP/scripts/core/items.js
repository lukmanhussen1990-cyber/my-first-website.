import { EquipmentSlot, ItemStack } from "@minecraft/server";
import { ITEMS, ITEM_BY_ID, LOADOUT } from "../data/abilities.js";
import { logError } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Container} Container */

const LOADOUT_IDS = new Set(LOADOUT.map((k) => ITEMS[k].id));

/**
 * A Gojo item with its description lore, kept on death.
 * @param {string} key
 */
export function makeItem(key) {
  const def = ITEMS[key];
  const stack = new ItemStack(def.id, 1);
  try {
    stack.setLore(def.lore);
    stack.keepOnDeath = true;
  } catch (e) {
    logError("items.make", e);
  }
  return stack;
}

/** @param {Player} player @returns {Container | undefined} */
export function inventoryOf(player) {
  try {
    const inv = /** @type {import("@minecraft/server").EntityInventoryComponent | undefined} */ (
      player.getComponent("minecraft:inventory")
    );
    return inv?.container;
  } catch {
    return undefined;
  }
}

/** @param {Player} player */
export function equippableOf(player) {
  try {
    return /** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */ (
      player.getComponent("minecraft:equippable")
    );
  } catch {
    return undefined;
  }
}

/** @param {Player} player @returns {import("@minecraft/server").ItemStack | undefined} */
export function heldItem(player) {
  try {
    return equippableOf(player)?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

/**
 * Give items created from the creative menu their lore + keep-on-death,
 * without replacing the stack (no hand re-equip animation).
 * @param {Player} player
 */
export function normalizeHeld(player) {
  try {
    const slot = equippableOf(player)?.getEquipmentSlot(EquipmentSlot.Mainhand);
    if (!slot || !slot.hasItem()) return;
    const def = ITEM_BY_ID[slot.typeId];
    if (!def) return;
    if (slot.getLore().length === 0) slot.setLore(def.lore);
    if (!slot.keepOnDeath) slot.keepOnDeath = true;
  } catch {
    // slot changed mid-tick; try again next pass
  }
}

/**
 * Put the nine techniques on the hotbar in canonical order. Whatever the
 * player had on the hotbar is moved into free inventory slots (never deleted).
 * Duplicate technique items anywhere in the inventory are merged into one.
 * @param {Player} player
 * @returns {{placed: number, missing: number}}
 */
export function grantLoadout(player) {
  const inv = inventoryOf(player);
  if (!inv) return { placed: 0, missing: LOADOUT.length };
  const size = inv.size;
  // 1) Remove existing technique items (they are re-created in order below).
  for (let i = 0; i < size; i++) {
    const item = inv.getItem(i);
    if (item && LOADOUT_IDS.has(item.typeId)) inv.setItem(i);
  }
  let placed = 0;
  let missing = 0;
  for (let slot = 0; slot < LOADOUT.length; slot++) {
    const key = LOADOUT[slot];
    let target = slot;
    const occupant = inv.getItem(slot);
    if (occupant) {
      // Move the player's own item out of the way into the main inventory.
      const free = firstEmpty(inv, 9, size);
      if (free !== -1) {
        inv.swapItems(slot, free, inv);
      } else {
        target = firstEmpty(inv, 0, size);
      }
    }
    if (target === -1) {
      missing++;
      continue;
    }
    inv.setItem(target, makeItem(key));
    placed++;
  }
  return { placed, missing };
}

/**
 * @param {Container} inv
 * @param {number} from
 * @param {number} to exclusive
 */
function firstEmpty(inv, from, to) {
  for (let i = from; i < to; i++) if (!inv.getItem(i)) return i;
  return -1;
}

/**
 * Remove every technique item from the player's inventory.
 * @param {Player} player
 */
export function removeLoadout(player) {
  const inv = inventoryOf(player);
  if (!inv) return 0;
  let removed = 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && LOADOUT_IDS.has(item.typeId)) {
      inv.setItem(i);
      removed++;
    }
  }
  return removed;
}

/** @param {Player} player @param {string} id */
export function hasItem(player, id) {
  const inv = inventoryOf(player);
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    if (inv.getItem(i)?.typeId === id) return true;
  }
  return false;
}

/** @param {Player} player */
export function headItemId(player) {
  try {
    return equippableOf(player)?.getEquipment(EquipmentSlot.Head)?.typeId;
  } catch {
    return undefined;
  }
}

/**
 * Swap the worn blindfold between normal and lifted (Six Eyes) variants.
 * Only touches the head slot if it already holds one of the two blindfolds.
 * @param {Player} player
 * @param {boolean} lifted
 */
export function setBlindfoldLifted(player, lifted) {
  const eq = equippableOf(player);
  if (!eq) return;
  const from = lifted ? ITEMS.blindfold.id : ITEMS.blindfold_lifted.id;
  try {
    if (eq.getEquipment(EquipmentSlot.Head)?.typeId === from) {
      eq.setEquipment(EquipmentSlot.Head, makeItem(lifted ? "blindfold_lifted" : "blindfold"));
    }
  } catch (e) {
    logError("items.blindfold", e);
  }
  // Never leave a stray lifted blindfold (a hidden item) in the inventory.
  if (!lifted) {
    const inv = inventoryOf(player);
    if (!inv) return;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId === ITEMS.blindfold_lifted.id) inv.setItem(i, makeItem("blindfold"));
    }
  }
}

/**
 * Equip the blindfold if the head slot is free.
 * @param {Player} player
 * @param {boolean} lifted
 * @returns {boolean} true if equipped
 */
export function equipBlindfold(player, lifted) {
  const eq = equippableOf(player);
  if (!eq) return false;
  try {
    if (eq.getEquipment(EquipmentSlot.Head)) return false;
    return eq.setEquipment(EquipmentSlot.Head, makeItem(lifted ? "blindfold_lifted" : "blindfold"));
  } catch (e) {
    logError("items.equip", e);
    return false;
  }
}

/** Remove a worn blindfold (either variant). @param {Player} player */
export function unequipBlindfold(player) {
  const eq = equippableOf(player);
  if (!eq) return false;
  try {
    const id = eq.getEquipment(EquipmentSlot.Head)?.typeId;
    if (id === ITEMS.blindfold.id || id === ITEMS.blindfold_lifted.id) {
      eq.setEquipment(EquipmentSlot.Head);
      return true;
    }
  } catch (e) {
    logError("items.unequip", e);
  }
  return false;
}
