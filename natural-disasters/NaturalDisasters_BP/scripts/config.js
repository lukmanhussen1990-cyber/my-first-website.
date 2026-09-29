// Natural Disaster Simulator - static configuration (ids, item map, settings schema, quality tiers).
// Block lists live in ./lib/blocklists.js (pure data + tiny predicates) to keep this file small.
// This file has NO imports so it can be loaded anywhere (also by pure-logic tests).

export const NS = 'nd';
export const TEMP_TAG = 'nd_temp';
export const VERSION = '1.0.0';

/** Disaster module ids. */
export const DISASTER_IDS = Object.freeze([
  'tornado', 'tsunami', 'volcano', 'earthquake', 'meteor',
  'supercell', 'hurricane', 'wildfire', 'blizzard', 'sinkhole',
]);

/**
 * Display data per disaster.
 * `autoWeight` = relative chance for the automatic disaster scheduler (0 = never automatic).
 * `autoVariants` = variants the scheduler may pick.
 * @type {Record<string, {label: string, autoWeight: number, autoVariants: string[]}>}
 */
export const DISASTER_META = Object.freeze({
  tornado: { label: 'Tornado', autoWeight: 3, autoVariants: ['auto'] },
  tsunami: { label: 'Tsunami', autoWeight: 1, autoVariants: ['default'] },
  volcano: { label: 'Volcano', autoWeight: 1, autoVariants: ['default'] },
  earthquake: { label: 'Earthquake', autoWeight: 3, autoVariants: ['m4', 'm6'] },
  meteor: { label: 'Meteor Strike', autoWeight: 2, autoVariants: ['default'] },
  supercell: { label: 'Supercell', autoWeight: 2, autoVariants: ['default'] },
  hurricane: { label: 'Hurricane', autoWeight: 1, autoVariants: ['default'] },
  wildfire: { label: 'Wildfire', autoWeight: 2, autoVariants: ['default'] },
  blizzard: { label: 'Blizzard', autoWeight: 1, autoVariants: ['default'] },
  sinkhole: { label: 'Sinkhole', autoWeight: 2, autoVariants: ['default'] },
});

/**
 * Item id -> action. kind: 'spawn' | 'stop' | 'controller'.
 * For 'spawn': `disaster` is a DISASTER_IDS entry and `variant` is passed to the module as ctx.variant.
 * @type {Record<string, {kind: 'spawn'|'stop'|'controller', disaster?: string, variant?: string, label: string}>}
 */
export const ITEM_MAP = Object.freeze({
  'nd:spawn_tornado': { kind: 'spawn', disaster: 'tornado', variant: 'auto', label: 'Tornado' },
  'nd:spawn_ef5_tornado': { kind: 'spawn', disaster: 'tornado', variant: 'ef5', label: 'EF5 Tornado' },
  'nd:spawn_tsunami': { kind: 'spawn', disaster: 'tsunami', variant: 'default', label: 'Tsunami' },
  'nd:spawn_volcano': { kind: 'spawn', disaster: 'volcano', variant: 'default', label: 'Volcano' },
  'nd:earthquake_m4': { kind: 'spawn', disaster: 'earthquake', variant: 'm4', label: 'Earthquake M4' },
  'nd:earthquake_m6': { kind: 'spawn', disaster: 'earthquake', variant: 'm6', label: 'Earthquake M6' },
  'nd:earthquake_m9': { kind: 'spawn', disaster: 'earthquake', variant: 'm9', label: 'Earthquake M9' },
  'nd:meteor_strike': { kind: 'spawn', disaster: 'meteor', variant: 'default', label: 'Meteor Strike' },
  'nd:supercell': { kind: 'spawn', disaster: 'supercell', variant: 'default', label: 'Supercell' },
  'nd:hurricane': { kind: 'spawn', disaster: 'hurricane', variant: 'default', label: 'Hurricane' },
  'nd:wildfire': { kind: 'spawn', disaster: 'wildfire', variant: 'default', label: 'Wildfire' },
  'nd:blizzard': { kind: 'spawn', disaster: 'blizzard', variant: 'default', label: 'Blizzard' },
  'nd:sinkhole': { kind: 'spawn', disaster: 'sinkhole', variant: 'default', label: 'Sinkhole' },
  'nd:stop_all_disasters': { kind: 'stop', label: 'STOP ALL DISASTERS' },
  'nd:disaster_controller': { kind: 'controller', label: 'Disaster Controller' },
});

/** Entity type ids owned by this add-on (all are temporary, tagged nd_temp). */
export const ENTITY_IDS = Object.freeze({
  meteor: 'nd:meteor',
  lavaBomb: 'nd:lava_bomb',
  debris: 'nd:debris',
});

/** World dynamic property keys. */
export const PROP = Object.freeze({
  settings: 'nd:settings',
  journalCount: 'nd:journal_count',
  journalPrefix: 'nd:journal:',
});

/** Ticks a single player must wait between two item activations (touch fires itemUse AND itemUseOn). */
export const ITEM_DEBOUNCE_TICKS = 10;

