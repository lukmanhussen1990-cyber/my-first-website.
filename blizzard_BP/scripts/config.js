/**
 * Extreme Blizzard - configuration and persistent settings.
 *
 * The whole point of the pack: outside is lethal within seconds, and the only
 * thing that saves you is a sealed room with a heat source in it.
 */

import { world } from "@minecraft/server";

const PROP_PREFIX = "sw:";

export const SETTINGS_DEFAULTS = {
  /** The blizzard cycles on and off by itself. */
  enabled: true,
  /** Never stops. Overrides the cycle. */
  alwaysOn: false,
  /** Minutes of calm between storms. */
  calmMinutes: 6,
  /** Minutes each storm lasts. */
  stormMinutes: 8,
  /** Being outside in a storm freezes and kills you. */
  deadlyOutside: true,
  /** Mobs caught outside freeze to death too. */
  mobsFreeze: true,
  /** Snow piles up and water freezes during a storm. */
  snowBuildUp: true,
  /** Whiteout fog while you are outside in a storm. */
  fog: true,
  /** How fast you freeze outside, in percent. 100 = as designed. */
  harshnessPercent: 100
};

export const TUNING = {
  /** How often the freeze loop runs, in ticks. */
  tickInterval: 10,

  temperature: {
    /** Body heat runs 0 (freezing to death) to 100 (fine). */
    max: 100,
    /** Lost per second with no shelter at all. */
    dropOutside: 25,
    /** Lost per second in a sealed room with no heat source. */
    dropSheltered: 4,
    /** Gained per second in a sealed, heated room. */
    riseWarm: 22,
    /** Gained per second standing next to a fire outdoors. */
    riseFireOutside: 6,
    /** Below this you start taking damage. */
    damageBelow: 1,
    /** Damage per second once you hit zero. */
    damagePerSecond: 16,
    /** Below this the screen ices over and you slow down. */
    slowBelow: 55,
    /** Every piece of leather armour is worth this much resistance, in percent. */
    leatherResistPercent: 12
  },

  shelter: {
    /** Air blocks a room may hold before it counts as "outdoors". */
    maxRoomCells: 160,
    /** How far the flood fill may wander from the player. */
    maxRoomRadius: 14,
    /** Heat sources needed for a room to count as warm. */
    heatNeeded: 1,
    /** Extra warmth radius checked around the player when outdoors. */
    outdoorFireRadius: 4
  },

  storm: {
    /** Mob damage per second outdoors. */
    mobDamagePerSecond: 10,
    /** Snow layers / ice placed per tick, world wide. */
    maxBlockOpsPerTick: 40,
    /** How far from a player snow piles up. */
    buildRadius: 26,
    /** Chance per attempt that a spot gets a snow layer. */
    snowChance: 0.5
  },

  /** Blocks that count as heat sources, with how much warmth each is worth. */
  heatSources: {
    "sw:heater": 4,
    "minecraft:lava": 3,
    "minecraft:flowing_lava": 3,
    "minecraft:campfire": 2,
    "minecraft:lit_campfire": 2,
    "minecraft:soul_campfire": 2,
    "minecraft:fire": 2,
    "minecraft:soul_fire": 2,
    "minecraft:lit_furnace": 2,
    "minecraft:lit_blast_furnace": 2,
    "minecraft:lit_smoker": 2,
    "minecraft:magma": 1,
    "minecraft:torch": 1,
    "minecraft:soul_torch": 1,
    "minecraft:lantern": 1,
    "minecraft:soul_lantern": 1,
    "minecraft:glowstone": 1,
    "minecraft:shroomlight": 1,
    "minecraft:froglight": 1,
    "minecraft:ochre_froglight": 1,
    "minecraft:verdant_froglight": 1,
    "minecraft:pearlescent_froglight": 1
  },

  /** Mobs that shrug the cold off. */
  coldImmune: [
    "minecraft:snow_golem",
    "minecraft:stray",
    "minecraft:polar_bear",
    "minecraft:skeleton_horse",
    "minecraft:wither",
    "minecraft:ender_dragon",
    "minecraft:iron_golem",
    "minecraft:armor_stand",
    "minecraft:wandering_trader_llama"
  ]
};

export const HEATER_ID = "sw:heater";
export const STONE_ID = "sw:weather_stone";
export const COCOA_ID = "sw:hot_cocoa";
export const WARMER_ID = "sw:hand_warmer";

const cache = { ...SETTINGS_DEFAULTS };
let loaded = false;

export function loadSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    try {
      const stored = world.getDynamicProperty(PROP_PREFIX + key);
      if (stored !== undefined && typeof stored === typeof SETTINGS_DEFAULTS[key]) cache[key] = stored;
    } catch {
      // keep the default
    }
  }
  loaded = true;
}

export function getSetting(key) {
  if (!loaded) loadSettings();
  return cache[key];
}

export function setSetting(key, value) {
  if (!(key in SETTINGS_DEFAULTS)) return;
  cache[key] = value;
  try {
    world.setDynamicProperty(PROP_PREFIX + key, value);
  } catch {
    // session only
  }
}

export function resetSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, SETTINGS_DEFAULTS[key]);
}

/** Scales a "how fast you freeze" number by the harshness setting. */
export function harsh(amount) {
  return (amount * getSetting("harshnessPercent")) / 100;
}
