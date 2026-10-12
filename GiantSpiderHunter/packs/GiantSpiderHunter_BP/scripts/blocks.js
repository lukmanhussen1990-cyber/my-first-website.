// Block classification and bounded column scans.
//
// @minecraft/server 1.10.0 has no Block.typeId and no BlockPermutation.type, so the block id is
// read with Block.getItemStack(1, false).typeId (verified on BDS 1.21.0.26: logs, leaves, plants
// and ground blocks all report their own id; air/liquids/fire have no item). Liquids use
// Block.isLiquid and BlockPermutation.matches() for lava. Results are cached per id.

export const C_AIR = 0; // air
export const C_SOLID = 1; // ground capable
export const C_WATER = 2; // non-lava liquid (surface allowed for legs, never a spawn spot)
export const C_LAVA = 3;
export const C_LEAVES = 4;
export const C_WOOD = 5; // logs, wood, stems, hyphae, huge mushroom blocks, mangrove roots
export const C_PLANT = 6; // non-solid vegetation, vines, carpets, snow layers, torches...
export const C_HAZARD_SOLID = 7; // magma, cactus, campfires, dripstone (standable but never a spawn spot)
export const C_HAZARD_SOFT = 8; // fire, powder snow, cobweb, berry bush, wither rose, unknown item-less blocks

export const CATEGORY_NAMES = ['air', 'solid', 'water', 'lava', 'leaves', 'wood', 'plant', 'hazard_solid', 'hazard_soft'];

const RE_LEAVES = /(_leaves|leaves_flowered|^leaves2?)$/;
const RE_WOOD = /(_log|^log2?|_wood|^wood|_stem|_hyphae|^mangrove_roots|mushroom_block|^mushroom_stem)$/;
const RE_HAZARD_SOLID = /^(magma|cactus|campfire|soul_campfire|pointed_dripstone)$/;
const RE_HAZARD_SOFT = /^(powder_snow_bucket|web|sweet_berries|wither_rose|fire|soul_fire)$/;
const RE_PLANT = new RegExp(
  '(sapling|^short_grass|^tall_grass|^grass|fern|^deadbush|^dead_bush|flower|^poppy|^dandelion|tulip|orchid|' +
    '^allium|^azure_bluet|^oxeye_daisy|^cornflower|^lily_of_the_valley|^torchflower|^pitcher_plant|^pitcher_pod|' +
    '^sunflower|^lilac|^rose_bush|^peony|^sugar_cane|^reeds|^bamboo|_mushroom|fungus|^seagrass|^kelp|vine|vines|' +
    'lichen|carpet|^snow_layer|petals|^azalea|^flowering_azalea|^hanging_roots|^spore_blossom|dripleaf|' +
    '^crimson_roots|^warped_roots|^nether_sprouts|_seeds|^carrot|^potato|^beetroot|^cocoa_beans|^nether_wart|' +
    '^glow_berries|torch|^lever|_button|^rail|_rail|^ladder|^waterlily|^lily_pad|^sea_pickle|^frog_spawn|' +
    '^string|^tripwire_hook|^redstone|^lantern|^soul_lantern|_sign|^banner|_pressure_plate)$'
);

const idCache = new Map();

/** Category for a block/item identifier (pure; cached). */
export function categoryForId(id) {
  if (!id) return C_HAZARD_SOFT;
  let c = idCache.get(id);
  if (c !== undefined) return c;
  const short = id.startsWith('minecraft:') ? id.slice(10) : id;
  if (short === 'air') c = C_AIR;
  else if (RE_LEAVES.test(short)) c = C_LEAVES;
  else if (RE_WOOD.test(short)) c = C_WOOD;
  else if (RE_HAZARD_SOLID.test(short)) c = C_HAZARD_SOLID;
  else if (RE_HAZARD_SOFT.test(short)) c = C_HAZARD_SOFT;
  else if (RE_PLANT.test(short)) c = C_PLANT;
  else c = C_SOLID;
  if (idCache.size > 2048) idCache.clear();
  idCache.set(id, c);
  return c;
}

/** Category of a Block object. Never throws. */
export function classifyBlock(block) {
  try {
    if (block.isAir) return C_AIR;
    if (block.isLiquid) {
      const p = block.permutation;
      return p.matches('minecraft:lava') || p.matches('minecraft:flowing_lava') ? C_LAVA : C_WATER;
    }
    const item = block.getItemStack(1, false);
    return categoryForId(item ? item.typeId : undefined);
  } catch (e) {
    return C_HAZARD_SOFT;
  }
}

/** Categories a leg passes through on its way to the real ground. */
export function isLegPassThrough(c) {
  return c === C_AIR || c === C_LEAVES || c === C_WOOD || c === C_PLANT || c === C_HAZARD_SOFT;
}

/** Categories that count as free headroom for a spawn spot. */
export function isHeadroom(c) {
  return c === C_AIR || c === C_PLANT;
}

const heightCache = new Map();

/** [minY, maxY] of a dimension (maxY inclusive). */
export function heightRange(dim) {
  let r = heightCache.get(dim.id);
  if (!r) {
    try {
      const hr = dim.heightRange;
      r = [hr.min, hr.max - 1];
    } catch (e) {
      r = dim.id === 'minecraft:overworld' ? [-64, 319] : [0, 255];
    }
    heightCache.set(dim.id, r);
  }
  return r;
}