/** Max chars per persisted journal chunk (dynamic property strings are capped at 32767). */
export const JOURNAL_CHUNK_CHARS = 30000;
/** Max simultaneous journaled block changes held in memory / persisted. */
export const JOURNAL_MAX_ENTRIES = 16000;

export const STRENGTH_NAMES = Object.freeze(['Weak', 'Moderate', 'Strong', 'Violent', 'Catastrophic']);
/** strength (1..5) -> multiplier helper (index 0 unused). */
export const STRENGTH_MUL = Object.freeze([1, 0.6, 0.8, 1.0, 1.3, 1.6]);
export const QUALITY_NAMES = Object.freeze(['Low', 'Balanced', 'High']);

/** Caps that even the strongest disaster may not exceed. */
export const CAPS = Object.freeze({
  maxDamagePerHit: 40,
  maxExplosionRadius: 12,
  maxPlayerKnockbackH: 4,
  maxPlayerKnockbackV: 2.2,
  maxImpulse: 3,
  maxShakeIntensity: 4,
  hardEndFactor: 1.5, // manager force-ends a disaster at durationTicks*factor + hardEndSlackTicks
  hardEndSlackTicks: 200,
});

/**
 * Setting schema: type, bounds and defaults (section 4.1 of the contract).
 * @type {Record<string, {type: 'int'|'bool', min?: number, max?: number, step?: number, def: number|boolean}>}
 */
export const SETTING_SCHEMA = Object.freeze({
  strength: { type: 'int', min: 1, max: 5, def: 3 },
  durationPct: { type: 'int', min: 25, max: 300, step: 25, def: 100 },
  blockDestruction: { type: 'bool', def: false },
  mobDamage: { type: 'bool', def: true },
  playerDamage: { type: 'bool', def: true },
  autoDisasters: { type: 'bool', def: false },
  autoIntervalMin: { type: 'int', min: 2, max: 30, def: 8 },
  quality: { type: 'int', min: 0, max: 2, def: 1 },
  debug: { type: 'bool', def: false },
});

/**
 * @typedef {Object} Settings
 * @property {number} strength 1..5
 * @property {number} durationPct 25..300 step 25
 * @property {boolean} blockDestruction
 * @property {boolean} mobDamage
 * @property {boolean} playerDamage
 * @property {boolean} autoDisasters
 * @property {number} autoIntervalMin 2..30
 * @property {number} quality 0|1|2
 * @property {boolean} debug
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = Object.freeze({
  strength: 3,
  durationPct: 100,
  blockDestruction: false,
  mobDamage: true,
  playerDamage: true,
  autoDisasters: false,
  autoIntervalMin: 8,
  quality: 1,
  debug: false,
});

/**
 * @typedef {Object} QualityTier
 * @property {string} name
 * @property {number} particlesPerTick global particle budget per tick
 * @property {number} cullDistance particles/sounds farther than this from every player are dropped
 * @property {number} maxDebris max nd:debris entities per disaster
 * @property {number} maxTempEntities global cap on tracked nd_temp entities
 * @property {number} updateInterval ticks between two update() calls of a disaster
 * @property {number} maxConcurrent max simultaneously active disasters
 * @property {number} blockOpsPerTick block writes allowed per tick (and job ops per tick)
 * @property {number} victimScanEvery ticks between victim scans (cached in between)
 * @property {number} victimScanMax max entities returned per scan
 * @property {number} soundsPerTick global sound budget per tick
 * @property {number} shakeGapTicks min ticks between two camera shakes for one player
 */

/** @type {readonly QualityTier[]} */
export const QUALITY = Object.freeze([
  Object.freeze({
    name: 'Low', particlesPerTick: 30, cullDistance: 48, maxDebris: 10, maxTempEntities: 40,
    updateInterval: 4, maxConcurrent: 2, blockOpsPerTick: 200, victimScanEvery: 6, victimScanMax: 24,
    soundsPerTick: 3, shakeGapTicks: 12,
  }),
  Object.freeze({
    name: 'Balanced', particlesPerTick: 60, cullDistance: 64, maxDebris: 20, maxTempEntities: 80,
    updateInterval: 3, maxConcurrent: 3, blockOpsPerTick: 400, victimScanEvery: 5, victimScanMax: 40,
    soundsPerTick: 5, shakeGapTicks: 8,
  }),
  Object.freeze({
    name: 'High', particlesPerTick: 110, cullDistance: 96, maxDebris: 36, maxTempEntities: 140,
    updateInterval: 2, maxConcurrent: 4, blockOpsPerTick: 800, victimScanEvery: 4, victimScanMax: 60,
    soundsPerTick: 8, shakeGapTicks: 6,
  }),
]);

/** Dimension ids handed to world.getDimension(). */
export const DIMENSION_IDS = Object.freeze(['overworld', 'nether', 'the_end']);

/** Fog helper: `/fog @s push nd:<disaster> nd_<disaster>`. */
export function fogId(disaster) { return NS + ':' + disaster; }
export function fogKey(disaster) { return NS + '_' + disaster; }
