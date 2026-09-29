// Effects service: budget-limited, distance-culled particles/sounds plus camera shake, fog, weather, explosions.
// Every call is wrapped so that a failed effect can never break a disaster.
import { world, system, MolangVariableMap, WeatherType } from '@minecraft/server';
import { stats } from './stats.js';
import { qualityTier, getSettings } from './settings.js';
import { safeCommand, isValidEntity, dimName, clamp, warn } from './util.js';
import { CAPS, fogId, fogKey } from '../config.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Player} Player */

// ---- per-tick player cache -------------------------------------------------------------------------------------
/** @type {Map<string, {tick: number, list: Array<{player: Player, loc: Vector3}>}>} */
const playerCache = new Map();

/** Players in a dimension with their locations, refreshed at most once per tick. @param {Dimension} dim */
export function playersIn(dim) {
  const key = dimName(dim);
  const c = playerCache.get(key);
  const t = system.currentTick;
  if (c && c.tick === t) return c.list;
  const list = [];
  try {
    const ps = dim.getPlayers();
    for (let i = 0; i < ps.length; i++) {
      try { if (ps[i].isValid()) list.push({ player: ps[i], loc: ps[i].location }); } catch (e) { /* skip */ }
    }
  } catch (e) { /* dimension not ready */ }
  playerCache.set(key, { tick: t, list });
  return list;
}

/** Distance to the closest player (Infinity when none). @param {Dimension} dim @param {Vector3} loc */
export function nearestPlayerDist(dim, loc) {
  const list = playersIn(dim);
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    const p = list[i].loc;
    const dx = p.x - loc.x, dy = p.y - loc.y, dz = p.z - loc.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

// ---- particles -------------------------------------------------------------------------------------------------
/**
 * Spawn one particle. Returns false when culled (budget or distance).
 * vars: bare names; number -> setFloat, {x,y,z} -> setVector3, {r,g,b} (0..1) -> setColorRGB.
 * @param {Dimension} dim @param {string} id @param {Vector3} loc @param {Record<string, any>} [vars]
 */
export function spawnParticle(dim, id, loc, vars) {
  const q = qualityTier();
  if (stats.particlesTick >= q.particlesPerTick) { stats.particlesDropped++; return false; }
  if (nearestPlayerDist(dim, loc) > q.cullDistance) { stats.particlesDropped++; return false; }
  try {
    let map;
    if (vars) {
      map = new MolangVariableMap();
      for (const k of Object.keys(vars)) {
        const v = vars[k];
        if (typeof v === 'number') map.setFloat('variable.' + k, v);
        else if (v && typeof v.x === 'number') map.setVector3('variable.' + k, v);
        else if (v && typeof v.r === 'number') map.setColorRGB('variable.' + k, { red: v.r, green: v.g, blue: v.b });
      }
    }
    dim.spawnParticle(id, loc, map);
    stats.particlesTick++;
    stats.particlesTotal++;
    return true;
  } catch (e) {
    stats.particlesDropped++;
    return false;
  }
}

// ---- sounds ----------------------------------------------------------------------------------------------------
/** @param {Dimension} dim @param {string} id @param {Vector3} loc @param {{volume?: number, pitch?: number}} [opts] */
export function playSound(dim, id, loc, opts) {
  const q = qualityTier();
  if (stats.soundsTick >= q.soundsPerTick) return false;
  const volume = clamp((opts && opts.volume) || 1, 0, 40);
  const pitch = clamp((opts && opts.pitch) || 1, 0.2, 2);
  const reach = Math.max(32, Math.min(160, 16 * volume + 24));
  const list = playersIn(dim);
  let played = false;
  for (let i = 0; i < list.length; i++) {
    const pl = list[i].loc;
    const dx = pl.x - loc.x, dy = pl.y - loc.y, dz = pl.z - loc.z;
    if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
    try {
      list[i].player.playSound(id, { location: loc, volume, pitch });
      played = true;
    } catch (e) { /* player left */ }
  }
  if (played) { stats.soundsTick++; stats.soundsTotal++; }
  return played;
}

/** Ambient sound at one player's own position (wind loops etc.). @param {Player} player @param {string} id @param {{volume?: number, pitch?: number}} [opts] */
export function playSoundTo(player, id, opts) {
  const q = qualityTier();
  if (stats.soundsTick >= q.soundsPerTick) return false;
  try {
    player.playSound(id, { volume: clamp((opts && opts.volume) || 1, 0, 40), pitch: clamp((opts && opts.pitch) || 1, 0.2, 2) });
    stats.soundsTick++;
    stats.soundsTotal++;
    return true;
  } catch (e) {
    return false;
  }
}

// ---- camera shake ----------------------------------------------------------------------------------------------
/** player id -> tick of last shake */
const lastShake = new Map();
/** @type {Map<string, Player>} players that received a shake and may need `camerashake stop` */
const shaken = new Map();

/**
 * Shake the camera of every player within `radius` (falloff by distance, throttled per player).
 * @param {Dimension} dim @param {Vector3} loc @param {number} radius @param {number} intensity 0..4 @param {number} seconds
 */
export function shake(dim, loc, radius, intensity, seconds) {
  const q = qualityTier();
  const list = playersIn(dim);
  const now = system.currentTick;
  for (let i = 0; i < list.length; i++) {
    const { player, loc: pl } = list[i];
    const dx = pl.x - loc.x, dy = pl.y - loc.y, dz = pl.z - loc.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > radius) continue;
    const k = 1 - d / radius;
    const it = clamp(intensity * (0.25 + 0.75 * k), 0.02, CAPS.maxShakeIntensity);
    const last = lastShake.get(player.id);
    if (last !== undefined && now - last < q.shakeGapTicks) continue;
    lastShake.set(player.id, now);
    const r = safeCommand(player, 'camerashake add @s ' + it.toFixed(2) + ' ' + clamp(seconds, 0.1, 30).toFixed(1) + ' positional');
    if (r.ok) shaken.set(player.id, player);
  }
}

