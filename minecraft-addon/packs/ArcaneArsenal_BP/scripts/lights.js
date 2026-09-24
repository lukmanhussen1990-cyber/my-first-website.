// Realistic torch light: anything bright you hold (or drop) lights up the
// world around it, using invisible light blocks that follow it every tick.
// Real flames flicker, throw embers and smoke, and go out under water.
import { BlockPermutation, world } from "@minecraft/server";
import { FACE_NORMAL, V, alive, handPoint, hitPoint, isSpectator, mainhand, offhand } from "./util.js";
import { particle } from "./fx.js";
import { setting } from "./config.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * @typedef {object} LightSource
 * @property {number} level      light level, same as the placed block in vanilla
 * @property {number} [flicker]  how far a live flame can dip
 * @property {string} [ember]    ember particle thrown by a real flame
 * @property {boolean} [smoke]
 * @property {boolean} [beam]    Radiant Torch flashlight
 */

/** @type {Record<string, LightSource>} */
export const SOURCES = {
  // live flames
  "minecraft:torch": { level: 14, flicker: 1, ember: "arcane:torch_ember", smoke: true },
  "minecraft:soul_torch": { level: 10, flicker: 1, ember: "arcane:soul_ember", smoke: true },
  "minecraft:campfire": { level: 15, flicker: 1, ember: "arcane:torch_ember", smoke: true },
  "minecraft:soul_campfire": { level: 10, flicker: 1, ember: "arcane:soul_ember", smoke: true },
  "minecraft:lantern": { level: 15, flicker: 1 },
  "minecraft:soul_lantern": { level: 10, flicker: 1 },
  "minecraft:lit_pumpkin": { level: 15, flicker: 1 },
  "minecraft:lava_bucket": { level: 15, flicker: 1 },
  "minecraft:fire_charge": { level: 10, flicker: 2, ember: "arcane:torch_ember" },
  "minecraft:blaze_rod": { level: 10, flicker: 1 },
  "minecraft:blaze_powder": { level: 8, flicker: 1 },
  "minecraft:magma": { level: 3 },
  // steady glow
  "minecraft:glowstone": { level: 15 },
  "minecraft:sea_lantern": { level: 15 },
  "minecraft:shroomlight": { level: 15 },
  "minecraft:ochre_froglight": { level: 15 },
  "minecraft:verdant_froglight": { level: 15 },
  "minecraft:pearlescent_froglight": { level: 15 },
  "minecraft:beacon": { level: 15 },
  "minecraft:conduit": { level: 15 },
  "minecraft:end_rod": { level: 14 },
  "minecraft:glow_berries": { level: 12 },
  "minecraft:nether_star": { level: 12 },
  "minecraft:crying_obsidian": { level: 10 },
  "minecraft:glowstone_dust": { level: 8 },
  "minecraft:redstone_torch": { level: 7 },
  "minecraft:glow_lichen": { level: 7 },
  "minecraft:enchanting_table": { level: 7 },
  "minecraft:ender_chest": { level: 7 },
  "minecraft:glow_ink_sac": { level: 6 },
  "minecraft:sea_pickle": { level: 6 },
  "minecraft:sculk_catalyst": { level: 6 },
  "minecraft:amethyst_cluster": { level: 5 },
  // Arcane Arsenal
  "arcane:radiant_torch": { level: 15, flicker: 1, ember: "arcane:radiant_ember", beam: true },
  "arcane:celestial_godslayer": { level: 15 },
  "arcane:inferno_sword": { level: 12, flicker: 1 },
  "arcane:arcane_staff": { level: 10 },
  "arcane:storm_hammer": { level: 7 },
  "arcane:frostbite_blade": { level: 6 },
};

const SAVE_KEY = "arcane:light_blocks";

/** @typedef {{ dim: string, x: number, y: number, z: number, level: number }} Light */
/** Lights we currently own. @type {Map<string, Light>} */
const placed = new Map();
/** Lights left in unloaded chunks (or from a previous session) waiting for removal. @type {Map<string, Light>} */
const stale = new Map();
/** @type {Map<string, { timer: number, drop: number }>} */
const flickerState = new Map();
/** @type {{ entity: Entity, source: LightSource }[]} */
let dropped = [];
let dirty = false;
let loaded = false;
let active = true;

