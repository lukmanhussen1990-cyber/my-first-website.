// Ultra Instinct: silver aura, big buffs and automatic dodging.
import { EquipmentSlot, ItemStack, system } from '@minecraft/server';
import { hit, isOpen, knock, targetsNear } from '../lib/combat.js';
import { actionBar, fx, pose, sound, title } from '../lib/fx.js';
import { add, bodyCenter, distance, frame, normalize, scale, sub, up } from '../lib/vec.js';

const BUFFS = [
  ['speed', 2],
  ['strength', 2],
  ['resistance', 1],
  ['jump_boost', 1],
  ['haste', 1],
];

export function toggleUltraInstinct(player, state) {
  if (state.ui) deactivate(player, state, true);
  else activate(player, state, false);
}

export function activate(player, state, silent) {
  state.ui = true;
  try {
    player.setDynamicProperty('goku:ui', true);
  } catch {
    // ignore
  }
  swapHair(player, 'goku:goku_hair', 'goku:ui_hair');
  applyBuffs(player);
  if (silent) return;

  const dim = player.dimension;
  const c = bodyCenter(player);
  pose(player, 'power_up');
  title(player, '§7§lULTRA INSTINCT', '§bMastered', 40);
  sound(dim, 'beacon.activate', c, 1.6, 1.4);
  sound(dim, 'mob.warden.sonic_charge', c, 1.2, 1.6);
  sound(dim, 'ambient.weather.thunder', c, 0.6, 1.8);
  fx(dim, 'ring', 'silver', up(player.location, 0.1), 12);
  fx(dim, 'ring', 'blue', up(player.location, 0.8), 8);
  fx(dim, 'burst', 'silver', c, 1.8);
  fx(dim, 'aura', 'silver', player.location, 2.2);
  state.hudUntil = system.currentTick + 40;
  // the shockwave of the transformation pushes everything away
  for (const e of targetsNear(dim, c, 7, player)) {
    const away = normalize({ x: e.location.x - c.x, y: 0, z: e.location.z - c.z });
    knock(e, away, 1.8, 0.45);
  }
}

export function deactivate(player, state, withEffects) {
  state.ui = false;
  try {
    player.setDynamicProperty('goku:ui', false);
  } catch {
    // ignore
  }
  swapHair(player, 'goku:ui_hair', 'goku:goku_hair');
  for (const [effect] of BUFFS) {
    try {
      player.removeEffect(effect);
    } catch {
      // ignore
    }
  }
  try {
    player.removeEffect('night_vision');
  } catch {
    // ignore
  }
  if (withEffects) {
    sound(player.dimension, 'beacon.deactivate', player.location, 1, 1.2);
    actionBar(player, '§7Ultra Instinct §8faded...');
    state.hudUntil = system.currentTick + 30;
  }
}

/** Wearing Goku's black hair turns it silver while transformed (and back). */
function swapHair(player, from, to) {
  try {
    const equipment = player.getComponent('minecraft:equippable');
    const head = equipment?.getEquipment(EquipmentSlot.Head);
    if (head?.typeId === from) equipment.setEquipment(EquipmentSlot.Head, new ItemStack(to, 1));
  } catch {
    // mobs without equipment
  }
}

export function applyBuffs(entity) {
  for (const [effect, amplifier] of BUFFS) {
    try {
      entity.addEffect(effect, 40, { amplifier, showParticles: false });
    } catch {
      // ignore
    }
  }
  try {
    entity.addEffect('night_vision', 400, { amplifier: 0, showParticles: false });
  } catch {
    // ignore
  }
}

/** Called every tick while Ultra Instinct is active. */
export function ultraInstinctTick(player, tick) {
  const dim = player.dimension;
  if (tick % 10 === 0) applyBuffs(player);
  if (tick % 2 === 0) fx(dim, 'aura', 'silver', player.location, 1.3);
  if (tick % 4 === 1) fx(dim, 'aura', 'blue', player.location, 1.0);
  if (tick % 6 === 3) fx(dim, 'spark', 'silver', up(player.location, 1.1), 0.9);
  if (tick % 30 === 0) {
    try {
      const health = player.getComponent('minecraft:health');
      if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax) {
        health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 1));
      }
    } catch {
      // ignore
    }
  }
}

/** Gives back health that was just lost (used for dodges and fall damage). */
export function undoDamage(entity, amount) {
  try {
    const health = entity.getComponent('minecraft:health');
    if (!health || health.currentValue <= 0) return false;
    health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
    return true;
  } catch {
    return false;
  }
}

function standable(dim, feet) {
  return isOpen(dim, up(feet, 0.1)) && isOpen(dim, up(feet, 1.1));
}

/** Autonomous dodge: undo the hit, flash behind the attacker and counter. */
export function dodge(player, state, attacker, damage) {
  if (!undoDamage(player, damage)) return;
  const now = system.currentTick;
  state.nextDodge = now + 8;
  state.hudUntil = now + 25;
  const dim = player.dimension;
  const from = bodyCenter(player);
  fx(dim, 'orb', 'silver', from, 1.6);
  fx(dim, 'burst', 'silver', from, 0.7);

  let dest;
  const close =
    attacker.isValid() && attacker.dimension.id === dim.id && distance(attacker.location, player.location) < 16;
  if (close) {
    const behind = sub(attacker.location, scale(frame(attacker).forward, 1.6));
    if (standable(dim, behind)) dest = behind;
  }
  if (!dest) {
    const side = scale(frame(player).right, Math.random() < 0.5 ? 2.2 : -2.2);
    const step = add(player.location, side);
    if (standable(dim, step)) dest = step;
  }
  try {
    if (dest) player.teleport(dest, close ? { facingLocation: up(attacker.location, 1.2) } : undefined);
  } catch {
    // ignore
  }
  sound(dim, 'mob.endermen.portal', from, 0.7, 1.9);
  actionBar(player, '§7» §f§lDodged! §r§7«');
  if (close) {
    system.runTimeout(() => {
      if (!player.isValid() || !attacker.isValid()) return;
      pose(player, 'punch');
      hit(attacker, player, 8);
      knock(attacker, normalize(sub(attacker.location, player.location)), 1.4, 0.45);
      fx(attacker.dimension, 'burst', 'silver', bodyCenter(attacker), 0.8);
      sound(attacker.dimension, 'game.player.attack.strong', attacker.location, 1, 1.2);
    }, 3);
  }
}
