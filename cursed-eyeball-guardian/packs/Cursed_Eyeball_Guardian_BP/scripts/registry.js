// Guardian ownership & lifecycle: one guardian per player, spawn / despawn,
// binding of unowned guardians, token checks against stale copies, respawning
// after unloads / dimension changes, and the slow housekeeping loop.

import { world, system } from '@minecraft/server';
import {
  BIND_RADIUS,
  DIMENSION_IDS,
  DP_OWNER,
  DP_TOKEN,
  EVENT_DESPAWN,
  EVENT_RAGE_OFF,
  EVENT_RAGE_ON,
  GUARDIAN_ID,
  LEVEL_HEALTH,
  MOVE,
  PARTICLES,
  PROP_LEVEL,
  PROP_MODE,
  PROP_RAGE,
  PROP_SKIN,
  SOUNDS,
  TIMING,
  levelEvent,
} from './config.js';
import { getData, newToken, saveData } from './store.js';
import {
  findOnlinePlayer,
  getHealth,
  isAlive,
  isValid,
  playSoundAt,
  spawnFx,
  tell,
  warnOnce,
} from './util.js';
import { spotNearOwner } from './placement.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('./store.js').GuardianData} GuardianData */

/**
 * Runtime state of one player's guardian (not persisted).
 * @typedef GuardianState
 * @property {string} ownerId
 * @property {Player} owner
 * @property {Entity | undefined} entity        live guardian handle
 * @property {string} entityId                  id of the last attached guardian (kept after it vanishes)
 * @property {number} phase                     0-19, staggers periodic work between guardians
 * @property {Entity | undefined} target        current laser target
 * @property {'' | 'revenge' | 'command' | 'auto'} targetKind
 * @property {Entity | undefined} revenge       whoever hurt the owner recently
 * @property {number} revengeUntil
 * @property {Entity | undefined} command       commanded / assisted target
 * @property {number} commandUntil
 * @property {number} blockedShots              consecutive shots blocked by terrain
 * @property {number} cooldownUntil             laser ready tick
 * @property {number} destroyReadyTick
 * @property {number} healReadyTick
 * @property {boolean} raging
 * @property {number} rageUntil
 * @property {number} yaw
 * @property {number} pitch
 * @property {number} smoothYaw                 smoothed owner yaw used for the shoulder anchor
 * @property {Vector3 | undefined} lastCenter
 * @property {number} stuckTicks
 * @property {number} anchorCheckTick
 * @property {Vector3 | undefined} anchorShift  correction added to the raw anchor (obstacle avoidance)
 * @property {number} nextSpawnTick             0 = no respawn scheduled
 * @property {number} spawnFailures
 * @property {number} attachedTick
 * @property {number} lastCombatTick
 * @property {number} lastTeleportFxTick
 * @property {number} levelFixes
 */

/** ownerId -> state, only for players whose guardian should exist. @type {Map<string, GuardianState>} */
export const guardians = new Map();
/** guardian entity id -> owner id. @type {Map<string, string>} */
const entityOwners = new Map();
/** guardian entity ids we already told to despawn -> tick. @type {Map<string, number>} */
const doomed = new Map();
/** guardians whose owner is offline: id -> {entity, since}. @type {Map<string, {entity: Entity, since: number}>} */
const orphans = new Map();
/** ids of guardians spawned by this script (skip the "unowned" path while we set them up). @type {Set<string>} */
const ownSpawns = new Set();

// ---------------------------------------------------------------------------
// State access
// ---------------------------------------------------------------------------

/** @param {string} ownerId */
export function getState(ownerId) {
  return guardians.get(ownerId);
}

/** Owner id of a guardian entity id we know about. @param {string} entityId */
export function ownerOfEntity(entityId) {
  return entityOwners.get(entityId);
}

/**
 * The player's live guardian entity, if any.
 * @param {Player} player
 * @returns {Entity | undefined}
 */
export function liveGuardian(player) {
  const state = guardians.get(player.id);
  return state && isValid(state.entity) ? state.entity : undefined;
}

/**
 * Live state (owner + guardian valid) or undefined.
 * @param {Player} player
 */