/** @param {string} dim @param {number} x @param {number} y @param {number} z */
const keyOf = (dim, x, y, z) => `${dim}|${x}|${y}|${z}`;

/** @type {Map<string, Dimension>} */
const dims = new Map();
/** @param {string} id */
function dimension(id) {
  let d = dims.get(id);
  if (!d) {
    try {
      d = world.getDimension(id);
    } catch {
      return undefined;
    }
    dims.set(id, d);
  }
  return d;
}

/** @type {Map<number, BlockPermutation | undefined>} */
const lightPerms = new Map();
/** Light block permutation; handles both the 1.21.0 id and the later flattened ids. @param {number} level */
function lightPerm(level) {
  if (lightPerms.has(level)) return lightPerms.get(level);
  let perm;
  try {
    perm = BlockPermutation.resolve("minecraft:light_block", { block_light_level: level });
  } catch {
    perm = undefined;
  }
  if (!perm) {
    try {
      perm = BlockPermutation.resolve(`minecraft:light_block_${level}`);
    } catch {
      perm = undefined;
    }
  }
  lightPerms.set(level, perm);
  return perm;
}

/** @type {BlockPermutation | undefined} */
let airPerm;
function air() {
  airPerm = airPerm || BlockPermutation.resolve("minecraft:air");
  return airPerm;
}

/** @type {string[] | undefined} */
let lightIds;
/** Light block ids that exist in this game version (1.21.0: one id with a level state; later: light_block_0..15). */
function knownLightIds() {
  if (!lightIds) {
    lightIds = [];
    const ids = ["minecraft:light_block"];
    for (let i = 0; i <= 15; i++) ids.push(`minecraft:light_block_${i}`);
    for (const id of ids) {
      try {
        BlockPermutation.resolve(id);
        lightIds.push(id);
      } catch {
        // not in this version
      }
    }
  }
  return lightIds;
}

/** @param {import("@minecraft/server").Block} block */
function isLightBlock(block) {
  try {
    const perm = block.permutation;
    return knownLightIds().some((id) => perm.matches(id));
  } catch {
    return false;
  }
}

/** @param {Dimension} dim @param {Vector3} pos */
function getBlock(dim, pos) {
  try {
    return dim.getBlock(pos);
  } catch {
    return undefined;
  }
}

/** Air, or a light block we placed ourselves (never touch other light blocks). @param {Dimension} dim @param {Vector3} pos */
function canHost(dim, pos) {
  const b = getBlock(dim, pos);
  if (!b) return false;
  if (b.isAir) return true;
  if (!isLightBlock(b)) return false;
  const k = keyOf(dim.id, pos.x, pos.y, pos.z);
  return placed.has(k) || stale.has(k);
}

/** @param {Map<string, Light>} desired @param {string} dim @param {Vector3} pos @param {number} level */
function want(desired, dim, pos, level) {
  const k = keyOf(dim, pos.x, pos.y, pos.z);
  const cur = desired.get(k);
  if (!cur || cur.level < level) desired.set(k, { dim, x: pos.x, y: pos.y, z: pos.z, level });
}

/** A live flame dips by a level now and then, like a real torch. @param {string} id @param {number} amp */
function flicker(id, amp) {
  let f = flickerState.get(id);
  if (!f) {
    f = { timer: 0, drop: 0 };
    flickerState.set(id, f);
  }
  if (--f.timer <= 0) {
    const r = Math.random();
    f.drop = r < 0.74 ? 0 : r < 0.96 || amp < 2 ? 1 : 2;
    f.timer = f.drop ? 2 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 8);
  }
  return Math.min(f.drop, amp);
}

/** @param {Vector3} p @param {number} amount */
function jitter(p, amount) {
  return {
    x: p.x + (Math.random() - 0.5) * amount,
    y: p.y + (Math.random() - 0.5) * amount,
    z: p.z + (Math.random() - 0.5) * amount,
  };
}

/** @param {Player} player */
function beamEnabled(player) {
  try {
    return player.getDynamicProperty("arcane:beam") !== false;
  } catch {
    return true;
  }
}

