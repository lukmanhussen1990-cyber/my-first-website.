// Entity service: tracked temporary entities (nd_temp), victim scans, safe push/damage/protect helpers.
import { system, EntityDamageCause } from '@minecraft/server';
import { stats } from './stats.js';
import { qualityTier, getSettings } from './settings.js';
import { isValidEntity, clamp, getDimension } from './util.js';
import { CAPS, TEMP_TAG, DIMENSION_IDS } from '../config.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Entity} Entity */

/** @type {Map<string, {entity: Entity, owner: number, dieAt: number}>} tracked temporary entities */
const tracked = new Map();

/** Entity types that are never pushed, damaged or scanned. */
const IGNORED_TYPES = [
  'minecraft:armor_stand', 'minecraft:painting', 'minecraft:npc', 'minecraft:ender_crystal', 'minecraft:lightning_bolt',
  'minecraft:xp_orb', 'minecraft:fishing_hook', 'minecraft:arrow', 'minecraft:thrown_trident', 'minecraft:boat',
  'minecraft:chest_boat', 'minecraft:minecart', 'minecraft:chest_minecart', 'minecraft:hopper_minecart',
  'minecraft:tnt_minecart', 'minecraft:command_block_minecart', 'minecraft:furnace_minecart', 'minecraft:agent',
  'minecraft:ender_dragon', 'minecraft:wither', 'minecraft:warden', 'minecraft:elder_guardian', 'minecraft:area_effect_cloud',
  'minecraft:eye_of_ender_signal', 'minecraft:ender_pearl', 'minecraft:fireball', 'minecraft:small_fireball',
  'minecraft:wither_skull', 'minecraft:wither_skull_dangerous', 'minecraft:shulker_bullet', 'minecraft:dragon_fireball',
  'minecraft:leash_knot', 'minecraft:lightning_bolt', 'minecraft:egg', 'minecraft:snowball', 'minecraft:splash_potion',
  'minecraft:lingering_potion', 'minecraft:firework_rocket', 'minecraft:thrown_trident', 'minecraft:tnt',
  'nd:meteor', 'nd:lava_bomb', 'nd:debris',
];

export const IMMUNE_TAG = 'nd_immune';

// ---- temporary entities ----------------------------------------------------------------------------------------
/** Number of tracked temp entities. */
export function trackedCount() { return tracked.size; }

/** Number of tracked temp entities of one owner. @param {number} owner */
export function ownedCount(owner) {
  let n = 0;
  for (const t of tracked.values()) if (t.owner === owner) n++;
  return n;
}

/**
 * Spawn a tracked temporary entity. Returns undefined when the caps refuse it or the spawn fails.
 * @param {Dimension} dim @param {string} typeId @param {Vector3} loc
 * @param {{owner: number, ttlTicks?: number, maxOwned?: number}} opts
 * @returns {Entity|undefined}
 */
export function spawnTemp(dim, typeId, loc, opts) {
  const q = qualityTier();
  if (tracked.size >= q.maxTempEntities || (opts.maxOwned !== undefined && ownedCount(opts.owner) >= opts.maxOwned)) {
    stats.entitiesRefused++;
    return undefined;
  }
  try {
    const e = dim.spawnEntity(typeId, loc);
    try { e.addTag(TEMP_TAG); } catch (err) { /* ignore */ }
    tracked.set(e.id, { entity: e, owner: opts.owner, dieAt: system.currentTick + (opts.ttlTicks || 400) });
    stats.entitiesSpawned++;
    stats.trackedEntities = tracked.size;
    return e;
  } catch (e) {
    stats.entitiesRefused++;
    return undefined;
  }
}

/** Remove one entity (tracked or not). @param {Entity} e */
export function removeEntity(e) {
  let id = '';
  try { id = e.id; } catch (err) { /* invalid */ }
  try { if (e.isValid()) { e.remove(); stats.entitiesRemoved++; } } catch (err) { /* ignore */ }
  if (id) tracked.delete(id);
  stats.trackedEntities = tracked.size;
}

/** Remove every tracked entity of an owner. @param {number} owner */
export function removeOwned(owner) {
  for (const [id, t] of tracked) {
    if (t.owner !== owner) continue;
    try { if (t.entity.isValid()) { t.entity.remove(); stats.entitiesRemoved++; } } catch (e) { /* ignore */ }
    tracked.delete(id);
  }
  stats.trackedEntities = tracked.size;
}