export function liveState(player) {
  const state = guardians.get(player.id);
  return state && isValid(state.entity) && isValid(state.owner) ? state : undefined;
}

/** @param {Player} player @returns {GuardianState} */
function createState(player) {
  let yaw = 0;
  try {
    yaw = player.getRotation().y;
  } catch {
    // default
  }
  return {
    ownerId: player.id,
    owner: player,
    entity: undefined,
    entityId: '',
    phase: Math.floor(Math.random() * 20),
    target: undefined,
    targetKind: '',
    revenge: undefined,
    revengeUntil: 0,
    command: undefined,
    commandUntil: 0,
    blockedShots: 0,
    cooldownUntil: 0,
    destroyReadyTick: 0,
    healReadyTick: 0,
    raging: false,
    rageUntil: 0,
    yaw,
    pitch: 0,
    smoothYaw: yaw,
    lastCenter: undefined,
    stuckTicks: 0,
    anchorCheckTick: 0,
    anchorShift: undefined,
    nextSpawnTick: 0,
    spawnFailures: 0,
    attachedTick: 0,
    lastCombatTick: 0,
    lastTeleportFxTick: -1000,
    levelFixes: 0,
  };
}

/**
 * Gets or creates the runtime state for a player and refreshes the player handle.
 * @param {Player} player
 * @returns {GuardianState}
 */
export function ensureState(player) {
  let state = guardians.get(player.id);
  if (!state) {
    state = createState(player);
    guardians.set(player.id, state);
  }
  state.owner = player;
  return state;
}

/** @param {GuardianState} state */
export function clearTargets(state) {
  state.target = undefined;
  state.targetKind = '';
  state.revenge = undefined;
  state.revengeUntil = 0;
  state.command = undefined;
  state.commandUntil = 0;
  state.blockedShots = 0;
}

/**
 * Removes the state (and optionally the guardian entity).
 * @param {string} ownerId @param {boolean} despawn
 */
export function dropState(ownerId, despawn) {
  const state = guardians.get(ownerId);
  if (!state) return;
  if (despawn && state.entity) despawnEntity(state.entity);
  guardians.delete(ownerId);
}

// ---------------------------------------------------------------------------
// Entity visuals
// ---------------------------------------------------------------------------

/**
 * Sets the rage entity property (falls back to the data-driven event).
 * @param {Entity} entity @param {boolean} on
 */
export function setRageVisual(entity, on) {
  try {
    entity.setProperty(PROP_RAGE, on);
  } catch {
    try {
      entity.triggerEvent(on ? EVENT_RAGE_ON : EVENT_RAGE_OFF);
    } catch {
      // entity gone
    }
  }
}

/**
 * Pushes skin / mode / level (and optionally the health group) to the entity.
 * @param {Entity} entity @param {GuardianData} data @param {boolean} withLevelEvent
 */
export function applyAppearance(entity, data, withLevelEvent) {
  try {
    if (withLevelEvent) entity.triggerEvent(levelEvent(data.level));
    entity.setProperty(PROP_LEVEL, data.level);
    entity.setProperty(PROP_SKIN, data.skin);
    entity.setProperty(PROP_MODE, data.mode);
  } catch (error) {
    warnOnce('appearance', error);
  }
  setRageVisual(entity, false);
}

// ---------------------------------------------------------------------------
// Spawn / despawn
// ---------------------------------------------------------------------------

/**
 * Removes a guardian: data-driven instant_despawn first, entity.remove() as fallback.
 * @param {Entity} entity
 */
export function despawnEntity(entity) {
  let id = '';
  try {
    id = entity.id;
  } catch {
    // invalid handle
  }
  if (id) {
    doomed.set(id, system.currentTick);
    entityOwners.delete(id);
    orphans.delete(id);
    ownSpawns.delete(id);
  }
  if (!isValid(entity)) return;
  try {
    entity.triggerEvent(EVENT_DESPAWN);
    return;
  } catch {
    // fall through
  }
  try {
    entity.remove();
  } catch (error) {
    warnOnce('despawn', error);
  }
}

