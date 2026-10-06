// @ts-check
// Tunables and block-id helpers of the Tactical Torchlight (SPEC §5).

/** Ticks between two light updates (10 updates per second). */
export const UPDATE_INTERVAL_TICKS = 2;
/** Ticks between maintenance passes (pending cleanup retries, offline sweep). */
export const MAINTENANCE_INTERVAL_TICKS = 40;
/** A player whose anchor cells did not change is re-validated at most this often. */
export const REFRESH_TICKS = 20;

/** Beam length in blocks. */
export const MAX_DISTANCE = 24;
/** Light levels of the three anchors. */
export const SPOT_LEVEL = 15;
export const MID_LEVEL = 13;
export const NEAR_LEVEL = 11;
/** The mid anchor sits at this fraction of the beam length. */
export const MID_FRACTION = 0.45;
/** The near anchor sits this many blocks ahead of the eyes. */
export const NEAR_DISTANCE = 2.5;
/** Mid/near anchors stay at least this far in front of the hit point (never behind a wall). */
export const WALL_MARGIN = 0.25;
/** Walking back along the ray for an air cell: step length and number of steps (3 blocks). */
export const WALK_BACK_STEP = 0.5;
export const WALK_BACK_STEPS = 6;
/** Stale pending cells processed per maintenance pass (bounded work). */
export const PENDING_PER_PASS = 64;
/** Upper bound for the persisted cell list read at startup (ignores corrupt/huge data). */
export const MAX_STORED_CELLS = 4096;

export const AIR = "minecraft:air";
export const LIGHT_BLOCK = "minecraft:light_block";
export const LIGHT_LEVEL_STATE = "block_light_level";

/**
 * Is this one of the invisible light blocks: `minecraft:light_block` (1.21.0, level in the
 * `block_light_level` state) or `minecraft:light_block_<N>` (split ids of newer builds)?
 * @param {string | undefined} typeId
 * @returns {boolean}
 */
export function isLightBlockId(typeId) {
  return typeof typeId === "string" && (typeId === LIGHT_BLOCK || /^minecraft:light_block_\d+$/.test(typeId));
}

/** Liquids: never a beam hit (the beam passes through), never a valid anchor (not air). */
const LIQUID_RE = /^minecraft:(flowing_)?(water|lava)$/;

/**
 * Blocks without collision that the beam passes through in the manual fallback raycast
 * (mirrors `includePassableBlocks: false` of Dimension.getBlockFromRay; heuristic only).
 */
const PASSABLE_RE = new RegExp(
  "^minecraft:(" +
    [
      "structure_void",
      "short_grass",
      "tall_grass",
      "(large_)?fern",
      "dead_?bush",
      "seagrass",
      "kelp",
      "(weeping_|twisting_)?vines?",
      "cave_vines.*",
      "glow_lichen",
      "sculk_vein",
      ".*torch",
      "lever",
      ".*_button",
      ".*_pressure_plate",
      "trip_wire",
      "tripwire_hook",
      "redstone_wire",
      "(golden_|detector_|activator_)?rail",
      ".*sapling",
      "wheat|carrots|potatoes|beetroot|melon_stem|pumpkin_stem|torchflower_crop|pitcher_crop|nether_wart",
      "sweet_berry_bush",
      "reeds",
      "web",
      "(soul_)?fire",
      "poppy|dandelion|red_flower|yellow_flower|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy",
      "cornflower|lily_of_the_valley|wither_rose|torchflower|pitcher_plant|sunflower|lilac|rose_bush|peony",
      "double_plant|pink_petals|(brown|red)_mushroom|(crimson|warped)_(fungus|roots)|nether_sprouts",
      "hanging_roots|spore_blossom|snow_layer",
      ".*standing_sign|.*wall_sign|.*_hanging_sign|standing_banner|wall_banner",
      "frog_spawn",
      ".*coral_fan.*|.*coral_wall_fan.*|(dead_)?(tube|brain|bubble|fire|horn)_coral",
    ].join("|") +
    ")$",
);

/**
 * Whether a block stops the beam in the manual fallback raycast: anything that is not
 * air, a light block, a liquid or a known passable (collision-less) block.
 * @param {string} typeId
 * @returns {boolean}
 */
export function stopsBeam(typeId) {
  if (typeId === AIR || isLightBlockId(typeId)) return false;
  if (LIQUID_RE.test(typeId)) return false;
  return !PASSABLE_RE.test(typeId);
}
