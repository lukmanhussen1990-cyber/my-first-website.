// Optional challenge mode (OFF by default; /scriptevent gsh:challenge on):
//  * every survival/adventure player gets an Elytra + fireworks once, and a warning
//  * lives (default 3): losing the last one turns the player into a spectator
//  * flight equipment may only be used while being chased: fireworks are blocked and a gliding
//    Elytra is moved from the chest slot back to the inventory when not chased.
// Ordinary spider hunting does not depend on any of this.
import { EquipmentSlot, ItemStack, system } from '@minecraft/server';
import { CONFIG } from './config.js';
import { actionBar, debug, tell } from './effects.js';
import { allPlayers, isSurvivalLike } from './players.js';
import { DP_CH_GIVEN, DP_CH_LIVES, DP_CH_OUT } from './state.js';
import { chasedPlayers } from './spider.js';

const WARNING = [
  '§c§l⚠ WARNING',
  '§fSomething dangerous roams this world.',
  '§fIf it begins chasing you, §c§lRUN§r§f.',
  '§fYou have been given an Elytra and fireworks, but you may only use them when being chased.',
];

function lives(player) {
  try {
    const v = player.getDynamicProperty(DP_CH_LIVES);
    return typeof v === 'number' ? v : CONFIG.challengeLives;
  } catch (e) {
    return CONFIG.challengeLives;
  }
}

function giveKit(player) {
  try {
    const inv = player.getComponent('minecraft:inventory');
    const c = inv && inv.container;
    if (!c) return false;
    const drop = (stack) => {
      const left = c.addItem(stack);
      if (left) player.dimension.spawnItem(left, player.location);
    };
    drop(new ItemStack('minecraft:elytra', 1));
    if (CONFIG.challengeFireworks > 0) drop(new ItemStack('minecraft:firework_rocket', CONFIG.challengeFireworks));
    return true;
  } catch (e) {
    debug(`challenge kit failed: ${e}`);
    return false;
  }
}

function announce(player) {
  try {
    player.onScreenDisplay.setTitle('§c⚠ WARNING', {
      subtitle: '§fIf it begins chasing you, RUN.',
      fadeInDuration: 10,
      stayDuration: 70,
      fadeOutDuration: 20,
    });
  } catch (e) {
    // ignore
  }
  for (const line of WARNING) tell(player, line);
  tell(player, `§7Lives: §c${lives(player)}`);
}

/** Called once per second. */
export function onSecond() {
  if (!CONFIG.challengeMode) return;
  for (const p of allPlayers()) {
    if (!isSurvivalLike(p)) continue;
    try {
      if (p.getDynamicProperty(DP_CH_GIVEN) === true) continue;
      if (giveKit(p)) {
        p.setDynamicProperty(DP_CH_GIVEN, true);
        p.setDynamicProperty(DP_CH_LIVES, CONFIG.challengeLives);
        announce(p);
      }
    } catch (e) {
      // retry next second
    }
  }
}

/** Called every 10 ticks: no gliding unless chased. */
export function enforceFlight() {
  if (!CONFIG.challengeMode) return;
  for (const p of allPlayers()) {
    try {
      if (!p.isGliding || chasedPlayers.has(p.id) || !isSurvivalLike(p)) continue;
      const eq = p.getComponent('minecraft:equippable');
      const chest = eq && eq.getEquipment(EquipmentSlot.Chest);
      if (!chest || chest.typeId !== 'minecraft:elytra') continue;
      eq.setEquipment(EquipmentSlot.Chest, undefined);
      const c = p.getComponent('minecraft:inventory').container;
      const left = c.addItem(chest);
      if (left) p.dimension.spawnItem(left, p.location);
      actionBar(p, '§cYou may only fly while it is chasing you!');
    } catch (e) {
      // ignore this player
    }
  }
}

/** beforeEvents.itemUse handler: block fireworks when not chased. */
export function onBeforeItemUse(ev) {
  if (!CONFIG.challengeMode) return;
  try {
    const item = ev.itemStack;
    const player = ev.source;
    if (!item || item.typeId !== 'minecraft:firework_rocket' || !player || player.typeId !== 'minecraft:player') return;
    if (chasedPlayers.has(player.id) || !isSurvivalLike(player)) return;
    ev.cancel = true;
    system.run(() => actionBar(player, '§cFireworks only work while it is chasing you!'));
  } catch (e) {
    // never block normal play because of an error
  }
}

/** A player died: lose a life. */
export function onPlayerDied(player) {
  if (!CONFIG.challengeMode) return;
  try {
    if (!isSurvivalLike(player) || player.getDynamicProperty(DP_CH_GIVEN) !== true) return;
    const left = Math.max(0, lives(player) - 1);
    player.setDynamicProperty(DP_CH_LIVES, left);
    if (left <= 0) player.setDynamicProperty(DP_CH_OUT, true);
  } catch (e) {
    // ignore
  }
}

/** A player (re)spawned: report lives, turn players without lives into spectators. */
export function onPlayerSpawn(player) {
  if (!CONFIG.challengeMode) return;
  try {
    if (player.getDynamicProperty(DP_CH_OUT) === true) {
      player.runCommandAsync('gamemode spectator @s').catch(() => {});
      tell(player, '§cYou have no lives left. You are now a spectator.');
      return;
    }
    if (player.getDynamicProperty(DP_CH_GIVEN) === true) actionBar(player, `§7Lives left: §c${lives(player)}`);
  } catch (e) {
    // ignore
  }
}

/** Reset every player's challenge progress (used when challenge mode is switched on again). */
export function resetPlayers() {
  for (const p of allPlayers()) {
    try {
      p.setDynamicProperty(DP_CH_GIVEN, undefined);
      p.setDynamicProperty(DP_CH_LIVES, undefined);
      p.setDynamicProperty(DP_CH_OUT, undefined);
    } catch (e) {
      // ignore
    }
  }
}