/**
 * Binds an entity handle to a state and resets motion bookkeeping.
 * @param {GuardianState} state @param {Entity} entity @param {number} tick
 */
function attachEntity(state, entity, tick) {
  if (state.entityId && state.entityId !== entity.id) entityOwners.delete(state.entityId);
  state.entity = entity;
  state.entityId = entity.id;
  entityOwners.set(entity.id, state.ownerId);
  state.attachedTick = tick;
  state.nextSpawnTick = 0;
  state.lastCenter = undefined;
  state.stuckTicks = 0;
  state.anchorShift = undefined;
  state.anchorCheckTick = 0;
  state.raging = false;
  state.rageUntil = 0;
  state.levelFixes = 0;
  state.target = undefined;
  state.targetKind = '';
}

/** @param {GuardianState} state */
function respawnBackoff(state) {
  const steps = Math.min(Math.max(0, state.spawnFailures - 1), TIMING.MAX_RESPAWN_BACKOFF_STEPS);
  return TIMING.MISSING_RESPAWN_DELAY * Math.pow(2, steps);
}

/**
 * Spawns a fresh guardian next to the player (replacing any previous one) with
 * a new token. Returns undefined (and schedules a retry) if the spot is not loaded.
 * @param {Player} player @param {boolean} withFx
 * @returns {Entity | undefined}
 */
export function spawnGuardianFor(player, withFx) {
  const tick = system.currentTick;
  const state = ensureState(player);
  const data = getData(player);
  if (state.entity && isValid(state.entity)) despawnEntity(state.entity);
  state.entity = undefined;

  /** @type {Entity} */
  let entity;
  /** @type {Vector3} */
  let spot;
  try {
    spot = spotNearOwner(player, tick + state.phase * 13);
    entity = player.dimension.spawnEntity(GUARDIAN_ID, { x: spot.x, y: spot.y - MOVE.EYE_OFFSET, z: spot.z });
  } catch (error) {
    state.spawnFailures++;
    state.nextSpawnTick = tick + respawnBackoff(state);
    warnOnce('spawn', error);
    return undefined;
  }

  ownSpawns.add(entity.id);
  data.active = true;
  data.token = newToken(data.token);
  saveData(player, data);
  try {
    entity.setDynamicProperty(DP_OWNER, player.id);
    entity.setDynamicProperty(DP_TOKEN, data.token);
  } catch (error) {
    warnOnce('tag guardian', error);
  }
  attachEntity(state, entity, tick);
  applyAppearance(entity, data, true);
  if (withFx) {
    spawnFx(player.dimension, PARTICLES.SUMMON, spot, data.skin);
    playSoundAt(SOUNDS.SUMMON, spot, 1, 1);
  }
  return entity;
}

/**
 * Teleports the guardian to a free spot next to its owner (teleport FX at both ends).
 * @param {GuardianState} state @param {number} tick @param {boolean} withFx
 */
export function teleportGuardianToOwner(state, tick, withFx) {
  const entity = state.entity;
  const owner = state.owner;
  if (!isValid(entity) || !isValid(owner)) return false;
  const skin = getData(owner).skin;
  let from;
  try {
    const l = entity.location;
    from = { x: l.x, y: l.y + MOVE.EYE_OFFSET, z: l.z };
  } catch {
    return false;
  }
  const to = spotNearOwner(owner, tick + state.phase * 13);
  try {
    if (entity.dimension.id !== owner.dimension.id) return false;
    entity.teleport({ x: to.x, y: to.y - MOVE.EYE_OFFSET, z: to.z }, { keepVelocity: false, checkForBlocks: false });
    entity.clearVelocity();
  } catch (error) {
    warnOnce('teleport', error);
    return false;
  }
  state.lastCenter = undefined;
  state.stuckTicks = 0;
  state.anchorShift = undefined;
  if (withFx && tick - state.lastTeleportFxTick >= TIMING.TELEPORT_FX_COOLDOWN) {
    state.lastTeleportFxTick = tick;
    spawnFx(owner.dimension, PARTICLES.TELEPORT, from, skin);
    spawnFx(owner.dimension, PARTICLES.TELEPORT, to, skin);
    playSoundAt(SOUNDS.TELEPORT, from, 0.8, 1);
    playSoundAt(SOUNDS.TELEPORT, to, 0.8, 1.1);
  }
  return true;
}

