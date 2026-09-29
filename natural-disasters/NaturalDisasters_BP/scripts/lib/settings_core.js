// Pure settings logic (validation / merge / (de)serialisation). No game imports -> unit-testable in Node.
import { SETTING_SCHEMA, DEFAULT_SETTINGS } from '../config.js';

/** @typedef {import('../config.js').Settings} Settings */

/**
 * Coerce one raw value to a valid value for its schema entry (falls back to the default).
 * @param {string} key
 * @param {any} raw
 * @returns {number|boolean}
 */
export function coerceSetting(key, raw) {
  const sch = SETTING_SCHEMA[key];
  if (!sch) return /** @type {any} */ (undefined);
  if (sch.type === 'bool') {
    if (raw === true || raw === 1 || raw === 'true') return true;
    if (raw === false || raw === 0 || raw === 'false') return false;
    return sch.def;
  }
  let n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !isFinite(n)) return sch.def;
  const min = sch.min === undefined ? -Infinity : sch.min;
  const max = sch.max === undefined ? Infinity : sch.max;
  if (sch.step && sch.step > 1 && isFinite(min)) n = min + Math.round((n - min) / sch.step) * sch.step;
  else n = Math.round(n);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

/**
 * Build a complete valid Settings object from any input (unknown keys dropped, bad values defaulted).
 * @param {any} raw
 * @returns {Settings}
 */
export function validateSettings(raw) {
  /** @type {any} */
  const out = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const key of Object.keys(SETTING_SCHEMA)) {
    out[key] = key in src ? coerceSetting(key, src[key]) : SETTING_SCHEMA[key].def;
  }
  return out;
}

/**
 * Merge a partial update over current settings and validate.
 * @param {Settings} current @param {any} partial @returns {Settings}
 */
export function mergeSettings(current, partial) {
  const merged = Object.assign({}, current);
  if (partial && typeof partial === 'object') {
    for (const key of Object.keys(SETTING_SCHEMA)) {
      if (key in partial) merged[key] = partial[key];
    }
  }
  return validateSettings(merged);
}

/**
 * Parse the persisted JSON string; anything malformed yields defaults.
 * @param {any} str @returns {Settings}
 */
export function parseSettings(str) {
  if (typeof str !== 'string' || str.length === 0) return validateSettings(DEFAULT_SETTINGS);
  try {
    return validateSettings(JSON.parse(str));
  } catch (e) {
    return validateSettings(DEFAULT_SETTINGS);
  }
}

/** @param {Settings} s @returns {string} */
export function serializeSettings(s) {
  return JSON.stringify(validateSettings(s));
}

/** Shallow equality of two settings objects. @param {Settings} a @param {Settings} b */
export function settingsEqual(a, b) {
  for (const key of Object.keys(SETTING_SCHEMA)) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
