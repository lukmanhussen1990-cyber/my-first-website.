/**
 * Natural Disasters - configuration + persistent settings.
 *
 * Everything a player can change from the Disaster Wand menu lives in SETTINGS.
 * Everything that only a pack author should change lives in TUNING.
 */

import { world } from "@minecraft/server";

/** Prefix used for all world dynamic properties written by this addon. */
const PROP_PREFIX = "nd:";

/** Player changeable settings and their defaults. */
export const SETTINGS_DEFAULTS = {
  /** Random disasters fire on their own while you play. */
  randomDisasters: true,
  /** Shortest gap between two random disasters, in minutes. */
  minMinutes: 8,
  /** Longest gap between two random disasters, in minutes. */
  maxMinutes: 20,
  /** Disasters are allowed to break/replace blocks. */
  blockDamage: true,
  /** Disasters are allowed to hurt players. */
  playerDamage: true,
  /** Seconds of public warning before a random disaster starts. */
  publicWarnSeconds: 10,
  /** Seconds of warning a player holding a Disaster Detector gets. */
  detectorWarnSeconds: 45
};

/** Values that are not exposed in the in-game menu. */
export const TUNING = {
  /** Hard cap on how many disasters may run at the same time. */
  maxActiveDisasters: 3,
  /** Hard cap on block changes performed per game tick (mobile friendly). */
  maxBlockOpsPerTick: 120,
  /** How far from a player a random disaster may spawn. */
  randomSpawnMinDistance: 20,
  randomSpawnMaxDistance: 55,
  /** Blocks that disasters never touch. */
  protectedBlocks: [
    "minecraft:bedrock",
    "minecraft:barrier",
    "minecraft:command_block",
    "minecraft:chain_command_block",
    "minecraft:repeating_command_block",
    "minecraft:structure_block",
    "minecraft:structure_void",
    "minecraft:jigsaw",
    "minecraft:end_portal",
    "minecraft:end_portal_frame",
    "minecraft:end_gateway",
    "minecraft:chest",
    "minecraft:trapped_chest",
    "minecraft:ender_chest",
    "minecraft:barrel",
    "minecraft:shulker_box",
    "minecraft:undyed_shulker_box",
    "minecraft:hopper",
    "minecraft:furnace",
    "minecraft:lit_furnace",
    "minecraft:blast_furnace",
    "minecraft:lit_blast_furnace",
    "minecraft:smoker",
    "minecraft:lit_smoker",
    "minecraft:brewing_stand",
    "minecraft:beacon",
    "minecraft:bed",
    "minecraft:respawn_anchor",
    "minecraft:dispenser",
    "minecraft:dropper",
    "minecraft:jukebox",
    "minecraft:lectern",
    "minecraft:mob_spawner",
    "minecraft:reinforced_deepslate"
  ],

  tornado: {
    durationTicks: 20 * 70,
    radius: 11,
    liftRadius: 14,
    moveSpeed: 0.32,
    turnAmount: 0.09,
    pullStrength: 0.55,
    liftStrength: 0.75,
    damagePerSecond: 2,
    /** Chance per tick that the funnel rips a light block out of the ground. */
    blockRipChance: 0.55
  },

  earthquake: {
    durationTicks: 20 * 22,
    radius: 26,
    shakeIntensity: 0.14,
    /** Fissures opened per second. */
    fissuresPerSecond: 2,
    fissureLength: 7,
    fissureDepth: 4,
    crumbleChance: 0.35,
    damagePerSecond: 2
  },

  meteor: {
    /** Height above the target the rock spawns at. */
    spawnHeight: 90,
    speed: 1.7,
    explosionPower: 5,
    /** Extra small meteors that fall with the main one. */
    showerCount: 4,
    showerSpread: 26,
    showerExplosionPower: 2,
    maxFlightTicks: 20 * 30
  },

  tsunami: {
    /** Half width of the wave, in blocks. */
    halfWidth: 14,
    height: 6,
    /** How many blocks the wave front travels each step. */
    stepBlocks: 1,
    /** Ticks between wave steps (lower = faster). */
    ticksPerStep: 2,
    /** How many blocks the wave travels in total. */
    travelDistance: 70,
    /** How many columns of water stay behind the crest. */
    trailLength: 5,
    pushStrength: 0.9,
    damagePerSecond: 1
  },

  wildfire: {
    durationTicks: 20 * 75,
    startRadius: 3,
    maxRadius: 30,
    /** New fire blocks placed per tick. */
    spreadPerTick: 4,
    maxFires: 600,
    igniteEntityRange: 2.5
  },

  lightningStorm: {
    durationTicks: 20 * 45,
    radius: 30,
    /** Ticks between strikes. */
    strikeInterval: 9,
    /** Chance a strike is aimed close to a player. */
    huntPlayerChance: 0.35,
    /** How close to a player a hunting strike may land. */
    huntMinDistance: 3,
    setThunderWeather: true
  }
};

/** In-memory copy of the settings, kept in sync with the world properties. */
const cache = { ...SETTINGS_DEFAULTS };
let loaded = false;

function propId(key) {
  return PROP_PREFIX + key;
}

/** Reads every setting out of the world, falling back to the defaults. */
export function loadSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    try {
      const stored = world.getDynamicProperty(propId(key));
      if (stored !== undefined && typeof stored === typeof SETTINGS_DEFAULTS[key]) {
        cache[key] = stored;
      }
    } catch {
      // Dynamic properties unavailable - keep the default.
    }
  }
  loaded = true;
}

/** Current value of a single setting. */
export function getSetting(key) {
  if (!loaded) loadSettings();
  return cache[key];
}

/** All settings as a plain object (safe to read, changes are ignored). */
export function getSettings() {
  if (!loaded) loadSettings();
  return { ...cache };
}

/** Writes a single setting and persists it in the world when possible. */
export function setSetting(key, value) {
  if (!(key in SETTINGS_DEFAULTS)) return;
  cache[key] = value;
  try {
    world.setDynamicProperty(propId(key), value);
  } catch {
    // World save not available - the value still applies for this session.
  }
}

/** Restores every setting to its default value. */
export function resetSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    setSetting(key, SETTINGS_DEFAULTS[key]);
  }
}
