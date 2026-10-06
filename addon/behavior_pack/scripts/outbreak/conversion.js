// @ts-check
// Conversion of a fully incubated mob into its infected form, and the reverse
// (cure) - SPEC §7.
//
// Origin data captured at conversion time (stored as JSON in pas:origin_data):
//   villager_v2      minecraft:variant (profession 0-14), minecraft:mark_variant (biome 0-6), minecraft:skin_id (0-5)
//   villager (v1)    minecraft:variant 0-4 (farmer/librarian/cleric/armorer/butcher type), mapped to the v2 index
//   wandering_trader nothing (infected villager variant 0)
//   cow / mooshroom  infected_cow variant 0 cow, 1 red mooshroom, 2 brown mooshroom
//                    (vanilla mooshroom.json: minecraft:variant 0 = mooshroom_red, 1 = mooshroom_brown)
//   sheep            minecraft:color (0-15) and minecraft:is_sheared
//   all              minecraft:is_baby, nameTag; the rotation is copied directly
//
// Cure (revert) uses vanilla events of this build's behavior pack:
//   villager_v2  minecraft:become_<profession> (note the vanilla spelling "become_sheperd"); nitwit has no
//                such event (left as spawned); baby -> minecraft:entity_born (adds baby + unskilled)
//   villager v1  minecraft:spawn_farmer/_librarian/_cleric/_armorer/_butcher (same v1 variant value)
//   mooshroom    minecraft:become_red_adult (+ minecraft:become_brown); baby: entity_born + become_red/brown
//   cow/pig/chicken/sheep  baby -> minecraft:entity_born, adult -> minecraft:ageable_grow_up
//   sheep        minecraft:on_sheared; colour via EntityColorComponent.value (writable in 1.11.0)
//   villager_v2  mark_variant / skin_id via EntityMarkVariantComponent / EntitySkinIdComponent .value
//                (writable in 1.11.0; written 2 ticks after the spawn so the spawn event's groups do not
//                overwrite them)

import { CONVERSIONS, ENTITIES, EVENTS, PROPS, SOUNDS } from "../lib/ids.js";
import { logError, playSound } from "../lib/util.js";
import { isAlive, HordeBudget } from "./horde.js";
import { S, rt, markDirty, defer } from "./state.js";
import { applySpawnDormancy } from "./dormancy.js";
import { conversionBurst } from "./fx.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector2} Vector2 */

/**
 * @typedef {object} OriginData
 * @property {1} v
 * @property {string} type vanilla type id of the original creature
 * @property {boolean} baby
 * @property {string} [name] nameTag of the original
 * @property {number} [variant] villager_v2 profession index (also v1 mapped)
 * @property {number} [mark] villager_v2 biome
 * @property {number} [skin] villager_v2 skin
 * @property {number} [v1variant] villager v1 minecraft:variant
 * @property {number} [moo] mooshroom minecraft:variant (0 red, 1 brown)
 * @property {number} [color] sheep colour
 * @property {boolean} [sheared] sheep sheared
 */

/** Infected types that have pas:make_baby. */
/** @type {ReadonlySet<string>} */
export const BABY_CAPABLE = new Set([
  ENTITIES.INFECTED_VILLAGER,
  ENTITIES.INFECTED_COW,
  ENTITIES.INFECTED_PIG,
  ENTITIES.INFECTED_SHEEP,
  ENTITIES.INFECTED_CHICKEN,
]);

/** villager v1 minecraft:variant -> villager_v2 profession index. */
export const V1_TO_V2 = Object.freeze([1, 5, 7, 8, 11]);

