// Goku Ultra Instinct add-on — entry point.
// Every power is an item: using it (tap / right click) runs the move below.
import { EquipmentSlot, system, world } from '@minecraft/server';
import { fx, isPlayer, sound } from './lib/fx.js';
import {
  MAX_KI,
  addKi,
  dropState,
  getState,
  hasInfiniteKi,
  peekState,
  ready,
  setting,
  spendKi,
  startCooldown,
} from './lib/state.js';
import { runTasks, startTask } from './lib/tasks.js';
import { up } from './lib/vec.js';
import { giveEverything, giveItem, openRadar } from './menu/radar.js';
import { dragonFist } from './powers/dragonFist.js';
import { instantTransmission } from './powers/instantTransmission.js';
import { kamehameha } from './powers/kamehameha.js';
import { kiBlast } from './powers/kiBlast.js';
import { cleanupClouds, forgetCloud, land, steerNimbus, toggleNimbus } from './powers/nimbus.js';
import { powerPole } from './powers/powerPole.js';
import { eatSenzu } from './powers/senzu.js';
import { spiritBomb } from './powers/spiritBomb.js';
import { activate, deactivate, dodge, toggleUltraInstinct, ultraInstinctTick, undoDamage } from './powers/ultraInstinct.js';

/**
 * ki: ki cost (40% cheaper in Ultra Instinct), cooldown: ticks (matches the
 * item's minecraft:cooldown), task: multi-tick move, run: instant move,
 * free: usable while another move is charging.
 */
const MOVES = {
  'goku:ultra_instinct': { ki: 0, cooldown: 40, run: toggleUltraInstinct, free: true },
  'goku:kamehameha': { ki: 30, cooldown: 100, task: kamehameha },
  'goku:ki_blast': { ki: 4, cooldown: 5, task: kiBlast },
  'goku:spirit_bomb': { ki: 70, cooldown: 240, task: spiritBomb },
  'goku:instant_transmission': { ki: 12, cooldown: 30, run: instantTransmission },
  'goku:dragon_fist': { ki: 25, cooldown: 80, task: dragonFist },
  'goku:power_pole': { ki: 4, cooldown: 30, run: powerPole },
  'goku:flying_nimbus': { ki: 0, cooldown: 20, run: toggleNimbus, free: true },
  'goku:dragon_radar': { ki: 0, cooldown: 10, run: openRadar, free: true },
};

function warn(where, error) {
  console.warn(`[goku] ${where}: ${error}`);
}

/** Runs the move bound to an item. Returns true when the move started. */
export function useMove(caster, item) {
  const move = MOVES[item.typeId];
  if (!move) return false;
  const state = getState(caster);
  const now = system.currentTick;
  // a single tap can be reported by both itemUse and itemUseOn
  if ((state.lastUse[item.typeId] ?? -100) > now - 4) return false;
  state.lastUse[item.typeId] = now;
  if (state.channel && !move.free) return false;
  if (!ready(state, item.typeId)) return false;

  const cost = Math.ceil(move.ki * (state.ui ? 0.6 : 1));
  const kiBefore = state.ki;
  if (cost > 0 && !spendKi(caster, state, cost)) return false;
  if (move.task) {
    startTask(caster, item.typeId, move.task(caster, state));
  } else if (move.run(caster, state) === false) {
    state.ki = kiBefore;
    return false;
  }
  startCooldown(state, item.typeId, move.cooldown);
  if (isPlayer(caster)) {
    try {
      /** @type {import('@minecraft/server').ItemCooldownComponent | undefined} */
      const cooldown = /** @type {any} */ (item.getComponent('minecraft:cooldown'));
      cooldown?.startCooldown(/** @type {import('@minecraft/server').Player} */ (caster));
    } catch {
      // ignore
    }
  }
  return true;
}

// --- item events -----------------------------------------------------------
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  try {
    if (itemStack) useMove(source, itemStack);
  } catch (error) {
    warn('itemUse', error);
  }
});

world.afterEvents.itemUseOn.subscribe(({ source, itemStack }) => {
  try {
    if (itemStack) useMove(source, itemStack);
  } catch (error) {
    warn('itemUseOn', error);
  }
});

world.afterEvents.itemCompleteUse.subscribe(({ source, itemStack }) => {
  try {
    if (itemStack?.typeId === 'goku:senzu_bean') eatSenzu(source, getState(source));
  } catch (error) {
    warn('senzu', error);
  }
});

// --- Ultra Instinct defence ------------------------------------------------
world.afterEvents.entityHurt.subscribe(
  ({ hurtEntity, damage, damageSource }) => {
    try {
      const state = getState(hurtEntity);
      if (!state.ui) return;
      if (damageSource.cause === 'fall') {
        undoDamage(hurtEntity, damage);
        return;
      }
      const attacker = damageSource.damagingEntity;
      if (!attacker || attacker.id === hurtEntity.id) return;
      if (system.currentTick < state.nextDodge || Math.random() > 0.7) return;
      dodge(hurtEntity, state, attacker, damage);
    } catch (error) {
      warn('dodge', error);
    }
  },
  { entityTypes: ['minecraft:player'] }
);