/** Drop dead handles and force-remove expired entities. Called by the manager every few ticks. */
export function tickTracked() {
  const now = system.currentTick;
  for (const [id, t] of tracked) {
    let ok = false;
    try { ok = t.entity.isValid(); } catch (e) { ok = false; }
    if (!ok) { tracked.delete(id); continue; }
    if (now >= t.dieAt) {
      try { t.entity.remove(); stats.entitiesRemoved++; } catch (e) { /* ignore */ }
      tracked.delete(id);
    }
  }
  stats.trackedEntities = tracked.size;
}

/** Remove every tracked entity plus any nd_temp-tagged leftover in loaded chunks. @returns {number} removed */
export function removeAllTemp() {
  let n = 0;
  for (const t of tracked.values()) {
    try { if (t.entity.isValid()) { t.entity.remove(); n++; } } catch (e) { /* ignore */ }
  }
  tracked.clear();
  n += sweepLeftovers();
  stats.trackedEntities = 0;
  stats.entitiesRemoved += n;
  return n;
}

/** Remove nd_temp-tagged entities that are not tracked (after reload / crash). @returns {number} */
export function sweepLeftovers() {
  let n = 0;
  for (let i = 0; i < DIMENSION_IDS.length; i++) {
    const dim = getDimension(DIMENSION_IDS[i]);
    if (!dim) continue;
    try {
      const list = dim.getEntities({ tags: [TEMP_TAG] });
      for (let j = 0; j < list.length; j++) {
        try { list[j].remove(); n++; } catch (e) { /* ignore */ }
      }
    } catch (e) { /* dimension not loaded */ }
  }
  return n;
}

// ---- victim scans ----------------------------------------------------------------------------------------------
/** @type {Map<string, {tick: number, list: Entity[]}>} */
const scanCache = new Map();

/** Is this entity a player? @param {Entity} e */
export function isPlayer(e) {
  try { return e.typeId === 'minecraft:player'; } catch (err) { return false; }
}

/**
 * Entities near a point that a disaster may affect (players, mobs, optionally dropped items).
 * With `key`, results are cached for victimScanEvery ticks (invalid handles are filtered on read).
 * @param {Dimension} dim @param {Vector3} loc @param {number} radius
 * @param {{key?: string, items?: boolean, players?: boolean, mobs?: boolean, max?: number}} [opts]
 * @returns {Entity[]}
 */
export function victims(dim, loc, radius, opts) {
  const o = opts || {};
  const q = qualityTier();
  const now = system.currentTick;
  if (o.key) {
    const c = scanCache.get(o.key);
    if (c && now - c.tick < q.victimScanEvery) return c.list.filter(isValidEntity);
  }
  /** @type {Entity[]} */
  let out = [];
  try {
    const excl = o.items ? IGNORED_TYPES : IGNORED_TYPES.concat(['minecraft:item']);
    const list = dim.getEntities({
      location: loc, maxDistance: radius, excludeTypes: excl, excludeTags: [TEMP_TAG, IMMUNE_TAG],
      closest: Math.min(o.max || q.victimScanMax, q.victimScanMax),
    });
    const wantPlayers = o.players !== false, wantMobs = o.mobs !== false;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (isPlayer(e)) { if (wantPlayers) out.push(e); } else if (wantMobs || (o.items && e.typeId === 'minecraft:item')) out.push(e);
    }
  } catch (e) { out = []; }
  if (o.key) scanCache.set(o.key, { tick: now, list: out });
  return out;
}

/** Forget cached scans of a key prefix (instance ended). @param {string} prefix */
export function clearScanCache(prefix) {
  for (const k of scanCache.keys()) if (k.startsWith(prefix)) scanCache.delete(k);
}

// ---- protection / push / damage --------------------------------------------------------------------------------
/** @type {Map<string, {until: number, e: Entity}>} entity id -> fall protection we granted */
const protectedUntil = new Map();

/** Fall/impact protection so "damage OFF" also blocks fall damage after being thrown. @param {Entity} e @param {number} ticks */
export function protect(e, ticks) {
  const now = system.currentTick;
  let id = '';
  try { id = e.id; } catch (err) { return; }
  const rec = protectedUntil.get(id);
  if (rec && rec.until - now > ticks / 2) return;
  try {
    e.addEffect('slow_falling', ticks, { amplifier: 0, showParticles: false });
    e.addEffect('resistance', ticks, { amplifier: 4, showParticles: false });
    protectedUntil.set(id, { until: now + ticks, e });
  } catch (err) { /* ignore */ }
  if (protectedUntil.size > 400) {
    for (const [k, v] of protectedUntil) if (v.until < now) protectedUntil.delete(k);
  }
}

