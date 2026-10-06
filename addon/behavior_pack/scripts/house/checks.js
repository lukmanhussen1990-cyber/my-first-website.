// @ts-check
// Site checks for the Luxury Base (SPEC §6): block classification, the structure's
// write mask, and the space/support scan that is spread over several ticks.
//
// Rules (docs/LUXURY_BASE.md):
//  * Cells the structure WRITES (every non-void structure cell, including its air cells)
//    must be air or natural replaceable vegetation (REPLACEABLE).
//  * Structure-void cells (192 cells at the top of the roof, y 12 inside the parapet) keep
//    the world block, so anything solid may stay there - but no liquid anywhere in the box.
//  * At least HOUSE.supportRatio of the footprint cells directly below local y 0 must be
//    solid ground (isSupporting).
//  * Every cell must be loaded; any unreadable cell blocks with "area not fully loaded".
// Block names are the 1.21.0.26 names from metadata/vanilladata_modules/mojang-blocks.json
// (flowers are flattened: poppy, allium, ...; dandelion is still "yellow_flower").

import { world } from "@minecraft/server";
import { logError } from "../lib/util.js";
import { HOUSE } from "./blueprint_meta.js";
import { toWorld, WAIT } from "./rotation.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("./rotation.js").Placement} Placement */
/** @typedef {import("./rotation.js").Vec3i} Vec3i */

/** Max Dimension.getBlock calls per game tick for all house work together (mobile-friendly). */
export const SCAN_BUDGET_PER_TICK = 600;
/** Structure cells read per tick while building the write mask (memory reads, no world access). */
const MASK_READS_PER_TICK = 1500;

const AIR = "minecraft:air";

/**
 * Natural, replaceable vegetation and invisible blocks that may be inside the build box;
 * they are simply overwritten by the house. `light_block` is included because the Tactical
 * Torchlight puts invisible light blocks exactly where the player aims.
 */
export const REPLACEABLE = new Set([
  "minecraft:air",
  "minecraft:light_block",
  "minecraft:structure_void",
  // grasses and ferns
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:deadbush",
  // small flowers
  "minecraft:yellow_flower",
  "minecraft:poppy",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:torchflower",
  "minecraft:pink_petals",
  // tall flowers
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:pitcher_plant",
  // snow, vines, lichen
  "minecraft:snow_layer",
  "minecraft:vine",
  "minecraft:glow_lichen",
  "minecraft:cave_vines",
  "minecraft:cave_vines_body_with_berries",
  "minecraft:cave_vines_head_with_berries",
  "minecraft:weeping_vines",
  "minecraft:twisting_vines",
  "minecraft:hanging_roots",
  "minecraft:spore_blossom",
  // mushrooms, fungi, nether plants
  "minecraft:brown_mushroom",
  "minecraft:red_mushroom",
  "minecraft:crimson_fungus",
  "minecraft:warped_fungus",
  "minecraft:crimson_roots",
  "minecraft:warped_roots",
  "minecraft:nether_sprouts",
]);

/**
 * Liquids and blocks that only exist in water (they would leave water in the house).
 * Any of these anywhere in the box blocks the build.
 */
export const LIQUIDS = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:bubble_column",
  "minecraft:seagrass",
  "minecraft:kelp",
]);

/**
 * Blocks that do not count as solid ground under the footprint (besides air, liquids and
 * REPLACEABLE): thin or collision-less blocks that sit on top of the real ground.
 */
const NON_SUPPORT_RE =
  /^minecraft:(.*torch|.*_rail|rail|.*_button|lever|.*_pressure_plate|.*standing_sign|.*wall_sign|.*_hanging_sign|standing_banner|wall_banner|.*_carpet|moss_carpet|.*sapling|wheat|carrots|potatoes|beetroot|melon_stem|pumpkin_stem|torchflower_crop|pitcher_crop|sweet_berry_bush|reeds|web|fire|soul_fire|ladder|redstone_wire|trip_wire|tripwire_hook|waterlily|frog_spawn|sculk_vein|.*coral_fan|.*coral_wall_fan|azalea|flowering_azalea|wither_rose|flower_pot)$/;