/** Radiant Torch: light the spot you look at, like a flashlight. @param {Player} player @param {Dimension} dim @param {Map<string, Light>} desired */
function beam(player, dim, desired) {
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: 40, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    return;
  }
  if (!hit) return;
  const eye = player.getHeadLocation();
  const p = hitPoint(hit);
  const dist = V.dist(eye, p);
  // Only light far spots: within building reach the hand light is enough, and
  // a light block there would sit exactly where you're placing blocks.
  if (dist < 7) return;
  const dir = V.norm(V.sub(p, eye));
  const n = FACE_NORMAL[hit.face] || FACE_NORMAL.Up;
  const spots = [V.add(hit.block.location, n)];
  for (const back of [0.6, 1.4, 2.2]) spots.push(V.floor(V.sub(p, V.scale(dir, back))));
  for (const s of spots) {
    if (canHost(dim, s)) {
      want(desired, dim.id, s, 15);
      break;
    }
  }
  if (dist > 14) {
    const mid = V.floor(V.add(eye, V.scale(dir, dist * 0.5)));
    if (canHost(dim, mid)) want(desired, dim.id, mid, 11);
  }
}

/** @param {Player} player @param {number} tick @param {Map<string, Light>} desired */
function playerLights(player, tick, desired) {
  if (isSpectator(player)) return;
  const main = mainhand(player);
  const off = offhand(player);
  const sm = main ? SOURCES[main.typeId] : undefined;
  const so = off ? SOURCES[off.typeId] : undefined;
  let src = sm;
  let side = 1;
  if (so && (!sm || so.level > sm.level)) {
    src = so;
    side = -1;
  }
  if (!src) {
    flickerState.delete(player.id);
    return;
  }
  const dim = player.dimension;
  const head = V.floor(player.getHeadLocation());
  const headBlock = getBlock(dim, head);
  if (!headBlock || headBlock.isLiquid) return; // a torch goes out under water
  let level = src.level;
  if (src.flicker && setting("flicker")) level = Math.max(1, level - flicker(player.id, src.flicker));
  for (const dy of [0, -1, 1]) {
    const pos = { x: head.x, y: head.y + dy, z: head.z };
    if (canHost(dim, pos)) {
      want(desired, dim.id, pos, level);
      break;
    }
  }
  if (((sm && sm.beam) || (so && so.beam)) && beamEnabled(player)) beam(player, dim, desired);
  if (src.ember && setting("particles")) {
    if (tick % 3 === 0) particle(dim, src.ember, jitter(handPoint(player, 0.75, 0.42 * side, 0.18), 0.05));
    if (src.smoke && tick % 16 === 0) particle(dim, "arcane:torch_smoke", handPoint(player, 0.75, 0.42 * side, 0.08));
  }
}

/** Find dropped light items near players. @param {Player[]} players */
function scanDropped(players) {
  dropped = [];
  for (const k of flickerState.keys()) {
    if (k.startsWith("item:")) flickerState.delete(k);
  }
  const seen = new Set();
  for (const p of players) {
    let items = [];
    try {
      items = p.dimension.getEntities({ type: "minecraft:item", location: p.location, maxDistance: 40 });
    } catch {
      items = [];
    }
    for (const e of items) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      let typeId;
      try {
        const comp = /** @type {import("@minecraft/server").EntityItemComponent | undefined} */ (
          /** @type {any} */ (e.getComponent("minecraft:item"))
        );
        typeId = comp && comp.itemStack.typeId;
      } catch {
        typeId = undefined;
      }
      const source = typeId ? SOURCES[typeId] : undefined;
      if (source) dropped.push({ entity: e, source });
      if (dropped.length >= 24) return;
    }
  }
}

/** @param {number} tick @param {Map<string, Light>} desired */
function droppedLights(tick, desired) {
  for (const { entity, source } of dropped) {
    if (!alive(entity)) continue;
    const dim = entity.dimension;
    const pos = V.floor(V.up(entity.location, 0.2));
    const b = getBlock(dim, pos);
    if (!b || b.isLiquid) continue;
    let level = source.level;
    if (source.flicker && setting("flicker")) level = Math.max(1, level - flicker("item:" + entity.id, source.flicker));
    const spot = canHost(dim, pos) ? pos : canHost(dim, V.up(pos, 1)) ? V.up(pos, 1) : undefined;
    if (spot) want(desired, dim.id, spot, level);
    if (source.ember && setting("particles") && tick % 6 === 0) particle(dim, source.ember, V.up(entity.location, 0.35));
  }
}

