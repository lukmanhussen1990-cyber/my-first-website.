/**
 * Kaiju Rampage - configuration and persistent settings.
 *
 * The kaiju is meant to wreck things, so `destroyBlocks` is ON by default.
 * Everything destructive is still capped and can be switched off in game.
 */

import { world } from "@minecraft/server";

const PROP_PREFIX = "kj:";

export const SETTINGS_DEFAULTS = {
  /** The kaiju smashes the terrain and buildings it walks through. */
  destroyBlocks: true,
  /** It hunts players as well as mobs. */
  huntPlayers: true,
  /** The atomic breath is available. */
  atomicBreath: true,
  /** Its roar shakes screens and sickens anyone nearby. */
  roar: true,
  /** How many kaiju may exist at once. */
  maxKaiju: 2,
  /** Scale of the destruction, in percent. 100 = as designed. */
  destructionPercent: 100,
  /** Blocks the atomic beam and stomps are allowed to break per tick. */
  maxBlockOpsPerTick: 140
};

export const TUNING = {
  /** How often the rampage loop runs, in ticks. */
  tickInterval: 4,

  /** Body size used for smashing: the kaiju clears its own path. */
  body: { radius: 3.2, height: 13, forwardReach: 4.5 },

  /** Footfalls. */
  stomp: {
    /** Ticks between stomps while it is moving. */
    interval: 14,
    radius: 4.5,
    damage: 14,
    launch: 0.9,
    crackDepth: 2,
    shakeIntensity: 0.12,
    shakeRadius: 45
  },

  /** Tail sweep: a wide melee that flattens anything close. */
  tail: {
    cooldownTicks: 20 * 9,
    radius: 9,
    damage: 26,
    launch: 1.3,
    blockRadius: 4
  },

  /** Atomic breath: charge, then carve a trench through the world. */
  breath: {
    cooldownTicks: 20 * 22,
    chargeTicks: 60,
    range: 46,
    beamRadius: 2.4,
    damage: 55,
    splashDamage: 22,
    explosionPower: 4,
    burnSeconds: 10,
    /** Chance a block along the beam is turned to magma instead of air. */
    scorchChance: 0.22
  },

  /** Roar: screen shake, nausea and slowness for everything nearby. */
  roar: {
    cooldownTicks: 20 * 30,
    radius: 55,
    damage: 4,
    shakeIntensity: 0.25,
    nauseaSeconds: 8,
    slownessSeconds: 6
  },

  /** Below this fraction of health it enrages: faster and far angrier. */
  enrageAtHealthFraction: 0.5,
  /** Cooldowns are multiplied by this once enraged. */
  enrageCooldownScale: 0.55,
  /** Health regained per rampage tick. */
  regenPerTick: 0.35,

  /** Death throes. */
  death: { explosionPower: 8, craterRadius: 7 },

  /** Blocks the kaiju cannot break. */
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
    "minecraft:nether_portal",
    "minecraft:portal",
    "minecraft:mob_spawner",
    "minecraft:reinforced_deepslate",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava"
  ]
};

export const KAIJU_ID = "kj:kaiju";
export const HORN_ID = "kj:kaiju_horn";

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

/** Scales a destruction number by the destructionPercent setting. */
export function scaled(amount) {
  return (amount * getSetting("destructionPercent")) / 100;
}