/**
 * Despawns the current guardian and schedules a fresh one (dimension change etc.).
 * @param {GuardianState} state @param {number} tick @param {number} delay
 */
export function scheduleRespawn(state, tick, delay) {
  if (state.entity) despawnEntity(state.entity);
  state.entity = undefined;
  state.spawnFailures = 0;
  state.nextSpawnTick = tick + delay;
  clearTargets(state);
  state.raging = false;
}

// ---------------------------------------------------------------------------
// Registration of guardians found in the world
// ---------------------------------------------------------------------------

/**
 * Called for every guardian that loads/spawns: attaches it to its owner, or
 * despawns it when it is a stale copy, or binds it when unowned.
 * @param {Entity} entity
 */
export function registerGuardian(entity) {
  if (!isValid(entity)) return;
  let id;
  /** @type {unknown} */
  let ownerId;
  /** @type {unknown} */
  let token;
  try {
    if (entity.typeId !== GUARDIAN_ID) return;
    id = entity.id;
    if (doomed.has(id)) return;
    ownerId = entity.getDynamicProperty(DP_OWNER);
    token = entity.getDynamicProperty(DP_TOKEN);
  } catch {
    return;
  }
  if (typeof ownerId !== 'string' || ownerId.length === 0) {
    if (!ownSpawns.has(id)) bindUnowned(entity);
    return;
  }
  const knownState = guardians.get(ownerId);
  const owner = knownState && isValid(knownState.owner) ? knownState.owner : findOnlinePlayer(ownerId);
  if (!owner) {
    // Owner offline (or not joined yet): give them a grace period before despawning.
    if (!orphans.has(id)) orphans.set(id, { entity, since: system.currentTick });
    return;
  }
  orphans.delete(id);
  const data = getData(owner);
  if (!data.active || typeof token !== 'number' || token !== data.token) {
    despawnEntity(entity);
    return;
  }
  const state = ensureState(owner);
  if (state.entity && state.entityId === id) {
    state.entity = entity; // same guardian re-loaded: refresh the handle
    return;
  }
  if (state.entity && isValid(state.entity)) {
    despawnEntity(entity); // duplicate of the live guardian
    return;
  }
  attachEntity(state, entity, system.currentTick);
  applyAppearance(entity, data, false);
}

/**
 * A guardian without an owner (spawn egg, /summon) binds to the nearest player
 * within 32 blocks, replacing that player's previous guardian; else it despawns.
 * @param {Entity} entity
 */
export function bindUnowned(entity) {
  /** @type {Player | undefined} */
  let player;
  try {
    player = entity.dimension.getPlayers({ location: entity.location, maxDistance: BIND_RADIUS, closest: 1 })[0];
  } catch {
    player = undefined;
  }
  if (!player) {
    despawnEntity(entity);
    return;
  }
  const state = ensureState(player);
  if (state.entity && isValid(state.entity) && state.entity.id !== entity.id) despawnEntity(state.entity);
  const data = getData(player);
  data.active = true;
  data.deadUntil = 0;
  data.token = newToken(data.token);
  saveData(player, data);
  try {
    entity.setDynamicProperty(DP_OWNER, player.id);
    entity.setDynamicProperty(DP_TOKEN, data.token);
  } catch (error) {
    warnOnce('bind', error);
    return;
  }
  attachEntity(state, entity, system.currentTick);
  applyAppearance(entity, data, true);
  try {
    const l = entity.location;
    const eye = { x: l.x, y: l.y + MOVE.EYE_OFFSET, z: l.z };
    spawnFx(entity.dimension, PARTICLES.SUMMON, eye, data.skin);
    playSoundAt(SOUNDS.SUMMON, eye, 1, 1);
  } catch {
    // ignore
  }
  tell(player, '§cA Cursed Floating Eyeball Guardian has bound itself to you. §7Use the §fEyeball Ability Controller§7 to command it.');
}

