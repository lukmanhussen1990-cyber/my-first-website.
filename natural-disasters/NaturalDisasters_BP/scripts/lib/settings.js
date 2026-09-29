// World-wide settings, persisted in the world dynamic property `nd:settings` (JSON string).
import { world } from '@minecraft/server';
import { PROP, QUALITY, DEFAULT_SETTINGS } from '../config.js';
import { parseSettings, mergeSettings, serializeSettings, settingsEqual, validateSettings } from './settings_core.js';
import { setDebug, warn } from './util.js';

/** @typedef {import('../config.js').Settings} Settings */

/** @type {Settings} */
let current = validateSettings(DEFAULT_SETTINGS);
let loaded = false;
/** @type {Array<(s: Settings, prev: Settings) => void>} */
const listeners = [];

/** Read the persisted settings once the world is available. Safe to call repeatedly (reloads). */
export function loadSettings() {
  try {
    const raw = world.getDynamicProperty(PROP.settings);
    current = parseSettings(raw);
    loaded = true;
  } catch (e) {
    // world not ready yet: keep defaults, try again on the next getSettings()
    warn('settings load failed: ' + (e && e.message));
    loaded = false;
  }
  setDebug(current.debug);
  return current;
}

/** Current settings (lazy-loads on first use). Returned object must not be mutated. @returns {Readonly<Settings>} */
export function getSettings() {
  if (!loaded) loadSettings();
  return current;
}

/** Frozen copy handed to a disaster instance at start. @returns {Readonly<Settings>} */
export function snapshotSettings() {
  return Object.freeze(Object.assign({}, getSettings()));
}

/** @returns {import('../config.js').QualityTier} */
export function qualityTier() {
  return QUALITY[getSettings().quality] || QUALITY[1];
}

/**
 * Validate + merge + persist a partial update. Returns the new settings.
 * @param {Partial<Settings>} partial
 * @returns {Settings}
 */
export function updateSettings(partial) {
  const prev = getSettings();
  const next = mergeSettings(prev, partial);
  if (settingsEqual(prev, next)) return prev;
  current = next;
  setDebug(next.debug);
  try {
    world.setDynamicProperty(PROP.settings, serializeSettings(next));
  } catch (e) {
    warn('settings save failed: ' + (e && e.message));
  }
  for (let i = 0; i < listeners.length; i++) {
    try { listeners[i](next, prev); } catch (e) { warn('settings listener failed: ' + (e && e.message)); }
  }
  return next;
}

/** Restore defaults (persisted). */
export function resetSettings() {
  return updateSettings(/** @type {any} */ (DEFAULT_SETTINGS));
}

/** @param {(s: Settings, prev: Settings) => void} cb */
export function onSettingsChange(cb) { listeners.push(cb); }
