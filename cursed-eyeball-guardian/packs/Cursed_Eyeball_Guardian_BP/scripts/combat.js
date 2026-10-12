// Combat: target selection, the eye laser, rage mode, protection reactions,
// kill credit, the destroy laser and commanded shots.

import { BlockPermutation, EntityDamageCause } from '@minecraft/server';
import {
  ANIM_ATTACK,
  AUTO_EXCLUDED_TYPES,
  DESTROY,
  GUARDIAN_ID,
  LASER,
  LASER_COOLDOWN,
  LASER_DAMAGE,
  LASER_RANGE,
  MODE,
  MOVE,
  PARTICLES,
  PLAYER_TYPE_ID,
  PROTECTED_BLOCKS,
  RAGE,
  SOUNDS,
  TIMING,
} from './config.js';
import { getData } from './store.js';
import { clearTargets, setRageVisual } from './registry.js';
import {
  actionBar,
  add,
  colorMap,
  displayName,
  distance,
  getHealth,
  hasLineOfSight,
  isAlive,
  isTamed,
  isValid,
  lerpVec,
  normalize,
  playSoundAt,
  scale,
  spawnFx,
  sub,
  warnOnce,
  yawPitch,
} from './util.js';

/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').EntityDamageSource} EntityDamageSource */
/** @typedef {import('./registry.js').GuardianState} GuardianState */

/** Entities hit by a laser recently: id -> {ownerId, tick} (kill credit). @type {Map<string, {ownerId: string, tick: number}>} */
const recentHits = new Map();

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Eye centre of a guardian. @param {Entity} guardian @returns {Vector3} */
export function guardianEye(guardian) {
  const l = guardian.location;
  return { x: l.x, y: l.y + MOVE.EYE_OFFSET, z: l.z };
}

/**
 * Where to aim on a target: ~70 % of its height (body centre for most mobs).
 * @param {Entity} entity @returns {Vector3}
 */
