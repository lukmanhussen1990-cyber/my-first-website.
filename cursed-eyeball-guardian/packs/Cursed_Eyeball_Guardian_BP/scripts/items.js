// Custom item handling. itemUse and itemUseOn can both fire for a single tap
// (tapping while looking at a block), so uses are debounced per player.

import { system } from '@minecraft/server';
import { ITEM_CONTROLLER, ITEM_SUMMONER, ITEM_UPGRADE, TIMING } from './config.js';
import { dismiss, fire, summon, upgrade } from './actions.js';
import { openMainMenu } from './ui.js';
import { isValid, warnOnce } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').ItemStack} ItemStack */

/** playerId -> tick of the last handled use. @type {Map<string, number>} */
const lastUse = new Map();

const OUR_ITEMS = new Set([ITEM_SUMMONER, ITEM_UPGRADE, ITEM_CONTROLLER]);

/**
 * Handles a tap with one of our items.
 * Summoner: tap = summon / recall, crouch + tap = dismiss.
 * Upgrade core: tap = level up (consumes one).
 * Controller: tap = ability menu, crouch + tap = command shot.
 * @param {Player | undefined} player @param {ItemStack | undefined} item
 */
export function handleItemUse(player, item) {
  if (!player || !item) return;
  let typeId;
  try {
    typeId = item.typeId;
  } catch {
    return;
  }
  if (!OUR_ITEMS.has(typeId) || !isValid(player)) return;

  const tick = system.currentTick;
  const last = lastUse.get(player.id);
  if (last !== undefined && tick - last < TIMING.ITEM_DEBOUNCE) return;
  lastUse.set(player.id, tick);

  let sneaking = false;
  try {
    sneaking = player.isSneaking;
  } catch {
    // keep false
  }
  try {
    if (typeId === ITEM_SUMMONER) {
      if (sneaking) dismiss(player);
      else summon(player);
    } else if (typeId === ITEM_UPGRADE) {
      upgrade(player);
    } else if (sneaking) {
      fire(player);
    } else {
      openMainMenu(player);
    }
  } catch (error) {
    warnOnce('item use', error);
  }
}

/** @param {string} playerId */
export function forgetItemUser(playerId) {
  lastUse.delete(playerId);
}
