// @ts-check
/**
 * SCP-096 - rage block clearing (Behaviour Pack script).
 *
 * While an `scp:scp096` is in its rage-run state (`minecraft:variant` value 3) this script
 * clears SOFT blocks (doors, glass, leaves, wood, ...) in a small box in front of it, so the
 * pathfinder can open a route to its target. The entity's own `minecraft:break_blocks`
 * component only handles blocks it is already touching; this script keeps the lane ahead open.
 *
 * Hard rules:
 *  - Targets `@minecraft/server` 1.11.0 (manifest: module_name "@minecraft/server", version
 *    "1.11.0") and needs NO experimental toggle. On Minecraft 1.21.0 preview 26 the members
 *    `Block.typeId`, `Block.setType` and `World.gameRules` are still Beta-only, so every use of
 *    them is optional: blocks are identified through `Block.getItemStack().typeId` (stable)
 *    when `typeId` is missing, blocks are removed with `/setblock ... air destroy`, and an
 *    unreadable `mobGriefing` rule counts as "on".
 *  - Only ids in ALLOWED_BLOCK_IDS can ever be removed (explicit list, every id exists in
 *    Mojang's mojang-blocks.json for 1.21.0). DENIED_BLOCK_IDS / DENIED_SUFFIXES are checked
 *    first and always win (defence in depth: bedrock, obsidian, containers, ...).
 *  - Respects the `mobGriefing` game rule, read on every pass.
 *  - Never throws out of the interval callback, never logs per tick: at most one
 *    `console.warn` per distinct failure kind for the whole session. Unloaded chunks and
 *    removed entities are expected conditions and stay silent.
 *  - Work per pass is capped (entities, blocks looked at, blocks broken).
 *
 * Syntax is deliberately conservative (ES2019, no optional chaining) for the embedded engine.
 */
import { world, system } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").EntityVariantComponent} EntityVariantComponent */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/**
 * One block position of the probe box. `forward` and `lateral` are the distances (in blocks)
 * of the block centre from the entity along / across its horizontal heading.
 * @typedef {{ x: number, y: number, z: number, forward: number, lateral: number }} ProbeCell
 */

// ---------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------

export const ENTITY_TYPE_ID = "scp:scp096";
export const VARIANT_COMPONENT_ID = "minecraft:variant";
/** `minecraft:variant` value that the behaviour pack sets for the rage-run state. */
export const RAGE_RUN_VARIANT = 3;
/** Short dimension ids accepted by `world.getDimension`. */
export const DIMENSION_IDS = Object.freeze(["overworld", "nether", "the_end"]);
/** One pass every 3 ticks (0.15 s): a sprinting SCP-096 covers about 2.6 blocks in that time. */
export const PASS_INTERVAL_TICKS = 3;

/**
 * Probe box in the entity's horizontal frame. A block belongs to the box when the distance of
 * its centre along the heading is in (minForward, maxForward] and the sideways distance is in
 * [-halfWidth, +halfWidth) (half-open, so the box is exactly 3 block columns wide for an
 * axis-aligned heading). Vertically it covers `height` blocks starting at the block that
 * contains the entity's feet, i.e. the floor is never touched (`feetEpsilon` absorbs float
 * noise such as y = 63.99999 for an entity standing on the top of the block at y = 63).
 */
export const PROBE = Object.freeze({
  halfWidth: 1.5,
  minForward: 0,
  maxForward: 2.5,
  height: 3,
  feetEpsilon: 0.01,
  /** Skip when the horizontal part of the (unit) view direction is shorter than this. */
  minHorizontalView: 0.05,
});

export const LIMITS = Object.freeze({
  maxBreaksPerEntity: 12,
  maxBreaksPerPass: 36,
  maxRagingEntitiesPerPass: 12,
  maxEntitiesExaminedPerDimension: 256,
});

const AIR_ID = "minecraft:air";

// ---------------------------------------------------------------------------------------
// Block lists (Bedrock 1.21.0 ids; every id is verified against mojang-blocks.json by
// tools/test_script.mjs). Names are listed without the "minecraft:" prefix.
// ---------------------------------------------------------------------------------------