export function aimPoint(entity) {
  const l = entity.location;
  let height = 0.9;
  try {
    height = Math.max(0.3, entity.getHeadLocation().y - l.y);
  } catch {
    // keep default
  }
  return { x: l.x, y: l.y + height * 0.7, z: l.z };
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

/**
 * Can this guardian shoot at `entity`? Never the owner, other guardians or tamed
 * mobs; players only when `allowPlayers` (revenge / commanded shots).
 * @param {Entity | undefined} entity @param {GuardianState} state @param {boolean} allowPlayers
 * @returns {entity is Entity}
 */
export function isValidTarget(entity, state, allowPlayers) {
  if (!isAlive(entity)) return false;
  try {
    if (entity.id === state.ownerId) return false;
    if (entity.typeId === GUARDIAN_ID) return false;
    if (entity.typeId === PLAYER_TYPE_ID && !allowPlayers) return false;
    if (isTamed(entity)) return false;
    const guardian = state.entity;
    if (guardian && entity.dimension.id !== guardian.dimension.id) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Nearest hostile (family monster, minus neutral ones) around the owner that
 * the guardian can see. At most 3 line-of-sight raycasts per scan.
 * @param {GuardianState} state @param {number} range
 * @returns {Entity | undefined}
 */
export function scanForHostile(state, range) {
  const guardian = state.entity;
  if (!guardian) return undefined;
  /** @type {Entity[]} */
  let candidates;
  try {
    candidates = state.owner.dimension.getEntities({
      location: state.owner.location,
      maxDistance: range,
      families: ['monster'],
      excludeTypes: AUTO_EXCLUDED_TYPES,
      closest: 6,
    });
  } catch {
    return undefined;
  }
  let eye;
  try {
    eye = guardianEye(guardian);
  } catch {
    return undefined;
  }
  let raycasts = 0;
  for (const candidate of candidates) {
    if (!isValidTarget(candidate, state, false)) continue;
    if (raycasts++ >= 3) break;
    if (hasLineOfSight(guardian.dimension, eye, aimPoint(candidate))) return candidate;
  }
  return undefined;
}

/** @param {GuardianState} state @param {Entity} target @param {GuardianState['targetKind']} kind */
export function setTarget(state, target, kind) {
  if (state.target !== target) state.blockedShots = 0;
  state.target = target;
  state.targetKind = kind;
}

/** @param {GuardianState} state */
export function clearTarget(state) {
  state.target = undefined;
  state.targetKind = '';
  state.blockedShots = 0;
}

// ---------------------------------------------------------------------------
// Laser
// ---------------------------------------------------------------------------

/**
 * Particle beam from `from` to `to` (one ceg:laser_segment every ~0.35 blocks,
 * capped at 48 per beam for mobile).
 * @param {Dimension} dimension @param {Vector3} from @param {Vector3} to @param {number} skin
 */
export function drawBeam(dimension, from, to, skin) {
  const len = distance(from, to);
  const count = Math.max(1, Math.min(LASER.MAX_SEGMENTS, Math.ceil(len / LASER.SEGMENT_STEP)));
  const map = colorMap(skin);
  try {
    for (let i = 0; i < count; i++) {
      dimension.spawnParticle(PARTICLES.LASER_SEGMENT, lerpVec(from, to, (i + 0.5) / count), map);
    }
  } catch {
    // part of the beam is in an unloaded chunk
  }
}

/**
 * Applies laser damage. Attributing it to the owner gives them XP/loot credit.
 * @param {Entity} target @param {number} amount @param {Entity} source
 */
function damage(target, amount, source) {
  try {
    return target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: source });
  } catch {
    try {
      return target.applyDamage(amount);
    } catch {
      return false;
    }
  }
}

/**
 * Pushes `target` away from `origin`.
 * @param {Entity} target @param {Vector3} origin @param {number} horizontal @param {number} vertical
 */
function knockback(target, origin, horizontal, vertical) {
  try {
    const l = target.location;
    let dx = l.x - origin.x;
    let dz = l.z - origin.z;
    const h = Math.sqrt(dx * dx + dz * dz);
    if (h < 1e-3) {
      dx = 0;
      dz = 1;
    } else {
      dx /= h;
      dz /= h;
    }
    target.applyKnockback(dx, dz, horizontal, vertical);
  } catch {
    // some entities (e.g. riding players) reject knockback
  }
}

/** @param {GuardianState} state @param {number} level */
function cooldownFor(state, level) {
  const base = LASER_COOLDOWN[level - 1];
  return Math.max(LASER.MIN_COOLDOWN, Math.round(state.raging ? base * RAGE.COOLDOWN_MULT : base));
}

/**
 * Tries to shoot the current target: needs range and line of sight.
 * @param {GuardianState} state @param {number} tick
 * @returns {boolean} fired
 */
export function tryFire(state, tick) {
  const guardian = state.entity;
  const target = state.target;
  if (!isValid(guardian) || !target) return false;
  if (!isValidTarget(target, state, state.targetKind !== 'auto')) {
    clearTarget(state);
    return false;
  }
  const data = getData(state.owner);
  if (data.mode === MODE.PASSIVE) return false;
  let eye;
  let aim;
  try {
    eye = guardianEye(guardian);
    aim = aimPoint(target);
  } catch {
    return false;
  }
  const range = state.targetKind === 'command' ? Math.max(LASER.COMMAND_RANGE, LASER_RANGE[data.level - 1]) : LASER_RANGE[data.level - 1];
  if (distance(eye, aim) > range) return false;
  if (!hasLineOfSight(guardian.dimension, eye, aim)) {
    state.cooldownUntil = tick + 5;
    state.blockedShots++;
    if (state.targetKind === 'auto' && state.blockedShots >= LASER.MAX_BLOCKED_SHOTS) clearTarget(state);
    return false;
  }
  state.blockedShots = 0;
  fireLaser(state, target, eye, aim, tick);
  return true;
}

/**
 * Fires the eye laser at `target` (no checks): animation, sound, beam, damage,
 * knockback, impact burst and rage splash.
 * @param {GuardianState} state @param {Entity} target @param {Vector3} eye @param {Vector3} aim @param {number} tick
 */
export function fireLaser(state, target, eye, aim, tick) {
  const guardian = state.entity;
  if (!guardian) return;
  const owner = state.owner;
  const data = getData(owner);
  const level = data.level;
  const dimension = guardian.dimension;
  const dir = normalize(sub(aim, eye));
  const lens = add(eye, scale(dir, LASER.LENS_FORWARD));

  // Snap the eye onto the target so the beam leaves the lens.
  const look = yawPitch(eye, aim);
  state.yaw = look.yaw;
  state.pitch = look.pitch;
  try {
    guardian.setRotation({ x: look.pitch, y: look.yaw });
    guardian.playAnimation(ANIM_ATTACK, { blendOutTime: 0.1 });
  } catch {
    // ignore
  }

  playSoundAt(SOUNDS.LASER, eye, 1, (state.raging ? 1.15 : 0.95) + Math.random() * 0.1);
  spawnFx(dimension, PARTICLES.LASER_CHARGE, lens, data.skin);
  drawBeam(dimension, lens, aim, data.skin);

  const amount = LASER_DAMAGE[level - 1] * (state.raging ? RAGE.DAMAGE_MULT : 1);
  const source = isAlive(owner) ? owner : guardian;
  damage(target, amount, source);
  knockback(target, eye, LASER.KNOCKBACK_H, LASER.KNOCKBACK_V);
  try {
    recentHits.set(target.id, { ownerId: state.ownerId, tick });
  } catch {
    // target vanished
  }

  spawnFx(dimension, PARTICLES.IMPACT, aim, data.skin);
  playSoundAt(SOUNDS.IMPACT, aim, 0.9, 0.9 + Math.random() * 0.2);

  if (state.raging) rageSplash(state, target, aim, amount * RAGE.SPLASH_FACTOR, source, tick);

  state.cooldownUntil = tick + cooldownFor(state, level);
  state.lastCombatTick = tick;
}

/**
 * Rage splash: 50 % damage to other hostiles within 2.5 blocks of the impact.
 * @param {GuardianState} state @param {Entity} primary @param {Vector3} center
 * @param {number} amount @param {Entity} source @param {number} tick
 */
function rageSplash(state, primary, center, amount, source, tick) {
  const guardian = state.entity;
  if (!guardian) return;
  /** @type {Entity[]} */
  let nearby;
  try {
    nearby = guardian.dimension.getEntities({
      location: center,
      maxDistance: RAGE.SPLASH_RADIUS,
      families: ['monster'],
      excludeTypes: AUTO_EXCLUDED_TYPES,
      closest: RAGE.SPLASH_MAX + 1,
    });
  } catch {
    return;
  }
  for (const entity of nearby) {
    if (entity === primary || !isValidTarget(entity, state, false)) continue;
    try {
      if (entity.id === primary.id) continue;
    } catch {
      continue;
    }
    damage(entity, amount, source);
    knockback(entity, center, LASER.KNOCKBACK_H * 0.7, LASER.KNOCKBACK_V);
    try {
      recentHits.set(entity.id, { ownerId: state.ownerId, tick });
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Rage
// ---------------------------------------------------------------------------

/**
 * Starts or extends rage (10 s). Visual property + burst + scream on activation.
 * @param {GuardianState} state @param {number} tick
 */
export function startRage(state, tick) {
  const guardian = state.entity;
  if (!isValid(guardian)) return;
  const wasRaging = state.raging;
  state.raging = true;
  state.rageUntil = tick + RAGE.DURATION;
  if (wasRaging) return;
  setRageVisual(guardian, true);
  const skin = getData(state.owner).skin;
  try {
    const eye = guardianEye(guardian);
    spawnFx(guardian.dimension, PARTICLES.RAGE_BURST, eye, skin);
    playSoundAt(SOUNDS.RAGE, eye, 1, 1);
  } catch {
    // ignore
  }
  actionBar(state.owner, '§4§lRAGE MODE! §r§cYour guardian is enraged - faster, stronger lasers!');
}

/** @param {GuardianState} state */
export function endRage(state) {
  state.raging = false;
  state.rageUntil = 0;
  if (isValid(state.entity)) setRageVisual(state.entity, false);
}

// ---------------------------------------------------------------------------
// Protection reactions
// ---------------------------------------------------------------------------

/**
 * Is `attacker` someone the guardian may retaliate against?
 * @param {GuardianState} state @param {Entity | undefined} attacker
 * @returns {attacker is Entity}
 */
function isRetaliationTarget(state, attacker) {
  if (!attacker || !isValid(attacker)) return false;
  try {
    if (attacker.id === state.ownerId) return false; // self damage
    if (attacker.typeId === GUARDIAN_ID) return false;
    if (state.entity && attacker.id === state.entity.id) return false;
  } catch {
    return false;
  }
  return !isTamed(attacker);
}

/**
 * Owner got hurt: lock onto the attacker, rage, and shoot immediately if ready.
 * @param {GuardianState} state @param {EntityDamageSource} source @param {number} tick
 */
export function onOwnerHurt(state, source, tick) {
  const data = getData(state.owner);
  if (data.mode === MODE.PASSIVE) return;
  const attacker = source.damagingEntity;
  if (!isRetaliationTarget(state, attacker)) return;
  state.revenge = attacker;
  state.revengeUntil = tick + TIMING.REVENGE_DURATION;
  setTarget(state, attacker, 'revenge');
  startRage(state, tick);
  if (tick >= state.cooldownUntil) tryFire(state, tick);
}

/**
 * Guardian got hurt: fight back (no rage) unless it already has a revenge target.
 * @param {GuardianState} state @param {EntityDamageSource} source @param {number} tick
 */
export function onGuardianHurt(state, source, tick) {
  state.lastCombatTick = tick;
  const data = getData(state.owner);
  if (data.mode === MODE.PASSIVE) return;
  const attacker = source.damagingEntity;
  if (!isRetaliationTarget(state, attacker)) return;
  if (state.revenge && tick < state.revengeUntil && isAlive(state.revenge)) return;
  state.revenge = attacker;
  state.revengeUntil = tick + TIMING.GUARDIAN_REVENGE_DURATION;
  setTarget(state, attacker, 'revenge');
}

/**
 * Owner melee-hit something: the guardian assists on that target.
 * @param {GuardianState} state @param {Entity} hit @param {number} tick
 */
export function onOwnerHitEntity(state, hit, tick) {
  const data = getData(state.owner);
  if (data.mode === MODE.PASSIVE) return;
  if (!isValidTarget(hit, state, false)) return;
  if (!getHealth(hit)) return;
  state.command = hit;
  state.commandUntil = tick + TIMING.ASSIST_DURATION;
  if (state.targetKind !== 'revenge') setTarget(state, hit, 'command');
}

/**
 * Kill credit: returns the owner id when the dead entity was lasered recently.
 * @param {string} entityId @param {number} tick
 * @returns {string | undefined}
 */
export function creditKill(entityId, tick) {
  const hit = recentHits.get(entityId);
  if (!hit) return undefined;
  recentHits.delete(entityId);
  return tick - hit.tick <= TIMING.KILL_CREDIT ? hit.ownerId : undefined;
}

/** Drops old kill-credit entries. @param {number} tick */
export function pruneCombat(tick) {
  for (const [id, hit] of recentHits) {
    if (tick - hit.tick > TIMING.KILL_CREDIT * 2) recentHits.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Destroy laser
// ---------------------------------------------------------------------------

/** @returns {Vector3[][]} block offsets per level (index 0 = level 1) */
function buildDestroyPatterns() {
  const single = [{ x: 0, y: 0, z: 0 }];
  const plus = [
    ...single,
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];
  /** @type {Vector3[]} */
  const cube = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cube.push({ x, y, z });
  /** @type {Vector3[]} */
  const sphere = [];
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) if (x * x + y * y + z * z <= 4) sphere.push({ x, y, z });
    }
  }
  return [single, plus, cube, cube, sphere];
}

const DESTROY_PATTERNS = buildDestroyPatterns();

/** @type {string[] | undefined} */
let protectedNames;

/** Protected block ids that exist in this game version (resolved once, lazily). */
function getProtectedNames() {
  if (!protectedNames) {
    protectedNames = PROTECTED_BLOCKS.filter((name) => {
      try {
        BlockPermutation.resolve(name);
        return true;
      } catch {
        return false;
      }
    });
  }
  return protectedNames;
}

/**
 * Block has no typeId in 1.10.0, so compare the permutation against each id.
 * @param {import('@minecraft/server').Block} block
 */
function isProtectedBlock(block) {
  let permutation;
  try {
    permutation = block.permutation;
  } catch {
    return true;
  }
  for (const name of getProtectedNames()) {
    try {
      if (permutation.matches(name)) return true;
    } catch {
      // ignore this name
    }
  }
  return false;
}

/** Destroy pattern size for a level (for UI text). @param {number} level */
export function destroyPatternSize(level) {
  return DESTROY_PATTERNS[level - 1].length;
}

/**
 * Destroy mode command shot: blasts the block the owner looks at (pattern by level).
 * @param {GuardianState} state @param {number} tick
 * @returns {boolean}
 */
export function destroyShot(state, tick) {
  const owner = state.owner;
  const guardian = state.entity;
  if (!isValid(guardian)) return false;
  if (tick < state.destroyReadyTick) {
    actionBar(owner, '§7Destroy laser recharging...');
    return false;
  }
  let hit;
  try {
    hit = owner.getBlockFromViewDirection({
      maxDistance: DESTROY.MAX_DISTANCE,
      includePassableBlocks: true,
      includeLiquidBlocks: false,
    });
  } catch {
    hit = undefined;
  }
  if (!hit) {
    actionBar(owner, `§7No block in sight (max ${DESTROY.MAX_DISTANCE} blocks).`);
    return false;
  }
  const data = getData(owner);
  const dimension = owner.dimension;
  let origin;
  let center;
  try {
    if (guardian.dimension.id !== dimension.id) return false;
    origin = hit.block.location;
    center = hit.block.center();
  } catch {
    return false;
  }

  const eye = guardianEye(guardian);
  const dir = normalize(sub(center, eye));
  const lens = add(eye, scale(dir, LASER.LENS_FORWARD));
  const look = yawPitch(eye, center);
  state.yaw = look.yaw;
  state.pitch = look.pitch;
  try {
    guardian.setRotation({ x: look.pitch, y: look.yaw });
    guardian.playAnimation(ANIM_ATTACK, { blendOutTime: 0.1 });
  } catch {
    // ignore
  }
  playSoundAt(SOUNDS.LASER, eye, 1, 0.8);
  spawnFx(dimension, PARTICLES.LASER_CHARGE, lens, data.skin);
  drawBeam(dimension, lens, center, data.skin);

  let broken = 0;
  for (const offset of DESTROY_PATTERNS[data.level - 1]) {
    const x = origin.x + offset.x;
    const y = origin.y + offset.y;
    const z = origin.z + offset.z;
    let block;
    try {
      block = dimension.getBlock({ x, y, z });
    } catch {
      continue; // outside the world
    }
    if (!block) continue;
    try {
      if (block.isAir || block.isLiquid) continue;
    } catch {
      continue;
    }
    if (isProtectedBlock(block)) continue;
    try {
      // Block.setType does not exist in 1.10.0; "destroy" drops items + vanilla break effects.
      dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
      broken++;
      spawnFx(dimension, PARTICLES.BLOCK_BREAK, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, data.skin);
    } catch (error) {
      warnOnce('destroy', error);
    }
  }
  spawnFx(dimension, PARTICLES.IMPACT, center, data.skin);
  playSoundAt(SOUNDS.DESTROY, center, 1, 1);
  state.destroyReadyTick = tick + DESTROY.COOLDOWN;
  actionBar(owner, broken > 0 ? `§cDestroyed §f${broken}§c block${broken === 1 ? '' : 's'}.` : '§7Nothing breakable there.');
  return true;
}

// ---------------------------------------------------------------------------
// Commanded shot
// ---------------------------------------------------------------------------

/**
 * "Fire at what I look at": block blast in Destroy mode, otherwise lock onto the
 * first entity in the owner's view and shoot it as soon as possible.
 * @param {GuardianState} state @param {number} tick
 * @returns {boolean}
 */
export function commandShot(state, tick) {
  const owner = state.owner;
  const data = getData(owner);
  if (data.mode === MODE.PASSIVE) {
    actionBar(owner, '§7Passive mode: switch to another mode to fire.');
    return false;
  }
  if (data.mode === MODE.DESTROY) return destroyShot(state, tick);

  /** @type {import('@minecraft/server').EntityRaycastHit[]} */
  let hits = [];
  try {
    hits = owner.getEntitiesFromViewDirection({ maxDistance: LASER.COMMAND_RANGE });
  } catch {
    hits = [];
  }
  hits = hits.slice().sort((a, b) => a.distance - b.distance);
  /** @type {Entity | undefined} */
  let target;
  for (const hit of hits) {
    const entity = hit.entity;
    if (!isValidTarget(entity, state, true)) continue;
    if (!getHealth(entity)) continue; // items, projectiles, xp orbs...
    target = entity;
    break;
  }
  if (!target) {
    actionBar(owner, '§7No target in sight.');
    return false;
  }
  state.command = target;
  state.commandUntil = tick + TIMING.COMMAND_DURATION;
  if (state.targetKind !== 'revenge' || !isAlive(state.revenge)) setTarget(state, target, 'command');
  actionBar(owner, `§cTarget locked: §f${displayName(target)}`);
  if (tick >= state.cooldownUntil) tryFire(state, tick);
  return true;
}

/** Stops all fighting (used by passive mode / dismiss). @param {GuardianState} state */
export function standDown(state) {
  clearTargets(state);
  if (state.raging) endRage(state);
}