/** villager_v2 profession index -> vanilla event (index 14 = nitwit has none). */
export const V2_BECOME_EVENTS = Object.freeze([
  "minecraft:become_unskilled",
  "minecraft:become_farmer",
  "minecraft:become_fisherman",
  "minecraft:become_sheperd", // sic: vanilla villager_v2.json spelling
  "minecraft:become_fletcher",
  "minecraft:become_librarian",
  "minecraft:become_cartographer",
  "minecraft:become_cleric",
  "minecraft:become_armorer",
  "minecraft:become_weaponsmith",
  "minecraft:become_toolsmith",
  "minecraft:become_butcher",
  "minecraft:become_leatherworker",
  "minecraft:become_mason",
  undefined, // nitwit
]);

/** villager v1 minecraft:variant -> vanilla spawn event that yields that variant. */
export const V1_SPAWN_EVENTS = Object.freeze([
  "minecraft:spawn_farmer",
  "minecraft:spawn_librarian",
  "minecraft:spawn_cleric",
  "minecraft:spawn_armorer",
  "minecraft:spawn_butcher",
]);

/**
 * @param {number | undefined} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampInt(v, min, max) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Numeric value of a value component (variant, mark_variant, skin_id, color), or undefined.
 * @param {Entity} e
 * @param {string} id
 * @returns {number | undefined}
 */