/** @param {Light} l @param {number} level */
function setLight(l, level) {
  const dim = dimension(l.dim);
  const perm = lightPerm(level);
  if (!dim || !perm) return false;
  const b = getBlock(dim, l);
  if (!b || (!b.isAir && !isLightBlock(b))) return false;
  try {
    b.setPermutation(perm);
    return true;
  } catch {
    return false;
  }
}

/** @param {Light} l @returns {"done" | "unloaded"} */
function removeLight(l) {
  const dim = dimension(l.dim);
  if (!dim) return "done";
  const b = getBlock(dim, l);
  if (!b) return "unloaded";
  if (isLightBlock(b)) {
    try {
      b.setPermutation(air());
    } catch {
      return "unloaded";
    }
  }
  return "done";
}

/** @param {Map<string, Light>} desired */
function apply(desired) {
  for (const [k, l] of placed) {
    const d = desired.get(k);
    if (d) {
      if (d.level !== l.level && setLight(l, d.level)) l.level = d.level;
      continue;
    }
    placed.delete(k);
    dirty = true;
    if (removeLight(l) === "unloaded") stale.set(k, l);
  }
  for (const [k, d] of desired) {
    if (placed.has(k)) continue;
    if (setLight(d, d.level)) {
      placed.set(k, d);
      stale.delete(k);
      dirty = true;
    }
  }
}

/** Forget lights that something else replaced (a placed block, flowing water). */
function verify() {
  for (const [k, l] of placed) {
    const dim = dimension(l.dim);
    const b = dim && getBlock(dim, l);
    if (b && !isLightBlock(b)) {
      placed.delete(k);
      dirty = true;
    }
  }
}

function retryStale() {
  for (const [k, l] of stale) {
    if (placed.has(k)) {
      stale.delete(k);
    } else if (removeLight(l) === "done") {
      stale.delete(k);
      dirty = true;
    }
  }
}

/** Remember our light blocks so a quit/crash never leaves invisible lights behind. */
function save() {
  dirty = false;
  const list = [];
  for (const l of placed.values()) list.push([l.dim, l.x, l.y, l.z]);
  for (const l of stale.values()) list.push([l.dim, l.x, l.y, l.z]);
  try {
    world.setDynamicProperty(SAVE_KEY, JSON.stringify(list.slice(0, 300)));
  } catch {
    // ignore
  }
}

function load() {
  loaded = true;
  let raw;
  try {
    raw = world.getDynamicProperty(SAVE_KEY);
  } catch {
    raw = undefined;
  }
  if (typeof raw !== "string") return;
  try {
    for (const [dim, x, y, z] of JSON.parse(raw)) {
      if (typeof dim === "string" && [x, y, z].every(Number.isFinite)) stale.set(keyOf(dim, x, y, z), { dim, x, y, z, level: 0 });
    }
  } catch {
    // corrupted - ignore
  }
}

/** Remove every light we own (used when the feature is switched off). */
export function clearAllLights() {
  apply(new Map());
  retryStale();
  save();
}

/** Called every tick from main.js. @param {Player[]} players @param {number} tick */
export function tickLights(players, tick) {
  if (!loaded) load();
  if (!setting("lights")) {
    if (active) {
      active = false;
      clearAllLights();
    }
    if (tick % 40 === 0) retryStale();
    return;
  }
  active = true;
  /** @type {Map<string, Light>} */
  const desired = new Map();
  for (const p of players) {
    if (alive(p)) playerLights(p, tick, desired);
  }
  if (tick % 10 === 0) scanDropped(players);
  droppedLights(tick, desired);
  apply(desired);
  if (tick % 20 === 0) verify();
  if (tick % 40 === 0) retryStale();
  if (dirty && tick % 4 === 0) save();
}

/** @param {string} playerId */
export function forgetLightPlayer(playerId) {
  flickerState.delete(playerId);
}

/** For tests / debugging. */
export function lightStats() {
  return { placed: placed.size, stale: stale.size, dropped: dropped.length };
}
