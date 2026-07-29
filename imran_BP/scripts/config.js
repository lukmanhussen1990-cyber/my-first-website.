/**
 * Imran Security House - configuration and persistent settings.
 *
 * Two halves: the deployable house, and the zombie disaster it is built to
 * survive.
 */

import { world } from "@minecraft/server";

const PROP_PREFIX = "ih:";

export const SETTINGS_DEFAULTS = {
  /** Total zombies a single disaster sends at you. */
  hordeTotal: 1000,
  /**
   * How many may be alive at the same time. This is the setting that decides
   * whether your phone survives as well as you do: the disaster still spawns
   * `hordeTotal` in total, it just tops up as they die.
   */
  hordeMaxAlive: 150,
  /** Zombies added per wave. */
  hordeWaveSize: 12,
  /** Ticks between waves. */
  hordeWaveTicks: 10,
  /** Percent of the horde that explodes when killed. */
  bomberPercent: 15,
  /** Explosions from bombers may break blocks. */
  bomberBreaksBlocks: false,
  /** Typing the trigger phrase in chat starts a disaster. */
  chatTrigger: true,
  /** The house zaps any zombie that gets inside. */
  securitySystem: true,
  /** Block edits per tick while a house is going up. */
  buildSpeed: 160
};

export const TUNING = {
  /** How often the horde loop runs, in ticks. */
  tickInterval: 5,

  horde: {
    /** Ring the zombies appear in, around each player. */
    spawnMinDistance: 18,
    spawnMaxDistance: 48,
    /** Tries per spawn to find open ground. */
    placementTries: 8,
    /** Extra damage a bomber does when it goes off. */
    bomberPower: 2,
    /** Seconds a disaster keeps topping itself up before it gives up. */
    maxMinutes: 12
  },

  house: {
    /** Exterior footprint. The name needs the full 19 to spell out. */
    width: 19,
    depth: 15,
    /** Wall height above the floor. */
    wallHeight: 6,
    /** Parapet above the front wall that carries the name. */
    signHeight: 5,
    /** The security system's damage per second inside the walls. */
    zapDamage: 20,
    blocks: {
      floor: "minecraft:polished_deepslate",
      wall: "minecraft:stone_bricks",
      pillar: "minecraft:iron_block",
      roof: "minecraft:polished_deepslate",
      trim: "minecraft:chiseled_stone_bricks",
      window: "minecraft:iron_bars",
      light: "minecraft:glowstone",
      letter: "minecraft:gold_block",
      door: "minecraft:iron_door",
      lever: "minecraft:lever",
      carpet: "minecraft:red_carpet"
    }
  },

  /** Phrases that set the horde off when typed in chat. */
  chatPhrases: ["zombie disaster", "zombie apocalypse", "!horde"]
};

export const ZOMBIE_ID = "ih:violent_zombie";
export const DEPLOYER_ID = "ih:imran_house";
export const HORN_ID = "ih:horde_totem";

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