/** Stop shaking every player we shook. */
export function stopAllShake() {
  for (const p of shaken.values()) {
    try { if (p.isValid()) safeCommand(p, 'camerashake stop @s'); } catch (e) { /* ignore */ }
  }
  shaken.clear();
  lastShake.clear();
}

// ---- fog -------------------------------------------------------------------------------------------------------
/** disaster id -> Map(playerId -> Player) currently fogged */
const fogged = new Map();

/**
 * Push/remove the disaster fog for a player.
 * @param {Player} player @param {string} disaster @param {boolean} on
 */
export function setFog(player, disaster, on) {
  let m = fogged.get(disaster);
  if (!m) { m = new Map(); fogged.set(disaster, m); }
  const has = m.has(player.id);
  try {
    if (on && !has) {
      if (safeCommand(player, 'fog @s push ' + fogId(disaster) + ' ' + fogKey(disaster)).ok) m.set(player.id, player);
    } else if (!on && has) {
      safeCommand(player, 'fog @s remove ' + fogKey(disaster));
      m.delete(player.id);
    }
  } catch (e) { /* player gone */ }
}

/** Remove one disaster's fog from every fogged player. @param {string} disaster */
export function clearFog(disaster) {
  const m = fogged.get(disaster);
  if (!m) return;
  for (const p of m.values()) {
    try { if (p.isValid()) safeCommand(p, 'fog @s remove ' + fogKey(disaster)); } catch (e) { /* ignore */ }
  }
  m.clear();
}

/** Remove every fog we may have applied (used on load / stopAll). @param {Iterable<string>} disasters */
export function clearAllFogs(disasters) {
  for (const id of disasters) clearFog(id);
  // players who joined after a crash may still hold a stale fog stack: remove blindly for everyone
  try {
    const ps = world.getAllPlayers();
    for (let i = 0; i < ps.length; i++) {
      for (const id of disasters) safeCommand(ps[i], 'fog @s remove ' + fogKey(id));
    }
  } catch (e) { /* ignore */ }
}

// ---- weather ---------------------------------------------------------------------------------------------------
let weatherOwned = false;
export function weatherWasChanged() { return weatherOwned; }

/** @param {Dimension} dim @param {'clear'|'rain'|'thunder'} type @param {number} ticks */
export function setWeather(dim, type, ticks) {
  try {
    const t = type === 'thunder' ? WeatherType.Thunder : type === 'rain' ? WeatherType.Rain : WeatherType.Clear;
    dim.setWeather(t, clamp(Math.floor(ticks), 20, 1000000));
    if (type !== 'clear') weatherOwned = true;
  } catch (e) { warn('setWeather failed: ' + (e && e.message)); }
}

/** Put weather back to clear if any disaster changed it. @param {Dimension} dim */
export function restoreWeather(dim) {
  if (!weatherOwned) return;
  weatherOwned = false;
  try { dim.setWeather(WeatherType.Clear, 600); } catch (e) { /* ignore */ }
}

// ---- action bar ------------------------------------------------------------------------------------------------
/** @param {Player} player @param {string} text */
export function actionBar(player, text) {
  try { if (player && player.isValid()) player.onScreenDisplay.setActionBar(text); } catch (e) { /* ignore */ }
}

/** Action bar for every player in a dimension. @param {Dimension} dim @param {string} text */
export function actionBarAll(dim, text) {
  const list = playersIn(dim);
  for (let i = 0; i < list.length; i++) actionBar(list[i].player, text);
}

// ---- explosions ------------------------------------------------------------------------------------------------
/**
 * Explosion that respects the block-destruction and damage switches.
 * Real `createExplosion` only when destruction AND both damage switches are ON; otherwise cosmetic
 * (particles + sound) and the caller applies knockback/damage through the entities service.
 * @param {Dimension} dim @param {Vector3} loc @param {number} radius @param {{source?: any}} [opts]
 * @returns {boolean} true when a real explosion was created
 */
export function explode(dim, loc, radius, opts) {
  const s = getSettings();
  const r = clamp(radius, 0.5, CAPS.maxExplosionRadius);
  let real = false;
  if (s.blockDestruction && s.mobDamage && s.playerDamage) {
    try {
      dim.createExplosion(loc, r, { breaksBlocks: true, causesFire: false, source: opts && isValidEntity(opts.source) ? opts.source : undefined });
      real = true;
    } catch (e) { warn('createExplosion failed: ' + (e && e.message)); }
  }
  spawnParticle(dim, 'nd:flash', loc, { size: r * 2 });
  spawnParticle(dim, 'nd:shock_ring', loc, { size: r * 3 });
  for (let i = 0; i < 6; i++) {
    spawnParticle(dim, 'nd:smoke_puff', { x: loc.x + (Math.random() - 0.5) * r, y: loc.y + Math.random() * r * 0.6, z: loc.z + (Math.random() - 0.5) * r }, { size: r * 0.8 });
  }
  playSound(dim, 'nd.meteor_impact', loc, { volume: clamp(r / 4, 0.6, 6) });
  return real;
}

/** Cleanup of everything fx-owned (called by the manager on stopAll). @param {Iterable<string>} disasters @param {Dimension} [dim] */
export function cleanupFx(disasters, dim) {
  stopAllShake();
  clearAllFogs(disasters);
  if (dim) restoreWeather(dim);
}