const DOORS = [
  "acacia_door", "bamboo_door", "birch_door", "cherry_door", "copper_door", "crimson_door",
  "dark_oak_door", "exposed_copper_door", "iron_door", "jungle_door", "mangrove_door",
  "oxidized_copper_door", "spruce_door", "warped_door", "waxed_copper_door",
  "waxed_exposed_copper_door", "waxed_oxidized_copper_door", "waxed_weathered_copper_door",
  "weathered_copper_door", "wooden_door",
];

const TRAPDOORS = [
  "acacia_trapdoor", "bamboo_trapdoor", "birch_trapdoor", "cherry_trapdoor", "copper_trapdoor",
  "crimson_trapdoor", "dark_oak_trapdoor", "exposed_copper_trapdoor", "iron_trapdoor",
  "jungle_trapdoor", "mangrove_trapdoor", "oxidized_copper_trapdoor", "spruce_trapdoor",
  "trapdoor", "warped_trapdoor", "waxed_copper_trapdoor", "waxed_exposed_copper_trapdoor",
  "waxed_oxidized_copper_trapdoor", "waxed_weathered_copper_trapdoor",
  "weathered_copper_trapdoor",
];

const FENCE_GATES = [
  "acacia_fence_gate", "bamboo_fence_gate", "birch_fence_gate", "cherry_fence_gate",
  "crimson_fence_gate", "dark_oak_fence_gate", "fence_gate", "jungle_fence_gate",
  "mangrove_fence_gate", "spruce_fence_gate", "warped_fence_gate",
];

const FENCES = [
  "acacia_fence", "bamboo_fence", "birch_fence", "cherry_fence", "crimson_fence",
  "dark_oak_fence", "jungle_fence", "mangrove_fence", "oak_fence", "spruce_fence",
  "warped_fence",
];

const PLANKS = [
  "acacia_planks", "bamboo_planks", "birch_planks", "cherry_planks", "crimson_planks",
  "dark_oak_planks", "jungle_planks", "mangrove_planks", "oak_planks", "spruce_planks",
  "warped_planks",
];

const BAMBOO_MOSAIC = [
  "bamboo_mosaic", "bamboo_mosaic_double_slab", "bamboo_mosaic_slab", "bamboo_mosaic_stairs",
];

const LOGS_AND_WOOD = [
  "acacia_log", "acacia_wood", "birch_log", "birch_wood", "cherry_log", "cherry_wood",
  "dark_oak_log", "dark_oak_wood", "jungle_log", "jungle_wood", "mangrove_log",
  "mangrove_wood", "oak_log", "oak_wood", "spruce_log", "spruce_wood", "stripped_acacia_log",
  "stripped_acacia_wood", "stripped_birch_log", "stripped_birch_wood", "stripped_cherry_log",
  "stripped_cherry_wood", "stripped_dark_oak_log", "stripped_dark_oak_wood",
  "stripped_jungle_log", "stripped_jungle_wood", "stripped_mangrove_log",
  "stripped_mangrove_wood", "stripped_oak_log", "stripped_oak_wood", "stripped_spruce_log",
  "stripped_spruce_wood",
];

const STEMS_HYPHAE_BAMBOO_BLOCKS = [
  "bamboo_block", "crimson_hyphae", "crimson_stem", "stripped_bamboo_block",
  "stripped_crimson_hyphae", "stripped_crimson_stem", "stripped_warped_hyphae",
  "stripped_warped_stem", "warped_hyphae", "warped_stem",
];

const WOODEN_SLABS = [
  "acacia_double_slab", "acacia_slab", "bamboo_double_slab", "bamboo_slab",
  "birch_double_slab", "birch_slab", "cherry_double_slab", "cherry_slab",
  "crimson_double_slab", "crimson_slab", "dark_oak_double_slab", "dark_oak_slab",
  "jungle_double_slab", "jungle_slab", "mangrove_double_slab", "mangrove_slab",
  "oak_double_slab", "oak_slab", "spruce_double_slab", "spruce_slab", "warped_double_slab",
  "warped_slab",
];

const WOODEN_STAIRS = [
  "acacia_stairs", "bamboo_stairs", "birch_stairs", "cherry_stairs", "crimson_stairs",
  "dark_oak_stairs", "jungle_stairs", "mangrove_stairs", "oak_stairs", "spruce_stairs",
  "warped_stairs",
];