/** Initial scan after (re)load: register every guardian and wake up active players. */
export function bootstrap() {
  const tick = system.currentTick;
  for (const dimensionId of DIMENSION_IDS) {
    try {
      for (const entity of world.getDimension(dimensionId).getEntities({ type: GUARDIAN_ID })) registerGuardian(entity);
    } catch (error) {
      warnOnce('bootstrap', error);
    }
  }
  for (const player of world.getAllPlayers()) {
    const data = getData(player);
    if (!data.active) continue;
    const state = ensureState(player);
    if (!isValid(state.entity) && !state.nextSpawnTick) state.nextSpawnTick = tick + TIMING.MISSING_RESPAWN_DELAY;
  }
}

// ---------------------------------------------------------------------------
// Player lifecycle
// ---------------------------------------------------------------------------

/** @param {string} playerId */
export function handlePlayerLeave(playerId) {
  // Keep data.active so the guardian comes back when the player returns.
  dropState(playerId, true);
}

/**
 * @param {Player} player @param {boolean} initialSpawn
 */
export function handlePlayerSpawn(player, initialSpawn) {
  const data = getData(player);
  if (!data.active) return;
  const state = ensureState(player);
  if (!initialSpawn) return; // respawn after death: the tick loop handles distance/dimension
  adoptOrphansOf(player);
  if (!isValid(state.entity)) {
    state.spawnFailures = 0;
    state.nextSpawnTick = system.currentTick + TIMING.JOIN_RESPAWN_DELAY;
  }
}

/** @param {Player} player */
export function handleDimensionChange(player) {
  const state = guardians.get(player.id);
  if (!state) return;
  state.owner = player;
  scheduleRespawn(state, system.currentTick, TIMING.DIMENSION_RESPAWN_DELAY);
}

/** Registers waiting guardians of a player that just came online. @param {Player} player */
function adoptOrphansOf(player) {
  for (const [id, orphan] of orphans) {
    if (!isValid(orphan.entity)) {
      orphans.delete(id);
      continue;
    }
    let ownerId;
    try {
      ownerId = orphan.entity.getDynamicProperty(DP_OWNER);
    } catch {
      ownerId = undefined;
    }
    if (ownerId === player.id) {
      orphans.delete(id);
      registerGuardian(orphan.entity);
    }
  }
}

/**
 * The guardian died: summoning is locked for 30 s.
 * @param {string} entityId
 */
export function handleGuardianDeath(entityId) {
  const ownerId = entityOwners.get(entityId);
  if (!ownerId) return;
  entityOwners.delete(entityId);
  const state = guardians.get(ownerId);
  if (!state || state.entityId !== entityId) return; // a stale copy died
  const owner = state.owner;
  guardians.delete(ownerId);
  if (!isValid(owner)) return;
  const data = getData(owner);
  data.active = false;
  data.deadUntil = Date.now() + TIMING.DEATH_COOLDOWN_MS;
  saveData(owner, data);
  tell(owner, '§4Your Cursed Eyeball Guardian has been destroyed! §7It can be summoned again in §f30§7 seconds.');
}

/**
 * Adds a kill to the owner's lifetime counter.
 * @param {string} ownerId
 * @returns {number} new kill count (0 if the owner is offline)
 */
export function addKill(ownerId) {
  const state = guardians.get(ownerId);
  const owner = state && isValid(state.owner) ? state.owner : findOnlinePlayer(ownerId);
  if (!owner) return 0;
  const data = getData(owner);
  data.kills++;
  saveData(owner, data);
  return data.kills;
}

// ---------------------------------------------------------------------------
// Per-tick maintenance
// ---------------------------------------------------------------------------

/**
 * Keeps one guardian alive per active player. Returns true when the guardian is
 * live and should run its brain this tick.
 * @param {GuardianState} state @param {number} tick
 */
