// Shared ids and tuning values for the Magical Black Hole add-on.

export const ITEM_ID = "blackhole:magic_black_hole";
export const ENTITY_ID = "blackhole:black_hole";
export const SIZE_PROPERTY = "blackhole:size";

// Dynamic property keys
export const HOLE_DATA_KEY = "blackhole:data";
export const HOLE_TALLY_KEY = "blackhole:tally";
export const PLAYER_SETTINGS_KEY = "blackhole:settings";
export const PLAYER_ACTIVE_KEY = "blackhole:active";

// Tag given to players who already received their free black hole
export const GIFT_TAG = "blackhole_gift_received";

export const PARTICLE_VORTEX = "blackhole:vortex";
export const PARTICLE_SPARK = "blackhole:spark";
export const PARTICLE_BURST = "blackhole:burst";

export const LIFETIME_OPTIONS = [
  { label: "15 seconds", ticks: 15 * 20 },
  { label: "30 seconds", ticks: 30 * 20 },
  { label: "1 minute", ticks: 60 * 20 },
  { label: "2 minutes", ticks: 120 * 20 },
  { label: "5 minutes", ticks: 300 * 20 },
  { label: "Until recalled", ticks: 0 },
];

/** Settings a player can change from the sneak + use menu. */
export const DEFAULT_SETTINGS = {
  devourBlocks: true,
  maxSize: 4,
  lifetime: 2, // index into LIFETIME_OPTIONS
  pullPlayers: true,
  protectPets: true,
};

export const MIN_SIZE = 1;
export const MAX_SIZE = 8;

export const TUNING = {
  // Radii grow with the black hole's size (1 .. MAX_SIZE)
  pullRadiusBase: 6,
  pullRadiusPerSize: 4,
  absorbRadiusBase: 0.5,
  absorbRadiusPerSize: 0.5,
  blockRadiusPerSize: 1.1,
  maxBlockRadius: 9,

  // Pull physics (blocks per tick)
  pullSpeed: 0.08,
  maxPullSpeed: 1.0,
  swirl: 0.6,
  maxEntitiesPerTick: 120,

  // Block devouring (kept low for phones)
  devourDelay: 30,
  devourEvery: 2,
  blocksPerStep: 6,
  blockChecksPerStep: 48,
  rescanEvery: 100,

  // Damage dealt to other players inside the event horizon
  playerDamage: 2,
  playerDamageEvery: 4,

  // Growth: size = 1 + growthFactor * sqrt(mass)
  growthFactor: 0.5,
  massPerTick: 0.002,
  massPerItem: 0.02,
  massPerUnstackable: 0.3,
  massPerBlock: 0.08,
  massPerMobBase: 1,
  xpPerOrb: 2,

  // Animation lengths
  openTicks: 20,
  collapseTicks: 20,

  // Housekeeping
  useDebounceTicks: 8,
  saveEvery: 10,
  rescanEntitiesEvery: 20,
  deliverStacksPerTick: 16,
  forgetKilledAfter: 40,
};

/** Entities the black hole never touches. Players are handled separately. */
export const NEVER_PULL = [
  ENTITY_ID,
  "minecraft:player",
  "minecraft:npc",
  "minecraft:agent",
  "minecraft:lightning_bolt",
  "minecraft:area_effect_cloud",
  "minecraft:falling_block",
  "minecraft:leash_knot",
  "minecraft:evocation_fang",
  "minecraft:eye_of_ender_signal",
  "minecraft:fishing_hook",
];

/** Entities that are swallowed as an item instead of being killed (so nothing explodes). */
export const ITEMIZE = {
  "minecraft:tnt": "minecraft:tnt",
  "minecraft:ender_crystal": "minecraft:end_crystal",
  "minecraft:tnt_minecart": "minecraft:tnt_minecart",
  "minecraft:arrow": "minecraft:arrow",
  "minecraft:thrown_trident": "minecraft:trident",
};

/** Blocks that are never devoured (compared with the block's item id; blocks without an item are skipped too). */
export const UNBREAKABLE = new Set([
  "minecraft:bedrock",
  "minecraft:invisible_bedrock",
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
  "minecraft:portal",
  "minecraft:border_block",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:light_block",
  "minecraft:reinforced_deepslate",
  "minecraft:moving_block",
  "minecraft:piston_arm_collision",
  "minecraft:sticky_piston_arm_collision",
  "minecraft:bubble_column",
  "minecraft:trial_spawner",
  "minecraft:vault",
]);