const LEAVES = [
  "acacia_leaves", "azalea_leaves", "azalea_leaves_flowered", "birch_leaves", "cherry_leaves",
  "dark_oak_leaves", "jungle_leaves", "mangrove_leaves", "oak_leaves", "spruce_leaves",
];

const GLASS = [
  "glass", "glass_pane", "tinted_glass",
];

const STAINED_GLASS = [
  "black_stained_glass", "black_stained_glass_pane", "blue_stained_glass",
  "blue_stained_glass_pane", "brown_stained_glass", "brown_stained_glass_pane",
  "cyan_stained_glass", "cyan_stained_glass_pane", "gray_stained_glass",
  "gray_stained_glass_pane", "green_stained_glass", "green_stained_glass_pane",
  "light_blue_stained_glass", "light_blue_stained_glass_pane", "light_gray_stained_glass",
  "light_gray_stained_glass_pane", "lime_stained_glass", "lime_stained_glass_pane",
  "magenta_stained_glass", "magenta_stained_glass_pane", "orange_stained_glass",
  "orange_stained_glass_pane", "pink_stained_glass", "pink_stained_glass_pane",
  "purple_stained_glass", "purple_stained_glass_pane", "red_stained_glass",
  "red_stained_glass_pane", "white_stained_glass", "white_stained_glass_pane",
  "yellow_stained_glass", "yellow_stained_glass_pane",
];

const WOOL = [
  "black_wool", "blue_wool", "brown_wool", "cyan_wool", "gray_wool", "green_wool",
  "light_blue_wool", "light_gray_wool", "lime_wool", "magenta_wool", "orange_wool",
  "pink_wool", "purple_wool", "red_wool", "white_wool", "yellow_wool",
];

const CARPETS = [
  "black_carpet", "blue_carpet", "brown_carpet", "cyan_carpet", "gray_carpet", "green_carpet",
  "light_blue_carpet", "light_gray_carpet", "lime_carpet", "magenta_carpet", "orange_carpet",
  "pink_carpet", "purple_carpet", "red_carpet", "white_carpet", "yellow_carpet",
];

const MISC = [
  "bamboo", "hay_block", "ladder", "scaffolding", "web",
];

const SIGNS = [
  "acacia_hanging_sign", "acacia_standing_sign", "acacia_wall_sign", "bamboo_hanging_sign",
  "bamboo_standing_sign", "bamboo_wall_sign", "birch_hanging_sign", "birch_standing_sign",
  "birch_wall_sign", "cherry_hanging_sign", "cherry_standing_sign", "cherry_wall_sign",
  "crimson_hanging_sign", "crimson_standing_sign", "crimson_wall_sign",
  "dark_oak_hanging_sign", "darkoak_standing_sign", "darkoak_wall_sign", "jungle_hanging_sign",
  "jungle_standing_sign", "jungle_wall_sign", "mangrove_hanging_sign",
  "mangrove_standing_sign", "mangrove_wall_sign", "oak_hanging_sign", "spruce_hanging_sign",
  "spruce_standing_sign", "spruce_wall_sign", "standing_sign", "wall_sign",
  "warped_hanging_sign", "warped_standing_sign", "warped_wall_sign",
];

/** Everything SCP-096 may remove. Anything not listed here is never touched. */
export const ALLOWED_BLOCK_IDS = Object.freeze(
  /** @type {string[]} */ ([])
    .concat(
      DOORS,
      TRAPDOORS,
      FENCE_GATES,
      FENCES,
      PLANKS,
      BAMBOO_MOSAIC,
      LOGS_AND_WOOD,
      STEMS_HYPHAE_BAMBOO_BLOCKS,
      WOODEN_SLABS,
      WOODEN_STAIRS,
      LEAVES,
      GLASS,
      STAINED_GLASS,
      WOOL,
      CARPETS,
      MISC,
      SIGNS
    )
    .map((name) => "minecraft:" + name)
);

/**
 * Never removed, even if somebody later adds a matching id to the allow-list. Checked first.
 * Covers unbreakable / protected blocks, portals, technical blocks, valuable blocks and every
 * block that can hold items.
 */
