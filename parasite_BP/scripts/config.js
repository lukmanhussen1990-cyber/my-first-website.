/**
 * Parasite - configuration and persistent settings.
 *
 * SETTINGS can be changed in game from the Parasite Sample menu.
 * TUNING is for pack authors.
 */

import { world } from "@minecraft/server";

const PROP_PREFIX = "pm:";

export const SETTINGS_DEFAULTS = {
  /** Parasites chew through the blocks around them. */
  eatBlocks: true,
  /** Chests, furnaces and other containers may be eaten too. */
  eatContainers: false,
  /** Parasites grow and split when they have eaten enough. */
  breeding: true,
  /** Hard limit on how many parasites may exist in one world. */
  maxPopulation: 25,
  /** Blocks eaten per second by one adult parasite. */
  biteRate: 4,
  /** Leave infested flesh behind instead of plain air. */
  leaveFlesh: true
};

export const TUNING = {
  /** How often the swarm loop runs, in ticks. */
  tickInterval: 5,
  /** Feeding radius per growth stage. */
  radius: { small: 3.0, large: 4.5, apex: 6.5 },
  /** Biomass gained from each kind of meal. */
  food: { block: 1, item: 2, mob: 12, player: 20 },
  /** Biomass needed to reach the next stage. */
  growth: { large: 45, apex: 110 },
  /** Biomass spent when an apex parasite splits off a new one. */
  splitCost: 50,
  /** Seconds between two splits from the same parasite. */
  splitCooldownSeconds: 25,
  /** Health regained per feeding tick while eating. */
  regenPerTick: 0.5,
  /** Blocks that are never eaten. */
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
    "minecraft:flowing_lava",
    "pm:infested_flesh"
  ],
  /** Containers, only eaten when the eatContainers setting is on. */
  containerBlocks: [
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
    "minecraft:dispenser",
    "minecraft:dropper",
    "minecraft:beacon",
    "minecraft:lectern",
    "minecraft:jukebox"
  ]
};

export const PARASITE_ID = "pm:parasite";
export const SAMPLE_ID = "pm:parasite_sample";
export const FLESH_ID = "pm:infested_flesh";

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