/** @param {string} typeId @returns {boolean} */
export function isReplaceable(typeId) {
  return REPLACEABLE.has(typeId);
}

/** @param {string} typeId @returns {boolean} */
export function isLiquidType(typeId) {
  return LIQUIDS.has(typeId);
}

/**
 * Whether a block counts as solid ground under the house.
 * @param {string} typeId
 * @returns {boolean}
 */
export function isSupporting(typeId) {
  if (typeId === AIR || REPLACEABLE.has(typeId) || LIQUIDS.has(typeId)) return false;
  return !NON_SUPPORT_RE.test(typeId);
}

/** "minecraft:oak_log" -> "oak_log". @param {string} typeId @returns {string} */
export function shortName(typeId) {
  return typeId.startsWith("minecraft:") ? typeId.slice("minecraft:".length) : typeId;
}

/**
 * Read one cell. `typeId` is undefined when the cell cannot be read (unloaded chunk,
 * LocationInUnloadedChunkError, invalid block). Never throws.
 * @param {Dimension} dim
 * @param {Vec3i} p
 * @returns {string | undefined}
 */
export function readType(dim, p) {
  try {
    const b = dim.getBlock(p);
    if (!b) return undefined;
    return b.typeId;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Write mask: which structure cells the placement actually writes
// ---------------------------------------------------------------------------

/**
 * @typedef {object} StructureInfo
 * @property {Uint8Array | undefined} mask 1 = the structure writes this local cell; undefined = unknown (treat all as written)
 * @property {Map<string, string>} types typeId of a few key local cells ("x,y,z" -> typeId) used to verify the build
 * @property {number} written number of written cells (diagnostics)
 */

/** @type {StructureInfo | undefined} */
let structureInfo;

/** Local index of a structure cell (same order as .mcstructure: z fastest, then y, then x). */
/** @param {Vec3i} size @param {number} x @param {number} y @param {number} z @returns {number} */
export function localIndex(size, x, y, z) {
  return (x * size.y + y) * size.z + z;
}

/** Forget the cached structure info (tests). */
export function resetStructureInfo() {
  structureInfo = undefined;
}

/** @returns {StructureInfo | undefined} */
export function getStructureInfo() {
  return structureInfo;
}

/**
 * Local cells that are checked after the build: both halves of the two front-door leaves
 * (the cells right behind the entrance cell) plus the foundation under the entrance.
 * @param {typeof HOUSE} [house]
 * @returns {Vec3i[]}
 */
export function keyCells(house = HOUSE) {
  const e = house.entrance;
  const doorZ = e.z - 1;
  return [
    { x: e.x, y: house.floorY, z: doorZ },
    { x: e.x, y: house.floorY + 1, z: doorZ },
    { x: e.x - 1, y: house.floorY, z: doorZ },
    { x: e.x - 1, y: house.floorY + 1, z: doorZ },
    { x: e.x, y: 0, z: e.z },
  ];
}

/**
 * Read the house structure once per session: its write mask (non-void cells) and the block
 * types of the key cells. Spread over ticks (memory reads only). If the structure cannot be
 * read here, the mask stays undefined and the scan treats every box cell as written (strict).
 * @param {typeof HOUSE} [house]
 * @returns {Generator<number, StructureInfo, void>}
 */
export function* loadStructureInfo(house = HOUSE) {
  if (structureInfo) return structureInfo;
  /** @type {StructureInfo} */
  const info = { mask: undefined, types: new Map(), written: 0 };
  /** @type {import("@minecraft/server").Structure | undefined} */
  let s;
  try {
    s = world.structureManager.get(house.structureId);
  } catch (e) {
    logError("house.structureInfo.get", e);
  }
  if (!s) {
    structureInfo = info;
    return info;
  }
  const size = house.size;
  const mask = new Uint8Array(size.x * size.y * size.z);
  let reads = 0;
  try {
    for (let x = 0; x < size.x; x++)
      for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++) {
          if (++reads % MASK_READS_PER_TICK === 0) yield WAIT;
          const perm = s.getBlockPermutation({ x, y, z });
          if (perm && perm.type.id !== "minecraft:structure_void") {
            mask[localIndex(size, x, y, z)] = 1;
            info.written++;
          }
        }
    for (const c of keyCells(house)) {
      const perm = s.getBlockPermutation(c);
      if (perm) info.types.set(`${c.x},${c.y},${c.z}`, perm.type.id);
    }
    info.mask = mask;
  } catch (e) {
    logError("house.structureInfo.read", e);
    info.mask = undefined;
    info.written = 0;
  }
  structureInfo = info;
  return info;
}

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ScanBlocked
 * @property {false} ok
 * @property {"unloaded" | "liquid" | "obstruction" | "support"} reason
 * @property {Vec3i} at first blocking cell
 * @property {string | undefined} typeId block found there (undefined when unloaded)
 * @property {number} [solidRatio] support: fraction of solid footprint cells
 */
/**
 * @typedef {object} ScanOk
 * @property {true} ok
 * @property {Set<string>} nonAir "x,y,z" of every non-air world cell inside the box
 * @property {number} solidRatio
 * @property {number} reads getBlock calls made
 */
/** @typedef {ScanBlocked | ScanOk} ScanResult */

/** @param {Vec3i} p @returns {string} */
export function cellKey(p) {
  return `${p.x},${p.y},${p.z}`;
}

/**
 * Check the rotated build box and the ground below it. Generator for the placement job
 * runner: it yields 1 before every Dimension.getBlock call (the runner grants at most
 * SCAN_BUDGET_PER_TICK per tick) and returns the result.
 * Order: box layers bottom-up, each layer from the front row (player side) to the back,
 * then the support row under local y 0. The first blocking cell is reported.
 * @param {Dimension} dim
 * @param {Placement} pl
 * @param {Uint8Array | undefined} mask from loadStructureInfo (undefined = every cell is written)
 * @param {typeof HOUSE} [house]
 * @returns {Generator<number, ScanResult, void>}
 */
export function* scanSite(dim, pl, mask, house = HOUSE) {
  const size = pl.size;
  /** @type {Set<string>} */
  const nonAir = new Set();
  let reads = 0;
  for (let ly = 0; ly < size.y; ly++) {
    for (let lz = size.z - 1; lz >= 0; lz--) {
      for (let lx = 0; lx < size.x; lx++) {
        const w = toWorld(pl, { x: lx, y: ly, z: lz });
        yield 1;
        reads++;
        const t = readType(dim, w);
        if (t === undefined) return { ok: false, reason: "unloaded", at: w, typeId: undefined };
        if (t === AIR) continue;
        if (LIQUIDS.has(t)) return { ok: false, reason: "liquid", at: w, typeId: t };
        const writes = !mask || mask[localIndex(size, lx, ly, lz)] === 1;
        if (writes && !REPLACEABLE.has(t)) return { ok: false, reason: "obstruction", at: w, typeId: t };
        nonAir.add(cellKey(w));
      }
    }
  }
  // ground directly below the foundation
  let solid = 0;
  let total = 0;
  /** @type {{at: Vec3i, typeId: string} | undefined} */
  let firstGap;
  for (let lz = size.z - 1; lz >= 0; lz--) {
    for (let lx = 0; lx < size.x; lx++) {
      const w = toWorld(pl, { x: lx, y: -1, z: lz });
      yield 1;
      reads++;
      const t = readType(dim, w);
      if (t === undefined) return { ok: false, reason: "unloaded", at: w, typeId: undefined };
      total++;
      if (isSupporting(t)) solid++;
      else if (!firstGap) firstGap = { at: w, typeId: t };
    }
  }
  const solidRatio = total ? solid / total : 0;
  if (solidRatio + 1e-9 < house.supportRatio) {
    const gap = firstGap ?? { at: toWorld(pl, { x: 0, y: -1, z: 0 }), typeId: AIR };
    return { ok: false, reason: "support", at: gap.at, typeId: gap.typeId, solidRatio };
  }
  return { ok: true, nonAir, solidRatio, reads };
}