const DENIED_NAMES = [
  // unbreakable or near-unbreakable
  "bedrock", "invisible_bedrock", "obsidian", "crying_obsidian", "glowingobsidian",
  "netherreactor", "reinforced_deepslate", "barrier", "netherite_block", "ancient_debris",
  "respawn_anchor",
  // command / structure / technical
  "command_block", "repeating_command_block", "chain_command_block", "structure_block",
  "structure_void", "jigsaw", "light_block", "border_block", "allow", "deny", "camera",
  "moving_block", "piston_arm_collision", "sticky_piston_arm_collision", "unknown", "reserved6",
  "info_update", "info_update2", "client_request_placeholder_block",
  // portals and the End
  "portal", "end_portal", "end_portal_frame", "end_gateway",
  // spawners
  "mob_spawner", "trial_spawner", "vault",
  // containers and block entities that store items
  "chest", "trapped_chest", "ender_chest", "barrel", "hopper", "dropper", "dispenser", "crafter",
  "furnace", "lit_furnace", "blast_furnace", "lit_blast_furnace", "smoker", "lit_smoker",
  "brewing_stand", "chiseled_bookshelf", "decorated_pot", "jukebox", "lectern", "undyed_shulker_box",
];
export const DENIED_BLOCK_IDS = Object.freeze(DENIED_NAMES.map((name) => "minecraft:" + name));

/** Conservative suffix rules on top of DENIED_BLOCK_IDS (see tools/test_script.mjs output). */
export const DENIED_SUFFIXES = Object.freeze([
  "_command_block", "_shulker_box", "_spawner", "_obsidian", "_bedrock",
]);

const ALLOWED_SET = new Set(ALLOWED_BLOCK_IDS);
const DENIED_SET = new Set(DENIED_BLOCK_IDS);

/**
 * True when the id is on the deny-list (exact id or deny suffix).
 * @param {string} typeId
 * @returns {boolean}
 */
export function isDeniedBlockId(typeId) {
  if (typeof typeId !== "string") return false;
  if (DENIED_SET.has(typeId)) return true;
  for (let i = 0; i < DENIED_SUFFIXES.length; i++) {
    if (typeId.endsWith(DENIED_SUFFIXES[i])) return true;
  }
  return false;
}

/**
 * True when SCP-096 may remove a block of this type. The deny-list is evaluated first.
 * @param {unknown} typeId
 * @returns {boolean}
 */
export function isBreakableBlockId(typeId) {
  if (typeof typeId !== "string") return false;
  if (isDeniedBlockId(typeId)) return false;
  return ALLOWED_SET.has(typeId);
}

// ---------------------------------------------------------------------------------------
// Error handling helpers
// ---------------------------------------------------------------------------------------

/** Kinds that already produced their single console.warn. */
const warnedKinds = new Set();

/**
 * @param {unknown} err
 * @returns {string}
 */
function describeError(err) {
  if (err !== null && typeof err === "object") {
    const e = /** @type {{ name?: unknown, message?: unknown, constructor?: { name?: unknown } }} */ (
      err
    );
    const ctor = e.constructor && typeof e.constructor.name === "string" ? e.constructor.name : "";
    return `${String(e.name)}/${ctor}: ${String(e.message)}`;
  }
  return String(err);
}

/**
 * Unloaded chunk / out-of-world conditions are normal while a mob runs near the edge of the
 * simulated area, so they are ignored silently. Matching is by text on purpose: it needs no
 * extra imports from the module.
 * @param {unknown} err
 * @returns {boolean}
 */
function isBenignWorldError(err) {
  return /LocationInUnloadedChunk|LocationOutOfWorldBoundaries|unloaded|not loaded|out of (the )?world|outside (of )?(the )?(world|dimension)|height range/i.test(
    describeError(err)
  );
}

/**
 * Logs the first failure of each kind once and stays silent afterwards.
 * @param {string} kind
 * @param {unknown} err
 */
function warnOnce(kind, err) {
  if (warnedKinds.has(kind)) return;
  warnedKinds.add(kind);
  try {
    console.warn(`[SCP-096] ${kind} failed (further failures of this kind are not logged): ${describeError(err)}`);
  } catch (ignored) {
    // logging must never throw
  }
}

/**
 * @param {Entity} entity
 * @returns {boolean}
 */
