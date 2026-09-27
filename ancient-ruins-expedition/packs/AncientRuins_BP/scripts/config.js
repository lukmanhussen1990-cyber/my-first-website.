// Shared identifiers and tuning values for Ancient Ruins Expedition.
// Targets @minecraft/server 1.10.0 (stable in Minecraft Bedrock 1.21.0).

export const NS = "ancient_ruins";

/** Ruin types keyed by the structure name. */
export const RUIN_TYPES = {
  jungle_temple: {
    theme: "temple",
    name: "Jungle Temple",
    color: "§2",
    boss: "ancient_ruins:jade_idol",
    bossName: "Jade Idol",
    guardian: "ancient_ruins:temple_guardian",
    altar: "ancient_ruins:temple_altar",
    rgb: { red: 0.25, green: 0.9, blue: 0.45 },
    flooded: false,
  },
  desert_crypt: {
    theme: "crypt",
    name: "Desert Crypt",
    color: "§6",
    boss: "ancient_ruins:sand_pharaoh",
    bossName: "Sand Pharaoh",
    guardian: "ancient_ruins:crypt_mummy",
    altar: "ancient_ruins:crypt_altar",
    rgb: { red: 1.0, green: 0.78, blue: 0.25 },
    flooded: false,
  },
  sunken_ship: {
    theme: "ship",
    name: "Sunken Ship",
    color: "§3",
    boss: "ancient_ruins:abyssal_admiral",
    bossName: "Abyssal Admiral",
    guardian: "ancient_ruins:drowned_captain",
    altar: "ancient_ruins:ship_altar",
    rgb: { red: 0.3, green: 0.9, blue: 0.95 },
    flooded: true,
  },
};

/** @type {Record<string, string>} */
export const THEME_TO_TYPE = { temple: "jungle_temple", crypt: "desert_crypt", ship: "sunken_ship" };

/** Active altar block id -> ruin type. */
/** @type {Record<string, string>} */
export const ALTAR_TO_TYPE = {
  "ancient_ruins:temple_altar": "jungle_temple",
  "ancient_ruins:crypt_altar": "desert_crypt",
  "ancient_ruins:ship_altar": "sunken_ship",
};

/** Boss entity id -> ruin type. */
/** @type {Record<string, string>} */
export const BOSS_TO_TYPE = {
  "ancient_ruins:jade_idol": "jungle_temple",
  "ancient_ruins:sand_pharaoh": "desert_crypt",
  "ancient_ruins:abyssal_admiral": "sunken_ship",
};
export const BOSS_IDS = Object.keys(BOSS_TO_TYPE);

export const BLOCK = {
  vaultSeal: "ancient_ruins:vault_seal",
  dormantAltar: "ancient_ruins:dormant_altar",
  trap: "ancient_ruins:trap_mechanism",
  miasma: "ancient_ruins:miasma_vent",
  commandBlock: "minecraft:command_block",
  dispenser: "minecraft:dispenser",
  redstone: "minecraft:redstone_block",
};

/** Crumbling floor block -> what it turns into when it collapses. */
/** @type {Record<string, string>} */
export const CRUMBLING = {
  "ancient_ruins:crumbling_temple_floor": "sand",
  "ancient_ruins:crumbling_sandstone": "sand",
  "ancient_ruins:rotten_planks": "break",
};

/** Ruin floor tiles -> ruin type (used to chart ruins you walk into). */
/** @type {Record<string, string>} */
export const FLOORS = {
  "ancient_ruins:temple_floor": "jungle_temple",
  "ancient_ruins:crypt_floor": "desert_crypt",
  "ancient_ruins:ship_floor": "sunken_ship",
  "ancient_ruins:crumbling_temple_floor": "jungle_temple",
  "ancient_ruins:crumbling_sandstone": "desert_crypt",
  "ancient_ruins:rotten_planks": "sunken_ship",
};

export const ITEM = {
  compass: "ancient_ruins:ruin_compass",
  ring: "ancient_ruins:cursed_ring",
  map: "ancient_ruins:ancient_map",
};

export const MARKER = "ancient_ruins:ruin_marker";

export const PARTICLE = {
  gas: "ancient_ruins:poison_gas",
  spark: "ancient_ruins:rune_spark",
  trail: "ancient_ruins:compass_trail",
  shockwave: "ancient_ruins:shockwave",
  dust: "ancient_ruins:dust_burst",
};

export const PROP = {
  track: "ancient_ruins:track",
  welcomed: "ancient_ruins:welcomed",
  bossRuin: "ancient_ruins:ruin",
  enraged: "ancient_ruins:enraged",
};

// Tuning (mobile friendly: few checks, small radii).
export const TUNING = {
  loopTicks: 5, // base script loop interval
  dedupeRadius: 40, // two ruins of the same type closer than this are one ruin
  populateRadius: 28, // guardians awaken when a player gets this close
  ringHealthCap: 12, // Cursed Ring: max 6 hearts
  ringSpeedAmplifier: 1, // Speed II
  trapCooldown: 60, // ticks between arrow volleys per trap plate
  collapseDelay: 8, // ticks between cracking and collapsing
  bossSpecialRange: 14,
  pharaohMummyCap: 4,
};
