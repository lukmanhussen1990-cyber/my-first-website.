// Per-player state (ki, cooldowns, Ultra Instinct) and world settings.
import { GameMode, system, world } from '@minecraft/server';
import { isPlayer } from './fx.js';

export const MAX_KI = 100;

const states = new Map();

export function getState(entity) {
  let state = states.get(entity.id);
  if (!state) {
    state = {
      ki: MAX_KI,
      cooldowns: {},
      lastUse: {},
      channel: undefined, // name of a move that is charging (blocks other moves)
      ui: false, // Ultra Instinct active
      hudUntil: 0, // tick until which the ki HUD stays quiet
      nextDodge: 0, // tick of the next possible automatic dodge
      nimbus: undefined, // Flying Nimbus entity while riding
      nimbusMiss: 0, // ticks the rider was seen away from the cloud
      hand: 0, // which hand throws the next ki blast
    };
    states.set(entity.id, state);
  }
  return state;
}

export function peekState(id) {
  return states.get(id);
}

export function dropState(id) {
  states.delete(id);
}

const DEFAULTS = { griefing: true, infiniteKi: false, hud: true, xpCost: false };

export function setting(key) {
  try {
    const value = world.getDynamicProperty('goku:' + key);
    return typeof value === 'boolean' ? value : DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function setSetting(key, value) {
  world.setDynamicProperty('goku:' + key, value);
}

export function isCreative(entity) {
  try {
    return isPlayer(entity) && entity.matches({ gameMode: GameMode.creative });
  } catch {
    return false;
  }
}

export function hasInfiniteKi(entity) {
  return !isPlayer(entity) || isCreative(entity) || setting('infiniteKi');
}

/** Takes ki for a move. Returns false (and warns) when there is not enough. */
export function spendKi(entity, state, amount) {
  if (hasInfiniteKi(entity)) return true;
  if (state.ki < amount) {
    state.hudUntil = system.currentTick + 30;
    if (isPlayer(entity)) {
      try {
        entity.onScreenDisplay.setActionBar(`§cNot enough ki! §7(${Math.floor(state.ki)}/${amount}) §8Sneak to charge`);
        entity.playSound('note.bass', { volume: 0.8, pitch: 0.6 });
      } catch {
        // ignore
      }
    }
    return false;
  }
  state.ki -= amount;
  return true;
}

export function addKi(state, amount) {
  state.ki = Math.max(0, Math.min(MAX_KI, state.ki + amount));
}

/** Per-move cooldown check. Returns true when the move may be used now. */
export function ready(state, move) {
  return (state.cooldowns[move] ?? 0) <= system.currentTick;
}

export function startCooldown(state, move, ticks) {
  state.cooldowns[move] = system.currentTick + ticks;
}
