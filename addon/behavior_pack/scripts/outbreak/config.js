// @ts-check
// Outbreak configuration (SPEC §7), stored as JSON in world property `pas:config`.
//
// Every value is validated on load and on change: numbers are rounded to
// integers and clamped to their range, booleans fall back to the default when
// they are not booleans. Unknown keys are dropped.

import { PROPS } from "../lib/ids.js";
import { loadJSON, saveJSON } from "../lib/store.js";

/**
 * @typedef {object} OutbreakConfig
 * @property {number} replicationSeconds seconds between two parasite generations
 * @property {number} incubationSeconds incubation time of infected mobs
 * @property {number} playerIncubationSeconds incubation time of infected players (stage 1)
 * @property {number} populationCap max horde entities (loaded + pending spawns)
 * @property {boolean} infectPlayers whether players can be infected at all
 * @property {boolean} showHud show the live actionbar status while the control item is held
 */

/** @typedef {"replicationSeconds" | "incubationSeconds" | "playerIncubationSeconds" | "populationCap"} NumericConfigKey */

/** Ranges of the numeric settings; `step` is the slider step of the settings form. */
export const CONFIG_RANGES = Object.freeze({
  replicationSeconds: Object.freeze({ min: 10, max: 300, step: 5 }),
  incubationSeconds: Object.freeze({ min: 5, max: 120, step: 5 }),
  playerIncubationSeconds: Object.freeze({ min: 10, max: 300, step: 5 }),
  populationCap: Object.freeze({ min: 4, max: 200, step: 4 }),
});

/** @type {Readonly<OutbreakConfig>} */
export const DEFAULT_CONFIG = Object.freeze({
  replicationSeconds: 30,
  incubationSeconds: 20,
  playerIncubationSeconds: 45,
  populationCap: 64,
  infectPlayers: true,
  showHud: true,
});

/** @type {NumericConfigKey[]} */
const NUMERIC_KEYS = ["replicationSeconds", "incubationSeconds", "playerIncubationSeconds", "populationCap"];
/** @type {("infectPlayers" | "showHud")[]} */
const BOOL_KEYS = ["infectPlayers", "showHud"];

/**
 * Clamp a numeric setting into its range (rounded to an integer).
 * @param {NumericConfigKey} key
 * @param {number} value
 * @returns {number}
 */
export function clampSetting(key, value) {
  const r = CONFIG_RANGES[key];
  return Math.min(r.max, Math.max(r.min, Math.round(value)));
}

/**
 * Build a valid config from untrusted data; missing/invalid fields come from `base`.
 * @param {unknown} raw
 * @param {Readonly<OutbreakConfig>} [base]
 * @returns {OutbreakConfig}
 */
export function sanitizeConfig(raw, base = DEFAULT_CONFIG) {
  /** @type {OutbreakConfig} */
  const out = { ...base };
  if (!raw || typeof raw !== "object") return out;
  const r = /** @type {Record<string, unknown>} */ (raw);
  for (const k of NUMERIC_KEYS) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clampSetting(k, v);
  }
  for (const k of BOOL_KEYS) {
    const v = r[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** @type {OutbreakConfig | undefined} */
let current;

/** (Re)load the config from the world. @returns {OutbreakConfig} */
export function loadConfig() {
  current = sanitizeConfig(loadJSON(PROPS.CONFIG, undefined));
  return current;
}

/**
 * The live config (loaded lazily). Treat the returned object as read-only.
 * @returns {Readonly<OutbreakConfig>}
 */
export function getConfig() {
  return current ?? loadConfig();
}

/**
 * Merge `partial` into the config, clamp everything and persist it immediately.
 * @param {Partial<OutbreakConfig>} partial
 * @returns {Readonly<OutbreakConfig>} the new config
 */
export function setConfig(partial) {
  current = sanitizeConfig({ ...getConfig(), ...(partial ?? {}) }, getConfig());
  saveJSON(PROPS.CONFIG, current);
  return current;
}

/** Forget the cached config (tests / world reload). */
export function resetConfigMemory() {
  current = undefined;
}