export function maintainState(state, tick) {
  const owner = state.owner;
  if (!isValid(owner)) return false;
  const entity = state.entity;
  if (entity && isValid(entity)) {
    if (state.spawnFailures && tick - state.attachedTick > TIMING.STABLE_LIFE) state.spawnFailures = 0;
    return true;
  }
  if (entity) {
    // Just lost it (unloaded chunk, removed by another addon, /kill without event...).
    if (tick - state.attachedTick < TIMING.SHORT_LIFE) state.spawnFailures++;
    state.entity = undefined;
    clearTargets(state);
    state.raging = false;
    if (!state.nextSpawnTick) state.nextSpawnTick = tick + respawnBackoff(state);
  }
  if (!state.nextSpawnTick) state.nextSpawnTick = tick + TIMING.MISSING_RESPAWN_DELAY;
  if (tick < state.nextSpawnTick) return false;

  const data = getData(owner);
  if (!data.active) {
    guardians.delete(state.ownerId);
    return false;
  }
  if (!isAlive(owner)) {
    state.nextSpawnTick = tick + 20; // wait until the owner respawns
    return false;
  }
  state.nextSpawnTick = 0;
  spawnGuardianFor(owner, true); // on failure it schedules its own retry
  return false;
}

/**
 * Housekeeping every SLOW_INTERVAL ticks: player/state sync, orphan grace
 * period, level/health sync and pruning of bookkeeping maps.
 * @param {number} tick
 */
export function slowTick(tick) {
  for (const player of world.getAllPlayers()) {
    const data = getData(player);
    const state = guardians.get(player.id);
    if (data.active && !state) {
      const created = ensureState(player);
      created.nextSpawnTick = tick + TIMING.JOIN_RESPAWN_DELAY;
    } else if (!data.active && state) {
      dropState(player.id, true);
    } else if (state) {
      state.owner = player;
    }
  }
  for (const [ownerId, state] of guardians) {
    if (!isValid(state.owner)) dropState(ownerId, true);
  }

  for (const [id, orphan] of orphans) {
    if (!isValid(orphan.entity)) {
      orphans.delete(id);
      continue;
    }
    let ownerId;
    try {
      ownerId = orphan.entity.getDynamicProperty(DP_OWNER);
    } catch {
      ownerId = undefined;
    }
    if (typeof ownerId === 'string' && findOnlinePlayer(ownerId)) {
      orphans.delete(id);
      registerGuardian(orphan.entity);
    } else if (tick - orphan.since > TIMING.ORPHAN_GRACE) {
      despawnEntity(orphan.entity);
    }
  }

  // The health component lives in level groups; make sure the right one is active
  // (covers spawn-event ordering and level changes while the guardian was unloaded).
  for (const state of guardians.values()) {
    const entity = state.entity;
    if (!isValid(entity) || state.levelFixes >= TIMING.MAX_LEVEL_FIXES) continue;
    const level = getData(state.owner).level;
    const health = getHealth(entity);
    if (!health) continue;
    try {
      if (Math.round(health.effectiveMax) !== LEVEL_HEALTH[level - 1]) {
        state.levelFixes++;
        entity.triggerEvent(levelEvent(level));
        entity.setProperty(PROP_LEVEL, level);
      }
    } catch {
      // unloaded
    }
  }

  for (const [id, since] of doomed) {
    if (tick - since > TIMING.DOOMED_MEMORY) doomed.delete(id);
  }
  for (const id of ownSpawns) {
    if (!entityOwners.has(id)) ownSpawns.delete(id);
  }
}

/**
 * Every SWEEP_INTERVAL ticks: look for guardians near active owners that slipped
 * past the load events (duplicates, copies from structures...).
 */
export function sweep() {
  for (const state of guardians.values()) {
    if (!isValid(state.owner)) continue;
    let found;
    try {
      found = state.owner.dimension.getEntities({
        type: GUARDIAN_ID,
        location: state.owner.location,
        maxDistance: TIMING.SWEEP_RADIUS,
      });
    } catch {
      continue;
    }
    for (const entity of found) {
      let id;
      try {
        id = entity.id;
      } catch {
        continue;
      }
      if (entityOwners.has(id) && isValid(guardians.get(entityOwners.get(id) ?? '')?.entity)) continue;
      registerGuardian(entity);
    }
  }
}