/** Does the setting allow damaging this entity? @param {Entity} e */
export function mayDamage(e) {
  const s = getSettings();
  return isPlayer(e) ? s.playerDamage : s.mobDamage;
}

/**
 * Add velocity. Players get applyKnockback (applyImpulse throws for them); others applyImpulse with a knockback fallback.
 * vx/vz are blocks-per-tick-ish impulse components, vy is upward. Values are clamped to CAPS.
 * When damage is disabled for that entity type, fall protection is granted so pushing stays harmless.
 * @param {Entity} e @param {number} vx @param {number} vy @param {number} vz
 */
export function push(e, vx, vy, vz) {
  if (!isValidEntity(e)) return false;
  if (!mayDamage(e)) protect(e, 100);
  try {
    if (isPlayer(e)) {
      const h = Math.sqrt(vx * vx + vz * vz);
      const str = clamp(h, 0, CAPS.maxPlayerKnockbackH);
      const dx = h > 1e-4 ? vx / h : 0, dz = h > 1e-4 ? vz / h : 0;
      e.applyKnockback(dx, dz, str, clamp(vy, -CAPS.maxPlayerKnockbackV, CAPS.maxPlayerKnockbackV));
    } else {
      const m = CAPS.maxImpulse;
      try {
        e.applyImpulse({ x: clamp(vx, -m, m), y: clamp(vy, -m, m), z: clamp(vz, -m, m) });
      } catch (err) {
        const h = Math.sqrt(vx * vx + vz * vz);
        e.applyKnockback(h > 1e-4 ? vx / h : 0, h > 1e-4 ? vz / h : 0, clamp(h, 0, 3), clamp(vy, -2, 2));
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Apply damage honouring the mob/player switches and CAPS. `floor` keeps health above a value (never kills).
 * @param {Entity} e @param {number} amount @param {{cause?: any, floor?: number}} [opts] @returns {boolean} damage applied
 */
export function damage(e, amount, opts) {
  if (!isValidEntity(e) || !mayDamage(e)) return false;
  let a = clamp(amount, 0, CAPS.maxDamagePerHit);
  const o = opts || {};
  if (o.floor !== undefined) {
    try {
      const h = /** @type {import('@minecraft/server').EntityHealthComponent|undefined} */ (e.getComponent('minecraft:health'));
      if (h) a = Math.min(a, h.currentValue - o.floor);
    } catch (err) { /* ignore */ }
  }
  if (a <= 0.05) return false;
  try {
    return e.applyDamage(a, { cause: o.cause || EntityDamageCause.entityAttack });
  } catch (err) {
    return false;
  }
}

/** Set on fire only when damage is allowed for that entity. @param {Entity} e @param {number} seconds */
export function setFire(e, seconds) {
  if (!isValidEntity(e) || !mayDamage(e)) return false;
  try { return e.setOnFire(clamp(seconds, 1, 30), false); } catch (err) { return false; }
}

/** Add a potion effect only when damage is allowed (negative effects). @param {Entity} e @param {string} id @param {number} ticks @param {number} amp */
export function harmEffect(e, id, ticks, amp) {
  if (!isValidEntity(e) || !mayDamage(e)) return false;
  try { e.addEffect(id, Math.floor(ticks), { amplifier: amp, showParticles: false }); return true; } catch (err) { return false; }
}

/** Effect that is not damaging (slowness etc.) - applied regardless of damage switches. @param {Entity} e @param {string} id @param {number} ticks @param {number} amp */
export function softEffect(e, id, ticks, amp) {
  if (!isValidEntity(e)) return false;
  try { e.addEffect(id, Math.floor(ticks), { amplifier: amp, showParticles: false }); return true; } catch (err) { return false; }
}

/** Remove the fall protection we granted (stopAll). */
export function clearAllProtection() {
  for (const v of protectedUntil.values()) {
    if (!isValidEntity(v.e)) continue;
    try { v.e.removeEffect('slow_falling'); } catch (err) { /* ignore */ }
    try { v.e.removeEffect('resistance'); } catch (err) { /* ignore */ }
  }
  protectedUntil.clear();
}