function compValue(e, id) {
  try {
    const c = /** @type {{value?: unknown} | undefined} */ (/** @type {unknown} */ (e.getComponent(id)));
    return c && typeof c.value === "number" ? c.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Entity} e
 * @param {string} id
 * @returns {boolean}
 */
function hasComp(e, id) {
  try {
    return e.hasComponent(id);
  } catch {
    return false;
  }
}

/**
 * Read everything the cure needs from a vanilla creature.
 * @param {Entity} e
 * @returns {OriginData}
 */
export function captureOrigin(e) {
  const type = e.typeId;
  /** @type {OriginData} */
  const d = { v: 1, type, baby: hasComp(e, "minecraft:is_baby") };
  try {
    if (e.nameTag) d.name = e.nameTag;
  } catch {
    // no name
  }
  switch (type) {
    case "minecraft:villager_v2":
      d.variant = compValue(e, "minecraft:variant") ?? 0;
      d.mark = compValue(e, "minecraft:mark_variant") ?? 0;
      d.skin = compValue(e, "minecraft:skin_id") ?? 0;
      break;
    case "minecraft:villager":
      d.v1variant = clampInt(compValue(e, "minecraft:variant") ?? 0, 0, 4);
      d.variant = V1_TO_V2[d.v1variant];
      break;
    case "minecraft:mooshroom":
      d.moo = compValue(e, "minecraft:variant") === 1 ? 1 : 0;
      break;
    case "minecraft:sheep":
      d.color = compValue(e, "minecraft:color") ?? 0;
      d.sheared = hasComp(e, "minecraft:is_sheared");
      break;
    default:
      break;
  }
  return d;
}

/**
 * Events to send to the new infected entity so it looks like the original.
 * @param {OriginData} d
 * @param {string} infectedType
 * @returns {string[]}
 */
export function infectedEventsFor(d, infectedType) {
  /** @type {string[]} */
  const ev = [];
  switch (d.type) {
    case "minecraft:villager_v2":
      ev.push(EVENTS.SET_VARIANT_PREFIX + clampInt(d.variant, 0, 14));
      ev.push(EVENTS.SET_MARK_PREFIX + clampInt(d.mark, 0, 6));
      ev.push(EVENTS.SET_SKIN_PREFIX + clampInt(d.skin, 0, 5));
      break;
    case "minecraft:villager":
      ev.push(EVENTS.SET_VARIANT_PREFIX + clampInt(d.variant, 0, 14));
      break;
    case "minecraft:cow":
      ev.push(EVENTS.SET_VARIANT_PREFIX + 0);
      break;
    case "minecraft:mooshroom":
      ev.push(EVENTS.SET_VARIANT_PREFIX + (d.moo === 1 ? 2 : 1));
      break;
    case "minecraft:sheep":
      ev.push(EVENTS.SET_COLOR_PREFIX + clampInt(d.color, 0, 15));
      if (d.sheared) ev.push(EVENTS.SET_SHEARED);
      break;
    default:
      break;
  }
  if (d.baby && BABY_CAPABLE.has(infectedType)) ev.push(EVENTS.MAKE_BABY);
  return ev;
}

/**
 * Vanilla events that restore the original look of a cured creature.
 * @param {OriginData} d
 * @returns {string[]}
 */
export function revertEventsFor(d) {
  const born = "minecraft:entity_born";
  const grow = "minecraft:ageable_grow_up";
  switch (d.type) {
    case "minecraft:villager_v2": {
      if (d.baby) return [born];
      const e = V2_BECOME_EVENTS[clampInt(d.variant, 0, 14)];
      return e ? [e] : [];
    }
    case "minecraft:villager":
      return d.baby ? [born] : [V1_SPAWN_EVENTS[clampInt(d.v1variant, 0, 4)]];
    case "minecraft:mooshroom":
      if (d.baby) return [born, d.moo === 1 ? "minecraft:become_brown" : "minecraft:become_red"];
      return d.moo === 1 ? ["minecraft:become_red_adult", "minecraft:become_brown"] : ["minecraft:become_red_adult"];
    case "minecraft:sheep": {
      const ev = [d.baby ? born : grow];
      if (d.sheared) ev.push("minecraft:on_sheared");
      return ev;
    }
    case "minecraft:cow":
    case "minecraft:pig":
    case "minecraft:chicken":
      return [d.baby ? born : grow];
    default:
      return [];
  }
}

/**
 * @param {Entity} e
 * @param {string[]} events
 * @param {string} label
 */
function triggerAll(e, events, label) {
  for (const ev of events) {
    try {
      e.triggerEvent(ev);
    } catch (err) {
      logError(`${label}(${ev})`, err);
    }
  }
}

/**
 * @param {Entity} e
 * @returns {Vector2 | undefined}
 */
function rotationOf(e) {
  try {
    return e.getRotation();
  } catch {
    return undefined;
  }
}

/**
 * @param {Entity} e
 * @param {Vector2 | undefined} rot
 */
function setRotation(e, rot) {
  if (!rot) return;
  try {
    e.setRotation(rot);
  } catch {
    // not supported for this entity
  }
}

/** @typedef {"converted" | "held" | "invalid" | "failed"} ConvertResult */

/**
 * Convert a fully incubated vanilla mob now (SPEC §7 "Conversion").
 * @param {Entity} e
 * @param {HordeBudget} [budget]
 * @returns {ConvertResult}
 */
export function convertMob(e, budget = new HordeBudget()) {
  if (!isAlive(e)) return "invalid";
  const target = /** @type {Record<string, string>} */ (CONVERSIONS)[e.typeId];
  if (!target) return "invalid";
  if (!budget.hasRoom()) return "held";
  const dim = e.dimension;
  const loc = e.location;
  const rot = rotationOf(e);
  const data = captureOrigin(e);
  /** @type {Entity} */
  let ne;
  try {
    ne = dim.spawnEntity(target, loc);
  } catch (err) {
    logError("outbreak.convert.spawn", err);
    return "failed";
  }
  budget.take();
  setRotation(ne, rot);
  triggerAll(ne, infectedEventsFor(data, target), "outbreak.convert.event");
  try {
    ne.setDynamicProperty(PROPS.EPOCH, S().epoch);
    ne.setDynamicProperty(PROPS.ORIGIN, data.type);
    ne.setDynamicProperty(PROPS.ORIGIN_DATA, JSON.stringify(data));
    if (data.name) ne.nameTag = data.name;
  } catch (err) {
    logError("outbreak.convert.props", err);
  }
  applySpawnDormancy(ne);
  rt.held.delete(e.id);
  try {
    e.remove();
  } catch (err) {
    logError("outbreak.convert.remove", err);
  }
  conversionBurst(dim, loc);
  playSound(dim, SOUNDS.INFECTION_CONVERT, loc);
  S().stats.conversions++;
  markDirty();
  return "converted";
}

/**
 * Convert up to `limit` mobs from the conversion queue (stops when the horde is full;
 * held mobs are re-evaluated by the next incubation cycle).
 * @param {number} limit
 * @returns {number} attempts
 */
export function processConvertQueue(limit) {
  if (limit <= 0 || rt.convertQueue.size === 0) return 0;
  const budget = new HordeBudget();
  let n = 0;
  for (const [id, e] of rt.convertQueue) {
    if (n >= limit) break;
    rt.convertQueue.delete(id);
    n++;
    /** @type {ConvertResult | undefined} */
    let r;
    try {
      r = convertMob(e, budget);
    } catch (err) {
      logError("outbreak.convert", err);
    }
    if (r === "held") {
      // no room left: everything still queued holds at 0 until a slot frees
      rt.held.add(id);
      for (const rest of rt.convertQueue.keys()) rt.held.add(rest);
      rt.convertQueue.clear();
      break;
    }
  }
  return n;
}

/**
 * Parse pas:origin_data of an infected creature.
 * @param {Entity} e
 * @returns {OriginData | undefined}
 */
export function readOrigin(e) {
  try {
    const type = e.getDynamicProperty(PROPS.ORIGIN);
    if (typeof type !== "string") return undefined;
    const raw = e.getDynamicProperty(PROPS.ORIGIN_DATA);
    /** @type {OriginData} */
    let d = { v: 1, type, baby: false };
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") d = { ...parsed, v: 1, type, baby: parsed.baby === true };
    }
    return d;
  } catch {
    return undefined;
  }
}