function isEntityStillValid(entity) {
  try {
    return entity.isValid();
  } catch (ignored) {
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// Probe box
// ---------------------------------------------------------------------------------------

/**
 * All block positions of the probe box for an entity at `origin` looking along `view`,
 * nearest first (then centre lane first, then lowest first). Returns null when the heading
 * cannot be determined (view straight up/down, zero, NaN) so that the caller skips the entity.
 * @param {Vector3} origin feet position of the entity
 * @param {Vector3} view view direction of the entity
 * @returns {ProbeCell[] | null}
 */
export function computeProbeCells(origin, view) {
  if (!origin || !view) return null;
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) {
    return null;
  }
  const length = Math.hypot(view.x, view.z);
  if (!Number.isFinite(length) || !(length >= PROBE.minHorizontalView)) return null;

  const ux = view.x / length;
  const uz = view.z / length;
  // Horizontal unit vector perpendicular to the heading.
  const px = -uz;
  const pz = ux;

  const baseX = Math.floor(origin.x);
  const baseY = Math.floor(origin.y + PROBE.feetEpsilon);
  const baseZ = Math.floor(origin.z);
  const reach = Math.ceil(Math.hypot(PROBE.maxForward, PROBE.halfWidth)) + 1;

  /** @type {ProbeCell[]} */
  const cells = [];
  for (let cx = baseX - reach; cx <= baseX + reach; cx++) {
    for (let cz = baseZ - reach; cz <= baseZ + reach; cz++) {
      const rx = cx + 0.5 - origin.x;
      const rz = cz + 0.5 - origin.z;
      const forward = rx * ux + rz * uz;
      const lateral = rx * px + rz * pz;
      if (!(forward > PROBE.minForward && forward <= PROBE.maxForward)) continue;
      if (!(lateral >= -PROBE.halfWidth && lateral < PROBE.halfWidth)) continue;
      for (let dy = 0; dy < PROBE.height; dy++) {
        cells.push({ x: cx, y: baseY + dy, z: cz, forward, lateral });
      }
    }
  }
  cells.sort(compareCells);
  return cells;
}

/**
 * @param {ProbeCell} a
 * @param {ProbeCell} b
 * @returns {number}
 */
function compareCells(a, b) {
  return (
    a.forward - b.forward ||
    Math.abs(a.lateral) - Math.abs(b.lateral) ||
    a.y - b.y ||
    a.x - b.x ||
    a.z - b.z
  );
}

// ---------------------------------------------------------------------------------------
// World access (each helper swallows and classifies its own errors)
// ---------------------------------------------------------------------------------------

/**
 * `mobGriefing` is only treated as "off" when the game exposes the rule AND it is exactly
 * false. `World.gameRules` is Beta-only on some 1.21.0 builds; when it is absent the rule
 * cannot be read and block clearing stays on.
 * @returns {boolean}
 */
function mobGriefingAllowed() {
  try {
    const rules = world.gameRules;
    if (rules === undefined || rules === null) return true;
    return rules.mobGriefing !== false;
  } catch (ignored) {
    return true;
  }
}

/**
 * @param {string} dimensionId
 * @returns {Dimension | undefined}
 */
function getDimensionSafe(dimensionId) {
  try {
    return world.getDimension(dimensionId);
  } catch (err) {
    warnOnce("dimension", err);
    return undefined;
  }
}

/**
 * @param {Dimension} dimension
 * @returns {Entity[]}
 */
function querySCP096(dimension) {
  try {
    return dimension.getEntities({ type: ENTITY_TYPE_ID });
  } catch (err) {
    warnOnce("entity-query", err);
    return [];
  }
}

/**
 * True for a valid SCP-096 whose variant is the rage-run state.
 * @param {Entity} entity
 * @returns {boolean}
 */
function isRagingRunner(entity) {
  try {
    if (!entity.isValid()) return false;
    const variant = /** @type {EntityVariantComponent | undefined} */ (
      entity.getComponent(VARIANT_COMPONENT_ID)
    );
    return variant !== undefined && variant.value === RAGE_RUN_VARIANT;
  } catch (err) {
    if (isEntityStillValid(entity)) warnOnce("entity-state", err);
    return false;
  }
}

/**
 * @param {Dimension} dimension
 * @param {ProbeCell} cell
 * @returns {Block | undefined}
 */
function getBlockSafe(dimension, cell) {
  try {
    return dimension.getBlock({ x: cell.x, y: cell.y, z: cell.z });
  } catch (err) {
    if (!isBenignWorldError(err)) warnOnce("get-block", err);
    return undefined;
  }
}

/**
 * Block type id. Uses `Block.typeId` when the game exposes it; otherwise falls back to the
 * id of the item the block drops/picks (`Block.getItemStack().typeId`, stable), which equals
 * the block id for every id in ALLOWED_BLOCK_IDS except double slabs and signs (those are
 * then simply left alone). Air and liquids are skipped without further calls.
 * @param {Block} block
 * @returns {string | undefined}
 */
function getTypeIdSafe(block) {
  try {
    const direct = /** @type {unknown} */ (block.typeId);
    if (typeof direct === "string") return direct;
    if (block.isAir || block.isLiquid) return undefined;
    const stack = block.getItemStack(1, false);
    return stack === undefined ? undefined : stack.typeId;
  } catch (err) {
    if (!isBenignWorldError(err)) warnOnce("block-type", err);
    return undefined;
  }
}

/**
 * Removes one block. `setblock ... air destroy` behaves like breaking the block: the loot
 * table drops (respecting doTileDrops), break particles and sound, neighbour updates (so the
 * other half of a door, signs and ladders attached to it drop correctly). If the command is
 * unavailable or reports no success, the block is replaced silently with `Block.setType`.
 * @param {Dimension} dimension
 * @param {Block} block
 * @param {ProbeCell} cell
 * @returns {boolean} true when the block was removed
 */
function destroyBlock(dimension, block, cell) {
  try {
    const result = dimension.runCommand(`setblock ${cell.x} ${cell.y} ${cell.z} air destroy`);
    if (result && result.successCount > 0) return true;
  } catch (err) {
    if (!isBenignWorldError(err)) warnOnce("setblock-command", err);
  }
  try {
    if (typeof block.setType !== "function") return false;
    block.setType(AIR_ID);
    return true;
  } catch (err) {
    if (!isBenignWorldError(err)) warnOnce("set-type", err);
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// One pass
// ---------------------------------------------------------------------------------------

/**
 * Clears soft blocks in front of one raging entity.
 * @param {Dimension} dimension dimension the entity was found in
 * @param {Entity} entity
 * @param {number} maxBreaks
 * @returns {number} number of blocks removed
 */
function clearAhead(dimension, entity, maxBreaks) {
  /** @type {ProbeCell[] | null} */
  let cells;
  try {
    cells = computeProbeCells(entity.location, entity.getViewDirection());
  } catch (err) {
    if (isEntityStillValid(entity)) warnOnce("entity-heading", err);
    return 0;
  }
  if (cells === null) return 0;

  let broken = 0;
  for (let i = 0; i < cells.length && broken < maxBreaks; i++) {
    const cell = cells[i];
    const block = getBlockSafe(dimension, cell);
    if (block === undefined) continue;
    if (!isBreakableBlockId(getTypeIdSafe(block))) continue;
    if (destroyBlock(dimension, block, cell)) broken++;
  }
  return broken;
}

let passCounter = 0;

/** Interval callback. Never throws. */
export function runPass() {
  try {
    passCounter++;
    if (!mobGriefingAllowed()) return;

    let breakBudget = LIMITS.maxBreaksPerPass;
    let entityBudget = LIMITS.maxRagingEntitiesPerPass;
    for (let d = 0; d < DIMENSION_IDS.length; d++) {
      if (breakBudget <= 0 || entityBudget <= 0) break;
      const dimension = getDimensionSafe(DIMENSION_IDS[d]);
      if (dimension === undefined) continue;

      const entities = querySCP096(dimension);
      const total = entities.length;
      const examine = Math.min(total, LIMITS.maxEntitiesExaminedPerDimension);
      // Rotate the window over the whole list so that no entity starves when a cap is hit.
      const start = total > 0 ? passCounter % total : 0;
      for (let i = 0; i < examine && breakBudget > 0 && entityBudget > 0; i++) {
        const entity = entities[(start + i) % total];
        if (!isRagingRunner(entity)) continue;
        entityBudget--;
        breakBudget -= clearAhead(
          dimension,
          entity,
          Math.min(LIMITS.maxBreaksPerEntity, breakBudget)
        );
      }
    }
  } catch (err) {
    warnOnce("pass", err);
  }
}

system.runInterval(runPass, PASS_INTERVAL_TICKS);
