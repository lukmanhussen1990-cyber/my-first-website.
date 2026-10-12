// Player-facing actions shared by the items, the ability menu and /scriptevent:
// summon, recall, dismiss, modes, looks, toggles, upgrades, firing and status.

import { system } from '@minecraft/server';
import {
  ITEM_UPGRADE,
  LASER_COOLDOWN,
  LASER_DAMAGE,
  LASER_RANGE,
  LEVEL_HEALTH,
  MAX_LEVEL,
  MODE,
  MODE_LABELS,
  PARTICLES,
  PROP_LEVEL,
  PROP_MODE,
  PROP_SKIN,
  SKINS,
  SOUNDS,
  levelEvent,
} from './config.js';
import { getData, saveData } from './store.js';
import {
  dropState,
  getState,
  liveState,
  spawnGuardianFor,
  teleportGuardianToOwner,
} from './registry.js';
import { commandShot, destroyPatternSize, guardianEye, standDown } from './combat.js';
import { applyNightVision, healCooldownTicks, removeNightVision, shieldPulse } from './abilities.js';
import { actionBar, getHealth, isValid, playSoundAt, playerSound, spawnFx, tell } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('./registry.js').GuardianState} GuardianState */

/** Seconds left on the death cooldown (0 when summoning is allowed). @param {Player} player */
export function deathCooldownSeconds(player) {
  const left = getData(player).deadUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/**
 * Summons the guardian, or recalls it when it already exists.
 * @param {Player} player
 * @returns {boolean}
 */
export function summon(player) {
  const data = getData(player);
  const wait = deathCooldownSeconds(player);
  if (wait > 0) {
    tell(player, `§4Your guardian is still re-forming... §7Try again in §f${wait}s§7.`);
    return false;
  }
  if (liveState(player)) return recall(player);
  data.active = true;
  data.deadUntil = 0;
  saveData(player, data);
  const entity = spawnGuardianFor(player, true);
  if (!entity) {
    tell(player, '§7The eye cannot open here yet - it will appear as soon as there is room.');
    return false;
  }
  if (data.nv) applyNightVision(player);
  tell(player, '§cThe Cursed Eye opens... §7It will follow and protect you. Use the §fEyeball Ability Controller§7 to command it.');
  return true;
}

/**
 * Teleports the guardian next to the player (or spawns it if it is missing).
 * @param {Player} player
 * @returns {boolean}
 */
export function recall(player) {
  const state = liveState(player);
  if (state) {
    if (teleportGuardianToOwner(state, system.currentTick, true)) {
      actionBar(player, '§cYour guardian returns to your side.');
      return true;
    }
    return false;
  }
  const data = getData(player);
  if (data.active && deathCooldownSeconds(player) === 0) {
    return !!spawnGuardianFor(player, true);
  }
  tell(player, '§7You have no guardian. Tap the §fCursed Summoning Eye§7 to summon one.');
  return false;
}

/**
 * Dismisses (despawns) the guardian; it can be summoned again any time.
 * @param {Player} player
 * @returns {boolean}
 */
export function dismiss(player) {
  const data = getData(player);
  const state = getState(player.id);
  const entity = state?.entity;
  if (!data.active && !isValid(entity)) {
    tell(player, '§7You have no guardian summoned.');
    return false;
  }
  if (state) standDown(state);
  if (isValid(entity)) {
    try {
      const eye = guardianEye(entity);
      spawnFx(entity.dimension, PARTICLES.TELEPORT, eye, data.skin);
      playSoundAt(SOUNDS.TELEPORT, eye, 1, 0.8);
    } catch {
      // ignore
    }
  }
  data.active = false;
  saveData(player, data);
  dropState(player.id, true);
  if (data.nv) removeNightVision(player);
  tell(player, '§7Your guardian closes its eye and fades into the dark.');
  return true;
}

/**
 * @param {Player} player @param {number} mode 0-4
 * @returns {boolean}
 */
export function setMode(player, mode) {
  if (!(mode >= MODE.FOLLOW && mode <= MODE.PASSIVE)) return false;
  const data = getData(player);
  data.mode = mode;
  saveData(player, data);
  const state = liveState(player);
  if (state && state.entity) {
    try {
      state.entity.setProperty(PROP_MODE, mode);
    } catch {
      // ignore
    }
    if (mode === MODE.PASSIVE) standDown(state);
    if (mode === MODE.SHIELD) {
      shieldPulse(player, data.skin);
      playSoundAt(SOUNDS.SHIELD, player.location, 1, 1);
    }
  }
  playerSound(player, SOUNDS.MODE, 1, 1);
  actionBar(player, `§cGuardian mode: §f${MODE_LABELS[mode]}`);
  return true;
}

/**
 * @param {Player} player @param {number} skin 0-3
 * @returns {boolean}
 */
export function setSkin(player, skin) {
  if (!(skin >= 0 && skin < SKINS.length)) return false;
  const data = getData(player);
  data.skin = skin;
  saveData(player, data);
  const state = liveState(player);
  if (state && state.entity) {
    try {
      state.entity.setProperty(PROP_SKIN, skin);
      spawnFx(state.entity.dimension, PARTICLES.LEVEL_UP, guardianEye(state.entity), skin);
    } catch {
      // ignore
    }
  }
  playerSound(player, SOUNDS.MODE, 1, 1.2);
  actionBar(player, `§7Guardian look: ${SKINS[skin].text}${SKINS[skin].label}`);
  return true;
}

/**
 * Sets the level (no item cost - used by upgrade() and /scriptevent ceg:level).
 * @param {Player} player @param {number} level 1-5
 * @returns {boolean}
 */
export function setLevel(player, level) {
  if (!(level >= 1 && level <= MAX_LEVEL)) return false;
  const lvl = Math.floor(level);
  const data = getData(player);
  data.level = lvl;
  saveData(player, data);
  const state = liveState(player);
  if (state && state.entity) {
    state.levelFixes = 0;
    try {
      state.entity.triggerEvent(levelEvent(lvl));
      state.entity.setProperty(PROP_LEVEL, lvl);
      const eye = guardianEye(state.entity);
      spawnFx(state.entity.dimension, PARTICLES.LEVEL_UP, eye, data.skin);
      playSoundAt(SOUNDS.LEVEL_UP, eye, 1, 1);
    } catch {
      // ignore
    }
  } else {
    playerSound(player, SOUNDS.LEVEL_UP, 1, 1);
  }
  return true;
}

/**
 * Consumes one Eyeball Upgrade Core from the inventory via /clear.
 * (Player.selectedSlot does not exist in 1.10.0.) Data 0 matches custom items;
 * -1 ("any") is tried as a fallback.
 * @param {Player} player
 */
function consumeUpgradeItem(player) {
  for (const command of [`clear @s ${ITEM_UPGRADE} 0 1`, `clear @s ${ITEM_UPGRADE} -1 1`]) {
    try {
      if (player.runCommand(command).successCount > 0) return true;
    } catch {
      // "no items to clear" may throw
    }
  }
  return false;
}

/**
 * Upgrade item tap: +1 level for one Upgrade Core.
 * @param {Player} player
 * @returns {boolean}
 */
export function upgrade(player) {
  const data = getData(player);
  if (data.level >= MAX_LEVEL) {
    tell(player, `§6Your guardian is already at max level (§f${MAX_LEVEL}/${MAX_LEVEL}§6).`);
    return false;
  }
  if (!consumeUpgradeItem(player)) {
    tell(player, '§7You need an §fEyeball Upgrade Core§7.');
    return false;
  }
  const next = data.level + 1;
  setLevel(player, next);
  tell(
    player,
    `§6Guardian upgraded to Level §f${next}§6! §7Laser §f${LASER_DAMAGE[next - 1]}§7 dmg, §f${LASER_RANGE[next - 1]}§7 range, health §f${LEVEL_HEALTH[next - 1]}§7.`,
  );
  return true;
}

/** @param {Player} player */
export function toggleNightVision(player) {
  const data = getData(player);
  data.nv = !data.nv;
  saveData(player, data);
  if (data.nv) {
    if (liveState(player)) applyNightVision(player);
  } else {
    removeNightVision(player);
  }
  playerSound(player, SOUNDS.MODE, 1, data.nv ? 1.2 : 0.8);
  actionBar(player, `§7Night Vision: ${data.nv ? '§aON' : '§cOFF'}`);
}

/** @param {Player} player */
export function toggleHeal(player) {
  const data = getData(player);
  data.heal = !data.heal;
  saveData(player, data);
  playerSound(player, SOUNDS.MODE, 1, data.heal ? 1.2 : 0.8);
  actionBar(player, `§7Auto Heal: ${data.heal ? '§aON' : '§cOFF'}`);
}

/**
 * Command shot: what the player is looking at (block in Destroy mode).
 * @param {Player} player
 * @returns {boolean}
 */
export function fire(player) {
  const state = liveState(player);
  if (!state) {
    actionBar(player, '§7Summon your guardian first.');
    return false;
  }
  return commandShot(state, system.currentTick);
}

/**
 * @param {Player} player
 * @returns {{cur: number, max: number} | undefined}
 */
function guardianHealth(player) {
  const state = liveState(player);
  const health = state && state.entity ? getHealth(state.entity) : undefined;
  if (!health) return undefined;
  try {
    return { cur: Math.ceil(health.currentValue), max: Math.round(health.effectiveMax) };
  } catch {
    return undefined;
  }
}

/** @param {boolean} on */
function onOff(on) {
  return on ? '§aON' : '§cOFF';
}

/**
 * Short summary used in the menu body.
 * @param {Player} player
 * @returns {string[]}
 */
export function summaryLines(player) {
  const data = getData(player);
  const state = liveState(player);
  const hp = guardianHealth(player);
  const rage = state && state.raging ? '§4§lRAGING' : '§8calm';
  return [
    `§7Level: §f${data.level}§7/${MAX_LEVEL}    §7Health: §a${hp ? hp.cur : '?'}§7/§a${hp ? hp.max : LEVEL_HEALTH[data.level - 1]}`,
    `§7Mode: §c§l${MODE_LABELS[data.mode]}§r    §7Rage: ${rage}`,
    `§7Kills: §f${data.kills}    §7Look: ${SKINS[data.skin].text}${SKINS[data.skin].label}`,
    `§7Night Vision: ${onOff(data.nv)}§7    Auto Heal: ${onOff(data.heal)}`,
  ];
}

/**
 * Detailed status (Status sub-menu and /scriptevent ceg:status).
 * @param {Player} player
 * @returns {string[]}
 */
export function statusLines(player) {
  const data = getData(player);
  const state = liveState(player);
  const tick = system.currentTick;
  const level = data.level;
  const lines = [];
  if (!state) {
    const wait = deathCooldownSeconds(player);
    lines.push(wait > 0 ? `§4Guardian destroyed - re-forms in §f${wait}s` : data.active ? '§7Guardian: §ere-forming...' : '§7Guardian: §8not summoned');
  } else {
    const hp = guardianHealth(player);
    lines.push(`§7Guardian health: §a${hp ? hp.cur : '?'}§7/§a${hp ? hp.max : '?'}`);
    lines.push(`§7Rage: ${state.raging ? `§4§lACTIVE §r§7(${Math.max(0, Math.ceil((state.rageUntil - tick) / 20))}s)` : '§8calm'}`);
    lines.push(`§7Target: §f${state.target && isValid(state.target) ? describeTarget(state.target) : 'none'}`);
    const healLeft = Math.max(0, Math.ceil((state.healReadyTick - tick) / 20));
    lines.push(`§7Heal ready: ${data.heal ? (healLeft > 0 ? `§ein ${healLeft}s` : '§anow') : '§8disabled'}`);
  }
  lines.push(`§7Level: §f${level}§7/${MAX_LEVEL}   Mode: §c${MODE_LABELS[data.mode]}`);
  lines.push(`§7Laser: §f${LASER_DAMAGE[level - 1]}§7 dmg, §f${(LASER_COOLDOWN[level - 1] / 20).toFixed(1)}s§7 recharge, §f${LASER_RANGE[level - 1]}§7 blocks`);
  lines.push(`§7Rage: §fx1.5§7 damage, §fx2§7 fire rate, §fx1.6§7 speed, splash damage`);
  lines.push(`§7Destroy blast: §f${destroyPatternSize(level)}§7 blocks   Heal cooldown: §f${healCooldownTicks(level) / 20}s`);
  lines.push(`§7Night Vision: ${onOff(data.nv)}§7   Auto Heal: ${onOff(data.heal)}   Kills: §f${data.kills}`);
  lines.push(`§7Look: ${SKINS[data.skin].text}${SKINS[data.skin].label}`);
  return lines;
}

/** @param {Entity} entity */
function describeTarget(entity) {
  try {
    const name = entity.nameTag || entity.typeId.replace('minecraft:', '').replace(/_/g, ' ');
    return name;
  } catch {
    return 'unknown';
  }
}

/** /scriptevent ceg:status @param {Player} player */
export function sendStatus(player) {
  tell(player, `§4§l== Cursed Eyeball Guardian ==§r\n${statusLines(player).join('\n')}`);
}