/**
 * Write a value component later (after the spawn event groups were applied).
 * @param {Entity} e
 * @param {string} componentId
 * @param {number | undefined} value
 */
function deferValue(e, componentId, value) {
  if (typeof value !== "number") return;
  defer(2, "outbreak.cure.value", () => {
    if (!e.isValid()) return;
    const c = /** @type {{value: number} | undefined} */ (/** @type {unknown} */ (e.getComponent(componentId)));
    if (c) c.value = value;
  });
}

/** @typedef {"reverted" | "removed" | "failed"} RevertResult */

/**
 * Cure one horde entity: infected creatures with a vanilla origin turn back
 * into it (best effort, see file header); everything else is removed.
 * @param {Entity} e
 * @returns {RevertResult}
 */
export function revertCreature(e) {
  const d = readOrigin(e);
  const originType = d?.type;
  if (!d || !originType || !(originType in CONVERSIONS)) {
    try {
      e.remove();
    } catch {
      return "failed";
    }
    return "removed";
  }
  const dim = e.dimension;
  const loc = e.location;
  const rot = rotationOf(e);
  /** @type {Entity} */
  let ne;
  try {
    ne = dim.spawnEntity(originType, loc);
  } catch (err) {
    logError("outbreak.cure.spawn", err);
    return "failed"; // left in place; the sync sweep retries (its epoch is stale)
  }
  setRotation(ne, rot);
  triggerAll(ne, revertEventsFor(d), "outbreak.cure.event");
  if (d.name) {
    try {
      ne.nameTag = d.name;
    } catch {
      // ignore
    }
  }
  if (originType === "minecraft:villager_v2") {
    deferValue(ne, "minecraft:mark_variant", d.mark);
    deferValue(ne, "minecraft:skin_id", d.skin);
  } else if (originType === "minecraft:sheep") {
    deferValue(ne, "minecraft:color", d.color);
  }
  try {
    e.remove();
  } catch (err) {
    logError("outbreak.cure.remove", err);
  }
  conversionBurst(dim, loc);
  playSound(dim, SOUNDS.INFECTION_CONVERT, loc, { pitch: 1.6, volume: 0.8 });
  return "reverted";
}
