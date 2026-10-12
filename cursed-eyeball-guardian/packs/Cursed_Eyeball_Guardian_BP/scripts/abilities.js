// Support abilities: shield, auto heal, night vision and the guardian's own
// slow regeneration. All periodic work is staggered with state.phase.

import {
  GUARDIAN_REGEN,
  HEAL,
  MODE,
  NIGHT_VISION,
  PARTICLES,
  SHIELD,
  SOUNDS,
} from './config.js';
import { actionBar, getHealth, isAlive, isValid, playSoundAt, spawnFx } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('./registry.js').GuardianState} GuardianState */
/** @typedef {import('./store.js').GuardianData} GuardianData */

/**
 * Night vision without particles; the long duration avoids the flicker vanilla
 * shows when night vision drops under 10 s.
 * @param {Player} owner
 */
export function applyNightVision(owner) {
  try {
    owner.addEffect('night_vision', NIGHT_VISION.DURATION, { amplifier: 0, showParticles: false });
  } catch {
    // owner dead / gone
  }
}

/** @param {Player} owner */
export function removeNightVision(owner) {
  try {
    owner.removeEffect('night_vision');
  } catch {
    // ignore
  }
}

/** Resistance II refresh + dome particles. @param {Player} owner @param {number} skin */
export function shieldPulse(owner, skin) {
  try {
    owner.addEffect('resistance', SHIELD.RESIST_DURATION, { amplifier: SHIELD.RESIST_AMPLIFIER, showParticles: false });
  } catch {
    // ignore
  }
  shieldDome(owner, skin);
}

/** @param {Player} owner @param {number} skin */
function shieldDome(owner, skin) {
  try {
    const l = owner.location;
    spawnFx(owner.dimension, PARTICLES.SHIELD_DOME, { x: l.x, y: l.y + 1, z: l.z }, skin);
  } catch {
    // ignore
  }
}

/** Heal cooldown in ticks for a level: 30 s - 4 s per level above 1. @param {number} level */
export function healCooldownTicks(level) {
  return (HEAL.BASE_COOLDOWN_SECONDS - HEAL.PER_LEVEL_SECONDS * (level - 1)) * 20;
}

/**
 * Regeneration II + 4 instant hp when the owner is at or below 40 % health.
 * @param {GuardianState} state @param {GuardianData} data @param {number} tick
 */
function tryHeal(state, data, tick) {
  if (tick < state.healReadyTick) return;
  const owner = state.owner;
  const health = getHealth(owner);
  if (!health) return;
  let current;
  let max;
  try {
    current = health.currentValue;
    max = health.effectiveMax;
  } catch {
    return;
  }
  if (current <= 0 || current > max * HEAL.THRESHOLD) return;
  try {
    owner.addEffect('regeneration', HEAL.REGEN_DURATION, { amplifier: HEAL.REGEN_AMPLIFIER, showParticles: true });
    health.setCurrentValue(Math.min(max, current + HEAL.INSTANT));
  } catch {
    return;
  }
  state.healReadyTick = tick + healCooldownTicks(data.level);
  try {
    const l = owner.location;
    const chest = { x: l.x, y: l.y + 1, z: l.z };
    spawnFx(owner.dimension, PARTICLES.HEAL, chest, data.skin);
    playSoundAt(SOUNDS.HEAL, chest, 1, 1);
  } catch {
    // ignore
  }
  actionBar(owner, '§aYour guardian mends your wounds.');
}

/**
 * Shield mode refund: gives back 25 % of the damage the owner just took.
 * Called from the entityHurt handler (health is already reduced there).
 * @param {GuardianState} state @param {GuardianData} data @param {number} damage
 */
export function onShieldedHit(state, data, damage) {
  if (data.mode !== MODE.SHIELD || !(damage > 0)) return;
  const owner = state.owner;
  const health = getHealth(owner);
  if (!health) return;
  try {
    const current = health.currentValue;
    if (current <= 0) return; // already dead
    health.setCurrentValue(Math.min(health.effectiveMax, current + damage * SHIELD.REFUND));
    const l = owner.location;
    const chest = { x: l.x, y: l.y + 1, z: l.z };
    spawnFx(owner.dimension, PARTICLES.SHIELD_HIT, chest, data.skin);
    playSoundAt(SOUNDS.SHIELD_HIT, chest, 1, 0.9 + Math.random() * 0.2);
  } catch {
    // ignore
  }
}

/**
 * Guardian regenerates 1 hp every 2 s when it has not fought for 5 s.
 * @param {GuardianState} state @param {number} tick
 */
function regenGuardian(state, tick) {
  if (tick - state.lastCombatTick < GUARDIAN_REGEN.OUT_OF_COMBAT) return;
  const guardian = state.entity;
  if (!isValid(guardian)) return;
  const health = getHealth(guardian);
  if (!health) return;
  try {
    const current = health.currentValue;
    const max = health.effectiveMax;
    if (current > 0 && current < max) health.setCurrentValue(Math.min(max, current + GUARDIAN_REGEN.AMOUNT));
  } catch {
    // ignore
  }
}

/**
 * Periodic support abilities for one guardian (called every tick, cheap).
 * @param {GuardianState} state @param {GuardianData} data @param {number} tick
 */
export function tickAbilities(state, data, tick) {
  const t = tick + state.phase;
  const due =
    t % GUARDIAN_REGEN.INTERVAL === 0 ||
    (data.mode === MODE.SHIELD && t % SHIELD.DOME_INTERVAL === 0) ||
    (data.heal && t % HEAL.CHECK_INTERVAL === 0) ||
    (data.nv && t % NIGHT_VISION.INTERVAL === 0);
  if (!due) return;
  const owner = state.owner;
  if (!isAlive(owner)) return;
  if (data.mode === MODE.SHIELD) {
    if (t % SHIELD.RESIST_INTERVAL === 0) shieldPulse(owner, data.skin);
    else if (t % SHIELD.DOME_INTERVAL === 0) shieldDome(owner, data.skin);
  }
  if (data.heal && t % HEAL.CHECK_INTERVAL === 0) tryHeal(state, data, tick);
  if (data.nv && t % NIGHT_VISION.INTERVAL === 0) applyNightVision(owner);
  if (t % GUARDIAN_REGEN.INTERVAL === 0) regenGuardian(state, tick);
}
