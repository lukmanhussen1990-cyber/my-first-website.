// Per-player persistent data, stored as JSON in the player dynamic property
// "ceg:data". Parsed once and cached; every change goes through saveData().

import { DP_PLAYER_DATA, MAX_LEVEL, MODE, SKINS } from './config.js';
import { clamp, warnOnce } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

/**
 * @typedef GuardianData
 * @property {boolean} active    a guardian should exist for this player
 * @property {number} level      1-5
 * @property {number} skin       0-3
 * @property {number} mode       0-4 (see MODE)
 * @property {boolean} nv        night vision enabled
 * @property {boolean} heal      auto heal enabled
 * @property {number} token      current spawn token (guardians with another token are stale)
 * @property {number} deadUntil  Date.now() timestamp until which summoning is refused
 * @property {number} kills      lifetime laser kills
 */

/** @returns {GuardianData} */
export function defaultData() {
  return {
    active: false,
    level: 1,
    skin: 0,
    mode: MODE.FOLLOW,
    nv: true,
    heal: true,
    token: 0,
    deadUntil: 0,
    kills: 0,
  };
}

/**
 * @param {unknown} value @param {number} min @param {number} max @param {number} fallback
 */
function intIn(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.floor(value), min, max) : fallback;
}

/**
 * Accepts anything (old/corrupt saves) and returns a complete, in-range record.
 * @param {unknown} raw
 * @returns {GuardianData}
 */
export function sanitizeData(raw) {
  const d = defaultData();
  if (!raw || typeof raw !== 'object') return d;
  const r = /** @type {Record<string, unknown>} */ (raw);
  d.active = r.active === true;
  d.level = intIn(r.level, 1, MAX_LEVEL, 1);
  d.skin = intIn(r.skin, 0, SKINS.length - 1, 0);
  d.mode = intIn(r.mode, MODE.FOLLOW, MODE.PASSIVE, MODE.FOLLOW);
  d.nv = r.nv !== false;
  d.heal = r.heal !== false;
  d.token = typeof r.token === 'number' && Number.isFinite(r.token) ? r.token : 0;
  d.deadUntil = typeof r.deadUntil === 'number' && Number.isFinite(r.deadUntil) ? r.deadUntil : 0;
  d.kills = intIn(r.kills, 0, 1e9, 0);
  return d;
}

/** @type {Map<string, GuardianData>} */
const cache = new Map();

/**
 * Returns the (cached, mutable) data record for a player. Mutate it and call
 * saveData() to persist.
 * @param {Player} player
 * @returns {GuardianData}
 */
export function getData(player) {
  const cached = cache.get(player.id);
  if (cached) return cached;
  let parsed = defaultData();
  try {
    const raw = player.getDynamicProperty(DP_PLAYER_DATA);
    if (typeof raw === 'string' && raw.length > 0) parsed = sanitizeData(JSON.parse(raw));
  } catch (error) {
    warnOnce('load data', error);
  }
  cache.set(player.id, parsed);
  return parsed;
}

/** @param {Player} player @param {GuardianData} data */
export function saveData(player, data) {
  cache.set(player.id, data);
  try {
    player.setDynamicProperty(DP_PLAYER_DATA, JSON.stringify(data));
  } catch (error) {
    warnOnce('save data', error);
  }
}

/** Drops the cache entry (player left); the dynamic property stays on the player. @param {string} playerId */
export function forgetData(playerId) {
  cache.delete(playerId);
}

/**
 * Random positive integer used to recognise the one "current" guardian.
 * @param {number} [previous] token that must not be reused
 */
export function newToken(previous = 0) {
  let token = previous;
  while (token === previous) token = 1 + Math.floor(Math.random() * 2000000000);
  return token;
}
