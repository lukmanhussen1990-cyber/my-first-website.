// Block classification lists. Pure data + predicates, no game imports (testable in plain Node).
//
// IMPORTANT (API fact): @minecraft/server 1.10.0 has NO Block.typeId / BlockPermutation.type.
// The only cheap way to identify a block is `permutation.getItemStack(1)?.typeId` (the block's item id),
// plus Block.isAir / Block.isLiquid. So every list below is expressed in ITEM ids of blocks, without the
// "minecraft:" prefix. Only blocks whose item id == block id are listed as modifiable terrain, so a
// journaled id can be handed straight to BlockPermutation.resolve() when restoring after a reload.

/** @param {string|null|undefined} id */
export function normId(id) {
  if (!id) return '';
  return id.startsWith('minecraft:') ? id.slice(10) : id;
}

/** @param {string} id namespaced id; adds "minecraft:" when no namespace is given. */
export function fullId(id) {
  return id.indexOf(':') >= 0 ? id : 'minecraft:' + id;
}

const VEGETATION = [
  'tallgrass', 'short_grass', 'tall_grass', 'fern', 'large_fern', 'double_plant', 'yellow_flower', 'red_flower',
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip',
  'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'sunflower', 'lilac', 'rose_bush', 'peony',
  'sapling', 'vine', 'deadbush', 'brown_mushroom', 'red_mushroom', 'waterlily', 'seagrass', 'kelp', 'bamboo',
  'sweet_berries', 'glow_lichen', 'moss_carpet', 'fire', 'web',
];

const TERRAIN = [
  'grass_block', 'grass', 'dirt', 'coarse_dirt', 'podzol', 'mycelium', 'dirt_with_roots', 'rooted_dirt',
  'sand', 'red_sand', 'gravel', 'stone', 'andesite', 'diorite', 'granite', 'deepslate', 'tuff',
  'sandstone', 'red_sandstone', 'clay', 'snow', 'snow_layer', 'ice', 'packed_ice', 'blue_ice',
  'netherrack', 'soul_sand', 'soul_soil', 'basalt', 'mud', 'moss_block', 'cactus', 'reeds',
  'hardened_clay', 'terracotta', 'stained_hardened_clay', 'log', 'log2', 'leaves', 'leaves2',
  'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore',
  'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_copper_ore', 'deepslate_gold_ore',
  'deepslate_redstone_ore', 'deepslate_lapis_ore', 'deepslate_diamond_ore', 'deepslate_emerald_ore',
  'mangrove_roots', 'azalea_leaves', 'flowering_azalea_leaves', 'pumpkin', 'melon_block',
].concat(VEGETATION);

const TERRAIN_SET = new Set(TERRAIN);
const VEGETATION_SET = new Set(VEGETATION);

/** Blocks a scan may look through when searching for the ground surface. */
export const PASSABLE_IDS = VEGETATION_SET;

/**
 * Natural terrain + vegetation that may be temporarily changed (and journaled) even with destruction OFF.
 * @param {string|null|undefined} id
 */
export function isTerrainId(id) {
  const n = normId(id);
  if (!n) return false;
  if (TERRAIN_SET.has(n)) return true;
  if (n.endsWith('_leaves')) return true;
  if (n.endsWith('_sapling')) return true;
  if (n.endsWith('_log') && !n.startsWith('stripped_')) return true;
  if (n.endsWith('_terracotta') && n.indexOf('glazed') < 0) return true;
  if (n.endsWith('_stained_hardened_clay')) return true;
  return false;
}

/** @param {string|null|undefined} id */
export function isPassableId(id) {
  const n = normId(id);
  return n !== '' && (VEGETATION_SET.has(n) || n.endsWith('_sapling'));
}

const PROTECTED_EXACT = new Set([
  'bedrock', 'barrier', 'border_block', 'light_block', 'invisible_bedrock', 'portal', 'nether_portal', 'end_portal',
  'end_portal_frame', 'end_gateway', 'reinforced_deepslate', 'jigsaw', 'bell', 'conduit', 'respawn_anchor',
  'decorated_pot', 'chiseled_bookshelf', 'daylight_detector', 'daylight_detector_inverted', 'enchanting_table',
  'ender_chest', 'brewing_stand', 'cauldron', 'composter', 'jukebox', 'lectern', 'beacon', 'crafter', 'vault',
  'trial_spawner', 'heavy_core', 'suspicious_sand', 'suspicious_gravel', 'structure_void', 'frame', 'glow_frame',
  'comparator', 'repeater', 'unpowered_comparator', 'powered_comparator', 'unpowered_repeater', 'powered_repeater',
  'lever', 'tripwire_hook', 'observer', 'note_block', 'target', 'lightning_rod', 'tnt',
]);

const PROTECTED_SUBSTR = [
  'chest', 'barrel', 'furnace', 'smoker', 'hopper', 'dropper', 'dispenser', 'sign', 'banner', 'shulker_box',
  'command_block', 'structure_block', 'spawner', 'campfire', 'portal', 'skull', 'piston', 'sculk_', 'candle',
  'lantern', 'grindstone', 'stonecutter', 'loom', 'smithing_table', 'cartography_table', 'fletching_table',
  'crafting_table', 'anvil', 'bookshelf', 'redstone', 'rail',
];

/**
 * Blocks that must NEVER be touched (block entities, inventories, portals, redstone, technical blocks).
 * @param {string|null|undefined} id
 */
export function isProtectedId(id) {
  const n = normId(id);
  if (!n) return false;
  if (PROTECTED_EXACT.has(n)) return true;
  if (n === 'bed' || n.endsWith('_bed')) return true;
  for (let i = 0; i < PROTECTED_SUBSTR.length; i++) {
    if (n.indexOf(PROTECTED_SUBSTR[i]) >= 0) {
      if (n === 'redstone_ore' || n === 'deepslate_redstone_ore') return false;
      return true;
    }
  }
  return false;
}

const RESTRICTED_PLACE = new Set(['fire', 'soul_fire', 'lava', 'flowing_lava', 'tnt', 'lit_pumpkin']);

/**
 * Placing these is only allowed with destruction ON and `permanent:true` (fire/lava cannot be journaled safely).
 * @param {string} id
 */
export function isRestrictedPlacement(id) {
  return RESTRICTED_PLACE.has(normId(id));
}

/**
 * Placing these is never allowed (containers, technical blocks, portals).
 * @param {string} id
 */
export function isForbiddenPlacement(id) {
  const n = normId(id);
  if (n === 'tnt') return false; // handled by isRestrictedPlacement
  return isProtectedId(n);
}

/** @param {string|null|undefined} id */
export function isWaterId(id) {
  const n = normId(id);
  return n === 'water' || n === 'flowing_water';
}

/** @param {string|null|undefined} id */
export function isLavaId(id) {
  const n = normId(id);
  return n === 'lava' || n === 'flowing_lava';
}