world.afterEvents.entityDie.subscribe(
  ({ deadEntity }) => {
    try {
      const state = getState(deadEntity);
      if (state.ui) deactivate(deadEntity, state, false);
      if (state.nimbus) land(deadEntity, state);
      state.ki = MAX_KI;
      state.channel = undefined;
    } catch (error) {
      warn('death', error);
    }
  },
  { entityTypes: ['minecraft:player'] }
);

// --- joining and leaving -----------------------------------------------------
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    try {
      if (!player.isValid()) return;
      if (player.getDynamicProperty('goku:welcomed') !== true) {
        player.setDynamicProperty('goku:welcomed', true);
        giveItem(player, 'goku:dragon_radar');
        player.sendMessage(
          '§6§l[Goku Ultra Instinct]§r §fYou got the §aDragon Radar§f! Use it to get every Goku power and outfit.\n' +
            '§7In Creative, all Goku items are also in the Equipment tab of your inventory.'
        );
      }
      if (player.getDynamicProperty('goku:ui') === true) activate(player, getState(player), true);
    } catch (error) {
      warn('join', error);
    }
  }, 40);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const cloud = peekState(playerId)?.nimbus;
  if (cloud) {
    forgetCloud(cloud);
    try {
      if (cloud.isValid()) cloud.remove();
    } catch {
      // ignore
    }
  }
  dropState(playerId);
});

// --- /scriptevent goku:kit gives everything (for players with cheats on) ----
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === 'goku:kit' && sourceEntity && isPlayer(sourceEntity)) giveEverything(sourceEntity);
});

// --- every tick --------------------------------------------------------------
function equipment(player) {
  try {
    /** @type {import('@minecraft/server').EntityEquippableComponent | undefined} */
    const component = /** @type {any} */ (player.getComponent('minecraft:equippable'));
    return component;
  } catch {
    return undefined;
  }
}

function wearsFullGi(gear) {
  return (
    gear.getEquipment(EquipmentSlot.Chest)?.typeId === 'goku:gi_top' &&
    gear.getEquipment(EquipmentSlot.Legs)?.typeId === 'goku:gi_pants' &&
    gear.getEquipment(EquipmentSlot.Feet)?.typeId === 'goku:gi_boots'
  );
}

function kiBar(player, state) {
  const form = state.ui ? '  §7§lULTRA INSTINCT' : '';
  if (hasInfiniteKi(player)) return `§fKi §bMAX${form}`;
  const bars = 20;
  const filled = Math.round((state.ki / MAX_KI) * bars);
  const color = state.ki < 25 ? '§c' : state.ki < 60 ? '§e' : '§b';
  return `§fKi ${color}${'|'.repeat(filled)}§8${'|'.repeat(bars - filled)} §f${Math.floor(state.ki)}${form}`;
}

function playerTick(player, tick) {
  const state = getState(player);
  if (state.ui) ultraInstinctTick(player, tick);
  if (state.nimbus) steerNimbus(player, state, tick);

  const gear = equipment(player);
  const held = gear?.getEquipment(EquipmentSlot.Mainhand);
  const holdingPower = !!held && held.typeId in MOVES;
  const charging = holdingPower && player.isSneaking && !state.channel && !state.nimbus;

  if (charging && tick % 3 === 0) {
    fx(player.dimension, 'aura', state.ui ? 'silver' : 'gold', player.location, 1.1);
    if (tick % 9 === 0) fx(player.dimension, 'spark', state.ui ? 'silver' : 'gold', up(player.location, 1), 0.8);
    if (tick % 30 === 0) sound(player.dimension, 'beacon.ambient', player.location, 0.5, 1.8);
  }

  if (tick % 10 === 0) {
    if (state.ki < MAX_KI) addKi(state, (state.ui ? 4 : 2) + (charging ? 8 : 0));
    if (tick % 20 === 0 && !state.ui && gear && wearsFullGi(gear)) {
      try {
        player.addEffect('speed', 30, { amplifier: 0, showParticles: false });
        player.addEffect('jump_boost', 30, { amplifier: 0, showParticles: false });
      } catch {
        // ignore
      }
    }
  }

  if (tick % 5 === 0 && tick >= state.hudUntil && setting('hud')) {
    if (holdingPower || state.ui || (state.ki < MAX_KI && !hasInfiniteKi(player))) {
      try {
        player.onScreenDisplay.setActionBar(kiBar(player, state));
      } catch {
        // ignore
      }
    }
  }
}

system.runInterval(() => {
  const tick = system.currentTick;
  runTasks();
  for (const player of world.getAllPlayers()) {
    try {
      playerTick(player, tick);
    } catch (error) {
      warn('tick', error);
    }
  }
  if (tick % 200 === 0) {
    cleanupClouds(['overworld', 'nether', 'the_end'].map((id) => world.getDimension(id)));
  }
}, 1);