/** dimension.getBlock that never throws (undefined = unloaded or out of the world). */
export function getBlockSafe(dim, x, y, z) {
  try {
    return dim.getBlock({ x, y, z });
  } catch (e) {
    return undefined;
  }
}

/**
 * Leg ground height: scan a column top-down, skipping air/leaves/logs/plants. Liquids and solid
 * blocks are surfaces. Returns {top} (block-top y), {unloaded: true} or {exhausted: true}.
 * `budget` is {n} and is decremented per getBlock.
 */
export function legGroundTop(dim, x, z, yTop, yBottom, budget) {
  const [lo, hi] = heightRange(dim);
  const top = Math.min(yTop, hi);
  const bottom = Math.max(yBottom, lo);
  for (let y = top; y >= bottom; y--) {
    if (budget.n <= 0) return { exhausted: true };
    budget.n--;
    const b = getBlockSafe(dim, x, y, z);
    if (!b) return { unloaded: true };
    if (isLegPassThrough(classifyBlock(b))) continue;
    return { top: y + 1 };
  }
  return { top: bottom };
}

/**
 * Surface spot scan for spawning / relocating. The top of the window must be open (not inside
 * terrain); descends through air, plants, leaves and logs to the first ground block. Ground must
 * be solid (not liquid/hazard) with `headroom` free blocks (air/plants) above it.
 * Returns {ok, reason, groundY, forest}.
 */
export function surfaceSpot(dim, x, z, yTop, yBottom, headroom, budget) {
  const [lo, hi] = heightRange(dim);
  const top = Math.min(yTop, hi);
  const bottom = Math.max(yBottom, lo);
  let forest = false;
  let free = 0; // consecutive headroom blocks directly above the current y
  for (let y = top; y >= bottom; y--) {
    if (budget.n <= 0) return { ok: false, reason: 'budget' };
    budget.n--;
    const b = getBlockSafe(dim, x, y, z);
    if (!b) return { ok: false, reason: 'unloaded' };
    const c = classifyBlock(b);
    if (c === C_LEAVES || c === C_WOOD) forest = true;
    if (y === top && (c === C_SOLID || c === C_HAZARD_SOLID || c === C_WATER || c === C_LAVA)) {
      return { ok: false, reason: 'covered', forest };
    }
    if (isHeadroom(c)) {
      free++;
      continue;
    }
    if (c === C_LEAVES || c === C_WOOD || c === C_HAZARD_SOFT) {
      free = 0;
      continue;
    }
    if (c !== C_SOLID) return { ok: false, reason: c === C_WATER || c === C_LAVA ? 'liquid' : 'hazard', forest };
    if (free < headroom) {
      // Not enough scanned blocks above (ground near the window top): check the rest directly.
      if (y + free === top) {
        for (let k = free + 1; k <= headroom; k++) {
          if (budget.n <= 0) return { ok: false, reason: 'budget' };
          budget.n--;
          const a = getBlockSafe(dim, x, y + k, z);
          if (!a) return { ok: false, reason: 'unloaded' };
          if (!isHeadroom(classifyBlock(a))) return { ok: false, reason: 'headroom', forest };
        }
        return { ok: true, groundY: y, forest };
      }
      return { ok: false, reason: 'headroom', forest };
    }
    return { ok: true, groundY: y, forest };
  }
  return { ok: false, reason: 'noground', forest };
}

/** True when the four horizontal neighbours at y are loaded (getBlock defined). */
export function neighboursLoaded(dim, x, y, z, budget) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    budget.n--;
    if (!getBlockSafe(dim, x + dx, y, z + dz)) return false;
  }
  return true;
}

/** True when a log/wood block is within `radius` blocks (straight lines) at height y. */
export function woodNearby(dim, x, y, z, radius, budget) {
  for (let d = 1; d <= radius; d++) {
    for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      if (budget.n <= 0) return false;
      budget.n--;
      const b = getBlockSafe(dim, x + dx, y, z + dz);
      if (b && classifyBlock(b) === C_WOOD) return true;
    }
  }
  return false;
}

/**
 * Line of sight between two points: no collidable, non-liquid block in between.
 * Leaves block the view. Returns false when the ray cannot be evaluated.
 */
export function lineOfSight(dim, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1) return true;
  try {
    const hit = dim.getBlockFromRay(from, { x: dx / len, y: dy / len, z: dz / len }, {
      maxDistance: Math.ceil(len),
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
    if (!hit) return true;
    const bl = hit.block.location;
    const f = hit.faceLocation;
    const hx = bl.x + f.x - from.x;
    const hy = bl.y + f.y - from.y;
    const hz = bl.z + f.z - from.z;
    return Math.sqrt(hx * hx + hy * hy + hz * hz) >= len - 0.75;
  } catch (e) {
    return false;
  }
}

/** Height of a point above the first collidable block below it (up to maxDown). */
export function heightAboveGround(dim, loc, maxDown) {
  try {
    const hit = dim.getBlockFromRay(loc, { x: 0, y: -1, z: 0 }, {
      maxDistance: Math.ceil(maxDown),
      includeLiquidBlocks: true,
      includePassableBlocks: false,
    });
    if (!hit) return maxDown + 1;
    return loc.y - (hit.block.location.y + hit.faceLocation.y);
  } catch (e) {
    return 0;
  }
}
